/*
 * Dragon Clash — dragon art pipeline.
 *
 * The body comes from the supplied Dragon Warrior pack, pre-split by tools/process_pack.py into grey shading
 * layers (main scales, belly, gold accents) plus fixed linework. Here each layer is tinted with the dragon's
 * colours using canvas compositing only (no pixel reads, so it works from file://), markings are painted onto
 * the scales, and modular parts (horns, wings, tails, spikes, armour, head pieces, eyes, accessories) are drawn
 * at anchor points the processing tool measured on every frame, so they stay attached while the body moves.
 *
 *   DCArt.load().then(...)
 *   DCArt.draw(ctx, look, bodyId, pose)   // pose from DCAnim.pose(...)
 */
(function () {
  'use strict';
  var RIG = window.DC_WARRIOR_RIG;
  var D = window.DC.Data;
  var imgs = {}, gearImgs = {};
  var ready = null;
  var cache = {};
  var CW = RIG.cell[0], CH = RIG.cell[1], RES = RIG.res || 1, PARTS = RIG.parts, ANIMS = RIG.anims || {};

  // Anchors in cell coordinates (sprite faces right, feet at RIG.feet)
  var A = {
    back: [93, 56], neck: [110, 50], chest: [116, 70], hip: [99, 101], tail: RIG.tailRoot,
    shoulderNear: [131, 56], shoulderFar: [88, 51], forearmNear: [136, 96], forearmFar: [77, 91], kneeNear: [118, 120], kneeFar: [96, 118],
  };

  function load() {
    if (ready) return ready;
    var names = Object.keys(RIG.layers);
    // Gear art made from the templates (assets/gear, built by tools/build_gear.py). Missing files use placeholders.
    var GF = (window.DC_GEAR && window.DC_GEAR.files) || {};
    Object.keys(GF).forEach(function (id) { var im = new Image(); im.onload = function () { gearImgs[id] = im; }; im.src = 'assets/gear/' + GF[id]; });
    ready = Promise.all(names.map(function (k) {
      return new Promise(function (res, rej) {
        var im = new Image();
        im.onload = function () { imgs[k] = im; res(); };
        im.onerror = function () { rej(new Error('Missing art: ' + RIG.layers[k])); };
        im.src = 'assets/warrior/' + RIG.layers[k];
      });
    }));
    return ready;
  }

  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // ─────────────── colour helpers ───────────────
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgbHex(r, g, b) { return '#' + ((1 << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).slice(1); }
  function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }
  function shade(h, k) { var c = hexRgb(h); return k < 0 ? rgbHex(c[0] * (1 + k), c[1] * (1 + k), c[2] * (1 + k)) : rgbHex(c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k); }
  function alpha(h, a) { var c = hexRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix(a, b, k) { var x = hexRgb(a), y = hexRgb(b); return rgbHex(x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k); }

  function tint(img, color, w, h) {
    var c = canvas(w || img.width, h || img.height), x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(img, 0, 0);
    return c;
  }

  // ─────────────── composed sheets per look ───────────────
  function lookKey(look) {
    return [look.primary, look.secondary, look.belly, look.markings].join('|');
  }

  function layered(prefix, look) {
    var base = imgs[prefix + '-main'];
    var c = canvas(base.width, base.height), x = c.getContext('2d');
    var main = tint(base, look.primary);
    paintMarkings(main, look, prefix);
    x.drawImage(main, 0, 0);
    if (imgs[prefix + '-belly']) x.drawImage(tint(imgs[prefix + '-belly'], look.belly), 0, 0);
    if (imgs[prefix + '-accent']) x.drawImage(tint(imgs[prefix + '-accent'], look.secondary), 0, 0);
    if (imgs[prefix + '-fixed']) x.drawImage(imgs[prefix + '-fixed'], 0, 0);
    return c;
  }

  function whiteOf(src) {
    var w = canvas(src.width, src.height), wx = w.getContext('2d');
    wx.drawImage(src, 0, 0); wx.globalCompositeOperation = 'source-in'; wx.fillStyle = '#fff'; wx.fillRect(0, 0, w.width, w.height);
    return w;
  }

  function composed(look) {
    var key = lookKey(look);
    if (cache[key]) return cache[key];
    var sheet = layered('body', look), rig = layered('rig', look);
    var entry = { sheet: sheet, rig: rig, tail: layered('tail', look), horns: layered('horns', look), anims: {} };
    // White silhouettes for hit flashes are built the first time they are needed
    var white = null, rigWhite = null;
    Object.defineProperty(entry, 'white', { get: function () { return white || (white = whiteOf(sheet)); } });
    Object.defineProperty(entry, 'rigWhite', { get: function () { return rigWhite || (rigWhite = whiteOf(rig)); } });
    cache[key] = entry;
    // Other pack animations (only present when their sheets were processed)
    Object.keys(ANIMS).forEach(function (n) { if (imgs['anim-' + n + '-main']) { var c = layered('anim-' + n, look), wc = null; cache[key].anims[n] = { sheet: c }; Object.defineProperty(cache[key].anims[n], 'white', { get: function () { return wc || (wc = whiteOf(c)); } }); } });
    return cache[key];
  }

  // Markings are painted onto the tinted scale layer only ('source-atop'), so they follow the art's silhouette.
  // Patterns are drawn in world units; RES converts to image pixels.
  function paintMarkings(main, look, prefix) {
    if (look.markings === 'none' || (prefix !== 'body' && prefix !== 'rig')) return;
    var x = main.getContext('2d');
    var col = look.markings === 'runes' || look.markings === 'embers' ? look.secondary : shade(look.primary, -0.45);
    x.globalCompositeOperation = 'source-atop';
    if (prefix === 'body') {
      for (var f = 0; f < RIG.frames; f++) {
        var d = RIG.frame[f];
        x.save(); x.translate((f % RIG.cols) * CW * RES, Math.floor(f / RIG.cols) * CH * RES); x.scale(RES, RES); x.translate(0, d.dy * 0.5);
        drawMarkingPattern(x, look.markings, col, look);
        x.restore();
      }
    } else {
      // Each rig part gets the same pattern, clipped to its own atlas cell
      Object.keys(PARTS).forEach(function (n) {
        var p = PARTS[n], r = p.rect;
        x.save(); x.beginPath(); x.rect(r[0], r[1], r[2], r[3]); x.clip();
        x.translate(r[0] - p.origin[0] * RES, r[1] - p.origin[1] * RES); x.scale(RES, RES);
        drawMarkingPattern(x, look.markings, col, look);
        x.restore();
      });
    }
    x.globalCompositeOperation = 'source-over';
  }

  function drawMarkingPattern(x, kind, col, look) {
    x.strokeStyle = col; x.fillStyle = col; x.lineCap = 'round'; x.lineJoin = 'round';
    var i;
    if (kind === 'stripes') {
      x.globalAlpha = 0.6; x.lineWidth = 3.2;
      for (i = 0; i < 9; i++) { x.beginPath(); x.moveTo(60 + i * 10, 40 + i * 9); x.lineTo(80 + i * 10, 30 + i * 9); x.stroke(); }
      for (i = 0; i < 6; i++) { x.beginPath(); x.moveTo(100, 108 + i * 7); x.lineTo(130, 100 + i * 7); x.stroke(); }
    } else if (kind === 'bolts') {
      x.globalAlpha = 0.8; x.lineWidth = 2.2;
      [[70, 60], [125, 62], [80, 105], [125, 110], [100, 40]].forEach(function (p) {
        x.beginPath(); x.moveTo(p[0], p[1] - 10); x.lineTo(p[0] + 4, p[1] - 2); x.lineTo(p[0] - 2, p[1] + 1); x.lineTo(p[0] + 3, p[1] + 10); x.stroke();
      });
    } else if (kind === 'spots') {
      x.globalAlpha = 0.55;
      [[74, 58, 4], [82, 70, 3], [70, 80, 3.5], [128, 64, 3], [134, 80, 2.5], [96, 112, 3.5], [122, 116, 3], [108, 128, 2.5], [86, 92, 2.5], [104, 44, 2.5]].forEach(function (p) {
        x.beginPath(); x.arc(p[0], p[1], p[2], 0, Math.PI * 2); x.fill();
      });
    } else if (kind === 'runes') {
      x.globalAlpha = 0.85; x.lineWidth = 1.4;
      [[76, 66], [130, 70], [96, 108], [124, 114], [80, 92]].forEach(function (p, k) {
        x.beginPath();
        x.moveTo(p[0] - 3, p[1] - 4); x.lineTo(p[0] + 3, p[1] - 4); x.lineTo(p[0], p[1] + 4); x.closePath();
        if (k % 2) { x.moveTo(p[0] - 4, p[1]); x.lineTo(p[0] + 4, p[1]); }
        x.stroke();
      });
    } else if (kind === 'waves') {
      x.globalAlpha = 0.55; x.lineWidth = 2.4;
      for (i = 0; i < 6; i++) {
        x.beginPath();
        for (var k = 0; k <= 8; k++) { var px = 62 + k * 10, py = 50 + i * 14 + Math.sin(k * 1.4) * 3; if (k) x.lineTo(px, py); else x.moveTo(px, py); }
        x.stroke();
      }
    } else if (kind === 'embers') {
      x.globalAlpha = 0.75;
      [[72, 64], [86, 78], [128, 66], [100, 112], [124, 120], [78, 96], [110, 46]].forEach(function (p) {
        x.beginPath(); x.moveTo(p[0], p[1] - 6); x.quadraticCurveTo(p[0] + 4, p[1], p[0], p[1] + 4); x.quadraticCurveTo(p[0] - 4, p[1], p[0], p[1] - 6); x.fill();
      });
    }
    x.globalAlpha = 1;
  }

  // ─────────────── modular parts (cell coordinates, facing right) ───────────────
  function headPt(f, p) { var d = RIG.frame[f]; return [p[0] + d.dx, p[1] + d.dy]; }

  function drawWing(x, look, pose, far) {
    var style = look.wings;
    if (style === 'none') return;
    var t = pose.time || 0;
    var flap = pose.wing != null ? pose.wing : 0.08 + Math.sin(t * 2.2) * 0.04;
    var size = (style === 'stub' ? 0.45 : style === 'crystal' ? 0.95 : style === 'fin' ? 0.8 : 0.88) * (far ? 0.92 : 1);
    var root = far ? [A.back[0] + 6, A.back[1] - 3] : A.back;
    var col = far ? shade(look.primary, -0.35) : shade(look.primary, -0.12);
    var mem = style === 'fin' ? alpha(look.secondary, far ? 0.45 : 0.6) : style === 'crystal' ? alpha(look.secondary, far ? 0.5 : 0.7) : far ? shade(look.belly, -0.45) : shade(look.belly, -0.2);
    var armA = (222 + flap * 40 + (far ? -8 : 0)) * Math.PI / 180;
    var L1 = 34 * size, L2 = 30 * size;
    var elbow = [root[0] + Math.cos(armA) * L1, root[1] + Math.sin(armA) * L1];
    var foreA = armA - 0.5 + flap * 0.6;
    var wrist = [elbow[0] + Math.cos(foreA) * L2, elbow[1] + Math.sin(foreA) * L2];
    var n = style === 'stub' ? 2 : 4;
    var tips = [];
    for (var k = 0; k < n; k++) {
      var fa = foreA + 0.3 - (k + 1) * (0.42 + flap * 0.18) * (style === 'storm' ? 0.9 : 1);
      var fl = (style === 'crystal' ? 44 : 40) * size * (1 - k * 0.12);
      tips.push([wrist[0] + Math.cos(fa) * fl, wrist[1] + Math.sin(fa) * fl]);
    }
    var base = [root[0] - 4, root[1] + 34 * size];
    x.save();
    x.lineJoin = 'round';
    if (style === 'crystal') {
      // Separate icy shards
      [elbow, wrist].concat(tips).forEach(function (p, k) {
        x.beginPath();
        var mid = [(root[0] + p[0]) / 2, (root[1] + p[1]) / 2];
        x.moveTo(root[0], root[1]); x.lineTo(mid[0] - 5, mid[1] + 3); x.lineTo(p[0], p[1]); x.lineTo(mid[0] + 4, mid[1] - 3); x.closePath();
        x.fillStyle = k % 2 ? mem : alpha(shade(look.secondary, 0.3), far ? 0.45 : 0.75); x.fill();
        x.strokeStyle = alpha('#ffffff', far ? 0.3 : 0.7); x.lineWidth = 0.8; x.stroke();
      });
      x.restore();
      return;
    }
    // Membrane
    x.beginPath();
    x.moveTo(root[0], root[1]); x.lineTo(elbow[0], elbow[1]); x.lineTo(wrist[0], wrist[1]);
    tips.forEach(function (p, k) {
      x.lineTo(p[0], p[1]);
      var nxt = k + 1 < tips.length ? tips[k + 1] : base;
      if (style === 'storm') x.lineTo((p[0] + nxt[0]) / 2 + 3, (p[1] + nxt[1]) / 2 + 5);
      else x.quadraticCurveTo((p[0] + nxt[0]) / 2 + (wrist[0] - (p[0] + nxt[0]) / 2) * 0.25, (p[1] + nxt[1]) / 2 + (wrist[1] - (p[1] + nxt[1]) / 2) * 0.25, nxt[0], nxt[1]);
    });
    x.lineTo(base[0], base[1]); x.closePath();
    x.fillStyle = mem; x.fill();
    if (style === 'ember') { x.strokeStyle = alpha('#ffb02e', far ? 0.4 : 0.8); x.lineWidth = 2; x.stroke(); }
    if (style === 'storm') { x.strokeStyle = alpha(look.secondary, far ? 0.5 : 0.95); x.lineWidth = 1.4; x.stroke(); }
    if (style === 'fin') {
      x.strokeStyle = alpha('#ffffff', far ? 0.2 : 0.45); x.lineWidth = 0.9;
      tips.forEach(function (p) { x.beginPath(); x.moveTo(wrist[0], wrist[1]); x.lineTo(p[0], p[1]); x.stroke(); });
    }
    // Bones
    x.strokeStyle = col; x.lineCap = 'round';
    x.lineWidth = 4.5 * size; x.beginPath(); x.moveTo(root[0], root[1]); x.lineTo(elbow[0], elbow[1]); x.lineTo(wrist[0], wrist[1]); x.stroke();
    if (style !== 'fin') {
      x.lineWidth = 1.8 * size;
      tips.forEach(function (p) { x.beginPath(); x.moveTo(wrist[0], wrist[1]); x.lineTo(p[0], p[1]); x.stroke(); });
    }
    if (style === 'stub') {
      x.fillStyle = shade(look.secondary, -0.2);
      tips.concat([elbow]).forEach(function (p) { x.beginPath(); x.moveTo(p[0] - 4, p[1] + 2); x.lineTo(p[0], p[1] - 7); x.lineTo(p[0] + 4, p[1] + 2); x.fill(); });
    }
    // Claw at the wrist
    x.fillStyle = shade(look.secondary, -0.1);
    x.beginPath(); x.arc(wrist[0], wrist[1], 1.8 * size, 0, Math.PI * 2); x.fill();
    if (style === 'ember') {
      tips.forEach(function (p, k) {
        var fl = 3 + Math.sin(t * 12 + k) * 1.5;
        x.fillStyle = alpha('#ffcf4a', far ? 0.5 : 0.9);
        x.beginPath(); x.moveTo(p[0] - 2, p[1]); x.quadraticCurveTo(p[0], p[1] - fl * 2.2, p[0] + 2, p[1]); x.fill();
      });
    }
    x.restore();
  }

  // A procedural tail: a tapered chain that swings from the root.
  function tailPoints(pose, len, n) {
    var t = pose.time || 0;
    var base = (pose.tailAngle || 0) + Math.PI - 0.5;
    var swing = pose.tailSwing != null ? pose.tailSwing : 0.08;
    var pts = [A.tail.slice()];
    var ang = base;
    for (var k = 1; k <= n; k++) {
      ang += Math.sin(t * 2.4 - k * 0.55) * swing * 0.35 + (0.75 + (pose.tailCurl || 0)) / n;
      var seg = len / n;
      var p = pts[k - 1];
      pts.push([p[0] + Math.cos(ang) * seg, p[1] + Math.sin(ang) * seg]);
    }
    return pts;
  }

  function drawTail(x, look, pose, art) {
    var style = look.tail;
    if (style === 'warrior') {
      var a = (pose.tailAngle || 0) + Math.sin((pose.time || 0) * 2.4) * (pose.tailSwing != null ? pose.tailSwing : 0.08) * 0.5;
      x.save(); x.translate(A.tail[0], A.tail[1]); x.rotate(a); x.translate(-A.tail[0], -A.tail[1]);
      x.drawImage(art.tail, 0, 0, CW, CH);
      x.restore();
      tailInfo = { tip: rotP([16, 136], A.tail, a), angle: Math.PI + a, mid: rotP([52, 130], A.tail, a) };
      return;
    }
    var n = 12, len = style === 'club' ? 52 : style === 'fluke' ? 58 : 62;
    var pts = tailPoints(pose, len, n);
    var w0 = style === 'club' ? 17 : 15;
    var left = [], right = [];
    for (var k = 0; k < pts.length; k++) {
      var p = pts[k], q = pts[Math.min(k + 1, pts.length - 1)], o = pts[Math.max(k - 1, 0)];
      var dx = q[0] - o[0], dy = q[1] - o[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      var w = w0 * (1 - k / (n + 1.5)) / 2;
      left.push([p[0] - dy / l * w, p[1] + dx / l * w]);
      right.push([p[0] + dy / l * w, p[1] - dx / l * w]);
    }
    x.save();
    x.lineJoin = 'round';
    // Dorsal spikes along the top edge
    if (style !== 'fluke' && style !== 'bolt') {
      x.fillStyle = style === 'crystal' ? alpha(shade(look.secondary, 0.2), 0.9) : look.secondary;
      for (k = 2; k < n - 1; k += 2) {
        var r0 = right[k], r1 = right[k + 1];
        var nx = r1[0] - r0[0], ny = r1[1] - r0[1];
        var h = (style === 'club' ? 7 : 6) * (1 - k / n);
        x.beginPath(); x.moveTo(r0[0], r0[1]); x.lineTo((r0[0] + r1[0]) / 2 + ny * 0.7 - nx * 0.2, (r0[1] + r1[1]) / 2 - nx * 0.7 * (h / 6) - h * 0.6); x.lineTo(r1[0], r1[1]); x.fill();
      }
    }
    x.beginPath();
    if (style === 'bolt') {
      x.moveTo(left[0][0], left[0][1]);
      for (k = 1; k < left.length; k++) x.lineTo(left[k][0] + (k % 2 ? 3 : -3), left[k][1] + (k % 2 ? -2 : 2));
      for (k = right.length - 1; k >= 0; k--) x.lineTo(right[k][0] + (k % 2 ? 3 : -3), right[k][1] + (k % 2 ? -2 : 2));
    } else {
      x.moveTo(left[0][0], left[0][1]);
      for (k = 1; k < left.length; k++) x.lineTo(left[k][0], left[k][1]);
      for (k = right.length - 1; k >= 0; k--) x.lineTo(right[k][0], right[k][1]);
    }
    x.closePath();
    var g = x.createLinearGradient(pts[0][0], pts[0][1] - 6, pts[0][0], pts[0][1] + 6);
    g.addColorStop(0, shade(look.primary, 0.08)); g.addColorStop(0.6, look.primary); g.addColorStop(1, shade(look.belly, -0.1));
    x.fillStyle = g; x.fill();
    x.strokeStyle = 'rgba(10,14,10,0.85)'; x.lineWidth = 1.1; x.stroke();
    // Tips
    var tip = pts[pts.length - 1], pre = pts[pts.length - 3];
    tailInfo = { tip: tip.slice(), angle: Math.atan2(tip[1] - pre[1], tip[0] - pre[0]), mid: pts[3].slice() };
    var ta = Math.atan2(tip[1] - pre[1], tip[0] - pre[0]);
    x.translate(tip[0], tip[1]); x.rotate(ta);
    var t = pose.time || 0;
    if (style === 'flame') {
      for (var j = 0; j < 3; j++) {
        var fl = 14 + Math.sin(t * 14 + j * 2) * 4 - j * 3;
        x.fillStyle = ['rgba(255,90,30,0.9)', 'rgba(255,170,40,0.9)', 'rgba(255,240,150,0.95)'][j];
        x.beginPath(); x.moveTo(-3, -6 + j * 2); x.quadraticCurveTo(fl * 0.6, -8 + j * 2 + Math.sin(t * 9) * 2, fl, 0); x.quadraticCurveTo(fl * 0.6, 8 - j * 2, -3, 6 - j * 2); x.fill();
      }
    } else if (style === 'crystal') {
      x.fillStyle = alpha(shade(look.secondary, 0.3), 0.95); x.strokeStyle = '#ffffff'; x.lineWidth = 0.8;
      x.beginPath(); x.moveTo(-2, -7); x.lineTo(18, 0); x.lineTo(-2, 7); x.lineTo(4, 0); x.closePath(); x.fill(); x.stroke();
    } else if (style === 'bolt') {
      x.fillStyle = look.secondary;
      x.beginPath(); x.moveTo(-2, -6); x.lineTo(8, -2); x.lineTo(4, 0); x.lineTo(16, 3); x.lineTo(2, 2); x.lineTo(6, 6); x.closePath(); x.fill();
      x.strokeStyle = alpha('#ffffff', 0.4 + 0.4 * Math.abs(Math.sin(t * 20))); x.lineWidth = 0.8; x.stroke();
    } else if (style === 'club') {
      x.fillStyle = shade(look.secondary, -0.25); x.strokeStyle = 'rgba(20,14,8,0.9)'; x.lineWidth = 1;
      x.beginPath(); x.ellipse(4, 0, 10, 8, 0, 0, Math.PI * 2); x.fill(); x.stroke();
      x.fillStyle = look.secondary;
      [[-2, -8], [8, -8], [13, 0], [8, 8], [-2, 8]].forEach(function (s) { x.beginPath(); x.moveTo(s[0] - 3, s[1] * 0.6); x.lineTo(s[0] * 1.15, s[1] * 1.45); x.lineTo(s[0] + 3, s[1] * 0.6); x.fill(); });
    } else if (style === 'fluke') {
      x.fillStyle = alpha(look.secondary, 0.85); x.strokeStyle = alpha(shade(look.primary, -0.4), 0.9); x.lineWidth = 1;
      x.beginPath(); x.moveTo(-4, 0); x.quadraticCurveTo(6, -4, 14, -14); x.quadraticCurveTo(9, -2, 12, 0); x.quadraticCurveTo(9, 2, 14, 14); x.quadraticCurveTo(6, 4, -4, 0); x.fill(); x.stroke();
    }
    x.restore();
  }

  function drawSpikes(x, look, f) {
    if (look.spikes === 'none') return;
    var line = [[106, 42], [97, 49], [90, 58], [86, 69], [85, 80], [86, 91]];
    x.save();
    line.forEach(function (p, k) {
      var s = (look.spikes === 'plates' ? 9 : 8) * (1 - k * 0.09);
      var dy = RIG.frame[f].dy * 0.5;
      x.save(); x.translate(p[0] + 3, p[1] + dy); x.rotate(-2.3 + k * 0.12);
      if (look.spikes === 'thorns') {
        x.fillStyle = look.secondary; x.beginPath(); x.moveTo(-3, 0); x.quadraticCurveTo(0, -s * 0.6, s * 0.2, -s * 1.4); x.lineTo(3, 0); x.fill();
      } else if (look.spikes === 'crystals') {
        x.fillStyle = alpha(shade(look.secondary, 0.2), 0.9); x.strokeStyle = alpha('#fff', 0.7); x.lineWidth = 0.6;
        x.beginPath(); x.moveTo(-3, 0); x.lineTo(0, -s * 1.6); x.lineTo(3, 0); x.closePath(); x.fill(); x.stroke();
      } else if (look.spikes === 'plates') {
        x.fillStyle = shade(look.secondary, -0.3); x.strokeStyle = 'rgba(20,14,8,0.85)'; x.lineWidth = 0.8;
        x.beginPath(); x.moveTo(-5, 0); x.lineTo(-3, -s); x.lineTo(4, -s * 0.8); x.lineTo(5, 0); x.closePath(); x.fill(); x.stroke();
      } else if (look.spikes === 'fins') {
        x.fillStyle = alpha(look.secondary, 0.75);
        x.beginPath(); x.moveTo(-4, 0); x.quadraticCurveTo(-2, -s * 1.3, 5, -s * 0.9); x.lineTo(4, 0); x.fill();
      }
      x.restore();
    });
    x.restore();
  }

  function drawHorns(x, look, f, art) {
    var st = look.horns;
    if (st === 'none') return;
    var d = RIG.frame[f];
    if (st === 'warrior') { x.drawImage(art.horns, d.dx, d.dy, CW, CH); return; }
    var r = headPt(f, RIG.hornRoot);
    x.save(); x.translate(r[0], r[1]); x.lineJoin = 'round';
    var col = look.secondary, dark = shade(look.secondary, -0.35), line = 'rgba(15,10,5,0.85)';
    // far horn first (smaller, darker), then near horn
    [[-5, 0.82, dark], [3, 1, col]].forEach(function (h) {
      x.save(); x.translate(h[0], 0); x.scale(h[1], h[1]); x.fillStyle = h[2]; x.strokeStyle = line; x.lineWidth = 0.9;
      x.beginPath();
      if (st === 'curved') { x.moveTo(-3, 2); x.bezierCurveTo(-6, -10, -14, -18, -26, -18); x.bezierCurveTo(-16, -14, -8, -8, 4, 1); }
      else if (st === 'crystal') { x.moveTo(-3, 2); x.lineTo(-10, -20); x.lineTo(-4, -16); x.lineTo(-1, -28); x.lineTo(3, -12); x.lineTo(5, 1); }
      else if (st === 'forked') { x.moveTo(-2, 2); x.lineTo(-6, -8); x.lineTo(-3, -9); x.lineTo(-10, -22); x.lineTo(-1, -11); x.lineTo(-4, -10); x.lineTo(4, 1); }
      else if (st === 'ram') { x.moveTo(-6, 3); x.bezierCurveTo(-20, -2, -24, -18, -10, -18); x.bezierCurveTo(0, -18, 2, -6, -6, -6); x.bezierCurveTo(-10, -6, -10, -12, -5, -12); x.bezierCurveTo(-12, -14, -16, -6, -8, -2); x.lineTo(4, 2); }
      else if (st === 'fin') { x.moveTo(-14, 6); x.quadraticCurveTo(-20, -14, -6, -24); x.quadraticCurveTo(-4, -10, 6, 2); }
      x.closePath(); x.fill(); x.stroke();
      if (st === 'crystal') { x.strokeStyle = alpha('#fff', 0.8); x.beginPath(); x.moveTo(-1, -2); x.lineTo(-1, -24); x.stroke(); }
      if (st === 'fin') { x.strokeStyle = alpha(shade(look.primary, -0.4), 0.8); x.lineWidth = 0.8; for (var k = 0; k < 4; k++) { x.beginPath(); x.moveTo(-2 - k * 2, 2); x.lineTo(-14 + k * 3, -20 + k * 4); x.stroke(); } }
      if (st === 'ram') { x.strokeStyle = alpha('#000', 0.35); x.lineWidth = 0.7; for (var j = 0; j < 5; j++) { x.beginPath(); x.arc(-10, -10, 4 + j * 1.6, 2.2, 3.6); x.stroke(); } }
      x.restore();
    });
    if (look.accessory === 'hornRings') {
      x.strokeStyle = '#ffd34a'; x.lineWidth = 1.6;
      x.beginPath(); x.ellipse(-1, -6, 3.5, 1.4, -0.5, 0, Math.PI * 2); x.stroke();
    }
    x.restore();
  }

  function drawHead(x, look, f, pose) {
    var st = look.head;
    var s = headPt(f, [128, 40]), e = headPt(f, [120.5, 36]), top = headPt(f, [108, 31]);
    var t = pose.time || 0;
    x.save(); x.lineJoin = 'round';
    var line = 'rgba(15,10,5,0.85)';
    if (st === 'beak') {
      x.fillStyle = shade(look.secondary, -0.05); x.strokeStyle = line; x.lineWidth = 0.9;
      x.beginPath(); x.moveTo(s[0] - 14, s[1] - 6); x.lineTo(s[0] + 7, s[1] - 1); x.lineTo(s[0] + 2, s[1] + 4); x.lineTo(s[0] - 9, s[1] + 1); x.closePath(); x.fill(); x.stroke();
    } else if (st === 'maw') {
      x.fillStyle = shade(look.secondary, -0.3); x.strokeStyle = line; x.lineWidth = 1;
      x.beginPath(); x.moveTo(s[0] - 18, s[1] + 2); x.lineTo(s[0] + 2, s[1] + 4); x.lineTo(s[0] - 2, s[1] + 11); x.lineTo(s[0] - 16, s[1] + 12); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#f2ead8';
      for (var k = 0; k < 3; k++) { x.beginPath(); x.moveTo(s[0] - 12 + k * 5, s[1] + 4); x.lineTo(s[0] - 10 + k * 5, s[1] + 0); x.lineTo(s[0] - 8 + k * 5, s[1] + 4); x.fill(); }
      x.fillStyle = shade(look.secondary, -0.35);
      x.beginPath(); x.moveTo(e[0] - 8, e[1] - 4); x.lineTo(e[0] + 6, e[1] - 5); x.lineTo(e[0] + 4, e[1] - 2); x.lineTo(e[0] - 7, e[1] - 1); x.closePath(); x.fill();
    } else if (st === 'frill') {
      x.fillStyle = alpha(look.secondary, 0.8); x.strokeStyle = alpha(shade(look.primary, -0.4), 0.9); x.lineWidth = 0.8;
      var c = headPt(f, [104, 42]);
      x.beginPath(); x.moveTo(c[0] + 4, c[1] - 6);
      for (var j = 0; j <= 4; j++) { var a = -2.6 + j * 0.45; x.lineTo(c[0] + Math.cos(a) * 15, c[1] + Math.sin(a) * 15); x.lineTo(c[0] + Math.cos(a + 0.22) * 9, c[1] + Math.sin(a + 0.22) * 9); }
      x.lineTo(c[0] + 2, c[1] + 6); x.closePath(); x.fill(); x.stroke();
    } else if (st === 'crest') {
      x.fillStyle = look.secondary; x.strokeStyle = line; x.lineWidth = 0.8;
      x.beginPath(); x.moveTo(top[0] + 10, top[1] + 1); x.lineTo(top[0] - 22, top[1] - 9); x.lineTo(top[0] - 4, top[1] + 5); x.closePath(); x.fill(); x.stroke();
    } else if (st === 'whiskers') {
      x.strokeStyle = look.secondary; x.lineWidth = 1.3; x.lineCap = 'round';
      for (var w = 0; w < 2; w++) {
        x.beginPath(); x.moveTo(s[0] - 3, s[1] + 2 + w * 2);
        x.bezierCurveTo(s[0] - 12, s[1] + 10 + w * 3, s[0] - 22, s[1] + 4 + Math.sin(t * 3 + w) * 4, s[0] - 30, s[1] + 12 + Math.sin(t * 3 + w + 1) * 5);
        x.stroke();
      }
      x.fillStyle = alpha('#ffcf4a', 0.6 + Math.sin(t * 10) * 0.3);
      x.beginPath(); x.arc(s[0] - 30, s[1] + 12 + Math.sin(t * 3 + 1) * 5, 1.6, 0, Math.PI * 2); x.fill();
    }
    x.restore();
  }

  function drawEyes(x, look, f, pose) {
    var st = look.eyes;
    if (st === 'warrior') return;
    var e = headPt(f, [120.8, 36.2]);
    x.save();
    var c = look.eye;
    if (st === 'glow' || st === 'fierce' || st === 'slit') {
      var g = x.createRadialGradient(e[0], e[1], 0, e[0], e[1], 6);
      g.addColorStop(0, alpha(c, 0.9)); g.addColorStop(1, alpha(c, 0));
      x.fillStyle = g; x.beginPath(); x.arc(e[0], e[1], 6, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = st === 'calm' ? '#fffdf2' : c;
    x.beginPath(); x.ellipse(e[0], e[1], 2.6, 1.7, -0.25, 0, Math.PI * 2); x.fill();
    x.fillStyle = st === 'calm' ? c : '#120a06';
    if (st === 'slit') { x.fillRect(e[0] - 0.4, e[1] - 1.6, 0.9, 3.2); }
    else if (st === 'calm') { x.beginPath(); x.arc(e[0] + 0.5, e[1], 1.2, 0, Math.PI * 2); x.fill(); }
    if (st === 'fierce') {
      x.strokeStyle = '#120a06'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(e[0] - 4, e[1] - 4); x.lineTo(e[0] + 4, e[1] - 1.5); x.stroke();
    }
    x.restore();
  }

  // Armour pieces are tagged with the bone they ride on, so in the rig they move with the limb.
  function drawArmor(x, look, f, only) {
    var st = look.armor;
    if (st === 'none') return;
    var dy = only ? 0 : RIG.frame[f].dy * 0.6;
    x.save(); x.translate(0, dy); x.lineJoin = 'round';
    var metal = shade(look.secondary, -0.15), line = 'rgba(15,10,5,0.9)';
    function want(bone) { return !only || only === bone; }
    function plate(p, w, h, rot, fill) {
      x.save(); x.translate(p[0], p[1]); x.rotate(rot);
      var g = x.createLinearGradient(0, -h, 0, h); g.addColorStop(0, shade(fill, 0.35)); g.addColorStop(1, shade(fill, -0.3));
      x.fillStyle = g; x.strokeStyle = line; x.lineWidth = 0.9;
      x.beginPath(); x.moveTo(-w, h * 0.4); x.quadraticCurveTo(-w * 0.8, -h, 0, -h); x.quadraticCurveTo(w * 0.8, -h, w, h * 0.4); x.quadraticCurveTo(0, h * 0.1, -w, h * 0.4); x.fill(); x.stroke();
      x.restore();
    }
    if (st === 'pauldrons') {
      if (want('nearArmUp')) plate(A.shoulderNear, 11, 8, 0.25, metal);
      if (want('farArmUp')) plate(A.shoulderFar, 8, 6, -0.3, shade(metal, -0.25));
    } else if (st === 'chest' && want('torso')) {
      var g = x.createLinearGradient(100, 54, 130, 84); g.addColorStop(0, shade(metal, 0.3)); g.addColorStop(1, shade(metal, -0.25));
      x.fillStyle = g; x.strokeStyle = line; x.lineWidth = 1;
      x.beginPath(); x.moveTo(104, 56); x.lineTo(128, 57); x.lineTo(130, 74); x.lineTo(117, 86); x.lineTo(103, 76); x.closePath(); x.fill(); x.stroke();
      x.strokeStyle = alpha('#ffffff', 0.35); x.beginPath(); x.moveTo(116, 58); x.lineTo(117, 84); x.stroke();
    } else if (st === 'rock') {
      var rock = shade(look.secondary, -0.35);
      [[A.shoulderNear, 13, 10, 0.2, 'nearArmUp'], [A.shoulderFar, 10, 8, -0.3, 'farArmUp'], [A.forearmNear, 8, 7, 0.4, 'nearArmLo'], [A.forearmFar, 7, 6, -0.4, 'farArmLo'], [A.kneeNear, 7, 6, 0.1, 'nearShin']].forEach(function (r) {
        if (!want(r[4])) return;
        x.save(); x.translate(r[0][0], r[0][1]); x.rotate(r[3]);
        x.fillStyle = rock; x.strokeStyle = line; x.lineWidth = 1;
        x.beginPath(); x.moveTo(-r[1], 2); x.lineTo(-r[1] * 0.6, -r[2]); x.lineTo(r[1] * 0.3, -r[2] * 1.1); x.lineTo(r[1], -r[2] * 0.2); x.lineTo(r[1] * 0.7, r[2] * 0.6); x.lineTo(-r[1] * 0.4, r[2] * 0.7); x.closePath(); x.fill(); x.stroke();
        x.strokeStyle = alpha('#000', 0.3); x.beginPath(); x.moveTo(-r[1] * 0.3, -r[2] * 0.6); x.lineTo(r[1] * 0.2, r[2] * 0.3); x.stroke();
        x.restore();
      });
    } else if (st === 'scale' && want('torso')) {
      x.strokeStyle = alpha('#000', 0.5); x.lineWidth = 0.5;
      x.fillStyle = alpha(shade(look.secondary, -0.35), 0.75);
      for (var r = 0; r < 4; r++) for (var c = 0; c < 4 - (r > 2 ? 1 : 0); c++) {
        var cx = 107 + c * 5 + (r % 2) * 2.5, cy = 58 + r * 5;
        x.beginPath(); x.arc(cx, cy, 2.5, 0, Math.PI); x.fill(); x.stroke();
      }
    }
    x.restore();
  }

  // only: 'head' (crown) or 'torso' (scarf, amulet); undefined draws everything (idle sheet)
  function drawAccessory(x, look, f, pose, only) {
    var st = look.accessory;
    if (st === 'none' || st === 'hornRings') return;
    var onHead = st === 'crown';
    if (only && (only === 'head') !== onHead) return;
    var t = pose.time || 0;
    x.save();
    if (st === 'crown') {
      var c = headPt(f, [112, 27]);
      x.translate(c[0], c[1]); x.rotate(-0.2);
      x.fillStyle = '#ffd34a'; x.strokeStyle = '#7a4c08'; x.lineWidth = 0.8;
      x.beginPath(); x.moveTo(-8, 3); x.lineTo(-8, -4); x.lineTo(-4, 0); x.lineTo(0, -6); x.lineTo(4, 0); x.lineTo(8, -4); x.lineTo(8, 3); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#ff3b5c'; x.beginPath(); x.arc(0, 0, 1.4, 0, Math.PI * 2); x.fill();
    } else if (st === 'scarf') {
      var n = headPt(f, [110, 50]);
      var flow = pose.scarf != null ? pose.scarf : 0.3;
      x.fillStyle = '#e8384f'; x.strokeStyle = '#7a1022'; x.lineWidth = 0.8;
      x.beginPath(); x.ellipse(n[0], n[1], 10, 4, 0.1, 0, Math.PI * 2); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(n[0] - 6, n[1]);
      x.bezierCurveTo(n[0] - 16, n[1] + 2 + Math.sin(t * 6) * 3, n[0] - 26 - flow * 10, n[1] - 4 + Math.sin(t * 6 + 1) * 4, n[0] - 34 - flow * 16, n[1] + 2 + Math.sin(t * 6 + 2) * 5);
      x.lineTo(n[0] - 32 - flow * 16, n[1] + 8 + Math.sin(t * 6 + 2) * 5);
      x.bezierCurveTo(n[0] - 24, n[1] + 6, n[0] - 14, n[1] + 8, n[0] - 4, n[1] + 4);
      x.closePath(); x.fill(); x.stroke();
    } else if (st === 'amulet') {
      var a = headPt(f, [118, 58]);
      var el = D.ELEMENTS[pose.element] || D.ELEMENTS.fire;
      x.strokeStyle = '#d8b04a'; x.lineWidth = 0.9;
      x.beginPath(); x.moveTo(a[0] - 8, a[1] - 6); x.quadraticCurveTo(a[0], a[1] + 2, a[0] + 7, a[1] - 7); x.stroke();
      var g = x.createRadialGradient(a[0], a[1], 0, a[0], a[1], 6);
      g.addColorStop(0, el.glow); g.addColorStop(0.5, alpha(el.color, 0.8)); g.addColorStop(1, alpha(el.color, 0));
      x.fillStyle = g; x.beginPath(); x.arc(a[0], a[1], 6, 0, Math.PI * 2); x.fill();
      x.fillStyle = el.color; x.beginPath(); x.arc(a[0], a[1], 2, 0, Math.PI * 2); x.fill();
    }
    x.restore();
  }

  // Blinks and the element glow in the mouth: drawn in head space, so they follow the head.
  function drawFace(x, look, f, pose) {
    var e = headPt(f, [120.8, 36.2]);
    if (pose.blink > 0) {
      x.save(); x.fillStyle = shade(look.primary, -0.15); x.strokeStyle = 'rgba(15,10,5,0.8)'; x.lineWidth = 0.6;
      x.beginPath(); x.ellipse(e[0], e[1] - 1.8 + 1.8 * pose.blink, 3.4, 1.9 * pose.blink + 0.3, -0.25, 0, Math.PI * 2); x.fill(); x.stroke();
      x.restore();
    }
    if (pose.mouth > 0.02) {
      var el = D.ELEMENTS[pose.element] || D.ELEMENTS.fire;
      var m = headPt(f, [129, 44]), r = 4 + 9 * pose.mouth;
      var g = x.createRadialGradient(m[0], m[1], 0, m[0], m[1], r);
      g.addColorStop(0, alpha('#ffffff', 0.95 * pose.mouth)); g.addColorStop(0.35, alpha(el.glow, 0.85 * pose.mouth)); g.addColorStop(1, alpha(el.color, 0));
      x.fillStyle = g; x.beginPath(); x.arc(m[0], m[1], r, 0, Math.PI * 2); x.fill();
    }
  }

  // ─────────────── gear: armour and weapons ───────────────
  var tailInfo = null;
  function rotP(p, c, a) { var s = Math.sin(a), k = Math.cos(a), dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * k - dy * s, c[1] + dx * s + dy * k]; }
  var MATERIAL = {
    scale: { base: '#a8743a', light: '#e8b878', dark: '#4a2a10' },
    iron:  { base: '#7d8796', light: '#e2e8f0', dark: '#262c36' },
    bone:  { base: '#d6c9a8', light: '#fffaea', dark: '#5a4a30' },
    steel: { base: '#9aa6b6', light: '#ffffff', dark: '#2a303a' },
  };
  // Which pieces ride on which bone. 'a:' = armour piece, 'w:<weapon>:' = weapon piece.
  var GEAR_ON = {
    head: ['a:helm', 'w:hornspikes:hornspikes'], torso: ['a:chest'],
    nearArmUp: ['a:pauldron-near'], farArmUp: ['a:pauldron-far'],
    nearArmLo: ['a:bracer-near', 'w:talons:talons-near', 'w:greatclaws:greatclaws-near'], farArmLo: ['a:bracer-far', 'w:talons:talons-far', 'w:greatclaws:greatclaws-far'],
    nearShin: ['a:greave-near'], farShin: ['a:greave-far'],
  };

  function gearPieces(gear, bone) {
    if (!gear) return [];
    var out = [];
    (GEAR_ON[bone] || []).forEach(function (code) {
      var p = code.split(':');
      if (p[0] === 'a' && gear.armor && gear.armor !== 'none') out.push({ id: 'armor-' + gear.armor + '-' + p[1], piece: p[1], mat: gear.armor });
      if (p[0] === 'w' && gear.weapon === p[1]) out.push({ id: 'weapon-' + p[2], piece: p[2], mat: 'steel' });
    });
    return out;
  }

  /** Draw the gear for one bone (in that bone's space), or every piece when bone is null (idle frames). */
  function drawGear(x, gear, bone, dy) {
    if (!gear) return;
    var bones = bone ? [bone] : Object.keys(GEAR_ON);
    bones.forEach(function (b) {
      gearPieces(gear, b).forEach(function (pc) {
        x.save();
        if (dy) x.translate(0, b === 'head' ? dy : dy * 0.6);
        var img = gearImgs[pc.id];
        // Template space: 960x960 at 2x the pack's 480 px cells, origin at source (0,0) = cell units (-15, -70)
        if (img) x.drawImage(img, -15, -70, 240, 240);
        else placeholder(x, pc.piece, MATERIAL[pc.mat] || MATERIAL.iron);
        x.restore();
      });
    });
  }

  function plateShape(x, cx, cy, w, h, rot, M) {
    x.save(); x.translate(cx, cy); x.rotate(rot || 0);
    var g = x.createLinearGradient(0, -h, 0, h); g.addColorStop(0, M.light); g.addColorStop(0.45, M.base); g.addColorStop(1, M.dark);
    x.fillStyle = g; x.strokeStyle = M.dark; x.lineWidth = 0.9;
    x.beginPath(); x.moveTo(-w, h * 0.5); x.quadraticCurveTo(-w * 0.9, -h, 0, -h); x.quadraticCurveTo(w * 0.9, -h, w, h * 0.5); x.quadraticCurveTo(0, h * 0.2, -w, h * 0.5); x.fill(); x.stroke();
    x.fillStyle = M.light; x.beginPath(); x.arc(-w * 0.5, 0, 0.9, 0, Math.PI * 2); x.arc(w * 0.5, 0, 0.9, 0, Math.PI * 2); x.fill();
    x.restore();
  }

  function blade(x, x0, y0, x1, y1, w, M) {
    var dx = x1 - x0, dy = y1 - y0, l = Math.sqrt(dx * dx + dy * dy), nx = -dy / l * w, ny = dx / l * w;
    var g = x.createLinearGradient(x0 + nx, y0 + ny, x0 - nx, y0 - ny); g.addColorStop(0, M.light); g.addColorStop(1, M.base);
    x.fillStyle = g; x.strokeStyle = M.dark; x.lineWidth = 0.7;
    x.beginPath(); x.moveTo(x0 + nx, y0 + ny); x.lineTo(x1, y1); x.lineTo(x0 - nx, y0 - ny); x.closePath(); x.fill(); x.stroke();
  }

  // Simple stand-ins in the right place and material, until the drawn pieces arrive
  function placeholder(x, piece, M) {
    switch (piece) {
      case 'helm':
        x.save(); var g = x.createLinearGradient(100, 24, 120, 40); g.addColorStop(0, M.light); g.addColorStop(1, M.base);
        x.fillStyle = g; x.strokeStyle = M.dark; x.lineWidth = 0.9;
        x.beginPath(); x.moveTo(97, 41); x.quadraticCurveTo(99, 23, 116, 25); x.lineTo(126, 31); x.lineTo(129, 37); x.lineTo(124, 37); x.lineTo(118, 33); x.lineTo(106, 36); x.lineTo(103, 43); x.closePath(); x.fill(); x.stroke();
        x.strokeStyle = M.dark; x.beginPath(); x.moveTo(104, 28); x.lineTo(112, 34); x.stroke(); x.restore(); break;
      case 'chest':
        x.save(); var gc = x.createLinearGradient(100, 54, 132, 90); gc.addColorStop(0, M.light); gc.addColorStop(0.5, M.base); gc.addColorStop(1, M.dark);
        x.fillStyle = gc; x.strokeStyle = M.dark; x.lineWidth = 1;
        x.beginPath(); x.moveTo(103, 56); x.lineTo(128, 56); x.lineTo(131, 74); x.lineTo(118, 89); x.lineTo(102, 78); x.closePath(); x.fill(); x.stroke();
        x.strokeStyle = M.light; x.globalAlpha *= 0.6; x.beginPath(); x.moveTo(116, 58); x.lineTo(117, 86); x.moveTo(104, 66); x.lineTo(129, 66); x.stroke(); x.restore(); break;
      case 'pauldron-near': plateShape(x, 128, 59, 11, 8, 0.3, M); break;
      case 'pauldron-far': plateShape(x, 92, 53, 9, 7, -0.3, { base: M.dark, light: M.base, dark: '#111' }); break;
      case 'bracer-near': plateShape(x, 135, 95, 7, 8, 0.4, M); break;
      case 'bracer-far': plateShape(x, 80, 88, 6, 7, -0.3, { base: M.dark, light: M.base, dark: '#111' }); break;
      case 'greave-near': plateShape(x, 129, 130, 7, 11, 0.1, M); break;
      case 'greave-far': plateShape(x, 90, 130, 6, 10, -0.1, { base: M.dark, light: M.base, dark: '#111' }); break;
      case 'talons-near': [[-4, 0], [0, 2], [4, 1]].forEach(function (o) { blade(x, 138 + o[0], 106 + o[1], 143 + o[0] * 1.3, 117 + o[1], 1.6, M); }); break;
      case 'talons-far': [[-3, 0], [1, 2], [4, 1]].forEach(function (o) { blade(x, 80 + o[0], 110 + o[1], 77 + o[0] * 1.3, 120 + o[1], 1.4, { base: M.dark, light: M.base, dark: '#111' }); }); break;
      case 'greatclaws-near': blade(x, 134, 94, 156, 124, 3.2, M); blade(x, 138, 98, 152, 128, 2.4, M); break;
      case 'greatclaws-far': blade(x, 82, 90, 70, 122, 2.8, { base: M.dark, light: M.base, dark: '#111' }); break;
      case 'hornspikes':
        blade(x, 112, 26, 102, 4, 3, M); blade(x, 120, 26, 116, 6, 2.6, M); break;
    }
  }

  /** Tail weapon and tail guard, at the tail's live position. Called right after the tail is drawn. */
  function drawTailGear(x, gear) {
    if (!gear || !tailInfo) return;
    if (gear.armor && gear.armor !== 'none') {
      var M = MATERIAL[gear.armor], img = gearImgs['armor-' + gear.armor + '-tailguard'];
      if (img) x.drawImage(img, -15, -70, 240, 240);
      else { var m = tailInfo.mid; plateShape(x, m[0], m[1] - 3, 7, 5, tailInfo.angle - Math.PI, M); plateShape(x, (m[0] + A.tail[0]) / 2, (m[1] + A.tail[1]) / 2 - 4, 8, 6, tailInfo.angle - Math.PI, M); }
    }
    if (gear.weapon === 'tailmace') {
      var t = tailInfo.tip, mi = gearImgs['weapon-tailmace'];
      x.save(); x.translate(t[0], t[1]); x.rotate(tailInfo.angle);
      if (mi) x.drawImage(mi, -64, -64, 128, 128);   // 512 px canvas = 128 units, attach point at the centre
      else {
        var S = MATERIAL.steel;
        for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4; blade(x, Math.cos(a) * 6, Math.sin(a) * 6, Math.cos(a) * 13, Math.sin(a) * 13, 2, S); }
        var g = x.createRadialGradient(-2, -2, 1, 0, 0, 8); g.addColorStop(0, S.light); g.addColorStop(1, S.dark);
        x.fillStyle = g; x.beginPath(); x.arc(0, 0, 8, 0, Math.PI * 2); x.fill();
      }
      x.restore();
    }
  }

  // ─────────────── cutout rig ───────────────
  // Bone angles (radians, + = clockwise with the dragon facing right). Arms and legs at 0 hang as painted;
  // + swings a limb backward, − forward. Torso + leans forward, head + tips the snout down.
  function boneChain(name) {
    var chain = [];
    for (var n = name; n && n !== 'root'; n = PARTS[n].parent) chain.unshift(n);
    return chain;
  }

  function enter(ctx, name, pose) {
    var b = pose.bones || {};
    ctx.translate(0, pose.hip || 0);
    var chain = boneChain(name);
    for (var i = 0; i < chain.length; i++) {
      var p = PARTS[chain[i]].pivot, a = b[chain[i]] || 0;
      if (!a) continue;
      ctx.translate(p[0], p[1]); ctx.rotate(a); ctx.translate(-p[0], -p[1]);
    }
  }

  function part(ctx, atlas, name) {
    var p = PARTS[name]; if (!p) return;
    var r = p.rect;
    ctx.drawImage(atlas, r[0], r[1], r[2], r[3], p.origin[0], p.origin[1], p.size[0], p.size[1]);
  }

  function drawRig(ctx, look, art, pose) {
    function bone(name, fn) { ctx.save(); enter(ctx, name, pose); fn(); ctx.restore(); }
    var flash = pose.flash > 0 ? Math.min(1, pose.flash) : 0;
    function limb(name) {
      part(ctx, art.rig, name);
      drawArmor(ctx, look, 0, name);
      drawGear(ctx, pose.gear, name);
      if (flash) { var a = ctx.globalAlpha; ctx.globalAlpha = a * flash; part(ctx, art.rigWhite, name); ctx.globalAlpha = a; }
    }
    bone('torso', function () { drawWing(ctx, look, pose, true); });
    bone('farArmUp', function () { limb('farArmUp'); });
    bone('farArmLo', function () { limb('farArmLo'); });
    ctx.save(); ctx.translate(0, pose.hip || 0); drawTail(ctx, look, pose, art); drawTailGear(ctx, pose.gear); ctx.restore();
    bone('farThigh', function () { limb('farThigh'); });
    bone('farShin', function () { limb('farShin'); });
    bone('torso', function () { drawSpikes(ctx, look, 0); drawWing(ctx, look, pose, false); limb('torso'); drawAccessory(ctx, look, 0, pose, 'torso'); });
    bone('nearThigh', function () { limb('nearThigh'); });
    bone('nearShin', function () { limb('nearShin'); });
    bone('head', function () {
      limb('head');
      drawHead(ctx, look, 0, pose); drawHorns(ctx, look, 0, art); drawEyes(ctx, look, 0, pose); drawFace(ctx, look, 0, pose);
      drawAccessory(ctx, look, 0, pose, 'head');
    });
    bone('nearArmUp', function () { limb('nearArmUp'); });
    bone('nearArmLo', function () { limb('nearArmLo'); });
  }

  // The real 24-frame idle from the pack, with the modular parts on its per-frame anchors.
  function drawSheet(ctx, look, art, pose, f) {
    drawWing(ctx, look, pose, true);
    drawTail(ctx, look, pose, art);
    drawTailGear(ctx, pose.gear);
    drawSpikes(ctx, look, f);
    drawWing(ctx, look, pose, false);
    var sxp = (f % RIG.cols) * CW * RES, syp = Math.floor(f / RIG.cols) * CH * RES;
    ctx.drawImage(art.sheet, sxp, syp, CW * RES, CH * RES, 0, 0, CW, CH);
    drawArmor(ctx, look, f);
    drawGear(ctx, pose.gear, null, RIG.frame[f].dy);
    drawHead(ctx, look, f, pose);
    drawHorns(ctx, look, f, art);
    drawEyes(ctx, look, f, pose);
    drawFace(ctx, look, f, pose);
    drawAccessory(ctx, look, f, pose);
    if (pose.flash > 0) {
      ctx.globalAlpha *= Math.min(1, pose.flash);
      ctx.drawImage(art.white, sxp, syp, CW * RES, CH * RES, 0, 0, CW, CH);
    }
  }

  // A frame from one of the pack's other animation sheets. The painted body (with its own horns and tail) is the
  // art; wings, head pieces, eyes and face effects ride on the eye tracked in that frame.
  function drawPackFrame(ctx, look, art, pose) {
    var a = ANIMS[pose.anim.name], sh = art.anims[pose.anim.name];
    if (!a || !sh) return false;
    var f = Math.max(0, Math.min(a.frames - 1, pose.anim.frame | 0));
    var ox = RIG.feet[0] - a.feet[0], oy = RIG.feet[1] - a.feet[1];
    var eye = a.eyes[f], idleEye = RIG.frame[0].eye;
    var ex = eye ? eye[0] + ox - idleEye[0] : 0, ey = eye ? eye[1] + oy - idleEye[1] : 0;
    ctx.save(); ctx.translate(ex, ey); drawWing(ctx, look, pose, true); drawWing(ctx, look, pose, false); ctx.restore();
    var sx = (f % a.cols) * a.cell[0] * RES, sy = Math.floor(f / a.cols) * a.cell[1] * RES;
    ctx.drawImage(sh.sheet, sx, sy, a.cell[0] * RES, a.cell[1] * RES, ox, oy, a.cell[0], a.cell[1]);
    if (eye) {
      ctx.save(); ctx.translate(ex, ey);
      drawHead(ctx, look, 0, pose); drawEyes(ctx, look, 0, pose); drawFace(ctx, look, 0, pose); drawAccessory(ctx, look, 0, pose, 'head');
      ctx.restore();
    }
    if (pose.flash > 0) { ctx.globalAlpha *= Math.min(1, pose.flash); ctx.drawImage(sh.white, sx, sy, a.cell[0] * RES, a.cell[1] * RES, ox, oy, a.cell[0], a.cell[1]); }
    return true;
  }

  /**
   * Draw a dragon with its feet at (0, 0) of the current transform, facing right before `pose.facing`.
   * pose: { time, frame, facing, lean, rot, pivot, sx, sy, dx, dy, hip, bones, idleMix, wing, tailAngle,
   *         tailSwing, tailCurl, flash, alpha, element, glow, mouth, blink, scarf }
   * idleMix 1 = the pack's real idle frames, 0 = the cutout rig posed by `bones`; between = a short crossfade.
   */
  function draw(ctx, look, bodyId, pose) {
    if (!imgs['body-main']) return;
    var art = composed(look);
    var body = D.BODIES[bodyId] || D.BODIES.balanced;
    var f = ((pose.frame != null ? pose.frame : Math.floor((pose.time || 0) * RIG.fps)) % RIG.frames + RIG.frames) % RIG.frames;
    var mix = pose.bones ? (pose.idleMix != null ? pose.idleMix : 0) : 1;
    ctx.save();
    ctx.translate(pose.dx || 0, pose.dy || 0);
    if (pose.alpha != null) ctx.globalAlpha *= pose.alpha;
    ctx.scale(pose.facing || 1, 1);
    if (pose.lean) ctx.rotate(pose.lean);
    var piv = (pose.pivot || 0) * CH * body.scale[1];
    if (pose.rot) { ctx.translate(0, -piv); ctx.rotate(pose.rot); ctx.translate(0, piv); }
    ctx.scale(body.scale[0] * (pose.sx || 1), body.scale[1] * (pose.sy || 1));
    ctx.translate(-RIG.feet[0], -RIG.feet[1]);
    var a0 = ctx.globalAlpha;
    // Three sources, crossfaded briefly at transitions: the pack's idle frames, the pack's other sheets, the rig.
    var am = pose.anim && art.anims[pose.anim.name] ? (pose.animMix != null ? pose.animMix : 1) : 0;
    var wIdle = mix, wPack = (1 - mix) * am, wRig = (1 - mix) * (1 - am);
    if (wIdle > 0.001) { ctx.save(); ctx.globalAlpha = a0 * Math.min(1, wIdle); drawSheet(ctx, look, art, pose, f); ctx.restore(); }
    if (wPack > 0.001) { ctx.save(); ctx.globalAlpha = a0 * wPack; drawPackFrame(ctx, look, art, pose); ctx.restore(); }
    if (wRig > 0.001) { ctx.save(); ctx.globalAlpha = a0 * wRig; drawRig(ctx, look, art, pose); ctx.restore(); }
    ctx.restore();
  }

  // Forward kinematics: where a point on a rig part ends up, relative to the dragon's feet, for a given pose.
  var TIPS = { nearHand: ['nearArmLo', [140, 108]], farHand: ['farArmLo', [83, 112]], mouth: ['head', [130, 44]], hornTip: ['head', [112, 14]], nearFoot: ['nearShin', [134, 150]], farFoot: ['farShin', [85, 150]] };
  function rot(p, c, a) { var s = Math.sin(a), k = Math.cos(a), dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * k - dy * s, c[1] + dx * s + dy * k]; }
  function pointOf(tip, bodyId, pose) {
    var t = TIPS[tip], body = D.BODIES[bodyId] || D.BODIES.balanced, b = pose.bones || {};
    var p = t[1].slice();
    var chain = boneChain(t[0]);
    for (var i = chain.length - 1; i >= 0; i--) p = rot(p, PARTS[chain[i]].pivot, b[chain[i]] || 0);
    p[1] += pose.hip || 0;
    p = [(p[0] - RIG.feet[0]) * body.scale[0] * (pose.sx || 1), (p[1] - RIG.feet[1]) * body.scale[1] * (pose.sy || 1)];
    if (pose.rot) { var piv = (pose.pivot || 0) * CH * body.scale[1]; p = rot(p, [0, -piv], pose.rot); }
    if (pose.lean) p = rot(p, [0, 0], pose.lean);
    return [p[0] * (pose.facing || 1) + (pose.dx || 0), p[1] + (pose.dy || 0)];
  }

  /** World-space point of an anchor for effects (mouth, chest...). */
  function anchor(name, bodyId, facing, frame) {
    var body = D.BODIES[bodyId] || D.BODIES.balanced;
    var f = frame || 0, p;
    if (name === 'mouth') p = headPt(f, [130, 44]);
    else if (name === 'eye') p = headPt(f, [120.8, 36.2]);
    else if (name === 'head') p = headPt(f, [112, 30]);
    else p = A[name] || A.chest;
    return [(p[0] - RIG.feet[0]) * body.scale[0] * (facing || 1), (p[1] - RIG.feet[1]) * body.scale[1]];
  }

  window.DCArt = { gearImgs: gearImgs, packAnims: ANIMS, prepare: function (look) { if (imgs['body-main']) composed(look); }, load: load, draw: draw, anchor: anchor, pointOf: pointOf, shade: shade, alpha: alpha, mix: mix, rig: RIG, CW: CW, CH: CH };
})();
