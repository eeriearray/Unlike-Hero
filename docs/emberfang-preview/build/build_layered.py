# Layered dragon pack (body + fx + metadata): body gets optical-flow in-betweens, fx gets a plain blend, then fx is composited over the body.
import sys, os, json, numpy as np, cv2
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from interp import *
src,dst=sys.argv[1],sys.argv[2]
import glob; meta=json.load(open(glob.glob(src+'/*_animations_metadata.json')[0]))
def cells(path,n,cols=4):
    im=np.array(Image.open(path).convert('RGBA')).astype(np.float32)/255
    return [im[(i//cols)*C:(i//cols+1)*C,(i%cols)*C:(i%cols+1)*C].copy() for i in range(n)]
MAXFLOW=float(os.environ.get('MAXFLOW','1e9'))
def flow_mids(a,b,ts):
    pa,pb=prem(a),prem(b); ga,gb=gray(pa),gray(pb); f01=dis.calc(ga,gb,None); f10=dis.calc(gb,ga,None); out=[]
    # Big pose changes (e.g. a tail flicking from curled to extended in one frame) can't be tracked: warping stretches the limb like rubber.
    # When much of the silhouette moves a long way, use a plain blend for the whole in-between instead.
    mag=np.linalg.norm(f01,axis=-1); sil=(pa[...,3]>.5)|(pb[...,3]>.5)
    if sil.any() and np.percentile(mag[sil],97)>MAXFLOW: return blend_mids(a,b,ts)
    for t in ts:
        w0=warp(pa,-t*f01); w1=warp(pb,-(1-t)*f10); cf=(1-t)*pa+t*pb
        k=cv2.GaussianBlur(np.clip((np.abs(w0-w1).mean(-1)-.12)/.25,0,1),(0,0),3)[...,None]
        out.append(((1-t)*w0+t*w1)*(1-k)+cf*k)     # premultiplied
    return out
def blend_mids(a,b,ts): pa,pb=prem(a),prem(b); return [(1-t)*pa+t*pb for t in ts]
def over(fxp,bodyp): return fxp+bodyp*(1-fxp[...,3:4])   # premultiplied "over"
only=set(sys.argv[3].split(',')) if len(sys.argv)>3 else None
os.makedirs(dst,exist_ok=True); man=json.load(open(dst+'/manifest.json'))['anims'] if only else {}
# The generator drew some beams starting inside the torso. Erase the part behind the fist (rows near the beam, x left of the claw) so the effect starts at the hand.
FX_FIX={'13_Light_Attack':{3:(0,0),4:(0,0),5:(0,0)}}
def fix_fx(n,i,Bi,Fi):
    if n not in FX_FIX or i not in FX_FIX[n]: return Fi
    ys,xs=np.where(Fi[...,3]>.5); rows=np.bincount(ys,minlength=C); r0=int(rows.argmax()); band=slice(max(0,r0-50),min(C,r0+50))
    tip=max(np.where(Bi[r][...,3]>.5)[0].max() for r in range(band.start,band.stop) if (Bi[r][...,3]>.5).any())
    x0=tip-34; ramp=np.clip((np.arange(C)-(x0-22))/22.,0,1)       # 0 left of x0-22, 1 right of x0
    out=Fi.copy(); out[band]=Fi[band]*ramp[None,:,None]; return out
for a in meta['animations']:
    n=a['name']
    if only and n not in only: continue
    N=a['frames']; B=cells(src+'/'+a['body_layer'],N); F=cells(src+'/'+a['effects_layer'],N)
    F=[fix_fx(n,i,B[i],F[i]) for i in range(N)]
    loop=a['mode']=='loop'
    if loop and np.abs(prem(B[0])-prem(B[-1])).mean()<.004: B,F=B[:-1],F[:-1]   # last frame duplicates the first: drop it so the loop doesn't hitch
    M=len(B); seq=[]; ts=[1/3,2/3]
    for i in range(M):
        seq.append(over(prem(F[i]),prem(B[i])))
        if i<M-1 or loop:
            j=(i+1)%M; gm=n.startswith('11_') or n.startswith('12_')   # guard: plain blend (flow tears across overlapping limbs)
            bm=blend_mids(B[i],B[j],ts) if gm else flow_mids(B[i],B[j],ts)
            fm=blend_mids(F[i],F[j],ts)
            seq+=[over(f,b) for f,b in zip(fm,bm)]
    cols=4; rows=(len(seq)+cols-1)//cols; sh=np.zeros((rows*C,cols*C,4),np.float32)
    for i,x in enumerate(seq): sh[(i//cols)*C:(i//cols+1)*C,(i%cols)*C:(i%cols+1)*C]=unprem(x)
    Image.fromarray((np.clip(sh,0,1)*255+.5).astype(np.uint8)).save(f'{dst}/{n}.png')
    # foot height from the body layer only (fx would pollute it); in-betweens interpolate linearly
    bb=[int(np.where(x[...,3]>.5)[0].max()) for x in B]; bots=[]
    for i in range(M):
        bots.append(bb[i])
        if i<M-1 or loop:
            j=(i+1)%M; bots+=[int(round(bb[i]+(bb[j]-bb[i])*t)) for t in ts]
    man[n]={'n':len(seq),'cols':cols,'orig':M,'loop':loop,'bot':bots,'active':a['active_or_release_frames']}; print(n,N,'->',len(seq),flush=True)
if not only: cx=float(np.mean([np.where(x[...,3]>.5)[1].mean() for x in cells(src+'/'+meta['animations'][0]['body_layer'],12)]))
if only:
    d=json.load(open(dst+'/manifest.json')); d['anims']=man; json.dump(d,open(dst+'/manifest.json','w'))
else: json.dump({'anims':man,'cx':cx},open(dst+'/manifest.json','w'))
