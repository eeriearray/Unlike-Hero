/*
 * Builds one run's city from a seed.
 * Fixed: district layout, landmarks, rules, core chains.
 * Changes: which clue says what, secret door spots, event times, auction windows, 20% of prices within +/-25%, some shop contents.
 * Each bucket is rebalanced after the price shuffle, so district budgets stay exact.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng.js'), require('./data/rules.js'), require('./data/districts.js'), require('./data/items.js'), require('./layout.js'), require('./data/secrets.js'), require('./data/events.js'));
  else root.TrillionerShuffle = factory(root.TrillionerRng, root.TRD.rules, root.TRD.districts, root.TRD.items, root.TrillionerLayout, root.TRD.secrets, root.TRD.events);
})(typeof self !== 'undefined' ? self : this, function (RngMod, R, D, Items, Layout, SecretsData, EventsData) {
  'use strict';
  var STEP = R.M;

  function shufflePrices(list, rng) {
    var groups = {};
    list.forEach(function (it) { if (it.flex && it.stock === 1) (groups[it.district + '/' + it.bucket] = groups[it.district + '/' + it.bucket] || []).push(it); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      if (g.length < 4) return;
      var order = rng.shuffle(g), n = Math.max(1, Math.round(g.length * 0.2)), delta = 0;
      order.slice(0, n).forEach(function (it) {
        var np = Math.max(STEP, Math.round(it.price * rng.range(0.75, 1.25) / STEP) * STEP);
        delta += np - it.price;
        it.price = np;
      });
      // the rest of the bucket absorbs the difference
      var rest = order.slice(n).sort(function (a, b) { return b.price - a.price; }), left = delta;
      rest.forEach(function (it, i) {
        if (!left) return;
        var share = i === rest.length - 1 ? left : Math.round(delta * it.price / rest.reduce(function (s, r) { return s + r.price; }, 0) / STEP) * STEP;
        if (it.price - share < STEP) share = it.price - STEP;
        it.price -= share;
        left -= share;
      });
      if (left) rest[0].price -= left;
    });
  }

  // Some goods swap shops, inside their own district and bucket.
  function shuffleShops(list, rng) {
    var groups = {};
    list.forEach(function (it) { if (it.flex && !it.gate && !it.secret && it.kind === 'good') (groups[it.district] = groups[it.district] || []).push(it); });
    Object.keys(groups).forEach(function (k) {
      var g = rng.shuffle(groups[k]);
      for (var i = 0; i + 1 < g.length && i < 6; i += 2) {
        if (g[i].site === g[i + 1].site) continue;
        var t = g[i].site; g[i].site = g[i + 1].site; g[i + 1].site = t;
      }
    });
  }

  function schedule(rng) {
    var picks = rng.shuffle(EventsData.EVENTS.map(function (e) { return e.id; })).slice(0, 2 + rng.int(3));
    var hours = rng.shuffle([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]).slice(0, picks.length);
    return picks.map(function (id, i) { return { id: id, atHour: hours[i] + rng.next() }; }).sort(function (a, b) { return a.atHour - b.atHour; });
  }

  function buildRun(seed) {
    var rng = new RngMod.Rng(typeof seed === 'number' ? seed : RngMod.hash(seed));
    var list = Items.build();
    shufflePrices(list, rng.fork('price'));
    shuffleShops(list, rng.fork('shops'));

    // surprise-auction deals sit outside the budgets; they exist only while their event runs
    var evRng = rng.fork('events'), events = schedule(evRng), deal = evRng.pick(EventsData.SURPRISE_DEALS);
    list.push({ id: 'surprise_deal', name: deal.name, price: deal.price * R.B, district: 'downtown', bucket: 'surprise', site: 'plaza_shops', stock: 1, kind: 'good', icon: 'gem', building: false, outside: false, required: false, flex: false, gate: null, secret: null, surprise: true, income: 0, reward: null, power: null });

    var items = {};
    list.forEach(function (it) { items[it.id] = it; });
    var lay = Layout.layout(list);

    // fog comes in three times; the dock auction runs once
    var wx = rng.fork('weather'), fog = [], rain = [];
    [[1.5, 6], [8, 13], [15, 21]].forEach(function (b) { var s = wx.range(b[0], b[1] - 2.5); fog.push([s, s + 2.5]); });
    [[6, 8], [13, 15]].forEach(function (b) { var s = wx.range(b[0], b[1] - 1); rain.push([s, s + 1]); });
    var dockAt = wx.range(9, 17), windows = { dock_auction: [dockAt, dockAt + 3] };

    events.forEach(function (e) {
      if (e.id === 'firesale') {
        var shops = Object.keys(lay.sites).filter(function (k) { var s = lay.sites[k]; return s.kind === 'room' && s.y === 0 && s.items.length >= 4 && !s.items.some(function (i) { return items[i].gate || items[i].secret; }); });
        e.site = evRng.pick(shops);
      }
      if (e.id === 'auction') e.deal = 'surprise_deal';
    });

    // secrets: pick each one's spot, give shuffled clues their words
    var sRng = rng.fork('secrets'), pool = sRng.shuffle(SecretsData.HINT_POOL), secrets = {}, pi = 0;
    SecretsData.SECRETS.forEach(function (s) {
      var c = Object.assign({}, s), spot = s.spots ? sRng.pick(s.spots) : null, site;
      if (spot) {
        if (spot.room) { site = lay.sites[spot.room]; c.pos = { x: site.room.ox + spot.dx, y: 0, z: site.room.oz + spot.dz }; c.room = spot.room; }
        else c.pos = { x: spot.x, y: spot.y, z: spot.z };
      }
      c.clueText = s.shuffled ? pool[pi++ % pool.length] : s.clue;
      secrets[s.id] = c;
    });
    var edRng = rng.fork('editions'), editions = [SecretsData.EDITIONS[0]].concat(edRng.shuffle(SecretsData.EDITIONS.slice(1)));

    var d0 = D.DISTRICTS.downtown, districtSpawn = {};
    Object.keys(D.DISTRICTS).forEach(function (k) { var s = D.DISTRICTS[k].spawn; districtSpawn[k] = { x: s.x, y: D.DISTRICTS[k].level === 'under' ? D.UNDER_Y : 0, z: s.z }; });
    return {
      seed: seed, items: items, list: list, sites: lay.sites, padPos: lay.padPos, secrets: secrets, editions: editions, events: events, fog: fog, rain: rain, windows: windows,
      spawn: { x: d0.spawn.x, y: 0, z: d0.spawn.z }, districtSpawn: districtSpawn
    };
  }
  return { buildRun: buildRun };
});
