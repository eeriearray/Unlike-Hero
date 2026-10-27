import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const D=require('../games/crownfall-kart/engine/data.js');
const T=require('../games/crownfall-kart/engine/track.js');
const S=require('../games/crownfall-kart/engine/simulation.js');
const trial=()=>{const w=S.createWorld({mode:'trial'});w.phase='racing';return w;};

test('every closed track round-trips arc length and lane projection',()=>{
  for(let index=0;index<D.TRACKS.length;index++){
    const track=T.makeTrack(index);assert.ok(track.length>550);
    assert.deepEqual(track.points[0],track.points[track.count]);
    for(let i=0;i<30;i++){
      const p=T.sample(track,i/30*track.length,2),q=T.project(track,p.x,p.z,p.segment);
      assert.ok(Math.abs(D.angle((p.s-q.s)/track.length*Math.PI*2))<.03);
      assert.ok(Math.abs(q.lane-2)<.15);
    }
  }
});

test('weighted loot obeys placement bands and expected proportions',()=>{
  for(const[place,band]of [[1,'front'],[2,'front'],[4,'middle'],[8,'last']]){
    const rng=D.rng(173),counts={};for(let i=0;i<30000;i++){const item=D.rollItem(place,8,rng);counts[item]=(counts[item]||0)+1;}
    for(const[key,weight]of D.LOOT[band])assert.ok(Math.abs(counts[key]/30000-weight/100)<.015);
    assert.deepEqual(Object.keys(counts).sort(),D.LOOT[band].map(row=>row[0]).sort());
  }
  const rng=D.rng(123);for(let i=0;i<100;i++){const item=D.rollItem(2,2,rng);assert.ok(D.LOOT.last.some(([key])=>key===item));}
});

test('input sanitization rejects nonfinite values and preserves discrete actions across packets',()=>{
  assert.deepEqual(S.cleanInput({throttle:Infinity,steer:NaN,drift:'true'}),S.emptyInput());
  const merged=S.mergeInput({hop:true,use:true,reset:true},{throttle:90,steer:-90,drift:false});
  assert.equal(merged.throttle,1);assert.equal(merged.steer,-1);assert.equal(merged.hop,true);assert.equal(merged.use,true);assert.equal(merged.reset,true);
});

test('light acceleration exceeds heavy, while heavy has the higher top speed and mass',()=>{
  function accelerate(classId){const w=trial(),k=w.racers[0];k.classId=classId;for(let i=0;i<40;i++)S.step(w,{player:{throttle:1}});return k.speed;}
  assert.ok(accelerate('light')>accelerate('heavy')+3);
  assert.ok(D.CLASSES.heavy.speed>D.CLASSES.medium.speed&&D.CLASSES.medium.speed>D.CLASSES.light.speed);
  assert.ok(D.CLASSES.heavy.mass>D.CLASSES.light.mass*2);
});

test('a latched short hop executes once even if held state is already released',()=>{
  const w=trial(),k=w.racers[0];S.step(w,{player:{hop:true,drift:false}});assert.equal(k.grounded,false);assert.ok(k.vy>3);
  const start=k.vy;S.step(w,{player:{drift:false}});assert.ok(k.vy<start);
});

test('turbo release rewards once and resets the accumulated charge',()=>{
  const w=trial(),k=w.racers[0];Object.assign(k,{wasDrift:true,drift:true,driftLevel:3,driftTime:2.4,speed:18});
  S.step(w,{player:{drift:false,throttle:1}});assert.ok(k.boost>1);assert.equal(k.driftLevel,0);assert.equal(k.driftTime,0);
  const boost=k.boost;S.step(w,{player:{drift:false,throttle:1}});assert.ok(k.boost<boost);
});

test('only a recent airborne trick press rewards a valid ramp landing',()=>{
  function land(age,eligible=true){const w=trial(),k=w.racers[0];w.time=1;k.grounded=false;k.y+=.001;k.vy=-2;k.trickEligible=eligible;k.airStart=.5;k.trickPress=1-age;S.step(w,{});return k;}
  assert.ok(land(.10).boost>0);assert.equal(land(.25).boost,0);assert.equal(land(.10,false).boost,0);
});

test('hits cancel drift and boost, invincibility and hit grace block duplicate damage',()=>{
  const w=S.createWorld({mode:'battle'}),k=w.racers[0];w.phase='racing';k.boost=3;k.drift=true;k.driftLevel=3;
  assert.equal(S.hit(w,k),true);assert.equal(k.balloons,2);assert.equal(k.boost,0);assert.equal(k.driftLevel,0);
  assert.equal(S.hit(w,k),false);assert.equal(k.balloons,2);k.hitGrace=0;k.invincible=1;assert.equal(S.hit(w,k),false);
});

test('expired boost allowances do not leak into later weaker boosts or stack velocity indefinitely',()=>{
  const w=trial(),k=w.racers[0];S.boost(w,k,16,1,18);k.boost=0;S.boost(w,k,5,1,7);assert.equal(k.boostExtra,7);
  for(let i=0;i<100;i++)S.boost(w,k,16,1,18);
  assert.ok(Math.hypot(k.vx,k.vz)<=D.CLASSES[k.classId].speed+18+.001);
});

test('mud reduces attainable speed and a boost bypasses it',()=>{
  const w=trial(),k=w.racers[0],track=T.makeTrack(0),p=T.sample(track,track.length*.635,-5);
  Object.assign(k,{x:p.x,y:p.y+.65,z:p.z,yaw:p.heading,s:p.s,segment:p.segment,distance:p.s,gate:7,lane:-5,vx:Math.sin(p.heading)*30,vz:Math.cos(p.heading)*30,speed:30});
  S.step(w,{player:{throttle:1}});assert.equal(k.surface,'mud');const slowed=k.speed;
  S.boost(w,k,10,1.4,13);S.step(w,{player:{throttle:1}});assert.ok(k.speed>slowed+5);
});

test('respawn resumes near validated progress with a rolling start and invalidates a time-trial record',()=>{
  const w=trial(),k=w.racers[0],track=T.makeTrack(0);k.gate=4;k.distance=track.length*4.5/12;k.boost=2;k.driftLevel=3;
  S.respawn(w,k);assert.ok(Math.abs(k.distance-(track.length*4.5/12-6))<.001);assert.equal(k.gate,4);assert.equal(k.boost,0);assert.equal(k.driftLevel,0);assert.equal(w.recordValid,false);
  assert.ok(k.speed>10);
  // Never behind the last validated gate.
  k.distance=4*track.length/12+2;S.respawn(w,k);assert.ok(Math.abs(k.distance-(4*track.length/12+1))<.001);
});

test('a fall at a gap respawns with a run-up before the ramp',()=>{
  const w=trial(),k=w.racers[0],track=T.makeTrack(0),ramp=track.ramps[0]*track.length;k.gate=Math.floor(ramp/(track.length/12));k.distance=ramp+6;
  S.respawn(w,k);assert.ok(k.distance<ramp-20&&k.distance>=k.gate*track.length/12);
});

test('every gap jump lands on the road from an assisted run',()=>{
  for(let index=0;index<8;index++){
    const w=S.createWorld({mode:'sprint',track:index,seed:4});w.phase='racing';w.countdown=0;let resets=0;
    for(let i=0;i<60*70&&w.racers[0].finishTime==null;i++){const before=w.racers[0].lastReset;S.step(w,{player:{throttle:1,steer:0,assist:true}});if(w.racers[0].lastReset!==before)resets++;}
    assert.equal(resets,0,`track ${index}`);assert.ok(w.racers[0].finishTime!=null,`track ${index}`);
  }
});

test('teleporting past unvisited checkpoint sectors cannot finish a lap',()=>{
  const w=trial(),k=w.racers[0],track=T.makeTrack(0),p=T.sample(track,track.length*.7);
  Object.assign(k,{x:p.x,y:p.y+.65,z:p.z});S.step(w,{player:{throttle:1}});
  assert.equal(k.gate,-1);assert.equal(k.finishTime,null);assert.ok(k.distance<10);
});

test('all track variants complete a race with valid finish order and bounded snapshots',()=>{
  for(let track=0;track<D.TRACKS.length;track++){
    const w=S.createWorld({track,seed:173});
    for(let i=0;i<60*200&&w.phase!=='results';i++)S.step(w,{player:S.aiInput(w,w.racers[0],S.STEP)});
    assert.equal(w.phase,'results');assert.ok(w.racers[0].finishTime>20&&w.racers[0].finishTime<200);assert.equal(w.racers[0].gate,24);
    const order=S.standings(w);for(let i=1;i<order.length;i++)if(order[i].finishTime!=null)assert.ok(order[i-1].finishTime<=order[i].finishTime);
    const packet=S.snapshot(w);assert.ok(JSON.stringify(packet).length<16000);assert.equal(packet.random,undefined);
  }
});

test('keyboard, touch and gamepad right inputs move right in the chase camera; left moves left',()=>{
  let pad=null;
  const window={addEventListener(){}},document={querySelectorAll:()=>[]};
  vm.runInNewContext(readFileSync(new URL('../games/crownfall-kart/input.js',import.meta.url),'utf8'),{window,document,CrownSim:S,navigator:{getGamepads:()=>pad?[pad]:[]}});
  const input=new window.KartInput();input.active=true;
  for(const device of ['keyboard','arrows','touch','gamepad'])for(const sign of [-1,1]){
    input.clear();pad=null;
    if(device==='keyboard')input.keys.add(sign===1?'KeyD':'KeyA');
    if(device==='arrows')input.keys.add(sign===1?'ArrowRight':'ArrowLeft');
    if(device==='touch')input.pointers.set(1,sign===1?'right':'left');
    if(device==='gamepad')pad={connected:true,axes:[sign],buttons:[]};
    const controls=input.read();assert.equal(Math.sign(controls.steer),sign,device);if(device==='gamepad')assert.equal(controls.steer,sign);
    const w=trial(),k=w.racers[0],initialYaw=k.yaw;
    k.speed=14;k.vx=Math.sin(initialYaw)*14;k.vz=Math.cos(initialYaw)*14;
    for(let i=0;i<12;i++)S.step(w,{player:{...controls,throttle:1}});
    // Camera forward is +Z in kart space, so camera right is forward × world-up.
    const screenRight=-Math.sin(k.yaw)*Math.cos(initialYaw)+Math.cos(k.yaw)*Math.sin(initialYaw);
    assert.ok(screenRight*sign>.1,`${device}: ${sign===1?'right':'left'} must match the screen`);
  }
  // Digital steering starts as a partial correction and ramps to full lock while held.
  input.clear();pad=null;input.keys.add('KeyD');const tap=input.read().steer;input.lastRead-=500;assert.ok(tap>0&&tap<1);assert.equal(input.read().steer,1);
  input.keys.clear();input.lastRead-=500;assert.equal(input.read().steer,0);
  input.clear();pad=null;input.keys.add('KeyW');assert.equal(input.read().throttle,1);
  input.clear();input.keys.add('KeyS');assert.equal(input.read().throttle,-1);
});

test('the eight maps have different road shapes, rather than scaled copies',()=>{
  assert.equal(D.TRACKS.length,8);assert.equal(new Set(D.TRACKS.map(t=>t.id)).size,8);
  for(let a=0;a<D.TRACKS.length;a++)for(let b=a+1;b<D.TRACKS.length;b++){
    const ta=T.makeTrack(a),tb=T.makeTrack(b);
    // Normalize and align sampled centre lines, including a best-fit rotation, to rule out recolors/rescales.
    const shape=t=>{const points=Array.from({length:48},(_,i)=>T.sample(t,t.length*i/48));
      const mx=points.reduce((s,p)=>s+p.x,0)/points.length,mz=points.reduce((s,p)=>s+p.z,0)/points.length;
      const radius=Math.sqrt(points.reduce((s,p)=>s+(p.x-mx)**2+(p.z-mz)**2,0)/points.length);
      return points.map(p=>[(p.x-mx)/radius,(p.z-mz)/radius]);};
    const sa=shape(ta),sb=shape(tb);let dot=0,cross=0;
    for(let i=0;i<sa.length;i++){dot+=sa[i][0]*sb[i][0]+sa[i][1]*sb[i][1];cross+=sa[i][0]*sb[i][1]-sa[i][1]*sb[i][0];}
    const rotation=Math.atan2(cross,dot),c=Math.cos(rotation),s=Math.sin(rotation);
    const difference=Math.sqrt(sa.reduce((sum,[x,z],i)=>sum+(x*c-z*s-sb[i][0])**2+(x*s+z*c-sb[i][1])**2,0)/sa.length);
    assert.ok(difference>.065,`${ta.name} and ${tb.name} need different layouts (${difference})`);
  }
});

test('a Grand Prix starting on the last new map wraps the full catalog and remains four races',()=>{
  let w=S.createWorld({mode:'gp',track:D.TRACKS.length-1});const visited=[];
  for(let round=0;round<4;round++){
    visited.push(w.trackIndex);
    for(let i=0;i<60*200&&w.phase!=='results';i++)S.step(w,{player:S.aiInput(w,w.racers[0],S.STEP)});
    assert.equal(w.phase,'results');const next=S.nextGrandPrix(w);
    if(round<3){assert.ok(next);w=next;}else assert.equal(next,null);
  }
  assert.deepEqual(visited,[7,0,1,2]);
});

test('Grand Prix runs exactly four rounds and retains every racer’s points',()=>{
  let w=S.createWorld({mode:'gp'});const points={};
  for(let round=0;round<4;round++){
    for(let i=0;i<60*200&&w.phase!=='results';i++)S.step(w,{player:S.aiInput(w,w.racers[0],S.STEP)});
    assert.equal(w.round,round);assert.equal(w.phase,'results');
    for(const k of w.racers){assert.ok(k.points>(points[k.id]||0));points[k.id]=k.points;}
    const next=S.nextGrandPrix(w);if(round<3){assert.ok(next);assert.equal(next.trackIndex,round+1);w=next;}else assert.equal(next,null);
  }
  assert.equal(Object.values(points).reduce((a,b)=>a+b,0),S.POINTS.reduce((a,b)=>a+b,0)*4);
});

test('time trials have no item collection and battle eliminates a kart at zero balloons',()=>{
  const w=trial(),k=w.racers[0],box=w.boxes[0];Object.assign(k,{x:box.x,y:box.y,z:box.z});S.step(w,{});assert.equal(k.item,null);
  const b=S.createWorld({mode:'battle'});b.phase='racing';const victim=b.racers[0];
  for(let i=0;i<3;i++){victim.hitGrace=0;assert.equal(S.hit(b,victim),true);}assert.equal(victim.eliminated,true);assert.equal(victim.balloons,0);
});

test('ghost playback interpolates position and takes the short angular path',()=>{
  const samples=[[0,0,6,0,3.1],[1,10,8,20,-3.1]];
  const pose=S.sampleGhost(samples,.5);assert.equal(pose[0],5);assert.equal(pose[1],7);assert.equal(pose[2],10);assert.ok(Math.abs(Math.abs(pose[3])-Math.PI)<.05);
  assert.equal(S.sampleGhost(samples,1.1),null);assert.equal(S.sampleGhost([],0),null);
});

test('a heavy kart transfers more collision momentum to a light kart than the reverse',()=>{
  function bump(classA,classB){const w=S.createWorld({mode:'battle'});w.phase='racing';
    const a=w.racers[0],b=w.racers[1];for(const k of w.racers.slice(2))k.eliminated=true;
    Object.assign(a,{classId:classA,x:-.8,y:6.65,z:0,yaw:Math.PI/2,vx:18,vz:0,speed:18,human:true});
    Object.assign(b,{classId:classB,x:.8,y:6.65,z:0,yaw:Math.PI/2,vx:0,vz:0,speed:0,human:true});
    S.step(w,{});return b.vx;
  }
  assert.ok(bump('heavy','light')>bump('light','heavy')*2);
});

test('leader hunters reacquire a changed leader and leave other racers unharmed',()=>{
  const w=S.createWorld(),track=T.makeTrack(0);w.phase='racing';
  for(const k of w.racers.slice(3))k.eliminated=true;
  const owner=w.racers[0],a=w.racers[1],b=w.racers[2];
  function place(k,s){const p=T.sample(track,s);Object.assign(k,{distance:s,s:p.s,segment:p.segment,gate:Math.floor(s/(track.length/12)),x:p.x,y:p.y+.65,z:p.z,yaw:p.heading});}
  place(owner,5);place(a,100);place(b,90);S.standings(w);owner.item='hunter';assert.equal(S.useItem(w,owner),true);assert.equal(w.shots[0].target,a.id);
  place(a,80);place(b,110);S.step(w,{});assert.equal(w.shots[0].target,b.id);assert.equal(a.spin,0);
});

test('an invincible target consumes a projectile without losing a balloon',()=>{
  const w=S.createWorld({mode:'battle'});w.phase='racing';const owner=w.racers[0],target=w.racers[1];
  for(const k of w.racers.slice(2))k.eliminated=true;
  Object.assign(owner,{x:0,y:6.65,z:0,yaw:0,item:'bolt',human:true});Object.assign(target,{x:0,y:6.65,z:3,yaw:0,invincible:2,human:true});
  assert.equal(S.useItem(w,owner),true);S.step(w,{});assert.equal(w.shots.length,0);assert.equal(target.balloons,3);
});

test('rubber banding uses unwrapped progress across a lap boundary',()=>{
  const w=S.createWorld(),track=T.makeTrack(0);w.phase='racing';
  const human=w.racers[0],bot=w.racers[1];
  for(const[k,s]of [[human,track.length+5],[bot,track.length-5]]){
    const p=T.sample(track,s);Object.assign(k,{distance:s,s:p.s,segment:p.segment,gate:Math.floor(s/(track.length/12)),x:p.x,y:p.y+.65,z:p.z,yaw:p.heading});
  }
  const near=S.createWorld(),far=S.createWorld();
  for(const world of [near,far]){world.phase='racing';for(const[k,s]of [[world.racers[0],track.length+5+(world===far?100:0)],[world.racers[1],track.length-5]]){
    const p=T.sample(track,s);Object.assign(k,{distance:s,s:p.s,segment:p.segment,gate:Math.floor(s/(track.length/12)),x:p.x,y:p.y+.65,z:p.z,yaw:p.heading});}}
  S.step(near,{});S.step(far,{});
  // Inside the dead zone the bot settles toward its base pace; a human far ahead lets it catch up a little, never above full speed.
  assert.ok(near.racers[1].aiSpeed<1);assert.ok(far.racers[1].aiSpeed>near.racers[1].aiSpeed&&far.racers[1].aiSpeed<=1);
});

test('holding a real powered slide builds charge; a straight hop cannot charge it',()=>{
  function slide(steer){const w=trial(),k=w.racers[0];k.speed=22;k.vx=Math.sin(k.yaw)*22;k.vz=Math.cos(k.yaw)*22;
    for(let i=0;i<61;i++)S.step(w,{player:{throttle:1,steer,drift:true}});return {w,k};}
  const straight=slide(0);assert.equal(straight.k.driftLevel,0);
  const{w,k}=slide(.3);assert.ok(k.driftTime>=.6);assert.ok(k.driftLevel>=1);assert.ok(k.driftAngle>0);
  S.step(w,{player:{throttle:1,steer:.3,drift:false}});assert.ok(k.boost>0);assert.equal(k.drift,false);
});

test('balloon battle reaches an actual last-survivor finish with AI combat',()=>{
  const w=S.createWorld({mode:'battle',seed:173});
  for(let i=0;i<60*180&&w.phase!=='results';i++)S.step(w,{player:S.aiInput(w,w.racers[0],S.STEP)});
  assert.equal(w.phase,'results');assert.equal(w.racers.filter(k=>!k.eliminated).length,1);assert.ok(w.time<180);
  assert.equal(S.standings(w)[0].eliminated,false);
});

test('Rift Sprint finishes at a different point from the start on every course',()=>{
  for(let track=0;track<D.TRACKS.length;track++){
    const w=S.createWorld({mode:'sprint',track}),course=T.makeTrack(track);
    for(let i=0;i<60*150&&w.phase!=='results';i++)S.step(w,{player:S.aiInput(w,w.racers[0],S.STEP)});
    assert.equal(w.phase,'results',course.name);assert.equal(w.racers[0].gate,10);assert.ok(w.racers[0].distance<course.length);assert.ok(w.racers[0].finishTime<150);
    const finish=T.sample(course,course.length*10/12),start=T.sample(course,0);assert.ok(Math.hypot(finish.x-start.x,finish.z-start.z)>20);
  }
});

test('Shattered Crown contains a real crossing with enough clearance for an overpass',()=>{
  const track=T.makeTrack(0);let overpass=false;
  for(let i=0;i<track.count&&!overpass;i+=2)for(let j=i+80;j<track.count;j+=2){
    if(track.count-j+i<80)continue;const a=track.points[i],b=track.points[j];
    if(Math.hypot(a.x-b.x,a.z-b.z)<3&&Math.abs(a.y-b.y)>10){overpass=true;break;}
  }
  assert.ok(overpass);
  assert.ok(Math.max(...T.makeTrack(6).points.map(p=>p.y))>60,'Stormspire actually climbs above sixty metres');
});

test('boost pads reward forward passage without retriggering each physics tick',()=>{
  const w=trial(),k=w.racers[0],track=T.makeTrack(0),pad=T.padPoses(track)[0];
  Object.assign(k,{x:pad.x,y:pad.y+.65,z:pad.z,yaw:pad.heading,s:pad.s,segment:pad.segment,distance:pad.s,gate:Math.floor(pad.s/(track.length/12)),lane:0});
  S.step(w,{player:{throttle:1}});assert.ok(k.boost>0);assert.equal(k.notice,'RIFT PAD BOOST');
  const triggered=k.lastPad;for(let i=0;i<20;i++)S.step(w,{player:{throttle:1}});assert.equal(k.lastPad,triggered);
});

test('gap jumps have a real missing road section and launch the kart before it',()=>{
  const w=trial(),k=w.racers[0],track=T.makeTrack(0),ramp=track.ramps[0],p=T.sample(track,ramp*track.length-.2);
  Object.assign(k,{x:p.x,y:p.y+.65,z:p.z,yaw:p.heading,s:p.s,segment:p.segment,distance:p.s,gate:Math.floor(p.s/(track.length/12)),speed:30,vx:Math.sin(p.heading)*30,vz:Math.cos(p.heading)*30});
  S.step(w,{player:{throttle:1}});assert.equal(k.grounded,false);assert.ok(k.vy>7);assert.equal(k.trickEligible,true);
  const gap=track.gaps[0];assert.ok(T.inGap(track,(gap.start+gap.end)/2*track.length));
});

test('the soundtrack has percussion, bass, harmony and melody with bounded finite voices',()=>{
  const score=require('../games/crownfall-kart/engine/score.js');assert.equal(score.THEMES.length,D.TRACKS.length);
  const instruments=new Set();let uniqueLead=new Set();
  for(let track=0;track<score.THEMES.length;track++)for(let step=0;step<512;step++){
    const events=score.events(track,step,true);assert.ok(events.length<16);
    for(const event of events){assert.ok(Number.isFinite(event.frequency)&&event.frequency>20&&event.frequency<20000);assert.ok(event.duration>0&&event.duration<2);assert.ok(event.gain>0&&event.gain<=1);instruments.add(event.instrument);if(event.instrument==='lead')uniqueLead.add(event.frequency.toFixed(2));}
  }
  for(const instrument of ['kick','snare','hat','bass','pad','lead'])assert.ok(instruments.has(instrument));assert.ok(uniqueLead.size>12);
  for(let step=0;step<64;step++)assert.ok(score.events(0,step,false).every(e=>['pad','bell'].includes(e.instrument)));
});

test('steering assist follows a sprint while manual steering always takes priority',()=>{
  const assisted=S.createWorld({mode:'sprint'});
  for(let i=0;i<60*100&&assisted.phase!=='results';i++)S.step(assisted,{player:{throttle:1,assist:true}});
  assert.equal(assisted.phase,'results');assert.equal(assisted.racers[0].gate,10);
  const a=trial(),b=trial();for(const w of[a,b]){const k=w.racers[0];k.speed=18;k.vx=Math.sin(k.yaw)*18;k.vz=Math.cos(k.yaw)*18;}
  for(let i=0;i<15;i++){S.step(a,{player:{throttle:1,steer:.7,assist:true}});S.step(b,{player:{throttle:1,steer:.7,assist:false}});}
  assert.equal(a.racers[0].yaw,b.racers[0].yaw);assert.equal(a.racers[0].x,b.racers[0].x);assert.equal(a.racers[0].z,b.racers[0].z);
  assert.equal(S.cleanInput({assist:false}).assist,false);
});
