/* Putt Club — original SVG icon set (power-ups, player symbols, UI). Each icon is drawn on a 24×24 grid. */
(function (global) {
  'use strict';
  var PC = global.PC;

  // Power-up glyphs: bold, two-tone friendly (fill = currentColor, details in 'accent' class).
  var POWER = {
    turbo: '<path d="M14.5 2.5c3.3 1.4 6 4.6 6.5 8.2l-5.4 5.4-6.7-6.7 5.6-6.9z" fill="currentColor"/><path d="M8.6 9.7l5.7 5.7-2.6 2.6-5.7-5.7z" fill="currentColor" opacity=".75"/><path d="M5.6 15.3c-1.8.5-2.9 2.2-3.1 6.2 4-.2 5.7-1.3 6.2-3.1z" class="accent"/><circle cx="16.4" cy="7.6" r="1.6" class="hole"/>',
    sticky: '<path d="M12 2.8c3.5 4.6 6.3 8 6.3 11.4a6.3 6.3 0 0 1-12.6 0C5.7 10.8 8.5 7.4 12 2.8z" fill="currentColor"/><path d="M9 14.5a3 3 0 0 0 3 3" class="hole-stroke"/>',
    ghost: '<path d="M12 2.8a7 7 0 0 1 7 7v10.4l-2.3-1.6-2.4 1.6-2.3-1.6-2.3 1.6-2.4-1.6L5 20.2V9.8a7 7 0 0 1 7-7z" fill="currentColor"/><circle cx="9.4" cy="10.2" r="1.4" class="hole"/><circle cx="14.6" cy="10.2" r="1.4" class="hole"/>',
    giant: '<circle cx="12" cy="12" r="5.6" fill="currentColor"/><path d="M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4" class="stroke"/>',
    tiny: '<circle cx="12" cy="12" r="2.6" fill="currentColor"/><path d="M3.5 3.5l4.5 4.5M20.5 3.5L16 8M20.5 20.5L16 16M3.5 20.5L8 16M5 8h3V5M19 8h-3V5M19 16h-3v3M5 16h3v3" class="stroke"/>',
    reverse: '<path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" class="stroke"/>',
    freeze: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 3.8l3 2.4 3-2.4M9 20.2l3-2.4 3 2.4M3.7 10.4l3.6-1.3-.6-3.8M20.3 13.6l-3.6 1.3.6 3.8M3.7 13.6l3.6 1.3-.6 3.8M20.3 10.4l-3.6-1.3.6-3.8" class="stroke thin"/>',
    gust: '<path d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7" class="stroke"/>',
    swap: '<path d="M17 3l3.5 3.5L17 10M20.5 6.5H8a4.5 4.5 0 0 0-4.5 4.5M7 21l-3.5-3.5L7 14M3.5 17.5H16a4.5 4.5 0 0 0 4.5-4.5" class="stroke"/>',
    shield: '<circle cx="12" cy="12" r="9" fill="currentColor" opacity=".35"/><circle cx="12" cy="12" r="9" class="stroke thin"/><path d="M7.5 9.5a5 5 0 0 1 4-3.3" class="stroke"/>',
    magnet: '<path d="M5 3h4.5v8.5a2.5 2.5 0 0 0 5 0V3H19v8.5a7 7 0 0 1-14 0z" fill="currentColor"/><path d="M5 3h4.5v3H5zM14.5 3H19v3h-4.5z" class="accent"/>',
    confetti: '<path d="M3 21l4.8-12.6 7.8 7.8z" fill="currentColor"/><path d="M13.5 3.5l.8 2.4M19 4.5l-1.8 1.8M20.5 10.5l-2.4-.8M10 6.5c1-1.6 2.6-1.4 3 0M16.6 13.5c1.4-.4 2.2.8 1.4 2" class="stroke thin"/><circle cx="17.5" cy="8.4" r="1.1" class="accent"/>'
  };

  // Player symbols: shown with every colour so no state relies on colour alone.
  var SYMBOL = {
    circle: '<circle cx="12" cy="12" r="6"/>',
    triangle: '<path d="M12 5.5l7 12.5H5z"/>',
    square: '<rect x="6.2" y="6.2" width="11.6" height="11.6" rx="1.4"/>',
    diamond: '<path d="M12 4.5l7.5 7.5-7.5 7.5L4.5 12z"/>',
    star: '<path d="M12 4.2l2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 16l-4.6 2.5.9-5.2-3.8-3.6 5.2-.7z"/>',
    hexagon: '<path d="M12 4.8l6.3 3.6v7.2L12 19.2l-6.3-3.6V8.4z"/>',
    cross: '<path d="M9.7 5.5h4.6v4.2h4.2v4.6h-4.2v4.2H9.7v-4.2H5.5V9.7h4.2z"/>',
    heart: '<path d="M12 19s-6.8-4.2-6.8-9a3.8 3.8 0 0 1 6.8-2.3A3.8 3.8 0 0 1 18.8 10c0 4.8-6.8 9-6.8 9z"/>'
  };

  var UI = {
    crown: '<path d="M3.5 8l4.3 3.6L12 5l4.2 6.6L20.5 8l-1.8 10H5.3z" fill="currentColor"/>',
    flag: '<path d="M6 21V3" class="stroke"/><path d="M6.5 4h11l-2.6 3.6L17.5 11h-11z" fill="currentColor"/>',
    gear: '<path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z" class="stroke"/><path d="M19.4 13.5l1.8 1.4-1.8 3.1-2.2-.8a7.6 7.6 0 0 1-1.9 1.1l-.4 2.3h-3.6l-.4-2.3a7.6 7.6 0 0 1-1.9-1.1l-2.2.8-1.8-3.1 1.8-1.4a7.7 7.7 0 0 1 0-3l-1.8-1.4 1.8-3.1 2.2.8a7.6 7.6 0 0 1 1.9-1.1l.4-2.3h3.6l.4 2.3a7.6 7.6 0 0 1 1.9 1.1l2.2-.8 1.8 3.1-1.8 1.4a7.7 7.7 0 0 1 0 3z" class="stroke thin"/>',
    help: '<circle cx="12" cy="12" r="9" class="stroke"/><path d="M9.4 9.4a2.7 2.7 0 1 1 3.8 2.4c-.8.4-1.2 1-1.2 1.9v.6" class="stroke"/><circle cx="12" cy="17.2" r="1.2" fill="currentColor"/>',
    trophy: '<path d="M7 3.5h10v5a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5.5H3.8a3.5 3.5 0 0 0 3.6 4M17 5.5h3.2a3.5 3.5 0 0 1-3.6 4M12 13.5V18M8 20.5h8" class="stroke"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2" class="stroke"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" class="stroke"/>',
    users: '<circle cx="9" cy="8.5" r="3.5" fill="currentColor"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0z" fill="currentColor"/><circle cx="17" cy="9.5" r="2.6" fill="currentColor" opacity=".6"/><path d="M16.5 14.2A5.5 5.5 0 0 1 21.5 20h-4" fill="currentColor" opacity=".6"/>',
    bot: '<rect x="4.5" y="7.5" width="15" height="11" rx="3" fill="currentColor"/><circle cx="9.3" cy="13" r="1.6" class="hole"/><circle cx="14.7" cy="13" r="1.6" class="hole"/><path d="M12 7.5V4.5" class="stroke"/><circle cx="12" cy="3.6" r="1.4" fill="currentColor"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" class="stroke"/>',
    check: '<path d="M4.5 12.5l4.8 4.8L19.5 7" class="stroke"/>',
    wait: '<circle cx="12" cy="12" r="8.5" class="stroke"/><path d="M12 7v5.2l3.2 2" class="stroke"/>',
    offline: '<path d="M2.5 8.5a14 14 0 0 1 19 0M5.5 12a9.5 9.5 0 0 1 13 0M8.6 15.4a5 5 0 0 1 6.8 0" class="stroke"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/><path d="M3 3l18 18" class="stroke"/>',
    camera: '<path d="M3 7.5h4l1.8-2.5h6.4L17 7.5h4v11.5H3z" class="stroke"/><circle cx="12" cy="13" r="3.4" class="stroke"/>',
    play: '<path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor"/>',
    plus: '<path d="M12 5v14M5 12h14" class="stroke"/>',
    minus: '<path d="M5 12h14" class="stroke"/>',
    link: '<path d="M10 14a4.2 4.2 0 0 0 6 0l3.3-3.3a4.2 4.2 0 0 0-6-6L12 6M14 10a4.2 4.2 0 0 0-6 0l-3.3 3.3a4.2 4.2 0 0 0 6 6L12 18" class="stroke"/>',
    sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" class="stroke"/>',
    mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" class="stroke"/>',
    back: '<path d="M15 5l-7 7 7 7" class="stroke"/>',
    list: '<path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12" class="stroke"/><circle cx="4.5" cy="6.5" r="1.4" fill="currentColor"/><circle cx="4.5" cy="12" r="1.4" fill="currentColor"/><circle cx="4.5" cy="17.5" r="1.4" fill="currentColor"/>',
    reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4.2h4.2" class="stroke"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" class="stroke"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    star: '<path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor"/>'
  };

  function svg(body, cls, title) {
    return '<svg viewBox="0 0 24 24" class="icon ' + (cls || '') + '" aria-hidden="' + (title ? 'false' : 'true') + '"' + (title ? ' role="img"' : '') + '>' + (title ? '<title>' + title + '</title>' : '') + body + '</svg>';
  }

  PC.icons = {
    POWER: POWER, SYMBOL: SYMBOL, UI: UI,
    power: function (id, cls) { return svg(POWER[id] || UI.help, 'pw ' + (cls || '')); },
    ui: function (id, cls) { return svg(UI[id] || '', cls); },
    symbol: function (id, cls) { return svg('<g fill="currentColor">' + (SYMBOL[id] || SYMBOL.circle) + '</g>', 'sym ' + (cls || '')); }
  };

  // Power-up colours for UI chips and in-world effects (bright colours reserved for power-ups).
  PC.POWER_COLORS = {
    turbo: '#ff7a3d', sticky: '#f2b630', ghost: '#b9c7ff', giant: '#e2734f', tiny: '#7fd6c2', reverse: '#d85db0',
    freeze: '#8fdcff', gust: '#a8e6e0', swap: '#c79bff', shield: '#7cc8ff', magnet: '#ff5d6c', confetti: '#ffd34d'
  };
})(window);
