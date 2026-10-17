// Physics tests for Putt Club (games/putt-club/engine/physics.js, Rapier rigid bodies).  Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../games/putt-club/engine/physics.js');
const Courses = require('../games/putt-club/engine/courses.js');
const HOLES = Courses.COURSES.flatMap((c) => c.holes);
const hole = (id) => HOLES.find((h) => h.id === id);
await P.init();

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

/** A fresh Rapier world for a hole with one ball at (x, z). */
function setup(id, x, z, opts) {
  const w = P.compileHole(typeof id === 'string' ? hole(id) : id, opts);
  const sim = P.createSim(w);
  const b = P.addBall(sim, 'a', x == null ? w.tee[0] : x, z == null ? w.tee[1] : z);
  return { w, sim, b };
}
function run(sim, seconds, t0 = 0, ev) {
  let t = 0; const results = [];
  while (t < seconds - 1e-9) { results.push(...P.stepSim(sim, t0 + t, 1 / 60, { onEvent: ev })); t += 1 / 60; }
  return results;
}
/** Roll one shot to rest; returns the result and the ball. */
function roll(id, angleDeg, power, opts = {}) {
  const { w, sim, b } = setup(id, opts.x, opts.z);
  if (opts.prep) opts.prep(b);
  const th = angleDeg * Math.PI / 180;
  P.shoot(b, Math.sin(th), -Math.cos(th), opts.speed || P.shotSpeed(power));
  let t = 0, result = null; const events = [];
  while (t < (opts.limit || 40) && !result) {
    const r = P.stepSim(sim, (opts.t0 || 0) + t, 1 / 60, { onEvent: (e) => events.push(e) });
    t += 1 / 60; if (r.length) result = r[0].result;
  }
  const out = { result, b: { ...b, body: null, col: null }, t, events, w };
  P.freeSim(sim);
  return out;
}

test('every ball comes to rest: random shots on every hole settle, hole out, or hit a hazard', () => {
  const rng = seeded(7);
  for (const h of HOLES) {
    for (let i = 0; i < 6; i++) {
      const r = roll(h.id, rng() * 360, 0.1 + rng() * 0.9, { t0: rng() * 10 });
      assert.ok(r.result, `${h.id}: ball still moving after ${r.t.toFixed(1)}s`);
      assert.ok(r.t <= P.C.MAX_SHOT_TIME + 1, `${h.id}: shot took ${r.t.toFixed(1)}s`);
      for (const k of ['x', 'y', 'z']) assert.ok(Number.isFinite(r.b[k]), `${h.id}: ${k} is ${r.b[k]}`);
    }
  }
});

test('same shot, same conditions, same result (determinism)', () => {
  for (const id of ['cove-2', 'garden-6', 'neon-6']) {
    const a = roll(id, 17, 0.83, { t0: 1.25 }), b = roll(id, 17, 0.83, { t0: 1.25 });
    assert.equal(a.result, b.result);
    assert.equal(a.b.x, b.b.x); assert.equal(a.b.z, b.b.z);
  }
});

test('no tunnelling: a ball fired at the hard speed limit into rails stays inside (Rapier CCD)', () => {
  for (const angle of [90, 270, 45, 135, 200, 0, 180]) {
    const r = roll('cove-1', angle, 0, { x: 0, z: 4, speed: P.C.MAX_SPEED * 2 });
    assert.notEqual(r.result, 'water', `angle ${angle}: ball escaped the rails`);
    assert.ok(Math.abs(r.b.x) <= 1.6, `angle ${angle}: x=${r.b.x}`);
  }
});

test('the cup catches a slow ball and lets a fast one lip out', () => {
  const slow = roll('cove-1', 0, 0, { x: 0, z: -4.6, speed: 3.6 });
  assert.equal(slow.result, 'cup');
  const fast = roll('cove-1', 0, 0, { x: 0, z: -5.2, speed: 14, limit: 0.4 });
  assert.notEqual(fast.result, 'cup', 'a 14 u/s ball should not drop');
  assert.ok(fast.events.some((e) => e.type === 'lip'));
});

test('sand grabs the ball, metal lets it run', () => {
  const mk = (mat) => ({ id: 's' + mat, par: 2, tee: [0, 4], cup: [0, -40], floors: [{ rect: [-2, -50, 2, 6], h: 0, mat }] });
  const a = roll(mk('sand'), 0, 0.6), b = roll(mk('metal'), 0, 0.6);
  assert.ok(4 - a.b.z < (4 - b.b.z) / 3, `sand ${4 - a.b.z} vs metal ${4 - b.b.z}`);
});

test('slopes: a weak putt rolls back down, a firm one climbs the ramp and jumps the channel', () => {
  const weak = roll('cove-4', 0, 0.25, { x: 0, z: 8.4 });
  assert.equal(weak.result, 'stop');
  assert.ok(weak.b.z > 5.9, `weak putt should end below the ramp, got z=${weak.b.z}`);
  const firm = roll('cove-4', 0, 0.85, { x: 0, z: 8.4 });
  assert.notEqual(firm.result, 'water');
  assert.ok(firm.b.z < -3, `firm putt should clear the channel, got z=${firm.b.z}`);
});

test('water sends the ball back as a hazard, falling off the world is out of bounds', () => {
  assert.equal(roll('cove-3', 0, 0.6, { x: 0, z: 7.4 }).result, 'water');
  assert.equal(roll('neon-2', 90, 0.4, { x: 2.3, z: 1.5 }).result, 'oob'); // off the catwalk into the void
});

test('launch pads throw the ball across the gap', () => {
  const r = roll('neon-2', 0, 0.5, { x: 0, z: 8.6 });
  assert.ok(r.events.some((e) => e.type === 'pad'));
  assert.ok(r.events.some((e) => e.type === 'land' && e.z < -1), 'lands on the far deck');
});

test('giant and tiny balls change the collider radius smoothly and never stay inside a rail', () => {
  const { sim, b } = setup('cove-1', 1.6 - P.C.R - 0.13, 5);
  b.rTarget = P.C.R * 1.65;
  run(sim, 2);
  assert.ok(Math.abs(b.r - P.C.R * 1.65) < 1e-9);
  assert.ok(Math.abs(b.col.radius() - b.r) < 1e-6);
  assert.ok(b.x + b.r <= 1.6 - 0.12 + 0.03, `giant ball overlaps the rail: x=${b.x} r=${b.r}`);
  P.freeSim(sim);
});

test('ghost balls pass soft obstacles but not outer rails', () => {
  const normal = roll('garden-3', 0, 0.35, { x: -4, z: 4 });
  assert.ok(normal.b.z > 2, 'a normal ball bounces off the hedge');
  const ghost = roll('garden-3', 0, 0.35, { x: -4, z: 4, prep: (b) => { b.ghost = true; } });
  assert.ok(ghost.b.z < 2, 'a ghost ball goes through the hedge');
  assert.notEqual(roll('garden-3', 90, 1, { x: 0, z: 0, prep: (b) => { b.ghost = true; } }).result, 'oob', 'ghost still bounces off the outer rails');
});

test('frozen balls do not move and resume with their velocity afterwards', () => {
  const { sim, b } = setup('cove-1', 0, 6);
  P.shoot(b, 0, -1, 8);
  run(sim, 1 / 60);
  b.frozen = true;
  run(sim, 1 / 60);
  const z = b.z;
  run(sim, 2);
  assert.ok(Math.abs(b.z - z) < 1e-6);
  b.frozen = false;
  run(sim, 0.1);
  assert.ok(b.z < z - 0.3, 'carried on rolling');
  P.freeSim(sim);
});

test('ball-to-ball collisions transfer momentum; tee balls (solo) do not collide', () => {
  const { sim, b: a } = setup('cove-1', 0, 6);
  const b = P.addBall(sim, 'b', 0, 4);
  P.shoot(a, 0, -1, 6);
  run(sim, 1);
  assert.ok(b.z < 4 - 0.5, 'b was knocked forward');
  P.freeSim(sim);
  const s2 = setup('cove-1', 0, 6), d = P.addBall(s2.sim, 'd', 0, 4);
  d.solo = true;
  P.shoot(s2.b, 0, -1, 6);
  run(s2.sim, 1);
  assert.ok(Math.abs(d.z - 4) < 1e-3, `solo ball moved to ${d.z}`);
  P.freeSim(s2.sim);
});

test('a resting ball rides the ferry platform, and kinematic spinners shove resting balls', () => {
  const { sim, b } = setup('garden-4', 0, 3.6);
  run(sim, 4.2);
  assert.ok(b.z < -1, `the platform should have carried the ball across, z=${b.z}`);
  P.freeSim(sim);
  const s2 = setup('garden-1', 0.9, 0.3);
  run(s2.sim, 3);
  assert.ok(Math.hypot(s2.b.x - 0.9, s2.b.z - 0.3) > 0.3, 'the turning bar pushed the ball');
  P.freeSim(s2.sim);
});

test('trajectory preview matches the authoritative simulation', () => {
  const w = P.compileHole(hole('cove-2'));
  const f = P.floorAt(w, w.tee[0], w.tee[1], 50, 0);
  const pred = P.predict(w, { x: w.tee[0], y: f.h, z: w.tee[1], r: P.C.R }, 0.2, -1, 12, 0, { maxT: 30 });
  const real = roll('cove-2', Math.atan2(0.2, 1) * 180 / Math.PI, 0, { speed: 12 });
  assert.equal(pred.result, real.result);
  assert.ok(Math.hypot(pred.ball.x - real.b.x, pred.ball.z - real.b.z) < 0.05, `preview ended ${Math.hypot(pred.ball.x - real.b.x, pred.ball.z - real.b.z).toFixed(3)} away`);
});
