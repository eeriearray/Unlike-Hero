// Fast 0/1 search for crate + water rooms (one Echo-jammable sluice, optional drain), built on the game's own
// derivation and action rules so records match exactly. Costs follow solve(..., { realMoves: true }):
// shove, stand, topple, jam, drain = 1; walking, reads and unlocks = 0.
import { C } from './core.mjs';
const SOLID = C.SOLID_O;
export function compile(def) {
  const L = C.parseChamber(def, 1);
  const N = L.W * L.H;
  const echoWheel = L.wheels.findIndex(w => w.echo);
  const vol = new Uint8Array(N);
  for (let i = 0; i < N; i++) vol[i] = C.volatile(L, i, null) ? 1 : 0;
  return { L, N, W: L.W, H: L.H, echoWheel, vol, relays: L.relays, A: L.startA.y * L.W + L.startA.x, E: L.startE.y * L.W + L.startE.x, X: L.exit.y * L.W + L.exit.x, crates0: L.objs0.map(o => o.y * L.W + o.x).sort((a, b) => a - b) };
}
export function fastSolve(P, maxStates = 300000, opts = {}) {
  const { L, N, W } = P, D = [1, -1, W, -W];
  const realState = st => ({
    objs: st.crates.map((c, k) => ({ id: 'o' + k, k: 'crate', x: c % W, y: (c / W) | 0, box: null })),
    wheel: L.wheels.map(w => w.start || 0), held: null, locks: Object.fromEntries(L.relays.filter((r, j) => st.locks & (1 << j)).map(r => [r.id, true])),
    echo: { carry: null, pins: [], hold: {}, witness: Object.fromEntries(st.wit), reads: {}, jams: st.jam ? { [P.echoWheel]: true } : {} },
  });
  const flow1924 = C.flowing(L, realState({ crates: [], wit: [], jam: 0, locks: 0 }));
  const rawCache = new Map();
  const raw = st => { const k = st.crates.join(',') + '|' + st.jam; let r = rawCache.get(k); if (!r) { r = C.deriveRaw(L, realState({ ...st, wit: [] })); rawCache.set(k, r); } return r; };
  const futOf = (st, withStand) => { const f = raw(st).slice(); for (const [i, r] of st.wit) f[i] = r; if (withStand && st.stand >= 0) f[st.stand] = st.standRec; return f; };
  const calm = (f, i) => C.walkRec(f[i]) && !P.vol[i] && !(f[i].o && !({ bridge: 1, pit: 1, roots: 1, echoplank: 1, stonebridge: 1, sediment: 1 })[f[i].o]);
  const zoneMin = (f, s0) => { const seen = new Uint8Array(N), q = [s0]; seen[s0] = 1; let m = s0; for (let h = 0; h < q.length; h++) { const c = q[h]; if (c < m) m = c; for (const d of D) { const k = c + d; if (k >= 0 && k < N && !seen[k] && calm(f, k)) { seen[k] = 1; q.push(k); } } } return m; };
  // the solver's zone of a tile: its calm area, or for a tile the past can change, the lowest calm area beside it
  const zoneLabel = (f, c) => { if (calm(f, c)) return zoneMin(f, c); let m = c; for (const d of D) if (calm(f, c + d)) m = Math.min(m, zoneMin(f, c + d)); return m; };
  // 1924 walkability without crates: walls, wheels, culverts, the always-running channels, trenches, relay columns
  const baseA = new Uint8Array(N), relayOf = new Int8Array(N).fill(-1), rs0 = realState({ crates: [], wit: [], jam: 0, locks: 0 });
  for (let i = 0; i < N; i++) {
    const r = C.relayAt(L, i % W, (i / W) | 0); if (r) relayOf[i] = L.relays.indexOf(r);
    const open = { ...rs0, locks: Object.fromEntries(L.relays.map(q => [q.id, true])) };
    baseA[i] = C.walkPast(L, open, i % W, (i / W) | 0, flow1924) ? 1 : 0;
  }
  const regionA = st => {
    const seen = new Uint8Array(N), crate = new Uint8Array(N); for (const c of st.crates) crate[c] = 1;
    const ok = k => baseA[k] && !crate[k] && (relayOf[k] < 0 || (st.locks & (1 << relayOf[k])));
    if (!ok(st.a)) return { seen, cells: [] };
    const q = [st.a]; seen[st.a] = 1; for (let h = 0; h < q.length; h++) { const c = q[h]; for (const d of D) { const k = c + d; if (!seen[k] && ok(k)) { seen[k] = 1; q.push(k); } } } return { seen, cells: q };
  };
  const machines = [...(L.drains || []), ...L.wheels.filter(w => w.echo).map(w => w.y * W + w.x)];
  const regionE = (st, f) => { const seen = new Uint8Array(N), q = []; if (C.walkRec(f[st.e])) { q.push(st.e); seen[st.e] = 1; }
    for (let h = 0; h < q.length; h++) { const c = q[h]; for (const d of D) { const k = c + d; if (k >= 0 && k < N && !seen[k] && C.walkRec(f[k])) { seen[k] = 1; q.push(k); } } } return { seen, cells: q }; };
  const recSig = r => r.t + ':' + (r.o || '') + (r.fixed ? 'F' : '') + (r.shoved ? 'S' : '');
  const key = st => st.ak + '|' + st.crates.join(',') + '|' + st.ek + '|' + st.stand + (st.stand >= 0 ? recSig(st.standRec) : '') + '|' + st.jam + '|' + st.locked.join(',') + '|' + st.wit.map(([i, r]) => i + recSig(r)).join(',') + '|' + st.reads + '|' + st.locks;
  const best = new Map(); let cur = [], nxt = [], explored = 0, parent = null, label = '';
  const push = (st, cost) => {
    st.p = parent; st.l = label;
    const ra = regionA(st); st.ak = ra.cells.length ? Math.min(...ra.cells) : st.a;
    st.ek = st.stand >= 0 ? st.e : zoneLabel(futOf(st, false), st.e);
    const k = key(st), nd = (parent ? parent.d : 0) + cost, old = best.get(k);
    if (old != null && old <= nd) return;
    best.set(k, nd); st.d = nd; st.k = k; (cost ? nxt : cur).push(st);
  };
  const start = { a: P.A, e: P.E, crates: P.crates0.slice(), stand: -1, standRec: null, jam: 0, locked: [], wit: [], reads: 0, locks: 0 };
  if (opts.startJam) {
    const wi = L.wheels[P.echoWheel], i = wi.y * W + wi.x, r = C.echoJam(L, realState(start), futOf(start, false), i);
    if (!r) return { ok: false, why: 'nojam', explored: 0 };
    start.jam = 1; start.wit = [[i, r.s.echo.witness[i]]];
  }
  push(start, 0);
  for (let depth = 0; depth < 150; depth++) {
    for (let qi = 0; qi < cur.length; qi++) {
      const st = cur[qi];
      if (best.get(st.k) !== st.d) continue;
      if (++explored > maxStates) return { ok: false, why: 'limit', explored };
      const ra = regionA(st), f = futOf(st, true), re = regionE(st, f);
      if (ra.seen[P.X] && re.seen[P.X]) { const path = []; for (let q = st; q; q = q.p) if (q.l) path.push(q.l); return { ok: true, depth, explored, path: path.reverse() }; }
      parent = st;
      const free = st.stand >= 0 ? futOf(st, false) : f;
      // relays
      P.relays.forEach((r, j) => {
        const bit = 1 << j, ri = r.receiver.y * W + r.receiver.x;
        if (!(st.reads & bit) && re.seen[ri]) { label = 'E scan'; push({ ...st, reads: st.reads | bit, e: ri, stand: P.vol[ri] ? ri : -1, standRec: P.vol[ri] ? f[ri] : null }, 0); }
        if ((st.reads & bit) && !(st.locks & bit)) {
          let adj = false;
          for (let i = 0; i < N && !adj; i++) { if (C.relayAt(L, i % W, (i / W) | 0)?.id !== r.id || '#Wcp'.includes(L.base[i])) continue; for (const d of D) if (ra.seen[i + d]) { adj = true; break; } }
          if (adj) { label = 'A unlock'; push({ ...st, locks: st.locks | bit }, 0); }
        }
      });
      // anchor shoves
      const rs = realState(st);
      for (let ci = 0; ci < st.crates.length; ci++) {
        const c = st.crates[ci], cx = c % W, cy = (c / W) | 0;
        if (st.locked.includes(c) || C.relayAt(L, cx, cy) && !rs.locks[C.relayAt(L, cx, cy).id]) continue;
        for (const d of D) {
          if (!ra.seen[c - d]) continue;
          const t = c + d; if (!C.canPlace(L, rs, 'crate', t % W, (t / W) | 0)) continue;
          const nc = st.crates.slice(); nc[ci] = t; nc.sort((x, y) => x - y);
          const ns = { ...st, crates: nc, a: c };
          const crushed = k => { const a = raw(ns)[k], b = raw(st)[k]; return !!(a.o && SOLID[a.o] && (a.o !== b.o || a.src !== b.src)); };
          if (st.stand >= 0) { if (crushed(st.stand)) continue; }
          else if (crushed(st.e)) { const alt = re.cells.find(k => !crushed(k)); if (alt == null) continue; ns.e = alt; }
          label = 'A shove ' + c + ' ' + d; push(ns, 1);
        }
      }
      // echo stands on volatile tiles
      for (const c of re.cells) if (P.vol[c] && st.stand !== c) { label = 'E stand ' + c; push({ ...st, e: c, stand: c, standRec: f[c] }, 1); }
      // echo zone moves
      { const zs = new Set(); for (const c of re.cells) { const z = zoneLabel(f, c); if (zs.has(z)) continue; zs.add(z); if (st.stand >= 0 || z !== zoneLabel(f, st.e)) { label = ''; push({ ...st, e: z, stand: -1, standRec: null }, 0); } } }
      // echo topple
      if (!opts.noTopple) for (let i = 0; i < N; i++) {
        if (free[i].o !== 'oldcrate' && f[i].o !== 'oldcrate') continue;
        for (const d of D) {
          const b = i - d, keep = st.stand === b;
          if (!keep && !(re.seen[b] && C.walkRec(free[b]))) continue;
          const ff = keep ? f : free, r = C.echoTopple(L, { ...realState(st), echo: { ...realState(st).echo } }, ff, i, d === 1 ? 1 : d === -1 ? -1 : 0, d === W ? 1 : d === -W ? -1 : 0);
          if (!r) continue;
          const wit = new Map(st.wit); wit.set(i, r.s.echo.witness[i]); wit.set(i + d, r.s.echo.witness[i + d]);
          const locked = st.crates.includes(i) && !st.wit.some(([k]) => k === i) ? [...st.locked, i].sort((x, y) => x - y) : st.locked;
          label = 'E topple ' + i + ' ' + d; push({ ...st, wit: [...wit].sort((x, y) => x[0] - y[0]), locked, e: keep ? st.e : b, stand: keep ? st.stand : -1, standRec: keep ? st.standRec : null }, 1);
        }
      }
      // echo jam / drain: from the standing tile next to it, or from the first reachable neighbour
      for (const i of machines) {
        const keep = st.stand >= 0 && (st.stand === i || Math.abs(st.stand % W - i % W) + Math.abs(((st.stand / W) | 0) - ((i / W) | 0)) === 1);
        let at = null;
        if (!keep) { if (re.seen[i]) at = i; else for (const d of D) { const k = i + d; if (k >= 0 && k < N && re.seen[k]) { at = k; break; } } }
        if (!keep && at == null) continue;
        const ff = keep ? f : free; if (!keep && !C.walkRec(ff[at])) continue;
        for (const [off, fn, kind] of [[opts.noJam, C.echoJam, 'jam'], [opts.noDrain, C.echoDrain, 'drain']]) {
          if (off) continue;
          const r = fn(L, realState(st), ff, i); if (!r) continue;
          const wit = new Map(st.wit); for (const k in r.s.echo.witness) if (!st.wit.some(([q]) => q === +k)) wit.set(+k, r.s.echo.witness[k]);
          label = 'E ' + kind + ' ' + i; push({ ...st, jam: Object.keys(r.s.echo.jams || {}).length ? 1 : st.jam, wit: [...wit].sort((x, y) => x[0] - y[0]), e: keep ? st.e : at, stand: keep ? st.stand : -1, standRec: keep ? st.standRec : null }, 1);
        }
      }
    }
    if (!nxt.length) return { ok: false, why: 'exhausted', explored };
    cur = nxt; nxt = [];
  }
  return { ok: false, why: 'depth', explored };
}
