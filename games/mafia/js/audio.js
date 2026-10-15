/* Mafia — procedural sound design with the Web Audio API. No audio files: every sound is synthesized.
   window.MafiaAudio: unlock(), setMuted(bool), muted, play(name), ambience(mode), heartbeat(level). */
(function (global) {
  'use strict';
  var ctx = null, master = null, sfxBus = null, ambBus = null, noiseBuf = null;
  var muted = false;
  try { muted = localStorage.getItem('hub.mafia.muted') === '1'; } catch (e) { /* storage blocked */ }
  var amb = { mode: null, nodes: [], timers: [] };
  var heart = { level: 0, timer: null };

  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.85; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.55; ambBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  // ── building blocks ──
  function env(g, t, a, peak, dec, sustain) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain || 0.0001, 0.0001), t + a + dec);
  }
  function tone(freq, opts) {
    opts = opts || {};
    var t = ctx.currentTime + (opts.delay || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + (opts.glide || opts.dur || 0.3));
    if (opts.detune) o.detune.value = opts.detune;
    env(g, t, opts.attack || 0.005, opts.gain || 0.3, opts.dur || 0.3);
    var out = g;
    if (opts.filter) { var f = ctx.createBiquadFilter(); f.type = opts.filter.type || 'lowpass'; f.frequency.value = opts.filter.freq; f.Q.value = opts.filter.q || 1; g.connect(f); out = f; }
    o.connect(g); out.connect(opts.bus || sfxBus);
    o.start(t); o.stop(t + (opts.attack || 0.005) + (opts.dur || 0.3) + 0.05);
    return o;
  }
  function noise(opts) {
    opts = opts || {};
    var t = ctx.currentTime + (opts.delay || 0);
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = !!opts.loop;
    var f = ctx.createBiquadFilter(); f.type = opts.type || 'bandpass'; f.frequency.setValueAtTime(opts.freq || 1000, t); f.Q.value = opts.q || 1;
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + (opts.dur || 0.3));
    var g = ctx.createGain();
    env(g, t, opts.attack || 0.002, opts.gain || 0.3, opts.dur || 0.3);
    s.connect(f); f.connect(g); g.connect(opts.bus || sfxBus);
    s.start(t, Math.random()); if (!opts.loop) s.stop(t + (opts.attack || 0.002) + (opts.dur || 0.3) + 0.05);
    return s;
  }

  // ── one-shot sounds ──
  var SFX = {
    click: function () { tone(1800, { type: 'square', dur: 0.03, gain: 0.05, filter: { freq: 3000 } }); },
    hover: function () { tone(2400, { dur: 0.025, gain: 0.025 }); },
    tick: function () { noise({ freq: 3200, q: 8, dur: 0.035, gain: 0.35 }); tone(1100, { type: 'square', dur: 0.02, gain: 0.04, filter: { freq: 2000 } }); },
    tock: function () { noise({ freq: 1700, q: 8, dur: 0.05, gain: 0.45 }); tone(620, { type: 'triangle', dur: 0.06, gain: 0.12 }); },
    gong: function () {
      [1, 2.01, 2.76, 3.9, 5.4].forEach(function (m, i) { tone(82 * m, { dur: 4.2 - i * 0.5, gain: 0.22 / (i + 1), attack: 0.01 }); });
      noise({ freq: 400, q: 0.7, dur: 0.4, gain: 0.15 });
    },
    bell: function () { [1, 2.4, 3.1].forEach(function (m, i) { tone(392 * m, { dur: 2.2 - i * 0.4, gain: 0.12 / (i + 1) }); }); },
    gavel: function () {
      tone(140, { to: 50, dur: 0.35, gain: 0.8, type: 'sine' });
      noise({ type: 'lowpass', freq: 1800, dur: 0.18, gain: 0.9 });
      tone(420, { type: 'triangle', dur: 0.25, gain: 0.25, delay: 0.005 });
      tone(140, { to: 55, dur: 0.3, gain: 0.5, delay: 0.45 });
      noise({ type: 'lowpass', freq: 1500, dur: 0.15, gain: 0.6, delay: 0.45 });
    },
    death: function () {
      tone(70, { to: 32, dur: 1.6, gain: 0.9 });
      noise({ type: 'lowpass', freq: 600, to: 80, dur: 1.4, gain: 0.5 });
      [233, 247, 349].forEach(function (f) { tone(f, { type: 'sawtooth', dur: 1.8, gain: 0.05, attack: 0.03, filter: { freq: 900 } }); });
    },
    gunshot: function () {
      noise({ type: 'highpass', freq: 600, dur: 0.12, gain: 1 });
      tone(160, { to: 40, dur: 0.25, gain: 0.8 });
      noise({ type: 'lowpass', freq: 900, to: 200, dur: 0.9, gain: 0.25, delay: 0.05 });
    },
    flip: function () { noise({ freq: 600, to: 4000, q: 1.2, dur: 0.35, gain: 0.35 }); tone(300, { to: 900, dur: 0.3, gain: 0.08 }); },
    whoosh: function () { noise({ freq: 300, to: 2500, q: 0.8, dur: 0.6, gain: 0.3, attack: 0.15 }); },
    reveal: function (team) {
      var chord = team === 'mafia' ? [110, 130.8, 155.6, 233] : team === 'neutral' ? [123.5, 155.6, 185, 261.6] : [130.8, 164.8, 196, 261.6];
      chord.forEach(function (f, i) { tone(f, { type: 'triangle', dur: 2.4, gain: 0.12, delay: i * 0.08, attack: 0.04 }); tone(f * 2, { dur: 1.8, gain: 0.04, delay: i * 0.08 }); });
      tone(55, { dur: 2, gain: 0.3 });
    },
    vote: function () { tone(520, { to: 780, type: 'triangle', dur: 0.12, gain: 0.2 }); noise({ freq: 2500, q: 3, dur: 0.05, gain: 0.15 }); },
    select: function () { tone(660, { type: 'triangle', dur: 0.1, gain: 0.15 }); tone(990, { dur: 0.12, gain: 0.08, delay: 0.05 }); },
    scan: function () { tone(1400, { dur: 0.6, gain: 0.12 }); tone(1400, { dur: 0.4, gain: 0.06, delay: 0.35 }); tone(1400, { dur: 0.3, gain: 0.03, delay: 0.65 }); },
    heal: function () { [880, 1108, 1318, 1760].forEach(function (f, i) { tone(f, { dur: 0.5, gain: 0.07, delay: i * 0.07 }); }); },
    shield: function () { tone(220, { to: 440, type: 'sawtooth', dur: 0.4, gain: 0.1, filter: { freq: 1200 } }); tone(660, { dur: 0.8, gain: 0.08, delay: 0.2 }); },
    stab: function () { noise({ type: 'highpass', freq: 2500, dur: 0.15, gain: 0.5 }); tone(90, { to: 40, dur: 0.4, gain: 0.5 }); },
    whisper: function () { noise({ freq: 2600, q: 4, dur: 0.9, gain: 0.08, attack: 0.3 }); },
    mystic: function () { [523, 659, 784, 1046, 784].forEach(function (f, i) { tone(f, { dur: 0.9, gain: 0.05, delay: i * 0.12, detune: 8 }); }); },
    silence: function () { tone(300, { to: 60, dur: 0.6, gain: 0.25, type: 'square', filter: { freq: 800 } }); },
    frame: function () { noise({ freq: 5000, q: 2, dur: 0.06, gain: 0.4 }); tone(1200, { dur: 0.4, gain: 0.05, delay: 0.05 }); },
    chat: function () { tone(1320, { dur: 0.05, gain: 0.04 }); },
    victory: function () {
      [261.6, 329.6, 392, 523.3, 659.3, 784].forEach(function (f, i) { tone(f, { type: 'triangle', dur: 0.9, gain: 0.14, delay: i * 0.12 }); });
      [523.3, 659.3, 784].forEach(function (f) { tone(f, { type: 'triangle', dur: 2.6, gain: 0.08, delay: 0.85, attack: 0.05 }); });
    },
    defeat: function () { [392, 349.2, 311.1, 233.1].forEach(function (f, i) { tone(f, { type: 'sawtooth', dur: 1.1, gain: 0.08, delay: i * 0.35, filter: { freq: 1200 } }); }); tone(58, { dur: 3, gain: 0.35, delay: 1 }); },
    jester: function () { [523, 622, 523, 784, 740, 698].forEach(function (f, i) { tone(f, { type: 'square', dur: 0.12, gain: 0.06, delay: i * 0.1, filter: { freq: 2500 } }); }); },
    error: function () { tone(180, { type: 'square', dur: 0.15, gain: 0.08, filter: { freq: 900 } }); }
  };

  function heartbeatOnce(level) {
    var g = 0.35 + level * 0.25;
    tone(62, { to: 38, dur: 0.16, gain: g });
    tone(58, { to: 36, dur: 0.2, gain: g * 0.75, delay: 0.2 });
  }

  // ── ambience beds ──
  function stopAmbience() {
    var t = ctx.currentTime;
    amb.nodes.forEach(function (n) {
      try { if (n.gain) { n.gain.cancelScheduledValues(t); n.gain.setValueAtTime(n.gain.value, t); n.gain.linearRampToValueAtTime(0, t + 1.5); } } catch (e) { /* node gone */ }
    });
    var old = amb.nodes;
    setTimeout(function () { old.forEach(function (n) { try { if (n.stop) n.stop(); n.disconnect(); } catch (e) { /* already stopped */ } }); }, 1700);
    amb.timers.forEach(clearInterval); amb.timers.forEach(clearTimeout);
    amb.nodes = []; amb.timers = [];
  }
  function bedGain(target) {
    var g = ctx.createGain(); g.gain.value = 0; g.connect(ambBus);
    g.gain.linearRampToValueAtTime(target, ctx.currentTime + 2.5);
    amb.nodes.push(g);
    return g;
  }
  function loopNoise(out, type, freq, q) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
    s.connect(f); f.connect(out); s.start();
    amb.nodes.push(s);
    return f;
  }
  function drone(out, freqs, type, cutoff) {
    freqs.forEach(function (fr, i) {
      var o = ctx.createOscillator(); o.type = type || 'sawtooth'; o.frequency.value = fr; o.detune.value = (i % 2 ? 7 : -7);
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff || 220;
      o.connect(f); f.connect(out); o.start(); amb.nodes.push(o);
    });
  }
  function lfo(param, rate, depth) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = rate; g.gain.value = depth;
    o.connect(g); g.connect(param); o.start(); amb.nodes.push(o);
  }
  function every(minMs, maxMs, fn) {
    var loop = function () { var h = setTimeout(function () { if (!muted) fn(); loop(); }, minMs + Math.random() * (maxMs - minMs)); amb.timers.push(h); };
    loop();
  }

  var BEDS = {
    lobby: function () {
      var g = bedGain(0.5);
      loopNoise(g, 'highpass', 4000, 0.5).frequency.value = 5000; // vinyl hiss
      every(80, 400, function () { noise({ type: 'highpass', freq: 3000, dur: 0.01, gain: 0.05 + Math.random() * 0.08, bus: ambBus }); }); // crackle
      // slow walking bass in D minor
      var notes = [73.4, 87.3, 98, 110, 116.5, 98, 87.3, 82.4];
      var i = 0;
      every(820, 900, function () { tone(notes[i++ % notes.length], { type: 'triangle', dur: 0.7, gain: 0.22, bus: ambBus, filter: { freq: 500 } }); });
      every(6000, 11000, function () { [293.7, 349.2, 440, 523.3].forEach(function (f, k) { tone(f, { dur: 2.5, gain: 0.025, delay: k * 0.03, bus: ambBus }); }); });
    },
    night: function () {
      var g = bedGain(0.6);
      var wind = loopNoise(g, 'lowpass', 400, 0.9);
      lfo(wind.frequency, 0.07, 250);
      var dg = ctx.createGain(); dg.gain.value = 0.18; dg.connect(g); amb.nodes.push(dg);
      drone(dg, [55, 55.4, 82.4], 'sawtooth', 180);
      every(5000, 11000, function () { SFX.whisper(); });
      every(14000, 26000, function () { tone(410, { to: 360, dur: 0.35, gain: 0.05, bus: ambBus }); tone(380, { to: 330, dur: 0.5, gain: 0.05, delay: 0.5, bus: ambBus }); }); // owl
      every(9000, 20000, function () { tone(1200 + Math.random() * 600, { dur: 0.05, gain: 0.015, bus: ambBus }); }); // crickets
    },
    day: function () {
      var g = bedGain(0.4);
      loopNoise(g, 'lowpass', 900, 0.5);
      var pad = ctx.createGain(); pad.gain.value = 0.05; pad.connect(g); amb.nodes.push(pad);
      drone(pad, [130.8, 196, 261.6, 329.6], 'triangle', 900);
      every(3000, 9000, function () { var f = 2500 + Math.random() * 1500; tone(f, { to: f * 1.4, dur: 0.08, gain: 0.03, bus: ambBus }); tone(f * 1.1, { to: f * 1.5, dur: 0.07, gain: 0.025, delay: 0.12, bus: ambBus }); });
    },
    trial: function () {
      var g = bedGain(0.6);
      var dg = ctx.createGain(); dg.gain.value = 0.22; dg.connect(g); amb.nodes.push(dg);
      drone(dg, [41.2, 61.7, 43.6], 'sawtooth', 260);
      lfo(dg.gain, 0.5, 0.1);
      every(2600, 2600, function () { tone(98, { to: 92, dur: 1.2, gain: 0.08, bus: ambBus, type: 'triangle' }); });
    },
    end: function () {
      var g = bedGain(0.35);
      var pad = ctx.createGain(); pad.gain.value = 0.06; pad.connect(g); amb.nodes.push(pad);
      drone(pad, [146.8, 220, 293.7, 349.2], 'triangle', 1200);
    }
  };

  var API = {
    get muted() { return muted; },
    unlock: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (amb.pending) { var m = amb.pending; amb.pending = null; API.ambience(m); }
    },
    setMuted: function (m) {
      muted = !!m;
      try { localStorage.setItem('hub.mafia.muted', muted ? '1' : '0'); } catch (e) { /* storage blocked */ }
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.1);
    },
    play: function (name, arg) {
      if (muted || !ensure() || ctx.state !== 'running' || !SFX[name]) return;
      try { SFX[name](arg); } catch (e) { /* audio is best-effort */ }
    },
    ambience: function (mode) {
      if (!ensure()) return;
      if (ctx.state !== 'running') { amb.pending = mode; return; }
      if (amb.mode === mode) return;
      stopAmbience();
      amb.mode = mode;
      if (mode && BEDS[mode]) { try { BEDS[mode](); } catch (e) { /* best-effort */ } }
    },
    /** 0 = off, 1 = tense, 2 = you are in danger */
    heartbeat: function (level) {
      if (heart.level === level) return;
      heart.level = level;
      clearInterval(heart.timer); heart.timer = null;
      if (!level) return;
      var beat = function () { if (!muted && ctx && ctx.state === 'running') heartbeatOnce(level); };
      beat();
      heart.timer = setInterval(beat, level === 2 ? 720 : 1050);
    }
  };
  global.MafiaAudio = API;
})(window);
