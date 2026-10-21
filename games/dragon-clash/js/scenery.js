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
    // 2D ridged multifractal: sharp crests whose detail is weighted by the octave before (Musgrave)
    function ridged2(x, y, oct) {
      var sum = 0, amp = 0.5, f = 1, norm = 0, wgt = 1;
      for (var o = 0; o < (oct || 5); o++) {
        var n = 1 - Math.abs(v2(x * f + o * 31.7, y * f) * 2 - 1); n *= n; n *= wgt;
        wgt = n * 1.8; if (wgt > 1) wgt = 1;
        sum += amp * n; norm += amp; amp *= 0.5; f *= 2.07;
      }
      return sum / norm;
    }
    return { v2: v2, fbm: fbm, ridged: ridged, ridged2: ridged2 };
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
    // ── The arenas: painted by the heightmap painter (v2). L is the one key-light direction (toward the light, y down);
    //    key / amb / rimCol are linear light colours. mat holds albedo ramps [dark, base, light]; far are the ranges baked into the sky.
    volcano: {
      v2: true,
      sky: [[0, '#070505'], [0.28, '#120a09'], [0.5, '#24120e'], [0.7, '#3e1d13'], [0.86, '#5a2a16'], [1, '#6e3418']],
      glows: [[0.62, 0.32, 0.3, '255,120,50', 0.16, 1.5], [0.5, 1.05, 0.55, '255,90,30', 0.22, 2.6]], skyNoise: 12,
      cloudLit: '#8a4a32', cloudMid: '#2e1814', cloudShadow: '#0b0606', cloudTh: 0.55,
      haze: '#3e2620', fogA: 0.12, mist: '150,80,60',
      L: [0.6, -0.42, 0.58], key: [0.92, 0.58, 0.36], amb: [0.15, 0.11, 0.11], rimCol: [1.0, 0.5, 0.25],
      mat: { rock: { dark: '#0c0909', base: '#2e2725', light: '#5e534e' }, bone: { dark: '#221c18', base: '#6e6458', light: '#ad9f8a' } },
      far: [{ top: 0.7, amp: 0.25, freq: 3.4, seed: 17, warp: 1.6, lo: 0.2, hi: 0.95, sharp: 1.4, massifs: [[0.2, 0.08, 0.05], [0.88, 0.06, 0.04]],
        mat: { dark: '#0c0909', base: '#2a2422', light: '#544a46', scale: 0.008, stretch: 0.4, ridged: true, warp: 1.2, bump: 0.8, form: 40, round: 0.8, rim: 6,
          cap: { col: '#5a5450', amt: 0.4, lo: 0.3, hi: 0.7, s: 0.02, noise: 1 } }, hz: [0.55, 0.85, 0.4, 0.75] }],
      ranges: [], forest: null, rock: { base: '#3a2c2c', dark: '#120808', light: '#8a5a4a', strata: '#5a3a32' }, cap: 'basalt',
      landmark: 'volcano', edge: '235,190,150', mote: '255,140,60', fg: 'rocks', fgRock: '#1c1412', fgRock2: '#3a2a24', vignette: 'rgba(24,6,2,0.5)',
      grade: { desat: 0.12, tint: '#a08a80', dark: 0.24, grain: 0.07 },
    },
    storm: {
      v2: true,
      sky: [[0, '#05070b'], [0.3, '#0c1118'], [0.55, '#161d27'], [0.75, '#212a35'], [1, '#2c3641']],
      glows: [[0.27, 0.15, 0.42, '130,150,180', 0.22, 1.8]], skyNoise: 10,
      cloudLit: '#68727f', cloudMid: '#262c36', cloudShadow: '#090b10', cloudTh: 0.5,
      haze: '#2c3540', fogA: 0.14, mist: '120,135,155',
      L: [-0.62, -0.58, 0.52], key: [0.64, 0.7, 0.82], amb: [0.19, 0.22, 0.28], rimCol: [0.48, 0.56, 0.7],
      mat: { rock: { dark: '#121418', base: '#3a3e46', light: '#767c86' }, stone: { dark: '#1a1d22', base: '#474c56', light: '#8a909c' },
        bronze: { dark: '#24160b', base: '#62432a', light: '#b08550' }, iron: { dark: '#0c0c0e', base: '#26262a', light: '#55555c' } },
      far: [{ top: 0.7, amp: 0.3, freq: 3.1, seed: 23, warp: 1.6, lo: 0.2, hi: 0.95, sharp: 1.5, massifs: [[0.4, 0.07, 0.07], [0.64, 0.05, 0.04]],
        mat: { dark: '#14171c', base: '#323843', light: '#68707c', scale: 0.008, stretch: 0.4, ridged: true, warp: 1.2, bump: 0.8, form: 40, round: 0.8, rim: 8,
          cap: { col: '#aab4c0', amt: 0.6, lo: 0.2, hi: 0.55, s: 0.02, noise: 1, y0: 0.47, y1: 0.62 } }, hz: [0.5, 0.82, 0.4, 0.72] }],
      ranges: [], forest: null, rock: { base: '#4a4a5a', dark: '#16161e', light: '#9a9ab8', strata: '#5a5a70' }, cap: 'wet',
      landmark: 'tower', edge: '200,214,235', mote: '170,190,230', fg: 'rocks', fgRock: '#16181c', fgRock2: '#2c3036', vignette: 'rgba(4,6,12,0.5)',
      grade: { desat: 0.16, tint: '#8e98a6', dark: 0.24, grain: 0.07 },
    },
    blossom: {
      v2: true,
      sky: [[0, '#28323f'], [0.35, '#536373'], [0.62, '#8a8f92'], [0.82, '#bcae9c'], [1, '#cbbaa2']],
      sun: { x: 0.2, y: 0.3, r: 0.03, col: '#fff3d6', glow: '#e9c18a' }, glows: [[0.2, 0.3, 0.42, '255,228,190', 0.4, 1.5]], skyNoise: 6,
      cloudLit: '#eadfd2', cloudMid: '#9c9aa0', cloudShadow: '#55586a', cloudTh: 0.55,
      haze: '#9a9e9e', fogA: 0.12, mist: '220,214,206',
      L: [-0.62, -0.46, 0.64], key: [0.95, 0.86, 0.74], amb: [0.34, 0.36, 0.4], rimCol: [1, 0.9, 0.78],
      mat: { rock: { dark: '#20231d', base: '#55584d', light: '#949282' }, stone: { dark: '#2c2c28', base: '#727066', light: '#b0aa98' } },
      far: [{ top: 0.78, amp: 0.42, freq: 6.5, seed: 31, warp: 0.8, lo: 0.4, hi: 0.95, sharp: 2.6,
        mat: { dark: '#2a3030', base: '#55605e', light: '#8a948e', scale: 0.012, stretch: 0.3, ridged: true, warp: 1, bump: 0.7, form: 30, round: 1, rim: 6,
          cap: { col: '#6a7a62', amt: 0.5, lo: 0.3, hi: 0.7, s: 0.03, noise: 1 } }, hz: [0.6, 0.85, 0.3, 0.8] }],
      ranges: [], forest: { line: 0.86, col: '#3a4440', rim: '#f0d8c8', fog: '#c8c4bc', round: true },
      rock: { base: '#8a8070', dark: '#3a3428', light: '#e8dcc0', strata: '#a89880' }, cap: 'blossom',
      landmark: 'pagoda', edge: '240,226,200', mote: '220,170,160', fg: 'branches', fgRock: '#1e201c', fgRock2: '#3a3c34', vignette: 'rgba(20,16,24,0.3)',
      grade: { desat: 0.18, tint: '#a8a29c', dark: 0.2, grain: 0.05 },
    },
    arena: {
      v2: true,
      sky: [[0, '#141a24'], [0.38, '#353d4a'], [0.66, '#6e5e52'], [0.85, '#a27c5a'], [1, '#b68c64']],
      sun: { x: 0.84, y: 0.3, r: 0.035, col: '#fff0d0', glow: '#ffb060' }, glows: [[0.84, 0.3, 0.36, '255,198,140', 0.42, 1.5]], skyNoise: 8,
      cloudLit: '#d8a878', cloudMid: '#6a5450', cloudShadow: '#261c22', cloudTh: 0.56,
      haze: '#7a6250', fogA: 0.1, mist: '200,170,140',
      L: [0.62, -0.42, 0.6], key: [1.0, 0.82, 0.6], amb: [0.25, 0.23, 0.26], rimCol: [1, 0.78, 0.5],
      mat: { stone: { dark: '#2a1f16', base: '#7e664c', light: '#c0a27c' }, bronze: { dark: '#1e140a', base: '#584024', light: '#a07a46' }, rock: { dark: '#24180f', base: '#5a4430', light: '#9a7c58' } },
      far: [{ top: 0.6, amp: 0.12, freq: 2.6, seed: 41, warp: 1.2, lo: 0.2, hi: 0.95, sharp: 1.2,
        mat: { dark: '#3a2c26', base: '#6a5448', light: '#9a8270', scale: 0.008, stretch: 0.5, ridged: true, warp: 1, bump: 0.6, form: 40, round: 0.8, rim: 6 }, hz: [0.6, 0.8, 0.45, 0.62] }],
      ranges: [], forest: null, rock: { base: '#b08a5a', dark: '#4a3420', light: '#f0d8a8', strata: '#c8a070' }, cap: 'sand',
      landmark: 'colosseum', edge: '250,228,190', mote: '255,220,150', fg: 'railing', fgRock: '#1c140e', fgRock2: '#3a2a1e', vignette: 'rgba(26,12,4,0.38)',
      grade: { desat: 0.16, tint: '#a8968a', dark: 0.2, grain: 0.06 },
    },
    crystal: {
      v2: true, cave: true, clouds: false,
      sky: [[0, '#030507'], [0.4, '#061016'], [0.75, '#0a1a20'], [1, '#0e2229']],
      glows: [[0.34, 0.0, 0.75, '110,180,190', 0.2, 0.6], [0.55, 0.75, 0.5, '30,100,110', 0.14, 2]], skyNoise: 10,
      haze: '#123038', fogA: 0.14, mist: '90,160,170',
      L: [-0.3, -0.8, 0.5], key: [0.5, 0.68, 0.74], amb: [0.1, 0.15, 0.18], rimCol: [0.4, 0.75, 0.8],
      mat: { rock: { dark: '#06090b', base: '#1d282e', light: '#465a62' }, bone: { dark: '#1c2224', base: '#646e6a', light: '#a0aca6' } },
      far: [{ top: 0.9, amp: 0.36, freq: 5.5, seed: 43, warp: 1.4, lo: 0.3, hi: 0.95, sharp: 2,
        mat: { dark: '#05080a', base: '#16242a', light: '#34484e', scale: 0.012, stretch: 0.35, ridged: true, warp: 1, bump: 0.7, form: 30, round: 1, rim: 6,
          cap: { col: '#7f9ea8', amt: 0.4, lo: 0.4, hi: 0.8, s: 0.03 } }, hz: [0.55, 0.75, 0.4, 0.9] }],
      ranges: [], forest: null, rock: { base: '#3a3050', dark: '#100c1c', light: '#8a7ab0', strata: '#4a3a68' }, cap: 'crystal',
      landmark: 'geode', edge: '200,236,240', mote: '150,230,235', fg: 'stalactites', fgRock: '#0e1316', fgRock2: '#22303a', vignette: 'rgba(0,6,10,0.55)',
      grade: { desat: 0.12, tint: '#8a9aa0', dark: 0.24, grain: 0.07 },
    },
    reef: {
      v2: true, clouds: false, underwater: true,
      sky: [[0, '#2c7078'], [0.15, '#1a5260'], [0.45, '#0e3442'], [0.75, '#092430'], [1, '#061a22']],
      glows: [[0.4, 0.0, 0.6, '150,225,215', 0.25, 2.5]], skyNoise: 8,
      haze: '#0e3844', fogA: 0.14, mist: '110,190,190',
      L: [-0.25, -0.85, 0.48], key: [0.55, 0.8, 0.78], amb: [0.1, 0.19, 0.21], rimCol: [0.5, 0.85, 0.8],
      mat: { rock: { dark: '#07131a', base: '#203c46', light: '#4a6e76' }, stone: { dark: '#122426', base: '#4a6664', light: '#8aa69e' }, sand: { dark: '#16262a', base: '#465a56', light: '#84968a' } },
      far: [{ top: 0.72, amp: 0.2, freq: 2.8, seed: 53, warp: 1.4, lo: 0.25, hi: 0.95, sharp: 1.6,
        mat: { dark: '#08161c', base: '#1a3a44', light: '#3a5e66', scale: 0.01, stretch: 0.6, ridged: true, warp: 1, bump: 0.7, form: 30, round: 1, rim: 6 }, hz: [0.6, 0.8, 0.4, 0.75] }],
      ranges: [], forest: null, rock: { base: '#6a8a8a', dark: '#1a3238', light: '#b8e0d8', strata: '#7aa0a0' }, cap: 'coral',
      landmark: 'temple', edge: '200,240,232', mote: '200,250,255', fg: 'kelp', fgRock: '#0a1a1e', fgRock2: '#1c3238', vignette: 'rgba(0,12,20,0.5)',
      grade: { desat: 0.12, tint: '#8aa4a4', dark: 0.22, grain: 0.06 },
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

  /** Rock-textured fill of whatever is already drawn on c (keeps alpha). Used by the legacy themes. */
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

  // ═══════════════ the arena painter: heightmap-lit rock, layered atmosphere, one dragon landmark per theme ═══════════════
  // Every arena is built from silhouettes (paths in scene units) that are then lit as heightfields: a domain-warped
  // fractal gives the surface relief, a blurred copy of the silhouette gives the large rounded form, and one key light
  // per arena (plus ambient sky, rim and an optional emissive glow) shades it. Strata, rain streaks, mineral stains,
  // crevice occlusion and snow / moss / ash caps are applied in the same pass. Heavy layers are painted below screen
  // resolution and drawn scaled (they sit in haze anyway); the platforms are painted at 2x world resolution.
  function f01(h) { var c = hex(h); return [c[0] / 255, c[1] / 255, c[2] / 255]; }
  function blurPass(src, dst, w, h, r, horiz) {
    var inv = 1 / (2 * r + 1), i, j, acc, a, b, row;
    if (horiz) {
      for (j = 0; j < h; j++) {
        row = j * w; acc = 0;
        for (i = -r; i <= r; i++) acc += src[row + (i < 0 ? 0 : i >= w ? w - 1 : i)];
        for (i = 0; i < w; i++) { dst[row + i] = acc * inv; a = i + r + 1; b = i - r; acc += src[row + (a >= w ? w - 1 : a)] - src[row + (b < 0 ? 0 : b)]; }
      }
    } else {
      for (i = 0; i < w; i++) {
        acc = 0;
        for (j = -r; j <= r; j++) acc += src[(j < 0 ? 0 : j >= h ? h - 1 : j) * w + i];
        for (j = 0; j < h; j++) { dst[j * w + i] = acc * inv; a = j + r + 1; b = j - r; acc += src[(a >= h ? h - 1 : a) * w + i] - src[(b < 0 ? 0 : b) * w + i]; }
      }
    }
  }
  function boxBlur(arr, w, h, r) {
    r = Math.max(1, Math.round(r));
    var t = new Float32Array(arr.length);
    for (var it = 0; it < 2; it++) { blurPass(arr, t, w, h, r, true); blurPass(t, arr, w, h, r, false); }
    return arr;
  }
  function ext(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

  /**
   * Light the silhouette drawn on canvas c (alpha = coverage) as a heightmapped surface, in place.
   * Pixel (i, j) is scene point (M.ox + i*u, M.oy + j*u); radii and noise scales are in scene units.
   *   L key-light direction (toward the light; y down), key / amb / rimCol light colours (0..1+), dark/base/light albedo,
   *   scale, stretch (y), warp, ridged, oct, bump (relief), form + round (silhouette rounding), cav (crevice AO),
   *   strata {f, a, warp}, streak, stain [hex, amt], cap {col, amt, lo, hi, s, noise, depth, y0, y1}, spec {p, a},
   *   glow {c, fn(sx, sy, nx, ny)}, haze {col, fn(sx, sy)}, coord(sx, sy) -> [px, py] (custom noise coordinates).
   */
  function shadeMask(c, n, M) {
    var w = c.width, h = c.height, x = c.getContext('2d'), id = x.getImageData(0, 0, w, h), d = id.data;
    var u = M.unit || 1, ox = M.ox || 0, oy = M.oy || 0, i, j, k;
    var x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (j = 0; j < h; j++) for (i = 0; i < w; i++) if (d[(j * w + i) * 4 + 3] > 6) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    if (x1 < 0) return c;
    var form = Math.max(1, (M.form || 10) / u), pad = Math.ceil(form * 2) + 2;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    var bw = x1 - x0 + 1, bh = y1 - y0 + 1, N = bw * bh;
    var A = new Float32Array(N);
    for (j = 0; j < bh; j++) for (i = 0; i < bw; i++) A[j * bw + i] = d[((j + y0) * w + i + x0) * 4 + 3] / 255;
    var B = boxBlur(Float32Array.from(A), bw, bh, form / 2);
    var Hf = new Float32Array(N), s = M.scale || 0.02, st = M.stretch || 1, wp = M.warp || 0, oct = M.oct || 5, rid = M.ridged, cf = M.coord;
    for (j = 0; j < bh; j++) for (i = 0; i < bw; i++) {
      k = j * bw + i; if (B[k] < 0.002 && A[k] < 0.01) continue;
      var sx0 = ox + (i + x0) * u, sy0 = oy + (j + y0) * u, px, py;
      if (cf) { var cc = cf(sx0, sy0); px = cc[0]; py = cc[1]; } else { px = sx0 * s; py = sy0 * s * st; }
      if (wp) { var qx = n.fbm(px * 0.3 + 3.1, py * 0.3 + 7.7, 2), qy = n.fbm(px * 0.3 + 11.3, py * 0.3 + 1.9, 2); px += (qx - 0.5) * wp; py += (qy - 0.5) * wp; }
      Hf[k] = rid ? n.ridged2(px, py, oct) : n.fbm(px, py, oct);
    }
    var Hb = boxBlur(Float32Array.from(Hf), bw, bh, Math.max(1, (M.cavR || 5) / u));
    // Distance (scene units) to open air above, and toward the light (for rim light and caps)
    var L = M.L, ll = Math.sqrt(L[0] * L[0] + L[1] * L[1] + L[2] * L[2]), lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
    var hx = lx, hy = ly, hz = lz + 1, hl = Math.sqrt(hx * hx + hy * hy + hz * hz); hx /= hl; hy /= hl; hz /= hl;
    var dT = new Float32Array(N), dS = new Float32Array(N), run;
    for (i = 0; i < bw; i++) { run = 0; for (j = 0; j < bh; j++) { k = j * bw + i; run = A[k] < 0.5 ? 0 : run + u; dT[k] = run; } }
    for (j = 0; j < bh; j++) {
      run = 0;
      if (lx <= 0) for (i = 0; i < bw; i++) { k = j * bw + i; run = A[k] < 0.5 ? 0 : run + u; dS[k] = run; }
      else for (i = bw - 1; i >= 0; i--) { k = j * bw + i; run = A[k] < 0.5 ? 0 : run + u; dS[k] = run; }
    }
    var dark = f01(M.dark), base = f01(M.base), lite = f01(M.light);
    var key = M.key, amb = M.amb, rimC = M.rimCol || key, rimW = M.rim || 0;
    var cap = M.cap, capC = cap ? f01(cap.col) : null, haze = M.haze ? f01(M.haze.col) : null, hfn = M.haze ? M.haze.fn : null;
    var stain = M.stain ? f01(M.stain[0]) : null, stainA = M.stain ? M.stain[1] : 0, glow = M.glow, spec = M.spec;
    var bump = (M.bump == null ? 1 : M.bump) / (2 * u * s * (cf ? 1 : 1)), round = (M.round == null ? 1 : M.round) * form, cavK = M.cav == null ? 4 : M.cav;
    if (cf) bump = (M.bump == null ? 1 : M.bump) * 0.5 / u;
    var strata = M.strata, streak = M.streak || 0, Hs = M.H || h * u, tone = M.tone || 1.8;
    for (j = 0; j < bh; j++) for (i = 0; i < bw; i++) {
      k = j * bw + i;
      var a = A[k]; if (a < 0.01) continue;
      var kl = i > 0 ? k - 1 : k, kr = i < bw - 1 ? k + 1 : k, ku = j > 0 ? k - bw : k, kd = j < bh - 1 ? k + bw : k;
      var sx = ox + (i + x0) * u, sy = oy + (j + y0) * u;
      var dx = (Hf[kr] - Hf[kl]) * bump + (B[kr] - B[kl]) * round;
      var dy = (Hf[kd] - Hf[ku]) * bump + (B[kd] - B[ku]) * round;
      var nl = 1 / Math.sqrt(dx * dx + dy * dy + 1), nx = -dx * nl, ny = -dy * nl, nz = nl;
      var diff = nx * lx + ny * ly + nz * lz; if (diff < 0) diff = 0;
      var hv = Hf[k], cav = (hv - Hb[k]) * cavK, occ = cav < 0 ? Math.max(0.28, 1 + cav) : Math.min(1.2, 1 + cav * 0.4);
      var t = (hv - 0.5) * tone + 0.5; t = t < 0 ? 0 : t > 1 ? 1 : t;
      var ar, ag, ab, q;
      if (t < 0.5) { q = t * 2; ar = dark[0] + (base[0] - dark[0]) * q; ag = dark[1] + (base[1] - dark[1]) * q; ab = dark[2] + (base[2] - dark[2]) * q; }
      else { q = (t - 0.5) * 2; ar = base[0] + (lite[0] - base[0]) * q; ag = base[1] + (lite[1] - base[1]) * q; ab = base[2] + (lite[2] - base[2]) * q; }
      if (strata) {
        var sv = Math.sin((sy + (hv - 0.5) * strata.warp + (n.v2(sx * 0.01, sy * 0.004) - 0.5) * strata.warp) * strata.f);
        var band = 1 + (sv > 0 ? 0.05 : -0.05) * strata.a - (sv > 0.86 ? (sv - 0.86) / 0.14 * strata.a * 0.6 : 0);
        ar *= band; ag *= band; ab *= band;
      }
      if (streak) {
        var stv = n.fbm(sx * 0.06 + 13, sy * 0.0035, 2), sk = 1 - streak * smooth(0.47, 0.68, stv) * clamp(dT[k] / 50, 0.2, 1);
        ar *= sk; ag *= sk; ab *= sk;
      }
      if (stain) { var sn = smooth(0.58, 0.82, n.v2(sx * 0.015 + 50, sy * 0.006)) * stainA; ar += (stain[0] - ar) * sn; ag += (stain[1] - ag) * sn; ab += (stain[2] - ab) * sn; }
      if (cap) {
        var cn = n.fbm(sx * (cap.s || 0.03) + 91, sy * (cap.s || 0.03) * 1.6, 3);
        var ca = smooth(cap.lo, cap.hi, -ny + (cn - 0.5) * (cap.noise == null ? 0.8 : cap.noise));
        if (cap.depth) ca *= clamp(1.6 - dT[k] / cap.depth, 0, 1);
        if (cap.y1 != null) ca *= 1 - smooth(cap.y0, cap.y1, sy / Hs);
        ca *= cap.amt;
        ar += (capC[0] - ar) * ca; ag += (capC[1] - ag) * ca; ab += (capC[2] - ab) * ca;
      }
      var skyK = 0.62 + 0.38 * (ny < 0 ? -ny : 0) - 0.25 * (ny > 0 ? ny : 0), occD = occ > 1 ? 1 : occ;
      var rim = rimW ? (Math.exp(-dS[k] / rimW) + 0.55 * Math.exp(-dT[k] / rimW)) * (0.25 + 0.75 * diff) : 0;
      var cr = ar * (amb[0] * skyK * occ + key[0] * diff * occD) + rimC[0] * rim * ar * 1.6;
      var cg = ag * (amb[1] * skyK * occ + key[1] * diff * occD) + rimC[1] * rim * ag * 1.6;
      var cb = ab * (amb[2] * skyK * occ + key[2] * diff * occD) + rimC[2] * rim * ab * 1.6;
      if (spec) { var sp = nx * hx + ny * hy + nz * hz; if (sp > 0) { sp = Math.pow(sp, spec.p) * spec.a * occD; cr += key[0] * sp; cg += key[1] * sp; cb += key[2] * sp; } }
      if (glow) { var gk = glow.fn(sx, sy, nx, ny); if (gk > 0) { cr += ar * glow.c[0] * gk; cg += ag * glow.c[1] * gk; cb += ab * glow.c[2] * gk; } }
      if (haze) { var hzv = hfn(sx, sy); cr += (haze[0] - cr) * hzv; cg += (haze[1] - cg) * hzv; cb += (haze[2] - cb) * hzv; }
      var q4 = ((j + y0) * w + i + x0) * 4;
      d[q4] = cr > 1 ? 255 : cr * 255; d[q4 + 1] = cg > 1 ? 255 : cg * 255; d[q4 + 2] = cb > 1 ? 255 : cb * 255;
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  // ── shape helpers (scene units) ──
  function newLayer(P, f) {
    var c = canvas(P.W * f, P.H * f), x = c.getContext('2d');
    x.setTransform(c.width / P.W, 0, 0, c.height / P.H, 0, 0);
    return { c: c, x: x };
  }
  function shapeCanvas(P, f, bx, by, bw, bh) {
    var c = canvas(bw * f, bh * f), x = c.getContext('2d'), fx = c.width / bw;
    x.setTransform(fx, 0, 0, fx, -bx * fx, -by * fx); x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
    return { c: c, x: x, f: fx, bx: bx, by: by, w: bw, h: bh };
  }
  function shadeShape(P, S, M) { shadeMask(S.c, P.n, ext(M, { unit: 1 / S.f, ox: S.bx, oy: S.by, H: P.H })); return S; }
  function put(Ly, S, alpha) { if (alpha != null) Ly.x.globalAlpha = alpha; Ly.x.drawImage(S.c, S.bx, S.by, S.c.width / S.f, S.c.height / S.f); Ly.x.globalAlpha = 1; }
  function poly(x, pts) { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); x.fill(); }
  /** Subdivide a closed outline and push each point along its normal by fractal noise: rock-like edges. */
  function rough(pts, n, step, amp, seed) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1, m = Math.max(1, Math.round(len / step));
      for (var k = 0; k < m; k++) {
        var t = k / m, px = a[0] + dx * t, py = a[1] + dy * t, e = (n.fbm(px * 0.02 + seed, py * 0.02 - seed, 4) - 0.5) * 2 * amp * (k === 0 ? 0.3 : 1);
        out.push([px - dy / len * e, py + dx / len * e]);
      }
    }
    return out;
  }
  function bez(p0, p1, p2, p3, m) {
    var out = [];
    for (var i = 0; i <= m; i++) {
      var t = i / m, a = (1 - t) * (1 - t) * (1 - t), b = 3 * (1 - t) * (1 - t) * t, c = 3 * (1 - t) * t * t, d = t * t * t;
      out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
    }
    return out;
  }
  /** A tapered tube along a polyline: horns, ribs, tails, coils. */
  function stamp(x, pts, r0, r1, rf) {
    var total = 0, i, segs = [];
    for (i = 1; i < pts.length; i++) { var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); total += l; }
    var acc = 0;
    for (i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], L = segs[i - 1], m = Math.max(1, Math.ceil(L / Math.max(0.6, Math.min(r0, r1) * 0.35)));
      for (var k = 0; k < m; k++) {
        var t = (acc + L * k / m) / total, r = rf ? rf(t) : r0 + (r1 - r0) * t;
        x.beginPath(); x.arc(a[0] + (b[0] - a[0]) * k / m, a[1] + (b[1] - a[1]) * k / m, Math.max(0.3, r), 0, TAU); x.fill();
      }
      acc += L;
    }
    var e = pts[pts.length - 1]; x.beginPath(); x.arc(e[0], e[1], Math.max(0.3, rf ? rf(1) : r1), 0, TAU); x.fill();
  }
  function hzY(P, col, a0, a1, y0, y1) { var H = P.H; return { col: col, fn: function (sx, sy) { var t = clamp((sy / H - y0) / (y1 - y0), 0, 1); return a0 + (a1 - a0) * t; } }; }
  function lightOf(th, extra) { return ext({ L: th.L, key: th.key, amb: th.amb, rimCol: th.rimCol }, extra || {}); }

  /** Sky: graded gradient with soft cloud-bank modulation, dither and localized glows (moon, sun, lava, shaft). */
  function paintSky2(P) {
    var th = P.th, w = Math.round(P.W * P.ff), h = Math.round(P.H * P.ff), c = canvas(w, h), x = c.getContext('2d'), n = P.n;
    var g = x.createLinearGradient(0, 0, 0, h);
    th.sky.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    (th.glows || []).forEach(function (G) {
      var gx = G[0] * w, gy = G[1] * h, R = G[2] * h, rg = x.createRadialGradient(gx, gy, 0, gx, gy, R);
      rg.addColorStop(0, 'rgba(' + G[3] + ',' + G[4] + ')'); rg.addColorStop(0.35, 'rgba(' + G[3] + ',' + G[4] * 0.4 + ')'); rg.addColorStop(1, 'rgba(' + G[3] + ',0)');
      x.save(); x.translate(gx, gy); x.scale(G[5] || 1.6, 1); x.translate(-gx, -gy); x.fillStyle = rg; x.fillRect(gx - R * 2, gy - R, R * 4, R * 2); x.restore();
    });
    var id = x.getImageData(0, 0, w, h), d = id.data, amp = th.skyNoise == null ? 9 : th.skyNoise, hs = 0x9e3779b9;
    for (var y = 0; y < h; y++) for (var i = 0; i < w; i++) {
      var k = (y * w + i) * 4, v = (n.fbm(i / w * 5, y / h * 9, 4) - 0.5) * amp * (0.4 + y / h);
      hs = (hs ^ (hs << 13)) >>> 0; hs = (hs ^ (hs >>> 17)) >>> 0; hs = (hs ^ (hs << 5)) >>> 0;
      var dn = (hs / 4294967296 - 0.5) * 3;
      d[k] = clamp(d[k] + v + dn, 0, 255); d[k + 1] = clamp(d[k + 1] + v * 0.95 + dn, 0, 255); d[k + 2] = clamp(d[k + 2] + v * 0.9 + dn, 0, 255);
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  /** A mountain range with a real silhouette: domain-warped ridged skyline plus a few broad massifs, lit as rock. */
  function paintRange2(P, R) {
    var W = P.W, H = P.H, n = P.n, f = R.f || P.ff, S = shapeCanvas(P, f, 0, 0, W, H), x = S.x;
    var steps = Math.round(W * f / 2);
    x.beginPath(); x.moveTo(-10, H + 10);
    for (var i = 0; i <= steps; i++) {
      var u = i / steps, wu = u * R.freq + (n.fbm(u * 2.3 + R.seed, R.seed, 3) - 0.5) * (R.warp == null ? 1.2 : R.warp);
      var r = n.ridged2(wu, R.seed * 1.37, 6), e = Math.pow(smooth(R.lo || 0.2, R.hi || 0.9, r), R.sharp || 1.3), m = 0;
      (R.massifs || []).forEach(function (M) { m += M[2] * Math.exp(-Math.pow((u - M[0]) / M[1], 2)); });
      x.lineTo(u * W, H * (R.top - R.amp * e - m) + (n.fbm(u * 90, R.seed + 4, 3) - 0.5) * H * 0.006);
    }
    x.lineTo(W + 10, H + 10); x.closePath(); x.fill();
    shadeShape(P, S, R.mat);
    return S;
  }

  // ─────────────── dragon skull (profile, facing +x), shared by the caldera, the hollow and the shrine ───────────────
  // Local units: 1 = skull length. Returns the outline pieces so callers can mask, cut the openings and add teeth.
  function skullParts(ox, oy, s, face, jaw) {
    function T(p) { return [ox + p[0] * s * face, oy + p[1] * s]; }
    function rot(p, c, a) { var dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)]; }
    var cranium = [[0, 0.02], [0.02, -0.12], [0.1, -0.24], [0.24, -0.31], [0.38, -0.3], [0.47, -0.25], [0.56, -0.2], [0.7, -0.16], [0.86, -0.12], [0.98, -0.09], [1.03, -0.03], [1.0, 0.03],
      [0.9, 0.05], [0.7, 0.06], [0.5, 0.09], [0.36, 0.13], [0.28, 0.2], [0.16, 0.22], [0.06, 0.15]].map(T);
    var hinge = [0.24, 0.14];
    var lower = [[0.2, 0.12], [0.5, 0.13], [0.8, 0.12], [0.94, 0.13], [0.95, 0.18], [0.8, 0.2], [0.55, 0.25], [0.32, 0.29], [0.18, 0.24]].map(function (p) { return T(rot(p, hinge, jaw)); });
    var horn1 = bez([0.12, -0.2], [-0.12, -0.42], [-0.42, -0.46], [-0.62, -0.36], 18).map(T);
    var horn2 = bez([0.06, 0.04], [-0.12, 0.02], [-0.3, 0.1], [-0.42, 0.24], 14).map(T);
    var frill = [[0.02, -0.1], [-0.12, -0.18], [-0.08, -0.04], [-0.2, 0.0], [-0.05, 0.08], [0.04, 0.12]].map(T);
    var eye = T([0.42, -0.14]), nostril = T([0.92, -0.06]), fen = T([0.64, -0.08]);
    var teethU = [], teethL = [];
    var jy = function (px) { return px > 0.7 ? 0.06 - (px - 0.7) / 0.3 * 0.03 : 0.06 + (0.7 - px) / 0.2 * 0.03; };
    for (var t = 0; t < 9; t++) { var tx = 0.42 + t * 0.065, tl = 0.04 + (t === 1 || t === 5 ? 0.045 : 0.0) + (t % 2) * 0.01, ty = jy(tx) - 0.012; teethU.push([T([tx - 0.017, ty]), T([tx, ty + tl]), T([tx + 0.017, ty])]); }
    for (t = 0; t < 7; t++) { var lx = 0.46 + t * 0.07, ll = 0.045 + (t === 2 ? 0.05 : 0); teethL.push([lx - 0.016, 0.13], [lx, 0.13 - ll], [lx + 0.016, 0.13]); }
    var lt = []; for (t = 0; t < teethL.length; t += 3) lt.push([teethL[t], teethL[t + 1], teethL[t + 2]].map(function (p) { return T(rot(p, hinge, jaw)); }));
    return { cranium: cranium, lower: lower, horn1: horn1, horn2: horn2, frill: frill, eye: eye, nostril: nostril, fen: fen, teethU: teethU, teethL: lt, s: s, face: face };
  }
  function drawSkullMask(x, K, cut) {
    x.globalCompositeOperation = 'source-over';
    poly(x, K.cranium); poly(x, K.lower); poly(x, K.frill);
    stamp(x, K.horn1, K.s * 0.07, K.s * 0.008); stamp(x, K.horn2, K.s * 0.045, K.s * 0.006);
    K.teethU.forEach(function (tt) { poly(x, tt); }); K.teethL.forEach(function (tt) { poly(x, tt); });
    if (cut) {
      x.globalCompositeOperation = 'destination-out';
      x.beginPath(); x.ellipse(K.eye[0], K.eye[1], K.s * 0.075, K.s * 0.055, -0.25 * K.face, 0, TAU); x.fill();
      x.beginPath(); x.ellipse(K.fen[0], K.fen[1], K.s * 0.08, K.s * 0.028, -0.12 * K.face, 0, TAU); x.fill();
      x.beginPath(); x.ellipse(K.nostril[0], K.nostril[1], K.s * 0.025, K.s * 0.015, 0, 0, TAU); x.fill();
      x.globalCompositeOperation = 'source-over';
    }
  }
  /** Hollow interiors behind a cut skull: dark sockets, and the open mouth (optionally lit from inside). */
  function skullInterior(x, K, col, glowCol) {
    x.save(); x.globalCompositeOperation = 'destination-over';
    x.fillStyle = col;
    x.beginPath(); x.ellipse(K.eye[0], K.eye[1], K.s * 0.08, K.s * 0.06, 0, 0, TAU); x.fill();
    x.beginPath(); x.ellipse(K.fen[0], K.fen[1], K.s * 0.085, K.s * 0.033, 0, 0, TAU); x.fill();
    x.beginPath(); x.ellipse(K.nostril[0], K.nostril[1], K.s * 0.03, K.s * 0.02, 0, 0, TAU); x.fill();
    // the gap between the jaws
    var m = [K.cranium[16], K.cranium[15], K.cranium[14], K.cranium[13], K.lower[2], K.lower[1], K.lower[0], K.lower[8]];
    if (glowCol) {
      var cx = (K.cranium[14][0] + K.lower[1][0]) / 2, cy = (K.cranium[14][1] + K.lower[1][1]) / 2, g = x.createRadialGradient(cx, cy, 0, cx, cy, K.s * 0.3);
      g.addColorStop(0, glowCol); g.addColorStop(1, col); x.fillStyle = g;
    }
    poly(x, m);
    x.restore();
  }

  // ─────────────── STORM: Skyforge Spire ───────────────
  function paintStorm(P) {
    var W = P.W, H = P.H, S = P.S, n = P.n, th = P.th, mid = newLayer(P, P.fm), r = rnd(23), M = th.mat;
    // A nearer, darker range across the back of the mid layer, snow in its high gullies
    put(mid, paintRange2(P, { f: P.fm * 0.7, top: 0.8, amp: 0.2, freq: 4.4, seed: 29, warp: 1.8, lo: 0.25, hi: 0.95, sharp: 1.6, massifs: [[0.16, 0.07, 0.07], [0.93, 0.06, 0.05]],
      mat: lightOf(th, ext(M.rock, { scale: 0.012, stretch: 0.45, ridged: true, warp: 1.4, bump: 0.9, form: 30, round: 0.9, rim: 6,
        cap: { col: '#b9c3cf', amt: 0.55, lo: 0.25, hi: 0.6, s: 0.02, noise: 1, y0: 0.62, y1: 0.75 }, haze: hzY(P, th.haze, 0.42, 0.78, 0.5, 0.8) })) }));
    // Left: a storm-cut crag with the ruin of a bridge that once reached the spire
    var cl = shapeCanvas(P, P.fm, 0, H * 0.24, W * 0.36, H * 0.78), cx = cl.x;
    poly(cx, rough([[-20, H * 1.05], [-20, H * 0.43], [W * 0.05, H * 0.4], [W * 0.1, H * 0.415], [W * 0.15, H * 0.44], [W * 0.185, H * 0.47], [W * 0.2, H * 0.55], [W * 0.19, H * 0.63], [W * 0.215, H * 0.72], [W * 0.2, H * 0.84], [W * 0.23, H * 1.05]], n, 9 * S, 10 * S, 3.3));
    // the broken bridge: a deck on two arches, sheared off mid-span
    var by = H * 0.43, bx0 = W * 0.17, bx1 = W * 0.31;
    poly(cx, [[bx0, by - 16 * S], [bx1 - 14 * S, by - 16 * S], [bx1, by - 4 * S], [bx1 - 8 * S, by + 6 * S], [bx1 - 20 * S, by + 2 * S], [bx1 - 28 * S, by + 26 * S], [bx0, by + 60 * S]]);
    cx.fillRect(bx0 + 30 * S, by, 22 * S, H * 0.2);
    cx.globalCompositeOperation = 'destination-out';
    [[bx0 + 10 * S, 18 * S], [bx0 + 64 * S, 22 * S]].forEach(function (A) { cx.beginPath(); cx.moveTo(A[0] - A[1], by + 80 * S); cx.lineTo(A[0] - A[1], by + 24 * S); cx.arc(A[0], by + 24 * S, A[1], Math.PI, 0); cx.lineTo(A[0] + A[1], by + 80 * S); cx.fill(); });
    cx.globalCompositeOperation = 'source-over';
    // a ruined watch-house on the crag
    var rx = W * 0.07, ry = H * 0.405;
    poly(cx, [[rx - 34 * S, ry + 8 * S], [rx - 34 * S, ry - 70 * S], [rx - 20 * S, ry - 84 * S], [rx - 6 * S, ry - 64 * S], [rx + 8 * S, ry - 72 * S], [rx + 14 * S, ry - 50 * S], [rx + 30 * S, ry - 46 * S], [rx + 34 * S, ry + 8 * S]]);
    cx.globalCompositeOperation = 'destination-out';
    cx.beginPath(); cx.moveTo(rx - 14 * S, ry); cx.lineTo(rx - 14 * S, ry - 34 * S); cx.arc(rx - 4 * S, ry - 34 * S, 10 * S, Math.PI, 0); cx.lineTo(rx + 6 * S, ry); cx.fill();
    cx.globalCompositeOperation = 'source-over';
    shadeShape(P, cl, lightOf(th, ext(M.rock, { scale: 0.02, warp: 2, ridged: true, stretch: 0.7, bump: 1.2, form: 14, round: 1, rim: 5, streak: 0.35, strata: { f: 0.09, a: 0.5, warp: 30 },
      cap: { col: '#33402f', amt: 0.6, lo: 0.35, hi: 0.75, s: 0.05, depth: 10 }, haze: hzY(P, th.haze, 0.18, 0.5, 0.4, 0.95) })));
    put(mid, cl);
    // ── the Spire: dragon-forged stone banded in bronze, horns at the crown, a forge burning in its flank ──
    var sx = W * 0.8, gy = H * 0.62, top = H * 0.115, hgt = gy - top;
    var crag = shapeCanvas(P, P.fm, W * 0.62, H * 0.5, W * 0.38, H * 0.55);
    poly(crag.x, rough([[W * 0.66, H * 1.05], [W * 0.7, H * 0.7], [W * 0.73, H * 0.64], [W * 0.765, H * 0.6], [W * 0.84, H * 0.605], [W * 0.88, H * 0.65], [W * 0.92, H * 0.66], [W * 0.98, H * 0.72], [W * 1.02, H * 1.05]], n, 8 * S, 9 * S, 7.1));
    shadeShape(P, crag, lightOf(th, ext(M.rock, { scale: 0.022, warp: 2, ridged: true, stretch: 0.6, bump: 1.2, form: 16, rim: 5, streak: 0.4, strata: { f: 0.08, a: 0.5, warp: 30 },
      cap: { col: '#33402f', amt: 0.55, lo: 0.4, hi: 0.8, s: 0.05, depth: 8 }, haze: hzY(P, th.haze, 0.2, 0.55, 0.55, 0.95) })));
    var tw = shapeCanvas(P, P.fm, sx - 130 * S, top - 110 * S, 260 * S, hgt + 140 * S), tx = tw.x, rings = [];
    var secs = 6, wBase = 96 * S, wTop = 46 * S;
    for (var sct = 0; sct < secs; sct++) {
      var t0 = sct / secs, t1 = (sct + 1) / secs, ya = gy - hgt * t0, yb = gy - hgt * t1 + 6 * S;
      var wa = (wBase + (wTop - wBase) * t0) / 2, wb = (wBase + (wTop - wBase) * t1) / 2, off = (sct % 2 ? 2 : -2) * S;
      poly(tx, [[sx - wa + off, ya], [sx - wb * 1.02 + off, yb], [sx + wb * 0.98 + off, yb], [sx + wa + off, ya]]);
      rings.push([sx + off, yb, wb]);
    }
    // buttress fins bracing the base, the left one longer
    poly(tx, [[sx - wBase * 0.5, gy - hgt * 0.32], [sx - wBase * 1.05, gy + 4 * S], [sx - wBase * 0.45, gy + 4 * S]]);
    poly(tx, [[sx + wBase * 0.5, gy - hgt * 0.22], [sx + wBase * 0.85, gy + 6 * S], [sx + wBase * 0.45, gy + 6 * S]]);
    // crown collar and the needle
    poly(tx, [[sx - wTop * 0.75, top + 10 * S], [sx - wTop * 0.5, top - 14 * S], [sx + wTop * 0.5, top - 14 * S], [sx + wTop * 0.75, top + 10 * S]]);
    poly(tx, [[sx - 7 * S, top - 12 * S], [sx, top - 92 * S], [sx + 7 * S, top - 12 * S]]);
    // forge mouth and window slits cut through
    var fy = gy - hgt * 0.3, fwid = 15 * S;
    tx.globalCompositeOperation = 'destination-out';
    tx.beginPath(); tx.moveTo(sx - fwid, fy + 26 * S); tx.lineTo(sx - fwid, fy); tx.arc(sx, fy, fwid, Math.PI, 0); tx.lineTo(sx + fwid, fy + 26 * S); tx.fill();
    [[0.52, -0.2], [0.66, 0.18], [0.78, -0.1]].forEach(function (Wn) { var wy = gy - hgt * Wn[0], wx = sx + Wn[1] * wBase * 0.5; tx.fillRect(wx - 2.5 * S, wy, 5 * S, 15 * S); });
    tx.globalCompositeOperation = 'source-over';
    shadeShape(P, tw, lightOf(th, ext(M.stone, { scale: 0.05, warp: 1, stretch: 1.4, bump: 0.5, form: 30, round: 1.5, rim: 4, cav: 3, streak: 0.5, strata: { f: 0.45, a: 0.5, warp: 4 },
      stain: ['#3c4a40', 0.35], haze: hzY(P, th.haze, 0.12, 0.3, 0.1, 0.65) })));
    // masonry courses and the warm forge behind the arch
    tx.save(); tx.globalCompositeOperation = 'source-atop'; tx.lineWidth = 1 * S;
    for (var cy = gy - 6 * S, row = 0; cy > top; cy -= 13 * S, row++) {
      var hw = (wBase + (wTop - wBase) * ((gy - cy) / hgt)) / 2;
      tx.strokeStyle = 'rgba(8,10,14,0.35)'; tx.beginPath(); tx.moveTo(sx - hw, cy); tx.lineTo(sx + hw, cy); tx.stroke();
      tx.strokeStyle = 'rgba(170,185,210,0.08)'; tx.beginPath(); tx.moveTo(sx - hw, cy + 1.2 * S); tx.lineTo(sx + hw, cy + 1.2 * S); tx.stroke();
      for (var jx = sx - hw + (row % 2 ? 9 : 17) * S; jx < sx + hw; jx += 22 * S) { tx.strokeStyle = 'rgba(8,10,14,0.28)'; tx.beginPath(); tx.moveTo(jx, cy); tx.lineTo(jx, cy - 13 * S); tx.stroke(); }
    }
    tx.restore();
    tx.save(); tx.globalCompositeOperation = 'destination-over';
    var fg = tx.createRadialGradient(sx, fy + 10 * S, 0, sx, fy + 10 * S, fwid * 1.6); fg.addColorStop(0, '#ffb15a'); fg.addColorStop(0.45, '#b4501c'); fg.addColorStop(1, '#2a120a');
    tx.fillStyle = fg; tx.fillRect(sx - fwid * 1.5, fy - fwid * 1.5, fwid * 3, 44 * S);
    tx.fillStyle = '#0a0b0e'; tx.fillRect(sx - 130 * S, top - 110 * S, 260 * S, hgt + 140 * S);
    tx.restore();
    // re-clip the dark backing to the tower silhouette: redraw the silhouette as a mask
    var mask = shapeCanvas(P, P.fm, tw.bx, tw.by, tw.w, tw.h), mx = mask.x;
    for (sct = 0; sct < secs; sct++) {
      var u0 = sct / secs, u1 = (sct + 1) / secs, y0 = gy - hgt * u0, y1 = gy - hgt * u1 + 6 * S, w0 = (wBase + (wTop - wBase) * u0) / 2, w1 = (wBase + (wTop - wBase) * u1) / 2, of2 = (sct % 2 ? 2 : -2) * S;
      poly(mx, [[sx - w0 + of2, y0], [sx - w1 * 1.02 + of2, y1], [sx + w1 * 0.98 + of2, y1], [sx + w0 + of2, y0]]);
    }
    poly(mx, [[sx - wBase * 0.5, gy - hgt * 0.32], [sx - wBase * 1.05, gy + 4 * S], [sx - wBase * 0.45, gy + 4 * S]]);
    poly(mx, [[sx + wBase * 0.5, gy - hgt * 0.22], [sx + wBase * 0.85, gy + 6 * S], [sx + wBase * 0.45, gy + 6 * S]]);
    poly(mx, [[sx - wTop * 0.75, top + 10 * S], [sx - wTop * 0.5, top - 14 * S], [sx + wTop * 0.5, top - 14 * S], [sx + wTop * 0.75, top + 10 * S]]);
    poly(mx, [[sx - 7 * S, top - 12 * S], [sx, top - 92 * S], [sx + 7 * S, top - 12 * S]]);
    tx.save(); tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalCompositeOperation = 'destination-in'; tx.drawImage(mask.c, 0, 0); tx.restore();
    // bronze: rings between the courses, the crown collar and four horns sweeping out of it
    var br = shapeCanvas(P, P.fm, tw.bx - 60 * S, tw.by - 40 * S, tw.w + 120 * S, tw.h + 40 * S), bxx = br.x;
    rings.forEach(function (R, i) { if (i === rings.length - 1) return; bxx.fillRect(R[0] - R[2] - 5 * S, R[1] - 5 * S, R[2] * 2 + 10 * S, 8 * S); });
    bxx.fillRect(sx - wTop * 0.8, top + 4 * S, wTop * 1.6, 9 * S);
    stamp(bxx, bez([sx - wTop * 0.45, top - 6 * S], [sx - 60 * S, top - 30 * S], [sx - 70 * S, top - 80 * S], [sx - 46 * S, top - 118 * S], 20), 7 * S, 1 * S);
    stamp(bxx, bez([sx + wTop * 0.45, top - 6 * S], [sx + 50 * S, top - 24 * S], [sx + 58 * S, top - 62 * S], [sx + 40 * S, top - 92 * S], 20), 6 * S, 1 * S);
    stamp(bxx, bez([sx - wTop * 0.3, top - 10 * S], [sx - 26 * S, top - 40 * S], [sx - 30 * S, top - 56 * S], [sx - 18 * S, top - 70 * S], 14), 4 * S, 0.8 * S);
    stamp(bxx, bez([sx + wTop * 0.3, top - 10 * S], [sx + 22 * S, top - 34 * S], [sx + 26 * S, top - 48 * S], [sx + 16 * S, top - 58 * S], 14), 3.5 * S, 0.8 * S);
    shadeShape(P, br, lightOf(th, ext(M.bronze, { scale: 0.08, bump: 0.4, form: 5, round: 1.6, spec: { p: 18, a: 0.9 }, cav: 2, rim: 3,
      cap: { col: '#3f6a62', amt: 0.45, lo: 0.2, hi: 0.7, s: 0.08 }, haze: hzY(P, th.haze, 0.12, 0.3, 0.1, 0.65) })));
    put(mid, crag);
    // chains: from the spire's mid ring down to the broken bridge, sagging through the haze
    var ch = shapeCanvas(P, P.fm, W * 0.2, H * 0.2, W * 0.62, H * 0.4), chx = ch.x;
    [[[sx - 30 * S, gy - hgt * 0.5], [bx1 - 18 * S, by - 10 * S], 0.13], [[sx - 22 * S, gy - hgt * 0.83], [W * 0.075, ry - 82 * S], 0.08]].forEach(function (C) {
      var a = C[0], b = C[1], sag = H * C[2], pts = [];
      for (var i = 0; i <= 60; i++) { var t = i / 60; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * sag]); }
      var acc = 0, li = 0;
      for (i = 1; i < pts.length; i++) {
        var p0 = pts[i - 1], p1 = pts[i], L2 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
        for (acc += L2; acc > 6 * S; acc -= 6 * S, li++) {
          chx.save(); chx.translate(p1[0], p1[1]); chx.rotate(ang);
          if (li % 2) { chx.lineWidth = 1.6 * S; chx.beginPath(); chx.ellipse(0, 0, 4.2 * S, 2.4 * S, 0, 0, TAU); chx.stroke(); }
          else chx.fillRect(-4 * S, -0.9 * S, 8 * S, 1.8 * S);
          chx.restore();
        }
      }
    });
    shadeShape(P, ch, lightOf(th, ext(M.iron, { scale: 0.2, bump: 0.2, form: 2, round: 1.2, spec: { p: 12, a: 0.5 }, cav: 0, haze: hzY(P, th.haze, 0.3, 0.45, 0.2, 0.6) })));
    put(mid, ch);
    put(mid, br); put(mid, tw);
    // base mist pooled around the crags
    var mz = mid.x.createLinearGradient(0, H * 0.55, 0, H);
    mz.addColorStop(0, rgba(hex(th.haze), 0)); mz.addColorStop(0.6, rgba(hex(th.haze), 0.32)); mz.addColorStop(1, rgba(hex(th.haze), 0.55));
    mid.x.globalCompositeOperation = 'source-atop'; mid.x.fillStyle = mz; mid.x.fillRect(0, 0, W, H); mid.x.globalCompositeOperation = 'source-over';
    return { mid: mid.c, land: { rod: [sx, top - 92 * S], forge: [sx, fy + 8 * S], S: S } };
  }

  // ─────────────── VOLCANO: Ember Caldera ───────────────
  function paintVolcanoV2(P) {
    var W = P.W, H = P.H, S = P.S, n = P.n, th = P.th, mid = newLayer(P, P.fm), M = th.mat;
    var cx = W * 0.62, peak = H * 0.25, base = H * 0.86;
    var lavaGlow = { c: [1.0, 0.42, 0.16], fn: function (sx, sy, nx, ny) { var k = clamp((sy / H - 0.62) / 0.3, 0, 1); return k * k * (0.35 + 0.65 * Math.max(0, ny)) * 0.9; } };
    // the cone: concave flanks, an asymmetric broken crater, radial gullies
    var vc = shapeCanvas(P, P.fm, W * 0.2, peak - 20 * S, W * 0.82, base - peak + 40 * S), vx = vc.x, pts = [[W * 0.22, base + 20 * S]];
    for (var i = 0; i <= 160; i++) {
      var u = W * 0.22 + i / 160 * W * 0.8, dd = Math.abs(u - cx) / (W * 0.38), side = u < cx ? 1 : 0.92;
      var y = base - (base - peak) * Math.pow(clamp(1 - dd, 0, 1), 1.7) * side;
      var cr = Math.abs(u - cx) / (W * 0.045); if (cr < 1) y += (1 - cr * cr) * H * (u < cx ? 0.04 : 0.025);
      y += (n.ridged2(u * 0.02, 3.3, 4) - 0.4) * H * 0.018 * (1 - dd * 0.6);
      pts.push([u, y]);
    }
    pts.push([W * 1.02, base + 20 * S]);
    poly(vx, pts);
    shadeShape(P, vc, lightOf(th, ext(M.rock, { ridged: true, oct: 5, bump: 1.1, form: 40, round: 0.8, rim: 8, cav: 3, streak: 0.3,
      coord: function (sx, sy) { var dx = sx - cx, dy = sy - peak + 30 * S; return [Math.atan2(dx, dy) * 9, Math.sqrt(dx * dx + dy * dy) * 0.006]; },
      cap: { col: '#6b6460', amt: 0.55, lo: 0.3, hi: 0.75, s: 0.03, noise: 1 }, glow: { c: [1.0, 0.45, 0.18], fn: function (sx, sy, nx, ny) {
        var dc = Math.hypot(sx - cx, (sy - peak) * 1.4) / (90 * S); return Math.exp(-dc * dc) * 0.9 + lavaGlow.fn(sx, sy, nx, ny); } },
      haze: hzY(P, th.haze, 0.38, 0.62, 0.25, 0.85) })));
    // two thin lava seams down the right flank, broken where the crust has closed over them
    vx.save(); vx.globalCompositeOperation = 'lighter'; vx.lineCap = 'round';
    var rr = rnd(71);
    [[0.012, 1], [-0.018, 0.6]].forEach(function (Sd, si) {
      var px = cx + Sd[0] * W, py = peak + H * 0.04, path = [[px, py]];
      for (var st = 0; st < 30 && py < base - 40 * S; st++) { px += (Sd[0] > 0 ? 1 : -1) * (2 + rr() * 9) * S + (rr() - 0.5) * 6 * S; py += (8 + rr() * 9) * S; path.push([px, py]); }
      [[5, 'rgba(255,90,25,0.07)'], [1.8, 'rgba(255,130,45,0.32)'], [0.7, 'rgba(255,215,140,0.45)']].forEach(function (Lw) {
        vx.lineWidth = Lw[0] * S * Sd[1]; vx.strokeStyle = Lw[1];
        for (var k2 = 1; k2 < path.length; k2++) { if ((k2 * 7 + si) % 5 === 0) continue; vx.globalAlpha = 1 - k2 / path.length * 0.7; vx.beginPath(); vx.moveTo(path[k2 - 1][0], path[k2 - 1][1]); vx.lineTo(path[k2][0], path[k2][1]); vx.stroke(); }
      });
    });
    vx.restore();
    put(mid, vc);
    // left: the caldera wall, and a colossal dragon skull fossilised in it, its open jaws a gate with a fire inside
    var wl = shapeCanvas(P, P.fm, 0, H * 0.2, W * 0.42, H * 0.85), wx = wl.x;
    poly(wx, rough([[-20, H * 1.05], [-20, H * 0.31], [W * 0.04, H * 0.27], [W * 0.09, H * 0.3], [W * 0.13, H * 0.33], [W * 0.15, H * 0.4], [W * 0.2, H * 0.5], [W * 0.29, H * 0.55], [W * 0.33, H * 0.66], [W * 0.31, H * 0.78], [W * 0.36, H * 1.05]], n, 9 * S, 12 * S, 5.5));
    shadeShape(P, wl, lightOf(th, ext(M.rock, { scale: 0.016, warp: 2, ridged: true, stretch: 0.55, bump: 1.3, form: 18, rim: 5, streak: 0.35, strata: { f: 0.07, a: 0.6, warp: 40 },
      cap: { col: '#5f5752', amt: 0.6, lo: 0.35, hi: 0.75, s: 0.04, depth: 14 }, glow: lavaGlow, haze: hzY(P, th.haze, 0.2, 0.45, 0.3, 0.95) })));
    put(mid, wl);
    var K = skullParts(W * 0.07, H * 0.45, W * 0.22, 1, 0.42);
    var sk = shapeCanvas(P, P.fm, W * -0.08, H * 0.25, W * 0.42, H * 0.36);
    drawSkullMask(sk.x, K, true);
    shadeShape(P, sk, lightOf(th, ext(M.bone, { scale: 0.035, warp: 1.5, bump: 0.8, form: 16, round: 1.4, rim: 5, cav: 5, streak: 0.45, stain: ['#4a2e22', 0.4],
      cap: { col: '#57504c', amt: 0.6, lo: 0.3, hi: 0.7, s: 0.05 }, glow: lavaGlow, haze: hzY(P, th.haze, 0.2, 0.32, 0.3, 0.7) })));
    skullInterior(sk.x, K, '#120806', 'rgba(255,120,50,0.85)');
    put(mid, sk);
    // rubble burying the lower jaw into the wall
    var rb = shapeCanvas(P, P.fm, 0, H * 0.48, W * 0.36, H * 0.3);
    poly(rb.x, rough([[W * 0.0, H * 0.75], [W * 0.02, H * 0.58], [W * 0.08, H * 0.55], [W * 0.14, H * 0.57], [W * 0.2, H * 0.6], [W * 0.27, H * 0.62], [W * 0.31, H * 0.75]], n, 6 * S, 9 * S, 9.9));
    shadeShape(P, rb, lightOf(th, ext(M.rock, { scale: 0.035, warp: 2, ridged: true, bump: 1.4, form: 10, rim: 4, cap: { col: '#5f5752', amt: 0.5, lo: 0.35, hi: 0.8, s: 0.05 }, glow: lavaGlow, haze: hzY(P, th.haze, 0.22, 0.4, 0.5, 0.8) })));
    put(mid, rb);
    // right: a cliff of basalt columns
    var bc = shapeCanvas(P, P.fm, W * 0.82, H * 0.4, W * 0.2, H * 0.62), bcx = bc.x, rc = rnd(19);
    for (var col = W * 0.83; col < W * 1.02; col += 14 * S) { var ch2 = H * (0.5 + rc() * 0.06 + Math.abs(col - W * 0.9) / W * 0.6); bcx.beginPath(); bcx.moveTo(col, H * 1.05); bcx.lineTo(col, ch2 + 3 * S); bcx.lineTo(col + 7 * S, ch2); bcx.lineTo(col + 14.5 * S, ch2 + 3 * S); bcx.lineTo(col + 14.5 * S, H * 1.05); bcx.fill(); }
    shadeShape(P, bc, lightOf(th, ext(M.rock, { scale: 0.03, stretch: 0.08, warp: 0.5, bump: 1.6, form: 8, round: 0.6, rim: 3, streak: 0.4, glow: lavaGlow,
      cap: { col: '#5f5752', amt: 0.55, lo: 0.4, hi: 0.8, s: 0.05 }, haze: hzY(P, th.haze, 0.25, 0.5, 0.45, 0.9) })));
    bcx.save(); bcx.globalCompositeOperation = 'source-atop'; bcx.strokeStyle = 'rgba(10,5,4,0.55)'; bcx.lineWidth = 1.2 * S;
    for (col = W * 0.83; col < W * 1.02; col += 14 * S) { bcx.beginPath(); bcx.moveTo(col, H * 0.4); bcx.lineTo(col, H); bcx.stroke(); }
    bcx.restore();
    put(mid, bc);
    // the lava lake: dark crust plates, glowing only in the seams between them and along the shore
    var ly = H * 0.875, lk = shapeCanvas(P, P.fm, 0, ly, W, H - ly), lid = lk.x;
    lid.fillStyle = '#fff'; lid.fillRect(0, ly, W, H - ly);
    var cv = lk.c, cxx = cv.getContext('2d'), imd = cxx.getImageData(0, 0, cv.width, cv.height), dd2 = imd.data, uu = 1 / lk.f;
    for (var yy = 0; yy < cv.height; yy++) for (var xx = 0; xx < cv.width; xx++) {
      var sxx = xx * uu, syy = ly + yy * uu, dep = (syy - ly) / (H - ly);
      var wv = n.fbm(sxx * 0.008 + n.fbm(sxx * 0.004, syy * 0.02, 2), syy * 0.03, 4), seam = Math.abs(wv - 0.5), hot = smooth(0.035, 0.0, seam) * (0.5 + 0.5 * n.v2(sxx * 0.01, syy * 0.05));
      var edge = Math.exp(-dep * 9) * 0.8, e2 = Math.min(1, hot + edge);
      var crust = 0.05 + n.fbm(sxx * 0.05, syy * 0.1, 3) * 0.08;
      var q = (yy * cv.width + xx) * 4;
      dd2[q] = (crust * 0.9 + e2 * 1.0) * 255; dd2[q + 1] = (crust * 0.55 + e2 * 0.42) * 255; dd2[q + 2] = (crust * 0.45 + e2 * 0.14) * 255; dd2[q + 3] = 255;
    }
    cxx.putImageData(imd, 0, 0);
    put(mid, lk);
    var mz = mid.x.createLinearGradient(0, H * 0.6, 0, H * 0.9);
    mz.addColorStop(0, 'rgba(90,40,26,0)'); mz.addColorStop(1, 'rgba(120,52,30,0.38)');
    mid.x.globalCompositeOperation = 'source-atop'; mid.x.fillStyle = mz; mid.x.fillRect(0, 0, W, H * 0.88); mid.x.globalCompositeOperation = 'source-over';
    var mouth = [(K.cranium[14][0] + K.lower[1][0]) / 2, (K.cranium[14][1] + K.lower[1][1]) / 2];
    return { mid: mid.c, land: { crater: [cx, peak + H * 0.02], lake: ly, mouth: mouth, S: S } };
  }

  // ─────────────── CRYSTAL: Frostfall Rift / Crystal Hollow ───────────────
  function crystalCluster(x, cx, cy, sz, dir, r, cols) {
    var shards = 3 + (r() * 4 | 0);
    for (var k = 0; k < shards; k++) {
      var a = dir + (r() - 0.5) * 1.1, L = sz * (0.45 + r() * 0.75), wd = sz * (0.1 + r() * 0.07);
      var ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L, nx = -Math.sin(a) * wd, ny = Math.cos(a) * wd, tx2 = ex + Math.cos(a) * wd * 1.6, ty2 = ey + Math.sin(a) * wd * 1.6;
      // two facets: one toward the light, one away; a bright edge between them
      x.fillStyle = cols[0]; poly(x, [[cx + nx, cy + ny], [ex + nx, ey + ny], [tx2, ty2], [ex, ey], [cx, cy]]);
      x.fillStyle = cols[1]; poly(x, [[cx - nx, cy - ny], [ex - nx, ey - ny], [tx2, ty2], [ex, ey], [cx, cy]]);
      x.strokeStyle = cols[2]; x.lineWidth = Math.max(0.6, wd * 0.18); x.beginPath(); x.moveTo(cx, cy); x.lineTo(ex, ey); x.lineTo(tx2, ty2); x.stroke();
    }
  }
  function paintCrystalV2(P) {
    var W = P.W, H = P.H, S = P.S, n = P.n, th = P.th, mid = newLayer(P, P.fm), M = th.mat, r = rnd(103), crystals = [];
    var hole = [W * 0.34, H * 0.0];
    var shaft = { c: [0.55, 0.78, 0.85], fn: function (sx, sy, nx, ny) { var d = Math.abs(sx - (hole[0] + sy * 0.12)) / (W * 0.1 + sy * 0.08); return Math.exp(-d * d) * 0.5 * Math.max(0.2, -ny + 0.4); } };
    // the cave vault: a ceiling of hanging rock with a split letting the daylight in, walls closing in on both sides
    var cv = shapeCanvas(P, P.fm, 0, 0, W, H), c = cv.x;
    c.beginPath(); c.moveTo(-10, -10); c.lineTo(W + 10, -10);
    for (var i = 0; i <= 90; i++) {
      var u = 1 - i / 90, xx = u * W, gap = Math.exp(-Math.pow((xx - hole[0]) / (W * 0.05), 2));
      var yy = H * (0.1 + n.fbm(u * 5, 3, 4) * 0.12 + Math.pow(Math.abs(u - 0.5) * 2, 3) * 0.2) * (1 - gap * 0.92);
      if (i % 4 === 1 && gap < 0.2 && r() < 0.8) { var tl = (30 + r() * 110) * S, tw = (8 + r() * 10) * S; c.lineTo(xx + tw, yy); c.lineTo(xx + tw * 0.25, yy + tl * 0.7); c.lineTo(xx, yy + tl); c.lineTo(xx - tw * 0.4, yy + tl * 0.5); c.lineTo(xx - tw, yy); }
      else c.lineTo(xx, yy);
    }
    c.closePath(); c.fill();
    poly(c, rough([[-10, -10], [W * 0.1, H * 0.12], [W * 0.13, H * 0.3], [W * 0.09, H * 0.5], [W * 0.12, H * 0.66], [W * 0.17, H * 0.78], [W * 0.15, H * 1.05], [-10, H * 1.05]], n, 9 * S, 16 * S, 2.2));
    poly(c, rough([[W + 10, -10], [W * 0.9, H * 0.14], [W * 0.86, H * 0.32], [W * 0.9, H * 0.48], [W * 0.87, H * 0.64], [W * 0.84, H * 0.8], [W * 0.86, H * 1.05], [W + 10, H * 1.05]], n, 9 * S, 16 * S, 4.4));
    shadeShape(P, cv, lightOf(th, ext(M.rock, { scale: 0.014, warp: 2.4, ridged: true, stretch: 0.6, bump: 1.3, form: 26, round: 1, rim: 6, cav: 4, streak: 0.4,
      cap: { col: '#9fb8c4', amt: 0.55, lo: 0.4, hi: 0.8, s: 0.04, depth: 12 }, glow: shaft, haze: hzY(P, th.haze, 0.28, 0.4, 0.1, 0.9) })));
    // the dragon's bones: a spine arching across the hollow, ribs hanging like the vault of a hall, the skull at rest
    var bn = shapeCanvas(P, P.fm, W * 0.05, H * 0.05, W * 0.85, H * 0.6), b = bn.x;
    var spine = bez([W * 0.3, H * 0.5], [W * 0.34, H * 0.08], [W * 0.66, H * 0.06], [W * 0.84, H * 0.36], 80);
    stamp(b, spine, 10 * S, 5 * S);
    for (i = 4; i < spine.length - 4; i += 3) { var p = spine[i], pn = spine[i + 1], ang = Math.atan2(pn[1] - p[1], pn[0] - p[0]); poly(b, [[p[0] - 4 * S, p[1]], [p[0] + Math.sin(ang) * 16 * S, p[1] - Math.cos(ang) * 16 * S], [p[0] + 4 * S, p[1]]]); }
    var ribs = [];
    for (i = 14; i < 66; i += 5) {
      var sp = spine[i], k2 = (i - 14) / 52, len = H * (0.2 + Math.sin(k2 * Math.PI) * 0.16), lean = (k2 - 0.5) * 0.5;
      var rb2 = bez(sp, [sp[0] + (24 + lean * 60) * S, sp[1] + len * 0.3], [sp[0] + (34 + lean * 110) * S, sp[1] + len * 0.75], [sp[0] + (6 + lean * 120) * S, sp[1] + len], 24);
      if (i % 3 === 1 && k2 > 0.3 && k2 < 0.8) rb2 = rb2.slice(0, 15);   // a few have snapped
      stamp(b, rb2, 6 * S, 2 * S); ribs.push(rb2);
    }
    var K = skullParts(W * 0.29, H * 0.53, W * 0.13, -1, 0.15);
    drawSkullMask(b, K, true);
    shadeShape(P, bn, lightOf(th, ext(M.bone, { scale: 0.05, warp: 1.2, bump: 0.6, form: 8, round: 1.5, rim: 4, cav: 4, streak: 0.3,
      cap: { col: '#b8d2dc', amt: 0.65, lo: 0.25, hi: 0.65, s: 0.06 }, glow: shaft, haze: hzY(P, th.haze, 0.38, 0.5, 0.05, 0.6) })));
    skullInterior(b, K, '#05080b', null);
    put(mid, cv);
    put(mid, bn);
    // a stony ledge under the skull, crystals rooted in it and on the bones
    var lg = shapeCanvas(P, P.fm, W * 0.05, H * 0.5, W * 0.34, H * 0.25);
    poly(lg.x, rough([[W * 0.08, H * 0.7], [W * 0.1, H * 0.57], [W * 0.17, H * 0.545], [W * 0.27, H * 0.55], [W * 0.34, H * 0.58], [W * 0.31, H * 0.66], [W * 0.22, H * 0.72]], n, 6 * S, 8 * S, 6.6));
    shadeShape(P, lg, lightOf(th, ext(M.rock, { scale: 0.03, warp: 2, ridged: true, bump: 1.3, form: 10, rim: 4, cap: { col: '#9fb8c4', amt: 0.6, lo: 0.4, hi: 0.8, s: 0.05, depth: 8 }, glow: shaft, haze: hzY(P, th.haze, 0.25, 0.35, 0.4, 0.8) })));
    put(mid, lg);
    var cx2 = mid.x, pal = [['#3f8f96', '#163c46', 'rgba(190,240,240,0.55)'], ['#58a3aa', '#1a4650', 'rgba(210,250,250,0.6)'], ['#6d6aa0', '#2a2850', 'rgba(210,200,255,0.45)']];
    var spots = [[W * 0.14, H * 0.555, -1.9, 26], [W * 0.31, H * 0.56, -1.3, 20], [W * 0.12, H * 0.62, -2.4, 14], [W * 0.88, H * 0.5, -2.2, 30], [W * 0.86, H * 0.7, -2.0, 22],
      [ribs[2][14][0], ribs[2][14][1], 1.2, 12], [ribs[6][12][0], ribs[6][12][1], 1.9, 10], [W * 0.1, H * 0.34, -0.2, 16], [W * 0.9, H * 0.24, Math.PI + 0.3, 18], [W * 0.5, H * 0.08, 1.6, 14]];
    spots.forEach(function (Sp, k3) {
      var cl = pal[k3 % 7 === 3 ? 2 : k3 % 2];
      cx2.save(); cx2.globalAlpha = 0.82; crystalCluster(cx2, Sp[0], Sp[1], Sp[3] * S, Sp[2], r, cl); cx2.restore();
      crystals.push([Sp[0], Sp[1], cl === pal[2] ? '#8a7cff' : '#5fd0d8', Sp[3] * S]);
    });
    var mz = mid.x.createLinearGradient(0, H * 0.45, 0, H);
    mz.addColorStop(0, 'rgba(20,46,56,0)'); mz.addColorStop(1, 'rgba(26,60,72,0.5)');
    mid.x.globalCompositeOperation = 'source-atop'; mid.x.fillStyle = mz; mid.x.fillRect(0, 0, W, H); mid.x.globalCompositeOperation = 'source-over';
    return { mid: mid.c, land: { crystals: crystals, hole: hole, S: S } };
  }

  // ─────────────── BLOSSOM: Training Grounds / Jade Terrace ───────────────
  function blossomTree(x, P, tx, ty, sz, r, lightLeft) {
    var S = P.S;
    x.strokeStyle = '#2a201d'; x.lineCap = 'round';
    var lim = [[tx, ty, tx + (r() - 0.5) * 20 * S, ty - sz * 0.6, 7]];
    lim.forEach(function (Lb) { x.lineWidth = Lb[4] * S; x.beginPath(); x.moveTo(Lb[0], Lb[1]); x.quadraticCurveTo(Lb[0] + 10 * S, (Lb[1] + Lb[3]) / 2, Lb[2], Lb[3]); x.stroke(); });
    var top = [lim[0][2], lim[0][3]];
    for (var b = 0; b < 4; b++) { var a = -Math.PI / 2 + (b - 1.5) * 0.55, L = sz * (0.35 + r() * 0.2); x.lineWidth = 3.2 * S; x.beginPath(); x.moveTo(top[0], top[1]); x.quadraticCurveTo(top[0] + Math.cos(a) * L * 0.4, top[1] + Math.sin(a) * L * 0.6, top[0] + Math.cos(a) * L, top[1] + Math.sin(a) * L * 0.7); x.stroke(); }
    // canopy: many small clusters, lit on the light side and dusky on the shade side
    for (var c = 0; c < 70; c++) {
      var ang = r() * TAU, rad = Math.sqrt(r()) * sz * 0.62, px = top[0] + Math.cos(ang) * rad * 1.3, py = top[1] - sz * 0.12 + Math.sin(ang) * rad * 0.62;
      var lit = clamp(0.5 + ((lightLeft ? -1 : 1) * (px - top[0]) / sz) * 0.9 - (py - top[1]) / sz * 0.8, 0, 1);
      var col = mix([118, 78, 96], [236, 196, 204], lit), rr = (4 + r() * 7) * S;
      x.fillStyle = rgba(col, 0.9); x.beginPath(); x.arc(px, py, rr, 0, TAU); x.fill();
    }
  }
  function paintBlossomV2(P) {
    var W = P.W, H = P.H, S = P.S, n = P.n, th = P.th, mid = newLayer(P, P.fm), M = th.mat, r = rnd(91), lanterns = [], i;
    // nearer karst pillars, half lost in the morning haze
    put(mid, paintRange2(P, { f: P.fm * 0.7, top: 0.86, amp: 0.36, freq: 7.5, seed: 37, warp: 0.8, lo: 0.35, hi: 0.95, sharp: 2.4, massifs: [],
      mat: lightOf(th, ext(M.rock, { scale: 0.02, stretch: 0.25, ridged: true, warp: 1, bump: 0.8, form: 26, round: 1.1, rim: 6,
        cap: { col: '#5e7454', amt: 0.6, lo: 0.3, hi: 0.7, s: 0.04, noise: 1 }, haze: hzY(P, th.haze, 0.45, 0.8, 0.45, 0.85) })) }));
    // left: a stone pillar with a guardian dragon coiled round it, head raised over the garden
    var pxc = W * 0.18, pb = H * 0.8, pt = H * 0.3, pw = 26 * S;
    var back = shapeCanvas(P, P.fm, pxc - 120 * S, pt - 140 * S, 240 * S, pb - pt + 160 * S), front = shapeCanvas(P, P.fm, back.bx, back.by, back.w, back.h), pil = shapeCanvas(P, P.fm, back.bx, back.by, back.w, back.h);
    poly(pil.x, [[pxc - pw - 16 * S, pb], [pxc - pw - 16 * S, pb - 22 * S], [pxc - pw, pb - 28 * S], [pxc - pw * 0.9, pt], [pxc - pw * 1.4, pt - 6 * S], [pxc - pw * 1.4, pt - 18 * S], [pxc + pw * 1.4, pt - 18 * S], [pxc + pw * 1.4, pt - 6 * S], [pxc + pw * 0.9, pt], [pxc + pw, pb - 28 * S], [pxc + pw + 16 * S, pb - 22 * S], [pxc + pw + 16 * S, pb]]);
    var turns = 2.25, body = [], ty0 = pb - 50 * S, ty1 = pt + 30 * S;
    for (i = 0; i <= 220; i++) { var t = i / 220, ang2 = t * turns * TAU + 0.8; body.push([pxc + Math.sin(ang2) * (pw + 12 * S), ty0 + (ty1 - ty0) * t, Math.cos(ang2), t]); }
    var rad = function (t) { return (12 - t * 3) * S; };
    for (i = 1; i < body.length; i++) { var bp = body[i], tgt = bp[2] >= 0 ? front.x : back.x; tgt.beginPath(); tgt.arc(bp[0], bp[1], rad(bp[3]), 0, TAU); tgt.fill(); }
    // the head: rising from the last coil, facing the arena
    var hb = body[body.length - 1], hx = hb[0], hy = hb[1], fx = front.x;
    stamp(fx, bez([hx, hy], [hx + 10 * S, hy - 30 * S], [hx + 6 * S, hy - 60 * S], [hx + 22 * S, hy - 78 * S], 20), 9 * S, 8 * S);
    var hx2 = hx + 22 * S, hy2 = hy - 78 * S;
    poly(fx, [[hx2 - 12 * S, hy2 - 6 * S], [hx2 + 4 * S, hy2 - 16 * S], [hx2 + 30 * S, hy2 - 10 * S], [hx2 + 46 * S, hy2 - 4 * S], [hx2 + 46 * S, hy2 + 2 * S], [hx2 + 30 * S, hy2 + 4 * S], [hx2 + 40 * S, hy2 + 12 * S], [hx2 + 20 * S, hy2 + 12 * S], [hx2 - 4 * S, hy2 + 12 * S]]);
    stamp(fx, bez([hx2 - 2 * S, hy2 - 12 * S], [hx2 - 14 * S, hy2 - 30 * S], [hx2 - 30 * S, hy2 - 34 * S], [hx2 - 42 * S, hy2 - 30 * S], 12), 3.5 * S, 0.8 * S);
    stamp(fx, bez([hx2 + 6 * S, hy2 - 14 * S], [hx2 + 2 * S, hy2 - 30 * S], [hx2 - 10 * S, hy2 - 38 * S], [hx2 - 22 * S, hy2 - 40 * S], 12), 3 * S, 0.7 * S);
    for (i = 30; i < body.length; i += 9) { var sp2 = body[i]; if (sp2[2] < 0) continue; poly(fx, [[sp2[0] - 4 * S, sp2[1] - rad(sp2[3]) + 2 * S], [sp2[0] - 1 * S, sp2[1] - rad(sp2[3]) - 7 * S], [sp2[0] + 4 * S, sp2[1] - rad(sp2[3]) + 2 * S]]); }
    var stoneM = lightOf(th, ext(M.stone, { scale: 0.05, warp: 1.2, bump: 0.6, form: 10, round: 1.6, rim: 5, cav: 4, streak: 0.4, stain: ['#55604a', 0.4],
      cap: { col: '#56704a', amt: 0.65, lo: 0.25, hi: 0.6, s: 0.06 }, haze: hzY(P, th.haze, 0.3, 0.42, 0.2, 0.8) }));
    shadeShape(P, back, ext(stoneM, { haze: hzY(P, th.haze, 0.42, 0.5, 0.2, 0.8) })); shadeShape(P, pil, ext(stoneM, { form: 22, round: 1.2, strata: { f: 0.35, a: 0.4, warp: 3 } })); shadeShape(P, front, stoneM);
    // whiskers, drawn after shading, thin and dark
    fx.strokeStyle = 'rgba(40,40,38,0.8)'; fx.lineWidth = 1.4 * S;
    fx.beginPath(); fx.moveTo(hx2 + 40 * S, hy2 + 4 * S); fx.bezierCurveTo(hx2 + 60 * S, hy2 + 10 * S, hx2 + 64 * S, hy2 + 30 * S, hx2 + 80 * S, hy2 + 34 * S); fx.stroke();
    fx.beginPath(); fx.moveTo(hx2 + 36 * S, hy2 - 2 * S); fx.bezierCurveTo(hx2 + 54 * S, hy2 - 12 * S, hx2 + 70 * S, hy2 - 2 * S, hx2 + 82 * S, hy2 - 10 * S); fx.stroke();
    fx.fillStyle = 'rgba(20,16,14,0.85)'; fx.beginPath(); fx.ellipse(hx2 + 16 * S, hy2 - 6 * S, 3 * S, 2 * S, 0, 0, TAU); fx.fill();
    put(mid, back); put(mid, pil); put(mid, front);
    // right: a pagoda on a rock terrace
    var gx = W * 0.8, gy = H * 0.72, pg = shapeCanvas(P, P.fm, gx - 200 * S, gy - 420 * S, 400 * S, 520 * S), g = pg.x;
    var rock = shapeCanvas(P, P.fm, gx - 260 * S, gy - 30 * S, 520 * S, H - gy + 40 * S);
    poly(rock.x, rough([[gx - 240 * S, H + 10], [gx - 210 * S, gy + 10 * S], [gx - 120 * S, gy - 4 * S], [gx + 150 * S, gy - 2 * S], [gx + 230 * S, gy + 20 * S], [gx + 250 * S, H + 10]], n, 8 * S, 9 * S, 1.7));
    shadeShape(P, rock, lightOf(th, ext(M.rock, { scale: 0.03, warp: 2, ridged: true, bump: 1.2, form: 14, rim: 5, cap: { col: '#5e7454', amt: 0.7, lo: 0.3, hi: 0.7, s: 0.05, depth: 12 }, haze: hzY(P, th.haze, 0.3, 0.5, 0.6, 0.95) })));
    put(mid, rock);
    var y = gy - 8 * S;
    g.fillStyle = '#7d7468'; g.fillRect(gx - 130 * S, y, 260 * S, 14 * S);
    for (var tier = 0; tier < 5; tier++) {
      var bw2 = (100 - tier * 15) * S, bh2 = (50 - tier * 4) * S;
      var wall = g.createLinearGradient(gx - bw2, 0, gx + bw2, 0); wall.addColorStop(0, '#8a4a3c'); wall.addColorStop(0.5, '#6e3a30'); wall.addColorStop(1, '#3e2420');
      g.fillStyle = wall; g.fillRect(gx - bw2 * 0.78, y - bh2, bw2 * 1.56, bh2);
      g.fillStyle = 'rgba(20,12,10,0.6)'; for (var post = -2; post <= 2; post++) g.fillRect(gx + post * bw2 * 0.36 - 2 * S, y - bh2, 4 * S, bh2);
      g.fillStyle = 'rgba(255,214,150,0.35)'; for (var wdw = -1; wdw <= 1; wdw += 2) g.fillRect(gx + wdw * bw2 * 0.18 - 5 * S, y - bh2 * 0.72, 10 * S, bh2 * 0.42);
      y -= bh2;
      var rw = bw2 * 1.36, rh = 20 * S;
      var roof = g.createLinearGradient(0, y - rh * 0.6, 0, y + 6 * S); roof.addColorStop(0, '#5a6466'); roof.addColorStop(0.5, '#343c40'); roof.addColorStop(1, '#1c2124');
      g.fillStyle = roof;
      g.beginPath(); g.moveTo(gx - rw, y + 4 * S); g.quadraticCurveTo(gx - rw * 0.6, y - rh * 0.2, gx - rw * 0.55, y - rh * 0.6); g.lineTo(gx + rw * 0.55, y - rh * 0.6);
      g.quadraticCurveTo(gx + rw * 0.6, y - rh * 0.2, gx + rw, y + 4 * S); g.quadraticCurveTo(gx + rw * 1.05, y - 6 * S, gx + rw * 1.12, y - 11 * S); g.lineTo(gx + rw * 0.9, y + 6 * S);
      g.lineTo(gx - rw * 0.9, y + 6 * S); g.lineTo(gx - rw * 1.12, y - 11 * S); g.quadraticCurveTo(gx - rw * 1.05, y - 6 * S, gx - rw, y + 4 * S); g.fill();
      g.fillStyle = 'rgba(235,225,205,0.35)'; g.fillRect(gx - rw * 0.55, y - rh * 0.6, rw * 0.6, 1.6 * S);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(gx - rw * 0.9, y + 6 * S, rw * 1.8, 3 * S);
      lanterns.push([gx - rw * 0.95, y + 12 * S], [gx + rw * 0.95, y + 12 * S]);
      y -= rh * 0.6;
    }
    g.fillStyle = '#7a6a48'; g.fillRect(gx - 2 * S, y - 60 * S, 4 * S, 60 * S);
    for (var ring = 0; ring < 6; ring++) g.fillRect(gx - (7 - ring * 0.6) * S, y - 12 * S - ring * 8 * S, (14 - ring * 1.2) * S, 2.6 * S);
    g.globalCompositeOperation = 'source-atop'; var ph = g.createLinearGradient(0, gy - 400 * S, 0, gy); ph.addColorStop(0, rgba(hex(th.haze), 0.32)); ph.addColorStop(1, rgba(hex(th.haze), 0.2)); g.fillStyle = ph; g.fillRect(gx - 200 * S, gy - 420 * S, 400 * S, 520 * S); g.globalCompositeOperation = 'source-over';
    put(mid, pg);
    // cherry trees and a soft line of garden trees
    [[W * 0.3, H * 0.83, 120], [W * 0.66, H * 0.8, 100], [W * 0.95, H * 0.78, 130], [W * 0.05, H * 0.82, 110]].forEach(function (T) { blossomTree(mid.x, P, T[0], T[1], T[2] * S, r, true); });
    var mz = mid.x.createLinearGradient(0, H * 0.55, 0, H);
    mz.addColorStop(0, rgba(hex(th.haze), 0)); mz.addColorStop(1, rgba(hex(th.haze), 0.45));
    mid.x.globalCompositeOperation = 'source-atop'; mid.x.fillStyle = mz; mid.x.fillRect(0, 0, W, H); mid.x.globalCompositeOperation = 'source-over';
    return { mid: mid.c, land: { lanterns: lanterns, S: S } };
  }

  // ─────────────── ARENA: Dragon Colosseum ───────────────
  /** A dragon statue perched on a plinth, wings half open (scene units; facing +1 right / -1 left). */
  function perchedDragon(x, bx, by, s, face) {
    function T(p) { return [bx + p[0] * s * face, by + p[1] * s]; }
    poly(x, [[-0.5, 0], [-0.5, -0.12], [-0.42, -0.16], [0.42, -0.16], [0.5, -0.12], [0.5, 0]].map(T));                        // plinth
    poly(x, [[-0.36, -0.16], [-0.38, -0.3], [-0.2, -0.46], [0.08, -0.5], [0.22, -0.42], [0.3, -0.28], [0.34, -0.16]].map(T));   // haunches and chest
    stamp(x, bez([0.12, -0.44], [0.26, -0.62], [0.12, -0.8], [0.3, -0.92], 24).map(T), 0.085 * s, 0.05 * s);                  // neck
    poly(x, [[0.26, -0.96], [0.36, -1.0], [0.52, -0.95], [0.6, -0.9], [0.58, -0.86], [0.46, -0.86], [0.36, -0.84], [0.28, -0.86]].map(T)); // head
    stamp(x, bez([0.3, -0.98], [0.22, -1.08], [0.12, -1.1], [0.04, -1.06], 12).map(T), 0.025 * s, 0.006 * s);                 // horns
    stamp(x, bez([0.34, -0.99], [0.3, -1.1], [0.22, -1.16], [0.14, -1.16], 12).map(T), 0.02 * s, 0.005 * s);
    stamp(x, bez([0.24, -0.2], [0.34, -0.06], [0.2, -0.02], [0.3, -0.18], 10).map(T), 0.04 * s, 0.03 * s);                   // fore leg
    stamp(x, bez([-0.34, -0.18], [-0.6, -0.12], [-0.7, -0.3], [-0.56, -0.42], 20).map(T), 0.05 * s, 0.012 * s);               // tail curling up
    // wing: arm up and back, fingers fanning down, a scalloped membrane between them
    var sh = [-0.02, -0.46], wr = [-0.3, -1.02], tips = [[-0.86, -0.82], [-0.82, -0.52], [-0.62, -0.3], [-0.34, -0.36]];
    var mem = [sh, wr]; tips.forEach(function (tp, k) { if (k) { var prev = tips[k - 1]; mem.push([(prev[0] + tp[0]) / 2 + 0.05, (prev[1] + tp[1]) / 2 + 0.02]); } mem.push(tp); });
    mem.push([-0.12, -0.4]); poly(x, mem.map(T));
    stamp(x, [sh, [-0.14, -0.8], wr].map(T), 0.04 * s, 0.025 * s);
    tips.forEach(function (tp) { stamp(x, [wr, tp].map(T), 0.018 * s, 0.006 * s); });
  }
  function paintArenaV2(P) {
    var W = P.W, H = P.H, S = P.S, n = P.n, th = P.th, mid = newLayer(P, P.fm), M = th.mat, stands = [], tiers = [];
    var top = H * 0.4, bot = H * 0.8;
    var cs = shapeCanvas(P, P.fm, 0, top - 30 * S, W, H - top + 30 * S), c = cs.x;
    for (var tier = 0; tier < 3; tier++) {
      var y0 = top + tier * (bot - top) / 3, y1 = y0 + (bot - top) / 3, curve = H * 0.03 * (2 - tier);
      c.beginPath(); c.moveTo(-10, y1 + curve); c.quadraticCurveTo(W / 2, y1 - curve, W + 10, y1 + curve); c.lineTo(W + 10, y0 + curve); c.quadraticCurveTo(W / 2, y0 - curve, -10, y0 + curve); c.fill();
      tiers.push([y0, y1, curve]);
      stands.push({ y: y0 + 4 * S, curve: curve, h: (y1 - y0) * 0.22 });
    }
    c.fillRect(0, bot - 2, W, H - bot + 2);
    // cut the arcades so the shading bevels every arch
    var arches = [];
    c.globalCompositeOperation = 'destination-out';
    tiers.forEach(function (T, ti) {
      var y0 = T[0], y1 = T[1], curve = T[2], aw = (50 - ti * 4) * S, ah = (y1 - y0) * 0.58;
      for (var ax = aw * 0.3; ax < W; ax += aw * 1.42) {
        var uu = (ax + aw / 2) / W, yc = y0 + curve * (1 - 8 * uu * (1 - uu)) * 0.5 + (y1 - y0) * 0.3;
        c.beginPath(); c.moveTo(ax, yc + ah); c.lineTo(ax, yc + aw * 0.5); c.arc(ax + aw / 2, yc + aw * 0.5, aw / 2, Math.PI, 0); c.lineTo(ax + aw, yc + ah); c.fill();
        arches.push([ax, yc, aw, ah]);
      }
    });
    c.globalCompositeOperation = 'source-over';
    shadeShape(P, cs, lightOf(th, ext(M.stone, { scale: 0.03, warp: 1, bump: 0.6, form: 6, round: 1.3, rim: 4, cav: 4, streak: 0.45, stain: ['#6a5a48', 0.3],
      strata: { f: 0.42, a: 0.45, warp: 3 }, haze: hzY(P, th.haze, 0.3, 0.12, 0.35, 0.85) })));
    // dark arcade interiors, a little warm light bouncing deep inside
    c.save(); c.globalCompositeOperation = 'destination-over';
    arches.forEach(function (A) { var gr = c.createLinearGradient(0, A[1], 0, A[1] + A[3]); gr.addColorStop(0, '#1a1210'); gr.addColorStop(1, '#3a2a1e'); c.fillStyle = gr; c.fillRect(A[0] - 2, A[1] - 2, A[2] + 4, A[3] + 4); });
    c.restore();
    // cornice lines: a lit lip and a shadow under each
    tiers.forEach(function (T) {
      c.strokeStyle = 'rgba(255,226,180,0.35)'; c.lineWidth = 2 * S; c.beginPath(); c.moveTo(-10, T[0] + T[2] + 1); c.quadraticCurveTo(W / 2, T[0] - T[2] + 1, W + 10, T[0] + T[2] + 1); c.stroke();
      c.strokeStyle = 'rgba(30,18,10,0.35)'; c.lineWidth = 4 * S; c.beginPath(); c.moveTo(-10, T[0] + T[2] + 5 * S); c.quadraticCurveTo(W / 2, T[0] - T[2] + 5 * S, W + 10, T[0] + T[2] + 5 * S); c.stroke();
    });
    // banners: faded cloth hanging from the top rim, folds shaded
    var cols = ['#7a2a22', '#2c5a5c', '#8a6a34', '#5a2a2a', '#2a4a5e'], rr = rnd(13);
    for (var b = 0; b < 8; b++) {
      var bx = W * (0.08 + b * 0.12 + (rr() - 0.5) * 0.02), uu2 = bx / W, byy = top + H * 0.03 * 2 * (1 - 8 * uu2 * (1 - uu2)) * 0.5 - 4 * S, bwid = 22 * S, bh = (62 + rr() * 16) * S;
      var gr2 = c.createLinearGradient(bx, 0, bx + bwid, 0), base = hex(cols[b % 5]);
      gr2.addColorStop(0, rgba(mix(base, [255, 230, 190], 0.15), 1)); gr2.addColorStop(0.3, rgba(base, 1)); gr2.addColorStop(0.55, rgba(mix(base, [0, 0, 0], 0.35), 1)); gr2.addColorStop(0.8, rgba(base, 1)); gr2.addColorStop(1, rgba(mix(base, [0, 0, 0], 0.45), 1));
      c.fillStyle = gr2; c.beginPath(); c.moveTo(bx, byy); c.lineTo(bx + bwid, byy); c.lineTo(bx + bwid, byy + bh); c.lineTo(bx + bwid / 2, byy + bh - 10 * S); c.lineTo(bx, byy + bh); c.fill();
      c.fillStyle = 'rgba(200,160,90,0.55)'; c.beginPath(); c.arc(bx + bwid / 2, byy + 22 * S, 5 * S, 0, TAU); c.fill();
      c.fillStyle = 'rgba(40,26,14,0.8)'; c.fillRect(bx - 3 * S, byy - 2 * S, bwid + 6 * S, 3 * S);
    }
    // the arena wall: big dressed blocks
    c.fillStyle = 'rgba(30,18,10,0.35)'; c.fillRect(0, bot, W, H - bot);
    c.strokeStyle = 'rgba(20,12,6,0.45)'; c.lineWidth = 1.4 * S;
    for (var row = 0; row < 4; row++) { var ry = bot + row * 26 * S; c.beginPath(); c.moveTo(0, ry); c.lineTo(W, ry); c.stroke(); for (var jx = (row % 2) * 40 * S; jx < W; jx += 80 * S) { c.beginPath(); c.moveTo(jx, ry); c.lineTo(jx, ry + 26 * S); c.stroke(); } }
    c.fillStyle = 'rgba(255,220,170,0.3)'; c.fillRect(0, bot, W, 2 * S);
    put(mid, cs);
    // the champion's statue: an old bronze dragon over the arcades, green where the rain runs
    var ds = shapeCanvas(P, P.fm, W * 0.16, H * 0.02, W * 0.26, H * 0.42);
    perchedDragon(ds.x, W * 0.3, top + 6 * S, H * 0.28, 1);
    shadeShape(P, ds, lightOf(th, ext(M.bronze, { scale: 0.06, warp: 1, bump: 0.5, form: 8, round: 1.5, rim: 4, cav: 3, spec: { p: 16, a: 0.8 }, streak: 0.4,
      cap: { col: '#4f7a6c', amt: 0.6, lo: 0.15, hi: 0.6, s: 0.06 }, haze: hzY(P, th.haze, 0.22, 0.3, 0.1, 0.5) })));
    put(mid, ds);
    return { mid: mid.c, land: { stands: stands, S: S } };
  }

  // ─────────────── REEF: Sunken Shrine ───────────────
  function paintReefV2(P) {
    var W = P.W, H = P.H, S = P.S, n = P.n, th = P.th, mid = newLayer(P, P.fm), M = th.mat, r = rnd(109);
    var caust = { c: [0.4, 0.75, 0.72], fn: function (sx, sy, nx, ny) { var k = Math.max(0, -ny); var cc = Math.abs(n.fbm(sx * 0.02, sy * 0.02 + 7, 3) - 0.5); return k * smooth(0.06, 0.0, cc) * 0.6; } };
    var gy = H * 0.8;
    // sea floor and a far shelf of rock
    put(mid, paintRange2(P, { f: P.fm * 0.7, top: 0.82, amp: 0.16, freq: 3.4, seed: 47, warp: 1.4, lo: 0.25, hi: 0.95, sharp: 1.4, massifs: [[0.86, 0.08, 0.1]],
      mat: lightOf(th, ext(M.rock, { scale: 0.014, stretch: 0.8, ridged: true, warp: 1.2, bump: 0.8, form: 26, round: 1, rim: 6, glow: caust, haze: hzY(P, th.haze, 0.5, 0.7, 0.55, 0.9) })) }));
    // the gate: a great carved dragon head, jaws open on the temple's dark doorway
    var gt = shapeCanvas(P, P.fm, W * 0.02, H * 0.22, W * 0.46, H * 0.66), g = gt.x;
    var K = skullParts(W * 0.1, H * 0.5, W * 0.3, 1, 0.5);
    drawSkullMask(g, K, true);
    poly(g, [[W * 0.05, gy + 40 * S], [W * 0.07, H * 0.56], [W * 0.15, H * 0.6], [W * 0.38, H * 0.66], [W * 0.43, gy + 40 * S]]);   // the plinth it rises from
    shadeShape(P, gt, lightOf(th, ext(M.stone, { scale: 0.03, warp: 1.6, bump: 0.8, form: 18, round: 1.3, rim: 5, cav: 5, streak: 0.3, stain: ['#3a5a4a', 0.5],
      cap: { col: '#4a7a5e', amt: 0.6, lo: 0.2, hi: 0.6, s: 0.05 }, glow: caust, haze: hzY(P, th.haze, 0.32, 0.45, 0.3, 0.85) })));
    skullInterior(g, K, '#04161c', null);
    put(mid, gt);
    // right: the colonnade, some columns snapped, a fallen pediment
    var cl = shapeCanvas(P, P.fm, W * 0.5, H * 0.3, W * 0.5, H * 0.62), cx = cl.x;
    for (var col = 0; col < 6; col++) {
      var px = W * (0.56 + col * 0.075), ch = (230 - (col % 3 === 1 ? 120 : 0) - r() * 30) * S, cw = 22 * S;
      cx.fillRect(px - cw / 2, gy - ch, cw, ch); cx.fillRect(px - cw * 0.78, gy - ch - 9 * S, cw * 1.56, 9 * S); cx.fillRect(px - cw * 0.8, gy - 10 * S, cw * 1.6, 10 * S);
      if (col % 3 === 1) poly(cx, [[px - cw / 2, gy - ch], [px - cw * 0.1, gy - ch - 16 * S], [px + cw / 2, gy - ch - 5 * S]]);
    }
    poly(cx, [[W * 0.6, gy - 240 * S], [W * 0.7, gy - 300 * S], [W * 0.8, gy - 246 * S], [W * 0.8, gy - 234 * S], [W * 0.6, gy - 228 * S]]);
    poly(cx, [[W * 0.84, gy + 6 * S], [W * 0.86, gy - 30 * S], [W * 0.95, gy - 46 * S], [W * 0.97, gy - 18 * S], [W * 0.99, gy + 6 * S]]);
    shadeShape(P, cl, lightOf(th, ext(M.stone, { scale: 0.035, warp: 1.2, bump: 0.6, form: 8, round: 1.5, rim: 4, cav: 4, streak: 0.35, stain: ['#3a5a4a', 0.5],
      strata: { f: 0.3, a: 0.35, warp: 2 }, cap: { col: '#4a7a5e', amt: 0.55, lo: 0.25, hi: 0.65, s: 0.05 }, glow: caust, haze: hzY(P, th.haze, 0.38, 0.5, 0.3, 0.85) })));
    put(mid, cl);
    // the sand floor in front of it all, with soft ripples
    var fl = shapeCanvas(P, P.fm, 0, gy - 30 * S, W, H - gy + 30 * S);
    fl.x.beginPath(); fl.x.moveTo(-10, H + 10); for (var i = 0; i <= 60; i++) fl.x.lineTo(W * i / 60, gy + (n.fbm(i * 0.25, 2, 3) - 0.5) * 34 * S); fl.x.lineTo(W + 10, H + 10); fl.x.fill();
    shadeShape(P, fl, lightOf(th, ext(M.sand, { scale: 0.02, stretch: 5, bump: 0.5, form: 12, round: 1, rim: 0, glow: caust, haze: hzY(P, th.haze, 0.3, 0.45, 0.75, 1) })));
    put(mid, fl);
    // coral and anemones on the ruins, in muted dusty colours
    var cc = ['#a0584e', '#a87a46', '#8a4a6a', '#6a8a5a'], mx = mid.x;
    for (var co = 0; co < 26; co++) {
      var bx = r() * W, by = gy + (r() - 0.6) * 18 * S, ccol = cc[co % 4];
      mx.strokeStyle = ccol; mx.lineWidth = 2.6 * S; mx.lineCap = 'round'; mx.globalAlpha = 0.7;
      for (var brn = 0; brn < 4; brn++) { var a = -Math.PI / 2 + (r() - 0.5) * 1.6, L = (8 + r() * 18) * S; mx.beginPath(); mx.moveTo(bx, by); mx.quadraticCurveTo(bx + Math.cos(a) * L * 0.5 + 3, by + Math.sin(a) * L * 0.5, bx + Math.cos(a) * L, by + Math.sin(a) * L); mx.stroke(); }
    }
    mx.globalAlpha = 1;
    var eye = K.eye;
    return { mid: mid.c, land: { eye: eye, S: S } };
  }

  var PAINT2 = { tower: paintStorm, volcano: paintVolcanoV2, geode: paintCrystalV2, pagoda: paintBlossomV2, colosseum: paintArenaV2, temple: paintReefV2 };


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

  // ─────────────── platforms of the painted arenas: a bevelled masonry lip on a lit crag ───────────────
  // The walkable top is exactly the collision rectangle's top edge; the lip spans exactly its width. Main floors are
  // thick (a cap course, a foundation course, then rock); drop-through ledges are a thin slab on a shallow keel.
  var PLAT = {
    storm: { stone: ['#1e2127', '#545964', '#9aa2ae'], rock: ['#101216', '#363a42', '#6c727c'], deco: 'storm' },
    volcano: { stone: ['#120e0d', '#3e3633', '#7a6c62'], rock: ['#0a0707', '#28211f', '#564a44'], deco: 'volcano' },
    crystal: { stone: ['#0b1115', '#31424a', '#6e8a94'], rock: ['#05080a', '#1b272d', '#465a62'], deco: 'crystal' },
    blossom: { stone: ['#2a2824', '#7a7568', '#bdb6a0'], rock: ['#1a1c17', '#4a4c42', '#868674'], deco: 'blossom' },
    arena: { stone: ['#2a1e14', '#8c6e50', '#d2b28a'], rock: ['#24180f', '#644a34', '#a2845e'], deco: 'arena' },
    reef: { stone: ['#0f1e1e', '#4c6864', '#94b2a8'], rock: ['#07141a', '#223e46', '#527680'], deco: 'reef' },
  };
  function boost(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
  /** Per-pixel dressed stone: staggered blocks with lit/shadowed bevels, mortar gaps that widen where chipped, pits, stains. */
  function masonry(d, cw, chh, R, OX, OY, rect, rows, bw0, mat, th, n, seed, opts) {
    var rx = rect[0], ry = rect[1], rw = rect[2], rh = rect[3], r = rnd(seed), joints = [], row;
    for (row = 0; row < rows; row++) { var xx = rx - (row % 2 ? bw0 * 0.5 : r() * bw0 * 0.4), js = [xx]; while (xx < rx + rw) { xx += bw0 * (0.6 + r() * 0.8); js.push(xx); } joints.push(js); }
    var dk = f01(mat[0]), bs = f01(mat[1]), lt = f01(mat[2]);
    var L = th.L, ll = Math.sqrt(L[0] * L[0] + L[1] * L[1] + L[2] * L[2]), lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
    var key = boost(th.key, opts.keyK || 1.15), amb = boost(th.amb, opts.ambK || 1.2), rowH = rh / rows, topF = opts.top || 0, rad = opts.round || 2.5;
    var px0 = Math.max(0, Math.floor(OX + rx * R)), px1 = Math.min(cw, Math.ceil(OX + (rx + rw) * R)), py0 = Math.max(0, Math.floor(OY + ry * R)), py1 = Math.min(chh, Math.ceil(OY + (ry + rh) * R));
    for (var py = py0; py < py1; py++) for (var px = px0; px < px1; px++) {
      var u = (px + 0.5 - OX) / R, v = (py + 0.5 - OY) / R, lu = u - rx, lv = v - ry;
      var endD = Math.min(lu, rx + rw - u), vd = Math.min(lv, rh - lv);
      if (endD < rad && vd < rad) { var ex = rad - endD, ey = rad - vd; if (ex * ex + ey * ey > rad * rad * (0.7 + n.v2(u * 0.6, v * 0.6) * 0.5)) continue; }
      row = Math.min(rows - 1, Math.floor(lv / rowH));
      var fy = lv - row * rowH, js2 = joints[row], bi = 0;
      while (bi < js2.length - 2 && js2[bi + 1] < u) bi++;
      var dl = u - js2[bi], dr = js2[bi + 1] - u, dt = fy, db = rowH - fy;
      var hs = (((row + 1) * 73856093) ^ ((bi + 1) * 19349663) ^ seed) >>> 0; hs = (hs * 1664525 + 1013904223) >>> 0;
      var tone = 0.86 + (hs / 4294967296) * 0.28, gx = u + seed * 0.37, gy = v;
      var nn = n.fbm(gx * 0.08, gy * 0.11, 4), t = clamp((nn - 0.5) * 2.2 + 0.5, 0, 1), q, ar, ag, ab;
      if (t < 0.5) { q = t * 2; ar = dk[0] + (bs[0] - dk[0]) * q; ag = dk[1] + (bs[1] - dk[1]) * q; ab = dk[2] + (bs[2] - dk[2]) * q; }
      else { q = (t - 0.5) * 2; ar = bs[0] + (lt[0] - bs[0]) * q; ag = bs[1] + (lt[1] - bs[1]) * q; ab = bs[2] + (lt[2] - bs[2]) * q; }
      ar *= tone; ag *= tone; ab *= tone;
      var pit = n.v2(gx * 0.8, gy * 0.8); if (pit > 0.76) { var pk = 1 - (pit - 0.76) * 2.4; ar *= pk; ag *= pk; ab *= pk; }
      var sk = 1 - (opts.streak || 0.25) * smooth(0.48, 0.7, n.fbm(gx * 0.18, gy * 0.025 + 5, 2)) * clamp(lv / rh + 0.2, 0, 1); ar *= sk; ag *= sk; ab *= sk;
      var cn = n.fbm(gx * 0.3, gy * 0.3, 2), jw = 0.5 + Math.max(0, cn - 0.58) * 7, e = Math.min(dl, dr, dt, db), diff;
      if (row === 0 && lv < topF) {
        // the walking surface, seen just from above: it catches the key light and stays the brightest edge on screen
        diff = Math.max(0, -ly) * 0.9 + 0.35 + (1 - lv / topF) * 0.25;
        if (dl < jw * 0.7 || dr < jw * 0.7) diff *= 0.55;
      } else if (e < jw) {
        diff = 0.05; ar *= 0.55; ag *= 0.55; ab *= 0.55;
      } else {
        var bev = opts.bevel || 2.2, b = 0;
        if (dt < bev) b += (1 - dt / bev) * Math.max(0.15, -ly) * 0.7;
        if (db < bev) b -= (1 - db / bev) * 0.5;
        if (dl < bev) b += (1 - dl / bev) * (-lx) * 0.55;
        if (dr < bev) b += (1 - dr / bev) * lx * 0.55;
        diff = Math.max(0, lz * 0.82 + b);
      }
      var ao = 1 - (opts.ao || 0.3) * clamp((lv - topF) / (rh - topF), 0, 1);
      var cr = ar * (amb[0] + key[0] * diff) * ao, cg = ag * (amb[1] + key[1] * diff) * ao, cb = ab * (amb[2] + key[2] * diff) * ao;
      var k = (py * cw + px) * 4;
      d[k] = cr > 1 ? 255 : cr * 255; d[k + 1] = cg > 1 ? 255 : cg * 255; d[k + 2] = cb > 1 ? 255 : cb * 255; d[k + 3] = 255;
    }
  }

  function platformSprite2(p, th, theme, idx) {
    var R = 2, PM = PLAT[theme] || PLAT.storm, soft = !p.solid, padX = 26, padT = 12, n = Noise(500 + idx * 13), r = rnd(900 + idx);
    if (p.wall) return wallSprite2(p, th, PM, idx, n);
    var lip = soft ? 10 : p.altar ? 18 : (p.w > 400 ? 24 : 20);
    var depth = soft ? 32 : p.altar ? p.h + 2 : p.h + 64;
    var w = Math.round((p.w + padX * 2) * R), h = Math.round((padT + depth + 10) * R);
    var c = canvas(w, h), x = c.getContext('2d'), OX = padX * R, OY = padT * R;
    var body = canvas(w, h), bx = body.getContext('2d'); bx.setTransform(R, 0, 0, R, OX, OY); bx.fillStyle = '#fff';
    var s, t, pts;
    if (soft) {
      // a shallow keel under a thin slab: reads as a ledge you can drop through, not a block
      pts = [[5, lip - 1], [p.w - 5, lip - 1]];
      for (s = 0; s <= 18; s++) { t = s / 18; pts.push([p.w - 9 - t * (p.w - 18), lip + 2 + Math.pow(Math.sin(t * Math.PI), 0.9) * 15 * (0.6 + n.fbm(t * 5, 2.2, 3) * 0.8)]); }
      poly(bx, rough(pts, n, 4, 2, idx));
    } else if (p.altar) {
      bx.fillRect(-7, p.h - 16, p.w + 14, 18);
      bx.fillRect(-3, lip, p.w + 6, p.h - lip - 14);
    } else {
      var inset = Math.min(30, p.w * 0.07), steps = Math.max(14, Math.round(p.w / 16));
      pts = [[inset, lip + 10], [p.w - inset, lip + 10]];
      for (s = 0; s <= steps; s++) {
        t = s / steps;
        var taper = Math.pow(Math.sin(t * Math.PI), 0.65), yy = lip + 22 + taper * (depth - lip - 22) * (0.62 + n.fbm(t * 7, 4.4, 3) * 0.7);
        if (r() < 0.15) yy += r() * 26;
        pts.push([p.w - inset - t * (p.w - inset * 2), yy]);
      }
      poly(bx, rough(pts, n, 6, 4, idx * 3.1));
    }
    shadeMask(body, n, ext(lightOf(th), { dark: PM.rock[0], base: PM.rock[1], light: PM.rock[2], unit: 1 / R, ox: -padX + idx * 517, oy: -padT, key: boost(th.key, 1.1), amb: boost(th.amb, 1.1),
      scale: 0.04, warp: 2, ridged: true, stretch: 0.7, bump: 1.1, form: 7, round: 1, rim: 2.5, cav: 4, streak: 0.35, strata: { f: 0.3, a: 0.5, warp: 10 } }));
    // occlusion under the lip and toward the underside
    bx.globalCompositeOperation = 'source-atop';
    var ag = bx.createLinearGradient(0, lip - 2, 0, lip + (soft ? 10 : 26)); ag.addColorStop(0, 'rgba(0,0,0,0.7)'); ag.addColorStop(1, 'rgba(0,0,0,0)');
    bx.fillStyle = ag; bx.fillRect(-padX, -padT, p.w + padX * 2, depth + padT);
    var ug = bx.createLinearGradient(0, depth * 0.45, 0, depth + 4); ug.addColorStop(0, 'rgba(0,0,0,0)'); ug.addColorStop(1, 'rgba(0,0,0,0.5)');
    bx.fillStyle = ug; bx.fillRect(-padX, -padT, p.w + padX * 2, depth + padT + 10);
    bx.globalCompositeOperation = 'source-over';
    x.drawImage(body, 0, 0);
    // dressed stone: foundation course, then the cap course whose top is the floor
    var id = x.getImageData(0, 0, w, h), d = id.data;
    if (!soft && !p.altar) masonry(d, w, h, R, OX, OY, [5, lip - 1, p.w - 10, 13], 1, 26, PM.stone, th, n, 31 + idx, { top: 0, ao: 0.45, bevel: 1.6, keyK: 0.9, ambK: 1, round: 1.5 });
    if (p.altar) masonry(d, w, h, R, OX, OY, [-3, lip, p.w + 6, p.h - lip - 14], 2, 34, PM.stone, th, n, 41 + idx, { top: 0, ao: 0.35, bevel: 2 });
    masonry(d, w, h, R, OX, OY, [-1, 0, p.w + 2, lip], 1, soft ? 46 : 64, PM.stone, th, n, 7 + idx * 5, { top: soft ? 2.6 : 3.4, ao: 0.32, bevel: 2.2 });
    x.putImageData(id, 0, 0);
    x.setTransform(R, 0, 0, R, OX, OY);
    // a hard contact shadow right under the cap course
    x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(soft ? 4 : 5, lip, p.w - (soft ? 8 : 10), 1.2);
    decoratePlatform(x, p, th, PM.deco, lip, depth, soft, n, r, idx);
    return { canvas: c, ox: -padX, oy: -padT, w: w / R, h: h / R };
  }

  /** Per-theme dressing: bronze trim, ash, frost, moss and petals, sand, barnacles; glow kept tiny and local. */
  function decoratePlatform(x, p, th, deco, lip, depth, soft, n, r, idx) {
    var i, W = p.w;
    if (deco === 'storm') {
      // dragon-forged bronze straps along the cap course, riveted; a rain sheen on the top
      var bg = x.createLinearGradient(0, lip - 4.5, 0, lip - 1); bg.addColorStop(0, '#c09058'); bg.addColorStop(0.35, '#7a5530'); bg.addColorStop(1, '#2e1d10');
      x.fillStyle = bg; x.fillRect(-1, lip - 4.5, W + 2, 3.5);
      x.fillStyle = 'rgba(80,130,115,0.35)'; for (i = 0; i < W / 14; i++) x.fillRect(r() * W, lip - 2.5, 2 + r() * 6, 1.4);
      for (i = 12; i < W - 6; i += soft ? 30 : 38) { x.fillStyle = '#2a1a0e'; x.beginPath(); x.arc(i, lip - 2.7, 1.25, 0, TAU); x.fill(); x.fillStyle = 'rgba(235,200,140,0.75)'; x.beginPath(); x.arc(i - 0.35, lip - 3.1, 0.5, 0, TAU); x.fill(); }
      x.fillStyle = 'rgba(190,205,230,0.35)'; x.fillRect(0, 0.4, W, 0.8);
      for (i = 0; i < W / 120; i++) { x.fillStyle = 'rgba(160,180,215,0.2)'; x.beginPath(); x.ellipse(10 + r() * (W - 20), 1.6, 6 + r() * 12, 0.7, 0, 0, TAU); x.fill(); }
      if (!soft) for (i = 0; i < W / 70; i++) { x.fillStyle = 'rgba(38,52,36,0.75)'; x.beginPath(); x.ellipse(8 + r() * (W - 16), lip + 12 + r() * 2, 2 + r() * 5, 1.4, 0, 0, TAU); x.fill(); }
    } else if (deco === 'volcano') {
      // ash dusting the walking surface, a single seam of heat in the foundation
      for (i = 0; i < W * 0.6; i++) { x.fillStyle = 'rgba(150,140,135,' + (0.1 + r() * 0.25) + ')'; x.fillRect(r() * W, r() * 3, 1 + r() * 3, 0.6 + r()); }
      if (!soft && idx === 0) {
        x.save(); x.globalCompositeOperation = 'lighter';
        [W * 0.27, W * 0.71].forEach(function (gx, k) {
          var gy = lip + 6;
          var g = x.createRadialGradient(gx, gy, 0, gx, gy, 16); g.addColorStop(0, 'rgba(255,110,40,0.28)'); g.addColorStop(1, 'rgba(255,60,20,0)');
          x.fillStyle = g; x.fillRect(gx - 16, gy - 16, 32, 32);
          x.strokeStyle = 'rgba(255,170,90,0.6)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(gx, lip); x.lineTo(gx + (k ? 1 : -1.5), gy); x.lineTo(gx + (k ? -1 : 1), lip + 12); x.stroke();
        });
        x.restore();
      }
    } else if (deco === 'crystal') {
      // rime along the top, short icicles under the lip, a small cluster under the floor
      for (i = 0; i < W * 0.8; i++) { x.fillStyle = 'rgba(210,235,245,' + (0.25 + r() * 0.4) + ')'; x.fillRect(r() * W, -0.4 + r() * 2.4, 1 + r() * 4, 0.6 + r() * 0.8); }
      for (i = 0; i < W / (soft ? 24 : 18); i++) {
        var ix = 4 + r() * (W - 8), il = 2 + r() * (soft ? 5 : 9), ig = x.createLinearGradient(0, lip, 0, lip + il);
        ig.addColorStop(0, 'rgba(200,232,240,0.85)'); ig.addColorStop(1, 'rgba(140,200,215,0.05)');
        x.fillStyle = ig; x.beginPath(); x.moveTo(ix - 1.1, lip); x.lineTo(ix, lip + il); x.lineTo(ix + 1.1, lip); x.fill();
      }
      if (!soft) { x.save(); x.globalAlpha = 0.85; crystalCluster(x, W * (0.3 + r() * 0.4), lip + 34, 22, Math.PI / 2, r, ['#3f8f96', '#163c46', 'rgba(190,240,240,0.55)']); x.restore(); }
    } else if (deco === 'blossom') {
      // moss creeping over the lip, fallen petals, roots hanging from the stone
      for (i = 0; i < W * 0.9; i++) { var mx = r() * W, my = n.fbm(mx * 0.05, 7, 3); if (my < 0.45) continue; x.fillStyle = 'rgba(' + (60 + r() * 30 | 0) + ',' + (88 + r() * 30 | 0) + ',' + (50 + r() * 16 | 0) + ',0.85)'; x.fillRect(mx, -0.6 + r() * 2.2, 1 + r() * 2.5, 1 + r() * 2); }
      for (i = 0; i < W * 0.08; i++) { x.fillStyle = r() < 0.6 ? 'rgba(222,170,182,0.85)' : 'rgba(240,214,220,0.85)'; x.beginPath(); x.ellipse(r() * W, 0.6 + r() * 1.8, 1.5, 0.8, r() * 3, 0, TAU); x.fill(); }
      x.strokeStyle = 'rgba(46,52,30,0.75)'; x.lineWidth = 0.8;
      for (i = 0; i < (soft ? 2 : W / 60); i++) { var vx = 12 + r() * (W - 24), vy = lip + 2, vl = soft ? 8 + r() * 10 : 16 + r() * 40; x.beginPath(); x.moveTo(vx, vy); x.bezierCurveTo(vx + 3, vy + vl * 0.3, vx - 3, vy + vl * 0.7, vx + (r() - 0.5) * 4, vy + vl); x.stroke(); }
    } else if (deco === 'arena') {
      for (i = 0; i < W * 0.7; i++) { x.fillStyle = 'rgba(230,200,150,' + (0.2 + r() * 0.35) + ')'; x.fillRect(r() * W, -0.3 + r() * 2.6, 1 + r() * 4, 0.6 + r() * 0.8); }
      if (!soft) for (i = 0; i < W / 80; i++) { x.fillStyle = 'rgba(40,26,16,0.3)'; x.fillRect(10 + r() * (W - 20), 5 + r() * 12, 0.8, 4 + r() * 8); }
    } else if (deco === 'reef') {
      // barnacles and coral crust; weed trailing in the current
      for (i = 0; i < W / 6; i++) {
        var bx2 = r() * W, by2 = r() < 0.5 ? 0.8 + r() * 1.5 : 4 + r() * (lip - 6), br = 0.7 + r() * 1.3;
        x.fillStyle = 'rgba(190,210,200,0.75)'; x.beginPath(); x.arc(bx2, by2, br, 0, TAU); x.fill();
        x.fillStyle = 'rgba(20,40,40,0.8)'; x.beginPath(); x.arc(bx2 + 0.2, by2 + 0.2, br * 0.4, 0, TAU); x.fill();
      }
      var cc = ['#a0584e', '#a87a46', '#8a4a6a'];
      for (i = 0; i < (soft ? 2 : W / 70); i++) { var cx = r() < 0.5 ? r() * W * 0.2 : W - r() * W * 0.2; x.strokeStyle = cc[i % 3]; x.lineWidth = 1.4; x.lineCap = 'round'; for (var bb = 0; bb < 3; bb++) { var a = -Math.PI / 2 + (r() - 0.5) * 1.4, L = 3 + r() * 6; x.beginPath(); x.moveTo(cx, 0.5); x.lineTo(cx + Math.cos(a) * L, 0.5 + Math.sin(a) * L); x.stroke(); } }
      x.strokeStyle = 'rgba(40,96,70,0.75)'; x.lineWidth = 1;
      for (i = 0; i < (soft ? 2 : W / 50); i++) { var sx = 12 + r() * (W - 24), sl = soft ? 10 + r() * 10 : 20 + r() * 44; x.beginPath(); x.moveTo(sx, lip + 2); x.bezierCurveTo(sx + 5, lip + sl * 0.3, sx - 5, lip + sl * 0.6, sx + 3, lip + sl); x.stroke(); }
      if (p.altar) {
        // a bronze dragon seal in the altar face and a band of faint glyphs
        var cx2 = W / 2, cy2 = lip + (p.h - lip - 14) / 2;
        var sg = x.createRadialGradient(cx2 - 3, cy2 - 3, 0, cx2, cy2, 13); sg.addColorStop(0, '#b08a52'); sg.addColorStop(0.7, '#5a4024'); sg.addColorStop(1, '#2a1c10');
        x.fillStyle = sg; x.beginPath(); x.arc(cx2, cy2, 12, 0, TAU); x.fill();
        x.strokeStyle = 'rgba(60,110,96,0.7)'; x.lineWidth = 1.2; x.beginPath(); x.arc(cx2, cy2, 12, 0, TAU); x.stroke();
        x.strokeStyle = 'rgba(30,20,10,0.8)'; x.lineWidth = 1.4; x.beginPath(); x.arc(cx2, cy2, 6, -2.4, 1.6); x.stroke();
        x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = 'rgba(110,220,200,0.32)';
        for (var gl = 0; gl < 10; gl++) { if (gl === 4 || gl === 5) continue; var gx2 = 10 + gl * (W - 20) / 9; x.fillRect(gx2 - 2, cy2 - 3, 4, 1.2); x.fillRect(gx2 - 0.6, cy2 - 3, 1.2, 6); }
        x.restore();
      }
    }
  }

  /** The Colosseum's walls: fluted sandstone columns with a moulded capital and a hanging banner. */
  function wallSprite2(p, th, PM, idx, n) {
    var R = 2, pad = 22, w = Math.round((p.w + pad * 2) * R), h = Math.round((p.h + pad * 2) * R), c = canvas(w, h), x = c.getContext('2d');
    x.setTransform(R, 0, 0, R, pad * R, pad * R); x.fillStyle = '#fff';
    x.fillRect(-7, 0, p.w + 14, 12); x.fillRect(-3, 12, p.w + 6, 8); x.fillRect(10, 20, p.w - 20, p.h - 52); x.fillRect(-2, p.h - 32, p.w + 4, 14); x.fillRect(-6, p.h - 18, p.w + 12, 18);
    shadeMask(c, n, ext(lightOf(th), { dark: PM.stone[0], base: PM.stone[1], light: PM.stone[2], unit: 1 / R, ox: -pad + idx * 300, oy: -pad, key: boost(th.key, 1.1), amb: boost(th.amb, 1.1),
      scale: 0.06, warp: 1, bump: 0.5, form: 12, round: 1.8, rim: 3, cav: 4, streak: 0.4, strata: { f: 0.35, a: 0.4, warp: 3 } }));
    // flutes: a shadowed groove and a lit ridge, repeated across the shaft
    for (var f = 0; f < 7; f++) {
      var fx = 10 + (f + 0.5) * (p.w - 20) / 7, lit = (fx - p.w / 2) / (p.w / 2) * (th.L[0] > 0 ? 1 : -1);
      x.fillStyle = 'rgba(20,12,6,' + (0.28 - lit * 0.12) + ')'; x.fillRect(fx - 2.2, 24, 2.4, p.h - 60);
      x.fillStyle = 'rgba(255,230,190,' + (0.08 + Math.max(0, lit) * 0.12) + ')'; x.fillRect(fx + 0.4, 24, 1, p.h - 60);
    }
    x.fillStyle = 'rgba(255,232,190,0.4)'; x.fillRect(-7, 0, p.w + 14, 1.4); x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(-3, 20, p.w + 6, 2);
    // banner
    var bw = p.w * 0.42, bx = p.w / 2 - bw / 2, by = 26, bh = 120, g = x.createLinearGradient(bx, 0, bx + bw, 0), col = idx % 2 ? [44, 82, 92] : [116, 40, 32];
    g.addColorStop(0, rgba(mix(col, [0, 0, 0], 0.4), 1)); g.addColorStop(0.3, rgba(mix(col, [255, 220, 180], 0.12), 1)); g.addColorStop(0.6, rgba(col, 1)); g.addColorStop(1, rgba(mix(col, [0, 0, 0], 0.5), 1));
    x.fillStyle = g; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + bw, by); x.lineTo(bx + bw, by + bh); x.lineTo(bx + bw / 2, by + bh - 14); x.lineTo(bx, by + bh); x.fill();
    var sg = x.createRadialGradient(p.w / 2 - 2, by + 40, 0, p.w / 2, by + 42, 11); sg.addColorStop(0, '#c09a5e'); sg.addColorStop(1, '#4a3418');
    x.fillStyle = sg; x.beginPath(); x.arc(p.w / 2, by + 42, 10, 0, TAU); x.fill();
    x.fillStyle = '#3a2814'; x.fillRect(bx - 3, by - 2, bw + 6, 3);
    return { canvas: c, ox: -pad, oy: -pad, w: w / R, h: h / R };
  }

  // ─────────────── near framing and film grain for the painted arenas ───────────────
  function fgV2(x, arena, th, cam, W, H, t) {
    var key = 'v2:' + arena.theme + W + 'x' + H, fg = fgCache[key];
    if (!fg) {
      fg = canvas(W, H); var c = fg.getContext('2d'), n = Noise(78), r = rnd(5), S = H / 720, P = { n: n, H: H, th: th };
      var M = ext(lightOf(th), { dark: '#050506', base: th.fgRock || '#1a1a1e', light: th.fgRock2 || '#34343a', scale: 0.02, ridged: true, warp: 2, bump: 1.1, form: 16, round: 1, rim: 7, cav: 3,
        key: boost(th.key, 0.55), amb: boost(th.amb, 0.45) });
      var parts = [];
      var left = shapeCanvas(P, 1, 0, H * 0.74, W * 0.2, H * 0.26);
      poly(left.x, rough([[-10, H + 10], [-10, H * 0.79], [W * 0.035, H * 0.81], [W * 0.075, H * 0.86], [W * 0.12, H * 0.9], [W * 0.15, H * 0.96], [W * 0.165, H + 10]], n, 7 * S, 9 * S, 1.1));
      parts.push(left);
      var right = shapeCanvas(P, 1, W * 0.84, H * 0.8, W * 0.16, H * 0.2);
      poly(right.x, rough([[W + 10, H + 10], [W + 10, H * 0.85], [W * 0.96, H * 0.87], [W * 0.92, H * 0.92], [W * 0.88, H + 10]], n, 7 * S, 8 * S, 2.2));
      parts.push(right);
      if (th.fg === 'stalactites') {
        [[0, 1], [W, -1]].forEach(function (sd, k) {
          var top = shapeCanvas(P, 1, sd[1] > 0 ? 0 : W * 0.78, 0, W * 0.22, H * 0.2), tx = top.x;
          tx.beginPath(); tx.moveTo(sd[0], -10);
          for (var j = 0; j <= 12; j++) { var u = j / 12, xx = sd[0] + sd[1] * u * W * 0.2; tx.lineTo(xx, H * 0.035 * (1 - u)); if (j % 2) { tx.lineTo(xx + sd[1] * 5 * S, H * (0.05 + r() * (k ? 0.08 : 0.12)) * (1 - u * 0.75)); tx.lineTo(xx + sd[1] * 10 * S, H * 0.03 * (1 - u)); } }
          tx.lineTo(sd[0] + sd[1] * W * 0.2, -10); tx.fill();
          parts.push(top);
        });
      }
      parts.forEach(function (Sp) { shadeShape(P, Sp, M); c.filter = 'blur(' + (2.2 * S).toFixed(1) + 'px)'; c.drawImage(Sp.c, Sp.bx, Sp.by); c.filter = 'none'; });
      c.filter = 'blur(' + (3 * S).toFixed(1) + 'px)';
      if (th.fg === 'branches') {
        c.strokeStyle = 'rgba(22,18,18,0.95)'; c.lineCap = 'round';
        [[1, 0], [-1, W]].forEach(function (sd, k) {
          for (var b = 0; b < 3; b++) { var bx = sd[1] + sd[0] * (b * 30 * S); c.lineWidth = (7 - b * 2) * S; c.beginPath(); c.moveTo(bx - sd[0] * 40 * S, -10); c.quadraticCurveTo(bx + sd[0] * 70 * S, H * (0.05 + b * 0.025), bx + sd[0] * (150 + b * 40) * S, H * (0.08 + b * 0.02 + k * 0.01)); c.stroke(); }
          for (var bl = 0; bl < 22; bl++) { var px = sd[1] + sd[0] * (20 + r() * 200) * S, py = H * (0.01 + r() * 0.12), lit = r(); c.fillStyle = rgba(mix([96, 58, 72], [222, 178, 190], lit), 0.85); c.beginPath(); c.arc(px, py, (5 + r() * 10) * S, 0, TAU); c.fill(); }
        });
      }
      if (th.fg === 'kelp') {
        c.lineCap = 'round';
        [[1, 0], [-1, W]].forEach(function (sd) { for (var k = 0; k < 4; k++) { var kx = sd[1] + sd[0] * (14 + k * 26) * S; c.strokeStyle = k % 2 ? 'rgba(8,34,30,0.92)' : 'rgba(12,44,36,0.9)'; c.lineWidth = (9 - k) * S; c.beginPath(); c.moveTo(kx, H + 10); c.bezierCurveTo(kx + sd[0] * 26 * S, H * 0.88, kx - sd[0] * 16 * S, H * 0.8, kx + sd[0] * (34 + k * 6) * S, H * (0.68 + k * 0.03)); c.stroke(); } });
      }
      if (th.fg === 'railing') {
        c.fillStyle = 'rgba(16,10,8,0.95)'; c.strokeStyle = 'rgba(16,10,8,0.95)';
        [[0, 1], [W, -1]].forEach(function (s2) {
          c.fillRect(s2[1] > 0 ? 0 : W - W * 0.17, H * 0.95, W * 0.17, H * 0.05);
          for (var pz = 0; pz < 7; pz++) { var pxx = s2[0] + s2[1] * (12 + pz * 26 + (pz % 2) * 6) * S, py = H * (0.93 - (pz % 3) * 0.012 - Math.max(0, 3 - pz) * 0.01); c.beginPath(); c.arc(pxx, py, 12 * S, 0, TAU); c.fill(); c.fillRect(pxx - 14 * S, py + 8 * S, 28 * S, H); if (pz % 3 === 1) { c.lineWidth = 6 * S; c.beginPath(); c.moveTo(pxx + 10 * S, py + 6 * S); c.lineTo(pxx + 18 * S, py - 28 * S); c.stroke(); } }
        });
      }
      c.filter = 'none';
      fgCache[key] = fg;
    }
    var sway = Math.sin(t * (th.fg === 'kelp' ? 0.9 : 0.6)) * (th.fg === 'kelp' ? 5 : th.fg === 'branches' ? 3 : 0);
    x.drawImage(fg, -(cam.x - 800) * 0.08 + sway, -(cam.y - 450) * 0.04, W, H);
  }

  var grainPat = null;
  function grain(x, W, H, t, a) {
    if (!grainPat) {
      var gc = canvas(128, 128), gx = gc.getContext('2d'), id = gx.createImageData(128, 128), r = rnd(7);
      for (var k = 0; k < id.data.length; k += 4) { var v = 128 + (r() + r() - 1) * 110; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255; }
      gx.putImageData(id, 0, 0); grainPat = x.createPattern(gc, 'repeat');
    }
    var f = Math.floor(t * 24);
    x.save(); x.globalCompositeOperation = 'overlay'; x.globalAlpha = a;
    x.translate(-((f * 37) % 128), -((f * 61) % 128)); x.fillStyle = grainPat; x.fillRect(0, 0, W + 128, H + 128);
    x.restore();
  }

  // ─────────────── scene cache and drawing ───────────────
  // Keep the legacy scene compositor compatible with the landmark painters used by
  // the current arena themes. The newer painters are used by the gallery only.
  var LANDMARKS = {
    volcano: paintVolcano,
    tower: paintTower,
    pagoda: paintPagoda,
    colosseum: paintColosseum,
    geode: paintGeode,
    temple: paintTemple,
  };
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
