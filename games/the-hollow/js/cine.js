/* THE HOLLOW — cinematic moments. A small queue that plays short sequences in response to REAL game events (the app
 * feeds it from the shared log): arriving somewhere, a discovery, the Haunting advancing, a supernatural omen.
 * It never changes game state. Ordinary actions stay instant; skip with a click, Esc or the Skip button, or turn
 * "Cinematic moments" off in Settings. Reduced motion shows a still card instead of movement. */
(function (g) {
  'use strict';
  var A = g.HollowArt, esc = A.esc, FX = g.HollowFx, C = g.HollowCine = {};
  var q = [], cur = null, layer = null, timer = 0;
  var PHASE_TINT = ['#2f6f7a', '#8a6a2a', '#8a2f3a'];
  var PILLAR_ICON = { fate: 'grave', bell: 'bell', entity: 'eye', end: 'book' };

  function on() { return FX.prefs.cine !== false; }
  function ensure() { if (!layer) { layer = document.createElement('div'); layer.id = 'cine'; layer.setAttribute('aria-live', 'polite'); document.body.appendChild(layer); } return layer; }
  function first(t) { var m = String(t || '').match(/^[^.!?]+[.!?]/); return m ? m[0] : String(t || ''); }

  var BUILD = {
    arrive: function (d) {
      return { cls: 'arrive', ms: 2300, html: '<div class="ca-title"><span class="ca-rg" style="color:' + esc(d.color || '#ccc') + '">' + esc(d.region) + '</span><h1>' + esc(d.title) + '</h1><p>' + esc(d.hook || '') + '</p></div>', sfx: 'arrive' };
    },
    clue: function (d) {
      return { cls: 'full clue', ms: 3600, html: '<div class="cf-beam"></div><div class="cf-card"><div class="cf-ico">' + A.glyph(PILLAR_ICON[d.pillar] || 'book', 64) + '</div><small>' + (d.mine ? 'You discover' : esc(d.by || 'Someone') + ' discovers') + '</small><h2>' + esc(d.title) + '</h2><p>' + esc(first(d.text)) + '</p><em>Added to the journal</em></div>', sfx: 'clue' };
    },
    phase: function (d) {
      var n = d.phase, names = g.HollowApp ? null : null;
      return { cls: 'full phase p' + n, ms: 3800, tint: PHASE_TINT[n - 1], html: '<div class="cf-card"><small>The Haunting advances</small><h2>Phase ' + ['I', 'II', 'III'][n - 1] + '</h2><h3>' + esc(d.name) + '</h3><p>' + esc(d.text) + '</p></div>', sfx: 'phase' };
    },
    spirit: function (d) {
      return { cls: 'full spirit', ms: 3400, html: '<svg class="ghost" viewBox="0 0 120 200" aria-hidden="true"><path d="M60 8c-26 0-38 24-36 52 2 24-8 50-18 76 14-4 24 2 30 16 8-12 16-12 24 0 8-12 16-12 24 0 6-14 16-20 30-16-10-26-20-52-18-76C98 32 86 8 60 8z" fill="#cfe0ff" opacity=".55"/><ellipse cx="46" cy="64" rx="6" ry="10" fill="#05070b"/><ellipse cx="74" cy="64" rx="6" ry="10" fill="#05070b"/><ellipse cx="60" cy="92" rx="5" ry="9" fill="#05070b"/></svg><div class="cf-card"><small>Something stirs</small><h2>' + esc(d.title) + '</h2><p>' + esc(first(d.text)) + '</p></div>', sfx: 'sanity' };
    }
  };

  C.play = function (type, data) {
    if (!on() || !BUILD[type]) return;
    if (type === 'arrive' && (cur || q.length)) return;        // an arrival card never waits in line
    if (q.length > 3) q.shift();
    q.push({ type: type, data: data }); if (!cur) next();
  };
  function next() {
    var job = q.shift(); if (!job) { cur = null; return; }
    var b = BUILD[job.type](job.data), el = document.createElement('div'), quick = FX.reduced();
    cur = el; el.className = 'cine ' + b.cls + (quick ? ' still' : '');
    if (b.tint) el.style.setProperty('--tint', b.tint);
    el.innerHTML = b.html + (b.cls.indexOf('full') >= 0 ? '<button class="skip" data-cine="skip">Skip</button>' : '');
    ensure().appendChild(el);
    if (g.HollowAudio && b.sfx) g.HollowAudio.sfx(b.sfx);
    if (b.cls.indexOf('full') >= 0 && g.HollowAudio) g.HollowAudio.hush(900);
    requestAnimationFrame(function () { el.classList.add('in'); });
    timer = setTimeout(done, quick ? Math.min(b.ms, 1800) : b.ms);
  }
  function done() {
    clearTimeout(timer); var el = cur; if (!el) return;
    el.classList.remove('in'); el.classList.add('out');
    setTimeout(function () { el.remove(); if (cur === el) { cur = null; next(); } }, 320);
  }
  C.skip = function () { if (cur) { q.length = 0; done(); } };
  C.busy = function () { return !!cur; };
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.cine.full')) C.skip(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur) { C.skip(); e.stopPropagation(); } }, true);
})(window);
