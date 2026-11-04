/* Your place: upgrades for the mansion and parts for the cars in its garage. Bought at home, and capped like every other sink. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules.js'));
  else (root.TRD = root.TRD || {}).home = factory(root.TRD.rules);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';
  var B = R.B, M = R.M;
  var UPGRADES = [
    { id: 'marble', name: 'Marble Floors', price: 2 * B, does: 'Every floor in the house, replaced' },
    { id: 'chandelier', name: 'A Chandelier Too Big for the Room', price: 1500 * M, does: 'Hangs over the hall. Nobody may walk under it' },
    { id: 'butler', name: 'A Butler Who Judges', price: 1 * B, does: 'He stands in the hall and thinks about you' },
    { id: 'pool', name: 'Indoor Gold Pool', price: 4 * B, does: 'The water is water. The rest is gold' },
    { id: 'statue', name: 'Statue of You, Enormous', price: 3 * B, does: 'In the hall, wearing what you are wearing' },
    { id: 'helipad', name: 'Rooftop Helipad', price: 3 * B, does: 'Comes with a helicopter', vehicle: 'helicopter' },
    { id: 'goldhouse', name: 'Gold-Plate the Outside', price: 1500 * M, does: 'The neighbours will talk. Good' }
  ];
  function part(slot, id, name, price, look) { return { id: id, slot: slot, name: name, price: price, look: look }; }
  var PARTS = [
    part('paint', 'paint_black', 'Midnight Black Paint', 200 * M, { color: 0x17181c }),
    part('paint', 'paint_white', 'Pearl White Paint', 200 * M, { color: 0xe8e5dc }),
    part('paint', 'paint_green', 'Racing Green Paint', 300 * M, { color: 0x17492f }),
    part('paint', 'paint_blue', 'Deep Blue Paint', 300 * M, { color: 0x173a78 }),
    part('paint', 'paint_chrome', 'Mirror Chrome Paint', 1500 * M, { color: 0xc9d0d6 }),
    part('paint', 'paint_gold', 'Solid Gold Paint', 2500 * M, { color: 0xe0ad24 }),
    part('rim', 'rim_black', 'Black Wheels', 100 * M, { color: 0x202227 }),
    part('rim', 'rim_red', 'Red Wheels', 150 * M, { color: 0xb8222a }),
    part('rim', 'rim_gold', 'Gold Wheels', 500 * M, { color: 0xe0ad24 }),
    part('neon', 'neon_blue', 'Blue Underglow', 200 * M, { color: 0x2a8cff }),
    part('neon', 'neon_pink', 'Pink Underglow', 200 * M, { color: 0xff2fa8 }),
    part('neon', 'neon_green', 'Green Underglow', 200 * M, { color: 0x2dff7a }),
    part('wing', 'wing_tall', 'A Spoiler Taller Than Reason', 400 * M, { tall: 1 }),
    part('horn', 'horn_clown', 'Clown Horn', 50 * M, { notes: [880, 660, 880] }),
    part('horn', 'horn_train', 'Freight Train Horn', 150 * M, { notes: [110, 138, 165] }),
    part('horn', 'horn_opera', 'A Small Opera', 300 * M, { notes: [523, 659, 784, 1047] })
  ];
  var BY = {};
  UPGRADES.forEach(function (u) { BY[u.id] = u; });
  PARTS.forEach(function (p) { BY[p.id] = p; });
  return { UPGRADES: UPGRADES, PARTS: PARTS, BY: BY, SITE: 'your_place', SLOTS: { paint: 'Paint', rim: 'Wheels', neon: 'Underglow', wing: 'Spoiler', horn: 'Horn' } };
});
