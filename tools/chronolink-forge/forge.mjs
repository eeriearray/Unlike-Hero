// Evolves two-era crate rooms (the Undercroft style) by simulated annealing, scored with the fast solver.
// Rooms where the Echo topples crates in fewer than two places are rejected.
// usage: node forge.mjs <x|seed.json> <rngSeed> <minutes> <out.json> [W H]
//   env PLANKS=n allows up to n planks; MAXEXP caps the fast search size (keep the game's hint budget in mind).
import { compile, fastSolve } from './fast-solve.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
const [, , seedArg, rngArg, minArg, out, wArg, hArg] = process.argv;
let rs = (+rngArg || 1) >>> 0;
const rnd = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };
const ri = n => Math.floor(rnd() * n), pick = a => a[ri(a.length)];
const clone = d => JSON.parse(JSON.stringify(d));
const TILES = ['.', '.', '.', '#', '#', '~', '~', '~', ',', ';', 't', 'r'];
const W0 = +wArg || 0, H0 = +hArg || 0, PLANKS = +(process.env.PLANKS || 0), MAXEXP = +(process.env.MAXEXP || 200000);

function emptyRoom() {
  const W = W0 || 9 + ri(5), H = H0 || 6 + ri(3), rows = [];
  for (let y = 0; y < H; y++) { const r = []; for (let x = 0; x < W; x++) r.push(y === 0 || y === H - 1 || x === 0 || x === W - 1 ? '#' : pick(TILES)); rows.push(r); }
  const ay = 1 + ri(H - 3); rows[ay][1] = 'A'; rows[ay + 1][1] = 'E'; rows[1 + ri(H - 2)][W - 2] = 'X';
  const objs = []; for (let k = 0; k < 2 + ri(3); k++) objs.push({ k: 'crate', x: 2 + ri(W - 4), y: 1 + ri(H - 2) });
  return repair({ name: 'forged', card: '', map: rows.map(r => r.join('')), objs, relays: [{ gate: { column: 2 + ri(W - 4) }, receiver: { x: 1 + ri(W - 2), y: 1 + ri(H - 2) } }], pins: ri(2), exitFacing: 'E' });
}
const grid = d => d.map.map(r => r.split(''));
const interior = g => ({ x: 1 + ri(g[0].length - 2), y: 1 + ri(g.length - 2) });
const special = (g, x, y) => 'AEX'.includes(g[y][x]);
function mutate(d0) {
  const d = clone(d0), g = grid(d), H = g.length, W = g[0].length, k = rnd();
  if (k < 0.45) {
    for (let i = 0, n = 1 + ri(2); i < n; i++) {
      const p = interior(g); if (special(g, p.x, p.y)) continue;
      if (rnd() < 0.3) { const q = interior(g); if (special(g, q.x, q.y)) continue; [g[p.y][p.x], g[q.y][q.x]] = [g[q.y][q.x], g[p.y][p.x]]; }
      else g[p.y][p.x] = pick(TILES);
    }
  } else if (k < 0.75) {
    const op = rnd();
    if (op < 0.6 && d.objs.length) { const o = pick(d.objs); if (rnd() < 0.7) { o.x += pick([-1, 1, 0, 0]); o.y += pick([0, 0, -1, 1]); } else Object.assign(o, interior(g)); }
    else if (op < 0.82 && d.objs.length < 5) d.objs.push({ k: PLANKS && rnd() < 0.4 ? 'plank' : 'crate', ...interior(g) });
    else if (d.objs.length > 1) d.objs.splice(ri(d.objs.length), 1);
  } else if (k < 0.8) {
    const ch = pick(['A', 'E', 'X']);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === ch) g[y][x] = '.';
    const p = interior(g); if (!special(g, p.x, p.y)) g[p.y][p.x] = ch; else g[1 + ri(H - 2)][ch === 'X' ? W - 2 : 1] = ch;
  } else if (k < 0.93) {
    const op = rnd();
    if (op < 0.2 && d.relays.length < 2) d.relays.push({ gate: { column: 2 + ri(W - 4) }, receiver: interior(g) });
    else if (op < 0.85) { const r = pick(d.relays); if (rnd() < 0.6) r.receiver = interior(g); else r.gate.column = Math.max(1, Math.min(W - 2, r.gate.column + pick([-1, 1]))); }
    else if (d.relays.length > 1) d.relays.splice(ri(d.relays.length), 1);
  } else d.pins = ri(3);
  d.map = g.map(r => r.join(''));
  return repair(d);
}
function repair(d) {
  const g = grid(d), H = g.length, W = g[0].length;
  for (const ch of 'AEX') { let n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === ch && n++) g[y][x] = '.'; if (!n) return null; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((y === 0 || y === H - 1 || x === 0 || x === W - 1)) g[y][x] = '#';
  // starts and exit stand on plain floor tiles
  d.map = g.map(r => r.join(''));
  const used = new Set();
  d.objs = d.objs.filter(o => { const t = g[o.y]?.[o.x]; const k = o.x + ',' + o.y; if (!t || !(o.k === 'plank' ? '.,~;tr' : '.,~;r').includes(t) || used.has(k)) return false; used.add(k); return true; });
  if (d.objs.filter(o => o.k === 'plank').length > PLANKS) return null;
  if (!d.objs.length) return null;
  d.relays = d.relays.filter(r => { const c = r.gate.column; if (c < 1 || c > W - 2 || r.receiver.x === c) return false; if (d.objs.some(o => o.x === c)) return false; for (let y = 1; y < H - 1; y++) if ('AEX'.includes(g[y][c])) return false; return r.receiver.x > 0 && r.receiver.x < W - 1 && r.receiver.y > 0 && r.receiver.y < H - 1 && g[r.receiver.y][r.receiver.x] !== '#'; });
  const cols = new Set(); d.relays = d.relays.filter(r => { if (cols.has(r.gate.column)) return false; cols.add(r.gate.column); return '.,t'.includes(g[r.receiver.y][r.receiver.x]) && !d.objs.some(o => o.x === r.receiver.x && o.y === r.receiver.y); });
  if (!d.relays.length) return null;
  return d;
}
function evaluate(d, budget) {
  if (!d) return null;
  const P = compile(d);
  // the Echo must not be able to leave before anything happens
  const r = fastSolve(P, budget);
  if (!r.ok || r.depth < 3 || r.explored > MAXEXP) return null;
  // box lines: consecutive shoves of one crate in one direction count once (either era)
  let lines = 0, last = '', stands = 0, pins = 0, unpins = 0, lastCrate = -1, switches = 0, eShoves = 0, aLines = 0, eLines = 0, handoffs = 0, lastWho = '';
  for (const p of r.path) {
    const who = p[0];
    if (p.startsWith('A shove') || p.startsWith('E topple')) {
      const [, , c, dd] = p.split(' ');
      const prev = last.split('|');
      if (!(prev[0] === who + dd && +prev[1] === +c - +dd)) { lines++; if (who === 'A') aLines++; else eLines++; }
      last = who + dd + '|' + c;
      if (lastCrate !== +c && lastCrate !== -1) switches++;
      lastCrate = +c + +dd;
      if (who === 'E') eShoves++;
    } else if (p.startsWith('A pick') || p.startsWith('A drop')) { last = ''; lines++; aLines++; }
    else { last = ''; if (p.startsWith('E stand')) stands++; else if (p.startsWith('E pin')) pins++; else if (p.startsWith('E unpin')) unpins++; }
    if (who === 'A' || who === 'E') { if (lastWho && who !== lastWho && !/scan|unlock/.test(p)) handoffs++; if (!/scan|unlock/.test(p)) lastWho = who; }
  }
  const echo = stands + pins + unpins + eShoves;
  const score = 2.0 * lines + 1.0 * echo + 1.5 * Math.min(eLines, aLines) + 0.6 * handoffs + 0.4 * switches + 0.4 * r.depth + 1.2 * Math.log2(Math.max(1, r.explored / 300))
    + 4 * eLines - 0.5 * d.objs.length - (eLines < 2 ? 40 : 0) - (aLines < 3 ? 25 : 0);
  return { score, depth: r.depth, lines, aLines, eLines, handoffs, echo, explored: r.explored };
}
const CAP = 120000, endAt = Date.now() + (+minArg || 5) * 60000;
let cur, curE;
if (seedArg.endsWith('.json')) { cur = JSON.parse(readFileSync(seedArg, 'utf8')).def; curE = evaluate(cur, CAP); }
let tries = 0;
while (!curE) { tries++; let d = emptyRoom(); for (let i = 0; i < 10 && d; i++) d = mutate(d) || d; cur = d; curE = evaluate(d, 30000); }
let best = cur, bestE = curE, it = 0, T = 2.5, since = 0;
const save = () => writeFileSync(out, JSON.stringify({ eval: bestE, def: best }, null, 1));
save(); console.log('start after', tries, JSON.stringify(curE));
while (Date.now() < endAt) {
  it++; since++;
  let cand = mutate(cur); if (cand && rnd() < 0.35) cand = mutate(cand);
  const e = evaluate(cand, Math.min(CAP, Math.max(30000, curE.explored * 3)));
  if (!e) continue;
  if (e.score >= curE.score || rnd() < Math.exp((e.score - curE.score) / T)) { cur = cand; curE = e; }
  if (e.score > bestE.score) { best = cand; bestE = e; since = 0; save(); console.log(it, JSON.stringify(e)); }
  T = Math.max(0.5, T * 0.9995);
  if (since > 2500) { cur = best; curE = bestE; since = 0; T = 2.5; }
}
console.log('done', it, JSON.stringify(bestE));
