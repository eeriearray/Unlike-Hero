/* Textured practical-mask encounter with continuous facial deformation.
 * Cosmetic clock only; no gameplay state or random stream is consumed. */
(function (g) {
  'use strict';
  var duration = 1500;
  function clamp(n) { return Math.max(0, Math.min(1, n)); }
  var profiles = {
    door: { file: 'scare-mask-v2.png', impact: 490, blackout: 260, snap: 770, end: 1170, speed: 85,
      caption: 'A sharp impact. Something rushes into your face.', rate: 1, pan: 0 },
    graveyard: { file: 'task3_weeping_statue_fullbody.webp', impact: 680, blackout: 420, snap: 900, end: 1240, speed: 1,
      caption: 'Stone scrapes. The figure is suddenly beside you.', rate: .72, pan: -.55 },
    tower: { file: 'task3_bellkeeper_portrait.webp', impact: 330, blackout: 190, snap: 690, end: 1120, speed: 180,
      caption: 'Iron crashes overhead. A caged face drops into view.', rate: .6, pan: .2 },
    danger: { file: 'task3_whisperling_fullbody.webp', impact: 210, blackout: 0, snap: 520, end: 940, speed: 95,
      caption: 'A close scraping breath. Something darts past your shoulder.', rate: 1.25, pan: .65 }
  };
  var textures = {};
  Object.keys(profiles).forEach(function (key) {
    if (!g.Image || !document.currentScript) return;
    var image = textures[key] = new g.Image(); image.decoding = 'async';
    image.src = new URL('../art/generated/' + profiles[key].file, document.currentScript.src).href;
  });
  function profile(variant) { return profiles[variant] || profiles.door; }
  function shot(ms, variant) {
    var p = profile(variant), attack = clamp((ms - p.impact) / p.speed);
    var snap = clamp((ms - p.snap) / 65);
    return { black: (ms >= p.blackout && ms < p.impact) || ms >= p.end,
      attack: 1 - Math.pow(1 - attack, 3), snap: snap,
      light: ms < p.impact ? (variant === 'graveyard' ? .32 : .09 + .07 * clamp(ms / 260)) :
        .88 - .25 * clamp((ms - p.snap) / 450),
      phase: ms < p.blackout ? 'presence' : ms < p.impact ? 'blackout' : ms < p.snap ? 'attack' : ms < p.end ? 'snap' : 'aftermath' };
  }
  function frame(canvas, ms, variant) {
    var x = canvas.getContext('2d'); if (!x) return false;
    var w = canvas.width, h = canvas.height, cut = shot(ms, variant), rush = cut.attack;
    var p = profile(variant), texture = textures[variant] || textures.door;
    x.clearRect(0, 0, w, h);
    x.fillStyle = variant === 'graveyard' && !cut.black ? 'rgba(1,3,5,.48)' : '#010204'; x.fillRect(0, 0, w, h);
    if (cut.black || !texture || !texture.complete || !texture.naturalWidth) return true;
    var side = variant === 'graveyard' ? -1 : 1;
    var kick = Math.exp(-Math.max(0, ms - p.impact) / 120) * rush;
    var jolt = (Math.sin(ms * .081) + .4 * Math.sin(ms * .137)) * kick;
    // The attack crosses the lens in 85ms; the second movement brings an eye
    // uncomfortably close. Never hold the whole mask like a portrait.
    var size = Math.max(h * 1.9, Math.min(w * 1.8, h * 2.35)) * (.24 + .84 * rush + .28 * cut.snap);
    x.save();
    if (variant === 'graveyard') {
      // It never visibly walks: a distant figure is replaced by a close face.
      var crop = rush ? [.27, .035, .46, .38] : [0, 0, 1, 1];
      var height = rush ? h * 1.45 : h * .78;
      var width = height * (texture.naturalWidth * crop[2]) / (texture.naturalHeight * crop[3]);
      var left = rush ? w * .34 - width / 2 : w * .7 - width / 2;
      x.translate(left + jolt * 5, rush ? h * -.07 : h * .16);
      x.drawImage(texture, crop[0] * texture.naturalWidth, crop[1] * texture.naturalHeight,
        crop[2] * texture.naturalWidth, crop[3] * texture.naturalHeight, 0, 0, width, height);
    } else if (variant === 'tower') {
      // A heavy vertical drop, then a forced camera tilt into the iron cage.
      var height = h * (1.55 + rush * .85 + cut.snap * .45), width = height * texture.naturalWidth / texture.naturalHeight;
      x.translate(w * (.51 - .07 * cut.snap) + jolt * 8, h * (-1.65 + rush * 1.25) + jolt * 15);
      x.rotate(-.08 + cut.snap * .15);
      x.drawImage(texture, -width / 2, 0, width, height);
    } else if (variant === 'danger') {
      // A body passes across the lens instead of stopping to show its face.
      var travel = clamp((ms - p.impact) / 620);
      var height = h * (2.1 + rush * .5), width = height * texture.naturalWidth / texture.naturalHeight;
      x.translate(w * (1.22 - 1.65 * travel) + jolt * 12, -h * .37);
      x.rotate(-.3 + travel * .5);
      x.drawImage(texture, -width / 2, -height * .08, width, height);
    } else {
    x.translate(w * (.5 + side * (.19 * (1 - rush) - .11 * cut.snap)) + jolt * 19,
      h * (.45 + .15 * rush + .06 * cut.snap) + jolt * 11);
    x.rotate(side * (-.19 + .23 * rush - .22 * cut.snap) + jolt * .025);
    var bands = 100, sw = texture.naturalWidth, sh = texture.naturalHeight;
    // The photographic surface stretches continuously; the lower face opens
    // late, while the forehead remains planted, instead of scaling rigidly.
    var jaw = rush * (.10 + .08 * cut.snap + .016 * Math.sin(ms / 51));
    function bend(v) { return v + jaw * Math.pow(clamp((v - .48) / .52), 1.7); }
    for (var row = 0; row < bands; row++) {
      var v = row / bands, next = (row + 1) / bands;
      var y = (bend(v) - .5) * size, height = (bend(next) - bend(v)) * size;
      var sway = Math.sin(v * 5 + ms / 160) * rush * size * .006;
      var width = size * (1 - .06 * cut.snap * Math.sin(v * Math.PI));
      x.drawImage(texture, 0, v * sh, sw, sh / bands,
        -width / 2 + sway, y, width, height + .6);
    }
    }
    x.restore();
    // Apply exposure once over the assembled face, avoiding seams between bands.
    x.fillStyle = 'rgba(0,2,4,' + (1 - cut.light) + ')'; x.fillRect(0, 0, w, h);
    var vignette = x.createRadialGradient(w * (.5 - .08 * cut.snap * side), h * .43, h * .12, w / 2, h / 2, Math.max(w, h) * .58);
    vignette.addColorStop(0, 'transparent'); vignette.addColorStop(1, '#000');
    x.fillStyle = vignette; x.fillRect(0, 0, w, h);
    // Fine exposure grain, not full-screen flashes or digital glitch bars.
    x.fillStyle = 'rgba(170,180,176,.035)';
    for (var grain = 0; grain < 130; grain++) {
      var seed = grain * 127.1 + Math.floor(ms / 42) * 311.7;
      x.fillRect(((Math.sin(seed) * 43758.54) % 1 + 1) % 1 * w,
        ((Math.sin(seed * 1.7) * 19341.31) % 1 + 1) % 1 * h, 1, 1);
    }
    return true;
  }
  function draw(canvas, ms, variant) { canvas.width = 960; canvas.height = 640; return frame(canvas, ms == null ? 650 : ms, variant || 'door'); }
  function play(target, options) {
    options = options || {};
    var variant = profiles[options.variant] ? options.variant : 'door', p = profile(variant);
    var texture = textures[variant];
    target.setAttribute('data-scare', variant);
    var canvas = document.createElement('canvas'); canvas.className = 'scare-creature'; canvas.setAttribute('aria-hidden', 'true');
    var rect = target.getBoundingClientRect();
    canvas.width = Math.max(1, Math.min(1440, Math.round(rect.width || 960)));
    canvas.height = Math.max(1, Math.min(1000, Math.round(rect.height || 640)));
    target.replaceChildren(canvas);
    var stopped = false, raf = null, start = performance.now(), struck = false;
    function stop() { stopped = true; if (raf !== null) g.cancelAnimationFrame(raf); }
    function tick(now) {
      if (stopped) return;
      var fx = g.HollowFx;
      if (!target.isConnected || document.hidden || (fx && (fx.prefs.jumpScares === false || fx.prefs.reducedScares || fx.reduced()))) { stop(); return; }
      var ms = now - start;
      if (ms >= duration) { stop(); if (options.onComplete) options.onComplete(); return; }
      frame(canvas, ms, variant);
      if (ms >= p.impact && !shot(ms, variant).black && !struck && texture && texture.complete && texture.naturalWidth) { struck = true; if (options.onImpact) options.onImpact(variant); }
      raf = g.requestAnimationFrame(tick);
    }
    tick(start); return stop;
  }
  g.HollowScareFace = { draw: draw, play: play, duration: duration, shot: shot, profiles: profiles };
})(window);
