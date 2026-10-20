// FLAMES for RECESS. A one-player desk toy whose result can be pinned to the room's notice board.
//
// The algorithm (the one most of us used in class):
//   1. Keep only the letters a–z of each name, lower-cased.
//   2. For every letter of name A, if name B still has that letter, strike one copy from each (one for one).
//   3. Count the letters left in both names: n. If n = 0 (the names use exactly the same letters) the answer
//      is Friends.
//   4. Write F L A M E S. Starting at the first letter, count n letters (wrapping round) and strike the one you land on.
//      Start counting again from the letter after it. Repeat until one letter is left.
import { BaseEngine } from './base.mjs';

export const FLAMES = [
  { key: 'F', word: 'Friends', line: 'Tiffin-sharing, homework-copying, best-bench friends.' },
  { key: 'L', word: 'Love', line: 'Someone write their initials in a heart on the last page.' },
  { key: 'A', word: 'Affection', line: 'Soft corner detected. Pass the eraser politely.' },
  { key: 'M', word: 'Marriage', line: 'The whole class is invited. Samosas on the house.' },
  { key: 'E', word: 'Enemies', line: 'Rivals for the window seat, forever.' },
  { key: 'S', word: 'Siblings', line: 'Will fight over the TV remote for life.' }
];

export function flames(nameA, nameB) {
  const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 24);
  const a = clean(nameA).split('');
  const b = clean(nameB).split('');
  const struckA = Array(a.length).fill(false);
  const struckB = Array(b.length).fill(false);
  for (let i = 0; i < a.length; i++) {
    const j = b.findIndex((ch, k) => !struckB[k] && ch === a[i]);
    if (j !== -1) { struckA[i] = true; struckB[j] = true; }
  }
  const count = struckA.filter(x => !x).length + struckB.filter(x => !x).length;
  const letters = FLAMES.map(f => f.key);
  const eliminated = []; // in order
  if (count > 0) {
    let idx = 0;
    while (letters.length > 1) {
      idx = (idx + count - 1) % letters.length;
      eliminated.push(letters.splice(idx, 1)[0]);
      if (idx === letters.length) idx = 0;
    }
  } else {
    eliminated.push('L', 'A', 'M', 'E', 'S');
    letters.splice(0, letters.length, 'F');
  }
  const result = FLAMES.find(f => f.key === letters[0]);
  return { a: a.join(''), b: b.join(''), struckA, struckB, count, eliminated, result };
}

export class FlamesEngine extends BaseEngine {
  constructor(matchId, players, onUpdate, options) {
    super(matchId, players, onUpdate, options);
    this.reading = null; // { names: [A, B], ...flames() }
    this.shared = false;
    this.count = 0;
  }

  handleAction(playerId, action) {
    if (action.type === 'compute') {
      const A = String(action.a || '').trim().slice(0, 24);
      const B = String(action.b || '').trim().slice(0, 24);
      if (!/[a-z]/i.test(A) || !/[a-z]/i.test(B)) return { ok: false, error: 'Write two names with letters in them' };
      this.reading = { names: [A, B], ...flames(A, B) };
      this.shared = false;
      this.count++;
      this.notify();
      return { ok: true };
    }
    if (action.type === 'share') {
      if (!this.reading) return { ok: false, error: 'Nothing to share yet' };
      if (this.shared) return { ok: false, error: 'Already pinned to the notice board' };
      this.shared = true;
      const me = this.player(playerId);
      const [A, B] = this.reading.names;
      this.announce(`FLAMES says ${A} + ${B} = ${this.reading.result.word}! (worked out by ${me ? me.name : 'someone'})`);
      this.notify();
      return { ok: true };
    }
    if (action.type === 'reset') {
      this.reading = null;
      this.shared = false;
      this.notify();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown action' };
  }

  playerLeft() { this.dispose(); }

  getView() {
    return {
      gameType: 'flames',
      matchId: this.matchId,
      players: this.basePlayers(),
      reading: this.reading,
      shared: this.shared,
      count: this.count
    };
  }
}
