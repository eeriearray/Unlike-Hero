#!/usr/bin/env python3
"""Import the user-supplied Task 4 ZIP without running any archive contents.
Usage: python3 tools/import-hollow-task4.py /path/to/production_assets.zip [delivery-manifest.json]
"""
import hashlib, json, re, shutil, subprocess, sys, tempfile, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'games/the-hollow'
ART = GAME / 'art'
archive = Path(sys.argv[1]).resolve()
delivery_path = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else None
delivery = json.loads(delivery_path.read_text()) if delivery_path else None
source_rows = {}
if delivery:
    with zipfile.ZipFile(archive) as z:
        rows = delivery.get('assets', [])
        if len(rows) != delivery.get('totalFiles') or len(rows) != len(z.namelist()):
            raise ValueError('Delivery manifest file count mismatch')
        for row in rows:
            name = row['path']
            if name in source_rows: raise ValueError('Duplicate delivery path: ' + name)
            if hashlib.sha256(z.read(name)).hexdigest() != row['sha256']:
                raise ValueError('Delivery hash mismatch: ' + name)
            source_rows[name] = row

manifest = json.loads((ART / 'manifest.json').read_text())
pack = 'the_hollow_task4'
manifest['assets'] = {aid: entry for aid, entry in manifest['assets'].items() if entry.get('pack') != pack}

def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')

def asset_id(name):
    return 'task4_' + re.sub(r'[^a-z0-9]+', '_', str(Path(name).with_suffix('')).lower()).strip('_')

# SVG markup is data: reject active content and external references before deriving
# a local glyph catalogue. Only these small drawing primitives are accepted.
def safe_icon(data):
    root = ET.fromstring(data)
    allowed_tags = {'svg', 'g', 'path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse', 'line'}
    allowed_attrs = {'xmlns','viewBox','width','height','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','opacity','d','points','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','transform','fill-rule','stroke-dasharray'}
    def clean(el):
        tag = el.tag.split('}')[-1]
        if tag not in allowed_tags: raise ValueError('Unexpected SVG element: ' + tag)
        el.tag = tag
        for attr, val in el.attrib.items():
            if attr not in allowed_attrs or re.search(r'url\s*\(|javascript:|https?:|data:', val, re.I):
                raise ValueError('Unexpected SVG attribute: ' + attr)
        for child in el: clean(child)
    clean(root)
    if root.attrib.get('viewBox') != '0 0 128 128': raise ValueError('Unexpected icon viewBox')
    return ''.join(ET.tostring(child, encoding='unicode') for child in root)

report = {'archive': archive.name, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'files': [], 'audio': {}, 'deferred': []}
icons = {}
if delivery:
    report['deliveryManifest'] = {'file': 'task4-delivery-manifest.json', 'sha256': hashlib.sha256(delivery_path.read_bytes()).hexdigest(), 'version': delivery.get('version'), 'verifiedFiles': len(source_rows)}
with tempfile.TemporaryDirectory(prefix='hollow-task4-') as folder:
    temp = Path(folder).resolve()
    with zipfile.ZipFile(archive) as z:
        if sum(i.file_size for i in z.infolist()) > 100_000_000: raise ValueError('Archive too large')
        for info in z.infolist():
            dest = (temp / info.filename).resolve()
            if not dest.is_relative_to(temp) or (info.external_attr >> 16 & 0o170000) == 0o120000:
                raise ValueError('Unsafe ZIP member')
        z.extractall(temp)
    generated = temp / 'prepared'
    generated.mkdir(exist_ok=True)
    for p in sorted(temp.rglob('*')):
        if not p.is_file(): continue
        rel = p.relative_to(temp)
        if len(rel.parts) < 2: continue # Contact sheets are review material, not runtime art.
        if rel.parts[0] == 'icons' and p.suffix == '.svg':
            icons['/'.join(rel.with_suffix('').parts[1:])] = safe_icon(p.read_text())
            continue
        if p.suffix not in {'.png', '.wav'}: continue
        aid = asset_id(rel)
        meta = {'sourceSha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'pack': pack, 'source': str(rel), 'regions': ['shared'], 'pixel': False}
        if p.suffix == '.png':
            with Image.open(p) as im:
                im.load()
                if im.mode != 'RGBA': raise ValueError('Expected RGBA: ' + str(rel))
                target = generated / (aid + '.webp')
                # Painted detail masters compress as high-quality WebP; small UI/item
                # variants and transparent effects remain lossless.
                detail = rel.parts[0] == 'items' and im.width >= 1024
                if detail:
                    im.save(target, 'WEBP', quality=92, method=6, exact=True)
                else:
                    im.save(target, 'WEBP', lossless=True, method=6)
                meta['encoding'] = 'webp-q92-alpha-lossless' if detail else 'webp-lossless'
                meta.update(type='image', width=im.width, height=im.height, alpha=list(im.getchannel('A').getextrema()))
        else:
            import wave, math, struct
            with wave.open(str(p)) as wav:
                if wav.getframerate() != 48000 or wav.getsampwidth() != 2: raise ValueError('Unexpected audio format')
                channels, frames = wav.getnchannels(), wav.getnframes()
                values = struct.unpack('<' + 'h' * frames * channels, wav.readframes(frames))
                peak = max(abs(v) for v in values) / 32768
                if peak >= 1: raise ValueError('Clipping: ' + str(rel))
                report['audio'][str(rel)] = {'seconds': frames / 48000, 'channels': channels, 'sampleRate': 48000, 'sourcePeakDb': round(20 * math.log10(peak), 2)}
            target = generated / (aid + '.ogg')
            subprocess.run(['ffmpeg','-v','error','-y','-i',str(p),'-af','volume=0.85','-c:a','libopus','-b:a','96k','-vbr','on',str(target)],check=True)
            meta.update(type='audio', seconds=frames / 48000, channels=channels, loop=p.stem=='dark_well_ambience')
        meta.update(file='art/generated/' + target.name, bytes=target.stat().st_size, sha256=hashlib.sha256(target.read_bytes()).hexdigest())
        manifest['assets'][aid] = meta
        report['files'].append(aid)

    # Keep the central allowlist, byte accounting and region groups consistent.
    manifest['regions'] = {}
    for aid, entry in manifest['assets'].items():
        for region in entry['regions']: manifest['regions'].setdefault(region, []).append(aid)
    manifest['totalBytes'] = sum(e['bytes'] for e in manifest['assets'].values())
    manifest['packs'] = [p for p in manifest['packs'] if p['id'] != pack]
    manifest['packs'].append({'id': pack, 'source': archive.name, 'author': 'User-supplied Gemini/Argon output', 'license': 'User-supplied generated assets; source delivery retained by user', 'status': 'local-only', 'included': len(report['files'])})
    if manifest['totalBytes'] > manifest['maxBytes'] - 100_000: raise ValueError('Asset budget exceeded: ' + str(manifest['totalBytes']))
    for aid in report['files']:
        name = Path(manifest['assets'][aid]['file']).name
        shutil.copyfile(generated / name, ART / 'generated' / name)
    if delivery:
        shutil.copyfile(delivery_path, ART / 'task4-delivery-manifest.json')
    write_json(ART / 'manifest.json', manifest)
    write_json(ART / 'task4-import-report.json', report)
    write_json(ART / 'task4-icons.json', icons)
# Generated code contains only JSON-encoded, validated drawing data.
(GAME / 'js/task4-icons.js').write_text('/* Validated drawing primitives from the user-supplied Task 4 icon set. */\nwindow.HollowGlyphs = ' + json.dumps(icons, indent=2) + ';\n')
print(f"Imported {len(report['files'])} runtime media files and {len(icons)} validated vector symbols; total asset payload {manifest['totalBytes']:,} bytes.")
