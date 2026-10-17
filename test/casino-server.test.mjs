// Neon Casino over real sockets (games/casino/server/index.mjs): several players at once, simultaneous commands,
// reconnects, forged requests, rate limits, and rooms that survive a server restart.  npm test
// Speaks the Socket.io v4 wire protocol over plain `ws`, so the tests need no extra packages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import attach from '../games/casino/server/index.mjs';

const BASE = '/games/casino/';
const quiet = () => {};

async function startServer(dataDir) {
  const httpServer = createServer();
  const casino = await attach({ httpServer, basePath: BASE, log: quiet, dataDir });
  await new Promise((r) => httpServer.listen(0, r));
  return { httpServer, casino, port: httpServer.address().port };
}

/** Minimal Socket.io client: emit(event, data) → Promise<ack>, plus the latest 'state' view. */
function connect(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}${BASE}socket.io/?EIO=4&transport=websocket`);
    const acks = new Map();
    let ackId = 0;
    const client = {
      state: null, fx: [], closed: null,
      emit(event, data) {
        return new Promise((res) => { const id = ackId++; acks.set(id, res); ws.send(`42${id}${JSON.stringify([event, data])}`); });
      },
      cmd(c) { return client.emit('cmd', c); },
      async waitFor(pred, ms = 2000) {
        const until = Date.now() + ms;
        while (Date.now() < until) { if (client.state && pred(client.state)) return client.state; await new Promise((r) => setTimeout(r, 10)); }
        throw new Error('timed out waiting for state');
      },
      close() { ws.close(); },
    };
    ws.on('message', (raw) => {
      const m = String(raw);
      if (m[0] === '0') ws.send('40');
      else if (m === '2') ws.send('3');
      else if (m.startsWith('40')) resolve(client);
      else if (m.startsWith('42')) {
        const [ev, data] = JSON.parse(m.slice(2));
        if (ev === 'state') client.state = data;
        else if (ev === 'fx') client.fx.push(data);
        else if (ev === 'closed') client.closed = data;
      } else if (m.startsWith('43')) {
        const id = Number(m.slice(2).match(/^\d+/)[0]);
        const [data] = JSON.parse(m.slice(2 + String(id).length));
        acks.get(id)?.(data); acks.delete(id);
      }
    });
    ws.on('error', reject);
  });
}

let dataDir;
test.before(async () => { dataDir = await mkdtemp(join(tmpdir(), 'casino-test-')); });
test.after(async () => { await rm(dataDir, { recursive: true, force: true }); });

const device = (n) => `test-device-${n}-${'x'.repeat(16)}`;

test('players create and join a room, ready up, and start with equal wallets', async () => {
  const s = await startServer(join(dataDir, 'a'));
  const host = await connect(s.port), ben = await connect(s.port);
  const made = await host.emit('room:create', { name: 'Asha', avatar: 'owl', deviceKey: device(1) });
  assert.ok(made.ok && /^[A-Z2-9]{5}$/.test(made.code));
  assert.ok(!(await ben.emit('room:join', { code: 'ZZZZZ', name: 'Ben' })).ok);
  const joined = await ben.emit('room:join', { code: made.code.toLowerCase(), name: 'Ben', deviceKey: device(2) });
  assert.ok(joined.ok);
  await host.waitFor((v) => v.players.length === 2);
  assert.match((await host.cmd({ type: 'start' })).error, /Ben/);
  assert.match((await ben.cmd({ type: 'start' })).error, /host/);
  await ben.cmd({ type: 'ready', ready: true });
  // The host mashes Start: exactly one start, one stake each.
  const starts = await Promise.all(Array.from({ length: 6 }, () => host.cmd({ type: 'start' })));
  assert.equal(starts.filter((r) => r.ok).length, 1);
  const v = await ben.waitFor((x) => x.session.phase === 'live');
  assert.deepEqual(v.players.map((p) => p.cash), [10_000, 10_000]);
  assert.equal(v.me.history.filter((h) => h.type === 'stake').length, 1);
  assert.deepEqual(s.casino.rooms.get(made.code).room.economy.audit(), []);
  host.close(); ben.close(); await s.casino.close();
});

test('a dropped player resumes the same seat; a wrong token, a stranger and a forged command get nothing', async () => {
  const s = await startServer(join(dataDir, 'b'));
  const host = await connect(s.port);
  let ben = await connect(s.port);
  const made = await host.emit('room:create', { name: 'Asha', deviceKey: device(1) });
  const seat = await ben.emit('room:join', { code: made.code, name: 'Ben', deviceKey: device(2) });
  await ben.cmd({ type: 'ready', ready: true });
  await host.cmd({ type: 'start' });
  ben.close();
  await host.waitFor((v) => v.players.find((p) => p.id === seat.playerId).connected === false);
  const stranger = await connect(s.port);
  assert.ok((await stranger.emit('room:resume', { code: made.code, playerId: seat.playerId, token: 'nope' })).error);
  assert.ok((await stranger.cmd({ type: 'chat', text: 'hi' })).error, 'no seat, no commands');
  ben = await connect(s.port);
  assert.ok((await ben.emit('room:resume', { code: made.code, playerId: seat.playerId, token: seat.token })).ok);
  const v = await ben.waitFor((x) => x.you === seat.playerId);
  assert.equal(v.me.account.cash, 10_000);
  assert.equal(v.players.length, 2, 'resuming never adds a second seat');
  assert.ok((await ben.cmd({ type: 'settings', settings: { maxBet: 1 } })).error, 'only the host changes settings');
  assert.ok((await ben.cmd({ type: 'restart', confirm: true })).error);
  assert.ok((await ben.cmd({ type: 'payout', playerId: seat.playerId, amount: 1e9 })).error);
  assert.ok((await ben.cmd(null)).error);
  // Joining again from the same device is the same seat, not a fresh $10,000.
  const twin = await connect(s.port);
  const again = await twin.emit('room:join', { code: made.code, name: 'Ben 2', deviceKey: device(2) });
  assert.equal(again.playerId, seat.playerId);
  assert.equal((await host.waitFor((x) => x.players.length === 2)).players.length, 2);
  host.close(); ben.close(); stranger.close(); twin.close(); await s.casino.close();
});

test('simultaneous commands from many players are all applied, in order, without losing any', async () => {
  const s = await startServer(join(dataDir, 'c'));
  const host = await connect(s.port);
  const made = await host.emit('room:create', { name: 'Host', deviceKey: device(0) });
  const others = await Promise.all(Array.from({ length: 5 }, () => connect(s.port)));
  await Promise.all(others.map((c, i) => c.emit('room:join', { code: made.code, name: 'P' + i, deviceKey: device(10 + i) })));
  await Promise.all(others.map((c) => c.cmd({ type: 'ready', ready: true })));
  assert.ok((await host.cmd({ type: 'start' })).ok);
  await Promise.all(others.flatMap((c, i) => [1, 2, 3].map((n) => c.cmd({ type: 'chat', text: `P${i} says ${n}` }))));
  const v = await host.waitFor((x) => x.chat.length === 15);
  for (let i = 0; i < 5; i++) assert.deepEqual(v.chat.filter((m) => m.text.startsWith(`P${i} `)).map((m) => m.text), [1, 2, 3].map((n) => `P${i} says ${n}`));
  assert.deepEqual(v.players.map((p) => p.cash), Array(6).fill(10_000));
  [host, ...others].forEach((c) => c.close()); await s.casino.close();
});

test('a double-clicked bet and a mid-hand refresh charge once and keep the hand', async () => {
  const s = await startServer(join(dataDir, 'f'));
  const a = await connect(s.port), b = await connect(s.port);
  const made = await a.emit('room:create', { name: 'Asha', deviceKey: device(1) });
  const seatB = await b.emit('room:join', { code: made.code, name: 'Ben', deviceKey: device(2) });
  await b.cmd({ type: 'ready', ready: true });
  await a.cmd({ type: 'start' });
  await Promise.all([a.cmd({ type: 'sit', tableId: 'blackjack' }), b.cmd({ type: 'sit', tableId: 'blackjack' })]);
  const bets = await Promise.all([
    a.cmd({ type: 'play', tableId: 'blackjack', action: 'bet', amount: 500 }),
    a.cmd({ type: 'play', tableId: 'blackjack', action: 'bet', amount: 500 }),
    b.cmd({ type: 'play', tableId: 'blackjack', action: 'bet', amount: 800 }),
  ]);
  assert.deepEqual(bets.map((r) => !!r.ok), [true, false, true]);
  const v = await a.waitFor((x) => x.tables[0].state.phase === 'playing' || x.tables[0].state.phase === 'results');
  assert.equal(v.me.account.netWorth, v.me.account.cash + v.me.account.reserved);
  const room = s.casino.rooms.get(made.code).room;
  assert.equal(room.economy.ledger.filter((e) => e.type === 'bet' && e.playerId === made.playerId).length, 1, 'one bet, not two');
  // Ben refreshes mid-hand: same seat, same hand, nothing refunded.
  b.close();
  const b2 = await connect(s.port);
  assert.ok((await b2.emit('room:resume', { code: made.code, playerId: seatB.playerId, token: seatB.token })).ok);
  const vb = await b2.waitFor((x) => x.you === seatB.playerId);
  const t = vb.tables.find((x) => x.id === 'blackjack').state;
  assert.ok(t.you.seated);
  assert.ok(!room.economy.ledger.some((e) => e.type === 'refund'), 'refreshing never refunds a bet');
  assert.deepEqual(room.economy.audit(), []);
  a.close(); b2.close(); await s.casino.close();
});

test('a socket that floods the server is slowed down', async () => {
  const s = await startServer(join(dataDir, 'd'));
  const host = await connect(s.port);
  await host.emit('room:create', { name: 'Spam', deviceKey: device(3) });
  const res = await Promise.all(Array.from({ length: 60 }, (_, i) => host.cmd({ type: 'chat', text: 'spam ' + i })));
  assert.ok(res.some((r) => r.error && /Slow down/.test(r.error)));
  host.close(); await s.casino.close();
});

test('rooms, wallets and seats survive a server restart', async () => {
  const dir = join(dataDir, 'e');
  let s = await startServer(dir);
  const host = await connect(s.port);
  const made = await host.emit('room:create', { name: 'Asha', deviceKey: device(1) });
  await host.cmd({ type: 'start' });
  const room = s.casino.rooms.get(made.code).room;
  room.economy.openRound({ roundId: 'r1', game: 'blackjack' });
  room.economy.reserve({ betId: 'b1', playerId: made.playerId, roundId: 'r1', amount: 2_500 });
  room.economy.settleRound('r1', {}, { mode: 'house', maxMultiplier: 2 });
  host.close();
  await s.casino.close();       // saves on the way down

  s = await startServer(dir);
  const back = await connect(s.port);
  assert.ok((await back.emit('room:resume', { code: made.code, playerId: made.playerId, token: made.token })).ok);
  const v = await back.waitFor((x) => x.you === made.playerId);
  assert.equal(v.session.phase, 'live');
  assert.equal(v.me.account.cash, 7_500, 'the loss is still on the books after a restart');
  assert.deepEqual(s.casino.rooms.get(made.code).room.economy.audit(), []);
  back.close(); await s.casino.close();
});
