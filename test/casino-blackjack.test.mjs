// Neon Casino blackjack (games/casino/server/games/blackjack.mjs) played through a real room: hand values, payouts,
// hit/stand/double/split, the dealer's rules, timers, pausing, ending mid-hand, privacy and money conservation.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { CasinoRoom, DEFAULT_SETTINGS } from '../games/casino/server/room.mjs';
import { handValue, handPayout, newShoe, RULES } from '../games/casino/server/games/blackjack.mjs';

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

/** A live room with n players seated at the blackjack table. */
function setup(n = 1, { settings, seed = 7 } = {}) {
  const c = clock();
  const fx = [];
  const room = new CasinoRoom({ code: 'BJ001', now: c.now, timers: c.timers, rng: seeded(seed), settings, hooks: { fx: (r, d) => fx.push(d) } });
  const ids = [];
  for (let i = 0; i < n; i++) { const { player } = room.addPlayer({ name: 'P' + i }); room.setConnected(player.id, true); ids.push(player.id); }
  for (const id of ids.slice(1)) room.command(id, { type: 'ready', ready: true });
  assert.ok(room.command(ids[0], { type: 'start' }).ok);
  for (const id of ids) assert.ok(room.command(id, { type: 'sit', tableId: 'blackjack' }).ok);
  const play = (id, action, extra = {}) => room.command(id, { type: 'play', tableId: 'blackjack', action, ...extra });
  const st = () => room.tableState.blackjack;
  /** Put these cards on top of the shoe, dealt in this order (deal order: each player, dealer up, each player, dealer hole). */
  const stack = (...cards) => { st().shoe = [...Array(120).fill('2C'), ...cards.reverse()]; };
  const cash = (id) => room.economy.account(id).cash;
  return { room, ids, c, fx, play, st, stack, cash, view: (id) => room.viewFor(id).tables.find((t) => t.id === 'blackjack').state };
}
const clean = (room) => assert.deepEqual(room.economy.audit(), []);

test('hand values handle soft aces', () => {
  assert.deepEqual(handValue(['AS', '6H']), { total: 17, soft: true });
  assert.deepEqual(handValue(['AS', '6H', 'TC']), { total: 17, soft: false });
  assert.deepEqual(handValue(['AS', 'AH', '9C']), { total: 21, soft: true });
  assert.deepEqual(handValue(['KS', 'QH', '5C']), { total: 25, soft: false });
  assert.deepEqual(handValue(['AS', 'AH', 'AD', 'AC']), { total: 14, soft: true });
});

test('payouts: 3:2 blackjack rounded down, 1:1 wins, pushes, and a split 21 is not a blackjack', () => {
  const h = (cards, bet = 100, fromSplit = false) => ({ cards, bet, fromSplit });
  assert.deepEqual(handPayout(h(['AS', 'KH'], 101), ['9C', '7D', '2H']), { result: 'blackjack', payout: 252 });
  assert.deepEqual(handPayout(h(['AS', 'KH']), ['AC', 'QD']), { result: 'push', payout: 100 });
  assert.deepEqual(handPayout(h(['TS', '9H']), ['AC', 'QD']), { result: 'lose', payout: 0 });
  assert.deepEqual(handPayout(h(['TS', '5H', '6C']), ['AC', 'QD']), { result: 'lose', payout: 0 }, 'a three-card 21 loses to a dealer blackjack');
  assert.deepEqual(handPayout(h(['AS', 'KH'], 100, true), ['TC', '7D']), { result: 'win', payout: 200 });
  assert.deepEqual(handPayout(h(['TS', '8H']), ['TC', '6D', '9H']), { result: 'win', payout: 200 });
  assert.deepEqual(handPayout(h(['TS', '8H']), ['TC', '8D']), { result: 'push', payout: 100 });
  assert.deepEqual(handPayout(h(['TS', '8H', '5C']), ['TC', '6D', '9H']), { result: 'bust', payout: 0 }, 'player busts first and loses even if the dealer busts');
});

test('a shoe is six full decks, shuffled', () => {
  const shoe = newShoe(seeded(3));
  assert.equal(shoe.length, 312);
  assert.equal(new Set(shoe).size, 52);
  assert.equal(shoe.filter((c) => c === 'AS').length, 6);
  assert.notDeepEqual(shoe.slice(0, 10), newShoe(seeded(4)).slice(0, 10));
});

test('a losing hand: bet, hit, stand, dealer draws to 17+, the stake goes to the house', () => {
  const t = setup(1);
  const [a] = t.ids;
  t.stack('TS', 'TH', '6C', '6D', '5S', '5C');      // P: T,6  D: T up, 6 hole · P hits 5 → 21? no: next card is 5S
  assert.ok(t.play(a, 'bet', { amount: 500 }).ok);   // the only seated player bet → dealt at once
  assert.equal(t.st().phase, 'playing');
  assert.equal(t.cash(a), 9_500);
  assert.deepEqual(t.view(a).you.moves, ['hit', 'stand', 'double']);
  assert.ok(t.play(a, 'hit').ok);                      // T,6,5 = 21 → stands automatically
  assert.equal(t.st().phase, 'results');
  // Dealer T,6 = 16 draws 5C = 21: player 21 vs dealer 21 → push.
  assert.equal(t.view(a).last.hands[0].result, 'push');
  assert.equal(t.cash(a), 10_000);
  clean(t.room);

  t.c.advance(RULES.resultsMs);
  assert.equal(t.st().phase, 'idle');
  t.stack('TS', 'TH', '7C', '7D', '9S');               // P 17 stands; dealer 17 stands; push again? make dealer 18
  t.st().shoe[t.st().shoe.length - 4] = '8D';          // dealer hole → 8: dealer 18
  t.play(a, 'bet', { amount: 300 });
  t.play(a, 'stand');
  assert.equal(t.view(a).last.hands[0].result, 'lose');
  assert.equal(t.cash(a), 9_700);
  assert.equal(t.room.economy.account(a).lost, 300);
  assert.equal(t.room.economy.house, 300);
  clean(t.room);
});

test('a natural pays 3:2 without a turn', () => {
  const t = setup(1);
  const [a] = t.ids;
  t.stack('AS', '9H', 'KC', '7D');
  t.play(a, 'bet', { amount: 500 });
  assert.equal(t.st().phase, 'results');
  assert.equal(t.view(a).last.hands[0].result, 'blackjack');
  assert.equal(t.cash(a), 10_750);
  assert.ok(t.fx.some((f) => f.kind === 'big-win' && f.blackjack));
  assert.ok(t.room.feed.some((f) => /blackjack/.test(f.text)));
});

test('the dealer peeks: a dealer blackjack ends the round at once, and a player blackjack pushes it', () => {
  const t = setup(2);
  const [a, b] = t.ids;
  t.stack('TS', 'AH', 'AD', '9C', 'KH', 'QD');    // a: T,9  b: A,K   dealer: A up, Q hole
  t.play(a, 'bet', { amount: 400 });
  t.play(b, 'bet', { amount: 400 });
  assert.equal(t.st().phase, 'results');
  const last = t.view(a).last;
  assert.deepEqual(last.hands.map((h) => h.result), ['lose', 'push']);
  assert.equal(t.cash(a), 9_600);
  assert.equal(t.cash(b), 10_000);
});

test('doubling reserves a second stake, draws one card and pays on the doubled bet', () => {
  const t = setup(1);
  const [a] = t.ids;
  t.stack('6S', 'TH', '5C', '7D', 'TD');          // P 6,5 doubles → T = 21; dealer T,7 = 17
  t.play(a, 'bet', { amount: 500 });
  assert.ok(t.play(a, 'double').ok);
  assert.equal(t.st().phase, 'results');
  const h = t.view(a).last.hands[0];
  assert.equal(h.bet, 1_000);
  assert.equal(h.cards.length, 3);
  assert.equal(h.result, 'win');
  assert.equal(t.cash(a), 11_000);
  clean(t.room);
});

test('splitting makes two hands with their own stakes; split aces take one card each and 21 pays 1:1', () => {
  const t = setup(1);
  const [a] = t.ids;
  t.stack('8S', '6H', '8C', 'TD', '3C', '2H', 'TC');   // P 8,8 vs dealer 6 up / T hole · split: hand1 8+3, hand2 8+2
  t.play(a, 'bet', { amount: 200 });
  assert.ok(t.view(a).you.moves.includes('split'));
  assert.ok(t.play(a, 'split').ok);
  assert.equal(t.cash(a), 9_600);
  assert.equal(t.st().round.hands.length, 2);
  assert.ok(t.play(a, 'stand').ok);                    // hand 1: 11, stand (silly but legal)
  assert.ok(t.play(a, 'stand').ok);                    // hand 2: 10
  // Dealer 6+T = 16 draws TC → 26, busts: both hands win.
  assert.deepEqual(t.view(a).last.hands.map((h) => h.result), ['win', 'win']);
  assert.equal(t.cash(a), 10_400);
  clean(t.room);

  t.c.advance(RULES.resultsMs);
  t.stack('AS', '9H', 'AC', '8D', 'KD', 'QH');          // P A,A vs dealer 9/8 · split aces get K and Q → two 21s, no blackjack
  t.play(a, 'bet', { amount: 100 });
  t.play(a, 'split');
  assert.equal(t.st().phase, 'results', 'split aces finish without a turn');
  assert.deepEqual(t.view(a).last.hands.map((h) => [h.total, h.result]), [[21, 'win'], [21, 'win']]);
  assert.equal(t.cash(a), 10_600);
});

test('bad moves are refused: limits, double bets, wrong turn, not seated, not enough cash', () => {
  const t = setup(2);
  const [a, b] = t.ids;
  assert.match(t.play(a, 'bet', { amount: 50 }).error, /\$100 to \$5,000/);
  assert.match(t.play(a, 'bet', { amount: 5_001 }).error, /\$100 to \$5,000/);
  assert.ok(t.play(a, 'bet', { amount: 150.5 }).error);
  assert.ok(t.play(a, 'bet', { amount: '500' }).error);
  assert.ok(t.play(a, 'hit').error, 'no hand before the deal');
  t.stack('TS', '9H', '5C', '7D', '8S', '6D');
  assert.ok(t.play(a, 'bet', { amount: 500 }).ok);
  assert.match(t.play(a, 'bet', { amount: 500 }).error, /already/);
  assert.equal(t.st().phase, 'betting', 'waits for the other seated player');
  assert.ok(t.play(b, 'bet', { amount: 500 }).ok);
  assert.equal(t.st().phase, 'playing');
  assert.match(t.play(b, 'hit').error, /turn/);
  assert.ok(t.play(a, 'split').error, 'T and 5 are not a pair');
  const outsider = t.room.addPlayer({ name: 'Late' }).player.id;
  assert.match(t.room.command(outsider, { type: 'play', tableId: 'blackjack', action: 'hit' }).error, /Sit/);
  assert.ok(t.room.command(a, { type: 'play', tableId: 'poker', action: 'hit' }).error);
  assert.ok(t.play(a, 'cheat').error);
  clean(t.room);
});

test('a betting clock deals for whoever bet; a turn clock stands for whoever stalls', () => {
  const t = setup(3);
  const [a, b, c] = t.ids;
  t.stack('TS', '9H', '7C', '8D', '7S', '7H', '9C');
  t.play(a, 'bet', { amount: 100 });
  t.play(b, 'bet', { amount: 100 });
  assert.equal(t.st().phase, 'betting');
  t.c.advance(RULES.bettingMs - 1);
  assert.equal(t.st().phase, 'betting');
  t.c.advance(1);
  assert.equal(t.st().phase, 'playing');
  assert.equal(t.st().round.hands.length, 2, 'c sat out this round');
  assert.ok(!t.st().round.bets[c]);
  t.c.advance(RULES.turnMs);                            // a stalls → stands
  assert.equal(t.st().round.turn, 1);
  assert.ok(t.st().round.hands[0].timedOut);
  t.c.advance(RULES.turnMs);
  assert.equal(t.st().phase, 'results');
  clean(t.room);
});

test('the deal doesn\'t wait for a seated player who can\'t cover the minimum', () => {
  const t = setup(2);
  const [a, b] = t.ids;
  t.room.economy.openRound({ roundId: 'drain', game: 'blackjack' });
  t.room.economy.reserve({ betId: 'd', playerId: b, roundId: 'drain', amount: 9_950 });
  t.room.economy.settleRound('drain', {}, { mode: 'house', maxMultiplier: 2 });   // b is down to $50, under the $100 minimum
  t.stack('TS', '9H', '7C', '8D');
  assert.ok(t.play(a, 'bet', { amount: 100 }).ok);
  assert.equal(t.st().phase, 'playing', 'dealt at once instead of waiting 15s for b');
});

test('disconnecting or standing up never takes a bet back', () => {
  const t = setup(2);
  const [a, b] = t.ids;
  t.stack('TS', '9H', '9C', '6D', '7S', '8D');         // a: T,6=16  b: 9,7=16  dealer 9/8 = 17
  t.play(a, 'bet', { amount: 1_000 });
  t.play(b, 'bet', { amount: 1_000 });
  t.room.setConnected(a, false);                       // a drops on their turn
  t.c.advance(RULES.turnMs);                           // the table doesn't wait forever: a's 16 stands
  assert.equal(t.st().round.turn, 1);
  assert.ok(t.room.command(b, { type: 'stand-up' }).ok);   // b walks away mid-hand: their 16 stands
  assert.equal(t.st().phase, 'results');
  assert.deepEqual(t.view(a).last.hands.map((h) => h.result), ['lose', 'lose']);
  assert.equal(t.cash(a), 9_000);
  assert.equal(t.cash(b), 9_000);
  // Standing up after betting but before the deal: the bet still plays.
  t.c.advance(RULES.resultsMs);
  t.room.command(b, { type: 'sit', tableId: 'blackjack' });
  t.stack('TS', '9H', '6C', 'TD', '7S', '9D');
  t.play(a, 'bet', { amount: 500 });
  assert.equal(t.st().phase, 'betting');
  t.room.command(a, { type: 'stand-up' });
  t.play(b, 'bet', { amount: 500 });
  assert.equal(t.st().round.hands.length, 2, 'the departed player\'s committed bet is still dealt');
  clean(t.room);
});

test('pausing freezes the table clock and blocks moves', () => {
  const t = setup(1);
  const [a] = t.ids;
  t.stack('TS', '9H', '6C', '8D');
  t.play(a, 'bet', { amount: 100 });
  t.c.advance(5_000);
  t.room.command(a, { type: 'pause' });
  assert.match(t.play(a, 'hit').error, /paused/);
  t.c.advance(10 * 60_000);
  assert.equal(t.st().phase, 'playing', 'no auto-stand while paused');
  t.room.command(a, { type: 'resume' });
  t.c.advance(RULES.turnMs - 5_000 - 1);
  assert.equal(t.st().phase, 'playing');
  t.c.advance(1);
  assert.equal(t.st().phase, 'results');
});

test('ending the session plays out dealt hands and refunds undealt bets', () => {
  const t = setup(2, { settings: { ...DEFAULT_SETTINGS } });
  const [a, b] = t.ids;
  t.room.command(a, { type: 'sit', tableId: 'blackjack-vip' });   // a moves to the VIP table
  const vip = (id, action, extra) => t.room.command(id, { type: 'play', tableId: 'blackjack-vip', action, ...extra });
  t.room.tableState['blackjack-vip'].shoe = [...Array(120).fill('2C'), ...['TS', '7H', '9C', 'TD'].reverse()];
  assert.ok(vip(a, 'bet', { amount: 2_500 }).ok);   // dealt: a has T,9 = 19 vs dealer 7/T
  assert.equal(t.room.tableState['blackjack-vip'].phase, 'playing');
  assert.ok(t.play(b, 'bet', { amount: 700 }).ok);    // b, alone at the main table, is dealt at once too
  t.room.command(a, { type: 'end' });
  assert.equal(t.room.session.phase, 'ended');
  assert.equal(t.room.economy.openRounds().length, 0);
  assert.equal(t.cash(a), 12_500, 'a\'s 19 beat the dealer\'s 17 when the hand was played out');
  clean(t.room);
});

test('undealt bets are refunded when the session ends', () => {
  const t = setup(2);
  const [a] = t.ids;
  t.play(a, 'bet', { amount: 900 });
  assert.equal(t.st().phase, 'betting');
  t.room.command(a, { type: 'end' });
  assert.equal(t.cash(a), 10_000);
  assert.ok(t.room.economy.ledger.some((e) => e.type === 'refund' && e.playerId === a));
});

test('high-roller seats need the buy-in; one seat per player; five seats per table', () => {
  const t = setup(1);
  const [a] = t.ids;
  t.stack('TS', 'TH', '6C', '7D');
  t.play(a, 'bet', { amount: 5_000 });
  t.play(a, 'stand');                                  // 16 vs 17: loses 5,000
  t.c.advance(RULES.resultsMs);
  t.room.economy.openRound({ roundId: 'x', game: 'blackjack' });
  t.room.economy.reserve({ betId: 'x1', playerId: a, roundId: 'x', amount: 3_000 });
  t.room.economy.settleRound('x', {}, { mode: 'house', maxMultiplier: 2 });   // down to 2,000
  assert.match(t.room.command(a, { type: 'sit', tableId: 'blackjack-vip' }).error, /\$2,500/);
  assert.equal(t.room.get(a).tableId, 'blackjack', 'a failed move keeps the old seat');
  for (let i = 0; i < 5; i++) { const id = t.room.addPlayer({ name: 'Q' + i }).player.id; t.room.command(id, { type: 'sit', tableId: 'blackjack' }); }
  assert.equal(t.st().seats.filter(Boolean).length, 5);
  const extra = t.room.addPlayer({ name: 'Q9' }).player.id;
  assert.match(t.room.command(extra, { type: 'sit', tableId: 'blackjack' }).error, /full/);
});

test('views hide the hole card and the shoe', () => {
  const t = setup(2);
  const [a, b] = t.ids;
  t.stack('TS', '9H', '6C', 'QD', '7S', '8H');        // a: T,Q  b: 9,7  dealer 6 up, 8 hole
  t.play(a, 'bet', { amount: 100 });
  t.play(b, 'bet', { amount: 100 });
  for (const id of [a, b]) {
    const v = t.view(id);
    assert.deepEqual(v.round.dealer, ['6C', null]);
    assert.equal(v.round.dealerTotal, 6);
    assert.ok(!JSON.stringify(v.round).includes('8H'), 'the hole card is nowhere in the view');
    assert.ok(!('shoe' in v && Array.isArray(v.shoe)), 'the shoe is never sent');
    assert.equal(typeof v.shoe.remaining, 'number');
  }
  assert.deepEqual(t.view(a).you.moves.length > 0, true);
  assert.deepEqual(t.view(b).you.moves, [], 'only the player on turn gets moves');
});

test('a table survives a save and restore mid-hand and finishes the round', () => {
  const t = setup(1);
  const [a] = t.ids;
  t.stack('TS', '9H', '8C', '8D');
  t.play(a, 'bet', { amount: 600 });
  t.c.advance(4_000);
  const snap = JSON.parse(JSON.stringify(t.room.toJSON()));
  assert.equal(snap.tables.blackjack.timer.endsAt, null);
  assert.equal(snap.tables.blackjack.timer.remainingMs, RULES.turnMs - 4_000);
  const c2 = clock();
  const back = CasinoRoom.fromJSON(snap, { now: c2.now, timers: c2.timers, rng: seeded(1) });
  assert.deepEqual(back.economy.audit(), []);
  assert.equal(back.economy.account(a).reserved, 600);
  c2.advance(RULES.turnMs - 4_000);                    // the restored turn clock stands the 18
  const st = back.tableState.blackjack;
  assert.equal(st.phase, 'results');
  assert.equal(st.last.hands[0].result, 'win');        // 18 vs 17
  assert.equal(back.economy.account(a).cash, 10_600);
});

test('300 random rounds with three players never create or lose a chip', () => {
  const t = setup(3, { seed: 99 });
  const rnd = seeded(12345);
  const moves = ['hit', 'stand', 'double', 'split'];
  for (let round = 0; round < 300; round++) {
    for (const id of t.ids) if (t.cash(id) >= 100) t.play(id, 'bet', { amount: 100 + rnd(3) * 50 });
    if (t.st().phase === 'betting') t.c.advance(RULES.bettingMs);
    let guard = 0;
    while (t.st().phase === 'playing' && guard++ < 200) {
      const r = t.st().round;
      const owner = r.hands[r.turn].owner;
      const allowed = t.view(owner).you.moves;
      const want = moves[rnd(moves.length)];
      if (allowed.includes(want)) { const res = t.play(owner, want); assert.ok(res.ok, `${want} should succeed: ${JSON.stringify(res)} ${JSON.stringify(t.view(owner).round.hands)}`); }
      else if (rnd(10) === 0) t.c.advance(RULES.turnMs);     // sometimes let the clock stand it
      else t.play(owner, 'stand');
    }
    assert.notEqual(t.st().phase, 'playing');
    const e = t.room.economy;
    const players = t.ids.reduce((s, id) => s + e.account(id).cash + e.account(id).reserved, 0);
    assert.equal(players + e.house, 30_000, `round ${round}: chips are conserved`);
    clean(t.room);
    t.c.advance(RULES.resultsMs);
  }
  const settled = [...t.room.economy.rounds.values()].filter((r) => r.state === 'settled').length;
  assert.equal(t.room.session.rounds, settled);
  assert.ok(settled >= 150, `played ${settled} rounds`);
});

test('balance: basic strategy over 40,000 hands returns about 99.5% (dealer stands on 17, blackjack pays 3:2)', () => {
  const t = setup(1, { seed: 2024 });
  const [a] = t.ids;
  const e = t.room.economy;
  e.post(a, 'stake', { cash: 50_000_000 }, { memo: 'simulation bankroll' });   // a deep bankroll, through the ledger
  const bet = 100;
  let staked = 0, returned = 0;
  const up = () => { const c = t.st().round.dealer[0]; return c[0] === 'A' ? 11 : 'TJQK'.includes(c[0]) ? 10 : Number(c[0]); };
  for (let i = 0; i < 40_000; i++) {
    const before = e.account(a).cash;
    t.play(a, 'bet', { amount: bet });
    let guard = 0;
    while (t.st().phase === 'playing' && guard++ < 20) {
      const r = t.st().round, h = r.hands[r.turn], v = handValue(h.cards), d = up();
      const pair = h.cards.length === 2 && h.cards[0][0] === h.cards[1][0];
      const moves = t.view(a).you.moves;
      let m;
      if (pair && moves.includes('split') && (h.cards[0][0] === 'A' || h.cards[0][0] === '8')) m = 'split';
      else if (moves.includes('double') && !v.soft && (v.total === 11 || (v.total === 10 && d < 10))) m = 'double';
      else if (v.soft) m = v.total >= 19 || (v.total === 18 && d < 9) ? 'stand' : 'hit';
      else m = v.total >= 17 || (v.total >= 13 && d < 7) || (v.total === 12 && d >= 4 && d <= 6) ? 'stand' : 'hit';
      t.play(a, m);
    }
    const last = t.st().last.players[a];
    staked += last.staked; returned += last.payout;
    assert.equal(e.account(a).cash, before + last.net);
    t.c.advance(RULES.resultsMs);
  }
  const rtp = returned / staked;
  // Perfect basic strategy returns ~99.5% here; this simplified one (no soft doubles, few splits) gives up about half a point more.
  assert.ok(rtp > 0.975 && rtp < 1.01, `return to player ${(rtp * 100).toFixed(2)}%`);
  if (process.env.RTP_REPORT) console.log('BLACKJACK RTP', (rtp * 100).toFixed(2) + '%', 'over', staked / bet, 'units staked');
  assert.deepEqual(e.audit(), []);
});
