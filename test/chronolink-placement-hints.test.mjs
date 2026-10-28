import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../games/chronolink/index.html',import.meta.url),'utf8');
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function harness(){
 const ctx=vm.createContext({Math,Number});vm.runInContext(html.match(/<script id="chrono-core">([\s\S]*?)<\/script>/)[1],ctx);
 const C=ctx.ChronoCore,L=C.parseChamber({name:'targeting',map:['#####','#...#','#..~#','#...#','#####'],objs:[{k:'crate',x:2,y:1},{k:'plank',x:1,y:1}]},0),s=C.initState(L);
 const G={L,s,A:{x:2,y:2,dir:{dx:0,dy:-1}},E:{x:2,y:2,dir:{dx:0,dy:-1}},role:'ECHO',view:'solo',soloEra:'future',started:true};
 ctx.C=C;ctx.G=G;ctx.tileIdx=(x,y)=>y*L.W+x;
 G.fut=C.deriveRaw(L,s);
 vm.runInContext(between('const DIR4 =','function pinTarget()'),ctx);
 return{ctx,C,G,run:src=>vm.runInContext(src,ctx)};
}
test('Anchor placement finds an adjacent gap even when facing an occupied tile',()=>{
 const h=harness();h.G.s.held='o1';
 const target=h.run('anchorTarget()');assert.equal(target.kind,'drop');assert.equal(target.x,3);assert.equal(target.y,2);
 const next=target.run();assert.equal(next.held,null);assert.equal(next.objs[1].x,3);
});
test('Echo placement snaps to a side gap instead of an unhelpful facing target',()=>{
 const h=harness();h.G.s.echo.carry='plank';
 const target=h.run('echoTarget()');assert.equal(target.kind,'lay');assert.equal(target.x,3);assert.equal(target.y,2);
 assert.equal(target.run().echo.carry,null);
});
test('pointer aim can explicitly select another legal adjacent tile',()=>{
 const h=harness();h.G.s.held='o1';h.G.placementAim={who:'A',x:2,y:3};
 const target=h.run("choosePlacement('A')");assert.equal(target.x,2);assert.equal(target.y,3);
 h.G.placementAim={who:'A',x:99,y:99};assert.equal(h.run("choosePlacement('A')").x,3,'out-of-reach aim is ignored');
});
test('manual hints show the other era’s actual instruction on the current player’s screen',()=>{
 const h=harness(),el={};h.ctx.$=()=>el;
 vm.runInContext(between('function hintLine(', '// ----- objectives:'),h.ctx);
 h.G.hint={era:'past',who:'Anchor',text:'seal the plank in the Stash Box',auto:false,tier:1,left:4};
 h.run('syncHintStatus()');assert.equal(el.hidden,false);assert.match(el.textContent,/Anchor: seal the plank/);
 h.G.hint=null;h.run('syncHintStatus()');assert.equal(el.hidden,true);
});
