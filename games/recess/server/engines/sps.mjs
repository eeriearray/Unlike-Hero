// Authoritative Stone Paper Scissors Engine for RECESS
export class SpsEngine {
  constructor(matchId, players, onUpdate) {
    this.matchId = matchId;
    this.players = players; // [{ id, name, avatar, isBot }]
    this.onUpdate = onUpdate;
    this.scores = {
      [players[0].id]: 0,
      [players[1].id]: 0,
      ties: 0
    };
    this.round = 1;
    this.choices = {}; // { [playerId]: 'stone' | 'paper' | 'scissors' }
    this.status = 'choosing'; // 'choosing' | 'revealed'
    this.lastResult = null; // { winnerId, p1Choice, p2Choice, outcome: 'p1'|'p2'|'tie' }

    this.checkBotTurn();
  }

  static VALID_CHOICES = ['stone', 'paper', 'scissors'];

  static BEATS = {
    stone: 'scissors',
    scissors: 'paper',
    paper: 'stone'
  };

  handleAction(playerId, action) {
    if (action.type === 'choose') {
      return this.makeChoice(playerId, action.choice);
    }
    if (action.type === 'next-round') {
      if (this.status === 'revealed') {
        this.round++;
        this.choices = {};
        this.status = 'choosing';
        this.lastResult = null;
        this.notify();
        this.checkBotTurn();
        return { ok: true };
      }
      return { ok: false, error: 'Round not finished' };
    }
    return { ok: false, error: 'Unknown action' };
  }

  makeChoice(playerId, choice) {
    if (this.status !== 'choosing') {
      return { ok: false, error: 'Round already resolved' };
    }
    if (!SpsEngine.VALID_CHOICES.includes(choice)) {
      return { ok: false, error: 'Invalid choice' };
    }
    if (this.choices[playerId]) {
      return { ok: false, error: 'Already chose' };
    }

    this.choices[playerId] = choice;

    // Check if both players have chosen
    const p1 = this.players[0].id;
    const p2 = this.players[1].id;

    if (this.choices[p1] && this.choices[p2]) {
      this.resolveRound(p1, p2);
    }

    this.notify();
    this.checkBotTurn();
    return { ok: true };
  }

  resolveRound(p1Id, p2Id) {
    const c1 = this.choices[p1Id];
    const c2 = this.choices[p2Id];
    let outcome = 'tie';
    let roundWinner = null;

    if (c1 === c2) {
      outcome = 'tie';
      this.scores.ties = (this.scores.ties || 0) + 1;
    } else if (SpsEngine.BEATS[c1] === c2) {
      outcome = 'p1';
      roundWinner = p1Id;
      this.scores[p1Id] = (this.scores[p1Id] || 0) + 1;
    } else {
      outcome = 'p2';
      roundWinner = p2Id;
      this.scores[p2Id] = (this.scores[p2Id] || 0) + 1;
    }

    this.status = 'revealed';
    this.lastResult = {
      outcome,
      winnerId: roundWinner,
      p1Choice: c1,
      p2Choice: c2,
      choices: { [p1Id]: c1, [p2Id]: c2 }
    };
  }

  checkBotTurn() {
    if (this.status !== 'choosing') return;
    for (const p of this.players) {
      if (p.isBot && !this.choices[p.id]) {
        setTimeout(() => {
          if (this.status !== 'choosing' || this.choices[p.id]) return;
          const choice = SpsEngine.VALID_CHOICES[Math.floor(Math.random() * 3)];
          this.makeChoice(p.id, choice);
        }, 500);
      }
    }
  }

  getView(forPlayerId) {
    const p1Id = this.players[0].id;
    const p2Id = this.players[1].id;

    // Secret information guarantee:
    // During choosing, a player only sees THEIR OWN choice, NEVER the opponent's!
    const visibleChoices = {};
    for (const p of this.players) {
      if (this.status === 'revealed') {
        visibleChoices[p.id] = this.choices[p.id] || null;
      } else {
        if (p.id === forPlayerId) {
          visibleChoices[p.id] = this.choices[p.id] || null;
        } else {
          visibleChoices[p.id] = null; // HIDDEN until reveal!
        }
      }
    }

    return {
      gameType: 'sps',
      matchId: this.matchId,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        hasChosen: !!this.choices[p.id],
        isBot: !!p.isBot
      })),
      round: this.round,
      status: this.status,
      scores: { ...this.scores },
      choices: visibleChoices,
      lastResult: this.lastResult,
      myChoice: this.choices[forPlayerId] || null
    };
  }

  notify() {
    if (this.onUpdate) this.onUpdate();
  }
}
