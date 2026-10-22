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

  // ─────────────── music ───────────────
  // Arranged battle themes, scheduled ahead on the audio clock so the groove stays tight, and mixed through their own
  // hall reverb and dotted-eighth echo: taiko and kit drums, a filtered bass, a detuned string pad, an echoing
  // arpeggio and a brass lead. Layers come in with intensity (see setIntensity). Each match starts on the next theme
  // and a long match moves on to another after two times through, so the music does not wear thin.
  var LOOKAHEAD = 0.2, LOOPS_PER_TRACK = 2;
  var musicTimer = null, musicStep = 0, musicOn = false, nextT = 0, mus = null;
  /*
   * A theme: tempo, chords (midi triads), the 16-bar song, the lead's theme over the first eight bars in two-bar
   * phrases ([16th within the phrase, midi note, length in 16ths]), and per-intensity patterns (16ths of the bar)
   * for kick, snare and bass. bassUp are the bass steps that jump an octave.
   */
  var TRACKS = [
    { name: 'Skyfire', bpm: 132,
      chords: { Dm: [50, 53, 57], Bb: [46, 50, 53], F: [53, 57, 60], C: [48, 52, 55], Gm: [55, 58, 62], A: [45, 49, 52] },
      song: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'Bb', 'A', 'A'],
      motif: [[[0, 74, 6], [6, 77, 2], [8, 76, 4], [12, 74, 2], [14, 72, 2], [16, 70, 8], [24, 69, 4], [28, 65, 4]],
              [[0, 72, 6], [6, 69, 2], [8, 72, 4], [12, 77, 4], [16, 76, 8], [24, 74, 4], [28, 72, 4]]],
      kick: [[0, 10], [0, 7, 10], [0, 3, 7, 10, 14]], snare: [[4, 12], [4, 12, 15]], bass: [[0, 6, 8, 14], [0, 2, 3, 6, 8, 10, 11, 14]], bassUp: [3, 11],
      taiko: 1, padCut: 1200, lead: { wave: 'sawtooth', cut: 1600 } },
    // Fast and driving in E minor, four on the floor, an octave-bouncing bass and a Phrygian turn to F
    { name: 'Stormcrown', bpm: 150,
      chords: { Em: [52, 55, 59], C: [48, 52, 55], D: [50, 54, 57], F: [53, 57, 60], Am: [57, 60, 64], B: [47, 51, 54] },
      song: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'F', 'Em', 'Am', 'C', 'D', 'B', 'Em', 'C', 'D', 'B'],
      motif: [[[0, 76, 3], [3, 79, 3], [6, 78, 2], [8, 76, 4], [12, 74, 4], [16, 72, 6], [22, 74, 2], [24, 71, 8]],
              [[0, 76, 3], [3, 79, 3], [6, 81, 2], [8, 83, 6], [14, 81, 2], [16, 77, 8], [24, 76, 8]]],
      kick: [[0, 8], [0, 4, 8, 12], [0, 4, 8, 10, 12, 14]], snare: [[4, 12], [4, 12, 13, 15]], bass: [[0, 8], [0, 2, 4, 6, 8, 10, 12, 14]], bassUp: [2, 6, 10, 14],
      taiko: 0.6, padCut: 1500, lead: { wave: 'square', cut: 2000 } },
    // Slow and heavy in C minor: half-time snare, long bass notes, deep taiko and a darker pad
    { name: 'Ashen Throne', bpm: 108,
      chords: { Cm: [48, 51, 55], Ab: [44, 48, 51], Eb: [51, 55, 58], Bb: [46, 50, 53], Fm: [53, 56, 60], G: [43, 47, 50] },
      song: ['Cm', 'Cm', 'Ab', 'Ab', 'Eb', 'Eb', 'Bb', 'Bb', 'Fm', 'Ab', 'Cm', 'Cm', 'Fm', 'Ab', 'G', 'G'],
      motif: [[[0, 72, 8], [8, 75, 4], [12, 74, 4], [16, 72, 4], [20, 70, 4], [24, 68, 8]],
              [[0, 67, 8], [8, 70, 4], [12, 72, 4], [16, 75, 8], [24, 74, 4], [28, 71, 4]]],
      kick: [[0], [0, 6, 10], [0, 3, 6, 10, 11]], snare: [[8], [8, 14]], bass: [[0], [0, 3, 6, 10]], bassUp: [6], bassLen: 3,
      taiko: 1.2, padCut: 950, lead: { wave: 'sawtooth', cut: 1200 } },
  ];
  var trackNo = Math.floor(Math.random() * TRACKS.length) - 1, T = TRACKS[0], SIXT = 60 / T.bpm / 4;
  function setTrack(i) {
    trackNo = (i + TRACKS.length) % TRACKS.length; T = TRACKS[trackNo]; SIXT = 60 / T.bpm / 4;
    if (mus) mus.dly.delayTime.setValueAtTime(SIXT * 3, ctx.currentTime);
  }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  /** Fold a note into [lo, lo+12). */
  function fold(m, lo) { while (m < lo) m += 12; while (m >= lo + 12) m -= 12; return m; }

  function musicBus() {
    if (mus) return mus;
    var input = ctx.createGain(), out = ctx.createGain();
    out.gain.value = 0;
    // Hall: an impulse of stereo noise decaying over 2.4 s, filtered so the tail stays warm
    var len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    var rev = ctx.createConvolver(); rev.buffer = ir;
    var revIn = ctx.createBiquadFilter(); revIn.type = 'lowpass'; revIn.frequency.value = 4200;
    var revOut = ctx.createGain(); revOut.gain.value = 0.34;
    revIn.connect(rev); rev.connect(revOut); revOut.connect(out);
    // Echo: dotted eighths, each repeat darker
    var dly = ctx.createDelay(1); dly.delayTime.value = SIXT * 3;
    var dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    var fb = ctx.createGain(), dOut = ctx.createGain(); fb.gain.value = 0.33; dOut.gain.value = 0.4;
    dly.connect(dlp); dlp.connect(fb); fb.connect(dly); dlp.connect(dOut); dOut.connect(out); dOut.connect(revIn);
    input.connect(out); out.connect(musicGain);
    return (mus = { input: input, rev: revIn, dly: dly, out: out });
  }

  /** Send a voice to the dry mix and, by the given amounts, into the reverb and the echo. */
  function route(node, rev, dly, pan) {
    if (pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    node.connect(mus.input);
    if (rev) { var r = ctx.createGain(); r.gain.value = rev; node.connect(r); r.connect(mus.rev); }
    if (dly) { var e = ctx.createGain(); e.gain.value = dly; node.connect(e); e.connect(mus.dly); }
  }

  /**
   * One synth note at time t: detuned oscillators through a low-pass whose cutoff opens by env and settles,
   * shaped either as a pluck (decays over its length) or a held note (attack, hold, release).
   */
  function synth(t, midi, dur, o) {
    var f = ctx.createBiquadFilter(), g = ctx.createGain(), a = o.a || 0.005, r = o.r || 0.08, end = t + dur + r;
    f.type = 'lowpass'; f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(o.cut * (o.env || 1), t); f.frequency.exponentialRampToValueAtTime(o.cut, t + (o.envT || 0.12));
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol, t + a);
    if (o.pluck) g.gain.exponentialRampToValueAtTime(0.0001, end);
    else { g.gain.setValueAtTime(o.vol, t + Math.max(a, dur)); g.gain.exponentialRampToValueAtTime(0.0001, end); }
    (o.det || [0]).forEach(function (dc) {
      var os = ctx.createOscillator(); os.type = o.wave || 'sawtooth'; os.frequency.value = hz(midi); os.detune.value = dc;
      os.connect(f); os.start(t); os.stop(end + 0.05);
    });
    f.connect(g); route(g, o.rev, o.dly, o.pan);
  }

  /** A pitched drum body: a sine falling from f0 to f1. */
  function drumTone(t, f0, f1, dur, vol, rev) {
    var os = ctx.createOscillator(), g = ctx.createGain();
    os.type = 'sine'; os.frequency.setValueAtTime(f0, t); os.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(g); route(g, rev); os.start(t); os.stop(t + dur + 0.05);
  }
  /** Filtered noise: snares, hats, cymbals, the skin of a drum. */
  function drumNoise(t, type, freq, q, dur, vol, rev, pan) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); route(g, rev, 0, pan); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function kick(t, v) { drumTone(t, 160, 44, 0.34, 0.9 * v); drumNoise(t, 'highpass', 3000, 0.7, 0.012, 0.25 * v); }
  function snare(t, v) { drumTone(t, 200, 150, 0.12, 0.35 * v, 0.2); drumNoise(t, 'bandpass', 1900, 0.6, 0.2, 0.55 * v, 0.3); }
  function hat(t, v, open) { drumNoise(t, 'highpass', 8200, 0.8, open ? 0.24 : 0.04, v, 0.08, 0.25); }
  function taiko(t, v, f) { drumTone(t, f, f * 0.55, 0.7, 0.85 * v, 0.45); drumNoise(t, 'lowpass', 500, 0.8, 0.09, 0.4 * v, 0.3); }
  function crash(t, v) { drumNoise(t, 'highpass', 5200, 0.5, 1.8, 0.22 * v, 0.4, -0.2); drumNoise(t, 'bandpass', 3200, 1.5, 0.9, 0.12 * v, 0.4, 0.2); }

  function playStep(s, t) {
    var step = s % 16, bar = Math.floor(s / 16) % T.song.length, ch = T.chords[T.song[bar]], k = intensity, mid = k > 0.35, hi = k > 0.7, lvl = hi ? 2 : mid ? 1 : 0;
    var bassRoot = fold(ch[0], 33), pad = ch.map(function (m) { return fold(m, 57); }).sort(function (a, b) { return a - b; });
    // Drums: taiko carries the opening; the kit fills in as the fight heats up
    if (step === 0 && bar % 8 === 0 && mid) crash(t, hi ? 1 : 0.7);
    var tk = Math.min(1, T.taiko), deep = T.taiko > 1 ? 0.8 : 1;
    if ((bar % 2 === 0 || T.taiko > 1) && step === 0) taiko(t, tk, 92 * deep);
    if (step === 8 && !hi) taiko(t, 0.6 * tk, 120 * deep);
    if (bar % 4 === 3 && step >= 8 && (hi ? [8, 10, 12, 13, 14, 15] : [12, 14]).indexOf(step) >= 0) taiko(t, (0.55 + (step - 8) * 0.05) * tk, (step % 2 ? 140 : 110) * deep);
    if (T.kick[lvl].indexOf(step) >= 0) kick(t, mid ? 1 : 0.7);
    if (mid && T.snare[0].indexOf(step) >= 0) snare(t, 1);
    else if (hi && T.snare[1].indexOf(step) >= 0) snare(t, 0.25);
    if (hi || step % 2 === 0) hat(t, (step % 4 === 2 ? 0.09 : 0.05) * (mid ? 1 : 0.6), mid && step === 14 && bar % 2 === 1);
    // Bass: a pulse on the root, galloping once the kit is in
    if (T.bass[mid ? 1 : 0].indexOf(step) >= 0) {
      var bn = bassRoot + (mid && T.bassUp.indexOf(step) >= 0 ? 12 : 0), bl = SIXT * 1.5 * (T.bassLen || 1);
      synth(t, bn, bl, { wave: 'sawtooth', det: [-6, 6], cut: 320, env: 3.5, envT: 0.1, q: 2, vol: 0.12, pluck: true, r: 0.1 });
      synth(t, bn - 12, bl, { wave: 'sine', cut: 400, vol: 0.16, pluck: true, r: 0.1 });
    }
    // Strings: the chord swells in on every bar
    if (step === 0) pad.forEach(function (m, i) { synth(t, m, SIXT * 15, { wave: 'sawtooth', det: [-11, 0, 9], cut: T.padCut * (mid ? 1.4 : 1), a: 0.5, r: 0.9, vol: mid ? 0.028 : 0.036, rev: 0.7, pan: (i - 1) * 0.35 }); });
    // Arpeggio: chord tones climbing an octave up, echoing across the stereo field
    if (mid && (hi || step % 2 === 0)) {
      var arp = [pad[0], pad[1], pad[2], pad[0] + 12, pad[2], pad[1]], an = arp[(step >> (hi ? 0 : 1)) % arp.length] + 12;
      synth(t, an, SIXT * 0.9, { wave: 'square', cut: 2200, env: 2, q: 1, vol: 0.02, pluck: true, r: 0.12, dly: 0.6, rev: 0.25, pan: step % 4 < 2 ? -0.35 : 0.35 });
    }
    // Lead: the theme over the first half, chord tones answering it in the second
    if (k > 0.55) {
      var lead = { wave: T.lead.wave, det: [-7, 7], cut: T.lead.cut, env: 2.4, envT: 0.18, q: 1.2, a: 0.03, r: 0.3, vol: 0.04, rev: 0.45, dly: 0.25 };
      if (bar < 8) T.motif[Math.floor(bar / 2) % 2].forEach(function (n) { if (n[0] === (bar % 2) * 16 + step) synth(t, n[1], SIXT * n[2] * 0.92, lead); });
      else if (step === 0 || step === 6 || step === 8) synth(t, fold(ch[step === 0 ? 2 : step === 6 ? 0 : 1], 69), SIXT * (step === 6 ? 2 : 6) * 0.92, lead);
    }
  }

  function schedule() {
    if (!ctx || !musicOn || ctx.state !== 'running') return;
    musicBus();
    var now = ctx.currentTime;
    if (!nextT) { nextT = now + 0.05; mus.out.gain.cancelScheduledValues(now); mus.out.gain.setValueAtTime(0.0001, now); mus.out.gain.exponentialRampToValueAtTime(1, now + 1.5); }
    // Back from a background tab: rejoin on the beat instead of rushing out the missed steps
    while (nextT < now) { nextT += SIXT; musicStep++; }
    while (nextT < now + LOOKAHEAD) {
      // Two times through the song, then on to the next theme, which opens on a taiko hit
      if (musicStep >= T.song.length * 16 * LOOPS_PER_TRACK) { setTrack(trackNo + 1); musicStep = 0; }
      playStep(musicStep++, nextT); nextT += SIXT;
    }
  }

  function music(on) {
    if (on === musicOn) return;
    musicOn = on;
    clearInterval(musicTimer);
    if (on) { setTrack(trackNo + 1); musicStep = 0; nextT = 0; musicTimer = setInterval(schedule, 25); schedule(); return; }
    // Fade the tail out rather than cutting notes off mid-swell
    if (ctx && mus) { var now = ctx.currentTime; mus.out.gain.cancelScheduledValues(now); mus.out.gain.setValueAtTime(mus.out.gain.value, now); mus.out.gain.linearRampToValueAtTime(0, now + 0.8); }
  }

  /** Music intensity, 0..1: the match raises it as stocks run low and damage climbs. */
  function setIntensity(k) { intensity = Math.max(0, Math.min(1, k || 0)); }

  var api = window.DCAudio = { init: init, play: play, voice: voice, hasSamples: function () { return Object.keys(buffers).some(function (k) { return buffers[k].some(Boolean); }); }, music: music, setVolumes: setVolumes, vols: vols,
                               setIntensity: setIntensity, onCaption: null };
})();
