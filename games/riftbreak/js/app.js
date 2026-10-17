/* RIFTBREAK — the client: title, lobby, table, results, tutorial, settings.
   Rendering is plain DOM. Each state push from a transport (net.js) is rendered at once; the new events in it
   drive short animations, sounds and plain-language notices, so nothing ever changes without a visible reason. */
(function () {
  'use strict';
  var E = window.RiftEngine, A = window.RiftArt, S = window.RiftAudio, Net = window.RiftNet;
  var hub = window.Hub ? window.Hub.init({ id: 'riftbreak', version: '1.0.0', title: 'RIFTBREAK' }) : null;

  // ───────────── preferences ─────────────
  var PREF_KEY = 'riftbreak.prefs';
  var prefs = { name: '', avatar: 'comet', motion: 'auto', tips: true, seats: 6, botLevel: 'normal', botSpeed: 'normal', turnTimer: 0, lastCall: true, seenTips: {} };
  try { var sp = JSON.parse(localStorage.getItem(PREF_KEY) || 'null'); if (sp) for (var k in prefs) if (sp[k] != null) prefs[k] = sp[k]; } catch (e) { /* storage blocked */ }
  if (!prefs.name) prefs.name = (hub && hub.player && hub.player().name !== 'Player' && hub.player().name) || '';
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* storage blocked */ } }
  function reduced() { return prefs.motion === 'reduced' || (prefs.motion === 'auto' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function applyMotion() { document.body.classList.toggle('reduced', reduced()); }
  applyMotion();

  // ───────────── tiny DOM helpers ─────────────
  var esc = A.esc;
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function cardEl(c) { var d = document.createElement('div'); d.className = 'cardel'; d.innerHTML = c ? A.card(c) : A.back(); return d; }
  function isMobile() { return window.matchMedia('(max-width: 760px)').matches; }
  var ICON = {
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/></svg>',
    log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6M17 9l6 6"/></svg>',
    exit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="13" height="18" rx="2.5" transform="rotate(12 12 12)"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  };
  var SUIT_NAME = { cyan: 'Cyan', crimson: 'Crimson', gold: 'Gold', violet: 'Violet' };

  document.getElementById('defs').innerHTML = A.defs();
  var root = document.getElementById('app');

  // ───────────── app state ─────────────
  var app = {
    net: null, view: null, screen: 'title', round: -1, lastSeq: 0, practice: false, serverOnline: null, connected: true,
    handEls: new Map(), trail: [], armedCall: false, chooser: null, logLines: [], recent: [], logOpen: false, resultsShownFor: -1,
    lastStage: 0, receivedAt: 0, overlayQueue: [], overlayBusy: false, tipQueue: [], tipShown: null, myTurnSeen: -1, joinCode: ''
  };
  var hashJoin = (location.hash.match(/join=([A-Za-z]{4})/) || [])[1];
  if (hashJoin) app.joinCode = hashJoin.toUpperCase();

  function me() { return app.view && app.view.you; }
  function match() { return app.view && app.view.match; }
  function seatInfo(id) { var v = app.view; if (!v) return null; for (var i = 0; i < v.seats.length; i++) if (v.seats[i].id === id) return v.seats[i]; return null; }
  function seatHue(id) { var v = app.view; var i = v ? v.seats.map(function (s) { return s.id; }).indexOf(id) : 0; return A.SEAT_HUES[(i < 0 ? 0 : i) % A.SEAT_HUES.length]; }
  function nameOf(id, cap) {
    if (id === me()) return cap === false ? 'you' : 'You';
    var s = seatInfo(id);
    if (s) return s.name;
    var m = match();
    if (m) for (var i = 0; i < m.players.length; i++) if (m.players[i].id === id) return m.players[i].name;
    return 'Someone';
  }
  function avatarSvg(id) { var s = seatInfo(id); return A.avatar(s ? s.avatar : 'flare', seatHue(id)); }

  // ───────────── toasts, log, modal, coach ─────────────
  function toast(html, cls, ms) {
    var box = $('.toasts');
    if (!box) return;
    var t = el('<div class="toast ' + (cls || '') + '">' + html + '</div>');
    box.appendChild(t);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    // Stay up long enough to read: at least 4.5 s, longer for longer messages.
    var words = t.textContent.split(/\s+/).length;
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 320); }, Math.max(ms || 4500, 2500 + words * 320));
  }
  function log(html, e) {
    app.logLines.push(html);
    if (app.logLines.length > 150) app.logLines.shift();
    var d = $('.logdrawer .lines');
    if (d) { d.insertBefore(el('<div class="ln">' + html + '</div>'), d.firstChild); while (d.children.length > 150) d.removeChild(d.lastChild); }
    app.recent.unshift({ html: html, icon: eventIcon(e) });
    if (app.recent.length > 5) app.recent.length = 5;
    renderRecent();
  }
  // Recent Events: the last few things that happened, each with a small colored icon.
  var EV_ICON = {
    card: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="3" width="12" height="18" rx="2.5" transform="rotate(10 12 12)"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c2 4 7 6 7 12a7 7 0 0 1-14 0c0-3 2-5 3-7 1 2 2 3 2 3s3-3 2-8z"/></svg>',
    cool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/></svg>',
    swirl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 12c0-2 3-2 3 0s-2 4.5-5 4-4-5-1-7.5 8-1.5 8 2.5-3 7-7.5 6.5"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h7l-2 8 9-12h-7z"/></svg>',
    dot: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>'
  };
  function eventIcon(e) {
    if (!e) return { svg: EV_ICON.dot, hex: '#8e9ad8' };
    switch (e.t) {
      case 'play': return { svg: EV_ICON.card, hex: e.card.color ? A.SUIT_HEX[e.card.color] : '#ffffff' };
      case 'meltdown': return e.delta > 0 ? { svg: EV_ICON.flame, hex: '#ff8a3d' } : { svg: EV_ICON.cool, hex: A.SUIT_HEX.cyan };
      case 'rift': return { svg: EV_ICON.swirl, hex: A.SUIT_HEX.violet };
      case 'collapse': return { svg: EV_ICON.flame, hex: A.SUIT_HEX.crimson };
      case 'stack': case 'accept': case 'caught': case 'exposed': return { svg: EV_ICON.bolt, hex: A.SUIT_HEX.crimson };
      case 'draw': case 'timeout': case 'reshuffle': return { svg: EV_ICON.card, hex: '#c8d0ff' };
      case 'win': case 'call': return { svg: EV_ICON.bolt, hex: A.SUIT_HEX.gold };
      default: return { svg: EV_ICON.dot, hex: '#8e9ad8' };
    }
  }
  function renderRecent() {
    var box = $('.events .lines');
    if (!box) return;
    box.innerHTML = app.recent.length ? app.recent.map(function (r) {
      return '<div class="ev"><span class="evi" style="--ec:' + r.icon.hex + '">' + r.icon.svg + '</span><span class="evt">' + r.html + '</span></div>';
    }).join('') : '<div class="ev empty">Nothing yet — the match is just starting.</div>';
  }
  function modal(inner, opts) {
    opts = opts || {};
    closeModal();
    var m = el('<div class="modal ' + (opts.cls || '') + '"><div class="box panel">' + (opts.noClose ? '' : '<button class="btn icon ghost close" aria-label="Close">' + ICON.close + '</button>') + '</div></div>');
    var box = $('.box', m);
    if (typeof inner === 'string') box.insertAdjacentHTML('beforeend', inner); else box.appendChild(inner);
    m.addEventListener('click', function (e) { if (e.target === m && !opts.noClose) closeModal(); });
    var c = $('.close', m); if (c) c.onclick = function () { S.play('select'); closeModal(); };
    document.body.appendChild(m);
    return m;
  }
  function closeModal() { $$('.modal').forEach(function (m) { m.remove(); }); }

  var TIPS = {
    yourturn: ['Your turn', 'Glowing cards are legal right now. Tap one to play it, or tap the draw pile to draw.', '.hand'],
    rule: ['Reality Rule', 'This rule changes how cards match. A Rift card replaces it with the next rule shown underneath.', '.rulepanel'],
    meltdown: ['Meltdown', 'Rifts and attacks raise the meter; Stabilize and 0s cool it. At 10 the announced Collapse Event hits, then it resets to 3.', '.meter'],
    attack: ['Under attack', 'Counter with any Surge or Overload to pass it on, play Stabilize to take only half, or take the cards.', '.actions'],
    lastcard: ['Two cards left', 'Press LAST CARD before you play, or anyone can catch you and make you draw 2.', '.actions'],
    critical: ['Critical', 'Meltdown is 4+. Rift cards can now be played on any card.', '.meter'],
    breaking: ['Breaking', 'Meltdown is 7+. Every attack adds +1. One more push could trigger the Collapse.', '.meter'],
    drawn: ['Playable draw', 'The card you drew can be played. Play it now, or keep it and end your turn.', '.actions'],
    catch: ['Catch them!', 'Someone forgot to call LAST CARD. Catch them before the next player finishes their turn.', '.actions'],
    badges: ['Meltdown badges', 'The small ▲/▼ tags on your cards show how much each play would move the Meltdown.', '.hand']
  };
  function tip(id) {
    if (!prefs.tips && !app.practice) return;
    if (prefs.seenTips[id] && !app.practice) return;
    if (app.tipShown === id || app.tipQueue.indexOf(id) >= 0) return;
    if (app.practice && app.practiceSeen && app.practiceSeen[id]) return;
    app.tipQueue.push(id);
    nextTip();
  }
  function nextTip() {
    if (app.tipShown || !app.tipQueue.length || app.overlayBusy) return;
    var id = app.tipQueue.shift();
    var t = TIPS[id], anchor = $(t[2]);
    if (!anchor || app.screen !== 'game') { nextTip(); return; }
    app.tipShown = id;
    prefs.seenTips[id] = 1; savePrefs();
    if (app.practice) { app.practiceSeen = app.practiceSeen || {}; app.practiceSeen[id] = 1; }
    var c = el('<div class="coach" role="note"><b>' + esc(t[0]) + '</b>' + esc(t[1]) + '<div><button>Got it</button></div></div>');
    document.body.appendChild(c);
    var r = anchor.getBoundingClientRect(), cr = c.getBoundingClientRect();
    var x = Math.max(10, Math.min(window.innerWidth - cr.width - 10, r.left + r.width / 2 - cr.width / 2));
    var y = r.top - cr.height - 12;
    if (y < 60) y = Math.min(window.innerHeight - cr.height - 10, r.bottom + 12);
    c.style.left = x + 'px'; c.style.top = y + 'px';
    var done = function () { if (!c.parentNode) return; c.remove(); app.tipShown = null; setTimeout(nextTip, 300); };
    $('button', c).onclick = function () { S.play('select'); done(); };
    setTimeout(done, 9000);
  }
  function clearTips() { $$('.coach').forEach(function (c) { c.remove(); }); app.tipShown = null; app.tipQueue = []; }

  // ───────────── hover tooltips ─────────────
  // Mouse users get a short explanation of anything with data-tip after a brief hover. Touch is unaffected.
  var tipBox = null, tipFor = null, tipTimer = null;
  function setTip(node, title, body) {
    if (!node) return;
    if (title) node.setAttribute('data-tip-title', title); else node.removeAttribute('data-tip-title');
    node.setAttribute('data-tip', body || '');
  }
  function hideHoverTip() { clearTimeout(tipTimer); tipFor = null; if (tipBox) { tipBox.remove(); tipBox = null; } }
  function showHoverTip(node) {
    if (!node.isConnected) return;
    var title = node.getAttribute('data-tip-title'), body = node.getAttribute('data-tip');
    if (!title && !body) return;
    tipBox = el('<div class="hovertip" role="tooltip">' + (title ? '<b>' + esc(title) + '</b>' : '') + (body ? '<span>' + esc(body).replace(/\n/g, '<br>') + '</span>' : '') + '</div>');
    document.body.appendChild(tipBox);
    var r = node.getBoundingClientRect(), tr = tipBox.getBoundingClientRect();
    var x = Math.max(8, Math.min(window.innerWidth - tr.width - 8, r.left + r.width / 2 - tr.width / 2));
    var y = r.top - tr.height - 10;
    if (y < 8) y = Math.min(window.innerHeight - tr.height - 8, r.bottom + 10);
    tipBox.style.left = x + 'px'; tipBox.style.top = y + 'px';
  }
  document.addEventListener('pointerover', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    var t = e.target.closest && e.target.closest('[data-tip]');
    if (t === tipFor) return;
    hideHoverTip();
    if (!t) return;
    tipFor = t;
    tipTimer = setTimeout(function () { if (tipFor === t) showHoverTip(t); }, 380);
  });
  document.addEventListener('pointerout', function (e) {
    if (tipFor && !(e.relatedTarget && tipFor.contains(e.relatedTarget)) && tipFor.contains(e.target)) hideHoverTip();
  });
  ['pointerdown', 'wheel', 'keydown'].forEach(function (ev) { document.addEventListener(ev, hideHoverTip, true); });

  // ───────────── navigation ─────────────
  function show(screen) {
    app.screen = screen;
    clearTips();
    closeChooser();
    root.innerHTML = '';
    document.body.classList.remove('stage-1', 'stage-2');
    if (screen === 'title') { renderTitle(); S.music('title'); }
    if (screen === 'lobby') { renderLobby(); S.music('title'); }
    if (screen === 'game') { buildGame(); S.music('game'); }
  }

  function profile() { return { name: (prefs.name || '').trim() || 'Player', avatar: prefs.avatar }; }
  function hostSettings() { return { seats: prefs.seats, botLevel: prefs.botLevel, botSpeed: prefs.botSpeed, turnTimer: prefs.turnTimer, lastCall: prefs.lastCall }; }

  var handlers = {
    onState: function (view) { onState(view); },
    onStatus: function (on) {
      app.connected = on;
      var b = $('.banner-net');
      if (!on && app.net && app.net.kind === 'online' && app.screen !== 'title') { if (!b) document.body.appendChild(el('<div class="banner-net">Connection lost — reconnecting…</div>')); }
      else if (b) b.remove();
    },
    onClosed: function (reason) {
      leaveNet(true);
      show('title');
      toastLater(reason || 'The room closed.');
    }
  };
  function toastLater(msg) { setTimeout(function () { var t = $('.title .hint.err'); if (t) { t.textContent = msg; t.style.display = 'block'; } }, 50); }

  function leaveNet(silent) {
    if (app.net) { try { app.net.leave(); } catch (e) { /* gone */ } }
    app.net = null; app.view = null; app.round = -1; app.lastSeq = 0; app.trail = []; app.practice = false; app.handEls = new Map();
    var b = $('.banner-net'); if (b) b.remove();
    void silent;
  }

  function startOffline(opts) {
    leaveNet(true);
    app.practice = !!opts.practice;
    app.practiceSeen = {};
    var settings = opts.settings || hostSettings();
    app.net = Net.createOffline(handlers, profile(), settings);
    if (opts.start) app.net.send({ type: 'start' }); else show('lobby');
  }

  function createRoom() {
    leaveNet(true);
    app.net = Net.createOnline(handlers);
    setBusy(true);
    app.net.create(profile(), hostSettings()).then(function (res) {
      setBusy(false);
      if (res.error) { titleError(res.error); leaveNet(); return; }
      S.play('confirm');
      if (app.view) routeFromView(); else show('lobby');
    });
  }
  function joinRoom(code) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) { titleError('Room codes are 4 letters.'); S.play('error'); return; }
    leaveNet(true);
    app.net = Net.createOnline(handlers);
    setBusy(true);
    app.net.join(code, profile()).then(function (res) {
      setBusy(false);
      if (res.error) { titleError(res.error); S.play('error'); leaveNet(); return; }
      S.play('confirm');
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      if (app.view) routeFromView(); else show('lobby');
    });
  }
  function setBusy(on) { $$('.title .btn').forEach(function (b) { if (on) b.setAttribute('data-busy', '1'); else b.removeAttribute('data-busy'); b.disabled = on || (b.hasAttribute('data-online') && !app.serverOnline); }); }
  function titleError(msg) { var t = $('.title .hint.err'); if (t) { t.textContent = msg; t.style.display = 'block'; } }

  function routeFromView() {
    var v = app.view;
    if (!v) return;
    if (v.phase === 'lobby') { if (app.screen !== 'lobby') show('lobby'); else renderLobby(); }
    else if (app.screen !== 'game') show('game');
  }

  // ───────────── title screen ─────────────
  function renderTitle() {
    var s = el('<section class="screen title"></section>');
    var fc = '<div class="floatcards">' + [
      { c: { kind: 'num', color: 'cyan', value: 7 }, x: 6, y: 14, r: -18 }, { c: { kind: 'rift', color: 'violet' }, x: 84, y: 10, r: 14 },
      { c: { kind: 'overload', color: null }, x: 8, y: 66, r: 10 }, { c: { kind: 'num', color: 'gold', value: 3 }, x: 86, y: 62, r: -12 },
      { c: { kind: 'stabilize', color: 'crimson' }, x: 70, y: 82, r: 22 }, { c: { kind: 'surge', color: 'cyan' }, x: 20, y: 86, r: -26 }
    ].map(function (f, i) { return '<div class="fc" style="left:' + f.x + '%;top:' + f.y + '%;--r:' + f.r + 'deg;animation-delay:-' + (i * 3) + 's"><div class="cardel" style="--cw:110px">' + A.card(f.c) + '</div></div>'; }).join('') + '</div>';
    s.innerHTML = fc +
      '<div class="hero"><div class="logo"><span class="a">RIFTBREAK</span><span class="b" aria-hidden="true">RIFTBREAK</span><i class="seam"></i></div>' +
      '<div class="tag">Empty your hand while the rules of reality keep changing — and don’t let the Meltdown hit 10.</div></div>' +
      '<div class="grid">' +
      '<div class="panel card-panel"><div class="label">Your name</div><input type="text" class="nm" maxlength="16" placeholder="Pick a name" autocomplete="nickname">' +
      '<div class="avatars">' + E.AVATARS.map(function (a, i) { return '<button data-av="' + a + '" class="' + (prefs.avatar === a ? 'on' : '') + '" aria-label="' + a + ' sigil">' + A.avatar(a, A.SEAT_HUES[i]) + '</button>'; }).join('') + '</div>' +
      '<div class="tactions"><button class="btn primary big qp">Quick Play vs bots</button>' +
      '<div class="row"><button class="btn ghost small practice">Practice match</button><button class="btn ghost small solo">Solo setup</button></div></div>' +
      '<div class="hint">Plays offline. Bots fill the table; change seats and difficulty in Solo setup.</div></div>' +
      '<div class="panel card-panel"><div class="label">Play with friends</div>' +
      '<button class="btn create" data-online>Create a room</button>' +
      '<div class="row"><input type="text" class="code" maxlength="4" placeholder="CODE" style="text-transform:uppercase;letter-spacing:.3em;font-family:var(--display)"><button class="btn join" data-online style="flex:0 0 auto">Join</button></div>' +
      '<div class="hint online">Checking for the online server…</div><div class="hint err" style="display:none;color:var(--crimson)"></div>' +
      '<div class="row"><button class="btn ghost small how">How to play</button><button class="btn ghost small set">Settings</button></div></div>' +
      '</div><div class="foot">2–8 players · best with 5–8 · bots fill empty seats</div>';
    root.appendChild(s);
    var nm = $('.nm', s); nm.value = prefs.name;
    nm.oninput = function () { prefs.name = nm.value.slice(0, 16); savePrefs(); if (hub && window.Hub.player) { /* hub keeps its own name */ } };
    $$('.avatars button', s).forEach(function (b) { b.onclick = function () { prefs.avatar = b.dataset.av; savePrefs(); S.play('select'); $$('.avatars button', s).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    $('.qp', s).onclick = function () { S.unlock(); S.play('confirm'); startOffline({ start: true }); };
    $('.practice', s).onclick = function () { S.unlock(); S.play('confirm'); startOffline({ start: true, practice: true, settings: { seats: 3, botLevel: 'easy', botSpeed: 'relaxed', turnTimer: 0, lastCall: true } }); };
    $('.solo', s).onclick = function () { S.unlock(); S.play('select'); startOffline({ start: false }); };
    $('.create', s).onclick = function () { S.unlock(); createRoom(); };
    var code = $('.code', s); code.value = app.joinCode;
    code.oninput = function () { code.value = code.value.toUpperCase().replace(/[^A-Z]/g, ''); };
    code.onkeydown = function (e) { if (e.key === 'Enter') joinRoom(code.value); };
    $('.join', s).onclick = function () { S.unlock(); joinRoom(code.value); };
    $('.how', s).onclick = function () { S.unlock(); S.play('select'); showTutorial(); };
    $('.set', s).onclick = function () { S.unlock(); S.play('select'); showSettings(); };
    if (app.joinCode) setTimeout(function () { (prefs.name ? $('.join', s) : nm).focus(); }, 50);
    updateOnlineHint();
  }
  function updateOnlineHint() {
    var h = $('.title .hint.online');
    if (!h) return;
    if (app.serverOnline === null) h.textContent = 'Checking for the online server…';
    else if (app.serverOnline) h.textContent = 'Share the 4-letter code or link. Friends on the same Wi-Fi open this hub’s address.';
    else h.innerHTML = 'Online rooms need the hub server. Run <b>npm start</b> on one computer and open its address on every device.';
    $$('.title [data-online]').forEach(function (b) { b.disabled = !app.serverOnline || b.hasAttribute('data-busy'); });
  }

  // ───────────── lobby ─────────────
  function renderLobby() {
    var v = app.view;
    if (!v) { root.innerHTML = '<section class="screen lobby"><div class="label" style="margin:auto">Connecting…</div></section>'; return; }
    var online = app.net && app.net.kind === 'online';
    var host = v.canHost;
    var st = v.settings;
    var link = online ? location.origin + location.pathname + '#join=' + v.code : '';
    var s = el('<section class="screen lobby"><div class="wrap"></div></section>');
    var w = $('.wrap', s);
    w.innerHTML =
      '<header><div><div class="label">' + (online ? 'Room code' : 'Solo table') + '</div><div class="code">' + (online ? esc(v.code) : 'SOLO') + '</div></div>' +
      (online ? '<div class="share"><button class="btn small copy">' + ICON.copy + 'Copy invite link</button>' + (navigator.share ? '<button class="btn small sharebtn">Share</button>' : '') + '</div>' : '') +
      '<button class="btn ghost small leave">' + ICON.exit + 'Leave</button></header>' +
      '<div class="panel seats"></div><div class="panel settings"></div>';
    var seats = $('.seats', w);
    var total = Math.max(st.seats, v.seats.length);
    for (var i = 0; i < Math.max(total, 2); i++) {
      var p = v.seats[i];
      if (p) {
        var sub = p.isBot ? 'Bot · ' + p.level : (p.id === v.host ? 'Host' : 'Player') + (p.waiting ? ' · joins next match' : '');
        var row = el('<div class="seat"><div class="avatar">' + A.avatar(p.avatar, A.SEAT_HUES[i % 8]) + '</div><div><div class="nm">' + esc(p.name) + (p.id === v.you ? ' <span class="chip">you</span>' : '') + '</div><div class="sub">' + (p.isBot ? '' : '<span class="dot ' + (p.connected ? '' : 'off') + '"></span> ') + esc(sub) + (p.wins ? ' · ★ ' + p.wins : '') + '</div></div></div>');
        if (host && p.id !== v.you && (p.isBot || online)) {
          var x = el('<button class="btn icon ghost x" aria-label="Remove ' + esc(p.name) + '">' + ICON.close + '</button>');
          x.onclick = (function (id) { return function () { S.play('select'); send({ type: 'kick', playerId: id }); }; })(p.id);
          row.appendChild(x);
        }
        seats.appendChild(row);
      } else if (i < total) {
        var e = el('<div class="seat empty">' + (host ? '<button class="btn small ghost">+ Add bot</button>' : 'Open seat — a bot takes it at the start') + '</div>');
        var b = $('button', e); if (b) b.onclick = function () { S.play('select'); send({ type: 'addBot' }); };
        seats.appendChild(e);
      }
    }
    var set = $('.settings', w);
    var segs = function (key, opts, cur) {
      return '<div class="seg" data-key="' + key + '">' + opts.map(function (o) { return '<button data-v="' + o[0] + '" class="' + (String(cur) === String(o[0]) ? 'on' : '') + '"' + (host ? '' : ' disabled') + '>' + o[1] + '</button>'; }).join('') + '</div>';
    };
    set.innerHTML =
      '<div class="setting"><span class="label">Seats</span><span class="stepper"><button class="btn icon ghost minus"' + (host ? '' : ' disabled') + '>−</button><b>' + st.seats + '</b><button class="btn icon ghost plus"' + (host ? '' : ' disabled') + '>+</button></span></div>' +
      '<div class="setting"><span class="label">Bots</span>' + segs('botLevel', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], st.botLevel) + '</div>' +
      '<div class="setting"><span class="label">Bot speed</span>' + segs('botSpeed', [['fast', 'Fast'], ['normal', 'Normal'], ['relaxed', 'Relaxed']], st.botSpeed) + '</div>' +
      '<div class="setting"><span class="label">Turn timer</span>' + segs('turnTimer', [[0, 'Off'], [15, '15s'], [25, '25s'], [40, '40s']], st.turnTimer) + '</div>' +
      '<div class="setting"><span class="label">Last-card calls</span>' + segs('lastCall', [['true', 'On'], ['false', 'Off']], String(st.lastCall)) + '</div>' +
      '<div class="start">' + (host ? '<button class="btn primary go">Start match</button>' : '<div class="label" style="text-align:center">Waiting for the host to start…</div>') +
      '<button class="btn ghost small how">How to play</button></div>';
    root.innerHTML = '';
    root.appendChild(s);
    var change = function (patch) {
      for (var k in patch) prefs[k] = patch[k];
      savePrefs();
      send({ type: 'settings', settings: patch });
    };
    if (host) {
      $('.minus', set).onclick = function () { S.play('select'); change({ seats: Math.max(2, Math.max(v.seats.length, st.seats - 1)) }); };
      $('.plus', set).onclick = function () { S.play('select'); change({ seats: Math.min(8, st.seats + 1) }); };
      $$('.seg', set).forEach(function (g) {
        $$('button', g).forEach(function (b) {
          b.onclick = function () {
            S.play('select');
            var val = b.dataset.v, key = g.dataset.key;
            if (key === 'turnTimer') val = Number(val);
            if (key === 'lastCall') val = val === 'true';
            var patch = {}; patch[key] = val; change(patch);
          };
        });
      });
      $('.go', set).onclick = function () { S.play('confirm'); send({ type: 'start' }).then(function (r) { if (r && r.error) toast(esc(r.error), 'bad'); }); };
    }
    $('.how', set).onclick = function () { S.play('select'); showTutorial(); };
    $('.leave', w).onclick = function () { S.play('select'); leaveNet(); show('title'); };
    var cp = $('.copy', w);
    if (cp) cp.onclick = function () {
      S.play('confirm');
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { cp.lastChild.textContent = 'Copied!'; }, function () { prompt('Copy this invite link', link); });
    };
    var sh = $('.sharebtn', w);
    if (sh) sh.onclick = function () { navigator.share({ title: 'RIFTBREAK', text: 'Join my RIFTBREAK room: ' + v.code, url: link }).catch(function () { /* cancelled */ }); };
  }

  function send(cmd) {
    if (!app.net) return Promise.resolve({ error: 'Not connected.' });
    return app.net.send(cmd);
  }

  // ───────────── game screen skeleton ─────────────
  function buildGame() {
    var s = el('<section class="screen game">' +
      '<div class="topbar"><div class="logo mini"><span class="a">RIFTBREAK</span><span class="b" aria-hidden="true">RIFTBREAK</span><i class="seam"></i></div>' +
      '<span class="room"></span><span class="sp"></span>' +
      '<button class="btn icon round b-mute" data-tip="Sound on / off (M)" aria-label="Mute"></button>' +
      '<button class="btn icon round b-rules" data-tip="Rules and card list (R)" aria-label="Rules">' + ICON.book + '</button>' +
      '<button class="btn icon round b-log" data-tip="Full history of this match" aria-label="Event log">' + ICON.log + '</button>' +
      '<button class="btn icon round b-set" data-tip="Music, effects, motion and tips" aria-label="Settings">' + ICON.gear + '</button>' +
      '<button class="btn icon round b-exit" data-tip="Leave the match" aria-label="Leave">' + ICON.exit + '</button></div>' +
      '<div class="arena"><div class="playfield"><div class="seats"></div>' +
      '<div class="center"><div class="island">' + A.island() + '</div>' +
      '<div class="pilewrap"><button class="pile" aria-label="Draw pile"></button><div class="plabel pcount"></div></div>' +
      '<div class="discwrap"><div class="stack hidden"></div><div class="discard"></div><div class="plabel">Discard Pile</div><div class="colorsel panel"></div></div>' +
      '<div class="meter" tabindex="0"><div class="dial"><svg class="ring" viewBox="-100 -100 200 200"></svg><div class="core"></div></div><div class="readout"></div></div>' +
      '</div></div>' +
      '<div class="side"><div class="rulepanel panel" role="button" tabindex="0" aria-label="Reality Rule — open details"></div>' +
      '<div class="events panel" role="button" tabindex="0" aria-label="Recent events — open the full log"><div class="ptitle">Recent Events</div><div class="lines"></div></div></div></div>' +
      '<div class="handzone"><div class="mepanel panel"><div class="me-badge"></div><div class="status"></div></div><div class="hand"><div class="inner"></div></div><div class="actions"></div></div>' +
      '<div class="toasts" aria-live="polite"></div>' +
      '<div class="logdrawer panel" role="dialog" aria-label="What happened"><div class="dhead"><span class="ptitle">What happened</span><button class="btn icon round dclose" aria-label="Close" data-tip="Close (Esc)">' + ICON.close + '</button></div><div class="lines"></div><div class="ln empty">Nothing has happened yet.</div></div>' +
      '</section>');
    root.appendChild(s);
    app.handEls = new Map();
    $('.b-rules', s).onclick = function () { S.play('select'); showRules(); };
    $('.b-log', s).onclick = function () { S.play('select'); setLog(!app.logOpen); };
    $('.dclose', s).onclick = function () { S.play('select'); setLog(false); };
    $('.b-set', s).onclick = function () { S.play('select'); showSettings(); };
    $('.b-mute', s).onclick = function () { S.setPref('muted', !S.prefs.muted); updateMute(); S.play('select'); };
    $('.b-exit', s).onclick = function () { S.play('select'); confirmLeave(); };
    $('.rulepanel', s).onclick = function () { S.play('select'); showRules(); };
    $('.events', s).onclick = function () { S.play('select'); setLog(!app.logOpen); };
    renderRecent();
    $('.pile', s).onclick = function () { doDraw(); };
    app.logOpen = false;
    var lines = $('.logdrawer .lines', s);
    app.logLines.slice().reverse().forEach(function (l) { lines.appendChild(el('<div class="ln">' + l + '</div>')); });
    updateMute();
    if (app.view) renderGame([]);
    tip('rule');
    setTimeout(function () { tip('meltdown'); }, 400);
  }
  function setLog(open) {
    app.logOpen = open;
    var d = $('.logdrawer'); if (!d) return;
    d.classList.toggle('open', open);
    var b = $('.b-log'); if (b) b.classList.toggle('on', open);
  }
  // Clicking anywhere outside the open drawer (other than its toggles) closes it.
  document.addEventListener('pointerdown', function (e) {
    if (!app.logOpen || !e.target.closest) return;
    if (e.target.closest('.logdrawer, .b-log, .events')) return;
    setLog(false);
  }, true);
  function updateMute() { var b = $('.b-mute'); if (b) b.innerHTML = S.prefs.muted ? ICON.mute : ICON.sound; }
  function confirmLeave() {
    var v = app.view;
    if (!v || v.phase !== 'playing') { leaveNet(); show('title'); return; }
    var m = modal('<h2>Leave the match?</h2><p>' + (app.net.kind === 'online' ? 'A bot takes over your seat so your friends can finish.' : 'This solo match will end.') + '</p><div class="results"><div class="btns"><button class="btn ghost stay">Stay</button><button class="btn danger go">Leave</button></div></div>');
    $('.stay', m).onclick = closeModal;
    $('.go', m).onclick = function () { closeModal(); leaveNet(); show('title'); };
  }

  // ───────────── state in ─────────────
  function onState(view) {
    var prevView = app.view;
    app.view = view;
    app.receivedAt = Date.now();
    var m = view.match;
    var events = [];
    var fresh = false;
    if (m) {
      if (view.round !== app.round) {
        // New match (or first view after joining/reconnecting): reset tracking. Animate only a fresh deal.
        fresh = m.turnCount === 0 && m.events.length <= 4;
        app.round = view.round;
        app.lastSeq = 0;
        app.trail = [m.top];
        app.armedCall = false;
        app.logLines = [];
        app.recent = [];
        var ld = $('.logdrawer .lines'); if (ld) ld.innerHTML = '';
        if (fresh) {
          if (hub) hub.report('session-start', { players: m.players.length, mode: app.net.kind });
          if (app.screen === 'game') S.music('game');
          app.handEls.forEach(function (x) { x.remove(); });
          app.handEls = new Map();
        }
      }
      events = m.events.filter(function (e) { return e.seq > app.lastSeq; });
      if (m.events.length) app.lastSeq = Math.max(app.lastSeq, m.events[m.events.length - 1].seq);
      if (!fresh && prevView && prevView.round !== view.round) events = [];
    }
    if (view.phase === 'lobby') { if (app.screen !== 'lobby') show('lobby'); else renderLobby(); return; }
    if (app.screen !== 'game') {
      show('game');
      if (fresh) dealFx(m);
      app.lastStage = m ? m.stage : 0;
      S.setStage(app.lastStage);
      events.forEach(function (e) { var t = eventText(e); if (t) log(t.text, e); });
      return;
    }
    // Capture where played cards come from before the DOM changes.
    var sources = {};
    events.forEach(function (e) {
      if (e.t !== 'play') return;
      var hEl = e.pid === me() && app.handEls.get(e.card.id);
      sources[e.seq] = hEl ? hEl.getBoundingClientRect() : seatRect(e.pid);
      if (hEl) { hEl.style.visibility = 'hidden'; }
    });
    events.forEach(function (e) { if (e.t === 'play') { app.trail.push(e.card); if (app.trail.length > 5) app.trail.shift(); } });
    if (fresh && events.length) { app.trail = [m.top]; }
    var arriving = {};
    events.forEach(function (e) { if (e.t === 'draw' && e.pid === me() && e.cards) e.cards.forEach(function (id, i) { arriving[id] = i; }); });
    if (fresh) m.hand.forEach(function (c, i) { arriving[c.id] = i; });
    renderGame(events, { arriving: arriving, hidePlays: events.filter(function (e) { return e.t === 'play'; }).length });
    runFx(events, sources);
    if (fresh) dealFx(m);
  }

  // ───────────── game rendering ─────────────
  function renderGame(events, opt) {
    opt = opt || {};
    var v = app.view, m = v.match;
    if (!m) return;
    $('.room').textContent = app.net && app.net.kind === 'online' ? 'ROOM ' + v.code : (app.practice ? 'PRACTICE' : 'SOLO');
    var hex = A.SUIT_HEX[m.color];
    document.documentElement.style.setProperty('--active', hex);
    document.body.classList.toggle('stage-1', m.stage === 1);
    document.body.classList.toggle('stage-2', m.stage === 2);
    $('.game').classList.toggle('ccw', m.dir < 0);
    renderSeats();
    renderRule();
    renderCenter(opt.hidePlays);
    renderHand(opt.arriving || {});
    renderActions();
    renderStatus();
    if (v.phase === 'ended' && app.resultsShownFor !== v.round) {
      app.resultsShownFor = v.round;
      setTimeout(showResults, events && events.length ? 1400 : 200);
    }
    if (v.phase === 'playing' && $('.results')) closeModal();
  }

  function orderedPlayers() {
    var m = match(), ids = m.players.map(function (p) { return p.id; });
    var i = ids.indexOf(me());
    if (i < 0) return { mine: null, others: m.players.slice() };
    var others = [];
    for (var k = 1; k < ids.length; k++) others.push(m.players[(i + k) % ids.length]);
    return { mine: m.players[i], others: others };
  }

  // The table is a floating island; opponents sit around its far rim in turn order (clockwise from your left).
  // Returns the island's top-surface ellipse in play-field pixels.
  function islandGeom(field) {
    var G = A.ISLAND();
    var aspect = G.rx / G.ry;
    var rx = Math.min(field.width * 0.45, field.height * 0.4 * aspect);
    var ry = rx / aspect;
    return { cx: field.width / 2, cy: Math.max(ry + 64, field.height * 0.52), rx: rx, ry: ry, w: rx * 2 * G.w / (2 * G.rx) };
  }
  function seatAngles(k) {
    if (k === 1) return [90];
    var span = Math.min(210, 50 * (k - 1)), a0 = 90 - span / 2, out = [];
    for (var i = 0; i < k; i++) out.push(a0 + span * i / (k - 1));
    return out;
  }
  function renderSeats() {
    var m = match(), v = app.view;
    var box = $('.seats');
    var mobile = isMobile();
    box.className = 'seats' + (mobile ? ' seatrow' : '');
    var o = orderedPlayers();
    var others = o.others;
    var field = $('.playfield').getBoundingClientRect();
    var stackTarget = m.phase === 'attack' && m.stack ? m.turn : null;
    var existing = {};
    $$('.seat-el', box).forEach(function (s) { existing[s.dataset.id] = s; });
    var center = $('.center');
    var geo = null, angles = seatAngles(others.length);
    if (!mobile) {
      geo = islandGeom(field);
      center.style.top = geo.cy + 'px';
      center.style.setProperty('--iw', geo.w + 'px');
    } else { center.style.top = ''; center.style.removeProperty('--iw'); }
    others.forEach(function (p, i) {
      var s = existing[p.id];
      delete existing[p.id];
      if (!s) { s = el('<div class="seat-el" data-id="' + p.id + '"></div>'); box.appendChild(s); }
      var info = seatInfo(p.id) || {};
      var chips = '';
      if (info.autopilot) chips += '<span class="chip" title="Disconnected — a bot is playing this seat">auto</span>';
      else if (!info.isBot && !info.connected) chips += '<span class="chip">offline</span>';
      var active = m.turn === p.id && v.phase === 'playing';
      if (active) chips = '<span class="chip turn">' + (m.phase === 'attack' ? 'Facing +' + m.stack : 'Playing…') + '</span>' + chips;
      var cnt = p.count === 1 ? 'one' : p.count <= 3 ? 'low' : '';
      setTip(s, p.name, (info.isBot ? info.level[0].toUpperCase() + info.level.slice(1) + ' bot' : info.autopilot ? 'Disconnected — a bot is playing for them' : 'Player') +
        ' · ' + p.count + ' card' + (p.count === 1 ? '' : 's') + (info.wins ? ' · ' + info.wins + ' win' + (info.wins === 1 ? '' : 's') : '') +
        (active ? '\nIt is their turn' + (m.phase === 'attack' ? ' — facing +' + m.stack + '.' : '.') : '') + (p.count === 1 ? '\nOne card left!' : ''));
      s.innerHTML = '<div class="avatar">' + avatarSvg(p.id) + timerRing(p.id) + (p.called && p.count === 1 ? '<span class="lastflag">LAST</span>' : '') + '</div>' +
        '<div class="plate"><span class="nm">' + esc(p.name) + '</span>' + (info.wins ? '<span class="wins">★' + info.wins + '</span>' : '') +
        '<span class="count ' + cnt + '" aria-label="' + p.count + ' cards">' + ICON.card + p.count + '</span></div>' +
        '<div class="meta">' + chips + '</div>';
      s.classList.toggle('active', active);
      s.classList.toggle('target', stackTarget === p.id);
      s.classList.toggle('off', !!(!info.isBot && (!info.connected || info.autopilot)));
      if (m.exposed === p.id && v.settings.lastCall) {
        var cb = el('<button class="btn gold small catch">Catch!</button>');
        cb.onclick = function (ev) { ev.stopPropagation(); doCatch(p.id); };
        s.appendChild(cb);
      }
      if (geo) {
        // Sit just outside the rim: the avatar overlaps the island's edge.
        var a = angles[i] * Math.PI / 180, sw = s.offsetWidth || 170, sh = s.offsetHeight || 120;
        var x = geo.cx - (geo.rx + 24) * Math.cos(a), y = geo.cy - (geo.ry + 34) * Math.sin(a);
        s.style.left = Math.max(sw / 2 + 4, Math.min(field.width - sw / 2 - 4, x)) + 'px';
        s.style.top = Math.max(sh / 2 + 2, y) + 'px';
      } else {
        s.style.left = ''; s.style.top = '';
      }
    });
    Object.keys(existing).forEach(function (id) { existing[id].remove(); });
    // my own panel (bottom left)
    var mb = $('.me-badge');
    if (o.mine) {
      var info = seatInfo(o.mine.id) || {};
      mb.innerHTML = '<div class="avatar">' + avatarSvg(o.mine.id) + timerRing(o.mine.id) + '</div><div class="nm">' + esc(o.mine.name) + (info.wins ? ' <span class="wins">★' + info.wins + '</span>' : '') + '</div>' +
        '<div class="count" aria-label="' + o.mine.count + ' cards">' + ICON.card + o.mine.count + '</div>';
      $('.mepanel').classList.toggle('active', m.turn === o.mine.id && v.phase === 'playing');
      setTip(mb, 'You', o.mine.count + ' card' + (o.mine.count === 1 ? '' : 's') + ' in hand. Empty your hand to win.');
    } else mb.innerHTML = '<div class="nm">Spectating</div>';
  }

  function timerRing(id) {
    var v = app.view, m = v.match;
    if (!v.deadline || m.turn !== id || v.phase !== 'playing') return '';
    return '<svg class="timer" viewBox="0 0 70 70"><circle cx="35" cy="35" r="33" pathLength="100" stroke-dasharray="100 100" data-timer="1"/></svg>';
  }
  function remainingMs() {
    var v = app.view;
    if (!v || !v.deadline) return null;
    return v.deadline - (v.now + (Date.now() - app.receivedAt));
  }
  var lastTickSec = -1;
  setInterval(function () {
    var r = remainingMs();
    if (r == null || app.screen !== 'game') return;
    var total = (app.view.settings.turnTimer || 1) * 1000;
    $$('[data-timer]').forEach(function (c) { var f = Math.max(0, Math.min(1, r / total)); c.setAttribute('stroke-dasharray', (f * 100) + ' 100'); c.style.stroke = f < 0.3 ? 'var(--crimson)' : 'var(--cyan)'; });
    var secs = Math.max(0, Math.ceil(r / 1000));
    var sEl = $('.status .secs'); if (sEl) sEl.textContent = secs + 's';
    if (match() && match().turn === me() && secs <= 5 && secs > 0 && secs !== lastTickSec) { lastTickSec = secs; S.play('tick'); }
  }, 200);

  function seatRect(id) {
    if (id === me()) { var b = $('.me-badge .avatar'); return b ? b.getBoundingClientRect() : null; }
    var s = $('.seat-el[data-id="' + id + '"] .avatar');
    return s ? s.getBoundingClientRect() : null;
  }

  function renderRule() {
    var m = match();
    var r = E.RULES[m.rule], n = E.RULES[m.nextRule];
    var p = $('.rulepanel');
    p.innerHTML = '<div class="head"><span class="badge">' + A.ruleGlyph(r.glyph) + '</span><div><div class="ptitle">Current Reality Rule</div><div class="rname">' + esc(r.name) + '</div></div></div>' +
      '<div class="rtext">' + esc(r.text) + '</div>' +
      (n ? '<div class="next">Next Rift: <b>' + esc(n.name) + '</b></div>' : '');
    setTip(p, 'Reality Rule: ' + r.name, r.text + '\nFavors ' + r.tone + '.' + (n ? '\nA Rift card switches to ' + n.name + ': ' + n.text : '') + '\nClick for all rules.');
  }

  var STAGE_HEX = ['#22c7f0', '#ffb020', '#f0435a'];
  /** Compact segmented Meltdown dial: 10 segments, colored by the danger band they belong to. */
  var SEG_HEX = ['#22c7f0', '#2fd6dc', '#45e0c0', '#ffd23c', '#ffbd2e', '#ffa424', '#ff8a2a', '#ff6a2e', '#f74b3c', '#f0304f'];
  /** Compact segmented Meltdown dial: a bezel with 10 segments graded from cool cyan to hot red. */
  function ringSvg(mv) {
    var o = '<defs><linearGradient id="rb-bezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a46a8"/><stop offset="1" stop-color="#151a4a"/></linearGradient>' +
      '<radialGradient id="rb-dialcore"><stop offset="0" stop-color="#2a1a40"/><stop offset="1" stop-color="#10143a"/></radialGradient></defs>' +
      '<circle r="98" fill="#141833"/><circle r="94" fill="url(#rb-bezel)"/><circle r="90" fill="#10143a"/>';
    var R = 86, r = 62;
    for (var i = 0; i < 10; i++) {
      var a0 = (-90 + i * 36 + 2.5) * Math.PI / 180, a1 = (-90 + (i + 1) * 36 - 2.5) * Math.PI / 180;
      var lvl = i + 1, col = SEG_HEX[i], on = mv >= lvl;
      var d = 'M' + (R * Math.cos(a0)).toFixed(2) + ' ' + (R * Math.sin(a0)).toFixed(2) + 'A' + R + ' ' + R + ' 0 0 1 ' + (R * Math.cos(a1)).toFixed(2) + ' ' + (R * Math.sin(a1)).toFixed(2) +
        'L' + (r * Math.cos(a1)).toFixed(2) + ' ' + (r * Math.sin(a1)).toFixed(2) + 'A' + r + ' ' + r + ' 0 0 0 ' + (r * Math.cos(a0)).toFixed(2) + ' ' + (r * Math.sin(a0)).toFixed(2) + 'Z';
      o += '<g class="seg" data-lvl="' + lvl + '"><path d="' + d + '" fill="' + (on ? col : '#252d6c') + '" stroke="#141833" stroke-width="1.5"/></g>';
    }
    o += '<circle r="57" fill="url(#rb-dialcore)" stroke="#2c3684" stroke-width="3"/>';
    return o;
  }
  var FLAME = '<svg viewBox="0 0 48 48"><defs><linearGradient id="rb-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#f0304f"/><stop offset=".55" stop-color="#ff8a2a"/><stop offset="1" stop-color="#ffd23c"/></linearGradient></defs>' +
    '<path d="M24 3c4 8 15 13 15 26a15 15 0 0 1-30 0c0-7 4-11 6-15 2 4 4 6 4 6s6-6 5-17z" fill="url(#rb-flame)" stroke="#141833" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M24 24c2 4 7 6 7 12a7 7 0 0 1-14 0c0-3 2-5 3-7 1 2 2 3 2 3s3-3 2-8z" fill="#fff3b0"/></svg>';
  var COOL = '<svg viewBox="0 0 48 48"><path d="M24 4c4 8 14 13 14 25a14 14 0 0 1-28 0c0-7 4-11 6-15 2 4 4 6 4 6s5-6 4-16z" fill="#22c7f0" stroke="#141833" stroke-width="2" stroke-linejoin="round"/><path d="M24 25c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 2 3s2-3 1-7z" fill="#d9f6ff"/></svg>';

  function renderCenter(hidePlays) {
    var m = match(), v = app.view;
    var myTurn = m.turn === me() && v.phase === 'playing';
    var pile = $('.pile');
    pile.innerHTML = '';
    for (var i = 0; i < Math.min(3, Math.max(1, Math.ceil(m.drawCount / 30))); i++) pile.appendChild(cardEl(null));
    $('.pcount').innerHTML = 'Draw Pile <b>' + m.drawCount + '</b>';
    pile.classList.toggle('can', myTurn && m.phase !== 'drawn');
    pile.setAttribute('aria-label', m.phase === 'attack' ? 'Take ' + m.stack + ' cards' : 'Draw a card');
    setTip(pile, 'Draw pile', m.drawCount + ' cards left.' + (myTurn ? (m.phase === 'attack' ? '\nClick to take ' + m.stack + ' cards.' : m.phase === 'drawn' ? '' : '\nClick (or press D) to draw a card.') : ''));
    // Meltdown dial
    var meter = $('.meter');
    var stage = E.STAGES[m.stage];
    var stageHex = STAGE_HEX[m.stage];
    meter.style.setProperty('--stagehex', stageHex);
    $('svg.ring', meter).innerHTML = ringSvg(m.meltdown);
    $('.core', meter).innerHTML = m.stage === 0 ? COOL : FLAME;
    var col = E.COLLAPSES[m.nextCollapse];
    $('.readout', meter).innerHTML = '<div class="lvl">Meltdown</div><div class="val">' + m.meltdown + '<small>/10</small></div><div class="stagepill">' + esc(stage.name) + '</div>' +
      '<div class="next">At 10: <b>' + esc(col.name) + '</b></div>';
    setTip(meter, 'Meltdown ' + m.meltdown + '/10 · ' + stage.name, stage.text + '\nAt 10: ' + col.name + ' — ' + col.text + '\nRifts and attacks raise it; Stabilize and 0s lower it.');
    meter.setAttribute('aria-label', 'Meltdown ' + m.meltdown + ' of 10, ' + stage.name + '. At 10: ' + col.name + '. ' + col.text);
    // discard trail
    var disc = $('.discard');
    disc.innerHTML = '';
    var trail = app.trail.length ? app.trail : [m.top];
    if (trail[trail.length - 1].id !== m.top.id) { trail = trail.concat([m.top]); app.trail = trail.slice(-5); }
    trail.slice(-3).forEach(function (c, i, arr) {
      var ce = cardEl(c);
      var h = (c.id * 2654435761) >>> 0;
      var rot = ((h % 2000) / 2000 - 0.5) * 18, dx = ((h >> 11) % 10) - 5, dy = ((h >> 17) % 6) - 3;
      if (i === arr.length - 1) { rot *= 0.2; dx = 0; dy = 0; }
      ce.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)';
      if (hidePlays && i >= arr.length - hidePlays) ce.style.opacity = '0';
      disc.appendChild(ce);
    });
    setTip(disc, 'Top card: ' + E.cardName(m.top), 'Play a card of the same color (' + SUIT_NAME[m.color] + '), the same ' + (m.top.kind === 'num' ? 'number (' + m.top.value + ')' : 'symbol') + ', or a Wild.' + (m.rule !== 'stable' ? '\nThe Reality Rule may change this.' : ''));
    var stack = $('.stack');
    if (m.stack > 0) {
      stack.classList.remove('hidden');
      setTip(stack, 'Attack stack: +' + m.stack, nameOf(m.turn) + ' must counter with Surge/Overload, block with Stabilize (take half) or take ' + m.stack + ' cards.');
      stack.innerHTML = '<b>+' + m.stack + '</b> → ' + esc(nameOf(m.turn)) + '<span>' + (m.stack >= E.LIMITS.stackCap ? 'at cap' : 'cap ' + E.LIMITS.stackCap) + '</span>';
    } else stack.classList.add('hidden');
    // active color
    var chip = $('.colorsel');
    chip.setAttribute('aria-label', 'Active color: ' + SUIT_NAME[m.color]);
    setTip(chip, 'Active color: ' + SUIT_NAME[m.color], 'Cards of this color can be played. Wild cards change it.' + (m.rule === 'mirror' ? '\nMirror: it flips to ' + SUIT_NAME[E.SUIT_INFO[m.color].opposite] + ' after this turn.' : ''));
    chip.innerHTML = '<div class="ptitle">Active Color · <b style="color:' + A.SUIT_HEX[m.color] + '">' + SUIT_NAME[m.color] + '</b></div><div class="dots">' +
      E.SUITS.map(function (s) { return '<i class="' + (s === m.color ? 'on' : '') + '" style="--sw:' + A.SUIT_HEX[s] + '" title="' + SUIT_NAME[s] + '"><svg viewBox="-7 -7 14 14">' + A.PIP[s] + '</svg></i>'; }).join('') + '</div>' +
      (m.rule === 'mirror' ? '<div class="mirrornote">Mirror: flips to ' + SUIT_NAME[E.SUIT_INFO[m.color].opposite] + ' after this turn</div>' : '') +
      (m.chainBonus ? '<div class="mirrornote" style="color:var(--crimson)">Chain armed: next attack +' + m.chainBonus + '</div>' : '');
  }

  function sortHand(hand) {
    var suitOrder = { cyan: 0, crimson: 1, gold: 2, violet: 3 };
    var kindOrder = { num: 0, skip: 1, reverse: 2, surge: 3, stabilize: 4, rift: 5, wild: 6, wildrift: 7, overload: 8 };
    return hand.slice().sort(function (a, b) {
      var sa = a.color ? suitOrder[a.color] : 9, sb = b.color ? suitOrder[b.color] : 9;
      return sa - sb || kindOrder[a.kind] - kindOrder[b.kind] || (a.value || 0) - (b.value || 0) || a.id - b.id;
    });
  }

  /** Predicted Meltdown change for playing this card now (mirrors the engine's resolution order). */
  function predictDelta(m, card, overcharge) {
    var d = 0;
    if (card.kind === 'rift' || card.kind === 'wildrift') d += E.LIMITS.rift;
    if (card.kind === 'surge') d += E.LIMITS.surge;
    if (card.kind === 'overload') d += E.LIMITS.overload;
    if (card.kind === 'stabilize') d += E.LIMITS.blockStabilize;
    if (card.kind === 'num' && card.value === 0) d += E.LIMITS.zero;
    if (overcharge) d += E.LIMITS.overcharge;
    if (m.rule === 'aftershock' && card.kind !== 'num') d += 1;
    if (m.rule === 'low_gravity' && card.kind === 'num' && m.top.kind === 'num' && m.top.value !== card.value) d += card.value < m.top.value ? 1 : -1;
    return d;
  }

  function renderHand(arriving) {
    var m = match(), v = app.view;
    var hand = $('.hand'), inner = $('.hand .inner');
    if (!m.hand) { inner.innerHTML = ''; return; }
    var cards = sortHand(m.hand);
    var legal = {};
    m.legal.forEach(function (id) { legal[id] = 1; });
    var myTurn = m.turn === me() && v.phase === 'playing';
    var keep = {};
    cards.forEach(function (c) { keep[c.id] = 1; });
    app.handEls.forEach(function (node, id) { if (!keep[id]) { node.remove(); app.handEls.delete(id); } });
    var cw = parseFloat(getComputedStyle(hand).getPropertyValue('--cw')) || 100, ch = cw * 1.4;
    var W = hand.clientWidth;
    var n = cards.length;
    var maxSp = cw * 0.8, minSp = isMobile() ? cw * 0.4 : cw * 0.32;
    var sp = n > 1 ? Math.max(minSp, Math.min(maxSp, (W - cw - 40) / (n - 1))) : 0;
    var totalW = cw + sp * (n - 1);
    var innerW = Math.max(W, totalW + 40);
    inner.style.width = innerW + 'px';
    var x0 = (innerW - totalW) / 2;
    var fanStep = Math.min(3, 30 / Math.max(n, 1));
    var innerRect = inner.getBoundingClientRect(), pileRect = $('.pile').getBoundingClientRect();
    var drawnSet = {};
    (m.drawn || []).forEach(function (id) { drawnSet[id] = 1; });
    var showBadges = myTurn && m.phase !== 'attack';
    var anyBadge = false;
    cards.forEach(function (c, i) {
      var node = app.handEls.get(c.id);
      var isNew = !node;
      if (!node) {
        node = el('<button class="hcard" aria-label="' + esc(E.cardName(c)) + '"></button>');
        node.appendChild(cardEl(c));
        node.onclick = (function (id) { return function (ev) { onCardClick(id, node, ev); }; })(c.id);
        node.onmouseenter = function () { if (node.classList.contains('legal')) S.play('hover'); };
        inner.appendChild(node);
        app.handEls.set(c.id, node);
      }
      var off = i - (n - 1) / 2;
      var isLegal = myTurn && legal[c.id];
      var lift = isLegal ? -14 : 0;
      var y = Math.abs(off) * Math.abs(off) * (n > 10 ? 0.3 : 0.8) + lift;
      var x = x0 + sp * i;
      var target = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + (off * fanStep).toFixed(2) + 'deg)';
      node.style.zIndex = String(i + 1);
      node.classList.toggle('legal', !!isLegal);
      node.classList.toggle('dim', myTurn && !legal[c.id]);
      node.classList.toggle('drawnnew', !!drawnSet[c.id] && myTurn);
      node.style.setProperty('--glow', c.color ? A.SUIT_HEX[c.color] : '#fff');
      var what = E.CARD_TYPES[c.kind].short + (c.kind === 'num' && c.value === 0 ? ' Coolant: Meltdown −1.' : '');
      setTip(node, E.cardName(c), what + (myTurn ? (isLegal ? '\n✓ You can play this now.' : '\n✗ ' + whyNot(m, c)) : ''));
      node.style.visibility = '';
      // Meltdown badge: what this play would do to the meter.
      var badge = $('.mbadge', node);
      var d = showBadges && isLegal ? predictDelta(m, c, false) : 0;
      if (d) {
        anyBadge = true;
        var willCollapse = m.meltdown + d >= 10;
        var txt = willCollapse ? '☢ 10' : (d > 0 ? '▲' + d : '▼' + (-d));
        var bc = willCollapse ? '#ffffff' : d > 0 ? '#ff8a5c' : '#5ad8f7';
        if (!badge) { badge = el('<span class="mbadge"></span>'); node.appendChild(badge); }
        badge.textContent = txt;
        badge.style.setProperty('--bc', bc);
      } else if (badge) badge.remove();
      if (isNew && arriving[c.id] != null && !reduced()) {
        var dx = pileRect.left - innerRect.left, dy = pileRect.top - (innerRect.bottom - 12 - ch);
        node.style.transition = 'none';
        node.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(-8deg) scale(.9)';
        node.firstChild.innerHTML = A.back();
        void node.offsetWidth;
        var delay = arriving[c.id] * 70;
        setTimeout(function () {
          node.style.transition = '';
          node.style.transform = target;
          setTimeout(function () { node.firstChild.innerHTML = A.card(c); }, 140);
        }, 16 + delay);
      } else {
        node.style.transform = target;
      }
    });
    if (anyBadge) setTimeout(function () { tip('badges'); }, 1200);
  }

  function renderActions() {
    var m = match(), v = app.view;
    var box = $('.actions');
    box.innerHTML = '';
    if (v.phase !== 'playing') return;
    var mine = m.hand && m.players.some(function (p) { return p.id === me(); });
    var myTurn = m.turn === me();
    if (m.exposed && m.exposed !== me() && v.settings.lastCall && mine) {
      var cb = el('<button class="btn gold pulse">Catch ' + esc(nameOf(m.exposed)) + '!</button>');
      cb.onclick = function () { doCatch(m.exposed); };
      box.appendChild(cb);
      tip('catch');
    }
    if (m.exposed === me()) {
      var sv = el('<button class="btn danger pulse">LAST CARD!</button>');
      sv.onclick = function () { S.play('lastCard'); send({ type: 'call' }); };
      box.appendChild(sv);
    }
    if (!mine) return;
    if (myTurn && m.hand.length === 2 && v.settings.lastCall && !m.exposed) {
      var lc = el('<button class="btn ' + (app.armedCall ? 'armed' : 'ghost pulse') + '">' + (app.armedCall ? 'LAST CARD ✓' : 'LAST CARD') + '</button>');
      setTip(lc, 'Last card', 'Press before playing your second-to-last card, or anyone can catch you and make you draw 2. (L)');
      lc.onclick = function () { app.armedCall = !app.armedCall; S.play(app.armedCall ? 'lastCard' : 'select'); renderActions(); };
      box.appendChild(lc);
      tip('lastcard');
    }
    var label = 'Draw', cls = '', n = 1;
    if (myTurn && m.phase === 'attack') { label = 'Take'; cls = 'danger'; n = m.stack; }
    if (myTurn && m.phase === 'drawn') { label = 'Keep & end turn'; cls = 'ghost'; n = 0; }
    var db = el('<button class="btn ' + cls + ' drawbtn">' + (n ? ICON.card : '') + '<span>' + label + '</span>' + (n ? '<i class="n">' + n + '</i>' : '') + '</button>');
    db.disabled = !myTurn;
    if (myTurn && m.phase === 'turn' && !m.legal.length) db.classList.add('pulse');
    db.onclick = function () { doDraw(); };
    setTip(db, label === 'Take' ? 'Take the attack' : label === 'Draw' ? 'Draw a card' : 'Keep the card', !myTurn ? 'Wait for your turn.' : m.phase === 'attack' ? 'Take all ' + m.stack + ' cards and end your turn.' : m.phase === 'drawn' ? 'Keep the drawn card and end your turn.' : 'Draw one card (D or Space). If it can be played, you may play it.');
    box.appendChild(db);
  }

  function renderStatus() {
    var m = match(), v = app.view;
    var st = $('.status');
    var put = function (tone, head, sub) { st.className = 'status ' + tone; st.innerHTML = '<div class="head"><i></i><span>' + head + '</span>' + (v.deadline && v.phase === 'playing' ? ' <span class="secs"></span>' : '') + '</div>' + (sub ? '<div class="sub">' + sub + '</div>' : ''); };
    if (v.phase === 'ended') { put('go', '<b>' + esc(nameOf(m.winner)) + '</b> ' + (m.winner === me() ? 'win!' : 'wins'), 'Match over.'); return; }
    if (m.turn !== me()) {
      put('wait', 'Waiting for <b>' + esc(nameOf(m.turn)) + '</b>', m.phase === 'attack' ? 'They are facing <b style="color:var(--crimson)">+' + m.stack + '</b>.' : 'Watch the table — your turn is coming.');
      return;
    }
    var top = m.top;
    if (m.phase === 'attack') {
      put('bad', 'Incoming <b>+' + m.stack + '</b>', 'Counter with an attack, block with Stabilize (take ' + Math.floor(m.stack / 2) + '), or take ' + m.stack + '.');
      tip('attack');
    } else if (m.phase === 'drawn') {
      put('go', 'Playable draw', 'Play the card you drew, or keep it.');
      tip('drawn');
    } else if (!m.legal.length) {
      put('go', 'Your turn', 'No playable cards — draw.');
    } else {
      var what = m.rule === 'color_lock' ? SUIT_NAME[m.color] + ' only (Color Lock)' : SUIT_NAME[m.color] + ' or ' + (top.kind === 'num' ? top.value : A.LABEL[top.kind].toLowerCase());
      if (m.rule === 'odd_world') what += ' · odd numbers only';
      if (m.rule === 'echo' && top.kind === 'num') what += ' · or ' + [top.value - 1, top.value + 1].filter(function (x) { return x >= 0 && x <= 9; }).join('/') + ' any color';
      put('go', 'Your turn', 'Play ' + what + ', or draw.');
    }
  }

  // ───────────── input ─────────────
  function whyNot(m, card) {
    var v = app.view;
    if (v.phase !== 'playing') return 'The match is over.';
    if (m.turn !== me()) return 'It’s ' + nameOf(m.turn) + '’s turn.';
    if (m.phase === 'attack') return E.isAttack(card) && m.stack >= E.LIMITS.stackCap ? 'The attack stack is at its cap of 10 — it can’t grow. Block or take it.' : 'You’re under attack: only Surge, Overload or Stabilize — or take the cards.';
    if (m.phase === 'drawn') return 'After drawing you can only play the card you drew.';
    if (m.rule === 'odd_world' && card.kind === 'num' && card.value % 2 === 0) return 'Odd World: even numbers can’t be played.';
    if (m.rule === 'color_lock') return 'Color Lock: you must match ' + SUIT_NAME[m.color] + '.';
    var top = m.top;
    return 'Doesn’t match — play ' + SUIT_NAME[m.color] + ', ' + (top.kind === 'num' ? 'a ' + top.value : 'a ' + A.LABEL[top.kind].toLowerCase()) + ', or a Wild.';
  }

  function onCardClick(id, node) {
    S.unlock();
    var m = match();
    if (!m || !m.hand) return;
    var card = m.hand.filter(function (c) { return c.id === id; })[0];
    if (!card) return;
    if (m.legal.indexOf(id) < 0) {
      S.play('error');
      node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake');
      toast(esc(whyNot(m, card)), 'bad', 4500);
      return;
    }
    S.play('select');
    if (E.isWild(card) || E.isAttack(card)) { openChooser(card, node); return; }
    playCard(card, {});
  }

  function playCard(card, o) {
    var m = match();
    closeChooser();
    var cmd = { type: 'play', card: card.id, color: o.color, overcharge: !!o.overcharge, call: app.armedCall && m.hand.length === 2, v: m.version };
    app.armedCall = false;
    send(cmd).then(function (r) {
      if (r && r.error) {
        if (r.error !== 'stale') { S.play('error'); toast(esc(r.error), 'bad'); }
        var n = app.handEls.get(card.id); if (n) n.style.visibility = '';
      }
    });
  }

  function openChooser(card, anchor) {
    closeChooser();
    var m = match();
    var wild = E.isWild(card), attack = E.isAttack(card);
    var counts = { cyan: 0, crimson: 0, gold: 0, violet: 0 };
    m.hand.forEach(function (c) { if (c.color && c.id !== card.id) counts[c.color]++; });
    var state = { overcharge: false };
    var ch = el('<div class="chooser panel" role="dialog" aria-label="Play ' + esc(E.cardName(card)) + '"></div>');
    var draw = function () {
      var d = predictDelta(m, card, state.overcharge);
      var after = Math.max(0, m.meltdown + d);
      var warn = after >= 10 ? '<div class="note" style="color:#fff"><b>☢ Triggers the Collapse:</b> ' + esc(E.COLLAPSES[m.nextCollapse].name) + ' — ' + esc(E.COLLAPSES[m.nextCollapse].text) + '</div>'
        : d ? '<div class="note">Meltdown ' + m.meltdown + ' → <b>' + after + '</b></div>' : '';
      var html = '<div class="label">' + esc(E.cardName(card)) + '</div>';
      if (attack) {
        var base = E.CARD_TYPES[card.kind].attack + (m.stage >= 2 ? 1 : 0) + (m.chainBonus || 0);
        html += '<button class="toggle ' + (state.overcharge ? 'on' : '') + '"><span class="sw"></span><span><b>Overcharge</b><span>+1 card on the stack and Meltdown +1</span></span></button>' +
          '<div class="note">Sends <b>+' + Math.min(E.LIMITS.stackCap, m.stack + base + (state.overcharge ? 1 : 0)) + '</b> to ' + esc(nameOf(nextPlayerId())) + (m.stage >= 2 ? ' (Breaking +1)' : '') + (m.chainBonus ? ' (Chain +' + m.chainBonus + ')' : '') + '.</div>';
      }
      if (wild) {
        html += '<div class="colors">' + E.SUITS.map(function (s) { return '<button data-c="' + s + '" style="--sw:' + A.SUIT_HEX[s] + '">' + SUIT_NAME[s] + '<small>' + counts[s] + ' in hand</small></button>'; }).join('') + '</div>';
        if (m.rule === 'mirror' || (card.kind === 'wildrift' && m.nextRule === 'mirror')) html += '<div class="note">Mirror: the color you pick flips to its opposite when your turn ends.</div>';
        if (card.kind === 'wildrift') html += '<div class="note">Reality shifts to <b>' + esc(E.RULES[m.nextRule].name) + '</b>: ' + esc(E.RULES[m.nextRule].text) + '</div>';
      } else {
        html += '<button class="btn primary playit">Play ' + esc(A.LABEL[card.kind]) + '</button>';
      }
      html += warn;
      ch.innerHTML = html;
      var tg = $('.toggle', ch);
      if (tg) tg.onclick = function () { state.overcharge = !state.overcharge; S.play(state.overcharge ? 'meltUp' : 'select', { level: m.meltdown }); draw(); };
      $$('.colors button', ch).forEach(function (b) { b.onclick = function () { S.play('color', { color: b.dataset.c }); playCard(card, { color: b.dataset.c, overcharge: state.overcharge }); }; });
      var pb = $('.playit', ch); if (pb) pb.onclick = function () { playCard(card, { overcharge: state.overcharge }); };
    };
    draw();
    document.body.appendChild(ch);
    var r = anchor.getBoundingClientRect(), cr = ch.getBoundingClientRect();
    ch.style.left = Math.max(12, Math.min(window.innerWidth - cr.width - 12, r.left + r.width / 2 - cr.width / 2)) + 'px';
    ch.style.top = Math.max(60, r.top - cr.height - 16) + 'px';
    app.chooser = ch;
    setTimeout(function () { document.addEventListener('pointerdown', outside, true); }, 0);
  }
  function outside(e) { if (app.chooser && !app.chooser.contains(e.target) && !e.target.closest('.hcard')) closeChooser(); }
  function closeChooser() { if (app.chooser) { app.chooser.remove(); app.chooser = null; } document.removeEventListener('pointerdown', outside, true); }
  function nextPlayerId() { var m = match(), ids = m.players.map(function (p) { return p.id; }), i = ids.indexOf(m.turn); return ids[(i + m.dir + ids.length) % ids.length]; }

  function doDraw() {
    S.unlock();
    var m = match(), v = app.view;
    if (!m || v.phase !== 'playing' || m.turn !== me()) return;
    closeChooser();
    var cmd = m.phase === 'drawn' ? { type: 'pass', v: m.version } : { type: 'draw', v: m.version };
    S.play(m.phase === 'drawn' ? 'select' : 'draw');
    send(cmd).then(function (r) { if (r && r.error && r.error !== 'stale') { S.play('error'); toast(esc(r.error), 'bad'); } });
  }
  function doCatch(id) {
    S.unlock();
    send({ type: 'catch', target: id }).then(function (r) { if (r && r.error) toast(esc(r.error), 'bad'); });
  }

  document.addEventListener('keydown', function (e) {
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'Escape') { closeChooser(); closeModal(); setLog(false); return; }
    if (app.screen !== 'game' || !match()) return;
    var k = e.key.toLowerCase();
    if (k === 'd' || k === ' ') { e.preventDefault(); doDraw(); }
    if (k === 'l') { var m = match(); if (m.exposed === me()) send({ type: 'call' }); else if (m.turn === me() && m.hand && m.hand.length === 2) { app.armedCall = !app.armedCall; S.play('lastCard'); renderActions(); } }
    if (k === 'c' && match().exposed && match().exposed !== me()) doCatch(match().exposed);
    if (k === 'r') showRules();
    if (k === 'm') { S.setPref('muted', !S.prefs.muted); updateMute(); }
  });
  var resizeT;
  window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(function () { if (app.screen === 'game' && app.view && app.view.match) renderGame([]); }, 120); });

  // ───────────── events → words, sounds, motion ─────────────
  function eventText(e) {
    var n = function (id) { return '<b>' + esc(nameOf(id)) + '</b>'; };
    switch (e.t) {
      case 'play': return { text: n(e.pid) + ' played ' + esc(E.cardName(e.card)) + (E.isWild(e.card) ? ' → ' + SUIT_NAME[e.color] : '') + (e.overcharge ? ' (overcharged)' : '') };
      case 'stack': return { text: '<span class="big">+' + e.add + '</span>' + n(e.pid) + (e.counter ? ' counters' : ' attacks') + ' → ' + n(e.target) + ' · stack ' + e.total + (e.bonus.length ? ' (' + e.bonus.map(function (b) { return { overcharge: 'overcharged', breaking: 'Breaking +1', chain: 'Chain +2' }[b]; }).join(', ') + ')' : '') + (e.capped ? ' · capped at 10' : ''), cls: 'bad' };
      case 'accept': return { text: n(e.pid) + ' take' + (e.pid === me() ? '' : 's') + ' ' + e.n + ' card' + (e.n === 1 ? '' : 's'), cls: 'bad' };
      case 'block': return { text: n(e.pid) + ' block' + (e.pid === me() ? '' : 's') + ' with Stabilize — take' + (e.pid === me() ? '' : 's') + ' ' + e.took + ' of ' + e.from, cls: 'down' };
      case 'skip': return { text: n(e.target) + (e.target === me() ? ' are' : ' is') + ' skipped' };
      case 'reverse': return { text: 'Turn order reversed' };
      case 'color': return e.cause === 'mirror' ? { text: 'Mirror: the color flips to <b>' + SUIT_NAME[e.color] + '</b>' } : e.cause === 'wild' ? { text: 'Color → <b>' + SUIT_NAME[e.color] + '</b>' } : null;
      case 'meltdown':
        if (e.reset) return { text: '<span class="big">MELTDOWN 3</span>reset after the Collapse', cls: 'down' };
        if (!e.delta) return e.reasons.length && e.parts.some(function (p) { return p[0]; }) ? { text: 'Meltdown holds at ' + e.to + ' — ' + esc(e.reasons.join(', ')) } : null;
        return { text: '<span class="big">MELTDOWN ' + (e.delta > 0 ? '+' : '−') + Math.abs(e.delta) + '</span>' + esc(e.reasons.join(', ')) + ' · now ' + e.to, cls: e.delta > 0 ? 'up' : 'down' };
      case 'rift': return { text: '<span class="big">REALITY SHIFTED</span>' + esc(E.RULES[e.to].name) + (e.cause === 'fracture' ? ' (Reality Fracture)' : '') };
      case 'collapse': return { text: '<span class="big">COLLAPSE</span>' + esc(E.COLLAPSES[e.event].name) + ' — caused by ' + n(e.by), cls: 'bad' };
      case 'draw':
        if (e.reason === 'hot_potato') return { text: 'Hot Potato: ' + n(e.pid) + ' draw' + (e.pid === me() ? '' : 's') + ' 1 more' };
        if (e.reason === 'spotlight') return { text: 'Spotlight: ' + n(e.pid) + ' draw' + (e.pid === me() ? '' : 's') + ' ' + e.n };
        if (e.reason === 'turn') return { text: n(e.pid) + ' drew a card', quiet: true };
        if (e.asked > e.n) return { text: n(e.pid) + ' could only draw ' + e.n + ' (hand limit or empty piles)' };
        return null;
      case 'call': return { text: n(e.pid) + (e.late ? ' called LAST CARD just in time' : ': LAST CARD!'), cls: 'up' };
      case 'exposed': return { text: n(e.pid) + ' forgot to call LAST CARD — catch them!', cls: 'bad' };
      case 'caught': return { text: 'Caught! ' + n(e.pid) + ' draw' + (e.pid === me() ? '' : 's') + ' 2 (' + n(e.by) + ')', cls: 'bad' };
      case 'timeout': return { text: 'Time’s up — ' + n(e.pid) + ' draw' + (e.pid === me() ? '' : 's') };
      case 'reshuffle': return { text: 'The discard pile was shuffled into a new draw pile' };
      case 'win': return { text: '<span class="big">WINNER</span>' + n(e.pid) + (e.reason === 'turn-limit' ? ' (fewest cards at the turn limit)' : '') };
      case 'pass': return { text: n(e.pid) + ' kept the card', quiet: true };
      default: return null;
    }
  }

  function runFx(events, sources) {
    var m = match();
    var t = 0;
    var later = function (fn, d) { setTimeout(fn, d); };
    var flights = 0;
    var discRect = $('.discard').getBoundingClientRect();
    events.forEach(function (e) {
      var txt = eventText(e);
      if (txt) log(txt.text, e);
      var notify = txt && !txt.quiet;
      switch (e.t) {
        case 'play': {
          var src = sources[e.seq];
          var delay = flights++ * 160;
          later(function () { flyCard(e.card, src, discRect, function () { landPlay(e); }); }, delay);
          if (e.pid !== me() && E.isWild(e.card)) later(function () { toast(txt.text, ''); }, delay + 260);
          t = Math.max(t, delay + 280);
          notify = false;
          break;
        }
        case 'stack':
          later(function () { beam(e.pid, e.target); S.play(e.counter ? 'counter' : 'attack', { big: e.add >= 4 }); shakeSeat(e.target); }, t + 60);
          break;
        case 'block': later(function () { S.play('block'); }, t + 60); break;
        case 'skip': later(function () { S.play('skip'); stamp(e.target, 'skip'); }, t + 80); break;
        case 'reverse': later(function () { S.play('reverse'); }, t + 80); break;
        case 'color': if (e.cause === 'wild' || e.cause === 'mirror') later(function () { ripple(A.SUIT_HEX[e.color]); if (e.cause === 'mirror') S.play('color', { color: e.color }); }, t + 120); break;
        case 'meltdown':
          later(function () {
            if (e.delta > 0) S.play('meltUp', { level: e.to }); else if (e.delta < 0 && !e.reset) S.play('meltDown');
            pulseSegments();
          }, t + 160);
          if (e.stageTo != null && e.stageTo > e.stageFrom && !e.reset) {
            later(function () {
              var st = E.STAGES[e.stageTo];
              toast('<span class="big">' + st.name.toUpperCase() + '</span>' + esc(st.text), 'up', 6000);
              S.play(e.stageTo === 2 ? 'breaking' : 'critical');
              tip(e.stageTo === 2 ? 'breaking' : 'critical');
            }, t + 380);
          }
          if (e.to >= 8 && e.delta > 0 && !e.reset) later(function () { toast('Collapse is close: at 10 → <b>' + esc(E.COLLAPSES[m.nextCollapse].name) + '</b>', 'up'); }, t + 600);
          break;
        case 'rift':
          queueOverlay('rift', e);
          notify = false;
          break;
        case 'collapse':
          queueOverlay('collapse', e);
          notify = false;
          break;
        case 'draw':
          if (e.pid !== me()) later(function () { flyBacks(e.pid, e.n); }, t);
          later(function () { S.play('draw', { n: e.n }); }, t);
          break;
        case 'call': later(function () { S.play('lastCard'); }, t); break;
        case 'exposed': later(function () { S.play('exposed'); }, t); break;
        case 'caught': later(function () { S.play('caught'); shakeSeat(e.pid); }, t); break;
        case 'turn':
          if (e.pid === me() && app.view.phase === 'playing' && app.myTurnSeen !== e.seq) {
            app.myTurnSeen = e.seq;
            later(function () { S.play('turn'); if (e.phase === 'attack') S.play('exposed'); tip('yourturn'); }, t + 220);
          }
          break;
        case 'win':
          later(function () {
            var won = e.pid === me();
            S.play(won ? 'victory' : 'defeat');
            S.music('off');
            if (won) shards();
            if (hub) hub.report('session-end', { result: won ? 'win' : 'lose', players: m.players.length, mode: app.net.kind });
          }, t + 300);
          notify = false;
          break;
      }
      if (notify) later(function () { toast(txt.text, txt.cls); }, t + 120);
    });
    if (m.stage !== app.lastStage) { app.lastStage = m.stage; S.setStage(m.stage); }
  }

  function landPlay(e) {
    var disc = $$('.discard .cardel');
    disc.forEach(function (c) { c.style.opacity = ''; });
    S.play('place', { pitch: e.card.value || 0 });
    if (!reduced()) {
      var top = disc[disc.length - 1];
      if (top && top.animate) top.animate([{ transform: top.style.transform + ' scale(1.12)' }, { transform: top.style.transform }], { duration: 220, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    }
  }

  function flyCard(card, from, toRect, done) {
    if (!from || reduced() || !document.body.animate) { done(); return; }
    var f = document.createElement('div');
    f.className = 'flycard';
    var w = toRect.width, h = toRect.height;
    f.style.cssText = 'left:' + toRect.left + 'px;top:' + toRect.top + 'px;width:' + w + 'px;height:' + h + 'px';
    var ce = cardEl(card); ce.style.width = '100%'; ce.style.height = '100%';
    f.appendChild(ce);
    document.body.appendChild(f);
    var sx = from.left + from.width / 2 - (toRect.left + w / 2), sy = from.top + from.height / 2 - (toRect.top + h / 2);
    var s0 = Math.max(0.4, from.width / w);
    var anim = f.animate([
      { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(' + s0 + ') rotate(-6deg)', opacity: 1 },
      { transform: 'translate(' + (sx * 0.3) + 'px,' + (sy * 0.3 - 16) + 'px) scale(1.05) rotate(2deg)', opacity: 1, offset: 0.65 },
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 }
    ], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
    anim.onfinish = function () { f.remove(); done(); };
  }

  function flyBacks(pid, n) {
    if (reduced() || !document.body.animate) return;
    var from = $('.pile').getBoundingClientRect(), to = seatRect(pid);
    if (!to) return;
    for (var i = 0; i < Math.min(4, n); i++) {
      (function (i) {
        setTimeout(function () {
          var f = document.createElement('div'); f.className = 'flycard';
          f.style.cssText = 'left:' + from.left + 'px;top:' + from.top + 'px;width:' + from.width + 'px;height:' + from.height + 'px';
          var ce = cardEl(null); ce.style.width = '100%'; ce.style.height = '100%'; f.appendChild(ce);
          document.body.appendChild(f);
          var dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
          f.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.3) rotate(20deg)', opacity: 0.4 }], { duration: 380, easing: 'cubic-bezier(.4,0,.2,1)' }).onfinish = function () { f.remove(); };
        }, i * 70);
      })(i);
    }
  }

  function beam(fromId, toId) {
    var a = seatRect(fromId), b = seatRect(toId);
    if (!a || !b || reduced()) return;
    var x1 = a.left + a.width / 2, y1 = a.top + a.height / 2, x2 = b.left + b.width / 2, y2 = b.top + b.height / 2;
    var len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    var bm = document.createElement('div'); bm.className = 'beam';
    bm.style.cssText = 'left:' + x1 + 'px;top:' + y1 + 'px;width:' + len + 'px;transform:rotate(' + ang + 'deg) scaleX(0)';
    document.body.appendChild(bm);
    bm.animate([{ transform: 'rotate(' + ang + 'deg) scaleX(0)', opacity: 1 }, { transform: 'rotate(' + ang + 'deg) scaleX(1)', opacity: 1, offset: 0.5 }, { transform: 'rotate(' + ang + 'deg) scaleX(1)', opacity: 0 }], { duration: 520, easing: 'ease-out' }).onfinish = function () { bm.remove(); };
  }
  function shakeSeat(id) {
    var s = id === me() ? $('.me-badge') : $('.seat-el[data-id="' + id + '"]');
    if (!s || reduced() || !s.animate) return;
    s.animate([{ translate: '0 0' }, { translate: '-5px 0' }, { translate: '5px 0' }, { translate: '-3px 0' }, { translate: '0 0' }], { duration: 360 });
  }
  function stamp(id, kind) {
    var r = seatRect(id);
    if (!r) return;
    var s = el('<div style="position:fixed;z-index:72;pointer-events:none;width:54px;height:54px;color:#fff;filter:drop-shadow(0 0 10px #fff)">' + A.glyph(kind) + '</div>');
    s.style.left = (r.left + r.width / 2 - 27) + 'px'; s.style.top = (r.top + r.height / 2 - 27) + 'px';
    document.body.appendChild(s);
    (s.animate ? s.animate([{ transform: 'scale(2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.3 }, { transform: 'scale(1)', opacity: 0 }], { duration: 900 }) : { onfinish: null }).onfinish = function () { s.remove(); };
    if (!s.animate) setTimeout(function () { s.remove(); }, 900);
  }
  function ripple(color) {
    if (reduced()) return;
    var r = $('.discard').getBoundingClientRect();
    var d = el('<div class="ripple"></div>');
    d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = (r.top + r.height / 2) + 'px'; d.style.setProperty('--rc', color);
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 820);
  }
  function pulseSegments() {
    var dial = $('.meter .dial');
    if (!dial || reduced() || !dial.animate) return;
    dial.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
  }
  function shards() {
    if (reduced()) return;
    var cols = [A.SUIT_HEX.cyan, A.SUIT_HEX.crimson, A.SUIT_HEX.gold, A.SUIT_HEX.violet, '#fff'];
    for (var i = 0; i < 28; i++) {
      var s = document.createElement('div'); s.className = 'shard';
      s.style.background = cols[i % cols.length];
      s.style.left = (window.innerWidth / 2) + 'px'; s.style.top = (window.innerHeight * 0.45) + 'px';
      document.body.appendChild(s);
      var ang = Math.random() * Math.PI * 2, dist = 160 + Math.random() * 420;
      s.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(' + Math.cos(ang) * dist + 'px,' + (Math.sin(ang) * dist + 220) + 'px) rotate(' + (Math.random() * 720) + 'deg)', opacity: 0 }], { duration: 1400 + Math.random() * 800, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = (function (x) { return function () { x.remove(); }; })(s);
    }
  }

  function dealFx() {
    S.play('deal');
    var m = match();
    if (m && m.players) m.players.forEach(function (p) { if (p.id !== me()) flyBacks(p.id, 3); });
  }

  // Rift / Collapse announcements: brief, dramatic, skippable with a click; shown one at a time.
  function queueOverlay(kind, e) { app.overlayQueue.push({ kind: kind, e: e }); runOverlay(); }
  function runOverlay() {
    if (app.overlayBusy || !app.overlayQueue.length) return;
    var item = app.overlayQueue.shift();
    app.overlayBusy = true;
    var e = item.e, html, dur;
    if (item.kind === 'rift') {
      var r = E.RULES[e.to], nx = E.RULES[e.next];
      html = '<div class="kicker">' + (e.cause === 'fracture' ? 'Reality Fracture' : 'New Reality Rule') + '</div><span class="badge">' + A.ruleGlyph(r.glyph) + '</span><div class="name">' + esc(r.name) + '</div><div class="desc">' + esc(r.text) + '</div>' +
        '<div class="sub">' + (e.cause === 'card' ? esc(nameOf(e.by)) + ' opened a Rift · Meltdown +1' : 'The Collapse tore reality') + (nx ? ' · Next Rift: ' + esc(nx.name) : '') + '</div>';
      dur = 3800;
      S.play('rift'); S.stinger('rift');
      setTimeout(function () { S.play('rule'); }, 650);
    } else {
      var c = E.COLLAPSES[e.event];
      html = '<div class="kicker">Meltdown 10 · Collapse</div><span class="badge">' + A.ruleGlyph(e.event) + '</span><div class="name">' + esc(c.name) + '</div><div class="desc">' + esc(c.text) + '</div><div class="sub">Caused by ' + esc(nameOf(e.by)) + ' · Meltdown resets to 3</div>';
      dur = 4500;
      S.play('collapse'); S.stinger('collapse');
      if (!reduced()) {
        var g = $('.game'); if (g) { g.classList.remove('shakeit'); void g.offsetWidth; g.classList.add('shakeit'); }
      }
    }
    var o = el('<div class="shift-overlay ' + item.kind + '"><div class="veil"></div>' +
      '<div class="content panel">' + html + '<div class="skip">Tap to continue</div></div></div>');
    document.body.appendChild(o);
    if (item.kind === 'rift') { var rp = $('.rulepanel'); if (rp) { rp.classList.remove('shift'); void rp.offsetWidth; rp.classList.add('shift'); } }
    var closed = false;
    var close = function () {
      if (closed) return; closed = true;
      o.classList.add('out');
      setTimeout(function () { o.remove(); app.overlayBusy = false; runOverlay(); nextTip(); }, 300);
    };
    o.onclick = close;
    setTimeout(close, dur);
  }

  // ───────────── results ─────────────
  function showResults() {
    var v = app.view, m = v.match;
    if (!m || v.phase !== 'ended') return;
    var won = m.winner === me();
    var host = v.canHost;
    var hands = {};
    (m.hands || []).forEach(function (h) { hands[h.id] = h.cards; });
    var rows = m.ranking.map(function (r, i) {
      var st = (m.stats || {})[r.id] || {};
      var info = seatInfo(r.id) || {};
      var left = (hands[r.id] || []).slice(0, 12).map(function (c) { return '<div class="cardel">' + A.card(c) + '</div>'; }).join('');
      return '<div class="rrow ' + (i === 0 ? 'first' : '') + '"><div class="pos">' + (i + 1) + '</div><div class="avatar">' + avatarSvg(r.id) + '</div>' +
        '<div><div><b>' + esc(nameOf(r.id)) + '</b>' + (info.wins ? ' <span class="chip">★ ' + info.wins + '</span>' : '') + '</div><div class="st">' +
        (i === 0 ? 'Emptied their hand' : r.cards + ' card' + (r.cards === 1 ? '' : 's') + ' left') + ' · played ' + (st.played || 0) + ' · sent ' + (st.attacked || 0) + ' attack cards · ' + (st.rifts || 0) + ' rift' + (st.rifts === 1 ? '' : 's') + (st.collapses ? ' · ' + st.collapses + ' collapse' + (st.collapses === 1 ? '' : 's') : '') + '</div></div>' +
        '<div class="left">' + left + '</div></div>';
    }).join('');
    var mm = modal('<div class="crown ' + (won ? 'win' : '') + '">' + (won ? 'VICTORY' : esc(nameOf(m.winner)) + ' WINS') + '</div>' +
      '<div class="subt">' + (m.endReason === 'turn-limit' ? 'Turn limit reached — fewest cards wins.' : 'Round ' + v.round + ' · ' + m.turnCount + ' turns') + '</div>' +
      '<div class="rank">' + rows + '</div>' +
      '<div class="btns">' + (host ? '<button class="btn primary again">Rematch</button><button class="btn ghost lobby">Change settings</button>' : '<div class="label">Waiting for the host to start a rematch…</div>') +
      '<button class="btn ghost leave">Leave</button></div>', { cls: 'results', noClose: true });
    var ag = $('.again', mm); if (ag) ag.onclick = function () { S.play('confirm'); S.music('game'); send({ type: 'start' }); };
    var lb = $('.lobby', mm); if (lb) lb.onclick = function () { S.play('select'); send({ type: 'lobby' }); };
    $('.leave', mm).onclick = function () { closeModal(); leaveNet(); show('title'); };
  }

  // ───────────── rules, tutorial, settings ─────────────
  function showRules() {
    var m = match();
    var pool = m ? m.pool : E.RULE_POOL;
    var q = m ? m.queue : [];
    var rc = function (id, extra) { var r = E.RULES[id]; return '<div class="rulecard ' + (m && m.rule === id ? 'now' : '') + '">' + A.ruleGlyph(r.glyph) + '<div>' + (extra || '') + '<b>' + esc(r.name) + '</b><span>' + esc(r.text) + '</span></div></div>'; };
    var html = '<h2>Rules</h2>' +
      (m ? '<h3>This match’s Reality pool</h3><p>Six of the nine rules are in play this match. Rifts move through them in this order (the queue reshuffles when it runs out).</p><div class="rulegrid">' +
        rc(m.rule, '<em>Now</em>') + q.map(function (id, i) { return rc(id, '<em>' + (i === 0 ? 'Next' : 'Then') + '</em>'); }).join('') + '</div>' : '') +
      '<h3>A turn</h3><p>Play a card that matches the active <b>color</b>, the top <b>number</b> or the top <b>symbol</b> — or a Wild. Otherwise draw one; if it’s playable you may play it. Empty your hand to win.</p>' +
      '<h3>Attacks</h3><p>Surge (+2) and Overload (+4) build an attack stack against the next player. Facing it you may <b>counter</b> with any attack, <b>block</b> with any Stabilize (take half, rounded down) or <b>take</b> it. Overcharge an attack for +1 card and +1 Meltdown. The stack caps at 10.</p>' +
      '<h3>Meltdown</h3><table>' + E.STAGES.map(function (s) { return '<tr><td>' + s.name + ' ' + s.min + '–' + s.max + '</td><td>' + esc(s.text) + '</td></tr>'; }).join('') +
      '<tr><td>Collapse 10</td><td>The announced Collapse Event happens, then Meltdown resets to 3.</td></tr></table>' +
      '<p><b>Raises:</b> Rift / Wild Rift +1, Surge +1, Overload +1, Overcharge +1, Aftershock and Low Gravity rules. <b>Lowers:</b> Stabilize −2, any 0 −1, Low Gravity (playing higher) −1.</p>' +
      '<h3>Collapse Events</h3><table>' + Object.keys(E.COLLAPSES).map(function (k) { var c = E.COLLAPSES[k]; return '<tr><td>' + c.name + (m && m.nextCollapse === k ? ' <span class="chip">next</span>' : '') + '</td><td>' + esc(c.text) + '</td></tr>'; }).join('') + '</table>' +
      '<h3>Cards</h3><table>' + ['skip', 'reverse', 'surge', 'stabilize', 'rift', 'wild', 'overload', 'wildrift'].map(function (k) { return '<tr><td>' + E.CARD_TYPES[k].name + '</td><td>' + esc(E.CARD_TYPES[k].short) + '</td></tr>'; }).join('') + '<tr><td>0</td><td>Coolant: Meltdown −1.</td></tr></table>' +
      '<h3>Last card</h3><p>Press <b>LAST CARD</b> before playing your second-to-last card. If you forget, anyone can catch you (you draw 2) until the next player finishes their turn.</p>' +
      '<h3>All Reality Rules</h3><div class="rulegrid">' + E.RULE_POOL.map(function (id) { return rc(id, pool.indexOf(id) < 0 && m ? '<em style="color:var(--ink3)">not this match</em>' : ''); }).join('') + '</div>' +
      '<p style="margin-top:16px;font-size:12px;color:var(--ink3)">Keys: D or Space draw · L last card · C catch · R rules · M mute · Esc close</p>';
    modal(html);
  }

  var TUT = [
    { t: 'Empty your hand', p: 'Match the active color, the top number or the top symbol. Wilds go on anything. First to empty their hand wins.', cards: [{ kind: 'num', color: 'cyan', value: 5 }, { kind: 'num', color: 'gold', value: 5 }, { kind: 'skip', color: 'gold' }, { kind: 'wild' }] },
    { t: 'Attacks stack', p: 'Surge sends +2, Overload +4 to the next player. They can counter with any attack, block with Stabilize (take half), or take the cards. The stack caps at 10.', cards: [{ kind: 'surge', color: 'crimson' }, { kind: 'overload' }, { kind: 'stabilize', color: 'cyan' }] },
    { t: 'Reality bends', p: 'One Reality Rule is always active and shown on the table, with the next one beneath it. A Rift card shifts reality to that next rule.', cards: [{ kind: 'rift', color: 'violet' }, { kind: 'wildrift' }], rules: ['odd_world', 'echo'] },
    { t: 'Watch the Meltdown', p: 'Rifts and attacks push the shared meter up; Stabilize and 0s cool it. At 4 Rifts play on anything; at 7 every attack hits +1 harder.', cards: [{ kind: 'num', color: 'cyan', value: 0 }, { kind: 'stabilize', color: 'gold' }], meter: true },
    { t: 'Collapse at 10', p: 'The next Collapse Event is always announced. When the meter fills it happens — Shockwave, Gravity Well, Reality Fracture or Chain Reaction — then Meltdown resets to 3. Push it when it helps you.', collapse: true },
    { t: 'Call your last card', p: 'Press LAST CARD before you play your second-to-last card. Forget, and anyone can catch you for 2 until the next player finishes their turn.', cards: [{ kind: 'num', color: 'violet', value: 9 }] }
  ];
  function showTutorial() {
    var i = 0;
    var box = el('<div class="tut"></div>');
    var draw = function () {
      var s = TUT[i];
      var stage = (s.cards || []).map(function (c) { return '<div class="cardel">' + A.card(c) + '</div>'; }).join('');
      if (s.rules) stage += s.rules.map(function (r) { var R = E.RULES[r]; return '<div class="rulecard" style="max-width:200px">' + A.ruleGlyph(R.glyph) + '<div><b>' + R.name + '</b><span>' + esc(R.text) + '</span></div></div>'; }).join('');
      if (s.meter) stage += '<svg viewBox="-100 -100 200 200" style="width:130px;height:130px">' + ringSvg(5) + '</svg>';
      if (s.collapse) stage += Object.keys(E.COLLAPSES).map(function (k) { var c = E.COLLAPSES[k]; return '<div class="rulecard" style="max-width:160px">' + A.ruleGlyph(k) + '<div><b>' + c.name + '</b><span>' + esc(c.text) + '</span></div></div>'; }).join('');
      box.innerHTML = '<div class="label">How to play · ' + (i + 1) + ' / ' + TUT.length + '</div><h2>' + esc(s.t) + '</h2><p>' + esc(s.p) + '</p><div class="stage">' + stage + '</div>' +
        '<div class="dots">' + TUT.map(function (_, k) { return '<i class="' + (k === i ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
        '<div class="nav"><button class="btn ghost prev"' + (i ? '' : ' disabled') + '>Back</button>' +
        (i < TUT.length - 1 ? '<button class="btn primary nextb">Next</button>' : '<span class="row" style="display:flex;gap:8px"><button class="btn ghost done">Got it</button><button class="btn primary prac">Practice match</button></span>') + '</div>';
      $('.prev', box).onclick = function () { S.play('select'); i--; draw(); };
      var nb = $('.nextb', box); if (nb) nb.onclick = function () { S.play('select'); i++; draw(); };
      var dn = $('.done', box); if (dn) dn.onclick = function () { S.play('confirm'); closeModal(); };
      var pr = $('.prac', box); if (pr) pr.onclick = function () { S.play('confirm'); closeModal(); if (app.screen !== 'game') startOffline({ start: true, practice: true, settings: { seats: 3, botLevel: 'easy', botSpeed: 'relaxed', turnTimer: 0, lastCall: true } }); };
    };
    draw();
    modal(box);
  }

  function showSettings() {
    var html = '<h2>Settings</h2><div class="settingsgrid">' +
      '<div class="row"><span class="label">Music</span><input type="range" min="0" max="1" step="0.05" class="mus" value="' + S.prefs.music + '"></div>' +
      '<div class="row"><span class="label">Sound effects</span><input type="range" min="0" max="1" step="0.05" class="sfx" value="' + S.prefs.sfx + '"></div>' +
      '<div class="row"><span class="label">Audio</span><div class="seg"><button class="unm ' + (S.prefs.muted ? '' : 'on') + '">On</button><button class="mt ' + (S.prefs.muted ? 'on' : '') + '">Muted</button></div></div>' +
      '<div class="row"><span class="label">Motion</span><div class="seg mot">' + [['auto', 'System'], ['full', 'Full'], ['reduced', 'Reduced']].map(function (o) { return '<button data-v="' + o[0] + '" class="' + (prefs.motion === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="row"><span class="label">Tips</span><div class="seg tips"><button data-v="1" class="' + (prefs.tips ? 'on' : '') + '">Show</button><button data-v="0" class="' + (prefs.tips ? '' : 'on') + '">Hide</button><button data-v="r">Show again</button></div></div>' +
      '<div class="row"><span class="label">Default bots</span><div class="seg bl">' + E.LEVELS.map(function (l) { return '<button data-v="' + l + '" class="' + (prefs.botLevel === l ? 'on' : '') + '">' + l[0].toUpperCase() + l.slice(1) + '</button>'; }).join('') + '</div></div>' +
      '</div><p style="font-size:12px;color:var(--ink3);margin-top:16px">Bot difficulty for a running room is set by its host in the lobby.</p>';
    var m = modal(html);
    $('.mus', m).oninput = function (e) { S.setPref('music', Number(e.target.value)); };
    $('.sfx', m).oninput = function (e) { S.setPref('sfx', Number(e.target.value)); };
    $('.sfx', m).onchange = function () { S.play('place'); };
    $('.unm', m).onclick = function () { S.setPref('muted', false); updateMute(); showSettings(); S.play('confirm'); };
    $('.mt', m).onclick = function () { S.setPref('muted', true); updateMute(); showSettings(); };
    $$('.mot button', m).forEach(function (b) { b.onclick = function () { prefs.motion = b.dataset.v; savePrefs(); applyMotion(); S.play('select'); showSettings(); }; });
    $$('.tips button', m).forEach(function (b) { b.onclick = function () { if (b.dataset.v === 'r') { prefs.seenTips = {}; prefs.tips = true; } else prefs.tips = b.dataset.v === '1'; savePrefs(); S.play('select'); showSettings(); }; });
    $$('.bl button', m).forEach(function (b) { b.onclick = function () { prefs.botLevel = b.dataset.v; savePrefs(); S.play('select'); showSettings(); }; });
  }

  // ───────────── boot ─────────────
  show('title');
  Net.probe().then(function (ok) {
    app.serverOnline = ok;
    updateOnlineHint();
    var seat = ok && Net.savedSeat();
    if (seat && !app.net) {
      // A reload during an online game: take the seat back.
      app.net = Net.createOnline(handlers);
      app.net.resume(seat).then(function (res) {
        if (res.error) { leaveNet(); updateOnlineHint(); return; }
        routeFromView();
      });
    }
  });
  window.addEventListener('beforeunload', function () { /* the seat token survives in sessionStorage for a reload */ });
  window.RiftApp = app; // handy for debugging in the console
})();
