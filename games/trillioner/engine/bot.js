/*
 * Headless bots for the balance tool, the solver, and tests. They play through the real engine, with a travel model:
 * a walk or drive takes distance x 1.25 (streets are not straight) / speed, entering a room costs 1.5 seconds, and
 * a purchase costs 0.4 seconds. Battle Spend bots use the same decision helpers.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./data/rules.js'));
  else root.TrillionerBot = factory(root.TrillionerEngine, root.TRD.rules);
})(typeof self !== 'undefined' ? self : this, function (Engine, R) {
  'use strict';
  var FOOT = 18, CAR = 45, HELI = 60, ROAD = 1.25;

  function surfacePoint(run, id) {
    var it = run.items[id], s = run.sites[it.site], p = run.padPos[id];
    if (s.kind === 'room' && !it.outside) return { x: s.front.x, z: s.front.z, y: s.y, room: true };
    return p;
  }
  function speedOf(p) { return p.vehicles.helicopter ? HELI : p.vehicles.sports_car ? CAR : p.vehicles.scooter ? 32 : FOOT; }
  function travel(game, p, id) {
    var pt = surfacePoint(game.run, id), dist = Math.hypot(pt.x - p.x, pt.z - p.z);
    return (dist > 0.1 ? dist * ROAD / speedOf(p) : 0) + (pt.room ? 1.5 : 0) + 0.4;
  }
  function moveTo(game, p, id) { var pt = surfacePoint(game.run, id); p.x = pt.x; p.z = pt.z; p.y = pt.y || 0; }

  /** Greedy: from candidates, take the best value per second of travel, biggest first. */
  function nextTarget(game, p, canTake) {
    var best = null, bestScore = -1;
    for (var i = 0; i < game.run.list.length; i++) {
      var it = game.run.list[i];
      if (game.stock[it.id] <= 0) continue;
      if (!canTake(it)) continue;
      if (game.canBuy(p, it.id)) continue;
      var q = game.quoteFor(p, it.id);
      if (!q.ok) continue;
      var score = it.price / (travel(game, p, it.id) + 2);
      if (score > bestScore) { bestScore = score; best = it; }
    }
    return best;
  }

  /** Runs a whole day. strategy(game, p) returns { item } to buy, { wait: s }, or { demolish: id }. */
  function playDay(seed, strategy, opts) {
    opts = opts || {};
    var game = new Engine.Game({ seed: seed, mode: opts.mode || 'day' }), p = game.players.p1, guard = 0;
    while (!game.over && guard++ < 200000) {
      if (game.frozen) { game.finish(p, game.isPerfect(p) ? 'perfect' : 'win'); break; }
      var act = strategy(game, p) || { wait: 5 };
      if (act.item) {
        game.tick(travel(game, p, act.item));
        if (game.over || game.frozen) continue;
        moveTo(game, p, act.item);
        game.buy('p1', act.item);
      } else if (act.demolish) {
        game.tick(2);
        if (game.over || game.frozen) continue;
        game.demolish('p1', act.demolish);
      } else if (act.discover) {
        var s = game.run.secrets[act.discover];
        var d = s.pos ? Math.hypot(s.pos.x - p.x, s.pos.z - p.z) : 0;
        game.tick(d * ROAD / speedOf(p) + 2);
        if (game.over || game.frozen) continue;
        if (s.pos) { p.x = s.pos.x; p.z = s.pos.z; }
        game.discover('p1', act.discover);
      } else game.tick(act.wait || 5);
    }
    return { game: game, player: p, result: game.result, spent: p.spent, left: p.balance, won: p.won, ms: game.t, income: game.bizIncome(p), demolished: p.stats.demolished };
  }

  /** Buys only what is on open sale from the start: no gates, no secrets. */
  function visibleOnly(game, p) {
    var it = nextTarget(game, p, function (x) { return !x.gate && !x.secret; });
    return it ? { item: it.id } : { wait: 30 };
  }
  /** Buys every business that earns money and never demolishes. Spends the rest of the time on open goods. */
  function allEarners(game, p) {
    var it = nextTarget(game, p, function (x) { return x.income > 0; });
    if (it) return { item: it.id };
    it = nextTarget(game, p, function (x) { return !x.income; });
    return it ? { item: it.id } : { wait: 30 };
  }
  return { playDay: playDay, visibleOnly: visibleOnly, allEarners: allEarners, nextTarget: nextTarget, travel: travel, moveTo: moveTo, speedOf: speedOf, surfacePoint: surfacePoint };
});
