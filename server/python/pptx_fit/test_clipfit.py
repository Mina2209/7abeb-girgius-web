"""Regression tests for the bottom-clipping detector and its three repair modes.

Run with:  python3 -m unittest test_clipfit -v

Two guarantees are pinned here, both of which a "clever" rewrite can silently
destroy:

1. Scope. A patch must touch only the slides/shapes detection named. Slides that
   render correctly have to come out byte for byte identical, because the whole
   contract with the rest of the pipeline is that healthy decks are not restyled
   by this fix.

2. Validity. LibreOffice answers slide XML that does not parse with a black
   frame rather than an error (160 of them across 51 decks once shipped that
   way), so every patch is run through fitlib.validate_slides and a failure must
   leave no output file behind.

The classification cases matter because the defect has two faces: text cut off
at the page edge, and a whole overflow line that LibreOffice simply never
painted. The second one is invisible from the page edge alone - deck "2 ابريل"
slide 5 ends 7.2pt short of the edge and still loses 17 characters - so a
detector that only measures the gap ships the bug.
"""
import json
import os
import shutil
import sys
import tempfile
import unittest
import zipfile
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import clipfit
import fitlib

NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main'

ARABIC_LINE = 'لابسة التوب الأبيض'


def shape(name='Box', cs='Times New Roman', autofit='<a:spAutoFit/>',
          text=ARABIC_LINE):
    """A minimal but structurally faithful text box: the paragraph-level
    complex-script default that causes the bug lives in a:lstStyle/a:lvl1pPr.

    ``cs=None`` omits it entirely, which is how most real runs in these decks
    are written - they inherit the paragraph default."""
    cs_el = '<a:cs typeface="%s"/>' % cs if cs else ''
    return (
        '<p:sp><p:nvSpPr><p:cNvPr id="2" name="%s"/></p:nvSpPr>'
        '<p:spPr><a:xfrm><a:off x="914400" y="914400"/>'
        '<a:ext cx="7472109" cy="3785652"/></a:xfrm></p:spPr>'
        '<p:txBody><a:bodyPr wrap="square" lIns="914400" bIns="45720" '
        'anchor="t">%s</a:bodyPr>'
        '<a:lstStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr>'
        '<a:lvl1pPr algn="ctr" rtl="1"><a:defRPr sz="4000" b="1">'
        '<a:latin typeface="Calibri"/>%s</a:defRPr>'
        '</a:lvl1pPr></a:lstStyle>'
        '<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="ar-EG" sz="6000"/>'
        '<a:t>%s</a:t></a:r></a:p></p:txBody></p:sp>'
    ) % (name, autofit, cs_el, text)


def slide_doc(*shapes):
    return (
        '<p:sld xmlns:p="%s" xmlns:a="%s" xmlns:r="http://schemas.openxmlformats'
        '.org/officeDocument/2006/relationships"><p:cSld><p:spTree>%s'
        '</p:spTree></p:cSld></p:sld>'
    ) % (NS_P, NS_A, ''.join(shapes))


def package(slides, extra=None):
    """-> path to a synthetic .ppsx holding the given slide documents."""
    fd, path = tempfile.mkstemp(suffix='.ppsx')
    os.close(fd)
    self_cleanup = []
    with zipfile.ZipFile(path, 'w') as z:
        for n, body in slides.items():
            z.writestr('ppt/slides/%s.xml' % n, body)
        if extra:
            for name, data in extra.items():
                z.writestr(name, data)
    self_cleanup.append(path)
    return path


def read_part(path, name):
    with zipfile.ZipFile(path) as z:
        return z.read(name)


class TestTextComparison(unittest.TestCase):
    def test_norm_ignores_diacritics_and_tatweel(self):
        self.assertEqual(clipfit.norm('وَلَمَّا'), clipfit.norm('ولما'))
        self.assertEqual(clipfit.norm('كـنيـسة'), clipfit.norm('كنيسة'))

    def test_norm_unifies_alef_yeh_and_teh_marbuta(self):
        self.assertEqual(clipfit.norm('أإآا'), 'ا' * 4)
        self.assertEqual(clipfit.norm('الزيتونى'), clipfit.norm('الزيتوني'))
        self.assertEqual(clipfit.norm('الكنيسة'), clipfit.norm('الكنيسه'))

    def test_norm_drops_whitespace(self):
        self.assertEqual(clipfit.norm('  ظهرت ف  كنيسة '), 'ظهرتفكنيسه')

    def test_missing_is_order_independent(self):
        # pdftotext re-extracts RTL runs in a different order on every host; an
        # order-sensitive comparison would report phantom "missing" text.
        src, out = 'ظهرت ف كنيسة', 'ةسينك ف تظهر'
        self.assertEqual(clipfit._missing(clipfit.norm(src), clipfit.norm(out)), [])

    def test_missing_reports_a_dropped_line(self):
        rendered = clipfit.norm('لابسة التوب')
        dropped = clipfit.norm('ظهورت ف كنيسة الزيتون')
        got = clipfit._missing(clipfit.norm(rendered + dropped), clipfit.norm(rendered))
        self.assertEqual(len(got), len(dropped))

    def test_missing_multiset_does_not_double_count(self):
        # 'ا' appears twice in the source and once in the render: exactly one is
        # missing, not both.
        self.assertEqual(len(clipfit._missing('اا', 'ا')), 1)


class TestSegmentPatches(unittest.TestCase):
    def test_rebind_rewrites_complex_script_face_only(self):
        out, n = clipfit.rebind_segment(shape(), 'Ara Hamah Homs')
        self.assertEqual(n, 1)
        self.assertIn('<a:cs typeface="Ara Hamah Homs"/>', out)
        self.assertNotIn('Times New Roman', out)
        # Latin is what PowerPoint laid the box out with for numerals; the
        # substitution that breaks Arabic metrics is the complex-script face.
        self.assertIn('<a:latin typeface="Calibri"/>', out)

    def test_rebind_adds_face_to_arabic_runs_without_one(self):
        # The common shape in these decks: runs carry no <a:cs> and rely on the
        # paragraph default. Rebinding the default is enough, but a segment with
        # no declaration at all still has to come out with an explicit face.
        out, n = clipfit.rebind_segment(shape(cs=None), 'Tajawal')
        self.assertEqual(n, 1)
        self.assertIn('<a:cs typeface="Tajawal"/>', out)

    def test_rebind_leaves_non_arabic_shape_alone(self):
        # A Latin-only box was laid out against its own face; touching it would
        # be a change detection never asked for.
        seg = shape(text='Amen')
        out, n = clipfit.rebind_segment(seg, 'Ara Hamah Homs')
        self.assertEqual((n, out), (0, seg))

    def test_autofit_swaps_resize_shape_for_shrink_text(self):
        out, n = clipfit.autofit_segment(shape())
        self.assertEqual(n, 1)
        self.assertIn('<a:normAutofit/>', out)
        self.assertNotIn('<a:spAutoFit/>', out)

    def test_autofit_adds_element_when_bodypr_has_none(self):
        out, n = clipfit.autofit_segment(shape(autofit=''))
        self.assertEqual(n, 1)
        self.assertIn('<a:normAutofit/>', out)

    def test_autofit_converts_self_closing_bodypr(self):
        seg = shape().replace('<a:bodyPr wrap="square" lIns="914400" '
                              'bIns="45720" anchor="t"><a:spAutoFit/></a:bodyPr>',
                              '<a:bodyPr anchor="t"/>')
        out, n = clipfit.autofit_segment(seg)
        self.assertEqual(n, 1)
        self.assertIn('<a:normAutofit/></a:bodyPr>', out)
        from xml.etree import ElementTree as ET
        ET.fromstring('<root xmlns:a="%s" xmlns:p="%s">%s</root>'
                      % (NS_A, NS_P, out))

    def test_autofit_is_idempotent(self):
        once, n1 = clipfit.autofit_segment(shape())
        twice, n2 = clipfit.autofit_segment(once)
        self.assertEqual((n1, n2), (1, 0))
        self.assertEqual(once, twice)

    def test_patches_produce_parseable_xml(self):
        from xml.etree import ElementTree as ET
        for fn, arg in ((clipfit.rebind_segment, 'Ara Hamah Homs'), (clipfit.autofit_segment, None)):
            out, _ = fn(shape(), arg)
            ET.fromstring('<root xmlns:a="%s" xmlns:p="%s">%s</root>'
                          % (NS_A, NS_P, out))

    def test_autofit_handles_noautofit_bodypr_with_children(self):
        # Regression for the double-closing-tag bug: a bodyPr that carries a
        # <a:noAutofit/> element must not gain a second </a:bodyPr>, which used
        # to produce XML LibreOffice answers with a black frame.
        from xml.etree import ElementTree as ET
        out, n = clipfit.autofit_segment(shape(autofit='<a:noAutofit/>'))
        self.assertEqual(n, 1)
        self.assertNotIn('</a:noAutofit/>', out)
        self.assertIn('<a:normAutofit/>', out)
        self.assertEqual(out.count('</a:bodyPr>'), 1)
        ET.fromstring('<root xmlns:a="%s" xmlns:p="%s">%s</root>'
                      % (NS_A, NS_P, out))

    def test_autofit_bodypr_with_children_stays_wellformed(self):
        from xml.etree import ElementTree as ET
        out, n = clipfit.autofit_segment(shape(autofit='<a:xSpcAutoFit/>'))
        self.assertEqual(n, 1)
        self.assertIn('<a:normAutofit/>', out)
        self.assertEqual(out.count('</a:bodyPr>'), 1)
        ET.fromstring('<root xmlns:a="%s" xmlns:p="%s">%s</root>'
                      % (NS_A, NS_P, out))

    def test_inset_bumps_bottom_inset_only(self):
        out, n = clipfit.inset_segment(shape(), 12.0)
        self.assertEqual(n, 1)
        self.assertIn('bIns="198120"', out)  # 45720 + 12pt * 12700 EMU/pt
        # everything else survives untouched
        self.assertIn('<a:spAutoFit/>', out)
        self.assertIn('lIns="914400"', out)
        self.assertIn('anchor="t"', out)
        self.assertIn('Times New Roman', out)

    def test_inset_adds_bins_when_absent(self):
        # fitlib assumes 45720 EMU when a body declares none; the bump must
        # start from that so the inset contract matches detection.
        seg = shape().replace(' bIns="45720"', '')
        out, n = clipfit.inset_segment(seg, 12.0)
        self.assertEqual(n, 1)
        self.assertIn('bIns="198120"', out)

    def test_inset_is_a_noop_for_nonpositive_extra(self):
        seg = shape()
        self.assertEqual(clipfit.inset_segment(seg, 0.0), (seg, 0))
        self.assertEqual(clipfit.inset_segment(seg, -3.0), (seg, 0))
        self.assertEqual(clipfit.inset_segment('', 5.0), ('', 0))

    def test_inset_output_is_parseable(self):
        from xml.etree import ElementTree as ET
        out, n = clipfit.inset_segment(shape(), 12.0)
        self.assertEqual(n, 1)
        ET.fromstring('<root xmlns:a="%s" xmlns:p="%s">%s</root>'
                      % (NS_A, NS_P, out))


class TestPatchScope(unittest.TestCase):
    """The targeted-only contract: everything detection did not name is sacred."""

    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir, True)
        # slide1 renders correctly (not in the plan); slides 2 and 3 do not.
        self.src = package({
            'slide1': slide_doc(shape('Healthy'), shape('Healthy2')),
            'slide2': slide_doc(shape('Broken'), shape('Broken2')),
            'slide3': slide_doc(shape('AlsoBroken')),
        }, extra={
            'ppt/presentation.xml':
                '<p:presentation xmlns:p="%s"><p:sldSz cx="12192000" '
                'cy="6858000"/><p:embeddedFontLst><p:embeddedFont><p:font '
                'typeface="Ara Hamah Homs"/></p:embeddedFont></p:embeddedFontLst>'
                '</p:presentation>' % NS_P,
            'ppt/theme/theme1.xml': '<a:theme xmlns:a="%s"/>' % NS_A,
        })
        self.plan = {'2': [0, 1], '3': [0]}

    def _patch(self, mode, face=None, plan=None, dst=None):
        dst = dst or os.path.join(self.dir, 'out.ppsx')
        if os.path.exists(dst):
            os.remove(dst)
        res = clipfit.patch(self.src, dst, self.plan if plan is None else plan,
                            mode, face)
        return res, dst

    def test_only_planned_slides_change(self):
        res, dst = self._patch('rebind', 'Ara Hamah Homs')
        self.assertTrue(res['ok'], res)
        self.assertEqual(read_part(self.src, 'ppt/slides/slide1.xml'),
                         read_part(dst, 'ppt/slides/slide1.xml'))
        self.assertNotEqual(read_part(self.src, 'ppt/slides/slide2.xml'),
                            read_part(dst, 'ppt/slides/slide2.xml'))

    def test_autofit_scope_is_equally_narrow(self):
        res, dst = self._patch('autofit')
        self.assertTrue(res['ok'], res)
        self.assertEqual(read_part(self.src, 'ppt/slides/slide1.xml'),
                         read_part(dst, 'ppt/slides/slide1.xml'))

    def test_inset_plan_is_a_dict_of_per_shape_extras(self):
        # Inset plans carry how far *each* shape's bottom inset moves, not a
        # flat list - the amount is the measured overflow times the factor.
        res, dst = self._patch('inset', plan={'2': {0: 12.0}})
        self.assertTrue(res['ok'], res)
        self.assertEqual(read_part(self.src, 'ppt/slides/slide1.xml'),
                         read_part(dst, 'ppt/slides/slide1.xml'))
        src2 = read_part(self.src, 'ppt/slides/slide2.xml').decode('utf8')
        body = read_part(dst, 'ppt/slides/slide2.xml').decode('utf8')
        shapes = fitlib.SP.findall(body)
        src_shapes = fitlib.SP.findall(src2)
        self.assertIn('bIns="198120"', shapes[0])
        self.assertEqual(shapes[1], src_shapes[1])

    def test_non_slide_parts_are_untouched(self):
        res, dst = self._patch('rebind', 'Ara Hamah Homs')
        self.assertTrue(res['ok'], res)
        for name in ('ppt/presentation.xml', 'ppt/theme/theme1.xml'):
            self.assertEqual(read_part(self.src, name), read_part(dst, name), name)

    def test_unplanned_shape_in_a_planned_slide_is_untouched(self):
        # slide2 shape 1 is not in the plan; only shape 0 may change.
        res, dst = self._patch('rebind', 'Ara Hamah Homs', plan={'2': [0]})
        self.assertTrue(res['ok'], res)
        body = read_part(dst, 'ppt/slides/slide2.xml').decode('utf8')
        shapes = fitlib.SP.findall(body)
        self.assertEqual(len(shapes), 2)
        self.assertIn('<a:cs typeface="Ara Hamah Homs"/>', shapes[0])
        self.assertIn('<a:cs typeface="Times New Roman"/>', shapes[1])
        self.assertNotIn('Ara Hamah Homs', shapes[1])

    def test_empty_plan_is_rejected(self):
        res, dst = self._patch('autofit', plan={})
        self.assertFalse(res['ok'])
        self.assertIn('no matching shapes', res['error'])
        self.assertFalse(os.path.exists(dst))

    def test_rebind_without_face_is_rejected(self):
        res, dst = self._patch('rebind', None)
        self.assertFalse(res['ok'])
        self.assertIn('requires --face', res['error'])

    def test_unknown_mode_is_rejected(self):
        res, _ = self._patch('shrink-everything')
        self.assertFalse(res['ok'])

    def test_malformed_output_is_refused_and_no_file_left(self):
        # A source whose slide XML does not parse must not be emitted:
        # LibreOffice would render it as a black frame, not an error.
        body = slide_doc(shape()).replace('</a:p>', '</a:p></>')
        src = package({'slide1': body})
        dst = os.path.join(self.dir, 'bad.ppsx')
        res = clipfit.patch(src, dst, {'1': [0]}, 'autofit')
        self.assertFalse(res['ok'])
        self.assertIn('malformed slide XML', res['error'])
        self.assertFalse(os.path.exists(dst))


class TestFaceSelection(unittest.TestCase):
    def _pkg(self, slides=None, pres=None):
        return package(slides or {'slide1': slide_doc()},
                       extra={'ppt/presentation.xml': pres or
                              '<p:presentation xmlns:p="%s"/>' % NS_P})

    def test_no_embedded_font_list_yields_no_candidates(self):
        # Without an embedded face there is nothing guaranteed to exist on the
        # host, so the caller must skip the rebind stage entirely.
        self.assertEqual(clipfit.face_priority(self._pkg()), [])

    def test_embedded_faces_are_returned(self):
        pres = ('<p:presentation xmlns:p="%s"><p:embeddedFontLst>'
                '<p:embeddedFont><p:font typeface="Ara Hamah Homs"/>'
                '</p:embeddedFont><p:embeddedFont><p:font typeface="Tajawal"/>'
                '</p:embeddedFont></p:embeddedFontLst></p:presentation>' % NS_P)
        self.assertEqual(sorted(clipfit.embedded_faces(self._pkg(pres=pres))),
                         ['Ara Hamah Homs', 'Tajawal'])

    def test_most_referenced_face_comes_first(self):
        pres = ('<p:presentation xmlns:p="%s"><p:embeddedFontLst>'
                '<p:embeddedFont><p:font typeface="Ara Hamah Homs"/>'
                '</p:embeddedFont><p:embeddedFont><p:font typeface="Tajawal"/>'
                '</p:embeddedFont></p:embeddedFontLst></p:presentation>' % NS_P)
        slides = {'slide1': slide_doc(shape(cs='Ara Hamah Homs')),
                  'slide2': slide_doc(shape(cs='Ara Hamah Homs')),
                  'slide3': slide_doc(shape(cs='Tajawal'))}
        self.assertEqual(clipfit.face_priority(self._pkg(slides, pres)),
                         ['Ara Hamah Homs', 'Tajawal'])

    def test_faces_not_embedded_are_never_offered(self):
        pres = ('<p:presentation xmlns:p="%s"><p:embeddedFontLst>'
                '<p:embeddedFont><p:font typeface="Tajawal"/>'
                '</p:embeddedFont></p:embeddedFontLst></p:presentation>' % NS_P)
        self.assertEqual(clipfit.face_priority(self._pkg(pres=pres)), ['Tajawal'])


def _page(height=540.0, words=()):
    return {'page': 1, 'width': 960.0, 'height': height,
            'words': [(x0, y0, x1, y1, t) for (x0, y0, x1, y1, t) in words]}


class TestDetectionClassification(unittest.TestCase):
    """Verdict logic, with the PDF layer faked out so the cases are exact."""

    def _detect(self, words, src_text=ARABIC_LINE, frames=None,
                gap_warn=10.0):
        fake = [_page(words=words)]
        frames = frames if frames is not None else {
            1: [(0, 0.0, 0.0, 500.0, 400.0, 3.6, 3.6, 'Box')]}
        with mock.patch.object(clipfit, 'page_words', return_value=fake), \
             mock.patch.object(clipfit, 'text_frames', return_value=frames), \
             mock.patch.object(clipfit, 'slide_texts',
                               return_value={1: {0: src_text}}), \
             mock.patch.object(clipfit, 'face_priority', return_value=[]):
            return clipfit.detect('fake.pdf', 'fake.ppsx', gap_warn)

    def test_text_past_the_page_edge_is_clipped(self):
        r = self._detect([(10, 10, 40, 580.3, 'نص')])
        self.assertEqual(r['clipped'], [1])
        self.assertEqual(r['repair'], [1])
        self.assertEqual(r['slides'][0]['verdict'], 'CLIPPED')
        self.assertEqual(r['slides'][0]['gap'], -40.3)

    def test_dropped_line_is_truncated_even_with_headroom(self):
        # The real slide-5 case: 7.2pt of clearance, and an entire verse line
        # never painted. A gap-only detector ships this bug.
        r = self._detect([(10, 10, 40, 532.8, 'نص')],
                         src_text=ARABIC_LINE + 'ظهرت ف كنيسة الزيتون')
        self.assertEqual(r['slides'][0]['verdict'], 'TRUNCATED')
        self.assertEqual(r['truncated'], [1])
        self.assertEqual(r['repair'], [1])
        self.assertGreater(r['slides'][0]['missing_chars'], 0)

    def test_tight_but_intact_slide_is_at_risk_not_repaired(self):
        r = self._detect([(10, 10, 40, 537.6, 'نص')], src_text='نص')
        self.assertEqual(r['slides'][0]['verdict'], 'AT-RISK')
        self.assertEqual(r['at_risk'], [1])
        self.assertEqual(r['repair'], [])

    def test_comfortable_slide_is_untouched(self):
        r = self._detect([(10, 10, 40, 519.1, 'نص')], src_text='نص')
        self.assertEqual(r['slides'][0]['verdict'], 'ok')
        self.assertEqual(r['repair'], [])
        self.assertEqual(r['shapes'], {})

    def test_dropped_line_falls_back_to_every_text_shape(self):
        # No words remain in the danger band (they were never painted), so
        # attribution must widen to the slide's text shapes rather than patch
        # nothing.
        r = self._detect([(10, 10, 40, 400.0, 'نص')],
                         src_text=ARABIC_LINE + ' disappeared line')
        self.assertEqual(r['slides'][0]['verdict'], 'TRUNCATED')
        self.assertEqual(r['shapes'], {'1': [0]})

    def test_shape_reaching_the_danger_band_is_named(self):
        # Attribution has to follow the box that actually produced the last
        # line, not simply "every shape on the slide".
        frames = {1: [(0, 0.0, 0.0, 500.0, 100.0, 3.6, 3.6, 'Header'),
                      (7, 0.0, 450.0, 500.0, 90.0, 3.6, 3.6, 'Footer')]}
        words = [(10, 10, 40, 40.0, 'top'), (10, 500, 40, 535.0, 'foot')]
        with mock.patch.object(clipfit, 'page_words',
                               return_value=[_page(words=words)]), \
             mock.patch.object(clipfit, 'text_frames', return_value=frames), \
             mock.patch.object(clipfit, 'slide_texts',
                               return_value={1: {0: 'عنوان', 7: ARABIC_LINE}}), \
             mock.patch.object(clipfit, 'face_priority', return_value=[]):
            r = clipfit.detect('fake.pdf', 'fake.ppsx', 10.0)
        self.assertEqual(r['slides'][0]['verdict'], 'TRUNCATED')
        self.assertEqual(r['shapes'], {'1': [7]})

    def test_detect_reports_per_shape_overflow_for_the_inset_stage(self):
        # The inset stage sizes each shape's bump from the box overflow the
        # detector attributes to that exact shape.
        frames = {1: [(0, 0.0, 0.0, 100.0, 80.0, 3.6, 3.6, 'Box')]}
        r = self._detect([(20, 180, 50, 185, 'نص')], frames=frames)
        self.assertEqual(r['shape_ovf']['1'][0]['ovf'], 108.6)
        self.assertEqual(r['shape_ovf']['1'][0]['h'], 80.0)
        self.assertEqual(r['shape_ovf']['1'][0]['box_bottom'], 76.4)
        self.assertEqual(r['shape_ovf']['1'][0]['ink_bottom'], 185.0)

    def test_empty_page_is_reported_not_raised(self):
        r = self._detect([])
        self.assertEqual(r['slides'][0]['verdict'], 'EMPTY')

    def test_unreadable_source_returns_error_not_exception(self):
        # The pipeline runs this inside a conversion; a traceback here would
        # fail a deck that LibreOffice had already rendered fine.
        r = clipfit.detect('nothing.pdf', 'src.ppsx')
        self.assertFalse(r['ok'])
        self.assertTrue(r['error'])

    def test_pdftotext_producing_no_pages_returns_error(self):
        with mock.patch.object(clipfit, 'text_frames', return_value={}), \
             mock.patch.object(clipfit, 'slide_texts', return_value={}), \
             mock.patch.object(clipfit, 'page_words', return_value=[]):
            r = clipfit.detect('nothing.pdf', 'src.ppsx')
        self.assertFalse(r['ok'])
        self.assertIn('pdftotext', r['error'])


class TestCliContract(unittest.TestCase):
    """The pipeline talks to this file over stdout, so the shape of the reply
    matters as much as the values."""

    def test_patch_rejects_missing_arguments_as_json(self):
        import io
        from contextlib import redirect_stdout
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = clipfit.main(['clipfit.py', 'patch', 'a', 'b', 'nope.json'])
        self.assertEqual(rc, 1)
        self.assertIn('"ok": false', buf.getvalue())

    def test_unknown_command_exits_nonzero(self):
        import io
        from contextlib import redirect_stdout
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = clipfit.main(['clipfit.py', 'frobnicate'])
        self.assertEqual(rc, 2)

    def test_plan_json_accepts_string_keys(self):
        # JSON object keys are always strings; the slide numbers in a plan come
        # back as '2', not 2.
        fd, path = tempfile.mkstemp(suffix='.json')
        os.close(fd)
        with open(path, 'w', encoding='utf8') as f:
            json.dump({'2': [0]}, f)
        with open(path, encoding='utf-8-sig') as f:
            plan = json.load(f)
        os.remove(path)
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, True)
        src = package({'slide1': slide_doc(shape()),
                       'slide2': slide_doc(shape())})
        dst = os.path.join(d, 'out.ppsx')
        res = clipfit.patch(src, dst, plan, 'autofit')
        self.assertTrue(res['ok'], res)
        self.assertEqual(res['slides'], {2: 1})


if __name__ == '__main__':
    unittest.main(verbosity=2)