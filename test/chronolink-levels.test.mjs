// ChronoLink's core (chambers, aging rules, solver) lives in a <script id="chrono-core"> block with no DOM,
// so it runs here in a VM.
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

// A tiny chamber built from a map, for testing one rule at a time.
const room = (map, extra) => C.parseChamber(Object.assign({ name: 'test', card: '', map }, extra || {}), 0);
const at = (L, recs, x, y) => recs[y * L.W + x];

test('there are 14 hand-built chambers, each a closed rectangle with a start for both eras and an exit', () => {
  assert.equal(C.MAX_LEVEL, 14);
  for (let n = 1; n <= C.MAX_LEVEL; n++) {
    const L = C.getChamber(n);
    assert.ok(L.name && L.card, `chamber ${n} has a name and a one-line card`);
    assert.ok(L.card.length <= 80, `chamber ${n} card is short`);
    assert.ok(L.startA && L.startE && L.exit, `chamber ${n} has starts and an exit`);
    for (let x = 0; x < L.W; x++) for (const y of [0, L.H - 1]) assert.ok('#Wc'.includes(L.base[y * L.W + x]), `chamber ${n} perimeter at ${x},${y}`);
    for (let y = 0; y < L.H; y++) for (const x of [0, L.W - 1]) assert.ok('#Wc'.includes(L.base[y * L.W + x]), `chamber ${n} perimeter at ${x},${y}`);
  }
  assert.equal(C.getChamber(99).n, C.MAX_LEVEL, 'chamber numbers clamp to the campaign');
});

test('every chamber is proven solvable by the solver, and needs at least two moves', () => {
  for (let n = 1; n <= C.MAX_LEVEL; n++) {
    const r = C.solve(C.getChamber(n));
    assert.ok(r.ok, `chamber ${n} unsolvable (${r.why})`);
    assert.ok(r.depth >= 2, `chamber ${n} solved in ${r.depth} moves`);
  }
});

test('the back half asks for longer plans than the opening chambers', () => {
  const depth = n => C.solve(C.getChamber(n), { noPath: true }).depth;
  const early = [1, 2, 3, 4].map(depth), late = [9, 12, 14].map(depth);
  assert.ok(Math.max(...early) <= Math.min(...late), `early ${early} vs late ${late}`);
});

// The solver searches every move when proving a mechanic is required. Chamber 14 is too large for that in a
// test run, so its proofs use the same pruned move set as the positive search (planks and acorns are only set
// down where they can bridge, grow or be sealed).
test('each chamber that teaches a mechanic cannot be solved without it', () => {
  let checked = 0;
  for (let n = 1; n <= C.MAX_LEVEL; n++) {
    const L = C.getChamber(n);
    for (const need of L.needs) {
      const o = { noPath: true, prune: n === 14, maxStates: 800000 };
      if (need === 'stand') o.noStand = true;
      else if (need === 'box') o.noBox = true;
      else if (need === 'pin') o.pins = L.pinsMax - 1;
      const r = C.solve(L, o);
      assert.ok(!r.ok && r.why === 'exhausted', `chamber ${n} is solvable without ${need} (${r.ok ? 'depth ' + r.depth : r.why})`);
      checked++;
    }
  }
  assert.ok(checked >= 8, `${checked} mechanic proofs`);
});

test('dry wood bridges a chasm; wet wood rots; a crate fills a pit', () => {
  const L = room(['#######', '#.~;..#', '#######'], { objs: [{ k: 'plank', x: 2, y: 1 }, { k: 'plank', x: 3, y: 1 }] });
  const recs = C.deriveRaw(L, C.initState(L));
  assert.equal(at(L, recs, 2, 1).o, 'bridge');
  assert.equal(at(L, recs, 3, 1).o, null); assert.equal(at(L, recs, 3, 1).rot, 'plank');
  const L2 = room(['#####', '#.~.#', '#####'], { objs: [{ k: 'crate', x: 2, y: 1 }] });
  assert.equal(at(L2, C.deriveRaw(L2, C.initState(L2)), 2, 1).o, 'pit');
  assert.ok(C.walkRec(at(L2, C.deriveRaw(L2, C.initState(L2)), 2, 1)), 'a filled pit is walkable');
});

test('running water floods channels, rusts bars, erodes plaster, floods basins and rots what sits beside it', () => {
  const L = room(['###W###', '#..=p.#', '#.b=..#', '#..=,.#', '#######'], {
    gates: [{ id: 'a', x: 3, y: 1 }], wheels: [{ x: 1, y: 1, positions: [[], ['a']] }], bars: [{ x: 4, y: 3 }],
    objs: [{ k: 'crate', x: 4, y: 2 }],
  });
  const s0 = C.initState(L), dry = C.deriveRaw(L, s0);
  assert.equal(at(L, dry, 3, 2).t, 'silt'); assert.equal(at(L, dry, 4, 1).t, 'wall'); assert.equal(at(L, dry, 2, 2).t, 'basin');
  assert.equal(at(L, dry, 4, 3).o, 'rustbars', 'bars under a leak rust whatever the wheel does');
  assert.equal(at(L, dry, 4, 2).o, 'oldcrate');
  const wet = C.deriveRaw(L, C.actWheel(L, s0, 0));
  assert.equal(at(L, wet, 3, 2).t, 'deep'); assert.equal(at(L, wet, 4, 1).t, 'hole'); assert.equal(at(L, wet, 2, 2).t, 'flood');
  assert.equal(at(L, wet, 4, 2).o, 'mulch', 'a crate beside running water rots');
  assert.ok(!C.walkPast(L, C.actWheel(L, s0, 0), 3, 2, C.flowing(L, C.actWheel(L, s0, 0))), 'running water blocks the Anchor in 1924');
});

test('an acorn grows only in a dry, sunlit planter, and its trunk leans along the planter direction', () => {
  const map = ['#######', '#.~~~.#', '#.S.s.#', '#######'];
  const L = room(map, { objs: [{ k: 'acorn', x: 2, y: 2 }], planters: [{ x: 2, y: 2, dir: 'N' }] });
  const recs = C.deriveRaw(L, C.initState(L));
  assert.equal(at(L, recs, 2, 2).o, 'tree'); assert.equal(at(L, recs, 2, 1).o, 'roots');
  const dark = room(map, { objs: [{ k: 'acorn', x: 4, y: 2 }] });
  assert.equal(at(dark, C.deriveRaw(dark, C.initState(dark)), 4, 2).o, null, 'a dark planter grows nothing');
  const blocked = room(['#######', '#.S...#', '#######'], { objs: [{ k: 'acorn', x: 2, y: 1 }], planters: [{ x: 2, y: 1, dir: 'E', len: 2 }] });
  const br = C.deriveRaw(blocked, C.initState(blocked));
  assert.equal(at(blocked, br, 3, 1).o, 'trunk'); assert.equal(at(blocked, br, 4, 1).o, 'trunk'); assert.equal(at(blocked, br, 5, 1).o, null);
});

test('the Stash Box keeps out the century, and the Echo can carry what comes out', () => {
  const L = room(['#######', '#..;..#', '#######'], { objs: [{ k: 'plank', x: 1, y: 1 }], boxes: [{ x: 2, y: 1 }] });
  let s = C.actDrop(L, C.actPick(L, C.initState(L), 1, 1), 2, 1);
  const fut = C.deriveFuture(L, s);
  assert.equal(at(L, fut, 2, 1).item, 'plank');
  const opened = C.echoAct(L, s, fut, L.W + 2);
  assert.equal(opened.kind, 'open'); s = opened.s; assert.equal(s.echo.carry, 'plank');
  const laid = C.echoAct(L, s, C.deriveFuture(L, s), L.W + 3);
  assert.equal(laid.kind, 'lay');
  assert.ok(C.walkRec(at(L, C.deriveFuture(L, laid.s), 3, 1)), 'a plank laid in 2026 bridges even a wet chasm');
  assert.equal(C.actPick(L, laid.s, 2, 1).why, 'taken', 'the Anchor cannot take back what the Echo is holding');
});

test('what the Echo stands on or pins holds still while 1924 changes', () => {
  const L = room(['#######', '#..~..#', '#######'], { objs: [{ k: 'plank', x: 3, y: 1 }], pins: 1 });
  const s0 = C.initState(L), i = L.W + 3, fut0 = C.deriveFuture(L, s0);
  const lifted = C.actPick(L, s0, 3, 1);
  assert.equal(C.deriveFuture(L, lifted)[i].o, null, 'lifting the plank removes the bridge');
  assert.equal(C.deriveFuture(L, lifted, { i, rec: fut0[i] })[i].o, 'bridge', 'unless the Echo is standing on it');
  const pinned = C.echoPin(L, s0, fut0, i).s;
  assert.equal(C.deriveFuture(L, C.actPick(L, pinned, 3, 1))[i].o, 'bridge', 'or has pinned it');
  assert.equal(C.echoPin(L, pinned, fut0, L.W + 2), null, 'pins are limited');
});

test('1924 cannot put something solid where the Echo stands (a paradox)', () => {
  const L = room(['######', '#....#', '######'], { objs: [{ k: 'crate', x: 2, y: 1 }] });
  const s0 = C.initState(L), shoved = C.actShove(L, s0, 2, 1, 1, 0);
  assert.ok(C.crushes(L, s0, shoved, L.W + 3), 'shoving the crate onto the Echo is refused');
  assert.ok(!C.crushes(L, s0, shoved, L.W + 4), 'anywhere else is fine');
});

test('no chamber can be finished before anything is done', () => {
  for (let n = 1; n <= C.MAX_LEVEL; n++) {
    const L = C.getChamber(n), s = C.initState(L), X = L.exit.y * L.W + L.exit.x;
    const fut = C.deriveFuture(L, s);
    const re = C.regionOf(L, L.startE, (x, y) => C.walkFuture(fut, L, x, y));
    assert.ok(!re.seen[X], `chamber ${n}: the Echo can walk straight out`);
  }
});
