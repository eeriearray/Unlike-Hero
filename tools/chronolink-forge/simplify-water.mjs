// Strip tiles that add nothing, keeping depth, push lines, jam necessity and jam timing.
import { compile, fastSolve } from './fast-solve-water.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
let d = JSON.parse(readFileSync(process.argv[2], 'utf8')).def;
const metric = def => {
  let P; try { P = compile(def); } catch { return null; }
  const r = fastSolve(P, 200000); if (!r.ok) return null;
  let lines = 0, last = '';
  for (const p of r.path) if (/^(A shove|E topple)/.test(p)) { const [w, , c, dd] = p.split(' '), tag = w + dd, prev = last.split('|'); if (!(prev[0] === tag && +prev[1] === +c - +dd)) lines++; last = tag + '|' + c; } else last = '';
  return { depth: r.depth, lines, path: r.path, explored: r.explored };
};
const valid = def => { const P = compile(def); return fastSolve(P, 300000, { noJam: true }).why === 'exhausted' && ['exhausted', 'nojam'].includes(fastSolve(P, 300000, { startJam: true }).why); };
let m = metric(d); console.log('start', m.depth, m.lines);
let changed = true;
while (changed) {
  changed = false;
  for (let y = 1; y < d.map.length - 1; y++) for (let x = 1; x < d.map[0].length - 1; x++) {
    const ch = d.map[y][x];
    if (!'~;,trbp'.includes(ch) || d.drains.some(p => p.x === x && p.y === y) || d.gates.some(g => g.x === x && g.y === y)) continue;
    for (const to of ['.', '#']) {
      if (to === '#' && (d.objs.some(o => o.x === x && o.y === y) || d.relays.some(r => r.receiver.x === x && r.receiver.y === y))) continue;
      if (to === '.' && d.objs.some(o => o.x === x && o.y === y) && false) continue;
      const c = JSON.parse(JSON.stringify(d)); c.map[y] = c.map[y].slice(0, x) + to + c.map[y].slice(x + 1);
      const mm = metric(c);
      if (mm && mm.depth >= m.depth && mm.lines >= m.lines && valid(c)) { d = c; m = mm; changed = true; console.log(' ', x, y, ch, '->', to, m.depth, m.lines); break; }
    }
  }
}
console.log(d.map.join('\n')); console.log('final', m.depth, m.lines, m.explored);
writeFileSync(process.argv[3], JSON.stringify({ eval: { depth: m.depth, lines: m.lines }, def: d, path: m.path }, null, 1));
