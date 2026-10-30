// Fast 0/1 BFS for a subset of ChronoLink: tiles # . , ~ ; t r, crates, planks, Echo standing, toppling, pins and
// column relays (no water, trees, bars or Stash Box). compare.mjs checks it against the game's own solve().
// Costs match the real solver's realMoves: shove/stand/pin/unpin = 1; walking, reads, unlocks = 0.
export function compile(def) {
  const H = def.map.length, W = def.map[0].length, N = W * H;
  const base = new Array(N); let A = -1, E = -1, X = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let ch = def.map[y][x]; const i = y * W + x;
    if (ch === 'A') { A = i; ch = '.'; } else if (ch === 'E') { E = i; ch = '.'; } else if (ch === 'X') { X = i; ch = '.'; }
    base[i] = ch;
  }
  const relays = (def.relays || []).map((r, j) => ({ col: r.gate.column, rec: r.receiver.y * W + r.receiver.x, bit: 1 << j }));
  const relayCol = new Int8Array(N).fill(-1);
  for (let j = 0; j < relays.length; j++) for (let y = 1; y < H - 1; y++) relayCol[y * W + relays[j].col] = j;
  const crates = (def.objs || []).filter(o => o.k === 'crate').map(o => o.y * W + o.x).sort((a, b) => a - b);
  const planks = (def.objs || []).filter(o => o.k === 'plank').map(o => o.y * W + o.x).sort((a, b) => a - b);
  return { W, H, N, base, A, E, X, relays, relayCol, crates, planks, pins: def.pins || 0 };
}
// 2026 record kinds: 0 blocked, 1 floor, 2 solid object, 3 chasm, 4 pit, 5 mulch, 6 mulch in a chasm,
// 7 plank bridge, 8 old plank on floor, 9 rotted plank on floor, 10 rotted plank in a chasm. obj: 0 none, 1 crate, 2 plank
function rec(P, i, obj) {
  const b = P.base[i];
  if (b === '#') return 0;
  if (b === 'r') return obj === 1 ? 2 : 0;
  if (b === '~') return obj === 1 ? 4 : obj === 2 ? 7 : 3;
  if (b === ';') return obj === 1 ? 6 : obj === 2 ? 10 : 3;
  if (b === ',') return obj === 1 ? 5 : obj === 2 ? 9 : 1;
  if (b === 't') return 1;
  return obj === 1 ? 2 : obj === 2 ? 8 : 1;
}
const walkable = k => k === 1 || k === 4 || k === 5 || k === 7 || k === 8 || k === 9;
export function fastSolve(P, maxStates = 300000) {
  const { W, N, base } = P;
  const D = [1, -1, W, -W];
  const crateMap = new Uint8Array(N);
  const plankMap = new Uint8Array(N);
  const aWalk = (i, locks) => { const b = base[i]; if (b === '#' || crateMap[i] || (b === 't' && !plankMap[i])) return false; const j = P.relayCol[i]; if (j >= 0 && !(locks & P.relays[j].bit)) return false; return true; };
  const seenA = new Int32Array(N), seenE = new Int32Array(N); let stamp = 0;
  const qa = new Int32Array(N), qe = new Int32Array(N);
  const futRec = new Int8Array(N);
  // state: { a, crates:Int array sorted, stand, standRec, pins: [[i,rec]...], reads, locks }
  const key = st => st.a + '|' + st.crates.join(',') + '|' + st.planks.join(',') + '|' + st.held + '|' + st.locked.join(',') + '|' + st.wit.map(w => w[0] + ':' + w[1]).join(',') + '|' + st.ek + '|' + st.stand + '|' + st.pins.map(p => p[0] + ':' + p[1]).join(',') + '|' + st.reads + '|' + st.locks;
  const start = { a: P.A, e: P.E, crates: P.crates.slice(), planks: P.planks.slice(), held: 0, locked: [], wit: [], stand: -1, standRec: 0, pins: [], reads: 0, locks: 0, d: 0 };
  let cur = [start], nxt = [];
  const best = new Map();
  let explored = 0;
  const zoneSeen = new Int32Array(N); let zstamp = 0; const zq = new Int32Array(N);
  const calm = i => { const b = base[i]; return (futRec[i] === 1 || futRec[i] === 9) && b !== '~' && b !== ';'; };
  const zoneMin = s0 => { zstamp++; let n = 0, m = s0; zq[n++] = s0; zoneSeen[s0] = zstamp; for (let h = 0; h < n; h++) { const c = zq[h]; if (c < m) m = c; for (const d of D) { const k = c + d; if (zoneSeen[k] !== zstamp && calm(k)) { zoneSeen[k] = zstamp; zq[n++] = k; } } } return m; };
  const canon = (st) => {
    for (const c of st.crates) crateMap[c] = 1;
    for (const c of st.planks) plankMap[c] = 1;
    stamp++; let n = 0, amin = st.a; qa[n++] = st.a; seenA[st.a] = stamp;
    for (let h = 0; h < n; h++) { const c = qa[h]; if (c < amin) amin = c; for (const d of D) { const k = c + d; if (seenA[k] !== stamp && aWalk(k, st.locks)) { seenA[k] = stamp; qa[n++] = k; } } }
    for (const c of st.crates) crateMap[c] = 0;
    for (const c of st.planks) plankMap[c] = 0;
    let emin = st.e;
    if (st.stand < 0) {
      computeFut(st);
      if (calm(st.e)) emin = zoneMin(st.e);
      else if (walkable(futRec[st.e])) { let m = Infinity; for (const d of D) if (calm(st.e + d)) m = Math.min(m, zoneMin(st.e + d)); if (m < Infinity) emin = m; }
    }
    return { amin, emin };
  };
  const computeFut = st => {
    for (let i = 0; i < N; i++) futRec[i] = rec(P, i, 0);
    for (const c of st.crates) futRec[c] = rec(P, c, 1);
    for (const c of st.planks) futRec[c] = rec(P, c, 2);
    for (const [i, r] of st.wit) futRec[i] = r;
    for (const [i, r] of st.pins) futRec[i] = r;
    if (st.stand >= 0) futRec[st.stand] = st.standRec;
  };
  const recFree = (st, i) => { const w = st.wit.find(q => q[0] === i); if (w) return w[1]; const p = st.pins.find(q => q[0] === i); if (p) return p[1]; return rec(P, i, st.crates.includes(i) ? 1 : st.planks.includes(i) ? 2 : 0); };
  let parent = null, label = '';
  const push = (st, cost) => {
    st.p = parent; st.l = label;
    const c = canon(st);
    st.a = c.amin; st.ek = st.stand < 0 ? c.emin : st.e;
    const k = key(st), nd = st.d + cost;
    const old = best.get(k);
    if (old != null && old <= nd) return;
    best.set(k, nd); st.d = nd; st.k = k;
    (cost ? nxt : cur).push(st);
  };
  push(start, 0); cur = [start]; best.set(start.k, 0);
  for (let depth = 0; depth < 120; depth++) {
    for (let qi = 0; qi < cur.length; qi++) {
      const st = cur[qi];
      if (best.get(st.k) !== st.d) continue;
      explored++;
      if (explored > maxStates) return { ok: false, why: 'limit', explored };
      for (const c of st.crates) crateMap[c] = 1;
      for (const c of st.planks) plankMap[c] = 1;
      // anchor region
      stamp++; let n = 0; qa[n++] = st.a; seenA[st.a] = stamp;
      for (let h = 0; h < n; h++) { const c = qa[h]; for (const d of D) { const k = c + d; if (seenA[k] !== stamp && aWalk(k, st.locks)) { seenA[k] = stamp; qa[n++] = k; } } }
      const aSt = stamp;
      for (const c of st.crates) crateMap[c] = 0;
      for (const c of st.planks) plankMap[c] = 0;
      computeFut(st);
      // echo region
      const eSeen = new Uint8Array(N); const eq = []; if (walkable(futRec[st.e])) { eq.push(st.e); eSeen[st.e] = 1; }
      for (let h = 0; h < eq.length; h++) { const c = eq[h]; for (const d of D) { const k = c + d; if (!eSeen[k] && walkable(futRec[k])) { eSeen[k] = 1; eq.push(k); } } }
      if (seenA[P.X] === aSt && eSeen[P.X]) { const path = []; for (let q = st; q && q.p !== undefined; q = q.p) if (q.l) path.push(q.l); return { ok: true, depth, explored, path: path.reverse() }; }
      parent = st;
      const aReg = new Uint8Array(N); for (let h = 0; h < n; h++) aReg[qa[h]] = 1;
      const fr = Int8Array.from(futRec);
      // relays: read (free), unlock (free)
      for (const r of P.relays) {
        if (!(st.reads & r.bit) && eSeen[r.rec]) label = 'E scan', push({ ...st, crates: st.crates, pins: st.pins, reads: st.reads | r.bit, e: r.rec, stand: (base[r.rec] === '~' || base[r.rec] === ';') ? r.rec : -1, standRec: fr[r.rec] }, 0);
        if ((st.reads & r.bit) && !(st.locks & r.bit)) {
          let adj = false; for (let y = 1; y < P.H - 1 && !adj; y++) { const i = y * W + r.col; if (base[i] === '#') continue; for (const d of D) if (aReg[i + d]) { adj = true; break; } }
          if (adj) label = 'A unlock', push({ ...st, locks: st.locks | r.bit }, 0);
        }
      }
      // planks: pick up, set down where they bridge or fill (plus one spare floor tile)
      {
        let spare = -1;
        for (let i = 0; i < N; i++) if (base[i] === '.' && aReg[i] && !st.crates.includes(i) && !st.planks.includes(i)) { spare = i; break; }
        for (let i = 0; i < N; i++) {
          let from = -1; for (const d of D) { const k = i + d; if (k >= 0 && k < N && aReg[k]) { from = k; break; } }
          if (from < 0) continue;
          if (!st.held) {
            const pi = st.planks.indexOf(i);
            if (pi >= 0 && !(P.relayCol[i] >= 0 && !(st.locks & P.relays[P.relayCol[i]].bit))) { const np = st.planks.slice(); np.splice(pi, 1); label = 'A pick ' + i; push({ ...st, planks: np, held: 1, a: from }, 1); }
          } else {
            const b = base[i];
            if (!(b === '~' || b === 't' || i === spare)) continue;
            if (P.relayCol[i] >= 0 || st.crates.includes(i) || st.planks.includes(i) || st.wit.some(w => w[0] === i)) continue;
            const np = st.planks.concat([i]).sort((x, y) => x - y); label = 'A drop ' + i; push({ ...st, planks: np, held: 0, a: from }, 1);
          }
        }
      }
      // shoves
      for (let ci = 0; ci < (st.held ? 0 : st.crates.length); ci++) {
        const c = st.crates[ci];
        if (P.relayCol[c] >= 0 && !(st.locks & P.relays[P.relayCol[c]].bit)) continue;
        if (st.locked.includes(c)) continue;
        for (const d of D) {
          const from = c - d, to = c + d;
          if (!aReg[from]) continue;
          const b = base[to];
          if (b === '#' || b === 't' || P.relayCol[to] >= 0) continue;
          if (st.crates.includes(to) || st.planks.includes(to) || st.wit.some(w => w[0] === to)) continue;
          // paradox: a dry crate landing on the Echo's held floor tile
          if (st.stand === to && rec(P, to, 1) === 2) continue;
          // the game also refuses a crate landing on the Echo's own tile: it must step elsewhere in its region first
          let e2 = st.e;
          if (st.stand < 0 && st.e === to && rec(P, to, 1) === 2) { const alt = eq.find(k => k !== to); if (alt == null) continue; e2 = alt; }
          const nc = st.crates.slice(); nc[ci] = to; nc.sort((x, y) => x - y);
          label = 'A shove ' + c + ' ' + d; push({ ...st, crates: nc, a: c, e: e2 }, 1);
        }
      }
      // echo: go to another zone (free), stand on a crack (1), pin/unpin (1)
      for (let h = 0; h < eq.length; h++) {
        const c = eq[h], b = base[c];
        if ((b === '~' || b === ';') && st.stand !== c) label = 'E stand ' + c, push({ ...st, e: c, stand: c, standRec: fr[c] }, 1);
      }
      // echo shoves an old crate (solid kind 2) from the tile behind it
      if (!P.noTopple) for (let i = 0; i < N; i++) {
        if (fr[i] !== 2 && !(st.stand >= 0 && recFree(st, i) === 2)) continue;
        if (st.pins.some(p => p[0] === i)) continue;
        for (const d of D) {
          const b = i - d, j = i + d;
          if (j < W || j >= N - W || (j % W) === 0 || (j % W) === W - 1) continue;
          const keep = st.stand === b, at = k => keep || st.stand < 0 ? fr[k] : recFree(st, k);
          if (at(i) !== 2) continue;
          if (!keep && !(eSeen[b] && walkable(at(b)))) continue;
          if (st.pins.some(p => p[0] === j)) continue;
          const t = at(j), chasm = t === 3 || t === 10;
          if (!chasm) continue;
          const nw = st.wit.filter(w => w[0] !== i && w[0] !== j).concat([[i, rec(P, i, 0)], [j, 4]]).sort((x, y) => x[0] - y[0]);
          const nl = !st.wit.some(w => w[0] === i) && st.crates.includes(i) && !st.locked.includes(i) ? st.locked.concat([i]).sort((x, y) => x - y) : st.locked;
          label = 'E topple ' + i + ' ' + d;
          push({ ...st, wit: nw, locked: nl, e: keep ? st.e : b, stand: keep ? st.stand : -1, standRec: keep ? st.standRec : 0 }, 1);
        }
      }
      computeFut(st);
      {
        const zs = new Set();
        for (let h = 0; h < eq.length; h++) { const c = eq[h]; if (!calm(c)) continue; const z = zoneMin(c); if (zs.has(z)) continue; zs.add(z); if (st.stand >= 0 || z !== st.ek) label = '', push({ ...st, e: z, stand: -1, standRec: 0 }, 0); }
      }
      if (P.pins) {
        const near = new Uint8Array(N);
        for (let h = 0; h < eq.length; h++) { const c = eq[h]; near[c] = 1; for (const d of D) near[c + d] = 1; }
        for (let i = 0; i < N; i++) {
          if (!near[i]) continue;
          const pi = st.pins.findIndex(p => p[0] === i);
          if (pi >= 0) { const np = st.pins.slice(); np.splice(pi, 1); label = 'E unpin ' + i; push({ ...st, pins: np }, 1); continue; }
          if (st.pins.length >= P.pins) continue;
          const r = fr[i], b = base[i];
          // only tiles the past can change are pinnable
          if (!(b === '~' || b === ';' || r === 2 || r === 5 || r === 8 || r === 9)) continue;
          const np = st.pins.concat([[i, r]]).sort((x, y) => x[0] - y[0]);
          label = 'E pin ' + i; push({ ...st, pins: np }, 1);
        }
      }
    }
    if (!nxt.length) return { ok: false, why: 'exhausted', explored };
    cur = nxt; nxt = [];
  }
  return { ok: false, why: 'depth', explored };
}
