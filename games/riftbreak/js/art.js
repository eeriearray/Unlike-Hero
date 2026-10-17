/* RIFTBREAK — original vector artwork, generated as SVG strings.
   window.RiftArt: defs() (shared gradients/clip paths, inserted once), card(card), back(), glyph(name), avatar(id, hue),
                   ruleGlyph(ruleId), SUIT_HEX, PIP (suit pips).
   Every card is drawn on a 100×140 grid so one set of artwork scales from phones to big screens. */
(function (global) {
  'use strict';
  var SUIT_HEX = { cyan: '#22c7f0', crimson: '#f0435a', gold: '#ffc93c', violet: '#9a5cf0' };
  var SUIT_LIGHT = { cyan: '#62dbf8', crimson: '#ff7083', gold: '#ffdd75', violet: '#b88aff' };
  var SUIT_DEEP = { cyan: '#1197cc', crimson: '#c92a45', gold: '#eda116', violet: '#7038d4' };
  // Darker inks for symbols drawn on the white centre panel, so every suit reads clearly on white.
  var SUIT_INK = { cyan: '#0a8fbd', crimson: '#d92849', gold: '#d48a00', violet: '#6a35d0' };
  var NAVY = '#151a45';
  var ISLAND_GEOM;
  var SEAT_HUES = [188, 350, 44, 266, 150, 18, 220, 300];

  function defs() {
    var g = '';
    Object.keys(SUIT_HEX).forEach(function (s) {
      g += '<linearGradient id="rb-s-' + s + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + SUIT_LIGHT[s] + '"/><stop offset="1" stop-color="' + SUIT_DEEP[s] + '"/></linearGradient>';
    });
    g += '<linearGradient id="rb-s-wild" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d3584"/><stop offset="1" stop-color="#161b4d"/></linearGradient>' +
      '<linearGradient id="rb-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c3486"/><stop offset="1" stop-color="#161b4e"/></linearGradient>' +
      '<linearGradient id="rb-frame-wild" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + SUIT_HEX.cyan + '"/><stop offset=".33" stop-color="' + SUIT_HEX.violet + '"/><stop offset=".66" stop-color="' + SUIT_HEX.crimson + '"/><stop offset="1" stop-color="' + SUIT_HEX.gold + '"/></linearGradient>' +
      '<linearGradient id="rb-frame-rift" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5af0ff"/><stop offset=".5" stop-color="#ff3df0"/><stop offset="1" stop-color="#9a5cf0"/></linearGradient>' +
      '<linearGradient id="rb-holo" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="rb-void"><stop offset="0" stop-color="#3a1680"/><stop offset=".6" stop-color="#12062e"/><stop offset="1" stop-color="#05030f"/></radialGradient>' +
      '<pattern id="rb-hex" width="10" height="17.32" patternUnits="userSpaceOnUse" patternTransform="scale(.9)"><path d="M5 0 10 2.9V8.7L5 11.5 0 8.7V2.9zM5 11.5V17.32M0 2.9-5 0M10 2.9 15 0" fill="none" stroke="#fff" stroke-width=".7"/></pattern>' +
      '<clipPath id="rb-avclip"><circle r="27"/></clipPath>' +
      '<clipPath id="rb-body"><rect x="5" y="5" width="90" height="130" rx="8"/></clipPath>';
    return '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' + g + '</defs></svg>';
  }

  // ───────────── glyphs (drawn in a 60×60 box centred on 0,0) ─────────────
  var GLYPH = {
    skip: '<circle r="19" fill="none" stroke="currentColor" stroke-width="6"/><path d="M-13 13 13 -13" stroke="currentColor" stroke-width="6.5" stroke-linecap="round"/>',
    reverse: '<path d="M-17 -4a17 17 0 0 1 29-11" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M15 -24 14 -9 -1 -11" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path d="M17 4a17 17 0 0 1 -29 11" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M-15 24 -14 9 1 11" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/>',
    surge: '<path d="M4 -26 -14 3 -2 3 -6 26 14 -5 2 -5z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    stabilize: '<path d="M0 -24V-2" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M-20 -2H20M-13 8H13M-6 18H6" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/>' +
      '<path d="M-26 -16 -20 -26M26 -16 20 -26" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".6"/>',
    rift: '<path d="M-6 -28 5 -10 -4 -4 9 8 -1 13 6 28" fill="none" stroke="#fff" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path d="M-6 -28 5 -10 -4 -4 9 8 -1 13 6 28" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round" opacity=".35"/>' +
      '<path d="M-20 -12l7 3-5 5zM16 -18l6 4-7 2zM-18 16l6-2-1 7zM18 18l-5 4 1-7z" fill="currentColor"/>',
    wild: '<g><path d="M0 0V-22A22 22 0 0 1 22 0z" fill="' + SUIT_HEX.cyan + '"/><path d="M0 0H22A22 22 0 0 1 0 22z" fill="' + SUIT_HEX.gold + '"/>' +
      '<path d="M0 0V22A22 22 0 0 1 -22 0z" fill="' + SUIT_HEX.crimson + '"/><path d="M0 0H-22A22 22 0 0 1 0 -22z" fill="' + SUIT_HEX.violet + '"/>' +
      '<circle r="22" fill="none" stroke="#fff" stroke-width="2.5"/><circle r="7" fill="#0a0f2a" stroke="#fff" stroke-width="2"/></g>'
  };
  GLYPH.overload = '<g transform="scale(.82)">' + GLYPH.wild + '</g><g stroke="#fff" stroke-width="3" stroke-linecap="round">' +
    '<path d="M0 -24V-30M0 24V30M-24 0H-30M24 0H30M-17 -17l-4 -4M17 17l4 4M-17 17l-4 4M17 -17l4 -4"/></g>';
  GLYPH.wildrift = '<g transform="scale(.9)">' + GLYPH.wild + '</g><path d="M-4 -26 4 -8 -3 -2 7 9 -1 13 4 26" fill="none" stroke="#0a0f2a" stroke-width="5" stroke-linejoin="round"/><path d="M-4 -26 4 -8 -3 -2 7 9 -1 13 4 26" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>';

  function glyph(name, color) {
    return '<svg viewBox="-30 -30 60 60" class="glyph" style="color:' + (color || 'currentColor') + '" aria-hidden="true">' + (GLYPH[name] || '') + '</svg>';
  }

  var LABEL = { skip: 'SKIP', reverse: 'REVERSE', surge: 'SURGE', stabilize: 'STABILIZE', rift: 'RIFT', wild: 'WILD', overload: 'OVERLOAD', wildrift: 'WILD RIFT' };
  var CORNER = { surge: '+2', overload: '+4' };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Small suit pips (drawn in a 12×12 box centred on 0,0) so suits never rely on color alone.
  var PIP = {
    cyan: '<path d="M0-6C3-2 4.5 0.5 4.5 2.3A4.5 4.5 0 0 1-4.5 2.3C-4.5 0.5-3-2 0-6z"/>',
    crimson: '<path d="M0-6C1 -3 4.5-1.5 4.5 2.2A4.5 4.5 0 0 1-4.5 2.2C-4.5 0-3-1-2-3-1-1.5 0-1.8 0-6z"/>',
    gold: '<path d="M0-6 1.8-1.9 6-1.9 2.6 0.8 3.8 5.4 0 2.8-3.8 5.4-2.6 0.8-6-1.9-1.8-1.9z"/>',
    violet: '<path d="M2.5-5.6A6 6 0 1 0 5.6 2.5 4.6 4.6 0 0 1 2.5-5.6z"/>'
  };
  function pip(suit, x, y, s, rot) {
    if (!suit) return '';
    return '<g transform="translate(' + x + ' ' + y + ')' + (rot ? ' rotate(180)' : '') + ' scale(' + (s || 1) + ')" fill="#fff" stroke="' + NAVY + '" stroke-width="1.2" stroke-linejoin="round" paint-order="stroke">' + PIP[suit] + '</g>';
  }
  // Illustrated suit scenes painted behind every suited card (100×140 grid). "L" = light tone, "D" = deep tone.
  var SCENE = (function () {
    var rays = '';
    for (var i = 0; i < 14; i++) {
      var a = i / 14 * Math.PI * 2, b = a + 0.12;
      rays += 'M50 70L' + (50 + Math.cos(a) * 90).toFixed(1) + ' ' + (70 + Math.sin(a) * 90).toFixed(1) + 'L' + (50 + Math.cos(b) * 90).toFixed(1) + ' ' + (70 + Math.sin(b) * 90).toFixed(1) + 'z';
    }
    var spark = function (x, y, s) { return '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0-6 1.4-1.4 6 0 1.4 1.4 0 6-1.4 1.4-6 0-1.4-1.4z" fill="#fff"/>'; };
    return {
      // water: a big swirl, a breaking wave and bubbles
      cyan: '<path d="M-5 108Q14 92 32 104T70 100 110 96V140H-5z" fill="D" opacity=".6"/><path d="M-5 116Q16 102 36 112T74 108 110 106V140H-5z" fill="L" opacity=".7"/>' +
        '<path d="M50 28C76 28 88 52 82 72 76 94 50 98 40 86 31 75 40 61 51 64 58 66 59 74 54 77" fill="none" stroke="D" stroke-width="12" stroke-linecap="round" opacity=".55" transform="translate(3 4)"/>' +
        '<path d="M50 28C76 28 88 52 82 72 76 94 50 98 40 86 31 75 40 61 51 64 58 66 59 74 54 77" fill="none" stroke="L" stroke-width="10" stroke-linecap="round"/>' +
        '<path d="M18 64C12 42 24 22 44 16M86 96C90 110 82 122 70 126" fill="none" stroke="L" stroke-width="5" stroke-linecap="round" opacity=".8"/>' +
        '<path d="M70 108C82 108 86 120 78 126 72 130 66 124 70 120" fill="none" stroke="L" stroke-width="4" stroke-linecap="round" opacity=".9"/><path d="M28 30C20 30 18 22 24 18" fill="none" stroke="L" stroke-width="3.5" stroke-linecap="round"/>' +
        '<path d="M86 64C89 69 91 72 91 74A3 3 0 0 1 85 74C85 72 87 69 86 64zM14 84C16 87 17 89 17 90A2 2 0 0 1 13 90C13 89 14 87 14 84z" fill="#fff" opacity=".8"/>' +
        '<g fill="none" stroke="#fff" stroke-width="1.6" opacity=".75"><circle cx="22" cy="92" r="4"/><circle cx="31" cy="102" r="2.4"/><circle cx="78" cy="30" r="3.6"/><circle cx="86" cy="42" r="2"/><circle cx="16" cy="40" r="2.2"/></g>',
      // fire: flame tongues rising from the bottom, a lightning bolt and sparks
      crimson: '<path d="M-2 140C4 118 14 112 12 94 24 104 26 118 30 122 30 106 38 94 36 76 52 92 52 114 54 122 58 110 66 102 64 86 78 100 80 120 82 126 86 118 92 112 102 108V140z" fill="D" opacity=".7"/>' +
        '<path d="M-2 140C6 124 16 120 16 108 26 116 28 128 32 130 34 118 40 110 40 98 52 110 52 124 56 130 60 120 66 114 66 104 76 114 78 128 82 132 88 126 94 122 102 120V140z" fill="L" opacity=".85"/>' +
        '<path d="M66 12 44 48H58L42 82 76 38H62z" fill="D" opacity=".55" transform="translate(3 3)"/><path d="M66 12 44 48H58L42 82 76 38H62z" fill="L"/>' +
        '<path d="M26 20 16 40H22L14 56 32 34H25z" fill="L" opacity=".75"/><path d="M84 92 78 104H82L76 116 90 100H85z" fill="L" opacity=".65"/>' +
        '<g fill="#ffd27a" opacity=".9"><circle cx="30" cy="100" r="1.6"/><circle cx="72" cy="94" r="1.3"/><circle cx="46" cy="104" r="1.1"/><circle cx="58" cy="96" r="1.5"/></g>' +
        '<g fill="#fff" opacity=".8"><path d="M20 30l3 6-6-1z"/><path d="M84 66l4 5-6 1z"/><path d="M14 74l4-3 1 5z"/><path d="M80 18l3 3-4 2z"/></g>',
      // sun: radiating rays, a bright core and four-point sparkles
      gold: '<path d="' + rays + '" fill="L" opacity=".55"/><circle cx="50" cy="70" r="34" fill="D" opacity=".35"/><circle cx="50" cy="70" r="27" fill="L" opacity=".75"/>' +
        '<circle cx="50" cy="70" r="40" fill="none" stroke="L" stroke-width="3" stroke-dasharray="4 7" opacity=".9"/>' +
        '<ellipse cx="50" cy="70" rx="46" ry="16" fill="none" stroke="#fff" stroke-width="1.6" transform="rotate(28 50 70)" opacity=".55"/><circle cx="90" cy="88" r="3.2" fill="#fff" opacity=".85"/>' +
        '<circle cx="50" cy="70" r="20" fill="none" stroke="D" stroke-width="2" opacity=".6"/>' +
        spark(20, 28, 1.3) + spark(82, 112, 1.5) + spark(84, 34, .9) + spark(16, 108, .9) + spark(70, 18, .7),
      // cosmos: a crescent moon, an orbit ring, nebula clouds and stars
      violet: '<circle cx="24" cy="112" r="24" fill="L" opacity=".35"/><circle cx="80" cy="96" r="18" fill="D" opacity=".45"/>' +
        '<path d="M66 18A30 30 0 1 0 90 64 24 24 0 0 1 66 18z" fill="D" opacity=".5" transform="translate(-6 8)"/><path d="M66 18A30 30 0 1 0 90 64 24 24 0 0 1 66 18z" fill="L" transform="translate(-8 4)"/>' +
        '<ellipse cx="50" cy="74" rx="46" ry="14" fill="none" stroke="L" stroke-width="3.5" transform="rotate(-24 50 74)" opacity=".9"/>' +
        '<circle cx="88" cy="56" r="4" fill="L"/><circle cx="22" cy="38" r="8" fill="D" opacity=".7"/><ellipse cx="22" cy="38" rx="13" ry="3.4" fill="none" stroke="L" stroke-width="1.6" transform="rotate(-18 22 38)"/>' +
        '<path d="M12 96Q30 84 50 96T90 92" fill="none" stroke="L" stroke-width="2" stroke-dasharray="2 4" opacity=".8"/>' + spark(18, 30, 1) + spark(84, 120, 1.2) + spark(28, 70, .7) + spark(76, 16, .8) + spark(60, 124, .6)
    };
  })();
  // Targeting-reticle ring drawn around action-card icons.
  var HUD = (function () {
    var t = '';
    for (var i = 0; i < 24; i++) {
      var a = i / 24 * Math.PI * 2, r1 = i % 6 ? 37 : 34;
      t += 'M' + (50 + Math.cos(a) * r1).toFixed(1) + ' ' + (70 + Math.sin(a) * r1).toFixed(1) + 'L' + (50 + Math.cos(a) * 40).toFixed(1) + ' ' + (70 + Math.sin(a) * 40).toFixed(1);
    }
    return '<path d="' + t + '" stroke="#fff" stroke-width="1.2" opacity=".55"/>' +
      '<path d="M50 26A44 44 0 0 1 94 70M50 114A44 44 0 0 1 6 70" fill="none" stroke="#5af0ff" stroke-width="2" opacity=".7"/>' +
      '<path d="M94 70A44 44 0 0 1 50 114" fill="none" stroke="#ff3df0" stroke-width="1.4" stroke-dasharray="3 4" opacity=".7"/>';
  })();
  function scene(suit, light, deep) { return SCENE[suit].replace(/"L"/g, '"' + light + '"').replace(/"D"/g, '"' + deep + '"'); }
  // Corner-to-corner tear for Rift cards, a starburst for wilds, and scattered stars.
  var TEAR = 'M95 5 84 22 90 30 74 44 80 50 66 62 70 70 56 80 60 88 44 98 48 106 30 116 34 124 5 135 5 132 26 118 22 110 40 100 36 92 52 82 48 74 62 64 58 56 72 46 66 38 82 26 76 18 92 5z';
  var BURST = (function () {
    var d = '';
    for (var i = 0; i < 16; i++) {
      var a = i / 16 * Math.PI * 2, b = a + 0.09;
      d += 'M50 70L' + (50 + Math.cos(a) * 80).toFixed(1) + ' ' + (70 + Math.sin(a) * 80).toFixed(1) + 'L' + (50 + Math.cos(b) * 80).toFixed(1) + ' ' + (70 + Math.sin(b) * 80).toFixed(1) + 'z';
    }
    return d;
  })();
  var STARS = '<circle cx="20" cy="24" r="1.4"/><circle cx="80" cy="118" r="1.6"/><circle cx="84" cy="30" r="1"/><circle cx="18" cy="110" r="1.2"/><circle cx="64" cy="16" r="1"/>' +
    '<circle cx="34" cy="96" r=".9"/><circle cx="70" cy="44" r=".8"/><circle cx="58" cy="104" r="1.1"/><circle cx="40" cy="36" r=".8"/>';
  function SPARK(x, y, s) { return '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0-6 1.4-1.4 6 0 1.4 1.4 0 6-1.4 1.4-6 0-1.4-1.4z" fill="#fff"/>'; }
  // Jagged portal rim for Rift cards.
  var PORTAL = (function () {
    var p = [];
    for (var i = 0; i < 28; i++) {
      var a = i / 28 * Math.PI * 2, r = i % 2 ? 0.82 : 1;
      p.push((50 + Math.cos(a) * 31 * r).toFixed(1) + ' ' + (70 + Math.sin(a) * 39 * r).toFixed(1));
    }
    return 'M' + p.join('L') + 'z';
  })();
  function bigText(v, size) {
    var y = 70 + size * 0.36;
    return '<text x="52.5" y="' + (y + 3.5) + '" text-anchor="middle" class="cnum" font-size="' + size + '" fill="' + NAVY + '" stroke="' + NAVY + '" stroke-width="5" stroke-linejoin="round" opacity=".55">' + v + '</text>' +
      '<text x="45" y="' + y + '" text-anchor="middle" class="cnum" font-size="' + size + '" fill="#5af0ff" opacity=".85">' + v + '</text>' +
      '<text x="55.5" y="' + (y + 1.5) + '" text-anchor="middle" class="cnum" font-size="' + size + '" fill="#ff3df0" opacity=".75">' + v + '</text>' +
      '<text x="50" y="' + y + '" text-anchor="middle" class="cnum" font-size="' + size + '" fill="#fff" stroke="' + NAVY + '" stroke-width="5" stroke-linejoin="round" paint-order="stroke">' + v + '</text>';
  }

  /** A card face. card: { kind, color, value }. Drawn on a 100×140 grid. */
  function card(c) {
    var suit = c.color;
    var body = suit ? 'url(#rb-s-' + suit + ')' : 'url(#rb-s-wild)';
    var light = suit ? SUIT_LIGHT[suit] : '#4a55b8', deep = suit ? SUIT_DEEP[suit] : '#0e1238';
    var rift = c.kind === 'rift' || c.kind === 'wildrift';
    var special = rift || !suit;
    var o = '<svg viewBox="0 0 100 140" class="cardart' + (special ? ' special' : '') + '" aria-hidden="true">';
    // Special cards get a foil frame: rainbow for wilds, a glowing rift gradient for Rift cards.
    o += '<rect x=".5" y=".5" width="99" height="139" rx="11" fill="' + (rift ? 'url(#rb-frame-rift)' : !suit ? 'url(#rb-frame-wild)' : '#fff') + '"/>';
    if (special) o += '<rect x="2.5" y="2.5" width="95" height="135" rx="10" fill="none" stroke="#fff" stroke-width="1.2" opacity=".7"/>';
    o += '<rect x="5" y="5" width="90" height="130" rx="8" fill="' + body + '"/>';
    o += '<g clip-path="url(#rb-body)">';
    // Brush streaks and a dark lower sweep give the flat colour an illustrated, painted texture.
    o += '<path d="M20 150 110 60 110 90 50 150z" fill="' + deep + '" opacity=".3"/>';
    if (!suit) {
      // Wild cards: holographic foil — rainbow bands, a white starburst and sparkles over a deep starfield.
      o += '<g transform="rotate(-38 50 70)" opacity=".95"><rect x="-40" y="40" width="180" height="14" fill="' + SUIT_HEX.cyan + '"/><rect x="-40" y="54" width="180" height="14" fill="' + SUIT_HEX.violet + '"/>' +
        '<rect x="-40" y="68" width="180" height="14" fill="' + SUIT_HEX.crimson + '"/><rect x="-40" y="82" width="180" height="14" fill="' + SUIT_HEX.gold + '"/>' +
        '<rect x="-40" y="40" width="180" height="56" fill="none" stroke="' + NAVY + '" stroke-width="2"/><rect x="-40" y="20" width="180" height="4" fill="' + SUIT_HEX.cyan + '" opacity=".5"/><rect x="-40" y="112" width="180" height="4" fill="' + SUIT_HEX.gold + '" opacity=".5"/></g>' +
        '<path d="' + BURST + '" fill="#fff" opacity=".22"/>' +
        '<g fill="#fff">' + STARS + '</g>' + SPARK(18, 108, 1.6) + SPARK(84, 34, 1.3) + SPARK(78, 118, .9);
    }
    if (rift) {
      // Rift cards: the card itself is torn open — a glowing crack runs corner to corner around a swirling vortex,
      // and pieces of the card float off into the void.
      var vc = suit ? SUIT_HEX[suit] : '#ff3df0';
      o += '<path d="' + TEAR + '" fill="#05030f"/><path d="' + TEAR + '" fill="none" stroke="#ff3df0" stroke-width="7" opacity=".35" stroke-linejoin="round"/>' +
        '<path d="' + TEAR + '" fill="none" stroke="#5af0ff" stroke-width="1.8" stroke-linejoin="round"/>' +
        '<g fill="#fff">' + STARS + '</g>' +
        '<path d="' + PORTAL + '" fill="' + vc + '" opacity=".95" stroke="#fff" stroke-width="1.2"/>' +
        '<ellipse cx="50" cy="70" rx="23" ry="30" fill="url(#rb-void)" stroke="' + NAVY + '" stroke-width="2"/>' +
        '<g fill="none" stroke-linecap="round"><path d="M50 70C50 62 60 62 60 70S52 84 42 82 34 64 44 56 66 54 70 68" stroke="' + vc + '" stroke-width="3"/>' +
        '<path d="M50 70C50 66 55 66 55 70S51 77 46 76" stroke="#fff" stroke-width="2"/></g>' +
        '<g stroke="' + NAVY + '" stroke-width="1"><path d="M18 26l9-2-3 8z" fill="' + light + '"/><path d="M82 112l8 2-5 6z" fill="' + light + '"/><path d="M80 30l6 4-6 2z" fill="#fff"/><path d="M14 104l6-3 0 7z" fill="#fff"/></g>';
    } else if (suit) {
      o += '<g opacity="' + (c.kind === 'num' ? 1 : 0.6) + '">' + scene(suit, light, deep) + '</g>';
      if (c.kind !== 'num') o += '<circle cx="50" cy="70" r="31" fill="' + deep + '" opacity=".55"/><circle cx="50" cy="70" r="31" fill="none" stroke="#fff" stroke-width="2.5" opacity=".55"/>' + HUD;
    } else {
      o += '<circle cx="50" cy="70" r="33" fill="#0e1238" opacity=".45"/><circle cx="50" cy="70" r="33" fill="none" stroke="#fff" stroke-width="2" opacity=".4"/>' + HUD;
    }
    // Rift-tech overlay: hex texture, circuit traces and a glitch slice where reality has cracked.
    o += '<rect x="5" y="5" width="90" height="130" fill="url(#rb-hex)" opacity=".1"/>' +
      '<g fill="none" stroke="#fff" stroke-width="1.1" opacity=".45" stroke-linecap="round"><path d="M95 50H86L80 44V30L74 24H62M5 92H14L20 98V112L26 118H38M86 50V58M14 92V84"/></g>' +
      '<g fill="#fff" opacity=".7"><circle cx="62" cy="24" r="1.6"/><circle cx="38" cy="118" r="1.6"/><circle cx="86" cy="58" r="1.2"/><circle cx="14" cy="84" r="1.2"/></g>' +
      '<rect x="5" y="99" width="90" height="2.4" fill="#5af0ff" opacity=".45" transform="translate(-3 0)"/><rect x="5" y="102" width="90" height="1.4" fill="#ff3df0" opacity=".45" transform="translate(4 0)"/>' +
      '<rect x="40" y="96" width="34" height="2" fill="#fff" opacity=".35"/>';
    // Gloss highlight across the top.
    o += '<path d="M5 5H95V34Q50 22 5 50z" fill="#fff" opacity=".13"/>';
    o += '</g>';
    if (special) o += '<rect x="5" y="5" width="90" height="130" rx="8" fill="url(#rb-holo)"/>';
    o += '<rect x="8" y="8" width="84" height="124" rx="6" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1"/>';
    if (c.kind === 'num') {
      var v = String(c.value);
      o += bigText(v, 66);
      if (c.value === 6 || c.value === 9) o += '<rect x="38" y="99" width="24" height="5" rx="2.5" fill="#fff" stroke="' + NAVY + '" stroke-width="2" paint-order="stroke"/>';
      o += cornerText(v);
      o += pip(suit, 15, 38, 0.95) + pip(suit, 85, 102, 0.95, true);
    } else {
      if (!rift) o += '<g transform="translate(50 70) scale(1.05)" style="color:#fff">' +
        '<g style="color:' + NAVY + '" transform="translate(2 2.5)" opacity=".6">' + GLYPH[c.kind] + '</g>' + GLYPH[c.kind] + '</g>';
      if (c.kind === 'wildrift') o += '<g transform="translate(50 70) scale(.5)">' + GLYPH.wild + '</g>';
      if (CORNER[c.kind]) o += cornerText(CORNER[c.kind], true, special);
      else o += '<g transform="translate(16 19) scale(.3)" style="color:#fff">' + GLYPH[c.kind === 'wildrift' ? 'wild' : c.kind] + '</g>' +
        '<g transform="translate(84 121) rotate(180) scale(.3)" style="color:#fff">' + GLYPH[c.kind === 'wildrift' ? 'wild' : c.kind] + '</g>';
      if (special) o += '<text x="50" y="27" text-anchor="middle" class="ctitle" font-size="' + (LABEL[c.kind].length > 5 ? 11 : 15) + '" fill="#fff" stroke="' + NAVY + '" stroke-width="3.4" stroke-linejoin="round" paint-order="stroke">' + (CORNER[c.kind] ? CORNER[c.kind] + ' ' : '') + LABEL[c.kind] + '</text>';
      else o += '<text x="50" y="117" text-anchor="middle" class="clabel" fill="#fff" stroke="' + NAVY + '" stroke-width="2.6" paint-order="stroke">' + LABEL[c.kind] + '</text>';
    }
    o += '</svg>';
    return o;
  }
  function cornerText(v, small, bottomOnly) {
    var cls = 'ccorner' + (small ? ' csm' : '');
    var a = ' text-anchor="middle" fill="#fff" stroke="' + NAVY + '" stroke-width="3" stroke-linejoin="round" paint-order="stroke"';
    return (bottomOnly ? '' : '<text x="' + (small ? 19 : 15) + '" y="' + (small ? 23 : 27) + '" class="' + cls + '"' + a + '>' + v + '</text>') +
      '<text x="' + (small ? 19 : 15) + '" y="' + (small ? 23 : 27) + '" class="' + cls + '"' + a + ' transform="rotate(180 50 70)">' + v + '</text>';
  }

  function back() {
    var arcs = '';
    var cols = [SUIT_HEX.cyan, SUIT_HEX.violet, SUIT_HEX.crimson, SUIT_HEX.gold];
    for (var i = 0; i < 4; i++) {
      var r = 34 - i * 7;
      arcs += '<path d="M' + (50 - r) + ' 66A' + r + ' ' + r + ' 0 0 1 ' + (50 + r * 0.7) + ' ' + (66 - r * 0.7) + '" fill="none" stroke="' + cols[i] + '" stroke-width="5" stroke-linecap="round" transform="rotate(' + (i * 90) + ' 50 66)"/>';
    }
    return '<svg viewBox="0 0 100 140" class="cardart" aria-hidden="true">' +
      '<rect x=".5" y=".5" width="99" height="139" rx="11" fill="#fff"/><rect x="5" y="5" width="90" height="130" rx="8" fill="url(#rb-back)"/>' +
      '<g clip-path="url(#rb-body)"><circle cx="50" cy="66" r="44" fill="#3a2f9a" opacity=".45"/><path d="M5 5H95V34Q50 22 5 50z" fill="#fff" opacity=".1"/>' +
      '<g fill="#fff" opacity=".7"><circle cx="18" cy="22" r="1.3"/><circle cx="84" cy="28" r="1"/><circle cx="20" cy="112" r="1.1"/><circle cx="82" cy="104" r="1.4"/><circle cx="70" cy="18" r=".9"/></g></g>' +
      '<rect x="11" y="11" width="78" height="118" rx="5" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1.5"/>' +
      arcs + '<circle cx="50" cy="66" r="8" fill="' + NAVY + '" stroke="#fff" stroke-width="2"/>' +
      '<path d="M48 54 53 63 47 68 52 78" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<text x="50" y="118" text-anchor="middle" class="cback">RIFTBREAK</text></svg>';
  }

  // ───────────── avatars: eight illustrated characters (head-and-shoulders portraits) ─────────────
  // Drawn on a 60×60 grid centred on 0,0, clipped to a circle and framed by a ring in the seat's hue.
  var OUT = '#141833';
  var S = ' stroke="' + OUT + '" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"';
  function eye(x, y, r, iris) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#fff"' + S + '/>' +
      '<circle cx="' + (x + r * 0.12) + '" cy="' + (y + r * 0.12) + '" r="' + (r * 0.66) + '" fill="' + iris + '"/>' +
      '<circle cx="' + (x + r * 0.12) + '" cy="' + (y + r * 0.12) + '" r="' + (r * 0.34) + '" fill="' + OUT + '"/>' +
      '<circle cx="' + (x - r * 0.22) + '" cy="' + (y - r * 0.28) + '" r="' + (r * 0.3) + '" fill="#fff"/>';
  }
  function catEye(x, y, iris) {
    return '<ellipse cx="' + x + '" cy="' + y + '" rx="4" ry="4.4" fill="' + iris + '"' + S + '/><ellipse cx="' + x + '" cy="' + y + '" rx="1.1" ry="3.4" fill="' + OUT + '"/>' +
      '<circle cx="' + (x - 1.4) + '" cy="' + (y - 1.6) + '" r="1.1" fill="#fff"/>';
  }
  function brow(x, y, tilt) { return '<path d="M' + (x - 3) + ' ' + (y + tilt) + 'L' + (x + 3) + ' ' + (y - tilt) + '" stroke="' + OUT + '" stroke-width="1.8" stroke-linecap="round"/>'; }
  // A soft glow: stacked translucent circles (cheaper and crisper than an SVG blur filter at avatar sizes).
  function glow(x, y, r, col) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 2.4) + '" fill="' + col + '" opacity=".18"/><circle cx="' + x + '" cy="' + y + '" r="' + (r * 1.5) + '" fill="' + col + '" opacity=".35"/>';
  }
  var CHAR = {
    // Cyber pilot: white armored helmet, glowing visor, red fin
    comet: function () {
      return '<path d="M-25 32Q-23 15 0 14 23 15 25 32z" fill="#2a3350"' + S + '/><path d="M-14 16 0 22 14 16 12 24 0 28-12 24z" fill="#46557e"' + S + '/><path d="M-20 26 -9 20M20 26 9 20" stroke="#5af0ff" stroke-width="1.6"/>' +
        '<path d="M-2-18 0-28 3-18z" fill="#f0435a"' + S + '/>' +
        '<path d="M-17 4Q-18-18 0-19 18-18 17 4L13 15Q0 20-13 15z" fill="#dfe5f0"' + S + '/><path d="M6-18Q18-15 17 4L13 15Q8 17 4 18 12 6 6-18z" fill="#a9b3c8"/>' +
        '<circle cx="-17" cy="2" r="3.6" fill="#46557e"' + S + '/><circle cx="17" cy="2" r="3.6" fill="#46557e"' + S + '/><circle cx="17" cy="2" r="1.4" fill="#5af0ff"/><circle cx="-17" cy="2" r="1.4" fill="#5af0ff"/>' +
        '<path d="M-13-5Q0-10 13-5L11 6Q0 9-11 6z" fill="#0d1b3a"' + S + '/>' + glow(0, -1, 3, '#5af0ff') +
        '<path d="M-10-1Q0-5 10-1" fill="none" stroke="#5af0ff" stroke-width="2.6" stroke-linecap="round"/><path d="M-9-4Q-5-6-1-6.5" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>' +
        '<path d="M-6 11H6" stroke="#7f8aa3" stroke-width="1.6" stroke-linecap="round"/>';
    },
    // Crystal mage: deep hood, glowing eyes in shadow, crystal circlet
    prism: function () {
      return '<path d="M-25 32Q-22 14 0 13 22 14 25 32z" fill="#3a1f6e"' + S + '/><path d="M-5 13 0 30 5 13" fill="none" stroke="#ffc93c" stroke-width="2"/>' +
        '<path d="M-20 30Q-23 0-13-16 0-28 13-16 23 0 20 30z" fill="#4b2a8a"' + S + '/><path d="M-13-16Q0-28 13-16 6-20 0-20-6-20-13-16z" fill="#6c45b8"/>' +
        '<path d="M-12 16Q-14-4 0-12 14-4 12 16 0 21-12 16z" fill="#120a2a"' + S + '/>' +
        glow(-5, 3, 1.8, '#c79bff') + glow(5, 3, 1.8, '#c79bff') +
        '<path d="M-8 3Q-5 1-2 3-5 4.5-8 3zM8 3Q5 1 2 3 5 4.5 8 3z" fill="#f2e6ff"/>' +
        '<path d="M-9-7Q0-11 9-7" fill="none" stroke="#ffc93c" stroke-width="1.6"/><path d="M0-14 3.4-8.5 0-3-3.4-8.5z" fill="#5af0ff"' + S + ' stroke-width="1.1"/><path d="M0-14 3.4-8.5 0-8z" fill="#fff" opacity=".6"/>' +
        '<g fill="#c79bff"><path d="M-22-6l2 3-3 1z"/><path d="M21-10l2 3-3 .6z"/><path d="M23 6l1.6 2.4-2.6.6z"/></g>';
    },
    // Battle mech: angular armored head with a single red optic
    orbit: function () {
      return '<path d="M-26 32Q-24 15 0 14 24 15 26 32z" fill="#3b4252"' + S + '/><path d="M-26 32-18 18-10 18-16 32zM26 32 18 18 10 18 16 32z" fill="#ffc93c"' + S + '/><path d="M-22 29-17 21M22 29 17 21" stroke="' + OUT + '" stroke-width="2"/>' +
        '<path d="M14-8 22-14 22-8 16-4" fill="#5c667e"' + S + '/>' +
        '<path d="M-14-15H14L18 0 12 15H-12L-18 0z" fill="#8a95ad"' + S + '/><path d="M-14-15H14L16-8H-16z" fill="#5c667e"' + S + '/><path d="M4-15H14L18 0 12 15H6L10 0z" fill="#6b7590"/>' +
        '<circle cy="-1" r="7" fill="#1a0b12"' + S + '/>' + glow(0, -1, 3.2, '#ff3b4e') + '<circle cy="-1" r="3.6" fill="#ff3b4e"/><circle cx="-1.2" cy="-2.4" r="1.2" fill="#fff"/>' +
        '<path d="M-6 9H6M-5 11.6H5" stroke="' + OUT + '" stroke-width="1.4" stroke-linecap="round"/><circle cx="-12" cy="-11" r="1" fill="' + OUT + '"/><circle cx="12" cy="-11" r="1" fill="' + OUT + '"/>';
    },
    // Inferno knight: horned dark helm with a burning T-visor
    flare: function () {
      return '<path d="M-25 32Q-23 15 0 14 23 15 25 32z" fill="#3a2230"' + S + '/><path d="M-25 32Q-23 15 0 14" fill="none" stroke="#ff7a1a" stroke-width="1.6" opacity=".8"/><path d="M25 32Q23 15 0 14" fill="none" stroke="#ff7a1a" stroke-width="1.6" opacity=".8"/>' +
        '<path d="M-12-12Q-24-14-22-27-17-18-8-16z" fill="#cfc6b2"' + S + '/><path d="M12-12Q24-14 22-27 17-18 8-16z" fill="#cfc6b2"' + S + '/>' +
        '<path d="M-15-2Q-15-17 0-19 15-17 15-2L12 15 0 20-12 15z" fill="#2d2a3a"' + S + '/><path d="M0-19Q15-17 15-2L12 15 0 20z" fill="#3c384e"/>' +
        '<path d="M0-19V-8" stroke="#ff7a1a" stroke-width="1.6"/>' + glow(0, 2, 4, '#ff7a1a') +
        '<path d="M-11-1H11V3H2V13H-2V3H-11z" fill="#ffb03a"' + S + ' stroke-width="1.1"/><path d="M-9 0.4H9" stroke="#fff3c4" stroke-width="1.2"/>' +
        '<g fill="#ff7a1a"><path d="M-21 6l2 4-4-1z"/><path d="M20 2l3 3-4 0z"/></g>';
    },
    // Cyborg: half human, half chrome, with a glowing implant eye
    quark: function () {
      return '<path d="M-25 32Q-23 15 0 14 23 15 25 32z" fill="#1f2a44"' + S + '/><path d="M2 14V32" stroke="#5af0ff" stroke-width="1.6"/><path d="M-12 16-6 24" stroke="#5af0ff" stroke-width="1.2" opacity=".7"/>' +
        '<path d="M-14 0Q-14-15 0-15 14-15 14 0 14 14 0 17-14 14-14 0z" fill="#e9c2a4"' + S + '/>' +
        '<path d="M0-15Q14-15 14 0 14 14 0 17z" fill="#b7c3d6"' + S + '/><path d="M3-8H9V-3M5 6H11M3 11 8 8" fill="none" stroke="#6f7f9c" stroke-width="1.1"/>' +
        '<path d="M-17 4Q-20-14-6-19 8-22 16-12 10-15 2-12-4-14-10-8-12 0-14 6z" fill="#e6ecff"' + S + '/>' +
        '<path d="M-9 0Q-6-2-3 0-6 2-9 0z" fill="#fff"' + S + ' stroke-width="1"/><circle cx="-6" cy="0" r="1.4" fill="#3b2a20"/>' + brow(-6, -4, 0.6) +
        '<circle cx="6" cy="0" r="3.4" fill="#1a1f33"' + S + ' stroke-width="1"/>' + glow(6, 0, 1.8, '#5af0ff') + '<circle cx="6" cy="0" r="1.8" fill="#5af0ff"/>' +
        '<path d="M-4 9.5Q-1 11 2 9.5" fill="none"' + S + ' stroke-width="1.2"/>';
    },
    // Astronaut: big helmet with a reflective gold visor
    nova: function () {
      return '<path d="M-25 32Q-23 15 0 14 23 15 25 32z" fill="#e8ecf5"' + S + '/><rect x="-18" y="20" width="7" height="6" rx="1" fill="#ff7a1a"' + S + ' stroke-width="1"/><rect x="11" y="20" width="7" height="6" rx="1" fill="#22c7f0"' + S + ' stroke-width="1"/>' +
        '<rect x="-6" y="14" width="12" height="5" rx="1.5" fill="#9aa6bf"' + S + '/>' +
        '<circle cy="-1" r="17" fill="#e8ecf5"' + S + '/><path d="M8-15A17 17 0 0 1 14 9 18 18 0 0 0 8-15z" fill="#b8c2d6"/>' +
        '<ellipse cy="0" rx="12" ry="10" fill="#c87a12"' + S + '/><ellipse cy="-1.5" rx="10.5" ry="8" fill="#ffb93a"/>' +
        '<path d="M-8-4Q-6-8-1-8.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/><path d="M5 5Q8 3 9 0" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>' +
        '<g fill="#fff"><circle cx="3" cy="-4" r=".8"/><circle cx="-4" cy="3" r=".6"/><circle cx="7" cy="-1" r=".5"/></g>' +
        '<circle cx="-15" cy="-6" r="2" fill="#f0435a"' + S + ' stroke-width="1"/>';
    },
    // Void oracle: a hood holding a starfield instead of a face
    vortex: function () {
      return '<path d="M-25 32Q-22 14 0 13 22 14 25 32z" fill="#102a3a"' + S + '/><path d="M-10 18Q0 26 10 18" fill="none" stroke="#2fd6b4" stroke-width="1.6"/>' +
        '<path d="M-20 30Q-22-2-12-17 0-27 12-17 22-2 20 30z" fill="#16384a"' + S + '/><path d="M-12-17Q0-27 12-17 4-21-4-21z" fill="#24546a"/>' +
        '<path d="M-12 16Q-14-4 0-13 14-4 12 16 0 21-12 16z" fill="#070b1e"' + S + '/>' +
        '<path d="M0 4C0-1 6-1 6 4S0 11-5 9-9 0-3-4 10-4 9 4" fill="none" stroke="#6a52d8" stroke-width="1.4" opacity=".8"/>' +
        '<g fill="#fff"><circle cx="-7" cy="10" r=".7"/><circle cx="6" cy="12" r=".6"/><circle cx="-2" cy="-7" r=".6"/><circle cx="8" cy="-4" r=".5"/></g>' +
        glow(-4.5, 1, 1.6, '#7ff7e0') + glow(4.5, 1, 1.6, '#7ff7e0') + '<circle cx="-4.5" cy="1" r="1.6" fill="#e9fffb"/><circle cx="4.5" cy="1" r="1.6" fill="#e9fffb"/>' +
        '<path d="M-10-9Q0-14 10-9" fill="none" stroke="#2fd6b4" stroke-width="1.6"/><circle cy="-12" r="2" fill="#2fd6b4"' + S + ' stroke-width="1"/>';
    },
    // Cyber assassin: hooded mask with a magenta LED visor
    glyph: function () {
      return '<path d="M-25 32Q-23 15 0 14 23 15 25 32z" fill="#1b1f3a"' + S + '/><path d="M-8 14 0 22 8 14" fill="none" stroke="#ff3df0" stroke-width="1.4" opacity=".8"/>' +
        '<path d="M-20 28Q-22-4-11-17 0-26 11-17 22-4 20 28z" fill="#232848"' + S + '/>' +
        '<path d="M-13 2Q-13-13 0-14 13-13 13 2 12 14 0 17-12 14-13 2z" fill="#2f3658"' + S + '/><path d="M0-14Q13-13 13 2 12 14 0 17z" fill="#272d4c"/>' +
        '<path d="M-12-3H12L11 3H-11z" fill="#0a0c1c"' + S + ' stroke-width="1.1"/>' + glow(0, 0, 3, '#ff3df0') +
        '<path d="M-10 0H-2M2 0H10" stroke="#ff3df0" stroke-width="2.4" stroke-linecap="round"/><path d="M-9-.6H-5" stroke="#fff" stroke-width="1" stroke-linecap="round"/>' +
        '<path d="M-5 8H5M-4 10.5H4M-3 13H3" stroke="#555f8a" stroke-width="1.3" stroke-linecap="round"/>';
    }
  };
  function avatar(id, hue) {
    var ring = 'hsl(' + hue + ' 85% 60%)', bg1 = 'hsl(' + hue + ' 55% 42%)', bg2 = 'hsl(' + hue + ' 50% 22%)';
    var draw = CHAR[id] || CHAR.flare;
    return '<svg viewBox="-30 -30 60 60" class="avatarart" aria-hidden="true">' +
      '<circle r="29.5" fill="' + OUT + '"/><circle r="27" fill="' + bg2 + '"/><circle cy="-8" r="22" fill="' + bg1 + '" opacity=".75"/>' +
      '<g clip-path="url(#rb-avclip)">' + draw() + '</g>' +
      '<circle r="27.2" fill="none" stroke="' + ring + '" stroke-width="2.6"/><path d="M-20-17A26 26 0 0 1 8-25" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".45"/></svg>';
  }

  // ───────────── the table: a floating rock island (1000×640; top surface centred at 500,240, rx 490, ry 230) ─────────────
  function island() {
    var o = '<svg viewBox="0 0 1000 640" class="islandart" aria-hidden="true"><defs>' +
      '<radialGradient id="rb-top" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#4554b8"/><stop offset=".75" stop-color="#34409a"/><stop offset="1" stop-color="#2a347f"/></radialGradient>' +
      '<linearGradient id="rb-cliff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f2a78"/><stop offset="1" stop-color="#17143f"/></linearGradient>' +
      '<radialGradient id="rb-glowc"><stop offset="0" stop-color="#5ad8f7" stop-opacity=".55"/><stop offset="1" stop-color="#5ad8f7" stop-opacity="0"/></radialGradient></defs>';
    // soft shadow/glow beneath the island
    o += '<ellipse cx="500" cy="560" rx="300" ry="50" fill="url(#rb-glowc)" opacity=".5"/>';
    // rocky underside
    o += '<path d="M10 250Q24 320 80 352L130 410 196 424 246 488 326 508 372 572 446 584 500 636 556 586 628 574 674 508 752 490 806 426 866 412 918 352Q976 320 990 250z" fill="url(#rb-cliff)" stroke="#10143a" stroke-width="5" stroke-linejoin="round"/>';
    // facets on the underside
    o += '<path d="M80 352 196 424 246 488 210 360zM326 508 446 584 500 636 470 470zM674 508 752 490 806 426 700 380zM866 412 918 352 840 300z" fill="#000" opacity=".22"/>' +
      '<path d="M130 410 210 360 120 300zM372 572 470 470 330 420zM628 574 556 586 600 450zM806 426 866 412 820 330z" fill="#fff" opacity=".06"/>';
    // crystals growing from the underside
    o += '<g stroke="#10143a" stroke-width="3" stroke-linejoin="round"><path d="M300 470 316 540 330 470 316 448z" fill="#5ad8f7"/><path d="M684 470 700 548 716 470 700 446z" fill="#b88aff"/>' +
      '<path d="M480 560 494 618 508 560 494 540z" fill="#b88aff"/><path d="M160 380 170 420 182 380 170 366z" fill="#5ad8f7"/><path d="M830 380 842 424 854 380 842 364z" fill="#5ad8f7"/></g>' +
      '<path d="M316 448 330 470 316 480zM700 446 716 470 700 482z" fill="#fff" opacity=".5"/>';
    // cliff edge band and top surface
    o += '<ellipse cx="500" cy="258" rx="490" ry="232" fill="#3a3a92" stroke="#10143a" stroke-width="5"/>' +
      '<path d="M10 258Q30 330 140 380" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="6"/>' +
      '<ellipse cx="500" cy="240" rx="490" ry="230" fill="url(#rb-top)" stroke="#10143a" stroke-width="5"/>' +
      '<ellipse cx="500" cy="240" rx="470" ry="212" fill="none" stroke="#5a6ad0" stroke-opacity=".45" stroke-width="3"/>' +
      '<ellipse cx="500" cy="244" rx="360" ry="150" fill="none" stroke="#6a7ae0" stroke-opacity=".22" stroke-width="3" stroke-dasharray="10 18"/>';
    // stone tiles and pebbles on the surface
    o += '<g fill="#fff" opacity=".05"><path d="M160 180 230 150 280 190 210 220z"/><path d="M720 150 800 170 790 220 720 210z"/><path d="M260 330 340 320 350 370 270 380z"/><path d="M660 330 740 320 760 360 680 380z"/></g>' +
      '<g fill="#2a347f" stroke="#10143a" stroke-width="3"><ellipse cx="110" cy="200" rx="22" ry="12"/><ellipse cx="890" cy="290" rx="26" ry="13"/><ellipse cx="150" cy="330" rx="16" ry="9"/><ellipse cx="860" cy="170" rx="14" ry="8"/></g>';
    // glowing fractures and circuit traces: reality is breaking apart under the table
    o += '<g fill="none" stroke-linejoin="round" stroke-linecap="round">' +
      '<path d="M40 210 120 230 150 200 230 214M960 300 880 284 850 312 770 300M500 470 520 420 490 400 512 360M300 90 340 120 330 150" stroke="#ff3df0" stroke-width="10" opacity=".14"/>' +
      '<path d="M40 210 120 230 150 200 230 214M960 300 880 284 850 312 770 300M500 470 520 420 490 400 512 360M300 90 340 120 330 150" stroke="#ff7af5" stroke-width="2.6"/>' +
      '<path d="M160 120H230L250 100H330M700 400H780L800 380H860M640 70H720L736 90M180 360H250L268 380" stroke="#5af0ff" stroke-width="2.2" opacity=".55"/></g>' +
      '<g fill="#5af0ff" opacity=".8"><circle cx="330" cy="100" r="4"/><circle cx="860" cy="380" r="4"/><circle cx="736" cy="90" r="3.5"/><circle cx="268" cy="380" r="3.5"/></g>';
    // a chunk of the rim breaking away
    o += '<g transform="translate(948 380) rotate(14)"><path d="M-30-14 6-24 30-6 18 22-14 24-34 6z" fill="#3a3a92" stroke="#10143a" stroke-width="5" stroke-linejoin="round"/><path d="M-30-14 6-24 30-6 0-2z" fill="#4554b8"/><path d="M-30-14 6-24 30-6" fill="none" stroke="#ff7af5" stroke-width="2.4"/></g>' +
      '<g transform="translate(70 400) rotate(-20)"><path d="M-18-8 4-14 18-4 10 14-10 14-20 4z" fill="#3a3a92" stroke="#10143a" stroke-width="4" stroke-linejoin="round"/><path d="M-18-8 4-14 18-4" fill="none" stroke="#5af0ff" stroke-width="2"/></g>';
    // grass tufts on the rim
    var tuft = function (x, y, s) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" fill="#2fa58c" stroke="#10143a" stroke-width="2.5" stroke-linejoin="round"><path d="M-18 0Q-16-22-6-30-8-14-2 0zM-4 0Q0-30 10-36 6-16 8 0zM6 0Q16-20 26-22 16-10 18 0z"/></g>'; };
    o += tuft(70, 300, 1.1) + tuft(930, 240, 1) + tuft(250, 452, .9) + tuft(760, 450, 1) + tuft(200, 70, .8) + tuft(820, 64, .8);
    return o + '</svg>';
  }
  ISLAND_GEOM = { w: 1000, h: 640, cx: 500, cy: 240, rx: 490, ry: 230 };

  // ───────────── Reality Rule and Collapse icons (48×48) ─────────────
  var RULE_ICON = {
    stable: '<path d="M8 24h32" stroke-width="4"/><path d="M14 16h20M14 32h20" stroke-width="2.5" opacity=".5"/>',
    odd: '<text x="24" y="33" text-anchor="middle" font-size="25" font-weight="800" stroke="none" fill="currentColor" font-family="Unbounded, system-ui">1·3</text>',
    lock: '<rect x="12" y="21" width="24" height="18" rx="3" stroke-width="3.5"/><path d="M17 21v-5a7 7 0 0 1 14 0v5" stroke-width="3.5"/><circle cx="24" cy="30" r="2.6" fill="currentColor" stroke="none"/>',
    echo: '<circle cx="24" cy="24" r="4" fill="currentColor" stroke="none"/><path d="M15 15a13 13 0 0 0 0 18M33 15a13 13 0 0 1 0 18" stroke-width="3.2"/><path d="M9 9a21 21 0 0 0 0 30M39 9a21 21 0 0 1 0 30" stroke-width="2.4" opacity=".55"/>',
    shock: '<path d="M6 28l8-10 6 12 8-18 6 14 8-8" stroke-width="3.5" stroke-linejoin="round"/>',
    gravity: '<path d="M24 8v24M15 23l9 10 9-10" stroke-width="3.5" stroke-linejoin="round"/><ellipse cx="24" cy="38" rx="15" ry="4" stroke-width="2.4" opacity=".6"/>',
    potato: '<path d="M24 7c4 8 12 11 12 21a12 12 0 0 1-24 0c0-6 4-8 5-13 3 3 3 6 3 6s5-6 4-14z" stroke-width="3.2" stroke-linejoin="round"/>',
    mirror: '<path d="M24 6v36" stroke-width="2.4" stroke-dasharray="3 3"/><path d="M20 12 8 34h12zM28 12l12 22H28z" stroke-width="3" stroke-linejoin="round"/>',
    spot: '<path d="M18 6h12l-2 8h-8z" stroke-width="3" stroke-linejoin="round"/><path d="M20 14 8 40h32L28 14" stroke-width="2.4" opacity=".6"/><ellipse cx="24" cy="40" rx="16" ry="3" fill="currentColor" stroke="none" opacity=".5"/>',
    fire: '<circle cx="24" cy="24" r="14" stroke-width="3"/><path d="M24 4v10M24 34v10M4 24h10M34 24h10" stroke-width="3.2"/><circle cx="24" cy="24" r="3" fill="currentColor" stroke="none"/>',
    shockwave: '<circle cx="24" cy="24" r="5" fill="currentColor" stroke="none"/><circle cx="24" cy="24" r="12" stroke-width="3"/><circle cx="24" cy="24" r="19" stroke-width="2" opacity=".55"/>',
    gravity_well: '<path d="M24 24c0-4 6-4 6 0s-4 9-10 8-9-10-3-15 17-4 17 6-8 16-18 15" stroke-width="3" stroke-linecap="round"/>',
    fracture: '<path d="M20 4 28 16 20 22 30 32 22 38 26 44" stroke-width="3.4" stroke-linejoin="round"/><path d="M8 16l6 2-4 4zM40 28l-6 1 3-5z" fill="currentColor" stroke="none"/>',
    chain: '<rect x="5" y="17" width="20" height="13" rx="6.5" stroke-width="3.2" transform="rotate(-20 15 24)"/><rect x="23" y="17" width="20" height="13" rx="6.5" stroke-width="3.2" transform="rotate(-20 33 24)"/>'
  };
  function ruleGlyph(id) {
    return '<svg viewBox="0 0 48 48" class="ruleglyph" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true">' + (RULE_ICON[id] || RULE_ICON.stable) + '</svg>';
  }

  global.RiftArt = { island: island, ISLAND: function () { return ISLAND_GEOM; }, defs: defs, card: card, back: back, glyph: glyph, avatar: avatar, ruleGlyph: ruleGlyph, SUIT_HEX: SUIT_HEX, PIP: PIP, SEAT_HUES: SEAT_HUES, esc: esc, LABEL: LABEL };
})(window);
