// Neon Casino's shared economy (games/casino/server/economy.mjs): stakes, bets, exactly-once settlement, refunds,
// and a ledger that always replays to the wallet.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { Economy, netWorth } from '../games/casino/server/economy.mjs';

function live(players = ['a', 'b'], cash = 10_000) {
  const e = new Economy({ now: () => 1000 });
  for (const p of players) e.stake(p, cash);
  e.locked = false;
  return e;
}
const clean = (e) => assert.deepEqual(e.audit(), []);

test('every player gets the same starting cash exactly once', () => {
  const e = live(['a', 'b', 'c']);
  for (const id of ['a', 'b', 'c']) assert.equal(e.account(id).cash, 10_000);
  assert.ok(e.stake('a', 10_000).error, 'a second stake is refused');
  assert.equal(e.account('a').cash, 10_000);
  assert.ok(e.stake('d', 0).error);
  assert.ok(e.stake('d', 12.5).error);
  clean(e);
});

test('a bet moves cash into reserve and refuses bad amounts', () => {
  const e = live();
  e.openRound({ roundId: 'r1', game: 'blackjack' });
  for (const amount of [0, -5, 1.5, NaN, Infinity, '100', 10_001, Number.MAX_SAFE_INTEGER + 2]) {
    assert.ok(e.reserve({ betId: 'x' + amount, playerId: 'a', roundId: 'r1', amount }).error, `amount ${amount} must be refused`);
  }
  assert.ok(e.reserve({ betId: 'b1', playerId: 'a', roundId: 'r1', amount: 400 }).ok);
  assert.equal(e.account('a').cash, 9_600);
  assert.equal(e.account('a').reserved, 400);
  assert.equal(netWorth(e.account('a')), 10_000, 'a reserved bet is still yours until it settles');
  clean(e);
});

test('a retried bet is recognised, not charged twice; a reused id is refused', () => {
  const e = live();
  e.openRound({ roundId: 'r1', game: 'roulette' });
  const first = e.reserve({ betId: 'b1', playerId: 'a', roundId: 'r1', amount: 500 });
  const again = e.reserve({ betId: 'b1', playerId: 'a', roundId: 'r1', amount: 500 });
  assert.ok(again.ok && again.duplicate);
  assert.equal(again.bet, first.bet);
  assert.equal(e.account('a').cash, 9_500);
  assert.ok(e.reserve({ betId: 'b1', playerId: 'b', roundId: 'r1', amount: 500 }).error, 'someone else can\'t ride on an existing bet id');
  clean(e);
});

test('the same chips can\'t be spent twice', () => {
  const e = live(['a'], 1_000);
  e.openRound({ roundId: 'r1', game: 'blackjack' });
  e.openRound({ roundId: 'r2', game: 'roulette' });
  // Two tables racing for the same last 1,000: Node runs them one after the other; the second sees the empty wallet.
  const results = [
    e.reserve({ betId: 'x', playerId: 'a', roundId: 'r1', amount: 1_000 }),
    e.reserve({ betId: 'y', playerId: 'a', roundId: 'r2', amount: 1_000 }),
  ];
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.match(results[1].error, /Not enough cash/);
  assert.equal(e.account('a').cash, 0);
  assert.equal(e.account('a').reserved, 1_000);
  clean(e);
});

test('betting is refused while the economy is locked, for frozen players, and on closed rounds', () => {
  const e = live();
  e.openRound({ roundId: 'r1', game: 'blackjack' });
  e.locked = true;
  assert.match(e.reserve({ betId: 'b1', playerId: 'a', roundId: 'r1', amount: 100 }).error, /closed/);
  e.locked = false;
  e.account('a').frozen = 'You are bankrupt.';
  assert.match(e.reserve({ betId: 'b2', playerId: 'a', roundId: 'r1', amount: 100 }).error, /bankrupt/);
  delete e.account('a').frozen;
  assert.ok(e.reserve({ betId: 'b3', playerId: 'nobody', roundId: 'r1', amount: 100 }).error);
  assert.ok(e.reserve({ betId: 'b4', playerId: 'a', roundId: 'nope', amount: 100 }).error);
  e.settleRound('r1', {}, { mode: 'house', maxMultiplier: 2 });
  assert.ok(e.reserve({ betId: 'b5', playerId: 'a', roundId: 'r1', amount: 100 }).error, 'a settled round takes no bets');
  clean(e);
});

test('a house round settles once: winners paid, losers lose their stake, the second settle is a no-op', () => {
  const e = live();
  e.openRound({ roundId: 'r1', game: 'blackjack', tableId: 'blackjack' });
  e.reserve({ betId: 'a1', playerId: 'a', roundId: 'r1', amount: 1_000 });
  e.reserve({ betId: 'a2', playerId: 'a', roundId: 'r1', amount: 1_000 });   // a doubled down
  e.reserve({ betId: 'b1', playerId: 'b', roundId: 'r1', amount: 500 });
  const res = e.settleRound('r1', { a: 4_000 }, { mode: 'house', maxMultiplier: 2.5 });
  assert.ok(res.ok);
  assert.deepEqual(res.results.map((r) => [r.playerId, r.net]), [['a', 2_000], ['b', -500]]);
  assert.equal(e.account('a').cash, 12_000);
  assert.equal(e.account('b').cash, 9_500);
  assert.equal(e.account('a').reserved + e.account('b').reserved, 0);
  assert.equal(e.account('a').won, 2_000);
  assert.equal(e.account('b').lost, 500);
  assert.deepEqual(e.account('a').byGame.blackjack, { rounds: 1, won: 2_000, lost: 0, net: 2_000 });
  assert.equal(e.house, -1_500);
  const again = e.settleRound('r1', { a: 4_000 }, { mode: 'house', maxMultiplier: 2.5 });
  assert.ok(again.duplicate);
  assert.equal(e.account('a').cash, 12_000, 'no double payment');
  clean(e);
});

test('invalid payouts are rejected without changing anything', () => {
  const e = live(['a', 'b', 'c']);
  e.openRound({ roundId: 'r1', game: 'roulette' });
  e.reserve({ betId: 'a1', playerId: 'a', roundId: 'r1', amount: 100 });
  e.reserve({ betId: 'b1', playerId: 'b', roundId: 'r1', amount: 100 });
  const before = JSON.stringify(e.toJSON());
  const bad = [
    [{ a: 3_700 }, { mode: 'house', maxMultiplier: 36 }],     // above 36x
    [{ a: -1 }, { mode: 'house', maxMultiplier: 36 }],
    [{ a: 1.5 }, { mode: 'house', maxMultiplier: 36 }],
    [{ c: 100 }, { mode: 'house', maxMultiplier: 36 }],        // c never bet
    [{ a: 100 }, { mode: 'house' }],                           // no multiplier given
    [{ a: 100 }, { mode: 'magic', maxMultiplier: 2 }],
    [{ a: 150 }, { mode: 'pool' }],                            // pool must balance: 200 in
    [{ a: 300 }, { mode: 'pool' }],
  ];
  for (const [payouts, opts] of bad) assert.ok(e.settleRound('r1', payouts, opts).error, JSON.stringify(payouts) + JSON.stringify(opts));
  assert.equal(JSON.stringify(e.toJSON()), before, 'rejected settlements leave no trace');
  assert.ok(e.settleRound('r1', { a: 200, b: 0 }, { mode: 'pool' }).ok, 'a balanced pool settles');
  assert.equal(e.account('a').cash + e.account('b').cash, 20_000, 'pool games only move chips between players');
  clean(e);
});

test('a voided round refunds every open bet exactly once', () => {
  const e = live();
  e.openRound({ roundId: 'r1', game: 'poker' });
  e.reserve({ betId: 'a1', playerId: 'a', roundId: 'r1', amount: 300 });
  e.reserve({ betId: 'b1', playerId: 'b', roundId: 'r1', amount: 700 });
  assert.ok(e.voidRound('r1').ok);
  assert.ok(e.voidRound('r1').duplicate);
  assert.equal(e.account('a').cash, 10_000);
  assert.equal(e.account('b').cash, 10_000);
  assert.ok(e.settleRound('r1', { a: 1_000 }, { mode: 'pool' }).error, 'a cancelled round can\'t be settled');
  clean(e);
});

test('the ledger replays to the wallet, and tampering is detected', () => {
  const e = live(['a', 'b', 'c']);
  let n = 0;
  for (let round = 0; round < 40; round++) {
    const id = 'r' + round;
    e.openRound({ roundId: id, game: round % 2 ? 'roulette' : 'blackjack' });
    for (const p of ['a', 'b', 'c']) {
      const amt = 50 + ((round * 37 + p.charCodeAt(0)) % 400);
      if (e.account(p).cash >= amt) e.reserve({ betId: 'b' + n++, playerId: p, roundId: id, amount: amt });
    }
    const st = e.stakes(id);
    const pay = {};
    for (const [p, s] of st) pay[p] = (round + p.charCodeAt(0)) % 3 === 0 ? s * 2 : 0;
    if (round % 7 === 6) e.voidRound(id); else e.settleRound(id, pay, { mode: 'house', maxMultiplier: 2 });
    clean(e);
  }
  for (const p of ['a', 'b', 'c']) {
    const a = e.account(p);
    const fromLedger = e.ledger.filter((x) => x.playerId === p).reduce((s, x) => s + x.cash, 0);
    assert.equal(fromLedger, a.cash);
    assert.equal(a.won - a.lost, netWorth(a) - 10_000, 'lifetime results explain the whole change in net worth');
  }
  e.account('a').cash += 1;
  assert.ok(e.audit().length > 0, 'a wallet edited outside the ledger is caught');
});

test('restarting archives the session and gives everyone an identical fresh wallet', () => {
  const e = live();
  e.openRound({ roundId: 'r1', game: 'blackjack' });
  e.reserve({ betId: 'a1', playerId: 'a', roundId: 'r1', amount: 2_000 });
  e.settleRound('r1', {}, { mode: 'house', maxMultiplier: 2 });
  e.openRound({ roundId: 'r2', game: 'blackjack' });
  e.reserve({ betId: 'b1', playerId: 'b', roundId: 'r2', amount: 900 });     // still open when the host restarts
  e.resetSession(['a', 'b'], 5_000);
  assert.equal(e.session, 2);
  assert.equal(e.archive.length, 1);
  const old = e.archive[0].accounts.find((x) => x.playerId === 'b');
  assert.equal(old.cash, 10_000, 'the open bet was refunded before archiving');
  for (const p of ['a', 'b']) { assert.ok(e.stake(p, 5_000).ok); assert.equal(e.account(p).cash, 5_000); }
  clean(e);
});

test('the economy survives a save and restore', () => {
  const e = live();
  e.openRound({ roundId: 'r1', game: 'blackjack' });
  e.reserve({ betId: 'a1', playerId: 'a', roundId: 'r1', amount: 250 });
  const copy = Economy.fromJSON(JSON.parse(JSON.stringify(e.toJSON())));
  assert.deepEqual(copy.audit(), []);
  assert.equal(copy.account('a').reserved, 250);
  assert.ok(copy.reserve({ betId: 'a1', playerId: 'a', roundId: 'r1', amount: 250 }).duplicate, 'bet ids survive a restart');
  assert.ok(copy.settleRound('r1', { a: 500 }, { mode: 'house', maxMultiplier: 2 }).ok);
  assert.equal(copy.account('a').cash, 10_250);
});
