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

test('every chamber from 1 to 40 builds and passes the A* solvability check', () => {
  assert.equal(C.MAX_LEVEL, 40);
  for (let n = 1; n <= C.MAX_LEVEL; n++) {
    const L = C.generateLevel(n);
    assert.equal(L.n, n);
    assert.ok(L.solution.ok, `level ${n} unsolvable`);
    assert.equal(C.validateLevel(L).ok, true);
  }
  assert.equal(C.generateLevel(1000).n, C.MAX_LEVEL, 'level numbers clamp to the campaign');
});

test('levels are deterministic and seeds are 16 characters', () => {
  for (const n of [1, 17, 33, 40]) {
    const a = C.generateLevel(n), b = C.generateLevel(n);
    assert.equal(a.seed.length, 16);
    assert.equal(a.seed, b.seed);
    assert.deepEqual(Array.from(a.past.grid), Array.from(b.past.grid));
    assert.deepEqual(a.nodes.map(x => x.type), b.nodes.map(x => x.type));
    assert.deepEqual(a.links.map(l => l.code || l.seq || null), b.links.map(l => l.code || l.seq || null));
  }
  const custom = C.generateLevel('anchor-and-echo');
  assert.equal(custom.custom, true);
  assert.equal(custom.seed, C.generateLevel('ANCHORANDECHO').seed);
});

test('complexity scales: 4+ steps from chamber 1, 7+ from 15, 12+ from 33 (breathers excepted)', () => {
  assert.ok(C.generateLevel(1).steps >= 4);
  for (const n of [15, 21, 26]) assert.ok(C.generateLevel(n).steps >= 7, `level ${n}`);
  for (const n of [33, 36, 39]) assert.ok(C.generateLevel(n).steps >= 12, `level ${n}`);
});

test('pacing: every 10th chamber is a shorter breather, 8-9 are the climax', () => {
  for (const base of [10, 20, 30]) {
    const breather = C.generateLevel(base + 10).steps, climax = C.generateLevel(base + 9).steps;
    assert.ok(breather < climax, `breather ${base + 10} (${breather}) should be shorter than climax ${base + 9} (${climax})`);
  }
});

test('each mechanic is introduced on schedule, and variants unlock in order', () => {
  const has = (n, f) => C.generateLevel(n).links.some(f);
  assert.ok(has(3, l => l.type === 'ACID'));
  assert.ok(has(4, l => l.type === 'PUSH'));
  assert.ok(has(5, l => l.type === 'SLUICE'));
  assert.ok(has(6, l => l.type === 'STASH'));
  assert.ok(has(C.SYNC_FROM, l => l.type === 'SYNC'));
  assert.ok(has(C.CIPHER_FROM, l => l.cipher));
  assert.ok(has(C.SEQUENCE_FROM, l => l.seq));
  for (let n = 1; n < C.CIPHER_FROM; n++) assert.ok(!has(n, l => l.cipher), `no cipher before ${C.CIPHER_FROM} (level ${n})`);
  for (let n = 1; n < C.DECOY_FROM; n++) assert.ok(!C.generateLevel(n).past.objs.some(o => o.decoy), `no decoys before ${C.DECOY_FROM} (level ${n})`);
  for (let n = C.DECOY_FROM; n <= C.MAX_LEVEL; n++) if (C.cyclePos(n) !== 10) assert.ok(C.generateLevel(n).past.objs.some(o => o.decoy), `decoys in level ${n}`);
});

// Brute force over every possible answer, independent of the generator's own search.
test('every code and lever puzzle has exactly one answer, and neither era can solve it alone', () => {
  let codes = 0, levers = 0;
  for (let n = 1; n <= C.MAX_LEVEL; n++) {
    for (const L of C.generateLevel(n).links) {
      if (!L.puzzle) continue;
      const { past, future } = L.puzzle;
      assert.ok(past.length >= 1 && future.length >= 1, `level ${n}: both eras hold clues`);
      let space, truth, known;
      if (L.type === 'CODE') {
        space = []; for (let v = 0; v < 10000; v++) space.push(String(v).padStart(4, '0').split('').map(Number));
        truth = L.code.split('').map(Number);
        // The black box shows every digit except the burned ones.
        known = c => c.every((d, i) => L.burned.includes(i) || d === truth[i]);
        assert.ok(L.burned.length >= (n < 5 ? 1 : n < 15 ? 2 : 3), `level ${n}: enough burned digits`);
        codes++;
      } else {
        const len = L.seq ? L.seq.length : 1;
        space = []; const perm = p => { if (p.length === len) return space.push(p); for (let i = 0; i < 3; i++) if (!p.includes(i)) perm(p.concat(i)); }; perm([]);
        truth = L.seq ? [...L.seq] : [L.correct];
        known = c => future.every(q => q.test(c));
        levers++;
      }
      const all = space.filter(c => known(c) && past.every(q => q.test(c)));
      assert.equal(all.length, 1, `level ${n} ${L.type}: ${all.length} answers`);
      assert.deepEqual(all[0], truth, `level ${n} ${L.type}: wrong answer`);
      assert.ok(space.filter(known).length >= 2, `level ${n} ${L.type}: 2026 alone gives it away`);
      assert.ok(space.filter(c => past.every(q => q.test(c))).length >= 2, `level ${n} ${L.type}: 1924 alone gives it away`);
    }
  }
  assert.ok(codes >= 15 && levers >= 15, `${codes} codes, ${levers} lever banks`);
});

test('from chamber 6 the Stash Box always has a wrong-material bench beside the right one', () => {
  for (let n = C.DECOY_BENCH_FROM; n <= C.MAX_LEVEL; n++) {
    const L = C.generateLevel(n);
    for (const link of L.links.filter(l => l.type === 'STASH')) {
      const benches = L.past.objs.filter(o => o.kind === 'workbench');
      assert.ok(benches.some(o => o.wrongItem && o.item !== link.item), `level ${n}: no decoy bench`);
    }
  }
});

test('consecutive causal links alternate between 1924 and 2026', () => {
  for (const n of [1, 12, 25, 39]) {
    const { links } = C.generateLevel(n);
    for (let i = 1; i < links.length; i++) assert.notEqual(links[i].dir, links[i - 1].dir, `level ${n} link ${i}`);
  }
});

test('the exit is unreachable before the causal chain is done', () => {
  for (const n of [1, 15, 36]) {
    const L = C.generateLevel(n);
    for (const [room, start] of [[L.past, L.past.start], [L.future, L.future.start]]) {
      const p = C.astar(room, start.x, start.y, (x, y) => x === room.exit.x && y === room.exit.y, room.exit.x, room.exit.y, () => false);
      assert.equal(p, null, `level ${n} ${room.era} exit reachable with nothing done`);
    }
  }
});

test('both eras are the same building: identical walls and an aged twin on every furnished tile', () => {
  for (const n of [1, 12, 22, 31, 40]) {
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
  for (let n = 7; n <= C.MAX_LEVEL && checked < 14; n++) {
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

test('from chamber 7 every non-breather level has a crate or flood puzzle', () => {
  for (let n = 7; n <= C.MAX_LEVEL; n++) {
    if (C.cyclePos(n) === 10) continue;
    const L = C.generateLevel(n);
    assert.ok(L.links.some(l => l.type === 'CRATE' || l.type === 'FLOW'), `level ${n}: ${L.links.map(l => l.type).join('>')}`);
  }
});
