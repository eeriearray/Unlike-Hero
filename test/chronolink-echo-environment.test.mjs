import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../games/chronolink/index.html',import.meta.url),'utf8');
const ctx={};vm.runInNewContext(html.match(/<script id="chrono-core">([\s\S]*?)<\/script>/)[1],ctx);
const C=ctx.ChronoCore, room=def=>C.parseChamber({name:'fixture',...def},0), snapshot=s=>JSON.stringify(s);
const freeze=s=>{if(s&&typeof s==='object'){Object.freeze(s);for(const v of Object.values(s))freeze(v);}return s;};
const treeRoom=()=>room({map:['########','#......#','#..S...#','#...;;.#','#......#','########'],planters:[{x:3,y:2,dir:'S',len:1}],objs:[{k:'acorn',x:3,y:2},{k:'plank',x:1,y:1}],wheels:[{x:6,y:1,positions:[[],['a']]}]});

test('felling a trunk spans successive chasms, locks its acorn and reserves every changed tile',()=>{
  const L=treeRoom(),s=freeze(C.initState(L)),f=freeze(C.deriveFuture(L,s)),before=snapshot(s),i=3*L.W+3;
  const result=C.echoFell(L,s,f,i,1,0);assert.equal(result.kind,'fell');const n=result.s,view=C.deriveFuture(L,n);
  assert.equal(snapshot(s),before);assert.equal(view[i].o,null);assert.equal(view[i+1].o,'roots');assert.equal(view[i+2].o,'roots');
  assert.equal(view[2*L.W+3].o,null);assert.equal(C.actPick(L,n,3,2).why,'felled');
  assert.equal(C.echoFell(L,n,view,i+1,1,0),null);
  for(const j of Object.keys(n.echo.witness))assert.equal(C.canPlace(L,n,'plank',j%L.W,Math.floor(j/L.W)),false);
  let changed=C.actWheel(L,n,0);changed=C.actPick(L,changed,1,1);changed=C.actDrop(L,changed,2,1);
  for(const j of Object.keys(n.echo.witness))assert.equal(snapshot(C.deriveFuture(L,changed)[j]),snapshot(view[j]));
  assert.equal(snapshot(n.objs),snapshot(s.objs),'future-only intervention');
});

test('felling a tree on dry ground uses the planter length and respects walls, pins and other objects',()=>{
  const L=treeRoom(),s=C.initState(L),f=C.deriveFuture(L,s),i=2*L.W+3;
  const n=C.echoFell(L,s,f,i,1,0).s,view=C.deriveFuture(L,n);
  assert.equal(view[i].o,null);assert.equal(view[i+1].o,'trunk');assert.equal(view[i+2].o,null,'len=1');
  assert.equal(C.echoFell(L,s,f,i,0,0),null);assert.equal(C.echoFell(L,s,f,i,1,1),null);
  const pinned=C.cloneState(s);pinned.echo.hold[i]=f[i];assert.equal(C.echoFell(L,pinned,f,i,1,0),null);
  const occupied=C.cloneState(s);occupied.objs.push({id:'extra',k:'crate',x:4,y:2,box:null});
  assert.equal(C.echoFell(L,occupied,C.deriveFuture(L,occupied),i,1,0),null,'cannot overwrite another object');
  const moved=C.actPick(L,s,3,2);assert.equal(C.echoFell(L,moved,f,i,1,0),null,'a frozen silhouette cannot consume a held acorn');
});

const waterRoom=()=>room({map:['#########','#...W...#','#.,bc...#','#..bb.b.#','#AE...X.#','#########'],drains:[{x:2,y:2}],gates:[{id:'a',x:4,y:2}],wheels:[{x:1,y:1,echo:true,positions:[['a'],[]]}],objs:[{k:'plank',x:7,y:3}]});
test('a rusted authored drain permanently dries only its connected flooded basin, without mutating input',()=>{
  const L=waterRoom(),s=freeze(C.initState(L)),f=freeze(C.deriveFuture(L,s)),before=snapshot(s),i=2*L.W+2;
  const result=C.echoDrain(L,s,f,i);assert.equal(result.kind,'drain');const n=result.s,view=C.deriveFuture(L,n);
  for(const j of [i+1,3*L.W+3,3*L.W+4]){assert.equal(view[j].t,'basin');assert.equal(view[j].wet,false);assert.equal(C.canPlace(L,n,'plank',j%L.W,Math.floor(j/L.W)),false);}
  assert.equal(view[i].o,'broken');assert.equal(n.echo.witness[3*L.W+6],undefined,'separate basin untouched');assert.equal(C.echoDrain(L,n,view,i),null);
  assert.equal(snapshot(s),before);assert.equal(snapshot(n.objs),snapshot(s.objs));assert.equal(snapshot(C.flowing(L,n)),snapshot(C.flowing(L,s)));
  const reopened=C.actWheel(L,C.actWheel(L,n,0),0);
  assert.equal(snapshot(C.deriveFuture(L,reopened)),snapshot(view),'cycling the past does not refill the basin');
  const occupied=C.cloneState(s);occupied.objs[0].x=2;occupied.objs[0].y=2;
  assert.equal(C.echoDrain(L,occupied,C.deriveFuture(L,occupied),i),null,'cannot fix a past object underneath the grate');
  const held=C.cloneState(s);held.echo.hold[i+1]=f[i+1];assert.equal(C.echoDrain(L,held,f,i),null,'pins retain precedence');
  const dry=C.actWheel(L,s,0);assert.equal(C.echoDrain(L,dry,C.deriveFuture(L,dry),i),null,'no flood to drain');
  assert.equal(C.echoDrain({...L,drains:[]},s,f,i),null,'only authored grates');
  const solid=room({map:['#####','#...#','#####'],drains:[{x:2,y:1}]});assert.equal(C.echoDrain(solid,C.initState(solid),C.deriveFuture(solid,C.initState(solid)),7),null,'unrusted grates resist');
});

test('jams close future gates only, survive wheel cycling, copy independently and reserve the wheel',()=>{
  const L=waterRoom(),s=freeze(C.initState(L)),f=freeze(C.deriveFuture(L,s)),before=snapshot(s),i=L.W+1;
  const result=C.echoJam(L,s,f,i);assert.equal(result.kind,'jam');const n=result.s,flow=C.flowing(L,s);
  assert.equal(snapshot(s),before);assert.equal(n.echo.jams[0],true);assert.equal(C.deriveRaw(L,n,flow)[2*L.W+3].t,'basin','even a supplied past flow must be overridden');
  assert.equal(C.deriveFuture(L,n)[i].o,'jammedwheel');assert.equal(C.echoJam(L,n,f,i),null);assert.equal(C.canPlace(L,n,'plank',1,1),false);
  assert.equal(snapshot(C.flowing(L,n)),snapshot(flow),'1924 water is unchanged');
  for(let y=0;y<L.H;y++)for(let x=0;x<L.W;x++)assert.equal(C.walkPast(L,n,x,y,C.flowing(L,n)),C.walkPast(L,s,x,y,flow));
  const reopened=C.actWheel(L,C.actWheel(L,n,0),0);assert.ok(reopened&&!reopened.paradox,'the Anchor may still use its own wheel');
  assert.equal(C.deriveFuture(L,reopened)[2*L.W+3].t,'basin');
  const copied=C.cloneState(n);delete copied.echo.jams[0];assert.equal(n.echo.jams[0],true);
});

test('the solver distinguishes jammed aging in its cache and keys; jam costs exactly one action',()=>{
  const L=room({map:['########','#..W...#','#..c...#','#AEbbX.#','########'],wheels:[{x:1,y:2,echo:true,positions:[['g']]}],gates:[{id:'g',x:3,y:2}]});
  const solved=C.solve(L,{realMoves:true});assert.equal(solved.ok,true);assert.equal(solved.depth,1);assert.ok(solved.path.some(p=>p.startsWith('E jam ')));
  assert.equal(C.solve(L,{noJam:true}).why,'exhausted');
});

test('client targeting exposes all three labels through the shared actions and hint descriptions',()=>{
  const source=html.slice(html.indexOf('function echoEnvironmentTarget()'),html.indexOf('// The old crate the Echo faces'));
  const targetContext=vm.createContext({C,G:{},tileIdx:(x,y)=>y*targetContext.G.L.W+x});vm.runInContext(source,targetContext);
  for(const [L,e,kind,label] of [[treeRoom(),{x:2,y:3,dir:{dx:1,dy:0}},'fell','Fell tree'],[waterRoom(),{x:2,y:1,dir:{dx:0,dy:1}},'drain','Drain basin'],[waterRoom(),{x:1,y:2,dir:{dx:0,dy:-1}},'jam','Jam wheel']]){
    const s=C.initState(L);Object.assign(targetContext.G,{L,s,E:e,fut:C.deriveFuture(L,s)});
    const target=vm.runInContext('echoEnvironmentTarget()',targetContext);assert.equal(target.kind,kind);assert.equal(target.label,label);assert.ok(target.run().echo);
  }
});

test('a shared gate remains shut in 2026 when any assigned wheel is jammed',()=>{
  const L=waterRoom();L.wheels.push({x:6,y:1,positions:[['a']]});
  const s=C.initState(L),f=C.deriveFuture(L,s),n=C.echoJam(L,s,f,L.W+1).s;
  assert.equal(C.flowing(L,n)[2*L.W+4],1);assert.equal(C.flowing(L,n,true)[2*L.W+4],0);
});

test('an Echo wind-up uses current state instead of rewinding an intervening Anchor move',()=>{
  const L=waterRoom(),s=C.initState(L),G={L,s,E:{x:1,y:2,dir:{dx:0,dy:-1}},fut:C.deriveFuture(L,s)};
  const context=vm.createContext({C,G,tileIdx:(x,y)=>y*L.W+x});
  vm.runInContext(html.slice(html.indexOf('function echoEnvironmentTarget()'),html.indexOf('// The old crate the Echo faces')),context);
  const target=vm.runInContext('echoEnvironmentTarget()',context);
  G.s=C.actPick(L,G.s,7,3);G.fut=C.deriveFuture(L,G.s);
  const result=target.run();assert.equal(result.held,G.s.held);assert.equal(result.echo.jams[0],true);
});


test('teaching objective chips identify Echo interventions for trunks, channels and basins',()=>{
  const context=vm.createContext({C,G:{},tileIdx:(x,y)=>y*context.G.L.W+x});
  vm.runInContext(html.slice(html.indexOf('function blockerE('),html.indexOf('function blockerA(')),context);
  for(const [n,type] of [[2,'trunk'],[3,'deep'],[4,'flood']]){
    const L=C.getChamber(n);let s=C.initState(L);
    if(n===2)s=C.actDrop(L,C.actPick(L,s,3,4),5,5);
    const fut=C.deriveFuture(L,s),i=n===3?3*L.W+9:fut.findIndex(r=>r.o===type||r.t===type);
    assert.ok(i>=0);Object.assign(context.G,{L,s,fut});context.i=i;
    assert.equal(vm.runInContext('blockerE(i).fix',context),'future',`lesson ${n}`);
    if(n===4){context.i=fut.findIndex(r=>r.t==='deep');assert.equal(vm.runInContext('blockerE(i).fix',context),'past','a distant drain does not fix the first channel');}
  }
});

test('lesson chips surface reachable new verbs without coaching later chambers',()=>{
  const G={},context=vm.createContext({C,G,GUIDED_CHAMBERS:11,DIR4:[[1,0],[-1,0],[0,1],[0,-1]]});
  vm.runInContext(html.slice(html.indexOf('function teachingEchoGoal()'),html.indexOf('function computeGoals(force)')),context);
  for(const [n,text] of [[2,'Ironwood trunk'],[3,'Sluice wheel'],[4,'Rusted drain']]){
    const L=C.getChamber(n);let s=C.initState(L),e=L.startE;
    if(n===2)s=C.actDrop(L,C.actPick(L,s,3,4),5,5);
    Object.assign(G,{L,s,E:e,fut:C.deriveFuture(L,s)});
    if(n===4){assert.equal(vm.runInContext('teachingEchoGoal()',context),null,'do not direct Echo toward an unreachable drain');G.E={x:22,y:1};}
    const goal=vm.runInContext('teachingEchoGoal()',context);assert.equal(goal.text,text);assert.equal(goal.fix,'future');
    G.L={...L,n:12};assert.equal(vm.runInContext('teachingEchoGoal()',context),null,'no late-game coaching');
  }
});
