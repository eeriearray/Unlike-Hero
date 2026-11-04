/* Interior rooms live far outside the city and are built only when someone walks in. */
(function () {
  var TR = window.TR = window.TR || {};
  var ROOM_COLORS = { default: [0xfff3d6, 0xc9754b, 0xffd98a] };

  function mix(a, b, k) {
    var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k);
  }
  var ints = TR.interiors = {
    current: null, group: null, boxes: [],
    /** Move into a site's room. No loading screen: the room is generated in a few milliseconds. */
    enter: function (site, player) {
      ints.leaveRoom();
      var r = site.room, g = new TR.Geo(), c = window.TRD.districts.DISTRICTS[site.district].palette || ROOM_COLORS.default;
      var hw = r.w / 2, hd = r.d / 2, x = r.ox, z = r.oz, h = r.h, col = TR.world.collide;
      var wall = c[0], accent = c[1], ceil = c[2], T = 5, tileA = 0xf4efe4, tileB = accent;
      g.box(x, -1, z, r.w, 0.98, r.d, accent);
      for (var i = 0; i < Math.ceil(r.w / T); i++) for (var j = 0; j < Math.ceil(r.d / T); j++) {
        var tx0 = x - hw + i * T, tz0 = z - hd + j * T;
        g.tile(tx0, tz0, Math.min(tx0 + T, x + hw), Math.min(tz0 + T, z + hd), 0, (i + j) % 2 ? tileA : mix(tileA, tileB, 0.28));
      }
      // a long rug up the middle
      g.tile(x - 3.2, z - hd + 2, x + 3.2, z + hd - 2, 0.03, accent);
      g.tile(x - 2.7, z - hd + 2.5, x + 2.7, z + hd - 2.5, 0.05, mix(accent, 0xffffff, 0.2));
      g.box(x, h, z, r.w, 0.6, r.d, ceil);
      g.box(x, 0, z - hd, r.w, h, 0.6, wall).box(x, 0, z + hd, r.w, h, 0.6, wall).box(x - hw, 0, z, 0.6, h, r.d, wall).box(x + hw, 0, z, 0.6, h, r.d, wall);
      // wainscot and cornice
      var dado = mix(wall, accent, 0.6);
      [[x, z - hd + 0.4, r.w, 0.3], [x, z + hd - 0.4, r.w, 0.3], [x - hw + 0.4, z, 0.3, r.d], [x + hw - 0.4, z, 0.3, r.d]].forEach(function (w) {
        g.box(w[0], 0, w[1], w[2], 2.2, w[3], dado); g.box(w[0], 2.2, w[1], w[2], 0.16, w[3], 0xffffff); g.box(w[0], h - 0.5, w[1], w[2], 0.5, w[3], ceil);
      });
      // pillars and tall bright windows
      var pillars = Math.max(1, Math.floor(r.d / 13));
      for (i = 0; i < pillars; i++) {
        var pz = z - hd + (i + 0.5) * (r.d / pillars);
        [-1, 1].forEach(function (sd) {
          g.box(x + sd * (hw - 1.1), 0, pz, 1.3, h, 1.3, mix(wall, 0xffffff, 0.4));
          g.box(x + sd * (hw - 0.34), 3.2, pz + r.d / pillars / 2, 0.1, h - 5, 3.4, 0xcfeaff);
        });
      }
      // a plinth under each pad's goods is drawn at the sides of the room: shelves of stock
      var shelfN = Math.floor(r.w / 5), sr = new TrillionerRng.Rng('room:' + site.id);
      for (i = 0; i < shelfN; i++) {
        var sx = x - hw + (i + 0.5) * (r.w / shelfN);
        g.box(sx, 0, z - hd + 1.1, r.w / shelfN - 0.5, 3, 1.3, mix(accent, 0x000000, 0.2));
        for (var q = 0; q < 3; q++) { var gs = sr.range(0.5, 0.95); g.box(sx - 1 + q, 3, z - hd + 1.1, gs, gs, gs, sr.pick([0xff6b6b, 0x4dabf7, 0xffd43b, 0x51cf66, 0xcc5de8, 0xffffff])); }
      }
      // the Style Counter: a mirror and a stack of mystery boxes, just inside the door
      var cx = x - hw + 2.4, cz = z + hd - 8;
      g.box(cx - 0.9, 0, cz, 0.4, 4.6, 3.4, 0xd8a72e).box(cx - 0.68, 0.25, cz, 0.08, 4.1, 2.9, 0xbfe6f5);
      g.box(cx + 0.5, 0, cz + 2.7, 1.5, 1.1, 1.5, 0xffc53d).box(cx + 0.5, 1.1, cz + 2.7, 1.1, 0.8, 1.1, 0xff5ad1).box(cx + 0.5, 1.1, cz + 2.7, 1.14, 0.8, 0.22, 0xffffff);
      // exit door
      g.box(x, 0, z + hd - 0.5, 6.4, 5, 0.3, mix(accent, 0x000000, 0.25));
      g.box(x, 0, z + hd - 0.7, 5, 4.4, 0.3, 0x23263a);
      var lights = new TR.Geo();
      for (i = -2; i <= 2; i++) for (j = 0; j < Math.max(1, Math.floor(r.d / 12)); j++) lights.box(x + i * r.w / 5, h - 0.22, z - hd + (j + 0.5) * (r.d / Math.max(1, Math.floor(r.d / 12))), 2.2, 0.2, 2.2, 0xfff8dc);
      var material = new THREE.MeshLambertMaterial({ vertexColors: true });
      ints.group = new THREE.Group();
      ints.group.add(g.mesh(material, false, false));
      ints.group.add(lights.mesh(TR.world.neonMat));
      TR.world.scene.add(ints.group);
      ints.boxes = [
        col.add(x - hw - 2, 0, z - hd - 2, x + hw + 2, h + 3, z - hd, { room: 1 }), col.add(x - hw - 2, 0, z + hd, x + hw + 2, h + 3, z + hd + 2, { room: 1 }),
        col.add(x - hw - 2, 0, z - hd, x - hw, h + 3, z + hd, { room: 1 }), col.add(x + hw, 0, z - hd, x + hw + 2, h + 3, z + hd, { room: 1 })
      ];
      ints.boxes.push(col.addBox(cx - 0.8, 0, cz, 0.7, 4.6, 3.4, { room: 1 }), col.addBox(cx + 0.5, 0, cz + 2.7, 1.5, 1.9, 1.5, { room: 1 }));
      ints.counter = { x: cx + 0.9, y: 0, z: cz + 0.6 };
      ints.group.add(ints.counterSign(cx - 0.6, 5.45, cz));
      ints.globe = null;
      if (site.b && site.b.lobby) ints.buildGlobe(site);
      ints.current = site;
      if (site.b && site.b.home) TR.home.enter(site);
      ints.returnTo = { x: site.front.x, y: site.y, z: site.front.z };
      TR.world.setSpace('room');
      player.teleport(x, 0, z + hd - 7.5, 0);
      TR.input.yaw = 0;
      if (TR.audio) TR.audio.door();
    },
    counterSign: function (x, y, z) {
      var c = document.createElement('canvas'); c.width = 512; c.height = 128;
      var g = c.getContext('2d');
      g.fillStyle = '#17132b'; g.fillRect(0, 0, 512, 128);
      g.strokeStyle = '#ffc53d'; g.lineWidth = 8; g.strokeRect(6, 6, 500, 116);
      g.fillStyle = '#ffd23f'; g.font = '800 62px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STYLE', 256, 66);
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
      var m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: t }));
      m.position.set(x, y, z); m.rotation.y = Math.PI / 2;
      return m;
    },
    /** The Global Trade Tower lobby: a giant globe you can walk right over. Height comes from floorHere. */
    buildGlobe: function (site) {
      var r = site.room, R = 13, cx = r.ox, cz = r.oz + r.d / 2 - 20;
      var c = document.createElement('canvas'); c.width = 1024; c.height = 512;
      var g = c.getContext('2d'), rng = new TrillionerRng.Rng('globe');
      g.fillStyle = '#2a8fd8'; g.fillRect(0, 0, 1024, 512);
      for (var i = 0; i < 16; i++) {
        var x = rng.range(0, 1024), y = rng.range(40, 470), n = 5 + rng.int(8);
        g.fillStyle = rng.pick(['#5dbb63', '#6ec85a', '#c9b26a', '#4fae56']);
        for (var k = 0; k < n; k++) { g.beginPath(); g.arc(x + rng.range(-70, 70), y + rng.range(-46, 46), rng.range(18, 62), 0, 7); g.fill(); }
      }
      g.fillStyle = '#f4f8ff'; g.fillRect(0, 0, 1024, 26); g.fillRect(0, 486, 1024, 26);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
      for (i = 1; i < 12; i++) { g.beginPath(); g.moveTo(i * 85, 0); g.lineTo(i * 85, 512); g.stroke(); }
      for (i = 1; i < 6; i++) { g.beginPath(); g.moveTo(0, i * 85); g.lineTo(1024, i * 85); g.stroke(); }
      var tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
      var m = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 28), new THREE.MeshLambertMaterial({ map: tex }));
      m.position.set(cx, 0, cz); m.rotation.y = 0.8;
      ints.group.add(m);
      var ring = new TR.Geo(); ring.cyl(cx, 0, cz, R + 1.6, 0.3, 0xd8b45a, 40);
      ints.group.add(ring.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
      ints.globe = { x: cx, z: cz, r: R };
    },
    /** The floor at a point in this room: flat, except on the globe. */
    floorHere: function (p) {
      var w = ints.globe; if (!w) return 0;
      var dx = p.x - w.x, dz = p.z - w.z, d2 = dx * dx + dz * dz;
      return d2 < w.r * w.r ? Math.sqrt(w.r * w.r - d2) : 0;
    },
    leaveRoom: function () {
      if (TR.home.site) TR.home.leave();
      if (ints.group) {
        TR.world.scene.remove(ints.group);
        ints.group.children.forEach(function (m) { if (m.geometry) m.geometry.dispose(); if (m.material && m.material !== TR.world.neonMat) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } });
        ints.group = null;
      }
      ints.boxes.forEach(function (b) { b.off = true; });
      ints.boxes = [];
      ints.globe = null;
      ints.counter = null;
      ints.current = null;
    },
    exit: function (player) {
      var back = ints.returnTo;
      ints.leaveRoom();
      TR.world.setSpace(back && back.y < -20 ? 'under' : 'surface');
      if (back) player.teleport(back.x, back.y, back.z, 0);
      if (TR.audio) TR.audio.door();
    },
    /** The penthouse: every earned trophy on its own pedestal. Reached from the Trillion Tower elevator. */
    enterTrophyRoom: function (player) {
      var got = TR.save.get('trophies', {}), live = TR.app.session.view.me.trophies || {}, ids = {}, list = window.TRD.trophies.TROPHIES;
      Object.keys(got).forEach(function (k) { ids[k] = 1; }); Object.keys(live).forEach(function (k) { ids[k] = 1; });
      var earned = list.filter(function (t) { return ids[t.id]; }), cols = 6, rows = Math.max(2, Math.ceil(earned.length / cols)), S = 9, w = cols * S + 10, d = rows * S + 18, ox = 3400, oz = 3400;
      ints.leaveRoom();
      var fake = { id: 'trophy_room', name: 'Trophy Room', district: 'downtown', room: { ox: ox, oz: oz, w: w, d: d, h: 14, y: 0 }, front: { x: 60, z: -38.5 }, y: 0 };
      ints.enter(fake, player);
      var g = new TR.Geo(), n = new TR.Geo();
      earned.forEach(function (t, i) {
        var col = i % cols, row = Math.floor(i / cols), x = ox + (col - (cols - 1) / 2) * S, z = oz - d / 2 + 7 + row * S;
        g.box(x, 0, z, 3, 1.4, 3, 0xf5efe0);
        n.box(x, 1.4, z, 1.4, 0.3, 1.4, 0xffc53d).box(x, 1.7, z, 0.5, 0.9, 0.5, 0xffc53d).box(x, 2.6, z, 1.6, 1, 1.6, 0xffd96a);
        TR.world.collide; ints.boxes.push(TR.world.collide.addBox(x, 0, z, 3, 1.4, 3, { room: 1 }));
        var c = document.createElement('canvas'); c.width = 320; c.height = 64;
        var cx = c.getContext('2d'); cx.fillStyle = 'rgba(20,20,40,.85)'; cx.fillRect(0, 0, 320, 64); cx.fillStyle = '#ffc53d'; cx.textAlign = 'center';
        var fs = 26; cx.font = '800 ' + fs + 'px Arial'; while (cx.measureText(t.name).width > 306 && fs > 12) { fs--; cx.font = '800 ' + fs + 'px Arial'; }
        cx.fillText(t.name, 160, 42);
        var trTex = new THREE.CanvasTexture(c); trTex.encoding = THREE.sRGBEncoding;
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: trTex, fog: false }));
        sp.scale.set(6, 1.2, 1); sp.position.set(x, 5, z);
        ints.group.add(sp);
      });
      if (g.count) ints.group.add(g.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x444444 })));
      if (n.count) ints.group.add(n.mesh(TR.world.neonMat));
      ints.current.isTrophy = true;
      TR.hud.toast(earned.length ? 'Your Trophy Room' : 'Your Trophy Room. It is empty. For now.', 'gold');
    },
    /** The door pad inside the current room. */
    doorPos: function () { var s = ints.current; return s ? { x: s.room.ox, z: s.room.oz + s.room.d / 2 - 1.5 } : null; }
  };
})();
