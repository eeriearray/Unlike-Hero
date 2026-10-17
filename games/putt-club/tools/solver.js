// Putt Club hole solver: proves a hole can be finished by searching real shots through the physics engine.
// Beam search over (angle, power, wait-for-obstacles) from the tee, ranked by walking distance to the cup.
// Used by test/putt-club-courses.test.mjs and runnable directly:  node games/putt-club/tools/solver.js [hole-id]
'use strict';
const P = require('../engine/physics.js');
const Courses = require('../engine/courses.js');

const { distanceField } = require('../engine/ai.js');

/** Simulate one shot to rest. Returns { result, ball, t }. */
function play(w, ball, dx, dz, speed, t0) {
  const b = { ...ball, safe: null, lipped: false };
  P.shoot(b, dx, dz, speed);
  let t = 0, result = null;
  while (t < P.C.MAX_SHOT_TIME + 2) {
    const r = P.stepWorld(w, [b], t0 + t, 1 / 60);
    t += 1 / 60;
    if (r.length) { result = r[0].result; break; }
  }
  return { result: result || 'stop', ball: b, t: t0 + t };
}

function solve(hole, opts = {}) {
  const w = P.compileHole(hole, { mirror: !!opts.mirror });
  const dist = distanceField(w);
  const angles = opts.angles || 40, powers = opts.powers || [0.18, 0.3, 0.45, 0.6, 0.78, 1];
  const dynamic = w.spinners.length || w.sliders.length || w.gates.length || w.platforms.length;
  const waits = dynamic ? (opts.waits || [0, 0.9, 1.9, 3.1]) : [0];
  const beam = opts.beam || 8, maxDepth = opts.maxDepth || hole.par + 2;
  let states = [{ ball: P.newBall('s', w.tee[0], w.tee[1], w), t: 0, path: [] }];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = new Map();
    for (const s of states) {
      for (const wait of waits) for (let a = 0; a < angles; a++) for (const pw of powers) {
        const th = (a / angles) * Math.PI * 2;
        const r = play(w, s.ball, Math.sin(th), -Math.cos(th), P.shotSpeed(pw), s.t + wait);
        const step = { angle: Math.round(th * 180 / Math.PI), power: pw, wait };
        if (r.result === 'cup') return { solved: true, strokes: depth, path: s.path.concat([step]) };
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
  return { solved: false, best: states[0] && states[0].score };
}

if (require.main === module) {
  const only = process.argv[2];
  for (const c of Courses.COURSES) for (const h of c.holes) {
    if (only && h.id !== only) continue;
    const t0 = Date.now();
    const r = solve(h);
    console.log(`${h.id.padEnd(10)} par ${h.par}  ${r.solved ? 'solved in ' + r.strokes : 'NOT SOLVED (best distance ' + (r.best || 0).toFixed(1) + ')'}  ${Date.now() - t0}ms  ${r.path ? JSON.stringify(r.path) : ''}`);
  }
}

module.exports = { solve, play, distanceField };
