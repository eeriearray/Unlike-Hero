// Neon Casino roulette (games/casino/server/games/roulette.mjs): the layout, every payout, undo, limits, the spin
// and money conservation, played through a real room.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { CasinoRoom } from '../games/casino/server/room.mjs';
import { normalizeSpot, betReturn, PAYOUT, WHEEL, RED, RULES } from '../games/casino/server/games/roulette.mjs';

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

function setup(n = 2, land = 17) {
  const c = clock();
  const fx = [];
  let result = land;
  const room = new CasinoRoom({ code: 'RL001', now: c.now, timers: c.timers, rng: (k) => (k === 37 ? result : 0), hooks: { fx: (r, d) => fx.push(d) } });
  const ids = [];
  for (let i = 0; i < n; i++) { const { player } = room.addPlayer({ name: 'P' + i }); room.setConnected(player.id, true); ids.push(player.id); }
  for (const id of ids.slice(1)) room.command(id, { type: 'ready', ready: true });
  room.command(ids[0], { type: 'start' });
  for (const id of ids) assert.ok(room.command(id, { type: 'sit', tableId: 'roulette' }).ok);
  const play = (id, action, extra = {}) => room.command(id, { type: 'play', tableId: 'roulette', action, ...extra });
  const bet = (id, spot, amount = 100) => play(id, 'bet', { spot, amount });
  return { room, ids, c, fx, play, bet, land: (x) => { result = x; }, st: () => room.tableState.roulette, cash: (id) => room.economy.account(id).cash };
}
const clean = (room) => assert.deepEqual(room.economy.audit(), []);

test('the wheel is the European single-zero wheel', () => {
  assert.equal(WHEEL.length, 37);
  assert.deepEqual([...WHEEL].sort((a, b) => a - b), Array.from({ length: 37 }, (_, i) => i));
  assert.equal(RED.size, 18);
  // Neighbours on the wheel alternate red and black (zero aside).
  for (let i = 1; i < WHEEL.length - 1; i++) assert.notEqual(RED.has(WHEEL[i]), RED.has(WHEEL[i + 1]));
});

test('the layout accepts only real bets', () => {
  const ok = [
    { type: 'straight', numbers: [0] }, { type: 'straight', numbers: [36] },
    { type: 'split', numbers: [1, 2] }, { type: 'split', numbers: [2, 5] }, { type: 'split', numbers: [0, 3] },
    { type: 'street', numbers: [4, 5, 6] }, { type: 'trio', numbers: [0, 1, 2] }, { type: 'trio', numbers: [0, 2, 3] },
    { type: 'corner', numbers: [1, 2, 4, 5] }, { type: 'corner', numbers: [32, 33, 35, 36] }, { type: 'sixline', numbers: [31, 32, 33, 34, 35, 36] },
    { type: 'dozen', key: 3 }, { type: 'column', key: 1 }, { type: 'red' }, { type: 'high' },
  ];
  for (const s of ok) assert.ok(!normalizeSpot(s).error, JSON.stringify(s));
  const bad = [
    { type: 'straight', numbers: [37] }, { type: 'straight', numbers: [-1] }, { type: 'straight', numbers: [1.5] },
    { type: 'split', numbers: [3, 4] }, { type: 'split', numbers: [1, 3] }, { type: 'split', numbers: [0, 4] },
    { type: 'street', numbers: [2, 3, 4] }, { type: 'corner', numbers: [3, 4, 6, 7] }, { type: 'corner', numbers: [1, 2, 3, 4] },
    { type: 'sixline', numbers: [2, 3, 4, 5, 6, 7] }, { type: 'trio', numbers: [0, 1, 3] },
    { type: 'dozen', key: 4 }, { type: 'column' }, { type: 'jackpot' }, null,
  ];
  for (const s of bad) assert.ok(normalizeSpot(s).error, JSON.stringify(s));
  assert.deepEqual(normalizeSpot({ type: 'column', key: 3 }).numbers.slice(0, 3), [3, 6, 9]);
  assert.deepEqual(normalizeSpot({ type: 'column', key: 1 }).numbers.slice(0, 3), [1, 4, 7]);
});

test('every bet type pays the right amount, and zero sinks the outside bets', () => {
  const r = (spot, n, amount = 100) => betReturn({ ...normalizeSpot(spot), amount }, n);
  assert.equal(r({ type: 'straight', numbers: [17] }, 17), 3_600);
  assert.equal(r({ type: 'split', numbers: [17, 20] }, 20), 1_800);
  assert.equal(r({ type: 'street', numbers: [16, 17, 18] }, 18), 1_200);
  assert.equal(r({ type: 'trio', numbers: [0, 1, 2] }, 0), 1_200);
  assert.equal(r({ type: 'corner', numbers: [17, 18, 20, 21] }, 21), 900);
  assert.equal(r({ type: 'sixline', numbers: [16, 17, 18, 19, 20, 21] }, 16), 600);
  assert.equal(r({ type: 'dozen', key: 2 }, 17), 300);
  assert.equal(r({ type: 'column', key: 2 }, 17), 300);
  assert.equal(r({ type: 'black' }, 17), 200);
  assert.equal(r({ type: 'red' }, 17), 0);
  assert.equal(r({ type: 'odd' }, 17), 200);
  assert.equal(r({ type: 'low' }, 17), 200);
  for (const t of ['red', 'black', 'odd', 'even', 'low', 'high']) assert.equal(r({ type: t }, 0), 0, `${t} loses on zero`);
  assert.equal(r({ type: 'dozen', key: 1 }, 0), 0);
  // The house edge: every single bet type returns 36/37 of the stake on average.
  for (const spot of [{ type: 'straight', numbers: [5] }, { type: 'split', numbers: [5, 8] }, { type: 'corner', numbers: [1, 2, 4, 5] }, { type: 'red' }, { type: 'dozen', key: 1 }]) {
    let total = 0; for (let n = 0; n <= 36; n++) total += r(spot, n, 1);
    assert.equal(total, 36, JSON.stringify(spot));
  }
  assert.equal(PAYOUT.straight, 35);
});

test('a full spin: bets reserve, the wheel lands, winners are paid once', () => {
  const t = setup(2, 17);
  const [a, b] = t.ids;
  assert.ok(t.bet(a, { type: 'straight', numbers: [17] }, 200).ok);
  assert.ok(t.bet(a, { type: 'red' }, 500).ok);
  assert.ok(t.bet(b, { type: 'black' }, 1_000).ok);
  assert.equal(t.cash(a), 9_300);
  assert.equal(t.st().phase, 'betting');
  assert.ok(t.play(a, 'done').ok);
  assert.equal(t.st().phase, 'betting', 'waits for b');
  assert.ok(t.play(b, 'done').ok);
  assert.equal(t.st().phase, 'spinning');
  assert.equal(t.room.viewFor(a).tables.find((x) => x.id === 'roulette').state.round.result, 17);
  t.c.advance(RULES.spinMs);
  assert.equal(t.st().phase, 'results');
  assert.equal(t.cash(a), 9_300 + 7_200, '200 straight up on 17 returns 7,200; red loses');
  assert.equal(t.cash(b), 11_000);
  assert.deepEqual(t.st().history, [17]);
  assert.ok(t.room.feed.some((f) => /straight up on 17/.test(f.text)));
  clean(t.room);
  t.c.advance(RULES.resultsMs);
  assert.equal(t.st().phase, 'idle');
});

test('undo and clear take chips back before the spin; limits are enforced', () => {
  const t = setup(1);
  const [a] = t.ids;
  assert.match(t.bet(a, { type: 'red' }, 50).error, /at least \$100/);
  assert.match(t.bet(a, { type: 'red' }, 5_001).error, /capped/);
  t.bet(a, { type: 'red' }, 3_000);
  assert.match(t.bet(a, { type: 'odd' }, 2_500).error, /\$2,000 left/);
  t.bet(a, { type: 'odd' }, 1_000);
  assert.equal(t.cash(a), 6_000);
  assert.ok(t.play(a, 'undo').ok);
  assert.equal(t.cash(a), 7_000);
  assert.deepEqual(t.st().round.bets.map((x) => x.type), ['red']);
  assert.ok(t.play(a, 'clear').ok);
  assert.equal(t.cash(a), 10_000);
  t.c.advance(RULES.bettingMs);
  assert.equal(t.st().phase, 'idle', 'an empty layout doesn\'t spin');
  assert.ok(t.room.economy.ledger.filter((e) => e.type === 'refund').length === 2);
  clean(t.room);
});

test('no bets after the ball is spinning; the betting clock spins for everyone', () => {
  const t = setup(2, 0);
  const [a, b] = t.ids;
  t.bet(a, { type: 'even' }, 400);
  t.bet(b, { type: 'straight', numbers: [0] }, 100);
  t.c.advance(RULES.bettingMs);
  assert.equal(t.st().phase, 'spinning');
  assert.match(t.bet(a, { type: 'odd' }).error, /No more bets/);
  assert.ok(t.play(a, 'undo').error);
  t.c.advance(RULES.spinMs);
  assert.equal(t.cash(a), 9_600, 'zero: even loses');
  assert.equal(t.cash(b), 13_500);
  clean(t.room);
});

test('ending the session refunds an unspun layout and pays a spinning ball', () => {
  const t = setup(2, 5);
  const [a, b] = t.ids;
  t.bet(a, { type: 'red' }, 1_000);
  t.room.command(a, { type: 'end' });
  assert.equal(t.cash(a), 10_000, 'refunded');
  const u = setup(2, 5);
  u.bet(u.ids[0], { type: 'red' }, 1_000);
  u.play(u.ids[0], 'done');
  assert.equal(u.st().phase, 'spinning');
  u.room.command(u.ids[0], { type: 'end' });
  assert.equal(u.cash(u.ids[0]), 11_000, '5 is red: the ball landed and paid');
  clean(u.room);
});

test('a player who leaves keeps their chips in play', () => {
  const t = setup(2, 2);
  const [a, b] = t.ids;
  t.bet(a, { type: 'black' }, 600);
  t.bet(b, { type: 'red' }, 100);
  t.room.command(a, { type: 'stand-up' });
  t.play(b, 'done');
  assert.equal(t.st().phase, 'spinning', 'the leaver no longer holds up the spin');
  t.c.advance(RULES.spinMs);
  assert.equal(t.cash(a), 10_600);
});

test('500 random spins never create or lose a chip', () => {
  const t = setup(3);
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) >>> 0; return seed % n; };
  const spots = [{ type: 'red' }, { type: 'odd' }, { type: 'dozen', key: 2 }, { type: 'column', key: 3 }, { type: 'split', numbers: [14, 17] }, { type: 'corner', numbers: [25, 26, 28, 29] }, { type: 'sixline', numbers: [1, 2, 3, 4, 5, 6] }, { type: 'trio', numbers: [0, 2, 3] }];
  for (let i = 0; i < 500; i++) {
    t.land(rnd(37));
    for (const id of t.ids) {
      const k = 1 + rnd(3);
      for (let j = 0; j < k; j++) {
        const spot = rnd(4) === 0 ? { type: 'straight', numbers: [rnd(37)] } : spots[rnd(spots.length)];
        if (t.cash(id) >= 100) t.bet(id, spot, 100 * (1 + rnd(3)));
      }
    }
    t.c.advance(RULES.bettingMs + RULES.spinMs + RULES.resultsMs);
    const e = t.room.economy;
    const chips = t.ids.reduce((s, id) => s + e.account(id).cash + e.account(id).reserved, 0);
    assert.equal(chips + e.house, 30_000, `spin ${i}`);
  }
  clean(t.room);
});
