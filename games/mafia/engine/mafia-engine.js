/*!
 * Mafia engine — the automated "God" (game master).
 *
 * One file, two homes:
 *   • Node (games/mafia/server/index.mjs) runs it as the authoritative online server.
 *   • Browsers load it as a classic <script> (window.MafiaEngine) for offline games against bots.
 *
 * The engine knows nothing about sockets. A transport creates a MafiaGame, forwards player
 * commands to it, and listens to three hooks:
 *   sync()                 — state changed; send game.viewFor(playerId) to every player
 *   chat(msg, recipients)  — a chat line for these player ids
 *   fx(recipients, data)   — a one-shot effect (emoji reactions); recipients null = everyone
 *   chatReset()            — chat permissions changed; resend game.chatHistoryFor(id) to everyone
 *
 * viewFor(id) is the ONLY way state leaves the engine, and it contains only what that player
 * is allowed to know. Never send the raw game object to a client.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MafiaEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ───────────────────────────────────────────── Roles ─────────────────────────────────────────────

  var TEAMS = {
    town: { id: 'town', name: 'Town', color: '#6fc3ff', goal: 'Find and lynch every member of the Mafia and every hostile killer.' },
    mafia: { id: 'mafia', name: 'Mafia', color: '#ff3b4f', goal: 'Reach parity with the town and remove anyone who opposes the family.' },
    neutral: { id: 'neutral', name: 'Neutral', color: '#c38bff', goal: 'Follow your own agenda.' }
  };

  // target rules: otherAlive | anyAlive | otherAliveNonMafia | dead
  var ROLES = {
    villager: { id: 'villager', name: 'Villager', team: 'town', icon: '🧑‍🌾', toggle: false, appearsEvil: false,
      summary: 'An ordinary citizen with a keen eye and a loud voice.',
      abilityText: 'No night ability. Your weapon is your vote — use it wisely.', ability: null },
    detective: { id: 'detective', name: 'Detective', team: 'town', icon: '🕵️', toggle: true, appearsEvil: false,
      summary: 'A sharp investigator working the night shift.',
      abilityText: 'Each night, inspect one player to learn whether they are Innocent or Suspicious. The Godfather appears Innocent; framed players appear Suspicious.',
      ability: { type: 'inspect', verb: 'Investigate', ui: 'radar', target: 'otherAlive' } },
    doctor: { id: 'doctor', name: 'Doctor', team: 'town', icon: '🩺', toggle: true, appearsEvil: false,
      summary: 'The town medic, sworn to keep people breathing.',
      abilityText: 'Each night, heal one player to stop one attack on them. You can heal yourself once, and never the same person two nights in a row.',
      ability: { type: 'heal', verb: 'Heal', ui: 'syringe', target: 'anyAlive' } },
    bodyguard: { id: 'bodyguard', name: 'Bodyguard', team: 'town', icon: '🛡️', toggle: true, appearsEvil: false,
      summary: 'Muscle for hire, loyal to the town.',
      abilityText: 'Each night, guard a player. If they are attacked, you fight off the attacker — and you both die.',
      ability: { type: 'guard', verb: 'Guard', ui: 'shield', target: 'otherAlive' } },
    vigilante: { id: 'vigilante', name: 'Vigilante', team: 'town', icon: '🎯', toggle: true, appearsEvil: false,
      summary: 'A lone gun who takes justice into their own hands.',
      abilityText: 'You hold a single bullet. Once per game, shoot a player at night.',
      ability: { type: 'shoot', verb: 'Shoot', ui: 'scope', target: 'otherAlive', uses: 1 } },
    medium: { id: 'medium', name: 'Medium', team: 'town', icon: '🔮', toggle: true, appearsEvil: false,
      summary: 'You hear the whispers of the departed.',
      abilityText: 'At night you can talk with the dead in the Graveyard. Once per game, hold a séance with a dead player to learn their true role and hear a ghostly hint.',
      ability: { type: 'seance', verb: 'Séance', ui: 'crystal', target: 'dead', uses: 1 } },

    mafioso: { id: 'mafioso', name: 'Mafioso', team: 'mafia', icon: '🔫', toggle: false, appearsEvil: true,
      summary: 'A loyal soldier of the family.',
      abilityText: 'Vote with the family each night on who to kill. You carry out the hit.', ability: null },
    godfather: { id: 'godfather', name: 'Godfather', team: 'mafia', icon: '🎩', toggle: true, appearsEvil: false,
      summary: 'The head of the family. Untouchable on paper.',
      abilityText: 'You appear Innocent to the Detective. Your kill vote is final.', ability: null },
    consigliere: { id: 'consigliere', name: 'Consigliere', team: 'mafia', icon: '📜', toggle: true, appearsEvil: true,
      summary: 'The family’s advisor, who knows everyone’s secrets.',
      abilityText: 'Each night, investigate a player to learn their exact role.',
      ability: { type: 'scout', verb: 'Investigate', ui: 'dossier', target: 'otherAliveNonMafia' } },
    framer: { id: 'framer', name: 'Framer', team: 'mafia', icon: '🖼️', toggle: true, appearsEvil: true,
      summary: 'A forger of evidence and planter of lies.',
      abilityText: 'Each night, frame a player so they look Suspicious to the Detective that night.',
      ability: { type: 'frame', verb: 'Frame', ui: 'mask', target: 'otherAliveNonMafia' } },
    silencer: { id: 'silencer', name: 'Silencer', team: 'mafia', icon: '🤐', toggle: true, appearsEvil: true,
      summary: 'Nobody talks when you’re around.',
      abilityText: 'Each night, silence a player. They cannot speak during the next day — they can only vote.',
      ability: { type: 'silence', verb: 'Silence', ui: 'mute', target: 'otherAliveNonMafia' } },

    serial_killer: { id: 'serial_killer', name: 'Serial Killer', team: 'neutral', icon: '🔪', toggle: true, appearsEvil: true,
      summary: 'A psychopath who answers to no one.',
      abilityText: 'Kill one player every night. You win if you are the last one standing.',
      goal: 'Be the last one standing.',
      ability: { type: 'kill', verb: 'Kill', ui: 'blade', target: 'otherAlive' } },
    jester: { id: 'jester', name: 'Jester', team: 'neutral', icon: '🃏', toggle: true, appearsEvil: false,
      summary: 'A fool who longs for the gallows.',
      abilityText: 'No night ability. Act suspicious and trick the town into lynching you.',
      goal: 'Get yourself lynched by the town.', ability: null },
    executioner: { id: 'executioner', name: 'Executioner', team: 'neutral', icon: '⚖️', toggle: true, appearsEvil: false,
      summary: 'You hold a grudge — and a secret target.',
      abilityText: 'Convince the town to lynch your target. If your target dies at night instead, you become a Jester.',
      goal: 'Get your target lynched.', ability: null }
  };

  var ROLE_GROUPS = {
    town: ['detective', 'doctor', 'bodyguard', 'vigilante', 'medium'],
    mafia: ['godfather', 'consigliere', 'framer', 'silencer'],
    neutral: ['jester', 'executioner', 'serial_killer']
  };

  var DEFAULT_SETTINGS = {
    roles: {
      detective: true, doctor: true, bodyguard: false, vigilante: false, medium: false,
      godfather: true, consigliere: false, framer: false, silencer: false,
      jester: true, executioner: false, serial_killer: false
    },
    mafiaCount: 'auto',
    revealRoles: true,
    timers: { night: 40, discussion: 90, voting: 40, defense: 20, judgment: 20 }
  };

  var TIMER_LIMITS = { night: [15, 180], discussion: [20, 600], voting: [15, 180], defense: [10, 90], judgment: [10, 90] };
  var MIN_PLAYERS = 4;
  var MAX_PLAYERS = 16;
  var MAX_DAYS = 20;
  var REACTIONS = ['👉', '🤥', '🍿', '😱', '🤔', '😂', '💀', '🙏'];
  var AVATARS = ['🦊', '🐺', '🦉', '🐍', '🦇', '🐈‍⬛', '🦅', '🐻', '🐗', '🦌', '🐀', '🕷️', '🐙', '🦂', '🐸', '🐒', '🎭', '🌹', '🥃', '🎲'];

  function describeRole(id) {
    var r = ROLES[id];
    if (!r) return null;
    return {
      id: r.id, name: r.name, team: r.team, icon: r.icon, summary: r.summary, abilityText: r.abilityText,
      goal: r.goal || TEAMS[r.team].goal, ui: r.ability ? r.ability.ui : (r.team === 'mafia' ? 'scope' : null)
    };
  }

  // ───────────────────────────────────────────── Helpers ─────────────────────────────────────────────

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
  function clamp(n, lo, hi) { n = Number(n); if (!isFinite(n)) return lo; return Math.max(lo, Math.min(hi, Math.round(n))); }
  function article(word) { return /^[aeiou]/i.test(word) ? 'an' : 'a'; }
  function cleanText(s, max) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function sanitizeSettings(input, base) {
    var s = JSON.parse(JSON.stringify(base || DEFAULT_SETTINGS));
    if (!input || typeof input !== 'object') return s;
    if (input.roles && typeof input.roles === 'object') {
      Object.keys(s.roles).forEach(function (k) { if (k in input.roles) s.roles[k] = !!input.roles[k]; });
    }
    if ('mafiaCount' in input) {
      var m = input.mafiaCount;
      s.mafiaCount = m === 'auto' ? 'auto' : clamp(m, 1, 5);
    }
    if ('revealRoles' in input) s.revealRoles = !!input.revealRoles;
    if (input.timers && typeof input.timers === 'object') {
      Object.keys(TIMER_LIMITS).forEach(function (k) {
        if (k in input.timers) s.timers[k] = clamp(input.timers[k], TIMER_LIMITS[k][0], TIMER_LIMITS[k][1]);
      });
    }
    return s;
  }

  // ───────────────────────────────────────── Role distribution ─────────────────────────────────────────

  function autoMafiaCount(n) { return n <= 6 ? 1 : n <= 9 ? 2 : n <= 13 ? 3 : 4; }
  function autoNeutralCount(n) { return n < 6 ? 0 : n < 9 ? 1 : n < 13 ? 2 : 3; }

  /** Role ids for an n-player game. The Mafia always starts as a strict minority. */
  function buildRoleList(n, settings, rng) {
    rng = rng || Math.random;
    var t = settings.roles || {};
    var mafiaCount = settings.mafiaCount === 'auto' || !settings.mafiaCount ? autoMafiaCount(n) : Number(settings.mafiaCount);
    mafiaCount = Math.max(1, Math.min(mafiaCount, Math.ceil(n / 2) - 1));
    var roles = [];

    var mafiaPool = [];
    if (t.godfather) mafiaPool.push('godfather');
    mafiaPool = mafiaPool.concat(shuffle(ROLE_GROUPS.mafia.filter(function (r) { return t[r] && r !== 'godfather'; }), rng));
    for (var i = 0; i < mafiaCount; i++) roles.push(mafiaPool[i] || 'mafioso');
    // Big families always keep a plain Mafioso to carry out hits.
    if (mafiaCount >= 3 && roles.indexOf('mafioso') < 0) roles[roles.length - 1] = 'mafioso';

    var neutralPool = shuffle(ROLE_GROUPS.neutral.filter(function (r) { return t[r] && (r !== 'serial_killer' || n >= 7); }), rng);
    var neutralCap = Math.max(0, n - mafiaCount - Math.max(2, mafiaCount + 1));
    var neutralCount = Math.min(autoNeutralCount(n), neutralPool.length, neutralCap);
    roles = roles.concat(neutralPool.slice(0, neutralCount));

    var townSlots = n - roles.length;
    var priority = ['detective', 'doctor'].filter(function (r) { return t[r]; });
    var others = shuffle(ROLE_GROUPS.town.filter(function (r) { return t[r] && priority.indexOf(r) < 0; }), rng);
    var specials = priority.concat(others);
    var cap = townSlots >= 4 ? townSlots - 1 : townSlots; // keep at least one Villager in bigger towns
    roles = roles.concat(specials.slice(0, cap));
    while (roles.length < n) roles.push('villager');
    return shuffle(roles, rng);
  }

  // ───────────────────────────────────────── Narrator ("God") ─────────────────────────────────────────

  var STORY = {
    weather: [
      'The town awakens to a cold, steady rain', 'A thick fog rolls off the harbor as the sun rises',
      'Dawn breaks blood-red over the rooftops', 'The church bells ring out across a silent town',
      'Thunder rumbles in the distance as morning comes', 'A pale sun struggles through the smog',
      'Crows gather on the telegraph wires as day breaks', 'The streetlamps flicker out one by one'
    ],
    places: [
      'in the central alley', 'slumped against the fountain in the square', 'behind the old jazz club',
      'on the steps of the courthouse', 'beneath the railway bridge', 'in the back room of the barbershop',
      'floating by the docks', 'at the foot of the clock tower', 'in their own locked study', 'outside the abandoned theater'
    ],
    cause: {
      mafia: ['Three bullet casings glitter on the cobblestones — the family sends its regards.',
        'A single red rose was left on the body. The Mafia has struck.',
        'Witnesses heard a black sedan screech away moments after the gunshots.'],
      serial_killer: ['The wounds are savage and frenzied. A Serial Killer stalks these streets.',
        'A crude smiley face was scrawled in chalk beside the body.',
        'Whoever did this enjoyed it. This was no professional hit.'],
      vigilante: ['A single, clean shot. Someone has decided to take the law into their own hands.',
        'One gunshot rang out at midnight. The Vigilante has made their choice.'],
      bodyguard: ['Signs of a brutal struggle — they died fighting off an attacker.'],
      bodyguard_counter: ['They were struck down mid-attack by a protector who would not yield.']
    },
    quiet: ['Somehow, against all odds, no blood was spilled last night.', 'The night passed quietly. Too quietly.',
      'Everyone answers the morning roll call. For now.'],
    saved: ['Signs of a struggle were found at a doorstep, but its owner is alive — someone stopped the bleeding just in time.',
      'A blood-soaked bandage lies in the gutter. Someone was saved in the nick of time.'],
    docFailed: ['A doctor’s bag was found beside the body. Someone tried to save them, but it was too late.'],
    nightIntro: ['Night {n} falls. Lock your doors. Close your eyes.', 'The moon rises over the town. Night {n} begins.',
      'Darkness swallows the streets. Night {n}. Those with work to do... begin.'],
    trial: ['{name} is dragged to the gallows. Speak now, {name} — convince them.',
      'All eyes turn to {name}. The accused may make their defense.',
      '{name} stands trial before the town. Choose your words carefully.'],
    spared: ['The town has spoken: {name} is spared. For now.', '{name} steps down from the gallows, shaken but alive.'],
    executed: ['The trapdoor drops. {name} has been executed.', 'The gavel falls. {name} is led away and hanged.'],
    noTrial: ['The town could not agree on anyone. Nobody hangs today.', 'Murmurs, accusations, no consensus. The gallows stay empty.']
  };
  function fill(tpl, vars) { return tpl.replace(/\{(\w+)\}/g, function (_, k) { return vars[k]; }); }

  // ───────────────────────────────────────────── Bots ─────────────────────────────────────────────

  var BOT_NAMES = ['Vinnie', 'Rosa', 'Sal', 'Lucky', 'Mae', 'Duke', 'Ivy', 'Frankie', 'Dot', 'Ace', 'Lou', 'Greta', 'Nico', 'Pearl', 'Moe', 'Vera'];
  var BOT_LINES = {
    discussion: ['I was home all night, I swear.', 'Someone here is lying.', 'Who has info? Speak up.',
      'I have a bad feeling about {name}.', '{name} has been awfully quiet...', 'Let’s not rush this.',
      'I trust {name}. Mostly.', 'Anyone else notice how nervous {name} looks?', 'We need to vote smart today.'],
    jester: ['Maybe I did it. Maybe I didn’t. 😏', 'Go on, vote me. I dare you.', 'I am DEFINITELY not suspicious.'],
    defense: ['I’m innocent! You’re making a huge mistake!', 'Check the facts — it wasn’t me!',
      'If you hang me, the real killer walks free.', 'I’ve been helping the town this whole time!'],
    mafia: ['How about {name} tonight?', '{name} is getting too close.', 'Agreed. Let’s make it quick.']
  };

  // ───────────────────────────────────────────── Game ─────────────────────────────────────────────

  var PHASES = ['lobby', 'roles', 'night', 'dawn', 'discussion', 'voting', 'defense', 'judgment', 'verdict', 'gameover'];
  var DAY_TALK = { dawn: 1, discussion: 1, voting: 1, judgment: 1, verdict: 1 };

  /**
   * @param {object} opts
   *   code      room code (display only)
   *   hooks     { sync, chat, fx, chatReset }
   *   rng       random function (tests inject a seeded one)
   *   now       clock function returning ms
   *   timers    { set(fn, ms) -> handle, clear(handle) } (tests can stub)
   *   botSpeed  multiplier for bot think time (tests use 0)
   */
  function MafiaGame(opts) {
    opts = opts || {};
    this.code = opts.code || '';
    this.hooks = opts.hooks || {};
    this.rng = opts.rng || Math.random;
    this.now = opts.now || function () { return Date.now(); };
    this.timers = opts.timers || {
      set: function (fn, ms) { return setTimeout(fn, ms); },
      clear: function (h) { clearTimeout(h); }
    };
    this.botSpeed = opts.botSpeed == null ? 1 : opts.botSpeed;
    this.players = [];
    this.hostId = null;
    this.settings = sanitizeSettings(opts.settings);
    this.phase = 'lobby';
    this.day = 0;
    this.phaseEndsAt = 0;
    this.phaseTimer = null;
    this.botTimers = [];
    this.chat = { lobby: [], day: [], mafia: [], dead: [] };
    this.msgSeq = 0;
    this.lastReact = {};
    this.resetRound();
  }

  var G = MafiaGame.prototype;

  G.resetRound = function () {
    this.day = 0;
    this.night = null;
    this.votes = {};
    this.judgments = {};
    this.accusedId = null;
    this.dawn = null;
    this.verdict = null;
    this.announcement = '';
    this.winner = null;
    this.pendingWinner = null;
    this.neutralWins = [];
    this.timeline = [];
    this.claims = {};       // public bot claims: suspect id -> claimer id (bot Detectives outing suspects)
  };

  // ── emit helpers ──
  G.sync = function () { if (this.hooks.sync) this.hooks.sync(); };
  G.chatReset = function () { if (this.hooks.chatReset) this.hooks.chatReset(); };
  G.get = function (id) { for (var i = 0; i < this.players.length; i++) if (this.players[i].id === id) return this.players[i]; return null; };
  G.living = function () { return this.players.filter(function (p) { return p.alive; }); };
  G.teamOf = function (p) { return p && p.role ? ROLES[p.role].team : null; };
  G.isMafia = function (p) { return this.teamOf(p) === 'mafia'; };
  G.inGame = function () { return this.phase !== 'lobby'; };
  G.log = function (p, text, kind) { p.log.push({ day: this.day, phase: this.phase, text: text, kind: kind || 'info' }); };

  // ───────────────────────── Lobby ─────────────────────────

  G.addPlayer = function (info) {
    if (this.phase !== 'lobby') return { error: 'This game has already started.' };
    if (this.players.length >= MAX_PLAYERS) return { error: 'The room is full (' + MAX_PLAYERS + ' players).' };
    var name = cleanText(info.name, 18) || 'Stranger';
    var base = name, n = 2, self = this;
    while (this.players.some(function (p) { return p.name.toLowerCase() === name.toLowerCase(); })) name = base + ' ' + (n++);
    var avatar = AVATARS.indexOf(info.avatar) >= 0 ? info.avatar : pick(AVATARS, this.rng);
    var p = {
      id: info.id || ('p' + Math.floor(this.rng() * 1e9).toString(36) + (this.players.length)),
      name: name, avatar: avatar, isBot: !!info.isBot, connected: true, alive: true, role: null
    };
    this.resetPlayer(p);
    this.players.push(p);
    if (!this.hostId && !p.isBot) this.hostId = p.id;
    this.systemChat('lobby', p.name + ' joined the room.');
    this.sync();
    return { player: p };
  };

  G.resetPlayer = function (p) {
    p.alive = true; p.role = null; p.originalRole = null; p.ready = false;
    p.deathDay = null; p.deathCause = null; p.silencedDay = null;
    p.usesLeft = {}; p.lastHealTarget = null; p.selfHealUsed = false;
    p.exeTargetId = null; p.log = []; p.inspected = {};
    p.stats = { kills: 0, votesReceived: 0, saves: 0, finds: 0, goodVotes: 0, score: 0 };
  };

  G.addBot = function (byId) {
    if (byId !== this.hostId) return { error: 'Only the host can add bots.' };
    var used = this.players.map(function (p) { return p.name; });
    var free = BOT_NAMES.filter(function (n) { return used.indexOf(n + ' (bot)') < 0; });
    if (!free.length) free = BOT_NAMES;
    return this.addPlayer({ name: pick(free, this.rng) + ' (bot)', isBot: true });
  };

  G.removePlayer = function (id, byId) {
    var p = this.get(id);
    if (!p) return { error: 'No such player.' };
    if (byId && byId !== id && byId !== this.hostId) return { error: 'Only the host can kick players.' };
    if (byId && byId !== id && this.phase !== 'lobby') return { error: 'Players can only be removed in the lobby.' };
    if (this.phase === 'lobby') {
      this.players = this.players.filter(function (x) { return x.id !== id; });
      this.systemChat('lobby', p.name + (byId && byId !== id ? ' was removed by the host.' : ' left the room.'));
    } else {
      // Mid-game the seat stays: the player simply stops acting (timers keep the game moving).
      p.connected = false;
    }
    if (this.hostId === id) this.pickNewHost();
    this.sync();
    return { ok: true };
  };

  G.setConnected = function (id, connected) {
    var p = this.get(id);
    if (!p) return;
    p.connected = connected;
    if (!connected && this.hostId === id) this.pickNewHost();
    if (connected && !this.get(this.hostId)) this.hostId = id;
    this.sync();
  };

  G.pickNewHost = function () {
    var next = this.players.filter(function (p) { return !p.isBot && p.connected; })[0];
    this.hostId = next ? next.id : null;
  };

  G.humans = function () { return this.players.filter(function (p) { return !p.isBot; }); };

  G.updateSettings = function (byId, patch) {
    if (byId !== this.hostId) return { error: 'Only the host can change settings.' };
    if (this.phase !== 'lobby') return { error: 'Settings are locked while a game is running.' };
    this.settings = sanitizeSettings(patch, this.settings);
    this.sync();
    return { ok: true };
  };

  G.start = function (byId) {
    if (byId !== this.hostId) return { error: 'Only the host can start the game.' };
    if (this.phase !== 'lobby') return { error: 'The game is already running.' };
    if (this.players.length < MIN_PLAYERS) return { error: 'You need at least ' + MIN_PLAYERS + ' players. Add bots to fill seats.' };
    var self = this;
    this.resetRound();
    var roles = buildRoleList(this.players.length, this.settings, this.rng);
    this.players.forEach(function (p, i) {
      self.resetPlayer(p);
      p.role = p.originalRole = roles[i];
      var ab = ROLES[p.role].ability;
      if (ab && ab.uses) p.usesLeft[ab.type] = ab.uses;
    });
    // Executioners get a random Town target.
    this.players.forEach(function (p) {
      if (p.role !== 'executioner') return;
      var pool = self.players.filter(function (x) { return x.id !== p.id && self.teamOf(x) === 'town'; });
      if (!pool.length) { p.role = 'jester'; return; }
      p.exeTargetId = pick(pool, self.rng).id;
      self.log(p, 'Your target is ' + self.get(p.exeTargetId).name + '. Get them lynched.', 'target');
    });
    this.chat.day = []; this.chat.mafia = []; this.chat.dead = [];
    this.setPhase('roles', 20);
    this.announcement = 'The cards are dealt. Guard your secret with your life.';
    this.systemChat('day', 'A new game begins with ' + this.players.length + ' players.');
    this.chatReset();
    this.sync();
    return { ok: true };
  };

  G.returnToLobby = function (byId) {
    if (byId !== this.hostId) return { error: 'Only the host can do that.' };
    if (this.phase !== 'gameover') return { error: 'The game is still running.' };
    var self = this;
    this.clearTimers();
    // Drop players who left during the game.
    this.players = this.players.filter(function (p) { return p.connected || p.isBot; });
    this.players.forEach(function (p) { self.resetPlayer(p); });
    this.resetRound();
    this.phase = 'lobby';
    this.phaseEndsAt = 0;
    this.systemChat('lobby', 'Back in the lobby. Same table, new secrets.');
    this.chatReset();
    this.sync();
    return { ok: true };
  };

  // ───────────────────────── Phase machine ─────────────────────────

  G.clearTimers = function () {
    var t = this.timers;
    if (this.phaseTimer) t.clear(this.phaseTimer);
    this.phaseTimer = null;
    this.botTimers.forEach(function (h) { t.clear(h); });
    this.botTimers = [];
  };

  G.setPhase = function (phase, seconds) {
    var self = this;
    this.clearTimers();
    this.phase = phase;
    this.phaseDuration = seconds;
    this.phaseEndsAt = this.now() + seconds * 1000;
    this.phaseTimer = this.timers.set(function () { self.advance(); }, seconds * 1000);
    this.scheduleBots();
  };

  /** Cut the current phase short (everyone has acted). */
  G.hurry = function (seconds) {
    var self = this;
    var left = this.phaseEndsAt - this.now();
    if (left <= seconds * 1000) return;
    if (this.phaseTimer) this.timers.clear(this.phaseTimer);
    this.phaseEndsAt = this.now() + seconds * 1000;
    this.phaseTimer = this.timers.set(function () { self.advance(); }, seconds * 1000);
  };

  /** End the current phase now. Exposed so tests and transports can drive the clock. */
  G.advance = function () {
    switch (this.phase) {
      case 'roles': this.startNight(); break;
      case 'night': this.resolveNight(); break;
      case 'dawn':
        if (this.pendingWinner) this.endGame(this.pendingWinner);
        else this.startDiscussion();
        break;
      case 'discussion': this.startVoting(); break;
      case 'voting': this.endVoting(); break;
      case 'defense': this.startJudgment(); break;
      case 'judgment': this.endJudgment(); break;
      case 'verdict':
        if (this.pendingWinner) this.endGame(this.pendingWinner);
        else this.startNight();
        break;
      default: return;
    }
    this.sync();
  };

  G.setReady = function (id) {
    var p = this.get(id);
    if (!p) return { error: 'Unknown player.' };
    if (this.phase === 'roles') {
      p.ready = true;
      if (this.players.every(function (x) { return x.ready || !x.connected; })) this.hurry(1.5);
    } else if (this.phase === 'discussion' && p.alive) {
      p.ready = !p.ready;
      var alive = this.living();
      var readyCount = alive.filter(function (x) { return x.ready; }).length;
      if (readyCount === alive.length) this.hurry(3);
    } else return { error: 'Nothing to be ready for.' };
    this.sync();
    return { ok: true };
  };

  // ───────────────────────── Night ─────────────────────────

  G.startNight = function () {
    this.day += 1;
    if (this.day > MAX_DAYS) { this.endGame(this.drawResult('The town has bled for ' + MAX_DAYS + ' days. Everyone flees. Nobody wins.')); return; }
    this.night = { actions: {}, framed: {} };
    this.players.forEach(function (p) { p.ready = false; });
    this.votes = {}; this.judgments = {}; this.accusedId = null; this.verdict = null;
    this.announcement = fill(pick(STORY.nightIntro, this.rng), { n: this.day });
    this.timeline.push({ day: this.day, phase: 'night', text: 'Night ' + this.day + ' fell.' });
    this.systemChat('day', '🌙 Night ' + this.day + ' falls.');
    this.setPhase('night', this.settings.timers.night);
    this.chatReset();
  };

  /** The night actions available to player p right now, with valid target ids. */
  G.actionsFor = function (p) {
    if (this.phase !== 'night' || !p || !p.alive) return [];
    var self = this, out = [];
    var alive = this.living();
    function targets(rule) {
      switch (rule) {
        case 'anyAlive': return alive;
        case 'otherAlive': return alive.filter(function (x) { return x.id !== p.id; });
        case 'otherAliveNonMafia': return alive.filter(function (x) { return x.id !== p.id && !self.isMafia(x); });
        case 'dead': return self.players.filter(function (x) { return !x.alive; });
        default: return [];
      }
    }
    if (this.isMafia(p)) {
      out.push({ key: 'kill', type: 'mafiaKill', verb: 'Kill', ui: 'scope', team: true,
        prompt: 'Vote with the family: who dies tonight?',
        targets: targets('otherAliveNonMafia').map(function (x) { return x.id; }) });
    }
    var ab = ROLES[p.role].ability;
    if (ab) {
      var list = targets(ab.target);
      var usable = true;
      if (ab.uses && !(p.usesLeft[ab.type] > 0)) usable = false;
      if (ab.type === 'heal') {
        list = list.filter(function (x) { return x.id !== p.lastHealTarget && !(x.id === p.id && p.selfHealUsed); });
      }
      if (usable && list.length) {
        out.push({ key: 'ability', type: ab.type, verb: ab.verb, ui: ab.ui,
          prompt: ROLES[p.role].abilityText, uses: ab.uses ? p.usesLeft[ab.type] : null,
          targets: list.map(function (x) { return x.id; }) });
      }
    }
    return out;
  };

  G.nightChoices = function (p) { return (this.night && this.night.actions[p.id]) || {}; };

  G.isNightDone = function (p) {
    var choices = this.nightChoices(p);
    return this.actionsFor(p).every(function (a) { return a.key in choices; });
  };

  /** targetId null = deliberately skip. */
  G.nightAction = function (id, key, targetId) {
    var p = this.get(id);
    if (this.phase !== 'night') return { error: 'It is not night.' };
    if (!p || !p.alive) return { error: 'The dead do not act.' };
    var action = this.actionsFor(p).filter(function (a) { return a.key === key; })[0];
    if (!action) return { error: 'You have no such action.' };
    if (targetId != null && action.targets.indexOf(targetId) < 0) return { error: 'Invalid target.' };
    var choices = this.night.actions[p.id] || (this.night.actions[p.id] = {});
    choices[key] = targetId == null ? null : targetId;
    if (key === 'kill') {
      var t = targetId ? this.get(targetId) : null;
      this.mafiaNotice(p.name + (t ? ' wants ' + t.name + ' dead.' : ' votes to hold fire tonight.'));
    }
    this.checkNightComplete();
    this.sync();
    return { ok: true };
  };

  G.checkNightComplete = function () {
    var self = this;
    var actors = this.living().filter(function (p) { return self.actionsFor(p).length; });
    if (actors.every(function (p) { return self.isNightDone(p); })) this.hurry(3);
  };

  G.mafiaTarget = function () {
    var self = this;
    var mafia = this.living().filter(function (p) { return self.isMafia(p); });
    var votes = {};
    var godfatherPick;
    mafia.forEach(function (m) {
      var t = self.nightChoices(m).kill;
      if (!t) return;
      votes[t] = (votes[t] || 0) + 1;
      if (m.role === 'godfather') godfatherPick = t;
    });
    var targetId = godfatherPick;
    if (!targetId) {
      var best = 0, tied = [];
      Object.keys(votes).forEach(function (k) {
        if (votes[k] > best) { best = votes[k]; tied = [k]; } else if (votes[k] === best) tied.push(k);
      });
      if (tied.length) targetId = pick(tied, this.rng);
    }
    if (!targetId) return null;
    // The hit is carried out by a Mafioso if possible (the Godfather keeps his hands clean).
    var shooters = mafia.filter(function (m) { return m.role === 'mafioso'; });
    var voters = shooters.filter(function (m) { return self.nightChoices(m).kill === targetId; });
    var hitman = voters[0] || shooters[0] || mafia.filter(function (m) { return self.nightChoices(m).kill === targetId; })[0] || mafia[0];
    return { targetId: targetId, hitmanId: hitman.id };
  };

  G.resolveNight = function () {
    var self = this;
    var alive = this.living();
    var choice = function (p, key) { return self.nightChoices(p)[key]; };
    var byRole = function (role) { return alive.filter(function (p) { return p.role === role; }); };
    var report = { deaths: [], saves: 0, docFailed: [], silenced: [] };
    var dying = {};

    // 1. Silencer & Framer
    var framed = {};
    byRole('silencer').forEach(function (s) {
      var t = self.get(choice(s, 'ability'));
      if (t) { t.silencedDay = self.day; self.log(s, 'You silenced ' + t.name + '. They cannot speak tomorrow.', 'action'); }
    });
    byRole('framer').forEach(function (f) {
      var t = self.get(choice(f, 'ability'));
      if (t) { framed[t.id] = true; self.log(f, 'You planted evidence on ' + t.name + '.', 'action'); }
    });

    // 2. Doctor & Bodyguard
    var heals = {}, healers = {}, guards = {};
    byRole('doctor').forEach(function (d) {
      var t = self.get(choice(d, 'ability'));
      d.lastHealTarget = t ? t.id : null;
      if (!t) return;
      if (t.id === d.id) d.selfHealUsed = true;
      heals[t.id] = (heals[t.id] || 0) + 1;
      (healers[t.id] = healers[t.id] || []).push(d);
    });
    byRole('bodyguard').forEach(function (b) {
      var t = self.get(choice(b, 'ability'));
      if (t) (guards[t.id] = guards[t.id] || []).push(b);
    });

    // 3. Attacks — Mafia, Serial Killer, Vigilante
    var attacks = [];
    var hit = this.mafiaTarget();
    if (hit) attacks.push({ attacker: this.get(hit.hitmanId), target: this.get(hit.targetId), cause: 'mafia' });
    byRole('serial_killer').forEach(function (k) {
      var t = self.get(choice(k, 'ability'));
      if (t) attacks.push({ attacker: k, target: t, cause: 'serial_killer' });
    });
    byRole('vigilante').forEach(function (v) {
      var t = self.get(choice(v, 'ability'));
      if (!t) return;
      v.usesLeft.shoot = 0;
      attacks.push({ attacker: v, target: t, cause: 'vigilante' });
    });

    function kill(victim, cause, attacker) {
      if (dying[victim.id]) return;
      dying[victim.id] = cause;
      report.deaths.push({ id: victim.id, cause: cause });
      if (attacker && attacker.id !== victim.id) {
        attacker.stats.kills += 1;
        if (self.teamOf(attacker) !== self.teamOf(victim) || attacker.role === 'serial_killer') attacker.stats.score += 2;
      }
    }

    attacks.forEach(function (a) {
      var t = a.target;
      if (!t || dying[t.id]) return;
      var gs = (guards[t.id] || []).filter(function (b) { return !dying[b.id]; });
      if (gs.length) {
        var bg = gs[0];
        guards[t.id] = gs.slice(1);
        kill(bg, 'bodyguard', a.attacker);
        kill(a.attacker, 'bodyguard_counter', bg);
        bg.stats.saves += 1; bg.stats.score += 3;
        self.log(t, 'You were attacked last night, but a bodyguard fought off your attacker!', 'saved');
        return;
      }
      if (heals[t.id] > 0) {
        heals[t.id] -= 1;
        report.saves += 1;
        (healers[t.id] || []).forEach(function (d) { d.stats.saves += 1; d.stats.score += 3; self.log(d, 'Your patient ' + t.name + ' was attacked — and you saved them!', 'saved'); });
        self.log(t, 'You were attacked last night, but a doctor nursed you back to health!', 'saved');
        return;
      }
      kill(t, a.cause, a.attacker);
      if (healers[t.id]) report.docFailed.push(t.id);
    });

    // 4. Investigations (results arrive even if the investigator died tonight)
    byRole('detective').forEach(function (d) {
      var t = self.get(choice(d, 'ability'));
      if (!t) return;
      var evil = framed[t.id] || ROLES[t.role].appearsEvil;
      d.inspected[t.id] = evil ? 'suspicious' : 'innocent';
      if (evil && (self.isMafia(t) || t.role === 'serial_killer')) { d.stats.finds += 1; d.stats.score += 2; }
      self.log(d, '🔍 ' + t.name + ' is ' + (evil ? 'SUSPICIOUS — they side with evil.' : 'INNOCENT — they seem trustworthy.'), evil ? 'evil' : 'good');
    });
    byRole('consigliere').forEach(function (c) {
      var t = self.get(choice(c, 'ability'));
      if (!t) return;
      var r = ROLES[t.role];
      c.inspected[t.id] = t.role;
      self.log(c, '📜 ' + t.name + ' is ' + article(r.name) + ' ' + r.name + ' ' + r.icon + '.', 'intel');
    });
    byRole('medium').forEach(function (m) {
      var t = self.get(choice(m, 'ability'));
      if (!t) return;
      m.usesLeft.seance = 0;
      var r = ROLES[t.role];
      self.log(m, '🔮 The spirit of ' + t.name + ' answers: in life they were ' + article(r.name) + ' ' + r.name + ' ' + r.icon + '.', 'intel');
      var evil = alive.filter(function (x) { return !dying[x.id] && (self.isMafia(x) || x.role === 'serial_killer'); });
      var good = alive.filter(function (x) { return !dying[x.id] && x.id !== m.id && evil.indexOf(x) < 0; });
      if (evil.length && good.length) {
        var pair = shuffle([pick(evil, self.rng), pick(good, self.rng)], self.rng);
        self.log(m, '👻 It whispers: "One of ' + pair[0].name + ' or ' + pair[1].name + ' walks with evil..."', 'intel');
      }
    });

    // 5. Apply deaths
    report.deaths.forEach(function (d) {
      var p = self.get(d.id);
      p.alive = false; p.deathDay = self.day; p.deathCause = d.cause;
      self.timeline.push({ day: self.day, phase: 'night', text: p.name + ' died in the night.' });
      self.systemChat('dead', p.name + ' has joined the graveyard. 👻');
    });

    // Executioners whose target died at night become Jesters.
    this.players.forEach(function (p) {
      if (p.alive && p.role === 'executioner' && p.exeTargetId && dying[p.exeTargetId]) {
        p.role = 'jester';
        self.log(p, 'Your target died in the night. Bitterness consumes you — you are now a Jester. Get yourself lynched!', 'target');
      }
    });

    // Silenced announcement only for living silenced players.
    report.silenced = alive.filter(function (p) { return p.silencedDay === self.day && !dying[p.id]; }).map(function (p) { return p.id; });
    this.startDawn(report);
  };

  // ───────────────────────── Day ─────────────────────────

  G.startDawn = function (report) {
    var self = this, rng = this.rng;
    var lines = [pick(STORY.weather, rng) + '...'];
    var deaths = report.deaths.map(function (d) {
      var p = self.get(d.id);
      var role = self.settings.revealRoles ? describeRole(p.role) : null;
      return { id: p.id, name: p.name, avatar: p.avatar, cause: d.cause, role: role };
    });
    if (!deaths.length) lines.push(pick(STORY.quiet, rng));
    deaths.forEach(function (d) {
      lines.push(d.name + ' was found dead ' + pick(STORY.places, rng) + '.');
      lines.push(pick(STORY.cause[d.cause] || STORY.cause.mafia, rng));
      if (report.docFailed.indexOf(d.id) >= 0) lines.push(pick(STORY.docFailed, rng));
      if (d.role) lines.push('They were ' + article(d.role.name) + ' ' + d.role.name + ' ' + d.role.icon + '.');
    });
    if (report.saves) lines.push(pick(STORY.saved, rng));
    report.silenced.forEach(function (id) { lines.push(self.get(id).name + ' wakes up unable to say a single word. 🤐'); });
    lines.push(this.day === 1 ? 'The town gathers in the square. Who among you can be trusted?' : 'Day ' + this.day + '. The town gathers once more.');

    this.dawn = { day: this.day, lines: lines, deaths: deaths, silenced: report.silenced, saves: report.saves };
    this.announcement = lines[lines.length - 1];
    lines.forEach(function (l) { self.systemChat('day', l, 'story'); });
    this.pendingWinner = this.checkWinner();
    // Long enough for the narrator to read every line aloud (~2.4 words a second).
    this.setPhase('dawn', Math.min(55, 5 + lines.reduce(function (t, l) { return t + l.split(' ').length / 2.4 + 0.8; }, 0)));
    this.chatReset();
  };

  G.startDiscussion = function () {
    this.players.forEach(function (p) { p.ready = false; });
    this.announcement = 'Discuss. Accuse. Lie, if you must.';
    this.setPhase('discussion', this.settings.timers.discussion);
  };

  G.startVoting = function () {
    this.votes = {};
    this.announcement = 'Cast your ballots. Who goes on trial?';
    this.systemChat('day', '🗳️ Voting has begun.');
    this.setPhase('voting', this.settings.timers.voting);
  };

  /** targetId: player id, 'skip', or null to withdraw. */
  G.castVote = function (id, targetId) {
    var p = this.get(id);
    if (this.phase !== 'voting') return { error: 'Voting is closed.' };
    if (!p || !p.alive) return { error: 'The dead cannot vote.' };
    if (targetId === null) delete this.votes[id];
    else if (targetId === 'skip') this.votes[id] = 'skip';
    else {
      var t = this.get(targetId);
      if (!t || !t.alive || t.id === id) return { error: 'Invalid vote.' };
      this.votes[id] = targetId;
    }
    var alive = this.living(), self = this;
    if (alive.every(function (x) { return self.votes[x.id]; })) this.hurry(2.5);
    this.sync();
    return { ok: true };
  };

  G.tally = function () {
    var tally = {}, skip = 0, self = this;
    Object.keys(this.votes).forEach(function (v) {
      var t = self.votes[v];
      if (!self.get(v) || !self.get(v).alive) return;
      if (t === 'skip') skip++; else tally[t] = (tally[t] || 0) + 1;
    });
    return { tally: tally, skip: skip };
  };

  G.endVoting = function () {
    var self = this, r = this.tally();
    var best = 0, top = [];
    Object.keys(r.tally).forEach(function (k) {
      self.get(k).stats.votesReceived += r.tally[k];
      if (r.tally[k] > best) { best = r.tally[k]; top = [k]; } else if (r.tally[k] === best) top.push(k);
    });
    // Reward voters who pointed at real evil.
    Object.keys(this.votes).forEach(function (v) {
      var t = self.get(self.votes[v]);
      if (t && (self.isMafia(t) || t.role === 'serial_killer') && !self.isMafia(self.get(v))) self.get(v).stats.goodVotes += 1;
    });
    if (top.length !== 1 || best <= r.skip) {
      this.verdict = { noTrial: true, text: pick(STORY.noTrial, this.rng) };
      this.announcement = this.verdict.text;
      this.systemChat('day', this.verdict.text, 'story');
      this.pendingWinner = null;
      this.setPhase('verdict', 7);
      return;
    }
    this.accusedId = top[0];
    var accused = this.get(this.accusedId);
    this.announcement = fill(pick(STORY.trial, this.rng), { name: accused.name });
    this.systemChat('day', '⚖️ ' + this.announcement, 'story');
    this.timeline.push({ day: this.day, phase: 'trial', text: accused.name + ' was put on trial (' + best + ' votes).' });
    this.setPhase('defense', this.settings.timers.defense);
  };

  G.startJudgment = function () {
    this.judgments = {};
    var accused = this.get(this.accusedId);
    this.announcement = 'Guilty or innocent? Decide the fate of ' + accused.name + '.';
    this.setPhase('judgment', this.settings.timers.judgment);
  };

  G.castJudgment = function (id, verdict) {
    var p = this.get(id);
    if (this.phase !== 'judgment') return { error: 'There is no trial right now.' };
    if (!p || !p.alive) return { error: 'The dead cannot judge.' };
    if (id === this.accusedId) return { error: 'You cannot judge yourself.' };
    if (verdict === 'guilty' || verdict === 'innocent') this.judgments[id] = verdict;
    else if (verdict === null) delete this.judgments[id];
    else return { error: 'Invalid verdict.' };
    var self = this;
    var voters = this.living().filter(function (x) { return x.id !== self.accusedId; });
    if (voters.every(function (x) { return self.judgments[x.id]; })) this.hurry(2);
    this.sync();
    return { ok: true };
  };

  G.endJudgment = function () {
    var self = this;
    var accused = this.get(this.accusedId);
    var guilty = [], innocent = [];
    Object.keys(this.judgments).forEach(function (v) {
      if (!self.get(v) || !self.get(v).alive) return;
      (self.judgments[v] === 'guilty' ? guilty : innocent).push(v);
    });
    var executed = guilty.length > innocent.length;
    var evil = this.isMafia(accused) || accused.role === 'serial_killer';
    guilty.forEach(function (v) { var p = self.get(v); if (evil && !self.isMafia(p)) { p.stats.goodVotes += 1; } });
    var role = executed && this.settings.revealRoles ? describeRole(accused.role) : null;
    var text;
    if (executed) {
      text = fill(pick(STORY.executed, this.rng), { name: accused.name });
      if (role) text += ' They were ' + article(role.name) + ' ' + role.name + ' ' + role.icon + '.';
      accused.alive = false; accused.deathDay = this.day; accused.deathCause = 'lynch';
      this.timeline.push({ day: this.day, phase: 'verdict', text: accused.name + ' was executed (' + guilty.length + '–' + innocent.length + ').' });
      this.systemChat('dead', accused.name + ' has joined the graveyard. 👻');
      if (accused.role === 'jester') this.neutralWin(accused, 'tricked the town into a hanging! 🃏');
      this.players.forEach(function (p) {
        if (p.alive && p.role === 'executioner' && p.exeTargetId === accused.id) self.neutralWin(p, 'got their target lynched! ⚖️');
      });
    } else {
      text = fill(pick(STORY.spared, this.rng), { name: accused.name });
      this.timeline.push({ day: this.day, phase: 'verdict', text: accused.name + ' was spared (' + guilty.length + '–' + innocent.length + ').' });
    }
    this.verdict = {
      accusedId: accused.id, name: accused.name, avatar: accused.avatar, executed: executed, role: role,
      guilty: guilty, innocent: innocent, text: text,
      jester: executed && accused.role === 'jester'
    };
    this.announcement = text;
    this.systemChat('day', (executed ? '⚰️ ' : '🕊️ ') + text, 'story');
    this.pendingWinner = executed ? this.checkWinner() : null;
    this.setPhase('verdict', executed ? 12 : 8);
    if (executed) this.chatReset();
  };

  G.neutralWin = function (p, reason) {
    if (this.neutralWins.some(function (w) { return w.id === p.id; })) return;
    this.neutralWins.push({ id: p.id, role: p.role, reason: reason });
    p.stats.score += 5;
    this.log(p, 'You have won! You ' + reason, 'win');
    this.systemChat('day', '🏆 ' + p.name + ' ' + reason, 'story');
  };

  // ───────────────────────── Win conditions ─────────────────────────

  G.checkWinner = function () {
    var self = this;
    var alive = this.living();
    var mafia = alive.filter(function (p) { return self.isMafia(p); }).length;
    var sk = alive.filter(function (p) { return p.role === 'serial_killer'; }).length;
    var town = alive.filter(function (p) { return self.teamOf(p) === 'town'; }).length;
    if (!alive.length) return this.drawResult('Not a soul is left standing. The town is a graveyard.');
    if (!mafia && !sk) {
      if (!town) return this.drawResult('The killers are gone, but so is the town. Nobody wins.');
      return { team: 'town', title: 'The Town Wins', text: 'Every threat has been rooted out. The streets are safe again — for now.' };
    }
    if (sk && !mafia && alive.length - sk <= 1) {
      return { team: 'serial_killer', title: 'The Serial Killer Wins', text: 'In the end, only the killer remained. The town never stood a chance.' };
    }
    if (!sk && mafia >= alive.length - mafia) {
      return { team: 'mafia', title: 'The Mafia Wins', text: 'The family now runs this town. Nobody is left to stop them.' };
    }
    return null;
  };

  G.drawResult = function (text) { return { team: 'none', title: 'Nobody Wins', text: text }; };

  G.endGame = function (result) {
    var self = this;
    this.clearTimers();
    this.phase = 'gameover';
    this.phaseEndsAt = 0;
    var winners = this.players.filter(function (p) {
      if (self.neutralWins.some(function (w) { return w.id === p.id; })) return true;
      if (result.team === 'serial_killer') return p.role === 'serial_killer' && p.alive;
      return self.teamOf(p) === result.team;
    }).map(function (p) { return p.id; });
    this.players.forEach(function (p) {
      if (winners.indexOf(p.id) >= 0) p.stats.score += 5;
      if (p.alive) p.stats.score += 1;
      p.stats.score += p.stats.goodVotes;
    });
    this.winner = {
      team: result.team, title: result.title, text: result.text, winners: winners,
      neutralWins: this.neutralWins.slice(), awards: this.awards()
    };
    this.announcement = result.title;
    this.timeline.push({ day: this.day, phase: 'gameover', text: result.title + '.' });
    this.systemChat('day', '🏁 ' + result.title + '. ' + result.text, 'story');
    this.systemChat('lobby', '🏁 ' + result.title + '.');
    this.chatReset();
  };

  G.awards = function () {
    function top(key) {
      var best = null;
      this.players.forEach(function (p) { if (p.stats[key] > 0 && (!best || p.stats[key] > best.stats[key])) best = p; });
      return best ? { id: best.id, value: best.stats[key] } : null;
    }
    var mvp = this.players.slice().sort(function (a, b) { return b.stats.score - a.stats.score; })[0];
    return {
      mvp: mvp ? { id: mvp.id, value: mvp.stats.score } : null,
      mostAccused: top.call(this, 'votesReceived'),
      deadliest: top.call(this, 'kills'),
      guardian: top.call(this, 'saves')
    };
  };

  // ───────────────────────── Chat & reactions ─────────────────────────

  G.systemChat = function (channel, text, kind) {
    var msg = { id: ++this.msgSeq, channel: channel, system: true, kind: kind || 'system', text: text, at: this.now() };
    this.pushChat(msg);
  };

  G.mafiaNotice = function (text) {
    this.pushChat({ id: ++this.msgSeq, channel: 'mafia', system: true, kind: 'system', text: text, at: this.now() });
  };

  G.pushChat = function (msg) {
    var list = this.chat[msg.channel];
    list.push(msg);
    if (list.length > 150) list.shift();
    var self = this;
    var recipients = this.players.filter(function (p) { return self.canRead(p, msg.channel); }).map(function (p) { return p.id; });
    if (this.hooks.chat) this.hooks.chat(msg, recipients);
  };

  G.isSilenced = function (p) {
    return p.silencedDay === this.day && (this.phase in DAY_TALK || this.phase === 'defense');
  };

  G.canRead = function (p, channel) {
    if (!p) return false;
    switch (channel) {
      case 'lobby': return true;
      case 'day': return this.inGame();
      case 'mafia': return this.inGame() && (this.isMafia(p) || this.phase === 'gameover');
      case 'dead': return this.inGame() && (!p.alive || p.role === 'medium' || this.phase === 'gameover');
      default: return false;
    }
  };

  G.canWrite = function (p, channel) {
    if (!p) return false;
    var ph = this.phase;
    switch (channel) {
      case 'lobby': return ph === 'lobby' || ph === 'gameover';
      case 'day':
        if (!p.alive || this.isSilenced(p)) return false;
        if (ph === 'defense') return p.id === this.accusedId;
        return ph in DAY_TALK || ph === 'roles';
      case 'mafia': return p.alive && this.isMafia(p) && ph === 'night';
      case 'dead': return (!p.alive && this.inGame() && ph !== 'gameover') || (p.alive && p.role === 'medium' && ph === 'night');
      default: return false;
    }
  };

  G.say = function (id, channel, text) {
    var p = this.get(id);
    text = cleanText(text, 280);
    if (!text) return { error: 'Empty message.' };
    if (!this.chat[channel]) return { error: 'Unknown channel.' };
    if (!this.canWrite(p, channel)) {
      if (p && this.isSilenced(p) && channel === 'day') return { error: 'You have been silenced. 🤐' };
      return { error: 'You cannot speak there right now.' };
    }
    var anonymousMedium = channel === 'dead' && p.alive && p.role === 'medium';
    this.pushChat({
      id: ++this.msgSeq, channel: channel, at: this.now(), text: text,
      from: anonymousMedium ? null : p.id,
      name: anonymousMedium ? 'The Medium' : p.name,
      avatar: anonymousMedium ? '🔮' : p.avatar
    });
    return { ok: true };
  };

  G.react = function (id, emoji, targetId) {
    var p = this.get(id);
    if (!p || REACTIONS.indexOf(emoji) < 0) return { error: 'Invalid reaction.' };
    if (this.inGame() && this.phase !== 'gameover' && (!p.alive || this.isSilenced(p))) return { error: 'You cannot react right now.' };
    var t = this.now();
    if (this.lastReact[id] && t - this.lastReact[id] < 600) return { error: 'Slow down.' };
    this.lastReact[id] = t;
    var target = targetId && this.get(targetId) ? targetId : null;
    if (this.hooks.fx) this.hooks.fx(null, { type: 'reaction', emoji: emoji, from: id, target: target });
    return { ok: true };
  };

  G.chatHistoryFor = function (id) {
    var p = this.get(id), self = this, out = {};
    Object.keys(this.chat).forEach(function (ch) { if (self.canRead(p, ch)) out[ch] = self.chat[ch].slice(-80); });
    return out;
  };

  // ───────────────────────── Bots ─────────────────────────

  G.scheduleBots = function () {
    var self = this;
    var dur = this.phaseDuration * 1000;
    this.players.forEach(function (bot) {
      if (!bot.isBot) return;
      var delay = function (lo, hi) { return self.botSpeed * Math.min(dur * 0.8, lo + self.rng() * (hi - lo)); };
      var later = function (ms, fn) { self.botTimers.push(self.timers.set(function () { try { fn(); } catch (e) { /* bots never crash the game */ } }, ms)); };
      switch (self.phase) {
        case 'roles': later(delay(1500, 4000), function () { self.setReady(bot.id); }); break;
        case 'night':
          if (!bot.alive) return;
          self.actionsFor(bot).forEach(function (a, i) {
            later(delay(2500 + i * 1200, 9000), function () { self.botNight(bot, a.key); });
          });
          if (self.isMafia(bot) && self.rng() < 0.5) later(delay(4000, 12000), function () { self.botSay(bot, 'mafia'); });
          break;
        case 'discussion':
          if (!bot.alive) return;
          if (bot.role === 'detective' && self.rng() < 0.75) later(delay(2000, 9000), function () { self.botClaim(bot); });
          else if (self.rng() < 0.7) later(delay(2500, 20000), function () { self.botSay(bot, 'day'); });
          later(delay(10000, 45000), function () { if (!bot.ready) self.setReady(bot.id); });
          break;
        case 'voting':
          if (bot.alive) later(delay(3000, 15000), function () { self.castVote(bot.id, self.botVote(bot)); });
          break;
        case 'defense':
          if (bot.id === self.accusedId) later(delay(2000, 6000), function () { self.botSay(bot, 'day', 'defense'); });
          break;
        case 'judgment':
          if (bot.alive && bot.id !== self.accusedId) later(delay(2000, 9000), function () { self.castJudgment(bot.id, self.botJudge(bot)); });
          break;
      }
    });
  };

  G.botNight = function (bot, key) {
    if (this.phase !== 'night' || !bot.alive) return;
    var action = this.actionsFor(bot).filter(function (a) { return a.key === key; })[0];
    if (!action) return;
    var self = this, targets = action.targets.slice(), t = null;
    if (key === 'kill') {
      var mates = this.living().filter(function (m) { return self.isMafia(m) && m.id !== bot.id; });
      var follow = mates.map(function (m) { return self.nightChoices(m).kill; }).filter(Boolean)[0];
      var claimers = Object.keys(this.claims).map(function (k) { return self.claims[k]; }).filter(function (id) { return targets.indexOf(id) >= 0; });
      t = follow && targets.indexOf(follow) >= 0 ? follow : claimers.length ? claimers[0] : pick(targets, this.rng);
    } else if (action.type === 'inspect' || action.type === 'scout') {
      var fresh = targets.filter(function (id) { return !bot.inspected[id]; });
      t = pick(fresh.length ? fresh : targets, this.rng);
    } else if (action.type === 'heal' || action.type === 'guard') {
      var vip = Object.keys(this.claims).map(function (k) { return self.claims[k]; }).filter(function (id) { return targets.indexOf(id) >= 0; });
      if (vip.length && this.rng() < 0.7) t = vip[0];
      else if (action.type === 'heal' && targets.indexOf(bot.id) >= 0 && this.rng() < 0.3) t = bot.id;
      else t = pick(targets, this.rng);
    } else if (action.type === 'shoot') {
      var sus = this.botSuspects(bot).filter(function (id) { return targets.indexOf(id) >= 0; });
      t = sus.length ? sus[0] : (this.day >= 2 && this.rng() < 0.25 ? pick(targets, this.rng) : null);
    } else {
      t = pick(targets, this.rng);
    }
    this.nightAction(bot.id, key, t);
  };

  /** A bot Detective goes public with a Suspicious result. */
  G.botClaim = function (bot) {
    var self = this;
    var sus = Object.keys(bot.inspected).filter(function (id) { return bot.inspected[id] === 'suspicious' && self.get(id).alive && !self.claims[id]; })[0];
    if (!sus) return;
    this.claims[sus] = bot.id;
    this.say(bot.id, 'day', pick(['I\u2019m the Detective. {name} came up SUSPICIOUS last night!', 'Listen to me — I investigated {name}. They\u2019re evil.',
      'Detective here. Vote {name}. Trust me.'], this.rng).replace('{name}', this.get(sus).name));
  };

  /** Living players a bot believes are evil: its own results, plus public claims it trusts. */
  G.botSuspects = function (bot) {
    var self = this;
    var known = Object.keys(bot.inspected).filter(function (id) { return bot.inspected[id] === 'suspicious'; });
    if (!this.isMafia(bot)) {
      Object.keys(this.claims).forEach(function (id) { if (self.claims[id] !== bot.id && known.indexOf(id) < 0) known.push(id); });
    }
    return known.filter(function (id) { var p = self.get(id); return p && p.alive && id !== bot.id; });
  };

  G.botVote = function (bot) {
    var self = this;
    var alive = this.living().filter(function (p) { return p.id !== bot.id; });
    if (!alive.length) return 'skip';
    if (bot.role === 'executioner' && this.get(bot.exeTargetId) && this.get(bot.exeTargetId).alive) return bot.exeTargetId;
    var pool = this.isMafia(bot) ? alive.filter(function (p) { return !self.isMafia(p); }) : alive;
    var known = this.isMafia(bot) ? [] : this.botSuspects(bot);
    if (known.length && this.rng() < 0.85) return known[0];
    if (!pool.length) return 'skip';
    var r = this.tally().tally;
    var leader = Object.keys(r).filter(function (id) { return pool.some(function (p) { return p.id === id; }); })
      .sort(function (a, b) { return r[b] - r[a]; })[0];
    var roll = this.rng();
    // Mafia bots blend in instead of block-voting; town bots bandwagon less and skip more.
    if (leader && roll < (this.isMafia(bot) ? 0.4 : 0.35)) return leader;
    if (roll > (this.isMafia(bot) ? 0.9 : 0.75)) return 'skip';
    return pick(this.isMafia(bot) && this.rng() < 0.3 ? alive : pool, this.rng).id;
  };

  G.botJudge = function (bot) {
    var accused = this.get(this.accusedId);
    if (!accused) return 'innocent';
    if (this.isMafia(bot)) return this.isMafia(accused) ? 'innocent' : 'guilty';
    if (bot.role === 'executioner' && bot.exeTargetId === accused.id) return 'guilty';
    if (this.botSuspects(bot).indexOf(accused.id) >= 0) return 'guilty';
    if (bot.inspected[accused.id] === 'innocent') return 'innocent';
    return this.rng() < 0.5 ? 'guilty' : 'innocent';
  };

  G.botSay = function (bot, channel, kind) {
    var self = this;
    var others = this.living().filter(function (p) {
      return p.id !== bot.id && (channel !== 'mafia' || !self.isMafia(p));
    });
    if (!others.length) return;
    var lines = kind === 'defense' ? BOT_LINES.defense
      : channel === 'mafia' ? BOT_LINES.mafia
      : bot.role === 'jester' && this.rng() < 0.6 ? BOT_LINES.jester : BOT_LINES.discussion;
    this.say(bot.id, channel, fill(pick(lines, this.rng), { name: pick(others, this.rng).name }));
  };

  // ───────────────────────── Views (the privacy boundary) ─────────────────────────

  G.roleVisibleTo = function (viewer, p) {
    if (!p.role) return false;
    if (this.phase === 'gameover') return true;
    if (viewer && viewer.id === p.id) return true;
    if (viewer && this.isMafia(viewer) && this.isMafia(p)) return true;
    if (!p.alive && this.settings.revealRoles) return true;
    return false;
  };

  G.viewFor = function (id) {
    var self = this, me = this.get(id);
    var ph = this.phase;
    var showVotes = ph === 'voting' || ph === 'defense' || ph === 'judgment' || ph === 'verdict';
    var players = this.players.map(function (p) {
      return {
        id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot, connected: p.connected,
        isHost: p.id === self.hostId, alive: p.alive,
        silenced: self.inGame() && p.alive && self.isSilenced(p),
        ready: !!p.ready,
        deathDay: p.deathDay,
        deathCause: p.alive ? null : (p.deathCause === 'lynch' ? 'lynch' : 'night'),
        role: self.roleVisibleTo(me, p) ? describeRole(p.role) : null,
        vote: showVotes && self.votes[p.id] ? self.votes[p.id] : null,
        mafiaMate: !!(me && p.id !== me.id && self.isMafia(me) && self.isMafia(p))
      };
    });

    var view = {
      code: this.code, phase: ph, day: this.day,
      phaseEndsAt: this.phaseEndsAt, phaseDuration: this.phaseDuration, serverNow: this.now(),
      hostId: this.hostId, settings: this.settings,
      limits: { min: MIN_PLAYERS, max: MAX_PLAYERS, timers: TIMER_LIMITS },
      players: players,
      announcement: this.announcement,
      reactions: REACTIONS,
      me: null
    };

    if (showVotes) {
      var t = this.tally();
      view.vote = { tally: t.tally, skip: t.skip };
    }
    if (this.accusedId && (ph === 'defense' || ph === 'judgment' || ph === 'verdict')) {
      view.trial = {
        accusedId: this.accusedId,
        judgedCount: Object.keys(this.judgments).length,
        voterCount: this.living().filter(function (p) { return p.id !== self.accusedId; }).length
      };
    }
    if (ph === 'dawn' && this.dawn) view.dawn = this.dawn;
    if (ph === 'verdict' && this.verdict) view.verdict = this.verdict;
    if (ph === 'gameover' && this.winner) {
      view.winner = this.winner;
      view.stats = this.players.map(function (p) {
        return { id: p.id, kills: p.stats.kills, votesReceived: p.stats.votesReceived, saves: p.stats.saves, finds: p.stats.finds, score: p.stats.score,
          originalRole: p.originalRole !== p.role ? describeRole(p.originalRole) : null };
      });
      view.timeline = this.timeline;
    }

    if (me) {
      var mine = {
        id: me.id, alive: me.alive, isHost: me.id === this.hostId,
        role: me.role ? describeRole(me.role) : null,
        log: me.log,
        canWrite: {}, canRead: {},
        silenced: this.inGame() && me.alive && this.isSilenced(me),
        ready: !!me.ready
      };
      Object.keys(this.chat).forEach(function (ch) { mine.canWrite[ch] = self.canWrite(me, ch); mine.canRead[ch] = self.canRead(me, ch); });
      if (me.exeTargetId && me.role === 'executioner') {
        var tgt = this.get(me.exeTargetId);
        mine.target = { id: tgt.id, name: tgt.name };
      }
      if (ph === 'night') {
        mine.actions = this.actionsFor(me);
        mine.choices = this.nightChoices(me);
        mine.nightDone = this.isNightDone(me);
        if (this.isMafia(me)) {
          var votes = {};
          this.living().forEach(function (m) { if (self.isMafia(m)) { var c = self.nightChoices(m).kill; if (c !== undefined) votes[m.id] = c; } });
          mine.mafiaVotes = votes;
        }
      }
      if (ph === 'voting') mine.vote = this.votes[me.id] || null;
      if (ph === 'judgment') mine.judgment = this.judgments[me.id] || null;
      if (ph === 'gameover' && this.winner) mine.won = this.winner.winners.indexOf(me.id) >= 0;
      mine.neutralWon = this.neutralWins.some(function (w) { return w.id === me.id; });
      view.me = mine;
    }
    return view;
  };

  // ───────────────────────── Command dispatcher ─────────────────────────

  /** Single entry point for transports: every client message is { type, ... }. Inputs are untrusted. */
  G.command = function (id, c) {
    if (!c || typeof c !== 'object' || !this.get(id)) return { error: 'Bad command.' };
    var str = function (v) { return v == null ? null : String(v).slice(0, 64); };
    switch (c.type) {
      case 'settings': return this.updateSettings(id, c.settings);
      case 'addBot': return this.addBot(id);
      case 'kick': return this.removePlayer(str(c.playerId), id);
      case 'start': return this.start(id);
      case 'ready': return this.setReady(id);
      case 'night': return this.nightAction(id, str(c.key), str(c.target));
      case 'vote': return this.castVote(id, str(c.target));
      case 'judge': return this.castJudgment(id, str(c.verdict));
      case 'chat': return this.say(id, str(c.channel), c.text);
      case 'react': return this.react(id, str(c.emoji), str(c.target));
      case 'lobby': return this.returnToLobby(id);
      default: return { error: 'Unknown command.' };
    }
  };

  G.destroy = function () { this.clearTimers(); this.hooks = {}; };

  return {
    TEAMS: TEAMS, ROLES: ROLES, ROLE_GROUPS: ROLE_GROUPS, DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    TIMER_LIMITS: TIMER_LIMITS, MIN_PLAYERS: MIN_PLAYERS, MAX_PLAYERS: MAX_PLAYERS, REACTIONS: REACTIONS, AVATARS: AVATARS,
    PHASES: PHASES, describeRole: describeRole, buildRoleList: buildRoleList, sanitizeSettings: sanitizeSettings,
    MafiaGame: MafiaGame
  };
});
