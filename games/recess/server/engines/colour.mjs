// Colour Colour, Which Colour? for RECESS.
//
// Each round: the caller names a colour (or lets the server pick), then everyone else races to tap an
// object of that colour on the shared desk. The server lays out the desk, times the hunt and judges taps.
//   first correct: 3, second: 2, any later correct: 1, wrong tap: locked out for the round.
//   The caller scores 1 for every hunter who misses.
// Difficulty rises each round: more objects, more colours in play, less time.
import { BaseEngine } from './base.mjs';

export const COLOURS = [
  { id: 'red', name: 'Red', hex: '#e53935' },
  { id: 'blue', name: 'Blue', hex: '#1e6fe0' },
  { id: 'green', name: 'Green', hex: '#2e9e48' },
  { id: 'yellow', name: 'Yellow', hex: '#fbc02d' },
  { id: 'orange', name: 'Orange', hex: '#f57c00' },
  { id: 'purple', name: 'Purple', hex: '#8e24aa' },
  { id: 'pink', name: 'Pink', hex: '#f06292' },
  { id: 'brown', name: 'Brown', hex: '#795548' },
  { id: 'black', name: 'Black', hex: '#263238' },
  { id: 'white', name: 'White', hex: '#f5f5f5' }
];
const KINDS = ['crayon', 'eraser', 'ball', 'book', 'scrap', 'sharpener', 'bottle', 'star'];
const CALL_MS = 8000;
const RESULT_MS = 3000;

export class ColourEngine extends BaseEngine {
  constructor(matchId, players, onUpdate, options) {
    super(matchId, players, onUpdate, options);
    this.wins = Object.fromEntries(players.map(p => [p.id, 0]));
    this.newGame();
  }

  newGame() {
    this.scores = Object.fromEntries(this.players.map(p => [p.id, 0]));
    this.totalRounds = Math.min(12, Math.max(6, this.activePlayers().length * 2));
    this.round = 0;
    this.callerIndex = BaseEngine.rand(this.activePlayers().length);
    this.phase = 'call';
    this.winner = null;
    this.nextRound();
  }

  nextRound() {
    this.round++;
    const seats = this.activePlayers();
    this.callerIndex = (this.callerIndex + 1) % seats.length;
    this.caller = seats[this.callerIndex].id;
    this.colour = null;
    this.taps = {};   // pid -> { objectId, correct, at, points }
    this.found = [];  // pids in order of correct taps
    this.layoutDesk();
    this.phase = 'call';
    this.deadline = Date.now() + CALL_MS;
    this.cancel(this.timer);
    this.timer = this.later(() => this.callColour(this.caller, null, true), CALL_MS);
    this.botCaller();
  }

  layoutDesk() {
    const nColours = Math.min(COLOURS.length, 5 + Math.floor(this.round / 2));
    this.palette = BaseEngine.shuffle(COLOURS).slice(0, nColours).map(c => c.id);
    const count = Math.min(18, 8 + this.round);
    const objs = [];
    let tries = 0;
    while (objs.length < count && tries++ < 2000) {
      const x = 8 + BaseEngine.rand(84);
      const y = 10 + BaseEngine.rand(80);
      if (objs.some(o => Math.hypot(o.x - x, (o.y - y) * 0.75) < 13)) continue;
      objs.push({
        id: objs.length,
        kind: KINDS[BaseEngine.rand(KINDS.length)],
        colour: this.palette[objs.length % this.palette.length], // every palette colour appears at least once
        x, y,
        rot: BaseEngine.rand(360),
        scale: 0.85 + BaseEngine.rand(30) / 100
      });
    }
    this.objects = BaseEngine.shuffle(objs).map((o, i) => ({ ...o, id: i }));
  }

  get huntMs() { return Math.max(2600, 7000 - (this.round - 1) * 450); }

  hunters() { return this.activePlayers().filter(p => p.id !== this.caller); }

  handleAction(pid, a) {
    switch (a.type) {
      case 'call': return this.callColour(pid, a.colour, false);
      case 'tap': return this.tap(pid, a.objectId);
      case 'rematch':
        if (this.phase !== 'finished') return { ok: false, error: 'Game still going' };
        this.newGame();
        this.notify();
        return { ok: true };
      default: return { ok: false, error: 'Unknown action' };
    }
  }

  callColour(pid, colour, auto) {
    if (this.phase !== 'call') return { ok: false, error: 'Not calling right now' };
    if (!auto && pid !== this.caller) return { ok: false, error: 'You are not the caller this round' };
    if (colour === 'random' || colour == null) colour = this.palette[BaseEngine.rand(this.palette.length)];
    if (!this.palette.includes(colour)) return { ok: false, error: 'That colour is not on the desk' };
    this.cancel(this.timer);
    this.colour = colour;
    this.phase = 'hunt';
    this.deadline = Date.now() + this.huntMs;
    this.timer = this.later(() => this.endHunt(), this.huntMs + 300);
    this.notify();
    this.botHunters();
    return { ok: true };
  }

  tap(pid, objectId) {
    if (this.phase !== 'hunt') return { ok: false, error: 'Wait for the colour!' };
    if (pid === this.caller) return { ok: false, error: 'The caller just watches' };
    if (this.taps[pid]) return { ok: false, error: 'You already tapped' };
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj) return { ok: false, error: 'Nothing there' };
    const correct = obj.colour === this.colour;
    let points = 0;
    if (correct) {
      this.found.push(pid);
      points = [3, 2][this.found.length - 1] ?? 1;
      this.scores[pid] += points;
    }
    this.taps[pid] = { objectId, correct, points, at: Date.now() };
    if (this.hunters().every(p => this.taps[p.id])) this.endHunt();
    else this.notify();
    return { ok: true, correct };
  }

  endHunt() {
    if (this.phase !== 'hunt') return;
    this.cancel(this.timer);
    const missed = this.hunters().filter(p => !this.taps[p.id]?.correct).length;
    this.callerPoints = missed;
    this.scores[this.caller] += missed;
    this.phase = 'result';
    this.deadline = Date.now() + RESULT_MS;
    this.notify();
    this.timer = this.later(() => {
      if (this.round >= this.totalRounds) {
        this.phase = 'finished';
        const best = Math.max(...this.players.map(p => this.scores[p.id]));
        const champs = this.players.filter(p => this.scores[p.id] === best);
        this.winner = champs.length === 1 ? champs[0].id : null;
        champs.forEach(p => this.wins[p.id]++);
        this.announce(`${champs.map(p => p.name).join(' & ')} won Colour Colour with ${best} points.`);
        this.notify();
        return;
      }
      this.nextRound();
      this.notify();
    }, RESULT_MS);
  }

  botCaller() {
    const p = this.player(this.caller);
    if (!p?.isBot) return;
    const round = this.round;
    this.later(() => {
      if (this.phase === 'call' && this.round === round) this.callColour(p.id, this.palette[BaseEngine.rand(this.palette.length)], false);
    }, 1500 + BaseEngine.rand(1500));
  }

  botHunters() {
    const round = this.round;
    for (const p of this.hunters()) {
      if (!p.isBot) continue;
      const delay = 1100 + BaseEngine.rand(Math.max(600, this.huntMs - 1600));
      this.later(() => {
        if (this.phase !== 'hunt' || this.round !== round || this.taps[p.id]) return;
        const right = this.objects.filter(o => o.colour === this.colour);
        const wrong = this.objects.filter(o => o.colour !== this.colour);
        const pick = BaseEngine.rand(100) < 78 ? right[BaseEngine.rand(right.length)] : wrong[BaseEngine.rand(wrong.length)];
        this.tap(p.id, pick.id);
      }, delay);
    }
  }

  playerLeft(pid) {
    if (this.left.has(pid)) return;
    this.left.add(pid);
    if (this.activePlayers().length < 2 || !this.activePlayers().some(p => !p.isBot)) {
      this.abandoned = { by: this.player(pid)?.name || 'A player' };
      this.cancel(this.timer);
      return;
    }
    if (this.phase === 'call' && pid === this.caller) this.callColour(pid, null, true);
    else if (this.phase === 'hunt' && this.hunters().every(p => this.taps[p.id])) this.endHunt();
  }

  getView(forId) {
    const showAll = this.phase === 'result' || this.phase === 'finished';
    const taps = {};
    for (const [pid, t] of Object.entries(this.taps)) if (showAll || pid === forId) taps[pid] = t;
    return {
      gameType: 'colour',
      matchId: this.matchId,
      players: this.basePlayers(),
      phase: this.phase,
      round: this.round,
      totalRounds: this.totalRounds,
      caller: this.caller,
      colour: this.colour,
      palette: this.palette.map(id => COLOURS.find(c => c.id === id)),
      objects: this.objects,
      deadline: this.deadline,
      huntMs: this.huntMs,
      taps,
      found: this.found,
      tapped: Object.keys(this.taps),
      callerPoints: showAll ? this.callerPoints : null,
      scores: { ...this.scores },
      wins: { ...this.wins },
      winner: this.winner
    };
  }
}
