// Authoritative Raja Mantri Chor Sipahi Game Engine for RECESS (4 players)
export class RmcsEngine {
  constructor(matchId, players, onUpdate) {
    this.matchId = matchId;
    this.players = players; // Array of 4 players [{ id, name, avatar, isBot }]
    this.onUpdate = onUpdate;
    this.scores = {};
    for (const p of players) {
      this.scores[p.id] = 0;
    }
    this.round = 1;
    this.history = []; // Array of round results
    this.startRound();
  }

  static ROLES = [
    { id: 'raja', name: 'Raja 👑', hindi: 'राजा', points: 1000, description: 'King — Commands the court' },
    { id: 'mantri', name: 'Mantri 📜', hindi: 'मंत्री', points: 800, description: 'Minister — Must identify the Chor' },
    { id: 'sipahi', name: 'Sipahi ⚔️', hindi: 'सिपाही', points: 500, description: 'Soldier — Loyal defender' },
    { id: 'chor', name: 'Chor 🎭', hindi: 'चोर', points: 0, description: 'Thief — Blend in and deceive!' }
  ];

  startRound() {
    this.phase = 'dealing'; // 'dealing' | 'announcing' | 'guessing' | 'verdict'
    this.roles = {}; // { [playerId]: roleId }
    this.revealed = {}; // { [playerId]: boolean }
    this.guess = null; // { guessedPlayerId, isCorrect }
    this.roundPoints = {}; // { [playerId]: points }
    this.verdictMessage = '';

    // Shuffle roles and assign to players
    const shuffledRoles = [...RmcsEngine.ROLES].sort(() => Math.random() - 0.5);
    this.players.forEach((p, idx) => {
      this.roles[p.id] = shuffledRoles[idx].id;
      this.revealed[p.id] = false;
      this.roundPoints[p.id] = 0;
    });

    this.rajaId = this.findPlayerByRole('raja');
    this.mantriId = this.findPlayerByRole('mantri');
    this.sipahiId = this.findPlayerByRole('sipahi');
    this.chorId = this.findPlayerByRole('chor');

    // Automatically transition dealing -> announcing after paper chit animation
    setTimeout(() => {
      if (this.phase !== 'dealing') return;
      this.phase = 'announcing';
      // Raja and Mantri reveal themselves
      this.revealed[this.rajaId] = true;
      this.revealed[this.mantriId] = true;
      this.notify();

      // Transition to guessing
      setTimeout(() => {
        if (this.phase !== 'announcing') return;
        this.phase = 'guessing';
        this.notify();
        this.checkBotGuess();
      }, 1500);
    }, 1200);
  }

  findPlayerByRole(roleId) {
    return this.players.find(p => this.roles[p.id] === roleId)?.id;
  }

  handleAction(playerId, action) {
    if (action.type === 'guess') {
      return this.makeGuess(playerId, action.suspectId);
    }
    if (action.type === 'next-round') {
      if (this.phase === 'verdict') {
        this.round++;
        this.startRound();
        this.notify();
        return { ok: true };
      }
      return { ok: false, error: 'Round not over' };
    }
    return { ok: false, error: 'Unknown action' };
  }

  makeGuess(playerId, suspectId) {
    if (this.phase !== 'guessing') {
      return { ok: false, error: 'Not in guessing phase' };
    }
    if (playerId !== this.mantriId) {
      return { ok: false, error: 'Only Mantri can guess the Chor' };
    }
    if (suspectId === this.rajaId || suspectId === this.mantriId) {
      return { ok: false, error: 'Cannot accuse Raja or Mantri' };
    }
    if (!this.players.some(p => p.id === suspectId)) {
      return { ok: false, error: 'Invalid suspect' };
    }

    const isCorrect = suspectId === this.chorId;
    this.guess = {
      mantriId: playerId,
      suspectId,
      isCorrect
    };

    // Calculate points
    this.roundPoints[this.rajaId] = 1000;
    this.roundPoints[this.sipahiId] = 500;

    if (isCorrect) {
      // Mantri caught the Chor!
      this.roundPoints[this.mantriId] = 800;
      this.roundPoints[this.chorId] = 0;
      this.verdictMessage = '🎯 Sahi Pakde Hain! The Mantri correctly identified the Chor!';
    } else {
      // Chor escaped and steals Mantri's points!
      this.roundPoints[this.mantriId] = 0;
      this.roundPoints[this.chorId] = 800;
      this.verdictMessage = '💨 Chor Bhaag Gaya! The Chor fooled the Mantri and stole 800 points!';
    }

    // Accumulate total scores
    for (const p of this.players) {
      this.scores[p.id] = (this.scores[p.id] || 0) + this.roundPoints[p.id];
      this.revealed[p.id] = true; // All roles revealed in verdict!
    }

    this.phase = 'verdict';
    this.history.push({
      round: this.round,
      guess: this.guess,
      points: { ...this.roundPoints }
    });

    this.notify();
    return { ok: true, isCorrect };
  }

  checkBotGuess() {
    if (this.phase !== 'guessing') return;
    const mantriPlayer = this.players.find(p => p.id === this.mantriId);
    if (mantriPlayer && mantriPlayer.isBot) {
      setTimeout(() => {
        if (this.phase !== 'guessing') return;
        // Suspects are Sipahi and Chor
        const suspects = [this.sipahiId, this.chorId];
        // 55% chance bot guesses correctly
        const chosen = Math.random() < 0.55 ? this.chorId : this.sipahiId;
        this.makeGuess(this.mantriId, chosen);
      }, 1600);
    }
  }

  getView(forPlayerId) {
    // Secret information guarantee:
    // Only your role is visible, plus Raja and Mantri once announced.
    // Sipahi and Chor are HIDDEN until 'verdict'!
    const playerViews = this.players.map(p => {
      const isSelf = p.id === forPlayerId;
      const isPublic = this.revealed[p.id] || this.phase === 'verdict';
      const roleId = (isSelf || isPublic) ? this.roles[p.id] : null;
      const roleDef = roleId ? RmcsEngine.ROLES.find(r => r.id === roleId) : null;

      return {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isBot: !!p.isBot,
        isRaja: p.id === this.rajaId && (this.revealed[p.id] || isSelf),
        isMantri: p.id === this.mantriId && (this.revealed[p.id] || isSelf),
        isSuspect: (p.id === this.sipahiId || p.id === this.chorId) && this.phase === 'guessing',
        role: roleDef ? { id: roleDef.id, name: roleDef.name, points: roleDef.points } : null,
        roundPoints: this.phase === 'verdict' ? this.roundPoints[p.id] : null,
        score: this.scores[p.id] || 0
      };
    });

    const myRole = this.roles[forPlayerId];
    const myRoleDef = myRole ? RmcsEngine.ROLES.find(r => r.id === myRole) : null;

    return {
      gameType: 'rmcs',
      matchId: this.matchId,
      round: this.round,
      phase: this.phase,
      players: playerViews,
      rajaId: this.phase !== 'dealing' ? this.rajaId : null,
      mantriId: this.phase !== 'dealing' ? this.mantriId : null,
      myRole: myRoleDef ? { id: myRoleDef.id, name: myRoleDef.name, points: myRoleDef.points, description: myRoleDef.description } : null,
      guess: this.guess,
      verdictMessage: this.verdictMessage,
      scores: { ...this.scores }
    };
  }

  notify() {
    if (this.onUpdate) this.onUpdate();
  }
}
