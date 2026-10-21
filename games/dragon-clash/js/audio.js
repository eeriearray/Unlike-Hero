/*
 * Dragon Clash — audio.
 * Recorded effects and announcer lines (assets/sfx, built by tools/build_sfx.py from the local sound packs) play
 * through WebAudio with variant rotation, slight pitch variation and stereo position. Where a sample is missing or
 * cannot load (file:// pages block fetching audio), the original synthesised sound plays instead.
 * Separate music, effects and announcer volumes. Starts on the first user gesture, as browsers require.
 */
(function () {
  'use strict';
  var ctx = null, sfxGain = null, musicGain = null, voiceGain = null, master = null, noiseBuf = null;
  var vols = { music: 0.35, sfx: 0.8, voice: 0.85 };
  var SFX = window.DC_SFX || {}, buffers = {}, lastVariant = {}, loading = false;
  var musicTimer = null, musicStep = 0, musicOn = false;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = vols.sfx; sfxGain.connect(comp);
    musicGain = ctx.createGain(); musicGain.gain.value = vols.music; musicGain.connect(comp);
    voiceGain = ctx.createGain(); voiceGain.gain.value = vols.voice; voiceGain.connect(master);
    loadSamples();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function setVolumes(v) {
    if (v.music != null) vols.music = v.music;
    if (v.sfx != null) vols.sfx = v.sfx;
    if (v.voice != null) vols.voice = v.voice;
    if (sfxGain) sfxGain.gain.value = vols.sfx;
    if (voiceGain) voiceGain.gain.value = vols.voice;
    if (musicGain) musicGain.gain.value = vols.music;
  }

  // ─────────────── recorded samples ───────────────
  function loadSamples() {
    if (loading || !ctx || location.protocol === 'file:') return;
    loading = true;
    Object.keys(SFX).forEach(function (ev) {
      buffers[ev] = [];
      SFX[ev].forEach(function (s, i) {
        fetch('assets/sfx/' + s.file).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
          .then(function (ab) { return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); }); })
          .then(function (buf) { buffers[ev][i] = buf; })
          .catch(function () { /* this variant stays unavailable; the synth covers it */ });
      });
    });
  }

  /** Play a recorded sound. Returns false when none is loaded, so callers can fall back to the synth. */
  function sample(ev, o) {
    var list = buffers[ev] && buffers[ev].filter(Boolean);
    if (!ctx || !list || !list.length) return false;
    o = o || {};
    var k = Math.floor(Math.random() * list.length);
    if (list.length > 1 && k === lastVariant[ev]) k = (k + 1) % list.length;   // never the same variant twice running
    lastVariant[ev] = k;
    var src = ctx.createBufferSource(); src.buffer = list[k];
    var spread = o.voice ? 0 : (o.pitch != null ? o.pitch : 0.06);
    src.playbackRate.value = (o.rate || 1) * (1 + (Math.random() * 2 - 1) * spread);
    var g = ctx.createGain(); g.gain.value = o.vol != null ? o.vol : 1;
    var node = src;
    node.connect(g); node = g;
    if (ctx.createStereoPanner && o.pan) { var pn = ctx.createStereoPanner(); pn.pan.value = Math.max(-0.8, Math.min(0.8, o.pan)); node.connect(pn); node = pn; }
    node.connect(o.voice ? voiceGain : sfxGain);
    src.start(ctx.currentTime + (o.delay || 0));
    return true;
  }

  var voiceBusyUntil = 0;
  /** Announcer line. Lines never talk over each other; a line that would overlap is dropped. */
  function voice(ev, o) {
    if (!ctx || vols.voice <= 0) return false;
    var now = ctx.currentTime;
    if (now < voiceBusyUntil && !(o && o.force)) return false;
    var meta = SFX[ev] && SFX[ev][0];
    if (!sample(ev, { voice: true, delay: o && o.delay })) return false;
    voiceBusyUntil = now + (o && o.delay || 0) + (meta ? meta.dur * 0.85 : 1.5);
    return true;
  }

  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function tone(type, f0, f1, dur, vol, dest, delay) {
    var t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, filterType, f0, f1, q, dest, delay) {
    var t = ctx.currentTime + (delay || 0);
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var f = ctx.createBiquadFilter(); f.type = filterType || 'lowpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    var g = ctx.createGain(); env(g, t, 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxGain);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  var ELEMENT_SFX = {
    fire: function (v) { noise(0.45, 0.5 * v, 'bandpass', 900, 300, 0.8); tone('sawtooth', 160, 70, 0.3, 0.12 * v); },
    ice: function (v) { tone('sine', 1800, 2600, 0.18, 0.14 * v); tone('triangle', 2400, 1200, 0.25, 0.08 * v, null, 0.04); noise(0.12, 0.2 * v, 'highpass', 5000, 7000, 1); },
    lightning: function (v) { tone('square', 900, 120, 0.12, 0.12 * v); noise(0.2, 0.4 * v, 'highpass', 2500, 900, 0.7); tone('sawtooth', 60, 50, 0.15, 0.1 * v, null, 0.02); },
    earth: function (v) { tone('sine', 110, 40, 0.4, 0.45 * v); noise(0.35, 0.4 * v, 'lowpass', 500, 120, 1); },
    water: function (v) { noise(0.4, 0.4 * v, 'bandpass', 600, 2400, 2); tone('sine', 500, 900, 0.12, 0.08 * v, null, 0.05); },
  };

  var ELEM_EV = { fire: 'elemFire', ice: 'elemIce', lightning: 'elemLightning', earth: 'elemEarth', water: 'elemWater' };
  var CAST_EV = { fire: 'castFire', ice: 'castIce', lightning: 'castLightning', earth: 'castEarth', water: 'castWater' };
  var SAMPLE_FOR = { whoosh: 'swingLight', heavyWhoosh: 'swingHeavy', jump: 'jump', flap: 'airJump', land: 'land', dodge: 'dodge', ledge: 'ledge',
                     denied: 'denied', rule: 'rule', break: 'shatter', ui: 'ui', uiBack: 'uiBack', select: 'select', count: 'count',
                     step: 'step', charge: 'charge', respawn: 'respawn', buff: 'buff', clash: 'clash' };

  function play(id, opt) {
    if (!ctx || vols.sfx <= 0) return;
    opt = opt || {};
    var v = opt.vol || 1;
    var so = { vol: v, pan: opt.pan };
    if (id === 'hit') {
      var kb = opt.kb || 5;
      var hit = sample(kb > 18 ? 'hitHuge' : kb > 10 ? 'hitHeavy' : 'hitLight', { vol: v * (kb > 18 ? 1 : 0.9), pan: opt.pan, rate: kb > 14 ? 0.92 : 1 });
      if (opt.element && ELEM_EV[opt.element]) sample(ELEM_EV[opt.element], { vol: v * 0.75, pan: opt.pan });
      if (hit) return;
    } else if (id === 'cast') { if (sample(CAST_EV[opt.element], so)) return; }
    else if (id === 'ko') { if (sample('koBoom', so)) return; }
    else if (id === 'go') { voice('vFight', { force: true }); if (buffers.vFight && buffers.vFight.some(Boolean)) return; }
    else if (id === 'victory') { if (voice('vVictor', { force: true, delay: 0.2 })) return; }
    else if (id === 'defeat') { if (voice('vGameOver', { force: true, delay: 0.2 })) return; }
    else if (SAMPLE_FOR[id] && sample(SAMPLE_FOR[id], so)) return;
    if (id === 'step' || id === 'charge' || id === 'respawn' || id === 'buff' || id === 'clash') return;   // no synth version
    switch (id) {
      case 'hit': {
        var kb = opt.kb || 5;
        var heavy = kb > 12;
        tone('sine', heavy ? 140 : 220, 50, heavy ? 0.25 : 0.12, (heavy ? 0.6 : 0.35) * v);
        noise(heavy ? 0.22 : 0.1, (heavy ? 0.55 : 0.35) * v, 'lowpass', heavy ? 2200 : 3500, 400, 0.8);
        if (opt.element && ELEMENT_SFX[opt.element]) ELEMENT_SFX[opt.element](0.6 * v);
        break;
      }
      case 'whoosh': noise(0.16, 0.18 * v, 'bandpass', 600, 2400, 1.4); break;
      case 'heavyWhoosh': noise(0.28, 0.26 * v, 'bandpass', 300, 1800, 1.2); break;
      case 'cast': if (ELEMENT_SFX[opt.element]) ELEMENT_SFX[opt.element](0.8 * v); break;
      case 'jump': noise(0.12, 0.15 * v, 'bandpass', 900, 400, 1); break;
      case 'flap': noise(0.18, 0.22 * v, 'lowpass', 900, 200, 1); tone('sine', 180, 90, 0.12, 0.08 * v); break;
      case 'land': tone('sine', 120, 60, 0.1, 0.15 * v); break;
      case 'dodge': noise(0.14, 0.12 * v, 'highpass', 2000, 5000, 1); break;
      case 'ko':
        tone('sawtooth', 300, 40, 0.8, 0.3 * v); noise(0.9, 0.6 * v, 'lowpass', 3000, 100, 0.8); tone('sine', 80, 30, 0.9, 0.5 * v);
        break;
      case 'ledge': tone('triangle', 400, 300, 0.06, 0.1 * v); break;
      case 'denied': tone('square', 160, 120, 0.08, 0.06 * v); break;
      case 'rule': tone('triangle', 1200, 1600, 0.1, 0.12 * v); tone('triangle', 1600, 2000, 0.1, 0.1 * v, null, 0.07); break;
      case 'break': noise(0.3, 0.35 * v, 'highpass', 3000, 6000, 1); tone('sine', 2200, 900, 0.2, 0.08 * v); break;
      case 'ui': tone('triangle', 700, 900, 0.05, 0.12 * v); break;
      case 'uiBack': tone('triangle', 600, 400, 0.06, 0.1 * v); break;
      case 'select': tone('triangle', 520, 0, 0.06, 0.12 * v); tone('triangle', 780, 0, 0.1, 0.12 * v, null, 0.06); break;
      case 'count': tone('square', 440, 0, 0.12, 0.12 * v); break;
      case 'go': tone('square', 880, 0, 0.3, 0.16 * v); tone('sawtooth', 220, 0, 0.3, 0.1 * v); break;
      case 'victory':
        [523, 659, 784, 1046].forEach(function (f, i) { tone('triangle', f, 0, 0.35, 0.16 * v, null, i * 0.12); tone('square', f / 2, 0, 0.25, 0.05 * v, null, i * 0.12); });
        tone('triangle', 1318, 0, 0.8, 0.14 * v, null, 0.5);
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach(function (f, i) { tone('triangle', f, f * 0.98, 0.4, 0.14 * v, null, i * 0.18); });
        break;
    }
  }

  // A small procedural battle loop: bass, drums and a pentatonic lead.
  var SCALE = [0, 3, 5, 7, 10];
  function musicTick() {
    if (!ctx || !musicOn) return;
    var s = musicStep++;
    var bar = Math.floor(s / 16) % 4, step = s % 16;
    var root = [45, 45, 41, 43][bar];
    var hz = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
    if (step % 4 === 0) { tone('sine', 150, 45, 0.18, 0.5, musicGain); }
    if (step % 8 === 4) noise(0.12, 0.22, 'bandpass', 1800, 900, 0.8, musicGain);
    if (step % 2 === 1) noise(0.03, 0.06, 'highpass', 7000, 9000, 1, musicGain);
    if (step % 2 === 0) tone('sawtooth', hz(root - 12 + (step % 8 === 6 ? 7 : 0)), 0, 0.14, 0.07, musicGain);
    if ([0, 3, 6, 10, 12].indexOf(step) >= 0 && (bar + step) % 3 !== 2) {
      var n = root + 12 + SCALE[(step + bar * 2) % 5] + (step > 8 ? 12 : 0);
      tone('triangle', hz(n), 0, 0.2, 0.06, musicGain);
    }
  }

  function music(on) {
    if (on === musicOn) return;
    musicOn = on;
    clearInterval(musicTimer);
    if (on) { musicStep = 0; musicTimer = setInterval(musicTick, 125); }
  }

  window.DCAudio = { init: init, play: play, voice: voice, hasSamples: function () { return Object.keys(buffers).some(function (k) { return buffers[k].some(Boolean); }); }, music: music, setVolumes: setVolumes, vols: vols };
})();
