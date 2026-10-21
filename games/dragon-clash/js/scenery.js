/*
 * Dragon Clash — painted arenas.
 *
 * Every layer is painted procedurally, pixel by pixel, once when an arena is first shown (and again only if the
 * window size changes a lot), then drawn every frame with parallax. Nothing is a flat shape: skies are dithered
 * gradients, clouds and rock are fractal noise lit from the sun's direction, mountains get slope lighting, strata,
 * snow and atmospheric haze, and the stone platforms are textured sprites with moss or snow, cracks and roots.
 * Motion (drifting clouds, birds, forge smoke, waterfalls, aurora, mist, snow) is drawn live on top.
 *
 *   DCScenery.backdrop(ctx, arena, cam, W, H, t)       behind everything (screen space)
 *   DCScenery.platforms(ctx, arena, t)                 world space, before the fighters
 *   DCScenery.foreground(ctx, arena, cam, W, H, t)     in front of the world, behind the HUD
 */
(function () {
  'use strict';
  var TAU = Math.PI * 2;

  // ─────────────── noise ───────────────
  function Noise(seed) {
    var p = new Uint8Array(512), s = seed >>> 0 || 1;
    for (var i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; var j = s % (i + 1), t = p[i]; p[i] = p[j]; p[j] = t; }
    for (i = 0; i < 256; i++) p[i + 256] = p[i];
    var g = new Float32Array(256);
    for (i = 0; i < 256; i++) { s = (s * 1664525 + 1013904223) >>> 0; g[i] = s / 4294967296; }
    function v2(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var X = xi & 255, Y = yi & 255;
      var a = g[p[p[X] + Y]], b = g[p[p[X + 1] + Y]], c = g[p[p[X] + Y + 1]], d = g[p[p[X + 1] + Y + 1]];
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y, oct, gain) {
      var sum = 0, amp = 0.5, f = 1, norm = 0;
      gain = gain || 0.5;
      for (var o = 0; o < (oct || 5); o++) { sum += amp * v2(x * f, y * f); norm += amp; amp *= gain; f *= 2.03; }
      return sum / norm;
    }
    function ridged(x, oct) {
      var sum = 0, amp = 0.5, f = 1, norm = 0;
      for (var o = 0; o < (oct || 6); o++) { var n = 1 - Math.abs(v2(x * f, o * 17.3) * 2 - 1); sum += amp * n * n; norm += amp; amp *= 0.5; f *= 2.1; }
      return sum / norm;
    }
    return { v2: v2, fbm: fbm, ridged: ridged };
  }

  function canvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function hex(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }
  function rnd(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  // ─────────────── palettes ───────────────
  var THEMES = {
    dusk: {
      sky: [[0, '#140f33'], [0.3, '#3b1f5a'], [0.52, '#8c3d6b'], [0.68, '#e0714a'], [0.8, '#ffb46a'], [1, '#ffe2a8']],
      sun: { x: 0.74, y: 0.66, r: 0.045, col: '#fff2c8', glow: '#ffb35a' },
      cloudLit: '#ffc38a', cloudMid: '#c25f6e', cloudShadow: '#4a2550',
      haze: '#e88a6a', ranges: [
        { top: 0.5, amp: 0.13, freq: 2.2, col: '#8a4f80', light: '#ffb58a', haze: 0.62, seed: 3 },
        { top: 0.6, amp: 0.15, freq: 3.1, col: '#4c2a52', light: '#f08a6a', haze: 0.35, seed: 7 },
      ],
      forest: { line: 0.78, col: '#1f1028', rim: '#ff9a6a', fog: '#c0606a' },
      rock: { base: '#6a5260', dark: '#2a1a2a', light: '#c79a8a', strata: '#8a6a6a' }, cap: 'moss',
    },
    night: {
      sky: [[0, '#02050f'], [0.35, '#081a36'], [0.65, '#12385a'], [0.85, '#2a6a88'], [1, '#6aa6b8']],
      moon: { x: 0.24, y: 0.2, r: 0.04 },
      cloudLit: '#9ccce0', cloudMid: '#3c6c8c', cloudShadow: '#0c1e36',
      haze: '#3a7a98', ranges: [
        { top: 0.48, amp: 0.16, freq: 2.4, col: '#2a4e70', light: '#cfeeff', haze: 0.55, seed: 11, snow: 0.55 },
        { top: 0.6, amp: 0.15, freq: 3.4, col: '#163250', light: '#b8e4ff', haze: 0.3, seed: 13, snow: 0.35 },
      ],
      forest: { line: 0.8, col: '#06101c', rim: '#9fdcff', fog: '#2a5a78', snowy: true },
      rock: { base: '#5a6e86', dark: '#1a2638', light: '#cfe6f6', strata: '#7890a8' }, cap: 'snow',
    },
    grid: {
      sky: [[0, '#0e1322'], [0.6, '#182238'], [1, '#26324e']],
      cloudLit: '#5a6a9a', cloudMid: '#2a3456', cloudShadow: '#141a2c',
      haze: '#3a4a70', ranges: [{ top: 0.6, amp: 0.08, freq: 2, col: '#222c46', light: '#6a7ab0', haze: 0.5, seed: 5 }],
      forest: null, rock: { base: '#4a566e', dark: '#1c2234', light: '#9aaacc', strata: '#5e6a88' }, cap: 'stone',
    },
  };

  // ─────────────── painters (run once per arena and size) ───────────────
  function paintSky(w, h, th, n) {
    var c = canvas(w, h), x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 0, h);
    th.sky.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // Large soft colour variation and dithering so the gradient never bands
    var id = x.getImageData(0, 0, w, h), d = id.data;
    for (var y = 0; y < h; y++) for (var i = 0; i < w; i++) {
      var k = (y * w + i) * 4, v = (n.fbm(i * 0.004, y * 0.006, 3) - 0.5) * 18 + (Math.random() - 0.5) * 3;
      d[k] = clamp(d[k] + v, 0, 255); d[k + 1] = clamp(d[k + 1] + v * 0.8, 0, 255); d[k + 2] = clamp(d[k + 2] + v * 0.6, 0, 255);
    }
    x.putImageData(id, 0, 0);
    if (th.sun) {
      var sx = th.sun.x * w, sy = th.sun.y * h, r = th.sun.r * h;
      var bloom = x.createRadialGradient(sx, sy, 0, sx, sy, h * 0.7);
      bloom.addColorStop(0, 'rgba(255,214,150,0.55)'); bloom.addColorStop(0.25, 'rgba(255,160,90,0.22)'); bloom.addColorStop(1, 'rgba(255,120,80,0)');
      x.fillStyle = bloom; x.fillRect(0, 0, w, h);
      var disc = x.createRadialGradient(sx, sy, 0, sx, sy, r * 1.4);
      disc.addColorStop(0, '#fffbe8'); disc.addColorStop(0.7, th.sun.col); disc.addColorStop(1, 'rgba(255,220,160,0)');
      x.fillStyle = disc; x.beginPath(); x.arc(sx, sy, r * 1.4, 0, TAU); x.fill();
    }
    if (th.moon) paintNightSky(x, w, h, th, n);
    return c;
  }

  function paintNightSky(x, w, h, th, n) {
    var r = rnd(99);
    // Milky Way: a diagonal band of fine noise
    var id = x.getImageData(0, 0, w, h), d = id.data;
    for (var y = 0; y < h * 0.75; y++) for (var i = 0; i < w; i++) {
      var band = Math.exp(-Math.pow((y - (h * 0.05 + i * 0.32)) / (h * 0.16), 2));
      if (band < 0.03) continue;
      var v = n.fbm(i * 0.012, y * 0.012, 5) * band, k = (y * w + i) * 4;
      var a = smooth(0.25, 0.7, v) * 60;
      d[k] = clamp(d[k] + a * 0.8, 0, 255); d[k + 1] = clamp(d[k + 1] + a * 0.9, 0, 255); d[k + 2] = clamp(d[k + 2] + a, 0, 255);
    }
    x.putImageData(id, 0, 0);
    // Stars: many faint, few bright, denser in the band
    for (var s = 0; s < w * h / 900; s++) {
      var sx = r() * w, sy = r() * h * 0.78, b = Math.pow(r(), 4);
      var bandK = Math.exp(-Math.pow((sy - (h * 0.05 + sx * 0.32)) / (h * 0.16), 2));
      if (r() > 0.35 + bandK * 0.6) continue;
      x.fillStyle = 'rgba(' + (200 + r() * 55 | 0) + ',' + (210 + r() * 45 | 0) + ',255,' + (0.25 + b * 0.75) + ')';
      var size = 0.6 + b * 1.6; x.fillRect(sx, sy, size, size);
      if (b > 0.6) { x.fillStyle = 'rgba(220,235,255,0.15)'; x.beginPath(); x.arc(sx + size / 2, sy + size / 2, size * 3, 0, TAU); x.fill(); }
    }
    // Moon with halo and maria
    var mx = th.moon.x * w, my = th.moon.y * h, mr = th.moon.r * h;
    var halo = x.createRadialGradient(mx, my, mr, mx, my, mr * 7);
    halo.addColorStop(0, 'rgba(200,230,255,0.35)'); halo.addColorStop(1, 'rgba(160,200,255,0)');
    x.fillStyle = halo; x.beginPath(); x.arc(mx, my, mr * 7, 0, TAU); x.fill();
    var md = x.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx, my, mr);
    md.addColorStop(0, '#ffffff'); md.addColorStop(1, '#cfdcea');
    x.fillStyle = md; x.beginPath(); x.arc(mx, my, mr, 0, TAU); x.fill();
    x.save(); x.beginPath(); x.arc(mx, my, mr, 0, TAU); x.clip();
    for (var m = 0; m < 9; m++) { x.fillStyle = 'rgba(120,140,170,' + (0.12 + r() * 0.14) + ')'; x.beginPath(); x.arc(mx + (r() - 0.5) * mr * 1.4, my + (r() - 0.5) * mr * 1.4, mr * (0.12 + r() * 0.28), 0, TAU); x.fill(); }
    x.restore();
  }

  /** A cloud layer: fbm density, lit from the light's side by sampling the density toward it. Half resolution. */
  function paintClouds(w, h, th, n, o) {
    var cw = Math.ceil(w / 2), ch = Math.ceil(h / 2);
    var c = canvas(cw, ch), x = c.getContext('2d'), id = x.createImageData(cw, ch), d = id.data;
    var lit = hex(th.cloudLit), mid = hex(th.cloudMid), sh = hex(th.cloudShadow);
    var lx = o.lightX, ly = o.lightY;
    for (var y = 0; y < ch; y++) {
      var vy = y / ch, mask = smooth(o.y0, o.y0 + 0.08, vy) * (1 - smooth(o.y1 - 0.1, o.y1, vy));
      if (mask <= 0) continue;
      for (var i = 0; i < cw; i++) {
        var px = i * o.sx, py = y * o.sy;
        var den = n.fbm(px, py, 6) * mask;
        var a = smooth(o.th, o.th + o.soft, den);
        if (a <= 0.004) continue;
        var toward = n.fbm(px + lx, py + ly, 4) * mask;
        var near = o.sun ? Math.exp(-(Math.pow(i / cw - o.sun[0], 2) * 6 + Math.pow(vy - o.sun[1], 2) * 10)) : 0;
        var light = clamp(0.55 + (den - toward) * 6 + (1 - vy) * 0.1 + near * 0.45, 0, 1);
        var col = light > 0.5 ? mix(mid, lit, (light - 0.5) * 2) : mix(sh, mid, light * 2);
        var k = (y * cw + i) * 4;
        d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = a * 255 * o.alpha;
      }
    }
    x.putImageData(id, 0, 0);
    return c;   // kept at half resolution (soft anyway); drawn scaled up
  }

  /** A mountain range: ridged fractal skyline, slope lighting toward the light, strata, snow, haze at the base. */
  function paintRange(w, h, th, n, R, lightFromRight) {
    var c = canvas(w, h), x = c.getContext('2d'), id = x.createImageData(w, h), d = id.data;
    var col = hex(R.col), light = hex(R.light), haze = hex(th.haze), snow = [236, 246, 255];
    var ridge = new Float32Array(w + 20);
    for (var i = 0; i < w + 20; i++) ridge[i] = (R.top + R.amp * (0.5 - n.ridged((i - 10) / w * R.freq + R.seed, 5)) * 2) * h + (n.fbm(i * 0.05, R.seed, 2) - 0.5) * h * 0.006;
    for (i = 0; i < w; i++) {
      // Slope averaged over a wide span so lighting follows the mountain's faces, not single pixels
      var top = ridge[i + 10] | 0, slope = (ridge[i + 18] - ridge[i + 2]) / 16 * (lightFromRight ? -1 : 1);
      for (var y = Math.max(0, top); y < h; y++) {
        var depth = (y - top) / h;
        var strata = n.fbm(i * 0.012 + y * 0.004, y * 0.03, 4);
        // Near the ridge the face follows the skyline's slope; further down, diagonal facets from 2D noise take over
        var face = clamp(0.5 + slope * 1.6, 0, 1), down = clamp((y - top) / (h * 0.12), 0, 1);
        var facet = n.fbm(i * 0.006 + y * 0.004 * (lightFromRight ? 1 : -1), y * 0.007, 4);
        face = face * (1 - down) + clamp((facet - 0.35) * 1.8, 0, 1) * down;
        var lit = clamp(0.2 + face * 0.55 + (strata - 0.5) * 0.35 - depth * 1.6, 0, 1);
        var cc = mix(col, light, lit * 0.55);
        if (R.snow) {
          // Snow settles in 2D patches, deeper on the high peaks, feathered at the snowline, lit by the face
          var peak = clamp((R.top * h + R.amp * h - top) / (R.amp * h * 2), 0, 1);
          var line = R.snow * h * (0.05 + peak * 0.16);
          var patch = n.fbm(i * 0.018, y * 0.022, 4);
          var sAmt = smooth(line * 1.05, line * 0.55, y - top) * smooth(0.38, 0.55, patch + (1 - (y - top) / (line + 1)) * 0.25);
          if (sAmt > 0) cc = mix(cc, mix(snow, light, 0.15), sAmt * clamp(0.45 + face * 0.55, 0.3, 1));
        }
        cc = mix(cc, haze, clamp(R.haze + depth * 1.2, 0, 0.92));
        var k = (y * w + i) * 4, edge = y - top < 1.5 ? 0.6 : 1;
        d[k] = cc[0]; d[k + 1] = cc[1]; d[k + 2] = cc[2]; d[k + 3] = 255 * edge;
      }
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  /** Pine forest on a rolling line, with a rim of light and fog pooled at the base. */
  function paintForest(w, h, th, n) {
    var F = th.forest, c = canvas(w, h), x = c.getContext('2d'), r = rnd(31);
    var base = function (i) { return h * F.line + (n.fbm(i * 0.004, 9.1, 3) - 0.5) * h * 0.08; };
    // Hill body
    x.fillStyle = F.col; x.beginPath(); x.moveTo(0, h);
    for (var i = 0; i <= w; i += 6) x.lineTo(i, base(i));
    x.lineTo(w, h); x.fill();
    // Trees, back to front, varied height and lean
    for (var t = 0; t < w / 7; t++) {
      var tx = r() * w, ty = base(tx) + 4, th2 = h * (0.05 + Math.pow(r(), 2) * 0.09), tw = th2 * (0.28 + r() * 0.12);
      x.fillStyle = F.col; x.beginPath(); x.moveTo(tx, ty - th2);
      var tiers = 5 + (r() * 3 | 0);
      for (var k = 1; k <= tiers; k++) { var yy = ty - th2 + th2 * k / tiers, ww = tw * k / tiers; x.lineTo(tx + ww * (0.8 + r() * 0.4), yy); x.lineTo(tx + ww * 0.35, yy - th2 * 0.04); }
      for (k = tiers; k >= 1; k--) { var y2 = ty - th2 + th2 * k / tiers, w2 = tw * k / tiers; x.lineTo(tx - w2 * 0.35, y2 - th2 * 0.04); x.lineTo(tx - w2 * (0.8 + r() * 0.4), y2); }
      x.closePath(); x.fill();
      if (F.snowy && r() < 0.8) { x.fillStyle = 'rgba(220,240,255,0.55)'; for (k = 1; k <= tiers; k += 2) { var ys = ty - th2 + th2 * (k - 0.6) / tiers, ws = tw * k / tiers; x.fillRect(tx - ws * 0.5, ys, ws, 1.6); } }
    }
    // Rim light on the crowns toward the light
    x.globalCompositeOperation = 'source-atop';
    var rim = x.createLinearGradient(0, h * (F.line - 0.16), 0, h * F.line);
    rim.addColorStop(0, rgba(hex(F.rim), 0.32)); rim.addColorStop(1, rgba(hex(F.rim), 0));
    x.fillStyle = rim; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'source-over';
    // Fog pooled at the base
    var fog = x.createLinearGradient(0, h * (F.line - 0.02), 0, h);
    fog.addColorStop(0, rgba(hex(F.fog), 0)); fog.addColorStop(0.5, rgba(hex(F.fog), 0.35)); fog.addColorStop(1, rgba(hex(F.fog), 0.6));
    x.fillStyle = fog; x.fillRect(0, 0, w, h);
    return c;
  }

  /** The Skyforge: a citadel of towers on a cliff, warm-lit windows, buttresses, a forge chimney. */
  function paintCitadel(w, h, th, n, night) {
    var c = canvas(w, h), x = c.getContext('2d'), r = rnd(night ? 77 : 41);
    var cx = w * (night ? 0.84 : 0.14), gy = h * 0.68, S = Math.min(h / 900, w / 1700) * 0.85;
    var stone = night ? '#14273e' : '#2e1a36', rim = night ? 'rgba(170,220,255,0.55)' : 'rgba(255,150,100,0.55)', glow = night ? '#8fe6ff' : '#ffb84a';
    x.save();
    // Cliff the citadel stands on
    x.fillStyle = stone; x.beginPath(); x.moveTo(cx - 190 * S, h);
    for (var i = -190; i <= 190; i += 10) x.lineTo(cx + i * S, gy + (Math.abs(i) > 120 ? (Math.abs(i) - 120) * 1.6 : 0) * S + n.fbm(i * 0.05, 1, 3) * 14 * S);
    x.lineTo(cx + 190 * S, h); x.fill();
    var towers = [[-110, 150, 34, 'cone'], [-60, 230, 40, 'onion'], [0, 380, 52, 'spire'], [62, 260, 42, 'cone'], [118, 170, 32, 'flat'], [-150, 110, 26, 'flat'], [158, 120, 26, 'cone']];
    towers.sort(function (a, b) { return a[1] - b[1]; });
    towers.forEach(function (T) {
      var tx = cx + T[0] * S, tw = T[2] * S, tt = gy - T[1] * S;
      x.fillStyle = stone;
      // Body with a slight taper, crenellated parapet, conical or flat roof
      x.beginPath(); x.moveTo(tx - tw / 2, gy); x.lineTo(tx - tw * 0.44, tt); x.lineTo(tx + tw * 0.44, tt); x.lineTo(tx + tw / 2, gy); x.fill();
      for (var m = -2; m <= 2; m++) x.fillRect(tx + m * tw * 0.2 - tw * 0.06, tt - 8 * S, tw * 0.12, 8 * S);
      x.fillRect(tx - tw * 0.52, tt - 2 * S, tw * 1.04, 5 * S);
      var roof = T[3];
      if (roof === 'cone' || roof === 'spire') {
        // Flared eaves and a tall roof; the main spire gets a needle and a ring of dormers
        var rh = (roof === 'spire' ? 0.42 : 0.3) * T[1] * S;
        x.beginPath(); x.moveTo(tx - tw * 0.62, tt - 4 * S); x.quadraticCurveTo(tx - tw * 0.3, tt - 12 * S, tx, tt - rh); x.quadraticCurveTo(tx + tw * 0.3, tt - 12 * S, tx + tw * 0.62, tt - 4 * S); x.fill();
        if (roof === 'spire') { x.fillRect(tx - 1 * S, tt - rh - 26 * S, 2 * S, 26 * S); for (var dm = -1; dm <= 1; dm += 2) { x.beginPath(); x.moveTo(tx + dm * tw * 0.3, tt - rh * 0.25); x.lineTo(tx + dm * tw * 0.42, tt - rh * 0.05); x.lineTo(tx + dm * tw * 0.18, tt - rh * 0.05); x.fill(); } }
      } else if (roof === 'onion') {
        x.beginPath(); x.moveTo(tx - tw * 0.42, tt - 6 * S); x.bezierCurveTo(tx - tw * 0.75, tt - tw * 0.6, tx - tw * 0.1, tt - tw * 0.9, tx, tt - tw * 1.25); x.bezierCurveTo(tx + tw * 0.1, tt - tw * 0.9, tx + tw * 0.75, tt - tw * 0.6, tx + tw * 0.42, tt - 6 * S); x.fill();
      }
      // Buttresses down the base
      x.beginPath(); x.moveTo(tx - tw * 0.5, gy); x.lineTo(tx - tw * 0.72, gy); x.lineTo(tx - tw * 0.5, gy - Math.min(90, T[1] * 0.4) * S); x.fill();
      x.beginPath(); x.moveTo(tx + tw * 0.5, gy); x.lineTo(tx + tw * 0.72, gy); x.lineTo(tx + tw * 0.5, gy - Math.min(90, T[1] * 0.4) * S); x.fill();
      // Arched windows, some lit
      for (var row = 0; row < T[1] / 46; row++) {
        var wy = tt + 22 * S + row * 42 * S;
        if (wy > gy - 20 * S) break;
        for (var col = -1; col <= 1; col += (tw > 40 * S ? 1 : 2)) {
          var wx = tx + col * tw * 0.22, lit = r() < 0.32;
          x.fillStyle = lit ? glow : 'rgba(0,0,0,0.4)';
          x.beginPath(); x.moveTo(wx - 3 * S, wy + 10 * S); x.lineTo(wx - 3 * S, wy); x.arc(wx, wy, 3 * S, Math.PI, 0); x.lineTo(wx + 3 * S, wy + 10 * S); x.fill();
          if (lit) { var gg = x.createRadialGradient(wx, wy + 4 * S, 0, wx, wy + 4 * S, 16 * S); gg.addColorStop(0, rgba(hex(glow), 0.35)); gg.addColorStop(1, rgba(hex(glow), 0)); x.fillStyle = gg; x.fillRect(wx - 16 * S, wy - 12 * S, 32 * S, 32 * S); }
        }
      }
      // Rim light down the edge facing the light
      var edgeX = night ? tx - tw * 0.47 : tx + tw * 0.47;
      var rg = x.createLinearGradient(edgeX, 0, edgeX + (night ? 6 : -6) * S, 0); rg.addColorStop(0, rim); rg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = rg; x.fillRect(Math.min(edgeX, edgeX + (night ? 6 : -6) * S), tt, 6 * S, gy - tt);
    });
    // Bridges between towers
    x.strokeStyle = stone; x.lineWidth = 6 * S;
    x.beginPath(); x.moveTo(cx - 60 * S, gy - 120 * S); x.quadraticCurveTo(cx - 30 * S, gy - 100 * S, cx, gy - 140 * S); x.stroke();
    x.beginPath(); x.moveTo(cx, gy - 160 * S); x.quadraticCurveTo(cx + 32 * S, gy - 140 * S, cx + 62 * S, gy - 150 * S); x.stroke();
    // The forge: a great arch at the base, burning
    var fx = cx - 4 * S, fyy = gy - 4 * S;
    x.fillStyle = night ? '#4ad6ff' : '#ff9a2a';
    x.beginPath(); x.moveTo(fx - 16 * S, fyy); x.lineTo(fx - 16 * S, fyy - 26 * S); x.arc(fx, fyy - 26 * S, 16 * S, Math.PI, 0); x.lineTo(fx + 16 * S, fyy); x.fill();
    var fg2 = x.createRadialGradient(fx, fyy - 18 * S, 0, fx, fyy - 18 * S, 90 * S); fg2.addColorStop(0, night ? 'rgba(120,230,255,0.45)' : 'rgba(255,170,80,0.5)'); fg2.addColorStop(1, 'rgba(255,120,40,0)');
    x.fillStyle = fg2; x.fillRect(fx - 90 * S, fyy - 108 * S, 180 * S, 180 * S);
    // Stone grain over everything
    x.globalCompositeOperation = 'source-atop';
    var grain = canvas(w, h), gx = grain.getContext('2d'), gid = gx.createImageData(w, h), gd = gid.data;
    for (var y = 0; y < h; y++) for (var i2 = 0; i2 < w; i2++) { var k = (y * w + i2) * 4, v = n.fbm(i2 * 0.08, y * 0.08, 3); gd[k] = gd[k + 1] = gd[k + 2] = v > 0.5 ? 255 : 0; gd[k + 3] = Math.abs(v - 0.5) * 70; }
    gx.putImageData(gid, 0, 0); x.drawImage(grain, 0, 0);
    // Distance: the citadel sits in the haze, lighter toward its base
    var hz = x.createLinearGradient(0, gy - 400 * S, 0, h);
    hz.addColorStop(0, rgba(hex(th.haze), 0.22)); hz.addColorStop(1, rgba(hex(th.haze), 0.5));
    x.fillStyle = hz; x.fillRect(0, 0, w, h);
    x.restore();
    return { canvas: c, chimney: [cx, gy - 380 * S - 380 * 0.28 * S], S: S };
  }

  /** Small floating islands with dangling roots (and waterfalls, animated later). */
  function paintIslands(w, h, th, n) {
    var c = canvas(w, h), x = c.getContext('2d'), r = rnd(57), rk = th.rock, out = [];
    var haze = hex(th.haze), dark = mix(hex(rk.dark), haze, 0.55), base = mix(hex(rk.base), haze, 0.5), lightc = mix(hex(rk.light), haze, 0.35);
    var U = Math.min(w, h * 1.8) / 1000;
    [[0.33, 0.2, 58], [0.58, 0.13, 38], [0.86, 0.26, 50]].forEach(function (I, k) {
      var ix = I[0] * w, iy = I[1] * h, iw = I[2] * U;
      // Ragged underside: many points, deeper in the middle, with hanging rock teeth
      var pts = [];
      for (var a = 0; a <= 28; a++) {
        var t = a / 28, depth = Math.pow(Math.sin(t * Math.PI), 1.6) * iw * (0.75 + n.fbm(t * 6 + k * 3, 2, 4) * 0.8);
        if (r() < 0.2) depth += r() * iw * 0.35;
        pts.push([ix - iw + t * iw * 2, iy + depth]);
      }
      var g = x.createLinearGradient(0, iy, 0, iy + iw * 2);
      g.addColorStop(0, rgba(lightc, 1)); g.addColorStop(0.25, rgba(base, 1)); g.addColorStop(1, rgba(dark, 1));
      x.fillStyle = g; x.beginPath(); x.moveTo(ix - iw * 1.04, iy);
      pts.forEach(function (p) { x.lineTo(p[0], p[1]); });
      x.lineTo(ix + iw * 1.04, iy);
      // Gently domed top instead of a flat lid
      x.quadraticCurveTo(ix, iy - iw * 0.22, ix - iw * 1.04, iy); x.fill();
      out.push({ x: ix, y: iy, w: iw, fall: k === 0 });
    });
    // Rock texture on the bodies: fractal light/dark, strata, darker underside, all pulled into the haze
    var id = x.getImageData(0, 0, w, h), d = id.data, strataC = mix(hex(rk.strata), haze, 0.45);
    out.forEach(function (I) {
      var x0 = Math.max(0, (I.x - I.w * 1.1) | 0), x1 = Math.min(w, (I.x + I.w * 1.1) | 0), y0 = Math.max(0, (I.y - I.w * 0.3) | 0), y1 = Math.min(h, (I.y + I.w * 2.6) | 0);
      for (var y = y0; y < y1; y++) for (var i = x0; i < x1; i++) {
        var q = (y * w + i) * 4;
        if (d[q + 3] < 10) continue;
        var nn = n.fbm(i * 0.06, y * 0.06, 5), band = n.fbm(i * 0.01, y * 0.16, 3), down = clamp((y - I.y) / (I.w * 2), 0, 1);
        var cc = mix(base, strataC, smooth(0.45, 0.6, band) * 0.5);
        cc = mix(cc, lightc, clamp((nn - 0.48) * 1.6, 0, 0.55) * (1 - down));
        cc = mix(cc, dark, clamp((0.5 - nn) * 1.4 + down * 0.7, 0, 0.85));
        d[q] = cc[0]; d[q + 1] = cc[1]; d[q + 2] = cc[2];
      }
    });
    x.putImageData(id, 0, 0);
    out.forEach(function (I) {
      var ix = I.x, iy = I.y, iw = I.w;
      // Tufts of trees on top, in the haze colour
      var tree = mix(th.cap === 'snow' ? [40, 70, 90] : [40, 60, 40], haze, 0.5);
      x.fillStyle = rgba(tree, 1);
      for (var tr = 0; tr < 5 + (r() * 4 | 0); tr++) {
        var tx = ix + (r() - 0.5) * iw * 1.5, th2 = iw * (0.18 + r() * 0.22), ty = iy - iw * 0.12 * (1 - Math.abs(tx - ix) / iw);
        x.beginPath(); x.moveTo(tx, ty - th2); x.lineTo(tx + th2 * 0.32, ty); x.lineTo(tx - th2 * 0.32, ty); x.fill();
      }
      if (th.cap === 'snow') { x.fillStyle = rgba(mix([235, 248, 255], haze, 0.3), 0.9); x.beginPath(); x.ellipse(ix, iy - iw * 0.04, iw * 0.95, iw * 0.08, 0, Math.PI, 0); x.fill(); }
      // Dangling roots
      x.strokeStyle = rgba(dark, 0.7); x.lineWidth = 1;
      for (var v = 0; v < 5; v++) { var vx = ix - iw * 0.5 + r() * iw; x.beginPath(); x.moveTo(vx, iy + iw * 0.7); x.quadraticCurveTo(vx + 3, iy + iw * (1.4 + r() * 0.5), vx - 1, iy + iw * (1.7 + r() * 0.6)); x.stroke(); }
    });
    return { canvas: c, islands: out };
  }

  // ─────────────── platform sprites (world space) ───────────────
  var platCache = {};
  function platformSprite(p, th, theme, idx) {
    var key = theme + ':' + idx + ':' + p.w + 'x' + p.h + (p.solid ? 's' : '');
    if (platCache[key]) return platCache[key];
    var R = 1.5, pad = 40, depth = p.solid ? p.h + 70 : 46;
    var w = Math.round((p.w + pad * 2) * R), h = Math.round((depth + pad) * R);
    var c = canvas(w, h), x = c.getContext('2d'), n = Noise(500 + idx * 13), r = rnd(900 + idx);
    var rk = th.rock, base = hex(rk.base), dark = hex(rk.dark), light = hex(rk.light), strata = hex(rk.strata);
    var top = pad * R;
    // Silhouette: flat walkable top, rough sides tapering to a jagged underside with hanging chunks
    var outline = [];
    var L = pad * R, Rx = (pad + p.w) * R;
    outline.push([L - 4, top]); outline.push([Rx + 4, top]);
    var steps = 40;
    for (var s = 0; s <= steps; s++) {
      var t = s / steps, xx = Rx - t * (Rx - L);
      var taper = Math.sin(t * Math.PI);
      var yy = top + (p.solid ? (12 + taper * (depth - 12)) : (10 + taper * 22)) * R * (0.55 + n.fbm(t * 6, 4.4, 3) * 0.7);
      if (p.solid && r() < 0.18) yy += r() * 26 * R;   // hanging stalactites
      outline.push([xx + (t === 0 ? 6 : t === 1 ? -6 : 0), yy]);
    }
    x.beginPath(); x.moveTo(outline[0][0], outline[0][1]);
    for (var o = 1; o < outline.length; o++) x.lineTo(outline[o][0], outline[o][1]);
    x.closePath(); x.fillStyle = '#000'; x.fill();
    // Rock texture inside the silhouette
    var id = x.getImageData(0, 0, w, h), d = id.data;
    for (var y = 0; y < h; y++) for (var i = 0; i < w; i++) {
      var k = (y * w + i) * 4;
      if (d[k + 3] < 10) continue;
      var u = i / R, vv = (y - top) / R;
      var nn = n.fbm(u * 0.035, vv * 0.05, 5), band = n.fbm(u * 0.006, vv * 0.11, 3);
      var cc = mix(base, strata, smooth(0.45, 0.62, band) * 0.6);
      cc = mix(cc, light, clamp((nn - 0.5) * 1.4, 0, 0.5));
      cc = mix(cc, dark, clamp((0.5 - nn) * 1.6, 0, 0.6));
      var ao = clamp(vv / (p.solid ? depth : 40), 0, 1);       // darker toward the underside
      cc = mix(cc, dark, ao * 0.65);
      var edgeLight = clamp(1 - vv / 10, 0, 1);               // top lip catches light
      cc = mix(cc, light, edgeLight * 0.5);
      d[k] = cc[0]; d[k + 1] = cc[1]; d[k + 2] = cc[2]; d[k + 3] = 255;
    }
    x.putImageData(id, 0, 0);
    // Cracks
    x.strokeStyle = rgba(dark, 0.55); x.lineCap = 'round';
    for (var cr = 0; cr < (p.solid ? p.w / 60 : 3); cr++) {
      var cx = L + r() * (Rx - L), cy = top + (6 + r() * 30) * R;
      x.lineWidth = (0.8 + r() * 1.2) * R; x.beginPath(); x.moveTo(cx, cy);
      for (var seg = 0; seg < 5; seg++) { cx += (r() - 0.5) * 18 * R; cy += r() * 14 * R; x.lineTo(cx, cy); }
      x.stroke();
    }
    // Cap: moss with grass blades, or snow with icicles
    var cap = th.cap;
    if (cap === 'moss') {
      x.fillStyle = '#3f6a35';
      x.beginPath(); x.moveTo(L - 4, top - 2);
      for (var mx = L - 4; mx <= Rx + 4; mx += 6) x.lineTo(mx, top + (3 + n.fbm(mx * 0.05, 7, 3) * 9) * R);
      x.lineTo(Rx + 4, top - 2); x.fill();
      for (var gb = 0; gb < p.w * 1.2; gb++) {
        var gx = L + r() * (Rx - L), gh = (2 + r() * 6) * R;
        x.strokeStyle = r() < 0.5 ? '#5d9447' : r() < 0.5 ? '#7fb35a' : '#a6c86a'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(gx, top + 2); x.quadraticCurveTo(gx + (r() - 0.5) * 4, top - gh * 0.5, gx + (r() - 0.5) * 6, top - gh); x.stroke();
      }
      for (var fl = 0; fl < p.w / 70; fl++) { x.fillStyle = r() < 0.5 ? '#ffd36a' : '#ff8aa6'; x.beginPath(); x.arc(L + r() * (Rx - L), top - 2 - r() * 3, 1.6, 0, TAU); x.fill(); }
      // Roots and vines hanging off the underside
      x.strokeStyle = 'rgba(40,60,30,0.85)';
      for (var vn = 0; vn < (p.solid ? p.w / 40 : 3); vn++) {
        var vx = L + 20 + r() * (Rx - L - 40), vy = top + 10 * R, len = (20 + r() * (p.solid ? 70 : 24)) * R;
        x.lineWidth = 1.2; x.beginPath(); x.moveTo(vx, vy); x.bezierCurveTo(vx + 6, vy + len * 0.3, vx - 6, vy + len * 0.7, vx + (r() - 0.5) * 8, vy + len); x.stroke();
      }
    } else if (cap === 'snow') {
      x.fillStyle = '#eaf6ff';
      x.beginPath(); x.moveTo(L - 6, top - 3);
      for (var sx = L - 6; sx <= Rx + 6; sx += 5) x.lineTo(sx, top + (4 + n.fbm(sx * 0.04, 3, 3) * 10) * R);
      x.lineTo(Rx + 6, top - 3); x.fill();
      x.fillStyle = 'rgba(160,200,230,0.5)'; x.fillRect(L, top + 4 * R, Rx - L, 2);
      for (var ic = 0; ic < p.w / (p.solid ? 14 : 20); ic++) {
        var ix = L + r() * (Rx - L), il = (6 + r() * (p.solid ? 26 : 12)) * R;
        var ig = x.createLinearGradient(0, top + 6 * R, 0, top + 6 * R + il); ig.addColorStop(0, 'rgba(230,248,255,0.95)'); ig.addColorStop(1, 'rgba(160,220,255,0.2)');
        x.fillStyle = ig; x.beginPath(); x.moveTo(ix - 2.5, top + 6 * R); x.lineTo(ix, top + 6 * R + il); x.lineTo(ix + 2.5, top + 6 * R); x.fill();
      }
    } else {
      x.fillStyle = '#7a88aa'; x.fillRect(L - 2, top - 2, Rx - L + 4, 5 * R);
    }
    var out = { canvas: c, ox: -pad, oy: -pad, w: w / R, h: h / R };
    platCache[key] = out;
    return out;
  }

  // ─────────────── scene cache and drawing ───────────────
  var scenes = {};
  function scene(theme, W, H) {
    var bw = Math.round(W * 1.3 / 64) * 64, bh = Math.round(H * 1.15 / 64) * 64;   // margin for parallax, bucketed
    var key = theme + ':' + bw + 'x' + bh;
    if (scenes[key]) return scenes[key];
    var th = THEMES[theme] || THEMES.dusk, n = Noise(theme === 'night' ? 7 : theme === 'grid' ? 3 : 1);
    var sc = { th: th, w: bw, h: bh, theme: theme };
    sc.sky = paintSky(bw, bh, th, n);
    if (theme === 'grid') {
      sc.ranges = [paintRange(bw, bh, th, n, th.ranges[0], true)];
      sc.clouds = [];
    } else {
      var lightRight = theme === 'dusk';
      sc.clouds = [
        paintClouds(bw, bh, th, Noise(21), { sun: th.sun ? [th.sun.x, th.sun.y] : null, y0: 0.05, y1: 0.42, sx: 0.0035, sy: 0.016, th: 0.5, soft: 0.16, alpha: 0.7, lightX: lightRight ? 0.04 : -0.04, lightY: 0.03 }),
        paintClouds(bw, bh, th, Noise(22), { sun: th.sun ? [th.sun.x, th.sun.y] : null, y0: 0.38, y1: 0.7, sx: 0.006, sy: 0.011, th: 0.47, soft: 0.12, alpha: 0.95, lightX: lightRight ? 0.05 : -0.05, lightY: 0.05 }),
      ];
      var ranges = th.ranges.map(function (R) { return paintRange(bw, bh, th, n, R, lightRight); });
      sc.citadel = paintCitadel(bw, bh, th, n, theme === 'night');
      sc.islands = paintIslands(bw, bh, th, n);
      sc.forest = paintForest(bw, bh, th, n);
      // Merge layers that share (nearly) the same parallax to keep texture memory small:
      // far = sky + far range + islands, mid = near range + citadel
      var fx = sc.sky.getContext('2d'); fx.drawImage(ranges[0], 0, 0); fx.drawImage(sc.islands.canvas, 0, 0);
      var mid = ranges[1].getContext('2d'); mid.drawImage(sc.citadel.canvas, 0, 0);
      sc.mid = ranges[1]; sc.islands.canvas = null; sc.citadel.canvas = null;
      sc.ranges = [];
    }
    scenes[key] = sc;
    return sc;
  }

  // Layer depth: how much a layer follows the camera (0 = sky, fixed; 1 = moves with the world)
  function layer(x, img, depth, cam, W, H, sc, extraX) {
    var z = 1 + (cam.zoom - 1) * depth * 0.5;
    var ox = -(cam.x - 800) * depth * 0.35 + (extraX || 0), oy = -(cam.y - 450) * depth * 0.25;
    var dw = sc.w * z, dh = sc.h * z;
    x.drawImage(img, (W - dw) / 2 + ox, (H - dh) / 2 + oy + (dh - H) * 0.1, dw, dh);
  }

  var birds = null;
  function backdrop(x, arena, cam0, W, H, t) {
    var theme = arena.theme, sc = scene(theme, W, H);
    var cam = { x: cam0.x, y: cam0.y, zoom: cam0.zBase ? cam0.z / cam0.zBase : 1 };
    layer(x, sc.sky, 0.05, cam, W, H, sc);
    if (theme === 'night') aurora(x, W, H, t, cam);
    // Clouds drift; each layer wraps seamlessly by drawing it twice
    sc.clouds.forEach(function (cl, k) {
      var speed = k ? 9 : 4, off = (t * speed) % sc.w;
      layer(x, cl, 0.06 + k * 0.05, cam, W, H, sc, off);
      layer(x, cl, 0.06 + k * 0.05, cam, W, H, sc, off - sc.w);
    });
    if (theme === 'dusk') shafts(x, W, H, t);
    if (sc.ranges[0]) layer(x, sc.ranges[0], 0.1, cam, W, H, sc);
    if (sc.islands) waterfalls(x, sc, cam, W, H, t);
    if (sc.mid) { layer(x, sc.mid, 0.2, cam, W, H, sc); chimney(x, sc, cam, W, H, t, theme); }
    if (theme === 'dusk') flock(x, W, H, t);
    if (sc.forest) layer(x, sc.forest, 0.32, cam, W, H, sc);
    mist(x, W, H, t, theme);
    if (theme === 'night') shootingStar(x, W, H, t);
    if (theme === 'grid') {
      x.strokeStyle = 'rgba(140,170,255,0.06)'; x.lineWidth = 1;
      for (var gx = -((cam.x * 0.3) % 80); gx < W; gx += 80) { x.beginPath(); x.moveTo(gx, H * 0.55); x.lineTo(gx, H); x.stroke(); }
    }
  }

  function screenPos(sc, depth, cam, W, H, px, py) {
    var z = 1 + (cam.zoom - 1) * depth * 0.5;
    var dw = sc.w * z, dh = sc.h * z;
    return [(W - dw) / 2 - (cam.x - 800) * depth * 0.35 + px * z, (H - dh) / 2 - (cam.y - 450) * depth * 0.25 + (dh - H) * 0.1 + py * z, z];
  }

  // Soft, feathered god rays from the sun, slowly breathing
  function shafts(x, W, H, t) {
    x.save(); x.globalCompositeOperation = 'lighter';
    var sx = W * 0.74, sy = H * 0.62;
    for (var s = 0; s < 6; s++) {
      var ang = -2.35 + s * 0.13 + Math.sin(t * 0.07 + s) * 0.02, len = H * 1.3, wid = W * (0.04 + (s % 3) * 0.02);
      var a = 0.022 + 0.014 * Math.sin(t * 0.3 + s * 1.9);
      x.save(); x.translate(sx, sy); x.rotate(ang);
      var g = x.createLinearGradient(0, -wid, 0, wid);
      g.addColorStop(0, 'rgba(255,190,130,0)'); g.addColorStop(0.5, 'rgba(255,200,140,' + a + ')'); g.addColorStop(1, 'rgba(255,190,130,0)');
      x.fillStyle = g;
      x.beginPath(); x.moveTo(0, 0); x.lineTo(len, -wid); x.lineTo(len, wid); x.closePath(); x.fill();
      x.restore();
    }
    x.restore();
  }

  function aurora(x, W, H, t, cam) {
    x.save(); x.globalCompositeOperation = 'lighter';
    var cols = [[60, 230, 190], [90, 200, 255], [170, 120, 255]];
    for (var b = 0; b < 3; b++) {
      var c = cols[b];
      for (var i = 0; i < 70; i++) {
        var u = i / 70, xx = u * W * 1.1 - W * 0.05 - (cam.x - 800) * 0.02;
        var base = H * (0.12 + b * 0.06) + Math.sin(u * 7 + t * 0.25 + b) * H * 0.05 + Math.sin(u * 17 - t * 0.6) * H * 0.012;
        var hgt = H * (0.12 + 0.08 * Math.sin(u * 5 + t * 0.4 + b * 2));
        var a = (0.05 + 0.04 * Math.sin(u * 23 + t * 1.3 + b)) * (1 - Math.abs(u - 0.5) * 1.2);
        if (a <= 0) continue;
        var g = x.createLinearGradient(0, base - hgt, 0, base);
        g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.7, rgba(c, a)); g.addColorStop(1, rgba(c, a * 0.2));
        x.fillStyle = g; x.fillRect(xx, base - hgt, W / 70 + 2, hgt);
      }
    }
    x.restore();
  }

  function waterfalls(x, sc, cam, W, H, t) {
    sc.islands.islands.forEach(function (I) {
      if (!I.fall) return;
      var p = screenPos(sc, 0.05, cam, W, H, I.x + I.w * 0.15, I.y + I.w * 1.2), z = p[2];
      var len = H * 0.42, wid = I.w * 0.22 * z;
      // A veil that thins and breaks up as it falls, with streaks sliding down it
      var g = x.createLinearGradient(0, p[1], 0, p[1] + len);
      g.addColorStop(0, 'rgba(225,240,255,0.42)'); g.addColorStop(0.6, 'rgba(225,240,255,0.14)'); g.addColorStop(1, 'rgba(225,240,255,0)');
      x.fillStyle = g;
      x.beginPath(); x.moveTo(p[0] - wid / 2, p[1]); x.lineTo(p[0] + wid / 2, p[1]); x.lineTo(p[0] + wid * 0.9, p[1] + len); x.lineTo(p[0] - wid * 0.9, p[1] + len); x.fill();
      for (var s = 0; s < 6; s++) {
        var sx = p[0] - wid / 2 + (s + 0.5) * wid / 6, ph = (t * (70 + s * 9) + s * 31) % (len * 0.5);
        var a = 0.35 * (1 - ph / (len * 0.5));
        x.fillStyle = 'rgba(255,255,255,' + a + ')'; x.fillRect(sx + (ph / len) * (s - 2.5) * 2, p[1] + ph, 1.2 * z, 10 * z);
      }
      var mg = x.createRadialGradient(p[0], p[1] + len * 0.55, 0, p[0], p[1] + len * 0.55, 40 * z); mg.addColorStop(0, 'rgba(230,240,255,0.12)'); mg.addColorStop(1, 'rgba(230,240,255,0)');
      x.fillStyle = mg; x.fillRect(p[0] - 40 * z, p[1] + len * 0.55 - 40 * z, 80 * z, 80 * z);
    });
  }

  // Forge smoke (dusk) or a beacon's cold glow (night), rising from the citadel's tallest tower
  function chimney(x, sc, cam, W, H, t, theme) {
    var C = sc.citadel, p = screenPos(sc, 0.2, cam, W, H, C.chimney[0], C.chimney[1]), z = p[2];
    if (theme === 'dusk') {
      for (var i = 0; i < 14; i++) {
        var k = ((t * 0.08 + i / 14) % 1), r = (6 + k * 40) * z;
        var sx = p[0] + Math.sin(k * 5 + i) * 8 * z + k * 60 * z, sy = p[1] - k * 160 * z;
        x.fillStyle = 'rgba(70,40,60,' + (0.28 * (1 - k)) + ')'; x.beginPath(); x.arc(sx, sy, r, 0, TAU); x.fill();
      }
      for (var e = 0; e < 8; e++) {
        var ke = ((t * 0.3 + e / 8) % 1);
        x.fillStyle = 'rgba(255,190,90,' + (0.9 * (1 - ke)) + ')';
        x.fillRect(p[0] + Math.sin(ke * 9 + e) * 10 * z, p[1] - ke * 90 * z, 1.8 * z, 1.8 * z);
      }
      var g = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], 24 * z); g.addColorStop(0, 'rgba(255,200,110,0.6)'); g.addColorStop(1, 'rgba(255,140,60,0)');
      x.fillStyle = g; x.beginPath(); x.arc(p[0], p[1], 24 * z, 0, TAU); x.fill();
    } else {
      var a = 0.35 + 0.15 * Math.sin(t * 2);
      var g2 = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], 40 * z); g2.addColorStop(0, 'rgba(160,240,255,' + a + ')'); g2.addColorStop(1, 'rgba(120,200,255,0)');
      x.fillStyle = g2; x.beginPath(); x.arc(p[0], p[1], 40 * z, 0, TAU); x.fill();
    }
  }

  // A loose flock crossing the sunset now and then; each bird flaps on its own phase
  function flock(x, W, H, t) {
    if (!birds) { var r = rnd(5); birds = []; for (var i = 0; i < 9; i++) birds.push({ dx: r() * 80 - i * 18, dy: r() * 40 - 20 + Math.abs(i - 4) * 6, ph: r() * TAU, s: 0.7 + r() * 0.5 }); }
    var cycle = 46, k = (t % cycle) / cycle;
    if (k > 0.7) return;
    var bx = -100 + k / 0.7 * (W + 300), by = H * 0.3 + Math.sin(k * 6) * 20;
    x.strokeStyle = 'rgba(40,20,40,0.75)'; x.lineCap = 'round';
    birds.forEach(function (b) {
      var fl = Math.sin(t * 9 * b.s + b.ph) * 4, px = bx + b.dx, py = by + b.dy + Math.sin(t + b.ph) * 3, s = 5 * b.s;
      x.lineWidth = 1.4; x.beginPath(); x.moveTo(px - s, py - fl); x.quadraticCurveTo(px - s * 0.4, py - fl * 0.3 - 1, px, py); x.quadraticCurveTo(px + s * 0.4, py - fl * 0.3 - 1, px + s, py - fl); x.stroke();
    });
  }

  function mist(x, W, H, t, theme) {
    if (theme === 'grid') return;
    var col = theme === 'night' ? '150,200,230' : '255,170,150';
    for (var m = 0; m < 3; m++) {
      var y = H * (0.68 + m * 0.07), off = ((t * (8 + m * 5)) % (W * 1.5)) - W * 0.25;
      for (var b = -1; b <= 1; b++) {
        var cx = off + b * W * 1.5;
        var g = x.createRadialGradient(cx + W * 0.4, y, 0, cx + W * 0.4, y, W * 0.5);
        g.addColorStop(0, 'rgba(' + col + ',' + (0.07 - m * 0.015) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
        x.fillStyle = g; x.save(); x.translate(0, y); x.scale(1, 0.18); x.translate(0, -y);
        x.beginPath(); x.arc(cx + W * 0.4, y, W * 0.5, 0, TAU); x.fill(); x.restore();
      }
    }
    if (theme === 'night') {
      x.fillStyle = 'rgba(235,248,255,0.7)';
      for (var sn = 0; sn < 70; sn++) { var sx = (sn * 97.3 + t * (12 + sn % 5 * 4) + Math.sin(t + sn) * 10) % W, sy = (sn * 53.7 + t * (28 + sn % 7 * 6)) % H; x.fillRect(sx, sy, 1.4 + sn % 2, 1.4 + sn % 2); }
    }
  }

  function shootingStar(x, W, H, t) {
    var period = 11, k = (t % period) / period;
    if (k > 0.08) return;
    var seed = Math.floor(t / period), r = rnd(seed * 31 + 7);
    var sx = W * (0.3 + r() * 0.6), sy = H * (0.05 + r() * 0.2), p = k / 0.08;
    var hx = sx - p * W * 0.25, hy = sy + p * H * 0.12;
    var g = x.createLinearGradient(hx, hy, hx + 90, hy - 44);
    g.addColorStop(0, 'rgba(255,255,255,' + (1 - p) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.strokeStyle = g; x.lineWidth = 1.6; x.beginPath(); x.moveTo(hx, hy); x.lineTo(hx + 90, hy - 44); x.stroke();
  }

  /** Stone platforms, drawn in world space. Edges stay crisp and bright so the ledges read in a fight. */
  function platforms(x, arena, t) {
    var theme = arena.theme, th = THEMES[theme] || THEMES.dusk;
    arena.platforms.forEach(function (p, i) {
      var sp = platformSprite(p, th, theme, i);
      x.drawImage(sp.canvas, p.x + sp.ox, p.y + sp.oy, sp.w, sp.h);
      // Walkable surface highlight and ledge markers
      x.fillStyle = theme === 'night' ? 'rgba(240,250,255,0.85)' : theme === 'grid' ? 'rgba(200,215,255,0.8)' : 'rgba(255,236,190,0.8)';
      x.fillRect(p.x, p.y - 1, p.w, 2);
      if (p.solid) {
        var lg = theme === 'night' ? '180,235,255' : '255,210,140';
        [p.x, p.x + p.w].forEach(function (lx) {
          var g = x.createRadialGradient(lx, p.y, 0, lx, p.y, 16); g.addColorStop(0, 'rgba(' + lg + ',0.75)'); g.addColorStop(1, 'rgba(' + lg + ',0)');
          x.fillStyle = g; x.beginPath(); x.arc(lx, p.y, 16, 0, TAU); x.fill();
        });
      }
      if (theme === 'grid' && p.solid) {
        x.fillStyle = 'rgba(200,220,255,0.35)'; x.font = '11px system-ui';
        for (var m = 0; m <= p.w; m += 100) { x.fillRect(p.x + m, p.y + 6, 1, 10); x.fillText(String(m), p.x + m + 3, p.y + 18); }
      }
      // Fireflies (dusk) or drifting ice glints (night) around soft platforms
      if (!p.solid && theme !== 'grid') {
        for (var f = 0; f < 3; f++) {
          var a = t * 0.8 + f * 2.1 + i, fx = p.x + p.w * (0.2 + 0.3 * f) + Math.sin(a) * 18, fy = p.y + 30 + Math.cos(a * 1.3) * 10;
          var g2 = x.createRadialGradient(fx, fy, 0, fx, fy, 7); g2.addColorStop(0, theme === 'night' ? 'rgba(200,240,255,0.8)' : 'rgba(255,230,120,0.85)'); g2.addColorStop(1, 'rgba(255,230,120,0)');
          x.fillStyle = g2; x.fillRect(fx - 7, fy - 7, 14, 14);
        }
      }
    });
  }

  /** Out-of-focus framing in the lower corners: depth without covering the fight. */
  var fgCache = {};
  function foreground(x, arena, cam, W, H, t) {
    if (arena.theme === 'grid') return;
    var key = arena.theme + W + 'x' + H;
    var fg = fgCache[key];
    if (!fg) {
      fg = canvas(W, H); var c = fg.getContext('2d'), n = Noise(77), night = arena.theme === 'night';
      c.filter = 'blur(6px)';
      c.fillStyle = night ? 'rgba(4,10,20,0.92)' : 'rgba(18,8,20,0.92)';
      [[0, 1], [W, -1]].forEach(function (s) {
        c.beginPath(); c.moveTo(s[0], H);
        for (var i = 0; i <= 14; i++) { var u = i / 14; c.lineTo(s[0] + s[1] * u * W * 0.22, H - H * (0.2 - u * 0.17) - n.fbm(u * 5 + s[0], 1, 3) * H * 0.06); }
        c.lineTo(s[0] + s[1] * W * 0.24, H); c.fill();
        // Leaves / frost-covered branches reaching in
        for (var b = 0; b < 5; b++) {
          var bx = s[0] + s[1] * (20 + b * 30), by = H * (0.82 - b * 0.02);
          c.strokeStyle = c.fillStyle; c.lineWidth = 5; c.beginPath(); c.moveTo(bx, H); c.quadraticCurveTo(bx + s[1] * 40, by, bx + s[1] * (80 + b * 10), by - 30); c.stroke();
        }
      });
      c.filter = 'none';
      fgCache[key] = fg;
    }
    var sway = Math.sin(t * 0.6) * 3;
    x.drawImage(fg, -(cam.x - 800) * 0.08 + sway, -(cam.y - 450) * 0.04, W, H);
  }

  /** Paint an arena ahead of time (so the first frame of a match doesn't stall). */
  function prepare(arena, W, H) {
    scene(arena.theme, W, H);
    var th = THEMES[arena.theme] || THEMES.dusk;
    arena.platforms.forEach(function (p, i) { platformSprite(p, th, arena.theme, i); });
  }

  window.DCScenery = { _scene: scene, backdrop: backdrop, platforms: platforms, foreground: foreground, prepare: prepare, THEMES: THEMES };
})();
