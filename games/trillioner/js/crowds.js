/* Instanced pedestrians near the player. They walk the pavements, cheer at big purchases, scatter from scares, chase cash. */
(function () {
  var TR = window.TR = window.TR || {};
  var D = window.TRD.districts, dummy = new THREE.Object3D(), col = new THREE.Color();
  var SHIRTS = [0xff6b6b, 0x4dabf7, 0x51cf66, 0xffd43b, 0xcc5de8, 0xff922b, 0x20c997, 0xf06595, 0xffffff];

  function bodyGeometry() {
    var g = new TR.Geo();
    g.box(0, 1.0, 0, 1, 1.2, 0.6, 0xffffff);                 // shirt, tinted per person
    g.box(-0.26, 0, 0, 0.4, 1, 0.5, 0x8892a8).box(0.26, 0, 0, 0.4, 1, 0.5, 0x8892a8);
    g.box(0, 2.2, 0, 0.8, 0.8, 0.8, 0xffe0b8);
    return g.geometry();
  }

  var cr = TR.crowds = {
    mesh: null, people: [], max: 150, scareAt: null, scareT: 0, lureAt: null, lureT: 0, cheerT: 0,
    init: function (scene, count) {
      cr.max = count || 150;
      cr.mesh = new THREE.InstancedMesh(bodyGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), 240);
      cr.mesh.frustumCulled = false;
      cr.mesh.castShadow = false;
      cr.mesh.setColorAt(0, col.setHex(0xffffff));
      scene.add(cr.mesh);
      for (var i = 0; i < 240; i++) cr.people.push({ x: 1e6, z: 1e6, y: 0, h: 0, sp: 2, c: SHIRTS[i % SHIRTS.length], s: 0.9 + (i % 5) * 0.05, ph: i * 0.7, act: 0, off: true });
      cr.mesh.count = 0;
    },
    place: function (p, cx, cz, y, near) {
      var ang = Math.random() * 6.283, r = near ? 25 + Math.random() * 95 : 80 + Math.random() * 45, x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
      var w = TR.world;
      p.y = y;
      p.off = false;
      if (y < -20) { p.x = x; p.z = z; p.h = Math.random() * 6.283; }
      else {
        if (w.isWater(x, z)) { p.off = true; return; }
        var hit = cr.walkPoint(x, z);
        if (!hit) { p.off = true; return; }
        p.x = hit.x; p.z = hit.z; p.h = hit.h;
      }
      p.sp = 1.8 + Math.random() * 1.8;
      p.act = 0;
    },
    // Snap to the nearest pavement of a nearby road, walking along it.
    walkPoint: function (x, z) {
      var best = null, bd = 1e9;
      D.ROADS.forEach(function (R) {
        for (var i = 0; i < R.pts.length - 1; i++) {
          var a = R.pts[i], b = R.pts[i + 1], vx = b[0] - a[0], vz = b[1] - a[1], ll = vx * vx + vz * vz, t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / ll));
          var px = a[0] + vx * t, pz = a[1] + vz * t, d = (x - px) * (x - px) + (z - pz) * (z - pz);
          if (d < bd) {
            bd = d;
            var l = Math.sqrt(ll), side = ((x - px) * -vz + (z - pz) * vx) >= 0 ? 1 : -1, off = R.w / 2 + 1.6;
            best = { x: px - vz / l * off * side, z: pz + vx / l * off * side, h: Math.atan2(-vx, -vz) + (Math.random() < 0.5 ? Math.PI : 0) };
          }
        }
      });
      return bd < 3600 ? best : null;
    },
    scare: function (pos, secs) { cr.scareAt = { x: pos.x, z: pos.z }; cr.scareT = secs || 3; },
    lure: function (pos, secs) { cr.lureAt = { x: pos.x, z: pos.z }; cr.lureT = secs || 2; },
    cheer: function (secs) { cr.cheerT = secs || 2; },
    update: function (dt, pos, t, hidden) {
      if (hidden) { cr.mesh.count = 0; return; }
      cr.scareT = Math.max(0, cr.scareT - dt); cr.lureT = Math.max(0, cr.lureT - dt); cr.cheerT = Math.max(0, cr.cheerT - dt);
      var y = pos.y < -20 ? D.UNDER_Y : 0, n = cr.max, count = 0;
      for (var i = 0; i < n; i++) {
        var p = cr.people[i];
        var dx = p.x - pos.x, dz = p.z - pos.z, d2 = dx * dx + dz * dz;
        if (p.off || d2 > 16000 || Math.abs(p.y - y) > 5) {
          if (Math.random() < 0.08) cr.place(p, pos.x, pos.z, y, p.off && t < 3);
          if (p.off) continue;
        }
        var sp = p.sp, h = p.h;
        if (cr.scareT > 0 && cr.scareAt) {
          var ax = p.x - cr.scareAt.x, az = p.z - cr.scareAt.z;
          if (ax * ax + az * az < 900) { h = Math.atan2(-ax, -az); sp = 9; }
        } else if (cr.lureT > 0 && cr.lureAt) {
          var bx = cr.lureAt.x - p.x, bz = cr.lureAt.z - p.z;
          if (bx * bx + bz * bz < 1600 && bx * bx + bz * bz > 9) { h = Math.atan2(-bx, -bz); sp = 7; }
        } else if (cr.cheerT > 0 && d2 < 2500) sp = 0;
        p.x += -Math.sin(h) * sp * dt; p.z += -Math.cos(h) * sp * dt;
        if (d2 < 1.6) { var dl = Math.sqrt(d2) || 1; p.x = pos.x + dx / dl * 1.3; p.z = pos.z + dz / dl * 1.3; }
        var bob = Math.abs(Math.sin(t * 7 + p.ph)) * 0.16;
        if (cr.cheerT > 0 && d2 < 2500) bob = Math.abs(Math.sin(t * 9 + p.ph)) * 1.1;
        dummy.position.set(p.x, p.y + bob, p.z); dummy.rotation.set(0, h, 0); dummy.scale.set(p.s, p.s, p.s); dummy.updateMatrix();
        cr.mesh.setMatrixAt(count, dummy.matrix);
        cr.mesh.setColorAt(count, col.setHex(p.c));
        count++;
      }
      cr.mesh.count = count;
      cr.mesh.instanceMatrix.needsUpdate = true;
      if (cr.mesh.instanceColor) cr.mesh.instanceColor.needsUpdate = true;
    }
  };
})();
