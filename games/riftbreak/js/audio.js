/* RIFTBREAK — central audio manager. Everything is synthesized with the Web Audio API (no files to load).
   Sound identity: tactile card noise (filtered noise transients) + clean digital tones + a shared plate reverb.
   Music: a step sequencer at 98 BPM in D Dorian with three layers that crossfade with the Meltdown stage:
     calm     — soft pad, round sub bass, brushed off-beat ticks          (always, also on the title screen)
     critical — + muted kick, plucked 16th arpeggio                       (Meltdown 4–6)
     breaking — + driving 8th saw bass, claps, open hats, tension lead    (Meltdown 7–9)
   window.RiftAudio: unlock(), play(name, opts), setStage(n), music(on|'title'|'game'|'off'), stinger(name),
                     prefs {music, sfx, muted}, setPref(key, value). Preferences persist in localStorage. */
(function (global) {
  'use strict';
  var KEY = 'riftbreak.audio';
  var prefs = { music: 0.55, sfx: 0.8, muted: false };
  try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved) { for (var k in prefs) if (saved[k] != null) prefs[k] = saved[k]; } } catch (e) { /* storage blocked */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* storage blocked */ } }

  var ctx = null, master, sfxBus, musicBus, duckGain, verbIn, noiseBuf, comp;
  var layers = {};
  var MUSIC_MAX = 0.4, SFX_MAX = 0.9;

  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = prefs.muted ? 0 : 1;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.sfx * SFX_MAX; sfxBus.connect(master);
    duckGain = ctx.createGain(); duckGain.gain.value = 1; duckGain.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(duckGain);
    // Plate-style reverb from a generated impulse (shared by music and effects so they sit in one space).
    var conv = ctx.createConvolver();
    var len = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * (i < 200 ? i / 200 : 1); }
    conv.buffer = ir;
    verbIn = ctx.createGain(); verbIn.gain.value = 0.5;
    var verbOut = ctx.createGain(); verbOut.gain.value = 0.42;
    var verbLp = ctx.createBiquadFilter(); verbLp.type = 'lowpass'; verbLp.frequency.value = 6000;
    verbIn.connect(conv); conv.connect(verbLp); verbLp.connect(verbOut); verbOut.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var nd = noiseBuf.getChannelData(0); for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
    ['calm', 'drive', 'critical', 'breaking'].forEach(function (n) { var g = ctx.createGain(); g.gain.value = n === 'calm' ? 1 : 0; g.connect(musicBus); layers[n] = g; });
    return ctx;
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }
  ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { global.addEventListener(ev, unlock, { passive: true }); });

  // ───────────── building blocks ─────────────
  function env(dest, t, a, peak, dur, curve) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur * (curve || 1));
    g.connect(dest);
    return g;
  }
  function tone(type, f, t, dur, peak, dest, opts) {
    opts = opts || {};
    var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + (opts.glide || dur));
    if (opts.detune) o.detune.value = opts.detune;
    var g = env(dest || sfxBus, t, opts.attack || 0.004, peak, dur);
    if (opts.verb) { var s = ctx.createGain(); s.gain.value = opts.verb; g.connect(s); s.connect(verbIn); }
    o.connect(g); o.start(t); o.stop(t + (opts.attack || 0.004) + dur + 0.05);
    return o;
  }
  function noise(t, dur, peak, type, f, q, dest, opts) {
    opts = opts || {};
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var flt = ctx.createBiquadFilter(); flt.type = type || 'bandpass'; flt.frequency.setValueAtTime(f || 2000, t); flt.Q.value = q || 1;
    if (opts.to) flt.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    var g = env(dest || sfxBus, t, opts.attack || 0.002, peak, dur);
    if (opts.verb) { var r = ctx.createGain(); r.gain.value = opts.verb; g.connect(r); r.connect(verbIn); }
    s.connect(flt); flt.connect(g); s.start(t, Math.random() * 0.5); s.stop(t + dur + (opts.attack || 0.002) + 0.05);
  }
  function shaper(amount) {
    var ws = ctx.createWaveShaper(), n = 1024, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = i * 2 / n - 1; curve[i] = (1 + amount) * x / (1 + amount * Math.abs(x)); }
    ws.curve = curve; return ws;
  }
  var NOTE = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  // ───────────── sound effects ─────────────
  var lastPlay = {};
  var SFX = {
    select: function (t) { tone('sine', 1320, t, 0.05, 0.16, null, { to: 1480 }); noise(t, 0.02, 0.08, 'highpass', 5000); },
    hover: function (t) { tone('sine', 1760, t, 0.03, 0.05); },
    place: function (t, o) {
      // Card slap: a bright noise transient, a soft body thump and a tiny digital tick tuned to the card.
      noise(t, 0.07, 0.5, 'bandpass', 2400, 0.8);
      noise(t, 0.16, 0.18, 'lowpass', 900, 0.7, null, { verb: 0.15 });
      tone('sine', 150, t, 0.09, 0.32, null, { to: 70 });
      tone('triangle', NOTE(76 + ((o && o.pitch) || 0)), t + 0.012, 0.09, 0.07, null, { verb: 0.3 });
    },
    draw: function (t, o) {
      var n = Math.min(4, (o && o.n) || 1);
      for (var i = 0; i < n; i++) noise(t + i * 0.07, 0.12, 0.22, 'bandpass', 3200, 1.2, null, { to: 900 });
      tone('sine', 520, t, 0.08, 0.05, null, { to: 380 });
    },
    deal: function (t) { for (var i = 0; i < 7; i++) noise(t + i * 0.055, 0.06, 0.16, 'bandpass', 3000 + i * 120, 1.4); },
    attack: function (t, o) {
      var big = o && o.big;
      var d = shaper(14); var g = env(sfxBus, t, 0.005, big ? 0.36 : 0.28, 0.32);
      d.connect(g);
      var s1 = ctx.createOscillator(); s1.type = 'sawtooth'; s1.frequency.setValueAtTime(big ? 330 : 420, t); s1.frequency.exponentialRampToValueAtTime(60, t + 0.3);
      var s2 = ctx.createOscillator(); s2.type = 'square'; s2.frequency.setValueAtTime(big ? 165 : 210, t); s2.frequency.exponentialRampToValueAtTime(42, t + 0.3);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      s1.connect(lp); s2.connect(lp); lp.connect(d);
      s1.start(t); s2.start(t); s1.stop(t + 0.4); s2.stop(t + 0.4);
      noise(t, 0.18, 0.35, 'lowpass', 1600, 0.7, null, { verb: 0.2 });
      tone('sine', 90, t, 0.25, 0.4, null, { to: 40 });
    },
    counter: function (t) {
      [0, 0.07].forEach(function (dt, i) { tone('square', NOTE(74 + i * 5), t + dt, 0.07, 0.09, null, { to: NOTE(86 + i * 5), glide: 0.06 }); });
      SFX.attack(t + 0.1, { big: true });
    },
    block: function (t) {
      tone('triangle', NOTE(55), t, 0.4, 0.22, null, { verb: 0.4 });
      tone('sine', NOTE(62), t, 0.5, 0.16, null, { verb: 0.5 });
      noise(t, 0.25, 0.2, 'lowpass', 600, 0.5, null, { to: 200 });
    },
    skip: function (t) { tone('square', NOTE(81), t, 0.06, 0.08); tone('square', NOTE(74), t + 0.08, 0.1, 0.08, null, { verb: 0.2 }); noise(t, 0.05, 0.12, 'highpass', 4000); },
    reverse: function (t) {
      // A reversed swell into a quick snap.
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(NOTE(67), t); o.frequency.exponentialRampToValueAtTime(NOTE(79), t + 0.22);
      var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.22); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(sfxBus); var r = ctx.createGain(); r.gain.value = 0.35; g.connect(r); r.connect(verbIn); o.start(t); o.stop(t + 0.35);
      noise(t, 0.22, 0.12, 'bandpass', 800, 1, null, { to: 5000, attack: 0.2 });
    },
    color: function (t, o) {
      var base = { cyan: 74, gold: 71, violet: 69, crimson: 72 }[(o && o.color) || 'cyan'] || 72;
      [0, 4, 7].forEach(function (iv, i) { tone('triangle', NOTE(base + iv), t + i * 0.035, 0.22, 0.07, null, { verb: 0.5 }); });
    },
    rift: function (t) {
      // Dimensional tear: detuned saws through a sweeping band, an FM bell and a sub drop.
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(4200, t + 0.5); bp.frequency.exponentialRampToValueAtTime(700, t + 1.1);
      var g = env(sfxBus, t, 0.05, 0.3, 1.0); bp.connect(g); var r = ctx.createGain(); r.gain.value = 0.6; g.connect(r); r.connect(verbIn);
      [-14, 0, 9].forEach(function (dt) { var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(50); o.detune.value = dt * 3; o.connect(bp); o.start(t); o.stop(t + 1.2); });
      var car = ctx.createOscillator(), mod = ctx.createOscillator(), idx = ctx.createGain();
      car.frequency.value = NOTE(86); mod.frequency.value = NOTE(86) * 1.414; idx.gain.setValueAtTime(900, t + 0.25); idx.gain.exponentialRampToValueAtTime(5, t + 1.3);
      mod.connect(idx); idx.connect(car.frequency); var bg = env(sfxBus, t + 0.25, 0.004, 0.11, 1.2); var br = ctx.createGain(); br.gain.value = 0.8; bg.connect(br); br.connect(verbIn);
      car.connect(bg); car.start(t + 0.25); mod.start(t + 0.25); car.stop(t + 1.6); mod.stop(t + 1.6);
      tone('sine', 110, t + 0.22, 0.6, 0.35, null, { to: 38 });
      noise(t + 0.2, 0.14, 0.3, 'highpass', 2500);
    },
    rule: function (t) { [69, 74, 76, 81].forEach(function (m, i) { tone('sine', NOTE(m), t + i * 0.06, 0.5, 0.06, null, { verb: 0.8 }); tone('triangle', NOTE(m + 12), t + i * 0.06, 0.18, 0.025); }); },
    meltUp: function (t, o) { var lv = (o && o.level) || 5; tone('square', NOTE(60 + lv * 2), t, 0.07, 0.06, null, { to: NOTE(62 + lv * 2), glide: 0.05 }); tone('sine', NOTE(72 + lv * 2), t + 0.05, 0.12, 0.08, null, { verb: 0.3 }); },
    meltDown: function (t) { tone('sine', NOTE(79), t, 0.3, 0.1, null, { to: NOTE(67), verb: 0.5 }); noise(t, 0.3, 0.06, 'highpass', 6000, 0.5, null, { to: 2000 }); },
    critical: function (t) { [0, 0.22].forEach(function (dt) { tone('triangle', NOTE(76), t + dt, 0.1, 0.12); tone('triangle', NOTE(73), t + dt + 0.1, 0.1, 0.1, null, { verb: 0.3 }); }); },
    breaking: function (t) {
      [0, 0.32].forEach(function (dt) { tone('sine', 62, t + dt, 0.18, 0.5, null, { to: 40 }); tone('sine', 58, t + dt + 0.15, 0.14, 0.35, null, { to: 38 }); });
      tone('sawtooth', NOTE(64), t + 0.1, 0.7, 0.05, null, { to: NOTE(70), verb: 0.4, attack: 0.15 });
    },
    collapse: function (t) {
      // The biggest sound in the game: a pitched-down impact, a long noise wash and a distorted sub.
      var d = shaper(30); var g = env(sfxBus, t, 0.004, 0.55, 1.6); d.connect(g); var r = ctx.createGain(); r.gain.value = 0.7; g.connect(r); r.connect(verbIn);
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.2); o.connect(d); o.start(t); o.stop(t + 1.8);
      noise(t, 1.8, 0.45, 'lowpass', 3000, 0.4, null, { to: 120, verb: 0.6 });
      noise(t, 0.08, 0.6, 'highpass', 1200);
      [38, 45, 50].forEach(function (m) { tone('sawtooth', NOTE(m), t + 0.05, 1.4, 0.06, null, { verb: 0.6, detune: Math.random() * 12 }); });
    },
    lastCard: function (t) { tone('sine', NOTE(84), t, 0.12, 0.15, null, { verb: 0.3 }); tone('sine', NOTE(91), t + 0.11, 0.22, 0.15, null, { verb: 0.4 }); },
    exposed: function (t) { tone('square', NOTE(70), t, 0.08, 0.06); tone('square', NOTE(70), t + 0.14, 0.08, 0.06); },
    caught: function (t) { tone('sawtooth', NOTE(58), t, 0.35, 0.12, null, { to: NOTE(46) }); noise(t, 0.2, 0.15, 'lowpass', 900); },
    turn: function (t) { tone('sine', NOTE(81), t, 0.18, 0.08, null, { verb: 0.5 }); tone('sine', NOTE(88), t + 0.08, 0.25, 0.06, null, { verb: 0.6 }); },
    tick: function (t) { tone('square', 2200, t, 0.015, 0.03); },
    confirm: function (t) { tone('sine', NOTE(76), t, 0.06, 0.1); tone('sine', NOTE(83), t + 0.05, 0.1, 0.1, null, { verb: 0.3 }); },
    error: function (t) { tone('square', NOTE(52), t, 0.06, 0.08); tone('square', NOTE(49), t + 0.08, 0.08, 0.08); },
    victory: function (t) {
      [[62, 0], [66, 0.12], [69, 0.24], [74, 0.36], [78, 0.5]].forEach(function (n) { tone('triangle', NOTE(n[0]), t + n[1], 0.5, 0.13, null, { verb: 0.6 }); tone('sine', NOTE(n[0] + 12), t + n[1], 0.3, 0.05); });
      [50, 57, 62, 66].forEach(function (m) { tone('sawtooth', NOTE(m), t + 0.5, 1.6, 0.03, null, { verb: 0.8, attack: 0.08 }); });
      noise(t + 0.5, 1.2, 0.07, 'highpass', 7000, 0.5, null, { verb: 0.5 });
    },
    defeat: function (t) { [[69, 0], [65, 0.18], [62, 0.36], [57, 0.6]].forEach(function (n) { tone('triangle', NOTE(n[0]), t + n[1], 0.5, 0.1, null, { verb: 0.6 }); }); }
  };

  function play(name, o) {
    if (!ensure() || prefs.muted || !SFX[name]) return;
    if (ctx.state !== 'running') return;
    var now = ctx.currentTime;
    // Never stack the same sound within 40 ms (bursts of events), which avoids volume spikes.
    if (lastPlay[name] && now - lastPlay[name] < 0.04) return;
    lastPlay[name] = now;
    try { SFX[name](now + 0.005, o); } catch (e) { /* audio node limits */ }
  }

  // ───────────── adaptive music ─────────────
  // A driving synthwave loop in D minor. The title screen gets the pad and sub only; a match adds the "drive"
  // layer (four-on-the-floor kick, off-beat bass, hats, claps, 16th arpeggio) from the first card, Critical adds a
  // lead and busier percussion, and Breaking adds a rolling 16th bass, chord stabs and a riser into every phrase.
  var BPM = 126, STEP = 60 / BPM / 4;
  // Dm – Bb – F – C
  var PROG = [
    { root: 38, chord: [50, 53, 57, 62, 65] },
    { root: 34, chord: [50, 53, 58, 62, 65] },
    { root: 41, chord: [48, 53, 57, 60, 65] },
    { root: 36, chord: [48, 52, 55, 60, 64] }
  ];
  var ARPS = [[0, 2, 4, 2, 1, 3, 4, 3], [0, 1, 2, 4, 3, 2, 4, 1], [4, 3, 2, 0, 2, 3, 4, 2]];
  // Lead melodies: 8th notes over the 4-bar loop (null = rest).
  var LEADS = [
    [74, null, 74, 77, null, 76, 74, null, 74, null, 72, 74, null, 77, 79, null, 77, null, 76, 74, null, 72, 74, null, 72, null, 72, 76, null, 79, 76, null],
    [81, 79, 77, null, 77, 76, 74, null, 77, null, 81, null, 82, 81, 79, null, 81, 79, 77, null, 76, null, 72, null, 76, 77, 79, null, 79, null, 76, null]
  ];
  var seqTimer = null, nextTime = 0, step = 0, mode = 'off', stage = 0, section = 0, arpIx = 0, leadIx = 0;

  function mtone(type, f, t, dur, peak, layer, opts) { return tone(type, f, t, dur, peak, layers[layer], opts); }
  function kick(t, layer, peak) { mtone('sine', 160, t, 0.22, peak, layer, { to: 42, glide: 0.09 }); noise(t, 0.012, 0.12, 'highpass', 3000, 0.7, layers[layer]); }
  function pluck(m, t, layer, peak, cutoff) {
    var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(m);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(cutoff, t); lp.frequency.exponentialRampToValueAtTime(180, t + 0.13); lp.Q.value = 7;
    var g = env(layers[layer], t, 0.004, peak, 0.16); o.connect(lp); lp.connect(g); o.start(t); o.stop(t + 0.2);
  }

  function scheduleStep(s, t) {
    var bar = Math.floor(s / 16) % 4, sx = s % 16, ch = PROG[bar];
    if (sx === 0 && bar === 0) {
      section++;
      arpIx = (arpIx + 1) % ARPS.length;
      if (section % 2 === 0) leadIx = (leadIx + 1) % LEADS.length;
    }
    // calm (always): pad on the bar and a sub bass.
    if (sx === 0) {
      ch.chord.forEach(function (m, i) {
        var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = mode === 'title' ? 1000 : 1800 + stage * 600; lp.Q.value = 0.5;
        var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.024, t + 0.25); g.gain.linearRampToValueAtTime(0.0001, t + STEP * 16 + 0.2);
        lp.connect(g); g.connect(layers.calm); var r = ctx.createGain(); r.gain.value = 0.5; g.connect(r); r.connect(verbIn);
        [-7, 7].forEach(function (dt) { var o = ctx.createOscillator(); o.type = i < 2 ? 'triangle' : 'sawtooth'; o.frequency.value = NOTE(m); o.detune.value = dt; o.connect(lp); o.start(t); o.stop(t + STEP * 16 + 0.3); });
      });
    }
    if (sx === 0 || sx === 8) mtone('sine', NOTE(ch.root - 12), t, STEP * 7, 0.18, 'calm', { attack: 0.01 });
    if (mode === 'title') { if (sx % 4 === 2) noise(t, 0.04, 0.03, 'highpass', 7000, 0.7, layers.calm); return; }
    // drive (whole match): four-on-the-floor kick, off-beat bass, hats, claps on 2 and 4, 16th arpeggio.
    if (sx % 4 === 0) kick(t, 'drive', 0.5);
    if (sx % 4 === 2) pluck(ch.root + 12, t, 'drive', 0.11, 2200);
    if (sx % 4 === 3) pluck(ch.root + 24, t, 'drive', 0.05, 1800);
    if (sx % 2 === 1) noise(t, 0.03, 0.035, 'highpass', 9000, 0.6, layers.drive);
    if (sx % 4 === 2) noise(t, 0.11, 0.05, 'highpass', 7500, 0.6, layers.drive);
    if (sx === 4 || sx === 12) { noise(t, 0.12, 0.14, 'bandpass', 1500, 0.9, layers.drive, { verb: 0.25 }); noise(t + 0.012, 0.08, 0.1, 'bandpass', 2100, 1, layers.drive); }
    var a = ARPS[arpIx][sx % 8];
    mtone('square', NOTE(ch.chord[a] + 12), t, 0.09, 0.022, 'drive', { verb: 0.3 });
    // critical: lead melody, extra 16th hats, a snare fill at the end of the loop.
    if (sx % 2 === 0) { var ln = LEADS[leadIx][bar * 8 + sx / 2]; if (ln) { mtone('sawtooth', NOTE(ln), t, 0.24, 0.03, 'critical', { verb: 0.45, detune: -8 }); mtone('square', NOTE(ln), t, 0.24, 0.018, 'critical', { detune: 8 }); } }
    if (sx % 2 === 0) noise(t, 0.025, 0.025, 'highpass', 10000, 0.6, layers.critical);
    if (bar === 3 && sx >= 12) noise(t, 0.07, 0.07 + (sx - 12) * 0.02, 'bandpass', 1800, 0.9, layers.critical);
    // breaking: rolling 16th bass, chord stabs on the off-beats, a riser into every new loop, double kick.
    pluck(ch.root, t, 'breaking', 0.07, 1400);
    if (sx === 6 || sx === 14) ch.chord.slice(1, 4).forEach(function (m) { mtone('sawtooth', NOTE(m + 12), t, 0.12, 0.02, 'breaking', { verb: 0.3 }); });
    if (sx === 7) kick(t, 'breaking', 0.35);
    if (bar === 3 && sx === 0) {
      var rs = ctx.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true;
      var rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.Q.value = 2; rf.frequency.setValueAtTime(500, t); rf.frequency.exponentialRampToValueAtTime(7000, t + STEP * 16);
      var rg = ctx.createGain(); rg.gain.setValueAtTime(0.0001, t); rg.gain.exponentialRampToValueAtTime(0.06, t + STEP * 15.5); rg.gain.linearRampToValueAtTime(0.0001, t + STEP * 16 + 0.04);
      rs.connect(rf); rf.connect(rg); rg.connect(layers.breaking); rs.start(t); rs.stop(t + STEP * 16 + 0.1);
    }
  }

  function tick() {
    if (!ctx) return;
    if (nextTime < ctx.currentTime - 0.25) nextTime = ctx.currentTime + 0.02;   // tab was in the background: don't burst-catch-up
    while (nextTime < ctx.currentTime + 0.12) { scheduleStep(step, nextTime); nextTime += STEP; step++; }
  }

  function setLayers(ramp) {
    if (!ctx) return;
    var t = ctx.currentTime;
    var want = { calm: 1, drive: mode === 'game' ? 1 : 0, critical: mode === 'game' && stage >= 1 ? 1 : 0, breaking: mode === 'game' && stage >= 2 ? 1 : 0 };
    for (var n in layers) { layers[n].gain.cancelScheduledValues(t); layers[n].gain.setTargetAtTime(want[n], t, ramp || 1.2); }
  }
  function musicLevel() { return prefs.muted || mode === 'off' ? 0 : prefs.music * MUSIC_MAX; }

  function music(m) {
    mode = m || 'off';
    if (!ensure()) return;
    var t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(musicLevel(), t, 0.6);
    setLayers(0.8);
    if (mode !== 'off' && !seqTimer) { nextTime = ctx.currentTime + 0.1; step = 0; seqTimer = setInterval(tick, 30); }
    if (mode === 'off' && seqTimer) { var timer = seqTimer; seqTimer = null; setTimeout(function () { if (!seqTimer) clearInterval(timer); }, 1500); }
  }

  function setStage(n) {
    if (n === stage) return;
    stage = n;
    setLayers(1.5);
  }

  /** Duck the music briefly under big moments, then add a short musical accent. */
  function stinger(name) {
    if (!ensure() || prefs.muted) return;
    var t = ctx.currentTime;
    duckGain.gain.cancelScheduledValues(t);
    duckGain.gain.setTargetAtTime(name === 'collapse' ? 0.15 : 0.45, t, 0.05);
    duckGain.gain.setTargetAtTime(1, t + (name === 'collapse' ? 1.8 : 1.0), 0.5);
    if (name === 'rift') [62, 69, 74].forEach(function (m, i) { tone('sine', NOTE(m), t + 0.5 + i * 0.09, 0.9, 0.05, null, { verb: 0.9 }); });
    if (name === 'collapse') [38, 45, 50, 57].forEach(function (m) { tone('triangle', NOTE(m), t + 1.1, 1.6, 0.05, null, { verb: 0.9, attack: 0.3 }); });
  }

  function setPref(key, value) {
    prefs[key] = value;
    save();
    if (!ctx) return;
    var t = ctx.currentTime;
    master.gain.setTargetAtTime(prefs.muted ? 0 : 1, t, 0.05);
    sfxBus.gain.setTargetAtTime(prefs.sfx * SFX_MAX, t, 0.05);
    musicBus.gain.setTargetAtTime(musicLevel(), t, 0.2);
  }

  global.RiftAudio = { unlock: unlock, play: play, music: music, setStage: setStage, stinger: stinger, prefs: prefs, setPref: setPref, get ready() { return !!ctx && ctx.state === 'running'; } };
})(window);
