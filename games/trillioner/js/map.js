/* The minimap (only what has been seen) and the full map (M). Never lists what is undiscovered. */
(function () {
  var TR = window.TR = window.TR || {};
  var D = window.TRD.districts, S = 360, GRID = 48, EXTENT = 460;

  var map = TR.map = {
    canvas: null, ctx: null, base: null, fog: null, seen: new Uint8Array(GRID * GRID), full: null, pins: [],
    init: function (box) {
      map.canvas = document.createElement('canvas'); map.canvas.width = map.canvas.height = 512;
      box.appendChild(map.canvas);
      map.box = box;
      map.you = document.createElement('i'); map.you.className = 'map-you'; box.appendChild(map.you);
      map.ctx = map.canvas.getContext('2d');
      map.base = map.draw(false); map.ubase = map.draw(true);
    },
    reset: function () { map.seen.fill(1); map.pins = []; },   // like any city map: the streets are all on it
    /** Reveal cells around the player. */
    reveal: function (x, z) {
      var cx = Math.floor((x + EXTENT) / (EXTENT * 2) * GRID), cz = Math.floor((z + EXTENT) / (EXTENT * 2) * GRID), r = 6;
      for (var i = -r; i <= r; i++) for (var j = -r; j <= r; j++) if (i * i + j * j <= r * r) {
        var a = cx + i, b = cz + j;
        if (a >= 0 && b >= 0 && a < GRID && b < GRID) map.seen[a + b * GRID] = 1;
      }
    },
    w2c: function (v, size) { return (v + EXTENT) / (EXTENT * 2) * size; },
    draw: function (under) {
      var c = document.createElement('canvas'); c.width = c.height = 512;
      var g = c.getContext('2d');
      g.fillStyle = under ? '#120a22' : '#1c2a33'; g.fillRect(0, 0, 512, 512);
      Object.keys(D.DISTRICTS).forEach(function (k) {
        var d = D.DISTRICTS[k], b = d.land || d.bounds;
        if ((d.level === 'under') !== under) return;
        g.fillStyle = under ? '#2a1d42' : d.id === 'suburbs' ? '#46583c' : '#55585a';
        g.fillRect(map.w2c(b[0], 512), map.w2c(b[1], 512), (b[2] - b[0]) / (EXTENT * 2) * 512, (b[3] - b[1]) / (EXTENT * 2) * 512);
        (d.buildings || []).forEach(function (bd) {
          if (bd.project) return;
          g.fillStyle = under ? '#3a2a5a' : '#3c3f42';
          g.fillRect(map.w2c(bd.x - bd.w / 2, 512), map.w2c(bd.z - bd.d / 2, 512), bd.w / (EXTENT * 2) * 512, bd.d / (EXTENT * 2) * 512);
        });
      });
      if (!under) {
        g.strokeStyle = '#c9ccce'; g.lineCap = 'round';
        D.ROADS.forEach(function (R) {
          g.lineWidth = Math.max(2, R.w / (EXTENT * 2) * 512 * 0.8);
          g.beginPath();
          R.pts.forEach(function (p, i) { var x = map.w2c(p[0], 512), y = map.w2c(p[1], 512); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
          g.stroke();
        });
      }
      return c;
    },
    /** Draws map into ctx at size; hides unseen cells. Rivals, pins and extras come from opts. */
    paint: function (g, size, under, opts) {
      opts = opts || {};
      g.drawImage(under ? map.ubase : map.base, 0, 0, size, size);
      var cell = size / GRID;
      g.fillStyle = under ? '#080512' : '#16263a';
      for (var a = 0; a < GRID; a++) for (var b = 0; b < GRID; b++) if (!map.seen[a + b * GRID]) g.fillRect(a * cell - 0.5, b * cell - 0.5, cell + 1, cell + 1);
      (opts.dots || []).forEach(function (d) {
        g.fillStyle = d.c;
        g.beginPath(); g.arc(map.w2c(d.x, size), map.w2c(d.z, size), d.r || size / 90, 0, 7); g.fill();
        if (d.label && size !== 512) { g.fillStyle = '#fff'; g.font = '12px Arial'; g.fillText(d.label, map.w2c(d.x, size) + 7, map.w2c(d.z, size) + 4); }
      });
      if (map.route && map.route.length > 1) {
        g.strokeStyle = '#ff2fa8'; g.lineWidth = size > 300 ? 4 : 3; g.lineJoin = 'round';
        g.beginPath();
        map.route.forEach(function (q, i) { var a = map.w2c(q.x, size), b = map.w2c(q.z, size); if (i) g.lineTo(a, b); else g.moveTo(a, b); });
        g.stroke();
        var e = map.route[map.route.length - 1];
        g.fillStyle = '#ff2fa8'; g.beginPath(); g.arc(map.w2c(e.x, size), map.w2c(e.z, size), size / 45, 0, 7); g.fill();
      }
      map.pins.forEach(function (p) {
        g.fillStyle = '#ff4d6d';
        g.beginPath(); g.arc(map.w2c(p.x, size), map.w2c(p.z, size), size / 70, 0, 7); g.fill();
      });
    },
    update: function (pos, heading, under, opts) { map.paint(map.ctx, 512, under, opts); },
    /** Every frame: the map turns with the camera and slides under you. */
    follow: function (pos, heading, yaw) {
      var bw = map.box.clientWidth, bh = map.box.clientHeight;
      if (!bw) return;   // hidden behind the bag
      var sc = 2.1 * bw / 512 * 1.6, x = map.w2c(pos.x, 512), y = map.w2c(pos.z, 512);
      map.canvas.style.transform = 'translate(' + (bw / 2) + 'px,' + (bh / 2) + 'px) rotate(' + yaw + 'rad) scale(' + sc + ') translate(' + (-x) + 'px,' + (-y) + 'px)';
      map.you.style.transform = 'translate(-50%,-50%) rotate(' + (yaw - heading) + 'rad)';
    }
  };
})();
