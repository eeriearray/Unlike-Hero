// ChronoLink's generator lives in a <script id="chrono-core"> block with no DOM, so it runs here in a VM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../games/chronolink/index.html', import.meta.url), 'utf8');
const src = html.match(/<script id="chrono-core">([\s\S]*?)<\/script>/)[1];
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const C = sandbox.ChronoCore;

test('every level from 1 to 1000 builds and passes the A* solvability check', () => {
  for (let n = 1; n <= 1000; n++) {
    const L = C.generateLevel(n);
    assert.equal(L.n, n);
    assert.ok(L.solution.ok, `level ${n} unsolvable`);
    assert.equal(C.validateLevel(L).ok, true);
  }
});

test('levels are deterministic and seeds are 16 characters', () => {
  for (const n of [1, 77, 512, 1000]) {
    const a = C.generateLevel(n), b = C.generateLevel(n);
    assert.equal(a.seed.length, 16);
    assert.equal(a.seed, b.seed);
    assert.deepEqual(Array.from(a.past.grid), Array.from(b.past.grid));
    assert.deepEqual(a.nodes.map(x => x.type), b.nodes.map(x => x.type));
  }
  const custom = C.generateLevel('anchor-and-echo');
  assert.equal(custom.custom, true);
  assert.equal(custom.seed, C.generateLevel('ANCHORANDECHO').seed);
});

test('complexity scales: 3 steps at level 1, 6+ from 101, 12+ from 500 (breather levels excepted)', () => {
  assert.equal(C.generateLevel(1).steps, 3);
  for (const n of [101, 250, 499]) assert.ok(C.generateLevel(n).steps >= 6, `level ${n}`);
  for (const n of [501, 750, 999]) assert.ok(C.generateLevel(n).steps >= 12, `level ${n}`);
});

test('pacing: every 20th level is a shorter breather, 17-19 are the climax', () => {
  for (const base of [100, 300, 700]) {
    const breather = C.generateLevel(base + 20).steps, climax = C.generateLevel(base + 19).steps;
    assert.ok(breather < climax, `breather ${base + 20} (${breather}) should be shorter than climax ${base + 19} (${climax})`);
  }
});

test('each mechanic is introduced on schedule, and variants unlock in order', () => {
  const has = (n, f) => C.generateLevel(n).links.some(f);
  assert.ok(has(3, l => l.type === 'ACID'));
  assert.ok(has(4, l => l.type === 'PUSH'));
  assert.ok(has(6, l => l.type === 'SLUICE'));
  assert.ok(has(8, l => l.type === 'STASH'));
  assert.ok(has(C.SYNC_FROM, l => l.type === 'SYNC'));
  assert.ok(has(C.CIPHER_FROM, l => l.cipher));
  assert.ok(has(C.SEQUENCE_FROM, l => l.seq));
  for (let n = 1; n < C.CIPHER_FROM; n++) assert.ok(!has(n, l => l.cipher), `no cipher before ${C.CIPHER_FROM} (level ${n})`);
  for (let n = 1; n < C.DECOY_FROM; n++) assert.ok(!C.generateLevel(n).past.objs.some(o => o.decoy), `no decoys in Act I (level ${n})`);
  assert.ok(C.generateLevel(C.DECOY_FROM).past.objs.some(o => o.decoy));
});

test('consecutive causal links alternate between 1924 and 2026', () => {
  for (const n of [1, 50, 200, 900]) {
    const { links } = C.generateLevel(n);
    for (let i = 1; i < links.length; i++) assert.notEqual(links[i].dir, links[i - 1].dir, `level ${n} link ${i}`);
  }
});

test('the exit is unreachable before the causal chain is done', () => {
  for (const n of [1, 30, 400]) {
    const L = C.generateLevel(n);
    for (const [room, start] of [[L.past, L.past.start], [L.future, L.future.start]]) {
      const p = C.astar(room, start.x, start.y, (x, y) => x === room.exit.x && y === room.exit.y, room.exit.x, room.exit.y, () => false);
      assert.equal(p, null, `level ${n} ${room.era} exit reachable with nothing done`);
    }
  }
});

test('both eras are the same building: identical walls and an aged twin on every furnished tile', () => {
  for (const n of [1, 12, 140, 600, 1000]) {
    const L = C.generateLevel(n), P = L.past, F = L.future;
    for (let i = 0; i < P.grid.length; i++) assert.equal(P.grid[i] === 1, F.grid[i] === 1, `level ${n} wall mismatch at ${i}`);
    for (const o of P.objs) {
      if (!o.solid || o.barrier || o.kind === 'planter') continue;
      const twin = F.objAt[o.y * L.W + o.x];
      assert.ok(twin && twin.solid, `level ${n}: ${o.kind} at ${o.x},${o.y} has no 2026 twin`);
    }
    assert.deepEqual(P.start, F.start);
    assert.deepEqual(P.exit, F.exit);
  }
});

// An independent push solver (plain BFS over exact crate + player positions) so the test doesn't trust the generator.
function solveCrateRoom(L, link) {
  const P = L.past, F = L.future, W = L.W, crates = P.objs.filter(o => o.crate && o.crateLink === link.index);
  const area = crates[0].area, goals = crates.map(c => c.goal.y * W + c.goal.x);
  const open = i => { const x = i % W, y = (i / W) | 0; return y >= 1 && y <= L.H - 2 && [P, F].every(r => r.grid[i] === 0 && (!r.objAt[i] || r.objAt[i].crate)); };
  const inArea = i => { const x = i % W; return x >= area.x0 && x <= area.x1; };
  const sp = link.crateSol.startP, start = { c: crates.map(c => c.y * W + c.x), p: sp.y * W + sp.x };
  const key = s => s.c.slice().sort((a, b) => a - b).join(',') + '@' + s.p;
  const seen = new Set([key(start)]); let frontier = [start];
  for (let depth = 0; depth < 60; depth++) {
    const next = [];
    for (const s of frontier) {
      if (s.c.every(c => goals.includes(c))) return depth;
      for (const d of [1, -1, W, -W]) {
        const np = s.p + d; if (!open(np)) continue;
        const ci = s.c.indexOf(np);
        if (ci < 0) { const ns = { c: s.c, p: np }, k = key(ns); if (!seen.has(k)) { seen.add(k); frontier.push(ns); } continue; }
        const to = np + d; if (!open(to) || !inArea(to) || s.c.includes(to)) continue;
        const ns = { c: s.c.map((c, j) => j === ci ? to : c), p: np }, k = key(ns);
        if (!seen.has(k)) { seen.add(k); next.push(ns); }
      }
    }
    frontier = next; if (!frontier.length) return -1;
  }
  return -1;
}

test('crate puzzles are solvable from the start and need real planning', () => {
  let checked = 0;
  for (let n = 9; n <= 1000 && checked < 14; n += 37) {
    const L = C.generateLevel(n);
    for (const link of L.links.filter(l => l.type === 'CRATE')) {
      const pushes = solveCrateRoom(L, link);
      assert.ok(pushes >= 0, `level ${n}: crate room unsolvable`);
      assert.equal(pushes, link.crateSol.pushes, `level ${n}: generator's push count should be the true minimum`);
      assert.ok(pushes >= (link.nCrates === 1 ? 4 : 8), `level ${n}: only ${pushes} pushes`);
      checked++;
    }
  }
  assert.ok(checked >= 8);
});

test('from level 9 every non-breather level has a crate or flood puzzle', () => {
  for (let n = 9; n <= 300; n++) {
    if (C.cyclePos(n) === 20) continue;
    const L = C.generateLevel(n);
    assert.ok(L.links.some(l => l.type === 'CRATE' || l.type === 'FLOW'), `level ${n}: ${L.links.map(l => l.type).join('>')}`);
  }
});
