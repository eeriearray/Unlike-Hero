/* Cars on the roads. Instanced, on rails, and they brake for the player rather than running physics. */
(function () {
  var TR = window.TR = window.TR || {};
  var D = window.TRD.districts, dummy = new THREE.Object3D(), col = new THREE.Color();
  var COLORS = [0xff4d4d, 0x3f83ff, 0xffd02e, 0x2ecf7a, 0xf4f4f4, 0xff8a1f, 0xa56bff, 0x37474f, 0x19b5c9, 0xff6fae];

  function carGeo() {
    var g = new TR.Geo(), GLASS = 0x233a50;
    g.soft = 0.42; g.softS = 2;
    g.box(0, 0.42, 0, 2.5, 0.72, 5, 0xffffff);                       // body, tinted per car
    g.box(0, 0.42, -2.55, 2.3, 0.5, 0.12, 0xdddddd).box(0, 0.42, 2.55, 2.3, 0.5, 0.12, 0xdddddd);
    g.box(0, 1.14, 0.25, 2.2, 0.72, 2.5, GLASS);                     // cabin
    g.box(0, 1.84, 0.25, 2.26, 0.12, 2.56, 0xffffff);                // roof
    g.box(0, 1.14, -0.25 + 0.5, 0.2, 0.72, 0.2, 0xffffff);
    g.box(-0.85, 0.72, -2.54, 0.44, 0.22, 0.1, 0xfff6c0).box(0.85, 0.72, -2.54, 0.44, 0.22, 0.1, 0xfff6c0);
    g.box(-0.85, 0.72, 2.54, 0.44, 0.22, 0.1, 0xe02020).box(0.85, 0.72, 2.54, 0.44, 0.22, 0.1, 0xe02020);
    [[-1.26, -1.6], [1.26, -1.6], [-1.26, 1.6], [1.26, 1.6]].forEach(function (p) { g.wheel(p[0], 0.42, p[1], 0.42, 0.32, 0x18181c, 0xc9ccd0); });
    return g.geometry();
  }

  function hiddenDriver(c) { var k = TR.vehicles.current; return k && c.own && k.spec.build && TR.traffic.drivers[k.kind] === c.own; }   // you are driving that one
  var tr = TR.traffic = {
    mesh: null, cars: [], paths: [], ownColors: [],
    init: function (scene, count) {
      D.ROADS.forEach(function (R) {
        var len = 0, seg = [];
        for (var i = 0; i < R.pts.length - 1; i++) { var a = R.pts[i], b = R.pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push({ a: a, b: b, l: l, at: len }); len += l; }
        tr.paths.push({ seg: seg, len: len, off: R.w / 4 });
      });
      var total = 56;
      tr.mesh = new THREE.InstancedMesh(carGeo(), TR.tintedMaterial(), total);
      tr.mesh.castShadow = true;
      tr.mesh.frustumCulled = false;
      tr.mesh.setColorAt(0, col.setHex(0xffffff));
      scene.add(tr.mesh);
      for (var i = 0; i < total; i++) {
        var p = tr.paths[i % tr.paths.length];
        tr.cars.push({ path: p, s: (i * 137.5) % p.len, dir: i % 2 ? 1 : -1, v: 12 + (i % 7) * 2, c: COLORS[i % COLORS.length], x: 0, y: 0, z: 0, h: 0, cur: 0, down: 0, spin: 0, fly: null });
      }
      tr.count = count || total;
    },
    /** Vehicles you own join the traffic as themselves. Each rides one of the regular cars' routes. */
    setOwned: function (kinds) {
      tr.drivers = tr.drivers || {};
      Object.keys(tr.drivers).forEach(function (k) { if (kinds.indexOf(k) < 0) { tr.drivers[k].mesh.visible = false; tr.drivers[k].car.own = null; } });
      kinds.filter(function (k) { var sp = TR.vehicles.SPECS[k]; return sp && sp.mode === 'ground'; }).slice(0, 8).forEach(function (k, i) {
        var d = tr.drivers[k];
        if (!d) {
          var m = TR.vehicles.SPECS[k].build().mesh(new THREE.MeshLambertMaterial({ vertexColors: true }), true, false);
          m.matrixAutoUpdate = true; m.frustumCulled = false;
          tr.mesh.parent.add(m);
          d = tr.drivers[k] = { mesh: m, car: tr.cars[i * 4 + 1] };
        }
        d.car.own = d; d.mesh.visible = true;
      });
    },
    update: function (dt, pos, hidden) {
      if (hidden) { tr.mesh.count = 0; Object.keys(tr.drivers || {}).forEach(function (k) { tr.drivers[k].mesh.visible = false; }); return; }
      var n = Math.min(tr.count, tr.cars.length);
      for (var i = 0; i < n; i++) {
        var c = tr.cars[i], path = c.path, seg = null;
        if (c.down > 0) { // sent flying: it tumbles, then a replacement drives in later
          c.down -= dt;
          if (c.fly) {
            c.fly.vy -= 26 * dt; c.x += c.fly.vx * dt; c.y += c.fly.vy * dt; c.z += c.fly.vz * dt; c.spin += c.fly.r * dt;
            if (c.y < 0) { c.y = 0; c.fly.vy *= -0.4; c.fly.vx *= 0.6; c.fly.vz *= 0.6; c.fly.r *= 0.5; }
          }
          var sc = c.down > 9.5 ? 1 : 0.0001;
          dummy.position.set(c.x, c.y, c.z); dummy.rotation.set(c.spin, c.h, c.spin * 0.6); dummy.scale.set(sc, sc, sc); dummy.updateMatrix();
          if (c.own) c.own.mesh.visible = false;
          tr.mesh.setMatrixAt(i, dummy.matrix);
          tr.mesh.setColorAt(i, col.setHex(c.c));
          continue;
        }
        var drv = TR.vehicles.current;
        if (drv && drv.spec.mode === 'ground' && Math.abs(drv.speed) > 16 && Math.hypot(c.x - drv.pos.x, c.z - drv.pos.z) < drv.spec.radius + 2 && drv.pos.y < 4) {
          var dl = Math.hypot(c.x - drv.pos.x, c.z - drv.pos.z) || 1, push = Math.abs(drv.speed) * 0.7;
          c.down = 12; c.y = 0; c.spin = 0;
          c.fly = { vx: (c.x - drv.pos.x) / dl * push + drv.vel.x * 0.6, vy: 11 + push * 0.5, vz: (c.z - drv.pos.z) / dl * push + drv.vel.z * 0.6, r: 7 };
          drv.speed *= 0.82;
          TR.app.wreckCar(c);
          continue;
        }
        var dx = c.x - pos.x, dz = c.z - pos.z, d2 = dx * dx + dz * dz;
        var fx = -Math.sin(c.h), fz = -Math.cos(c.h), ahead = -(dx * fx + dz * fz), want = c.v;
        if (!TR.vehicles.current && pos.y < 2.2 && d2 < 16) { // a pedestrian cannot stand inside a car
          var along = -dx * fx - dz * fz, across = dx * fz - dz * fx;
          if (Math.abs(along) < 3.1 && Math.abs(across) < 1.9) {
            var side = across >= 0 ? 1 : -1;
            var out = 1.9 - Math.abs(across); pos.x -= fz * side * out; pos.z += fx * side * out;
          }
        }
        if (ahead > 0 && ahead < 16 && Math.abs(dx * fz - dz * fx) < 3.5) want = 0;
        c.cur += Math.max(-30 * dt, Math.min(14 * dt, want - c.cur));
        c.s += c.cur * dt * c.dir;
        if (c.s < 0) { c.s = 0; c.dir = 1; } else if (c.s > path.len) { c.s = path.len; c.dir = -1; }
        for (var k = 0; k < path.seg.length; k++) { seg = path.seg[k]; if (c.s <= seg.at + seg.l) break; }
        var t = (c.s - seg.at) / seg.l, ux = (seg.b[0] - seg.a[0]) / seg.l, uz = (seg.b[1] - seg.a[1]) / seg.l;
        c.x = seg.a[0] + ux * seg.l * t - uz * path.off * c.dir; c.z = seg.a[1] + uz * seg.l * t + ux * path.off * c.dir;
        c.h = Math.atan2(-ux * c.dir, -uz * c.dir);
        dummy.position.set(c.x, 0, c.z); dummy.rotation.set(0, c.h, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        if (c.own) { c.own.mesh.position.set(c.x, 0, c.z); c.own.mesh.rotation.y = c.h; c.own.mesh.visible = !hiddenDriver(c); dummy.scale.set(0.0001, 0.0001, 0.0001); dummy.updateMatrix(); }
        tr.mesh.setMatrixAt(i, dummy.matrix);
        tr.mesh.setColorAt(i, col.setHex(c.c));
      }
      tr.mesh.count = n;
      tr.mesh.instanceMatrix.needsUpdate = true;
      if (tr.mesh.instanceColor) tr.mesh.instanceColor.needsUpdate = true;
    }
  };
})();
