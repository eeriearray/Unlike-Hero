// Random water/crate rooms in the form the forge mutates: one Echo-jammable sluice feeding a channel run.
export function makeRng(seed) { let rs = seed >>> 0 || 1; return () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; }; }
export function randomRoom(rnd, W = 9 + Math.floor(rnd() * 4), H = 6 + Math.floor(rnd() * 3)) {
  const ri = n => Math.floor(rnd() * n), pick = a => a[ri(a.length)];
  const rows = [];
  for (let y = 0; y < H; y++) { const r = []; for (let x = 0; x < W; x++) r.push(y === 0 || y === H - 1 || x === 0 || x === W - 1 ? '#' : pick(['.', '.', '.', '.', '#', '~', '~', ',', ';', 'b', 'b', 'p', 'r'])); rows.push(r); }
  const ay = 1 + ri(H - 3); rows[ay][1] = 'A'; rows[ay + 1][1] = 'E'; rows[1 + ri(H - 2)][W - 2] = 'X';
  // stream: inflow on the top wall, gate just inside, a run of channel or culvert below
  const sx = 2 + ri(W - 4), len = 1 + ri(H - 3);
  rows[0][sx] = 'W';
  for (let j = 1; j <= len && j < H - 1; j++) if (!'AEX'.includes(rows[j][sx])) rows[j][sx] = rnd() < 0.5 ? '=' : 'c';
  if (!'=c'.includes(rows[1][sx])) rows[1][sx] = 'c';
  const def = { name: 'w', card: '', map: rows.map(r => r.join('')), objs: [], relays: [], exitFacing: 'E', gates: [{ id: 'deep', x: sx, y: 1 }], wheels: [], drains: [] };
  const free = () => { for (let t = 0; t < 50; t++) { const x = 1 + ri(W - 2), y = 1 + ri(H - 2); if (rows[y][x] === '.' && !def.objs.some(o => o.x === x && o.y === y) && !def.wheels.some(o => o.x === x && o.y === y)) return { x, y }; } return null; };
  const wpos = free(); if (wpos) def.wheels.push({ ...wpos, echo: true, positions: [['deep']] });
  for (let k = 0; k < 1 + ri(4); k++) { const x = 1 + ri(W - 2), y = 1 + ri(H - 2); if ('.~,;rb'.includes(rows[y][x]) && !def.objs.some(o => o.x === x && o.y === y) && !def.wheels.some(o => o.x === x && o.y === y)) def.objs.push({ k: 'crate', x, y }); }
  if (rnd() < 0.4) { for (let t = 0; t < 30; t++) { const x = 1 + ri(W - 2), y = 1 + ri(H - 2); if (rows[y][x] === ',' && [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => rows[y + dy][x + dx] === 'b') && !def.objs.some(o => o.x === x && o.y === y)) { def.drains.push({ x, y }); break; } } }
  if (rnd() < 0.6) { const c = 2 + ri(W - 4); if (!rows.some(r => 'AEX'.includes(r[c])) && c !== sx && !def.objs.some(o => o.x === c)) def.relays.push({ gate: { column: c }, receiver: { x: 1 + ri(W - 2), y: 1 + ri(H - 2) } }); }
  return def;
}
