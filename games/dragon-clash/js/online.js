/*
 * Dragon Clash — online lobby, versus rooms and tournaments. The server runs every match; this page sends
 * buttons and draws what the server says happened.
 */
(function () {
  'use strict';
  var App = window.DCApp, D = window.DC.Data, Build = window.DC.Build, Net = window.DCNet, Cup = window.DC.Tournament;
  var esc = App.esc;
  var S = { net: null, room: null, you: null, matchId: null, device: window.DCApp.defaultDevice(), pick: null, gear: null, gearFor: null, status: 'idle', lastEnd: null, spectating: null };

  // ─────────────── loadout: the same Size / Instinct / Ability picks as Versus, on the 30 gear points ───────────────
  var GEAR = [['size', 'Size', D.SIZES], ['instinct', 'Instinct', D.INSTINCTS], ['ability', 'Ability', D.GEAR_ABILITIES]];
  /** The loadout for the picked dragon: kept while the dragon stays the same; a new dragon starts at its own size. */
  function myGear() {
    var base = App.buildById(S.pick);
    if (!S.gear || S.gearFor !== base.id) {
      var saved = App.store.get('onlineGear', null), g = { size: Build.sizeOf(base.body), instinct: (S.gear && S.gear.instinct) || 'fury', ability: 'none' };
      if (saved && saved.dragon === base.id && Build.gearCost(Build.withGear(base, saved)) <= D.GEAR_BUDGET) g = { size: saved.size, instinct: saved.instinct, ability: saved.ability };
      S.gear = g; S.gearFor = base.id;
    }
    return S.gear;
  }
  function myBuild() { return Build.sanitize(Build.withGear(App.buildById(S.pick), myGear())); }
  function gearHtml(locked) {
    var base = App.buildById(S.pick), g = myGear(), used = Build.gearCost(Build.withGear(base, g));
    return '<div class="gear-picks" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' + GEAR.map(function (row) {
      return '<label style="display:grid;gap:4px"><span class="eyebrow">' + row[1] + '</span><select class="sel" data-gear="' + row[0] + '"' + (locked ? ' disabled' : '') + '>' +
        Object.keys(row[2]).map(function (k) {
          var t = Object.assign({}, g); t[row[0]] = k;
          var fits = Build.gearCost(Build.withGear(base, t)) <= D.GEAR_BUDGET;
          var price = row[0] === 'size' ? '' : ' · ' + row[2][k].cost + ' pts';
          return '<option value="' + k + '"' + (k === g[row[0]] ? ' selected' : '') + (fits ? '' : ' disabled') + '>' + esc(row[2][k].name) + price + (fits ? '' : ' (over budget)') + '</option>';
        }).join('') + '</select></label>';
    }).join('') + '</div><div class="dim" style="font-size:13px">' + esc(D.INSTINCTS[g.instinct].desc) + (g.ability !== 'none' ? ' ' + esc(D.GEAR_ABILITIES[g.ability].desc) : '') +
      ' <b>' + used + ' / ' + D.GEAR_BUDGET + ' gear points</b></div>';
  }
  function bindGear(onChange) {
    App.ui.querySelectorAll('[data-gear]').forEach(function (el) {
      el.addEventListener('change', function () {
        var g = Object.assign({}, myGear()); g[el.dataset.gear] = el.value;
        if (Build.gearCost(Build.withGear(App.buildById(S.pick), g)) > D.GEAR_BUDGET) { App.toast('That loadout is over the ' + D.GEAR_BUDGET + ' gear points.'); onChange(); return; }
        S.gear = g; App.store.set('onlineGear', Object.assign({ dragon: S.gearFor }, g)); onChange();
      });
    });
  }
  /** "Medium · Fury · Gust" for a member's build, so everyone sees each other's loadout in the lobby. */
  function loadoutText(b) {
    var g = b && b.gear; if (!g) return '';
    return [D.SIZES[g.size] && D.SIZES[g.size].name, D.INSTINCTS[g.instinct] && D.INSTINCTS[g.instinct].name, g.ability && g.ability !== 'none' && D.GEAR_ABILITIES[g.ability] && D.GEAR_ABILITIES[g.ability].name].filter(Boolean).join(' · ');
  }

  function myName() {
    var n = App.store.get('onlineName', null);
    if (n) return n;
    return App.hub ? App.hub.player().name : 'Dragon';
  }

  function ensureNet() {
    if (S.net) return Promise.resolve(S.net);
    var net = new Net();
    S.net = net;
    net.on('room', function (m) { S.room = m.room; S.you = m.you; preloadSprites(m.room); if (App.screen === 'room' && !App.match) App.screens.room.render(); });
    // Only navigate when the player is in the online flow (or just refreshed onto the title screen)
    function inOnline() { return !App.match && (App.screen === 'online' || App.screen === 'room' || App.screen === 'title' || App.screen === 'results'); }
    net.on('joined', function () { if (inOnline()) App.show('room'); });
    net.on('error', function (m) { if (/No room/.test(m.msg) && !S.room) net.forget(); App.toast(m.msg); });
    net.on('closed', function (m) {
      App.toast(m.reason === 'replaced' ? 'This seat was opened in another window.' : 'The room closed.');
      S.room = null;
      if (S.matchId) { S.matchId = null; App.stopMatch(); App.show('online'); }
      else if (App.screen === 'room') App.show('online');
    });
    net.on('status', function (st) { S.status = st; if (st === 'disconnected' && App.match) App.toast('Connection lost. Reconnecting…'); });
    net.on('match', function (m) { startMatch(m); });
    net.on('snap', function (m) { if (App.match && m.m === S.matchId) App.match.pushSnapshot(m.s); });
    net.on('end', function (m) { if (m.m === S.matchId) showEnd(m); });
    return net.connect().then(function () { return net; }, function (e) { S.net = null; throw e; });
  }

  // Sprite dragons in the room start decoding while players are still in the lobby, so the match does not wait for them
  function preloadSprites(room) {
    if (!window.DCSprites || !room) return;
    (room.members || []).forEach(function (mem) { var id = mem.build && mem.build.look && mem.build.look.sprite; if (id) window.DCSprites.load(id); });
  }

  function startMatch(m) {
    App.stopMatch();
    S.matchId = m.match.id;
    S.spectating = m.spectator ? m.match.id : null;
    var mine = m.you >= 0 ? [m.you] : [];
    App.ui.innerHTML = '';
    var match = new window.DCMatch({
      canvas: App.canvas, mode: 'online', setup: m.match.setup, settings: App.settings, localSlots: mine, spectator: m.you < 0, device: S.device,
      net: { sendInput: function (h, c) { S.net.send({ t: 'input', h: h, c: c }); } },
      onPause: function (p) { onlinePause(p, m.you < 0); },
      onEnd: null,
    });
    App.match = match;
    var help = document.createElement('div'); help.className = 'match-help';
    help.innerHTML = m.you < 0 ? 'Spectating · <kbd>Esc</kbd> to stop watching' : App.deviceHint(S.device, 'You') + ' &nbsp;·&nbsp; <kbd>Esc</kbd> menu';
    App.ui.appendChild(help);
  }

  function onlinePause(on, spectator) {
    var old = document.querySelector('.overlay.pause'); if (old) old.remove();
    if (!on) return;
    var o = document.createElement('div'); o.className = 'overlay pause';
    o.innerHTML = '<div class="modal"><h2>' + (spectator ? 'Watching' : 'Menu') + '</h2><p class="muted">Online matches keep running.</p>' +
      '<button class="btn hot" data-act="resume">Back to the fight</button>' +
      (spectator ? '<button class="btn ghost" data-act="stop">Stop watching</button>' : '<button class="btn ghost" data-act="forfeit">Forfeit and leave the match</button>') + '</div>';
    document.body.appendChild(o);
    App.on(o, {
      resume: function () { if (App.match) App.match.togglePause(false); },
      stop: function () { o.remove(); S.net.send({ t: 'unspectate' }); S.matchId = null; App.stopMatch(); App.show('room'); },
      forfeit: function () { App.confirmAsk('Forfeit this match?', 'Forfeit', function () { o.remove(); S.net.send({ t: 'forfeit' }); if (App.match) App.match.togglePause(false); }); },
    });
  }

  function showEnd(m) {
    S.matchId = null;
    App.stopMatch();
    var youIdx = m.setup.fighters.map(function (f) { return f.id; }).indexOf(S.you);
    App.show('results', {
      result: m.result, setup: m.setup, labels: m.labels, mode: 'online',
      localTeams: youIdx >= 0 ? [m.setup.fighters[youIdx].team] : null,
      onContinue: function () { App.show('room'); }, continueLabel: S.room && S.room.mode === 'cup' ? 'Back to the bracket' : 'Back to the room',
    });
  }

  // ─────────────────────────────── connect screen ───────────────────────────────
  App.screens.online = {
    enter: function () {
      if (!Net.available()) {
        App.ui.innerHTML = '<div class="screen"><div class="topbar"><button class="btn ghost small" data-act="back">← Back</button><h1>Online</h1></div>' +
          '<div class="panel"><p>Online play needs the hub server. In the project folder run:</p><pre class="panel">npm install\nnpm start</pre><p class="muted">Then open the address it prints (for example http://localhost:8080) on every device. Everything else in Dragon Clash works offline from this file.</p></div></div>';
        App.on(App.ui, { back: function () { App.show('title'); } });
        return;
      }
      if (S.room && S.net) { App.show('room'); return; }
      var saved = Net.saved();
      App.ui.innerHTML = '<div class="screen"><div class="topbar"><button class="btn ghost small" data-act="back">← Back</button><h1>Online</h1></div>' +
        '<div class="teams">' +
        '<div class="panel" style="display:grid;gap:10px"><div class="eyebrow">Your name</div><input class="text" data-name maxlength="16" value="' + esc(myName()) + '">' +
        '<div class="eyebrow">Your dragon</div><select class="sel" data-build>' + App.buildOptions(S.pick || (App.myBuilds()[0] || {}).id || 'preset-emberfang') + '</select>' +
        '<div class="eyebrow">Controls</div><select class="sel" data-dev>' + (App.isTouch() ? [['touch', 'Touch screen'], ['kb1', 'Keyboard'], ['pad0', 'Gamepad 1']] : [['kb1', 'Keyboard'], ['touch', 'Touch screen'], ['pad0', 'Gamepad 1']]).map(function (d) { return '<option value="' + d[0] + '"' + (S.device === d[0] ? ' selected' : '') + '>' + d[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="panel" style="display:grid;gap:10px;align-content:start"><div class="eyebrow">Host</div>' +
        '<button class="btn hot" data-act="create" data-mode="versus">Create a versus room</button>' +
        '<button class="btn" data-act="create" data-mode="cup">Create a tournament</button>' +
        '<div class="eyebrow" style="margin-top:8px">Join</div><div class="row"><input class="text grow" data-code maxlength="4" placeholder="CODE" style="text-transform:uppercase;letter-spacing:.2em"><button class="btn cool" data-act="join">Join</button></div>' +
        (saved ? '<button class="btn ghost small" data-act="rejoin">Rejoin room ' + esc(saved.code) + '</button>' : '') +
        '<p class="dim" data-status></p></div></div></div>';
      var nameEl = App.ui.querySelector('[data-name]'), buildEl = App.ui.querySelector('[data-build]'), devEl = App.ui.querySelector('[data-dev]');
      nameEl.addEventListener('change', function () { App.store.set('onlineName', nameEl.value.slice(0, 16)); });
      buildEl.addEventListener('change', function () { S.pick = buildEl.value; });
      devEl.addEventListener('change', function () { S.device = devEl.value; });
      function status(t) { var s = App.ui.querySelector('[data-status]'); if (s) s.textContent = t; }
      function go(msg) {
        S.pick = buildEl.value;
        App.store.set('onlineName', nameEl.value.slice(0, 16));
        status('Connecting…');
        ensureNet().then(function (net) {
          msg.name = nameEl.value; msg.build = myBuild();
          net.send(msg);
        }, function (e) { status(e.message + ' Is the hub server running (npm start)?'); });
      }
      App.on(App.ui, {
        back: function () { App.show('title'); },
        create: function (el) { go({ t: 'create', mode: el.dataset.mode }); },
        join: function () { var c = App.ui.querySelector('[data-code]').value.trim().toUpperCase(); if (c.length !== 4) { status('Room codes have 4 letters.'); return; } go({ t: 'join', code: c }); },
        rejoin: function () { var sv = Net.saved(); go({ t: 'join', code: sv.code, token: sv.token }); },
      });
    },
  };

  // ─────────────────────────────── room / lobby / bracket ───────────────────────────────
  App.screens.room = {
    enter: function () {
      if (!S.room) { App.show('online'); return; }
      App.on(App.ui, handlers);
      this.render();
    },
    render: function () {
      var r = S.room;
      if (!r) return;
      var me = r.members.filter(function (m) { return m.id === S.you; })[0] || {};
      var host = r.host === S.you;
      var f = D.FORMATS[r.settings.format];
      var lobby = r.state === 'lobby';
      var html = '<div class="screen"><div class="topbar"><button class="btn ghost small" data-act="leave">← Leave</button>' +
        '<h1>' + (r.mode === 'cup' ? 'Online tournament' : 'Online versus') + '</h1><div class="spacer"></div>' +
        '<div style="text-align:right"><div class="eyebrow">Room code</div><div class="code-big">' + esc(r.code) + '</div></div></div>';
      if (r.mode === 'cup' && r.cup) html += cupHtml(r, me);
      else {
        html += '<div class="teams">';
        var teams = r.mode === 'versus' ? f.teams : 1;
        for (var t = 0; t < teams; t++) {
          var list = r.members.filter(function (m) { return r.mode !== 'versus' || m.team === t; });
          var col = r.mode === 'versus' ? D.TEAM_COLORS[t] : '#ffcf3a';
          html += '<div class="team" style="border-color:' + col + '"><h3 style="color:' + col + '">' + (r.mode === 'versus' ? (f.perTeam > 1 ? D.TEAM_NAMES[t] + ' team' : 'Side ' + (t + 1)) + ' <small class="dim">' + list.length + '/' + f.perTeam + '</small>' : 'Entrants ' + r.members.length + '/8') + '</h3>' +
            list.map(memberHtml).join('') +
            (r.mode === 'versus' && lobby && me.team !== t ? '<button class="btn ghost small" data-act="team" data-team="' + t + '">Join this side</button>' : '') + '</div>';
        }
        html += '</div>';
      }
      if (lobby) {
        html += '<div class="teams"><div class="panel" style="display:grid;gap:8px"><div class="eyebrow">Your dragon</div>' +
          '<select class="sel" data-build' + (me.ready ? ' disabled' : '') + '>' + App.buildOptions(S.pick || (me.build && me.build.id) || 'preset-emberfang') + '</select>' +
          gearHtml(me.ready) +
          '<div class="row"><button class="btn ' + (me.ready ? 'ghost' : 'hot') + '" data-act="ready">' + (me.ready ? 'Not ready' : 'Ready!') + '</button><span class="dim">Builds are checked by the server and locked when the room starts.</span></div></div>';
        if (host) {
          html += '<div class="panel" style="display:grid;gap:8px"><div class="eyebrow">Host settings</div>' +
            (r.mode === 'versus' ? '<div class="chips">' + Object.keys(D.FORMATS).map(function (k) { return '<button class="chip' + (r.settings.format === k ? ' on' : '') + '" data-act="set" data-k="format" data-v="' + k + '">' + D.FORMATS[k].name + '</button>'; }).join('') + '</div>' : '') +
            '<div class="chips">' + D.ARENA_ORDER.map(function (k) { return '<button class="chip' + (r.settings.arena === k ? ' on' : '') + '" data-act="set" data-k="arena" data-v="' + k + '">' + D.ARENAS[k].name + '</button>'; }).join('') + '</div>' +
            '<div class="chips"><span class="eyebrow" style="align-self:center">Stocks</span>' + [1, 2, 3, 4, 5].map(function (n) { return '<button class="chip' + (r.settings.stocks === n ? ' on' : '') + '" data-act="set" data-k="stocks" data-v="' + n + '">' + n + '</button>'; }).join('') + '</div>' +
            '<div class="row"><button class="btn ghost small" data-act="bot" data-level="1">＋ CPU easy</button><button class="btn ghost small" data-act="bot" data-level="2">＋ CPU normal</button><button class="btn ghost small" data-act="bot" data-level="3">＋ CPU hard</button></div>' +
            '<button class="btn hot" data-act="start">Start ' + (r.mode === 'cup' ? 'the cup' : 'the match') + ' →</button>' +
            (r.mode === 'versus' ? '<p class="dim">Empty seats are filled with CPUs.</p>' : '<p class="dim">Seeds follow join order. Byes go to the top seeds.</p>') + '</div>';
        } else html += '<div class="panel"><p class="muted">Waiting for the host to start. Share the code <b>' + esc(r.code) + '</b>: friends on this network open this page and join.</p></div>';
        html += '</div>';
      } else if (r.state === 'playing' || r.state === 'results') {
        html += '<div class="panel row"><span class="grow">' + (r.state === 'playing' ? 'A match is running.' : 'Match over.') + '</span>' +
          (r.live.length && !S.matchId ? r.live.map(function (lm) { return '<button class="btn small" data-act="watch" data-m="' + lm.id + '">Watch</button>'; }).join('') : '') +
          (host && r.state === 'results' ? '<button class="btn hot" data-act="rematch">Back to the lobby</button>' : '') + '</div>';
      }
      html += '</div>';
      App.ui.innerHTML = html;
      r.members.forEach(function (m) { if (m.build) App.mini(App.ui.querySelector('[data-mem="' + m.id + '"]'), m.build, 'idle', { scale: 1 }); });
      var sel = App.ui.querySelector('[data-build]');
      if (sel) {
        S.pick = sel.value;
        var sendBuild = function () { S.net.send({ t: 'build', build: myBuild() }); };
        sel.addEventListener('change', function () { S.pick = sel.value; sendBuild(); App.screens.room.render(); });
        bindGear(function () { sendBuild(); App.screens.room.render(); });
        // The server keeps what it was last sent: make sure it matches the dragon and loadout shown here
        var mine = me.build && me.build.gear, want = myGear();
        if (!me.ready && (!me.build || me.build.id !== App.buildById(S.pick).id || !mine || mine.size !== want.size || mine.instinct !== want.instinct || mine.ability !== want.ability)) sendBuild();
      }
      function memberHtml(m) {
        var b = m.build;
        return '<div class="member"><canvas data-mem="' + m.id + '"></canvas><div class="grow"><b>' + esc(m.name) + '</b>' + (m.id === r.host ? ' ' + window.DCIcons.svg('crown', '#ffcf3a', 14) : '') + (m.id === S.you ? ' <span class="pill">you</span>' : '') +
          '<div class="dim">' + (b ? App.elIcon(b.element) + ' ' + esc(b.name) + (loadoutText(b) ? ' <span style="opacity:.75">· ' + esc(loadoutText(b)) + '</span>' : '') : 'choosing…') + '</div></div>' +
          (m.bot ? '<span class="pill">CPU ' + ['', 'easy', 'normal', 'hard'][m.level || 2] + '</span>' + (r.host === S.you && r.state === 'lobby' ? ' <button class="icon-btn" data-act="kick" data-id="' + m.id + '">✕</button>' : '')
            : !m.connected ? '<span class="pill wait">reconnecting</span>' : m.ready ? '<span class="pill ok">ready</span>' : '<span class="pill wait">not ready</span>') + '</div>';
      }
    },
  };

  function cupHtml(r, me) {
    var t = r.cup;
    var out = t.entrants.filter(function (e) { return e.id === S.you; })[0];
    var mm = Cup.matchFor(t, S.you);
    var msg = t.status === 'done' ? window.DCIcons.svg('cup', '#ffcf3a', 18) + ' ' + esc(Cup.entrant(t, t.champion).name) + ' is the champion!' :
      mm ? (mm.status === 'live' ? 'Your match is live.' : 'Your next match starts when it is ready.') :
      out && out.out ? 'You are out. Watch the live matches below.' : 'Waiting for the next round.';
    var liveIds = {};
    r.live.forEach(function (l) { if (l.cupMatch) liveIds[l.cupMatch] = l.id; });
    return '<div class="panel row"><span class="grow" style="font:400 20px var(--f-display)">' + msg + '</span>' +
      (t.status === 'done' && r.host === S.you ? '<button class="btn hot" data-act="newcup">New cup</button>' : '') + '</div>' +
      '<div class="panel">' + App.renderBracket(t, { actions: function (m) {
        if (m.status === 'live' && liveIds[m.id] && m.a !== S.you && m.b !== S.you) return '<button class="btn small" data-act="watch" data-m="' + liveIds[m.id] + '">Watch live</button>';
        if (m.status === 'live') return '<span class="pill ok">live</span>';
        return '';
      } }) + '</div>';
  }

  var handlers = {
    leave: function () { App.confirmAsk('Leave this room?', 'Leave', function () { S.net.send({ t: 'leave' }); S.net.close(); S.net = null; S.room = null; App.show('online'); }); },
    ready: function () { var me = S.room.members.filter(function (m) { return m.id === S.you; })[0]; S.net.send({ t: 'ready', ready: !(me && me.ready) }); },
    team: function (el) { S.net.send({ t: 'team', team: +el.dataset.team }); },
    set: function (el) { var o = { t: 'settings' }; o[el.dataset.k] = el.dataset.k === 'stocks' ? +el.dataset.v : el.dataset.v; S.net.send(o); },
    bot: function (el) { S.net.send({ t: 'bot', op: 'add', level: +el.dataset.level }); },
    kick: function (el) { S.net.send({ t: 'bot', op: 'remove', id: el.dataset.id }); },
    start: function () { S.net.send({ t: 'start' }); },
    watch: function (el) { S.net.send({ t: 'spectate', match: el.dataset.m }); },
    rematch: function () { S.net.send({ t: 'rematch' }); },
    newcup: function () { S.net.send({ t: 'newcup' }); },
  };

  // A refresh during an online session: rejoin automatically.
  if (Net.available() && Net.saved()) {
    setTimeout(function () {
      var sv = Net.saved();
      if (!sv || S.net) return;
      ensureNet().then(function (net) { net.send({ t: 'join', code: sv.code, token: sv.token }); }, function () { /* server gone */ });
    }, 400);
  }
})();
