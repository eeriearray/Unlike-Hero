// Snakes & Ladders for RECESS. The server rolls every die.
// Rules: exact roll needed to land on 100 (overshoot: stay put); a 6 earns another roll.
import { BaseEngine } from './base.mjs';

export const LADDERS = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 };
export const SNAKES = { 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 99: 41 };
const COLORS = ['#e53935', '#1e6fe0', '#2e9e48', '#fbc02d'];

export class SnakesEngine extends BaseEngine {
  constructor(matchId, players, onUpdate, options) {
    super(matchId, players, onUpdate, options);
    this.colors = Object.fromEntries(players.map((p, i) => [p.id, COLORS[i % COLORS.length]]));
    this.wins = Object.fromEntries(players.map(p => [p.id, 0]));
    this.game = 0;
    this.reset();
  }

  reset() {
    this.game++;
    this.pos = Object.fromEntries(this.players.map(p => [p.id, 0]));
    const seats = this.activePlayers();
    this.turn = seats[(this.game - 1) % seats.length].id;
    this.status = 'playing';
    this.winner = null;
    this.last = null; // { seq, by, roll, from, landed, to, via: 'ladder'|'snake'|'bounce'|null, again }
    this.seq = 0;
    this.botTurn();
  }

  handleAction(pid, a) {
    if (a.type === 'roll') return this.roll(pid);
    if (a.type === 'rematch') {
      if (this.status !== 'finished') return { ok: false, error: 'Game still going' };
      this.reset();
      this.notify();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown action' };
  }

  roll(pid) {
    if (this.status !== 'playing') return { ok: false, error: 'Game over' };
    if (this.turn !== pid) return { ok: false, error: 'Not your turn' };
    if (this.busyUntil && Date.now() < this.busyUntil) return { ok: false, error: 'Wait for the token to stop' };
    const roll = 1 + BaseEngine.rand(6);
    const from = this.pos[pid];
    let landed = from + roll;
    let via = null;
    let to = landed;
    if (landed > 100) { landed = from; to = from; via = 'bounce'; }
    else if (LADDERS[landed]) { to = LADDERS[landed]; via = 'ladder'; }
    else if (SNAKES[landed]) { to = SNAKES[landed]; via = 'snake'; }
    this.pos[pid] = to;
    const again = roll === 6 && to !== 100;
    this.last = { seq: ++this.seq, by: pid, roll, from, landed, to, via, again };
    // Rough animation time so a fast clicker cannot roll mid-slide.
    this.busyUntil = Date.now() + 500 + Math.abs(landed - from) * 120 + (via === 'ladder' || via === 'snake' ? 900 : 0);
    if (to === 100) {
      this.status = 'finished';
      this.winner = pid;
      this.wins[pid]++;
      this.turn = null;
      this.announce(`${this.player(pid).name} reached 100 first in Snakes & Ladders!`);
    } else if (!again) {
      this.turn = this.nextAfter(pid);
    }
    this.notify();
    this.botTurn();
    return { ok: true, roll };
  }

  nextAfter(pid) {
    const seats = this.activePlayers();
    const i = seats.findIndex(p => p.id === pid);
    return seats[(i + 1) % seats.length].id;
  }

  botTurn() {
    if (this.status !== 'playing') return;
    const p = this.player(this.turn);
    if (!p?.isBot) return;
    const seq = this.seq;
    const wait = Math.max(0, (this.busyUntil || 0) - Date.now()) + 700;
    this.later(() => { if (this.turn === p.id && this.seq === seq) this.roll(p.id); }, wait);
  }

  playerLeft(pid) {
    if (this.left.has(pid)) return;
    const next = this.turn === pid ? this.nextAfter(pid) : this.turn;
    this.left.add(pid);
    if (this.activePlayers().length < 2 || !this.activePlayers().some(p => !p.isBot)) {
      this.abandoned = { by: this.player(pid)?.name || 'A player' };
      return;
    }
    if (this.status === 'playing') { this.turn = next; this.botTurn(); }
  }

  getView() {
    return {
      gameType: 'snakes',
      matchId: this.matchId,
      players: this.basePlayers().map(p => ({ ...p, color: this.colors[p.id] })),
      pos: { ...this.pos },
      turn: this.turn,
      status: this.status,
      winner: this.winner,
      wins: { ...this.wins },
      last: this.last,
      ladders: LADDERS,
      snakes: SNAKES
    };
  }
}
