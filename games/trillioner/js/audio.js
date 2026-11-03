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

  function mtone(freq, dur, type, vol, when) {
    var t = ctx.currentTime + (when || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(music); o.start(t); o.stop(t + dur + 0.02);
  }
  function mnoise(dur, vol, freq, when) {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var t = ctx.currentTime + (when || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(music); s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.02);
  }
  // Each district's lead layer: its own instrument and pattern.
  var LAYERS = {
    downtown: { wave: 'square', vol: 0.035, len: 0.8, pat: [2, 0, 1.5, 0, 2.5, 0, 2, 0, 3, 0, 2.5, 0, 2, 0, 1.5, 0] },
    luxury: { wave: 'sine', vol: 0.07, len: 2.4, pat: [3, 0, 0, 2.5, 0, 0, 2, 0, 0, 2.5, 0, 0, 1.5, 0, 2, 0] },
    suburbs: { wave: 'triangle', vol: 0.07, len: 1.2, pat: [2, 2.5, 3, 0, 2.5, 0, 2, 0, 1.5, 2, 2.5, 0, 2, 0, 0, 0] },
    industrial: { wave: 'sawtooth', vol: 0.03, len: 0.5, pat: [1, 0, 1, 1, 0, 1, 0, 1.5, 1, 0, 1, 1, 0, 1.2, 0, 1] },
    harbour: { wave: 'triangle', vol: 0.07, len: 3, pat: [1.5, 0, 0, 0, 2, 0, 0, 0, 2.5, 0, 0, 0, 2, 0, 0, 0] },
    airport: { wave: 'sine', vol: 0.05, len: 1, pat: [4, 0, 3, 0, 4, 0, 5, 0, 4, 0, 3, 0, 2, 0, 3, 0] },
    oldtown: { wave: 'triangle', vol: 0.07, len: 0.8, pat: [2, 0, 2.4, 2, 0, 1.5, 2, 0, 2.4, 0, 3, 0, 2.4, 2, 0, 0] },
    under: { wave: 'sawtooth', vol: 0.025, len: 3.5, pat: [1, 0, 0, 0, 0, 1.2, 0, 0, 1, 0, 0, 0, 0, 0.9, 0, 0] }
  };
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
    // ───── music: a small step sequencer. Chords follow the time of day, a lead layer follows the district. ─────
    scene: { hour: 6, district: 'downtown', frantic: false },
    setScene: function (hour, district, frantic) { audio.scene.hour = hour; audio.scene.district = district || 'downtown'; audio.scene.frantic = frantic; },
    startMusic: function () {
      if (!ensure() || audio.seq) return;
      audio.step = 0; audio.nextT = ctx.currentTime + 0.1;
      audio.seq = setInterval(audio.sequence, 60);
    },
    stopMusic: function () { if (audio.seq) clearInterval(audio.seq); audio.seq = null; },
    sequence: function () {
      if (!ctx) return;
      var sc = audio.scene, night = sc.hour >= 20 || sc.hour < 5, dusk = sc.hour >= 17 && sc.hour < 20;
      var bpm = sc.frantic ? 168 : night ? 92 : dusk ? 100 : 112, spb = 60 / bpm / 2;
      while (audio.nextT < ctx.currentTime + 0.18) {
        var st = audio.step++, bar = Math.floor(st / 16) % 4, beat = st % 16, t = audio.nextT - ctx.currentTime;
        var roots = night ? [110, 87.3, 98, 82.4] : dusk ? [130.8, 110, 87.3, 98] : [130.8, 98, 110, 87.3], root = roots[bar];
        var chord = night ? [1, 1.2, 1.5] : [1, 1.25, 1.5];
        if (beat % 4 === 0) mtone(root, spb * 3.2, 'triangle', 0.16, t);
        if (beat % 8 === 4) mtone(root * 2 * chord[1], spb * 2, 'sine', 0.06, t);
        if (beat % 8 === 6 || beat % 8 === 2) mtone(root * 2 * chord[2], spb * 1.4, 'sine', 0.05, t);
        var L = LAYERS[sc.district] || LAYERS.downtown, n = L.pat[beat % L.pat.length];
        if (n) mtone(root * 2 * n, spb * L.len, L.wave, L.vol, t);
        if (beat % 4 === 2 || sc.frantic) mnoise(0.04, sc.frantic ? 0.05 : 0.03, 7000, t);
        if (sc.frantic && beat % 2 === 0) mtone(root * 4, spb * 0.6, 'square', 0.03, t);
        audio.nextT += spb;
      }
    },
    denied: function () { if (!ensure()) return; tone(170, 0.16, 'square', 0.18); tone(120, 0.26, 'square', 0.18, 0.13); },
    jump: function (n) { if (!ensure()) return; tone(n > 1 ? 560 : 400, 0.14, 'triangle', 0.1, 0, n > 1 ? 1100 : 760); },
    door: function () { if (!ensure()) return; noise(0.16, 0.12, 700, 1); tone(220, 0.14, 'triangle', 0.1, 0.05); },
    thud: function () { if (!ensure()) return; noise(0.22, 0.32, 200, 0.6); },
    boom: function (v) { if (!ensure()) return; noise(0.9, 0.5 * (v || 1), 120, 0.4); tone(80, 0.7, 'sine', 0.35 * (v || 1), 0, 28); },
    cheer: function (v) { if (!ensure()) return; for (var i = 0; i < 5; i++) noise(0.9 + Math.random() * 0.6, 0.07 * v, 800 + Math.random() * 1400, 1.4, i * 0.05); },
    horn: function (notes) { if (!ensure()) return; notes = notes || [392, 494]; tone(notes[0], 0.32, 'sawtooth', 0.13); tone(notes[1], 0.32, 'sawtooth', 0.11); },
    trumpet: function () { if (!ensure()) return; tone(300, 0.7, 'sawtooth', 0.2, 0, 620); tone(450, 0.7, 'square', 0.1, 0.05, 900); },
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
      car: { type: 'sawtooth', base: 60, range: 150, cut: 900, vol: 0.13 },
      hover: { type: 'sine', base: 220, range: 320, cut: 2400, vol: 0.09 },
      scooter: { type: 'square', base: 110, range: 240, cut: 1400, vol: 0.06 },
      truck: { type: 'sawtooth', base: 38, range: 70, cut: 500, vol: 0.2 },
      elephant: { type: 'triangle', base: 40, range: 25, cut: 300, vol: 0.1 },
      electric: { type: 'sine', base: 340, range: 200, cut: 3000, vol: 0.03 },
      pogo: { type: 'triangle', base: 90, range: 40, cut: 600, vol: 0.02 },
      boat: { type: 'sawtooth', base: 70, range: 110, cut: 700, vol: 0.14 },
      sub: { type: 'sine', base: 55, range: 40, cut: 300, vol: 0.2 },
      heli: { type: 'sawtooth', base: 24, range: 18, cut: 420, vol: 0.26 },
      jet: { type: 'sawtooth', base: 150, range: 90, cut: 3000, vol: 0.09 },
      burner: { type: 'triangle', base: 70, range: 10, cut: 300, vol: 0.06 },
      train: { type: 'square', base: 46, range: 60, cut: 340, vol: 0.14 },
      mole: { type: 'sawtooth', base: 48, range: 90, cut: 640, vol: 0.2 }
    }
  };
})();
