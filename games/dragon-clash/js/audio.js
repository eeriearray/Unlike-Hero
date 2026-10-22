/*
 * Dragon Clash — audio.
 * Recorded effects and announcer lines (assets/sfx, built by tools/build_sfx.py from the local sound packs) play
 * through WebAudio with variant rotation, slight pitch variation and stereo position. Where a sample is missing or
 * cannot load (file:// pages block fetching audio), the original synthesised sound plays instead.
 * Separate music, effects and announcer volumes. Starts on the first user gesture, as browsers require.
 */
(function () {
  'use strict';
  var ctx = null, sfxGain = null, musicGain = null, voiceGain = null, uiGain = null, master = null, noiseBuf = null;
  var vols = { music: 0.35, sfx: 0.8, voice: 0.85, ui: 0.7 };
  var intensity = 0;
  // Announcer captions (subtitles): shown by the match when the setting is on
  var CAPTIONS = { vFight: 'FIGHT!', vKO: 'K.O.!', vKnockout: 'KNOCKOUT!', vFrenzy: 'KILLING FRENZY!', vDeathMatch: 'DEATH MATCH!', vVictor: 'VICTOR!',
                   vGameOver: 'GAME OVER', vChampion: 'Select your champion', vFury: 'Embrace the fury!', vSuddenDeath: 'SUDDEN DEATH!' };
  var UI_SOUNDS = { ui: 1, uiBack: 1, select: 1, count: 1, go: 1, vsSlam: 1 };
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
    uiGain = ctx.createGain(); uiGain.gain.value = vols.ui; uiGain.connect(comp);
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
    if (v.ui != null) vols.ui = v.ui;
    if (uiGain) uiGain.gain.value = vols.ui;
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
    node.connect(o.voice ? voiceGain : o.bus || sfxGain);
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
    if (api.onCaption && CAPTIONS[ev]) api.onCaption(CAPTIONS[ev], meta ? meta.dur : 1.5);
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

  // Layers that make contact feel physical: a sharp transient, a low body thump, a material ring, a creature growl.
  function transient(v, dest) { noise(0.025, 0.5 * v, 'highpass', 3500, 6000, 0.7, dest); }
  function thump(v, f0, dest) { tone('sine', f0 || 110, 38, 0.22, 0.7 * v, dest); }
  function growl(v, len, dest) {
    var p = 0.85 + Math.random() * 0.3;
    tone('sawtooth', 150 * p, 90 * p, len || 0.18, 0.09 * v, dest); noise(len || 0.18, 0.12 * v, 'lowpass', 700, 300, 1.5, dest);
  }

  function play(id, opt) {
    if (!ctx) return;
    var bus = UI_SOUNDS[id] ? uiGain : sfxGain;
    if ((bus === uiGain ? vols.ui : vols.sfx) <= 0) return;
    opt = opt || {};
    var v = opt.vol || 1;
    var so = { vol: v, pan: opt.pan, bus: bus };
    if (id === 'hit') {
      var kb = opt.kb || 5, str = opt.strength || (kb > 18 ? 'heavy' : kb > 10 ? 'medium' : 'light');
      // Recorded impact by strength, then synthesised layers for weight; counter hits add a bright crack
      var ev = str === 'super' ? 'hitHuge' : str === 'heavy' ? (kb > 18 ? 'hitHuge' : 'hitHeavy') : str === 'medium' ? 'hitHeavy' : 'hitLight';
      var hit = sample(ev, { vol: v * (str === 'light' ? 0.85 : 1), pan: opt.pan, rate: str === 'medium' ? 1.08 : kb > 14 ? 0.92 : 1 });
      if (opt.element && ELEM_EV[opt.element]) sample(ELEM_EV[opt.element], { vol: v * 0.75, pan: opt.pan });
      transient(v * (str === 'light' ? 0.5 : 0.8));
      if (str !== 'light') thump(v * (str === 'medium' ? 0.5 : 1), str === 'super' ? 80 : 110);
      if (str === 'heavy' || str === 'super') growl(v * 0.8);
      if (opt.counter) { tone('square', 1900, 1400, 0.08, 0.06 * v); tone('triangle', 2600, 2000, 0.16, 0.08 * v, null, 0.02); }
      if (hit) return;
    } else if (id === 'block') {
      transient(v * 0.6); tone('triangle', opt.heavy ? 620 : 880, opt.heavy ? 480 : 700, 0.12, 0.16 * v); noise(0.09, 0.25 * v, 'bandpass', 2600, 1800, 3);
      if (opt.heavy) thump(v * 0.5, 90);
      return;
    } else if (id === 'parry') {
      tone('sine', 1760, 1760, 0.45, 0.16 * v); tone('sine', 2637, 2637, 0.35, 0.1 * v, null, 0.03); noise(0.3, 0.15 * v, 'highpass', 6000, 9000, 1, null, 0.02);
      transient(v);
      return;
    } else if (id === 'guardBreak') {
      if (!sample('shatter', so)) noise(0.4, 0.4 * v, 'highpass', 3000, 7000, 1);
      thump(v, 70); tone('sawtooth', 300, 80, 0.4, 0.1 * v);
      return;
    } else if (id === 'grab') { noise(0.08, 0.2 * v, 'bandpass', 900, 500, 1.2); thump(v * 0.4, 140); return; }
    else if (id === 'throw') { sample('swingHeavy', so); growl(v * 0.7, 0.25); return; }
    else if (id === 'throwBreak') { transient(v); tone('triangle', 1200, 900, 0.1, 0.12 * v); tone('triangle', 900, 1200, 0.1, 0.1 * v, null, 0.06); return; }
    else if (id === 'wallsplat') { thump(v, 70); noise(0.5, 0.3 * v, 'lowpass', 1200, 200, 1); sample('hitHeavy', { vol: v * 0.7, pan: opt.pan, rate: 0.8 }); return; }
    else if (id === 'tech') { noise(0.1, 0.18 * v, 'highpass', 2500, 5000, 1); tone('triangle', 700, 1100, 0.08, 0.08 * v); return; }
    else if (id === 'taunt') { growl(v * 1.3, 0.6); if (opt.element && ELEM_EV[opt.element]) sample(ELEM_EV[opt.element], { vol: v * 0.5, pan: opt.pan }); return; }
    else if (id === 'super') {
      // A rising roar under the cinematic: low drone sweeping up, noise swelling, a growl on top
      tone('sawtooth', 70, 420, 0.8, 0.14 * v); noise(0.8, 0.3 * v, 'bandpass', 300, 3000, 1.2); growl(v * 1.4, 0.7); thump(v, 60);
      return;
    } else if (id === 'crowd') {
      // A stadium roar: broad noise swelling and fading, with a few whistles
      noise(2.6, 0.22 * v, 'bandpass', 700, 1100, 0.6); noise(2.2, 0.12 * v, 'lowpass', 500, 300, 0.7, null, 0.15);
      tone('sine', 1800, 2400, 0.3, 0.03 * v, null, 0.4); tone('sine', 2100, 1600, 0.35, 0.025 * v, null, 0.9);
      return;
    } else if (id === 'vsSlam') { thump(v, 70); noise(0.5, 0.35 * v, 'lowpass', 2000, 100, 0.8, uiGain); tone('sawtooth', 110, 55, 0.5, 0.12 * v, uiGain); return; }
    else if (id === 'cast') { if (sample(CAST_EV[opt.element], so)) return; }
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
      case 'ui': tone('triangle', 700, 900, 0.05, 0.12 * v, uiGain); break;
      case 'uiBack': tone('triangle', 600, 400, 0.06, 0.1 * v, uiGain); break;
      case 'select': tone('triangle', 520, 0, 0.06, 0.12 * v, uiGain); tone('triangle', 780, 0, 0.1, 0.12 * v, uiGain, 0.06); break;
      case 'count': tone('square', 440, 0, 0.12, 0.12 * v, uiGain); break;
      case 'go': tone('square', 880, 0, 0.3, 0.16 * v, uiGain); tone('sawtooth', 220, 0, 0.3, 0.1 * v, uiGain); break;
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
    // Dynamic intensity: last stocks and high damage bring in 16th hats, a driving arpeggio and a heavier kick
    if (intensity > 0.4) {
      noise(0.025, 0.04 * intensity, 'highpass', 8000, 10000, 1, musicGain);
      if (step % 2 === 1) tone('square', hz(root + 12 + SCALE[(step >> 1) % 5]), 0, 0.08, 0.025 * intensity, musicGain);
    }
    if (intensity > 0.75 && step % 8 === 6) tone('sine', 120, 40, 0.2, 0.35, musicGain);
  }

  function music(on) {
    if (on === musicOn) return;
    musicOn = on;
    clearInterval(musicTimer);
    if (on) { musicStep = 0; musicTimer = setInterval(musicTick, 125); }
  }

  /** Music intensity, 0..1: the match raises it as stocks run low and damage climbs. */
  function setIntensity(k) { intensity = Math.max(0, Math.min(1, k || 0)); }

  var api = window.DCAudio = { init: init, play: play, voice: voice, hasSamples: function () { return Object.keys(buffers).some(function (k) { return buffers[k].some(Boolean); }); }, music: music, setVolumes: setVolumes, vols: vols,
                               setIntensity: setIntensity, onCaption: null };
})();
