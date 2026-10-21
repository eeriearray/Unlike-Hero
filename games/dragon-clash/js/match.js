/*
 * Dragon Clash — a match on screen.
 *
 * Local: runs DC.Sim at a fixed 60 Hz with inputs from keyboards, gamepads and CPU bots.
 * Online: the server runs the sim; this renders the server's snapshots (interpolated) and sends inputs.
 * Both paths draw from the same snapshot shape, so they look and sound the same.
 */
(function () {
  'use strict';
  var D = window.DC.Data, Sim = window.DC.Sim, Build = window.DC.Build, Bot = window.DC.Bot;
  var Art = window.DCArt, Anim = window.DCAnim, FXL = window.DCFX, Audio = window.DCAudio, Input = window.DCInput;
  var STEP = 1000 / 60;
  var COUNTDOWN = 150;

  function Match(opts) {
    this.o = opts;
    this.canvas = opts.canvas;
    this.ctx = this.canvas.getContext('2d');
    this.fx = new FXL.FX();
    this.settings = opts.settings || {};
    this.debug = !!this.settings.debug;
    this.paused = false;
    this.ended = false;
    this.time = 0;
    this.cam = { x: 800, y: 450, z: 1 };
    this.trails = {};
    this.animators = {};
    this.swings = {};
    this.lastHit = null;
    this.banner = null;
    this.snaps = [];
    this.countdown = opts.mode === 'local' ? COUNTDOWN : 0;
    this.endTimer = 0;
    var self = this;
    if (opts.mode === 'local') {
      this.sim = new Sim(opts.simOpts);
      this.setupInfo = this.sim.setup();
      this.bots = {};
      (opts.controllers || []).forEach(function (c) {
        if (c.type === 'bot') self.bots[c.i] = new Bot(self.sim, c.i, { level: c.level || 2, mode: c.mode || 'cpu', seed: (opts.simOpts.seed || 1) + c.i });
      });
      Input.setInUse((opts.controllers || []).filter(function (c) { return c.type === 'human'; }).map(function (c) { return c.device; }));
    } else {
      this.setupInfo = opts.setup;
    }
    this.arena = D.ARENAS[this.setupInfo.arena] || D.ARENAS.skyforge;
    this.setupInfo.fighters.forEach(function (f) { Art.prepare(f.build.look); });
    window.DCScenery.prepare(this.arena, window.innerWidth, window.innerHeight);   // tint each dragon's art now, not mid-fight
    this.view = null;
    this.acc = 0;
    this.last = performance.now();
    this.raf = requestAnimationFrame(function loop(now) { if (self.dead) return; self.frame(now); self.raf = requestAnimationFrame(loop); });
    this.unKey = Input.onKey(function (e) { self.onKey(e); });
    this.resize();
    this.onResize = function () { self.resize(); };
    window.addEventListener('resize', this.onResize);
    document.body.classList.add('in-match');
    Audio.music(true);
  }

  var M = Match.prototype;

  M.destroy = function () {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.unKey();
    window.removeEventListener('resize', this.onResize);
    document.body.classList.remove('in-match');
    Audio.music(false);
  };

  M.resize = function () {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * dpr); this.canvas.height = Math.round(this.H * dpr);
    this.canvas.style.width = this.W + 'px'; this.canvas.style.height = this.H + 'px';
    this.dpr = dpr;
  };

  M.onKey = function (e) {
    if (e.code === 'Escape' || e.code === 'KeyP') { if (!this.ended) this.togglePause(); }
    if (e.code === 'Backquote') this.debug = !this.debug;
    if (this.o.training && !this.paused) {
      if (e.code === 'KeyR') this.trainingReset();
      if (e.code === 'KeyT' && this.o.onTrainingKey) this.o.onTrainingKey('mode');
      if (e.code === 'BracketLeft') this.setDummyDamage(this.dummyDamage() - 10);
      if (e.code === 'BracketRight') this.setDummyDamage(this.dummyDamage() + 10);
    }
  };

  M.togglePause = function (force) {
    var p = force != null ? force : !this.paused;
    if (p === this.paused) return;
    this.paused = p;
    if (this.o.onPause) this.o.onPause(p);
  };

  // ─────────────── training ───────────────
  M.trainingReset = function () { if (this.sim) { this.sim.resetPositions(); this.fx = new FXL.FX(); } };
  M.dummyDamage = function () { var i = this.o.training ? this.o.training.dummy : 1; return this.sim ? this.sim.fighters[i].dmg : 0; };
  M.setDummyDamage = function (v) { if (this.sim) this.sim.setDamage(this.o.training.dummy, Math.max(0, Math.min(300, v))); };
  M.setDummyMode = function (mode, level) {
    var i = this.o.training.dummy;
    this.bots[i] = new Bot(this.sim, i, { mode: mode, level: level || 2, seed: 3 });
  };

  // ─────────────── online ───────────────
  /** Online: a server snapshot arrived. */
  M.pushSnapshot = function (snap) {
    snap.rt = performance.now();
    this.snaps.push(snap);
    if (this.snaps.length > 30) this.snaps.shift();
    var self = this;
    (snap.ev || []).forEach(function (e) { self.onEvent(e); });
    this.countdown = snap.cd || 0;
    if (snap.end && !this.ended) this.finish(snap.end);
  };

  M.interpolated = function () {
    var s = this.snaps;
    if (!s.length) return null;
    var target = performance.now() - 70;
    var a = s[0], b = s[s.length - 1];
    for (var i = s.length - 1; i > 0; i--) if (s[i - 1].rt <= target) { a = s[i - 1]; b = s[i]; break; }
    if (a === b || b.rt === a.rt) return b;
    var k = Math.max(0, Math.min(1, (target - a.rt) / (b.rt - a.rt)));
    var out = JSON.parse(JSON.stringify(b));
    out.f.forEach(function (f, i) {
      var p = a.f[i];
      if (!p || Math.abs(p.x - f.x) > 200) return;
      f.x = p.x + (f.x - p.x) * k; f.y = p.y + (f.y - p.y) * k;
    });
    var prev = {};
    a.p.forEach(function (p) { prev[p.id] = p; });
    out.p.forEach(function (p) { var q = prev[p.id]; if (q) { p.x = q.x + (p.x - q.x) * k; p.y = q.y + (p.y - q.y) * k; } });
    return out;
  };

  // ─────────────── loop ───────────────
  M.frame = function (now) {
    var dt = Math.min(100, now - this.last);
    this.last = now;
    this.time += dt / 1000;
    this.dt = this.paused ? 0 : dt / 1000;
    var ticks = 0;
    if (this.o.mode === 'local') {
      if (!this.paused) {
        this.acc += dt;
        while (this.acc >= STEP && ticks < 5) { this.prevPos = this.positions(); this.tick(); this.acc -= STEP; ticks++; }
        if (ticks === 5) this.acc = 0;
      }
      this.view = this.sim.snapshot();
      // Draw between the last two simulation ticks so motion is smooth at any refresh rate
      this.blendPositions(this.view, this.prevPos, this.paused ? 1 : this.acc / STEP);
    } else {
      this.sendInput();
      this.view = this.interpolated();
      this.fxAcc = (this.fxAcc || 0) + (this.paused ? 0 : dt);
      while (this.fxAcc >= STEP) { this.fxAcc -= STEP; ticks++; }
    }
    // Effects advance with game time, not with the screen's refresh rate
    for (var k = 0; k < Math.min(ticks, 5); k++) this.fx.update();
    this.render();
  };

  M.positions = function () {
    return { f: this.sim.fighters.map(function (f) { return [f.x, f.y]; }), p: this.sim.projectiles.reduce(function (m, p) { m[p.id] = [p.x, p.y]; return m; }, {}) };
  };

  M.blendPositions = function (view, prev, k) {
    if (!prev || k >= 1) return;
    view.f.forEach(function (f, i) {
      var p = prev.f[i];
      if (!p || Math.abs(p[0] - f.x) > 150 || Math.abs(p[1] - f.y) > 150) return;   // respawns and teleports snap
      f.x = p[0] + (f.x - p[0]) * k; f.y = p[1] + (f.y - p[1]) * k;
    });
    view.p.forEach(function (q) { var p = prev.p[q.id]; if (p) { q.x = p[0] + (q.x - p[0]) * k; q.y = p[1] + (q.y - p[1]) * k; } });
  };

  M.readInputs = function () {
    var self = this, out = [];
    (this.o.controllers || []).forEach(function (c) {
      if (c.type === 'human') {
        out[c.i] = { held: Input.read(c.device), pressed: 0 };
        if (c.device.indexOf('pad') === 0 && Input.padStart(+c.device.slice(3)) && !self.padPause) { self.padPause = true; self.togglePause(); }
        else if (c.device.indexOf('pad') === 0 && !Input.padStart(+c.device.slice(3))) self.padPause = false;
      } else if (self.bots[c.i]) out[c.i] = self.bots[c.i].think();
    });
    return out;
  };

  M.tick = function () {
    if (this.ended && this.endTimer > 0) { if (--this.endTimer === 0 && this.o.onEnd) this.o.onEnd(this.sim.result, this); }
    if (this.countdown > 0) {
      this.countdown--;
      if (this.countdown % 60 === 0 && this.countdown > 0) Audio.play('count');
      if (this.countdown === 0) Audio.play('go');
      return;
    }
    if (this.sim.result) return;
    var inputs = this.readInputs();
    this.sim.step(inputs);
    var self = this;
    this.sim.drainEvents().forEach(function (e) { self.onEvent(e); });
    if (this.sim.result && !this.ended) this.finish(this.sim.result);
  };

  /** Online: send this device's held buttons plus press counters (so short taps are never lost). */
  M.sendInput = function () {
    if (!this.o.net || this.o.spectator) return;
    var held = this.paused ? 0 : Input.read(this.o.device || 'kb1');
    var now = performance.now();
    this.pressCount = this.pressCount || {};
    var prev = this.prevHeld || 0, B = Sim.BTN, changed = held !== prev;
    for (var k in B) if ((held & B[k]) && !(prev & B[k])) this.pressCount[k] = ((this.pressCount[k] || 0) + 1) & 255;
    this.prevHeld = held;
    if (changed || now - (this.lastSend || 0) > 100) {
      this.lastSend = now;
      this.o.net.sendInput(held, this.pressCount);
    }
  };

  M.finish = function (result) {
    this.ended = true;
    if (this.lastKo) this.endFocus = { x: this.lastKo.x, y: this.lastKo.y };
    this.banner = { text: result.winnerTeam < 0 ? 'DRAW' : 'GAME!', t: 0 };
    Audio.play('ko');
    if (this.o.mode === 'local') this.endTimer = 120;
    else { var self = this; setTimeout(function () { if (!self.dead && self.o.onEnd) self.o.onEnd(result, self); }, 2000); }
  };

  M.onEvent = function (e) {
    var fs = this.setupInfo.fighters, self = this;
    this.fx.onEvent(e, fs, this.settings);
    var pan = this.panFor(e.x);
    switch (e.type) {
      case 'hit':
        Audio.play('hit', { kb: e.kb, element: e.element !== 'phys' ? e.element : null, pan: pan });
        this.lastHit = e;
        break;
      case 'attack':
        if (e.kind === 'sig' || e.kind === 'ability') {
          // Energy gathers during startup; the release sound lands on the first active frame
          var b = fs[e.f] && fs[e.f].build, def = b && (e.kind === 'sig' ? D.SIGNATURES[b.signature] : D.ABILITIES[b.ability]);
          Audio.play('charge', { pan: pan, vol: 0.7 });
          var delay = def ? def.startup * 1000 / 60 : 150;
          setTimeout(function () { if (!self.dead) Audio.play('cast', { element: e.element, pan: pan }); }, delay);
        } else Audio.play(e.kind === 'heavy' ? 'heavyWhoosh' : 'whoosh', { pan: pan });
        break;
      case 'jump': Audio.play(e.air ? 'flap' : 'jump', { pan: pan, vol: 0.8 }); break;
      case 'land': Audio.play('land', { pan: pan, vol: e.hard ? 1 : 0.45 }); break;
      case 'ko': Audio.play('ko', { pan: pan }); this.lastKo = e; this.announceKo(e); break;
      case 'ledge': Audio.play('ledge', { pan: pan }); break;
      case 'rule': Audio.play(e.rule === 'clash' ? 'clash' : 'rule', { pan: pan }); break;
      case 'break': Audio.play('break', { pan: pan }); break;
      case 'respawn': Audio.play('respawn', { pan: pan, vol: 0.6 }); break;
      case 'buff': Audio.play('buff', { pan: pan }); break;
      case 'sfx': if (e.id === 'dodge') Audio.play('dodge', { pan: pan }); else if (e.id === 'denied' && this.isLocalFighter(e.f)) Audio.play('denied'); break;
    }
  };

  // Stereo position from where the event happened on screen
  M.panFor = function (x) {
    if (x == null || !this.W) return 0;
    return ((x - this.cam.x) * this.cam.z) / (this.W / 2) * 0.7;
  };

  // The announcer: a few lines, used sparingly
  M.announceKo = function (e) {
    var now = this.view ? this.view.t : 0, v = this.view;
    var ending = v && this.setupInfo.fighters && (function () {
      var alive = {};
      v.f.forEach(function (f, i) { if (f.st !== 'out' && !(i === e.f && e.stocks <= 0)) alive[this.setupInfo.fighters[i].team] = true; }, this);
      return Object.keys(alive).length <= 1;
    }).call(this);
    if (this.o.training) { Audio.voice('vKO'); return; }
    if (ending) { Audio.voice('vKnockout', { force: true, delay: 0.3 }); return; }
    this.kos = this.kos || {};
    var by = e.by, frenzy = false;
    if (by >= 0) { var last = this.kos[by]; frenzy = last != null && now - last < 600; this.kos[by] = now; }
    if (frenzy) Audio.voice('vFrenzy', { delay: 0.3 });
    else Audio.voice('vKO', { delay: 0.2 });
    // Everyone left is on their last stock: once per match
    if (!this.deathMatchSaid && v) {
      var left = v.f.filter(function (f, i) { return f.st !== 'out' && !(i === e.f && e.stocks <= 0); });
      if (left.length > 1 && left.every(function (f) { return f.s <= 1; })) { this.deathMatchSaid = true; Audio.voice('vDeathMatch', { delay: 2.2, force: true }); }
    }
  };

  M.isLocalFighter = function (i) {
    if (this.o.mode !== 'local') return (this.o.localSlots || []).indexOf(i) >= 0;
    return (this.o.controllers || []).some(function (c) { return c.i === i && c.type === 'human'; });
  };

  // ─────────────── camera ───────────────
  M.updateCamera = function () {
    var v = this.view; if (!v) return;
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, n = 0;
    var bz = this.arena.blast;
    v.f.forEach(function (f) {
      if (f.st === 'dead' || f.st === 'out') return;
      var x = Math.max(bz.left + 80, Math.min(bz.right - 80, f.x)), y = Math.max(bz.top + 100, Math.min(bz.bottom - 60, f.y));
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y - 140); maxY = Math.max(maxY, y); n++;
    });
    var main = this.arena.platforms[0];
    if (!n) { minX = main.x; maxX = main.x + main.w; minY = main.y - 300; maxY = main.y; }
    // Always keep the stage in view
    // Keep a little stage in view, but frame the fighters: dragons should read large.
    var mid = main.x + main.w / 2;
    minX = Math.min(minX, mid - 220); maxX = Math.max(maxX, mid + 220); maxY = Math.max(maxY, main.y + 40); minY = Math.min(minY, main.y - 260);
    var pad = 150;
    var w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
    var base = Math.min(this.W / 1600, this.H / 900);
    this.cam.zBase = base;
    var z = Math.min(this.W / w, this.H / h);
    z = Math.max(base * 0.75, Math.min(base * 1.9, z));
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    var k = 0.08;
    if (this.endFocus) {
      // Final KO: drift toward where it happened, slightly closer, clamped so the stage stays on screen
      cx = cx * 0.6 + Math.max(main.x, Math.min(main.x + main.w, this.endFocus.x)) * 0.4; cy = cy * 0.7 + Math.min(main.y, this.endFocus.y) * 0.3; z = Math.min(base * 1.6, z * 1.15); k = 0.05;
    }
    this.cam.x += (cx - this.cam.x) * k; this.cam.y += (cy - this.cam.y) * k; this.cam.z += (z - this.cam.z) * k;
  };

  // ─────────────── render ───────────────
  M.render = function () {
    var x = this.ctx, v = this.view, W = this.W, H = this.H, self = this;
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!v) { x.fillStyle = '#120c24'; x.fillRect(0, 0, W, H); this.drawText('Connecting…', W / 2, H / 2, 28); return; }
    this.updateCamera();
    var cam = this.cam;
    window.DCScenery.backdrop(x, this.arena, cam, W, H, this.time);
    x.save();
    var sh = this.fx.shake;
    x.translate(W / 2 + (sh ? (Math.random() - 0.5) * sh : 0), H / 2 + (sh ? (Math.random() - 0.5) * sh : 0));
    x.scale(cam.z, cam.z);
    x.translate(-cam.x, -cam.y);
    window.DCScenery.platforms(x, this.arena, this.time);
    v.s.forEach(function (s) { FXL.drawStructure(x, s, self.time); });
    // Floor hazards under the dragons
    v.p.forEach(function (p) { if (p.g) FXL.drawProjectile(x, p, self.time, self.fx); });
    var fs = this.setupInfo.fighters;
    v.f.forEach(function (f, i) { if (f.st !== 'dead' && f.st !== 'out') self.drawFighter(x, f, fs[i], i); });
    v.p.forEach(function (p) { if (!p.g) FXL.drawProjectile(x, p, self.time, self.fx); });
    this.fx.draw(x);
    if (this.debug) this.drawDebug(x);
    x.restore();
    if (this.fx.flash > 0.02) { x.fillStyle = 'rgba(255,255,255,' + this.fx.flash * 0.5 + ')'; x.fillRect(0, 0, W, H); }
    window.DCScenery.foreground(x, this.arena, cam, W, H, this.time);
    FXL.drawVignette(x, W, H, this.arena.theme);
    this.drawOffscreen(x);
    this.drawHud(x);
    this.drawIntro(x, v, W, H);
    if (this.banner) {
      // GAME!: slams in, holds, never covers the HUD
      var bt = ++this.banner.t, sc = bt < 8 ? 1.8 - bt * 0.1 : 1;
      this.drawText(this.banner.text, W / 2, H * 0.24, Math.min(110, W / 7) * sc, '#ffffff', Math.min(1, bt / 6));
    }
    if (this.debug) this.drawDebugHud(x);
  };

  // 3-2-1 with a closing ring, then FIGHT! punches in above the fighters and clears within a second.
  M.drawIntro = function (x, v, W, H) {
    var y = H * 0.24, size = Math.min(96, W / 8);
    if (this.countdown > 0) {
      var c = Math.ceil(this.countdown / 60), k = (this.countdown % 60) / 60;
      x.save(); x.strokeStyle = 'rgba(255,207,74,' + (0.8 * k) + ')'; x.lineWidth = 6;
      x.beginPath(); x.arc(W / 2, y, size * (0.55 + (1 - k) * 0.35), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); x.stroke(); x.restore();
      this.drawText(String(Math.min(3, c)), W / 2, y, size * (0.8 + k * 0.25), '#ffffff', 0.4 + 0.6 * k);
      return;
    }
    var t = v.t;
    if (t > 0 && t < 55 && !this.o.training) {
      var punch = t < 6 ? 1.6 - t * 0.1 : 1;
      this.drawText('FIGHT!', W / 2, y, size * 1.1 * punch, '#ffcf4a', t < 35 ? 1 : 1 - (t - 35) / 20);
    }
  };

  M.drawText = function (t, X, Y, size, color, alpha) {
    var x = this.ctx;
    x.save(); x.globalAlpha = alpha != null ? Math.max(0, alpha) : 1;
    x.font = '400 ' + size + 'px "Lilita One", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = Math.max(4, size / 10); x.strokeStyle = 'rgba(20,10,40,0.85)'; x.strokeText(t, X, Y);
    x.fillStyle = color || '#fff'; x.fillText(t, X, Y);
    x.restore();
  };

  M.drawFighter = function (x, f, info, i) {
    var build = info.build, el = D.ELEMENTS[build.element];
    var teamCol = D.TEAM_COLORS[info.team % D.TEAM_COLORS.length];
    // Ground shadow in team colour
    var ground = this.groundBelow(f.x, f.y);
    if (ground != null) {
      var d = Math.max(0, ground - f.y), k = Math.max(0.25, 1 - d / 400);
      x.fillStyle = 'rgba(0,0,0,' + 0.28 * k + ')'; x.beginPath(); x.ellipse(f.x, ground, 38 * k, 7 * k, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = Art.alpha(teamCol, 0.7 * k); x.lineWidth = 2.5; x.beginPath(); x.ellipse(f.x, ground, 40 * k, 8 * k, 0, 0, Math.PI * 2); x.stroke();
    }
    // Afterimages while dodging
    var tr = this.trails[i] || (this.trails[i] = []);
    if (f.st === 'dodge' || f.st === 'airdodge' || (f.st === 'hitstun' && f.tb)) { tr.push({ x: f.x, y: f.y, fc: f.fc }); if (tr.length > 3) tr.shift(); }
    else if (tr.length) tr.shift();
    var an = this.animators[i] || (this.animators[i] = new Anim.Animator());
    var gb = this.groundBelow(f.x, f.y);
    var pose = an.update(f, build, this.time + i * 0.37, this.dt || 0, { ground: gb == null ? null : gb - f.y });
    if (f.st === 'dodge' || f.st === 'airdodge') pose.alpha = 0.75;
    else if (f.inv) pose.alpha = 0.55 + 0.45 * (Math.floor(this.time * 18) % 2);
    if (f.hl > 0 && f.st === 'hitstun') pose.dx += (Math.random() - 0.5) * 6;
    var self = this;
    tr.forEach(function (t, k) {
      x.save(); x.translate(t.x, t.y); x.globalAlpha = 0.07 * (k + 1);
      var p2 = Object.assign({}, pose, { facing: t.fc, flash: 1 });
      Art.draw(x, build.look, build.body, p2);
      x.restore();
    });
    // Element glow for specials / stone skin
    if (pose.glow > 0.05) {
      var g = x.createRadialGradient(f.x, f.y - 70, 20, f.x, f.y - 70, 85);
      g.addColorStop(0, Art.alpha(f.sk ? '#d8b07a' : el.color, 0.14 * pose.glow)); g.addColorStop(1, Art.alpha(el.color, 0));
      x.fillStyle = g; x.beginPath(); x.arc(f.x, f.y - 70, 85, 0, Math.PI * 2); x.fill();
    }
    x.save(); x.translate(f.x, f.y);
    Art.draw(x, build.look, build.body, pose);
    x.restore();
    this.swingTrail(x, f, build, pose, i);
    this.footDust(f, an, i);
    FXL.drawAttackFx(x, f, info, this.time, this.fx, pose);
    this.drawStatus(x, f, build);
    this.drawAura(f, build);
    // Name tag
    var tag = this.tagFor(i, info);
    var ty = f.y - 150 * D.BODIES[build.body].scale[1];
    x.font = '400 15px "Lilita One", system-ui, sans-serif'; x.textAlign = 'center';
    x.lineWidth = 4; x.strokeStyle = 'rgba(10,6,20,0.8)'; x.strokeText(tag, f.x, ty);
    x.fillStyle = teamCol; x.fillText(tag, f.x, ty);
    x.beginPath(); x.moveTo(f.x - 6, ty + 5); x.lineTo(f.x + 6, ty + 5); x.lineTo(f.x, ty + 11); x.fill();
  };

  // Swing trail from the rig: the attacking hand's real path, kept while the strike plays out.
  var HAND_ANIMS = { clawLight: 1, clawHeavy: 1, up: 1, stomp: 'foot', burst: 1, throw: 1, push: 1, dash: 1, breath: 0, slam: 'foot', nova: 1 };
  M.swingTrail = function (x, f, build, pose, i) {
    var st = this.swings[i] || (this.swings[i] = []);
    var a = f.st === 'attack' ? Anim.attackPhase(f, build) : null;
    var key = a ? Anim.attackKey(f, build, a.def) : null;
    var live = a && HAND_ANIMS[key] && (a.phase === 'active' || (a.phase === 'startup' && a.p > 0.7) || (a.phase === 'recovery' && a.p < 0.25));
    if (live) {
      var tip = HAND_ANIMS[key] === 'foot' ? 'nearFoot' : 'nearHand';
      var p = Art.pointOf(tip, build.body, pose);
      st.push({ x: f.x + p[0], y: f.y + p[1], a: 1 });
      if (st.length > 8) st.shift();
    } else if (st.length) { st.shift(); }
    st.forEach(function (q) { q.a *= live ? 1 : 0.7; });
    if (st.length > 2) {
      var heavy = a ? (a.def.kind === 'heavy' || f.mv === 'sig' || f.mv === 'ability') : true;
      FXL.drawTrail(x, st, build.element, heavy, this.fx);
    }
  };

  M.footDust = function (f, an, i) {
    if (f.st === 'run' && f.gr) {
      var step = Math.floor(an.phase / Math.PI);
      if (an.lastStep != null && step !== an.lastStep) { this.fx.dust(f.x - f.fc * 10, f.y, 3, 8, -f.fc); Audio.play('step', { pan: this.panFor(f.x), vol: 0.55 }); }
      an.lastStep = step;
    }
    if (f.st === 'dodge' && f.stT === 1 && f.gr) this.fx.dust(f.x, f.y, 7, 14, -f.fc);
  };

  M.tagFor = function (i, info) {
    var c = (this.o.controllers || []).filter(function (c) { return c.i === i; })[0];
    if (this.o.mode !== 'local') return info.name + ((this.o.localSlots || []).indexOf(i) >= 0 ? ' (you)' : '');
    if (c && c.type === 'bot') return c.mode && c.mode !== 'cpu' ? 'DUMMY' : 'CPU';
    return c && c.label ? c.label : info.name;
  };

  M.drawStatus = function (x, f, build) {
    var cx = f.x, top = f.y - 60;
    if (f.ch) { x.strokeStyle = 'rgba(200,245,255,0.8)'; x.lineWidth = 2; for (var k = 0; k < 4; k++) { var a = this.time * 2 + k * 1.57; x.beginPath(); x.moveTo(cx + Math.cos(a) * 36, top + Math.sin(a) * 50); x.lineTo(cx + Math.cos(a) * 46, top + Math.sin(a) * 60); x.stroke(); } }
    if (f.bu && Math.random() < 0.4) this.fx.add({ x: cx + (Math.random() - 0.5) * 40, y: f.y - Math.random() * 110, vx: 0, vy: -1.5, life: 20, size: 4, color: Math.random() < 0.5 ? '#ff6a2a' : '#ffcf4a', type: 'dot' });
    if (f.so && Math.random() < 0.25) this.fx.add({ x: cx + (Math.random() - 0.5) * 40, y: f.y - 40 - Math.random() * 80, vx: 0, vy: 1, life: 24, size: 3, color: '#8ff5ff', type: 'dot', grav: 0.15 });
    if (f.sk) { x.strokeStyle = 'rgba(216,176,122,0.7)'; x.lineWidth = 4; x.beginPath(); x.ellipse(cx, f.y - 64, 48, 78, 0, 0, Math.PI * 2); x.stroke(); }
  };

  // Cosmetic element aura (look.aura): small, behind the action.
  M.drawAura = function (f, build) {
    var a = build.look.aura;
    if (a === 'none' || Math.random() > (a === 'blazing' ? 0.5 : 0.18)) return;
    var el = D.ELEMENTS[build.element], dir = -1;
    var types = { fire: ['#ff6a2a', '#ffcf4a'], ice: ['#e8fbff', '#7fe0ff'], lightning: ['#ffe14a', '#b48cff'], earth: ['#a0794a', '#d8c08a'], water: ['#8ff5ff', '#2fd3c8'] }[build.element];
    this.fx.add({ x: f.x + (Math.random() - 0.5) * 50, y: f.y - Math.random() * 120, vx: (Math.random() - 0.5) * 0.6, vy: build.element === 'ice' || build.element === 'water' ? 0.6 : dir * 1.2,
                  life: 30, size: 2.5, color: types[Math.random() < 0.5 ? 0 : 1], type: build.element === 'earth' ? 'shard' : 'dot', grav: build.element === 'earth' ? 0.08 : 0 });
    return el;
  };

  M.groundBelow = function (x, y) {
    var best = null;
    this.arena.platforms.forEach(function (p) { if (x >= p.x && x <= p.x + p.w && p.y >= y - 2 && (best == null || p.y < best)) best = p.y; });
    return best;
  };

  M.drawOffscreen = function (x) {
    var v = this.view, cam = this.cam, W = this.W, H = this.H, fs = this.setupInfo.fighters, self = this;
    v.f.forEach(function (f, i) {
      if (f.st === 'dead' || f.st === 'out') return;
      var sx = (f.x - cam.x) * cam.z + W / 2, sy = (f.y - 60 - cam.y) * cam.z + H / 2;
      if (sx > 0 && sx < W && sy > 0 && sy < H - 120) return;
      var cx = Math.max(40, Math.min(W - 40, sx)), cy = Math.max(40, Math.min(H - 160, sy));
      var col = D.TEAM_COLORS[fs[i].team % 4];
      x.save();
      x.fillStyle = 'rgba(10,6,20,0.75)'; x.strokeStyle = col; x.lineWidth = 3;
      x.beginPath(); x.arc(cx, cy, 30, 0, Math.PI * 2); x.fill(); x.stroke();
      var a = Math.atan2(sy - cy, sx - cx);
      x.fillStyle = col; x.beginPath(); x.moveTo(cx + Math.cos(a) * 42, cy + Math.sin(a) * 42); x.lineTo(cx + Math.cos(a + 0.4) * 30, cy + Math.sin(a + 0.4) * 30); x.lineTo(cx + Math.cos(a - 0.4) * 30, cy + Math.sin(a - 0.4) * 30); x.fill();
      x.beginPath(); x.arc(cx, cy, 28, 0, Math.PI * 2); x.clip();
      x.translate(cx, cy + 40); x.scale(0.36, 0.36);
      Art.draw(x, fs[i].build.look, fs[i].build.body, { time: self.time, facing: f.fc });
      x.restore();
    });
  };

  function dmgColor(d) {
    if (d < 35) return '#ffffff';
    if (d < 70) return '#ffe98a';
    if (d < 110) return '#ffb03a';
    if (d < 160) return '#ff5a3a';
    return '#d01a33';
  }

  M.drawHud = function (x) {
    var v = this.view, fs = this.setupInfo.fighters, W = this.W, H = this.H, self = this;
    // Cards are laid out at a fixed 200 x 76 and scaled as a unit, so six fighters on a small screen stay tidy.
    var n = v.f.length, gap = 8, sc = Math.min(1, (W - 24 - (n - 1) * gap) / (n * 200)), cw = 200, ch = 76;
    var total = n * cw * sc + (n - 1) * gap, X0 = (W - total) / 2, Y0 = H - ch * sc - 12;
    v.f.forEach(function (f, i) {
      var info = fs[i], b = info.build, el = D.ELEMENTS[b.element];
      var cx = 0, y0 = 0;
      var team = D.TEAM_COLORS[info.team % 4];
      x.save();
      x.translate(X0 + i * (cw * sc + gap), Y0); x.scale(sc, sc);
      x.globalAlpha = f.st === 'out' ? 0.45 : 1;
      x.fillStyle = 'rgba(14,8,30,0.72)'; roundRect(x, cx, y0, cw, ch, 14); x.fill();
      x.fillStyle = team; roundRect(x, cx, y0, 6, ch, 3); x.fill();
      // Portrait
      x.save(); roundRect(x, cx + 10, y0 + 8, 58, 60, 10); x.clip();
      x.fillStyle = Art.alpha(el.color, 0.25); x.fillRect(cx + 10, y0 + 8, 58, 60);
      x.translate(cx + 32, y0 + 140); x.scale(0.82, 0.82);
      Art.draw(x, b.look, b.body, { time: self.time + i, facing: 1, frame: 0 });
      x.restore();
      // Name and element
      x.font = '600 12px Nunito, system-ui, sans-serif'; x.textAlign = 'left'; x.fillStyle = '#d8d0f0';
      x.fillText(el.icon + ' ' + self.tagFor(i, info).slice(0, 14), cx + 74, y0 + 20);
      // Damage
      var shakeX = f.hl > 0 ? (Math.random() - 0.5) * 4 : 0;
      x.font = '400 34px "Lilita One", system-ui, sans-serif';
      x.lineWidth = 5; x.strokeStyle = 'rgba(10,6,20,0.9)';
      var txt = f.st === 'out' ? 'OUT' : Math.floor(f.d) + '%';
      x.strokeText(txt, cx + 74 + shakeX, y0 + 54); x.fillStyle = f.st === 'out' ? '#8a8aa0' : dmgColor(f.d); x.fillText(txt, cx + 74 + shakeX, y0 + 54);
      // Stocks
      var stocks = Math.min(f.s, 9);
      if (!(self.o.training)) for (var k = 0; k < stocks; k++) { x.fillStyle = el.color; x.beginPath(); x.arc(cx + 78 + k * 12, y0 + 66, 4.5, 0, Math.PI * 2); x.fill(); }
      // Cooldown rings: signature and ability
      var sigCd = D.SIGNATURES[b.signature].cooldown, abCd = D.ABILITIES[b.ability].cooldown;
      ring(x, cx + cw - 20, y0 + 22, 11, f.sc / sigCd, el.color, 'L');
      ring(x, cx + cw - 20, y0 + 52, 11, f.ac / abCd, el.glow, '↓L');
      x.restore();
    });
    if (v.tl) {
      var s = Math.ceil(v.tl / 60);
      this.drawText(Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2), W / 2, 34, 30, s <= 10 ? '#ff5a3a' : '#fff');
    }
  };

  function ring(x, cx, cy, r, frac, col, label) {
    x.lineWidth = 3;
    x.strokeStyle = 'rgba(255,255,255,0.12)'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
    var ready = frac <= 0;
    x.strokeStyle = ready ? col : 'rgba(255,255,255,0.45)';
    x.beginPath(); x.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (ready ? 1 : 1 - Math.min(1, frac))); x.stroke();
    x.font = '700 9px Nunito, system-ui, sans-serif'; x.textAlign = 'center'; x.fillStyle = ready ? '#fff' : 'rgba(255,255,255,0.45)';
    x.fillText(label, cx, cy + 3);
  }

  function roundRect(x, X, Y, w, h, r) {
    x.beginPath(); x.moveTo(X + r, Y); x.lineTo(X + w - r, Y); x.quadraticCurveTo(X + w, Y, X + w, Y + r); x.lineTo(X + w, Y + h - r);
    x.quadraticCurveTo(X + w, Y + h, X + w - r, Y + h); x.lineTo(X + r, Y + h); x.quadraticCurveTo(X, Y + h, X, Y + h - r); x.lineTo(X, Y + r); x.quadraticCurveTo(X, Y, X + r, Y); x.closePath();
  }

  // ─────────────── debug overlay ───────────────
  M.drawDebug = function (x) {
    var v = this.view, fs = this.setupInfo.fighters, self = this;
    x.save();
    x.lineWidth = 2;
    v.f.forEach(function (f, i) {
      if (f.st === 'dead' || f.st === 'out') return;
      var st = Build.deriveStats(fs[i].build);
      x.strokeStyle = f.inv ? 'rgba(120,200,255,0.9)' : 'rgba(80,255,120,0.9)';
      x.strokeRect(f.x - st.hurt.w / 2, f.y - st.hurt.h, st.hurt.w, st.hurt.h);
      var pseudo = { state: f.st, moveDef: Anim.moveDef(f, fs[i].build), moveT: f.mT, moveKind: f.mv === 'sig' ? 'sig' : f.mv === 'ability' ? 'ability' : (D.MOVES[f.mv] || {}).kind, stats: st, facing: f.fc, x: f.x, y: f.y };
      Sim.prototype.activeBoxes.call(null, pseudo).forEach(function (b) { x.fillStyle = 'rgba(255,40,60,0.35)'; x.fillRect(b.x, b.y, b.w, b.h); x.strokeStyle = '#ff2840'; x.strokeRect(b.x, b.y, b.w, b.h); });
      x.fillStyle = '#fff'; x.font = '11px monospace'; x.textAlign = 'center';
      x.fillText(f.st + (f.mv ? ':' + f.mv + ' ' + f.mT : '') + ' dc' + f.dc + ' sc' + f.sc + ' ac' + f.ac, f.x, f.y + 16);
    });
    v.p.forEach(function (p) {
      x.strokeStyle = 'rgba(255,200,40,0.9)';
      if (p.g) x.strokeRect(p.x - p.w / 2, p.y - p.h, p.w, p.h); else x.strokeRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    });
    v.s.forEach(function (s) { x.strokeStyle = '#7fe0ff'; x.strokeRect(s.x, s.y, s.w, s.h); });
    // Launch trajectories: integrate the launched dragon's path (local sim only, it has the launch vector)
    if (this.sim) this.sim.fighters.forEach(function (F) {
      if (F.state !== 'hitstun') return;
      var px = F.x, py = F.y, vx = F.vx, vy = F.vy, kx = F.kbx, ky = F.kby, P = D.PHYSICS;
      x.strokeStyle = 'rgba(255,90,200,0.85)'; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(px, py);
      for (var t = 0; t < 90; t++) {
        var l = Math.sqrt(kx * kx + ky * ky); if (l > 0) { var nl = Math.max(0, l - P.kbDecay); kx *= nl / l; ky *= nl / l; }
        vy = Math.min(P.maxFall, vy + P.gravity); vx *= P.airFriction;
        px += vx + kx; py += vy + ky; x.lineTo(px, py);
      }
      x.stroke(); x.setLineDash([]);
    });
    // Blast zone
    var bz = this.arena.blast;
    x.strokeStyle = 'rgba(255,60,60,0.5)'; x.setLineDash([16, 10]); x.strokeRect(bz.left, bz.top, bz.right - bz.left, bz.bottom - bz.top); x.setLineDash([]);
    x.restore();
    return self;
  };

  M.drawDebugHud = function (x) {
    var h = this.lastHit, lines = ['DEBUG (` to toggle)  tick ' + (this.view ? this.view.t : 0)];
    if (h) lines.push('last hit: ' + h.dmg + '%  kb ' + h.kb + '  angle ' + Math.round(h.angle) + '°  ' + h.element + (h.mult !== 1 ? '  element ×' + h.mult.toFixed(2) : '') + '  hitlag ' + h.lag);
    var fs = this.setupInfo.fighters;
    fs.forEach(function (f) {
      var s = Build.deriveStats(f.build);
      lines.push(f.name + ': weight ' + s.weight + ' run ' + s.run.toFixed(1) + ' jumps ' + (1 + s.airJumps) + ' dodgeCd ' + s.dodgeCd + ' sigCd ' + s.sigCd + ' abCd ' + s.abilityCd);
    });
    x.save(); x.font = '12px monospace'; x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(8, 8, 620, 16 * lines.length + 10);
    x.fillStyle = '#9fffb0'; lines.forEach(function (l, i) { x.fillText(l, 16, 26 + i * 16); }); x.restore();
  };

  window.DCMatch = Match;
})();
