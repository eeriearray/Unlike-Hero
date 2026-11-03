/* Builds one run's city from a seed. Fixed: layout, landmarks, rules, core chains. Filled in further at M5. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rng.js'), require('./data/rules.js'), require('./data/districts.js'), require('./data/items.js'), require('./layout.js'), require('./data/secrets.js'), require('./data/events.js'));
  else root.TrillionerShuffle = factory(root.TrillionerRng, root.TRD.rules, root.TRD.districts, root.TRD.items, root.TrillionerLayout, root.TRD.secrets, root.TRD.events);
})(typeof self !== 'undefined' ? self : this, function (RngMod, R, D, Items, Layout, Secrets, EventsData) {
  'use strict';

  function buildRun(seed) {
    var rng = new RngMod.Rng(typeof seed === 'number' ? seed : RngMod.hash(seed));
    var list = Items.build();
    var items = {};
    list.forEach(function (it) { items[it.id] = it; });
    var lay = Layout.layout(list);
    var d0 = D.DISTRICTS.downtown;
    var districtSpawn = {};
    Object.keys(D.DISTRICTS).forEach(function (k) { var s = D.DISTRICTS[k].spawn; districtSpawn[k] = { x: s.x, y: D.DISTRICTS[k].level === 'under' ? D.UNDER_Y : 0, z: s.z }; });
    return {
      seed: seed, items: items, list: list, sites: lay.sites, padPos: lay.padPos, secrets: {}, clues: [], events: [], fog: [], rain: [], windows: {},
      spawn: { x: d0.spawn.x, y: 0, z: d0.spawn.z }, districtSpawn: districtSpawn
    };
  }
  return { buildRun: buildRun };
});
