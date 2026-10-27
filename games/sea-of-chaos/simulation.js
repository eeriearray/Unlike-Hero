// Host-authoritative rules for Sea of Chaos. Pure data in, pure data out, so
// the same code runs for solo play, the room host and the node tests.
export const ARENA=100, WIN=3, MATCH=180, BUOY_R=62, CAPTURE_R=14, CAPTURE_T=1.5, RESPAWN=5, BOOST_CD=4, SURGE=1.1;
export const ISLANDS=[{x:-34,z:-27,r:12},{x:36,z:31,r:13}];
export const WHIRLS=[{x:-30,z:4,r:7},{x:32,z:-23,r:7}];
// The first flag spawns at the wreck; later flags pop up at one of these.
export const FLAG_SPOTS=[{x:0,z:0},{x:-38,z:18},{x:20,z:-40},{x:10,z:42},{x:42,z:5},{x:-14,z:-46}];
const PALETTE=['#f2c14e','#ef6a55','#5fd0b8','#9d8cf0','#f0965a','#9cd060','#f48cc0','#5ab4f0'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), d2=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z), wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

function ship(o){return{v:0,hp:100,score:0,sinks:0,dead:0,capture:0,fire:0,boost:0,surge:0,shield:0,rapid:0,hitT:0,lastBy:null,rammed:[],ai:false,raider:false,buoyA:0,...o}}
export function buoy(s){return{x:Math.cos(s.buoyA)*BUOY_R,z:Math.sin(s.buoyA)*BUOY_R}}

export function createWorld(captains,seed=Date.now()){
 const list=captains.slice(0,8),n=Math.max(2,list.length);
 const ships=list.map((c,i)=>{const a=i*Math.PI*2/n,x=Math.cos(a)*BUOY_R,z=Math.sin(a)*BUOY_R;return ship({id:c.id,name:c.name||`Captain ${i+1}`,color:PALETTE[i%PALETTE.length],ai:!!c.ai,buoyA:a,x,z,a:Math.atan2(-x,-z),shield:3})});
 // Raiders are neutral hunters that only chase the flag carrier. They join after a short grace period.
 const raiders=list.length>5?2:1;
 for(let i=0;i<raiders;i++)ships.push(ship({id:`raider-${i}`,name:`Sea Raider${raiders>1?' '+(i+1):''}`,color:'#c4485e',ai:true,raider:true,x:0,z:-90,a:0,dead:14+i*10,hp:100}));
 return{t:0,remaining:MATCH,ships,flag:{x:0,z:0,carrier:null,dropped:0,returnAt:0,home:{x:0,z:0}},shots:[],
  pickups:[{x:-54,z:-7,kind:'repair',cooldown:0},{x:50,z:-2,kind:'powder',cooldown:0},{x:2,z:-60,kind:'repair',cooldown:0},{x:-8,z:58,kind:'powder',cooldown:0}],
  whirl:WHIRLS.map((h,i)=>({...h,phase:i*2})),seed,over:false,sudden:false,events:[],current:0};
}

function spawnAt(w,s){
 if(s.raider){const a=Math.random()*Math.PI*2;s.x=Math.cos(a)*88;s.z=Math.sin(a)*88}else{const b=buoy(s);s.x=b.x;s.z=b.z}
 s.a=Math.atan2(-s.x,-s.z);s.hp=100;s.v=0;s.shield=s.raider?0:2.5;s.capture=0;s.surge=0;s.boost=0;s.lastBy=null;
}
function dropFlag(w,s){w.flag.carrier=null;w.flag.x=s.x;w.flag.z=s.z;w.flag.dropped=10;s.capture=0}
function canHit(a,b){return a!==b&&!b.dead&&!(a.raider&&b.raider)}

// Shots lean toward whatever is roughly in front, so a captain only has to point the bow.
function aimAt(w,s,cone,range){
 let best=null,score=Infinity;
 for(const e of w.ships){if(!canHit(s,e))continue;const d=d2(s,e);if(d>range)continue;const off=Math.abs(wrap(Math.atan2(e.x-s.x,e.z-s.z)-s.a));if(off>cone)continue;const k=d*(1+off*2);if(k<score){score=k;best=e}}
 if(!best)return s.a;
 const t=d2(s,best)/60,px=best.x+Math.sin(best.a)*best.v*t,pz=best.z+Math.cos(best.a)*best.v*t;
 return Math.atan2(px-s.x,pz-s.z);
}

function think(w,s,dt){
 const b=s.brain||(s.brain={skill:.35+Math.random()*.45,hunter:Math.random()<.45,orbit:Math.random()*6.3});
 const carrier=w.flag.carrier?w.ships.find(x=>x.id===w.flag.carrier):null,repair=w.pickups.filter(p=>p.cooldown<=0&&p.kind==='repair').sort((p,q)=>d2(s,p)-d2(s,q))[0];
 const lead=(e,k)=>({x:e.x+Math.sin(e.a)*e.v*k,z:e.z+Math.cos(e.a)*e.v*k});
 let goal,prey=null;
 if(s.raider){if(carrier&&w.flag.held>3){goal=lead(carrier,.5);prey=carrier}else{const a=w.t*.25+b.orbit;goal={x:w.flag.x+Math.cos(a)*30,z:w.flag.z+Math.sin(a)*30}}}
 else if(carrier===s)goal=buoy(s);
 else if(carrier){const d=d2(s,carrier);if(b.hunter||d<40){goal=lead(carrier,.6);prey=carrier}else goal=s.hp<60&&repair?repair:{x:carrier.x*.5,z:carrier.z*.5}}
 else goal=s.hp<35&&repair&&d2(s,repair)<d2(s,w.flag)?repair:w.flag;
 let ax=goal.x-s.x,az=goal.z-s.z;const gl=Math.hypot(ax,az)||1;ax/=gl;az/=gl;
 for(const o of[...ISLANDS,...w.whirl]){const dx=s.x-o.x,dz=s.z-o.z,d=Math.hypot(dx,dz)||1,room=o.r+13;if(d<room){const k=(room-d)/13*1.8;ax+=dx/d*k;az+=dz/d*k}}
 const r=Math.hypot(s.x,s.z);if(r>82){ax-=s.x/r*1.5;az-=s.z/r*1.5}
 const off=wrap(Math.atan2(ax,az)-s.a),u={turn:clamp(off*2.2,-1,1),throttle:Math.abs(off)>1.5?.35:.68+.26*b.skill,fire:0,boost:0};
 // Fire only with something lined up ahead, and hesitate a little — bots should be beatable.
 for(const e of w.ships){if(!canHit(s,e)||(s.raider&&e!==carrier))continue;const d=d2(s,e);if(d>46)continue;if(Math.abs(wrap(Math.atan2(e.x-s.x,e.z-s.z)-s.a))<.28&&Math.random()<dt*(1.2+b.skill*2.2)){u.fire=1;break}}
 if(prey&&d2(s,prey)<16&&Math.abs(wrap(Math.atan2(prey.x-s.x,prey.z-s.z)-s.a))<.35&&Math.random()<dt*b.skill*1.6)u.boost=1;
 if(carrier===s&&w.ships.some(e=>canHit(e,s)&&d2(e,s)<18)&&Math.random()<dt*b.skill*1.5)u.boost=1;
 return u;
}

export function step(w,inputs,dt=1/30){
 if(w.over)return;w.events=[];w.t+=dt;w.current+=dt*.24;
 if(!w.sudden)w.remaining=Math.max(0,w.remaining-dt);
 const emit=(type,o)=>w.events.push({type,...o});
 for(const s of w.ships){
  s.hitT=Math.max(0,s.hitT-dt);
  if(s.dead>0){s.dead-=dt;if(s.dead<=0){s.dead=0;spawnAt(w,s);emit('respawn',{id:s.id,x:s.x,z:s.z})}continue}
  const u=s.ai?think(w,s,dt):(inputs[s.id]||{}),carrying=w.flag.carrier===s.id;
  for(const k of['fire','boost','surge','shield','rapid'])s[k]=Math.max(0,s[k]-dt);
  if(u.boost&&s.boost<=0){s.boost=BOOST_CD;s.surge=SURGE;s.rammed=[];emit('boost',{id:s.id,x:s.x,z:s.z})}
  const top=s.surge>0?24:s.raider?11.5:carrying?12.5:14,thr=s.surge>0?1:clamp(u.throttle||0,-.5,1);
  s.v+=(thr*top-s.v)*Math.min(1,dt*(s.surge>0?6:1.7));
  s.a=wrap(s.a+clamp(u.turn||0,-1,1)*dt*(s.surge>0?1.4:2));
  s.x+=Math.sin(s.a)*s.v*dt;s.z+=Math.cos(s.a)*s.v*dt;
  const rr=Math.hypot(s.x,s.z);if(rr>92){s.x*=92/rr;s.z*=92/rr;s.v*=.6}
  for(const isl of ISLANDS){const dx=s.x-isl.x,dz=s.z-isl.z,d=Math.hypot(dx,dz)||1,lim=isl.r+3;if(d<lim){s.x=isl.x+dx/d*lim;s.z=isl.z+dz/d*lim;if(Math.abs(s.v)>9&&s.shield<=0){s.hp-=6;s.hitT=.2;emit('bump',{id:s.id,x:s.x,z:s.z})}s.v*=.4}}
  for(const h of w.whirl){const dx=h.x-s.x,dz=h.z-s.z,d=Math.hypot(dx,dz)||1;if(d<h.r+4){s.x+=(dx/d*5-dz/d*7)*dt;s.z+=(dz/d*5+dx/d*7)*dt;s.v*=Math.pow(.97,dt*30);if(s.shield<=0)s.hp-=6*dt}}
  for(const p of w.pickups){if(p.cooldown<=0&&!s.raider&&d2(s,p)<6.5){if(p.kind==='repair')s.hp=Math.min(100,s.hp+45);else{s.rapid=6;s.boost=0}p.cooldown=15;emit(p.kind,{id:s.id,x:p.x,z:p.z})}}
  if(u.fire&&s.fire<=0){
   s.fire=(s.rapid>0?.24:.55)*(s.ai?(s.raider?2.4:1.8):1);
   let a=aimAt(w,s,s.ai?.3:.5,64);if(s.ai)a+=(Math.random()-.5)*.22*(1.2-(s.brain?.skill||.5));
   w.shots.push({x:s.x+Math.sin(s.a)*6,z:s.z+Math.cos(s.a)*6,a,owner:s.id,t:1.1,damage:s.raider?12:18});
   emit('fire',{id:s.id,x:s.x+Math.sin(s.a)*6,z:s.z+Math.cos(s.a)*6,a:s.a});
  }
  // Ramming: boost into a rival to smash them. Ram the flag carrier to steal the flag outright.
  if(s.surge>0)for(const e of w.ships){if(!canHit(s,e)||s.rammed.includes(e.id)||d2(s,e)>7.5)continue;s.rammed.push(e.id);
   const dx=e.x-s.x,dz=e.z-s.z,d=Math.hypot(dx,dz)||1;e.x+=dx/d*3;e.z+=dz/d*3;e.v=-3;s.v*=.5;
   if(e.shield<=0){e.hp-=25;e.hitT=.3;e.lastBy=s.id}emit('ram',{id:e.id,by:s.id,x:e.x,z:e.z});
   if(w.flag.carrier===e.id&&e.shield<=0){if(s.raider)dropFlag(w,e);else{w.flag.carrier=s.id;e.capture=0;s.shield=Math.max(s.shield,2.5);w.flag.held=0;emit('steal',{id:s.id,from:e.id,x:s.x,z:s.z})}}}
  if(s.hp<=0){s.hp=0;s.dead=RESPAWN;s.v=0;if(w.flag.carrier===s.id){dropFlag(w,s);emit('drop',{id:s.id,x:s.x,z:s.z})}const k=w.ships.find(x=>x.id===s.lastBy);if(k)k.sinks++;emit('sink',{id:s.id,by:s.lastBy,x:s.x,z:s.z})}
 }
 for(const p of w.shots){p.t-=dt;p.x+=Math.sin(p.a)*60*dt;p.z+=Math.cos(p.a)*60*dt;const o=w.ships.find(x=>x.id===p.owner);
  for(const s of w.ships){if(!canHit(o||{},s)||s.id===p.owner||d2(p,s)>4.6)continue;p.t=-1;
   if(s.shield>0){emit('block',{id:s.id,by:p.owner,x:p.x,z:p.z});break}
   s.hp-=p.damage;s.hitT=.25;s.lastBy=p.owner;emit('hit',{id:s.id,by:p.owner,x:p.x,z:p.z,dmg:p.damage});break}
  if(p.t<=0&&p.t>-1)emit('splash',{x:p.x,z:p.z})}
 w.shots=w.shots.filter(p=>p.t>0);
 const f=w.flag;
 if(f.dropped>0){f.dropped-=dt;if(f.dropped<=0){f.dropped=0;f.x=f.home.x;f.z=f.home.z;emit('return',{x:f.x,z:f.z})}}
 if(f.returnAt>0){f.returnAt-=dt;if(f.returnAt<=0){f.returnAt=0;f.x=f.home.x;f.z=f.home.z;emit('spawn',{x:f.x,z:f.z})}}
 if(!f.carrier&&f.returnAt<=0)for(const s of w.ships)if(!s.raider&&!s.dead&&d2(s,f)<7.5){f.carrier=s.id;f.dropped=0;f.held=0;s.shield=Math.max(s.shield,2.5);emit('pickup',{id:s.id,x:s.x,z:s.z});break}
 if(f.carrier){const s=w.ships.find(x=>x.id===f.carrier);f.held=(f.held||0)+dt;f.x=s.x;f.z=s.z;
  if(d2(s,buoy(s))<CAPTURE_R){s.capture+=dt;if(s.capture>=CAPTURE_T){s.score++;s.capture=0;f.carrier=null;f.returnAt=3;
   const spots=FLAG_SPOTS.filter(p=>d2(p,f.home)>1);f.home={...spots[Math.floor(Math.random()*spots.length)]};f.x=f.home.x;f.z=f.home.z;
   emit('stash',{id:s.id,x:s.x,z:s.z});if(s.score>=WIN||w.sudden)finish(w,s.id,w.sudden?'sudden-death':'stashes')}}
  else s.capture=Math.max(0,s.capture-dt*1.5)}
 if(w.remaining<=0&&!w.sudden&&!w.over){const cs=w.ships.filter(s=>!s.raider),top=Math.max(...cs.map(s=>s.score)),leaders=cs.filter(s=>s.score===top);if(leaders.length===1)finish(w,leaders[0].id,'time');else{w.sudden=true;emit('sudden',{})}}
}
function finish(w,id,reason){w.over=true;w.winner=id;w.reason=reason}
export function freshMatch(w){return createWorld(w.ships.filter(s=>!s.raider).map(s=>({id:s.id,name:s.name,ai:s.ai})),Math.random()*1e9)}
