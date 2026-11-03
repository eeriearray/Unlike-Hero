/* Vehicle models, built from real shapes: hulls lofted along their length, and lathes for anything round.
 * Forward is -z, the ground is y = 0. Flat-shaded on purpose: crisp panels read as a car; rounded boxes read as a pillow. */
(function () {
  var TR = window.TR = window.TR || {};
  var Geo = TR.Geo, C = new THREE.Color();
  var GLASS = 0x10161d, TYRE = 0x141518, TRIM = 0x1b1c20, CHROME = 0xb8bcc2, HEAD = 0xfff4c8, TAIL = 0xb0171b;

  function face(g, a, b, c, d, cx, cy, cz, color, shade) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
    if (l < 1e-6) { ux = c[0] - a[0]; uy = c[1] - a[1]; uz = c[2] - a[2]; nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx; l = Math.hypot(nx, ny, nz); if (l < 1e-6) return; }
    nx /= l; ny /= l; nz /= l;
    var mx = (a[0] + b[0] + c[0] + d[0]) / 4 - cx, my = (a[1] + b[1] + c[1] + d[1]) / 4 - cy, mz = (a[2] + b[2] + c[2] + d[2]) / 4 - cz;
    if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; var t = b; b = d; d = t; }
    C.setHex(color);
    var s = shade || 1;
    [a, b, c, a, c, d].forEach(function (q) { g.p.push(q[0], q[1], q[2]); g.n.push(nx, ny, nz); g.c.push(C.r * s, C.g * s, C.b * s); });
    g.count += 6;
  }

  /** A body lofted through stations along z. Each: [z, bottom, top, half width low, half width high]. */
  Geo.prototype.hull = function (st, color, dy, dx) {
    dy = dy || 0; dx = dx || 0;
    var cz = 0, cy = 0;
    st.forEach(function (s) { cz += s[0]; cy += (s[1] + s[2]) / 2 + dy; });
    cz /= st.length; cy /= st.length;
    function corners(s) { return { ll: [dx - s[3], s[1] + dy, s[0]], lr: [dx + s[3], s[1] + dy, s[0]], tl: [dx - s[4], s[2] + dy, s[0]], tr: [dx + s[4], s[2] + dy, s[0]] }; }
    for (var i = 0; i < st.length - 1; i++) {
      var a = corners(st[i]), b = corners(st[i + 1]);
      face(this, a.tl, a.tr, b.tr, b.tl, dx, cy, cz, color, 1.05);
      face(this, a.ll, a.tl, b.tl, b.ll, dx, cy, cz, color, 0.9);
      face(this, a.tr, a.lr, b.lr, b.tr, dx, cy, cz, color, 0.9);
      face(this, a.lr, a.ll, b.ll, b.lr, dx, cy, cz, color, 0.5);
    }
    var f = corners(st[0]), e = corners(st[st.length - 1]);
    face(this, f.ll, f.lr, f.tr, f.tl, dx, cy, cz, color, 0.95);
    face(this, e.lr, e.ll, e.tl, e.tr, dx, cy, cz, color, 0.8);
    return this;
  };
  /** Something round: a profile of [radius, height] spun around y, or around z with axis 'z'. colorAt(segment, ring) paints panels. */
  Geo.prototype.lathe = function (pts, x, y, z, colorAt, n, axis) {
    n = n || 16;
    var self = this, col = typeof colorAt === 'function' ? colorAt : function () { return colorAt; };
    function at(r, h, a) {
      var ca = Math.cos(a), sa = Math.sin(a);
      return axis === 'z' ? [x + ca * r, y + sa * r, z + h] : [x + ca * r, y + h, z + sa * r];
    }
    function norm(i, a) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)], dr = p1[0] - p0[0], dh = p1[1] - p0[1], l = Math.hypot(dr, dh) || 1, nr = dh / l, nh = -dr / l, ca = Math.cos(a), sa = Math.sin(a);
      return axis === 'z' ? [ca * nr, sa * nr, nh] : [ca * nr, nh, sa * nr];
    }
    for (var i = 0; i < pts.length - 1; i++) for (var j = 0; j < n; j++) {
      var a0 = j / n * 6.2832, a1 = (j + 1) / n * 6.2832, A = at(pts[i][0], pts[i][1], a0), B = at(pts[i][0], pts[i][1], a1), D = at(pts[i + 1][0], pts[i + 1][1], a0), E = at(pts[i + 1][0], pts[i + 1][1], a1);
      var nA = norm(i, a0), nB = norm(i, a1), nD = norm(i + 1, a0), nE = norm(i + 1, a1);
      C.setHex(col(j, i));
      var order = axis === 'z' ? [[A, nA], [B, nB], [E, nE], [A, nA], [E, nE], [D, nD]] : [[A, nA], [E, nE], [B, nB], [A, nA], [D, nD], [E, nE]];
      order.forEach(function (q) { self.p.push(q[0][0], q[0][1], q[0][2]); self.n.push(q[1][0], q[1][1], q[1][2]); self.c.push(C.r, C.g, C.b); });
      self.count += 6;
    }
    return this;
  };

  /** Tyre, rim, hub. */
  function wheel(g, x, y, z, r, w) {
    g.wheel(x, y, z, r, w, TYRE);
    var o = x >= 0 ? 1 : -1;
    g.wheel(x + o * 0.02, y, z, r * 0.58, w, CHROME);
    g.wheel(x + o * 0.04, y, z, r * 0.2, w, TRIM);
  }
  function arch(g, x, y, z, r, o) { g.wheel(x + o * 0.002, y, z, r, 0.04, 0x08090a); }

  var M = TR.models = {
    /** Two long thin blades crossed at the hub. */
    rotorGeo: function () {
      var g = new TR.Geo();
      g.box(0, -0.04, 0, 12, 0.08, 0.42, 0xffffff); g.box(0, -0.04, 0, 0.42, 0.08, 12, 0xffffff); g.cyl(0, -0.2, 0, 0.3, 0.3, 0xffffff, 10);
      return g.geometry();
    },
    /** A saloon. The everyday car, in whatever colour. Also the one in traffic, so it stays cheap. */
    sedan: function (g, body, dy) {
      dy = dy || 0;
      g.hull([[-2.72, 0.42, 0.68, 1.02, 1.0], [-2.58, 0.34, 0.86, 1.2, 1.18], [-0.95, 0.32, 1.06, 1.26, 1.2], [1.55, 0.32, 1.1, 1.26, 1.2], [2.55, 0.36, 1.02, 1.2, 1.14], [2.72, 0.46, 0.82, 1.04, 1.02]], body, dy);
      g.hull([[-1.2, 1.05, 1.07, 1.16, 1.14], [-0.12, 1.04, 1.68, 1.16, 0.96], [1.0, 1.08, 1.68, 1.16, 0.96], [1.9, 1.09, 1.11, 1.14, 1.12]], GLASS, dy);
      g.hull([[-0.18, 1.67, 1.71, 0.98, 0.94], [1.04, 1.67, 1.71, 0.98, 0.94]], body, dy);
      [0.44].forEach(function (z) { g.box(-1.13, 1.08 + dy, z, 0.07, 0.6, 0.12, body); g.box(1.13, 1.08 + dy, z, 0.07, 0.6, 0.12, body); });
      g.box(0, 0.56 + dy, -2.74, 1.1, 0.16, 0.03, TRIM);
      g.box(-0.78, 0.7 + dy, -2.67, 0.36, 0.13, 0.05, HEAD).box(0.78, 0.7 + dy, -2.67, 0.36, 0.13, 0.05, HEAD);
      g.box(-0.76, 0.76 + dy, 2.71, 0.4, 0.13, 0.04, TAIL).box(0.76, 0.76 + dy, 2.71, 0.4, 0.13, 0.04, TAIL);
      g.box(0, 0.42 + dy, 2.74, 1.9, 0.12, 0.04, TRIM);
      g.box(-1.29, 1.02 + dy, -0.82, 0.14, 0.08, 0.18, TRIM).box(1.29, 1.02 + dy, -0.82, 0.14, 0.08, 0.18, TRIM);
      [[-1.26, -1.62], [1.26, -1.62], [-1.26, 1.62], [1.26, 1.62]].forEach(function (p) { arch(g, p[0], 0.46 + dy, p[1], 0.56, p[0] > 0 ? 1 : -1); wheel(g, p[0], 0.42 + dy, p[1], 0.42, 0.3); });
      return g;
    },
    sports_car: function (g) {
      var red = 0xc81e24;
      g.hull([[-3.05, 0.26, 0.5, 1.1, 1.06], [-2.8, 0.22, 0.66, 1.36, 1.3], [-0.9, 0.22, 0.92, 1.5, 1.38], [0.9, 0.22, 0.98, 1.56, 1.42], [2.5, 0.26, 0.92, 1.46, 1.34], [2.95, 0.34, 0.78, 1.28, 1.2]], red);
      g.hull([[-1.15, 0.9, 0.92, 1.18, 1.16], [-0.1, 0.9, 1.34, 1.14, 0.9], [0.75, 0.94, 1.34, 1.14, 0.86], [1.9, 0.92, 0.95, 1.12, 1.08]], GLASS);
      g.hull([[-0.12, 1.33, 1.37, 0.9, 0.86], [0.77, 1.33, 1.37, 0.88, 0.84]], red);
      g.hull([[-2.8, 0.66, 0.68, 0.24, 0.24], [-0.95, 0.92, 0.94, 0.24, 0.24]], 0xf2efe6); g.hull([[-0.12, 1.37, 1.385, 0.24, 0.24], [0.77, 1.37, 1.385, 0.24, 0.24]], 0xf2efe6); g.hull([[1.9, 0.96, 0.98, 0.24, 0.24], [2.92, 0.8, 0.82, 0.24, 0.24]], 0xf2efe6);
      g.box(-1.08, 0.92, 2.65, 0.12, 0.42, 0.22, TRIM).box(1.08, 0.92, 2.65, 0.12, 0.42, 0.22, TRIM).box(0, 1.32, 2.68, 2.86, 0.07, 0.56, TRIM);
      g.box(-0.92, 0.56, -2.86, 0.46, 0.09, 0.05, HEAD).box(0.92, 0.56, -2.86, 0.46, 0.09, 0.05, HEAD);
      g.box(0, 0.34, -3.03, 1.5, 0.12, 0.05, TRIM);
      g.box(-0.82, 0.68, 2.93, 0.62, 0.09, 0.04, TAIL).box(0.82, 0.68, 2.93, 0.62, 0.09, 0.04, TAIL);
      g.box(-0.5, 0.24, 2.96, 0.24, 0.14, 0.14, CHROME).box(0.5, 0.24, 2.96, 0.24, 0.14, 0.14, CHROME);
      [[-1.42, -1.82], [1.42, -1.82], [-1.5, 1.82], [1.5, 1.82]].forEach(function (p) { arch(g, p[0], 0.46, p[1], 0.56, p[0] > 0 ? 1 : -1); wheel(g, p[0], 0.44, p[1], 0.44, 0.44); });
      return g;
    },
    /** A truck cab and chassis, shared by the big ones. */
    cab: function (g, paint, dy) {
      g.hull([[-3.5, 0.75, 1.3, 1.25, 1.25], [-3.3, 0.7, 1.75, 1.42, 1.38], [-2.3, 0.7, 1.85, 1.46, 1.4], [-1.25, 0.7, 2.0, 1.46, 1.4]], paint, dy);
      g.hull([[-2.3, 1.85, 1.87, 1.36, 1.34], [-1.85, 1.85, 2.72, 1.36, 1.22], [-0.8, 1.85, 2.78, 1.36, 1.26], [-0.8, 1.85, 2.78, 1.36, 1.26]], GLASS, dy);
      g.hull([[-1.9, 2.72, 2.84, 1.24, 1.2], [-0.76, 2.74, 2.86, 1.3, 1.26]], paint, dy);
      g.box(0, 0.7 + dy, -0.5, 2.92, 2.18, 0.5, paint);
      g.box(-0.95, 1.2 + dy, -3.52, 0.42, 0.22, 0.05, HEAD).box(0.95, 1.2 + dy, -3.52, 0.42, 0.22, 0.05, HEAD).box(0, 1.2 + dy, -3.52, 1.1, 0.3, 0.04, TRIM);
      g.box(0, 0.62 + dy, -3.52, 2.6, 0.2, 0.2, CHROME);
      g.box(-1.56, 2.0 + dy, -2, 0.08, 0.5, 0.26, TRIM).box(1.56, 2.0 + dy, -2, 0.08, 0.5, 0.26, TRIM);
    },
    monster_truck: function (g) {
      var paint = 0x2f7a3a, lift = 1.55;
      g.box(0, 1.1, 0, 2.4, 0.7, 6.8, TRIM);
      M.cab(g, paint, lift);
      g.hull([[-0.25, 0.65, 1.7, 1.46, 1.46], [3.4, 0.65, 1.7, 1.46, 1.46]], paint, lift);
      g.box(0, 2.25, 1.6, 2.4, 0.85, 3.4, 0x0e0f11);
      [-1, 1].forEach(function (o) { g.box(o * 0.6, 4.42, -1.3, 0.34, 0.2, 0.14, 0xfff0a0); });
      [[-2.15, -2.2], [2.15, -2.2], [-2.15, 2.3], [2.15, 2.3]].forEach(function (p) {
        wheel(g, p[0], 1.45, p[1], 1.45, 1.15);
        for (var i = 0; i < 10; i++) { var a = i / 10 * 6.283; g.box(p[0], 1.45 + Math.cos(a) * 1.42 - 0.09, p[1] + Math.sin(a) * 1.42, 1.2, 0.18, 0.3, TYRE, 0); }
        g.box(p[0] * 0.5, 1.33, p[1], Math.abs(p[0]) + 0.3, 0.24, 0.24, 0x555a60);
      });
      return g;
    },
    ladder_truck: function (g) {
      var red = 0xb01e22;
      g.box(0, 0.65, 0, 2.2, 0.32, 8, TRIM);
      M.cab(g, red);
      g.hull([[-0.25, 0.75, 2.5, 1.45, 1.45], [4.2, 0.75, 2.5, 1.45, 1.45]], red);
      g.box(0, 1.28, 1.9, 2.96, 0.14, 4.6, 0xe6e1d0);
      for (var i = 0; i < 4; i++) { g.box(-1.47, 1.5, 0.45 + i * 1, 0.03, 0.85, 0.8, 0xa8aeb4); g.box(1.47, 1.5, 0.45 + i * 1, 0.03, 0.85, 0.8, 0xa8aeb4); }
      g.box(-0.42, 2.56, 0.9, 0.1, 0.12, 7.2, CHROME).box(0.42, 2.56, 0.9, 0.1, 0.12, 7.2, CHROME);
      for (i = 0; i < 12; i++) g.box(0, 2.58, -2.5 + i * 0.6, 0.84, 0.05, 0.06, CHROME);
      g.box(0, 2.5, 3.8, 1.1, 0.24, 0.4, 0x3a3d42);
      g.box(-0.7, 2.86, -1.3, 0.5, 0.14, 0.24, 0xff2020).box(0.7, 2.86, -1.3, 0.5, 0.14, 0.24, 0x2050ff);
      [[-1.26, -2.3], [1.26, -2.3], [-1.26, 2.1], [1.26, 2.1], [-1.26, 3.4], [1.26, 3.4]].forEach(function (p) { wheel(g, p[0], 0.56, p[1], 0.56, 0.4); });
      return g;
    },
    wrecking_truck: function (g) {
      var y = 0xd9a412;
      g.box(0, 0.65, 0, 2.2, 0.32, 7.6, TRIM);
      M.cab(g, y);
      g.box(0, 0.96, 2, 2.9, 0.16, 4, 0x45484d);
      g.box(0, 1.1, 1.4, 0.9, 0.5, 1.2, 0x2c2e33);
      // a boom that leans out over the bonnet, with the ball hanging from it
      for (var i = 0; i < 9; i++) g.box(0, 1.6 + i * 0.48, 1.4 - i * 0.36, 0.34, 0.5, 0.34, 0x3a3d42);
      g.box(0, 4.3, -1.5, 0.08, 1.7, 0.08, TRIM);
      g.blob(0, 3.75, -1.5, 0.72, 0.72, 0.72, 0x23252a);
      [[-1.26, -2.3], [1.26, -2.3], [-1.26, 2.6], [1.26, 2.6]].forEach(function (p) { wheel(g, p[0], 0.56, p[1], 0.56, 0.44); });
      return g;
    },
    golf_cart: function (g) {
      var pink = 0xd65a86;
      g.hull([[-1.75, 0.34, 0.8, 0.9, 0.85], [-1.45, 0.3, 1.0, 1.0, 0.96], [-0.5, 0.3, 0.72, 1.05, 1.05], [1.5, 0.3, 0.72, 1.05, 1.05], [1.75, 0.34, 0.9, 1, 0.98]], 0xf4f1e8);
      g.box(0, 0.72, 0.15, 1.7, 0.3, 0.7, pink).box(0, 1.02, 0.5, 1.7, 0.72, 0.18, pink);
      g.box(0, 0.72, 1.2, 1.7, 0.3, 0.6, pink);
      [[-0.92, -0.72], [0.92, -0.72], [-0.92, 0.72], [0.92, 0.72]].forEach(function (p) { g.box(p[0], 0.72, p[1], 0.07, 1.68, 0.07, 0xc8ccd0); });
      g.hull([[-1.25, 2.4, 2.46, 1.05, 1.05], [1.15, 2.4, 2.46, 1.05, 1.05]], pink);
      g.box(0, 1.0, -0.72, 0.06, 0.5, 0.06, TRIM); g.wheel(0, 1.5, -0.7, 0.2, 0.05, TRIM);
      g.box(-0.6, 0.72, -1.62, 0.26, 0.12, 0.04, HEAD).box(0.6, 0.72, -1.62, 0.26, 0.12, 0.04, HEAD);
      [[-0.95, -1.15], [0.95, -1.15], [-0.95, 1.15], [0.95, 1.15]].forEach(function (p) { wheel(g, p[0], 0.33, p[1], 0.33, 0.28); });
      return g;
    },
    sofa_kart: function (g) {
      var v = 0x6a3aa8, d = 0x4d2880;
      g.box(0, 0.32, 0, 2.6, 0.12, 2.4, TRIM);
      g.soft = 0.3; g.softS = 2;
      g.box(0, 0.44, 0.05, 2.5, 0.44, 1.7, d);
      g.box(-0.64, 0.86, -0.02, 1.15, 0.28, 1.45, v).box(0.64, 0.86, -0.02, 1.15, 0.28, 1.45, v);
      g.box(0, 1.0, 0.86, 2.9, 1.1, 0.46, d);
      g.box(-0.64, 1.14, 0.56, 1.15, 0.62, 0.3, v).box(0.64, 1.14, 0.56, 1.15, 0.62, 0.3, v);
      g.box(-1.42, 0.44, 0.1, 0.42, 0.98, 1.8, d).box(1.42, 0.44, 0.1, 0.42, 0.98, 1.8, d);
      g.soft = 0;
      g.box(0, 0.5, -1.3, 0.06, 0.8, 0.06, TRIM); g.wheel(0, 1.32, -1.28, 0.24, 0.05, TRIM);
      [[-1.2, -1.05], [1.2, -1.05], [-1.2, 1.05], [1.2, 1.05]].forEach(function (p) { wheel(g, p[0], 0.28, p[1], 0.28, 0.22); });
      return g;
    },
    scooter: function (g) {
      var y = 0xd9a412;
      g.hull([[-1.1, 0.32, 1.45, 0.3, 0.26], [-0.86, 0.3, 0.62, 0.36, 0.34], [0.2, 0.3, 0.46, 0.34, 0.34], [0.5, 0.3, 1.0, 0.42, 0.42], [1.15, 0.36, 1.02, 0.42, 0.36]], y);
      g.box(0, 1.02, 0.65, 0.7, 0.12, 0.95, TRIM);
      g.box(0, 1.25, -1.06, 0.1, 0.65, 0.1, TRIM).box(0, 1.84, -1.06, 1.15, 0.08, 0.08, TRIM);
      g.box(-0.5, 1.8, -1.06, 0.2, 0.15, 0.14, TRIM).box(0.5, 1.8, -1.06, 0.2, 0.15, 0.14, TRIM);
      g.box(0, 1.5, -1.16, 0.24, 0.16, 0.06, HEAD);
      g.box(0, 1.14, 1.32, 0.9, 0.86, 0.9, 0xb0241c); g.box(0, 2.0, 1.32, 0.94, 0.08, 0.94, 0xf2efe6); g.box(0, 1.4, 1.78, 0.5, 0.3, 0.02, 0xf2efe6);
      wheel(g, 0, 0.3, -1.05, 0.3, 0.16); wheel(g, 0, 0.3, 1.05, 0.3, 0.2);
      return g;
    },
    hoverboard: function (g) {
      g.hull([[-1.6, 0.36, 0.44, 0.08, 0.1], [-1.15, 0.28, 0.44, 0.42, 0.46], [1.05, 0.28, 0.44, 0.42, 0.46], [1.55, 0.36, 0.44, 0.14, 0.16]], 0x13262c);
      g.hull([[-1.2, 0.44, 0.46, 0.34, 0.34], [1.1, 0.44, 0.46, 0.34, 0.34]], 0x1fb6b0);
      g.box(0, 0.18, -0.85, 0.44, 0.1, 0.5, 0x8af5ff).box(0, 0.18, 0.85, 0.44, 0.1, 0.5, 0x8af5ff);
      return g;
    },
    pogo_stick: function (g) {
      g.cyl(0, 0, 0, 0.05, 0.5, CHROME, 8);
      for (var i = 0; i < 6; i++) g.wheel(0, 0.58 + i * 0.13, 0, 0.17, 0.2, 0xb8222a);
      g.cyl(0, 0.5, 0, 0.09, 2.1, 0xb8222a, 10);
      g.box(0, 0.62, 0, 1.1, 0.1, 0.22, TRIM);
      g.box(0, 2.6, 0, 1.2, 0.09, 0.09, TRIM);
      g.box(-0.56, 2.56, 0, 0.26, 0.16, 0.16, 0x3a3d42).box(0.56, 2.56, 0, 0.26, 0.16, 0.16, 0x3a3d42);
      return g;
    },
    jetpack: function (g) {
      [-0.32, 0.32].forEach(function (x) {
        g.lathe([[0.001, 2.1], [0.15, 2.02], [0.2, 1.8], [0.2, 1.05], [0.13, 0.88]], x, 0, 0.42, 0xa8aeb4, 10);
        g.lathe([[0.1, 0.88], [0.16, 0.66], [0.001, 0.66]], x, 0, 0.42, 0x3a3d42, 10);
      });
      g.box(0, 1.35, 0.34, 0.6, 0.5, 0.2, TRIM);
      g.box(-0.3, 1.8, 0.1, 0.08, 0.06, 0.46, TRIM).box(0.3, 1.8, 0.1, 0.08, 0.06, 0.46, TRIM);
      return g;
    },
    speedboat: function (g) {
      g.hull([[-4.1, 0.75, 1.4, 0.02, 0.12], [-3.2, 0.05, 1.32, 0.34, 1.05], [-1.6, -0.05, 1.22, 0.6, 1.52], [1.6, -0.05, 1.16, 0.75, 1.6], [3.3, 0.02, 1.16, 0.85, 1.5]], 0xece8dc);
      g.hull([[-3.2, 0.62, 0.72, 0.8, 0.82], [-1.6, 0.52, 0.64, 1.22, 1.3], [1.6, 0.46, 0.58, 1.3, 1.38], [3.3, 0.48, 0.6, 1.28, 1.3]], 0xa81d24);
      g.hull([[-1.0, 1.0, 1.24, 1.2, 1.2], [1.0, 1.0, 1.2, 1.2, 1.2], [2.4, 1.0, 1.2, 1.2, 1.2]], 0x4a3524);
      g.hull([[-1.15, 1.24, 1.26, 1.22, 1.22], [-0.65, 1.24, 1.96, 1.2, 1.02], [-0.56, 1.24, 1.96, 1.2, 1.02]], 0x8fc6d8);
      g.box(0, 1.24, 0.3, 2.1, 0.34, 0.8, 0xece8dc).box(0, 1.56, 0.68, 2.1, 0.5, 0.18, 0xece8dc);
      g.box(0, 0.5, 3.5, 0.65, 1.1, 0.5, TRIM).box(0, -0.25, 3.55, 0.16, 0.8, 0.26, 0x3a3d42);
      return g;
    },
    submarine: function (g) {
      var yl = 0xd9a412, dk = 0xa87c0a;
      g.lathe([[0.001, -3.9], [0.7, -3.72], [1.25, -3.2], [1.55, -2.2], [1.6, -0.8], [1.6, 1.4], [1.35, 2.6], [0.7, 3.5], [0.2, 3.8], [0.001, 3.8]], 0, 0.3, 0, function (j, i) { return i === 4 ? dk : yl; }, 18, 'z');
      g.hull([[-1.0, 1.7, 2.8, 0.55, 0.45], [0.9, 1.7, 2.8, 0.55, 0.4]], dk);
      g.box(0, 2.8, -0.5, 0.1, 0.9, 0.1, TRIM).box(0, 3.62, -0.6, 0.1, 0.1, 0.34, TRIM);
      [-1.7, 0, 1.5].forEach(function (z) { g.blob(1.56, 0.5, z, 0.08, 0.28, 0.28, 0x9fd6ea).blob(-1.56, 0.5, z, 0.08, 0.28, 0.28, 0x9fd6ea); });
      g.box(0, 0.25, 3.3, 2.8, 0.09, 0.7, dk).box(0, -0.75, 3.3, 0.09, 2.1, 0.7, dk);
      g.box(0, -0.45, 3.95, 0.14, 1.5, 0.12, TRIM).box(-0.7, 0.25, 3.95, 1.4, 0.14, 0.12, TRIM);
      return g;
    },
    helicopter: function (g) {
      var b = 0x224e80, wh = 0xe6e1d0;
      g.hull([[-3.3, 1.5, 2.0, 0.28, 0.25], [-2.5, 0.75, 2.75, 0.95, 0.72], [-0.5, 0.65, 3.3, 1.25, 0.95], [1.5, 0.9, 3.25, 1.05, 0.72], [2.3, 1.75, 3.05, 0.4, 0.34]], b);
      g.hull([[-3.32, 1.35, 2.15, 0.29, 0.26], [-2.42, 0.95, 2.95, 0.98, 0.78], [-1.0, 1.35, 3.2, 1.14, 0.92], [-1.0, 1.35, 3.2, 1.14, 0.92]], 0x8fc6d8);
      g.hull([[-0.5, 1.15, 1.35, 1.27, 1.27], [1.5, 1.45, 1.62, 1.0, 1.0]], wh);
      g.hull([[2.2, 2.05, 3.0, 0.32, 0.28], [7.2, 2.72, 3.02, 0.08, 0.08]], b);
      g.hull([[6.3, 3.0, 4.4, 0.05, 0.05], [7.5, 3.0, 4.6, 0.05, 0.05]], 0xb8922a);
      g.box(0, 2.85, 5.6, 2.1, 0.06, 0.5, wh);
      g.box(0.14, 3.5, 7.3, 0.04, 1.5, 0.14, TRIM).box(0.14, 3.5, 7.3, 0.04, 0.14, 1.5, TRIM);
      g.box(0, 3.3, 0.1, 0.34, 1.0, 0.34, TRIM);
      [-1.3, 1.3].forEach(function (x) { g.box(x, 0.05, 0, 0.14, 0.1, 5, 0x2a2c30); g.box(x * 0.88, 0.1, -1.3, 0.09, 0.85, 0.09, 0x2a2c30); g.box(x * 0.88, 0.1, 1.1, 0.09, 0.85, 0.09, 0x2a2c30); });
      return g;
    },
    private_train: function (g) {
      var au = 0xc79a2a, dk = 0x2a2412;
      g.box(0, 0.25, 0, 3, 0.55, 11, TRIM);
      g.hull([[-6.4, 0.85, 1.9, 1.4, 0.75], [-5.3, 0.8, 3.0, 1.75, 1.2], [-3.8, 0.8, 3.5, 1.8, 1.45], [5.5, 0.8, 3.55, 1.8, 1.45]], au);
      g.hull([[-3.8, 3.5, 3.72, 1.42, 1.3], [5.5, 3.55, 3.75, 1.42, 1.3]], 0x4a3a18);
      g.hull([[-5.35, 2.15, 2.2, 1.7, 1.7], [-5.3, 2.15, 3.02, 1.74, 1.22], [-4.0, 2.15, 3.4, 1.8, 1.48]], 0x10161d);
      for (var i = 0; i < 6; i++) { g.box(-1.82, 1.9, -2.6 + i * 1.5, 0.03, 0.95, 1.1, 0x10161d); g.box(1.82, 1.9, -2.6 + i * 1.5, 0.03, 0.95, 1.1, 0x10161d); }
      g.box(-1.81, 1.2, 0.9, 0.03, 0.18, 10.6, dk).box(1.81, 1.2, 0.9, 0.03, 0.18, 10.6, dk);
      g.box(0, 1.2, -6.42, 0.6, 0.3, 0.04, HEAD);
      [[-4, 0], [-3, 0], [3, 0], [4, 0]].forEach(function (p) { wheel(g, -1.5, 0.45, p[0], 0.45, 0.25); wheel(g, 1.5, 0.45, p[0], 0.45, 0.25); });
      return g;
    },
    mole_machine: function (g) {
      var br = 0x6e4a2e;
      g.hull([[-1.25, 0.65, 2.75, 1.45, 1.25], [2.4, 0.65, 3.0, 1.75, 1.45], [3.1, 0.9, 2.6, 1.5, 1.2]], br);
      g.hull([[-0.1, 2.25, 2.95, 1.2, 1.0], [1.6, 2.5, 3.0, 1.25, 1.1]], GLASS);
      var drill = [[0.001, -5], [0.14, -4.7], [0.44, -4], [0.78, -3.3], [1.12, -2.6], [1.45, -1.9], [1.75, -1.2], [1.2, -1.15]];
      g.lathe(drill, 0, 1.7, 0, function (j, i) { return (j + i * 2) % 5 < 2 ? 0x7d8288 : 0xc0c4c8; }, 20, 'z');
      [-1.95, 1.95].forEach(function (x) {
        g.hull([[-1.4, 0.05, 1.05, 0.4, 0.4], [-0.95, 0, 1.25, 0.4, 0.4], [2.7, 0, 1.25, 0.4, 0.4], [3.2, 0.05, 1.05, 0.4, 0.4]], TYRE, 0, x);
        for (var i = 0; i < 4; i++) g.wheel(x + (x > 0 ? 0.42 : -0.42), 0.62, -0.7 + i * 1.15, 0.4, 0.05, 0x3f4247);
      });
      return g;
    },
    elephant: function (g) {
      var c = 0x8a929c, d = 0x757d87;
      [[-0.95, -1.5], [0.95, -1.5], [-0.95, 1.5], [0.95, 1.5]].forEach(function (p) {
        g.lathe([[0.62, 0], [0.56, 0.3], [0.52, 1.1], [0.6, 2.1]], p[0], 0, p[1], d, 12);
        g.lathe([[0.001, 0.02], [0.62, 0.02]], p[0], 0, p[1], 0xbfc4ca, 12);
      });
      g.blob(0, 2.95, 0, 1.55, 1.4, 2.45, c);
      g.blob(0, 3.5, -2.65, 1.12, 1.12, 1.1, c);
      [[3.05, -3.75, 0.36], [2.5, -4.05, 0.3], [1.9, -4.15, 0.25], [1.3, -4.18, 0.2], [0.8, -4.05, 0.16]].forEach(function (t) { g.blob(0, t[0], t[1], t[2], t[2] * 1.25, t[2], c); });
      g.blob(-1.45, 3.6, -2.35, 1.05, 1.15, 0.13, 0xb78d94).blob(1.45, 3.6, -2.35, 1.05, 1.15, 0.13, 0xb78d94);
      g.blob(-0.52, 2.6, -3.48, 0.1, 0.4, 0.1, 0xf4f0e0).blob(0.52, 2.6, -3.48, 0.1, 0.4, 0.1, 0xf4f0e0);
      g.blob(-0.5, 3.75, -3.56, 0.09, 0.11, 0.05, 0x101114).blob(0.5, 3.75, -3.56, 0.09, 0.11, 0.05, 0x101114);
      g.hull([[-1.15, 4.18, 4.3, 1.5, 1.5], [1.25, 4.18, 4.3, 1.5, 1.5]], 0x8c2438);
      g.hull([[-0.75, 4.3, 4.55, 0.9, 0.9], [0.95, 4.3, 4.55, 0.9, 0.9]], 0xc8a02a);
      return g;
    },
    hot_air_balloon: function (g) {
      // a real teardrop: wide at the shoulder, narrowing to the throat, in alternating panels
      var prof = [[1.0, 4.6], [1.7, 5.5], [3.1, 6.9], [4.3, 8.4], [5.1, 10], [5.4, 11.6], [5.1, 13.2], [4.1, 14.6], [2.6, 15.6], [1.1, 16.1], [0.001, 16.2]];
      g.lathe(prof, 0, 0, 0, function (j, i) {
        if (i === 4 || i === 5) return j % 2 ? 0xf2efe6 : 0x274a78;
        return j % 2 ? 0xb8282c : 0xd9a412;
      }, 24);
      g.lathe([[1.02, 4.5], [1.02, 4.72]], 0, 0, 0, TRIM, 16);
      // the basket: woven sides, a padded rim, and ropes up to the throat
      g.box(0, 0.05, 0, 2.3, 1.25, 2.3, 0x8a6236);
      for (var i = 0; i < 4; i++) { g.box(0, 0.2 + i * 0.3, 1.16, 2.3, 0.05, 0.02, 0x6b4a26); g.box(0, 0.2 + i * 0.3, -1.16, 2.3, 0.05, 0.02, 0x6b4a26); g.box(1.16, 0.2 + i * 0.3, 0, 0.02, 0.05, 2.3, 0x6b4a26); g.box(-1.16, 0.2 + i * 0.3, 0, 0.02, 0.05, 2.3, 0x6b4a26); }
      g.box(0, 1.3, -1.2, 2.5, 0.12, 0.12, 0x3f2a18).box(0, 1.3, 1.2, 2.5, 0.12, 0.12, 0x3f2a18).box(-1.2, 1.3, 0, 0.12, 0.12, 2.5, 0x3f2a18).box(1.2, 1.3, 0, 0.12, 0.12, 2.5, 0x3f2a18);
      [[-1.05, -1.05], [1.05, -1.05], [-1.05, 1.05], [1.05, 1.05]].forEach(function (p) { g.box(p[0], 1.3, p[1], 0.05, 3.3, 0.05, 0x2a2622); g.box(p[0] * 0.78, 4.45, p[1] * 0.78, 0.04, 0.2, 0.04, 0x2a2622); });
      g.box(0, 3.1, 0, 0.8, 0.28, 0.8, 0x4a4d52);
      g.lathe([[0.3, 3.38], [0.2, 3.95], [0.001, 4.0]], 0, 0, 0, 0xffb040, 8);
      return g;
    }
  };
})();
