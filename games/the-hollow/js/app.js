/* THE HOLLOW — the client. It renders what the server sends and sends back what the player chooses.
 * It never decides a roll, a reward or a rule. This file: screens, input, and the bridge from game events
 * (the shared log) to sound, effects and announcements. */
(function (g) {
  'use strict';
  var A = g.HollowArt, AU = g.HollowAudio, FX = g.HollowFx, Net = g.HollowNet, UI = g.HollowUI, MAP = g.HollowMap, Story = g.HollowStory, Heroes = g.HollowHeroes, S = UI.S;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = A.esc;
  var hub = null;
  var pending = null;            // a confirmed action waiting for "Yes"
  var seen = { n: 0, init: false };
  var htmlOf = {};               // last html per region, so unchanged regions are not touched
  var started = false, reported = false, lastActive = null, lastRegion = null, lastEncId = null;
  UI.setAudio(AU);

  // ───────────────────────────── boot ─────────────────────────────
  FX.apply(); FX.startDust();
  try { hub = g.Hub ? g.Hub.init({ id: 'the-hollow', version: '1.0.0', title: 'The Hollow' }) : null; } catch (e) { hub = null; }
  var storedName = '';
  try { storedName = (hub && hub.player && hub.player().name) || localStorage.getItem('hollow.name') || ''; } catch (e) { /* ignore */ }
  S.ui.name = storedName;
  var qp = new URLSearchParams(location.search);
  if (qp.get('room')) S.ui.code = qp.get('room').toUpperCase().slice(0, 4);

  ['pointerdown', 'keydown'].forEach(function (ev) { addEventListener(ev, function () { AU.unlock(); }, { once: false, passive: true }); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) AU.unlock(); });
  AU.onCaption(function (t) {
    var box = $('#captions'); if (!box) return;
    var s = document.createElement('span'); s.textContent = '(' + t + ')'; box.appendChild(s);
    setTimeout(function () { s.remove(); }, 2600);
  });

  // ───────────────────────────── helpers ─────────────────────────────
  function toast(text, tone) {
    var box = $('#toasts'), t = document.createElement('div');
    t.className = 'toast ' + (tone || ''); t.textContent = text; box.appendChild(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(function () { t.remove(); }, tone === 'bad' ? 5200 : 3800);
  }
  function announce(text) { var s = $('#sr'); if (s) s.textContent = text; }
  function setScreen(name) { document.body.setAttribute('data-screen', name); }

  function fk(el) {
    var d = el.dataset; return [d.act, d.opt, d.val, d.loc, d.item, d.to, d.way, d.edge, d.pick, d.t, d.stat, d.make, d.mode, d.kind, d.target, d.src, d.id, d.ending].filter(Boolean).join('|');
  }
  function patch(id, html, root) {
    var el = typeof id === 'string' ? $('#' + id) : id; if (!el) return;
    var key = el.id || id;
    if (htmlOf[key] === html) return;
    htmlOf[key] = html;
    var act = document.activeElement, focusKey = act && el.contains(act) ? fk(act) : null, st = el.scrollTop, ids = act && act.id;
    el.innerHTML = html;
    el.scrollTop = st;
    if (focusKey) { var all = el.querySelectorAll('[data-act]'); for (var i = 0; i < all.length; i++) if (fk(all[i]) === focusKey) { all[i].focus({ preventScroll: true }); break; } }
    else if (ids) { var f = document.getElementById(ids); if (f) f.focus(); }
  }
  function timerTick() {
    var now = Date.now();
    document.querySelectorAll('.timer[data-end]').forEach(function (el) {
      var s = Math.max(0, Math.round((el.dataset.end - now) / 1000));
      el.textContent = '⏱ ' + Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
      el.classList.toggle('low', s < 20);
    });
  }
  setInterval(timerTick, 1000);

  // ───────────────────────────── net handlers ─────────────────────────────
  var handlers = {
    onState: function (v) {
      if (!S.net) return;          // a late message from a transport we have already left
      S.view = v;
      if (v.phase !== 'lobby' && !started) { started = true; reported = false; setTimeout(function () { var L = S.view && S.view.me && S.cat.locations[S.view.me.loc]; if (L && S.view.game.round <= 1) g.HollowCine.play('arrive', { title: L.name, region: S.cat.regions[L.region].name, color: S.cat.regions[L.region].color, hook: 'Your expedition begins.' }); }, 600); if (hub) hub.report('session-start', { game: 'the-hollow' }); }
      if (v.phase === 'lobby') { started = false; seen.init = false; }
      handleLog(v);
      render();
      autoOpen();
      syncAudio();
      if (S.ui.busy) S.ui.busy = false;
    },
    onCatalog: function (c) { if (S.net) S.cat = c; },
    onClosed: function (reason) {
      if (!S.net) return;
      toast(reason || 'The expedition was closed.', 'bad');
      toTitle(reason);
    },
    onStatus: function (st) {
      if (!S.net) return;
      S.ui.status = st;
      var old = $('#netstat'); if (old) old.remove();
      if (st === 'reconnecting') { var d = document.createElement('div'); d.id = 'netstat'; d.className = 'overlay-status'; d.setAttribute('role', 'alert'); d.textContent = 'Lost the thread to the Hollow. Reconnecting… your seat is kept.'; document.body.appendChild(d); }
      else if (st === 'connected' && S.view) { toast('Reconnected.', 'good'); }
    }
  };

  function toTitle(msg) {
    if (S.net) { try { S.net.leave(); } catch (e) { /* closed */ } }
    S.net = null; S.view = null; S.ui.sel = null; S.ui.modal = null; S.ui.err = typeof msg === 'string' ? msg : '';
    seen = { n: 0, init: false }; htmlOf = {}; started = false; MAP.reset();
    $('#modal-root').innerHTML = ''; $('#phase-banner').classList.remove('on');
    var ns = $('#netstat'); if (ns) ns.remove();
    AU.setMood('quiet'); AU.setRegion('title'); AU.setLevel(0);
    render();
  }

  // ───────────────────────────── render ─────────────────────────────
  function render() {
    var app = $('#app'), v = S.view;
    FX.apply();
    var stale = $('#endlayer'); if (stale && (!v || v.phase !== 'ended')) { stale.remove(); htmlOf.endlayer = null; }
    if (!v) { setScreen('title'); renderTitle(); return; }
    if (!S.cat) { app.innerHTML = '<div class="title"><p class="tagline">The Hollow stirs…</p></div>'; return; }
    if (v.phase === 'lobby') { setScreen('lobby'); renderLobby(); return; }
    setScreen('game');
    ensureGameShell();
    patch('hdr', Story.bar());
    if (v.me && v.me.status !== undefined) {
      if (S.ui.coach == null) S.ui.coach = (function () { try { return localStorage.getItem('hollow.tut') ? 'done' : (v.game.round <= 1 ? 0 : 'done'); } catch (e) { return 0; } })();
      if (S.ui.coach === 1 && v.enc && v.enc.result) S.ui.coach = 2;
      if (S.ui.travel && (v.game.active !== v.you || !v.act)) S.ui.travel = false;
      if (S.ui.prep && (!v.enc || v.game.active !== v.you || v.enc.hold)) S.ui.prep = null;
      patch('left', UI.left());
      patch('right', UI.right());
      patch('adv', Story.adventure());
      patch('side', Story.side());
      var sk = (v.me.loc || '') + '|' + (v.enc ? v.enc.id : '');
      if (S.ui.sceneKey !== sk) { S.ui.sceneKey = sk; var sc = $('#adv .scene'); if (sc) { sc.classList.add('enter'); setTimeout(function () { sc.classList.remove('enter'); }, 1100); } var ad = $('#adv'); if (ad) ad.scrollTop = 0; }
      // new story beats fade in once (not on every refresh)
      var beatKey = [].map.call(document.querySelectorAll('#adv .story, #adv .outcome'), function (e) { return e.textContent.slice(0, 60); }).join('|');
      if (S.ui.beatKey !== beatKey) { var prevB = (S.ui.beatKey || '').split('|'); S.ui.beatKey = beatKey; document.querySelectorAll('#adv .story, #adv .outcome').forEach(function (e) { if (prevB.indexOf(e.textContent.slice(0, 60)) < 0) { e.classList.add('beat'); setTimeout(function () { e.classList.remove('beat'); }, 1000); } }); }
      if (S.ui.map || S.ui.tab === 'map') {
        MAP.ensureFit(v.me.loc); MAP.ensureVisible(v.me.loc);
        var mh = MAP.render();
        if (!MAP.isDragging()) patch($('#mapsvg'), mh);
        patch('mapsheet', mapSheet());
      }
      patch('nav', navHtml());
      var gm = $('.game2'); if (gm) { gm.setAttribute('data-drawer', S.ui.drawer || ''); gm.setAttribute('data-map', S.ui.map ? 'open' : ''); gm.setAttribute('data-tab', S.ui.tab); gm.setAttribute('data-phase', v.game.haunt); gm.style.setProperty('--ph', v.game.haunt); }
      markInventory(v);
      animateDie();
    }
    // the ending
    var endEl = $('#endlayer');
    if (v.phase === 'ended') {
      if (!endEl) { endEl = document.createElement('div'); endEl.id = 'endlayer'; document.body.appendChild(endEl); }
      patch(endEl, UI.ending());
      if (hub && !reported) { reported = true; hub.report('session-end', { result: v.ended.outcome === 'failure' ? 'lose' : v.ended.outcome === 'unresolved' ? 'quit' : 'win', ending: v.ended.id }); }
    } else if (endEl) { endEl.remove(); htmlOf.endlayer = null; }
    renderModal();
  }

  function ensureGameShell() {
    var app = $('#app');
    if ($('.game2', app)) return;
    htmlOf = {};
    app.innerHTML = '<div class="game2" data-tab="' + S.ui.tab + '" data-drawer="" data-map=""><div id="hdr" class="hdrwrap"></div><main class="adv" id="adv" aria-live="polite" aria-label="The adventure"></main><aside class="side" id="side" aria-label="You and the map"></aside><section class="mapview" id="mapview" aria-label="Map of the Hollow"><div class="mapwrap"><div id="mapsvg"></div><div class="mapctl"><button class="btn" data-act="closemap" aria-label="Close the map">✕</button><button class="btn" data-act="zin" aria-label="Zoom in">+</button><button class="btn" data-act="zout" aria-label="Zoom out">−</button><button class="btn" data-act="zme" aria-label="Centre on me">' + A.glyph('circle', 18) + '</button><button class="btn" data-act="zall" aria-label="Show everything discovered">' + A.glyph('maze', 18) + '</button></div><div class="maplegend"><span class="l here">you</span><span class="l go">you can go</span><span class="l danger">danger</span><span class="l seen">visited</span><span class="l new">unexplored</span></div><div id="maptip" class="maptip" role="tooltip"></div><div id="mapsheet" class="mapsheet"></div></div></section><aside class="drawer dleft" id="left" aria-label="Your character"></aside><aside class="drawer dright" id="right" aria-label="The journal"></aside><nav class="nav" id="nav" aria-label="Sections"></nav></div>';
    MAP.attach($('.mapwrap'));
  }

  // the dice are rolled by the server; this only reveals the real number, briefly, in place
  function animateDie() {
    var el = $('#adv .mdie'); if (!el) return;
    var n = el.dataset.n; if (S.ui.animN === n) return; S.ui.animN = n;
    var final = el.dataset.d; if (FX.reduced()) return;
    var i = 0, t = setInterval(function () { var e2 = $('#adv .mdie'); if (!e2) { clearInterval(t); return; } i++; e2.textContent = i < 9 ? 1 + Math.floor(Math.random() * 20) : final; e2.classList.toggle('roll', i < 9); if (i >= 9) { clearInterval(t); e2.classList.add('landed'); } }, 85);
  }

  // At the start of your turn the place's choices are simply there: no extra click to "look around".
  function autoOpen() {
    var v = S.view; if (!v || v.phase !== 'playing' || !v.me || v.me.status !== 'alive') return;
    if (v.game.active !== v.you || v.enc || !v.act || !v.act.interact.ok) return;
    var key = v.game.round + '|' + v.me.loc + '|' + v.game.active;
    if (S.ui.autoKey === key) return;
    S.ui.autoKey = key; send({ t: 'interact' });
  }


  // ───────────── the character-select showcase ─────────────
  function renderLobby() {
    var app = $('#app'), v = S.view, cat = S.cat, me = UI.me(), host = v.hostId === v.you;
    if (!$('.lobby2', app)) {
      htmlOf = {};
      app.innerHTML = '<div class="lobby2"><header id="l2top" class="l2top"></header><div id="l2rules"></div><section id="l2stage" class="l2stage" aria-live="polite"></section><nav id="l2rail" class="l2rail" aria-label="Choose your hero"></nav><footer id="l2act" class="l2act"></footer></div>';
    }
    if (!S.ui.hero || (S.ui.hero !== me.cls && v.players.some(function (p) { return p.cls === S.ui.hero && p.id !== v.you; }))) S.ui.hero = me.cls || Heroes.order.find(function (id) { return !v.players.some(function (p) { return p.cls === id; }); }) || Heroes.order[0];
    var h = S.ui.hero, c = cat.classes[h], owner = v.players.find(function (p) { return p.cls === h; });
    var top = '<div class="mk"><span class="mark">The Hollow</span><span class="chap">Choose your hero</span></div><div class="room">' + (S.net && S.net.kind === 'online' ? '<span class="tag">Expedition</span><b>' + esc(v.code) + '</b><button class="btn small" data-act="copylink">Copy invite</button>' : '<span class="tag">Solo expedition</span>') + '</div><div class="roster">' +
      v.players.map(function (p) { var pc = p.cls ? cat.classes[p.cls] : null; return '<span class="rc' + (p.id === v.you ? ' me' : '') + '" title="' + esc(p.name + (p.cls ? ', ' + pc.name : ', choosing') + (p.ready || p.host ? ', ready' : '')) + '"><span class="rp" style="--ac:' + (pc ? pc.color : '#555') + '">' + (p.cls ? A.portrait(p.cls, pc.color) : '') + '</span><b>' + esc(p.name.replace(' (ghost)', '')) + '</b>' + (p.cls && (p.ready || p.host) ? '<i class="ok">✓</i>' : '') + '</span>'; }).join('') + '</div><div class="bt">' + (host ? '<button class="btn ghost small" data-act="rules">Table</button>' : '') + '<button class="btn ghost small" data-act="howto">How to play</button><button class="btn ghost icon-btn" data-act="settings" aria-label="Settings">' + A.glyph('circle', 20) + '</button><button class="btn ghost small" data-act="leave">Leave</button></div>';
    patch('l2top', top);
    // host rules, only when asked for
    var st = v.settings, rules = '';
    if (host && S.ui.rules) rules = '<div class="l2rules"><div class="field"><label for="f-afk">If a player goes quiet</label><select id="f-afk" data-act="setafk"><option value="skip"' + (st.afk === 'skip' ? ' selected' : '') + '>Skip their turns</option><option value="ai"' + (st.afk === 'ai' ? ' selected' : '') + '>A ghost-hand plays for them</option><option value="wait"' + (st.afk === 'wait' ? ' selected' : '') + '>Wait up to 5 minutes</option></select></div><div class="field"><label for="f-turn">Turn timer</label><select id="f-turn" data-act="setturn">' + [60, 90, 150, 240, 420].map(function (x) { return '<option value="' + x + '"' + (st.turnSec === x ? ' selected' : '') + '>' + (x < 120 ? x + ' s' : x / 60 + ' min') + '</option>'; }).join('') + '</select></div><button class="btn small" data-act="addbot"' + (v.players.length >= 6 ? ' disabled' : '') + '>+ Ghost companion</button>' + v.players.filter(function (p) { return p.id.indexOf('bot') === 0; }).map(function (p) { return '<button class="btn tiny" data-act="kickbot" data-id="' + esc(p.id) + '">Dismiss ' + esc(p.name.replace(' (ghost)', '')) + '</button>'; }).join('') + '</div>';
    patch('l2rules', rules);
    patch('l2stage', Heroes.showcase(cat, h, S.ui));
    if (S.ui.lastHero !== h) { var first = S.ui.lastHero == null; S.ui.lastHero = h; var art = $('#l2stage .hero-art'), gl = $('#l2stage .glow'), inf = $('#l2stage .hero-info'); [art, gl, inf].forEach(function (e) { if (e) { e.classList.remove('enter'); void e.offsetWidth; e.classList.add('enter'); } }); }
    patch('l2rail', Heroes.rail(cat, S.ui, v.players, v.you));
    // the one big button
    var taken = owner && owner.id !== v.you, mine = me.cls === h, name = c.name.replace('The ', '').toUpperCase();
    var canStart = me.cls && v.players.every(function (p) { return p.cls && (p.ready || p.host || p.id.indexOf('bot') === 0 || !p.connected); });
    var act;
    if (taken) act = '<button class="cta" disabled>TAKEN BY ' + esc(owner.name.toUpperCase().replace(' (GHOST)', '')) + '</button><p class="hint">Choose another hero.</p>';
    else if (!mine) act = '<button class="cta" data-act="confirmhero">CHOOSE THE ' + esc(name) + '</button><p class="hint">' + (me.cls ? 'You are currently the ' + esc(cat.classes[me.cls].name.replace('The ', '')) + '. Choosing again swaps.' : 'You can change your mind until the expedition sets out.') + '</p>';
    else if (host) act = '<button class="cta go" data-act="start"' + (canStart ? '' : ' disabled') + '>SET OUT</button><p class="hint">' + (canStart ? (v.players.length === 1 ? 'Alone, or add ghost companions under Table.' : 'Everyone is ready.') : 'Waiting for everyone to choose and be ready.') + '</p>';
    else act = '<button class="cta' + (me.ready ? '' : ' go') + '" data-act="ready">' + (me.ready ? 'READY ✓  (tap to undo)' : 'READY') + '</button><p class="hint">Waiting for the host to set out.</p>';
    patch('l2act', act);
  }

  function renderTitle() {
    var app = $('#app'); htmlOf.app = null;
    var solo = Net.savedSolo(), last = Net.lastSeat();
    var html = UI.title({ online: Net.onlineAvailable(), solo: !!solo, last: last });
    if (htmlOf.title === html) return;
    htmlOf.title = html;
    var act = document.activeElement && document.activeElement.id;
    app.innerHTML = html;
    var nm = $('#f-name'); if (nm && !nm.value) nm.value = S.ui.name || '';
    if (act) { var e = document.getElementById(act); if (e) e.focus(); }
  }

  // visible feedback when an item is gained, lost or its equipped state changes
  function markInventory(v) {
    var now = {}; v.me.inv.forEach(function (e) { now[e.id] = { n: e.n, eq: !!e.eq }; });
    var prev = S.ui.prevInv; S.ui.prevInv = now;
    if (!prev || S.ui.invOwner !== v.you) { S.ui.invOwner = v.you; return; }
    Object.keys(now).forEach(function (id) {
      var nm = S.cat.items[id].name, o = prev[id];
      if (!o || now[id].n > o.n) { toast('Acquired: ' + nm, 'good'); AU.sfx('pickup'); flashSlot(id, 'new'); }
      else if (now[id].eq !== o.eq) { toast((now[id].eq ? 'Equipped: ' : 'Put away: ') + nm); flashSlot(id, 'eqd'); }
    });
    Object.keys(prev).forEach(function (id) { if (!now[id] || now[id].n < prev[id].n) toast('Used or lost: ' + S.cat.items[id].name, 'bad'); });
  }
  function flashSlot(id, cls) { var el = $('.slot[data-slot="' + id + '"]'); var hb = $('.hud-b'); if (el) { el.classList.add(cls); setTimeout(function () { el.classList.remove(cls); }, 1500); } if (hb) FX.sparkle($('.hud-b'), 'gold'); }
  function navHtml() {
    var v = S.view, mine = v.game.active === v.you, t = S.ui.tab;
    var bt = function (id, lab, glyph, note) { return '<button role="tab" aria-selected="' + (t === id) + '" data-act="tab" data-t="' + id + '">' + A.glyph(glyph, 22) + '<span>' + lab + '</span>' + (note ? '<i class="dotnote"></i>' : '') + '</button>'; };
    return bt('act', 'Adventure', 'sword', mine && t !== 'act') + bt('map', 'Map', 'maze', false) + bt('you', 'You', 'skull', !!(v.me.offer)) + bt('log', 'Journal', 'book', !!S.ui.newClue);
  }

  function mapSheet() {
    var v = S.view, id = S.ui.sel; if (!id || !v.map.locs[id]) return '';
    var l = S.cat.locations[id], st = v.map.locs[id], a = v.act, me = UI.me();
    var btn = '';
    if (a && v.game.active === v.you && me.loc !== id) {
      var mv = a.moves.find(function (r) { return r.to === id; }), sp = a.sprint.find(function (r) { return r.to === id; });
      if (mv && mv.ok) btn += '<button class="btn small teal" data-act="move" data-mode="step" data-to="' + id + '">Step carefully</button>';
      if (mv && mv.ok && mv.enemy) btn += '<button class="btn small" data-act="move" data-mode="sneak" data-to="' + id + '">Sneak past</button>';
      if (sp) btn += '<button class="btn small" data-act="move" data-mode="sprint" data-to="' + id + '">Sprint</button>';
      if (mv && !mv.ok) btn += '<span class="chip bad">' + esc(mv.why) + '</span>';
    }
    var here = me.loc === id;
    return '<div class="sheet"><div class="row"><b>' + esc(l.name) + '</b><span class="chip ' + (st.v ? 'teal' : '') + '">' + (st.v ? 'visited' : 'unexplored') + '</span>' + (here ? '<span class="chip gold">you are here</span>' : '') + '<button class="btn tiny ghost right" data-act="desel" aria-label="Close">✕</button></div>' + (btn ? '<div class="row wrap" style="margin-top:6px">' + btn + '</div>' : '') + '</div>';
  }

  function renderModal() {
    var m = S.ui.modal, root = $('#modal-root'), html = '';
    if (m) {
      if (m.type === 'settings') html = UI.settingsModal();
      else if (m.type === 'howto') html = UI.howtoModal();
      else if (m.type === 'item') html = UI.itemModal(m.id);
      else if (m.type === 'give') html = UI.giveModal(m.to);
      else if (m.type === 'confirm') html = UI.confirmModal(m.text);
      else if (m.type === 'rest') html = UI.restModal();
      else if (m.type === 'menu') html = UI.menuModal();
      else if (m.type === 'travel') html = g.HollowStory.travelModal();
      else if (m.type === 'targets') html = '<div class="modal" role="dialog" aria-modal="true"><div class="box"><h2>' + esc(m.title) + '</h2><div class="opts">' + m.opts.map(function (o) { return '<button class="btn" data-act="target-pick" data-id="' + esc(o.id) + '">' + esc(o.label) + '</button>'; }).join('') + '<button class="btn ghost" data-act="closemodal">Cancel</button></div></div></div>';
    }
    if (html === '' && !m) { if (htmlOf.modal) { root.innerHTML = ''; htmlOf.modal = ''; } return; }
    if (m && m.type === 'settings' && htmlOf.modal && root.firstChild) return;   // keep sliders stable while dragging
    if (htmlOf.modal === html) return;
    htmlOf.modal = html; root.innerHTML = html;
    var f = root.querySelector('.box button, .box input, .box select'); if (f && !(m && m.type === 'item')) f.focus({ preventScroll: true });
  }
  function openModal(m) { S.ui.modal = m; htmlOf.modal = null; $('#modal-root').innerHTML = ''; renderModal(); }
  function closeModal() { S.ui.modal = null; renderModal(); }

  // ───────────────────────────── log → sound, effects, announcements ─────────────────────────────
  function handleLog(v) {
    var log = v.log || []; if (!log.length) { seen.init = true; return; }
    if (!seen.init) { seen.n = log[log.length - 1].n; seen.init = true; lastActive = v.game ? v.game.active : null; return; }
    var fresh = log.filter(function (e) { return e.n > seen.n; });
    if (!fresh.length) return;
    seen.n = fresh[fresh.length - 1].n;
    var you = v.you, spoke = [];
    fresh.forEach(function (e) {
      var mine = e.p === you, k = e.k, d = e.d || {};
      if (k === 'result' && d.result) {
        var r = d.result;
        if (r.roll) {
          var who = (v.players.find(function (p) { return p.id === r.by; }) || {}).name || (r.finale ? 'The party' : '');
          // only dramatic moments get the full-screen die: criticals, bosses, the finale. Your ordinary rolls reveal inline.
          var big = r.finale || r.roll.tier === 'crit' || r.roll.tier === 'fumble' || (v.enc && v.enc.kind === 'boss');
          if (big && (r.by === you || r.finale)) FX.dice({ roll: r.roll, who: who, label: r.opt, stakes: r.stakes, chips: r.chips, lines: r.lines }, AU.sfx);
          else if (r.by === you) { AU.sfx('dice'); setTimeout(function () { AU.sfx(r.roll.tier === 'ok' ? 'success' : 'fail'); }, 780); }
          else if (big) FX.dice({ roll: r.roll, who: who, label: r.opt, stakes: r.stakes, chips: r.chips, lines: r.lines }, AU.sfx);
          else { var good = r.roll.tier === 'ok'; toast(who + ' — ' + r.opt + ': ' + r.roll.total + ' vs ' + r.roll.dc + ' · ' + (good ? 'success' : 'failure'), good ? 'good' : 'bad'); AU.sfx(good ? 'success' : 'fail'); }
        }
        else AU.sfx(r.tier === 'ok' || r.tier === 'crit' || r.tier === 'auto' ? 'success' : 'fail');
        if (r.chips) r.chips.forEach(function (c) { if (c.k === 'clue') { AU.sfx('clue'); AU.hush(500); } if (c.k === 'item' && c.n > 0) AU.sfx('pickup'); if (c.k === 'ally') AU.sfx('ally'); });
      } else if (k === 'dmg' && mine) {
        if (d.k === 'san') { FX.flash('san'); AU.sfx('sanity'); } else { FX.flash('dmg'); AU.sfx('damage'); }
        FX.floatText($('.me') || $('.sheet'), d.n + (d.k === 'san' ? ' Sanity' : ' Vitality'), d.k === 'san' ? 'viol' : 'bad');
      } else if (k === 'heal' && mine) { FX.flash('heal'); AU.sfx('heal'); FX.floatText($('.me') || $('.sheet'), '+' + d.n, 'good'); }
      else if (k === 'clue') { if (!d.priv || mine) g.HollowCine.play('clue', { title: (S.cat.clues[d.id] || {}).title || 'A discovery', text: e.t.replace(/^.*?(uncovers "[^"]*"\.|discovery: [^—]*—)\s*/, ''), pillar: (S.cat.clues[d.id] || {}).pillar, mine: mine, by: (v.players.find(function (p) { return p.id === e.p; }) || {}).name }); if (S.ui.drawer !== 'right') S.ui.newClue = true; setTimeout(function () { FX.sparkle($('.hud-b:last-of-type') || $('.hud'), 'gold'); }, 50); AU.sfx('clue'); AU.hush(700); toast('Clue: ' + e.t.split('. ')[0].replace(/^.* uncovers /, ''), 'good'); }
      else if (k === 'clock') { if (d.n > 0) { AU.sfx('toll'); var tp = $('.top'); if (tp) { tp.classList.remove('toll'); void tp.offsetWidth; tp.classList.add('toll'); } } }
      else if (k === 'phase') { g.HollowCine.play('phase', { phase: d.phase, name: S.cat.phaseName[d.phase - 1], text: S.cat.phaseText[d.phase - 1] }); }
      else if (k === 'omen') { var oi = e.t.indexOf('. '); g.HollowCine.play('spirit', { title: oi > 0 ? e.t.slice(0, oi) : 'An omen', text: oi > 0 ? e.t.slice(oi + 2) : e.t }); }
      else if (k === 'move') { if (mine) { AU.sfx(d.mode === 'sprint' ? 'sprint' : 'step'); var L = S.cat.locations[e.loc]; if (L && d.from !== e.loc) g.HollowCine.play('arrive', { title: L.name, region: S.cat.regions[L.region].name, color: S.cat.regions[L.region].color, hook: (L.desc.match(/^[^.!?]+[.!?]/) || [''])[0] }); } }
      else if (k === 'enemy') { if (d.k === 'enemy' || d.k === 'spawn' || d.k === 'toll') AU.sfx('enemy'); toast(e.t, 'bad'); }
      else if (k === 'boss') { AU.sfx('boss'); if (d.k === 'bossdown') toast(e.t, 'good'); }
      else if (k === 'fall') { AU.sfx('fall'); FX.flash('dmg'); toast(e.t, 'bad'); }
      else if (k === 'level') { AU.sfx('level'); if (mine) toast(e.t, 'good'); }
      else if (k === 'turn') { if (mine) { AU.sfx('turn'); toast('Your turn.', 'good'); if (S.ui.tab !== 'act' && innerWidth <= 960) S.ui.tab = 'act'; MAP.center(v.me.loc); } }
      else if (k === 'item' && mine) AU.sfx('pickup');
      else if (k === 'ally') { AU.sfx('ally'); toast(e.t, 'good'); }
      else if (k === 'vote') { if (d.k === 'vote') AU.sfx('vote'); }
      else if (k === 'trap') { if (mine) { AU.sfx('trap'); toast(e.t, 'bad'); } }
      else if (k === 'world') { if (d.k === 'route') AU.sfx('lock'); else if (d.k === 'reveal') AU.sfx('door'); else if (d.k === 'corrupt') toast(e.t, 'bad'); else if (d.k === 'gate') toast(e.t, 'good'); }
      else if (k === 'story') { if (d.k === 'revive') AU.sfx('revive'); if (d.k === 'cleanse') toast(e.t, 'good'); if (d.k === 'pillar') { toast(e.t, 'good'); AU.sfx('clue'); } }
      else if (k === 'hint') { toast(e.t, 'good'); AU.sfx('pickup'); }
      else if (k === 'ending') { var o = d.outcome; AU.sfx(o === 'success' ? 'end_success' : o === 'failure' ? 'end_failure' : 'end_partial'); }
      if (k !== 'turn' && k !== 'round' && k !== 'move') spoke.push(e.t);
    });
    if (spoke.length) announce(spoke.slice(-2).join(' '));
  }

  function showPhase(n, text) {
    var b = $('#phase-banner'); if (!b || !n) return;
    var names = ['', 'PHASE I', 'PHASE II', 'PHASE III'];
    b.innerHTML = '<div><h2>' + names[n] + '</h2><h2 style="font-size:1.1em;margin-top:6px">' + esc(S.cat.phaseName[n - 1].toUpperCase()) + '</h2><p>' + esc(S.cat.phaseText[n - 1]) + '</p></div>';
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    setTimeout(function () { b.classList.remove('on'); }, 4200);
  }

  function syncAudio() {
    var v = S.view; if (!v || !S.cat) return;
    if (v.phase === 'lobby') { AU.setRegion('title'); AU.setMood('quiet'); return; }
    if (v.phase === 'ended') { AU.setMood(v.ended.outcome === 'failure' ? 'defeat' : v.ended.outcome === 'unresolved' ? 'quiet' : 'victory'); AU.setLevel(0.1); return; }
    var me = UI.me(); if (!me) return;
    var region = S.cat.locations[me.loc] && S.cat.locations[me.loc].region;
    if (region) AU.setRegion(region);
    AU.setLevel(v.game.clock / v.game.clockMax * 0.8 + (v.game.haunt - 1) * 0.1);
    var enc = v.enc, mood = 'explore';
    if (enc && enc.kind === 'boss') mood = 'boss';
    else if (enc && enc.kind === 'enemy') mood = 'combat';
    else if (v.map.enemies.some(function (e) { return e.loc === me.loc; })) mood = 'danger';
    else if (v.game.haunt === 3 || v.game.clock / v.game.clockMax > 0.75) mood = 'danger';
    if (v.vote) mood = 'quiet';
    AU.setMood(mood);
  }

  // ───────────────────────────── actions ─────────────────────────────
  function send(cmd, then) {
    if (!S.net) return;
    if (cmd.t === 'choose') S.ui.sending = true;
    S.net.send(cmd).then(function (res) {
      S.ui.sending = false;
      if (res && res.error) { toast(res.error, 'bad'); AU.sfx('fail'); }
      if (then) then(res);
    });
  }
  function sendConfirmed(cmd, text) {
    if (text) { pending = cmd; openModal({ type: 'confirm', text: text }); } else send(cmd);
  }

  function nameVal() { var el = $('#f-name'); var n = (el ? el.value : S.ui.name || '').trim().slice(0, 20); S.ui.name = n; try { localStorage.setItem('hollow.name', n); } catch (e) { /* ignore */ } return n || 'Wanderer'; }
  function setErr(t) { S.ui.err = t || ''; htmlOf.title = null; renderTitle(); }

  function startOnline(fn) {
    if (!Net.onlineAvailable()) { setErr('Online expeditions need the hub server (npm start).'); return; }
    var net = Net.createOnline(handlers);
    S.net = net;
    fn(net).then(function (res) {
      if (res.error) { setErr(res.error); net.leave(); S.net = null; return; }
      S.ui.err = '';
    });
  }

  function startSolo(snap) {
    Net.loadEngine().then(function () {
      var name = nameVal();
      S.net = Net.createOffline(handlers, { name: name }, snap ? { snap: snap.snap } : {});
    }).catch(function (e) { setErr('Could not start solo play: ' + e.message); });
  }

  function leave() {
    var solo = S.net && S.net.kind === 'offline';
    if (solo && S.view && S.view.phase === 'playing') { if (S.net.abandon) S.net.abandon(); }
    toTitle();
  }

  var ACTIONS = {
    host: function () { var n = nameVal(); startOnline(function (net) { return net.create({ name: n }); }); },
    join: function () {
      var code = ($('#f-code') ? $('#f-code').value : S.ui.code || '').trim().toUpperCase(); S.ui.code = code;
      if (code.length !== 4) return setErr('Enter the 4-letter expedition code.');
      var n = nameVal(); startOnline(function (net) { return net.join(code, { name: n }); });
    },
    rejoin: function () { var s = Net.lastSeat(); if (!s) return; startOnline(function (net) { return net.resume(s); }); },
    solo: function () { startSolo(null); },
    'solo-continue': function () { var s = Net.savedSolo(); if (s) startSolo(s); },
    hub: function () { if (hub) hub.exit(); else location.href = '../../index.html'; },
    leave: function () { closeModal(); leave(); },
    again: function () { if (S.net && S.net.kind === 'offline') Net.clearSolo(); leave(); },
    howto: function () { openModal({ type: 'howto' }); }, settings: function () { openModal({ type: 'settings' }); }, menu: function () { openModal({ type: 'menu' }); },
    closemodal: closeModal,
    mute: function () { AU.setMuted(!AU.settings().muted); render(); },
    mutebox: function (el) { AU.setMuted(el.checked); render(); },
    capbox: function (el) { AU.setCaptions(el.checked); },
    motion: function (el) { FX.prefs.motion = el.value; FX.save(); FX.apply(); },
    cinebox: function (el) { FX.prefs.cine = el.checked; FX.save(); },
    largebox: function (el) { FX.prefs.large = el.checked; FX.save(); FX.apply(); },
    conbox: function (el) { FX.prefs.contrast = el.checked; FX.save(); FX.apply(); },
    disbox: function (el) { FX.prefs.distort = el.checked; FX.save(); FX.apply(); render(); },
    vol: function (el) { AU.setVolume(el.dataset.bus, el.value / 100); var sp = el.parentNode.querySelector('span'); if (sp) sp.textContent = el.value; },
    copylink: function () {
      var link = location.origin + location.pathname + '?room=' + S.view.code;
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { toast('Invite link copied.', 'good'); }, function () { prompt('Copy this invite link:', link); });
    },
    // lobby
    pick: function (el) { send({ t: 'pick', cls: el.dataset.cls }); AU.sfx('click'); },
    ready: function () { send({ t: 'ready', on: !(UI.me().ready) }); },
    start: function () { send({ t: 'start' }); },
    addbot: function () { send({ t: 'addbot' }); }, kickbot: function (el) { send({ t: 'kickbot', id: el.dataset.id }); },
    setafk: function (el) { send({ t: 'settings', afk: el.value }); }, setturn: function (el) { send({ t: 'settings', turnSec: +el.value }); },
    // layout
    choice: function (el) {
      var enc = S.view.enc; if (!enc || !enc.options) return;
      var o = enc.options.find(function (x) { return x.id === el.dataset.opt; }); if (!o || o.state !== 'ok') return;
      S.ui.focus = null;
      if (o.kind === 'check' || o.kind === 'puzzle' || o.needsTarget) { S.ui.prep = { id: o.id }; htmlOf.adv = null; render(); AU.sfx('click'); return; }
      ACTIONS.choose({ dataset: { opt: o.id, confirm: o.confirm || '' } });
    },
    hot: function (el) {
      var id = el.dataset.opt, sc = $('.scene'), svg = sc && sc.querySelector('.art svg'); AU.sfx('click');
      if (!sc || !svg) return;
      var cw = sc.clientWidth, ch = sc.clientHeight, k = Math.max(cw / 640, ch / 260), vw = cw / k, vh = ch / k, ox = (640 - vw) / 2, oy = (260 - vh) / 2;
      var fx = Math.max(10, Math.min(90, (+el.dataset.x - ox) / vw * 100)), fy = Math.max(10, Math.min(90, (+el.dataset.y - oy) / vh * 100));
      S.ui.focus = id; S.ui.focusAt = { fx: fx.toFixed(1), fy: fy.toFixed(1) };
      sc.style.setProperty('--fx', fx + '%'); sc.style.setProperty('--fy', fy + '%'); sc.classList.add('focus');
      // add the prompt without re-rendering so the camera glide animates
      setTimeout(function () { render(); }, 520);
    },
    hotoff: function () { S.ui.focus = null; var sc = $('.scene'); if (sc) sc.classList.remove('focus'); htmlOf.adv = null; render(); },
    unprep: function () { S.ui.prep = null; htmlOf.adv = null; render(); },
    travel: function () { if (S.view.act) { S.ui.travel = true; htmlOf.adv = null; render(); } AU.sfx('click'); },
    untravel: function () { S.ui.travel = false; htmlOf.adv = null; render(); },
    map: function () { closeModal(); S.ui.map = true; S.ui.tab = innerWidth <= 960 ? 'map' : S.ui.tab; htmlOf.mapsvg = null; MAP.reset(); render(); setTimeout(function () { MAP.fitAll(); }, 60); },
    closemap: function () { S.ui.map = false; if (S.ui.tab === 'map') S.ui.tab = 'act'; S.ui.sel = null; render(); },
    more: function (el) { S.ui.more = !S.ui.more; var d = el.closest('details'); if (d) d.open = S.ui.more; return true; },
    coach: function (el) { var st = el.dataset.s; S.ui.coach = st === 'done' ? 'done' : +st; if (st === 'done') { try { localStorage.setItem('hollow.tut', '1'); } catch (e) { /* ignore */ } } htmlOf.adv = null; render(); },
    hero: function (el) { S.ui.hero = el.dataset.cls; S.ui.heroAlt = false; AU.sfx('hero'); renderLobby(); },
    heroalt: function () { S.ui.heroAlt = !S.ui.heroAlt; renderLobby(); },
    rules: function () { S.ui.rules = !S.ui.rules; htmlOf.l2rules = null; renderLobby(); },
    confirmhero: function () {
      var h = S.ui.hero, st = $('#l2stage'); AU.sfx('confirm');
      if (st) { st.classList.remove('confirm'); void st.offsetWidth; st.classList.add('confirm'); }
      send({ t: 'pick', cls: h });
    },
    drawer: function (el) { var d = el.dataset.d; S.ui.drawer = S.ui.drawer === d ? null : d; if (d === 'right' && S.ui.drawer) S.ui.newClue = false; var gm = $('.game'); if (gm) gm.setAttribute('data-drawer', S.ui.drawer || ''); htmlOf.hud = null; htmlOf.left = null; htmlOf.right = null; render(); AU.sfx('click'); },
    tab: function (el) { S.ui.tab = el.dataset.t; if (S.ui.tab === 'map') setTimeout(function () { MAP.fitAll(); }, 80); var gm = $('.game'); if (gm) gm.setAttribute('data-tab', S.ui.tab); htmlOf.nav = null; render(); },
    jtab: function (el) { S.ui.jtab = el.dataset.t; htmlOf.right = null; render(); },
    zin: function () { MAP.zoomIn(); }, zout: function () { MAP.zoomOut(); }, zme: function () { MAP.center(UI.me().loc); }, zall: function () { MAP.fitAll(); },
    selnode: function (el) { if (MAP.isDragging()) return; var id = el.dataset.loc; S.ui.sel = S.ui.sel === id ? null : id; AU.sfx('click'); htmlOf.stage = null; htmlOf.mapsvg = null; htmlOf.mapsheet = null; render(); },
    desel: function () { S.ui.sel = null; htmlOf.stage = null; htmlOf.mapsvg = null; htmlOf.mapsheet = null; render(); },
    // turn
    interact: function () { send({ t: 'interact' }); }, investigate: function () { send({ t: 'investigate' }); AU.sfx('door'); },
    explore: function () { send({ t: 'explore' }); }, echo: function () { send({ t: 'echo' }); },
    'rest-ui': function () { openModal({ type: 'rest' }); },
    rest: function (el) { closeModal(); send({ t: 'rest', stat: el.dataset.stat }); AU.sfx('heal'); },
    endturn: function () { send({ t: 'endturn' }); }, leaveenc: function () { send({ t: 'leave' }); }, leave_: function () { send({ t: 'leave' }); },
    move: function (el) { var mode = el.dataset.mode; var sc0 = $('.scene'); if (sc0) sc0.classList.add('leaving'); S.ui.focus = null; closeModal(); S.ui.travel = false; send({ t: 'move', mode: mode, to: el.dataset.to }); },
    follow: function (el) { closeModal(); S.ui.travel = false; send({ t: 'move', mode: 'follow', target: el.dataset.to }); },
    unlock: function (el) { closeModal(); S.ui.travel = false; send({ t: 'unlock', edge: el.dataset.edge, way: el.dataset.way }); AU.sfx('lock'); },
    choose: function (el) {
      var enc = S.view.enc; if (!enc) return;
      if (FX.rolling() || S.ui.sending) return;          // never double-roll while the die is on the table
      S.ui.prep = null;
      var cmd = { t: 'choose', enc: enc.id, opt: el.dataset.opt };
      if (el.dataset.val != null && el.dataset.val !== '') cmd.val = el.dataset.val;
      if (el.dataset.target) cmd.target = el.dataset.target;
      sendConfirmed(cmd, el.dataset.confirm);
    },
    accept: function () { send({ t: 'accept' }); }, reroll: function (el) { send({ t: 'reroll', src: el.dataset.src }); },
    askaid: function () { send({ t: 'askaid' }); }, aid: function () { send({ t: 'aid' }); },
    slip: function (el) { send({ t: 'ability', to: el.dataset.to }); },
    ability: function () { send({ t: 'ability' }); },
    brew: function (el) {
      var make = el.dataset.make, here = S.view.players.filter(function (p) { return p.id !== S.view.you && p.status === 'alive' && p.loc === UI.me().loc; });
      if (make === 'clarity' && here.length) { pending = { t: 'ability', make: make }; openModal({ type: 'targets', title: 'Brew for whom?', opts: [{ id: S.view.you, label: 'Myself' }].concat(here.map(function (p) { return { id: p.id, label: p.name }; })), cmd: 'brew' }); }
      else send({ t: 'ability', make: make });
    },
    'ability-medium': function () {
      var here = S.view.players.filter(function (p) { return p.id !== S.view.you && p.status === 'alive' && p.loc === UI.me().loc; });
      if (here.length) { pending = { t: 'ability' }; openModal({ type: 'targets', title: 'Calm whom?', opts: [{ id: S.view.you, label: 'Myself (+1 Sanity)' }].concat(here.map(function (p) { return { id: p.id, label: p.name }; })) }); }
      else send({ t: 'ability' });
    },
    'target-pick': function (el) { var cmd = Object.assign({}, pending, { target: el.dataset.id }); pending = null; closeModal(); send(cmd); },
    rite: function (el) { send({ t: 'ability', mode: el.dataset.mode, curse: el.dataset.curse }); },
    levelup: function (el) { send({ t: 'levelup', pick: el.dataset.pick }); AU.sfx('level'); },
    revealobj: function () { sendConfirmed({ t: 'revealobj' }, 'Reveal your secret purpose to the whole party? You cannot hide it again.'); },
    share: function (el) { send({ t: 'share', clue: el.dataset.clue }); },
    // items
    item: function (el) { openModal({ type: 'item', id: el.dataset.item }); },
    use: function (el) { closeModal(); var cmd = { t: 'use', item: el.dataset.item }; if (el.dataset.target) cmd.target = el.dataset.target; if (el.dataset.curse) cmd.curse = el.dataset.curse; send(cmd); AU.sfx('pickup'); },
    equip: function (el) { closeModal(); send({ t: 'equip', item: el.dataset.item, off: el.dataset.off === '1' }); },
    give: function (el) { closeModal(); send({ t: 'give', item: el.dataset.item, to: el.dataset.to }); },
    givesilver: function (el) { send({ t: 'give', silver: 1, to: el.dataset.to }); },
    giveui: function (el) { openModal({ type: 'give', to: el.dataset.to }); },
    drop: function (el) { closeModal(); send({ t: 'drop', item: el.dataset.item }); },
    pickup: function (el) { send({ t: 'pickup', item: el.dataset.item }); },
    // finale and spirits
    propose: function (el) { sendConfirmed({ t: 'propose', ending: el.dataset.ending }, el.dataset.confirm); },
    vote: function (el) { send({ t: 'vote', yes: el.dataset.yes === '1' }); }, cancelvote: function () { send({ t: 'cancelvote' }); },
    spirit: function (el) { var cmd = { t: 'spirit', kind: el.dataset.kind }; if (el.dataset.target) cmd.target = el.dataset.target; send(cmd); },
    'confirm-yes': function () { var c = pending; pending = null; closeModal(); if (c) send(c); }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
    var fn = ACTIONS[el.dataset.act]; if (!fn) return;
    if (el.disabled) return;
    if (el.classList.contains('modal')) return;
    fn(el); e.preventDefault();
  });
  document.addEventListener('change', function (e) { var el = e.target.closest('[data-act]'); if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT') && el.type !== 'range' && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el); });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.bind) { S.ui[el.dataset.bind] = el.dataset.bind === 'code' ? el.value.toUpperCase().slice(0, 4) : el.value; if (el.dataset.bind === 'code') el.value = S.ui.code; }
    if (el.dataset && el.dataset.act === 'vol') ACTIONS.vol(el);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (S.ui.modal) closeModal(); else if (S.ui.map) ACTIONS.closemap(); else if (S.ui.drawer) ACTIONS.drawer({ dataset: { d: S.ui.drawer } }); else if (S.ui.sel) ACTIONS.desel(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.node[data-act]')) { e.preventDefault(); ACTIONS.selnode(e.target); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.hs[data-act]')) { e.preventDefault(); ACTIONS.hot(e.target); }
    if (e.key === 'Enter' && e.target.id === 'f-code') ACTIONS.join();
  });
  document.addEventListener('submit', function (e) { e.preventDefault(); });

  // gentle parallax: the scene's layers drift a few pixels against the pointer
  var pxT = 0;
  document.addEventListener('pointerover', function (e) { var h = e.target.closest && e.target.closest('.hs.ok'); if (h && h !== lastHs) AU.sfx('hover'); lastHs = h || null; }, { passive: true });
  var lastHs = null;
  document.addEventListener('pointermove', function (e) {
    if (pxT || FX.reduced() || e.pointerType === 'touch') return;
    pxT = requestAnimationFrame(function () { pxT = 0; var sc = $('.scene'); if (!sc) return; sc.style.setProperty('--px', (e.clientX / innerWidth * 2 - 1).toFixed(2)); sc.style.setProperty('--py', (e.clientY / innerHeight * 2 - 1).toFixed(2)); });
  }, { passive: true });

  // ───────────────────────────── start ─────────────────────────────
  var saved = Net.savedSeat();
  render();
  if (saved && Net.onlineAvailable()) {
    var net0 = Net.createOnline(handlers); S.net = net0;
    net0.resume(saved).then(function (res) { if (res.error) { S.net = null; try { net0.leave(); } catch (e) { /* closed */ } Net.clearSeat(); render(); } });
  }
  g.HollowApp = { state: S, actions: ACTIONS };   // handy for debugging in the console
})(window);
