export const ARENA=100, WIN=3;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), d2=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function createWorld(captains,seed=Date.now()){
 const palette=['#e9b84d','#e65d50','#5fc5b0','#9283dc','#d7894e','#92b857','#ed7eb0','#54a6df'];
 const ships=captains.slice(0,8).map((c,i)=>({id:c.id,name:c.name||`Captain ${i+1}`,color:palette[i%palette.length],x:Math.cos(i*Math.PI*2/Math.max(2,captains.length))*69,z:Math.sin(i*Math.PI*2/Math.max(2,captains.length))*69,a:i*Math.PI*2/Math.max(2,captains.length)+Math.PI/2,v:0,hp:100,score:0,dead:0,ai:!!c.ai,buoyA:i*Math.PI*2/Math.max(2,captains.length),capture:0,fire:0,ram:0,boost:0,ammo:[16,8,12]}));
 for(let i=0;i<2;i++)ships.push({id:`raider-${i}`,name:`Sea Raider ${i+1}`,color:'#c45d68',x:i?50:-50,z:i?-48:48,a:Math.PI,v:0,hp:100,score:0,dead:0,ai:true,raider:true,buoyA:0,capture:0,fire:0,ram:0,boost:0,ammo:[999,999,999]});
 return {t:0,remaining:240,ships,flag:{x:0,z:0,carrier:null,dropped:0,returnAt:0},shots:[],pickups:[{x:-54,z:-7,kind:'repair',cooldown:0},{x:48,z:34,kind:'ammo',cooldown:0},{x:2,z:-63,kind:'repair',cooldown:0}],whirl:[{x:-30,z:4,r:7,phase:0},{x:32,z:-23,r:7,phase:2}],seed,over:false,events:[],current:0};
}
export function buoy(s){return{x:Math.cos(s.buoyA)*78,z:Math.sin(s.buoyA)*78}}
export function step(w,inputs,dt=1/30){if(w.over)return;w.events=[];w.t+=dt;w.remaining-=dt;w.current+=dt*.24;
 for(const s of w.ships){if(s.dead>0){s.dead-=dt;if(s.dead<=0){const b=buoy(s);s.x=b.x;s.z=b.z;s.hp=100;s.v=0;s.ammo=[16,8,12];w.events.push({type:'respawn',id:s.id})}continue}const u=inputs[s.id]||{};if(s.ai){const carrier=w.ships.find(x=>x.id===w.flag.carrier);let goal;if(s.raider)goal=carrier||{x:w.flag.x,z:w.flag.z};else goal=w.flag.carrier===s.id?buoy(s):carrier||{x:w.flag.x,z:w.flag.z};const aim=Math.atan2(goal.x-s.x,goal.z-s.z);u.turn=clamp(Math.atan2(Math.sin(aim-s.a),Math.cos(aim-s.a)),-1,1);u.throttle=.8;u.fire=s.fire<=0&&d2(s,goal)<48?1:0;u.boost=0;u.ram=0}
 s.fire=Math.max(0,s.fire-dt);s.boost=Math.max(0,s.boost-dt);s.ram=Math.max(0,s.ram-dt);s.a+=clamp(u.turn||0,-1,1)*dt*(1.45+Math.abs(s.v)*.015);s.v=clamp(s.v+(u.throttle||0)*dt*17,-7,11);if(u.boost&&s.boost<=0){s.boost=1.1;s.v=Math.min(16,s.v+4);w.events.push({type:'boost',id:s.id})}s.v*=Math.pow(.985,dt*30);s.x+=Math.sin(s.a)*s.v*dt;s.z+=Math.cos(s.a)*s.v*dt;
 const rr=Math.hypot(s.x,s.z);if(rr>94){s.x*=94/rr;s.z*=94/rr;s.v*=-.3;s.hp-=3;}
 for(const isl of ISLANDS){if(Math.hypot(s.x-isl.x,s.z-isl.z)<isl.r+2){s.x-=Math.sin(s.a)*s.v*dt*2;s.z-=Math.cos(s.a)*s.v*dt*2;s.v*=-.45;s.hp-=4}}
 for(const h of w.whirl)if(Math.hypot(s.x-h.x,s.z-h.z)<h.r){s.hp-=13*dt;s.v*=.96;if(w.flag.carrier===s.id){w.flag.carrier=null;w.flag.x=s.x;w.flag.z=s.z;w.flag.dropped=12;w.events.push({type:'drop',id:s.id})}}
 for(const p of w.pickups){if(p.cooldown>0)p.cooldown-=dt;if(p.cooldown<=0&&d2(s,p)<7){if(p.kind==='repair'){s.hp=Math.min(100,s.hp+38);w.events.push({type:'repair',id:s.id})}else{s.ammo[0]+=6;s.ammo[1]+=4;s.ammo[2]+=5;w.events.push({type:'ammo',id:s.id})}p.cooldown=18}}
 if(u.fire&&s.fire<=0){const type=Math.max(1,Math.min(3,u.ammo||1)),idx=type-1;if(s.ammo[idx]>0){s.ammo[idx]--;s.fire=type===2?1.1:.72;w.shots.push({x:s.x+Math.sin(s.a)*5,z:s.z+Math.cos(s.a)*5,a:s.a,owner:s.id,t:type===2?1.2:1.5,damage:[22,16,11][idx],type});w.events.push({type:'fire',id:s.id})}}
 if(u.ram&&s.ram<=0){s.ram=2;for(const e of w.ships)if(e!==s&&!e.dead&&d2(s,e)<10){e.hp-=32;e.v-=4;w.events.push({type:'hit',id:e.id,by:s.id})}}
 if(s.hp<=0){s.dead=8;s.v=0;s.hp=0;if(w.flag.carrier===s.id){w.flag.carrier=null;w.flag.x=s.x;w.flag.z=s.z;w.flag.dropped=12}w.events.push({type:'sink',id:s.id})}
 }
 for(const p of w.shots){p.t-=dt;p.x+=Math.sin(p.a)*48*dt;p.z+=Math.cos(p.a)*48*dt;for(const s of w.ships)if(s.id!==p.owner&&!s.dead&&d2(p,s)<5){s.hp-=p.damage||22;p.t=0;w.events.push({type:'hit',id:s.id,by:p.owner})}}w.shots=w.shots.filter(p=>p.t>0);
 if(w.flag.dropped>0){w.flag.dropped-=dt;if(w.flag.dropped<=0){w.flag.carrier=null;w.flag.x=0;w.flag.z=0;w.flag.returnAt=0;w.events.push({type:'return'})}}
 if(!w.flag.carrier&&w.flag.returnAt<=0){for(const s of w.ships)if(!s.raider&&!s.dead&&d2(s,w.flag)<8){w.flag.carrier=s.id;w.flag.dropped=0;w.events.push({type:'pickup',id:s.id});break}}
 if(w.flag.carrier){const s=w.ships.find(x=>x.id===w.flag.carrier);if(s&&!s.dead){w.flag.x=s.x;w.flag.z=s.z;const b=buoy(s);if(d2(s,b)<12){s.capture+=dt;if(s.capture>=2){s.score++;s.capture=0;w.flag.carrier=null;w.flag.x=0;w.flag.z=0;w.flag.returnAt=3;w.events.push({type:'stash',id:s.id});if(s.score>=WIN||w.sudden)finish(w,s.id,w.sudden?'sudden-death':'stashes')}}else s.capture=0;if(Math.abs(s.x)>100||Math.abs(s.z)>100){w.flag.carrier=null;s.capture=0}}}
 if(w.flag.returnAt>0){w.flag.returnAt-=dt;if(w.flag.returnAt<=0)w.events.push({type:'return'})}
 if(w.remaining<=0&&!w.over){w.remaining=0;const cs=w.ships.filter(s=>!s.raider),top=Math.max(...cs.map(s=>s.score)),leaders=cs.filter(s=>s.score===top);if(leaders.length===1)finish(w,leaders[0].id,'time');else w.sudden=true}
}
function finish(w,id,reason){w.over=true;w.winner=id;w.reason=reason}
export const ISLANDS=[{x:-34,z:-27,r:12},{x:36,z:31,r:13}];
export function freshMatch(w){return createWorld(w.ships.filter(s=>!s.raider).map(s=>({id:s.id,name:s.name,ai:s.ai})),Math.random()*1e9)}
