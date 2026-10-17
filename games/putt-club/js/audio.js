/* Putt Club — synthesized sound. Every sound is generated with Web Audio (no files to fail to load).
 * The context starts on the first user gesture (autoplay rules). Separate music and effects volumes, mute,
 * light randomisation so repeated hits don't sound identical, and a gentle generative loop per course. */
(function (global) {
  'use strict';
  var PC = global.PC;
  var ctx = null, master, sfxBus, musicBus, comp, noiseBuf = null, rollSrc = null, rollGain = null, rollFilter = null;
  var settings = { music: PC.store.get('vol.music', 0.4), sfx: PC.store.get('vol.sfx', 0.8), mute: PC.store.get('mute', false) };
  var lastPlay = {};

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    apply();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Continuous rolling rumble, driven by ball speed.
    rollSrc = ctx.createBufferSource(); rollSrc.buffer = noiseBuf; rollSrc.loop = true;
    rollFilter = ctx.createBiquadFilter(); rollFilter.type = 'lowpass'; rollFilter.frequency.value = 300; rollFilter.Q.value = 0.7;
    rollGain = ctx.createGain(); rollGain.gain.value = 0;
    rollSrc.connect(rollFilter); rollFilter.connect(rollGain); rollGain.connect(sfxBus); rollSrc.start();
    return true;
  }

  function apply() {
    if (!ctx) return;
    var t = ctx.currentTime;
    master.gain.setTargetAtTime(settings.mute ? 0 : 1, t, 0.05);
    sfxBus.gain.setTargetAtTime(settings.sfx, t, 0.05);
    musicBus.gain.setTargetAtTime(settings.music * 0.55, t, 0.2);
  }

  function now() { return ctx.currentTime; }
  function throttle(key, ms) { var t = performance.now(); if (lastPlay[key] && t - lastPlay[key] < ms) return false; lastPlay[key] = t; return true; }
  function vary(v, amt) { return v * (1 + (Math.random() - 0.5) * amt); }

  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }

  function tone(type, freq, t, a, d, peak, dest, glideTo, pan) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + a + d);
    env(g, t, a, peak, d);
    var out = g;
    if (pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = PC.clamp(pan, -1, 1); g.connect(p); out = p; }
    o.connect(g); out.connect(dest || sfxBus);
    o.start(t); o.stop(t + a + d + 0.05);
  }

  function noise(t, d, peak, filterType, freq, q, dest, sweepTo, pan) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = filterType; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + d);
    env(g, t, 0.004, peak, d);
    s.connect(f); f.connect(g);
    var out = g;
    if (pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = PC.clamp(pan, -1, 1); g.connect(p); out = p; }
    out.connect(dest || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  }

  var S = {};
  S.strike = function (power) {
    var t = now(), v = 0.25 + power * 0.55;
    noise(t, 0.05, v * 0.9, 'bandpass', vary(2600, 0.1), 1.2);
    tone('sine', vary(180, 0.08), t, 0.002, 0.12, v * 0.7, null, 90);
    tone('triangle', vary(1200, 0.05), t, 0.001, 0.04, v * 0.25);
  };
  var MAT = {
    wood: function (t, v, pan) { tone('sine', vary(230, 0.12), t, 0.002, 0.12, v * 0.8, null, 160, pan); noise(t, 0.05, v * 0.5, 'lowpass', 1200, 1, null, null, pan); },
    stone: function (t, v, pan) { noise(t, 0.04, v * 0.8, 'highpass', 1800, 0.8, null, null, pan); tone('sine', vary(520, 0.1), t, 0.001, 0.06, v * 0.3, null, null, pan); },
    metal: function (t, v, pan) { tone('sine', vary(880, 0.06), t, 0.001, 0.32, v * 0.35, null, null, pan); tone('sine', vary(1390, 0.06), t, 0.001, 0.22, v * 0.2, null, null, pan); noise(t, 0.03, v * 0.4, 'highpass', 3000, 1, null, null, pan); },
    glass: function (t, v, pan) { tone('sine', vary(1750, 0.05), t, 0.001, 0.25, v * 0.3, null, null, pan); tone('sine', vary(2630, 0.05), t, 0.001, 0.18, v * 0.16, null, null, pan); },
    hedge: function (t, v, pan) { noise(t, 0.12, v * 0.5, 'bandpass', 900, 0.6, null, 400, pan); },
    rope: function (t, v, pan) { tone('sine', vary(140, 0.1), t, 0.004, 0.1, v * 0.6, null, 110, pan); },
    neon: function (t, v, pan) { tone('square', vary(660, 0.05), t, 0.001, 0.08, v * 0.12, null, 990, pan); noise(t, 0.04, v * 0.4, 'highpass', 2500, 1, null, null, pan); }
  };
  MAT.brass = MAT.metal; MAT.rubber = MAT.rope;
  S.wall = function (mat, s, pan) {
    if (!throttle('wall', 35)) return;
    var v = PC.clamp(s / 12, 0.06, 0.8);
    (MAT[mat] || MAT.wood)(now(), v, pan);
  };
  S.bumper = function (s, pan) {
    if (!throttle('bumper', 60)) return;
    var t = now(), v = PC.clamp(s / 10, 0.2, 0.7);
    tone('sine', vary(320, 0.08), t, 0.002, 0.25, v * 0.6, null, 760, pan);
    tone('triangle', vary(640, 0.05), t + 0.02, 0.002, 0.15, v * 0.25, null, 1200, pan);
  };
  S.ball = function (s, pan) { if (!throttle('ball', 50)) return; var t = now(), v = PC.clamp(s / 10, 0.1, 0.7); tone('sine', vary(1500, 0.08), t, 0.001, 0.06, v * 0.5, null, null, pan); noise(t, 0.03, v * 0.5, 'bandpass', 3500, 2, null, null, pan); };
  S.land = function (s, pan) { if (!throttle('land', 80)) return; var t = now(), v = PC.clamp(s / 10, 0.1, 0.6); tone('sine', 110, t, 0.003, 0.15, v, null, 60, pan); noise(t, 0.08, v * 0.4, 'lowpass', 700, 1, null, null, pan); };
  S.lip = function () { var t = now(); tone('sine', 900, t, 0.001, 0.05, 0.3); tone('sine', 700, t + 0.06, 0.001, 0.05, 0.25); };
  S.cup = function (rel) {
    var t = now();
    [0, 0.05, 0.11].forEach(function (d, i) { tone('sine', vary(1300 - i * 200, 0.05), t + d, 0.001, 0.05, 0.3); });
    tone('sine', 140, t + 0.14, 0.004, 0.25, 0.5, null, 80);
    var notes = rel <= -1 ? [523, 659, 784, 1047, 1319] : rel === 0 ? [523, 659, 784] : [440, 523];
    notes.forEach(function (f, i) { tone('triangle', f, t + 0.3 + i * 0.085, 0.005, 0.35, 0.22); });
  };
  S.splash = function () { var t = now(); noise(t, 0.5, 0.6, 'lowpass', 2400, 0.8, null, 300); for (var i = 0; i < 5; i++) tone('sine', vary(600 + i * 120, 0.3), t + 0.12 + i * 0.07, 0.002, 0.06, 0.12, null, 1200); };
  S.fall = function () { var t = now(); tone('sine', 700, t, 0.01, 0.8, 0.3, null, 80); };
  S.token = function () { var t = now(); [784, 988, 1175, 1568].forEach(function (f, i) { tone('triangle', f, t + i * 0.055, 0.003, 0.22, 0.2); }); };
  S.pad = function () { var t = now(); tone('sawtooth', 160, t, 0.01, 0.35, 0.12, null, 900); noise(t, 0.3, 0.3, 'bandpass', 600, 1, null, 3000); };
  S.whoosh = function () { var t = now(); noise(t, 0.35, 0.35, 'bandpass', 400, 1.2, null, 2500); };
  S.power = function (id) {
    var t = now();
    S.whoosh();
    switch (id) {
      case 'turbo': tone('sawtooth', 90, t, 0.02, 0.6, 0.15, null, 400); break;
      case 'freeze': [2093, 2637, 3136, 2637].forEach(function (f, i) { tone('sine', f, t + i * 0.05, 0.002, 0.4, 0.12); }); break;
      case 'gust': noise(t, 0.9, 0.45, 'bandpass', 300, 0.6, null, 1400); break;
      case 'swap': tone('sine', 440, t, 0.01, 0.3, 0.2, null, 880); tone('sine', 880, t + 0.12, 0.01, 0.3, 0.2, null, 440); break;
      case 'shield': tone('sine', 523, t, 0.02, 0.6, 0.15); tone('sine', 784, t, 0.02, 0.6, 0.12); break;
      case 'confetti': noise(t, 0.08, 0.6, 'highpass', 1500, 1); for (var i = 0; i < 8; i++) noise(t + 0.08 + Math.random() * 0.4, 0.02, 0.2, 'highpass', 4000, 1); break;
      case 'ghost': tone('sine', 300, t, 0.1, 0.6, 0.12, null, 600); tone('sine', 450, t, 0.1, 0.6, 0.08, null, 900); break;
      case 'giant': tone('sine', 300, t, 0.01, 0.45, 0.3, null, 90); break;
      case 'tiny': tone('sine', 400, t, 0.01, 0.35, 0.25, null, 1600); break;
      case 'magnet': tone('square', 110, t, 0.02, 0.4, 0.06); tone('sine', 220, t, 0.02, 0.4, 0.12); break;
      case 'reverse': tone('triangle', 660, t, 0.01, 0.2, 0.15, null, 330); tone('triangle', 330, t + 0.2, 0.01, 0.2, 0.15, null, 660); break;
      default: tone('triangle', 660, t, 0.01, 0.25, 0.15);
    }
  };
  S.blocked = function () { var t = now(); tone('sine', 1568, t, 0.002, 0.6, 0.25); tone('sine', 2093, t + 0.02, 0.002, 0.5, 0.15); noise(t, 0.06, 0.4, 'highpass', 2000, 1); };
  S.click = function () { if (!throttle('click', 40)) return; var t = now(); tone('triangle', 900, t, 0.001, 0.05, 0.12); };
  S.hover = function () { if (!throttle('hover', 60)) return; var t = now(); tone('sine', 1400, t, 0.001, 0.025, 0.035); };
  S.hole = function () { var t = now(); noise(t, 0.6, 0.18, 'bandpass', 300, 0.8, null, 2000); [392, 523, 659].forEach(function (f, i) { tone('triangle', f, t + 0.25 + i * 0.12, 0.01, 0.6, 0.12); }); };
  S.go = function () { var t = now(); tone('triangle', 784, t, 0.005, 0.15, 0.18); tone('triangle', 1047, t + 0.12, 0.005, 0.3, 0.2); };
  S.tick = function () { var t = now(); tone('square', 1200, t, 0.001, 0.03, 0.05); };
  S.victory = function () { var t = now(); [[523, 659, 784], [587, 740, 880], [659, 831, 988], [784, 988, 1175, 1568]].forEach(function (ch, i) { ch.forEach(function (f) { tone('triangle', f, t + i * 0.22, 0.01, i === 3 ? 1.4 : 0.3, 0.1); }); }); };
  S.results = function () { var t = now(); [523, 659, 784, 659].forEach(function (f, i) { tone('triangle', f, t + i * 0.1, 0.01, 0.25, 0.12); }); };
  S.error = function () { var t = now(); tone('triangle', 330, t, 0.005, 0.12, 0.15); tone('triangle', 247, t + 0.1, 0.005, 0.18, 0.15); };

  /** Ball rolling sound: speed in units/second of the loudest nearby ball. */
  S.roll = function (speed) {
    if (!ctx) return;
    var v = PC.clamp(speed / 14, 0, 1), t = ctx.currentTime;
    rollGain.gain.setTargetAtTime(v > 0.02 ? 0.04 + v * 0.16 : 0, t, 0.06);
    rollFilter.frequency.setTargetAtTime(180 + v * 900, t, 0.08);
  };

  // ---------------------------------------------------------------- music

  var music = { theme: null, timer: null, next: 0, step: 0 };
  var SONGS = {
    cove: { bpm: 92, root: 55, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [9, 0, 4], [5, 9, 0], [7, 11, 2]], lead: 'sine', pad: 'triangle' },
    garden: { bpm: 84, root: 57, scale: [0, 2, 4, 5, 7, 9, 11], chords: [[0, 4, 7], [5, 9, 0], [2, 5, 9], [7, 11, 2]], lead: 'triangle', pad: 'sine' },
    neon: { bpm: 104, root: 50, scale: [0, 3, 5, 7, 10], chords: [[0, 3, 7], [8, 0, 3], [3, 7, 10], [10, 2, 5]], lead: 'square', pad: 'sawtooth' },
    menu: { bpm: 88, root: 53, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [5, 9, 0], [9, 0, 4], [7, 11, 2]], lead: 'triangle', pad: 'sine' }
  };
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function schedule() {
    var song = SONGS[music.theme];
    if (!song || !ctx) return;
    var beat = 60 / song.bpm / 2; // eighth notes
    while (music.next < ctx.currentTime + 0.2) {
      var t = music.next, s = music.step, bar = Math.floor(s / 16) % 4, chord = song.chords[bar];
      if (s % 16 === 0) chord.forEach(function (n) { padNote(song, midi(song.root + 12 + n), t, beat * 16); });
      if (s % 4 === 0) tone('sine', midi(song.root + chord[0] - 12 + 12), t, 0.01, beat * 3, 0.13, musicBus);
      var r = PC.hash(music.theme + s) % 100;
      if (r < (music.theme === 'neon' ? 55 : 38)) {
        var deg = song.scale[(PC.hash('n' + s) % song.scale.length)];
        var oct = PC.hash('o' + s) % 3 === 0 ? 36 : 24;
        tone(song.lead, midi(song.root + oct + deg), t, 0.005, beat * 1.6, song.lead === 'square' ? 0.025 : 0.06, musicBus);
      }
      music.next += beat; music.step = (s + 1) % 128;
    }
  }
  function padNote(song, f, t, d) {
    var o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), flt = ctx.createBiquadFilter();
    o.type = song.pad; o2.type = song.pad; o.frequency.value = f; o2.frequency.value = f * 1.004;
    flt.type = 'lowpass'; flt.frequency.value = song.pad === 'sawtooth' ? 700 : 1400;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + d * 0.25); g.gain.linearRampToValueAtTime(0.0001, t + d);
    o.connect(flt); o2.connect(flt); flt.connect(g); g.connect(musicBus);
    o.start(t); o2.start(t); o.stop(t + d + 0.1); o2.stop(t + d + 0.1);
  }

  PC.audio = {
    unlock: function () { ensure(); if (music.theme && !music.timer) PC.audio.music(music.theme, true); },
    play: function (name) { if (!ctx || settings.mute) return; var f = S[name]; if (f) f.apply(null, Array.prototype.slice.call(arguments, 1)); },
    roll: function (s) { if (ctx) S.roll(settings.mute ? 0 : s); },
    music: function (theme, force) {
      if (music.theme === theme && music.timer && !force) return;
      music.theme = theme;
      if (!ctx) return;
      clearInterval(music.timer);
      music.next = ctx.currentTime + 0.1; music.step = 0;
      music.timer = setInterval(schedule, 60);
    },
    settings: settings,
    set: function (k, v) { settings[k] = v; PC.store.set(k === 'mute' ? 'mute' : 'vol.' + k, v); apply(); }
  };
})(window);
