#!/usr/bin/env python3
"""Import a supplied trailer and belfry PNG. Usage: import-hollow-opening-media.py TRAILER.mp4 BELFRY.png"""
from pathlib import Path
from PIL import Image
import json,hashlib,shutil,subprocess,tempfile,sys
root=Path(__file__).resolve().parents[1]/'games/the-hollow'; art=root/'art'; manifest=json.loads((art/'manifest.json').read_text());pack='the_hollow_opening_media'
image=Path(sys.argv[2]).resolve();video=Path(sys.argv[1]).resolve();generated=art/'generated'

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
with Image.open(image) as im:
 im.convert('RGB').save(generated/'opening_belfry_interior.webp','WEBP',quality=90,method=6)
 size=im.size
with tempfile.TemporaryDirectory(prefix='hollow-cinematic-') as folder:
 temp=Path(folder);log=str(temp/'pass');prepared=temp/'trailer.mp4'
 base=['ffmpeg','-v','error','-y','-i',str(video),'-c:v','libx264','-preset','slow','-b:v','330k']
 subprocess.run(base+['-pass','1','-passlogfile',log,'-an','-f','null','/dev/null'],check=True)
 subprocess.run(base+['-pass','2','-passlogfile',log,'-c:a','aac','-b:a','64k','-movflags','+faststart','-pix_fmt','yuv420p',str(prepared)],check=True)
 shutil.copyfile(prepared,generated/'opening_trailer.mp4')
 poster=temp/'poster.png'
 subprocess.run(['ffmpeg','-v','error','-y','-ss','1','-i',str(video),'-frames:v','1','-update','1',str(poster)],check=True)
 Image.open(poster).save(generated/'opening_trailer_poster.webp','WEBP',quality=90)
for aid,file,typ,src,extra in [
 ('opening_belfry_interior','opening_belfry_interior.webp','image',image,{'width':size[0],'height':size[1],'regions':['village']}),
 ('opening_trailer','opening_trailer.mp4','video',video,{'seconds':60,'width':1280,'height':536,'codec':'h264/aac','onDemand':True,'regions':['shared']}),
 ('opening_trailer_poster','opening_trailer_poster.webp','image',video,{'width':1280,'height':536,'regions':['shared']})]:
 target=generated/file;manifest['assets'][aid]={'file':'art/generated/'+file,'type':typ,'bytes':target.stat().st_size,'pack':pack,'source':src.name,'sourceSha256':sha(src),'sha256':sha(target),'pixel':False,**extra}
manifest['packs']=[p for p in manifest['packs'] if p['id']!=pack]+[{'id':pack,'source':'User-supplied belfry PNG and Thornwick trailer MP4','status':'local-only','included':3}]
manifest['regions']={}
for aid,e in manifest['assets'].items():
 for region in e['regions']:manifest['regions'].setdefault(region,[]).append(aid)
manifest['totalBytes']=sum(e['bytes'] for e in manifest['assets'].values());raw=json.dumps(manifest,indent=2)+'\n'
assert manifest['totalBytes']+len(raw.encode())<40_000_000,manifest['totalBytes']
(art/'manifest.json').write_text(raw)
scene=art/'scenes/belltower.json';c=json.loads(scene.read_text());c['interiorBackground']='opening_belfry_interior';scene.write_text(json.dumps(c,indent=2)+'\n')
print('Total media bytes',manifest['totalBytes'],'including trailer',manifest['assets']['opening_trailer']['bytes'])
