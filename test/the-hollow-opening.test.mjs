import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { HollowGame } = require('../games/the-hollow/engine/index.js');
function make(n = 1, opening = true) {
  let now = 1000;
  const g = new HollowGame({seed:19, code:'OPEN', now:()=>now});
  for(let i=0;i<n;i++) { g.addPlayer({id:'p'+i,name:'Reader '+i}); g.command('p'+i,{t:'pick',cls:['medium','hunter'][i]});g.command('p'+i,{t:'ready'}); }
  assert.ok(g.command('p0',{t:'start',opening}).ok);
  g.d20 = ()=>1;
  return {g, wait:ms=>{now+=ms;g.tick();}};
}
function act(g, loc, opt, pid='p0', extra={}) {
  const p=g.get(pid); p.loc=loc;g.markSeen(loc);g.turn.active=pid;g.turn.ap=3;g.turn.enc=null;
  assert.ok(g.command(pid,{t:'interact'}).ok);
  const r=g.command(pid,{t:'choose',enc:g.turn.enc.id,opt,...extra});
  assert.ok(r.ok, r.error);return r;
}
test('opening can finish with every check failing, and widens the authoritative map',()=>{
 const {g}=make();
 assert.equal(g.viewFor('p0').opening.id,'arrival');
 assert.deepEqual(Object.keys(g.viewFor('p0').map.locs).sort(),['belltower','chapel','graveyard','square']);
 assert.equal(g.path('square','foyer',false),null);
 act(g,'square','board');assert.equal(g.viewFor('p0').opening.id,'record');
 act(g,'chapel','vestry');assert.equal(g.viewFor('p0').opening.id,'route');
 act(g,'graveyard','headstones');assert.equal(g.viewFor('p0').opening.id,'enter');
 act(g,'belltower','maintenance');assert.equal(g.viewFor('p0').opening.id,'frame');
 act(g,'belltower','frame');
 assert.equal(g.viewFor('p0').opening.complete,true);
 assert.ok(g.path('square','foyer',false));
 assert.ok(g.w.clues.bell_cast.shared);
 assert.ok(g.log.some(e=>e.t.includes('Opening complete')));
});
test('alternative entrance works before any clues, including a failed force check',()=>{
 const {g}=make(); const p=g.get('p0'),vit=p.vit;
 act(g,'belltower','force_entry');
 assert.equal(p.vit,vit-2);assert.ok(g.w.opening.entered);
 act(g,'belltower','frame');assert.ok(g.w.opening.complete);
});
test('tower interior cannot be studied before entering, and wider shortcuts stay blocked',()=>{
 const {g}=make();g.get('p0').loc='belltower';g.command('p0',{t:'interact'});
 const v=g.viewFor('p0');assert.equal(v.enc.options.find(o=>o.id==='frame').state,'locked');
 assert.ok(g.command('p0',{t:'choose',enc:g.turn.enc.id,opt:'frame'}).error);
 assert.ok(g.command('p0',{t:'move',to:'bridge'}).error);
 assert.ok(!g.viewFor('p0').act.sprint.some(m=>!g.openingPlace(m.to)));
});
test('out-of-order party discoveries are shared and survive snapshot/reconnect exactly once',()=>{
 const {g}=make(2);
 act(g,'graveyard','headstones','p1');
 assert.equal(g.viewFor('p0').opening.id,'enter');
 const restored=HollowGame.restore(g.snapshot());restored.setConnected('p0',true);
 assert.deepEqual(restored.w.opening,g.w.opening);
 act(restored,'belltower','maintenance');act(restored,'belltower','frame');
 const count=restored.log.filter(e=>e.t.includes('Opening complete')).length;
 const before=restored.get('p0').tally.clues;
 restored.turn.ap=3;
 const replay=restored.command('p0',{t:'choose',enc:restored.turn.enc.id,opt:'frame'});
 assert.ok(replay.error || replay.ok);
 assert.equal(restored.get('p0').tally.clues,before);
 assert.equal(restored.log.filter(e=>e.t.includes('Opening complete')).length,count);
 assert.ok(restored.viewFor('p1').opening.complete);
});
test('a finder falling on a failed check still leaves evidence for companions',()=>{
 const {g}=make(2);g.get('p0').san=1;
 act(g,'square','board');
 assert.equal(g.get('p0').status,'fallen');assert.ok(g.w.opening.board);
 assert.equal(g.viewFor('p1').opening.id,'record');
 act(g,'graveyard','headstones','p1');assert.ok(g.w.opening.route);
});
test('solo reading and held rolls have no idle deadline; multiplayer deadline still works',()=>{
 const solo=make();solo.wait(1_000_000);assert.equal(solo.g.w.round,1);
 assert.ok(solo.g.viewFor('p0').game.readingTime);
 solo.g.get('p0').cls='occultist';
 act(solo.g,'square','board');
 assert.ok(solo.g.turn.enc.hold);
 solo.wait(1_000_000);assert.ok(solo.g.turn.enc.hold);
 assert.ok(solo.g.command('p0',{t:'accept'}).ok);assert.ok(solo.g.w.opening.board);
 const multi=make(2);const active=multi.g.turn.active;multi.wait(151_000);assert.notEqual(multi.g.turn.active,active);
 const old=make(1,false).g;assert.equal(HollowGame.restore(old.snapshot()).viewFor('p0').opening,null);
});
const window={HollowUI:{howtoModal:()=>''},HollowArt:{esc:x=>x},HollowCards:{tray:()=>''}};
vm.runInNewContext(fs.readFileSync(new URL('../games/the-hollow/js/guidance.js',import.meta.url),'utf8'),{window});
test('solo automatic turn eligibility never skips encounters, votes, upgrades or presentation',()=>{
 const yes=window.HollowGuidance.canAdvance;
 const v={phase:'playing',you:'p0',game:{readingTime:true,active:'p0',ap:0},me:{status:'alive'}};
 assert.ok(yes(v,false));
 assert.ok(yes({...v,enc:{kind:'loc',result:{}}},false));
 for(const patch of [{enc:{hold:{}}},{enc:{over:true}},{vote:{}},{me:{status:'alive',pendingLevels:1}},{me:{status:'fallen'}},{game:{...v.game,ap:1}},{game:{...v.game,readingTime:false}}])assert.equal(yes({...v,...patch},false),false);
 assert.equal(yes(v,true),false);
});

test('automatic end turn is engine validated and advances a spent, resolved solo turn',()=>{
 const {g}=make();
 assert.ok(g.command('p0',{t:'endturn',auto:true}).error);
 g.turn.ap=0;g.get('p0').pendingLevels=1;
 assert.ok(g.command('p0',{t:'endturn',auto:true}).error);
 g.get('p0').pendingLevels=0;g.w.vote={};
 assert.ok(g.command('p0',{t:'endturn',auto:true}).error);
 g.w.vote=null;g.turn.enc={kind:'event'};
 assert.ok(g.command('p0',{t:'endturn',auto:true}).error);
 g.turn.enc=null;const round=g.w.round;
 assert.ok(g.command('p0',{t:'endturn',auto:true}).ok);
 assert.equal(g.w.round,round+1);assert.ok(g.turn.ap>0);
 assert.ok(g.log.some(e=>e.t.includes('Your actions are spent')));
});
