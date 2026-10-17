/* Putt Club — procedural textures. All surfaces are painted into canvases at load, so the game ships no
 * image files and every device gets the same look. Textures are cached by key. */
(function (global) {
  'use strict';
  var PC = global.PC, THREE = global.THREE;
  var cache = {};

  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }

  function tex(key, w, h, paint, opts) {
    if (cache[key]) return cache[key];
    var c = canvas(w, h), g = c.getContext('2d');
    paint(g, w, h || w);
    var t = new THREE.CanvasTexture(c);
    opts = opts || {};
    t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = PC.maxAniso || 4;
    if (opts.color !== false) t.encoding = THREE.sRGBEncoding;
    cache[key] = t;
    return t;
  }

  function noise(g, w, h, rng, count, size, colors, alpha) {
    for (var i = 0; i < count; i++) {
      g.globalAlpha = alpha * (0.4 + rng() * 0.6);
      g.fillStyle = colors[Math.floor(rng() * colors.length)];
      var s = size * (0.5 + rng());
      g.fillRect(rng() * w, rng() * h, s, s);
    }
    g.globalAlpha = 1;
  }

  var T = {};

  /** Manicured grass with mowing stripes. Tinted per theme by the material colour. */
  T.grass = function (variant) {
    return tex('grass-' + variant, 256, 256, function (g, w, h) {
      var rng = PC.rng('grass' + variant);
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      // Mowing stripes (two tones), soft edges.
      for (var i = 0; i < 4; i++) {
        var grd = g.createLinearGradient(0, i * h / 4, 0, (i + 1) * h / 4);
        var dark = i % 2 ? 0.9 : 1;
        grd.addColorStop(0, 'rgba(' + [255 * dark, 255 * dark, 255 * dark].map(Math.round) + ',1)');
        grd.addColorStop(1, 'rgba(' + [255 * dark, 255 * dark, 255 * dark].map(Math.round) + ',1)');
        g.fillStyle = grd; g.fillRect(0, i * h / 4, w, h / 4);
      }
      // Blades.
      for (var k = 0; k < 9000; k++) {
        var x = rng() * w, y = rng() * h, l = 1 + rng() * 2.4;
        var v = 200 + rng() * 55;
        g.strokeStyle = 'rgba(' + Math.round(v * 0.92) + ',' + Math.round(v) + ',' + Math.round(v * 0.86) + ',' + (0.25 + rng() * 0.35) + ')';
        g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * 1.5, y - l); g.stroke();
      }
      noise(g, w, h, rng, 1400, 1.4, ['#c8d0c0', '#ffffff', '#e8eedd'], 0.35);
    });
  };

  /** Diagonal two-tone checkerboard turf, like a freshly rolled mini-golf green. */
  T.checker = function (variant) {
    return tex('checker-' + variant, 256, 256, function (g, w, h) {
      var rng = PC.rng('checker' + variant);
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 4);
      var n = 4, s = (w * Math.SQRT2) / n;
      for (var i = -n; i < n; i++) for (var j = -n; j < n; j++) {
        if ((i + j) % 2) { g.fillStyle = 'rgba(0,0,0,0.11)'; g.fillRect(i * s, j * s, s, s); }
      }
      g.restore();
      for (var k = 0; k < 5000; k++) {
        var x = rng() * w, y = rng() * h, v = 215 + rng() * 40;
        g.fillStyle = 'rgba(' + Math.round(v * 0.9) + ',' + Math.round(v) + ',' + Math.round(v * 0.85) + ',' + (0.12 + rng() * 0.2) + ')';
        g.fillRect(x, y, 1, 1.6 + rng() * 1.6);
      }
    });
  };

  /** Rail blocks: staggered wooden bricks with dark joints (top of the rail is the last row). */
  T.blocks = function (variant) {
    return tex('blocks-' + variant, 256, 128, function (g, w, h) {
      var rng = PC.rng('blocks' + variant);
      var base = variant === 'stone' ? '#bdb3a2' : '#8a5634';
      g.fillStyle = '#3d2414'; g.fillRect(0, 0, w, h);
      var rows = 4, bh = h / rows, bw = w / 4;
      for (var r = 0; r < rows; r++) for (var c = -1; c < 5; c++) {
        var x = c * bw + (r % 2 ? bw / 2 : 0);
        g.fillStyle = shade(base, (rng() - 0.5) * 28);
        g.fillRect(x + 1.5, r * bh + 1.5, bw - 3, bh - 3);
        g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x + 1.5, r * bh + 1.5, bw - 3, 3);
        for (var k = 0; k < 4; k++) { g.strokeStyle = 'rgba(40,20,8,' + (0.12 + rng() * 0.12) + ')'; var yy = r * bh + 4 + rng() * (bh - 8); g.beginPath(); g.moveTo(x + 3, yy); g.lineTo(x + bw - 3, yy + (rng() - 0.5) * 2); g.stroke(); }
      }
    });
  };

  /** Rippled sandy seabed seen through shallow water. */
  T.seabed = function () {
    return tex('seabed', 256, 256, function (g, w, h) {
      var rng = PC.rng('seabed');
      g.fillStyle = '#e9cf9e'; g.fillRect(0, 0, w, h);
      noise(g, w, h, rng, 6000, 1.4, ['#dcbd86', '#f6e2b8', '#cfae78'], 0.5);
      g.strokeStyle = 'rgba(170,130,80,0.22)'; g.lineWidth = 3;
      for (var y = 0; y < h; y += 14) { g.beginPath(); for (var x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.06 + y * 0.3) * 3); g.stroke(); }
    });
  };

  T.sand = function () {
    return tex('sand', 256, 256, function (g, w, h) {
      var rng = PC.rng('sand');
      g.fillStyle = '#f1dfb8'; g.fillRect(0, 0, w, h);
      noise(g, w, h, rng, 9000, 1.2, ['#e3cb9a', '#fff1d2', '#d4b783', '#f7e6c2'], 0.6);
      // Raked ripples.
      g.strokeStyle = 'rgba(190,160,110,0.18)'; g.lineWidth = 2;
      for (var y = 0; y < h; y += 9) { g.beginPath(); for (var x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 2); g.stroke(); }
    });
  };

  T.stone = function (variant) {
    return tex('stone-' + variant, 256, 256, function (g, w, h) {
      var rng = PC.rng('stone' + variant);
      var base = variant === 'dark' ? '#5a5f66' : variant === 'warm' ? '#cbb89c' : '#c2bcb0';
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      // Pavers with joints.
      var rows = 4, bw = w / 3;
      for (var r = 0; r < rows; r++) {
        var off = r % 2 ? bw / 2 : 0, y = r * h / rows;
        for (var x = -bw; x < w + bw; x += bw) {
          var l = (rng() - 0.5) * 22;
          g.fillStyle = shade(base, l);
          g.fillRect(x + off + 2, y + 2, bw - 4, h / rows - 4);
        }
      }
      noise(g, w, h, rng, 5000, 1.3, ['#000000', '#ffffff'], 0.06);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
      for (var r2 = 0; r2 <= rows; r2++) { g.beginPath(); g.moveTo(0, r2 * h / rows); g.lineTo(w, r2 * h / rows); g.stroke(); }
    });
  };

  T.wood = function (variant) {
    return tex('wood-' + variant, 256, 256, function (g, w, h) {
      var rng = PC.rng('wood' + variant);
      var base = variant === 'pale' ? '#c9a77c' : variant === 'dark' ? '#6e4a2f' : '#a8774d';
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      var planks = 5, ph = h / planks;
      for (var i = 0; i < planks; i++) {
        g.fillStyle = shade(base, (rng() - 0.5) * 26);
        g.fillRect(0, i * ph + 1, w, ph - 2);
        for (var k = 0; k < 18; k++) {
          g.strokeStyle = 'rgba(60,35,15,' + (0.08 + rng() * 0.12) + ')'; g.lineWidth = 1;
          var yy = i * ph + rng() * ph;
          g.beginPath(); g.moveTo(0, yy); for (var x = 0; x <= w; x += 16) g.lineTo(x, yy + Math.sin(x * 0.03 + k) * 1.5); g.stroke();
        }
        g.fillStyle = 'rgba(40,22,10,0.55)'; g.fillRect(0, i * ph, w, 1.5);
        // Nail heads.
        g.fillStyle = 'rgba(40,30,20,0.6)';
        g.beginPath(); g.arc(10, i * ph + ph / 2, 1.6, 0, 7); g.arc(w - 10, i * ph + ph / 2, 1.6, 0, 7); g.fill();
      }
    });
  };

  T.metal = function (variant) {
    return tex('metal-' + variant, 256, 256, function (g, w, h) {
      var rng = PC.rng('metal' + variant);
      var base = variant === 'brass' ? '#c8a160' : variant === 'copper' ? '#c27a4f' : '#2a3140';
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 1600; i++) {
        g.strokeStyle = 'rgba(255,255,255,' + (rng() * 0.05) + ')';
        var y = rng() * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (rng() - 0.5) * 2); g.stroke();
      }
      if (variant === 'plate') {
        g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
        g.fillStyle = 'rgba(255,255,255,0.12)';
        [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 3, 0, 7); g.fill(); });
      }
    });
  };

  /** Dark panel floor with a fine grid (Neon Underground). */
  T.panel = function (variant) {
    return tex('panel-' + variant, 256, 256, function (g, w, h) {
      var rng = PC.rng('panel' + variant);
      g.fillStyle = variant === 'tile' ? '#1b2232' : '#202837'; g.fillRect(0, 0, w, h);
      noise(g, w, h, rng, 3000, 1.2, ['#2c3648', '#151b27'], 0.5);
      g.strokeStyle = variant === 'tile' ? 'rgba(90,220,230,0.22)' : 'rgba(120,140,170,0.25)'; g.lineWidth = 2;
      var n = variant === 'tile' ? 4 : 2;
      for (var i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * w / n, 0); g.lineTo(i * w / n, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / n); g.lineTo(w, i * h / n); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(4, 4, w / n - 8, h / n - 8);
    });
  };

  T.hedge = function () {
    return tex('hedge', 128, 128, function (g, w, h) {
      var rng = PC.rng('hedge');
      g.fillStyle = '#3f6b3a'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 900; i++) {
        g.fillStyle = ['#2f5a2e', '#4f7f44', '#5e8f4c', '#36602f'][Math.floor(rng() * 4)];
        g.beginPath(); g.ellipse(rng() * w, rng() * h, 2 + rng() * 3, 1.2 + rng() * 2, rng() * 3, 0, 7); g.fill();
      }
    });
  };

  T.sandstone = function () {
    return tex('sandstone', 256, 128, function (g, w, h) {
      var rng = PC.rng('sandstone');
      var grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#e9cf9d'); grd.addColorStop(0.5, '#d7b47e'); grd.addColorStop(1, '#b58e5e');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,80,40,0.18)';
      for (var y = 8; y < h; y += 10 + rng() * 10) { g.lineWidth = 1 + rng() * 2; g.beginPath(); g.moveTo(0, y); for (var x = 0; x <= w; x += 12) g.lineTo(x, y + (rng() - 0.5) * 3); g.stroke(); }
      noise(g, w, h, rng, 3000, 1.2, ['#fff2d6', '#9c7448'], 0.25);
    });
  };

  T.brick = function () {
    return tex('brick', 256, 128, function (g, w, h) {
      var rng = PC.rng('brick');
      g.fillStyle = '#8c8577'; g.fillRect(0, 0, w, h);
      var bh = h / 4, bw = w / 4;
      for (var r = 0; r < 4; r++) for (var c = -1; c < 5; c++) {
        g.fillStyle = shade('#b9ae99', (rng() - 0.5) * 30);
        g.fillRect(c * bw + (r % 2 ? bw / 2 : 0) + 2, r * bh + 2, bw - 4, bh - 4);
      }
      noise(g, w, h, rng, 2000, 1.2, ['#000000', '#ffffff'], 0.07);
    });
  };

  /** Soft radial blob: contact shadows and fake ambient occlusion. */
  T.blob = function () {
    return tex('blob', 128, 128, function (g, w) {
      var grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      grd.addColorStop(0, 'rgba(0,0,0,0.85)'); grd.addColorStop(0.45, 'rgba(0,0,0,0.42)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, w);
    }, { clamp: true, color: false });
  };

  /** Linear fade used for ambient occlusion strips beside rails. */
  T.aoStrip = function () {
    return tex('ao', 8, 64, function (g, w, h) {
      var grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, 'rgba(0,0,0,0.5)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }, { clamp: true, color: false });
  };

  T.glow = function () {
    return tex('glow', 128, 128, function (g, w) {
      var grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, w);
    }, { clamp: true });
  };

  /** Cup: liner ring, dark depth and a soft inner shadow, so the flat disc reads as a hole. */
  T.cup = function () {
    return tex('cup', 128, 128, function (g, w) {
      var c = w / 2;
      g.clearRect(0, 0, w, w);
      g.fillStyle = '#f4efe2'; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill();
      var grd = g.createRadialGradient(c * 0.92, c * 1.12, c * 0.1, c, c, c * 0.88);
      grd.addColorStop(0, '#06090a'); grd.addColorStop(0.7, '#141a1c'); grd.addColorStop(1, '#3b4140');
      g.fillStyle = grd; g.beginPath(); g.arc(c, c, c * 0.86, 0, 7); g.fill();
    }, { clamp: true });
  };

  /** Ball dimples as a bump map. */
  T.dimples = function () {
    return tex('dimples', 256, 128, function (g, w, h) {
      g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
      for (var y = 0; y < 14; y++) for (var x = 0; x < 30; x++) {
        var cx = (x + (y % 2) * 0.5) * (w / 30), cy = (y + 0.5) * (h / 14);
        var grd = g.createRadialGradient(cx, cy, 0, cx, cy, 4.2);
        grd.addColorStop(0, '#5a5a5a'); grd.addColorStop(1, '#808080');
        g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, 4.2, 0, 7); g.fill();
      }
    }, { color: false });
  };

  /** Launch pad: chevrons pointing up the texture (v). */
  T.pad = function () {
    return tex('pad', 128, 128, function (g, w) {
      g.clearRect(0, 0, w, w);
      g.fillStyle = 'rgba(255,190,80,0.25)'; g.beginPath(); g.arc(w / 2, w / 2, w / 2, 0, 7); g.fill();
      g.strokeStyle = '#ffd27a'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
      for (var i = 0; i < 3; i++) { var y = 84 - i * 26; g.globalAlpha = 0.45 + i * 0.25; g.beginPath(); g.moveTo(34, y + 16); g.lineTo(64, y - 4); g.lineTo(94, y + 16); g.stroke(); }
      g.globalAlpha = 1; g.lineWidth = 4; g.strokeStyle = 'rgba(255,220,150,0.9)'; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 4, 0, 7); g.stroke();
    }, { clamp: true });
  };

  /** Concentric ring for magnet fields and markers. */
  T.ring = function () {
    return tex('ring', 128, 128, function (g, w) {
      g.clearRect(0, 0, w, w);
      for (var i = 0; i < 4; i++) { g.strokeStyle = 'rgba(255,255,255,' + (0.7 - i * 0.15) + ')'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 3 - i * 14, 0, 7); g.stroke(); }
    }, { clamp: true });
  };

  /** Crate face with a spark mark (no emoji). */
  T.crate = function () {
    return tex('crate', 128, 128, function (g, w) {
      g.fillStyle = '#f6e7c4'; g.fillRect(0, 0, w, w);
      g.fillStyle = '#e8653a'; g.fillRect(0, 0, w, 14); g.fillRect(0, w - 14, w, 14); g.fillRect(0, 0, 14, w); g.fillRect(w - 14, 0, 14, w);
      g.fillStyle = '#1f3b4d';
      g.save(); g.translate(w / 2, w / 2);
      g.beginPath();
      for (var i = 0; i < 8; i++) { var r = i % 2 ? 13 : 34, a = i * Math.PI / 4 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill(); g.restore();
    }, { clamp: true });
  };

  T.foam = function () {
    return tex('foam', 128, 32, function (g, w, h) {
      var rng = PC.rng('foam');
      var grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-out';
      for (var i = 0; i < 90; i++) { g.beginPath(); g.arc(rng() * w, 6 + rng() * h, 1 + rng() * 3, 0, 7); g.fill(); }
      g.globalCompositeOperation = 'source-over';
    });
  };

  T.flag = function (color) {
    return tex('flag-' + color, 128, 80, function (g, w, h) {
      g.fillStyle = color; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.beginPath(); g.arc(w * 0.42, h / 2, h * 0.26, 0, 7); g.fill();
      g.fillStyle = color; g.beginPath(); g.arc(w * 0.42 + 6, h / 2 - 4, h * 0.2, 0, 7); g.fill();
    }, { clamp: true });
  };

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) + amt, gg = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    return 'rgb(' + [r, gg, b].map(function (v) { return Math.max(0, Math.min(255, Math.round(v))); }).join(',') + ')';
  }
  T.shade = shade;

  PC.tex = T;
})(window);
