/* The fixed city: 8 districts, roads, named buildings. Same for every seed. North is -Z. Surface spans x,z in [-360,360]. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.TRD = root.TRD || {}).districts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var B = 1e11;
  var UNDER_Y = -60, DEEP_Y = -92;

  var DISTRICTS = {
    downtown: {
      id: 'downtown', name: 'Downtown', bounds: [-120, -120, 120, 120], budget: 360 * B, visible: 57 * B,
      ground: 0xd9cfa8, walls: [0xf2c94c, 0xe0b23a, 0xc9d6e8, 0xf7dd8a], roofs: [0xd59a14, 0xfff0b0, 0x8fb2d9], neon: 0xe0a100, prop: 'lamp', crowd: 34,
      filler: { shape: 'tower', hMin: 26, hMax: 62, step: 24, gap: 0.14 }, spawn: { x: -60, z: 8 }, palette: [0xfff3d6, 0xc99b3b, 0xffe9a8],
      buildings: [
        { id: 'hotel', name: 'The Starting Hotel', x: -60, z: 30, w: 32, d: 22, h: 30, wall: 0xfff0c4, roof: 0xd59a14, door: 'n', enter: 1, neon: 1 },
        { id: 'trillion_tower', name: 'Trillion Tower', x: 60, z: -62, w: 36, d: 36, h: 132, wall: 0xffc53d, roof: 0xfff0b0, door: 's', enter: 1, neon: 1, helipad: 1 },
        { id: 'bank', name: 'Bank of Everything', x: -60, z: -62, w: 36, d: 24, h: 26, wall: 0xeae6d8, roof: 0x7d8fa8, door: 's', enter: 1 },
        { id: 'exchange', name: 'Stock Exchange', x: 60, z: 48, w: 40, d: 26, h: 22, wall: 0xfafafa, roof: 0x3d6cb9, door: 'n', enter: 1, neon: 1 },
        { id: 'city_hall', name: 'City Hall', x: -60, z: 88, w: 38, d: 24, h: 22, wall: 0xdedcd3, roof: 0x6e8f6a, door: 'n', enter: 1 },
        { id: 'mint', name: 'The Mint', x: 28, z: -100, w: 24, d: 14, h: 16, wall: 0xb8c4b0, roof: 0x4f7a4f, door: 's' },
        { id: 'phone_co', name: 'Phone Company', x: -24, z: -100, w: 22, d: 14, h: 28, wall: 0x7ad0ff, roof: 0x2d7fb5, door: 's', hiddenSign: 1 },
        { id: 'corner_nw', name: 'Corner Tower NW', x: -104, z: -104, w: 16, d: 16, h: 78, wall: 0xffd96a, roof: 0x222222, door: 'e', twin: 1 },
        { id: 'corner_ne', name: 'Corner Tower NE', x: 104, z: -104, w: 16, d: 16, h: 78, wall: 0xffd96a, roof: 0x222222, door: 'w', twin: 1 },
        { id: 'corner_sw', name: 'Corner Tower SW', x: -104, z: 104, w: 16, d: 16, h: 78, wall: 0xffd96a, roof: 0x222222, door: 'e', twin: 1 },
        { id: 'corner_se', name: 'Corner Tower SE', x: 104, z: 104, w: 16, d: 16, h: 78, wall: 0xffd96a, roof: 0x222222, door: 'w', twin: 1 }
      ],
      stalls: [
        { id: 'plaza_shops', name: 'Golden Plaza Shops', x: -60, z: -24, cols: 7, dir: 'x' },
        { id: 'tower_shops', name: 'Tower Row Boutiques', x: 60, z: -24, cols: 7, dir: 'x' },
        { id: 'alley_shop', name: 'Unmarked Alley Shop', x: 96, z: 72, cols: 3, dir: 'x', spacing: 5 }
      ],
      change: { x: 22, z: 22 },
      stairs: [{ x: -84, z: 30, to: 30, dir: 'e', len: 8 }],
      landmarks: [{ kind: 'screen', text: 'SPEND MORE', x: 60, z: 16, h: 18, w: 36 }]
    },
    luxury: {
      id: 'luxury', name: 'Luxury Row', bounds: [120, -120, 360, 120], budget: 260 * B, visible: 59 * B,
      ground: 0xf4c9d6, walls: [0xffb3c7, 0xffd6e0, 0xf7e7ee, 0xe89ab3], roofs: [0xd6547c, 0xfff0f4, 0xc73e6b], neon: 0xe0407e, prop: 'palm', crowd: 28,
      filler: { shape: 'villa', hMin: 10, hMax: 22, step: 28, gap: 0.2 }, spawn: { x: 180, z: 0 }, palette: [0xfff0f4, 0xd6547c, 0xffe0ea],
      buildings: [
        { id: 'global_trade', name: 'Global Trade Tower', x: 240, z: -64, w: 40, d: 34, h: 96, wall: 0xf7e7ee, roof: 0xd6547c, door: 's', enter: 1, neon: 1 },
        { id: 'dept_store', name: 'Grandiose Department Store', x: 180, z: 64, w: 40, d: 28, h: 20, wall: 0xffd6e0, roof: 0xc73e6b, door: 'n', enter: 1, neon: 1, wholeStore: 1 },
        { id: 'art_gallery', name: 'The Very Expensive Gallery', x: 300, z: 64, w: 38, d: 28, h: 18, wall: 0xfafafa, roof: 0xb48ad6, door: 'n', enter: 1, wholeStore: 1 },
        { id: 'grand_hotel', name: 'Grand Hotel', x: 310, z: -64, w: 32, d: 28, h: 40, wall: 0xffb3c7, roof: 0xfff0f4, door: 's', enter: 1, neon: 1 },
        { id: 'embassy', name: 'The Embassy', x: 166, z: -66, w: 32, d: 26, h: 18, wall: 0xf4f0e8, roof: 0x8a6d3b, door: 's', enter: 1 },
        { id: 'fashion_house', name: 'Fashion House', x: 240, z: 94, w: 22, d: 16, h: 16, wall: 0xe89ab3, roof: 0x222222, door: 'n' }
      ],
      stalls: [
        { id: 'jewel_row', name: 'Jewellery Row', x: 180, z: 24, cols: 6, dir: 'x' },
        { id: 'tailor_row', name: 'The Tailor and Friends', x: 300, z: 24, cols: 6, dir: 'x' }
      ],
      change: { x: 240, z: 22 },
      stairs: [{ x: 188, z: -66, to: 18, dir: 'w', len: 6 }],
      landmarks: [{ kind: 'globe', x: 240, z: 26, r: 7 }]
    },
    suburbs: {
      id: 'suburbs', name: 'Suburbs', bounds: [-360, -360, -120, 120], budget: 200 * B, visible: 147 * B,
      ground: 0x7ecb5e, walls: [0xffd6a5, 0xbde0fe, 0xcaffbf, 0xffc8dd, 0xfdffb6], roofs: [0xe56b6f, 0x6d9dc5, 0x8e7dbe], neon: 0xff8fab, prop: 'tree', crowd: 22,
      filler: { shape: 'house', hMin: 5, hMax: 8, step: 24, gap: 0.2 }, spawn: { x: -180, z: 0 }, palette: [0xfffbe0, 0x8bbf6a, 0xfff2c4],
      buildings: [
        { id: 'mansion', name: 'Show Mansion', x: -200, z: 60, w: 36, d: 24, h: 14, wall: 0xfff5e0, roof: 0xe56b6f, door: 'n', enter: 1 },
        { id: 'school', name: 'Suburb School', x: -310, z: 60, w: 36, d: 22, h: 11, wall: 0xf4b183, roof: 0x7a4a2b, door: 'n', enter: 1 },
        { id: 'zoo', name: 'City Zoo', x: -200, z: -66, w: 40, d: 30, h: 8, wall: 0xa7d489, roof: 0x4c8c4a, door: 's', enter: 1, boarded: 0 },
        { id: 'pizza_hq', name: 'Pizza HQ', x: -300, z: -60, w: 30, d: 20, h: 13, wall: 0xff7a59, roof: 0xfff0a8, door: 's', enter: 1, neon: 1 },
        { id: 'wonderland', name: 'Wonderland Park', x: -210, z: -210, w: 34, d: 22, h: 9, wall: 0xc9a0dc, roof: 0x5b3a7a, door: 's', enter: 1, boarded: 1 },
        { id: 'observatory', name: 'Hilltop Observatory', x: -312, z: -316, y: 18, w: 22, d: 22, h: 9, wall: 0xf0f2f6, roof: 0x4a6fa5, door: 's', enter: 1 },
        { id: 'skate_shop', name: 'Skate Shop', x: -150, z: 86, w: 18, d: 12, h: 7, wall: 0xffe066, roof: 0x444444, door: 'n', neon: 1 },
        { id: 'stadium', name: 'The Stadium', x: -170, z: -310, w: 60, d: 48, h: 16, wall: 0xdfe6ee, roof: 0x3b7dd8, door: 's', project: 1 }
      ],
      stalls: [
        { id: 'estate_agents', name: 'Mansions For Sale', x: -240, z: 22, cols: 8, dir: 'x' },
        { id: 'block_sales', name: 'Whole Neighbourhoods', x: -300, z: -130, cols: 7, dir: 'x' },
        { id: 'park_lots', name: 'Parks Department Lots', x: -180, z: -130, cols: 6, dir: 'x', spacing: 7 },
        { id: 'garage_sale', name: 'Suspicious Garage Sale', x: -150, z: 40, cols: 2, dir: 'x', spacing: 5 },
        { id: 'buried_safe', name: 'Buried Safe', x: -330, z: 100, cols: 2, dir: 'x', spacing: 5 }
      ],
      change: { x: -150, z: -26 },
      stairs: [{ x: -180, z: 40, to: 14, dir: 's', len: 8 }],
      hill: { x: -312, z: -316, steps: 26, rise: 0.7, top: 30, run: 3 },
      landmarks: [{ kind: 'ferris', x: -252, z: -226, r: 20 }]
    },
    industrial: {
      id: 'industrial', name: 'Industrial Zone', bounds: [-360, 120, 120, 360], budget: 160 * B, visible: 88 * B,
      ground: 0x8d8f91, walls: [0x7f8489, 0x9a9d9f, 0xd07a35, 0x6b7076], roofs: [0xe8742a, 0x4f5459, 0xf0a030], neon: 0xff7a1a, prop: 'crate', crowd: 14,
      filler: { shape: 'factory', hMin: 7, hMax: 20, step: 30, gap: 0.2 }, spawn: { x: -30, z: 240 }, palette: [0xc9ccd0, 0x6b7076, 0xe8e0d0],
      buildings: [
        { id: 'dealership', name: 'Motor Mile Dealership', x: -30, z: 214, w: 30, d: 20, h: 11, wall: 0xfafafa, roof: 0xff3b30, door: 's', enter: 1, neon: 1, wholeStore: 1 },
        { id: 'car_factory', name: 'Car Factory', x: 62, z: 300, w: 44, d: 36, h: 18, wall: 0x9aa0a6, roof: 0xf0a030, door: 'n', enter: 1, neon: 1 },
        { id: 'steel_mill', name: 'Failing Steel Mill', x: -190, z: 304, w: 44, d: 34, h: 20, wall: 0x6d5e54, roof: 0x4a4038, door: 'n', enter: 1, boarded: 1 },
        { id: 'scrapyard', name: 'Scrapyard Office', x: -300, z: 176, w: 22, d: 16, h: 8, wall: 0xb07f4a, roof: 0x6b4d2c, door: 's', enter: 1 },
        { id: 'race_pit', name: 'Race Track Pit', x: -300, z: 300, w: 26, d: 18, h: 9, wall: 0xf6f6f6, roof: 0x1f1f1f, door: 'n', enter: 1, neon: 1 },
        { id: 'fireworks', name: 'Fireworks Factory', x: -180, z: 176, w: 24, d: 18, h: 9, wall: 0xdf3b57, roof: 0xffd24a, door: 's', neon: 1 },
        { id: 'demolition_co', name: 'Demolition Company', x: 66, z: 176, w: 26, d: 18, h: 10, wall: 0xf2c200, roof: 0x222222, door: 's' },
        { id: 'power_station', name: 'Power Station', x: -96, z: 324, w: 40, d: 30, h: 16, wall: 0x7a8aa0, roof: 0x3a4a5a, door: 'n', project: 1 }
      ],
      stalls: [
        { id: 'parts_row', name: 'Motor Mile Parts Row', x: -92, z: 226, cols: 6, dir: 'x' },
        { id: 'tyre_yard', name: "Big Rick's Tyre Yard", x: 30, z: 256, cols: 6, dir: 'x' },
        { id: 'freight_row', name: 'Freight Sidings Lots', x: -250, z: 256, cols: 6, dir: 'x' },
        { id: 'lobby_lots_ind', name: 'Permit Office Plots', x: -40, z: 346, cols: 7, dir: 'x' },
        { id: 'crane_deal', name: 'Rusted Crane Deal', x: -270, z: 216, y: 28.6, cols: 2, dir: 'x', spacing: 4 }
      ],
      change: { x: 12, z: 226 },
      stairs: [{ x: -285, z: 194, to: 8, dir: 'n', len: 10 }],
      landmarks: [
        { kind: 'chimney', x: -130, z: 300, h: 92, r: 8 },
        { kind: 'bigsign', text: 'MOTOR MILE', x: -100, z: 232, h: 22, w: 44 },
        { kind: 'crane', x: -270, z: 216, h: 28, label: 'rusted' }
      ]
    },
    harbour: {
      id: 'harbour', name: 'Harbour', bounds: [120, 120, 360, 360], land: [120, 120, 306, 282], budget: 120 * B, visible: 12 * B,
      ground: 0xcbb994, walls: [0x4a90c2, 0xe25c4f, 0xf2c14e, 0x5fb49c], roofs: [0x2d5f86, 0x8d3a33, 0xa07a22], neon: 0x2ad0ff, prop: 'bollard', crowd: 18,
      filler: { shape: 'container', hMin: 5, hMax: 11, step: 22, gap: 0.3 }, spawn: { x: 180, z: 136 }, palette: [0xe2f2fa, 0x3f7fa8, 0xbfe6f5],
      buildings: [
        { id: 'boatyard', name: 'Boatyard', x: 170, z: 252, w: 34, d: 24, h: 12, wall: 0xc9855a, roof: 0x7a4a2b, door: 'n', enter: 1 },
        { id: 'aquarium', name: 'City Aquarium', x: 262, z: 172, w: 34, d: 24, h: 13, wall: 0x56c7e8, roof: 0x1d7ea3, door: 'w', enter: 1, neon: 1 },
        { id: 'lighthouse', name: 'Red Lighthouse', x: 288, z: 262, w: 14, d: 14, h: 8, wall: 0xf2f2f2, roof: 0xd9352c, door: 'w', enter: 1 },
        { id: 'auction_hall', name: 'Harbour Auction Hall', x: 168, z: 170, w: 36, d: 24, h: 14, wall: 0xb5453c, roof: 0x5c211c, door: 's', enter: 1 },
        { id: 'cruise_terminal', name: 'Cruise Terminal', x: 240, z: 244, w: 34, d: 28, h: 14, wall: 0xf4f6fa, roof: 0x3f7fa8, door: 'n', enter: 1, neon: 1 }
      ],
      stalls: [
        { id: 'pier_stalls', name: 'Pier Stalls', x: 214, z: 296, cols: 2, dir: 'z', spacing: 8 },
        { id: 'dock_lots', name: 'Timed Dock Lots', x: 190, z: 208, cols: 6, dir: 'x' },
        { id: 'vault_lots', name: 'Treasure Auction', x: 262, z: 136, cols: 5, dir: 'x', spacing: 7 }
      ],
      change: { x: 224, z: 136 },
      stairs: [{ x: 144, z: 170, to: 14, dir: 'e', len: 6 }],
      pier: { x: 214, z0: 282, z1: 348, w: 10 },
      landmarks: [{ kind: 'lighthouse', x: 288, z: 262, h: 50 }, { kind: 'crane', x: 150, z: 276, h: 46, label: 'container' }]
    },
    airport: {
      id: 'airport', name: 'Airport + Spaceport', bounds: [120, -360, 360, -120], budget: 120 * B, visible: 60 * B,
      ground: 0xe6edf2, walls: [0xfafcff, 0xc7dcef, 0x9fc3e0], roofs: [0x3d8bd4, 0xf4f8fb], neon: 0x2f9de0, prop: 'beacon', crowd: 14,
      filler: { shape: 'hangar', hMin: 8, hMax: 12, step: 40, gap: 0.55 }, spawn: { x: 150, z: -136 }, palette: [0xf6fbff, 0x9fc3e0, 0xe2f0fb],
      buildings: [
        { id: 'terminal', name: 'Airport Terminal', x: 180, z: -178, w: 46, d: 26, h: 14, wall: 0xfafcff, roof: 0x3d8bd4, door: 's', enter: 1, neon: 1 },
        { id: 'control_tower', name: 'Control Tower', x: 268, z: -160, w: 14, d: 14, h: 44, wall: 0xc7dcef, roof: 0x223a52, door: 's', enter: 1 },
        { id: 'mission_control', name: 'Mission Control', x: 322, z: -178, w: 30, d: 24, h: 13, wall: 0xdfe8ef, roof: 0x444e5a, door: 's', enter: 1, neon: 1 },
        { id: 'hangar_13', name: 'Hangar 13', x: 322, z: -326, w: 30, d: 24, h: 12, wall: 0x7c8a96, roof: 0x4a5560, door: 's', enter: 1, walled: 1 }
      ],
      stalls: [
        { id: 'airport_deals', name: 'Airport Deals', x: 196, z: -138, cols: 6, dir: 'x', spacing: 7 },
        { id: 'jetpack_shop', name: 'Hidden Gear Locker', x: 140, z: -340, cols: 2, dir: 'x', spacing: 5 }
      ],
      change: { x: 300, z: -134 },
      stairs: [{ x: 196, z: -198, to: 14, dir: 's', len: 7 }],
      runways: [{ x: 200, z: -270, w: 130, d: 18 }, { x: 330, z: -250, w: 40, d: 40, pad: 1 }],
      landmarks: [{ kind: 'rocket', x: 330, z: -250, h: 92 }]
    },
    oldtown: {
      id: 'oldtown', name: 'Old Town', bounds: [-120, -360, 120, -120], budget: 60 * B, visible: 17 * B,
      ground: 0xc8a27a, walls: [0xb5533c, 0xc66f4e, 0xa84832, 0xd18a5a], roofs: [0x6b3a26, 0x7d4a2c, 0x54301f], neon: 0xffb347, prop: 'lantern', crowd: 20,
      filler: { shape: 'brick', hMin: 8, hMax: 19, step: 22, gap: 0.15 }, spawn: { x: 0, z: -136 }, palette: [0xf2dfc6, 0x7d4a2c, 0xd9b48f],
      buildings: [
        { id: 'newspaper', name: 'The Daily Receipt', x: -62, z: -170, w: 32, d: 22, h: 16, wall: 0xd9c9a8, roof: 0x6b3a26, door: 's', enter: 1, neon: 1 },
        { id: 'museum', name: 'Museum of Old Things', x: -68, z: -290, w: 36, d: 26, h: 16, wall: 0xe6dcc8, roof: 0x7d4a2c, door: 's', enter: 1 },
        { id: 'theatre', name: 'The Creaky Theatre', x: 68, z: -292, w: 34, d: 26, h: 15, wall: 0xa83f3f, roof: 0x54301f, door: 's', enter: 1, neon: 1 },
        { id: 'fire_station', name: 'Fire Station', x: 68, z: -172, w: 30, d: 22, h: 11, wall: 0xc9302c, roof: 0x7d1c19, door: 's', enter: 1 },
        { id: 'laundromat', name: 'Spin City Laundromat', x: -20, z: -338, w: 24, d: 16, h: 8, wall: 0x9fd3c7, roof: 0x4b8378, door: 's', enter: 1, neon: 1 },
        { id: 'club_house', name: 'Tall Brick House', x: 22, z: -200, w: 24, d: 22, h: 24, wall: 0x8c4a33, roof: 0x3a2115, door: 'w', roofStall: 1 }
      ],
      stalls: [
        { id: 'antique_row', name: 'Antique Row', x: -62, z: -134, cols: 4, dir: 'x', spacing: 6 },
        { id: 'collectors_club', name: "Collectors' Club", x: 22, z: -206, y: 24.8, cols: 4, dir: 'x', spacing: 4.6 },
        { id: 'night_market', name: 'Night Market', x: 60, z: -240, cols: 7, dir: 'x' },
        { id: 'private_club', name: 'The Private Club', x: -60, z: -240, cols: 5, dir: 'x' }
      ],
      change: { x: 40, z: -134 },
      stairs: [{ x: -84, z: -170, to: 16, dir: 'e', len: 6 }],
      landmarks: [{ kind: 'clock', x: 36, z: -258, h: 72 }]
    },
    under: {
      id: 'under', name: 'Under City', level: 'under', bounds: [-360, -360, 360, 360], budget: 120 * B, visible: 0,
      ground: 0x2c1a4a, walls: [0x4a2d7a, 0x5d3a94, 0x3a2360], roofs: [0x7a4fc0, 0x8f5fd6], neon: 0xc77dff, prop: 'mushroom', crowd: 18,
      spawn: { x: 0, z: 40 }, palette: [0x3a2360, 0x2c1a4a, 0x7a4fc0],
      entrances: [
        { id: 'laundromat', x: -20, z: -300, surface: { x: -20, z: -322 } },
        { id: 'harbour', x: 150, z: 220, surface: { x: 134, z: 230 } },
        { id: 'factory', x: 40, z: 250, surface: { x: 96, z: 268 } }
      ],
      buildings: [
        { id: 'under_station', name: 'Forgotten Station', x: 0, z: 0, w: 42, d: 22, h: 12, wall: 0x5d3a94, roof: 0xc77dff, door: 's', enter: 1, neon: 1 },
        { id: 'bazaar', name: 'The Great Bazaar', x: -90, z: 40, w: 54, d: 40, h: 14, wall: 0x7a2d8a, roof: 0xffb347, door: 'e', enter: 1, neon: 1, wholeStore: 1 },
        { id: 'secret_casino', name: 'Secret Casino', x: 90, z: 40, w: 40, d: 26, h: 13, wall: 0x8a1f4a, roof: 0x301020, door: 'w', enter: 1, neon: 1 },
        { id: 'vault_oddities', name: 'Vault of Oddities', x: 0, z: 110, w: 34, d: 24, h: 11, wall: 0x3a4a60, roof: 0x7d8fa8, door: 'n', enter: 1 },
        { id: 'lake_resort', name: 'Underground Lake Resort', x: 150, z: -90, w: 38, d: 24, h: 12, wall: 0x4fb3a3, roof: 0x1f6f63, door: 's', enter: 1, neon: 1 }
      ],
      stalls: [
        { id: 'grey_corner', name: "Mr. Grey's Corner", x: -40, z: -46, cols: 4, dir: 'x', spacing: 5 },
        { id: 'bulk_stalls', name: 'Bazaar Bulk Stalls', x: 40, z: 78, cols: 6, dir: 'x' },
        { id: 'deep_level', name: 'The Deepest Level', x: 0, z: -180, y: DEEP_Y, cols: 5, dir: 'x' }
      ],
      change: { x: -30, z: 60 },
      stairs: [{ x: 28, z: 0, to: 12, dir: 'w', len: 7 }],
      lake: { x: 170, z: -40, r: 46 },
      landmarks: [{ kind: 'goldtrain', x: 0, z: 26 }]
    }
  };

  // Main streets. Polylines; w is full width. Traffic drives these too.
  function curve(x0, z0, x1, z1, amp, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      pts.push([Math.round(x0 + (x1 - x0) * t + Math.sin(t * Math.PI * 2) * amp), Math.round(z0 + (z1 - z0) * t + Math.cos(t * Math.PI * 2) * amp * 0.4)]);
    }
    return pts;
  }
  var ROADS = [
    // the ring and the grid that joins every district
    { w: 14, pts: [[-120, -350], [-120, 346]] }, { w: 14, pts: [[120, -350], [120, 282]] },
    { w: 14, pts: [[-350, 120], [300, 120]] }, { w: 14, pts: [[-350, -120], [350, -120]] },
    { w: 16, pts: [[-120, 0], [120, 0]] }, { w: 16, pts: [[0, -120], [0, 120]] },
    { w: 12, pts: [[120, 0], [350, 0]] }, { w: 12, pts: [[240, -120], [240, 0]] }, { w: 12, pts: [[240, 0], [240, 120]] },
    { w: 16, pts: [[-350, 240], [120, 240]], name: 'Motor Mile' },
    { w: 12, pts: [[-240, 120], [-240, 346]] }, { w: 12, pts: [[0, 120], [0, 346]] },
    { w: 12, pts: [[120, 200], [306, 200]] }, { w: 12, pts: [[214, 120], [214, 282]] },
    { w: 11, pts: [[-120, -240], [120, -240]] }, { w: 11, pts: [[0, -350], [0, -120]] }, { w: 11, pts: [[-120, -350], [120, -350]] },
    { w: 12, pts: [[120, -240], [350, -210]] }, { w: 12, pts: [[240, -350], [240, -120]] },
    { w: 11, pts: curve(-120, 30, -350, 30, 18, 12) }, { w: 11, pts: curve(-120, -190, -350, -190, 22, 12) },
    { w: 11, pts: curve(-240, 120, -240, -350, 16, 16) }
  ];

  return { DISTRICTS: DISTRICTS, ROADS: ROADS, UNDER_Y: UNDER_Y, DEEP_Y: DEEP_Y, B: B, SURFACE: 360 };
});
