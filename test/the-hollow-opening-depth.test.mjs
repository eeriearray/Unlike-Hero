import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {HollowGame,data}=createRequire(import.meta.url)('../games/the-hollow/engine/index.js');
function make(classes) {
 const g=new HollowGame({seed:19,code:'DEEP',now:()=>1000});
 classes.forEach((cls,i)=>{g.addPlayer({id:'p'+i,name:cls});g.command('p'+i,{t:'pick',cls});g.command('p'+i,{t:'ready'});});
 assert.ok(g.command('p0',{t:'start',opening:true}).ok);g.d20=()=>1;return g;
}
function choose(g,opt,pid='p0') {
 if(!g.turn.enc) assert.ok(g.command(pid,{t:'interact'}).ok);
 const r=g.command(pid,{t:'choose',enc:g.turn.enc.id,opt});assert.ok(r.ok,r.error);
 if(g.turn.enc?.hold) assert.ok(g.command(pid,{t:'accept'}).ok);
}
function replenish(g) {
 if(g.turn.enc) assert.ok(g.command('p0',{t:'leave'}).ok);
 if(g.get('p0').pendingLevels) { const offer=g.viewFor('p0').me.offer;assert.ok(g.command('p0',{t:'levelup',pick:offer[0].id}).ok); }
 if(g.turn.ap===0) assert.ok(g.command('p0',{t:'endturn'}).ok);
}
function walk(g,to) {
 replenish(g);
 const path=g.path(g.get('p0').loc,to,false);assert.ok(path, 'a real road connects '+to);
 // The engine path is a list of neighboring destinations.
 for(const step of path) {replenish(g);const r=g.command('p0',{t:'move',to:typeof step==='string'?step:step.to});assert.ok(r.ok,r.error);}
}
for(const cls of Object.keys(data.classes)) test(cls+': real roads, failed checks and tower response complete the solo opening',()=>{
 const g=make([cls]);
 choose(g,'board');walk(g,'chapel');choose(g,'vestry');walk(g,'graveyard');choose(g,'headstones');assert.equal(g.viewFor('p0').opening.nextTarget,'square');walk(g,'belltower');choose(g,'maintenance');replenish(g);choose(g,'frame');
 assert.equal(g.viewFor('p0').opening.id,'response');assert.equal(g.w.opening.complete,false);
 replenish(g);choose(g,'muffle');assert.ok(g.w.opening.complete);assert.equal(g.get('p0').status,'alive');
 assert.match(g.viewFor('p0').opening.context,/magistrate/);assert.equal(g.viewFor('p0').opening.target,'foyer');
 walk(g,'foyer');assert.equal(g.get('p0').loc,'foyer');
});
for(const cls of Object.keys(data.classes)) test(cls+': expertise changes costs and cannot be repeated',()=>{
 const g=make([cls]),p=g.get('p0'),x=g.openingExpertise(p);p.loc=x.loc;g.markSeen(x.loc);
 if(x.opt==='frame') {g.w.opening.entered=true;g.w.flags.opening_entered=true;}
 assert.ok(g.command('p0',{t:'interact'}).ok);
 const v=g.viewFor('p0'),op=v.enc.options.find(o=>o.id==='expertise');assert.equal(op.kind,'auto');assert.match(v.opening.observation,/.+/);assert.equal(op.attach,x.opt);
 const clock=g.w.clock,vit=p.vit,san=p.san,count=x.cost?.item?g.itemCount(p,x.cost.item):0;choose(g,'expertise');assert.equal(p.vit,vit);assert.equal(g.w.clock,clock);
 const after=JSON.stringify(g.snapshot());assert.ok(g.command('p0',{t:'choose',enc:g.turn.enc.id,opt:'expertise'}).error);assert.equal(JSON.stringify(g.snapshot()),after);
 if(x.cost?.item) assert.equal(g.itemCount(p,x.cost.item),count-1);
 if(x.cost?.san) assert.equal(p.san,san-x.cost.san);
 assert.ok(g.w.opening.record || g.w.opening.route || g.w.opening.entered);
});
test('specialist aid is previewed, paid once, and optional after disconnect',()=>{
 const g=make(['hunter','occultist']);g.players.forEach(p=>{p.loc='chapel';});g.turn.active='p0';g.turn.ap=3;
 g.command('p0',{t:'interact'});assert.equal(g.viewFor('p1').enc.allies[0].aidBonus,3);
 g.command('p0',{t:'askaid'});const san=g.get('p1').san;assert.ok(g.command('p1',{t:'aid'}).ok);assert.equal(g.get('p1').san,san-1);assert.equal(g.turn.enc.aid.bonus,3);
 assert.ok(g.command('p1',{t:'aid'}).error);g.setConnected('p1',false);choose(g,'vestry');assert.ok(g.w.opening.record);
});
test('mid-reveal restore retains evidence; responses are exclusive and cannot duplicate hints or Clock changes',()=>{
 let g=make(['hunter']);g.get('p0').loc='belltower';g.turn.ap=3;choose(g,'force_entry');choose(g,'frame');
 g=HollowGame.restore(g.snapshot());g.setConnected('p0',true);assert.ok(g.viewFor('p0').opening.evidence.revealed);
 const clock=g.w.clock;choose(g,'answer_echo');assert.equal(g.w.clock,clock+1);assert.equal(g.w.opening.response,'answer_echo');
 const after=g.w.clock;assert.ok(g.command('p0',{t:'choose',enc:g.turn.enc.id,opt:'muffle'}).error);assert.equal(g.w.clock,after);
 assert.deepEqual(HollowGame.restore(g.snapshot()).viewFor('p0').opening.evidence,g.viewFor('p0').opening.evidence);
});
test('specialist cannot inspect inside a locked tower or help after a die has been held',()=>{
 const g=make(['medium','occultist']);g.get('p0').loc='belltower';g.command('p0',{t:'interact'});
 assert.equal(g.viewFor('p0').enc.options.find(o=>o.id==='expertise').state,'locked');assert.ok(g.command('p0',{t:'choose',enc:g.turn.enc.id,opt:'expertise'}).error);
 g.turn.enc=null;g.players.forEach(p=>p.loc='square');g.turn.active='p1';g.turn.ap=3;g.command('p1',{t:'interact'});g.command('p1',{t:'askaid'});g.command('p1',{t:'choose',enc:g.turn.enc.id,opt:'board'});
 assert.ok(g.turn.enc.hold);assert.ok(g.command('p0',{t:'aid'}).error);
});
