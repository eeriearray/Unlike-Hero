/* Putt Club — ball physics.
 *
 * One deterministic, fixed-timestep simulation shared by the server (authoritative) and the browser
 * (trajectory preview, own-ball prediction, offline practice). Loads as CommonJS in Node and as a
 * classic <script> in the browser (window.PuttPhysics).
 *
 * The world is "2.5D": floors are planar polygons (flat or sloped) in the x/z plane, walls are
 * capsule segments with a top height, and the ball is a sphere whose y is the height of its
 * contact point. Airborne flight, ramps, drops, moving obstacles and platforms all follow from that.
 *
 * Units: the ball radius is 0.22; a typical hole is 20–40 units long.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PuttPhysics = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var C = {
    R: 0.22,               // ball radius
    CUP_R: 0.42,           // cup radius
    G: 22,                 // gravity
    ROLL_G: 22 * 5 / 7,    // gravity along a slope for a rolling sphere
    DT: 1 / 120,           // base fixed step
    STEP: 0.16,            // highest ledge a rolling ball climbs without being blocked
    MAX_SPEED: 30,         // hard velocity clamp (prevents explosions)
    MAX_SHOT: 17,          // full-power shot speed at strength 1.0
    MIN_SHOT: 0.6,
    ROLL_DECEL: 2.6,       // constant rolling resistance
    DRAG: 0.2,             // speed-proportional drag
    STOP_SPEED: 0.1,
    STATIC_GRADE: 0.04,    // slopes gentler than this hold a slow ball still
    CAPTURE_SPEED: 5.2,    // slower than this over the cup drops in
    CAPTURE_SPEED_CENTER: 7.2,
    RIM_PULL: 5,
    MAX_SHOT_TIME: 22,     // seconds before a rolling ball is forced to settle
    STUCK_TIME: 3.5,
    VOID_Y: -5
  };

  // Friction multiplier and bounce per material.
  var FLOOR_FRICTION = { grass: 1, felt: 1, stone: 0.95, wood: 0.9, bridge: 0.95, sand: 5.5, metal: 0.75, glass: 0.7, brass: 0.8, tile: 0.85, carpet: 1.1, pad: 1 };
  var WALL_BOUNCE = { wood: 0.7, stone: 0.62, metal: 0.8, brass: 0.78, glass: 0.82, rope: 0.45, hedge: 0.5, bumper: 1.25, neon: 0.85, rubber: 0.9 };

  var LEDGE_TOL = 0.12; // steps lower than this are climbed or landed on rather than blocking

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------------------------------------------------------------- compile course data

  function polyFrom(def) {
    if (def.poly) return def.poly.map(function (p) { return [p[0], p[1]]; });
    if (def.rect) { var r = def.rect; return [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]]; }
    if (def.circle) {
      var c = def.circle, n = def.sides || 24, out = [];
      for (var i = 0; i < n; i++) { var a = (i / n) * Math.PI * 2; out.push([c[0] + Math.cos(a) * c[2], c[1] + Math.sin(a) * c[2]]); }
      return out;
    }
    throw new Error('floor needs poly, rect or circle');
  }

  function bbox(poly) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i];
      if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1];
      if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1];
    }
    return b;
  }

  function inPoly(poly, x, z) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) inside = !inside;
    }
    return inside;
  }

  // Mirror (x -> -x) a course definition, used for tournament "mirror" laps.
  function mx(p, m) { return m ? [-p[0], p[1]] : p; }

  /** Turn plain hole data (see engine/courses.js) into a world the simulation can query quickly. */
  function compileHole(hole, opts) {
    var m = !!(opts && opts.mirror);
    var w = {
      id: hole.id, par: hole.par,
      floors: [], walls: [], spinners: [], sliders: [], gates: [], bumpers: [], pads: [], magnets: [], platforms: [],
      cup: mx(hole.cup, m).slice(), cupH: 0, tee: mx(hole.tee, m).slice(), teeDir: null,
      water: hole.water || null, // { level, regions? }
      oobY: hole.oobY == null ? C.VOID_Y : hole.oobY,
      tokens: (hole.tokens || []).map(function (t) { return mx(t, m).slice(); })
    };

    (hole.floors || []).forEach(function (f) {
      var poly = polyFrom(f).map(function (p) { return mx(p, m); });
      if (m) poly.reverse();
      var piece = {
        poly: poly, bb: bbox(poly), h0: 0, ox: 0, oz: 0, gx: 0, gz: 0, mat: f.mat || 'grass', plat: -1,
        overlay: !!f.overlay, sides: f.sides !== false && !f.overlay, rails: f.overlay ? false : f.rails == null ? true : f.rails
      };
      if (Array.isArray(f.h)) {
        // Slope between two heights along an axis or direction: { h: [h0, h1], from: [x,z], to: [x,z] }
        // or for rects { h: [hStart, hEnd], axis: 'z'|'x' } (start = min edge).
        var from, to;
        if (f.from) { from = mx(f.from, m); to = mx(f.to, m); }
        else {
          var b = piece.bb, axis = f.axis || 'z';
          var cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2;
          if (axis === 'z') { from = [cx, b[1]]; to = [cx, b[3]]; }
          else { from = m ? [b[2], cz] : [b[0], cz]; to = m ? [b[0], cz] : [b[2], cz]; }
          if (f.reverse) { var tmp = from; from = to; to = tmp; }
        }
        var dx = to[0] - from[0], dz = to[1] - from[1], L2 = dx * dx + dz * dz || 1;
        var grade = (f.h[1] - f.h[0]) / L2;
        piece.h0 = f.h[0]; piece.ox = from[0]; piece.oz = from[1]; piece.gx = dx * grade; piece.gz = dz * grade;
      } else if (f.tilt) {
        // Constant gradient { h, tilt: [dh/dx, dh/dz] } through the polygon's centroid.
        var bb2 = piece.bb;
        piece.h0 = f.h || 0; piece.ox = (bb2[0] + bb2[2]) / 2; piece.oz = (bb2[1] + bb2[3]) / 2;
        piece.gx = (m ? -1 : 1) * f.tilt[0]; piece.gz = f.tilt[1];
      } else {
        piece.h0 = f.h || 0;
      }
      w.floors.push(piece);
    });

    (hole.walls || []).forEach(function (wl) {
      var pts = wl.pts || [wl.a, wl.b];
      for (var i = 0; i + 1 < pts.length; i++) {
        var a = mx(pts[i], m), b = mx(pts[i + 1], m);
        w.walls.push(makeWall(a, b, wl));
      }
      if (wl.closed && pts.length > 2) w.walls.push(makeWall(mx(pts[pts.length - 1], m), mx(pts[0], m), wl));
    });

    autoRails(w, hole, m);

    // Ledges: a floor that sits above a neighbour blocks a rolling ball from the low side.
    // Sloped edges are split so each piece's top follows the slope.
    w.floors.forEach(function (f, fi) {
      if (!f.sides) return;
      var sloped = f.gx !== 0 || f.gz !== 0;
      for (var i = 0; i < f.poly.length; i++) {
        var a = f.poly[i], b = f.poly[(i + 1) % f.poly.length];
        var n = sloped ? Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.8)) : 1;
        for (var k = 0; k < n; k++) {
          var p0 = [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n];
          var p1 = [a[0] + (b[0] - a[0]) * (k + 1) / n, a[1] + (b[1] - a[1]) * (k + 1) / n];
          var top = Math.min(heightOn(f, p0[0], p0[1]), heightOn(f, p1[0], p1[1]));
          w.walls.push({ ax: p0[0], az: p0[1], bx: p1[0], bz: p1[1], top: top, base: top - 30, thick: 0.0, e: 0.5, mat: 'stone', soft: false, ledge: true, floor: fi });
        }
      }
    });

    (hole.spinners || []).forEach(function (s) {
      var c = mx(s.at, m);
      w.spinners.push({ cx: c[0], cz: c[1], len: s.len, arms: s.arms || 2, w: (m ? -1 : 1) * (s.speed || 1), phase: s.phase || 0, h: s.h || 0, top: (s.h || 0) + (s.height || 0.5), thick: s.thick || 0.14, mat: s.mat || 'wood', e: WALL_BOUNCE[s.mat || 'wood'] || 0.7, hub: s.hub || 0.28 });
    });
    (hole.sliders || []).forEach(function (s) {
      var a = mx(s.from, m), b = mx(s.to, m);
      w.sliders.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], len: s.len, ang: (m ? Math.PI - (s.angle || 0) : (s.angle || 0)), period: s.period || 4, phase: s.phase || 0, h: s.h || 0, top: (s.h || 0) + (s.height || 0.5), thick: s.thick || 0.18, mat: s.mat || 'brass', e: WALL_BOUNCE[s.mat || 'brass'] || 0.75 });
    });
    (hole.gates || []).forEach(function (g) {
      var a = mx(g.a, m), b = mx(g.b, m);
      w.gates.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], h: g.h || 0, height: g.height || 0.7, period: g.period || 5, open: g.open == null ? 0.45 : g.open, phase: g.phase || 0, thick: g.thick || 0.14, mat: g.mat || 'brass', e: WALL_BOUNCE[g.mat || 'brass'] || 0.75 });
    });
    (hole.bumpers || []).forEach(function (bp) {
      var c = mx(bp.at, m);
      w.bumpers.push({ x: c[0], z: c[1], r: bp.r || 0.45, h: bp.h || 0, top: (bp.h || 0) + (bp.height || 0.6), e: bp.e || 1.25, kick: bp.kick == null ? 2.5 : bp.kick, soft: bp.solid ? false : true, mat: bp.mat || 'bumper', post: !!bp.post });
    });
    (hole.pads || []).forEach(function (p) {
      var c = mx(p.at, m), d = mx(p.dir, m), l = Math.hypot(d[0], d[1]) || 1;
      w.pads.push({ x: c[0], z: c[1], r: p.r || 0.7, dx: d[0] / l, dz: d[1] / l, speed: p.speed || 12, up: p.up || 0, h: p.h || 0 });
    });
    (hole.magnets || []).forEach(function (mg) {
      var c = mx(mg.at, m);
      w.magnets.push({ x: c[0], z: c[1], r: mg.r || 2.5, k: mg.k || 8, h: mg.h || 0 });
    });
    (hole.platforms || []).forEach(function (p) {
      var a = mx(p.from, m), b = mx(p.to, m);
      w.platforms.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], hw: p.size[0] / 2, hd: p.size[1] / 2, h: p.h || 0, period: p.period || 6, phase: p.phase || 0, pause: p.pause == null ? 0.25 : p.pause, mat: p.mat || 'wood' });
    });

    // Obstacles without an explicit height sit on the floor beneath them.
    function ground(x, z) { var f = floorAt(w, x, z, 50, 0); return f ? f.h : 0; }
    function seat(list, src, kx, kz, setTop) {
      list.forEach(function (o, i) {
        if (src[i].h != null) return;
        o.h = ground(o[kx], o[kz]);
        if (setTop) o.top = o.h + setTop(src[i]);
      });
    }
    seat(w.spinners, hole.spinners || [], 'cx', 'cz', function (s) { return s.height || 0.5; });
    seat(w.bumpers, hole.bumpers || [], 'x', 'z', function (b) { return b.height || 0.6; });
    seat(w.pads, hole.pads || [], 'x', 'z');
    seat(w.magnets, hole.magnets || [], 'x', 'z');
    w.sliders.forEach(function (s, i) { if ((hole.sliders[i] || {}).h == null) { s.h = ground((s.ax + s.bx) / 2, (s.az + s.bz) / 2); s.top = s.h + (hole.sliders[i].height || 0.5); } });
    w.gates.forEach(function (g, i) { if ((hole.gates[i] || {}).h == null) g.h = ground((g.ax + g.bx) / 2, (g.az + g.bz) / 2); });

    var cf = floorAt(w, w.cup[0], w.cup[1], 50, 0);
    w.cupH = cf ? cf.h : 0;
    var tf = floorAt(w, w.tee[0], w.tee[1], 50, 0);
    w.teeH = tf ? tf.h : 0;
    var dx = w.cup[0] - w.tee[0], dz = w.cup[1] - w.tee[1], dl = Math.hypot(dx, dz) || 1;
    w.teeDir = hole.teeDir ? mx(hole.teeDir, m) : [dx / dl, dz / dl];
    // Precomputed bounding boxes make the per-substep wall loop cheap.
    w.walls.forEach(function (wl) {
      var pad = wl.thick + C.R * 2;
      wl.x0 = Math.min(wl.ax, wl.bx) - pad; wl.x1 = Math.max(wl.ax, wl.bx) + pad;
      wl.z0 = Math.min(wl.az, wl.bz) - pad; wl.z1 = Math.max(wl.az, wl.bz) + pad;
    });
    w.bounds = worldBounds(w);
    return w;
  }

  // Rails: every floor edge that no other (non-overlay) floor shares gets a rail, except inside
  // hole.noRail boxes [x0, z0, x1, z1] (gaps for jumps, docks and drop-offs) and on floors with rails: false.
  function autoRails(w, hole, m) {
    var noRail = (hole.noRail || []).map(function (r) {
      var a = mx([r[0], r[1]], m), b = mx([r[2], r[3]], m);
      return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
    });
    var railMat = hole.railMat || 'wood', railH = hole.railHeight || 0.38;
    w.floors.forEach(function (f, fi) {
      if (f.rails === false) return;
      var opt = typeof f.rails === 'object' ? f.rails : {};
      for (var i = 0; i < f.poly.length; i++) {
        var a = f.poly[i], b = f.poly[(i + 1) % f.poly.length];
        var ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez, L = Math.sqrt(L2);
        if (L < 1e-6) continue;
        var keep = [[0, 1]];
        for (var gi = 0; gi < w.floors.length && keep.length; gi++) {
          var g = w.floors[gi];
          if (gi === fi || g.overlay) continue;
          for (var j = 0; j < g.poly.length; j++) {
            var c = g.poly[j], d = g.poly[(j + 1) % g.poly.length];
            var c1 = (ex * (c[1] - a[1]) - ez * (c[0] - a[0])) / L, c2 = (ex * (d[1] - a[1]) - ez * (d[0] - a[0])) / L;
            if (Math.abs(c1) > 1e-3 || Math.abs(c2) > 1e-3) continue;
            var u1 = ((c[0] - a[0]) * ex + (c[1] - a[1]) * ez) / L2, u2 = ((d[0] - a[0]) * ex + (d[1] - a[1]) * ez) / L2;
            var lo = Math.min(u1, u2), hi = Math.max(u1, u2);
            if (hi <= 1e-4 || lo >= 1 - 1e-4) continue;
            keep = subtractInterval(keep, lo, hi);
          }
        }
        for (var k = 0; k < noRail.length && keep.length; k++) {
          var clip = clipToBox(a, ex, ez, noRail[k]);
          if (clip) keep = subtractInterval(keep, clip[0], clip[1]);
        }
        keep.forEach(function (iv) {
          if ((iv[1] - iv[0]) * L < 0.06) return;
          var p = [a[0] + ex * iv[0], a[1] + ez * iv[0]], q = [a[0] + ex * iv[1], a[1] + ez * iv[1]];
          var h0 = heightOn(f, p[0], p[1]), h1 = heightOn(f, q[0], q[1]);
          var mat = opt.mat || railMat, hgt = opt.height || railH;
          w.walls.push({ ax: p[0], az: p[1], bx: q[0], bz: q[1], top: Math.max(h0, h1) + hgt, base: Math.min(h0, h1) - 30, h0: h0, h1: h1, height: hgt, thick: opt.thick || 0.12, e: WALL_BOUNCE[mat] || 0.7, mat: mat, soft: false, rail: true });
        });
      }
    });
  }

  // Parameter range [u0, u1] of the segment a + u*(ex, ez), u in [0, 1], that lies inside box r (Liang–Barsky).
  function clipToBox(a, ex, ez, r) {
    var u0 = 0, u1 = 1, p = [-ex, ex, -ez, ez], q = [a[0] - r[0], r[2] - a[0], a[1] - r[1], r[3] - a[1]];
    for (var i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-9) { if (q[i] < 0) return null; continue; }
      var t = q[i] / p[i];
      if (p[i] < 0) { if (t > u0) u0 = t; } else if (t < u1) u1 = t;
      if (u0 > u1) return null;
    }
    return u1 - u0 > 1e-6 ? [u0, u1] : null;
  }

  function subtractInterval(list, lo, hi) {
    var out = [];
    list.forEach(function (iv) {
      if (hi <= iv[0] || lo >= iv[1]) { out.push(iv); return; }
      if (lo > iv[0]) out.push([iv[0], lo]);
      if (hi < iv[1]) out.push([hi, iv[1]]);
    });
    return out;
  }

  function makeWall(a, b, wl) {
    var mat = wl.mat || 'wood';
    var h = wl.h || 0;
    return { ax: a[0], az: a[1], bx: b[0], bz: b[1], top: h + (wl.height == null ? 0.38 : wl.height), base: h - 30, thick: wl.thick == null ? 0.12 : wl.thick, e: wl.e || WALL_BOUNCE[mat] || 0.7, mat: mat, soft: !!wl.soft, visual: wl.visual };
  }

  function heightOn(f, x, z) { return f.h0 + f.gx * (x - f.ox) + f.gz * (z - f.oz); }

  function worldBounds(w) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    w.floors.forEach(function (f) { b[0] = Math.min(b[0], f.bb[0]); b[1] = Math.min(b[1], f.bb[1]); b[2] = Math.max(b[2], f.bb[2]); b[3] = Math.max(b[3], f.bb[3]); });
    w.platforms.forEach(function (p) {
      b[0] = Math.min(b[0], p.ax - p.hw, p.bx - p.hw); b[2] = Math.max(b[2], p.ax + p.hw, p.bx + p.hw);
      b[1] = Math.min(b[1], p.az - p.hd, p.bz - p.hd); b[3] = Math.max(b[3], p.az + p.hd, p.bz + p.hd);
    });
    return b;
  }

  // ---------------------------------------------------------------- time-varying pieces

  function smooth01(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

  /** Moving platform position (centre) and velocity at time t. Eases between the two ends with a pause. */
  function platformAt(p, t) {
    var u = ((t / p.period + p.phase) % 1 + 1) % 1;
    var travel = (1 - 2 * p.pause) / 2; // fraction of the cycle spent moving each way
    var s, ds;
    if (u < p.pause) { s = 0; ds = 0; }
    else if (u < p.pause + travel) { var k = (u - p.pause) / travel; s = smooth01(k); ds = 6 * k * (1 - k) / (travel * p.period); }
    else if (u < 2 * p.pause + travel) { s = 1; ds = 0; }
    else { var k2 = (u - 2 * p.pause - travel) / travel; s = 1 - smooth01(k2); ds = -6 * k2 * (1 - k2) / (travel * p.period); }
    return { x: p.ax + (p.bx - p.ax) * s, z: p.az + (p.bz - p.az) * s, vx: (p.bx - p.ax) * ds, vz: (p.bz - p.az) * ds };
  }

  function sliderAt(s, t) {
    var u = (t / s.period + s.phase) * Math.PI * 2;
    var k = 0.5 - 0.5 * Math.cos(u), dk = 0.5 * Math.sin(u) * Math.PI * 2 / s.period;
    var cx = s.ax + (s.bx - s.ax) * k, cz = s.az + (s.bz - s.az) * k;
    var hx = Math.cos(s.ang) * s.len / 2, hz = Math.sin(s.ang) * s.len / 2;
    return { cx: cx, cz: cz, ax: cx - hx, az: cz - hz, bx: cx + hx, bz: cz + hz, vx: (s.bx - s.ax) * dk, vz: (s.bz - s.az) * dk };
  }

  function spinnerAngle(s, t) { return s.phase + s.w * t; }

  /** 0 = fully open (lowered), 1 = fully closed (raised). */
  function gateClosed(g, t) {
    var u = ((t / g.period + g.phase) % 1 + 1) % 1;
    var ramp = 0.08;
    if (u < g.open) return 0;
    if (u < g.open + ramp) return smooth01((u - g.open) / ramp);
    if (u < 1 - ramp) return 1;
    return 1 - smooth01((u - (1 - ramp)) / ramp);
  }

  /** Everything that moves, for the renderer. */
  function dynamicAt(w, t) {
    return {
      spinners: w.spinners.map(function (s) { return spinnerAngle(s, t); }),
      sliders: w.sliders.map(function (s) { return sliderAt(s, t); }),
      gates: w.gates.map(function (g) { return gateClosed(g, t); }),
      platforms: w.platforms.map(function (p) { return platformAt(p, t); })
    };
  }

  // ---------------------------------------------------------------- floor query

  var _floor = { h: 0, gx: 0, gz: 0, mat: 'grass', plat: -1, pvx: 0, pvz: 0 };

  /** Highest floor under (x, z) that is no higher than yRef + STEP. Returns a shared object (copy if kept). */
  function floorAt(w, x, z, yRef, t) {
    var best = null, bestH = -Infinity, lim = yRef + C.STEP;
    for (var i = 0; i < w.floors.length; i++) {
      var f = w.floors[i], b = f.bb;
      if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) continue;
      var h = heightOn(f, x, z);
      if (h > lim || h <= bestH) continue;
      if (!inPoly(f.poly, x, z)) continue;
      best = f; bestH = h;
    }
    var plat = -1, pv = null;
    for (var j = 0; j < w.platforms.length; j++) {
      var p = w.platforms[j];
      if (p.h > lim || p.h <= bestH) continue;
      var pp = platformAt(p, t);
      if (Math.abs(x - pp.x) <= p.hw && Math.abs(z - pp.z) <= p.hd) { best = p; bestH = p.h; plat = j; pv = pp; }
    }
    if (!best) return null;
    _floor.h = bestH;
    if (plat >= 0) { _floor.gx = 0; _floor.gz = 0; _floor.mat = best.mat; _floor.plat = plat; _floor.pvx = pv.vx; _floor.pvz = pv.vz; }
    else { _floor.gx = best.gx; _floor.gz = best.gz; _floor.mat = best.mat; _floor.plat = -1; _floor.pvx = 0; _floor.pvz = 0; }
    return _floor;
  }

  function inWater(w, x, z) {
    if (!w.water) return false;
    if (!w.water.regions) return true;
    for (var i = 0; i < w.water.regions.length; i++) {
      var r = w.water.regions[i];
      if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- balls

  function newBall(id, x, z, w) {
    var f = floorAt(w, x, z, 50, 0);
    var y = f ? f.h : 0;
    return {
      id: id, x: x, y: y, z: z, vx: 0, vy: 0, vz: 0, r: C.R, rTarget: C.R,
      grounded: true, moving: false, holed: false, vyImp: 0,
      // modifiers set by power-ups
      fric: 1, ghost: false, magnet: false, frozen: false,
      // bookkeeping for the current shot
      shotT: 0, still: 0, bounces: 0, padCd: 0, anchorX: x, anchorZ: z, anchorT: 0,
      safe: { x: x, y: y, z: z },
      lastHit: null
    };
  }

  function shoot(b, dx, dz, speed) {
    var l = Math.hypot(dx, dz);
    if (!(l > 1e-6)) return false;
    speed = clamp(speed, 0, C.MAX_SPEED);
    b.vx = dx / l * speed; b.vz = dz / l * speed; b.vy = 0;
    b.moving = true; b.shotT = 0; b.still = 0; b.bounces = 0;
    b.anchorX = b.x; b.anchorZ = b.z; b.anchorT = 0;
    return true;
  }

  function wake(b) { if (!b.moving && !b.holed) { b.moving = true; b.shotT = 0; b.still = 0; b.anchorX = b.x; b.anchorZ = b.z; b.anchorT = 0; } }

  // Capsule collision against segment a-b moving with velocity (vsx, vsz). Returns impact speed (0 = none).
  function collideSeg(b, ax, az, bx, bz, thick, e, vsx, vsz) {
    var dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    var t = L2 > 0 ? ((b.x - ax) * dx + (b.z - az) * dz) / L2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var px = ax + dx * t, pz = az + dz * t;
    var nx = b.x - px, nz = b.z - pz, rr = b.r + thick, d2 = nx * nx + nz * nz;
    if (d2 >= rr * rr) return 0;
    var d = Math.sqrt(d2);
    if (d < 1e-7) {
      var l = Math.sqrt(L2) || 1; nx = -dz / l; nz = dx / l;
      if (nx * (b.vx - vsx) + nz * (b.vz - vsz) > 0) { nx = -nx; nz = -nz; }
      d = 0;
    } else { nx /= d; nz /= d; }
    b.x += nx * (rr - d); b.z += nz * (rr - d);
    var rvx = b.vx - vsx, rvz = b.vz - vsz, vn = rvx * nx + rvz * nz;
    if (vn >= 0) return 1e-4;
    var tx = rvx - vn * nx, tz = rvz - vn * nz;
    b.vx = tx * 0.97 - vn * e * nx + vsx;
    b.vz = tz * 0.97 - vn * e * nz + vsz;
    return -vn;
  }

  function collideCircle(b, cx, cz, r, e, kick) {
    var nx = b.x - cx, nz = b.z - cz, rr = b.r + r, d2 = nx * nx + nz * nz;
    if (d2 >= rr * rr) return 0;
    var d = Math.sqrt(d2) || 1e-6; nx /= d; nz /= d;
    b.x = cx + nx * rr; b.z = cz + nz * rr;
    var vn = b.vx * nx + b.vz * nz;
    if (vn >= 0) return 1e-4;
    b.vx -= (1 + e) * vn * nx; b.vz -= (1 + e) * vn * nz;
    if (kick) { b.vx += nx * kick; b.vz += nz * kick; }
    return -vn;
  }

  // Wall hits are reported for sound and stats; tiny grazes are ignored.
  function hit(ev, b, kind, mat, s) {
    if (s > 0.6) { b.bounces++; if (ev) ev({ type: kind, id: b.id, mat: mat, s: Math.round(s * 10) / 10, x: b.x, z: b.z, y: b.y }); }
  }

  function vertical(b, top, base) { return b.y < top - 0.02 && b.y + 2 * b.r > base; }

  function collideWorld(w, b, t, ev) {
    var i, s;
    for (i = 0; i < w.walls.length; i++) {
      var wl = w.walls[i];
      if (b.x < wl.x0 || b.x > wl.x1 || b.z < wl.z0 || b.z > wl.z1) continue;
      if (b.ghost && wl.soft) continue;
      // Ledges only block steps taller than a rolling ball can climb (matches floorAt's STEP).
      if (wl.ledge ? b.y >= wl.top - LEDGE_TOL : !vertical(b, wl.top, wl.base)) continue;
      s = collideSeg(b, wl.ax, wl.az, wl.bx, wl.bz, wl.thick, wl.e, 0, 0);
      if (s) hit(ev, b, 'wall', wl.mat, s);
    }
    if (b.ghost) return;
    for (i = 0; i < w.spinners.length; i++) {
      var sp = w.spinners[i];
      if (!vertical(b, sp.top, sp.h - 0.5)) continue;
      var reach = sp.len / 2 + b.r + sp.thick;
      if (Math.abs(b.x - sp.cx) > reach || Math.abs(b.z - sp.cz) > reach) continue;
      var ang = spinnerAngle(sp, t);
      for (var a = 0; a < sp.arms; a++) {
        var th = ang + (a * Math.PI) / sp.arms;
        var hx = Math.cos(th) * sp.len / 2, hz = Math.sin(th) * sp.len / 2;
        // Arm velocity at the contact point: omega x r (approximate with the closest point on the arm).
        var ax = sp.cx - hx, az = sp.cz - hz, bx = sp.cx + hx, bz = sp.cz + hz;
        var dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
        var u = clamp(((b.x - ax) * dx + (b.z - az) * dz) / L2, 0, 1);
        var px = ax + dx * u - sp.cx, pz = az + dz * u - sp.cz;
        s = collideSeg(b, ax, az, bx, bz, sp.thick, sp.e, -sp.w * pz, sp.w * px);
        if (s) hit(ev, b, 'wall', sp.mat, s);
      }
      s = collideCircle(b, sp.cx, sp.cz, sp.hub, 0.6, 0);
      if (s) hit(ev, b, 'wall', sp.mat, s);
    }
    for (i = 0; i < w.sliders.length; i++) {
      var sl = w.sliders[i];
      if (!vertical(b, sl.top, sl.h - 0.5)) continue;
      var so = sliderAt(sl, t);
      s = collideSeg(b, so.ax, so.az, so.bx, so.bz, sl.thick, sl.e, so.vx, so.vz);
      if (s) hit(ev, b, 'wall', sl.mat, s);
    }
    for (i = 0; i < w.gates.length; i++) {
      var g = w.gates[i], k = gateClosed(g, t);
      if (k < 0.05) continue;
      if (!vertical(b, g.h + g.height * k, g.h - 0.5)) continue;
      s = collideSeg(b, g.ax, g.az, g.bx, g.bz, g.thick, g.e, 0, 0);
      if (s) hit(ev, b, 'wall', g.mat, s);
    }
    for (i = 0; i < w.bumpers.length; i++) {
      var bp = w.bumpers[i];
      if (!vertical(b, bp.top, bp.h - 0.5)) continue;
      s = collideCircle(b, bp.x, bp.z, bp.r, bp.e, bp.kick);
      if (s) hit(ev, b, bp.post ? 'wall' : 'bumper', bp.mat, s);
    }
  }

  // Does the straight line from (x0,z0) to (x1,z1) cross a solid wall? (Magnet line of sight.)
  function blocked(w, x0, z0, x1, z1, y) {
    for (var i = 0; i < w.walls.length; i++) {
      var wl = w.walls[i];
      if (wl.ledge || y >= wl.top - 0.02) continue;
      if (segsCross(x0, z0, x1, z1, wl.ax, wl.az, wl.bx, wl.bz)) return true;
    }
    return false;
  }
  function segsCross(ax, az, bx, bz, cx, cz, dx, dz) {
    var d1 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx);
    var d2 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
    var d3 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    var d4 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }

  /** Advance one ball by h seconds. Emits events through ev(e). */
  function stepBall(w, b, t, h, ev) {
    if (b.holed || b.frozen) return;
    if (b.r !== b.rTarget) {
      var dr = b.rTarget - b.r, mxr = h * 0.9;
      b.r += dr > mxr ? mxr : dr < -mxr ? -mxr : dr;
    }
    if (!b.moving) {
      // A resting ball rides platforms and can be shoved by moving obstacles.
      var rf = floorAt(w, b.x, b.z, b.y, t);
      if (rf && rf.plat >= 0) { b.x += rf.pvx * h; b.z += rf.pvz * h; }
      if (!rf) { wake(b); b.grounded = false; }
      var px = b.x, pz = b.z;
      collideWorld(w, b, t, null);
      if (Math.abs(b.x - px) > 1e-6 || Math.abs(b.z - pz) > 1e-6 || b.vx * b.vx + b.vz * b.vz > 0.01) { wake(b); }
      return;
    }
    b.shotT += h;
    if (b.padCd > 0) b.padCd -= h;
    var prevY = b.y;

    if (b.grounded) {
      var f = floorAt(w, b.x, b.z, b.y, t);
      if (!f || f.h < b.y - 0.05) {
        b.grounded = false; b.vy = b.vyImp;
      } else {
        b.y = f.h;
        var gx = f.gx, gz = f.gz, pvx = f.pvx, pvz = f.pvz, plat = f.plat, mat = f.mat;
        // Slope, rim and magnet forces.
        b.vx -= C.ROLL_G * gx * h; b.vz -= C.ROLL_G * gz * h;
        var cdx = w.cup[0] - b.x, cdz = w.cup[1] - b.z, cd = Math.sqrt(cdx * cdx + cdz * cdz);
        if (cd < C.CUP_R + b.r && cd > 1e-4 && Math.abs(b.y - w.cupH) < 0.1) {
          var pull = C.RIM_PULL * (1 - cd / (C.CUP_R + b.r)) + 1.5;
          b.vx += cdx / cd * pull * h; b.vz += cdz / cd * pull * h;
        }
        if (b.magnet && cd < 3.6 && cd > 1e-4 && Math.abs(b.y - w.cupH) < 0.6 && !blocked(w, b.x, b.z, w.cup[0], w.cup[1], b.y)) {
          var mp = 5.5 * (1 - cd / 3.6) + 0.8;
          b.vx += cdx / cd * mp * h; b.vz += cdz / cd * mp * h;
        }
        for (var mi = 0; mi < w.magnets.length; mi++) {
          var mg = w.magnets[mi], mdx = mg.x - b.x, mdz = mg.z - b.z, md = Math.sqrt(mdx * mdx + mdz * mdz);
          if (md < mg.r && md > 0.05) { var mf = mg.k * (1 - md / mg.r); b.vx += mdx / md * mf * h; b.vz += mdz / md * mf * h; }
        }
        // Rolling resistance.
        var sp = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
        var dec = (C.ROLL_DECEL * (FLOOR_FRICTION[mat] || 1) * b.fric + C.DRAG * sp) * h;
        if (sp <= dec) { b.vx = 0; b.vz = 0; sp = 0; }
        else { var k = (sp - dec) / sp; b.vx *= k; b.vz *= k; sp -= dec; }
        var mvx = b.vx + pvx, mvz = b.vz + pvz;
        var ox = b.x, oz = b.z;
        b.x += mvx * h; b.z += mvz * h;
        var expectY = b.y + gx * (b.x - ox) + gz * (b.z - oz);
        var f2 = floorAt(w, b.x, b.z, Math.max(b.y, expectY), t);
        if (!f2 || f2.h < expectY - 0.035) {
          b.grounded = false; b.vy = gx * mvx + gz * mvz; b.vx = mvx; b.vz = mvz;
        } else {
          if (plat >= 0 && f2.plat < 0) { b.vx = mvx; b.vz = mvz; }       // stepped off a platform
          else if (plat < 0 && f2.plat >= 0) { b.vx -= f2.pvx; b.vz -= f2.pvz; } // stepped on
          b.y = f2.h; b.vyImp = f2.gx * b.vx + f2.gz * b.vz;
        }
        // Launch pads.
        if (b.grounded && b.padCd <= 0) {
          for (var pi = 0; pi < w.pads.length; pi++) {
            var pd = w.pads[pi];
            if (Math.abs(b.y - pd.h) < 0.2 && (b.x - pd.x) * (b.x - pd.x) + (b.z - pd.z) * (b.z - pd.z) < pd.r * pd.r) {
              // The pad sets the forward speed but keeps sideways motion, so the line in still matters.
              var lat = b.vx * -pd.dz + b.vz * pd.dx;
              b.vx = pd.dx * pd.speed - pd.dz * lat; b.vz = pd.dz * pd.speed + pd.dx * lat; b.padCd = 0.6;
              if (pd.up) { b.vy = pd.up; b.grounded = false; b.y += 0.01; }
              if (ev) ev({ type: 'pad', id: b.id, x: b.x, z: b.z, y: b.y });
              break;
            }
          }
        }
      }
    } else {
      b.vy -= C.G * h;
      b.x += b.vx * h; b.z += b.vz * h; b.y += b.vy * h;
      var lf = floorAt(w, b.x, b.z, prevY, t);
      // Landing: a ball that comes down onto a floor (or catches its edge by less than a ledge) lands on it.
      if (lf && b.y <= lf.h && b.y >= lf.h - LEDGE_TOL && b.vy <= 0) {
        var impact = -b.vy;
        b.y = lf.h;
        if (lf.plat >= 0) { b.vx -= lf.pvx; b.vz -= lf.pvz; }
        if (impact > 3.2) { b.vy = impact * 0.32; b.vx *= 0.93; b.vz *= 0.93; b.y += 0.001; }
        else { b.vy = 0; b.grounded = true; b.vyImp = lf.gx * b.vx + lf.gz * b.vz; }
        if (impact > 1.5 && ev) ev({ type: 'land', id: b.id, s: Math.round(impact * 10) / 10, mat: lf.mat, x: b.x, z: b.z, y: b.y });
      }
    }

    // Clamp absurd speeds.
    var s2 = b.vx * b.vx + b.vz * b.vz;
    if (s2 > C.MAX_SPEED * C.MAX_SPEED) { var kk = C.MAX_SPEED / Math.sqrt(s2); b.vx *= kk; b.vz *= kk; }
    if (b.vy > 14) b.vy = 14;

    collideWorld(w, b, t, ev);

    // Hazards.
    if (b.y < (w.water ? w.water.level : -0.6) && w.water && inWater(w, b.x, b.z)) { b.moving = false; if (ev) ev({ type: 'water', id: b.id, x: b.x, z: b.z }); return 'water'; }
    if (b.y < w.oobY) { b.moving = false; if (ev) ev({ type: 'oob', id: b.id, x: b.x, z: b.z }); return 'oob'; }

    // Cup.
    var ddx = b.x - w.cup[0], ddz = b.z - w.cup[1], dd = Math.sqrt(ddx * ddx + ddz * ddz);
    if (dd < C.CUP_R && Math.abs(b.y - w.cupH) < 0.12) {
      var spd = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
      var lim = (dd < C.CUP_R * 0.55 ? C.CAPTURE_SPEED_CENTER : C.CAPTURE_SPEED) * (b.r > C.R * 1.2 ? 0.8 : 1);
      if (spd < lim) {
        b.holed = true; b.moving = false; b.vx = b.vz = b.vy = 0;
        if (ev) ev({ type: 'cup', id: b.id, x: w.cup[0], z: w.cup[1], y: w.cupH });
        return 'cup';
      } else if (!b.lipped) {
        // Lip out: the ball hops the far edge and loses some pace.
        b.lipped = true; b.vx *= 0.82; b.vz *= 0.82; b.vy = Math.min(2.2, spd * 0.12); b.grounded = false; b.y += 0.005;
        if (ev) ev({ type: 'lip', id: b.id, x: b.x, z: b.z });
      }
    } else if (dd > C.CUP_R + 0.2) b.lipped = false;

    // Settling.
    if (b.grounded) {
      var sp3 = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
      var fs = floorAt(w, b.x, b.z, b.y, t);
      var grade = fs ? Math.sqrt(fs.gx * fs.gx + fs.gz * fs.gz) : 1;
      var nearCup = dd < C.CUP_R + b.r + 0.05;
      if (sp3 < C.STOP_SPEED && grade < C.STATIC_GRADE && !nearCup && !(b.magnet && dd < 3.6)) return settle(b, ev);
      if (sp3 < 0.04) { b.still += h; if (b.still > 0.6 && !nearCup) return settle(b, ev); } else b.still = 0;
    }
    // Stuck: hardly moved for a while (e.g. wedged between obstacles), or rolled too long.
    b.anchorT += h;
    if (b.anchorT > C.STUCK_TIME) {
      var adx = b.x - b.anchorX, adz = b.z - b.anchorZ;
      if (adx * adx + adz * adz < 0.09 && b.grounded) return settle(b, ev);
      b.anchorX = b.x; b.anchorZ = b.z; b.anchorT = 0;
    }
    if (b.shotT > C.MAX_SHOT_TIME && b.grounded) return settle(b, ev);
    return null;
  }

  function settle(b, ev) {
    b.vx = b.vz = b.vy = 0; b.moving = false; b.still = 0;
    if (ev) ev({ type: 'stop', id: b.id, x: b.x, z: b.z });
    return 'stop';
  }

  function collideBalls(a, b, ev) {
    if (a.holed || b.holed || a.ghost || b.ghost || a.frozen || b.frozen || a.solo || b.solo) return;
    if (Math.abs(a.y - b.y) > Math.min(a.r, b.r)) return;
    var nx = b.x - a.x, nz = b.z - a.z, rr = a.r + b.r, d2 = nx * nx + nz * nz;
    if (d2 >= rr * rr) return;
    var d = Math.sqrt(d2);
    if (d < 1e-6) { nx = 1; nz = 0; d = 0; } else { nx /= d; nz /= d; }
    // Mass ~ r^3, so a giant ball shoves a normal one.
    var ma = a.r * a.r * a.r, mb = b.r * b.r * b.r, sum = ma + mb;
    var push = rr - d;
    a.x -= nx * push * (mb / sum); a.z -= nz * push * (mb / sum);
    b.x += nx * push * (ma / sum); b.z += nz * push * (ma / sum);
    var rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (rv < 0) {
      var j = -(1 + 0.9) * rv / (1 / ma + 1 / mb);
      a.vx -= j / ma * nx; a.vz -= j / ma * nz;
      b.vx += j / mb * nx; b.vz += j / mb * nz;
      wake(a); wake(b);
      a.lastHit = b.id; b.lastHit = a.id;
      if (ev && -rv > 0.5) ev({ type: 'ball', id: a.id, other: b.id, s: Math.round(-rv * 10) / 10, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, y: a.y });
    } else if (push > 0.01) { wake(a); wake(b); }
  }

  /**
   * Advance a set of balls by dt (normally one tick). Sub-steps so no ball moves more than a third of its
   * radius per step, which keeps ordinary shots from tunnelling through walls.
   * Returns a list of { id, result } for balls that stopped, holed, or hit a hazard this tick.
   */
  function stepWorld(w, balls, t, dt, opts) {
    var ev = opts && opts.onEvent, collide = !(opts && opts.collide === false);
    var out = [];
    var steps = Math.max(1, Math.round(dt / C.DT));
    var h = dt / steps;
    for (var s = 0; s < steps; s++) {
      var maxV = 0, minR = C.R;
      for (var i = 0; i < balls.length; i++) {
        var b = balls[i];
        if (!b.moving) continue;
        var v = Math.sqrt(b.vx * b.vx + b.vz * b.vz + b.vy * b.vy);
        if (v > maxV) maxV = v;
        if (b.r < minR) minR = b.r;
      }
      var sub = clamp(Math.ceil((maxV * h) / (0.33 * minR)), 1, 24);
      var hh = h / sub;
      for (var k = 0; k < sub; k++) {
        var tt = t + s * h + k * hh;
        for (i = 0; i < balls.length; i++) {
          var r = stepBall(w, balls[i], tt, hh, ev);
          if (r) out.push({ id: balls[i].id, result: r });
        }
        if (collide) {
          for (i = 0; i < balls.length; i++) for (var j = i + 1; j < balls.length; j++) {
            if (balls[i].moving || balls[j].moving) collideBalls(balls[i], balls[j], ev);
          }
        }
      }
    }
    return out;
  }

  /** Simulate a shot from a copy of ball b (other balls ignored). Returns { points: [[x,y,z]...], result }. */
  function predict(w, b, dx, dz, speed, t0, opts) {
    var maxT = (opts && opts.maxT) || 3, every = (opts && opts.every) || 1 / 30;
    var c = {};
    for (var k in b) c[k] = b[k];
    c.safe = null; c.id = '_pred'; c.lipped = false;
    shoot(c, dx, dz, speed);
    var pts = [[c.x, c.y, c.z]], t = 0, next = every, result = null, bounces = 0;
    var maxB = (opts && opts.maxBounces) || 99;
    var ev = function (e) { if (e.type === 'wall' || e.type === 'bumper') bounces++; };
    while (t < maxT) {
      var r = stepWorld(w, [c], t0 + t, C.DT, { onEvent: ev, collide: false });
      t += C.DT;
      if (t >= next) { pts.push([c.x, c.y, c.z]); next += every; }
      if (r.length) { result = r[0].result; pts.push([c.x, c.y, c.z]); break; }
      if (bounces >= maxB) { pts.push([c.x, c.y, c.z]); result = 'bounce'; break; }
    }
    return { points: pts, result: result, ball: c };
  }

  /** Map a 0..1 aim power to a launch speed. */
  function shotSpeed(power, strength) {
    power = clamp(power, 0, 1);
    return C.MIN_SHOT + Math.pow(power, 1.25) * (C.MAX_SHOT * (strength || 1) - C.MIN_SHOT);
  }

  return {
    C: C, FLOOR_FRICTION: FLOOR_FRICTION, WALL_BOUNCE: WALL_BOUNCE,
    compileHole: compileHole, floorAt: floorAt, newBall: newBall, shoot: shoot, wake: wake,
    stepBall: stepBall, stepWorld: stepWorld, predict: predict, shotSpeed: shotSpeed,
    dynamicAt: dynamicAt, platformAt: platformAt, sliderAt: sliderAt, spinnerAngle: spinnerAngle, gateClosed: gateClosed,
    inPoly: inPoly, heightOn: heightOn, blocked: blocked, clamp: clamp
  };
});
