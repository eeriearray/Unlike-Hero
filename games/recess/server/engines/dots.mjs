// Authoritative Dots and Boxes Game Engine for RECESS (4x4 dots = 9 boxes)
export class DotsEngine {
  constructor(matchId, players, onUpdate) {
    this.matchId = matchId;
    this.players = players; // [{ id, name, avatar, isBot }]
    this.onUpdate = onUpdate;
    this.colors = {
      [players[0].id]: '#3b82f6', // blue ink
      [players[1].id]: '#ef4444'  // red ink
    };
    this.initials = {
      [players[0].id]: players[0].name.charAt(0).toUpperCase() || 'A',
      [players[1].id]: players[1].name.charAt(0).toUpperCase() || 'B'
    };
    this.scores = {
      [players[0].id]: 0,
      [players[1].id]: 0
    };
    this.round = 1;
    this.resetBoard();
  }

  resetBoard() {
    this.rows = 3; // 3x3 boxes (4x4 dots)
    this.cols = 3;
    // Horizontal lines: 4 rows of 3 lines = 12
    this.hLines = Array(4).fill(null).map(() => Array(3).fill(null));
    // Vertical lines: 3 rows of 4 lines = 12
    this.vLines = Array(3).fill(null).map(() => Array(4).fill(null));
    // Boxes: 3 rows of 3 boxes = 9
    this.boxes = Array(3).fill(null).map(() => Array(3).fill(null));

    this.turn = this.round % 2 === 1 ? this.players[0].id : this.players[1].id;
    this.status = 'playing'; // 'playing' | 'won' | 'draw'
    this.winner = null;
    this.lastClaimedBoxes = [];
  }

  handleAction(playerId, action) {
    if (action.type === 'move') {
      return this.makeMove(playerId, action.lineType, action.r, action.c);
    }
    if (action.type === 'rematch') {
      if (this.status !== 'playing') {
        this.round++;
        this.scores = {
          [this.players[0].id]: 0,
          [this.players[1].id]: 0
        };
        this.resetBoard();
        this.notify();
        this.checkBotTurn();
        return { ok: true };
      }
      return { ok: false, error: 'Match is still ongoing' };
    }
    return { ok: false, error: 'Unknown action' };
  }

  makeMove(playerId, lineType, r, c) {
    if (this.status !== 'playing') return { ok: false, error: 'Game is over' };
    if (this.turn !== playerId) return { ok: false, error: 'Not your turn' };

    let lineArray;
    if (lineType === 'h') {
      if (r < 0 || r > 3 || c < 0 || c > 2) return { ok: false, error: 'Out of bounds' };
      lineArray = this.hLines;
    } else if (lineType === 'v') {
      if (r < 0 || r > 2 || c < 0 || c > 3) return { ok: false, error: 'Out of bounds' };
      lineArray = this.vLines;
    } else {
      return { ok: false, error: 'Invalid line type' };
    }

    if (lineArray[r][c] !== null) {
      return { ok: false, error: 'Line already drawn' };
    }

    lineArray[r][c] = playerId;

    // Check newly completed boxes
    const completed = this.checkCompletedBoxes(playerId);
    this.lastClaimedBoxes = completed;

    if (completed.length > 0) {
      this.scores[playerId] = (this.scores[playerId] || 0) + completed.length;
      // Bonus turn awarded for completing a box! Turn does not pass.
    } else {
      // Pass turn
      const nextP = this.players.find(p => p.id !== playerId);
      this.turn = nextP.id;
    }

    // Check game over (all 9 boxes filled)
    let totalBoxes = 0;
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        if (this.boxes[br][bc] !== null) totalBoxes++;
      }
    }

    if (totalBoxes === 9) {
      const p1 = this.players[0].id;
      const p2 = this.players[1].id;
      if (this.scores[p1] > this.scores[p2]) {
        this.status = 'won';
        this.winner = p1;
      } else if (this.scores[p2] > this.scores[p1]) {
        this.status = 'won';
        this.winner = p2;
      } else {
        this.status = 'draw';
      }
    }

    this.notify();
    this.checkBotTurn();
    return { ok: true, completedBoxes: completed };
  }

  checkCompletedBoxes(playerId) {
    const newlyCompleted = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (this.boxes[r][c] === null) {
          const top = this.hLines[r][c] !== null;
          const bottom = this.hLines[r + 1][c] !== null;
          const left = this.vLines[r][c] !== null;
          const right = this.vLines[r][c + 1] !== null;

          if (top && bottom && left && right) {
            this.boxes[r][c] = {
              owner: playerId,
              initial: this.initials[playerId],
              color: this.colors[playerId]
            };
            newlyCompleted.push({ r, c });
          }
        }
      }
    }
    return newlyCompleted;
  }

  checkBotTurn() {
    if (this.status !== 'playing') return;
    const currentP = this.players.find(p => p.id === this.turn);
    if (currentP && currentP.isBot) {
      setTimeout(() => {
        if (this.status !== 'playing' || this.turn !== currentP.id) return;
        const move = this.computeBotMove();
        if (move) {
          this.makeMove(currentP.id, move.lineType, move.r, move.c);
        }
      }, 500);
    }
  }

  computeBotMove() {
    const availableLines = [];
    // H lines
    for (let r = 0; r <= 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (this.hLines[r][c] === null) availableLines.push({ lineType: 'h', r, c });
      }
    }
    // V lines
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c <= 3; c++) {
        if (this.vLines[r][c] === null) availableLines.push({ lineType: 'v', r, c });
      }
    }

    if (availableLines.length === 0) return null;

    // 1. Look for any line that completes a box!
    for (const line of availableLines) {
      if (this.wouldCompleteBox(line)) {
        return line;
      }
    }

    // 2. Look for safe lines that do NOT leave 3 sides on any box
    const safeLines = availableLines.filter(line => !this.wouldCreateThreeSidedBox(line));
    if (safeLines.length > 0) {
      return safeLines[Math.floor(Math.random() * safeLines.length)];
    }

    // 3. Otherwise pick randomly
    return availableLines[Math.floor(Math.random() * availableLines.length)];
  }

  countSides(r, c, testLine = null) {
    let count = 0;
    const top = this.hLines[r][c] !== null || (testLine && testLine.lineType === 'h' && testLine.r === r && testLine.c === c);
    const bottom = this.hLines[r + 1][c] !== null || (testLine && testLine.lineType === 'h' && testLine.r === r + 1 && testLine.c === c);
    const left = this.vLines[r][c] !== null || (testLine && testLine.lineType === 'v' && testLine.r === r && testLine.c === c);
    const right = this.vLines[r][c + 1] !== null || (testLine && testLine.lineType === 'v' && testLine.r === r && testLine.c === c + 1);

    if (top) count++;
    if (bottom) count++;
    if (left) count++;
    if (right) count++;
    return count;
  }

  wouldCompleteBox(line) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (this.boxes[r][c] === null && this.countSides(r, c, line) === 4) {
          return true;
        }
      }
    }
    return false;
  }

  wouldCreateThreeSidedBox(line) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (this.boxes[r][c] === null && this.countSides(r, c, line) === 3) {
          return true;
        }
      }
    }
    return false;
  }

  getView(forPlayerId) {
    return {
      gameType: 'dots',
      matchId: this.matchId,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        color: this.colors[p.id],
        initial: this.initials[p.id],
        isBot: !!p.isBot
      })),
      hLines: this.hLines.map(row => [...row]),
      vLines: this.vLines.map(row => [...row]),
      boxes: this.boxes.map(row => [...row]),
      turn: this.turn,
      status: this.status,
      winner: this.winner,
      scores: { ...this.scores },
      round: this.round,
      myColor: this.colors[forPlayerId] || null
    };
  }

  notify() {
    if (this.onUpdate) this.onUpdate();
  }
}
