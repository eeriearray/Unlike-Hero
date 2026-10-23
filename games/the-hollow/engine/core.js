/*!
 * THE HOLLOW — engine core: the authoritative game object.
 *
 * Six files, one engine (all attach to globalThis.HollowEngine; Node loads them through ./index.js, browsers by <script>):
 *   core.js    lobby, state, commands, duplicate suppression, timers and AFK policy, save/restore
 *   rules.js   D20 checks, option evaluation, outcomes, inventory, statuses, damage, falling, levels
 *   world.js   map and movement, enemies, clues and puzzles, omens, the Haunting Clock
 *   finale.js  the Abbey Warden, endings, objectives, results, spirits, and the AI that plays for absent players
 *   view.js    viewFor(player): what each player may see; catalog(): static names and art keys for the client
 *   (data/*.js hold all content: add a location, item, class, enemy or event there without touching the engine)
 *
 * The engine knows nothing about sockets. A transport creates a HollowGame, forwards player commands to game.command(),
 * calls game.tick() about once a second, and listens to the hooks:  sync() — state changed; send game.viewFor(id) to everyone.
 * viewFor(id) is the ONLY way state leaves the engine. Rolls, rewards and legality are decided here, never by a client.
 *
 * Option format (see data/*.js):  { id, label, stat, dc, ap, stakes, req, show, hide, cost, once, retry, mods, bonus, puzzle, ok, fail, crit, fumble, auto }
 * Outcome format: { t, vit, san, xp, glory, silver, item, lose, clue, hint, flag, clock, noise, reveal, open, spawn, hurt, kill, goto, move,
 *                   status, cleanse, ally, stat, party, ... } — see applyOutcome() in rules.js.
 */
(function (g) {
  'use strict';
  var H = g.HollowEngine = g.HollowEngine || {};

  H.CFG = {
    maxPlayers: 6,
    clockMax: 36, phaseAt: [12, 24],
    clockStep: [1.3, 1.6, 1.9, 2.2, 2.5, 2.8],     // base Haunting ticks per round for 1..6 players
    phaseMult: [0.8, 1.0, 1.25],
    noiseMax: 3,
    packSize: 7,
    apFor: function (n) { return n <= 2 ? 3 : 2; },
    turnSec: 150, graceSec: 40, voteSec: 75, holdSec: 45, waitMaxSec: 300,
    restsPerPhase: 2, logKeep: 160
  };

  // ───────────────────────────────────────────── helpers ─────────────────────────────────────────────
  var util = H.util = {
    clamp: function (n, a, b) { return Math.max(a, Math.min(b, n)); },
    clean: function (s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max || 24); },
    copy: function (o) { return JSON.parse(JSON.stringify(o)); },
    sum: function (a) { return a.reduce(function (x, y) { return x + y; }, 0); },
    key: function (a, b) { return a < b ? a + '|' + b : b + '|' + a; },
    cap: function (s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  };

  function mulberry(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return { v: ((t ^ (t >>> 14)) >>> 0) / 4294967296, s: s };
    };
  }

  // The static map graph (built once from data/map.js).
  H.buildGraph = function () {
    var D = g.HollowData, edges = {}, adj = {};
    Object.keys(D.locations).forEach(function (id) { adj[id] = []; });
    D.edges.forEach(function (row) {
      var a = row[0], b = row[1], o = row[2] || {};
      if (!D.locations[a] || !D.locations[b]) throw new Error('Edge to unknown place: ' + a + ' ' + b);
      var e = { a: a, b: b, type: o.type || 'path', oneway: !!o.oneway, dc: o.dc || 12, ways: o.ways || null, until: o.until || null, label: o.label || '', trap: o.trap || null };
      e.key = e.oneway ? a + '>' + b : util.key(a, b);
      edges[e.key] = e;
      adj[a].push({ to: b, e: e });
      if (!e.oneway) adj[b].push({ to: a, e: e });
    });
    return { edges: edges, adj: adj };
  };

  // Puzzle options are always one-time rewards for the whole party; this keeps content authors from having to remember.
  H.normalize = function () {
    if (H.normalized) return; H.normalized = true;
    var D = g.HollowData;
    var fix = function (o) { if (o.puzzle && !o.once) o.once = 'party'; };
    Object.keys(D.locations).forEach(function (k) { (D.locations[k].options || []).forEach(fix); });
    D.regionEvents.forEach(function (e) { e.options.forEach(fix); });
  };

  // ───────────────────────────────────────────── the game ─────────────────────────────────────────────
  function HollowGame(opts) {
    opts = opts || {};
    this.code = opts.code || 'LOCAL';
    this.hooks = opts.hooks || {};
    this.clock = opts.now || Date.now;
    this.seed = (opts.seed != null ? opts.seed : (Math.random() * 4294967296)) >>> 0;
    this.rs = this.seed;                 // rng state (serialised)
    this.phase = 'lobby';                // lobby | playing | ended
    this.players = [];
    this.settings = { afk: 'skip', turnSec: H.CFG.turnSec, solo: false };
    this.w = null;                       // the world, created by begin()
    this.turn = null;
    this.log = [];
    this.n = 0;                          // log counter
    this.ver = 1;
    this.cids = {};                      // pid -> { cid: result } recent command ids (duplicate suppression)
    this.created = this.clock();
    this.graph = H.graph || (H.graph = H.buildGraph());
    H.normalize();
    this.ended = null;
  }
  H.HollowGame = HollowGame;
  H.mixin = function (methods) { Object.keys(methods).forEach(function (k) { HollowGame.prototype[k] = methods[k]; }); };
  var P = HollowGame.prototype;

  // ───────────────────────────── randomness (deterministic and replayable from the seed + log) ─────────────────────────────
  P.rand = function () { var r = mulberry(this.rs)(); this.rs = r.s; return r.v; };
  P.rint = function (n) { return Math.floor(this.rand() * n); };
  P.d20 = function () { return 1 + this.rint(20); };
  P.pick = function (arr) { return arr.length ? arr[this.rint(arr.length)] : undefined; };
  P.shuffle = function (arr) { arr = arr.slice(); for (var i = arr.length - 1; i > 0; i--) { var j = this.rint(i + 1), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
  P.now = function () { return this.clock(); };

  // ───────────────────────────── lobby ─────────────────────────────
  P.get = function (id) { for (var i = 0; i < this.players.length; i++) if (this.players[i].id === id) return this.players[i]; return null; };
  P.changed = function () { this.ver++; if (this.hooks.sync) this.hooks.sync(); };
  P.living = function () { return this.players.filter(function (p) { return p.status === 'alive'; }); };
  P.here = function (loc) { return this.players.filter(function (p) { return p.status === 'alive' && p.loc === loc; }); };

  P.addPlayer = function (o) {
    if (this.phase !== 'lobby') return { error: 'The expedition has already set out.' };
    if (this.players.length >= H.CFG.maxPlayers) return { error: 'The party is full (6 players).' };
    var name = util.clean(o.name, 20) || 'Wanderer';
    if (this.players.some(function (p) { return p.name.toLowerCase() === name.toLowerCase(); })) name = name + ' ' + (this.players.length + 1);
    var p = { id: o.id, name: name, cls: null, ready: false, connected: true, host: this.players.length === 0, joined: this.players.length, disconnectedAt: 0, status: 'alive' };
    this.players.push(p);
    this.changed();
    return { ok: true, player: p };
  };

  P.removePlayer = function (id) {
    var p = this.get(id); if (!p) return;
    if (this.phase === 'lobby') {
      this.players = this.players.filter(function (x) { return x.id !== id; });
      if (p.host && this.players.length) this.players[0].host = true;
      this.changed();
    } else this.setConnected(id, false);
  };

  P.setConnected = function (id, on) {
    var p = this.get(id); if (!p) return;
    p.connected = !!on;
    p.disconnectedAt = on ? 0 : this.now();
    if (this.phase === 'playing') this.addLog('system', on ? p.name + ' has returned to the expedition.' : p.name + ' has lost the thread. ' + this.policyText(), { p: id });
    this.changed();
  };

  P.policyText = function () {
    var s = this.settings;
    if (s.afk === 'ai') return 'If they do not return, a ghost-hand will play their turns.';
    if (s.afk === 'wait') return 'The party will wait for them.';
    return 'Their turns will be skipped until they return.';
  };

  // ───────────────────────────── commands ─────────────────────────────
  P.command = function (pid, cmd) {
    var p = this.get(pid);
    if (!p) return { error: 'You are not in this expedition.' };
    if (!cmd || typeof cmd !== 'object' || typeof cmd.t !== 'string') return { error: 'Malformed command.' };
    var cid = cmd.cid != null && /^[\w.-]{1,40}$/.test(String(cmd.cid)) && String(cmd.cid) !== '__proto__' ? String(cmd.cid) : null;
    var seen = (this.cids[pid] = this.cids[pid] || { order: [], res: {} });
    if (cid && Object.prototype.hasOwnProperty.call(seen.res, cid)) return Object.assign({}, seen.res[cid], { dup: true });
    var fn = this['cmd_' + cmd.t];
    var res;
    if (typeof fn !== 'function') res = { error: 'Unknown action.' };
    else {
      try { res = fn.call(this, p, cmd) || { ok: true }; this.settleTurn(); }
      catch (e) { console.error('[hollow] command failed', cmd.t, e); res = { error: 'The Hollow hiccuped. Try again.' }; }
    }
    if (cid) {
      seen.res[cid] = res; seen.order.push(cid);
      while (seen.order.length > 40) delete seen.res[seen.order.shift()];
    }
    if (!res.error) this.changed();
    return res;
  };

  P.cmd_profile = function (p, c) {
    if (this.phase !== 'lobby') return { error: 'The expedition has set out.' };
    var name = util.clean(c.name, 20); if (name) p.name = name;
    return { ok: true };
  };

  P.cmd_settings = function (p, c) {
    if (!p.host) return { error: 'Only the host can change the rules of the table.' };
    if (this.phase !== 'lobby') return { error: 'The rules are fixed once the expedition begins.' };
    if (c.afk && ['skip', 'ai', 'wait'].indexOf(c.afk) >= 0) this.settings.afk = c.afk;
    if (c.turnSec) this.settings.turnSec = util.clamp(Math.round(+c.turnSec) || H.CFG.turnSec, 45, 600);
    return { ok: true };
  };

  P.cmd_pick = function (p, c) {
    if (this.phase !== 'lobby') return { error: 'The expedition has set out.' };
    var D = g.HollowData;
    if (!D.classes[c.cls]) return { error: 'Unknown character.' };
    var taken = this.players.find(function (x) { return x.id !== p.id && x.cls === c.cls; });
    if (taken) return { error: D.classes[c.cls].name + ' is already ' + taken.name + '.' };
    p.cls = c.cls; p.ready = false;
    return { ok: true };
  };

  // Ghost companions: AI-driven party members, for solo play, testing and filling an empty seat.
  P.cmd_addbot = function (p) {
    if (!p.host) return { error: 'Only the host can summon companions.' };
    if (this.phase !== 'lobby') return { error: 'The expedition has set out.' };
    if (this.players.length >= H.CFG.maxPlayers) return { error: 'The party is full.' };
    var D = g.HollowData, taken = this.players.map(function (x) { return x.cls; });
    var free = Object.keys(D.classes).filter(function (k) { return taken.indexOf(k) < 0; });
    var cls = free[this.players.length % free.length];
    var id = 'bot' + (this.players.filter(function (x) { return x.bot; }).length + 1) + '-' + Math.floor(this.rand() * 1e6);
    var pl = { id: id, name: D.classes[cls].person.split(' ')[0] + ' (ghost)', cls: cls, ready: true, connected: true, host: false, joined: this.players.length, disconnectedAt: 0, status: 'alive', bot: true };
    this.players.push(pl);
    return { ok: true };
  };
  P.cmd_kickbot = function (p, c) {
    if (!p.host) return { error: 'Only the host can dismiss companions.' };
    if (this.phase !== 'lobby') return { error: 'The expedition has set out.' };
    var b = this.get(c.id);
    if (!b || !b.bot) return { error: 'Not a companion.' };
    this.players = this.players.filter(function (x) { return x !== b; });
    return { ok: true };
  };

  P.cmd_ready = function (p, c) {
    if (this.phase !== 'lobby') return { error: 'The expedition has set out.' };
    if (!p.cls) return { error: 'Choose a character first.' };
    p.ready = c.on !== false;
    return { ok: true };
  };

  P.cmd_start = function (p, c) {
    if (!p.host) return { error: 'Only the host can set out.' };
    if (this.phase !== 'lobby') return { error: 'Already under way.' };
    var ps = this.players;
    var open = ps.filter(function (x) { return !x.cls; });
    if (open.length) return { error: open.map(function (x) { return x.name; }).join(', ') + ' still need a character.' };
    var waiting = ps.filter(function (x) { return !x.ready && !x.host && x.connected && !x.bot; });
    if (waiting.length) return { error: 'Waiting for ' + waiting.map(function (x) { return x.name; }).join(', ') + ' to be ready.' };
    this.settings.solo = ps.filter(function (x) { return !x.bot; }).length === 1;
    this.settings.opening = !!c.opening;
    this.begin();
    return { ok: true };
  };

  // ───────────────────────────── logging ─────────────────────────────
  P.addLog = function (k, t, o) {
    o = o || {};
    var e = { n: ++this.n, r: this.w ? this.w.round : 0, k: k, t: t };
    if (o.p) e.p = o.p;
    if (o.to) e.to = o.to;
    if (o.d) e.d = o.d;
    if (o.loc) e.loc = o.loc;
    this.log.push(e);
    if (this.log.length > H.CFG.logKeep * 3) this.log.splice(0, this.log.length - H.CFG.logKeep * 2);
    return e;
  };

  // ───────────────────────────── timers (called about once a second by the transport) ─────────────────────────────
  P.tick = function () {
    if (this.phase !== 'playing' || !this.turn) return;
    var now = this.now(), t = this.turn, C = H.CFG, w = this.w, changed = false;
    var a = this.get(t.active);
    // companions play quickly but not instantly, so the table can follow
    if (a && a.bot && a.status === 'alive' && now >= (t.botAt || 0)) { this.autoTurn(a); this.changed(); return; }
    // a vote that nobody finishes
    if (w.vote && now > w.vote.deadline) { this.settleVote(true); changed = true; }
    if (this.phase !== 'playing' || !this.turn) { if (changed) this.changed(); return; }
    if (!a || a.status !== 'alive') { this.advanceTurn(); this.changed(); return; }
    // a held roll waits for the player to accept or reroll; accept for them after a while
    if (!this.settings.solo && t.enc && t.enc.hold && now > t.enc.hold.deadline) { this.releaseHold(a); changed = true; }
    if (this.phase !== 'playing' || !this.turn) { if (changed) this.changed(); return; }
    var away = !a.connected && now - a.disconnectedAt > C.graceSec * 1000;
    var idle = !this.settings.solo && now > t.deadline;
    if (away || idle) {
      var pol = this.settings.afk;
      if (away && pol === 'wait' && now - a.disconnectedAt < C.waitMaxSec * 1000) { /* the table waits */ }
      else if (pol === 'ai') { this.addLog('system', a.name + (away ? ' is away' : ' hesitates') + '. A ghost-hand plays the turn.', { p: a.id }); this.autoTurn(a); changed = true; }
      else {
        this.addLog('system', a.name + (away ? ' is away' : ' hesitates too long') + '. The turn passes.', { p: a.id });
        if (t.enc) this.closeEnc(a, true);
        this.endTurnFor(a); changed = true;
      }
    }
    if (changed) this.changed();
  };

  // ───────────────────────────── snapshots (persistence and reconnect) ─────────────────────────────
  P.snapshot = function () {
    return util.copy({
      v: 1, code: this.code, seed: this.seed, rs: this.rs, phase: this.phase, players: this.players, settings: this.settings,
      w: this.w, turn: this.turn, log: this.log, n: this.n, ver: this.ver, ended: this.ended, created: this.created, cids: this.cids
    });
  };
  HollowGame.restore = function (snap, opts) {
    var game = new HollowGame(Object.assign({ code: snap.code, seed: snap.seed }, opts || {}));
    ['rs', 'phase', 'players', 'settings', 'w', 'turn', 'log', 'n', 'ver', 'ended', 'created', 'cids'].forEach(function (k) { game[k] = util.copy(snap[k] === undefined ? null : snap[k]); });
    if (!game.cids) game.cids = {};
    game.players.forEach(function (p) { p.connected = !!p.bot; p.disconnectedAt = p.bot ? 0 : game.now(); });
    if (game.turn) game.turn.deadline = game.now() + game.settings.turnSec * 1000;
    return game;
  };
  P.destroy = function () { this.hooks = {}; };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
