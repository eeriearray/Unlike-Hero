// Course tests for Putt Club: data sanity, and every hole (and its mirror) proven finishable by real shots.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../games/putt-club/engine/physics.js');
const Courses = require('../games/putt-club/engine/courses.js');
const { solve } = require('../games/putt-club/tools/solver.js');
await P.init();
const FULL = !!process.env.PUTT_FULL; // PUTT_FULL=1 also solves every mirrored hole (slow)

test('three courses with six holes each, distinct themes and pars of 2–4', () => {
  assert.equal(Courses.COURSES.length, 3);
  assert.deepEqual(Courses.COURSES.map((c) => c.theme), ['cove', 'garden', 'neon']);
  for (const c of Courses.COURSES) {
    assert.equal(c.holes.length, 6, c.id);
    for (const h of c.holes) assert.ok(h.par >= 2 && h.par <= 4, h.id);
    assert.equal(new Set(c.holes.map((h) => h.name)).size, 6);
  }
});

test('tees, cups and power-up crates sit on real floor, away from walls', () => {
  for (const c of Courses.COURSES) for (const h of c.holes) {
    for (const mirror of [false, true]) {
      const w = P.compileHole(h, { mirror });
      const spots = [['tee', w.tee], ['cup', w.cup], ...w.tokens.map((t, i) => ['token ' + i, t])];
      for (const [what, [x, z]] of spots) {
        assert.ok(P.floorAt(w, x, z, 50, 0), `${h.id}${mirror ? ' (mirror)' : ''}: ${what} is not on a floor`);
        const sim = P.createSim(w), b = P.addBall(sim, 'probe', x, z);
        P.wake(b);
        P.stepSim(sim, 0, 0.25);
        assert.ok(Math.hypot(b.x - x, b.z - z) < 0.02, `${h.id}${mirror ? ' (mirror)' : ''}: ${what} is not a resting spot (moved ${Math.hypot(b.x - x, b.z - z).toFixed(3)})`);
        P.freeSim(sim);
      }
    }
  }
});

test('every hole can be finished within par + 2 by real shots (PUTT_FULL=1: mirrored holes too)', { timeout: 1_800_000 }, () => {
  for (const c of Courses.COURSES) for (const h of c.holes) {
    for (const mirror of FULL ? [false, true] : [false]) {
      const r = solve(h, { mirror, angles: 32, beam: 6 });
      assert.ok(r.solved, `${h.id}${mirror ? ' (mirror)' : ''} could not be finished (best distance ${r.best})`);
      assert.ok(r.strokes <= h.par + 2, `${h.id}: needed ${r.strokes} strokes`);
    }
  }
});
