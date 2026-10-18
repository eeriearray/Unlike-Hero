// Neon Casino house bots (games/casino/server/bots.mjs): host-only, play through the normal commands at every table,
// never break the chip books.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { CasinoRoom } from '../games/casino/server/room.mjs';

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

function setup() {
  const c = clock();
  const room = new CasinoRoom({ code: 'BT001', now: c.now, timers: c.timers, rng: seeded(7) });
  const { player } = room.addPlayer({ name: 'Host' }); room.setConnected(player.id, true);
  return { c, room, host: player.id };
}

test('only the host can add or remove bots', () => {
  const { room, host } = setup();
  const g = room.addPlayer({ name: 'Guest' }).player; room.setConnected(g.id, true);
  assert.ok(room.command(g.id, { type: 'add-bot' }).error);
  const r = room.command(host, { type: 'add-bot' });
  assert.ok(r.ok);
  assert.ok(room.command(g.id, { type: 'remove-bot', id: r.id }).error);
  assert.ok(room.command(host, { type: 'remove-bot', id: r.id }).ok);
  assert.ok(room.command(host, { type: 'remove-bot', id: host }).error, 'a person is not a bot');
});

test('bots never block starting the session or take the host role', () => {
  const { room, host } = setup();
  room.command(host, { type: 'add-bot' }); room.command(host, { type: 'add-bot' });
  assert.ok(room.command(host, { type: 'start' }).ok);
  room.setConnected(host, false);
  room.migrateHost();
  assert.equal(room.hostId, host, 'no human to hand over to, so the host stays');
  assert.equal(room.humans().filter((p) => p.isBot).every((p) => room.economy.account(p.id).staked), true);
});

test('bots sit down and play every table without breaking the books', () => {
  const { c, room, host } = setup();
  for (let i = 0; i < 6; i++) assert.ok(room.command(host, { type: 'add-bot' }).ok);
  assert.ok(room.command(host, { type: 'add-bot' }).error, 'capped at six');
  room.command(host, { type: 'start' });
  const total = () => [...room.players.keys()].reduce((n, id) => n + room.economy.account(id).cash + (room.economy.account(id).reserved || 0), 0);
  for (let min = 0; min < 6; min++) c.advance(60_000);
  const seated = room.humans().filter((p) => p.isBot && p.tableId);
  assert.ok(seated.length >= 5, 'bots found tables');
  assert.ok(room.session.rounds > 0, 'rounds were played');
  // put them at each game by hand and let them run
  for (const [i, t] of ['roulette', 'poker', 'teenpatti', 'blackjack'].entries()) {
    const b = room.humans().filter((p) => p.isBot)[i];
    room.command(b.id, { type: 'sit', tableId: t });
  }
  for (let min = 0; min < 10; min++) c.advance(60_000);
  assert.ok(total() > 0);
  for (const p of room.players.values()) { const a = room.economy.account(p.id); assert.ok(a.cash >= 0 && Number.isFinite(a.cash)); }
  assert.equal(room.viewFor(host).players.filter((p) => p.isBot).length, 6);
});

test('the host chooses which game a bot plays, and can change it', () => {
  const { c, room, host } = setup();
  const r = room.command(host, { type: 'add-bot', tableId: 'roulette' });
  assert.ok(r.ok);
  assert.ok(room.command(host, { type: 'add-bot', tableId: 'nope' }).error);
  room.command(host, { type: 'start' });
  c.advance(10_000);
  assert.equal(room.get(r.id).tableId, 'roulette');
  assert.ok(room.command(host, { type: 'bot-table', id: r.id, tableId: 'poker' }).ok);
  c.advance(10_000);
  assert.equal(room.get(r.id).tableId, 'poker');
  assert.equal(room.viewFor(host).players.find((p) => p.id === r.id).botTable, 'poker');
});

test('bots never end roulette betting early; the timer does', () => {
  const { c, room, host } = setup();
  room.command(host, { type: 'add-bot', tableId: 'roulette' });
  room.command(host, { type: 'start' });
  const t = room.table('roulette');
  room.command(host, { type: 'sit', tableId: 'roulette' });
  c.advance(8_000);
  assert.equal(t.state.phase, 'betting', 'bot has bet, still waiting on the clock');
  assert.ok(t.state.round.bets.length > 0);
  c.advance(10_000);
  assert.equal(t.state.phase, 'betting', 'still before the deadline');
  c.advance(15_000);
  assert.notEqual(t.state.phase, 'betting', 'the timer closed betting');
});
