/* Putt Club — match rules (authoritative).
 *
 * PuttMatch owns everything that decides a result: players, the physics world, strokes, hazards, power-ups,
 * scoring, phases and awards. The server runs one per room and drives it with tick(dt); the browser runs one
 * for offline practice. Clients only send intents (shoot with a direction and power, use an item, vote) and
 * never report positions or scores.
 *
 * No timers or sockets in here: time only advances through tick(), so tests can play whole matches instantly.
 * hooks.state()            something in view() changed (coalesce and push it)
 * hooks.fx(event, toIds?)  a one-off event for sound/animation (toIds = only these players)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./physics.js'), require('./courses.js'), require('./powerups.js'), require('./ai.js'));
  else root.PuttMatch = factory(root.PuttPhysics, root.PuttCourses, root.PuttPowerups, root.PuttAI);
})(typeof self !== 'undefined' ? self : this, function (P, Courses, Powerups, AI) {
  'use strict';

  var MAX_PLAYERS = 8;
  var COLORS = ['#f2683c', '#2fb3a6', '#f4c542', '#5b7cfa', '#e45b8f', '#7cc456', '#a77bf3', '#f0f0e6'];
  var COLOR_NAMES = ['Coral', 'Teal', 'Gold', 'Blue', 'Rose', 'Lime', 'Violet', 'Pearl'];
  var SYMBOLS = ['circle', 'triangle', 'square', 'diamond', 'star', 'hexagon', 'cross', 'heart'];
  var TIMING = { intro: 3.6, holeResults: 6.5, courseResults: 10, voteTime: 25 };
  var SHOT_GAP = 0.35;          // seconds between accepted shots (rate limit)
  var USE_GAP = 1.2;            // seconds between power-up uses
  var TOKEN_R = 0.62;
  var BOT_NAMES = ['Birdie Bot', 'Putt-o-Tron', 'Caddie 3000', 'Bogey Bot', 'Chip', 'Sir Slice', 'Wedgie', 'Mulligan'];

  var DEFAULT_SETTINGS = {
    mode: 'casual',              // casual | tournament
    courses: 3,                  // tournament length: 3, 6 or 9 courses
    course: 'sunset-cove',       // casual: which course
    powerups: true,
    powerupFreq: 'normal',       // low | normal | high
    keepPowerups: false,         // tournament: carry items between courses
    strength: 'normal',          // soft | normal | strong
    maxStrokes: 8,
    shotTimer: 0,                // 0 = off, else seconds per shot
    holeTime: 150,               // seconds before unfinished players are scored and the hole ends
    collisions: true,            // ball-to-ball collisions
    resetPenalty: 1
  };
  var STRENGTH = { soft: 0.82, normal: 1, strong: 1.18 };
  var FREQ = { low: { share: 0.5, respawn: 22 }, normal: { share: 1, respawn: 12 }, high: { share: 1, respawn: 6 } };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function round2(v) { return Math.round(v * 100) / 100; }
  function cleanName(s, fallback) {
    s = String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16).trim();
    return s || fallback;
  }

  function PuttMatch(opts) {
    opts = opts || {};
    this.code = opts.code || 'LOCAL';
    this.rng = opts.rng || Math.random;
    this.hooks = opts.hooks || {};
    this.players = [];
    this.phase = 'lobby';
    this.clock = 0;               // seconds since the match object was created
    this.t = 0;                   // hole clock (drives moving obstacles)
    this.phaseEnds = 0;           // clock value when the current phase ends (0 = no timer)
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.round = null;
    this.votes = {};
    this.seq = 0;
    this.lastResults = null;
    this.botTimer = 0;
  }

  var M = PuttMatch.prototype;

  M.emitState = function () { if (this.hooks.state) this.hooks.state(); };
  M.fx = function (ev, to) { if (this.hooks.fx) this.hooks.fx(ev, to); };
  M.get = function (id) { for (var i = 0; i < this.players.length; i++) if (this.players[i].id === id) return this.players[i]; return null; };
  M.host = function () { for (var i = 0; i < this.players.length; i++) if (this.players[i].isHost) return this.players[i]; return null; };
  M.humans = function () { return this.players.filter(function (p) { return !p.bot; }); };

  // ------------------------------------------------------------------ lobby

  M.addPlayer = function (info) {
    if (this.players.length >= MAX_PLAYERS) return { error: 'This room is full (8 players).' };
    var used = this.players.map(function (p) { return p.color; });
    var want = info && Number.isInteger(info.color) && info.color >= 0 && info.color < COLORS.length && used.indexOf(info.color) < 0 ? info.color : -1;
    var color = want >= 0 ? want : COLORS.findIndex(function (_c, i) { return used.indexOf(i) < 0; });
    var p = {
      id: info.id, name: cleanName(info.name, info.bot ? BOT_NAMES[0] : 'Player ' + (this.players.length + 1)),
      color: color, bot: !!info.bot, skill: info.skill || 0.7,
      isHost: false, ready: !!info.bot, connected: true, joinedAt: this.clock,
      ball: null, finished: false, status: 'tee', strokes: 0, shotOnce: false,
      holes: [], courseTotals: [], inventory: [], effects: [],
      stats: blankStats(), lastShotAt: -9, lastUseAt: -9, frostImmuneUntil: -1, gustCdUntil: -1, gustSafe: null,
      restSince: 0, shotFrom: null, botNext: 0
    };
    // Late joiners mid-match join the current hole from the tee with nothing scored for earlier holes.
    this.players.push(p);
    if (!this.host()) p.isHost = true;
    if (this.phase !== 'lobby' && this.round) this.enterRound(p);
    this.emitState();
    return { ok: true, player: p };
  };

  M.addBot = function (byId) {
    var by = this.get(byId);
    if (!by || !by.isHost) return { error: 'Only the host can add bots.' };
    if (this.phase !== 'lobby') return { error: 'Add bots in the lobby.' };
    var n = this.players.filter(function (p) { return p.bot; }).length;
    var names = this.players.map(function (p) { return p.name; });
    var name = BOT_NAMES.find(function (b) { return names.indexOf(b) < 0; }) || 'Bot';
    return this.addPlayer({ id: 'bot' + (n + 1) + '_' + Math.floor(this.rng() * 1e6), name: name, bot: true, skill: 0.55 + this.rng() * 0.35 });
  };

  M.removePlayer = function (id) {
    var i = this.players.findIndex(function (p) { return p.id === id; });
    if (i < 0) return;
    var wasHost = this.players[i].isHost;
    this.players.splice(i, 1);
    if (wasHost) this.passHost();
    this.emitState();
  };

  M.passHost = function () {
    this.players.forEach(function (p) { p.isHost = false; });
    var next = this.players.find(function (p) { return !p.bot && p.connected; }) || this.players.find(function (p) { return !p.bot; });
    if (next) next.isHost = true;
  };

  M.setConnected = function (id, on) {
    var p = this.get(id);
    if (!p || p.connected === on) return;
    p.connected = on;
    if (!on && p.isHost) this.passHost();
    if (on && !this.players.some(function (q) { return q.isHost && !q.bot && q.connected; })) this.passHost();
    this.fx({ type: on ? 'reconnected' : 'disconnected', id: id, name: p.name });
    this.emitState();
  };

  // ------------------------------------------------------------------ commands

  M.command = function (id, cmd) {
    var p = this.get(id);
    if (!p) return { error: 'You are not in this room.' };
    if (!cmd || typeof cmd.type !== 'string') return { error: 'Bad command.' };
    switch (cmd.type) {
      case 'profile': return this.cmdProfile(p, cmd);
      case 'ready': if (this.phase !== 'lobby') return { error: 'The game has started.' }; p.ready = !!cmd.ready; this.emitState(); return { ok: true };
      case 'settings': return this.cmdSettings(p, cmd.settings);
      case 'addBot': return this.addBot(id);
      case 'kick': return this.cmdKick(p, cmd.id);
      case 'start': return this.cmdStart(p);
      case 'shoot': return this.cmdShoot(p, cmd);
      case 'reset': return this.cmdReset(p);
      case 'use': return this.cmdUse(p, cmd);
      case 'vote': return this.cmdVote(p, cmd.course);
      case 'next': return this.cmdNext(p);
      case 'lobby': return this.cmdLobby(p);
      case 'skip': return this.cmdSkip(p);
      default: return { error: 'Unknown command.' };
    }
  };

  M.cmdProfile = function (p, cmd) {
    if (cmd.name != null) p.name = cleanName(cmd.name, p.name);
    if (cmd.color != null && this.phase === 'lobby') {
      var c = Number(cmd.color);
      if (Number.isInteger(c) && c >= 0 && c < COLORS.length && !this.players.some(function (q) { return q !== p && q.color === c; })) p.color = c;
    }
    this.emitState();
    return { ok: true };
  };

  M.cmdSettings = function (p, s) {
    if (!p.isHost) return { error: 'Only the host can change settings.' };
    if (this.phase !== 'lobby' && this.phase !== 'final') return { error: 'Settings are locked during a match.' };
    if (!s || typeof s !== 'object') return { error: 'Bad settings.' };
    var st = this.settings;
    if (s.mode === 'casual' || s.mode === 'tournament') st.mode = s.mode;
    if ([3, 6, 9].indexOf(Number(s.courses)) >= 0) st.courses = Number(s.courses);
    if (typeof s.course === 'string' && Courses.byId(s.course)) st.course = s.course;
    if (typeof s.powerups === 'boolean') st.powerups = s.powerups;
    if (FREQ[s.powerupFreq]) st.powerupFreq = s.powerupFreq;
    if (typeof s.keepPowerups === 'boolean') st.keepPowerups = s.keepPowerups;
    if (STRENGTH[s.strength]) st.strength = s.strength;
    if (s.maxStrokes != null) st.maxStrokes = clamp(Math.round(Number(s.maxStrokes)) || 8, 5, 12);
    if ([0, 20, 30, 45].indexOf(Number(s.shotTimer)) >= 0) st.shotTimer = Number(s.shotTimer);
    if ([90, 150, 240].indexOf(Number(s.holeTime)) >= 0) st.holeTime = Number(s.holeTime);
    if (typeof s.collisions === 'boolean') st.collisions = s.collisions;
    if ([0, 1, 2].indexOf(Number(s.resetPenalty)) >= 0) st.resetPenalty = Number(s.resetPenalty);
    this.emitState();
    return { ok: true };
  };

  M.cmdKick = function (p, id) {
    if (!p.isHost) return { error: 'Only the host can remove players.' };
    var t = this.get(id);
    if (!t || t === p) return { error: 'No such player.' };
    if (this.phase !== 'lobby' && !t.bot) return { error: 'Players can only be removed in the lobby.' };
    this.removePlayer(id);
    return { ok: true, kicked: id };
  };

  M.cmdStart = function (p) {
    if (!p.isHost) return { error: 'Only the host can start.' };
    if (this.phase !== 'lobby') return { error: 'Already playing.' };
    var waiting = this.players.filter(function (q) { return !q.isHost && !q.bot && q.connected && !q.ready; });
    if (waiting.length) return { error: 'Waiting for ' + waiting.map(function (q) { return q.name; }).join(', ') + ' to ready up.' };
    this.startMatch();
    return { ok: true };
  };

  M.cmdShoot = function (p, cmd) {
    if (this.phase !== 'play') return { error: 'Not now.' };
    if (p.finished) return { error: 'You have finished this hole.' };
    if (!p.connected && !p.bot) return { error: 'Disconnected.' };
    var b = p.ball;
    if (b.frozen) return { error: 'Your ball is frozen!' };
    if (b.moving) return { error: 'Wait for your ball to stop.' };
    if (this.t - p.lastShotAt < SHOT_GAP) return { error: 'Too fast.' };
    var dx = Number(cmd.dx), dz = Number(cmd.dz), power = Number(cmd.power);
    if (!isFinite(dx) || !isFinite(dz) || !isFinite(power)) return { error: 'Bad shot.' };
    var l = Math.hypot(dx, dz);
    if (l < 1e-3 || l > 1e3) return { error: 'Bad shot.' };
    power = clamp(power, 0, 1);
    if (power < 0.02) return { error: 'Too soft.' };
    dx /= l; dz /= l;
    if (this.hasEffect(p, 'reverse')) { dx = -dx; dz = -dz; }
    var speed = P.shotSpeed(power, STRENGTH[this.settings.strength]);
    var turbo = this.findEffect(p, 'turbo');
    if (turbo) speed = Math.min(speed * Powerups.BY_ID.turbo.shotPower, P.C.MAX_SPEED * 0.9);
    // Shot-based effects go live for this shot.
    p.effects.forEach(function (e) { if (e.shots) { e.live = true; e.shots--; } });
    P.shoot(b, dx, dz, speed);
    p.strokes++; p.shotOnce = true; p.status = 'moving'; p.lastShotAt = this.t;
    p.shotFrom = [b.x, b.z]; b.bounces = 0;
    p.stats.shots++;
    this.applyMods(p);
    this.fx({ type: 'shot', id: p.id, power: round2(power), turbo: !!turbo, x: b.x, y: b.y, z: b.z, dx: round2(dx), dz: round2(dz), t: round2(this.t) });
    this.emitState();
    return { ok: true, t: this.t, dx: dx, dz: dz, speed: speed };
  };

  M.cmdReset = function (p) {
    if (this.phase !== 'play' || p.finished) return { error: 'Not now.' };
    var b = p.ball;
    if (b.frozen) return { error: 'Your ball is frozen!' };
    if (b.moving && b.shotT < 4) return { error: 'Wait for your ball to stop (or give it a few seconds if it is stuck).' };
    var spot = this.teeSpot(this.players.indexOf(p));
    b.x = spot[0]; b.z = spot[1]; b.y = this.world.teeH; b.vx = b.vy = b.vz = 0; b.moving = false; b.grounded = true;
    b.safe = { x: b.x, y: b.y, z: b.z };
    p.strokes += this.settings.resetPenalty; p.status = 'rest'; p.restSince = this.t;
    this.fx({ type: 'reset', id: p.id, x: b.x, y: b.y, z: b.z, penalty: this.settings.resetPenalty });
    this.checkMaxed(p);
    this.emitState();
    return { ok: true };
  };

  M.cmdUse = function (p, cmd) {
    if (!this.settings.powerups) return { error: 'Power-ups are off.' };
    if (this.phase !== 'play') return { error: 'Power-ups can only be used during a hole.' };
    if (p.finished) return { error: 'You have finished this hole. Save it for the next one!' };
    var slot = Number(cmd.slot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= p.inventory.length) return { error: 'Nothing in that slot.' };
    if (this.t - p.lastUseAt < USE_GAP) return { error: 'One at a time!' };
    var def = Powerups.BY_ID[p.inventory[slot]];
    if (!def) return { error: 'Unknown power-up.' };
    var target = p;
    if (def.target === 'opponent') {
      target = this.get(cmd.target);
      if (!target || target === p) return { error: 'Pick an opponent.' };
      if (target.finished) return { error: target.name + ' has already finished this hole.' };
      if (!target.connected && !target.bot) return { error: target.name + ' is disconnected.' };
    }
    var ctx = this.ctx();
    if (def.reject) { var why = def.reject(ctx, p, target); if (why) return { error: why }; }
    if (def.id === 'turbo' || def.id === 'ghost') {
      if (this.hasEffect(p, def.id)) return { error: 'You already have ' + def.name + ' ready.' };
    }
    p.inventory.splice(slot, 1);
    p.lastUseAt = this.t;
    p.stats.used++;
    if (def.hostile) {
      p.stats.hostileUsed++;
      var shield = this.findEffect(target, 'shield');
      if (shield) {
        this.removeEffect(target, shield);
        target.stats.blocks++;
        this.fx({ type: 'blocked', id: target.id, by: p.id, power: def.id, name: def.name });
        this.emitState();
        return { ok: true, blocked: true };
      }
    }
    var res = { ok: true };
    if (def.use) res = def.use(ctx, p, target) || { ok: true };
    if (def.effect) {
      (def.conflicts || []).forEach(function (c) { var e = this.findEffect(target, c); if (e) this.removeEffect(target, e); }, this);
      var existing = this.findEffect(target, def.id);
      if (existing) this.removeEffect(target, existing);
      var eff = { kind: def.id, from: p.id, started: this.t, until: def.effect.duration ? this.t + def.effect.duration : null, shots: def.effect.shots || 0, live: false };
      if (def.effect.until === 'hole') eff.until = null;
      target.effects.push(eff);
    }
    if (def.hostile) { p.stats.hostileLanded++; target.stats.hostileTaken++; }
    this.applyMods(target);
    this.fx({ type: 'power', power: def.id, name: def.name, id: p.id, target: target.id, dir: res.dir, from: res.from, to: res.to });
    this.emitState();
    return { ok: true };
  };

  M.cmdVote = function (p, course) {
    if (this.phase !== 'final' || this.settings.mode !== 'casual') return { error: 'Voting is closed.' };
    if (!Courses.byId(course)) return { error: 'Unknown course.' };
    this.votes[p.id] = course;
    this.emitState();
    return { ok: true };
  };

  M.cmdNext = function (p) {
    if (!p.isHost) return { error: 'Only the host can do that.' };
    if (this.phase === 'final') { this.playAgain(); return { ok: true }; }
    if (this.phase === 'holeResults' || this.phase === 'courseResults') { this.phaseEnds = this.clock; return { ok: true }; }
    return { error: 'Not now.' };
  };

  M.cmdSkip = function (p) {
    if (this.phase === 'intro' && p.isHost) { this.phaseEnds = this.clock; return { ok: true }; }
    return { error: 'Not now.' };
  };

  M.cmdLobby = function (p) {
    if (!p.isHost) return { error: 'Only the host can do that.' };
    this.toLobby();
    return { ok: true };
  };

  // ------------------------------------------------------------------ effects

  M.findEffect = function (p, kind) { for (var i = 0; i < p.effects.length; i++) if (p.effects[i].kind === kind) return p.effects[i]; return null; };
  M.hasEffect = function (p, kind) { return !!this.findEffect(p, kind); };
  M.removeEffect = function (p, e) {
    var i = p.effects.indexOf(e);
    if (i < 0) return;
    p.effects.splice(i, 1);
    if (e.kind === 'freeze') p.frostImmuneUntil = this.t + Powerups.BY_ID.freeze.immunity;
    this.applyMods(p);
    this.fx({ type: 'effectEnd', id: p.id, power: e.kind });
  };
  M.ctx = function () {
    var self = this;
    return {
      t: this.t, world: this.world,
      has: function (p, k) { return self.hasEffect(p, k); },
      setMoving: function (p) { p.status = 'moving'; }
    };
  };

  /** Rebuild a ball's physics modifiers from its active effects. */
  M.applyMods = function (p) {
    var b = p.ball;
    if (!b) return;
    b.fric = 1; b.ghost = false; b.magnet = false; b.rTarget = P.C.R;
    var wasFrozen = b.frozen; b.frozen = false;
    p.effects.forEach(function (e) {
      var def = Powerups.BY_ID[e.kind];
      if (!def || !def.mods) return;
      if (e.shots != null && def.effect && def.effect.shots && !e.live) return;
      def.mods(b, e);
    });
    if (wasFrozen && !b.frozen && b.moving) { b.anchorT = 0; b.anchorX = b.x; b.anchorZ = b.z; }
  };

  M.tickEffects = function (p) {
    for (var i = p.effects.length - 1; i >= 0; i--) {
      var e = p.effects[i];
      if (e.until != null && this.t >= e.until && !(e.live && p.ball.moving)) this.removeEffect(p, e);
    }
  };

  // ------------------------------------------------------------------ match flow

  M.startMatch = function () {
    var st = this.settings, order = [];
    if (st.mode === 'tournament') {
      for (var i = 0; i < st.courses; i++) order.push({ id: Courses.COURSES[i % 3].id, mirror: Math.floor(i / 3) % 2 === 1 });
    } else order.push({ id: st.course, mirror: false });
    this.round = { order: order, courseIdx: 0, holeIdx: 0 };
    this.players.forEach(function (p) { p.courseTotals = []; p.stats = blankStats(); p.inventory = []; p.ready = p.bot; }, this);
    this.lastResults = null;
    this.startCourse();
  };

  M.startCourse = function () {
    var r = this.round;
    r.course = Courses.byId(r.order[r.courseIdx].id);
    r.mirror = r.order[r.courseIdx].mirror;
    r.holeIdx = 0;
    var keep = this.settings.mode === 'tournament' && this.settings.keepPowerups;
    this.players.forEach(function (p) { p.holes = []; if (!keep) p.inventory = []; });
    this.startHole();
  };

  M.startHole = function () {
    var r = this.round;
    r.hole = r.course.holes[r.holeIdx];
    this.world = P.compileHole(r.hole, { mirror: r.mirror });
    this.t = 0;
    var freq = FREQ[this.settings.powerupFreq];
    var spots = this.settings.powerups ? this.world.tokens.filter(function (_t, i) { return freq.share >= 1 || i % 2 === 0; }) : [];
    this.tokens = spots.map(function (s, i) { return { id: i, x: s[0], z: s[1], y: 0, active: true, respawnAt: 0 }; });
    var self = this;
    this.tokens.forEach(function (tk) { var f = P.floorAt(self.world, tk.x, tk.z, 50, 0); tk.y = f ? f.h : 0; });
    this.players.forEach(function (p) { this.enterRound(p); }, this);
    this.hurry = false;
    this.setPhase('intro', TIMING.intro);
    this.fx({ type: 'hole', course: r.course.id, hole: r.holeIdx });
  };

  /** Put a player on the tee of the current hole. */
  M.enterRound = function (p) {
    var idx = this.players.indexOf(p);
    var spot = this.teeSpot(idx);
    p.ball = P.newBall(p.id, spot[0], spot[1], this.world);
    p.finished = false; p.status = 'tee'; p.strokes = 0; p.shotOnce = false; p.effects = [];
    p.gustSafe = null; p.frostImmuneUntil = -1; p.gustCdUntil = -1; p.lastShotAt = -9; p.lastUseAt = -9; p.restSince = 0;
    p.botNext = 0;
    // Someone joining mid-course gets a blank (DNF) card for holes they missed.
    while (p.holes.length < this.round.holeIdx) p.holes.push(null);
  };

  /** Tee positions: two rows of four, across the tee direction, so balls never start overlapping. */
  M.teeSpot = function (i) {
    var w = this.world, d = w.teeDir, lat = [-d[1], d[0]];
    var row = Math.floor(i / 4), col = i % 4;
    var off = (col - 1.5) * 0.62, back = row * 0.66;
    var x = w.tee[0] + lat[0] * off - d[0] * back, z = w.tee[1] + lat[1] * off - d[1] * back;
    var f = P.floorAt(w, x, z, w.teeH + 0.1, 0);
    if (!f || Math.abs(f.h - w.teeH) > 0.05) return [w.tee[0] - d[0] * back * 0.5, w.tee[1] - d[1] * back * 0.5];
    return [x, z];
  };

  M.setPhase = function (phase, seconds) {
    this.phase = phase;
    this.phaseEnds = seconds ? this.clock + seconds : 0;
    this.emitState();
  };

  M.endHole = function () {
    var r = this.round, max = this.settings.maxStrokes, par = r.hole.par, self = this;
    this.players.forEach(function (p) {
      if (p.holes[r.holeIdx] !== undefined) return;
      var status = p.finished ? (p.status === 'holed' ? 'holed' : 'maxed') : (p.shotOnce ? 'timeout' : 'dnf');
      var score;
      if (p.status === 'holed') score = p.strokes;
      else if (status === 'maxed' || status === 'dnf') score = max + 1;
      else score = Math.min(max + 1, p.strokes + 2);
      p.holes[r.holeIdx] = { score: score, par: par, status: status };
      if (status === 'holed') {
        var rel = score - par;
        if (score === 1) p.stats.aces++;
        if (rel <= -2) p.stats.eagles++; else if (rel === -1) p.stats.birdies++;
        if (p.stats.bestRel == null || rel < p.stats.bestRel) { p.stats.bestRel = rel; p.stats.bestHole = r.holeIdx; p.stats.bestCourse = r.courseIdx; }
      }
      p.effects = []; self.applyMods(p);
    });
    this.lastResults = this.standings();
    this.setPhase('holeResults', TIMING.holeResults);
  };

  M.afterHoleResults = function () {
    var r = this.round;
    if (r.holeIdx + 1 < r.course.holes.length) { r.holeIdx++; this.startHole(); return; }
    // Course finished.
    this.players.forEach(function (p) { p.courseTotals[r.courseIdx] = sumHoles(p.holes); });
    if (r.courseIdx + 1 < r.order.length) { this.setPhase('courseResults', TIMING.courseResults); return; }
    this.finish();
  };

  M.finish = function () {
    this.awards = computeAwards(this);
    this.votes = {};
    this.setPhase('final', 0);
    this.fx({ type: 'final', winner: this.standings()[0] && this.standings()[0].id });
  };

  M.playAgain = function () {
    var st = this.settings;
    if (st.mode === 'casual') {
      var tally = {}, best = [], top = 0;
      Object.keys(this.votes).forEach(function (id) { var c = this.votes[id]; tally[c] = (tally[c] || 0) + 1; }, this);
      Object.keys(tally).forEach(function (c) { if (tally[c] > top) { top = tally[c]; best = [c]; } else if (tally[c] === top) best.push(c); });
      if (best.length) st.course = best[Math.floor(this.rng() * best.length)];
    }
    this.startMatch();
  };

  M.toLobby = function () {
    this.phase = 'lobby'; this.phaseEnds = 0; this.round = null; this.world = null; this.tokens = [];
    this.players.forEach(function (p) { p.ready = p.bot; p.ball = null; p.holes = []; p.courseTotals = []; p.inventory = []; p.effects = []; });
    this.emitState();
  };

  // ------------------------------------------------------------------ simulation

  M.tick = function (dt) {
    dt = Math.min(dt, 0.1);
    this.clock += dt;
    var ph = this.phase;
    if (ph === 'intro' || ph === 'play') {
      this.t += dt;
      this.simulate(dt);
      if (ph === 'play') this.playRules();
    }
    if (this.phaseEnds && this.clock >= this.phaseEnds) {
      if (ph === 'intro') { this.players.forEach(function (p) { p.restSince = this.t; }, this); this.setPhase('play', this.settings.holeTime); this.fx({ type: 'go' }); }
      else if (ph === 'play') this.endHole();
      else if (ph === 'holeResults') this.afterHoleResults();
      else if (ph === 'courseResults') { this.round.courseIdx++; this.startCourse(); }
      else if (ph === 'final') this.phaseEnds = 0;
    }
  };

  M.simulate = function (dt) {
    var self = this, w = this.world;
    var balls = [];
    this.players.forEach(function (p) { if (p.ball && !p.ball.holed) balls.push(p.ball); });
    // Balls still on the tee (never shot) don't collide, so the opening shots can't scatter the field.
    var collide = this.settings.collisions;
    var byId = {};
    this.players.forEach(function (p) { byId[p.id] = p; });
    balls.forEach(function (b) { b.solo = !byId[b.id].shotOnce; });
    var events = [];
    var results = P.stepWorld(w, balls, this.t - dt, dt, {
      collide: collide,
      onEvent: function (e) { if (events.length < 24) events.push(e); }
    });
    events.forEach(function (e) {
      if (e.type === 'wall' || e.type === 'bumper' || e.type === 'ball' || e.type === 'land' || e.type === 'pad' || e.type === 'lip') {
        if (e.type === 'ball') { var a = byId[e.id], o = byId[e.other]; if (a) a.stats.bumps++; if (o) o.stats.bumps++; }
        if (e.s == null || e.s > 1 || e.type === 'pad' || e.type === 'lip') self.fx({ type: e.type, id: e.id, mat: e.mat, s: e.s, x: round2(e.x), y: round2(e.y || 0), z: round2(e.z) });
      }
    });
    results.forEach(function (r) { self.ballResult(byId[r.id], r.result); });
    this.players.forEach(function (p) {
      if (p.ball && p.ball.moving && p.status !== 'moving' && !p.finished) p.status = 'moving';
    });
  };

  M.ballResult = function (p, result) {
    if (!p || p.finished) return;
    var b = p.ball, self = this;
    if (result === 'cup') {
      p.finished = true; p.status = 'holed';
      if (b.bounces > 0) p.stats.bankHoles++;
      if (p.shotFrom) p.stats.longest = Math.max(p.stats.longest, Math.hypot(this.world.cup[0] - p.shotFrom[0], this.world.cup[1] - p.shotFrom[1]));
      this.finishShotEffects(p);
      var rel = p.strokes - this.round.hole.par;
      this.fx({ type: 'holed', id: p.id, strokes: p.strokes, rel: rel, x: this.world.cup[0], y: this.world.cupH, z: this.world.cup[1] });
      this.emitState();
      return;
    }
    if (result === 'water' || result === 'oob') {
      var gust = p.gustSafe && p.gustSafe.until > this.t ? p.gustSafe : null;
      var spot = gust || b.safe, fell = [round2(b.x), round2(Math.max(b.y, this.world.water ? this.world.water.level : b.y)), round2(b.z)];
      b.x = spot.x; b.y = spot.y; b.z = spot.z; b.vx = b.vy = b.vz = 0; b.moving = false; b.grounded = true;
      if (!gust) { p.strokes++; p.stats.splashes++; }
      p.gustSafe = null;
      p.status = 'rest'; p.restSince = this.t;
      this.finishShotEffects(p);
      this.fx({ type: 'splash', id: p.id, kind: result, penalty: gust ? 0 : 1, x: round2(b.x), y: round2(b.y), z: round2(b.z), fx: fell[0], fy: fell[1], fz: fell[2] });
      this.checkMaxed(p);
      this.emitState();
      return;
    }
    if (result === 'stop') {
      p.status = 'rest'; p.restSince = this.t;
      var f = P.floorAt(this.world, b.x, b.z, b.y, this.t);
      if (f && f.plat < 0) b.safe = { x: b.x, y: b.y, z: b.z };
      this.finishShotEffects(p);
      self.checkMaxed(p);
      this.emitState();
    }
  };

  M.finishShotEffects = function (p) {
    for (var i = p.effects.length - 1; i >= 0; i--) {
      var e = p.effects[i];
      if (e.live && e.shots != null && Powerups.BY_ID[e.kind].effect.shots) {
        e.live = false;
        if (e.shots <= 0) this.removeEffect(p, e);
      }
    }
    this.applyMods(p);
  };

  M.checkMaxed = function (p) {
    if (p.finished) return;
    if (p.strokes >= this.settings.maxStrokes && !p.ball.moving) {
      p.finished = true; p.status = 'maxed';
      p.ball.holed = true; // removed from play
      this.fx({ type: 'maxed', id: p.id, strokes: p.strokes });
    }
  };

  M.playRules = function () {
    var self = this;
    // Effects expire.
    this.players.forEach(function (p) { if (p.ball) self.tickEffects(p); });
    // Power-up crates.
    if (this.tokens && this.tokens.length) {
      var freq = FREQ[this.settings.powerupFreq];
      this.tokens.forEach(function (tk) {
        if (!tk.active) { if (self.t >= tk.respawnAt) { tk.active = true; self.fx({ type: 'tokenBack', token: tk.id }); self.emitState(); } return; }
        for (var i = 0; i < self.players.length; i++) {
          var p = self.players[i], b = p.ball;
          if (!b || p.finished || !b.moving || p.inventory.length >= 2) continue;
          if (Math.abs(b.y - tk.y) > 0.8) continue;
          var dx = b.x - tk.x, dz = b.z - tk.z;
          if (dx * dx + dz * dz > (TOKEN_R + b.r) * (TOKEN_R + b.r)) continue;
          var item = Powerups.roll(self.rng, { behind: self.isBehind(p) });
          p.inventory.push(item); p.stats.tokens++;
          tk.active = false; tk.respawnAt = self.t + freq.respawn;
          self.fx({ type: 'token', token: tk.id, id: p.id, power: item, x: tk.x, y: tk.y, z: tk.z });
          self.emitState();
          break;
        }
      });
    }
    // Shot timer.
    var st = this.settings;
    if (st.shotTimer) this.players.forEach(function (p) {
      if (p.finished || p.ball.moving || p.ball.frozen || p.bot || !p.connected) return;
      if (self.t - p.restSince > st.shotTimer) {
        p.strokes++; p.restSince = self.t;
        self.fx({ type: 'timerPenalty', id: p.id });
        self.checkMaxed(p);
        self.emitState();
      }
    });
    // Bots.
    if (AI) {
      this.botCount = this.players.filter(function (p) { return p.bot && !p.finished; }).length;
      this.players.forEach(function (p) { if (p.bot) AI.think(self, p); });
    }
    // Everyone done (disconnected players don't hold the hole up)?
    var active = this.players.filter(function (p) { return !p.finished && (p.connected || p.bot); });
    if (!active.length) { this.endHole(); return; }
    // Last ball standing: give them 25 seconds.
    var humansDone = this.players.filter(function (p) { return p.finished && !p.bot; }).length;
    if (!this.hurry && active.length === 1 && !active[0].bot && humansDone >= 1) {
      var cap = this.clock + 30;
      if (cap < this.phaseEnds) { this.phaseEnds = cap; this.hurry = true; this.fx({ type: 'hurry', id: active[0].id }); this.emitState(); }
    }
  };

  M.isBehind = function (p) {
    var s = this.standings(), i = s.findIndex(function (r) { return r.id === p.id; });
    return s.length > 1 && i >= Math.ceil(s.length / 2);
  };

  // ------------------------------------------------------------------ scoring

  /** Standings across everything played so far (tournament total, or this course in casual). */
  M.standings = function () {
    var self = this, r = this.round;
    var rows = this.players.map(function (p) {
      var courseScore = sumHoles(p.holes), coursePar = sumPar(p.holes);
      var total = 0, parTotal = 0;
      if (r) {
        for (var c = 0; c < r.courseIdx; c++) total += p.courseTotals[c] || 0;
        total += courseScore;
        parTotal = coursePar + parBefore(self, r.courseIdx, p);
      }
      var played = p.holes.filter(function (h) { return h; }).length;
      return { id: p.id, name: p.name, color: p.color, total: total, rel: total - parTotal, course: courseScore, courseRel: courseScore - coursePar, holes: p.holes.slice(), played: played };
    });
    rows.sort(function (a, b) { return a.total - b.total || b.played - a.played || a.name.localeCompare(b.name); });
    var rank = 0;
    rows.forEach(function (row, i) { if (i === 0 || row.total !== rows[i - 1].total || row.played !== rows[i - 1].played) rank = i + 1; row.rank = rank; });
    return rows;
  };

  function sumHoles(holes) { var s = 0; holes.forEach(function (h) { if (h) s += h.score; }); return s; }
  function sumPar(holes) { var s = 0; holes.forEach(function (h) { if (h) s += h.par; }); return s; }
  function parBefore(m, courseIdx, p) {
    var s = 0;
    for (var c = 0; c < courseIdx; c++) { var course = Courses.byId(m.round.order[c].id); if (p.courseTotals[c] != null) course.holes.forEach(function (h) { s += h.par; }); }
    return s;
  }

  function blankStats() {
    return { shots: 0, aces: 0, birdies: 0, eagles: 0, bestRel: null, bestHole: null, bestCourse: null, used: 0, hostileUsed: 0, hostileLanded: 0, hostileTaken: 0, blocks: 0, splashes: 0, bankHoles: 0, longest: 0, tokens: 0, bumps: 0 };
  }

  /** End-of-match awards, all from real stats. Each award needs a clear winner (no ties) and a minimum. */
  function computeAwards(m) {
    var ps = m.players, out = [];
    function best(key, min, label, desc, fmt) {
      var top = null, val = -Infinity, tie = false;
      ps.forEach(function (p) { var v = p.stats[key] || 0; if (v > val) { val = v; top = p; tie = false; } else if (v === val) tie = true; });
      if (top && !tie && val >= min) out.push({ id: key, title: label, desc: desc.replace('#', fmt ? fmt(val) : val), player: top.id });
    }
    var st = m.standings();
    if (st.length) out.push({ id: 'winner', title: m.settings.mode === 'tournament' ? 'Tournament Champion' : 'Course Champion', desc: st[0].total + ' strokes (' + relText(st[0].rel) + ')', player: st[0].id });
    ps.forEach(function (p) { if (p.stats.aces) out.push({ id: 'ace-' + p.id, title: 'Hole in One', desc: p.stats.aces + (p.stats.aces > 1 ? ' aces' : ' ace'), player: p.id }); });
    var bestHole = null;
    ps.forEach(function (p) { if (p.stats.bestRel != null && (!bestHole || p.stats.bestRel < bestHole.rel)) bestHole = { rel: p.stats.bestRel, p: p }; });
    if (bestHole && bestHole.rel < 0) {
      var tied = ps.filter(function (p) { return p.stats.bestRel === bestHole.rel; }).length > 1;
      if (!tied) out.push({ id: 'best-hole', title: 'Best Hole', desc: relText(bestHole.rel) + ' on one hole', player: bestHole.p.id });
    }
    best('hostileLanded', 2, 'Power-Up Menace', 'Landed # hostile power-ups');
    best('bankHoles', 2, 'Bank-Shot Master', 'Holed # putts off the walls');
    best('blocks', 1, 'Untouchable', 'Bubble Guard blocked # attacks');
    best('splashes', 3, 'Splash Zone', 'Took # dips in the water');
    best('longest', 6, 'Long Bomb', 'Holed a putt from # units', function (v) { return v.toFixed(1); });
    best('tokens', 4, 'Crate Collector', 'Grabbed # power-up crates');
    best('bumps', 4, 'Bumper Car', 'Bumped into other balls # times');
    best('hostileTaken', 3, 'Lightning Rod', 'Took # hostile power-ups');
    return out;
  }

  function relText(rel) { return rel === 0 ? 'even' : rel > 0 ? '+' + rel : String(rel); }

  // ------------------------------------------------------------------ views

  M.view = function (forId) {
    var self = this, r = this.round;
    var me = this.get(forId);
    return {
      code: this.code, phase: this.phase, settings: this.settings, you: forId,
      timeLeft: this.phaseEnds ? Math.max(0, round2(this.phaseEnds - this.clock)) : null,
      hurry: !!this.hurry,
      t: round2(this.t),
      course: r ? { id: r.course.id, mirror: r.mirror, index: r.courseIdx, count: r.order.length, order: r.order } : null,
      hole: r && r.hole ? { index: r.holeIdx, id: r.hole.id, par: r.hole.par } : null,
      tokens: (this.tokens || []).map(function (tk) { return { id: tk.id, x: round2(tk.x), y: round2(tk.y), z: round2(tk.z), active: tk.active }; }),
      players: this.players.map(function (p) {
        return {
          id: p.id, name: p.name, color: p.color, bot: p.bot, isHost: p.isHost, ready: p.ready, connected: p.connected,
          finished: p.finished, status: p.status, strokes: p.strokes, shotOnce: p.shotOnce,
          holes: p.holes, courseTotals: p.courseTotals,
          // Opponents see how many items you hold, not which.
          inventory: p.id === forId ? p.inventory.slice() : p.inventory.map(function () { return '?'; }),
          effects: p.effects.map(function (e) { return { kind: e.kind, left: e.until != null ? Math.max(0, round2(e.until - self.t)) : null, shots: e.shots, live: e.live, from: e.from }; }),
          frostImmune: p.frostImmuneUntil > self.t, stats: p.stats
        };
      }),
      standings: this.phase === 'lobby' ? [] : this.standings(),
      awards: this.phase === 'final' ? this.awards : null,
      votes: this.votes,
      restSince: me && me.restSince != null ? round2(me.restSince) : null
    };
  };

  /** Compact ball positions for the 20 Hz stream: [id, x, y, z, r, flags]. */
  M.snapshot = function () {
    var out = [];
    this.players.forEach(function (p) {
      var b = p.ball;
      if (!b) return;
      var f = (b.moving ? 1 : 0) | (b.holed ? 2 : 0) | (b.frozen ? 4 : 0) | (b.ghost ? 8 : 0) | (b.grounded ? 16 : 0);
      out.push([p.id, round3(b.x), round3(b.y), round3(b.z), round3(b.r), f, round2(b.vx), round2(b.vz)]);
    });
    return { t: Math.round(this.t * 1000) / 1000, b: out };
  };
  function round3(v) { return Math.round(v * 1000) / 1000; }

  PuttMatch.MAX_PLAYERS = MAX_PLAYERS;
  PuttMatch.COLORS = COLORS;
  PuttMatch.COLOR_NAMES = COLOR_NAMES;
  PuttMatch.SYMBOLS = SYMBOLS;
  PuttMatch.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  PuttMatch.STRENGTH = STRENGTH;
  PuttMatch.TIMING = TIMING;
  PuttMatch.relText = relText;
  PuttMatch.computeAwards = computeAwards;
  return PuttMatch;
});
