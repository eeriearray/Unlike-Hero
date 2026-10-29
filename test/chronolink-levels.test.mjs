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

test('there are 25 authored chambers, each a closed rectangle with a start for both eras and an exit', () => {
  assert.equal(C.MAX_LEVEL, 25);
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

// Chambers are long puzzles: every one needs at least 14 moves even when played perfectly (the original
// chambers needed 5-12), not counting the walking in between.
test('every chamber is proven solvable by the solver, and needs at least 14 moves', () => {
  for (let n = 1; n <= C.MAX_LEVEL; n++) {
    const r = C.solve(C.getChamber(n), { maxStates: 400000 });
    assert.ok(r.ok, `chamber ${n} unsolvable (${r.why})`);
    assert.ok(r.depth >= 14, `chamber ${n} solved in ${r.depth} moves`);
  }
});

// The Undercroft is the hard chapter: counting only shoves, topples, pickups, placements, standing and pins
// (walking, reading and unlocking are free), the shortest plans run from 30 to 69 actions. The longest teaching
// chamber needs 31.
test('the Undercroft chambers need 30 to 69 real actions, rising through the chapter', () => {
  const depths = [];
  for (let n = 12; n <= 19; n++) {
    const r = C.solve(C.getChamber(n), { realMoves: true, noPath: true, maxStates: 400000 });
    assert.ok(r.ok, `chamber ${n}: ${r.why}`);
    depths.push(r.depth);
  }
  assert.ok(depths.every(d => d >= 30), `depths ${depths}`);
  assert.ok(depths.every((d, i) => i === 0 || d >= depths[i - 1]), `the chapter ramps: ${depths}`);
  assert.ok(depths[7] >= 65 && depths[7] > depths[6], `the last chamber is the longest: ${depths}`);
});

test('the teaching chapter ends with more kinds of moves than it opens with', () => {
  const kinds = n => new Set(C.solve(C.getChamber(n), { maxStates: 400000 }).path.map(p => p.split(' ').slice(0, 2).join(' '))).size;
  const early = [1, 2, 3].map(kinds), late = [10, 11].map(kinds);
  assert.ok(Math.max(...early) < Math.max(...late), `early ${early} vs late ${late}`);
});

// Campaign necessity checks use the reduced move graph. Small unpruned fixtures in
// chronolink-aging.test.mjs separately validate the new rules and interactions.
test('each chamber that teaches a mechanic cannot be solved without it', () => {
  let checked = 0;
  for (let n = 1; n <= C.MAX_LEVEL; n++) {
    const L = C.getChamber(n);
    for (const need of L.needs) {
      const o = { noPath: true, maxStates: 800000 };
      if (need === 'stand') o.noStand = true;
      else if (need === 'preserve') { o.noStand = true; o.pins = 0; }
      else if (need === 'capillary') o.noCapillary = true;
      else if (need === 'sediment') o.noSediment = true;
      else if (need === 'support') o.noSupports = true;
      else if (need === 'box') o.noBox = true;
      else if (need === 'topple') o.noTopple = true;
      else if (need === 'pin') o.pins = L.pinsMax - 1;
      const r = C.solve(L, o);
      assert.ok(!r.ok && r.why === 'exhausted', `chamber ${n} is solvable without ${need} (${r.ok ? 'depth ' + r.depth : r.why})`);
      checked++;
    }
  }
  assert.ok(checked >= 15, `${checked} mechanic proofs`);
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

test('the Echo topples old crates into chasms, and 1924 can no longer move a crate the Echo has toppled', () => {
  const L = room(['########', '#..~...#', '#......#', '########'], { objs: [{ k: 'crate', x: 2, y: 1 }, { k: 'crate', x: 5, y: 2 }] });
  const s0 = C.initState(L), fut0 = C.deriveFuture(L, s0), i = L.W + 2;
  assert.equal(fut0[i].o, 'oldcrate');
  const toppled = C.echoTopple(L, s0, fut0, i, 1, 0);
  assert.equal(toppled.kind, 'topple');
  const fut1 = C.deriveFuture(L, toppled.s);
  assert.equal(fut1[L.W + 3].o, 'pit', 'the crate lands in the chasm as a pit');
  assert.ok(C.walkRec(fut1[L.W + 3]) && C.walkRec(fut1[i]), 'the Echo can walk over the pit and the tile it left');
  assert.equal(C.actShove(L, toppled.s, 2, 1, 0, 1).why, 'moved', 'the Anchor cannot move the same crate in 1924');
  assert.equal(C.actShove(L, toppled.s, 5, 2, -1, 0).paradox, undefined, 'other crates still move');
  assert.equal(C.canPlace(L, toppled.s, 'plank', 3, 1), false, 'nothing can be put where the Echo fixed the record');
  const j = 2 * L.W + 5;
  assert.equal(C.echoTopple(L, s0, fut0, j, -1, 0), null, 'a crate on open floor is too heavy to slide');
  assert.equal(C.echoTopple(L, s0, fut0, j, 0, 1), null, 'walls stop it');
  assert.equal(C.echoTopple(L, s0, fut0, L.W + 3, 1, 0), null, 'only an old crate can be toppled');
  assert.ok(C.deriveFuture(L, C.actShove(L, toppled.s, 5, 2, -1, 0))[L.W + 3].o === 'pit', 'later 1924 changes leave the toppled crate where it fell');
});

test('no chamber can be finished before anything is done', () => {
  for (let n = 1; n <= C.MAX_LEVEL; n++) {
    const L = C.getChamber(n), s = C.initState(L), X = L.exit.y * L.W + L.exit.x;
    const fut = C.deriveFuture(L, s);
    const re = C.regionOf(L, L.startE, (x, y) => C.walkFuture(fut, L, x, y));
    assert.ok(!re.seen[X], `chamber ${n}: the Echo can walk straight out`);
  }
});

// Random play: wander away from each chamber's start with legal moves, then ask the hint solver for a way out.
// From every state it must either find a plan (so the hint is real) or prove the timeline is a dead end, which
// rewinding (hold R) always gets out of because the start is solvable. It must never give up for lack of time.
function randomState(L, rnd, steps) {
  let s = C.initState(L), a = { ...L.startA }, e = { ...L.startE }, stand = null;
  const W = L.W, N = W * L.H;
  for (let k = 0; k < steps; k++) {
    const flow = C.flowing(L, s), fut = C.deriveFuture(L, s, stand);
    const ra = C.regionOf(L, a, (x, y) => C.walkPast(L, s, x, y, flow)), re = C.regionOf(L, e, (x, y) => C.walkFuture(fut, L, x, y));
    const near = (seen, i) => [1, -1, W, -W].some(d => i + d >= 0 && i + d < N && seen[i + d]);
    const opts = [];
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0;
      if (near(ra.seen, i)) {
        const from = ra.cells.find(c => Math.abs(c % W - x) + Math.abs(((c / W) | 0) - y) === 1);
        const act = s.held ? C.actDrop(L, s, x, y) : C.actPick(L, s, x, y);
        if (act && act.paradox == null) opts.push(() => { s = act; a = { x: from % W, y: (from / W) | 0 }; });
        const wi = C.wheelAt(L, x, y); if (wi >= 0) opts.push(() => { s = C.actWheel(L, s, wi); });
      }
      if (re.seen[i]) opts.push(() => { e = { x, y }; stand = { i, rec: fut[i] }; });
      if (near(re.seen, i)) { const ea = C.echoAct(L, s, fut, i); if (ea && ea.s.paradox == null) opts.push(() => { s = ea.s; }); }
    }
    for (const o of s.objs) if (o.k === 'crate') for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!ra.seen[(o.y - dy) * W + o.x - dx]) continue;
      const n = C.actShove(L, s, o.x, o.y, dx, dy); if (n && !(stand && C.crushes(L, s, n, stand.i))) opts.push(() => { s = n; a = { x: o.x - dx + dx, y: o.y - dy + dy }; });
    }
    if (!opts.length) break;
    opts[Math.floor(rnd() * opts.length)]();
  }
  return { s, a, e, stand };
}
test('from random mid-chamber states the hint solver always finds the way out or proves a dead end', () => {
  let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let solved = 0, dead = 0, deepSolved = 0, deepDead = 0;
  for (let n = 1; n <= C.MAX_LEVEL; n++) {
    const L = C.getChamber(n);
    for (let k = 0; k < 4; k++) {
      const start = randomState(L, rnd, 2 + k * 3);
      const r = C.solve(L, { start, noPath: true, maxStates: 400000 });
      assert.ok(r.ok || r.why === 'exhausted', `chamber ${n} random state ${k}: solver gave up (${r.why})`);
      // The Undercroft (12-19) is meant to be full of traps; the rest of the campaign is forgiving.
      if (n >= 12 && n <= 19) { if (r.ok) deepSolved++; else deepDead++; }
      else if (r.ok) solved++; else dead++;
    }
  }
  assert.ok(solved > dead * 3, `${solved} solvable vs ${dead} dead-end states`);
  // A few aimless moves in the Undercroft often ruin the chamber; elsewhere they almost never do.
  const deepRate = deepDead / (deepSolved + deepDead), rate = dead / (solved + dead);
  assert.ok(deepRate >= 1 / 3 && deepRate >= rate * 10, `Undercroft dead ends ${deepDead}/${deepSolved + deepDead}, elsewhere ${dead}/${solved + dead}`);
});
