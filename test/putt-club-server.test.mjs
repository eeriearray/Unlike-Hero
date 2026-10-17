// Multiplayer tests for Putt Club's game server (games/putt-club/server/index.mjs): real Socket.io clients
// against the real server. Rooms, the 8-player cap, isolation, validation, synced shots, agreed scores,
// reconnection and host hand-off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import attach from '../games/putt-club/server/index.mjs';

const require = createRequire(import.meta.url);
const io = require('../node_modules/socket.io/client-dist/socket.io.js'); // the bundle the browser uses
const BASE = '/games/putt-club/';

const http = createServer((req, res) => res.writeHead(404).end());
const game = await attach({ httpServer: http, basePath: BASE, log: () => {} });
await new Promise((r) => http.listen(0, r));
const URL_ = `http://localhost:${http.address().port}`;
test.after(() => { game.close(); http.close(); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function client() {
  const s = io(URL_, { path: BASE + 'socket.io', transports: ['websocket'], forceNew: true, reconnection: false });
  const c = { s, state: null, snaps: [], fx: [], closed: null };
  s.on('state', (v) => { c.state = v; });
  s.on('snap', (v) => { c.snaps.push(v); if (c.snaps.length > 50) c.snaps.shift(); });
  s.on('fx', (list) => c.fx.push(...list));
  s.on('closed', (d) => { c.closed = d; });
  c.emit = (ev, data) => new Promise((res) => s.emit(ev, data, res));
  c.cmd = (cmd) => c.emit('cmd', cmd);
  c.close = () => s.close();
  return c;
}
async function until(pred, ms = 8000) { const t0 = Date.now(); while (!pred()) { if (Date.now() - t0 > ms) throw new Error('timed out'); await sleep(20); } }
const me = (c) => c.state && c.state.players.find((p) => p.id === c.state.you);

test('create and join with a 4-letter code; eight players fit, the ninth is turned away', async () => {
  const host = client();
  const made = await host.emit('room:create', { name: 'Host', color: 0 });
  assert.ok(made.ok, JSON.stringify(made));
  assert.match(made.code, /^[A-HJ-KM-NP-Z]{4}$/);
  const others = [];
  for (let i = 1; i < 8; i++) {
    const c = client();
    const r = await c.emit('room:join', { code: made.code.toLowerCase(), name: 'P' + i });
    assert.ok(r.ok, `player ${i}: ${JSON.stringify(r)}`);
    others.push(c);
  }
  await until(() => host.state && host.state.players.length === 8);
  assert.equal(new Set(host.state.players.map((p) => p.color)).size, 8, 'everyone gets their own colour');
  const late = client();
  const r = await late.emit('room:join', { code: made.code, name: 'Late' });
  assert.match(r.error, /full/);
  [host, late, ...others].forEach((c) => c.close());
});

test('rooms are isolated and bad codes get a helpful error', async () => {
  const a = client(), b = client();
  const ra = await a.emit('room:create', { name: 'Ann' });
  const rb = await b.emit('room:create', { name: 'Bob' });
  assert.notEqual(ra.code, rb.code);
  await until(() => a.state && b.state);
  assert.deepEqual(a.state.players.map((p) => p.name), ['Ann']);
  assert.deepEqual(b.state.players.map((p) => p.name), ['Bob']);
  const c = client();
  assert.match((await c.emit('room:join', { code: 'QQQQ', name: 'X' })).error, /No room called QQQQ/);
  // Commands only ever reach your own room.
  assert.match((await c.cmd({ type: 'start' })).error, /not in a room/);
  [a, b, c].forEach((x) => x.close());
});

test('a full hole over the network: synced balls, validated shots, agreed scores', async () => {
  const a = client(), b = client();
  const r = await a.emit('room:create', { name: 'Ann' });
  await b.emit('room:join', { code: r.code, name: 'Bob' });
  await until(() => a.state && a.state.players.length === 2);
  assert.match((await a.cmd({ type: 'start' })).error, /ready/);
  assert.match((await b.cmd({ type: 'start' })).error, /host/);
  await b.cmd({ type: 'ready', ready: true });
  assert.ok((await a.cmd({ type: 'settings', settings: { course: 'sunset-cove' } })).ok);
  assert.ok((await a.cmd({ type: 'start' })).ok);
  await until(() => a.state.phase === 'play' && b.state.phase === 'play', 10000);
  // Garbage is rejected and changes nothing.
  for (const bad of [{ type: 'shoot', dx: 'x', dz: 1, power: 1 }, { type: 'shoot', dx: 0, dz: 0, power: 0.5 }, { type: 'nope' }, { type: 'use', slot: 5 }, null]) {
    const res = await a.cmd(bad);
    assert.ok(res && res.error, JSON.stringify(bad));
  }
  assert.equal(me(a).strokes, 0);
  // Ann putts; Bob sees her ball move in the snapshot stream.
  const shot = await a.cmd({ type: 'shoot', dx: 0, dz: -1, power: 0.55 });
  assert.ok(shot.ok);
  await until(() => b.snaps.some((s) => s.b.some((x) => x[0] === r.playerId && (x[5] & 1))), 3000);
  await until(() => me(a).status === 'rest' || me(a).finished, 15000);
  await until(() => b.state.players.find((p) => p.id === r.playerId).strokes === 1);
  const last = (c) => c.snaps[c.snaps.length - 1].b.find((x) => x[0] === r.playerId);
  await sleep(200);
  assert.deepEqual(last(a).slice(1, 4), last(b).slice(1, 4), 'both clients have the same resting position');
  // Settings are locked once the match has started.
  await a.cmd({ type: 'settings', settings: { maxStrokes: 5 } });
  assert.equal(a.state.settings.maxStrokes, 8);
  b.close(); // Bob drops: he must not hold the hole up
  await until(() => a.state.players.find((p) => p.name === 'Bob').connected === false);
  // Ann putts until she holes out or hits the limit.
  for (let i = 0; i < 8 && a.state.phase === 'play' && !me(a).finished; i++) {
    await until(() => me(a).status !== 'moving', 20000);
    await sleep(400);
    if (a.state.phase !== 'play' || me(a).finished) break;
    await a.cmd({ type: 'shoot', dx: 0, dz: -1, power: 0.25 });
    await sleep(300);
  }
  await until(() => a.state.phase === 'holeResults', 30000);
  const st = a.state.standings;
  assert.equal(st.length, 2);
  const bob = st.find((s) => s.name === 'Bob');
  assert.equal(bob.holes[0].status, 'dnf');
  assert.equal(bob.holes[0].score, a.state.settings.maxStrokes + 1);
  a.close();
});

test('reconnect with the seat token keeps identity and strokes; a stale token is refused; host passes on', async () => {
  const a = client(), b = client();
  const ra = await a.emit('room:create', { name: 'Ann' });
  const rb = await b.emit('room:join', { code: ra.code, name: 'Bob' });
  await b.cmd({ type: 'ready', ready: true });
  await a.cmd({ type: 'start' });
  await until(() => a.state.phase === 'play', 10000);
  await b.cmd({ type: 'shoot', dx: 1, dz: 0, power: 0.2 });
  await until(() => b.state.players.find((p) => p.id === rb.playerId).strokes === 1);
  // Host drops: Bob becomes host and the match carries on.
  a.close();
  await until(() => b.state.players.find((p) => p.id === rb.playerId).isHost);
  assert.equal(b.state.phase, 'play');
  // Bob's connection drops and comes back with his token.
  b.close();
  const b2 = client();
  assert.match((await b2.emit('room:resume', { code: rb.code, playerId: rb.playerId, token: 'wrong' })).error, /gone/);
  const back = await b2.emit('room:resume', { code: rb.code, playerId: rb.playerId, token: rb.token });
  assert.ok(back.ok);
  await until(() => b2.state && b2.state.you === rb.playerId);
  assert.equal(me(b2).strokes, 1, 'score kept');
  assert.equal(me(b2).connected, true);
  // A friend who lost their seat can rejoin mid-match by name.
  const a2 = client();
  const again = await a2.emit('room:join', { code: ra.code, name: 'ann' });
  assert.ok(again.rejoined);
  assert.equal(again.playerId, ra.playerId);
  [a2, b2].forEach((c) => c.close());
});

test('rate limiting: a flood of commands is cut off', async () => {
  const a = client();
  await a.emit('room:create', { name: 'Spam' });
  const res = await Promise.all(Array.from({ length: 60 }, () => a.cmd({ type: 'ready', ready: true })));
  assert.ok(res.some((r) => r && r.error === 'Slow down.'));
  a.close();
});
