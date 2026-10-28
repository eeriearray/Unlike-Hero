import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {duel,plain,Bot,B} from './dragon-clash-helpers.mjs';
const S=createRequire(import.meta.url)('../games/crownfall-kart/engine/simulation.js');
test('Crownfall validates difficulty and preserves it across snapshots and Grand Prix rounds',()=>{
 for(const difficulty of ['easy','normal','hard']){
  const w=S.createWorld({mode:'gp',difficulty});assert.equal(S.snapshot(w).difficulty,difficulty);
  w.phase='results';assert.equal(S.nextGrandPrix(w).difficulty,difficulty);
 }
 for(const bad of ['__proto__','impossible',null,123])assert.equal(S.createWorld({difficulty:bad}).difficulty,'normal');
});
test('Crownfall harder CPUs run faster, while human driving is unchanged',()=>{
 const values=['easy','normal','hard'].map(difficulty=>{
  const w=S.createWorld({difficulty,mode:'battle'});w.phase='racing';
  for(let i=0;i<60;i++)S.step(w,{'player':{throttle:1,steer:0,assist:false}},S.STEP);
  return {cpu:w.racers[1].aiSpeed,human:w.racers[0].aiSpeed};
 });
 assert.ok(values[0].cpu<values[1].cpu&&values[1].cpu<values[2].cpu);
 assert.deepEqual(values.map(v=>v.human),[1,1,1]);
});
test('Impossible confirms a hit into a legal stronger attack without changing fighter stats',()=>{
 const {sim,A,T}=duel(plain('fire'),plain('ice'));
 const bot=new Bot(sim,0,{level:6});
 A.state='attack';A.hitConfirm=true;A.moveKind='light';A.moveDef={startup:1,active:5};A.moveT=2;
 const before=JSON.stringify(A);const input=bot.think();
 assert.ok(input.held&B.heavy);assert.equal(JSON.stringify(A),before);
});
test('all advanced CPU tiers release attacks so later presses register',()=>{
 for(const level of [4,5,6]){
  const {sim}=duel(plain('fire'),plain('ice'));
  const bot=new Bot(sim,0,{level});const outputs=[];
  for(let i=0;i<30;i++){bot.press(B.light,2);outputs.push(bot.think().held&B.light);}
  assert.ok(outputs.some(v=>v===0));assert.ok(outputs.some(v=>v!==0));
  assert.ok(bot.cfg.react<Bot.LEVELS[3].react);
 }
});
