import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),T=require('../games/crownfall-kart/engine/track.js'),S=require('../games/crownfall-kart/engine/simulation.js');

function racing(mode='trial',track=0){const w=S.createWorld({mode,track,seed:173});w.phase='racing';w.countdown=0;return w;}
function place(k,track,s,speed=35){const p=T.sample(track,s);Object.assign(k,{x:p.x,y:p.y+.65,z:p.z,yaw:p.heading,s:p.s,segment:p.segment,distance:s,gate:Math.floor(s/(track.length/track.gates)),speed,vx:Math.sin(p.heading)*speed,vz:Math.cos(p.heading)*speed});}

test('a launch line has continuous road height until the actual broken edge on all eight maps',()=>{
 for(let index=0;index<8;index++){
  const t=T.makeTrack(index);
  for(const ramp of t.ramps){
   const before=T.sample(t,ramp*t.length-.45),after=T.sample(t,ramp*t.length+.45);
   assert.ok(Math.abs(after.y-before.y)<1.2,`${t.name}: road must not drop at the launch line`);
  }
 }
});

test('gap warnings follow arc distance through crossings and wrap across the start line',()=>{
 for(let index=0;index<8;index++){
  const t=T.makeTrack(index);
  assert.ok(t.turns.length>=5,`${t.name}: actual bends need calls`);
  for(const g of t.gaps){
   const cue=T.guidance(t,g.start*t.length-12,35);
   assert.equal(cue.kind,'gap',t.name);assert.ok(Math.abs(cue.distance-12)<.001);
   assert.ok(Math.abs(cue.length-(g.end-g.start)*t.length)<.001);
  }
  const g=t.gaps[0];if(g){
   assert.deepEqual(T.guidance(t,g.start*t.length-12-t.length,35),T.guidance(t,g.start*t.length-12,35));
  }
  for(const turn of t.turns){
   let signed=0;
   for(let d=-8;d<18;d+=2){const a=T.sample(t,turn.s+d).heading,b=T.sample(t,turn.s+d+2).heading;signed+=Math.atan2(Math.sin(b-a),Math.cos(b-a));}
   assert.equal(turn.side,signed>0?'left':'right');assert.equal(T.inGap(t,turn.s),false);
  }
 }
});

test('a tier-three release covers more ground and retains a stronger boost than tier one',()=>{
 function run(level){
  const w=racing('battle'),k=w.racers[0];w.racers=w.racers.slice(0,2);w.racers[1].human=true;w.boxes=[];
  Object.assign(k,{x:0,z:-25,yaw:0,vx:0,vz:20,speed:20,drift:true,wasDrift:true,driftLevel:level});
  for(let i=0;i<60;i++)S.step(w,{player:{throttle:1,assist:false}});
  return k;
 }
 const low=run(1),high=run(3);
 assert.ok(high.z>low.z+5,'the higher tier must buy real distance');
 assert.ok(high.speed>low.speed+5);assert.ok(high.boost>low.boost+.8);
});

test('a well-timed hop clears a floor mine that hits the same kart on the ground',()=>{
 function run(hop){
  const w=racing('battle'),k=w.racers[0],other=w.racers[1];w.racers=[k,other];other.human=true;w.boxes=[];
  Object.assign(k,{x:0,z:-5.2,y:6.65,yaw:0,vx:0,vz:25,speed:25});Object.assign(other,{x:30,z:20});
  w.traps=[{id:1,owner:other.id,x:0,z:0,y:6.35,age:1}];
  for(let i=0;i<35;i++)S.step(w,{player:{throttle:1,hop:hop&&i===0,assist:false}});
  return k;
 }
 assert.ok(run(false).spin>0);assert.equal(run(true).spin,0);
});

test('timed takeoff and landing taps earn actual boost time; a basic ramp jump remains safe',()=>{
 function run(takeoff,landing){
  const w=racing(),t=T.makeTrack(0),k=w.racers[0];w.time=1;place(k,t,t.ramps[0]*t.length-2);
  let launched=false,tapped=false,launchedAt=0;
  for(let i=0;i<180;i++){
   const tap=landing&&!tapped&&k.launchedAt!=null&&k.vy<0&&k.y-T.sample(t,k.s).y<1.5;
   if(tap)tapped=true;
   S.step(w,{player:{throttle:1,hop:takeoff&&i===0||tap,assist:true}});
   if(!launched&&k.launchedAt!=null)launchedAt=w.time;
   launched ||= k.launchedAt!=null;
   if(launched&&k.grounded)break;
  }
  assert.ok(launched&&k.grounded);assert.equal(k.lastReset,-10,'a basic launch must still reach its landing');
  return {k,flight:w.time-launchedAt};
 }
 const a=run(false,false),b=run(true,false),c=run(true,true),basic=a.k,takeoff=b.k,combo=c.k;
 assert.ok(b.flight<a.flight-.03,'a timed takeoff must reach the landing sooner');
 assert.equal(basic.boost,0);assert.ok(takeoff.boost>1);assert.ok(combo.boost>takeoff.boost+.5);
 assert.ok(combo.boostExtra>takeoff.boostExtra+5);assert.equal(combo.notice,'PERFECT JUMP COMBO');
});

test('using drifts beats plain steering on both continuous, winding tracks without a stat advantage',()=>{
 for(const index of [1,5]){
  function lap(skill){
   const w=racing('trial',index);w.laps=1;let falls=0;
   for(let i=0;i<60*100&&w.phase!=='results';i++){
    const k=w.racers[0],before=k.lastReset,input=S.aiInput(w,k,S.STEP);
    if(!skill)input.drift=false;
    S.step(w,{player:input});falls+=before!==k.lastReset;
   }
   assert.equal(w.phase,'results');assert.equal(falls,0);assert.equal(w.racers[0].aiSpeed,1);
   return w.time;
  }
  assert.ok(lap(true)<lap(false)-1,`track ${index}: clean drifting must save lap time`);
 }
});
