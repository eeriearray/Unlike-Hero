import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { RUST } from './fixtures/chronolink-chambers.mjs';
const html = readFileSync(new URL('../games/chronolink/index.html', import.meta.url), 'utf8');
const context = vm.createContext({Math,Number});
vm.runInContext(html.match(/<script id="chrono-core">([\s\S]*?)<\/script>/)[1],context);
vm.runInContext(html.slice(html.indexOf('function doorwayAlongZ('), html.indexOf('const ringGeo =')),context);
const L = map => ({W:map[0].length,H:map.length,base:map.join('').split('')});
const alongZ = level => {context.level=level;return vm.runInContext('doorwayAlongZ(level,2,2)',context);};

test('grilles in north-south walls span Z, across an east-west passage',()=>{
  assert.equal(alongZ(L(['.....','..#..','.....','..c..','.....'])),true);
});
test('grilles in east-west walls span X, across a north-south passage',()=>{
  assert.equal(alongZ(L(['.....','.....','.#.p.','.....','.....'])),false);
});
test('the Rust fixture grille follows its partition and its exit arch faces the approach',()=>{
  context.level=context.ChronoCore.parseChamber(RUST,0);
  assert.equal(vm.runInContext('doorwayAlongZ(level,10,3)',context),true);
  assert.equal(vm.runInContext('exitGateYaw(level)',context),Math.PI/2);
});
test('exit arches on all four sides face into the chamber',()=>{
  for(const [x,y,yaw] of [[1,4,Math.PI/2],[9,4,Math.PI/2],[5,1,0],[5,7,0]]) {
    context.level={W:11,H:9,exit:{x,y}};
    assert.equal(vm.runInContext('exitGateYaw(level)',context),yaw);
  }
});
test('every chamber exit arch follows its authored approach rather than the nearest wall',()=>{
  for(let n=1;n<=context.ChronoCore.MAX_LEVEL;n++) {
    context.level=context.ChronoCore.getChamber(n);
    const f=context.level.exitFacing, expected=f==='N'||f==='S'?0:Math.PI/2;
    assert.equal(vm.runInContext('exitGateYaw(level)',context),expected,`chamber ${n} follows its authored approach`);
  }
  context.level={W:14,H:8,exit:{x:11,y:3},exitFacing:'S'};
  assert.equal(vm.runInContext('exitGateYaw(level)',context),0,'explicit facing also overrides a nearer side wall');
});
