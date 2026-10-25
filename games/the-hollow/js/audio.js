/* THE HOLLOW — shared mixer and synthesis fallback. recorded-audio.js adds optional file-backed layers.
 * Missing or undecodable files retain this synthesis. Layers: region ambience (wind, drones, creaks, whispers), adaptive music
 * (pad, shimmer, tension, drums) and event sound effects. Volumes (master / music / ambient / effects) and mute persist.
 * Audio starts after the first click or key press (browser autoplay rules). The game is fully playable muted: every
 * sound can also be shown as a text caption (Settings → "Show sound captions").
 *
 * Add a region: put a profile in REGIONS. Add a sound: put a function in SFX. Add a mood: put gains in MOODS. */
(function (g) {
  'use strict';
  var KEY = 'hollow.audio.v1';
  var DEFAULTS = { master: 0.8, music: 0.55, ambient: 0.75, sfx: 0.85, muted: false, captions: false };
  var mediaFocus = false;
  var S = Object.assign({}, DEFAULTS);
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage blocked */ }

  var ctx = null, master, comp, busM, busA, busS, rev, revA, noiseBuf, synthM, synthA, started = false;
  var capFn = null, lastSfx = {}, voices = 0;
  var region = 'title', level = 0, mood = 'explore';
  var amb = null, music = null, schedTimer = null, ambTimer = null, drumTimer = null;

  var REGIONS = {
    title:   { root: 55, wind: 0.25, filt: 380, flavor: ['whisper', 'bellFar', 'breath', 'chime'], rate: 14, tempo: 9000 },
    village: { root: 55, wind: 0.55, filt: 520, flavor: ['crow', 'bellFar', 'creak', 'whisper', 'chains', 'moan'], rate: 9, tempo: 8000 },
    estate:  { root: 49, wind: 0.2,  filt: 300, flavor: ['creak', 'clock', 'whisper', 'scratch', 'chime', 'breath'], rate: 7, tempo: 7500 },
    woods:   { root: 58, wind: 0.8,  filt: 640, flavor: ['owl', 'creak', 'whisper', 'crow', 'insects', 'breath', 'thunder'], rate: 8, tempo: 10000 },
    abbey:   { root: 46, wind: 0.3,  filt: 340, flavor: ['choir', 'bellFar', 'whisper', 'drip', 'pipe', 'chains', 'moan'], rate: 7, choir: true, tempo: 11000 },
    crypt:   { root: 41, wind: 0.12, filt: 260, flavor: ['drip', 'drip', 'whisper', 'creak', 'scratch', 'chains', 'rattle'], rate: 6, wet: 1, tempo: 6500 },
    heart:   { root: 36, wind: 0.2,  filt: 220, flavor: ['heartbeat', 'whisper', 'bellFar', 'moan', 'breath', 'groan'], rate: 5, heart: true, tempo: 5500 }
  };
  // A place can add its own sounds to the region's ambience (the Silent Square: water falling upward, the lantern
  // string creaking, the empty tower's bell). Add a place: list FLAV names here.
  var PLACES = {
    square: ['wellUp', 'wellUp', 'lanternCreak', 'bellFar'],
    chapel: ['creak', 'whisper', 'pipe', 'breath'], nursery: ['cradle', 'whisper', 'chime', 'breath'],
    belltower: ['bellFar', 'bellFar', 'creak', 'chains'],
    graveyard: ['crow', 'scratch', 'whisper', 'moan'], bridge: ['creak', 'chains', 'whisper'],
    gate: ['chains', 'creak', 'whisper'], wagon: ['creak', 'lanternCreak', 'crow'],
    moonwell: ['drip', 'whisper', 'chime', 'breath'], shrine: ['pipe', 'whisper', 'chime'],
    cabin: ['creak', 'breath', 'owl'], forge: ['chains', 'scratch', 'creak'],
    ossuary: ['rattle', 'breath', 'whisper', 'drip'], tomb: ['scratch', 'moan', 'drip', 'breath'],
    prison: ['chains', 'scratch', 'moan', 'drip'], ritual: ['pipe', 'whisper', 'bellFar', 'chime'],
    mirror: ['chime', 'whisper', 'breath']
  };
  var place = null;
  var MOODS = {    // pad, shimmer, tension, drums, brass
    explore: [0.55, 0.22, 0.0, 0.0, 0.0], quiet: [0.25, 0.08, 0.0, 0.0, 0.0], danger: [0.40, 0.04, 0.55, 0.0, 0.0], combat: [0.25, 0.0, 0.50, 0.85, 0.0],
    boss: [0.25, 0.0, 0.60, 1.0, 0.65], victory: [0.65, 0.50, 0.0, 0.0, 0.0], defeat: [0.40, 0.0, 0.35, 0.0, 0.0], silence: [0, 0, 0, 0, 0]
  };

  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  function vol(bus) { return S.muted ? 0 : S[bus]; }

  function init() {
    if (ctx) return true;
    var AC = g.AudioContext || g.webkitAudioContext; if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25;
    master.connect(comp); comp.connect(ctx.destination);
    busM = ctx.createGain(); busA = ctx.createGain(); busS = ctx.createGain();
    busM.connect(master); busA.connect(master); busS.connect(master);
    synthM = ctx.createGain(); synthA = ctx.createGain(); synthM.connect(busM); synthA.connect(busA);
    // reverb: a generated impulse response (dark, long)
    rev = ctx.createConvolver();
    var len = ctx.sampleRate * 2.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    rev.buffer = ir;
    var revG = ctx.createGain(); revG.gain.value = 0.35; rev.connect(revG); revG.connect(busS);
    // Wet tails obey their own category slider and the shared dialog ducking.
    revA = ctx.createConvolver(); revA.buffer = ir;
    var ambientWet = ctx.createGain(); ambientWet.gain.value = .35; revA.connect(ambientWet); ambientWet.connect(busA);
    // noise
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var nd = noiseBuf.getChannelData(0); for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
    applyVolumes(true);
    return true;
  }

  function applyVolumes(instant) {
    if (!ctx) return;
    var t = ctx.currentTime, k = instant ? 0.01 : 0.12;
    master.gain.setTargetAtTime(S.muted || mediaFocus ? 0 : S.master, t, k);
    busM.gain.setTargetAtTime(S.music, t, k); busA.gain.setTargetAtTime(S.ambient, t, k); busS.gain.setTargetAtTime(S.sfx, t, k);
  }

  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    if (!started) { started = true; buildMusic(); setRegion(region, true); scheduleDrums(); }
  }

  // ───────────────────────────── building blocks ─────────────────────────────
  function noiseSrc(loop) { var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = !!loop; return s; }
  function env(gainNode, t, a, d, peak, sustain) {
    var p = gainNode.gain; p.cancelScheduledValues(t); p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a); p.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + d);
  }
  function tone(f, dur, type, peak, when, f2, dest, wet) {
    var t = (when || ctx.currentTime), o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(gn, t, Math.min(0.02, dur / 4), dur, peak || 0.2);
    o.connect(gn); gn.connect(dest || busS); if (wet) gn.connect(dest === busA || dest === synthA ? revA : rev);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function burst(dur, type, f0, f1, peak, when, q, dest, wet) {
    var t = when || ctx.currentTime, s = noiseSrc(false), bp = ctx.createBiquadFilter(), gn = ctx.createGain();
    bp.type = type || 'bandpass'; bp.frequency.setValueAtTime(f0, t); if (f1) bp.frequency.exponentialRampToValueAtTime(f1, t + dur); bp.Q.value = q || 1;
    env(gn, t, Math.min(0.015, dur / 3), dur, peak || 0.2);
    s.connect(bp); bp.connect(gn); gn.connect(dest || busS); if (wet) gn.connect(dest === busA || dest === synthA ? revA : rev);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function bellHit(f, peak, when, dest, long) {
    var t = when || ctx.currentTime, dur = long ? 5.2 : 3.5, pk = peak || 0.2;
    // Gothic church bell partials: hum (0.5), prime doublet (0.995, 1.005), tierce (1.189), tritone (1.414), quint (1.5), nominal (2.0)
    var modes = [
      [0.5, 0.8, dur],
      [0.995, 0.95, dur * 0.85],
      [1.005, 0.95, dur * 0.85],
      [1.189, 0.75, dur * 0.75],
      [1.414, 0.55, dur * 0.65],
      [1.5, 0.5, dur * 0.6],
      [2.0, 0.4, dur * 0.45],
      [2.38, 0.25, dur * 0.3]
    ];
    modes.forEach(function (m) {
      tone(f * m[0], m[2], 'sine', pk * m[1], t, null, dest, true);
    });
    // Low heavy clapper impact thump
    burst(0.08, 'lowpass', 110, 42, pk * 0.45, t, 1.2, dest, true);
  }

  // ───────────────────────────── ambience ─────────────────────────────
  function killNodes(set, fade) {
    if (!set) return;
    var t = ctx.currentTime;
    set.out.gain.setTargetAtTime(0, t, fade || 1.2);
    setTimeout(function () { set.srcs.forEach(function (s) { try { s.stop(); } catch (e) { /* stopped */ } }); try { set.out.disconnect(); } catch (e) { /* gone */ } }, (fade || 1.2) * 5000);
  }

  function buildAmbience(name) {
    var P = REGIONS[name] || REGIONS.title, srcs = [], out = ctx.createGain(); out.gain.value = 0.0001; out.connect(synthA);
    out.gain.setTargetAtTime(1, ctx.currentTime, 1.4);
    // wind — filtered noise with slow modulation
    var w = noiseSrc(true), wf = ctx.createBiquadFilter(), wg = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    wf.type = 'bandpass'; wf.frequency.value = P.filt; wf.Q.value = 1.1;
    wg.gain.value = 0.05 + P.wind * 0.12;
    lfo.frequency.value = 0.07 + Math.random() * 0.08; lg.gain.value = P.wind * 0.07;
    lfo.connect(lg); lg.connect(wg.gain); w.connect(wf); wf.connect(wg); wg.connect(out);
    w.start(); lfo.start(); srcs.push(w, lfo);
    // secondary wind — higher pitched with slower modulation for depth
    var w2 = noiseSrc(true), w2f = ctx.createBiquadFilter(), w2g = ctx.createGain();
    w2f.type = 'bandpass'; w2f.frequency.value = P.filt * 1.8; w2f.Q.value = 2.5;
    w2g.gain.value = P.wind * 0.04;
    var lfo2 = ctx.createOscillator(), lg2 = ctx.createGain();
    lfo2.frequency.value = 0.03 + Math.random() * 0.04; lg2.gain.value = P.wind * 0.03;
    lfo2.connect(lg2); lg2.connect(w2g.gain); w2.connect(w2f); w2f.connect(w2g); w2g.connect(out);
    w2.start(); lfo2.start(); srcs.push(w2, lfo2);
    // drone: root + fifth + sub, slowly detuning with organic movement
    var dg = ctx.createGain(), df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 260 + P.filt * 0.3; dg.gain.value = 0.13;
    df.connect(dg); dg.connect(out);
    var droneNodes = [];
    [1, 1.5, 0.5].forEach(function (m, i) {
      var o = ctx.createOscillator(), og = ctx.createGain(); o.type = i === 0 ? 'sawtooth' : 'triangle'; o.frequency.value = P.root * m + (i - 1) * 0.3; og.gain.value = [0.5, 0.25, 0.6][i];
      var l = ctx.createOscillator(), lgn = ctx.createGain(); l.frequency.value = 0.05 + i * 0.03; lgn.gain.value = 0.6; l.connect(lgn); lgn.connect(o.detune);
      o.connect(og); og.connect(df); o.start(); l.start(); srcs.push(o, l); droneNodes.push(o);
    });
    // sub-harmonic rumble — deep sub-bass presence
    var subO = ctx.createOscillator(), subG = ctx.createGain(), subF = ctx.createBiquadFilter();
    subO.type = 'sine'; subO.frequency.value = P.root * 0.25; subG.gain.value = 0.08;
    subF.type = 'lowpass'; subF.frequency.value = 80;
    var subLfo = ctx.createOscillator(), subLg = ctx.createGain();
    subLfo.frequency.value = 0.04; subLg.gain.value = 0.04;
    subLfo.connect(subLg); subLg.connect(subG.gain);
    subO.connect(subF); subF.connect(subG); subG.connect(out); subO.start(); subLfo.start(); srcs.push(subO, subLfo);
    // dissonance, brought in by the Haunting — tritone interference
    var dis = ctx.createOscillator(), disg = ctx.createGain(); dis.type = 'sawtooth'; dis.frequency.value = P.root * 1.06; disg.gain.value = 0; dis.connect(disg); disg.connect(df); dis.start(); srcs.push(dis);
    // secondary dissonance — minor second cluster for extreme dread
    var dis2 = ctx.createOscillator(), dis2g = ctx.createGain(); dis2.type = 'triangle'; dis2.frequency.value = P.root * 1.02; dis2g.gain.value = 0; dis2.connect(dis2g); dis2g.connect(df); dis2.start(); srcs.push(dis2);
    // metallic resonance layer — filtered noise with high Q for spectral sheen
    var metalN = noiseSrc(true), metalF = ctx.createBiquadFilter(), metalG = ctx.createGain();
    metalF.type = 'bandpass'; metalF.frequency.value = P.root * 8; metalF.Q.value = 18;
    metalG.gain.value = 0.0; metalN.connect(metalF); metalF.connect(metalG); metalG.connect(out); metalG.connect(revA);
    metalN.start(); srcs.push(metalN);
    // choir / heart extras
    var extra = null;
    if (P.choir) {
      extra = ctx.createGain(); extra.gain.value = 0.06; extra.connect(out); extra.connect(revA);
      [2, 3, 4.5, 6].forEach(function (m, i) { var o = ctx.createOscillator(); o.type = i < 2 ? 'triangle' : 'sine'; o.frequency.value = P.root * m * 2; var vg = ctx.createGain(); vg.gain.value = 0.25 - i * 0.04; var l = ctx.createOscillator(), lgn = ctx.createGain(); l.frequency.value = 0.08 + i * 0.03; lgn.gain.value = 0.3; l.connect(lgn); lgn.connect(vg.gain); o.connect(vg); vg.connect(extra); o.start(); l.start(); srcs.push(o, l); });
    }
    return { name: name, out: out, srcs: srcs, dis: disg, dis2: dis2g, metal: metalG, wind: wg, wind2: w2g, windBase: 0.05 + P.wind * 0.12, df: df, P: P };
  }

  function setRegion(name, force) {
    if (!REGIONS[name]) name = 'title';
    region = name;
    if (!ctx || !started) return;
    if (amb && amb.name === name && !force) return;
    killNodes(amb, 1.6);
    amb = buildAmbience(name);
    applyLevel();
    clearTimeout(ambTimer); scheduleFlavor();
  }

  function setPlace(p) { place = p || null; }
  function setLevel(l) { level = Math.max(0, Math.min(1, l)); applyLevel(); }
  function applyLevel() {
    if (!ctx || !amb) return;
    var t = ctx.currentTime;
    amb.dis.gain.setTargetAtTime(level * level * 0.22, t, 2);
    if (amb.dis2) amb.dis2.gain.setTargetAtTime(level * level * level * 0.14, t, 2.5);
    if (amb.metal) amb.metal.gain.setTargetAtTime(level * level * 0.015, t, 3);
    amb.wind.gain.setTargetAtTime(amb.windBase * (1 + level * 0.9), t, 2);
    if (amb.wind2) amb.wind2.gain.setTargetAtTime(amb.P.wind * 0.04 * (1 + level * 1.5), t, 2.5);
    amb.df.frequency.setTargetAtTime(amb.P.filt * 0.3 + 260 + level * 160, t, 2);
  }

  function scheduleFlavor() {
    if (!ctx || !amb || S.muted) { ambTimer = setTimeout(scheduleFlavor, 4000); return; }
    var P = amb.P, gap = (P.rate * (1.4 - level * 0.7)) * (0.6 + Math.random() * 0.9) * 1000;
    ambTimer = setTimeout(function () {
      if (!ctx || document.hidden) { scheduleFlavor(); return; }
      var spots = place && PLACES[place], which = spots && Math.random() < 0.6 ? spots[Math.floor(Math.random() * spots.length)] : P.flavor[Math.floor(Math.random() * P.flavor.length)];
      if (which === 'whisper' && level < 0.1 && Math.random() < 0.5) which = 'creak';
      if (FLAV[which]) FLAV[which](busA);
      scheduleFlavor();
    }, gap);
  }
  var FLAV = {
    creak: function (d) { var t = ctx.currentTime; var o = ctx.createOscillator(), gn = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70 + Math.random() * 40, t); o.frequency.linearRampToValueAtTime(110 + Math.random() * 60, t + 1.2); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 9; env(gn, t, 0.3, 1.1, 0.07); o.connect(f); f.connect(gn); gn.connect(d); gn.connect(revA); o.start(t); o.stop(t + 1.6); },
    whisper: function (d) { var t = ctx.currentTime, p = 0.025 + level * 0.07; for (var i = 0; i < 3 + Math.floor(level * 3); i++) burst(0.5 + Math.random() * 0.5, 'bandpass', 1200 + Math.random() * 1800, 700 + Math.random() * 900, p, t + i * (0.35 + Math.random() * 0.4), 5, d, true); },
    bellFar: function (d) { var t = ctx.currentTime; var dn = ctx.createGain(); dn.gain.value = 0.12; dn.connect(d); bellHit(73.4 + Math.random() * 8, 0.14, t, dn, true); },
    crow: function (d) { var t = ctx.currentTime; for (var i = 0; i < 2 + Math.floor(Math.random() * 2); i++) burst(0.22, 'bandpass', 900, 450, 0.06, t + i * 0.32, 4, d); },
    owl: function (d) { var t = ctx.currentTime; tone(330, 0.5, 'sine', 0.05, t, 300, d, true); tone(300, 0.7, 'sine', 0.05, t + 0.7, 260, d, true); },
    clock: function (d) { var t = ctx.currentTime; for (var i = 0; i < 6; i++) tone(1200, 0.04, 'square', 0.025, t + i * 0.5, null, d); },
    drip: function (d) { var t = ctx.currentTime; tone(900 + Math.random() * 400, 0.12, 'sine', 0.07, t, 400, d, true); if (Math.random() < 0.5) tone(700, 0.14, 'sine', 0.04, t + 0.4, 330, d, true); },
    choir: function (d) { var t = ctx.currentTime; [220, 261.6, 329.6].forEach(function (f, i) { var o = tone(f * (Math.random() < 0.5 ? 1 : 1.5), 4.5, 'triangle', 0.035, t + i * 0.25, null, d, true); }); },
    // drops that fall the wrong way: short plinks that rise in pitch, a slow upward trickle under them
    wellUp: function (d) { var t = ctx.currentTime; for (var i = 0; i < 4 + Math.floor(Math.random() * 3); i++) { var f = 520 + i * 90 + Math.random() * 60; tone(f, 0.09, 'sine', 0.05, t + i * (0.16 + Math.random() * 0.12), f * 1.9, d, true); } burst(1.6, 'bandpass', 700, 1800, 0.02, t, 4, d, true); },
    lanternCreak: function (d) { var t = ctx.currentTime; var o = ctx.createOscillator(), gn = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t); o.frequency.linearRampToValueAtTime(240, t + 0.5); o.frequency.linearRampToValueAtTime(170, t + 0.9); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 12; env(gn, t, 0.15, 0.8, 0.03); o.connect(f); f.connect(gn); gn.connect(d); o.start(t); o.stop(t + 1.1); },
    cradle: function (d) { var t = ctx.currentTime; for (var i = 0; i < 3; i++) { burst(0.3, 'bandpass', 300, 260, 0.05, t + i * 0.9, 6, d); } },
    heartbeat: function (d) { var t = ctx.currentTime; for (var i = 0; i < 4; i++) { tone(52, 0.18, 'sine', 0.22, t + i * 1.0, 38, d, false); tone(48, 0.16, 'sine', 0.16, t + i * 1.0 + 0.24, 36, d, false); } },
    // ── new horror flavors ──
    chains: function (d) { var t = ctx.currentTime; for (var i = 0; i < 5 + Math.floor(Math.random() * 4); i++) { var at = t + i * (0.08 + Math.random() * 0.06); burst(0.04 + Math.random() * 0.03, 'bandpass', 2800 + Math.random() * 2200, 1600, 0.05 + Math.random() * 0.03, at, 8 + Math.random() * 6, d, true); } },
    breath: function (d) { var t = ctx.currentTime, dur = 2.5 + Math.random() * 1.5; burst(dur * 0.45, 'bandpass', 400 + Math.random() * 200, 800, 0.04, t, 3, d, true); burst(dur * 0.4, 'bandpass', 700, 350, 0.035, t + dur * 0.55, 2.5, d, true); },
    scratch: function (d) { var t = ctx.currentTime; for (var i = 0; i < 3; i++) { var at = t + i * (0.3 + Math.random() * 0.2); burst(0.15 + Math.random() * 0.12, 'highpass', 1800 + Math.random() * 1400, 900, 0.04, at, 4, d); } },
    moan: function (d) { var t = ctx.currentTime, f = 90 + Math.random() * 40; tone(f, 2.8, 'sine', 0.05, t, f * 0.7, d, true); tone(f * 1.5, 2.2, 'triangle', 0.025, t + 0.2, f, d, true); var vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 4 + Math.random() * 3; vg.gain.value = 6; vib.connect(vg); vib.start(t); vib.stop(t + 2.8); },
    thunder: function (d) { var t = ctx.currentTime; burst(3.5, 'lowpass', 120, 40, 0.08 + Math.random() * 0.06, t + Math.random() * 0.5, 0.8, d, true); burst(0.5, 'lowpass', 200, 60, 0.12, t + 0.8 + Math.random() * 0.6, 1, d, true); },
    chime: function (d) { var t = ctx.currentTime; for (var i = 0; i < 3 + Math.floor(Math.random() * 3); i++) { var f = 1800 + Math.random() * 2400; tone(f, 1.2 + Math.random() * 0.8, 'sine', 0.03 + Math.random() * 0.02, t + i * (0.4 + Math.random() * 0.5), f * 0.995, d, true); } },
    insects: function (d) { var t = ctx.currentTime, f = 3200 + Math.random() * 1800; var o = ctx.createOscillator(), gn = ctx.createGain(), bp = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 15; var trem = ctx.createOscillator(), tg = ctx.createGain(); trem.frequency.value = 12 + Math.random() * 8; tg.gain.value = 0.015; trem.connect(tg); tg.connect(gn.gain); env(gn, t, 0.8, 2.5, 0.025); o.connect(bp); bp.connect(gn); gn.connect(d); o.start(t); o.stop(t + 3.5); trem.start(t); trem.stop(t + 3.5); },
    pipe: function (d) { var t = ctx.currentTime, f = (REGIONS[region] || REGIONS.abbey).root * 2; [1, 2, 3, 4].forEach(function (m, i) { tone(f * m, 4.5, i < 2 ? 'triangle' : 'sine', 0.04 / (1 + i * 0.5), t + i * 0.1, null, d, true); }); },
    rattle: function (d) { var t = ctx.currentTime; for (var i = 0; i < 6 + Math.floor(Math.random() * 4); i++) { burst(0.025, 'bandpass', 3500 + Math.random() * 2000, 2000, 0.06, t + i * (0.06 + Math.random() * 0.04), 10, d); } },
    groan: function (d) { var t = ctx.currentTime; var o = ctx.createOscillator(), gn = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(35 + Math.random() * 15, t); o.frequency.linearRampToValueAtTime(20 + Math.random() * 10, t + 3); f.type = 'lowpass'; f.frequency.value = 180; f.Q.value = 3; env(gn, t, 1.2, 2.8, 0.06); o.connect(f); f.connect(gn); gn.connect(d); gn.connect(revA); o.start(t); o.stop(t + 4.2); }
  };

  // ───────────────────────────── music ─────────────────────────────
  // Region-specific chord progressions: each set has its own harmonic character
  var REGION_CHORDS = {
    title:   [[0, 3, 7, 12], [-5, 0, 4, 9], [-7, -2, 2, 7], [-3, 1, 4, 8]],
    village: [[0, 3, 7, 10], [-2, 3, 7, 12], [-5, 0, 3, 8], [-3, 1, 6, 10]],
    estate:  [[0, 3, 6, 9], [-1, 2, 5, 11], [-4, 0, 3, 7], [-2, 1, 6, 10]],
    woods:   [[0, 7, 12, 19], [-5, 2, 7, 14], [-3, 4, 12, 16], [-7, 0, 5, 12]],
    abbey:   [[0, 7, 12, 19], [-2, 5, 12, 17], [0, 5, 12, 17], [-5, 0, 7, 12]],
    crypt:   [[0, 1, 5, 6], [-1, 3, 4, 8], [-3, 0, 1, 7], [-5, -1, 2, 6]],
    heart:   [[0, 6, 12, 18], [-1, 5, 11, 17], [0, 1, 6, 13], [-6, 0, 6, 12]]
  };
  function buildMusic() {
    var out = ctx.createGain(); out.connect(synthM);
    var padG = ctx.createGain(), shG = ctx.createGain(), tnG = ctx.createGain(), brG = ctx.createGain(), drG = ctx.createGain();
    [padG, shG, tnG, brG, drG].forEach(function (n) { n.gain.value = 0; n.connect(out); });
    // pad: 4 oscillators with slow organic detuning through a dark lowpass
    var pf = ctx.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 700; pf.Q.value = 1.5; pf.connect(padG);
    var pads = [0, 1, 2, 3].map(function (i) {
      var o = ctx.createOscillator(); o.type = i % 2 ? 'sine' : 'triangle'; o.frequency.value = 110;
      var og = ctx.createGain(); og.gain.value = 0.20;
      // slow organic detune LFO per voice for spectral motion
      var dl = ctx.createOscillator(), dg = ctx.createGain();
      dl.frequency.value = 0.03 + i * 0.012; dg.gain.value = 3 + i * 1.5;
      dl.connect(dg); dg.connect(o.detune); dl.start();
      o.connect(og); og.connect(pf); o.start(); return o;
    });
    // spectral shimmer: high ethereal tones, detuned, phasing slowly
    var spG = ctx.createGain(); spG.gain.value = 0; spG.connect(out);
    var spF = ctx.createBiquadFilter(); spF.type = 'bandpass'; spF.frequency.value = 2200; spF.Q.value = 3; spF.connect(spG);
    [3, 4.02, 5.97].forEach(function (m, i) {
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 55 * m;
      var og = ctx.createGain(); og.gain.value = 0.06;
      var sl = ctx.createOscillator(), sg = ctx.createGain();
      sl.frequency.value = 0.06 + i * 0.02; sg.gain.value = 0.05;
      sl.connect(sg); sg.connect(og.gain);
      o.connect(og); og.connect(spF); o.start(); sl.start();
    });
    // tension: tritone cluster with tremolo and pitch instability
    var tf = ctx.createBiquadFilter(); tf.type = 'lowpass'; tf.frequency.value = 600; tf.connect(tnG);
    [110, 155.6, 77.8].forEach(function (f, i) {
      var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      var og = ctx.createGain(); og.gain.value = i < 2 ? 0.10 : 0.07;
      // pitch wobble
      var wl = ctx.createOscillator(), wg = ctx.createGain();
      wl.frequency.value = 0.15 + i * 0.08; wg.gain.value = 4;
      wl.connect(wg); wg.connect(o.detune); wl.start();
      o.connect(og); og.connect(tf); o.start();
    });
    var trem = ctx.createOscillator(), tg = ctx.createGain(); trem.frequency.value = 4.5; tg.gain.value = 0.35; trem.connect(tg); tg.connect(tnG.gain); trem.start();
    // sub-bass pulse: deep rhythmic presence for combat/boss
    var sbG = ctx.createGain(); sbG.gain.value = 0; sbG.connect(out);
    var sbF = ctx.createBiquadFilter(); sbF.type = 'lowpass'; sbF.frequency.value = 90; sbF.connect(sbG);
    var sbO = ctx.createOscillator(); sbO.type = 'sine'; sbO.frequency.value = 36; sbO.connect(sbF); sbO.start();
    var sbLfo = ctx.createOscillator(), sbLg = ctx.createGain();
    sbLfo.frequency.value = 0.8; sbLg.gain.value = 0.18;
    sbLfo.connect(sbLg); sbLg.connect(sbG.gain); sbLfo.start();
    // brass swell for the boss — darker, with more voices
    var bf = ctx.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = 400; bf.connect(brG);
    [55, 82.4, 110, 46.2].forEach(function (f, i) {
      var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      var og = ctx.createGain(); og.gain.value = i < 3 ? 0.15 : 0.10;
      var bl = ctx.createOscillator(), bg = ctx.createGain();
      bl.frequency.value = 0.12 + i * 0.04; bg.gain.value = 5;
      bl.connect(bg); bg.connect(o.detune); bl.start();
      o.connect(og); og.connect(bf); o.start();
    });
    music = { out: out, padG: padG, shG: shG, spG: spG, tnG: tnG, brG: brG, drG: drG, sbG: sbG, pads: pads, pf: pf, tf: tf, bf: bf, step: 0 };
    applyMood(true);
    var advance = function () {
      if (!ctx) return;
      var P = REGIONS[region] || REGIONS.title, root = P.root;
      var chords = REGION_CHORDS[region] || REGION_CHORDS.title;
      var ch = chords[music.step++ % chords.length], t = ctx.currentTime;
      music.pads.forEach(function (o, i) { o.frequency.setTargetAtTime(root * Math.pow(2, (ch[i] + (i > 1 ? 12 : 0)) / 12) * 2, t, 2.4); });
      // shimmer: occasional high note from the chord, region-colored
      if (!S.muted && mood !== 'silence' && Math.random() < 0.5 && MOODS[mood][1] > 0) {
        var note = root * 4 * Math.pow(2, ch[Math.floor(Math.random() * 4)] / 12);
        tone(note, 3.2, 'sine', 0.04 * (MOODS[mood][1] / 0.22), t + 1 + Math.random() * 2, null, synthM, false);
        // occasional second shimmer note a fifth up for richness
        if (Math.random() < 0.3) tone(note * 1.5, 2.8, 'sine', 0.025 * (MOODS[mood][1] / 0.22), t + 2 + Math.random() * 2, null, synthM, false);
      }
      // adapt pad filter darkness to region
      music.pf.frequency.setTargetAtTime(500 + P.filt * 0.4, t, 3);
    };
    advance(); clearInterval(schedTimer);
    schedTimer = setInterval(advance, (REGIONS[region] || REGIONS.title).tempo || 8000);
  }
  function applyMood(instant) {
    if (!ctx || !music) return;
    var m = MOODS[mood] || MOODS.explore, t = ctx.currentTime, k = instant ? 0.05 : 1.1;
    music.padG.gain.setTargetAtTime(m[0] * 0.5, t, k);
    music.shG.gain.setTargetAtTime(m[1], t, k);
    if (music.spG) music.spG.gain.setTargetAtTime(m[1] * 0.6, t, k); // spectral follows shimmer
    music.tnG.gain.setTargetAtTime(m[2] * 0.4, t, k);
    music.drG.gain.setTargetAtTime(m[3], t, k);
    music.brG.gain.setTargetAtTime(m[4] * 0.3, t, k * 1.4);
    if (music.sbG) music.sbG.gain.setTargetAtTime(m[3] * 0.2 + m[4] * 0.15, t, k); // sub-bass in combat/boss
    // tension filter opens with danger
    if (music.tf) music.tf.frequency.setTargetAtTime(400 + m[2] * 600, t, k * 1.5);
    // brass filter opens for boss
    if (music.bf) music.bf.frequency.setTargetAtTime(300 + m[4] * 400, t, k * 2);
  }
  function setMood(m) { if (!MOODS[m]) m = 'explore'; if (m === mood) return; mood = m; applyMood(false); }

  function scheduleDrums() {
    clearInterval(drumTimer); var beat = 0, swing = 0;
    drumTimer = setInterval(function () {
      if (!ctx || S.muted || !started) return;
      var m = MOODS[mood]; if (!m || m[3] <= 0) return;
      var t = ctx.currentTime, boss = mood === 'boss';
      swing = (swing + 1) % 16;
      // kick: on 1, sometimes on 3 (combat), heavy on 1+3 (boss)
      if (swing % 4 === 0 || (boss && swing % 4 === 2)) {
        tone(65, 0.32, 'sine', 0.38 * m[3], t, 32, synthM);
        burst(0.06, 'lowpass', 350, 80, 0.14 * m[3], t, 1, synthM);
      }
      // ghost kick for boss (offbeat)
      if (boss && swing % 4 === 3) tone(48, 0.28, 'sine', 0.22, t, 28, synthM);
      // hat / metallic tick
      if (swing % 2 === 1) burst(0.04, 'highpass', 5500, 7000, 0.035 * m[3], t, 1.5, synthM);
      // accent: rim hit on upbeats for variation
      if (swing === 5 || swing === 13) burst(0.03, 'bandpass', 1200, 800, 0.06 * m[3], t, 8, synthM);
      // boss: heavy toms and chain rattle
      if (boss && swing % 8 === 6) {
        tone(82, 0.45, 'sine', 0.28, t, 41, synthM);
        for (var i = 0; i < 3; i++) burst(0.02, 'bandpass', 3000 + i * 800, 1500, 0.04, t + i * 0.04, 10, synthM);
      }
      beat++;
    }, 310);
  }

  // ───────────────────────────── sound effects ─────────────────────────────
  var SFX = {
    hero: { cd: 90, cap: '', f: function () { var t = ctx.currentTime; tone(330, 0.22, 'triangle', 0.1, t, null, null, true); tone(495, 0.4, 'sine', 0.08, t + 0.05, null, null, true); burst(0.18, 'bandpass', 900, 500, 0.05, t, 3); } },
    confirm: { cd: 300, cap: 'Hero chosen.', f: function () { var t = ctx.currentTime; [196, 294, 392, 587].forEach(function (f, i) { tone(f, 1.3, 'triangle', 0.11, t + i * 0.09, null, null, true); }); bellHit(98, 0.12, t + 0.1, null, true); } },
    arrive: { cd: 500, cap: 'You arrive.', f: function () { var t = ctx.currentTime; burst(0.5, 'lowpass', 500, 120, 0.12, t, 1, null, true); tone(165, 1.4, 'sine', 0.09, t, 140, null, true); } },
    zoom: { cd: 250, cap: '', f: function () { var t = ctx.currentTime; burst(0.5, 'bandpass', 300, 1400, 0.05, t, 1.4, null, true); } },
    paper: { cd: 250, cap: 'Paper rustles.', f: function () { var t = ctx.currentTime; for (var i = 0; i < 5; i++) burst(0.06 + Math.random() * 0.06, 'highpass', 2500 + Math.random() * 2500, 4000, 0.05 + Math.random() * 0.04, t + i * 0.06 + Math.random() * 0.04, 1); } },
    water: { cd: 400, cap: 'Water trickles upward.', f: function () { var t = ctx.currentTime; for (var i = 0; i < 7; i++) { var f = 480 + i * 70 + Math.random() * 50; tone(f, 0.08, 'sine', 0.07, t + i * 0.11, f * 2, null, true); } burst(1.2, 'bandpass', 600, 2000, 0.04, t, 3, null, true); } },
    creak: { cd: 400, cap: 'Old wood creaks.', f: function () { var t = ctx.currentTime; var o = ctx.createOscillator(), gn = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(80, t); o.frequency.linearRampToValueAtTime(140, t + 0.6); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 9; env(gn, t, 0.08, 0.6, 0.09); o.connect(f); f.connect(gn); gn.connect(busS); o.start(t); o.stop(t + 0.8); } },
    bell: { cd: 800, cap: 'A bell, far away, from an empty tower.', f: function () { bellHit(73.4, 0.2, ctx.currentTime, null, true); } },
    ignite: { cd: 400, cap: 'A flame catches.', f: function () { var t = ctx.currentTime; burst(0.5, 'lowpass', 300, 2400, 0.16, t, 0.8, null, true); for (var i = 0; i < 6; i++) burst(0.03, 'highpass', 3000, 3000, 0.04, t + 0.2 + Math.random() * 0.6, 1); tone(220, 1.2, 'sine', 0.05, t + 0.1, 330, null, true); } },
    snuff: { cd: 400, cap: 'A lantern gutters out.', f: function () { var t = ctx.currentTime; burst(0.35, 'lowpass', 1600, 200, 0.12, t, 1); tone(140, 0.6, 'sine', 0.05, t, 90, null, true); } },
    whisper: { cd: 600, cap: 'Something whispers a name.', f: function () { var t = ctx.currentTime; for (var i = 0; i < 5; i++) burst(0.45, 'bandpass', 1500 + Math.random() * 1500, 900, 0.06, t + i * 0.18, 6, null, true); tone(311, 1.4, 'sine', 0.03, t, 293, null, true); } },
    coin: { cd: 150, cap: 'Coins clink.', f: function () { var t = ctx.currentTime; [2400, 3100, 2700].forEach(function (f, i) { tone(f, 0.18, 'sine', 0.06, t + i * 0.09, f * 0.98, null, true); }); } },
    stash: { cd: 150, cap: 'Into the pack.', f: function () { var t = ctx.currentTime; burst(0.12, 'lowpass', 900, 300, 0.12, t, 1); tone(520, 0.12, 'triangle', 0.06, t + 0.05); } },
    hover: { cd: 120, cap: '', f: function () { tone(880, 0.05, 'sine', 0.025); } },
    click: { cd: 40, cap: '', f: function () { tone(520, 0.05, 'triangle', 0.05); } },
    dice: { cd: 200, cap: 'The die rattles across the table.', f: function () { var t = ctx.currentTime, n = 9; for (var i = 0; i < n; i++) { var at = t + i * i * 0.012 + i * 0.045; burst(0.035, 'bandpass', 1800 + Math.random() * 1600, 900, 0.16 * (1 - i / (n + 2)) + 0.03, at, 6); tone(180 + Math.random() * 90, 0.05, 'triangle', 0.07, at, 100); } tone(95, 0.22, 'sine', 0.18, t + 0.62, 55); } },
    step: { cd: 160, cap: 'Footsteps.', f: function () { var t = ctx.currentTime; burst(0.07, 'lowpass', 500, 160, 0.14, t, 1); burst(0.07, 'lowpass', 440, 140, 0.11, t + 0.2, 1); } },
    sprint: { cd: 200, cap: 'Hurried footsteps.', f: function () { var t = ctx.currentTime; for (var i = 0; i < 6; i++) burst(0.05, 'lowpass', 600, 180, 0.13, t + i * 0.1, 1); } },
    door: { cd: 400, cap: 'A door groans open.', f: function () { var t = ctx.currentTime; var o = ctx.createOscillator(), gn = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(190, t + 0.7); f.type = 'bandpass'; f.frequency.value = 460; f.Q.value = 7; env(gn, t, 0.1, 0.7, 0.12); o.connect(f); f.connect(gn); gn.connect(busS); o.start(t); o.stop(t + 0.9); burst(0.12, 'lowpass', 300, 100, 0.2, t + 0.75, 1); } },
    lock: { cd: 400, cap: 'A lock gives way.', f: function () { var t = ctx.currentTime; tone(1500, 0.05, 'square', 0.07, t); tone(900, 0.09, 'square', 0.08, t + 0.07); burst(0.1, 'lowpass', 500, 200, 0.18, t + 0.16, 1); } },
    trap: { cd: 300, cap: 'A trap springs.', f: function () { var t = ctx.currentTime; burst(0.18, 'highpass', 3000, 1000, 0.2, t, 2); tone(300, 0.2, 'sawtooth', 0.14, t, 90); } },
    pickup: { cd: 100, cap: 'You take something.', f: function () { var t = ctx.currentTime; tone(660, 0.12, 'triangle', 0.12, t); tone(990, 0.2, 'triangle', 0.1, t + 0.07, null, null, true); } },
    clue: { cd: 300, cap: 'A discovery, like a glass chime.', f: function () { var t = ctx.currentTime; [784, 1175, 1568].forEach(function (f, i) { tone(f, 1.4, 'sine', 0.1 - i * 0.02, t + i * 0.09, null, null, true); }); } },
    success: { cd: 200, cap: 'Success.', f: function () { var t = ctx.currentTime; tone(392, 0.25, 'triangle', 0.14, t, null, null, true); tone(587, 0.5, 'triangle', 0.14, t + 0.12, null, null, true); } },
    fail: { cd: 200, cap: 'Failure.', f: function () { var t = ctx.currentTime; tone(294, 0.3, 'triangle', 0.15, t); tone(208, 0.6, 'triangle', 0.15, t + 0.15, 190, null, true); } },
    crit: { cd: 400, cap: 'A critical success. The air sings.', f: function () { var t = ctx.currentTime; [262, 330, 392, 523].forEach(function (f, i) { tone(f, 1.6, 'sine', 0.12, t + i * 0.08, null, null, true); }); bellHit(130.8, 0.15, t + 0.2, null, true); } },
    fumble: { cd: 400, cap: 'A critical failure. Something goes badly wrong.', f: function () { var t = ctx.currentTime; tone(110, 0.9, 'sawtooth', 0.18, t, 55, null, true); tone(116, 0.9, 'sawtooth', 0.15, t, 58); burst(0.5, 'lowpass', 800, 100, 0.25, t, 1, null, true); } },
    damage: { cd: 150, cap: 'You are hurt.', f: function () { var t = ctx.currentTime; burst(0.14, 'lowpass', 700, 120, 0.3, t, 1); tone(120, 0.2, 'sine', 0.25, t, 50); } },
    sanity: { cd: 300, cap: 'Whispers pry at your mind.', f: function () { var t = ctx.currentTime; for (var i = 0; i < 4; i++) burst(0.4, 'bandpass', 2400 - i * 300, 1100, 0.07, t + i * 0.09, 6, null, true); tone(466, 1.0, 'sawtooth', 0.06, t, 440, null, true); tone(493, 1.0, 'sawtooth', 0.05, t, 465); } },
    heal: { cd: 200, cap: 'Warmth returns.', f: function () { var t = ctx.currentTime; [440, 554, 659].forEach(function (f, i) { tone(f, 0.9, 'sine', 0.09, t + i * 0.1, null, null, true); }); } },
    level: { cd: 600, cap: 'You grow stronger.', f: function () { var t = ctx.currentTime; [392, 494, 587, 784].forEach(function (f, i) { tone(f, 0.8, 'triangle', 0.13, t + i * 0.1, null, null, true); }); } },
    toll: { cd: 800, cap: 'The Haunting Clock tolls.', f: function () { var t = ctx.currentTime; bellHit(65.4, 0.35, t, null, true); bellHit(55.0, 0.28, t + 0.08, null, true); } },
    phase: { cd: 1500, cap: 'The Hollow shifts. A low swell.', f: function () { var t = ctx.currentTime; tone(55, 3.2, 'sawtooth', 0.18, t, 82, null, true); tone(82.4, 3.2, 'sawtooth', 0.12, t + 0.3, 110, null, true); bellHit(73.4, 0.28, t + 0.5, null, true); burst(2.5, 'lowpass', 200, 900, 0.18, t, 1, null, true); } },
    enemy: { cd: 300, cap: 'Something growls.', f: function () { var t = ctx.currentTime; var o = ctx.createOscillator(), gn = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(48, t + 0.7); f.type = 'lowpass'; f.frequency.value = 420; env(gn, t, 0.08, 0.7, 0.22); o.connect(f); f.connect(gn); gn.connect(busS); gn.connect(rev); o.start(t); o.stop(t + 0.9); burst(0.5, 'bandpass', 500, 250, 0.1, t, 3, null, true); } },
    boss: { cd: 1500, cap: 'Iron chains sing. The Warden stirs.', f: function () { var t = ctx.currentTime; tone(41, 2.2, 'sawtooth', 0.3, t, 36, null, true); for (var i = 0; i < 6; i++) burst(0.12, 'highpass', 4000 - i * 300, 2000, 0.12, t + i * 0.11, 8, null, true); bellHit(55, 0.3, t + 0.4, null, true); } },
    fall: { cd: 1500, cap: 'A soul leaves its body.', f: function () { var t = ctx.currentTime; tone(330, 2.4, 'sine', 0.2, t, 55, null, true); tone(247, 2.4, 'triangle', 0.14, t + 0.1, 41, null, true); } },
    revive: { cd: 800, cap: 'Breath returns.', f: function () { var t = ctx.currentTime; tone(55, 1.8, 'sine', 0.2, t, 220, null, true); [330, 494].forEach(function (f, i) { tone(f, 1.4, 'triangle', 0.1, t + 0.5 + i * 0.15, null, null, true); }); } },
    turn: { cd: 800, cap: 'Your turn.', f: function () { var t = ctx.currentTime; tone(165, 0.45, 'triangle', 0.09, t, null, null, true); tone(247, 0.6, 'sine', 0.07, t + 0.14, null, null, true); } },
    vote: { cd: 400, cap: 'The table must decide.', f: function () { var t = ctx.currentTime; bellHit(82.4, 0.22, t, null, true); } },
    ally: { cd: 400, cap: 'An ally joins you.', f: function () { var t = ctx.currentTime; [294, 370, 440].forEach(function (f, i) { tone(f, 1.2, 'triangle', 0.1, t + i * 0.13, null, null, true); }); } },
    end_success: { cd: 3000, cap: 'The bell falls silent, and a dawn begins.', f: function () { var t = ctx.currentTime; [262, 330, 392, 523, 659, 784].forEach(function (f, i) { tone(f, 4, 'triangle', 0.11, t + i * 0.25, null, null, true); }); bellHit(131, 0.2, t + 1.5, null, true); } },
    end_partial: { cd: 3000, cap: 'The bell rings once more, uncertain.', f: function () { var t = ctx.currentTime; [262, 311, 392, 466].forEach(function (f, i) { tone(f, 4, 'triangle', 0.11, t + i * 0.3, null, null, true); }); bellHit(98, 0.2, t + 1.2, null, true); } },
    end_failure: { cd: 3000, cap: 'The thirteenth toll. Everything stops.', f: function () { var t = ctx.currentTime; [98, 116, 147].forEach(function (f, i) { tone(f, 5, 'sawtooth', 0.12, t + i * 0.2, f * 0.6, null, true); }); for (var i = 0; i < 4; i++) bellHit(62, 0.3, t + i * 1.3, null, true); } }
  };

  // Supplied Task 4 cues retain a synthesised fallback when a file cannot decode.
  SFX.rope = { cd: 700, cap: 'A rope strains overhead.', f: function () { SFX.creak.f(); } };
  SFX.bellframe = { cd: 800, cap: 'The empty bell-frame groans.', f: function () { SFX.creak.f(); } };
  SFX.completion = { cd: 1500, cap: 'Your personal objective is fulfilled.', f: function () { SFX.success.f(); } };

  SFX.ink = { cd: 1200, cap: 'A pen scratches across paper.', f: function () { SFX.paper.f(); } };
  SFX.knock = { cd: 1800, cap: 'A quiet knock from the chapel woodwork.', f: function () { SFX.creak.f(); } };
  SFX.iron = { cd: 900, cap: 'An iron nameplate scrapes against stone.', f: function () { SFX.lock.f(); } };

  function sfx(name, opt) {
    var d = SFX[name]; if (!d) return;
    if (capFn && S.captions && d.cap) capFn(d.cap);
    if (!ctx || !started || S.muted) return;
    var now = performance.now();
    if (lastSfx[name] && now - lastSfx[name] < (d.cd || 80)) return;
    if (voices > 10) return;
    lastSfx[name] = now; voices++; setTimeout(function () { voices = Math.max(0, voices - 1); }, 700);
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    try { d.f(opt); } catch (e) { /* never let a sound break the game */ }
  }

  // Briefly drop the music and ambience before something important lands.
  function hush(ms) {
    if (!ctx || !started) return;
    var t = ctx.currentTime;
    busM.gain.cancelScheduledValues(t); busA.gain.cancelScheduledValues(t);
    busM.gain.setTargetAtTime(S.music * 0.1, t, 0.12); busA.gain.setTargetAtTime(S.ambient * 0.15, t, 0.12);
    setTimeout(function () { if (!ctx) return; var u = ctx.currentTime; busM.gain.setTargetAtTime(S.music, u, 0.9); busA.gain.setTargetAtTime(S.ambient, u, 0.9); }, ms || 900);
  }

  function setVolume(bus, v) { S[bus] = Math.max(0, Math.min(1, v)); save(); applyVolumes(); }
  function setMuted(m) { S.muted = !!m; save(); applyVolumes(); if (!m) { unlock(); sfx('click'); } }
  function setCaptions(c) { S.captions = !!c; save(); }

  g.HollowAudio = {
    unlock: unlock, sfx: sfx, setRegion: setRegion, setPlace: setPlace, setLevel: setLevel, setMood: setMood, hush: hush,
    setVolume: setVolume, setMuted: setMuted, setCaptions: setCaptions,
    // Narrow bridge: recorded layers share the same context, buses, mute and persisted sliders.
    backend: function () { return ctx ? { ctx: ctx, master: master, music: busM, ambient: busA, sfx: busS, synthMusic: synthM, synthAmbient: synthA } : null; },
    describeSound: function (name) { var d = SFX[name]; return d ? { caption: d.cap, cooldown: d.cd || 80 } : null; },
    caption: function (text) { if (S.captions && capFn && text) capFn(text); },
    setMediaFocus: function (on) { mediaFocus = !!on; applyVolumes(); },
    settings: function () { return Object.assign({}, S); }, onCaption: function (fn) { capFn = fn; },
    regions: Object.keys(REGIONS), moods: Object.keys(MOODS), sfxNames: Object.keys(SFX), supported: !!(g.AudioContext || g.webkitAudioContext)
  };
})(window);
