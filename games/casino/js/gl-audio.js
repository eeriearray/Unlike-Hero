/* Neon Casino — sound for the 3D tables, all synthesised with the Web Audio API (nothing to download): card slides,
   chip clacks, the roulette ball rattling over the frets, win and lose stings, and a slow, low back-room jazz loop.
   Starts on the first tap or key (browsers require a gesture) and can be muted; the choice is remembered. */
(function (global) {
  'use strict';
  var GL = global.CasinoGL = global.CasinoGL || {};
  var ctx = null, master, sfx, music, noiseBuf, musicOn = false, timer = 0, nextT = 0, step = 0, muted = false, listeners = [];
  try { muted = localStorage.getItem('hub.casino.muted') === 'true'; } catch (e) {}

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = global.AudioContext || global.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    music = ctx.createGain(); music.gain.value = 0.16; music.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  }
  ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { global.addEventListener(ev, init, { passive: true }); });
  document.addEventListener('visibilitychange', function () { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (!muted) ctx.resume(); });

  function env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function noise(t, dur, f0, f1, q, peak, type) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1;
    var g = ctx.createGain(); env(g, t, 0.004, dur, peak); s.connect(f); f.connect(g); g.connect(sfx); s.start(t); s.stop(t + dur + 0.05);
  }
  function tone(t, freq, dur, peak, type, dest, glide) {
    var o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    var g = ctx.createGain(); env(g, t, 0.005, dur, peak); o.connect(g); g.connect(dest || sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  function ok() { return ctx && !muted && ctx.state === 'running'; }

  var A = GL.audio = {
    card: function (soft) { if (!ok()) return; var t = ctx.currentTime; noise(t, 0.09, 5200, 1800, 0.8, soft ? 0.12 : 0.3, 'bandpass'); noise(t + 0.07, 0.04, 900, 500, 1, 0.12, 'lowpass'); },
    chip: function (n) {
      if (!ok()) return; var t = ctx.currentTime; n = Math.min(4, n || 2);
      for (var i = 0; i < n; i++) { var tt = t + i * 0.055 + Math.random() * 0.02; tone(tt, 2300 + Math.random() * 900, 0.07, 0.16, 'triangle'); tone(tt, 3400 + Math.random() * 600, 0.05, 0.08, 'sine'); noise(tt, 0.03, 4000, 2500, 2, 0.1); }
    },
    tick: function (vol) { if (!ok()) return; var t = ctx.currentTime; tone(t, 1700 + Math.random() * 500, 0.035, 0.07 * (vol == null ? 1 : vol), 'square'); noise(t, 0.02, 3500, 2000, 3, 0.05 * (vol == null ? 1 : vol)); },
    spin: function () { if (!ok()) return; var t = ctx.currentTime; noise(t, 1.6, 300, 900, 0.7, 0.12, 'bandpass'); },
    thud: function () { if (!ok()) return; var t = ctx.currentTime; tone(t, 160, 0.18, 0.3, 'sine', sfx, 60); noise(t, 0.05, 2000, 800, 1, 0.15); },
    win: function () { if (!ok()) return; var t = ctx.currentTime; [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(t + i * 0.09, f, 0.5, 0.17, 'triangle'); tone(t + i * 0.09, f * 2, 0.35, 0.05, 'sine'); }); },
    lose: function () { if (!ok()) return; var t = ctx.currentTime; tone(t, 311.1, 0.5, 0.16, 'triangle', sfx, 296); tone(t + 0.22, 233.1, 0.8, 0.16, 'triangle', sfx, 208); },
    coins: function (n) { if (!ok()) return; var t = ctx.currentTime; n = Math.min(14, n || 8); for (var i = 0; i < n; i++) { var tt = t + i * 0.07 + Math.random() * 0.03; tone(tt, 1800 + Math.random() * 1600, 0.09, 0.14, 'triangle'); tone(tt + 0.02, 3600 + Math.random() * 800, 0.06, 0.06, 'sine'); noise(tt, 0.03, 5000, 3000, 2, 0.08); } },
    turn: function () { if (!ok()) return; var t = ctx.currentTime; tone(t, 880, 0.18, 0.1, 'sine'); tone(t + 0.12, 1318.5, 0.3, 0.1, 'sine'); },
    isMuted: function () { return muted; },
    setMuted: function (m) {
      muted = !!m; try { localStorage.setItem('hub.casino.muted', String(muted)); } catch (e) {}
      if (ctx) { master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05); if (!muted && ctx.state === 'suspended') ctx.resume(); } else if (!muted) init();
      listeners.forEach(function (f) { f(muted); });
    },
    onChange: function (f) { listeners.push(f); return function () { listeners = listeners.filter(function (x) { return x !== f; }); }; },
    init: init
  };

  // ── the music: four short loops that take turns, all synthesised ──
  function mtof(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function note(t, n, dur, peak, type, opts) {                // a single pitched note into the music bus
    opts = opts || {};
    var o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = mtof(n); if (opts.detune) o.detune.value = opts.detune;
    var g = ctx.createGain(), f = null;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + (opts.att || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (opts.lp) { f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; o.connect(f); f.connect(g); } else o.connect(g);
    g.connect(music); o.start(t); o.stop(t + dur + 0.05);
  }
  function swell(t, n, dur, peak, lp) {                       // a slow pad voice
    var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(n); o.detune.value = (Math.random() - 0.5) * 12;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 700; var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(music); o.start(t); o.stop(t + dur + 0.1);
  }
  function brush(t, vol, dur, hp) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 5000; var g = ctx.createGain(); env(g, t, 0.01, dur || 0.12, vol);
    s.connect(f); f.connect(g); g.connect(music); s.start(t); s.stop(t + (dur || 0.12) + 0.1);
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  var JAZZ = [[50, 53, 57, 60, 64], [43, 47, 50, 53, 57], [48, 52, 55, 59, 62], [45, 49, 52, 55, 58]];
  var BLUES = [57, 57, 57, 57, 62, 62, 57, 57, 64, 62, 57, 64];                 // roots of a 12-bar blues in A
  var RAG = [[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55]];
  var BOSSA = [[45, 48, 52, 55, 59], [50, 54, 57, 60, 64], [43, 47, 50, 54, 57], [48, 52, 55, 59, 62]];

  var TRACKS = [
    { name: 'Smoky Jazz', bar: function (t, i) {
      var beat = 60 / 62, ch = JAZZ[i % 4];
      ch.forEach(function (n) { swell(t, n + 12, beat * 4, 0.05, 700); });
      [ch[0], ch[2], ch[1], ch[3]].forEach(function (n, b) { note(t + b * beat, n - 12 + (b === 3 ? 1 : 0), beat * 0.8, 0.22, 'sine'); });
      brush(t + beat, 0.05); brush(t + beat * 3, 0.05);
      for (var p = 0; p < 3; p++) if (Math.random() < 0.7) note(t + (Math.floor(Math.random() * 8) / 2) * beat, pick([62, 65, 67, 69, 72, 74, 76, 77, 79]), 1.3, 0.09, 'sine');
      return beat * 4;
    } },
    { name: 'Noir Blues', bar: function (t, i) {
      var beat = 60 / 72, root = BLUES[i % 12], sw = beat * 0.15;               // shuffle feel
      [0, 4, 7, 9].forEach(function (iv, b) { note(t + b * beat, root - 24 + iv, beat * 0.9, 0.26, 'sine'); });
      [1, 3].forEach(function (b) { [0, 4, 7, 10].forEach(function (iv) { note(t + b * beat + sw, root - 12 + iv + 12, 0.22, 0.05, 'triangle', { lp: 1400 }); }); });
      brush(t, 0.05, 0.1, 6000); brush(t + beat * 2, 0.05, 0.1, 6000); brush(t + beat + sw, 0.035, 0.08, 7000); brush(t + beat * 3 + sw, 0.035, 0.08, 7000);
      if (Math.random() < 0.75) { var ph = Math.floor(Math.random() * 3) + 2; for (var k = 0; k < ph; k++) note(t + (Math.floor(Math.random() * 7) / 2 + 0.5) * beat, 57 + pick([12, 15, 17, 18, 19, 22, 24]), 0.9, 0.08, 'triangle', { lp: 1800, att: 0.02 }); }
      return beat * 4;
    } },
    { name: 'Saloon Rag', bar: function (t, i) {
      var beat = 60 / 112, ch = RAG[i % 4];
      [0, 2].forEach(function (b) { note(t + b * beat, ch[0] - 12, beat * 0.9, 0.2, 'triangle', { lp: 900 }); });
      [1, 3].forEach(function (b) { ch.forEach(function (n) { note(t + b * beat, n, 0.18, 0.05, 'triangle', { lp: 1800 }); }); });
      for (var k = 0; k < 8; k++) if (Math.random() < 0.72) { var n = pick([67, 69, 72, 74, 76, 79]); [0, 9].forEach(function (d) { note(t + k * beat / 2, n, 0.32, 0.045, 'square', { lp: 2400, detune: d }); }); }
      return beat * 4;
    } },
    { name: 'Bossa Lounge', bar: function (t, i) {
      var beat = 60 / 78, ch = BOSSA[i % 4];
      ch.forEach(function (n) { note(t, n + 12, beat * 3.8, 0.04, 'sine'); note(t, n + 24, beat * 2.5, 0.012, 'sine', { detune: 5 }); });
      [0, 1.5, 2, 3.5].forEach(function (b, k) { note(t + b * beat, k % 2 ? ch[0] - 5 : ch[0] - 12, beat * 0.7, 0.22, 'sine'); });
      for (var k2 = 0; k2 < 8; k2++) brush(t + k2 * beat / 2, k2 % 2 ? 0.02 : 0.03, 0.05, 8000);
      if (Math.random() < 0.6) note(t + pick([0.5, 1, 2.5, 3]) * beat, pick([69, 72, 76, 79, 81]), 1.0, 0.06, 'sine');
      return beat * 4;
    } }
  ];
  var cur = 0, barsLeft = 0, trackStep = 0;
  A.debug = function () { return { state: ctx && ctx.state, track: TRACKS[cur].name, scheduledAhead: ctx ? +(nextT - ctx.currentTime).toFixed(2) : null, step: trackStep }; };
  A.trackName = function () { return TRACKS[cur].name; };
  /** Skip to the next loop (the music also rotates by itself every few minutes). */
  A.nextTrack = function () { cur = (cur + 1) % TRACKS.length; barsLeft = 40; trackStep = 0; init(); if (ctx && ctx.currentTime + 0.1 < nextT) nextT = ctx.currentTime + 0.15; listeners.forEach(function (f) { f(muted); }); return TRACKS[cur].name; };
  function startMusic() {
    if (musicOn) return; musicOn = true; nextT = ctx.currentTime + 0.1; cur = Math.floor(Math.random() * TRACKS.length); barsLeft = 40;
    timer = setInterval(function () {
      if (!ctx || ctx.state !== 'running' || muted) { if (ctx && nextT < ctx.currentTime) nextT = ctx.currentTime + 0.1; return; }
      while (nextT < ctx.currentTime + 0.6) {
        nextT += TRACKS[cur].bar(nextT, trackStep++);
        if (--barsLeft <= 0) { cur = (cur + 1) % TRACKS.length; barsLeft = 40; trackStep = 0; listeners.forEach(function (f) { f(muted); }); }
      }
    }, 250);
  }
})(window);
