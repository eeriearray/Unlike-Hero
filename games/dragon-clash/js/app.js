/*
 * Dragon Clash — app shell: storage, screens, the menu backdrop, title, how to play, settings, pause and results.
 * Screens are plain DOM built from template strings; clicks are handled by data-act attributes.
 */
(function () {
  'use strict';
  var D = window.DC.Data, Build = window.DC.Build, Art = window.DCArt, Anim = window.DCAnim, FXL = window.DCFX, Audio = window.DCAudio, Input = window.DCInput;

  var hub = window.Hub ? window.Hub.init({ id: 'dragon-clash', version: '1.0.0', title: 'Dragon Clash' }) : null;
  var store = hub ? hub.storage('dragon-clash') : {
    get: function (k, d) { try { var v = localStorage.getItem('dragon-clash.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('dragon-clash.' + k, JSON.stringify(v)); } catch (e) { /* unavailable */ } },
  };

  var ui = document.getElementById('ui');
  var canvas = document.getElementById('game');
  var App = window.DCApp = { store: store, hub: hub, ui: ui, canvas: canvas, match: null, screen: null };

  // ─────────────── settings ───────────────
  App.settings = Object.assign({ music: 0.35, sfx: 0.8, voice: 0.85, shake: 1, debug: false, tapJump: true }, store.get('settings', {}));
  App.saveSettings = function () { store.set('settings', App.settings); Audio.setVolumes(App.settings); };
  Input.load(store.get('binds', null));
  Audio.setVolumes(App.settings);
  document.addEventListener('pointerdown', function () { Audio.init(); }, { once: false });
  document.addEventListener('keydown', function () { Audio.init(); }, { once: false });

  // ─────────────── builds ───────────────
  App.myBuilds = function () {
    return (store.get('builds', []) || []).filter(function (b) { return Build.validateBuild(b).ok; });
  };
  App.saveBuilds = function (list) { store.set('builds', list.map(Build.sanitize)); };
  App.presets = function () { return D.PRESETS.map(function (p) { return Build.presetBuild(p.id); }); };
  App.allBuilds = function () { return App.myBuilds().concat(App.presets()); };
  App.buildById = function (id) {
    var all = App.allBuilds();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return all[0];
  };
  App.buildOptions = function (selected) {
    var mine = App.myBuilds(), pre = App.presets();
    function opt(b) { return '<option value="' + esc(b.id) + '"' + (b.id === selected ? ' selected' : '') + '>' + D.ELEMENTS[b.element].icon + ' ' + esc(b.name) + '</option>'; }
    return (mine.length ? '<optgroup label="My dragons">' + mine.map(opt).join('') + '</optgroup>' : '') + '<optgroup label="Archetypes">' + pre.map(opt).join('') + '</optgroup>';
  };

  // ─────────────── helpers ───────────────
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  App.esc = esc;
  App.toast = function (msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  };
  App.click = function (sel, fn) { ui.querySelectorAll(sel).forEach(function (el) { el.addEventListener('click', function (e) { Audio.play('ui'); fn(el, e); }); }); };
  // The screen root keeps one listener whose handlers are replaced per screen; overlays get their own.
  var uiHandlers = {};
  function dispatch(root, handlers, e) {
    var el = e.target.closest('[data-act]');
    if (!el || !root.contains(el) || el.disabled) return;
    var h = handlers[el.dataset.act];
    if (h) { Audio.play('ui'); h(el, e); }
  }
  ui.addEventListener('click', function (e) { dispatch(ui, uiHandlers, e); });
  App.on = function (root, handlers) {
    if (root === ui) { uiHandlers = handlers; return; }
    root.addEventListener('click', function (e) { dispatch(root, handlers, e); });
  };

  // Mini dragon canvases animated by one shared loop.
  var minis = [];
  App.mini = function (cv, build, kind, opts) {
    if (!cv) return;
    minis = minis.filter(function (m) { return m.cv !== cv && document.body.contains(m.cv); });
    minis.push({ cv: cv, build: build, kind: kind || 'idle', opts: opts || {} });
  };
  App.clearMinis = function () { minis = []; };
  function drawMinis(t) {
    minis = minis.filter(function (m) { return document.body.contains(m.cv); });
    minis.forEach(function (m) {
      var cv = m.cv, w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      var x = cv.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
      var scale = (m.opts.scale || 1) * h / 190;
      x.save(); x.translate(w / 2 + (m.opts.dx || 0) * scale, h - 8 * scale); x.scale(scale, scale);
      x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(0, 0, 40, 7, 0, 0, Math.PI * 2); x.fill();
      var pose = m.kind === 'idle' ? { time: t + (m.opts.offset || 0), facing: m.opts.facing || 1, element: m.build.element } : Anim.showcase(m.kind, m.build, t + (m.opts.offset || 0), m.opts.facing || 1);
      Art.draw(x, m.build.look, m.build.body, pose);
      x.restore();
    });
  }

  // ─────────────── menu backdrop on the main canvas ───────────────
  var menuT0 = performance.now();
  var menuDragons = [Build.presetBuild('emberfang'), Build.presetBuild('frostwing')];
  App.menuBackdrop = { arena: D.ARENAS.skyforge, dragons: true };
  function drawMenu(t) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = window.innerWidth, H = window.innerHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; }
    var x = canvas.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    var arena = App.menuBackdrop.arena;
    var z = Math.min(W / 1500, H / 820);
    var cam = { x: 800, y: 470 };
    window.DCScenery.backdrop(x, arena, cam, W, H, t);
    x.save(); x.translate(W / 2, H / 2); x.scale(z, z); x.translate(-cam.x, -cam.y);
    window.DCScenery.platforms(x, arena, t);
    if (App.menuBackdrop.dragons) {
      var a = menuDragons[0], b = menuDragons[1];
      x.save(); x.translate(560, 640); x.scale(1.25, 1.25); Art.draw(x, a.look, a.body, { time: t, facing: 1, element: a.element }); x.restore();
      x.save(); x.translate(1040, 640); x.scale(1.25, 1.25); Art.draw(x, b.look, b.body, { time: t + 1.3, facing: -1, element: b.element }); x.restore();
    }
    x.restore();
  }

  function loop(now) {
    var t = (now - menuT0) / 1000;
    if (!App.match) drawMenu(t);
    drawMinis(t);
    requestAnimationFrame(loop);
  }

  // ─────────────── screens ───────────────
  App.screens = {};
  App.show = function (name, arg) {
    Audio.init();
    if (App.screen && App.screens[App.screen] && App.screens[App.screen].leave) App.screens[App.screen].leave();
    App.screen = name;
    ui.innerHTML = '';
    uiHandlers = {};
    App.clearMinis();
    App.menuBackdrop.dragons = name === 'title';
    var s = App.screens[name];
    if (s) s.enter(arg);
    ui.scrollTop = 0;
  };

  App.screens.title = {
    enter: function () {
      menuDragons = shuffle(App.presets()).slice(0, 2);
      ui.innerHTML =
        '<div class="screen title">' +
        '<h1 class="logo">DRAGON<span>CLASH</span></h1>' +
        '<p class="tag">Forge your dragon. Knock your rivals off the Spire. Skill decides every fight: no levels, no grinding.</p>' +
        '<div class="menu-grid">' +
        card('versus', 'mc-versus', '⚔️', 'Versus', '1v1, 2v2, 3v3 on one screen') +
        card('online', 'mc-online', '🌐', 'Online', 'Rooms and cups across devices') +
        card('cup', 'mc-cup', '🏆', 'Tournament', '4–8 dragons, one champion') +
        card('training', 'mc-train', '🎯', 'Training', 'Practice on a dummy') +
        card('forge', 'mc-forge', '🐉', 'Dragon Forge', 'Build and paint your dragon') +
        '</div>' +
        '<div class="menu-foot">' +
        '<button class="btn ghost small" data-act="howto">How to play</button>' +
        '<button class="btn ghost small" data-act="settings">Controls & settings</button>' +
        (hub && hub.inHub ? '<button class="btn ghost small" data-act="exit">Back to the hub</button>' : '<a class="btn ghost small" href="../../index.html">Game hub</a>') +
        '</div></div>';
      App.on(ui, {
        versus: function () { App.show('versus'); }, online: function () { App.show('online'); }, cup: function () { App.show('cup'); },
        training: function () { App.show('training'); }, forge: function () { App.show('forge'); },
        howto: function () { App.show('howto'); }, settings: function () { App.show('settings'); }, exit: function () { hub.exit(); },
      });
      function card(act, cls, emoji, title, sub) {
        return '<button class="menu-card ' + cls + '" data-act="' + act + '"><span class="emoji">' + emoji + '</span><b>' + title + '</b><small>' + sub + '</small></button>';
      }
    },
  };

  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ─────────────── element wheel (SVG) ───────────────
  App.wheel = function (highlight, size) {
    size = size || 220;
    var order = ['fire', 'ice', 'earth', 'lightning', 'water'];
    var r = size * 0.36, c = size / 2;
    var pts = order.map(function (e, i) { var a = -Math.PI / 2 + i * Math.PI * 2 / 5; return [c + Math.cos(a) * r, c + Math.sin(a) * r]; });
    var s = '<svg class="wheel" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">';
    s += '<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#fff"/></marker></defs>';
    order.forEach(function (e, i) {
      var a = pts[i], b = pts[(i + 1) % 5];
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy), k = 26 / l;
      var on = highlight && (e === highlight || order[(i + 1) % 5] === highlight);
      s += '<line x1="' + (a[0] + dx * k) + '" y1="' + (a[1] + dy * k) + '" x2="' + (b[0] - dx * k) + '" y2="' + (b[1] - dy * k) + '" stroke="' + (on ? '#fff' : 'rgba(255,255,255,.35)') + '" stroke-width="' + (on ? 3 : 2) + '" marker-end="url(#arr)"/>';
    });
    order.forEach(function (e, i) {
      var el = D.ELEMENTS[e], p = pts[i], on = e === highlight;
      s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (on ? 24 : 20) + '" fill="' + el.color + '" fill-opacity="' + (on ? 1 : 0.55) + '" stroke="#fff" stroke-width="' + (on ? 3 : 0) + '"/>';
      s += '<text x="' + p[0] + '" y="' + (p[1] + 7) + '" font-size="20" text-anchor="middle">' + el.icon + '</text>';
    });
    s += '<text x="' + c + '" y="' + (c + 4) + '" text-anchor="middle" font-size="11" font-weight="800" fill="#b9acdf">beats →</text></svg>';
    return s;
  };

  App.matchupChip = function (a, b) {
    var m = D.matchup(a, b);
    var pct = Math.round(D.ELEMENT_CONFIG.counterBonus * 100);
    var txt = m === 'advantage' ? '▲ +' + pct + '% elemental' : m === 'disadvantage' ? '▼ −' + Math.round(D.ELEMENT_CONFIG.counterPenalty * 100) + '% elemental' : '= neutral';
    return '<span class="matchup ' + m + '" title="Applies to elemental damage only">' + D.ELEMENTS[a].icon + ' vs ' + D.ELEMENTS[b].icon + ' ' + txt + '</span>';
  };

  // ─────────────── how to play ───────────────
  App.screens.howto = {
    enter: function () {
      var b = Input.binds();
      var k = function (dev, a) { return b[dev][a].map(function (c) { return '<kbd>' + esc(Input.keyName(c)) + '</kbd>'; }).join(' '); };
      var moveRows = [
        ['Light', 'jab', 'utilt', 'dtilt', 'nair / fair', 'uair', 'dair'],
        ['Heavy', 'fsmash', 'usmash', 'dsmash', 'fheavyAir', 'wingBurst', 'meteor'],
      ];
      var mv = function (id) { var m = D.MOVES[id]; return '<b>' + m.name + '</b> <span class="dim">' + (m.phys + m.elem) + '% · ' + m.startup + 'f</span>'; };
      ui.innerHTML =
        '<div class="screen"><div class="topbar"><button class="btn ghost small" data-act="back">← Back</button><h1>How to play</h1></div>' +
        '<div class="howto">' +
        '<div class="panel"><h3>Win by ring-out</h3><p class="muted">Hits raise damage %. The higher it is, the farther a dragon flies. Knock rivals past the edge of the screen to take a stock. Last dragon (or team) with stocks wins.</p>' +
        '<p class="muted">Defend with <b>dodges</b> (brief invulnerability), <b>air jumps</b>, the <b>Wing Burst</b> recovery (Up + Heavy in the air, once per jump), <b>ledge grabs</b>, and by holding a direction while you are hit to bend your launch.</p></div>' +
        '<div class="panel"><h3>Controls</h3><table class="movelist">' +
        '<tr><td>Move</td><td>' + k('kb1', 'left') + k('kb1', 'right') + ' or arrows</td><td>' + k('kb2', 'left') + k('kb2', 'right') + '</td></tr>' +
        '<tr><td>Jump</td><td>' + k('kb1', 'jump') + ' ' + k('kb1', 'up') + '</td><td>' + k('kb2', 'up') + ' ' + k('kb2', 'jump') + '</td></tr>' +
        '<tr><td>Down / drop</td><td>' + k('kb1', 'down') + '</td><td>' + k('kb2', 'down') + '</td></tr>' +
        '<tr><td>Dash / dodge</td><td>' + k('kb1', 'dodge') + '</td><td>' + k('kb2', 'dodge') + '</td></tr>' +
        '<tr><td>Light</td><td>' + k('kb1', 'light') + '</td><td>' + k('kb2', 'light') + '</td></tr>' +
        '<tr><td>Heavy</td><td>' + k('kb1', 'heavy') + '</td><td>' + k('kb2', 'heavy') + '</td></tr>' +
        '<tr><td>Signature</td><td>' + k('kb1', 'sig') + '</td><td>' + k('kb2', 'sig') + '</td></tr>' +
        '<tr><td>Elemental ability</td><td>' + k('kb1', 'down') + ' + ' + k('kb1', 'sig') + '</td><td>' + k('kb2', 'down') + ' + ' + k('kb2', 'sig') + '</td></tr>' +
        '<tr><td>Pause</td><td><kbd>Esc</kbd></td><td><kbd>Esc</kbd> · gamepad Start</td></tr>' +
        '</table><p class="dim">Columns: Keyboard 1, Keyboard 2. Gamepads: stick/d-pad move, A jump, X light, Y heavy, B signature, bumpers dodge. Remap in Controls & settings.</p></div>' +
        '<div class="panel"><h3>Moves</h3><table class="movelist"><tr class="dim"><td></td><td>Ground</td><td>Up</td><td>Down</td><td>Air</td><td>Air up</td><td>Air down</td></tr>' +
        moveRows.map(function (r) { return '<tr><td><b>' + r[0] + '</b></td>' + r.slice(1).map(function (id) { return '<td>' + id.split(' / ').map(mv).join('<br>') + '</td>'; }).join('') + '</tr>'; }).join('') +
        '</table><p class="dim">Hold a direction when you press the button. % = damage, f = startup frames (60 per second). Heavies hit harder and leave you open longer.</p></div>' +
        '<div class="panel"><h3>Elements</h3><div class="row"><div>' + App.wheel(null, 200) + '</div><div class="grow"><p class="muted">Each element beats the next one around the wheel. Against an element you beat, your <b>elemental</b> damage is +' + Math.round(D.ELEMENT_CONFIG.counterBonus * 100) + '%; against one that beats you, −' + Math.round(D.ELEMENT_CONFIG.counterPenalty * 100) + '%. Claws, horns and tails are physical and never change. Knockback, speed and recovery never change.</p><p class="muted">The wheel is a hint, not a verdict: the better player wins.</p></div></div>' +
        Object.keys(D.INTERACTIONS).map(function (id) { var r = D.INTERACTIONS[id]; return '<div class="rule"><span class="ico">' + r.icon + '</span><span>' + r.text + '</span></div>'; }).join('') +
        Object.keys(D.STATUS).map(function (id) { return '<div class="rule"><span class="ico">' + { chill: '🥶', burn: '🔥', soaked: '💦' }[id] + '</span><span>' + D.STATUS[id].text + '. Never stacks.</span></div>'; }).join('') +
        '</div>' +
        '<div class="panel"><h3>Builds</h3><p class="muted">Every dragon spends the same ' + D.BUDGET + ' points on a body, mobility, a signature move, an elemental ability and one upgrade. Nothing is unlocked by playing, and colours, horns, wings and other looks never change a fight.</p></div>' +
        '</div></div>';
      App.on(ui, { back: function () { App.show('title'); } });
    },
  };

  // ─────────────── settings & remapping ───────────────
  App.screens.settings = {
    enter: function () {
      var waiting = null, unKey = null;
      function render() {
        var b = Input.binds();
        var conf = Input.conflicts(['kb1', 'kb2']);
        var row = function (a) {
          return '<tr><td>' + Input.LABELS[a] + '</td>' + ['kb1', 'kb2'].map(function (d) {
            var w = waiting && waiting.dev === d && waiting.a === a;
            return '<td><button class="icon-btn ' + (w ? 'wait' : '') + '" data-act="bind" data-dev="' + d + '" data-a="' + a + '">' + (w ? 'press a key…' : b[d][a].map(Input.keyName).join(' / ') || '—') + '</button></td>';
          }).join('') + '</tr>';
        };
        ui.innerHTML =
          '<div class="screen"><div class="topbar"><button class="btn ghost small" data-act="back">← Back</button><h1>Controls & settings</h1></div>' +
          '<div class="howto">' +
          '<div class="panel"><h3>Sound and screen</h3>' +
          slider('Music', 'music', App.settings.music) + slider('Effects', 'sfx', App.settings.sfx) + slider('Announcer', 'voice', App.settings.voice) + slider('Screen shake', 'shake', App.settings.shake) +
          '<label class="row"><input type="checkbox" data-set="tapJump"' + (App.settings.tapJump ? ' checked' : '') + '> Up also jumps (tap jump)</label>' +
          '<label class="row"><input type="checkbox" data-set="debug"' + (App.settings.debug ? ' checked' : '') + '> Developer overlay: hitboxes, hurtboxes, cooldowns, launch paths (toggle in a match with <kbd>`</kbd>)</label>' +
          '</div>' +
          '<div class="panel"><h3>Keyboard layouts</h3><p class="dim">Click a key to change it. Two players can share one keyboard: Keyboard 1 on the left, Keyboard 2 on the arrows and numpad.</p>' +
          '<table class="remap movelist"><tr class="dim"><td></td><td>Keyboard 1</td><td>Keyboard 2</td></tr>' + Input.ACTIONS.map(row).join('') + '</table>' +
          (conf.length ? '<p class="errors">Used twice: ' + conf.map(esc).join(', ') + '</p>' : '<p class="ok-text">No shared keys between the two layouts.</p>') +
          '<div class="row"><button class="btn ghost small" data-act="reset" data-dev="kb1">Reset Keyboard 1</button><button class="btn ghost small" data-act="reset" data-dev="kb2">Reset Keyboard 2</button></div>' +
          '<p class="dim">Gamepads: stick or d-pad move, A jump, X light, Y heavy, B signature, bumpers/triggers dodge, Start pauses. Connected now: ' + (Input.connectedPads().length || 'none (press a button to wake one)') + '.</p></div>' +
          '</div></div>';
        ui.querySelectorAll('input[type=range]').forEach(function (r) {
          r.addEventListener('input', function () { App.settings[r.dataset.set] = +r.value; App.saveSettings(); });
          r.addEventListener('change', function () { Audio.play('hit', { kb: 8 }); });
        });
        ui.querySelectorAll('input[type=checkbox]').forEach(function (c) { c.addEventListener('change', function () { App.settings[c.dataset.set] = c.checked; App.saveSettings(); }); });
      }
      function slider(label, key, v) { return '<label class="row"><span style="width:110px">' + label + '</span><input type="range" min="0" max="1" step="0.05" value="' + v + '" data-set="' + key + '" class="grow"></label>'; }
      App.on(ui, {
        back: function () { App.show('title'); },
        bind: function (el) { waiting = { dev: el.dataset.dev, a: el.dataset.a }; render(); },
        reset: function (el) { Input.reset(el.dataset.dev); store.set('binds', Input.binds()); render(); },
      });
      unKey = Input.onKey(function (e) {
        if (!waiting) return;
        e.preventDefault();
        if (e.code !== 'Escape') { Input.setBinding(waiting.dev, waiting.a, [e.code]); store.set('binds', Input.binds()); }
        waiting = null; render();
      });
      this.leave = function () { if (unKey) unKey(); };
      render();
    },
  };

  // ─────────────── running a local match ───────────────
  /**
   * opts: { simOpts, controllers, training, onEnd(result), onQuit(), restart() }
   */
  App.startLocalMatch = function (opts) {
    App.stopMatch();
    ui.innerHTML = '';
    App.clearMinis();
    var helpKeys = opts.controllers.filter(function (c) { return c.type === 'human'; }).map(function (c) { return App.deviceHint(c.device, c.label); }).join(' &nbsp;·&nbsp; ');
    var m = new window.DCMatch({
      canvas: canvas, mode: 'local', simOpts: opts.simOpts, controllers: opts.controllers, training: opts.training, settings: App.settings,
      onPause: function (p) { App.pauseOverlay(p, opts); },
      onEnd: function (result, match) { if (opts.onEnd) opts.onEnd(result, match); },
      onTrainingKey: opts.onTrainingKey,
    });
    App.match = m;
    if (hub) hub.report('session-start', { mode: opts.label || 'local' });
    var help = document.createElement('div'); help.className = 'match-help'; help.innerHTML = helpKeys + ' &nbsp;·&nbsp; <kbd>Esc</kbd> pause';
    ui.appendChild(help);
    setTimeout(function () { help.style.opacity = '0'; }, 7000);
    return m;
  };

  App.deviceHint = function (dev, label) {
    var b = Input.binds();
    if (dev.indexOf('pad') === 0) return '<b>' + esc(label || Input.DEVICE_NAMES[dev]) + '</b> gamepad';
    var k = function (a) { return '<kbd>' + esc(Input.keyName(b[dev][a][0] || '?')) + '</kbd>'; };
    return '<b>' + esc(label || Input.DEVICE_NAMES[dev]) + '</b> ' + k('left') + k('right') + ' move ' + (b[dev].jump[0] ? k('jump') : k('up')) + ' jump ' + k('light') + k('heavy') + k('sig') + ' attacks ' + k('dodge') + ' dodge';
  };

  App.stopMatch = function () {
    if (App.match) { App.match.destroy(); App.match = null; }
    var o = document.querySelector('.overlay'); if (o) o.remove();
  };

  App.pauseOverlay = function (on, opts) {
    var old = document.querySelector('.overlay.pause');
    if (old) old.remove();
    if (!on) return;
    var o = document.createElement('div');
    o.className = 'overlay pause';
    o.innerHTML = '<div class="modal"><h2>Paused</h2>' +
      '<button class="btn hot" data-act="resume">Resume</button>' +
      (opts.restart ? '<button class="btn" data-act="restart">Restart</button>' : '') +
      '<button class="btn ghost" data-act="howto">Controls</button>' +
      '<button class="btn ghost" data-act="quit">Quit to menu</button>' +
      '<div class="keys" style="justify-content:center;display:none" data-help>' + opts.controllers.filter(function (c) { return c.type === 'human'; }).map(function (c) { return App.deviceHint(c.device, c.label); }).join('<br>') + '</div>' +
      '</div>';
    document.body.appendChild(o);
    App.on(o, {
      resume: function () { if (App.match) App.match.togglePause(false); },
      restart: function () { o.remove(); opts.restart(); },
      howto: function () { var h = o.querySelector('[data-help]'); h.style.display = h.style.display === 'none' ? 'flex' : 'none'; },
      quit: function () { o.remove(); App.stopMatch(); if (opts.onQuit) opts.onQuit(); else App.show('title'); },
    });
  };

  // ─────────────── results ───────────────
  /** { result, setup (fighters with build/name/team), labels[], onRematch, onMenu, continueLabel } */
  App.screens.results = {
    enter: function (a) {
      var r = a.result, fs = a.setup.fighters;
      var winners = fs.map(function (f, i) { return i; }).filter(function (i) { return fs[i].team === r.winnerTeam; });
      var teamName = r.winnerTeam < 0 ? 'Draw' : fs.length > 2 && winners.length > 1 ? D.TEAM_NAMES[r.winnerTeam] + ' team wins!' : (a.labels ? a.labels[winners[0]] : fs[winners[0]].name) + ' wins!';
      Audio.play(r.winnerTeam >= 0 && (!a.localTeams || a.localTeams.indexOf(r.winnerTeam) >= 0) ? 'victory' : 'defeat');
      if (hub) hub.report('session-end', { result: a.localTeams ? (a.localTeams.indexOf(r.winnerTeam) >= 0 ? 'win' : 'lose') : 'win', mode: a.mode || 'local' });
      ui.innerHTML = '<div class="screen see-through"><div class="results">' +
        '<div class="stage-card" style="min-height:380px"><canvas data-win></canvas></div>' +
        '<div class="panel"><div class="eyebrow">' + (r.reason === 'time' ? 'Time up' : r.reason === 'forfeit' ? 'Forfeit' : 'Ring-out') + '</div>' +
        '<h2 class="winner" style="color:' + (r.winnerTeam >= 0 ? D.TEAM_COLORS[r.winnerTeam % 4] : '#fff') + '">' + esc(teamName) + '</h2>' +
        '<table class="stat"><tr><th>Dragon</th><th>KOs</th><th>Falls</th><th>Dealt</th><th>Taken</th></tr>' +
        r.fighters.map(function (f, i) {
          return '<tr><td><span class="dot" style="background:' + D.TEAM_COLORS[f.team % 4] + '"></span> ' + D.ELEMENTS[fs[i].build.element].icon + ' ' + esc(a.labels ? a.labels[i] : f.name) + (f.forfeit ? ' <span class="pill">left</span>' : '') + '</td><td>' + f.kos + '</td><td>' + f.falls + '</td><td>' + Math.round(f.dealt) + '%</td><td>' + Math.round(f.taken) + '%</td></tr>';
        }).join('') + '</table>' +
        '<div class="row" style="margin-top:14px">' +
        (a.onRematch ? '<button class="btn hot" data-act="rematch">' + (a.rematchLabel || 'Rematch') + '</button>' : '') +
        (a.onContinue ? '<button class="btn hot" data-act="continue">' + (a.continueLabel || 'Continue') + '</button>' : '') +
        (a.onChange ? '<button class="btn" data-act="change">Change dragons</button>' : '') +
        '<button class="btn ghost" data-act="menu">Main menu</button></div></div></div></div>';
      var cv = ui.querySelector('[data-win]');
      var shown = winners.length ? winners : [0];
      // Draw winners in victory poses, losers in defeat in the back
      var t0 = performance.now();
      (function draw() {
        if (!document.body.contains(cv)) return;
        var w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
        if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        var x = cv.getContext('2d'), t = (performance.now() - t0) / 1000;
        x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
        var losers = fs.map(function (f, i) { return i; }).filter(function (i) { return shown.indexOf(i) < 0; });
        losers.forEach(function (i, k) {
          x.save(); x.translate(w * (k % 2 ? 0.86 - Math.floor(k / 2) * 0.1 : 0.14 + Math.floor(k / 2) * 0.1), h * 0.66); x.scale(0.6, 0.6); x.globalAlpha = 0.4;
          Art.draw(x, fs[i].build.look, fs[i].build.body, Anim.showcase('defeat', fs[i].build, t, k % 2 ? -1 : 1)); x.restore();
        });
        shown.forEach(function (i, k) {
          var s = Math.min(w, h * 1.3) / 330;
          x.save(); x.translate(w * (k + 0.5) / shown.length, h - 30); x.scale(s, s);
          x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(0, 0, 50, 9, 0, 0, Math.PI * 2); x.fill();
          var el = D.ELEMENTS[fs[i].build.element];
          var g = x.createRadialGradient(0, -80, 10, 0, -80, 140); g.addColorStop(0, Art.alpha(el.color, 0.35 + 0.15 * Math.sin(t * 3))); g.addColorStop(1, Art.alpha(el.color, 0));
          x.fillStyle = g; x.beginPath(); x.arc(0, -80, 140, 0, Math.PI * 2); x.fill();
          Art.draw(x, fs[i].build.look, fs[i].build.body, Anim.showcase('victory', fs[i].build, t + k, k % 2 ? -1 : 1));
          x.restore();
        });
        requestAnimationFrame(draw);
      })();
      App.on(ui, {
        rematch: function () { a.onRematch(); }, continue: function () { a.onContinue(); }, change: function () { a.onChange(); },
        menu: function () { App.show('title'); },
      });
    },
  };

  // ─────────────── boot ───────────────
  Art.load().then(function () {
    requestAnimationFrame(loop);
    var start = (location.hash || '').replace('#', '');
    App.show(App.screens[start] ? start : 'title');
  }).catch(function (e) {
    ui.innerHTML = '<div class="screen title"><h1 class="logo">DRAGON<span>CLASH</span></h1><p class="errors">' + esc(e.message) + '</p></div>';
  });
})();
