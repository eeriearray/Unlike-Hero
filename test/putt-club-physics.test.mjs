// Physics tests for Putt Club (games/putt-club/engine/physics.js).  Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../games/putt-club/engine/physics.js');
const Courses = require('../games/putt-club/engine/courses.js');
const HOLES = Courses.COURSES.flatMap((c) => c.holes);
const hole = (id) => HOLES.find((h) => h.id === id);

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

/** Roll one shot to rest; returns the result and the ball. */
function roll(w, ball, angleDeg, power, t0 = 0, limit = 40) {
  const b = { ...ball };
  const th = angleDeg * Math.PI / 180;
  P.shoot(b, Math.sin(th), -Math.cos(th), P.shotSpeed(power));
  let t = 0, result = null;
  while (t < limit && !result) { const r = P.stepWorld(w, [b], t0 + t, 1 / 60); t += 1 / 60; if (r.length) result = r[0].result; }
  return { result, b, t };
}

test('every ball comes to rest: random shots on every hole settle, hole out, or hit a hazard', () => {
  const rng = seeded(7);
  for (const h of HOLES) {
    const w = P.compileHole(h);
    const ball = P.newBall('a', w.tee[0], w.tee[1], w);
    for (let i = 0; i < 12; i++) {
      const r = roll(w, ball, rng() * 360, 0.1 + rng() * 0.9, rng() * 10);
      assert.ok(r.result, `${h.id}: ball still moving after ${r.t.toFixed(1)}s`);
      assert.ok(r.t <= P.C.MAX_SHOT_TIME + 1, `${h.id}: shot took ${r.t.toFixed(1)}s`);
      for (const k of ['x', 'y', 'z', 'vx', 'vz']) assert.ok(Number.isFinite(r.b[k]), `${h.id}: ${k} is ${r.b[k]}`);
    }
  }
});

test('same shot, same conditions, same result (determinism)', () => {
  for (const id of ['cove-2', 'garden-6', 'neon-6']) {
    const w = P.compileHole(hole(id));
    const ball = P.newBall('a', w.tee[0], w.tee[1], w);
    const a = roll(w, ball, 17, 0.83, 1.25), b = roll(w, ball, 17, 0.83, 1.25);
    assert.equal(a.result, b.result);
    assert.equal(a.b.x, b.b.x); assert.equal(a.b.z, b.b.z);
  }
});

test('no tunnelling: a ball fired at the hard speed limit into rails stays inside', () => {
  const w = P.compileHole(hole('cove-1'));     // fully railed lane over water
  for (const angle of [90, 270, 45, 135, 200, 0, 180]) {
    const b = P.newBall('a', 0, 4, w);
    P.shoot(b, Math.sin(angle * Math.PI / 180), -Math.cos(angle * Math.PI / 180), P.C.MAX_SPEED * 2); // clamped to MAX_SPEED
    let result = null;
    for (let t = 0; t < 30 && !result; t += 1 / 60) { const r = P.stepWorld(w, [b], t, 1 / 60); if (r.length) result = r[0].result; }
    assert.notEqual(result, 'water', `angle ${angle}: ball escaped the rails`);
    assert.ok(Math.abs(b.x) <= 1.6, `angle ${angle}: x=${b.x}`);
  }
});

test('the cup catches a slow ball and lets a fast one lip out', () => {
  const w = P.compileHole(hole('cove-1'));
  const slow = P.newBall('a', 0, -4.6, w); // 2 units short of the cup
  P.shoot(slow, 0, -1, 3.6);
  let res = null;
  for (let t = 0; t < 10 && !res; t += 1 / 60) { const r = P.stepWorld(w, [slow], t, 1 / 60); if (r.length) res = r[0].result; }
  assert.equal(res, 'cup');
  const fast = P.newBall('b', 0, -5.2, w);
  P.shoot(fast, 0, -1, 14);
  const events = [];
  for (let t = 0; t < 0.4; t += 1 / 60) P.stepWorld(w, [fast], t, 1 / 60, { onEvent: (e) => events.push(e.type) });
  assert.ok(!fast.holed, 'a 14 u/s ball should not drop');
  assert.ok(events.includes('lip'));
});

test('sand grabs the ball, ice-smooth metal lets it run', () => {
  const sandW = P.compileHole({ id: 's', par: 2, tee: [0, 4], cup: [0, -40], floors: [{ rect: [-2, -50, 2, 6], h: 0, mat: 'sand' }] });
  const metalW = P.compileHole({ id: 'm', par: 2, tee: [0, 4], cup: [0, -40], floors: [{ rect: [-2, -50, 2, 6], h: 0, mat: 'metal' }] });
  const a = roll(sandW, P.newBall('a', 0, 4, sandW), 0, 0.6);
  const b = roll(metalW, P.newBall('b', 0, 4, metalW), 0, 0.6);
  assert.ok(4 - a.b.z < (4 - b.b.z) / 3, `sand ${4 - a.b.z} vs metal ${4 - b.b.z}`);
});

test('slopes: a weak putt rolls back down, a firm one climbs', () => {
  const w = P.compileHole(hole('cove-4')); // ramp from z=6 (h 0) up to the ridge at z=2 (h 0.9)
  const weak = roll(w, P.newBall('a', 0, 8.4, w), 0, 0.25);
  assert.equal(weak.result, 'stop');
  assert.ok(weak.b.z > 6, `weak putt should end below the ramp, got z=${weak.b.z}`);
  const firm = roll(w, P.newBall('a', 0, 8.4, w), 0, 0.85);
  assert.ok(firm.b.z < -2, `firm putt should clear the ridge, got z=${firm.b.z}`);
});

test('water sends the ball back as a hazard, falling off the world is out of bounds', () => {
  const w = P.compileHole(hole('cove-3')); // straight through the tidepool
  assert.equal(roll(w, P.newBall('a', 0, 7.4, w), 0, 0.6).result, 'water');
  const n = P.compileHole(hole('neon-2'));
  assert.equal(roll(n, P.newBall('a', 2.3, 1.5, n), 90, 0.4).result, 'oob'); // off the catwalk into the void
});

test('giant and tiny balls change the collision radius smoothly', () => {
  const w = P.compileHole(hole('cove-1'));
  const b = P.newBall('a', 0, 5, w);
  b.rTarget = P.C.R * 1.65;
  for (let t = 0; t < 2; t += 1 / 60) P.stepWorld(w, [b], t, 1 / 60);
  assert.ok(Math.abs(b.r - P.C.R * 1.65) < 1e-9);
  // Grown against a rail, the ball is pushed out rather than trapped inside it.
  const c = P.newBall('c', 1.6 - P.C.R - 0.13, 5, w);
  c.rTarget = P.C.R * 1.65;
  for (let t = 0; t < 2; t += 1 / 60) P.stepWorld(w, [c], t, 1 / 60);
  assert.ok(c.x + c.r <= 1.6 - 0.12 + 0.02, `giant ball overlaps the rail: x=${c.x} r=${c.r}`);
});

test('ghost balls pass soft obstacles but not outer rails', () => {
  const w = P.compileHole(hole('garden-3')); // hedge from (-6,2) to (2.2,2) is soft
  const normal = roll(w, P.newBall('a', -4, 4, w), 0, 0.35);
  assert.ok(normal.b.z > 2, 'a normal ball bounces off the hedge');
  const g = P.newBall('b', -4, 4, w); g.ghost = true;
  const ghost = roll(w, g, 0, 0.35);
  assert.ok(ghost.b.z < 2, 'a ghost ball goes through the hedge');
  const r = P.newBall('c', 0, 0, w); r.ghost = true;
  assert.notEqual(roll(w, r, 90, 1).result, 'oob', 'ghost still bounces off the outer rails');
});

test('frozen balls do not move and resume afterwards', () => {
  const w = P.compileHole(hole('cove-1'));
  const b = P.newBall('a', 0, 6, w);
  P.shoot(b, 0, -1, 8);
  P.stepWorld(w, [b], 0, 1 / 60);
  b.frozen = true;
  const z = b.z, vz = b.vz;
  for (let t = 0; t < 2; t += 1 / 60) P.stepWorld(w, [b], t, 1 / 60);
  assert.equal(b.z, z); assert.equal(b.vz, vz);
  b.frozen = false;
  P.stepWorld(w, [b], 2, 1 / 60);
  assert.ok(b.z < z);
});

test('ball-to-ball collisions transfer momentum; tee balls (solo) do not collide', () => {
  const w = P.compileHole(hole('cove-1'));
  const a = P.newBall('a', 0, 6, w), b = P.newBall('b', 0, 4, w);
  P.shoot(a, 0, -1, 6);
  for (let t = 0; t < 1; t += 1 / 60) P.stepWorld(w, [a, b], t, 1 / 60);
  assert.ok(b.z < 4 - 0.5, 'b was knocked forward');
  const c = P.newBall('c', 0, 6, w), d = P.newBall('d', 0, 4, w); d.solo = true;
  P.shoot(c, 0, -1, 6);
  for (let t = 0; t < 1; t += 1 / 60) P.stepWorld(w, [c, d], t, 1 / 60);
  assert.equal(d.z, 4);
});

test('a resting ball rides the ferry platform', () => {
  const w = P.compileHole(hole('garden-4'));
  const b = P.newBall('a', 0, 3.6, w);
  const f0 = P.floorAt(w, b.x, b.z, b.y, 0);
  assert.ok(f0 && f0.plat === 0, 'ball starts on the docked platform');
  for (let t = 0; t < 4; t += 1 / 60) P.stepWorld(w, [b], t, 1 / 60);
  assert.ok(b.z < -1, `the platform should have carried the ball across, z=${b.z}`);
  assert.ok(!b.moving || b.grounded);
});

test('trajectory preview matches the real simulation', () => {
  const w = P.compileHole(hole('cove-2'));
  const b = P.newBall('a', w.tee[0], w.tee[1], w);
  const pred = P.predict(w, b, 0.2, -1, 12, 0, { maxT: 30 });
  const c = { ...b }; P.shoot(c, 0.2, -1, 12);
  let res = null;
  for (let t = 0; t < 30 && !res; t += P.C.DT) { const r = P.stepWorld(w, [c], t, P.C.DT, { collide: false }); if (r.length) res = r[0].result; }
  assert.equal(pred.result, res);
  assert.ok(Math.hypot(pred.ball.x - c.x, pred.ball.z - c.z) < 1e-6);
});
