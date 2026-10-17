/* Putt Club — bots.
 *
 * A bot looks at its ball, tries a fan of shots through the real physics (PuttPhysics.predict), scores
 * where each one ends by walking distance to the cup, and plays the best one with some human-ish error.
 * Bots sometimes use power-ups. They only ever act through PuttMatch commands, like a player would.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./physics.js'), require('./powerups.js'));
  else root.PuttAI = factory(root.PuttPhysics, root.PuttPowerups);
})(typeof self !== 'undefined' ? self : this, function (P, Powerups) {
  'use strict';

  var CELL = 0.5;

  /** Walking distance (around walls) from any point to the cup, on a 0.5-unit grid. Cached per world. */
  function distanceField(w) {
    if (w._dist) return w._dist;
    var b = w.bounds, nx = Math.ceil((b[2] - b[0]) / CELL) + 1, nz = Math.ceil((b[3] - b[1]) / CELL) + 1;
    var floor = new Uint8Array(nx * nz), dist = new Float32Array(nx * nz), ys = new Float32Array(nx * nz);
    for (var q0 = 0; q0 < dist.length; q0++) dist[q0] = Infinity;
    function cx(i) { return b[0] + i * CELL; }
    function cz(k) { return b[1] + k * CELL; }
    for (var k = 0; k < nz; k++) for (var i = 0; i < nx; i++) {
      var f = P.floorAt(w, cx(i), cz(k), 50, 0);
      if (f) { floor[k * nx + i] = 1; ys[k * nx + i] = f.h; }
    }
    var ci = Math.round((w.cup[0] - b[0]) / CELL), ck = Math.round((w.cup[1] - b[1]) / CELL);
    var queue = [ci, ck], head = 0;
    dist[ck * nx + ci] = 0;
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (head < queue.length) {
      var i0 = queue[head++], k0 = queue[head++], d = dist[k0 * nx + i0];
      for (var j = 0; j < 4; j++) {
        var i2 = i0 + dirs[j][0], k2 = k0 + dirs[j][1], n = k2 * nx + i2;
        if (i2 < 0 || k2 < 0 || i2 >= nx || k2 >= nz || !floor[n] || dist[n] <= d + 1) continue;
        if (P.blocked(w, cx(i0), cz(k0), cx(i2), cz(k2), Math.min(ys[k0 * nx + i0], ys[n]))) continue;
        dist[n] = d + 1; queue.push(i2, k2);
      }
    }
    w._dist = function (x, z) {
      var i = Math.round((x - b[0]) / CELL), k = Math.round((z - b[1]) / CELL);
      if (i < 0 || k < 0 || i >= nx || k >= nz) return 1e9;
      var v = dist[k * nx + i];
      return isFinite(v) ? v * CELL : Math.hypot(x - w.cup[0], z - w.cup[1]) * 3 + 50;
    };
    return w._dist;
  }

  /**
   * A shot planner that can be run a few candidates at a time (so a bot never stalls a server tick).
   * planner.step(n) evaluates up to n candidate shots; planner.done / planner.best when finished.
   */
  function planner(w, b, t, opts) {
    opts = opts || {};
    var dist = distanceField(w), strength = opts.strength || 1, rng = opts.rng || Math.random, turbo = opts.turbo || 1;
    var angles = opts.angles || 24, powers = opts.powers || [0.16, 0.3, 0.46, 0.64, 0.82, 1];
    var base = Math.atan2(w.cup[0] - b.x, -(w.cup[1] - b.z));
    var queue = [];
    for (var a = 0; a < angles; a++) for (var p = 0; p < powers.length; p++) queue.push([base + (a / angles) * Math.PI * 2, powers[p]]);
    var refine = opts.refine == null ? 10 : opts.refine;
    var self = { done: false, best: null, evaluated: 0 };
    function score(th, pw) {
      var r = P.predict(w, b, Math.sin(th), -Math.cos(th), P.shotSpeed(pw, strength) * turbo, t, { maxT: 6, every: 1 });
      if (r.result === 'cup') return -10;
      if (r.result === 'water' || r.result === 'oob') return 1e6;
      return dist(r.ball.x, r.ball.z) + (r.ball.moving ? 1.5 : 0);
    }
    self.step = function (n) {
      while (n-- > 0 && !self.done) {
        var c;
        if (queue.length) c = queue.shift();
        else if (refine-- > 0 && self.best) c = [self.best.th + (rng() - 0.5) * 0.3, Math.min(1, Math.max(0.05, self.best.power + (rng() - 0.5) * 0.18))];
        else { self.done = true; break; }
        var s = score(c[0], c[1]);
        self.evaluated++;
        if (!self.best || s < self.best.score) self.best = { th: c[0], power: c[1], score: s };
        if (s <= -10 && !queue.length) self.done = true;
      }
      return self.done;
    };
    return self;
  }

  /** Choose a shot in one go (tests and tools). Returns { dx, dz, power, score }. */
  function chooseShot(w, b, t, opts) {
    var pl = planner(w, b, t, opts);
    while (!pl.step(50)) { /* keep going */ }
    return { dx: Math.sin(pl.best.th), dz: -Math.cos(pl.best.th), power: pl.best.power, score: pl.best.score };
  }

  var now = typeof performance !== 'undefined' ? function () { return performance.now(); } : function () { return Date.now(); };

  /**
   * Called every tick for each bot by PuttMatch.playRules. A bot waits a moment, plans its shot for the
   * moment it will play it (moving obstacles included) within a small per-tick time budget, then shoots.
   */
  function think(m, p) {
    if (p.finished || !p.ball || p.ball.moving || p.ball.frozen) { p.plan = null; return; }
    if (!p.plan) {
      // Maybe use an item first.
      if (p.inventory.length && m.settings.powerups && m.rng() < 0.5 && m.t - p.lastUseAt > 3) {
        var def = Powerups.BY_ID[p.inventory[0]];
        var targets = m.players.filter(function (q) { return q !== p && !q.finished && (q.connected || q.bot); });
        var target = def.target === 'opponent' ? targets[Math.floor(m.rng() * targets.length)] : p;
        if (target && m.command(p.id, { type: 'use', slot: 0, target: target.id }).ok) return;
      }
      var turbo = m.hasEffect(p, 'turbo') ? Powerups.BY_ID.turbo.shotPower : 1;
      var at = m.t + 1.4 + m.rng() * 1.4;
      p.plan = { at: at, pl: planner(m.world, p.ball, at, { rng: m.rng, strength: { soft: 0.82, normal: 1, strong: 1.18 }[m.settings.strength], turbo: turbo }) };
      return;
    }
    var plan = p.plan;
    if (!plan.pl.done) {
      // Each match shares a few milliseconds of planning per tick between its bots.
      var budget = m.botBudget == null ? 3 : m.botBudget, start = now(), n = 0;
      if (budget === Infinity) plan.pl.step(1e9);
      else do { plan.pl.step(1); n++; } while (!plan.pl.done && now() - start < budget / Math.max(1, m.botCount || 1));
      if (!plan.pl.done) return;
    }
    if (m.t < plan.at) return;
    p.plan = null;
    var best = plan.pl.best;
    // Human-ish error: lower skill, wider spread.
    var err = 0.06 + (1 - p.skill) * 0.4;
    var th = best.th + (m.rng() - 0.5) * err;
    var pw = Math.min(1, Math.max(0.05, best.power * (1 + (m.rng() - 0.5) * err * 1.2)));
    var flip = m.hasEffect(p, 'reverse') ? -1 : 1; // bots read the warning too
    m.command(p.id, { type: 'shoot', dx: Math.sin(th) * flip, dz: -Math.cos(th) * flip, power: pw });
  }

  return { distanceField: distanceField, planner: planner, chooseShot: chooseShot, think: think };
});
