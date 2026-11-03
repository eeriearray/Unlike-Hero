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
      if (ints.group) { TR.world.scene.remove(ints.group); ints.group.children.forEach(function (m) { m.geometry.dispose(); m.material.dispose(); }); ints.group = null; }
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
    /** The door pad inside the current room. */
    doorPos: function () { var s = ints.current; return s ? { x: s.room.ox, z: s.room.oz + s.room.d / 2 - 1.5 } : null; }
  };
})();
