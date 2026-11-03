/* Builds the city from the district tables: ground, roads, buildings, filler blocks, signs, landmarks, sky, Under City. */
(function () {
  var TR = window.TR = window.TR || {};
  var D = window.TRD.districts, Rng = window.TrillionerRng.Rng;
  var CHUNK = 120, UY = D.UNDER_Y;

  var world = TR.world = {
    scene: null, surface: null, under: null, collide: null, hemi: null, sun: null, chunks: {}, meshes: {}, ranges: {}, gone: {}, rails: [], buildingBoxes: {}, runLayer: null,
    windowMat: null, neonMat: null, waterMat: null, space: 'surface', fountains: [], screens: [], clockFaces: [], spinners: [], props: [],

    init: function (scene) {
      world.scene = scene;
      world.collide = new TR.Collide();
      world.surface = new THREE.Group();
      world.under = new THREE.Group();
      world.under.visible = false;
      scene.add(world.surface, world.under);
      world.solid = new THREE.MeshLambertMaterial({ vertexColors: true });
      world.windowMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffe9a0, emissiveIntensity: 0 });
      world.neonMat = new THREE.MeshBasicMaterial({ vertexColors: true });
      world.hemi = new THREE.HemisphereLight(0xffffff, 0x8a9a7a, 0.62);
      scene.add(world.hemi);
      world.sun = new THREE.DirectionalLight(0xfff4d8, 0.9);
      world.sun.castShadow = true;
      world.sun.shadow.mapSize.set(1536, 1536);
      var sc = world.sun.shadow.camera;
      sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 420;
      world.sun.shadow.bias = -0.0008;
      scene.add(world.sun, world.sun.target);
      scene.fog = new THREE.Fog(0x87ceeb, 150, 640);
      world.buildCity();
    },

    geo: function (x, z, layer, under) {
      var k = (under ? 'u' : 's') + Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK) + ':' + layer;
      return world.chunks[k] || (world.chunks[k] = new TR.Geo());
    },

    buildCity: function () {
      var ids = Object.keys(D.DISTRICTS);
      ids.forEach(function (id) { if (D.DISTRICTS[id].level !== 'under') world.buildGround(D.DISTRICTS[id]); });
      D.ROADS.forEach(world.buildRoad);
      world.signs = new TR.SignAtlas();
      world.usigns = new TR.SignAtlas();
      ids.forEach(function (id) { var d = D.DISTRICTS[id]; if (d.level === 'under') world.buildUnder(d); else world.buildDistrict(d); });
      world.buildRails();
      TR.vehicles.scene = world.scene;
      TR.vehicles.buildRail();
      Object.keys(world.chunks).forEach(function (k) {
        var layer = k.split(':')[1], geo = world.chunks[k], under = k.charAt(0) === 'u';
        var mesh = layer === 'solid' ? geo.mesh(world.solid, true, true) : layer === 'flat' ? geo.mesh(world.solid, false, true) : layer === 'window' ? geo.mesh(world.windowMat) : geo.mesh(world.neonMat);
        mesh.geometry.computeBoundingSphere();
        world.meshes[k] = mesh;
        (under ? world.under : world.surface).add(mesh);
      });
      world.surface.add(world.signs.mesh());
      world.under.add(world.usigns.mesh());
      // the sea, with a floor for the submarine
      var sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), world.waterMat = new THREE.MeshLambertMaterial({ color: 0x2f9fe0, transparent: true, opacity: 0.82 }));
      sea.rotation.x = -Math.PI / 2; sea.position.y = -1.6; sea.renderOrder = 2;
      world.surface.add(sea);
      world.sea = sea;
      var bed = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x1b4f6b }));
      bed.rotation.x = -Math.PI / 2; bed.position.y = world.SEABED;
      world.surface.add(bed);
      world.animated();
    },

    SEABED: -24,

    // Grind rails for the hoverboard, along the widest streets.
    buildRails: function () {
      [[[-100, -11], [-40, -11]], [[20, -12], [100, -12]], [[-110, 230], [-40, 230]], [[140, 12], [230, 12]], [[-200, 40], [-130, 40]], [[130, 212], [200, 212]], [[-60, -130], [60, -130]]].forEach(function (r) {
        var a = r[0], b = r[1], y = 1.6, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, l = Math.hypot(b[0] - a[0], b[1] - a[1]), g = world.geo(mx, mz, 'neon');
        g.box(mx, y - 0.1, mz, Math.abs(b[0] - a[0]) + 0.3, 0.2, Math.abs(b[1] - a[1]) + 0.3, 0xff7de9);
        for (var i = 0; i <= 4; i++) { var px = a[0] + (b[0] - a[0]) * i / 4, pz = a[1] + (b[1] - a[1]) * i / 4; world.geo(px, pz, 'solid').box(px, 0, pz, 0.25, y, 0.25, 0x666a70); }
        world.rails.push({ a: a, b: b, y: y, l: l });
      });
    },

    buildGround: function (d) {
      var b = d.land || d.bounds, step = CHUNK;
      for (var x = b[0]; x < b[2]; x += step) for (var z = b[1]; z < b[3]; z += step) {
        var x1 = Math.min(x + step, b[2]), z1 = Math.min(z + step, b[3]);
        world.geo((x + x1) / 2, (z + z1) / 2, 'flat').box((x + x1) / 2, -30, (z + z1) / 2, x1 - x, 30, z1 - z, d.ground);
      }
    },

    buildRoad: function (r) {
      for (var i = 0; i < r.pts.length - 1; i++) {
        var a = r.pts[i], b = r.pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(len / CHUNK);
        for (var s = 0; s < n; s++) {
          var t0 = s / n, t1 = (s + 1) / n, x0 = a[0] + (b[0] - a[0]) * t0, z0 = a[1] + (b[1] - a[1]) * t0, x1 = a[0] + (b[0] - a[0]) * t1, z1 = a[1] + (b[1] - a[1]) * t1;
          var g = world.geo((x0 + x1) / 2, (z0 + z1) / 2, 'flat');
          g.strip(x0, z0, x1, z1, r.w + 4, 0.02, 0xc9c9c2);
          g.strip(x0, z0, x1, z1, r.w, 0.04, 0x45474f);
          var segLen = len / n, dashes = Math.floor(segLen / 9), ux = (x1 - x0) / segLen, uz = (z1 - z0) / segLen;
          for (var k = 0; k < dashes; k++) {
            var px = x0 + ux * (k * 9 + 2), pz = z0 + uz * (k * 9 + 2);
            g.strip(px, pz, px + ux * 4, pz + uz * 4, 0.5, 0.06, 0xfff2b0);
          }
        }
      }
    },

    roadDist: function (x, z) {
      var best = 1e9;
      for (var r = 0; r < D.ROADS.length; r++) {
        var R = D.ROADS[r];
        for (var i = 0; i < R.pts.length - 1; i++) {
          var a = R.pts[i], b = R.pts[i + 1], vx = b[0] - a[0], vz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz)));
          var d = Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t) - R.w / 2;
          if (d < best) best = d;
        }
      }
      return best;
    },

    /** Runs fn, remembering which vertices it wrote so the building can be erased when demolished. */
    tracked: function (id, x, z, under, fn) {
      var layers = ['solid', 'window', 'neon'], before = layers.map(function (l) { return world.geo(x, z, l, under).p.length; });
      fn();
      if (!id) return;
      var key = (under ? 'u' : 's') + Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
      world.ranges[id] = layers.map(function (l, i) { return { chunk: key + ':' + l, from: before[i], to: world.geo(x, z, l, under).p.length }; });
    },
    setBuildingGone: function (id, gone) {
      (world.ranges[id] || []).forEach(function (r) {
        var m = world.meshes[r.chunk]; if (!m || r.to === r.from) return;
        var attr = m.geometry.attributes.position;
        if (!m.userData.backup) m.userData.backup = attr.array.slice();
        for (var i = r.from; i < r.to; i++) attr.array[i] = gone ? 0 : m.userData.backup[i];
        attr.needsUpdate = true;
      });
      var box = world.buildingBoxes[id];
      if (box) box.off = !!gone;
      if (gone) world.gone[id] = true; else delete world.gone[id];
    },
    /** New run: everything the last run did to the city is undone. */
    resetRun: function () {
      Object.keys(world.gone).forEach(function (id) { world.setBuildingGone(id, false); });
      if (world.rocket) { world.rocket.position.y = 0; world.rocket.visible = true; world.rocketFlying = 0; }
      if (world.runLayer) {
        world.scene.remove(world.runLayer);
        world.runLayer.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      }
      (world.projectBoxes || []).forEach(function (b) { b.off = true; });
      world.projectBoxes = [];
      world.runLayer = new THREE.Group();
      world.scene.add(world.runLayer);
    },
    runMesh: function (g, mat, cast) {
      var m = g.mesh(mat, cast, cast);
      m.geometry.computeBoundingSphere();
      world.runLayer.add(m);
      return m;
    },
    /** Rubble lot where a building stood. Stays for the run. */
    addRubble: function (b, y) {
      var g = new TR.Geo(), r = new Rng('rubble:' + b.id), cols = [0x8a8378, 0x6f6a62, 0xa89f90, 0x5a554e];
      g.box(b.x, y, b.z, b.w, 0.3, b.d, 0x77706a);
      for (var i = 0; i < 26; i++) {
        var s = r.range(1, 4);
        g.box(b.x + r.range(-b.w / 2, b.w / 2) * 0.9, y + 0.2, b.z + r.range(-b.d / 2, b.d / 2) * 0.9, s, r.range(0.5, 2.4), s * r.range(0.7, 1.5), r.pick(cols), r.range(0, 3));
      }
      world.runMesh(g, world.solid, true);
    },
    /** The owner's gold trim around the roof. */
    addTrim: function (b, y) {
      var g = new TR.Geo(), top = y + b.h + 0.8, t = 0.7, gold = 0xffc53d;
      g.box(b.x, top, b.z - b.d / 2, b.w + 1.4, t, t, gold).box(b.x, top, b.z + b.d / 2, b.w + 1.4, t, t, gold);
      g.box(b.x - b.w / 2, top, b.z, t, t, b.d + 1.4, gold).box(b.x + b.w / 2, top, b.z, t, t, b.d + 1.4, gold);
      world.runMesh(g, world.neonMat);
    },
    /** Bought city projects that are not a whole building still change the street. */
    addVisual: function (kind) {
      var g = new TR.Geo(), n = new TR.Geo(), c = world.collide;
      if (kind === 'harbour_bridge') {
        for (var i = 0; i < 12; i++) { var x = 124 + i * 8; g.box(x + 4, 7, 300, 8.2, 0.8, 14, 0xd9352c); if (i % 3 === 0) { g.box(x, -3, 293, 1.2, 28, 1.2, 0xd9352c); g.box(x, -3, 307, 1.2, 28, 1.2, 0xd9352c); } }
        world.projectBoxes.push(c.add(124, 7, 293, 220, 7.8, 307, { project: kind }));
      } else if (kind === 'metro_line') {
        TR.vehicles.RAIL.forEach(function (p) { n.box(p[0], TR.vehicles.RAIL_Y + 0.6, p[1], 7, 1, 7, 0x7dffea); n.box(p[0], 0, p[1], 2, TR.vehicles.RAIL_Y, 2, 0x2ad0ff); });
      } else if (kind === 'golden_metro') {
        g.box(-22, 0, -22, 22, 5, 14, 0xffc53d).box(-22, 5, -22, 26, 1, 18, 0xfff0b0);
        world.projectBoxes.push(c.addBox(-22, 0, -22, 22, 6, 14, { project: kind }));
      } else if (kind === 'free_wifi') {
        [[-40, -40], [40, 40], [40, -14], [-14, 40]].forEach(function (p) { g.box(p[0], 0, p[1], 0.5, 12, 0.5, 0xaaaaaa); n.cyl(p[0], 12, p[1], 2, 0.3, 0x7dd8ff, 8); });
      } else if (kind === 'skyline_show') {
        [[60, -62], [-104, -104], [104, -104], [-104, 104], [104, 104]].forEach(function (p) { n.cyl(p[0], 80, p[1], 1, 400, 0xff7de9, 6, 5); });
      } else if (kind === 'park') {
        [[-150, -160], [-175, -160], [-200, -160]].forEach(function (p, i) {
          n.strip(p[0] - 10, p[1], p[0] + 10, p[1], 20, 0.08, 0x5fd35f);
          g.cyl(p[0] - 5, 0, p[1] + 4, 0.5, 3, 0x7a5230, 6).cyl(p[0] - 5, 2.4, p[1] + 4, 2.4, 3.6, 0x4fae4f, 7, 0.6).cyl(p[0] + 5, 0, p[1] - 4, 0.5, 3, 0x7a5230, 6).cyl(p[0] + 5, 2.4, p[1] - 4, 2.4, 3.6, 0x3d9b4a, 7, 0.6);
        });
      }
      if (g.count) world.runMesh(g, world.solid, true);
      if (n.count) world.runMesh(n, world.neonMat);
    },
    /** Statues rise in the plazas as the spent total climbs. */
    addStatue: function (i) {
      var spots = [[-30, -30], [30, 30], [-30, 30], [240, 48], [-160, -26], [-60, 226], [190, 136], [-6, -134], [160, -134]], s = spots[i % spots.length], g = new TR.Geo();
      g.box(s[0], 0, s[1], 5, 2, 5, 0xeeeeee).box(s[0], 2, s[1], 2, 2.6, 1.2, 0xffc53d).box(s[0], 4.6, s[1], 1.5, 1.5, 1.5, 0xffc53d).box(s[0] - 1.3, 3, s[1], 0.6, 2.4, 0.6, 0xffc53d).box(s[0] + 1.3, 3.6, s[1], 0.6, 2.8, 0.6, 0xffc53d);
      world.projectBoxes.push(world.collide.addBox(s[0], 0, s[1], 5, 2, 5, { statue: i }));
      world.runMesh(g, world.solid, true);
    },
    launchRocket: function () { world.rocketFlying = 0.001; },
    /** A bought project rises from its lot. */
    addProject: function (b, y) {
      var g = new TR.Geo();
      g.box(b.x, y, b.z, b.w, b.h, b.d, b.wall).box(b.x, y + b.h, b.z, b.w + 1, 0.8, b.d + 1, b.roof);
      world.runMesh(g, world.solid, true);
      world.projectBoxes.push(world.collide.addBox(b.x, y, b.z, b.w, b.h + 0.8, b.d, { project: b.id }));
    },

    addBuilding: function (b, d, base, under) {
      var y = b.y != null ? b.y : (base || 0), g = world.geo(b.x, b.z, 'solid', under), shape = d.filler && !b.id ? d.filler.shape : null;
      var wall = b.wall != null ? b.wall : d.walls[0], roof = b.roof != null ? b.roof : d.roofs[0];
      g.box(b.x, y, b.z, b.w, b.h, b.d, wall);
      if (shape === 'house') { // gabled roof from stepped blocks
        g.box(b.x, y + b.h, b.z, b.w + 1, 1, b.d + 1, roof).box(b.x, y + b.h + 1, b.z, b.w * 0.66, 1, b.d + 1, roof).box(b.x, y + b.h + 2, b.z, b.w * 0.3, 1, b.d + 1, roof);
      } else if (shape === 'tower') {
        g.box(b.x, y + b.h, b.z, b.w * 0.7, 3, b.d * 0.7, roof).box(b.x, y + b.h + 3, b.z, b.w * 0.34, 3, b.d * 0.34, wall);
      } else if (shape === 'factory') {
        g.box(b.x, y + b.h, b.z, b.w + 1, 0.8, b.d + 1, roof);
        g.cyl(b.x + b.w * 0.25, y + b.h, b.z, 1.2, 7, 0x6b6f75, 8, 0.9);
      } else if (shape === 'hangar') {
        g.cyl(b.x, y + b.h, b.z, b.w * 0.45, 2.4, roof, 10, b.w * 0.2);
      } else if (shape === 'brick') {
        g.box(b.x, y + b.h, b.z, b.w + 1.2, 0.7, b.d + 1.2, roof).box(b.x + b.w * 0.25, y + b.h, b.z, 2, 3, 2, 0x7d4a2c);
      } else if (shape === 'villa') {
        g.box(b.x, y + b.h, b.z, b.w + 1.6, 0.8, b.d + 1.6, roof).box(b.x, y + b.h + 0.8, b.z, b.w * 0.5, 1.4, b.d * 0.5, 0xfff0f4);
      } else if (shape === 'container') {
        g.box(b.x, y + b.h, b.z, b.w * 0.8, 3, b.d * 0.8, d.walls[Math.abs(Math.floor(b.x)) % d.walls.length]);
      } else g.box(b.x, y + b.h, b.z, b.w + 1, 0.8, b.d + 1, roof);
      if (shape !== 'container') world.windows(b.x, y, b.z, b.w, b.h, b.d, b.boarded, under);
      var box = world.collide.addBox(b.x, y, b.z, b.w, b.h + 0.8, b.d, b.id ? { building: b.id } : null);
      if (b.id) world.buildingBoxes[b.id] = box;
    },

    windows: function (x, y, z, w, h, d, boarded, under) {
      var g = world.geo(x, z, 'window', under), color = boarded ? 0x4a3b2c : 0x3f6e96, rows = Math.max(1, Math.floor((h - 2) / 3.6));
      if (h > 60) rows = Math.floor(rows / 2);
      var stepY = h > 60 ? 7.2 : 3.6;
      for (var r = 0; r < rows; r++) {
        var wy = y + 2 + r * stepY, nx = Math.max(1, Math.floor(w / (h > 60 ? 8 : 4.4))), nz = Math.max(1, Math.floor(d / (h > 60 ? 8 : 4.4)));
        for (var i = 0; i < nx; i++) {
          var wx = x - w / 2 + (i + 0.5) * (w / nx);
          g.box(wx, wy, z + d / 2, 2, 1.9, 0.14, color); g.box(wx, wy, z - d / 2, 2, 1.9, 0.14, color);
        }
        for (i = 0; i < nz; i++) {
          var wz = z - d / 2 + (i + 0.5) * (d / nz);
          g.box(x + w / 2, wy, wz, 0.14, 1.9, 2, color); g.box(x - w / 2, wy, wz, 0.14, 1.9, 2, color);
        }
      }
    },

    buildDistrict: function (d) {
      var taken = [];
      if (d.hill) world.hill(d);
      if (d.pier) world.pier(d);
      (d.runways || []).forEach(function (r) { world.runway(r); });
      (d.buildings || []).forEach(function (b) {
        if (!b.project) {
          world.tracked(b.id, b.x, b.z, false, function () { world.addBuilding(b, d); world.door(b, d); });
          if (!b.hiddenSign) world.signs.add(b.name, b, d);
          if (b.walled) world.compound(b);
          if (b.helipad) world.helipad(b);
        }
        taken.push([b.x - b.w / 2 - 7, b.z - b.d / 2 - 7, b.x + b.w / 2 + 7, b.z + b.d / 2 + 7]);
        var f = TrillionerLayout.frontOf(b);
        taken.push([Math.min(f.x, f.x + (f.nz ? 22 : f.nx * 6)) - 4, Math.min(f.z, f.z + (f.nx ? 22 : f.nz * 6)) - 4, Math.max(f.x, f.x + (f.nz ? 22 : f.nx * 6)) + 4, Math.max(f.z, f.z + (f.nx ? 22 : f.nz * 6)) + 4]);
      });
      (d.stalls || []).forEach(function (s) {
        var c = s.cols || 6, sp = s.spacing || 6, extent = c * sp / 2 + 4;
        taken.push(s.dir === 'z' ? [s.x - 6, s.z - extent, s.x + 22, s.z + extent] : [s.x - extent, s.z - 6, s.x + extent, s.z + 22]);
        if (s.y == null && !s.plain) world.stallAwning(s, d);
      });
      if (d.change) { taken.push([d.change.x - 16, d.change.z - 14, d.change.x + 16, d.change.z + 6]); world.fountain(d); }
      (d.stairs || []).forEach(function (st) { world.stair(st, d, 0, false); taken.push([st.x - 8, st.z - 8, st.x + 8, st.z + 8]); });
      (d.landmarks || []).forEach(function (l) { world.landmark(l, d); var r = (l.r || (l.w || 20) / 2) + 8; taken.push([l.x - r, l.z - r, l.x + r, l.z + r]); });
      world.fill(d, taken);
      world.scatter(d, taken);
    },

    door: function (b, d) {
      var f = TrillionerLayout.frontOf(b), y = b.y || 0, g = world.geo(b.x, b.z, 'solid'), n = world.geo(b.x, b.z, 'neon');
      var dw = 5, dh = 4.4, dx = f.nx ? (f.x - f.nx * 5.5) : f.x, dz = f.nz ? (f.z - f.nz * 5.5) : f.z;
      g.box(dx + f.nx * 0.2, y, dz + f.nz * 0.2, f.nz ? dw : 0.3, dh, f.nz ? 0.3 : dw, b.enter ? 0x2b2b3f : 0x8a8a8a);
      if (b.enter) n.box(dx + f.nx * 0.3, y + dh, dz + f.nz * 0.3, f.nz ? dw + 1 : 0.3, 0.5, f.nz ? 0.3 : dw + 1, b.neon ? (d.neon || 0xffc53d) : 0xfff0c0);
      if (b.boarded) for (var i = 0; i < 3; i++) g.box(dx + f.nx * 0.4, y + 0.8 + i * 1.3, dz + f.nz * 0.4, f.nz ? dw + 1 : 0.2, 0.3, f.nz ? 0.2 : dw + 1, 0x8d6e4b);
    },

    // The hill: stacked terraces, low enough to walk up.
    hill: function (d) {
      var h = d.hill, b = d.bounds;
      for (var i = 0; i < h.steps; i++) {
        var half = h.top / 2 + (h.steps - 1 - i) * h.run, x0 = Math.max(b[0], h.x - half), x1 = Math.min(b[2], h.x + half), z0 = Math.max(b[1], h.z - half), z1 = Math.min(b[3], h.z + half);
        var top = (i + 1) * h.rise, c = i % 2 ? 0x74c256 : 0x7ecb5e;
        world.geo((x0 + x1) / 2, (z0 + z1) / 2, 'flat').box((x0 + x1) / 2, top - h.rise, (z0 + z1) / 2, x1 - x0, h.rise, z1 - z0, c);
        world.collide.add(x0, 0, z0, x1, top, z1, { hill: 1 });
      }
    },
    pier: function (d) {
      var p = d.pier, z = (p.z0 + p.z1) / 2, l = p.z1 - p.z0, g = world.geo(p.x, z, 'solid');
      g.box(p.x, -0.5, z, p.w, 0.7, l, 0xa8815a);
      for (var i = 0; i < 6; i++) { g.box(p.x - p.w / 2, -8, p.z0 + i * l / 5, 0.8, 8, 0.8, 0x6b4d2c); g.box(p.x + p.w / 2, -8, p.z0 + i * l / 5, 0.8, 8, 0.8, 0x6b4d2c); }
      world.collide.add(p.x - p.w / 2, -2, p.z0, p.x + p.w / 2, 0.2, p.z1, { pier: 1 });
    },
    runway: function (r) {
      var g = world.geo(r.x, r.z, 'flat');
      g.strip(r.x - r.w / 2, r.z, r.x + r.w / 2, r.z, r.d, 0.05, r.pad ? 0x9a9a9a : 0x3a3f47);
      if (!r.pad) for (var i = 0; i < 11; i++) { var x = r.x - r.w / 2 + 6 + i * 11.5; g.strip(x, r.z, x + 6, r.z, 1, 0.07, 0xffffff); }
    },
    compound: function (b) { // a wall tall enough that only a helicopter gets in
      var pad = 12, h = 26, c = world.collide, g = world.geo(b.x, b.z, 'solid'), x0 = b.x - b.w / 2 - pad, x1 = b.x + b.w / 2 + pad, z0 = b.z - b.d / 2 - pad, z1 = b.z + b.d / 2 + pad + 6, col = 0x5a6670;
      g.box((x0 + x1) / 2, 0, z0, x1 - x0, h, 2, col).box((x0 + x1) / 2, 0, z1, x1 - x0, h, 2, col).box(x0, 0, (z0 + z1) / 2, 2, h, z1 - z0, col).box(x1, 0, (z0 + z1) / 2, 2, h, z1 - z0, col);
      c.add(x0 - 1, 0, z0 - 1, x1 + 1, h, z0 + 1); c.add(x0 - 1, 0, z1 - 1, x1 + 1, h, z1 + 1); c.add(x0 - 1, 0, z0, x0 + 1, h, z1); c.add(x1 - 1, 0, z0, x1 + 1, h, z1);
    },
    helipad: function (b) {
      var g = world.geo(b.x, b.z, 'neon');
      g.cyl(b.x, b.h + 0.85, b.z, 10, 0.1, 0x2d2d3a, 16);
      g.box(b.x - 3, b.h + 0.95, b.z, 1.2, 0.1, 8, 0xffffff).box(b.x + 3, b.h + 0.95, b.z, 1.2, 0.1, 8, 0xffffff).box(b.x, b.h + 0.95, b.z, 6, 0.1, 1.2, 0xffffff);
    },
    stallAwning: function (s, d) {
      var c = s.cols || 6, sp = s.spacing || 6, len = c * sp, g = world.geo(s.x, s.z, 'solid');
      var ax = s.dir === 'z' ? s.x - 5 : s.x, az = s.dir === 'z' ? s.z : s.z - 5;
      g.box(ax, 0, az, s.dir === 'z' ? 1 : len, 3, s.dir === 'z' ? len : 1, d.walls[1 % d.walls.length]);
      g.box(ax, 3, az, s.dir === 'z' ? 3 : len + 1, 0.5, s.dir === 'z' ? len + 1 : 3, d.neon || 0xffc53d);
      world.collide.addBox(ax, 0, az, s.dir === 'z' ? 1 : len, 3, s.dir === 'z' ? len : 1);
      world.signs.addFlat(s.name, ax, 5.4, az, Math.min(len, 24), Math.min(len, 24) * 0.17, d.neon || 0xffc53d, s.dir === 'z' ? Math.PI / 2 : 0);
    },
    /** A spiral fire escape with a bridge to the roof: the rooftop route every district gets. */
    stair: function (st, d, base, under) {
      var y0 = base || 0, n = Math.ceil(st.to / 0.6), g = world.geo(st.x, st.z, 'solid', under), c = world.collide, R = 3.6;
      g.cyl(st.x, y0, st.z, 0.8, st.to + 2, 0x777b80, 8);
      c.addBox(st.x, y0, st.z, 1.2, st.to + 2, 1.2);
      for (var i = 0; i < n; i++) {
        var a = i / 11 * Math.PI * 2, x = st.x + Math.cos(a) * R, z = st.z + Math.sin(a) * R, top = y0 + (i + 1) * 0.6;
        g.box(x, top - 0.25, z, 3, 0.25, 3, i % 2 ? 0xf0a030 : 0xdf8f20);
        c.add(x - 1.6, top - 0.5, z - 1.6, x + 1.6, top, z + 1.6);
      }
      var dx = st.dir === 'e' ? 1 : st.dir === 'w' ? -1 : 0, dz = st.dir === 's' ? 1 : st.dir === 'n' ? -1 : 0, top2 = y0 + st.to + 0.8;
      var cx = st.x + dx * st.len / 2, cz = st.z + dz * st.len / 2, w = dx ? st.len + 6 : 7, dd = dz ? st.len + 6 : 7;
      g.box(cx, top2 - 0.4, cz, w, 0.4, dd, 0xb0b4b8);
      c.addBox(cx, top2 - 0.8, cz, w, 0.8, dd);
    },
    fountain: function (d) {
      var c = d.change, under = d.level === 'under', y = under ? UY : 0, g = world.geo(c.x, c.z, 'solid', under), n = world.geo(c.x, c.z, 'neon', under);
      g.cyl(c.x, y, c.z - 8, 4.4, 0.9, 0xd8dde3, 12);
      n.cyl(c.x, y + 0.9, c.z - 8, 3.8, 0.1, 0x46b4f0, 12);
      g.cyl(c.x, y + 0.9, c.z - 8, 0.7, 2.6, 0xe9edf2, 8);
      world.collide.add(c.x - 3.6, y, c.z - 11.6, c.x + 3.6, y + 0.9, c.z - 4.4, { fountain: d.id });
      world.fountains.push({ x: c.x, y: y, z: c.z - 8, district: d.id });
      world.signs.addFlat && (under ? world.usigns : world.signs).addFlat('Vending and Wishes', c.x, y + 4.6, c.z - 1.6, 12, 2, 0x2f7fd6, 0);
    },

    landmark: function (l, d, under) {
      var base = under ? UY : 0, g = world.geo(l.x, l.z, 'solid', under), n = world.geo(l.x, l.z, 'neon', under), c = world.collide;
      if (l.kind === 'chimney') {
        g.cyl(l.x, 0, l.z, l.r, l.h, 0x9c5a3c, 12, l.r * 0.62);
        for (var i = 1; i < 4; i++) g.cyl(l.x, l.h * i / 4, l.z, l.r * (1 - i * 0.1) + 0.4, 2.4, i % 2 ? 0xffffff : 0xd9352c, 12);
        g.cyl(l.x, l.h, l.z, l.r * 0.66, 2, 0x2a2a2a, 12);
        c.add(l.x - l.r, 0, l.z - l.r, l.x + l.r, l.h, l.z + l.r);
      } else if (l.kind === 'bigsign') {
        g.box(l.x - l.w / 2 + 3, 0, l.z, 1.4, l.h, 1.4, 0x444444).box(l.x + l.w / 2 - 3, 0, l.z, 1.4, l.h, 1.4, 0x444444);
        c.addBox(l.x - l.w / 2 + 3, 0, l.z, 1.4, l.h, 1.4); c.addBox(l.x + l.w / 2 - 3, 0, l.z, 1.4, l.h, 1.4);
        world.signs.addFlat(l.text, l.x, l.h - 3.5, l.z + 0.8, l.w, 8, d.neon || 0xffc53d, 0);
      } else if (l.kind === 'screen') {
        g.box(l.x, 0, l.z, 2, l.h, 2, 0x444444);
        c.addBox(l.x, 0, l.z, 2, l.h, 2);
        world.screens.push(l);
      } else if (l.kind === 'globe') {
        for (var k = 0; k < 9; k++) {
          var t = (k + 0.5) / 9, h = l.r * 2 / 9, a0 = Math.sqrt(Math.max(0, 1 - Math.pow(2 * k / 9 - 1, 2))), a1 = Math.sqrt(Math.max(0, 1 - Math.pow(2 * (k + 1) / 9 - 1, 2)));
          g.cyl(l.x, 3 + k * h, l.z, l.r * a0, h, k % 3 ? 0x3da8ff : 0x5dbb63, 14, l.r * a1);
        }
        g.cyl(l.x, 0, l.z, 3, 3, 0xd6547c, 10, 1.4);
        c.addBox(l.x, 0, l.z, l.r * 1.4, l.r * 2 + 3, l.r * 1.4);
      } else if (l.kind === 'ferris') {
        g.box(l.x, 0, l.z - 3, 2, l.r + 3, 2, 0x8e7dbe).box(l.x, 0, l.z + 3, 2, l.r + 3, 2, 0x8e7dbe);
        c.addBox(l.x, 0, l.z, 2, l.r + 3, 8);
        // broken: one side sags and a few cars are gone
        for (var j = 0; j < 16; j++) {
          var ang = j / 16 * Math.PI * 2, fx = l.x + Math.cos(ang) * l.r, fy = l.r + 3 + Math.sin(ang) * l.r * 0.98 - (j > 10 ? 2 : 0);
          g.box(fx, fy, l.z, 2.2, 2.2, 0.8, 0xc9a0dc);
          if (j % 4 !== 3) g.box(fx, fy - 2.4, l.z, 2.4, 2, 2.4, [0xff7a59, 0xffd166, 0x7ad0ff][j % 3]);
        }
      } else if (l.kind === 'crane') {
        var col = l.label === 'rusted' ? 0x9c5a3c : 0xe25c4f;
        g.box(l.x, 0, l.z, 3, l.h, 3, col).box(l.x + 9, l.h, l.z, 26, 2, 2, col).box(l.x + 20, l.h - 8, l.z, 0.4, 8, 0.4, 0x333333).box(l.x + 20, l.h - 11, l.z, 5, 3, 5, 0x555555);
        c.addBox(l.x, 0, l.z, 3, l.h, 3);
        if (l.label === 'rusted') { g.box(l.x, l.h + 0.1, l.z, 14, 0.5, 10, col); c.addBox(l.x, l.h, l.z, 14, 0.6, 10); }
      } else if (l.kind === 'lighthouse') {
        g.cyl(l.x, 8, l.z, 5, l.h - 8, 0xd9352c, 12, 3.4);
        for (i = 1; i < 3; i++) g.cyl(l.x, 8 + (l.h - 8) * i / 3, l.z, 4.8 - i * 0.5, 3, 0xffffff, 12);
        n.cyl(l.x, l.h, l.z, 3.2, 3, 0xfff6a0, 10);
        g.cyl(l.x, l.h + 3, l.z, 3.6, 2.4, 0x7d1c19, 10, 0);
        c.addBox(l.x, 8, l.z, 7, l.h, 7);
      } else if (l.kind === 'rocket') {
        g.box(l.x, 0, l.z, 26, 2, 26, 0x777b80);
        world.rocketBase = { x: l.x, z: l.z, h: l.h };
        c.addBox(l.x, 0, l.z, 26, 2, 26);
      } else if (l.kind === 'clock') {
        g.box(l.x, 0, l.z, 13, l.h, 13, 0xb5533c).box(l.x, l.h, l.z, 15, 1.4, 15, 0x6b3a26).cyl(l.x, l.h + 1.4, l.z, 8, 10, 0x54301f, 4, 0);
        c.addBox(l.x, 0, l.z, 13, l.h + 1.4, 13);
        world.clockTower = l;
      } else if (l.kind === 'goldtrain') {
        var y = base + 0.2;
        g.box(l.x, base, l.z, 130, 0.3, 5, 0x444444);
        for (i = -3; i < 3; i++) { g.box(l.x + i * 13 + 6, y + 0.8, l.z, 11.4, 4.2, 4, 0xffc53d); g.box(l.x + i * 13 + 6, y + 5, l.z, 11.8, 0.5, 4.4, 0xb58a00); }
        c.addBox(l.x, base, l.z, 80, 6, 4.4);
      }
    },

    // Filler blocks: fixed for every seed. Gaps between them are the alleys.
    fill: function (d, taken) {
      var f = d.filler; if (!f) return;
      var rng = new Rng('fill:' + d.id), b = d.land || d.bounds, step = f.step;
      for (var x = b[0] + step / 2; x < b[2]; x += step) for (var z = b[1] + step / 2; z < b[3]; z += step) {
        var w = rng.range(step * 0.5, step * 0.74), dd = rng.range(step * 0.5, step * 0.74), h = rng.range(f.hMin, f.hMax);
        var px = x + rng.range(-2, 2), pz = z + rng.range(-2, 2);
        var skip = rng.next() < (f.gap || 0.2), wall = rng.pick(d.walls), roof = rng.pick(d.roofs);
        if (skip) continue;
        if (px - w / 2 < b[0] + 4 || px + w / 2 > b[2] - 4 || pz - dd / 2 < b[1] + 4 || pz + dd / 2 > b[3] - 4) continue;
        if (world.roadDist(px, pz) < Math.max(w, dd) / 2 * 1.42 + 4) continue;
        if (d.hill && Math.max(Math.abs(px - d.hill.x), Math.abs(pz - d.hill.z)) < d.hill.top / 2 + d.hill.steps * d.hill.run + dd) continue;
        var clash = false;
        for (var i = 0; i < taken.length; i++) { var t = taken[i]; if (px + w / 2 > t[0] && px - w / 2 < t[2] && pz + dd / 2 > t[1] && pz - dd / 2 < t[3]) { clash = true; break; } }
        if (clash) continue;
        world.addBuilding({ id: null, x: px, z: pz, w: w, d: dd, h: h, wall: wall, roof: roof }, d);
        world.fillers = world.fillers || []; world.fillers.push([px, pz, w, dd, d.id]);
      }
    },

    // Street props, one look per district.
    scatter: function (d, taken) {
      var rng = new Rng('props:' + d.id), b = d.land || d.bounds, under = d.level === 'under', y = under ? UY : 0, n = under ? 70 : 60, tries = 0, placed = 0;
      while (placed < n && tries++ < n * 8) {
        var x = rng.range(b[0] + 3, b[2] - 3), z = rng.range(b[1] + 3, b[3] - 3), rd = under ? 8 : world.roadDist(x, z);
        if (rd < 1.5 || (!under && rd > 7)) continue;
        var clash = false;
        for (var i = 0; i < taken.length; i++) { var t = taken[i]; if (x > t[0] && x < t[2] && z > t[1] && z < t[3]) { clash = true; break; } }
        if (clash) continue;
        var near = world.collide.near(x, z, 2, []).some(function (bx) { return x > bx.x0 - 1.5 && x < bx.x1 + 1.5 && z > bx.z0 - 1.5 && z < bx.z1 + 1.5; });
        if (near) continue;
        placed++;
        world.prop(d, d.prop, x, y, z, rng, under);
      }
    },
    /** A prop the monster truck can flatten. It gets its own vertex range and a tagged collision box. */
    smashable: function (x, y, z, under, draw, size, h) {
      var id = 'p' + (world.propN = (world.propN || 0) + 1);
      world.tracked(id, x, z, under, draw);
      world.buildingBoxes[id] = world.collide.addBox(x, y, z, size, h, size, { prop: id });
    },
    smash: function (id) { world.setBuildingGone(id, true); },
    prop: function (d, kind, x, y, z, rng, under) {
      var g = world.geo(x, z, 'solid', under), n = world.geo(x, z, 'neon', under), c = world.collide;
      if (kind === 'tree') { g.cyl(x, y, z, 0.5, 3, 0x7a5230, 6); g.cyl(x, y + 2.4, z, 2.4, 3.6, rng.pick([0x4fae4f, 0x62c262, 0x3d9b4a]), 7, 0.6); c.addBox(x, y, z, 0.8, 3, 0.8); }
      else if (kind === 'palm') { g.cyl(x, y, z, 0.45, 7, 0xb58a5a, 6, 0.3); for (var i = 0; i < 5; i++) { var a = i / 5 * 6.283; g.box(x + Math.cos(a) * 1.6, y + 6.8, z + Math.sin(a) * 1.6, 3.2, 0.25, 0.9, 0x3fb56b, -a); } c.addBox(x, y, z, 0.8, 7, 0.8); }
      else if (kind === 'lamp') { world.smashable(x, y, z, under, function () { g.box(x, y, z, 0.4, 6, 0.4, 0x3a3a44); n.box(x, y + 6, z, 1, 0.6, 1, 0xfff0b0); }, 0.5, 6); }
      else if (kind === 'lantern') { world.smashable(x, y, z, under, function () { g.box(x, y, z, 0.3, 4, 0.3, 0x2f2118); n.box(x, y + 4, z, 0.8, 1, 0.8, 0xffb347); }, 0.4, 4); }
      else if (kind === 'crate') { var cs = rng.range(1.4, 2.6); world.smashable(x, y, z, under, function () { g.box(x, y, z, cs, cs, cs, rng.pick([0xb07f4a, 0x8d6e4b, 0x4f5459])); }, cs, cs); }
      else if (kind === 'bollard') { world.smashable(x, y, z, under, function () { g.cyl(x, y, z, 0.5, 1.2, 0x333a44, 8, 0.4); }, 0.8, 1.2); }
      else if (kind === 'beacon') { g.box(x, y, z, 0.3, 2.4, 0.3, 0xdddddd); n.box(x, y + 2.4, z, 0.6, 0.6, 0.6, 0xff3b30); }
      else if (kind === 'mushroom') { var h = rng.range(2, 6); g.cyl(x, y, z, 0.5, h, 0xd6c2f0, 7, 0.35); n.cyl(x, y + h, z, h * 0.7, h * 0.3, rng.pick([0xc77dff, 0x7dffea, 0xff7de9]), 8, 0.2); c.addBox(x, y, z, 0.8, h, 0.8); }
    },

    buildUnder: function (d) {
      var b = d.bounds, g, y = UY;
      for (var x = b[0]; x < b[2]; x += CHUNK) for (var z = b[1]; z < b[3]; z += CHUNK) {
        var cx = x + CHUNK / 2, cz = z + CHUNK / 2;
        g = world.geo(cx, cz, 'flat', true);
        g.box(cx, y - 2, cz, CHUNK, 2, CHUNK, ((x + z) / CHUNK) % 2 ? 0x4c3388 : 0x553a95);
        g.box(cx, y + 34, cz, CHUNK, 2, CHUNK, 0x1c1030);
      }
      var c = world.collide, h = 40;
      c.add(b[0] - 4, y, b[1], b[0], y + h, b[3]); c.add(b[2], y, b[1], b[2] + 4, y + h, b[3]); c.add(b[0], y, b[1] - 4, b[2], y + h, b[1]); c.add(b[0], y, b[3], b[2], y + h, b[3] + 4);
      var taken = [];
      (d.buildings || []).forEach(function (bb) {
        world.tracked(bb.id, bb.x, bb.z, true, function () { world.addBuilding(bb, d, UY, true); world.underDoor(bb, d); });
        world.usigns.add(bb.name, Object.assign({}, bb, { h: bb.h + UY }), d);
        taken.push([bb.x - bb.w / 2 - 8, bb.z - bb.d / 2 - 8, bb.x + bb.w / 2 + 8, bb.z + bb.d / 2 + 8]);
      });
      (d.stalls || []).forEach(function (s) { var e = (s.cols || 6) * (s.spacing || 6) / 2 + 4; taken.push([s.x - e, s.z - 6, s.x + e, s.z + 22]); });
      if (d.change) { taken.push([d.change.x - 16, d.change.z - 14, d.change.x + 16, d.change.z + 6]); world.fountain(d); }
      (d.stairs || []).forEach(function (st) { world.stair(st, d, UY, true); taken.push([st.x - 8, st.z - 8, st.x + 8, st.z + 8]); });
      (d.landmarks || []).forEach(function (l) { world.landmark(l, d, true); taken.push([l.x - 70, l.z - 5, l.x + 70, l.z + 5]); });
      // festival lights strung across the cavern market
      for (var li = 0; li < 46; li++) {
        var lx = -130 + li * 6, ln = world.geo(lx, 60, 'neon', true);
        ln.box(lx, y + 15 + Math.sin(li * 0.6) * 2, 62, 0.8, 0.8, 0.8, [0xffd24a, 0xff7de9, 0x7dffea, 0xc77dff][li % 4]);
        ln = world.geo(lx, 20, 'neon', true);
        ln.box(lx, y + 15 + Math.cos(li * 0.6) * 2, 20, 0.8, 0.8, 0.8, [0xff7de9, 0xffd24a, 0xc77dff, 0x7dffea][li % 4]);
      }
      // the lake
      if (d.lake) { world.geo(d.lake.x, d.lake.z, 'neon', true).cyl(d.lake.x, y + 0.1, d.lake.z, d.lake.r, 0.05, 0x3da8c8, 24); taken.push([d.lake.x - d.lake.r, d.lake.z - d.lake.r, d.lake.x + d.lake.r, d.lake.z + d.lake.r]); }
      // cavern pillars and platforms: the city's old foundations
      var rng = new Rng('under'), n = 0, tries = 0;
      while (n < 90 && tries++ < 600) {
        var px = rng.range(-340, 340), pz = rng.range(-340, 340), s = rng.range(5, 14), clash = false;
        for (var i = 0; i < taken.length; i++) { var t = taken[i]; if (px + s > t[0] && px - s < t[2] && pz + s > t[1] && pz - s < t[3]) { clash = true; break; } }
        if (clash) continue;
        n++;
        world.geo(px, pz, 'solid', true).cyl(px, y, pz, s, 36, rng.pick(d.walls), 7, s * 0.7);
        c.addBox(px, y, pz, s * 1.4, 36, s * 1.4);
      }
      world.scatter(d, taken);
      // the deepest level: a separate floor reached by the Mole Machine
      var DY = D.DEEP_Y, g2 = world.geo(0, -180, 'flat', true);
      g2.box(0, DY - 2, -180, 90, 2, 60, 0x4a2a10);
      g2.box(0, DY + 16, -180, 90, 2, 60, 0x2a1a08);
      c.add(-50, DY, -214, 50, DY + 18, -210); c.add(-50, DY, -150, 50, DY + 18, -146); c.add(-49, DY, -214, -45, DY + 18, -146); c.add(45, DY, -214, 49, DY + 18, -146);
      for (i = 0; i < 12; i++) { var vx = -40 + i * 7.2; world.geo(vx, -205, 'neon', true).box(vx, DY, -205, 1.2, 8 + (i % 3) * 3, 1.2, 0xffd24a); }
      // the wall the Mole Machine digs through, plainly marked
      var w = world.geo(0, -120, 'solid', true);
      w.box(0, y, -128, 30, 20, 3, 0x6b4d2c);
      for (i = 0; i < 3; i++) world.geo(0, -120, 'neon', true).box(-8 + i * 8, y + 6, -126.3, 5, 5, 0.2, 0xff3b30);
      world.moleWall = { x: 0, y: y, z: -126 };
      c.addBox(0, y, -128, 30, 20, 3);
    },
    underDoor: function (b, d) {
      var f = TrillionerLayout.frontOf(b), y = UY, g = world.geo(b.x, b.z, 'solid', true), n = world.geo(b.x, b.z, 'neon', true);
      var dx = f.nx ? (f.x - f.nx * 5.5) : f.x, dz = f.nz ? (f.z - f.nz * 5.5) : f.z;
      g.box(dx + f.nx * 0.2, y, dz + f.nz * 0.2, f.nz ? 5 : 0.3, 4.4, f.nz ? 0.3 : 5, 0x1a1028);
      n.box(dx + f.nx * 0.3, y + 4.4, dz + f.nz * 0.3, f.nz ? 6 : 0.3, 0.5, f.nz ? 0.3 : 6, d.neon);
    },

    // Things that move or change every frame: one extra mesh each.
    animated: function () {
      // The clock tower's face always shows the in-game time.
      var ct = world.clockTower, cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
      world.clockCtx = cv.getContext('2d');
      world.clockTex = new THREE.CanvasTexture(cv);
      var mat = new THREE.MeshBasicMaterial({ map: world.clockTex });
      [[0, 0, 6.6, 0], [0, 0, -6.6, Math.PI], [6.6, 0, 0, Math.PI / 2], [-6.6, 0, 0, -Math.PI / 2]].forEach(function (f) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), mat);
        m.position.set(ct.x + f[0], ct.h - 8, ct.z + f[2]); m.rotation.y = f[3];
        world.surface.add(m);
      });
      // Headlines on city screens
      var sv = document.createElement('canvas'); sv.width = 512; sv.height = 256;
      world.screenCtx = sv.getContext('2d');
      world.screenTex = new THREE.CanvasTexture(sv);
      world.screens.forEach(function (l) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(l.w, l.w / 2), new THREE.MeshBasicMaterial({ map: world.screenTex, side: THREE.DoubleSide }));
        m.position.set(l.x, l.h + l.w / 4, l.z);
        world.surface.add(m);
      });
      world.headline('SPEND MORE');
      // The big rocket on its pad
      var rb = world.rocketBase, g = new THREE.Group(), rg = new TR.Geo();
      rg.cyl(0, 2, 0, 6, rb.h * 0.62, 0xffffff, 12).cyl(0, 2 + rb.h * 0.62, 0, 6, rb.h * 0.28, 0xd9352c, 12, 0.4);
      rg.box(-8, 2, 0, 4, 18, 1.4, 0xd9352c).box(8, 2, 0, 4, 18, 1.4, 0xd9352c).box(0, 2, -8, 1.4, 18, 4, 0xd9352c).box(0, 2, 8, 1.4, 18, 4, 0xd9352c);
      var rm = rg.mesh(world.solid, true, false); rm.matrixAutoUpdate = true;
      g.add(rm); g.position.set(rb.x, 0, rb.z);
      world.surface.add(g);
      world.rocket = g;
    },
    headline: function (text) {
      var c = world.screenCtx; if (!c) return;
      c.fillStyle = '#10163a'; c.fillRect(0, 0, 512, 256);
      c.fillStyle = '#ffc53d'; c.textAlign = 'center'; c.textBaseline = 'middle';
      var words = String(text).split(' '), lines = [], cur = '';
      c.font = '900 56px Arial Black, Arial';
      words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > 480) { lines.push(cur); cur = w; } else cur = t; });
      lines.push(cur);
      lines.slice(0, 3).forEach(function (l, i, a) { c.fillText(l, 256, 128 + (i - (a.length - 1) / 2) * 66); });
      world.screenTex.needsUpdate = true;
    },
    drawClock: function (hour) {
      var c = world.clockCtx, S = 128;
      c.fillStyle = '#fff6e0'; c.beginPath(); c.arc(64, 64, 62, 0, 7); c.fill();
      c.strokeStyle = '#3a2115'; c.lineWidth = 5; c.stroke();
      for (var i = 0; i < 12; i++) { var a = i / 12 * 6.283; c.fillStyle = '#3a2115'; c.fillRect(64 + Math.sin(a) * 52 - 2, 64 - Math.cos(a) * 52 - 2, 4, 4); }
      function hand(frac, len, w) { c.lineWidth = w; c.beginPath(); c.moveTo(64, 64); var a = frac * 6.283; c.lineTo(64 + Math.sin(a) * len, 64 - Math.cos(a) * len); c.stroke(); }
      hand((hour % 12) / 12, 32, 6);
      hand((hour % 1), 48, 4);
      world.clockTex.needsUpdate = true;
    },

    /** Far chunks drop their window detail and everything past the fog is culled by the camera's far plane. */
    lod: function (pos, camera) {
      var q = (TR.settings && TR.settings.windows) || 340, keys = Object.keys(world.meshes);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k.charAt(0) !== 's' || k.indexOf(':window') < 0) continue;
        var m = world.meshes[k], c = m.geometry.boundingSphere.center;
        m.visible = Math.hypot(c.x - pos.x, c.z - pos.z) < q;
      }
      camera.far = Math.max(300, world.scene.fog.far * 1.1);
      camera.updateProjectionMatrix();
    },
    /** Which space is drawn: the surface, the Under City, or a room (neither). */
    setSpace: function (space) {
      if (world.space === space) return;
      world.space = space;
      world.surface.visible = space === 'surface';
      world.under.visible = space === 'under';
    },

    /** Water at this point of the surface? */
    isWater: function (x, z) {
      if (x > 3000) return false;
      if (Math.abs(x) > 360 || Math.abs(z) > 360) return true;
      if (x >= 120 && z >= 120) return !(x < 306 && z < 282);
      return false;
    },
    districtAt: function (x, z, y) {
      if (y < -20) return 'under';
      var ids = Object.keys(D.DISTRICTS);
      for (var i = 0; i < ids.length; i++) {
        var d = D.DISTRICTS[ids[i]], b = d.bounds;
        if (d.level === 'under') continue;
        if (x >= b[0] && x < b[2] && z >= b[1] && z < b[3]) return d.id;
      }
      return null;
    },

    /** Sky, sun and window lights for an hour of the clock. */
    setTime: function (hour, weather, target, frantic) {
      if (Math.floor(hour * 60) !== world.lastMinute) { world.lastMinute = Math.floor(hour * 60); world.drawClock(hour); }
      if (world.space === 'under') {
        var uc = new THREE.Color(0x22143f);
        world.scene.background = uc; world.scene.fog.color.copy(uc);
        world.scene.fog.near = 70; world.scene.fog.far = 330;
        world.hemi.intensity = 1.05; world.hemi.color.setHex(0xd8b8ff); world.sun.intensity = 0.15;
        world.windowMat.emissiveIntensity = 1;
        world.sun.position.set(target.x + 20, target.y + 120, target.z + 20); world.sun.target.position.set(target.x, target.y, target.z);
        return;
      }
      world.hemi.color.setHex(0xffffff);
      var sunUp = Math.sin((hour - 6) / 12 * Math.PI);            // 1 at noon, -1 at midnight
      var day = Math.max(0, Math.min(1, sunUp * 3 + 0.35));
      var dusk = Math.max(0, 1 - Math.abs(sunUp) * 4) * (sunUp > -0.25 ? 1 : 0);
      var sky = new THREE.Color(0x10163a).lerp(new THREE.Color(0x7fd0ff), day).lerp(new THREE.Color(0xff9a5a), dusk * 0.6);
      var fogNear = 170, fogFar = 700;
      if (frantic) sky.lerp(new THREE.Color(0xff3b5c), 0.18 + Math.sin(performance.now() * 0.004) * 0.05);
      if (weather === 'fog') { sky.lerp(new THREE.Color(0xc4ccd4), 0.75); fogNear = 25; fogFar = 170; }
      if (weather === 'rain') { sky.lerp(new THREE.Color(0x6b7787), 0.6); fogNear = 90; fogFar = 420; }
      var q = (TR.settings && TR.settings.drawDist) || 1;
      world.scene.background = sky;
      world.scene.fog.color.copy(sky);
      world.scene.fog.near += (fogNear * q - world.scene.fog.near) * 0.04;
      world.scene.fog.far += (fogFar * q - world.scene.fog.far) * 0.04;
      world.hemi.intensity = 0.42 + day * 0.32;
      world.sun.intensity = 0.1 + day * 0.85;
      world.sun.color.setHex(dusk > 0.3 ? 0xffc48a : 0xfff4d8);
      world.windowMat.emissiveIntensity = (1 - day) * 0.95;
      var a = (hour - 6) / 12 * Math.PI;
      world.sun.position.set(target.x + Math.cos(a) * 140, 60 + Math.max(0.15, sunUp) * 150, target.z + 70);
      world.sun.target.position.set(target.x, 0, target.z);
    },

    update: function (dt, t) {
      if (world.sea) world.sea.position.y = -1.6 + Math.sin(t * 0.8) * 0.12;
      if (world.rocketFlying) {
        world.rocketFlying += dt;
        var tf = world.rocketFlying;
        world.rocket.position.y = tf * tf * 6;
        for (var i = 0; i < 6; i++) TR.fx.spawn(world.rocket.position.x + (Math.random() - 0.5) * 8, world.rocket.position.y, world.rocket.position.z + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14, -18, (Math.random() - 0.5) * 14, i % 2 ? 0xff7a1a : 0xffd24a, 1.2, 2.6, 0);
        if (tf > 14) { world.rocketFlying = 0; world.rocket.visible = false; }
      }
    }
  };

  // All big signs share one texture atlas and one mesh.
  function SignAtlas() {
    this.size = 2048; this.cw = 512; this.ch = 96;
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.clearRect(0, 0, this.size, this.size);
    this.i = 0; this.p = []; this.uv = []; this.index = [];
  }
  SignAtlas.prototype.cell = function (text, color) {
    var cols = Math.floor(this.size / this.cw), col = this.i % cols, row = Math.floor(this.i / cols), x = col * this.cw, y = row * this.ch, c = this.ctx;
    this.i++;
    c.fillStyle = '#' + new THREE.Color(color).getHexString();
    c.fillRect(x + 2, y + 2, this.cw - 4, this.ch - 4);
    c.fillStyle = '#fff';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    var fs = 62; c.font = '900 ' + fs + 'px Arial Black, Arial, sans-serif';
    while (c.measureText(text).width > this.cw - 28 && fs > 20) { fs -= 2; c.font = '900 ' + fs + 'px Arial Black, Arial, sans-serif'; }
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 5; c.strokeText(text, x + this.cw / 2, y + this.ch / 2 + 2);
    c.fillText(text, x + this.cw / 2, y + this.ch / 2 + 2);
    var s = this.size;
    return { u0: (x + 2) / s, u1: (x + this.cw - 2) / s, v0: 1 - (y + this.ch - 2) / s, v1: 1 - (y + 2) / s };
  };
  /** A sign quad facing +z (rot 0), rotated about y. Double sided via the material. */
  SignAtlas.prototype.addFlat = function (text, x, y, z, w, h, color, rot) {
    var uv = this.cell(text, color), cos = Math.cos(rot || 0), sin = Math.sin(rot || 0), n = this.p.length / 3, hw = w / 2, hh = h / 2;
    [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(function (c, i) {
      this.p.push(x + c[0] * cos, y + c[1], z - c[0] * sin);
      this.uv.push(i === 0 || i === 3 ? uv.u0 : uv.u1, i < 2 ? uv.v0 : uv.v1);
    }, this);
    this.index.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  SignAtlas.prototype.add = function (name, b, d) {
    var color = b.boarded ? 0x5b4a3a : (d.neon || 0xffc53d), f = TrillionerLayout.frontOf(b), y = b.y || 0;
    var w = Math.min(b.w * 0.9, 34), h = w * 0.19;
    if (b.h < 12) { w = Math.min(w, 20); h = w * 0.19; }
    var sy = y + Math.min(b.h - h * 0.6, 20);
    if (f.nz) this.addFlat(name, b.x, sy, b.z + f.nz * (b.d / 2 + 0.3), w, h, color, f.nz > 0 ? 0 : Math.PI);
    else { w = Math.min(b.d * 0.9, 34); h = w * 0.19; this.addFlat(name, b.x + f.nx * (b.w / 2 + 0.3), sy, b.z, w, h, color, f.nx > 0 ? Math.PI / 2 : -Math.PI / 2); }
  };
  SignAtlas.prototype.mesh = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.index);
    var tex = new THREE.CanvasTexture(this.canvas);
    tex.anisotropy = 4;
    var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }));
    m.frustumCulled = false;
    return m;
  };
  TR.SignAtlas = SignAtlas;
})();
