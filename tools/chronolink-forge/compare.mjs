// Checks the fast solver against the game's solve() on random rooms: node compare.mjs [count]
import { C } from './core.mjs';
import { compile, fastSolve } from './fast-solve.mjs';
let rs = 7; const rnd = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };
const ri = n => Math.floor(rnd() * n), pick = a => a[ri(a.length)];
let agree = 0, dis = 0, tf = 0, tr = 0;
for (let t = 0; t < +(process.argv[2]||300); t++) {
  const W = 8 + ri(4), H = 6 + ri(2), rows = [];
  for (let y = 0; y < H; y++) { const r = []; for (let x = 0; x < W; x++) r.push(y === 0 || y === H - 1 || x === 0 || x === W - 1 ? '#' : pick(['.', '.', '.', '.', '#', '~', '~', ',', ';', 't', 'r'])); rows.push(r); }
  rows[1][1] = 'A'; rows[2][1] = 'E'; rows[H - 2][W - 2] = 'X';
  const objs = []; for (let k = 0; k < 1 + ri(3); k++) { const x = 2 + ri(W - 4), y = 1 + ri(H - 2); if ('.~,;r'.includes(rows[y][x]) && !objs.some(o => o.x === x && o.y === y)) objs.push({ k: 'crate', x, y }); }
  for (let k = 0; k < ri(3); k++) { const x = 2 + ri(W - 4), y = 1 + ri(H - 2); if ('.~,;tr'.includes(rows[y][x]) && !objs.some(o => o.x === x && o.y === y)) objs.push({ k: 'plank', x, y }); }
  const relays = rnd() < 0.5 ? [{ gate: { column: 2 + ri(W - 4) }, receiver: { x: 1 + ri(W - 2), y: 1 + ri(H - 2) } }] : [];
  const def = { name: 't', card: '', map: rows.map(r => r.join('')), objs, relays, pins: ri(2) };
  let L; try { L = C.parseChamber(def, 1); } catch { continue; }
  if (relays.length && rows.some(r => 'AEX'.includes(r[relays[0].gate.column]))) continue;
  let t0 = Date.now(); const a = C.solve(L, { realMoves: true, noPath: true, maxStates: 200000 }); tr += Date.now() - t0;
  t0 = Date.now(); const b = fastSolve(compile(def), 200000); tf += Date.now() - t0;
  const sa = a.ok ? a.depth : a.why, sb = b.ok ? b.depth : b.why;
  if (sa === sb) agree++; else { dis++; if (dis < 6) console.log('DIS', sa, sb, JSON.stringify(def)); }
}
console.log('agree', agree, 'disagree', dis, 'real ms', tr, 'fast ms', tf);
