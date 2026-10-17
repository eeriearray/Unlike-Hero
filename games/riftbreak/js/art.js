/* RIFTBREAK — original vector artwork, generated as SVG strings.
   window.RiftArt: defs() (shared gradients/filters, inserted once), card(card), back(), glyph(name), avatar(id, hue),
                   ruleGlyph(ruleId), collapseGlyph(id), SUIT_HEX.
   Every card is drawn on a 100×140 grid so one set of artwork scales from phones to big screens. */
(function (global) {
  'use strict';
  var SUIT_HEX = { cyan: '#2fe6ff', crimson: '#ff3d6e', gold: '#ffc23d', violet: '#a46bff' };
  var SUIT_DEEP = { cyan: '#0a6f8f', crimson: '#8f1238', gold: '#94600a', violet: '#4b2596' };
  var SEAT_HUES = [188, 340, 42, 266, 150, 18, 220, 300];

  function defs() {
    var g = '';
    Object.keys(SUIT_HEX).forEach(function (s) {
      g += '<linearGradient id="rb-band-' + s + '" x1="0" y1="1" x2="1" y2="0">' +
        '<stop offset="0" stop-color="' + SUIT_DEEP[s] + '"/><stop offset=".55" stop-color="' + SUIT_HEX[s] + '"/><stop offset="1" stop-color="#ffffff" stop-opacity=".85"/></linearGradient>' +
        '<radialGradient id="rb-core-' + s + '" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="' + SUIT_HEX[s] + '" stop-opacity=".55"/><stop offset=".7" stop-color="' + SUIT_DEEP[s] + '" stop-opacity=".25"/><stop offset="1" stop-color="#060a1f" stop-opacity="0"/></radialGradient>';
    });
    g += '<linearGradient id="rb-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141b44"/><stop offset="1" stop-color="#070a1e"/></linearGradient>' +
      '<linearGradient id="rb-wildband" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="' + SUIT_HEX.cyan + '"/><stop offset=".33" stop-color="' + SUIT_HEX.violet + '"/><stop offset=".66" stop-color="' + SUIT_HEX.crimson + '"/><stop offset="1" stop-color="' + SUIT_HEX.gold + '"/></linearGradient>' +
      '<linearGradient id="rb-back" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1f5c"/><stop offset=".5" stop-color="#0c0f33"/><stop offset="1" stop-color="#1a0f3f"/></linearGradient>' +
      '<radialGradient id="rb-backglow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#7d5cff" stop-opacity=".55"/><stop offset="1" stop-color="#7d5cff" stop-opacity="0"/></radialGradient>' +
      '<filter id="rb-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="rb-softglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>' +
      '<pattern id="rb-grid" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="#ffffff" stroke-opacity=".05" stroke-width=".6"/></pattern>';
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

  /** A card face. card: { kind, color, value }. */
  function card(c) {
    var suit = c.color;
    var hex = suit ? SUIT_HEX[suit] : '#ffffff';
    var band = suit ? 'url(#rb-band-' + suit + ')' : 'url(#rb-wildband)';
    var core = suit ? 'url(#rb-core-' + suit + ')' : 'url(#rb-core-violet)';
    var o = '<svg viewBox="0 0 100 140" class="cardart" aria-hidden="true">';
    o += '<rect x="1" y="1" width="98" height="138" rx="10" fill="url(#rb-face)"/>';
    o += '<rect x="1" y="1" width="98" height="138" rx="10" fill="url(#rb-grid)"/>';
    if (c.kind === 'rift' || c.kind === 'wildrift') {
      // Rift cards are visibly split: the band is sheared along a fracture line.
      o += '<path d="M-10 132 44 20 58 20 4 132z" fill="' + band + '" opacity=".95"/>' +
        '<path d="M58 30 112 -18 118 -6 64 42z" fill="' + band + '" opacity=".8"/>' +
        '<path d="M36 140 L60 74 L48 70 L66 0" fill="none" stroke="#fff" stroke-width="1.6" opacity=".9" filter="url(#rb-glow)"/>' +
        '<path d="M50 78 l-14 6 4 -9zM62 52 l12 -2 -6 8z" fill="#fff" opacity=".7"/>';
    } else if (c.kind === 'stabilize') {
      // Stabilize: solid, level horizontal bars.
      o += '<rect x="1" y="48" width="98" height="10" fill="' + band + '" opacity=".9"/><rect x="1" y="82" width="98" height="10" fill="' + band + '" opacity=".9"/>';
    } else if (c.kind === 'surge' || c.kind === 'overload') {
      // Attacks: aggressive double slash.
      o += '<path d="M-6 120 70 -6 92 -6 16 120z" fill="' + band + '" opacity=".95"/><path d="M20 146 96 20 108 20 32 146z" fill="' + band + '" opacity=".65"/>';
    } else {
      o += '<path d="M-6 126 74 -6 96 -6 16 126z" fill="' + band + '" opacity=".92"/>';
    }
    o += '<circle cx="50" cy="70" r="31" fill="#070a1e" opacity=".88"/><circle cx="50" cy="70" r="31" fill="' + core + '"/>';
    o += '<circle cx="50" cy="70" r="31" fill="none" stroke="' + hex + '" stroke-width="2.4" filter="url(#rb-glow)"/>';
    if (c.kind === 'num') {
      var v = String(c.value);
      o += '<text x="50" y="86" text-anchor="middle" class="cnum" fill="#fff" stroke="#070a1e" stroke-width="2.5" paint-order="stroke">' + v + '</text>';
      if (c.value === 6 || c.value === 9) o += '<rect x="40" y="91" width="20" height="3" rx="1.5" fill="#fff"/>';
      o += corner(v, hex);
    } else {
      var col = suit ? hex : '#ffffff';
      o += '<g transform="translate(50 70) scale(.92)" style="color:' + col + '" filter="url(#rb-glow)">' + GLYPH[c.kind] + '</g>';
      if (CORNER[c.kind]) o += '<text x="50" y="118" text-anchor="middle" class="cplus" fill="#fff">' + CORNER[c.kind] + '</text>';
      o += cornerGlyph(c.kind, col, CORNER[c.kind]);
      o += '<text x="50" y="132" text-anchor="middle" class="clabel" fill="' + col + '">' + LABEL[c.kind] + '</text>';
    }
    o += '<rect x="2.5" y="2.5" width="95" height="135" rx="9" fill="none" stroke="' + hex + '" stroke-opacity=".75" stroke-width="1.6"/>';
    o += '</svg>';
    return o;
  }
  function corner(v, hex) {
    return '<text x="11" y="21" class="ccorner" fill="' + hex + '">' + v + '</text>' +
      '<text x="89" y="119" class="ccorner" fill="' + hex + '" transform="rotate(180 89 119) translate(0 -14)">' + v + '</text>';
  }
  function cornerGlyph(kind, hex, txt) {
    if (txt) return '<text x="9" y="20" class="ccorner csm" fill="' + hex + '">' + txt + '</text>' +
      '<text x="91" y="120" class="ccorner csm" fill="' + hex + '" text-anchor="end" transform="rotate(180 91 120) translate(0 -13)">' + txt + '</text>';
    return '<g transform="translate(15 17) scale(.3)" style="color:' + hex + '">' + GLYPH[kind] + '</g>' +
      '<g transform="translate(85 123) rotate(180) scale(.3)" style="color:' + hex + '">' + GLYPH[kind] + '</g>';
  }

  function back() {
    return '<svg viewBox="0 0 100 140" class="cardart" aria-hidden="true">' +
      '<rect x="1" y="1" width="98" height="138" rx="10" fill="url(#rb-back)"/><rect x="1" y="1" width="98" height="138" rx="10" fill="url(#rb-grid)"/>' +
      '<circle cx="50" cy="70" r="40" fill="url(#rb-backglow)"/>' +
      '<g fill="none" stroke-linecap="round"><path d="M50 40a30 30 0 0 1 26 15" stroke="' + SUIT_HEX.cyan + '" stroke-width="4"/><path d="M78 62a30 30 0 0 1 -12 32" stroke="' + SUIT_HEX.gold + '" stroke-width="4"/>' +
      '<path d="M58 99a30 30 0 0 1 -32 -10" stroke="' + SUIT_HEX.crimson + '" stroke-width="4"/><path d="M21 80a30 30 0 0 1 21 -39" stroke="' + SUIT_HEX.violet + '" stroke-width="4"/></g>' +
      '<path d="M46 50 55 66 47 72 56 90" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round" filter="url(#rb-glow)"/>' +
      '<rect x="6" y="6" width="88" height="128" rx="7" fill="none" stroke="#8d7dff" stroke-opacity=".45" stroke-width="1.2"/>' +
      '<text x="50" y="124" text-anchor="middle" class="cback">RIFTBREAK</text></svg>';
  }

  // ───────────── avatars: eight geometric sigils ─────────────
  var SIGIL = {
    comet: '<circle cx="8" cy="-6" r="9" fill="currentColor"/><path d="M1 0-18 14M4 5-12 20M-2-4-20 4" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" opacity=".7"/>',
    prism: '<path d="M0-18 17 12H-17z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M-26 2H-8M8 2H26" stroke="currentColor" stroke-width="3" opacity=".6"/>',
    orbit: '<circle r="6" fill="currentColor"/><ellipse rx="19" ry="8" fill="none" stroke="currentColor" stroke-width="3" transform="rotate(-25)"/><circle cx="16" cy="-9" r="3" fill="currentColor"/>',
    flare: '<path d="M0-20 5-5 20 0 5 5 0 20-5 5-20 0-5-5z" fill="currentColor"/>',
    quark: '<circle cx="-7" cy="-5" r="7" fill="currentColor"/><circle cx="8" cy="-3" r="5" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="0" cy="10" r="5.5" fill="currentColor" opacity=".75"/>',
    nova: '<circle r="9" fill="none" stroke="currentColor" stroke-width="4"/><path d="M0-21V-14M0 14V21M-21 0H-14M14 0H21M-15-15l5 5M10 10l5 5M-15 15l5-5M10-10l5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    vortex: '<path d="M0 0c0-6 9-6 9 0s-6 13-14 11-12-14-4-21 22-6 22 6" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>',
    glyph: '<path d="M-14-14H14L-14 14H14" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle r="4" fill="currentColor"/>'
  };
  function avatar(id, hue) {
    var c = 'hsl(' + hue + ' 95% 66%)';
    return '<svg viewBox="-30 -30 60 60" class="avatarart" aria-hidden="true">' +
      '<circle r="28" fill="hsl(' + hue + ' 60% 14%)"/><circle r="28" fill="none" stroke="' + c + '" stroke-width="2.4"/>' +
      '<g style="color:' + c + '">' + (SIGIL[id] || SIGIL.flare) + '</g></svg>';
  }

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

  global.RiftArt = { defs: defs, card: card, back: back, glyph: glyph, avatar: avatar, ruleGlyph: ruleGlyph, SUIT_HEX: SUIT_HEX, SEAT_HUES: SEAT_HUES, esc: esc, LABEL: LABEL };
})(window);
