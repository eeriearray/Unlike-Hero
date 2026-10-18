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

  // ── the music: a slow minor-key shuffle, four chords, soft pad + upright-ish bass + a few piano notes ──
  var CHORDS = [[50, 53, 57, 60, 64], [43, 47, 50, 53, 57], [48, 52, 55, 59, 62], [45, 49, 52, 55, 58]];      // Dm9, G9, Cmaj9, A7b9-ish
  var SCALE = [62, 65, 67, 69, 72, 74, 76, 77, 79];
  function mtof(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function bar(t, idx) {
    var ch = CHORDS[idx % 4], beat = 60 / 62;
    ch.forEach(function (n, i) {                                                                                  // pad
      var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(n + 12); o.detune.value = (i - 2) * 6;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + beat * 1.2); g.gain.linearRampToValueAtTime(0.0001, t + beat * 4);
      o.connect(f); f.connect(g); g.connect(music); o.start(t); o.stop(t + beat * 4 + 0.1);
    });
    var walk = [ch[0], ch[2], ch[1], ch[3]];
    for (var b = 0; b < 4; b++) { var bt = t + b * beat; var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = mtof(walk[b] - 12 + (b === 3 ? 1 : 0)); var g2 = ctx.createGain(); env(g2, bt, 0.02, beat * 0.8, 0.22); o2.connect(g2); g2.connect(music); o2.start(bt); o2.stop(bt + beat); }
    for (var k = 0; k < 4; k++) {                                                                                 // brushes on 2 and 4
      if (k % 2 === 1) { var s = ctx.createBufferSource(); s.buffer = noiseBuf; var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000; var g3 = ctx.createGain(); env(g3, t + k * beat, 0.01, 0.12, 0.05); s.connect(hp); hp.connect(g3); g3.connect(music); s.start(t + k * beat); s.stop(t + k * beat + 0.2); }
    }
    for (var p = 0; p < 3; p++) if (Math.random() < 0.7) {                                                       // sparse piano
      var pt = t + (Math.floor(Math.random() * 8) / 2) * beat, note = SCALE[Math.floor(Math.random() * SCALE.length)];
      var o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = mtof(note); var g4 = ctx.createGain(); env(g4, pt, 0.008, 1.3, 0.09); o3.connect(g4); g4.connect(music); o3.start(pt); o3.stop(pt + 1.4);
    }
  }
  function startMusic() {
    if (musicOn) return; musicOn = true; nextT = ctx.currentTime + 0.1;
    timer = setInterval(function () { if (!ctx || ctx.state !== 'running') return; var beat = 60 / 62; while (nextT < ctx.currentTime + 0.6) { bar(nextT, step++); nextT += beat * 4; } }, 250);
  }
})(window);
