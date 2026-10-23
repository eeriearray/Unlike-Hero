/* Step 5: original SVG characters, painted edges, and cosmetic combat presentation.
 * No engine data, rolls, damage, choices or timing are changed. Artwork is inline;
 * the battle background is the current place, blurred by characters.css. */
(function (g) {
  'use strict';
  var A = g.HollowArt, H = g.HollowHeroes, Story = g.HollowStory, FX = g.HollowFx;
  var serial = 0, current = null, previous = null, ghost = null, ghostTimer, seen = null, run = null, place = null;
  var pendingDeath = false, version = 0, timers = [];
  var esc = A.esc;
  var DETAIL = {
    whisperling: '<path d="M34 62q-8 24-17 35m26-15-9 32m49-52 16 39M51 76v26m17-23 7 29" stroke="#b1c8ce" opacity=".32" fill="none"/><path d="M40 32q20-18 40 0" stroke="#edf0dd" opacity=".4" fill="none"/>',
    drowned_pilgrim: '<path d="M34 66q26-12 52 0M29 82q31-14 62 0M25 101q35-14 70 0" fill="none" stroke="#3f6c61" stroke-width="2"/><path d="M58 65v34m-6-20h12" stroke="#b0b29b" opacity=".6"/>',
    hollow_stag: '<path d="M44 62 60 75 76 62M46 86l8 17m20-17-8 17M30 26l-4-15m64 15 4-15" fill="none" stroke="#ad9b76" stroke-width="1.5" opacity=".6"/><path d="M59 76v35" stroke="#e8b578" opacity=".45"/>',
    grave_warden: '<path d="M30 91 53 87m14 0 23 4M31 104l24-7m10 0 24 7M48 28l-4 8m30-9-4 8" stroke="#b7b3a4" fill="none" opacity=".45"/><path d="M46 44h8m12 0h8" stroke="#afcbd1" stroke-width="1.5"/>',
    mirror_twin: '<path d="m48 29 9 17-7 11 17 23-10 24M81 64l9 10-3 10 9 17" stroke="#b4cdd8" stroke-width="1.2" fill="none" opacity=".7"/><path d="M34 24v78" stroke="#e0e7d3" opacity=".35"/>',
    bellkeeper: '<path d="M39 64q21 13 42 0m-47 9q26 17 52 0M46 40l-4 14m31-14 4 14" fill="none" stroke="#d8c58e" opacity=".5"/><path d="m56 86 4 11 4-11" stroke="#241c11" stroke-width="3"/>',
    carrion_swarm: '<g stroke="#8ba0a4" stroke-width=".65" opacity=".7"><path d="m20 20 10-1m27 53 10-1m-25-25 10-1m27 53 10-1m-25-25 10-1m-23-24 8-1"/></g><path d="M30 96q30 20 60-8M18 70q6-27 27-38" stroke="#718b91" fill="none" opacity=".18"/>',
    hollow_hound: '<path d="M32 71q9-11 22-12m-8 27 8-17m13 18 1-21m12 22-4-16M66 49l12 3" stroke="#a5bac0" stroke-width="1.4" fill="none" opacity=".5"/><path d="m81 48 10 5-8 2" fill="#d7d5bd" opacity=".6"/>',
    weeping_statue: '<path d="m47 61-9 38m21-37-4 48m16-47 10 45M52 18l5 12-4 12M63 88l7 10-4 18" stroke="#e3dfc8" stroke-width="1.2" fill="none" opacity=".5"/>',
    abbey_warden: '<path d="M35 87 54 94m11 0 20-7M31 102l24 7m10 0 24-7M46 28l-5 11m35-11-5 11" fill="none" stroke="#bdb9a5" stroke-width="1.5" opacity=".5"/><path d="M60 78v41m-7-25h14" stroke="#bfaa6e" opacity=".6"/><path d="M12 56q9 19 12 43m84-43q-9 19-12 43" stroke="#bdb9a5" stroke-dasharray="3 4" fill="none" opacity=".6"/>'
  };
  function paint(svg, kind, id, scope) {
    if (typeof svg !== 'string' || svg.indexOf('<svg') !== 0) return svg;
    var prefix = 'hc' + (scope ? String(scope).replace(/[^a-zA-Z0-9_]/g, '_') : ++serial) + '_';
    // Every inline instance owns its gradients and filters, including duplicated HUD portraits.
    svg = svg.replace(/id="([^"]+)"/g, function (_, name) { return 'id="' + prefix + name + '"'; }).replace(/url\(#([^)]+)\)/g, function (_, name) { return 'url(#' + prefix + name + ')'; });
    var end = svg.indexOf('>'), open = svg.slice(0, end + 1), body = svg.slice(end + 1, -6), defs = '';
    body = body.replace(/<defs>[\s\S]*?<\/defs>/g, function (d) { defs += d; return ''; });
    var backdrop = '';
    body = body.replace(/<rect width="120" height="130"[^>]*\/>/, function (r) { backdrop = r.replace('<rect ', '<rect class="character-backdrop" '); return ''; });
    var name = prefix + 'paint', scale = kind === 'hero' ? 1.2 : .55;
    defs += '<defs><filter id="' + name + '" x="-15%" y="-12%" width="130%" height="128%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency=".055 .16" numOctaves="2" seed="7" result="brush"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="brush" scale="' + scale + '" xChannelSelector="R" yChannelSelector="G" result="paint"/>' +
      '<feMorphology in="SourceAlpha" operator="dilate" radius=".6" result="edge"/><feOffset in="edge" dx="-1.1" dy="-.8" result="lit"/>' +
      '<feComposite in="lit" in2="SourceAlpha" operator="out" result="rim"/><feFlood flood-color="#b7d3ce" flood-opacity=".5"/>' +
      '<feComposite in2="rim" operator="in" result="light"/><feMerge><feMergeNode in="light"/><feMergeNode in="paint"/></feMerge></filter></defs>';
    open = open.replace('class="', 'data-character="' + esc(id) + '" class="character-art character-' + kind + ' ');
    return open + defs + backdrop + '<g class="character-figure"><g class="character-paint" filter="url(#' + name + ')">' + body + (kind === 'foe' && id !== 'bellkeeper' ? DETAIL[id] || '' : '') + '</g></g></svg>';
  }
  var heroArt = H.art, portrait = A.portrait, enemy = A.enemy;
  H.art = function (id, cls, scope) { return paint(heroArt(id, cls), 'hero', id, scope || 'showcase_' + id); };
  A.portrait = function (id, color) { return paint(portrait(id, color), 'portrait', id); };
  A.enemy = function (id, scope) {
    // The Bellkeeper is a vacant sexton's cassock and rusted frame, not a smiling bell mascot.
    var keeper = '<svg class="portrait" viewBox="0 0 240 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M68 330L80 135 96 100h48l18 35 14 195-29-13-28 23-27-17z" fill="#232a29" stroke="#72766a" stroke-width="2"/><path d="M86 133L63 231l-20 40 14 8 37-43 15-86M151 130l25 85 30 32-11 14-44-37-22-77" fill="#303733" stroke="#72766a" stroke-width="2"/><path d="M89 102V42h62v60M80 42h80M97 55h46M120 42V16" stroke="#9a8260" stroke-width="6" fill="none"/><path d="M97 68l46 24M143 68L97 92" stroke="#4e534b" stroke-width="2"/><path d="M112 53q-15 66 8 118t-9 95q-25 17-14-4t14 4" fill="none" stroke="#baa277" stroke-width="4"/><path d="M93 167l-13 146M144 160l13 148M127 227l5 98" stroke="#101918" stroke-width="5"/><path d="M44 272l-9 20M54 278l-4 19M197 254l13 17" stroke="#a29c83" stroke-width="3"/><path d="M83 324l-18 21h35M145 325l24 20h-35" fill="#101918"/></svg>';
    return paint(id === 'bellkeeper' ? keeper : enemy(id), 'foe', id, scope);
  };
  function battle(v) {
    var e = v && v.enc, m = v && v.me;
    if (!m || m.status !== 'alive' || v.phase !== 'playing' || !e || e.over || e.loc !== m.loc) return null;
    var foe = e.enemy || e.boss;
    if (!foe || foe.hp <= 0 || e.kind !== 'enemy' && e.kind !== 'boss') return null;
    var actor = (v.players || []).filter(function (p) { return p.id === e.pid; })[0] || m;
    return { key: String(e.id), loc: m.loc, actor: e.pid || v.you, hero: actor.cls, id: e.enemy ? foe.id : 'abbey_warden', name: e.enemy ? foe.name : 'The Abbey Warden', hp: foe.hp, max: foe.max, boss: !!e.boss, attack: e.boss ? foe.attack : null, known: !!foe.known, phase: e.boss ? foe.phase : null };
  }
  function html(b) {
    if (!b) return '';
    var tell = b.boss ? 'Next blow: ' + [b.attack && b.attack.vit ? Math.abs(b.attack.vit) + ' Vitality' : '', b.attack && b.attack.san ? Math.abs(b.attack.san) + ' Sanity' : ''].filter(Boolean).join(' · ') : b.known ? 'Weakness known · choose your approach below' : 'Watch its movement · choose your approach below';
    return '<section class="combat-scene' + (b.boss ? ' combat-boss' : '') + '" aria-label="Confrontation with ' + esc(b.name) + '" data-battle="' + esc(b.key) + '">' +
      '<div class="battle-ground" aria-hidden="true"></div><div class="battle-hero" aria-hidden="true">' + H.art(b.hero, '', 'battle_hero_' + b.key) + '</div>' +
      '<div class="battle-foe" aria-hidden="true"><div class="battle-aura"></div>' + A.enemy(b.id, 'battle_foe_' + b.key) + '</div>' +
      '<div class="battle-name"><small>' + (b.boss ? esc(b.phase || 'The chained guardian') : 'A confrontation') + '</small><h2>' + esc(b.name) + '</h2><p class="battle-health" aria-label="Enemy health ' + b.hp + ' of ' + b.max + '"><span style="width:' + Math.max(0, Math.min(100, b.hp / b.max * 100)) + '%"></span></p><p class="battle-tell">' + esc(tell) + '</p></div></section>';
  }
  var adventure = Story.adventure;
  Story.adventure = function () { var v = g.HollowUI.S.view, b = battle(v) || ghost; return html(b) + adventure.apply(this, arguments); };
  function gentle() { return FX.reduced() || FX.prefs.reducedScares; }
  function mark(selector, cls, ms) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
      timers.push(setTimeout(function () { el.classList.remove(cls); }, ms));
    });
  }
  function clearGhost() {
    ghost = null; pendingDeath = false; clearTimeout(ghostTimer);
    if (!current) { document.body.classList.remove('combat-active'); document.querySelectorAll('.combat-scene').forEach(function (el) { el.remove(); }); }
  }
  function dissolve() {
    if (!ghost && !current) return;
    pendingDeath = false; mark('.battle-foe', 'character-dying', gentle() ? 200 : 900);
    clearTimeout(ghostTimer); ghostTimer = setTimeout(clearGhost, gentle() ? 200 : 900);
  }
  function later(fn, ms) {
    var token = version, key = (current || ghost || {}).key;
    timers.push(setTimeout(function () { if (token === version && key === (current || ghost || {}).key) fn(); }, ms));
  }
  function reaction(type, mine) {
    if (type === 'death') { dissolve(); return; }
    if (type === 'foe-hit') mark('.battle-foe', 'character-hit', gentle() ? 180 : 420);
    if (type === 'hero-hit') {
      mark('.battle-hero', 'character-hit', gentle() ? 180 : 420);
      if (mine !== false) mark('#hud-me, .hp-p.you', 'character-hit', gentle() ? 180 : 420);
    }
    if (type === 'attack') {
      mark('.battle-foe', gentle() ? 'character-hit' : 'character-attacking', gentle() ? 180 : 750);
      if (!gentle()) mark('.combat-scene', 'battle-impact', 750);
    }
  }
  var tray = null, sizing = g.ResizeObserver ? new g.ResizeObserver(measure) : null;
  function measure() {
    if (tray && document.body.style) document.body.style.setProperty('--combat-cards', Math.ceil(tray.getBoundingClientRect().height) + 'px');
  }
  function layout() {
    if (!document.querySelector) return;
    var nextTray = document.querySelector('.trayhost');
    if (nextTray !== tray) { if (sizing) sizing.disconnect(); tray = nextTray; if (tray && sizing) sizing.observe(tray); }
    measure();
  }
  function reset() { version++; timers.splice(0).forEach(clearTimeout); clearGhost(); previous = null; current = null; seen = null; }
  function sync(v) {
    var m = v && v.me, runId = v && v.cosmetics && v.cosmetics.runId || v && v.code || 'solo';
    var loc = m && m.loc;
    if (run !== runId || place !== loc) { current = null; reset(); run = runId; place = loc; }
    var next = battle(v), log = v && v.log || [], fresh = seen == null ? [] : log.filter(function (e) { return e.n > seen; });
    seen = log.length ? Math.max(seen || 0, log[log.length - 1].n) : seen == null ? 0 : seen;
    var old = current || previous;
    var death = old && fresh.some(function (e) { return (e.loc === loc || e.p === v.you) && ((e.d || {}).k === 'defeat' && e.d.id === old.id || old.boss && (e.d || {}).k === 'bossdown'); });
    var result = fresh.some(function (e) { return e.k === 'result' && e.d && e.d.result && (e.loc || e.d.result.loc) === loc; });
    if (death && !next) { ghost = Object.assign({}, old, { hp: 0 }); pendingDeath = true; clearTimeout(ghostTimer); ghostTimer = setTimeout(clearGhost, 12500); }
    else if (next || !ghost) { ghost = null; clearTimeout(ghostTimer); }
    current = next; if (next) previous = next;
    document.body.classList.toggle('combat-active', !!(next || ghost));
    document.body.classList.toggle('character-fallen', !!(m && m.status === 'fallen'));
    var token = version;
    requestAnimationFrame(function () {
      if (token !== version) return;
      layout();
      if (death && !result) dissolve();
      if (fresh.some(function (e) { return e.k === 'fall' && e.p === v.you; })) mark('#hud-me .character-art', 'character-dying', gentle() ? 200 : 900);
      if (!result && fresh.some(function (e) { return e.k === 'dmg' && e.p === (old ? old.actor : v.you); })) {
        if (old) { reaction('attack'); later(function () { reaction('hero-hit', old.actor === v.you); }, gentle() ? 0 : 360); }
        else reaction('hero-hit');
      }
    });
  }
  // Called on the existing dice/result beat, after the authoritative roll is shown.
  function result(r) {
    if (!current && !ghost) return;
    var b = current || ghost; if (r.loc && r.loc !== b.loc) return;
    var chips = r.chips || [], hit = chips.some(function (c) { return c.k === 'enemy' && c.n < 0; });
    var hurt = r.by === b.actor && chips.some(function (c) { return (c.k === 'vit' || c.k === 'san') && c.n < 0; });
    if (hit) reaction('foe-hit');
    if (hurt) { reaction('attack'); later(function () { reaction('hero-hit', r.by === (g.HollowUI.S.view || {}).you); }, gentle() ? 0 : 360); }
    if (pendingDeath) later(dissolve, hit && !gentle() ? 380 : 0);
  }
  document.addEventListener('visibilitychange', function () { document.body.classList.toggle('characters-paused', document.hidden); });
  g.HollowCharacters = { sync: sync, result: result, battle: battle, html: html, reaction: reaction, reset: reset };
})(window);
