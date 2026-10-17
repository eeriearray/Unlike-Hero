/* Putt Club — procedural props. Every decoration is built from simple geometry with proper proportions,
 * materials and a little motion, so the courses read as handcrafted dioramas without any model files.
 * build(kind, kit, rng, opts) returns an Object3D; obj.userData.animate(t) is called every frame if present. */
(function (global) {
  'use strict';
  var PC = global.PC, THREE = global.THREE;
  var geoCache = {};
  function geo(key, make) { return geoCache[key] || (geoCache[key] = make()); }
  function mesh(g, m, cast) { var o = new THREE.Mesh(g, m); o.castShadow = cast !== false; o.receiveShadow = true; return o; }
  function std(c, o) { var p = { color: c, roughness: 0.8 }; for (var k in o) p[k] = o[k]; return new THREE.MeshStandardMaterial(p); }
  var matCache = {};
  function mat(key, make) { return matCache[key] || (matCache[key] = make()); }

  // ---------------------------------------------------------------- Sunset Cove

  /** Low-poly palm: a leaning, segmented trunk and sharp faceted fronds that droop at the tips. */
  function palm(k, rng, s) {
    var g = new THREE.Group(), segs = 6, h = 3.6 * s, lean = 0.6 + rng() * 0.6, dir = rng() * Math.PI * 2;
    var tip = new THREE.Vector3();
    for (var i = 0; i < segs; i++) {
      var t0 = i / segs, t1 = (i + 1) / segs;
      var a = new THREE.Vector3(Math.cos(dir) * lean * t0 * t0 * s, h * t0, Math.sin(dir) * lean * t0 * t0 * s);
      var b = new THREE.Vector3(Math.cos(dir) * lean * t1 * t1 * s, h * t1, Math.sin(dir) * lean * t1 * t1 * s);
      var r0 = (0.17 - t0 * 0.07) * s, r1 = (0.17 - t1 * 0.07) * s;
      var seg = mesh(new THREE.CylinderGeometry(r1 * 0.92, r0, a.distanceTo(b) * 1.04, 6), k.palmTrunk);
      seg.position.copy(a).add(b).multiplyScalar(0.5);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      seg.rotation.y += i * 0.5;
      g.add(seg);
      tip.copy(b);
    }
    var crown = new THREE.Group(); crown.position.copy(tip); g.add(crown);
    var frond = geo('frondLow', function () {
      // A long faceted blade: spine plus two drooping edges, built from triangles.
      var L = 2.3, W = 0.42, n = 5, pos = [];
      function pt(u, side) { var x = u * L, y = -Math.pow(u, 1.6) * 1.15 + Math.sin(u * Math.PI) * 0.25, w = Math.sin(Math.min(1, u * 1.15) * Math.PI) * W * (1 - u * 0.35); return [x, y - Math.abs(side) * w * 0.35, side * w]; }
      for (var i2 = 0; i2 < n; i2++) {
        var u0 = i2 / n, u1 = (i2 + 1) / n;
        [-1, 1].forEach(function (sd) {
          var a0 = pt(u0, 0), a1 = pt(u1, 0), e0 = pt(u0, sd), e1 = pt(u1, sd);
          pos.push.apply(pos, a0.concat(e0, a1, a1, e0, e1));
        });
      }
      var gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.computeVertexNormals();
      return gg;
    });
    for (var j = 0; j < 8; j++) {
      var lf = mesh(frond, j % 2 ? k.palmLeaf : k.palmLeafDark);
      lf.rotation.y = (j / 8) * Math.PI * 2 + rng() * 0.35;
      lf.rotation.z = 0.15 + rng() * 0.25;
      lf.scale.setScalar(s * (0.85 + rng() * 0.3));
      crown.add(lf);
    }
    var nut = geo('coconutLow', function () { return new THREE.IcosahedronGeometry(0.11, 0); });
    for (var c = 0; c < 3; c++) { var cn = mesh(nut, k.palmTrunk); cn.position.set(Math.cos(c * 2.1) * 0.13 * s, -0.12 * s, Math.sin(c * 2.1) * 0.13 * s); crown.add(cn); }
    var phase = rng() * 6;
    g.userData.animate = function (t) { crown.rotation.z = Math.sin(t * 0.7 + phase) * 0.035; crown.rotation.x = Math.cos(t * 0.55 + phase) * 0.03; };
    return g;
  }

  /** Faceted sandstone: a cluster of two or three chunky blocks. */
  function rock(k, rng, s) {
    var g = new THREE.Group(), n = 1 + Math.floor(rng() * 3);
    for (var i = 0; i < n; i++) {
      var m = mesh(new THREE.DodecahedronGeometry(0.6, 0), i % 2 ? k.sandstoneDark || k.rock : k.sandstone || k.rock);
      m.scale.set(0.8 + rng() * 0.7, 0.5 + rng() * 0.6, 0.8 + rng() * 0.7);
      m.position.set((rng() - 0.5) * 0.9, m.scale.y * 0.25, (rng() - 0.5) * 0.9);
      m.rotation.set(rng() * 0.6, rng() * 6, rng() * 0.6);
      g.add(m);
    }
    g.scale.setScalar(s);
    return g;
  }

  /** A big layered sandstone outcrop (background scenery). */
  function bluff(k, rng, s) {
    var g = new THREE.Group();
    for (var i = 0; i < 5; i++) {
      var m = mesh(new THREE.DodecahedronGeometry(1, 0), i % 2 ? k.sandstoneDark : k.sandstone);
      var sc = 1.6 - i * 0.22;
      m.scale.set(sc * (1 + rng() * 0.5), sc * (0.9 + rng() * 0.6), sc * (1 + rng() * 0.5));
      m.position.set((rng() - 0.5) * 2.2, i * 0.75, (rng() - 0.5) * 2.2);
      m.rotation.set(rng() * 0.4, rng() * 6, rng() * 0.4);
      g.add(m);
    }
    g.scale.setScalar(s);
    return g;
  }

  /** Low sand bank with grass tufts: the beaches around the course. */
  function sandBank(k, rng, s) {
    var g = new THREE.Group();
    var geo2 = new THREE.SphereGeometry(1, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), pos = geo2.attributes.position, seed = rng() * 10;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x);
      var r = 1 + 0.18 * Math.sin(a * 3 + seed) + 0.1 * Math.sin(a * 5 + seed * 2);
      pos.setXYZ(i, x * r * 3, y * 0.55, z * r * 2.2);
    }
    geo2.computeVertexNormals();
    var bank = mesh(geo2, k.sandLow); bank.position.y = -0.25; g.add(bank);
    for (var t = 0; t < 7; t++) { var tf = tuft(k, rng, 0.8 + rng() * 0.6); var a2 = rng() * 6, rr = Math.sqrt(rng()) * 1.6; tf.position.set(Math.cos(a2) * rr * 1.3, 0.22, Math.sin(a2) * rr); g.add(tf); }
    g.scale.setScalar(s);
    return g;
  }

  function tuft(k, rng, s) {
    var g = new THREE.Group();
    var blade = geo('blade', function () { var gg = new THREE.ConeGeometry(0.05, 0.42, 3); gg.translate(0, 0.21, 0); return gg; });
    for (var i = 0; i < 5; i++) { var b = mesh(blade, k.tuft, false); b.rotation.set((rng() - 0.5) * 0.9, rng() * 6, (rng() - 0.5) * 0.9); g.add(b); }
    g.scale.setScalar(s);
    return g;
  }

  /** Wooden pier: planks on posts. */
  function dock(k, rng, s, opts) {
    var g = new THREE.Group(), len = (opts && opts.len) || 6;
    for (var i = 0; i < len / 0.42; i++) {
      var p = mesh(new THREE.BoxGeometry(1.6, 0.08, 0.36), k.plank);
      p.position.set((rng() - 0.5) * 0.06, 0, -i * 0.42); p.rotation.y = (rng() - 0.5) * 0.04; p.rotation.z = (rng() - 0.5) * 0.04;
      g.add(p);
    }
    for (var j = 0; j <= len; j += 2) [-0.75, 0.75].forEach(function (x) {
      var post = mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), k.piling); post.position.set(x, -0.75, -j); g.add(post);
      if (j % 4 === 0) { var top = mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), k.piling); top.position.set(x, 0.3, -j); g.add(top); }
    });
    g.scale.setScalar(s);
    return g;
  }

  function lantern(k, rng, s) {
    var g = new THREE.Group();
    var post = mesh(new THREE.BoxGeometry(0.16, 2.2, 0.16), k.piling); post.position.y = 1.1; g.add(post);
    var arm = mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), k.piling); arm.position.set(0.28, 2.1, 0); g.add(arm);
    var cage = mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.32, 6), k.navy); cage.position.set(0.52, 1.84, 0); g.add(cage);
    var light = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 6), mat('lanternGlow', function () { return new THREE.MeshBasicMaterial({ color: '#ffd38a', toneMapped: false }); }), false);
    light.position.set(0.52, 1.84, 0); g.add(light);
    g.scale.setScalar(s);
    return g;
  }

  /** A fishing net slung between two posts. */
  function net(k, rng, s) {
    var g = new THREE.Group();
    [-1.3, 1.3].forEach(function (x) { var p = mesh(new THREE.BoxGeometry(0.14, 2.2, 0.14), k.piling); p.position.set(x, 0.8, 0); p.rotation.z = x * 0.08; g.add(p); });
    var ng = new THREE.PlaneGeometry(2.5, 1.5, 10, 6), pos = ng.attributes.position;
    for (var i = 0; i < pos.count; i++) { var x = pos.getX(i); pos.setZ(i, Math.cos(x * 1.2) * 0.25); pos.setY(i, pos.getY(i) - Math.cos(x * 1.25) * 0.3); }
    var m = new THREE.Mesh(ng, mat('net', function () { return new THREE.MeshStandardMaterial({ color: '#d9c39a', wireframe: true, transparent: true, opacity: 0.85 }); }));
    m.position.y = 1.0; g.add(m);
    g.scale.setScalar(s);
    return g;
  }

  /** Half-sunk shipwreck. */
  function wreck(k, rng, s) {
    var g = new THREE.Group();
    var sh = new THREE.Shape();
    sh.moveTo(-2.6, 0.7); sh.lineTo(2.2, 0.7); sh.quadraticCurveTo(2.9, 0.4, 2.6, -0.2); sh.lineTo(-2.2, -0.5); sh.quadraticCurveTo(-2.8, -0.2, -2.6, 0.7);
    var hull = mesh(new THREE.ExtrudeGeometry(sh, { depth: 1.5, bevelEnabled: false }), mat('wreckWood', function () { return new THREE.MeshStandardMaterial({ map: PC.tex.wood('dark'), color: '#a07a58', roughness: 1 }); }));
    hull.position.z = -0.75; hull.rotation.z = 0.18; g.add(hull);
    var mast = mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6), k.piling); mast.position.set(0.4, 1.8, 0); mast.rotation.z = -0.5; g.add(mast);
    var ribs = new THREE.Group();
    for (var i = 0; i < 4; i++) { var r = mesh(new THREE.TorusGeometry(0.75, 0.06, 4, 10, Math.PI), k.piling); r.position.set(-1.6 + i * 0.5, 0.6, 0); r.rotation.y = Math.PI / 2; ribs.add(r); }
    g.add(ribs);
    g.scale.setScalar(s);
    return g;
  }

  function stiltHut(k, rng, s) {
    var g = new THREE.Group();
    [[-0.9, -0.8], [0.9, -0.8], [-0.9, 0.8], [0.9, 0.8]].forEach(function (p) { var post = mesh(new THREE.BoxGeometry(0.18, 2.4, 0.18), k.piling); post.position.set(p[0], 0.2, p[1]); g.add(post); });
    var deck = mesh(new THREE.BoxGeometry(2.4, 0.12, 2.2), k.plank); deck.position.y = 1.4; g.add(deck);
    var body = mesh(new THREE.BoxGeometry(1.8, 1.2, 1.6), k.wood); body.position.y = 2.05; g.add(body);
    var thatch = mat('thatch', function () { return new THREE.MeshStandardMaterial({ color: '#c9a160', roughness: 1, flatShading: true }); });
    var roof = mesh(new THREE.ConeGeometry(1.75, 1.0, 4), thatch); roof.position.y = 3.1; roof.rotation.y = Math.PI / 4; g.add(roof);
    var door = mesh(new THREE.BoxGeometry(0.45, 0.75, 0.04), k.navy); door.position.set(0, 1.85, 0.82); g.add(door);
    g.scale.setScalar(s);
    return g;
  }

  /** Chunky low-poly cloud that drifts slowly. */
  function cloud(k, rng, s) {
    var g = new THREE.Group();
    for (var i = 0; i < 5; i++) {
      var m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), k.cloud);
      m.scale.set(1.4 + rng(), 0.8 + rng() * 0.5, 1.1 + rng() * 0.6);
      m.position.set(i * 1.3 - 2.6, (rng() - 0.3) * 0.8, (rng() - 0.5) * 1.2);
      g.add(m);
    }
    var speed = 0.15 + rng() * 0.15, x0 = 0;
    g.userData.animate = function (t) { if (!x0) x0 = g.position.x; g.position.x = x0 + Math.sin(t * 0.01 * speed * 10) * 6; };
    g.scale.setScalar(s);
    return g;
  }

  function umbrella(k, rng, s) {
    var g = new THREE.Group();
    g.add(mesh(geo('upole', function () { return new THREE.CylinderGeometry(0.035, 0.035, 2.0, 6); }), k.pole)).position.y = 1.0;
    var canopy = new THREE.Group(); canopy.position.y = 1.95; canopy.rotation.z = 0.12; g.add(canopy);
    var n = 8;
    for (var i = 0; i < n; i++) {
      var wedge = new THREE.ConeGeometry(1.1, 0.42, 3, 1, true, (i / n) * Math.PI * 2, Math.PI * 2 / n);
      canopy.add(mesh(wedge, i % 2 ? k.coral : k.cream));
    }
    var chair = mesh(new THREE.BoxGeometry(0.5, 0.06, 1.1), k.turq); chair.position.set(0.7, 0.28, 0.2); chair.rotation.x = -0.25; g.add(chair);
    g.scale.setScalar(s);
    return g;
  }

  function hut(k, rng, s) {
    var g = new THREE.Group();
    var body = mesh(new THREE.BoxGeometry(1.8, 1.2, 1.6), k.wood); body.position.y = 0.6; g.add(body);
    var thatch = mat('thatch', function () { return std('#d4b06a', { roughness: 1, flatShading: true }); });
    var roof = mesh(new THREE.ConeGeometry(1.65, 1.0, 4), thatch); roof.position.y = 1.7; roof.rotation.y = Math.PI / 4; g.add(roof);
    var door = mesh(new THREE.BoxGeometry(0.5, 0.8, 0.05), k.navy); door.position.set(0, 0.42, 0.81); g.add(door);
    for (var i = -1; i <= 1; i += 2) { var stilt = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6), k.post); stilt.position.set(i * 0.8, -0.3, 0.7); g.add(stilt); }
    g.scale.setScalar(s);
    return g;
  }

  function boat(k, rng, s) {
    var g = new THREE.Group();
    var hullShape = new THREE.Shape();
    hullShape.moveTo(-1.1, 0.25); hullShape.lineTo(1.1, 0.25); hullShape.quadraticCurveTo(1.0, -0.2, 0.6, -0.25); hullShape.lineTo(-0.7, -0.25); hullShape.quadraticCurveTo(-1.05, -0.15, -1.1, 0.25);
    var hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.7, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
    hullGeo.translate(0, 0, -0.35);
    var hull = mesh(hullGeo, k.cream); g.add(hull);
    var stripe = mesh(new THREE.BoxGeometry(2.25, 0.07, 0.84), k.coral); stripe.position.y = 0.18; g.add(stripe);
    var mast = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), k.post); mast.position.set(0.1, 1.1, 0); g.add(mast);
    var sailShape = new THREE.Shape(); sailShape.moveTo(0, 0); sailShape.lineTo(0, 1.5); sailShape.lineTo(0.9, 0.05); sailShape.lineTo(0, 0);
    var sail = mesh(new THREE.ShapeGeometry(sailShape), mat('sail', function () { return std('#fbf5e8', { side: THREE.DoubleSide, roughness: 0.9 }); }));
    sail.position.set(0.15, 0.35, 0); g.add(sail);
    var phase = rng() * 6;
    g.userData.animate = function (t) { g.position.y = g.userData.baseY + Math.sin(t * 1.1 + phase) * 0.05; g.rotation.z = Math.sin(t * 0.9 + phase) * 0.04; };
    g.scale.setScalar(s);
    return g;
  }

  function starfish(k, rng, s) {
    var sh = new THREE.Shape();
    for (var i = 0; i <= 10; i++) { var r = i % 2 ? 0.12 : 0.32, a = i * Math.PI / 5; if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    var g2 = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
    g2.rotateX(-Math.PI / 2);
    var m = mesh(g2, k.coral); m.scale.setScalar(s); m.rotation.y = rng() * 6;
    return m;
  }

  function lighthouse(k, rng, s) {
    var g = new THREE.Group(), bands = 5, h = 5.2;
    for (var i = 0; i < bands; i++) {
      var r0 = 0.95 - i * 0.1, r1 = 0.95 - (i + 1) * 0.1;
      var b = mesh(new THREE.CylinderGeometry(r1, r0, h / bands, 16), i % 2 ? k.coral : k.cream);
      b.position.y = (i + 0.5) * h / bands; g.add(b);
    }
    var deck = mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 16), k.navy); deck.position.y = h + 0.06; g.add(deck);
    var lamp = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.7, 12), mat('lamp', function () { return new THREE.MeshBasicMaterial({ color: '#fff3c4', toneMapped: false }); }), false);
    lamp.position.y = h + 0.47; g.add(lamp);
    var roof = mesh(new THREE.ConeGeometry(0.62, 0.6, 12), k.navy); roof.position.y = h + 1.12; g.add(roof);
    var beamMat = mat('beam', function () { return new THREE.MeshBasicMaterial({ color: '#fff2c0', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); });
    var beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 9, 16, 1, true), beamMat);
    beam.rotation.z = Math.PI / 2; beam.position.x = 4.5;
    var pivot = new THREE.Group(); pivot.position.y = h + 0.47; pivot.add(beam); g.add(pivot);
    var base = mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.6, 7), k.sandstone || k.rock); base.position.y = -0.1; g.add(base);
    g.userData.animate = function (t) { pivot.rotation.y = t * 0.6; };
    g.scale.setScalar(s);
    return g;
  }

  // ---------------------------------------------------------------- Clockwork Garden

  function gearGeometry(teeth, rOut, rIn, depth) {
    var sh = new THREE.Shape(), n = teeth * 4;
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * Math.PI * 2, r = (i % 4 < 2) ? rOut : rIn;
      if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    var hole = new THREE.Path(); hole.absarc(0, 0, rIn * 0.35, 0, Math.PI * 2, true); sh.holes.push(hole);
    var g = new THREE.ExtrudeGeometry(sh, { depth: depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 4 });
    g.translate(0, 0, -depth / 2);
    return g;
  }

  function gear(k, rng, s, opts) {
    var g = new THREE.Group();
    var big = mesh(geo('gearBig', function () { return gearGeometry(12, 1.0, 0.82, 0.18); }), k.brass);
    var small = mesh(geo('gearSmall', function () { return gearGeometry(8, 0.55, 0.42, 0.16); }), k.copper);
    var stand = mesh(new THREE.BoxGeometry(0.25, 1.4, 0.25), k.stone); stand.position.y = 0.7; g.add(stand);
    big.position.set(0, 1.5, 0); small.position.set(1.32, 1.1, 0.02);
    g.add(big); g.add(small);
    var sp = (rng() < 0.5 ? 1 : -1) * (0.3 + rng() * 0.3);
    g.userData.animate = function (t) { big.rotation.z = t * sp; small.rotation.z = -t * sp * (12 / 8) + 0.2; };
    g.rotation.y = rng() * 6;
    g.scale.setScalar(s);
    return g;
  }

  function hedgeBall(k, rng, s) {
    var g = new THREE.Group();
    var pot = mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.5, 10), mat('pot', function () { return std('#c46f4a', { roughness: 0.9 }); })); pot.position.y = 0.25; g.add(pot);
    var ball = mesh(new THREE.IcosahedronGeometry(0.62, 1), k.hedge); ball.position.y = 1.0; g.add(ball);
    g.scale.setScalar(s);
    return g;
  }

  function topiary(k, rng, s) {
    var g = new THREE.Group();
    var pot = mesh(new THREE.CylinderGeometry(0.5, 0.38, 0.55, 10), k.stone); pot.position.y = 0.27; g.add(pot);
    var a = mesh(new THREE.IcosahedronGeometry(0.55, 1), k.hedge); a.position.y = 1.0; g.add(a);
    var b = mesh(new THREE.IcosahedronGeometry(0.42, 1), k.hedge); b.position.y = 1.75; g.add(b);
    var c = mesh(new THREE.ConeGeometry(0.3, 0.7, 8), k.hedge); c.position.y = 2.4; g.add(c);
    g.scale.setScalar(s);
    return g;
  }

  var FLOWER_COLORS = ['#ef6a43', '#f2bd47', '#f6ecd8', '#e45b8f', '#a77bf3'];
  function flowers(k, rng, s) {
    var g = new THREE.Group();
    var bed = mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.25, 14), mat('soil', function () { return std('#5b4532', { roughness: 1 }); })); bed.position.y = 0.12; g.add(bed);
    var head = geo('flower', function () { return new THREE.IcosahedronGeometry(0.11, 0); });
    var stem = geo('stem', function () { return new THREE.CylinderGeometry(0.015, 0.015, 0.35, 4); });
    var col = FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)];
    var fm = mat('flower' + col, function () { return std(col, { roughness: 0.6 }); });
    var heads = [];
    for (var i = 0; i < 16; i++) {
      var a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.75;
      var st = mesh(stem, k.leaf, false); st.position.set(Math.cos(a) * r, 0.42, Math.sin(a) * r); g.add(st);
      var f = mesh(head, fm); f.position.set(st.position.x, 0.62 + rng() * 0.08, st.position.z); g.add(f); heads.push(f);
    }
    var phase = rng() * 6;
    g.userData.animate = function (t) { for (var i2 = 0; i2 < heads.length; i2 += 2) heads[i2].position.y = 0.64 + Math.sin(t * 1.4 + i2 + phase) * 0.015; };
    g.scale.setScalar(s);
    return g;
  }

  function lamp(k, rng, s, opts) {
    var g = new THREE.Group();
    var post = mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.4, 8), k.navy); post.position.y = 1.2; g.add(post);
    var base = mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.25, 8), k.navy); base.position.y = 0.12; g.add(base);
    var bulb = mesh(new THREE.SphereGeometry(0.17, 12, 8), mat('bulb', function () { return new THREE.MeshBasicMaterial({ color: '#ffe7b0', toneMapped: false }); }), false); bulb.position.y = 2.55; g.add(bulb);
    var cap = mesh(new THREE.ConeGeometry(0.26, 0.25, 8), k.navy); cap.position.y = 2.78; g.add(cap);
    var glow = new THREE.Sprite(mat('glowSprite', function () { return new THREE.SpriteMaterial({ map: PC.tex.glow(), color: '#ffd89a', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }); }));
    glow.scale.set(1.4, 1.4, 1); glow.position.y = 2.55; g.add(glow);
    g.scale.setScalar(s);
    return g;
  }

  function bench(k, rng, s) {
    var g = new THREE.Group();
    for (var i = 0; i < 3; i++) { var slat = mesh(new THREE.BoxGeometry(1.6, 0.05, 0.14), k.wood); slat.position.set(0, 0.48, -0.18 + i * 0.18); g.add(slat); }
    var back = mesh(new THREE.BoxGeometry(1.6, 0.4, 0.05), k.wood); back.position.set(0, 0.78, -0.3); back.rotation.x = -0.15; g.add(back);
    for (var j = -1; j <= 1; j += 2) { var leg = mesh(new THREE.BoxGeometry(0.06, 0.5, 0.5), k.navy); leg.position.set(j * 0.7, 0.25, -0.05); g.add(leg); }
    g.scale.setScalar(s);
    return g;
  }

  function lily(k, rng, s) {
    var g = new THREE.Group();
    var pad = mesh(new THREE.CircleGeometry(0.42, 16, 0.3, Math.PI * 1.85), mat('lilypad', function () { return std('#4f8f4a', { side: THREE.DoubleSide, roughness: 0.6 }); }), false);
    pad.rotation.x = -Math.PI / 2; g.add(pad);
    if (rng() < 0.6) { var fl = mesh(new THREE.ConeGeometry(0.12, 0.16, 6), mat('lilyFlower', function () { return std('#f7d6e0', { roughness: 0.5 }); })); fl.position.set(0.1, 0.08, 0.05); fl.rotation.x = Math.PI; g.add(fl); }
    var phase = rng() * 6;
    g.userData.animate = function (t) { g.position.y = g.userData.baseY + Math.sin(t + phase) * 0.012; g.rotation.y = Math.sin(t * 0.2 + phase) * 0.3; };
    g.scale.setScalar(s);
    return g;
  }

  function windmill(k, rng, s, opts) {
    var g = new THREE.Group();
    var tower = mesh(new THREE.CylinderGeometry(0.5, 0.8, 2.6, 8), k.cream); tower.position.y = 1.3; g.add(tower);
    var roof = mesh(new THREE.ConeGeometry(0.7, 0.9, 8), k.coral); roof.position.y = 3.05; g.add(roof);
    var door = mesh(new THREE.BoxGeometry(0.4, 0.7, 0.05), k.navy); door.position.set(0, 0.35, 0.76); door.rotation.x = -0.1; g.add(door);
    var hub = new THREE.Group(); hub.position.set(0, 2.5, 0.75); g.add(hub);
    for (var i = 0; i < 4; i++) {
      var arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; hub.add(arm);
      var spar = mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06), k.wood); spar.position.y = 0.8; arm.add(spar);
      var sail = mesh(new THREE.BoxGeometry(0.42, 1.1, 0.02), k.cream); sail.position.set(0.24, 0.95, 0); arm.add(sail);
    }
    var speed = (opts && opts.speed) || 1.1;
    g.userData.animate = function (t) { hub.rotation.z = -t * speed; };
    g.scale.setScalar(s);
    return g;
  }

  function orrery(k, rng, s) {
    var g = new THREE.Group();
    var sun = mesh(new THREE.SphereGeometry(0.36, 20, 14), k.brass); sun.position.y = 1.15; g.add(sun);
    var stand = mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.0, 8), k.copper); stand.position.y = 0.6; g.add(stand);
    var rings = [];
    [[0.85, 0.09, k.copper], [1.25, 0.12, k.turq], [1.6, 0.08, k.coral]].forEach(function (r, i) {
      var arm = new THREE.Group(); arm.position.y = 1.15; g.add(arm);
      var ring = mesh(new THREE.TorusGeometry(r[0], 0.012, 4, 48), k.brass, false); ring.rotation.x = Math.PI / 2; arm.add(ring);
      var planet = mesh(new THREE.SphereGeometry(r[1], 12, 8), r[2]); planet.position.x = r[0]; arm.add(planet);
      arm.rotation.z = 0.12 * (i - 1);
      rings.push(arm);
    });
    g.userData.animate = function (t) { rings.forEach(function (a, i) { a.rotation.y = t * (0.5 - i * 0.12); }); sun.rotation.y = t * 0.2; };
    g.scale.setScalar(s);
    return g;
  }

  // ---------------------------------------------------------------- Neon Underground

  function pillar(k, rng, s) {
    var g = new THREE.Group();
    var col = mesh(new THREE.CylinderGeometry(0.55, 0.65, 9, 6), k.metal); col.position.y = 0.5; g.add(col);
    var strip = mat('pillarStrip', function () { return new THREE.MeshBasicMaterial({ color: '#37d6e6', toneMapped: false }); });
    var amber = mat('pillarAmber', function () { return new THREE.MeshBasicMaterial({ color: '#ffb547', toneMapped: false }); });
    for (var i = 0; i < 3; i++) { var band = mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 6), i === 1 ? amber : strip, false); band.position.y = 1.2 + i * 1.3; g.add(band); }
    var bands = g.children.slice(1);
    var phase = rng() * 6;
    g.userData.animate = function (t) { bands.forEach(function (b, i) { b.scale.setScalar(1 + 0.03 * Math.sin(t * 2 + i + phase)); }); };
    g.scale.setScalar(s);
    return g;
  }

  function crystal(k, rng, s) {
    var g = new THREE.Group();
    var m = mat('crystal', function () { return new THREE.MeshStandardMaterial({ color: '#6fe9f5', emissive: '#1fb7c9', emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85, flatShading: true }); });
    for (var i = 0; i < 4; i++) {
      var c = mesh(new THREE.OctahedronGeometry(0.3, 0), m);
      c.scale.set(0.6, 1.6 + rng() * 1.2, 0.6);
      c.position.set((rng() - 0.5) * 0.7, 0.4, (rng() - 0.5) * 0.7);
      c.rotation.set((rng() - 0.5) * 0.5, rng() * 3, (rng() - 0.5) * 0.5);
      g.add(c);
    }
    var phase = rng() * 6;
    g.userData.animate = function (t) { m.emissiveIntensity = 0.75 + Math.sin(t * 1.3 + phase) * 0.2; };
    g.scale.setScalar(s);
    return g;
  }

  var screenTex = null;
  function screen(k, rng, s) {
    if (!screenTex) {
      var c = document.createElement('canvas'); c.width = 512; c.height = 256;
      var g2 = c.getContext('2d');
      g2.fillStyle = 'rgba(10,20,34,0.35)'; g2.fillRect(0, 0, 512, 256);
      g2.strokeStyle = 'rgba(79,227,240,0.9)'; g2.lineWidth = 4; g2.strokeRect(8, 8, 496, 240);
      g2.font = '96px "Lilita One", system-ui, sans-serif'; g2.textAlign = 'center'; g2.fillStyle = '#4fe3f0'; g2.fillText('PUTT', 256, 128);
      g2.font = '60px "Lilita One", system-ui, sans-serif'; g2.fillStyle = '#ffb547'; g2.fillText('CLUB', 256, 196);
      for (var y = 0; y < 256; y += 4) { g2.fillStyle = 'rgba(0,0,0,0.25)'; g2.fillRect(0, y, 512, 1); }
      screenTex = new THREE.CanvasTexture(c); screenTex.encoding = THREE.sRGBEncoding;
    }
    var g = new THREE.Group();
    var m = new THREE.MeshBasicMaterial({ map: screenTex, transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false, depthWrite: false });
    var panel = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), m); panel.position.y = 2.6; g.add(panel);
    var frame = mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), k.metal); frame.position.set(0, 0.9, -0.05); g.add(frame);
    var phase = rng() * 6;
    g.userData.animate = function (t) { m.opacity = 0.82 + Math.sin(t * 7 + phase) * 0.03 + (Math.sin(t * 0.7 + phase) > 0.97 ? -0.3 : 0); panel.position.y = 2.6 + Math.sin(t * 0.8 + phase) * 0.06; };
    g.scale.setScalar(s);
    return g;
  }

  function cables(k, rng, s) {
    var g = new THREE.Group();
    var m = mat('cable', function () { return std('#141922', { roughness: 0.6 }); });
    for (var i = 0; i < 3; i++) {
      var pts = [];
      for (var j = 0; j <= 10; j++) { var x = -5 + j; pts.push(new THREE.Vector3(x, -1.2 - Math.sin((j / 10) * Math.PI) * (0.9 + i * 0.3), (i - 1) * 0.5)); }
      var tube = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.06, 5), i === 1 ? k.neonCyan : m, false);
      g.add(tube);
    }
    g.scale.setScalar(s);
    return g;
  }

  function core(k, rng, s) {
    var g = new THREE.Group();
    var orb = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), mat('coreOrb', function () { return new THREE.MeshBasicMaterial({ color: '#4fe3f0', toneMapped: false }); }));
    orb.position.y = 2.4; g.add(orb);
    var halo = new THREE.Sprite(mat('coreHalo', function () { return new THREE.SpriteMaterial({ map: PC.tex.glow(), color: '#4fe3f0', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }); }));
    halo.scale.set(5, 5, 1); halo.position.y = 2.4; g.add(halo);
    var rings = [];
    for (var i = 0; i < 3; i++) {
      var r = mesh(new THREE.TorusGeometry(1.6 + i * 0.35, 0.06, 6, 48), i === 1 ? k.neonAmber : k.metal, false);
      r.position.y = 2.4; r.rotation.x = Math.PI / 2 + i * 0.5; g.add(r); rings.push(r);
    }
    var base = mesh(new THREE.CylinderGeometry(1.4, 1.8, 0.8, 8), k.metal); base.position.y = 0.4; g.add(base);
    g.userData.animate = function (t) { rings.forEach(function (r, i) { r.rotation.y = t * (0.4 + i * 0.25); r.rotation.z = t * 0.2 * (i - 1); }); orb.scale.setScalar(1 + Math.sin(t * 2.2) * 0.04); };
    g.scale.setScalar(s);
    return g;
  }

  var BUILDERS = {
    palm: palm, rock: rock, bluff: bluff, sandBank: sandBank, tuft: tuft, dock: dock, lantern: lantern, net: net, wreck: wreck, stiltHut: stiltHut, cloud: cloud,
    umbrella: umbrella, hut: hut, boat: boat, starfish: starfish, lighthouse: lighthouse,
    gear: gear, hedgeBall: hedgeBall, topiary: topiary, flowers: flowers, lamp: lamp, bench: bench, lily: lily, windmill: windmill, orrery: orrery,
    pillar: pillar, crystal: crystal, screen: screen, cables: cables, core: core
  };

  PC.props = {
    build: function (kind, kit, rng, opts) {
      var b = BUILDERS[kind];
      if (!b) return null;
      return b(kit, rng, (opts && opts.s) || 1, opts || {});
    },
    gearGeometry: gearGeometry
  };
})(window);
