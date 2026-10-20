// Authoritative Dots and Boxes engine for RECESS. Board is size x size boxes (3, 4 or 5).
import { BaseEngine } from './base.mjs';

const COLORS = ['#2f6fde', '#e0563b'];
const SIZES = [3, 4, 5];

export class DotsEngine extends BaseEngine {
  constructor(matchId, players, onUpdate, options = {}) {
    super(matchId, players, onUpdate, options);
    this.colors = { [players[0].id]: COLORS[0], [players[1].id]: COLORS[1] };
    this.initials = Object.fromEntries(players.map((p, i) => [p.id, (p.name.charAt(0) || 'AB'[i]).toUpperCase()]));
    this.wins = { [players[0].id]: 0, [players[1].id]: 0 };
    this.size = SIZES.includes(options.size) ? options.size : 3;
    this.round = 1;
    this.resetBoard();
  }

  resetBoard() {
    const n = this.size;
    this.hLines = Array.from({ length: n + 1 }, () => Array(n).fill(null));
    this.vLines = Array.from({ length: n }, () => Array(n + 1).fill(null));
    this.boxes = Array.from({ length: n }, () => Array(n).fill(null));
    this.scores = { [this.players[0].id]: 0, [this.players[1].id]: 0 };
    this.turn = this.players[(this.round - 1) % 2].id;
    this.status = 'playing'; // 'playing' | 'won' | 'draw'
    this.winner = null;
    this.lastLine = null;
    this.lastClaimedBoxes = [];
    this.checkBotTurn();
  }

  handleAction(playerId, action) {
    if (action.type === 'move') return this.makeMove(playerId, action.lineType, action.r, action.c);
    if (action.type === 'rematch') {
      if (this.status === 'playing') return { ok: false, error: 'Match is still ongoing' };
      if (SIZES.includes(action.size)) this.size = action.size;
      this.round++;
      this.resetBoard();
      this.notify();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown action' };
  }

  makeMove(playerId, lineType, r, c) {
    if (this.status !== 'playing') return { ok: false, error: 'Game is over' };
    if (this.turn !== playerId) return { ok: false, error: 'Not your turn' };
    if (!Number.isInteger(r) || !Number.isInteger(c)) return { ok: false, error: 'Out of bounds' };
    const n = this.size;
    let lines;
    if (lineType === 'h') {
      if (r < 0 || r > n || c < 0 || c >= n) return { ok: false, error: 'Out of bounds' };
      lines = this.hLines;
    } else if (lineType === 'v') {
      if (r < 0 || r >= n || c < 0 || c > n) return { ok: false, error: 'Out of bounds' };
      lines = this.vLines;
    } else {
      return { ok: false, error: 'Invalid line type' };
    }
    if (lines[r][c] !== null) return { ok: false, error: 'Line already drawn' };

    lines[r][c] = playerId;
    this.lastLine = { lineType, r, c, by: playerId };
    const completed = this.claimBoxes(playerId);
    this.lastClaimedBoxes = completed;
    if (completed.length) this.scores[playerId] += completed.length; // completing a box keeps the turn
    else this.turn = this.players.find(p => p.id !== playerId).id;

    if (this.boxes.every(row => row.every(b => b !== null))) {
      const [a, b] = this.players.map(p => p.id);
      if (this.scores[a] === this.scores[b]) this.status = 'draw';
      else {
        this.status = 'won';
        this.winner = this.scores[a] > this.scores[b] ? a : b;
        this.wins[this.winner]++;
      }
    }
    this.notify();
    this.checkBotTurn();
    return { ok: true, completedBoxes: completed };
  }

  sides(r, c, extra) {
    const has = (t, rr, cc) => (t === 'h' ? this.hLines : this.vLines)[rr][cc] !== null ||
      (extra && extra.lineType === t && extra.r === rr && extra.c === cc);
    return has('h', r, c) + has('h', r + 1, c) + has('v', r, c) + has('v', r, c + 1);
  }

  claimBoxes(playerId) {
    const done = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.boxes[r][c] === null && this.sides(r, c) === 4) {
          this.boxes[r][c] = { owner: playerId, initial: this.initials[playerId], color: this.colors[playerId] };
          done.push({ r, c });
        }
      }
    }
    return done;
  }

  freeLines() {
    const out = [];
    const n = this.size;
    for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) if (this.hLines[r][c] === null) out.push({ lineType: 'h', r, c });
    for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) if (this.vLines[r][c] === null) out.push({ lineType: 'v', r, c });
    return out;
  }

  boxesTouching(line) {
    const out = [];
    const n = this.size;
    if (line.lineType === 'h') {
      if (line.r > 0) out.push([line.r - 1, line.c]);
      if (line.r < n) out.push([line.r, line.c]);
    } else {
      if (line.c > 0) out.push([line.r, line.c - 1]);
      if (line.c < n) out.push([line.r, line.c]);
    }
    return out;
  }

  computeBotMove() {
    const free = this.freeLines();
    if (!free.length) return null;
    const completes = free.find(l => this.boxesTouching(l).some(([r, c]) => this.boxes[r][c] === null && this.sides(r, c, l) === 4));
    if (completes) return completes;
    const safe = free.filter(l => !this.boxesTouching(l).some(([r, c]) => this.boxes[r][c] === null && this.sides(r, c, l) === 3));
    const pool = safe.length ? safe : free;
    return pool[BaseEngine.rand(pool.length)];
  }

  checkBotTurn() {
    if (this.status !== 'playing') return;
    const p = this.player(this.turn);
    if (!p || !p.isBot) return;
    this.later(() => {
      if (this.status !== 'playing' || this.turn !== p.id) return;
      const m = this.computeBotMove();
      if (m) this.makeMove(p.id, m.lineType, m.r, m.c);
    }, 650);
  }

  getView(forPlayerId) {
    return {
      gameType: 'dots',
      matchId: this.matchId,
      size: this.size,
      players: this.basePlayers().map(p => ({ ...p, color: this.colors[p.id], initial: this.initials[p.id] })),
      hLines: this.hLines.map(row => [...row]),
      vLines: this.vLines.map(row => [...row]),
      boxes: this.boxes.map(row => [...row]),
      turn: this.turn,
      status: this.status,
      winner: this.winner,
      scores: { ...this.scores },
      wins: { ...this.wins },
      round: this.round,
      lastLine: this.lastLine,
      lastClaimedBoxes: this.lastClaimedBoxes,
      myColor: this.colors[forPlayerId] || null
    };
  }
}
