/* File-backed audio over audio.js's shared context. No fetch/decode before a gesture.
 * Every failed lookup or decode keeps the original synthesised sound available.
 * Audio choices are cosmetic and never consume the rules engine's random stream. */
(function (g) {
  'use strict';
  var A = g.HollowAudio, map = g.HollowAudioMap, assets = g.HollowAssets;
  if (!A || !map || !assets || !A.backend) return;
  var original = {}, backend, ctx, filter, duckM, duckA;
  ['unlock', 'setRegion', 'setPlace', 'setMood', 'setLevel', 'sfx', 'hush'].forEach(function (k) { original[k] = A[k]; });
  var place = null, region = 'title', mood = 'explore', level = 0, sanity = 1, phase = 1, alive = false;
  var cache = new Map(), pending = new Map(), cacheBytes = 0, maxBytes = 32 * 1024 * 1024;
  var music = [], ambience = [], effects = [], desired = '', currentMusic = '', currentBed = '', generation = 0, first = true;
  var duckUntil = 0, dialog = false, nextBeat = 0, nextWhisper = 0, nextBell = 0, last = {};
  var transition = 2, limit = 12;
  function ramp(param, value, seconds) {
    var t = ctx.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
    else { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); }
    param.linearRampToValueAtTime(value, t + seconds);
  }
  function prepare(id) {
    if (!ctx || !id) return Promise.resolve(null);
    if (cache.has(id)) { var hit = cache.get(id); cache.delete(id); cache.set(id, hit); return Promise.resolve(hit); }
    if (pending.has(id)) return pending.get(id);
    var task = assets.ready.then(function () {
      var entry = assets.get(id);
      return entry && entry.type === 'audio' ? assets.load(id) : null;
    }).then(function (bytes) { return bytes ? ctx.decodeAudioData(bytes.slice(0)) : null; }).catch(function () { return null; }).then(function (buffer) {
      pending.delete(id); assets.release(id); cache.set(id, buffer);
      cacheBytes += buffer ? buffer.length * buffer.numberOfChannels * 4 : 0;
      // Active sources own their buffers; evicting a cache entry never cuts a playing loop.
      while (cache.size > 36 || cacheBytes > maxBytes && cache.size > 1) {
        var key = cache.keys().next().value, old = cache.get(key); cache.delete(key);
        cacheBytes -= old ? old.length * old.numberOfChannels * 4 : 0;
      }
      return buffer;
    });
    pending.set(id, task); return task;
  }
  function source(buffer, bus, options) {
    var o = options || {}, s = ctx.createBufferSource(), gain = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filter || 20000;
    s.buffer = buffer; s.loop = !!o.loop; s.playbackRate.value = o.rate || 1;
    if (pan.pan) pan.pan.value = o.pan || 0;
    s.connect(f); f.connect(gain); gain.connect(pan); pan.connect(bus);
    var when = o.when == null ? ctx.currentTime : o.when;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(o.gain == null ? .3 : o.gain, when + (o.fade || .015));
    var track = { source: s, gain: gain, id: o.id, group: o.group, end: when + buffer.duration / s.playbackRate.value };
    s.onended = function () { s.disconnect(); f.disconnect(); gain.disconnect(); pan.disconnect(); effects = effects.filter(function (e) { return e !== track; }); };
    if (o.duration) {
      var duration = Math.min(o.duration, buffer.duration / s.playbackRate.value);
      gain.gain.setValueAtTime(o.gain == null ? .3 : o.gain, when + Math.max(.02, duration - .08));
      gain.gain.linearRampToValueAtTime(0, when + duration); s.start(when, 0, duration * s.playbackRate.value);
    } else s.start(when);
    return track;
  }
  function fadeOut(tracks) {
    tracks.forEach(function (e) { ramp(e.gain.gain, 0, transition); try { e.source.stop(ctx.currentTime + transition + .02); } catch (err) {} });
  }
  // Future music slots: replace these IDs with dedicated combat / boss / ending cues.
  // Until then, combat and boss reuse a quieter, pitched, filtered exploration loop.
  function profile() {
    var ending = mood === 'victory' || mood === 'defeat';
    var track = ending ? map.tracks.outro : map.tracks[region === 'crypt' ? 'estate' : region] || map.tracks.loop;
    var fight = mood === 'combat' || mood === 'boss';
    return { id: track, ending: ending, gain: fight ? .13 : ending ? .25 : .23, rate: fight ? (mood === 'boss' ? .82 : .92) : 1, filter: fight ? 1100 : 16000 };
  }
  function refresh() {
    if (!ctx) return Promise.resolve();
    var bedId = map.placeBeds && map.placeBeds[place] || map.beds[region];
    var mix = map.placeMix && map.placeMix[place] || {}, bedGain = mix.gain == null ? (region === 'heart' ? .16 : .2) : mix.gain, bedFilter = mix.filter || (region === 'village' ? 900 : 6500);
    var bedKey = [bedId, bedGain, bedFilter].join('|');
    var p = profile(), key = [region, mood, p.id, bedKey].join('|');
    if (desired === key) return Promise.resolve();
    desired = key; var token = ++generation;
    if (mood === 'silence') { fadeOut(music); music = []; ramp(backend.synthMusic.gain, 0, transition); return Promise.resolve(); }
    var intro = first && !p.ending ? map.tracks.intro : null;
    return Promise.all([prepare(p.id), prepare(bedId), prepare(intro)]).then(function (buffers) {
      if (token !== generation) return;
      var nextMusic = [p.id, mood, p.rate, p.filter].join('|');
      if (buffers[0] && (currentMusic !== nextMusic || !music.length)) {
        var fresh = [], when = ctx.currentTime;
        if (intro && buffers[2]) {
          var entry = source(buffers[2], backend.music, { gain: p.gain, fade: transition, id: intro }); fresh.push(entry);
          when = Math.max(when + .02, entry.end - .04);
        }
        fresh.push(source(buffers[0], backend.music, { loop: !p.ending, when: when, gain: p.gain, rate: p.rate, filter: p.filter, fade: intro && buffers[2] ? .04 : transition, id: p.id }));
        fadeOut(music); music = fresh; currentMusic = nextMusic; first = false; ramp(backend.synthMusic.gain, 0, transition);
      } else if (!buffers[0]) { fadeOut(music); music = []; currentMusic = ''; ramp(backend.synthMusic.gain, 1, transition); }
      if (!ambience.length || currentBed !== bedKey) {
        if (buffers[1]) {
          var bed = source(buffers[1], backend.ambient, { loop: true, gain: bedGain, filter: bedFilter, fade: transition, id: bedId });
          fadeOut(ambience); ambience = [bed]; currentBed = bedKey; ramp(backend.synthAmbient.gain, 0, transition);
        } else { fadeOut(ambience); ambience = []; currentBed = ''; ramp(backend.synthAmbient.gain, 1, transition); }
      }
    }).catch(function () { /* Synthesis remains audible if audio setup fails. */ });
  }
  function duck(ms) { if (ctx) { duckUntil = Math.max(duckUntil, ctx.currentTime + (ms || 900) / 1000); updateDuck(); } }
  function updateDuck() {
    if (!ctx) return;
    var on = dialog || ctx.currentTime < duckUntil;
    duckM.gain.setTargetAtTime(on ? .24 : 1, ctx.currentTime, on ? .06 : .6);
    duckA.gain.setTargetAtTime(on ? .45 : 1, ctx.currentTime, on ? .06 : .6);
  }
  function playAsset(id, options) {
    if (!ctx || ctx.state !== 'running' || document.hidden || A.settings().muted || !A.settings().master || !A.settings().sfx || effects.length >= limit) return false;
    var b = cache.get(id); if (!b) { prepare(id); return false; }
    var o = Object.assign({ gain: .32, duration: 3 }, options || {});
    effects.push(source(b, o.bus === 'ambient' ? backend.ambient : backend.sfx, Object.assign(o, { id: id })));
    if (o.voice) duck(Math.min(3500, b.duration * 1000));
    return true;
  }
  function stopGroup(group) {
    effects.slice().forEach(function (e) { if (e.group === group) { try { e.source.stop(); } catch (err) {} } });
  }
  function heartbeat(now) {
    if (!alive || sanity > .6 || now < nextBeat) return;
    nextBeat = now + .55 + sanity * 1.15;
    [0, .19].forEach(function (delay, i) {
      var o = ctx.createOscillator(), gain = ctx.createGain(), t = now + delay;
      o.frequency.setValueAtTime(i ? 48 : 56, t); o.frequency.exponentialRampToValueAtTime(32, t + .18);
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime((.6 - sanity) * (i ? .1 : .16), t + .025); gain.gain.exponentialRampToValueAtTime(.0001, t + .22);
      o.connect(gain); gain.connect(backend.ambient); o.onended = function () { o.disconnect(); gain.disconnect(); }; o.start(t); o.stop(t + .23);
    });
  }
  function tick() {
    if (!ctx || ctx.state !== 'running' || document.hidden) return;
    updateDuck(); filter.frequency.setTargetAtTime(Math.max(650, 15000 - level * 9500 - (1 - sanity) * 4500), ctx.currentTime, 1.5);
    if (A.settings().muted) return;
    var now = ctx.currentTime; heartbeat(now);
    if (alive && now >= nextWhisper) {
      nextWhisper = now + 17 + Math.random() * 17 - phase * 2;
      if (sanity < .65 || phase >= 2) playAsset(map.sfx.whisper, { bus: 'ambient', gain: .08, pan: Math.random() * 1.6 - .8, voice: true, duration: 2 });
    }
    if (alive && now >= nextBell) {
      nextBell = now + (phase === 3 ? 15 : 48) + Math.random() * 9;
      if (playAsset(map.sfx.distantBell || map.sfx.bell, { bus: 'ambient', gain: .1, duration: 5.5 })) A.caption('A distant bell tolls.');
    }
  }
  A.unlock = function () {
    original.unlock();
    if (ctx) return;
    backend = A.backend(); if (!backend) return; ctx = backend.ctx;
    filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 15000;
    duckM = ctx.createGain(); duckA = ctx.createGain();
    backend.music.disconnect(); backend.ambient.disconnect();
    backend.music.connect(filter); filter.connect(duckM); duckM.connect(backend.master);
    backend.ambient.connect(duckA); duckA.connect(backend.master);
    refresh();
    // Small cues decode only after unlock; region music/beds are otherwise lazy.
    ['click', 'hover', 'paper', 'dice', 'damage', 'sanity', 'whisper', 'bell', 'distantBell', 'clue', 'enemy', 'completion', 'impact', 'ink', 'knock', 'iron'].forEach(function (name) { prepare(map.sfx[name]); });
    setInterval(tick, 250);
  };
  A.setRegion = function (name) { region = A.regions.indexOf(name) >= 0 ? name : 'title'; if (region === 'title') alive = false; original.setRegion(region); return refresh(); };
  A.setPlace = function (id) {
    if (original.setPlace) original.setPlace(id);
    if (place !== id) { place = id; if (id === 'belltower') { prepare(map.sfx.rope); prepare(map.sfx.bellframe); } return refresh(); }
  };
  A.setMood = function (name) { mood = A.moods.indexOf(name) >= 0 ? name : 'explore'; if (mood === 'victory' || mood === 'defeat') alive = false; original.setMood(mood); return refresh(); };
  A.setLevel = function (n) { level = Math.max(0, Math.min(1, Number(n) || 0)); original.setLevel(level); };
  A.setState = function (view) {
    var me = view && view.me; alive = !!(me && me.status === 'alive' && view.phase === 'playing');
    sanity = me && me.maxSan > 0 ? Math.max(0, Math.min(1, me.san / me.maxSan)) : 1;
    var next = view && view.game ? view.game.haunt : 1;
    if (phase !== next) { phase = next; nextBell = 0; }
  };
  A.sfx = function (name, options) {
    var info = A.describeSound(name), id = map.sfx[name];
    if (info && ctx && (name === 'whisper' || name === 'sanity')) duck(1500);
    if (!info || !id || !ctx || !cache.get(id)) { if (id && ctx) prepare(id); return original.sfx(name, options); }
    var now = performance.now(); if (last[name] != null && now - last[name] < info.cooldown) return;
    last[name] = now; A.caption(info.caption);
    playAsset(id, Object.assign({ gain: name === 'hover' ? .12 : .32, duration: name === 'bell' || name === 'toll' ? 5 : 2.5, pan: name === 'whisper' ? Math.random() * 1.6 - .8 : 0, voice: name === 'whisper' || name === 'sanity' }, (map.cueOptions || {})[name] || {}, options || {}, { pan: options && Number.isFinite(options.pan) ? Math.max(-.75, Math.min(.75, options.pan)) : name === 'whisper' ? Math.random() * 1.6 - .8 : 0 }));
  };
  A.playImpact = function (id) {
    if (!ctx || ctx.state !== 'running' || document.hidden || A.settings().muted || !A.settings().master || !A.settings().sfx) return false;
    if (playAsset(id, { group: 'scare', gain: .6, duration: .54 })) return true;
    var osc = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime;
    osc.type = 'triangle'; osc.frequency.setValueAtTime(115, now); osc.frequency.exponentialRampToValueAtTime(35, now + .22);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.3, now + .012); gain.gain.linearRampToValueAtTime(0, now + .24);
    osc.connect(gain); gain.connect(backend.sfx); var track = { source: osc, gain: gain, group: 'scare' }; effects.push(track);
    osc.onended = function () { osc.disconnect(); gain.disconnect(); effects = effects.filter(function (e) { return e !== track; }); };
    osc.start(now); osc.stop(now + .25); return true;
  };
  A.hush = duck; A.prepareAsset = prepare; A.playAsset = playAsset; A.stopGroup = stopGroup;
  A.diagnostics = function () { return { state: ctx ? ctx.state : 'locked', region: region, mood: mood, music: music.map(function (t) { return t.id; }), ambience: ambience.map(function (t) { return t.id; }), decoded: cache.size, decodedBytes: cacheBytes, transitionSeconds: transition, sanity: sanity, phase: phase, ducked: !!(ctx && (dialog || ctx.currentTime < duckUntil)) }; };
  if (g.MutationObserver) new g.MutationObserver(function () {
    var open = !!document.querySelector('[role="dialog"]:not(dialog), dialog[open], .cine.full:not(.out)');
    if (open !== dialog) { dialog = open; updateDuck(); }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'open'] });
  document.addEventListener('visibilitychange', function () { if (ctx && document.hidden) ctx.suspend().catch(function () {}); });
})(window);
