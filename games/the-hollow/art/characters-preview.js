/* Isolated visual samples. Preferences here are temporary and never saved. */
(function (g) {
  'use strict';
  var reduced = g.matchMedia('(prefers-reduced-motion: reduce)').matches;
  g.HollowFx = { prefs: { reducedScares: false }, reduced: function () { return reduced; } };
  g.HollowUI = { S: { view: null } }; g.HollowStory = { adventure: function () { return ''; } };
  var foes = { whisperling: 'Whisperling', drowned_pilgrim: 'Drowned Pilgrim', hollow_stag: 'Hollow Stag', grave_warden: 'Grave Warden', mirror_twin: 'Mirror Twin', bellkeeper: 'Bellkeeper', carrion_swarm: 'Carrion Swarm', hollow_hound: 'Hollow Hound', weeping_statue: 'Weeping Statue', abbey_warden: 'Abbey Warden' };
  var names = { occultist: 'Isolde · Occultist', hunter: 'Corvin · Hunter', apothecary: 'Maelis · Apothecary', medium: 'Wren · Medium', exorcist: 'Anselm · Exorcist', vagabond: 'Jory · Vagabond' };
  var n = 0, hp = 4, sequence = 0;
  function $(id) { return document.getElementById(id); }
  function view() {
    var id = $('foe').value, boss = id === 'abbey_warden';
    return { code: 'VISUAL_REVIEW', phase: 'playing', you: 'preview', me: { cls: $('hero').value, status: 'alive', loc: 'square' }, log: [], enc: { id: 'review_' + sequence, kind: boss ? 'boss' : 'enemy', loc: 'square', over: hp <= 0,
      enemy: boss ? null : { id: id, name: foes[id], hp: hp, max: 4 }, boss: boss ? { hp: hp, max: 4, phase: 'Three chains remain', attack: { vit: -2, san: -1 } } : null } };
  }
  function render(message) { var v = view(); g.HollowUI.S.view = v; g.HollowCharacters.sync(v); $('battle').innerHTML = g.HollowStory.adventure(); $('status').textContent = message || 'Scene ready · sample health ' + hp + ' / 4'; }
  function reset() { hp = 4; sequence++; g.HollowCharacters.reset(); render(); }
  function result(damage, defeat) {
    if (hp <= 0) return;
    if (damage) hp = Math.max(0, hp - 1); if (defeat) hp = 0; if (hp <= 0) defeat = true;
    var r = { by: 'preview', loc: 'square', chips: [{ k: 'enemy', n: -1 }] }, v = view();
    if (defeat) v.log.push({ n: ++n, p: 'preview', loc: 'square', k: 'enemy', d: { k: v.enc.kind === 'boss' ? 'bossdown' : 'defeat', id: $('foe').value } });
    v.log.push({ n: ++n, p: 'preview', loc: 'square', k: 'result', d: { result: r } });
    g.HollowUI.S.view = v; g.HollowCharacters.sync(v); $('battle').innerHTML = g.HollowStory.adventure(); g.HollowCharacters.result(r); $('status').textContent = defeat ? 'Defeat dissolve · reset the scene to audition again.' : 'Confirmed hit · sample health ' + hp + ' / 4';
  }
  g.HollowCharacterReview = { start: function () {
    Object.keys(names).forEach(function (id) { $('hero').add(new Option(names[id], id)); });
    Object.keys(foes).forEach(function (id) { $('foe').add(new Option(foes[id], id)); }); $('foe').value = 'bellkeeper';
    $('heroes').innerHTML = Object.keys(names).map(function (id) { return '<article class="review-card">' + g.HollowHeroes.art(id, '', 'review_hero_' + id) + '<h3>' + names[id] + '</h3><p>' + g.HollowHeroes.copy[id].mood + '</p></article>'; }).join('');
    $('foes').innerHTML = Object.keys(foes).map(function (id) { return '<article class="review-card">' + g.HollowArt.enemy(id, 'review_foe_' + id) + '<h3>' + foes[id] + '</h3></article>'; }).join('');
    $('npcs').innerHTML = ['merchant_pell','tower_caretaker','village_survivor','abbey_spirit'].map(function (id) { return '<article class="review-card">' + g.HollowCharacterAssets.npc(id) + '<h3>' + id.replace(/_/g, ' ') + '</h3></article>'; }).join('');
    $('hero').onchange = $('foe').onchange = reset; $('restore').onclick = reset;
    $('hit').onclick = function () { result(true, false); }; $('defeat').onclick = function () { result(false, true); };
    $('attack').onclick = function () { g.HollowCharacters.reaction('attack'); $('status').textContent = reduced || g.HollowFx.prefs.reducedScares ? 'Gentle attack reaction · movement disabled.' : 'Attack anticipation → lunge. In the game this follows a resolved consequence.'; };
    $('motion').checked = reduced; $('motion').onchange = function () { reduced = this.checked; document.body.classList.toggle('reduce-motion', reduced); };
    document.body.classList.toggle('reduce-motion', reduced);
    $('gentle').onchange = function () { g.HollowFx.prefs.reducedScares = this.checked; document.body.classList.toggle('reduced-scares', this.checked); };
    reset();
    fetch('scenes/square.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (config) { return config ? g.HollowAssets.load(config.background) : null; }).then(function (img) { if (img) document.querySelector('.review-background').style.backgroundImage = 'url("' + img.src + '")'; }).catch(function () {});
  } };
})(window);
