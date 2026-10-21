import sys, glob, os, numpy as np
from PIL import Image
C=384
d=sys.argv[1]
def frames(p):
    im=np.array(Image.open(p).convert('RGBA')); out=[]
    for r in range(im.shape[0]//C):
        for c in range(im.shape[1]//C):
            x=im[r*C:(r+1)*C,c*C:(c+1)*C]
            if (x[...,3]>40).sum()>200: out.append(x)
    return out
def bot(x): ys=np.where(x[...,3]>128)[0]; return ys.max(), ys.min()
for f in sorted(glob.glob(d+'/*.png')):
    n=os.path.basename(f)[:-4]; fr=frames(f); a=np.array([bot(x) for x in fr])
    h=[x[...,3] for x in fr]
    clip=sum(1 for x in h if (x[0]>128).any() or (x[:,0]>128).any() or (x[:,-1]>128).any())
    # torso motion: centroid of dark (non-bright) pixels
    cen=[]
    for x in fr:
        m=(x[...,3]>128)&(x[...,:3].astype(int).sum(2)<330)
        ys,xs=np.where(m); cen.append((xs.mean(),ys.mean()) if len(xs) else (0,0))
    cen=np.array(cen)
    lum=[(x[...,:3].astype(float).sum(2)*(x[...,3]/255)) for x in fr]
    seam=np.abs(lum[-1]-lum[0]).mean(); mean=np.mean([np.abs(lum[i+1]-lum[i]).mean() for i in range(len(fr)-1)])
    print(n[:22].ljust(22),'n=%d'%len(fr),'bot %d..%d'%(a[:,0].min(),a[:,0].max()),'top %d'%a[:,1].min(),'torso dx %d dy %d'%(np.ptp(cen[:,0]),np.ptp(cen[:,1])),'clip',clip,'seam/mean %.2f'%(seam/mean))
