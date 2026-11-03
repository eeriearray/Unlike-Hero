/* Sites and pad positions, derived from the district tables. Shared so the server can check "near the pad". */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data/districts.js'));
  else root.TrillionerLayout = factory(root.TRD.districts);
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';
  var ROOM_GRID = 220, ROOM_ORIGIN = 4000;

  function frontOf(b) {
    var off = 5.5;
    if (b.door === 'n') return { x: b.x, z: b.z - b.d / 2 - off, nx: 0, nz: -1 };
    if (b.door === 'e') return { x: b.x + b.w / 2 + off, z: b.z, nx: 1, nz: 0 };
    if (b.door === 'w') return { x: b.x - b.w / 2 - off, z: b.z, nx: -1, nz: 0 };
    return { x: b.x, z: b.z + b.d / 2 + off, nx: 0, nz: 1 };
  }

  /** Builds the site table for this catalog. items: flat list; returns { sites, padPos, rooms }. */
  function layout(items) {
    var sites = {}, padPos = {}, roomIndex = 0;
    function site(id, data) { sites[id] = Object.assign({ id: id, items: [], outside: [] }, data); }
    Object.keys(D.DISTRICTS).forEach(function (did) {
      var d = D.DISTRICTS[did], base = d.level === 'under' ? D.UNDER_Y : 0;
      (d.buildings || []).forEach(function (b) { site(b.id, { name: b.name, district: did, kind: b.enter ? 'room' : 'lot', b: b, y: b.y != null ? b.y : base, front: frontOf(b) }); });
      (d.stalls || []).forEach(function (s) { site(s.id, { name: s.name, district: did, kind: 'stall', s: s, y: s.y != null ? s.y : base }); });
      if (d.change) site(did + '_change', { name: d.name + ' Fountain', district: did, kind: 'change', s: { x: d.change.x, z: d.change.z, cols: 8, dir: 'x', spacing: 2.6 }, y: base });
    });
    items.forEach(function (it) {
      var s = sites[it.site];
      if (!s) throw new Error('Item ' + it.id + ' names unknown site ' + it.site);
      (it.outside ? s.outside : s.items).push(it.id);
    });
    Object.keys(sites).forEach(function (sid) {
      var s = sites[sid];
      s.outside.forEach(function (id, i) { // the deal for the whole building sits out front
        var f = s.front, off = 10 + i * 7.5;
        padPos[id] = { x: f.x + (f.nz ? off : 0), y: s.y, z: f.z + (f.nx ? off : 0) };
      });
      if (s.kind === 'room') {
        var cols = 5, count = Math.max(s.items.length + 1, 4), rows = Math.ceil(count / cols);
        var w = Math.max(34, cols * 7 + 8), d = rows * 7 + 18;
        s.room = { ox: ROOM_ORIGIN + (roomIndex % 12) * ROOM_GRID, oz: ROOM_ORIGIN + Math.floor(roomIndex / 12) * ROOM_GRID, w: w, d: d, h: Math.min(14, 9 + rows), y: s.y };
        roomIndex++;
        s.items.forEach(function (id, i) {
          var r = s.room, row = Math.floor(i / cols), col = i % cols;
          padPos[id] = { x: r.ox + (col - (cols - 1) / 2) * 7, y: 0, z: r.oz - r.d / 2 + 6 + row * 7 };
        });
      } else if (s.kind === 'stall' || s.kind === 'change') {
        var st = s.s, sp = st.spacing || 6, c = st.cols || 6, list = s.items;
        list.forEach(function (id, i) {
          var row = Math.floor(i / c), col = i % c, along = (col - (c - 1) / 2) * sp, across = row * sp;
          padPos[id] = st.dir === 'z' ? { x: st.x + across, y: s.y, z: st.z + along } : { x: st.x + along, y: s.y, z: st.z + across };
        });
      } else {
        s.items.forEach(function (id, i) { // goods sold on an open lot line up beside it
          var f = s.front;
          padPos[id] = { x: f.x + (f.nz ? (i + 1) * 6 : f.nx * 6), y: s.y, z: f.z + (f.nx ? (i + 1) * 6 : f.nz * 6) };
        });
      }
    });
    items.forEach(function (it) { if (it.pos) padPos[it.id] = it.pos; });
    return { sites: sites, padPos: padPos };
  }

  return { layout: layout, frontOf: frontOf, ROOM_ORIGIN: ROOM_ORIGIN, ROOM_GRID: ROOM_GRID };
});
