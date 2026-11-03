/* Merged-geometry builder and collision grid. Everything in the city is built from these boxes. */
(function () {
  var TR = window.TR = window.TR || {};
  THREE.ColorManagement.legacyMode = false;   // colours are authored in sRGB and lit in linear space
  var C = new THREE.Color();

  function Geo() { this.p = []; this.n = []; this.c = []; this.uv = null; this.count = 0; }
  Geo.prototype.tri = function (ax, ay, az, bx, by, bz, cx, cy, cz, nx, ny, nz, r, g, b, s1, s2, s3) {
    this.p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.c.push(r * s1, g * s1, b * s1, r * s2, g * s2, b * s2, r * s3, g * s3, b * s3);
    this.count += 3;
  };
  /** Box with base at y. Sides are baked darker toward the ground, which gives the toy look without textures. */
  Geo.prototype.box = function (x, y, z, w, h, d, color, ry) {
    if (this.soft && !ry && Math.min(w, h, d) > 0.09) { var m = Math.min(w, h, d) * this.soft; return this.rbox(x, y, z, w, h, d, color, m, m, this.softS || 2); }
    C.setHex(color);
    var r = C.r, g = C.g, b = C.b, hw = w / 2, hd = d / 2, y1 = y + h, cos = 1, sin = 0;
    if (ry) { cos = Math.cos(ry); sin = Math.sin(ry); }
    var self = this;
    function X(px, pz) { return x + px * cos + pz * sin; }
    function Z(px, pz) { return z - px * sin + pz * cos; }
    function face(a, b2, c2, d2, ya, yb, nx, ny, nz, sA, sB) {
      var ax = X(a[0], a[1]), az = Z(a[0], a[1]), bx = X(b2[0], b2[1]), bz = Z(b2[0], b2[1]);
      var cx = X(c2[0], c2[1]), cz = Z(c2[0], c2[1]), dx = X(d2[0], d2[1]), dz = Z(d2[0], d2[1]);
      var wnx = nx * cos + nz * sin, wnz = -nx * sin + nz * cos;
      self.tri(ax, ya, az, bx, ya, bz, cx, yb, cz, wnx, ny, wnz, r, g, b, sA, sA, sB);
      self.tri(ax, ya, az, cx, yb, cz, dx, yb, dz, wnx, ny, wnz, r, g, b, sA, sB, sB);
    }
    var lo = 0.68, hi = 1.03;
    face([-hw, hd], [hw, hd], [hw, hd], [-hw, hd], y, y1, 0, 0, 1, lo, hi);
    face([hw, -hd], [-hw, -hd], [-hw, -hd], [hw, -hd], y, y1, 0, 0, -1, lo, hi);
    face([hw, hd], [hw, -hd], [hw, -hd], [hw, hd], y, y1, 1, 0, 0, lo, hi);
    face([-hw, -hd], [-hw, hd], [-hw, hd], [-hw, -hd], y, y1, -1, 0, 0, lo, hi);
    // top
    var tx = [X(-hw, hd), X(hw, hd), X(hw, -hd), X(-hw, -hd)], tz = [Z(-hw, hd), Z(hw, hd), Z(hw, -hd), Z(-hw, -hd)];
    this.tri(tx[0], y1, tz[0], tx[1], y1, tz[1], tx[2], y1, tz[2], 0, 1, 0, r, g, b, 1.06, 1.06, 1.06);
    this.tri(tx[0], y1, tz[0], tx[2], y1, tz[2], tx[3], y1, tz[3], 0, 1, 0, r, g, b, 1.06, 1.06, 1.06);
    return this;
  };
  /** Cylinder or cone, smooth-shaded. */
  Geo.prototype.cyl = function (x, y, z, rb, h, color, n, rt) {
    C.setHex(color);
    n = Math.max(n || 12, 8); if (rt == null) rt = rb;
    var r = C.r, g = C.g, b = C.b, y1 = y + h, slope = (rb - rt) / (h || 1), nl = Math.sqrt(1 + slope * slope), ny = slope / nl, hl = 1 / nl, P = this.p, N = this.n, K = this.c;
    function v(px, py, pz, nx, nyy, nz, s) { P.push(px, py, pz); N.push(nx, nyy, nz); K.push(r * s, g * s, b * s); }
    for (var i = 0; i < n; i++) {
      var a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      v(x + c1 * rb, y, z + s1 * rb, c1 * hl, ny, s1 * hl, 0.72); v(x + c0 * rb, y, z + s0 * rb, c0 * hl, ny, s0 * hl, 0.72); v(x + c0 * rt, y1, z + s0 * rt, c0 * hl, ny, s0 * hl, 1);
      this.count += 3;
      if (rt > 0) {
        v(x + c1 * rb, y, z + s1 * rb, c1 * hl, ny, s1 * hl, 0.72); v(x + c0 * rt, y1, z + s0 * rt, c0 * hl, ny, s0 * hl, 1); v(x + c1 * rt, y1, z + s1 * rt, c1 * hl, ny, s1 * hl, 1);
        v(x, y1, z, 0, 1, 0, 1.05); v(x + c1 * rt, y1, z + s1 * rt, 0, 1, 0, 1.05); v(x + c0 * rt, y1, z + s0 * rt, 0, 1, 0, 1.05);
        this.count += 6;
      }
    }
    return this;
  };
  /**
   * A box with rounded edges and smooth shading: the thing that stops the city looking like cubes.
   * r rounds the upright corners, ry the top and bottom edges, S is the steps per corner.
   */
  Geo.prototype.rbox = function (x, y, z, w, h, d, color, r, ry, S) {
    C.setHex(color);
    S = S || 1; r = Math.min(r == null ? 0.3 : r, w / 2 - 0.001, d / 2 - 0.001); ry = Math.min(ry == null ? r : ry, h / 2 - 0.001);
    var cr = C.r, cg = C.g, cb = C.b, hw = w / 2 - r, hd = d / 2 - r, cy = y + h / 2, hh = h / 2 - ry, HP = Math.PI / 2, rows = [], i, j, q;
    function lat(i0) { var out = []; for (var k = 0; k <= S; k++) out.push({ t: HP - k / S * HP, up: 1 }); for (k = 0; k <= S; k++) out.push({ t: -k / S * HP, up: -1 }); return out; }
    var lats = lat(), signs = [[1, 1], [-1, 1], [-1, -1], [1, -1]], lons = [];
    for (q = 0; q < 4; q++) for (j = 0; j <= S; j++) lons.push({ p: q * HP + j / S * HP, sx: signs[q][0], sz: signs[q][1] });
    var grid = lats.map(function (L) {
      return lons.map(function (O) {
        var nx = Math.cos(L.t) * Math.cos(O.p), ny = Math.sin(L.t), nz = Math.cos(L.t) * Math.sin(O.p);
        var px = x + O.sx * hw + nx * r, py = cy + L.up * hh + ny * ry, pz = z + O.sz * hd + nz * r;
        var nl = Math.hypot(nx * ry, ny * r, nz * ry) || 1, f = (py - y) / h, sh = ny > 0.7 ? 1.05 : 0.68 + 0.35 * f;
        return [px, py, pz, nx * ry / nl, ny * r / nl, nz * ry / nl, sh];
      });
    });
    var P = this.p, N = this.n, K = this.c;
    function put(a) { P.push(a[0], a[1], a[2]); N.push(a[3], a[4], a[5]); K.push(cr * a[6], cg * a[6], cb * a[6]); }
    var M = lons.length;
    for (i = 0; i < grid.length - 1; i++) for (j = 0; j < M; j++) {
      var a = grid[i][j], b = grid[i][(j + 1) % M], c = grid[i + 1][j], e = grid[i + 1][(j + 1) % M];
      put(a); put(b); put(e); put(a); put(e); put(c);
      this.count += 6;
    }
    return this;
  };
  /** Flat strip between two points, for roads and paint. */
  Geo.prototype.strip = function (x0, z0, x1, z1, w, y, color) {
    C.setHex(color);
    var dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, px = -dz / l * w / 2, pz = dx / l * w / 2, r = C.r, g = C.g, b = C.b;
    this.tri(x0 + px, y, z0 + pz, x1 + px, y, z1 + pz, x1 - px, y, z1 - pz, 0, 1, 0, r, g, b, 1, 1, 1);
    this.tri(x0 + px, y, z0 + pz, x1 - px, y, z1 - pz, x0 - px, y, z0 - pz, 0, 1, 0, r, g, b, 1, 1, 1);
    return this;
  };
  /** One flat quad on a wall or floor, no thickness. Corners a, b, c, d run counter-clockwise seen from outside. */
  Geo.prototype.quad = function (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz, color, sLow, sHigh) {
    C.setHex(color);
    var lo = sLow == null ? 1 : sLow, hi = sHigh == null ? lo : sHigh;
    this.tri(ax, ay, az, bx, by, bz, cx, cy, cz, nx, ny, nz, C.r, C.g, C.b, lo, lo, hi);
    this.tri(ax, ay, az, cx, cy, cz, dx, dy, dz, nx, ny, nz, C.r, C.g, C.b, lo, hi, hi);
    return this;
  };
  /** A flat rectangle on the ground. */
  Geo.prototype.tile = function (x0, z0, x1, z1, y, color, s) { return this.quad(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0, 0, 1, 0, color, s == null ? 1 : s); };
  /** A panel on a facade: side is 'n','s','e','w' of a box centred x,z with half sizes hw,hd. u runs along the wall. */
  Geo.prototype.panel = function (side, x, z, hw, hd, off, u, y, w, h, color) {
    var a = u - w / 2, b = u + w / 2, y1 = y + h;
    if (side === 's') { var zs = z + hd + off; return this.quad(x + a, y, zs, x + b, y, zs, x + b, y1, zs, x + a, y1, zs, 0, 0, 1, color); }
    if (side === 'n') { var zn = z - hd - off; return this.quad(x - a, y, zn, x - b, y, zn, x - b, y1, zn, x - a, y1, zn, 0, 0, -1, color); }
    if (side === 'e') { var xe = x + hw + off; return this.quad(xe, y, z - a, xe, y, z - b, xe, y1, z - b, xe, y1, z - a, 1, 0, 0, color); }
    var xw = x - hw - off; return this.quad(xw, y, z + a, xw, y, z + b, xw, y1, z + b, xw, y1, z + a, -1, 0, 0, color);
  };
  /** Pitched roof. The ridge runs along z when alongZ, otherwise along x. */
  Geo.prototype.gable = function (x, y, z, w, h, d, color, alongZ) {
    C.setHex(color);
    var r = C.r, g = C.g, b = C.b, hw = w / 2, hd = d / 2, y1 = y + h, l, nn, ny;
    if (alongZ) {
      l = Math.hypot(hw, h); nn = h / l; ny = hw / l;
      this.tri(x - hw, y, z + hd, x, y1, z + hd, x, y1, z - hd, -nn, ny, 0, r, g, b, 0.9, 1.05, 1.05); this.tri(x - hw, y, z + hd, x, y1, z - hd, x - hw, y, z - hd, -nn, ny, 0, r, g, b, 0.9, 1.05, 0.9);
      this.tri(x + hw, y, z - hd, x, y1, z - hd, x, y1, z + hd, nn, ny, 0, r, g, b, 0.9, 1.05, 1.05); this.tri(x + hw, y, z - hd, x, y1, z + hd, x + hw, y, z + hd, nn, ny, 0, r, g, b, 0.9, 1.05, 0.9);
      this.tri(x - hw, y, z + hd, x + hw, y, z + hd, x, y1, z + hd, 0, 0, 1, r, g, b, 0.8, 0.8, 0.9); this.tri(x + hw, y, z - hd, x - hw, y, z - hd, x, y1, z - hd, 0, 0, -1, r, g, b, 0.8, 0.8, 0.9);
    } else {
      l = Math.hypot(hd, h); nn = h / l; ny = hd / l;
      this.tri(x + hw, y, z + hd, x + hw, y1, z, x - hw, y1, z, 0, ny, nn, r, g, b, 0.9, 1.05, 1.05); this.tri(x + hw, y, z + hd, x - hw, y1, z, x - hw, y, z + hd, 0, ny, nn, r, g, b, 0.9, 1.05, 0.9);
      this.tri(x - hw, y, z - hd, x - hw, y1, z, x + hw, y1, z, 0, ny, -nn, r, g, b, 0.9, 1.05, 1.05); this.tri(x - hw, y, z - hd, x + hw, y1, z, x + hw, y, z - hd, 0, ny, -nn, r, g, b, 0.9, 1.05, 0.9);
      this.tri(x + hw, y, z - hd, x + hw, y1, z, x + hw, y, z + hd, 1, 0, 0, r, g, b, 0.8, 0.9, 0.8); this.tri(x - hw, y, z + hd, x - hw, y1, z, x - hw, y, z - hd, -1, 0, 0, r, g, b, 0.8, 0.9, 0.8);
    }
    return this;
  };
  /** A smooth low-poly ball, for leaves and clouds. Colour darkens toward the underside. */
  var ICO = (function () {
    var t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(function (p) { var l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; });
    var f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    var out = [], mid = function (a, b) { var m = [a[0] + b[0], a[1] + b[1], a[2] + b[2]], l = Math.hypot(m[0], m[1], m[2]); return [m[0] / l, m[1] / l, m[2] / l]; };
    f.forEach(function (q) { var a = v[q[0]], b = v[q[1]], c = v[q[2]], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); out.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca); });
    return out;
  })();
  Geo.prototype.blob = function (x, y, z, rx, ry, rz, color) {
    C.setHex(color);
    for (var i = 0; i < ICO.length; i++) {
      var n = ICO[i], s = 0.74 + 0.3 * (n[1] * 0.5 + 0.5);
      this.p.push(x + n[0] * rx, y + n[1] * ry, z + n[2] * rz);
      this.n.push(n[0], n[1], n[2]);
      this.c.push(C.r * s, C.g * s, C.b * s);
    }
    this.count += ICO.length;
    return this;
  };
  /** Wheel: a cylinder lying on its side, axis along x. */
  Geo.prototype.wheel = function (x, y, z, r, w, color, hub) {
    C.setHex(color);
    var n = 10, cr = C.r, cg = C.g, cb = C.b, hw = w / 2;
    for (var i = 0; i < n; i++) {
      var a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, y0 = y + Math.cos(a0) * r, z0 = z + Math.sin(a0) * r, y1 = y + Math.cos(a1) * r, z1 = z + Math.sin(a1) * r, ny = Math.cos((a0 + a1) / 2), nz = Math.sin((a0 + a1) / 2);
      this.tri(x - hw, y0, z0, x + hw, y0, z0, x + hw, y1, z1, 0, ny, nz, cr, cg, cb, 1, 1, 1); this.tri(x - hw, y0, z0, x + hw, y1, z1, x - hw, y1, z1, 0, ny, nz, cr, cg, cb, 1, 1, 1);
      this.tri(x + hw, y, z, x + hw, y1, z1, x + hw, y0, z0, 1, 0, 0, cr, cg, cb, 1, 1, 1); this.tri(x - hw, y, z, x - hw, y0, z0, x - hw, y1, z1, -1, 0, 0, cr, cg, cb, 1, 1, 1);
    }
    if (hub != null) { var o = (x > 0 ? 1 : -1) * (hw + 0.01); this.quad(x + o, y - r * 0.45, z - r * 0.45 * (o > 0 ? -1 : 1), x + o, y - r * 0.45, z + r * 0.45 * (o > 0 ? -1 : 1), x + o, y + r * 0.45, z + r * 0.45 * (o > 0 ? -1 : 1), x + o, y + r * 0.45, z - r * 0.45 * (o > 0 ? -1 : 1), o > 0 ? 1 : -1, 0, 0, hub); }
    return this;
  };
  Geo.prototype.geometry = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    return g;
  };
  Geo.prototype.mesh = function (material, cast, receive) {
    var m = new THREE.Mesh(this.geometry(), material);
    m.castShadow = !!cast; m.receiveShadow = !!receive; m.matrixAutoUpdate = false;
    return m;
  };
  TR.Geo = Geo;

  /** Instanced bodies: white parts take the instance colour, pure blue parts a darker second colour, the rest stay as painted. */
  TR.tintedMaterial = function () {
    var m = new THREE.MeshLambertMaterial({ vertexColors: true });
    m.onBeforeCompile = function (sh) {
      sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>',
        'vColor = vec3(1.0); vColor *= color;\n' +
        '#ifdef USE_INSTANCING_COLOR\n' +
        'if (abs(color.r - color.g) < 0.02 && abs(color.g - color.b) < 0.02 && color.r > 0.25) vColor = instanceColor.xyz * color.r;\n' +
        'else if (color.r < 0.01 && color.g < 0.01 && color.b > 0.1) vColor = instanceColor.zxy * 0.45 * color.b + vec3(0.03);\n' +
        '#endif\n');
    };
    return m;
  };

  // ───── collision: axis-aligned boxes in a hash grid ─────
  var CELL = 24;
  function Collide() { this.cells = new Map(); this.all = []; this.stamp = 0; }
  Collide.prototype.key = function (cx, cz) { return cx * 65536 + cz; };
  Collide.prototype.add = function (x0, y0, z0, x1, y1, z1, tag) {
    var box = { x0: x0, y0: y0, z0: z0, x1: x1, y1: y1, z1: z1, tag: tag || null, off: false, seen: 0 };
    this.all.push(box);
    for (var cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) for (var cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
      var k = this.key(cx, cz), list = this.cells.get(k);
      if (!list) this.cells.set(k, list = []);
      list.push(box);
    }
    return box;
  };
  Collide.prototype.addBox = function (x, y, z, w, h, d, tag) { return this.add(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, tag); };
  Collide.prototype.near = function (x, z, r, out) {
    out.length = 0;
    this.stamp++;
    for (var cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) for (var cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
      var list = this.cells.get(this.key(cx, cz));
      if (!list) continue;
      for (var i = 0; i < list.length; i++) { var b = list[i]; if (b.seen !== this.stamp && !b.off) { b.seen = this.stamp; out.push(b); } }
    }
    return out;
  };
  var scratch = [];
  /**
   * Moves a body with radius r and height h to (pos), pushing out of walls. Boxes whose top is within stepUp of the
   * feet are stood on rather than pushed against. Sets body.ground to the floor height under it. Returns hit box or null.
   */
  Collide.prototype.resolve = function (pos, r, h, stepUp, floor) {
    var list = this.near(pos.x, pos.z, r + 1, scratch), hit = null, ground = floor;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (pos.y + h <= b.y0 || pos.y >= b.y1) { // not vertically overlapping: maybe a floor under us
        if (b.y1 <= pos.y + stepUp && pos.x > b.x0 - r * 0.6 && pos.x < b.x1 + r * 0.6 && pos.z > b.z0 - r * 0.6 && pos.z < b.z1 + r * 0.6) ground = Math.max(ground, b.y1);
        continue;
      }
      if (b.y1 - pos.y <= stepUp) { // low enough to step on
        if (pos.x > b.x0 - r * 0.6 && pos.x < b.x1 + r * 0.6 && pos.z > b.z0 - r * 0.6 && pos.z < b.z1 + r * 0.6) ground = Math.max(ground, b.y1);
        continue;
      }
      var nx = Math.max(b.x0, Math.min(pos.x, b.x1)), nz = Math.max(b.z0, Math.min(pos.z, b.z1));
      var dx = pos.x - nx, dz = pos.z - nz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = b;
      if (d2 > 1e-6) {
        var dl = Math.sqrt(d2);
        pos.x = nx + dx / dl * r; pos.z = nz + dz / dl * r;
      } else { // centre inside: shortest way out
        var l = pos.x - b.x0, rr = b.x1 - pos.x, t = pos.z - b.z0, bt = b.z1 - pos.z, m = Math.min(l, rr, t, bt);
        if (m === l) pos.x = b.x0 - r; else if (m === rr) pos.x = b.x1 + r; else if (m === t) pos.z = b.z0 - r; else pos.z = b.z1 + r;
      }
    }
    pos.ground = ground;
    return hit;
  };
  /** Distance a camera can pull back along a ray before meeting a box. */
  Collide.prototype.rayClip = function (ox, oy, oz, dx, dy, dz, maxD) {
    var best = maxD;
    var list = this.near(ox + dx * maxD * 0.5, oz + dz * maxD * 0.5, maxD * 0.6 + 2, scratch);
    for (var i = 0; i < list.length; i++) {
      var b = list[i], tmin = 0, tmax = best, ok = true;
      var ax = [[ox, dx, b.x0, b.x1], [oy, dy, b.y0, b.y1], [oz, dz, b.z0, b.z1]];
      for (var k = 0; k < 3; k++) {
        var o = ax[k][0], d = ax[k][1], lo = ax[k][2], hi = ax[k][3];
        if (Math.abs(d) < 1e-6) { if (o < lo || o > hi) { ok = false; break; } continue; }
        var t1 = (lo - o) / d, t2 = (hi - o) / d;
        if (t1 > t2) { var tt = t1; t1 = t2; t2 = tt; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) { ok = false; break; }
      }
      if (ok && tmin > 0.01 && tmin < best) best = tmin;
    }
    return best;
  };
  TR.Collide = Collide;
})();
