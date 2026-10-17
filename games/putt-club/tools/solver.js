// Putt Club hole solver: proves a hole can be finished by searching real shots through the physics engine.
// Beam search over (angle, power, wait-for-obstacles) from the tee, ranked by walking distance to the cup.
// Used by test/putt-club-courses.test.mjs and runnable directly:  node games/putt-club/tools/solver.js [hole-id]
'use strict';
const P = require('../engine/physics.js');
const Courses = require('../engine/courses.js');

const { distanceField } = require('../engine/ai.js');

/** Simulate one shot to rest on the hole's own Rapier world. Returns { result, ball, t }. */
function play(w, ball, dx, dz, speed, t0) {
  const r = P.predict(w, ball, dx, dz, speed, t0, { maxT: P.C.MAX_SHOT_TIME + 2, every: 1 });
  return { result: r.result || 'stop', ball: { x: r.ball.x, y: r.ball.y, z: r.ball.z, r: P.C.R, rTarget: P.C.R }, t: t0 + (r.points.length - 1) };
}

function solve(hole, opts = {}) {
  const w = P.compileHole(hole, { mirror: !!opts.mirror });
  const dist = distanceField(w);
  const angles = opts.angles || 40, powers = opts.powers || [0.18, 0.3, 0.45, 0.6, 0.78, 1];
  const dynamic = w.spinners.length || w.sliders.length || w.gates.length || w.platforms.length;
  const waits = dynamic ? (opts.waits || [0, 0.9, 1.9, 3.1]) : [0];
  const beam = opts.beam || 8, maxDepth = opts.maxDepth || hole.par + 2;
  const tf = P.floorAt(w, w.tee[0], w.tee[1], 50, 0);
  let states = [{ ball: { x: w.tee[0], y: tf ? tf.h : 0, z: w.tee[1], r: P.C.R, rTarget: P.C.R }, t: 0, path: [] }];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = new Map();
    for (const s of states) {
      for (const wait of waits) for (let a = 0; a < angles; a++) for (const pw of powers) {
        const th = (a / angles) * Math.PI * 2;
        const r = play(w, s.ball, Math.sin(th), -Math.cos(th), P.shotSpeed(pw), s.t + wait);
        const step = { angle: Math.round(th * 180 / Math.PI), power: pw, wait };
        if (r.result === 'cup') { done(w); return { solved: true, strokes: depth, path: s.path.concat([step]) }; }
        if (r.result !== 'stop') continue;
        const key = Math.round(r.ball.x / 0.6) + ',' + Math.round(r.ball.z / 0.6) + ',' + Math.round(r.ball.y * 4);
        const score = dist(r.ball.x, r.ball.z);
        const prev = next.get(key);
        if (!prev || prev.score > score) next.set(key, { ball: r.ball, t: r.t, score, path: s.path.concat([step]) });
      }
    }
    states = [...next.values()].sort((x, y) => x.score - y.score).slice(0, beam);
    if (!states.length) break;
  }
  done(w);
  return { solved: false, best: states[0] && states[0].score };
}
function done(w) { if (w._pred) { P.freeSim(w._pred); w._pred = null; } }

if (require.main === module) P.init().then(() => {
  const only = process.argv[2];
  for (const c of Courses.COURSES) for (const h of c.holes) {
    if (only && h.id !== only) continue;
    const t0 = Date.now();
    const r = solve(h);
    console.log(`${h.id.padEnd(10)} par ${h.par}  ${r.solved ? 'solved in ' + r.strokes : 'NOT SOLVED (best distance ' + (r.best || 0).toFixed(1) + ')'}  ${Date.now() - t0}ms  ${r.path ? JSON.stringify(r.path) : ''}`);
  }
});

module.exports = { solve, play, distanceField };
