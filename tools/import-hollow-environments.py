#!/usr/bin/env python3
"""Install Task 1/2 delivered artwork, preserving other packs and all original files.
Usage: python3 tools/import-hollow-environments.py TASK1.zip TASK2.zip [TASK2-manifest.json]
"""
import hashlib, json, re, sys, tempfile, zipfile
from io import BytesIO
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'games/the-hollow'
ART = GAME / 'art'
manifest = json.loads((ART / 'manifest.json').read_text())
index = json.loads((ART / 'scenes/index.json').read_text())
configs = {key: json.loads((GAME / value['file']).read_text()) for key, value in index['places'].items()}
old_report = json.loads((ART / 'environment-import-report.json').read_text()) if (ART / 'environment-import-report.json').exists() else {}
report = {'deliveries': {}, 'scenes': {}, 'supplemental': {}, 'retiredEntries': old_report.get('retiredEntries', {}), 'notes': []}
replaced = {c['background'] for c in configs.values()}
chapter_file = GAME / 'js/chapter-art.js'
chapter = json.loads(chapter_file.read_text().split('window.HollowChapterArt = ')[1].strip().removesuffix(';'))
replaced.update([chapter['title'], *chapter['endings'].values()])
# Reimport updates these deliveries only. Other supplied artwork remains installed.
manifest['assets'] = {key: value for key, value in manifest['assets'].items() if value.get('pack') not in {'the_hollow_task1', 'the_hollow_task2'}}

def write_json(path, value): path.write_text(json.dumps(value, indent=2) + '\n')
def aid(task, name): return task + '_' + re.sub(r'[^a-z0-9]+', '_', str(Path(name).with_suffix('')).lower()).strip('_')

archive_files = [Path(x).resolve() for x in sys.argv[1:3]]
if len(archive_files) != 2: raise SystemExit(__doc__)
with tempfile.TemporaryDirectory(prefix='hollow-environments-') as folder:
    staging = Path(folder).resolve()
    for task, archive in zip(['task1', 'task2'], archive_files):
        pack = 'the_hollow_' + task
        delivery = {'archive': archive.name, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'images': [], 'nativeEnvironmentSize': [1376,768], 'nativeCloseupSize': [1152,896] if task == 'task1' else None}
        with zipfile.ZipFile(archive) as z:
            if sum(i.file_size for i in z.infolist()) > 500_000_000: raise ValueError('Archive too large')
            for info in z.infolist():
                target = (staging / task / info.filename).resolve()
                if not target.is_relative_to(staging / task) or (info.external_attr >> 16 & 0o170000) == 0o120000: raise ValueError('Unsafe ZIP member')
                rel = Path(info.filename)
                if info.filename.endswith(('.md','.json')):
                    target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(z.read(info))
                if rel.suffix != '.webp' or rel.parts[0] == 'style': continue
                if rel.parts[0] not in {'environments', 'closeups', 'chapter', 'endings'}: raise ValueError('Unexpected image path')
                data = z.read(info)
                with Image.open(BytesIO(data)) as im:
                    im.load(); size = list(im.size)
                    expected = [1600,1200] if rel.parts[0] == 'closeups' else [2560,1440]
                    if size != expected: raise ValueError('Unexpected dimensions: ' + str(rel))
                key = aid(task, rel)
                output = ART / 'generated' / (key + '.webp')
                output.write_bytes(data) # Preserve the delivered WebP; no further resize/recompression.
                region = rel.parts[1] if rel.parts[0] == 'environments' and rel.parts[1] != 'opening' else 'shared'
                entry = {'file': str(output.relative_to(GAME)), 'type': 'image', 'bytes': len(data), 'pack': pack, 'source': str(rel), 'regions': [region], 'pixel': False, 'width': size[0], 'height': size[1], 'nativeDimensions': [1152,896] if rel.parts[0]=='closeups' else [1376,768], 'upscaledBySupplier': True}
                manifest['assets'][key] = entry
                delivery['images'].append(key)
                if rel.parts[0] == 'environments' and rel.parts[1] != 'opening':
                    if rel.stem not in configs or configs[rel.stem]['region'] != region: raise ValueError('Location/region mismatch')
                    configs[rel.stem]['background'] = key
                    configs[rel.stem]['artDirection'] = 'supplied'
                    configs[rel.stem]['moods'] = {} # Do not switch back to unrelated legacy artwork at later phases.
                    index['places'][rel.stem]['background'] = key
                    report['scenes'][rel.stem] = key
                else: report['supplemental'][rel.stem] = key
        report['deliveries'][task] = delivery
        manifest['packs'] = [p for p in manifest['packs'] if p['id'] != pack]
        manifest['packs'].append({'id': pack, 'source': archive.name, 'author': 'User-supplied Gemini/Argon output', 'license': 'User-supplied generated delivery', 'status': 'local-only', 'included': len(delivery['images'])})
        if task == 'task1':
            guide = staging / task / 'style/style_guide_and_manifest.md'
            if guide.exists(): (ART / 'task1-delivery-style-guide.md').write_text(guide.read_text())
        if task == 'task2':
            supplied_manifest = json.loads((staging / task / 'manifest.json').read_text())
            if len(supplied_manifest.get('files', [])) != 35: raise ValueError('Task 2 manifest count mismatch')
            for file in supplied_manifest['files']:
                key = aid(task, file['relative_webp_path'])
                if key not in manifest['assets']: raise ValueError('Declared artwork missing: ' + key)
            write_json(ART / 'task2-delivery-manifest.json', supplied_manifest)
            if len(sys.argv) > 3:
                extra = json.loads(Path(sys.argv[3]).read_text())
                report['externalManifestMatchesArchive'] = extra == supplied_manifest

if len(report['scenes']) != 42: raise ValueError('Both deliveries must cover all 42 locations')

# Explicit image-to-interaction links: no invented caretaking actions or locations.
links = {
 'square': {'board': 'notice_board_closeup', 'well': 'well_closeup', 'tower': 'tower_entrance_closeup'},
 'belltower': {'frame': 'bell_frame_closeup', 'listen': 'hanging_rope_closeup', 'climb': 'belfry_interior'}
}
for place, objects in links.items():
    for h in configs[place]['hotspots']:
        if h['id'] in objects: h['closeup'] = report['supplemental'][objects[h['id']]]

chapter['title'] = report['supplemental']['chapter_one']
chapter['endings'] = {key: report['supplemental']['ending_' + key] for key in chapter['endings']}
# Deregister superseded stand-ins only. Keep their bytes on disk and metadata in
# the report for recovery, leaving room for the pending character delivery.
active = {c['background'] for c in configs.values()} | {chapter['title'], *chapter['endings'].values()}
for key in sorted(replaced - active):
    entry = manifest['assets'].get(key)
    if entry and entry.get('type') == 'image' and entry.get('pack') not in {'the_hollow_task1', 'the_hollow_task2'}:
        report['retiredEntries'][key] = manifest['assets'].pop(key)
manifest['regions'] = {}
for key, entry in manifest['assets'].items():
    for region in entry['regions']: manifest['regions'].setdefault(region, []).append(key)
for pack in manifest['packs']: pack['included'] = sum(e.get('pack') == pack['id'] for e in manifest['assets'].values())
manifest['totalBytes'] = sum(e['bytes'] for e in manifest['assets'].values())
if manifest['totalBytes'] + len(json.dumps(manifest,indent=2).encode()) >= manifest['maxBytes']: raise ValueError('Runtime asset budget exceeded')
report['runtimeBytes'] = manifest['totalBytes']
report['notes'] = ['Task 1/2 image resolutions were verified; original native sizes and supplier upscaling disclosure are recorded.', 'Caretaker room and blank note are prepared for review, but no new gameplay or lore is invented to force their use.', 'Task 3 remains pending; defer the final consolidated gap list.']
write_json(ART / 'manifest.json', manifest)
write_json(ART / 'scenes/index.json', index)
for key, cfg in configs.items(): write_json(ART / 'scenes' / (key+'.json'), cfg)
chapter_file.write_text('/* Supplied Task 2 chapter and ending illustrations. */\nwindow.HollowChapterArt = ' + json.dumps(chapter,indent=2) + ';\n')
write_json(ART / 'environment-import-report.json', report)
print(f"Installed {len(report['scenes'])} location backgrounds and {len(report['supplemental'])} supporting images. Runtime media: {manifest['totalBytes']:,} bytes. Retired {len(report['retiredEntries'])} superseded stand-ins from the registry; original files retained.")
