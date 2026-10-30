import { C } from './core.mjs';
import { compile, fastSolve } from './fast-solve-water.mjs';
import { makeRng, randomRoom } from './water-room.mjs';
const rnd = makeRng(+process.argv[3] || 11);
let agree = 0, dis = 0, solved = 0, tr = 0, tf = 0;
for (let t = 0; t < +(process.argv[2] || 100); t++) {
  const def = randomRoom(rnd);
  let L; try { L = C.parseChamber(def, 1); } catch { continue; }
  let t0 = Date.now(); const a = C.solve(L, { realMoves: true, noPath: true, maxStates: 150000 }); tr += Date.now() - t0;
  t0 = Date.now(); const b = fastSolve(compile(def), 150000); tf += Date.now() - t0;
  if (a.why === 'limit' || b.why === 'limit') continue;
  const sa = a.ok ? a.depth : a.why, sb = b.ok ? b.depth : b.why; if (a.ok) solved++;
  if (sa === sb) agree++; else { dis++; if (dis <= 4) console.log('DIS', sa, sb, JSON.stringify(def)); }
}
console.log('agree', agree, 'disagree', dis, 'solvable', solved, 'real ms', tr, 'fast ms', tf);
