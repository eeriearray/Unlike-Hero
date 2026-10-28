import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../games/chronolink/index.html',import.meta.url),'utf8');
const ctx=vm.createContext({Math});vm.runInContext(html.slice(html.indexOf('function flashlightClearance('),html.indexOf('const ringGeo =')),ctx);
function beam(map,x,y,yaw){ctx.L={W:map[0].length,H:map.length};ctx.future=map.join('').split('').map(c=>({t:c==='#'?'wall':c==='h'?'hole':'floor'}));ctx.origin={x,y,yaw};return vm.runInContext('flashlightClearance(L,future,origin.x,origin.y,origin.yaw)',ctx);}

test('beam stops at the first full wall in each cardinal direction',()=>{
 const map=['#########','#.......#','#.......#','#.......#','#.......#','#.......#','#.......#','#.......#','#########'];
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]) {const d=beam(map,4,4,yaw);assert.ok(d>3.3&&d<=3.5,`${yaw}: beam stopped at ${d}`);}
});
test('eroded passages let light through, intact plaster blocks it',()=>{
 const wall=['.........','.........','.........','#########','.........','.........','.........','.........','.........'];
 const open=[...wall];open[3]='...hhh...';
 assert.ok(beam(wall,4,1,0)<1.6);
 assert.ok(beam(open,4,1,0)>4.5);
});
test('wide beam clips against a side wall even when the centre ray is unobstructed',()=>{
 const map=['.........','.........','.........','.........','.....#...','.........','.........','.........','.........'];
 const distance=beam(map,4,1,0);assert.ok(distance<5&&distance>2);
});
test('open rooms preserve the full beam length',()=>{
 assert.equal(beam(Array(15).fill('...............'),7,5,0),5);
});
