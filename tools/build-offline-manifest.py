# coding: utf-8
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1];entries=[]
# Keep the script payload in sync so file:// pages never need fetch().
(root/'about-content.js').write_text('// Local-file compatible About Eric document.\nglobalThis.ERIC_ABOUT_DOCUMENT = '+json.dumps((root/'about.html').read_text(),ensure_ascii=False)+';\n')
for p in sorted(root.rglob('*')):
 if not p.is_file() or 'tools' in p.relative_to(root).parts or p.name.startswith('.') or p.name in ['offline-manifest.json','使用说明.txt']:continue
 rel=p.relative_to(root).as_posix()
 if rel.startswith('vendor/pdf-') or rel.startswith('vendor/fontkit') or rel.startswith('print-assets/'):group='print'
 elif rel.startswith('word-audio/'):group='word'
 elif rel.startswith('course-media/'):group='course'
 elif rel.startswith('cards/'):group='visual'
 elif rel.endswith(('.png','.jpg','.jpeg','.webp','.svg','.gif','.avif','.glb')):group='visual'
 else:group='core'
 data=p.read_bytes();entries.append({'path':rel,'group':group,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
version=hashlib.sha256(json.dumps(entries,sort_keys=True,separators=(',',':')).encode()).hexdigest()[:20]
manifest={'schema':1,'version':version,'release':'2026-11-27 · 关于Eric本地加载修复','files':entries}
(root/'offline-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')))
for g in ['core','visual','word','course','print']:
 subset=[e for e in entries if e['group']==g];print(g,len(subset),round(sum(e['bytes'] for e in subset)/1024/1024,2),'MB')
