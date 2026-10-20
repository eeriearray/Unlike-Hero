// Ludo for RECESS. The server rolls dice and validates every move.
//
// Token progress: -1 in base, 0..50 on the shared track (counted from the owner's start square),
// 51..55 up the owner's home lane, 56 home.
// Rules: a 6 brings a token out; a 6 gives another roll, but a third 6 in a row ends the turn;
// capturing sends the victim to base and gives a bonus roll; reaching home gives a bonus roll;
// start squares and star squares are safe; the exact roll is needed to get home.
import { BaseEngine } from './base.mjs';

export const SEAT_COLORS = ['red', 'green', 'yellow', 'blue'];
export const START = { red: 0, green: 13, yellow: 26, blue: 39 };
export const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
const HOME = 56;

export class LudoEngine extends BaseEngine {
  constructor(matchId, players, onUpdate, options) {
    super(matchId, players, onUpdate, options);
    const layout = { 2: ['red', 'yellow'], 3: ['red', 'green', 'yellow'], 4: SEAT_COLORS }[players.length] || SEAT_COLORS;
    this.colors = Object.fromEntries(players.map((p, i) => [p.id, layout[i]]));
    this.wins = Object.fromEntries(players.map(p => [p.id, 0]));
    this.game = 0;
    this.reset();
  }

  reset() {
    this.game++;
    this.tokens = Object.fromEntries(this.players.map(p => [p.id, [-1, -1, -1, -1]]));
    const seats = this.activePlayers();
    this.turn = seats[(this.game - 1) % seats.length].id;
    this.phase = 'roll'; // 'roll' | 'move' | 'finished'
    this.dice = null;
    this.sixes = 0;
    this.winner = null;
    this.last = null; // { seq, by, roll, token, from, to, captured: [{pid, token}], note }
    this.seq = 0;
    this.finishOrder = [];
    this.botTurn();
  }

  abs(pid, prog) { return (START[this.colors[pid]] + prog) % 52; }

  legalMoves(pid, roll) {
    const out = [];
    this.tokens[pid].forEach((p, i) => {
      if (p === HOME) return;
      if (p === -1) { if (roll === 6) out.push(i); return; }
      if (p + roll <= HOME) out.push(i);
    });
    return out;
  }

  handleAction(pid, a) {
    if (a.type === 'roll') return this.roll(pid);
    if (a.type === 'move') return this.move(pid, a.token);
    if (a.type === 'rematch') {
      if (this.phase !== 'finished') return { ok: false, error: 'Game still going' };
      this.reset();
      this.notify();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown action' };
  }

  roll(pid) {
    if (this.phase !== 'roll') return { ok: false, error: this.phase === 'move' ? 'Move a token first' : 'Game over' };
    if (this.turn !== pid) return { ok: false, error: 'Not your turn' };
    if (this.busyUntil && Date.now() < this.busyUntil) return { ok: false, error: 'Wait for the token to stop' };
    const roll = 1 + BaseEngine.rand(6);
    this.dice = { value: roll, seq: ++this.seq, by: pid };
    if (roll === 6) this.sixes++;
    if (this.sixes === 3) {
      this.last = { seq: this.seq, by: pid, roll, note: 'three-sixes' };
      this.endTurn(pid, false);
      this.notify();
      this.botTurn();
      return { ok: true, roll };
    }
    const moves = this.legalMoves(pid, roll);
    if (!moves.length) {
      this.last = { seq: this.seq, by: pid, roll, note: 'no-move' };
      this.endTurn(pid, roll === 6);
      this.busyUntil = Date.now() + 700;
    } else {
      this.phase = 'move';
      this.movable = moves;
      // Only one thing to do: do it for them after the die has landed.
      const unique = new Set(moves.map(i => this.tokens[pid][i])).size === 1;
      if (unique) {
        const seq = this.seq;
        this.later(() => { if (this.phase === 'move' && this.seq === seq) this.move(pid, moves[0]); }, 750);
      }
    }
    this.notify();
    this.botTurn();
    return { ok: true, roll };
  }

  move(pid, token) {
    if (this.phase !== 'move') return { ok: false, error: 'Roll first' };
    if (this.turn !== pid) return { ok: false, error: 'Not your turn' };
    if (!this.movable.includes(token)) return { ok: false, error: 'That token cannot move' };
    const roll = this.dice.value;
    const from = this.tokens[pid][token];
    const to = from === -1 ? 0 : from + roll;
    this.tokens[pid][token] = to;
    const captured = [];
    if (to <= 50) {
      const square = this.abs(pid, to);
      if (!SAFE.includes(square)) {
        for (const p of this.activePlayers()) {
          if (p.id === pid) continue;
          this.tokens[p.id].forEach((t, i) => {
            if (t >= 0 && t <= 50 && this.abs(p.id, t) === square) {
              this.tokens[p.id][i] = -1;
              captured.push({ pid: p.id, token: i, from: t });
            }
          });
        }
      }
    }
    const reachedHome = to === HOME;
    this.last = { seq: ++this.seq, by: pid, roll, token, from, to, captured, note: reachedHome ? 'home' : (captured.length ? 'capture' : null) };
    const steps = from === -1 ? 1 : roll;
    this.busyUntil = Date.now() + 250 + steps * 170 + (captured.length ? 500 : 0);

    if (this.tokens[pid].every(t => t === HOME)) {
      this.phase = 'finished';
      this.winner = pid;
      this.wins[pid]++;
      this.turn = null;
      this.announce(`${this.player(pid).name} got all four tokens home in Ludo!`);
      this.notify();
      return { ok: true };
    }
    this.endTurn(pid, roll === 6 || captured.length > 0 || reachedHome);
    this.notify();
    this.botTurn();
    return { ok: true };
  }

  endTurn(pid, again) {
    this.phase = 'roll';
    this.movable = [];
    if (again) return;
    this.sixes = 0;
    this.turn = this.nextAfter(pid);
  }

  nextAfter(pid) {
    const seats = this.activePlayers();
    const i = seats.findIndex(p => p.id === pid);
    return seats[(i + 1) % seats.length].id;
  }

  botTurn() {
    if (this.phase === 'finished') return;
    const p = this.player(this.turn);
    if (!p?.isBot) return;
    const seq = this.seq;
    const wait = Math.max(0, (this.busyUntil || 0) - Date.now()) + 650;
    this.later(() => {
      if (this.turn !== p.id || this.seq !== seq) return;
      if (this.phase === 'roll') this.roll(p.id);
      else if (this.phase === 'move') this.move(p.id, this.pickBotMove(p.id));
    }, wait);
  }

  pickBotMove(pid) {
    const roll = this.dice.value;
    let best = this.movable[0], bestScore = -1e9;
    for (const i of this.movable) {
      const from = this.tokens[pid][i];
      const to = from === -1 ? 0 : from + roll;
      let score = to;
      if (to === HOME) score += 100;
      if (from === -1) score += 40;
      if (to <= 50) {
        const sq = this.abs(pid, to);
        const victims = this.activePlayers().filter(p => p.id !== pid)
          .some(p => this.tokens[p.id].some(t => t >= 0 && t <= 50 && this.abs(p.id, t) === sq));
        if (victims && !SAFE.includes(sq)) score += 80;
        if (SAFE.includes(sq)) score += 15;
      }
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  playerLeft(pid) {
    if (this.left.has(pid)) return;
    const wasTurn = this.turn === pid;
    const next = this.nextAfter(pid);
    this.left.add(pid);
    if (this.activePlayers().length < 2 || !this.activePlayers().some(p => !p.isBot)) {
      this.abandoned = { by: this.player(pid)?.name || 'A player' };
      return;
    }
    if (wasTurn && this.phase !== 'finished') {
      this.phase = 'roll'; this.movable = []; this.sixes = 0; this.turn = next; this.seq++;
      this.botTurn();
    }
  }

  getView() {
    return {
      gameType: 'ludo',
      matchId: this.matchId,
      players: this.basePlayers().map(p => ({ ...p, color: this.colors[p.id] })),
      tokens: Object.fromEntries(Object.entries(this.tokens).map(([k, v]) => [k, [...v]])),
      turn: this.turn,
      phase: this.phase,
      dice: this.dice,
      movable: this.phase === 'move' ? this.movable : [],
      winner: this.winner,
      wins: { ...this.wins },
      last: this.last,
      sixes: this.sixes
    };
  }
}
