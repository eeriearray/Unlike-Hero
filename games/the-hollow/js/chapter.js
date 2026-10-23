/* Step 6: title, a pre-game prologue, first-run HUD tips and ending presentation.
 * These wrappers preserve the original buttons, network handlers, map graph and
 * complete ending record. Round totals come from the authoritative ending view. */
(function (g) {
  'use strict';
  var UI = g.HollowUI, Story = g.HollowStory, A = g.HollowArt, FX = g.HollowFx, art = g.HollowChapterArt, esc = A.esc;
  var introKey = 'hollow.prologue.v1', tutorialKey = 'hollow.hud-guide.v1';
  var intro = null, tour = null, queued = false, autoRun = null;
  var scenes = [
    ['The village that vanished', 'Thornwick is missing from every map. The road still knows the way.'],
    ['A bell with no keeper', 'Each night, the empty tower rings. Each toll remembers another name.'],
    ['Six roads into the dark', 'Bring a lantern. Trust your companions. Read what the dead left behind.'],
    ['Your name is not yet written', 'Find the truth beneath the Abbey. Decide what the bell deserves. Come home, if you can.']
  ];
  var tips = [
    ['#hud-me', 'You, and what remains', 'Vitality keeps you standing. Sanity keeps the Hollow at a distance. Open your character sheet here.'],
    ['.hturn', 'Three small lanterns', 'These are your actions this turn. Examine a place, use your abilities, or travel; end your turn when you are ready.'],
    ['#hud-clock', 'The Haunting Clock', 'The clock belongs to everyone. As it fills, the Hollow grows more dangerous. Your choices can advance it.'],
    ['#hud-pack', 'What you carry', 'Open your pack to use or equip an item. Space is limited; every useful thing has a weight.'],
    ['#hud-journal, [data-act="tab"][data-t="log"]', 'Keep the truth close', 'Your journal holds clues and discoveries. The map shows the roads your party has found. Both can help you choose the next step.']
  ];
  function saved(key) { try { return !!(g.HollowChapterStorage || g.localStorage).getItem(key); } catch (e) { return false; } }
  function save(key) { try { (g.HollowChapterStorage || g.localStorage).setItem(key, '1'); } catch (e) {} }
  function backdrop(id) { return '<div class="chapter-backdrop" data-chapter-art="' + esc(id || '') + '" aria-hidden="true"><i class="chapter-fog"></i></div>'; }
  function endingKey(e) {
    if (e && Object.prototype.hasOwnProperty.call(art.endings, e.endingKey)) return e.endingKey;
    var id = e && e.id || ''; return Object.keys(art.endings).find(function (k) { return id === k || id.indexOf(k + '_') === 0; }) || 'doom';
  }
  function summary(v) {
    var e = v.ended, results = e.results || [], w = v.world || {};
    return { rounds: e.round, clues: (w.clues || []).length, relics: results.reduce(function (n, r) { return n + (r.relics || []).length; }, 0), survivors: results.filter(function (r) { return r.fate === 'survived' || r.fate === 'escaped' || r.fate === 'bound'; }).map(function (r) { return r.name + (r.fate === 'bound' ? ' (bound to the ledger)' : ''); }) };
  }
  var title = UI.title;
  UI.title = function () {
    return '<div class="chapter-title">' + backdrop(art.title) + title.apply(this, arguments) + '<button class="chapter-prologue btn ghost small" data-chapter="prologue">Watch the prologue · 60 seconds</button></div>';
  };
  var ending = UI.ending;
  UI.ending = function () {
    var v = UI.S.view, e = v.ended, key = endingKey(e), s = summary(v);
    var outcome = { success: 'The expedition succeeded', partial: 'A partial victory', failure: 'The expedition failed', unresolved: 'The mystery is unresolved' }[e.outcome] || 'The expedition ends';
    return '<section class="chapter-ending ending-' + key + '" aria-label="Expedition ending" data-ending="' + key + '">' + backdrop(art.endings[key]) +
      '<div class="chapter-epilogue"><small class="chapter-eyebrow">' + esc(outcome) + '</small><h1 tabindex="-1">' + esc(e.title) + '</h1><p class="chapter-endtext">' + esc(e.text) + '</p>' +
      '<dl class="chapter-stats"><div><dt>Rounds survived</dt><dd>' + esc(s.rounds) + '</dd></div><div><dt>Clues uncovered</dt><dd>' + s.clues + '</dd></div><div><dt>Relics carried</dt><dd>' + s.relics + '</dd></div></dl>' +
      '<p class="chapter-survivors"><b>Who lived</b><span>' + (s.survivors.length ? s.survivors.map(esc).join(' · ') : 'No one walked out.') + '</span></p>' +
      '<div class="chapter-endactions"><button class="btn primary" data-act="again">Play again</button><button class="btn" data-act="hub">Back to the hub</button></div>' +
      '<details class="chapter-record"><summary>Complete expedition record</summary>' + ending.apply(this, arguments) + '</details></div></section>';
  };
  // Five anchored tips replace the previous two coaching cards.
  Story.coach = function () { return ''; };
  var settings = UI.settingsModal;
  UI.settingsModal = function () {
    var button = UI.S.view && UI.S.view.phase === 'playing' ? '<p><button class="btn small" data-chapter="tutorial">Show the five HUD tips</button></p>' : '';
    return settings.apply(this, arguments).replace('<h2>SOUND &amp; ACCESSIBILITY</h2>', '<h2>SOUND &amp; ACCESSIBILITY</h2>' + button);
  };
  function focusables(root) { return Array.prototype.filter.call(root.querySelectorAll('button, a[href], input, select, [tabindex="0"]'), function (e) { return !e.disabled && e.getBoundingClientRect().width; }); }
  function safeFocus(el) { if (el && el.isConnected && el.focus) el.focus({ preventScroll: true }); }
  function finishIntro() {
    if (!intro) return;
    var old = intro; intro = null; clearInterval(old.timer); save(introKey);
    if (old.el.open && old.el.close) old.el.close(); old.el.remove(); safeFocus(old.returnTo);
    if (old.after) old.after();
  }
  function openIntro(after) {
    if (intro) return; closeTour(false);
    var el = document.createElement('dialog'); el.className = 'chapter-intro'; el.setAttribute('aria-label', 'The Hollow prologue');
    el.innerHTML = backdrop(art.title) + '<div class="chapter-intro-copy"><small class="chapter-eyebrow">Before the first toll</small><h2 id="chapter-intro-title"></h2><p id="chapter-intro-text" aria-live="polite"></p><progress max="60" value="0" aria-label="Prologue progress"></progress><button class="btn" data-chapter="skip-intro">Skip intro</button></div>';
    intro = { el: el, after: after, returnTo: document.activeElement, elapsed: 0, last: performance.now(), scene: -1 };
    document.body.appendChild(el);
    if (el.showModal) el.showModal(); else { el.setAttribute('open', ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); }
    el.addEventListener('cancel', function (e) { e.preventDefault(); finishIntro(); });
    function update() {
      if (!intro || intro.el !== el) return;
      var now = performance.now(); if (!document.hidden) intro.elapsed += Math.max(0, now - intro.last); intro.last = now;
      if (intro.elapsed >= 60000) { finishIntro(); return; }
      var n = Math.min(3, Math.floor(intro.elapsed / 15000));
      if (n !== intro.scene) { intro.scene = n; el.querySelector('h2').textContent = scenes[n][0]; el.querySelector('#chapter-intro-text').textContent = scenes[n][1]; }
      el.querySelector('progress').value = intro.elapsed / 1000;
    }
    update(); if (intro) intro.timer = setInterval(update, 250);
    el.querySelector('button').focus(); hydrate();
    if (g.HollowAudio) { g.HollowAudio.unlock(); g.HollowAudio.setRegion('title'); g.HollowAudio.setMood('explore'); }
  }
  function closeTour(remember) {
    if (!tour) return;
    var old = tour; tour = null; old.el.remove(); old.spot.remove(); if (remember) { save(tutorialKey); save('hollow.tut'); }
    safeFocus(old.returnTo);
  }
  function targetFor(selector) {
    return Array.prototype.find.call(document.querySelectorAll(selector), function (e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  }
  function positionTour() {
    if (!tour) return;
    var t = targetFor(tips[tour.step][0]), r = t && t.getBoundingClientRect(), width = Math.min(310, innerWidth - 24), h = tour.el.getBoundingClientRect().height || 230;
    var x = r ? Math.max(12, Math.min(innerWidth - width - 12, r.left)) : 12;
    var y = r ? r.bottom + 12 : 90;
    if (y + h > innerHeight - 12) y = r ? r.top - h - 12 : innerHeight - h - 12;
    tour.el.style.width = width + 'px'; tour.el.style.left = x + 'px'; tour.el.style.top = Math.max(12, y) + 'px';
    tour.spot.hidden = !r;
    if (r) { tour.spot.style.left = r.left - 4 + 'px'; tour.spot.style.top = r.top - 4 + 'px'; tour.spot.style.width = r.width + 8 + 'px'; tour.spot.style.height = r.height + 8 + 'px'; }
  }
  function drawTip() {
    if (!tour) return;
    var t = tips[tour.step];
    tour.el.innerHTML = '<small class="chapter-eyebrow">' + (tour.step + 1) + ' of 5 · The essentials</small><h2>' + esc(t[1]) + '</h2><p>' + esc(t[2]) + '</p><div class="chapter-tipactions">' + (tour.step ? '<button class="btn ghost small" data-chapter="tip-back">Back</button>' : '') + '<button class="btn primary small" data-chapter="tip-next">' + (tour.step === 4 ? 'Done' : 'Next') + '</button><button class="btn ghost small" data-chapter="tip-skip">Skip tips</button></div>';
    positionTour(); tour.el.querySelector('[data-chapter="tip-next"]').focus({ preventScroll: true });
  }
  function openTour() {
    if (intro || tour || !UI.S.view || UI.S.view.phase !== 'playing') return;
    var el = document.createElement('section'), spot = document.createElement('div');
    el.className = 'chapter-tip'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'HUD guide'); el.setAttribute('aria-modal', 'false');
    spot.className = 'chapter-tipspot'; spot.setAttribute('aria-hidden', 'true');
    tour = { el: el, spot: spot, step: 0, returnTo: document.activeElement };
    document.body.appendChild(spot); document.body.appendChild(el); drawTip();
  }
  function hydrate() {
    document.querySelectorAll('[data-chapter-art]').forEach(function (el) {
      if (el.dataset.chapterLoading) return;
      el.dataset.chapterLoading = '1'; var id = el.dataset.chapterArt;
      g.HollowAssets.load(id).then(function (img) {
        if (!img || !el.isConnected) return;
        var copy = img.cloneNode(); copy.alt = ''; copy.className = 'chapter-photo'; el.insertBefore(copy, el.firstChild); el.classList.add('chapter-art-ready');
      }).catch(function () {});
    });
    var wrap = document.querySelector('.mapwrap');
    if (wrap && wrap.querySelector('svg.map') && !wrap.querySelector('.chapter-map-key')) {
      var key = document.createElement('details'); key.className = 'chapter-map-key';
      key.innerHTML = '<summary>Road symbols</summary>' + g.HollowMap.legend(); wrap.appendChild(key);
    }
  }
  function pump() {
    queued = false; hydrate();
    var v = UI.S.view;
    if (tour && (!v || v.phase !== 'playing' || document.querySelector('.modal'))) closeTour(false);
    if (intro && v) { var old = intro; old.after = null; finishIntro(); }
    if (tour) positionTour();
    if (!v || v.phase !== 'playing' || !v.me || !v.game) return;
    var identity = v.cosmetics && v.cosmetics.runId || v.code;

  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(pump); } }
  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-chapter], [data-act]'); if (!button) return;
    var kind = button.dataset.chapter, action = button.dataset.act;

    if (kind === 'prologue') openIntro();
    if (kind === 'skip-intro') finishIntro();
    if (kind === 'tutorial') {
      var close = document.querySelector('.modal [data-act="closemodal"]'); if (close) close.click();
      requestAnimationFrame(openTour);
    }
    if (kind === 'tip-skip') closeTour(true);
    if (kind === 'tip-next' && tour) { if (tour.step === 4) closeTour(true); else { tour.step++; drawTip(); } }
    if (kind === 'tip-back' && tour) { tour.step = Math.max(0, tour.step - 1); drawTip(); }
  }, true);
  document.addEventListener('keydown', function (event) {
    if (intro && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); finishIntro(); return; }
    if (intro && event.key === 'Tab') {
      var list = focusables(intro.el), first = list[0], last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    if (tour && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeTour(true); }
  }, true);
  if (g.MutationObserver) new g.MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-screen'] });
  document.addEventListener('visibilitychange', function () { document.body.classList.toggle('chapter-paused', document.hidden); });
  g.addEventListener('resize', positionTour);
  g.addEventListener('scroll', positionTour, true);
  g.HollowAssets.ready.then(schedule); schedule();
  g.HollowChapter = { endingKey: endingKey, summary: summary, tips: tips, scenes: scenes, openIntro: openIntro, finishIntro: finishIntro, openTour: openTour, closeTour: closeTour, hydrate: hydrate };
})(window);
