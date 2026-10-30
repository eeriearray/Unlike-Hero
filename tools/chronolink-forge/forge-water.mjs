// Evolve crate + water rooms where jamming the 2026 sluice is required and its timing matters.
// usage: node forgew.mjs <x|seed.json> <rng> <minutes> <out.json>
import { compile, fastSolve } from './fast-solve-water.mjs';
import { makeRng, randomRoom } from './water-room.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
const [, , seedArg, rngArg, minArg, out] = process.argv;
const rnd = makeRng(+rngArg || 1), ri = n => Math.floor(rnd() * n), pick = a => a[ri(a.length)];
const clone = d => JSON.parse(JSON.stringify(d));
const TILES = ['.', '.', '.', '#', '#', '~', '~', '~', ',', ';', 'b', 'b', 'p', 'r', 't'];
const MAXEXP = +(process.env.MAXEXP || 60000);
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function mutate(d0) {
  const d = clone(d0), g = d.map.map(r => r.split('')), H = g.length, W = g[0].length, k = rnd();
  const fixed = (x, y) => 'AEXWc='.includes(g[y][x]) || d.wheels.some(w => w.x === x && w.y === y);
  const interior = () => ({ x: 1 + ri(W - 2), y: 1 + ri(H - 2) });
  if (k < 0.42) { for (let n = 1 + ri(2); n--;) { const p = interior(); if (!fixed(p.x, p.y)) g[p.y][p.x] = pick(TILES); } }
  else if (k < 0.68) { const op = rnd();
    if (op < 0.6 && d.objs.length) { const o = pick(d.objs); if (rnd() < 0.7) { o.x += pick([-1, 1, 0, 0]); o.y += pick([0, 0, -1, 1]); } else Object.assign(o, interior()); }
    else if (op < 0.82 && d.objs.length < 5) d.objs.push({ k: 'crate', ...interior() });
    else if (d.objs.length > 1) d.objs.splice(ri(d.objs.length), 1); }
  else if (k < 0.74) { const w = d.wheels[0]; const p = interior(); if (g[p.y][p.x] === '.') { w.x = p.x; w.y = p.y; } }
  else if (k < 0.8) { // move or regrow the stream
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ('Wc='.includes(g[y][x])) g[y][x] = y === 0 || y === H - 1 ? '#' : (g[y][x] === 'c' ? '#' : '.');
    const sx = 1 + ri(W - 2), top = rnd() < 0.5, y0 = top ? 0 : H - 1, dy = top ? 1 : -1, len = 1 + ri(H - 3);
    g[y0][sx] = 'W';
    for (let j = 1; j <= len; j++) { const y = y0 + dy * j; if (y <= 0 || y >= H - 1 || 'AEX'.includes(g[y][sx])) break; g[y][sx] = j === 1 || rnd() < 0.4 ? 'c' : '='; }
    d.gates = [{ id: 'deep', x: sx, y: y0 + dy }]; }
  else if (k < 0.86) { const ch = pick(['A', 'E', 'X']); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === ch) g[y][x] = '.';
    const p = interior(); if (!fixed(p.x, p.y)) g[p.y][p.x] = ch; else g[1 + ri(H - 2)][ch === 'X' ? W - 2 : 1] = ch; }
  else if (k < 0.92) { if (d.drains.length && rnd() < 0.5) d.drains = []; else { const p = interior(); if (!fixed(p.x, p.y)) { g[p.y][p.x] = ','; d.drains = [p]; } } }
  else { const op = rnd();
    if (op < 0.25 && d.relays.length < 2) d.relays.push({ gate: { column: 2 + ri(W - 4) }, receiver: interior() });
    else if (op < 0.85 && d.relays.length) { const r = pick(d.relays); if (rnd() < 0.6) r.receiver = interior(); else r.gate.column = Math.max(1, Math.min(W - 2, r.gate.column + pick([-1, 1]))); }
    else if (d.relays.length > 1) d.relays.splice(ri(d.relays.length), 1); }
  d.map = g.map(r => r.join(''));
  return repair(d);
}
function repair(d) {
  const g = d.map.map(r => r.split('')), H = g.length, W = g[0].length;
  for (const ch of 'AEX') { let n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === ch && n++) g[y][x] = '.'; if (!n) return null; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((y === 0 || y === H - 1 || x === 0 || x === W - 1) && g[y][x] !== 'W') g[y][x] = '#';
  d.map = g.map(r => r.join(''));
  const gt = d.gates[0]; if (!gt || !'c='.includes(g[gt.y][gt.x])) return null;
  const w = d.wheels[0]; if (!w || g[w.y][w.x] !== '.') return null;
  const used = new Set([w.x + ',' + w.y]);
  d.objs = d.objs.filter(o => { const t = g[o.y]?.[o.x], k = o.x + ',' + o.y; if (!t || !'.,~;rb'.includes(t) || used.has(k)) return false; used.add(k); return true; });
  if (!d.objs.length) return null;
  d.drains = d.drains.filter(p => g[p.y][p.x] === ',' && D4.some(([dx, dy]) => g[p.y + dy]?.[p.x + dx] === 'b') && !used.has(p.x + ',' + p.y));
  const cols = new Set();
  d.relays = d.relays.filter(r => { const c = r.gate.column; if (c < 1 || c > W - 2 || cols.has(c) || r.receiver.x === c) return false;
    for (let y = 1; y < H - 1; y++) if ('AEX'.includes(g[y][c]) || (w.x === c && w.y === y)) return false;
    if (d.objs.some(o => o.x === c) || d.drains.some(p => p.x === c) || !'.,t'.includes(g[r.receiver.y]?.[r.receiver.x])) return false;
    cols.add(c); return true; });
  if (!d.relays.length) return null;
  return d;
}
function evaluate(d, curScore) {
  if (!d) return null;
  let P; try { P = compile(d); } catch { return null; }
  const r = fastSolve(P, MAXEXP);
  if (!r.ok || r.depth < 4) return null;
  let lines = 0, last = '', jamAt = -1, echo = 0, n = 0;
  for (const p of r.path) {
    if (/^(A shove|E topple)/.test(p)) { const [w, , c, dd] = p.split(' '); const tag = w + dd, prev = last.split('|'); if (!(prev[0] === tag && +prev[1] === +c - +dd)) lines++; last = tag + '|' + c; n++; }
    else { last = ''; if (/^E (stand|jam|drain|topple)/.test(p)) { echo++; n++; } }
    if (p.startsWith('E jam')) jamAt = n;
  }
  const crates = d.objs.length;
  let score = 2.0 * lines + 1.3 * Math.min(echo, 12) + 0.4 * r.depth + 1.2 * Math.log2(Math.max(1, r.explored / 300)) - 0.5 * crates - (jamAt < 0 ? 40 : 0);
  const e = { score, depth: r.depth, lines, echo, explored: r.explored, jamAt, need: null, timing: null };
  if (jamAt >= 0 && score + 10 >= curScore) {
    const nj = fastSolve(P, MAXEXP * 2, { noJam: true }), pj = fastSolve(P, MAXEXP * 2, { startJam: true });
    e.need = nj.why === 'exhausted'; e.timing = pj.why === 'exhausted' || pj.why === 'nojam';
    e.score += (e.need ? 4 : -12) + (e.timing ? 10 : -8);
  } else e.score -= 12;
  return e;
}
const endAt = Date.now() + (+minArg || 5) * 60000;
let cur, curE;
if (seedArg.endsWith('.json')) { cur = JSON.parse(readFileSync(seedArg, 'utf8')).def; curE = evaluate(cur, -1e9); }
let tries = 0;
while (!curE) { tries++; let d = randomRoom(rnd); d = repair(d); for (let i = 0; i < 8 && d; i++) d = mutate(d) || d; cur = d; curE = evaluate(d, -1e9); if (curE && curE.jamAt < 0) curE = null; }
let best = cur, bestE = curE, it = 0, T = 2.5, since = 0;
const save = () => writeFileSync(out, JSON.stringify({ eval: bestE, def: best }, null, 1));
save(); console.log('start after', tries, JSON.stringify(curE));
while (Date.now() < endAt) {
  it++; since++;
  let cand = mutate(cur); if (cand && rnd() < 0.35) cand = mutate(cand);
  const e = evaluate(cand, curE.score); if (!e) continue;
  if (e.score >= curE.score || rnd() < Math.exp((e.score - curE.score) / T)) { cur = cand; curE = e; }
  if (e.score > bestE.score && e.need && e.timing) { best = cand; bestE = e; since = 0; save(); console.log(it, JSON.stringify(e)); }
  T = Math.max(0.5, T * 0.9995);
  if (since > 2500) { cur = best; curE = bestE; since = 0; T = 2.5; }
}
console.log('done', it, JSON.stringify(bestE));
