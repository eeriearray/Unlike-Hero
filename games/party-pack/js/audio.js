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
  // 1. Recorded clips (made in the Voice Booth, #booth): a real human voice, trimmed and played through
  //    a small studio chain (rumble filter, warmth, presence, compression, a touch of room). Each host
  //    gets a "character" (tape speed: deeper and slower, or brighter and quicker).
  // 2. Otherwise the device's best text-to-speech voice, ranked so neural/enhanced voices win and
  //    novelty voices never play, spoken phrase by phrase with natural pauses.
  const V = { on: true, onSpeak: null, queue: [], busy: false, clips: new Map(), buffers: new Map(), fx: null, ttsVoices: [] };
  const DEFAULT_CHAR = { lobby: 1, quip: 0.97, fib: 1.06, draw: 0.94, quiz: 0.86, tee: 1.08, pitch: 1.0 };
  V.character = Object.assign({}, DEFAULT_CHAR, PP.prefs.get('voiceChar', {}));

  // --- clip storage: IndexedDB (this browser) + an optional voice/ folder pack ---
  const DB = {
    open() { return this.p || (this.p = new Promise((res, rej) => { const r = indexedDB.open('party-pack-voice', 1); r.onupgradeneeded = () => r.result.createObjectStore('clips'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
    async tx(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('clips', mode); const st = t.objectStore('clips'); const out = fn(st); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); },
    put(id, blob) { return this.tx('readwrite', st => st.put(blob, id)); },
    del(id) { return this.tx('readwrite', st => st.delete(id)); },
    async all() { const db = await this.open(); return new Promise((res, rej) => { const out = new Map(); const t = db.transaction('clips'); const cur = t.objectStore('clips').openCursor(); cur.onsuccess = () => { const c = cur.result; if (c) { out.set(c.key, c.value); c.continue(); } }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); }); }
  };
  // Folder clips (voice/index.json, uploaded through the Voice Booth and committed with the game) are the
  // shared cast; clips recorded in this browser's Booth without the hub server override them locally.
  async function loadClips() {
    V.clips.clear(); V.buffers.clear();
    if (location.protocol !== 'file:') try {
      const j = await fetch('voice/index.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null);
      if (j && j.clips) for (const [id, file] of Object.entries(j.clips)) V.clips.set(id, 'voice/' + file + '?v=' + encodeURIComponent(file));
    } catch (e) { /* no folder pack */ }
    try { (await DB.all()).forEach((blob, id) => V.clips.set(id, blob)); } catch (e) { /* storage blocked */ }
    if (V.onChange) V.onChange();
  }
  loadClips();

  function chain() {
    if (V.fx || !ctx()) return V.fx;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 85;
    const warm = ac.createBiquadFilter(); warm.type = 'lowshelf'; warm.frequency.value = 220; warm.gain.value = 3;
    const pres = ac.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3200; pres.Q.value = 0.9; pres.gain.value = 2.5;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.18;
    const out = ac.createGain(); out.gain.value = 1.15;
    const verb = ac.createConvolver(); const len = Math.floor(ac.sampleRate * 0.55); const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3.2); }
    verb.buffer = ir; const wet = ac.createGain(); wet.gain.value = 0.11;
    hp.connect(warm); warm.connect(pres); pres.connect(comp); comp.connect(out); out.connect(master); comp.connect(verb); verb.connect(wet); wet.connect(master);
    V.fx = { input: hp }; return V.fx;
  }
  /** Decode a clip once and trim leading/trailing silence. */
  async function buffer(id) {
    if (V.buffers.has(id)) return V.buffers.get(id);
    const src = V.clips.get(id); if (!src || !ctx()) return null;
    const ab = typeof src === 'string' ? await fetch(src).then(r => r.arrayBuffer()) : await src.arrayBuffer();
    const b = await ac.decodeAudioData(ab);
    const d = b.getChannelData(0), thr = 0.02, pad = Math.floor(b.sampleRate * 0.06);
    let a = 0, z = d.length - 1; while (a < z && Math.abs(d[a]) < thr) a++; while (z > a && Math.abs(d[z]) < thr) z--;
    a = Math.max(0, a - pad); z = Math.min(d.length, z + pad * 2);
    const t = ac.createBuffer(1, Math.max(1, z - a), b.sampleRate); t.copyToChannel(d.subarray(a, z), 0);
    V.buffers.set(id, t); return t;
  }
  function playClip(id, hostKey) {
    return buffer(id).then(b => new Promise(resolve => {
      if (!b) { resolve(false); return; }
      // Uploaded voices (folder clips) play as delivered; one-person Booth recordings get the host's voice character.
      const s = ac.createBufferSource(); s.buffer = b; s.playbackRate.value = typeof V.clips.get(id) === 'string' ? 1 : (V.character[hostKey] || 1);
      s.connect(chain().input); s.onended = () => resolve(true); s.start();
      V.stopCurrent = () => { try { s.stop(); } catch (e) { /* already stopped */ } };
    })).catch(() => false);
  }

  // --- text-to-speech fallback ---
  const ROBOTIC = /espeak|zarvox|trinoids|bahh|bells|boing|bubbles|cellos|deranged|hysterical|organ|whisper|good news|bad news|jester|superstar|wobble|albert|junior|ralph|fred|grandpa|grandma|rocko|eddy|flo\b|reed|sandy|shelley|kathy|princess/i;
  const MALE = /\b(male|Guy|Andrew|Christopher|Brian|Eric|Roger|Davis|Tony|Jason|Ryan|Thomas|George|Daniel|Arthur|Oliver|Evan|Nathan|Aaron|Tom|Alex|Rishi|Lee|James|Gordon)\b/i;
  const FEMALE = /\b(female|Aria|Jenny|Sonia|Libby|Natasha|Clara|Emma|Ava|Michelle|Samantha|Karen|Moira|Tessa|Victoria|Zira|Hazel|Susan|Serena|Kate|Fiona|Allison|Joanna|Salli|Kimberly|Ivy|Martha|Stephanie|Catherine|Sara|Amy|Emily|Olivia|Zoe|Nicky)\b/i;
  const HOST_GENDER = { lobby: 'm', quip: 'f', fib: 'm', draw: 'm', quiz: 'm', tee: 'f', pitch: 'm', edge: 'm' };
  function vscore(v, want) {
    if (!/^en([-_]|$)/i.test(v.lang)) return -1000;
    let s = 0; const n = v.name;
    if (/natural|neural|enhanced|premium|studio|wavenet|journey/i.test(n)) s += 120;
    if (/online/i.test(n)) s += 30;
    if (/^Google/i.test(n)) s += 25;
    if (ROBOTIC.test(n)) s -= 400;
    if (/compact|desktop/i.test(n)) s -= 30;
    if (want === 'm' && MALE.test(n)) s += 35; if (want === 'f' && FEMALE.test(n)) s += 35;
    if (/en[-_](GB|AU|IE)/i.test(v.lang)) s += 6;
    return s;
  }
  function loadVoices() { try { V.ttsVoices = speechSynthesis.getVoices(); } catch (e) { V.ttsVoices = []; } }
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  function ttsVoice(hostKey) {
    const want = HOST_GENDER[hostKey] || 'm';
    const list = V.ttsVoices.filter(v => vscore(v, want) > -300).sort((a, b) => vscore(b, want) - vscore(a, want));
    return list[0] || null;
  }
  V.bestVoiceName = () => { const v = ttsVoice('lobby'); return v ? v.name : null; };
  V.hasNaturalVoice = () => V.ttsVoices.some(v => /^en/i.test(v.lang) && /natural|neural|enhanced|premium|online/i.test(v.name));
  function phrases(text) { const out = []; const re = /[^.!?…]+(?:\.\.\.|…|[.!?]+)?/g; let m; while ((m = re.exec(text))) { const t = m[0].trim(); if (t) out.push({ t, pause: /(\.\.\.|…)$/.test(t) ? 520 : /[!?]$/.test(t) ? 260 : 220 }); } return out; }
  function speakTTS(text, hostKey) {
    return new Promise(resolve => {
      if (!('speechSynthesis' in window)) { setTimeout(resolve, Math.min(5000, 900 + text.length * 45)); return; }
      const host = PP.HOSTS[hostKey] || PP.HOSTS.lobby; const voice = ttsVoice(hostKey);
      const parts = phrases(text); let k = 0, done = false;
      const fin = () => { if (!done) { done = true; resolve(); } };
      V.stopCurrent = () => { try { speechSynthesis.cancel(); } catch (e) { /* none */ } fin(); };
      const next = () => {
        if (done) return; if (k >= parts.length) { fin(); return; }
        const p = parts[k++]; const u = new SpeechSynthesisUtterance(p.t);
        if (voice) u.voice = voice;
        // keep the voice's natural pitch; small per-phrase variation so it doesn't drone
        u.pitch = PP.clamp((host.pitch || 1) + (Math.random() - 0.5) * 0.06, 0.8, 1.2);
        u.rate = PP.clamp((host.rate || 1) * (p.t.length < 24 ? 0.97 : 1.02), 0.8, 1.2);
        let ended = false; const go = () => { if (ended) return; ended = true; setTimeout(next, p.pause); };
        u.onend = go; u.onerror = go; setTimeout(go, 1800 + p.t.length * 95);   // Safari sometimes never fires onend
        try { speechSynthesis.speak(u); } catch (e) { go(); }
      };
      next();
    });
  }

  // --- the queue ---
  async function pump() {
    if (V.busy || !V.queue.length) return;
    const item = V.queue.shift(); V.busy = true;
    const { line, hostKey, resolve } = item;
    if (V.onSpeak) V.onSpeak(hostKey, line.text);
    PP.Audio.duck(true);
    let played = false;
    if (V.on && V.clips.has(line.id)) played = await playClip(line.id, hostKey);
    if (!played && V.on) await speakTTS(line.text, hostKey);
    if (!V.on) await PP.sleep(Math.min(4500, 900 + line.text.length * 42));   // voice off: captions still get read time
    PP.Audio.duck(false);
    V.busy = false; V.stopCurrent = null;
    if (V.onSpeak) V.onSpeak(hostKey, null);
    resolve(); pump();
  }
  /** Pick a line for host/key. Recorded lines win, so a partly recorded script still sounds human where it can. */
  function pickLine(hostKey, key) {
    const h = PP.HOSTS[hostKey] || PP.HOSTS.lobby;
    let list = h.lines && h.lines[key] ? h.lines[key].map((t, i) => ({ id: `${hostKey}.${key}.${i}`, text: t })) : null;
    // Shared lines (ties, AFK, hype…) are spoken by the Announcer, whichever game is on.
    if (!list && PP.EDGE[key]) list = PP.EDGE[key].map((t, i) => ({ id: `edge.${key}.${i}`, text: t, speaker: 'edge' }));
    if (!list) return null;
    const rec = list.filter(l => V.clips.has(l.id));
    return PP.pick(rec.length ? rec : list);
  }
  PP.Voice = {
    set on(v) { V.on = v; if (!v && V.stopCurrent) V.stopCurrent(); },
    get on() { return V.on; },
    /** fn(hostKey, text|null): called when a line starts (text) and ends (null). Drives the host's mouth and bubble. */
    onSpeak(fn) { V.onSpeak = fn; },
    onChange(fn) { V.onChange = fn; },
    /** Speak host/key. Resolves when finished. A backed-up queue drops older lines. */
    speak(hostKey, key) {
      const line = pickLine(hostKey, key);
      return new Promise(resolve => {
        if (!line) { resolve(); return; }
        if (V.queue.length > 1) V.queue.splice(0, V.queue.length - 1).forEach(q => q.resolve());
        V.queue.push({ line, hostKey: line.speaker || hostKey, resolve }); pump();
      });
    },
    stop() { V.queue.splice(0).forEach(q => q.resolve()); if (V.stopCurrent) V.stopCurrent(); },
    // --- used by the Voice Booth ---
    clips: V.clips, DB,
    async saveClip(id, blob) { await DB.put(id, blob); V.clips.set(id, blob); V.buffers.delete(id); },
    async deleteClip(id) { await DB.del(id); V.clips.delete(id); V.buffers.delete(id); },
    playClip: (id, hostKey) => { ctx(); unlock(); return playClip(id, hostKey); },
    preview: (text, hostKey) => { unlock(); return speakTTS(text, hostKey); },
    get character() { return V.character; },
    setCharacter(hostKey, rate) { V.character[hostKey] = rate; PP.prefs.set('voiceChar', V.character); },
    reload: loadClips
  };
})();
