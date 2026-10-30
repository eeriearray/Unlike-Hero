import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../games/chronolink/index.html', import.meta.url), 'utf8');
const between = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));
function harness() {
  const sent = [], notices = [], elements = {};
  const player = () => ({x:1,y:2,rx:1.2,ry:2.1,tx:8,ty:8,vx:2,vy:2,dir:{dx:1,dy:0},yaw:0,lockUntil:10});
  const G = {s:{objs:[{id:'plank',x:2,y:2}],wheel:[],held:null,echo:{pins:[],hold:{},witness:{},carry:null}},
    A:player(),E:player(),hist:[],stand:{i:12,rec:{t:'floor',o:'bridge'}},pending:[],t:5,rewinds:0};
  const context = vm.createContext({ G, Number, JSON, Math,
    C:{cloneState:s=>structuredClone(s)},
    $:id=>elements[id]||=( {textContent:''} ),
    held:{A:['KeyW'],E:[]}, taps:{A:{KeyW:10},E:{}},
    Net:{peer:'partner',send:m=>sent.push(structuredClone(m))},
    recompute(){},trackStand(){},syncFuture(){},computeGoals(){},checkVictory(){},refresh(){},
    rewindFx(){},log:msg=>notices.push(msg),
  });
  vm.runInContext(between('const posOf =', 'function snapshot()'),context);
  vm.runInContext(between('function sendWorld(', 'function applyRemotePos('),context);
  vm.runInContext(between('function updateRewindControl()', '// Every change to the world'),context);
  vm.runInContext(between('function rewind() {', 'function rewindFx()'),context);
  vm.runInContext(between('function applyRemoteWorld(m)', '\n</script>'),context);
  return {G,sent,notices,run:code=>vm.runInContext(code,context),receive:m=>{context.message=m;vm.runInContext('applyRemoteWorld(message)',context);}};
}

test('rewind restores state, observed tile, precise positions and clears stale movement and pending actions',()=>{
  const h=harness(), original=structuredClone(h.G.s);
  h.run('pushHist()');
  h.G.s.held='plank'; h.G.A.rx=4; h.G.stand.rec.o='tree'; h.G.pending.push({at:9});
  assert.equal(h.run('rewind()'),true);
  assert.deepEqual(h.G.s,original);
  assert.equal(h.G.stand.rec.o,'bridge');
  assert.equal(h.G.A.rx,1.2); assert.equal(h.G.A.tx,1.2);
  assert.equal(h.G.E.ty,2.1); assert.equal(h.G.E.vx,0);
  assert.equal(h.G.A.lockUntil,0); assert.equal(h.G.pending.length,0);
  assert.equal(h.run('held.A.length'),0); assert.equal(h.run('Object.keys(taps.A).length'),0);
  assert.equal(h.G.hist.length,0);
});

test('a partner action is added to local history and can be undone by the other player',()=>{
  const h=harness();
  h.receive({part:'past',objs:[{id:'plank',x:3,y:2}],wheel:[],held:'plank',cause:'remote-past'});
  assert.equal(h.G.hist.length,1); assert.equal(h.G.s.held,'plank');
  h.run('rewind()');
  assert.equal(h.G.s.held,null); assert.equal(h.G.s.objs[0].x,2);
  assert.equal(h.sent[0].cause,'rewind'); assert.equal(h.sent[0].part,'all');
});

test('remote rewind consumes matching history and resets interpolation instead of walking back to old targets',()=>{
  const a=harness(), b=harness();
  a.run('pushHist()'); a.G.s.held='plank'; a.run("sendWorld('past',{cause:'remote-past'})");
  b.receive(a.sent.shift());
  a.run('rewind()'); b.receive(a.sent.shift());
  assert.equal(b.G.hist.length,0); assert.equal(b.G.s.held,null);
  assert.equal(b.G.E.tx,b.G.E.rx); assert.equal(b.G.E.ty,b.G.E.ry);
  assert.equal(b.G.rewinds,1);
});

test('empty rewind explains that walking alone does not create an object-change history',()=>{
  const h=harness();
  assert.equal(h.run('rewind()'),false);
  assert.match(h.notices[0],/Nothing to rewind/);
  h.run('rewind()'); assert.equal(h.notices.length,1);
});

test('a jammed sluice reaches the partner window with the rest of the Echo state',()=>{
  const a=harness(), b=harness();
  a.G.s.echo.jams={0:true}; a.G.s.echo.witness={5:{t:'floor',o:'jammedwheel',fixed:true}};
  a.run("sendWorld('echo',{cause:'remote-echo'})");
  b.receive(a.sent.shift());
  assert.equal(b.G.s.echo.jams[0],true,'the partner sees the water shut off in 2026');
  assert.equal(b.G.s.echo.witness[5].o,'jammedwheel');
});
