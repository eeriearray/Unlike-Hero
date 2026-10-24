#!/usr/bin/env python3
"""Prepare three local interaction recordings without rebuilding unrelated assets."""
import hashlib, json, pathlib, subprocess, tempfile, zipfile
root = pathlib.Path(__file__).resolve().parents[1]
source = pathlib.Path.home()/'Desktop/horror game assets/Horror SFX Free.zip'
art = root / 'games/the-hollow/art'
cues = {
    'interaction_ink': ('Horror SFX Free/House & Office/Writing.wav', 1.5),
    'interaction_knock': ('Horror SFX Free/House & Office/Door_knocking_quiet.wav', 2.0),
    'interaction_iron': ('Horror SFX Free/House & Office/Metal scrape_scratch.wav', 1.0),
}
manifest = json.loads((art/'manifest.json').read_text())
with zipfile.ZipFile(source) as archive, tempfile.TemporaryDirectory(prefix='hollow-cues-') as temp:
    for key, (member, length) in cues.items():
        data = archive.read(member)  # Exact named media; no source-pack code or arbitrary extraction.
        wav = pathlib.Path(temp)/(key+'.wav'); wav.write_bytes(data)
        output = art/'generated'/(key+'.mp3')
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y','-i',str(wav),'-t',str(length),'-af','highpass=f=80,lowpass=f=6500,loudnorm=I=-23:TP=-3:LRA=7,afade=t=in:d=0.015,afade=t=out:st='+str(length-.12)+':d=0.12','-ac','1','-ar','44100','-c:a','libmp3lame','-b:a','64k',str(output)], check=True)
        media=output.read_bytes()
        probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(output)]))
        manifest['assets'][key] = dict(type='audio',pack='horror_sfx_free',source=member,sourceSha256=hashlib.sha256(data).hexdigest(),sha256=hashlib.sha256(media).hexdigest(),file='art/generated/'+output.name,bytes=len(media),seconds=float(probe['format']['duration']),channels=1,loop=False,regions=['village'])
for key in cues:
    if key not in manifest['regions'].setdefault('village',[]): manifest['regions']['village'].append(key)
for pack in manifest.get('packs',[]):
    if pack['id']=='horror_sfx_free': pack['included']=sum(a['pack']=='horror_sfx_free' for a in manifest['assets'].values())
manifest['totalBytes']=sum(a['bytes'] for a in manifest['assets'].values())
assert manifest['totalBytes'] < manifest['maxBytes']
(art/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Prepared 3 interaction cues; manifest media bytes:',manifest['totalBytes'])
