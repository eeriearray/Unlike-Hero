/* THE HOLLOW — The Silent Square, as a playable illustrated scene.
 *
 * A scene is data for js/stage.js: a 1600×900 picture split into parallax layers, plus OBJECTS. Each object is a
 * thing in the picture you can touch, and it maps to REAL actions only: an option id of this place's encounter
 * (`opt`), a standing action (`act`: investigate, travel) or a road (`move`). Nothing here decides an outcome; the
 * `fx` functions only animate the outcome the server already resolved.
 *
 * Drop-in artwork: any layer may name a raster file in `src` (see art/README.md). If the file loads it replaces that
 * layer's vector drawing; if it is missing or fails, the vector drawing below is used. Objects stay vector so their
 * states (inspected, lit, taken) and hit areas keep working whatever the backdrop is. */
(function (g) {
  'use strict';
  var SC = g.HollowScenes = g.HollowScenes || { defs: {} };
  SC.register = SC.register || function (d) { SC.defs[d.id] = d; };

  function rng(seed) { var h = 2166136261 ^ seed; return function () { h += 0x6D2B79F5; var t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var f1 = function (n) { return Math.round(n * 10) / 10; };

  // ───────────────────────── shared paint (gradients, filters) ─────────────────────────
  var DEFS = '<defs>' +
    '<linearGradient id="sq-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070a14"/><stop offset=".45" stop-color="#121a2c"/><stop offset=".78" stop-color="#2a3346"/><stop offset="1" stop-color="#4a4a52"/></linearGradient>' +
    '<radialGradient id="sq-moonhalo"><stop offset="0" stop-color="#e9ecf5" stop-opacity=".35"/><stop offset=".25" stop-color="#b8c4dc" stop-opacity=".12"/><stop offset="1" stop-color="#b8c4dc" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="sq-moon" cx=".42" cy=".38"><stop offset="0" stop-color="#fbfaf2"/><stop offset=".7" stop-color="#dcdccf"/><stop offset="1" stop-color="#b9b9ae"/></radialGradient>' +
    '<radialGradient id="sq-warm"><stop offset="0" stop-color="#ffd27a" stop-opacity=".55"/><stop offset=".35" stop-color="#f0a845" stop-opacity=".18"/><stop offset="1" stop-color="#f0a845" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="sq-warm2"><stop offset="0" stop-color="#ffcf73" stop-opacity=".9"/><stop offset=".25" stop-color="#ffb24a" stop-opacity=".35"/><stop offset="1" stop-color="#ff9d2e" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="sq-cold"><stop offset="0" stop-color="#bfeaf2" stop-opacity=".75"/><stop offset=".4" stop-color="#7cc7d6" stop-opacity=".22"/><stop offset="1" stop-color="#7cc7d6" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="sq-deep" cx=".5" cy=".55"><stop offset="0" stop-color="#0d2a33"/><stop offset=".6" stop-color="#050b10"/><stop offset="1" stop-color="#020407"/></radialGradient>' +
    '<linearGradient id="sq-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2c34"/><stop offset=".35" stop-color="#23252c"/><stop offset="1" stop-color="#121318"/></linearGradient>' +
    '<linearGradient id="sq-plaster" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#77705f"/><stop offset="1" stop-color="#4a4539"/></linearGradient>' +
    '<linearGradient id="sq-plasterR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d5a52"/><stop offset="1" stop-color="#36342f"/></linearGradient>' +
    '<linearGradient id="sq-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3d47"/><stop offset="1" stop-color="#272932"/></linearGradient>' +
    '<linearGradient id="sq-wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a2817"/><stop offset=".5" stop-color="#5b3f25"/><stop offset="1" stop-color="#2c1d10"/></linearGradient>' +
    '<linearGradient id="sq-woodv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e4329"/><stop offset="1" stop-color="#2f2013"/></linearGradient>' +
    '<linearGradient id="sq-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c7e86"/><stop offset="1" stop-color="#43454d"/></linearGradient>' +
    '<linearGradient id="sq-paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ede3c4"/><stop offset="1" stop-color="#b9a983"/></linearGradient>' +
    '<linearGradient id="sq-slate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3d4a"/><stop offset="1" stop-color="#1d1e26"/></linearGradient>' +
    '<linearGradient id="sq-stream" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#bfeaf2" stop-opacity=".75"/><stop offset=".6" stop-color="#9fd8e6" stop-opacity=".25"/><stop offset="1" stop-color="#9fd8e6" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="sq-lane" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070b"/><stop offset="1" stop-color="#151820"/></linearGradient>' +
    '<pattern id="sq-tiles" width="22" height="14" patternUnits="userSpaceOnUse"><rect width="22" height="14" fill="#262833"/><path d="M0 14q5.5-7 11 0q5.5-7 11 0" fill="#30323e" stroke="#15161d" stroke-width="1.2"/><path d="M-11 7q5.5-7 11 0q5.5-7 11 0q5.5-7 11 0" fill="none" stroke="#15161d" stroke-width="1"/></pattern>' +
    '<pattern id="sq-shingle" width="16" height="10" patternUnits="userSpaceOnUse"><rect width="16" height="10" fill="#3a2a1b"/><path d="M0 10h16M8 0v5M0 5h16M0 0v5M16 5v5" stroke="#1d140b" stroke-width="1.1"/><path d="M1 9h6M9 4h6" stroke="#5a4129" stroke-width=".8"/></pattern>' +
    '<pattern id="sq-grain" width="60" height="8" patternUnits="userSpaceOnUse"><path d="M0 2q15 2 30 0t30 0M0 6q20 -1.6 40 0t20 0" stroke="#000" stroke-opacity=".22" fill="none" stroke-width=".8"/></pattern>' +
    '<filter id="sq-blur6" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>' +
    '<filter id="sq-blur18" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="18"/></filter>' +
    '<filter id="sq-blur3"><feGaussianBlur stdDeviation="2.4"/></filter>' +
    '<filter id="sq-grit"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .78  0 0 0 0 .74  0 0 0 0 .64  0 0 0 .55 0"/></filter>' +
    '</defs>';

  // ───────────────────────── reusable drawing helpers ─────────────────────────
  // a lit or dark window: frame, mullions, sill; class "win" with a darkening order (data-w) driven by the Haunting
  function win(x, y, w, h, idx, o) {
    o = o || {};
    var lit = o.lit !== false, arch = o.arch, gl = lit ? '#f2c46b' : '#141824';
    var shape = arch ? 'M' + x + ' ' + (y + h) + 'V' + (y + w / 2) + 'a' + (w / 2) + ' ' + (w / 2) + ' 0 0 1 ' + w + ' 0V' + (y + h) + 'z' : 'M' + x + ' ' + y + 'h' + w + 'v' + h + 'h-' + w + 'z';
    var s = '<g class="win' + (lit ? ' lit' : '') + '" data-w="' + idx + '">';
    if (lit) s += '<ellipse class="wglow" cx="' + (x + w / 2) + '" cy="' + (y + h / 2) + '" rx="' + (w * 1.6) + '" ry="' + (h * 1.2) + '" fill="url(#sq-warm)"/>';
    s += '<path class="wpane" d="' + shape + '" fill="' + gl + '"/>';
    if (lit) s += '<path d="' + shape + '" fill="#ffefc2" opacity=".35" class="wcore"/>';
    s += '<path d="' + shape + '" fill="none" stroke="#1a120a" stroke-width="' + (o.fr || 3) + '"/>';
    s += '<path d="M' + (x + w / 2) + ' ' + (y + (arch ? w / 2 - 2 : 0)) + 'V' + (y + h) + 'M' + x + ' ' + f1(y + h * 0.48) + 'h' + w + '" stroke="#1a120a" stroke-width="' + (o.mul || 2) + '"/>';
    s += '<path d="M' + (x - 3) + ' ' + (y + h + 1) + 'h' + (w + 6) + '" stroke="#2a2016" stroke-width="4"/>';
    if (o.shutter) s += '<path d="M' + (x - w * 0.55) + ' ' + (y - 2) + 'l' + (w * 0.5) + ' 2v' + h + 'l-' + (w * 0.5) + ' 4z" fill="#2d2a22" stroke="#14100a" stroke-width="1.5"/><path d="M' + (x - w * 0.5) + ' ' + (y + h * 0.3) + 'h' + (w * 0.4) + 'M' + (x - w * 0.5) + ' ' + (y + h * 0.65) + 'h' + (w * 0.4) + '" stroke="#14100a" stroke-width="1.2"/>';
    return s + '</g>';
  }
  function stoneRow(x, y, w, seed) {   // a course of dressed stones at the foot of a wall
    var r = rng(seed), s = '', cx = x;
    for (var row = 0; row < 3; row++) { cx = x - r() * 30; while (cx < x + w) { var sw = 34 + r() * 30, sh = 18, c = Math.floor(58 + r() * 26); s += '<rect x="' + f1(cx) + '" y="' + (y + row * 20 + 1) + '" width="' + f1(sw - 3) + '" height="' + sh + '" rx="3" fill="rgb(' + c + ',' + c + ',' + (c + 6) + ')" stroke="#1c1d22" stroke-width="1.4"/>'; cx += sw; } }
    return '<g clip-path="none">' + s + '</g>';
  }
  function timber(x, y, w, h) {   // half-timbering on a plaster panel
    var s = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="none" stroke="#2a1d12" stroke-width="7"/>';
    s += '<path d="M' + x + ' ' + y + 'L' + (x + w * 0.32) + ' ' + (y + h) + 'M' + (x + w) + ' ' + y + 'L' + (x + w * 0.68) + ' ' + (y + h) + 'M' + (x + w / 2) + ' ' + y + 'V' + (y + h) + '" stroke="#2a1d12" stroke-width="6"/>';
    return s;
  }
  function stars(r) {
    var s = '<g class="stars">';
    for (var i = 0; i < 70; i++) { var x = r() * 1600, y = r() * 330, rr = 0.6 + r() * 1.5; s += '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(rr) + '" fill="#e9ecf7" opacity="' + f1(0.25 + r() * 0.6) + '"' + (r() < 0.25 ? ' class="tw" style="animation-delay:' + f1(-r() * 6) + 's"' : '') + '/>'; }
    return s + '</g>';
  }

  // ───────────────────────── layer: sky ─────────────────────────
  function sky() {
    var r = rng(11), s = '<rect width="1600" height="900" fill="url(#sq-sky)"/>' + stars(r);
    s += '<g transform="translate(0 50)"><circle cx="330" cy="150" r="230" fill="url(#sq-moonhalo)"/><circle cx="330" cy="150" r="46" fill="url(#sq-moon)"/>';
    s += '<g fill="#a9a99c" opacity=".35"><circle cx="318" cy="140" r="9"/><circle cx="345" cy="165" r="6"/><circle cx="336" cy="128" r="4"/><circle cx="310" cy="168" r="5"/></g></g>';
    // long cloud wisps, drifting
    s += '<g class="clouds"><path class="cl c1" d="M-80 190q160-34 330-8t330 0q120-14 240 6v26q-140 10-260-2t-330 4q-170 14-310-4z" fill="#283043" opacity=".85"/>' +
      '<path class="cl c2" d="M700 120q140-26 300-4t280-2q90-6 180 10v18q-120 8-210 0t-280 2q-160 10-270-6z" fill="#222a3b" opacity=".7"/>' +
      '<path class="cl c3" d="M150 250q200-20 420 0t360 0v22q-160 10-360 0t-420 2z" fill="#1d2433" opacity=".8"/></g>';
    return s;
  }

  // ───────────────────────── layer: far (roofline, bell tower) ─────────────────────────
  function far() {
    var s = '';
    // distant roofline across the back of the village
    s += '<path d="M0 470V378l40-30 40 30v-20h26l34-34 40 40v-18l50-36 44 36 30-24 40 32v-16h30l36-44 42 44h30v-30l40-28 38 32 36-26 40 30h20l40-40 40 40v-10l50-30 46 34 40-26 40 28 30-18 44 30 40-34 40 34h20l36-30 38 28 34-20 40 30 30-26 44 34 40-32 40 36 40-26 40 30 40-24 40 30v108z" fill="#151a26"/>';
    s += '<path d="M0 378l40-30 40 30M140 324l40 40M210 330l50-36 44 36M454 324l36-44 42 44M640 326l40-28 38 32M886 302l40-40 40 40M1016 318l50-30 46 34" stroke="#3a4560" stroke-width="2" fill="none" opacity=".6"/>';
    // chimneys and one plume of smoke
    s += '<g fill="#151a26"><rect x="248" y="290" width="14" height="30"/><rect x="520" y="270" width="12" height="34"/><rect x="1130" y="300" width="14" height="30"/><rect x="1400" y="296" width="12" height="30"/></g>';
    s += '<g class="smoke"><path d="M526 268c-10-30 18-46 4-80s20-54 10-90" stroke="#5a6070" stroke-width="16" fill="none" opacity=".18" filter="url(#sq-blur6)" stroke-linecap="round"/></g>';
    // tiny distant windows (the first to go dark as the Haunting rises)
    var wins = [[60, 400], [118, 392], [300, 380], [372, 396], [560, 372], [700, 384], [1180, 386], [1268, 392], [1342, 380], [1480, 396], [1548, 386]];
    wins.forEach(function (p, i) { s += '<g class="win lit" data-w="' + i + '"><rect class="wglow" x="' + (p[0] - 12) + '" y="' + (p[1] - 10) + '" width="34" height="34" fill="url(#sq-warm)"/><rect class="wpane" x="' + p[0] + '" y="' + p[1] + '" width="9" height="12" fill="#e8b862" opacity=".85"/></g>'; });
    // a silhouette that sometimes stands in one window (only once the Haunting knows your name: see css .ph2)
    s += '<g class="watcher"><rect x="1270" y="393" width="5" height="10" fill="#05060a"/><circle cx="1272.5" cy="391" r="2.6" fill="#05060a"/></g>';
    // the bell tower: empty belfry, louvres, a weathervane
    s += '<g class="tower" transform="translate(0 34)">' +
      '<path d="M948 470V214h124v256z" fill="#1a1f2d"/><path d="M948 470V214h10v256z" fill="#2f374b"/>' +
      '<path d="M944 214h132l-10-18H954z" fill="#232a3b"/><path d="M956 196V128h108v68z" fill="#171c29"/><path d="M956 196V128h8v68z" fill="#2f374b"/>' +
      '<path d="M974 196v-48a36 36 0 0 1 72 0v48z" fill="#06080d"/>' +
      '<ellipse class="belfry" cx="1010" cy="170" rx="30" ry="24" fill="url(#sq-cold)" opacity=".25"/>' +
      '<path d="M1010 150v24" stroke="#2c3346" stroke-width="2"/><path d="M996 150h28" stroke="#2c3346" stroke-width="3"/>' +
      '<path d="M950 128l60-84 60 84z" fill="#141826"/><path d="M950 128l60-84v84z" fill="#232a3c"/><path d="M1010 44V18M998 26h24" stroke="#3a4560" stroke-width="3"/><path class="vane" d="M1010 22l16 4-16 4z" fill="#3a4560"/>' +
      '<g fill="#0c0f17"><rect x="986" y="236" width="12" height="30" rx="6"/><rect x="1022" y="236" width="12" height="30" rx="6"/><rect x="1003" y="300" width="14" height="36" rx="7"/></g>' +
      '<path d="M960 270h100M960 350h100M960 420h100" stroke="#121624" stroke-width="2"/></g>';
    // crows on the roofs: only in the last phase (see css .ph3)
    s += '<g class="crows" fill="#05060a"><path d="M890 262q6-8 12-2q4-6 10 0l-6 4q-4 6-10 0z"/><path d="M640 300q6-8 12-2q4-6 10 0l-6 4q-4 6-10 0z"/><path d="M1060 146q6-8 12-2q4-6 10 0l-6 4q-4 6-10 0z"/></g>';
    return s;
  }

  // ───────────────────────── layer: mid (back houses, side houses, the lane, lantern string) ─────────────────────────
  function backHouse(x, w, top, gable, idx0, door) {
    var s = '', base = 488, mid = x + w / 2;
    s += '<path d="M' + x + ' ' + base + 'V' + top + 'L' + mid + ' ' + gable + 'L' + (x + w) + ' ' + top + 'V' + base + 'z" fill="url(#sq-back)"/>';
    s += '<path d="M' + (x - 8) + ' ' + (top + 4) + 'L' + mid + ' ' + (gable - 8) + 'L' + (x + w + 8) + ' ' + (top + 4) + '" stroke="#16171e" stroke-width="10" fill="none"/>';
    s += '<path d="M' + (x - 8) + ' ' + (top + 4) + 'L' + mid + ' ' + (gable - 8) + '" stroke="#8c97b4" stroke-width="1.6" fill="none" opacity=".35"/>';
    s += '<path d="M' + x + ' ' + (top + 40) + 'h' + w + 'M' + (x + 4) + ' ' + base + 'V' + top + 'M' + (x + w - 4) + ' ' + base + 'V' + top + '" stroke="#1d1712" stroke-width="5"/>';
    s += win(x + w * 0.2, top + 52, 16, 22, idx0, { lit: true, fr: 2 }) + win(x + w * 0.62, top + 52, 16, 22, idx0 + 1, { lit: idx0 % 2 === 0, fr: 2 });
    s += win(mid - 8, gable + 26, 16, 18, idx0 + 2, { arch: true, fr: 2 });
    if (door) s += '<path d="M' + (mid - 12) + ' ' + base + 'v-40a12 12 0 0 1 24 0v40z" fill="#1b130c" stroke="#0d0905" stroke-width="2"/><circle cx="' + (mid + 6) + '" cy="' + (base - 18) + '" r="1.6" fill="#8a6a3a"/>';
    return s;
  }
  function mid(st) {
    var s = '';
    // back row of houses behind the well
    s += backHouse(470, 130, 400, 330, 11, true) + backHouse(640, 110, 410, 352, 14, false) + backHouse(1130, 120, 404, 340, 17, true);
    // a long low house with a covered arcade
    s += '<path d="M770 488V412h320v76z" fill="#2e3039"/><path d="M760 414l20-34h300l20 34z" fill="url(#sq-tiles)"/><path d="M760 414h340" stroke="#121319" stroke-width="5"/>';
    for (var a = 0; a < 6; a++) s += '<path d="M' + (786 + a * 52) + ' 488v-34a20 20 0 0 1 40 0v34z" fill="#0f1117"/>';
    s += win(800, 420, 12, 14, 20, { lit: true, fr: 2 }) + win(1010, 420, 12, 14, 21, { lit: false, fr: 2 });
    // the lane out: a dark mouth between houses at the right, fog creeping from it
    s += '<g class="lane"><path d="M1252 488L1272 380h56l18 108z" fill="url(#sq-lane)"/><path d="M1286 488l8-60h14l8 60z" fill="#232733" opacity=".7"/><path d="M1262 488l14-70M1336 488l-12-70" stroke="#2a2f3d" stroke-width="2"/>' +
      '<ellipse cx="1300" cy="480" rx="60" ry="14" fill="#8a96a8" opacity=".14" filter="url(#sq-blur6)" class="lanefog"/></g>';
    // the left house: big, timbered, leaning in toward the square
    s += '<g class="house hl"><path d="M-20 720V300l40-6 330 26v400z" fill="url(#sq-plaster)"/>' +
      '<path d="M-20 300l210-170 200 190z" fill="url(#sq-tiles)"/><path d="M-30 304l220-182 210 200" stroke="#121319" stroke-width="12" fill="none"/><path d="M-30 304l220-182" stroke="#9aa6c6" stroke-width="2" fill="none" opacity=".4"/>' +
      '<rect x="230" y="168" width="34" height="80" fill="#2e2a2a"/><path d="M226 168h42" stroke="#1b1818" stroke-width="8"/><path d="M234 190h26M234 212h26M234 234h26" stroke="#1d1a1a" stroke-width="1.5"/>' +
      timber(20, 330, 160, 130) + timber(190, 340, 130, 120) +
      '<path d="M-20 470l350 10" stroke="#1d140b" stroke-width="14"/><path d="M-20 478l350 10" stroke="#3b2a1a" stroke-width="3"/>' +
      win(60, 360, 44, 60, 22, { shutter: true }) + win(230, 372, 38, 54, 23) + win(110, 520, 48, 66, 24) +
      '<path d="M210 720V560a36 36 0 0 1 72 0v160z" fill="#22180f" stroke="#0e0905" stroke-width="4"/><path d="M220 600h52M220 650h52" stroke="#3a2a1a" stroke-width="3"/><circle cx="268" cy="640" r="3" fill="#9a7a44"/>' +
      '<g class="handprints" fill="#5a1a20"><path d="M232 590c4-10 10-12 12-4 2-8 8-8 8 2 3-6 8-4 6 4l-4 16c-4 6-16 6-20-2z"/><path d="M256 616c4-10 10-12 12-4 2-8 8-8 8 2 3-6 8-4 6 4l-4 16c-4 6-16 6-20-2z" opacity=".7"/></g>' +
      // hanging sign on a bracket, swinging
      '<path d="M330 430h70M352 430v-14" stroke="#1a1410" stroke-width="5"/><g class="sign"><path d="M360 432v14M392 432v14" stroke="#2a2016" stroke-width="2"/><rect x="350" y="446" width="56" height="40" rx="3" fill="#3b2a1a" stroke="#1a1208" stroke-width="2"/><path d="M378 454c-8 0-10 8-10 16h20c0-8-2-16-10-16zM372 474h12" stroke="#c9a35b" stroke-width="2" fill="none" opacity=".75"/></g>' +
      '<path d="M-20 660h350v60H-20z" fill="#3a3b42"/>' + stoneRow(-20, 660, 350, 2) +
      '<path d="M40 520l14 22-6 18 12 20M300 380l-10 26 8 14M150 600l-18 14" stroke="#2e2a22" stroke-width="1.6" fill="none" opacity=".8"/>' +
      '<path d="M-30 304l60-50 40 30 50-40" stroke="#3f5a3a" stroke-width="5" fill="none" opacity=".5"/>' +
      '<g transform="translate(300 668)"><path d="M0 52l4-46q22-8 44 0l4 46z" fill="#3a2716"/><path d="M2 20q24-8 48 0M1 38q26-8 50 0" stroke="#1c140b" stroke-width="3" fill="none"/><path d="M4 6q22-8 44 0" stroke="#5a4029" stroke-width="2" fill="none"/></g>' +
      '<rect x="-20" y="300" width="350" height="420" fill="url(#sq-grain)" opacity=".5"/></g>';
    // the right house: older, a wooden gallery, one window always watching
    s += '<g class="house hr"><path d="M1240 720V316l360-36v440z" fill="url(#sq-plasterR)"/>' +
      '<path d="M1220 320l200-190 200 140v40z" fill="url(#sq-tiles)"/><path d="M1212 324l208-198 200 140" stroke="#121319" stroke-width="12" fill="none"/>' +
      '<path d="M1420 126l200 140" stroke="#9aa6c6" stroke-width="1.6" fill="none" opacity=".25"/>' +
      '<rect x="1330" y="160" width="30" height="70" fill="#2a2727"/><path d="M1326 160h38" stroke="#1b1818" stroke-width="8"/>' +
      timber(1260, 340, 150, 120) + timber(1420, 330, 170, 130) +
      win(1300, 372, 40, 56, 25) + win(1470, 362, 44, 60, 26, { shutter: true }) + win(1320, 540, 46, 60, 27) +
      '<path d="M1230 480h380" stroke="#1d140b" stroke-width="14"/><path d="M1240 488v40M1300 488v40M1360 488v40M1420 488v40M1480 488v40M1540 488v40M1600 488v40" stroke="#2a1d12" stroke-width="5"/><path d="M1232 520h380" stroke="#2a1d12" stroke-width="6"/>' +
      '<path d="M1450 720V580h70v140z" fill="#1f160e" stroke="#0e0905" stroke-width="4"/><path d="M1456 600h58M1456 640h58M1456 680h58" stroke="#38291a" stroke-width="3"/>' +
      '<path d="M1240 660h360v60h-360z" fill="#36373e"/>' + stoneRow(1240, 660, 360, 7) +
      '<path d="M1270 420l-12 24 8 18M1560 560l16 18-4 20" stroke="#2a2620" stroke-width="1.6" fill="none" opacity=".8"/>' +
      '<g transform="translate(1388 664)"><path d="M0 52l4-46q22-8 44 0l4 46z" fill="#33220f"/><path d="M2 20q24-8 48 0M1 38q26-8 50 0" stroke="#1c140b" stroke-width="3" fill="none"/></g><g transform="translate(1340 686) scale(.8)"><path d="M0 52l4-46q22-8 44 0l4 46z" fill="#3a2716"/><path d="M2 22q24-8 48 0" stroke="#1c140b" stroke-width="3" fill="none"/></g>' +
      '<path d="M1530 580h16v-8" stroke="#1d1a17" stroke-width="3" fill="none"/><g class="win lit" data-w="28"><circle class="wglow" cx="1546" cy="590" r="30" fill="url(#sq-warm)"/><rect class="wpane" x="1541" y="582" width="10" height="14" rx="2" fill="#ffc861"/></g>' +
      '<rect x="1240" y="316" width="360" height="404" fill="url(#sq-grain)" opacity=".5"/></g>';
    // the string of lanterns across the square; how many still burn is the Haunting's doing
    s += '<path d="M330 296Q790 410 1250 300" stroke="#16110c" stroke-width="3" fill="none"/>';
    [0.14, 0.32, 0.5, 0.68, 0.86].forEach(function (t, i) {
      var x = (1 - t) * (1 - t) * 330 + 2 * (1 - t) * t * 790 + t * t * 1250, y = (1 - t) * (1 - t) * 296 + 2 * (1 - t) * t * 410 + t * t * 300;
      s += '<g class="slant" data-l="' + i + '" style="transform-origin:' + f1(x) + 'px ' + f1(y) + 'px;animation-delay:' + (-i * 1.1) + 's">' +
        '<circle class="lglow" cx="' + f1(x) + '" cy="' + f1(y + 34) + '" r="70" fill="url(#sq-warm)"/>' +
        '<path d="M' + f1(x) + ' ' + f1(y) + 'v14" stroke="#16110c" stroke-width="2"/><path d="M' + f1(x - 9) + ' ' + f1(y + 14) + 'h18l-3 5v22l3 4h-18l3-4v-22z" fill="#1d1610" stroke="#0b0805" stroke-width="1.5"/>' +
        '<rect class="lflame" x="' + f1(x - 4.5) + '" y="' + f1(y + 21) + '" width="9" height="18" rx="3" fill="#ffc861"/><path d="M' + f1(x - 6) + ' ' + f1(y + 14) + 'l6-6 6 6" fill="#1d1610"/>' +
        '<path class="lsmoke" d="M' + f1(x) + ' ' + f1(y + 8) + 'c-6-10 6-16 0-28" stroke="#9aa3b5" stroke-width="3" fill="none" opacity="0"/></g>';
    });
    return s;
  }

  // ───────────────────────── layer: ground (cobbles in perspective) ─────────────────────────
  var groundCache = null;
  function ground() {
    if (groundCache) return groundCache;
    var r = rng(5), s = '<rect y="470" width="1600" height="430" fill="url(#sq-ground)"/>';
    var y = 482, row = 0;
    s += '<g class="cobbles">';
    while (y < 905) {
      var h = 5 + (y - 470) * 0.085, w = h * 1.9, x = -r() * w;
      while (x < 1600) {
        var ww = w * (0.75 + r() * 0.5), shade = Math.floor(42 + r() * 22), lit = Math.floor(shade * 1.35);
        var c = 'rgb(' + shade + ',' + (shade + 1) + ',' + (shade + 6) + ')';
        var cx = x + ww / 2, cy = y + h / 2, rx = ww / 2 - 1, ry = h / 2 - 0.8;
        s += '<path d="M' + f1(cx - rx) + ' ' + f1(cy) + 'q0 -' + f1(ry) + ' ' + f1(rx) + ' -' + f1(ry) + 't' + f1(rx) + ' ' + f1(ry) + 'q0 ' + f1(ry) + ' -' + f1(rx) + ' ' + f1(ry) + 't-' + f1(rx) + ' -' + f1(ry) + 'z" fill="' + c + '"/>';
        if (y > 560) s += '<path d="M' + f1(cx - rx * 0.7) + ' ' + f1(cy - ry * 0.55) + 'q' + f1(rx * 0.7) + ' -' + f1(ry * 0.5) + ' ' + f1(rx * 1.3) + ' 0" stroke="rgb(' + lit + ',' + lit + ',' + (lit + 8) + ')" stroke-width="' + f1(Math.max(0.8, h * 0.06)) + '" fill="none" opacity=".55"/>';
        x += ww + 1;
      }
      y += h + 1; row++;
    }
    s += '</g>';
    // a worn path, a puddle with the moon in it, a drain grate
    s += '<path d="M640 900Q720 700 780 600h40Q900 720 1020 900z" fill="#000" opacity=".16"/>';
    s += '<g class="puddle"><ellipse cx="470" cy="812" rx="96" ry="16" fill="#0b0f18" opacity=".85"/><ellipse cx="452" cy="810" rx="18" ry="4" fill="#d9dccf" opacity=".45"/><ellipse class="pripple" cx="470" cy="812" rx="40" ry="7" fill="none" stroke="#8a95ab" stroke-width="1" opacity=".3"/></g>';
    s += '<g transform="translate(1010 640)"><rect x="-26" y="-6" width="52" height="12" rx="2" fill="#15161b" stroke="#3a3c45" stroke-width="2"/><path d="M-18-6v12M-8-6v12M2-6v12M12-6v12" stroke="#3a3c45" stroke-width="2"/></g>';
    [0.14, 0.32, 0.5, 0.68, 0.86].forEach(function (t, i) {
      var x = (1 - t) * (1 - t) * 330 + 2 * (1 - t) * t * 790 + t * t * 1250;
      s += '<ellipse class="lpool" data-lp="' + i + '" cx="' + f1(x) + '" cy="' + (560 + Math.abs(t - 0.5) * 40) + '" rx="150" ry="34" fill="url(#sq-warm)"/>';
    });
    // the moon throws the well's shadow down and to the right
    s += '<path d="M690 696L1000 760 1060 740 920 690z" fill="#000" opacity=".28" filter="url(#sq-blur6)"/>';
    s += '<g class="cracks"><path d="M880 760l30 20 -8 24 26 18M720 820l-24 18 10 22" stroke="#c4545e" stroke-width="2" fill="none" opacity=".0"/></g>';
    groundCache = s;
    return s;
  }

  // ───────────────────────── objects ─────────────────────────
  function wellArt(st) {
    var cx = 800, rimY = 586, rx = 124, ry = 30, baseY = 690, s = '';
    s += '<ellipse cx="' + cx + '" cy="' + (baseY + 6) + '" rx="170" ry="30" fill="#000" opacity=".45"/>';
    // the stone drum: blocks laid along the curve, lit from the moon (upper left)
    var r = rng(3), rows = 5, rh = (baseY - rimY) / rows;
    s += '<path d="M' + (cx - rx) + ' ' + rimY + 'V' + baseY + 'A' + rx + ' ' + ry + ' 0 0 0 ' + (cx + rx) + ' ' + baseY + 'V' + rimY + 'z" fill="#3c3e46"/>';
    for (var i = 0; i < rows; i++) {
      var off = (i % 2) * 0.13, n = 8;
      for (var j = -1; j < n; j++) {
        var a0 = Math.PI * Math.max(0, (j + off) / n), a1 = Math.PI * Math.min(1, (j + 1 + off) / n); if (a1 <= a0) continue;
        var y0 = rimY + i * rh, y1 = y0 + rh - 2;
        var x0 = cx - rx * Math.cos(a0), x1 = cx - rx * Math.cos(a1), yy0 = Math.sin(a0) * ry, yy1 = Math.sin(a1) * ry;
        var light = 0.55 + 0.45 * Math.cos((a0 + a1) / 2 - 0.6), sh = Math.floor(70 + light * 56 + r() * 14);
        s += '<path d="M' + f1(x0 + 1) + ' ' + f1(y0 + yy0 + 1) + 'L' + f1(x1 - 1) + ' ' + f1(y0 + yy1 + 1) + 'L' + f1(x1 - 1) + ' ' + f1(y1 + yy1) + 'L' + f1(x0 + 1) + ' ' + f1(y1 + yy0) + 'z" fill="rgb(' + sh + ',' + (sh + 2) + ',' + (sh + 8) + ')" stroke="#24262c" stroke-width="1.2"/>';
        if (r() < 0.22) s += '<path d="M' + f1(x0 + 3) + ' ' + f1(y1 + yy0 - 2) + 'q' + f1((x1 - x0) / 2) + ' -6 ' + f1(x1 - x0 - 6) + ' 0" stroke="#3f5a3a" stroke-width="3" fill="none" opacity=".7"/>';
      }
    }
    s += '<path d="M' + (cx - rx) + ' ' + rimY + 'V' + baseY + 'A' + rx + ' ' + ry + ' 0 0 0 ' + (cx + rx) + ' ' + baseY + 'V' + rimY + 'z" fill="url(#sq-grain)" opacity=".5"/>';
    // the rim cap and the opening
    s += '<ellipse cx="' + cx + '" cy="' + rimY + '" rx="' + (rx + 8) + '" ry="' + (ry + 7) + '" fill="#8a8c95"/><ellipse cx="' + cx + '" cy="' + (rimY - 3) + '" rx="' + (rx + 6) + '" ry="' + (ry + 5) + '" fill="#9fa1aa"/>';
    s += '<path d="M' + (cx - rx - 6) + ' ' + (rimY - 3) + 'a' + (rx + 6) + ' ' + (ry + 5) + ' 0 0 1 ' + (rx + 6) + ' -' + (ry + 5) + '" stroke="#d9dbe4" stroke-width="2" fill="none" opacity=".55"/>';
    s += '<ellipse cx="' + cx + '" cy="' + (rimY - 2) + '" rx="' + (rx - 10) + '" ry="' + (ry - 6) + '" fill="url(#sq-deep)"/>';
    s += '<ellipse class="wl-light" cx="' + cx + '" cy="' + (rimY - 1) + '" rx="' + (rx - 30) + '" ry="' + (ry - 12) + '" fill="url(#sq-cold)"/>';
    // ripples that travel inward, the wrong way
    s += '<g class="wl-rip">';
    for (var k = 0; k < 3; k++) s += '<ellipse cx="' + cx + '" cy="' + (rimY - 1) + '" rx="' + (rx - 18) + '" ry="' + (ry - 9) + '" fill="none" stroke="#9fd8e6" stroke-width="1.4" style="animation-delay:' + (-k * 1.4) + 's"/>';
    s += '</g>';
    // chalk mark: you have leaned over this well (state "done")
    s += '<path class="chalk" d="M' + (cx + 70) + ' ' + (rimY + 14) + 'l10 -8m-10 0l10 8" stroke="#e8e2c9" stroke-width="2.4" opacity="0"/>';
    // the wooden frame, winch and roof
    s += '<path d="M690 700V408h18v292zM892 700V408h18v292z" fill="url(#sq-wood)"/><path d="M690 700V408h5v292zM892 700V408h5v292z" fill="#7a5a38" opacity=".6"/>';
    s += '<path d="M676 420h248v14H676z" fill="#4a3320"/><path d="M676 420h248" stroke="#7a5a38" stroke-width="2"/>';
    s += '<path d="M652 424L800 330 948 424h-18L800 350 670 424z" fill="#2a1d12"/><path d="M670 424L800 350 930 424z" fill="url(#sq-shingle)"/><path d="M652 424L800 330" stroke="#a7b1cc" stroke-width="2" opacity=".35"/>';
    s += '<g class="winch"><rect x="728" y="446" width="144" height="26" rx="12" fill="#4a3320" stroke="#24180d" stroke-width="2"/><path d="M736 452h128M736 459h128M736 466h128" stroke="#8b7a5a" stroke-width="2.2" opacity=".75"/><path d="M872 459h22v26" stroke="#3a3c45" stroke-width="5" fill="none" stroke-linecap="round"/></g>';
    s += '<path class="rope" d="M800 472V512" stroke="#8b7a5a" stroke-width="3"/>';
    s += '<g class="bucket"><path d="M782 512h36l-4 30h-28z" fill="#4a3320" stroke="#24180d" stroke-width="2"/><path d="M782 520h36M783 534h34" stroke="#3a3c45" stroke-width="3"/><path d="M784 512q16-14 32 0" stroke="#3a3c45" stroke-width="2" fill="none"/></g>';
    // the water that falls upward
    s += '<g class="wl-up"><path class="wl-stream" d="M800 570C792 500 812 450 800 380S796 260 806 180" stroke="url(#sq-stream)" stroke-width="5" fill="none" stroke-linecap="round"/>';
    for (var d = 0; d < 14; d++) s += '<ellipse class="drop" cx="' + (790 + (d * 37 % 22)) + '" cy="572" rx="' + (1.6 + (d % 3) * 0.6) + '" ry="' + (2.4 + (d % 3) * 0.7) + '" fill="#d6f1f7" style="animation-delay:' + f1(-d * 0.42) + 's;--dx:' + ((d % 5) - 2) * 4 + 'px"/>';
    s += '</g>';
    s += '<g class="wl-fog"><ellipse cx="760" cy="600" rx="90" ry="14" fill="#9aa7b8" opacity=".22" filter="url(#sq-blur6)"/><ellipse cx="860" cy="606" rx="70" ry="10" fill="#9aa7b8" opacity=".18" filter="url(#sq-blur6)"/></g>';
    return s;
  }

  function boardArt(st) {
    var s = '<g transform="translate(0 0)">';
    s += '<ellipse cx="452" cy="728" rx="110" ry="14" fill="#000" opacity=".4"/>';
    s += '<path d="M382 730V488h14v242zM504 730V488h14v242z" fill="url(#sq-wood)"/><path d="M382 730V488h4v242z" fill="#8a6a44" opacity=".5"/>';
    s += '<path d="M352 492l98-34 98 34z" fill="#2a1d12"/><path d="M360 492l90-28 90 28z" fill="url(#sq-shingle)"/><path d="M352 492h196" stroke="#1d140b" stroke-width="5"/>';
    s += '<rect x="364" y="500" width="172" height="124" rx="3" fill="#4d3622" stroke="#21160c" stroke-width="4"/><rect x="364" y="500" width="172" height="124" fill="url(#sq-grain)"/>';
    s += '<path d="M364 541h172M364 582h172" stroke="#2b1d11" stroke-width="2"/>';
    // the notices (the ledger is the one with the red seal; it can be pulled forward)
    var pin = function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="2.4" fill="#8f8a7a"/><circle cx="' + (x - 0.6) + '" cy="' + (y - 0.6) + '" r="0.9" fill="#fff" opacity=".6"/>'; };
    var lines = function (x, y, w, n, gap) { var o = ''; for (var i = 0; i < n; i++) o += '<path d="M' + x + ' ' + (y + i * gap) + 'h' + (w * (0.6 + ((i * 37) % 40) / 100)) + '" stroke="#5c4a30" stroke-width="1.3"/>'; return o; };
    s += '<g class="paper p1" style="transform-origin:386px 508px"><path d="M374 508h34v44l-4 4h-30z" fill="url(#sq-paper)"/><path d="M404 552l4-4v8z" fill="#9a8a68"/>' + lines(379, 518, 24, 6, 5.4) + pin(391, 508) + '</g>';
    s += '<g class="paper p2" style="transform-origin:430px 506px"><path d="M414 506h32v28h-32z" fill="#d8ccaa" transform="rotate(3 430 520)"/>' + lines(418, 515, 22, 3, 6) + '<path d="M420 529l18 0" stroke="#7a2f3a" stroke-width="1.5"/>' + pin(430, 507) + '</g>';
    s += '<g class="paper p3" style="transform-origin:470px 507px"><path d="M454 507h26v40h-26z" fill="url(#sq-paper)" transform="rotate(-2 467 527)"/>' + lines(458, 516, 18, 5, 5.6) + pin(467, 508) + '</g>';
    s += '<g class="paper p4 flutter" style="transform-origin:504px 506px"><path d="M488 506h36v24l-8 8h-28z" fill="#e0d6b4"/><path d="M516 538l8-8h-8z" fill="#a8996f"/>' + lines(492, 514, 26, 3, 6) + pin(504, 507) + '</g>';
    // THE LEDGER: who voted to sell what (the clue)
    s += '<g class="paper ledger" style="transform-origin:420px 552px"><path d="M398 552h52v58h-52z" fill="url(#sq-paper)" transform="rotate(-3 424 580)"/>' +
      '<g transform="rotate(-3 424 580)"><path d="M404 560h40" stroke="#3a2a16" stroke-width="2"/>' + lines(404, 568, 36, 7, 5) + '<circle cx="438" cy="600" r="5" fill="#8a1f2a"/><circle cx="437" cy="599" r="2" fill="#b4404c"/></g>' + pin(424, 553) + '</g>';
    s += '<g class="paper p5 flutter" style="transform-origin:490px 556px;animation-delay:-2.4s"><path d="M470 556h44v34h-44z" fill="#cfc29a" transform="rotate(4 492 573)"/>' + lines(475, 565, 34, 4, 6) + pin(492, 557) + '</g>';
    // torn corner left behind when the ledger has been taken
    s += '<path class="torn" d="M418 553h12l-3 6-4-3-5 4z" fill="url(#sq-paper)" opacity="0"/>';
    // the phase III detail: every notice shows the same red date
    s += '<g class="reddate" opacity="0"><path d="M378 548h22M418 530h20M458 540h18M492 524h24M476 582h30" stroke="#a3202c" stroke-width="2.4"/></g>';
    // its own small lantern on an iron bracket, throwing a moving shadow
    s += '<path d="M518 500h34v6" stroke="#1d1a17" stroke-width="4" fill="none"/>';
    s += '<g class="blant" style="transform-origin:552px 506px"><circle class="lglow2" cx="552" cy="528" r="80" fill="url(#sq-warm)"/><path d="M552 506v8" stroke="#1d1a17" stroke-width="2"/><path d="M544 514h16l-2 4v16l2 3h-16l2-3v-16z" fill="#1d1610" stroke="#0b0805" stroke-width="1.2"/><rect class="bflame" x="548.5" y="520" width="7" height="13" rx="2.5" fill="#ffc861"/></g>';
    s += '<path class="bshadow" d="M364 624l-30 100h190l12-100z" fill="#000" opacity=".22"/>';
    return s + '</g>';
  }

  function campArt(st) {
    var s = '<g transform="translate(-10 -56)">';
    s += '<ellipse cx="1150" cy="812" rx="190" ry="26" fill="#000" opacity=".4"/>';
    // the light pool once someone has made camp here (state "lit")
    s += '<circle class="camp-light" cx="1170" cy="720" r="260" fill="url(#sq-warm)" opacity="0"/>';
    // fire ring, charred logs, a cold wisp
    s += '<g><ellipse cx="1090" cy="800" rx="54" ry="13" fill="#141418"/>';
    for (var i = 0; i < 9; i++) { var a = i / 9 * Math.PI * 2; s += '<ellipse cx="' + f1(1090 + Math.cos(a) * 54) + '" cy="' + f1(800 + Math.sin(a) * 13) + '" rx="11" ry="6" fill="' + (Math.sin(a) > 0 ? '#5a5c64' : '#3d3f46') + '" stroke="#1b1c21" stroke-width="1.2"/>'; }
    s += '<path d="M1062 800l52-14M1066 788l50 16" stroke="#1d130b" stroke-width="8" stroke-linecap="round"/><path d="M1064 799l50-13" stroke="#5a2a14" stroke-width="2" opacity=".8"/>';
    s += '<g class="fire"><path class="ff1" d="M1090 798c-20-18-6-34 0-58 8 22 22 36 0 58z" fill="#ff9d3a"/><path class="ff2" d="M1090 798c-10-10-3-22 0-34 4 12 12 22 0 34z" fill="#ffe08a"/><circle cx="1090" cy="770" r="80" fill="url(#sq-warm2)" opacity=".5"/></g>';
    s += '<circle class="ember" cx="1092" cy="794" r="2.2" fill="#ff7a2a"/><circle class="ember" cx="1082" cy="797" r="1.5" fill="#ff7a2a" style="animation-delay:-1.3s"/></g>';
    // a log bench with a folded blanket, a dropped flask
    s += '<path d="M1110 836h170l6 14h-182z" fill="#2a1d12"/><rect x="1108" y="818" width="176" height="20" rx="10" fill="url(#sq-woodv)"/><ellipse cx="1284" cy="828" rx="7" ry="10" fill="#6a4d30"/><ellipse cx="1284" cy="828" rx="3.5" ry="5" fill="#3a2a18"/>';
    s += '<path d="M1140 818q20-14 52-4l6 8h-60z" fill="#5a2a2a"/><path d="M1146 814q20-8 46-1" stroke="#7a3a3a" stroke-width="2" fill="none"/>';
    s += '<g transform="rotate(-62 1046 838)"><rect x="1036" y="826" width="20" height="30" rx="4" fill="#3a4a3e" stroke="#1b221d" stroke-width="1.5"/><rect x="1042" y="818" width="8" height="9" fill="#6a5a3a"/><path d="M1040 838h12" stroke="#c9a35b" stroke-width="1.5" opacity=".6"/></g>';
    // the crate and THE ABANDONED LANTERN on it
    s += '<g class="crate"><path d="M1170 790V726h76v64z" fill="#4a3320" stroke="#1f150b" stroke-width="2.4"/><path d="M1170 746h76M1170 768h76M1176 726l64 64M1240 726l-64 64" stroke="#2b1d11" stroke-width="2.6"/><rect x="1170" y="726" width="76" height="64" fill="url(#sq-grain)"/><path d="M1166 726h84l-6-8h-72z" fill="#5a3f27"/></g>';
    s += '<g class="alantern"><circle class="al-glow" cx="1208" cy="690" r="110" fill="url(#sq-warm2)" opacity=".2"/>' +
      '<path d="M1196 668q12-20 24 0" stroke="#3a3c45" stroke-width="3" fill="none"/><path d="M1192 672h32l-3 6h-26z" fill="#2a2a30"/>' +
      '<path d="M1194 678h28v34h-28z" fill="#1a1c22" opacity=".55"/><path class="al-pane" d="M1196 680h24v30h-24z" fill="#e8d6a4" opacity=".12"/>' +
      '<path d="M1194 678v34M1208 678v34M1222 678v34" stroke="#2a2a30" stroke-width="2.6"/><path d="M1190 712h36l-2 6h-32z" fill="#2a2a30"/>' +
      '<g class="al-flame"><path d="M1208 708c-6-6-3-12 0-20 3 8 6 14 0 20z" fill="#ffb347"/><path d="M1208 708c-3-3-1-7 0-11 1.5 4 3 8 0 11z" fill="#fff1b8"/></g>' +
      '<circle class="al-ember" cx="1208" cy="706" r="2" fill="#ff8a3a"/></g>';
    return s + '</g>';
  }

  function postcardsArt(st) {
    var s = '<g class="pc-scatter">';
    var cards = [[560, 748, -14], [612, 764, 9], [654, 742, -4], [590, 780, 21], [690, 772, -18]];
    cards.forEach(function (c, i) {
      s += '<g transform="translate(' + c[0] + ' ' + c[1] + ') rotate(' + c[2] + ')"><rect x="-26" y="-17" width="52" height="34" rx="2" fill="' + (i % 2 ? '#cdbf97' : '#dccfa8') + '" stroke="#7a6a48" stroke-width="1"/>' +
        '<rect x="-21" y="-12" width="26" height="24" fill="#8a7a5a" opacity=".55"/><path d="M-19 8l6-10 5 6 4-8 6 12z" fill="#4a3f2c" opacity=".7"/><path d="M-8 -8v-3M-10 -11h4" stroke="#4a3f2c" stroke-width="1.2"/>' +
        '<path d="M9 -6h12M9 -1h10M9 4h12" stroke="#6a5a3a" stroke-width="1"/><rect x="16" y="-14" width="7" height="8" fill="#7a2f3a" opacity=".7"/></g>';
    });
    s += '</g><g class="pc-stack" opacity="0"><g transform="translate(620 766) rotate(-4)"><rect x="-28" y="-14" width="56" height="34" rx="2" fill="#a8996f"/><rect x="-28" y="-18" width="56" height="34" rx="2" fill="#cdbf97"/><rect x="-28" y="-22" width="56" height="34" rx="2" fill="#dccfa8" stroke="#7a6a48"/><path d="M-6 -16h26M-6 -10h20" stroke="#6a5a3a"/><path d="M-22 6h12" stroke="#2a8a7a" stroke-width="2"/></g></g>';
    return s;
  }

  // ───────────────────────── layer: foreground ─────────────────────────
  function fore() {
    var s = '';
    // bottom-left: a leaning cart wheel, a post, tall grass
    s += '<g fill="#07080b"><path d="M-10 900V700l26-6 10 206z"/><circle cx="110" cy="840" r="92" fill="none" stroke="#07080b" stroke-width="16"/><circle cx="110" cy="840" r="14"/>';
    for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2; s += '<path d="M110 840L' + f1(110 + Math.cos(a) * 88) + ' ' + f1(840 + Math.sin(a) * 88) + '" stroke="#07080b" stroke-width="8"/>'; }
    s += '<path d="M190 900c4-50 10-80 2-120 12 30 14 70 10 120zM220 900c-2-40 8-70 26-96-10 40-12 66-14 96zM150 900c6-30 20-46 40-60-14 24-22 40-26 60z"/></g>';
    s += '<path d="M18 694l10 206" stroke="#3a4560" stroke-width="2" opacity=".5"/><path d="M28 760a92 92 0 0 1 120-60" stroke="#3a4560" stroke-width="2" fill="none" opacity=".45"/>';
    // bottom-right: barrel and a fence
    s += '<g fill="#07080b"><path d="M1430 900l8-150q50-14 100 0l8 150z"/><path d="M1546 900V720h14v180zM1590 900V700h14v200z"/><path d="M1546 760h70M1546 820h70" stroke="#07080b" stroke-width="10"/></g>';
    s += '<path d="M1440 760q48-12 96 0M1436 820q52-8 104 0" stroke="#2c3346" stroke-width="3" fill="none" opacity=".7"/><path d="M1438 752l8 148" stroke="#3a4560" stroke-width="2" opacity=".5"/>';
    // a hanging branch at the top edge
    s += '<path d="M1600 0v60c-60 10-120 40-180 30 50-14 70-30 120-60z" fill="#06070a"/><path d="M1500 40c-30 30-60 40-110 46" stroke="#06070a" stroke-width="6" fill="none"/><g fill="#06070a"><ellipse cx="1430" cy="86" rx="12" ry="5" transform="rotate(20 1430 86)"/><ellipse cx="1470" cy="70" rx="12" ry="5" transform="rotate(-10 1470 70)"/></g>';
    return s;
  }

  function fog(front) {
    if (!front) return '<g class="fogb"><ellipse cx="400" cy="490" rx="500" ry="40" fill="#8e9bb0" opacity=".22" filter="url(#sq-blur18)"/><ellipse cx="1200" cy="480" rx="520" ry="34" fill="#8e9bb0" opacity=".2" filter="url(#sq-blur18)"/><ellipse cx="800" cy="520" rx="420" ry="26" fill="#a3aec0" opacity=".14" filter="url(#sq-blur18)"/></g>';
    return '<g class="fogf"><ellipse cx="300" cy="820" rx="560" ry="60" fill="#8e9bb0" opacity=".2" filter="url(#sq-blur18)"/><ellipse cx="1300" cy="860" rx="600" ry="70" fill="#8e9bb0" opacity=".18" filter="url(#sq-blur18)"/></g>';
  }

  // ───────────────────────── object close-ups (shown in the interaction card) ─────────────────────────
  // A close-up is the same drawing, framed tighter, with a little extra life added.
  var EXTRA = {
    well: function () { var s = ''; for (var i = 0; i < 6; i++) s += '<ellipse class="drop big" cx="' + (792 + i * 3) + '" cy="560" rx="2.6" ry="4" fill="#e6f8fb" style="animation-delay:' + (-i * 0.6) + 's"/>'; return s; },
    board: function () { return ''; },
    lantern: function () { return ''; }
  };

  SC.register({
    id: 'square',
    vb: [1600, 900],
    defs: DEFS,
    // painted layers, back to front. depth = how much the layer moves with the camera's parallax.
    layers: function (st) {
      return [
        { id: 'sky', depth: 0.06, svg: sky(), src: 'art/square/sky.webp' },
        { id: 'far', depth: 0.18, svg: far(), src: 'art/square/far.webp' },
        { id: 'fogb', depth: 0.3, svg: fog(false), cls: 'fog' },
        { id: 'mid', depth: 0.42, svg: mid(st), src: 'art/square/mid.webp' },
        { id: 'ground', depth: 0.62, svg: ground(), src: 'art/square/ground.webp' },
        { id: 'objects', depth: 0.62, objects: true },
        { id: 'fogf', depth: 0.85, svg: fog(true), cls: 'fog' },
        { id: 'fore', depth: 1.15, svg: fore(), src: 'art/square/fore.webp' }
      ];
    },
    // things you can touch. box = [x, y, w, h] hit area; at = focus point; crop = close-up framing; z = camera zoom
    objects: {
      board: { name: 'Notice Board', art: boardArt, box: [350, 456, 210, 280], at: [450, 560], crop: [338, 468, 244, 136], z: 2.1, sfx: 'paper',
        actions: [{ opt: 'board' }], art2: 'board', blurb: 'Every notice dated the same day.' },
      well: { name: 'The Wishing Well', art: wellArt, box: [650, 320, 300, 390], at: [800, 540], crop: [620, 440, 360, 200], z: 1.8, sfx: 'water',
        actions: [{ opt: 'well' }], art2: 'well', blurb: 'It drips upward.' },
      lantern: { name: 'Abandoned Lantern', art: campArt, box: [1020, 594, 270, 200], at: [1170, 684], crop: [1040, 560, 250, 140], z: 2.0, sfx: 'creak',
        actions: [{ opt: 'rally' }], art2: 'lantern', blurb: 'Someone left it here. And a flask.' },
      postcards: { name: 'Fallen Postcards', art: postcardsArt, box: [520, 720, 210, 90], at: [620, 760], crop: [515, 700, 230, 120], z: 2.2, sfx: 'paper',
        actions: [{ act: 'investigate' }], art2: 'postcards', blurb: 'Thornwick, as the postcards had it.' },
      tower: { name: 'The Bell Tower', box: [944, 50, 136, 420], at: [1010, 230], crop: [920, 120, 180, 100], z: 1.6, sfx: 'bell',
        actions: [{ move: 'belltower' }], art2: 'tower', blurb: 'The bell rings. The tower is empty.' },
      lane: { name: 'The Lanes Out', box: [1240, 370, 120, 130], at: [1300, 440], crop: [1210, 370, 180, 100], z: 1.9, sfx: 'step',
        actions: [{ act: 'travel' }], art2: 'lane', blurb: 'Every road leads somewhere worse.' }
    },
    extra: EXTRA,
    // apply object states (from real game state) to the drawn objects
    state: function (root, st) {
      var q = function (s) { return root.querySelector(s); };
      var tg = function (sel, cls, on) { var e = q(sel); if (e) e.classList.toggle(cls, !!on); };
      tg('.obj-board', 'taken', st.flags.ledger);
      tg('.obj-well', 'done', st.done.well);
      tg('.obj-lantern', 'lit', st.done.rally || st.flags.blessedHere);
      tg('.obj-postcards', 'stacked', st.inv);
    },
    // animate a resolved outcome on its object (the outcome itself comes from the server)
    fx: {
      board: function (el, tier, R) { return tier === 'ok' || tier === 'crit' ? 'pull' : 'crumble'; },
      well: function (el, tier) { return tier === 'ok' || tier === 'crit' ? 'answer' : 'whisper'; },
      lantern: function () { return 'ignite'; },
      postcards: function () { return 'gather'; }
    }
  });
})(window);
