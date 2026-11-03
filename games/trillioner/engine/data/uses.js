/* What ordinary purchases are good for. An item's group comes from its name, so a new item picks up a use by itself.
 * Wearing and pets are permanent; everything else is one use per item you bought. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./items.js'), require('./extras.js'));
  else (root.TRD = root.TRD || {}).uses = factory(root.TRD.items, root.TRD.extras);
})(typeof self !== 'undefined' ? self : this, function (Items, Extras) {
  'use strict';
  // In order: the first match wins, and the third entry rules out names that only look like it.
  var GROUPS = [
    ['throw', /takeover|\bbonds?\b|futures|options? on|all options|cheque|stamp|\bcoin|\bwish\b|ticket|\btip\b|\bdeed\b|licence|membership|naming|rights|insider|treasure lot|doubloon|\bshares?\b|voucher|coupon|pension|\bfund\b|\biou\b|viewing pass/i],
    ['eat', /hot dog|latte|soup|sandwich|fish and|prawn|pretzel|lunch|candy|minibar|feast|\bsauce\b|mustard|gumball|room service|ice cream|burger|pizza|pepperoni|champagne|coffee|cheese|cake|doughnut|truffle|caviar|chef/i, /lunchbox|recipe/i],
    ['pet', /zoo animal|\b(lion|penguin|giraffe|otter|dalmatian|dragon egg|seagull|octopus|guard dog|pigeons?)\b/i, /poster|tour|street|tiara|hotel/i],
    ['hide', /mansion|neighbourhood|castle|island|\bregion\b|estate|moon land|solar field|\bmine\b|vineyard|forest|greenland|fjord|\bcove\b|wind farm|chalet|bunker|penthouse|province|plains|tuscan hill|geysers|polar bear hotel|haunted house/i],
    ['drive', /\bcar\b|convertible|hatchback|limo|\bkart\b|forklift|ride-on mower|dune buggy|hearse/i, /crushed|stripes|pit crew/i],
    ['wear', /\bhats?\b|helmet|tiara|crown|monocle|sunglass|shoe|sneaker|\bsocks?\b|necklace|pearl|earring|bracelet|\bring\b|\bwatch\b|\bcoat\b|\bsuit\b|pyjama|pinstripe|sweater|scarf|glove|\btie\b|tuxedo/i, /elevator|stand|\bbell\b|barnacle|mountain|floor|shoebox|container/i],
    ['read', /library|\bbook\b|logbook|\bmap\b|recipe|journal|almanac|newspaper|\bguide\b|memoir|diary|timetable/i],
    ['party', /firework|balloon|confetti|parade|\bband\b|\bdice\b|chips\b|\bgift\b|\bbell\b|party|fountain|waterfall|rainbow|\bcloud\b|mayor|foghorn|fog machine|tube man|snow day/i]
  ];
  var VERBS = {
    wear: 'Wear it', pet: 'It follows you', eat: 'Eat it: run faster for a while', read: 'Read it: get a clue to a hidden deal', hide: 'Lie low there: the Refund Office loses you for 30s',
    drive: 'Drive it', party: 'Set it off: combo and a crowd', throw: 'Throw it: agents go after it', place: 'Put it down: everyone stops to look'
  };
  var ACTION = { eat: 'Eat', read: 'Read', hide: 'Lie low', drive: 'Drive', party: 'Set off', throw: 'Throw', place: 'Put down' };

  function groupOf(item) {
    var r = item.reward || {};
    if ((r.vehicles || []).length || (r.gear || []).length || item.power || item.grants || item.wearable || item.hint || item.income || item.building || item.kind === 'store') return null;
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i][1].test(item.name) && !(GROUPS[i][2] && GROUPS[i][2].test(item.name))) return GROUPS[i][0];
    return 'place';
  }
  function hashOf(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function rarity(p) { return p >= 10e11 ? 'l' : p >= 1e11 ? 'e' : p >= 1e10 ? 'r' : 'c'; }

  /** A wearable made from what the item is called. */
  function wearLook(item) {
    var n = item.name, c = [0x2a2b30, 0x8a1f2a, 0x1d3a6a, 0xe6e1d6, 0x3f5a3c, 0x6a2bb8][hashOf(n) % 6], gold = item.price >= 1e11, shine = gold ? 1 : 0;
    if (/monocle/i.test(n)) return { slot: 'glasses', look: { model: 'monocle', color: 0xbdf3ff, shine: 1 } };
    if (/sunglass/i.test(n)) return { slot: 'glasses', look: { model: 'shades', color: gold ? 0xffc53d : 0x101014, shine: shine } };
    if (/tiara|crown/i.test(n)) return { slot: 'hat', look: { model: 'crown', color: /tiara/i.test(n) ? 0xdfe6ee : 0xffc53d, shine: 1 } };
    if (/tall|very high/i.test(n)) return { slot: 'hat', look: { model: 'tall', color: c } };
    if (/\bhats?\b|helmet/i.test(n)) return { slot: 'hat', look: { model: hashOf(n) % 2 ? 'tophat' : 'cowboy', color: c } };
    if (/shoe|sneaker|\bsocks?\b/i.test(n)) return { slot: 'shoes', look: { color: gold ? 0xffc53d : c, shine: shine } };
    if (/\bwatch\b|bracelet|\bring\b/i.test(n)) return { slot: 'wrist', look: { color: gold ? 0xffc53d : 0xc4ccd4, shine: 1 } };
    if (/necklace|pearl|earring/i.test(n)) return { slot: 'neck', look: { model: /pearl/i.test(n) ? 'pearls' : /necklace/i.test(n) ? 'pendant' : 'chain', color: /pearl/i.test(n) ? 0xfaf4e8 : 0xffc53d, shine: 1 } };
    return { slot: 'top', look: { color: gold ? 0xffc53d : c, trim: /\btie\b|suit|tuxedo|pinstripe/i.test(n) ? 0xf5f5f0 : undefined, shine: shine } };
  }
  var PETS = [[/penguin/i, 'penguin'], [/lion/i, 'tiger'], [/gerald|giraffe/i, 'elephant'], [/otter/i, 'cat'], [/pigeon|seagull/i, 'penguin'], [/dragon/i, 'dragon'], [/dog|dalmatian/i, 'dog']];
  function petLook(item) {
    for (var i = 0; i < PETS.length; i++) if (PETS[i][0].test(item.name)) return { slot: 'pet', look: { model: PETS[i][1] } };
    return { slot: 'pet', look: { model: 'pig' } };
  }

  // Everything you can wear or keep as a pet joins the wardrobe, not for sale there: you got it by buying the item.
  var GROUP = {};
  Items.build().forEach(function (it) {
    var g = groupOf(it);
    if (!g) return;
    GROUP[it.id] = g;
    if ((g === 'wear' || g === 'pet') && !Extras.BY_ID['w_' + it.id]) {
      var made = g === 'wear' ? wearLook(it) : petLook(it);
      var x = { id: 'w_' + it.id, name: it.name, price: 0, worth: it.price, rarity: rarity(it.price), slot: made.slot, gift: 1, look: made.look };
      Extras.CATALOG.push(x); Extras.BY_ID[x.id] = x;
    }
  });
  return { groupOf: groupOf, GROUP: GROUP, VERBS: VERBS, ACTION: ACTION, GAP_MS: 400, HIDE_SECS: 30 };
});
