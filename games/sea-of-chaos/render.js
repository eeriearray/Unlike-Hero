import {createCombatEffects} from './combat-effects.js';
import {cargoCount,capacity as holdCapacity,inSmoke} from './economy.js';
import {SAILS,WEAPONS} from './loadout.js';
import {missionFor} from './objectives.js';
import {createDock} from './dock-visuals.js';
import {buoy} from './simulation.js';
import {RAID_ISLANDS as ISLANDS,reefHeightAt} from './raid-map.js';
import {createRaidScenery} from './raid-scenery.js';
import {createWhirlpool} from './whirlpool.js';
import {ARENA,BOUNDARY,WHIRLPOOLS,tideAt} from './arena.js';
import {createScenery} from './scenery.js';
import {shipPose} from './ship-pose.js';
import {broadsideAim} from './combat.js';

// Procedural art stays local. Static details are merged by material to keep
// detailed boats affordable on phones; there are no shadow or bloom passes.
export function makeRenderer(canvas) {
 const T=window.THREE;
 T.ColorManagement.legacyMode=false;
 const mobile=matchMedia('(pointer:coarse)').matches;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(1);renderer.outputEncoding=T.sRGBEncoding;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 const scene=new T.Scene();scene.fog=new T.Fog('#76b9ba',185,245);
 const camera=new T.PerspectiveCamera(51,1,.3,245);
 scene.add(new T.HemisphereLight(0xbfeaff,0x5d6554,1.15));
 const sunlight=new T.DirectionalLight(0xffdfac,1.65);sunlight.position.set(-50,70,-45);scene.add(sunlight);
 const fill=new T.DirectionalLight(0x78bdc9,.28);fill.position.set(30,12,45);scene.add(fill);
 const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.73,...extra});
 const basic=(color,opacity=1)=>new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,side:T.DoubleSide,depthWrite:opacity===1});
 function mesh(g,m,parent,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;}
 function texture(kind) {
  const c=document.createElement('canvas');c.width=256;c.height=256;const g=c.getContext('2d');
  if(kind==='wood'){
   g.fillStyle='#92704e';g.fillRect(0,0,256,256);
   for(let j=0;j<8;j++){const y=j*32;g.fillStyle=j%2?'#9d7954':'#866242';g.fillRect(0,y,256,31);g.fillStyle='#392c20';g.fillRect(0,y,256,2);
    for(let k=0;k<10;k++){g.strokeStyle=k%2?'#b18a5b55':'#4c382733';g.beginPath();g.moveTo(0,y+4+k*2.5);g.bezierCurveTo(70,y+2+k*2.5,170,y+8+k*2.5,256,y+5+k*2.5);g.stroke();}
    g.fillStyle='#433125';g.fillRect((j%3)*83,y,2,32);for(const x of [6,248]){g.fillStyle='#372b22';g.fillRect(x,y+7,2,2);g.fillRect(x,y+23,2,2);}
   }
  }else{
   g.fillStyle='#e5dac0';g.fillRect(0,0,256,256);
   for(let i=0;i<256;i+=4){g.strokeStyle=i%8?'#baac9020':'#fff9e620';g.beginPath();g.moveTo(i,0);g.lineTo(i,256);g.moveTo(0,i);g.lineTo(256,i);g.stroke();}
   for(let i=0;i<256;i+=64){g.strokeStyle='#9d8d6c65';g.lineWidth=2;g.strokeRect(i,0,64,256);}
   const wash=g.createRadialGradient(128,120,35,128,128,160);wash.addColorStop(0,'#fff5d500');wash.addColorStop(1,'#78502c80');g.fillStyle=wash;g.fillRect(0,0,256,256);
   g.strokeStyle='#805732';g.lineWidth=5;g.strokeRect(12,12,232,232);g.lineWidth=1.5;g.setLineDash([3,5]);g.strokeRect(20,20,216,216);g.setLineDash([]);
   // An engraved compass and skull, visible on either side of the curved sail.
   g.save();g.translate(128,133);g.strokeStyle='#87673e80';g.lineWidth=2;g.beginPath();g.arc(0,0,65,0,Math.PI*2);g.stroke();
   for(let j=0;j<8;j++){g.rotate(Math.PI/4);g.fillStyle=j%2?'#997a4c50':'#997a4c88';g.beginPath();g.moveTo(0,-84);g.lineTo(8,-49);g.lineTo(0,-58);g.lineTo(-8,-49);g.fill();}
   g.strokeStyle='#604629';g.lineWidth=9;g.lineCap='round';for(const sign of [-1,1]){g.beginPath();g.moveTo(-32,sign*31);g.lineTo(32,-sign*31);g.stroke();for(const x of [-32,32]){g.beginPath();g.arc(x,-sign*x,6,0,Math.PI*2);g.stroke();}}
   g.fillStyle='#634a31';g.beginPath();g.ellipse(0,-6,27,31,0,0,Math.PI*2);g.fill();g.fillRect(-17,11,34,23);g.fillStyle='#e6d8b9';for(const x of [-11,11]){g.beginPath();g.ellipse(x,-7,7,9,x*.025,0,Math.PI*2);g.fill();}g.beginPath();g.moveTo(0,3);g.lineTo(-4,12);g.lineTo(4,12);g.fill();g.lineWidth=2;g.strokeStyle='#e6d8b9';for(const x of [-9,0,9]){g.beginPath();g.moveTo(x,23);g.lineTo(x,34);g.stroke();}g.restore();
  }
  const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=mobile?1:Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;
 }
 const grain=texture('wood'),fabric=texture('canvas');
 const wood=mat('#d2a06b',{map:grain}),deckMat=mat('#f1ce92',{map:grain,side:T.DoubleSide}),darkWood=mat('#906544',{map:grain});
 const barrelMouth=basic('#0d1719');
 const iron=mat('#29373b',{metalness:.65,roughness:.4}),brass=mat('#d7ad5e',{metalness:.65,roughness:.38});
 const palms=[];
 const ropeMat=mat('#bda476'),foamMat=basic('#c1eddf',.48),leafMat=mat('#397f59',{side:T.DoubleSide}),leafLight=mat('#66a65c',{side:T.DoubleSide});
 const sandMat=mat('#d6bd84'),rockMat=mat('#566e6d',{flatShading:true}),rockLight=mat('#829085',{flatShading:true});
 function rod(parent,a,b,r,material=ropeMat,segments=5){const from=new T.Vector3(...a),to=new T.Vector3(...b),delta=to.clone().sub(from);
  const o=mesh(new T.CylinderGeometry(r,r,delta.length(),segments),material,parent);o.position.copy(from).add(to).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;
 }
 function mergeStatic(group){const buckets=new Map();for(const o of [...group.children]){if(!o.isMesh)continue;o.updateMatrix();const g=o.geometry.clone().applyMatrix4(o.matrix);const flat=g.index?g.toNonIndexed():g;if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(flat);o.geometry.dispose();group.remove(o);if(g!==flat)g.dispose();}
  for(const [material,parts]of buckets){const merged=new T.BufferGeometry();for(const name of ['position','normal','uv','color']){const arrays=parts.map(p=>p.getAttribute(name));if(arrays.some(a=>!a))continue;const data=new Float32Array(arrays.reduce((sum,a)=>sum+a.array.length,0));let at=0;for(const a of arrays){data.set(a.array,at);at+=a.array.length;}merged.setAttribute(name,new T.BufferAttribute(data,arrays[0].itemSize));}mesh(merged,material,group);parts.forEach(g=>g.dispose());}
 }
 const sky=new T.Mesh(new T.SphereGeometry(225,24,12),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{viewportHeight:{value:innerHeight}},
  vertexShader:'varying vec3 dir;void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform float viewportHeight;varying vec3 dir;void main(){vec3 d=normalize(dir);float h=pow(max(d.y,0.),.45);vec3 c=mix(vec3(.22,.48,.65),vec3(.035,.16,.36),h);c+=vec3(.16,.09,.035)*exp(-abs(d.y-.035)*18.);float sun=pow(max(dot(d,normalize(vec3(-.95,.14,-.14))),0.),180.);c+=vec3(1.,.69,.29)*sun*.9;gl_FragColor=vec4(c,1.);#include <tonemapping_fragment>\n#include <encodings_fragment>}`.replace(';#include',';\n#include') }));scene.add(sky);
 const holes=WHIRLPOOLS.map(h=>new T.Vector3(h.x,h.z,h.r+1.5));
 const shores=ISLANDS.map(i=>new T.Vector3(i.x,i.z,i.r));
 const seaMaterial=new T.ShaderMaterial({uniforms:{time:{value:0},holes:{value:holes},shores:{value:shores}},vertexShader:`
  uniform float time;varying vec3 world;varying vec3 waveNormal;
  void main(){vec3 p=position;float a=p.x*.17+p.y*.09+time*.9;float b=p.x*.08-p.y*.21-time*.7;
   float h=sin(a)*.23+sin(b)*.17;p.z+=h;
   vec3 n=normalize(vec3(-cos(a)*.0391-cos(b)*.0136,-cos(a)*.0207+cos(b)*.0357,1.));
   waveNormal=normalize(mat3(modelMatrix)*n);world=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
  fragmentShader:`uniform float time;uniform vec3 holes[2];uniform vec3 shores[4];varying vec3 world;varying vec3 waveNormal;
   void main(){for(int i=0;i<2;i++){if(length(world.xz-holes[i].xy)<holes[i].z-.04)discard;}vec3 n=normalize(waveNormal+vec3(sin(world.x*.83+world.z*.3+time)*.055,0.,cos(world.z*.72-world.x*.2-time)*.055));vec3 v=normalize(cameraPosition-world);vec3 l=normalize(vec3(-.65,1.,-.6));
    float f=pow(1.-max(dot(n,v),0.),3.);float spec=pow(max(dot(reflect(-l,n),v),0.),95.);
    float grain=sin(world.x*2.3+sin(world.z*1.7)+time*1.1)*cos(world.z*2.7-time*.8);
    float swell=sin(world.x*.17+world.z*.09+time*.9)+sin(world.x*.08-world.z*.21-time*.7)*.7;
    float lace=sin(world.x*.51+sin(world.z*.32+time*.34)*2.+time*.7)*sin(world.z*.68-world.x*.19-time*.53);
    vec3 c=mix(vec3(.008,.14,.23),vec3(.055,.39,.43),f*.65+.24+swell*.045);
    c+=vec3(.92,.87,.63)*spec*.95+vec3(.1,.28,.26)*grain*.035;
    float crest=smoothstep(1.28,1.65,swell)*smoothstep(.65,.96,lace);c=mix(c,vec3(.64,.87,.8),crest*.48);
    float glitter=pow(max(0.,grain),20.)*pow(max(dot(reflect(-l,n),v),0.),14.);c+=vec3(.9,.86,.63)*glitter*.4;
    for(int i=0;i<4;i++){float edge=length(world.xz-shores[i].xy)-shores[i].z;float shallow=(1.-smoothstep(0.,8.,edge))*.15;c=mix(c,vec3(.03,.27,.25),shallow);float froth=pow(.5+.5*sin(edge*5.-time*1.8+sin(world.x*.8)*.7),12.)*(1.-smoothstep(.4,2.7,abs(edge)));c=mix(c,vec3(.42,.62,.55),froth*.65);}
    float fog=smoothstep(185.,245.,length(cameraPosition-world));c=mix(c,vec3(.36,.61,.61),fog);gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
   }`});
 const water=mesh(new T.PlaneGeometry(600,600,mobile?96:128,mobile?96:128),seaMaterial,scene,0,-.34,0);water.rotation.x=-Math.PI/2;
 function ring(radius,color,parent=scene,width=.08,opacity=.5,y=.05){const m=mesh(new T.TorusGeometry(radius,width,4,mobile?48:80),basic(color,opacity),parent,0,y,0);m.rotation.x=Math.PI/2;return m;}
 ring(BOUNDARY,'#a3cbc2',scene,.1,.35);
 function palm(group,x,z,height,lean){const trunk=new T.Group();group.add(trunk);trunk.position.set(x,group.userData.island?reefHeightAt(group.userData.island,x,z)-group.position.y:0,z);trunk.rotation.z=lean;palms.push({root:trunk,lean});
  const bark=mat('#7c6741');rod(trunk,[0,0,0],[.5,height*.55,0],.32,bark,6);rod(trunk,[.5,height*.55,0],[.2,height,0],.22,bark,6);
  for(let j=0;j<8;j++){const a=j*Math.PI/4,g=new T.BufferGeometry(),verts=[],side=[-Math.sin(a),0,Math.cos(a)];
   const center=q=>[Math.cos(a)*q*4.2,height+Math.sin(q*Math.PI)*.9-q*1.4,Math.sin(a)*q*4.2];
   for(let k=0;k<10;k++){const q=.1+k*.08,p=center(q),tip=center(q+.13),w=Math.sin(q*Math.PI)*.72;
    for(const sign of [-1,1])verts.push(p[0],p[1],p[2],p[0]+side[0]*w*sign-Math.cos(a)*.28,p[1]-.13,p[2]+side[2]*w*sign-Math.sin(a)*.28,tip[0],tip[1],tip[2]);
   }
   g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.computeVertexNormals();mesh(g,j%2?leafMat:leafLight,trunk);
  }mergeStatic(trunk);
 }
 function islandTerrain(island){const radius=island.r;const p=[],colors=[],uv=[],indices=[],segments=64,rings=9;
  for(let row=0;row<=rings;row++)for(let j=0;j<=segments;j++){const a=j/segments*Math.PI*2,q=row/rings,edge=radius-.9+Math.sin(a*5+.3)*.55+Math.cos(a*9)*.3,r=edge*q,x=Math.sin(a)*r,z=Math.cos(a)*r;
   const y=reefHeightAt(island,x,z);
   p.push(x,y,z);uv.push(x*.15,z*.15);const tint=q>.82?new T.Color('#e8cc8e'):q>.57?new T.Color('#70838b'):new T.Color('#6d9855');tint.multiplyScalar(.92+Math.sin(x*3+z*2)*.055);colors.push(tint.r,tint.g,tint.b);
  }
  for(let row=0;row<rings;row++)for(let j=0;j<segments;j++){const a=row*(segments+1)+j,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
 }
 const terrainMat=mat('#ffffff',{vertexColors:true,side:T.DoubleSide,roughness:.95});
 const islandGroups=[];
 for(const [i,island]of ISLANDS.entries()){const group=new T.Group();group.position.set(island.x,0,island.z);scene.add(group);const landmarks=new T.Group();landmarks.position.y=island.h;landmarks.userData.island=island;group.add(landmarks);islandGroups.push(landmarks);
  mesh(islandTerrain(island),terrainMat,group);
  const fringe=ring(island.r+.7,'#bbe7d8',group,.28,.4,-.02);fringe.scale.y=.91;
  for(let j=0;j<5;j++){const a=j*2.3,r=mesh(new T.DodecahedronGeometry(3.2+j%2,1),j%2?rockLight:rockMat,landmarks,Math.sin(a)*4.8,1.5+Math.sin(j)*.5,Math.cos(a)*3.6);r.scale.set(1.25,.9+j*.09,1);r.rotation.set(j*.2,j,.2);}
  palm(landmarks,i?6:-5,2,7,i?.12:-.12);palm(landmarks,i?-4:3,-5,5.5,i?-.14:.16);palm(landmarks,-10,5,6.8,-.2);palm(landmarks,9,6,8.2,.16);palm(landmarks,5,-10,6.3,-.12);
  for(let j=0;j<24;j++){const a=j*2.399,r=10+(j%4)*1.4;const shrub=mesh(new T.SphereGeometry(.7+j%3*.2,7,5),j%2?leafMat:leafLight,group,Math.sin(a)*r,reefHeightAt(island,Math.sin(a)*r,Math.cos(a)*r)+.6,Math.cos(a)*r);shrub.scale.y=.6;}
 }
 for(let i=0;i<18;i++){const a=i*Math.PI*2/18;const r=mesh(new T.DodecahedronGeometry(3+i%3,1),i%2?rockMat:rockLight,scene,Math.sin(a)*(ARENA+7),.3,Math.cos(a)*(ARENA+7));r.scale.set(1.8,.35,1.3);r.rotation.y=a;}
 function pennant(parent,color,height=7,x=0,z=0){rod(parent,[x,0,z],[x,height,z],.09,brass);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([x,height,z,x+2.3,height-.4,z+.2,x+1.7,height-1,z,x,height-1.5,z],3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();mesh(g,basic(color),parent);}
 const wreck=new T.Group();scene.add(wreck);const wreckHull=mesh(hullGeometry(),darkWood,wreck,0,-1.1,0);wreckHull.rotation.z=.32;wreckHull.rotation.x=.12;wreckHull.scale.set(.85,.9,.9);
 rod(wreck,[-1,0,0],[1.7,5.5,1],.18,wood);for(let j=0;j<4;j++)mesh(new T.BoxGeometry(.35,1,3),wood,wreck,-2+j*1.1,1.6,1);ring(8,'#f6cd70',wreck,.08,.35);
 const flag=new T.Group();scene.add(flag);pennant(flag,'#ffd26c',9);const halo=ring(2,'#ffdc86',flag,.14,.75);
 mesh(new T.SphereGeometry(.43,8,6),basic('#342e2b'),flag,.9,8.3,.16);mesh(new T.BoxGeometry(.55,.4,.07),basic('#342e2b'),flag,.9,7.95,.18);for(const x of [.74,1.06])mesh(new T.SphereGeometry(.1,5,4),basic('#ffe3a0'),flag,x,8.3,.55);
 function hullGeometry(){
  const outline=[[-4.6,1.5],[-3.6,2.1],[-1.8,2.35],[1.6,2.1],[3.8,1.15],[5.2,.035]],curve=new T.CatmullRomCurve3(outline.map(([z,w])=>new T.Vector3(w,0,z))),p=[],uv=[],indices=[],rows=32,cross=12;
  for(let row=0;row<=rows;row++){const point=curve.getPoint(row/rows),w=Math.max(.035,point.x);for(let k=0;k<=cross;k++){const a=-Math.PI/2+k/cross*Math.PI;p.push(Math.sin(a)*w,2-Math.cos(a)*2.3,point.z);uv.push((point.z+4.6)/5,(2-Math.cos(a)*2.3)*.5);}}
  for(let row=0;row<rows;row++)for(let k=0;k<cross;k++){const a=row*(cross+1)+k,b=a+cross+1;indices.push(a,a+1,b,b,a+1,b+1);}
  const center=p.length/3;p.push(0,1,-4.6);uv.push(.5,.5);for(let k=0;k<cross;k++)indices.push(center,k+1,k);indices.push(center,0,cross);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
 }
 const hullGeo=hullGeometry();
 const deckShape=new T.Shape();deckShape.moveTo(-1.5,-4.6);deckShape.lineTo(-2.1,-3.6);deckShape.lineTo(-2.35,-1.8);deckShape.lineTo(-2.1,1.6);deckShape.lineTo(-1.15,3.8);deckShape.lineTo(0,5.2);deckShape.lineTo(1.15,3.8);deckShape.lineTo(2.1,1.6);deckShape.lineTo(2.35,-1.8);deckShape.lineTo(2.1,-3.6);deckShape.lineTo(1.5,-4.6);deckShape.closePath();
 const deckGeo=new T.ShapeGeometry(deckShape);deckGeo.rotateX(Math.PI/2);const deckUV=deckGeo.attributes.uv;for(let i=0;i<deckUV.count;i++){deckUV.setXY(i,deckUV.getX(i)*.2,deckUV.getY(i)*.2);}
 const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;const glowCtx=glowCanvas.getContext('2d'),radial=glowCtx.createRadialGradient(32,32,0,32,32,32);radial.addColorStop(0,'#ffffff');radial.addColorStop(.25,'#ffffffcc');radial.addColorStop(1,'#ffffff00');glowCtx.fillStyle=radial;glowCtx.fillRect(0,0,64,64);const glowTexture=new T.CanvasTexture(glowCanvas);
 const flagGlow=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color:'#ffcb69',transparent:true,opacity:.22,depthWrite:false,blending:T.AdditiveBlending}));flagGlow.position.y=8;flagGlow.scale.set(6,6,1);flag.add(flagGlow);
 const scenery=createScenery(T,scene,islandGroups,sky,glowTexture,mobile,mergeStatic);
 const ships=new Map(),buoys=new Map(),projectiles=[],pickups=[],effects=[];
 let localId='',follow=false,shake=0;
 const worldLabels=[];const labelPosition=new T.Vector3();
 function worldLabel(text,parent,y,width=14){const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d');g.fillStyle='#092a35dd';g.fillRect(2,9,252,46);g.strokeStyle='#dfba69';g.strokeRect(2,9,252,46);g.fillStyle='#ffe3a2';g.font='bold 18px system-ui';g.textAlign='center';g.fillText(text,128,39);const texture=new T.CanvasTexture(c);texture.encoding=T.sRGBEncoding;const label=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false,fog:false}));label.position.y=y;label.scale.set(width,width/4,1);parent.add(label);label.userData.baseWidth=width;worldLabels.push(label);return label;}
 worldLabel('SKULL FLAG',flag,11.5,11);
 function hullHealth(s){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=80;const g=canvas.getContext('2d');
  const texture=new T.CanvasTexture(canvas);texture.encoding=T.sRGBEncoding;
  const label=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false,fog:false}));scene.add(label);
  label.userData={baseWidth:14,pixelWidth:112,ratio:3.2};worldLabels.push(label);let last='';
  return {dispose(){scene.remove(label);worldLabels.splice(worldLabels.indexOf(label),1);texture.dispose();label.material.dispose();},hide(){label.visible=false;},update(ship,y,localTeam){label.visible=!ship.dead&&!ship.eliminated&&ship.id!==localId;label.position.set(ship.x,y+15.2,ship.z);const hp=Math.ceil(Math.max(0,Math.min(ship.maxHp||100,ship.hp)));const relation=localTeam===undefined?'':ship.team===localTeam?'ALLY · ':'ENEMY · ';const key=`${hp}:${ship.name}:${ship.color}:${relation}`;if(key===last)return;last=key;
   g.clearRect(0,0,256,80);g.fillStyle='#071e29ee';g.fillRect(0,0,256,80);g.strokeStyle=ship.teamColor||ship.color;g.lineWidth=2;g.strokeRect(1,1,254,78);
   g.textAlign='left';g.fillStyle='#fff0cf';g.font='bold 22px system-ui';g.fillText(relation+ship.name,12,29,174);g.textAlign='right';g.font='bold 21px system-ui';g.fillText(String(hp),244,29);
   g.fillStyle='#253d46';g.fillRect(12,44,232,22);g.fillStyle=hp>55?'#7ad9ac':hp>25?'#f4c764':'#ff897e';g.fillRect(12,44,232*hp/(ship.maxHp||100),22);texture.needsUpdate=true;
  }};
 }
 function makeShip(s){const root=new T.Group();scene.add(root);const details=new T.Group();root.add(details);const guns=[];
  const trim=mat(s.color,{roughness:.5}),sailMaterial=mat(s.raider?'#8c7774':SAILS[s.loadout?.sail]||'#fff4d4',{map:fabric,side:T.DoubleSide,roughness:.95});
  const hullMaterial=s.loadout?mat(new T.Color(s.loadout.paint).lerp(new T.Color('#e7c49a'),.25),{map:grain}):wood;const hull=mesh(hullGeo.clone(),hullMaterial,root);const shadow=mesh(new T.CircleGeometry(1,24),basic('#031419',.18),root,0,-.035,0);shadow.rotation.x=-Math.PI/2;shadow.scale.set(2.8,5.4,1);mesh(deckGeo.clone(),deckMat,details,0,2,0);
  // Carved stern galleries, brass scrollwork, rail balusters and deck equipment.
  for(const side of [-1,1]){
   for(let j=0;j<12;j++){const z=-3.9+j*.7,w=z< -2?1.9:z<1.5?2.16:Math.max(.55,2.16-(z-1.5)*.43);rod(details,[side*w,2.1,z],[side*w,2.65,z],.045,brass,5);}
   const gallery=mesh(new T.TorusGeometry(.7,.065,5,16,Math.PI*1.6),brass,details,side*1.5,2.8,-4.5);gallery.rotation.y=Math.PI;
   rod(details,[side*1.8,3.8,-4.3],[side*1.8,4.3,-4.3],.07,brass);rod(details,[side*1.8,4.3,-4.3],[side*.3,4.3,-4.3],.07,brass);
   for(let j=0;j<3;j++){const z=-2.4+j*1.1;mesh(new T.BoxGeometry(.16,.6,.75),trim,details,side*2.24,1.4,z);}
  }
  for(const x of [-1,0,1]){mesh(new T.BoxGeometry(.66,.8,.12),brass,details,x,3.05,-4.42);mesh(new T.BoxGeometry(.49,.62,.14),mat('#377e83',{emissive:'#2b5454',emissiveIntensity:.35}),details,x,3.05,-4.5);rod(details,[x,2.75,-4.6],[x,3.34,-4.6],.035,brass);}
  const barrelWood=mat('#ad7e49',{map:grain});for(const z of [-1.8,-.8]){mesh(new T.CylinderGeometry(.38,.34,.8,10),barrelWood,details,-1.1,2.42,z);for(const y of [2.16,2.64]){const band=mesh(new T.TorusGeometry(.37,.035,4,10),iron,details,-1.1,y,z);band.rotation.x=Math.PI/2;}}
  mesh(new T.BoxGeometry(1,.18,1.5),iron,details,.5,2.12,-.3);for(let j=0;j<5;j++)rod(details,[0,2.23,-.9+j*.3],[1,2.23,-.9+j*.3],.025,brass);
  if(s.loadout?.part==='armor')for(const side of [-1,1])for(let j=0;j<5;j++){const z=-3+j*1.3;mesh(new T.BoxGeometry(.17,.72,1.12),iron,details,side*(z>2?1.5:2.15),1.1,z);for(const y of [.87,1.32])mesh(new T.SphereGeometry(.065,5,4),brass,details,side*2.26,y,z);}
  if(s.loadout?.part==='ram'){const prow=mesh(new T.ConeGeometry(.65,3.5,8),brass,details,0,1,6.3);prow.rotation.x=Math.PI/2;rod(details,[-.9,1.1,4.4],[0,1,7.8],.13,iron);rod(details,[.9,1.1,4.4],[0,1,7.8],.13,iron);}
  if(s.loadout?.part==='swift')for(const side of [-1,1]){const wing=new T.BufferGeometry();wing.setAttribute('position',new T.Float32BufferAttribute([side*.4,3.4,2,side*3.8,4,1,side*.6,8,2],3));wing.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1],2));wing.computeVertexNormals();mesh(wing,sailMaterial,details);}
  if(s.weapons)for(const side of [-1,1]){const collar=mat(WEAPONS[s.weapons[side===1?1:2]].color,{metalness:.45,emissive:WEAPONS[s.weapons[side===1?1:2]].color,emissiveIntensity:.2});for(const z of [-2.5,-.5,1.5]){const band=mesh(new T.TorusGeometry(.24,.055,5,10),collar,details,side*2.6,2.3,z);band.rotation.y=Math.PI/2;}}
  // Raised stern, colored gunwales and brass-rimmed cabin windows.
  mesh(new T.BoxGeometry(2.5,1.6,2.1),darkWood,details,0,2.8,-3.25);mesh(new T.BoxGeometry(2.9,.2,2.6),trim,details,0,3.65,-3.25);
  for(const x of [-.7,.7]){mesh(new T.BoxGeometry(.65,.55,.08),brass,details,x,2.9,-4.34);mesh(new T.BoxGeometry(.43,.35,.09),mat('#4fabb1',{emissive:'#305350',emissiveIntensity:.3}),details,x,2.9,-4.39);}
  for(const side of [-1,1]){
   const outline=[[-4.45,1.5],[-3.6,2.1],[-1.8,2.35],[1.6,2.1],[3.8,1.15],[5.1,.04]];
   for(let j=0;j<outline.length-1;j++){const [z,w]=outline[j],[nz,nw]=outline[j+1];rod(details,[w*side,2.15,z],[nw*side,2.15,nz],.13,trim);rod(details,[w*side*.97,1.1,z],[nw*side*.97,1.1,nz],.065,brass);}
   for(const [index,z] of [-2.5,-.5,1.5].entries()){const gunGroup=new T.Group();root.add(gunGroup);mesh(new T.BoxGeometry(.7,.65,.8),darkWood,details,side*2,1.45,z);rod(gunGroup,[side*1.6,2.3,z],[side*2.8,2.3,z],.22,iron,12);const mouth=mesh(new T.CircleGeometry(.17,12),barrelMouth,gunGroup,side*2.83,2.3,z);mouth.rotation.y=side*Math.PI/2;mergeStatic(gunGroup);guns.push({root:gunGroup,side,index});}
   for(const z of [-3,-1,1]){rod(details,[side*1.9,2.1,z],[side*.07,8.9,.3],.033);}
  }
  rod(details,[0,1.8,4.4],[0,3.1,7],.11,wood);rod(details,[0,3.1,7],[0,9.5,.3],.035);rod(details,[0,2,-4],[0,9.5,.3],.035);
  rod(details,[0,2,.3],[0,10.1,.3],.17,wood,8);rod(details,[-2.9,8.8,.3],[2.9,8.8,.3],.10,darkWood,7);rod(details,[-2.4,4.6,.3],[2.4,4.6,.3],.08,darkWood);
  pennant(details,s.teamColor||s.color,10.5,0,.3);
  // Curved and tapered sail, with seams in a small locally generated texture.
  const sailGeo=new T.PlaneGeometry(5.4,4.1,8,5),pos=sailGeo.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),v=(y+2.05)/4.1;pos.setX(i,x*(.82+.18*v));pos.setZ(i,Math.cos(x/2.7*Math.PI/2)*Math.sin(v*Math.PI)*1.05);}
  sailGeo.computeVertexNormals();const sail=mesh(sailGeo,sailMaterial,root,0,6.65,.42);
  rod(details,[0,9.8,.3],[0,13,.3],.10,wood,8);rod(details,[-2.1,12.6,.3],[2.1,12.6,.3],.07,darkWood);rod(details,[-1.7,10.4,.3],[1.7,10.4,.3],.07,darkWood);
  const topGeo=new T.PlaneGeometry(3.9,2.1,6,4),topPos=topGeo.attributes.position;for(let j=0;j<topPos.count;j++){const x=topPos.getX(j),y=topPos.getY(j);topPos.setX(j,x*(.85+.15*(y+1.05)/2.1));topPos.setZ(j,Math.cos(x/1.95*Math.PI/2)*.48);}topGeo.computeVertexNormals();mesh(topGeo,sailMaterial,details,0,11.5,.35);
  for(const side of [-1,1])rod(details,[side*1.9,2.2,-2],[0,12.8,.3],.025);
  const bowSail=new T.BufferGeometry();bowSail.setAttribute('position',new T.Float32BufferAttribute([0,8.8,.9,0,3.2,6.5,0,3.9,1.7],3));bowSail.setAttribute('uv',new T.Float32BufferAttribute([0,1,1,0,0,0],2));bowSail.computeVertexNormals();mesh(bowSail,sailMaterial,details);
  // Crossed bones are small enough to remain readable without a texture download.
  const emblem=basic(s.raider?'#eddac1':'#635039');rod(details,[-.35,6.1,1.48],[.35,6.7,1.48],.05,emblem);rod(details,[.35,6.1,1.48],[-.35,6.7,1.48],.05,emblem);
  mesh(new T.BoxGeometry(.2,1.3,.8),darkWood,details,0,.25,-4.8);
  const wheel=mesh(new T.TorusGeometry(.43,.07,5,12),wood,details,0,3.95,-2.4);wheel.rotation.x=.3;
  mergeStatic(details);
  const wake=new T.Group();root.add(wake);for(const side of [-1,1])for(let j=0;j<3;j++)rod(wake,[side*(1.5+j*.5),-.15,-3-j],[side*(3.1+j*.5),-.15,-9-j*1.4],.055,foamMat,4);mergeStatic(wake);
  const selected=ring(3.7,s.id===localId?'#f6db92':s.teamColor||s.color,root,.045,s.id===localId?.45:.18,-.1);
  const carrier=new T.Group();root.add(carrier);pennant(carrier,'#ffda69',12.5,.25,0);carrier.visible=false;worldLabel('FLAG CARRIER',carrier,18.8,13);
  const cannonFX=[];for(const side of [1,-1])for(const [index,z] of [-2.5,-.5,1.5].entries()){const flash=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color:'#ffd394',transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));flash.position.set(side*3,2.3,z);root.add(flash);const smoke=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color:'#9da9a2',transparent:true,opacity:0,depthWrite:false}));smoke.position.copy(flash.position);root.add(smoke);cannonFX.push({side,index,flash,smoke});}
  const arcs=[];for(const side of [1,-1]){const g=new T.RingGeometry(6,23,24,1,(side===1?0:Math.PI)-.32,.64);g.rotateX(-Math.PI/2);const arc=mesh(g,basic('#e3cf8e',.06),root,0,.12,0);arcs.push({side,mesh:arc});}
  const spawnShield=mesh(new T.SphereGeometry(5,14,10),basic(s.teamColor||'#82d8ed',.08),root,0,3.7,0);spawnShield.scale.y=1.2;spawnShield.visible=false;
  const statusGlow=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color:'#ff843c',transparent:true,opacity:.55,depthWrite:false,blending:T.AdditiveBlending}));statusGlow.position.set(0,3,-2);statusGlow.scale.set(5,5,1);root.add(statusGlow);statusGlow.visible=false;
  return {root,hull,hullMaterial,sail,wake,selected,carrier,statusGlow,spawnShield,appearance:JSON.stringify([s.loadout,s.color,s.team]),health:hullHealth(s),guns,cannonFX,arcs,fireSide:1,fireGun:0,flashLife:0,smokeLife:0,sprayAt:0,baseSail:sailGeo.attributes.position.array.slice()};
 }
 const sharedMaterials=new Set([wood,deckMat,darkWood,iron,brass,ropeMat,foamMat,barrelMouth]);
 function disposeShip(o){o.health.dispose();const materials=new Set();if(o.hullMaterial!==wood)materials.add(o.hullMaterial);o.root.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.material&&!sharedMaterials.has(n.material))materials.add(n.material);const i=worldLabels.indexOf(n);if(i>=0){worldLabels.splice(i,1);n.material.map?.dispose();}});materials.forEach(m=>m.dispose());scene.remove(o.root);}
 const raidScenery=createRaidScenery(T,scene,mergeStatic);
 const docks=new Map();const forge=new T.Group();scene.add(forge);const treasureMat=mat('#e9b34d',{metalness:.6,roughness:.35}),forgeGem=mesh(new T.OctahedronGeometry(2.4),treasureMat,forge,0,5,0);ring(12,'#f1cb76',forge,.09,.65);for(let j=0;j<7;j++)mesh(new T.CylinderGeometry(1.1,1.1,.35,14),treasureMat,forge,Math.sin(j*2.4)*3,.3+j*.16,Math.cos(j*2.4)*3);worldLabel('CROWNFALL TEMPLE',forge,10,20);
 const projectileMaterials=Object.fromEntries(Object.entries(WEAPONS).map(([k,v])=>[k,mat(v.color,{emissive:v.color,emissiveIntensity:k==='ball'?.05:.5,metalness:.4,roughness:.4})]));
 const routePoints=new Float32Array(6),routeGeo=new T.BufferGeometry();routeGeo.setAttribute('position',new T.BufferAttribute(routePoints,3));
 const route=new T.Line(routeGeo,new T.LineDashedMaterial({color:'#eec979',dashSize:1.4,gapSize:2,transparent:true,opacity:.42,depthWrite:false}));scene.add(route);
 const currents=new T.Group();scene.add(currents);
 for(let i=0;i<14;i++){const a=i*Math.PI/7;const arrow=new T.ArrowHelper(new T.Vector3(-Math.cos(a),0,Math.sin(a)),new T.Vector3(Math.sin(a)*82,-.1,Math.cos(a)*82),3.5,0x83c5c4,1,.65);arrow.line.material.transparent=true;arrow.line.material.opacity=.28;arrow.cone.material.transparent=true;arrow.cone.material.opacity=.28;currents.add(arrow);}
 const whirl=[createWhirlpool(T,mobile),createWhirlpool(T,mobile)];
 whirl.forEach((h,i)=>{scene.add(h.root);h.update(0,holes[i].x,holes[i].y,i?-1:1);});
 const birds=[];const birdMaterial=basic('#bccbcc');for(let i=0;i<(mobile?2:4);i++){const root=new T.Group();const wings=[];for(const side of [-1,1]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,side*1.2,0,-.25,side*.15,0,.23],3));g.computeVertexNormals();const wing=mesh(g,birdMaterial,root);wings.push(wing);}scene.add(root);birds.push({root,wings});}
 const particleGeometry=new T.IcosahedronGeometry(.3,0),particleMaterial=basic('#f5e3ba');
 const capacity=mobile?64:160,particles=new T.InstancedMesh(particleGeometry,particleMaterial,capacity);scene.add(particles);particles.count=0;
 const combatFX=createCombatEffects(T,scene,mobile,reduced);
 const dummy=new T.Object3D(),sprayColor=new T.Color('#bfdfd8'),sparkColor=new T.Color('#ffce7a');
 function burst(x,z,color,count=8,impact=true){for(let i=0;i<count&&effects.length<capacity;i++){const a=Math.random()*Math.PI*2;effects.push({x,z,y:2,vx:Math.sin(a)*5,vz:Math.cos(a)*5,vy:5+Math.random()*4,t:.7,color:color?new T.Color(color):sparkColor});}const local=ships.get(localId)?.root.position;if(impact&&!reduced&&local&&Math.hypot(x-local.x,z-local.z)<24)shake=Math.max(shake,.08);}
 function event(type,s,side,kind,gunIndex){const o=ships.get(s.id);if(!o)return;if(type==='fire'){o.fireSide=side===-1?-1:1;o.fireGun=gunIndex??s.fireGun??0;o.fireKind=kind||s.fireKind||'ball';o.flashLife=.14;o.smokeLife=.65;const z=[-2.5,-.5,1.5][o.fireGun];burst(s.x+Math.cos(s.a)*o.fireSide*3+Math.sin(s.a)*z,s.z-Math.sin(s.a)*o.fireSide*3+Math.cos(s.a)*z,s.color,2,false);}if(type==='boost'||type==='ram')burst(s.x-Math.sin(s.a)*4,s.z-Math.cos(s.a)*4,s.color,6);}

 function worldEvent(e,w,me){const ship=w.ships.find(s=>s.id===e.id),team=w.teams?.[e.by],local=w.ships.find(s=>s.id===me),color=WEAPONS[e.kind]?.color||ship?.teamColor||'#ffe0a0';
  if(e.type==='hit'&&ship){combatFX.ring(ship.x,ship.z,color,4,.45);combatFX.label(`−${Math.round(e.damage||1)}`,ship.x,ship.z,ship.id===me?'#ffab8e':'#fff0b0',ship.height||0);}
  if(e.type==='structurehit')combatFX.label(`−${Math.round(e.damage)}`,e.x,e.z,team?.color||'#ffe0a0',team?.height||0);
  if(e.type==='turretbroken'){combatFX.label('DESTROYED',e.x,e.z,'#ffbc7a',team?.height||0);burst(e.x,e.z,'#ffbc7a',18);}
  if(e.type==='shieldhit'){combatFX.ring(e.x,e.z,team?.color||'#8eefff',5,.5);burst(e.x,e.z,team?.color,6,false);}
  if(e.type==='corehit'&&team){combatFX.ring(team.x,team.z,team.color,10,.65);burst(team.x,team.z,team.color,8,false);}
  if(e.type==='corebroken'&&team){combatFX.ring(team.x,team.z,'#ffcb79',22,1.3);burst(team.x,team.z,team.color,22);}
  if(e.type==='goal'){combatFX.ring(e.x??ship?.x??0,e.z??ship?.z??0,ship?.teamColor,18,1.1);if(e.x!==undefined)burst(e.x,e.z,ship?.teamColor,18,false);}
  if(e.type==='respawn'&&ship){combatFX.ring(ship.x,ship.z,ship.teamColor,10,.9);combatFX.label('REBUILT',ship.x,ship.z,'#9cebd4');}
  if(e.type==='purchase'&&ship?.id===me){combatFX.ring(ship.x,ship.z,'#ffe29e',8,.7);combatFX.label('UPGRADED',ship.x,ship.z);}
  if(e.type==='bank'&&ship&&(e.pearls||e.relics||e.gold>=8)){combatFX.ring(ship.x,ship.z,'#a5f0cf',10,.8);if(ship.id===me)combatFX.label('TREASURE BANKED',ship.x,ship.z,'#a5f0cf');}
  if(e.type==='collect'&&ship?.id===me)combatFX.label(`+${e.amount} ${e.kind.toUpperCase()}`,ship.x,ship.z,e.kind==='relics'?'#d5b4ff':'#a5f0cf');
  if(e.type==='terrainhit')burst(e.x,e.z,'#91b5bd',3,false);
  if(e.type==='gold'&&ship?.id===me)combatFX.label('GOLD ABOARD',ship.x,ship.z);
  if(e.type==='defenseend')for(const t of w.teams||[])combatFX.ring(t.x,t.z,t.color,26,1.3);
 }
 const lootPool=[],fieldPool=[],nodeMarkers=[];
 const resourceMats={gold:mat('#ffd16a',{metalness:.7,roughness:.3}),pearls:mat('#a6f4df',{emissive:'#387e79',emissiveIntensity:.35,roughness:.18}),relics:mat('#bd91fa',{emissive:'#8b4cb9',emissiveIntensity:.45,metalness:.4,roughness:.25})};
 const beacon=ring(20,'#ceabff',scene,.35,.8,.25);beacon.visible=false;
 const stormRing=ring(100,'#ff9a76',scene,.3,.8,.3);stormRing.visible=false;
 function resourceVisuals(w){
  for(let i=0;i<(w.loot?.length||0);i++){const p=w.loot[i];let o=lootPool[i];if(!o){o=new T.Group();for(const kind of ['gold','pearls','relics']){const g=kind==='gold'?new T.CylinderGeometry(1.6,1.6,.55,12):kind==='pearls'?new T.SphereGeometry(1.4,12,8):new T.OctahedronGeometry(1.9);const shape=mesh(g,resourceMats[kind],o,0,1,0);shape.userData.kind=kind;}ring(3,'#f5e8c5',o,.06,.45);scene.add(o);lootPool.push(o);}o.visible=true;o.position.set(p.x,reduced?.2:.2+Math.sin(w.t*2+p.id)*.25,p.z);o.rotation.y=reduced?0:w.t*.5;for(const c of o.children)if(c.userData.kind)c.visible=c.userData.kind===p.kind;
  }for(let i=w.loot?.length||0;i<lootPool.length;i++)lootPool[i].visible=false;
  for(let i=0;i<(w.nodes?.length||0);i++){const n=w.nodes[i];let o=nodeMarkers[i];if(!o){o=new T.Group();scene.add(o);ring(n.kind==='relics'?13:8,n.kind==='relics'?'#c6a1ff':'#8de9df',o,.13,.6);const label=worldLabel(n.name.toUpperCase(),o,7,18);nodeMarkers.push(o);o.userData.label=label;}o.visible=!!w.rules;o.position.set(n.x,.05,n.z);const sec=Math.ceil(n.next),label=o.userData.label;if(o.userData.sec!==sec){o.userData.sec=sec;const c=label.material.map.image,g=c.getContext('2d');g.clearRect(0,0,256,64);g.fillStyle='#092a35eb';g.fillRect(0,0,256,64);g.fillStyle=n.kind==='relics'?'#d7baff':'#a3eee1';g.textAlign='center';g.font='bold 14px system-ui';g.fillText(n.name.toUpperCase(),128,24);g.font='bold 18px system-ui';g.fillText(`${n.kind==='relics'?'RELICS':'PEARLS'} IN ${sec}s`,128,49);label.material.map.needsUpdate=true;}}
  if(!w.rules)for(const o of nodeMarkers)o.visible=false;
  for(let i=0;i<(w.fields?.length||0);i++){const f=w.fields[i];let o=fieldPool[i];if(!o){o=new T.Group();const smoke=new T.Group();for(let j=0;j<5;j++)mesh(new T.SphereGeometry(4.7,10,7),basic('#9db7b7',.27),smoke,Math.sin(j*2.4)*5,2+j%2,Math.cos(j*2.4)*5);o.add(smoke);const decoy=new T.Group();mesh(new T.CylinderGeometry(1.5,2,2,10),brass,decoy,0,1,0);pennant(decoy,'#f3b6fc',6);o.add(decoy);scene.add(o);fieldPool.push(o);}o.visible=true;o.children[0].visible=f.kind==='smoke';o.children[1].visible=f.kind==='decoy';o.position.set(f.x,0,f.z);}
  for(let i=w.fields?.length||0;i<fieldPool.length;i++)fieldPool[i].visible=false;
  beacon.visible=!!w.overtime?.active;beacon.material.opacity=reduced?.7:.55+Math.sin(w.t*2)*.15;
  stormRing.visible=(w.overtime?.finalWater||0)>0;if(stormRing.visible)stormRing.scale.setScalar(Math.max(22,100-w.overtime.finalWater*2.6)/100);
 }
 const desired=new T.Vector3(),look=new T.Vector3(),desiredLook=new T.Vector3();let cameraHeading=0;
 function resize(){sky.material.uniforms.viewportHeight.value=innerHeight;renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
 addEventListener('resize',resize);resize();camera.position.set(30,40,55);camera.lookAt(0,0,0);
 function draw(w,me,dt){resourceVisuals(w);localId=me;seaMaterial.uniforms.time.value=reduced?0:w.t||0;
  for(const [id,o]of ships)if(!w.ships.some(s=>s.id===id)){disposeShip(o);ships.delete(id);if(buoys.has(id))buoys.get(id).visible=false;}
  for(const s of w.ships){let o=ships.get(s.id);if(o&&o.appearance!==JSON.stringify([s.loadout,s.color,s.team])){disposeShip(o);ships.delete(s.id);o=null;}if(!o){o=makeShip(s);ships.set(s.id,o);}const time=w.t||0,pose=shipPose(s,time,reduced);o.health.update(s,pose.y,w.ships.find(p=>p.id===me)?.team);const observer=w.ships.find(p=>p.id===me),concealed=observer&&observer.team!==s.team&&inSmoke(w,s)&&Math.hypot(observer.x-s.x,observer.z-s.z)>12;o.root.visible=pose.visible&&!s.eliminated&&!concealed;if(concealed)o.health.hide();o.root.position.set(s.x,o.root.position.y+(pose.y-o.root.position.y)*(1-Math.exp(-dt*12)),s.z);o.root.rotation.y=s.a;o.root.scale.setScalar(o.root.scale.x+(pose.scale-o.root.scale.x)*(1-Math.exp(-dt*12)));o.root.rotation.z+=(pose.roll-o.root.rotation.z)*(1-Math.exp(-dt*8));o.root.rotation.x+=(pose.pitch-o.root.rotation.x)*(1-Math.exp(-dt*8));
   o.carrier.visible=s.id===w.flag.carrier;const loaded=cargoCount(s);if(!o.cargo){o.cargo=new T.Group();o.root.add(o.cargo);for(let i=0;i<3;i++){const crate=mesh(new T.BoxGeometry(1.4,1.2,1.3),brass,o.cargo,(i-1)*1.45,2.8,-2.8);mesh(new T.BoxGeometry(.15,1.3,1.4),iron,crate);}}o.cargo.visible=loaded>0;for(let i=0;i<3;i++)o.cargo.children[i].visible=loaded>i*holdCapacity(s)/3;o.wake.visible=Math.abs(s.v)>2;o.wake.scale.z=.6+Math.abs(s.v)*.05;o.sail.rotation.y=reduced?0:Math.sin(time*2)*.025;o.hull.material=s.hp<35?darkWood:o.hullMaterial;o.spawnShield.visible=!s.dead&&s.shield>0;o.spawnShield.material.opacity=.04+Math.min(1,s.shield)*.07;o.statusGlow.visible=!s.dead&&(s.burn>0||s.sticky>0||s.jam>0);o.statusGlow.material.color.set(s.burn>0?'#ff843c':s.sticky>0?'#9ee879':'#6fe4ff');o.statusGlow.material.opacity=.35+Math.sin(time*12)*.15;
   if(!reduced){const p=o.sail.geometry.attributes.position;for(let j=0;j<p.count;j++){const at=j*3,edge=Math.abs(o.baseSail[at])/2.7;p.array[at+2]=o.baseSail[at+2]+Math.sin(time*4.2+o.baseSail[at]*1.7+o.baseSail[at+1])*edge*.055;}p.needsUpdate=true;}
   o.flashLife=Math.max(0,o.flashLife-dt);o.smokeLife=Math.max(0,o.smokeLife-dt);for(const fx of o.cannonFX){const active=fx.side===o.fireSide&&fx.index===o.fireGun;fx.flash.material.color.set(WEAPONS[o.fireKind]?.color||'#ffd394');fx.flash.visible=active&&o.flashLife>0;fx.smoke.visible=active&&o.smokeLife>0;fx.flash.material.opacity=o.flashLife/.14*.8;fx.flash.scale.setScalar(.8+o.flashLife*13);fx.smoke.material.opacity=o.smokeLife/.65*.28;fx.smoke.scale.setScalar(.8+(1-o.smokeLife/.65)*2.4);fx.smoke.position.y=2.3+(1-o.smokeLife/.65)*1.6;}for(const gun of o.guns)gun.root.position.x=gun.side===o.fireSide&&gun.index===o.fireGun?-gun.side*o.flashLife*1.2:0;for(const arc of o.arcs){arc.mesh.visible=s.id===me&&!s.dead&&s.whirl<0;const aim=broadsideAim(s,w.ships,arc.side,w);arc.mesh.material.opacity=aim.target?.14:.045;arc.mesh.material.color.set(aim.target?'#f9d778':'#8bbdc4');}

   if(!s.dead&&Math.abs(s.v)>7&&time-o.sprayAt>.15&&(s.id===me||!mobile)){o.sprayAt=time;for(const side of [-1,1])if(effects.length<capacity)effects.push({x:s.x+Math.sin(s.a)*3+Math.cos(s.a)*side*2,z:s.z+Math.cos(s.a)*3-Math.sin(s.a)*side*2,y:.4,vx:Math.cos(s.a)*side*2,vz:-Math.sin(s.a)*side*2,vy:2.6,t:.4,color:sprayColor});}
   if(!s.raider&&!w.rules&&!w.preview){let b=buoys.get(s.id);if(!b){b=new T.Group();scene.add(b);ring(12,s.id===me?'#ffe1a1':s.color,b,.10,s.id===me?.7:.28,-.05);
    mesh(new T.CylinderGeometry(.8,1.15,1.5,12),brass,b,0,.5,0);pennant(b,s.id===me?'#ffe0a1':s.color,3.6);if(s.id===me)b.userData.label=worldLabel('YOUR STASH · HOLD 2s',b,7,15);ring(1.3,'#d7e6d9',b,.04,.3);buoys.set(s.id,b);}const p=buoy(s);b.visible=true;b.position.set(p.x,0,p.z);if(b.userData.label)b.userData.label.visible=w.flag.carrier===me;}
  }
  w.pickups.forEach((p,i)=>{let m=pickups[i];if(!m){m=new T.Group();const color=p.kind==='repair'?'#79cca6':p.kind==='gold'?'#ffd15e':'#b9b6e0';mesh(new T.BoxGeometry(2,1.6,1.8),wood,m);for(const x of [-.7,.7])mesh(new T.BoxGeometry(.15,1.7,1.9),brass,m,x,0,0);mesh(new T.BoxGeometry(1,.9,.08),basic(color),m,0,0,.94);if(p.kind==='repair'){mesh(new T.BoxGeometry(.18,.6,.09),basic('#eaffdf'),m,0,0,1);mesh(new T.BoxGeometry(.6,.18,.09),basic('#eaffdf'),m,0,0,1);}scene.add(m);pickups[i]=m;}m.visible=p.cooldown<=0;m.position.set(p.x,.8+Math.sin((w.t||0)*2+i)*.12,p.z);m.rotation.y=(w.t||0)*.18;});
  w.shots.forEach((p,i)=>{let m=projectiles[i];if(!m){m=mesh(new T.SphereGeometry(.4,10,8),iron,scene);const trail=mesh(new T.CylinderGeometry(.045,.12,2.3,5),basic('#f8ddb1',.4),m,0,0,-1.3);trail.rotation.x=Math.PI/2;m.userData.trail=trail;const glow=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color:'#ff9e50',transparent:true,opacity:.5,depthWrite:false,blending:T.AdditiveBlending}));glow.scale.set(2,2,1);m.add(glow);m.userData.glow=glow;projectiles[i]=m;}m.visible=true;m.material=projectileMaterials[p.kind]||iron;m.scale.setScalar(p.kind==='heavy'?1.45:1);m.position.set(p.x,p.y??2.1,p.z);m.rotation.y=p.a;const shotColor=WEAPONS[p.kind]?.color||(p.kind==='sentry'?'#88e7ff':'#f7dfac');m.userData.trail.material.color.set(shotColor);m.userData.glow.material.color.set(shotColor);m.userData.glow.visible=['fire','shock','sentry'].includes(p.kind);});for(let i=w.shots.length;i<projectiles.length;i++)projectiles[i].visible=false;
  wreck.visible=!w.rules&&!w.preview;forge.visible=!!w.rules;forge.position.y=0;forgeGem.visible=(w.forge?.bank||0)>0||w.overtime?.active;raidScenery.update(reduced?0:w.t||0,!!w.rules);forgeGem.rotation.y=reduced?0:(w.t||0)*.7;forgeGem.position.y=5+(reduced?0:Math.sin((w.t||0)*2)*.4);forgeGem.material.emissive.set(w.forge?.contested?'#e56f45':'#8b5a0f');forgeGem.material.emissiveIntensity=.4;
  for(const [id,b]of buoys)if(w.rules||w.preview)b.visible=false;for(const [id,dock]of docks)dock.root.visible=!!w.rules;for(const team of w.teams||[]){let dock=docks.get(team.id);if(!dock){dock=createDock(T,team,glowTexture,mergeStatic,mobile);scene.add(dock.root);worldLabel(team.id?'MOON DOCK':'SUN DOCK',dock.root,22,16);docks.set(team.id,dock);}dock.root.visible=true;dock.update(w.t,team,w.rules,w.defense,reduced,dt,Math.max(0,...w.ships.filter(s=>s.team!==team.id).map(s=>s.attack||0)));}
  flag.visible=!w.rules&&!w.preview&&!w.flag.carrier&&w.flag.returnAt<=0;flag.position.set(w.flag.x,Math.sin((w.t||0)*3)*.22,w.flag.z);halo.scale.setScalar(1+Math.sin((w.t||0)*4)*.08);
  w.whirl.forEach((h,i)=>{holes[i].set(h.x,h.z,h.r+1.5);whirl[i].update(w.t||0,h.x,h.z,i?-1:1);});const tide=w.tide||tideAt(w.t||0);currents.rotation.y=-(w.t||0)*.025;currents.scale.x=tide.flow<0?-1:1;scenery.update(w.t||0);sunlight.intensity=1.35+.3*Math.sin((w.t||0)*.02);
  const player=w.ships.find(s=>s.id===me),s=player?.eliminated?w.ships.find(p=>p.team===player.team&&!p.dead&&!p.eliminated)||player:player;route.visible=!!s&&!player?.eliminated&&!s.dead&&!s.eliminated&&!w.preview&&(w.rules||w.flag.returnAt<=0);
  if(s){const target=missionFor(w,s).goal;routePoints.set([s.x,.1,s.z,target.x,.1,target.z]);routeGeo.attributes.position.needsUpdate=true;route.computeLineDistances();
   const portrait=innerWidth<innerHeight,speed=Math.min(28,Math.abs(s.v)),pull=reduced?0:speed*.12+(s.dash>0?1.5:0),dist=(portrait?36:28)+pull;
   if(!follow)cameraHeading=s.a;else if(s.whirl<0)cameraHeading+=Math.atan2(Math.sin(s.a-cameraHeading),Math.cos(s.a-cameraHeading))*(1-Math.exp(-dt*7));
   desired.set(s.x-Math.sin(cameraHeading)*dist-Math.cos(cameraHeading)*(portrait?3.5:6),(s.height||0)+(portrait?22:17.5)+pull*.15,s.z-Math.cos(cameraHeading)*dist+Math.sin(cameraHeading)*(portrait?3.5:6));
   if(s.whirl>=0){const h=w.whirl[s.whirl];desired.set(h.x-Math.sin(cameraHeading)*29,24,h.z-Math.cos(cameraHeading)*29);desiredLook.set(h.x,-1,h.z);}else desiredLook.set(s.x+Math.sin(s.a)*(10+speed*.18),(s.height||0)+2,s.z+Math.cos(s.a)*(10+speed*.18));
   if(!follow){camera.position.copy(desired);look.copy(desiredLook);follow=true;}else{camera.position.lerp(desired,1-Math.exp(-dt*6));look.lerp(desiredLook,1-Math.exp(-dt*8));}camera.lookAt(look);
   const fov=51+(reduced?0:speed*.09+(s.dash>0?1.3:0));if(Math.abs(camera.fov-fov)>.02){camera.fov+=(fov-camera.fov)*(1-Math.exp(-dt*4));camera.updateProjectionMatrix();}
  }
  if(w.preview){if(innerWidth<600){camera.position.set(23,19,30);camera.lookAt(0,-5,0);}else{camera.position.set(16,13,20);camera.lookAt(0,5,0);}}
  for(const [i,p]of palms.entries()){p.root.rotation.z=p.lean+Math.sin((w.t||0)*1.4+i)*.025;p.root.rotation.x=Math.sin((w.t||0)*1.1+i)*.018;}
  birds.forEach((b,i)=>{const t=(w.t||0)*.045+i*1.7;b.root.position.set(Math.sin(t)*63,12+Math.sin(t*2+i)*1.7,Math.cos(t)*63);b.root.rotation.y=t+Math.PI/2;b.wings.forEach((wing,j)=>wing.rotation.z=Math.sin((w.t||0)*3+i)*.24*(j?1:-1));});
  sky.position.copy(camera.position);for(const label of worldLabels){label.getWorldPosition(labelPosition);const width=Math.min(label.userData.baseWidth,Math.min(label.userData.pixelWidth||160,innerWidth*.3)*2*Math.tan(camera.fov*Math.PI/360)/innerHeight*camera.position.distanceTo(labelPosition));label.scale.set(width,width/(label.userData.ratio||4),1);}
  for(let i=effects.length-1;i>=0;i--){const p=effects[i];p.t-=dt;if(p.t<=0){effects.splice(i,1);continue;}p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;p.vy-=16*dt;}
  particles.count=effects.length;effects.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.setScalar(p.t);dummy.updateMatrix();particles.setMatrixAt(i,dummy.matrix);particles.setColorAt(i,p.color||sparkColor);});particles.instanceMatrix.needsUpdate=true;if(particles.instanceColor)particles.instanceColor.needsUpdate=true;
  if(shake>0&&s){shake=Math.max(0,shake-dt);camera.position.x+=Math.sin(shake*170)*shake;}combatFX.update(dt);renderer.render(scene,camera);
 }
 return {draw,burst,event,worldEvent,recenter(){follow=false;},renderer};
}
