"""Regression tests for the fitter's XML rewriting and output guards.

Run with:  python3 -m unittest test_fitlib -v

The cases that matter most are in TestInjectCs. inject_cs once closed a
self-closing <a:rPr/> with `</>`, which is not valid XML. LibreOffice does not
report that as an error, it just renders the slide as a black frame - 160 of
them across 51 decks, published as if they were fine. Nothing else in the
pipeline would have caught it, so these cases stay pinned here.
"""
import os
import sys
import tempfile
import unittest
import zipfile
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fitlib

NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'


def wraps(fragment, text='\u0627\u0644\u0643\u0644\u0645'):
    """Puts a run-property fragment inside a minimal, parseable slide document.

    The text is Arabic because inject_cs deliberately only rewrites runs whose
    text is Arabic; a Latin run is left untouched."""
    return ('<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
            'xmlns:a="%s"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r>'
            '%s<a:t>%s</a:t></a:r></a:p></p:txBody></p:sp>'
            '</p:spTree></p:cSld></p:sld>') % (NS, fragment, text)


class TestInjectCs(unittest.TestCase):
    def assert_parses(self, xml):
        ET.fromstring(xml)  # raises ParseError on malformed output

    def test_self_closing_rpr_stays_valid(self):
        # The exact pattern that produced the black frames.
        out = fitlib.inject_cs(wraps('<a:rPr lang="ar-EG" sz="2400"/>'), 'Tajawal')
        self.assert_parses(out)
        self.assertIn('<a:cs typeface="Tajawal"/>', out)
        self.assertNotIn('</>', out)
        self.assertIn('</a:rPr>', out)

    def test_self_closing_rpr_with_attributes(self):
        out = fitlib.inject_cs(
            wraps('<a:rPr lang="ar-EG" sz="2400" b="1" dirty="0"/>'), 'Tajawal')
        self.assert_parses(out)
        self.assertIn('b="1"', out)

    def test_rpr_with_existing_children(self):
        out = fitlib.inject_cs(
            wraps('<a:rPr lang="ar-EG"><a:latin typeface="Arial"/></a:rPr>'), 'Tajawal')
        self.assert_parses(out)
        self.assertIn('<a:latin typeface="Arial"/>', out)
        self.assertIn('<a:cs typeface="Tajawal"/>', out)

    def test_existing_cs_is_rewritten_not_duplicated(self):
        out = fitlib.inject_cs(
            wraps('<a:rPr lang="ar-EG"><a:cs typeface="Courier"/></a:rPr>'), 'Tajawal')
        self.assert_parses(out)
        self.assertIn('<a:cs typeface="Tajawal"/>', out)
        self.assertNotIn('Courier', out)
        self.assertEqual(out.count('<a:cs '), 1)

    def test_non_arabic_run_is_left_alone(self):
        src = wraps('<a:rPr lang="en-US" sz="2400"/>', text='Amen')
        self.assertEqual(fitlib.inject_cs(src, 'Tajawal'), src)

    def test_multiple_runs_all_valid(self):
        out = fitlib.inject_cs(
            wraps('<a:rPr sz="2400"/><a:rPr sz="1800"><a:latin typeface="A"/></a:rPr>'
                  '<a:rPr sz="900"><a:cs typeface="B"/></a:rPr>'),
            'Tajawal')
        self.assert_parses(out)
        self.assertEqual(out.count('<a:cs typeface="Tajawal"/>'), 3)
        self.assertNotIn('</>', out)


class TestValidateSlides(unittest.TestCase):
    def _pptx(self, slides):
        fd, path = tempfile.mkstemp(suffix='.pptx')
        os.close(fd)
        with zipfile.ZipFile(path, 'w') as z:
            for n, body in slides.items():
                z.writestr('ppt/slides/%s.xml' % n, body)
        self.addCleanup(os.remove, path)
        return path

    def test_clean_archive_reports_nothing(self):
        p = self._pptx({'slide1': wraps('<a:rPr sz="100"/>'),
                        'slide2': wraps('<a:rPr><a:latin typeface="A"/></a:rPr>')})
        self.assertEqual(fitlib.validate_slides(p), [])

    def test_corrupted_slide_is_caught(self):
        p = self._pptx({'slide1': wraps('<a:rPr sz="100"/>'),
                        'slide2': wraps('<a:rPr sz="100"><a:cs typeface="X"/></>')})
        bad = fitlib.validate_slides(p)
        self.assertEqual(len(bad), 1)
        self.assertTrue(bad[0].startswith('slide2.xml:'))

    def test_ignores_non_slide_parts(self):
        p = self._pptx({'slide1': wraps('<a:rPr sz="100"/>')})
        with zipfile.ZipFile(p, 'a') as z:
            z.writestr('ppt/slideLayouts/slideLayout1.xml', '<broken')
        self.assertEqual(fitlib.validate_slides(p), [])


class TestScanRendered(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.dir, ignore_errors=True)

    def _webp(self, name, colour, size=(1600, 900)):
        from PIL import Image
        Image.new('RGB', size, colour).save(os.path.join(self.dir, name), 'WEBP')

    def test_black_frame_is_flagged(self):
        self._webp('1.webp', (0, 0, 0))
        self._webp('2.webp', (250, 250, 250))
        issues = fitlib.scan_rendered(self.dir)
        self.assertEqual([p for p, _ in issues], [1])
        self.assertIn('black/blank frame', issues[0][1])

    def test_content_frame_passes(self):
        self._webp('1.webp', (120, 90, 60))
        self._webp('2.webp', (30, 90, 200))
        self.assertEqual(fitlib.scan_rendered(self.dir), [])

    def test_empty_dir_is_clean(self):
        self.assertEqual(fitlib.scan_rendered(self.dir), [])

    def test_non_numeric_names_are_ignored(self):
        # render_all writes {n}.webp; anything else is not ours to judge.
        self._webp('cover.webp', (0, 0, 0))
        self.assertEqual(fitlib.scan_rendered(self.dir), [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
