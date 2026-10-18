/* Neon Casino — the 3D kit (Three.js r147, vendored). Everything the tables are built from, all procedural so there
   is nothing to download: canvas textures (wood, felt, leather, wall, cards), a geometry merger that bakes colours
   into vertices (one draw call per animal part), the sixteen animal regulars, chairs, chips and the playing cards.
   window.CasinoGL.kit is used by js/gl-scene.js. */
(function (global) {
  'use strict';
  var T = global.THREE;
  var GL = global.CasinoGL = global.CasinoGL || {};
  if (!T) { GL.supported = function () { return false; }; return; }
  if (T.ColorManagement) T.ColorManagement.legacyMode = false;     // hex colours are sRGB, like the canvas textures

  GL.supported = function () {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  };

  var K = GL.kit = {};

  // ───────────── helpers ─────────────
  function rnd(seed) { var s = seed || 1; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  K.rnd = rnd;
  var _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3(), _a = new T.Vector3(), _b = new T.Vector3(), _up = new T.Vector3(0, 1, 0);
  /** Matrix from position, euler rotation and scale. */
  function M(px, py, pz, rx, ry, rz, sx, sy, sz) {
    _p.set(px || 0, py || 0, pz || 0); _q.setFromEuler(_e.set(rx || 0, ry || 0, rz || 0));
    _s.set(sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz);
    return new T.Matrix4().compose(_p, _q, _s);
  }
  K.M = M;

  var G = {
    sph: new T.SphereGeometry(1, 10, 8), sphHi: new T.SphereGeometry(1, 20, 14),
    cone: new T.ConeGeometry(1, 1, 7), cyl: new T.CylinderGeometry(1, 1, 1, 10), box: new T.BoxGeometry(1, 1, 1)
  };
  K.G = G;

  /** Collects transformed, coloured geometry and bakes it into one BufferGeometry (non-indexed, vertex-coloured). */
  function Builder(seed) { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.r = rnd(seed || 5); }
  var tmpC = new T.Color();
  Builder.prototype.add = function (geo, color, m, noShade) {
    var g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m);
    var p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv ? g.attributes.uv.array : null;
    tmpC.set(color);
    var count = p.length / 3, shade = 1;
    for (var i = 0; i < count; i++) {
      if (i % 3 === 0) shade = noShade ? 1 : 0.93 + this.r() * 0.14;       // each triangle a touch lighter or darker: worn, hand-painted
      this.pos.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); this.nor.push(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
      this.uv.push(u ? u[i * 2] : 0, u ? u[i * 2 + 1] : 0);
      this.col.push(tmpC.r * shade, tmpC.g * shade, tmpC.b * shade);
    }
    g.dispose();
    return this;
  };
  Builder.prototype.build = function () {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  };
  K.Builder = Builder;

  /** Shorthand shape adders for a Builder. */
  function Shapes(b) {
    return {
      b: b,
      sph: function (c, x, y, z, sx, sy, sz) { b.add(G.sph, c, M(x, y, z, 0, 0, 0, sx, sy == null ? sx : sy, sz == null ? sx : sz)); },
      cone: function (c, x, y, z, rx, ry, rz, sx, sy, sz) { b.add(G.cone, c, M(x, y, z, rx, ry, rz, sx, sy, sz == null ? sx : sz)); },
      cyl: function (c, x, y, z, rx, ry, rz, sx, sy, sz) { b.add(G.cyl, c, M(x, y, z, rx, ry, rz, sx, sy, sz == null ? sx : sz)); },
      box: function (c, x, y, z, sx, sy, sz, rx, ry, rz) { b.add(G.box, c, M(x, y, z, rx, ry, rz, sx, sy, sz)); },
      /** A tapered rod from a to b: radius ra at a, rb at b. */
      limb: function (c, a, bb, ra, rb, xs) {
        _a.set(a[0], a[1], a[2]); _b.set(bb[0], bb[1], bb[2]);
        var dir = _b.clone().sub(_a), len = dir.length(); dir.normalize();
        var q = new T.Quaternion().setFromUnitVectors(_up, dir), mid = _a.clone().add(_b).multiplyScalar(0.5);
        var g = new T.CylinderGeometry(rb, ra, 1, 9, 1);
        b.add(g, c, new T.Matrix4().compose(mid, q, new T.Vector3(xs || 1, len, 1)));
        g.dispose();
      }
    };
  }
  K.Shapes = Shapes;

  // ───────────── canvas textures ─────────────
  function canvasTex(w, h, draw, repeat) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    t.anisotropy = 4;
    return t;
  }
  K.canvasTex = canvasTex;

  function speckle(g, w, h, n, r, a, light) {
    for (var i = 0; i < n; i++) { g.fillStyle = (r() < 0.5 ? 'rgba(0,0,0,' : 'rgba(' + light + ',') + (r() * a) + ')'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  }
  /** Worn planks: long grain, knots, nail heads, scuffs, dark stains. `dir` 'x' runs the planks across. */
  K.woodTex = function (base, dark, planks, seed, repeat, scuffs) {
    return canvasTex(512, 512, function (g, w, h) {
      var r = rnd(seed || 7);
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      var pw = w / planks;
      for (var p = 0; p < planks; p++) {
        g.fillStyle = 'rgba(0,0,0,' + (0.04 + r() * 0.16) + ')'; g.fillRect(p * pw, 0, pw, h);
        for (var i = 0; i < 40; i++) {
          g.strokeStyle = (r() < 0.55 ? 'rgba(0,0,0,' : 'rgba(255,215,160,') + (0.03 + r() * 0.07) + ')';
          g.lineWidth = 0.6 + r() * 2.2; g.beginPath();
          var x = p * pw + r() * pw; g.moveTo(x, 0);
          for (var y = 0; y <= h; y += 24) g.lineTo(x + Math.sin(y / 50 + r() * 3) * 3, y);
          g.stroke();
        }
        if (r() < 0.8) { var kx = p * pw + pw * (0.2 + r() * 0.6), ky = r() * h; g.strokeStyle = 'rgba(0,0,0,.28)'; for (var k = 1; k < 4; k++) { g.lineWidth = 1.5; g.beginPath(); g.ellipse(kx, ky, 3 + k * 3, 6 + k * 7, 0, 0, 6.3); g.stroke(); } }
        g.fillStyle = dark; g.fillRect(p * pw, 0, 2.5, h);
        var cut = r() * h; g.fillRect(p * pw, cut, pw, 2.5);
      }
      for (var s = 0; s < (scuffs == null ? 14 : scuffs); s++) {                  // pale scratches and dark rings from glasses
        g.strokeStyle = 'rgba(255,225,180,' + (0.06 + r() * 0.12) + ')'; g.lineWidth = 0.8; g.beginPath();
        var sx = r() * w, sy = r() * h; g.moveTo(sx, sy); g.lineTo(sx + (r() - 0.5) * 90, sy + (r() - 0.5) * 40); g.stroke();
      }
      for (var c = 0; c < 4; c++) { g.strokeStyle = 'rgba(10,4,0,' + (0.12 + r() * 0.12) + ')'; g.lineWidth = 3 + r() * 3; g.beginPath(); g.arc(r() * w, r() * h, 14 + r() * 8, 0, 6.3); g.stroke(); }
      speckle(g, w, h, 1800, r, 0.08, '255,230,190');
    }, repeat);
  };
  /** Padded leather: cracked and scuffed. */
  K.leatherTex = function () {
    return canvasTex(256, 256, function (g, w, h) {
      var r = rnd(31);
      g.fillStyle = '#34190f'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 5000, r, 0.14, '120,70,40');
      g.lineWidth = 0.8;
      for (var i = 0; i < 70; i++) { g.strokeStyle = 'rgba(0,0,0,' + (0.15 + r() * 0.3) + ')'; g.beginPath(); var x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 26, y + (r() - 0.5) * 26); g.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 40); g.stroke(); }
      for (var j = 0; j < 8; j++) { var grd = g.createRadialGradient(r() * w, r() * h, 2, r() * w, r() * h, 40); grd.addColorStop(0, 'rgba(160,100,60,.18)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, w, h); }
    }, [6, 2]);
  };
  K.wallTex = function () {
    return canvasTex(512, 512, function (g, w, h) {
      var r = rnd(17);
      var grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#1e1712'); grd.addColorStop(0.55, '#2a1d15'); grd.addColorStop(1, '#150f0b');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      for (var x = 0; x < w; x += 64) { g.fillStyle = 'rgba(255,200,140,.03)'; g.fillRect(x, 0, 32, h * 0.62); }       // faded wallpaper stripes
      speckle(g, w, h, 5000, r, 0.1, '200,150,100');
      g.fillStyle = '#20150e'; g.fillRect(0, h * 0.62, w, h * 0.38);                                                  // wainscot
      for (var p = 0; p < w; p += 42) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(p, h * 0.62, 3, h * 0.38); }
      g.fillStyle = '#4a3520'; g.fillRect(0, h * 0.6, w, 8); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, h * 0.6 + 8, w, 4);
      for (var s = 0; s < 14; s++) {                                                                                   // damp stains
        var cx = r() * w, cy = r() * h * 0.6, gr = g.createRadialGradient(cx, cy, 2, cx, cy, 30 + r() * 60);
        gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
    }, [5, 1]);
  };
  /** The felt: a dim woven nap with wear paths, a few burns, chalk dust, and `paint(g,w,h)` for the printed lines. */
  K.feltTex = function (w, h, base, ink, paint, seed) {
    return canvasTex(w, h, function (g) {
      var r = rnd(seed || 3);
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (var i = 0; i < w * h / 70; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,' + r() * 0.05 + ')' : 'rgba(0,0,0,' + r() * 0.1 + ')'; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
      if (paint) paint(g, w, h, ink);
      // wear: lighter, rubbed patches where hands rest, darker around the edge
      for (var k = 0; k < 7; k++) { var x = r() * w, y = r() * h, gr = g.createRadialGradient(x, y, 4, x, y, w * (0.05 + r() * 0.08)); gr.addColorStop(0, 'rgba(255,240,200,.07)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
      for (var b = 0; b < 4; b++) { var bx = r() * w, by = r() * h; g.fillStyle = 'rgba(8,3,0,.7)'; g.beginPath(); g.arc(bx, by, 3 + r() * 3, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; g.stroke(); }  // cigarette burns
      for (var s = 0; s < 3; s++) { var sx = r() * w, sy = r() * h; g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 5 + r() * 6; g.beginPath(); g.arc(sx, sy, 10 + r() * 14, 0, 6.3); g.stroke(); }  // glass rings
      var vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
    });
  };
  /** Text laid along an arc around (cx, cy), centred on `ang` (canvas radians, y down), tops of the letters toward the centre, reading left to right. */
  K.arcText = function (g, text, cx, cy, rad, ang, size, spacing) {
    g.save(); g.font = '600 ' + size + 'px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var widths = [], total = 0;
    for (var i = 0; i < text.length; i++) { var w = g.measureText(text[i]).width + spacing; widths.push(w); total += w; }
    var a = ang + (total / rad) / 2;
    for (var j = 0; j < text.length; j++) {
      var step = widths[j] / rad; a -= step / 2;
      g.save(); g.translate(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); g.rotate(a - Math.PI / 2); g.fillText(text[j], 0, 0); g.restore();
      a -= step / 2;
    }
    g.restore();
  };

  // ───────────── playing cards ─────────────
  var SUITS = ['S', 'H', 'D', 'C'], GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
  var CW = 128, CH = 180, ATLAS_W = CW * 13, ATLAS_H = CH * 5;
  K.CARD_W = 0.064; K.CARD_H = 0.089;
  K.cardAtlas = function (scale) {
    var s = scale || 1;
    var tex = canvasTex(ATLAS_W * s, ATLAS_H * s, function (g) {
      g.scale(s, s);
      var r = rnd(99);
      function paper(x, y) {
        g.fillStyle = '#e6dcc3'; g.fillRect(x, y, CW, CH);
        speckle(g, CW, CH, 0, r, 0, '0');
        for (var i = 0; i < 90; i++) { g.fillStyle = 'rgba(' + (r() < 0.5 ? '90,60,20,' : '0,0,0,') + r() * 0.06 + ')'; g.fillRect(x + r() * CW, y + r() * CH, 1 + r() * 2, 1 + r() * 2); }
        var vg = g.createRadialGradient(x + CW / 2, y + CH / 2, 30, x + CW / 2, y + CH / 2, CH * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(60,35,10,.32)'); g.fillStyle = vg; g.fillRect(x, y, CW, CH);
      }
      for (var si = 0; si < 4; si++) for (var ri = 0; ri < 13; ri++) {
        var x = ri * CW, y = si * CH, suit = SUITS[si], red = suit === 'H' || suit === 'D', ink = red ? '#9d1f2a' : '#17120e', rank = RANKS[ri] === 'T' ? '10' : RANKS[ri];
        paper(x, y);
        g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '700 ' + (rank.length > 1 ? 34 : 40) + 'px "Cormorant Garamond", Georgia, serif'; g.fillText(rank, x + 22, y + 26);
        g.font = '30px Georgia, serif'; g.fillText(GLYPH[suit], x + 22, y + 58);
        g.save(); g.translate(x + CW - 22, y + CH - 26); g.rotate(Math.PI);
        g.font = '700 ' + (rank.length > 1 ? 34 : 40) + 'px "Cormorant Garamond", Georgia, serif'; g.fillText(rank, 0, 0); g.font = '30px Georgia, serif'; g.fillText(GLYPH[suit], 0, 32); g.restore();
        var face = 'JQK'.indexOf(RANKS[ri]) >= 0;
        if (face) {
          g.strokeStyle = ink; g.lineWidth = 2; g.strokeRect(x + 38, y + 30, 52, 120);
          g.fillStyle = red ? 'rgba(157,31,42,.18)' : 'rgba(23,18,14,.14)'; g.fillRect(x + 38, y + 30, 52, 120);
          g.fillStyle = ink; g.font = '700 54px "Cormorant Garamond", Georgia, serif'; g.fillText(RANKS[ri], x + CW / 2, y + CH / 2 - 8); g.font = '40px Georgia, serif'; g.fillText(GLYPH[suit], x + CW / 2, y + CH / 2 + 38);
        } else if (RANKS[ri] === 'A') { g.font = '86px Georgia, serif'; g.fillText(GLYPH[suit], x + CW / 2, y + CH / 2 + 4); }
        else {
          var n = +rank, cols = [x + 44, x + CW / 2, x + CW - 44], ys = [y + 40, y + 70, y + 90, y + 110, y + 140];
          var pips = { 2: [[1, 0], [1, 4]], 3: [[1, 0], [1, 2], [1, 4]], 4: [[0, 0], [2, 0], [0, 4], [2, 4]], 5: [[0, 0], [2, 0], [1, 2], [0, 4], [2, 4]], 6: [[0, 0], [2, 0], [0, 2], [2, 2], [0, 4], [2, 4]],
            7: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2], [0, 4], [2, 4]], 8: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2], [1, 3], [0, 4], [2, 4]], 9: [[0, 0], [2, 0], [0, 1.4], [2, 1.4], [1, 2], [0, 2.6], [2, 2.6], [0, 4], [2, 4]],
            10: [[0, 0], [2, 0], [1, .6], [0, 1.4], [2, 1.4], [0, 2.6], [2, 2.6], [1, 3.4], [0, 4], [2, 4]] }[n] || [];
          g.font = '30px Georgia, serif';
          pips.forEach(function (p) { var py = ys[0] + (ys[4] - ys[0]) * p[1] / 4; g.save(); g.translate(cols[p[0]], py); if (p[1] > 2) g.rotate(Math.PI); g.fillText(GLYPH[suit], 0, 0); g.restore(); });
        }
        g.strokeStyle = 'rgba(40,25,10,.5)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, CW - 2, CH - 2);
      }
      // the back: oxblood with a worn diamond lattice and a brass border (row 5, first cell)
      var bx = 0, by = 4 * CH;
      g.fillStyle = '#4e1218'; g.fillRect(bx, by, CW, CH);
      g.strokeStyle = 'rgba(214,170,90,.4)'; g.lineWidth = 1.2;
      for (var d = -CH; d < CW + CH; d += 14) { g.beginPath(); g.moveTo(bx + d, by); g.lineTo(bx + d + CH, by + CH); g.stroke(); g.beginPath(); g.moveTo(bx + d + CH, by); g.lineTo(bx + d, by + CH); g.stroke(); }
      g.strokeStyle = '#c9a45c'; g.lineWidth = 5; g.strokeRect(bx + 10, by + 10, CW - 20, CH - 20); g.lineWidth = 1.5; g.strokeRect(bx + 18, by + 18, CW - 36, CH - 36);
      g.fillStyle = '#c9a45c'; g.beginPath(); g.arc(bx + CW / 2, by + CH / 2, 16, 0, 6.3); g.fill(); g.fillStyle = '#4e1218'; g.beginPath(); g.arc(bx + CW / 2, by + CH / 2, 9, 0, 6.3); g.fill();
      for (var q = 0; q < 160; q++) { g.fillStyle = 'rgba(0,0,0,' + r() * 0.18 + ')'; g.fillRect(bx + r() * CW, by + r() * CH, 1 + r() * 2, 1 + r() * 2); }
      var vg2 = g.createRadialGradient(bx + CW / 2, by + CH / 2, 30, bx + CW / 2, by + CH / 2, CH * 0.8); vg2.addColorStop(0, 'rgba(0,0,0,0)'); vg2.addColorStop(1, 'rgba(0,0,0,.4)'); g.fillStyle = vg2; g.fillRect(bx, by, CW, CH);
    });
    tex.anisotropy = 8;
    return tex;
  };
  var cardGeos = {};
  /** A card's geometry: front quad facing up and back quad facing down, one draw call. `face` is 'AS', 'TH'… or null (shows the back both sides). */
  K.cardGeo = function (face) {
    var key = face || 'x';
    if (cardGeos[key]) return cardGeos[key];
    var u0, v0;
    if (face) { u0 = RANKS.indexOf(face[0]) / 13; v0 = 1 - (SUITS.indexOf(face[1]) + 1) / 5; } else { u0 = 0; v0 = 0; }
    var bu0 = 0, bv0 = 0, du = 1 / 13, dv = 1 / 5, hw = K.CARD_W / 2, hh = K.CARD_H / 2, e = 0.0008;
    var inset = 0.004;
    var pos = [-hw, e, -hh, hw, e, -hh, hw, e, hh, -hw, e, hh, -hw, -e, -hh, -hw, -e, hh, hw, -e, hh, hw, -e, -hh];
    var nor = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0];
    var uv = [u0 + inset, v0 + dv - inset, u0 + du - inset, v0 + dv - inset, u0 + du - inset, v0 + inset, u0 + inset, v0 + inset,
      bu0 + inset, bv0 + dv - inset, bu0 + inset, bv0 + inset, bu0 + du - inset, bv0 + inset, bu0 + du - inset, bv0 + dv - inset];
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex([0, 3, 2, 0, 2, 1, 4, 7, 6, 4, 6, 5]);
    return (cardGeos[key] = g);
  };

  // ───────────── chips ─────────────
  var CHIP_COL = { 25: '#d8d0bd', 100: '#a8322c', 500: '#2b5c9c', 1000: '#c9971c', 5000: '#6a2f8f', 25000: '#2a7a4a', 100000: '#1b1b1f' };
  K.CHIP_R = 0.028; K.CHIP_H = 0.0075;
  var chipGeoCache = {};
  /** A merged stack of chips for these denominations (bottom to top). */
  K.chipStackGeo = function (values) {
    var key = values.join(','); if (chipGeoCache[key]) return chipGeoCache[key];
    var b = new Builder(3);
    values.forEach(function (v, i) {
      var base = CHIP_COL[v] || '#888', g = new T.CylinderGeometry(K.CHIP_R, K.CHIP_R, K.CHIP_H, 18, 1).toNonIndexed();
      g.applyMatrix4(M(0, K.CHIP_H * (i + 0.5), 0));
      var p = g.attributes.position.array, n = g.attributes.normal.array, count = p.length / 3, tc = new T.Color(), a = new T.Color(base), light = new T.Color('#efe6cf');
      for (var t = 0; t < count; t += 3) {
        var ny = n[t * 3 + 1], cx = (p[t * 3] + p[(t + 1) * 3] + p[(t + 2) * 3]) / 3, cz = (p[t * 3 + 2] + p[(t + 1) * 3 + 2] + p[(t + 2) * 3 + 2]) / 3;
        var ang = Math.atan2(cz, cx), stripe = Math.floor((ang + Math.PI) / (Math.PI / 9)) % 2;
        if (ny > 0.5) { var r2 = Math.hypot(cx, cz); tc.copy(r2 > K.CHIP_R * 0.62 ? (stripe ? light : a) : a); tc.multiplyScalar(r2 > K.CHIP_R * 0.62 || r2 < K.CHIP_R * 0.3 ? 1 : 0.8); }
        else if (ny < -0.5) tc.copy(a).multiplyScalar(0.6); else tc.copy(stripe ? light : a);
        for (var q = 0; q < 3; q++) { b.pos.push(p[(t + q) * 3], p[(t + q) * 3 + 1], p[(t + q) * 3 + 2]); b.nor.push(n[(t + q) * 3], n[(t + q) * 3 + 1], n[(t + q) * 3 + 2]); b.uv.push(0, 0); b.col.push(tc.r, tc.g, tc.b); }
      }
      g.dispose();
    });
    return (chipGeoCache[key] = b.build());
  };

  // ───────────── the chair ─────────────
  K.chairGeo = function () {
    var b = new Builder(11), s = Shapes(b), wood = '#3a2416', dark = '#26160c';
    s.box(wood, 0, 0.44, 0, 0.5, 0.05, 0.48);                                  // seat
    s.box('#4a1d1d', 0, 0.475, 0, 0.44, 0.03, 0.42);                           // worn red cushion
    [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]].forEach(function (p) { s.box(dark, p[0], 0.21, p[1], 0.05, 0.42, 0.05); });
    s.box(wood, -0.22, 0.78, -0.22, 0.05, 0.62, 0.05); s.box(wood, 0.22, 0.78, -0.22, 0.05, 0.62, 0.05);
    s.box(wood, 0, 1.04, -0.22, 0.5, 0.1, 0.05); s.box(wood, 0, 0.82, -0.22, 0.4, 0.07, 0.04); s.box(wood, 0, 0.64, -0.22, 0.4, 0.07, 0.04);
    return b.build();
  };

  // ───────────── the sixteen regulars (plus the dealer) ─────────────
  // Each avatar id from the lobby is an animal in a coat. Heads are built facing +z around their own centre; the body
  // is hunched over the table. Everything is merged into three vertex-coloured meshes per animal.
  var SPEC = {
    fox:      { fur: '#c8601c', light: '#efdcbc', dark: '#241410', coat: '#4a2d22', eye: '#e6b93c' },
    tiger:    { fur: '#d99528', light: '#efe2c0', dark: '#1e130c', coat: '#2f3b2a', eye: '#cfd24a', hat: 'cap' },
    panda:    { fur: '#e8e4da', light: '#f4f1ea', dark: '#17140f', coat: '#32404a', eye: '#2a2018' },
    owl:      { fur: '#8c6238', light: '#d8c3a0', dark: '#241a10', coat: '#4a2630', eye: '#f0c030', hat: 'tophat' },
    frog:     { fur: '#4d9a45', light: '#bcd88a', dark: '#16260f', coat: '#4a3a20', eye: '#e8c040' },
    octopus:  { fur: '#c25a86', light: '#e8a6c0', dark: '#3a1226', coat: '#233844', eye: '#f2e2a0' },
    unicorn:  { fur: '#e4dff0', light: '#f6f2fb', dark: '#5a3a74', coat: '#50304e', eye: '#6a4a9a' },
    dragon:   { fur: '#a82f2f', light: '#d8a060', dark: '#2a0c0c', coat: '#2a2a30', eye: '#f0a020' },
    cat:      { fur: '#c8a064', light: '#f0e2c4', dark: '#2a1a10', coat: '#2b3b52', eye: '#9ccf52' },
    wolf:     { fur: '#7a8696', light: '#c8cfd8', dark: '#1a1e26', coat: '#3a3030', eye: '#e0c040' },
    koala:    { fur: '#8e949e', light: '#d4d8de', dark: '#16181c', coat: '#4a4030', eye: '#2a2018', hat: 'beanie' },
    shark:    { fur: '#587890', light: '#c8d6de', dark: '#16222c', coat: '#3a2a2a', eye: '#10141a' },
    monkey:   { fur: '#7a4a28', light: '#d8aa80', dark: '#1e1008', coat: '#4a4a2a', eye: '#2a1a10', hat: 'cap' },
    penguin:  { fur: '#22262e', light: '#eee8dc', dark: '#101216', coat: '#5a3a24', eye: '#e8e0c8', hat: 'tophat' },
    lion:     { fur: '#cc9540', light: '#e8c888', dark: '#5a2e12', coat: '#3a2236', eye: '#e8b030' },
    robot:    { fur: '#8a9498', light: '#bcc6c8', dark: '#262c30', coat: '#323a3a', eye: '#4fe0d0' },
    raven:    { fur: '#2c2e36', light: '#44474f', dark: '#0a0a0c', coat: '#2f4a30', eye: '#f0c030', hat: 'visor' }
  };
  GL.SPEC = SPEC;

  function hat(h, kind, S) {
    if (kind === 'tophat') { h.cyl('#141016', 0, 0.3, -0.01, 0, 0, 0, 0.115, 0.2, 0.115); h.cyl('#141016', 0, 0.205, -0.01, 0, 0, 0, 0.19, 0.022, 0.19); h.cyl(S.light === '#eee8dc' ? '#7a1a22' : '#7a5a1a', 0, 0.235, -0.01, 0, 0, 0, 0.12, 0.03, 0.12); }
    else if (kind === 'cap') { h.sph('#2a2e32', 0, 0.12, -0.005, 0.2, 0.12, 0.205); h.box('#2a2e32', 0, 0.115, 0.18, 0.2, 0.014, 0.12, 0.12); }
    else if (kind === 'beanie') { h.sph('#6a3a2a', 0, 0.15, 0, 0.215, 0.14, 0.215); h.sph('#8a5a3a', 0, 0.28, 0, 0.04); h.cyl('#4a2a1e', 0, 0.1, 0, 0, 0, 0, 0.214, 0.04, 0.214); }
    else if (kind === 'visor') { h.box('#1f6a3a', 0, 0.12, 0.17, 0.3, 0.012, 0.13, 0.2); h.box('#1a1a1c', 0, 0.115, 0.03, 0.34, 0.03, 0.06); }
  }

  /** Face and head furniture, by species. h = head Shapes; S = spec. Head radius is 0.2, facing +z. */
  var FACES = {
    fox: function (h, S) {
      h.cone(S.fur, 0.11, 0.26, -0.02, 0, 0, -0.25, 0.075, 0.2, 0.05); h.cone(S.fur, -0.11, 0.26, -0.02, 0, 0, 0.25, 0.075, 0.2, 0.05);
      h.cone(S.dark, 0.115, 0.255, 0.0, 0, 0, -0.25, 0.04, 0.12, 0.03); h.cone(S.dark, -0.115, 0.255, 0.0, 0, 0, 0.25, 0.04, 0.12, 0.03);
      h.cone(S.fur, 0, -0.045, 0.3, Math.PI / 2, 0, 0, 0.1, 0.24, 0.085); h.sph(S.dark, 0, -0.025, 0.425, 0.03);
      h.cone(S.light, 0.1, -0.1, 0.12, Math.PI / 2 + 0.3, 0.9, 0, 0.09, 0.16, 0.05); h.cone(S.light, -0.1, -0.1, 0.12, Math.PI / 2 + 0.3, -0.9, 0, 0.09, 0.16, 0.05);
    },
    tiger: function (h, S) {
      h.sph(S.fur, 0.135, 0.17, -0.02, 0.06, 0.06, 0.035); h.sph(S.fur, -0.135, 0.17, -0.02, 0.06, 0.06, 0.035); h.sph(S.dark, 0.135, 0.17, 0, 0.03, 0.03, 0.02); h.sph(S.dark, -0.135, 0.17, 0, 0.03, 0.03, 0.02);
      h.sph(S.light, 0, -0.07, 0.17, 0.12, 0.085, 0.09); h.sph(S.dark, 0, -0.02, 0.255, 0.032, 0.022, 0.022);
      for (var i = -1; i <= 1; i++) h.box(S.dark, i * 0.045, 0.16, 0.17, 0.014, 0.07, 0.01, 0.35 * -i, 0, 0);
      h.box(S.dark, 0.17, 0.0, 0.1, 0.012, 0.09, 0.04, 0, 0.3, 0.5); h.box(S.dark, -0.17, 0.0, 0.1, 0.012, 0.09, 0.04, 0, -0.3, -0.5);
    },
    panda: function (h, S) {
      h.sph(S.dark, 0.14, 0.17, -0.02, 0.075, 0.075, 0.05); h.sph(S.dark, -0.14, 0.17, -0.02, 0.075, 0.075, 0.05);
      h.sph(S.dark, 0.085, 0.04, 0.155, 0.065, 0.08, 0.04, 0, 0, 0.5); h.sph(S.dark, -0.085, 0.04, 0.155, 0.065, 0.08, 0.04);
      h.sph(S.light, 0, -0.065, 0.17, 0.1, 0.075, 0.085); h.sph(S.dark, 0, -0.02, 0.245, 0.032, 0.024, 0.022);
    },
    owl: function (h, S) {
      h.sph(S.light, 0.075, 0.04, 0.15, 0.085, 0.085, 0.04); h.sph(S.light, -0.075, 0.04, 0.15, 0.085, 0.085, 0.04);
      h.cone(S.fur, 0.12, 0.23, 0, 0, 0, -0.35, 0.06, 0.16, 0.05); h.cone(S.fur, -0.12, 0.23, 0, 0, 0, 0.35, 0.06, 0.16, 0.05);
      h.cone('#d79a2a', 0, -0.045, 0.2, Math.PI / 2 + 0.4, 0, 0, 0.05, 0.12, 0.05);
    },
    frog: function (h, S) {
      h.sph(S.fur, 0.1, 0.17, 0.08, 0.07); h.sph(S.fur, -0.1, 0.17, 0.08, 0.07);
      h.box(S.dark, 0, -0.075, 0.185, 0.28, 0.014, 0.05); h.box(S.light, 0, -0.11, 0.15, 0.24, 0.07, 0.08);
      h.sph(S.dark, 0.03, -0.02, 0.2, 0.012); h.sph(S.dark, -0.03, -0.02, 0.2, 0.012);
    },
    octopus: function (h, S) {
      h.sph(S.fur, 0, 0.12, -0.02, 0.17, 0.17, 0.17); h.sph(S.light, 0.07, 0.17, 0.12, 0.035); h.sph(S.light, -0.05, 0.2, 0.1, 0.03);
      [-0.13, -0.045, 0.045, 0.13].forEach(function (x, i) {              // four tentacles drape down over the coat
        var s2 = i % 2 ? 1 : -1;
        h.limb(S.fur, [x, -0.1, 0.16], [x * 1.4, -0.3, 0.27], 0.05, 0.04);
        h.limb(S.fur, [x * 1.4, -0.3, 0.27], [x * 1.7 + s2 * 0.02, -0.5, 0.25], 0.04, 0.022);
        h.sph(S.light, x * 1.4, -0.3, 0.3, 0.018);
      });
    },
    unicorn: function (h, S) {
      h.cone('#e8c34a', 0, 0.36, 0.08, 0.3, 0, 0, 0.04, 0.26, 0.04); h.cone(S.fur, 0.1, 0.24, -0.02, 0, 0, -0.2, 0.05, 0.13, 0.04); h.cone(S.fur, -0.1, 0.24, -0.02, 0, 0, 0.2, 0.05, 0.13, 0.04);
      h.sph(S.fur, 0, -0.04, 0.24, 0.1, 0.1, 0.14); h.sph(S.dark, 0.035, -0.04, 0.37, 0.012); h.sph(S.dark, -0.035, -0.04, 0.37, 0.012);
      h.sph('#d86ca8', 0, 0.12, -0.12, 0.1, 0.18, 0.08); h.sph('#6cb4d8', 0.1, 0.0, -0.13, 0.06, 0.16, 0.06); h.sph('#b888e8', -0.1, 0.0, -0.13, 0.06, 0.16, 0.06); h.sph('#d86ca8', 0, 0.18, 0.02, 0.1, 0.05, 0.06);
    },
    dragon: function (h, S) {
      h.cone('#d8c8a0', 0.1, 0.24, -0.07, -0.5, 0, -0.35, 0.04, 0.2, 0.04); h.cone('#d8c8a0', -0.1, 0.24, -0.07, -0.5, 0, 0.35, 0.04, 0.2, 0.04);
      for (var i = 0; i < 4; i++) h.cone(S.dark, 0, 0.19 - i * 0.04, -0.06 - i * 0.05, -0.6, 0, 0, 0.03, 0.08, 0.03);
      h.sph(S.fur, 0, -0.04, 0.24, 0.11, 0.08, 0.14); h.sph(S.dark, 0.04, -0.01, 0.36, 0.014); h.sph(S.dark, -0.04, -0.01, 0.36, 0.014);
      h.box('#e8e0c8', 0.045, -0.09, 0.3, 0.012, 0.03, 0.012); h.box('#e8e0c8', -0.045, -0.09, 0.3, 0.012, 0.03, 0.012);
      h.cone(S.light, 0.2, 0.0, 0.0, 0, 0, -Math.PI / 2, 0.06, 0.12, 0.06); h.cone(S.light, -0.2, 0.0, 0.0, 0, 0, Math.PI / 2, 0.06, 0.12, 0.06);
    },
    cat: function (h, S) {
      h.cone(S.fur, 0.125, 0.24, 0, 0, 0, -0.3, 0.075, 0.16, 0.04); h.cone(S.fur, -0.125, 0.24, 0, 0, 0, 0.3, 0.075, 0.16, 0.04);
      h.cone('#c88a8a', 0.125, 0.235, 0.02, 0, 0, -0.3, 0.04, 0.1, 0.02); h.cone('#c88a8a', -0.125, 0.235, 0.02, 0, 0, 0.3, 0.04, 0.1, 0.02);
      h.sph(S.light, 0, -0.07, 0.17, 0.1, 0.075, 0.07); h.sph('#c06a70', 0, -0.035, 0.24, 0.02, 0.014, 0.014);
      for (var i = 0; i < 3; i++) { h.box(S.light, 0.19, -0.06 + i * 0.022, 0.2, 0.15, 0.004, 0.004, 0, 0, 0.1 * (i - 1)); h.box(S.light, -0.19, -0.06 + i * 0.022, 0.2, 0.15, 0.004, 0.004, 0, 0, -0.1 * (i - 1)); }
    },
    wolf: function (h, S) {
      h.cone(S.fur, 0.12, 0.26, -0.03, 0, 0, -0.2, 0.07, 0.19, 0.045); h.cone(S.fur, -0.12, 0.26, -0.03, 0, 0, 0.2, 0.07, 0.19, 0.045);
      h.cone(S.dark, 0.12, 0.255, -0.01, 0, 0, -0.2, 0.04, 0.11, 0.03); h.cone(S.dark, -0.12, 0.255, -0.01, 0, 0, 0.2, 0.04, 0.11, 0.03);
      h.cone(S.fur, 0, -0.05, 0.3, Math.PI / 2, 0, 0, 0.1, 0.26, 0.085); h.sph(S.dark, 0, -0.03, 0.44, 0.032);
      h.cone(S.light, 0.19, -0.05, 0.0, 0, 0, -Math.PI / 2 + 0.2, 0.08, 0.14, 0.06); h.cone(S.light, -0.19, -0.05, 0.0, 0, 0, Math.PI / 2 - 0.2, 0.08, 0.14, 0.06);
    },
    koala: function (h, S) {
      h.sph(S.fur, 0.19, 0.12, -0.02, 0.1, 0.1, 0.06); h.sph(S.fur, -0.19, 0.12, -0.02, 0.1, 0.1, 0.06); h.sph(S.light, 0.19, 0.12, 0.02, 0.06, 0.06, 0.03); h.sph(S.light, -0.19, 0.12, 0.02, 0.06, 0.06, 0.03);
      h.sph(S.light, 0, -0.07, 0.15, 0.1, 0.075, 0.07); h.sph(S.dark, 0, -0.01, 0.235, 0.05, 0.07, 0.04);
    },
    shark: function (h, S) {
      h.cone(S.fur, 0, 0.3, -0.06, -0.35, 0, 0, 0.09, 0.24, 0.03);
      h.cone(S.fur, 0, -0.02, 0.28, Math.PI / 2, 0, 0, 0.14, 0.22, 0.1); h.sph(S.light, 0, -0.08, 0.17, 0.15, 0.08, 0.1);
      h.box(S.dark, 0, -0.095, 0.285, 0.26, 0.02, 0.01);
      for (var i = -3; i <= 3; i++) { h.cone('#f2ede0', i * 0.034, -0.075, 0.27, Math.PI, 0, 0, 0.012, 0.04, 0.012); h.cone('#f2ede0', i * 0.034, -0.115, 0.27, 0, 0, 0, 0.012, 0.035, 0.012); }
      h.cone(S.fur, 0.2, 0.0, 0.0, 0, 0, -Math.PI / 2, 0.05, 0.1, 0.04); h.cone(S.fur, -0.2, 0.0, 0.0, 0, 0, Math.PI / 2, 0.05, 0.1, 0.04);
    },
    monkey: function (h, S) {
      h.sph(S.fur, 0.2, 0.04, -0.01, 0.075, 0.075, 0.04); h.sph(S.light, 0.2, 0.04, 0.02, 0.05, 0.05, 0.03); h.sph(S.fur, -0.2, 0.04, -0.01, 0.075, 0.075, 0.04); h.sph(S.light, -0.2, 0.04, 0.02, 0.05, 0.05, 0.03);
      h.sph(S.light, 0, 0.03, 0.14, 0.14, 0.12, 0.08); h.sph(S.light, 0, -0.07, 0.19, 0.1, 0.08, 0.08); h.sph(S.dark, 0.025, -0.045, 0.265, 0.01); h.sph(S.dark, -0.025, -0.045, 0.265, 0.01);
      h.box(S.dark, 0, -0.1, 0.262, 0.07, 0.01, 0.01);
    },
    penguin: function (h, S) {
      h.sph(S.light, 0, -0.02, 0.07, 0.17, 0.17, 0.14); h.sph(S.fur, 0, 0.1, 0.06, 0.17, 0.08, 0.14);
      h.cone('#e29a2a', 0, -0.06, 0.24, Math.PI / 2 - 0.1, 0, 0, 0.06, 0.16, 0.035); h.cone('#c27a1a', 0, -0.095, 0.22, Math.PI / 2 - 0.2, 0, 0, 0.05, 0.12, 0.03);
    },
    lion: function (h, S) {
      h.sph(S.dark, 0, 0.0, -0.06, 0.3, 0.3, 0.2); for (var i = 0; i < 9; i++) { var a = (i / 9) * 6.28; h.sph(i % 2 ? '#6a3a16' : S.dark, Math.cos(a) * 0.27, Math.sin(a) * 0.27, -0.04, 0.07, 0.07, 0.06); }
      h.sph(S.fur, 0, 0, 0.0, 0.205, 0.195, 0.2); h.sph(S.fur, 0.1, 0.18, 0.0, 0.05, 0.05, 0.03); h.sph(S.fur, -0.1, 0.18, 0.0, 0.05, 0.05, 0.03);
      h.sph(S.light, 0, -0.07, 0.17, 0.11, 0.085, 0.07); h.sph(S.dark, 0, -0.03, 0.245, 0.034, 0.026, 0.02);
    },
    robot: function (h, S) {
      h.box(S.light, 0, 0.0, 0.0, 0.34, 0.3, 0.3); h.box(S.dark, 0, 0.03, 0.155, 0.28, 0.1, 0.01); h.box(S.dark, 0, -0.09, 0.155, 0.16, 0.05, 0.01);
      h.cyl(S.fur, 0, 0.21, 0, 0, 0, 0, 0.008, 0.12, 0.008); h.sph('#ff5a3a', 0, 0.28, 0, 0.03); h.box(S.fur, 0.18, 0.0, 0, 0.03, 0.1, 0.07); h.box(S.fur, -0.18, 0.0, 0, 0.03, 0.1, 0.07);
      for (var i = -2; i <= 2; i++) h.box(S.fur, i * 0.025, -0.09, 0.162, 0.008, 0.035, 0.005);
    },
    raven: function (h, S) {
      h.cone('#c9a45c', 0, -0.03, 0.3, Math.PI / 2 + 0.15, 0, 0, 0.065, 0.26, 0.05); h.cone('#8a6a2a', 0, -0.07, 0.28, Math.PI / 2 + 0.05, 0, 0, 0.05, 0.2, 0.04);
      h.cone(S.fur, 0, 0.17, -0.12, -0.9, 0, 0, 0.06, 0.2, 0.05); h.cone(S.light, 0, 0.1, -0.2, -1.2, 0, 0, 0.07, 0.22, 0.05);
    }
  };
  var NO_HEAD_SPHERE = { robot: 1, lion: 1 };

  /** Build one animal. Returns { root, body, head (pivot), eyes, parts }, all on the shared vertex-colour material. */
  K.buildAnimal = function (id, mat, opts) {
    opts = opts || {};
    var S = SPEC[id] || SPEC.cat, seed = 0; for (var i = 0; i < id.length; i++) seed += id.charCodeAt(i) * (i + 3);
    var root = new T.Group();
    // ── body: coat, arms, legs ──
    var bb = new Builder(seed), b = Shapes(bb), coat = S.coat, shirt = '#d8ccb0', hide = id === 'penguin' ? S.fur : S.fur;
    b.limb(coat, [0, 0.46, -0.02], [0, 0.95, 0.12], 0.27, 0.22, 1.18);                      // hunched torso
    b.sph(coat, 0, 0.96, 0.1, 0.25, 0.14, 0.18);                                              // shoulders' line
    b.box(shirt, 0, 0.78, 0.27, 0.11, 0.3, 0.02, 0.18);                                      // shirt front
    b.box('#14100c', 0, 0.86, 0.275, 0.025, 0.1, 0.02, 0.18);                                // tie / cravat
    for (var bt = 0; bt < 3; bt++) b.sph('#b8924a', 0, 0.66 - bt * 0.07, 0.29 - bt * 0.014, 0.012);
    b.box(coat, -0.1, 0.89, 0.255, 0.09, 0.11, 0.02, 0.28, 0, -0.5); b.box(coat, 0.1, 0.89, 0.255, 0.09, 0.11, 0.02, 0.28, 0, 0.5);   // lapels
    [-1, 1].forEach(function (sd) {
      var sh = [sd * 0.27, 0.93, 0.1], el = [sd * 0.34, 0.76, 0.2], ha = [sd * 0.18, 0.81, opts.reach || 0.46];
      b.sph(coat, sh[0], sh[1], sh[2], 0.115);
      b.limb(coat, sh, el, 0.1, 0.085); b.limb(coat, el, ha, 0.085, 0.07);
      if (id === 'penguin') { b.sph(S.fur, ha[0], ha[1], ha[2], 0.07, 0.04, 0.09); } else { b.sph(hide, ha[0], ha[1], ha[2], 0.065, 0.05, 0.07); b.sph(S.dark, ha[0] + sd * 0.012, ha[1] - 0.005, ha[2] + 0.07, 0.025, 0.02, 0.02); }
      if (!opts.standing) {
        b.limb('#241a24', [sd * 0.13, 0.52, 0.02], [sd * 0.14, 0.5, 0.42], 0.11, 0.09); b.limb('#241a24', [sd * 0.14, 0.5, 0.42], [sd * 0.14, 0.06, 0.45], 0.09, 0.07);
        b.box('#120e0c', sd * 0.14, 0.03, 0.52, 0.12, 0.06, 0.2);
      }
    });
    if (id === 'octopus' || id === 'dragon') b.sph(coat, 0, 0.98, 0.06, 0.2, 0.08, 0.16);
    var body = new T.Mesh(bb.build(), mat); body.castShadow = true;
    // ── head ──
    var hb = new Builder(seed + 1), h = Shapes(hb);
    if (!NO_HEAD_SPHERE[id]) hb.add(G.sphHi, S.fur, M(0, 0, 0, 0, 0, 0, 0.205, 0.195, 0.2));
    if (FACES[id]) FACES[id](h, S);
    if (S.hat) hat(h, S.hat, S);
    // heavy brows: everybody here is sizing everybody else up
    var ey = id === 'frog' ? 0.17 : id === 'owl' ? 0.04 : 0.04, ex = id === 'frog' ? 0.1 : id === 'owl' ? 0.075 : 0.082, ez = id === 'frog' ? 0.11 : id === 'owl' ? 0.19 : 0.165, er = id === 'owl' ? 0.05 : id === 'frog' ? 0.045 : 0.04;
    if (id !== 'robot' && id !== 'panda') [-1, 1].forEach(function (sd) { h.box(id === 'penguin' ? S.fur : S.fur, sd * ex, ey + er + 0.012, ez + 0.005, 0.1, 0.022, 0.05, 0, 0, sd * -0.32); });
    var head = new T.Mesh(hb.build(), mat); head.castShadow = true;
    // ── eyes (blink by scaling) ──
    var eb = new Builder(seed + 2), e = Shapes(eb);
    [-1, 1].forEach(function (sd) {
      if (id === 'robot') { e.box(S.eye, sd * 0.075, 0.03, 0.17, 0.07, 0.035, 0.02); return; }
      e.sph(id === 'panda' ? '#f4f1ea' : '#f2ecda', sd * ex, 0, ez - 0.02, er, er * 1.05, er * 0.8);
      if (id === 'shark') e.sph('#0a0c10', sd * ex, 0, ez + 0.005, er * 0.7, er * 0.75, er * 0.5);
      else { e.sph(S.eye === '#2a2018' ? '#3a2a18' : S.eye, sd * ex, 0, ez + 0.003, er * 0.62, er * 0.7, er * 0.45); e.sph('#07060a', sd * ex + sd * -0.003, 0, ez + er * 0.35, er * (id === 'cat' ? 0.2 : 0.34), er * (id === 'cat' ? 0.62 : 0.4), er * 0.25); }
    });
    var eyes = new T.Mesh(eb.build(), mat);
    var headY = id === 'frog' ? 0 : 0;
    var pivot = new T.Group(); pivot.position.set(0, 0.99, 0.14);
    head.position.set(0, 0.2 + headY, 0.08); eyes.position.set(0, 0.2 + ey, 0.08);
    // eyes were built about y = 0, so lift them to the eye line; head parts were built about the head centre
    pivot.add(head); pivot.add(eyes);
    root.add(body); root.add(pivot);
    if (opts.standing) root.position.y = 0.22;
    return { root: root, body: body, head: pivot, eyes: eyes, S: S };
  };
})(window);
