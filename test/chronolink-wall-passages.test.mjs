import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { EROSION } from './fixtures/chronolink-chambers.mjs';
const html=readFileSync(new URL('../games/chronolink/index.html',import.meta.url),'utf8');
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
class Group {
  constructor(){ this.children=[]; this.rotation={y:0}; this.position={set(x,y,z){Object.assign(this,{x,y,z});}}; }
  add(node){this.children.push(node);}
}
function setup(wet=false){
  const context=vm.createContext({Number,Math,THREE:{Group,DodecahedronGeometry:class{}},
    BOX:(x,y,z)=>({x,y,z}),M:{wallConcrete:{},rubble:{},concrete:[{}]},
    rnd:(a,b)=>(a+b)/2,cachedGeo:(_key,fn)=>fn(),tokenKey:()=>'',
    mk:(geo,_mat,x,y,z,parent)=>{const n={geo,x,y,z,scale:{setScalar(){}}};parent.add(n);return n;},
    BODY_R:0.26,
  });
  vm.runInContext(html.match(/<script id="chrono-core">([\s\S]*?)<\/script>/)[1],context);
  const C=context.ChronoCore,L=C.parseChamber(EROSION,0),s=C.initState(L);
  s.wheel[0]=wet?1:0;
  const flow=C.flowing(L,s),fut=C.deriveRaw(L,s,flow);
  context.C=C;context.G={L,s,flow,fut,t:0,E:{x:2,y:3},A:{x:2,y:3}};
  vm.runInContext(between('function doorwayAlongZ(', 'const ringGeo ='),context);
  vm.runInContext(between('function buildToken(', 'function syncFuture('),context);
  vm.runInContext(between('const walkable =','function faceFromVelocity('),context);
  context.world={scene:{add(){}}};
  return {context,C,L,run:src=>vm.runInContext(src,context)};
}

test('intact plaster stops the Echo before its body can enter the wall',()=>{
  const h=setup(false);
  assert.equal(h.run('freeAt("E",2.2,3)'),true);
  assert.equal(h.run('freeAt("E",2.3,3)'),false);
  assert.equal(h.run('freeAt("E",3,3)'),false);
});
test('running water opens the Erosion fixture plaster passage for Echo while Anchor still sees a solid wall',()=>{
  const h=setup(true);
  assert.equal(h.run('G.fut[3*G.L.W+3].t'),'hole');
  assert.equal(h.run('freeAt("E",3,3)'),true);
  assert.equal(h.run('freeAt("A",3,3)'),false);
  h.run('G.E.y=2');
  assert.equal(h.run('freeAt("E",3,2)'),false,'adjoining permanent wall stays solid');
});
test('eroded passage has a floor and surviving jambs along the wall rather than across the walking path',()=>{
  const h=setup(true);
  const mesh=h.run('buildToken(world,G.fut[3*G.L.W+3],3*G.L.W+3)');
  const opening=mesh.g.children[0];
  assert.equal(opening.rotation.y,Math.PI/2);
  const boxes=opening.children.filter(n=>n.geo.x);
  assert.equal(boxes.filter(n=>n.y<0).length,1,'a visible floor spans the eroded tile');
  const jambs=boxes.filter(n=>n.y>0);
  assert.equal(jambs.length,2);
  for(const jamb of jambs) assert.ok(Math.abs(jamb.x)-jamb.geo.x/2>0.26,'jamb stays outside the body-width lane');
});
