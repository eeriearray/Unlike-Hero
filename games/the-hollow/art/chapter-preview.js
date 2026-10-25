/* Ephemeral engine snapshots and memory-only preferences. No network table or save is opened. */
(function (g) {
  'use strict';
  var store = new Map(), data, mode = 'title', reduced = g.matchMedia('(prefers-reduced-motion: reduce)').matches;
  g.HollowChapterStorage = { getItem: function (k) { return store.get(k); }, setItem: function (k,v) { store.set(k,v); } };
  g.HollowFx = { prefs: {}, reduced: function () { return reduced; } };
  g.HollowAudio = { settings: function () { return { master: .8, music: .55, ambient: .75, sfx: .85 }; }, unlock: function () {}, setRegion: function () {}, setMood: function () {} };
  function $(id) { return document.getElementById(id); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function show(next) {
    mode = next; g.HollowChapter.closeTour(false); var UI = g.HollowUI;
    if (mode === 'title' || mode === 'prologue') {
      UI.S.view = null; $('review').innerHTML = UI.title({ online: true, solo: false, last: null });
      if (mode === 'prologue') g.HollowChapter.openIntro();
    } else if (mode === 'ending') {
      UI.S.view = clone(data.endings[$('ending').value]); $('review').innerHTML = UI.ending();
    } else {
      UI.S.view = clone(data.playing);
      if (mode === 'map') {
        $('review').innerHTML = '<section class="review-map" aria-label="Sample night atlas"><div class="mapwrap"><div id="mapsvg"></div><div id="maptip" class="maptip"></div></div></section>';
        var host = document.querySelector('.mapwrap'); g.HollowMap.reset(); g.HollowMap.attach(host); $('mapsvg').innerHTML = g.HollowMap.render(); g.HollowMap.ensureFit(UI.S.view.me.loc); g.HollowMap.apply();
      } else {
        $('review').innerHTML = '<section class="review-guide">' + g.HollowStory.bar() + '<div class="review-guide-copy"><h2>Five things to keep close.</h2><p>The same HUD and tips used by the game. No turn timer is running in this sample.</p></div><nav class="nav" aria-label="Sections"><button data-act="tab" data-t="act">Adventure</button><button data-act="tab" data-t="map">Map</button><button data-act="tab" data-t="you">You</button><button data-act="tab" data-t="journal">Journal</button></nav></section>';
        g.HollowChapter.openTour();
      }
    }
    $('review-status').textContent = 'Isolated ' + mode + ' sample · no expedition or saved preferences are changed.';
    g.HollowChapter.hydrate();
  }
  g.HollowChapterReview = { start: async function () {
    var response = await fetch('chapter-preview.json'); if (!response.ok) { $('review-status').textContent = 'Review snapshots unavailable. Run node tools/build-chapter-preview.mjs.'; return; }
    data = await response.json(); g.HollowUI.S.cat = data.catalog; g.HollowUI.S.net = { kind: 'offline' };
    document.body.classList.toggle('reduce-motion', reduced);
    document.querySelector('.review-toolbar').addEventListener('click', function (e) { var b = e.target.closest('[data-review]'); if (b) show(b.dataset.review); });
    $('ending').onchange = function () { show('ending'); };
    document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'again') show('title');
      else if (b.dataset.act === 'tab') { show(b.dataset.t === 'map' ? 'map' : 'tour'); }
      else $('review-status').textContent = 'Sample control: ' + b.textContent.trim() + '. No game action was sent.';
    });
    show('title');
    if (g.FontFace) {
      try { var bytes = await g.HollowAssets.load(g.HollowChapterArt.font); if (bytes) { var font = await new FontFace('Gravewire', bytes).load(); document.fonts.add(font); document.body.classList.add('gravewire-ready'); } } catch (e) {}
    }
  } };
})(window);
