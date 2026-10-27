import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,buoy,WIN,CAPTURE_T} from '../games/sea-of-chaos/simulation.js';

const solo=()=>createWorld([{id:'me',name:'Me'},...Array.from({length:4},(_,i)=>({id:`ai${i}`,name:`Bot ${i}`,ai:true}))]);
const run=(w,secs,inputs={})=>{for(let i=0;i<secs*30&&!w.over;i++)step(w,typeof inputs==='function'?inputs(w):inputs,1/30)};

test('bot-only matches finish by stashes within a few minutes',()=>{
 for(let g=0;g<5;g++){const w=createWorld(Array.from({length:5},(_,i)=>({id:`a${i}`,ai:true})));run(w,400);assert.ok(w.over,'match should end');assert.ok(w.ships.some(s=>s.score>0))}
});

test('carrying the flag into your buoy ring stashes it',()=>{
 const w=solo(),me=w.ships[0];w.ships.forEach(s=>{if(s!==me)s.dead=99});
 me.x=w.flag.x;me.z=w.flag.z;step(w,{});assert.equal(w.flag.carrier,'me');
 const b=buoy(me);me.x=b.x;me.z=b.z;run(w,CAPTURE_T+.2);
 assert.equal(me.score,1);assert.equal(w.flag.carrier,null);assert.ok(w.flag.returnAt>0);
});

test('first to the win target ends the match',()=>{
 const w=solo(),me=w.ships[0];w.ships.forEach(s=>{if(s!==me)s.dead=999});me.score=WIN-1;
 me.x=w.flag.x;me.z=w.flag.z;step(w,{});const b=buoy(me);me.x=b.x;me.z=b.z;run(w,CAPTURE_T+.2);
 assert.ok(w.over);assert.equal(w.winner,'me');
});

test('boosting into the carrier steals the flag once their shield is gone',()=>{
 const w=solo(),[me,bot]=w.ships;w.ships.forEach(s=>{if(s!==me&&s!==bot)s.dead=99});bot.ai=false;
 w.flag.carrier=bot.id;bot.shield=0;me.shield=0;bot.x=0;bot.z=0;me.x=0;me.z=-5;me.a=0;
 step(w,{me:{boost:1}});
 assert.equal(w.flag.carrier,'me');
});

test('a fresh shield protects the carrier from steals and cannon damage',()=>{
 const w=solo(),[me,bot]=w.ships;w.ships.forEach(s=>{if(s!==me&&s!==bot)s.dead=99});bot.ai=false;
 w.flag.carrier=bot.id;bot.shield=2;bot.x=0;bot.z=0;me.x=0;me.z=-5;me.a=0;
 step(w,{me:{boost:1}});
 assert.equal(w.flag.carrier,bot.id);assert.equal(bot.hp,100);
});

test('cannons auto-aim at a target slightly off the bow',()=>{
 const w=solo(),[me,bot]=w.ships;w.ships.forEach(s=>{if(s!==me&&s!==bot)s.dead=99});bot.ai=false;
 me.x=0;me.z=0;me.a=0;me.shield=0;bot.x=8;bot.z=30;bot.shield=0;w.flag.returnAt=99;
 run(w,.8,{me:{fire:1}});
 assert.ok(bot.hp<100,'shot should connect');
});

test('sinking drops the flag where the carrier went down',()=>{
 const w=solo(),me=w.ships[0];w.flag.carrier='me';me.hp=1;me.lastBy='ai0';me.x=10;me.z=10;me.shield=0;
 w.whirl.push({x:10,z:10,r:7});run(w,.5);
 assert.ok(me.dead>0);assert.equal(w.flag.carrier,null);assert.ok(w.flag.dropped>0);
});
