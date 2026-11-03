/* The fixed city: 8 districts, roads, named buildings. Same for every seed. North is -Z. Surface spans x,z in [-360,360]. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.TRD = root.TRD || {}).districts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var B = 1e11;
  var UNDER_Y = -60;

  var DISTRICTS = {
    industrial: {
      id: 'industrial', name: 'Industrial Zone', bounds: [-360, 120, 120, 360], budget: 160 * B, visible: 90 * B,
      ground: 0x8d8f91, kerb: 0xa9a9a4, walls: [0x7f8489, 0x9a9d9f, 0xd07a35, 0x6b7076], roofs: [0xe8742a, 0x4f5459, 0xf0a030], neon: 0xff7a1a,
      filler: { shape: 'factory', hMin: 7, hMax: 20, step: 34 },
      spawn: { x: -30, z: 240 },
      buildings: [
        { id: 'dealership', name: 'Motor Mile Dealership', x: -30, z: 214, w: 30, d: 20, h: 11, wall: 0xfafafa, roof: 0xff3b30, door: 's', enter: true, neon: 1 },
        { id: 'car_factory', name: 'Car Factory', x: 62, z: 300, w: 44, d: 36, h: 18, wall: 0x9aa0a6, roof: 0xf0a030, door: 'n', enter: true, neon: 1 },
        { id: 'steel_mill', name: 'Failing Steel Mill', x: -190, z: 304, w: 44, d: 34, h: 20, wall: 0x6d5e54, roof: 0x4a4038, door: 'n', enter: true, boarded: 1 },
        { id: 'scrapyard', name: 'Scrapyard Office', x: -300, z: 176, w: 22, d: 16, h: 8, wall: 0xb07f4a, roof: 0x6b4d2c, door: 's', enter: true },
        { id: 'race_pit', name: 'Race Track Pit', x: -300, z: 300, w: 26, d: 18, h: 9, wall: 0xf6f6f6, roof: 0x1f1f1f, door: 'n', enter: true, neon: 1 },
        { id: 'fireworks', name: 'Fireworks Factory', x: -180, z: 176, w: 24, d: 18, h: 9, wall: 0xdf3b57, roof: 0xffd24a, door: 's', neon: 1 },
        { id: 'demolition_co', name: 'Demolition Company', x: 66, z: 176, w: 26, d: 18, h: 10, wall: 0xf2c200, roof: 0x222222, door: 's' },
        { id: 'power_station', name: 'Power Station', x: -96, z: 324, w: 40, d: 30, h: 16, wall: 0x7a8aa0, roof: 0x3a4a5a, door: 'n', project: 1 }
      ],
      stalls: [
        { id: 'parts_row', name: 'Motor Mile Parts Row', x: -92, z: 226, cols: 6, dir: 'x' },
        { id: 'tyre_yard', name: "Big Rick's Tyre Yard", x: 30, z: 256, cols: 6, dir: 'x' },
        { id: 'freight_row', name: 'Freight Sidings Lots', x: -250, z: 256, cols: 6, dir: 'x' },
        { id: 'lobby_lots_ind', name: 'Permit Office Plots', x: -60, z: 348, cols: 7, dir: 'x' }
      ],
      change: { x: 6, z: 226 },
      landmarks: [
        { kind: 'chimney', x: -130, z: 300, h: 92, r: 8 },
        { kind: 'bigsign', text: 'MOTOR MILE', x: -100, z: 232, h: 22, w: 44 }
      ]
    }
  };

  // Main streets. Polylines; w is full width. Traffic drives these too.
  var ROADS = [
    { d: 'industrial', w: 16, pts: [[-360, 240], [120, 240]], name: 'Motor Mile' },
    { w: 12, pts: [[-360, 120], [360, 120]] },
    { w: 12, pts: [[-240, 120], [-240, 346]] },
    { w: 12, pts: [[-120, 120], [-120, 346]] },
    { w: 12, pts: [[0, 120], [0, 346]] },
    { w: 12, pts: [[120, 120], [120, 346]] }
  ];

  return { DISTRICTS: DISTRICTS, ROADS: ROADS, UNDER_Y: UNDER_Y, B: B, SURFACE: 360 };
});
