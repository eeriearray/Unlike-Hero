// Neon Casino chaos run: several players hammer every feature in random order — all four games, loans, offers,
// challenges, disconnects, pauses, settings changes, save/restore mid-round and restarts — and after every single step
// the economy must audit clean, chips must be conserved, nobody may see anyone else's hidden cards, and nothing may
// throw.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { CasinoRoom, DEFAULT_SETTINGS } from '../games/casino/server/room.mjs';

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

const TABLES = ['blackjack', 'blackjack-vip', 'roulette', 'poker', 'teenpatti'];
const SPOTS = [{ type: 'red' }, { type: 'odd' }, { type: 'dozen', key: 2 }, { type: 'column', key: 1 }, { type: 'straight', numbers: [17] },
  { type: 'split', numbers: [0, 2] }, { type: 'corner', numbers: [1, 2, 4, 5] }, { type: 'sixline', numbers: [7, 8, 9, 10, 11, 12] }, { type: 'trio', numbers: [0, 2, 3] }];
const WEIRD = [0, 1, 50, 20_000, -100, 1.5, '100', null, 1e18];
const GOOD = [100, 100, 200, 300, 500, 1_000];

function invariants(room, step) {
  const e = room.economy;
  const problems = e.audit();
  assert.deepEqual(problems, [], `step ${step}: ledger audit`);
  let chips = 0, stakes = 0;
  for (const a of e.accounts.values()) {
    for (const f of ['cash', 'reserved', 'debt', 'interest', 'owes', 'owed']) assert.ok(a[f] >= 0 && Number.isSafeInteger(a[f]), `step ${step}: ${a.playerId}.${f} = ${a[f]}`);
    chips += a.cash + a.reserved; stakes += a.startingCash;
  }
  assert.equal(chips + e.house, stakes, `step ${step}: chips conserved`);
  for (const p of room.humans()) {
    if (p.status === 'bankrupt') assert.equal(p.tableId, null, `step ${step}: a bankrupt player is still seated`);
    if (p.tableId) assert.ok(room.table(p.tableId).state.seats.includes(p.id), `step ${step}: ${p.name} thinks they sit at ${p.tableId} but has no seat`);
  }
  for (const id of TABLES) {
    const st = room.tableState[id];
    if (!st) continue;
    for (const pid of st.seats) if (pid) assert.equal(room.get(pid)?.tableId, id, `step ${step}: seat at ${id} held by someone sitting elsewhere`);
  }
  // Privacy: build each player's view and check other players' hidden cards stay hidden.
  for (const viewer of room.humans()) {
    const v = room.viewFor(viewer.id);
    JSON.stringify(v);
    for (const t of v.tables) {
      const s = t.state;
      if (!s) continue;
      if (t.game === 'poker' && s.hand && s.phase === 'playing') for (const p of s.hand.players) if (p.pid !== viewer.id) assert.equal(p.hole, null, `step ${step}: poker hole cards leaked`);
      if (t.game === 'teenpatti' && s.hand && s.phase === 'playing') for (const p of s.hand.players) if (p.pid !== viewer.id || !p.seen) assert.equal(p.cards, null, `step ${step}: teen patti cards leaked`);
      if (t.game === 'blackjack' && s.round && s.phase === 'playing') assert.equal(s.round.dealer[1], null, `step ${step}: dealer hole card leaked`);
      if (t.game === 'roulette' && s.round && s.phase === 'betting') assert.equal(s.round.result, null, `step ${step}: roulette result leaked before the spin`);
    }
  }
}

function chaos(seed, steps) {
  const rnd = seeded(seed);
  const pick = (arr) => arr[rnd(arr.length)];
  const money = () => (rnd(10) ? pick(GOOD) : pick(WEIRD));      // mostly valid amounts, sometimes garbage
  let pausedAt = null;
  const c = clock();
  const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  // Small wallets and short loan clocks so bankruptcies, interest and deadlines happen often.
  Object.assign(settings, { startingCash: 3_000, minBet: 100, maxBet: 1_000, highRollerMin: 500 });
  Object.assign(settings.loans, { interestEveryMin: 2, termMin: 5, creditLimit: 2_000, maxDebt: 4_000 });
  let room = new CasinoRoom({ code: 'CHAOS', now: c.now, timers: c.timers, rng: seeded(seed * 7 + 1), settings });
  const ids = [];
  for (let i = 0; i < 5; i++) { const { player } = room.addPlayer({ name: 'P' + i, deviceKey: `chaos-device-${seed}-${i}-xxxxxxxx` }); room.setConnected(player.id, true); ids.push(player.id); }
  for (const id of ids.slice(1)) room.command(id, { type: 'ready', ready: true });
  assert.ok(room.command(ids[0], { type: 'start' }).ok);
  const counts = {};
  for (let step = 0; step < steps; step++) {
    const pid = pick(ids);
    const p = room.get(pid);
    const r = rnd(100);
    let label;
    if (r < 40 && p.tableId) {
      // Play at the current table, preferring legal moves.
      const t = room.viewFor(pid).tables.find((x) => x.id === p.tableId).state;
      const play = (action, extra = {}) => room.command(pid, { type: 'play', tableId: p.tableId, action, ...extra });
      const game = room.table(p.tableId).game;
      label = 'play:' + game;
      if (game === 'blackjack') {
        if (t.you.moves.length && rnd(5)) play(pick(t.you.moves)); else play('bet', { amount: money() });
      } else if (game === 'roulette') {
        const a = rnd(10);
        if (a < 6) play('bet', { spot: pick(SPOTS), amount: money() });
        else if (a < 7) play('undo'); else if (a < 8) play('clear'); else play('done');
      } else if (game === 'poker') {
        const you = t.you;
        if (you.moves && you.moves.length) {
          const m = pick(you.moves);
          play(m, m === 'raise' ? { to: rnd(3) ? you.minRaiseTo : pick([you.maxRaiseTo, you.minRaiseTo - 1, 999_999]) } : {});
        } else play(pick(['check', 'deal', 'raise']));
      } else {
        const you = t.you;
        if (you.moves && you.moves.length) play(pick(you.moves)); else play(pick(['chaal', 'deal', 'see']));
      }
    } else if (r < 50) {
      label = 'sit';
      room.command(pid, rnd(4) ? { type: 'sit', tableId: pick(TABLES) } : { type: 'stand-up' });
    } else if (r < 58) {
      label = 'bank';
      const a = rnd(3);
      if (a === 0) room.command(pid, { type: 'borrow', amount: money() });
      else if (a === 1) room.command(pid, { type: 'repay', amount: money() });
      else { const loan = room.viewFor(pid).me?.bank?.loans.find((l) => l.kind === 'p2p' && l.borrower === pid); if (loan) room.command(pid, { type: 'loan-repay', loanId: loan.id, amount: money() }); }
    } else if (r < 64) {
      label = 'offer';
      const offers = room.viewFor(pid).me?.bank?.offers || [];
      const mine = offers.find((o) => o.awaiting === pid);
      if (mine && rnd(2)) room.command(pid, rnd(3) ? { type: 'loan-accept', offerId: mine.id, version: rnd(4) ? mine.version : 0 } : { type: 'loan-counter', offerId: mine.id, amount: money(), ratePct: rnd(60), termMin: pick([5, 30, 1000]) });
      else if (mine) room.command(pid, { type: 'loan-decline', offerId: mine.id });
      else room.command(pid, { type: 'loan-offer', to: pick(ids.filter((x) => x !== pid || !rnd(10))), role: pick(['lend', 'borrow']), amount: money(), ratePct: rnd(40), termMin: pick([5, 10, 30]) });
    } else if (r < 69) {
      label = 'duel';
      const open = [...room.challenges.values()].find((x) => x.to === pid);
      if (open) room.command(pid, rnd(4) ? { type: 'challenge-accept', challengeId: open.id } : { type: 'challenge-decline', challengeId: open.id });
      else room.command(pid, { type: 'challenge', to: pick(ids.filter((x) => x !== pid || !rnd(10))), game: rnd(10) ? pick(['highcard', 'dice', 'coin']) : 'chess', amount: money() });
    } else if (r < 74) {
      label = 'social';
      const a = rnd(5);
      if (a === 0) room.command(pid, { type: 'watch', tableId: pick([...TABLES, null, 'nope']) });
      else if (a === 1) room.command(pid, { type: 'emote', emote: pick(['fire', 'clap', 'x']), tableId: pick(TABLES) });
      else if (a === 2) room.command(pid, { type: 'stats', playerId: pick(ids) });
      else if (a === 3) room.command(pid, { type: 'chat', text: 'gg ' + step });
      else room.command(pid, { type: 'session-history' });
    } else if (r < 80) {
      label = 'connection';
      room.setConnected(pid, !p.connected);
    } else if (r < 81) {
      label = 'host';
      const h = room.hostId;
      const a = rnd(6);
      if (a === 0) { if (room.command(h, { type: 'pause' }).ok) pausedAt = step; }
      else if (a === 1) room.command(h, { type: 'settings', settings: { maxBet: pick([500, 1_000, 2_000]), minBet: pick([50, 100]) } });
      else if (a === 2) room.command(h, { type: 'settings', settings: { loans: { casino: !!rnd(2), p2p: !!rnd(2) } } });
      else if (a === 3 && room.session.phase === 'paused') room.command(h, { type: 'resume' });
      else if (a === 4) { if (room.session.phase === 'paused') room.command(h, { type: 'resume' }); }
    } else if (r < 82) {
      label = 'restore';
      const snap = JSON.parse(JSON.stringify(room.toJSON()));
      room.destroy();
      room = CasinoRoom.fromJSON(snap, { now: c.now, timers: c.timers, rng: seeded(seed + step) });
      for (const id of ids) if (rnd(4)) room.setConnected(id, true);
    } else if (r === 82 && rnd(8) === 0) {
      label = 'restart';
      const h = room.hostId;
      room.command(h, { type: 'restart', confirm: true });
      pausedAt = null;
      for (const id of ids) { room.setConnected(id, true); room.command(id, { type: 'ready', ready: true }); }
      assert.ok(room.command(room.hostId, { type: 'start' }).ok, `step ${step}: restart then start`);
    } else {
      label = 'time';
      c.advance(pick([500, 2_000, 6_000, 15_000, 26_000, 61_000]));
    }
    if (pausedAt != null && step - pausedAt > 15) { room.command(room.hostId, { type: 'resume' }); pausedAt = null; }
    if (room.session.phase !== 'paused') pausedAt = null;
    counts[label] = (counts[label] || 0) + 1;
    try { invariants(room, step); } catch (err) { err.message += ` (after ${label} by ${p.name}, seed ${seed})`; throw err; }
  }
  // Wind down: end the session and check that everything open was closed and the books still balance.
  if (room.session.phase === 'paused') room.command(room.hostId, { type: 'resume' });
  room.command(room.hostId, { type: 'end' });
  c.advance(60_000);
  assert.equal(room.session.phase, 'ended');
  assert.equal(room.economy.openRounds().length, 0, 'every round is closed at the end');
  for (const a of room.economy.accounts.values()) assert.equal(a.reserved, 0, 'nothing left in play');
  invariants(room, 'end');
  const settled = {};
  for (const rd of room.economy.rounds.values()) if (rd.state === 'settled') settled[rd.game] = (settled[rd.game] || 0) + 1;
  for (const arch of room.economy.archive) for (const e of arch.ledger) if (e.type === 'settle') settled['archived'] = (settled['archived'] || 0) + 1;
  counts.settled = settled;
  counts.loans = [...room.economy.loans.values()].length + room.economy.archive.reduce((s, a) => s + (a.loans || []).length, 0);
  counts.bankrupt = room.feed.filter((f) => f.kind === 'bankrupt').length;
  counts.duels = room.feed.filter((f) => f.kind === 'duel').length;
  counts.sessions = room.session.no;
  if (process.env.CHAOS_REPORT) console.log('CHAOS', seed, JSON.stringify(counts));
  room.destroy();
  return counts;
}

const total = { settled: 0, bankrupt: 0, duels: 0, loans: 0 };
for (const seed of [1, 2, 3, 4]) {
  test(`chaos run ${seed}: 3,000 random actions keep the books balanced and secrets secret`, () => {
    const counts = chaos(seed, 3_000);
    for (const k of ['play:blackjack', 'play:roulette', 'play:poker', 'play:teenpatti', 'bank', 'offer', 'duel', 'restore']) assert.ok(counts[k] > 5, `${k} was exercised (${counts[k]})`);
    const settled = Object.values(counts.settled).reduce((a, b) => a + b, 0);
    assert.ok(settled > 100, `rounds actually settled (${settled})`);
    total.settled += settled; total.bankrupt += counts.bankrupt; total.duels += counts.duels; total.loans += counts.loans;
  });
}

test('the chaos runs reached the risky paths: settlements, loans, duels and bankruptcies', () => {
  assert.ok(total.settled > 800, JSON.stringify(total));
  assert.ok(total.loans > 50, JSON.stringify(total));
  assert.ok(total.duels > 10, JSON.stringify(total));
  assert.ok(total.bankrupt > 3, JSON.stringify(total));
});
