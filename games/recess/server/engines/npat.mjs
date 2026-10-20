// Name, Place, Animal, Thing for RECESS.
//
// Phases: setup -> spin -> writing -> review -> scores -> (spin ... ) -> finished
// While writing, answers are private: each player sees only their own sheet and who has put their pen down.
// Clients save drafts as they type, so when the timer runs out the server marks whatever was written.
// Scoring: a valid answer (starts with the letter, at least 2 letters, not rejected by most other players)
// scores 10 if nobody else wrote it, 5 if someone did. Blank or invalid: 0.
import { BaseEngine } from './base.mjs';

const LETTERS = 'ABCDEFGHIJKLMNOPRSTUVW'.split(''); // no Q, X, Y, Z: be kind
const BASE_CATEGORIES = ['Name', 'Place', 'Animal', 'Thing', 'Food', 'Movie'];
const TIMES = [45, 60, 90, 120];
const ROUNDS = [3, 5, 8];
const SPIN_MS = 2600;
const GRACE_MS = 1500;
const REVIEW_MS = 60_000;

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

export class NpatEngine extends BaseEngine {
  constructor(matchId, players, onUpdate, options = {}) {
    super(matchId, players, onUpdate, options);
    this.settings = {
      seconds: TIMES.includes(options.seconds) ? options.seconds : 60,
      rounds: ROUNDS.includes(options.rounds) ? options.rounds : 5,
      custom: this.cleanCategory(options.custom)
    };
    this.totals = Object.fromEntries(players.map(p => [p.id, 0]));
    this.round = 0;
    this.usedLetters = [];
    this.phase = 'setup';
    this.history = [];
    this.resetRoundState();
  }

  cleanCategory(s) {
    const c = String(s || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 14);
    return c && !BASE_CATEGORIES.some(b => b.toLowerCase() === c.toLowerCase()) ? c : '';
  }

  get categories() {
    return this.settings.custom ? [...BASE_CATEGORIES, this.settings.custom] : BASE_CATEGORIES;
  }

  resetRoundState() {
    this.letter = null;
    this.deadline = null;
    this.answers = {};    // pid -> { cat: text }
    this.penDown = new Set();
    this.votes = {};      // `${cat}|${pid}` -> Set(voterId)
    this.doneReviewing = new Set();
    this.roundPoints = {};
    this.marks = {};      // pid -> { cat: { points, reason } }
    this.phaseTimer = null;
  }

  humans() { return this.activePlayers(); }

  handleAction(pid, a) {
    switch (a.type) {
      case 'settings': {
        if (this.phase !== 'setup' && this.phase !== 'finished') return { ok: false, error: 'Change settings between games' };
        if (TIMES.includes(a.seconds)) this.settings.seconds = a.seconds;
        if (ROUNDS.includes(a.rounds)) this.settings.rounds = a.rounds;
        if (a.custom !== undefined) this.settings.custom = this.cleanCategory(a.custom);
        this.notify();
        return { ok: true };
      }
      case 'start': {
        if (this.phase === 'finished') {
          this.totals = Object.fromEntries(this.players.map(p => [p.id, 0]));
          this.round = 0;
          this.usedLetters = [];
          this.history = [];
        } else if (this.phase !== 'setup' && this.phase !== 'scores') {
          return { ok: false, error: 'A round is already running' };
        }
        if (this.phase === 'scores' && this.round >= this.settings.rounds) return { ok: false, error: 'That was the last round' };
        this.startRound();
        return { ok: true };
      }
      case 'draft':
      case 'submit': {
        if (this.phase !== 'writing') return { ok: false, error: 'Pens are down' };
        if (this.penDown.has(pid)) return { ok: false, error: 'You already put your pen down' };
        const sheet = {};
        const src = a.answers && typeof a.answers === 'object' ? a.answers : {};
        for (const cat of this.categories) sheet[cat] = String(src[cat] ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30);
        this.answers[pid] = sheet;
        if (a.type === 'submit') {
          this.penDown.add(pid);
          if (this.humans().every(p => this.penDown.has(p.id))) this.endWriting();
          else this.notify();
        }
        return { ok: true };
      }
      case 'vote': {
        if (this.phase !== 'review') return { ok: false, error: 'Not reviewing right now' };
        if (!this.categories.includes(a.cat) || !this.player(a.target)) return { ok: false, error: 'Unknown answer' };
        if (a.target === pid) return { ok: false, error: 'You cannot reject your own answer' };
        const key = `${a.cat}|${a.target}`;
        const set = this.votes[key] || (this.votes[key] = new Set());
        if (a.reject) set.add(pid); else set.delete(pid);
        this.notify();
        return { ok: true };
      }
      case 'done-review': {
        if (this.phase !== 'review') return { ok: false, error: 'Not reviewing right now' };
        this.doneReviewing.add(pid);
        if (this.humans().every(p => this.doneReviewing.has(p.id))) this.scoreRound();
        else this.notify();
        return { ok: true };
      }
      default:
        return { ok: false, error: 'Unknown action' };
    }
  }

  startRound() {
    this.cancel(this.phaseTimer);
    this.resetRoundState();
    this.round++;
    const pool = LETTERS.filter(l => !this.usedLetters.includes(l));
    this.letter = (pool.length ? pool : LETTERS)[BaseEngine.rand((pool.length ? pool : LETTERS).length)];
    this.usedLetters.push(this.letter);
    this.phase = 'spin';
    this.notify();
    this.phaseTimer = this.later(() => {
      this.phase = 'writing';
      this.deadline = Date.now() + this.settings.seconds * 1000;
      this.notify();
      this.phaseTimer = this.later(() => this.endWriting(), this.settings.seconds * 1000 + GRACE_MS);
    }, SPIN_MS);
  }

  endWriting() {
    if (this.phase !== 'writing') return;
    this.cancel(this.phaseTimer);
    this.phase = 'review';
    this.deadline = Date.now() + REVIEW_MS;
    for (const p of this.players) this.answers[p.id] ||= {};
    this.notify();
    this.phaseTimer = this.later(() => this.scoreRound(), REVIEW_MS);
  }

  validity(pid, cat) {
    const raw = this.answers[pid]?.[cat] || '';
    const n = norm(raw);
    if (!n) return { ok: false, reason: 'blank' };
    if (n[0] !== this.letter.toLowerCase()) return { ok: false, reason: `doesn't start with ${this.letter}` };
    if (n.length < 2) return { ok: false, reason: 'too short' };
    const voters = this.votes[`${cat}|${pid}`]?.size || 0;
    const others = this.humans().filter(p => p.id !== pid).length;
    if (others > 0 && voters > others / 2) return { ok: false, reason: 'rejected by the class' };
    return { ok: true };
  }

  scoreRound() {
    if (this.phase !== 'review') return;
    this.cancel(this.phaseTimer);
    for (const p of this.players) { this.roundPoints[p.id] = 0; this.marks[p.id] = {}; }
    for (const cat of this.categories) {
      const valid = this.players.filter(p => this.validity(p.id, cat).ok);
      const counts = {};
      for (const p of valid) { const k = norm(this.answers[p.id][cat]); counts[k] = (counts[k] || 0) + 1; }
      for (const p of this.players) {
        const v = this.validity(p.id, cat);
        let points = 0;
        let reason = v.reason || '';
        if (v.ok) {
          const shared = counts[norm(this.answers[p.id][cat])] > 1;
          points = shared ? 5 : 10;
          reason = shared ? 'same as someone' : 'unique';
        }
        this.marks[p.id][cat] = { points, reason };
        this.roundPoints[p.id] += points;
      }
    }
    for (const p of this.players) this.totals[p.id] += this.roundPoints[p.id];
    this.history.push({ round: this.round, letter: this.letter, points: { ...this.roundPoints } });
    this.phase = this.round >= this.settings.rounds ? 'finished' : 'scores';
    this.deadline = null;
    if (this.phase === 'finished') {
      const best = Math.max(...this.players.map(p => this.totals[p.id]));
      const winners = this.players.filter(p => this.totals[p.id] === best).map(p => p.name);
      this.announce(`${winners.join(' & ')} topped Name Place Animal Thing with ${best} points.`);
    }
    this.notify();
  }

  playerLeft(pid) {
    if (this.left.has(pid)) return;
    this.left.add(pid);
    if (this.humans().length < 2) {
      this.abandoned = { by: this.player(pid)?.name || 'A player' };
      this.cancel(this.phaseTimer);
      return;
    }
    if (this.phase === 'writing' && this.humans().every(p => this.penDown.has(p.id))) this.endWriting();
    else if (this.phase === 'review' && this.humans().every(p => this.doneReviewing.has(p.id))) this.scoreRound();
  }

  getView(forId) {
    const revealed = ['review', 'scores', 'finished'].includes(this.phase);
    const sheets = {};
    for (const p of this.players) {
      if (revealed || p.id === forId) sheets[p.id] = this.answers[p.id] || {};
    }
    const votes = {};
    for (const [k, set] of Object.entries(this.votes)) votes[k] = { count: set.size, mine: set.has(forId) };
    const validity = {};
    if (this.phase === 'review') {
      for (const p of this.players) {
        validity[p.id] = Object.fromEntries(this.categories.map(c => [c, this.validity(p.id, c)]));
      }
    }
    return {
      gameType: 'npat',
      matchId: this.matchId,
      players: this.basePlayers().map(p => ({ ...p, penDown: this.penDown.has(p.id), doneReviewing: this.doneReviewing.has(p.id) })),
      phase: this.phase,
      round: this.round,
      settings: { ...this.settings },
      categories: this.categories,
      letter: this.phase === 'setup' ? null : this.letter,
      deadline: this.deadline,
      sheets,
      votes,
      validity,
      marks: revealed ? this.marks : {},
      roundPoints: this.phase === 'scores' || this.phase === 'finished' ? this.roundPoints : {},
      totals: { ...this.totals },
      history: this.history
    };
  }
}
