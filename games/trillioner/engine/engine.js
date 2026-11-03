/*!
 * Trillioner engine: ledger, clock, Frenzy, income, purchases, win rules, viewFor(id).
 *
 * One file, two homes:
 *   - Node (server/index.mjs, tools/, tests) runs it directly.
 *   - Browsers load it as a classic <script> (window.TrillionerEngine) for solo play.
 *
 * Pure and deterministic: same seed plus same commands gives the same result. No three.js, DOM, or Math.random.
 * Time advances only through tick(dt). Money is integer cents, always.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./rng.js'), require('./data/rules.js'), require('./shuffle.js'), require('./data/trophies.js'), require('./data/events.js'));
  } else {
    root.TrillionerEngine = factory(root.TrillionerRng, root.TRD.rules, root.TrillionerShuffle, root.TRD.trophies, root.TRD.events);
  }
})(typeof self !== 'undefined' ? self : this, function (RngMod, R, Shuffle, Trophies, EventsData) {
  'use strict';

  var fmtShort = function (c) {
    var d = c / 100;
    if (d >= 1e12) return '$' + (d / 1e12).toFixed(2) + 'T';
    if (d >= 1e9) return '$' + (d / 1e9).toFixed(d >= 1e11 ? 0 : 1) + 'B';
    if (d >= 1e6) return '$' + (d / 1e6).toFixed(d >= 1e8 ? 0 : 1) + 'M';
    if (d >= 1e3) return '$' + (d / 1e3).toFixed(d >= 1e5 ? 0 : 1) + 'K';
    return '$' + d.toFixed(2);
  };

  /** Frenzy pricing. Pure so pads, bots, server and tests all quote the same number. */
  function quote(base, frenzy, balance) {
    if (base < R.FRENZY_MIN) return { base: base, mult: 1, extra: 0, total: base, ok: balance >= base };
    for (var m = frenzy; m >= 1; m--) {
      var extra = Math.min(base * (m - 1), R.FRENZY_EXTRA_CAP);
      if (base + extra <= balance) return { base: base, mult: m, extra: extra, total: base + extra, ok: true };
    }
    return { base: base, mult: 1, extra: 0, total: base, ok: false };
  }

  function closeMs(price) {
    if (price < R.BIG_DEAL) return 0;
    var f = Math.min(1, (price - R.BIG_DEAL) / (R.CLOSE_FULL_AT - R.BIG_DEAL));
    return Math.round(R.CLOSE_MIN_MS + f * (R.CLOSE_MAX_MS - R.CLOSE_MIN_MS));
  }

  function hourIn(hour, win) {
    var a = win[0], b = win[1];
    return a <= b ? (hour >= a && hour < b) : (hour >= a || hour < b);
  }

  function Game(opts) {
    opts = opts || {};
    this.seed = opts.seed != null ? opts.seed : 1;
    this.mode = opts.mode || 'day';
    this.cfg = R.MODES[this.mode];
    this.requireNear = !!opts.requireNear;
    this.run = Shuffle.buildRun(this.seed);
    this.items = this.run.items;
    this.stock = {};
    for (var id in this.items) this.stock[id] = this.items[id].stock;
    this.t = 0;              // elapsed run time, ms
    this.acc = 0;            // unconsumed tick time, ms
    this.frozen = false;     // Perfect Zero window: clock and economy stop
    this.over = false;
    this.winner = null;
    this.players = {};
    this.order = [];
    this.feed = [];
    this.active = [];        // running events: {id, leftMs, data}
    this.eventQueue = (this.run.events || []).slice();
    this.fired = {};
    this.lastHourSample = -1;
    (opts.players || [{ id: 'p1', name: 'You' }]).forEach(this.addPlayer, this);
  }
  var G = Game.prototype;

  G.addPlayer = function (info) {
    var p = {
      id: info.id, name: info.name || 'Player', bot: !!info.bot,
      balance: this.cfg.start, spent: 0, rem: 0,
      owned: {}, goods: {}, vehicles: {}, gear: {}, powers: {}, flags: {}, wear: {},
      closings: [], frenzy: 1, frenzyLeft: 0,
      cannonOn: false, cannonUsed: 0,
      history: [this.cfg.start], best: null, trophies: {}, stats: { purchases: 0, demolished: 0, firstMoonHour: null, maxFrenzy: 1, truckDemos: 0 },
      income: 0, lastIncome: 0, rising: false, boost: {}, ban: {}, cards: [], cardsUsed: 0, giftUsed: false,
      x: this.run.spawn.x, y: this.run.spawn.y, z: this.run.spawn.z, h: 0, inv: null,
      travelCd: 0, won: false, perfect: false, perfectLeft: 0, events: [], district: 'downtown', visited: { downtown: true }, finished: false
    };
    this.players[p.id] = p;
    this.order.push(p.id);
    return p;
  };

  // ───────────── clock ─────────────
  G.hourNow = function () { return (this.cfg.startHour + this.t / 1000 / this.cfg.secPerHour) % 24; };
  G.dayLengthMs = function () { return this.cfg.hours * this.cfg.secPerHour * 1000; };
  G.setClockHour = function (h) { // debug and Free Roam only
    var from = this.cfg.startHour, d = ((h - from) % 24 + 24) % 24;
    this.t = d * this.cfg.secPerHour * 1000;
  };
  G.weather = function () {
    var w = this.run.fog || [], nowH = this.t / 1000 / this.cfg.secPerHour;
    for (var i = 0; i < w.length; i++) if (nowH >= w[i][0] && nowH < w[i][1]) return 'fog';
    var r = this.run.rain || [];
    for (i = 0; i < r.length; i++) if (nowH >= r[i][0] && nowH < r[i][1]) return 'rain';
    return 'clear';
  };

  // ───────────── income ─────────────
  G.bizIncome = function (p) {
    var sum = 0;
    for (var id in p.owned) {
      var o = p.owned[id];
      if (o.closing || o.demolished) continue;
      var inc = this.items[id].income || 0;
      if (p.boost[id] > 0 && inc < 0) inc = -inc;
      sum += inc;
    }
    return sum;
  };
  G.boomActive = function () { return this.active.some(function (a) { return a.id === 'boom'; }); };
  G.interestPerS = function (p) { return p.balance >= R.INTEREST_FLOOR ? Math.floor(p.balance / R.INTEREST_DIV) * 10 : 0; };
  G.totalIncome = function (p) { return this.bizIncome(p) * (this.boomActive() ? 3 : 1) + this.interestPerS(p); };

  // ───────────── time ─────────────
  G.tick = function (dt) {
    if (this.over) return;
    this.acc += dt * 1000;
    while (this.acc >= R.STEP_MS && !this.over) { this.acc -= R.STEP_MS; this.step(); }
  };

  G.step = function () {
    var self = this;
    if (this.frozen) { this.stepPerfect(); return; }
    this.t += R.STEP_MS;
    this.runEvents();
    this.active = this.active.filter(function (a) { a.leftMs -= R.STEP_MS; if (a.leftMs <= 0) self.endEvent(a); return a.leftMs > 0; });
    var boom = this.boomActive() ? 3 : 1;
    for (var i = 0; i < this.order.length; i++) {
      var p = this.players[this.order[i]];
      this.stepPlayer(p, boom);
      if (this.over) return;
    }
    var hr = Math.floor(this.t / 15000);
    if (hr !== this.lastHourSample) {
      this.lastHourSample = hr;
      this.order.forEach(function (id) { self.players[id].history.push(self.players[id].balance); });
    }
    if (this.cfg.clock && this.t >= this.dayLengthMs()) this.endDay();
    else if (!this.cfg.clock && this.t >= this.dayLengthMs()) this.t -= this.dayLengthMs();
  };

  G.stepPlayer = function (p, boom) {
    // interest: exact integer division with the remainder carried forward
    if (p.balance >= R.INTEREST_FLOOR) {
      p.rem += p.balance % R.INTEREST_DIV;
      var gain = Math.floor(p.balance / R.INTEREST_DIV);
      if (p.rem >= R.INTEREST_DIV) { gain += 1; p.rem -= R.INTEREST_DIV; }
      p.balance += gain;
    }
    // business income: income tables are multiples of 10 cents per second, so per-step values are whole cents
    var biz = this.bizIncome(p) * boom / 10;
    if (biz) p.balance = Math.max(0, p.balance + biz);
    // closings
    for (var i = p.closings.length - 1; i >= 0; i--) {
      var c = p.closings[i];
      c.leftMs -= R.STEP_MS;
      if (c.leftMs <= 0) { p.closings.splice(i, 1); this.closeDeal(p, c.item); }
    }
    // frenzy
    if (p.frenzyLeft > 0) { p.frenzyLeft -= R.STEP_MS; if (p.frenzyLeft <= 0) { p.frenzyLeft = 0; p.frenzy = 1; } }
    // money cannon
    if (p.cannonOn) {
      var shot = Math.min(R.CANNON_PER_S / 10, R.CANNON_CAP - p.cannonUsed, p.balance);
      if (shot <= 0) { p.cannonOn = false; this.emit(p, { type: 'cannonEmpty' }); }
      else { p.balance -= shot; p.spent += shot; p.cannonUsed += shot; }
    }
    for (var k in p.boost) if (p.boost[k] > 0) p.boost[k] -= R.STEP_MS;
    for (k in p.ban) if (p.ban[k] > 0) p.ban[k] -= R.STEP_MS;
    if (p.travelCd > 0) p.travelCd -= R.STEP_MS;
    if (this.t % 1000 === 0) this.checkTrophies(p);
    this.checkWin(p);
  };

  // Clock and economy are frozen; only the window and purchases move.
  G.stepPerfect = function () {
    for (var i = 0; i < this.order.length; i++) {
      var p = this.players[this.order[i]];
      if (!p.won || p.finished) continue;
      p.perfectLeft -= R.STEP_MS;
      if (this.isPerfect(p)) return this.finish(p, 'perfect');
      if (p.perfectLeft <= 0) return this.finish(p, 'win');
    }
  };

  G.isPerfect = function (p) { return p.balance === 0 && this.bizIncome(p) === 0 && p.closings.length === 0; };

  // Deals still closing can change income, so nobody wins until they settle.
  G.checkWin = function (p) {
    if (!this.cfg.clock || this.over || p.won) return;
    if (p.balance >= R.WIN_BELOW || this.bizIncome(p) > 0 || p.closings.length) return;
    p.won = true;
    p.cannonOn = false;
    this.say(p.name + ' is FLAT BROKE!', 'win');
    this.award(p, 'flat_broke');
    if (this.cfg.pvp) return this.finish(p, 'win');
    if (this.isPerfect(p)) return this.finish(p, 'perfect');
    this.frozen = true;
    p.perfectLeft = R.PERFECT_WINDOW_MS;
    this.emit(p, { type: 'won' });
  };

  /** End the Perfect Zero window early and bank the plain win. */
  G.finish = function (p, result) {
    if (this.over) return;
    if (result === 'perfect') { p.perfect = true; this.award(p, 'perfect_zero'); }
    p.finished = true;
    this.frozen = false;
    this.over = true;
    this.winner = p.id;
    this.result = result;
    this.broadcast({ type: 'over', result: result, winner: p.id });
  };

  G.endDay = function () {
    if (this.over) return;
    var best = null, self = this;
    this.order.forEach(function (id) { var p = self.players[id]; self.checkTrophies(p); if (!best || p.balance < best.balance) best = p; });
    this.over = true;
    this.result = 'timeup';
    this.winner = this.cfg.pvp ? best.id : null;
    this.broadcast({ type: 'over', result: 'timeup', winner: this.winner });
  };

  // ───────────── events ─────────────
  G.runEvents = function () {
    var q = this.eventQueue, nowH = this.t / 1000 / this.cfg.secPerHour;
    while (q.length && q[0].atHour <= nowH) this.startEvent(q.shift());
  };
  G.startEvent = function (ev) {
    var def = EventsData.EVENTS.filter(function (e) { return e.id === ev.id; })[0], self = this;
    if (ev.id === 'refund') {
      this.order.forEach(function (id) {
        var p = self.players[id];
        if (p.won) return;
        var add = Math.min(Math.floor(p.spent * R.TAX_REFUND_RATE), R.TAX_REFUND_CAP);
        p.balance += add;
        self.emit(p, { type: 'refund', amount: add });
      });
    } else {
      this.active.push({ id: ev.id, leftMs: def.secs * 1000, site: ev.site || null, deal: ev.deal || null });
      if (ev.deal) { this.stock[ev.deal] = 1; }
    }
    this.say(def.text, 'event');
    this.broadcast({ type: 'cityEvent', id: ev.id, text: def.text, site: ev.site || null, deal: ev.deal || null });
  };
  G.endEvent = function (a) {
    if (a.deal && this.stock[a.deal] > 0) this.stock[a.deal] = 0;
    this.broadcast({ type: 'cityEventEnd', id: a.id, deal: a.deal });
  };
  G.fireSaleOn = function (item) {
    return this.active.some(function (a) { return a.id === 'firesale' && a.site === item.site; });
  };
  G.basePrice = function (item) { return this.fireSaleOn(item) ? Math.round(item.price / 2) : item.price; };

  // ───────────── gates ─────────────
  // A gate is a list of tests that must all pass: {own}, {flag}, {hours}, {weather}, {wear}, {event}.
  G.gateFails = function (p, gate) {
    if (!gate) return null;
    for (var i = 0; i < gate.length; i++) {
      var g = gate[i];
      if (g.own && !this.isOwned(p, g.own)) return g;
      if (g.flag && !p.flags[g.flag]) return g;
      if (g.hours && !hourIn(this.hourNow(), g.hours)) return g;
      if (g.weather && this.weather() !== g.weather) return g;
      if (g.wear && !p.wear[g.wear]) return g;
      if (g.window) {
        var nowH = this.t / 1000 / this.cfg.secPerHour, win = this.run.windows[g.window];
        if (!win || nowH < win[0] || nowH >= win[1]) return g;
      }
    }
    return null;
  };
  G.isOwned = function (p, id) {
    var o = p.owned[id];
    if (o) return !o.closing && !o.demolished;
    return !!p.goods[id];
  };
  /** Secret pads stay out of sight until their flag is set. */
  G.padVisible = function (p, item) {
    if (item.secret && !p.flags[item.secret]) return false;
    return true;
  };

  // ───────────── purchases ─────────────
  G.quoteFor = function (p, id) {
    var item = this.items[id];
    return quote(this.basePrice(item), p.frenzy, p.balance);
  };

  G.nearPad = function (p, id) {
    if (!this.requireNear) return true;
    var pos = this.run.padPos[id];
    if (!pos) return true;
    var dx = p.x - pos.x, dy = p.y - pos.y, dz = p.z - pos.z;
    return dx * dx + dz * dz <= R.PAD_REACH * R.PAD_REACH && Math.abs(dy) < 30;
  };

  G.canBuy = function (p, id) {
    var item = this.items[id];
    if (!item) return { code: 'unknown', error: 'No such item.' };
    if (this.over) return { code: 'over', error: 'The day is over.' };
    if (this.stock[id] <= 0) return { code: 'sold', error: 'Sold out.' };
    if (p.ban[item.site] > 0) return { code: 'banned', error: 'This shop has banned you!' };
    if (!this.padVisible(p, item)) return { code: 'hidden', error: 'Nothing here.' };
    var fail = this.gateFails(p, item.gate);
    if (fail) return { code: 'locked', error: fail.why || 'Locked.', gate: fail };
    if (!this.nearPad(p, id)) return { code: 'far', error: 'You are too far away.' };
    return null;
  };

  G.buy = function (pid, id) {
    var p = this.players[pid], no = this.canBuy(p, id);
    if (no) return no;
    var item = this.items[id], q = this.quoteFor(p, id);
    if (!q.ok) return { code: 'broke', error: 'Too expensive' };
    this.charge(p, item, q);
    return { ok: true, paid: q.total, mult: q.mult, extra: q.extra };
  };

  G.charge = function (p, item, q) {
    p.balance -= q.total;
    p.spent += q.total;
    this.stock[item.id] -= 1;
    p.stats.purchases += 1;
    if (!p.best || q.base > p.best.base) p.best = { item: item.id, name: item.name, base: q.base };
    this.bumpFrenzy(p, q.base);
    var ms = p.powers.instantClose ? 0 : closeMs(q.base);
    if (item.building || item.income || item.reward || item.power) {
      p.owned[item.id] = { paid: q.base, closing: ms > 0, demolished: false, at: this.t };
    } else {
      p.goods[item.id] = (p.goods[item.id] || 0) + 1;
    }
    if (ms > 0) p.closings.push({ item: item.id, leftMs: ms, total: ms });
    else this.applyReward(p, item);
    this.afterPurchase(p, item, q, ms);
    this.broadcast({ type: 'purchase', pid: p.id, item: item.id, paid: q.total, base: q.base, mult: q.mult, closing: ms, stock: this.stock[item.id] });
    if (q.base >= 1 * R.B || this.cfg.pvp) this.feedPush(p.name + ' bought ' + item.name + ' for ' + fmtShort(q.total));
    this.checkTrophies(p);
    this.checkWin(p);
  };

  // Chain rule (see docs/DESIGN.md, Decisions): a qualifying purchase within the window climbs one step
  // and the next one pays that multiplier. The chain resets to x1 only when the window runs out.
  G.bumpFrenzy = function (p, base) {
    if (base < R.FRENZY_MIN) return;
    if (p.frenzyLeft > 0) p.frenzy = Math.min(R.FRENZY_MAX, p.frenzy + 1);
    p.frenzyLeft = this.frenzyWindow();
    p.stats.maxFrenzy = Math.max(p.stats.maxFrenzy, p.frenzy);
  };
  G.frenzyWindow = function () {
    return this.active.some(function (a) { return a.id === 'spree'; }) ? R.FRENZY_SPREE_MS : R.FRENZY_WINDOW_MS;
  };

  G.closeDeal = function (p, id) {
    var o = p.owned[id];
    if (o) o.closing = false;
    this.applyReward(p, this.items[id]);
    this.emit(p, { type: 'closed', item: id });
    this.checkTrophies(p);
  };

  G.applyReward = function (p, item) {
    var r = item.reward;
    if (item.power) p.powers[item.power] = true;
    if (item.grants) for (var i = 0; i < item.grants.length; i++) p.flags[item.grants[i]] = true;
    if (item.wearable) p.wear[item.wearable] = true;
    if (r) {
      (r.vehicles || []).forEach(function (v) { p.vehicles[v] = true; });
      (r.gear || []).forEach(function (g) { p.gear[g] = true; });
      this.emit(p, { type: 'reward', item: item.id, vehicles: r.vehicles || [], gear: r.gear || [] });
    }
    if (item.hint) this.emit(p, { type: 'hint', text: item.hint, item: item.id });
  };

  G.afterPurchase = function (p, item, q, ms) {
    if (item.id === 'moon_land' && this.t < 6 * 60000) p.stats.moonBeforeBreakfast = true;
  };

  /** "Buy the whole store": everything left and unlocked at one site, as one purchase. */
  G.buyStore = function (pid, site) {
    var p = this.players[pid], self = this, list = [], sum = 0;
    if (this.over) return { code: 'over', error: 'The day is over.' };
    (this.run.sites[site] || { items: [] }).items.forEach(function (id) {
      var it = self.items[id];
      if (it.kind !== 'good' || self.stock[id] <= 0 || self.canBuy(p, id)) return;
      list.push(id);
      sum += self.basePrice(it) * self.stock[id];
    });
    if (!list.length) return { code: 'sold', error: 'Nothing left to buy here.' };
    var q = quote(sum, p.frenzy, p.balance);
    if (!q.ok) return { code: 'broke', error: 'Too expensive' };
    p.balance -= q.total;
    p.spent += q.total;
    p.stats.purchases += 1;
    p.stats.storesBought = (p.stats.storesBought || 0) + 1;
    list.forEach(function (id) { p.goods[id] = (p.goods[id] || 0) + self.stock[id]; self.stock[id] = 0; self.broadcast({ type: 'stock', item: id, stock: 0 }); });
    if (!p.best || q.base > p.best.base) p.best = { item: site, name: 'All of ' + this.run.sites[site].name, base: q.base };
    this.bumpFrenzy(p, q.base);
    this.broadcast({ type: 'purchase', pid: p.id, store: site, item: list[0], paid: q.total, base: q.base, mult: q.mult, closing: 0, stock: 0 });
    this.feedPush(p.name + ' bought all of ' + this.run.sites[site].name + ' for ' + fmtShort(q.total));
    this.checkTrophies(p);
    this.checkWin(p);
    return { ok: true, paid: q.total, mult: q.mult, count: list.length };
  };

  /** A fountain takes whatever loose change is left under a quarter, so an exact $0.00 is always possible. */
  G.toss = function (pid) {
    var p = this.players[pid], c = p.balance % R.CHANGE_FEES[0];
    if (p.balance >= R.WIN_BELOW && !p.won) return { code: 'big', error: 'The fountain only takes pocket change.' };
    if (!c) return { code: 'none', error: 'No loose change.' };
    p.balance -= c;
    p.spent += c;
    this.checkWin(p);
    return { ok: true, paid: c };
  };

  // ───────────── demolition ─────────────
  G.demolishFee = function (p, id, withTruck) {
    var o = p.owned[id], fee = Math.round(o.paid * R.DEMOLISH_FEE);
    if (withTruck) fee = Math.round(fee * (1 - R.TRUCK_DISCOUNT));
    return fee;
  };
  G.demolish = function (pid, id, withTruck) {
    var p = this.players[pid], o = p.owned[id], item = this.items[id];
    if (!o || !item || !item.building) return { code: 'notowned', error: 'You do not own that building.' };
    if (o.closing) return { code: 'closing', error: 'The deal has not closed yet.' };
    if (o.demolished) return { code: 'rubble', error: 'Already rubble.' };
    var truck = !!withTruck && !!p.vehicles.wrecking_truck;
    var fee = this.demolishFee(p, id, truck);
    if (p.balance < fee) return { code: 'broke', error: 'Too expensive' };
    p.balance -= fee;
    p.spent += fee;
    o.demolished = true;
    if (item.power) delete p.powers[item.power];
    if (item.grants) for (var i = 0; i < item.grants.length; i++) delete p.flags[item.grants[i]];
    p.stats.demolished += 1;
    if (truck) p.stats.truckDemos += 1;
    this.broadcast({ type: 'demolish', pid: p.id, item: id, fee: fee });
    this.feedPush(p.name + ' demolished ' + item.name);
    this.checkTrophies(p);
    this.checkWin(p);
    return { ok: true, fee: fee };
  };

  // ───────────── secrets ─────────────
  G.discover = function (pid, sid) {
    var p = this.players[pid], s = this.run.secrets[sid];
    if (!s) return { code: 'unknown', error: 'Nothing here.' };
    if (p.flags['s:' + sid]) return { ok: true, already: true };
    var fail = this.gateFails(p, s.gate);
    if (fail) return { code: 'locked', error: fail.why || 'Locked.', gate: fail };
    p.flags['s:' + sid] = true;
    (s.opens || []).forEach(function (f) { p.flags[f] = true; });
    this.emit(p, { type: 'secret', id: sid, name: s.name, clue: s.clueText || null, note: s.note || null });
    this.feedPush(p.name + ' found a secret');
    this.checkTrophies(p);
    return { ok: true, clue: s.clueText || null };
  };

  // ───────────── gear ─────────────
  G.setCannon = function (pid, on) {
    var p = this.players[pid];
    if (!p.gear.money_cannon) return { code: 'nogear', error: 'You do not have a money cannon.' };
    if (on && p.cannonUsed >= R.CANNON_CAP) return { code: 'empty', error: 'The cannon has hit its limit.' };
    p.cannonOn = !!on;
    return { ok: true };
  };
  G.fastTravel = function (pid, district) {
    var p = this.players[pid];
    if (!p.powers.fastTravel) return { code: 'nopower', error: 'You need the Airline.' };
    if (!p.visited[district]) return { code: 'unvisited', error: 'You have not been there yet.' };
    if (p.travelCd > 0) return { code: 'cooldown', error: 'The next flight is not ready.' };
    p.travelCd = R.FAST_TRAVEL_CD_MS;
    return { ok: true, to: this.run.districtSpawn[district] };
  };
  G.setPos = function (pid, x, y, z, h, inv, district) {
    var p = this.players[pid];
    if (!p || typeof x !== 'number' || typeof z !== 'number' || !isFinite(x) || !isFinite(y) || !isFinite(z)) return;
    p.x = x; p.y = y; p.z = z; p.h = h || 0; p.inv = inv || null;
    if (district && !p.visited[district]) { p.visited[district] = true; this.checkTrophies(p); }
    if (district) p.district = district;
  };

  // ───────────── trophies ─────────────
  G.checkTrophies = function (p) {
    if (!this.cfg.trophies) return;
    var list = Trophies.TROPHIES, ctx = { game: this, R: R };
    for (var i = 0; i < list.length; i++) {
      var tr = list[i];
      if (p.trophies[tr.id] || tr.manual) continue;
      if (tr.spent != null ? p.spent >= tr.spent : tr.test(p, ctx)) this.award(p, tr.id);
    }
  };
  G.award = function (p, id) {
    if (p.trophies[id] || !this.cfg.trophies) return;
    p.trophies[id] = true;
    this.emit(p, { type: 'trophy', id: id });
  };
  G.clout = function (p) {
    var c = Math.max(1, Math.floor(p.spent / R.B));
    if (p.won) c += 200;
    if (p.perfect) c += 500;
    return c;
  };
  G.rank = function (p) {
    var r = R.RANKS[0];
    for (var i = 0; i < R.RANKS.length; i++) if (p.spent >= R.RANKS[i].at) r = R.RANKS[i];
    return r.name;
  };

  // ───────────── plumbing ─────────────
  G.emit = function (p, ev) { p.events.push(ev); };
  G.broadcast = function (ev) { for (var i = 0; i < this.order.length; i++) this.players[this.order[i]].events.push(ev); };
  G.say = function (text, kind) { this.feedPush(text, kind); };
  G.feedPush = function (text, kind) { this.feed.push({ text: text, kind: kind || 'buy', t: this.t }); if (this.feed.length > 24) this.feed.shift(); };
  G.drain = function (pid) { var p = this.players[pid], e = p.events; p.events = []; return e; };

  /** What leaves the engine for one player. Online, this is all the player ever receives. */
  G.viewFor = function (pid) {
    var p = this.players[pid], self = this, biz = this.bizIncome(p) * (this.boomActive() ? 3 : 1), int = this.interestPerS(p), total = biz + int;
    var view = {
      mode: this.mode, t: this.t, hour: this.hourNow(), dayMs: this.dayLengthMs(), frozen: this.frozen, over: this.over,
      result: this.result || null, winner: this.winner, weather: this.weather(), active: this.active.map(function (a) { return { id: a.id, leftMs: a.leftMs, site: a.site, deal: a.deal }; }),
      me: {
        id: p.id, name: p.name, balance: p.balance, spent: p.spent, biz: biz, interest: int, income: total,
        frenzy: p.frenzy, frenzyLeft: p.frenzyLeft, frenzyWindow: this.frenzyWindow(), closings: p.closings, owned: p.owned, goods: p.goods,
        vehicles: p.vehicles, gear: p.gear, powers: p.powers, flags: p.flags, wear: p.wear, trophies: p.trophies, rank: this.rank(p),
        cannonOn: p.cannonOn, cannonUsed: p.cannonUsed, won: p.won, perfect: p.perfect, perfectLeft: p.perfectLeft, travelCd: p.travelCd,
        visited: p.visited, best: p.best, stats: p.stats, cards: p.cards, ban: p.ban, boost: p.boost
      },
      feed: this.feed.slice(-6)
    };
    if (this.cfg.pvp) {
      view.board = this.order.map(function (id) {
        var o = self.players[id];
        return { id: o.id, name: o.name, bot: o.bot, balance: o.balance, spent: o.spent, x: o.x, y: o.y, z: o.z, h: o.h, inv: o.inv, connected: o.connected !== false };
      });
    }
    return view;
  };

  return { Game: Game, quote: quote, closeMs: closeMs, hourIn: hourIn, fmtShort: fmtShort, R: R };
});
