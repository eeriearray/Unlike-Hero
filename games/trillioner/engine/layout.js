/* Sites and pad positions, derived from the district tables. Shared so the server can check "near the pad". */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data/districts.js'));
  else root.TrillionerLayout = factory(root.TRD.districts);
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';
  var ROOM_GRID = 220, ROOM_ORIGIN = 4000;

  function frontOf(b) {
    var off = b.frontOff || 5.5;
    if (b.door === 'n') return { x: b.x, z: b.z - b.d / 2 - off, nx: 0, nz: -1, off: off };
    if (b.door === 'e') return { x: b.x + b.w / 2 + off, z: b.z, nx: 1, nz: 0, off: off };
    if (b.door === 'w') return { x: b.x - b.w / 2 - off, z: b.z, nx: -1, nz: 0, off: off };
    return { x: b.x, z: b.z + b.d / 2 + off, nx: 0, nz: 1, off: off };
  }

  /** Builds the site table for this catalog. Everything for sale sits inside a room. Returns { sites, padPos }. */
  function layout(items) {
    var sites = {}, padPos = {}, roomIndex = 0;
    Object.keys(D.DISTRICTS).forEach(function (did) {
      var d = D.DISTRICTS[did], base = d.level === 'under' ? D.UNDER_Y : 0;
      (d.buildings || []).forEach(function (b) {
        sites[b.id] = { id: b.id, name: b.name, district: did, kind: b.enter ? 'room' : 'lot', b: b, y: b.y != null ? b.y : base, front: frontOf(b), items: [] };
      });
    });
    items.forEach(function (it) {
      var s = sites[it.site];
      if (!s) throw new Error('Item ' + it.id + ' names unknown site ' + it.site);
      if (s.kind !== 'room') throw new Error('Item ' + it.id + ' is sold at ' + it.site + ', which has no door');
      // the deal for the building itself comes first, nearest the far wall
      if (it.building) s.items.unshift(it.id); else s.items.push(it.id);
    });
    Object.keys(sites).forEach(function (sid) {
      var s = sites[sid];
      if (s.kind !== 'room') return;
      var cols = 5, count = Math.max(s.items.length + 1, 4), rows = Math.ceil(count / cols);
      var w = s.b.roomW || Math.max(34, cols * 7 + 8), d = s.b.roomD || rows * 7 + 18 + (s.b.lobby || 0);
      s.room = { ox: ROOM_ORIGIN + (roomIndex % 12) * ROOM_GRID, oz: ROOM_ORIGIN + Math.floor(roomIndex / 12) * ROOM_GRID, w: w, d: d, h: s.b.lobby ? 20 : s.b.home ? 13 : Math.min(14, 9 + rows), y: s.y };
      roomIndex++;
      s.items.forEach(function (id, i) {
        var r = s.room, row = Math.floor(i / cols), col = i % cols;
        padPos[id] = { x: r.ox + (col - (cols - 1) / 2) * 7, y: 0, z: r.oz - r.d / 2 + 6 + row * 7 };
      });
    });
    return { sites: sites, padPos: padPos };
  }

  return { layout: layout, frontOf: frontOf, ROOM_ORIGIN: ROOM_ORIGIN, ROOM_GRID: ROOM_GRID };
});
