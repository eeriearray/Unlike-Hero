// Neon Casino loans, interest, deadlines and bankruptcy (games/casino/server/bank.mjs through a real room).  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { CasinoRoom, DEFAULT_SETTINGS } from '../games/casino/server/room.mjs';
import { BAILOUT_MS, p2pTotal } from '../games/casino/server/bank.mjs';
import { netWorth } from '../games/casino/server/economy.mjs';

const MIN = 60_000;
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
const deep = (o) => JSON.parse(JSON.stringify(o));
function settings(patch = {}) {
  const s = deep(DEFAULT_SETTINGS);
  for (const [k, v] of Object.entries(patch)) s[k] = typeof v === 'object' && !Array.isArray(v) ? { ...s[k], ...v } : v;
  return s;
}
function setup(n = 2, patch) {
  const c = clock();
  const fx = [];
  const room = new CasinoRoom({ code: 'BANK1', now: c.now, timers: c.timers, settings: settings(patch), hooks: { fx: (r, d) => fx.push(d) } });
  const ids = [];
  for (let i = 0; i < n; i++) { const { player } = room.addPlayer({ name: ['Asha', 'Ben', 'Chen'][i] }); room.setConnected(player.id, true); ids.push(player.id); }
  for (const id of ids.slice(1)) room.command(id, { type: 'ready', ready: true });
  assert.ok(room.command(ids[0], { type: 'start' }).ok);
  const e = room.economy;
  let r = 0;
  /** The player loses `amount` to the house in one round. */
  const lose = (pid, amount) => { const id = 'lose' + ++r; e.openRound({ roundId: id, game: 'blackjack' }); assert.ok(e.reserve({ betId: id, playerId: pid, roundId: id, amount }).ok); e.settleRound(id, {}, { mode: 'house', maxMultiplier: 2 }); };
  const win = (pid, amount) => { const id = 'win' + ++r; e.openRound({ roundId: id, game: 'blackjack' }); assert.ok(e.reserve({ betId: id, playerId: pid, roundId: id, amount }).ok); e.settleRound(id, { [pid]: amount * 2 }, { mode: 'house', maxMultiplier: 2 }); };
  const cmd = (pid, c) => room.command(pid, c);
  const acct = (pid) => e.account(pid);
  const conserved = () => {
    const chips = [...e.accounts.values()].reduce((s, a) => s + a.cash + a.reserved, 0);
    const stakes = [...e.accounts.values()].reduce((s, a) => s + a.startingCash, 0);
    assert.equal(chips + e.house, stakes, 'chips are only created or destroyed by the house, and the house keeps count');
    assert.deepEqual(e.audit(), []);
  };
  return { room, ids, c, fx, e, lose, win, cmd, acct, conserved };
}

test('a casino loan adds cash and debt together, within the credit limit and the debt cap', () => {
  const t = setup(1, { loans: { creditLimit: 8_000, maxDebt: 12_000 } });
  const [a] = t.ids;
  assert.ok(t.cmd(a, { type: 'borrow', amount: 5_000 }).ok);
  assert.equal(t.acct(a).cash, 15_000);
  assert.equal(t.acct(a).debt, 5_000);
  assert.equal(netWorth(t.acct(a)), 10_000, 'borrowing alone doesn\'t change net worth');
  assert.match(t.cmd(a, { type: 'borrow', amount: 3_001 }).error, /up to \$3,000/);
  assert.ok(t.cmd(a, { type: 'borrow', amount: 3_000 }).ok);
  assert.match(t.cmd(a, { type: 'borrow', amount: 1 }).error, /credit limit/);
  for (const bad of [0, -5, 2.5, '100', null]) assert.ok(t.cmd(a, { type: 'borrow', amount: bad }).error);
  assert.equal(t.room.viewFor(a).me.bank.creditAvailable, 0);
  assert.equal(t.room.viewFor(a).players[0].debt, 8_000, 'everyone can see the debt');
  t.conserved();
});

test('the loan desk is closed outside a session and when the host turns loans off', () => {
  const c = clock();
  const room = new CasinoRoom({ code: 'X', now: c.now, timers: c.timers });
  const a = room.addPlayer({ name: 'A' }).player.id;
  assert.match(room.command(a, { type: 'borrow', amount: 100 }).error, /opens when the session starts/);
  const t = setup(1, { loans: { casino: false } });
  assert.match(t.cmd(t.ids[0], { type: 'borrow', amount: 100 }).error, /turned off/);
});

test('interest is charged on live play time only, rounded up, and lowers net worth', () => {
  const t = setup(1, { loans: { interestPct: 10, interestEveryMin: 10, termMin: 600 } });
  const [a] = t.ids;
  t.cmd(a, { type: 'borrow', amount: 3_333 });
  t.c.advance(9 * MIN);
  assert.equal(t.acct(a).interest, 0);
  t.cmd(a, { type: 'pause' });
  t.c.advance(60 * MIN);                              // paused time doesn't count
  assert.equal(t.acct(a).interest, 0);
  t.cmd(a, { type: 'resume' });
  t.c.advance(1 * MIN + 5_000);
  assert.equal(t.acct(a).interest, 334, '10% of 3,333 rounded up');
  assert.equal(netWorth(t.acct(a)), 10_000 - 334);
  t.c.advance(10 * MIN);
  assert.equal(t.acct(a).interest, 668, 'simple interest on the principal, each period');
  assert.ok(t.room.feed.some((f) => f.kind === 'interest'));
  t.conserved();
});

test('repayment clears interest first, then the oldest loan; it can\'t overpay or spend chips you don\'t have', () => {
  const t = setup(1, { loans: { interestPct: 10, interestEveryMin: 10, termMin: 600 } });
  const [a] = t.ids;
  t.cmd(a, { type: 'borrow', amount: 2_000 });
  t.c.advance(1_000);
  t.cmd(a, { type: 'borrow', amount: 1_000 });
  t.c.advance(10 * MIN + 5_000);                       // 300 interest
  assert.equal(t.acct(a).interest, 300);
  assert.ok(t.cmd(a, { type: 'repay', amount: 500 }).ok);
  assert.equal(t.acct(a).interest, 0);
  assert.equal(t.acct(a).debt, 2_800);
  const loans = t.room.viewFor(a).me.bank.loans;
  assert.deepEqual(loans.map((l) => l.due).sort(), [1_000, 1_800], 'the older loan was paid down first');
  assert.match(t.cmd(a, { type: 'repay', amount: 2_801 }).error, /only owe/);
  t.lose(a, 11_000);                                   // cash 12,500 → 1,500
  assert.match(t.cmd(a, { type: 'repay', amount: 2_000 }).error, /Not enough cash/);
  assert.ok(t.cmd(a, { type: 'repay', amount: 1_500 }).ok);
  t.conserved();
});

test('at the deadline the casino collects what it can, and keeps collecting from later winnings', () => {
  const t = setup(1, { loans: { interestPct: 0, termMin: 30, creditLimit: 10_000, maxDebt: 20_000 } });
  const [a] = t.ids;
  t.cmd(a, { type: 'borrow', amount: 6_000 });
  t.lose(a, 14_000);                                   // cash 2,000, debt 6,000
  t.c.advance(30 * MIN + 5_000);
  assert.equal(t.acct(a).cash, 0, 'the casino took the 2,000 on hand');
  assert.equal(t.acct(a).debt, 4_000, 'the rest is still owed');
  assert.ok(t.room.viewFor(a).me.bank.loans[0].overdue);
  t.cmd(a, { type: 'borrow', amount: 1_000 });          // new cash arrives (a fresh loan here; winnings work the same)
  t.c.advance(5_000);
  assert.equal(t.acct(a).cash, 0, 'the overdue loan sweeps it on the next check');
  assert.equal(t.acct(a).debt, 4_000);
  assert.deepEqual(t.room.viewFor(a).me.bank.loans.map((l) => l.due).sort(), [1_000, 3_000], 'the overdue loan was paid down, not the new one');
  t.conserved();
});

test('player loans need both sides: offer, counter, then accept the exact terms', () => {
  const t = setup(2, { loans: { p2pMaxPct: 30 } });
  const [a, b] = t.ids;
  const o = t.cmd(a, { type: 'loan-offer', to: b, role: 'lend', amount: 4_000, ratePct: 25, termMin: 30 });
  assert.ok(o.ok);
  const offer = () => t.room.viewFor(b).me.bank.offers[0];
  assert.equal(offer().total, 5_000);
  assert.equal(t.room.viewFor(b).me.bank.offers.length, 1);
  assert.equal(t.room.viewFor(t.ids[0]).me.bank.offers.length, 1);
  assert.match(t.cmd(a, { type: 'loan-accept', offerId: o.offerId, version: 1 }).error, /other player/, 'the proposer can\'t accept their own offer');
  assert.ok(t.cmd(b, { type: 'loan-counter', offerId: o.offerId, amount: 4_000, ratePct: 10, termMin: 45 }).ok);
  assert.equal(offer().version, 2);
  assert.match(t.cmd(b, { type: 'loan-accept', offerId: o.offerId, version: 2 }).error, /other player/);
  assert.match(t.cmd(a, { type: 'loan-accept', offerId: o.offerId, version: 1 }).error, /terms just changed/);
  assert.equal(t.acct(b).cash, 10_000, 'nothing moved until both agreed');
  assert.ok(t.cmd(a, { type: 'loan-accept', offerId: o.offerId, version: 2 }).ok);
  assert.equal(t.acct(a).cash, 6_000);
  assert.equal(t.acct(a).owed, 4_400);
  assert.equal(t.acct(b).cash, 14_000);
  assert.equal(t.acct(b).owes, 4_400);
  assert.equal(netWorth(t.acct(a)) + netWorth(t.acct(b)), 20_000, 'interest moves worth between players, never creates it');
  assert.equal(t.room.viewFor(a).bank.debts.length, 1, 'the debt board is public');
  assert.equal(t.room.viewFor(a).me.bank.offers.length, 0);
  t.conserved();
});

test('player loans can\'t be used to mint money, launder credit or loop', () => {
  const t = setup(3, { loans: { p2pMaxPct: 20, maxDebt: 12_000, creditLimit: 10_000 } });
  const [a, b, c] = t.ids;
  assert.match(t.cmd(a, { type: 'loan-offer', to: a, role: 'lend', amount: 100, ratePct: 0, termMin: 30 }).error, /another player/);
  assert.match(t.cmd(a, { type: 'loan-offer', to: b, role: 'lend', amount: 100, ratePct: 21, termMin: 30 }).error, /0 to 20%/);
  assert.match(t.cmd(a, { type: 'loan-offer', to: b, role: 'lend', amount: 10_001, ratePct: 0, termMin: 30 }).error, /only has/);
  assert.match(t.cmd(a, { type: 'loan-offer', to: b, role: 'lend', amount: 100.5, ratePct: 0, termMin: 30 }).error, /whole number/);
  // Borrow from the casino, then try to pass it on: refused.
  t.cmd(c, { type: 'borrow', amount: 5_000 });
  assert.match(t.cmd(c, { type: 'loan-offer', to: b, role: 'lend', amount: 1_000, ratePct: 0, termMin: 30 }).error, /owes the casino/);
  // a lends to b; b can't lend straight back to a while owing a.
  const o = t.cmd(a, { type: 'loan-offer', to: b, role: 'lend', amount: 2_000, ratePct: 0, termMin: 30 });
  t.cmd(b, { type: 'loan-accept', offerId: o.offerId, version: 1 });
  assert.match(t.cmd(b, { type: 'loan-offer', to: a, role: 'lend', amount: 1_000, ratePct: 0, termMin: 30 }).error, /still owes/);
  // One open offer per pair.
  assert.ok(t.cmd(a, { type: 'loan-offer', to: c, role: 'borrow', amount: 1_000, ratePct: 0, termMin: 30 }).error, 'c owes the casino, so c can\'t lend');
  assert.ok(t.cmd(b, { type: 'loan-offer', to: c, role: 'lend', amount: 1_000, ratePct: 0, termMin: 30 }).ok);
  assert.match(t.cmd(c, { type: 'loan-offer', to: b, role: 'borrow', amount: 500, ratePct: 0, termMin: 30 }).error, /already have an open offer/);
  // The debt cap counts player debts: c owes 5,000 to the casino; 7,000 more would pass 12,000.
  t.cmd(c, { type: 'loan-decline', offerId: t.room.viewFor(c).me.bank.offers[0].id });
  assert.match(t.cmd(b, { type: 'loan-offer', to: c, role: 'lend', amount: 7_001, ratePct: 0, termMin: 30 }).error, /debt limit/);
  t.room.command(a, { type: 'settings', settings: { loans: { p2p: false } } });
  assert.match(t.cmd(a, { type: 'loan-offer', to: c, role: 'lend', amount: 100, ratePct: 0, termMin: 30 }).error, /turned off/);
  t.conserved();
});

test('repaying a player, and collection when a player loan comes due', () => {
  const t = setup(2);
  const [a, b] = t.ids;
  const o = t.cmd(a, { type: 'loan-offer', to: b, role: 'lend', amount: 3_000, ratePct: 10, termMin: 20 });
  t.cmd(b, { type: 'loan-accept', offerId: o.offerId, version: 1 });
  const loanId = t.room.viewFor(b).me.bank.loans[0].id;
  assert.match(t.cmd(a, { type: 'loan-repay', loanId, amount: 100 }).error, /isn't your loan/);
  assert.ok(t.cmd(b, { type: 'loan-repay', loanId, amount: 1_000 }).ok);
  assert.equal(t.acct(b).owes, 2_300);
  assert.equal(t.acct(a).cash, 8_000);
  t.lose(b, 11_500);                                   // b: 12,000 cash → 500
  t.c.advance(20 * MIN + 5_000);
  assert.equal(t.acct(b).cash, 0);
  assert.equal(t.acct(b).owes, 1_800);
  assert.equal(t.acct(a).cash, 8_500);
  assert.ok(t.room.viewFor(a).bank.debts[0].overdue);
  t.conserved();
});

test('going broke starts a bailout clock; with no rescue the player goes bankrupt but stays in the room', () => {
  const t = setup(2, { loans: { casino: false } });
  const [a, b] = t.ids;
  t.room.command(a, { type: 'sit', tableId: 'blackjack' });
  t.lose(a, 9_950);                                    // $50 left, minimum bet $100, no credit
  const pa = t.room.get(a);
  assert.ok(pa.insolvent, 'insolvent, not yet bankrupt');
  assert.equal(pa.status, 'active');
  assert.ok(t.room.feed.some((f) => f.kind === 'broke'));
  t.c.advance(BAILOUT_MS - 1_000);
  assert.equal(pa.status, 'active');
  t.c.advance(1_000);
  assert.equal(pa.status, 'bankrupt');
  assert.equal(pa.tableId, null, 'stood up from the table');
  assert.ok(t.fx.some((f) => f.kind === 'bankrupt' && f.playerId === a));
  assert.match(t.cmd(a, { type: 'sit', tableId: 'blackjack' }).error, /Bankrupt/);
  assert.match(t.cmd(a, { type: 'borrow', amount: 10 }).error, /turned off|Bankrupt/);
  assert.match(t.cmd(b, { type: 'loan-offer', to: a, role: 'lend', amount: 500, ratePct: 0, termMin: 30 }).error, /can't borrow/);
  t.e.openRound({ roundId: 'x', game: 'roulette' });
  assert.match(t.e.reserve({ betId: 'x', playerId: a, roundId: 'x', amount: 10 }).error, /bankrupt/);
  assert.ok(t.cmd(a, { type: 'chat', text: 'gg' }).ok, 'bankrupt players can still chat');
  assert.ok(t.cmd(a, { type: 'emote', emote: 'cry' }).ok);
  assert.ok(t.room.get(a), 'still in the room');
  assert.equal(t.room.viewFor(b).players.find((p) => p.id === a).status, 'bankrupt');
  assert.equal(t.room.viewFor(b).players.find((p) => p.id === a).cash, 50, 'their final position stays on the books');
  t.conserved();
});

test('a player loan during the bailout clock saves them', () => {
  const t = setup(2, { loans: { casino: false } });
  const [a, b] = t.ids;
  t.lose(a, 9_950);
  assert.ok(t.room.get(a).insolvent);
  t.c.advance(30_000);
  const o = t.cmd(b, { type: 'loan-offer', to: a, role: 'lend', amount: 1_000, ratePct: 20, termMin: 30 });
  assert.ok(o.ok, o.error);
  assert.ok(t.cmd(a, { type: 'loan-accept', offerId: o.offerId, version: 1 }).ok);
  assert.equal(t.room.get(a).insolvent, null);
  t.c.advance(BAILOUT_MS);
  assert.equal(t.room.get(a).status, 'active');
  assert.ok(t.room.feed.some((f) => f.kind === 'rescued'));
});

test('unused casino credit or chips on the table keep a player solvent', () => {
  const t = setup(1);
  const [a] = t.ids;
  t.lose(a, 10_000);                                   // cash 0, but 10,000 of credit
  assert.ok(!t.room.get(a).insolvent);
  t.cmd(a, { type: 'borrow', amount: 10_000 });
  t.e.openRound({ roundId: 'open', game: 'blackjack' });
  t.e.reserve({ betId: 'all', playerId: a, roundId: 'open', amount: 10_000 });
  assert.ok(!t.room.get(a).insolvent, 'a hand still in play can win');
  t.e.settleRound('open', {}, { mode: 'house', maxMultiplier: 2 });
  assert.ok(t.room.get(a).insolvent, 'out of cash and credit once it loses');
});

test('the net-worth floor bankrupts at once', () => {
  const t = setup(1, { bankruptcy: { mode: 'floor', netWorthFloor: 5_000 }, loans: { creditLimit: 20_000, maxDebt: 30_000 } });
  const [a] = t.ids;
  t.cmd(a, { type: 'borrow', amount: 16_000 });
  t.lose(a, 14_999);                                   // net worth −4,999
  assert.equal(t.room.get(a).status, 'active');
  t.lose(a, 1);                                         // −5,000
  assert.equal(t.room.get(a).status, 'bankrupt');
});

test('the final settlement keeps every debt; nothing is forgiven', () => {
  const t = setup(2);
  const [a, b] = t.ids;
  t.cmd(a, { type: 'borrow', amount: 5_000 });
  t.lose(a, 12_000);
  const o = t.cmd(b, { type: 'loan-offer', to: a, role: 'lend', amount: 2_000, ratePct: 50, termMin: 60 });
  t.cmd(a, { type: 'loan-accept', offerId: o.offerId, version: 1 });
  t.cmd(a, { type: 'end' });
  const s = t.room.session.summary;
  const row = (id) => s.rows.find((r) => r.id === id);
  assert.equal(row(a).netWorth, 10_000 - 12_000 - 1_000, 'losses and the 50% interest both count');
  assert.equal(row(a).debt, 5_000);
  assert.equal(row(a).owes, 3_000);
  assert.equal(row(b).netWorth, 11_000);
  assert.deepEqual(s.debts.map((d) => [d.kind, d.due]), [['casino', 5_000], ['p2p', 3_000]]);
  assert.deepEqual(s.winners, [b]);
});

test('a restart clears loans, offers and bankruptcies for an even start', () => {
  const t = setup(2, { loans: { casino: false } });
  const [a, b] = t.ids;
  t.lose(a, 9_950);
  t.c.advance(BAILOUT_MS);
  assert.equal(t.room.get(a).status, 'bankrupt');
  t.cmd(b, { type: 'loan-offer', to: a, role: 'lend', amount: 10, ratePct: 0, termMin: 30 });
  t.cmd(a, { type: 'restart', confirm: true });
  t.cmd(b, { type: 'ready', ready: true });
  assert.ok(t.cmd(a, { type: 'start' }).ok);
  assert.equal(t.room.get(a).status, 'active');
  assert.equal(t.acct(a).cash, 10_000);
  assert.equal(t.acct(a).frozen, undefined);
  assert.equal(t.room.offers.size, 0);
  assert.equal(t.e.loans.size, 0);
});

test('loans, offers, interest clocks and bailout clocks survive a save and restore', () => {
  const t = setup(2, { loans: { interestPct: 10, interestEveryMin: 10 } });
  const [a, b] = t.ids;
  t.cmd(a, { type: 'borrow', amount: 4_000 });
  assert.ok(t.cmd(a, { type: 'loan-offer', to: b, role: 'borrow', amount: 1_000, ratePct: 5, termMin: 30 }).ok);
  t.c.advance(6 * MIN);
  const snap = deep(t.room.toJSON());
  const c2 = clock();
  c2.advance(3 * 60 * MIN);                            // server down for 3 hours: not live play time
  const r2 = CasinoRoom.fromJSON(snap, { now: c2.now, timers: c2.timers });
  assert.deepEqual(r2.economy.audit(), []);
  assert.equal(r2.offers.size, 1);
  assert.equal(r2.economy.account(a).interest, 0, 'downtime charged no interest');
  c2.advance(4 * MIN + 5_000);
  assert.equal(r2.economy.account(a).interest, 400, 'the interest clock picked up where it left off');
});
