// Remove noise: turn each special tile into plain floor or wall when that keeps the puzzle at least as hard.
// usage: node simplify.mjs in.json out.json
import { compile, fastSolve } from './fast-solve.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const src = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let d = src.def || src;
const metric = def => {
  const r = fastSolve(compile(def), 400000);
  if (!r.ok) return null;
  let lines = 0, last = '', echo = 0, eLines = 0;
  for (const p of r.path) {
    if (p.startsWith('A shove') || p.startsWith('E topple')) { const [, , c, dd] = p.split(' '); const tag = p[0] + dd; const prev = last.split('|'); if (!(prev[0] === tag && +prev[1] === +c - +dd)) { lines++; if (p[0] === 'E') eLines++; } last = tag + '|' + c; }
    else { last = ''; if (/^E (stand|pin|unpin)/.test(p) || /^A (pick|drop)/.test(p)) { echo++; } }
  }
  return { depth: r.depth, lines, eLines, echo, explored: r.explored, path: r.path };
};
const better = (a, b) => a && a.depth >= b.depth && a.lines >= b.lines && a.eLines >= b.eLines;
let m = metric(d);
console.log('start', m.depth, m.lines, m.echo, m.explored);
const clone = x => JSON.parse(JSON.stringify(x));
let changed = true;
while (changed) {
  changed = false;
  const H = d.map.length, W = d.map[0].length;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const ch = d.map[y][x];
    if ('.AEX'.includes(ch)) continue;
    for (const to of ch === '#' ? ['.'] : ['.', '#']) {
      if (to === '#' && d.objs.some(o => o.x === x && o.y === y)) continue;
      const c = clone(d); c.map[y] = c.map[y].slice(0, x) + to + c.map[y].slice(x + 1);
      if (to === '#' && c.relays.some(r => r.receiver.x === x && r.receiver.y === y)) continue;
      if (ch === '#' && to === '.') continue; // walls stay (they shape the room); only noise is removed
      const mm = metric(c);
      if (better(mm, m)) { d = c; m = mm; changed = true; console.log('  ', x, y, ch, '->', to, m.depth, m.lines); break; }
    }
  }
  // drop a pin or a crate if that costs nothing
  if (d.pins) { const c = clone(d); c.pins--; const mm = metric(c); if (better(mm, m)) { d = c; m = mm; changed = true; console.log('  pin removed'); } }
  for (let i = 0; i < d.objs.length; i++) { const c = clone(d); c.objs.splice(i, 1); const mm = metric(c); if (better(mm, m)) { d = c; m = mm; changed = true; console.log('  obj removed'); break; } }
}
console.log(d.map.join('\n'));
console.log('final', m.depth, m.lines, m.echo, m.explored);
writeFileSync(process.argv[3], JSON.stringify({ eval: { depth: m.depth, lines: m.lines, explored: m.explored }, def: d, path: m.path }, null, 1));
