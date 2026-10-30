import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../games/chronolink/index.html',import.meta.url),'utf8');
class Node {
  constructor(){this.children=[];this.userData={};this.rotation={set(){}};this.position={set(){}};this.scale={set(){},setScalar(){}};}
  add(n){this.children.push(n);}
}
function harness(){
  const ctx=vm.createContext({Math,Number,THREE:{Group:Node},BOX:(...size)=>({size}),CYL:()=>({}),TOR:()=>({}),SPH:()=>({}),
    M:new Proxy({concrete:[{}]},{get:(o,k)=>o[k]||{}}),rnd:(a,b)=>(a+b)/2,cachedGeo:(_key,fn)=>fn(),
    mk:(geo,material,x,y,z,parent)=>{const n=new Node();n.geo=geo;n.material=material;n.at={x,y,z};parent.add(n);return n;},
  });
  vm.runInContext(html.match(/<script id="chrono-core">([\s\S]*?)<\/script>/)[1],ctx);
  ctx.G={L:ctx.ChronoCore.getChamber(22),t:0};ctx.w={scene:new Node()};
  const start=html.indexOf('function tokenKey('),end=html.indexOf('// Which way a fallen trunk',start);
  vm.runInContext(html.slice(start,end),ctx);return ctx;
}
test('every new aging record builds visible geometry in the same renderer as old tokens',()=>{
  const ctx=harness();
  for(const o of ['sediment','siltbank','rustfall','stonebridge','oldshore','rustshore','drain','rustdrain','sluicewheel','jammedwheel']){
    ctx.rec={t:'floor',o,wet:true};ctx.i=ctx.G.L.supports[0].y*ctx.G.L.W+ctx.G.L.supports[0].x;
    const token=vm.runInContext('buildToken(w,rec,i)',ctx);assert.ok(token.g.children.length,o);assert.ok(token.key.includes(o),o);
  }
});
test('porous tiles rebuild their visual record when damp changes and unsupported slabs have visible rubble',()=>{
  const ctx=harness();ctx.i=ctx.G.L.porous.find(i=>ctx.G.L.base[i]==='.');
  ctx.rec={t:'floor',o:null,wet:false};const dry=vm.runInContext('tokenKey(rec,i)',ctx);
  ctx.rec.wet=true;const wet=vm.runInContext('buildToken(w,rec,i)',ctx);assert.notEqual(wet.key,dry);assert.ok(wet.g.children.length);
  const p=ctx.G.L.supports[0].span[0];ctx.i=p.y*ctx.G.L.W+p.x;ctx.rec={t:'rubble',o:null,wet:false};
  const rubble=vm.runInContext('buildToken(w,rec,i)',ctx);assert.ok(rubble.key.includes('collapsed'));assert.ok(rubble.g.children.length>=7);
});
test('shore pickup and socket hints name the tool and verb without changing the hint presentation',()=>{
  const ctx=harness();ctx.C=ctx.ChronoCore;ctx.G.s=ctx.C.initState(ctx.G.L);ctx.G.fut=ctx.C.deriveRaw(ctx.G.L,ctx.G.s);
  ctx.tileIdx=(x,y)=>y*ctx.G.L.W+x;
  const a=html.indexOf('const ITEM_WORD ='),b=html.indexOf('function hintFrom(',a);vm.runInContext(html.slice(a,b),ctx);
  const shore=ctx.G.s.objs.find(o=>o.k==='shore');ctx.step=`A pick ${shore.x},${shore.y}`;
  assert.match(vm.runInContext('describeStep(step).text',ctx),/iron shore/);
  ctx.G.s.held=shore.id;const p=ctx.G.L.supports[0];ctx.step=`A drop ${p.x},${p.y}`;
  assert.match(vm.runInContext('describeStep(step).text',ctx),/brace the slab/);
});
