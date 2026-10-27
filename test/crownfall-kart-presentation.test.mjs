import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const D=require('../games/crownfall-kart/engine/data.js');
const T=require('../games/crownfall-kart/engine/track.js');
const score=require('../games/crownfall-kart/engine/score.js');
// Presentation scripts are classic browser scripts; load them into a sandbox with the engine globals they read.
function browserScript(file){
  const context={CrownData:D,CrownTrack:T,CrownScore:score,Math};context.window=context;
  vm.runInNewContext(readFileSync(new URL(`../games/crownfall-kart/${file}`,import.meta.url),'utf8'),context);return context;
}
const pitch=frequency=>69+12*Math.log2(frequency/440);
const tonal=list=>list.filter(e=>!['kick','snare','hat'].includes(e.instrument));

test('music intensity rises with position, closeness to rivals and the final checkpoints',()=>{
  const base={place:4,count:8,gap:20,progress:.3};
  assert.ok(score.intensity({...base,place:1})>score.intensity({...base,place:8}));
  assert.ok(score.intensity({...base,gap:3})>score.intensity({...base,gap:40}));
  assert.ok(score.intensity({...base,final:true})>score.intensity(base));
  assert.equal(score.intensity({place:1,count:8,gap:2,progress:1,final:true}),1);
  assert.ok(score.intensity({place:8,count:8,gap:Infinity})<.2);
});

test('music layers step pads -> bass and drums -> full with hysteresis',()=>{
  assert.equal(score.layersFor(.1,1),1);assert.equal(score.layersFor(.45,1),2);assert.equal(score.layersFor(.9,1),3);
  // Sitting just under the rising threshold keeps the current arrangement instead of flickering.
  assert.equal(score.layersFor(.6,3),3);assert.equal(score.layersFor(.32,2),2);assert.equal(score.layersFor(.3,1),1);
  assert.equal(score.layersFor(.2,3),1);assert.equal(score.layersFor(.5,3),2);
  for(let step=0;step<64;step++){
    const pads=score.events(0,step,true,{layers:1}),mid=score.events(0,step,true,{layers:2}),full=score.events(0,step,true,{layers:3});
    assert.ok(pads.every(e=>score.LAYER[e.instrument]===1));
    assert.ok(mid.every(e=>score.LAYER[e.instrument]<=2));
    assert.ok(pads.length<=mid.length&&mid.length<=full.length);
  }
  assert.ok(Array.from({length:64},(_,s)=>score.events(0,s,true,{layers:2})).flat().some(e=>e.instrument==='bass'));
  assert.ok(!Array.from({length:64},(_,s)=>score.events(0,s,true,{layers:2})).flat().some(e=>e.instrument==='lead'));
});

test('final stretch, stinger and fanfares stay in each course key',()=>{
  for(let track=0;track<score.THEMES.length;track++){
    for(let step=0;step<512;step++)for(const final of [false,true])for(const e of tonal(score.events(track,step,true,{final})))assert.ok(score.inKey(track,pitch(e.frequency)),`${track}:${step}:${e.instrument}`);
    for(const e of tonal([...score.stinger(track),...score.fanfare(track,true),...score.fanfare(track,false)]))assert.ok(score.inKey(track,pitch(e.frequency)),`cue ${track}`);
  }
  // The final stretch drops the breakdown (bar 12) so the drums keep driving, and lifts the lead an octave.
  const breakdown=16*12;assert.ok(!score.events(0,breakdown,true).some(e=>e.instrument==='kick'));assert.ok(score.events(0,breakdown,true,{final:true}).some(e=>e.instrument==='kick'));
  const lead=f=>score.events(0,0,true,{final:f}).find(e=>e.instrument==='lead').frequency;assert.ok(Math.abs(lead(true)/lead(false)-2)<1e-9);
});

test('countdown stinger rises and lands on the tonic at GO; the win fanfare is brighter than the outro',()=>{
  const sting=score.stinger(2,3),bells=sting.filter(e=>e.instrument==='bell');
  for(let i=1;i<bells.length;i++){assert.ok(bells[i].frequency>bells[i-1].frequency);assert.ok(bells[i].at>bells[i-1].at);}
  assert.ok(bells.at(-1).at<3);assert.ok(sting.some(e=>e.at===3&&e.instrument==='kick'));
  const top=list=>Math.max(...tonal(list).map(e=>e.frequency));
  assert.ok(top(score.fanfare(2,true))>top(score.fanfare(2,false)));
  assert.ok(score.fanfare(2,false).every(e=>e.gain<=.08));
});

test('engine RPM follows speed through fake gear shifts and doppler pans and pitches passing karts',()=>{
  const {KartAudio}=browserScript('audio.js');
  let last=KartAudio.engineRpm(0,35),shifts=0;
  for(let speed=.5;speed<=40;speed+=.5){const now=KartAudio.engineRpm(speed,35);if(now.gear>last.gear){shifts++;assert.ok(now.rpm<last.rpm);}else assert.ok(now.rpm>=last.rpm);last=now;}
  assert.equal(shifts,4);assert.equal(last.gear,5);
  assert.ok(KartAudio.ENGINE_TONE.heavy.base<KartAudio.ENGINE_TONE.medium.base&&KartAudio.ENGINE_TONE.medium.base<KartAudio.ENGINE_TONE.light.base);
  const me={x:0,z:0,vx:0,vz:0,yaw:0};
  const approaching=KartAudio.doppler(me,{x:0,z:12,vx:0,vz:-25}),leaving=KartAudio.doppler(me,{x:0,z:12,vx:0,vz:25});
  assert.ok(approaching.factor>1&&leaving.factor<1);
  // Facing +z, screen right is -x.
  assert.ok(KartAudio.doppler(me,{x:-6,z:0}).pan>.5);assert.ok(KartAudio.doppler(me,{x:6,z:0}).pan<-.5);
  assert.ok(KartAudio.doppler(me,{x:0,z:4}).gain>KartAudio.doppler(me,{x:0,z:30}).gain);assert.equal(KartAudio.doppler(me,{x:0,z:60}).gain,0);
});

test('the final-stretch flag covers the last two checkpoints of a sprint and lap race',()=>{
  const {KartAudio}=browserScript('audio.js'),track=T.makeTrack(1);
  assert.ok(!KartAudio.finalStretch({mode:'sprint',racers:[]},{gate:7}));assert.ok(KartAudio.finalStretch({mode:'sprint',racers:[]},{gate:8}));
  assert.ok(!KartAudio.finalStretch({mode:'race',laps:2,trackIndex:1,racers:[]},{gate:2*track.gates-3}));
  assert.ok(KartAudio.finalStretch({mode:'race',laps:2,trackIndex:1,racers:[]},{gate:2*track.gates-2}));
});
