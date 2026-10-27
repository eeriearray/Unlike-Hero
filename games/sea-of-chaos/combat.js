import {lineOfSight} from './raid-map.js';
import {inSmoke} from './economy.js';
import {structureTargets} from './defenses.js';
import {allied,weaponFor,weaponId} from './loadout.js';
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
// +X is port when the ship points +Z. From behind: port is screen-left.
export function cannonMuzzles(s,side){return [-2.5,-.5,1.5].map(z=>({x:s.x+Math.cos(s.a)*side*2.95+Math.sin(s.a)*z,z:s.z-Math.sin(s.a)*side*2.95+Math.cos(s.a)*z}));}
// Generous side-gun aim assist: anything within ~32° of either beam gets the shot.
export const AIM_CONE=.56;
export function broadsideAim(s,ships,requested=0,w=null){
 let best=null,closest=70;
 for(const e of ships){if(e.id===s.id||allied(s,e)||e.dead||e.drag>=.4||(w?.rules&&(!lineOfSight(s,e)||inSmoke(w,s)||inSmoke(w,e))))continue;const d=Math.hypot(e.x-s.x,e.z-s.z),aim=Math.atan2(e.x-s.x,e.z-s.z);
  for(const side of [1,-1])if((!requested||requested===side)&&d<closest&&Math.abs(delta(aim,s.a+side*Math.PI/2))<AIM_CONE){best={side,a:aim,target:e.id,targetHeight:(e.height||0)+(e.structure?0:2.1),range:d};closest=d;}
 }
 return best||{side:requested===-1?-1:1,a:s.a+(requested===-1?-1:1)*Math.PI/2,target:null};
}
// Bow chaser: in auto-fire mode, if nothing is on either beam, the bow gun takes a target you are pointing at.
export const BOW_CONE=.5,BOW_RANGE=58;
export function bowAim(s,ships,w=null){let best=null,closest=BOW_RANGE;
 for(const e of ships){if(e.id===s.id||allied(s,e)||e.dead||e.drag>=.4||(w?.rules&&(!lineOfSight(s,e)||inSmoke(w,s)||inSmoke(w,e))))continue;const d=Math.hypot(e.x-s.x,e.z-s.z),aim=Math.atan2(e.x-s.x,e.z-s.z);
  if(d<closest&&Math.abs(delta(aim,s.a))<BOW_CONE){best={side:0,a:aim,target:e.id,targetHeight:(e.height||0)+(e.structure?0:2.1),range:d};closest=d;}}
 return best;}
export function broadside(w,s,input,emit){
 const type=Math.max(1,Math.min(3,Math.round(Number(input.ammo)||1))),idx=type-1;
 if(s.fire>0||s.jam>0||(idx&&s.ammo[idx]<=0))return;
 const weapon=weaponFor(s,type);if(idx)s.ammo[idx]--;s.fire=(s.raider?2.6:1)*(s.weapons?weapon.reload:[.55,.95,1.25][idx])*Math.max(.7,1-.08*(s.loaderLevel||0))*(1+.12*(s.siegeLevel||0))/(s.handicap||1);
 const targets=[...w.ships,...(w.rules?structureTargets(w,s.team):[])],requested=input.side===1?1:input.side===-1?-1:0;let aim=broadsideAim(s,targets,requested,w);const bow=!requested&&!aim.target?bowAim(s,targets,w):null;if(bow)aim=bow;else if(!requested&&!aim.target&&input.fallback===-1)aim=broadsideAim(s,targets,-1,w);const muzzles=bow?[{x:s.x+Math.sin(s.a)*6.4,z:s.z+Math.cos(s.a)*6.4}]:cannonMuzzles(s,aim.side);
 s.fireKind=weaponId(s,type);s.fireSide=aim.side||1;s.recoil=.18;s.fireGun=bow?2:(s.nextGun||0)%3;if(!bow)s.nextGun=(s.fireGun+1)%3;
 const muzzle=bow?muzzles[0]:muzzles[s.fireGun];
 // One trigger fires one actual side cannon, regardless of ammunition.
 w.shots.push({id:++w.shotSeq,x:muzzle.x,z:muzzle.z,y:(s.height||0)+2.1,vy:aim.target?((aim.targetHeight??2.1)-((s.height||0)+2.1))/(aim.range/60):0,a:aim.a,owner:s.id,t:1.25,damage:(s.raider?.45:1)*(s.handicap||1)*(s.weapons?weapon.damage:[14,8,24][idx])*(1+(s.power||0)*.1),type,kind:weaponId(s,type),team:s.team});
 emit(w,'fire',s.id,aim.side,{kind:s.fireKind,gun:s.fireGun});
}
const clamp=v=>Math.max(0,Math.min(1,v));
export function hullContact(a,b){
 const ax=a.x-Math.sin(a.a)*2.6,az=a.z-Math.cos(a.a)*2.6,bx=b.x-Math.sin(b.a)*2.6,bz=b.z-Math.cos(b.a)*2.6;
 const ux=Math.sin(a.a)*5.2,uz=Math.cos(a.a)*5.2,vx=Math.sin(b.a)*5.2,vz=Math.cos(b.a)*5.2,rx=ax-bx,rz=az-bz;
 const aa=ux*ux+uz*uz,bb=ux*vx+uz*vz,cc=ux*rx+uz*rz,ee=vx*vx+vz*vz,ff=vx*rx+vz*rz,den=aa*ee-bb*bb;
 let s=Math.abs(den)>1e-6?clamp((bb*ff-cc*ee)/den):0,t=(bb*s+ff)/ee;
 if(t<0){t=0;s=clamp(-cc/aa);}else if(t>1){t=1;s=clamp((bb-cc)/aa);}
 let nx=(bx+vx*t)-(ax+ux*s),nz=(bz+vz*t)-(az+uz*s),d=Math.hypot(nx,nz);
 if(d>=4.8)return null;if(d<.001){nx=b.x-a.x;nz=b.z-a.z;d=Math.hypot(nx,nz);if(d<.001){nx=1;nz=0;d=1;}return {nx:nx/d,nz:nz/d,depth:4.8};}
 return {nx:nx/d,nz:nz/d,depth:4.8-d};
}
export function collideShips(w,hurt,emit){
 // Two short solver passes separate hulls without treating long ships as spheres.
 for(let pass=0;pass<2;pass++)for(let i=0;i<w.ships.length;i++)for(let j=i+1;j<w.ships.length;j++){
  const a=w.ships[i],b=w.ships[j];if(Math.abs((a.height||0)-(b.height||0))>4||a.dead||b.dead||a.drag>=.4||b.drag>=.4||Math.hypot(a.x-b.x,a.z-b.z)>11)continue;
  const c=hullContact(a,b);if(!c)continue;const {nx,nz,depth}=c;
  a.x-=nx*(depth*.5+.005);a.z-=nz*(depth*.5+.005);b.x+=nx*(depth*.5+.005);b.z+=nz*(depth*.5+.005);
  const avx=Math.sin(a.a)*a.v+Math.cos(a.a)*(a.slip||0),avz=Math.cos(a.a)*a.v-Math.sin(a.a)*(a.slip||0),bvx=Math.sin(b.a)*b.v+Math.cos(b.a)*(b.slip||0),bvz=Math.cos(b.a)*b.v-Math.sin(b.a)*(b.slip||0);
  const closing=(avx-bvx)*nx+(avz-bvz)*nz;
  if(closing>0){const impulse=closing*.58;a.v-=impulse*(nx*Math.sin(a.a)+nz*Math.cos(a.a));b.v+=impulse*(nx*Math.sin(b.a)+nz*Math.cos(b.a));a.slip=(a.slip||0)-impulse*(nx*Math.cos(a.a)-nz*Math.sin(a.a));b.slip=(b.slip||0)+impulse*(nx*Math.cos(b.a)-nz*Math.sin(b.a));}
  if(!pass){
   // Always resolve contact, but only hard impacts hurt. Per-hull grace also
   // prevents several overlapping captains from stacking damage in one tick.
   const ramA=a.ramStrike>0,ramB=b.ramStrike>0,hard=closing>10;
   const damage=Math.min(5,Math.max(0,(closing-10)*.4));
   const hitA=!a.bump&&(hard||ramB),hitB=!b.bump&&(hard||ramA);
   if(hitA){hurt(w,a,ramB?20*(b.ramPower||1):damage,b.id);a.bump=2;}
   if(hitB){hurt(w,b,ramA?20*(a.ramPower||1):damage,a.id);b.bump=2;}
   if(ramA||ramB)a.ramStrike=b.ramStrike=0;
   if(hitA||hitB)emit(w,'collision',a.id,b.id);
  }
 }
}
