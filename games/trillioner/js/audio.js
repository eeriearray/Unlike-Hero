/* Synthesised WebAudio. No files. Everything hangs off a master gain with sfx and music buses. */
(function () {
  var TR = window.TR = window.TR || {};
  var ctx = null, master, sfx, music, eng = null;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = audio.muted ? 0 : audio.volume; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = audio.sfxVolume; sfx.connect(master);
    music = ctx.createGain(); music.gain.value = audio.musicVolume; music.connect(master);
    audio.ctx = ctx; audio.musicBus = music;
    return true;
  }
  function tone(freq, dur, type, vol, when, slide) {
    if (!ctx) return;
    var t = ctx.currentTime + (when || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol || 0.2, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfx);
    o.start(t); o.stop(t + dur + 0.02);
  }
  var noiseBuf = null;
  function noise(dur, vol, freq, q, when) {
    if (!ctx) return;
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var t = ctx.currentTime + (when || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = freq || 1000; f.Q.value = q || 0.7;
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfx);
    s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.02);
  }

  var audio = TR.audio = {
    volume: 0.8, sfxVolume: 0.9, musicVolume: 0.5, muted: false, ctx: null,
    unlock: ensure,
    setVolume: function (kind, v) {
      audio[kind] = v;
      if (!ctx) return;
      master.gain.value = audio.muted ? 0 : audio.volume; sfx.gain.value = audio.sfxVolume; music.gain.value = audio.musicVolume;
    },
    setMuted: function (m) { audio.muted = m; if (ctx) master.gain.value = m ? 0 : audio.volume; },
    /** Register chime: rises in pitch with Frenzy, grows with the price tier. */
    buy: function (tier, mult) {
      if (!ensure()) return;
      var pitch = Math.pow(1.122, (mult || 1) - 1) * (1 + tier * 0.05);
      tone(1320 * pitch, 0.08, 'square', 0.1);
      tone(1760 * pitch, 0.14, 'square', 0.1, 0.06);
      if (tier >= 1) tone(2637 * pitch, 0.22, 'triangle', 0.12, 0.13);
      for (var i = 0; i < tier * 3; i++) tone(2200 + Math.random() * 1800, 0.05, 'triangle', 0.06, 0.1 + i * 0.05);
      if (tier >= 2) { tone(523 * pitch, 0.5, 'sawtooth', 0.08, 0.1); tone(784 * pitch, 0.5, 'sawtooth', 0.06, 0.16); }
      if (tier >= 3) { tone(1047 * pitch, 0.8, 'sawtooth', 0.08, 0.24); noise(0.5, 0.2, 3000, 0.4, 0.1); }
      if (tier >= 4) { tone(110, 1.2, 'sawtooth', 0.2, 0, 55); }
    },
    denied: function () { if (!ensure()) return; tone(170, 0.16, 'square', 0.18); tone(120, 0.26, 'square', 0.18, 0.13); },
    jump: function (n) { if (!ensure()) return; tone(n > 1 ? 560 : 400, 0.14, 'triangle', 0.1, 0, n > 1 ? 1100 : 760); },
    door: function () { if (!ensure()) return; noise(0.16, 0.12, 700, 1); tone(220, 0.14, 'triangle', 0.1, 0.05); },
    thud: function () { if (!ensure()) return; noise(0.22, 0.32, 200, 0.6); },
    boom: function (v) { if (!ensure()) return; noise(0.9, 0.5 * (v || 1), 120, 0.4); tone(80, 0.7, 'sine', 0.35 * (v || 1), 0, 28); },
    cheer: function (v) { if (!ensure()) return; for (var i = 0; i < 5; i++) noise(0.9 + Math.random() * 0.6, 0.07 * v, 800 + Math.random() * 1400, 1.4, i * 0.05); },
    horn: function (kind) { if (!ensure()) return; tone(392, 0.32, 'sawtooth', 0.13); tone(494, 0.32, 'sawtooth', 0.11); },
    engine: function (sound) {
      if (!ensure()) return;
      if (eng) { eng.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); var old = eng; setTimeout(function () { old.o.stop(); old.o2.stop(); }, 300); eng = null; }
      if (!sound) return;
      var def = audio.ENGINES[sound] || audio.ENGINES.car, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = def.type; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = def.cut;
      g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(sfx);
      o.start(); o2.start();
      eng = { o: o, o2: o2, g: g, def: def };
    },
    engineLevel: function (speedFrac, slip) {
      if (!eng || !ctx) return;
      var d = eng.def, fq = d.base + speedFrac * d.range, t = ctx.currentTime;
      eng.o.frequency.setTargetAtTime(fq, t, 0.05);
      eng.o2.frequency.setTargetAtTime(fq * 0.5 + 1.5, t, 0.05);
      eng.g.gain.setTargetAtTime(d.vol * (0.45 + speedFrac * 0.55), t, 0.08);
    },
    ENGINES: {
      car: { type: 'sawtooth', base: 60, range: 150, cut: 900, vol: 0.13 }
    }
  };
})();
