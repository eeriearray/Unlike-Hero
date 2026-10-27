// Landmarks, distant coast, drifting cloud banks and a low sun provide depth
// without downloaded art, dynamic shadows or full-screen post-processing.
export function createScenery(T,scene,islands,sky,glowTexture,mobile,batch=()=>{}){
 const stone=new T.MeshStandardMaterial({color:'#a9977d',roughness:.94,flatShading:false}),plaster=new T.MeshStandardMaterial({color:'#ddd1ac',roughness:.9}),red=new T.MeshStandardMaterial({color:'#8b4934',roughness:.8}),iron=new T.MeshStandardMaterial({color:'#293d40',metalness:.45,roughness:.55});
 const masonry=document.createElement('canvas');masonry.width=masonry.height=256;const mg=masonry.getContext('2d');mg.fillStyle='#736c5e';mg.fillRect(0,0,256,256);
 for(let row=0;row<8;row++)for(let col=-1;col<5;col++){const x=col*64+(row%2)*32,y=row*32,v=155+Math.round(Math.sin(row*19+col*7)*14);mg.fillStyle=`rgb(${v+24},${v+14},${v-7})`;mg.fillRect(x+2,y+2,60,28);mg.strokeStyle='#e3d7b366';mg.strokeRect(x+3,y+3,57,24);for(let k=0;k<20;k++){mg.fillStyle=k%2?'#403a2912':'#fff6d414';mg.fillRect(x+4+(k*17%55),y+4+(k*11%23),3,1);}}
 const stoneTexture=new T.CanvasTexture(masonry);stoneTexture.encoding=T.sRGBEncoding;stoneTexture.wrapS=stoneTexture.wrapT=T.RepeatWrapping;stone.map=stoneTexture;stone.color.set('#f2dfbd');
 const light=new T.MeshBasicMaterial({color:'#ffcc71'}),wood=new T.MeshStandardMaterial({color:'#66503a',roughness:.8});
 const mesh=(g,m,parent,x,y,z)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;};
 const lighthouse=islands[0],fort=islands[1];
 mesh(new T.CylinderGeometry(2,2.8,14,12),plaster,lighthouse,1,7,-2);
 for(const y of [4,9])mesh(new T.CylinderGeometry(2.18,2.38,1.25,12),red,lighthouse,1,y,-2);
 mesh(new T.CylinderGeometry(3,2.7,.6,12),stone,lighthouse,1,14,-2);mesh(new T.CylinderGeometry(1.8,1.8,2.2,10),iron,lighthouse,1,15.4,-2);
 mesh(new T.SphereGeometry(1.25,10,7),light,lighthouse,1,15.4,-2);mesh(new T.ConeGeometry(2.8,2.4,12),red,lighthouse,1,17.4,-2);
 const lamp=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color:'#ffcc71',transparent:true,opacity:.45,depthWrite:false,blending:T.AdditiveBlending}));lamp.position.set(1,15.4,-2);lamp.scale.set(9,9,1);lighthouse.add(lamp);
 const beamRoot=new T.Group();beamRoot.position.set(1,15.4,-2);lighthouse.add(beamRoot);
 const beam=mesh(new T.ConeGeometry(3.7,30,16,1,true),new T.MeshBasicMaterial({color:'#ffe1a0',transparent:true,opacity:.035,side:T.DoubleSide,depthWrite:false}),beamRoot,0,0,15);beam.rotation.x=-Math.PI/2;
 for(const x of [-8,8]){mesh(new T.BoxGeometry(3.4,5.2,14),stone,fort,x,3,-1);for(let j=0;j<5;j++)mesh(new T.BoxGeometry(3.5,1,1.7),stone,fort,x,6.1,-7+j*3);}
 mesh(new T.BoxGeometry(18,5,3),stone,fort,0,3,-7);for(let j=0;j<6;j++)mesh(new T.BoxGeometry(1.8,1,3.1),stone,fort,-8+j*3,6,-7);
 mesh(new T.BoxGeometry(8,1,9),wood,fort,0,1.4,4);for(const x of [-5,0,5]){const cannon=mesh(new T.CylinderGeometry(.45,.55,3.5,8),iron,fort,x,4,-8);cannon.rotation.x=Math.PI/2;}
 const doorMat=new T.MeshStandardMaterial({color:'#493a29',roughness:.9});mesh(new T.BoxGeometry(2.2,2.6,.1),doorMat,fort,0,2,-8.57);const arch=mesh(new T.CircleGeometry(1.1,18,0,Math.PI),doorMat,fort,0,3.3,-8.58);
 for(const x of [-.7,0,.7])mesh(new T.BoxGeometry(.045,2.6,.06),iron,fort,x,2,-8.65);for(const y of [1.4,2.6])mesh(new T.BoxGeometry(2.1,.08,.06),iron,fort,0,y,-8.66);
 for(const x of [-8,8]){mesh(new T.BoxGeometry(3.7,.3,14.3),plaster,fort,x,5.6,-1);for(const z of [-5,-1,3]){mesh(new T.BoxGeometry(.04,1.2,.7),iron,fort,x+(x<0?-1.72:1.72),3.3,z);}}
 // A navigational banner over the fort.
 mesh(new T.CylinderGeometry(.12,.16,9,5),wood,fort,7,10,-6);const banner=new T.PlaneGeometry(3,2);mesh(banner,new T.MeshBasicMaterial({color:'#b84f41',side:T.DoubleSide}),fort,8.5,13,-6);
 for(const island of islands){
  for(let j=0;j<15;j++){const plank=mesh(new T.BoxGeometry(5,.18,.48),wood,island,-7,.9,8+j*.52);plank.rotation.z=Math.sin(j)*.015;}
  for(const x of [-9,-5])for(const z of [9,13,16]){mesh(new T.CylinderGeometry(.17,.23,3,7),wood,island,x,-.1,z);mesh(new T.CylinderGeometry(.3,.3,.22,8),iron,island,x,1.25,z);}
  for(const x of [-6,5]){mesh(new T.BoxGeometry(3.7,2.3,3),plaster,island,x,2.1,4);const roof=mesh(new T.CylinderGeometry(0,3,2,4),red,island,x,4.1,4);roof.rotation.y=Math.PI/4;mesh(new T.BoxGeometry(.8,1.4,.08),wood,island,x,1.65,5.54);}
 }
 // Thin, staggered courses break up the fort's plain stone walls.
 for(let y=1;y<6;y+=.7)for(let j=0;j<6;j++){mesh(new T.BoxGeometry(2.7,.035,.025),wood,fort,-7.2+j*2.8,y,-8.51);mesh(new T.BoxGeometry(.035,.66,.025),wood,fort,-8.5+j*2.8+(Math.round(y*10)%2)*1.2,y+.33,-8.53);}
 batch(lighthouse);batch(fort);
 const backdrop=new T.Group();scene.add(backdrop);const cliff=new T.MeshStandardMaterial({color:'#617f7c',flatShading:false,roughness:1});
 // Low coastal shelves replace the oversized polygon boulders on the horizon.
 function coastalShelf(seed){const p=[],indices=[],segments=32;
  for(let row=0;row<4;row++)for(let j=0;j<=segments;j++){const a=j/segments*Math.PI*2,shape=1+Math.sin(a*5+seed)*.12+Math.cos(a*9+seed)*.06,r=[15,13,10,0][row]*shape,y=[-3,.3,4.2,4.8][row]+(row>1?Math.sin(a*3+seed)*.8:0);p.push(Math.sin(a)*r,y,Math.cos(a)*r);}
  for(let row=0;row<3;row++)for(let j=0;j<segments;j++){const a=row*(segments+1)+j,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
 }
 cliff.side=T.DoubleSide;
 for(let i=0;i<22;i++){const a=i*Math.PI*2/22,r=184+Math.sin(i*4.7)*5;const m=mesh(coastalShelf(i),cliff,backdrop,Math.sin(a)*r,0,Math.cos(a)*r);m.rotation.y=i*1.4;}
 batch(backdrop);const ridge=new T.Group();sky.add(ridge);const haze=new T.MeshBasicMaterial({color:'#7caaa8',fog:false,side:T.DoubleSide});const vertices=[],indices=[],segments=120;
 for(let row=0;row<3;row++)for(let j=0;j<=segments;j++){const a=j/segments*Math.PI*2,r=[204,218,235][row],height=row===1?-16+Math.max(0,Math.sin(a*3+.7)*.6+Math.sin(a*7)*.28+Math.sin(a*13+2)*.12)*23:-31;vertices.push(Math.sin(a)*r,height,Math.cos(a)*r);}
 for(let row=0;row<2;row++)for(let j=0;j<segments;j++){const a=row*(segments+1)+j,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}const range=new T.BufferGeometry();range.setAttribute('position',new T.Float32BufferAttribute(vertices,3));range.setIndex(indices);range.computeVertexNormals();mesh(range,haze,ridge,0,0,0);

 const disk=mesh(new T.SphereGeometry(3.7,16,12),new T.MeshBasicMaterial({color:'#ffcf8b',fog:false}),sky,-198,4,-28);
 const sunGlow=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color:'#efb878',transparent:true,opacity:.25,depthWrite:false,fog:false,blending:T.AdditiveBlending}));sunGlow.position.copy(disk.position);sunGlow.scale.set(45,45,1);sky.add(sunGlow);
 const c=document.createElement('canvas');c.width=256;c.height=96;const g=c.getContext('2d');for(let j=0;j<8;j++){const x=28+j*28,y=48+Math.sin(j*1.4)*10,r=20+j%3*6,gradient=g.createRadialGradient(x,y,1,x,y,r);gradient.addColorStop(0,'#e5e4dfbb');gradient.addColorStop(1,'#d9dfe000');g.fillStyle=gradient;g.fillRect(x-r,y-r,r*2,r*2);}const cloudTexture=new T.CanvasTexture(c),clouds=[];
 for(let i=0;i<(mobile?5:8);i++){const cloud=new T.Sprite(new T.SpriteMaterial({map:cloudTexture,color:'#fff2dc',transparent:true,opacity:.48,depthWrite:false,fog:false}));sky.add(cloud);cloud.scale.set(55+i%3*14,17+i%2*5,1);clouds.push(cloud);}
 return {update(t){beamRoot.rotation.y=t*.26;lamp.material.opacity=.38+Math.sin(t*2)*.08;clouds.forEach((cloud,i)=>{const a=i*Math.PI*2/clouds.length+t*.0025;cloud.position.set(Math.sin(a)*185,6+Math.sin(i*3)*4,Math.cos(a)*185);});}};
}
