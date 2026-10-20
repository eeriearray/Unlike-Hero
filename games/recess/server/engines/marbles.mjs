// Marble Knockout (kancha) for RECESS.
// A chalk ring with target marbles in a cross. Players take turns shooting their shooter marble.
//   Target knocked out of the ring: +1. Another player's shooter knocked out: +2 (it returns to its spot).
//   Your own shooter leaves the ring: -1 (it returns to its spot).
//   Knock anything out and you shoot again. When the targets are gone, the highest score wins.
// The server simulates every shot; clients replay the frames.
import { BaseEngine } from './base.mjs';
import { simulateDiscs } from '../physics.mjs';

export const RING = { x: 50, y: 50, r: 40 };
const SHOOTER_R = 2.6, TARGET_R = 1.9;
const MAX_SPEED = 78;
const SEAT_ANGLES = [Math.PI / 2, -Math.PI / 2, Math.PI, 0]; // bottom, top, left, right
const DESIGNS = ['tiger', 'galaxy', 'ocean', 'cherry'];
const MAX_SHOTS = 80;

export class MarblesEngine extends BaseEngine {
  constructor(matchId, players, onUpdate, options) {
    super(matchId, players, onUpdate, options);
    this.designs = Object.fromEntries(players.map((p, i) => [p.id, DESIGNS[i]]));
    this.wins = Object.fromEntries(players.map(p => [p.id, 0]));
    this.game = 0;
    this.reset();
  }

  home(i) {
    const a = SEAT_ANGLES[i];
    return { x: RING.x + Math.cos(a) * (RING.r - 4), y: RING.y + Math.sin(a) * (RING.r - 4) };
  }

  reset() {
    this.game++;
    this.scores = Object.fromEntries(this.players.map(p => [p.id, 0]));
    this.bodies = this.players.map((p, i) => ({ id: p.id, kind: 'shooter', r: SHOOTER_R, m: 1.5, ...this.home(i), vx: 0, vy: 0 }));
    const cross = [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5], [10, 0], [-10, 0], [0, 10], [0, -10]];
    cross.forEach(([dx, dy], i) => this.bodies.push({ id: `t${i}`, kind: 'target', r: TARGET_R, m: 1, x: RING.x + dx, y: RING.y + dy, vx: 0, vy: 0, colour: i % 4 }));
    const seats = this.activePlayers();
    this.turn = seats[(this.game - 1) % seats.length].id;
    this.phase = 'aim';
    this.shot = null;
    this.seq = (this.seq || 0) + 1;
    this.shots = 0;
    this.winner = null;
    this.botTurn();
  }

  handleAction(pid, a) {
    if (a.type === 'shoot') return this.shoot(pid, a);
    if (a.type === 'shot-done') {
      if (this.phase === 'rolling' && a.seq === this.shot?.seq) this.settle();
      return { ok: true };
    }
    if (a.type === 'rematch') {
      if (this.phase !== 'finished') return { ok: false, error: 'Game still going' };
      this.reset();
      this.notify();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown action' };
  }

  shoot(pid, a) {
    if (this.phase !== 'aim') return { ok: false, error: 'Wait for the marbles to stop' };
    if (this.turn !== pid) return { ok: false, error: 'Not your turn' };
    let vx = Number(a.vx), vy = Number(a.vy);
    if (!Number.isFinite(vx) || !Number.isFinite(vy)) return { ok: false, error: 'Bad shot' };
    const sp = Math.hypot(vx, vy);
    if (sp < 3) return { ok: false, error: 'Pull back further' };
    if (sp > MAX_SPEED) { vx *= MAX_SPEED / sp; vy *= MAX_SPEED / sp; }
    const live = this.bodies.filter(b => !b.gone);
    const me = live.find(b => b.id === pid);
    me.vx = vx; me.vy = vy;
    const sim = simulateDiscs(live, {
      friction: 26,
      restitution: 0.9,
      outside: (b) => Math.hypot(b.x - RING.x, b.y - RING.y) > RING.r + 0.5
    });
    for (const b of live) { b.vx = b.vy = 0; }
    this.shots++;
    this.shot = { seq: ++this.seq, by: pid, ids: sim.ids, frames: sim.frames, events: sim.events };
    this.phase = 'rolling';
    const seq = this.shot.seq;
    this.later(() => { if (this.phase === 'rolling' && this.shot.seq === seq) this.settle(); }, sim.frames.length * (1000 / 30) + 400);
    this.notify();
    return { ok: true };
  }

  settle() {
    if (this.phase !== 'rolling') return;
    const by = this.shot.by;
    let knocked = false;
    const out = this.bodies.filter(b => b.gone === 'out');
    const notes = [];
    for (const b of out) {
      if (b.kind === 'target') {
        this.scores[by] += 1; knocked = true; b.gone = 'scored';
        notes.push({ id: b.id, points: 1, to: by });
      } else if (b.id === by) {
        this.scores[by] -= 1; notes.push({ id: b.id, points: -1, to: by });
        this.respawn(b);
      } else {
        this.scores[by] += 2; knocked = true; notes.push({ id: b.id, points: 2, to: by });
        this.respawn(b);
      }
    }
    this.shot.notes = notes;
    // A shooter that belongs to someone who left is just a lump in the ring now.
    if (!this.bodies.some(b => b.kind === 'target' && !b.gone) || this.shots >= MAX_SHOTS) {
      this.phase = 'finished';
      const best = Math.max(...this.activePlayers().map(p => this.scores[p.id]));
      const champs = this.activePlayers().filter(p => this.scores[p.id] === best);
      this.winner = champs.length === 1 ? champs[0].id : null;
      champs.forEach(p => this.wins[p.id]++);
      this.announce(`${champs.map(p => p.name).join(' & ')} won Marble Knockout with ${best} points.`);
      this.notify();
      return;
    }
    this.phase = 'aim';
    const ownOut = out.some(b => b.id === by);
    if (!knocked || ownOut) this.turn = this.nextAfter(by);
    this.notify();
    this.botTurn();
  }

  respawn(b) {
    const i = this.players.findIndex(p => p.id === b.id);
    const spot = this.home(i);
    // Slide along the edge until the spot is clear.
    for (let k = 0; k < 24; k++) {
      const a = SEAT_ANGLES[i] + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.12;
      const x = RING.x + Math.cos(a) * (RING.r - 4), y = RING.y + Math.sin(a) * (RING.r - 4);
      if (!this.bodies.some(o => o !== b && !o.gone && Math.hypot(o.x - x, o.y - y) < o.r + b.r + 0.5)) { spot.x = x; spot.y = y; break; }
    }
    b.gone = null; b.x = spot.x; b.y = spot.y; b.vx = b.vy = 0;
  }

  nextAfter(pid) {
    const seats = this.activePlayers();
    const i = seats.findIndex(p => p.id === pid);
    return seats[(i + 1) % seats.length].id;
  }

  botTurn() {
    if (this.phase !== 'aim') return;
    const bot = this.player(this.turn);
    if (!bot?.isBot) return;
    const seq = this.seq;
    this.later(() => {
      if (this.phase !== 'aim' || this.turn !== bot.id || this.seq !== seq) return;
      const me = this.bodies.find(b => b.id === bot.id);
      const targets = this.bodies.filter(b => b.kind === 'target' && !b.gone);
      const t = targets.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
      const ang = Math.atan2(t.y - me.y, t.x - me.x) + (BaseEngine.rand(13) - 6) * Math.PI / 180;
      const d = Math.hypot(t.x - me.x, t.y - me.y);
      const sp = Math.min(MAX_SPEED, 32 + d * 0.9 + BaseEngine.rand(12));
      this.shoot(bot.id, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp });
    }, 1300);
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
    if (wasTurn && this.phase === 'aim') { this.turn = next; this.seq++; this.botTurn(); }
  }

  getView() {
    return {
      gameType: 'marbles',
      matchId: this.matchId,
      ring: RING,
      maxSpeed: MAX_SPEED,
      players: this.basePlayers().map(p => ({ ...p, design: this.designs[p.id] })),
      bodies: this.bodies.filter(b => !b.gone).map(({ id, kind, x, y, r, colour }) => ({ id, kind, x, y, r, colour })),
      targetsLeft: this.bodies.filter(b => b.kind === 'target' && !b.gone).length,
      scores: { ...this.scores },
      turn: this.turn,
      phase: this.phase,
      shot: this.shot,
      winner: this.winner,
      wins: { ...this.wins }
    };
  }
}
