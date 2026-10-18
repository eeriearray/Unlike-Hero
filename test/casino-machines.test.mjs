// Neon Casino slot hall and video poker (games/casino/server/games/slots.mjs, videopoker.mjs): server-side reels and
// deck, bets held until the result, chip conservation, bots playing them.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { CasinoRoom } from '../games/casino/server/room.mjs';
import { STRIPS, windowAt, evaluate, PAYS } from '../games/casino/server/games/slots.mjs';
import { rankOf, PAYTABLE } from '../games/casino/server/games/videopoker.mjs';

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
function setup(table, seed = 5) {
  const c = clock();
  const room = new CasinoRoom({ code: 'MC001', now: c.now, timers: c.timers, rng: seeded(seed) });
  const { player } = room.addPlayer({ name: 'Ann' }); room.setConnected(player.id, true);
  room.command(player.id, { type: 'start' });
  assert.ok(room.command(player.id, { type: 'sit', tableId: table }).ok);
  return { c, room, id: player.id, t: room.table(table) };
}
const play = (room, id, tableId, action, extra) => room.command(id, { type: 'play', tableId, action, ...(extra || {}) });

test('slot payouts: lines, three of a kind and the cherry bonus', () => {
  const grid = (rows) => [0, 1, 2].map((reel) => rows.map((row) => row[reel]));
  const g = grid([['LEM', 'BAR', 'CHR'], ['S7', 'S7', 'S7'], ['CHR', 'CHR', 'BELL']]);
  const ev = evaluate(g, 1000);
  assert.deepEqual(ev.wins.map((w) => [w.line, w.kind]).sort(), [[1, 'S7'], [2, 'CHR2']]);
  assert.equal(ev.payout, Math.floor(200 * PAYS.S7) + Math.floor(200 * PAYS.CHR2));
  assert.equal(windowAt([0, 0, 0]).length, 3);
  assert.ok(STRIPS.every((s) => s.length === 20));
});

test('a spin holds the bet, then pays when the reels stop, and the books balance', () => {
  const { c, room, id, t } = setup('slots');
  const e = room.economy;
  const start = e.account(id).cash;
  assert.ok(play(room, id, 'slots', 'spin', { amount: 7 }).error, 'bets must split over five lines');
  assert.ok(play(room, id, 'slots', 'spin', { amount: 50 }).error, 'minimum bet');
  assert.ok(play(room, id, 'slots', 'spin', { amount: 500 }).ok);
  assert.equal(e.account(id).cash, start - 500);
  assert.equal(e.account(id).reserved, 500);
  assert.ok(play(room, id, 'slots', 'spin', { amount: 500 }).error, 'reels still turning');
  const mid = room.viewFor(id).tables.find((x) => x.id === 'slots').state;
  assert.equal(mid.spins[id].state, 'spinning');
  c.advance(4_100);
  const view = room.viewFor(id).tables.find((x) => x.id === 'slots').state;
  assert.equal(view.spins[id].state, 'done');
  assert.equal(e.account(id).reserved, 0);
  assert.equal(e.account(id).cash, start - 500 + view.spins[id].payout);
});

test('only the player sees their own reels while they turn', () => {
  const { room, id } = setup('slots');
  const b = room.addPlayer({ name: 'Bo' }).player; room.setConnected(b.id, true);
  play(room, id, 'slots', 'spin', { amount: 500 });
  const other = room.viewFor(b.id).tables.find((x) => x.id === 'slots').state.spins[id];
  assert.equal(other.grid, null);
  assert.ok(room.viewFor(id).tables.find((x) => x.id === 'slots').state.spins[id].grid);
});

test('video poker ranks every pay-table hand', () => {
  assert.equal(rankOf(['TS', 'JS', 'QS', 'KS', 'AS']), 'royal');
  assert.equal(rankOf(['5S', '6S', '7S', '8S', '9S']), 'sflush');
  assert.equal(rankOf(['9S', '9H', '9D', '9C', '2S']), 'four');
  assert.equal(rankOf(['9S', '9H', '9D', '2C', '2S']), 'full');
  assert.equal(rankOf(['2S', '6S', '9S', 'JS', 'KS']), 'flush');
  assert.equal(rankOf(['5S', '6H', '7D', '8C', '9S']), 'straight');
  assert.equal(rankOf(['9S', '9H', '9D', '2C', '4S']), 'three');
  assert.equal(rankOf(['9S', '9H', '4D', '4C', '2S']), 'twopair');
  assert.equal(rankOf(['JS', 'JH', '4D', '8C', '2S']), 'jacks');
  assert.equal(rankOf(['TS', 'TH', '4D', '8C', '2S']), null, 'tens are not enough');
  assert.equal(PAYTABLE.length, 9);
});

test('video poker: deal, hold, draw, pay once; the deck stays secret', () => {
  const { room, id, t } = setup('videopoker', 11);
  const e = room.economy, start = e.account(id).cash;
  assert.ok(play(room, id, 'videopoker', 'draw').error, 'nothing dealt yet');
  assert.ok(play(room, id, 'videopoker', 'deal', { amount: 500 }).ok);
  assert.equal(e.account(id).reserved, 500);
  const b = room.addPlayer({ name: 'Bo' }).player; room.setConnected(b.id, true);
  const mine = room.viewFor(id).tables.find((x) => x.id === 'videopoker').state.hands[id];
  const theirs = room.viewFor(b.id).tables.find((x) => x.id === 'videopoker').state.hands[id];
  assert.equal(mine.cards.length, 5); assert.ok(mine.cards.every(Boolean));
  assert.ok(theirs.cards.every((c) => c === null), 'others see backs');
  assert.ok(!JSON.stringify(room.viewFor(id)).includes('"deck"'));
  assert.ok(play(room, id, 'videopoker', 'deal', { amount: 500 }).error, 'hand in progress');
  assert.ok(play(room, id, 'videopoker', 'hold', { index: 9 }).error);
  play(room, id, 'videopoker', 'hold', { index: 0 }); play(room, id, 'videopoker', 'hold', { index: 1 });
  const kept = mine.cards.slice(0, 2);
  assert.ok(play(room, id, 'videopoker', 'draw').ok);
  const done = room.viewFor(id).tables.find((x) => x.id === 'videopoker').state.hands[id];
  assert.equal(done.phase, 'done'); assert.deepEqual(done.cards.slice(0, 2), kept);
  assert.equal(e.account(id).reserved, 0);
  assert.equal(e.account(id).cash, start - 500 + done.payout);
  assert.ok(play(room, id, 'videopoker', 'draw').error, 'already drawn');
});

test('an idle video poker hand draws by itself so the bet never sticks', () => {
  const { c, room, id } = setup('videopoker', 3);
  play(room, id, 'videopoker', 'deal', { amount: 500 });
  c.advance(61_000);
  assert.equal(room.economy.account(id).reserved, 0);
  assert.equal(room.viewFor(id).tables.find((x) => x.id === 'videopoker').state.hands[id].phase, 'done');
});

test('bots play the machines and the chip books stay valid', () => {
  const c = clock();
  const room = new CasinoRoom({ code: 'MB001', now: c.now, timers: c.timers, rng: seeded(9) });
  const h = room.addPlayer({ name: 'H' }).player; room.setConnected(h.id, true);
  room.command(h.id, { type: 'add-bot', tableId: 'slots' }); room.command(h.id, { type: 'add-bot', tableId: 'videopoker' });
  room.command(h.id, { type: 'start' });
  for (let i = 0; i < 60; i++) c.advance(10_000);
  const bots = [...room.players.values()].filter((p) => p.isBot);
  for (const b of bots) { const a = room.economy.account(b.id); assert.ok(a.rounds > 5, `${b.name} played`); assert.ok(Number.isFinite(a.cash) && a.cash >= 0); }
});
