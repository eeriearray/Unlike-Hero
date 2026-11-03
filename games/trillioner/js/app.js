/* Boot, main loop, and the session between the world and the engine. */
(function () {
  var TR = window.TR = window.TR || {};
  var Engine = window.TrillionerEngine, R = window.TRD.rules, Tr = window.TRD.trophies;
  var qs = new URLSearchParams(location.search);
  window.__trErrors = [];
  addEventListener('error', function (e) { window.__trErrors.push(String(e.message) + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
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
      setPos: function (x, y, z, h, inv, d) { g.setPos('me', x, y, z, h, inv, d); },
      cannon: function (on) { var r = g.setCannon('me', on); s.view = g.viewFor('me'); return r; },
      fastTravel: function (d) { return g.fastTravel('me', d); },
      discover: function (id) { var r = g.discover('me', id); s.view = g.viewFor('me'); return r; },
      damage: function (kind) { var r = g.damage('me', kind); s.view = g.viewFor('me'); return r; },
      buyStore: function (site) { var r = g.buyStore('me', site); s.view = g.viewFor('me'); return r; },
      setClock: function (h) { g.setClockHour(h); },
      finish: function () { var p = g.players.me; if (p.won) g.finish(p, g.isPerfect(p) ? 'perfect' : 'win'); else if (!g.over) { g.over = true; g.result = 'quit'; } },
      toss: function () { return g.toss('me'); },
      extra: function (cmd, cb) { var r = g.command('me', cmd); s.view = g.viewFor('me'); if (cb) cb(r); return r; },
      results: function () { return g.results('me'); }
    };
    return s;
  }

  var app = TR.app = {
    scene: null, camera: null, renderer: null, session: null, last: 0, t: 0, running: false, ready: false, paused: false, posT: 0, debug: DEBUG, fps: 60, fpsAcc: 0, fpsN: 0,

    boot: function () {
      var canvas = document.getElementById('view');
      var ui = document.getElementById('ui');
      if (window.Hub) Hub.init({ id: 'trillioner', version: '1.0.0', title: 'Trillioner' });
      TR.input.init(canvas);
      TR.input.initTouch(ui);
      app.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
      TR.post.init(app.renderer);
      app.renderer.shadowMap.autoUpdate = false;
      app.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      app.renderer.shadowMap.enabled = true;
      app.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      app.renderer.outputEncoding = THREE.sRGBEncoding;
      app.scene = new THREE.Scene();
      app.camera = new THREE.PerspectiveCamera(58, 1, 0.5, 1400);
      addEventListener('resize', app.resize);
      app.resize();
      TR.world.init(app.scene);
      TR.player.init(app.scene);
      TR.vehicles.init(app.scene);
      TR.pads.init(app.scene);
      TR.fx.init(app.scene);
      TR.goods.init(app.scene);
      TR.life.init(app.scene);
      TR.crowds.init(app.scene, 90);
      TR.traffic.init(app.scene, 44);
      TR.hud.init(ui);
      TR.map.init(TR.hud.mapBox);
      TR.gps.init(app.scene);
      TR.agents.init(app.scene);
      TR.phone.init();
      var au = TR.save.get('audio', null);
      if (au) { TR.audio.volume = au.volume; TR.audio.sfxVolume = au.sfxVolume; TR.audio.musicVolume = au.musicVolume; TR.audio.muted = au.muted; TR.audio.musicMuted = !!au.musicMuted; TR.hud.musicBtn(); }
      TR.quality.init();
      TR.player.applyLooks();
      TR.menus.init(ui);
      TR.player.teleport(-60, 0, 8, 0);
      TR.world.resetRun();
      TR.world.setTime(9, 'clear', TR.player.pos);
      app.prewarm();
      app.ready = true;
      if (DEBUG) app.debugPanel(ui);
      var seat0 = TR.net.getSeat(), invite = (qs.get('room') || '').toUpperCase();
      if (invite && seat0 && seat0.code !== invite) { TR.net.clearSeat(); seat0 = null; }   // an invite beats a seat from an older room
      if (qs.get('autostart') !== '1' && seat0 && TR.net.tryResume()) { /* back in the match */ }
      else if (qs.get('autostart') !== '1' && invite) TR.net.lobby();
      else if (qs.get('autostart') === '1') app.startRun({ mode: 'day', seed: Number(qs.get('seed')) || undefined });
      else TR.menus.title();
      app.last = performance.now();
      requestAnimationFrame(app.loop);
      window.__trBootMs = performance.now();
    },

    /** Draws everything once at load: geometry goes to the GPU and shaders compile now, not mid-drive. */
    prewarm: function () {
      var off = [], sc = app.scene;
      TR.world.under.visible = true;
      Object.keys(TR.goods.meshes).forEach(function (k) { var m = TR.goods.meshes[k]; m.visible = true; m.count = 1; });
      sc.traverse(function (o) { if (o.isMesh && o.frustumCulled) { o.frustumCulled = false; off.push(o); } });
      TR.post.tick = 1;
      TR.post.render(sc, app.camera);
      off.forEach(function (o) { o.frustumCulled = true; });
      TR.world.under.visible = false;
      Object.keys(TR.goods.meshes).forEach(function (k) { var m = TR.goods.meshes[k]; m.visible = false; m.count = 0; });
    },
    resize: function () {
      var w = innerWidth, h = innerHeight;
      app.renderer.setSize(w, h, false);
      app.camera.aspect = w / h;
      app.camera.updateProjectionMatrix();
    },

    startRun: function (opts) {
      var seed = opts.seed != null ? opts.seed : (Date.now() >>> 0);
      app.session = opts.session || LocalSession({ seed: seed, mode: opts.mode });
      TR.pads.setRun(app.session.run);
      var run0 = app.session.run, sp = run0.spawn;
      TR.player.teleport(sp.x, sp.y, sp.z, 0);
      TR.player.setVisible(true);
      TR.player.setGrowth(0);
      app.claimed = []; app.statues = 0; app.ownedCount = 0; app.rocketBought = false; app.lastSafe = null; app.district = null;
      TR.traffic.setOwned([]);
      TR.vehicles.current = null; TR.vehicles.gear = null; TR.hud.carry(null); TR.hud.closeWheel();
      TR.world.resetRun();
      TR.notebook.close();
      TR.notebook.setRun(run0);
      TR.haul.reset();
      TR.world.setBeam(null); app.eventSite = null;
      TR.own.resetRun(); TR.gps.reset(); TR.agents.reset(); TR.phone.reset();
      app.styleV = -1;
      TR.dares.start(app.session, seed);
      TR.cam.cine = null;
      TR.map.reset();
      Object.keys(run0.sites).forEach(function (k) { var st = run0.sites[k]; st.flag = st.rubble = st.built = false; });
      TR.vehicles.hideAll();
      if (TR.interiors.current) TR.interiors.exit(TR.player);
      TR.player.teleport(sp.x, sp.y, sp.z, 0);
      TR.hud.show(true);
      TR.tutorial.start();
      TR.audio.startMusic();
      app.mode = opts.mode;
      app.ended = false;
      app.paused = false;
      app.running = true;
      TR.input.yaw = 0;
      if (window.Hub) Hub.report('session-start', { mode: opts.mode, seed: seed });
    },

    /** The floor under a point: surface, Under City, deepest level, or far below the water. */
    floorAt: function (p) {
      if (p.x > 3000) return TR.interiors.floorHere(p);
      if (p.y < -75) return TRD.districts.DEEP_Y;
      if (p.y < -20) return TRD.districts.UNDER_Y;
      return TR.world.isWater(p.x, p.z) ? -40 : 0;
    },
    itemName: function (id) { var it = app.session.run.items[id]; return it ? it.name : id; },
    nextTrophy: function (me) {
      var list = Tr.TROPHIES;
      for (var i = 0; i < list.length; i++) if (list[i].spent != null && !me.trophies[list[i].id]) return list[i];
      return null;
    },

    tryBuy: function (id) {
      var r = app.session.buy(id);
      if (r.pending) return r;
      if (r.ok) app.onBought(id);
      if (r.error) {
        if (r.code === 'broke') { TR.hud.toast('Too expensive', 'bad'); TR.audio.denied(); }
        else if (r.code !== 'sold') { TR.hud.toast(r.error, 'bad'); TR.audio.denied(); }
      }
      return r;
    },
    onBought: function (id) {},
    tryStore: function (site) {
      var r = app.session.buyStore(site);
      if (r.error && r.code !== 'sold') { TR.hud.toast(r.code === 'broke' ? 'Too expensive' : r.error, 'bad'); TR.audio.denied(); }
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
        TR.phone.onEvent(ev);
        if (ev.type === 'purchase' && ev.pid && ev.pid !== app.session.view.me.id) {
          if (app.session.applyStock) app.session.applyStock(ev.item, ev.stock);
        } else if (ev.type === 'stock') {
          if (app.session.applyStock) app.session.applyStock(ev.item, ev.stock);
        } else if (ev.type === 'demolish' && ev.pid !== app.session.view.me.id) {
          /* a rival's rubble is theirs */
        } else if (ev.type === 'purchase') {
          if (app.session.applyStock) app.session.applyStock(ev.item, ev.stock);
          var it = run.items[ev.item], name = ev.store ? 'All of ' + run.sites[ev.store].name : it.name;
          TR.fx.purchase(ev, pos, name);
          TR.dares.bump('buys');
          if (ev.store) TR.dares.bump('stores');
          if (it && !it.building && it.kind !== 'change') {
            var from = run.padPos[it.id], kind = TR.goods.kindFor(it);
            TR.haul.add(kind, from, Math.min(1.2, 0.75 + Math.log10(Math.max(1, it.price / 1e9)) * 0.2));
            if (ev.store) for (var hi = 0; hi < 5; hi++) TR.haul.add(kind, from, 0.9);
          }
          TR.hud.flyPrice('-' + TR.fmt(ev.paid));
          if (ev.base >= R.B) TR.hud.stamp(ev.closing > 0 ? 'DEAL!' : 'SOLD!');
          if (ev.closing > 0) TR.hud.toast(name + ': deal closing in ' + Math.round(ev.closing / 1000) + 's', 'gold');
          else if (it) app.onOwned(it);
          if (it) { app.checkClaim(it); TR.own.bought(it.id); }
          if (it && !window.TRD.uses.GROUP[it.id] && TR.pads.useText(it)) TR.hud.toast(it.name + ': ' + TR.pads.useText(it), 'gold');
        } else if (ev.type === 'closed') {
          var c = run.items[ev.item];
          TR.hud.toast(c.name + ': deal closed!', 'gold');
          app.onOwned(c);
        } else if (ev.type === 'reward') {
          app.deliverReward(ev);
        } else if (ev.type === 'trophy') {
          var t = Tr.TROPHIES.filter(function (x) { return x.id === ev.id; })[0];
          TR.hud.trophy(t ? t.name : ev.id, t && t.spent ? 'Spent ' + TR.fmt(t.spent) + ' in one run' : t && t.desc);
        } else if (ev.type === 'demolish') {
          TR.dares.bump('demolish', 1);
          var d = run.items[ev.item], s = d.bldg ? run.sites[d.bldg] : {};
          if (TR.interiors.current && s.id === TR.interiors.current.id) TR.interiors.exit(TR.player);  // out, before it comes down
          TR.fx.explosion(s.b ? { x: s.b.x, y: (s.y || 0) + 4, z: s.b.z } : pos, 2);
          TR.audio.boom(1);
          TR.cam.shake = 1;
          if (s.b && !s.rubble) {
            s.rubble = true;
            TR.world.setBuildingGone(s.b.id, true);
            TR.world.addRubble(s.b, s.y || 0);
          }
        } else if (ev.type === 'secret') {
          var fp = run.secrets[ev.id];
          TR.dares.bump('secrets', 1);
          TR.hud.toast('FOUND: ' + ev.name, 'gold');
          if (ev.clue) { TR.hud.clue(ev.name, ev.clue); TR.notebook.addClue(ev.name, ev.clue, pos); }
          if (ev.note && TR.save.note(ev.id, ev.note)) TR.hud.toast('Notebook: ' + ev.note);
          TR.audio.buy(1, 4);
        } else if (ev.type === 'edition') {
          TR.hud.clue('The Daily Receipt', ev.text); TR.notebook.addClue('The Daily Receipt', ev.text, pos);
        } else if (ev.type === 'call') {
          TR.hud.clue('Incoming call', ev.text); TR.notebook.addClue('Incoming call', ev.text, pos);
        } else if (ev.type === 'hint') {
          TR.hud.clue('Mr. Grey', ev.text); TR.notebook.addClue('Mr. Grey', ev.text, pos);
        } else if (ev.type === 'cityEvent') {
          TR.hud.banner(ev.text); TR.world.headline(ev.text); TR.audio.cheer(0.6);
          var evSite = ev.site ? run.sites[ev.site] : ev.deal ? run.sites[run.items[ev.deal].site] : null;
          if (evSite) { TR.hud.toast((ev.site ? 'Fire sale at ' : 'Auction at ') + evSite.name + '. It is on your map.', 'gold'); TR.world.setBeam(evSite, ev.site ? 0xff7a1a : 0xff5ad1); app.eventSite = { site: evSite, id: ev.id }; }
        } else if (ev.type === 'cityEventEnd') {
          if (app.eventSite && app.eventSite.id === ev.id) { TR.world.setBeam(null); app.eventSite = null; }
        } else if (ev.type === 'refund') {
          if (ev.amount > 0) TR.hud.toast('Tax refund: +' + TR.fmt(ev.amount) + '. Rude.', 'bad');
        } else if (ev.type === 'cannonEmpty') {
          TR.hud.toast('The money cannon is spent.', 'gold');
        } else if (TR.battle && TR.battle.onEvent(ev)) {
          /* handled */
        } else if (ev.type === 'won') {
          app.winSequence();
          TR.menus.perfectWindow();
        } else if (ev.type === 'over') {
          app.endRun(ev);
        }
      });
    },
    /** Clear a whole shop out and the building is yours: it goes gold and gets your flag. */
    checkClaim: function (it) {
      var sess = app.session, s = sess.run.sites[it.site];
      if (!s || !s.b || s.flag || s.kind !== 'room') return;
      var left = TR.pads.list.some(function (p) { return p.item.site === it.site && !p.store && !p.item.secret && TR.pads.state(p, sess) === 'open'; });
      if (left) return;
      s.flag = true;
      var by = s.y || 0;
      TR.world.runLayer.add(TR.fx.raiseFlag(s.b.x, by + s.b.h + 0.8, s.b.z));
      TR.world.goldSweep(s.b, by);
      (app.claimed = app.claimed || []).push(s);
      TR.hud.stamp('CLEARED!');
      TR.hud.toast('You cleaned out ' + s.name + '. It is yours now.', 'gold');
      TR.audio.cheer(0.5);
    },
    onOwned: function (it) {
      var s = it.bldg ? app.session.run.sites[it.bldg] : null;
      if (it.project || it.id.indexOf('park_') === 0) TR.world.addVisual(it.id.indexOf('park_') === 0 ? 'park' : it.id);
      if (it.id === 'rocket') app.rocketBought = true;
      if (!it.building || !s || !s.b) return;
      if (s.b.project && !s.built) { s.built = true; TR.world.addProject(s.b, s.y || 0); }
      if (!s.flag) {
        s.flag = true;
        TR.world.runLayer.add(TR.fx.raiseFlag(s.b.x, (s.y || 0) + s.b.h + 0.8, s.b.z));
        TR.world.addTrim(s.b, s.y || 0);
        if (!s.b.project || s.built) {
          TR.world.goldSweep(s.b, s.y || 0);
          var by = (s.y || 0), roof = { x: s.b.x, y: by + s.b.h + 2, z: s.b.z };
          TR.fx.confetti(roof, 160, 16); TR.fx.bills(roof, 90, 14);
          for (var fw = 0; fw < 4; fw++) (function (fi) { setTimeout(function () { TR.fx.firework(s.b.x + (fi - 1.5) * 14, by + s.b.h + 22 + fi * 4, s.b.z); TR.audio.boom(0.3); }, 250 + fi * 240); })(fw);
          TR.audio.cheer(0.9); TR.crowds.cheer(3);
          if (!TR.interiors.current && Math.hypot(s.b.x - TR.player.pos.x, s.b.z - TR.player.pos.z) < 150 && Math.abs(by - TR.player.pos.y) < 40) TR.cam.showOff(s.b.x, by, s.b.z, Math.max(s.b.w, s.b.d), Math.min(s.b.h, 60));
        }
      }
    },
    /** The reward appears right beside the building, with a clear prompt. */
    deliverReward: function (ev) {
      // a job's reward has no building of its own: it turns up right where you are
      var it = app.session.run.items[ev.item], s = it ? app.session.run.sites[it.bldg && !app.session.run.sites[it.bldg].b.project ? it.bldg : it.site] : { y: TR.player.pos.y }, f = s.front || { x: TR.player.pos.x + 6, z: TR.player.pos.z };
      var room = !!TR.interiors.current, base = room ? TR.interiors.returnTo : { x: f.x, y: s.y || 0, z: f.z };
      (ev.vehicles || []).forEach(function (k, i) {
        var spec = TR.vehicles.SPECS[k];
        if (!spec) return;
        var v;
        if (spec.mode === 'water' || spec.mode === 'sub') {
          var w = TR.vehicles.findWater({ x: base.x, z: base.z + 30 }) || { x: 214, z: 300 };
          v = TR.vehicles.spawn(k, w.x + i * 9, spec.mode === 'sub' ? -1.5 : -1.2, w.z, 0);
        } else v = TR.vehicles.spawn(k, base.x + 9 + i * 7, (base.y || 0) + 0.2, base.z + 7, 0);
        if (spec.mode === 'jet') v.group.visible = false;
        TR.hud.toast('Your ' + spec.name + ' is here! ' + (spec.mode === 'jet' ? 'Press Q to strap it on.' : 'Press F to get in, or Q from anywhere.'), 'gold');
        TR.fx.confetti(v.pos, 60, 10);
      });
      (ev.gear || []).forEach(function (g) {
        TR.vehicles.setGear(g);
        TR.hud.toast('You got the ' + TR.vehicles.GEAR[g].name + '! ' + TR.vehicles.GEAR[g].use, 'gold');
      });
    },

    itemForBuilding: function (bid) {
      var list = app.session.run.list;
      for (var i = 0; i < list.length; i++) if (list[i].bldg === bid) return list[i].id;
      return null;
    },
    /** Ladder truck rooftops. */
    ladderSpots: function () { var b = TRD.districts.DISTRICTS.oldtown.buildings.filter(function (x) { return x.roofStall; })[0]; return [{ id: b.id, x: b.x, y: b.h + 0.8, z: b.z + 4 }]; },
    onLadderUsed: function (spot) { app.tryDiscover('collectors_roof'); },
    /** Drive the Mole Machine into the marked wall and click. */
    tryMoleDig: function (v) {
      var w = TR.world.moleWall;
      if (Math.hypot(v.pos.x - w.x, v.pos.z - w.z) > 12 || v.pos.y < -80) { TR.hud.toast('Nothing to dig here. Look for red marks.', 'bad'); return; }
      var r = app.session.discover('marked_wall');
      if (r.error) { TR.hud.toast(r.error, 'bad'); return; }
      TR.fx.explosion(v.pos, 1); TR.audio.boom(0.8); TR.cam.shake = 0.8;
      TR.notebook.travel({ x: 0, y: TRD.districts.DEEP_Y, z: -170 });
    },
    tryDiscover: function (id) {
      var r = app.session.discover(id), s = app.session.run.secrets[id];
      if (r.error) { TR.hud.toast(r.error, 'bad'); TR.audio.denied(); return r; }
      if ((r.ok && !r.already || r.pending) && s.enter === 'under') {
        var e = TRD.districts.DISTRICTS.under.entrances.filter(function (x) { return id === 'laundromat_back' ? x.id === 'laundromat' : id === 'factory_door' ? x.id === 'factory' : x.id === 'harbour'; })[0];
        TR.notebook.travel({ x: e.x, y: TRD.districts.UNDER_Y, z: e.z });
      }
      return r;
    },
    /** Wrecking the street costs a fine; the fine counts as spending. */
    smashProp: function (id, v) {
      var box = TR.world.buildingBoxes[id], p = box ? { x: (box.x0 + box.x1) / 2, y: box.y0, z: (box.z0 + box.z1) / 2 } : v.pos;
      TR.world.smash(id);
      TR.fx.debris(p, 16, 0xc0915a, Math.abs(v.speed) * 0.45);
      TR.audio.thud();
      TR.cam.shake = Math.max(TR.cam.shake, 0.32);
      var r = app.session.damage('prop');
      TR.dares.bump('smash', 1);
      if (r && r.paid) TR.hud.damage(r.paid);
    },
    wreckCar: function (c) {
      TR.fx.debris({ x: c.x, y: 0.5, z: c.z }, 34, c.c, 14);
      TR.fx.explosion({ x: c.x, y: 0.5, z: c.z }, 0.35);
      TR.audio.boom(0.55);
      TR.cam.shake = 0.75; TR.fx.slow = Math.max(TR.fx.slow, 0.3);
      var r = app.session.damage('car');
      TR.dares.bump('wreck', 1); TR.dares.bump('smash', 1);
      if (r && r.paid) TR.hud.damage(r.paid);
      TR.hud.bigText('WRECKED!');
    },
    /** Changes that follow the spent total: statues and the hero's growth. */
    cityGrowth: function (me) {
      var want = Math.floor(me.spent / (100 * R.B));
      app.statues = app.statues || 0;
      while (app.statues < want && app.statues < 9) { TR.world.addStatue(app.statues++); TR.fx.cityEvent('$' + (app.statues * 100) + 'B spent!', TR.player.pos); }
      TR.player.setGrowth(me.spent);
      var owned = Object.keys(me.vehicles).length;
      if (owned !== app.ownedCount) { app.ownedCount = owned; TR.traffic.setOwned(Object.keys(me.vehicles)); }
    },
    /** The Trillion Tower elevator: penthouse Trophy Room or the roof helipad. */
    elevator: function (dt) {
      var ints = TR.interiors, p = TR.player.pos;
      if (!ints.current || ints.current.id !== 'trillion_tower') return false;
      var r = ints.current.room, x = r.ox - r.w / 2 + 3, z = r.oz + r.d / 2 - 5;
      if (Math.hypot(p.x - x, p.z - z) > 4) return false;
      if (!TR.hud.pOn) TR.hud.prompt('Elevator', 'E: Penthouse Trophy Room. R: Rooftop helipad.');
      if (TR.input.hit('KeyE')) { TR.interiors.enterTrophyRoom(TR.player); return true; }
      if (TR.input.hit('KeyR')) {
        var b = TRD.districts.DISTRICTS.downtown.buildings.filter(function (q) { return q.id === 'trillion_tower'; })[0];
        ints.exit(TR.player);
        TR.player.teleport(b.x, b.h + 16, b.z + 3, 0);
        TR.hud.toast('The helipad. Long way down.', 'gold');
        return true;
      }
      return false;
    },
    updateActions: function (dt) {
      var input = TR.input, vs = TR.vehicles, ints = TR.interiors;
      if (app.elevator(dt)) return;
      if (input.hit('KeyK')) { TR.audio.setMusicMuted(!TR.audio.musicMuted); TR.hud.toast(TR.audio.musicMuted ? 'Music off' : 'Music on'); }
      if (input.hit('KeyN')) TR.notebook.toggle();
      if (input.hit('KeyI')) { TR.own.open('stuff'); return; }
      if (input.hit('KeyJ')) TR.gps.toggle();
      TR.own.rain(dt, app.session, TR.player.pos);
      TR.own.updateQuick(dt, app.session);
      var ctr = ints.counter;
      if (ctr && Math.hypot(TR.player.pos.x - ctr.x, TR.player.pos.z - ctr.z) < 3.4) {
        TR.hud.prompt('Style Counter', 'Press E: clothes, jewellery, pets, mystery boxes');
        if (input.hit('KeyE')) { TR.own.open('shop'); return; }
      }
      if (input.hit('KeyM')) TR.notebook.toggleMap();
      if (input.hit('KeyQ')) TR.hud.toggleWheel(app.session.view.me);
      if (TR.hud.wheelPick) for (var dk = 1; dk <= 9; dk++) if (input.hit('Digit' + dk)) { TR.hud.wheelPick(dk - 1); break; }
      TR.vehicles.updateGear(dt, app.session);
      TR.vehicles.drawPizzas(app.t);
      if (input.hit('KeyF')) {
        if (ints.current) { /* doors use E */ }
        else if (vs.current) vs.leave();
        else { var v = vs.nearest(TR.player.pos, 6); if (v) vs.board(v); }
      }
      // doors: walk into one and you are through it
      var door = app.nearDoor();
      app.doorCool = Math.max(0, (app.doorCool || 0) - dt);
      if (door && door.locked) {
        if (!TR.hud.pOn && !vs.current) TR.hud.prompt(door.site.b.plain || door.site.b.hiddenSign ? 'A locked door' : door.site.name, door.site.b.lockWhy || 'Locked.');
        door = null;
      }
      if (door && door.touch && app.doorCool <= 0) {
        var slowEnough = !vs.current || Math.abs(vs.current.speed) < 14;
        if (app.walkingInto(door) && slowEnough) {
          if (vs.current) vs.leave();
          app.doorCool = 0.6;
          TR.notebook.fadeFlash();
          if (door.exit) ints.exit(TR.player); else { ints.enter(door.site, TR.player); TR.hud.bigText(door.site.name); }
          TR.hud.prompt(null);
          return;
        }
      }
      if (door && !TR.hud.pOn && !vs.current) TR.hud.prompt(door.exit ? 'Way out' : door.site.name, door.exit ? 'Walk through the door' : 'Walk in');
      if (!door && !vs.current && TR.vehicles.nearest(TR.player.pos, 5) && !TR.hud.pOn) TR.hud.prompt(TR.vehicles.nearest(TR.player.pos, 5).spec.name, 'Press F to get in');
    },
    /** True while the player is pressing or moving toward the door. */
    walkingInto: function (door) {
      var v = TR.vehicles.current ? TR.vehicles.current.vel : TR.player.vel;
      return v.x * door.nx + v.z * door.nz < -1;
    },
    /** The door the player is close to. touch means right up against it. nx,nz point out of the doorway. */
    nearDoor: function () {
      var p = TR.player.pos, ints = TR.interiors, reachPad = TR.vehicles.current ? TR.vehicles.current.spec.radius + 1.4 : 2.2;
      if (ints.current) {
        var d = ints.doorPos(), out = d.z + 1.5 - p.z;
        if (Math.abs(p.x - d.x) > 4 || out > 7) return null;
        return { exit: true, nx: 0, nz: -1, touch: out < reachPad + 0.3 };
      }
      var sites = app.session.run.sites;
      for (var id in sites) {
        var s = sites[id];
        if (s.kind !== 'room' || Math.abs(p.y - s.y) > 3) continue;
        var f = s.front, wx = f.x - f.nx * f.off, wz = f.z - f.nz * f.off, along = (p.x - wx) * f.nx + (p.z - wz) * f.nz, side = (p.x - wx) * f.nz - (p.z - wz) * f.nx;
        if (along > -0.5 && along < 7 && Math.abs(side) < 3.4) {
          var locked = s.b.lock && !app.session.view.me.flags[s.b.lock];
          return { site: s, nx: f.nx, nz: f.nz, touch: along < reachPad + 0.6, locked: locked };
        }
      }
      return null;
    },

    winSequence: function () {
      var p = TR.player.pos;
      TR.hud.banner('FLAT BROKE! YOU DID IT!');
      TR.audio.buy(4, 5); TR.audio.cheer(1.4);
      TR.fx.confetti(p, 400, 24); TR.cam.shake = 1; TR.fx.slow = 1.6;
      for (var i = 0; i < 14; i++) setTimeout(function () { TR.fx.firework(p.x + (Math.random() - 0.5) * 140, 40 + Math.random() * 60, p.z + (Math.random() - 0.5) * 140); TR.audio.boom(0.35); }, i * 240);
    },
    endRun: function (ev) {
      if (app.ended) return;
      app.ended = true;
      app.running = false;
      TR.menus.closePerfect();
      TR.audio.engine(null);
      TR.audio.stopMusic();
      TR.dares.stop();
      if (TR.tutorial.el) { TR.tutorial.el.remove(); TR.tutorial.el = null; }
      var res = app.session.results();
      res.clout += TR.dares.clout || 0;
      var earned = TR.save.recordRun(res, app.mode);
      if (window.Hub) Hub.report('session-end', { result: res.won ? 'win' : 'lose', spent: res.spent, durationMs: res.ms, mode: app.mode, perfect: res.perfect });
      if (document.pointerLockElement) document.exitPointerLock();
      if (res.perfect) TR.hud.banner('PERFECT ZERO!');
      TR.hud.show(false);
      if (app.session.online) { TR.battle.stop(); TR.net.clearSeat(); TR.net.session = null; TR.net.room = null; }
      TR.menus.results(res, earned);
    },
    /** Back to the title without a results screen, for a room that closed. */
    quitToMenu: function () {
      app.running = false; app.ended = true;
      TR.audio.engine(null); TR.audio.stopMusic();
      TR.battle.stop(); TR.hud.show(false);
      TR.net.session = null; TR.net.room = null;
      TR.menus.title();
    },
    /** Quit a run from the pause menu: it still pays out. */
    quitRun: function () { app.session.finish(); app.endRun({ result: 'quit' }); if (app.session.online) app.session.leave(); },
    setPaused: function (v) {
      if (app.session && app.session.online) v = false;
      app.paused = v;
      if (v && document.pointerLockElement) document.exitPointerLock();
    },

    tickWorld: function (dt, pos) {
      var view = app.session.view, room = !!TR.interiors.current, under = pos.y < -20;
      TR.world.setSpace(room ? 'room' : under ? 'under' : 'surface');
      TR.world.setTime(view.hour, view.weather, pos, view.mode !== 'free' && view.dayMs - view.t < view.dayMs / 24);
      TR.fx.floor = room ? 0.1 : under ? pos.y + 0.1 : Math.max(0.1, pos.y - 30);
      // falling in the water: back to the last dry spot
      if (!TR.vehicles.current && !room && !under && pos.y < -1.4 && TR.world.isWater(pos.x, pos.z)) {
        var safe = app.lastSafe || app.session.run.spawn;
        TR.fx.confetti({ x: pos.x, y: -1, z: pos.z }, 18, 6);
        TR.player.teleport(safe.x, safe.y, safe.z);
        TR.hud.toast('Splash! You need a boat for that.', 'bad');
      } else if (TR.player.grounded && !TR.vehicles.current && !room && !TR.world.isWater(pos.x, pos.z)) {
        app.lastSafe = { x: pos.x, y: pos.y, z: pos.z };
      }
      if (app.mode === 'free') app.freeRoamTick();
      app.posT -= dt;
      if (app.posT <= 0) {
        app.posT = 0.1;
        var dist = room ? TR.interiors.current.district : TR.world.districtAt(pos.x, pos.z, pos.y);
        if (dist && dist !== app.district) { app.district = dist; TR.hud.area(TRD.districts.DISTRICTS[dist].name); }
        app.session.setPos(pos.x, pos.y, pos.z, TR.player.heading, room ? TR.interiors.current.id : null, dist);
        if (TR.battle) TR.battle.tick(view, pos);
        if (!room) TR.map.reveal(pos.x, pos.z);
        app.mapT = (app.mapT || 0) - 1;
        if (app.mapT <= 0) { app.mapT = 0.4; TR.map.update(pos, TR.player.heading, under, { dots: TR.notebook.mapDots(view.me).concat(TR.agents.dots(), (app.claimed || []).map(function (s) { return { x: s.front.x, z: s.front.z, c: '#ffc53d', r: 3 }; })) }); }
      }
      if (view.weather === 'rain' && !room && !under) for (var ri = 0; ri < 5; ri++) TR.fx.spawn(pos.x + (Math.random() - 0.5) * 70, pos.y + 30, pos.z + (Math.random() - 0.5) * 70, 0, -38, 0, 0xa8c8e8, 0.8, 0.6, 0);
      TR.life.update(dt, pos, app.t, room || under);
      TR.crowds.update(dt, pos, app.t, room);
      TR.traffic.update(dt, pos, room || under);
    },

    freeRoamTick: function () {},

    /** One simulation frame. Debug and tests call this directly when the page is hidden. */
    frame: function (dt) {
      var ts = TR.fx.timeScale(), sim = dt * ts;
      app.t += dt;
      if (TR.input.hit('Escape') && app.running) { if (app.paused) { TR.menus.close(); app.setPaused(false); } else { app.setPaused(true); TR.menus.pause(); } }
      if (app.running && !app.paused) {
        TR.hud.prompt(null);
        if (TR.vehicles.current) TR.vehicles.drive(dt); else TR.player.update(dt);   // you never slow down: effects can, your hands cannot
        var evs = app.session.tick(dt);
        app.handleEvents(evs);
        if (!app.running) { TR.input.endFrame(); return; }
        var pos = TR.player.pos;
        TR.goods.begin();
        TR.pads.update(dt, app.session, pos, app.t);
        var moving = Math.hypot(TR.player.vel.x, TR.player.vel.z) > 1 || (TR.vehicles.current && Math.abs(TR.vehicles.current.speed) > 1);
        TR.haul.update(dt, pos, app.t, moving);
        TR.life.racers(app.t, pos);
        TR.own.drawPlaced(pos);
        TR.dares.update(dt, pos, app.t, app.session);
        TR.goods.end();
        if (!TR.hud.pOn) TR.notebook.update(dt, app.session, pos);
        TR.gps.update(dt, app.session, pos, app.t);
        TR.agents.update(dt, app.session, pos, app.t);
        TR.phone.update(dt, app.session);
        TR.map.follow(TR.interiors.current ? TR.interiors.returnTo : pos, TR.vehicles.current ? TR.vehicles.current.heading : TR.player.heading, TR.input.yaw);   // indoors, the map stays on the street outside
        var me0 = app.session.view.me;
        if (me0.styleV !== app.styleV) { app.styleV = me0.styleV; TR.player.applyStyle(me0.style); TR.wardrobe.setPets(me0.style.pet, app.scene); }
        TR.wardrobe.updatePets(dt, pos, TR.player.heading, !!TR.vehicles.current);
        TR.wardrobe.updateTrail(dt, pos, moving, me0.style);
        TR.own.update();
        app.updateActions(dt);
        TR.hud.update(app.session.view, dt);
        app.cityGrowth(app.session.view.me);
        TR.tutorial.update(dt, app.session.view.me, pos);
        TR.audio.setScene(app.session.view.hour, TR.interiors.current ? 'shop' : app.district, app.session.view.mode !== 'free' && app.session.view.dayMs - app.session.view.t < app.session.view.dayMs / 24);
        if (app.rocketBought && app.session.view.hour >= 0 && app.session.view.hour < 1) { app.rocketBought = false; TR.world.launchRocket(); TR.hud.banner('YOUR ROCKET HAS LAUNCHED!'); TR.audio.boom(1); TR.cam.shake = 0.6; }
        app.tickWorld(dt, pos);
      }
      TR.input.endFrame();
      TR.world.update(dt, app.t);
      TR.fx.update(sim);
      if (!app.running) { // the menu flies slowly over the city
        var a = app.t * 0.06, cam = app.camera;
        TR.world.setSpace('surface');
        TR.world.setTime(10, 'clear', { x: 0, y: 0, z: 0 });
        cam.position.set(Math.cos(a) * 250, 120, Math.sin(a) * 250);
        cam.lookAt(0, 22, 0);
        return;
      }
      var v = TR.vehicles.current;
      var cfl = TR.interiors.current ? (TR.interiors.globe ? TR.interiors.floorHere(app.camera.position) + 0.8 : 0) : TR.player.pos.y < -20 ? app.floorAt(TR.player.pos) : TR.world.isWater(TR.player.pos.x, TR.player.pos.z) ? -1 : 0;
      TR.cam.update(app.camera, TR.player.pos, dt, v ? { dist: v.spec.cam, lift: 2.4, fov: 58 + Math.min(16, Math.abs(v.speed) * 0.34), floor: cfl } : { floor: cfl, fov: Math.hypot(TR.player.vel.x, TR.player.vel.z) > 14 ? 64 : 58 });
    },

    loop: function (now) {
      requestAnimationFrame(app.loop);
      var dt = Math.max(0, Math.min(0.05, (now - app.last) / 1000));
      app.last = now;
      TR.input.pollGamepad();
      app.fpsAcc += dt; app.fpsN++;
      if (app.fpsAcc >= 0.5) { app.fps = app.fpsN / app.fpsAcc; TR.quality.watch(app.fps, app.fpsAcc); TR.world.lod(TR.player.pos, app.camera); app.fpsAcc = 0; app.fpsN = 0; if (app.dbgFps) app.dbgFps.textContent = app.fps.toFixed(0) + ' FPS, ' + app.renderer.info.render.calls + ' calls'; }
      app.frame(dt);
      TR.post.render(app.scene, app.camera);
    },

    /** Runs n seconds of game time synchronously. Used for testing a hidden preview. */
    advance: function (seconds, dt) {
      dt = dt || 1 / 60;
      for (var i = 0; i < seconds / dt; i++) app.frame(dt);
      TR.post.render(app.scene, app.camera);
    },

    debugPanel: function (ui) {
      var d = document.createElement('div'); d.className = 'debug';
      d.innerHTML = '<div id="dbg-fps">..</div><div id="dbg-btns"></div>';
      ui.appendChild(d);
      app.dbgFps = d.querySelector('#dbg-fps');
      var btns = d.querySelector('#dbg-btns');
      function b(label, fn) { var e = document.createElement('button'); e.textContent = label; e.onclick = function () { fn(); e.blur(); }; btns.appendChild(e); }
      var live = function (fn) { return function () { if (app.session && app.session.online) { TR.hud.toast('Debug is off in online rooms.', 'bad'); return; } fn(); }; };
      var b0 = b; b = function (label, fn) { b0(label, live(fn)); };
      b('+$100B', function () { app.me().balance += 100 * R.B; });
      b('-$100B', function () { var p = app.me(); p.balance = Math.max(0, p.balance - 100 * R.B); });
      b('Hour+1', function () { var g = app.session.game; g.setClockHour((g.hourNow() + 1) % 24); });
      b('Broke', function () { app.me().balance = 50 * R.M; });
      b('Secrets', function () { app.showSecrets = !app.showSecrets; });
      Object.keys(TRD.districts.DISTRICTS).forEach(function (k) {
        b(k, function () { var sp = app.session.run.districtSpawn[k]; if (TR.interiors.current) TR.interiors.exit(TR.player); TR.player.teleport(sp.x, sp.y, sp.z, 0); });
      });
    },
    me: function () { return app.session.game.players.me; }
  };

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', app.boot); else app.boot();
})();
