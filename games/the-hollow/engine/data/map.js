/* THE HOLLOW — the map: routes between the 42 places.
 * Edge forms: [a, b], [a, b, { type, ... }].  type: path (default) | hidden | locked | guarded.  oneway: true = a → b only.
 *  hidden : not drawn until revealed (Investigate, Lantern, Echo, or an event). dc = Wit needed to find it with Investigate.
 *  locked : visible but shut. `ways` lists every way to open it; at least one needs no special item.
 *  guarded: passable only once one of the flags in `until` is set (e.g. the Warden defeated).
 * Every route into the Heart is reachable with no item at all (see test/the-hollow-engine.test.mjs).
 */
(function (g) {
  'use strict';
  var D = g.HollowData = g.HollowData || {};

  D.start = 'square';
  D.corridorTargets = ['observatory', 'treasury', 'mirror', 'library'];
  D.regionLabels = {
    village: [230, 440], estate: [240, 100], woods: [700, 790], abbey: [690, 70], crypt: [1020, 810], heart: [1040, 20]
  };

  D.edges = [
    // The Dying Village
    ['square', 'chapel'], ['square', 'graveyard'], ['square', 'belltower'], ['square', 'nursery'], ['square', 'wagon'],
    ['chapel', 'graveyard'], ['belltower', 'bridge'], ['wagon', 'bridge'], ['wagon', 'gate'], ['nursery', 'gate'],
    ['chapel', 'library', { type: 'hidden', dc: 12, trap: { stat: 'wit', dc: 12, san: -1, t: 'The crawlway is full of a whispering you did not agree to.' }, label: 'Tithe crawlway' }],
    ['graveyard', 'foyer', { label: 'The black road' }],

    // The Black Estate
    ['foyer', 'library'], ['foyer', 'mirror'], ['library', 'mirror'], ['library', 'observatory'], ['mirror', 'treasury'], ['foyer', 'corridor'], ['treasury', 'blackmarket'],
    ['foyer', 'blackmarket', { type: 'locked', label: 'The cellar door', ways: [
      { id: 'pay', label: 'Pay the doorkeeper 2 Silver', cost: { silver: 2 } },
      { id: 'pick', label: 'Pick the cellar lock', stat: 'wit', dc: 11 },
      { id: 'key', label: 'Turn the Spirit Key', item: 'spirit_key', cost: { san: 1 } }] }],
    ['observatory', 'ritual', { type: 'locked', label: 'The star-door', ways: [
      { id: 'lens', label: 'Fit the Star Lens', item: 'star_lens' },
      { id: 'stars', label: 'Walk the aligned stars', flag: 'stars_aligned' },
      { id: 'force', label: 'Break the star-door', stat: 'might', dc: 15 },
      { id: 'key', label: 'Turn the Spirit Key', item: 'spirit_key', cost: { san: 1 } }] }],
    ['mirror', 'fountain', { type: 'hidden', dc: 13, label: 'Through the glass', trap: { stat: 'fate', dc: 12, san: -1, t: 'You come out of the glass a half-step out of phase with yourself.' } }],

    // The Whispering Woods
    ['bridge', 'forest'], ['forest', 'cabin'], ['forest', 'orchard'], ['forest', 'battlefield'], ['cabin', 'garden'], ['garden', 'moonwell'], ['orchard', 'moonwell'],
    ['orchard', 'shrine'], ['battlefield', 'shrine'],
    ['forest', 'moonwell', { type: 'hidden', dc: 11, label: 'The trees\' curtsey' }],
    ['cabin', 'battlefield', { type: 'hidden', dc: 10, label: 'Hob\'s trail' }],
    ['shrine', 'nave', { label: 'The Pilgrim\'s Way' }],
    ['moonwell', 'flooded_hall', { type: 'hidden', oneway: true, dc: 12, label: 'The second moon\'s door', trap: { stat: 'might', dc: 12, vit: -2, t: 'You fall a long way, into water the temperature of an opinion.' } }],

    // The Forsaken Abbey
    ['nave', 'fountain'], ['nave', 'altar'], ['nave', 'reliquary'], ['fountain', 'ritual'], ['fountain', 'prison'], ['altar', 'ritual'], ['ritual', 'prison'],
    ['reliquary', 'warden'], ['altar', 'warden'],
    ['warden', 'sealed_crypt', { type: 'guarded', until: ['warden_down', 'warden_bypassed'], label: 'The Warden\'s stair' }],
    ['prison', 'sealed_crypt', { type: 'hidden', dc: 13, label: 'The oubliette', trap: { stat: 'might', dc: 12, vit: -2, t: 'The oubliette is a drop of ten feet, with a landing.' } }],

    // The Sunken Crypt
    ['sealed_crypt', 'ossuary'], ['ossuary', 'sunken_archive'], ['sunken_archive', 'flooded_hall'], ['flooded_hall', 'tomb'], ['sealed_crypt', 'tomb'], ['ossuary', 'nameless_door'],
    ['tomb', 'hidden_passage', { type: 'hidden', dc: 12, label: 'Behind the tomb wall' }],
    ['hidden_passage', 'stair'],
    ['nameless_door', 'stair', { type: 'locked', label: 'The Nameless Door', ways: [
      { id: 'name', label: 'Speak the bell\'s name', flag: 'bell_named' },
      { id: 'wkey', label: 'Turn the Warden\'s Key', item: 'wardens_key' },
      { id: 'key', label: 'Turn the Spirit Key', item: 'spirit_key', cost: { san: 1 } },
      { id: 'force', label: 'Force the door', stat: 'might', dc: 17 }] }],
    ['blackmarket', 'ossuary', { type: 'locked', label: 'The cellar stair', ways: [
      { id: 'pay', label: 'Pay 4 Silver to the stair-keeper', cost: { silver: 4 } },
      { id: 'force', label: 'Force the cellar stair', stat: 'might', dc: 14 },
      { id: 'key', label: 'Turn the Spirit Key', item: 'spirit_key', cost: { san: 1 } }] }],

    // The Heart of the Hollow
    ['stair', 'hall_of_names'], ['stair', 'still_lake'], ['hall_of_names', 'forge'], ['still_lake', 'pit'], ['forge', 'heart_chamber'],
    ['hall_of_names', 'heart_chamber', { type: 'locked', label: 'The unlocked door', ways: [
      { id: 'names', label: 'The name is spoken', flag: 'names_spoken' },
      { id: 'force', label: 'Force the door', stat: 'might', dc: 16 },
      { id: 'key', label: 'Turn the Spirit Key', item: 'spirit_key', cost: { san: 1 } }] }],
    ['pit', 'heart_chamber', { oneway: true, label: 'The drop', trap: { stat: 'might', dc: 11, vit: -2, t: 'You jump, and land on something that was not a floor.' } }]
  ];
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
