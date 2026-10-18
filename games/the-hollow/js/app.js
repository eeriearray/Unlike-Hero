/* THE HOLLOW — the client. It renders what the server sends and sends back what the player chooses.
 * It never decides a roll, a reward or a rule. This file: screens, input, and the bridge from game events
 * (the shared log) to sound, effects and announcements. */
(function (g) {
  'use strict';
  var A = g.HollowArt, AU = g.HollowAudio, FX = g.HollowFx, Net = g.HollowNet, UI = g.HollowUI, MAP = g.HollowMap, S = UI.S;
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
      if (v.phase !== 'lobby' && !started) { started = true; reported = false; if (hub) hub.report('session-start', { game: 'the-hollow' }); }
      if (v.phase === 'lobby') { started = false; seen.init = false; }
      handleLog(v);
      render();
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
    if (v.phase === 'lobby') { setScreen('lobby'); htmlOf.app = null; patch(app, UI.lobby()); return; }
    setScreen('game');
    ensureGameShell();
    var g2 = $('.game', app);
    patch('hdr', UI.header());
    if (v.me && v.me.status !== undefined) {
      patch('left', UI.left());
      patch('right', UI.right());
      var mapEl = $('#mapsvg');
      MAP.ensureFit(v.me.loc);
      MAP.ensureVisible(v.me.loc);
      var mh = MAP.render();
      if (!MAP.isDragging()) patch(mapEl, mh);
      patch('mapsheet', mapSheet());
      var sk = (v.me.loc || '') + '|' + (v.enc ? v.enc.id : '');
      patch('stage', UI.stage());
      if (S.ui.sceneKey !== sk) { S.ui.sceneKey = sk; var bn = $('#stage .banner'); if (bn) { bn.classList.add('enter'); setTimeout(function () { bn.classList.remove('enter'); }, 1100); } var st0 = $('#stage'); if (st0) st0.scrollTop = 0; }
      // new story beats fade in once (not on every refresh)
      var beatKey = [].map.call(document.querySelectorAll('#stage .narr, #stage .result'), function (e) { return e.textContent.slice(0, 60); }).join('|');
      if (S.ui.beatKey !== beatKey) { var prevB = (S.ui.beatKey || '').split('|'); S.ui.beatKey = beatKey; document.querySelectorAll('#stage .narr, #stage .result').forEach(function (e) { if (prevB.indexOf(e.textContent.slice(0, 60)) < 0) { e.classList.add('beat'); setTimeout(function () { e.classList.remove('beat'); }, 1000); } }); }
      patch('hud', UI.hud());
      patch('nav', navHtml());
      var gm = $('.game'); if (gm) { gm.setAttribute('data-drawer', S.ui.drawer || ''); gm.setAttribute('data-phase', v.game.haunt); }
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
    if ($('.game', app)) return;
    htmlOf = {};
    app.innerHTML = '<div class="game" data-tab="' + S.ui.tab + '" data-drawer="' + (S.ui.drawer || '') + '"><div id="hdr" class="hdrwrap"></div><section class="mapcol"><div class="mapwrap"><div id="mapsvg"></div><div class="mapctl"><button class="btn" data-act="zin" aria-label="Zoom in">+</button><button class="btn" data-act="zout" aria-label="Zoom out">−</button><button class="btn" data-act="zme" aria-label="Centre on me" title="Centre on me">' + A.glyph('circle', 18) + '</button><button class="btn" data-act="zall" aria-label="Show everything discovered" title="Show all">' + A.glyph('maze', 18) + '</button></div><div class="maplegend"><span><i style="border-color:#8a93ab"></i>road</span><span><i style="border-color:#9a82e0;border-top-style:dashed"></i>hidden</span><span><i style="border-color:#c9a35b;border-top-style:dotted"></i>locked</span><span><i style="border-color:#b24a52;border-top-style:dotted"></i>blocked</span><span><i style="border-color:#7ccfc3;border-top-style:dashed"></i>you can go</span></div><div id="maptip" class="maptip" role="tooltip"></div><div id="mapsheet" class="mapsheet"></div><div id="hud" class="hudwrap"></div></div></section><main class="stage" id="stage" aria-live="polite" aria-label="The encounter"></main><aside class="drawer dleft" id="left" aria-label="Your character"></aside><aside class="drawer dright" id="right" aria-label="The expedition"></aside><nav class="nav" id="nav" aria-label="Sections"></nav></div>';
    MAP.attach($('.mapwrap'));
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
    var v = S.view, mine = v.game.active === v.you;
    var t = S.ui.tab;
    var b = function (id, lab, glyph, note) { return '<button role="tab" aria-selected="' + (t === id) + '" data-act="tab" data-t="' + id + '">' + A.glyph(glyph, 22) + '<span>' + lab + '</span>' + (note ? '<i class="dotnote"></i>' : '') + '</button>'; };
    return b('map', 'Map', 'maze', false) + b('act', 'Act', 'sword', mine && t !== 'act') + b('you', 'You', 'skull', !!(v.me.offer)) + b('log', 'Journal', 'book', !!S.ui.newClue);
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
          // your own rolls and exceptional ones get the full die; routine rolls by others are a quiet toast
          if (r.by === you || r.finale || r.roll.tier === 'crit' || r.roll.tier === 'fumble') FX.dice({ roll: r.roll, who: who, label: r.opt, stakes: r.stakes, chips: r.chips, lines: r.lines }, AU.sfx);
          else { var good = r.roll.tier === 'ok'; toast(who + ' — ' + r.opt + ': d20 ' + r.roll.d + (r.roll.mod >= 0 ? '+' : '−') + Math.abs(r.roll.mod) + ' = ' + r.roll.total + ' vs DC ' + r.roll.dc + ' · ' + (good ? 'success' : 'failure'), good ? 'good' : 'bad'); AU.sfx(good ? 'success' : 'fail'); }
        }
        else AU.sfx(r.tier === 'ok' || r.tier === 'crit' || r.tier === 'auto' ? 'success' : 'fail');
        if (r.chips) r.chips.forEach(function (c) { if (c.k === 'clue') { AU.sfx('clue'); AU.hush(500); } if (c.k === 'item' && c.n > 0) AU.sfx('pickup'); if (c.k === 'ally') AU.sfx('ally'); });
      } else if (k === 'dmg' && mine) {
        if (d.k === 'san') { FX.flash('san'); AU.sfx('sanity'); } else { FX.flash('dmg'); AU.sfx('damage'); }
        FX.floatText($('.who'), d.n + (d.k === 'san' ? ' Sanity' : ' Vitality'), d.k === 'san' ? 'viol' : 'bad');
      } else if (k === 'heal' && mine) { FX.flash('heal'); AU.sfx('heal'); FX.floatText($('.who'), '+' + d.n, 'good'); }
      else if (k === 'clue') { if (S.ui.drawer !== 'right') S.ui.newClue = true; setTimeout(function () { FX.sparkle($('.hud-b:last-of-type') || $('.hud'), 'gold'); }, 50); AU.sfx('clue'); AU.hush(700); toast('Clue: ' + e.t.split('. ')[0].replace(/^.* uncovers /, ''), 'good'); }
      else if (k === 'clock') { if (d.n > 0) { AU.sfx('toll'); var tp = $('.top'); if (tp) { tp.classList.remove('toll'); void tp.offsetWidth; tp.classList.add('toll'); } } }
      else if (k === 'phase') { showPhase(d.phase, e.t); AU.sfx('phase'); AU.hush(1400); }
      else if (k === 'omen') { toast(e.t, 'viol'); AU.sfx('toll'); }
      else if (k === 'move') { if (mine) AU.sfx(d.mode === 'sprint' ? 'sprint' : 'step'); }
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
    drawer: function (el) { var d = el.dataset.d; S.ui.drawer = S.ui.drawer === d ? null : d; if (d === 'right' && S.ui.drawer) S.ui.newClue = false; var gm = $('.game'); if (gm) gm.setAttribute('data-drawer', S.ui.drawer || ''); htmlOf.hud = null; htmlOf.left = null; htmlOf.right = null; render(); AU.sfx('click'); },
    tab: function (el) { S.ui.tab = el.dataset.t; var gm = $('.game'); if (gm) gm.setAttribute('data-tab', S.ui.tab); htmlOf.nav = null; render(); },
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
    move: function (el) { var mode = el.dataset.mode; send({ t: 'move', mode: mode, to: el.dataset.to }); },
    follow: function (el) { send({ t: 'move', mode: 'follow', target: el.dataset.to }); },
    unlock: function (el) { send({ t: 'unlock', edge: el.dataset.edge, way: el.dataset.way }); AU.sfx('lock'); },
    choose: function (el) {
      var enc = S.view.enc; if (!enc) return;
      if (FX.rolling() || S.ui.sending) return;          // never double-roll while the die is on the table
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
    if (e.key === 'Escape') { if (S.ui.modal) closeModal(); else if (S.ui.drawer) ACTIONS.drawer({ dataset: { d: S.ui.drawer } }); else if (S.ui.sel) ACTIONS.desel(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.node[data-act]')) { e.preventDefault(); ACTIONS.selnode(e.target); }
    if (e.key === 'Enter' && e.target.id === 'f-code') ACTIONS.join();
  });
  document.addEventListener('submit', function (e) { e.preventDefault(); });

  // ───────────────────────────── start ─────────────────────────────
  var saved = Net.savedSeat();
  render();
  if (saved && Net.onlineAvailable()) {
    var net0 = Net.createOnline(handlers); S.net = net0;
    net0.resume(saved).then(function (res) { if (res.error) { S.net = null; try { net0.leave(); } catch (e) { /* closed */ } Net.clearSeat(); render(); } });
  }
  g.HollowApp = { state: S, actions: ACTIONS };   // handy for debugging in the console
})(window);
