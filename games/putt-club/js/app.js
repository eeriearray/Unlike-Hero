/* Putt Club — app glue: a tiny store, the actions the UI calls, and the wiring between the transport
 * (online or offline), the 3D scene, audio and the interface. */
(function (global) {
  'use strict';
  // The physics engine (Rapier, WASM) must be ready before anything simulates or previews a shot.
  global.PuttPhysics.init().then(function () { start(global); }, function (e) {
    var el = document.getElementById('nogl');
    el.querySelector('h1').textContent = 'Putt Club could not start';
    el.querySelector('p').textContent = 'The physics engine failed to load (' + (e && e.message) + '). Try reloading, or a newer browser.';
    el.hidden = false;
  });
})(window);

function start(global) {
  'use strict';
  var PC = global.PC, Match = global.PuttMatch, Powerups = global.PuttPowerups, Courses = global.PuttCourses;
  var hub = global.Hub ? global.Hub.init({ id: PC.GAME.id, version: PC.GAME.version, title: PC.GAME.title }) : null;

  // ------------------------------------------------------------------ store
  function createStore(initial) {
    var state = initial, subs = [];
    return {
      get: function () { return state; },
      set: function (patch) { state = Object.assign({}, state, patch); subs.forEach(function (f) { f(); }); },
      subscribe: function (f) { subs.push(f); return function () { subs = subs.filter(function (g) { return g !== f; }); }; }
    };
  }
  var qs = new URLSearchParams(location.search);
  var hubName = hub && hub.player && hub.player().name !== 'Player' ? hub.player().name : '';
  var profile = PC.store.get('profile', null) || { name: hubName || '', color: Math.floor(Math.random() * 8) };
  var store = createStore({
    profile: profile, view: null, conn: 'up', toasts: [], feed: [], modal: null, pick: null, celebrate: null, reveal: null,
    stripOpen: false, busy: '', joinCode: (qs.get('room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4),
    inviteUrl: '', lanWarning: '', copied: false, aiming: false, showTutorial: false
  });

  // ------------------------------------------------------------------ scene and input
  var canvas = document.getElementById('scene');
  var dom = {
    labels: document.getElementById('labels'), confetti: document.getElementById('confetti'),
    hidden: function () { return document.hidden; },
    onFrame: null
  };
  var scene = new PC.Scene(canvas, dom);
  if (scene.failed) {
    document.getElementById('nogl').hidden = false;
    return;
  }
  var menuCourse = Math.floor(Math.random() * 3);
  scene.menuBackdrop(menuCourse);
  PC.audio.music('menu');
  var backdropTimer = setInterval(function () { if (!store.get().view) scene.menuBackdrop(++menuCourse); }, 24000);

  var powerFill = null, powerText = null;
  function showPower(aim) {
    powerFill = powerFill || document.getElementById('power-fill');
    powerText = powerText || document.getElementById('power-text');
    document.body.classList.toggle('aiming', !!aim);
    if (!powerFill) return;
    var p = aim ? aim.power : 0;
    powerFill.style.transform = 'scaleX(' + p.toFixed(3) + ')';
    powerFill.style.background = p < 0.5 ? 'var(--turquoise)' : p < 0.8 ? 'var(--gold)' : 'var(--coral)';
    if (powerText) powerText.textContent = aim ? Math.round(p * 100) + '%' : '';
  }

  var input = new PC.AimInput(canvas, {
    camera: function () { return scene.camera; },
    ball: function () { return scene.myBallView(); },
    canAim: function () { return scene.canAim() && !store.get().modal && !store.get().pick; },
    aimStart: function () { scene.rig.holdForAim = true; },
    aimEnd: function () { scene.rig.holdForAim = false; },
    cameraBasis: function () {
      // Ground-plane right and forward vectors of the camera at the moment aiming starts.
      var c = scene.camera, f = new THREE.Vector3(); c.getWorldDirection(f); f.y = 0; f.normalize();
      return { fx: f.x, fz: f.z, rx: -f.z, rz: f.x };
    },
    defaultAim: function () { return scene.defaultAim(); },
    onAim: function (aim) { scene.setAim(aim); showPower(aim); if (!!aim !== store.get().aiming) store.set({ aiming: !!aim }); },
    onShoot: shoot,
    rotate: function (dy, dp) { scene.rig.rotate(dy, dp); },
    zoom: function (f) { scene.rig.zoom(f); }
  });

  function shoot(aim) {
    scene.setAim(null); showPower(null); store.set({ aiming: false }); scene.rig.holdForAim = false;
    if (store.get().showTutorial) endTutorial();
    scene.startPrediction(aim);
    send({ type: 'shoot', dx: aim.dir[0], dz: aim.dir[1], power: aim.power }, true).then(function (res) {
      if (res && res.ok) scene.confirmShot(res.t);
      else scene.pred = null;
    });
  }

  // ------------------------------------------------------------------ transport
  var net = null;
  var handlers = {
    onState: onState,
    onSnap: function (s) { scene.onSnap(s); },
    onFx: function (list) { list.forEach(onFx); },
    onClosed: function (reason) { toast(reason, 'warn'); goMenu(); },
    onStatus: function (up) { store.set({ conn: up ? 'up' : 'down' }); }
  };

  var lastPhase = null, lastHoleKey = null;
  function onState(v) {
    var prev = store.get().view;
    var patch = { view: v };
    var holeKey = v.course && v.hole ? v.course.id + v.hole.index + v.course.mirror + v.course.index : null;
    if (v.phase !== lastPhase || holeKey !== lastHoleKey) {
      if (v.phase === 'intro') { patch.feed = []; patch.pick = null; patch.celebrate = null; }
      if (v.phase === 'play' && !PC.store.get('tutorialDone', false)) patch.showTutorial = true;
      if (v.phase === 'holeResults') { PC.audio.play('results'); patch.pick = null; }
      if (v.phase === 'final' && hub) hub.report('session-end', { result: v.standings[0] && v.standings[0].id === v.you ? 'win' : 'lose', mode: v.settings.mode });
      if (v.phase === 'intro' && lastPhase === 'lobby' && hub) hub.report('session-start', { mode: v.settings.mode, players: v.players.length });
      if (v.phase === 'lobby') PC.audio.music('menu');
      lastPhase = v.phase; lastHoleKey = holeKey;
    }
    if (!prev || prev.code !== v.code) patch.inviteUrl = inviteBase() + '?room=' + v.code;
    store.set(patch);
    scene.setView(v);
    if (v.phase === 'lobby' || v.phase === 'final') { if (!scene.holeView || v.phase === 'lobby') scene.menuBackdrop(menuCourse); }
  }

  function name(id) {
    var v = store.get().view, p = v && v.players.find(function (q) { return q.id === id; });
    if (!p) return '?';
    if (id === v.you) return 'You';
    return p.name;
  }
  function tag(id) {
    var v = store.get().view, p = v && v.players.find(function (q) { return q.id === id; });
    if (!p) return '?';
    var col = Match.COLORS[p.color];
    return '<b class="who" style="--pc:' + col + '"><span class="who-sym">' + PC.icons.symbol(Match.SYMBOLS[p.color]) + '</span>' + esc(id === v.you ? 'You' : p.name) + '</b>';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var feedId = 0;
  function feed(htmlText, kind) {
    var f = store.get().feed.concat([{ id: ++feedId, html: htmlText, kind: kind }]).slice(-5);
    store.set({ feed: f });
    var id = feedId;
    setTimeout(function () { store.set({ feed: store.get().feed.filter(function (x) { return x.id !== id; }) }); }, 5200);
  }

  var toastId = 0;
  function toast(text, kind) {
    if (!text) return;
    var t = store.get().toasts.concat([{ id: ++toastId, text: text, kind: kind }]).slice(-3);
    store.set({ toasts: t });
    var id = toastId;
    setTimeout(function () { store.set({ toasts: store.get().toasts.filter(function (x) { return x.id !== id; }) }); }, 3800);
    if (kind === 'warn') PC.audio.play('error');
  }

  var celebrateId = 0;
  function onFx(e) {
    scene.onFx(e);
    var v = store.get().view, me = v && v.you;
    var pw = e.power && Powerups.BY_ID[e.power];
    switch (e.type) {
      case 'holed': {
        var label = PC.relName(e.strokes, v.hole ? v.hole.par : 3);
        if (e.id === me) {
          var id = ++celebrateId;
          store.set({ celebrate: { id: id, text: label + '!', sub: e.strokes + (e.strokes === 1 ? ' stroke' : ' strokes'), kind: e.strokes === 1 ? 'ace' : e.rel < 0 ? 'good' : e.rel === 0 ? 'par' : 'meh' } });
          setTimeout(function () { if (store.get().celebrate && store.get().celebrate.id === id) store.set({ celebrate: null }); }, 2600);
        } else feed(tag(e.id) + ' sank it: ' + label, e.rel < 0 ? 'good' : '');
        break;
      }
      case 'token':
        if (e.id === me) {
          toast((pw ? pw.name : 'A power-up') + ': ' + (pw ? pw.kind : ''));
          var inv = (v.players.find(function (q) { return q.id === me; }) || {}).inventory || [];
          store.set({ reveal: { slot: Math.min(1, inv.length), at: Date.now() } });
          setTimeout(function () { store.set({ reveal: null }); }, 1600);
        } else feed(tag(e.id) + ' grabbed a crate');
        break;
      case 'power':
        if (!pw) break;
        if (pw.target === 'self') feed(tag(e.id) + ' used <b>' + pw.name + '</b>', 'pw');
        else feed(tag(e.id) + ' hit ' + tag(e.target) + ' with <b>' + pw.name + '</b>', e.target === me ? 'bad' : 'pw');
        if (e.target === me && e.id !== me) toast(name(e.id) + ' used ' + pw.name + ' on you!', 'warn');
        break;
      case 'blocked':
        feed(tag(e.id) + '’s Bubble Guard blocked ' + tag(e.by) + '’s <b>' + e.name + '</b>', 'good');
        if (e.id === me) toast('Bubble Guard blocked ' + e.name + '!');
        if (e.by === me) toast(name(e.id) + '’s Bubble Guard blocked your ' + e.name, 'warn');
        break;
      case 'splash':
        if (e.id === me) toast(e.penalty ? (e.kind === 'water' ? 'Splash! +1 stroke' : 'Out of bounds! +1 stroke') : 'Blown overboard. No penalty.', e.penalty ? 'warn' : '');
        else feed(tag(e.id) + (e.kind === 'water' ? ' went for a swim' : ' fell off the course'));
        break;
      case 'maxed': feed(tag(e.id) + ' hit the stroke limit', 'bad'); break;
      case 'timerPenalty': if (e.id === me) toast('Shot timer! +1 stroke', 'warn'); break;
      case 'hurry': feed(tag(e.id) + ' is the last ball: 30 seconds!', 'bad'); if (e.id === me) toast('Last ball! 30 seconds to finish', 'warn'); break;
      case 'disconnected': feed(tag(e.id) + ' disconnected', 'bad'); break;
      case 'reconnected': feed(tag(e.id) + ' is back'); break;
      case 'reset': if (e.id === me && e.penalty) toast('Back to the tee: +' + e.penalty); break;
    }
  }

  function inviteBase() {
    return store.get().lanBase || (location.origin + location.pathname);
  }
  function findLan() {
    if (location.protocol === 'file:' || !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
    fetch('net-info', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var ip = j && j.addresses && j.addresses[0];
      if (ip) {
        var base = location.protocol + '//' + ip + ':' + (j.port || location.port) + location.pathname;
        var v = store.get().view;
        store.set({ lanBase: base, inviteUrl: v ? base + '?room=' + v.code : '', lanWarning: '' });
      } else store.set({ lanWarning: 'This computer is not on Wi-Fi, so phones can’t reach it. Connect to the same Wi-Fi as your friends.' });
    }).catch(function () { /* older hub server */ });
  }

  // ------------------------------------------------------------------ actions
  function busy(text) { store.set({ busy: text || '' }); }
  function cleanProfile() {
    var p = store.get().profile;
    var n = (p.name || '').trim() || (hubName || ('Golfer ' + (Math.floor(Math.random() * 90) + 10)));
    var out = { name: n.slice(0, 16), color: p.color };
    store.set({ profile: out }); PC.store.set('profile', out);
    return out;
  }

  function goOnline() {
    if (net && net.kind === 'online') return net;
    if (net) net.leave();
    net = PC.net.createOnline(handlers);
    return net;
  }

  function send(cmd, quiet) {
    if (!net) return Promise.resolve({ error: 'Not connected.' });
    return net.send(cmd).then(function (res) {
      if (res && res.error && !(quiet && /Too fast|stop/.test(res.error))) toast(res.error, 'warn');
      return res || {};
    });
  }

  function goMenu() {
    if (net) { var n = net; net = null; n.leave(); }
    store.set({ view: null, pick: null, modal: null, feed: [], celebrate: null, aiming: false, showTutorial: false });
    scene.view = null; scene.me = null; scene.clearBalls(); scene.holeKey = null;
    scene.menuBackdrop(menuCourse);
    PC.audio.music('menu');
    lastPhase = null; lastHoleKey = null;
    if (history.replaceState && qs.get('room')) history.replaceState(null, '', location.pathname + (qs.get('hub') ? '?hub=1' : ''));
  }

  var actions = {
    setProfile: function (p) { store.set({ profile: p }); PC.store.set('profile', p); },
    create: function () {
      PC.audio.unlock();
      var prof = cleanProfile(); busy('Creating a room…');
      goOnline().create(prof).then(function (res) { busy(''); if (res.error) toast(res.error, 'warn'); else findLan(); });
    },
    join: function (code) {
      PC.audio.unlock();
      code = String(code || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (code.length !== 4) { toast('Room codes are 4 letters.', 'warn'); return; }
      var prof = cleanProfile(); busy('Joining ' + code + '…');
      goOnline().join(code, prof).then(function (res) {
        busy('');
        if (res.error) toast(res.error, 'warn');
        else { if (res.rejoined) toast('Welcome back! Your seat and score were kept.'); findLan(); }
      });
    },
    solo: function (bots) {
      PC.audio.unlock();
      var prof = cleanProfile();
      if (net) net.leave();
      net = PC.net.createOffline(handlers, prof, bots);
    },
    leave: function () { goMenu(); },
    send: send,
    ui: function (patch) { store.set(patch); },
    copyInvite: function () {
      var url = store.get().inviteUrl;
      var done = function () { store.set({ copied: true }); setTimeout(function () { store.set({ copied: false }); }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { prompt('Copy this link:', url); });
      else prompt('Copy this link:', url);
    },
    usePower: function (slot, target) {
      var v = store.get().view, me = v && v.players.find(function (q) { return q.id === v.you; });
      if (!me || !me.inventory[slot]) return;
      var def = Powerups.BY_ID[me.inventory[slot]];
      if (def.target === 'opponent' && !target) {
        var opts = v.players.filter(function (q) { return q.id !== v.you && !q.finished && (q.connected || q.bot); });
        if (opts.length === 1) target = opts[0].id;
        else { store.set({ pick: { slot: slot, power: def.id } }); return; }
      }
      store.set({ pick: null });
      send({ type: 'use', slot: slot, target: target });
    },
    resetBall: function () {
      var v = store.get().view;
      if (v && v.settings.resetPenalty && !confirm('Go back to the tee for +' + v.settings.resetPenalty + ' stroke' + (v.settings.resetPenalty > 1 ? 's' : '') + '?')) return;
      send({ type: 'reset' });
    },
    toggleOverview: function () { scene.rig.mode = scene.rig.mode === 'overview' ? 'play' : 'overview'; },
    cancelAim: function () { input.cancelAim(); },
    endTutorial: endTutorial,
    prefsChanged: function () { scene.particles.reduced = PC.reducedMotion(); }
  };
  function endTutorial() { PC.store.set('tutorialDone', true); store.set({ showTutorial: false }); }

  // Keyboard shortcuts for the HUD.
  global.addEventListener('keydown', function (e) {
    var tagName = (e.target && e.target.tagName) || '';
    if (tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA') return;
    var v = store.get().view;
    if (!v || v.phase === 'lobby') return;
    if (e.key === 'Tab') { e.preventDefault(); store.set({ modal: store.get().modal === 'scores' ? null : 'scores' }); }
    else if (e.key === 'h' || e.key === 'H' || e.key === '?') store.set({ modal: store.get().modal === 'help' ? null : 'help' });
    else if (e.key === 'o' || e.key === 'O') actions.toggleOverview();
    else if (e.key === '1' || e.key === '2') actions.usePower(Number(e.key) - 1);
  });
  // The first gesture anywhere unlocks audio (browser autoplay rules).
  ['pointerdown', 'keydown'].forEach(function (ev) { global.addEventListener(ev, function () { PC.audio.unlock(); }, { once: true, capture: true }); });

  PC.ui.mount(document.getElementById('ui'), store, actions);

  // Back into a room after a reload, or straight in from an invite link.
  var seat = PC.session.get('seat', null);
  if (seat && PC.net.onlineAvailable()) {
    busy('Reconnecting…');
    goOnline().resume(seat).then(function (res) { busy(''); if (res.error) { net.leave(); net = null; } else findLan(); });
  } else if (store.get().joinCode && PC.store.get('profile', null) && PC.net.onlineAvailable()) {
    actions.join(store.get().joinCode);
  }
  void backdropTimer; void Courses;
  PC.app = { store: store, actions: actions, scene: scene, get net() { return net; } };
}
