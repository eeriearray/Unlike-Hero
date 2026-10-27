import {ARENA,ISLANDS,RESPAWN,CAPTURE_R,buoy} from './simulation.js';
const V=THREE.Vector3;
export function makeRenderer(canvas){
 const mobile=matchMedia('(pointer:coarse)').matches,r=new THREE.WebGLRenderer({canvas,antialias:!mobile,powerPreference:'low-power'});
 r.setPixelRatio(Math.min(mobile?1:1.5,devicePixelRatio||1));r.setSize(innerWidth,innerHeight);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#0a2230');scene.fog=new THREE.Fog('#0a2230',110,210);
 const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.5,320);camera.position.set(0,60,-60);
 scene.add(new THREE.HemisphereLight(0xbfe3ea,0x0d2630,.8));const sun=new THREE.DirectionalLight(0xffe2b0,.95);sun.position.set(-30,60,-15);scene.add(sun);
 const std=(color,o={})=>new THREE.MeshStandardMaterial({color,roughness:.8,...o}),basic=(color,o={})=>new THREE.MeshBasicMaterial({color,...o});

 // Sea: a gently heaving disc with a shallow rim so the arena edge reads clearly.
 const seaGeo=new THREE.PlaneGeometry(300,300,50,50);seaGeo.rotateX(-Math.PI/2);const seaBase=seaGeo.attributes.position.array.slice();
 const ocean=new THREE.Mesh(seaGeo,std('#145a70',{roughness:.45,metalness:.15,flatShading:true}));ocean.position.y=-1;scene.add(ocean);
 const edge=new THREE.Mesh(new THREE.RingGeometry(92,96,96),basic('#e6c56a',{transparent:true,opacity:.18,side:THREE.DoubleSide}));edge.rotation.x=-Math.PI/2;edge.position.y=-.7;scene.add(edge);
 function rock(x,z,s,palms){const g=new THREE.Group();const m=new THREE.Mesh(new THREE.DodecahedronGeometry(1,0),std('#6b705b',{flatShading:true}));m.scale.set(s*1.1,s*.5,s);m.position.y=s*.15;g.add(m);
  const sand=new THREE.Mesh(new THREE.CylinderGeometry(s*1.05,s*1.3,1,12),std('#d9be82'));sand.position.y=-.6;g.add(sand);
  for(let i=0;i<palms;i++){const a=i*2.4,p=new THREE.Group(),trunk=new THREE.Mesh(new THREE.CylinderGeometry(.35,.5,7,5),std('#7a5631'));trunk.position.y=3.5;p.add(trunk);for(let k=0;k<5;k++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(.9,5,3),std('#3f8f4c',{flatShading:true}));leaf.position.y=7;leaf.rotation.set(1.1,k*1.25,0);leaf.translateY(2);p.add(leaf)}p.position.set(Math.cos(a)*s*.45,s*.3,Math.sin(a)*s*.45);p.rotation.z=.15;g.add(p)}
  g.position.set(x,0,z);scene.add(g)}
 ISLANDS.forEach(i=>rock(i.x,i.z,i.r,3));for(let i=0;i<14;i++){const a=i*Math.PI/7+.2;rock(Math.cos(a)*104,Math.sin(a)*104,7+(i%3)*2,i%2)}
 // Center wreck, purely decorative.
 const wreck=new THREE.Group();const wh=new THREE.Mesh(new THREE.BoxGeometry(5,2,12),std('#4a3220'));wh.rotation.set(.25,.6,.35);wh.position.y=-.4;const wm=new THREE.Mesh(new THREE.CylinderGeometry(.25,.3,8,5),std('#4a3220'));wm.rotation.set(.9,.6,0);wm.position.set(2,1.6,1);wreck.add(wh,wm);wreck.position.set(-6,0,-7);scene.add(wreck);

 // Beacons: tall light columns that can be seen from anywhere on the map.
 function beacon(color,h=70,rad=1.4){const m=new THREE.Mesh(new THREE.CylinderGeometry(rad,rad*1.6,h,12,1,true),basic(color,{transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));m.position.y=h/2;return m}
 function ring(color,rad,width=.5,opacity=.9){const m=new THREE.Mesh(new THREE.RingGeometry(rad-width,rad,48),basic(color,{transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;return m}

 const flag=new THREE.Group();{const staff=new THREE.Mesh(new THREE.CylinderGeometry(.18,.22,7,6),std('#e7bf57',{metalness:.6}));staff.position.y=3.5;const cloth=new THREE.Mesh(new THREE.PlaneGeometry(3.6,2.4),std('#111',{side:THREE.DoubleSide,emissive:'#1a1a1a'}));cloth.position.set(1.8,5.8,0);
  const skull=new THREE.Mesh(new THREE.CircleGeometry(.7,12),basic('#f4ecd4',{side:THREE.DoubleSide}));skull.position.set(1.8,5.9,.02);const halo=new THREE.Mesh(new THREE.SphereGeometry(2.6,12,10),basic('#ffcf4a',{transparent:true,opacity:.22,depthWrite:false}));halo.position.y=5.8;flag.add(staff,cloth,skull,halo);flag.userData.cloth=cloth}
 const flagBeam=beacon('#ffd24a',80,1.6),flagRing=ring('#ffd24a',7.5,.6);flag.add(flagBeam);scene.add(flag,flagRing);
 const homeRing=ring('#ffd24a',7.5,.4,.45);scene.add(homeRing);

 // Guide arrow that floats around your own ship and points at what you should do next.
 const arrowShape=new THREE.Shape();arrowShape.moveTo(0,3.2);arrowShape.lineTo(2.2,0);arrowShape.lineTo(.8,0);arrowShape.lineTo(.8,-2);arrowShape.lineTo(-.8,-2);arrowShape.lineTo(-.8,0);arrowShape.lineTo(-2.2,0);arrowShape.closePath();
 const arrowGeo=new THREE.ShapeGeometry(arrowShape);arrowGeo.rotateX(-Math.PI/2);arrowGeo.rotateY(Math.PI);
 const arrowMat=basic('#ffd24a',{transparent:true,opacity:.92,depthWrite:false,side:THREE.DoubleSide}),arrow=new THREE.Mesh(arrowGeo,arrowMat);arrow.renderOrder=3;scene.add(arrow);

 function nameTag(text,color){const c=document.createElement('canvas');c.width=256;c.height=56;const x=c.getContext('2d');x.font='bold 30px Cinzel, Georgia, serif';x.textAlign='center';x.lineWidth=6;x.strokeStyle='#000a';x.strokeText(text,128,38);x.fillStyle=color;x.fillText(text,128,38);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));s.scale.set(11,2.4,1);s.position.y=13;return s}

 const ships=new Map(),buoys=new Map();
 function shipMesh(s,me){const root=new THREE.Group(),body=new THREE.Group(),col=new THREE.Color(s.color);root.add(body);
  const wood=std(s.raider?'#2c2230':'#6b4426',{emissive:'#000'}),trim=std(col,{emissive:'#000'}),cloth=std(s.raider?'#5a1f2a':'#efe2c2',{side:THREE.DoubleSide});
  const hullShape=new THREE.Shape();hullShape.moveTo(0,6.5);hullShape.quadraticCurveTo(2.8,3,2.6,-3.8);hullShape.lineTo(-2.6,-3.8);hullShape.quadraticCurveTo(-2.8,3,0,6.5);
  const hullGeo=new THREE.ExtrudeGeometry(hullShape,{depth:2,bevelEnabled:false});hullGeo.rotateX(Math.PI/2);hullGeo.translate(0,1.4,0);const hull=new THREE.Mesh(hullGeo,wood);body.add(hull);
  const rail=new THREE.Mesh(new THREE.BoxGeometry(5.4,.35,9.6),trim);rail.position.set(0,1.55,1);body.add(rail);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.2,.28,10,6),wood);mast.position.set(0,6,.6);body.add(mast);
  const sail=new THREE.Mesh(new THREE.PlaneGeometry(5.4,4.6,4,1),cloth);sail.position.set(0,6.6,.9);body.add(sail);
  const stripe=new THREE.Mesh(new THREE.PlaneGeometry(5.4,1),trim);stripe.position.set(0,6.6,.95);body.add(stripe);
  const pennant=new THREE.Mesh(new THREE.ConeGeometry(.6,2.4,3),basic(col));pennant.rotation.z=-Math.PI/2;pennant.position.set(1.2,10.6,.6);body.add(pennant);
  // Bow cannons make it obvious which way you shoot.
  for(const x of[-.9,.9]){const c=new THREE.Mesh(new THREE.CylinderGeometry(.32,.4,2.2,8),std('#222',{metalness:.7,roughness:.4}));c.rotation.x=Math.PI/2;c.position.set(x,1.9,5);body.add(c)}
  const wake=new THREE.Mesh(new THREE.PlaneGeometry(5,12),basic('#bff3ee',{transparent:true,opacity:.0,depthWrite:false}));wake.rotation.x=-Math.PI/2;wake.position.set(0,-.55,-9);root.add(wake);
  const shield=new THREE.Mesh(new THREE.SphereGeometry(7.5,16,12),basic('#9fe8ff',{transparent:true,opacity:.0,depthWrite:false}));shield.position.y=2;root.add(shield);
  const tag=nameTag(s.raider?'☠ '+s.name:s.id===me?'YOU':s.name,s.raider?'#ff8a8a':s.color);root.add(tag);
  if(s.id===me){const meRing=ring('#ffffff',8,.35,.5);meRing.position.y=-.5;root.add(meRing)}
  scene.add(root);root.userData={body,wood,trim,wake,shield,seed:Math.random()*10};return root}

 // Lightweight pooled particles for cannon smoke, explosions, splinters and spray.
 const pool=[],geoBall=new THREE.IcosahedronGeometry(1,0),mats={fire:basic('#ffb347'),flash:basic('#fff2a8'),smoke:basic('#d9d4c8',{transparent:true,opacity:.55,depthWrite:false}),water:basic('#e6fbff',{transparent:true,opacity:.8,depthWrite:false}),wood:std('#7a5233'),gold:basic('#ffd24a'),blue:basic('#9fe8ff',{transparent:true,opacity:.7,depthWrite:false}),heal:basic('#7fe39b')};
 function puff(kind,x,y,z,n,spd,size,life,up=4){for(let i=0;i<n;i++){let p=pool.find(q=>!q.visible);if(!p){if(pool.length>260)return;p=new THREE.Mesh(geoBall,mats.fire);scene.add(p);pool.push(p)}
  p.material=mats[kind];p.visible=true;p.position.set(x,y,z);const a=Math.random()*6.28,s=spd*(.4+Math.random()*.8);p.userData={vx:Math.cos(a)*s,vy:up*(.4+Math.random()),vz:Math.sin(a)*s,life,max:life,size:size*(.6+Math.random()*.7),grav:kind==='smoke'||kind==='blue'?-.5:12}}}
 const shockwaves=[];function shock(color,x,z,size){let m=shockwaves.find(q=>!q.visible);if(!m){m=ring(color,1,.25,1);scene.add(m);shockwaves.push(m)}m.material.color.set(color);m.visible=true;m.position.set(x,-.4,z);m.userData={t:0,size}}
 const shotMeshes=[],shotMat=basic('#1b1b1b'),shotGlow=basic('#ffb347',{transparent:true,opacity:.5,depthWrite:false});
 let shake=0,fov=55;const t0=performance.now();

 function fx(events,w,me){for(const e of events){const x=e.x??0,z=e.z??0;switch(e.type){
  case 'fire':puff('flash',x,2,z,3,3,.9,.12,1);puff('smoke',x,2,z,5,3,1.4,.7,2);if(e.id===me)shake=Math.max(shake,.25);break;
  case 'hit':puff('fire',x,2,z,8,8,.8,.35,6);puff('wood',x,2,z,7,9,.45,.8,9);puff('smoke',x,2.5,z,5,3,1.8,.9,3);if(e.id===me)shake=Math.max(shake,1.1);else if(e.by===me)shake=Math.max(shake,.35);break;
  case 'block':puff('blue',x,2,z,10,6,.6,.4,3);break;
  case 'splash':puff('water',x,0,z,9,3,.5,.6,10);shock('#e6fbff',x,z,4);break;
  case 'sink':puff('fire',x,2,z,18,12,1.2,.6,10);puff('wood',x,2,z,16,13,.6,1.2,12);puff('smoke',x,3,z,12,4,2.6,1.6,4);shock('#ffb347',x,z,16);if(e.id===me)shake=1.8;break;
  case 'ram':puff('wood',x,2,z,14,11,.6,1,10);puff('water',x,1,z,10,8,.6,.6,8);shock('#ffffff',x,z,10);if(e.id===me||e.by===me)shake=Math.max(shake,1.3);break;
  case 'boost':puff('water',x,.5,z,10,6,.5,.5,5);break;
  case 'pickup':case 'steal':puff('gold',x,3,z,18,9,.5,.8,10);shock('#ffd24a',x,z,14);break;
  case 'stash':puff('gold',x,3,z,40,14,.7,1.4,16);shock('#ffd24a',x,z,26);break;
  case 'repair':puff('heal',x,3,z,14,6,.5,.7,8);break;
  case 'powder':puff('fire',x,3,z,14,6,.5,.7,8);break;
  case 'respawn':case 'spawn':case 'return':shock('#ffd24a',x,z,10);break;
  case 'bump':puff('water',x,1,z,6,5,.5,.5,6);break}}}

 function resize(){r.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}addEventListener('resize',resize);
 const whirl=[],pickMeshes=[];
 function objective(w,meShip){
  if(!meShip||meShip.dead>0)return null;
  if(w.flag.carrier===meShip.id)return{...buoy(meShip),color:meShip.color};
  const c=w.ships.find(s=>s.id===w.flag.carrier);if(c)return{x:c.x,z:c.z,color:'#ff6b5a'};
  if(w.flag.returnAt>0)return{...w.flag.home,color:'#ffd24a'};
  return{x:w.flag.x,z:w.flag.z,color:'#ffd24a'};
 }

 function draw(w,me,dt){
  const time=(performance.now()-t0)/1000;
  // Sea swell.
  const pos=seaGeo.attributes.position;for(let i=0;i<pos.count;i++){const x=seaBase[i*3],z=seaBase[i*3+2];pos.array[i*3+1]=Math.sin(x*.08+time*1.1)*.45+Math.cos(z*.07+time*.8)*.45}pos.needsUpdate=true;seaGeo.computeVertexNormals();
  const meShip=w.ships.find(s=>s.id===me);
  for(const s of w.ships){let o=ships.get(s.id);if(!o){o=shipMesh(s,me);ships.set(s.id,o)}const u=o.userData;
   const sinking=s.dead>0&&s.hp<=0&&s.dead>RESPAWN-2.2,k=sinking?(RESPAWN-s.dead)/2.2:0;
   o.visible=s.dead<=0||sinking;o.position.set(s.x,sinking?-k*6:Math.sin(time*1.6+u.seed)*.3,s.z);o.rotation.y=s.a;
   u.body.rotation.z=sinking?k*1.2:Math.sin(time*1.3+u.seed)*.05;u.body.rotation.x=sinking?-k*.4:Math.cos(time*1.1+u.seed)*.03;
   const flash=s.hitT>0?1:0;u.wood.emissive.setRGB(flash*.9,flash*.15,0);u.trim.emissive.setRGB(flash*.6,flash*.1,0);
   u.wake.material.opacity=Math.min(.45,Math.max(0,s.v)/30)+(s.surge>0?.25:0);u.wake.scale.y=1+Math.max(0,s.v)/14;
   u.shield.material.opacity=s.shield>0?.16+Math.sin(time*12)*.05:0;
   if(s.surge>0&&Math.random()<.5)puff('water',s.x-Math.sin(s.a)*5,0,s.z-Math.cos(s.a)*5,1,2,.6,.5,5);
   if(!s.raider&&!buoys.has(s.id)){const mine=s.id===me,g=new THREE.Group();const rg=ring(s.color,mine?CAPTURE_R:6,mine?.8:.5,mine?.9:.55);rg.position.y=-.3;g.add(rg);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,mine?9:5,6),std(s.color,{emissive:s.color,emissiveIntensity:.3}));pole.position.y=mine?4.5:2.5;g.add(pole);const top=new THREE.Mesh(new THREE.SphereGeometry(mine?1.4:.9,10,8),basic(s.color));top.position.y=mine?9.3:5.2;g.add(top);
    if(mine){const fill=new THREE.Mesh(new THREE.CircleGeometry(CAPTURE_R-.8,40),basic(s.color,{transparent:true,opacity:.0,depthWrite:false,side:THREE.DoubleSide}));fill.rotation.x=-Math.PI/2;fill.position.y=-.35;g.add(fill);g.userData={fill,beam:beacon(s.color,60,1.2),ring:rg};g.add(g.userData.beam)}
    const p=buoy(s);g.position.set(p.x,0,p.z);scene.add(g);buoys.set(s.id,g)}
  }
  const myBuoy=buoys.get(me);if(myBuoy&&meShip){const carrying=w.flag.carrier===me,ud=myBuoy.userData;ud.beam.visible=carrying;ud.beam.material.opacity=.22+Math.sin(time*5)*.08;ud.fill.material.opacity=carrying?.12+meShip.capture/1.5*.45:0;ud.ring.scale.setScalar(carrying?1+Math.sin(time*5)*.03:1)}
  for(let i=0;i<w.pickups.length;i++){const p=w.pickups[i];let m=pickMeshes[i];if(!m){m=new THREE.Group();const heal=p.kind==='repair';const box=new THREE.Mesh(new THREE.BoxGeometry(3,3,3),std(heal?'#3fa45d':'#3a3a3a',{emissive:heal?'#1d5a2c':'#3a1d00'}));m.add(box);
    if(heal){for(const r2 of[[3.3,.9,.9],[.9,3.3,.9]]){const c=new THREE.Mesh(new THREE.BoxGeometry(...r2),basic('#f2fff4'));c.position.z=1.55;m.add(c)}}else{const fuse=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,1.4,5),basic('#ffb347'));fuse.position.y=2.1;m.add(fuse);const band=new THREE.Mesh(new THREE.BoxGeometry(3.2,.5,3.2),std('#b33b2a'));m.add(band)}
    m.add(ring(heal?'#7fe39b':'#ffb347',4.5,.35,.6));m.children.at(-1).position.y=-2.3;scene.add(m);pickMeshes[i]=m}
   m.visible=p.cooldown<=0;m.position.set(p.x,2.3+Math.sin(time*2+i)*.4,p.z);m.rotation.y+=dt*.8}
  for(let i=0;i<w.whirl.length;i++){let g=whirl[i];if(!g){g=new THREE.Group();for(let k=0;k<3;k++){const rr=ring('#b9a6ff',w.whirl[i].r+2-k*2.6,.35,.6-k*.12);rr.position.y=-.3-k*.15;g.add(rr)}const center=new THREE.Mesh(new THREE.CircleGeometry(4,24),basic('#241d4a',{transparent:true,opacity:.75}));center.rotation.x=-Math.PI/2;center.position.y=-.55;g.add(center);scene.add(g);whirl[i]=g}
   g.position.set(w.whirl[i].x,0,w.whirl[i].z);g.rotation.y+=dt*(i?-1.6:1.4)}
  for(let i=0;i<w.shots.length;i++){let m=shotMeshes[i];if(!m){m=new THREE.Mesh(geoBall,shotMat);m.scale.setScalar(.7);const g=new THREE.Mesh(geoBall,shotGlow);g.scale.setScalar(1.8);m.add(g);scene.add(m);shotMeshes[i]=m}m.visible=true;const sh=w.shots[i];m.position.set(sh.x,1.6+Math.sin((1.1-sh.t)/1.1*Math.PI)*2.5,sh.z)}
  for(let i=w.shots.length;i<shotMeshes.length;i++)shotMeshes[i].visible=false;
  // Flag: on the water, or flying high above whoever carries it so everyone can spot them.
  const carrier=w.ships.find(s=>s.id===w.flag.carrier);flag.visible=w.flag.returnAt<=0;
  if(carrier){flag.position.set(carrier.x,8,carrier.z);flagRing.visible=false}else{flag.position.set(w.flag.x,Math.sin(time*2)*.3,w.flag.z);flagRing.visible=flag.visible;flagRing.position.set(w.flag.x,-.4,w.flag.z);flagRing.scale.setScalar(1+Math.sin(time*4)*.08)}
  flag.rotation.y=carrier?carrier.a+Math.PI:time*.8;flag.userData.cloth.rotation.y=Math.sin(time*5)*.25;flagBeam.material.color.set(carrier?'#ff6b5a':'#ffd24a');
  homeRing.visible=w.flag.returnAt>0;homeRing.position.set(w.flag.home.x,-.4,w.flag.home.z);homeRing.scale.setScalar(1+(3-w.flag.returnAt)*.3);
  const goal=objective(w,meShip);arrow.visible=!!goal&&(!meShip||Math.hypot(goal.x-meShip.x,goal.z-meShip.z)>11);
  if(goal&&meShip){const ang=Math.atan2(goal.x-meShip.x,goal.z-meShip.z),rad=11+Math.sin(time*6)*.6;arrow.position.set(meShip.x+Math.sin(ang)*rad,.6,meShip.z+Math.cos(ang)*rad);arrow.rotation.y=ang;arrowMat.color.set(goal.color)}
  for(const p of pool){if(!p.visible)continue;const u=p.userData;u.life-=dt;if(u.life<=0){p.visible=false;continue}u.vy-=u.grav*dt;p.position.x+=u.vx*dt;p.position.y=Math.max(-.6,p.position.y+u.vy*dt);p.position.z+=u.vz*dt;p.scale.setScalar(u.size*(p.material===mats.smoke?1.6-u.life/u.max*.6:u.life/u.max))}
  for(const m of shockwaves){if(!m.visible)continue;m.userData.t+=dt;const k=m.userData.t/.6;if(k>=1){m.visible=false;continue}m.scale.setScalar(1+k*m.userData.size);m.material.opacity=1-k}
  // Camera: high chase cam that looks ahead of the bow and pulls back at speed.
  if(meShip){const speed=Math.max(0,meShip.v),tall=Math.min(1.7,Math.max(1,1/camera.aspect*.85)),dist=(30+speed*.6)*tall,height=(24+speed*.4)*tall,carry=w.flag.carrier===me?6:0;
   const want=new V(meShip.x-Math.sin(meShip.a)*(dist+carry),height+carry,meShip.z-Math.cos(meShip.a)*(dist+carry));camera.position.lerp(want,1-Math.exp(-dt*3.2));
   const look=new V(meShip.x+Math.sin(meShip.a)*12,0,meShip.z+Math.cos(meShip.a)*12);
   if(shake>0){shake=Math.max(0,shake-dt*3);camera.position.x+=(Math.random()-.5)*shake;camera.position.y+=(Math.random()-.5)*shake}
   camera.lookAt(look);const f=meShip.surge>0?66:55;fov+=(f-fov)*Math.min(1,dt*5);camera.fov=fov;camera.updateProjectionMatrix()}
  else{camera.position.set(Math.sin(time*.08)*90,55,Math.cos(time*.08)*90);camera.lookAt(0,0,0)}
  r.render(scene,camera)}
 function project(x,y,z){const v=new V(x,y,z).project(camera);return{x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight,on:v.z<1}}
 return{draw,fx,project,renderer:r}}
