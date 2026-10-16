/* Procedural soundtrack, sound effects and the host's voice (Main Stage only).
   Music: a 16-step sequencer on Web Audio. Tempo rises as the timer runs down; the harmony
   follows the scoreboard (tight race = minor and tense, clear leader = major, playing the
   leader's own motif); each game has its own key and instrument colour. */
(function () {
  'use strict';
  const PP = window.PP;
  let ac = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;

  function ctx() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    const comp = ac.createDynamicsCompressor(); comp.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.32; musicBus.connect(comp);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(comp);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ac;
  }
  const unlock = () => { const c = ctx(); if (c && c.state === 'suspended') c.resume(); };
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));

  // ---------- voices ----------
  function tone(t, freq, dur, type, gain, bus, glideTo) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || musicBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, gain, freq, q, type, bus) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type || 'highpass'; f.frequency.value = freq; f.Q.value = q || 0.7;
    const g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || musicBus); s.start(t); s.stop(t + dur + 0.02);
  }
  const kick = t => tone(t, 140, 0.32, 'sine', 0.9, musicBus, 42);
  const snare = t => { noise(t, 0.18, 0.4, 1800, 0.8, 'bandpass'); tone(t, 220, 0.08, 'triangle', 0.25); };
  const hat = (t, open) => noise(t, open ? 0.2 : 0.04, 0.16, 7000);
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- music engine ----------
  const STYLES = {
    lobby: { root: 50, bpm: 100, lead: 'triangle', bass: 'sawtooth', swing: 0.08 },
    quip: { root: 53, bpm: 108, lead: 'square', bass: 'sawtooth', swing: 0.12 },
    fib: { root: 55, bpm: 112, lead: 'triangle', bass: 'square', swing: 0.05 },
    draw: { root: 57, bpm: 92, lead: 'sine', bass: 'triangle', swing: 0.15 },
    quiz: { root: 45, bpm: 96, lead: 'sawtooth', bass: 'sawtooth', swing: 0 },
    tee: { root: 52, bpm: 118, lead: 'square', bass: 'sawtooth', swing: 0.1 },
    pitch: { root: 48, bpm: 104, lead: 'triangle', bass: 'square', swing: 0.06 }
  };
  const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
  const PROG = { major: [0, 4, 5, 3], minor: [0, 5, 3, 4] };          // I–V–vi–IV  /  i–VI–iv–v (scale degrees)
  // Each player seat has a four-note motif; the leader's motif becomes the melody.
  const MOTIFS = [[0, 2, 4, 2], [4, 3, 2, 0], [0, 4, 3, 4], [2, 4, 6, 4], [0, 0, 4, 5], [6, 4, 2, 1], [0, 2, 0, 5], [4, 6, 7, 6]];
  const music = { on: false, style: 'lobby', tension: 0, mood: 'minor', leader: -1, intensity: 0.4, step: 0, next: 0, timer: 0, volume: 0.32 };

  function degree(scale, d, oct) { const n = scale.length; const o = Math.floor(d / n); return scale[((d % n) + n) % n] + 12 * (o + (oct || 0)); }
  function schedule() {
    if (!music.on || !ac) return;
    const st = STYLES[music.style] || STYLES.lobby;
    const bpm = st.bpm + music.tension * 58;                              // the clock speeds the band up
    const stepDur = 60 / bpm / 4;
    while (music.next < ac.currentTime + 0.12) {
      const s = music.step % 16, bar = Math.floor(music.step / 16) % 4;
      const t = music.next + (s % 2 ? st.swing * stepDur : 0);
      const scale = music.mood === 'major' ? MAJOR : MINOR;
      const chordDeg = PROG[music.mood][bar];
      const root = st.root;
      // drums: more of them as intensity and tension rise
      if (s % 8 === 0 || (music.tension > 0.6 && s % 4 === 0)) kick(t);
      if (s === 4 || s === 12) snare(t);
      if (music.intensity > 0.25 && s % 2 === 0) hat(t, s === 14);
      if (music.tension > 0.8 && s % 2 === 1) hat(t);
      // bass on the chord root
      if (s % 4 === 0 || (s % 2 === 0 && music.tension > 0.5)) tone(t, mtof(root - 12 + degree(scale, chordDeg)), stepDur * 1.8, st.bass, 0.18);
      // pad chord once per bar
      if (s === 0) [0, 2, 4].forEach(k => tone(t, mtof(root + degree(scale, chordDeg + k)), stepDur * 15, 'triangle', 0.05));
      // melody: the leader's motif, or a gentle arpeggio when nobody leads
      if (s % 4 === 2 || (music.intensity > 0.6 && s % 4 === 0)) {
        const motif = music.leader >= 0 ? MOTIFS[music.leader % 8] : [0, 2, 4, 2];
        const d = chordDeg + motif[(s >> 2) % 4];
        tone(t, mtof(root + 12 + degree(scale, d)), stepDur * 1.6, st.lead, music.leader >= 0 ? 0.07 : 0.045);
      }
      music.next += stepDur; music.step++;
    }
  }

  PP.Audio = {
    unlock,
    startMusic(style) { if (!ctx()) return; music.style = style || music.style; if (music.on) return; music.on = true; music.next = ac.currentTime + 0.05; music.timer = setInterval(schedule, 25); },
    stopMusic() { music.on = false; clearInterval(music.timer); },
    setStyle(style) { music.style = style; },
    /** 0 = plenty of time, 1 = the timer is about to hit zero. */
    setTension(x) { music.tension = PP.clamp(x, 0, 1); },
    setIntensity(x) { music.intensity = PP.clamp(x, 0, 1); },
    /** scores: [{seat, score}]. A runaway leader turns the music major and plays their motif. */
    setStandings(list) {
      const s = list.slice().sort((a, b) => b.score - a.score);
      if (!s.length || s[0].score <= 0) { music.mood = 'minor'; music.leader = -1; return; }
      const gap = s.length > 1 ? (s[0].score - s[1].score) / Math.max(1, s[0].score) : 1;
      music.leader = s[0].seat; music.mood = gap > 0.25 ? 'major' : 'minor';
    },
    setVolume(v) { music.volume = v; if (musicBus) musicBus.gain.value = v; },
    duck(on) { if (musicBus) musicBus.gain.setTargetAtTime(on ? music.volume * 0.4 : music.volume, ac.currentTime, 0.15); },
    sfx(name) {
      if (!ctx()) return; const t = ac.currentTime + 0.01, B = sfxBus;
      switch (name) {
        case 'join': tone(t, 660, 0.12, 'triangle', 0.3, B); tone(t + 0.08, 990, 0.18, 'triangle', 0.3, B); break;
        case 'tick': tone(t, 1200, 0.05, 'square', 0.12, B); break;
        case 'ding': tone(t, 880, 0.4, 'sine', 0.35, B); tone(t, 1320, 0.5, 'sine', 0.2, B); break;
        case 'buzz': tone(t, 110, 0.45, 'sawtooth', 0.3, B); tone(t, 116, 0.45, 'sawtooth', 0.3, B); break;
        case 'reveal': [0, 4, 7, 12].forEach((n, i) => tone(t + i * 0.07, mtof(72 + n), 0.3, 'triangle', 0.25, B)); break;
        case 'point': tone(t, 1046, 0.1, 'square', 0.15, B); tone(t + 0.06, 1568, 0.16, 'square', 0.12, B); break;
        case 'whoosh': noise(t, 0.5, 0.35, 900, 0.5, 'bandpass', B); break;
        case 'kill': tone(t, 300, 0.9, 'sawtooth', 0.3, B, 40); noise(t, 0.6, 0.3, 400, 1, 'lowpass', B); break;
        case 'hype': [0, 4, 7, 11, 14, 19].forEach((n, i) => tone(t + i * 0.05, mtof(67 + n), 0.5, 'square', 0.12, B)); noise(t, 1.2, 0.2, 3000, 0.4, 'highpass', B); break;
        case 'airhorn': [0, 0.18, 0.36].forEach(d => { tone(t + d, 466, 0.16, 'sawtooth', 0.25, B); tone(t + d, 470, 0.16, 'square', 0.12, B); }); break;
        case 'laugh': for (let i = 0; i < 5; i++) tone(t + i * 0.11, 520 - i * 25, 0.09, 'triangle', 0.25, B); break;
        case 'boo': tone(t, 180, 0.8, 'sawtooth', 0.18, B, 120); tone(t, 185, 0.8, 'sawtooth', 0.12, B, 118); break;
        case 'rimshot': snareFx(t); snareFx(t + 0.14); tone(t + 0.36, 600, 0.05, 'square', 0.1, B); noise(t + 0.36, 0.5, 0.25, 6000, 0.7, 'highpass', B); break;
        case 'win': [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => tone(t + i * 0.12, mtof(67 + n), 0.35, 'triangle', 0.25, B)); break;
        case 'pop': tone(t, 500, 0.06, 'sine', 0.2, B, 900); break;
      }
      function snareFx(tt) { noise(tt, 0.15, 0.4, 1800, 0.8, 'bandpass', B); }
    }
  };

  // ---------- host voice ----------
  // Speech synthesis with a per-host pitch and rate, plus on-screen captions (accessibility).
  const voiceState = { on: true, captions: null, queue: [], speaking: false, voices: [] };
  function loadVoices() { try { voiceState.voices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); } catch (e) { /* no speech */ } }
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  function pickVoice(hostKey) {
    const v = voiceState.voices; if (!v.length) return null;
    const prefer = { quiz: /daniel|fred|alex|male|google uk english male/i, fib: /samantha|karen|google us english/i, draw: /moira|serena|tessa|daniel/i, quip: /karen|fiona|victoria|female/i, tee: /rishi|aaron|tom|google us english/i, pitch: /alex|tom|google us english/i };
    const re = prefer[hostKey]; return (re && v.find(x => re.test(x.name))) || v[(Object.keys(PP.HOSTS).indexOf(hostKey) + v.length) % v.length];
  }
  function speakNext() {
    if (voiceState.speaking || !voiceState.queue.length) return;
    const { text, hostKey, resolve } = voiceState.queue.shift(); const host = PP.HOSTS[hostKey] || PP.HOSTS.lobby;
    voiceState.speaking = true;
    if (voiceState.captions) voiceState.captions(host.name, text);
    const done = () => { voiceState.speaking = false; PP.Audio.duck(false); if (voiceState.captions) setTimeout(() => !voiceState.speaking && voiceState.captions(null), 900); resolve(); speakNext(); };
    if (!voiceState.on || !('speechSynthesis' in window)) { setTimeout(done, Math.min(5000, 900 + text.length * 45)); return; }
    try {
      const u = new SpeechSynthesisUtterance(text); u.rate = host.rate; u.pitch = host.pitch; const v = pickVoice(hostKey); if (v) u.voice = v;
      let finished = false; const fin = () => { if (!finished) { finished = true; done(); } };
      u.onend = fin; u.onerror = fin; setTimeout(fin, 2500 + text.length * 90);   // Safari sometimes never fires onend
      PP.Audio.duck(true); speechSynthesis.speak(u);
    } catch (e) { done(); }
  }
  PP.Voice = {
    set on(v) { voiceState.on = v; if (!v) try { speechSynthesis.cancel(); } catch (e) { /* none */ } },
    get on() { return voiceState.on; },
    onCaption(fn) { voiceState.captions = fn; },
    /** Speak a line; returns a promise that resolves when it finishes. Lines drop if the queue is backed up. */
    say(hostKey, text) {
      return new Promise(resolve => {
        if (!text) { resolve(); return; }
        if (voiceState.queue.length > 2) voiceState.queue.splice(0, voiceState.queue.length - 2).forEach(q => q.resolve());
        voiceState.queue.push({ text, hostKey, resolve }); speakNext();
      });
    },
    line(hostKey, key, vars) {
      const h = PP.HOSTS[hostKey] || PP.HOSTS.lobby;
      const set = (h.lines && h.lines[key]) || PP.EDGE[key];
      return set ? PP.fill(PP.pick(set), vars) : '';
    },
    stop() { voiceState.queue.splice(0).forEach(q => q.resolve()); try { speechSynthesis.cancel(); } catch (e) { /* none */ } }
  };
})();
