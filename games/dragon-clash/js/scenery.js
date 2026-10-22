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
      sky: [[0, '#0c0816'], [0.3, '#24122e'], [0.52, '#5a1f2c'], [0.68, '#a8402a'], [0.8, '#e07a3a'], [1, '#f5b36a']],
      sun: { x: 0.74, y: 0.66, r: 0.045, col: '#fff2c8', glow: '#ffb35a' },
      cloudLit: '#ffc38a', cloudMid: '#c25f6e', cloudShadow: '#4a2550',
      haze: '#e88a6a', ranges: [
        { top: 0.5, amp: 0.13, freq: 2.2, col: '#8a4f80', light: '#ffb58a', haze: 0.62, seed: 3 },
        { top: 0.6, amp: 0.15, freq: 3.1, col: '#4c2a52', light: '#f08a6a', haze: 0.35, seed: 7 },
      ],
      forest: { line: 0.78, col: '#1f1028', rim: '#ff9a6a', fog: '#c0606a' },
      rock: { base: '#4a3a40', dark: '#140c12', light: '#a07a6a', strata: '#5e4a4a' }, cap: 'moss',
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
    // ── The newer arenas: each has its own landmark painter, live weather and platform cap ──
    volcano: {
      sky: [[0, '#090609'], [0.34, '#1d0d12'], [0.62, '#44201c'], [0.84, '#86503a'], [1, '#b77a4e']],
      cloudLit: '#d98258', cloudMid: '#4a2426', cloudShadow: '#16090c', cloudTh: 0.58,
      haze: '#8a3020', ranges: [
        { top: 0.5, amp: 0.16, freq: 2.6, col: '#3a1a18', light: '#ff7a3a', haze: 0.5, seed: 17 },
        { top: 0.64, amp: 0.12, freq: 3.4, col: '#1e0c0c', light: '#ff5a2a', haze: 0.3, seed: 19 },
      ],
      forest: null, rock: { base: '#3a2c2c', dark: '#120808', light: '#8a5a4a', strata: '#5a3a32' }, cap: 'basalt',
      landmark: 'volcano', edge: '255,170,90', mote: '255,140,60', fg: 'rocks', fgCol: 'rgba(14,4,4,0.94)', vignette: 'rgba(30,4,0,0.5)',
    },
    storm: {
      sky: [[0, '#05070c'], [0.4, '#121b2a'], [0.7, '#293748'], [1, '#5c6870']],
      cloudLit: '#8588a8', cloudMid: '#30334e', cloudShadow: '#0e0e1a', cloudTh: 0.52,
      haze: '#3a3a58', ranges: [
        { top: 0.4, amp: 0.2, freq: 3.2, col: '#2a2a40', light: '#a0a8ff', haze: 0.45, seed: 23, snow: 0.4 },
        { top: 0.58, amp: 0.16, freq: 4.1, col: '#16162a', light: '#8088d0', haze: 0.25, seed: 29 },
      ],
      forest: null, rock: { base: '#4a4a5a', dark: '#16161e', light: '#9a9ab8', strata: '#5a5a70' }, cap: 'wet',
      landmark: 'tower', edge: '200,210,255', mote: '170,190,255', fg: 'rocks', fgCol: 'rgba(6,6,14,0.94)', vignette: 'rgba(4,4,16,0.55)',
    },
    blossom: {
      sky: [[0, '#203d5b'], [0.45, '#6f9eb7'], [0.78, '#d8b9ae'], [1, '#eadcc8']],
      sun: { x: 0.2, y: 0.24, r: 0.035, col: '#fff3d6', glow: '#e9c18a' },
      cloudLit: '#fffaf5', cloudMid: '#eadde6', cloudShadow: '#b7afc8',
      haze: '#c8d8f0', ranges: [
        { top: 0.5, amp: 0.14, freq: 2.2, col: '#6a8ab0', light: '#e8f0ff', haze: 0.6, seed: 31, snow: 0.3 },
        { top: 0.63, amp: 0.1, freq: 3, col: '#4a7a6a', light: '#c8f0c0', haze: 0.4, seed: 37 },
      ],
      forest: { line: 0.8, col: '#2a4a3a', rim: '#ffd0e0', fog: '#f0d8ea', round: true },
      rock: { base: '#8a8070', dark: '#3a3428', light: '#e8dcc0', strata: '#a89880' }, cap: 'blossom',
      landmark: 'pagoda', edge: '235,211,176', mote: '220,170,160', fg: 'branches', fgCol: 'rgba(24,19,24,0.92)', vignette: 'rgba(20,16,24,0.34)',
    },
    arena: {
      sky: [[0, '#1a2a5a'], [0.5, '#4a6ab0'], [0.8, '#f0b070'], [1, '#ffd890']],
      sun: { x: 0.82, y: 0.34, r: 0.04, col: '#fff2c8', glow: '#ffb35a' },
      cloudLit: '#ffe0b0', cloudMid: '#c08a8a', cloudShadow: '#5a4060',
      haze: '#c89a7a', ranges: [{ top: 0.56, amp: 0.08, freq: 2, col: '#8a6a5a', light: '#ffd0a0', haze: 0.6, seed: 41 }],
      forest: null, rock: { base: '#b08a5a', dark: '#4a3420', light: '#f0d8a8', strata: '#c8a070' }, cap: 'sand',
      landmark: 'colosseum', edge: '255,230,170', mote: '255,220,150', fg: 'railing', fgCol: 'rgba(30,18,12,0.94)', vignette: 'rgba(30,14,4,0.38)',
    },
    crystal: {
      sky: [[0, '#05030c'], [0.5, '#120a26'], [1, '#1e1238']], cave: true, clouds: false,
      haze: '#3a2a6a', ranges: [{ top: 0.55, amp: 0.18, freq: 3, col: '#1a1230', light: '#8a6aff', haze: 0.4, seed: 43 }],
      forest: null, rock: { base: '#3a3050', dark: '#100c1c', light: '#8a7ab0', strata: '#4a3a68' }, cap: 'crystal',
      landmark: 'geode', edge: '200,240,255', mote: '150,240,255', fg: 'stalactites', fgCol: 'rgba(6,4,14,0.96)', vignette: 'rgba(4,0,16,0.6)',
    },
    reef: {
      sky: [[0, '#2a9ab8'], [0.3, '#0a6a8a'], [0.75, '#0a3a5a'], [1, '#062436']], clouds: false, underwater: true,
      haze: '#0a5a7a', ranges: [{ top: 0.6, amp: 0.1, freq: 2.4, col: '#0a3a50', light: '#4ac8d8', haze: 0.5, seed: 47 }],
      forest: null, rock: { base: '#6a8a8a', dark: '#1a3238', light: '#b8e0d8', strata: '#7aa0a0' }, cap: 'coral',
      landmark: 'temple', edge: '200,255,250', mote: '200,250,255', fg: 'kelp', fgCol: 'rgba(2,20,28,0.9)', vignette: 'rgba(0,16,30,0.5)',
    },
  };

  // ─────────────── painters (run once per arena and size) ───────────────
  function paintSky(w, h, th, n) {
    var c = canvas(w, h), x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 0, h);
    th.sky.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // Keep the sky quiet so the landmark and fighters remain the focal point.
    var id = x.getImageData(0, 0, w, h), d = id.data;
    for (var y = 0; y < h; y++) for (var i = 0; i < w; i++) {
      var k = (y * w + i) * 4, v = (n.fbm(i * 0.004, y * 0.006, 3) - 0.5) * 6;
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
    if (F.round) {
      // Broadleaf and blossom trees: soft round crowns, some pink
      for (var rt = 0; rt < w / 14; rt++) {
        var rx = r() * w, ry = base(rx) + 4, rr = h * (0.025 + r() * 0.04), pink = r() < 0.45;
        x.fillStyle = F.col; x.fillRect(rx - 1.5, ry - rr * 1.6, 3, rr * 1.6);
        for (var b2 = 0; b2 < 5; b2++) {
          x.fillStyle = pink ? rgba(mix(hex(F.col), [255, 170, 200], 0.55), 1) : F.col;
          x.beginPath(); x.arc(rx + (r() - 0.5) * rr * 1.4, ry - rr * (1.6 + r() * 0.8), rr * (0.5 + r() * 0.4), 0, TAU); x.fill();
        }
      }
    }
    // Trees, back to front, varied height and lean
    for (var t = 0; t < (F.round ? w / 30 : w / 7); t++) {
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

  // ─────────────── landmarks of the newer arenas (painted once, drawn at mid depth) ───────────────
  /** Rock-textured fill of whatever is already drawn on c (keeps alpha), lit from below by `glow`. */
  function texture(c, n, base, dark, light, scale, glowCol, glowFrom) {
    var x = c.getContext('2d'), w = c.width, h = c.height, id = x.getImageData(0, 0, w, h), d = id.data;
    var B = hex(base), Dk = hex(dark), L = hex(light), G = glowCol ? hex(glowCol) : null;
    for (var y = 0; y < h; y++) for (var i = 0; i < w; i++) {
      var k = (y * w + i) * 4;
      if (d[k + 3] < 8) continue;
      var nn = n.fbm(i * scale, y * scale, 4), cc = mix(B, L, clamp((nn - 0.5) * 0.8, 0, 0.28));
      cc = mix(cc, Dk, clamp((0.5 - nn) * 0.8, 0, 0.35));
      if (G) cc = mix(cc, G, clamp((y / h - glowFrom) / (1 - glowFrom), 0, 1) * 0.18 * nn);
      d[k] = cc[0]; d[k + 1] = cc[1]; d[k + 2] = cc[2];
    }
    x.putImageData(id, 0, 0);
  }

  function paintVolcano(w, h, th, n) {
    var c = canvas(w, h), x = c.getContext('2d'), r = rnd(71);
    var cx = w * 0.64, base = h * 0.78, peak = h * 0.24, cw = w * 0.05;
    x.fillStyle = '#171013'; x.beginPath(); x.moveTo(cx - w * 0.42, base);
    for (var i = 0; i <= 40; i++) { var u = i / 40, xx = cx - w * 0.42 + u * (w * 0.42 - cw); x.lineTo(xx, base - (base - peak) * Math.pow(u, 1.7) + (n.fbm(u * 8, 1, 3) - 0.5) * h * 0.03); }
    x.lineTo(cx - cw * 0.6, peak + h * 0.015); x.lineTo(cx + cw * 0.6, peak + h * 0.012);
    for (i = 40; i >= 0; i--) { var u2 = i / 40, x2 = cx + w * 0.42 - u2 * (w * 0.42 - cw); x.lineTo(x2, base - (base - peak) * Math.pow(u2, 1.7) + (n.fbm(u2 * 8, 5, 3) - 0.5) * h * 0.03); }
    x.closePath(); x.fill();
    texture(c, n, '#2a1614', '#0c0404', '#6a3a2a', 0.02, '#ff6a2a', 0.55);
    // A few narrow molten seams keep the volcano readable without turning it into neon line art.
    x.save(); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round';
    for (var rv = 0; rv < 1; rv++) {
      var px = cx + (r() - 0.5) * cw, py = peak + h * 0.02, side = rv % 2 ? 1 : -1, pts = [[px, py]];
      for (var st = 0; st < 22; st++) { px += side * (4 + r() * 10) * w / 1600; py += (10 + r() * 14) * h / 900; pts.push([px, py]); if (py > base) break; }
      [[6, 'rgba(255,90,20,0.08)'], [2, 'rgba(255,140,40,0.24)'], [0.8, 'rgba(255,230,140,0.4)']].forEach(function (L) {
        x.lineWidth = L[0] * w / 1600; x.strokeStyle = L[1]; x.beginPath(); pts.forEach(function (q, k) { x[k ? 'lineTo' : 'moveTo'](q[0], q[1]); }); x.stroke();
      });
    }
    var cg = x.createRadialGradient(cx, peak, 0, cx, peak, h * 0.2); cg.addColorStop(0, 'rgba(255,170,90,0.32)'); cg.addColorStop(0.3, 'rgba(255,90,30,0.16)'); cg.addColorStop(1, 'rgba(255,60,20,0)');
    x.fillStyle = cg; x.fillRect(cx - h * 0.2, peak - h * 0.2, h * 0.4, h * 0.4);
    x.restore();
    // The lava lake along the bottom
    var ly = h * 0.86, id2;
    var lg = x.createLinearGradient(0, ly, 0, h); lg.addColorStop(0, '#7f4324'); lg.addColorStop(0.4, '#4e2218'); lg.addColorStop(1, '#241014');
    x.fillStyle = lg; x.fillRect(0, ly, w, h - ly);
    id2 = x.getImageData(0, ly | 0, w, (h - ly) | 0);
    for (var y = 0; y < id2.height; y++) for (var i2 = 0; i2 < w; i2++) {
      var k = (y * w + i2) * 4, v = n.fbm(i2 * 0.01, y * 0.05 + 30, 4);
      var crust = smooth(0.52, 0.62, v);
      id2.data[k] = id2.data[k] * (1 - crust * 0.75); id2.data[k + 1] = id2.data[k + 1] * (1 - crust * 0.85); id2.data[k + 2] = id2.data[k + 2] * (1 - crust * 0.8);
    }
    x.putImageData(id2, 0, ly | 0);
    return { canvas: c, crater: [cx, peak], lake: ly };
  }

  function paintTower(w, h, th, n) {
    var c = canvas(w, h), x = c.getContext('2d'), r = rnd(83), S = h / 900;
    var tx = w * 0.8, gy = h * 0.62, tw = 70 * S, tt = gy - 330 * S;
    x.fillStyle = '#000';
    // A broken stone watchtower on a crag, the top sheared off at an angle
    x.beginPath(); x.moveTo(tx - 150 * S, h); x.lineTo(tx - 90 * S, gy); x.lineTo(tx + 110 * S, gy + 8 * S); x.lineTo(tx + 170 * S, h); x.fill();
    x.beginPath(); x.moveTo(tx - tw / 2, gy); x.lineTo(tx - tw * 0.42, tt + 20 * S); x.lineTo(tx - tw * 0.1, tt); x.lineTo(tx + tw * 0.2, tt + 34 * S); x.lineTo(tx + tw * 0.42, tt + 26 * S); x.lineTo(tx + tw / 2, gy); x.fill();
    texture(c, n, '#2e2e44', '#0c0c16', '#6a6a8a', 0.03);
    // Masonry lines and arrow slits
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1;
    for (var row = 0; row < 14; row++) { var yy = gy - row * 22 * S; if (yy < tt + 30 * S) break; x.beginPath(); x.moveTo(tx - tw * 0.48, yy); x.lineTo(tx + tw * 0.48, yy); x.stroke(); }
    x.fillStyle = 'rgba(160,190,255,0.75)';
    for (var sl = 0; sl < 4; sl++) x.fillRect(tx - 3 * S + (sl % 2 ? 12 : -12) * S, gy - (60 + sl * 62) * S, 5 * S, 16 * S);
    // The iron lightning rod and its chains
    x.strokeStyle = '#0a0a12'; x.lineWidth = 4 * S;
    x.beginPath(); x.moveTo(tx - tw * 0.1, tt); x.lineTo(tx - tw * 0.1, tt - 90 * S); x.stroke();
    x.lineWidth = 1.5 * S;
    x.beginPath(); x.moveTo(tx - tw * 0.1, tt - 60 * S); x.quadraticCurveTo(tx - 80 * S, tt + 20 * S, tx - 130 * S, gy); x.stroke();
    x.beginPath(); x.moveTo(tx - tw * 0.1, tt - 40 * S); x.quadraticCurveTo(tx + 60 * S, tt + 40 * S, tx + 120 * S, gy + 6 * S); x.stroke();
    // Floating rocks around the peaks
    for (var fr = 0; fr < 6; fr++) {
      var rx = w * (0.1 + r() * 0.6), ry = h * (0.25 + r() * 0.25), rs = (10 + r() * 22) * S;
      x.fillStyle = '#1c1c2c'; x.beginPath(); x.moveTo(rx - rs, ry); x.lineTo(rx + rs, ry - rs * 0.2); x.lineTo(rx + rs * 0.3, ry + rs * 1.1); x.closePath(); x.fill();
      x.fillStyle = 'rgba(160,170,230,0.4)'; x.fillRect(rx - rs, ry - 1, rs * 2, 1.5);
    }
    var hz = x.createLinearGradient(0, tt, 0, h); hz.addColorStop(0, rgba(hex(th.haze), 0.15)); hz.addColorStop(1, rgba(hex(th.haze), 0.45));
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = hz; x.fillRect(0, 0, w, h);
    return { canvas: c, rod: [tx - tw * 0.1, tt - 90 * S] };
  }

  function paintPagoda(w, h, th, n) {
    var c = canvas(w, h), x = c.getContext('2d'), r = rnd(91), S = h / 900, lanterns = [];
    var px = w * 0.72, gy = h * 0.74;
    // Stone terrace
    x.fillStyle = '#8a7a68'; x.fillRect(px - 150 * S, gy - 12 * S, 300 * S, 30 * S);
    x.fillStyle = '#6a5a4a'; x.fillRect(px - 170 * S, gy + 14 * S, 340 * S, 30 * S);
    // Five tiers, each narrower, red posts and dark teal roofs with upturned eaves
    var y = gy - 12 * S;
    for (var tier = 0; tier < 5; tier++) {
      var bw2 = (110 - tier * 16) * S, bh2 = (54 - tier * 4) * S;
      x.fillStyle = '#a8322a'; x.fillRect(px - bw2 * 0.8, y - bh2, bw2 * 1.6, bh2);
      x.fillStyle = 'rgba(255,220,150,0.8)';
      for (var wdw = -2; wdw <= 2; wdw++) x.fillRect(px + wdw * bw2 * 0.3 - 4 * S, y - bh2 * 0.7, 8 * S, bh2 * 0.4);
      y -= bh2;
      var rw = bw2 * 1.35, rh = 22 * S;
      x.fillStyle = '#1f4a4a';
      x.beginPath(); x.moveTo(px - rw, y + 4 * S); x.quadraticCurveTo(px - rw * 0.6, y - rh * 0.2, px - rw * 0.55, y - rh * 0.6); x.lineTo(px + rw * 0.55, y - rh * 0.6);
      x.quadraticCurveTo(px + rw * 0.6, y - rh * 0.2, px + rw, y + 4 * S); x.quadraticCurveTo(px + rw * 1.05, y - 6 * S, px + rw * 1.1, y - 10 * S); x.lineTo(px + rw * 0.9, y + 6 * S);
      x.lineTo(px - rw * 0.9, y + 6 * S); x.lineTo(px - rw * 1.1, y - 10 * S); x.quadraticCurveTo(px - rw * 1.05, y - 6 * S, px - rw, y + 4 * S); x.fill();
      x.fillStyle = 'rgba(160,230,220,0.35)'; x.fillRect(px - rw * 0.55, y - rh * 0.6, rw * 1.1, 2 * S);
      lanterns.push([px - rw * 0.95, y + 10 * S], [px + rw * 0.95, y + 10 * S]);
      y -= rh * 0.6;
    }
    x.fillStyle = '#c8a040'; x.fillRect(px - 2 * S, y - 60 * S, 4 * S, 60 * S);
    for (var ring = 0; ring < 5; ring++) x.fillRect(px - 7 * S, y - 12 * S - ring * 9 * S, 14 * S, 3 * S);
    // A torii gate on the left
    var gx = w * 0.26, gg = h * 0.76;
    x.fillStyle = '#c0382a';
    x.fillRect(gx - 70 * S, gg - 150 * S, 12 * S, 150 * S); x.fillRect(gx + 58 * S, gg - 150 * S, 12 * S, 150 * S);
    x.fillRect(gx - 84 * S, gg - 128 * S, 168 * S, 10 * S);
    x.fillStyle = '#2a1a1a';
    x.beginPath(); x.moveTo(gx - 100 * S, gg - 150 * S); x.quadraticCurveTo(gx, gg - 160 * S, gx + 100 * S, gg - 150 * S); x.lineTo(gx + 104 * S, gg - 164 * S); x.quadraticCurveTo(gx, gg - 176 * S, gx - 104 * S, gg - 164 * S); x.fill();
    // Cherry trees: dark trunks under clouds of pink blossom
    for (var tr = 0; tr < 7; tr++) {
      var tx = w * (0.08 + r() * 0.9), ty = h * (0.78 + r() * 0.05), tsz = (40 + r() * 50) * S;
      x.strokeStyle = '#3a2420'; x.lineWidth = 5 * S; x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(tx + 10 * S, ty - tsz * 0.6, tx - 6 * S, ty - tsz); x.stroke();
      for (var bl = 0; bl < 14; bl++) {
        var bx = tx + (r() - 0.5) * tsz * 1.6, by = ty - tsz * (0.9 + r() * 0.6), br = tsz * (0.22 + r() * 0.2);
        var g = x.createRadialGradient(bx - br * 0.3, by - br * 0.3, 0, bx, by, br);
        g.addColorStop(0, '#ffe4ee'); g.addColorStop(0.6, '#ffb0c8'); g.addColorStop(1, 'rgba(230,130,170,0)');
        x.fillStyle = g; x.beginPath(); x.arc(bx, by, br, 0, TAU); x.fill();
      }
    }
    var hz = x.createLinearGradient(0, h * 0.4, 0, h); hz.addColorStop(0, rgba(hex(th.haze), 0.25)); hz.addColorStop(1, rgba(hex(th.haze), 0.4));
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = hz; x.fillRect(0, 0, w, h);
    return { canvas: c, lanterns: lanterns };
  }

  function paintColosseum(w, h, th, n) {
    var c = canvas(w, h), x = c.getContext('2d'), S = h / 900, stands = [], tiers = [];
    var top = h * 0.36, bot = h * 0.8;
    // Three tiers curving round the back of the arena, textured as sandstone first
    for (var tier = 0; tier < 3; tier++) {
      var y0 = top + tier * (bot - top) / 3, y1 = y0 + (bot - top) / 3, curve = h * 0.03 * (2 - tier);
      x.fillStyle = '#000';
      x.beginPath(); x.moveTo(-10, y1 + curve); x.quadraticCurveTo(w / 2, y1 - curve, w + 10, y1 + curve); x.lineTo(w + 10, y0 + curve); x.quadraticCurveTo(w / 2, y0 - curve, -10, y0 + curve); x.fill();
      tiers.push([y0, y1, curve]);
      stands.push({ y: y0 + 4 * S, curve: curve, h: (y1 - y0) * 0.22 });
    }
    x.fillRect(0, bot, w, h - bot);
    texture(c, n, '#c09466', '#6a4a2a', '#f4dcb0', 0.04);
    // Each tier: a lit cornice, then a row of dark arches with a lit inner rim
    tiers.forEach(function (T, tier) {
      var y0 = T[0], y1 = T[1], curve = T[2];
      var yAt = function (u) { return curve * (1 - 4 * u * (1 - u) * 2) * 0.5; };
      x.strokeStyle = 'rgba(255,236,200,0.55)'; x.lineWidth = 3 * S;
      x.beginPath(); x.moveTo(-10, y0 + curve + 2); x.quadraticCurveTo(w / 2, y0 - curve + 2, w + 10, y0 + curve + 2); x.stroke();
      x.fillStyle = 'rgba(0,0,0,0.25)';
      x.beginPath(); x.moveTo(-10, y1 + curve); x.quadraticCurveTo(w / 2, y1 - curve, w + 10, y1 + curve); x.lineTo(w + 10, y1 + curve - 6 * S); x.quadraticCurveTo(w / 2, y1 - curve - 6 * S, -10, y1 + curve - 6 * S); x.fill();
      var aw = (52 - tier * 4) * S, ah = (y1 - y0) * 0.6;
      for (var ax = aw * 0.3; ax < w; ax += aw * 1.4) {
        var u = (ax + aw / 2) / w, yc = y0 + yAt(u) + (y1 - y0) * 0.28;
        var g = x.createLinearGradient(0, yc, 0, yc + ah); g.addColorStop(0, 'rgba(30,16,8,0.95)'); g.addColorStop(1, 'rgba(60,34,16,0.85)');
        x.fillStyle = g;
        x.beginPath(); x.moveTo(ax, yc + ah); x.lineTo(ax, yc + aw * 0.5); x.arc(ax + aw / 2, yc + aw * 0.5, aw / 2, Math.PI, 0); x.lineTo(ax + aw, yc + ah); x.fill();
        x.strokeStyle = 'rgba(255,220,170,0.35)'; x.lineWidth = 1.5 * S; x.stroke();
      }
    });
    // Banners hanging from the top rim in the dragon element colours
    var cols = ['#d8361c', '#5fb8ff', '#ffe14a', '#8a6a4a', '#0f8fa0'];
    for (var b = 0; b < 9; b++) {
      var bx = w * (0.06 + b * 0.11), by = top - 6 * S, bwid = 22 * S, bh = 70 * S;
      x.fillStyle = cols[b % 5]; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + bwid, by); x.lineTo(bx + bwid, by + bh); x.lineTo(bx + bwid / 2, by + bh - 12 * S); x.lineTo(bx, by + bh); x.fill();
      x.fillStyle = 'rgba(255,240,200,0.6)'; x.fillRect(bx + bwid * 0.3, by + 18 * S, bwid * 0.4, bwid * 0.4);
    }
    // The arena wall in front of the stands: big blocks, darker
    x.fillStyle = 'rgba(40,24,12,0.45)'; x.fillRect(0, bot, w, h - bot);
    x.fillStyle = 'rgba(30,16,8,0.6)'; for (var bl = 0; bl < w; bl += 60 * S) x.fillRect(bl, bot, 2, h - bot);
    x.fillStyle = 'rgba(255,230,180,0.4)'; x.fillRect(0, bot, w, 2 * S);
    var hz = x.createLinearGradient(0, top, 0, h); hz.addColorStop(0, rgba(hex(th.haze), 0.22)); hz.addColorStop(1, rgba(hex(th.haze), 0.08));
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = hz; x.fillRect(0, 0, w, h);
    return { canvas: c, stands: stands };
  }

  function paintGeode(w, h, th, n) {
    var c = canvas(w, h), x = c.getContext('2d'), r = rnd(103), S = h / 900, crystals = [];
    // Ceiling and stalactites, with an opening that lets a shaft of light in
    x.fillStyle = '#000'; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, 0);
    for (var i = 0; i <= 80; i++) {
      var u = 1 - i / 80, xx = u * w, hole = Math.exp(-Math.pow((u - 0.3) / 0.05, 2));
      var yy = h * (0.12 + n.fbm(u * 6, 3, 4) * 0.1) * (1 - hole * 0.95);
      if (i % 3 === 0 && r() < 0.7 && hole < 0.2) { x.lineTo(xx + 8 * S, yy); x.lineTo(xx, yy + (30 + r() * 90) * S); x.lineTo(xx - 8 * S, yy); }
      else x.lineTo(xx, yy);
    }
    x.closePath(); x.fill();
    // Side walls
    x.beginPath(); x.moveTo(0, 0); x.lineTo(w * 0.12, h * 0.2); x.quadraticCurveTo(w * 0.04, h * 0.6, w * 0.1, h); x.lineTo(0, h); x.fill();
    x.beginPath(); x.moveTo(w, 0); x.lineTo(w * 0.9, h * 0.22); x.quadraticCurveTo(w * 0.97, h * 0.6, w * 0.88, h); x.lineTo(w, h); x.fill();
    texture(c, n, '#241a3a', '#08060e', '#5a4a80', 0.025);
    // Crystal clusters on the walls and floor: cyan, violet, magenta
    var palette = [['#7ff6ff', '#2a9ab8'], ['#c8a0ff', '#5a3ab0'], ['#ff8ae6', '#a03a90']];
    for (var cl = 0; cl < 26; cl++) {
      var side = r(), cxp = side < 0.35 ? w * (0.02 + r() * 0.12) : side < 0.7 ? w * (0.86 + r() * 0.12) : w * (0.15 + r() * 0.7);
      var cyp = side < 0.7 ? h * (0.2 + r() * 0.7) : h * (0.12 + r() * 0.06), sz = (14 + r() * 40) * S, col = palette[cl % 3];
      var dir = side < 0.7 ? (side < 0.35 ? 0.6 : -0.6) : Math.PI;   // floor/walls point inward, ceiling points down
      for (var sh = 0; sh < 4 + (r() * 4 | 0); sh++) {
        var a = (side < 0.7 ? -Math.PI / 2 + dir : Math.PI / 2) + (r() - 0.5) * 1.2, L = sz * (0.5 + r()), wd = sz * 0.18;
        var tx = cxp + Math.cos(a) * L, ty = cyp + Math.sin(a) * L, nx = -Math.sin(a) * wd, ny = Math.cos(a) * wd;
        var g = x.createLinearGradient(cxp, cyp, tx, ty); g.addColorStop(0, col[1]); g.addColorStop(1, col[0]);
        x.fillStyle = g; x.beginPath(); x.moveTo(cxp + nx, cyp + ny); x.lineTo(tx, ty); x.lineTo(cxp - nx, cyp - ny); x.fill();
        x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(cxp, cyp); x.lineTo(tx, ty); x.stroke();
      }
      crystals.push([cxp, cyp, col[0], sz]);
    }
    return { canvas: c, crystals: crystals, hole: [w * 0.3, h * 0.02] };
  }

  function paintTemple(w, h, th, n) {
    var c = canvas(w, h), x = c.getContext('2d'), r = rnd(109), S = h / 900;
    var gy = h * 0.8;
    // Sand floor with ripples
    x.fillStyle = '#000'; x.beginPath(); x.moveTo(0, h); for (var i = 0; i <= 40; i++) x.lineTo(w * i / 40, gy + (n.fbm(i * 0.3, 2, 3) - 0.5) * 30 * S); x.lineTo(w, h); x.fill();
    // Columns, some broken, under a fallen pediment
    for (var col = 0; col < 7; col++) {
      var cx = w * (0.18 + col * 0.11), ch = (220 - (col % 3 === 1 ? 110 : 0) - r() * 30) * S, cw = 26 * S;
      x.fillRect(cx - cw / 2, gy - ch, cw, ch);
      x.fillRect(cx - cw * 0.75, gy - ch - 10 * S, cw * 1.5, 10 * S);
      if (col % 3 === 1) { x.beginPath(); x.moveTo(cx - cw / 2, gy - ch); x.lineTo(cx - cw * 0.1, gy - ch - 18 * S); x.lineTo(cx + cw / 2, gy - ch - 6 * S); x.fill(); }
    }
    x.beginPath(); x.moveTo(w * 0.4, gy - 250 * S); x.lineTo(w * 0.52, gy - 320 * S); x.lineTo(w * 0.64, gy - 250 * S); x.closePath(); x.fill();
    x.fillRect(w * 0.38, gy - 252 * S, w * 0.28, 14 * S);
    // A great stone dragon head half buried in the sand
    var hx = w * 0.12, hy = gy - 30 * S;
    x.beginPath(); x.moveTo(hx - 80 * S, gy); x.quadraticCurveTo(hx - 70 * S, hy - 90 * S, hx + 10 * S, hy - 110 * S); x.lineTo(hx + 60 * S, hy - 140 * S); x.lineTo(hx + 50 * S, hy - 96 * S);
    x.quadraticCurveTo(hx + 140 * S, hy - 70 * S, hx + 150 * S, hy - 20 * S); x.lineTo(hx + 90 * S, hy - 10 * S); x.lineTo(hx + 120 * S, gy); x.fill();
    texture(c, n, '#5a8a88', '#163a40', '#b8e8dc', 0.03);
    x.fillStyle = 'rgba(120,255,240,0.7)'; x.beginPath(); x.arc(hx + 40 * S, hy - 70 * S, 6 * S, 0, TAU); x.fill();
    // Coral on the ruins
    var cc = ['#ff8a7a', '#ffb35a', '#e86ab0', '#c8f07a'];
    for (var co = 0; co < 30; co++) {
      var bx = r() * w, by = gy + (r() - 0.6) * 20 * S, ccol = cc[co % 4];
      x.strokeStyle = ccol; x.lineWidth = 3 * S; x.lineCap = 'round';
      for (var br = 0; br < 4; br++) { var a = -Math.PI / 2 + (r() - 0.5) * 1.6, L = (8 + r() * 20) * S; x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo(bx + Math.cos(a) * L * 0.5 + 3, by + Math.sin(a) * L * 0.5, bx + Math.cos(a) * L, by + Math.sin(a) * L); x.stroke(); }
    }
    var hz = x.createLinearGradient(0, h * 0.4, 0, h); hz.addColorStop(0, rgba(hex(th.haze), 0.3)); hz.addColorStop(1, rgba(hex(th.haze), 0.12));
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = hz; x.fillRect(0, 0, w, h);
    return { canvas: c };
  }

  var LANDMARKS = { volcano: paintVolcano, tower: paintTower, pagoda: paintPagoda, colosseum: paintColosseum, geode: paintGeode, temple: paintTemple };

  // ─────────────── platform sprites (world space) ───────────────
  var platCache = {};
  /** An arena wall: a sandstone column with fluting, a capital and a banner. */
  function columnSprite(p, th, theme, idx) {
    var R = 2.25, pad = 30, w = Math.round((p.w + pad * 2) * R), h = Math.round((p.h + pad * 2) * R);
    var c = canvas(w, h), x = c.getContext('2d'), n = Noise(700 + idx), L = pad * R, T = pad * R, Wd = p.w * R, Hd = p.h * R;
    x.fillStyle = '#000'; x.fillRect(L + 8 * R, T + 24 * R, Wd - 16 * R, Hd - 24 * R);       // shaft
    x.fillRect(L - 6 * R, T, Wd + 12 * R, 26 * R);                                            // capital
    x.fillRect(L - 4 * R, T + Hd - 30 * R, Wd + 8 * R, 30 * R);                               // base
    texture(c, n, th.rock.base, th.rock.dark, th.rock.light, 0.05);
    x.strokeStyle = 'rgba(60,40,20,0.45)'; x.lineWidth = 2 * R;
    for (var f = 1; f < 6; f++) { var fx = L + 8 * R + f * (Wd - 16 * R) / 6; x.beginPath(); x.moveTo(fx, T + 30 * R); x.lineTo(fx, T + Hd - 34 * R); x.stroke(); }
    var sh = x.createLinearGradient(L, 0, L + Wd, 0); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(0.4, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.45)');
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = sh; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'source-over';
    x.fillStyle = idx % 2 ? '#5fb8ff' : '#d8361c';
    x.beginPath(); x.moveTo(L + Wd * 0.25, T + 30 * R); x.lineTo(L + Wd * 0.75, T + 30 * R); x.lineTo(L + Wd * 0.75, T + 150 * R); x.lineTo(L + Wd * 0.5, T + 130 * R); x.lineTo(L + Wd * 0.25, T + 150 * R); x.fill();
    x.fillStyle = 'rgba(255,230,160,0.8)'; x.beginPath(); x.arc(L + Wd * 0.5, T + 70 * R, 10 * R, 0, TAU); x.fill();
    return { canvas: c, ox: -pad, oy: -pad, w: w / R, h: h / R };
  }

  function platformSprite(p, th, theme, idx) {
    var key = theme + ':' + idx + ':' + p.w + 'x' + p.h + (p.solid ? 's' : '');
    if (platCache[key]) return platCache[key];
    if (p.wall) return (platCache[key] = columnSprite(p, th, theme, idx));
    var R = 2.25, pad = 40, depth = p.solid ? p.h + 70 : 46;
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
    x.strokeStyle = rgba(dark, 0.3); x.lineCap = 'round';
    for (var cr = 0; cr < (p.solid ? p.w / 150 : 1); cr++) {
      var cx = L + r() * (Rx - L), cy = top + (6 + r() * 30) * R;
      x.lineWidth = (0.8 + r() * 1.2) * R; x.beginPath(); x.moveTo(cx, cy);
      for (var seg = 0; seg < 5; seg++) { cx += (r() - 0.5) * 18 * R; cy += r() * 14 * R; x.lineTo(cx, cy); }
      x.stroke();
    }
    // Cap: moss with grass blades, or snow with icicles
    var cap = th.cap;
    if (cap === 'moss') {
      // Dark moss creeping over the lip, mottled, with only a few low tufts
      var mc = canvas(Math.ceil(Rx - L + 8), Math.ceil(14 * R)), mcx = mc.getContext('2d'), mid = mcx.createImageData(mc.width, mc.height), md = mid.data;
      for (var my = 0; my < mid.height; my++) for (var mxp = 0; mxp < mid.width; mxp++) {
        var edge = (3 + n.fbm((L - 4 + mxp) * 0.05, 7, 3) * 9) * R, k3 = (my * mid.width + mxp) * 4;
        if (my > edge) continue;
        var mv = n.fbm(mxp * 0.08, my * 0.08 + 40, 3);
        md[k3] = 34 + mv * 30; md[k3 + 1] = 52 + mv * 40; md[k3 + 2] = 30 + mv * 20; md[k3 + 3] = 255 * Math.min(1, (edge - my) / 2.5);
      }
      mcx.putImageData(mid, 0, 0); x.drawImage(mc, L - 4, top - 2);
      x.strokeStyle = 'rgba(70,100,55,0.8)'; x.lineWidth = 1;
      for (var gb = 0; gb < p.w * 0.12; gb++) { var gx = L + r() * (Rx - L), gh = (1.5 + r() * 3) * R; x.beginPath(); x.moveTo(gx, top + 1); x.lineTo(gx + (r() - 0.5) * 3, top - gh); x.stroke(); }
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
    } else if (cap === 'basalt') {
      // Ash-grey crust on top, magma glowing in the cracks
      x.fillStyle = '#4a4040'; x.fillRect(L - 2, top - 2, Rx - L + 4, 4 * R);
      x.save(); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round';
      for (var mg = 0; mg < (p.solid ? Math.max(1, p.w / 260) : 1); mg++) {
        var mx2 = L + r() * (Rx - L), my2 = top + (8 + r() * (p.solid ? 50 : 14)) * R, pts = [[mx2, my2]];
        for (var ms = 0; ms < 5; ms++) { mx2 += (r() - 0.5) * 24 * R; my2 += r() * 12 * R; pts.push([mx2, my2]); }
        [[3, 'rgba(255,80,20,0.06)'], [1, 'rgba(255,150,50,0.2)'], [0.5, 'rgba(255,230,150,0.3)']].forEach(function (LW) {
          x.lineWidth = LW[0] * R; x.strokeStyle = LW[1]; x.beginPath(); pts.forEach(function (q, k) { x[k ? 'lineTo' : 'moveTo'](q[0], q[1]); }); x.stroke();
        });
      }
      x.restore();
    } else if (cap === 'wet') {
      // Rain-slick granite: a bright sheen along the lip, dark moss, puddle glints
      x.fillStyle = '#2e3a2e'; x.beginPath(); x.moveTo(L - 4, top - 1);
      for (var wm = L - 4; wm <= Rx + 4; wm += 7) x.lineTo(wm, top + (2 + n.fbm(wm * 0.05, 4, 3) * 6) * R);
      x.lineTo(Rx + 4, top - 1); x.fill();
      x.fillStyle = 'rgba(200,210,255,0.55)'; x.fillRect(L, top - 1, Rx - L, 1.5 * R);
      for (var pg2 = 0; pg2 < p.w / 90; pg2++) { x.fillStyle = 'rgba(180,190,240,0.35)'; x.beginPath(); x.ellipse(L + r() * (Rx - L), top + 1, (8 + r() * 14) * R, 1.6 * R, 0, 0, TAU); x.fill(); }
    } else if (cap === 'blossom') {
      x.fillStyle = '#4f7a3c';
      x.beginPath(); x.moveTo(L - 4, top - 2);
      for (var bmx = L - 4; bmx <= Rx + 4; bmx += 6) x.lineTo(bmx, top + (3 + n.fbm(bmx * 0.05, 7, 3) * 8) * R);
      x.lineTo(Rx + 4, top - 2); x.fill();
      for (var pt = 0; pt < p.w * 0.15; pt++) { x.fillStyle = r() < 0.6 ? 'rgba(230,160,180,0.8)' : 'rgba(245,215,225,0.8)'; x.beginPath(); x.ellipse(L + r() * (Rx - L), top - 1 + r() * 6 * R, 2.2, 1.3, r() * 3, 0, TAU); x.fill(); }
      x.strokeStyle = 'rgba(50,70,30,0.8)';
      for (var bv = 0; bv < (p.solid ? p.w / 50 : 2); bv++) { var bvx = L + 20 + r() * (Rx - L - 40), bvl = (16 + r() * 40) * R; x.lineWidth = 1.2; x.beginPath(); x.moveTo(bvx, top + 10 * R); x.quadraticCurveTo(bvx + 6, top + bvl * 0.6, bvx - 2, top + bvl); x.stroke(); }
    } else if (cap === 'sand') {
      // Dressed sandstone: courses of blocks, sand drifted along the top
      x.strokeStyle = 'rgba(70,46,24,0.45)'; x.lineWidth = 1.2;
      for (var row = 0; row < (p.solid ? 6 : 2); row++) {
        var ry = top + (10 + row * 22) * R; x.beginPath(); x.moveTo(L, ry); x.lineTo(Rx, ry); x.stroke();
        for (var jx = L + (row % 2) * 30 * R; jx < Rx; jx += 60 * R) { x.beginPath(); x.moveTo(jx, ry); x.lineTo(jx, ry + 22 * R); x.stroke(); }
      }
      x.fillStyle = '#e8cc94'; x.beginPath(); x.moveTo(L - 3, top - 2);
      for (var sd = L - 3; sd <= Rx + 3; sd += 8) x.lineTo(sd, top + (2 + n.fbm(sd * 0.03, 9, 3) * 5) * R);
      x.lineTo(Rx + 3, top - 2); x.fill();
    } else if (cap === 'crystal') {
      // Crystal clusters growing up from the edges and hanging underneath
      var cols = [['#7ff6ff', '#2a9ab8'], ['#c8a0ff', '#5a3ab0'], ['#ff8ae6', '#a03a90']];
      for (var cc2 = 0; cc2 < (p.solid ? p.w / 60 : 3); cc2++) {
        var ccx = L + 10 + r() * (Rx - L - 20), up = r() < 0.4, ccy = up ? top + 2 : top + (p.solid ? 30 + r() * 60 : 18) * R, ccol = cols[cc2 % 3];
        for (var sh = 0; sh < 4; sh++) {
          var a = (up ? -Math.PI / 2 : Math.PI / 2) + (r() - 0.5) * 1.1, Lc = (6 + r() * (up ? 12 : 22)) * R, wd = 2.4 * R;
          var tx = ccx + Math.cos(a) * Lc, ty = ccy + Math.sin(a) * Lc;
          var g = x.createLinearGradient(ccx, ccy, tx, ty); g.addColorStop(0, ccol[1]); g.addColorStop(1, ccol[0]);
          x.fillStyle = g; x.beginPath(); x.moveTo(ccx - Math.sin(a) * wd, ccy + Math.cos(a) * wd); x.lineTo(tx, ty); x.lineTo(ccx + Math.sin(a) * wd, ccy - Math.cos(a) * wd); x.fill();
        }
      }
      x.fillStyle = 'rgba(160,230,255,0.5)'; x.fillRect(L, top - 1, Rx - L, 1.5 * R);
    } else if (cap === 'coral') {
      // Pale stone grown over with coral and barnacles, seaweed trailing below
      var ccs = ['#ff8a7a', '#ffb35a', '#e86ab0', '#c8f07a'];
      for (var co = 0; co < (p.solid ? p.w / 25 : 5); co++) {
        var cx3 = L + r() * (Rx - L), cy3 = top + (r() < 0.5 ? 2 : (p.solid ? 20 + r() * 60 : 14) * R), ccol2 = ccs[co % 4];
        x.strokeStyle = ccol2; x.lineWidth = 2 * R; x.lineCap = 'round';
        for (var br = 0; br < 3; br++) { var ca = (cy3 < top + 4 ? -Math.PI / 2 : Math.PI / 2) + (r() - 0.5) * 1.4, cl = (5 + r() * 9) * R; x.beginPath(); x.moveTo(cx3, cy3); x.lineTo(cx3 + Math.cos(ca) * cl, cy3 + Math.sin(ca) * cl); x.stroke(); }
      }
      x.strokeStyle = 'rgba(40,110,70,0.8)';
      for (var sw = 0; sw < (p.solid ? p.w / 45 : 2); sw++) { var swx = L + 20 + r() * (Rx - L - 40), swl = (20 + r() * 50) * R; x.lineWidth = 1.6; x.beginPath(); x.moveTo(swx, top + 12 * R); x.bezierCurveTo(swx + 8, top + swl * 0.3, swx - 8, top + swl * 0.6, swx + 4, top + swl); x.stroke(); }
      x.fillStyle = 'rgba(220,255,250,0.5)'; x.fillRect(L, top - 1, Rx - L, 1.5 * R);
    } else {
      x.fillStyle = '#7a88aa'; x.fillRect(L - 2, top - 2, Rx - L + 4, 5 * R);
    }
    if (p.altar) {
      // A carved altar: a band of glowing glyphs along its face
      x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = 'rgba(120,255,240,0.75)';
      for (var gl = 0; gl < 8; gl++) { var gx2 = L + 12 * R + gl * (Rx - L - 24 * R) / 7, gy2 = top + 26 * R; x.fillRect(gx2 - 3, gy2 - 6, 6, 3); x.fillRect(gx2 - 1, gy2 - 6, 2, 12); }
      x.restore();
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
    if (th.landmark) {
      // Newer arenas: sky (+ far range) far back, near range + landmark at mid depth, an optional forest in front
      var lr = th.sun ? th.sun.x > 0.5 : true;
      sc.clouds = th.clouds === false ? [] : [
        paintClouds(bw, bh, th, Noise(21 + theme.length), { sun: th.sun ? [th.sun.x, th.sun.y] : null, y0: 0.04, y1: 0.42, sx: 0.0035, sy: 0.016, th: th.cloudTh || 0.5, soft: 0.16, alpha: 0.48, lightX: lr ? 0.04 : -0.04, lightY: 0.03 }),
        paintClouds(bw, bh, th, Noise(22 + theme.length), { sun: th.sun ? [th.sun.x, th.sun.y] : null, y0: 0.34, y1: 0.66, sx: 0.006, sy: 0.011, th: (th.cloudTh || 0.5) - 0.03, soft: 0.12, alpha: 0.58, lightX: lr ? 0.05 : -0.05, lightY: 0.05 }),
      ];
      var rg = th.ranges.map(function (R) { return paintRange(bw, bh, th, n, R, lr); });
      sc.sky.getContext('2d').drawImage(rg[0], 0, 0);
      sc.land = LANDMARKS[th.landmark](bw, bh, th, n);
      sc.mid = rg[1] || canvas(bw, bh);
      sc.mid.getContext('2d').drawImage(sc.land.canvas, 0, 0); sc.land.canvas = null;
      if (th.forest) sc.forest = paintForest(bw, bh, th, n);
      sc.ranges = [];
    } else if (theme === 'grid') {
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
    var theme = arena.theme, sc = scene(theme, W, H), th = sc.th;
    var cam = { x: cam0.x, y: cam0.y, zoom: cam0.zBase ? cam0.z / cam0.zBase : 1 };
    layer(x, sc.sky, 0.05, cam, W, H, sc);
    if (theme === 'night') aurora(x, W, H, t, cam);
    if (th.landmark && LIVE[th.landmark].sky) LIVE[th.landmark].sky(x, sc, cam, W, H, t);
    // Clouds drift; each layer wraps seamlessly by drawing it twice
    sc.clouds.forEach(function (cl, k) {
      var speed = (k ? 9 : 4) * (theme === 'storm' ? 3.5 : 1), off = (t * speed) % sc.w;
      layer(x, cl, 0.06 + k * 0.05, cam, W, H, sc, off);
      layer(x, cl, 0.06 + k * 0.05, cam, W, H, sc, off - sc.w);
    });
    if (theme === 'dusk') shafts(x, W, H, t);
    else if (th.landmark && th.sun) shafts(x, W, H, t, th.sun.x, th.sun.y, theme === 'blossom' ? '255,245,220' : '255,200,140');
    if (sc.ranges[0]) layer(x, sc.ranges[0], 0.1, cam, W, H, sc);
    if (sc.islands) waterfalls(x, sc, cam, W, H, t);
    if (sc.mid) {
      layer(x, sc.mid, 0.2, cam, W, H, sc);
      if (sc.citadel) chimney(x, sc, cam, W, H, t, theme);
      else if (th.landmark && LIVE[th.landmark].mid) LIVE[th.landmark].mid(x, sc, cam, W, H, t);
    }
    if (theme === 'dusk' || theme === 'blossom' || theme === 'arena') flock(x, W, H, t);
    if (sc.forest) layer(x, sc.forest, 0.32, cam, W, H, sc);
    if (th.landmark) { if (LIVE[th.landmark].near) LIVE[th.landmark].near(x, sc, cam, W, H, t); }
    else mist(x, W, H, t, theme);
    grade(x, theme, W, H);
    if (theme === 'night') shootingStar(x, W, H, t);
    if (theme === 'grid') {
      x.strokeStyle = 'rgba(140,170,255,0.06)'; x.lineWidth = 1;
      for (var gx = -((cam.x * 0.3) % 80); gx < W; gx += 80) { x.beginPath(); x.moveTo(gx, H * 0.55); x.lineTo(gx, H); x.stroke(); }
    }
  }

  // Colour grading: the backdrop is pulled down in saturation and brightness and tinted per arena, so the painted
  // HD dragons (dark, detailed, lit by their element) carry the contrast and the scenery reads as depth behind them.
  var GRADE = {
    dusk: { desat: 0.25, tint: '#9a7884', dark: 0.16 }, night: { desat: 0.25, tint: '#7088a8', dark: 0.15 }, grid: { desat: 0.3, tint: '#8890a8', dark: 0.1 },
    volcano: { desat: 0.34, tint: '#795b55', dark: 0.22 }, storm: { desat: 0.38, tint: '#687789', dark: 0.24 }, blossom: { desat: 0.48, tint: '#988f8a', dark: 0.25 },
    arena: { desat: 0.42, tint: '#8d7963', dark: 0.24 }, crystal: { desat: 0.28, tint: '#77758b', dark: 0.2 }, reef: { desat: 0.34, tint: '#63878a', dark: 0.22 },
  };
  function grade(x, theme, W, H) {
    var G = GRADE[theme]; if (!G) return;
    x.save();
    x.globalCompositeOperation = 'saturation'; x.fillStyle = 'rgba(128,128,128,' + G.desat + ')'; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = G.tint; x.globalAlpha = 0.38; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    var v = x.createRadialGradient(W * 0.5, H * 0.42, H * 0.18, W * 0.5, H * 0.48, Math.max(W, H) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.7, 'rgba(0,0,0,' + G.dark * 0.45 + ')');
    v.addColorStop(1, 'rgba(0,0,0,' + G.dark * 1.45 + ')');
    x.fillStyle = v; x.fillRect(0, 0, W, H);
    x.restore();
  }

  function screenPos(sc, depth, cam, W, H, px, py) {
    var z = 1 + (cam.zoom - 1) * depth * 0.5;
    var dw = sc.w * z, dh = sc.h * z;
    return [(W - dw) / 2 - (cam.x - 800) * depth * 0.35 + px * z, (H - dh) / 2 - (cam.y - 450) * depth * 0.25 + (dh - H) * 0.1 + py * z, z];
  }

  // ─────────────── live motion of the newer arenas ───────────────
  // sky: right after the sky layer; mid: on top of the landmark; near: in front of everything behind the platforms.
  function seeded(k) { var r = rnd(k * 7919 + 13); return r; }
  var LIVE = {
    volcano: {
      mid: function (x, sc, cam, W, H, t) {
        var L = sc.land, p = screenPos(sc, 0.2, cam, W, H, L.crater[0], L.crater[1]), z = p[2];
        x.save(); x.globalCompositeOperation = 'lighter';
        var pulse = 0.55 + 0.25 * Math.sin(t * 1.7) + 0.1 * Math.sin(t * 5.3);
        var g = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], 120 * z); g.addColorStop(0, 'rgba(255,170,70,' + 0.5 * pulse + ')'); g.addColorStop(1, 'rgba(255,80,20,0)');
        x.fillStyle = g; x.beginPath(); x.arc(p[0], p[1], 120 * z, 0, TAU); x.fill();
        // The lava lake shimmers
        var lp = screenPos(sc, 0.2, cam, W, H, 0, L.lake);
        for (var k = 0; k < 40; k++) {
          var lx = ((k * 137.1 + t * (12 + k % 5 * 4)) % (W + 80)) - 40, ly = lp[1] + ((k * 53) % 60) * z, a = 0.2 + 0.2 * Math.sin(t * 3 + k);
          x.fillStyle = 'rgba(255,220,120,' + a + ')'; x.beginPath(); x.ellipse(lx, ly, (14 + k % 4 * 6) * z, 2 * z, 0, 0, TAU); x.fill();
        }
        x.restore();
        // Smoke plume, and an eruption every 14 s that throws glowing bombs
        for (var i = 0; i < 16; i++) {
          var kk = (t * 0.06 + i / 16) % 1, r = (10 + kk * 70) * z;
          x.fillStyle = 'rgba(40,20,20,' + 0.35 * (1 - kk) + ')'; x.beginPath(); x.arc(p[0] + Math.sin(kk * 4 + i) * 12 * z + kk * 90 * z, p[1] - kk * 260 * z, r, 0, TAU); x.fill();
        }
        var cyc = t % 14;
        if (cyc < 3.2) {
          var rr = seeded(Math.floor(t / 14));
          x.save(); x.globalCompositeOperation = 'lighter';
          for (var b = 0; b < 12; b++) {
            var vx = (rr() - 0.5) * 220, vy = 260 + rr() * 200, tt = cyc - b * 0.08;
            if (tt <= 0) continue;
            var bx = p[0] + vx * tt * z, by = p[1] + (-vy * tt + 160 * tt * tt) * z;
            x.fillStyle = 'rgba(255,200,90,0.9)'; x.beginPath(); x.arc(bx, by, 3 * z, 0, TAU); x.fill();
            x.strokeStyle = 'rgba(255,120,40,0.45)'; x.lineWidth = 2 * z; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx - vx * 0.05 * z, by + (vy - 320 * tt) * 0.05 * z); x.stroke();
          }
          var fl = Math.max(0, 1 - cyc / 0.6);
          if (fl > 0) { var eg = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], 260 * z); eg.addColorStop(0, 'rgba(255,200,100,' + 0.6 * fl + ')'); eg.addColorStop(1, 'rgba(255,90,30,0)'); x.fillStyle = eg; x.fillRect(p[0] - 260 * z, p[1] - 260 * z, 520 * z, 520 * z); }
          x.restore();
        }
      },
      near: function (x, sc, cam, W, H, t) {
        // Heat: embers rising and ash drifting down
        x.save(); x.globalCompositeOperation = 'lighter';
        for (var e = 0; e < 60; e++) {
          var k = ((t * (0.05 + (e % 7) * 0.012) + e * 0.137) % 1), ex = (e * 211.3 + Math.sin(t * 0.7 + e) * 30) % W, ey = H * (1.05 - k * 1.1);
          x.fillStyle = 'rgba(255,' + (140 + e % 3 * 40) + ',60,' + (0.8 * (1 - k)) + ')'; x.fillRect(ex, ey, 2, 2);
        }
        x.restore();
        x.fillStyle = 'rgba(120,110,110,0.45)';
        for (var a = 0; a < 50; a++) { var ax = (a * 97.3 + t * (6 + a % 4 * 3) + Math.sin(t * 0.5 + a) * 14) % W, ay = (a * 61.7 + t * (14 + a % 5 * 4)) % H; x.fillRect(ax, ay, 1.6, 1.6); }
      },
    },
    tower: {
      sky: function (x, sc, cam, W, H, t) {
        // Lightning: a flash and a forked bolt every 5-9 s, now and then into the tower's rod
        var cyc = 7, k = t % cyc, rr = seeded(Math.floor(t / cyc));
        var at = 0.5 + rr() * 4, dur = 0.22;
        if (k < at || k > at + dur) return;
        var p = (k - at) / dur, flash = (1 - p) * (window.DCScenery.calmFlashes ? 0.08 : 0.28);
        x.fillStyle = 'rgba(200,210,255,' + flash + ')'; x.fillRect(0, 0, W, H);
        var toRod = rr() < 0.5 && sc.land && sc.land.rod, end = toRod ? screenPos(sc, 0.2, cam, W, H, sc.land.rod[0], sc.land.rod[1]) : [W * (0.15 + rr() * 0.7), H * (0.45 + rr() * 0.2)];
        var sx = end[0] + (rr() - 0.5) * W * 0.2, pts = [[sx, 0]];
        for (var i = 1; i <= 10; i++) pts.push([sx + (end[0] - sx) * i / 10 + (i < 10 ? (rr() - 0.5) * 50 : 0), end[1] * i / 10]);
        x.save(); x.globalCompositeOperation = 'lighter'; x.lineJoin = 'round';
        [[8, 'rgba(160,170,255,' + 0.35 * (1 - p) + ')'], [2.5, 'rgba(240,245,255,' + (1 - p) + ')']].forEach(function (L) {
          x.lineWidth = L[0]; x.strokeStyle = L[1]; x.beginPath(); pts.forEach(function (q, j) { x[j ? 'lineTo' : 'moveTo'](q[0], q[1]); }); x.stroke();
        });
        x.restore();
      },
      near: function (x, sc, cam, W, H, t) { rain(x, W, H, t, 90, 0.25); },
    },
    pagoda: {
      mid: function (x, sc, cam, W, H, t) {
        x.save(); x.globalCompositeOperation = 'lighter';
        (sc.land.lanterns || []).forEach(function (q, i) {
          var p = screenPos(sc, 0.2, cam, W, H, q[0], q[1]), z = p[2], a = 0.45 + 0.15 * Math.sin(t * 3 + i * 1.7);
          var g = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], 16 * z); g.addColorStop(0, 'rgba(255,200,120,' + a + ')'); g.addColorStop(1, 'rgba(255,140,60,0)');
          x.fillStyle = g; x.fillRect(p[0] - 16 * z, p[1] - 16 * z, 32 * z, 32 * z);
        });
        x.restore();
      },
      near: function (x, sc, cam, W, H, t) { petals(x, W, H, t, 40, 0.8); },
    },
    colosseum: {
      mid: function (x, sc, cam, W, H, t) {
        // The crowd: rows of heads bobbing, jumping up when someone is knocked out
        var cheer = Math.max(0, (window.DCScenery.cheerUntil || 0) - t);
        sc.land.stands.forEach(function (row, ri) {
          var p0 = screenPos(sc, 0.2, cam, W, H, 0, row.y), z = p0[2], step = 9 * z;
          for (var hx = 0, i = 0; hx < W; hx += step, i++) {
            var u = hx / W, yy = p0[1] + row.curve * z * (1 - 4 * u * (1 - u) * 2) * 0.5 - 3 * z;
            var bob = Math.sin(t * (3 + i % 3) + i * 1.3) * 1.2 * z * (1 + Math.min(1, cheer) * 3) - (cheer > 0 && (i + ri) % 3 === 0 ? Math.abs(Math.sin(t * 9 + i)) * 6 * z : 0);
            var shade = 40 + (i * 37 % 60);
            x.fillStyle = 'rgb(' + (shade + 30) + ',' + (shade + 10) + ',' + shade + ')';
            x.beginPath(); x.arc(hx + (i % 2) * 3 * z, yy + bob, 3.4 * z, 0, TAU); x.fill();
            if ((i * 7 + ri) % 11 === 0) { x.fillStyle = ['#d8361c', '#5fb8ff', '#ffe14a', '#2fd3c8'][i % 4]; x.fillRect(hx, yy + bob - 10 * z, 2 * z, 7 * z); }
          }
        });
      },
      near: function (x, sc, cam, W, H, t) {
        x.fillStyle = 'rgba(255,230,180,0.35)';
        for (var m = 0; m < 30; m++) { var mx = (m * 151.3 + Math.sin(t * 0.3 + m) * 40 + t * 5) % W, my = (m * 71.9 + Math.cos(t * 0.4 + m) * 30) % (H * 0.8); x.fillRect(mx, my, 1.5, 1.5); }
      },
    },
    geode: {
      mid: function (x, sc, cam, W, H, t) {
        x.save(); x.globalCompositeOperation = 'lighter';
        // A shaft of daylight through the hole in the roof
        var hp = screenPos(sc, 0.2, cam, W, H, sc.land.hole[0], sc.land.hole[1]);
        var bg = x.createLinearGradient(hp[0], hp[1], hp[0] + W * 0.12, H);
        bg.addColorStop(0, 'rgba(200,230,255,0.22)'); bg.addColorStop(1, 'rgba(200,230,255,0)');
        x.fillStyle = bg; x.beginPath(); x.moveTo(hp[0] - 30, hp[1]); x.lineTo(hp[0] + 40, hp[1]); x.lineTo(hp[0] + W * 0.2, H); x.lineTo(hp[0] + W * 0.02, H); x.fill();
        // Crystals breathe light
        sc.land.crystals.forEach(function (c, i) {
          var p = screenPos(sc, 0.2, cam, W, H, c[0], c[1]), z = p[2], a = 0.18 + 0.14 * Math.sin(t * 1.3 + i * 2.1), R = c[3] * 2 * z;
          var g = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], R); g.addColorStop(0, Art2(c[2], a)); g.addColorStop(1, Art2(c[2], 0));
          x.fillStyle = g; x.fillRect(p[0] - R, p[1] - R, R * 2, R * 2);
        });
        x.restore();
      },
      near: function (x, sc, cam, W, H, t) {
        x.save(); x.globalCompositeOperation = 'lighter';
        for (var m = 0; m < 40; m++) {
          var mx = (m * 173.3 + Math.sin(t * 0.4 + m) * 30) % W, my = (H - ((t * (8 + m % 5 * 3) + m * 97) % H)), a = 0.4 + 0.4 * Math.sin(t * 2 + m);
          x.fillStyle = m % 3 ? 'rgba(150,240,255,' + a + ')' : 'rgba(220,160,255,' + a + ')'; x.fillRect(mx, my, 2, 2);
        }
        x.restore();
        // A drip now and then from the roof
        var dc = t % 3.1, dx = W * (0.2 + seeded(Math.floor(t / 3.1))() * 0.6);
        if (dc < 0.8) { x.fillStyle = 'rgba(180,220,255,0.7)'; x.fillRect(dx, H * 0.1 + dc * dc * H * 1.2, 1.5, 6); }
      },
    },
    temple: {
      sky: function (x, sc, cam, W, H, t) {
        // God rays from the surface, swaying
        x.save(); x.globalCompositeOperation = 'lighter';
        for (var r = 0; r < 7; r++) {
          var rx = W * (0.08 + r * 0.14) + Math.sin(t * 0.3 + r) * 30 - (cam.x - 800) * 0.05, a = 0.05 + 0.03 * Math.sin(t * 0.7 + r * 1.9);
          var g = x.createLinearGradient(rx, 0, rx + W * 0.1, H * 0.9); g.addColorStop(0, 'rgba(180,255,250,' + a + ')'); g.addColorStop(1, 'rgba(180,255,250,0)');
          x.fillStyle = g; x.beginPath(); x.moveTo(rx, 0); x.lineTo(rx + 50 + r * 6, 0); x.lineTo(rx + W * 0.16, H * 0.9); x.lineTo(rx + W * 0.08, H * 0.9); x.fill();
        }
        // Caustic shimmer near the surface
        for (var c = 0; c < 26; c++) {
          var cx = (c * 97.7 + Math.sin(t * 0.8 + c) * 40) % W, cy = H * 0.04 + (c * 37 % 80) + Math.sin(t * 1.3 + c * 2) * 8;
          x.strokeStyle = 'rgba(200,255,255,' + (0.06 + 0.05 * Math.sin(t * 2 + c)) + ')'; x.lineWidth = 2;
          x.beginPath(); x.ellipse(cx, cy, 30 + c % 4 * 10, 6, Math.sin(t * 0.5 + c) * 0.3, 0, TAU); x.stroke();
        }
        x.restore();
      },
      mid: function (x, sc, cam, W, H, t) {
        // Kelp swaying in the current, and a school of fish crossing now and then
        var p0 = screenPos(sc, 0.25, cam, W, H, 0, sc.h * 0.82), z = p0[2];
        for (var k = 0; k < 22; k++) {
          var kx = (k * 97.3 + 20) % W, kh = (90 + (k * 53 % 140)) * z, sw = Math.sin(t * 0.9 + k * 1.3) * 18 * z;
          x.strokeStyle = k % 2 ? 'rgba(30,90,60,0.85)' : 'rgba(50,120,70,0.8)'; x.lineWidth = (3 + k % 3) * z;
          x.beginPath(); x.moveTo(kx, p0[1] + 20 * z); x.bezierCurveTo(kx + sw * 0.3, p0[1] - kh * 0.3, kx - sw * 0.5, p0[1] - kh * 0.7, kx + sw, p0[1] - kh); x.stroke();
        }
        var fc = t % 22;
        if (fc < 10) {
          var fx0 = -100 + fc / 10 * (W + 200), fy0 = H * 0.32 + Math.sin(fc) * 20;
          x.fillStyle = 'rgba(20,60,80,0.75)';
          for (var f = 0; f < 14; f++) {
            var fx = fx0 - (f % 5) * 22 - Math.floor(f / 5) * 10, fy = fy0 + Math.floor(f / 5) * 14 + Math.sin(t * 6 + f) * 3;
            x.beginPath(); x.ellipse(fx, fy, 7, 3, 0, 0, TAU); x.fill();
            x.beginPath(); x.moveTo(fx - 6, fy); x.lineTo(fx - 11, fy - 3); x.lineTo(fx - 11, fy + 3); x.fill();
          }
        }
      },
      near: function (x, sc, cam, W, H, t) {
        x.strokeStyle = 'rgba(220,255,255,0.45)'; x.lineWidth = 1;
        for (var b = 0; b < 30; b++) {
          var k = ((t * (0.06 + (b % 5) * 0.015) + b * 0.173) % 1), bx = (b * 131.7 + Math.sin(t * 2 + b) * 8) % W, by = H * (1.05 - k * 1.1);
          x.beginPath(); x.arc(bx, by, 1.5 + (b % 3), 0, TAU); x.stroke();
        }
      },
    },
  };
  function Art2(hexc, a) { return rgba(hex(hexc), a); }

  /** Rain streaks in screen space. */
  function rain(x, W, H, t, n, a) {
    x.strokeStyle = 'rgba(190,200,240,' + a + ')'; x.lineWidth = 1;
    x.beginPath();
    for (var i = 0; i < n; i++) {
      var sp = 900 + (i % 5) * 120, rx = (i * 97.13 + t * 260) % (W + 200) - 100, ry = ((i * 53.7 + t * sp) % (H + 60)) - 30;
      x.moveTo(rx, ry); x.lineTo(rx - 7, ry + 22);
    }
    x.stroke();
  }

  /** Cherry petals tumbling on the breeze. */
  function petals(x, W, H, t, n, a) {
    for (var i = 0; i < n; i++) {
      var k = (t * (0.03 + (i % 6) * 0.008) + i * 0.217) % 1, px = ((i * 151.7 + t * (18 + i % 4 * 6)) % (W + 40)) - 20 + Math.sin(t * 1.2 + i) * 20, py = k * (H + 40) - 20;
      x.save(); x.translate(px, py); x.rotate(t * (1 + i % 3) + i); x.scale(1, Math.abs(Math.sin(t * 2 + i)) * 0.8 + 0.2);
      x.fillStyle = 'rgba(255,' + (180 + i % 3 * 20) + ',' + (200 + i % 2 * 25) + ',' + a + ')';
      x.beginPath(); x.ellipse(0, 0, 4, 2.4, 0, 0, TAU); x.fill(); x.restore();
    }
  }

  // Soft, feathered god rays from the sun, slowly breathing
  function shafts(x, W, H, t, ux, uy, rgb) {
    x.save(); x.globalCompositeOperation = 'lighter';
    var sx = W * (ux != null ? ux : 0.74), sy = H * (uy != null ? uy : 0.62), col = rgb || '255,200,140';
    for (var s = 0; s < 6; s++) {
      var base = ux == null ? -2.35 : Math.atan2(H * 0.65 - sy, W * 0.5 - sx) - 0.33;   // the dusk sun fans up; a high sun shines down across the arena
      var ang = base + s * 0.13 + Math.sin(t * 0.07 + s) * 0.02, len = H * 1.3, wid = W * (0.04 + (s % 3) * 0.02);
      var a = 0.022 + 0.014 * Math.sin(t * 0.3 + s * 1.9);
      x.save(); x.translate(sx, sy); x.rotate(ang);
      var g = x.createLinearGradient(0, -wid, 0, wid);
      g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(0.5, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
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
      if (p.wall) {
        // Torches on the wall tops
        x.save(); x.globalCompositeOperation = 'lighter';
        var tx = p.x + p.w / 2, ty = p.y - 4, fl = 1 + 0.15 * Math.sin(t * 17 + i) + 0.1 * Math.sin(t * 29 + i * 3);
        var tg = x.createRadialGradient(tx, ty - 10, 0, tx, ty - 10, 60 * fl); tg.addColorStop(0, 'rgba(255,190,90,0.45)'); tg.addColorStop(1, 'rgba(255,120,40,0)');
        x.fillStyle = tg; x.fillRect(tx - 60, ty - 70, 120, 120);
        for (var fk = 0; fk < 3; fk++) { x.fillStyle = ['rgba(255,90,30,0.9)', 'rgba(255,170,40,0.9)', 'rgba(255,240,160,0.95)'][fk]; x.beginPath(); x.ellipse(tx + Math.sin(t * 13 + fk) * 2, ty - 10 - fk * 3, (9 - fk * 2.5) * fl, (18 - fk * 4) * fl, 0, 0, TAU); x.fill(); }
        x.restore();
        x.fillStyle = 'rgba(' + (th.edge || '255,236,190') + ',0.8)'; x.fillRect(p.x, p.y - 1, p.w, 2);
        return;
      }
      // Walkable surface highlight and ledge markers
      x.fillStyle = th.edge ? 'rgba(' + th.edge + ',0.85)' : theme === 'night' ? 'rgba(240,250,255,0.85)' : theme === 'grid' ? 'rgba(200,215,255,0.8)' : 'rgba(255,236,190,0.8)';
      x.fillRect(p.x, p.y - 1, p.w, 2);
      if (p.solid && !p.altar && !(arena.platforms.some(function (q) { return q.wall; }) && i === 0)) {
        var lg = th.edge || (theme === 'night' ? '180,235,255' : '255,210,140');
        [p.x, p.x + p.w].forEach(function (lx) {
          var g = x.createRadialGradient(lx, p.y, 0, lx, p.y, 10); g.addColorStop(0, 'rgba(' + lg + ',0.28)'); g.addColorStop(1, 'rgba(' + lg + ',0)');
          x.fillStyle = g; x.beginPath(); x.arc(lx, p.y, 16, 0, TAU); x.fill();
        });
      }
      if (theme === 'grid' && p.solid) {
        x.fillStyle = 'rgba(200,220,255,0.35)'; x.font = '11px system-ui';
        for (var m = 0; m <= p.w; m += 100) { x.fillRect(p.x + m, p.y + 6, 1, 10); x.fillText(String(m), p.x + m + 3, p.y + 18); }
      }
      // Fireflies (dusk), ice glints (night), embers, petals, motes or bubbles around soft platforms
      if (!p.solid && theme !== 'grid') {
        var mote = th.mote || (theme === 'night' ? '200,240,255' : '255,230,120');
        for (var f = 0; f < 3; f++) {
          var a = t * 0.8 + f * 2.1 + i, fx = p.x + p.w * (0.2 + 0.3 * f) + Math.sin(a) * 18, fy = p.y + 30 + Math.cos(a * 1.3) * 10;
          var g2 = x.createRadialGradient(fx, fy, 0, fx, fy, 6); g2.addColorStop(0, 'rgba(' + mote + ',0.5)'); g2.addColorStop(1, 'rgba(' + mote + ',0)');
          x.fillStyle = g2; x.fillRect(fx - 7, fy - 7, 14, 14);
        }
      }
    });
  }

  /** Out-of-focus framing in the lower corners: depth without covering the fight. */
  var fgCache = {};
  function foreground(x, arena, cam, W, H, t) {
    if (arena.theme === 'grid') return;
    var th = THEMES[arena.theme] || THEMES.dusk;
    if (th.landmark) {
      fgShapes(x, arena, th, cam, W, H, t);
      if (arena.theme === 'storm') rain(x, W, H, t + 3.7, 70, 0.4);
      if (arena.theme === 'blossom') petals(x, W, H, t + 11, 14, 0.95);
      if (th.underwater) { var uw = x.createLinearGradient(0, 0, 0, H); uw.addColorStop(0, 'rgba(120,230,240,0.06)'); uw.addColorStop(1, 'rgba(0,30,60,0.18)'); x.fillStyle = uw; x.fillRect(0, 0, W, H); }
      return;
    }
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

  /** Out-of-focus framing for the newer arenas: rocks, branches, a balustrade, stalactites or kelp. */
  function fgShapes(x, arena, th, cam, W, H, t) {
    var key = arena.theme + W + 'x' + H, fg = fgCache[key];
    if (!fg) {
      fg = canvas(W, H); var c = fg.getContext('2d'), n = Noise(78), r = rnd(5);
      c.filter = 'blur(6px)'; c.fillStyle = th.fgCol; c.strokeStyle = th.fgCol;
      var kind = th.fg;
      [[0, 1], [W, -1]].forEach(function (s) {
        if (kind === 'rocks' || kind === 'stalactites') {
          c.beginPath(); c.moveTo(s[0], H);
          for (var i = 0; i <= 10; i++) { var u = i / 10; c.lineTo(s[0] + s[1] * u * W * 0.2, H - H * (0.16 - u * 0.14) - (i % 2 ? 1 : -1) * n.fbm(u * 6 + s[0], 2, 3) * H * 0.07); }
          c.lineTo(s[0] + s[1] * W * 0.22, H); c.fill();
        }
        if (kind === 'stalactites') {
          c.beginPath(); c.moveTo(s[0], 0);
          for (var j = 0; j <= 12; j++) { var u2 = j / 12, xx = s[0] + s[1] * u2 * W * 0.3; c.lineTo(xx, H * 0.05 * (1 - u2)); if (j % 2) { c.lineTo(xx + s[1] * 6, H * (0.06 + r() * 0.12) * (1 - u2 * 0.7)); c.lineTo(xx + s[1] * 12, H * 0.04 * (1 - u2)); } }
          c.lineTo(s[0] + s[1] * W * 0.3, 0); c.fill();
        }
        if (kind === 'branches') {
          c.lineWidth = 6;
          for (var b = 0; b < 4; b++) { var bx = s[0] + s[1] * (10 + b * 26); c.beginPath(); c.moveTo(bx - s[1] * 40, -10); c.quadraticCurveTo(bx + s[1] * 60, H * (0.08 + b * 0.03), bx + s[1] * (130 + b * 30), H * (0.12 + b * 0.02)); c.stroke(); }
          for (var bl = 0; bl < 26; bl++) { c.fillStyle = 'rgba(255,170,200,0.75)'; c.beginPath(); c.arc(s[0] + s[1] * (20 + r() * 200), H * (0.02 + r() * 0.16), 6 + r() * 12, 0, TAU); c.fill(); }
          c.fillStyle = th.fgCol;
        }
        if (kind === 'railing') {
          // Spectators' heads and raised arms leaning over the near rail, out of focus
          c.fillRect(s[1] > 0 ? 0 : W - W * 0.2, H * 0.95, W * 0.2, H * 0.05);
          for (var pz = 0; pz < 9; pz++) {
            var pxx = s[0] + s[1] * (12 + pz * 26 + (pz % 2) * 6), py = H * (0.93 - (pz % 3) * 0.012 - Math.max(0, 4 - pz) * 0.01);
            c.beginPath(); c.arc(pxx, py, 13, 0, TAU); c.fill(); c.fillRect(pxx - 15, py + 8, 30, H);
            if (pz % 3 === 1) { c.lineWidth = 7; c.beginPath(); c.moveTo(pxx + 10, py + 6); c.lineTo(pxx + 18, py - 30); c.stroke(); }
          }
        }
        if (kind === 'kelp') {
          c.lineWidth = 10; c.lineCap = 'round';
          for (var k = 0; k < 5; k++) { var kx = s[0] + s[1] * (18 + k * 30); c.beginPath(); c.moveTo(kx, H + 10); c.bezierCurveTo(kx + s[1] * 30, H * 0.85, kx - s[1] * 20, H * 0.75, kx + s[1] * (40 + k * 6), H * (0.62 + k * 0.03)); c.stroke(); }
        }
      });
      c.filter = 'none';
      fgCache[key] = fg;
    }
    var sway = Math.sin(t * (th.fg === 'kelp' ? 0.9 : 0.6)) * (th.fg === 'kelp' ? 6 : 3);
    x.drawImage(fg, -(cam.x - 800) * 0.08 + sway, -(cam.y - 450) * 0.04, W, H);
  }

  /** Paint an arena ahead of time (so the first frame of a match doesn't stall). */
  function prepare(arena, W, H) {
    scene(arena.theme, W, H);
    var th = THEMES[arena.theme] || THEMES.dusk;
    arena.platforms.forEach(function (p, i) { platformSprite(p, th, arena.theme, i); });
  }

  // cheerUntil: the Colosseum crowd jumps until this time. calmFlashes: softer storm lightning (reduce flashing setting).
  window.DCScenery = { _scene: scene, backdrop: backdrop, platforms: platforms, foreground: foreground, prepare: prepare, THEMES: THEMES, cheerUntil: 0, calmFlashes: false };
})();
