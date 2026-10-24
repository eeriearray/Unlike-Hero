/* THE HOLLOW — the client. It renders what the server sends and sends back what the player chooses.
 * It never decides a roll, a reward or a rule. This file: screens, input, and the bridge from game events
 * (the shared log) to sound, effects and announcements. */
(function (g) {
  'use strict';
  var A = g.HollowArt, AU = g.HollowAudio, FX = g.HollowFx, Net = g.HollowNet, UI = g.HollowUI, MAP = g.HollowMap, Story = g.HollowStory, Heroes = g.HollowHeroes, St = g.HollowStage, EV = g.HollowEvents, S = UI.S;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = A.esc;
  var hub = null;
  var pending = null;            // a confirmed action waiting for "Yes"
  var seen = { n: 0, init: false };
  var htmlOf = {};               // last html per region, so unchanged regions are not touched
  var started = false, reported = false, lastActive = null, lastRegion = null, lastEncId = null;
  UI.setAudio(AU);
  EV.onBeat = function () { if (S.view && S.view.phase === 'playing' && $('#hdr')) patch('hdr', Story.bar()); };
  EV.onIdle = function () { if (S.view) render(); };

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
  var spentTurn = null, spentSince = 0;
  function timerTick() {
    var v = S.view;
    var key = v && v.game && (v.cosmetics && v.cosmetics.runId || v.code) + ':' + v.game.round + ':' + v.game.active;
    var blocked = S.ui.sending || FX.rolling() || S.ui.icard || S.ui.prep || S.ui.travel || S.ui.modal || S.ui.map || S.ui.drawer || document.hidden || document.querySelector('.modal, dialog[open], .chapter-tip') || (g.HollowEvents && g.HollowEvents.busy()) || (g.HollowCine && g.HollowCine.busy && g.HollowCine.busy());
    var ready = g.HollowGuidance && g.HollowGuidance.canAdvance(v, blocked);

    if (!ready) { spentSince = 0; }
    else if (spentTurn !== key) {
      if (!spentSince) spentSince = Date.now();
      if (Date.now() - spentSince >= 1800) { spentTurn = key; spentSince = 0; send({ t: 'endturn', auto: true }); }
    }

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
      if (v.phase !== 'lobby' && !started) { started = true; reported = false; S.ui.fieldLetterPending = v.phase === 'playing' && v.game.round <= 1; if (hub) hub.report('session-start', { game: 'the-hollow' }); }
      if (v.phase === 'lobby') { started = false; seen.init = false; }
      handleLog(v);
      render();
      autoOpen();
      if (g.HollowDread) g.HollowDread.sync(v);
      if (S.ui.fieldLetterPending && v.phase === 'playing' && S.cat) {
        S.ui.fieldLetterPending = false;
        var introRun = v.cosmetics && v.cosmetics.runId;
        var readLetter = function () { if (S.view && S.view.phase === 'playing' && (!introRun || S.view.cosmetics.runId === introRun)) openModal({ type: 'fieldletter' }); };
        if (!g.HollowDread || !g.HollowDread.open(v, readLetter)) readLetter();
      }
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
    if (g.HollowDread) g.HollowDread.cancel();
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
    if (!(EV.busy() && htmlOf.hdr)) patch('hdr', Story.bar());   // during a scene event the HUD follows its beats
    if (v.me && v.me.status !== undefined) {
      if (S.ui.coach == null) S.ui.coach = (function () { try { return localStorage.getItem('hollow.tut') ? 'done' : (v.game.round <= 1 ? 0 : 'done'); } catch (e) { return 0; } })();
      if (S.ui.coach === 1 && v.enc && v.enc.result) S.ui.coach = 2;
      if (S.ui.travel && (v.game.active !== v.you || !v.act)) S.ui.travel = false;
      if (S.ui.prep && (!v.enc || v.game.active !== v.you || v.enc.hold)) S.ui.prep = null;
      patch('left', UI.left());
      patch('right', UI.right());
      St.mount($('#stagehost'));
      if (S.ui.icardLoc && S.ui.icardLoc !== v.me.loc) { S.ui.icard = null; S.ui.icardLoc = null; }
      if (S.ui.icard && (v.game.active !== v.you || (v.enc && v.enc.hold))) { S.ui.icard = null; if (!EV.busy()) St.unfocus(); }
      St.sync(v);
      if (S.ui.icard && S.ui.icard.waiting && v.enc && v.enc.options) { S.ui.icard.waiting = false; }
      patch('advui', Story.adventure());
      var capKey = ($('#advui .cap') || {}).textContent || '';
      if (S.ui.capKey !== capKey) { S.ui.capKey = capKey; var cp = $('#advui .cap'); if (cp) { cp.classList.add('beat'); setTimeout(function () { cp.classList.remove('beat'); }, 1000); } }
      if (S.ui.map || S.ui.tab === 'map') {
        MAP.ensureFit(v.me.loc); MAP.ensureVisible(v.me.loc);
        var mh = MAP.render();
        if (!MAP.isDragging()) patch($('#mapsvg'), mh);
        patch('mapsheet', mapSheet());
      }
      patch('nav', navHtml());
      var gm = $('.game2'); if (gm) { gm.setAttribute('data-drawer', S.ui.drawer || ''); gm.setAttribute('data-map', S.ui.map ? 'open' : ''); gm.setAttribute('data-tab', S.ui.tab); gm.setAttribute('data-phase', v.game.haunt); gm.style.setProperty('--ph', v.game.haunt); }
      markInventory(v);
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
    app.innerHTML = '<div class="game2" data-tab="' + S.ui.tab + '" data-drawer="" data-map=""><div id="hdr" class="hdrwrap"></div><main class="adv" id="adv" aria-label="The adventure"><div id="stagehost" class="stg"></div><div id="advui" class="advui" aria-live="polite"></div></main><section class="mapview" id="mapview" aria-label="Map of the Hollow"><div class="mapwrap"><div id="mapsvg"></div><div class="mapctl"><button class="btn" data-act="closemap" aria-label="Close the map">✕</button><button class="btn" data-act="zin" aria-label="Zoom in">+</button><button class="btn" data-act="zout" aria-label="Zoom out">−</button><button class="btn" data-act="zme" aria-label="Centre on me">' + A.glyph('circle', 18) + '</button><button class="btn" data-act="zall" aria-label="Show everything discovered">' + A.glyph('maze', 18) + '</button></div><div class="maplegend"><span class="l here">you</span><span class="l go">you can go</span><span class="l danger">danger</span><span class="l seen">visited</span><span class="l new">unexplored</span></div><div id="maptip" class="maptip" role="tooltip"></div><div id="mapsheet" class="mapsheet"></div></div></section><aside class="drawer dleft" id="left" aria-label="Your character"></aside><aside class="drawer dright" id="right" aria-label="The journal"></aside><nav class="nav" id="nav" aria-label="Sections"></nav></div>';
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
    if (v.game.ap < 1 || v.game.active !== v.you || v.enc || !v.act || !v.act.interact.ok) return;
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
    if (host) rules = '<label class="opening-mode"><input type="checkbox" data-act="experience"' + (S.ui.experienced ? ' checked' : '') + '> Experienced players: start with the full expedition</label>';
    if (host && S.ui.rules) rules += '<div class="l2rules"><div class="field"><label for="f-afk">If a player goes quiet</label><select id="f-afk" data-act="setafk"><option value="skip"' + (st.afk === 'skip' ? ' selected' : '') + '>Skip their turns</option><option value="ai"' + (st.afk === 'ai' ? ' selected' : '') + '>A ghost-hand plays for them</option><option value="wait"' + (st.afk === 'wait' ? ' selected' : '') + '>Wait up to 5 minutes</option></select></div><div class="field"><label for="f-turn">Turn timer</label><select id="f-turn" data-act="setturn">' + [60, 90, 150, 240, 420].map(function (x) { return '<option value="' + x + '"' + (st.turnSec === x ? ' selected' : '') + '>' + (x < 120 ? x + ' s' : x / 60 + ' min') + '</option>'; }).join('') + '</select></div><button class="btn small" data-act="addbot"' + (v.players.length >= 6 ? ' disabled' : '') + '>+ Ghost companion</button>' + v.players.filter(function (p) { return p.id.indexOf('bot') === 0; }).map(function (p) { return '<button class="btn tiny" data-act="kickbot" data-id="' + esc(p.id) + '">Dismiss ' + esc(p.name.replace(' (ghost)', '')) + '</button>'; }).join('') + '</div>';
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
      if (!o || now[id].n > o.n) { if (!EV.busy() && !S.ui.evItem) EV.gain(id); flashSlot(id, 'new'); }
      else if (now[id].eq !== o.eq) { toast((now[id].eq ? 'Equipped: ' : 'Put away: ') + nm); flashSlot(id, 'eqd'); }
    });
    Object.keys(prev).forEach(function (id) { if (!now[id] || now[id].n < prev[id].n) EV.after(function () { toast('Used or lost: ' + S.cat.items[id].name, 'bad'); }); });
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
      else if (m.type === 'fieldletter') html = UI.fieldLetterModal(S.view);
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
    var you = v.you, spoke = [], here = v.me && v.me.loc;
    var nameOf = function (id) { return ((v.players.find(function (p) { return p.id === id; }) || {}).name || '').replace(' (ghost)', ''); };
    // Results at my place are shown in the scene (js/events.js). Their chips already carry the clue, the item, the
    // Sanity lost and the Haunting's advance, so the separate log lines for those are not shown a second time.
    var shown = fresh.filter(function (e) { return e.k === 'result' && e.d && e.d.result && !e.d.result.finale && (e.loc || e.d.result.loc) === here && v.phase === 'playing'; });
    var covered = { clue: {}, hint: false, clock: false, dmg: {}, heal: {} };
    shown.forEach(function (e) { (e.d.result.chips || []).forEach(function (c) { if (c.k === 'clue') covered.clue[c.label.replace(/^Clue: /, '')] = true; if (c.k === 'hint') covered.hint = true; if (c.k === 'clock') covered.clock = true; if ((c.k === 'san' || c.k === 'vit') && e.d.result.by === you) covered[c.n < 0 ? 'dmg' : 'heal'][c.k] = true; }); });
    var deferred = shown.length > 0;
    var post = [], later = function (fn) { if (deferred) post.push(fn); else fn(); };
    fresh.forEach(function (e) {
      var mine = e.p === you, k = e.k, d = e.d || {};
      if (k === 'result' && d.result) {
        var r = d.result;
        if (shown.indexOf(e) >= 0) EV.play(r, { mine: r.by === you, who: nameOf(r.by) });
        else if (r.finale) FX.dice({ roll: r.roll, who: nameOf(r.by) || 'The party', label: r.opt, stakes: r.stakes, chips: r.chips, lines: r.lines }, AU.sfx);
        else if (r.roll) { var good = r.roll.tier === 'ok' || r.roll.tier === 'crit'; later(function () { toast(nameOf(r.by) + ' — ' + r.opt + ': ' + (good ? 'success' : 'failure'), good ? 'good' : 'bad'); AU.sfx(good ? 'success' : 'fail'); }); }
      } else if (k === 'roll' && d.hold && (e.loc === here || mine)) { EV.holdRoll(d.roll, d.oid, d.opt, { mine: mine, who: nameOf(e.p) }); }
      else if (k === 'dmg' && mine) {
        if (covered.dmg[d.k]) { covered.dmg[d.k] = false; }
        else later(function () { if (d.k === 'san') { St.flash('fx-san', 1400); AU.sfx('sanity'); } else { St.flash('fx-hurt', 900); AU.sfx('damage'); } FX.floatText($('#hud-me'), d.n + (d.k === 'san' ? ' Sanity' : ' Vitality'), d.k === 'san' ? 'viol' : 'bad'); });
      } else if (k === 'heal' && mine) { if (covered.heal[d.k]) covered.heal[d.k] = false; else later(function () { St.flash('fx-heal', 1000); AU.sfx('heal'); FX.floatText($('#hud-me'), '+' + d.n, 'good'); }); }
      else if (k === 'clue') {
        var ct = (S.cat.clues[d.id] || {}).title;
        if (S.ui.drawer !== 'right') S.ui.newClue = true;
        if (!covered.clue[ct] && (!d.priv || mine)) later(function () { g.HollowCine.play('clue', { title: ct || 'A discovery', text: e.t.replace(/^.*?(uncovers "[^"]*"\.|discovery: [^—]*—)\s*/, ''), pillar: (S.cat.clues[d.id] || {}).pillar, mine: mine, by: nameOf(e.p) }); });
      }
      else if (k === 'clock') { if (d.n > 0 && !covered.clock) later(function () { AU.sfx('toll'); var hc = $('#hud-clock'); if (hc) { hc.classList.remove('toll'); void hc.offsetWidth; hc.classList.add('toll'); } }); }
      else if (k === 'phase') { later(function () { g.HollowCine.play('phase', { phase: d.phase, name: S.cat.phaseName[d.phase - 1], text: S.cat.phaseText[d.phase - 1] }); }); }
      else if (k === 'omen') { var oi = e.t.indexOf('. '); later(function () { g.HollowCine.play('spirit', { title: oi > 0 ? e.t.slice(0, oi) : 'An omen', text: oi > 0 ? e.t.slice(oi + 2) : e.t }); }); }
      else if (k === 'move') { if (mine) { AU.sfx(d.mode === 'sprint' ? 'sprint' : 'step'); var L = S.cat.locations[e.loc]; if (L && d.from !== e.loc) later(function () { g.HollowCine.play('arrive', { title: L.name, region: S.cat.regions[L.region].name, color: S.cat.regions[L.region].color, hook: (L.desc.match(/^[^.!?]+[.!?]/) || [''])[0] }); }); } }
      else if (k === 'enemy') { later(function () { if (d.k === 'enemy' || d.k === 'spawn' || d.k === 'toll') AU.sfx('enemy'); toast(e.t, 'bad'); }); }
      else if (k === 'boss') { later(function () { AU.sfx('boss'); if (d.k === 'bossdown') toast(e.t, 'good'); }); }
      else if (k === 'fall') { later(function () { AU.sfx('fall'); St.flash('fx-hurt', 1200); toast(e.t, 'bad'); }); }
      else if (k === 'level') { later(function () { AU.sfx('level'); if (mine) toast(e.t, 'good'); }); }
      else if (k === 'turn') { var tp = v.players.find(function (p) { return p.id === e.p; }); if (tp && v.players.length > 1) EV.turn(tp, tp.cls, mine); if (mine) { later(function () { AU.sfx('turn'); }); if (S.ui.tab !== 'act' && innerWidth <= 960) S.ui.tab = 'act'; MAP.center(v.me.loc); } }
      else if (k === 'ally') { later(function () { AU.sfx('ally'); toast(e.t, 'good'); }); }
      else if (k === 'vote') { if (d.k === 'vote') AU.sfx('vote'); }
      else if (k === 'trap') { if (mine) later(function () { AU.sfx('trap'); St.flash('fx-hurt', 900); toast(e.t, 'bad'); }); }
      else if (k === 'world') { if (d.k === 'route') AU.sfx('lock'); else if (d.k === 'reveal') AU.sfx('door'); else if (d.k === 'corrupt') later(function () { toast(e.t, 'bad'); }); else if (d.k === 'gate') later(function () { toast(e.t, 'good'); }); else if (d.k === 'investigate' && mine) later(function () { toast(e.t.replace(/^[^.]*\.\s*/, '') || 'Nothing hidden here.', ''); }); }
      else if (k === 'story') { if (d.k === 'revive') AU.sfx('revive'); if (d.k === 'cleanse') later(function () { toast(e.t, 'good'); }); if (d.k === 'pillar') later(function () { toast(e.t, 'good'); AU.sfx('clue'); }); }
      else if (k === 'hint') { if (!covered.hint) later(function () { toast(e.t, 'good'); AU.sfx('pickup'); }); }
      else if (k === 'ending') { var o = d.outcome; AU.sfx(o === 'success' ? 'end_success' : o === 'failure' ? 'end_failure' : 'end_partial'); }
      if (k !== 'turn' && k !== 'round' && k !== 'move') spoke.push(e.t);
    });
    post.forEach(function (fn) { EV.after(fn); });     // after the scene has shown what happened
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
    AU.setPlace(me.loc);
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

  // ───────────── the object card and what it can do ─────────────
  function openCard(ic) {
    S.ui.icard = ic; S.ui.icardLoc = S.view.me.loc;
    if (ic.obj) St.focus(ic.obj);
    htmlOf.advui = null;
    setTimeout(function () { render(); var first = document.querySelector('.icard [data-act="choose"], .icard button'); if (first) first.focus({ preventScroll: true }); }, FX.reduced() ? 0 : 380);   // let the camera arrive first
  }
  function closeCard(keepCam) { var had = !!S.ui.icard; S.ui.icard = null; S.ui.prep = null; if (!keepCam && !EV.busy()) St.unfocus(); if (had) { htmlOf.advui = null; render(); } }
  // choosing an option: risky ones show their odds first (in the card), safe ones happen at once
  function pickOption(id, obj) {
    var v = S.view, enc = v.enc, o = enc && enc.options ? enc.options.find(function (x) { return x.id === id; }) : null;
    if (!o) {
      // the place's encounter is closed (it is free to open): open it, then come back to this option
      if (!enc && v.act && v.act.interact.ok) { send({ t: 'interact' }); openCard({ obj: obj, opt: id, waiting: true }); }
      return;
    }
    if (o.state !== 'ok') { toast(o.why || 'Not now.'); return; }
    AU.sfx('click');
    if (o.kind === 'check' || o.kind === 'puzzle' || o.needsTarget) { openCard({ obj: obj, opt: id }); return; }
    if (obj) St.focus(obj);
    S.ui.icard = null; htmlOf.advui = null;
    ACTIONS.choose({ dataset: { opt: o.id, confirm: o.confirm || '' } });
  }
  // searching a place is a standing action; the place's encounter (free to open) is closed first and reopened after
  function search(obj) {
    var v = S.view, enc = v.enc, seq = [];
    if (enc && enc.kind === 'loc' && !enc.hold) seq.push({ t: 'leave' });
    seq.push({ t: 'investigate' });
    closeCard(true);
    if (obj) EV.intent(obj, 'search');
    AU.sfx('paper');
    var step = function (i) { if (i >= seq.length) { if (S.view && !S.view.enc && S.view.act && S.view.act.interact.ok) send({ t: 'interact' }); setTimeout(function () { if (!EV.busy()) St.unfocus(); }, 1400); return; } S.net.send(seq[i]).then(function (res) { if (res && res.error) { toast(res.error, 'bad'); St.unfocus(); return; } step(i + 1); }); };
    step(0);
  }

  var ACTIONS = {
    host: function () {
      var n = nameVal();
      var proceed = function () { startOnline(function (net) { return net.create({ name: n }); }); };
      if (g.HollowTrailer) g.HollowTrailer.open({ autoplay: true, after: proceed });
      else proceed();
    },
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
    fieldletter: function () { openModal({ type: 'fieldletter' }); },
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
    start: function () { send({ t: 'start', opening: S.ui.experienced !== true }); },
    experience: function (el) { S.ui.experienced = el.checked; },
    addbot: function () { send({ t: 'addbot' }); }, kickbot: function (el) { send({ t: 'kickbot', id: el.dataset.id }); },
    setafk: function (el) { send({ t: 'settings', afk: el.value }); }, setturn: function (el) { send({ t: 'settings', turnSec: +el.value }); },
    // layout
    choice: function (el) { ACTIONS.card({ dataset: { k: 'opt', v: el.dataset.opt } }); },
    // touching an object in the scene: the camera finds it and its card opens
    obj: function (el) {
      var id = el.getAttribute('data-obj'); if (!id || EV.busy()) return;
      var av = St.avail(id, S.view);
      if (av.acts.length === 1 && av.acts[0].k === 'act' && av.acts[0].id === 'travel' && av.acts[0].ok) { AU.sfx('step'); St.focus(id); setTimeout(function () { St.unfocus(); ACTIONS.travel(); }, 420); return; }
      var detail = St.defFor() && St.defFor().objects[id], rect = St.rectOf(id);
      AU.sfx(detail && detail.sfx || 'zoom', { pan: rect ? Math.max(-.7, Math.min(.7, ((rect.left + rect.width / 2) / innerWidth - .5) * 1.4)) : 0 }); S.ui.more = false; S.ui.soundpop = false;
      openCard({ obj: id });
    },
    // a choice inside the object's card
    icopt: function (el) {
      if (el.getAttribute('aria-disabled') === 'true' || EV.busy()) return;
      var k = el.dataset.k, id = el.dataset.v, ic = S.ui.icard || {};
      if (k === 'opt') return pickOption(id, ic.obj);
      if (id === 'investigate') return search(ic.obj);
      if (id === 'travel') { closeCard(); ACTIONS.travel(); return; }
      if (k === 'move') { closeCard(true); EV.intent(ic.obj, 'act'); send({ t: 'move', mode: 'step', to: id }); }
    },
    scenepan: function (el) { closeCard(); St.pan(el.dataset.dir); },
    detailzoom: function () { if (!S.ui.icard) return; S.ui.icard.magnify = !S.ui.icard.magnify; AU.sfx('paper', { gain: .08 }); htmlOf.advui = null; render(); },
    icclose: function () { closeCard(); },
    // an action card in the tray
    card: function (el) {
      if (el.getAttribute && el.getAttribute('aria-disabled') === 'true') { var t = el.getAttribute('title'); if (t) toast(t); return; }
      if (EV.busy()) return;
      var k = el.dataset.k, id = el.dataset.v; S.ui.more = false;
      if (k === 'opt') { var obj = St.objectFor(id); return pickOption(id, obj); }
      if (id === 'investigate') return search(St.objectFor('investigate'));
      if (id === 'travel') return ACTIONS.travel();
      if (ACTIONS[id]) { closeCard(); return ACTIONS[id](el); }
    },
    morecards: function () { S.ui.more = !S.ui.more; htmlOf.advui = null; render(); AU.sfx('click'); },
    soundpop: function () { S.ui.soundpop = !S.ui.soundpop; htmlOf.hdr = null; render(); },
    unprep: function () { S.ui.prep = null; if (S.ui.icard && S.ui.icard.obj) { S.ui.icard.opt = null; } else closeCard(); htmlOf.advui = null; render(); },
    travel: function () { closeCard(); if (S.view.act) { S.ui.travel = true; htmlOf.advui = null; render(); } AU.sfx('click'); },
    untravel: function () { S.ui.travel = false; htmlOf.advui = null; render(); },
    map: function () { closeModal(); S.ui.map = true; S.ui.tab = innerWidth <= 960 ? 'map' : S.ui.tab; htmlOf.mapsvg = null; MAP.reset(); render(); setTimeout(function () { MAP.fitAll(); }, 60); },
    closemap: function () { S.ui.map = false; if (S.ui.tab === 'map') S.ui.tab = 'act'; S.ui.sel = null; render(); },
    more: function (el) { S.ui.more = !S.ui.more; var d = el.closest('details'); if (d) d.open = S.ui.more; return true; },
    coach: function (el) { var st = el.dataset.s; S.ui.coach = st === 'done' ? 'done' : +st; if (st === 'done') { try { localStorage.setItem('hollow.tut', '1'); } catch (e) { /* ignore */ } } htmlOf.advui = null; render(); },
    hero: function (el) { S.ui.hero = el.dataset.cls; S.ui.heroAlt = false; AU.sfx('hero'); renderLobby(); },
    heroalt: function () { S.ui.heroAlt = !S.ui.heroAlt; renderLobby(); },
    rules: function () { S.ui.rules = !S.ui.rules; htmlOf.l2rules = null; renderLobby(); },
    confirmhero: function () {
      var h = S.ui.hero, st = $('#l2stage'); AU.sfx('confirm');
      if (st) { st.classList.remove('confirm'); void st.offsetWidth; st.classList.add('confirm'); }
      send({ t: 'pick', cls: h });
    },
    drawer: function (el) {
      var d = el.dataset.d; S.ui.drawer = S.ui.drawer === d ? null : d;
      if (d === 'right' && S.ui.drawer) S.ui.newClue = false;
      // Narrow layouts use full panels, not off-screen desktop drawers.
      if (window.innerWidth <= 960) S.ui.tab = S.ui.drawer ? (d === 'left' ? 'you' : 'log') : 'act';
      htmlOf.hud = null; htmlOf.left = null; htmlOf.right = null; render(); AU.sfx('click');
    },
    tab: function (el) { S.ui.tab = el.dataset.t; S.ui.drawer = S.ui.tab === 'you' ? 'left' : S.ui.tab === 'log' ? 'right' : null; if (S.ui.tab === 'map') setTimeout(function () { MAP.fitAll(); }, 80); var gm = $('.game'); if (gm) gm.setAttribute('data-tab', S.ui.tab); htmlOf.nav = null; render(); },
    jtab: function (el) { S.ui.jtab = el.dataset.t; htmlOf.right = null; render(); },
    zin: function () { MAP.zoomIn(); }, zout: function () { MAP.zoomOut(); }, zme: function () { MAP.center(UI.me().loc); }, zall: function () { MAP.fitAll(); },
    selnode: function (el) { if (MAP.isDragging()) return; var id = el.dataset.loc; S.ui.sel = S.ui.sel === id ? null : id; AU.sfx('click'); htmlOf.stage = null; htmlOf.mapsvg = null; htmlOf.mapsheet = null; render(); },
    desel: function () { S.ui.sel = null; htmlOf.stage = null; htmlOf.mapsvg = null; htmlOf.mapsheet = null; render(); },
    // turn
    interact: function () { send({ t: 'interact' }); }, investigate: function () { search(St.objectFor('investigate')); },
    explore: function () { send({ t: 'explore' }); }, echo: function () { send({ t: 'echo' }); },
    'rest-ui': function () { openModal({ type: 'rest' }); },
    rest: function (el) { closeModal(); send({ t: 'rest', stat: el.dataset.stat }); AU.sfx('heal'); },
    endturn: function () { send({ t: 'endturn' }); }, leaveenc: function () { send({ t: 'leave' }); }, leave_: function () { send({ t: 'leave' }); },
    move: function (el) { var mode = el.dataset.mode; var sc0 = $('#stagehost'); if (sc0) sc0.classList.add('leaving'); setTimeout(function () { if (sc0) sc0.classList.remove('leaving'); }, 900); closeCard(true); closeModal(); S.ui.travel = false; send({ t: 'move', mode: mode, to: el.dataset.to }); },
    follow: function (el) { closeModal(); S.ui.travel = false; send({ t: 'move', mode: 'follow', target: el.dataset.to }); },
    unlock: function (el) { closeModal(); S.ui.travel = false; send({ t: 'unlock', edge: el.dataset.edge, way: el.dataset.way }); AU.sfx('lock'); },
    choose: function (el) {
      var enc = S.view.enc; if (!enc) return;
      if (FX.rolling() || S.ui.sending || EV.busy()) return;          // never double-roll while the die is on the table
      S.ui.prep = null; S.ui.icard = null; htmlOf.advui = null;
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
    if (e.key === 'Escape') { if (S.ui.icard) { closeCard(); return; } if (S.ui.modal) closeModal(); else if (S.ui.map) ACTIONS.closemap(); else if (S.ui.drawer) ACTIONS.drawer({ dataset: { d: S.ui.drawer } }); else if (S.ui.sel) ACTIONS.desel(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.node[data-act]')) { e.preventDefault(); ACTIONS.selnode(e.target); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.obj[data-act]')) { e.preventDefault(); ACTIONS.obj(e.target); }
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
