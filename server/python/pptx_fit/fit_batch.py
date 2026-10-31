#!/usr/bin/env python3
"""CLI: fit one deck and render every slide to WebP. Prints a JSON result line."""
import json
import os
import shutil
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fitlib


def main():
    src, workdir = sys.argv[1], sys.argv[2]
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 1600
    cs = sys.argv[4] if len(sys.argv) > 4 else 'Tajawal'
    t0 = time.time()
    os.makedirs(workdir, exist_ok=True)
    tag = os.path.basename(src).split('.')[0][:24].replace(' ', '_') or 'deck'
    # 8 not 6: the box-resize step needs a couple of extra rounds to be measured
    # as fitting, and fit() returns as soon as a deck is clean, so the extra
    # rounds only cost time on decks that are genuinely hard.
    r = fitlib.fit(src, workdir, tag, cs=cs, max_rounds=8)
    if 'error' in r:
        print(json.dumps({'ok': False, 'error': r['error']}))
        return
    imgdir = os.path.join(workdir, 'webp')
    shutil.rmtree(imgdir, ignore_errors=True)
    pages = fitlib.render_all(r['pdf'], imgdir, width=width)
    # A frame that carries no picture must never be published as a preview, so
    # the deck is reported as failed instead of quietly shipping a black slide.
    issues = fitlib.scan_rendered(imgdir) if pages else []
    print(json.dumps({
        'ok': pages > 0 and not issues,
        'pages': pages,
        'rounds': r['rounds'],
        'overflow': r['overflow'],
        'scaled_shapes': sum(len(v) for v in r['factors'].values()),
        'grown_shapes': sum(len(v) for v in r.get('grow', {}).values()),
        'render_issues': [{'page': p, 'reason': why} for p, why in issues],
        'imgdir': imgdir,
        'secs': round(time.time() - t0, 1),
    }))
    # The workdir is intentionally left in place: the caller still has to read the
    # rendered WebP files out of it, and it owns the cleanup.


if __name__ == '__main__':
    main()
