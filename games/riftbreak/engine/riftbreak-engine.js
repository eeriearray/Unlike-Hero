/*!
 * RIFTBREAK engine — rules, match state machine, lobby/session and bots.
 *
 * One file, two homes:
 *   • Node (games/riftbreak/server/index.mjs) runs it as the authoritative online server.
 *   • Browsers load it as a classic <script> (window.RiftEngine) for offline games against bots.
 *
 * Layers (each only knows about the ones above it):
 *   data tables   SUITS, CARD_TYPES, RULES, COLLAPSES, STAGES — the rulebook and the in-game help read these
 *   isLegal()     pure legality check from public table state; the UI, the engine and the bots all use it
 *   Match         one round: deck, hands, turn order, Rifts, Meltdown, attacks, win. Deterministic for a seed.
 *   Bots          choose a command from a player's own view only (never the hidden state)
 *   RiftGame      seats, host settings, bots, timers, disconnect autopilot, rematches. Transports talk to this.
 *
 * viewFor(id) is the only way state leaves the engine; it holds that player's own hand and nothing hidden.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RiftEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ───────────────────────────────────────── Data tables ─────────────────────────────────────────

  var SUITS = ['cyan', 'crimson', 'gold', 'violet'];
  var SUIT_INFO = {
    cyan: { id: 'cyan', name: 'Cyan', hex: '#2fe6ff', opposite: 'crimson' },
    crimson: { id: 'crimson', name: 'Crimson', hex: '#ff3d6e', opposite: 'cyan' },
    gold: { id: 'gold', name: 'Gold', hex: '#ffc23d', opposite: 'violet' },
    violet: { id: 'violet', name: 'Violet', hex: '#a46bff', opposite: 'gold' }
  };

  // perSuit: copies in each suit; wild: copies with no suit.
  var CARD_TYPES = {
    num: { id: 'num', name: 'Number', short: 'Match the color or number.' },
    skip: { id: 'skip', name: 'Skip', perSuit: 2, short: 'The next player loses their turn.' },
    reverse: { id: 'reverse', name: 'Reverse', perSuit: 2, short: 'Turn order flips. With two players it acts as a Skip.' },
    surge: { id: 'surge', name: 'Surge', perSuit: 2, attack: 2, short: 'Attack: +2 cards to the next player. Meltdown +1.' },
    stabilize: { id: 'stabilize', name: 'Stabilize', perSuit: 1, short: 'Meltdown −2. Play it on any attack to take only half.' },
    rift: { id: 'rift', name: 'Rift', perSuit: 1, short: 'Shift reality to the next Reality Rule. Meltdown +1.' },
    wild: { id: 'wild', name: 'Wild', wild: 4, short: 'Choose the active color.' },
    overload: { id: 'overload', name: 'Overload', wild: 4, attack: 4, short: 'Choose a color. Attack: +4 cards. Meltdown +1.' },
    wildrift: { id: 'wildrift', name: 'Wild Rift', wild: 2, short: 'Choose a color and shift reality. Meltdown +1.' }
  };
  var WILD_KINDS = { wild: 1, overload: 1, wildrift: 1 };
  var ATTACK_KINDS = { surge: 1, overload: 1 };

  // The Reality Rule pool. `tone` is shown as a hint: what the rule tends to reward.
  var RULES = {
    stable: { id: 'stable', name: 'Stable', text: 'Normal rules: match the color, number or symbol.', tone: 'baseline', glyph: 'stable' },
    odd_world: { id: 'odd_world', name: 'Odd World', text: 'Only odd numbers can be played. Action and Wild cards still work.', tone: 'hand management', glyph: 'odd' },
    color_lock: { id: 'color_lock', name: 'Color Lock', text: 'Matching a number or symbol no longer counts — you must match the color.', tone: 'hand management', glyph: 'lock' },
    echo: { id: 'echo', name: 'Echo', text: 'A number one step from the top number (4 → 3 or 5) can be played on any color.', tone: 'flexibility', glyph: 'echo' },
    aftershock: { id: 'aftershock', name: 'Aftershock', text: 'Every non-number card played raises Meltdown by 1.', tone: 'danger', glyph: 'shock' },
    low_gravity: { id: 'low_gravity', name: 'Low Gravity', text: 'Playing a lower number raises Meltdown by 1; a higher number lowers it by 1.', tone: 'Meltdown control', glyph: 'gravity' },
    hot_potato: { id: 'hot_potato', name: 'Hot Potato', text: 'If you draw instead of playing and still don’t play, draw 1 more.', tone: 'aggression', glyph: 'potato' },
    mirror: { id: 'mirror', name: 'Mirror', text: 'At the end of every turn the active color flips to its opposite (Cyan ↔ Crimson, Gold ↔ Violet).', tone: 'planning', glyph: 'mirror' },
    spotlight: { id: 'spotlight', name: 'Spotlight', text: 'Players holding 3 or fewer cards draw 2 instead of 1 when they draw on their turn.', tone: 'catch-up', glyph: 'spot' },
    open_fire: { id: 'open_fire', name: 'Open Fire', text: 'Surge cards can be played on any card.', tone: 'aggression', glyph: 'fire' }
  };
  var RULE_POOL = ['odd_world', 'color_lock', 'echo', 'aftershock', 'low_gravity', 'hot_potato', 'mirror', 'spotlight', 'open_fire'];
  var QUEUE_SIZE = 6;

  var COLLAPSES = {
    shockwave: { id: 'shockwave', name: 'Shockwave', text: 'Every player except the one who caused the collapse draws 1.' },
    gravity_well: { id: 'gravity_well', name: 'Gravity Well', text: 'The player(s) holding the fewest cards draw 2.' },
    fracture: { id: 'fracture', name: 'Reality Fracture', text: 'Reality shifts to the next rule in the queue.' },
    chain: { id: 'chain', name: 'Chain Reaction', text: 'The next attack card played adds +2 more.' }
  };
  var COLLAPSE_IDS = ['shockwave', 'gravity_well', 'fracture', 'chain'];

  var STAGES = [
    { id: 'unstable', name: 'Unstable', min: 0, max: 3, text: 'Normal play.' },
    { id: 'critical', name: 'Critical', min: 4, max: 6, text: 'Rift cards can be played on any card.' },
    { id: 'breaking', name: 'Breaking', min: 7, max: 9, text: 'Rift cards can be played on any card, and every attack adds +1.' }
  ];

  var LIMITS = {
    hand: 7, stackCap: 10, meltdownStart: 2, meltdownMax: 10, meltdownReset: 3, handCap: 25, turnLimit: 600,
    blockStabilize: -2, rift: 1, overload: 1, surge: 1, overcharge: 1, zero: -1, chain: 2, breakingBonus: 1
  };
  var MIN_PLAYERS = 2, MAX_PLAYERS = 8;
  var LEVELS = ['easy', 'normal', 'hard'];
  var TIMERS = [0, 15, 25, 40];
  var AVATARS = ['comet', 'prism', 'orbit', 'flare', 'quark', 'nova', 'vortex', 'glyph'];
  var BOT_NAMES = ['Vex', 'Juno', 'Kestrel', 'Nyx', 'Orrin', 'Pixel', 'Sable', 'Tamsin', 'Quill', 'Rook', 'Zephyr', 'Lumen', 'Echo-7', 'Moth', 'Brisk', 'Halcyon'];

  function stageOf(m) { return m >= 7 ? 2 : m >= 4 ? 1 : 0; }

  // ───────────────────────────────────────── Utilities ─────────────────────────────────────────

  /** mulberry32: small, fast, seedable. Every shuffle in a match comes from this. */
  function makeRng(seed) {
    var a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** Fisher–Yates, unbiased. */
  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /** The full 118-card deck, unshuffled. */
  function buildDeck() {
    var cards = [];
    SUITS.forEach(function (s) {
      cards.push({ kind: 'num', color: s, value: 0 });
      for (var v = 1; v <= 9; v++) { cards.push({ kind: 'num', color: s, value: v }); cards.push({ kind: 'num', color: s, value: v }); }
      ['skip', 'reverse', 'surge', 'stabilize', 'rift'].forEach(function (k) {
        for (var i = 0; i < CARD_TYPES[k].perSuit; i++) cards.push({ kind: k, color: s });
      });
    });
    ['wild', 'overload', 'wildrift'].forEach(function (k) {
      for (var i = 0; i < CARD_TYPES[k].wild; i++) cards.push({ kind: k, color: null });
    });
    return cards;
  }

  function isWild(card) { return !!WILD_KINDS[card.kind]; }
  function isAttack(card) { return !!ATTACK_KINDS[card.kind]; }
  function cardName(card) {
    var t = CARD_TYPES[card.kind];
    if (card.kind === 'num') return SUIT_INFO[card.color].name + ' ' + card.value;
    return card.color ? SUIT_INFO[card.color].name + ' ' + t.name : t.name;
  }

  /**
   * Is `card` legal right now? ctx is public table state:
   *   { phase: 'turn'|'attack'|'drawn', color, top, rule, meltdown, stack, drawn: [ids] }
   * Precedence: phase restrictions → Wilds → stage effects (Critical+ Rifts) → rule enablers (Open Fire)
   *             → rule restrictions (Odd World, Color Lock) → normal color/number/symbol matching (+ Echo).
   */
  function isLegal(ctx, card) {
    if (!card) return false;
    if (ctx.phase === 'attack') return (isAttack(card) && ctx.stack < LIMITS.stackCap) || card.kind === 'stabilize';
    if (ctx.phase === 'drawn' && (ctx.drawn || []).indexOf(card.id) < 0) return false;
    if (ctx.phase !== 'turn' && ctx.phase !== 'drawn') return false;
    if (isWild(card)) return true;
    if (card.kind === 'rift' && stageOf(ctx.meltdown) >= 1) return true;
    if (card.kind === 'surge' && ctx.rule === 'open_fire') return true;
    if (card.kind === 'num' && ctx.rule === 'odd_world' && card.value % 2 === 0) return false;
    var top = ctx.top;
    var colorMatch = card.color === ctx.color;
    if (ctx.rule === 'color_lock') return colorMatch;
    if (colorMatch) return true;
    if (!top) return false;
    if (card.kind === 'num') {
      if (top.kind !== 'num') return false;
      if (top.value === card.value) return true;
      return ctx.rule === 'echo' && Math.abs(top.value - card.value) === 1;
    }
    return top.kind === card.kind;
  }

  // ───────────────────────────────────────── Match ─────────────────────────────────────────

  /**
   * One round. Players: [{ id, name }]. opts: { seed, firstSeat }.
   * Commands return { ok: true } or { error }. Every state change bumps `version` and appends events.
   */
  function Match(players, opts) {
    opts = opts || {};
    if (!players || players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) throw new Error('A match needs 2–8 players.');
    this.seed = opts.seed >>> 0;
    this.rng = makeRng(this.seed);
    this.players = players.map(function (p) { return { id: p.id, name: p.name, hand: [], called: false }; });
    this.stats = {};
    var st = this.stats;
    players.forEach(function (p) { st[p.id] = { played: 0, drawn: 0, attacked: 0, blocked: 0, rifts: 0, collapses: 0, caught: 0, catches: 0, peakMeltdown: 0 }; });
    this.dir = 1;
    this.version = 0;
    this.seq = 0;
    this.events = [];
    this.turnCount = 0;
    this.meltdown = LIMITS.meltdownStart;
    this.stack = 0;
    this.chainBonus = 0;
    this.exposed = null;          // { id, endsAt }
    this.winner = null;
    this.endReason = null;
    this.phase = 'turn';
    this.drawn = [];
    this.rule = 'stable';
    this.pool = shuffle(RULE_POOL.slice(), this.rng).slice(0, QUEUE_SIZE);
    this.queue = shuffle(this.pool.slice(), this.rng);
    this.collapseBag = [];
    this.nextCollapse = this.drawCollapse();

    var deck = shuffle(buildDeck(), this.rng);
    deck.forEach(function (c, i) { c.id = i + 1; });
    this.drawPile = deck;
    this.discard = [];
    var self = this;
    for (var r = 0; r < LIMITS.hand; r++) this.players.forEach(function (p) { p.hand.push(self.drawPile.pop()); });
    // The first face-up card is a number; anything else goes to the bottom of the pile.
    var guard = 0;
    while (this.drawPile[this.drawPile.length - 1].kind !== 'num' && guard++ < 200) this.drawPile.unshift(this.drawPile.pop());
    var first = this.drawPile.pop();
    this.discard.push(first);
    this.color = first.color;
    this.turn = typeof opts.firstSeat === 'number' ? ((opts.firstSeat % this.players.length) + this.players.length) % this.players.length : Math.floor(this.rng() * this.players.length);
    this.emit({ t: 'deal', top: first, first: this.players[this.turn].id });
    this.emit({ t: 'turn', pid: this.current().id, phase: 'turn' });
  }
  var M = Match.prototype;

  M.current = function () { return this.players[this.turn]; };
  M.get = function (id) { for (var i = 0; i < this.players.length; i++) if (this.players[i].id === id) return this.players[i]; return null; };
  M.top = function () { return this.discard[this.discard.length - 1]; };
  M.stage = function () { return stageOf(this.meltdown); };
  M.emit = function (e) { e.seq = ++this.seq; this.events.push(e); if (this.events.length > 80) this.events.shift(); return e; };
  M.ctx = function () {
    return { phase: this.phase, color: this.color, top: this.top(), rule: this.rule, meltdown: this.meltdown, stack: this.stack, drawn: this.drawn };
  };
  M.legalFor = function (id) {
    var p = this.get(id);
    if (!p || this.winner || this.current() !== p) return [];
    var ctx = this.ctx();
    return p.hand.filter(function (c) { return isLegal(ctx, c); }).map(function (c) { return c.id; });
  };
  M.drawCollapse = function () {
    if (!this.collapseBag.length) this.collapseBag = shuffle(COLLAPSE_IDS.slice(), this.rng);
    return this.collapseBag.pop();
  };
  M.nextRule = function () { return this.queue[0]; };

  /** Draw up to n cards for p. Reshuffles the discard pile when needed. Returns the cards drawn. */
  M.give = function (p, n, reason) {
    var got = [];
    for (var i = 0; i < n; i++) {
      if (p.hand.length >= LIMITS.handCap) break;
      if (!this.drawPile.length) {
        if (this.discard.length <= 1) break;
        var top = this.discard.pop();
        this.drawPile = shuffle(this.discard, this.rng);
        this.discard = [top];
        this.emit({ t: 'reshuffle', count: this.drawPile.length });
      }
      var c = this.drawPile.pop();
      p.hand.push(c);
      got.push(c);
    }
    if (this.stats[p.id]) this.stats[p.id].drawn += got.length;
    if (n > 0) this.emit({ t: 'draw', pid: p.id, n: got.length, asked: n, reason: reason, color: this.color, top: this.top(), private: { pid: p.id, cards: got.map(function (c) { return c.id; }) } });
    if (got.length && p.hand.length > 1) p.called = false;
    return got;
  };

  M.shiftReality = function (by, cause) {
    var from = this.rule;
    var to = this.queue.shift();
    // Queue used up: reshuffle the match's pool, with the rule we're entering last so it can't repeat straight away.
    if (!this.queue.length) this.queue = shuffle(this.pool.filter(function (r) { return r !== to; }), this.rng).concat([to]);
    this.rule = to;
    this.emit({ t: 'rift', from: from, to: to, by: by, cause: cause, next: this.queue[0] });
  };

  /** Apply a list of [delta, reason] Meltdown changes as one announced change. */
  M.applyMeltdown = function (parts, by) {
    if (!parts.length) return;
    var delta = 0;
    parts.forEach(function (p) { delta += p[0]; });
    var from = this.meltdown;
    var to = Math.max(0, Math.min(LIMITS.meltdownMax, from + delta));
    this.meltdown = to;
    if (this.stats[by]) this.stats[by].peakMeltdown = Math.max(this.stats[by].peakMeltdown, to);
    this.emit({ t: 'meltdown', from: from, to: to, delta: to - from, reasons: parts.map(function (p) { return p[1]; }), parts: parts, by: by, stageFrom: stageOf(from), stageTo: stageOf(to) });
  };

  M.collapse = function (by) {
    var ev = this.nextCollapse;
    if (this.stats[by]) this.stats[by].collapses++;
    this.emit({ t: 'collapse', event: ev, by: by });
    var self = this;
    if (ev === 'shockwave') {
      this.players.forEach(function (p) { if (p.id !== by) self.give(p, 1, 'shockwave'); });
    } else if (ev === 'gravity_well') {
      var min = Infinity;
      this.players.forEach(function (p) { min = Math.min(min, p.hand.length); });
      this.players.forEach(function (p) { if (p.hand.length === min) self.give(p, 2, 'gravity'); });
    } else if (ev === 'fracture') {
      this.shiftReality(by, 'fracture');
    } else if (ev === 'chain') {
      this.chainBonus = LIMITS.chain;
    }
    var from = this.meltdown;
    this.meltdown = LIMITS.meltdownReset;
    this.nextCollapse = this.drawCollapse();
    this.emit({ t: 'meltdown', from: from, to: this.meltdown, delta: this.meltdown - from, reasons: ['Collapse reset'], parts: [[this.meltdown - from, 'Collapse reset']], by: by, stageFrom: stageOf(from), stageTo: stageOf(this.meltdown), reset: true, next: this.nextCollapse });
  };

  M.stepIndex = function (from, steps) {
    var n = this.players.length;
    return (((from + this.dir * steps) % n) + n) % n;
  };

  /** End the current player's turn and hand it to the next one. */
  M.endTurn = function (skipNext) {
    this.turnCount++;
    this.drawn = [];
    if (this.rule === 'mirror') {
      var prev = this.color;
      this.color = SUIT_INFO[this.color].opposite;
      this.emit({ t: 'color', color: this.color, from: prev, cause: 'mirror' });
    }
    if (this.exposed && this.turnCount > this.exposed.endsAt) {
      this.emit({ t: 'safe', pid: this.exposed.id, cause: 'window' });
      this.exposed = null;
    }
    if (skipNext) {
      var skipped = this.players[this.stepIndex(this.turn, 1)];
      this.emit({ t: 'skip', target: skipped.id });
      this.turn = this.stepIndex(this.turn, 2);
    } else {
      this.turn = this.stepIndex(this.turn, 1);
    }
    if (this.turnCount >= LIMITS.turnLimit) { this.finish(null, 'turn-limit'); return; }
    this.phase = this.stack > 0 ? 'attack' : 'turn';
    this.emit({ t: 'turn', pid: this.current().id, phase: this.phase, stack: this.stack });
  };

  M.finish = function (winnerId, reason) {
    if (!winnerId) {
      var best = null;
      this.players.forEach(function (p) { if (!best || p.hand.length < best.hand.length) best = p; });
      winnerId = best.id;
    }
    this.winner = winnerId;
    this.endReason = reason;
    this.phase = 'end';
    this.emit({ t: 'win', pid: winnerId, reason: reason });
  };

  /** Final standings: winner first, then fewest cards; ties keep seat order. */
  M.ranking = function () {
    var self = this;
    return this.players.map(function (p, i) { return { id: p.id, cards: p.hand.length, seat: i }; })
      .sort(function (a, b) {
        if (a.id === self.winner) return -1;
        if (b.id === self.winner) return 1;
        return a.cards - b.cards || a.seat - b.seat;
      });
  };

  M.guard = function (id, v) {
    if (this.winner) return { error: 'The match is over.' };
    var p = this.get(id);
    if (!p) return { error: 'You are not in this match.' };
    if (this.current() !== p) return { error: 'It is not your turn.' };
    if (v != null && v !== this.version) return { error: 'stale', stale: true };
    return { p: p };
  };

  /** Play a card. o: { color, overcharge, call } */
  M.play = function (id, cardId, o, v) {
    o = o || {};
    var g = this.guard(id, v);
    if (g.error) return g;
    var p = g.p;
    var idx = -1;
    for (var i = 0; i < p.hand.length; i++) if (p.hand[i].id === cardId) idx = i;
    if (idx < 0) return { error: 'That card is not in your hand.' };
    var card = p.hand[idx];
    if (!isLegal(this.ctx(), card)) return { error: 'That card can’t be played right now.' };
    if (isWild(card) && SUITS.indexOf(o.color) < 0) return { error: 'Choose a color.' };
    var overcharge = !!o.overcharge && isAttack(card);

    var wasPhase = this.phase;
    var ruleAtPlay = this.rule;   // a Rift's new rule only governs later plays
    var prevTop = this.top();
    var stageBefore = this.stage();
    if (o.call && p.hand.length === 2) { p.called = true; this.emit({ t: 'call', pid: p.id }); }

    // 1. Discard and set the color.
    p.hand.splice(idx, 1);
    this.discard.push(card);
    var prevColor = this.color;
    this.color = isWild(card) ? o.color : card.color;
    this.emit({ t: 'play', pid: p.id, card: card, color: this.color, overcharge: overcharge, response: wasPhase === 'attack' });
    var stat = this.stats[p.id];
    stat.played++;
    if (isWild(card) || this.color !== prevColor) this.emit({ t: 'color', color: this.color, from: prevColor, cause: isWild(card) ? 'wild' : 'card' });

    // 2. Effect.
    var md = [];
    var skipNext = false;
    switch (card.kind) {
      case 'skip': skipNext = true; break;
      case 'reverse':
        if (this.players.length === 2) skipNext = true;
        else { this.dir *= -1; this.emit({ t: 'reverse', dir: this.dir }); }
        break;
      case 'surge':
      case 'overload': {
        var add = CARD_TYPES[card.kind].attack;
        var bonus = [];
        if (overcharge) { add += 1; bonus.push('overcharge'); }
        if (stageBefore >= 2) { add += LIMITS.breakingBonus; bonus.push('breaking'); }
        if (this.chainBonus) { add += this.chainBonus; bonus.push('chain'); this.chainBonus = 0; }
        var before = this.stack;
        this.stack = Math.min(LIMITS.stackCap, this.stack + add);
        var target = this.players[this.stepIndex(this.turn, 1)];
        this.emit({ t: 'stack', pid: p.id, target: target.id, add: this.stack - before, total: this.stack, bonus: bonus, capped: before + add > LIMITS.stackCap, counter: wasPhase === 'attack' });
        stat.attacked += this.stack - before;
        md.push(card.kind === 'overload' ? [LIMITS.overload, 'Overload'] : [LIMITS.surge, 'Surge']);
        break;
      }
      case 'stabilize':
        md.push([LIMITS.blockStabilize, 'Stabilize']);
        if (wasPhase === 'attack') {
          var took = Math.floor(this.stack / 2);
          var full = this.stack;
          this.stack = 0;
          this.emit({ t: 'block', pid: p.id, from: full, took: took });
          stat.blocked += full - took;
          if (took) this.give(p, took, 'block');
        }
        break;
      case 'rift':
      case 'wildrift':
        md.push([LIMITS.rift, card.kind === 'rift' ? 'Rift' : 'Wild Rift']);
        stat.rifts++;
        this.shiftReality(p.id, 'card');
        break;
      case 'num':
        if (card.value === 0) md.push([LIMITS.zero, 'Coolant 0']);
        break;
    }
    if (overcharge) md.push([LIMITS.overcharge, 'Overcharge']);

    // 3. Reality Rule Meltdown effects, from the rule in force when the card was played.
    if (ruleAtPlay === 'aftershock' && card.kind !== 'num') md.push([1, 'Aftershock']);
    if (ruleAtPlay === 'low_gravity' && card.kind === 'num' && prevTop && prevTop.kind === 'num' && prevTop.value !== card.value) {
      md.push(card.value < prevTop.value ? [1, 'Low Gravity: lower'] : [-1, 'Low Gravity: higher']);
    }
    this.applyMeltdown(md, p.id);

    // Last-card bookkeeping.
    if (p.hand.length === 1 && !p.called) {
      this.exposed = { id: p.id, endsAt: this.turnCount + 1 };
      this.emit({ t: 'exposed', pid: p.id });
    }
    if (p.hand.length !== 1) p.called = false;

    // 4. Victory beats everything that is still pending.
    if (!p.hand.length) { this.version++; this.finish(p.id, 'empty'); return { ok: true }; }

    // 5. Collapse.
    if (this.meltdown >= LIMITS.meltdownMax) this.collapse(p.id);

    // 6. End of turn.
    this.endTurn(skipNext);
    this.version++;
    return { ok: true };
  };

  /** Draw instead of playing, or accept the attack stack. */
  M.draw = function (id, v) {
    var g = this.guard(id, v);
    if (g.error) return g;
    var p = g.p;
    if (this.phase === 'drawn') return { error: 'Play the card you drew or pass.' };
    if (this.phase === 'attack') {
      var n = this.stack;
      this.stack = 0;
      this.emit({ t: 'accept', pid: p.id, n: n });
      this.give(p, n, 'attack');
      this.endTurn(false);
      this.version++;
      return { ok: true };
    }
    var count = this.rule === 'spotlight' && p.hand.length <= 3 ? 2 : 1;
    var got = this.give(p, count, count === 2 ? 'spotlight' : 'turn');
    this.drawn = got.map(function (c) { return c.id; });
    this.phase = 'drawn';
    var ctx = this.ctx();
    var playable = got.some(function (c) { return isLegal(ctx, c); });
    if (!playable) { this.passTurn(p); }
    this.version++;
    return { ok: true, playable: playable };
  };

  /** After drawing, keep the card(s) and end the turn. */
  M.pass = function (id, v) {
    var g = this.guard(id, v);
    if (g.error) return g;
    if (this.phase !== 'drawn') return { error: 'You can only pass after drawing.' };
    this.passTurn(g.p);
    this.version++;
    return { ok: true };
  };

  M.passTurn = function (p) {
    if (this.rule === 'hot_potato') this.give(p, 1, 'hot_potato');
    this.emit({ t: 'pass', pid: p.id });
    this.endTurn(false);
  };

  /** Press "Last card": arm it before playing your second-to-last card, or save yourself after forgetting. */
  M.call = function (id) {
    if (this.winner) return { error: 'The match is over.' };
    var p = this.get(id);
    if (!p) return { error: 'You are not in this match.' };
    if (this.exposed && this.exposed.id === id) {
      this.exposed = null;
      p.called = true;
      this.emit({ t: 'call', pid: id, late: true });
      this.version++;
      return { ok: true };
    }
    if (this.current() === p && p.hand.length === 2) {
      if (p.called) return { ok: true };
      p.called = true;
      this.emit({ t: 'call', pid: id });
      this.version++;
      return { ok: true };
    }
    return { error: 'You can call Last card when you hold two cards on your turn.' };
  };

  /** Catch a player who forgot to call Last card: they draw 2. */
  M.catchPlayer = function (id, target) {
    if (this.winner) return { error: 'The match is over.' };
    if (!this.get(id)) return { error: 'You are not in this match.' };
    if (!this.exposed || this.exposed.id !== target) return { error: 'Too late — nobody to catch.' };
    if (id === target) return { error: 'Press Last card to save yourself.' };
    var t = this.get(target);
    this.exposed = null;
    this.emit({ t: 'caught', pid: target, by: id });
    this.stats[target].caught++;
    this.stats[id].catches++;
    this.give(t, 2, 'catch');
    this.version++;
    return { ok: true };
  };

  /** Turn timer ran out: take the safe default for whatever the player was doing. */
  M.timeout = function (id) {
    if (this.winner || this.current().id !== id) return { error: 'Not their turn.' };
    var p = this.current();
    this.emit({ t: 'timeout', pid: id });
    if (this.phase === 'drawn') { this.passTurn(p); this.version++; return { ok: true }; }
    var r = this.draw(id);
    if (!this.winner && this.phase === 'drawn' && this.current() === p) { this.passTurn(p); this.version++; }
    return r;
  };

  /** Public table plus this player's private hand. Events are redacted so nobody sees another player's drawn cards. */
  M.viewFor = function (id, since) {
    var me = this.get(id);
    var top = this.top();
    var view = {
      version: this.version,
      turn: this.current().id,
      turnCount: this.turnCount,
      dir: this.dir,
      phase: this.phase,
      color: this.color,
      top: top,
      discardCount: this.discard.length,
      drawCount: this.drawPile.length,
      rule: this.rule,
      nextRule: this.queue[0],
      queue: this.queue.slice(),
      pool: this.pool.slice(),
      meltdown: this.meltdown,
      stage: this.stage(),
      nextCollapse: this.nextCollapse,
      chainBonus: this.chainBonus,
      stack: this.stack,
      exposed: this.exposed ? this.exposed.id : null,
      winner: this.winner,
      endReason: this.endReason,
      players: this.players.map(function (p) { return { id: p.id, name: p.name, count: p.hand.length, called: p.called && p.hand.length <= 2 }; }),
      events: this.events.filter(function (e) { return since == null || e.seq > since; }).map(function (e) {
        if (!e.private) return e;
        var c = {};
        for (var k in e) if (k !== 'private') c[k] = e[k];
        if (e.private.pid === id) c.cards = e.private.cards;
        return c;
      })
    };
    if (this.winner) { view.ranking = this.ranking(); view.stats = clone(this.stats); }
    if (this.winner) view.hands = this.players.map(function (p) { return { id: p.id, cards: p.hand }; }); // revealed at the end
    if (me) {
      view.hand = me.hand.slice();
      view.legal = this.legalFor(id);
      view.drawn = this.current() === me ? this.drawn.slice() : [];
    }
    return view;
  };

  // ───────────────────────────────────────── Bots ─────────────────────────────────────────
  //
  // A bot sees exactly what a human in its seat sees: viewFor(botId). It keeps a small memory built from
  // public events (who drew on which color), and returns a command { type, ... } through the same
  // RiftGame.command() path as a human, so it can only make legal moves.

  function BotBrain(level, rng) {
    this.level = LEVELS.indexOf(level) >= 0 ? level : 'normal';
    this.rng = rng || Math.random;
    this.seen = 0;
    this.voids = {};       // pid -> { color: weight }
  }
  var B = BotBrain.prototype;

  B.observe = function (view) {
    var self = this;
    (view.events || []).forEach(function (e) {
      if (e.seq <= self.seen) return;
      self.seen = e.seq;
      if (e.t === 'draw' && e.reason === 'turn' || e.t === 'draw' && e.reason === 'spotlight') {
        var v = self.voids[e.pid] || (self.voids[e.pid] = {});
        v[e.color] = Math.min(3, (v[e.color] || 0) + 1);
      }
      if (e.t === 'play' && e.card && e.card.color) {
        var w = self.voids[e.pid];
        if (w && w[e.card.color]) w[e.card.color] = 0;
      }
    });
  };

  function counts(hand) {
    var c = { cyan: 0, crimson: 0, gold: 0, violet: 0 };
    hand.forEach(function (k) { if (k.color) c[k.color]++; });
    return c;
  }

  /** How many of `hand` would be legal on a fresh turn in this context. */
  function flexibility(hand, ctx) {
    var n = 0;
    for (var i = 0; i < hand.length; i++) if (isLegal(ctx, hand[i])) n++;
    return n;
  }

  B.nextPlayer = function (view, steps) {
    var ids = view.players.map(function (p) { return p.id; });
    var i = ids.indexOf(view.me);
    var n = ids.length;
    return view.players[(((i + view.dir * (steps || 1)) % n) + n) % n];
  };

  /** Value of a Collapse Event for me (positive = good). */
  B.collapseValue = function (view, ev, myCountAfter) {
    var min = Infinity;
    var me = view.me;
    view.players.forEach(function (p) { min = Math.min(min, p.id === me ? myCountAfter : p.count); });
    if (ev === 'shockwave') return 3 + (view.players.length - 2) * 0.4;
    if (ev === 'gravity_well') return myCountAfter === min ? -5 : 2.5;
    if (ev === 'chain') return 0.5;
    return 0; // fracture: scored separately as a rule change
  };

  // Scoring weights. Normal uses the hand-written defaults; Hard's were tuned by simulating thousands of
  // matches against Normal bots (see games/riftbreak/docs/RULES.md, "Bots").
  var W_NORMAL = {
    draw: -6, attackAccept: 1.6, pass: -5, wild: 4, overload: 2, wildrift: 2.5, flex: 1, riftGain: 1.5,
    collapse: 1, nearTopRaise: 1, coolDown: 2, counter: 6, counterStack: 0.8, atkNear2: 7, atkNear4: 3, atkFar: 0.5,
    overNear: 1.5, overFar: -0.6, block: 0.9, stabHigh: 3, stabLow: -2.5, stopNear: 3, color: 0.9, voids: 0,
    leaderAction: 0, oddPrep: 0, keepDefense: 0, colorSpread: 0
  };
  var W_HARD = {
    draw: -4.5, attackAccept: 1.57, pass: -8.4, wild: 6.2, overload: 6.6, wildrift: 1.96, flex: 0.41, riftGain: 0.9,
    collapse: 0.74, nearTopRaise: 1.31, coolDown: 1.84, counter: 2.86, counterStack: 0.61, atkNear2: 4, atkNear4: 2.86, atkFar: 0.05,
    overNear: 0.67, overFar: 0.44, block: 0.9, stabHigh: 1.23, stabLow: -2.88, stopNear: 4.19, color: 0.38, voids: 0.92,
    leaderAction: 0, oddPrep: 1.22, keepDefense: 0, colorSpread: 0.34
  };

  /** Score one candidate. Higher is better. */
  B.score = function (view, c) {
    var W = this.weights || (this.level === 'hard' ? W_HARD : W_NORMAL);
    var hand = view.hand;
    var card = c.card;
    var rest = hand.filter(function (k) { return !card || k.id !== card.id; });
    var next = this.nextPlayer(view, 1);
    var me = view.me;
    var leader = Infinity;
    view.players.forEach(function (p) { if (p.id !== me) leader = Math.min(leader, p.count); });
    var s = 0;

    if (c.type === 'draw') {
      if (view.phase === 'attack') return -view.stack * W.attackAccept - 1;
      return W.draw - (view.rule === 'hot_potato' ? 1 : 0);
    }
    if (c.type === 'pass') return W.pass - (view.rule === 'hot_potato' ? 1.2 : 0);

    s += 10; // shedding a card is the point of the game
    if (!rest.length) return 1000; // going out wins

    // Keep flexible tools for later.
    if (card.kind === 'wild') s -= rest.length > 2 ? W.wild : 1;
    if (card.kind === 'overload') s -= W.overload;
    if (card.kind === 'wildrift') s -= W.wildrift;

    // Resulting context for my next turn (approximation: colour I leave, rule after a shift).
    var color = c.color || card.color;
    var rule = view.rule;
    if (card.kind === 'rift' || card.kind === 'wildrift') rule = view.nextRule;
    if (rule === 'mirror' && c.color) color = SUIT_INFO[color].opposite;
    var after = { phase: 'turn', color: color, top: card, rule: rule, meltdown: view.meltdown, stack: 0, drawn: [] };
    s += flexibility(rest, after) * W.flex;

    // Rift: does the next rule suit my hand better than this one?
    if (card.kind === 'rift' || card.kind === 'wildrift') {
      var nowCtx = { phase: 'turn', color: color, top: card, rule: view.rule, meltdown: view.meltdown, stack: 0, drawn: [] };
      s += (flexibility(rest, after) - flexibility(rest, nowCtx)) * W.riftGain;
      if (view.nextRule === 'spotlight' && rest.length <= 3) s -= 3;
      if (view.nextRule === 'hot_potato' && rest.length > 6) s -= 1;
    }

    // Meltdown arithmetic for this play.
    var md = 0;
    if (card.kind === 'rift' || card.kind === 'wildrift') md += 1;
    if (isAttack(card)) md += 1;
    if (card.kind === 'stabilize') md -= 2;
    if (card.kind === 'num' && card.value === 0) md -= 1;
    if (c.overcharge) md += 1;
    if (view.rule === 'aftershock' && card.kind !== 'num') md += 1;
    if (view.rule === 'low_gravity' && card.kind === 'num' && view.top && view.top.kind === 'num' && view.top.value !== card.value) md += card.value < view.top.value ? 1 : -1;
    var mAfter = Math.max(0, view.meltdown + md);
    if (mAfter >= 10) {
      s += this.collapseValue(view, view.nextCollapse, rest.length) * W.collapse;
    } else if (this.level !== 'easy') {
      // Near the top, raising the meter hands the collapse to whoever plays next.
      var nextCollapseVal = this.collapseValue(view, view.nextCollapse, rest.length);
      if (mAfter >= 8 && md > 0) s -= (nextCollapseVal < 0 ? 1.5 : 0.8) * W.nearTopRaise;
      if (md < 0 && view.meltdown >= 7 && nextCollapseVal < 0) s += W.coolDown;
    }

    // Attacks.
    var nextCount = next.count;
    if (isAttack(card)) {
      if (view.phase === 'attack') s += W.counter + view.stack * W.counterStack; // passing the threat on beats eating it
      else s += nextCount <= 2 ? W.atkNear2 : nextCount <= 4 ? W.atkNear4 : W.atkFar;
      if (c.overcharge) s += nextCount <= 3 ? W.overNear : W.overFar;
    }
    if (card.kind === 'stabilize') {
      if (view.phase === 'attack') s += view.stack * W.block - 1;
      else s += view.meltdown >= 7 ? W.stabHigh : view.meltdown >= 5 ? 0 : W.stabLow;
    }
    if ((card.kind === 'skip' || card.kind === 'reverse') && nextCount <= 2) s += W.stopNear;
    if (card.kind === 'reverse' && view.players.length > 2) {
      var prev = this.nextPlayer(view, -1);
      if (prev.count <= 2 && nextCount > 2) s -= 3; // don't hand the turn to a near-winner
    }
    // Spend actions while someone is close to going out; hold them otherwise.
    if (card.kind !== 'num') s += (leader <= 3 ? 1 : -1) * W.leaderAction;
    // Keep one defensive card (attack or Stabilize) in hand while the table is armed.
    if ((isAttack(card) || card.kind === 'stabilize') && view.phase !== 'attack') {
      var defenses = rest.filter(function (k) { return isAttack(k) || k.kind === 'stabilize'; }).length;
      if (!defenses) s -= W.keepDefense;
    }
    // Hold several colours rather than one, so a colour change doesn't strand the hand.
    if (W.colorSpread) {
      var cs = counts(rest), spread = 0;
      SUITS.forEach(function (k) { if (cs[k]) spread++; });
      s += spread * W.colorSpread;
    }

    // Colour choice: what I hold, and what the next player seems to lack.
    if (c.color) {
      var cc = counts(rest);
      s += cc[c.color] * W.color;
      if (W.voids) {
        var faced = rule === 'mirror' ? SUIT_INFO[c.color].opposite : c.color;
        var v = this.voids[next.id] || {};
        s += (v[faced] || 0) * W.voids;
      }
    }
    // Shed what could get stuck under the next rule.
    if (card.kind === 'num' && W.oddPrep) {
      if (view.nextRule === 'odd_world' && card.value % 2 === 0) s += W.oddPrep;
      if (card.value === 0 && view.meltdown >= 6) s += W.oddPrep;
    }
    return s;
  };

  /** Pick a command for this view. Returns null if it isn't our turn. */
  B.decide = function (view) {
    this.observe(view);
    if (view.phase === 'end' || view.turn !== view.me) return null;
    var rng = this.rng;
    var hand = view.hand;
    var byId = {};
    hand.forEach(function (k) { byId[k.id] = k; });
    var legal = view.legal.map(function (id) { return byId[id]; }).filter(Boolean);
    var callIt = hand.length === 2 && (this.level !== 'easy' || rng() < 0.7);

    var cands = [];
    legal.forEach(function (card) {
      var colors = isWild(card) ? SUITS : [null];
      colors.forEach(function (col) {
        cands.push({ type: 'play', card: card, color: col, overcharge: false });
        if (isAttack(card)) cands.push({ type: 'play', card: card, color: col, overcharge: true });
      });
    });
    if (view.phase === 'drawn') cands.push({ type: 'pass' });
    else cands.push({ type: 'draw' });

    var choice;
    if (this.level === 'easy') {
      var plays = cands.filter(function (c) { return c.type === 'play' && !c.overcharge; });
      if (!plays.length || rng() < 0.08 && view.phase === 'turn') choice = cands[cands.length - 1];
      else {
        var plain = plays.filter(function (c) { return !isWild(c.card); });
        var pickFrom = plain.length && rng() < 0.75 ? plain : plays;
        choice = pickFrom[Math.floor(rng() * pickFrom.length)];
        if (choice.color) {
          var cc = counts(hand.filter(function (k) { return k.id !== choice.card.id; }));
          var best = SUITS.slice().sort(function (a, b) { return cc[b] - cc[a]; })[0];
          choice = { type: 'play', card: choice.card, color: rng() < 0.65 ? best : SUITS[Math.floor(rng() * 4)], overcharge: false };
        }
      }
    } else {
      var self = this;
      var best2 = null, bestS = -Infinity;
      cands.forEach(function (c) {
        var sc = self.score(view, c) + (self.level === 'normal' ? rng() * 2.6 : rng() * 0.3);
        if (sc > bestS) { bestS = sc; best2 = c; }
      });
      choice = best2;
    }

    if (choice.type === 'draw') return { type: 'draw', v: view.version };
    if (choice.type === 'pass') return { type: 'pass', v: view.version };
    return { type: 'play', card: choice.card.id, color: choice.color || undefined, overcharge: choice.overcharge, call: callIt, v: view.version };
  };

  /** Should this bot catch an exposed player? Returns a delay in ms, or -1. */
  B.catchDelay = function () {
    var p = { easy: 0.35, normal: 0.7, hard: 0.95 }[this.level];
    if (this.rng() > p) return -1;
    var base = { easy: 1300, normal: 850, hard: 450 }[this.level];
    return base + this.rng() * 900;
  };

  // ───────────────────────────────────────── RiftGame (session) ─────────────────────────────────────────

  var DEFAULT_SETTINGS = { seats: 6, botLevel: 'normal', turnTimer: 0, lastCall: true, botSpeed: 'normal' };
  var BOT_DELAY = { fast: [450, 300], normal: [1100, 700], relaxed: [1700, 1000] };
  var AUTOPILOT_GRACE_MS = 10000;
  var FX_HOLD_MS = { rift: 3600, collapse: 4300 };
  var EXPOSED_HOLD_MS = 1800;

  function sanitizeSettings(s, prev) {
    var out = clone(prev || DEFAULT_SETTINGS);
    s = s || {};
    if (s.seats != null) out.seats = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Math.round(Number(s.seats)) || out.seats));
    if (LEVELS.indexOf(s.botLevel) >= 0) out.botLevel = s.botLevel;
    if (s.turnTimer != null && TIMERS.indexOf(Number(s.turnTimer)) >= 0) out.turnTimer = Number(s.turnTimer);
    if (s.lastCall != null) out.lastCall = !!s.lastCall;
    if (BOT_DELAY[s.botSpeed]) out.botSpeed = s.botSpeed;
    return out;
  }

  /**
   * opts: { code, seed, hooks: { sync() }, timers: { set(fn, ms), clear(id) }, now(), random() }
   * Seats hold humans and bots. `match` exists while a round is running or just ended.
   */
  function RiftGame(opts) {
    opts = opts || {};
    this.code = opts.code || 'LOCAL';
    this.hooks = opts.hooks || {};
    this.timers = opts.timers || { set: function (fn, ms) { return setTimeout(fn, ms); }, clear: function (t) { clearTimeout(t); } };
    this.now = opts.now || function () { return Date.now(); };
    this.random = opts.random || Math.random;
    this.seedBase = opts.seed != null ? opts.seed >>> 0 : Math.floor(this.random() * 4294967296);
    this.round = 0;
    this.seats = [];
    this.settings = sanitizeSettings(opts.settings);
    this.hostId = null;
    this.match = null;
    this.phase = 'lobby';
    this.brains = {};
    this.botTimer = null;
    this.turnTimer = null;
    this.deadline = null;
    this.catchTimers = [];
    this.lastWinner = null;
    this.botSeq = 0;
  }
  var G = RiftGame.prototype;

  G.sync = function () { if (this.hooks.sync) this.hooks.sync(); };
  /** The host runs the room; if the host is gone or offline, the first connected human may stand in. */
  G.canHost = function (by) {
    if (!by) return true;
    if (by === this.hostId) return true;
    var host = this.seat(this.hostId);
    if (host && host.connected && !host.left) return false;
    var stand = this.seats.filter(function (s) { return !s.isBot && s.connected && !s.left; })[0];
    return !!stand && stand.id === by;
  };
  G.seat = function (id) { for (var i = 0; i < this.seats.length; i++) if (this.seats[i].id === id) return this.seats[i]; return null; };
  G.humans = function () { return this.seats.filter(function (s) { return !s.isBot; }); };

  G.addPlayer = function (p) {
    p = p || {};
    var existing = this.seat(p.id);
    if (existing) return { player: existing };
    var active = this.seats.filter(function (s) { return !s.left; });
    if (active.length >= MAX_PLAYERS) {
      // A human replaces a bot if the table is full of bots (between matches only: mid-match bots hold real hands).
      var bot = this.phase === 'playing' ? null : active.filter(function (s) { return s.isBot; }).pop();
      if (!bot) return { error: 'The room is full.' };
      this.seats.splice(this.seats.indexOf(bot), 1);
      delete this.brains[bot.id];
    }
    var name = String(p.name || 'Player').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Player';
    var seat = { id: String(p.id || 'p' + this.seats.length), name: name, avatar: AVATARS.indexOf(p.avatar) >= 0 ? p.avatar : AVATARS[this.seats.length % AVATARS.length], isBot: false, connected: true, autopilot: false, wins: 0, joinedAt: this.now() };
    // Joining during a match: watch it, and get dealt in when the host starts the next one.
    if (this.phase === 'playing') seat.waiting = true;
    // Humans sit before bots.
    var firstBot = -1;
    for (var i = 0; i < this.seats.length; i++) if (this.seats[i].isBot) { firstBot = i; break; }
    if (firstBot < 0) this.seats.push(seat); else this.seats.splice(firstBot, 0, seat);
    if (!this.hostId) this.hostId = seat.id;
    if (this.seats.length > this.settings.seats) this.settings.seats = Math.min(MAX_PLAYERS, this.seats.length);
    this.sync();
    return { player: seat };
  };

  G.addBot = function (by, level) {
    if (!this.canHost(by)) return { error: 'Only the host can add bots.' };
    if (this.phase === 'playing') return { error: 'Bots join between matches.' };
    if (this.seats.length >= MAX_PLAYERS) return { error: 'The table is full.' };
    return this.spawnBot(level);
  };

  G.spawnBot = function (level) {
    var used = {};
    this.seats.forEach(function (s) { used[s.name] = 1; });
    var names = BOT_NAMES.filter(function (n) { return !used[n]; });
    var name = names[Math.floor(this.random() * names.length)] || 'Bot ' + (this.seats.length + 1);
    var lvl = LEVELS.indexOf(level) >= 0 ? level : this.settings.botLevel;
    var seat = { id: 'bot' + (++this.botSeq), name: name, avatar: AVATARS[(this.seats.length + 3) % AVATARS.length], isBot: true, level: lvl, connected: true, autopilot: false, wins: 0 };
    this.seats.push(seat);
    if (this.seats.length > this.settings.seats) this.settings.seats = this.seats.length;
    this.sync();
    return { ok: true, player: seat };
  };

  G.removePlayer = function (id, by) {
    var s = this.seat(id);
    if (!s) return { error: 'No such player.' };
    if (by && by !== id && !this.canHost(by)) return { error: 'Only the host can remove players.' };
    if (s.waiting || this.phase === 'ended' && !this.match.get(id)) {
      this.seats.splice(this.seats.indexOf(s), 1);
      if (this.hostId === id) { var h0 = this.humans().filter(function (x) { return !x.left; })[0]; this.hostId = h0 ? h0.id : null; }
      this.sync();
      return { ok: true };
    }
    if (this.phase !== 'lobby' && !s.isBot) {
      // Mid-match a leaving human hands their seat to a bot so the round can finish.
      s.connected = false;
      s.autopilot = true;
      s.left = true;
      this.afterChange();
      return { ok: true };
    }
    if (this.phase !== 'lobby') return { error: 'Bots leave between matches.' };
    this.seats.splice(this.seats.indexOf(s), 1);
    delete this.brains[id];
    if (this.hostId === id) { var h = this.humans()[0]; this.hostId = h ? h.id : null; }
    this.sync();
    return { ok: true };
  };

  G.updateSettings = function (by, s) {
    if (!this.canHost(by)) return { error: 'Only the host can change settings.' };
    var prevLevel = this.settings.botLevel;
    this.settings = sanitizeSettings(s, this.settings);
    if (this.settings.seats < this.seats.length) this.settings.seats = this.seats.length;
    if (this.settings.botLevel !== prevLevel) {
      var lvl = this.settings.botLevel;
      this.seats.forEach(function (x) { if (x.isBot) x.level = lvl; });
    }
    this.sync();
    return { ok: true };
  };

  /** Start (or restart) a match. Empty seats up to settings.seats are filled with bots. */
  G.start = function (by) {
    if (!this.canHost(by)) return { error: 'Only the host can start.' };
    if (this.phase === 'playing' && this.match && !this.match.winner) return { error: 'A match is already running.' };
    // Seats that left mid-match are dropped now.
    var self = this;
    this.seats = this.seats.filter(function (s) { return !s.left; });
    this.seats.forEach(function (s) { s.waiting = false; });
    if (this.hostId && !this.seat(this.hostId)) { var h = this.humans()[0]; this.hostId = h ? h.id : null; }
    // Fill empty seats with bots. Bounded by MAX_PLAYERS, so this can never spin.
    while (this.seats.length < Math.min(MAX_PLAYERS, this.settings.seats)) this.spawnBot(null);
    if (this.seats.length < MIN_PLAYERS) return { error: 'You need at least two players.' };
    this.clearTimers();
    this.round++;
    var first = 0;
    if (this.lastWinner) {
      var wi = this.seats.map(function (s) { return s.id; }).indexOf(this.lastWinner);
      first = wi < 0 ? 0 : (wi + 1) % this.seats.length;   // the player after the last winner leads
    } else {
      first = Math.floor(this.random() * this.seats.length);
    }
    this.match = new Match(this.seats.map(function (s) { return { id: s.id, name: s.name }; }), { seed: (this.seedBase + this.round * 7919) >>> 0, firstSeat: first });
    this.brains = {};
    this.seats.forEach(function (s, i) {
      if (s.isBot || s.autopilot) self.brains[s.id] = new BotBrain(s.isBot ? s.level : 'normal', makeRng(self.seedBase ^ (i * 2654435761 + self.round)));
    });
    this.phase = 'playing';
    this.afterChange();
    return { ok: true };
  };

  G.returnToLobby = function (by) {
    if (!this.canHost(by)) return { error: 'Only the host can do that.' };
    this.clearTimers();
    this.match = null;
    this.phase = 'lobby';
    this.seats = this.seats.filter(function (s) { return !s.left; });
    this.sync();
    return { ok: true };
  };

  G.setConnected = function (id, on) {
    var s = this.seat(id);
    if (!s || s.isBot) return;
    s.connected = !!on;
    var self = this;
    if (on) {
      this.timers.clear(s.graceTimer);
      s.graceTimer = null;
      if (s.autopilot && !s.left) { s.autopilot = false; delete this.brains[id]; }
    } else if (this.phase === 'playing' && !s.autopilot) {
      s.graceTimer = this.timers.set(function () {
        s.graceTimer = null;
        if (!s.connected && self.phase === 'playing') {
          s.autopilot = true;
          self.brains[id] = new BotBrain('normal', makeRng(self.seedBase ^ 0x5bd1e995));
          self.afterChange();
        }
      }, AUTOPILOT_GRACE_MS);
    }
    this.afterChange();
  };

  G.clearTimers = function () {
    this.timers.clear(this.botTimer); this.botTimer = null;
    this.timers.clear(this.turnTimer); this.turnTimer = null;
    this.deadline = null;
    var t = this.timers;
    this.catchTimers.forEach(function (x) { t.clear(x); });
    this.catchTimers = [];
  };

  G.isAuto = function (id) { var s = this.seat(id); return !!s && (s.isBot || s.autopilot); };

  /** Called after any state change: push views, schedule the bot/timer for whoever is up next. */
  G.afterChange = function (events) {
    var m = this.match;
    var self = this;
    this.timers.clear(this.botTimer); this.botTimer = null;
    this.timers.clear(this.turnTimer); this.turnTimer = null;
    this.deadline = null;
    if (this.phase === 'playing' && m) {
      if (m.winner) {
        this.phase = 'ended';
        var w = this.seat(m.winner);
        if (w) w.wins++;
        this.lastWinner = m.winner;
      } else {
        var cur = m.current().id;
        var hold = 0;
        (events || []).forEach(function (e) { if (e.t === 'rift') hold = Math.max(hold, FX_HOLD_MS.rift); if (e.t === 'collapse') hold = Math.max(hold, FX_HOLD_MS.collapse); });
        if (this.isAuto(cur)) {
          var d = BOT_DELAY[this.settings.botSpeed] || BOT_DELAY.normal;
          // Someone just forgot to call Last card: leave everyone a moment to catch them.
          if (m.exposed) hold = Math.max(hold, EXPOSED_HOLD_MS);
          var delay = hold + d[0] + this.random() * d[1];
          var version = m.version;
          this.botTimer = this.timers.set(function () { self.botTurn(cur, version); }, delay);
        } else if (this.settings.turnTimer) {
          var ms = this.settings.turnTimer * 1000 + hold;
          this.deadline = this.now() + ms;
          var v2 = m.version;
          this.turnTimer = this.timers.set(function () {
            if (self.match === m && m.version === v2 && !m.winner) { var before = m.seq; m.timeout(cur); self.afterChange(m.events.filter(function (e) { return e.seq > before; })); }
          }, ms);
        }
        // Bots try to catch a player who forgot to call Last card.
        (events || []).forEach(function (e) {
          if (e.t !== 'exposed' || !self.settings.lastCall) return;
          self.seats.forEach(function (s) {
            if (s.id === e.pid || !self.brains[s.id] || !s.isBot) return;
            var delay = self.brains[s.id].catchDelay();
            if (delay < 0) return;
            self.catchTimers.push(self.timers.set(function () {
              if (self.match === m && m.exposed && m.exposed.id === e.pid) { var b = m.seq; m.catchPlayer(s.id, e.pid); self.afterChange(m.events.filter(function (x) { return x.seq > b; })); }
            }, delay));
          });
          // An auto-piloted or bot player that forgot calls late, sometimes.
          if (self.isAuto(e.pid)) {
            self.catchTimers.push(self.timers.set(function () {
              if (self.match === m && m.exposed && m.exposed.id === e.pid) { var b = m.seq; m.call(e.pid); self.afterChange(m.events.filter(function (x) { return x.seq > b; })); }
            }, 1500 + self.random() * 2000));
          }
        });
      }
    }
    this.sync();
  };

  G.botTurn = function (id, version) {
    var m = this.match;
    if (!m || m.winner || m.current().id !== id || m.version !== version) return;
    var brain = this.brains[id] || (this.brains[id] = new BotBrain('normal', makeRng(this.seedBase)));
    var view = this.viewFor(id).match;
    view.me = id;
    var cmd = brain.decide(view);
    var before = m.seq;
    var res = cmd ? this.apply(id, cmd) : { error: 'no move' };
    if (res.error) {
      // Never stall: fall back to the always-legal default.
      if (m.phase === 'drawn') m.pass(id); else m.draw(id);
    }
    if (m.phase === 'drawn' && m.current().id === id && !m.winner) {
      // Bot drew a playable card: decide again shortly.
      this.afterChange(m.events.filter(function (e) { return e.seq > before; }));
      return;
    }
    this.afterChange(m.events.filter(function (e) { return e.seq > before; }));
  };

  /** Apply a match command for a player (shared by humans and bots). */
  G.apply = function (id, c) {
    var m = this.match;
    if (!m || this.phase !== 'playing') return { error: 'No match is running.' };
    var v = typeof c.v === 'number' ? c.v : null;
    switch (c.type) {
      case 'play': return m.play(id, Number(c.card), { color: c.color, overcharge: !!c.overcharge, call: !!c.call && this.settings.lastCall }, v);
      case 'draw': return m.draw(id, v);
      case 'pass': return m.pass(id, v);
      case 'call': return this.settings.lastCall ? m.call(id) : { error: 'Last card is off in this room.' };
      case 'catch': return this.settings.lastCall ? m.catchPlayer(id, String(c.target || '')) : { error: 'Last card is off in this room.' };
      default: return { error: 'Unknown command.' };
    }
  };

  /** Single entry point for transports. Inputs are untrusted. */
  G.command = function (id, c) {
    if (!c || typeof c !== 'object') return { error: 'Bad command.' };
    var s = this.seat(id);
    if (!s) return { error: 'You are not in this room.' };
    switch (c.type) {
      case 'settings': return this.updateSettings(id, c.settings);
      case 'addBot': return this.addBot(id, c.level);
      case 'kick': return this.removePlayer(String(c.playerId || ''), id);
      case 'start': return this.start(id);
      case 'lobby': return this.returnToLobby(id);
      case 'play': case 'draw': case 'pass': case 'call': case 'catch': {
        if (s.autopilot && !s.left) { s.autopilot = false; delete this.brains[id]; }
        var m = this.match;
        var before = m ? m.seq : 0;
        var res = this.apply(id, c);
        if (!res.error) this.afterChange(m.events.filter(function (e) { return e.seq > before; }));
        return res;
      }
      default: return { error: 'Unknown command.' };
    }
  };

  /** Everything one player may see. */
  G.viewFor = function (id, since) {
    var view = {
      code: this.code,
      phase: this.phase,
      you: id,
      host: this.hostId,
      canHost: this.canHost(id),
      round: this.round,
      settings: clone(this.settings),
      seats: this.seats.map(function (s) {
        return { id: s.id, name: s.name, avatar: s.avatar, isBot: s.isBot, level: s.isBot ? s.level : null, connected: s.connected, autopilot: s.autopilot, wins: s.wins, left: !!s.left, waiting: !!s.waiting };
      }),
      deadline: this.deadline,
      now: this.now()
    };
    if (this.match) view.match = this.match.viewFor(id, since);
    return view;
  };

  G.destroy = function () { this.clearTimers(); this.hooks = {}; };

  return {
    SUITS: SUITS, SUIT_INFO: SUIT_INFO, CARD_TYPES: CARD_TYPES, RULES: RULES, RULE_POOL: RULE_POOL, COLLAPSES: COLLAPSES,
    STAGES: STAGES, LIMITS: LIMITS, LEVELS: LEVELS, TIMERS: TIMERS, AVATARS: AVATARS, MIN_PLAYERS: MIN_PLAYERS, MAX_PLAYERS: MAX_PLAYERS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS, QUEUE_SIZE: QUEUE_SIZE,
    stageOf: stageOf, isLegal: isLegal, isWild: isWild, isAttack: isAttack, cardName: cardName, buildDeck: buildDeck,
    makeRng: makeRng, shuffle: shuffle, sanitizeSettings: sanitizeSettings,
    W_NORMAL: W_NORMAL, W_HARD: W_HARD,
    Match: Match, BotBrain: BotBrain, RiftGame: RiftGame
  };
});
