/* THE HOLLOW — the Bloodstained Nursery, as a playable illustrated scene.
 *
 * A child's room at night. Five cradles stand against the back wall, facing it; the sixth has been pulled into the
 * room and rocks on its own. Objects map ONLY to the nursery's own options in engine/data/loc-village.js: answer (the
 * rocking cradle), inspect (the other cradles), burn (the hearth: fire for the cradle) and gift (the coin saucer at
 * the cradle's foot). See js/scenes/square.js for how a scene is put together. */
(function (g) {
  'use strict';
  var SC = g.HollowScenes = g.HollowScenes || { defs: {} };
  SC.register = SC.register || function (d) { SC.defs[d.id] = d; };

  function rng(seed) { var h = 2166136261 ^ seed; return function () { h += 0x6D2B79F5; var t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var f1 = function (n) { return Math.round(n * 10) / 10; };

  // the room: back wall from x 300 to 1300, floor meets it at y 600, vanishing point (800, 420)
  var BW = [300, 1300], FY = 600, TOP = 80, VP = [800, 420];
  var slopeF = (FY - VP[1]) / (VP[0] - BW[0]), slopeC = (VP[1] - TOP) / (VP[0] - BW[0]);
  function floorY(x) { return VP[1] + Math.abs(VP[0] - x) * slopeF; }

  var DEFS = '<defs>' +
    '<linearGradient id="nu-paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3240"/><stop offset=".7" stop-color="#4a3e48"/><stop offset="1" stop-color="#2e262e"/></linearGradient>' +
    '<linearGradient id="nu-wallL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#120e14"/><stop offset="1" stop-color="#2e2630"/></linearGradient>' +
    '<linearGradient id="nu-wallR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#140f15"/><stop offset="1" stop-color="#342a34"/></linearGradient>' +
    '<linearGradient id="nu-panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3424"/><stop offset="1" stop-color="#2a1c12"/></linearGradient>' +
    '<linearGradient id="nu-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a1e"/><stop offset=".5" stop-color="#2a1e15"/><stop offset="1" stop-color="#140e0a"/></linearGradient>' +
    '<linearGradient id="nu-wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a2618"/><stop offset=".5" stop-color="#6a4a2e"/><stop offset="1" stop-color="#2e1d10"/></linearGradient>' +
    '<linearGradient id="nu-woodv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4a2e"/><stop offset="1" stop-color="#2e1d10"/></linearGradient>' +
    '<linearGradient id="nu-pale" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8d2c4"/><stop offset="1" stop-color="#8a8478"/></linearGradient>' +
    '<linearGradient id="nu-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060a16"/><stop offset="1" stop-color="#1a2440"/></linearGradient>' +
    '<linearGradient id="nu-brick" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2e26"/><stop offset="1" stop-color="#2a1814"/></linearGradient>' +
    '<linearGradient id="nu-moonbeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8c8f0" stop-opacity=".32"/><stop offset="1" stop-color="#b8c8f0" stop-opacity="0"/></linearGradient>' +
    '<radialGradient id="nu-moon" cx=".42" cy=".38"><stop offset="0" stop-color="#fbfaf2"/><stop offset=".7" stop-color="#dcdccf"/><stop offset="1" stop-color="#b9b9ae"/></radialGradient>' +
    '<radialGradient id="nu-halo"><stop offset="0" stop-color="#d8e0f8" stop-opacity=".4"/><stop offset="1" stop-color="#d8e0f8" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="nu-warm"><stop offset="0" stop-color="#ffd27a" stop-opacity=".6"/><stop offset=".35" stop-color="#f0a845" stop-opacity=".2"/><stop offset="1" stop-color="#f0a845" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="nu-cold"><stop offset="0" stop-color="#cfe8ff" stop-opacity=".75"/><stop offset=".4" stop-color="#7ca8d6" stop-opacity=".22"/><stop offset="1" stop-color="#7ca8d6" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="nu-blue"><stop offset="0" stop-color="#e8f4ff" stop-opacity=".95"/><stop offset=".3" stop-color="#6aa8ff" stop-opacity=".6"/><stop offset="1" stop-color="#2a5aff" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="nu-fire"><stop offset="0" stop-color="#ffcf73" stop-opacity=".9"/><stop offset=".3" stop-color="#ff8a2e" stop-opacity=".4"/><stop offset="1" stop-color="#ff6a1e" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="nu-coin"><stop offset="0" stop-color="#f0e2b0"/><stop offset=".7" stop-color="#b09a5a"/><stop offset="1" stop-color="#6c5a30"/></radialGradient>' +
    '<pattern id="nu-roses" width="70" height="80" patternUnits="userSpaceOnUse"><path d="M35 0v80" stroke="#5a4a54" stroke-width="1" opacity=".35"/>' +
      '<g opacity=".4"><circle cx="35" cy="22" r="7" fill="#6a3a46"/><path d="M30 22q5-6 10 0q-5 5-10 0z" fill="#8a4a56"/><path d="M27 32q8 4 16 0" stroke="#3e5a40" stroke-width="2" fill="none"/>' +
      '<circle cx="0" cy="62" r="6" fill="#6a3a46"/><circle cx="70" cy="62" r="6" fill="#6a3a46"/><path d="M-6 70q6 4 12 0M64 70q6 4 12 0" stroke="#3e5a40" stroke-width="2" fill="none"/></g></pattern>' +
    '<pattern id="nu-grain" width="60" height="8" patternUnits="userSpaceOnUse"><path d="M0 2q15 2 30 0t30 0M0 6q20 -1.6 40 0t20 0" stroke="#000" stroke-opacity=".25" fill="none" stroke-width=".8"/></pattern>' +
    '<filter id="nu-blur6" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>' +
    '<filter id="nu-blur18" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="18"/></filter>' +
    '<filter id="nu-blur3"><feGaussianBlur stdDeviation="2.4"/></filter>' +
    '</defs>';

  // ───────────────────────── layer: sky (the back wall, the window and the night beyond it) ─────────────────────────
  var WIN = [480, 150, 150, 220];   // x, y, w, h
  function sky() {
    var r = rng(31), s = '<rect width="1600" height="900" fill="#1a141c"/>';
    // the night through the window: moon, a bare branch, stars
    s += '<rect x="' + (WIN[0] - 10) + '" y="' + (WIN[1] - 10) + '" width="' + (WIN[2] + 20) + '" height="' + (WIN[3] + 20) + '" fill="url(#nu-night)"/>';
    for (var i = 0; i < 12; i++) s += '<circle cx="' + f1(WIN[0] + r() * WIN[2]) + '" cy="' + f1(WIN[1] + r() * WIN[3] * 0.6) + '" r="' + f1(0.6 + r() * 0.9) + '" fill="#e9ecf7" opacity="' + f1(0.3 + r() * 0.5) + '"' + (r() < 0.4 ? ' class="tw"' : '') + '/>';
    s += '<circle cx="590" cy="200" r="60" fill="url(#nu-halo)"/><circle cx="590" cy="200" r="20" fill="url(#nu-moon)"/>';
    s += '<g class="nu-branch" style="transform-origin:460px 260px"><path d="M460 260c40-10 70-30 110-30M520 246c10-20 30-30 40-46M560 232c20 4 40 20 60 24" stroke="#05060a" stroke-width="4" fill="none"/></g>';
    // a small figure that sometimes stands outside the window (once the Haunting knows your name)
    s += '<g class="nu-child"><path d="M600 370v-38q0-10 9-10t9 10v38z" fill="#05060a"/><circle cx="609" cy="314" r="9" fill="#05060a"/></g>';
    return s;
  }

  // ───────────────────────── layer: far (walls, wainscot, the window frame, the mobile) ─────────────────────────
  function far() {
    var s = '', winCut = 'M' + WIN[0] + ' ' + WIN[1] + 'h' + WIN[2] + 'v' + WIN[3] + 'h-' + WIN[2] + 'z';
    var wall = 'M' + BW[0] + ' ' + TOP + 'H' + BW[1] + 'V' + FY + 'H' + BW[0] + 'z';
    s += '<path fill-rule="evenodd" d="' + wall + winCut + '" fill="url(#nu-paper)"/><path fill-rule="evenodd" d="' + wall + winCut + '" fill="url(#nu-roses)"/>';
    // the side walls and the ceiling
    var cx = function (side) { return side < 0 ? BW[0] - TOP / slopeC : BW[1] + TOP / slopeC; };
    s += '<path d="M0 0H' + f1(cx(-1)) + 'L' + BW[0] + ' ' + TOP + 'V' + FY + 'L0 ' + f1(floorY(0)) + 'z" fill="url(#nu-wallL)"/><path d="M0 0H' + f1(cx(-1)) + 'L' + BW[0] + ' ' + TOP + 'V' + FY + 'L0 ' + f1(floorY(0)) + 'z" fill="url(#nu-roses)" opacity=".5"/>';
    s += '<path d="M1600 0H' + f1(cx(1)) + 'L' + BW[1] + ' ' + TOP + 'V' + FY + 'L1600 ' + f1(floorY(1600)) + 'z" fill="url(#nu-wallR)"/><path d="M1600 0H' + f1(cx(1)) + 'L' + BW[1] + ' ' + TOP + 'V' + FY + 'L1600 ' + f1(floorY(1600)) + 'z" fill="url(#nu-roses)" opacity=".45"/>';
    s += '<path d="M' + f1(cx(-1)) + ' 0L' + BW[0] + ' ' + TOP + 'H' + BW[1] + 'L' + f1(cx(1)) + ' 0z" fill="#0e0a0e"/>';
    s += '<path d="M' + BW[0] + ' ' + TOP + 'H' + BW[1] + '" stroke="#5a4a40" stroke-width="6" opacity=".6"/>';
    // wainscot panels along the back wall, and a picture rail
    s += '<path d="M' + BW[0] + ' 470H' + BW[1] + 'V' + FY + 'H' + BW[0] + 'z" fill="url(#nu-panel)"/><path d="M' + BW[0] + ' 470H' + BW[1] + '" stroke="#7a5a3a" stroke-width="5"/>';
    for (var p = 0; p < 10; p++) s += '<rect x="' + (BW[0] + 14 + p * 100) + '" y="486" width="72" height="96" rx="3" fill="none" stroke="#1d130b" stroke-width="3"/>';
    s += '<path d="M' + BW[0] + ' 130H' + BW[1] + '" stroke="#3a2c24" stroke-width="4"/>';
    // the window frame: cross mullions, a deep sill, a torn curtain
    s += '<path d="' + winCut + '" fill="none" stroke="#2a1d14" stroke-width="12"/><path d="M' + (WIN[0] + WIN[2] / 2) + ' ' + WIN[1] + 'v' + WIN[3] + 'M' + WIN[0] + ' ' + (WIN[1] + WIN[3] * 0.45) + 'h' + WIN[2] + '" stroke="#2a1d14" stroke-width="6"/>';
    s += '<path d="M' + (WIN[0] - 18) + ' ' + (WIN[1] + WIN[3] + 6) + 'h' + (WIN[2] + 36) + 'v12h-' + (WIN[2] + 36) + 'z" fill="#4a3424"/>';
    s += '<g class="nu-curtain" style="transform-origin:' + (WIN[0] + WIN[2]) + 'px ' + (WIN[1] - 14) + 'px"><path d="M' + (WIN[0] + WIN[2] - 40) + ' ' + (WIN[1] - 14) + 'h70v260l-12-16-10 24-14-30-10 18-12-24z" fill="#6a5a6a" opacity=".85"/><path d="M' + (WIN[0] + WIN[2] - 30) + ' ' + (WIN[1] - 10) + 'v240M' + (WIN[0] + WIN[2] - 10) + ' ' + (WIN[1] - 10) + 'v250M' + (WIN[0] + WIN[2] + 12) + ' ' + (WIN[1] - 10) + 'v236" stroke="#3a2e3a" stroke-width="2"/></g>';
    s += '<path d="M' + (WIN[0] - 50) + ' ' + (WIN[1] - 16) + 'h' + (WIN[2] + 100) + '" stroke="#2a1d14" stroke-width="5"/>';
    // moonlight falling from the window to the floor (fades as the Haunting rises: class win)
    s += '<g class="win lit" data-w="0"><path class="wglow" d="M' + WIN[0] + ' ' + (WIN[1] + WIN[3]) + 'L' + (WIN[0] + 120) + ' 900H' + (WIN[0] + WIN[2] + 360) + 'L' + (WIN[0] + WIN[2]) + ' ' + (WIN[1] + WIN[3]) + 'z" fill="url(#nu-moonbeam)"/></g>';
    // the stains: a few at first, spreading with each phase
    s += '<g class="nu-stains" fill="#5a0e18"><path class="st1" d="M880 130q10 40 4 90 8 20 0 40-6-30-4-60-10-30 0-70z" opacity=".55"/><path class="st1" d="M380 380q30 6 40 30t-10 40q-20-10-34-30z" opacity=".45"/>' +
      '<path class="st2" d="M1000 140q14 60 6 110q10 40-2 60-8-40-6-80-8-50 2-90zM1080 300q24 0 30 20t-20 30q-20-6-18-26z"/><path class="st2" d="M700 250q10 4 14 30-6 20-14 10-6-20 0-40z"/>' +
      '<path class="st3" d="M320 160q40 30 30 90 20 50 0 110-20-60-30-100-14-60 0-100zM1250 200q-30 50-20 120 10 60 30 90 6-80-10-210z"/></g>';
    // child handprints on the wainscot, late
    s += '<g class="nu-hands" fill="#6a1420">' + [[420, 500, 0], [460, 530, 14], [1180, 510, -10], [1220, 490, 6], [760, 520, -4]].map(function (h) { return '<path transform="rotate(' + h[2] + ' ' + h[0] + ' ' + h[1] + ')" d="M' + h[0] + ' ' + h[1] + 'c2-7 6-8 7-3 1-5 5-5 5 1 2-4 5-2 4 3l-3 10c-2 4-10 4-12-1z"/>'; }).join('') + '</g>';
    // a scrawl across the paper above the cradles, last phase only
    s += '<g class="nu-scrawl" stroke="#8a1f2a" stroke-width="4" fill="none" stroke-linecap="round"><path d="M700 232v-32l10 16 10-16v32M734 200v32M748 232v-32l16 32v-32M778 200v32M778 200h14M778 216h10M778 232h14"/></g>';
    // a little shelf of toys: a doll facing the wall like the cradles
    s += '<path d="M1110 230h120" stroke="#4a3424" stroke-width="6"/><g transform="translate(1130 196)"><rect x="0" y="12" width="20" height="22" rx="4" fill="#6a5a6a"/><circle cx="10" cy="8" r="8" fill="#c8bca8"/><path d="M2 6q8-10 16 0" stroke="#3a2a1a" stroke-width="4" fill="none"/></g><g transform="translate(1180 208)"><rect width="18" height="18" fill="#7a2f3a"/><path d="M4 4h10M9 4v10" stroke="#d8c8a8" stroke-width="2"/></g>';
    return s;
  }

  // ───────────────────────── layer: mid (the mobile, the dresser, the candles) ─────────────────────────
  function mid() {
    var s = '';
    // the mobile over the rocking cradle: birds and moons on threads, turning the wrong way
    s += '<path d="M840 0V110" stroke="#1a1410" stroke-width="2"/><g class="nu-mobile" style="transform-origin:840px 110px"><path d="M780 110h120" stroke="#3a2a1a" stroke-width="3"/>' +
      [[784, 150, 'm'], [810, 170, 'b'], [840, 140, 'm'], [870, 172, 'b'], [896, 152, 'm']].map(function (m) {
        var x = m[0], y = m[1];
        return '<path d="M' + x + ' 110V' + (y - 8) + '" stroke="#5a4a3a" stroke-width="1"/>' + (m[2] === 'm' ? '<path d="M' + (x + 6) + ' ' + (y - 8) + 'a9 9 0 1 0 0 16a7 7 0 1 1 0-16z" fill="#c8bca0"/>' : '<path d="M' + (x - 10) + ' ' + y + 'q5-6 10 0q5-6 10 0l-5 3q-5 4-10 0z" fill="#8a7a6a"/>');
      }).join('') + '</g>';
    // a dresser against the right wall, in perspective, a basin and jug on it
    s += '<path d="M1360 650V500l120 30v148z" fill="url(#nu-woodv)"/><path d="M1360 500l120 30 40-10-120-30z" fill="#7a5a3a"/><path d="M1370 540l100 25M1370 590l100 26M1370 630l100 26" stroke="#1d130b" stroke-width="3"/>';
    s += '<ellipse cx="1430" cy="508" rx="28" ry="7" fill="#c8c0b0"/><path d="M1452 506v-30q10-4 14 6l-4 26z" fill="#b0a898"/>';
    // the stool by the cradle with its night-candle, and the mantel candles (the Haunting snuffs them)
    s += '<path d="M672 690l8-50h40l8 50M676 668h48" stroke="#3a2618" stroke-width="6" fill="none"/><path d="M670 640h60v-8h-60z" fill="#5a3d26"/>';
    [[700, 630, 0], [1150, 380, 1], [1250, 380, 2]].forEach(function (c) {
      var x = c[0], y = c[1];
      s += '<g class="slant nu-cand" data-l="' + c[2] + '"><circle class="lglow" cx="' + x + '" cy="' + (y - 20) + '" r="70" fill="url(#nu-warm)"/>' +
        '<path d="M' + (x - 10) + ' ' + y + 'h20" stroke="#5a4a3a" stroke-width="4"/><rect x="' + (x - 4) + '" y="' + (y - 22) + '" width="8" height="22" fill="#e2d6b4"/>' +
        '<path class="lflame" d="M' + x + ' ' + (y - 24) + 'c-5-5-3-10 0-17 3 7 5 12 0 17z" fill="#ffc861"/>' +
        '<path class="lsmoke" d="M' + x + ' ' + (y - 32) + 'c-6-10 6-16 0-28" stroke="#9aa3b5" stroke-width="3" fill="none" opacity="0"/></g>';
    });
    return s;
  }

  // ───────────────────────── layer: ground (floorboards) ─────────────────────────
  var groundCache = null;
  function ground() {
    if (groundCache) return groundCache;
    var r = rng(17), s = '<path d="M0 ' + f1(floorY(0)) + 'L' + BW[0] + ' ' + FY + 'H' + BW[1] + 'L1600 ' + f1(floorY(1600)) + 'V900H0z" fill="url(#nu-floor)"/>';
    // boards run toward the back wall: lines from the vanishing point; staggered joints
    var b = '';
    for (var i = -14; i <= 14; i++) { var xb = BW[0] + (i + 14) * (BW[1] - BW[0]) / 28 - 0, x2 = VP[0] + (xb - VP[0]) * ((900 - VP[1]) / (FY - VP[1])); b += 'M' + f1(xb) + ' ' + FY + 'L' + f1(x2) + ' 900'; }
    s += '<path d="' + b + '" stroke="#140c08" stroke-width="2" opacity=".8"/>';
    for (var j = 0; j < 40; j++) { var t = r(), y = FY + 6 + t * t * 290, w = 30 + t * 120, x = VP[0] + (r() - 0.5) * (BW[1] - BW[0]) * (1 + t * 1.6); s += '<path d="M' + f1(x) + ' ' + f1(y) + 'h' + f1(w * 0.1) + '" stroke="#140c08" stroke-width="' + f1(1 + t * 2) + '"/>'; }
    s += '<path d="M0 ' + f1(floorY(0)) + 'L' + BW[0] + ' ' + FY + 'H' + BW[1] + 'L1600 ' + f1(floorY(1600)) + 'V900H0z" fill="url(#nu-grain)" opacity=".6"/>';
    // a rag rug under the rocking cradle, the old stain the room is named for
    s += '<ellipse cx="840" cy="720" rx="230" ry="50" fill="#4a3a4a" opacity=".7"/><ellipse cx="840" cy="720" rx="200" ry="40" fill="none" stroke="#6a5a5a" stroke-width="4" stroke-dasharray="10 6" opacity=".6"/>';
    s += '<path d="M600 780q60-20 120 6t90 40q-80 20-160 6t-50-52z" fill="#3a0a10" opacity=".75"/><path class="nu-fresh" d="M620 790q50-14 100 4t70 30q-60 16-130 4z" fill="#7a0e1a" opacity="0"/>';
    // moonlight on the floor, candle pools
    s += '<path d="M500 610L620 900H990L630 610z" fill="#b8c8f0" opacity=".05"/>';
    [[700, 0, 700], [1150, 1, 610], [1250, 2, 610]].forEach(function (c) { s += '<ellipse class="lpool" data-lp="' + c[1] + '" cx="' + c[0] + '" cy="' + c[2] + '" rx="140" ry="28" fill="url(#nu-warm)"/>'; });
    // a dropped rattle, a wooden block
    s += '<g transform="translate(1080 840) rotate(-20)"><circle r="12" fill="#8a7a5a"/><path d="M10 4l40 10" stroke="#6a5a3a" stroke-width="5"/></g><rect x="420" y="820" width="30" height="30" fill="#5a3a4a" transform="rotate(12 435 835)"/><path d="M428 828h14M435 828v14" stroke="#d8c8a8" stroke-width="2" transform="rotate(12 435 835)"/>';
    groundCache = s;
    return s;
  }

  // ───────────────────────── objects ─────────────────────────
  // a cradle seen from behind (it faces the wall): hood back, body, rockers. s = scale, cx/base = centre and floor
  function crib(cx, base, sc, cls, extra) {
    var w = 120 * sc, h = 70 * sc, hood = 60 * sc, x = cx - w / 2, y = base - 22 * sc - h;
    var s = '<g class="' + cls + '" style="transform-origin:' + f1(cx) + 'px ' + f1(base) + 'px">';
    s += '<ellipse cx="' + f1(cx) + '" cy="' + f1(base + 2) + '" rx="' + f1(w * 0.62) + '" ry="' + f1(9 * sc) + '" fill="#000" opacity=".4"/>';
    s += '<g class="nu-body">';
    // rockers
    s += '<path d="M' + f1(x - 10 * sc) + ' ' + f1(base - 14 * sc) + 'Q' + f1(cx) + ' ' + f1(base + 10 * sc) + ' ' + f1(x + w + 10 * sc) + ' ' + f1(base - 14 * sc) + '" stroke="#2a1a0e" stroke-width="' + f1(8 * sc) + '" fill="none" stroke-linecap="round"/>';
    s += '<path d="M' + f1(x + 12 * sc) + ' ' + f1(base - 6 * sc) + 'V' + f1(y + h) + 'M' + f1(x + w - 12 * sc) + ' ' + f1(base - 6 * sc) + 'V' + f1(y + h) + '" stroke="#3a2618" stroke-width="' + f1(7 * sc) + '"/>';
    // body
    s += '<path d="M' + f1(x) + ' ' + f1(y) + 'h' + f1(w) + 'l-' + f1(6 * sc) + ' ' + f1(h) + 'h-' + f1(w - 12 * sc) + 'z" fill="url(#nu-wood)"/><path d="M' + f1(x) + ' ' + f1(y) + 'h' + f1(w) + 'l-' + f1(6 * sc) + ' ' + f1(h) + 'h-' + f1(w - 12 * sc) + 'z" fill="url(#nu-grain)"/>';
    var sl = ''; for (var i = 1; i < 6; i++) sl += 'M' + f1(x + i * w / 6) + ' ' + f1(y + 8 * sc) + 'v' + f1(h - 16 * sc);
    s += '<path d="' + sl + '" stroke="#1d130b" stroke-width="' + f1(2 * sc) + '"/><path d="M' + f1(x) + ' ' + f1(y) + 'h' + f1(w) + '" stroke="#8a6a44" stroke-width="' + f1(3 * sc) + '"/>';
    // the hood, its back to you
    s += '<path d="M' + f1(x + w - 4 * sc) + ' ' + f1(y + 2) + 'V' + f1(y - hood * 0.55) + 'Q' + f1(x + w - 4 * sc) + ' ' + f1(y - hood) + ' ' + f1(x + w - 50 * sc) + ' ' + f1(y - hood) + 'Q' + f1(x + w - 90 * sc) + ' ' + f1(y - hood) + ' ' + f1(x + w - 92 * sc) + ' ' + f1(y + 2) + 'z" fill="url(#nu-woodv)"/>';
    s += '<path d="M' + f1(x + w - 14 * sc) + ' ' + f1(y - hood * 0.5) + 'Q' + f1(x + w - 14 * sc) + ' ' + f1(y - hood * 0.85) + ' ' + f1(x + w - 50 * sc) + ' ' + f1(y - hood * 0.88) + '" stroke="#8a6a44" stroke-width="' + f1(2 * sc) + '" fill="none" opacity=".6"/>';
    s += (extra || '') + '</g></g>';
    return s;
  }
  function cradlesArt() {
    var s = '';
    // five cradles in a row against the back wall, all facing it
    [[380, 612, 0.9], [490, 614, 0.9], [600, 612, 0.9], [1010, 612, 0.9], [1110, 614, 0.9]].forEach(function (c, i) {
      s += crib(c[0], c[1], c[2], 'nu-crib c' + i, '<circle class="nu-eye" cx="' + f1(c[0] - 26) + '" cy="' + f1(c[1] - 70) + '" r="2.4" fill="#e8f0ff"/><circle class="nu-eye" cx="' + f1(c[0] - 16) + '" cy="' + f1(c[1] - 70) + '" r="2.4" fill="#e8f0ff"/>');
    });
    // the list of names, found under a mattress (state "searched")
    s += '<g class="nu-names"><path d="M470 560l50-6 6 48-50 6z" fill="#e0d6b4"/><path d="M478 568h36M478 576h30M478 584h34M478 592h28" stroke="#5c4a30" stroke-width="1.6"/><ellipse cx="500" cy="594" rx="18" ry="6" fill="none" stroke="#8a1f2a" stroke-width="1.6"/><circle class="nu-nameglow" cx="498" cy="580" r="40" fill="url(#nu-warm)"/></g>';
    return s;
  }
  function rockerArt() {
    // the one that rocks: nearer, bigger, a blanket edge trailing over the side
    var s = crib(850, 712, 1.55, 'nu-rock',
      '<path d="M780 600q-8 30 4 52l10-4q-6-24 2-44z" fill="#c8bcd0" opacity=".85"/>' +
      '<g class="nu-coin-in"><ellipse cx="830" cy="588" rx="8" ry="3" fill="url(#nu-coin)"/></g>' +
      '<g class="nu-char"><path d="M766 588h168l-10 108H776z" fill="#0c0806" opacity=".9"/><path d="M790 600l20 40M860 596l-10 50M900 610l-20 30" stroke="#3a1a0a" stroke-width="3"/></g>' +
      '<g class="nu-frost"><path d="M766 588h168l-10 108H776z" fill="#cfe8ff" opacity=".28"/><path d="M780 600l14 10-6 14M910 604l-12 12 4 14M850 596v18" stroke="#e8f6ff" stroke-width="1.6" fill="none"/></g>');
    // breath from inside the hood
    // a pale wisp that rises when the voice is answered
    // small cold hands reaching out (fail)
    s += '<g class="nu-grasp" fill="#dfe8f4" opacity="0"><path d="M790 570c-6-14-2-26 4-22 0-8 6-8 6 0 2-6 8-4 6 4l-2 22z"/><path d="M906 566c6-14 2-26-4-22 0-8-6-8-6 0-2-6-8-4-6 4l2 22z"/></g>';
    // blue then white fire, when it is burned
    return s;
  }
  // glows, blurs and effects kept out of the hover-filtered bodies (see js/stage.js objectsSvg)
  function cradlesOver() { return '<g class="nu-dustup"><ellipse cx="490" cy="580" rx="150" ry="40" fill="#a39a8a" opacity=".35" filter="url(#nu-blur6)"/><ellipse cx="1060" cy="580" rx="110" ry="34" fill="#a39a8a" opacity=".3" filter="url(#nu-blur6)"/></g>'; }
  function rockerUnder() { return '<circle class="nu-coldlight" cx="850" cy="580" r="160" fill="url(#nu-cold)" opacity=".25"/>'; }
  function rockerOver() { return '<g class="nu-breath"><ellipse cx="900" cy="560" rx="16" ry="8" fill="#d8e4f0" opacity=".3" filter="url(#nu-blur3)"/><ellipse cx="910" cy="540" rx="12" ry="6" fill="#d8e4f0" opacity=".2" filter="url(#nu-blur3)" style="animation-delay:-1.6s"/></g>' + '<path class="nu-wisp" d="M880 560c-20-40 20-60 0-110s20-70 0-120" stroke="#cfe8ff" stroke-width="10" fill="none" stroke-linecap="round" opacity="0" filter="url(#nu-blur3)"/>' + '<g class="nu-flames" opacity="0"><circle cx="850" cy="600" r="160" fill="url(#nu-blue)"/><path d="M800 640c-20-40 10-70 10-110 20 30 30 60 20 110zM850 640c-24-60 6-110 6-160 30 50 34 100 20 160zM900 640c-14-30 6-60 6-90 16 26 22 50 12 90z" fill="#bfe0ff"/><path d="M850 640c-10-30 2-60 4-90 12 30 14 60 6 90z" fill="#fff"/></g>'; }

  function hearthArt() {
    var s = '<ellipse cx="1200" cy="604" rx="110" ry="10" fill="#000" opacity=".4"/>';
    // the chimney breast, the firebox, the mantel
    s += '<path d="M1110 600V400h180v200z" fill="url(#nu-brick)"/><path d="M1110 420h180M1110 450h180M1110 480h180M1110 510h180M1110 540h180M1110 570h180" stroke="#1a0e0a" stroke-width="1.6" opacity=".7"/>';
    s += '<path d="M1140 600V500q0-30 60-30t60 30v100z" fill="#0a0606"/><path d="M1146 600V504q0-26 54-26t54 26v96" fill="none" stroke="#3a2a22" stroke-width="3"/>';
    s += '<path d="M1096 394h208v14h-208z" fill="#5a3d26"/><path d="M1096 394h208" stroke="#8a6a44" stroke-width="2"/>';
    // a stopped clock on the mantel and a tin of lamp oil by the grate
    s += '<g transform="translate(1200 362)"><rect x="-14" y="-6" width="28" height="32" rx="4" fill="#3a2a1a"/><circle cy="6" r="10" fill="#d8ccb0"/><path d="M0 6v-7M0 6l5 3" stroke="#1a1410" stroke-width="1.6"/></g>';
    s += '<g transform="translate(1272 572)"><rect width="18" height="26" rx="2" fill="#5a5a3a"/><rect x="5" y="-5" width="8" height="6" fill="#3a3a2a"/><path d="M3 10h12" stroke="#c9a35b" stroke-width="1.6"/></g>';
    // cold ash and kindling; the fire itself, which only shows in its outcomes and once the cradle has burned
    s += '<path d="M1160 596h80l-6-10h-68z" fill="#2a2420"/><path d="M1168 588l30-12M1232 588l-34-14M1182 584l36 2" stroke="#3a2618" stroke-width="5" stroke-linecap="round"/>';
    s += '<g class="nu-embers"><circle cx="1186" cy="590" r="3" fill="#ff7a2a"/><circle cx="1210" cy="592" r="2.4" fill="#ff7a2a"/><circle cx="1220" cy="588" r="2" fill="#ff9a3a"/></g>';
    // fire climbing the wall (fail)
    return s;
  }
  function hearthOver() { return '<g class="nu-hfire" opacity="0"><circle cx="1200" cy="560" r="120" fill="url(#nu-fire)"/><path class="hf1" d="M1200 590c-24-24-8-50 0-80 10 30 26 50 0 80z" fill="#ff9d3a"/><path class="hf2" d="M1200 590c-12-12-4-28 0-44 5 16 14 28 0 44z" fill="#ffe08a"/></g>' + '<g class="nu-spread" opacity="0"><path d="M1110 420c-30-60 10-100 0-160 30 50 40 100 20 160zM1290 440c30-70-6-110 4-180-34 60-40 110-24 180zM1160 400c-10-40 20-70 10-110 24 40 26 70 10 110z" fill="#ff7a2a" opacity=".85"/><circle cx="1200" cy="340" r="200" fill="url(#nu-fire)"/></g>'; }
  function saucerOver() { return '<circle class="nu-gglow" cx="1010" cy="778" r="70" fill="url(#nu-warm)" opacity="0"/><ellipse class="nu-ring" cx="1010" cy="782" rx="40" ry="10" fill="none" stroke="#ffe08a" stroke-width="2" opacity="0"/>'; }

  function saucerArt() {
    var s = '<ellipse cx="1010" cy="790" rx="56" ry="11" fill="#000" opacity=".4"/>';
    s += '<ellipse cx="1010" cy="784" rx="48" ry="12" fill="#c8c0b0"/><ellipse cx="1010" cy="782" rx="36" ry="8" fill="#a8a090"/><path d="M964 784a48 12 0 0 0 92 0" stroke="#6a6458" stroke-width="2" fill="none"/>';
    s += '<path d="M984 778q6-6 12 0M1018 778q6-6 12 0" stroke="#3a6a8a" stroke-width="1.6" fill="none" opacity=".7"/>';
    // the old coins others have left; one more when you give
    s += [[996, 780], [1012, 778], [1024, 782]].map(function (c) { return '<ellipse cx="' + c[0] + '" cy="' + c[1] + '" rx="7" ry="2.6" fill="url(#nu-coin)" stroke="#5a4a24" stroke-width=".6"/>'; }).join('');
    s += '<g class="nu-mycoin"><ellipse cx="1008" cy="774" rx="7" ry="2.6" fill="url(#nu-coin)" stroke="#5a4a24" stroke-width=".6"/></g>';
    return s;
  }

  // ───────────────────────── layer: foreground ─────────────────────────
  function fore() {
    var s = '<g fill="#060407">';
    // the door you came in by, ajar at the left edge
    s += '<path d="M0 0H70V900H0z"/><path d="M70 40L150 70V860L70 900z"/>';
    // a rocking horse at the right, nose to the wall like everything else here
    s += '<g class="nu-horse" style="transform-origin:1440px 900px"><path d="M1340 880q100 40 220 0" stroke="#060407" stroke-width="14" fill="none"/><path d="M1370 870l20-80M1520 870l-14-80" stroke="#060407" stroke-width="10"/>' +
      '<path d="M1370 800q0-40 60-44h70q40 0 50 20l20-30q14-20 30-10l10 40q-6 20-30 20l-20 30q-20 24-60 24h-80q-50 0-50-50z"/></g>';
    s += '</g><path d="M70 40L150 70V860" stroke="#3a2a22" stroke-width="2" fill="none" opacity=".6"/><path d="M1384 770q40-16 110-12" stroke="#4a3a3a" stroke-width="2" fill="none" opacity=".5"/>';
    return s;
  }

  function fog(front) {
    if (!front) return '<g class="fogb"><ellipse cx="800" cy="620" rx="560" ry="30" fill="#8a90a8" opacity=".12" filter="url(#nu-blur18)"/></g>';
    return '<g class="fogf"><ellipse cx="600" cy="880" rx="520" ry="50" fill="#8a90a8" opacity=".14" filter="url(#nu-blur18)"/><ellipse cx="1200" cy="870" rx="480" ry="50" fill="#a0a4b8" opacity=".12" filter="url(#nu-blur18)"/></g>';
  }

  var EXTRA = {
    rocker: function () { return '<ellipse class="nu-breath2" cx="905" cy="548" rx="12" ry="6" fill="#d8e4f0" opacity=".35" filter="url(#nu-blur3)"/>'; }
  };

  SC.register({
    id: 'nursery',
    vb: [1600, 900],
    defs: DEFS,
    layers: function () {
      return [
        { id: 'sky', depth: 0.1, svg: sky(), src: 'art/nursery/sky.webp' },
        { id: 'far', depth: 0.2, svg: far(), src: 'art/nursery/far.webp' },
        { id: 'fogb', depth: 0.3, svg: fog(false), cls: 'fog' },
        { id: 'mid', depth: 0.42, svg: mid(), src: 'art/nursery/mid.webp' },
        { id: 'ground', depth: 0.62, svg: ground(), src: 'art/nursery/ground.webp' },
        { id: 'objects', depth: 0.62, objects: true },
        { id: 'fogf', depth: 0.85, svg: fog(true), cls: 'fog' },
        { id: 'fore', depth: 1.15, svg: fore(), src: 'art/nursery/fore.webp' }
      ];
    },
    // drawn back to front: the row of cradles and the hearth stand against the wall, the rocking cradle and the saucer
    // are out in the room
    objects: {
      cradles: { name: 'Six Cradles', art: cradlesArt, over: cradlesOver, box: [310, 480, 360, 150], at: [490, 560], crop: [300, 440, 420, 236], z: 1.7, sfx: 'creak', layer: ['far', 'ground'],
        actions: [{ opt: 'inspect' }], blurb: 'All of them face the wall.' },
      hearth: { name: 'The Cold Hearth', art: hearthArt, over: hearthOver, box: [1100, 340, 200, 270], at: [1200, 520], crop: [1060, 380, 280, 158], z: 1.9, sfx: 'ignite', layer: ['far', 'ground'],
        actions: [{ opt: 'burn' }], blurb: 'Kindling laid, never lit. A tin of lamp oil.' },
      rocker: { name: 'The Rocking Cradle', art: rockerArt, under: rockerUnder, over: rockerOver, box: [740, 480, 230, 250], at: [850, 620], crop: [690, 470, 320, 180], z: 1.8, sfx: 'whisper', layer: ['far', 'ground'],
        actions: [{ opt: 'answer' }], blurb: 'It asks whether you have come to collect your child.' },
      saucer: { name: 'The Coin Saucer', art: saucerArt, over: saucerOver, box: [950, 750, 120, 70], at: [1010, 782], crop: [930, 730, 160, 90], z: 2.3, sfx: 'coin', layer: ['ground'],
        actions: [{ opt: 'gift' }], blurb: 'Others have paid. The coins are very old.' }
    },
    extra: EXTRA,
    state: function (root, st) {
      var q = function (s) { return root.querySelector(s); };
      var tg = function (sel, cls, on) { var e = q(sel); if (e) e.classList.toggle(cls, !!on); };
      var wf = st.wflags || {}, burned = !!(st.curses && st.curses.cradle === false);   // only a successful burning cleanses it
      var gifted = st.done.gift || !!wf.nursery_gifted, attached = !!wf.cradle_attached;
      tg('.obj-rocker', 'burned', burned);
      tg('.obj-rocker', 'attached', attached && !burned);
      tg('.obj-rocker', 'still', burned || attached || st.done.answer);
      tg('.obj-rocker', 'gifted', gifted && !burned);
      tg('.obj-cradles', 'searched', st.done.inspect);
      tg('.obj-hearth', 'lit', burned || st.done.burn);   // the fire was lit either way
      tg('.obj-saucer', 'given', gifted);
    },
    fx: {
      rocker: function (el, tier) { return tier === 'ok' || tier === 'crit' ? 'hush' : tier === 'fumble' ? 'all' : 'grasp'; },
      cradles: function (el, tier) { return tier === 'ok' || tier === 'crit' ? 'names' : 'turn'; },
      hearth: function (el, tier) { return tier === 'ok' || tier === 'crit' ? 'blaze' : 'spread'; },
      saucer: function () { return 'clink'; }
    },
    fxSfx: { hush: 'whisper', grasp: 'sanity', all: 'whisper', names: 'paper', turn: 'creak', blaze: 'ignite', spread: 'ignite', clink: 'coin' }
  });
})(window);
