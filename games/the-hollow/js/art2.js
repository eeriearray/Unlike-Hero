/* THE HOLLOW — art, second pass: painted-style scene lighting and region atmosphere layered over js/art.js scenes,
 * and illustrated (filled, not stroke) item art. Still 100% original SVG, no asset files. */
(function (g) {
  'use strict';
  var A = g.HollowArt, esc = A.esc;
  function rng(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h += 0x6D2B79F5; var t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ───────── scenes: add a signature emblem, region atmosphere, light and paper grain ─────────
  var REG = {
    village: function (r) { var o = ''; for (var i = 0; i < 3; i++) { var x = 70 + i * 230 + r() * 40; o += '<path d="M' + x + ' 250V150" stroke="#06080c" stroke-width="5"/><g class="lsway" style="transform-origin:' + x + 'px 150px;animation-delay:' + (-i * 1.3).toFixed(1) + 's"><path d="M' + (x - 10) + ' 150h20l-4 18h-12z" fill="#06080c"/><circle cx="' + x + '" cy="162" r="14" fill="#c9a35b" opacity=".12" class="win"/></g>'; } for (var k = 0; k < 14; k++) o += '<path d="M' + (k * 48 + r() * 10) + ' 258v-' + (16 + r() * 18) + 'm6 ' + (16) + 'v-' + (14 + r() * 12) + '" stroke="#05060a" stroke-width="3"/>'; return o; },
    estate: function (r) { var o = ''; for (var i = 0; i < 28; i++) o += '<path d="M' + (i * 24 + 6) + ' 258v-34l-4-10 8 0-4 10" fill="#06070b" stroke="#06070b" stroke-width="2"/>'; o += '<path d="M0 236h640" stroke="#06070b" stroke-width="3"/>'; o += '<path d="M520 70a28 28 0 0 1 56 0v60h-56z" fill="#0a0d16" stroke="#2b3550" stroke-width="2"/><path d="M548 80v50M526 104h44" stroke="#3b4a72" stroke-width="2"/>'; return o; },
    woods: function (r) { var o = ''; for (var i = 0; i < 16; i++) { var x = r() * 640, y = 80 + r() * 150; o += '<circle class="fly" cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="2.4" fill="#b8e6a0" opacity=".8" style="animation-delay:' + (-r() * 8).toFixed(1) + 's"/><circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="9" fill="#b8e6a0" opacity=".06"/>'; } for (var k = 0; k < 18; k++) o += '<path d="M' + (k * 38 + r() * 20) + ' 262q8 -' + (22 + r() * 20).toFixed(0) + ' 18 -' + (10 + r() * 10).toFixed(0) + '" stroke="#04080a" stroke-width="3" fill="none"/>'; return o; },
    abbey: function (r) { var segs = ['#7a2f3a', '#2f5a7a', '#c9a35b', '#4a7a5a', '#6a4a8a', '#7a2f3a', '#2f5a7a', '#c9a35b'], o = '<g transform="translate(560 78)" opacity=".5"><circle r="46" fill="#0b0e17" stroke="#3a3322" stroke-width="3"/>'; segs.forEach(function (c, i) { var a = i * Math.PI / 4, b = a + Math.PI / 4; o += '<path d="M0 0L' + (Math.cos(a) * 40).toFixed(1) + ' ' + (Math.sin(a) * 40).toFixed(1) + 'A40 40 0 0 1 ' + (Math.cos(b) * 40).toFixed(1) + ' ' + (Math.sin(b) * 40).toFixed(1) + 'z" fill="' + c + '" opacity=".55"/>'; }); o += '<circle r="9" fill="#0b0e17"/></g><path d="M560 124l-60 126h120z" fill="#c9a35b" opacity=".05"/>'; return o; },
    crypt: function (r) { var o = '<rect y="200" width="640" height="60" fill="#2f8f9a" opacity=".10"/>'; for (var i = 0; i < 10; i++) o += '<circle class="bub" cx="' + (r() * 640).toFixed(0) + '" cy="' + (210 + r() * 40).toFixed(0) + '" r="' + (1.5 + r() * 2).toFixed(1) + '" fill="#9fe8e0" opacity=".4" style="animation-delay:' + (-r() * 6).toFixed(1) + 's"/>'; o += '<path d="M120 0L60 200h120zM470 0l-50 220h100z" fill="#7ad0d6" opacity=".05"/>'; return o; },
    heart: function (r) { var o = ''; for (var i = 0; i < 9; i++) { var x = r() * 640, y = 20 + r() * 150, s = 8 + r() * 22; o += '<path class="shard" d="M' + x.toFixed(0) + ' ' + y.toFixed(0) + 'l' + s.toFixed(0) + ' ' + (s * .4).toFixed(0) + ' -' + (s * .5).toFixed(0) + ' ' + s.toFixed(0) + 'z" fill="#c0556f" opacity=".28" style="animation-delay:' + (-r() * 7).toFixed(1) + 's"/>'; } o += '<path d="M0 250Q320 60 640 250" stroke="#8b6fd1" stroke-width="2" fill="none" opacity=".3"/><path d="M0 250Q320 120 640 250" stroke="#c0556f" stroke-width="1.5" fill="none" opacity=".25"/>'; return o; }
  };

  // ───────── hand-placed props for scenes that have interactive objects (see js/story.js HOT) ─────────
  var PROPS = {
    square: function () {
      var o = '';
      // two crooked houses leaning toward the well, one window with a shadow that crosses it
      o += '<g fill="#080a10"><path d="M20 240V128l44-34 44 34 6 112z"/><path d="M500 240l-4-96 46-30 52 30-6 96z"/></g>';
      o += '<rect x="48" y="150" width="20" height="24" fill="#e5c273" opacity=".7" class="win"/><rect x="540" y="156" width="20" height="24" fill="#e5c273" opacity=".6" class="win" style="animation-delay:-2s"/><rect x="574" y="156" width="14" height="22" fill="#e5c273" opacity=".25"/>';
      o += '<rect x="540" y="156" width="20" height="24" fill="#05070b" class="passer"/>';
      // notice board: two posts, planks, curling papers
      o += '<g transform="translate(48 0)"><path d="M112 238V158M188 238V158" stroke="#2a1d12" stroke-width="7"/><rect x="104" y="150" width="92" height="58" rx="3" fill="#4a3320" stroke="#1d130b" stroke-width="3"/><path d="M104 168h92M104 190h92" stroke="#2c1e12" stroke-width="2"/>' +
        '<path d="M114 156h26v22h-26z" fill="#d9ceaa"/><path d="M146 160h22v26h-22z" fill="#cfc29a" transform="rotate(3 157 173)"/><path d="M174 156h18v18h-18z" fill="#e0d6b4"/><path d="M118 186h22v16h-22z" fill="#c9bb92" transform="rotate(-4 129 194)"/><path d="M148 192h40v12h-40z" fill="#d9ceaa"/>' +
        '<path d="M118 162h16M118 167h12M150 166h14M150 172h12M178 161h10M152 197h30" stroke="#5c4a30" stroke-width="1.2"/><circle cx="127" cy="157" r="2" fill="#7a2f3a"/><path d="M104 150h92l-6-8h-80z" fill="#35261a"/></g>';
      // the well drips upward: a pale thread of droplets rising from the water
      o += '<g class="upflow" fill="#cfe6ee"><circle cx="314" cy="186" r="2.2"/><circle cx="322" cy="186" r="1.8"/><circle cx="318" cy="186" r="2.6"/><circle cx="326" cy="186" r="1.6"/><circle cx="311" cy="186" r="1.5"/></g>';
      o += '<path d="M318 188c-6-30 8-52 0-84" stroke="#cfe6ee" stroke-width="1.6" fill="none" opacity=".35" class="upline"/>';
      o += '<path d="M290 190c0 0 4 -10 30 -10s30 10 30 10" fill="none" stroke="#7aa8b8" stroke-width="1" opacity=".25"/>';
      // a small camp fire with a flask
      o += '<g transform="translate(448 226)"><path d="M-16 6l32-6M-16 0l32 6" stroke="#2a1b10" stroke-width="5" stroke-linecap="round"/><path class="flame" d="M0 2c-9-9-3-17 0-26 3 9 9 17 0 26z" fill="#ffb347"/><path class="flame" d="M0 2c-4-4-1-9 0-14 2 5 4 9 0 14z" fill="#fff2b3"/><circle r="40" cy="-8" fill="#ffb347" opacity=".12" class="aura"/></g>';
      return o;
    }
  };
  var TINT = { village: '#5f8a86', estate: '#6a58b0', woods: '#3f7a52', abbey: '#c4a867', crypt: '#2f8f9a', heart: '#b0456a' };
  var baseScene = A.scene;
  A.scene = function (spec, key, accent, region, emblem) {
    var svg = baseScene(spec, key, accent), r = rng('x' + key), reg = region || '', ex = '';
    var id = 'g' + String(key).replace(/[^a-z0-9]/gi, '');
    ex += '<defs><filter id="' + id + 'n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="' + (Math.floor(r() * 90) + 1) + '"/><feColorMatrix values="0 0 0 0 .8  0 0 0 0 .75  0 0 0 0 .6  0 0 0 .5 0"/></filter><linearGradient id="' + id + 'l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9b0" stop-opacity=".08"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></linearGradient></defs>';
    if (TINT[reg]) ex += '<rect width="640" height="260" fill="' + TINT[reg] + '" opacity=".13" style="mix-blend-mode:soft-light"/>';
    if (emblem) ex += '<svg x="' + (220 + Math.floor(r() * 120)) + '" y="14" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#e8dcc0" stroke-width=".5" opacity=".13" stroke-linecap="round" stroke-linejoin="round"><path d="' + A.path(emblem) + '"/></svg>';
    if (PROPS[key]) ex += PROPS[key](r);
    if (REG[reg]) ex += '<g class="fg">' + REG[reg](r) + '</g>';
    // shafts of light and a little foreground dust
    ex += '<path d="M' + (60 + r() * 200) + ' 0l90 0 -150 260h-70z" fill="url(#' + id + 'l)"/><path d="M' + (360 + r() * 200) + ' 0l60 0 -100 260h-50z" fill="url(#' + id + 'l)"/>';
    for (var i = 0; i < 14; i++) ex += '<circle class="mote" cx="' + (r() * 640).toFixed(0) + '" cy="' + (r() * 250).toFixed(0) + '" r="' + (0.6 + r() * 1.2).toFixed(1) + '" fill="#f1e8cf" opacity=".4" style="animation-delay:' + (-r() * 9).toFixed(1) + 's"/>';
    ex += '<rect width="640" height="260" filter="url(#' + id + 'n)" opacity=".10" style="mix-blend-mode:overlay"/>';
    return svg.replace(/<\/svg>$/, ex + '</svg>');
  };

  // ───────── item illustrations (48×48) ─────────
  var P = '<defs><linearGradient id="mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8dbe6"/><stop offset="1" stop-color="#5c6378"/></linearGradient><linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1d58b"/><stop offset="1" stop-color="#8a6a2c"/></linearGradient></defs>';
  var ITEM = {
    lantern: '<path d="M18 7h12M24 4v3" stroke="#8c8f9a" stroke-width="2"/><path d="M16 10h16l2 6v18l-4 4H18l-4-4V16z" fill="#2a2118" stroke="#b9925a" stroke-width="2"/><path d="M19 15h10v20H19z" fill="#ffcf6b" opacity=".75"/><path class="flame" d="M24 18c-4 5-1 7-1 10 2 0 6-2 3-10-1 2-1 3-2 0z" fill="#fff2b8"/><path d="M14 38h20" stroke="#b9925a" stroke-width="3"/>',
    lamp_oil: '<path d="M19 6h10v6l5 8v18a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V20l5-8z" fill="#3a2a12" stroke="#c9a35b" stroke-width="2"/><path d="M15 26h18v12a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3z" fill="#e0a73c" opacity=".85"/><rect x="20" y="3" width="8" height="5" fill="#6a4a2a"/>',
    tonic: '<path d="M20 5h8v8l8 10v14a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5V23l8-10z" fill="#2a1b1b" stroke="#c07a7a" stroke-width="2"/><path d="M13 28h22v9a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4z" fill="#a8363f" opacity=".9"/><rect x="20" y="2" width="8" height="5" rx="1" fill="#8a6a3a"/>',
    moonwater: '<path d="M20 5h8v8l8 10v14a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5V23l8-10z" fill="#12212e" stroke="#9fd0e8" stroke-width="2"/><path d="M13 28h22v9a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4z" fill="#9fd8f0" opacity=".85"/><circle cx="24" cy="32" r="5" fill="#f4fbff" opacity=".7"/><rect x="20" y="2" width="8" height="5" rx="1" fill="#6a7a8a"/>',
    thread: '<ellipse cx="24" cy="12" rx="11" ry="4" fill="#4a3a2a"/><rect x="13" y="12" width="22" height="24" fill="#5a4630"/><ellipse cx="24" cy="36" rx="11" ry="4" fill="#4a3a2a"/><path d="M14 17q10 3 20 0M14 22q10 3 20 0M14 27q10 3 20 0M14 32q10 3 20 0" stroke="url(#mt)" stroke-width="2.4" fill="none"/><path d="M35 32q8 2 7 9" stroke="#d8dbe6" stroke-width="1.6" fill="none"/>',
    salt: '<path d="M14 18q10 -6 20 0l4 22H10z" fill="#c9bfa5" stroke="#8a7f66" stroke-width="2"/><path d="M16 14h16l-2 6H18z" fill="#a89c80"/><path d="M13 14c4 -4 18 -4 22 0" stroke="#6a5a3a" stroke-width="3" fill="none"/><circle cx="20" cy="30" r="1.4" fill="#fff"/><circle cx="27" cy="33" r="1.4" fill="#fff"/><circle cx="24" cy="27" r="1.4" fill="#fff"/>',
    blade: '<path d="M10 40L36 8l4 4-4 6-18 22z" fill="url(#mt)" stroke="#3a3f52" stroke-width="1.5"/><path d="M12 38L34 12" stroke="#2a2f40" stroke-width="1.4"/><path d="M6 36l6-2 2 6-6 2z" fill="#5a3a22"/><path d="M33 17l5 5" stroke="#8a6a3a" stroke-width="3"/><circle cx="26" cy="22" r="2" fill="#c9a35b"/>',
    moonrelic: '<path d="M24 4v8" stroke="#8a6a3a" stroke-width="2"/><path d="M33 20a11 11 0 1 1-12-14 9 9 0 0 0 12 14z" transform="translate(0 8)" fill="url(#gd)" stroke="#6a4a1c" stroke-width="1.5"/><circle cx="29" cy="30" r="2.4" fill="#e9f0ff" opacity=".9"/>',
    spirit_key: '<circle cx="15" cy="16" r="8" fill="none" stroke="#bfeee6" stroke-width="3"/><circle cx="15" cy="16" r="3" fill="#bfeee6" opacity=".6"/><path d="M21 21l18 18M32 32l4-4M36 36l4-4" stroke="#bfeee6" stroke-width="3.4" stroke-linecap="round"/><circle cx="24" cy="24" r="22" fill="#7ad0c8" opacity=".08"/>',
    wardens_key: '<circle cx="15" cy="16" r="8" fill="none" stroke="#6b707c" stroke-width="3.4"/><path d="M12 16h6M15 13v6" stroke="#6b707c" stroke-width="2"/><path d="M21 21l18 18M32 32l4-4M36 36l4-4" stroke="#6b707c" stroke-width="3.6" stroke-linecap="round"/>',
    clapper: '<path d="M24 4v10" stroke="#8c8f9a" stroke-width="3"/><circle cx="24" cy="6" r="3" fill="none" stroke="#8c8f9a" stroke-width="2"/><path d="M18 14h12l2 22a8 8 0 0 1-16 0z" fill="#3a3d48" stroke="#6b707c" stroke-width="2"/><path d="M20 20h8" stroke="#8c8f9a" stroke-width="1.5"/><circle cx="24" cy="40" r="6" fill="#2a2d38" stroke="#6b707c" stroke-width="2"/>',
    herb: '<path d="M24 44V14" stroke="#2f6a47" stroke-width="2.4"/><path d="M24 14c-10 0-12-8-12-10 8 0 12 4 12 10zM24 22c10 0 12-8 12-10-8 0-12 4-12 10zM24 30c-9 0-12-6-12-8 7 0 12 3 12 8z" fill="#4aa070"/><path d="M24 30c9 0 11-5 11-7-7 0-11 3-11 7z" fill="#3a8a5a"/>',
    snare: '<circle cx="24" cy="26" r="14" fill="none" stroke="#6b707c" stroke-width="3"/><path d="M12 22l4 4-5 1zM36 22l-4 4 5 1zM18 38l1-5 4 3zM30 38l-1-5-4 3z" fill="#8c8f9a"/><path d="M24 4v8" stroke="#8a6a3a" stroke-width="2"/><circle cx="24" cy="26" r="3" fill="#b24a52"/>',
    chalk: '<path d="M8 34l22-22 8 8-22 22z" fill="#e8e2c9" stroke="#a89c80" stroke-width="1.5"/><path d="M30 12l8 8" stroke="#bfb594" stroke-width="2"/><circle cx="10" cy="40" r="2" fill="#e8e2c9" opacity=".6"/>',
    candle: '<path class="flame" d="M24 4c-5 6-2 9-2 12 4 0 7-3 2-12z" fill="#ffd27a"/><rect x="18" y="16" width="12" height="26" rx="2" fill="#e8dcc0" stroke="#a8946a" stroke-width="1.5"/><path d="M18 22q6 4 12 0" stroke="#a8946a" fill="none"/><circle cx="24" cy="10" r="12" fill="#ffb347" opacity=".12"/>',
    mirror_shard: '<path d="M10 8l22 4 8 14-10 18-18-8z" fill="#aab8d6" stroke="#e8eefc" stroke-width="2"/><path d="M14 14l10 6M24 12l-4 20" stroke="#fff" stroke-width="1.2" opacity=".6"/>',
    star_lens: '<circle cx="24" cy="24" r="17" fill="#1a2a4a" stroke="#c9a35b" stroke-width="3"/><circle cx="24" cy="24" r="12" fill="#2f4f8a" opacity=".7"/><path d="M16 18q6-6 12-3" stroke="#fff" stroke-width="2" opacity=".7" fill="none"/><circle cx="30" cy="30" r="2" fill="#f1d58b"/>',
    weeping_eye: '<path d="M4 22q20-20 40 0-20 20-40 0z" fill="#e8e2c9" stroke="#8a7f66" stroke-width="2"/><circle cx="24" cy="22" r="8" fill="#3a6a9a"/><circle cx="24" cy="22" r="3.5" fill="#05070b"/><path d="M24 31q-3 6 0 10 3-4 0-10z" fill="#9fd0e8"/>',
    saint_finger: '<path d="M14 40l-2-22a5 5 0 0 1 10 0l-1 22z" fill="#2a1f1a" stroke="#cfc8b4" stroke-width="2"/><path d="M12 30h12" stroke="url(#mt)" stroke-width="6"/><path d="M16 14q3-8 6 0" stroke="#cfc8b4" stroke-width="3" fill="none"/>',
    gilded_psalter: '<path d="M8 8h26a4 4 0 0 1 4 4v28H12a4 4 0 0 1-4-4z" fill="url(#gd)" stroke="#6a4a1c" stroke-width="2"/><path d="M12 8v32" stroke="#6a4a1c" stroke-width="2"/><path d="M23 14v18M17 20h12" stroke="#3a2a10" stroke-width="2.4"/>',
    bone_chalice: '<path d="M10 8h28c0 12-4 18-14 18S10 20 10 8z" fill="#e6dfc8" stroke="#a89c80" stroke-width="2"/><circle cx="19" cy="15" r="3" fill="#2a2418"/><circle cx="29" cy="15" r="3" fill="#2a2418"/><path d="M24 26v10M16 40h16" stroke="#cfc8b4" stroke-width="4" stroke-linecap="round"/>',
    ember_locket: '<path d="M24 4v7" stroke="#8a6a3a" stroke-width="2"/><path d="M24 44C8 33 8 18 15 15c4-2 8 0 9 4 1-4 5-6 9-4 7 3 7 18-9 29z" fill="url(#gd)" stroke="#6a4a1c" stroke-width="2"/><circle cx="24" cy="26" r="5" fill="#ff7a3a" opacity=".85"/>'
  };
  A.itemArt = function (id, size) {
    var s = ITEM[id];
    if (!s) return A.glyph('circle', size);
    return '<svg class="itemart" viewBox="0 0 48 48" width="' + (size || 40) + '" height="' + (size || 40) + '" aria-hidden="true">' + P + s + '</svg>';
  };
  // a faceted D20 with bevelled light, replacing the flat one
  A.die = function (n, tier) {
    var col = tier === 'crit' ? '#f0d68a' : tier === 'fumble' ? '#e0707a' : '#d9c28a', fill = tier === 'fumble' ? ['#4a1a22', '#2a0d12', '#3a1219'] : tier === 'crit' ? ['#5a4a22', '#3a2f12', '#4a3c18'] : ['#2e3650', '#1a2036', '#242c46'];
    return '<svg class="d20-svg" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="dgl" cx=".35" cy=".25" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient></defs>' +
      '<polygon points="50,3 92,26 92,74 50,97 8,74 8,26" fill="' + fill[1] + '" stroke="' + col + '" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<polygon points="50,3 92,26 50,20" fill="' + fill[0] + '"/><polygon points="92,26 92,74 80,68" fill="' + fill[2] + '"/><polygon points="92,74 50,97 80,68" fill="' + fill[0] + '"/><polygon points="50,97 8,74 20,68" fill="' + fill[2] + '"/><polygon points="8,74 8,26 20,68" fill="' + fill[0] + '"/><polygon points="8,26 50,3 50,20" fill="' + fill[2] + '"/>' +
      '<polygon points="50,20 80,68 20,68" fill="' + fill[0] + '" stroke="' + col + '" stroke-width="1.4"/>' +
      '<path d="M50 3v17M92 26L80 68M92 74L80 68M50 97L80 68M50 97L20 68M8 74L20 68M8 26L20 68M8 26L50 20M92 26L50 20" stroke="' + col + '" stroke-width="1" opacity=".5" fill="none"/>' +
      '<polygon points="50,3 92,26 92,74 50,97 8,74 8,26" fill="url(#dgl)"/>' +
      '<text x="50" y="58" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="' + (String(n).length > 1 ? 24 : 28) + '" font-weight="700" fill="' + col + '" stroke="#000" stroke-width=".6" paint-order="stroke">' + esc(n) + '</text></svg>';
  };
})(window);