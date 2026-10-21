/*
 * Dragon Clash — local play: Versus setup (1v1 / 2v2 / 3v3 / free-for-all), Training, and the local Tournament.
 */
(function () {
  'use strict';
  var App = window.DCApp, D = window.DC.Data, Build = window.DC.Build, Sim = window.DC.Sim, Bot = window.DC.Bot, T = window.DC.Tournament, Input = window.DCInput;
  var esc = App.esc;

  function getControls() {
    return App.isTouch()
      ? [['touch', 'Touch screen'], ['kb1', 'Keyboard 1'], ['kb2', 'Keyboard 2'], ['pad0', 'Gamepad 1'], ['pad1', 'Gamepad 2'], ['pad2', 'Gamepad 3'], ['pad3', 'Gamepad 4'], ['cpu1', 'CPU · easy'], ['cpu2', 'CPU · normal'], ['cpu3', 'CPU · hard']]
      : [['kb1', 'Keyboard 1'], ['kb2', 'Keyboard 2'], ['pad0', 'Gamepad 1'], ['pad1', 'Gamepad 2'], ['pad2', 'Gamepad 3'], ['pad3', 'Gamepad 4'], ['touch', 'Touch screen'], ['cpu1', 'CPU · easy'], ['cpu2', 'CPU · normal'], ['cpu3', 'CPU · hard']];
  }
  function ctrlOptions(sel) { return getControls().map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === sel ? ' selected' : '') + '>' + c[1] + '</option>'; }).join(''); }
  var PRESET_ROTATION = ['emberfang-hd', 'frostwing-hd', 'voltscale-hd', 'ironmaw-hd', 'tidefang-hd'];
  function isCpu(c) { return c.indexOf('cpu') === 0; }
  function defaultBuildId(i) { var mine = App.myBuilds(); if (i === 0 && mine[0]) return mine[0].id; return 'preset-' + PRESET_ROTATION[i % PRESET_ROTATION.length]; }

  function arenaPreview(cv, id) {
    var x = cv.getContext('2d'), w = cv.clientWidth || 200, h = cv.clientHeight || 110;
    cv.width = w * 2; cv.height = h * 2; x.scale(2, 2);
    if (id === 'random') {
      // A strip of every arena's painted thumbnail, dimmed under a gilded question mark.
      var g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#22191a'); g.addColorStop(1, '#14100e'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      var srcs = [].slice.call(cv.ownerDocument.querySelectorAll('canvas[data-arena]')).filter(function (c) { return c.dataset.arena !== 'random' && c.width; });
      var sw = w / Math.max(1, srcs.length);
      srcs.forEach(function (c, i) {
        var sx = c.width * (i + 0.5) / srcs.length - c.width / srcs.length / 2;
        x.drawImage(c, sx, 0, c.width / srcs.length, c.height, i * sw, 0, sw + 0.5, h);
      });
      x.fillStyle = 'rgba(12,9,7,.62)'; x.fillRect(0, 0, w, h);
      var v = x.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, Math.max(w, h) * 0.7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = v; x.fillRect(0, 0, w, h);
      var fs = Math.round(Math.min(h * 0.62, w * 0.4)), q = x.createLinearGradient(0, h / 2 - fs / 2, 0, h / 2 + fs / 2);
      q.addColorStop(0, '#fff3d2'); q.addColorStop(0.55, '#e3b45e'); q.addColorStop(1, '#9a5e22');
      x.font = '700 ' + fs + 'px Cinzel, Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = 'rgba(0,0,0,.8)'; x.shadowBlur = 18; x.shadowOffsetY = 3; x.fillStyle = q; x.fillText('?', w / 2, h / 2 + fs * 0.04);
      return;
    }
    var a = D.ARENAS[id];
    window.DCScenery.backdrop(x, a, { x: 800, y: 450 }, w, h, 3);
    x.save(); x.scale(w / 1600, h / 900); x.translate(0, 60); window.DCScenery.platforms(x, a, 0); x.restore();
  }

  App.arenaChoices = function () { return D.ARENA_ORDER.concat(['random']); };
  App.pickArena = function (id) { return id === 'random' || !D.ARENAS[id] ? D.ARENA_ORDER[Math.floor(Math.random() * D.ARENA_ORDER.length)] : id; };
  /** A stage card: painted 16:9 thumbnail, name, a one-line description and chips for what makes the layout different. */
  App.arenaCard = function (id, on) {
    var a = D.ARENAS[id], walls = a && a.platforms.some(function (p) { return p.wall; });
    var soft = a ? a.platforms.filter(function (p) { return !p.solid; }).length : 0, solid = a ? a.platforms.filter(function (p) { return p.solid && !p.wall && !p.altar; }).length : 0;
    var tags = a ? [solid > 1 ? solid + ' floors' : '1 floor', soft ? soft + ' drop-through' : 'No platforms', walls ? 'Walls' : 'Open sides'] : ['New arena every match'];
    var name = a ? a.name : 'Random';
    return '<button class="arena-card' + (id === 'random' ? ' is-random' : '') + (on ? ' on' : '') + '" data-act="arena" data-id="' + id + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
      '<span class="ac-thumb"><canvas data-arena="' + id + '"></canvas><span class="ac-badge" aria-hidden="true">Selected</span></span>' +
      '<span class="ac-body"><span class="ac-name">' + esc(name) + '</span>' +
      '<span class="ac-desc">' + esc(a ? a.blurb || (id === 'skyforge' ? 'The citadel spire at dusk. A wide floor and three platforms.' : 'Twin floes over a frozen rift.') : 'Let fate pick the battlefield from all eight arenas.') + '</span>' +
      '<span class="ac-tags">' + tags.map(function (t) { return '<span class="ac-tag">' + esc(t) + '</span>'; }).join('') + '</span></span></button>';
  };

  // ─────────────────────────────── Versus ───────────────────────────────
  App.screens.versus = {
    enter: function () {
      var cfg = Object.assign({ format: '1v1', arena: 'skyforge', stocks: 3, time: 0, ff: false, slots: [] }, App.store.get('versus', {}));
      function slotCount() { var f = D.FORMATS[cfg.format]; return f.teams * f.perTeam; }
      function normalise() {
        var n = slotCount(), isTouch = App.isTouch();
        for (var i = 0; i < n; i++) {
          if (!cfg.slots[i]) cfg.slots[i] = { ctrl: i === 0 ? App.defaultDevice() : 'cpu2', build: defaultBuildId(i) };
          if (i === 0) {
            if (!isTouch && cfg.slots[i].ctrl === 'touch') cfg.slots[i].ctrl = 'kb1';
            if (isTouch && cfg.slots[i].ctrl === 'kb1') cfg.slots[i].ctrl = 'touch';
          }
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
          '<div class="screen vs-screen"><div class="topbar"><button class="btn ghost small" data-act="back">← Back</button><h1>Versus</h1><div class="spacer"></div>' +
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
                  '<select class="sel" data-slot-build="' + i + '" title="Starting pick on the Dragon Select screen">' + App.buildOptions(s.build) + '</select>' +
                  '<div class="row" style="gap:4px">' + uniq.map(function (e) { return App.matchupChip(b.element, e); }).join('') + '</div>' +
                  '</div></div>';
              }).join('') + '</div>';
          }).join('') + '</div>' +
          '<section class="panel vs-arenas" aria-labelledby="vs-arena-h"><div class="vs-head"><h2 id="vs-arena-h">Choose your arena</h2>' +
          '<span class="vs-pick">' + esc(cfg.arena === 'random' ? 'Random arena' : D.ARENAS[cfg.arena] ? D.ARENAS[cfg.arena].name : '') + '</span></div>' +
          '<div class="arena-cards">' + App.arenaChoices().map(function (id) { return App.arenaCard(id, cfg.arena === id); }).join('') + '</div>' +
          (humanDevices().length ? '<div class="vs-keys"><span class="vs-label">Controls</span>' + humanDevices().map(function (d) { return '<div class="keys">' + App.deviceHint(d) + '</div>'; }).join('') + '</div>' : '') +
          '</section>' +
          '<div class="vs-foot"><div class="vs-settings">' +
          '<div class="vs-set"><span class="vs-label">Stocks</span><div class="seg" role="group" aria-label="Stocks">' + [1, 2, 3, 4, 5].map(function (s) { return '<button class="' + (cfg.stocks === s ? 'on' : '') + '" data-act="stocks" data-n="' + s + '" aria-pressed="' + (cfg.stocks === s) + '">' + s + '</button>'; }).join('') + '</div></div>' +
          '<div class="vs-set"><span class="vs-label">Time</span><div class="seg" role="group" aria-label="Time limit">' + [0, 3, 5, 8].map(function (s) { return '<button class="' + (cfg.time === s ? 'on' : '') + '" data-act="time" data-n="' + s + '" aria-pressed="' + (cfg.time === s) + '">' + (s ? s + ' min' : 'Off') + '</button>'; }).join('') + '</div></div>' +
          (f.perTeam > 1 ? '<label class="vs-set vs-ff"><input type="checkbox" data-ff' + (cfg.ff ? ' checked' : '') + '><span>Friendly fire</span></label>' : '') + '</div>' +
          (probs.length ? '<div class="errors">' + probs.map(esc).join('<br>') + '</div>' : '') +
          '<button class="btn hot vs-go" data-act="start"' + (probs.length ? ' disabled' : '') + '>Choose dragons →</button></div>' +
          '</div>';
        for (var k = 0; k < n; k++) App.mini(App.ui.querySelector('[data-mini="' + k + '"]'), App.buildById(cfg.slots[k].build), 'idle', { facing: teamOf(k) % 2 ? -1 : 1, scale: 0.8, offset: k, hd: true });
        // Random last: its thumbnail is stitched from the others.
        App.ui.querySelectorAll('[data-arena]:not([data-arena="random"])').forEach(function (cv) { arenaPreview(cv, cv.dataset.arena); });
        var rnd = App.ui.querySelector('[data-arena="random"]'); if (rnd) arenaPreview(rnd, 'random');
        App.ui.querySelectorAll('[data-slot-ctrl]').forEach(function (s) { s.addEventListener('change', function () { cfg.slots[+s.dataset.slotCtrl].ctrl = s.value; save(); render(); }); });
        App.ui.querySelectorAll('[data-slot-build]').forEach(function (s) { s.addEventListener('change', function () { cfg.slots[+s.dataset.slotBuild].build = s.value; save(); render(); }); });
        var ff = App.ui.querySelector('[data-ff]'); if (ff) ff.addEventListener('change', function () { cfg.ff = ff.checked; save(); });
      }
      function humanDevices() { var out = []; for (var i = 0; i < slotCount(); i++) if (!isCpu(cfg.slots[i].ctrl)) out.push(cfg.slots[i].ctrl); return out; }
      function save() { App.store.set('versus', cfg); }
      // Fight → Dragon Select (every player picks and dresses a dragon) → the match. Rematch goes back to Select.
      var lastPicks = null;
      function start() {
        var n = slotCount(), human = 0, slots = [];
        for (var i = 0; i < n; i++) {
          var s = cfg.slots[i], cpu = isCpu(s.ctrl);
          if (!cpu) human++;
          var prev = lastPicks && lastPicks[i];
          slots.push({ ctrl: s.ctrl, team: teamOf(i), label: cpu ? 'CPU ' + (i + 1) : 'P' + human, build: prev ? prev.build : s.build, gear: prev ? prev.gear : null, keep: !!prev });
        }
        App.show('select', {
          slots: slots,
          onBack: function () { App.show('versus'); },
          onReady: function (builds, picks) { lastPicks = picks; launch(slots, builds); },
        });
      }
      function launch(slots, builds) {
        var fighters = [], controllers = [], labels = [], localTeams = [];
        slots.forEach(function (sl, i) {
          var b = builds[i];
          fighters.push({ id: 's' + i, build: b, team: sl.team, name: b.name, tapJump: App.settings.tapJump });
          if (isCpu(sl.ctrl)) { controllers.push({ i: i, type: 'bot', level: +sl.ctrl.slice(3) }); labels.push('CPU ' + b.name); }
          else { controllers.push({ i: i, type: 'human', device: sl.ctrl, label: sl.label }); labels.push(sl.label + ' ' + b.name); if (localTeams.indexOf(sl.team) < 0) localTeams.push(sl.team); }
        });
        var simOpts = { arena: App.pickArena(cfg.arena), fighters: fighters, stocks: cfg.stocks, timeLimit: cfg.time * 3600, friendlyFire: cfg.ff, seed: (Date.now() & 0xffff) + 1 };
        var opts = {
          simOpts: simOpts, controllers: controllers, label: 'versus ' + cfg.format,
          restart: function () { simOpts.seed++; App.startLocalMatch(opts); },
          onEnd: function (result, match) {
            var setup = match.setupInfo;
            App.stopMatch();
            App.show('results', { result: result, setup: setup, labels: labels, localTeams: localTeams, mode: 'versus',
              rematchLabel: 'Rematch: pick dragons', onRematch: start, onChange: function () { App.show('versus'); } });
          },
          onQuit: function () { App.show('versus'); },
        };
        App.startLocalMatch(opts);
      }
      App.on(App.ui, {
        back: function () { App.show('title'); },
        format: function (el) { cfg.format = el.dataset.id; save(); render(); },
        arena: function (el) { cfg.arena = el.dataset.id; save(); render(); var c = App.ui.querySelector('.arena-card.on'); if (c) c.focus({ preventScroll: true }); },
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
      var cfg = Object.assign({ build: defaultBuildId(0), device: App.defaultDevice(), dummy: 'preset-ironmaw', mode: 'stand', arena: 'training' }, App.store.get('training', {}));
      if (!App.isTouch() && cfg.device === 'touch') cfg.device = 'kb1';
      if (App.isTouch() && cfg.device === 'kb1') cfg.device = 'touch';
      var MODES = [['stand', 'Standing dummy'], ['jump', 'Jumping dummy'], ['dodge', 'Dodging dummy'], ['cpu1', 'CPU · easy'], ['cpu2', 'CPU · normal'], ['cpu3', 'CPU · hard']];
      function render() {
        App.ui.innerHTML = '<div class="screen"><div class="topbar"><button class="btn ghost small" data-act="back">← Back</button><h1>Training</h1></div>' +
          '<div class="teams">' +
          '<div class="team" style="border-color:' + D.TEAM_COLORS[0] + '"><h3>You</h3><div class="slot"><canvas data-mini="0"></canvas><div class="fields">' +
          '<select class="sel" data-f="build">' + App.buildOptions(cfg.build) + '</select>' +
          '<select class="sel" data-f="device">' + getControls().slice(0, 6).map(function (c) { return '<option value="' + c[0] + '"' + (cfg.device === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></div></div></div>' +
          '<div class="team" style="border-color:' + D.TEAM_COLORS[1] + '"><h3>Opponent</h3><div class="slot"><canvas data-mini="1"></canvas><div class="fields">' +
          '<select class="sel" data-f="dummy">' + App.buildOptions(cfg.dummy) + '</select>' +
          '<select class="sel" data-f="mode">' + MODES.map(function (m) { return '<option value="' + m[0] + '"' + (cfg.mode === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select>' +
          App.matchupChip(App.buildById(cfg.build).element, App.buildById(cfg.dummy).element) + '</div></div></div></div>' +
          '<div class="panel"><div class="row" style="margin-bottom:8px"><span class="eyebrow">Arena</span><select class="sel" data-f="arena">' +
          ['training'].concat(D.ARENA_ORDER).map(function (id) { return '<option value="' + id + '"' + (cfg.arena === id ? ' selected' : '') + '>' + D.ARENAS[id].name + '</option>'; }).join('') + '</select></div>' +
          '<p class="muted" style="margin:0">Unlimited stocks. In training: <kbd>R</kbd> reset positions · <kbd>T</kbd> change dummy · <kbd>[</kbd> <kbd>]</kbd> dummy damage −/+10% · <kbd>`</kbd> hitboxes and launch paths · <kbd>Esc</kbd> pause.</p>' +
          '<div class="keys" style="margin-top:8px">' + App.deviceHint(cfg.device) + '</div></div>' +
          '<div class="row"><div class="grow"></div><button class="btn hot" data-act="start">Start training →</button></div></div>';
        App.mini(App.ui.querySelector('[data-mini="0"]'), App.buildById(cfg.build), 'idle', { scale: 0.95, hd: true });
        App.mini(App.ui.querySelector('[data-mini="1"]'), App.buildById(cfg.dummy), 'idle', { scale: 0.95, facing: -1, hd: true });
        App.ui.querySelectorAll('[data-f]').forEach(function (s) { s.addEventListener('change', function () { cfg[s.dataset.f] = s.value; App.store.set('training', cfg); render(); }); });
      }
      function start() {
        var me = App.buildById(cfg.build), dummy = App.buildById(cfg.dummy);
        var simOpts = { arena: D.ARENAS[cfg.arena] ? cfg.arena : 'training', stocks: 1, training: { infinite: true }, seed: 5,
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
          // A compact bar, styled like the HUD: what you change often is one click away, the move list folds out.
          p.innerHTML = '<div class="tp-row"><span class="tp-title">Training</span>' +
            '<select class="tp-sel" data-tmode title="Dummy behaviour (T)">' + MODES.map(function (m) { return '<option value="' + m[0] + '"' + (mode === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select>' +
            '<span class="tp-dmg"><button data-act="dm" title="[">−</button><b data-tdmg>0%</b><button data-act="dp" title="]">+</button></span>' +
            '<button class="tp-btn" data-act="reset" title="R">↺ Reset</button><button class="tp-btn" data-act="moves">Moves</button></div>' +
            '<div data-body class="tp-body" style="display:none">' + App.moveTable(me) +
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

  // ─────────────────────────────── Tutorial ───────────────────────────────
  // Lessons run in a live training match. Each one names the buttons from the player's own key bindings and is
  // ticked off by a real simulation event, so it can only be passed by actually doing it.
  App.screens.tutorial = {
    enter: function () {
      var cfg = Object.assign({ build: 'preset-emberfang', device: App.defaultDevice() }, App.store.get('tutorial', {}));
      if (!App.isTouch() && cfg.device === 'touch') cfg.device = 'kb1';
      if (App.isTouch() && cfg.device === 'kb1') cfg.device = 'touch';
      App.ui.innerHTML = '<div class="screen"><div class="topbar"><button class="btn ghost small" data-act="back">← Back</button><h1>Tutorial</h1></div>' +
        '<div class="panel"><p class="muted" style="margin-top:0">Fourteen short lessons, from running to Dragon Fury. Each one is checked by the game, so you learn it by doing it. A sparring dragon helps with guarding and parrying. <kbd>Esc</kbd> pauses; you can skip a lesson there.</p>' +
        '<div class="row"><span class="eyebrow">Dragon</span><select class="sel" data-f="build">' + App.buildOptions(cfg.build) + '</select>' +
        '<span class="eyebrow">Controls</span><select class="sel" data-f="device">' + getControls().slice(0, 6).map(function (c) { return '<option value="' + c[0] + '"' + (cfg.device === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="keys" style="margin-top:8px">' + App.deviceHint(cfg.device) + '</div></div>' +
        '<div class="row"><div class="grow"></div><button class="btn hot" data-act="start">Start the tutorial →</button></div></div>';
      App.ui.querySelectorAll('[data-f]').forEach(function (s) { s.addEventListener('change', function () { cfg[s.dataset.f] = s.value; App.store.set('tutorial', cfg); App.show('tutorial'); }); });
      App.on(App.ui, { back: function () { App.show('title'); }, start: function () { runTutorial(cfg); } });
    },
  };

  function runTutorial(cfg) {
    var me = App.buildById(cfg.build), dummy = App.buildById('preset-ironmaw');
    var b = Input.binds()[cfg.device] || Input.binds().kb1, pad = cfg.device.indexOf('pad') === 0, touch = cfg.device === 'touch';
    var TOUCH = { left: 'stick', right: 'stick', up: 'stick up', down: 'stick down', jump: 'Jump', light: 'Light', heavy: 'Heavy', sig: 'Special', guard: 'Guard', dodge: 'Dodge', gear: 'Gear', taunt: 'Taunt' };
    function k(a) { if (touch) return '<kbd>' + TOUCH[a] + '</kbd>'; if (pad) { var pb = Input.padBinds()[a]; return '<kbd>' + (pb ? Input.padName(pb[0]) : a) + '</kbd>'; } return '<kbd>' + esc(Input.keyName((b[a] || ['?'])[0])) + '</kbd>'; }
    var mv = pad || touch ? '<kbd>stick</kbd>' : k('left') + k('right');
    var runT = 0;
    var LESSONS = [
      { t: 'Move', d: 'Run left and right with ' + mv + '.', tick: function (F) { if (F.state === 'run') runT++; return runT > 50; } },
      { t: 'Jump', d: 'Jump with ' + k('jump') + ', then press it again in the air for an air jump.', ev: function (e) { return e.type === 'jump' && e.air && e.f === 0; } },
      { t: 'Light attack', d: 'Walk up to the dummy and hit it with ' + k('light') + '. Hold a direction for different attacks.', ev: function (e) { return e.type === 'hit' && e.by === 0 && e.kind === 'light'; } },
      { t: 'Heavy attack', d: 'Heavy ' + k('heavy') + ' is slower and hits harder. Land one.', ev: function (e) { return e.type === 'hit' && e.by === 0 && e.kind === 'heavy'; } },
      { t: 'Signature', d: 'Your elemental move: ' + k('sig') + '. Hold ' + k('down') + ' with it for your elemental ability.', ev: function (e) { return e.type === 'attack' && e.f === 0 && (e.kind === 'sig' || e.kind === 'ability'); } },
      { t: 'Dodge', d: 'Tap ' + k('dodge') + ' to dodge in place, or with a direction to dash. You are invulnerable for a moment.', tick: function (F) { return F.state === 'dodge'; } },
      { t: 'Guard', d: 'The sparring dragon attacks now. Hold ' + k('guard') + ' to block its jab.', dummy: 'jab', ev: function (e) { return e.type === 'block' && e.target === 0; } },
      { t: 'Perfect parry', d: 'Let go of Guard, then press ' + k('guard') + ' just as the jab arrives. Too early and you only block.', dummy: 'jab', ev: function (e) { return e.type === 'parry' && e.f === 0; } },
      { t: 'Grab and throw', d: 'Guards cannot stop a grab. Hold ' + k('guard') + ' and press ' + k('light') + ' next to the dummy.', ev: function (e) { return e.type === 'throw' && e.f === 0; } },
      { t: 'Cancel', d: 'Hit with ' + k('light') + ' and press ' + k('heavy') + ' straight away: the heavy cancels the light\'s recovery.', ev: function (e) { return e.type === 'cancel' && e.f === 0; } },
      { t: 'Combo', d: 'Land a combo of 3 or more: try ' + k('light') + ' → ' + k('heavy') + ' → ' + k('sig') + ' as fast as you can.', ev: function (e) { return (e.type === 'hit' && e.by === 0 && e.combo >= 3); } },
      { t: 'EX special', d: 'You have one bar of meter. Hold ' + k('guard') + ' and press ' + k('sig') + ' for a faster, stronger, armoured EX special.', meter: 100, ev: function (e) { return e.type === 'attack' && e.f === 0 && e.ex; } },
      { t: 'Dragon Fury', d: 'A full meter: hold ' + k('guard') + ' and press ' + k('heavy') + ' to unleash your super.', meter: 300, ev: function (e) { return e.type === 'super' && e.f === 0; } },
      { t: 'Taunt', d: 'Show off with ' + k('taunt') + '. It fills a little meter, if nobody hits you first.', ev: function (e) { return e.type === 'taunt' && e.f === 0; } },
    ];
    var step = 0, doneT = 0, panelEl = null;
    var simOpts = { arena: 'training', stocks: 1, training: { infinite: true }, seed: 11,
      fighters: [{ id: 'me', build: me, team: 0, name: me.name, tapJump: App.settings.tapJump }, { id: 'dummy', build: dummy, team: 1, name: 'Sparring' }] };
    var controllers = [{ i: 0, type: 'human', device: cfg.device, label: 'You' }, { i: 1, type: 'bot', mode: 'stand' }];
    var opts = {
      simOpts: simOpts, controllers: controllers, training: { dummy: 1 }, label: 'tutorial',
      restart: function () { App.startLocalMatch(opts); begin(); },
      onQuit: function () { App.show('tutorial'); },
      onEvent: function (e) { var L = LESSONS[step]; if (L && !doneT && L.ev && L.ev(e)) pass(); },
    };
    function setup() {
      var m = App.match, L = LESSONS[step];
      if (!m || !L) return;
      m.setDummyMode(L.dummy || 'stand');
      if (L.meter || L.dummy) m.trainingReset();
      m.sim.fighters[0].meter = L.meter || 0;
      runT = 0;
      render();
    }
    function pass() { doneT = 70; window.DCAudio.play('select'); render(); }
    function render() {
      if (!panelEl) return;
      var L = LESSONS[step];
      if (!L) {
        panelEl.innerHTML = '<h4>Tutorial complete!</h4><p>You know every tool now. Try Versus against a CPU, or Training to practise combos.</p><div class="row"><button class="btn hot small" data-act="tq">Back to the menu</button></div>';
        return;
      }
      panelEl.innerHTML = '<div class="dim" style="font-size:12px">Lesson ' + (step + 1) + ' of ' + LESSONS.length + '</div><h4>' + L.t + '</h4><p>' + L.d + '</p>' +
        (doneT ? '<div class="tut-done">' + window.DCIcons.svg('check', '#5af08a', 16) + ' Nice! Next lesson…</div>' : '') +
        '<div class="tut-steps">' + LESSONS.map(function (x, i) { return '<i class="' + (i < step || (i === step && doneT) ? 'done' : i === step ? 'now' : '') + '"></i>'; }).join('') + '</div>' +
        '<div class="row" style="margin-top:8px"><button class="btn ghost small" data-act="tskip">Skip lesson</button></div>';
    }
    function begin() {
      panelEl = document.createElement('div'); panelEl.className = 'tut-panel';
      document.getElementById('ui').appendChild(panelEl);
      App.on(panelEl, { tskip: function () { step++; doneT = 0; setup(); }, tq: function () { App.stopMatch(); App.show('title'); } });
      setup();
      var iv = setInterval(function () {
        var m = App.match;
        if (!m || !document.body.contains(panelEl)) { clearInterval(iv); return; }
        if (m.paused) return;
        var L = LESSONS[step];
        if (L && !doneT && L.tick && L.tick(m.sim.fighters[0])) pass();
        if (doneT && (doneT -= 3) <= 0) { doneT = 0; step++; setup(); }
      }, 50);
    }
    App.startLocalMatch(opts);
    begin();
  }

  // ─────────────────────────────── Local tournament ───────────────────────────────
  var cup = null; // { t, cfg, entrants }

  /** Runs a whole CPU-vs-CPU match headless: a real simulation, so the result is earned, not invented. */
  function simulateMatch(ea, eb, cfg, seed) {
    var sim = new Sim({ arena: App.pickArena(cfg.arena), stocks: cfg.stocks, timeLimit: 60 * 60 * 4, seed: seed,
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
        var isTouch = App.isTouch();
        for (var i = 0; i < 8; i++) {
          if (!cfg.entrants[i]) cfg.entrants[i] = { name: i === 0 ? 'You' : 'CPU ' + (i + 1), ctrl: i === 0 ? App.defaultDevice() : 'cpu2', build: defaultBuildId(i) };
          if (i === 0) {
            if (!isTouch && cfg.entrants[i].ctrl === 'touch') cfg.entrants[i].ctrl = 'kb1';
            if (isTouch && cfg.entrants[i].ctrl === 'kb1') cfg.entrants[i].ctrl = 'touch';
          }
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
          '<div class="panel row"><span class="eyebrow">Arena</span><div class="chips">' + App.arenaChoices().map(function (id) { return '<button class="chip' + (cfg.arena === id ? ' on' : '') + '" data-act="arena" data-id="' + id + '">' + (id === 'random' ? 'Random' : D.ARENAS[id].name) + '</button>'; }).join('') + '</div>' +
          '<span class="eyebrow">Stocks</span><div class="chips">' + [1, 2, 3].map(function (n) { return '<button class="chip' + (cfg.stocks === n ? ' on' : '') + '" data-act="stocks" data-n="' + n + '">' + n + '</button>'; }).join('') + '</div></div>' +
          (probs.length ? '<div class="errors">' + probs.map(esc).join('<br>') + '</div>' : '') +
          '<div class="row"><div class="grow"></div><button class="btn hot" data-act="lock"' + (probs.length ? ' disabled' : '') + '>Lock in & start the cup →</button></div></div>';
        for (var i = 0; i < cfg.count; i++) App.mini(App.ui.querySelector('[data-mini="' + i + '"]'), App.buildById(cfg.entrants[i].build), 'idle', { scale: 0.9, offset: i, hd: true });
        App.ui.querySelectorAll('[data-ctrl]').forEach(function (s) { s.addEventListener('change', function () { cfg.entrants[+s.dataset.ctrl].ctrl = s.value; save(); render(); }); });
        App.ui.querySelectorAll('[data-build]').forEach(function (s) { s.addEventListener('change', function () { cfg.entrants[+s.dataset.build].build = s.value; save(); render(); }); });
        App.ui.querySelectorAll('[data-name]').forEach(function (s) { s.addEventListener('change', function () { cfg.entrants[+s.dataset.name].name = s.value.slice(0, 14); save(); render(); }); });
      }
      function save() { App.store.set('cup', cfg); }
      App.on(App.ui, {
        back: function () { App.show('title'); },
        count: function (el) { cfg.count = +el.dataset.n; save(); render(); },
        arena: function (el) { cfg.arena = el.dataset.id; save(); render(); var c = App.ui.querySelector('.arena-card.on'); if (c) c.focus({ preventScroll: true }); },
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
          return '<div class="p ' + cls + '"><span class="seed">' + e.seed + '</span>' + (b.element ? App.elIcon(b.element) : '') + ' ' + esc(e.name) + '</div>';
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
          (done ? '<div class="row" style="align-items:center"><div class="stage-card" style="min-height:300px;width:min(360px,100%)"><canvas data-champ></canvas></div><div><div class="eyebrow">Tournament champion</div><div class="champion">' + window.DCIcons.svg('cup', '#ffcf3a', 30) + ' ' + esc(champ.name) + '</div><p class="muted">' + App.elIcon(champ.buildSnapshot.element) + ' ' + esc(champ.buildSnapshot.name) + ' won ' + t.rounds.length + ' rounds.</p></div></div>' : '') +
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
          simOpts: { arena: App.pickArena(cup.cfg.arena), stocks: cup.cfg.stocks, timeLimit: 60 * 60 * 6, seed: ++cup.seed, fighters: fighters }, controllers: controllers, label: 'tournament',
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
        abandon: function () { App.confirmAsk('Abandon this cup?', 'Abandon', function () { cup = null; App.show('cup'); }); },
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
