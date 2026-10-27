import {RAID_HUBS,raidHeightAt,collideRaidTerrain,raidShotBlocked,raidWhirlpoolAt} from './raid-map.js';
import {repelFromWard,interceptWard,hitTurret,structureTargets} from './defenses.js';
import {configureTeams,teamAI,teamTick,teamAfter,advanceSeries} from './team-rules.js';
import {dropCargo,cargoCount,capacity as holdCapacity} from './economy.js';
import {waypoint} from './navigation.js';
import {allied} from './loadout.js';
import {sail} from './sailing.js';
import {ARENA,BOUNDARY,BUOY_RADIUS,SPAWN_RADIUS,ISLANDS,WHIRLPOOLS,PICKUPS,tideAt,whirlpoolAt} from './arena.js';
import {broadside,broadsideAim,collideShips} from './combat.js';
export {ARENA,ISLANDS} from './arena.js';
// Host-only, fixed-step simulation. Coordinates are meters; headings turn toward +X.
export const WIN = 3;
export const COLORS = ['#ffd166','#ff7b72','#66d8cb','#bca4ff','#ffae72','#b8db6b','#ff91c5','#80bfff'];
const clamp = (v,a,b) => Math.max(a,Math.min(b,Number(v)||0));
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export const angleDelta = (a,b) => Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function buoy(s) { if(s.team!==undefined)return {x:s.spawnX,z:s.spawnZ};return { x:Math.cos(s.buoyA)*BUOY_RADIUS, z:Math.sin(s.buoyA)*BUOY_RADIUS }; }
export function createWorld(captains, seed = Date.now()) {
 const ships = captains.slice(0,8).map((c,i) => {
  const a = i*Math.PI*2/captains.length;
  return { id:c.id, name:c.name||`Captain ${i+1}`, color:COLORS[i], ai:!!c.ai, buoyA:a,
   x:Math.cos(a)*SPAWN_RADIUS, z:Math.sin(a)*SPAWN_RADIUS, a:Math.atan2(-Math.cos(a),-Math.sin(a)),
   v:0,rudder:0,yawRate:0,slip:0,drag:0,whirl:-1,swirlAngle:0,swirlRadius:0,bump:0,ramStrike:0,fireSide:1,fireGun:0,nextGun:0,recoil:0,hp:100,score:0,dead:0,capture:0,fire:0,ram:0,boost:0,dash:0,slow:0,shield:2,ammo:[24,12,18] };
 });
 for(let i=0;i<2;i++) ships.push({ ...ships[0], id:`raider-${i}`, name:`Sea Raider ${i+1}`, color:'#e9789c', ai:true, raider:true, x:i?105:-105,z:i?-60:60,buoyA:i*Math.PI,ammo:[999,999,999] });
 return {t:0,remaining:240,ships,flag:{x:0,z:0,carrier:null,dropped:0,returnAt:0},shots:[],
  pickups:PICKUPS.map(p=>({...p,homeX:p.x,homeZ:p.z,cooldown:0})),
  whirl:WHIRLPOOLS.map(h=>({...h})),tide:tideAt(0),seed,over:false,sudden:false,events:[],eventSeq:0,shotSeq:0,current:0 };
}
export function createTeamWorld(captains,options={},seed=Date.now()){return configureTeams(createWorld(captains,seed),captains,options);}
function event(w,type,id,by,detail={}) { w.events.push({type,id,by,...detail,n:++w.eventSeq}); }
function drop(w,s) {
 if(w.flag.carrier!==s.id)return;
 w.flag.carrier=null;w.flag.x=s.x;w.flag.z=s.z;w.flag.dropped=12;s.capture=0;
 event(w,'drop',s.id);
}
function hurt(w,s,damage,by,kind) {
 if(s.dead>0||s.shield>0||damage<=0)return;
 const attacker=w.ships.find(p=>p.id===by);if(attacker&&allied(s,attacker))return;
 const amount=damage*(s.damageTaken||1)*(1+.04*(s.sailLevel||0));s.hp=Math.max(0,s.hp-amount);s.lastHitAt=w.t;if(kind!=='burn')s.attack=Math.max(0,(s.attack||0)-1);if(amount>=1)event(w,'hit',s.id,by,{damage:amount,kind});
 if(s.hp===0) {drop(w,s);if(w.rules)dropCargo(w,s,event);s.dead=w.rules?Math.max(3.5,5-.75*w.teams[s.team].rebuildLevel):8;s.respawnDuration=s.dead;s.v=0;if(w.rules){s.attack=0;s.burn=0;s.sticky=0;s.toolCharges=0;s.eliminated=w.rules==='core'&&(w.teams[s.team].core<=0||w.overtime.finalWater>0);if(attacker){attacker.kills++;}}event(w,'sink',s.id,by);}
}
function aiInput(w,s) {
 const carrier=w.ships.find(e=>e.id===w.flag.carrier&&!e.dead);
 let goal=w.rules?teamAI(w,s):s.raider?(carrier||w.ships.find(e=>!e.raider&&!e.dead)):
  w.flag.carrier===s.id?buoy(s):carrier||w.flag;
 if(!goal)goal={x:0,z:0};
 if(w.rules&&!goal.siege){const next=waypoint(w,s,goal);if(next!==goal)goal={...next,approach:true};}
 const range=Math.hypot(goal.x-s.x,goal.z-s.z);let heading=Math.atan2(goal.x-s.x,goal.z-s.z);if(goal.skirmish&&range<38)heading+=(s.id.length%2?1:-1)*(range<14?1.95:1.45);
 if(goal.siege&&range<39)heading=Math.atan2(goal.x-s.x,goal.z-s.z)-(s.id.length%2?1:-1)*Math.PI/2;
 // Steer around islands and whirlpools before committing to the route.
 for(const obstacle of (w.rules?[]:[...ISLANDS,...w.whirl])) {
  const d=distance(s,obstacle),r=obstacle.r+12;
  const delta=angleDelta(Math.atan2(obstacle.x-s.x,obstacle.z-s.z),s.a);
  if(d<r+12&&Math.abs(delta)<1.1)heading=s.a+(delta>0?-1.15:1.15);
 }
 if(carrier&&carrier.id!==s.id&&range<38&&(s.raider||range<26))heading=Math.atan2(goal.x-s.x,goal.z-s.z)+(s.id.length%2?1:-1)*1.1;
 const error=angleDelta(heading,s.a),atHome=w.rules?((goal.attack&&range<1.5)||(goal.siege&&range<39)||(goal.repair&&range<5)||(goal.opening&&range<4)): w.flag.carrier===s.id&&distance(s,goal)<10;
 const aim=broadsideAim(s,[...w.ships,...(w.rules?structureTargets(w,s.team):[])],0,w),enemy=aim.target;
 return {turn:atHome&&!goal.siege?0:clamp(error*1.7,-1,1),throttle:atHome?0:Math.abs(error)>1?.35:1,brake:atHome,fire:!!enemy,side:aim.side,utility:s.toolCharges>0&&(s.hp<s.maxHp*.5||s.attack>0),ram:false,boost:!atHome&&Math.abs(error)<.2&&distance(s,goal)>32,ammo:w.rules?(goal.siege?1:s.ammo[1]>0&&Math.floor(w.t*1.4)%3===0?2:s.ammo[2]>0&&Math.floor(w.t*1.4)%3===1?3:1):1};
}
export function step(w,inputs={},dt=1/30) {
 if(w.over)return;
 w.events=[];w.t+=dt;if(w.rules&&advanceSeries(w,dt,event))return;const origins=new Map(w.ships.map(s=>[s.id,{x:s.x,z:s.z}]));w.remaining=Math.max(0,240-w.t);w.current=w.t*.24;w.tide=tideAt(w.t);
 for(const [i,h]of w.whirl.entries())Object.assign(h,w.rules?raidWhirlpoolAt(i,w.t):whirlpoolAt(i,w.t));
 for(const [i,p]of w.pickups.entries()){p.cooldown=Math.max(0,p.cooldown-dt);p.x=p.homeX+Math.sin(w.t*.12+i)*1.8;p.z=p.homeZ+Math.cos(w.t*.12+i)*1.8;}
 if(w.flag.returnAt>0) {w.flag.returnAt=Math.max(0,w.flag.returnAt-dt);if(!w.flag.returnAt)event(w,'return');}
 if(w.flag.dropped>0) {w.flag.dropped-=dt;if(w.flag.dropped<=0){Object.assign(w.flag,{x:0,z:0,dropped:0});event(w,'return');}}
 if(w.rules)teamTick(w,inputs,dt,hurt,event);
 for(const s of w.ships) {
  if(s.eliminated){s.dead=6;continue;}
  if(s.dead>0) {s.dead=Math.max(0,s.dead-dt);if(!s.dead){const b=buoy(s);Object.assign(s,{x:b.x,z:b.z,hp:s.maxHp||100,height:w.rules?raidHeightAt(b.x,b.z):0,v:0,rudder:0,yawRate:0,slip:0,drag:0,whirl:-1,swirlRadius:0,bump:0,ramStrike:0,shield:2,ammo:w.rules?[999,Math.min(s.ammoCap,6+2*s.magazineLevel),Math.min(s.ammoCap,6+2*s.magazineLevel)]:[24,12,18]});if(w.rules)Object.assign(s,{a:s.team?Math.PI/2:-Math.PI/2,burn:0,sticky:0,jam:0,slow:0,fire:0,ram:0,boost:0,dash:0,attack:0});event(w,'respawn',s.id);}continue;}
  const u=s.ai?aiInput(w,s):inputs[s.id]||{};
  for(const key of ['fire','ram','boost','dash','slow','shield','bump','ramStrike','recoil'])s[key]=Math.max(0,s[key]-dt);
  if(s.whirl>=0){const h=w.whirl[s.whirl],spin=s.whirl? -1:1;s.drag=Math.min(1,s.drag+dt*.34);s.swirlAngle-=spin*(1.3+s.drag*2.4)*dt;s.swirlRadius*=Math.exp(-dt*.7);s.x=h.x+Math.sin(s.swirlAngle)*s.swirlRadius;s.z=h.z+Math.cos(s.swirlAngle)*s.swirlRadius;s.a=s.swirlAngle-spin*Math.PI/2;s.v=0;s.yawRate=0;drop(w,s);s.capture=0;if(s.drag>=1){s.shield=0;hurt(w,s,200,'sea');}continue;}
  s.movementInput=!!(Math.abs(Number(u.turn)||0)>.02||Math.abs(Number(u.throttle)||0)>.02||u.boost||u.ram);const carrying=w.rules?cargoCount(s)>12:w.flag.carrier===s.id;
  if(u.boost&&s.boost<=0){s.boost=4-.5*(s.boostLevel||0);s.dash=.8+.1*(s.boostLevel||0);s.sticky=0;s.slow=0;s.ccImmune=2;event(w,'boost',s.id);}
  sail(s,u,dt,carrying);if(w.rules)repelFromWard(w,s);
  const rr=Math.hypot(s.x,s.z),flow=w.tide.flow;
  if(rr>15){const strength=rr>62&&rr<108?w.tide.strength:.35;s.x+=(-s.z/rr)*flow*strength*dt;s.z+=(s.x/rr)*flow*strength*dt;}
  if(rr>BOUNDARY){s.x*=BOUNDARY/rr;s.z*=BOUNDARY/rr;s.v*=.5;}
  if(w.rules==='core')for(const base of w.teams){const d=distance(s,base);if(base.core>0&&d<7){const nx=(s.x-base.x)/(d||1),nz=(s.z-base.z)/(d||1);s.x=base.x+(d?nx:1)*7;s.z=base.z+nz*7;s.v*=.5;}}
  if(w.rules)collideRaidTerrain(s,s.height);else for(const isl of ISLANDS){const d=distance(s,isl),r=isl.r+3;if(d<r){const nx=(s.x-isl.x)/(d||1),nz=(s.z-isl.z)/(d||1);s.x=isl.x+nx*r;s.z=isl.z+nz*r;s.v*=.6;}}
  let inWhirl=false;
  for(const [i,h]of w.whirl.entries()){const d=distance(s,h);if(d<h.r+2&&d>.15){const nx=(s.x-h.x)/d,nz=(s.z-h.z)/d,pull=(1-d/(h.r+2))*3,spin=i?-1:1;s.x+=(-nx-nz*spin)*pull*dt;s.z+=(-nz+nx*spin)*pull*dt;}
   if(d<h.r){inWhirl=true;s.drag+=dt*.5;hurt(w,s,12*dt,'sea');s.v*=.98;drop(w,s);if(d<h.r*.56||s.drag>.4){s.whirl=i;s.drag=Math.max(.4,s.drag);s.swirlAngle=Math.atan2(s.x-h.x,s.z-h.z);s.swirlRadius=Math.max(1,d);event(w,'whirlpool',s.id);break;}}
  }
  if(!inWhirl)s.drag=Math.max(0,s.drag-dt*.8);
  for(const p of w.pickups)if(!p.cooldown&&distance(s,p)<7&&(p.kind!=='repair'||s.hp<(s.maxHp||100))&&(!w.rules||p.kind!=='gold'||cargoCount(s)<holdCapacity(s))){
   if(p.kind==='gold'){if(w.rules)s.cargo.gold+=Math.min(8,16+(s.holdLevel||0)*12-cargoCount(s));else s.coins=Math.min(999,s.coins+8);}else if(p.kind==='repair')s.hp=Math.min(s.maxHp||100,s.hp+40);else s.ammo=s.ammo.map((n,i)=>w.rules?(i?Math.min(s.ammoCap||12,n+3):999):n+[16,8,12][i]);
   p.cooldown=18;event(w,p.kind,s.id);
  }
  if(u.fire&&s.whirl<0)broadside(w,s,u,event);
  if(u.ram&&s.ram<=0&&s.whirl<0){s.ram=3;s.dash=.45;s.ramStrike=.6;event(w,'ram',s.id);}
  if(inWhirl)s.capture=0;
 }
 collideShips(w,hurt,event);for(const s of w.ships){const old=origins.get(s.id);s.motion=Math.hypot(s.x-old.x,s.z-old.z)/dt;if(w.rules)s.height=raidHeightAt(s.x,s.z);}
 for(const p of w.shots){p.t-=dt;p.y=(p.y??2.1)+(p.vy||0)*dt;p.x+=Math.sin(p.a)*(p.speed||60)*dt;p.z+=Math.cos(p.a)*(p.speed||60)*dt;if(w.rules&&raidShotBlocked(p)){p.t=0;event(w,'terrainhit',p.owner,null,{x:p.x,z:p.z});continue;}if(w.rules&&interceptWard(w,p,event))continue;if(w.rules&&hitTurret(w,p,event))continue;
  for(const f of w.fields||[])if(f.kind==='decoy'&&f.team!==p.team&&distance(p,f)<4){f.ttl=0;p.t=0;}if(p.t<=0)continue;
  for(const s of w.ships)if(s.id!==p.owner&&!s.dead&&!(w.rules&&s.team===p.team)&&distance(p,s)<4.5&&Math.abs(p.y-((s.height||0)+2.1))<4.5){const vulnerable=s.shield<=0;hurt(w,s,p.damage,p.owner,p.kind);if(vulnerable&&!s.dead){if(p.kind==='fire'){s.burn=4;s.burnBy=p.owner;for(const nearby of w.ships)if(nearby!==s&&nearby.team===s.team&&!nearby.dead&&nearby.shield<=0&&distance(s,nearby)<9){nearby.burn=Math.max(nearby.burn||0,3);nearby.burnBy=p.owner;}}if(p.kind==='sticky'&&s.ccImmune<=0&&s.sticky<=0){s.sticky=3;s.ccImmune=5;}if(p.kind==='shock'&&(!w.rules||s.ccImmune<=0)){s.jam=1.2;s.ccImmune=4;}if((p.kind==='chain'||(!p.kind&&p.type===2))&&(!w.rules||s.ccImmune<=0)&&s.slow<=0){s.slow=w.rules?1.8:2.5;s.ccImmune=4;}}p.t=0;break;}
  if(w.rules?raidShotBlocked(p):ISLANDS.some(i=>distance(p,i)<i.r))p.t=0;
 }
 w.shots=w.shots.filter(p=>p.t>0);
 if(w.rules){teamAfter(w,dt,event);return;}
 if(!w.flag.carrier&&w.flag.returnAt<=0)for(const s of w.ships)if(!s.raider&&!s.dead&&s.drag<.3&&!w.whirl.some(h=>distance(s,h)<h.r)&&distance(s,w.flag)<8){w.flag.carrier=s.id;w.flag.dropped=0;s.hp=Math.min(100,s.hp+25);s.shield=Math.max(s.shield,.6);event(w,'pickup',s.id);break;}
 for(const s of w.ships)if(s.id!==w.flag.carrier)s.capture=0;
 if(w.flag.carrier){const s=w.ships.find(e=>e.id===w.flag.carrier);w.flag.x=s.x;w.flag.z=s.z;
  if(distance(s,buoy(s))<12){s.capture+=dt;if(s.capture>=2){s.score++;s.capture=0;Object.assign(w.flag,{carrier:null,x:0,z:0,returnAt:3});event(w,'stash',s.id);if(s.score>=WIN||w.sudden)finish(w,s.id);}}
  else s.capture=0;
 }
 if(w.remaining<=0&&!w.over&&!w.sudden){const captains=w.ships.filter(s=>!s.raider),top=Math.max(...captains.map(s=>s.score)),leaders=captains.filter(s=>s.score===top);if(leaders.length===1)finish(w,leaders[0].id);else{w.sudden=true;event(w,'sudden');}}
}
function finish(w,id){w.over=true;w.winner=id;event(w,'victory',id);}
export function freshMatch(w){return createWorld(w.ships.filter(s=>!s.raider).map(({id,name,ai})=>({id,name,ai})));}
