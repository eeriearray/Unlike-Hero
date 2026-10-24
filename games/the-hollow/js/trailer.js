/* Gesture-started trailer; hosting continues once on Skip, Escape, or completion. */
(function (g) {
  'use strict';
  var active = null, assets = g.HollowAssets, esc = g.HollowArt.esc;
  var story = [
    ['The village that vanished', 'Thornwick is missing from every map. The road still knows the way.'],
    ['A bell with no keeper', 'Each night, the empty tower rings. Each toll remembers another name.'],
    ['Six roads into the dark', 'Bring a lantern. Trust your companions. Read what the dead left behind.'],
    ['Your name is not yet written', 'Find the truth beneath the Abbey. Decide what the bell deserves. Come home, if you can.']
  ];
  function stopGlow(session) {
    clearTimeout(session.glowTimer); session.glowTimer = null;
  }
  function startGlow(session) {
    if (session.reduced || session.glowTimer) return;
    function paint() {
      if (active !== session || session.video.paused || document.hidden) { stopGlow(session); return; }
      try { session.glow.getContext('2d').drawImage(session.video, 0, 0, 160, 67); } catch (e) { /* Poster remains behind the glow. */ }
      session.glowTimer = setTimeout(paint, 180);
    }
    paint();
  }
  function syncControls(session) {
    if (active !== session) return;
    session.toggle.textContent = session.video.paused ? (session.video.ended ? 'Replay' : 'Play') : 'Pause';
    session.toggle.setAttribute('aria-label', session.video.paused ? 'Play trailer' : 'Pause trailer');
    session.mute.textContent = session.video.muted ? 'Sound off' : 'Sound on';
    session.mute.setAttribute('aria-label', session.video.muted ? 'Unmute trailer' : 'Mute trailer');
    session.el.classList.toggle('is-playing', !session.video.paused);
    if (session.video.paused) stopGlow(session); else startGlow(session);
  }
  function play(session) {
    if (active !== session || session.toggle.disabled) return;
    function blocked() {
      if (active !== session) return;
      session.status.textContent = 'Press Play to watch, or Skip to continue.';
      session.el.classList.add('needs-attention'); syncControls(session);
    }
    try {
      if (session.video.ended) session.video.currentTime = 0;
      var playing = session.video.play();
      if (playing && playing.catch) playing.catch(blocked);
      session.el.classList.remove('needs-attention'); syncControls(session);
    } catch (e) { blocked(); }
  }
  function close() {
    if (!active) return;
    var old = active; active = null;
    stopGlow(old); old.video.pause(); old.video.removeAttribute('src'); old.video.load();
    if (old.el.open && old.el.close) old.el.close();
    old.el.remove();
    if (g.HollowAudio && g.HollowAudio.setMediaFocus) g.HollowAudio.setMediaFocus(false);
    if (old.returnTo && old.returnTo.isConnected) old.returnTo.focus({ preventScroll: true });
    if (old.after) old.after();
  }
  function open(options) {
    options = options || {};
    if (active) return Promise.resolve(false);
    var el = document.createElement('dialog'); el.className = 'trailer-dialog';
    el.setAttribute('aria-label', 'The Hollow cinematic trailer');
    var hosting = typeof options.after === 'function';
    el.innerHTML = '<h2 class="trailer-name">The Hollow · Trailer</h2>' +
      '<div class="trailer-ambient" aria-hidden="true"></div><canvas class="trailer-glow" width="160" height="67" aria-hidden="true"></canvas><div class="trailer-vignette" aria-hidden="true"></div>' +
      '<video playsinline preload="metadata" tabindex="-1" aria-label="The Hollow trailer video"></video>' +
      '<button class="trailer-control trailer-skip" data-trailer-close>' + (hosting ? 'Skip trailer' : 'Close trailer') + '</button>' +
      '<div class="trailer-tools"><button class="trailer-control" data-trailer-toggle disabled aria-label="Play trailer">Play</button><button class="trailer-control" data-trailer-mute aria-label="Mute trailer">Sound on</button></div>' +
      '<p class="trailer-status" role="status">' + (hosting ? 'Preparing the trailer. Skip at any time to continue into hosting.' : 'Preparing the film.') + '</p>' +
      '<details class="trailer-text"><summary>Story text</summary><div>' + story.map(function (s) { return '<p><b>' + esc(s[0]) + '</b><br>' + esc(s[1]) + '</p>'; }).join('') + '</div></details>';
    var video = el.querySelector('video'), status = el.querySelector('.trailer-status'), details = el.querySelector('details');
    var session = active = { el: el, video: video, status: status, glow: el.querySelector('canvas'), toggle: el.querySelector('[data-trailer-toggle]'), mute: el.querySelector('[data-trailer-mute]'), glowTimer: null, returnTo: document.activeElement, after: hosting ? options.after : null };
    session.toggle.addEventListener('click', function () { if (video.paused) play(session); else { video.pause(); syncControls(session); } });
    session.mute.addEventListener('click', function () { video.muted = !video.muted; syncControls(session); });
    video.addEventListener('play', function () { syncControls(session); });
    video.addEventListener('pause', function () { syncControls(session); });
    video.addEventListener('volumechange', function () { syncControls(session); });
    video.addEventListener('ended', function () { syncControls(session); if (active === session && session.after) close(); });
    document.body.appendChild(el);
    if (el.showModal) el.showModal();
    else { el.setAttribute('open', ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); }
    el.querySelector('[data-trailer-close]').addEventListener('click', close);
    el.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    video.addEventListener('error', function () { if (active !== session) return; el.classList.add('needs-attention'); status.textContent = 'The video could not load. You can read the complete trailer story below.'; details.open = true; });
    el.querySelector('[data-trailer-close]').focus({ preventScroll: true });
    var audio = g.HollowAudio, prefs = audio && audio.settings ? audio.settings() : {};
    video.muted = !!prefs.muted; video.volume = Math.max(0, Math.min(1, prefs.master == null ? 1 : prefs.master));
    if (audio && audio.setMediaFocus) audio.setMediaFocus(true);
    var reduced = g.HollowFx && (g.HollowFx.reduced() || g.HollowFx.prefs.reducedScares);
    session.reduced = !!reduced;
    if (reduced) {
      el.classList.add('needs-attention');
      status.textContent = 'Reduced effects are enabled. The supplied video still contains motion and unsettling imagery. Play only if you want to, or read the story below.';
      details.open = true;
    }
    return assets.ready.then(function () {
      if (active !== session) return false;
      var url = assets.url('opening_trailer'), poster = assets.url('opening_trailer_poster');
      if (poster) { video.poster = poster; el.querySelector('.trailer-ambient').style.backgroundImage = 'url("' + poster + '")'; }
      if (!url) { el.classList.add('needs-attention'); status.textContent = 'The video is unavailable. Read the trailer story below.'; details.open = true; return false; }
      video.src = url; session.toggle.disabled = false; syncControls(session);
      if (options.autoplay && !reduced) play(session);
      return true;
    }).catch(function () { if (active === session) { el.classList.add('needs-attention'); status.textContent = 'The video is unavailable. Read the trailer story below.'; details.open = true; } return false; });
  }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-trailer="open"]')) open({ autoplay: true }); });
  document.addEventListener('visibilitychange', function () { if (active && document.hidden) { active.video.pause(); syncControls(active); } });
  document.addEventListener('keydown', function (e) {
    if (!active) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    var onControl = e.target && e.target.closest && e.target.closest('button, summary');
    if (e.key === 'k' || (e.key === ' ' && !onControl)) { e.preventDefault(); if (active.video.paused) play(active); else { active.video.pause(); syncControls(active); } }
    if (e.key === 'm') { e.preventDefault(); active.video.muted = !active.video.muted; syncControls(active); }
    // Native dialog traps focus; retain that behavior in older-browser fallback.
    if (e.key === 'Tab') {
      var list = Array.from(active.el.querySelectorAll('button, summary')).filter(function (el) { return !el.disabled; });
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  g.HollowTrailer = { open: open, close: close };
})(window);
