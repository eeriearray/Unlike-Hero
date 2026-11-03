/* The catalog as data. Each district bucket has an exact target; "fill" rows share what the fixed rows leave. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules.js'), require('./districts.js'), require('./businesses.js'));
  else (root.TRD = root.TRD || {}).items = factory(root.TRD.rules, root.TRD.districts, root.TRD.businesses);
})(typeof self !== 'undefined' ? self : this, function (R, D, Biz) {
  'use strict';
  var B = R.B, M = R.M, K = R.K;
  var LOBBY = { own: 'lobby_firm', why: 'City projects need friends: a Lobby Firm.' };

  // Row: [id, name, price, opts]. Fill row: [name, weight, opts].
  var CATALOG = {
    industrial: {
      prefix: 'ind',
      buckets: [
        { key: 'visible', target: 90 * B,
          fixed: [
            ['car_dealership', 'Car Dealership', 4 * B, { site: 'dealership', outside: 1, building: 1, required: 1, icon: 'car' }],
            ['race_track', 'Race Track', 6 * B, { site: 'race_pit', outside: 1, building: 1, required: 1, icon: 'flag' }],
            ['car_factory_biz', 'Car Factory', 18 * B, { site: 'car_factory', outside: 1, building: 1, required: 1, icon: 'gear' }],
            ['fireworks_factory', 'Fireworks Factory', 2 * B, { site: 'fireworks', outside: 1, building: 1, required: 1, icon: 'spark' }],
            ['demolition_company', 'Demolition Company', 10 * B, { site: 'demolition_co', outside: 1, building: 1, required: 1, icon: 'bomb' }],
            ['scrapyard_biz', 'Scrapyard', 1 * B, { site: 'scrapyard', outside: 1, building: 1, required: 1, icon: 'wrench' }],
            ['steel_mill_biz', 'Failing Steel Mill', 9 * B, { site: 'steel_mill', outside: 1, building: 1, required: 1, icon: 'gear' }]
          ],
          fill: [
            ['A Parking Lot Full of Convertibles', 6, { site: 'dealership' }], ['Every Colour of Hatchback', 4, { site: 'dealership' }],
            ['Car with Eleven Cupholders', 1, { site: 'dealership' }], ['Limo Long Enough to Need a Bus Stop', 3, { site: 'dealership' }],
            ['A Thousand Pine Tree Air Fresheners', 0.15, { site: 'parts_row' }], ['Fuzzy Dice, Bulk Pallet', 0.1, { site: 'parts_row' }],
            ['Solid Gold Spark Plugs', 0.5, { site: 'parts_row' }], ['Racing Stripes for a Building', 0.4, { site: 'parts_row' }],
            ['Tyre Mountain', 0.8, { site: 'tyre_yard' }], ['The Good Jack', 0.12, { site: 'tyre_yard' }], ['Inflatable Tube Man Army', 0.6, { site: 'tyre_yard' }],
            ['Chrome-Plated Forklift', 0.3, { site: 'tyre_yard' }], ['A Very Long Extension Cord', 0.2, { site: 'tyre_yard' }],
            ['Freight Train, No Questions Asked', 5, { site: 'freight_row' }], ['Warehouse of Unopened Boxes', 3, { site: 'freight_row' }],
            ['Warehouse of Slightly Opened Boxes', 2, { site: 'freight_row' }], ['A Crane for Your Other Crane', 3, { site: 'freight_row' }],
            ['Container of Left Shoes', 0.5, { site: 'freight_row' }], ['Pallet of Bubble Wrap (Unpopped)', 0.25, { site: 'freight_row' }],
            ['Assembly Line That Only Makes Horns', 2, { site: 'car_factory' }], ['Robot Arm with Good Manners', 1, { site: 'car_factory' }],
            ['Spare Chassis Collection', 2, { site: 'car_factory' }], ['Paint Shop Stuck on Teal', 1, { site: 'car_factory' }],
            ['Crushed-Car Cube Sculpture', 0.3, { site: 'scrapyard' }], ['Magnet the Size of a Bus', 0.8, { site: 'scrapyard' }], ['Guard Dog (Very Friendly)', 0.1, { site: 'scrapyard' }],
            ['Pit Crew for Your Shopping Cart', 0.4, { site: 'race_pit' }], ['Grandstand Naming Rights', 1.2, { site: 'race_pit' }], ['Chequered Flag Factory Outlet', 0.5, { site: 'race_pit' }],
            ['Rust by the Tonne', 0.5, { site: 'steel_mill' }], ['Ingots Shaped Like Your Face', 1, { site: 'steel_mill' }]
          ]
        },
        { key: 'lobby', target: 70 * B, site: 'lobby_lots_ind',
          fixed: [
            ['power_station_biz', 'Power Station', 20 * B, { site: 'power_station', outside: 1, building: 1, required: 1, gate: [LOBBY], icon: 'bolt', project: 1 }],
            ['harbour_bridge', 'Harbour Bridge', 12 * B, { site: 'lobby_lots_ind', building: 1, required: 1, gate: [LOBBY], icon: 'bridge', project: 1 }],
            ['metro_line', 'New Metro Line', 15 * B, { site: 'lobby_lots_ind', building: 1, required: 1, gate: [LOBBY], icon: 'train', project: 1 }]
          ],
          fill: [
            ['Freight Rail Expansion', 6, { gate: [LOBBY] }], ['An Unnecessary Overpass', 5, { gate: [LOBBY] }], ['Industrial Park with an Actual Park', 4, { gate: [LOBBY] }],
            ['Rezoned Puddle', 1, { gate: [LOBBY] }], ['Second Giant Chimney, for Symmetry', 4, { gate: [LOBBY] }], ['Road Cones, All of Them', 3, { gate: [LOBBY] }]
          ]
        }
      ]
    }
  };

  var CHANGE_STOCK = [4, 4, 3, 4, 9, 9, 9, 10];
  var CHANGE_NAMES = ['Gumball', 'Pretzel', 'Lucky Wish', 'Hot Lunch', 'Vending Feast', 'Fountain Wish', 'Golden Wish', 'Wish of the Century'];

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40); }

  /** Expands the tables into a flat item list with exact prices. Pure; shuffle.js works on a copy. */
  function build() {
    var out = [];
    Object.keys(CATALOG).forEach(function (did) {
      var cat = CATALOG[did], dist = D.DISTRICTS[did];
      cat.buckets.forEach(function (bk, bi) {
        var used = 0, rows = [];
        bk.fixed.forEach(function (r) {
          var it = mk(r[0], r[1], r[2], r[3] || {}, did, bk);
          rows.push(it); used += it.price * it.stock;
        });
        if (bi === 0) {
          R.CHANGE_FEES.forEach(function (fee, i) {
            var it = mk(cat.prefix + '_change_' + i, CHANGE_NAMES[i], fee, { site: did + '_change', stock: CHANGE_STOCK[i], kind: 'change', icon: 'coin' }, did, bk);
            rows.push(it); used += it.price * it.stock;
          });
        }
        var left = bk.target - used, wsum = 0;
        bk.fill.forEach(function (f) { wsum += f[1]; });
        var fills = [];
        bk.fill.forEach(function (f, i) {
          var price = i === bk.fill.length - 1 ? left : Math.max(1 * M, Math.round(((bk.target - used) * f[1] / wsum) / (5 * M)) * (5 * M));
          if (i !== bk.fill.length - 1) left -= price;
          fills.push(mk(cat.prefix + '_' + slug(f[0]), f[0], price, Object.assign({ flex: 1 }, f[2] || {}), did, bk));
        });
        if (left <= 0) throw new Error('Bucket overflow: ' + did + '/' + bk.key + ' left ' + left);
        rows.forEach(function (r) { out.push(r); });
        fills.forEach(function (r) { out.push(r); });
      });
    });
    return out;
  }

  function mk(id, name, price, o, did, bk) {
    var biz = Biz[id] || {};
    return {
      id: id, name: name, price: price, district: did, bucket: bk.key, site: o.site || bk.site,
      stock: o.stock || 1, kind: o.kind || (o.building ? 'biz' : 'good'), icon: o.icon || null, building: !!o.building, outside: !!o.outside,
      required: !!o.required, flex: !!o.flex, gate: o.gate || null, secret: o.secret || null, grants: o.grants || null, wearable: o.wearable || null,
      income: biz.income || 0, reward: biz.reward || o.reward || null, power: biz.power || o.power || null, nature: biz.nature || null,
      project: !!o.project, hint: o.hint || null, pos: o.pos || null
    };
  }

  return { CATALOG: CATALOG, build: build };
});
