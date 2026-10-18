// Neon Casino social layer (games/casino/server/social.mjs): achievements, challenges, watchers, hot tables,
// profiles and session history, through a real room.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { CasinoRoom, DEFAULT_SETTINGS } from '../games/casino/server/room.mjs';
import { ACHIEVEMENTS } from '../games/casino/server/social.mjs';
import { BAILOUT_MS } from '../games/casino/server/bank.mjs';

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
const deep = (o) => JSON.parse(JSON.stringify(o));

function setup(n = 2, patch = {}, seed = 1) {
  const c = clock();
  const fx = [];
  let syncs = 0;
  const settings = deep(DEFAULT_SETTINGS);
  for (const [k, v] of Object.entries(patch)) settings[k] = typeof v === 'object' ? { ...settings[k], ...v } : v;
  const room = new CasinoRoom({ code: 'SOC01', now: c.now, timers: c.timers, rng: seeded(seed), settings, hooks: { fx: (to, d) => fx.push({ to, ...d }), sync: () => { syncs++; } } });
  const ids = [];
  for (let i = 0; i < n; i++) { const { player } = room.addPlayer({ name: ['Asha', 'Ben', 'Chen'][i] }); room.setConnected(player.id, true); ids.push(player.id); }
  for (const id of ids.slice(1)) room.command(id, { type: 'ready', ready: true });
  room.command(ids[0], { type: 'start' });
  const e = room.economy;
  let k = 0;
  /** One settled round at a table: the player stakes `stake` and gets `payout` back. */
  const round = (pid, stake, payout, { tableId = 'blackjack', game, tag } = {}) => {
    const id = 'r' + ++k;
    e.openRound({ roundId: id, game: game || room.table(tableId)?.game || tableId, tableId });
    assert.ok(e.reserve({ betId: id, playerId: pid, roundId: id, amount: stake }).ok);
    if (tag) e.tagRound(id, pid, tag);
    e.settleRound(id, { [pid]: payout }, { mode: 'house', maxMultiplier: 36 });
  };
  const has = (pid, id) => (room.achievements[pid] || []).some((a) => a.id === id);
  return { room, ids, c, fx, e, round, has, cmd: (pid, x) => room.command(pid, x), syncs: () => syncs };
}

test('round achievements: first win, jackpot, whale, high roller, on fire — each once', () => {
  const t = setup(1);
  const [a] = t.ids;
  t.round(a, 100, 0);
  assert.ok(!t.has(a, 'first-win'));
  t.round(a, 100, 200);
  assert.ok(t.has(a, 'first-win'));
  t.round(a, 5_000, 10_000);
  assert.ok(t.has(a, 'jackpot'), 'won 5,000 = half the starting cash');
  assert.ok(t.has(a, 'whale'), 'staked the table maximum');
  t.round(a, 2_500, 5_000, { tableId: 'blackjack-vip' });
  assert.ok(t.has(a, 'high-roller'));
  for (let i = 0; i < 2; i++) t.round(a, 100, 200);
  assert.ok(t.has(a, 'on-fire'), 'five wins in a row');
  t.round(a, 100, 200);
  assert.equal(t.room.achievements[a].filter((x) => x.id === 'on-fire').length, 1, 'awarded once');
  assert.ok(t.room.feed.some((f) => f.kind === 'achievement' && /On fire/.test(f.text)));
  assert.ok(t.fx.some((f) => f.kind === 'achievement' && f.id === 'jackpot'));
});

test('game moments unlock achievements: a real blackjack natural, and tagged rounds', () => {
  const t = setup(1);
  const [a] = t.ids;
  t.cmd(a, { type: 'sit', tableId: 'blackjack' });
  t.room.tableState.blackjack.shoe = [...Array(120).fill('2C'), ...['AS', '9H', 'KC', '7D'].reverse()];
  t.cmd(a, { type: 'play', tableId: 'blackjack', action: 'bet', amount: 100 });
  assert.ok(t.has(a, 'natural'));
  t.round(a, 100, 3_600, { tableId: 'roulette', tag: 'straight-up' });
  assert.ok(t.has(a, 'straight-up'));
  t.round(a, 100, 0, { tableId: 'poker', tag: 'nonsense' });
  assert.ok(!t.has(a, 'nonsense'), 'unknown tags are ignored');
});

test('grand tour and comeback', () => {
  const t = setup(1);
  const [a] = t.ids;
  for (const tableId of ['blackjack', 'roulette', 'poker']) t.round(a, 100, 100, { tableId });
  assert.ok(!t.has(a, 'grand-tour'));
  t.round(a, 100, 100, { tableId: 'teenpatti' });
  assert.ok(t.has(a, 'grand-tour'));
  t.round(a, 5_100, 0);                                       // down to 4,900
  t.round(a, 4_000, 12_000, { tableId: 'roulette' });          // back to 12,900
  assert.ok(t.has(a, 'comeback'));
});

test('bank events: lifeline, clean slate, loan shark', () => {
  const t = setup(2, { loans: { casino: false } });
  const [a, b] = t.ids;
  t.round(a, 9_950, 0);                                         // a is out of chips, no credit
  assert.ok(t.room.get(a).insolvent);
  const o = t.cmd(b, { type: 'loan-offer', to: a, role: 'lend', amount: 1_000, ratePct: 20, termMin: 30 });
  t.cmd(a, { type: 'loan-accept', offerId: o.offerId, version: 1 });
  assert.ok(t.has(a, 'bailout'));
  t.round(a, 1_000, 2_000);
  const loanId = t.room.viewFor(a).me.bank.loans[0].id;
  t.cmd(a, { type: 'loan-repay', loanId, amount: 1_200 });
  assert.ok(t.has(b, 'loan-shark'));
  t.cmd(a, { type: 'settings', settings: { loans: { casino: true } } });
  t.cmd(b, { type: 'borrow', amount: 1_000 });
  t.cmd(b, { type: 'repay', amount: 1_000 });
  assert.ok(t.has(b, 'clean-slate'));
});

test('session end crowns the champion and the survivors; a restart clears achievements', () => {
  const t = setup(2);
  const [a, b] = t.ids;
  t.round(b, 8_000, 0);                                         // b drops to 2,000 (below a quarter)
  t.round(b, 1_000, 2_000);
  t.round(a, 1_000, 2_000);
  t.cmd(a, { type: 'end' });
  assert.ok(t.has(a, 'champion'));
  assert.ok(t.has(b, 'survivor'));
  assert.ok(!t.has(a, 'survivor'));
  t.cmd(a, { type: 'restart', confirm: true });
  assert.deepEqual(t.room.achievements, {});
});

test('a challenge: both stakes reserved on accept, settled once, chips only move between the two', () => {
  for (const game of ['highcard', 'dice', 'coin']) {
    const t = setup(2, {}, 7);
    const [a, b] = t.ids;
    const ch = t.cmd(a, { type: 'challenge', to: b, game, amount: 1_000 });
    assert.ok(ch.ok, ch.error);
    assert.equal(t.e.account(a).cash, 10_000, 'nothing is reserved until accepted');
    assert.ok(t.fx.some((f) => f.kind === 'challenge' && f.to?.[0] === b));
    assert.match(t.cmd(a, { type: 'challenge-accept', challengeId: ch.challengeId }).error, /gone/, 'only the challenged player accepts');
    const res = t.cmd(b, { type: 'challenge-accept', challengeId: ch.challengeId });
    assert.ok(res.ok);
    const w = res.result.winner, l = w === a ? b : a;
    assert.equal(t.e.account(w).cash, 11_000);
    assert.equal(t.e.account(l).cash, 9_000);
    assert.equal(t.e.house, 0, 'the house takes nothing');
    assert.ok(t.has(w, 'duelist'));
    assert.ok(t.fx.some((f) => f.kind === 'duel' && f.winner === w));
    assert.ok(t.room.feed.some((f) => f.kind === 'duel'));
    if (game === 'highcard') assert.equal(typeof res.result.draws[a], 'string');
    if (game === 'dice') assert.equal(res.result.draws[a].length, 2);
    if (game === 'coin') assert.ok(['heads', 'tails'].includes(res.result.draws.coin));
    assert.ok(t.cmd(b, { type: 'challenge-accept', challengeId: ch.challengeId }).error, 'a challenge resolves once');
    assert.deepEqual(t.e.audit(), []);
  }
});

test('challenges are validated, expire, and can be declined', () => {
  const t = setup(3);
  const [a, b, c] = t.ids;
  assert.match(t.cmd(a, { type: 'challenge', to: a, game: 'coin', amount: 500 }).error, /another player/);
  assert.match(t.cmd(a, { type: 'challenge', to: b, game: 'chess', amount: 500 }).error, /high card/);
  assert.match(t.cmd(a, { type: 'challenge', to: b, game: 'coin', amount: 50 }).error, /Stakes run/);
  assert.match(t.cmd(a, { type: 'challenge', to: b, game: 'coin', amount: 5_001 }).error, /Stakes run/);
  t.round(b, 9_800, 0);                                          // b has 200 left
  assert.match(t.cmd(a, { type: 'challenge', to: b, game: 'coin', amount: 500 }).error, /doesn't have/);
  const x = t.cmd(a, { type: 'challenge', to: c, game: 'dice', amount: 500 });
  assert.match(t.cmd(c, { type: 'challenge', to: a, game: 'coin', amount: 500 }).error, /already have/);
  t.c.advance(60_000);
  assert.ok(t.cmd(c, { type: 'challenge-accept', challengeId: x.challengeId }).error, 'expired');
  const y = t.cmd(a, { type: 'challenge', to: c, game: 'dice', amount: 500 });
  assert.ok(t.cmd(c, { type: 'challenge-decline', challengeId: y.challengeId }).ok);
  assert.equal(t.room.challenges.size, 0);
  t.cmd(a, { type: 'pause' });
  assert.match(t.cmd(a, { type: 'challenge', to: c, game: 'coin', amount: 500 }).error, /paused/);
});

test('a challenge can\'t be accepted with money that\'s gone, and bankrupt players can\'t duel', () => {
  const t = setup(2, { loans: { casino: false } });
  const [a, b] = t.ids;
  const x = t.cmd(a, { type: 'challenge', to: b, game: 'coin', amount: 1_000 });
  t.round(a, 9_950, 0);                                           // a loses it elsewhere first ($50 left, under the minimum)
  assert.match(t.cmd(b, { type: 'challenge-accept', challengeId: x.challengeId }).error, /only have|can't challenge/);
  t.c.advance(BAILOUT_MS);
  assert.equal(t.room.get(a).status, 'bankrupt');
  assert.ok(t.cmd(b, { type: 'challenge', to: a, game: 'coin', amount: 100 }).error);
});

test('watchers and hot tables', () => {
  const t = setup(3);
  const [a, b, c] = t.ids;
  t.cmd(a, { type: 'sit', tableId: 'poker' });
  t.cmd(b, { type: 'sit', tableId: 'poker' });
  t.cmd(c, { type: 'watch', tableId: 'poker' });
  t.c.advance(3_000);                                             // a hand starts
  let pk = t.room.viewFor(c).tables.find((x) => x.id === 'poker');
  assert.deepEqual(pk.watchers, [c]);
  assert.equal(pk.hot, null);
  const h = t.room.tableState.poker.hand;
  t.cmd(h.players[h.turn].pid, { type: 'play', tableId: 'poker', action: 'allin' });
  pk = t.room.viewFor(c).tables.find((x) => x.id === 'poker');
  assert.equal(pk.hot.label, 'All in!');
  t.cmd(c, { type: 'watch', tableId: null });
  assert.deepEqual(t.room.viewFor(c).tables.find((x) => x.id === 'poker').watchers, []);
  assert.ok(t.cmd(c, { type: 'emote', emote: 'fire', tableId: 'poker' }).ok);
  assert.equal(t.fx.at(-1).table, 'poker');
});

test('profiles: stats, streaks, achievements and a net-worth trail; reads don\'t trigger a sync', () => {
  const t = setup(2);
  const [a, b] = t.ids;
  t.round(a, 1_000, 2_000);
  t.round(a, 500, 0);
  t.round(a, 500, 0);
  const before = t.syncs();
  const p = t.cmd(b, { type: 'stats', playerId: a }).profile;
  assert.equal(t.syncs(), before);
  assert.deepEqual([p.stats.wins, p.stats.losses, p.stats.streak, p.stats.bestStreak], [1, 2, -2, 1]);
  assert.equal(p.stats.profit, 0);
  assert.ok(p.achievements.some((x) => x.id === 'first-win'));
  assert.deepEqual(p.trail.map((x) => x[1]), [10_000, 10_000, 11_000, 11_000, 10_500, 10_500, 10_000]);
  assert.ok(t.cmd(b, { type: 'stats', playerId: 'nope' }).error);
  const h = t.cmd(b, { type: 'session-history' }).history;
  assert.ok(h.events.some((e) => e.kind === 'session'));
  assert.ok(h.events.some((e) => e.kind === 'achievement'));
  assert.deepEqual(Object.keys(h.trails).sort(), [a, b].sort());
});

test('achievements and duel results survive a save and restore; open challenges don\'t', () => {
  const t = setup(2);
  const [a, b] = t.ids;
  t.round(a, 100, 200);
  const x = t.cmd(a, { type: 'challenge', to: b, game: 'coin', amount: 200 });
  t.cmd(b, { type: 'challenge-accept', challengeId: x.challengeId });
  t.cmd(a, { type: 'challenge', to: b, game: 'dice', amount: 200 });
  const c2 = clock();
  const r2 = CasinoRoom.fromJSON(deep(t.room.toJSON()), { now: c2.now, timers: c2.timers });
  assert.ok(r2.achievements[a].some((z) => z.id === 'first-win'));
  assert.equal(r2.duels.length, 1);
  assert.equal(r2.challenges.size, 0);
  assert.deepEqual(r2.economy.audit(), []);
});

test('every achievement has a name, a description and an icon', () => {
  for (const [id, a] of Object.entries(ACHIEVEMENTS)) assert.ok(a.name && a.desc && a.icon, id);
});
