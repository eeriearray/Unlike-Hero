import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../games/chronolink/index.html', import.meta.url), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.match(/<script id="chrono-core">([\s\S]*?)<\/script>/)[1], ctx);
const C = ctx.ChronoCore;
const room = extra => C.parseChamber({ name: 'aging fixture', map: ['#########', '#.......#', '#.......#', '#.......#', '#########'], ...extra }, 0);
const at = (L, rs, x, y) => rs[y * L.W + x];

test('capillary damp spreads cardinally through connected porous strips, not across stone or diagonals', () => {
  const L = room({ map: ['#########', '#,......#', '#.......#', '#.......#', '#########'],
    porous: [{x:1,y:1},{x:2,y:1},{x:3,y:1},{x:4,y:2},{x:6,y:1}],
    objs: [{k:'plank',x:3,y:1},{k:'crate',x:2,y:1}], bars: [{x:1,y:1}] });
  const s = C.initState(L), raw = C.deriveRaw(L,s);
  assert.equal(at(L,raw,3,1).rot,'plank'); assert.equal(at(L,raw,2,1).o,'mulch');
  assert.equal(at(L,raw,1,1).o,'rustbars'); assert.equal(at(L,raw,4,2).wet,false);
  assert.equal(at(L,raw,6,1).wet,false);
  const dry = C.deriveRaw({...L,porous:[]},s); assert.equal(at(L,dry,3,1).o,'oldplank');
});

test('capillary damp kills a sunlit seed without flooding basins or eroding plaster', () => {
  const L = room({ map: ['#########', '#,..Spb.#', '#.......#', '#.......#', '#########'],
    porous: [1,2,3,4,5,6].map(x=>({x,y:1})), objs:[{k:'acorn',x:4,y:1}], planters:[{x:4,y:1,dir:'S'}] });
  const r=C.deriveRaw(L,C.initState(L)); assert.equal(at(L,r,4,1).rot,'acorn');
  assert.equal(at(L,r,5,1).t,'wall'); assert.equal(at(L,r,6,1).t,'basin');
});

function riverRoom() {
  return room({map:['####W####','#...c...#','#..r=...#','#.......#','#########'],
    gates:[{id:'a',x:4,y:1}], wheels:[{x:1,y:1,positions:[[],['a']]}],
    deposits:[{feed:{x:4,y:2},fill:[{x:3,y:2}],bury:[{x:6,y:2}]}],pins:1});
}
test('a century of flow creates a crossing and buries a different passage; a closed feed creates neither',()=>{
  const L=riverRoom(),s=C.initState(L),dry=C.deriveRaw(L,s),wet=C.deriveRaw(L,C.actWheel(L,s,0));
  assert.equal(at(L,dry,3,2).t,'rubble'); assert.equal(at(L,wet,3,2).o,'sediment');
  assert.equal(C.walkRec(at(L,wet,3,2)),true); assert.equal(C.walkRec(at(L,wet,6,2)),false);
  assert.equal(at(L,wet,6,2).o,'siltbank');
});
test('Echo can hold or pin a deposit after drainage; a buried passage cannot be created on Echo',()=>{
  const L=riverRoom(),s=C.initState(L),wet=C.actWheel(L,s,0),raw=C.deriveRaw(L,wet),i=2*L.W+3;
  const held={i,rec:raw[i]}; assert.equal(C.deriveFuture(L,s,held)[i].o,'sediment');
  const pinned=C.echoPin(L,wet,raw,i).s,drained=C.actWheel(L,pinned,0);
  assert.equal(C.deriveFuture(L,drained)[i].o,'sediment');
  assert.equal(C.crushes(L,s,wet,2*L.W+6),true);
});

function shoreRoom(){return room({map:['#########','#...r...#','#.......#','#.......#','#########'],
  objs:[{k:'shore',x:2,y:2}],supports:[{x:2,y:2,span:[{x:4,y:1}],fall:[{x:4,y:3}]}],pins:1});}
test('a dry shore supports a slab; removing or wetting it collapses the span and blocks the lower passage',()=>{
  const L=shoreRoom(),s=C.initState(L),raw=C.deriveRaw(L,s),lifted=C.actPick(L,s,2,2),fall=C.deriveRaw(L,lifted);
  assert.equal(at(L,raw,4,1).o,'stonebridge'); assert.equal(C.walkRec(at(L,raw,4,1)),true);
  assert.equal(at(L,fall,4,1).t,'rubble'); assert.equal(at(L,fall,4,3).o,'rustfall');
  const damp={...L,base:L.base.slice()}; damp.base[2*L.W+2]=',';
  assert.equal(at(L,C.deriveRaw(damp,s),4,3).o,'rustfall');
  const i=L.W+4,p=C.echoPin(L,s,raw,i).s;
  assert.equal(C.deriveFuture(L,C.actPick(L,p,2,2))[i].o,'stonebridge');
  assert.equal(C.deriveFuture(L,lifted,{i,rec:raw[i]})[i].o,'stonebridge');
});
test('collapse onto Echo is a paradox; kicking a collapsed grille survives later shore reuse',()=>{
  const L=shoreRoom(),s=C.initState(L),lifted=C.actPick(L,s,2,2),i=3*L.W+4;
  assert.equal(C.crushes(L,s,lifted,i),true);
  const kicked=C.echoAct(L,lifted,C.deriveRaw(L,lifted),i); assert.equal(kicked.kind,'kick');
  const restored=C.actDrop(L,kicked.s,2,2),removed=C.actPick(L,restored,2,2);
  assert.equal(C.deriveFuture(L,removed)[i].o,'broken');
});
test('new rule derivations and actions do not mutate snapshots used by rewind and networking',()=>{
  for(const L of [riverRoom(),shoreRoom()]){
    const s=C.initState(L),before=JSON.stringify(s); C.deriveRaw(L,s); C.deriveFuture(L,s); C.cloneState(s);
    if(L.wheels.length) C.actWheel(L,s,0); else C.actPick(L,s,2,2);
    assert.equal(JSON.stringify(s),before);
  }
});
test('real-move search excludes relay communication and represents wheel settings without cycling padding',()=>{
  const L=room({map:['#########','#A..~..X#','#E......#','#.......#','#########'],objs:[{k:'plank',x:2,y:1}],relays:[{gate:{x:7,y:1},receiver:{x:3,y:2}}]});
  const macro=C.solve(L),real=C.solve(L,{realMoves:true}); assert.equal(real.ok,true);
  assert.ok(real.depth<macro.depth); assert.ok(real.path.some(p=>p.startsWith('E scan')));
});

test('a pinned Stash Box cannot duplicate cargo that Anchor has already removed',()=>{
  const L=room({objs:[{k:'plank',x:2,y:2}],boxes:[{x:3,y:2}],pins:1});
  const sealed=C.actDrop(L,C.actPick(L,C.initState(L),2,2),3,2),i=2*L.W+3;
  const pinned=C.echoPin(L,sealed,C.deriveFuture(L,sealed),i).s;
  const removed=C.actPick(L,pinned,3,2),before=JSON.stringify(removed);
  const refused=C.echoAct(L,removed,C.deriveFuture(L,removed),i);
  assert.equal(refused.s.paradox,i);assert.equal(refused.s.why,'unsealed');
  assert.equal(JSON.stringify(removed),before,'a refused extraction is not a state change');
  const returned=C.actDrop(L,removed,3,2),opened=C.echoAct(L,returned,C.deriveFuture(L,returned),i);
  assert.equal(opened.s.echo.carry,'plank','resealing the real source recovers the timeline');
  assert.equal(C.actPick(L,opened.s,3,2).why,'taken');
});

test('an extracted item remains paradox-protected by identity after a stale snapshot relocates it',()=>{
  const L=room({objs:[{k:'plank',x:2,y:2}],boxes:[{x:3,y:2}]});
  const sealed=C.actDrop(L,C.actPick(L,C.initState(L),2,2),3,2),i=2*L.W+3;
  const opened=C.echoAct(L,sealed,C.deriveFuture(L,sealed),i).s;
  const stale=C.cloneState(opened);stale.objs[0].box=null;stale.objs[0].x=5;stale.objs[0].y=2;
  assert.equal(C.actPick(L,stale,5,2).why,'taken');
  stale.held=stale.objs[0].id;assert.equal(C.actDrop(L,stale,6,2).why,'taken');
});

test('a frozen box distinguishes two planks of the same kind by their cargo identity',()=>{
  const L=room({objs:[{k:'plank',x:2,y:2},{k:'plank',x:5,y:2}],boxes:[{x:3,y:2}],pins:1}),i=2*L.W+3;
  let s=C.actDrop(L,C.actPick(L,C.initState(L),2,2),3,2);
  s=C.echoPin(L,s,C.deriveFuture(L,s),i).s;
  s=C.actDrop(L,C.actPick(L,s,3,2),2,2);
  s=C.actDrop(L,C.actPick(L,s,5,2),3,2);
  assert.equal(C.echoAct(L,s,C.deriveFuture(L,s),i).s.why,'unsealed');
  s=C.echoPin(L,s,C.deriveFuture(L,s),i).s;
  s=C.echoAct(L,s,C.deriveFuture(L,s),i).s;
  assert.equal(s.echo.carry,'plank');
  assert.equal(C.actPick(L,s,3,2).why,'taken');
  assert.equal(C.actPick(L,s,2,2).held,'o0','the other plank is still an independent past object');
});
