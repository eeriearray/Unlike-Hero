/*
 * Dragon Clash — the icon set. Small line-drawn glyphs (24 x 24, round strokes) used everywhere a symbol is needed:
 * elements, menus, instincts, gear, rules. The same path data draws inline SVG for menus and Path2D on the canvas,
 * so the HUD and the menus match.
 *
 *   DCIcons.svg(name, color, size)              → '<svg …>' string for HTML
 *   DCIcons.draw(ctx, name, x, y, size, color)  → draws centred at (x, y) on a canvas
 */
(function () {
  'use strict';
  var P = {
    fire: 'M12 3c1 3.5-3.5 5-3.5 9a3.5 3.5 0 0 0 7 0c0-1.2-.6-2.3-1.2-3.2C16.6 10 18 12.3 18 15a6 6 0 0 1-12 0c0-5.5 5-7.5 6-12z',
    ice: 'M12 2v20M3.3 7l17.4 10M20.7 7L3.3 17M12 2l-2.2 2.2M12 2l2.2 2.2M12 22l-2.2-2.2M12 22l2.2-2.2',
    lightning: 'M13 2L5 13h6l-1 9 8-11h-6l1-9z',
    earth: 'M2 20l7-12 4 6 3-4 6 10zM7.5 10.5l1.5 1.5 1.5-1.5',
    water: 'M12 3c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11zM9 15a3 3 0 0 0 3 3',
    versus: 'M4 4l10 10M4 4h4M4 4v4M20 4L10 14M20 4h-4M20 4v4M6.5 14.5l-3 3 3 3 3-3M17.5 14.5l3 3-3 3-3-3',
    online: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3 12h18M12 3c3.5 3 3.5 15 0 18M12 3c-3.5 3-3.5 15 0 18',
    cup: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5c0 3 1.5 4.5 3.5 4.5M16 6h3.5c0 3-1.5 4.5-3.5 4.5M12 13v4M8 21h8M9.5 17h5',
    training: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9zM12 11.2a.8.8 0 1 0 0 1.6a.8.8 0 1 0 0-1.6z',
    tutorial: 'M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M6 4a2 2 0 0 0-2 2v2h3M9 9h7M9 13h7M9 17h4',
    forge: 'M3 9h11l3-3h4v4h-4l-2 2v3H8l-3 3M8 15h7M6.5 20h10',
    crown: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z',
    fury: 'M6 3c2.5 6 2.5 12 0 18M12 3c2.5 6 2.5 12 0 18M18 3c2.5 6 2.5 12 0 18',
    bastion: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z',
    tempest: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8',
    vengeance: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11zM12.5 6.5l-2 4.5 3 1.5-2 4',
    size: 'M4 14v6h6M20 10V4h-6M4 20l7-7M20 4l-7 7',
    none: 'M7 12h10',
    fade: 'M6 20V10a6 6 0 0 1 12 0v10l-2-2-2 2-2-2-2 2-2-2zM10 10.5v.5M14 10.5v.5',
    aegis: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9zM12 8v8M8.5 10l3.5 2 3.5-2',
    phase: 'M3 12h12M11 6l6 6-6 6M20 5v14',
    decoy: 'M8 5.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM4.5 20v-4a3.5 3.5 0 0 1 7 0v4M16 5.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM12.5 20v-4a3.5 3.5 0 0 1 7 0v4',
    rage: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
    gust: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8',
    spark: 'M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19',
    grab: 'M7 11V5.5a1.5 1.5 0 0 1 3 0V10M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 11V8.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-14 0v-2.5',
    chain: 'M9 15l6-6M7.5 12.5l-2 2a3 3 0 0 0 4 4l2-2M16.5 11.5l2-2a3 3 0 0 0-4-4l-2 2',
    knockdown: 'M3 19h18M5 15c2.5-3 7-4 13-2M17 9a2 2 0 1 0 0-.1',
    wall: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v5M15 10v5M9 15v4',
    clash: 'M12 2l1.8 6.2L20 6l-3.6 5.4L22 14l-6.4.6L16 21l-4-4.6L8 21l.4-6.4L2 14l5.6-2.6L4 6l6.2 2.2z',
    burst: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 8v4l3 2',
    check: 'M5 12.5l4.5 4.5L19 7',
  };
  var paths = {};

  // Painted icons from the customization pack (assets/gear/icon-ability-*.png) replace the line glyphs when present
  var GEAR = (window.DC_GEAR && window.DC_GEAR.files) || {}, IMG = {}, imgs = {};
  ['fade', 'aegis', 'phase', 'decoy', 'rage', 'gust'].forEach(function (n) { if (GEAR['icon-ability-' + n]) IMG[n] = 'assets/gear/' + GEAR['icon-ability-' + n]; });
  function image(name) {
    if (!IMG[name]) return null;
    var im = imgs[name];
    if (!im) { im = imgs[name] = new Image(); im.src = IMG[name]; }
    return im.complete && im.naturalWidth ? im : null;
  }

  function svg(name, color, size) {
    var s0 = size || 18;
    if (IMG[name]) return '<img class="ico-svg ico-img" src="' + IMG[name] + '" width="' + Math.round(s0 * 1.25) + '" height="' + Math.round(s0 * 1.25) + '" alt="" aria-hidden="true" style="vertical-align:middle;object-fit:contain">';
    var d = P[name] || P.none, s = size || 18;
    return '<svg class="ico-svg" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-hidden="true" style="color:' + (color || 'currentColor') + '">' +
      '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function draw(ctx, name, x, y, size, color, width) {
    var im = image(name);
    if (im) {
      // A translucent colour (e.g. an ability still on cooldown) dims the painted icon the same way
      var z = size * 1.35, m = /rgba\([^)]*,\s*([\d.]+)\)/.exec(color || '');
      ctx.save(); if (m) ctx.globalAlpha *= +m[1];
      ctx.drawImage(im, x - z / 2, y - z / 2, z, z); ctx.restore(); return;
    }
    if (typeof Path2D === 'undefined') return;
    var p = paths[name] || (paths[name] = new Path2D(P[name] || P.none)), k = size / 24;
    ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(k, k);
    ctx.strokeStyle = color || '#fff'; ctx.lineWidth = (width || 2.2); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke(p); ctx.restore();
  }

  window.DCIcons = { svg: svg, draw: draw, has: function (n) { return !!P[n] || !!IMG[n]; } };
})();
