# Layered pack v2 (character_only/ + vfx_layers/ + animation_metadata.json): body gets optical-flow in-betweens, vfx a plain blend, then composited.
import sys, os, json, numpy as np, cv2
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from interp import *
src,dst=sys.argv[1],sys.argv[2]
man_in=json.load(open(src+'/animation_manifest.json')); meta={k[:-4]:{'frames':v['frames'],'loop':v['loop'],**({'release_frame':v['release_frame']} if v.get('release_frame') is not None else {})} for k,v in man_in.items()}
def cells(path,n,cols=4):
    im=np.array(Image.open(path).convert('RGBA')).astype(np.float32)/255
    return [im[(i//cols)*C:(i//cols+1)*C,(i%cols)*C:(i%cols+1)*C].copy() for i in range(n)]
def flow_mids(a,b,ts):
    pa,pb=prem(a),prem(b); ga,gb=gray(pa),gray(pb); f01=dis.calc(ga,gb,None); f10=dis.calc(gb,ga,None); out=[]
    for t in ts:
        w0=warp(pa,-t*f01); w1=warp(pb,-(1-t)*f10); cf=(1-t)*pa+t*pb
        k=cv2.GaussianBlur(np.clip((np.abs(w0-w1).mean(-1)-.12)/.25,0,1),(0,0),3)[...,None]
        out.append(((1-t)*w0+t*w1)*(1-k)+cf*k)
    return out
def blend_mids(a,b,ts): pa,pb=prem(a),prem(b); return [(1-t)*pa+t*pb for t in ts]
def over(fxp,bodyp): return fxp+bodyp*(1-fxp[...,3:4])
os.makedirs(dst,exist_ok=True); man={}
for n,a in meta.items():
    N=a['frames']; B=cells(f'{src}/sprites_only/{n}.png',N)
    vp=f'{src}/effects_only/{n}.png'; F=cells(vp,N) if os.path.exists(vp) else [np.zeros_like(B[0]) for _ in range(N)]
    loop=a['loop']; M=N; seq=[]; ts=[1/3,2/3]
    for i in range(M):
        seq.append(over(prem(F[i]),prem(B[i])))
        if i<M-1 or loop:
            j=(i+1)%M; gm=n.startswith('11_') or n.startswith('12_')
            bm=blend_mids(B[i],B[j],ts) if gm else flow_mids(B[i],B[j],ts)
            fm=blend_mids(F[i],F[j],ts); seq+=[over(f,b) for f,b in zip(fm,bm)]
    cols=4; rows=(len(seq)+cols-1)//cols; sh=np.zeros((rows*C,cols*C,4),np.float32)
    for i,x in enumerate(seq): sh[(i//cols)*C:(i//cols+1)*C,(i%cols)*C:(i%cols+1)*C]=unprem(x)
    Image.fromarray((np.clip(sh,0,1)*255+.5).astype(np.uint8)).save(f'{dst}/{n}.png')
    bb=[int(np.where(x[...,3]>.5)[0].max()) for x in B]; bots=[]
    for i in range(M):
        bots.append(bb[i])
        if i<M-1 or loop:
            j=(i+1)%M; bots+=[int(round(bb[i]+(bb[j]-bb[i])*t)) for t in ts]
    act=None
    if 'release_frame' in a: r=a['release_frame']; act=[max(0,r-1),r+1]      # 3-frame active window around the release frame
    man[n]={'n':len(seq),'cols':cols,'orig':M,'loop':loop,'bot':bots,'active':act,'hold':a.get('hold_frames')}; print(n,N,'->',len(seq),flush=True)
cx=float(np.mean([np.where(x[...,3]>.5)[1].mean() for x in cells(f'{src}/sprites_only/01_Idle.png',12)]))
json.dump({'anims':man,'cx':cx},open(dst+'/manifest.json','w'))
