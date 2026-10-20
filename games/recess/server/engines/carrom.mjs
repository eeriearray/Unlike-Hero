// Carrom for RECESS — one documented rule set (two players, "points" style):
//
//  • Player 1 (bottom) owns the 9 white coins, player 2 (top) the 9 black. The red queen sits in the middle.
//  • Place the striker anywhere along your baseline and flick it towards the far side (never backwards).
//  • Pocket one of your coins: +1 and you shoot again.
//  • Pocket an opponent's coin: it counts for them.
//  • Queen: pocket it and you must "cover" it by pocketing one of your own coins on the same shot or your
//    very next shot. Covered: +3. Not covered: the queen returns to the centre.
//  • Foul — striker in a pocket: your turn ends, any of your coins pocketed on that shot come back, plus one
//    coin you had already pocketed (if any). An uncovered queen comes back too.
//  • The board ends when one player's coins are all pocketed. That player wins the board.
// Every shot is simulated on the server; both players replay the same frames.
import { BaseEngine } from './base.mjs';
import { simulateDiscs } from '../physics.mjs';

export const BOARD = { size: 100, pocketR: 3.6, baseline: { near: 83.5, far: 16.5, min: 21, max: 79 } };
const COIN_R = 1.85, STRIKER_R = 2.5;
const MAX_SPEED = 135;
const POCKETS = [[3.4, 3.4], [96.6, 3.4], [3.4, 96.6], [96.6, 96.6]].map(([x, y]) => ({ x, y, r: BOARD.pocketR }));

export class CarromEngine extends BaseEngine {
  constructor(matchId, players, onUpdate, options) {
    super(matchId, players, onUpdate, options);
    this.colorOf = { [players[0].id]: 'white', [players[1].id]: 'black' };
    this.wins = Object.fromEntries(players.map(p => [p.id, 0]));
    this.board = 0;
    this.reset();
  }

  reset() {
    this.board++;
    const coins = [{ id: 'q', kind: 'queen' }];
    const ring = (n, rad, offset, pattern) => {
      for (let i = 0; i < n; i++) {
        const a = offset + i * 2 * Math.PI / n;
        coins.push({ id: `c${coins.length}`, kind: pattern(i), x: 50 + Math.cos(a) * rad, y: 50 + Math.sin(a) * rad });
      }
    };
    const d = COIN_R * 2 + 0.15;
    ring(6, d, Math.PI / 6, i => (i % 2 ? 'black' : 'white'));
    ring(12, d * 2, 0, i => (i % 4 < 2 ? (i % 2 ? 'white' : 'black') : (i % 2 ? 'black' : 'white')));
    // The pattern above makes 9 + 9: verify and repair if a future tweak breaks the balance.
    const whites = coins.filter(c => c.kind === 'white').length;
    if (whites !== 9) coins.filter(c => c.kind !== 'queen').forEach((c, i) => { c.kind = i % 2 ? 'black' : 'white'; });
    coins[0].x = 50; coins[0].y = 50;
    this.coins = coins.map(c => ({ ...c, r: COIN_R, m: 1, vx: 0, vy: 0, gone: null }));
    this.scores = Object.fromEntries(this.players.map(p => [p.id, 0]));
    this.pocketed = Object.fromEntries(this.players.map(p => [p.id, []])); // coin ids each player has pocketed
    this.queenPending = null;
    this.queenOwner = null;
    this.turn = this.players[(this.board - 1) % 2].id;
    this.phase = 'aim';
    this.shot = null;
    this.seq = (this.seq || 0) + 1;
    this.winner = null;
    this.foul = null;
    this.botTurn();
  }

  seat(pid) { return this.players.findIndex(p => p.id === pid); }
  baseY(pid) { return this.seat(pid) === 0 ? BOARD.baseline.near : BOARD.baseline.far; }
  other(pid) { return this.players.find(p => p.id !== pid).id; }

  handleAction(pid, a) {
    if (a.type === 'shoot') return this.shoot(pid, a);
    if (a.type === 'shot-done') {
      if (this.phase === 'rolling' && a.seq === this.shot?.seq) this.settle();
      return { ok: true };
    }
    if (a.type === 'rematch') {
      if (this.phase !== 'finished') return { ok: false, error: 'Board still going' };
      this.reset();
      this.notify();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown action' };
  }

  strikerSpotFree(pid, x) {
    const y = this.baseY(pid);
    return !this.coins.some(c => !c.gone && Math.hypot(c.x - x, c.y - y) < c.r + STRIKER_R);
  }

  shoot(pid, a) {
    if (this.phase !== 'aim') return { ok: false, error: 'Wait for the board to settle' };
    if (this.turn !== pid) return { ok: false, error: 'Not your turn' };
    const x = Number(a.x);
    let vx = Number(a.vx), vy = Number(a.vy);
    if (![x, vx, vy].every(Number.isFinite)) return { ok: false, error: 'Bad shot' };
    if (x < BOARD.baseline.min || x > BOARD.baseline.max) return { ok: false, error: 'Keep the striker on your baseline' };
    if (!this.strikerSpotFree(pid, x)) return { ok: false, error: 'Slide the striker off that coin' };
    const sp = Math.hypot(vx, vy);
    if (sp < 4) return { ok: false, error: 'Pull back further' };
    if (sp > MAX_SPEED) { vx *= MAX_SPEED / sp; vy *= MAX_SPEED / sp; }
    const forward = this.seat(pid) === 0 ? -vy : vy;
    if (forward < Math.hypot(vx, vy) * 0.08) return { ok: false, error: 'Flick towards the far side — no backward shots' };

    const striker = { id: 'striker', kind: 'striker', r: STRIKER_R, m: 2.2, x, y: this.baseY(pid), vx, vy, gone: null };
    const live = [striker, ...this.coins.filter(c => !c.gone)];
    const sim = simulateDiscs(live, {
      friction: 46,
      restitution: 0.9,
      walls: { minX: 0, minY: 0, maxX: BOARD.size, maxY: BOARD.size, restitution: 0.72 },
      pockets: POCKETS
    });
    for (const b of live) { b.vx = b.vy = 0; }
    this.shot = { seq: ++this.seq, by: pid, ids: sim.ids, frames: sim.frames, events: sim.events, strikerIn: !!striker.gone };
    this.phase = 'rolling';
    const seq = this.shot.seq;
    this.later(() => { if (this.phase === 'rolling' && this.shot.seq === seq) this.settle(); }, sim.frames.length * (1000 / 30) + 400);
    this.notify();
    return { ok: true };
  }

  returnToCentre(coin) {
    for (let k = 0; k < 60; k++) {
      const a = k * 2.4, rad = k === 0 ? 0 : 1 + Math.sqrt(k) * 2;
      const x = 50 + Math.cos(a) * rad, y = 50 + Math.sin(a) * rad;
      if (!this.coins.some(c => c !== coin && !c.gone && Math.hypot(c.x - x, c.y - y) < c.r + coin.r + 0.2)) {
        Object.assign(coin, { x, y, gone: null, counted: false });
        return;
      }
    }
    Object.assign(coin, { x: 50, y: 50, gone: null, counted: false });
  }

  settle() {
    if (this.phase !== 'rolling') return;
    const me = this.shot.by;
    const opp = this.other(me);
    const mine = this.colorOf[me];
    const newly = this.coins.filter(c => c.gone === 'pocket' && !c.counted);
    newly.forEach(c => { c.counted = true; });
    const own = newly.filter(c => c.kind === mine);
    const theirs = newly.filter(c => c.kind !== mine && c.kind !== 'queen');
    const queenIn = newly.some(c => c.kind === 'queen');
    const queen = this.coins.find(c => c.kind === 'queen');
    const notes = [];
    let again = false;

    for (const c of theirs) { this.scores[opp]++; this.pocketed[opp].push(c.id); notes.push(`${this.player(opp).name} +1 (pocketed for them)`); }

    if (this.shot.strikerIn) {
      // Foul.
      for (const c of own) this.returnToCentre(c);
      const prev = this.pocketed[me].pop();
      if (prev) { this.returnToCentre(this.coins.find(c => c.id === prev)); this.scores[me]--; }
      if (queenIn || this.queenPending === me) this.returnToCentre(queen);
      this.queenPending = null;
      this.foul = { by: me, seq: this.shot.seq };
      notes.push('Foul: striker pocketed');
    } else {
      this.foul = null;
      for (const c of own) { this.scores[me]++; this.pocketed[me].push(c.id); }
      if (own.length) notes.push(`+${own.length}`);
      if (queenIn) {
        if (own.length) { this.queenOwner = me; this.scores[me] += 3; notes.push('Queen covered! +3'); }
        else { this.queenPending = me; notes.push('Queen pocketed — cover it next shot'); }
        again = true;
      } else if (this.queenPending === me) {
        if (own.length) { this.queenOwner = me; this.scores[me] += 3; notes.push('Queen covered! +3'); }
        else { this.returnToCentre(queen); notes.push('Queen not covered — back to the centre'); }
        this.queenPending = null;
      }
      if (own.length) again = true;
    }
    this.shot.notes = notes;

    const left = (color) => this.coins.filter(c => c.kind === color && !c.gone).length;
    for (const p of this.players) {
      if (left(this.colorOf[p.id]) === 0) {
        this.phase = 'finished';
        this.winner = p.id;
        this.wins[p.id]++;
        this.turn = null;
        this.announce(`${p.name} cleared the carrom board!`);
        this.notify();
        return;
      }
    }
    this.phase = 'aim';
    if (!again) this.turn = opp;
    this.notify();
    this.botTurn();
  }

  botTurn() {
    if (this.phase !== 'aim') return;
    const bot = this.player(this.turn);
    if (!bot?.isBot) return;
    const seq = this.seq;
    this.later(() => {
      if (this.phase !== 'aim' || this.turn !== bot.id || this.seq !== seq) return;
      this.shoot(bot.id, this.planShot(bot.id));
    }, 1500);
  }

  planShot(pid) {
    const y = this.baseY(pid);
    const mine = this.colorOf[pid];
    const targets = this.coins.filter(c => !c.gone && (c.kind === mine || (c.kind === 'queen' && !this.queenPending)));
    let best = null;
    for (let x = BOARD.baseline.min; x <= BOARD.baseline.max; x += 4) {
      if (!this.strikerSpotFree(pid, x)) continue;
      for (const c of targets) {
        for (const p of POCKETS) {
          const dx = p.x - c.x, dy = p.y - c.y, dl = Math.hypot(dx, dy);
          const gx = c.x - dx / dl * (c.r + STRIKER_R), gy = c.y - dy / dl * (c.r + STRIKER_R);
          const sx = gx - x, sy = gy - y, sl = Math.hypot(sx, sy);
          const forward = this.seat(pid) === 0 ? -sy : sy;
          if (forward < sl * 0.15) continue;
          const cut = (sx * dx + sy * dy) / (sl * dl); // 1 = straight shot
          if (cut < 0.35) continue;
          const score = cut * 2 - (sl + dl) / 120 + (c.kind === 'queen' ? 0.2 : 0);
          if (!best || score > best.score) best = { score, x, sx, sy, sl, dist: sl + dl };
        }
      }
    }
    if (!best) {
      const x = 50 + (BaseEngine.rand(30) - 15);
      const vy = this.seat(pid) === 0 ? -90 : 90;
      return { x: this.strikerSpotFree(pid, x) ? x : 35, vx: BaseEngine.rand(40) - 20, vy };
    }
    const noise = (BaseEngine.rand(9) - 4) * Math.PI / 180 * 0.5;
    const ang = Math.atan2(best.sy, best.sx) + noise;
    const speed = Math.min(MAX_SPEED, 55 + best.dist * 0.75);
    return { x: best.x, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed };
  }

  getView() {
    const left = (color) => this.coins.filter(c => c.kind === color && !c.gone).length;
    return {
      gameType: 'carrom',
      matchId: this.matchId,
      board: BOARD,
      pockets: POCKETS,
      strikerR: STRIKER_R,
      maxSpeed: MAX_SPEED,
      players: this.basePlayers().map((p, i) => ({ ...p, color: this.colorOf[p.id], seat: i })),
      coins: this.coins.filter(c => !c.gone).map(({ id, kind, x, y, r }) => ({ id, kind, x, y, r })),
      left: { white: left('white'), black: left('black') },
      scores: { ...this.scores },
      queenPending: this.queenPending,
      queenOwner: this.queenOwner,
      turn: this.turn,
      phase: this.phase,
      shot: this.shot,
      foul: this.foul,
      winner: this.winner,
      wins: { ...this.wins }
    };
  }
}
