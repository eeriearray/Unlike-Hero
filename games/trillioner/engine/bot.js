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
        var d = s.pos && !s.room ? Math.hypot(s.pos.x - p.x, s.pos.z - p.z) : 0;
        if (s.room) { var rs = game.run.sites[s.room]; d = Math.hypot(rs.front.x - p.x, rs.front.z - p.z); }
        game.tick(d * ROAD / speedOf(p) + 2);
        if (game.over || game.frozen) continue;
        if (s.room) { var rs2 = game.run.sites[s.room]; p.x = rs2.front.x; p.z = rs2.front.z; }
        else if (s.pos) { p.x = s.pos.x; p.z = s.pos.z; }
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
  // A bot that knows every secret. Plan: open the routes, buy everything that does not earn, then buy earners and
  // knock them down, because a win needs income at or below zero and the fee is more spending.
  var KEYS = ['tuxedo', 'lobby_firm', 'brokers_licence', 'observatory_biz', 'fire_department', 'newspaper_biz', 'boatyard_biz', 'helicopter_company', 'mole_machine', 'diplomatic_pass', 'bank'];
  function knowsSecrets(game, p) {
    var i, s, list = game.run.secrets, ids = Object.keys(list);
    // 1. any secret whose gate passes, nearest first
    var bestS = null, bestD = 1e9;
    for (i = 0; i < ids.length; i++) {
      s = list[ids[i]];
      if (p.flags['s:' + ids[i]] || s.look === 'auto' || game.gateFails(p, s.gate)) continue;
      var d = s.pos ? Math.hypot(s.pos.x - p.x, s.pos.z - p.z) : 0;
      if (s.room) { var st = game.run.sites[s.room]; d = Math.hypot(st.front.x - p.x, st.front.z - p.z); }
      if (d < bestD) { bestD = d; bestS = ids[i]; }
    }
    if (bestS) return { discover: bestS };
    // 2. key purchases that open routes
    for (i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      if (p.owned[k] || p.goods[k] || game.stock[k] <= 0 || game.canBuy(p, k)) continue;
      var q0 = game.quoteFor(p, k);
      if (q0.ok) return { item: k };
    }
    // 3. what is left to spend on that does not earn
    var it = nextTarget(game, p, function (x) { return x.income <= 0; });
    if (it) return { item: it.id };
    // 4. out of non-earners: buy earners too, then demolish; the fee is extra spending and stops the income
    var earner = nextTarget(game, p, function (x) { return x.income > 0 && x.building; });
    if (earner) return { item: earner.id };
    for (var id in p.owned) {
      var o = p.owned[id], item = game.items[id];
      if (item.income > 0 && item.building && !o.closing && !o.demolished && p.balance >= game.demolishFee(p, id)) return { demolish: id };
    }
    // keys without a building still earn: outrun them with losses, or wait for the next window to open
    return { wait: 3 };
  }
  return { knowsSecrets: knowsSecrets, playDay: playDay, visibleOnly: visibleOnly, allEarners: allEarners, nextTarget: nextTarget, travel: travel, moveTo: moveTo, speedOf: speedOf, surfacePoint: surfacePoint };
});
