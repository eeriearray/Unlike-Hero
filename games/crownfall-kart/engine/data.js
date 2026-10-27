(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrownData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CLASSES = {
    light: { name: 'Wisp', label: 'Light', mass: 0.75, acceleration: 33, speed: 32, turn: 2.7, color: '#78e5cc', description: 'Quick off the line. Carves through corners. Vulnerable in a brawl.' },
    medium: { name: 'Revenant', label: 'Medium', mass: 1.2, acceleration: 29, speed: 35, turn: 2.4, color: '#ffc66d', description: 'A balanced troublemaker. Strong acceleration and confident handling.' },
    heavy: { name: 'Colossus', label: 'Heavy', mass: 2, acceleration: 24, speed: 39, turn: 2.1, color: '#d4a3ff', description: 'Slow to wake. Hard to stop. Sends lighter rivals flying.' }
  };
  const TRACKS = [
  {
    "id": "shattered-crown",
    "name": "Shattered Crown",
    "subtitle": "Figure-eight skybridge / abyss jumps",
    "width": 20,
    "scale": 1,
    "sky": "#15112e",
    "fog": "#352752",
    "stone": "#625077",
    "energy": "#d9a0ff",
    "accent": "#ffd18c",
    "phase": 0.0,
    "landmark": "ruins",
    "layout": [
      [
        0,
        -110,
        6
      ],
      [
        80,
        -100,
        6
      ],
      [
        105,
        -40,
        8
      ],
      [
        55,
        0,
        15
      ],
      [
        0,
        40,
        22
      ],
      [
        -65,
        90,
        22
      ],
      [
        -110,
        40,
        20
      ],
      [
        -100,
        -15,
        18
      ],
      [
        -45,
        -25,
        14
      ],
      [
        0,
        0,
        6
      ],
      [
        65,
        55,
        6
      ],
      [
        105,
        110,
        6
      ],
      [
        50,
        130,
        6
      ],
      [
        -10,
        105,
        6
      ],
      [
        -35,
        45,
        6
      ],
      [
        -70,
        -35,
        6
      ],
      [
        -70,
        -100,
        6
      ]
    ],
    "ramps": [
      0.19,
      0.51,
      0.8
    ],
    "zones": [
      "CROWN SKYBRIDGE",
      "THE CROSSING",
      "ABYSS RUN"
    ],
    "gaps": [
      {
        "start": 0.193,
        "end": 0.20600000000000002
      },
      {
        "start": 0.513,
        "end": 0.526
      },
      {
        "start": 0.803,
        "end": 0.8160000000000001
      }
    ],
    "pads": [
      {
        "u": 0.167,
        "lane": 0,
        "width": 16
      },
      {
        "u": 0.487,
        "lane": 0,
        "width": 16
      },
      {
        "u": 0.777,
        "lane": 0,
        "width": 16
      },
      {
        "u": 0.06,
        "lane": -3,
        "width": 8
      },
      {
        "u": 0.37,
        "lane": 3,
        "width": 8
      },
      {
        "u": 0.89,
        "lane": 0,
        "width": 10
      }
    ],
    "mud": [
      {
        "start": 0.62,
        "end": 0.65,
        "lane": -5,
        "width": 6
      }
    ]
  },
  {
    "id": "ember-keep",
    "name": "Ember Keep",
    "subtitle": "Fortress switchbacks / furnace straight",
    "width": 21,
    "scale": 1,
    "sky": "#28121b",
    "fog": "#592b30",
    "stone": "#805347",
    "energy": "#ff9a55",
    "accent": "#ffdd8c",
    "phase": 0.6,
    "landmark": "fortress",
    "layout": [
      [
        0,
        -115,
        6
      ],
      [
        110,
        -115,
        6
      ],
      [
        125,
        -65,
        8
      ],
      [
        60,
        -55,
        8
      ],
      [
        15,
        -55,
        8
      ],
      [
        10,
        -5,
        10
      ],
      [
        95,
        -5,
        10
      ],
      [
        125,
        35,
        12
      ],
      [
        105,
        100,
        12
      ],
      [
        40,
        110,
        12
      ],
      [
        30,
        45,
        10
      ],
      [
        -30,
        35,
        8
      ],
      [
        -40,
        105,
        6
      ],
      [
        -110,
        95,
        6
      ],
      [
        -125,
        40,
        6
      ],
      [
        -90,
        -10,
        8
      ],
      [
        -120,
        -60,
        8
      ],
      [
        -85,
        -115,
        6
      ]
    ],
    "ramps": [
      0.24,
      0.74
    ],
    "zones": [
      "FURNACE STRAIGHT",
      "KINGS SWITCHBACKS",
      "ASH GATE"
    ],
    "gaps": [],
    "pads": [
      {
        "u": 0.217,
        "lane": 0,
        "width": 17
      },
      {
        "u": 0.717,
        "lane": 0,
        "width": 17
      },
      {
        "u": 0.06,
        "lane": -3,
        "width": 8
      },
      {
        "u": 0.37,
        "lane": 3,
        "width": 8
      },
      {
        "u": 0.89,
        "lane": 0,
        "width": 10
      }
    ],
    "mud": [
      {
        "start": 0.62,
        "end": 0.65,
        "lane": -5,
        "width": 6
      }
    ]
  },
  {
    "id": "moonveil",
    "name": "Moonveil Ruins",
    "subtitle": "Serpent canyon / lantern tunnels",
    "width": 20,
    "scale": 1,
    "sky": "#102939",
    "fog": "#275060",
    "stone": "#537b80",
    "energy": "#73f5da",
    "accent": "#e8e9bd",
    "phase": 1.2,
    "landmark": "lanterns",
    "layout": [
      [
        0,
        -120,
        6
      ],
      [
        65,
        -100,
        8
      ],
      [
        90,
        -60,
        10
      ],
      [
        30,
        -40,
        12
      ],
      [
        -30,
        -20,
        12
      ],
      [
        -30,
        20,
        14
      ],
      [
        40,
        20,
        14
      ],
      [
        85,
        55,
        16
      ],
      [
        70,
        105,
        16
      ],
      [
        0,
        120,
        12
      ],
      [
        -80,
        90,
        10
      ],
      [
        -105,
        40,
        8
      ],
      [
        -70,
        0,
        6
      ],
      [
        -110,
        -50,
        6
      ],
      [
        -70,
        -110,
        6
      ]
    ],
    "ramps": [
      0.19,
      0.51,
      0.8
    ],
    "zones": [
      "LANTERN WAY",
      "SERPENT CANYON",
      "MOON GARDEN"
    ],
    "gaps": [
      {
        "start": 0.193,
        "end": 0.20600000000000002
      },
      {
        "start": 0.513,
        "end": 0.526
      },
      {
        "start": 0.803,
        "end": 0.8160000000000001
      }
    ],
    "pads": [
      {
        "u": 0.167,
        "lane": 0,
        "width": 16
      },
      {
        "u": 0.487,
        "lane": 0,
        "width": 16
      },
      {
        "u": 0.777,
        "lane": 0,
        "width": 16
      },
      {
        "u": 0.06,
        "lane": -3,
        "width": 8
      },
      {
        "u": 0.37,
        "lane": 3,
        "width": 8
      },
      {
        "u": 0.89,
        "lane": 0,
        "width": 10
      }
    ],
    "mud": [
      {
        "start": 0.62,
        "end": 0.65,
        "lane": -5,
        "width": 6
      }
    ]
  },
  {
    "id": "void-cathedral",
    "name": "Void Cathedral",
    "subtitle": "Cathedral climb / forty-metre descent",
    "width": 20,
    "scale": 1,
    "sky": "#1b1536",
    "fog": "#432d60",
    "stone": "#76658b",
    "energy": "#f2a3ff",
    "accent": "#ffe09b",
    "phase": 1.7999999999999998,
    "landmark": "cathedral",
    "layout": [
      [
        0,
        -140,
        8
      ],
      [
        85,
        -140,
        8
      ],
      [
        100,
        -90,
        15
      ],
      [
        45,
        -60,
        25
      ],
      [
        50,
        0,
        34
      ],
      [
        105,
        45,
        40
      ],
      [
        80,
        110,
        40
      ],
      [
        0,
        130,
        30
      ],
      [
        -70,
        100,
        20
      ],
      [
        -95,
        45,
        10
      ],
      [
        -45,
        5,
        5
      ],
      [
        -95,
        -35,
        6
      ],
      [
        -110,
        -100,
        8
      ],
      [
        -60,
        -140,
        8
      ]
    ],
    "ramps": [
      0.19,
      0.51,
      0.8
    ],
    "zones": [
      "THE ASCENSION",
      "CATHEDRAL SUMMIT",
      "KINGS FALL"
    ],
    "gaps": [
      {
        "start": 0.193,
        "end": 0.20600000000000002
      },
      {
        "start": 0.513,
        "end": 0.526
      },
      {
        "start": 0.803,
        "end": 0.8160000000000001
      }
    ],
    "pads": [
      {
        "u": 0.167,
        "lane": 0,
        "width": 16
      },
      {
        "u": 0.487,
        "lane": 0,
        "width": 16
      },
      {
        "u": 0.777,
        "lane": 0,
        "width": 16
      },
      {
        "u": 0.06,
        "lane": -3,
        "width": 8
      },
      {
        "u": 0.37,
        "lane": 3,
        "width": 8
      },
      {
        "u": 0.89,
        "lane": 0,
        "width": 10
      }
    ],
    "mud": [
      {
        "start": 0.62,
        "end": 0.65,
        "lane": -5,
        "width": 6
      }
    ]
  },
  {
    "id": "frostgrave",
    "name": "Frostgrave Pass",
    "subtitle": "Mountain slalom / glacier leap",
    "width": 22,
    "scale": 1,
    "sky": "#18354c",
    "fog": "#4c7891",
    "stone": "#9bbac7",
    "energy": "#aff6ff",
    "accent": "#fff2c8",
    "phase": 2.4,
    "landmark": "ice",
    "layout": [
      [
        0,
        -140,
        22
      ],
      [
        65,
        -130,
        26
      ],
      [
        115,
        -85,
        28
      ],
      [
        70,
        -45,
        24
      ],
      [
        20,
        -30,
        18
      ],
      [
        30,
        20,
        12
      ],
      [
        105,
        50,
        6
      ],
      [
        110,
        100,
        6
      ],
      [
        50,
        140,
        6
      ],
      [
        -30,
        110,
        9
      ],
      [
        -45,
        40,
        15
      ],
      [
        -110,
        5,
        22
      ],
      [
        -100,
        -70,
        26
      ],
      [
        -55,
        -130,
        24
      ]
    ],
    "ramps": [
      0.19,
      0.51,
      0.8
    ],
    "zones": [
      "FROZEN SUMMIT",
      "GLACIER LEAP",
      "BONE SLALOM"
    ],
    "gaps": [
      {
        "start": 0.193,
        "end": 0.20600000000000002
      },
      {
        "start": 0.513,
        "end": 0.526
      },
      {
        "start": 0.803,
        "end": 0.8160000000000001
      }
    ],
    "pads": [
      {
        "u": 0.167,
        "lane": 0,
        "width": 18
      },
      {
        "u": 0.487,
        "lane": 0,
        "width": 18
      },
      {
        "u": 0.777,
        "lane": 0,
        "width": 18
      },
      {
        "u": 0.06,
        "lane": -3,
        "width": 8
      },
      {
        "u": 0.37,
        "lane": 3,
        "width": 8
      },
      {
        "u": 0.89,
        "lane": 0,
        "width": 10
      }
    ],
    "mud": [
      {
        "start": 0.62,
        "end": 0.65,
        "lane": -5,
        "width": 6
      }
    ]
  },
  {
    "id": "bloodroot",
    "name": "Bloodroot Fen",
    "subtitle": "Root maze / hairpins / hex mud",
    "width": 22,
    "scale": 1,
    "sky": "#152d27",
    "fog": "#355b42",
    "stone": "#65754c",
    "energy": "#d4ff92",
    "accent": "#ffcf8c",
    "phase": 3.0,
    "landmark": "roots",
    "layout": [
      [
        0,
        -110,
        6
      ],
      [
        70,
        -110,
        7
      ],
      [
        100,
        -65,
        6
      ],
      [
        50,
        -25,
        6
      ],
      [
        90,
        20,
        7
      ],
      [
        65,
        75,
        8
      ],
      [
        0,
        90,
        8
      ],
      [
        -10,
        35,
        7
      ],
      [
        -55,
        20,
        6
      ],
      [
        -55,
        95,
        6
      ],
      [
        -105,
        85,
        7
      ],
      [
        -125,
        30,
        7
      ],
      [
        -95,
        -10,
        6
      ],
      [
        -125,
        -60,
        6
      ],
      [
        -70,
        -110,
        6
      ]
    ],
    "ramps": [
      0.24,
      0.74
    ],
    "zones": [
      "WITCHWOOD",
      "HEX HAIRPINS",
      "ROOT MAZE"
    ],
    "gaps": [],
    "pads": [
      {
        "u": 0.217,
        "lane": 0,
        "width": 18
      },
      {
        "u": 0.717,
        "lane": 0,
        "width": 18
      },
      {
        "u": 0.06,
        "lane": -3,
        "width": 8
      },
      {
        "u": 0.37,
        "lane": 3,
        "width": 8
      },
      {
        "u": 0.89,
        "lane": 0,
        "width": 10
      }
    ],
    "mud": [
      {
        "start": 0.32,
        "end": 0.36,
        "lane": -5,
        "width": 8
      },
      {
        "start": 0.62,
        "end": 0.67,
        "lane": 4,
        "width": 9
      }
    ]
  },
  {
    "id": "stormspire",
    "name": "Stormspire Causeway",
    "subtitle": "Spiral ascent / lightning dive",
    "width": 21,
    "scale": 1,
    "sky": "#171d3e",
    "fog": "#3c4675",
    "stone": "#6b7daa",
    "energy": "#b8c8ff",
    "accent": "#ffefa3",
    "phase": 3.5999999999999996,
    "landmark": "spire",
    "layout": [
      [
        0,
        -140,
        6
      ],
      [
        95,
        -110,
        12
      ],
      [
        125,
        -20,
        20
      ],
      [
        90,
        65,
        28
      ],
      [
        0,
        95,
        36
      ],
      [
        -90,
        65,
        42
      ],
      [
        -110,
        -20,
        48
      ],
      [
        -60,
        -90,
        50
      ],
      [
        20,
        -100,
        52
      ],
      [
        70,
        -45,
        54
      ],
      [
        60,
        25,
        56
      ],
      [
        0,
        55,
        58
      ],
      [
        -55,
        20,
        60
      ],
      [
        -60,
        -45,
        62
      ],
      [
        -20,
        -60,
        64
      ],
      [
        35,
        -30,
        66
      ],
      [
        70,
        -85,
        62
      ],
      [
        20,
        -150,
        36
      ],
      [
        -75,
        -185,
        16
      ],
      [
        -95,
        -150,
        10
      ]
    ],
    "ramps": [
      0.19,
      0.51
    ],
    "zones": [
      "STORM APPROACH",
      "SKY SPIRAL",
      "LIGHTNING DIVE"
    ],
    "gaps": [
      {
        "start": 0.193,
        "end": 0.20600000000000002
      },
      {
        "start": 0.513,
        "end": 0.526
      }
    ],
    "pads": [
      {
        "u": 0.167,
        "lane": 0,
        "width": 17
      },
      {
        "u": 0.487,
        "lane": 0,
        "width": 17
      },
      {
        "u": 0.06,
        "lane": -3,
        "width": 8
      },
      {
        "u": 0.37,
        "lane": 3,
        "width": 8
      },
      {
        "u": 0.89,
        "lane": 0,
        "width": 10
      }
    ],
    "mud": [
      {
        "start": 0.62,
        "end": 0.65,
        "lane": -5,
        "width": 6
      }
    ]
  },
  {
    "id": "observatory",
    "name": "Sunken Observatory",
    "subtitle": "Cloverleaf turns / celestial gardens",
    "width": 22,
    "scale": 1,
    "sky": "#30243b",
    "fog": "#60425f",
    "stone": "#9a7c79",
    "energy": "#ffe0a2",
    "accent": "#8bf2e6",
    "phase": 4.2,
    "landmark": "orrery",
    "layout": [
      [
        0,
        -125,
        8
      ],
      [
        70,
        -125,
        8
      ],
      [
        100,
        -85,
        10
      ],
      [
        55,
        -45,
        12
      ],
      [
        35,
        0,
        16
      ],
      [
        105,
        0,
        20
      ],
      [
        135,
        45,
        22
      ],
      [
        95,
        95,
        22
      ],
      [
        40,
        65,
        18
      ],
      [
        0,
        45,
        14
      ],
      [
        0,
        115,
        10
      ],
      [
        -55,
        135,
        8
      ],
      [
        -105,
        95,
        8
      ],
      [
        -70,
        45,
        12
      ],
      [
        -45,
        0,
        16
      ],
      [
        -115,
        0,
        20
      ],
      [
        -135,
        -55,
        22
      ],
      [
        -95,
        -95,
        20
      ],
      [
        -45,
        -55,
        12
      ],
      [
        -20,
        -85,
        8
      ]
    ],
    "ramps": [
      0.19,
      0.51,
      0.8
    ],
    "zones": [
      "THE ORRERY",
      "CLOCKWORK CLOVER",
      "CELESTIAL RUN"
    ],
    "gaps": [
      {
        "start": 0.193,
        "end": 0.20600000000000002
      },
      {
        "start": 0.513,
        "end": 0.526
      },
      {
        "start": 0.803,
        "end": 0.8160000000000001
      }
    ],
    "pads": [
      {
        "u": 0.167,
        "lane": 0,
        "width": 18
      },
      {
        "u": 0.487,
        "lane": 0,
        "width": 18
      },
      {
        "u": 0.777,
        "lane": 0,
        "width": 18
      },
      {
        "u": 0.06,
        "lane": -3,
        "width": 8
      },
      {
        "u": 0.37,
        "lane": 3,
        "width": 8
      },
      {
        "u": 0.89,
        "lane": 0,
        "width": 10
      }
    ],
    "mud": [
      {
        "start": 0.62,
        "end": 0.65,
        "lane": -5,
        "width": 6
      }
    ]
  }
];
  const ITEMS = {
    trap: { name: 'Hex mine', symbol: '✦', description: 'Leave a dark-energy trap behind.' },
    bolt: { name: 'Soul bolt', symbol: '➤', description: 'Fire a fast projectile straight ahead.' },
    coin: { name: 'Crown shard', symbol: '◆', description: 'Collect a shard. Every 3 grants a small boost.' },
    homing: { name: 'Wraith seeker', symbol: '⌁', description: 'A homing bolt hunts the next racer ahead.' },
    triple: { name: 'Trinity bolts', symbol: '⋮', description: 'Three bolts in a wide forward spread.' },
    boost: { name: 'Rift boost', symbol: '»', description: 'A burst of speed that cuts through mud.' },
    star: { name: 'Undying', symbol: '✧', description: 'Seven seconds of invincibility and extra speed.' },
    overdrive: { name: 'Phantom drive', symbol: '↟', description: 'Five seconds of protected, high-speed autopilot.' },
    hunter: { name: 'Crown breaker', symbol: '♛', description: 'Hunts whoever is currently in first place.' }
  };
  const LOOT = {
    front: [['trap', 45], ['bolt', 35], ['coin', 20]],
    middle: [['homing', 35], ['triple', 30], ['boost', 35]],
    last: [['star', 30], ['overdrive', 40], ['hunter', 30]],
    battle: [['bolt', 25], ['triple', 25], ['homing', 20], ['trap', 15], ['boost', 10], ['star', 5]]
  };
  const BOT_NAMES = ['Morrow', 'Bramble', 'Nyx', 'Hollow', 'Vesper', 'Thorn', 'Ash'];
  const COLORS = ['#ffc66d', '#b593ff', '#78e5cc', '#ff8198', '#78c9ff', '#f0ed9f', '#c59c80', '#e1a6e9'];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const mod = (n, m) => ((n % m) + m) % m;
  const angle = n => mod(n + Math.PI, Math.PI * 2) - Math.PI;
  function rng(seed) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function rollItem(place, count, random, battle = false) {
    const band = battle ? 'battle' : count > 1 && place === count ? 'last' : place <= 2 ? 'front' : 'middle';
    const rows = LOOT[band]; let ticket = random() * rows.reduce((sum, row) => sum + row[1], 0);
    for (const [item, weight] of rows) { ticket -= weight; if (ticket < 0) return item; }
    return rows[rows.length - 1][0];
  }
  return { CLASSES, TRACKS, ITEMS, LOOT, BOT_NAMES, COLORS, clamp, mod, angle, rng, rollItem };
});
