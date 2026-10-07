#!/usr/bin/env python3
"""
clipfit - detect and repair bottom clipping in LibreOffice PPTX/PPSX -> PDF output.

The defect this exists for
--------------------------
These decks declare their Arabic (complex-script) face as a font the conversion
host does not have:

    <a:defRPr sz="4000" b="1">
      <a:latin typeface="Calibri"/>
      <a:cs typeface="Times New Roman"/>      <- complex script = Arabic
    </a:defRPr>

PowerPoint measures its text boxes against Times New Roman. Linux has no Times
New Roman, so fontconfig substitutes Noto Naskh Arabic, whose advance widths are
larger. Every paragraph then wraps onto an extra line. The block is top-anchored
(``anchor="t"``), so the extra lines push the text past the shape's own box and
eventually past the 540pt slide edge, where LibreOffice stops painting it: the
last verse line disappears, or glyphs are cut in half by the page boundary.

Measured on deck "2 ابريل" (13 slides), same source, only the host fonts differ:

    host with Times New Roman   13/13 slides ok,   text bottom 2..6pt INSIDE its box
    host without it              9 clipped + 3 truncated, text up to 40pt past the
                                 page and 132pt past its own box

Two defects therefore have to be detected, and only the first is visible from
the page edge alone:

* ``gap <= 0``     - some word's yMax reaches the page height (glyphs cut off).
* ``missing > 0``  - source characters absent from the PDF text layer, i.e.
                     LibreOffice dropped a whole overflow line. On "2 ابريل"
                     slide 5 the page still ends 7.2pt short of the edge, yet
                     the entire 4th verse line (17 chars) was never painted.

The repair is deliberately two-stage and scoped to the shapes detection named:

1. ``rebind`` - point the affected shapes' ``<a:cs>`` at a font carried inside
   the deck itself (``p:embeddedFontLst``), which LibreOffice reads out of the
   file, so layout stops depending on which fonts the host happens to have.
   Font size and typeface choice for healthy slides are untouched.

2. ``autofit`` - fallback when no embedded face fits: turn the shape's
   ``<a:spAutoFit/>`` (resize shape to text, which headless LibreOffice never
   performs) into ``<a:normAutofit/>`` (shrink text on overflow). LibreOffice
   computes the scale from the real substituted metrics, so this is a measured
   per-shape fit rather than a blanket size cut.

3. ``inset`` - when a shape still reaches the slide edge after autofit (or never
   got an autofit at all), push its bottom text inset (``bIns``) out by a
   measured factor of the overflow. That makes *LibreOffice's own* fit test
   fail, so it chooses the per-shape scale itself instead of us; geometry, font
   sizes and every other attribute stay untouched. ``inset`` never fires on a
   page whose rendered ink is proven undamaged (phantom guard): pdftotext word
   boxes carry the font's ascent/descent (measured up to ~104pt tall in these
   decks), so a page can look clipped while its pixels are safely inside.

Slides detection did not flag are copied through byte for byte.

CLI
---
    clipfit.py detect <pdf> <source> [--gap-warn PT]     -> JSON on stdout
    clipfit.py phantom <pdf> --pages 3,5,9 [--limit PT]  -> {page: margin} from pixels
    clipfit.py patch <source> <dst> <plan.json> --mode rebind --face NAME
    clipfit.py patch <source> <dst> <plan.json> --mode autofit
    clipfit.py patch <source> <dst> <plan.json> --mode inset

``plan`` is ``{"<slide>": [<segidx>, ...]}`` for rebind/autofit, or
``{"<slide>": {<segidx>: <extra pt>}}`` for inset - the shapes detection picked.
"""
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

import fitlib
from fitlib import A, P, ARABIC, EMU, NS, NSDECL, SP, text_frames

X = '{http://www.w3.org/1999/xhtml}'

# A page is only "at risk" this close to the edge; also the band within which a
# shape's text bottom counts as the one responsible for a page overflow.
DEFAULT_GAP_WARN = 10.0

# Slides whose rendered text already sits this far inside the edge are never
# touched, whatever their box looks like.
REPAIR_GAP_WARN = 0.0

# Fix 2 - measured autofit+inset (verified on the full 101-deck corpus):
#   INSET_FACTOR    2.0x of the shape's box overflow is what closed the last
#                   edge cases (1.5 left several pages at <1pt; the pilot's
#                   proven autofit+inset used 2.0x to reach C0 across the set).
#   INSET_CAP_PT    never push the text area down by more than this.
#   INSET_MAX_FRAC  never eat more than half the frame's own height.
#   PHANTOM_PT      a page whose *rendered* ink keeps at least this much clear
#                   of the slide edge is a phantom flag (only 4 of the 85 had
#                   >30pt of real margin; the detector flags them via inflated
#                   word boxes) and is never modified.
INSET_FACTOR = 2.0
INSET_CAP_PT = 90.0
INSET_MAX_FRAC = 0.5
PHANTOM_PT = 30.0

# EMU bottom-inset `fitlib.text_frames` assumes when a body declares none.
DEFAULT_BINS = 45720


def norm(s):
    """Comparison form: drop whitespace, tatweel and diacritics, unify the alef
    forms, yeh and teh marbuta. Without this a reflow that merely re-breaks a
    line reads as missing text."""
    s = re.sub(r'[ً-ْٰـ]', '', s)
    s = re.sub(r'[آأإٱ]', 'ا', s)
    s = re.sub(r'[ىي]', 'ي', s)
    s = re.sub(r'ة', 'ه', s)
    return re.sub(r'\s+', '', s or '')


def _missing(src, rendered):
    """Characters of ``src`` not covered by ``rendered`` (multiset, order-free
    so an RTL re-extraction cannot fake a result)."""
    have = {}
    for c in rendered:
        have[c] = have.get(c, 0) + 1
    out = []
    for c in src:
        if have.get(c, 0) > 0:
            have[c] -= 1
        else:
            out.append(c)
    return out


def slide_texts(pptx):
    """-> {slide: {segidx: text}} using the same <p:sp> indexing as fitlib."""
    out = {}
    z = zipfile.ZipFile(pptx)
    try:
        for n in z.namelist():
            m = re.match(r'ppt/slides/slide(\d+)\.xml$', n)
            if not m:
                continue
            raw = z.read(n).decode('utf8', 'replace')
            per = {}
            for segidx, seg in enumerate(SP.finditer(raw)):
                t = ''.join(x or '' for x in
                            re.findall(r'<a:t>(.*?)</a:t>', seg.group(0), re.S))
                if t.strip():
                    per[segidx] = t
            out[int(m.group(1))] = per
    finally:
        z.close()
    return out


def embedded_faces(pptx):
    """Typefaces LibreOffice can load straight out of the package. These are the
    only rebind targets that are guaranteed to exist on any host."""
    try:
        z = zipfile.ZipFile(pptx)
        try:
            xml = z.read('ppt/presentation.xml').decode('utf8', 'replace')
        finally:
            z.close()
    except Exception:
        return []
    lst = re.search(r'<p:embeddedFontLst>.*?</p:embeddedFontLst>', xml, re.S)
    if not lst:
        return []
    return re.findall(r'<p:font\s+typeface="([^"]+)"', lst.group(0))


def face_priority(pptx):
    """Embedded faces, most-referenced first: the face the deck itself uses most
    is the one its boxes were most likely laid out against."""
    embedded = embedded_faces(pptx)
    if not embedded:
        return []
    refs = {}
    try:
        z = zipfile.ZipFile(pptx)
        try:
            for n in z.namelist():
                if re.match(r'ppt/slides/slide\d+\.xml$', n):
                    for f in re.findall(r'typeface="([^"]+)"', z.read(n).decode('utf8', 'replace')):
                        refs[f] = refs.get(f, 0) + 1
        finally:
            z.close()
    except Exception:
        refs = {}
    return sorted(embedded, key=lambda f: (-refs.get(f, 0), f))


def page_words(pdf):
    """-> [{page, width, height, words:[(x0,y0,x1,y1,text)]}] via pdftotext."""
    import subprocess
    r = subprocess.run(['pdftotext', '-bbox', '-enc', 'UTF-8', pdf, '-'],
                       capture_output=True)
    try:
        root = ET.fromstring(r.stdout.decode('utf8', 'replace'))
    except (ET.ParseError, UnicodeDecodeError):
        return []
    out = []
    for i, pg in enumerate(root.iter(X + 'page'), start=1):
        words = []
        for w in pg.iter(X + 'word'):
            t = ''.join(w.itertext())
            if not t.strip():
                continue
            words.append((float(w.get('xMin')), float(w.get('yMin')),
                          float(w.get('xMax')), float(w.get('yMax')), t))
        out.append({'page': i,
                    'width': float(pg.get('width') or 0),
                    'height': float(pg.get('height') or 0),
                    'words': words})
    return out


def _bucket(words, frames):
    """Assign words to shapes by x-centre, as fitlib.measure does."""
    buckets = [[] for _ in frames]
    for b in words:
        xc, yc = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        best, bestgap = -1, None
        for j, (_si, x, y, w, h, _pt, _pb, _nm) in enumerate(frames):
            if not (x - 3 <= xc <= x + w + 3):
                continue
            gap = 0.0 if y <= yc <= y + h else min(abs(yc - y), abs(yc - (y + h)))
            if bestgap is None or gap < bestgap:
                best, bestgap = j, gap
        if best >= 0:
            buckets[best].append(b)
    return buckets


def detect(pdf, source, gap_warn=DEFAULT_GAP_WARN):
    """-> report dict; never raises - a bad PDF or an unreadable source comes
    back as ``ok: false``, because the caller converts decks, not debuggers."""
    try:
        return _detect(pdf, source, gap_warn)
    except Exception as e:
        return {'ok': False, 'error': '%s: %s' % (type(e).__name__, e)}


def _detect(pdf, source, gap_warn=DEFAULT_GAP_WARN):
    frames = text_frames(source)
    texts = slide_texts(source)
    pages = page_words(pdf)
    if not pages:
        return {'ok': False, 'error': 'pdftotext produced no pages'}

    slides, shapes, clipped, truncated, at_risk, repair = [], {}, [], [], [], []
    shape_ovf = {}
    for pg in pages:
        i = pg['page']
        H = pg['height']
        words = pg['words']
        fr = frames.get(i, [])
        per = texts.get(i, {})
        rec = {'page': i, 'page_h': round(H, 1), 'gap': None, 'verdict': 'EMPTY',
               'missing_chars': 0, 'text_bottom': None, 'box_bottom': None,
               'overflow': None, 'worst_word': None}
        if not words:
            slides.append(rec)
            continue

        maxy = max(b[3] for b in words)
        miny = min(b[1] for b in words)
        gap = H - maxy
        rec.update({'gap': round(gap, 1), 'text_top': round(miny, 1),
                    'text_bottom': round(maxy, 1),
                    'worst_word': max(words, key=lambda b: b[3])[4][:40]})

        src_text = norm(''.join(per.values()))
        rendered = norm(''.join(b[4] for b in words))
        miss = len(_missing(src_text, rendered))
        rec['missing_chars'] = miss

        buckets = _bucket(words, fr) if fr else []
        worst_bottom = None
        picks = []
        for j, ((si, x, y, w, h, pt, pb, nm), sel) in enumerate(zip(fr, buckets)):
            if not sel:
                continue
            ty1 = max(b[3] for b in sel)
            box_bottom = y + h - pb
            if worst_bottom is None or ty1 > worst_bottom[1]:
                worst_bottom = (si, ty1)
            if ty1 > H - gap_warn or ty1 > box_bottom + 2.0:
                picks.append(si)
            if rec['box_bottom'] is None or box_bottom > rec['box_bottom']:
                rec['box_bottom'] = round(box_bottom, 1)
                rec['overflow'] = round(ty1 - box_bottom, 1)
            shape_ovf.setdefault(str(i), {})[si] = {
                'ovf': round(ty1 - box_bottom, 1),
                'h': round(h, 1),
                'ink_bottom': round(ty1, 1),
                'box_bottom': round(box_bottom, 1),
            }

        if gap <= REPAIR_GAP_WARN:
            rec['verdict'] = 'CLIPPED'
            clipped.append(i)
        elif miss > 0:
            rec['verdict'] = 'TRUNCATED'
            truncated.append(i)
        elif gap < gap_warn:
            rec['verdict'] = 'AT-RISK'
            at_risk.append(i)
        else:
            rec['verdict'] = 'ok'
        slides.append(rec)

        if rec['verdict'] in ('CLIPPED', 'TRUNCATED'):
            repair.append(i)
            if not picks:
                # No shape reached the danger band (a dropped line leaves no
                # words behind), so every text shape on this slide is in scope.
                picks = sorted(per.keys())
            shapes[str(i)] = sorted(set(picks))

    return {
        'ok': True,
        'pages': len(pages),
        'page_h': round(pages[0]['height'], 1),
        'gap_warn': gap_warn,
        'clipped': clipped,
        'truncated': truncated,
        'at_risk': at_risk,
        'repair': repair,
        'shapes': shapes,
        'shape_ovf': shape_ovf,
        'faces': face_priority(source),
        'slides': slides,
        'totals': {'clipped': len(clipped), 'truncated': len(truncated),
                   'at_risk': len(at_risk),
                   'ok': sum(1 for s in slides if s['verdict'] == 'ok')},
    }


def _patch_segments(raw, plan_slide, fn):
    """Apply ``fn`` to exactly the <p:sp> segments named in plan_slide.

    ``plan_slide`` is a list of segment indexes (rebind/autofit) or a dict
    ``{segidx: param}`` (inset); ``fn`` always receives ``(seg, param)``."""
    if not plan_slide:
        return raw, 0
    if isinstance(plan_slide, dict):
        wanted = set(plan_slide)
        param = lambda idx: plan_slide[idx]
    else:
        wanted = set(plan_slide)
        param = lambda idx: None
    chunks, pos, hits = [], 0, 0
    for idx, mo in enumerate(SP.finditer(raw)):
        if idx not in wanted:
            continue
        chunks.append(raw[pos:mo.start()])
        seg, n = fn(mo.group(0), param(idx))
        chunks.append(seg)
        hits += n
        pos = mo.end()
    chunks.append(raw[pos:])
    return ''.join(chunks), hits


def rebind_segment(seg, face):
    """Point every complex-script reference in this shape at ``face``.

    Scoped to shapes that actually carry Arabic: a Latin-only box is laid out
    against its own face, so rebinding it would be a change detection never asked
    for. When the shape only declares a paragraph-level default (the usual case
    here - the runs carry no ``<a:cs>`` at all) the default is what gets
    rebound, and no per-run face is invented on top of it."""
    if not ARABIC.search(seg):
        return seg, 0
    before = seg
    out = re.sub(r'(<a:cs\b[^>]*?typeface=")[^"]*(")',
                 lambda m: m.group(1) + face + m.group(2), seg)
    if out == seg:
        out = fitlib.inject_cs(seg, face)
    return out, (1 if out != before else 0)


def autofit_segment(seg, _face=None):
    """swap resize-shape-to-text for shrink-text-on-overflow.

    Headless LibreOffice never grows a shape to fit its text, so ``spAutoFit``
    does nothing for us here while ``normAutofit`` makes it compute a font scale
    from the substituted metrics. Healthy shapes keep their own bodyPr."""
    if '<a:normAutofit' in seg:
        return seg, 0
    if '<a:spAutoFit/>' in seg:
        return seg.replace('<a:spAutoFit/>', '<a:normAutofit/>'), 1

    # Only the *opening* <a:bodyPr ...> tag is matched. The old pattern also
    # swallowed the bodyPr's children and its closing tag, so ``add`` wound up
    # writing a second ``</a:bodyPr>`` - malformed XML that sent the shape's
    # whole slide to LibreOffice's repair dialog. A noAutofit body element is
    # replaced in place; otherwise autofit is inserted as the first child.
    if '<a:noAutofit/>' in seg:
        return seg.replace('<a:noAutofit/>', '<a:normAutofit/>'), 1

    def add(m):
        head = m.group(0)
        if head.endswith('/>'):
            return head[:-2] + '><a:normAutofit/></a:bodyPr>'
        return head + '<a:normAutofit/>'

    out, n = re.subn(r'<a:bodyPr\b[^>]*(?:/>|>)', add, seg, count=1, flags=re.S)
    return out, n


def inset_segment(seg, extra_pt):
    """push the shape's bottom text inset (``bIns``) out by ``extra_pt``.

    That shortens the text area the way layout does (without touching the
    frame, its font sizes, or its run properties), so LibreOffice's own fit test
    fails and it picks the per-shape scale itself under ``normAutofit``. A body
    with no explicit inset is given the 45720-EMU default ``fitlib`` assumes, so
    the math matches detection. Only the body's bottom inset is touched."""
    if not extra_pt or float(extra_pt) <= 0 or '<a:bodyPr' not in seg:
        return seg, 0
    added = int(round(float(extra_pt) * fitlib.EMU / 72.0))

    def bump(m):
        head = m.group(0)
        closed = head.endswith('/>')
        open_ = head[:-2] if closed else head[:-1]
        m_b = re.search(r'bIns="([0-9]+)"', open_)
        if m_b:
            n = re.sub(r'bIns="[0-9]+"',
                       lambda mm: 'bIns="%d"' % (int(m_b.group(1)) + added),
                       open_)
        else:
            n = '%s bIns="%d"' % (open_, DEFAULT_BINS + added)
        return n + ('/>' if closed else '>')

    out, n = re.subn(r'<a:bodyPr\b[^>]*?(?:/>|>)', bump, seg, count=1, flags=re.S)
    return out, n


def patch(source, dst, plan, mode, face=None):
    """Rewrite only the named shapes. -> {'ok':..., 'changed':..., 'error':...}"""
    if mode == 'rebind':
        if not face:
            return {'ok': False, 'error': 'rebind requires --face'}
        fn = lambda seg, _p: rebind_segment(seg, face)
    elif mode == 'autofit':
        fn = autofit_segment
    elif mode == 'inset':
        fn = inset_segment
    else:
        return {'ok': False, 'error': 'unknown mode %r' % mode}

    try:
        zin = zipfile.ZipFile(source)
    except Exception as e:
        return {'ok': False, 'error': 'source: %s' % e}

    changed = 0
    per_slide = {}
    try:
        zo = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
        for it in zin.infolist():
            d = zin.read(it.filename)
            m = re.match(r'ppt/slides/slide(\d+)\.xml$', it.filename)
            if m:
                sl = int(m.group(1))
                plan_slide = plan.get(sl) or plan.get(str(sl)) or []
                t, n = _patch_segments(d.decode('utf8', 'replace'), plan_slide, fn)
                if n:
                    per_slide[sl] = n
                    changed += n
                d = t.encode('utf8')
            ni = zipfile.ZipInfo(it.filename, date_time=it.date_time)
            ni.compress_type = zipfile.ZIP_DEFLATED
            zo.writestr(ni, d)
        zo.close()
    except Exception as e:
        zin.close()
        return {'ok': False, 'error': 'write: %s' % e}
    zin.close()

    if not changed:
        # The output file already exists by now; leaving a half-considered deck
        # behind is how a "failed" repair gets published as a good one.
        try:
            os.remove(dst)
        except OSError:
            pass
        return {'ok': False, 'error': 'no matching shapes in plan'}
    # LibreOffice answers malformed slide XML with a black frame rather than an
    # error, so refuse to emit anything that does not parse.
    broken = fitlib.validate_slides(dst)
    if broken:
        try:
            os.remove(dst)
        except OSError:
            pass
        return {'ok': False,
                'error': 'malformed slide XML (%d): %s'
                         % (len(broken), '; '.join(broken[:3]))}
    return {'ok': True, 'changed': changed, 'slides': per_slide}


def pixel_margins(pdf, pages, limit=PHANTOM_PT, dpi=150):
    """-> {page: margin_pt} measured from the *rendered* bottom edge of `pages`.

    Page numbers are 1-based, as in the detect report. The margin is the number
    of points between the lowest inked raster row and the page's bottom edge.
    pdftotext word boxes carry the font's ascent/descent (measured up to ~104pt
    tall in these decks), so a page can look "clipped" while its pixels are
    safely inside - such pages are phantom flags and must not be modified. A
    page the renderer cannot read comes back None, which callers treat as "not
    proven phantom", i.e. still in scope."""
    import glob
    import subprocess
    import tempfile
    from PIL import Image
    import shutil as _shutil

    tmp = tempfile.mkdtemp()
    out = {}
    try:
        for p in pages:
            stem = os.path.join(tmp, 'ph%d' % p)
            r = subprocess.run(['pdftoppm', '-png', '-r', str(dpi),
                                '-f', str(p), '-l', str(p), pdf, stem],
                               capture_output=True, timeout=60)
            hits = sorted(glob.glob(stem + '*.png'))
            if r.returncode != 0 or not hits:
                out[p] = None
                continue
            try:
                im = Image.open(hits.pop()).convert('L')
                w, h = im.size
                px = im.load()
                need = max(8, int(0.004 * w))
                last = None
                for y in range(h - 1, -1, -1):
                    prev = px[0, y]
                    c = 0
                    for x in range(1, w):
                        v = px[x, y]
                        if abs(v - prev) > 35:
                            c += 1
                        prev = v
                        if c >= need:
                            break
                    if c >= need:
                        last = y
                        break
                out[p] = (None if last is None
                          else round((h - last) / (dpi / 72.0), 1))
            finally:
                for f in hits:
                    os.remove(f)
    finally:
        _shutil.rmtree(tmp, ignore_errors=True)
    return out


def main(argv):
    if len(argv) < 2:
        print(__doc__.strip())
        return 2
    cmd = argv[1]
    try:
        if cmd == 'detect':
            pdf, source = argv[2], argv[3]
            gap_warn = DEFAULT_GAP_WARN
            if '--gap-warn' in argv:
                gap_warn = float(argv[argv.index('--gap-warn') + 1])
            print(json.dumps(detect(pdf, source, gap_warn), ensure_ascii=False))
            return 0

        if cmd == 'phantom':
            pdf = argv[2]
            key = lambda k: argv.index('--' + k)
            pages = [int(x) for x in argv[key('pages') + 1].split(',') if x.strip()]
            limit = float(argv[key('limit') + 1]) if '--limit' in argv else PHANTOM_PT
            margins = pixel_margins(pdf, pages, limit)
            print(json.dumps({'ok': True, 'limit': limit,
                              'margins': {str(k): v for k, v in margins.items()}},
                             ensure_ascii=False))
            return 0

        if cmd == 'patch':
            source, dst, plan_path = argv[2], argv[3], argv[4]
            mode = argv[argv.index('--mode') + 1] if '--mode' in argv else None
            face = argv[argv.index('--face') + 1] if '--face' in argv else None
            with open(plan_path, encoding='utf-8-sig') as f:
                plan = json.load(f)
            print(json.dumps(patch(source, dst, plan, mode, face),
                              ensure_ascii=False))
            return 0

        print('unknown command: %s' % cmd, file=sys.stderr)
        return 2
    except Exception as e:  # the caller needs JSON, never a traceback
        print(json.dumps({'ok': False, 'error': '%s: %s' % (type(e).__name__, e)}))
        return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))