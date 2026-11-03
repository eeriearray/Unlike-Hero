/* Boot, main loop, and the session between the world and the engine. */
(function () {
  var TR = window.TR = window.TR || {};
  var Engine = window.TrillionerEngine, R = window.TRD.rules, Tr = window.TRD.trophies;
  var qs = new URLSearchParams(location.search);
  var DEBUG = qs.get('debug') === '1';

  /** Solo session: the engine runs right here. Online (M7) swaps this for a socket with the same shape. */
  function LocalSession(opts) {
    var g = new Engine.Game({ seed: opts.seed, mode: opts.mode, players: [{ id: 'me', name: opts.name || 'You' }] });
    var s = {
      game: g, run: g.run, view: g.viewFor('me'), online: false,
      tick: function (dt) { g.tick(dt); s.view = g.viewFor('me'); return g.drain('me'); },
      stock: function (id) { return g.stock[id]; },
      quote: function (id) { return g.quoteFor(g.players.me, id); },
      gateFails: function (gate) { return g.gateFails(g.players.me, gate); },
      buy: function (id) { var r = g.buy('me', id); s.view = g.viewFor('me'); return r; },
      demolish: function (id, truck) { var r = g.demolish('me', id, truck); s.view = g.viewFor('me'); return r; },
      setPos: function (x, y, z, h, inv, d) { g.setPos('me', x, y, z, h, inv, d); }
    };
    return s;
  }

  var app = TR.app = {
    scene: null, camera: null, renderer: null, session: null, last: 0, t: 0, running: false, ready: false, paused: false, posT: 0, debug: DEBUG, fps: 60, fpsAcc: 0, fpsN: 0,

    boot: function () {
      var canvas = document.getElementById('view');
      var ui = document.getElementById('ui');
      if (window.Hub) Hub.init({ id: 'trillioner', version: '0.1.0', title: 'Trillioner' });
      TR.input.init(canvas);
      app.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
      app.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      app.renderer.shadowMap.enabled = true;
      app.renderer.shadowMap.type = THREE.PCFShadowMap;
      app.scene = new THREE.Scene();
      app.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 1400);
      addEventListener('resize', app.resize);
      app.resize();
      TR.world.init(app.scene);
      TR.player.init(app.scene);
      TR.vehicles.init(app.scene);
      TR.pads.init(app.scene);
      TR.fx.init(app.scene);
      TR.hud.init(ui);
      TR.menus.init(ui);
      TR.player.teleport(0, 0, 240, 0);
      TR.world.setTime(9, 'clear', TR.player.pos);
      app.ready = true;
      if (DEBUG) app.debugPanel(ui);
      if (qs.get('autostart') === '1') app.startRun({ mode: 'day', seed: Number(qs.get('seed')) || undefined });
      else TR.menus.title();
      app.last = performance.now();
      requestAnimationFrame(app.loop);
      window.__trBootMs = performance.now();
    },

    resize: function () {
      var w = innerWidth, h = innerHeight;
      app.renderer.setSize(w, h, false);
      app.camera.aspect = w / h;
      app.camera.updateProjectionMatrix();
    },

    startRun: function (opts) {
      var seed = opts.seed != null ? opts.seed : (Date.now() >>> 0);
      app.session = LocalSession({ seed: seed, mode: opts.mode });
      TR.pads.setRun(app.session.run);
      var sp = app.session.run.spawn;
      TR.player.teleport(sp.x, sp.y, sp.z, 0);
      TR.player.setVisible(true);
      TR.hud.show(true);
      app.running = true;
      TR.input.yaw = 0;
      if (window.Hub) Hub.report('session-start', { mode: opts.mode, seed: seed });
    },

    floorAt: function (p) { return 0; },
    itemName: function (id) { var it = app.session.run.items[id]; return it ? it.name : id; },
    nextTrophy: function (me) {
      var list = Tr.TROPHIES;
      for (var i = 0; i < list.length; i++) if (list[i].spent != null && !me.trophies[list[i].id]) return list[i];
      return null;
    },

    tryBuy: function (id) {
      var r = app.session.buy(id);
      if (r.error) {
        if (r.code === 'broke') { TR.hud.toast('Too expensive', 'bad'); TR.audio.denied(); }
        else if (r.code !== 'sold') { TR.hud.toast(r.error, 'bad'); TR.audio.denied(); }
      }
      return r;
    },
    tryDemolish: function (id, truck) {
      var r = app.session.demolish(id, truck);
      if (r.error) { TR.hud.toast(r.error, 'bad'); TR.audio.denied(); }
      return r;
    },

    handleEvents: function (evs) {
      var run = app.session.run, pos = TR.player.pos;
      evs.forEach(function (ev) {
        if (ev.type === 'purchase') {
          var it = run.items[ev.item], name = ev.store ? 'All of ' + run.sites[ev.store].name : it.name;
          TR.fx.purchase(ev, pos, name);
          TR.hud.flyPrice('-' + TR.fmt(ev.paid));
          if (ev.closing > 0) TR.hud.toast(name + ': deal closing in ' + Math.round(ev.closing / 1000) + 's', 'gold');
          else if (it) app.onOwned(it);
        } else if (ev.type === 'closed') {
          var c = run.items[ev.item];
          TR.hud.toast(c.name + ': deal closed!', 'gold');
          app.onOwned(c);
        } else if (ev.type === 'reward') {
          app.deliverReward(ev);
        } else if (ev.type === 'trophy') {
          var t = Tr.TROPHIES.filter(function (x) { return x.id === ev.id; })[0];
          TR.hud.toast('TROPHY: ' + (t ? t.name : ev.id), 'gold');
          TR.audio.buy(2, 3);
        } else if (ev.type === 'demolish') {
          var d = run.items[ev.item], s = run.sites[d.site];
          TR.fx.explosion(s.b ? { x: s.b.x, y: 4, z: s.b.z } : pos, 2);
          TR.audio.boom(1);
          TR.cam.shake = 1;
        }
      });
    },
    onOwned: function (it) {
      var s = app.session.run.sites[it.site];
      if (it.building && s && s.b && !s.flag) {
        s.flag = TR.fx.raiseFlag(s.b.x, s.b.h + 0.8, s.b.z);
      }
    },
    /** The reward appears right beside the building, with a clear prompt. */
    deliverReward: function (ev) {
      var it = app.session.run.items[ev.item], s = app.session.run.sites[it.site], f = s.front || { x: TR.player.pos.x + 6, z: TR.player.pos.z };
      (ev.vehicles || []).forEach(function (k, i) {
        var spec = TR.vehicles.SPECS[k];
        if (!spec) return;
        var pads = app.session.run.padPos[it.id];
        var v = TR.vehicles.spawn(k, f.x + 9 + i * 7, s.y || 0, f.z + 7, 0);
        TR.hud.toast('Your ' + spec.name + ' has arrived! Press F to get in.', 'gold');
        TR.fx.confetti(v.pos, 60, 10);
      });
    },

    updateActions: function (dt) {
      var input = TR.input, vs = TR.vehicles, ints = TR.interiors;
      if (input.hit('KeyF')) {
        if (vs.current) vs.leave();
        else { var v = vs.nearest(TR.player.pos, 6); if (v) vs.board(v); }
      }
      // doors: hold E
      var door = app.nearDoor();
      if (door && !vs.current) {
        if (input.down('KeyE')) {
          app.doorHold = (app.doorHold || 0) + dt;
          if (app.doorHold > 0.3) { app.doorHold = 0; if (door.exit) ints.exit(TR.player); else ints.enter(door.site, TR.player); input.keys.KeyE = false; }
        } else app.doorHold = 0;
        if (!TR.hud.pOn) TR.hud.prompt(door.exit ? 'Exit' : door.site.name, 'Hold E to ' + (door.exit ? 'leave' : 'enter'), app.doorHold ? app.doorHold / 0.3 : 0);
      }
      if (!door && !vs.current && TR.vehicles.nearest(TR.player.pos, 5) && !TR.hud.pOn) TR.hud.prompt(TR.vehicles.nearest(TR.player.pos, 5).spec.name, 'Press F to get in');
    },
    nearDoor: function () {
      var p = TR.player.pos, ints = TR.interiors;
      if (ints.current) {
        var d = ints.doorPos();
        return Math.hypot(p.x - d.x, p.z - d.z) < 4 ? { exit: true } : null;
      }
      var sites = app.session.run.sites;
      for (var id in sites) {
        var s = sites[id];
        if (s.kind !== 'room') continue;
        if (Math.hypot(p.x - s.front.x, p.z - s.front.z) < 3.2 && Math.abs(p.y - s.y) < 3) return { site: s };
      }
      return null;
    },

    /** One simulation frame. Debug and tests call this directly when the page is hidden. */
    frame: function (dt) {
      var ts = TR.fx.timeScale(), sim = dt * ts;
      app.t += dt;
      if (app.running && !app.paused) {
        TR.hud.prompt(null);
        if (TR.vehicles.current) TR.vehicles.drive(sim); else TR.player.update(sim);
        var evs = app.session.tick(dt);
        app.handleEvents(evs);
        var pos = TR.player.pos;
        TR.pads.update(dt, app.session, pos, app.t);
        app.updateActions(dt);
        TR.hud.update(app.session.view, dt);
        TR.world.setTime(app.session.view.hour, app.session.view.weather, pos);
      }
      TR.input.endFrame();
      TR.world.update(dt, app.t);
      TR.fx.update(sim);
      var v = TR.vehicles.current;
      TR.cam.update(app.camera, TR.player.pos, dt, v ? { dist: v.spec.cam, lift: 2.4, fov: 62 + Math.min(16, Math.abs(v.speed) * 0.34), floor: 0 } : { floor: 0 });
    },

    loop: function (now) {
      requestAnimationFrame(app.loop);
      var dt = Math.min(0.05, (now - app.last) / 1000);
      app.last = now;
      app.fpsAcc += dt; app.fpsN++;
      if (app.fpsAcc >= 0.5) { app.fps = app.fpsN / app.fpsAcc; app.fpsAcc = 0; app.fpsN = 0; if (app.dbgFps) app.dbgFps.textContent = app.fps.toFixed(0) + ' FPS, ' + app.renderer.info.render.calls + ' calls'; }
      app.frame(dt);
      app.renderer.render(app.scene, app.camera);
    },

    /** Runs n seconds of game time synchronously. Used for testing a hidden preview. */
    advance: function (seconds, dt) {
      dt = dt || 1 / 60;
      for (var i = 0; i < seconds / dt; i++) app.frame(dt);
      app.renderer.render(app.scene, app.camera);
    },

    debugPanel: function (ui) {
      var d = document.createElement('div'); d.className = 'debug';
      d.innerHTML = '<div id="dbg-fps">..</div><div id="dbg-btns"></div>';
      ui.appendChild(d);
      app.dbgFps = d.querySelector('#dbg-fps');
      var btns = d.querySelector('#dbg-btns');
      function b(label, fn) { var e = document.createElement('button'); e.textContent = label; e.onclick = function () { fn(); e.blur(); }; btns.appendChild(e); }
      b('+$100B', function () { app.me().balance += 100 * R.B; });
      b('-$100B', function () { var p = app.me(); p.balance = Math.max(0, p.balance - 100 * R.B); });
      b('Hour+1', function () { var g = app.session.game; g.setClockHour((g.hourNow() + 1) % 24); });
    },
    me: function () { return app.session.game.players.me; }
  };

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', app.boot); else app.boot();
})();
