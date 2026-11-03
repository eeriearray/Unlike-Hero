/* Trophies by amount spent, plus fun bonus trophies. Bonus tests read only the player's own state. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules.js'));
  else (root.TRD = root.TRD || {}).trophies = factory(root.TRD.rules);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';
  var B = R.B;
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
    { id: 'perfect_zero', name: 'Perfect Zero', manual: 1, desc: 'Exactly $0.00, income exactly $0' }
  ];
  return { TROPHIES: T };
});
