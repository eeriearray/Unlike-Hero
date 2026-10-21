// Dragon Clash fighting mechanics: frame data, guard, parry, guard break, throws and throw breaks, cancel windows,
// input priority, combo scaling, the anti-infinite burst, counter hits, knockdown and wake-up, walls, meter, EX
// and the super, and the arenas.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { D, Build, Sim, Bot, B, plain, duel, press, hits } from './dragon-clash-helpers.mjs';

const idle = (sim) => sim.fighters.map(() => ({ held: 0, pressed: 0 }));
function run(sim, n, per = {}) {
  const ev = [];
  for (let k = 0; k < n; k++) {
    const inp = idle(sim);
    for (const i in per) inp[i] = typeof per[i] === 'function' ? per[i](k) : per[i];
    sim.step(inp); ev.push(...sim.drainEvents());
  }
  return ev;
}
const fire = () => plain('fire');

test('every move has frame data, and heavies are less safe on block than lights', () => {
  for (const [id, m] of Object.entries(D.MOVES)) {
    if (m.kind === 'throw') continue;
    const fd = D.frameData(m);
    assert.ok(fd.startup > 0 && fd.active > 0 && fd.recovery > 0, id + ' has startup, active and recovery');
  }
  assert.ok(D.frameData(D.MOVES.fsmash).onBlock < D.frameData(D.MOVES.jab).onBlock);
  assert.equal(D.frameData(D.MOVES.grab).onBlock, null);
});

test('a guard blocks a hit from the front: no damage, blockstun, guard bar drops', () => {
  const { sim, A, T } = duel(fire(), fire());
  run(sim, 30, { 1: { held: B.guard, pressed: 0 } });   // guard long before the hit: no parry
  assert.equal(T.state, 'guard');
  const ev = run(sim, 20, { 0: (k) => ({ held: 0, pressed: k === 0 ? B.light : 0 }), 1: { held: B.guard, pressed: 0 } });
  assert.equal(hits(ev).length, 0);
  assert.ok(ev.some((e) => e.type === 'block'));
  assert.equal(T.dmg, 0);
  assert.ok(T.guardHp < D.PHYSICS.guardMax);
});

test('a guard does not stop a hit from behind', () => {
  const { sim, A, T } = duel(fire(), fire());
  T.facing = 1;   // looking away from A
  run(sim, 30, { 1: { held: B.guard | B.right, pressed: 0 } });
  T.facing = 1;
  const ev = run(sim, 20, { 0: (k) => ({ held: 0, pressed: k === 0 ? B.light : 0 }), 1: { held: B.guard, pressed: 0 } });
  assert.equal(hits(ev).length, 1);
});

test('a guard pressed just before the hit parries: no damage, the attacker staggers', () => {
  const { sim, A, T } = duel(fire(), fire());
  const jab = D.MOVES.jab;
  // A jabs; T presses guard so the hit lands 2 ticks after the press
  const ev = run(sim, 30, { 0: (k) => ({ held: 0, pressed: k === 0 ? B.light : 0 }), 1: (k) => ({ held: k >= jab.startup - 2 ? B.guard : 0, pressed: 0 }) });
  assert.ok(ev.some((e) => e.type === 'parry'), 'parried');
  assert.equal(T.dmg, 0);
  assert.ok(ev.some((e) => e.type === 'attack' && e.f === 0) && !hits(ev).length);
  assert.equal(A.state, 'stagger', 'the parried attacker is left open');
});

test('mashing guard never parries', () => {
  const { sim, T } = duel(fire(), fire());
  const jab = D.MOVES.jab;
  // Guard pressed, released, pressed again right before the hit (inside the lockout): blocked, not parried
  const ev = run(sim, 30, {
    0: (k) => ({ held: 0, pressed: k === 4 ? B.light : 0 }),
    1: (k) => ({ held: (k === 0 || k >= jab.startup + 4 - 2) ? B.guard : 0, pressed: 0 }),
  });
  assert.ok(!ev.some((e) => e.type === 'parry'));
  assert.ok(ev.some((e) => e.type === 'block'));
});

test('enough blocked hits break the guard and leave the dragon dizzy', () => {
  const { sim, A, T } = duel(fire(), fire());
  run(sim, 30, { 1: { held: B.guard, pressed: 0 } });
  let broke = false;
  for (let n = 0; n < 12 && !broke; n++) {
    T.x = A.x + 60; A.facing = 1;
    const ev = run(sim, 50, { 0: (k) => ({ held: 0, pressed: k === 0 ? B.heavy : 0 }), 1: { held: B.guard, pressed: 0 } });
    broke = ev.some((e) => e.type === 'guardBreak');
  }
  assert.ok(broke, 'guard broke');
});

test('a grab beats a guard and throws after the hold; an early press breaks it', () => {
  let { sim, A, T } = duel(fire(), fire(), { gap: 50 });
  run(sim, 20, { 1: { held: B.guard, pressed: 0 } });
  let ev = run(sim, 60, { 0: (k) => ({ held: B.guard, pressed: k === 0 ? B.light : 0 }), 1: { held: B.guard, pressed: 0 } });
  assert.ok(ev.some((e) => e.type === 'grab'), 'grabbed through the guard');
  assert.ok(ev.some((e) => e.type === 'throw'), 'thrown');
  assert.ok(T.dmg > 0);
  ({ sim, A, T } = duel(fire(), fire(), { gap: 50 }));
  ev = run(sim, 60, { 0: (k) => ({ held: B.guard, pressed: k === 0 ? B.light : 0 }), 1: (k) => ({ held: 0, pressed: k === D.MOVES.grab.startup + 3 ? B.light : 0 }) });
  assert.ok(ev.some((e) => e.type === 'grab'));
  assert.ok(ev.some((e) => e.type === 'throwBreak'), 'broken');
  assert.ok(!ev.some((e) => e.type === 'throw'));
  assert.equal(T.dmg, 0);
});

test('a light attack that hits can cancel into a heavy; one that whiffs cannot', () => {
  let { sim, A } = duel(fire(), fire(), { gap: 60 });
  const jab = D.MOVES.jab;
  let ev = run(sim, 60, { 0: (k) => ({ held: 0, pressed: k === 0 ? B.light : k === jab.startup + 1 ? B.heavy : 0 }) });
  assert.ok(ev.some((e) => e.type === 'cancel' && e.into === 'fsmash'), 'cancelled on hit');
  ({ sim, A } = duel(fire(), fire(), { gap: 400 }));
  ev = run(sim, 60, { 0: (k) => ({ held: 0, pressed: k === 0 ? B.light : k === jab.startup + 1 ? B.heavy : 0 }) });
  assert.ok(!ev.some((e) => e.type === 'cancel'), 'no cancel on whiff');
});

test('simultaneous presses resolve by input priority', () => {
  let { sim, A } = duel(fire(), fire(), { gap: 300 });
  run(sim, 1, { 0: { held: 0, pressed: B.light | B.heavy } });
  assert.equal(A.move, 'jab');
  ({ sim, A } = duel(fire(), fire(), { gap: 300 }));
  run(sim, 1, { 0: { held: B.guard, pressed: B.light | B.sig } });
  assert.equal(A.move, 'grab', 'Guard commands come before plain buttons');
  ({ sim, A } = duel(fire(), fire(), { gap: 300 }));
  run(sim, 1, { 0: { held: B.guard, pressed: B.light } });
  assert.equal(A.move, 'grab');
});

test('combo scaling: later attacks in a combo deal less damage', () => {
  const { sim, A, T } = duel(fire(), fire(), { gap: 60 });
  const ev = [];
  for (let n = 0; n < 5; n++) {
    T.x = A.x + 60; T.y = A.y; A.facing = 1;
    ev.push(...run(sim, 9, { 0: (k) => ({ held: 0, pressed: k === 0 ? B.light : 0 }) }));
    A.move = null; A.state = 'idle'; A.hitlag = 0;   // let A act again while T is still in the combo
    T.hitstun = 40;
  }
  const hs = hits(ev);
  assert.ok(hs.length >= 4);
  assert.ok(hs[3].dmg < hs[0].dmg, 'fourth hit ' + hs[3].dmg + ' < first ' + hs[0].dmg);
  assert.ok(hs.every((h, i) => i === 0 || h.combo >= hs[i - 1].combo));
});

test('anti-infinite: a combo that reaches the step limit bursts the victim free', () => {
  const { sim, A, T } = duel(fire(), fire(), { gap: 60 });
  let burst = false;
  for (let n = 0; n < D.COMBO.maxSteps + 3 && !burst; n++) {
    T.x = A.x + 60; T.y = A.y; T.grounded = true; T.plat = 0; A.facing = 1; T.invuln = 0;
    const ev = run(sim, 9, { 0: (k) => ({ held: 0, pressed: k === 0 ? B.light : 0 }) });
    A.move = null; A.state = 'idle'; A.hitlag = 0; T.hitstun = 40; T.hitlag = 0;
    burst = ev.some((e) => e.type === 'burst');
  }
  assert.ok(burst);
  assert.ok(T.invuln > 0);
});

test('hitting an attack in its startup is a counter hit with extra hitstun', () => {
  const a = duel(fire(), fire(), { gap: 60 });
  // T starts a slow heavy; A jabs into its startup
  let ev = run(a.sim, 20, { 1: (k) => ({ held: 0, pressed: k === 0 ? B.heavy : 0 }), 0: (k) => ({ held: 0, pressed: k === 1 ? B.light : 0 }) });
  const h = hits(ev).find((e) => e.target === 1);
  assert.ok(h && h.counter, 'counter hit');
  const b = duel(fire(), fire(), { gap: 60 });
  ev = run(b.sim, 20, { 0: (k) => ({ held: 0, pressed: k === 1 ? B.light : 0 }) });
  const h2 = hits(ev).find((e) => e.target === 1);
  assert.ok(h.dmg > h2.dmg && !h2.counter);
});

test('an untechable tumble landing knocks the dragon down; it is invulnerable and can roll away', () => {
  const { sim, T } = duel(fire(), fire());
  T.state = 'hitstun'; T.hitstun = 60; T.tumble = true; T.grounded = false; T.plat = -1; T.y -= 200; T.vy = 10;
  let ev = run(sim, 40);
  assert.ok(ev.some((e) => e.type === 'knockdown'));
  assert.equal(T.state, 'down');
  assert.equal(sim.hittable(T), false);
  const x0 = T.x;
  ev = run(sim, 40, { 1: { held: B.right, pressed: 0 } });
  assert.ok(ev.some((e) => e.type === 'getup' && e.how === 'roll'));
  assert.ok(T.x > x0 + 40, 'rolled ' + (T.x - x0));
});

test('teching the landing avoids the knockdown', () => {
  const { sim, T } = duel(fire(), fire());
  T.state = 'hitstun'; T.hitstun = 60; T.tumble = true; T.grounded = false; T.plat = -1; T.y -= 120; T.vy = 10;
  const ev = run(sim, 30, { 1: (k) => ({ held: 0, pressed: k === 6 ? B.dodge : 0 }) });
  assert.ok(ev.some((e) => e.type === 'tech'));
  assert.ok(!ev.some((e) => e.type === 'knockdown'));
});

test('Dragon Colosseum: a hard launch into a wall splats once per combo, and the walls stop launches', () => {
  const sim = new Sim({ arena: 'colosseum', seed: 2, fighters: [{ build: fire(), team: 0 }, { build: fire(), team: 1 }] });
  const T = sim.fighters[1], wall = D.ARENAS.colosseum.platforms[2];
  T.x = wall.x - 100; T.y = 600; T.grounded = false; T.plat = -1; T.state = 'hitstun'; T.hitstun = 40; T.kbx = 22; T.kby = -2;
  const ev = run(sim, 10);
  assert.ok(ev.some((e) => e.type === 'wallsplat'));
  assert.ok(T.x <= wall.x, 'did not pass through the wall');
  T.state = 'hitstun'; T.hitstun = 40; T.kbx = 22; T.x = wall.x - 100;
  const ev2 = run(sim, 10);
  assert.ok(!ev2.some((e) => e.type === 'wallsplat'), 'no second splat in the same combo');
});

test('wall jump: jump while touching a wall kicks off it without spending an air jump', () => {
  const sim = new Sim({ arena: 'colosseum', seed: 2, fighters: [{ build: fire(), team: 0 }, { build: fire(), team: 1 }] });
  const A = sim.fighters[0], wall = D.ARENAS.colosseum.platforms[1];
  A.x = wall.x + wall.w + A.stats.hurt.w / 2 + 1; A.y = 500; A.grounded = false; A.plat = -1; A.state = 'air'; A.vx = -3; A.stateT = 10;
  run(sim, 2, { 0: { held: B.left, pressed: 0 } });
  const aj = A.airJumps;
  const ev = run(sim, 2, { 0: (k) => ({ held: B.left, pressed: k === 0 ? B.jump : 0 }) });
  assert.ok(ev.some((e) => e.type === 'walljump'));
  assert.equal(A.airJumps, aj);
  assert.ok(A.vx > 0);
});

test('meter: hits build it, EX costs one bar, the super freezes the world and costs all of it', () => {
  const { sim, A, T } = duel(fire(), fire(), { gap: 300 });
  A.meter = 100;
  run(sim, 1, { 0: { held: B.guard, pressed: B.sig } });
  assert.equal(A.move, 'sig'); assert.equal(A.moveEx, true); assert.equal(A.meter, 0);
  assert.ok(A.moveDef.startup < D.SIGNATURES.fireball.startup);
  const s2 = duel(fire(), fire(), { gap: 120 });
  s2.A.meter = D.PHYSICS.meterMax;
  const ev = run(s2.sim, 1, { 0: { held: B.guard, pressed: B.heavy } });
  assert.ok(ev.some((e) => e.type === 'super'));
  const x = s2.T.x, t0 = s2.T.stateT;
  run(s2.sim, 10, { 1: { held: B.left, pressed: 0 } });
  assert.equal(s2.T.x, x, 'frozen during the cinematic'); assert.equal(s2.T.stateT, t0);
  const ev2 = run(s2.sim, 80);
  assert.ok(hits(ev2).some((h) => h.kind === 'super'), 'the super connects');
  assert.equal(s2.A.meter < 50, true);
  const s3 = duel(fire(), fire(), { gap: 60 });
  run(s3.sim, 20, { 0: (k) => ({ held: 0, pressed: k === 0 ? B.light : 0 }) });
  assert.ok(s3.A.meter > 0 && s3.T.meter > 0);
});

test('every arena is playable: main floor first, spawns on platforms, CPUs finish a match', () => {
  for (const id of D.ARENA_ORDER) {
    const a = D.ARENAS[id];
    assert.ok(a, id);
    assert.ok(a.platforms[0].solid && !a.platforms[0].wall, id + ' main floor first');
    for (const sp of a.spawns) assert.ok(a.platforms.some((p) => Math.abs(p.y - sp[1]) < 1 && sp[0] >= p.x && sp[0] <= p.x + p.w), id + ' spawn on a platform');
    const sim = new Sim({ arena: id, stocks: 1, timeLimit: 60 * 60 * 2, seed: 9, fighters: [0, 1, 2, 3].map((i) => ({ build: Build.presetBuild(D.PRESETS[i].id), team: i % 2 })) });
    const bots = sim.fighters.map((f, i) => new Bot(sim, i, { level: 3, seed: i + 1 }));
    let n = 0;
    while (!sim.result && n++ < 60 * 60 * 2 + 10) sim.step(bots.map((b) => b.think()));
    assert.ok(sim.result, id + ' finished');
  }
  assert.equal(Object.keys(D.ARENAS).filter((k) => k !== 'training').length, D.ARENA_ORDER.length);
});
