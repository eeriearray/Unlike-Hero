/* Mafia — the town hall backdrop: an illustrated interior with three arched windows onto the town.
   Every colour is a CSS variable, so body.phase-* classes repaint it for dusk, night, dawn, day and trial
   (see "Scene palette" in css/mafia.css). */
(function () {
  'use strict';
  var W = 1600, H = 900;
  var windows = [400, 800, 1200];
  function arch(cx) { var x0 = cx - 115, x1 = cx + 115; return 'M' + x0 + ' 585 V245 A115 115 0 0 1 ' + x1 + ' 245 V585 Z'; }

  // Deterministic little random so the skyline is the same on every load.
  var seed = 7;
  function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }

  function skyline(base, minH, maxH, cls, lit) {
    var x = 180, d = 'M180 ' + H, wins = '';
    while (x < 1420) {
      var w = 36 + rnd() * 60, h = minH + rnd() * (maxH - minH), top = base - h;
      d += ' L' + x.toFixed(0) + ' ' + top.toFixed(0);
      if (rnd() < 0.3) { d += ' L' + (x + w / 2).toFixed(0) + ' ' + (top - 18 - rnd() * 20).toFixed(0); } // gable
      d += ' L' + (x + w).toFixed(0) + ' ' + top.toFixed(0);
      if (lit) {
        for (var wy = top + 12; wy < base - 10; wy += 22) {
          for (var wx = x + 8; wx < x + w - 10; wx += 16) if (rnd() < 0.35) wins += '<rect x="' + wx.toFixed(0) + '" y="' + wy.toFixed(0) + '" width="6" height="9" />';
        }
      }
      x += w + rnd() * 6;
    }
    d += ' L1420 ' + H + ' Z';
    return '<path class="' + cls + '" d="' + d + '"/>' + (lit ? '<g class="lit">' + wins + '</g>' : '');
  }

  function stars() {
    var s = '';
    for (var i = 0; i < 70; i++) s += '<circle cx="' + (180 + rnd() * 1240).toFixed(0) + '" cy="' + (140 + rnd() * 260).toFixed(0) + '" r="' + (0.6 + rnd() * 1.4).toFixed(1) + '"/>';
    return s;
  }

  function planks() {
    var s = '';
    for (var i = -12; i <= 12; i++) s += '<line x1="' + (800 + i * 26) + '" y1="700" x2="' + (800 + i * 170) + '" y2="900"/>';
    for (var y = 0; y < 5; y++) { var yy = 700 + Math.pow(y / 5, 1.6) * 200; s += '<line x1="0" y1="' + yy.toFixed(0) + '" x2="1600" y2="' + yy.toFixed(0) + '" opacity=".35"/>'; }
    return s;
  }

  function portrait(x) {
    return '<g transform="translate(' + x + ' 300)">' +
      '<rect x="-48" y="-62" width="96" height="124" rx="4" class="frame"/>' +
      '<rect x="-38" y="-52" width="76" height="104" class="canvas"/>' +
      '<circle cx="0" cy="-12" r="16" class="sitter"/><path d="M-30 52 C-26 18 26 18 30 52 Z" class="sitter"/>' +
      '</g>';
  }

  function sconce(x) {
    return '<g transform="translate(' + x + ' 470)"><circle r="70" class="lampglow"/><rect x="-5" y="0" width="10" height="26" class="brass"/>' +
      '<rect x="-3" y="-16" width="6" height="16" class="candle"/><ellipse cx="0" cy="-22" rx="4" ry="8" class="flame"/></g>';
  }

  var winClip = windows.map(function (cx) { return '<path d="' + arch(cx) + '"/>'; }).join('');
  var svg =
    '<svg class="hall-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
    '<defs>' +
      '<linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="sky1"/><stop offset=".7" class="sky2"/><stop offset="1" class="sky3"/></linearGradient>' +
      '<linearGradient id="sc-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="wall1"/><stop offset="1" class="wall2"/></linearGradient>' +
      '<linearGradient id="sc-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="floor1"/><stop offset="1" class="floor2"/></linearGradient>' +
      '<linearGradient id="sc-shaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="shaft1"/><stop offset="1" class="shaft2"/></linearGradient>' +
      '<radialGradient id="sc-glow"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="sc-moon" cx=".4" cy=".4"><stop offset="0" stop-color="#fffbe9"/><stop offset="1" stop-color="#cfc8b0"/></radialGradient>' +
      '<radialGradient id="sc-sun" cx=".5" cy=".5"><stop offset="0" stop-color="#fff2c4"/><stop offset=".5" stop-color="#ffd27a"/><stop offset="1" stop-color="#ffb35a" stop-opacity="0"/></radialGradient>' +
      '<clipPath id="sc-win">' + winClip + '</clipPath>' +
    '</defs>' +
    // wall and wainscot
    '<rect width="' + W + '" height="' + H + '" fill="url(#sc-wall)"/>' +
    '<g class="panel-lines">' + Array.from({ length: 17 }, function (_, i) { return '<line x1="' + (i * 100) + '" y1="0" x2="' + (i * 100) + '" y2="600"/>'; }).join('') + '</g>' +
    '<rect y="600" width="' + W + '" height="100" class="wainscot"/>' +
    '<g class="wainscot-panels">' + Array.from({ length: 16 }, function (_, i) { return '<rect x="' + (i * 100 + 12) + '" y="614" width="76" height="72" rx="3"/>'; }).join('') + '</g>' +
    '<rect y="596" width="' + W + '" height="8" class="brass"/>' +
    // the view outside
    '<g clip-path="url(#sc-win)">' +
      '<rect x="0" y="100" width="' + W + '" height="500" fill="url(#sc-sky)"/>' +
      '<g class="stars">' + stars() + '</g>' +
      '<circle cx="1235" cy="225" r="38" fill="url(#sc-moon)" class="moon"/>' +
      '<circle cx="360" cy="330" r="90" fill="url(#sc-sun)" class="sun"/>' +
      skyline(560, 40, 110, 'far', false) +
      // clock tower in the middle window
      '<g class="near"><rect x="770" y="300" width="60" height="290"/><path d="M762 300 L800 240 L838 300 Z"/></g>' +
      '<circle cx="800" cy="335" r="17" class="clockface"/><path d="M800 335 L800 324 M800 335 L808 339" class="clockhands"/>' +
      skyline(590, 30, 90, 'near', true) +
    '</g>' +
    // light shafts falling into the hall
    '<g class="shafts">' + windows.map(function (cx) { return '<path d="M' + (cx - 115) + ' 585 L' + (cx + 115) + ' 585 L' + (cx + 230) + ' 900 L' + (cx - 60) + ' 900 Z" fill="url(#sc-shaft)"/>'; }).join('') + '</g>' +
    // window frames, mullions, curtains
    windows.map(function (cx) {
      return '<path d="' + arch(cx) + '" class="winframe"/>' +
        '<line x1="' + cx + '" y1="130" x2="' + cx + '" y2="585" class="mullion"/>' +
        '<line x1="' + (cx - 115) + '" y1="420" x2="' + (cx + 115) + '" y2="420" class="mullion"/>' +
        '<path d="M' + (cx - 150) + ' 110 C' + (cx - 120) + ' 300 ' + (cx - 140) + ' 480 ' + (cx - 160) + ' 640 L' + (cx - 118) + ' 640 C' + (cx - 112) + ' 460 ' + (cx - 100) + ' 260 ' + (cx - 112) + ' 110 Z" class="curtain"/>' +
        '<path d="M' + (cx + 150) + ' 110 C' + (cx + 120) + ' 300 ' + (cx + 140) + ' 480 ' + (cx + 160) + ' 640 L' + (cx + 118) + ' 640 C' + (cx + 112) + ' 460 ' + (cx + 100) + ' 260 ' + (cx + 112) + ' 110 Z" class="curtain"/>' +
        '<rect x="' + (cx - 170) + '" y="100" width="340" height="14" rx="4" class="brass"/>';
    }).join('') +
    portrait(600) + portrait(1000) + portrait(140) + portrait(1460) +
    sconce(205) + sconce(1395) +
    // banner over the middle
    '<g transform="translate(800 70)"><path d="M-170 -40 H170 V18 L0 40 L-170 18 Z" class="banner"/><text y="6" text-anchor="middle" class="banner-text">TOWN HALL</text></g>' +
    // chandelier
    '<g transform="translate(800 0)"><line x1="0" y1="0" x2="0" y2="120" class="chain"/><circle cy="160" r="150" class="lampglow"/>' +
      '<ellipse cy="140" rx="90" ry="14" class="brass-ring"/>' +
      [-80, -40, 0, 40, 80].map(function (x) { return '<rect x="' + (x - 3) + '" y="118" width="6" height="18" class="candle"/><ellipse cx="' + x + '" cy="112" rx="4" ry="8" class="flame"/>'; }).join('') +
    '</g>' +
    // floor
    '<rect y="700" width="' + W + '" height="200" fill="url(#sc-floor)"/>' +
    '<g class="planks">' + planks() + '</g>' +
    '<ellipse cx="800" cy="900" rx="700" ry="140" class="rug"/>' +
    '</svg>';

  var host = document.querySelector('.scene');
  if (host) host.insertAdjacentHTML('afterbegin', svg);
})();
