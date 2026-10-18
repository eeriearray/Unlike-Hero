/* Neon Casino — the roulette table in 3D: a modelled European wheel (wooden bowl, lacquered ball track with
   deflectors, spinning rotor with frets, numbered pockets and a brass turret), a cloth with the betting layout printed on
   it, and the ball. The ball physics are the 2D ones from js/roulette.js, ported: it is launched against the rotor, bleeds
   speed exponentially, drops off the track, rattles over the deflectors and frets, settles in the pocket the server picked
   and rides the rotor. The server has already chosen the number; this only decides how the ball gets there. */
(function (global) {
  'use strict';
  var T = global.THREE, GL = global.CasinoGL, K = GL && GL.kit;
  if (!T || !K || !GL.TABLES) return;
  var H = GL.helpers, TOP = H.TOP, TAU = H.TAU, esc = GL.esc;

  var WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  var RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  var STEP = 360 / 37;
  function colorOf(n) { return n === 0 ? 'green' : RED.indexOf(n) >= 0 ? 'red' : 'black'; }
  var FILL = { green: '#1d6e45', red: '#a3232f', black: '#15110e' };

  // metres
  var ROTOR_R = 0.30, POCKET_IN = 0.165, POCKET_OUT = 0.265, POCKET_MID = 0.215, TRACK_R3 = 0.37, BALL_R = 0.017;
  var DROP = 0.6, LOCK = 0.86;
  function smooth(x) { return x * x * (3 - 2 * x); }
  function surfaceY(r) { return r > ROTOR_R + 0.012 ? 0.026 + (r - ROTOR_R) * 0.54 : 0.037; }

  function rotorTexture() {
    return K.canvasTex(1024, 1024, function (g, w, h) {
      var c = w / 2, pm = c / ROTOR_R, rIn = POCKET_IN * pm, rOut = POCKET_OUT * pm, rr = ROTOR_R * pm;
      g.fillStyle = '#150b05'; g.fillRect(0, 0, w, h);
      g.beginPath(); g.arc(c, c, rr, 0, TAU); g.fillStyle = '#1b0f07'; g.fill();
      for (var i = 0; i < 37; i++) {
        var n = WHEEL[i], a0 = (i - 0.5) * STEP * Math.PI / 180 - Math.PI / 2, a1 = (i + 0.5) * STEP * Math.PI / 180 - Math.PI / 2, col = FILL[colorOf(n)];
        var gr = g.createRadialGradient(c, c, rIn, c, c, rOut); gr.addColorStop(0, '#000'); gr.addColorStop(0.18, col); gr.addColorStop(1, col);
        g.beginPath(); g.arc(c, c, rOut, a0, a1); g.arc(c, c, rIn, a1, a0, true); g.closePath(); g.fillStyle = gr; g.fill();
        var sh = g.createRadialGradient(c, c, rIn, c, c, rOut); sh.addColorStop(0, 'rgba(0,0,0,.65)'); sh.addColorStop(0.35, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.2)');
        g.fillStyle = sh; g.fill();
        // the number ring
        var am = i * STEP * Math.PI / 180;
        g.save(); g.translate(c + Math.sin(am) * (rOut + (rr - rOut) * 0.52), c - Math.cos(am) * (rOut + (rr - rOut) * 0.52)); g.rotate(am);
        g.fillStyle = n === 0 ? '#6fe0a0' : '#eadcb8'; g.font = '700 34px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 0, 0); g.restore();
      }
      g.strokeStyle = '#c9a24a'; g.lineWidth = 4; g.beginPath(); g.arc(c, c, rOut, 0, TAU); g.stroke(); g.beginPath(); g.arc(c, c, rr - 3, 0, TAU); g.stroke();
      var r = K.rnd(5);                                                                                     // scuffs
      for (var s = 0; s < 400; s++) { g.fillStyle = 'rgba(255,230,190,' + r() * 0.06 + ')'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    });
  }

  function Wheel3D(E, cx, cz) {
    var self = this, M = E.m;
    this.E = E; this.g = new T.Group(); this.g.position.set(cx, TOP, cz); E.scene.add(this.g);
    var wood2 = M.wood.clone(); wood2.side = T.DoubleSide;
    function lathe(pts, mat) { var m = new T.Mesh(new T.LatheGeometry(pts.map(function (p) { return new T.Vector2(p[0], p[1]); }), 56), mat); m.castShadow = !E.coarse; m.receiveShadow = true; self.g.add(m); return m; }
    lathe([[0.0, 0.0], [0.52, 0.0], [0.52, 0.07], [0.5, 0.09], [0.43, 0.095], [0.40, 0.08]], wood2);                 // the wooden bowl
    var lac = new T.MeshStandardMaterial({ map: K.woodTex('#4a2410', '#150a04', 6, 33, [4, 1], 6), roughness: 0.28, metalness: 0.1, side: T.DoubleSide });
    this.lac = lac;
    lathe([[0.40, 0.08], [0.37, 0.058], [0.34, 0.042], [0.31, 0.031], [0.30, 0.026], [0.0, 0.02]], lac);                                // the ball track, lacquered
    var rim = new T.Mesh(new T.TorusGeometry(0.415, 0.009, 6, 56), M.brass); rim.rotation.x = Math.PI / 2; rim.position.y = 0.095; this.g.add(rim);
    var b = new K.Builder(6), s = K.Shapes(b);                                                                               // deflectors
    for (var d = 0; d < 8; d++) { var a = d / 8 * TAU + 0.2, rd = 0.37; b.add(K.G.box, '#d8b25a', K.M(Math.sin(a) * rd, surfaceY(rd) + 0.006, -Math.cos(a) * rd, 0.5, -a, 0.78, 0.016, 0.02, 0.016), true); }
    this.g.add(new T.Mesh(b.build(), M.vcSmooth));
    // rotor
    var rot = this.rotor = new T.Group(); rot.position.y = 0.008; this.g.add(rot);
    var disc = new T.Mesh(new T.CircleGeometry(ROTOR_R, 72), new T.MeshStandardMaterial({ map: rotorTexture(), roughness: 0.4, metalness: 0.05 })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.03; rot.add(disc);
    var fb = new K.Builder(7);                                                                                               // frets between pockets
    for (var i = 0; i < 37; i++) {
      var th = (i - 0.5) * STEP * Math.PI / 180, rm = (POCKET_IN + POCKET_OUT) / 2;
      fb.add(K.G.box, '#e6c97a', K.M(Math.sin(th) * rm, 0.037, -Math.cos(th) * rm, 0, Math.PI - th, 0, 0.004, 0.013, POCKET_OUT - POCKET_IN), true);
    }
    var turret = [[0.0, 0.3], [0.012, 0.27], [0.03, 0.2], [0.07, 0.11], [0.12, 0.062], [0.165, 0.034], [0.0, 0.034]];
    rot.add(new T.Mesh(new T.LatheGeometry(turret.map(function (p) { return new T.Vector2(p[0], p[1] * 0.78); }), 20), new T.MeshStandardMaterial({ color: 0xd8b25a, roughness: 0.3, metalness: 0.85, emissive: 0x2a1c06 })));
    for (var k = 0; k < 4; k++) { fb.add(K.G.box, '#e6c97a', K.M(Math.cos(k * Math.PI / 2 + 0.4) * 0.07, 0.17, Math.sin(k * Math.PI / 2 + 0.4) * 0.07, 0, -(k * Math.PI / 2 + 0.4), 0.2, 0.14, 0.008, 0.008), true); fb.add(K.G.sph, '#e6c97a', K.M(Math.cos(k * Math.PI / 2 + 0.4) * 0.14, 0.2, Math.sin(k * Math.PI / 2 + 0.4) * 0.14, 0, 0, 0, 0.014), true); }
    fb.add(K.G.sph, '#f0d68a', K.M(0, 0.245, 0, 0, 0, 0, 0.022), true);
    rot.add(new T.Mesh(fb.build(), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.8, emissive: 0x1a1204 })));
    this.ball = new T.Mesh(new T.SphereGeometry(BALL_R, 14, 10), new T.MeshStandardMaterial({ color: 0xf6f3ea, roughness: 0.15, metalness: 0.15, emissive: 0x25231c })); this.ball.visible = false; this.ball.castShadow = !E.coarse; this.g.add(this.ball);
    this.wheelAt = 0; this.seen = null; this.anim = null; this.ride = null; this.state = 'idle'; this.last = performance.now();
  }
  var W = Wheel3D.prototype;

  W.place = function (w, angle, rad, show) {
    this.rotor.rotation.y = -w * Math.PI / 180;
    var r3 = rad == null ? TRACK_R3 : POCKET_MID + (rad - 73) * (TRACK_R3 - POCKET_MID) / (94.5 - 73);
    var a = angle * Math.PI / 180;
    this.ball.position.set(r3 * Math.sin(a), surfaceY(r3) + BALL_R * 0.95, -r3 * Math.cos(a)); this.ball.visible = !!show;
  };

  /** Called whenever the model changes: starts a spin for a new result, or shows the final state. */
  W.sync = function (round, phase, spinSec) {
    if (!round) { this.ride = null; this.ball.visible = false; this.seen = null; return; }
    if (round.result == null || this.seen === round.id) return;
    this.seen = round.id;
    var pocket = WHEEL.indexOf(round.result) * STEP, w0 = this.wheelAt, land = ((-pocket - w0) % 360 + 360) % 360, wf = w0 + 360 * 3 + land;
    var reduce = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (phase !== 'spinning' || reduce) { this.wheelAt = wf; this.anim = null; this.ride = { pocket: pocket }; this.state = 'ride'; this.place(wf, wf + pocket, 73, true); return; }
    this.state = 'spin';
    var D = Math.max(2.5, (spinSec || 7) - 0.4) * 1000, t0 = performance.now(), b0 = Math.random() * 360, turns = 7 + Math.random() * 2, Kd = 3.4, norm = 1 - Math.exp(-Kd), A = 360 * turns;
    var wheel = function (u) { return w0 + (wf - w0) * (1 - Math.pow(1 - u, 2.2)); };
    var free = function (u) { return b0 - A * (1 - Math.exp(-Kd * u)) / norm; };
    var wrap = Math.round((free(DROP) - (wheel(DROP) + pocket)) / 360) * 360;
    this.anim = { t0: t0, D: D, wheel: wheel, free: free, pocket: pocket, wrap: wrap, wf: wf, b0: b0, w0: w0 };
    this.ride = null;
  };

  W.tick = function (now, dt) {
    var a = this.anim;
    if (a) {
      var u = Math.min(1, (now - a.t0) / a.D), ang, rad, inPocket = function (x) { return a.wheel(x) + a.pocket + a.wrap; };
      if (u < DROP) { ang = a.free(u); rad = 94.5; }
      else if (u < LOCK) {
        var p = (u - DROP) / (LOCK - DROP), e = smooth(p), damp = (1 - p) * (1 - p);
        ang = a.free(u) * (1 - e) + inPocket(u) * e + Math.sin(p * Math.PI * 4) * 7 * damp;
        rad = Math.min(94.5, 73 + (94.5 - 73) * (1 - e) + Math.abs(Math.sin(p * Math.PI * 4.5)) * 7 * damp);
      } else { ang = inPocket(u); rad = 73 + Math.abs(Math.sin((u - LOCK) * 40)) * 0.6 * (1 - u); }
      this.place(a.wheel(u), ang, rad, true);
      if (u >= 1) { this.wheelAt = a.wf; this.anim = null; this.ride = { pocket: a.pocket }; this.state = 'ride'; }
      return;
    }
    this.wheelAt += dt * 6;                                                  // idle: the rotor coasts on, with the ball riding it
    if (this.ride) this.place(this.wheelAt, this.wheelAt + this.ride.pocket, 73, true); else { this.rotor.rotation.y = -this.wheelAt * Math.PI / 180; }
  };

  // ───────────── the table ─────────────
  var C = 0.19, GX = -7 * C, GZ = 0.08, HW = 1.65, HD = 1.25, CZ = -0.05;
  function cell(col, row) { return { x: GX + (col + 0.5) * C, z: GZ + (row + 0.5) * C }; }
  GL.rouletteSpot = function (spot) {
    var t = spot.type, nums = spot.numbers || [];
    function numCell(n) { if (n === 0) return { x: GX + 0.5 * C, z: GZ + 1.5 * C }; return cell(Math.floor((n - 1) / 3) + 1, 2 - (n - 1) % 3); }
    if (t === 'dozen') return { x: GX + (1 + (spot.key - 1) * 4 + 2) * C, z: GZ + 3.5 * C };
    if (t === 'column') return cell(13, 3 - spot.key);
    var out = { low: 0, even: 1, red: 2, black: 3, odd: 4, high: 5 };
    if (out[t] != null) return { x: GX + (1 + out[t] * 2 + 1) * C, z: GZ + 4.5 * C };
    var sx = 0, sz = 0; nums.forEach(function (n) { var c = numCell(n); sx += c.x; sz += c.z; });
    var p = { x: sx / (nums.length || 1), z: sz / (nums.length || 1) };
    if (t === 'street' || t === 'sixline') p.z = GZ + 3 * C;
    return p;
  };

  function layoutTexture(bbox) {
    var PPM = 380, Wd = Math.round(bbox.w * PPM), Hd = Math.round(bbox.h * PPM);
    return K.feltTex(Wd, Hd, '#0f4a30', '#e9e0c0', function (g, w, h) {
      function X(x) { return (x - bbox.xmin) * PPM; } function Z(z) { return (z - bbox.zmin) * PPM; }
      g.lineWidth = 2.5; g.strokeStyle = 'rgba(233,224,192,.55)'; g.textAlign = 'center'; g.textBaseline = 'middle';
      function box(c0, r0, c1, r1, fill) { var x = X(GX + c0 * C), y = Z(GZ + r0 * C), ww = (c1 - c0) * C * PPM, hh = (r1 - r0) * C * PPM; if (fill) { g.fillStyle = fill; g.fillRect(x, y, ww, hh); } g.strokeRect(x, y, ww, hh); return { x: x + ww / 2, y: y + hh / 2, w: ww, h: hh }; }
      var serif = '"Cormorant Garamond", Georgia, serif';
      var z = box(0, 0, 1, 3, 'rgba(29,110,69,.85)'); g.fillStyle = '#eadcb8'; g.font = '700 46px ' + serif; g.fillText('0', z.x, z.y);
      for (var n = 1; n <= 36; n++) {
        var col = Math.floor((n - 1) / 3) + 1, row = 2 - (n - 1) % 3, bx = box(col, row, col + 1, row + 1, colorOf(n) === 'red' ? 'rgba(163,35,47,.92)' : 'rgba(18,14,11,.92)');
        g.fillStyle = '#eadcb8'; g.font = '700 38px ' + serif; g.fillText(String(n), bx.x, bx.y);
      }
      for (var k = 0; k < 3; k++) { var cb = box(13, k, 14, k + 1); g.fillStyle = '#eadcb8'; g.font = '700 22px ' + serif; g.fillText('2 to 1', cb.x, cb.y); }
      ['1st 12', '2nd 12', '3rd 12'].forEach(function (t, i) { var db = box(1 + i * 4, 3, 5 + i * 4, 4); g.fillStyle = '#eadcb8'; g.font = '700 30px ' + serif; g.fillText(t, db.x, db.y); });
      var outs = ['1–18', 'EVEN', '', '', 'ODD', '19–36'];
      outs.forEach(function (t, i) {
        var ob = box(1 + i * 2, 4, 3 + i * 2, 5, i === 2 ? 'rgba(163,35,47,.92)' : i === 3 ? 'rgba(18,14,11,.92)' : null);
        g.fillStyle = '#eadcb8'; g.font = '700 28px ' + serif; if (t) g.fillText(t, ob.x, ob.y); else { g.save(); g.translate(ob.x, ob.y); g.rotate(Math.PI / 4); g.fillStyle = i === 2 ? '#d94a56' : '#2a2420'; g.strokeStyle = '#eadcb8'; g.fillRect(-18, -18, 36, 36); g.strokeRect(-18, -18, 36, 36); g.restore(); }
      });
      g.globalAlpha = 0.28; g.fillStyle = '#e9e0c0'; g.font = '700 54px ' + serif; g.fillText('EUROPEAN ROULETTE', X(0), Z(1.12)); g.globalAlpha = 1;
    }, 12);
  }

  var SEATS = [[-0.35, 1.72, Math.PI], [0.35, 1.72, Math.PI], [-1.05, 1.72, Math.PI], [1.05, 1.72, Math.PI], [-2.2, 0.55, Math.PI / 2], [2.2, 0.55, -Math.PI / 2], [-2.2, -0.5, Math.PI / 2], [2.2, -0.5, -Math.PI / 2]];
  var RT = GL.TABLES.roulette = {
    hideSelf: function () { return true; },                                     // the fixed camera sits where your chair is
    build: function (E) {
      var hw = HW, hd = HD, cz = -CZ;                                                    // shape y is -world z
      function rr(a, b) { return H.roundRect(hw + a, hd + b, 0.55, cz); }
      var felt = rr(-0.012, -0.012), outer = rr(0.19, 0.19), inner = rr(0, 0), trimO = rr(0.01, 0.01), trimI = rr(-0.012, -0.012);
      outer.holes.push(new T.Path(inner.getPoints(24))); trimO.holes.push(new T.Path(trimI.getPoints(24)));
      var fx = hw - 0.012, fh = hd - 0.012, bbox = { xmin: -fx, zmin: -CZ * 0 + (CZ - fh), w: fx * 2, h: fh * 2 };
      var tex = layoutTexture(bbox);
      var body = H.tableBody(E, { slab: rr(0.2, 0.2), railRing: outer, trim: trimO, felt: felt }, tex, { x0: -fx, y0: cz - fh, w: fx * 2, h: fh * 2 }, [[-0.9, -0.1], [0.9, -0.1]]);
      E.wheel = new Wheel3D(E, 0, -0.64);
      var d = K.buildAnimal('raven', E.m.vc, { standing: true, reach: 0.5 }); d.root.position.set(0, 0, -1.95); E.scene.add(d.root); E.shadowize(d.root);
      E.dealer = { animal: d, phase: 2.4, look: 0 };
      var dl = new T.PointLight(0xffd0a0, 1.0, 3.4, 1.4); dl.position.set(0, 2.1, -1.5); E.scene.add(dl);
      var win = new T.Mesh(new T.RingGeometry(0.075, 0.095, 24), E.m.ring); win.rotation.x = -Math.PI / 2; win.visible = false; E.scene.add(win);
      E.lampG.position.z = -0.35;
      return { winRing: win };
    },
    seatPose: function (E, i) { var p = SEATS[i % SEATS.length]; return { x: p[0], z: p[1], ry: p[2] }; },
    layout: function (E, m) {
      var out = { cards: [], chips: [], labels: [] };
      (m.bets || []).forEach(function (b) { var p = GL.rouletteSpot(b); out.chips.push({ id: 'bet:' + b.id, amount: b.amount, x: p.x, z: p.z, y: TOP + 0.004, from: b.from ? E.seatPose(b.from) : null }); });
      E.seatLabels(m, out.labels);
      return out;
    },
    sync: function (E, m) { if (E.wheel && m.wheel) E.wheel.sync(m.wheel.round, m.wheel.phase, m.wheel.spinSec); },
    tick: function (E, dt, t) {
      var m = E.model; if (!m) return;
      var d = E.dealer.animal, kk = 1 - Math.pow(0.04, dt), br = Math.sin(t * 1.4 + E.dealer.phase);
      d.body.scale.y = 1 + br * 0.01; d.head.position.y = 0.99 + br * 0.004;
      d.head.rotation.x = 0.28 + br * 0.01; d.head.rotation.y = Math.sin(t * 0.3) * 0.2;               // watching the wheel
      d.eyes.scale.y = Math.sin(t * 0.8 + 2) > 0.988 ? 0.12 : 1;
      if (E.wheel) E.wheel.tick(performance.now(), dt);
      var w = m.wheel, ring = E.ctx.winRing;
      if (ring) {
        var res = w && w.phase === 'results' && w.round && w.round.result != null && E.wheel.state === 'ride' ? w.round.result : null;
        if (res == null) ring.visible = false;
        else { var p = GL.rouletteSpot({ type: 'straight', numbers: [res] }); ring.visible = true; ring.position.set(p.x, TOP + 0.012, p.z); ring.material.opacity = 0.55 + Math.sin(t * 5) * 0.25; }
      }
    },
    camera: function (E, m) {
      var tight = m.wheel && (m.wheel.phase === 'spinning' || m.wheel.phase === 'results');
      if (E.portrait) return tight ? GL.rig(E, [0, 0.85, -0.62], 1.55, 1.5, 1.15, 0, 56) : GL.rig(E, [0, 0.8, 0.12], 3.5, 3.0, 0.95, 0, 56);
      return tight ? GL.rig(E, [0, 0.86, -0.55], 1.9, 1.15, 0.72, 0, 46) : GL.rig(E, [0, 0.82, -0.1], 3.5, 2.2, 0.62, 0, 50);
    }
  };
})(window);
