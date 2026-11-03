/* Money and clock rules as data. All money is integer cents. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.TRD = root.TRD || {}).rules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var C = 100, K = 1000 * C, M = 1e6 * C, B = 1e9 * C, T = 1e12 * C;
  return {
    C: C, K: K, M: M, B: B, T: T,
    STEP_MS: 100,                     // the engine advances in fixed steps, so frame rate never changes a result
    WIN_BELOW: 1 * M,
    FRENZY_MIN: 100 * M,              // purchases under $100M neither build Frenzy nor pay it
    FRENZY_WINDOW_MS: 5000,
    FRENZY_SPREE_MS: 8000,
    FRENZY_MAX: 10,
    REFUND_CAP: 30 * B, REFUND_MIN: 200 * M, REFUND_MAX: 3 * B, REFUND_GAP_MS: 4000,   // the Refund Office, per day
    FRENZY_EXTRA_CAP: 2 * B,
    BIG_DEAL: 10 * B,                 // closes over time; money leaves at the start
    CLOSE_MIN_MS: 10000,
    CLOSE_MAX_MS: 30000,
    CLOSE_FULL_AT: 100 * B,           // a $100B+ deal takes the full 30 seconds
    DEMOLISH_FEE: 0.4,
    TRUCK_DISCOUNT: 0.2,              // wrecking truck: fee x 0.8 (32% of the purchase price)
    CANNON_PER_S: 200 * M,
    CANNON_CAP: 30 * B,
    PERFECT_WINDOW_MS: 60000,
    FAST_TRAVEL_CD_MS: 15000,
    PAD_REACH: 9,                     // server rejects a purchase farther than this from the pad
    REFUSE_FEE: 1 * B,
    DAMAGE: { prop: 25 * M, car: 200 * M },   // you pay for what you wreck; it counts as spending
    DAMAGE_CAP: 50 * B,
    DAMAGE_CAP_PVP: 5 * B,
    TAX_REFUND_RATE: 0.01,
    TAX_REFUND_CAP: 30 * B,
    CHANGE_FEES: [25, 100, 500, 2000, 10000, 100000, 1000000, 10000000],
    MODES: {
      day:    { label: 'The Day',     start: 1 * T,   secPerHour: 60, startHour: 6, hours: 24, clock: true,  trophies: true, agents: true, jobs: true },
      daily:  { label: 'Daily City',  start: 1 * T,   secPerHour: 60, startHour: 6, hours: 24, clock: true,  trophies: true, agents: true, jobs: true },
      free:   { label: 'Free Roam',   start: 1 * T,   secPerHour: 60, startHour: 6, hours: 24, clock: false, trophies: false },
      battle: { label: 'Battle Spend', start: 300 * B, secPerHour: 20, startHour: 6, hours: 24, clock: true,  trophies: false, pvp: true }
    },
    RANKS: [
      { name: 'Intern', at: 0 }, { name: 'Shopper', at: 1 * B }, { name: 'Big Shot', at: 10 * B },
      { name: 'Tycoon', at: 50 * B }, { name: 'Mogul', at: 100 * B }, { name: 'Oligarch', at: 250 * B },
      { name: 'Whale', at: 500 * B }, { name: 'Trillioner', at: 1 * T }
    ],
    GROWTH: [ // visible character growth by spent total; never changes collision size
      { id: 'crown', at: 10 * B }, { id: 'gold', at: 50 * B }, { id: 'carpet', at: 100 * B },
      { id: 'guards', at: 250 * B }, { id: 'crowd', at: 500 * B }
    ]
  };
});
