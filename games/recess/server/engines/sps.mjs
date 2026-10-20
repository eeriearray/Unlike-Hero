// Authoritative Stone Paper Scissors engine for RECESS.
// Both choices are held on the server and only included in views once both are locked.
import { BaseEngine } from './base.mjs';

export class SpsEngine extends BaseEngine {
  static VALID_CHOICES = ['stone', 'paper', 'scissors'];
  static BEATS = { stone: 'scissors', scissors: 'paper', paper: 'stone' };

  constructor(matchId, players, onUpdate, options = {}) {
    super(matchId, players, onUpdate, options);
    this.bestOf = [3, 5].includes(options.bestOf) ? options.bestOf : 3;
    this.matchNo = 1;
    this.resetMatch();
  }

  resetMatch() {
    this.scores = { [this.players[0].id]: 0, [this.players[1].id]: 0, ties: 0 };
    this.round = 1;
    this.choices = {};
    this.status = 'choosing'; // 'choosing' | 'revealed' | 'finished'
    this.lastResult = null;
    this.matchWinner = null;
    this.history = [];
    this.checkBotTurn();
  }

  get toWin() { return Math.ceil(this.bestOf / 2); }

  handleAction(playerId, action) {
    if (action.type === 'choose') return this.makeChoice(playerId, action.choice);
    if (action.type === 'next-round') {
      if (this.status !== 'revealed') return { ok: false, error: 'Round not finished' };
      this.round++;
      this.choices = {};
      this.status = 'choosing';
      this.lastResult = null;
      this.notify();
      this.checkBotTurn();
      return { ok: true };
    }
    if (action.type === 'best-of') {
      // Either player can change the length before anyone has played in this match.
      if (![3, 5].includes(action.bestOf)) return { ok: false, error: 'Best of 3 or 5 only' };
      if (this.history.length || Object.keys(this.choices).length) return { ok: false, error: 'The match has already started' };
      this.bestOf = action.bestOf;
      this.notify();
      return { ok: true };
    }
    if (action.type === 'rematch') {
      if (this.status !== 'finished') return { ok: false, error: 'Match is still going' };
      if ([3, 5].includes(action.bestOf)) this.bestOf = action.bestOf;
      this.matchNo++;
      this.resetMatch();
      this.notify();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown action' };
  }

  makeChoice(playerId, choice) {
    if (!this.player(playerId)) return { ok: false, error: 'Not in this match' };
    if (this.status !== 'choosing') return { ok: false, error: 'Round already resolved' };
    if (!SpsEngine.VALID_CHOICES.includes(choice)) return { ok: false, error: 'Invalid choice' };
    if (this.choices[playerId]) return { ok: false, error: 'Already chose' };

    this.choices[playerId] = choice;
    const [p1, p2] = this.players.map(p => p.id);
    if (this.choices[p1] && this.choices[p2]) this.resolveRound(p1, p2);

    this.notify();
    return { ok: true };
  }

  resolveRound(p1Id, p2Id) {
    const c1 = this.choices[p1Id];
    const c2 = this.choices[p2Id];
    let outcome = 'tie';
    let winnerId = null;
    if (c1 === c2) {
      this.scores.ties++;
    } else if (SpsEngine.BEATS[c1] === c2) {
      outcome = 'p1'; winnerId = p1Id; this.scores[p1Id]++;
    } else {
      outcome = 'p2'; winnerId = p2Id; this.scores[p2Id]++;
    }
    this.lastResult = { outcome, winnerId, p1Choice: c1, p2Choice: c2, choices: { [p1Id]: c1, [p2Id]: c2 } };
    this.history.push({ round: this.round, winnerId, choices: { [p1Id]: c1, [p2Id]: c2 } });
    this.status = 'revealed';
    for (const id of [p1Id, p2Id]) {
      if (this.scores[id] >= this.toWin) {
        this.status = 'finished';
        this.matchWinner = id;
      }
    }
  }

  checkBotTurn() {
    if (this.status !== 'choosing') return;
    for (const p of this.players) {
      if (p.isBot && !this.choices[p.id]) {
        this.later(() => {
          if (this.status !== 'choosing' || this.choices[p.id]) return;
          this.makeChoice(p.id, SpsEngine.VALID_CHOICES[BaseEngine.rand(3)]);
        }, 700 + BaseEngine.rand(900));
      }
    }
  }

  getView(forPlayerId) {
    const visibleChoices = {};
    for (const p of this.players) {
      const show = this.status !== 'choosing' || p.id === forPlayerId;
      visibleChoices[p.id] = show ? (this.choices[p.id] || null) : null;
    }
    return {
      gameType: 'sps',
      matchId: this.matchId,
      players: this.basePlayers().map(p => ({ ...p, hasChosen: !!this.choices[p.id] })),
      round: this.round,
      bestOf: this.bestOf,
      toWin: this.toWin,
      status: this.status,
      scores: { ...this.scores },
      choices: visibleChoices,
      lastResult: this.lastResult,
      matchWinner: this.matchWinner,
      history: this.history,
      matchNo: this.matchNo,
      myChoice: this.choices[forPlayerId] || null
    };
  }
}
