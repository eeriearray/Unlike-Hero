/* Things you buy for yourself: clothes, jewellery, effects, pets, plus mystery boxes and throwing cash.
 * Every sink here has a hard cap, so none of them can win the game alone. Prices in cents. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules.js'));
  else { root.TRD = root.TRD || {}; root.TRD.extras = factory(root.TRD.rules); }
})(typeof self !== 'undefined' ? self : this, function (R) {
  var B = R.B, M = R.M;
  // id, name, price, rarity, look. Rarity is c(ommon), r(are), e(pic), l(egendary).
  function row(slot, list) { return list.map(function (x) { return { id: x[0], name: x[1], price: x[2], rarity: x[3], look: x[4], slot: slot }; }); }
  var CATALOG = [].concat(
    row('hair', [
      ['hair_spike', 'Spiky Hair', 60 * M, 'c', { style: 'spike', color: 0x2a1d16 }],
      ['hair_long', 'Long Waves', 80 * M, 'c', { style: 'long', color: 0x7a3b1d }],
      ['hair_afro', 'Big Round Afro', 100 * M, 'c', { style: 'afro', color: 0x1c1411 }],
      ['hair_mohawk', 'Pink Mohawk', 300 * M, 'r', { style: 'mohawk', color: 0xff4fa3 }],
      ['hair_blue', 'Electric Blue Spikes', 400 * M, 'r', { style: 'spike', color: 0x2ad4ff }],
      ['hair_gold', 'Hair of Real Gold', 2 * B, 'e', { style: 'long', color: 0xffc53d, shine: 1 }]
    ]),
    row('top', [
      ['top_red', 'Red Tee', 50 * M, 'c', { color: 0xe23b3b }],
      ['top_green', 'Grass Green Hoodie', 70 * M, 'c', { color: 0x37b24d }],
      ['top_white', 'Very Clean Shirt', 90 * M, 'c', { color: 0xf5f5f0 }],
      ['top_stripe', 'Sailor Top', 250 * M, 'r', { color: 0x1d4e89, trim: 0xffffff }],
      ['top_suit', 'Black Suit', 600 * M, 'r', { color: 0x15161d, trim: 0xf5f5f0 }],
      ['top_purple', 'Velvet Royal Jacket', 1500 * M, 'e', { color: 0x6a2bb8, trim: 0xffc53d }],
      ['top_gold', 'Solid Gold Blazer', 5 * B, 'l', { color: 0xffc53d, trim: 0xfff2b0, shine: 1 }]
    ]),
    row('legs', [
      ['legs_jeans', 'Blue Jeans', 50 * M, 'c', { color: 0x2f5d9b }],
      ['legs_khaki', 'Sensible Khakis', 60 * M, 'c', { color: 0xb49a6a }],
      ['legs_black', 'Tailored Trousers', 300 * M, 'r', { color: 0x16171c }],
      ['legs_white', 'Yacht Trousers', 500 * M, 'r', { color: 0xf1efe6 }],
      ['legs_gold', 'Golden Trousers', 3 * B, 'l', { color: 0xe7b02c, shine: 1 }]
    ]),
    row('shoes', [
      ['shoes_red', 'Red Trainers', 50 * M, 'c', { color: 0xe23b3b }],
      ['shoes_black', 'Shiny Black Shoes', 90 * M, 'c', { color: 0x15161d }],
      ['shoes_neon', 'Neon Runners', 350 * M, 'r', { color: 0x7dff4d, shine: 1 }],
      ['shoes_croc', 'Actual Crocodile Boots', 1200 * M, 'e', { color: 0x4d6b2a }],
      ['shoes_gold', '$4B Gold Sneakers', 4 * B, 'l', { color: 0xffc53d, shine: 1 }]
    ]),
    row('hat', [
      ['hat_cap', 'Baseball Cap', 50 * M, 'c', { model: 'cap', color: 0xe23b3b }],
      ['hat_beanie', 'Warm Beanie', 60 * M, 'c', { model: 'beanie', color: 0x37b24d }],
      ['hat_cowboy', 'Oil Baron Hat', 400 * M, 'r', { model: 'cowboy', color: 0x8d5a2b }],
      ['hat_top', 'Silk Top Hat', 700 * M, 'r', { model: 'tophat', color: 0x15161d }],
      ['hat_tall', 'A Hat Taller Than You', 1800 * M, 'e', { model: 'tall', color: 0x6a2bb8 }],
      ['hat_crown', 'The $6B Crown', 6 * B, 'l', { model: 'crown', color: 0xffc53d, shine: 1 }]
    ]),
    row('glasses', [
      ['glasses_round', 'Round Specs', 50 * M, 'c', { model: 'round', color: 0x22242c }],
      ['glasses_shades', 'Dark Shades', 150 * M, 'c', { model: 'shades', color: 0x101014 }],
      ['glasses_star', 'Star Glasses', 500 * M, 'r', { model: 'star', color: 0xff4fa3 }],
      ['glasses_gold', 'Gold Shades', 1500 * M, 'e', { model: 'shades', color: 0xffc53d, shine: 1 }],
      ['glasses_monocle', 'Diamond Monocle', 3 * B, 'l', { model: 'monocle', color: 0xbdf3ff, shine: 1 }]
    ]),
    row('neck', [
      ['neck_silver', 'Silver Chain', 100 * M, 'c', { model: 'chain', color: 0xd7dde3 }],
      ['neck_gold', 'Thick Gold Chain', 400 * M, 'r', { model: 'chain', color: 0xffc53d, shine: 1 }],
      ['neck_pearls', 'Pearls, Enormous', 800 * M, 'r', { model: 'pearls', color: 0xfaf4e8 }],
      ['neck_medal', 'A Medal You Bought', 1200 * M, 'e', { model: 'medal', color: 0xffc53d, shine: 1 }],
      ['neck_diamond', 'The Fist-Sized Diamond', 7 * B, 'l', { model: 'pendant', color: 0xbdf3ff, shine: 1 }]
    ]),
    row('wrist', [
      ['wrist_plastic', 'Plastic Watch', 50 * M, 'c', { color: 0x3da8ff }],
      ['wrist_steel', 'Steel Watch', 200 * M, 'c', { color: 0xc4ccd4 }],
      ['wrist_gold', 'Gold Watch', 900 * M, 'r', { color: 0xffc53d, shine: 1 }],
      ['wrist_ice', 'Watch Made of Diamonds', 4 * B, 'l', { color: 0xbdf3ff, shine: 1 }]
    ]),
    row('fx', [
      ['fx_dust', 'Sparkly Footsteps', 300 * M, 'c', { trail: [0xfff4c2, 0xffffff] }],
      ['fx_hearts', 'Love Trail', 600 * M, 'r', { trail: [0xff4d8d, 0xff9ac4] }],
      ['fx_cash', 'Cash Falls Off You', 1200 * M, 'e', { trail: [0x3ddc6e, 0x9bf0b4] }],
      ['fx_gold', 'Golden Aura', 5 * B, 'l', { trail: [0xffc53d, 0xfff2b0], aura: 1 }]
    ]),
    row('pet', [
      ['pet_pig', 'Pocket Pig', 200 * M, 'c', { model: 'pig' }],
      ['pet_dog', 'Good Dog', 300 * M, 'c', { model: 'dog' }],
      ['pet_cat', 'Unimpressed Cat', 400 * M, 'c', { model: 'cat' }],
      ['pet_penguin', 'Butler Penguin', 900 * M, 'r', { model: 'penguin' }],
      ['pet_tiger', 'Tiger, Probably Tame', 2 * B, 'e', { model: 'tiger' }],
      ['pet_elephant', 'Tiny Elephant', 3 * B, 'e', { model: 'elephant' }],
      ['pet_dragon', 'Small Dragon', 8 * B, 'l', { model: 'dragon' }]
    ])
  );
  var BY_ID = {};
  CATALOG.forEach(function (x) { BY_ID[x.id] = x; });

  return {
    CATALOG: CATALOG, BY_ID: BY_ID,
    SLOTS: ['hair', 'top', 'legs', 'shoes', 'hat', 'glasses', 'neck', 'wrist', 'fx', 'pet'],
    RARITY: { c: 'Common', r: 'Rare', e: 'Epic', l: 'Legendary' },
    BOX_PRICE: 1 * B, BOX_LIMIT: 20,
    BOX_ODDS: [['c', 60], ['r', 28], ['e', 9], ['l', 3]],
    RAIN_THROW: 50 * M, RAIN_LIMIT: 200, RAIN_GAP_MS: 200,
    SHOP_LIMIT: 100 * B    // wardrobe and pets, tested against the catalog
  };
});
