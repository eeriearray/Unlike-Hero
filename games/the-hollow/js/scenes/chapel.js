/* THE HOLLOW — the Abandoned Chapel, as a playable illustrated scene.
 *
 * Inside, at dusk. The roof has come in over the font, the stained glass is half gone, and the pews have been stacked
 * into a wall facing the door behind you (the foreground). Objects map ONLY to the chapel's own options in
 * engine/data/loc-village.js: pray (the broken altar), vestry (the vestry door), plate (the collection plate on the
 * font) and hatch (the tithe-hatch under the font). See js/scenes/square.js for how a scene is put together. */
(function (g) {
  'use strict';
  var SC = g.HollowScenes = g.HollowScenes || { defs: {} };
  SC.register = SC.register || function (d) { SC.defs[d.id] = d; };

  function rng(seed) { var h = 2166136261 ^ seed; return function () { h += 0x6D2B79F5; var t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var f1 = function (n) { return Math.round(n * 10) / 10; };

  // the room in perspective: one vanishing point, back wall from x 470 to 1130, floor meets it at y 560
  var VP = [800, 400], BW = [470, 1130], FY = 560, TOP = 150;
  function floorY(x) { return VP[1] + Math.abs(VP[0] - x) * ((FY - VP[1]) / (VP[0] - BW[0])); }
  function ceilY(x) { return VP[1] - Math.abs(VP[0] - x) * ((VP[1] - TOP) / (VP[0] - BW[0])); }

  var DEFS = '<defs>' +
    '<linearGradient id="ch-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1630"/><stop offset=".35" stop-color="#4a2c48"/><stop offset=".62" stop-color="#a24c3c"/><stop offset=".82" stop-color="#e08a4a"/><stop offset="1" stop-color="#f3c47a"/></linearGradient>' +
    '<radialGradient id="ch-sun" cx=".5" cy=".5"><stop offset="0" stop-color="#ffe3a6" stop-opacity=".9"/><stop offset=".3" stop-color="#ffb466" stop-opacity=".35"/><stop offset="1" stop-color="#ff8a4a" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="ch-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2630"/><stop offset=".6" stop-color="#3b3540"/><stop offset="1" stop-color="#2a252c"/></linearGradient>' +
    '<linearGradient id="ch-wallL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#14121a"/><stop offset="1" stop-color="#2c2832"/></linearGradient>' +
    '<linearGradient id="ch-wallR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#16131b"/><stop offset="1" stop-color="#342e38"/></linearGradient>' +
    '<linearGradient id="ch-ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0a0e"/><stop offset="1" stop-color="#1e1a20"/></linearGradient>' +
    '<linearGradient id="ch-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a343a"/><stop offset=".5" stop-color="#29252b"/><stop offset="1" stop-color="#141216"/></linearGradient>' +
    '<linearGradient id="ch-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a8590"/><stop offset="1" stop-color="#4c4852"/></linearGradient>' +
    '<linearGradient id="ch-stoneD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e5a64"/><stop offset="1" stop-color="#2e2b33"/></linearGradient>' +
    '<linearGradient id="ch-wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2e1d12"/><stop offset=".5" stop-color="#4f3420"/><stop offset="1" stop-color="#25170d"/></linearGradient>' +
    '<linearGradient id="ch-woodv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3d26"/><stop offset="1" stop-color="#2a1b10"/></linearGradient>' +
    '<linearGradient id="ch-cloth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9cfb4"/><stop offset="1" stop-color="#8f8670"/></linearGradient>' +
    '<linearGradient id="ch-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e1a22"/><stop offset="1" stop-color="#3a0c12"/></linearGradient>' +
    '<linearGradient id="ch-shaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd59a" stop-opacity=".42"/><stop offset=".7" stop-color="#ffc27a" stop-opacity=".1"/><stop offset="1" stop-color="#ffc27a" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="ch-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3d0" stop-opacity="0"/><stop offset=".25" stop-color="#fff3d0" stop-opacity=".55"/><stop offset="1" stop-color="#ffe2a0" stop-opacity=".1"/></linearGradient>' +
    '<radialGradient id="ch-warm"><stop offset="0" stop-color="#ffd27a" stop-opacity=".6"/><stop offset=".35" stop-color="#f0a845" stop-opacity=".2"/><stop offset="1" stop-color="#f0a845" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="ch-ink"><stop offset="0" stop-color="#6aa8ff" stop-opacity=".75"/><stop offset=".4" stop-color="#2a4c9a" stop-opacity=".3"/><stop offset="1" stop-color="#2a4c9a" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="ch-deep"><stop offset="0" stop-color="#05060a"/><stop offset="1" stop-color="#16141a"/></radialGradient>' +
    '<radialGradient id="ch-coin"><stop offset="0" stop-color="#e9e3cf"/><stop offset=".7" stop-color="#a59d86"/><stop offset="1" stop-color="#6c6553"/></radialGradient>' +
    '<pattern id="ch-grain" width="60" height="8" patternUnits="userSpaceOnUse"><path d="M0 2q15 2 30 0t30 0M0 6q20 -1.6 40 0t20 0" stroke="#000" stroke-opacity=".24" fill="none" stroke-width=".8"/></pattern>' +
    '<pattern id="ch-ashlar" width="64" height="30" patternUnits="userSpaceOnUse"><rect width="64" height="30" fill="none"/><path d="M0 29.5h64M0 14.5h64M20 0v15M52 15v15" stroke="#17141b" stroke-width="1.4" opacity=".7"/><path d="M1 1h18M21 16h30" stroke="#6b6472" stroke-width=".8" opacity=".35"/></pattern>' +
    '<filter id="ch-blur6" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>' +
    '<filter id="ch-blur18" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="18"/></filter>' +
    '<filter id="ch-blur3"><feGaussianBlur stdDeviation="2.4"/></filter>' +
    '</defs>';

  // ───────────────────────── layer: sky (seen through the roof and the broken glass) ─────────────────────────
  function sky() {
    var r = rng(21), s = '<rect width="1600" height="900" fill="url(#ch-sky)"/>';
    s += '<circle cx="1120" cy="520" r="260" fill="url(#ch-sun)"/>';
    s += '<g class="ch-stars">';
    for (var i = 0; i < 30; i++) s += '<circle cx="' + f1(r() * 1600) + '" cy="' + f1(r() * 160) + '" r="' + f1(0.6 + r()) + '" fill="#f1e8ff" opacity="' + f1(0.2 + r() * 0.5) + '"' + (r() < 0.3 ? ' class="tw" style="animation-delay:' + f1(-r() * 6) + 's"' : '') + '/>';
    s += '</g><g class="ch-clouds"><path class="cl c1" d="M700 210q140-30 300-6t300 0q100-10 200 8v22q-120 10-230 0t-300 4q-160 10-270-6z" fill="#5a2c3c" opacity=".7"/>' +
      '<path class="cl c2" d="M860 300q160-20 340 0t300 0v18q-140 10-300 0t-340 2z" fill="#7a3a3a" opacity=".55"/>' +
      '<path class="cl c3" d="M500 120q120-18 260 0t240-2v16q-110 8-240 0t-260 2z" fill="#3a2440" opacity=".7"/></g>';
    // crows wheeling over the hole in the roof (last phase only)
    s += '<g class="ch-crows" fill="#07060a"><path d="M1030 70q6-8 12-2q4-6 10 0l-6 4q-4 6-10 0z"/><path d="M1110 40q6-8 12-2q4-6 10 0l-6 4q-4 6-10 0z"/><path d="M1180 88q5-7 10-2q4-5 8 0l-5 3q-3 5-8 0z"/></g>';
    return s;
  }

  // ───────────────────────── layer: far (the shell of the chapel) ─────────────────────────
  // a pointed lancet: x, top y, width, bottom y
  function lancet(x, y, w, b) { var h = w * 0.9; return 'M' + x + ' ' + b + 'V' + (y + h) + 'Q' + x + ' ' + (y + h * 0.2) + ' ' + (x + w / 2) + ' ' + y + 'Q' + (x + w) + ' ' + (y + h * 0.2) + ' ' + (x + w) + ' ' + (y + h) + 'V' + b + 'z'; }
  var LANCETS = [[660, 236, 50, 430], [764, 190, 72, 450], [890, 236, 50, 430]];
  // the roof hole (jagged), used both to cut the ceiling and to place the light shaft
  var HOLE = 'M930 150L948 112 982 120 996 72 1040 80 1060 30 1104 44 1130 0H1300L1262 40 1240 34 1214 72 1180 70 1164 104 1130 150z';
  function glass(L, idx, r) {
    var x = L[0], y = L[1], w = L[2], b = L[3], s = '<g class="win lit ch-glass" data-w="' + idx + '">';
    // light falling from the window across the floor (it fades as the Haunting rises)
    s += '<path class="wglow" d="M' + x + ' ' + b + 'L' + (x - 60 + (x - 800) * 0.4) + ' 900H' + (x + w + 60 + (x - 800) * 0.4) + 'L' + (x + w) + ' ' + b + 'z" fill="url(#ch-shaft)" opacity=".55"/>';
    // panes: a lead grid over coloured glass; some panes broken out (the sky shows through)
    var cols = ['#7a1f2c', '#203a7a', '#b0802a', '#2a5a4a', '#5a2a6a'], rows = Math.round((b - y) / 26), pw = w / 2;
    s += '<g class="wpanes">';
    for (var i = 0; i < rows; i++) for (var j = 0; j < 2; j++) {
      if (r() < 0.2) continue;
      var py = y + i * 26, px = x + j * pw;
      s += '<rect x="' + f1(px) + '" y="' + f1(py) + '" width="' + f1(pw) + '" height="26" fill="' + cols[Math.floor(r() * cols.length)] + '" opacity="' + f1(0.6 + r() * 0.3) + '"/>';
    }
    s += '</g>';
    s += '<path d="' + lancet(x, y, w, b) + '" fill="none" stroke="#0e0c10" stroke-width="5"/>';
    var lead = 'M' + (x + w / 2) + ' ' + (y + 6) + 'V' + b;
    for (var k = 1; k < rows; k++) lead += 'M' + x + ' ' + (y + k * 26) + 'h' + w;
    s += '<path d="' + lead + '" stroke="#0e0c10" stroke-width="2"/>';
    // a sill of light on the window ledge
    s += '<path d="M' + (x - 6) + ' ' + (b + 2) + 'h' + (w + 12) + '" stroke="#5a5260" stroke-width="5"/>';
    return s + '</g>';
  }
  function far() {
    var r = rng(4), s = '';
    // back wall with the lancets cut out (evenodd), so the sky layer shows through the broken panes
    var cut = LANCETS.map(function (L) { return lancet(L[0], L[1], L[2], L[3]); }).join('');
    s += '<path fill-rule="evenodd" d="M' + BW[0] + ' ' + TOP + 'H' + BW[1] + 'V' + FY + 'H' + BW[0] + 'z' + cut + '" fill="url(#ch-wall)"/>';
    s += '<path fill-rule="evenodd" d="M' + BW[0] + ' ' + TOP + 'H' + BW[1] + 'V' + FY + 'H' + BW[0] + 'z' + cut + '" fill="url(#ch-ashlar)"/>';
    // the apse arch framing the altar
    s += '<path d="M600 560V300Q600 170 800 158Q1000 170 1000 300V560" fill="none" stroke="#1a171e" stroke-width="22"/><path d="M600 560V300Q600 170 800 158Q1000 170 1000 300V560" fill="none" stroke="#5c5562" stroke-width="3" opacity=".5"/>';
    LANCETS.forEach(function (L, i) { s += glass(L, i, r); });
    // a bell carved above the altar (the chapel's emblem)
    s += '<g class="ch-bell" transform="translate(800 470)"><path d="M-22 18q0-30 22-34q22 4 22 34l6 6h-56z" fill="#4a4450" stroke="#1a171e" stroke-width="2"/><circle cy="28" r="5" fill="#1a171e"/><path d="M0 -16v-8" stroke="#1a171e" stroke-width="4"/></g>';
    // the side walls in perspective
    s += '<path d="M0 0H' + f1(BW[0] - TOP / ((VP[1] - TOP) / (VP[0] - BW[0]))) + 'L' + BW[0] + ' ' + TOP + 'V' + FY + 'L0 ' + f1(floorY(0)) + 'z" fill="url(#ch-wallL)"/>';
    s += '<path d="M1600 0H' + f1(BW[1] + TOP / ((VP[1] - TOP) / (VP[0] - BW[0]))) + 'L' + BW[1] + ' ' + TOP + 'V' + FY + 'L1600 ' + f1(floorY(1600)) + 'z" fill="url(#ch-wallR)"/>';
    // stone courses receding along the side walls
    var courses = '';
    for (var c = 1; c < 9; c++) { var t = c / 9; courses += 'M0 ' + f1(floorY(0) + (ceilY(0) - floorY(0)) * t) + 'L' + BW[0] + ' ' + f1(FY + (TOP - FY) * t) + 'M1600 ' + f1(floorY(1600) + (ceilY(1600) - floorY(1600)) * t) + 'L' + BW[1] + ' ' + f1(FY + (TOP - FY) * t); }
    s += '<path d="' + courses + '" stroke="#0e0c12" stroke-width="1.6" opacity=".55"/>';
    // a lancet on the right wall: dark, the glass gone, boarded
    s += '<path d="M1290 520V300Q1300 240 1320 228L1320 470z" fill="#0c0a10"/><path d="M1286 330l40-14M1286 400l40-10M1286 450l40-6" stroke="#3a281a" stroke-width="8"/>';
    // the ceiling: dark boards, rafters, and the hole the weather made
    s += '<path fill-rule="evenodd" d="M' + f1(BW[0] - TOP / ((VP[1] - TOP) / (VP[0] - BW[0]))) + ' 0L' + BW[0] + ' ' + TOP + 'H' + BW[1] + 'L' + f1(BW[1] + TOP / ((VP[1] - TOP) / (VP[0] - BW[0]))) + ' 0z' + HOLE + '" fill="url(#ch-ceil)"/>';
    var raft = '';
    for (var k = 0; k < 7; k++) { var x0 = 500 + k * 100, xt = 800 + (x0 - 800) * 2.4; if (xt > 980 && xt < 1300) continue; raft += 'M' + x0 + ' ' + TOP + 'L' + f1(xt) + ' 0'; }
    s += '<path d="' + raft + '" stroke="#2c2018" stroke-width="10"/><path d="M' + BW[0] + ' ' + TOP + 'H' + BW[1] + '" stroke="#2c2018" stroke-width="14"/>';
    // broken rafters hanging through the hole, ivy coming in
    s += '<g class="ch-hang" style="transform-origin:1150px 10px"><path d="M1150 0L1110 150" stroke="#2c2018" stroke-width="12"/><path d="M1110 150l-6 14 10-4z" fill="#2c2018"/></g>';
    s += '<path d="M1214 72L1250 190" stroke="#2c2018" stroke-width="9"/><path d="M1060 30c-10 40 10 70 -4 120M1100 44c10 50-8 90 6 140M1250 40c-8 60 14 100 4 170" stroke="#2f4a2a" stroke-width="4" fill="none" opacity=".75"/>';
    s += '<g fill="#3a5a32" opacity=".8">' + [[1056, 90], [1062, 130], [1104, 110], [1100, 160], [1252, 110], [1256, 170]].map(function (p) { return '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="7" ry="4" transform="rotate(' + (p[0] % 50) + ' ' + p[0] + ' ' + p[1] + ')"/>'; }).join('') + '</g>';
    // dust in the light from the hole
    s += '<path class="ch-shaft" d="M960 150L1250 0H1300L1290 0 1340 760H1060z" fill="url(#ch-shaft)" opacity=".7"/>';
    s += '<g class="ch-motes">';
    for (var m = 0; m < 18; m++) s += '<circle cx="' + f1(1060 + r() * 220) + '" cy="' + f1(200 + r() * 480) + '" r="' + f1(1 + r() * 1.4) + '" fill="#ffe6b8" opacity=".6" style="animation-delay:' + f1(-r() * 10) + 's"/>';
    s += '</g>';
    // scratched tally marks and, late, a word on the back wall
    s += '<g class="ch-tally" stroke="#c9bfae" stroke-width="2" opacity=".35"><path d="M500 470v26M508 470v26M516 470v26M524 470v26M496 488l34-12"/><path d="M500 510v22M508 510v22M516 510v22"/></g>';
    s += '<g class="ch-words"><path d="M1024 342q-6-4-12-1t-1 11q13 4 12 12t-13 3M1032 340h16M1040 340v30M1054 370l8-30 8 30M1058 358h8M1076 340l7 14 7-14M1083 354v16" stroke="#8a1f2a" stroke-width="4" fill="none" stroke-linecap="round"/></g>';
    return s;
  }

  // ───────────────────────── layer: mid (pillars, the remaining pews, the chandelier) ─────────────────────────
  function pillar(x, top, base, w) {
    return '<path d="M' + (x - w / 2) + ' ' + base + 'V' + top + 'h' + w + 'V' + base + 'z" fill="url(#ch-stoneD)"/><path d="M' + (x - w / 2) + ' ' + base + 'V' + top + 'h' + (w * 0.22) + 'V' + base + 'z" fill="#7a7380" opacity=".35"/>' +
      '<path d="M' + (x - w / 2 - 8) + ' ' + top + 'h' + (w + 16) + 'v14h-' + (w + 16) + 'z" fill="#3e3a44"/><path d="M' + (x - w / 2 - 10) + ' ' + base + 'h' + (w + 20) + 'v-16h-' + (w + 20) + 'z" fill="#3e3a44"/>';
  }
  function pew(x, y, w, h, flip) {   // a pew seen from the side-back, in the nave
    var s = '<path d="M' + x + ' ' + y + 'h' + w + 'v' + h + 'h-' + w + 'z" fill="url(#ch-woodv)"/><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="url(#ch-grain)"/>';
    s += '<path d="M' + x + ' ' + y + 'h' + w + '" stroke="#7a5638" stroke-width="2" opacity=".6"/>';
    s += '<path d="M' + (flip ? x + w - 8 : x) + ' ' + (y - 10) + 'h8v' + (h + 26) + 'h-8z" fill="#2a1b10"/>';
    return s;
  }
  function mid() {
    var s = '';
    // pillars along both walls (the near ones larger)
    s += pillar(500, 180, 600, 34) + pillar(1100, 180, 600, 34);
    s += '<path d="M517 196Q560 120 620 160M1083 196Q1040 120 980 160" stroke="#3e3a44" stroke-width="10" fill="none"/>';
    // a torn banner hanging on the left wall
    s += '<g class="ch-banner" style="transform-origin:410px 230px"><path d="M380 230h60v150l-12-14-10 26-10-20-12 18-16-22z" fill="url(#ch-red)"/><path d="M380 230h60" stroke="#2a1b10" stroke-width="5"/><path d="M398 280q12-14 24 0v30h-24z" fill="none" stroke="#c9a35b" stroke-width="2" opacity=".55"/></g>';
    // the remaining rows of pews, left of the aisle, some overturned
    s += pew(470, 610, 150, 26, false) + pew(430, 650, 190, 30, false) + pew(380, 700, 240, 34, false);
    s += '<g transform="rotate(-8 1010 640)">' + pew(940, 630, 120, 22, true) + '</g>';
    // the hanging iron chandelier, cold, swaying on its chain
    s += '<g class="ch-chand" style="transform-origin:800px 0px"><path d="M800 0V200" stroke="#14110f" stroke-width="3"/>' +
      '<ellipse cx="800" cy="220" rx="70" ry="12" fill="none" stroke="#1c1814" stroke-width="5"/><path d="M800 200l-60 20M800 200l60 20M800 200v20" stroke="#1c1814" stroke-width="3"/>' +
      [-60, -30, 0, 30, 60].map(function (dx) { return '<path d="M' + (800 + dx) + ' ' + (220 - Math.abs(dx) * 0.05) + 'v-12" stroke="#d6cbb0" stroke-width="5"/>'; }).join('') +
      '<path d="M738 224q-6 18 2 30M862 224q6 18-2 30" stroke="#14110f" stroke-width="1.4" fill="none" opacity=".7"/></g>';
    // candle stands either side of the dais; their flames are the chapel's lanterns (the Haunting snuffs them)
    [[620, 548, 0], [980, 548, 1], [700, 472, 2], [900, 472, 3]].forEach(function (c, i) {
      var x = c[0], y = c[1], tall = i < 2;
      s += '<g class="slant ch-cand" data-l="' + c[2] + '">';
      if (tall) s += '<path d="M' + x + ' ' + (y + 60) + 'v-50M' + (x - 14) + ' ' + (y + 62) + 'h28" stroke="#1c1814" stroke-width="4"/><path d="M' + (x - 10) + ' ' + (y + 10) + 'h20" stroke="#1c1814" stroke-width="4"/>';
      s += '<circle class="lglow" cx="' + x + '" cy="' + (y - 16) + '" r="64" fill="url(#ch-warm)"/>';
      s += '<rect x="' + (x - 4) + '" y="' + (y - 16) + '" width="8" height="' + (tall ? 26 : 18) + '" fill="#e2d6b4"/><path d="M' + (x - 4) + ' ' + (y - 12) + 'q-2 6 0 10" stroke="#f3ead0" stroke-width="2" fill="none" opacity=".6"/>';
      s += '<path class="lflame" d="M' + x + ' ' + (y - 18) + 'c-5-5-3-10 0-17 3 7 5 12 0 17z" fill="#ffc861"/>';
      s += '<path class="lsmoke" d="M' + x + ' ' + (y - 26) + 'c-6-10 6-16 0-28" stroke="#9aa3b5" stroke-width="3" fill="none" opacity="0"/></g>';
    });
    return s;
  }

  // ───────────────────────── layer: ground (flagstones, the aisle runner) ─────────────────────────
  var groundCache = null;
  function ground() {
    if (groundCache) return groundCache;
    var r = rng(9), s = '<path d="M0 ' + f1(floorY(0)) + 'L' + BW[0] + ' ' + FY + 'H' + BW[1] + 'L1600 ' + f1(floorY(1600)) + 'V900H0z" fill="url(#ch-floor)"/>';
    // flagstones: rows that widen toward you, joints that run to the vanishing point
    var g2 = '<g class="ch-flags">', y = FY, row = 0;
    while (y < 900) {
      var h = 8 + (y - FY) * 0.16, t = (y - VP[1]) / (FY - VP[1]);
      var left = VP[0] - (VP[0] - BW[0]) * t * 1.9, w = (BW[1] - BW[0]) * t * 1.9, n = 9, sw = w / n, off = (row % 2) * sw / 2;
      for (var i = -1; i < n; i++) {
        var x = left + i * sw + off, c = Math.floor(44 + r() * 20);
        s += '';
        g2 += '<rect x="' + f1(x + 1) + '" y="' + f1(y + 1) + '" width="' + f1(sw - 2) + '" height="' + f1(h - 1.5) + '" rx="2" fill="rgb(' + c + ',' + (c - 2) + ',' + (c + 4) + ')"/>';
        if (y > 640 && r() < 0.18) g2 += '<path d="M' + f1(x + sw * 0.2) + ' ' + f1(y + h * 0.3) + 'l' + f1(sw * 0.2) + ' ' + f1(h * 0.3) + 'l' + f1(sw * 0.15) + ' -' + f1(h * 0.1) + '" stroke="#17141a" stroke-width="1.2" fill="none"/>';
      }
      y += h; row++;
    }
    s += g2 + '</g>';
    // the aisle runner from the dais toward you: torn, and stained in one place
    s += '<path d="M760 600L560 900H1040L840 600z" fill="#4a1a20" opacity=".85"/><path d="M760 600L560 900M840 600L1040 900" stroke="#b08a4a" stroke-width="3" opacity=".45"/>';
    s += '<path d="M640 900l40-80 30 30 20-50 40 100z" fill="#29252b"/>';
    s += '<ellipse cx="830" cy="720" rx="60" ry="14" fill="#1c0608" opacity=".7"/><ellipse class="ch-stain" cx="830" cy="720" rx="34" ry="8" fill="#5a0a14" opacity="0"/>';
    // rainwater under the hole, the sky in it
    s += '<g class="ch-puddle"><ellipse cx="1230" cy="770" rx="120" ry="18" fill="#1c1824" opacity=".8"/><ellipse cx="1210" cy="768" rx="70" ry="8" fill="#e08a4a" opacity=".22"/><ellipse class="pripple" cx="1230" cy="770" rx="40" ry="6" fill="none" stroke="#e8b27a" stroke-width="1" opacity=".3"/></g>';
    // the light shaft's pool on the floor
    s += '<ellipse cx="1200" cy="760" rx="170" ry="34" fill="#ffd59a" opacity=".12" class="ch-pool"/>';
    // candle light on the dais
    [[620, 0], [980, 1], [700, 2], [900, 3]].forEach(function (c) { s += '<ellipse class="lpool" data-lp="' + c[1] + '" cx="' + c[0] + '" cy="612" rx="120" ry="24" fill="url(#ch-warm)"/>'; });
    // scattered hymn pages and fallen plaster
    s += '<g fill="#cfc4a6" opacity=".75"><path d="M420 790l40-6 4 22-40 6z"/><path d="M470 820l34 4-4 18-34-4z" opacity=".7"/><path d="M1080 860l40-8 6 20-42 8z"/></g>';
    s += '<g fill="#5a5560">' + [[1150, 700, 14], [1300, 720, 10], [1110, 740, 8], [1330, 690, 7]].map(function (p) { return '<path d="M' + p[0] + ' ' + p[1] + 'l' + p[2] + ' -' + (p[2] * 0.6) + 'l' + p[2] + ' ' + (p[2] * 0.4) + 'l-' + (p[2] * 0.6) + ' ' + (p[2] * 0.5) + 'z"/>'; }).join('') + '</g>';
    groundCache = s;
    return s;
  }

  // ───────────────────────── objects ─────────────────────────
  function altarArt() {
    var s = '';
    // the dais: three shallow steps
    s += '<path d="M590 560h420l20 18H570z" fill="#4c4852"/><path d="M570 578h460l22 20H548z" fill="#57525e"/><path d="M548 598h504l20 22H528z" fill="#625d69"/>';
    s += '<path d="M570 578h460M548 598h504M528 620h544" stroke="#8a8494" stroke-width="1.6" opacity=".5"/>';
    // the altar block, split down the middle; one corner has fallen to the step
    s += '<ellipse cx="800" cy="600" rx="140" ry="12" fill="#000" opacity=".4"/>';
    s += '<path d="M690 500h104l-10 30 12 30-8 34H690z" fill="url(#ch-stone)"/><path d="M806 500h104v94H796l10-34-12-30z" fill="url(#ch-stone)"/>';
    s += '<path d="M690 500h104l-10 30 12 30-8 34H690z" fill="#000" opacity=".16"/>';
    s += '<path d="M680 488h240v16H680z" fill="#9a94a2"/><path d="M680 488h240" stroke="#c9c3d0" stroke-width="2" opacity=".6"/><path d="M794 488l-8 16M806 488l6 16" stroke="#1a171e" stroke-width="3"/>';
    s += '<path d="M902 556l18 8-6 22-24 2z" fill="#6c6774"/><path d="M890 580l40 10-4 10-44-2z" fill="#7a7582"/>';
    // the altar cloth, torn, hanging off one end
    s += '<path d="M700 490h170l-6 60-14-10-10 26-12-20-14 30-8-40H700z" fill="url(#ch-cloth)" opacity=".92"/><path d="M700 490h170" stroke="#b0a68a" stroke-width="2"/><path d="M760 498h50" stroke="#8a1f2a" stroke-width="3"/>';
    // the warmth that settles here after someone has prayed (state "done")
    s += '<ellipse class="ch-kneel" cx="800" cy="610" rx="120" ry="26" fill="url(#ch-warm)" opacity="0"/>';
    // a light column for the blessing outcome
    s += '<path class="ch-bless" d="M760 0h80l30 600H730z" fill="url(#ch-beam)" opacity="0"/>';
    // the crack that bleeds once the plate is taken (state "cold")
    s += '<path class="ch-crackred" d="M796 500l-10 30 12 30-8 34" stroke="#b02030" stroke-width="3" fill="none" opacity="0"/>';
    return s;
  }

  function vestryArt() {
    // the vestry door in the left wall, in perspective; open state shows shelves and the chasuble
    var s = '', P = 'M238 672L352 617V420Q352 372 300 360Q238 372 238 420z';
    s += '<path d="' + P + '" fill="#08070a"/>';
    // what is inside: a shelf, the chasuble on its peg, a glint of beeswax
    s += '<g class="ch-inside" opacity="0"><path d="M246 470l100-20M246 540l100-24" stroke="#4a3320" stroke-width="6"/><path d="M262 456q16-30 30 0l-4 70h-22z" fill="#6a5a8a"/><path d="M270 470h14" stroke="#c9a35b" stroke-width="2"/>' +
      '<rect x="306" y="508" width="8" height="18" fill="#e9d79a"/><circle class="ch-glint" cx="310" cy="506" r="10" fill="url(#ch-warm)"/></g>';
    // the door leaf (swings inward on hinges at the left)
    s += '<g class="ch-door" style="transform-origin:240px 520px"><path d="' + P + '" fill="url(#ch-wood)"/><path d="M262 662V400M290 650V380M318 636V378M342 624V398" stroke="#1d130b" stroke-width="2.4"/>' +
      '<path d="M240 470L352 456M240 600L352 572" stroke="#3a3c45" stroke-width="6"/><circle cx="334" cy="530" r="5" fill="#8a7a54"/><path d="' + P + '" fill="url(#ch-grain)"/></g>';
    s += '<path d="' + P + '" fill="none" stroke="#3e3a44" stroke-width="8"/>';
    // dust that falls when the shelf comes down
    s += '<g class="ch-dust" opacity="0"><ellipse cx="300" cy="640" rx="90" ry="34" fill="#a39a8a" filter="url(#ch-blur6)"/><ellipse cx="330" cy="600" rx="60" ry="30" fill="#8a8274" filter="url(#ch-blur6)"/></g>';
    s += '<path class="ch-shelf" d="M248 540l96-22" stroke="#4a3320" stroke-width="7" opacity="0"/>';
    return s;
  }

  function fontArt() {
    var s = '<ellipse cx="1180" cy="726" rx="100" ry="16" fill="#000" opacity=".45"/>';
    // the font: an octagonal stone bowl on a pillar
    s += '<path d="M1140 724l8-90h64l8 90z" fill="url(#ch-stoneD)"/><path d="M1148 634h12l-4 90h-16z" fill="#8a8494" opacity=".3"/><path d="M1126 724h108v10h-108z" fill="#3e3a44"/>';
    s += '<path d="M1096 590h168l-14 50h-140z" fill="url(#ch-stone)"/><path d="M1110 590l10 50M1150 590l4 50M1210 590l-4 50M1250 590l-10 50" stroke="#3e3a44" stroke-width="2"/>';
    s += '<ellipse cx="1180" cy="590" rx="86" ry="16" fill="#a29cab"/><ellipse cx="1180" cy="589" rx="72" ry="11" fill="url(#ch-deep)"/>';
    s += '<ellipse class="ch-water" cx="1180" cy="589" rx="60" ry="8" fill="#e08a4a" opacity=".25"/>';
    // the plate of old coin, left as if for a wake
    s += '<g class="ch-plate"><ellipse cx="1226" cy="582" rx="36" ry="9" fill="#6c6874" stroke="#2e2b33" stroke-width="2"/><ellipse cx="1226" cy="580" rx="26" ry="6" fill="#4a4652"/>' +
      '<g class="ch-coins">' + [[1216, 578], [1228, 576], [1238, 580], [1222, 582], [1232, 572]].map(function (c, i) { return '<ellipse class="ch-coin" cx="' + c[0] + '" cy="' + c[1] + '" rx="7" ry="3" fill="url(#ch-coin)" stroke="#5a5444" stroke-width=".8" style="animation-delay:' + (i * 0.08) + 's"/>'; }).join('') + '</g>' +
      '<circle class="ch-shine" cx="1228" cy="576" r="26" fill="url(#ch-warm)" opacity=".45"/></g>';
    return s;
  }

  function hatchArt() {
    // a square hatch set into the floor before the font, iron-ringed; hard to see until someone has searched
    var s = '<g class="ch-seam"><path d="M1170 790l18-46h104l20 46z" fill="#2c2830"/><path d="M1170 790l18-46h104l20 46z" fill="none" stroke="#17141a" stroke-width="3"/></g>';
    s += '<path class="ch-hole" d="M1176 788l16-40h96l18 40z" fill="#030305" opacity="0"/><ellipse class="ch-inkglow" cx="1240" cy="770" rx="70" ry="22" fill="url(#ch-ink)" opacity="0"/>';
    s += '<g class="ch-lid" style="transform-origin:1240px 744px"><path d="M1176 788l16-40h96l18 40z" fill="url(#ch-woodv)"/><path d="M1200 748l-10 40M1240 748v40M1280 748l10 40" stroke="#1d130b" stroke-width="2"/>' +
      '<path d="M1176 788l16-40h96l18 40z" fill="url(#ch-grain)"/><path d="M1182 772h116" stroke="#3a3c45" stroke-width="4"/><circle cx="1240" cy="772" r="9" fill="none" stroke="#6a6c75" stroke-width="3"/></g>';
    // a wet footprint leading away (once open)
    s += '<path class="ch-foot" d="M1314 800q6-10 12 0t-2 14q-8 2-10-14zM1336 822q6-10 12 0t-2 14q-8 2-10-14z" fill="#3a5a8a" opacity="0"/>';
    s += '<path class="ch-blood" d="M1238 790q4 10 0 18" stroke="#9a1a28" stroke-width="3" fill="none" opacity="0"/>';
    return s;
  }

  // ───────────────────────── layer: foreground (the pew barricade behind you) ─────────────────────────
  function fore() {
    var s = '<g fill="#060508">';
    // stacked pews: left heap and right heap, a gap where you squeezed through
    s += '<path d="M0 900V660l100-26 110 50 20 60-10 40 60 50 40 66z"/><path d="M-10 640l210 50M-10 730l250 50M-10 820l330 40" stroke="#060508" stroke-width="34"/>';
    s += '<path d="M1600 900V660l-110 10-90 50-10 40 30 30-30 60-10 50z"/><path d="M1610 650l-210 70M1610 740l-240 60M1610 830l-260 30" stroke="#060508" stroke-width="34"/>';
    s += '<path d="M196 690l20 -70h16l-8 74z"/><path d="M1420 720l-24-80h-16l14 84z"/></g>';
    s += '<path d="M-10 640l210 50M1610 650l-210 70" stroke="#5a4a3a" stroke-width="2" opacity=".45"/><path d="M-10 730l250 50M1610 740l-240 60" stroke="#4a3a2a" stroke-width="2" opacity=".35"/>';
    // a candle stand silhouette at the edge, a cobweb in the top corner
    s += '<path d="M90 0c40 40 60 90 70 160M0 60c50 10 110 40 160 100M0 140c60 0 120 10 160 20" stroke="#c9c3d0" stroke-width="1" fill="none" opacity=".18"/>';
    return s;
  }

  function fog(front) {
    if (!front) return '<g class="fogb"><ellipse cx="500" cy="590" rx="460" ry="34" fill="#a49aa8" opacity=".16" filter="url(#ch-blur18)"/><ellipse cx="1150" cy="580" rx="420" ry="30" fill="#c0a090" opacity=".14" filter="url(#ch-blur18)"/></g>';
    return '<g class="fogf"><ellipse cx="400" cy="860" rx="560" ry="60" fill="#9890a0" opacity=".16" filter="url(#ch-blur18)"/><ellipse cx="1250" cy="880" rx="560" ry="60" fill="#9890a0" opacity=".14" filter="url(#ch-blur18)"/></g>';
  }

  var EXTRA = {
    altar: function () { var s = ''; for (var i = 0; i < 6; i++) s += '<circle class="ch-mote2" cx="' + (770 + i * 12) + '" cy="' + (470 - i * 6) + '" r="1.6" fill="#ffe6b8" style="animation-delay:' + (-i * 0.7) + 's"/>'; return s; }
  };

  SC.register({
    id: 'chapel',
    vb: [1600, 900],
    defs: DEFS,
    layers: function () {
      return [
        { id: 'sky', depth: 0.05, svg: sky(), src: 'art/chapel/sky.webp' },
        { id: 'far', depth: 0.2, svg: far(), src: 'art/chapel/far.webp' },
        { id: 'fogb', depth: 0.3, svg: fog(false), cls: 'fog' },
        { id: 'mid', depth: 0.42, svg: mid(), src: 'art/chapel/mid.webp' },
        { id: 'ground', depth: 0.62, svg: ground(), src: 'art/chapel/ground.webp' },
        { id: 'objects', depth: 0.62, objects: true },
        { id: 'fogf', depth: 0.85, svg: fog(true), cls: 'fog' },
        { id: 'fore', depth: 1.15, svg: fore(), src: 'art/chapel/fore.webp' }
      ];
    },
    objects: {
      vestry: { name: 'The Vestry', art: vestryArt, box: [228, 352, 136, 324], at: [296, 520], crop: [150, 420, 300, 170], z: 1.9, sfx: 'door', layer: 'far',
        actions: [{ opt: 'vestry' }], blurb: 'Moths have been unravelling it for decades.' },
      altar: { name: 'The Broken Altar', art: altarArt, box: [600, 440, 400, 170], at: [800, 530], crop: [600, 400, 400, 225], z: 1.7, sfx: 'bell', layer: ['far', 'ground'],
        actions: [{ opt: 'pray' }], blurb: 'Broken, but the silence around it is whole.' },
      plate: { name: 'Collection Plate', art: fontArt, box: [1090, 540, 190, 196], at: [1200, 600], crop: [1070, 520, 250, 140], z: 2.0, sfx: 'coin', layer: ['far', 'mid', 'ground'],
        actions: [{ opt: 'plate' }], blurb: 'Old coin on the font, as if for a wake.' },
      hatch: { name: 'Tithe-hatch', art: hatchArt, box: [1160, 738, 160, 80], at: [1240, 768], crop: [1130, 700, 230, 130], z: 2.2, sfx: 'creak', layer: ['far', 'mid', 'ground'],
        actions: [{ opt: 'hatch' }], blurb: 'A seam in the floor under the font.' }
    },
    extra: EXTRA,
    state: function (root, st) {
      var q = function (s) { return root.querySelector(s); };
      var tg = function (sel, cls, on) { var e = q(sel); if (e) e.classList.toggle(cls, !!on); };
      var wf = st.wflags || {}, robbed = !!wf.chapel_robbed || st.done.plate;
      tg('.obj-altar', 'done', st.done.pray);
      tg('.obj-altar', 'cold', robbed);
      tg('.obj-vestry', 'opened', st.done.vestry);
      tg('.obj-plate', 'taken', robbed);
      tg('.obj-hatch', 'found', st.inv || st.done.hatch || (st.avail.hatch && st.avail.hatch.acts.some(function (a) { return a.o; })));
      tg('.obj-hatch', 'opened', st.done.hatch);
      var stg = root.closest && root.closest('.stg'); if (stg) stg.classList.toggle('ch-robbed', robbed);
    },
    fx: {
      altar: function () { return 'bless'; },
      vestry: function (el, tier) { return tier === 'ok' || tier === 'crit' ? 'rummage' : 'collapse'; },
      plate: function () { return 'take'; },
      hatch: function (el, tier) { return tier === 'ok' || tier === 'crit' ? 'open' : 'bite'; }
    },
    fxSfx: { bless: 'bell', rummage: 'door', collapse: 'creak', take: 'coin', open: 'door', bite: 'trap' }
  });
})(window);
