/* Mafia — music and sound effects, synthesized with the Web Audio API (no audio files).
   Music is a small step sequencer playing one composed loop per mood (no noise beds or hiss):
     lobby  — smoky noir jazz: Rhodes comping, walking bass, sparse melody
     night  — music box over a soft pad in A minor
     day    — warm broken piano chords
     trial  — tense staccato strings and timpani
     suspense — after a death: heartbeat bass pulse, a ticking semitone figure, uneasy strings
   window.MafiaAudio: unlock(), play(name), music(mood), heartbeat(level), duck(on),
                      settings {music, sfx}, setMusic(bool), setSfx(bool). */
(function (global) {
  'use strict';
  var ctx = null, master, sfxBus, musicBus, musicDuck, reverbIn;
  var prefs = { music: true, sfx: true };
  try { var saved = JSON.parse(localStorage.getItem('hub.mafia.audio') || 'null'); if (saved) { prefs.music = saved.music !== false; prefs.sfx = saved.sfx !== false; } } catch (e) { /* storage blocked */ }
  function savePrefs() { try { localStorage.setItem('hub.mafia.audio', JSON.stringify(prefs)); } catch (e) { /* storage blocked */ } }

  var MUSIC_LEVEL = 0.34;

  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.sfx ? 0.8 : 0; sfxBus.connect(master);
    musicDuck = ctx.createGain(); musicDuck.gain.value = 1; musicDuck.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = prefs.music ? MUSIC_LEVEL : 0;
    var tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 5200;
    musicBus.connect(tone); tone.connect(musicDuck);
    // A gentle room reverb built from a decaying impulse (only notes ever pass through it).
    var conv = ctx.createConvolver();
    var len = ctx.sampleRate * 2.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = ir.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    conv.buffer = ir;
    reverbIn = ctx.createGain(); reverbIn.gain.value = 0.32;
    var wet = ctx.createGain(); wet.gain.value = 0.55;
    reverbIn.connect(conv); conv.connect(wet); wet.connect(musicDuck);
    return ctx;
  }

  // ───────────── instruments ─────────────
  function voice(out, t, dur, peak, attack) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (attack || 0.006) + dur);
    g.connect(out);
    return g;
  }
  function osc(type, freq, t, end, dest, detune) {
    var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(end + 0.05);
    return o;
  }
  function send(node, amount) { var s = ctx.createGain(); s.gain.value = amount; node.connect(s); s.connect(reverbIn); }

  var INST = {
    // Electric-piano: two-operator FM bell that softens as it decays.
    rhodes: function (f, t, dur, vel) {
      var g = voice(musicBus, t, dur, 0.22 * vel, 0.005); send(g, 0.6);
      var car = ctx.createOscillator(); car.frequency.value = f;
      var mod = ctx.createOscillator(); mod.frequency.value = f;
      var idx = ctx.createGain(); idx.gain.setValueAtTime(f * 1.6 * vel, t); idx.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.6);
      mod.connect(idx); idx.connect(car.frequency); car.connect(g);
      car.start(t); mod.start(t); car.stop(t + dur + 0.1); mod.stop(t + dur + 0.1);
    },
    piano: function (f, t, dur, vel) {
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(9000, f * 9), t); lp.frequency.exponentialRampToValueAtTime(f * 2.2, t + dur);
      var g = voice(lp, t, dur, 0.16 * vel, 0.004); lp.connect(musicBus); send(lp, 0.5);
      [[1, 1], [2, 0.42], [3, 0.2], [4, 0.09]].forEach(function (h) {
        var hg = ctx.createGain(); hg.gain.value = h[1]; hg.connect(g);
        osc('sine', f * h[0], t, t + dur, hg, h[0] === 1 ? 0 : 3);
      });
    },
    musicbox: function (f, t, dur, vel) {
      var g = voice(musicBus, t, dur, 0.1 * vel, 0.003); send(g, 1);
      osc('sine', f, t, t + dur, g);
      var b = ctx.createGain(); b.gain.value = 0.25; b.connect(g); osc('sine', f * 2.76, t, t + dur * 0.4, b);
    },
    bass: function (f, t, dur, vel) {
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(musicBus);
      var g = voice(lp, t, dur, 0.42 * vel, 0.012);
      osc('triangle', f, t, t + dur, g);
      var s = ctx.createGain(); s.gain.value = 0.6; s.connect(g); osc('sine', f, t, t + dur, s);
    },
    pad: function (freqs, t, dur, vel) {
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4;
      lp.connect(musicBus); send(lp, 0.8);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.035 * vel, t + dur * 0.35);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.8);
      g.connect(lp);
      freqs.forEach(function (f) { osc('sawtooth', f, t, t + dur + 0.9, g, -6); osc('sawtooth', f, t, t + dur + 0.9, g, 6); });
    },
    strings: function (f, t, dur, vel) {
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(musicBus); send(lp, 0.4);
      var g = voice(lp, t, dur, 0.09 * vel, 0.02);
      osc('sawtooth', f, t, t + dur, g, -4); osc('sawtooth', f, t, t + dur, g, 5);
    },
    timpani: function (f, t, dur, vel) {
      var g = voice(musicBus, t, dur, 0.5 * vel, 0.004); send(g, 0.5);
      var o = osc('sine', f * 1.15, t, t + dur, g); o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
    }
  };

  // ───────────── composition ─────────────
  var NOTE = {};
  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach(function (n, i) {
    for (var o = 0; o < 8; o++) NOTE[n + o] = 440 * Math.pow(2, (i + (o - 4) * 12 - 9) / 12);
  });
  NOTE.Bb2 = NOTE['A#2']; NOTE.Bb3 = NOTE['A#3']; NOTE.Bb4 = NOTE['A#4']; NOTE.Eb4 = NOTE['D#4'];
  function n(names) { return names.split(' ').map(function (x) { return NOTE[x]; }); }
  function chance(p) { return Math.random() < p; }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }

  // Each song: bpm, steps per bar (eighth notes), chord list (one per bar), and play(step, time, chord, bar, stepDur).
  var SONGS = {
    lobby: {
      bpm: 92, swing: 0.16,
      chords: [
        { bass: n('D2 F2 A2 C#3'), voicing: n('F3 A3 C4 E4'), scale: n('D4 E4 F4 A4 C5 D5 E5') },
        { bass: n('G2 B2 D3 F#2'), voicing: n('F3 B3 E4 A4'), scale: n('D4 F4 G4 A4 B4 D5') },
        { bass: n('C2 E2 G2 A#2'), voicing: n('E3 B3 D4 G4'), scale: n('C4 D4 E4 G4 B4 C5') },
        { bass: n('A2 C#3 E3 C#3'), voicing: n('G3 C#4 E4 A#4'), scale: n('A3 C#4 E4 G4 A#4 A4') }
      ],
      play: function (s, t, ch, bar, sd) {
        if (s % 2 === 0) INST.bass(ch.bass[s / 2], t, sd * 1.9, s === 0 ? 1 : 0.8);
        if (s === 3 || (s === 6 && chance(0.6)) || (s === 1 && chance(0.25))) ch.voicing.forEach(function (f) { INST.rhodes(f, t, sd * (s === 3 ? 2.5 : 1.4), 0.55 + Math.random() * 0.25); });
        if (bar % 2 === 1 && s % 2 === 0 && chance(0.45)) INST.rhodes(pickOne(ch.scale), t, sd * 2.4, 0.5);
      }
    },
    night: {
      bpm: 66,
      chords: [
        { root: NOTE.A2, arp: n('A4 C5 E5 A5 E5 C5 B4 C5'), pad: n('A3 C4 E4') },
        { root: NOTE.F2, arp: n('F4 A4 C5 F5 C5 A4 G4 A4'), pad: n('F3 A3 C4') },
        { root: NOTE.D2, arp: n('D4 F4 A4 D5 A4 F4 E4 F4'), pad: n('D3 F3 A3') },
        { root: NOTE.E2, arp: n('E4 G#4 B4 E5 D5 B4 G#4 B4'), pad: n('E3 G#3 B3') }
      ],
      play: function (s, t, ch, bar, sd) {
        if (s === 0) { INST.pad(ch.pad, t, sd * 8, 0.9); INST.bass(ch.root, t, sd * 7, 0.55); }
        // The music box drops a note now and then, like a worn mechanism.
        if (bar % 4 !== 3 || s < 4) { if (chance(0.92)) INST.musicbox(ch.arp[s], t, 1.6, s % 4 === 0 ? 1 : 0.7); }
      }
    },
    day: {
      bpm: 84,
      chords: [
        { root: NOTE.C2, notes: n('C3 G3 C4 E4 G4 E4 C4 G3'), top: NOTE.E5 },
        { root: NOTE.A1, notes: n('A2 E3 A3 C4 E4 C4 A3 E3'), top: NOTE.C5 },
        { root: NOTE.F2, notes: n('F2 C3 F3 A3 C4 A3 F3 C3'), top: NOTE.A4 },
        { root: NOTE.G2, notes: n('G2 D3 G3 B3 D4 B3 G3 D3'), top: NOTE.B4 }
      ],
      play: function (s, t, ch, bar, sd) {
        if (s === 0 || s === 4) INST.bass(ch.root, t, sd * 3.5, 0.6);
        INST.piano(ch.notes[s], t, sd * 3, s % 4 === 0 ? 0.9 : 0.6);
        if (s === 0 && bar % 2 === 0) INST.piano(ch.top, t, sd * 6, 0.7);
      }
    },
    trial: {
      bpm: 108,
      chords: [
        { root: NOTE.D2, hi: n('D3 D3 A3 D3 D3 A3 D3 F3') },
        { root: NOTE.D2, hi: n('D3 D3 A3 D3 D3 A3 E3 F3') },
        { root: NOTE.Bb2, hi: n('A#2 A#2 F3 A#2 A#2 F3 A#2 D3') },
        { root: NOTE.A2, hi: n('A2 A2 E3 A2 C#3 E3 A3 C#3') }
      ],
      play: function (s, t, ch, bar, sd) {
        INST.strings(ch.hi[s], t, sd * 0.7, s % 2 === 0 ? 1 : 0.6);
        if (s === 0) { INST.timpani(ch.root, t, 1.1, 1); INST.bass(ch.root, t, sd * 6, 0.7); }
        if (bar === 3 && s >= 4) INST.timpani(ch.root, t, 0.5, 0.5);
      }
    }
  };
  // Played on the day after a killing (and while you haunt the table): a pulse under a clock that won't stop ticking.
  SONGS.suspense = {
    bpm: 70,
    chords: [
      { pad: n('D3 F3 A3'), hi: n('A4 A#4') },
      { pad: n('D3 F3 A#3'), hi: n('A4 A#4') },
      { pad: n('D3 G3 A#3'), hi: n('A#4 B4') },
      { pad: n('C#3 E3 G3 A#3'), hi: n('A4 G#4') }
    ],
    play: function (s, t, ch, bar, sd) {
      if (s === 0) INST.pad(ch.pad, t, sd * 8, 1.1);
      // heartbeat bass: lub-dub on beats one and three
      if (s === 0 || s === 4) { INST.bass(NOTE.D2, t, sd * 0.8, 0.75); INST.bass(NOTE.D2, t + sd * 0.45, sd * 0.7, 0.45); }
      // a ticking clock that refuses to resolve
      INST.musicbox(ch.hi[s % 2], t, 0.45, s % 4 === 0 ? 0.55 : 0.32);
      if (s === 6 && bar === 3) INST.strings(NOTE['A#3'], t, sd * 2.5, 0.8);
      if (s === 0 && bar === 2) INST.piano(NOTE.D2, t, sd * 6, 0.6), INST.piano(NOTE['D#2'], t, sd * 6, 0.5);
    }
  };
  SONGS.end = SONGS.lobby;

  var seq = { mood: null, song: null, step: 0, bar: 0, next: 0, timer: null };
  function tick() {
    if (!seq.song) return;
    var sd = 60 / seq.song.bpm / 2;
    while (seq.next < ctx.currentTime + 0.25) {
      var s = seq.step, ch = seq.song.chords[seq.bar % seq.song.chords.length];
      var t = seq.next + (seq.song.swing && s % 2 === 1 ? sd * seq.song.swing : 0);
      try { seq.song.play(s, t, ch, seq.bar % seq.song.chords.length, sd); } catch (e) { /* music is best-effort */ }
      seq.next += sd;
      seq.step = (s + 1) % 8;
      if (seq.step === 0) seq.bar++;
    }
  }
  function startSong(mood) {
    clearInterval(seq.timer); seq.timer = null;
    seq.mood = mood; seq.song = SONGS[mood] || null;
    if (!seq.song) return;
    seq.step = 0; seq.bar = 0; seq.next = ctx.currentTime + 0.12;
    seq.timer = setInterval(tick, 60);
  }

  // ───────────── sound effects (all tonal; short) ─────────────
  function sfx(type, freq, opts) {
    opts = opts || {};
    var t = ctx.currentTime + (opts.delay || 0);
    var g = voice(sfxBus, t, opts.dur || 0.3, opts.gain || 0.3, opts.attack);
    var o = osc(type, freq, t, t + (opts.dur || 0.3) + 0.05, g, opts.detune);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + (opts.glide || opts.dur || 0.3));
    return o;
  }
  function thud(t0, gain) { var o = sfx('sine', 160, { to: 45, dur: 0.35, gain: gain || 0.8, delay: t0 }); return o; }
  function chord(freqs, opts) { freqs.forEach(function (f, i) { sfx(opts.type || 'triangle', f, { dur: opts.dur, gain: opts.gain, delay: (opts.delay || 0) + i * (opts.spread || 0), attack: opts.attack }); }); }

  var SFX = {
    click: function () { sfx('triangle', 900, { dur: 0.04, gain: 0.08 }); },
    hover: function () { sfx('sine', 1500, { dur: 0.03, gain: 0.03 }); },
    tick: function () { sfx('sine', 1250, { dur: 0.05, gain: 0.16 }); sfx('sine', 2500, { dur: 0.02, gain: 0.04 }); },
    tock: function () { sfx('sine', 820, { dur: 0.07, gain: 0.24 }); sfx('triangle', 410, { dur: 0.06, gain: 0.1 }); },
    gong: function () { [1, 2.01, 2.76, 3.9].forEach(function (m, i) { sfx('sine', 98 * m, { dur: 3.6 - i * 0.6, gain: 0.2 / (i + 1), attack: 0.01 }); }); },
    bell: function () { [1, 2.4, 3.01].forEach(function (m, i) { sfx('sine', 523 * m, { dur: 2 - i * 0.4, gain: 0.1 / (i + 1) }); }); },
    gavel: function () { thud(0, 0.9); sfx('triangle', 380, { dur: 0.18, gain: 0.3 }); thud(0.42, 0.6); sfx('triangle', 360, { dur: 0.15, gain: 0.2, delay: 0.42 }); },
    death: function () { sfx('sine', 70, { to: 34, dur: 1.6, gain: 0.8 }); chord([NOTE.A3, NOTE.Bb3, NOTE.E4], { type: 'sawtooth', dur: 1.6, gain: 0.035, attack: 0.03 }); },
    gunshot: function () { thud(0, 1); sfx('square', 120, { to: 40, dur: 0.12, gain: 0.25 }); },
    stab: function () { sfx('sawtooth', 1800, { to: 300, dur: 0.12, gain: 0.12 }); thud(0.05, 0.5); },
    flip: function () { sfx('sine', 300, { to: 900, dur: 0.22, gain: 0.12 }); },
    whoosh: function () { sfx('sine', 200, { to: 700, dur: 0.4, gain: 0.1, attack: 0.1 }); },
    reveal: function (team) {
      var c = team === 'mafia' ? n('A2 C3 D#3 A3') : team === 'neutral' ? n('B2 D#3 G3 B3') : n('C3 E3 G3 C4');
      chord(c, { dur: 2.2, gain: 0.1, spread: 0.07, attack: 0.03 });
    },
    vote: function () { sfx('triangle', 520, { to: 780, dur: 0.1, gain: 0.18 }); },
    select: function () { sfx('triangle', 660, { dur: 0.1, gain: 0.14 }); sfx('sine', 990, { dur: 0.12, gain: 0.07, delay: 0.05 }); },
    confirm: function () { chord(n('E5 G5 B5'), { type: 'sine', dur: 0.6, gain: 0.05, spread: 0.06 }); },
    heal: function () { chord(n('A5 C#6 E6 A6'), { type: 'sine', dur: 0.5, gain: 0.06, spread: 0.07 }); },
    silence: function () { sfx('square', 300, { to: 70, dur: 0.5, gain: 0.08 }); },
    chat: function () { sfx('sine', 1320, { dur: 0.05, gain: 0.04 }); },
    paper: function () { sfx('triangle', 220, { to: 520, dur: 0.25, gain: 0.08 }); sfx('triangle', 640, { to: 260, dur: 0.25, gain: 0.06, delay: 0.25 }); },
    victory: function () { chord(n('C4 E4 G4 C5 E5 G5'), { dur: 0.9, gain: 0.13, spread: 0.12 }); chord(n('C5 E5 G5'), { dur: 2.4, gain: 0.08, delay: 0.85, attack: 0.05 }); },
    defeat: function () { chord(n('G4 F4 D#4 A#3'), { type: 'sawtooth', dur: 1.1, gain: 0.05, spread: 0.35 }); },
    jester: function () { [523, 622, 523, 784, 740, 698].forEach(function (f, i) { sfx('square', f, { dur: 0.12, gain: 0.05, delay: i * 0.1 }); }); },
    error: function () { sfx('triangle', 180, { dur: 0.15, gain: 0.12 }); }
  };

  var heart = { level: 0, timer: null };
  function beatOnce(level) {
    var g = 0.35 + level * 0.25;
    sfx('sine', 62, { to: 38, dur: 0.16, gain: g });
    sfx('sine', 58, { to: 36, dur: 0.2, gain: g * 0.75, delay: 0.2 });
  }

  // ───────────── recorded narration ─────────────
  // Each take is trimmed of silence and run through a narrator chain: rumble cut, warm low shelf,
  // presence dip, gentle compression and a little room reverb. `deepen` (<1) lowers pitch and pace together.
  var voiceChain = null, voiceSrc = null, voiceCache = {};
  function ensureVoiceChain() {
    if (voiceChain) return voiceChain;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 75;
    var warm = ctx.createBiquadFilter(); warm.type = 'lowshelf'; warm.frequency.value = 180; warm.gain.value = 4;
    var mud = ctx.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 3200; mud.Q.value = 0.8; mud.gain.value = -1.5;
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -22; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.2;
    var out = ctx.createGain(); out.gain.value = 1.15;
    var verb = ctx.createConvolver();
    var len = ctx.sampleRate * 1.3, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4); }
    verb.buffer = ir;
    var wet = ctx.createGain(); wet.gain.value = 0.16;
    hp.connect(warm); warm.connect(mud); mud.connect(comp); comp.connect(out); out.connect(master);
    comp.connect(verb); verb.connect(wet); wet.connect(master);
    voiceChain = hp;
    return hp;
  }
  function trimmed(buf) {
    var data = buf.getChannelData(0), th = 0.02, start = 0, end = data.length - 1;
    while (start < end && Math.abs(data[start]) < th) start++;
    while (end > start && Math.abs(data[end]) < th) end--;
    var pad = Math.floor(buf.sampleRate * 0.06);
    return { offset: Math.max(0, start - pad) / buf.sampleRate, duration: Math.max(0.05, (Math.min(data.length, end + pad * 3) - Math.max(0, start - pad)) / buf.sampleRate) };
  }

  var API = {
    settings: prefs,
    /** Play a recorded narration clip. Resolves when it ends (or is stopped); rejects if it cannot load. */
    playVoice: function (url, deepen) {
      if (!ensure()) return Promise.reject(new Error('no audio'));
      if (ctx.state === 'suspended') ctx.resume();
      var load = voiceCache[url] || (voiceCache[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); })
        .then(function (b) { return new Promise(function (ok, bad) { ctx.decodeAudioData(b, ok, bad); }); }));
      load.catch(function () { delete voiceCache[url]; });
      return load.then(function (buf) {
        return new Promise(function (resolve) {
          API.stopVoice();
          var src = ctx.createBufferSource(); src.buffer = buf;
          src.playbackRate.value = deepen || 1;
          src.connect(ensureVoiceChain());
          var cut = trimmed(buf);
          src.onended = function () { if (voiceSrc === src) voiceSrc = null; resolve(); };
          voiceSrc = src;
          src.start(0, cut.offset, cut.duration);
        });
      });
    },
    stopVoice: function () { if (voiceSrc) { try { voiceSrc.onended && voiceSrc.onended(); voiceSrc.stop(); } catch (e) { /* already stopped */ } voiceSrc = null; } },
    /** Warm the decode cache for clips that are about to be played. */
    preloadVoice: function (url) { if (ensure() && !voiceCache[url]) { voiceCache[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); }).then(function (b) { return new Promise(function (ok, bad) { ctx.decodeAudioData(b, ok, bad); }); }); voiceCache[url].catch(function () { delete voiceCache[url]; }); } },
    unlock: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (seq.pending !== undefined && ctx.state !== 'suspended') { var m = seq.pending; seq.pending = undefined; startSong(m); }
    },
    setMusic: function (on) {
      prefs.music = !!on; savePrefs();
      if (ctx) musicBus.gain.setTargetAtTime(on ? MUSIC_LEVEL : 0, ctx.currentTime, 0.3);
    },
    setSfx: function (on) {
      prefs.sfx = !!on; savePrefs();
      if (ctx) sfxBus.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.05);
      if (!on) API.heartbeat(0);
    },
    play: function (name, arg) {
      if (!prefs.sfx || !ensure() || ctx.state !== 'running' || !SFX[name]) return;
      try { SFX[name](arg); } catch (e) { /* audio is best-effort */ }
    },
    music: function (mood) {
      if (!ensure()) return;
      if (ctx.state !== 'running') { seq.pending = mood; return; }
      if (seq.mood === mood && seq.timer) return;
      // Fade out the old loop, then start the new one on a fresh bar.
      var t = ctx.currentTime;
      musicDuck.gain.cancelScheduledValues(t);
      musicDuck.gain.setValueAtTime(musicDuck.gain.value, t);
      musicDuck.gain.linearRampToValueAtTime(0.0001, t + 0.8);
      clearInterval(seq.timer); seq.timer = null; seq.song = null;
      setTimeout(function () {
        musicDuck.gain.cancelScheduledValues(ctx.currentTime);
        musicDuck.gain.setValueAtTime(0.0001, ctx.currentTime);
        musicDuck.gain.linearRampToValueAtTime(API.ducked ? 0.35 : 1, ctx.currentTime + 1.2);
        startSong(mood);
      }, 850);
    },
    ducked: false,
    /** Lower the music while the narrator speaks. */
    duck: function (on) {
      API.ducked = !!on;
      if (!ctx) return;
      musicDuck.gain.setTargetAtTime(on ? 0.35 : 1, ctx.currentTime, 0.25);
    },
    /** 0 = off, 1 = tense, 2 = you are in danger */
    heartbeat: function (level) {
      if (heart.level === level) return;
      heart.level = level;
      clearInterval(heart.timer); heart.timer = null;
      if (!level) return;
      var beat = function () { if (prefs.sfx && ctx && ctx.state === 'running') beatOnce(level); };
      beat();
      heart.timer = setInterval(beat, level === 2 ? 720 : 1050);
    }
  };
  global.MafiaAudio = API;
})(window);
