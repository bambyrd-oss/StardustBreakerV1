#!/usr/bin/env python3
"""
FATBACK build.

    python3 src/build.py

Packs art/ into a single spritesheet, inlines it as base64 into src/game.html,
and writes index.html at the repo root.

The whole game ships as one file. No bundler, no node_modules, no server —
the spritesheet is baked in as a data URI, so index.html runs from a file://
double-click, off a USB stick, or off GitHub Pages, identically.

    python3 src/build.py --no-inline

writes index.html that loads src/atlas.png over the network instead. Smaller
HTML, but then it needs a server. The inlined default is the one you want.
"""
import base64, json, os, sys, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')

def main():
    inline = '--no-inline' not in sys.argv

    # 1. pack art/ -> src/atlas.png + src/atlas.json
    print('packing spritesheet...')
    subprocess.check_call([sys.executable, os.path.join(SRC, 'pack.py')])

    idx = open(os.path.join(SRC, 'atlas.json')).read().strip()
    tpl = open(os.path.join(SRC, 'game.html')).read()

    if '__ATLAS__' not in tpl or '__INDEX__' not in tpl:
        sys.exit('src/game.html is missing the __ATLAS__ / __INDEX__ placeholders')

    if inline:
        raw = open(os.path.join(SRC, 'atlas.png'), 'rb').read()
        atlas = base64.b64encode(raw).decode()
    else:
        atlas = ''
        tpl = tpl.replace('sheet.src="data:image/png;base64,"+ATLAS_B64;',
                          'sheet.src="src/atlas.png";')

    out = tpl.replace('__ATLAS__', atlas).replace('__INDEX__', idx)
    dst = os.path.join(ROOT, 'index.html')
    open(dst, 'w').write(out)

    kb = len(out) / 1024
    print(f'wrote index.html  {kb:.0f} KB  ({len(json.loads(idx))} frames'
          f'{", atlas inlined" if inline else ", atlas external"})')

    # 2. don't ship it without running it
    print('running harness...')
    r = subprocess.call(['node', os.path.join(SRC, 'harness.js'), dst])
    if r != 0:
        sys.exit('\nBUILD FAILED — harness caught something. index.html was still written; '
                 'fix the error above before pushing.')
    print('\nbuild ok.')

if __name__ == '__main__':
    main()
