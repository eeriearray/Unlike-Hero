/* A gesture-started horror prologue and discovery effects. No commands or gameplay RNG. */
(function (g) {
  'use strict';
  var FX = g.HollowFx, A = g.HollowAudio, UI = g.HollowUI;
  var active = null, serial = 0, previous = null, run = '', traceTimer = null, shockTimer = null, pendingTimer = null;
  var elapsedSinceShock = -Infinity, introMemory = new Set(), trace = null, traceLoc = null, shockLayer = null, images = {};
  var stopCreature = null;
  var faceId = 'task3_whisperling_portrait', impactId = 'horror_sfx_free_horror_sfx_free_stingers_and_spooky_triggers_stinger_dfe1c4a8';
  var beats = [
    ['You received this tomorrow.', 'A letter in your own handwriting. Dated tomorrow. The first line has been pressed so hard into the paper that it almost tears.'],
    ['I have already been here.', '“I found the bell. I heard my own voice beneath it. If you can still read this, there is time.”'],
    ['Do not let it finish your name.', '“At the last toll, I forgot the way home. Find what rings beneath Thornwick. Bring the names it took back into the light.”'],
    ['Someone is outside.', 'Two knocks at the door. Then a third. From inside the room.'],
    ['It heard you.', 'You still remember your name. Find why an empty tower rings, follow its trail beneath the Abbey, and decide the bell’s fate before it takes you.']
  ];
  function allowed() { return FX.prefs.jumpScares !== false && !FX.prefs.reducedScares && !FX.reduced(); }
  function identity(v) { return g.HollowFeedbackPolicy.runKey(v); }
  function evidence(v) { return v && v.opening && v.opening.evidence || {}; }
  function freshArrival(v) {
    var e = evidence(v);
    return !!(v && v.phase === 'playing' && v.me && v.me.status === 'alive' && v.game.round === 1 &&
      !e.board && !e.record && !e.route && !e.entered && !e.revealed && v.me.loc === 'square');
  }
  function claimIntro(key) {
    if (introMemory.has(key)) return false;
    introMemory.add(key);
    try { var k = 'hollow.warning.v1:' + key; if (g.localStorage.getItem(k)) return false; g.localStorage.setItem(k, '1'); } catch (e) { /* Still requires an explicit Listen gesture. */ }
    return true;
  }
  function load(id) {
    if (images[id]) return;
    images[id] = true;
    g.HollowAssets.load(id).then(function (img) {
      if (!img) return; images[id] = img;
      if (active) paintBackdrop(active);
    }).catch(function () {});
  }
  function portrait(target) {
    target.replaceChildren();
    var image = images[faceId];
    if (image && image.cloneNode) { var copy = image.cloneNode(); copy.alt = ''; target.appendChild(copy); }
    else { var canvas = document.createElement('canvas'); if (g.HollowScareFace.draw(canvas)) target.appendChild(canvas); }
  }
  function paintBackdrop(s) {
    var img = images.task1_environments_village_square;
    if (img && img.cloneNode && !s.backdrop.querySelector('img')) { var copy = img.cloneNode(); copy.alt = ''; s.backdrop.appendChild(copy); }
  }
  function clearShock() {
    clearTimeout(shockTimer); if (stopCreature) stopCreature(); stopCreature = null; if (shockLayer) shockLayer.remove(); shockLayer = null;
    if (active) active.el.classList.remove('warning-impact');
    g.HollowFeedbackAudio.stop();
  }
  function shock(intro, variant) {
    if (!allowed() || document.hidden) return false;
    clearShock(); elapsedSinceShock = performance.now();
    var el = document.createElement('div'); el.className = 'dread-shock' + (intro ? ' dread-closeup' : ''); el.setAttribute('aria-hidden', 'true');
    (intro && active ? active.el : document.body).appendChild(el); shockLayer = el;
    if (intro && active) active.el.classList.add('warning-impact');
    variant = intro ? 'door' : variant || 'graveyard';
    function impact() {
      g.HollowFeedbackAudio.play(variant);
      var profile = g.HollowScareFace.profiles && g.HollowScareFace.profiles[variant];
      if (A.caption) A.caption(profile ? profile.caption : 'A sharp impact. Something rushes into your face.');
    }
    A.hush(1500);
    if (g.HollowScareFace.play) {
      stopCreature = g.HollowScareFace.play(el, { variant: variant, onImpact: impact });
    } else { portrait(el); impact(); }
    shockTimer = setTimeout(clearShock, g.HollowScareFace.duration || (intro ? 1100 : 620)); return true;
  }
  function finish(continueGame) {
    if (!active) return;
    var old = active; active = null; clearInterval(old.timer); clearShock();
    if (old.el.open && old.el.close) old.el.close(); old.el.remove();
    if (old.returnTo && old.returnTo.isConnected) old.returnTo.focus({ preventScroll: true });
    if (continueGame && old.after) { var after = old.after; old.after = null; after(); }
  }
  function showBeat(s, n) {
    if (active !== s || s.beat === n) return;
    s.beat = n; s.el.dataset.beat = n;
    s.heading.textContent = beats[n][0]; s.copy.textContent = beats[n][1];
    if (n === 2) A.sfx('paper', { gain: .13 });
    if (n === 3) { A.hush(8500); A.sfx('knock', { pan: -.65, gain: .2 }); }
    if (n === 4) { s.el.classList.remove('warning-blackout'); s.el.classList.add('warning-finished'); s.enter.hidden = false; s.enter.focus({ preventScroll: true }); }
    if (s.next) { s.next.hidden = !s.started || n >= 3; s.next.textContent = n === 2 ? 'Listen at the door' : 'Turn the page'; }
  }
  function tick() {
    var s = active; if (!s || !s.running) return;
    var now = performance.now(), dt = Math.max(0, Math.min(300, now - s.last)); s.last = now;
    if (document.hidden) return;
    if (!allowed()) { clearShock(); s.el.classList.add('warning-gentle'); showBeat(s, 4); s.running = false; clearInterval(s.timer); return; }
    s.elapsed += dt;
    // Reading is player-paced. Only the final knock sequence uses a clock.
    if (s.elapsed >= 1900 && !s.secondKnock) { s.secondKnock = true; A.sfx('knock', { pan: .65, gain: .25 }); }
    if (s.elapsed >= 3800 && !s.inside) { s.inside = true; A.sfx('knock', { pan: 0, gain: .32 }); }
    if (s.elapsed >= 4800 && !s.dark) { s.dark = true; s.el.classList.add('warning-blackout'); }
    if (s.elapsed >= 6400 && !s.struck) { s.struck = true; shock(true); }
    if (s.elapsed >= 8000) { showBeat(s, 4); s.running = false; clearInterval(s.timer); }
  }
  function open(v, after) {
    if (active) return true;
    if (!freshArrival(v) || !claimIntro(identity(v))) return false;
    var el = document.createElement('dialog'); el.className = 'warning-prologue'; el.setAttribute('aria-label', 'A warning from tomorrow');
    el.innerHTML = '<div class="warning-background" aria-hidden="true"></div><div class="warning-door" aria-hidden="true"></div><article class="warning-message"><span class="warning-eyebrow">THORNWICK · ONE DAY TOO LATE</span><h1 id="warning-heading"></h1><p class="warning-copy" aria-live="polite"></p><p class="warning-promise">Find the bell. Recover the names. Come home while you still remember who you are.</p><button class="btn warning-listen">Listen to your warning</button><button class="btn warning-next" hidden>Turn the page</button><button class="btn warning-enter" hidden>Enter Thornwick</button><small class="warning-mode">' + (allowed() ? 'Read at your own pace · sound and sudden scares enabled' : 'Gentle version · sudden scares disabled') + '</small></article><button class="warning-skip" aria-label="Skip opening">Skip opening · Esc</button>';
    var s = active = { el: el, after: after, returnTo: document.activeElement, elapsed: 0, last: performance.now(), running: false, beat: -1,
      backdrop: el.querySelector('.warning-background'), heading: el.querySelector('h1'), copy: el.querySelector('.warning-copy'), next: el.querySelector('.warning-next'), enter: el.querySelector('.warning-enter') };
    el.classList.toggle('warning-gentle', !allowed()); document.body.appendChild(el);
    if (el.showModal) el.showModal(); else { el.setAttribute('open', ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); }
    showBeat(s, 0);
    el.querySelector('.warning-listen').onclick = function () {
      if (active !== s || s.started) return;
      s.started = true;
      A.unlock(); load(faceId); load('task1_environments_village_square');
      g.HollowFeedbackAudio.prepare(impactId); s.el.classList.add('warning-listening');
      this.hidden = true;
      if (!allowed()) { s.copy.textContent = beats[1][1] + ' ' + beats[2][1] + ' ' + beats[4][1]; s.enter.hidden = false; s.enter.focus(); return; }
      s.next.hidden = false; s.next.focus({ preventScroll: true });
    };
    s.next.onclick = function () {
      if (active !== s || !s.started || s.running || s.beat >= 3) return;
      showBeat(s, s.beat + 1);
      if (s.beat === 3) { s.running = true; s.el.classList.add('warning-suspense'); s.last = performance.now(); s.timer = setInterval(tick, 100); }
    };
    s.enter.onclick = function () { finish(true); }; el.querySelector('.warning-skip').onclick = function () { finish(true); };
    el.addEventListener('cancel', function (e) { e.preventDefault(); finish(true); });
    el.querySelector('.warning-listen').focus();
    load('task1_environments_village_square'); return true;
  }
  function blocked() {
    var s = UI.S.ui || {};
    return active || document.hidden || s.modal || s.icard || s.map || s.drawer || s.prep ||
      !!document.querySelector('.modal, dialog[open], .icard') || (g.HollowEvents && g.HollowEvents.busy());
  }
  function clearTrace() { clearTimeout(traceTimer); if (trace) trace.remove(); trace = null; }
  function discovery(key, v) {
    var stamp = ++serial, deadline = performance.now() + 8000, keyRun = identity(v);
    function perform() {
      if (stamp !== serial || run !== keyRun) return;
      if (blocked()) { if (performance.now() < deadline) pendingTimer = setTimeout(perform, 250); return; }
      var host = g.HollowStage.el(); if (!host || !host.isConnected || !UI.S.view || UI.S.view.me.loc !== v.me.loc) return;
      var p = g.HollowFeedbackPolicy;
      if (!p.claim(g.localStorage, 'story-dread:' + run + ':' + key)) return;
      clearTrace(); trace = document.createElement('div'); trace.className = 'dread-trace dread-' + key;
      var messages = { board: 'The ink is still moving. It knows the first letter.', route: 'For a moment, someone stands between the empty graves.', revealed: 'The empty frame answers. The sound rises through the floor.' };
      var caption = document.createElement('p'); caption.setAttribute('role', 'status'); caption.textContent = messages[key]; trace.appendChild(caption);
      if (allowed() && key === 'board') { var silhouette = document.createElement('div'); silhouette.className = 'dread-apparition'; portrait(silhouette); trace.appendChild(silhouette); }
      traceLoc = v.me.loc; host.appendChild(trace); A.hush(1800);
      if (key === 'board') A.sfx('ink', { pan: -.45, gain: .2 });
      if (key === 'route') A.sfx('whisper', { pan: .65, gain: .15 });
      if (key === 'revealed') A.sfx('bellframe', { gain: .24 });
      if (key !== 'board' && allowed() && performance.now() - elapsedSinceShock >= 20000) shock(false, key === 'revealed' ? 'tower' : 'graveyard');
      traceTimer = setTimeout(clearTrace, allowed() ? 2800 : 4200);
    }
    if (g.HollowEvents && g.HollowEvents.busy()) g.HollowEvents.after(perform); else pendingTimer = setTimeout(perform, 300);
  }
  function sync(v) {
    if (!v || v.phase !== 'playing' || !v.me) { cancel(); previous = null; return; }
    if (trace && traceLoc !== v.me.loc) clearTrace();
    var nextRun = identity(v), e = evidence(v);
    if (nextRun !== run) { cancel(); run = nextRun; previous = Object.assign({}, e); load(faceId); return; }
    if (!previous) { previous = Object.assign({}, e); return; }
    var beat = ['revealed', 'route', 'board'].find(function (k) { return e[k] && !previous[k]; });
    previous = Object.assign({}, e);
    if (beat && v.me.status === 'alive' && v.me.loc === { board: 'square', route: 'graveyard', revealed: 'belltower' }[beat]) discovery(beat, v);
    if (v.me.status !== 'alive') { clearShock(); clearTrace(); }
  }
  function cancel() { serial++; clearTimeout(pendingTimer); clearTrace(); finish(false); clearShock(); }
  document.addEventListener('keydown', function (e) {
    if (!active) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); finish(true); }
    if (e.key === 'Tab') {
      var buttons = Array.from(active.el.querySelectorAll('button')).filter(function (b) { return !b.hidden && !b.disabled; });
      var first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, true);
  document.addEventListener('visibilitychange', function () { if (active) active.last = performance.now(); if (document.hidden) clearShock(); });
  var apply = FX.apply;
  FX.apply = function () { apply.apply(this, arguments); if (!allowed()) { clearShock(); if (active) active.el.classList.add('warning-gentle'); if (trace) { var figure = trace.querySelector('.dread-apparition'); if (figure) figure.remove(); } } };
  g.HollowDread = { open: open, sync: sync, cancel: cancel, allowed: allowed, freshArrival: freshArrival, beats: beats };
})(window);
