// Bluff for RECESS: one rule set, the common Indian classroom version.
//
//  • The whole 52-card deck is dealt.
//  • Whoever starts a pile names a rank and plays 1–4 cards face down "of that rank".
//  • Each next player either adds 1–4 cards claiming the same rank, or passes.
//  • Any other player may call "Bluff!" on the most recent play until the next player moves.
//    The cards are flipped. A lie: the liar picks up the whole pile and the caller starts a new one.
//    The truth: the caller picks up the pile and the player who told the truth starts a new one.
//  • If everyone else passes in a row, the pile is thrown away and the last player to play starts afresh.
//  • A player who plays their last card wins as soon as that play survives: the next player moves
//    (or everyone passes) without a successful Bluff call.
import { BaseEngine } from './base.mjs';

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['S', 'H', 'D', 'C'];
export const card = (id) => ({ id, rank: RANKS[id % 13], suit: SUITS[Math.floor(id / 13)] });

const REVEAL_MS = 3200;

export class BluffEngine extends BaseEngine {
  constructor(matchId, players, onUpdate, options) {
    super(matchId, players, onUpdate, options);
    this.wins = Object.fromEntries(players.map(p => [p.id, 0]));
    this.game = 0;
    this.deal();
  }

  deal() {
    this.game++;
    const deck = BaseEngine.shuffle([...Array(52).keys()]);
    const seats = this.activePlayers();
    this.hands = Object.fromEntries(this.players.map(p => [p.id, []]));
    deck.forEach((c, i) => this.hands[seats[i % seats.length].id].push(c));
    for (const p of this.players) this.sortHand(p.id);
    this.pile = [];           // [{ by, cards: [ids], rank }]
    this.claimRank = null;
    this.lastPlay = null;     // { by, count, rank, seq }
    this.seq = 0;
    this.passes = 0;
    this.discarded = 0;
    this.pendingWinner = null;
    this.reveal = null;
    this.phase = 'playing';   // 'playing' | 'reveal' | 'finished'
    this.winner = null;
    this.log = [];
    const starter = seats[(this.game - 1) % seats.length];
    this.turn = starter.id;
    this.say(`${starter.name} starts the first pile.`);
    this.botTurn();
  }

  sortHand(pid) { this.hands[pid].sort((a, b) => (a % 13) - (b % 13) || a - b); }

  say(text) {
    this.log.push({ text, time: Date.now() });
    if (this.log.length > 12) this.log.shift();
  }

  name(pid) { return this.player(pid)?.name || 'Someone'; }

  seated() { return this.activePlayers(); }

  nextAfter(pid) {
    const seats = this.seated();
    const i = seats.findIndex(p => p.id === pid);
    for (let k = 1; k <= seats.length; k++) {
      const p = seats[(i + k + seats.length) % seats.length];
      if (this.hands[p.id].length > 0 || p.id === this.pendingWinner) return p.id;
    }
    return pid;
  }

  // The next player acted, so a pending last-card play has survived.
  settlePending() {
    if (this.pendingWinner && this.lastPlay && this.lastPlay.by === this.pendingWinner) {
      this.finish(this.pendingWinner);
      return true;
    }
    return false;
  }

  finish(pid) {
    this.phase = 'finished';
    this.winner = pid;
    this.wins[pid]++;
    this.turn = null;
    this.say(`${this.name(pid)} played their last card and got away with it!`);
    this.announce(`${this.name(pid)} won Bluff with a straight face.`);
  }

  handleAction(pid, a) {
    switch (a.type) {
      case 'play': return this.play(pid, a.cards, a.rank);
      case 'pass': return this.pass(pid);
      case 'call': return this.call(pid, a.seq);
      case 'rematch':
        if (this.phase !== 'finished') return { ok: false, error: 'Game still going' };
        if (this.seated().length < 2) return { ok: false, error: 'Not enough players left' };
        this.deal();
        this.notify();
        return { ok: true };
      default: return { ok: false, error: 'Unknown action' };
    }
  }

  play(pid, cards, rank) {
    if (this.phase !== 'playing') return { ok: false, error: 'Wait for the cards to be flipped' };
    if (this.turn !== pid) return { ok: false, error: 'Not your turn' };
    if (!Array.isArray(cards) || cards.length < 1 || cards.length > 4) return { ok: false, error: 'Play 1 to 4 cards' };
    const hand = this.hands[pid];
    const ids = [...new Set(cards)];
    if (ids.length !== cards.length || !ids.every(c => Number.isInteger(c) && hand.includes(c))) return { ok: false, error: 'Those cards are not in your hand' };
    if (this.claimRank === null) {
      if (!RANKS.includes(rank)) return { ok: false, error: 'Name a rank to start the pile' };
    } else rank = this.claimRank;

    if (this.settlePending()) { this.notify(); return { ok: false, error: 'Game over' }; }

    this.hands[pid] = hand.filter(c => !ids.includes(c));
    this.claimRank = rank;
    this.pile.push({ by: pid, cards: ids, rank });
    this.lastPlay = { by: pid, count: ids.length, rank, seq: ++this.seq };
    this.passes = 0;
    this.say(`${this.name(pid)} put down ${ids.length} × ${rank}${this.pile.length === 1 ? ' (new pile)' : ''}.`);
    if (this.hands[pid].length === 0) {
      this.pendingWinner = pid;
      this.say(`${this.name(pid)} is out of cards! Call Bluff now or they win.`);
    }
    this.turn = this.nextAfter(pid);
    this.notify();
    this.botCalls();
    this.botTurn();
    return { ok: true };
  }

  pass(pid) {
    if (this.phase !== 'playing') return { ok: false, error: 'Wait for the cards to be flipped' };
    if (this.turn !== pid) return { ok: false, error: 'Not your turn' };
    if (!this.lastPlay) return { ok: false, error: 'You are starting the pile — play something' };
    if (this.settlePending()) { this.notify(); return { ok: true }; }
    this.passes++;
    this.say(`${this.name(pid)} passed.`);
    const others = this.seated().filter(p => p.id !== this.lastPlay.by && this.hands[p.id].length > 0).length;
    if (this.passes >= others) {
      this.discarded += this.pile.reduce((n, p) => n + p.cards.length, 0);
      this.say(`Everyone passed. The pile is thrown away; ${this.name(this.lastPlay.by)} starts fresh.`);
      this.turn = this.lastPlay.by;
      this.pile = [];
      this.claimRank = null;
      this.lastPlay = null;
      this.passes = 0;
    } else {
      this.turn = this.nextAfter(pid);
    }
    this.notify();
    this.botTurn();
    return { ok: true };
  }

  call(pid, seq) {
    if (this.phase !== 'playing') return { ok: false, error: 'Too late' };
    if (!this.lastPlay) return { ok: false, error: 'Nothing to call' };
    if (seq !== undefined && seq !== this.lastPlay.seq) return { ok: false, error: 'Too late — someone already moved' };
    if (this.lastPlay.by === pid) return { ok: false, error: 'You cannot call your own bluff' };
    if (!this.seated().some(p => p.id === pid)) return { ok: false, error: 'Not in this game' };

    const play = this.pile[this.pile.length - 1];
    const truthful = play.cards.every(c => RANKS[c % 13] === play.rank);
    const loser = truthful ? pid : play.by;
    const pileCards = this.pile.flatMap(p => p.cards);
    this.hands[loser].push(...pileCards);
    this.sortHand(loser);
    this.reveal = { caller: pid, accused: play.by, cards: play.cards.map(card), rank: play.rank, truthful, loser, pileSize: pileCards.length };
    this.say(truthful
      ? `${this.name(pid)} called Bluff... but it was true! ${this.name(pid)} picks up ${pileCards.length} cards.`
      : `${this.name(pid)} caught ${this.name(play.by)} lying! ${this.name(play.by)} picks up ${pileCards.length} cards.`);
    if (this.pendingWinner === play.by && !truthful) this.pendingWinner = null;
    this.phase = 'reveal';
    this.turn = null;
    this.notify();
    this.later(() => {
      this.pile = [];
      this.claimRank = null;
      this.lastPlay = null;
      this.passes = 0;
      this.reveal = null;
      this.phase = 'playing';
      if (truthful && this.pendingWinner === play.by) { this.finish(play.by); this.notify(); return; }
      this.turn = truthful ? play.by : pid;
      if (this.hands[this.turn].length === 0) this.turn = this.nextAfter(this.turn);
      this.notify();
      this.botTurn();
    }, REVEAL_MS);
    return { ok: true, truthful };
  }

  // ─── bots ───
  botTurn() {
    if (this.phase !== 'playing') return;
    const p = this.player(this.turn);
    if (!p || !p.isBot) return;
    const seq = this.seq;
    const turnId = p.id;
    this.later(() => {
      if (this.phase !== 'playing' || this.turn !== turnId || this.seq !== seq) return;
      const hand = this.hands[turnId];
      const byRank = {};
      for (const c of hand) (byRank[RANKS[c % 13]] ||= []).push(c);
      if (this.claimRank === null) {
        const [rank, cards] = Object.entries(byRank).sort((a, b) => b[1].length - a[1].length)[0];
        const play = cards.slice(0, 4);
        const spare = hand.filter(c => !play.includes(c));
        if (play.length < 4 && spare.length > 2 && BaseEngine.rand(3) === 0) play.push(spare[BaseEngine.rand(spare.length)]);
        this.play(turnId, play, rank);
        return;
      }
      const mine = byRank[this.claimRank] || [];
      if (mine.length) { this.play(turnId, mine.slice(0, 4), this.claimRank); return; }
      if (BaseEngine.rand(100) < 45 || hand.length === 0) { this.pass(turnId); return; }
      const n = 1 + (hand.length > 6 ? BaseEngine.rand(2) : 0);
      const lie = BaseEngine.shuffle(hand).slice(0, n);
      this.play(turnId, lie, this.claimRank);
    }, 1900 + BaseEngine.rand(1200));
  }

  botCalls() {
    const lp = this.lastPlay;
    if (!lp) return;
    for (const p of this.seated()) {
      if (!p.isBot || p.id === lp.by) continue;
      const known = this.hands[p.id].filter(c => RANKS[c % 13] === lp.rank).length;
      let chance = 10;
      if (known + lp.count > 4) chance = 100;
      else if (lp.by === this.pendingWinner) chance = 65;
      else if (lp.count >= 3) chance = 25;
      if (BaseEngine.rand(100) >= chance) continue;
      this.later(() => {
        if (this.phase === 'playing' && this.lastPlay && this.lastPlay.seq === lp.seq) this.call(p.id, lp.seq);
      }, 700 + BaseEngine.rand(1000));
    }
  }

  playerLeft(pid) {
    if (this.left.has(pid)) return;
    const wasTurn = this.turn === pid;
    const next = this.nextAfter(pid);
    this.left.add(pid);
    this.discarded += this.hands[pid].length;
    this.hands[pid] = [];
    this.say(`${this.name(pid)} left; their cards are out of the game.`);
    if (this.pendingWinner === pid) this.pendingWinner = null;
    if (this.seated().filter(p => !p.isBot).length < 1 || this.seated().length < 2) {
      this.abandoned = { by: this.name(pid) };
      return;
    }
    if (this.phase === 'playing' && wasTurn) { this.turn = next; this.botTurn(); }
  }

  getView(forId) {
    return {
      gameType: 'bluff',
      matchId: this.matchId,
      game: this.game,
      players: this.basePlayers().map(p => ({ ...p, cards: this.hands[p.id].length })),
      hand: (this.hands[forId] || []).map(card),
      phase: this.phase,
      turn: this.turn,
      claimRank: this.claimRank,
      pileCount: this.pile.reduce((n, p) => n + p.cards.length, 0),
      pilePlays: this.pile.map(p => ({ by: p.by, count: p.cards.length })),
      lastPlay: this.lastPlay,
      passes: this.passes,
      discarded: this.discarded,
      pendingWinner: this.pendingWinner,
      reveal: this.reveal,
      winner: this.winner,
      wins: { ...this.wins },
      log: this.log
    };
  }
}
