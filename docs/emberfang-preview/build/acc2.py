import sys, json, os, numpy as np
from PIL import Image
C=384
d=sys.argv[1]; meta=json.load(open(d+'/animation_metadata.json'))['animations']
def cells(p,n,cols=4):
    im=np.array(Image.open(p).convert('RGBA')); return [im[(i//cols)*C:(i//cols+1)*C,(i%cols)*C:(i%cols+1)*C] for i in range(n)]
print('==',d)
for n,a in meta.items():
    N=a['frames']; body=cells(f'{d}/character_only/{n}.png',N)
    comp=cells(f'{d}/{n}.png',N)
    vp=f'{d}/vfx_layers/{n}_vfx.png'; fx=cells(vp,N) if os.path.exists(vp) else None
    bb=np.array([np.where(x[...,3]>128)[0].max() for x in body]); top=np.array([np.where(x[...,3]>128)[0].min() for x in body])
    cx=np.array([np.where(x[...,3]>128)[1].mean() for x in body])
    # body torso motion: centroid of body
    cy=np.array([np.where(x[...,3]>128)[0].mean() for x in body]); 
    h=[np.ptp(np.where(x[...,3]>128)[0]) for x in body]
    clipbody=sum(1 for x in body if (x[0,:,3]>128).any() or (x[:,0,3]>128).any() or (x[:,-1,3]>128).any() or (x[-1,:,3]>128).any())
    clipfx=0
    if fx: clipfx=sum(1 for x in fx if (x[0,:,3]>40).any() or (x[:,0,3]>40).any() or (x[:,-1,3]>40).any() or (x[-1,:,3]>40).any())
    # frame uniqueness (duplicates)
    lum=[x[...,:3].astype(float).sum(2)*(x[...,3]/255) for x in comp]
    dif=[np.abs(lum[i+1]-lum[i]).mean() for i in range(N-1)]
    dup=sum(1 for v in dif if v<.3)
    seam=np.abs(lum[-1]-lum[0]).mean()
    print(n[:20].ljust(20),'N%2d'%N,'bot %3d..%3d'%(bb.min(),bb.max()),'topmin %3d'%top.min(),'h %3d-%3d'%(min(h),max(h)),'cx %3.0f-%3.0f'%(cx.min(),cx.max()),'cyΔ %2d'%np.ptp(cy),'clipB',clipbody,'clipFX',clipfx,'dupPairs',dup,'seam %.1f'%seam,'fx' if fx else '--')
