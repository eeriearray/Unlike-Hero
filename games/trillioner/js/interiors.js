/* Interior rooms live far outside the city and are built only when someone walks in. */
(function () {
  var TR = window.TR = window.TR || {};
  var ROOM_COLORS = { default: [0xfff3d6, 0xc9754b, 0xffd98a] };

  var ints = TR.interiors = {
    current: null, group: null, boxes: [],
    /** Move into a site's room. No loading screen: the room is generated in a few milliseconds. */
    enter: function (site, player) {
      ints.leaveRoom();
      var r = site.room, g = new TR.Geo(), c = window.TRD.districts.DISTRICTS[site.district].palette || ROOM_COLORS.default;
      var hw = r.w / 2, hd = r.d / 2, x = r.ox, z = r.oz, h = r.h, col = TR.world.collide;
      g.box(x, -1, z, r.w, 1, r.d, c[1]);
      // chequered floor
      for (var i = 0; i < Math.floor(r.w / 7); i++) for (var j = 0; j < Math.floor(r.d / 7); j++) if ((i + j) % 2) g.box(x - hw + 3.5 + i * 7, 0, z - hd + 3.5 + j * 7, 7, 0.02, 7, 0xffffff);
      g.box(x, h, z, r.w, 0.6, r.d, c[2]);
      g.box(x, 0, z - hd, r.w, h, 0.6, c[0]);
      g.box(x, 0, z + hd, r.w, h, 0.6, c[0]);
      g.box(x - hw, 0, z, 0.6, h, r.d, c[0]);
      g.box(x + hw, 0, z, 0.6, h, r.d, c[0]);
      g.box(x, 0, z + hd - 0.4, 5, 4.4, 0.3, 0x2b2b3f);
      for (i = -2; i <= 2; i++) g.box(x + i * r.w / 5, h - 0.2, z, 1.6, 0.2, r.d * 0.7, 0xfff8d0);
      var material = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x555044 });
      ints.group = new THREE.Group();
      ints.group.add(g.mesh(material, false, false));
      TR.world.scene.add(ints.group);
      ints.boxes = [
        col.add(x - hw - 2, 0, z - hd - 2, x + hw + 2, h + 3, z - hd, { room: 1 }), col.add(x - hw - 2, 0, z + hd, x + hw + 2, h + 3, z + hd + 2, { room: 1 }),
        col.add(x - hw - 2, 0, z - hd, x - hw, h + 3, z + hd, { room: 1 }), col.add(x + hw, 0, z - hd, x + hw + 2, h + 3, z + hd, { room: 1 })
      ];
      ints.current = site;
      ints.returnTo = { x: site.front.x, y: site.y, z: site.front.z };
      TR.world.setSpace('room');
      player.teleport(x, 0, z + hd - 7, 0);
      TR.input.yaw = 0;
      if (TR.audio) TR.audio.door();
    },
    leaveRoom: function () {
      if (ints.group) {
        TR.world.scene.remove(ints.group);
        ints.group.children.forEach(function (m) { if (m.geometry) m.geometry.dispose(); if (m.material && m.material !== TR.world.neonMat) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } });
        ints.group = null;
      }
      ints.boxes.forEach(function (b) { b.off = true; });
      ints.boxes = [];
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
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), fog: false }));
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
