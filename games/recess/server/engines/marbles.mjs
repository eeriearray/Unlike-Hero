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
const MAX_SPEED = 57;
const SHOTS_PER_TURN = 3; // knockouts earn extra shots, but nobody clears the ring in one go
const FRICTION = 40; // dirt, not glass: a target in the middle needs a well-aimed shot to leave the ring
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
    // Targets are scattered loosely round the middle. (A neat cross lines up like Newton's cradle:
    // one hard shot down an arm pops the far marble out every time.)
    const spots = [];
    for (let tries = 0; spots.length < 9 && tries < 5000; tries++) {
      const a = BaseEngine.rand(360) * Math.PI / 180, d = 2 + BaseEngine.rand(130) / 10;
      const x = RING.x + Math.cos(a) * d, y = RING.y + Math.sin(a) * d;
      if (spots.every(([sx, sy]) => Math.hypot(sx - x, sy - y) > TARGET_R * 2 + 2.2)) spots.push([x, y]);
    }
    spots.forEach(([x, y], i) => this.bodies.push({ id: `t${i}`, kind: 'target', r: TARGET_R, m: 1, x, y, vx: 0, vy: 0, colour: i % 4 }));
    const seats = this.activePlayers();
    this.turn = seats[(this.game - 1) % seats.length].id;
    this.phase = 'aim';
    this.shot = null;
    this.seq = (this.seq || 0) + 1;
    this.shots = 0;
    this.streak = 0;
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
    const sim = this.simulate(live);
    for (const b of live) { b.vx = b.vy = 0; }
    this.shots++;
    this.shot = { seq: ++this.seq, by: pid, ids: sim.ids, frames: sim.frames, events: sim.events };
    this.phase = 'rolling';
    const seq = this.shot.seq;
    this.later(() => { if (this.phase === 'rolling' && this.shot.seq === seq) this.settle(); }, sim.frames.length * (1000 / 30) + 400);
    this.notify();
    return { ok: true };
  }

  simulate(bodies) {
    return simulateDiscs(bodies, {
      friction: FRICTION,
      restitution: 0.8,
      outside: (b) => Math.hypot(b.x - RING.x, b.y - RING.y) > RING.r + 0.5
    });
  }

  settle() {
    if (this.phase !== 'rolling') return;
    const by = this.shot.by;
    let knocked = false; // only knocking out a target earns another shot
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
        this.scores[by] += 2; notes.push({ id: b.id, points: 2, to: by });
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
    this.streak++;
    if (!knocked || ownOut || this.streak >= SHOTS_PER_TURN) { this.turn = this.nextAfter(by); this.streak = 0; }
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
      const plan = this.planShot(bot.id);
      const ang = plan.ang + (BaseEngine.rand(5) - 2) * Math.PI / 180 * 0.75;
      const sp = Math.min(MAX_SPEED, plan.sp * (0.96 + BaseEngine.rand(9) / 100));
      this.shoot(bot.id, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp });
    }, 1300);
  }

  /** Simulate shots all round the compass on a copy of the ring and keep the most rewarding one. */
  planShot(botId) {
    let best = null;
    const fromCentre = (b) => Math.hypot(b.x - RING.x, b.y - RING.y);
    for (let deg = 0; deg < 360; deg += 2) {
      for (const f of [0.4, 0.55, 0.7, 0.85, 1]) {
        const ang = deg * Math.PI / 180;
        const sp = f * MAX_SPEED;
        const copy = this.bodies.filter(b => !b.gone).map(b => ({ ...b, vx: 0, vy: 0, gone: null }));
        const me = copy.find(b => b.id === botId);
        me.vx = Math.cos(ang) * sp; me.vy = Math.sin(ang) * sp;
        this.simulate(copy);
        let score = 0;
        for (const b of copy) {
          if (b.gone) score += b.kind === 'target' ? 10 : b.id === botId ? -30 : 20;
          else if (b.kind === 'target') score -= Math.max(0, fromCentre(b) - 28) * 0.4; // a target left by the line is a gift to the next player
        }
        if (!me.gone) {
          score -= Math.max(0, fromCentre(me) - 33) * 0.8; // don't end up teetering on the chalk
          // Finish close to the targets: next turn's shots are short and strong.
          const near = Math.min(...copy.filter(b => b.kind === 'target' && !b.gone).map(b => Math.hypot(b.x - me.x, b.y - me.y)), 40);
          score += Math.max(0, 30 - near) * 0.25;
        }
        if (!best || score > best.score) best = { score, ang, sp };
      }
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
      shotsLeft: SHOTS_PER_TURN - this.streak,
      winner: this.winner,
      wins: { ...this.wins }
    };
  }
}
