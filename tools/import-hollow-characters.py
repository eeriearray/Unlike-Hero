#!/usr/bin/env python3
"""Validate and import a partial or complete Task 3 character delivery.
Usage: python3 tools/import-hollow-characters.py TASK3.zip
Original masters stay in the source archive. Runtime derivatives load on demand.
"""
import hashlib, json, sys, zipfile
from io import BytesIO
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'games/the-hollow/art'
HEROES = {'occultist','hunter','apothecary','medium','exorcist','vagabond'}
ENEMIES = {'bellkeeper','abbey_warden','whisperling','drowned_pilgrim','hollow_stag','grave_warden','mirror_twin','carrion_swarm','hollow_hound','weeping_statue'}
NPCS = {'merchant_pell','tower_caretaker','village_survivor','abbey_spirit'}
def save(path, data): path.write_text(json.dumps(data, indent=2) + '\n')
archive = Path(sys.argv[1]); pack = 'the_hollow_task3'
m = json.loads((ART/'manifest.json').read_text())
entries = {}; prepared = {}; docs = {}; mappings = {'version':1,'heroes':{},'enemies':{},'npcs':{}}
report = {'archive':archive.name,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'images':{},'notes':['Native generation dimensions are not disclosed.','Silhouettes are opaque reference previews; not used as transparent cutouts.','Runtime copies are resized with Lanczos; original PNG masters remain in the source ZIP.']}
with zipfile.ZipFile(archive) as z:
    if sum(i.file_size for i in z.infolist()) > 100_000_000: raise ValueError('Archive exceeds size limit')
    for info in z.infolist():
        p = Path(info.filename)
        if p.is_absolute() or '..' in p.parts or (info.external_attr >> 16 & 0o170000) == 0o120000: raise ValueError('Unsafe archive member')
        if info.is_dir(): continue
        if info.filename == 'characters/the_hollow_task3_character_manifest.md':
            docs['task3-delivery-manifest.md'] = z.read(info); continue
        if p.suffix != '.png': continue
        if len(p.parts) == 2 and p.name in ('cast_contact_sheet.png','silhouette_comparison_sheet.png'): continue
        if len(p.parts) == 3 and p.parts[:2] == ('characters','npcs'):
            who = p.stem.removeprefix('npc_'); group = 'npcs'; variant = 'portrait'
            if who not in NPCS: raise ValueError('Unknown NPC')
        elif len(p.parts) == 4 and p.parts[0] == 'characters' and p.parts[1] in ('playable','enemies'):
            kind,who = p.parts[1:3];group = 'heroes' if kind == 'playable' else 'enemies'
            if who not in (HEROES if group == 'heroes' else ENEMIES): raise ValueError('Unknown character')
            if not p.stem.startswith(who+'_'): raise ValueError('Mismatched character filename')
            variant = p.stem.removeprefix(who+'_')
        else: raise ValueError('Unexpected artwork path: '+str(p))
        if variant not in ('fullbody','portrait','silhouette'): raise ValueError('Unexpected variant')
        raw = z.read(info)
        with Image.open(BytesIO(raw)) as im:
            im.load(); dimensions = list(im.size)
            wide = who in ('carrion_swarm','hollow_hound')
            expected = {'fullbody':[2400,1800] if wide else [1600,2400],'portrait':[1024,1280],'silhouette':[600,450] if wide else [400,600]}[variant]
            if dimensions != expected: raise ValueError('Unexpected dimensions: '+str(p))
            transparent = im.mode == 'RGBA' and im.getextrema()[-1][0] < 255
            if variant == 'fullbody' and not transparent: raise ValueError('Full figure requires alpha')
            alpha_bbox = list(im.getchannel('A').getbbox()) if transparent else None
            if variant == 'fullbody': im.thumbnail((1200,900) if wide else (800,1200),Image.Resampling.LANCZOS)
            elif variant == 'portrait': im.thumbnail((384,480),Image.Resampling.LANCZOS)
            runtime = list(im.size)
            out = BytesIO(); im.save(out,'WEBP',lossless=variant == 'silhouette',quality=88,method=6)
        aid = 'task3_' + ('npc_' if group == 'npcs' else '') + who + '_' + variant
        if aid in entries: raise ValueError('Duplicate character asset')
        filename = aid+'.webp';prepared[filename] = out.getvalue()
        entry = {'file':'art/generated/'+filename,'type':'image','bytes':len(out.getvalue()),'pack':pack,'source':info.filename,'regions':['shared'],'pixel':False,'width':runtime[0],'height':runtime[1],'sourceDimensions':dimensions,'transparent':transparent,'encoding':'lossless WebP' if variant == 'silhouette' else 'WebP quality 88'}
        entries[aid] = entry;mappings[group].setdefault(who,{})[variant] = aid
        report['images'][aid] = {'source':info.filename,'sourceSha256':hashlib.sha256(raw).hexdigest(),'dimensions':dimensions,'runtimeDimensions':runtime,'transparent':transparent,'alphaBounds':alpha_bbox,'encoding':entry['encoding']}
for group in ('heroes','enemies'):
    for who,variants in mappings[group].items():
        if set(variants) != {'portrait','fullbody','silhouette'}: raise ValueError('Incomplete character set: '+who)
if not entries: raise ValueError('No character artwork')
m['assets'] = {k:v for k,v in m['assets'].items() if v.get('pack') != pack};m['assets'].update(entries)
m['totalBytes'] = sum(v['bytes'] for v in m['assets'].values());m['regions'] = {}
for k,v in m['assets'].items():
    for region in v['regions']: m['regions'].setdefault(region,[]).append(k)
m['packs'] = [p for p in m['packs'] if p['id'] != pack] + [{'id':pack,'source':archive.name,'author':'User-supplied generated output','license':'User-supplied generated delivery','status':'local-only','included':len(entries)}]
if m['totalBytes'] + len(json.dumps(m,indent=2).encode()) >= 40_000_000: raise ValueError('Media budget exceeded')
# Commit only after every delivered asset and the total budget have validated.
for filename,data in prepared.items(): (ART/'generated'/filename).write_bytes(data)
for filename,data in docs.items(): (ART/filename).write_bytes(data)
save(ART/'manifest.json',m);save(ART/'character-art.json',mappings)
report['runtimeBytes'] = sum(e['bytes'] for e in entries.values());report['combinedRuntimeBytes'] = m['totalBytes']
report['coverage'] = {group:len(mappings[group]) for group in ('heroes','enemies','npcs')}
save(ART/'task3-import-report.json',report)
print(json.dumps({k:report[k] for k in ('archive','coverage','runtimeBytes','combinedRuntimeBytes')},indent=2))
