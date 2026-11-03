/* Trophies by amount spent, plus fun bonus trophies. Bonus tests read only the player's own state. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules.js'));
  else (root.TRD = root.TRD || {}).trophies = factory(root.TRD.rules);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';
  var B = R.B;
  function owns(p, id) { var o = p.owned[id]; return (o && !o.closing) || !!p.goods[id]; }
  function ownsAll(ids) { return function (p) { return ids.every(function (i) { return owns(p, i); }); }; }
  function count(obj, f) { return Object.keys(obj).filter(f || function () { return true; }).length; }
  function secrets(p) { return count(p.flags, function (k) { return k.indexOf('s:') === 0; }); }
  function siteGoods(site) {
    return function (p, c) {
      var ids = (c.game.run.sites[site] || { items: [] }).items;
      return ids.length > 0 && ids.every(function (i) { return p.goods[i]; });
    };
  }
  var T = [
    { id: 'big_spender', name: 'Big Spender', spent: 1 * B },
    { id: 'bronze', name: 'Bronze Shopaholic', spent: 10 * B },
    { id: 'silver', name: 'Silver Tycoon', spent: 50 * B },
    { id: 'gold', name: 'Gold Mogul', spent: 100 * B },
    { id: 'platinum', name: 'Platinum Oligarch', spent: 250 * B },
    { id: 'diamond', name: 'Diamond Half-Trillion', spent: 500 * B },
    { id: 'cosmic', name: 'Cosmic Whale', spent: 750 * B },
    { id: 'trillioner', name: 'The Trillioner', spent: 1 * R.T },
    { id: 'flat_broke', name: 'Flat Broke', manual: 1, desc: 'Balance below $1M, income $0 or less' },
    { id: 'perfect_zero', name: 'Perfect Zero', manual: 1, desc: 'Exactly $0.00, income exactly $0' },
    // bonus
    { id: 'moon_breakfast', name: 'Bought a Moon Before Breakfast', desc: 'Moon Land before the morning comes', test: function (p) { return !!p.stats.moonBeforeBreakfast; } },
    { id: 'every_animal', name: 'Owned Every Zoo Animal', desc: 'Everything on sale at the zoo', test: siteGoods('zoo') },
    { id: 'four_corners', name: 'Four Corners', desc: 'All four Corner Towers', test: ownsAll(['corner_nw', 'corner_ne', 'corner_sw', 'corner_se']) },
    { id: 'frenzy_five', name: 'Five-Alarm Frenzy', desc: 'Reach Frenzy x5', test: function (p) { return p.stats.maxFrenzy >= 5; } },
    { id: 'derby', name: 'Demolition Derby', desc: 'Demolish five buildings', test: function (p) { return p.stats.demolished >= 5; } },
    { id: 'wrecking_crew', name: 'Wrecking Crew', desc: 'Demolish with the wrecking truck', test: function (p) { return p.stats.truckDemos >= 1; } },
    { id: 'money_printer', name: 'Money Printer Go Brrr', desc: 'Own the Bank and the Mint', test: ownsAll(['bank', 'mint']) },
    { id: 'laundry_day', name: 'Laundry Day', desc: 'Buy the Laundromat', test: ownsAll(['laundromat']) },
    { id: 'cannon_dry', name: 'Fired It All', desc: 'Empty the money cannon', test: function (p) { return p.cannonUsed >= R.CANNON_CAP; } },
    { id: 'tourist', name: 'Local Tourist', desc: 'Set foot in all 8 districts', test: function (p) { return count(p.visited) >= 8; } },
    { id: 'underworld', name: 'Going Underground', desc: 'Reach the Under City', test: function (p) { return !!p.visited.under; } },
    { id: 'astronaut', name: 'Room with a View', desc: 'Buy the Mars Hotel', test: ownsAll(['mars_hotel']) },
    { id: 'highlander', name: 'Laird of Somewhere', desc: 'Buy the Scottish Castle', test: ownsAll(['scottish_castle']) },
    { id: 'whole_store', name: 'I Will Take All of It', desc: 'Buy three whole stores', test: function (p) { return (p.stats.storesBought || 0) >= 3; } },
    { id: 'loss_leader', name: 'Loss Leader', desc: 'Own five losing businesses', test: function (p, c) { return count(p.owned, function (i) { var o = p.owned[i]; return !o.closing && !o.demolished && c.game.items[i].income < 0; }) >= 5; } },
    { id: 'early_bird', name: 'Early Bird', desc: 'Spend $100B before noon', test: function (p, c) { return p.spent >= 100 * B && c.game.t < 6 * 60000; } },
    { id: 'night_shopper', name: 'Night Shopper', desc: 'Find the Night Market', test: function (p) { return !!p.flags['s:night_market']; } },
    { id: 'gumshoe', name: 'Gumshoe', desc: 'Find 10 secrets', test: function (p) { return secrets(p) >= 10; } },
    { id: 'conspiracy', name: 'Conspiracy Board', desc: 'Find 25 secrets', test: function (p) { return secrets(p) >= 25; } },
    { id: 'useless', name: 'Fountain of Regret', desc: 'Buy the Diamond Fountain', test: ownsAll(['diamond_fountain']) },
    { id: 'rocket_man', name: 'Rocket Owner', desc: 'Buy the Rocket', test: ownsAll(['rocket']) },
    { id: 'fleet', name: 'Garage Sale, in Reverse', desc: 'Own 8 usable vehicles', test: function (p) { return count(p.vehicles) >= 8; } }
  ];
  return { TROPHIES: T };
});
