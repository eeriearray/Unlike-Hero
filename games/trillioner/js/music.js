/*
 * The soundtrack, generated live. A small arranger: each district is a style with its own tempo, groove, chords,
 * instruments and a written-by-seed melody that repeats like a real tune (A A' A B). Night moves it to the relative
 * minor and thins the drums; inside a shop it turns into muzak; the last hour of the day pushes everything harder.
 */
(function () {
  var TR = window.TR = window.TR || {};
  var audio = TR.audio, Rng = window.TrillionerRng.Rng, ctx = null, bus, dry, verb, echo, duck, tone, comp;

  var MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  // Drum strings are 16 steps of one bar: x hit, o soft hit, . rest. Chords are scale degrees, one per bar, 7ths added by `seven`.
  var STYLES = {
    downtown: { bpm: 118, swing: 0, key: 60, mode: 'maj', prog: [5, 3, 0, 4], seven: 1, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'o.x.o.x.o.x.o.xo', bass: 'x..x..x...x.x.x.', bassNote: 'o', lead: 'pluck', keys: 'stab', stabs: '...x..x....x..x.', rhythm: 'x..x..x.x.x.....' },
    luxury: { bpm: 98, swing: 0.1, key: 62, mode: 'maj', prog: [1, 4, 0, 5], seven: 1, kick: 'x..x....x..x....', snare: '...o..o....o..o.', hat: 'x.o.x.oxx.o.x.ox', bass: 'x...x.x.x...x.x.', bassNote: 'walk', lead: 'epiano', keys: 'epad', stabs: 'x.....x...x.....', rhythm: 'x...x.x...x...x.' },
    suburbs: { bpm: 108, swing: 0.06, key: 67, mode: 'maj', prog: [0, 4, 5, 3], seven: 0, kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x.....x.x.....x.', bassNote: 'o', lead: 'bell', keys: 'strum', stabs: 'x.x.x.x.x.x.x.x.', rhythm: 'x.x.x...x.x.x...' },
    industrial: { bpm: 126, swing: 0, key: 57, mode: 'min', prog: [0, 0, 5, 6], seven: 0, kick: 'x...x...x...x..x', snare: '....x.......x.o.', hat: '..x...x...x...xx', bass: 'x.xx.xx.x.xx.xx.', bassNote: 'o', lead: 'saw', keys: 'stab', stabs: 'x.....x.....x...', rhythm: 'x..x..x.....x...' },
    harbour: { bpm: 104, swing: 0.14, key: 62, mode: 'min', prog: [0, 6, 2, 4], seven: 0, kick: 'x.....x.x.....x.', snare: '...x.....x.....x', hat: '....x.......x...', bass: 'x.....x.x.....x.', bassNote: 'fifth', lead: 'squeeze', keys: 'strum', stabs: '..x.x.x...x.x.x.', rhythm: 'x.xx.xx.x.xx....' },
    airport: { bpm: 112, swing: 0, key: 64, mode: 'maj', prog: [0, 3, 5, 4], seven: 1, kick: 'x.......x.......', snare: '....o.......o...', hat: '..o...o...o...o.', bass: 'x.......x.....x.', bassNote: 'o', lead: 'bell', keys: 'pad', stabs: '................', rhythm: 'x.....x.....x...' },
    oldtown: { bpm: 96, swing: 0.16, key: 65, mode: 'min', prog: [0, 3, 4, 0], seven: 0, kick: 'x.......x.......', snare: '....x.......x...', hat: 'x..x..x.x..x..x.', bass: 'x...x...x...x...', bassNote: 'walk', lead: 'squeeze', keys: 'strum', stabs: '..x...x...x...x.', rhythm: 'x.x.xx..x.x.xx..' },
    under: { bpm: 88, swing: 0.04, key: 55, mode: 'min', prog: [0, 5, 3, 4], seven: 1, kick: 'x..x......x.....', snare: '....x.......x..o', hat: 'x.x.xxx.x.x.xxx.', bass: 'x......xx.......', bassNote: 'o', lead: 'hollow', keys: 'pad', stabs: '................', rhythm: 'x.....x...x.....' },
    shop: { bpm: 92, swing: 0.1, key: 65, mode: 'maj', prog: [1, 4, 0, 0], seven: 1, kick: 'x.....x...x.....', snare: '...o..o....o..o.', hat: 'x.o.x.o.x.o.x.o.', bass: 'x...x.x.x...x...', bassNote: 'walk', lead: 'epiano', keys: 'epad', stabs: 'x.....x...x.....', rhythm: 'x...x...x.x.....', soft: 0.65 }
  };

  // ───── instruments ─────
  function env(g, t, a, peak, d, sustain, r) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), t + a + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
    return t + a + d + r + 0.02;
  }
  function osc(type, f, det, t, end, to) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det; o.connect(to); o.start(t); o.stop(end); return o; }
  function out(node, wet, delay) {
    node.connect(duck);
    if (wet) { var s = ctx.createGain(); s.gain.value = wet; node.connect(s); s.connect(verb); }
    if (delay) { var e = ctx.createGain(); e.gain.value = delay; node.connect(e); e.connect(echo); }
  }
  var VOICE = {
    pluck: function (f, t, d, v) { var g = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 3; fl.frequency.setValueAtTime(f * 7, t); fl.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.28); fl.connect(g); var e = env(g, t, 0.004, v, 0.2, 0.25, 0.3); osc('sawtooth', f, -6, t, e, fl); osc('square', f, 7, t, e, fl); out(g, 0.22, 0.18); },
    saw: function (f, t, d, v) { var g = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 6; fl.frequency.setValueAtTime(f * 5, t); fl.frequency.exponentialRampToValueAtTime(f * 1.2, t + d); fl.connect(g); var e = env(g, t, 0.006, v * 0.8, d, 0.4, 0.14); osc('sawtooth', f, 0, t, e, fl); osc('sawtooth', f / 2, 8, t, e, fl); out(g, 0.12, 0.25); },
    epiano: function (f, t, d, v) { // a soft two-operator electric piano
      var g = ctx.createGain(), e = env(g, t, 0.006, v, 0.5, 0.35, 0.7), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
      car.frequency.value = f; mod.frequency.value = f * 14; mg.gain.setValueAtTime(f * 1.1, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.35);
      mod.connect(mg); mg.connect(car.frequency); car.connect(g); car.start(t); mod.start(t); car.stop(e); mod.stop(e); out(g, 0.3, 0.1);
    },
    bell: function (f, t, d, v) { var g = ctx.createGain(), e = env(g, t, 0.002, v * 0.9, 0.5, 0.15, 0.8); osc('sine', f * 2, 0, t, e, g); var h = ctx.createGain(); h.gain.value = 0.3; h.connect(g); osc('sine', f * 5.4, 0, t, e, h); out(g, 0.4, 0.2); },
    squeeze: function (f, t, d, v) { // accordion: two reeds slightly apart, wheezing in
      var g = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = Math.min(3000, f * 3.5); fl.Q.value = 0.7; fl.connect(g); var e = env(g, t, 0.03, v * 1.2, d, 0.8, 0.09); osc('sawtooth', f, -9, t, e, fl); osc('sawtooth', f, 9, t, e, fl); osc('square', f * 2, 0, t, e, fl); out(g, 0.2, 0);
    },
    hollow: function (f, t, d, v) { var g = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.setValueAtTime(f * 2, t); fl.frequency.linearRampToValueAtTime(f * 4, t + d * 1.5); fl.Q.value = 4; fl.connect(g); var e = env(g, t, 0.05, v * 1.4, d * 1.6, 0.5, 0.6); osc('sawtooth', f, -5, t, e, fl); osc('sawtooth', f * 1.5, 4, t, e, fl); out(g, 0.5, 0.35); }
  };
  function chordVoice(kind, notes, t, d, v) {
    notes.forEach(function (n, i) {
      var f = midi(n);
      if (kind === 'pad') { var g = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(350, t); fl.frequency.linearRampToValueAtTime(1100, t + d * 0.5); fl.frequency.linearRampToValueAtTime(400, t + d); fl.connect(g); var e = env(g, t, d * 0.25, v * 0.5, d * 0.5, 0.8, d * 0.4); osc('sawtooth', f, -9, t, e, fl); osc('sawtooth', f, 9, t, e, fl); out(g, 0.55, 0); }
      else if (kind === 'epad') VOICE.epiano(f, t + i * 0.012, d, v * 0.65);
      else if (kind === 'strum') VOICE.pluck(f, t + i * 0.018, 0.2, v * 0.5);
      else { var g2 = ctx.createGain(), fl2 = ctx.createBiquadFilter(); fl2.type = 'lowpass'; fl2.Q.value = 2; fl2.frequency.setValueAtTime(2600, t); fl2.frequency.exponentialRampToValueAtTime(700, t + 0.18); fl2.connect(g2); var e2 = env(g2, t, 0.005, v * 0.55, 0.16, 0.2, 0.1); osc('sawtooth', f, -7, t, e2, fl2); osc('square', f, 7, t, e2, fl2); out(g2, 0.28, 0.14); }
    });
  }
  function bassVoice(f, t, d, v) {
    var g = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 5; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(180, t + 0.2); fl.connect(g);
    var e = env(g, t, 0.006, v, d, 0.55, 0.05); osc('sawtooth', f, 0, t, e, fl); osc('sine', f, 0, t, e, g);
    g.connect(dry);
  }
  var noiseBuf = null;
  function noise(t, dur, vol, type, freq, q, wet) {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); var a = noiseBuf.getChannelData(0); for (var i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dry); if (wet) { var w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
    s.start(t, Math.random() * 0.9); s.stop(t + dur + 0.02);
  }
  function kick(t, v) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.11); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.32);
    noise(t, 0.012, v * 0.4, 'highpass', 2500);
    // everything else breathes around the kick
    duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(0.62, t); duck.gain.linearRampToValueAtTime(1, t + 0.17);
  }
  function snare(t, v) { noise(t, 0.16, v, 'bandpass', 2100, 0.7, 0.3); var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08); g.gain.setValueAtTime(v * 0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(g); g.connect(dry); o.start(t); o.stop(t + 0.14); }
  function hat(t, v, open) { noise(t, open ? 0.16 : 0.04, v, 'highpass', 8000); }

  // ───── the writer: a tune per style, the same every time, built from chord tones ─────
  function scaleOf(st, night) { return (night && st.mode === 'maj') ? MIN : st.mode === 'maj' ? MAJ : MIN; }
  function rootOf(st, night) { return (night && st.mode === 'maj') ? st.key - 3 : st.key; }
  function deg(st, night, d, oct) { var sc = scaleOf(st, night), n = sc.length, o = Math.floor(d / n), i = ((d % n) + n) % n; return rootOf(st, night) + sc[i] + o * 12 + (oct || 0) * 12; }
  function chordNotes(st, night, d, base) { var a = [d, d + 2, d + 4]; if (st.seven) a.push(d + 6); return a.map(function (x) { return deg(st, night, x, base); }); }
  function writeTune(name, st) {
    var rng = new Rng('tune:' + name), hits = [], i;
    for (i = 0; i < 16; i++) if (st.rhythm[i] === 'x') hits.push(i);
    var bars = [], walk = 7, prog = st.prog;
    function phrase(b, seedShift) { // one bar of scale degrees, landing on the chord
      var cd = prog[b % prog.length], out2 = [];
      hits.forEach(function (h, k) {
        var strong = h % 8 === 0, step = rng.pick([-2, -1, 1, 1, 2]);
        walk += step;
        if (strong || k === hits.length - 1) { var tones = [cd + 7, cd + 9, cd + 11], best = tones[0]; tones.forEach(function (x) { if (Math.abs(x - walk) < Math.abs(best - walk)) best = x; }); walk = best; }
        walk = Math.max(4, Math.min(14, walk));
        out2.push({ s: h, d: walk });
      });
      return out2;
    }
    var A = [phrase(0), phrase(1), phrase(2), phrase(3)], A2 = [A[0], A[1], phrase(2), phrase(3)];
    walk = 11;
    var B = [phrase(0), phrase(1), phrase(2), phrase(3)];
    bars = [A, A2, A, B];        // 16 bars
    return bars;
  }

  var M = {
    seq: null, step: 0, next: 0, style: 'downtown', want: 'downtown', hour: 6, frantic: false, tunes: {},
    build: function () {
      ctx = audio.ctx;
      bus = audio.musicBus;
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.16;
      tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 18000;
      M.fade = ctx.createGain(); M.fade.gain.value = 0.0001;
      dry = ctx.createGain(); duck = ctx.createGain(); dry.connect(tone); duck.connect(tone);
      // a generated room for the reverb
      var len = Math.floor(ctx.sampleRate * 1.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < 400 ? i / 400 : 1); }
      verb = ctx.createConvolver(); verb.buffer = ir;
      var vr = ctx.createGain(); vr.gain.value = 0.7; verb.connect(vr); vr.connect(tone);
      echo = ctx.createDelay(1); var fb = ctx.createGain(), ef = ctx.createBiquadFilter(); fb.gain.value = 0.34; ef.type = 'lowpass'; ef.frequency.value = 2400;
      echo.connect(ef); ef.connect(fb); fb.connect(echo); ef.connect(tone);
      tone.connect(comp); comp.connect(M.fade); M.fade.connect(bus);
      M.ready = true;
    },
    setScene: function (hour, district, frantic) {
      M.hour = hour; M.want = STYLES[district] ? district : 'downtown'; M.frantic = frantic;
    },
    start: function () {
      if (!audio.unlock() || M.seq) return;
      if (!M.ready) M.build();
      M.step = 0; M.next = ctx.currentTime + 0.12; M.style = M.want;
      M.fade.gain.cancelScheduledValues(ctx.currentTime); M.fade.gain.setTargetAtTime(0.85, ctx.currentTime, 0.5);
      M.seq = setInterval(M.pump, 50);
    },
    stop: function () {
      if (M.seq) clearInterval(M.seq); M.seq = null;
      if (M.ready) { M.fade.gain.cancelScheduledValues(ctx.currentTime); M.fade.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4); }
    },
    pump: function () { while (ctx && M.next < ctx.currentTime + 0.16) M.play(); },
    play: function () {
      var i = M.step, bar16 = i % 16, night = M.hour >= 20 || M.hour < 5;
      if (bar16 === 0 && M.style !== M.want && i % 32 === 0) { M.style = M.want; M.step = 0; i = 0; }      // change on the phrase, not mid-bar
      var st = STYLES[M.style], bpm = (st.bpm * (night ? 0.94 : 1)) * (M.frantic ? 1.22 : 1), sx = 60 / bpm / 4, t = M.next + (i % 2 ? st.swing * sx : 0), barNo = Math.floor(i / 16), soft = st.soft || 1;
      var inRoom = M.want === 'shop';
      tone.frequency.setTargetAtTime(inRoom ? 3200 : night ? 7000 : 15000, ctx.currentTime, 0.4);
      echo.delayTime.setTargetAtTime(sx * 3, ctx.currentTime, 0.05);
      var section = Math.floor(barNo / 4) % 4, intro = barNo < 2 && !M.frantic;
      var cd = st.prog[barNo % st.prog.length];
      // drums: night drops the kick pattern to half, the last hour adds hats
      var ks = st.kick[bar16], ss = st.snare[bar16], hs = st.hat[bar16];
      if (!intro && !(night && bar16 % 8 !== 0 && ks !== '.')) { if (ks === 'x') kick(t, 0.5 * soft); }
      if (!intro && ss !== '.') snare(t, (ss === 'x' ? 0.17 : 0.07) * soft);
      if (hs !== '.' || M.frantic) hat(t, (hs === 'x' ? 0.06 : 0.035) * soft * (M.frantic ? 1.4 : 1), hs === 'o' && bar16 % 8 === 6);
      // a fill to mark the end of each 4 bars
      if (barNo % 4 === 3 && bar16 >= 13 && !intro) snare(t, 0.09 * soft);
      // bass
      if (st.bass[bar16] === 'x' && !intro) {
        var off = 0, n = deg(st, night, cd, -2);
        if (st.bassNote === 'fifth' && bar16 >= 8) n = deg(st, night, cd + 4, -2);
        if (st.bassNote === 'walk') { var w = [0, 2, 4, 5, 4, 2, 0, 4]; n = deg(st, night, cd + w[Math.floor(bar16 / 2) % 8], -2); }
        bassVoice(midi(n), t, sx * 1.6, 0.26 * soft);
      }
      // chords
      if (st.keys === 'pad' || st.keys === 'epad') { if (bar16 === 0) chordVoice(st.keys, chordNotes(st, night, cd, -1), t, sx * 16, 0.09 * soft); if (st.keys === 'epad' && st.stabs[bar16] === 'x' && bar16) chordVoice('epad', chordNotes(st, night, cd, -1).slice(0, 3), t, sx * 3, 0.07 * soft); }
      else if (st.stabs[bar16] === 'x') chordVoice(st.keys, chordNotes(st, night, cd, -1).slice(0, 3), t, sx * 2, 0.085 * soft);
      // the tune rests through the intro and every so often, which keeps it from nagging
      if (!intro && section !== 2 || M.frantic) {
        var tune = M.tunes[M.style] || (M.tunes[M.style] = writeTune(M.style, st)), blk = tune[Math.floor(barNo / 4) % 4][barNo % 4];
        blk.forEach(function (nt) {
          if (nt.s === bar16) VOICE[st.lead](midi(deg(st, night, nt.d, -1)), t, sx * 2.4, 0.1 * soft);
        });
      }
      // the last hour rises a little every bar
      M.next += sx;
      M.step = i + 1;
    }
  };
  audio.startMusic = M.start;
  audio.stopMusic = M.stop;
  audio.setScene = M.setScene;
  TR.music = M;
})();
