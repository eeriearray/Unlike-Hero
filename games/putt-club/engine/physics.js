/* Putt Club — physics.
 *
 * Two halves:
 *  1. Course geometry (pure JS): compileHole turns hole data into floors, rails, obstacles and hazards,
 *     plus fast queries (floorAt, blocked) used by bots, the renderer and the rules.
 *  2. Simulation on Rapier (rigid-body physics, WASM): createSim builds a Rapier world from a compiled hole
 *     and stepSim advances it at a fixed 1/120 s step. The same engine runs on the server (authoritative),
 *     in the browser (trajectory preview, own-ball prediction, offline practice) and in the tests.
 *
 * Loads as CommonJS in Node (Rapier from node_modules) and as a classic <script> in the browser
 * (window.PuttPhysics, with Rapier from vendor/rapier.js as window.RAPIER). Call init() once before simulating.
 * Units: the ball radius is 0.22; a typical hole is 20–40 units long. A ball's y is its contact height.
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
    DT: 1 / 120,           // base fixed step
    STEP: 0.16,            // floorAt: floors up to this far above the query height count as "under" it
    MAX_SPEED: 30,         // hard velocity clamp (prevents explosions)
    MAX_SHOT: 15,          // full-power shot speed at strength 1.0
    MIN_SHOT: 0.6,
    ROLL_DECEL: 1.35,      // light rolling resistance; Rapier already models ball/surface friction
    ROLL_SOFT: 0.35,       // below about this speed rolling resistance fades into a smooth stop
    DRAG: 0.06,            // small speed-proportional drag
    STOP_SPEED: 0.2,
    STATIC_GRADE: 0.04,    // slopes gentler than this hold a slow ball still
    CAPTURE_SPEED: 8.0,    // slower than this over the cup drops in
    CAPTURE_SPEED_CENTER: 9.0,
    RIM_PULL: 8,
    MAGNET_GAIN: 4,        // course magnets (attract and repel) pull this many times their listed strength
    BUMPER_MIN_OUT: 3.2,   // a springy bumper sends the ball off at least kick x this along its normal
    MAX_SHOT_TIME: 22,     // seconds before a rolling ball is forced to settle
    STUCK_TIME: 3.5,
    VOID_Y: -5
  };

  // Friction multiplier and bounce per material.
  var FLOOR_FRICTION = { grass: 1, felt: 1, stone: 0.95, wood: 0.9, bridge: 0.95, sand: 5.5, metal: 0.92, glass: 0.88, brass: 0.9, tile: 0.95, carpet: 1.1, pad: 1 };
  var WALL_BOUNCE = { wood: 0.7, stone: 0.62, metal: 0.8, brass: 0.78, glass: 0.82, rope: 0.45, hedge: 0.5, bumper: 1.25, neon: 0.85, rubber: 0.9 };

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
            var lo = Math.max(0, Math.min(u1, u2)), hi = Math.min(1, Math.max(u1, u2));
            if (hi <= 1e-4 || lo >= 1 - 1e-4) continue;
            // Only where the two floors meet level is the edge open. Where they meet at a step (a ramp
            // running beside a deck), keep the rail: otherwise the step is an invisible, unmarked wall.
            var parts = Math.max(1, Math.ceil((hi - lo) * L / 0.25));
            for (var pi2 = 0; pi2 < parts; pi2++) {
              var p0 = lo + (hi - lo) * pi2 / parts, p1 = lo + (hi - lo) * (pi2 + 1) / parts, um = (p0 + p1) / 2;
              var mxq = a[0] + ex * um, mzq = a[1] + ez * um;
              if (Math.abs(heightOn(f, mxq, mzq) - heightOn(g, mxq, mzq)) < 0.06) keep = subtractInterval(keep, p0, p1);
            }
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
          w.walls.push({ ax: p[0], az: p[1], bx: q[0], bz: q[1], top: Math.max(h0, h1) + hgt, base: Math.min(h0, h1) - 30, h0: h0, h1: h1, height: hgt, thick: opt.thick || 0.15, e: WALL_BOUNCE[mat] || 0.7, mat: mat, soft: false, rail: true });
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

  // ---------------------------------------------------------------- Rapier simulation
  //
  // Every hole becomes a Rapier world: floors are solid convex slabs, rails and walls are boxes with round
  // posts at their joints, spinners/sliders/gates/platforms are kinematic bodies driven by the hole clock,
  // and each ball is a dynamic sphere with continuous collision detection. On top of the rigid-body solver
  // we add only real forces: rolling resistance per surface, magnets, the cup's rim, launch pads and bumper
  // kicks. Collision groups implement Ghost Shot (passes soft obstacles and balls) and tee balls (no ball
  // contact until their first shot).

  var R = null; // the RAPIER module once loaded
  var G_STATIC = 1, G_SOFT = 2, G_BALL = 4;
  function groups(member, filter) { return (member << 16) | filter; }
  var BALL_GROUPS = groups(G_BALL, G_STATIC | G_SOFT | G_BALL);
  var SOLO_GROUPS = groups(G_BALL, G_STATIC | G_SOFT);
  var GHOST_GROUPS = groups(G_BALL, G_STATIC);

  /** Load the physics engine (WASM). Resolves when the simulation can be used. */
  var initPromise = null;
  function init() {
    if (initPromise) return initPromise;
    var mod = null;
    if (typeof module === 'object' && module.exports && typeof require === 'function') {
      try { mod = require('@dimforge/rapier3d-compat'); } catch (e) { mod = null; }
    }
    if (!mod && typeof self !== 'undefined') mod = self.RAPIER;
    if (!mod) return (initPromise = Promise.reject(new Error('Rapier physics engine not found')));
    // Rapier's own WASM loader prints a deprecation notice about its internal call; keep the console clean.
    var warn = console.warn;
    console.warn = function (m) { if (!/deprecated parameters for the initialization/.test(String(m))) warn.apply(console, arguments); };
    initPromise = Promise.resolve(mod.init()).then(function () { console.warn = warn; R = mod; api.ready = true; return mod; }, function (e) { console.warn = warn; throw e; });
    return initPromise;
  }

  function quatY(a) { return { x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) }; }
  /** Quaternion that turns local +x toward direction (dx, dy, dz) and keeps local +y as close to up as possible. */
  function quatAlong(dx, dy, dz) {
    var l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    var yaw = Math.atan2(-dz, dx), pitch = Math.asin(clamp(dy, -1, 1));
    var cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
    // q = yaw(about y) * pitch(about z)
    return { x: sy * sp, y: sy * cp, z: cy * sp, w: cy * cp };
  }


  /**
   * Weld every floor into one mesh. Each outline is split wherever another floor's corner lies on it, so
   * neighbouring triangles share exact vertices along every join; tops are fanned from the centroid (all
   * floors are convex). Side faces are added only where no same-height floor continues past the edge.
   */
  function floorMesh(w) {
    var pieces = w.floors.filter(function (f) { return !f.overlay; });
    var verts = [], index = {}, tris = [];
    // Every triangle wound so its normal faces up (tops) or outward (sides): Rapier's internal-edge fix needs it.
    function tri(a, b, c, nx, ny, nz) {
      var ax = verts[a * 3], ay = verts[a * 3 + 1], az = verts[a * 3 + 2];
      var ux = verts[b * 3] - ax, uy = verts[b * 3 + 1] - ay, uz = verts[b * 3 + 2] - az;
      var vx = verts[c * 3] - ax, vy = verts[c * 3 + 1] - ay, vz = verts[c * 3 + 2] - az;
      var cx2 = uy * vz - uz * vy, cy2 = uz * vx - ux * vz, cz2 = ux * vy - uy * vx;
      if (cx2 * cx2 + cy2 * cy2 + cz2 * cz2 < 1e-12) return;
      if (cx2 * nx + cy2 * ny + cz2 * nz < 0) tris.push(a, c, b); else tris.push(a, b, c);
    }
    function vid(x, y, z) {
      var k = Math.round(x * 1000) + ',' + Math.round(y * 1000) + ',' + Math.round(z * 1000);
      if (index[k] == null) { index[k] = verts.length / 3; verts.push(x, y, z); }
      return index[k];
    }
    pieces.forEach(function (f) {
      var thin = f.mat === 'bridge' || f.mat === 'glass', depth = thin ? 0.16 : 0.8;
      var poly = f.poly, n = poly.length, ring = [];
      for (var i = 0; i < n; i++) {
        var a = poly[i], b = poly[(i + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez;
        ring.push(a);
        if (L2 < 1e-10) continue;
        var extra = [];
        pieces.forEach(function (g) {
          if (g === f) return;
          g.poly.forEach(function (q) {
            var u = ((q[0] - a[0]) * ex + (q[1] - a[1]) * ez) / L2;
            if (u <= 1e-4 || u >= 1 - 1e-4) return;
            var cr = Math.abs(ex * (q[1] - a[1]) - ez * (q[0] - a[0])) / Math.sqrt(L2);
            if (cr < 1e-3) extra.push(u);
          });
        });
        extra.sort(function (x, y) { return x - y; });
        var last = 0;
        extra.forEach(function (u) { if (u - last > 1e-4) { ring.push([a[0] + ex * u, a[1] + ez * u]); last = u; } });
      }
      var cx = 0, cz = 0;
      poly.forEach(function (q) { cx += q[0]; cz += q[1]; });
      cx /= n; cz /= n;
      var c = vid(cx, heightOn(f, cx, cz), cz), m = ring.length;
      var ccw = polyArea(ring) > 0;
      for (var j = 0; j < m; j++) {
        var p0 = ring[j], p1 = ring[(j + 1) % m];
        var i0 = vid(p0[0], heightOn(f, p0[0], p0[1]), p0[1]), i1 = vid(p1[0], heightOn(f, p1[0], p1[1]), p1[1]);
        tri(c, i0, i1, 0, 1, 0);
        // Side face unless another floor carries on at the same height just past this edge.
        var mxp = (p0[0] + p1[0]) / 2, mzp = (p0[1] + p1[1]) / 2, ex2 = p1[0] - p0[0], ez2 = p1[1] - p0[1], el = Math.hypot(ex2, ez2) || 1;
        var nx = ez2 / el, nz = -ex2 / el;
        if (!ccw) { nx = -nx; nz = -nz; }
        var hm = heightOn(f, mxp, mzp), joined = false;
        for (var k = 0; k < pieces.length && !joined; k++) {
          var g = pieces[k];
          if (g === f) continue;
          var px = mxp + nx * 0.03, pz = mzp + nz * 0.03;
          if (px < g.bb[0] || px > g.bb[2] || pz < g.bb[1] || pz > g.bb[3] || !inPoly(g.poly, px, pz)) continue;
          if (Math.abs(heightOn(g, px, pz) - hm) < 0.03) joined = true;
        }
        if (joined) continue;
        var b0 = vid(p0[0], heightOn(f, p0[0], p0[1]) - depth, p0[1]), b1 = vid(p1[0], heightOn(f, p1[0], p1[1]) - depth, p1[1]);
        tri(i0, b0, b1, nx, 0, nz); tri(i0, b1, i1, nx, 0, nz);
      }
    });
    return { vertices: new Float32Array(verts), indices: new Uint32Array(tris) };
  }

  function polyArea(poly) { var s2 = 0; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) s2 += (poly[j][0] - poly[i][0]) * (poly[j][1] + poly[i][1]); return s2 / 2; }

  function floorPrism(f, depth) {
    var v = [];
    f.poly.forEach(function (p) { var h = heightOn(f, p[0], p[1]); v.push(p[0], h, p[1]); v.push(p[0], h - depth, p[1]); });
    return new Float32Array(v);
  }

  /** Build the Rapier world for a compiled hole. */
  function createSim(w) {
    if (!R) throw new Error('call PuttPhysics.init() first');
    var world = new R.World({ x: 0, y: -C.G, z: 0 });
    world.timestep = C.DT;
    var sim = { w: w, world: world, balls: [], byHandle: {}, info: {}, kin: [], t: 0, events: new R.EventQueue(true) };
    function tag(col, info) { sim.info[col.handle] = info; return col; }

    // Floors: one welded triangle mesh for every playing surface, with Rapier's internal-edge fix, so a ball
    // rolls across joins between pieces without catching on them. Sides only where there is a real drop.
    var mesh = floorMesh(w);
    if (mesh.indices.length) {
      var fd = R.ColliderDesc.trimesh(mesh.vertices, mesh.indices, R.TriMeshFlags.FIX_INTERNAL_EDGES)
        .setFriction(0.9).setRestitution(0.05).setCollisionGroups(groups(G_STATIC, G_BALL));
      tag(world.createCollider(fd), { kind: 'floor', mat: 'grass' });
    }
    // Rails and walls: boxes from the floor up to their top, with a round post at each end.
    var posts = {};
    w.walls.forEach(function (wl) {
      if (wl.ledge) return;
      var ex = wl.bx - wl.ax, ez = wl.bz - wl.az, L = Math.hypot(ex, ez);
      if (L < 1e-4) return;
      var h0 = wl.rail ? wl.h0 : wl.top - 0.6, h1 = wl.rail ? wl.h1 : wl.top - 0.6;
      var hgt = wl.rail ? wl.height : 0.6;
      if (!wl.rail) { var fb = floorAt(w, (wl.ax + wl.bx) / 2, (wl.az + wl.bz) / 2, 50, 0); h0 = h1 = fb ? fb.h : 0; hgt = wl.top - h0; }
      var below = 0.5, half = (hgt + below) / 2;
      var cyM = (h0 + h1) / 2 + hgt - half;
      var d = R.ColliderDesc.cuboid(Math.hypot(L, h1 - h0) / 2, half, Math.max(0.04, wl.thick))
        .setTranslation((wl.ax + wl.bx) / 2, cyM, (wl.az + wl.bz) / 2)
        .setRotation(quatAlong(ex, h1 - h0, ez))
        .setFriction(0.02).setFrictionCombineRule(R.CoefficientCombineRule.Min).setRestitution(wl.e).setRestitutionCombineRule(R.CoefficientCombineRule.Max)
        .setCollisionGroups(groups(wl.soft ? G_SOFT : G_STATIC, G_BALL)).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
      tag(world.createCollider(d), { kind: 'wall', mat: wl.mat, soft: wl.soft });
      [[wl.ax, wl.az, h0], [wl.bx, wl.bz, h1]].forEach(function (p) {
        var key = Math.round(p[0] * 50) + ',' + Math.round(p[1] * 50) + (wl.soft ? 's' : '');
        if (posts[key]) return;
        posts[key] = 1;
        var pd = R.ColliderDesc.cylinder(half, Math.max(0.04, wl.thick)).setTranslation(p[0], p[2] + hgt - half, p[1])
          .setFriction(0.02).setFrictionCombineRule(R.CoefficientCombineRule.Min).setRestitution(wl.e).setRestitutionCombineRule(R.CoefficientCombineRule.Max)
          .setCollisionGroups(groups(wl.soft ? G_SOFT : G_STATIC, G_BALL)).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
        tag(world.createCollider(pd), { kind: 'wall', mat: wl.mat, soft: wl.soft });
      });
    });
    // Bumpers: round posts; springy ones add a kick when hit.
    w.bumpers.forEach(function (b) {
      var half = (b.top - b.h + 0.4) / 2;
      var d = R.ColliderDesc.cylinder(half, b.r).setTranslation(b.x, b.top - half, b.z)
        .setFriction(0.02).setFrictionCombineRule(R.CoefficientCombineRule.Min).setRestitution(b.post ? 0.6 : 0.95).setRestitutionCombineRule(R.CoefficientCombineRule.Max)
        .setCollisionGroups(groups(b.soft ? G_SOFT : G_STATIC, G_BALL)).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
      tag(world.createCollider(d), { kind: b.post ? 'wall' : 'bumper', mat: b.mat, bumper: b });
    });
    // Moving pieces are kinematic bodies posed from the hole clock every step.
    w.spinners.forEach(function (s) {
      var body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(s.cx, s.h, s.cz));
      var half = (s.top - s.h + 0.3) / 2;
      for (var a = 0; a < s.arms; a++) {
        var d = R.ColliderDesc.cuboid(s.len / 2, half, s.thick).setTranslation(0, s.top - s.h - half, 0).setRotation(quatY(-(a * Math.PI) / s.arms))
          .setFriction(0.02).setFrictionCombineRule(R.CoefficientCombineRule.Min).setRestitution(s.e).setRestitutionCombineRule(R.CoefficientCombineRule.Max)
          .setCollisionGroups(groups(G_SOFT, G_BALL)).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
        tag(world.createCollider(d, body), { kind: 'wall', mat: s.mat, soft: true });
      }
      tag(world.createCollider(R.ColliderDesc.cylinder(half, s.hub).setTranslation(0, s.top - s.h - half, 0).setRestitution(0.6)
        .setCollisionGroups(groups(G_SOFT, G_BALL)).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS), body), { kind: 'wall', mat: s.mat, soft: true });
      sim.kin.push({ body: body, pose: function (t) { return { p: { x: s.cx, y: s.h, z: s.cz }, q: quatY(-spinnerAngle(s, t)) }; } });
    });
    w.sliders.forEach(function (s) {
      var half = (s.top - s.h + 0.3) / 2;
      var body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
      tag(world.createCollider(R.ColliderDesc.cuboid(s.len / 2, half, s.thick).setFriction(0.02).setFrictionCombineRule(R.CoefficientCombineRule.Min).setRestitution(s.e).setRestitutionCombineRule(R.CoefficientCombineRule.Max)
        .setCollisionGroups(groups(G_SOFT, G_BALL)).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS), body), { kind: 'wall', mat: s.mat, soft: true });
      sim.kin.push({ body: body, pose: function (t) { var o = sliderAt(s, t); return { p: { x: o.cx, y: s.top - half, z: o.cz }, q: quatY(-s.ang) }; } });
    });
    w.gates.forEach(function (g) {
      var L = Math.hypot(g.bx - g.ax, g.bz - g.az), ang = Math.atan2(g.bz - g.az, g.bx - g.ax);
      var body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
      tag(world.createCollider(R.ColliderDesc.cuboid(L / 2, g.height / 2, g.thick).setFriction(0.02).setFrictionCombineRule(R.CoefficientCombineRule.Min).setRestitution(g.e).setRestitutionCombineRule(R.CoefficientCombineRule.Max)
        .setCollisionGroups(groups(G_SOFT, G_BALL)).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS), body), { kind: 'wall', mat: g.mat, soft: true });
      // Lowered gates sink into the floor slab (kinematic bodies don't collide with fixed floors).
      sim.kin.push({ body: body, pose: function (t) { return { p: { x: (g.ax + g.bx) / 2, y: g.h - g.height / 2 + g.height * gateClosed(g, t) - 0.01, z: (g.az + g.bz) / 2 }, q: quatY(-ang) }; } });
    });
    w.platforms.forEach(function (p, pi) {
      var body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
      tag(world.createCollider(R.ColliderDesc.cuboid(p.hw, 0.15, p.hd).setFriction(1.0).setRestitution(0.05)
        .setCollisionGroups(groups(G_STATIC, G_BALL)), body), { kind: 'floor', mat: p.mat });
      sim.kin.push({ body: body, plat: pi, pose: function (t) { var o = platformAt(p, t); return { p: { x: o.x, y: p.h - 0.15, z: o.z }, q: { x: 0, y: 0, z: 0, w: 1 } }; } });
    });
    poseKinematics(sim, 0, true);
    return sim;
  }

  function poseKinematics(sim, t, teleport) {
    for (var i = 0; i < sim.kin.length; i++) {
      var k = sim.kin[i], pose = k.pose(t);
      if (teleport) { k.body.setTranslation(pose.p, true); k.body.setRotation(pose.q, true); }
      else { k.body.setNextKinematicTranslation(pose.p); k.body.setNextKinematicRotation(pose.q); }
    }
  }

  function freeSim(sim) { if (sim && sim.world) { sim.events.free(); sim.world.free(); sim.world = null; } }

  // ---------------------------------------------------------------- balls

  /** Add a ball resting at (x, z). The returned object mirrors the body after every step. */
  function addBall(sim, id, x, z) {
    var w = sim.w, f = floorAt(w, x, z, 50, 0), y = f ? f.h : 0;
    var body = sim.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, y + C.R, z).setCcdEnabled(true).setAngularDamping(0.6).setCanSleep(true));
    var col = sim.world.createCollider(R.ColliderDesc.ball(C.R).setDensity(1).setFriction(0.9).setRestitution(0.55)
      .setCollisionGroups(BALL_GROUPS).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS), body);
    var b = {
      id: id, x: x, y: y, z: z, vx: 0, vy: 0, vz: 0, r: C.R, rTarget: C.R,
      grounded: true, moving: false, holed: false,
      fric: 1, ghost: false, magnet: false, frozen: false, solo: false,
      shotT: 0, still: 0, bounces: 0, padCd: 0, anchorX: x, anchorZ: z, anchorT: 0, lipped: false,
      safe: { x: x, y: y, z: z }, body: body, col: col, groups: BALL_GROUPS, wasFrozen: false, ride: -1, sim: sim
    };
    sim.info[col.handle] = { kind: 'ball', ball: b };
    sim.balls.push(b);
    body.sleep();
    if (f && f.plat >= 0) startRide(b, f.plat, 0);
    return b;
  }

  // A ball at rest on a moving platform sits on it as a kinematic passenger until it is shot or knocked.
  function startRide(b, plat, t) {
    var p = platformAt(b.sim.w.platforms[plat], t);
    b.ride = plat; b.rideOff = { x: b.x - p.x, z: b.z - p.z };
    b.body.setBodyType(R.RigidBodyType.KinematicPositionBased, true);
  }
  function stopRide(b) {
    if (b.ride < 0 || !b.body) return;
    b.ride = -1;
    b.body.setBodyType(R.RigidBodyType.Dynamic, true);
  }

  function removeBall(sim, b) {
    var i = sim.balls.indexOf(b);
    if (i >= 0) sim.balls.splice(i, 1);
    if (sim.world && b.body) sim.world.removeRigidBody(b.body);
    b.body = null;
  }

  /** Teleport a ball (hazard return, reset, swap) and stop it. */
  function place(b, x, y, z) {
    stopRide(b);
    b.x = x; b.y = y; b.z = z; b.vx = b.vy = b.vz = 0; b.hazard = false;
    b.moving = false; b.grounded = true; b.still = 0;
    if (b.body) {
      b.body.setTranslation({ x: x, y: y + b.r, z: z }, true);
      b.body.setLinvel({ x: 0, y: 0, z: 0 }, true); b.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      b.body.sleep();
    }
  }

  function shoot(b, dx, dz, speed) {
    var l = Math.hypot(dx, dz);
    if (!(l > 1e-6)) return false;
    speed = clamp(speed, 0, C.MAX_SPEED);
    b.vx = dx / l * speed; b.vz = dz / l * speed; b.vy = 0;
    stopRide(b);
    if (b.body) {
      b.body.wakeUp();
      b.body.setLinvel({ x: b.vx, y: 0, z: b.vz }, true);
      // Start it rolling (no skid): spin matches the launch speed.
      b.body.setAngvel({ x: b.vz / b.r, y: 0, z: -b.vx / b.r }, true);
    }
    b.moving = true; b.shotT = 0; b.still = 0; b.bounces = 0; b.lipped = false;
    b.anchorX = b.x; b.anchorZ = b.z; b.anchorT = 0;
    return true;
  }

  /** Add velocity (gusts). */
  function push(b, vx, vz) {
    wake(b);
    if (b.body && !b.frozen) { var v = b.body.linvel(); b.body.setLinvel({ x: v.x + vx, y: v.y, z: v.z + vz }, true); }
    b.vx += vx; b.vz += vz;
  }

  function wake(b) {
    if (b.holed) return;
    stopRide(b);
    if (!b.moving) { b.moving = true; b.shotT = 0; b.still = 0; b.anchorX = b.x; b.anchorZ = b.z; b.anchorT = 0; }
    if (b.body) b.body.wakeUp();
  }

  /** Push the ball's power-up modifiers (size, ghost, frozen, tee) into Rapier. */
  function syncMods(b, h) {
    var body = b.body;
    if (!body) return;
    if (b.r !== b.rTarget) {
      var dr = b.rTarget - b.r, m = h * 0.9;
      b.r += dr > m ? m : dr < -m ? -m : dr;
      b.col.setRadius(b.r);
      body.wakeUp();
    }
    var g = b.ghost ? GHOST_GROUPS : b.solo ? SOLO_GROUPS : BALL_GROUPS;
    if (g !== b.groups) { b.groups = g; b.col.setCollisionGroups(g); }
    if (b.ride >= 0) return;
    if (b.frozen && !b.wasFrozen) {
      b.saved = { v: body.linvel(), w: body.angvel() };
      body.setBodyType(R.RigidBodyType.Fixed, false);
      b.wasFrozen = true;
    } else if (!b.frozen && b.wasFrozen) {
      body.setBodyType(R.RigidBodyType.Dynamic, true);
      if (b.saved) { body.setLinvel(b.saved.v, true); body.setAngvel(b.saved.w, true); }
      b.wasFrozen = false;
    }
  }

  function inCupZone(w, b) { var dx = b.x - w.cup[0], dz = b.z - w.cup[1]; return Math.sqrt(dx * dx + dz * dz); }

  /** Forces we add on top of the solver for one ball, before a step of h seconds. */
  function applyForces(sim, b, t, h, ev) {
    var w = sim.w, body = b.body;
    if (b.holed || b.frozen || !body || body.isSleeping()) return;
    var v = body.linvel(), m = body.mass();
    var f = floorAt(w, b.x, b.z, b.y + 0.05, t);
    b.grounded = !!f && b.y - f.h < 0.06 && Math.abs(v.y) < 1.5;
    var ix = 0, iz = 0;
    if (b.grounded) {
      // A small, smooth rolling resistance supplements Rapier's contact friction. Keep it independent
      // of the local grade: gravity supplies the uphill/downhill acceleration, and a grade-based brake
      // here made balls lose speed abruptly where ramps meet flat floor pieces.
      var rvx = v.x - f.pvx, rvz = v.z - f.pvz, sp = Math.sqrt(rvx * rvx + rvz * rvz);
      if (sp > 1e-4) {
        var full = C.ROLL_DECEL * (FLOOR_FRICTION[f.mat] || 1) * b.fric;
        var roll = full * sp / (sp + C.ROLL_SOFT);
        var dec = Math.min(sp, (roll + C.DRAG * sp) * h);
        ix -= rvx / sp * dec; iz -= rvz / sp * dec;
      }
      var cd = inCupZone(w, b), cdx = w.cup[0] - b.x, cdz = w.cup[1] - b.z;
      // The cup's lip slopes in: a ball grazing the rim curls toward the hole.
      if (cd < C.CUP_R + b.r + 0.1 && cd > 1e-4 && Math.abs(b.y - w.cupH) < 0.1) {
        var pull = C.RIM_PULL * (1 - cd / (C.CUP_R + b.r + 0.1)) + 1.5;
        ix += cdx / cd * pull * h; iz += cdz / cd * pull * h;
      }
      if (b.magnet && cd < 3.6 && cd > 1e-4 && Math.abs(b.y - w.cupH) < 0.6 && !blocked(w, b.x, b.z, w.cup[0], w.cup[1], b.y)) {
        var mp = 5.5 * (1 - cd / 3.6) + 0.8;
        ix += cdx / cd * mp * h; iz += cdz / cd * mp * h;
      }
      for (var i = 0; i < w.magnets.length; i++) {
        var mg = w.magnets[i], mdx = mg.x - b.x, mdz = mg.z - b.z, md = Math.sqrt(mdx * mdx + mdz * mdz);
        if (md < mg.r && md > 0.05) { var mf = mg.k * C.MAGNET_GAIN * (1 - md / mg.r); ix += mdx / md * mf * h; iz += mdz / md * mf * h; }
      }
      // Launch pads throw the ball up and forward at least at their own speed (a faster ball keeps its pace,
      // so a pad never brakes), keeping sideways motion.
      if (b.padCd <= 0) for (var pi = 0; pi < w.pads.length; pi++) {
        var pd = w.pads[pi];
        if (Math.abs(b.y - pd.h) < 0.2 && (b.x - pd.x) * (b.x - pd.x) + (b.z - pd.z) * (b.z - pd.z) < pd.r * pd.r) {
          var lat = v.x * -pd.dz + v.z * pd.dx, fwd = Math.max(pd.speed, v.x * pd.dx + v.z * pd.dz);
          body.setLinvel({ x: pd.dx * fwd - pd.dz * lat, y: pd.up, z: pd.dz * fwd + pd.dx * lat }, true);
          rollAlong(b);
          b.padCd = 0.6; ix = iz = 0;
          if (ev) ev({ type: 'pad', id: b.id, x: b.x, z: b.z, y: b.y });
          break;
        }
      }
    }
    if (ix || iz) body.applyImpulse({ x: ix * m, y: 0, z: iz * m }, true);
  }

  /**
   * Advance the simulation by dt (normally one 1/60 s tick, as two 1/120 s Rapier steps).
   * Returns [{ id, result }] for balls that stopped, holed out, or hit a hazard.
   */
  function stepSim(sim, t, dt, opts) {
    var ev = opts && opts.onEvent, out = [], w = sim.w, world = sim.world;
    var h = (opts && opts.step) || C.DT, steps = Math.max(1, Math.round(dt / h));
    world.timestep = h;
    var balls = sim.balls, done = {};
    for (var s = 0; s < steps; s++) {
      var tt = t + s * h;
      poseKinematics(sim, tt + h, false);
      for (var i = 0; i < balls.length; i++) {
        var b = balls[i];
        if (b.ride >= 0 && b.body) {
          var pp = platformAt(w.platforms[b.ride], tt + h);
          b.body.setNextKinematicTranslation({ x: pp.x + b.rideOff.x, y: b.y + b.r, z: pp.z + b.rideOff.z });
          continue;
        }
        syncMods(b, h);
        if (b.padCd > 0) b.padCd -= h;
        b.pv = b.body && !b.frozen ? b.body.linvel() : { x: 0, y: 0, z: 0 };
        applyForces(sim, b, tt, h, ev);
      }
      world.step(sim.events);
      // Impacts (for sound, stats and bumper kicks).
      sim.events.drainCollisionEvents(function (h1, h2, started) {
        if (!started) return;
        var a = sim.info[h1], c = sim.info[h2];
        if (!a || !c) return;
        if (a.kind !== 'ball') { var tmp = a; a = c; c = tmp; }
        if (a.kind !== 'ball') return;
        impact(sim, a.ball, c, ev);
        if (c.kind === 'ball') impact(sim, c.ball, a, null);
      });
      for (var j = 0; j < balls.length; j++) {
        if (done[balls[j].id]) continue;
        var r = afterStep(sim, balls[j], tt + h, h, ev);
        if (r) { out.push({ id: balls[j].id, result: r }); done[balls[j].id] = true; }
      }
    }
    return out;
  }

  function impact(sim, b, other, ev) {
    if (!b.body || b.frozen) return;
    var v = b.body.linvel(), pv = b.pv || v;
    var s = Math.hypot(v.x - pv.x, v.y - pv.y, v.z - pv.z);
    if (other.kind === 'bumper' && other.bumper && other.bumper.kick) {
      // Springy bumpers kick straight out from their centre like a pinball bumper: the ball leaves at its
      // rebound speed plus the kick, and never slower than a firm minimum, even from a glancing touch.
      var bp = other.bumper, nx = b.x - bp.x, nz = b.z - bp.z, nl = Math.hypot(nx, nz) || 1;
      nx /= nl; nz /= nl;
      // The contact can register a step before the bounce, while the ball still heads in: bounce it here.
      var vn = v.x * nx + v.z * nz; if (vn < 0) vn = -vn * 0.95;
      var out = Math.max(vn + bp.kick, bp.kick * C.BUMPER_MIN_OUT);
      vn = v.x * nx + v.z * nz;
      if (out > vn) b.body.setLinvel({ x: v.x + nx * (out - vn), y: v.y, z: v.z + nz * (out - vn) }, true);
      s = Math.max(s, out);
    }
    if (other.kind !== 'floor') rollAlong(b);
    if (other.kind === 'floor') {
      var lf = floorAt(sim.w, b.x, b.z, b.y + 0.1, sim.t || 0);
      if (ev && pv.y < -1.5) ev({ type: 'land', id: b.id, s: Math.round(-pv.y * 10) / 10, mat: lf ? lf.mat : other.mat, x: b.x, z: b.z, y: b.y });
      return;
    }
    if (other.kind === 'ball') { wake(b); b.lastHit = other.ball.id; if (ev && s > 0.5) ev({ type: 'ball', id: b.id, other: other.ball.id, s: Math.round(s * 10) / 10, x: b.x, z: b.z, y: b.y }); return; }
    // Clipping the top edge of a rail must not fling the ball into the sky: walls push sideways, not up.
    if (v.y > 1.2 && pv.y < v.y) { b.body.setLinvel({ x: v.x, y: Math.max(pv.y, Math.min(v.y, 1.2)), z: v.z }, true); }
    if (s > 0.6) {
      b.bounces++;
      if (ev) ev({ type: other.kind === 'bumper' ? 'bumper' : 'wall', id: b.id, mat: other.mat, s: Math.round(s * 10) / 10, x: b.x, z: b.z, y: b.y });
    }
  }

  // After a rebound the ball would keep its old topspin, and floor friction would turn that spin against the
  // new direction: rebounds died almost at once and balls stopped dead after grazing a rail. A putting
  // ball skids briefly and picks up the new roll, so match the spin to the new direction of travel.
  function rollAlong(b) {
    var v = b.body.linvel();
    b.body.setAngvel({ x: v.z / b.r, y: 0, z: -v.x / b.r }, true);
  }

  /** Mirror the body into the ball object and apply the rules: hazards, cup, settling, stuck. */
  function afterStep(sim, b, t, h, ev) {
    var w = sim.w, body = b.body;
    sim.t = t;
    if (b.holed || !body) return null;
    if (b.ride >= 0 || b.hazard) { var rp = body.translation(); b.x = rp.x; b.y = rp.y - b.r; b.z = rp.z; return null; }
    var p = body.translation(), v = body.linvel();
    // Clamp absurd speeds.
    var s2 = v.x * v.x + v.z * v.z;
    if (s2 > C.MAX_SPEED * C.MAX_SPEED) { var k = C.MAX_SPEED / Math.sqrt(s2); v = { x: v.x * k, y: Math.min(v.y, 14), z: v.z * k }; body.setLinvel(v, true); }
    b.x = p.x; b.y = p.y - b.r; b.z = p.z; b.vx = v.x; b.vy = v.y; b.vz = v.z;
    if (b.frozen) return null;
    if (!b.moving) {
      // Something (a spinner, a ball, a platform edge) set a resting ball in motion. On a moving
      // platform "at rest" means at rest relative to the platform.
      var fr = floorAt(w, b.x, b.z, b.y + 0.05, t);
      var ox = v.x - (fr ? fr.pvx : 0), oz = v.z - (fr ? fr.pvz : 0);
      if (!body.isSleeping() && (ox * ox + oz * oz > 0.04 || Math.abs(v.y) > 0.5 || !fr)) wake(b);
      else return null;
    }
    b.shotT += h;
    // Hazards.
    if (w.water && b.y < w.water.level && inWater(w, b.x, b.z)) { hazard(b); if (ev) ev({ type: 'water', id: b.id, x: b.x, z: b.z }); return 'water'; }
    if (b.y < w.oobY) { hazard(b); if (ev) ev({ type: 'oob', id: b.id, x: b.x, z: b.z }); return 'oob'; }
    // Cup: slow enough over the hole and it drops; too fast and it hops the lip.
    var dd = inCupZone(w, b), spd = Math.sqrt(s2);
    // It drops once it is mostly over the hole (centre within the cup plus half the ball), not only when its
    // centre is: a ball half over the hole rolling straight across looked like the cup was covered. The
    // speed it can drop at eases off from the middle toward the rim.
    var edge = C.CUP_R + b.r * 0.5;
    if (dd < edge && Math.abs(b.y - w.cupH) < 0.12) {
      var inner = C.CUP_R * 0.55, k = dd < inner ? 0 : (dd - inner) / (edge - inner);
      var lim = (dd < inner ? C.CAPTURE_SPEED_CENTER : C.CAPTURE_SPEED * (1 - 0.4 * k)) * (b.r > C.R * 1.2 ? 0.8 : 1);
      if (spd < lim) {
        b.holed = true; b.moving = false;
        body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setEnabled(false);
        if (ev) ev({ type: 'cup', id: b.id, x: w.cup[0], z: w.cup[1], y: w.cupH });
        return 'cup';
      } else if (!b.lipped) {
        // Too fast: it rattles across the hole and carries on, a little slower, along its line.
        b.lipped = true;
        body.setLinvel({ x: v.x * 0.9, y: v.y, z: v.z * 0.9 }, true);
        if (ev) ev({ type: 'lip', id: b.id, x: b.x, z: b.z });
      }
    } else if (dd > edge + 0.15) b.lipped = false;
    // Settling: slow, on the ground and not on a real slope.
    var f = floorAt(w, b.x, b.z, b.y + 0.05, t);
    var grounded = !!f && b.y - f.h < 0.06;
    if (grounded) {
      var rvx = v.x - f.pvx, rvz = v.z - f.pvz, rel = Math.sqrt(rvx * rvx + rvz * rvz);
      var grade = Math.sqrt(f.gx * f.gx + f.gz * f.gz), nearCup = dd < C.CUP_R + b.r + 0.05;
      if (rel < C.STOP_SPEED && Math.abs(v.y) < 0.3 && grade < C.STATIC_GRADE && !nearCup && !(b.magnet && dd < 3.6)) {
        b.still += h;
        if (b.still > 0.12) return settle(b, ev, f);
      } else if (rel < 0.04 && Math.abs(v.y) < 0.2) { b.still += h; if (b.still > 0.6 && !nearCup) return settle(b, ev, f); }
      else b.still = 0;
    }
    // Stuck (wedged) or rolling far too long.
    b.anchorT += h;
    if (b.anchorT > C.STUCK_TIME) {
      var adx = b.x - b.anchorX, adz = b.z - b.anchorZ;
      if (adx * adx + adz * adz < 0.09 && grounded) return settle(b, ev, f);
      b.anchorX = b.x; b.anchorZ = b.z; b.anchorT = 0;
    }
    if (b.shotT > C.MAX_SHOT_TIME && grounded) return settle(b, ev, f);
    return null;
  }

  function hazard(b) {
    b.moving = false; b.hazard = true;
    b.body.setLinvel({ x: 0, y: 0, z: 0 }, true); b.body.setAngvel({ x: 0, y: 0, z: 0 }, true); b.body.sleep();
  }

  function settle(b, ev, f) {
    b.vx = b.vz = b.vy = 0; b.moving = false; b.still = 0;
    if (b.body) {
      b.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      if (f && f.plat >= 0) startRide(b, f.plat, b.sim.t || 0);
      else b.body.sleep();
    }
    if (ev) ev({ type: 'stop', id: b.id, x: b.x, z: b.z });
    return 'stop';
  }

  /**
   * Predict a shot from a copy of ball b, alone on the hole (other balls ignored). Uses a private
   * simulation per hole, so it is exactly the server's physics. Returns { points, result, ball }.
   */
  function predict(w, b, dx, dz, speed, t0, opts) {
    var maxT = (opts && opts.maxT) || 3, every = (opts && opts.every) || 1 / 30, step = (opts && opts.step) || C.DT;
    var sim = w._pred;
    if (!sim || !sim.world) { sim = w._pred = createSim(w); sim.ball = addBall(sim, '_pred', w.tee[0], w.tee[1]); }
    var c = sim.ball;
    c.holed = false; c.body.setEnabled(true); c.frozen = false; c.wasFrozen = false; stopRide(c); c.hazard = false;
    if (c.body.bodyType() !== R.RigidBodyType.Dynamic) c.body.setBodyType(R.RigidBodyType.Dynamic, true);
    c.r = c.rTarget = b.rTarget != null ? b.rTarget : C.R; c.col.setRadius(c.r);
    c.fric = b.fric || 1; c.ghost = !!b.ghost; c.magnet = !!b.magnet; c.solo = true; c.padCd = 0;
    place(c, b.x, b.y, b.z);
    syncMods(c, 0);
    poseKinematics(sim, t0, true);
    shoot(c, dx, dz, speed);
    var pts = [[c.x, c.y, c.z]], t = 0, next = every, result = null, bounces = 0;
    var maxB = (opts && opts.maxBounces) || 99;
    var ev = function (e) { if (e.type === 'wall' || e.type === 'bumper') bounces++; };
    while (t < maxT) {
      var r = stepSim(sim, t0 + t, step, { onEvent: ev, step: step });
      t += step;
      if (t >= next - 1e-9) { pts.push([c.x, c.y, c.z]); next += every; }
      if (r.length) { result = r[0].result; pts.push([c.x, c.y, c.z]); break; }
      if (bounces >= maxB) { pts.push([c.x, c.y, c.z]); result = 'bounce'; break; }
    }
    return { points: pts, result: result, ball: { x: c.x, y: c.y, z: c.z, moving: c.moving } };
  }

  // ---------------------------------------------------------------- geometry queries

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

  /**
   * Map a 0..1 aim power to a launch speed. Speed follows power^0.7, which makes roll distance close to
   * proportional to the pull on flat ground: a tenth of a pull rolls about a tenth as far as a full one,
   * so short putts are as controllable as long ones.
   */
  function shotSpeed(power, strength) {
    power = clamp(power, 0, 1);
    return Math.max(C.MIN_SHOT, Math.pow(power, 0.7) * C.MAX_SHOT * (strength || 1));
  }

  var api = {
    C: C, FLOOR_FRICTION: FLOOR_FRICTION, WALL_BOUNCE: WALL_BOUNCE, ready: false, init: init,
    compileHole: compileHole, floorAt: floorAt, blocked: blocked, inPoly: inPoly, heightOn: heightOn, clamp: clamp,
    dynamicAt: dynamicAt, platformAt: platformAt, sliderAt: sliderAt, spinnerAngle: spinnerAngle, gateClosed: gateClosed,
    createSim: createSim, freeSim: freeSim, addBall: addBall, removeBall: removeBall, place: place, push: push, stopRide: stopRide,
    shoot: shoot, wake: wake, stepSim: stepSim, predict: predict, shotSpeed: shotSpeed
  };
  return api;
});
