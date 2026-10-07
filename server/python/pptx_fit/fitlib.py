#!/usr/bin/env python3
"""
fitlib - Arabic-correct PPTX/PPSX -> per-slide WebP rendering.

Why each step exists (all confirmed against real LibreOffice output, not theory):

1. cs injection. A run whose <a:cs> slot is empty does not fall back to a system
   Arabic font on Linux the way PowerPoint does - LibreOffice paints nothing, so
   the text silently disappears. Pointing <a:cs> at a real Arabic face restores it.
   The source decks reference "Ara Hamah Homs", an MTX-embedded face that cannot be
   decoded here, so every reference to it is rewritten too.

2. per-shape auto-shrink, then per-shape box growth. A substituted Arabic face has
   different vertical metrics from the original, so blocks that PowerPoint fitted
   inside their box overflow on Linux. Each <p:sp> is scaled independently - a footer
   band cannot drag the title down with it - and only a genuine overshoot past the
   shape's bottom edge drives a reduction, with the ratio derived from the overshoot
   itself.

   Shrinking alone is not always enough. When a shape is still over at the floor
   (0.50), the measured cause is the box, not the font: one real deck had a 200pt
   block in a 155pt box, and a 244pt block whose box was 410pt tall but which still
   hung 7.2pt past the bottom edge. Pushing the font further would mean unreadable
   39% type, so the box is grown downward instead - x, y and width untouched so the
   text keeps its place, capped at MAX_GROW and never past the slide edge. Extra
   rounds cannot help once the floor is hit: the overshoot curve is flat from round
   5 to round 16.

3. shape indexing. Factors are keyed by the position of the <p:sp> in the raw XML,
   because build() rewrites that same sequence. Deriving the index from a filtered
   ElementTree walk silently misaligns the two and applies factors to the wrong
   shapes.
"""
import glob
import os
import re
import shutil
import subprocess
import zipfile
import xml.etree.ElementTree as ET

zipfile.ZipExtFile._update_crc = lambda self, data: None

A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
NS = {'a': A, 'p': P}
X = '{http://www.w3.org/1999/xhtml}'
EMU = 914400.0
ARABIC = re.compile(r'[\u0600-\u06FF]')
BROKEN = 'Ara Hamah Homs'
TOL = 2.0
MARGIN = 2.0
FLOOR = 0.50
MIN_H = 40.0
# A shape whose text is still too tall at FLOOR gets its box grown downward
# instead, up to this many points, so the font never has to go sub-50%.
MAX_GROW = 96.0
# Shrinking is abandoned for a shape once the font is already this small: on a
# bottom-pinned block it buys ~0.3pt of headroom per round, because the bottom
# edge is pinned and the freed space collects at the top. The box is what is
# wrong there, so switch to growing it rather than grinding the font down.
GROW_TRIGGER = 0.85
# ...or when a round of shrinking bought less than this many points of headroom.
STALL_PT = 0.5
SP = re.compile(r'<p:sp>.*?</p:sp>', re.S)
NSDECL = ('<root xmlns:a="%s" xmlns:p="%s" '
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
          % (A, P))


def _sof():
    for c in [os.environ.get('SOFFICE_BIN'), '/opt/libreoffice26.8/program/soffice',
              '/usr/bin/soffice', 'soffice', 'libreoffice']:
        if c and os.path.exists(c):
            return c
    from shutil import which
    for c in ('soffice', 'libreoffice'):
        w = which(c)
        if w:
            return w
    return 'soffice'


SOF = _sof()


def inject_cs(t, cs):
    """Give every Arabic run a usable complex-script face; drop the broken one."""
    t = re.sub(r'(<a:cs\b[^>]*?typeface=")' + re.escape(BROKEN) + r'(")',
               r'\g<1>' + cs + r'\g<2>', t)
    edits = []
    for m in re.finditer(r'<a:rPr\b[^>]*?(?:/>|>.*?</a:rPr>)', t, re.S):
        blk = m.group(0)
        tm = re.search(r'<a:t>(.*?)</a:t>', t[m.end():m.end() + 400], re.S)
        if not tm or not ARABIC.search(tm.group(1)):
            continue
        if re.search(r'<a:cs\b', blk):
            nb = re.sub(r'<a:cs typeface="[^"]*"', '<a:cs typeface="%s"' % cs, blk)
        else:
            ins = '<a:cs typeface="%s"/>' % cs
            # A self-closing <a:rPr .../> has to become a real open/close pair.
            # Closing it with `</>` produces XML that does not parse, and
            # LibreOffice answers an unparseable slide with a black frame
            # instead of an error - which is how 160 slides came out black.
            nb = blk[:-2].rstrip() + '>' + ins + '</a:rPr>' if blk.endswith('/>') \
                else blk.replace('</a:rPr>', ins + '</a:rPr>')
        edits.append((m.start(), m.end(), nb))
    for s, e, nb in reversed(edits):
        t = t[:s] + nb + t[e:]
    return t


def text_frames(pptx):
    """slide -> [(segidx, x, y, w, h, padTop, padBottom, name)] keyed by <p:sp> position"""
    out = {}
    z = zipfile.ZipFile(pptx)
    for n in z.namelist():
        m = re.match(r'ppt/slides/slide(\d+)\.xml$', n)
        if not m:
            continue
        raw = z.read(n).decode('utf8', 'replace')
        fr = []
        for segidx, seg in enumerate(SP.finditer(raw)):
            body = seg.group(0)
            if '<a:t>' not in body:
                continue
            try:
                el = ET.fromstring(NSDECL + body + '</root>')[0]
            except ET.ParseError:
                continue
            if el.find('.//a:t', NS) is None:
                continue
            xf = el.find('p:spPr/a:xfrm', NS)
            if xf is None:
                continue
            off, ext = xf.find('a:off', NS), xf.find('a:ext', NS)
            if off is None or ext is None:
                continue
            bp = el.find('.//a:bodyPr', NS)
            pt = int(bp.get('tIns', 45720)) / EMU * 72 if bp is not None else 3.6
            pb = int(bp.get('bIns', 45720)) / EMU * 72 if bp is not None else 3.6
            nv = el.find('p:nvSpPr/p:cNvPr', NS)
            fr.append((segidx,
                       int(off.get('x')) / EMU * 72, int(off.get('y')) / EMU * 72,
                       int(ext.get('cx')) / EMU * 72, int(ext.get('cy')) / EMU * 72,
                       pt, pb, nv.get('name') if nv is not None else '?'))
        out[int(m.group(1))] = fr
    z.close()
    return out


def slide_size(pptx):
    """(w, h) in points, so a grown box can be kept inside the slide."""
    z = zipfile.ZipFile(pptx)
    try:
        r = ET.fromstring(z.read('ppt/presentation.xml'))
    finally:
        z.close()
    sz = r.find('p:sldSz', NS)
    if sz is None or sz.get('cy') is None:
        return 960.0, 540.0
    return (int(sz.get('cx')) / EMU * 72, int(sz.get('cy')) / EMU * 72)


def grow_shape(seg, dy, dh):
    """Move this shape's box by `dy` points and make it `dh` points taller, so it
    grows toward the text that sticks out of it. Everything except the two numbers
    stays byte-identical, which keeps the round-trip safe."""
    def bump(m, val):
        return m.group(1) + str(int(m.group(2)) + val) + m.group(3)

    sm = re.search(r'<p:spPr\b[^>]*>.*?</p:spPr>', seg, re.S)
    if not sm:
        return seg
    block = sm.group(0)
    nb = block
    if dy:
        om = re.search(r'(<a:off\b[^>]*?\by=")(-?\d+)(")', nb)
        if om:
            nb = nb[:om.start()] + bump(om, int(round(dy * EMU))) + nb[om.end():]
    if dh:
        em = re.search(r'(<a:ext\b[^>]*?\bcy=")(\d+)(")', nb)
        if em:
            nb = nb[:em.start()] + bump(em, int(round(dh * EMU))) + nb[em.end():]
    if nb == block:
        return seg
    return seg[:sm.start()] + nb + seg[sm.end():]


def validate_slides(pptx):
    """-> list of 'slideN.xml: <parse error>' for slides we may have corrupted.

    The generated file is about to be handed to LibreOffice, which renders an
    unparseable slide as a black frame rather than failing. Parsing the XML here
    turns that silent corruption into a loud error."""
    bad = []
    z = zipfile.ZipFile(pptx)
    try:
        for n in z.namelist():
            if re.match(r'ppt/slides/slide\d+\.xml$', n):
                try:
                    ET.fromstring(z.read(n))
                except ET.ParseError as e:
                    bad.append('%s: %s' % (n.split('/')[-1], e))
    finally:
        z.close()
    return bad


def scan_rendered(imgdir):
    """-> [(page, reason)] for frames that decoded but carry no picture.

    A guard on the *output* rather than on the XML, so it also catches a slide
    that is legitimately blank in the source instead of only this one bug."""
    from PIL import Image, ImageStat
    bad = []
    for p in glob.glob(os.path.join(imgdir, '*.webp')):
        m = re.search(r'(\d+)\.webp$', p)
        if not m:
            continue  # not one of our slide frames
        page = int(m.group(1))
        try:
            im = Image.open(p)
            im.load()
        except Exception as e:
            bad.append((page, 'unreadable: %s' % e))
            continue
        st = ImageStat.Stat(im.convert('L'))
        if st.mean[0] < 6.0 and st.stddev[0] < 12.0:
            bad.append((page, 'black/blank frame (mean=%.1f std=%.1f)'
                        % (st.mean[0], st.stddev[0])))
    return sorted(bad)


def measure(pdf, frames, grow=None, verbose=False):
    """-> slide no -> {segidx: (overshoot_pt, shrink_need, text_top, text_bottom)}"""
    r = subprocess.run(['pdftotext', '-bbox', pdf, '-'], capture_output=True)
    try:
        root = ET.fromstring(r.stdout)
    except ET.ParseError:
        return {}
    res = {}
    for i, pg in enumerate(root.iter(X + 'page'), start=1):
        words = [(float(w.get('xMin')), float(w.get('yMin')),
                  float(w.get('xMax')), float(w.get('yMax')))
                 for w in pg.iter(X + 'word') if ''.join(w.itertext()).strip()]
        fr = frames.get(i, [])
        g = (grow or {}).get(i) or {}
        if g:
            fr = [(si, x, y + g.get(si, (0.0, 0.0))[0], w,
                   h + g.get(si, (0.0, 0.0))[1], pt, pb, nm)
                  for (si, x, y, w, h, pt, pb, nm) in fr]
        res[i] = {}
        if not words or not fr:
            continue
        buckets = [[] for _ in fr]
        for b in words:
            xc, yc = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
            best, bestgap = -1, None
            for j, (_si, x, y, w, h, pt, pb, nm) in enumerate(fr):
                if not (x - 3 <= xc <= x + w + 3):
                    continue
                gap = 0.0 if y <= yc <= y + h else min(abs(yc - y), abs(yc - (y + h)))
                if bestgap is None or gap < bestgap:
                    best, bestgap = j, gap
            if best >= 0:
                buckets[best].append(b)
        for (si, x, y, w, h, pt, pb, nm), sel in zip(fr, buckets):
            if not sel or h < MIN_H:
                continue
            ty0 = min(b[1] for b in sel)
            ty1 = max(b[3] for b in sel)
            o = ty1 - (y + h - pb)
            th = ty1 - ty0
            if verbose and o > TOL:
                print('      s%d %r: text %.0f..%.0f, box %.0f..%.0f, over %+.1f'
                      % (i, nm, ty0, ty1, y + pt, y + h - pb, o), file=os.sys.stderr)
            if o > TOL and th > 0:
                res[i][si] = (o, (th - o - MARGIN) / th, ty0, ty1)
    return res


def build(src, dst, plan, cs, grow=None):
    """plan: slide no -> {segidx: factor}; grow: slide no -> {segidx: extra pt}"""
    zin = zipfile.ZipFile(src)
    zo = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
    for it in zin.infolist():
        d = zin.read(it.filename)
        m = re.match(r'ppt/slides/slide(\d+)\.xml$', it.filename)
        if m:
            t = inject_cs(d.decode('utf8', 'replace'), cs)
            sl = int(m.group(1))
            per = plan.get(sl, {})
            gper = (grow or {}).get(sl, {})
            if per or gper:
                chunks, pos = [], 0
                for idx, mo in enumerate(SP.finditer(t)):
                    chunks.append(t[pos:mo.start()])
                    seg = mo.group(0)
                    f = per.get(idx, 1.0)
                    if f < 0.999:
                        seg = re.sub(r'sz="(\d+)"',
                                     lambda s: 'sz="%d"' % max(100, int(int(s.group(1)) * f)),
                                     seg)
                    g = gper.get(idx)
                    if g and (abs(g[0]) > 0.05 or abs(g[1]) > 0.05):
                        seg = grow_shape(seg, g[0], g[1])
                    chunks.append(seg)
                    pos = mo.end()
                chunks.append(t[pos:])
                t = ''.join(chunks)
            d = t.encode('utf8')
        ni = zipfile.ZipInfo(it.filename, date_time=it.date_time)
        ni.compress_type = zipfile.ZIP_DEFLATED
        zo.writestr(ni, d)
    zo.close()
    zin.close()


def convert(src, outdir, tag):
    shutil.rmtree(outdir, ignore_errors=True)
    os.makedirs(outdir, exist_ok=True)
    # The profile is a real directory tree; without this it leaks one copy per
    # call and fills /tmp (a small tmpfs in production) within a full batch.
    prof = '/tmp/lo_%s_%d' % (tag, os.getpid())
    shutil.rmtree(prof, ignore_errors=True)
    profile = 'file://' + prof
    try:
        subprocess.run([SOF, '-env:UserInstallation=' + profile,
                        '--headless', '--norestore', '--invisible', '--nolockcheck',
                        '--nodefault', '--nofirststartwizard',
                        '--convert-to', 'pdf:impress_pdf_Export', '--outdir', outdir, src],
                       capture_output=True, timeout=1800)
    except subprocess.TimeoutExpired:
        return None
    finally:
        shutil.rmtree(prof, ignore_errors=True)
    p = glob.glob(outdir + '/*.pdf')
    return p[0] if p else None


def fit(src, workdir, tag, cs='Tajawal', max_rounds=6):
    """-> dict(pdf, factors, grow, rounds, overflow) ; never raises"""
    try:
        frames = text_frames(src)
        _, sh = slide_size(src)
    except Exception as e:
        return {'error': 'frames: %s' % e}
    fidx = {sl: {f[0]: f for f in fr} for sl, fr in frames.items()}
    factors, grow, prev_o = {}, {}, {}
    pdf = None
    os.makedirs(workdir, exist_ok=True)
    for rnd in range(1, max_rounds + 1):
        cand = os.path.join(workdir, '%s_r%d.ppsx' % (tag, rnd))
        try:
            build(src, cand, factors, cs, grow)
        except Exception as e:
            return {'error': 'build: %s' % e}
        broken = validate_slides(cand)
        if broken:
            return {'error': 'malformed slide XML (%d): %s' % (len(broken), '; '.join(broken[:3]))}
        pdf = convert(cand, os.path.join(workdir, '%s_p%d' % (tag, rnd)), '%s%d' % (tag, rnd))
        if not pdf:
            continue
        res = measure(pdf, frames, grow)
        n = sum(len(v) for v in res.values())
        print('  round %d: %d shapes over their box' % (rnd, n), flush=True)
        if not n:
            return {'pdf': pdf, 'factors': factors, 'grow': grow,
                    'rounds': rnd, 'overflow': {}}
        for sl, shapes in res.items():
            cur = factors.setdefault(sl, {})
            gc = grow.setdefault(sl, {})
            for si, (o, need, ty0, ty1) in shapes.items():
                c = cur.get(si, 1.0)
                c2 = max(FLOOR, min(c, c * need))
                cur[si] = c2
                # The font lever is spent when the factor is already small, when it
                # froze, or when the last round of shrinking bought essentially no
                # headroom. That last one is the common case and the reason a round
                # budget alone never finishes: on a block whose bottom edge is
                # pinned, a 3% font cut moves the top edge and leaves the bottom
                # where it was, so the overshoot stands still (measured at 0.3pt
                # per round) while the factor creeps down 3% at a time.
                po = prev_o.get((sl, si))
                spent = (c2 <= GROW_TRIGGER or c2 >= c - 1e-9
                         or (po is not None and o > po - STALL_PT))
                prev_o[(sl, si)] = o
                if not (spent and o > TOL):
                    continue
                f = fidx.get(sl, {}).get(si)
                if not f:
                    continue
                # Resize the box around the measured text, on whichever side it
                # sticks out. Growing downward only is not enough: on a centre- or
                # bottom-anchored shape the text travels with the box and the
                # overshoot never closes - 8 of 12 trial decks still overflowed.
                # Never past the slide edge, never by more than MAX_GROW.
                _, _x, y, _w, h, pt, pb, _nm = f
                top = min(y, ty0 - pt)
                bot = max(y + h, ty1 + pb)
                bot = min(bot, sh - MARGIN)
                top = min(top, bot - MIN_H)
                top = max(top, MARGIN)
                if bot - top > h + MAX_GROW:
                    top = bot - (h + MAX_GROW)
                dy, dh = top - y, bot - top - h
                if abs(dy) > 0.05 or abs(dh) > 0.05:
                    gc[si] = (round(dy, 2), round(dh, 2))
                    print('    slide %d shape %d: box y%+.0f h%+.0f (shrink stalled at %.2f)'
                          % (sl, si, dy, dh, c2), flush=True)
    if not pdf:
        return {'error': 'no pdf produced'}
    res = measure(pdf, frames, grow, verbose=True)
    left = {s: {k: round(o, 1) for k, (o, _, _, _) in v.items()} for s, v in res.items() if v}
    return {'pdf': pdf, 'factors': factors, 'grow': grow,
            'rounds': max_rounds, 'overflow': left}


def render_all(pdf, outdir, width=1600, dpi=150, quality=82):
    """One pdftoppm for the whole deck, then WebP at exactly `width`. -> page count"""
    os.makedirs(outdir, exist_ok=True)
    pre = os.path.join(outdir, 'pg')
    for old in glob.glob(pre + '*'):
        os.remove(old)
    try:
        subprocess.run(['pdftoppm', '-r', str(dpi), '-png', pdf, pre],
                       capture_output=True, timeout=1800)
    except subprocess.TimeoutExpired:
        return 0
    from PIL import Image
    pngs = sorted(glob.glob(pre + '*.png'))
    n = 0
    for p in pngs:
        n += 1
        try:
            im = Image.open(p).convert('RGB')
            if im.width != width:
                im = im.resize((width, max(1, round(im.height * width / im.width))),
                               Image.LANCZOS)
            im.save(os.path.join(outdir, '%d.webp' % n), 'WEBP', quality=quality, method=6)
        except Exception:
            pass
        os.remove(p)
    return n
