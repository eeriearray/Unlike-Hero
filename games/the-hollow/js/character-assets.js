/* Supplied character art. Missing/failed media retains the existing renderer. */
(function (g) {
  'use strict';
  var A = g.HollowArt, H = g.HollowHeroes, assets = g.HollowAssets, esc = A.esc;
  var heroes = ['occultist','hunter','apothecary','medium','exorcist','vagabond'];
  var enemies = ['whisperling','drowned_pilgrim','hollow_stag','grave_warden','mirror_twin','bellkeeper','carrion_swarm','hollow_hound','weeping_statue','abbey_warden'];
  function label(id) { return id.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  var base = new URL('../', document.currentScript.src), mapping = null, scheduled = false;
  function frame(group, id, variant, fallback, cls) {
    return '<span class="supplied-character ' + (cls || '') + '" role="img" aria-label="' + esc(label(id)) + '" data-character-group="' + group + '" data-character-id="' + esc(id) + '" data-character-variant="' + variant + '"><span class="supplied-fallback" aria-hidden="true">' + fallback + '</span></span>';
  }
  var portrait = A.portrait, hero = H.art, enemy = A.enemy;
  A.portrait = function (id) { return heroes.indexOf(id) >= 0 ? frame('heroes', id, 'portrait', portrait.apply(this, arguments), 'portrait') : portrait.apply(this, arguments); };
  H.art = function (id) { return heroes.indexOf(id) >= 0 ? frame('heroes', id, 'fullbody', hero.apply(this, arguments), 'hero-art') : hero.apply(this, arguments); };
  A.enemy = function (id) { return enemies.indexOf(id) >= 0 ? frame('enemies', id, 'fullbody', enemy.apply(this, arguments), 'portrait') : enemy.apply(this, arguments); };
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(scan); } }
  function scan() {
    scheduled = false;
    if (!mapping) return;
    // The compact game skin keeps its readable threat panel. Only a matching
    // delivered portrait is added; absent enemies keep their text presentation.
    document.querySelectorAll('.asset-direction .battle-foe [data-character-group="enemies"]').forEach(function (figure) {
      var who = figure.dataset.characterId;
      if (!mapping.enemies || !mapping.enemies[who]) return;
      var name = figure.closest('.combat-scene').querySelector('.battle-name');
      if (name && !name.querySelector('.supplied-threat')) name.insertAdjacentHTML('afterbegin', frame('enemies', who, 'portrait', '', 'supplied-threat'));
    });
    document.querySelectorAll('[data-character-group]').forEach(function (el) {
      if (el.dataset.characterLoading) return;
      if (document.body.classList.contains('asset-direction') && el.closest('.battle-hero, .battle-foe')) return;
      var set = mapping[el.dataset.characterGroup], entry = set && set[el.dataset.characterId];
      var id = entry && entry[el.dataset.characterVariant];
      if (!id) return;
      el.dataset.characterLoading = '1';
      assets.load(id).then(function (image) {
        if (!image || !el.isConnected) return;
        var img = image.cloneNode(); img.alt = ''; img.setAttribute('aria-hidden', 'true');
        img.className = 'supplied-character-image'; el.appendChild(img); el.classList.add('supplied-ready');
      }).catch(function () { /* Retain the original art/insignia. */ });
    });
  }
  fetch(new URL('art/character-art.json', base)).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) { mapping = data; return assets.ready; }).then(schedule).catch(function () {});
  if (g.MutationObserver) new MutationObserver(schedule).observe(document.getElementById('app') || document.body, {childList:true,subtree:true});
  g.HollowCharacterAssets = { scan: schedule, npc: function (id) { return frame('npcs', id, 'portrait', '', 'npc-portrait'); } };
})(window);
