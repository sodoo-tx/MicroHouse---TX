#!/usr/bin/env python3
"""Build index.html from the files in src/.

Usage:
    python3 tools/build.py            # readable build
    python3 tools/build.py --minify   # smaller build, needs Node.js (npx terser)
"""
import pathlib, subprocess, sys

root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'src'
parts = ['01-data-geometry-costs.js', '02-auto-arrange-layouts.js', '03-plan-drawing.js', '04-ui-3d-site.js']
js = ''.join((src / p).read_text(encoding='utf-8') for p in parts)

if '--minify' in sys.argv:
    tmp = root / 'tools' / '_app.js'
    tmp.write_text(js, encoding='utf-8')
    out = subprocess.run(['npx', '--yes', 'terser@5.31.0', str(tmp), '-c', 'passes=2', '-m', '--ecma', '2020'],
                         capture_output=True, text=True, check=True)
    js = out.stdout
    tmp.unlink()

html = (src / 'template.html').read_text(encoding='utf-8')
html = html.replace('/*__APP__*/', js).replace('/*__THUMBS__*/null', (src / 'layouts.json').read_text(encoding='utf-8'))
(root / 'index.html').write_text(html, encoding='utf-8')
print(f'Wrote index.html ({len(html) // 1024} KB)')
