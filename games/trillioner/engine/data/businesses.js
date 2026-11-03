/* Businesses: income per real second (M = $1M/s), usable reward, power. Merged into the catalog by items.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.TRD = root.TRD || {}).businesses = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var M = 1e8;
  return {
    car_dealership: { income: 4 * M, reward: { vehicles: ['sports_car'] }, nature: 'busy' },
    scrapyard_biz: { income: 1 * M, reward: { vehicles: ['monster_truck'] }, nature: 'busy' },
    fireworks_factory: { income: 2 * M, reward: { gear: ['launcher'] }, nature: 'busy' },
    demolition_company: { income: 8 * M, reward: { vehicles: ['wrecking_truck'] }, nature: 'busy' },
    race_track: { income: 6 * M, nature: 'busy' },
    car_factory_biz: { income: 12 * M, nature: 'busy' },
    steel_mill_biz: { income: -9 * M, nature: 'dead' },
    power_station_biz: { income: 10 * M, nature: 'busy' },
    harbour_bridge: { income: 0 },
    metro_line: { income: 3 * M }
  };
});
