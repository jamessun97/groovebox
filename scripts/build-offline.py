"""Build a self-contained HTML from the source modules without dependencies."""
from pathlib import Path
from urllib.parse import quote
import re
import sys

root = Path(__file__).resolve().parent.parent
assets = root / 'dist'
destination = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'Groovebox.html'
html = (assets / 'index.html').read_text(encoding='utf-8')
css = re.sub(r'@import[^;]+;', '', (assets / 'style.css').read_text(encoding='utf-8'))
modules = ['project.js', 'audio.js', 'storage.js', 'app.js', 'stage3.js', 'stage4.js']
code = '\n'.join(re.sub(r'^import .*\n', '', (assets / name).read_text(encoding='utf-8'), flags=re.M).replace('export ', '') for name in modules)
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>' + css + '</style>')
html = html.replace('href="favicon.svg"', 'href="data:image/svg+xml,' + quote((assets / 'favicon.svg').read_text(encoding='utf-8'), safe='') + '"')
html = html.replace('<script type="module" src="stage4.js"></script>', '<script type="module">\n' + code + '\n</script>')
html = html.replace('href="./" aria-label="Groovebox 首页"', 'href="#" aria-label="Groovebox 首页"')
destination.write_text(html, encoding='utf-8')
print(destination)
