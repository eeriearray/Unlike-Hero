/* Merged-geometry builder and collision grid. Everything in the city is built from these boxes. */
(function () {
  var TR = window.TR = window.TR || {};
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
    var lo = 0.74, hi = 1;
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
  /** Cylinder or cone. */
  Geo.prototype.cyl = function (x, y, z, rb, h, color, n, rt) {
    C.setHex(color);
    n = n || 8; if (rt == null) rt = rb;
    var r = C.r, g = C.g, b = C.b, y1 = y + h;
    for (var i = 0; i < n; i++) {
      var a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      var nx = Math.cos((a0 + a1) / 2), nz = Math.sin((a0 + a1) / 2);
      this.tri(x + c1 * rb, y, z + s1 * rb, x + c0 * rb, y, z + s0 * rb, x + c0 * rt, y1, z + s0 * rt, nx, 0, nz, r, g, b, 0.74, 0.74, 1);
      if (rt > 0) {
        this.tri(x + c1 * rb, y, z + s1 * rb, x + c0 * rt, y1, z + s0 * rt, x + c1 * rt, y1, z + s1 * rt, nx, 0, nz, r, g, b, 0.74, 1, 1);
        this.tri(x, y1, z, x + c1 * rt, y1, z + s1 * rt, x + c0 * rt, y1, z + s0 * rt, 0, 1, 0, r, g, b, 1.06, 1.06, 1.06);
      }
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
