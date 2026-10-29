import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../games/chronolink/index.html',import.meta.url),'utf8');
class Group {
  constructor(){this.children=[];this.userData={};this.position={set(x,y,z){Object.assign(this,{x,y,z});}};}
  add(n){this.children.push(n);}
}
function harness(){
  const M={channel:{name:'stone'},stonePast:{name:'seam'},iron:{name:'iron'},brass:{name:'gold'}};
  const ctx=vm.createContext({Math,Number,THREE:{Group},M,BOX:(x,y,z)=>({x,y,z}),
    mk:(geo,material,x,y,z,parent,cast)=>{const n={geo,material,x,y,z,cast};parent.add(n);return n;}});
  vm.runInContext(html.match(/<script id="chrono-core">([\s\S]*?)<\/script>/)[1],ctx);
  vm.runInContext(html.slice(html.indexOf('function buildPastRubbleSite('),html.indexOf('function flashlightClearance(')),ctx);
  ctx.world={scene:new Group()};return ctx;
}
test('every 1924 rubble marker is flush stone, with no tall posts, lintels or gold',()=>{
  const ctx=harness(),C=ctx.ChronoCore;
  let count=0;
  for(let n=1;n<=C.MAX_LEVEL;n++){
    const L=C.getChamber(n),s=C.initState(L),before=JSON.stringify(s);ctx.L=L;
    for(let i=0;i<L.base.length;i++)if(L.base[i]==='r'){
      ctx.x=i%L.W;ctx.y=Math.floor(i/L.W);
      const marker=vm.runInContext('buildPastRubbleSite(world,L,x,y)',ctx);count++;
      assert.equal(marker.position.x,ctx.x);assert.equal(marker.position.z,ctx.y);
      for(const mesh of marker.children){
        assert.ok(mesh.y+mesh.geo.y/2<=0.03,`chamber ${n}: freestanding geometry`);
        assert.notEqual(mesh.material,ctx.M.brass,`chamber ${n}: decorative gold gate`);
        assert.equal(mesh.cast,false,'floor marks do not cast doorway shadows');
      }
    }
    assert.equal(JSON.stringify(s),before,'rendering does not alter puzzle state');
  }
  assert.ok(count>50,'covers the existing campaign and new galleries');
});
test('gallery slabs use reinforced floor panels rather than legacy doorway decoration',()=>{
  const ctx=harness(),C=ctx.ChronoCore;
  for(let n=20;n<=25;n++){
    const L=C.getChamber(n);ctx.L=L;
    for(const p of [...L.supports.flatMap(s=>s.span),...L.deposits.flatMap(d=>d.fill)]){
      ctx.x=p.x;ctx.y=p.y;
      const marker=vm.runInContext('buildPastRubbleSite(world,L,x,y)',ctx);
      assert.equal(marker.userData.rubbleMarker,'structural-slab');
      assert.equal(marker.children.filter(m=>m.material===ctx.M.iron).length,4);
    }
  }
  const worldBuilder=html.slice(html.indexOf('function buildWorld('),html.indexOf('function buildPastObj('));
  assert.match(worldBuilder,/if \(B\[i\] === 'r'\) buildPastRubbleSite/,'the world actually uses the floor-marker renderer');
});
