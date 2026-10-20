// Authoritative Tic-Tac-Toe Game Engine for RECESS
import { BaseEngine } from './base.mjs';

export class TttEngine extends BaseEngine {
  constructor(matchId, players, onUpdate, options) {
    super(matchId, players, onUpdate, options);
    this.symbols = {
      [players[0].id]: 'X',
      [players[1].id]: 'O'
    };
    this.scores = {
      [players[0].id]: 0,
      [players[1].id]: 0,
      ties: 0
    };
    this.round = 1;
    this.resetBoard();
  }

  resetBoard() {
    this.board = Array(9).fill(null);
    this.turn = this.round % 2 === 1 ? this.players[0].id : this.players[1].id;
    this.status = 'playing'; // 'playing' | 'won' | 'draw'
    this.winner = null; // playerId or null
    this.winningLine = null; // [a, b, c]
  }

  static WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
    [0, 4, 8], [2, 4, 6]             // Diags
  ];

  handleAction(playerId, action) {
    if (action.type === 'move') {
      return this.makeMove(playerId, action.cell);
    }
    if (action.type === 'rematch') {
      if (this.status !== 'playing') {
        this.round++;
        this.resetBoard();
        this.notify();
        this.checkBotTurn();
        return { ok: true };
      }
      return { ok: false, error: 'Match is still ongoing' };
    }
    return { ok: false, error: 'Unknown action' };
  }

  makeMove(playerId, cellIndex) {
    if (this.status !== 'playing') {
      return { ok: false, error: 'Game is over' };
    }
    if (this.turn !== playerId) {
      return { ok: false, error: 'Not your turn' };
    }
    if (cellIndex < 0 || cellIndex > 8 || !Number.isInteger(cellIndex)) {
      return { ok: false, error: 'Invalid cell index' };
    }
    if (this.board[cellIndex] !== null) {
      return { ok: false, error: 'Cell is already occupied' };
    }

    const symbol = this.symbols[playerId];
    this.board[cellIndex] = symbol;

    // Check win condition
    const win = this.checkWin();
    if (win) {
      this.status = 'won';
      this.winner = playerId;
      this.winningLine = win;
      this.scores[playerId] = (this.scores[playerId] || 0) + 1;
    } else if (this.board.every(c => c !== null)) {
      this.status = 'draw';
      this.scores.ties = (this.scores.ties || 0) + 1;
    } else {
      // Pass turn
      const nextP = this.players.find(p => p.id !== playerId);
      this.turn = nextP.id;
    }

    this.notify();
    this.checkBotTurn();
    return { ok: true };
  }

  checkWin() {
    for (const [a, b, c] of TttEngine.WIN_LINES) {
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        return [a, b, c];
      }
    }
    return null;
  }

  checkBotTurn() {
    if (this.status !== 'playing') return;
    const currentP = this.players.find(p => p.id === this.turn);
    if (currentP && currentP.isBot) {
      this.later(() => {
        if (this.status !== 'playing' || this.turn !== currentP.id) return;
        const cell = this.computeBotMove(currentP.id);
        if (cell !== null) {
          this.makeMove(currentP.id, cell);
        }
      }, 400);
    }
  }

  computeBotMove(botId) {
    const botSymbol = this.symbols[botId];
    const oppSymbol = botSymbol === 'X' ? 'O' : 'X';
    const emptyCells = this.board
      .map((val, idx) => (val === null ? idx : null))
      .filter(idx => idx !== null);

    if (emptyCells.length === 0) return null;

    // 1. Can bot win in one move?
    for (const cell of emptyCells) {
      this.board[cell] = botSymbol;
      if (this.checkWin()) {
        this.board[cell] = null;
        return cell;
      }
      this.board[cell] = null;
    }

    // 2. Can opponent win in one move? Block them!
    for (const cell of emptyCells) {
      this.board[cell] = oppSymbol;
      if (this.checkWin()) {
        this.board[cell] = null;
        return cell;
      }
      this.board[cell] = null;
    }

    // 3. Take center if free
    if (this.board[4] === null) return 4;

    // 4. Take corners
    const corners = [0, 2, 6, 8].filter(c => this.board[c] === null);
    if (corners.length > 0) {
      return corners[Math.floor(Math.random() * corners.length)];
    }

    // 5. Random empty
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  getView(forPlayerId) {
    return {
      gameType: 'ttt',
      matchId: this.matchId,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        symbol: this.symbols[p.id],
        isBot: !!p.isBot
      })),
      board: [...this.board],
      turn: this.turn,
      status: this.status,
      winner: this.winner,
      winningLine: this.winningLine,
      scores: { ...this.scores },
      round: this.round,
      mySymbol: this.symbols[forPlayerId] || null
    };
  }

}
