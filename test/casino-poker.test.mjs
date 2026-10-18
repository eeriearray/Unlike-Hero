// Neon Casino Texas Hold'em (games/casino/server/games/poker.mjs): hand rankings, side pots, betting rules, timers,
// privacy and chip conservation, played through a real room.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { CasinoRoom } from '../games/casino/server/room.mjs';
import { eval5, bestHand, RULES } from '../games/casino/server/games/poker.mjs';
import { sidePots, splitPot, compareKeys } from '../games/casino/server/games/kit.mjs';

function clock() {
  let now = 1_000_000, seq = 0;
  const queue = new Map();
  return {
    now: () => now,
    timers: { set(fn, ms) { const id = ++seq; queue.set(id, { at: now + ms, fn }); return id; }, clear(id) { queue.delete(id); } },
    advance(ms) {
      const until = now + ms;
      for (;;) {
        let next = null, nextId = null;
        for (const [id, t] of queue) if (t.at <= until && (!next || t.at < next.at)) { next = t; nextId = id; }
        if (!next) break;
        queue.delete(nextId); now = next.at; next.fn();
      }
      now = until;
    },
  };
}
function seeded(seed) { let s = seed >>> 0; return (n) => { s = (s * 1664525 + 1013904223) >>> 0; return Math.floor((s / 2 ** 32) * n); }; }
const cmp = (a, b) => compareKeys(eval5(a), eval5(b));

/** A live room with n players seated at the poker table; the first hand is dealt. */
function setup(n = 3, { seed = 3, cash } = {}) {
  const c = clock();
  const fx = [];
  const room = new CasinoRoom({ code: 'PK001', now: c.now, timers: c.timers, rng: seeded(seed), hooks: { fx: (r, d) => fx.push(d) } });
  const ids = [];
  for (let i = 0; i < n; i++) { const { player } = room.addPlayer({ name: 'P' + i }); room.setConnected(player.id, true); ids.push(player.id); }
  for (const id of ids.slice(1)) room.command(id, { type: 'ready', ready: true });
  room.command(ids[0], { type: 'start' });
  const e = room.economy;
  // Optional: trim wallets to set up short stacks (the difference goes to the house).
  if (cash) cash.forEach((target, i) => {
    const id = ids[i], loss = e.account(id).cash - target;
    if (loss > 0) { e.openRound({ roundId: 'trim' + i, game: 'blackjack' }); e.reserve({ betId: 'trim' + i, playerId: id, roundId: 'trim' + i, amount: loss }); e.settleRound('trim' + i, {}, { mode: 'house', maxMultiplier: 2 }); }
  });
  for (const id of ids) assert.ok(room.command(id, { type: 'sit', tableId: 'poker' }).ok);
  c.advance(RULES.startMs);
  const st = () => room.tableState.poker;
  const h = () => st().hand;
  const play = (id, action, extra = {}) => room.command(id, { type: 'play', tableId: 'poker', action, ...extra });
  const turn = () => h().players[h().turn].pid;
  /** Fix hole cards (by player id) and the next board cards. */
  const rig = (holes, board = []) => {
    for (const p of h().players) if (holes[p.pid]) p.hole = holes[p.pid];
    h().deck = [...Array(20).fill('2C'), ...board.slice().reverse()];
  };
  const chips = () => ids.reduce((s, id) => s + e.account(id).cash + e.account(id).reserved, 0);
  return { room, ids, c, fx, e, st, h, play, turn, rig, chips, view: (id) => room.viewFor(id).tables.find((t) => t.id === 'poker').state };
}

test('hand rankings, kickers, the wheel and best-of-seven', () => {
  const ladder = [
    ['AS', 'KS', 'QS', 'JS', 'TS'], ['9H', '8H', '7H', '6H', '5H'], ['QC', 'QD', 'QH', 'QS', '2C'], ['JC', 'JD', 'JH', '4S', '4C'],
    ['KD', 'TD', '8D', '6D', '3D'], ['TC', '9D', '8H', '7S', '6C'], ['5C', '4D', '3H', '2S', 'AC'], ['7C', '7D', '7H', 'KS', '2C'],
    ['9C', '9D', '5H', '5S', 'AC'], ['8C', '8D', 'AH', 'KS', '2C'], ['AC', 'QD', '9H', '7S', '3C'],
  ];
  for (let i = 0; i < ladder.length - 1; i++) assert.equal(cmp(ladder[i], ladder[i + 1]), 1, `${ladder[i]} beats ${ladder[i + 1]}`);
  assert.equal(cmp(['8C', '8D', 'AH', 'KS', '3C'], ['8H', '8S', 'AD', 'KC', '2C']), 1, 'kicker decides');
  assert.equal(cmp(['AC', 'KD', '9H', '7S', '3C'], ['AD', 'KC', '9S', '7D', '3H']), 0, 'exact tie');
  assert.equal(bestHand(['AS', 'KS', 'QS', 'JS', 'TS', '2C', '3D']).name, 'Royal flush');
  assert.equal(bestHand(['2C', '2D', '9H', '9S', '9C', 'KD', 'KH']).name, 'Full house');
  assert.deepEqual(bestHand(['2C', '2D', '9H', '9S', '9C', 'KD', 'KH']).key, [6, 9, 13], 'nines full of kings, not twos');
  assert.equal(bestHand(['AH', '2D', '3C', '4S', '5H', 'KD', 'KC']).name, 'Straight');
  assert.equal(bestHand(['AH', 'AD', '3C', '3S', '9H', 'KD']).name, 'Two pair', 'six cards (after the turn)');
  assert.equal(bestHand(['AH', 'AD', '3C', '7S', '9H']).name, 'Pair', 'five cards (after the flop)');
});

test('side pots: each player can only win what they matched; folded chips stay in', () => {
  const pots = sidePots({ a: 100, b: 300, c: 300, d: 200 }, new Set(['a', 'b', 'c']));
  assert.deepEqual(pots, [{ amount: 400, eligible: ['a', 'b', 'c'] }, { amount: 500, eligible: ['b', 'c'] }]);
  assert.deepEqual(sidePots({ a: 1000, b: 300 }, new Set(['a', 'b'])), [{ amount: 600, eligible: ['a', 'b'] }, { amount: 700, eligible: ['a'] }], 'an uncalled bet goes back');
  assert.deepEqual(splitPot(101, ['x', 'y']), { x: 51, y: 50 });
});

test('heads-up: the button posts the small blind and acts first; after the flop the big blind acts first', () => {
  const t = setup(2);
  const h = t.h();
  const [btn, bb] = h.players;
  assert.equal(btn.street, 50);
  assert.equal(bb.street, 100);
  assert.equal(t.turn(), btn.pid);
  assert.ok(t.play(btn.pid, 'call').ok);
  assert.equal(t.turn(), bb.pid, 'the big blind gets the option');
  assert.ok(t.play(bb.pid, 'check').ok);
  assert.equal(h.street, 'flop');
  assert.equal(h.board.length, 3);
  assert.equal(t.turn(), bb.pid);
});

test('three-handed: blinds after the button, first to act after the big blind, folds win the blinds', () => {
  const t = setup(3);
  const h = t.h();
  const [btn, sb, bb] = h.players;
  assert.deepEqual([sb.street, bb.street], [50, 100]);
  assert.equal(t.turn(), btn.pid);
  t.play(btn.pid, 'fold');
  t.play(sb.pid, 'fold');
  assert.equal(t.st().phase, 'results');
  assert.equal(t.e.account(bb.pid).cash, 10_050);
  assert.equal(t.e.account(sb.pid).cash, 9_950);
  assert.equal(t.chips(), 30_000);
  assert.deepEqual(t.e.audit(), []);
  t.c.advance(RULES.resultsMs);
  assert.equal(t.st().phase, 'playing', 'the next hand is dealt');
  assert.equal(t.st().button, (h.players[0].seat + 1) % 6, 'the button moved');
});

test('a hand played to showdown pays the best hand', () => {
  const t = setup(2);
  const [btn, bb] = t.h().players;
  t.rig({ [btn.pid]: ['AS', 'AD'], [bb.pid]: ['KS', 'KD'] }, ['2C', '7H', '9D', 'JC', '3S']);
  t.play(btn.pid, 'raise', { to: 300 });
  t.play(bb.pid, 'call');
  for (const street of ['flop', 'turn', 'river']) {
    assert.equal(t.h().street, street);
    t.play(bb.pid, 'check'); t.play(btn.pid, 'check');
  }
  assert.equal(t.st().phase, 'results');
  const last = t.st().last;
  assert.ok(last.shown);
  assert.equal(last.hands[btn.pid].name, 'Pair');
  assert.equal(t.e.account(btn.pid).cash, 10_300);
  assert.equal(t.e.account(bb.pid).cash, 9_700);
});

test('a short all-in wins only the main pot; the side pot goes to the best of the rest', () => {
  const t = setup(3, { cash: [10_000, 10_000, 500] });
  const h = t.h();
  const short = h.players.find((p) => t.e.account(p.pid).cash + t.e.account(p.pid).reserved === 500);
  assert.ok(short, 'one player has only 500');
  t.rig({ [short.pid]: ['AS', 'AD'], ...Object.fromEntries(h.players.filter((p) => p !== short).map((p, i) => [p.pid, i ? ['QS', 'QD'] : ['KS', 'KD']])) }, ['2C', '7H', '9D', 'JC', '3S']);
  // Before the flop the big stacks go to 2,000 and the short stack is all in for 500; then everyone checks it down.
  while (t.st().phase === 'playing') {
    const pid = t.turn(), me = t.h().players.find((p) => p.pid === pid);
    if (t.h().street === 'preflop' && t.h().currentBet < 2_000 && me !== short) t.play(pid, 'raise', { to: 2_000 });
    else if (me.street < t.h().currentBet) t.play(pid, me === short ? 'allin' : 'call');
    else t.play(pid, 'check');
  }
  const kings = h.players.find((p) => p.hole[0] === 'KS');
  const queens = h.players.find((p) => p.hole[0] === 'QS');
  // Main pot 1,500 (500 × 3) to the aces; side pot 3,000 (1,500 × 2) to the kings.
  assert.equal(t.e.account(short.pid).cash, 1_500);
  assert.equal(t.e.account(kings.pid).cash, 10_000 - 2_000 + 3_000);
  assert.equal(t.e.account(queens.pid).cash, 8_000);
  assert.equal(t.st().last.pots.length, 2);
  assert.equal(t.chips() + t.e.house, 30_000);
  assert.deepEqual(t.e.audit(), []);
});

test('identical hands split the pot', () => {
  const t = setup(2);
  const [btn, bb] = t.h().players;
  t.rig({ [btn.pid]: ['2S', '3D'], [bb.pid]: ['2H', '3C'] }, ['AC', 'KC', 'QH', 'JD', 'TS']);
  t.play(btn.pid, 'call'); t.play(bb.pid, 'check');
  for (let i = 0; i < 3; i++) { t.play(bb.pid, 'check'); t.play(btn.pid, 'check'); }
  assert.equal(t.st().last.pots[0].winners.length, 2);
  assert.equal(t.e.account(btn.pid).cash, 10_000);
  assert.equal(t.e.account(bb.pid).cash, 10_000);
});

test('raise sizes, and a short all-in doesn\'t reopen raising', () => {
  const t = setup(3, { cash: [10_000, 10_000, 10_000] });
  const [btn, sb, bb] = t.h().players;
  assert.match(t.play(btn.pid, 'raise', { to: 150 }).error, /minimum raise is to \$200/);
  assert.match(t.play(btn.pid, 'raise', { to: 99_999 }).error, /at most/);
  assert.match(t.play(btn.pid, 'check').error, /call/);
  assert.match(t.play(sb.pid, 'fold').error, /turn/);
  assert.ok(t.play(btn.pid, 'raise', { to: 400 }).ok);       // a raise of 300
  assert.match(t.play(sb.pid, 'raise', { to: 600 }).error, /minimum raise is to \$700/);
  assert.ok(t.play(sb.pid, 'call').ok);
  assert.ok(t.play(bb.pid, 'call').ok);
  assert.equal(t.h().street, 'flop');

  const u = setup(3, { cash: [10_000, 10_000, 700] });
  const [b2, s2, short] = u.h().players;
  assert.ok(u.play(b2.pid, 'raise', { to: 500 }).ok);
  assert.ok(u.play(s2.pid, 'call').ok);
  assert.ok(u.play(short.pid, 'allin').ok);                 // to 700: a raise of 200, less than the 400 minimum
  assert.equal(u.turn(), b2.pid);
  assert.match(u.play(b2.pid, 'raise', { to: 2_000 }).error, /only call or fold/);
  assert.ok(!u.view(b2.pid).you.moves.includes('raise'));
  assert.ok(u.play(b2.pid, 'call').ok);
});

test('a stalled turn checks if it can, otherwise folds; offline players get a short clock', () => {
  const t = setup(3);
  const [btn, sb, bb] = t.h().players;
  t.c.advance(RULES.turnMs);
  assert.ok(t.h().players[0].folded, 'facing the big blind, the button folds');
  t.room.setConnected(sb.pid, false);
  t.c.advance(RULES.offlineTurnMs);
  assert.equal(t.st().phase, 'results', 'sb folded on the short clock, bb wins');
  void btn; void bb;
});

test('standing up mid-hand folds; the last player in takes the pot', () => {
  const t = setup(2);
  const [btn, bb] = t.h().players;
  t.play(btn.pid, 'raise', { to: 1_000 });
  t.room.command(bb.pid, { type: 'stand-up' });
  assert.equal(t.st().phase, 'results');
  assert.equal(t.e.account(btn.pid).cash, 10_100);
  assert.equal(t.e.account(bb.pid).cash, 9_900);
});

test('ending the session mid-hand returns every chip in the pot', () => {
  const t = setup(3);
  const [btn] = t.h().players;
  t.play(btn.pid, 'raise', { to: 900 });
  t.room.command(t.ids[0], { type: 'end' });
  for (const id of t.ids) assert.equal(t.e.account(id).cash, 10_000);
  assert.deepEqual(t.e.audit(), []);
});

test('nobody sees another player\'s hole cards before showdown, and the deck never leaves the server', () => {
  const t = setup(3);
  const [a, b] = t.h().players;
  const v = t.view(a.pid);
  assert.equal(v.hand.players.find((p) => p.pid === a.pid).hole.length, 2);
  assert.equal(v.hand.players.find((p) => p.pid === b.pid).hole, null);
  const json = JSON.stringify(t.room.viewFor(a.pid));
  for (const card of b.hole) assert.ok(!json.includes(`"${card}"`) || a.hole.includes(card), `${card} leaked`);
  assert.ok(!('deck' in v.hand));
});

test('a wallet larger than the table maximum only risks the maximum', () => {
  const t = setup(2);
  const [btn, bb] = t.h().players;
  t.play(btn.pid, 'allin');
  assert.equal(t.h().players[0].contrib, 5_000);
  t.play(bb.pid, 'call');
  assert.equal(t.st().phase, 'results');
  const total = t.e.account(btn.pid).cash + t.e.account(bb.pid).cash;
  assert.equal(total, 20_000);
});

test('300 random hands with four players never create or lose a chip', () => {
  const t = setup(4, { seed: 11 });
  const rnd = seeded(77);
  for (let hand = 0; hand < 300 && t.st().phase !== 'waiting'; hand++) {
    let guard = 0;
    while (t.st().phase === 'playing' && guard++ < 200) {
      const pid = t.turn();
      const you = t.view(pid).you;
      const pick = rnd(10);
      if (pick === 0) t.play(pid, 'fold');
      else if (pick === 1) t.play(pid, 'allin');
      else if (pick < 4 && you.moves.includes('raise')) t.play(pid, 'raise', { to: you.minRaiseTo + rnd(3) * 100 > you.maxRaiseTo ? you.maxRaiseTo : you.minRaiseTo + rnd(3) * 100 });
      else if (pick === 4) t.c.advance(RULES.turnMs);
      else t.play(pid, you.toCall ? 'call' : 'check');
    }
    assert.notEqual(t.st().phase, 'playing', `hand ${hand} got stuck`);
    assert.equal(t.chips(), 40_000, `hand ${hand}: poker only moves chips between players`);
    assert.deepEqual(t.e.audit(), []);
    t.c.advance(RULES.resultsMs);
  }
  assert.ok(t.room.session.rounds > 20);
});
