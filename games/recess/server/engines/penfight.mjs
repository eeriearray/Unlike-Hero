// Pen Fight for RECESS. Two pens on a desk; take turns flicking your own pen.
// The server simulates each flick (server/physics.mjs) and both players replay the same frames.
// Round: knock the other pen off while yours stays on. Your own pen falling off loses the round.
// First to 3 rounds wins the match.
import { BaseEngine } from './base.mjs';
import { simulatePens, flickPen } from '../physics.mjs';

export const DESK = { w: 100, h: 140 };
const PEN = { len: 30, r: 2.4, m: 1 };
const MAX_IMPULSE = 100;
const ROUNDS_TO_WIN = 3;
const STYLES = ['gel-blue', 'ink-red', 'pencil', 'marker-green'];

export class PenFightEngine extends BaseEngine {
  constructor(matchId, players, onUpdate, options) {
    super(matchId, players, onUpdate, options);
    this.styles = Object.fromEntries(players.map((p, i) => [p.id, STYLES[i]]));
    this.wins = Object.fromEntries(players.map(p => [p.id, 0]));
    this.matchNo = 0;
    this.newMatch();
  }

  newMatch() {
    this.matchNo++;
    this.roundWins = Object.fromEntries(this.players.map(p => [p.id, 0]));
    this.round = 0;
    this.status = 'playing';
    this.winner = null;
    this.newRound();
  }

  newRound() {
    this.round++;
    // Pens start somewhere in the middle of the desk, a good few pen-lengths apart and at odd angles,
    // so there is no single "perfect opener": you have to work the other pen towards an edge.
    this.pens = this.players.map((p, i) => ({
      id: p.id, ...PEN,
      x: 32 + BaseEngine.rand(37),
      y: i === 0 ? 86 + BaseEngine.rand(14) : 40 + BaseEngine.rand(14),
      a: BaseEngine.rand(360) * Math.PI / 180,
      vx: 0, vy: 0, w: 0, gone: null
    }));
    this.turn = this.players[(this.round + this.matchNo) % 2].id;
    this.shot = null;      // last shot replay { seq, by, frames, events }
    this.roundResult = null;
    this.seq = (this.seq || 0) + 1;
    this.phase = 'aim';    // 'aim' | 'rolling' | 'round-over' | 'finished'
    this.botTurn();
  }

  handleAction(pid, a) {
    if (a.type === 'flick') return this.flick(pid, a);
    if (a.type === 'next-round') {
      if (this.phase !== 'round-over') return { ok: false, error: 'Round still going' };
      this.newRound();
      this.notify();
      return { ok: true };
    }
    if (a.type === 'shot-done') { // replay finished on a client: open the next turn early
      if (this.phase === 'rolling' && a.seq === this.shot?.seq) this.settle();
      return { ok: true };
    }
    if (a.type === 'rematch') {
      if (this.status !== 'finished') return { ok: false, error: 'Match still going' };
      this.newMatch();
      this.notify();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown action' };
  }

  flick(pid, a) {
    if (this.phase !== 'aim') return { ok: false, error: 'Wait for the pens to stop' };
    if (this.turn !== pid) return { ok: false, error: 'Not your turn' };
    const grab = Number(a.grab), jx = Number(a.jx), jy = Number(a.jy);
    if (![grab, jx, jy].every(Number.isFinite)) return { ok: false, error: 'Bad flick' };
    const g = Math.max(-1, Math.min(1, grab));
    let mag = Math.hypot(jx, jy);
    if (mag < 1) return { ok: false, error: 'Pull back further' };
    const k = Math.min(MAX_IMPULSE, mag) / mag;
    const pen = this.pens.find(p => p.id === pid);
    flickPen(pen, g, jx * k, jy * k);
    const sim = simulatePens(this.pens, DESK);
    for (const p of this.pens) { p.vx = p.vy = p.w = 0; }
    this.shot = { seq: ++this.seq, by: pid, frames: sim.frames, events: sim.events, grab: g };
    this.phase = 'rolling';
    // Settle when the replay would finish, even if no client reports back.
    const ms = sim.frames.length * (1000 / 30) + 400;
    const seq = this.shot.seq;
    this.later(() => { if (this.phase === 'rolling' && this.shot.seq === seq) this.settle(); }, ms);
    this.notify();
    return { ok: true };
  }

  settle() {
    if (this.phase !== 'rolling') return;
    const shooter = this.shot.by;
    const other = this.players.find(p => p.id !== shooter).id;
    const offMine = !!this.pens.find(p => p.id === shooter).gone;
    const offTheirs = !!this.pens.find(p => p.id === other).gone;
    let roundWinner = null;
    if (offMine) roundWinner = other;
    else if (offTheirs) roundWinner = shooter;
    if (roundWinner) {
      this.roundWins[roundWinner]++;
      this.roundResult = { winner: roundWinner, reason: offMine ? (offTheirs ? 'both' : 'self') : 'knocked' };
      if (this.roundWins[roundWinner] >= ROUNDS_TO_WIN) {
        this.phase = 'finished';
        this.status = 'finished';
        this.winner = roundWinner;
        this.wins[roundWinner]++;
        this.announce(`${this.player(roundWinner).name} is the Pen Fight champion of the desk!`);
      } else {
        this.phase = 'round-over';
        const seq = this.seq;
        if (this.players.some(p => p.isBot)) this.later(() => { if (this.phase === 'round-over' && this.seq === seq) { this.newRound(); this.notify(); } }, 3500);
      }
    } else {
      this.phase = 'aim';
      this.turn = other;
      this.botTurn();
    }
    this.notify();
  }

  botTurn() {
    if (this.phase !== 'aim') return;
    const bot = this.player(this.turn);
    if (!bot?.isBot) return;
    const seq = this.seq;
    this.later(() => {
      if (this.phase !== 'aim' || this.turn !== bot.id || this.seq !== seq) return;
      const plan = this.planFlick(bot.id);
      // A steady hand, not a perfect one.
      const ang = plan.ang + (BaseEngine.rand(7) - 3) * Math.PI / 180;
      const power = plan.power * (0.95 + BaseEngine.rand(11) / 100);
      this.flick(bot.id, { grab: plan.grab, jx: Math.cos(ang) * power, jy: Math.sin(ang) * power });
    }, 1400);
  }

  /** Try a few hundred flicks on a copy of the desk and keep the one that leaves the bot best placed. */
  planFlick(botId) {
    const me = this.pens.find(p => p.id === botId);
    const them = this.pens.find(p => p.id !== botId);
    const edge = (p) => Math.min(p.x, p.y, DESK.w - p.x, DESK.h - p.y);
    const toward = Math.atan2(them.y - me.y, them.x - me.x);
    let best = null;
    for (let da = -44; da <= 44; da += 4) {
      for (const f of [0.35, 0.5, 0.65, 0.8, 0.9, 1]) {
        for (const grab of [-0.5, 0, 0.5]) {
          const ang = toward + da * Math.PI / 180;
          const power = f * MAX_IMPULSE;
          const pens = this.pens.map(p => ({ ...p, vx: 0, vy: 0, w: 0, gone: null }));
          const a = pens.find(p => p.id === botId), b = pens.find(p => p.id !== botId);
          flickPen(a, grab, Math.cos(ang) * power, Math.sin(ang) * power);
          simulatePens(pens, DESK);
          let score;
          if (a.gone) score = -1000;
          else if (b.gone) score = 1000 + edge(a);
          else score = (60 - edge(b)) * 2 + Math.min(edge(a), 25) - (edge(a) < 12 ? (12 - edge(a)) * 6 : 0);
          if (!best || score > best.score) best = { score, ang, power, grab };
        }
      }
    }
    return best;
  }

  getView() {
    return {
      gameType: 'penfight',
      matchId: this.matchId,
      desk: DESK,
      maxImpulse: MAX_IMPULSE,
      players: this.basePlayers().map(p => ({ ...p, style: this.styles[p.id] })),
      pens: this.pens.map(p => ({ id: p.id, x: p.x, y: p.y, a: p.a, len: p.len, r: p.r, gone: p.gone })),
      turn: this.turn,
      phase: this.phase,
      round: this.round,
      roundWins: { ...this.roundWins },
      roundsToWin: ROUNDS_TO_WIN,
      roundResult: this.roundResult,
      shot: this.shot,
      winner: this.winner,
      wins: { ...this.wins }
    };
  }
}
