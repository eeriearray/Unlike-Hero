/*!
 * Trillioner engine: ledger, clock, Frenzy, income, purchases, win rules, viewFor(id).
 *
 * One file, two homes:
 *   - Node (server/index.mjs, tools/, tests) runs it directly.
 *   - Browsers load it as a classic <script> (window.TrillionerEngine) for solo play.
 *
 * Pure and deterministic: same seed plus same commands gives the same result. No three.js, no DOM, no unseeded randomness.
 * Time advances only through tick(dt). Money is integer cents, always.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./rng.js'), require('./data/rules.js'), require('./shuffle.js'), require('./data/trophies.js'), require('./data/events.js'), require('./data/secrets.js'));
  } else {
    root.TrillionerEngine = factory(root.TrillionerRng, root.TRD.rules, root.TrillionerShuffle, root.TRD.trophies, root.TRD.events, root.TRD.secrets);
  }
})(typeof self !== 'undefined' ? self : this, function (RngMod, R, Shuffle, Trophies, EventsData, SecretsData) {
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
    for (var id in this.items) this.stock[id] = this.items[id].surprise ? 0 : this.items[id].stock;
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
    if (this.cfg.pvp) this.setupBattle();
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

  // ───────────── Battle Spend ─────────────
  G.setupBattle = function () {
    var r = new RngMod.Rng((typeof this.seed === 'number' ? this.seed : RngMod.hash(this.seed)) ^ 0x51ed), self = this;
    this.auctions = EventsData.SURPRISE_DEALS.slice(0, 8).map(function (d, i) { return d; });
    this.auctions = r.shuffle(this.auctions).slice(0, 3).map(function (d, i) {
      return { id: 'a' + i, name: d.name, min: d.price * R.B, at: (60 + i * 130 + r.int(40)) * 1000, ms: 40000, state: 'wait', bids: {}, best: null, bestBid: 0, winner: null };
    });
    var spots = [];
    Object.keys(this.run.sites).forEach(function (k) { var s = self.run.sites[k]; if (s.kind === 'change' && s.y === 0) spots.push({ x: s.s.x + 16, y: 0, z: s.s.z - 4 }); });
    [[-30, -30], [30, -30], [-200, 0], [-60, 200], [200, 150], [200, -160], [0, -200], [240, 30]].forEach(function (p) { spots.push({ x: p[0], y: 0, z: p[1] }); });
    var kinds = ['boost', 'ban', 'refund', 'gift'];
    this.cardSpots = r.shuffle(spots).slice(0, 12).map(function (s, i) { return { id: 'c' + i, x: s.x, y: s.y, z: s.z, kind: kinds[i % kinds.length], taken: false }; });
    this.gifts = [];
  };
  G.stepBattle = function () {
    var self = this;
    (this.auctions || []).forEach(function (a) {
      if (a.state === 'wait' && self.t >= a.at) { a.state = 'open'; a.left = a.ms; self.say('AUCTION OPEN: ' + a.name + ' (from ' + fmtShort(a.min) + ')', 'event'); self.broadcast({ type: 'auction', id: a.id, name: a.name, min: a.min }); }
      else if (a.state === 'open') { a.left -= R.STEP_MS; if (a.left <= 0) self.closeAuction(a); }
    });
    this.gifts = (this.gifts || []).filter(function (g) {
      g.left -= R.STEP_MS;
      if (g.left > 0) return true;
      var to = self.players[g.to], from = self.players[g.from];
      if (from.balance >= g.amount) { from.balance -= g.amount; from.spent += g.amount; to.balance += g.amount; self.feedPush(from.name + ' gifted ' + fmtShort(g.amount) + ' to ' + to.name); self.emit(to, { type: 'gifted', amount: g.amount, from: from.name }); }
      return false;
    });
  };
  // Highest bid pays. If the top bidder can no longer cover it, the next one gets it.
  G.closeAuction = function (a) {
    var self = this, order = Object.keys(a.bids).sort(function (x, y) { return a.bids[y] - a.bids[x]; });
    a.state = 'done';
    for (var i = 0; i < order.length; i++) {
      var p = this.players[order[i]], bid = a.bids[order[i]];
      if (p.balance >= bid) {
        p.balance -= bid; p.spent += bid; p.stats.purchases += 1; a.winner = p.id; a.winnerName = p.name; a.price = bid;
        p.goods[a.id] = 1;
        if (!p.best || bid > p.best.base) p.best = { item: a.id, name: a.name, base: bid };
        this.say(p.name + ' won ' + a.name + ' for ' + fmtShort(bid), 'event');
        this.broadcast({ type: 'auctionEnd', id: a.id, winner: p.id, price: bid, name: a.name });
        this.checkWin(p);
        return;
      }
    }
    this.say('No sale: ' + a.name, 'event');
    this.broadcast({ type: 'auctionEnd', id: a.id, winner: null, name: a.name });
  };
  G.bid = function (pid, id, amount) {
    var p = this.players[pid], a = (this.auctions || []).filter(function (x) { return x.id === id; })[0];
    amount = Math.floor(Number(amount));
    if (!a || a.state !== 'open') return { code: 'closed', error: 'That auction is not open.' };
    if (!Number.isSafeInteger(amount) || amount < a.min) return { code: 'low', error: 'The minimum bid is ' + fmtShort(a.min) + '.' };
    if (amount <= a.bestBid) return { code: 'low', error: 'Someone has bid more.' };
    if (amount > p.balance) return { code: 'broke', error: 'Too expensive' };
    a.bids[pid] = amount; a.bestBid = amount; a.best = p.name;
    this.broadcast({ type: 'bid', id: id, by: p.name, amount: amount });
    return { ok: true };
  };
  G.pickupCard = function (pid, id) {
    var p = this.players[pid], c = (this.cardSpots || []).filter(function (x) { return x.id === id; })[0];
    if (!c || c.taken) return { code: 'gone', error: 'Already taken.' };
    if (p.cardsUsed + p.cards.length >= 3) return { code: 'full', error: 'You can only use three cards in a match.' };
    if (this.requireNear && Math.hypot(p.x - c.x, p.z - c.z) > 12) return { code: 'far', error: 'You are too far away.' };
    c.taken = true;
    p.cards.push(c.kind);
    this.broadcast({ type: 'cardTaken', id: id, by: p.id });
    return { ok: true, kind: c.kind };
  };
  /** Attack cards. opts: { target, site } */
  G.playCard = function (pid, kind, opts) {
    opts = opts || {};
    var p = this.players[pid], t = this.players[opts.target], i = p.cards.indexOf(kind), self = this;
    if (i < 0) return { code: 'nocard', error: 'You do not have that card.' };
    if (!t || t.id === p.id) return { code: 'target', error: 'Pick a rival.' };
    if (kind === 'boost') {
      var losers = Object.keys(t.owned).filter(function (k) { return self.items[k].income < 0 && !t.owned[k].closing && !t.owned[k].demolished; });
      if (!losers.length) return { code: 'none', error: 'They have no losing company to boost.' };
      t.boost[losers[0]] = 60000;
      this.feedPush(p.name + ' played BOOST on ' + t.name);
      this.emit(t, { type: 'attacked', text: p.name + " made your " + this.items[losers[0]].name + ' profitable for 60 seconds!' });
    } else if (kind === 'ban') {
      var site = opts.site && this.run.sites[opts.site] ? opts.site : t.inv || null;
      if (!site) { site = Object.keys(this.run.sites).filter(function (k) { return self.run.sites[k].district === t.district && self.run.sites[k].items.length; })[0]; }
      if (!site) return { code: 'none', error: 'No shop to close.' };
      t.ban[site] = 45000;
      this.feedPush(p.name + ' played BAN on ' + t.name);
      this.emit(t, { type: 'attacked', text: p.name + ' got you banned from ' + this.run.sites[site].name + ' for 45 seconds!' });
    } else if (kind === 'refund') {
      t.balance += 3 * R.B;
      this.feedPush(p.name + ' played REFUND on ' + t.name);
      this.emit(t, { type: 'attacked', text: p.name + ' got you a $3B refund. How dare they.' });
    } else if (kind === 'gift') {
      if (p.giftUsed) return { code: 'used', error: 'Forced Gift is once per match.' };
      p.giftUsed = true;
      this.gifts.push({ id: 'g' + this.t, from: p.id, to: t.id, amount: 5 * R.B, left: 10000 });
      this.emit(t, { type: 'giftOffer', from: p.name, amount: 5 * R.B });
    } else return { code: 'nocard', error: 'Unknown card.' };
    p.cards.splice(i, 1);
    p.cardsUsed += 1;
    return { ok: true };
  };
  G.refuseGift = function (pid) {
    var p = this.players[pid], g = (this.gifts || []).filter(function (x) { return x.to === pid; })[0];
    if (!g) return { code: 'none', error: 'No gift to refuse.' };
    if (p.balance < R.REFUSE_FEE) return { code: 'broke', error: 'Too expensive' };
    p.balance -= R.REFUSE_FEE; p.spent += R.REFUSE_FEE;
    this.gifts = this.gifts.filter(function (x) { return x !== g; });
    this.feedPush(p.name + ' paid $1B to refuse a gift');
    return { ok: true };
  };

  /** Every client action goes through here, so server, bots and solo share one door. */
  G.command = function (pid, cmd) {
    if (!cmd || !this.players[pid]) return { error: 'Bad command.' };
    switch (cmd.t) {
      case 'buy': return this.buy(pid, String(cmd.item));
      case 'buyStore': return this.buyStore(pid, String(cmd.site));
      case 'demolish': return this.demolish(pid, String(cmd.item), !!cmd.truck);
      case 'discover': return this.discover(pid, String(cmd.id));
      case 'cannon': return this.setCannon(pid, !!cmd.on);
      case 'fastTravel': return this.fastTravel(pid, String(cmd.district));
      case 'toss': return this.toss(pid);
      case 'damage': return this.damage(pid, String(cmd.kind));
      case 'bid': return this.bid(pid, String(cmd.id), cmd.amount);
      case 'pickup': return this.pickupCard(pid, String(cmd.id));
      case 'play': return this.playCard(pid, String(cmd.kind), { target: String(cmd.target), site: cmd.site ? String(cmd.site) : null });
      case 'refuse': return this.refuseGift(pid);
      default: return { error: 'Unknown command.' };
    }
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
    if (this.cfg.pvp) this.stepBattle();
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
    if (this.t % 1000 === 0) { this.checkAutoSecrets(p); this.checkEditions(p); this.checkTrophies(p); }
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
    if (this.cfg.pvp) this.say(best.name + ' wins with the lowest balance!', 'win');
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
      if (ev.deal) { this.stock[ev.deal] = 1; this.broadcast({ type: 'stock', item: ev.deal, stock: 1 }); }
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
      if (g.vehicle && !p.vehicles[g.vehicle]) return g;
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
    if (item.secret && !p.flags[item.secret] && this.stock[item.id] > 0) return false;
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
    if (p.powers.phoneMap && SecretsData.CALLS[item.id]) this.emit(p, { type: 'call', text: SecretsData.CALLS[item.id] });
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

  // Secrets that find you: gates that passed because of something you bought.
  G.checkAutoSecrets = function (p) {
    for (var k in this.run.secrets) {
      var s = this.run.secrets[k];
      if (s.look === 'auto' && !p.flags['s:' + k] && !this.gateFails(p, s.gate)) this.discover(p.id, k);
    }
  };
  // The Newspaper: morning, noon and evening editions. Each new one carries a real clue.
  G.checkEditions = function (p) {
    if (!p.powers.editions) return;
    var hoursIn = this.t / 1000 / this.cfg.secPerHour, no = Math.floor(hoursIn / 6);
    if (p.lastEdition === no) return;
    var first = p.lastEdition == null;
    p.lastEdition = no;
    var text = this.run.editions[first ? 0 : (no % (this.run.editions.length - 1)) + 1];
    this.emit(p, { type: 'edition', text: text });
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
    if (item.id === 'moon_land' && this.hourNow() < 6) p.stats.moonBeforeBreakfast = true;
  };

  /** "Buy the whole store": everything left and unlocked at one site, as one purchase. */
  G.buyStore = function (pid, site) {
    var p = this.players[pid], self = this, list = [], sum = 0, near = this.requireNear, st = this.run.sites[site] || { items: [] }, close = !near;
    if (this.over) return { code: 'over', error: 'The day is over.' };
    st.items.forEach(function (id) { if (self.nearPad(p, id)) close = true; else { var q = self.run.padPos[id]; if (q && Math.hypot(p.x - q.x, p.z - q.z) < 60 && Math.abs(p.y - q.y) < 30) close = true; } });
    if (!close) return { code: 'far', error: 'You are too far away.' };
    this.requireNear = false;
    st.items.forEach(function (id) {
      var it = self.items[id];
      if (it.kind !== 'good' || self.stock[id] <= 0 || self.canBuy(p, id)) return;
      list.push(id);
      sum += self.basePrice(it) * self.stock[id];
    });
    this.requireNear = near;
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

  // ───────────── wrecking things ─────────────
  /** Smashing the city costs a fixed fine, up to a cap, so a rampage is fun without being the whole answer. */
  G.damage = function (pid, kind) {
    var p = this.players[pid], fine = R.DAMAGE[kind];
    if (!fine) return { code: 'unknown', error: 'Nothing to pay for.' };
    if (this.over || this.frozen || p.won) return { ok: true, paid: 0 };
    var cap = this.cfg.pvp ? R.DAMAGE_CAP_PVP : R.DAMAGE_CAP, used = p.damagePaid || 0, pay = Math.min(fine, cap - used, p.balance);
    p.stats.smashed = (p.stats.smashed || 0) + 1;
    if (kind === 'car') p.stats.carsWrecked = (p.stats.carsWrecked || 0) + 1;
    if (pay > 0) { p.balance -= pay; p.spent += pay; p.damagePaid = used + pay; }
    this.checkTrophies(p);
    this.checkWin(p);
    return { ok: true, paid: Math.max(0, pay) };
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
    if (this.requireNear && s.pos) {
      var dx = p.x - s.pos.x, dz = p.z - s.pos.z;
      if (dx * dx + dz * dz > 400) return { code: 'far', error: 'You are too far away.' };
    }
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

  /** The end-of-run summary. Never counts undiscovered secrets. */
  G.results = function (pid) {
    var p = this.players[pid], flags = Object.keys(p.flags).filter(function (k) { return k.indexOf('s:') === 0; });
    if (p.history[p.history.length - 1] !== p.balance) p.history.push(p.balance);
    return {
      result: this.result || 'quit', spent: p.spent, left: p.balance, trophies: Object.keys(p.trophies), clout: this.clout(p), secrets: flags.length,
      history: p.history.slice(), best: p.best, won: p.won, perfect: p.perfect, ms: this.t, winner: this.winner, winnerName: this.winner && this.players[this.winner] ? this.players[this.winner].name : null,
      board: this.cfg.pvp ? this.order.map(function (id) { var o = this.players[id]; return { name: o.name, balance: o.balance, spent: o.spent }; }, this).sort(function (a, b) { return a.balance - b.balance; }) : null
    };
  };

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
    if (this.over) view.results = this.results(pid);
    if (this.cfg.pvp) {
      view.board = this.order.map(function (id) {
        var o = self.players[id];
        return { id: o.id, name: o.name, bot: o.bot, balance: o.balance, spent: o.spent, x: o.x, y: o.y, z: o.z, h: o.h, inv: o.inv, connected: o.connected !== false };
      });
      view.auctions = this.auctions.filter(function (a) { return a.state === 'open'; }).map(function (a) { return { id: a.id, name: a.name, min: a.min, left: a.left, best: a.best, bestBid: a.bestBid }; });
      view.cardSpots = this.cardSpots.filter(function (c) { return !c.taken; }).map(function (c) { return { id: c.id, x: c.x, y: c.y, z: c.z, kind: c.kind }; });
      view.giftFrom = this.gifts.filter(function (g) { return g.to === pid; }).map(function (g) { return { left: g.left, amount: g.amount }; })[0] || null;
      view.me.giftUsed = p.giftUsed; view.me.cardsUsed = p.cardsUsed;
    }
    return view;
  };

  return { Game: Game, quote: quote, closeMs: closeMs, hourIn: hourIn, fmtShort: fmtShort, R: R };
});
