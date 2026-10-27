import {RAID_HUBS,RAID_ISLANDS} from './raid-map.js';
// Original procedural fortress, mine and temple architecture. All channels are sea level.
export function createRaidScenery(T,scene,batch){
 const root=new T.Group();scene.add(root);
 const stone=new T.MeshStandardMaterial({color:'#526873',roughness:.93}),edge=new T.MeshStandardMaterial({color:'#b7c0af',roughness:.85}),grass=new T.MeshStandardMaterial({color:'#47795a',roughness:1}),wood=new T.MeshStandardMaterial({color:'#8c653c',roughness:.8}),gold=new T.MeshStandardMaterial({color:'#d7ae5c',metalness:.45,roughness:.4});
 const add=(g,m,x,y,z)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);root.add(o);return o;};
 for(const hub of RAID_HUBS){const {x,z,team}=hub,tint=new T.MeshStandardMaterial({color:team<0?'#ba8de0':team?'#58c4dc':'#e4ae50',roughness:.65});
 for(let j=0;j<48;j++){const a=j*Math.PI/24,dx=Math.cos(a),dz=Math.sin(a);if(Math.abs(dz)<.39||(team<0&&Math.abs(dx)<.39))continue;
 for(let tier=0;tier<3;tier++){const r=27-tier*2.4,o=add(new T.BoxGeometry(3.7,3.5,4.4),tier===2?grass:stone,x+dx*r,1+tier*2.3,z+dz*r);o.rotation.y=-a;}
 const lip=add(new T.BoxGeometry(3.4,.55,3),edge,x+dx*21,8.1,z+dz*21);lip.rotation.y=-a;
 if(j%2===0){const block=add(new T.BoxGeometry(2,1.4,2.5),tint,x+dx*23,8.5,z+dz*23);block.rotation.y=a;}
 }
 // Channel gates: masonry is above the sailing and cannon clearance, never a water ramp.
 for(const axis of (team<0?['x','z']:['x']))for(const sign of [-1,1]){const px=x+(axis==='x'?sign*25:0),pz=z+(axis==='z'?sign*25:0);for(const side of [-1,1])add(new T.BoxGeometry(3,14,3),edge,px+(axis==='z'?side*10:0),6.5,pz+(axis==='x'?side*10:0));const arch=add(new T.BoxGeometry(axis==='x'?3:23,2.5,axis==='x'?23:3),stone,px,14,pz);for(const side of [-1,1])add(new T.BoxGeometry(1,1,1),tint,px+(axis==='z'?side*9:0),15.9,pz+(axis==='x'?side*9:0));}
 for(const sign of [-1,1]){const tx=x+(team<0?sign*17:0),tz=z+sign*(team<0?17:24),towerH=team<0?14:18;
 add(new T.CylinderGeometry(3,4.7,towerH,8),stone,tx,towerH/2,tz);add(new T.CylinderGeometry(4,4,1,8),edge,tx,towerH,tz);add(new T.ConeGeometry(4.6,5,team<0?4:8),tint,tx,towerH+2.8,tz);add(new T.CylinderGeometry(.12,.12,5,6),gold,tx,towerH+7,tz);
 const flag=add(new T.PlaneGeometry(3.8,2.3),new T.MeshBasicMaterial({color:team<0?'#dab5ff':team?'#70dff0':'#ffd16a',side:T.DoubleSide}),tx+1.8,towerH+7.8,tz);flag.rotation.y=.3;
 }
 // Wooden berths frame the protected inner exit with supplies and mooring posts.
 if(team>=0)for(const side of [-1,1]){for(let j=0;j<8;j++)add(new T.BoxGeometry(8,.3,.7),wood,x+(team?13:-13),.5,side*(12+j*.72));for(const zz of [12,18])add(new T.CylinderGeometry(.3,.4,3,7),wood,x+(team?17:-17),.5,side*zz);}
 }
 // Distinct resource outposts on dry rock behind the accessible collection circles.
 for(const sign of [-1,1]){const z=sign*94,tint=new T.MeshStandardMaterial({color:sign>0?'#72dace':'#82ae63',roughness:.55});add(new T.CylinderGeometry(9,13,7,10),stone,0,1.5,z);add(new T.CylinderGeometry(9,10,1,10),grass,0,5.3,z);
 for(const x of [-6,6]){add(new T.BoxGeometry(2,8,2),edge,x,8,z);add(new T.OctahedronGeometry(2),tint,x,13,z);}add(new T.BoxGeometry(14,2,3),wood,0,11,z);for(let j=0;j<6;j++){add(new T.BoxGeometry(9,.3,.8),wood,0,.8,sign*(82+j));}for(const x of [-4.5,4.5])add(new T.CylinderGeometry(.3,.3,4,6),wood,x,0,sign*83);
 }
 const falls=new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,uniforms:{time:{value:0}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float time;varying vec2 v;void main(){float flow=.5+.5*sin(v.y*55.+time*6.+sin(v.x*20.));float edge=smoothstep(0.,.15,v.x)*smoothstep(0.,.15,1.-v.x);gl_FragColor=vec4(mix(vec3(.19,.65,.68),vec3(.8,.98,.93),flow*.7),edge*.8); }'});
 for(const island of RAID_ISLANDS){const f=add(new T.PlaneGeometry(2.2,island.h*.8),falls,island.x+island.r*.69,island.h*.4,island.z);f.rotation.y=Math.PI/2;}
 batch(root);return {root,update(t,visible){root.visible=visible;falls.uniforms.time.value=t;}};
}
