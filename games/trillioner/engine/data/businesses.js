/* Businesses: income per real second (M = $1M/s), usable reward, power. Merged into the catalog by items.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.TRD = root.TRD || {}).businesses = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var M = 1e8;
  return {
    // Usable things from the brief
    skate_shop_biz: { income: 1 * M, reward: { vehicles: ['hoverboard'] }, nature: 'busy' },
    car_dealership: { income: 4 * M, reward: { vehicles: ['sports_car'] }, nature: 'busy' },
    pizza_chain: { income: 3 * M, reward: { vehicles: ['scooter'] }, nature: 'busy' },
    scrapyard_biz: { income: 1 * M, reward: { vehicles: ['monster_truck'] }, nature: 'busy' },
    fire_department: { income: 0, reward: { vehicles: ['ladder_truck'] } },
    zoo_biz: { income: -2 * M, reward: { vehicles: ['elephant'] }, nature: 'dead' },
    boatyard_biz: { income: 6 * M, reward: { vehicles: ['speedboat', 'submarine'] }, nature: 'busy' },
    helicopter_company: { income: 15 * M, reward: { vehicles: ['helicopter'] }, nature: 'busy' },
    fireworks_factory: { income: 2 * M, reward: { gear: ['launcher'] }, nature: 'busy' },
    demolition_company: { income: 8 * M, reward: { vehicles: ['wrecking_truck'] }, nature: 'busy' },
    mint: { income: 50 * M, reward: { gear: ['money_cannon'] }, nature: 'busy' },
    mole_machine: { income: 0, reward: { vehicles: ['mole_machine'] } },
    // Powers
    bank: { income: 25 * M, power: 'instantClose', nature: 'busy' },
    airline: { income: 40 * M, power: 'fastTravel', nature: 'busy' },
    newspaper_biz: { income: 5 * M, power: 'editions', nature: 'busy' },
    phone_company: { income: 35 * M, power: 'phoneMap', nature: 'busy' },
    observatory_biz: { income: 0, power: 'observatory' },
    brokers_licence: { income: 0, power: 'broker' },
    lobby_firm: { income: 2 * M, power: 'lobby', nature: 'busy' },
    asteroid_mining: { income: 120 * M, nature: 'busy' },
    // Downtown
    corner_nw: { income: 3 * M, nature: 'busy' }, corner_ne: { income: 3 * M, nature: 'busy' }, corner_sw: { income: 3 * M, nature: 'busy' }, corner_se: { income: 3 * M, nature: 'busy' },
    soda_giant: { income: 20 * M, nature: 'busy' }, burger_empire: { income: 12 * M, nature: 'busy' },
    streaming_service: { income: -10 * M, nature: 'dead' }, social_app: { income: -14 * M, nature: 'dead' }, crypto_exchange: { income: -6 * M, nature: 'dead' },
    // Luxury Row
    grand_hotel_biz: { income: 4 * M, nature: 'busy' }, fashion_house_biz: { income: 3 * M, nature: 'busy' },
    // Suburbs
    wonderland_park: { income: -15 * M, nature: 'dead' }, stadium_biz: { income: 6 * M, nature: 'busy' },
    // Industrial
    race_track: { income: 6 * M, nature: 'busy' }, car_factory_biz: { income: 12 * M, nature: 'busy' }, steel_mill_biz: { income: -9 * M, nature: 'dead' },
    power_station_biz: { income: 10 * M, nature: 'busy' }, metro_line: { income: 3 * M, nature: 'busy' },
    // Harbour
    yacht_fleet: { income: 2 * M, nature: 'busy' }, cruise_line: { income: 10 * M, nature: 'busy' }, container_port: { income: 18 * M, nature: 'busy' }, aquarium_biz: { income: 1 * M, nature: 'busy' },
    // Airport
    jet_fleet: { income: 4 * M, nature: 'busy' }, mars_hotel: { income: 2 * M, nature: 'busy' },
    // Old Town
    museum_biz: { income: -1 * M, nature: 'dead' }, theatre_biz: { income: -1 * M, nature: 'dead' },
    // Under City
    gold_train: { income: 3 * M, reward: { vehicles: ['private_train'] }, nature: 'busy' }, secret_casino_biz: { income: -12 * M, nature: 'dead' }, lake_resort_biz: { income: 4 * M, nature: 'busy' }
  };
});
