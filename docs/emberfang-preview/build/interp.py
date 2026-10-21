import sys, glob, os, numpy as np, cv2
from PIL import Image
C=384
dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
def load_frames(path):
    im=np.array(Image.open(path).convert('RGBA')).astype(np.float32)/255
    H,W=im.shape[:2]; out=[]
    for r in range(H//C):
        for c in range(W//C):
            x=im[r*C:(r+1)*C,c*C:(c+1)*C].copy()
            if (x[...,3]>40/255).sum()>200: out.append(x)
    return out
def prem(x): y=x.copy(); y[...,:3]*=y[...,3:4]; return y
def unprem(y):
    a=y[...,3:4]; o=y.copy(); o[...,:3]=np.where(a>1e-3,y[...,:3]/np.maximum(a,1e-3),0); return np.clip(o,0,1)
def gray(p): g=(0.3*p[...,0]+0.59*p[...,1]+0.11*p[...,2])*255*1.0+p[...,3]*60; return np.clip(g,0,255).astype(np.uint8)
grid=np.stack(np.meshgrid(np.arange(C),np.arange(C)),-1).astype(np.float32)
def warp(img,flow): return cv2.remap(img,grid[...,0]+flow[...,0],grid[...,1]+flow[...,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)
def mid(a,b,t):
    pa,pb=prem(a),prem(b)
    ga,gb=gray(pa),gray(pb)
    f01=dis.calc(ga,gb,None)   # a->b : pixel at x in a moves to x+f01
    f10=dis.calc(gb,ga,None)
    # backward sample: I_t(y)=I0(y - t*F01(y)) , I1(y - (1-t)*F10(y))
    w0=warp(pa,-t*f01); w1=warp(pb,-(1-t)*f10)
    cf=(1-t)*pa+t*pb
    # confidence: where the two warps disagree strongly, fall back to crossfade
    diff=np.abs(w0-w1).mean(-1,keepdims=True)
    k=np.clip((diff-.12)/.25,0,1); k=cv2.GaussianBlur(k,(0,0),3)[...,None] if k.ndim==2 else cv2.GaussianBlur(k[...,0],(0,0),3)[...,None]
    wb=(1-t)*w0+t*w1
    return unprem(wb*(1-k)+cf*k), unprem(cf)
if __name__=='__main__':
    for n in ['01_Idle','02_Running','13_Light_Attack','14_Heavy_Attack','18_Elemental_Attack','09_Dodging']:
        fr=load_frames(f'sheets/{n}.png'); e1=[];e2=[]
        for i in range(len(fr)-2):
            gt=prem(fr[i+1]); m,cf=mid(fr[i],fr[i+2],.5)
            e1.append(np.abs(prem(m)-gt).mean()); e2.append(np.abs(prem(cf)-gt).mean())
        print(n,'flow err %.4f  crossfade err %.4f'%(np.mean(e1),np.mean(e2)))
