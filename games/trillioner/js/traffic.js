/* Cars on the roads. Instanced, on rails, and they brake for the player rather than running physics. */
(function () {
  var TR = window.TR = window.TR || {};
  var D = window.TRD.districts, dummy = new THREE.Object3D(), col = new THREE.Color();
  var COLORS = [0xff5252, 0x448aff, 0xffd740, 0x69f0ae, 0xffffff, 0xff9100, 0xb388ff, 0x37474f];

  function carGeo() {
    var g = new TR.Geo();
    g.box(0, 0.45, 0, 2.6, 0.9, 5.2, 0xffffff);
    g.box(0, 1.35, 0.2, 2.2, 0.8, 2.6, 0xcfe6f5);
    g.box(-1.3, 0, -1.6, 0.4, 0.8, 0.9, 0x18181c).box(1.3, 0, -1.6, 0.4, 0.8, 0.9, 0x18181c).box(-1.3, 0, 1.6, 0.4, 0.8, 0.9, 0x18181c).box(1.3, 0, 1.6, 0.4, 0.8, 0.9, 0x18181c);
    return g.geometry();
  }

  var tr = TR.traffic = {
    mesh: null, cars: [], paths: [], ownColors: [],
    init: function (scene, count) {
      D.ROADS.forEach(function (R) {
        var len = 0, seg = [];
        for (var i = 0; i < R.pts.length - 1; i++) { var a = R.pts[i], b = R.pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push({ a: a, b: b, l: l, at: len }); len += l; }
        tr.paths.push({ seg: seg, len: len, off: R.w / 4 });
      });
      var total = 56;
      tr.mesh = new THREE.InstancedMesh(carGeo(), new THREE.MeshLambertMaterial({ vertexColors: true }), total);
      tr.mesh.frustumCulled = false;
      tr.mesh.setColorAt(0, col.setHex(0xffffff));
      scene.add(tr.mesh);
      for (var i = 0; i < total; i++) {
        var p = tr.paths[i % tr.paths.length];
        tr.cars.push({ path: p, s: (i * 137.5) % p.len, dir: i % 2 ? 1 : -1, v: 12 + (i % 7) * 2, c: COLORS[i % COLORS.length], x: 0, z: 0, h: 0, cur: 0 });
      }
      tr.count = count || total;
    },
    setOwned: function (list) { tr.ownColors = list; },
    update: function (dt, pos, hidden) {
      if (hidden) { tr.mesh.count = 0; return; }
      var n = Math.min(tr.count, tr.cars.length);
      for (var i = 0; i < n; i++) {
        var c = tr.cars[i], path = c.path, seg = null;
        var dx = c.x - pos.x, dz = c.z - pos.z, d2 = dx * dx + dz * dz;
        var fx = -Math.sin(c.h), fz = -Math.cos(c.h), ahead = -(dx * fx + dz * fz), want = c.v;
        if (ahead > 0 && ahead < 16 && Math.abs(dx * fz - dz * fx) < 3.5) want = 0;
        c.cur += Math.max(-30 * dt, Math.min(14 * dt, want - c.cur));
        c.s += c.cur * dt * c.dir;
        if (c.s < 0) { c.s = 0; c.dir = 1; } else if (c.s > path.len) { c.s = path.len; c.dir = -1; }
        for (var k = 0; k < path.seg.length; k++) { seg = path.seg[k]; if (c.s <= seg.at + seg.l) break; }
        var t = (c.s - seg.at) / seg.l, ux = (seg.b[0] - seg.a[0]) / seg.l, uz = (seg.b[1] - seg.a[1]) / seg.l;
        c.x = seg.a[0] + ux * seg.l * t - uz * path.off * c.dir; c.z = seg.a[1] + uz * seg.l * t + ux * path.off * c.dir;
        c.h = Math.atan2(-ux * c.dir, -uz * c.dir);
        dummy.position.set(c.x, 0, c.z); dummy.rotation.set(0, c.h, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        tr.mesh.setMatrixAt(i, dummy.matrix);
        tr.mesh.setColorAt(i, col.setHex(tr.ownColors.length && i < tr.ownColors.length * 2 ? tr.ownColors[i % tr.ownColors.length] : c.c));
      }
      tr.mesh.count = n;
      tr.mesh.instanceMatrix.needsUpdate = true;
      if (tr.mesh.instanceColor) tr.mesh.instanceColor.needsUpdate = true;
    }
  };
})();
