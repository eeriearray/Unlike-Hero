/* Everything for sale is a real object on display. Models are small generated meshes, drawn instanced, one mesh per kind. */
(function () {
  var TR = window.TR = window.TR || {};
  var dummy = new THREE.Object3D(), MAX = 90;

  var B = {
    plinth: function (g) { g.box(0, 0, 0, 1.5, 0.12, 1.5, 0xd8b45a).box(0, 0.12, 0, 1.2, 0.72, 1.2, 0xfafafa).box(0, 0.84, 0, 1.42, 0.12, 1.42, 0xd8b45a); },
    plinthDark: function (g) { g.box(0, 0, 0, 1.5, 0.12, 1.5, 0x3a3d48).box(0, 0.12, 0, 1.2, 0.72, 1.2, 0x565a66).box(0, 0.84, 0, 1.42, 0.12, 1.42, 0x3a3d48); },
    lock: function (g) { g.box(0, 0, 0, 0.8, 0.64, 0.3, 0xb36bff).box(-0.27, 0.64, 0, 0.13, 0.36, 0.16, 0xd8d8e4).box(0.27, 0.64, 0, 0.13, 0.36, 0.16, 0xd8d8e4).box(0, 0.9, 0, 0.67, 0.13, 0.16, 0xd8d8e4).box(0, 0.22, -0.16, 0.14, 0.22, 0.03, 0x241038); },
    forsale: function (g) { // an estate agent's board, big enough to read across the street
      g.box(0, 0, 0, 0.4, 5.2, 0.4, 0xf4f4f4).box(0, 4.8, 0.6, 3.6, 0.2, 0.2, 0xf4f4f4).box(0, 0, 0, 1.6, 0.3, 1.6, 0x8d6e4b);
      g.box(0.1, 2.6, 0.7, 3.6, 2, 0.18, 0xffc53d).box(0.1, 3.6, 0.82, 3.3, 0.76, 0.03, 0xd9352c).box(0.1, 2.8, 0.82, 3.3, 0.66, 0.03, 0x1a1a2e);
    },
    soldsign: function (g) { g.box(0, 0, 0, 0.3, 3.4, 0.3, 0xf4f4f4).box(0, 2.3, 0.3, 2.8, 1.2, 0.14, 0xd9352c).box(0, 2.56, 0.4, 2.2, 0.66, 0.03, 0xffffff); },
    gumball: function (g) { g.box(0, 0, 0, 0.7, 0.14, 0.7, 0xd9352c).box(0, 0.14, 0, 0.3, 0.9, 0.3, 0xd9352c).box(0, 1.04, 0, 0.72, 0.28, 0.72, 0xd9352c).box(0, 1.32, 0, 0.84, 0.72, 0.84, 0xbfeaff).box(0, 2.04, 0, 0.5, 0.14, 0.5, 0xd9352c); [[-0.2, 0xffd24a], [0.2, 0xff5a7a], [0, 0x4dabf7]].forEach(function (c, i) { g.box(c[0], 1.42 + i * 0.16, i % 2 ? 0.2 : -0.1, 0.22, 0.22, 0.22, c[1]); }); },
    gift: function (g) { g.box(0, 0, 0, 1, 0.8, 1, 0xff5a7a).box(0, 0, 0, 1.03, 0.82, 0.22, 0xffd24a).box(0, 0, 0, 0.22, 0.82, 1.03, 0xffd24a).box(-0.2, 0.82, 0, 0.36, 0.22, 0.16, 0xffd24a).box(0.2, 0.82, 0, 0.36, 0.22, 0.16, 0xffd24a); },
    car: function (g) { g.box(0, 0.16, 0, 0.92, 0.28, 1.9, 0xff3b3b).box(0, 0.44, 0.08, 0.78, 0.28, 0.9, 0x213347).box(0, 0.72, 0.08, 0.8, 0.05, 0.92, 0xff3b3b); [[-0.46, -0.6], [0.46, -0.6], [-0.46, 0.6], [0.46, 0.6]].forEach(function (p) { g.wheel(p[0], 0.17, p[1], 0.17, 0.14, 0x18181c, 0xdddddd); }); },
    gem: function (g) { g.cyl(0, 0, 0, 0.14, 0.5, 0x4de1ff, 6, 0.62).cyl(0, 0.5, 0, 0.62, 0.3, 0x9af0ff, 6, 0.34); },
    ringb: function (g) { g.box(0, 0.05, 0, 0.8, 0.14, 0.2, 0xffd24a).box(-0.34, 0.05, 0, 0.14, 0.7, 0.2, 0xffd24a).box(0.34, 0.05, 0, 0.14, 0.7, 0.2, 0xffd24a).box(0, 0.65, 0, 0.8, 0.14, 0.2, 0xffd24a); g.cyl(0, 0.79, 0, 0.1, 0.22, 0x4de1ff, 6, 0.26).cyl(0, 1.01, 0, 0.26, 0.14, 0x9af0ff, 6, 0.1); },
    watch: function (g) { g.box(0, 0, 0, 0.3, 1.5, 0.08, 0x6b4d2c); g.cyl(0, 0.75, 0.04, 0.42, 0.12, 0xffd24a, 12).cyl(0, 0.87, 0.04, 0.34, 0.03, 0xffffff, 12); },
    painting: function (g) { g.box(0, 0, 0, 1.7, 1.3, 0.14, 0xb98a3a).box(0, 0.12, 0.08, 1.46, 1.06, 0.03, 0x4dabf7).box(-0.3, 0.12, 0.1, 0.5, 0.5, 0.03, 0xffd24a).box(0.3, 0.3, 0.1, 0.42, 0.7, 0.03, 0xff5a7a); },
    statue: function (g) { var c = 0xffd24a; g.box(0, 0, 0, 0.5, 0.7, 0.3, c).box(0, 0.7, 0, 0.72, 0.62, 0.36, c).box(0, 1.32, 0, 0.42, 0.42, 0.42, c).box(-0.46, 0.92, 0, 0.18, 0.7, 0.18, c).box(0.46, 0.76, 0, 0.18, 0.6, 0.18, c); },
    hat: function (g) { g.box(0, 0, 0, 1.25, 0.1, 1.25, 0x20202a).box(0, 0.1, 0, 0.76, 0.74, 0.76, 0x20202a).box(0, 0.14, 0, 0.8, 0.14, 0.8, 0xd9352c); },
    shoe: function (g) { g.box(0, 0, 0.1, 0.62, 0.16, 1.5, 0xffffff).box(0, 0.16, 0.42, 0.56, 0.64, 0.74, 0xff5a7a).box(0, 0.16, -0.25, 0.56, 0.28, 0.66, 0xff5a7a); },
    bag: function (g) { g.box(0, 0, 0, 1.15, 0.84, 0.46, 0xc73e6b).box(0, 0.4, 0.24, 0.3, 0.2, 0.04, 0xffd24a).box(-0.34, 0.84, 0, 0.1, 0.42, 0.1, 0x7d2343).box(0.34, 0.84, 0, 0.1, 0.42, 0.1, 0x7d2343).box(0, 1.2, 0, 0.78, 0.1, 0.1, 0x7d2343); },
    food: function (g) { g.cyl(0, 0, 0, 0.66, 0.2, 0xe8a94c, 10).cyl(0, 0.2, 0, 0.7, 0.16, 0x7a3f1c, 10).cyl(0, 0.36, 0, 0.72, 0.07, 0xffd24a, 10).cyl(0, 0.43, 0, 0.7, 0.07, 0x5fc95a, 10).cyl(0, 0.5, 0, 0.66, 0.26, 0xf0b35c, 10, 0.4); },
    land: function (g) { g.cyl(0, 0, 0, 0.9, 0.12, 0x2aa6e8, 12).cyl(0, 0.12, 0, 0.62, 0.3, 0xe7cf95, 10, 0.4).box(0, 0.42, 0, 0.1, 0.72, 0.1, 0x8d5a2b); for (var i = 0; i < 5; i++) { var a = i / 5 * 6.283; g.box(Math.cos(a) * 0.3, 1.1, Math.sin(a) * 0.3, 0.64, 0.06, 0.2, 0x3fc76f, -a); } },
    house: function (g) { g.box(0, 0, 0, 1.2, 0.76, 1, 0xffe0b0).gable(0, 0.76, 0, 1.44, 0.56, 1.2, 0xe5533d, false).box(0, 0, 0.51, 0.3, 0.46, 0.02, 0x7a4a2b).box(-0.36, 0.34, 0.51, 0.24, 0.24, 0.02, 0x7ac6ee).box(0.36, 0.34, 0.51, 0.24, 0.24, 0.02, 0x7ac6ee); },
    tower: function (g) { g.box(0, 0, 0, 0.72, 1.7, 0.72, 0xffd96a).box(0, 1.7, 0, 0.44, 0.34, 0.44, 0xe0a917).cyl(0, 2.04, 0, 0.05, 0.34, 0xffffff, 5); for (var i = 0; i < 4; i++) g.box(0, 0.2 + i * 0.36, 0, 0.75, 0.16, 0.75, 0x5b92bd); },
    boat: function (g) { g.box(0, 0, 0, 0.8, 0.34, 1.7, 0xffffff).box(0, 0.05, 0, 0.84, 0.1, 1.74, 0x2f6fd6).box(0, 0.34, 0.2, 0.56, 0.3, 0.72, 0xdff2ff).box(0, 0.64, 0.2, 0.08, 0.5, 0.08, 0x888888).box(0, 0.98, 0.32, 0.03, 0.16, 0.26, 0xff3b3b); },
    plane: function (g) { g.box(0, 0.3, 0, 0.36, 0.36, 1.9, 0xffffff).box(0, 0.42, -0.05, 1.86, 0.06, 0.46, 0x3d8bd4).box(0, 0.5, 0.82, 0.08, 0.5, 0.3, 0xd9352c).box(0, 0.5, 0.82, 0.74, 0.05, 0.26, 0x3d8bd4).box(0, 0.34, -0.96, 0.3, 0.2, 0.06, 0x213347); },
    rocket: function (g) { g.cyl(0, 0.26, 0, 0.3, 1.1, 0xffffff, 10).cyl(0, 1.36, 0, 0.3, 0.5, 0xd9352c, 10, 0.02).box(-0.32, 0.14, 0, 0.3, 0.6, 0.06, 0xd9352c).box(0.32, 0.14, 0, 0.3, 0.6, 0.06, 0xd9352c).box(0, 0.14, -0.32, 0.06, 0.6, 0.3, 0xd9352c).box(0, 0.14, 0.32, 0.06, 0.6, 0.3, 0xd9352c); },
    train: function (g) { g.box(0, 0.18, 0, 0.8, 0.62, 1.8, 0xffc53d).box(0, 0.8, 0, 0.86, 0.08, 1.84, 0xb58a00).box(0, 0.42, -0.92, 0.6, 0.26, 0.04, 0x213347); [-0.55, 0.55].forEach(function (z) { g.wheel(-0.32, 0.14, z, 0.14, 0.1, 0x222222).wheel(0.32, 0.14, z, 0.14, 0.1, 0x222222); }); },
    cash: function (g) { for (var i = 0; i < 5; i++) { g.box(0, i * 0.18, (i % 2) * 0.03, 1.4, 0.16, 0.7, 0x5fc565).box(0, i * 0.18 + 0.01, 0, 0.26, 0.16, 0.72, 0xfff1c0); } },
    animal: function (g) { var c = 0xf0a64a; g.box(0, 0.32, 0, 0.62, 0.52, 1, c).box(0, 0.74, -0.56, 0.54, 0.5, 0.5, c).box(-0.18, 1.2, -0.56, 0.14, 0.2, 0.1, c).box(0.18, 1.2, -0.56, 0.14, 0.2, 0.1, c).box(-0.13, 0.94, -0.82, 0.09, 0.09, 0.02, 0x222222).box(0.13, 0.94, -0.82, 0.09, 0.09, 0.02, 0x222222); [[-0.22, -0.34], [0.22, -0.34], [-0.22, 0.34], [0.22, 0.34]].forEach(function (p) { g.box(p[0], 0, p[1], 0.17, 0.34, 0.17, c); }); g.box(0, 0.76, 0.56, 0.12, 0.42, 0.12, c); },
    dice: function (g) { g.box(0, 0, 0, 0.8, 0.8, 0.8, 0xffffff, 0.5); [[0, 0.81, 0], [-0.2, 0.81, 0], [0.2, 0.81, 0]].forEach(function (p) { g.box(p[0], p[1], p[2], 0.13, 0.03, 0.13, 0xd9352c); }); g.box(0.8, 0, 0.3, 0.5, 0.5, 0.5, 0xd9352c, 0.3); },
    gear: function (g) { g.cyl(0, 0.1, 0, 0.56, 0.24, 0x8f98a4, 12); for (var i = 0; i < 8; i++) { var a = i / 8 * 6.283; g.box(Math.cos(a) * 0.66, 0.1, Math.sin(a) * 0.66, 0.24, 0.24, 0.24, 0xc9ced6, -a); } g.cyl(0, 0.34, 0, 0.2, 0.04, 0xffc53d, 10); },
    book: function (g) { g.box(0, 0, 0, 1, 0.18, 1.3, 0x2f6fd6).box(0, 0.18, 0, 0.92, 0.14, 1.2, 0xfaf4df).box(0, 0.32, 0, 1, 0.08, 1.3, 0x2f6fd6).box(0, 0.42, 0, 0.84, 0.1, 1.2, 0xd9352c); },
    bottle: function (g) { g.cyl(0, 0, 0, 0.32, 0.86, 0x3fb56b, 10).cyl(0, 0.86, 0, 0.32, 0.26, 0x3fb56b, 10, 0.12).cyl(0, 1.12, 0, 0.12, 0.34, 0x3fb56b, 8).cyl(0, 0.26, 0, 0.33, 0.34, 0xfff1c0, 10); },
    lamp: function (g) { g.cyl(0, 0, 0, 0.36, 0.14, 0x6b4d2c, 10).box(0, 0.14, 0, 0.09, 0.66, 0.09, 0x6b4d2c).cyl(0, 0.8, 0, 0.5, 0.52, 0xfff0b0, 10, 0.24); },
    crate: function (g) { g.box(0, 0, 0, 1.2, 1, 1.2, 0xc0915a).box(0, 0.46, 0, 1.24, 0.1, 1.24, 0x8d6e4b).box(0, 0, 0, 1.24, 0.1, 1.24, 0x8d6e4b).box(0, 0.9, 0, 1.24, 0.1, 1.24, 0x8d6e4b); },
    receipt: function (g) { g.cyl(0, 0, 0, 0.72, 0.16, 0xffc53d, 16).cyl(0, 0.16, 0, 0.5, 0.03, 0xfff0b0, 12); }
  };

  var RULES = [
    [/ice cream|hot dog|burger|pizza|latte|soup|sandwich|fish|prawn|pretzel|lunch|candy|pepper|minibar|feast|pepperoni|sauce/i, 'food'],
    [/car\b|convertible|hatchback|limo|cart\b|forklift|kart|chassis|pit crew|racing/i, 'car'],
    [/yacht|boat|ship|ferry|lifeboat|cruise|anchor|sail/i, 'boat'],
    [/plane|\bjet\b|airline|boarding|seat|luggage|baggage|helicopter|balloon|neck pillow/i, 'plane'],
    [/rocket|orbit|satellite|astronaut|moon|mars|comet|space|asteroid/i, 'rocket'],
    [/train|rail|metro|subway/i, 'train'],
    [/necklace|tiara|bracelet|earring|diamond|gem|jewel|pearl|ruby|crown|amber|crystal|geode|treasure|doubloon/i, 'gem'],
    [/\bring\b/i, 'ringb'],
    [/watch|clock/i, 'watch'],
    [/painting|portrait|canvas|clown|banana|billboard|poster|map of|map to|naming/i, 'painting'],
    [/statue|sculpture|gnome|mascot|mannequin|ingots|tube man|dinosaur|fossil/i, 'statue'],
    [/\bhat\b|monocle|sunglass|umbrella|helmet/i, 'hat'],
    [/shoe|sneaker|sock|shoelace/i, 'shoe'],
    [/bag|coat|scarf|suit|pyjama|glove|tuxedo|perfume|sweater|pinstripe|tie\b/i, 'bag'],
    [/mine|island|region|field|farm|plains|park|hill|forest|cove|fjord|geyser|greenland|estate|vineyard|wheat|castle|pond|lake|rezoned|puddle/i, 'land'],
    [/mansion|neighbourhood|house|hotel|bath|pool|maze|wing/i, 'house'],
    [/tower|overpass|bridge|stadium|chimney|plaza|sidewalk|elevator|monorail|tall/i, 'tower'],
    [/takeover|bond|futures|options|licence|membership|tip|cheque|deed|hint|stamp|coin|bars|comic|ticket|pass\b/i, 'cash'],
    [/lion|penguin|giraffe|otter|dog|animal|seagull|octopus|shark|bat\b|pigeon|dalmatian|dragon|rat\b|monster|teeth|polar/i, 'animal'],
    [/dice|casino|chip|table/i, 'dice'],
    [/robot|engine|spark|assembly|magnet|jack|machine|tyre|bolt|crane|gear|cord/i, 'gear'],
    [/library|book|phone book|logbook|map|recipe/i, 'book'],
    [/bottle|perfume|ink|midnight|jar|vinegar/i, 'bottle'],
    [/lantern|light|chandelier|lamp/i, 'lamp'],
    [/warehouse|container|crate|box|pallet|lot:/i, 'crate']
  ];

  var goods = TR.goods = {
    meshes: {}, n: {},
    init: function (scene) {
      var mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x161616 });
      Object.keys(B).forEach(function (k) {
        var g = new TR.Geo(); B[k](g);
        var m = new THREE.InstancedMesh(g.geometry(), mat, MAX);
        m.frustumCulled = false; m.count = 0; m.castShadow = true; m.visible = false;
        scene.add(m);
        goods.meshes[k] = m; goods.n[k] = 0;
      });
    },
    kindFor: function (item) {
      if (item.kind === 'change') return 'gumball';
      if (item.kind === 'store') return 'gift';
      if (item.kind === 'hint') return 'book';
      for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(item.name)) return RULES[i][1];
      return 'gift';
    },
    begin: function () { for (var k in goods.n) goods.n[k] = 0; },
    put: function (kind, x, y, z, ry, s, rx) {
      var i = goods.n[kind];
      if (i >= MAX) return;
      dummy.position.set(x, y, z); dummy.rotation.set(rx || 0, ry || 0, 0); dummy.scale.set(s, s, s); dummy.updateMatrix();
      goods.meshes[kind].setMatrixAt(i, dummy.matrix);
      goods.n[kind] = i + 1;
    },
    end: function () {
      for (var k in goods.n) {
        var m = goods.meshes[k], c = goods.n[k];
        m.count = c; m.visible = c > 0;
        if (c) m.instanceMatrix.needsUpdate = true;
      }
    }
  };

  // ───── the haul: everything you buy bounces along behind you ─────
  var LEN = 34, GAP = 1.75;
  var haul = TR.haul = {
    items: [], trail: [], total: 0, last: null,
    reset: function () { haul.items = []; haul.trail = []; haul.total = 0; haul.last = null; },
    /** A bought thing leaps from where it stood into the line. */
    add: function (kind, from, scale) {
      haul.total++;
      haul.items.unshift({ kind: kind, s: Math.min(0.95, scale * 0.8), hop: 0, fx: from ? from.x : null, fy: from ? from.y : 0, fz: from ? from.z : 0, x: 0, y: 0, z: 0, ph: haul.total * 1.7 });
      if (haul.items.length > LEN) haul.items.pop();
    },
    update: function (dt, pos, t, moving) {
      var L = haul.last;
      if (!L || Math.hypot(pos.x - L.x, pos.z - L.z) > 40 || Math.abs(pos.y - L.y) > 12) { haul.trail = []; L = null; }  // a door or a flight: everyone catches up
      if (!L || Math.hypot(pos.x - L.x, pos.z - L.z) > 0.5) { haul.trail.unshift({ x: pos.x, y: pos.y, z: pos.z }); haul.last = { x: pos.x, y: pos.y, z: pos.z }; if (haul.trail.length > 240) haul.trail.pop(); }
      var step = GAP / 0.5;
      for (var i = 0; i < haul.items.length; i++) {
        var it = haul.items[i], p = haul.trail[Math.min(haul.trail.length - 1, Math.round((i + 1.2) * step))] || pos, side = Math.sin(i * 1.9) * 0.9;
        var bounce = Math.abs(Math.sin(t * 7 + it.ph)) * (moving ? 0.75 : 0.12), tx = p.x + side, ty = p.y + bounce + 0.1, tz = p.z + Math.cos(i * 2.3) * 0.9;
        if (it.hop < 1) {
          it.hop = Math.min(1, it.hop + dt * 1.8);
          var h = it.hop, sx = it.fx == null ? tx : it.fx, sy = it.fx == null ? ty : it.fy, sz = it.fx == null ? tz : it.fz;
          it.x = sx + (tx - sx) * h; it.z = sz + (tz - sz) * h; it.y = sy + (ty - sy) * h + Math.sin(h * Math.PI) * 7;
          goods.put(it.kind, it.x, it.y, it.z, t * 9, it.s * (1 + Math.sin(h * Math.PI) * 0.8));
        } else {
          it.x += (tx - it.x) * Math.min(1, dt * 14); it.z += (tz - it.z) * Math.min(1, dt * 14); it.y += (ty - it.y) * Math.min(1, dt * 16);
          var h2 = Math.atan2(pos.x - it.x, pos.z - it.z);
          goods.put(it.kind, it.x, it.y, it.z, h2 + Math.PI + Math.sin(t * 7 + it.ph) * 0.25, it.s);
        }
      }
    }
  };
})();
