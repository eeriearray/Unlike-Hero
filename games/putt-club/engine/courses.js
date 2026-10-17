/* Putt Club — courses.
 *
 * Every hole is plain data. engine/physics.js compiles it into a collision world and js/world.js builds
 * the diorama from the same data, so what you see is what the ball hits.
 *
 * Coordinates: x is left/right, z runs from the tee (positive) toward the cup (negative), heights are y.
 *   floors   { rect: [x0, z0, x1, z1] | poly: [[x, z]...] | circle: [x, z, r], h, mat }
 *            slopes: h: [hAtMinEdge, hAtMaxEdge] with axis 'z' (default) or 'x'
 *            overlay: true  for sand/paint drawn on top of another floor (no rails, no ledges)
 *            rails: false   for open edges (bridges, catwalks); rails: { mat, height } to restyle
 *   Rails are generated on every floor edge that no other floor shares, except inside noRail boxes.
 *   walls    interior obstacles { pts: [[x, z]...], mat, height, soft }  (soft = Ghost Shot passes through)
 *   spinners { at, len, arms, speed (rad/s), phase }     sliders { from, to, len, angle, period }
 *   gates    { a, b, period, open (fraction of the cycle spent open) }
 *   bumpers  { at, r, kick, post (true = plain post, no kick) }
 *   pads     { at, r, dir, speed, up }   launch pads
 *   magnets  { at, r, k }                k > 0 attracts, k < 0 repels
 *   platforms { from, to, size: [w, d], period, pause }
 *   tokens   power-up crate spots       decor  render-only props { kind, at, s, rot, h }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PuttCourses = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function R(x0, z0, x1, z1, h, o) { var f = { rect: [x0, z0, x1, z1], h: h || 0 }; for (var k in o) f[k] = o[k]; return f; }
  /** Slope over a rect: h0 at the min-z (or min-x) edge, h1 at the max edge. */
  function S(x0, z0, x1, z1, h0, h1, axis, o) { var f = { rect: [x0, z0, x1, z1], h: [h0, h1], axis: axis || 'z' }; for (var k in o) f[k] = o[k]; return f; }
  function sand(x0, z0, x1, z1, h) { return { rect: [x0, z0, x1, z1], h: (h || 0) + 0.001, mat: 'sand', overlay: true }; }
  function paint(x0, z0, x1, z1, h, mat) { return { rect: [x0, z0, x1, z1], h: (h || 0) + 0.001, mat: mat, overlay: true }; }

  // ------------------------------------------------------------------ SUNSET COVE
  var cove = {
    id: 'sunset-cove', name: 'Sunset Cove', theme: 'cove',
    blurb: 'A tropical island resort: turquoise lagoons, sand traps, rope bridges and a lighthouse finale.',
    defaults: { water: { level: -0.42 }, railMat: 'wood', floorMat: 'grass' },
    holes: [
      {
        id: 'cove-1', name: 'Lagoon Lane', par: 2, tee: [0, 7.5], cup: [0, -6.6],
        tip: 'A gentle hump in the middle. Firm, straight putt.',
        floors: [
          R(-1.6, 3, 1.6, 9.2), S(-1.6, 0, 1.6, 3, 0.32, 0), S(-1.6, -3, 1.6, 0, 0, 0.32), R(-1.6, -8.6, 1.6, -3),
          sand(0.5, -8.4, 1.6, -7.3)
        ],
        tokens: [[-0.8, 1.6]],
        decor: [{ kind: 'palm', at: [-3.2, 5], s: 1.1 }, { kind: 'palm', at: [3.4, -2], s: 1.25, rot: 2 }, { kind: 'umbrella', at: [3.0, 6.5] }, { kind: 'rock', at: [-2.8, -6], s: 1.2 }, { kind: 'starfish', at: [2.4, -7.6] }]
      },
      {
        id: 'cove-2', name: 'Boardwalk Bend', par: 3, tee: [-5.3, 6.4], cup: [5.2, -3.3], teeDir: [0, -1],
        tip: 'Bank it off the corner, or brave the plank bridge for a shortcut.',
        floors: [
          R(-7, -5, -3.6, 8), R(-3.6, -5, 6.8, -1.6),
          { poly: [[-3.6, 5.0], [-3.6, 3.4], [2.4, -1.6], [4.0, -1.6]], h: 0, mat: 'bridge', rails: false },
          sand(-7, -5, -5.6, -3.6)
        ],
        bumpers: [{ at: [-6.4, -4.4], r: 0.5, post: true, e: 0.6, kick: 0, mat: 'stone' }],
        tokens: [[0.1, 1.4], [-5.3, -1.0]],
        decor: [{ kind: 'hut', at: [-9.6, 2], rot: 1.4 }, { kind: 'palm', at: [0.4, 4.4], s: 1.2 }, { kind: 'palm', at: [8.6, -6], s: 1.0 }, { kind: 'boat', at: [3, 5.5], rot: 0.6 }, { kind: 'rock', at: [-8.6, -6.5] }]
      },
      {
        id: 'cove-3', name: 'Tidepool', par: 3, tee: [0, 7.4], cup: [0, -6.8],
        tip: 'Go around the tidepool. The rock posts make handy banks.',
        floors: [
          R(-5, 1.5, 5, 9), R(-5, -9, 5, -1.5), R(-5, -1.5, -1.5, 1.5), R(1.5, -1.5, 5, 1.5),
          sand(-5, 4, -1.6, 5.1), sand(1.6, -5.2, 5, -4.1)
        ],
        noRail: [[-1.6, -1.6, 1.6, 1.6]],
        bumpers: [{ at: [-3.4, 0], r: 0.42, post: true, e: 0.6, kick: 0, mat: 'stone' }, { at: [3.4, 0], r: 0.42, post: true, e: 0.6, kick: 0, mat: 'stone' }],
        tokens: [[-3.3, -0.9], [3.3, 0.9]],
        decor: [{ kind: 'rock', at: [0, 0], s: 0.9, h: -0.4 }, { kind: 'palm', at: [-6.4, 7], s: 1.1 }, { kind: 'palm', at: [6.6, -7.2], s: 1.2 }, { kind: 'umbrella', at: [6.4, 5] }, { kind: 'starfish', at: [-4.2, -8.2] }]
      },
      {
        id: 'cove-4', name: 'Coconut Ridge', par: 3, tee: [0, 8.4], cup: [-1.2, -10.4], teeDir: [0, -1],
        tip: 'Hit it hard up the ridge to jump the channel, or take the long way round on the left.',
        floors: [
          R(-6, 6, 1.8, 10), S(-1.8, 2, 1.8, 6, 0.9, 0), R(-1.8, -1, 1.8, 2, 0.9), R(-1.8, -8, 1.8, -3),
          R(-6, -12.2, 1.8, -8), R(-6, -8, -3.8, 6), sand(-3.6, -12.2, -2.2, -11)
        ],
        noRail: [[-1.9, -3.1, 1.9, -0.9]],
        tokens: [[0, -5], [-4.9, 0]],
        decor: [{ kind: 'palm', at: [-2.8, 1], s: 1.3 }, { kind: 'palm', at: [3.2, 4], s: 1.0, rot: 1 }, { kind: 'rock', at: [3, -6], s: 1.3 }, { kind: 'hut', at: [4.5, -11], rot: -0.6 }, { kind: 'umbrella', at: [-7.6, 9] }]
      },
      {
        id: 'cove-5', name: 'Island Hopper', par: 4, tee: [-0.6, 9.2], cup: [3.4, -8.4], teeDir: [-1, 0],
        tip: 'Hop island to island over the rope bridges, or thread the long plank straight to the green.',
        floors: [
          R(-2.6, 6, 4, 11.4), R(-7, -1, -2.6, 3.6), R(0.4, -11, 6.2, -5),
          R(-4.9, 3.6, -3.5, 8.8, 0, { mat: 'bridge', rails: { mat: 'rope', height: 0.3 } }),
          R(-3.5, 7.4, -2.6, 8.8, 0, { mat: 'bridge', rails: { mat: 'rope', height: 0.3 } }),
          R(-2.6, -0.2, 0.4, 1.2, 0, { mat: 'bridge', rails: { mat: 'rope', height: 0.3 } }),
          R(0.4, -5, 1.8, 1.2, 0, { mat: 'bridge', rails: { mat: 'rope', height: 0.3 } }),
          R(2.7, -5, 3.7, 6, 0, { mat: 'bridge', rails: false })
        ],
        tokens: [[3.2, 0.5], [-4.8, 1.2], [5, -10]],
        decor: [{ kind: 'palm', at: [-5.6, 2.6], s: 1.2 }, { kind: 'palm', at: [5.2, -6], s: 1.0 }, { kind: 'palm', at: [-1.8, 10.6], s: 0.9, rot: 2 }, { kind: 'hut', at: [-6.2, 0], rot: 0.4, s: 0.7 }, { kind: 'boat', at: [-1, -5], rot: 2.2 }, { kind: 'rock', at: [7.6, 2], s: 1.4 }]
      },
      {
        id: 'cove-6', name: 'Lighthouse Point', par: 4, tee: [4.3, 8.6], cup: [3.6, -12], teeDir: [0, -1],
        tip: 'Climb the switchbacks to the lighthouse. The narrow plank on the right is a daring shortcut.',
        floors: [
          R(1, 6, 6, 10.4), S(2.5, 0, 6, 6, 0.6, 0), R(-6, -3.5, 6, 0, 0.6), S(-6, -9.5, -2.5, -3.5, 1.2, 0.6),
          R(-6, -14.2, 6, -9.5, 1.2), S(3, -9.5, 4.2, -3.5, 1.2, 0.6, 'z', { mat: 'bridge', rails: false }),
          sand(-1.5, -14.2, 1, -12.6, 1.2)
        ],
        bumpers: [{ at: [-1.2, -1.8], r: 0.45, post: true, e: 0.6, kick: 0, mat: 'stone', h: 0.6 }],
        tokens: [[-4.2, -6.4], [0.5, -1.8], [-3.5, -12]],
        decor: [{ kind: 'lighthouse', at: [7.4, -13] }, { kind: 'palm', at: [-7.6, -1], s: 1.2 }, { kind: 'palm', at: [-2, 5], s: 1.1 }, { kind: 'rock', at: [-1, -6.5], s: 1.6 }, { kind: 'boat', at: [8.5, 3], rot: -0.4 }, { kind: 'umbrella', at: [-1.2, 8.6] }]
      }
    ]
  };

  // ------------------------------------------------------------------ CLOCKWORK GARDEN
  var garden = {
    id: 'clockwork-garden', name: 'Clockwork Garden', theme: 'garden',
    blurb: 'A whimsical mechanical garden of brass gears, clipped hedges, timed gates and a ferry pond.',
    defaults: { railMat: 'stone', floorMat: 'grass', oobY: -0.7 },
    holes: [
      {
        id: 'garden-1', name: 'Windmill Walk', par: 2, tee: [0, 7.5], cup: [0, -7],
        tip: 'Time your putt so the turning bar lets you through.',
        floors: [R(-1.8, -9, 1.8, 9), paint(-1.8, -1.2, 1.8, 1.2, 0, 'stone')],
        spinners: [{ at: [0, 0], len: 3.1, arms: 1, speed: 1.1, mat: 'wood' }],
        tokens: [[0.9, 4]],
        decor: [{ kind: 'windmill', at: [3.8, 0.6] }, { kind: 'hedgeBall', at: [-3, 6] }, { kind: 'hedgeBall', at: [3, -6] }, { kind: 'flowers', at: [3, 4] }, { kind: 'flowers', at: [-3, -4] }, { kind: 'lamp', at: [-2.8, -8] }]
      },
      {
        id: 'garden-2', name: 'Gear Gate', par: 3, tee: [-4.3, 8.4], cup: [4.3, -8], teeDir: [0, -1],
        tip: 'Two brass gates open and close on a timer. Watch the rhythm before you putt.',
        floors: [R(-6, 4, -2.6, 10), R(-6, -2, -2.6, 4), R(-2.6, -2, 6, 1.4), R(2.6, -10, 6, -2), paint(-6, -2, -2.6, 1.4, 0, 'stone'), paint(2.6, -2, 6, 1.4, 0, 'stone')],
        gates: [{ a: [0.8, -2], b: [0.8, 1.4], period: 4, open: 0.45 }, { a: [2.6, -5.4], b: [6, -5.4], period: 5, open: 0.45, phase: 0.5 }],
        bumpers: [{ at: [-5.4, 0.8], r: 0.45, kick: 2 }, { at: [5.4, 0.8], r: 0.45, kick: 2 }],
        tokens: [[-4.3, 1], [4.3, -3.6]],
        decor: [{ kind: 'gear', at: [-0.2, 6], s: 1.4 }, { kind: 'gear', at: [1.2, -6], s: 1.0 }, { kind: 'hedgeBall', at: [-7.6, -3.5] }, { kind: 'topiary', at: [7.6, -9] }, { kind: 'flowers', at: [-1.5, 3] }, { kind: 'lamp', at: [7.4, 2.6] }]
      },
      {
        id: 'garden-3', name: 'Topiary Maze', par: 3, tee: [-4, 6.2], cup: [4, -6], teeDir: [1, 0],
        tip: 'Wind through the hedges. A Ghost Shot goes straight through them.',
        floors: [R(-6, -8, 6, 8)],
        walls: [{ pts: [[-6, 2], [2.2, 2]], mat: 'hedge', height: 0.6, thick: 0.3, soft: true }, { pts: [[-2.2, -2.6], [6, -2.6]], mat: 'hedge', height: 0.6, thick: 0.3, soft: true }],
        sliders: [{ from: [-3.2, -0.3], to: [3.2, -0.3], len: 1.6, angle: 0, period: 5, mat: 'brass' }],
        bumpers: [{ at: [4.4, 5.2], r: 0.45, kick: 2.2 }, { at: [-4.4, -5.2], r: 0.45, kick: 2.2 }],
        tokens: [[4.2, 0.6], [-4.4, -0.8]],
        decor: [{ kind: 'topiary', at: [-7.6, 7] }, { kind: 'topiary', at: [7.6, -7] }, { kind: 'gear', at: [7.8, 3], s: 1.2 }, { kind: 'flowers', at: [-7.6, -3] }, { kind: 'lamp', at: [7.2, 7.4] }, { kind: 'bench', at: [-7.8, 2], rot: 1.57 }]
      },
      {
        id: 'garden-4', name: 'Ferry Pond', par: 3, tee: [0, 8.2], cup: [0, -7.5],
        tip: 'Ride the ferry across the pond, or take the stone path past the spinner.',
        water: { level: -0.32, regions: [[-6, -4, 6, 4]] },
        floors: [R(-6, 4, 6, 10), R(-6, -10, 6, -4), R(6, -10, 8.2, 10, 0, { mat: 'stone' })],
        noRail: [[-1.35, 3.8, 1.35, 4.2], [-1.35, -4.2, 1.35, -3.8]],
        platforms: [{ from: [0, 2.8], to: [0, -2.8], size: [2.4, 2.4], period: 8, pause: 0.22, mat: 'wood' }],
        spinners: [{ at: [7.1, 0], len: 2.0, arms: 1, speed: 1.4, mat: 'brass', phase: 0.6 }],
        tokens: [[7.1, 5], [-3.5, -6]],
        decor: [{ kind: 'lily', at: [-3.5, 1.5] }, { kind: 'lily', at: [3.6, -1.6] }, { kind: 'lily', at: [-2, -2.6] }, { kind: 'gear', at: [-7.6, 0], s: 1.6 }, { kind: 'hedgeBall', at: [-7.5, 8] }, { kind: 'lamp', at: [9.2, -9] }, { kind: 'flowers', at: [-7.4, -8] }]
      },
      {
        id: 'garden-5', name: 'Pendulum Run', par: 4, tee: [0, 10.4], cup: [-4, -12],
        tip: 'Slip past the sliding brass bars, climb the terrace, and mind the gate at the top.',
        floors: [R(-2, 4, 2, 12), R(-2, -4, 2, 4), S(-2, -10, 2, -4, 0.8, 0), R(-6, -14, 6, -10, 0.8), paint(-2, -4, 2, 4, 0, 'stone')],
        sliders: [{ from: [-1.2, 2], to: [1.2, 2], len: 1.5, angle: 0, period: 3.2 }, { from: [1.2, -1.6], to: [-1.2, -1.6], len: 1.5, angle: 0, period: 3.2, phase: 0.25 }],
        gates: [{ a: [-2, -10.2], b: [2, -10.2], h: 0.8, period: 4.5, open: 0.5 }],
        bumpers: [{ at: [1.2, -12.4], r: 0.45, kick: 2.4, h: 0.8 }, { at: [4, -11.4], r: 0.45, kick: 2.4, h: 0.8 }],
        tokens: [[0, 6], [0, -7], [4.4, -13]],
        decor: [{ kind: 'gear', at: [-4, 0], s: 1.8 }, { kind: 'gear', at: [4.2, 3], s: 1.2 }, { kind: 'topiary', at: [-7.4, -12] }, { kind: 'hedgeBall', at: [3.6, 9] }, { kind: 'lamp', at: [-3.4, 10] }, { kind: 'flowers', at: [3.6, -6] }]
      },
      {
        id: 'garden-6', name: 'Grand Orrery', par: 3, tee: [0, 11.4], cup: [0, -4.8],
        tip: 'The great brass cross sweeps the lawn. Find a gap, then bank off the posts.',
        floors: [R(-1.6, 7, 1.6, 13), { poly: roundRect(-7, -7, 7, 7, 2.2), h: 0 }],
        spinners: [{ at: [0, 1], len: 8.4, arms: 2, speed: 0.55, mat: 'brass', hub: 0.55, thick: 0.18 }],
        bumpers: [{ at: [-1.4, -6], r: 0.36, kick: 1.5 }, { at: [1.4, -6], r: 0.36, kick: 1.5 }, { at: [-5, 5], r: 0.45, kick: 2.5 }, { at: [5, 5], r: 0.45, kick: 2.5 }],
        tokens: [[-4.6, -1], [4.6, -1], [0, 5.6]],
        decor: [{ kind: 'orrery', at: [0, 1] }, { kind: 'topiary', at: [-8.6, -8] }, { kind: 'topiary', at: [8.6, -8] }, { kind: 'gear', at: [-8.8, 6], s: 1.4 }, { kind: 'lamp', at: [3, 11] }, { kind: 'flowers', at: [-3, 10] }]
      }
    ]
  };

  // ------------------------------------------------------------------ NEON UNDERGROUND
  var neon = {
    id: 'neon-underground', name: 'Neon Underground', theme: 'neon',
    blurb: 'A futuristic arena under the city: launch pads, magnets, glass catwalks and very bouncy bumpers.',
    defaults: { railMat: 'neon', floorMat: 'metal', oobY: -3.5 },
    holes: [
      {
        id: 'neon-1', name: 'Boot Sequence', par: 2, tee: [0, 7.5], cup: [0, -7.4],
        tip: 'Bumpers kick back hard. Thread the middle.',
        floors: [R(-1.8, -9, 1.8, 9), paint(-1.8, -3, 1.8, 3, 0, 'tile')],
        bumpers: [{ at: [-0.95, 1.6], r: 0.4, kick: 3 }, { at: [0.95, -1.6], r: 0.4, kick: 3 }],
        tokens: [[0.8, 5]],
        decor: [{ kind: 'pillar', at: [-3.2, 6] }, { kind: 'pillar', at: [3.2, 6] }, { kind: 'pillar', at: [-3.2, -6] }, { kind: 'pillar', at: [3.2, -6] }, { kind: 'screen', at: [0, -11], rot: 0 }]
      },
      {
        id: 'neon-2', name: 'Launch Window', par: 2, tee: [0, 8.6], cup: [1.3, -6.8],
        tip: 'Roll over the launch pad to fly the gap. The catwalk on the right is for the brave.',
        floors: [R(-1.8, 2, 2.8, 10), R(-1.8, -9, 2.8, -1), R(1.8, -1, 2.8, 2, 0, { mat: 'glass', rails: false })],
        noRail: [[-1.9, -1.2, 1.85, -0.8]],
        pads: [{ at: [0, 4], r: 0.75, dir: [0, -1], speed: 12.5, up: 6 }],
        bumpers: [{ at: [0.4, -4.6], r: 0.4, kick: 2.6 }],
        tokens: [[2.3, 0.3], [-1, -4]],
        decor: [{ kind: 'pillar', at: [-3.4, 8] }, { kind: 'crystal', at: [-3.5, -3] }, { kind: 'screen', at: [4.8, 5], rot: -1.57 }, { kind: 'pillar', at: [4.4, -8] }, { kind: 'cables', at: [0, 0.3] }]
      },
      {
        id: 'neon-3', name: 'Magnet Alley', par: 3, tee: [0, 8.4], cup: [4, -8], teeDir: [0, -1],
        tip: 'Magnetic coils bend your line. Use the pull, or fight it.',
        floors: [R(-2, 2, 2, 10), R(-2, -2, 6, 2), R(2, -10, 6, -2), paint(-2, -2, 6, 2, 0, 'tile')],
        magnets: [{ at: [-0.6, 0], r: 2.6, k: 7 }, { at: [2.6, -5.6], r: 2.0, k: -6 }],
        bumpers: [{ at: [-0.6, 0], r: 0.35, post: true, e: 0.7, kick: 0, mat: 'metal' }, { at: [2.6, -5.6], r: 0.35, post: true, e: 0.7, kick: 0, mat: 'metal' }],
        tokens: [[3.8, 0.6], [5, -4]],
        decor: [{ kind: 'pillar', at: [-3.6, 8] }, { kind: 'pillar', at: [7.6, -9] }, { kind: 'screen', at: [-4, -3], rot: 0.8 }, { kind: 'crystal', at: [8, 1] }, { kind: 'cables', at: [0, -5] }]
      },
      {
        id: 'neon-4', name: 'Bumper Arcade', par: 3, tee: [0, 7.6], cup: [0, -7],
        tip: 'Uphill pinball. Weak putts roll back to you.',
        floors: [S(-5, -5, 5, 9, 0.55, 0), R(-5, -9, 5, -5, 0.55)],
        bumpers: [{ at: [-2.5, 2], r: 0.5, kick: 3 }, { at: [2.5, 2], r: 0.5, kick: 3 }, { at: [0, -0.8], r: 0.5, kick: 3 }, { at: [-2.6, -3.6], r: 0.5, kick: 3 }, { at: [2.6, -3.6], r: 0.5, kick: 3 }],
        tokens: [[-3.8, -1], [3.8, -1]],
        decor: [{ kind: 'screen', at: [0, -11], rot: 0 }, { kind: 'pillar', at: [-6.6, 6] }, { kind: 'pillar', at: [6.6, 6] }, { kind: 'crystal', at: [-6.8, -6] }, { kind: 'crystal', at: [6.8, -6] }]
      },
      {
        id: 'neon-5', name: 'Glass Spiral', par: 3, tee: [0, 8.4], cup: [1.4, -12],
        tip: 'Glass catwalks have no rails. The right-hand lane is slower but safe.',
        floors: [
          R(-3, 6, 3, 10, 1.0), S(-0.8, 0, 0.8, 6, 0.4, 1.0, 'z', { mat: 'glass', rails: false }), R(-3, -4, 3, 0, 0.4),
          R(-2.4, -10, -1.2, -4, 0.4, { mat: 'glass', rails: false }), R(-3, -14, 3, -10, 0.4), R(3, -14, 6, 0, 0.4)
        ],
        bumpers: [{ at: [0.6, -2.4], r: 0.4, kick: 2.6 }, { at: [4.5, -7], r: 0.4, kick: 2.6 }],
        tokens: [[-1.8, -7], [4.5, -2]],
        decor: [{ kind: 'pillar', at: [-4.6, 8] }, { kind: 'crystal', at: [-3, 3], s: 1.3 }, { kind: 'crystal', at: [2.4, 3.6] }, { kind: 'screen', at: [-4.8, -9], rot: 1.57 }, { kind: 'pillar', at: [7.4, -13] }]
      },
      {
        id: 'neon-6', name: 'Core Overload', par: 4, tee: [0, 10.6], cup: [0, -9.6],
        tip: 'Launch up to the core deck, dodge the spinner, then time the laser gate.',
        floors: [
          R(-2.5, 6, 2.5, 12), R(2.5, 6, 5, 12), S(2.5, -6, 5, 6, 1.0, 0), R(-2.5, -6, 2.5, 3, 1.0), R(-5, -12, 5, -6, 1.0),
          paint(-2.5, -6, 2.5, 3, 1.0, 'tile')
        ],
        noRail: [[-2.6, 2.8, 2.45, 3.2]],
        pads: [{ at: [0, 7.2], r: 0.75, dir: [0, -1], speed: 10, up: 8 }],
        spinners: [{ at: [0, -1.6], len: 3.4, arms: 1, speed: 1.5, mat: 'metal', h: 1.0 }],
        gates: [{ a: [-5, -7.6], b: [5, -7.6], h: 1.0, period: 4, open: 0.45, mat: 'neon' }],
        magnets: [{ at: [3.6, -10.6], r: 2, k: -5, h: 1 }],
        bumpers: [{ at: [-2.2, -10.4], r: 0.4, kick: 2.6, h: 1.0 }, { at: [2.2, -10.4], r: 0.4, kick: 2.6, h: 1.0 }],
        tokens: [[3.75, 2], [-1.6, -4.5], [0, -11.2]],
        decor: [{ kind: 'core', at: [0, -14.5] }, { kind: 'pillar', at: [-4.4, 10] }, { kind: 'pillar', at: [-6.8, -10] }, { kind: 'crystal', at: [-4.2, 0], s: 1.4 }, { kind: 'cables', at: [0, 4.6] }, { kind: 'screen', at: [7.4, -2], rot: -1.57 }]
      }
    ]
  };

  function roundRect(x0, z0, x1, z1, r) {
    var pts = [], n = 6;
    var corners = [[x1 - r, z0 + r, -Math.PI / 2], [x1 - r, z1 - r, 0], [x0 + r, z1 - r, Math.PI / 2], [x0 + r, z0 + r, Math.PI]];
    corners.forEach(function (c) {
      for (var i = 0; i <= n; i++) { var a = c[2] + (i / n) * (Math.PI / 2); pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); }
    });
    return pts;
  }

  var COURSES = [cove, garden, neon];
  COURSES.forEach(function (c, ci) {
    c.index = ci;
    c.holes.forEach(function (h, hi) {
      h.number = hi + 1; h.course = c.id; h.theme = c.theme;
      for (var k in c.defaults) if (h[k] == null) h[k] = c.defaults[k];
      h.floors.forEach(function (f) { if (!f.mat) f.mat = c.defaults.floorMat; });
    });
  });

  function byId(id) { for (var i = 0; i < COURSES.length; i++) if (COURSES[i].id === id) return COURSES[i]; return null; }

  return { COURSES: COURSES, byId: byId, roundRect: roundRect };
});
