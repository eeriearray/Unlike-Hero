/*
 * Dragon Clash — local play: Versus setup (1v1 / 2v2 / 3v3 / free-for-all), Training, and the local Tournament.
 */
(function () {
  'use strict';
  var App = window.DCApp, D = window.DC.Data, Build = window.DC.Build, Sim = window.DC.Sim, Bot = window.DC.Bot, T = window.DC.Tournament, Input = window.DCInput;
  var esc = App.esc;

  var CONTROLS = [['kb1', 'Keyboard 1'], ['kb2', 'Keyboard 2'], ['pad0', 'Gamepad 1'], ['pad1', 'Gamepad 2'], ['pad2', 'Gamepad 3'], ['pad3', 'Gamepad 4'],
                  ['cpu1', 'CPU · easy'], ['cpu2', 'CPU · normal'], ['cpu3', 'CPU · hard']];
  var PRESET_ROTATION = ['emberfang', 'frostwing', 'voltscale', 'ironmaw', 'tidefang', 'warrior'];

  function ctrlOptions(sel) { return CONTROLS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === sel ? ' selected' : '') + '>' + c[1] + '</option>'; }).join(''); }
  function isCpu(c) { return c.indexOf('cpu') === 0; }
  function defaultBuildId(i) { var mine = App.myBuilds(); if (i === 0 && mine[0]) return mine[0].id; return 'preset-' + PRESET_ROTATION[i % PRESET_ROTATION.length]; }

  function arenaPreview(cv, id) {
    var x = cv.getContext('2d'), w = cv.clientWidth || 200, h = cv.clientHeight || 110;
    cv.width = w * 2; cv.height = h * 2; x.scale(2, 2);
    var a = D.ARENAS[id];
    window.DCScenery.backdrop(x, a, { x: 800, y: 450 }, w, h, 3);
    x.save(); x.scale(w / 1600, h / 900); x.translate(0, 60); window.DCScenery.platforms(x, a, 0); x.restore();
  }

  // ─────────────────────────────── Versus ───────────────────────────────
  App.screens.versus = {
    enter: function () {
      if (!App.saidChampion) { App.saidChampion = true; window.DCAudio.init(); setTimeout(function () { window.DCAudio.voice('vChampion'); }, 250); }
      var cfg = Object.assign({ format: '1v1', arena: 'skyforge', stocks: 3, time: 0, ff: false, slots: [] }, App.store.get('versus', {}));
      function slotCount() { var f = D.FORMATS[cfg.format]; return f.teams * f.perTeam; }
      function normalise() {
        var n = slotCount();
        for (var i = 0; i < n; i++) {
          if (!cfg.slots[i]) cfg.slots[i] = { ctrl: i === 0 ? 'kb1' : 'cpu2', build: defaultBuildId(i) };
          if (!App.allBuilds().some(function (b) { return b.id === cfg.slots[i].build; })) cfg.slots[i].build = defaultBuildId(i);
        }
      }
      function teamOf(i) { return Math.floor(i / D.FORMATS[cfg.format].perTeam); }
      function problems() {
        var used = {}, out = [];
        for (var i = 0; i < slotCount(); i++) {
          var c = cfg.slots[i].ctrl;
          if (!isCpu(c)) { if (used[c]) out.push(Input.DEVICE_NAMES[c] + ' is picked twice.'); used[c] = true; }
          if (c.indexOf('pad') === 0 && Input.connectedPads().indexOf(c) < 0) out.push(Input.DEVICE_NAMES[c] + ' is not connected (press a button on it).');
        }
        var conf = Input.conflicts(Object.keys(used).filter(function (d) { return d.indexOf('kb') === 0; }));
        if (conf.length) out.push('Keyboard layouts share keys: ' + conf.join(', ') + '. Remap in Controls & settings.');
        return out;
      }
      function render() {
        normalise();
        var f = D.FORMATS[cfg.format], n = slotCount();
        var teams = [];
        for (var t = 0; t < f.teams; t++) teams.push([]);
        for (var i = 0; i < n; i++) teams[teamOf(i)].push(i);
        var probs = problems();
        App.ui.innerHTML =
          '<div class="screen"><div class="topbar"><button class="btn ghost small" data-act="back">← Back</button><h1>Versus</h1><div class="spacer"></div>' +
          '<div class="chips">' + Object.keys(D.FORMATS).map(function (k) { return '<button class="chip' + (cfg.format === k ? ' on' : '') + '" data-act="format" data-id="' + k + '">' + D.FORMATS[k].name + '</button>'; }).join('') + '</div></div>' +
          '<div class="teams">' + teams.map(function (list, ti) {
            var col = D.TEAM_COLORS[ti];
            return '<div class="team" style="border-color:' + col + ';background:linear-gradient(180deg,' + window.DCArt.alpha(col, 0.16) + ',transparent)"><h3 style="color:' + col + '">' + (f.perTeam > 1 ? D.TEAM_NAMES[ti] + ' team' : 'Player ' + (ti + 1)) + '</h3>' +
              list.map(function (i) {
                var s = cfg.slots[i], b = App.buildById(s.build);
                var opp = []; for (var j = 0; j < n; j++) if (teamOf(j) !== ti) opp.push(App.buildById(cfg.slots[j].build).element);
                var uniq = opp.filter(function (e, k) { return opp.indexOf(e) === k; });
                return '<div class="slot"><canvas data-mini="' + i + '"></canvas><div class="fields">' +
                  '<select class="sel" data-slot-ctrl="' + i + '">' + ctrlOptions(s.ctrl) + '</select>' +
                  '<select class="sel" data-slot-build="' + i + '">' + App.buildOptions(s.build) + '</select>' +
                  '<div class="row" style="gap:4px">' + uniq.map(function (e) { return App.matchupChip(b.element, e); }).join('') + '</div>' +
                  '</div></div>';
              }).join('') + '</div>';
          }).join('') + '</div>' +
          '<div class="panel"><div class="section-title" style="margin-top:0">Arena</div><div class="arena-cards">' +
          ['skyforge', 'frostfall'].map(function (id) { return '<button class="arena-card' + (cfg.arena === id ? ' on' : '') + '" data-act="arena" data-id="' + id + '"><canvas data-arena="' + id + '"></canvas><b>' + D.ARENAS[id].name + '</b></button>'; }).join('') + '</div>' +
          '<div class="row" style="margin-top:12px"><span class="eyebrow">Stocks</span><div class="chips">' + [1, 2, 3, 4, 5].map(function (s) { return '<button class="chip' + (cfg.stocks === s ? ' on' : '') + '" data-act="stocks" data-n="' + s + '">' + s + '</button>'; }).join('') + '</div>' +
          '<span class="eyebrow">Time</span><div class="chips">' + [0, 3, 5, 8].map(function (s) { return '<button class="chip' + (cfg.time === s ? ' on' : '') + '" data-act="time" data-n="' + s + '">' + (s ? s + ' min' : 'Off') + '</button>'; }).join('') + '</div>' +
          (f.perTeam > 1 ? '<label class="row"><input type="checkbox" data-ff' + (cfg.ff ? ' checked' : '') + '> Friendly fire</label>' : '') + '</div>' +
          '<div class="keys" style="margin-top:12px">' + humanDevices().map(function (d) { return '<div>' + App.deviceHint(d) + '</div>'; }).join('') + '</div></div>' +
          (probs.length ? '<div class="errors">' + probs.map(esc).join('<br>') + '</div>' : '') +
          '<div class="row"><div class="spacer grow"></div><button class="btn hot" data-act="start"' + (probs.length ? ' disabled' : '') + '>Fight! →</button></div>' +
          '</div>';
        for (var k = 0; k < n; k++) App.mini(App.ui.querySelector('[data-mini="' + k + '"]'), App.buildById(cfg.slots[k].build), 'idle', { facing: teamOf(k) % 2 ? -1 : 1, scale: 0.95, offset: k });
        App.ui.querySelectorAll('[data-arena]').forEach(function (cv) { arenaPreview(cv, cv.dataset.arena); });
        App.ui.querySelectorAll('[data-slot-ctrl]').forEach(function (s) { s.addEventListener('change', function () { cfg.slots[+s.dataset.slotCtrl].ctrl = s.value; save(); render(); }); });
        App.ui.querySelectorAll('[data-slot-build]').forEach(function (s) { s.addEventListener('change', function () { cfg.slots[+s.dataset.slotBuild].build = s.value; save(); render(); }); });
        var ff = App.ui.querySelector('[data-ff]'); if (ff) ff.addEventListener('change', function () { cfg.ff = ff.checked; save(); });
      }
      function humanDevices() { var out = []; for (var i = 0; i < slotCount(); i++) if (!isCpu(cfg.slots[i].ctrl)) out.push(cfg.slots[i].ctrl); return out; }
      function save() { App.store.set('versus', cfg); }
      function start() {
        var n = slotCount(), fighters = [], controllers = [], human = 0, labels = [], localTeams = [];
        for (var i = 0; i < n; i++) {
          var s = cfg.slots[i], b = App.buildById(s.build), team = teamOf(i);
          fighters.push({ id: 's' + i, build: b, team: team, name: b.name, tapJump: App.settings.tapJump });
          if (isCpu(s.ctrl)) { controllers.push({ i: i, type: 'bot', level: +s.ctrl.slice(3) }); labels.push('CPU ' + b.name); }
          else { human++; controllers.push({ i: i, type: 'human', device: s.ctrl, label: 'P' + human }); labels.push('P' + human + ' ' + b.name); if (localTeams.indexOf(team) < 0) localTeams.push(team); }
        }
        var simOpts = { arena: cfg.arena, fighters: fighters, stocks: cfg.stocks, timeLimit: cfg.time * 3600, friendlyFire: cfg.ff, seed: (Date.now() & 0xffff) + 1 };
        var opts = {
          simOpts: simOpts, controllers: controllers, label: 'versus ' + cfg.format,
          restart: function () { simOpts.seed++; App.startLocalMatch(opts); },
          onEnd: function (result, match) {
            var setup = match.setupInfo;
            App.stopMatch();
            App.show('results', { result: result, setup: setup, labels: labels, localTeams: localTeams, mode: 'versus',
              onRematch: function () { simOpts.seed++; App.startLocalMatch(opts); }, onChange: function () { App.show('versus'); } });
          },
          onQuit: function () { App.show('versus'); },
        };
        App.startLocalMatch(opts);
      }
      App.on(App.ui, {
        back: function () { App.show('title'); },
        format: function (el) { cfg.format = el.dataset.id; save(); render(); },
        arena: function (el) { cfg.arena = el.dataset.id; save(); render(); },
        stocks: function (el) { cfg.stocks = +el.dataset.n; save(); render(); },
        time: function (el) { cfg.time = +el.dataset.n; save(); render(); },
        start: start,
      });
      render();
    },
  };

  // ─────────────────────────────── Training ───────────────────────────────
  App.screens.training = {
    enter: function () {
      var cfg = Object.assign({ build: defaultBuildId(0), device: 'kb1', dummy: 'preset-ironmaw', mode: 'stand' }, App.store.get('training', {}));
      var MODES = [['stand', 'Standing dummy'], ['jump', 'Jumping dummy'], ['dodge', 'Dodging dummy'], ['cpu1', 'CPU · easy'], ['cpu2', 'CPU · normal'], ['cpu3', 'CPU · hard']];
      function render() {
        App.ui.innerHTML = '<div class="screen"><div class="topbar"><button class="btn ghost small" data-act="back">← Back</button><h1>Training</h1></div>' +
          '<div class="teams">' +
          '<div class="team" style="border-color:' + D.TEAM_COLORS[0] + '"><h3>You</h3><div class="slot"><canvas data-mini="0"></canvas><div class="fields">' +
          '<select class="sel" data-f="build">' + App.buildOptions(cfg.build) + '</select>' +
          '<select class="sel" data-f="device">' + CONTROLS.slice(0, 6).map(function (c) { return '<option value="' + c[0] + '"' + (cfg.device === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></div></div></div>' +
          '<div class="team" style="border-color:' + D.TEAM_COLORS[1] + '"><h3>Opponent</h3><div class="slot"><canvas data-mini="1"></canvas><div class="fields">' +
          '<select class="sel" data-f="dummy">' + App.buildOptions(cfg.dummy) + '</select>' +
          '<select class="sel" data-f="mode">' + MODES.map(function (m) { return '<option value="' + m[0] + '"' + (cfg.mode === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select>' +
          App.matchupChip(App.buildById(cfg.build).element, App.buildById(cfg.dummy).element) + '</div></div></div></div>' +
          '<div class="panel"><p class="muted" style="margin:0">Unlimited stocks. In training: <kbd>R</kbd> reset positions · <kbd>T</kbd> change dummy · <kbd>[</kbd> <kbd>]</kbd> dummy damage −/+10% · <kbd>`</kbd> hitboxes and launch paths · <kbd>Esc</kbd> pause.</p>' +
          '<div class="keys" style="margin-top:8px">' + App.deviceHint(cfg.device) + '</div></div>' +
          '<div class="row"><div class="grow"></div><button class="btn hot" data-act="start">Start training →</button></div></div>';
        App.mini(App.ui.querySelector('[data-mini="0"]'), App.buildById(cfg.build), 'idle', { scale: 0.95 });
        App.mini(App.ui.querySelector('[data-mini="1"]'), App.buildById(cfg.dummy), 'idle', { scale: 0.95, facing: -1 });
        App.ui.querySelectorAll('[data-f]').forEach(function (s) { s.addEventListener('change', function () { cfg[s.dataset.f] = s.value; App.store.set('training', cfg); render(); }); });
      }
      function start() {
        var me = App.buildById(cfg.build), dummy = App.buildById(cfg.dummy);
        var simOpts = { arena: 'training', stocks: 1, training: { infinite: true }, seed: 5,
          fighters: [{ id: 'me', build: me, team: 0, name: me.name, tapJump: App.settings.tapJump }, { id: 'dummy', build: dummy, team: 1, name: dummy.name }] };
        var mode = cfg.mode;
        var controllers = [{ i: 0, type: 'human', device: cfg.device, label: 'You' }, botFor(mode)];
        function botFor(m) { return isCpu(m) ? { i: 1, type: 'bot', level: +m.slice(3) } : { i: 1, type: 'bot', mode: m }; }
        var opts = {
          simOpts: simOpts, controllers: controllers, training: { dummy: 1 }, label: 'training',
          restart: function () { App.startLocalMatch(opts); panel(); },
          onQuit: function () { App.show('training'); },
          onTrainingKey: function () { var i = MODES.map(function (m) { return m[0]; }).indexOf(mode); mode = MODES[(i + 1) % MODES.length][0]; setMode(); },
        };
        function setMode() {
          var m = App.match; if (!m) return;
          controllers[1] = botFor(mode);
          if (isCpu(mode)) m.setDummyMode('cpu', +mode.slice(3)); else m.setDummyMode(mode);
          var s = document.querySelector('[data-tmode]'); if (s) s.value = mode;
        }
        function panel() {
          var p = document.createElement('div'); p.className = 'train-panel';
          var moves = ['jab', 'utilt', 'dtilt', 'fsmash', 'usmash', 'dsmash', 'nair', 'fair', 'dair', 'wingBurst'];
          var sig = D.SIGNATURES[me.signature], ab = D.ABILITIES[me.ability];
          var row = function (n, m) { var src = m.spawn || m.trail || m; var dmg = (src.phys || 0) + (src.elem || 0); return '<tr><td>' + esc(n) + '</td><td>' + m.startup + '</td><td>' + m.active + '</td><td>' + m.recovery + '</td><td>' + (dmg ? Math.round(dmg * 10) / 10 + (m.multi ? '×' + m.multi.max : '') : '—') + '</td></tr>'; };
          // A compact bar, styled like the HUD: what you change often is one click away, the move list folds out.
          p.innerHTML = '<div class="tp-row"><span class="tp-title">Training</span>' +
            '<select class="tp-sel" data-tmode title="Dummy behaviour (T)">' + MODES.map(function (m) { return '<option value="' + m[0] + '"' + (mode === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select>' +
            '<span class="tp-dmg"><button data-act="dm" title="[">−</button><b data-tdmg>0%</b><button data-act="dp" title="]">+</button></span>' +
            '<button class="tp-btn" data-act="reset" title="R">↺ Reset</button><button class="tp-btn" data-act="moves">Moves</button></div>' +
            '<div data-body class="tp-body" style="display:none"><table><tr class="dim"><th>Move</th><th>Start</th><th>Active</th><th>Recover</th><th>%</th></tr>' + moves.map(function (k) { return row(D.MOVES[k].name, D.MOVES[k]); }).join('') + row(sig.name, sig) + row(ab.name + ' (↓L)', ab) + '</table>' +
            '<div class="tp-foot"><span class="dim">Frames at 60 per second · % before element modifiers</span><label><input type="checkbox" data-dev> Dev overlay (`)</label></div></div>';
          document.getElementById('ui').appendChild(p);
          App.on(p, {
            dm: function () { App.match.setDummyDamage(App.match.dummyDamage() - 10); },
            dp: function () { App.match.setDummyDamage(App.match.dummyDamage() + 10); },
            reset: function () { App.match.trainingReset(); },
            moves: function (el) { var bd = p.querySelector('[data-body]'); var open = bd.style.display === 'none'; bd.style.display = open ? 'block' : 'none'; el.classList.toggle('on', open); },
          });
          p.querySelector('[data-tmode]').addEventListener('change', function (e) { mode = e.target.value; setMode(); e.target.blur(); });
          p.querySelector('[data-dev]').addEventListener('change', function (e) { App.match.debug = e.target.checked; e.target.blur(); });
          var iv = setInterval(function () {
            if (!document.body.contains(p) || !App.match) { clearInterval(iv); return; }
            p.querySelector('[data-tdmg]').textContent = Math.round(App.match.dummyDamage()) + '%';
          }, 150);
        }
        App.startLocalMatch(opts);
        setMode();
        panel();
      }
      App.on(App.ui, { back: function () { App.show('title'); }, start: start });
      render();
    },
  };

  // ─────────────────────────────── Local tournament ───────────────────────────────
  var cup = null; // { t, cfg, entrants }

  /** Runs a whole CPU-vs-CPU match headless: a real simulation, so the result is earned, not invented. */
  function simulateMatch(ea, eb, cfg, seed) {
    var sim = new Sim({ arena: cfg.arena, stocks: cfg.stocks, timeLimit: 60 * 60 * 4, seed: seed,
      fighters: [{ id: ea.id, build: App.buildById(ea.build), team: 0, name: ea.name }, { id: eb.id, build: App.buildById(eb.build), team: 1, name: eb.name }] });
    var bots = [new Bot(sim, 0, { level: +ea.ctrl.slice(3) || 2, seed: seed }), new Bot(sim, 1, { level: +eb.ctrl.slice(3) || 2, seed: seed + 9 })];
    while (!sim.result) sim.step([bots[0].think(), bots[1].think()]);
    return sim.result;
  }

  App.screens.cup = {
    enter: function () {
      if (cup && cup.t && cup.t.status !== 'done') { App.show('bracket'); return; }
      var cfg = Object.assign({ count: 8, arena: 'skyforge', stocks: 2, entrants: [] }, App.store.get('cup', {}));
      function normalise() {
        for (var i = 0; i < 8; i++) {
          if (!cfg.entrants[i]) cfg.entrants[i] = { name: i === 0 ? 'You' : 'CPU ' + (i + 1), ctrl: i === 0 ? 'kb1' : 'cpu2', build: defaultBuildId(i) };
          if (!App.allBuilds().some(function (b) { return b.id === cfg.entrants[i].build; })) cfg.entrants[i].build = defaultBuildId(i);
        }
      }
      function problems() {
        var used = {}, out = [];
        cfg.entrants.slice(0, cfg.count).forEach(function (e) {
          if (!isCpu(e.ctrl)) { if (used[e.ctrl]) out.push(Input.DEVICE_NAMES[e.ctrl] + ' is picked twice.'); used[e.ctrl] = true; }
          if (!e.name.trim()) out.push('Every entrant needs a name.');
        });
        return out;
      }
      function render() {
        normalise();
        var probs = problems();
        App.ui.innerHTML = '<div class="screen"><div class="topbar"><button class="btn ghost small" data-act="back">← Back</button><h1>Tournament</h1><div class="spacer"></div>' +
          '<span class="eyebrow">Dragons</span><div class="chips">' + [4, 5, 6, 7, 8].map(function (n) { return '<button class="chip' + (cfg.count === n ? ' on' : '') + '" data-act="count" data-n="' + n + '">' + n + '</button>'; }).join('') + '</div></div>' +
          '<p class="muted" style="margin:0">Single elimination, 1v1, ' + cfg.stocks + ' stocks. Top seeds get byes when the field is not 4 or 8. Each dragon is locked in when the cup starts. CPU matches are real fights: watch them or let them play out instantly.</p>' +
          '<div class="teams">' + cfg.entrants.slice(0, cfg.count).map(function (e, i) {
            return '<div class="slot"><canvas data-mini="' + i + '"></canvas><div class="fields"><div class="row" style="gap:6px"><span class="pill">Seed ' + (i + 1) + '</span><input class="text" style="font-size:16px;padding:5px 9px" maxlength="14" data-name="' + i + '" value="' + esc(e.name) + '"></div>' +
              '<select class="sel" data-ctrl="' + i + '">' + ctrlOptions(e.ctrl) + '</select><select class="sel" data-build="' + i + '">' + App.buildOptions(e.build) + '</select></div></div>';
          }).join('') + '</div>' +
          '<div class="panel row"><span class="eyebrow">Arena</span><div class="chips">' + ['skyforge', 'frostfall'].map(function (id) { return '<button class="chip' + (cfg.arena === id ? ' on' : '') + '" data-act="arena" data-id="' + id + '">' + D.ARENAS[id].name + '</button>'; }).join('') + '</div>' +
          '<span class="eyebrow">Stocks</span><div class="chips">' + [1, 2, 3].map(function (n) { return '<button class="chip' + (cfg.stocks === n ? ' on' : '') + '" data-act="stocks" data-n="' + n + '">' + n + '</button>'; }).join('') + '</div></div>' +
          (probs.length ? '<div class="errors">' + probs.map(esc).join('<br>') + '</div>' : '') +
          '<div class="row"><div class="grow"></div><button class="btn hot" data-act="lock"' + (probs.length ? ' disabled' : '') + '>Lock in & start the cup →</button></div></div>';
        for (var i = 0; i < cfg.count; i++) App.mini(App.ui.querySelector('[data-mini="' + i + '"]'), App.buildById(cfg.entrants[i].build), 'idle', { scale: 0.9, offset: i });
        App.ui.querySelectorAll('[data-ctrl]').forEach(function (s) { s.addEventListener('change', function () { cfg.entrants[+s.dataset.ctrl].ctrl = s.value; save(); render(); }); });
        App.ui.querySelectorAll('[data-build]').forEach(function (s) { s.addEventListener('change', function () { cfg.entrants[+s.dataset.build].build = s.value; save(); render(); }); });
        App.ui.querySelectorAll('[data-name]').forEach(function (s) { s.addEventListener('change', function () { cfg.entrants[+s.dataset.name].name = s.value.slice(0, 14); save(); render(); }); });
      }
      function save() { App.store.set('cup', cfg); }
      App.on(App.ui, {
        back: function () { App.show('title'); },
        count: function (el) { cfg.count = +el.dataset.n; save(); render(); },
        arena: function (el) { cfg.arena = el.dataset.id; save(); render(); },
        stocks: function (el) { cfg.stocks = +el.dataset.n; save(); render(); },
        lock: function () {
          var entrants = cfg.entrants.slice(0, cfg.count).map(function (e, i) { return { id: 'e' + i, name: e.name, ctrl: e.ctrl, build: e.build, buildSnapshot: Build.sanitize(App.buildById(e.build)) }; });
          cup = { cfg: JSON.parse(JSON.stringify(cfg)), t: T.create(entrants), seed: Date.now() & 0xffff };
          App.show('bracket');
        },
      });
      render();
    },
  };

  App.renderBracket = function (t, opts) {
    opts = opts || {};
    var name = function (id) { var e = id && T.entrant(t, id); return e ? e : null; };
    return '<div class="bracket">' + t.rounds.map(function (round, r) {
      return '<div class="round"><h4>' + T.roundName(r, t.rounds.length) + '</h4>' + round.map(function (m) {
        var side = function (id, slotHasBye) {
          var e = name(id);
          if (!e) return '<div class="p empty">' + (m.bye && m.status === 'done' && slotHasBye ? 'bye' : '—') + '</div>';
          var cls = m.status === 'done' ? (m.winner === id ? 'win' : 'lose') : '';
          var b = e.buildSnapshot || {};
          return '<div class="p ' + cls + '"><span class="seed">' + e.seed + '</span>' + (b.element ? D.ELEMENTS[b.element].icon : '') + ' ' + esc(e.name) + '</div>';
        };
        var act = opts.actions ? opts.actions(m) : '';
        return '<div class="bm ' + m.status + '">' + side(m.a, true) + side(m.b, true) + (act ? '<div class="act">' + act + '</div>' : '') + '</div>';
      }).join('') + '</div>';
    }).join('') + '</div>';
  };

  App.screens.bracket = {
    enter: function () {
      if (!cup) { App.show('cup'); return; }
      var t = cup.t;
      function human(id) { var e = T.entrant(t, id); return e && !isCpu(e.ctrl); }
      function render() {
        var done = t.status === 'done';
        var champ = done ? T.entrant(t, t.champion) : null;
        App.ui.innerHTML = '<div class="screen"><div class="topbar"><button class="btn ghost small" data-act="menu">← Menu</button><h1>' + (done ? 'Champion' : 'Bracket') + '</h1><div class="spacer"></div>' +
          (done ? '<button class="btn hot" data-act="again">New cup</button>' : '<button class="btn ghost small" data-act="abandon">Abandon cup</button>') + '</div>' +
          (done ? '<div class="row" style="align-items:center"><div class="stage-card" style="min-height:300px;width:min(360px,100%)"><canvas data-champ></canvas></div><div><div class="eyebrow">Tournament champion</div><div class="champion">🏆 ' + esc(champ.name) + '</div><p class="muted">' + D.ELEMENTS[champ.buildSnapshot.element].icon + ' ' + esc(champ.buildSnapshot.name) + ' won ' + t.rounds.length + ' rounds.</p></div></div>' : '') +
          '<div class="panel">' + App.renderBracket(t, { actions: function (m) {
            if (m.status !== 'ready') return '';
            var hum = human(m.a) || human(m.b);
            return hum ? '<button class="btn hot small" data-act="play" data-m="' + m.id + '">Play</button>'
              : '<button class="btn small" data-act="watch" data-m="' + m.id + '">Watch</button><button class="btn ghost small" data-act="sim" data-m="' + m.id + '">Simulate</button>';
          } }) + '</div>' +
          (done ? '' : '<p class="dim">Knocked out? Stay and watch the CPU matches: every result comes from a real fight.</p>') + '</div>';
        if (done) App.mini(App.ui.querySelector('[data-champ]'), champ.buildSnapshot, 'victory', { scale: 1.3 });
      }
      function play(m, watch) {
        var ea = T.entrant(t, m.a), eb = T.entrant(t, m.b);
        T.start(t, m.id);
        var fighters = [ea, eb].map(function (e, i) { return { id: e.id, build: e.buildSnapshot, team: i, name: e.name, tapJump: App.settings.tapJump }; });
        var controllers = [ea, eb].map(function (e, i) { return isCpu(e.ctrl) ? { i: i, type: 'bot', level: +e.ctrl.slice(3) } : { i: i, type: 'human', device: e.ctrl, label: e.name }; });
        var labels = [ea.name, eb.name];
        var opts = {
          simOpts: { arena: cup.cfg.arena, stocks: cup.cfg.stocks, timeLimit: 60 * 60 * 6, seed: ++cup.seed, fighters: fighters }, controllers: controllers, label: 'tournament',
          onEnd: function (result, match) {
            App.stopMatch();
            var winner = result.winnerTeam === 0 ? ea.id : eb.id;
            T.reportResult(t, m.id, winner, { reason: result.reason, ticks: result.ticks });
            App.show('results', { result: result, setup: match.setupInfo, labels: labels, mode: 'tournament',
              localTeams: controllers.filter(function (c) { return c.type === 'human'; }).map(function (c) { return c.i; }),
              onContinue: function () { App.show('bracket'); }, continueLabel: 'Back to the bracket' });
          },
          onQuit: function () {
            // Quitting a live cup match forfeits it for the human; CPU-only matches go back to ready.
            var hum = controllers.filter(function (c) { return c.type === 'human'; });
            if (hum.length === 1) T.reportResult(t, m.id, hum[0].i === 0 ? eb.id : ea.id, { reason: 'forfeit' });
            else if (!hum.length) { var mm = T.find(t, m.id); mm.status = 'ready'; }
            else T.reportResult(t, m.id, ea.id, { reason: 'forfeit' });
            App.show('bracket');
          },
        };
        App.startLocalMatch(opts);
        return watch;
      }
      App.on(App.ui, {
        menu: function () { App.show('title'); },
        again: function () { cup = null; App.show('cup'); },
        abandon: function () { if (confirm('Abandon this cup?')) { cup = null; App.show('cup'); } },
        play: function (el) { play(T.find(t, el.dataset.m)); },
        watch: function (el) { play(T.find(t, el.dataset.m), true); },
        sim: function (el) {
          var m = T.find(t, el.dataset.m);
          var ea = T.entrant(t, m.a), eb = T.entrant(t, m.b);
          T.start(t, m.id);
          var r = simulateMatch(ea, eb, cup.cfg, ++cup.seed);
          var w = r.winnerTeam === 0 ? ea : eb;
          T.reportResult(t, m.id, w.id, { reason: r.reason, ticks: r.ticks, simulated: true });
          App.toast(w.name + ' beat ' + (w === ea ? eb : ea).name + ' (' + r.fighters[r.winnerTeam].stocks + ' stock' + (r.fighters[r.winnerTeam].stocks === 1 ? '' : 's') + ' left)');
          render();
        },
      });
      render();
    },
  };

  App.simulateMatch = simulateMatch;
})();
