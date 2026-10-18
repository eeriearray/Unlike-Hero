// Neon Casino security checks: garbage commands of every shape, per-network limits over real sockets, and the hub
// never serving server code or saved wallets.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { CasinoRoom } from '../games/casino/server/room.mjs';
import attach from '../games/casino/server/index.mjs';

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

const TYPES = ['profile', 'ready', 'settings', 'start', 'pause', 'resume', 'end', 'restart', 'host', 'chat', 'emote', 'history', 'sit', 'stand-up', 'play',
  'borrow', 'repay', 'loan-offer', 'loan-counter', 'loan-accept', 'loan-decline', 'loan-repay', 'challenge', 'challenge-accept', 'challenge-decline',
  'watch', 'stats', 'session-history', '__proto__', 'constructor', 'toString', 'hasOwnProperty', '', 'x'.repeat(5000)];
const VALUES = [undefined, null, true, false, 0, -1, 1, 1.5, NaN, Infinity, -Infinity, 1e308, Number.MAX_SAFE_INTEGER + 2, '', '1000', 'blackjack', 'poker', 'roulette',
  '__proto__', 'constructor', 'x'.repeat(10_000), [], [1, 2], [0, 1, 2], {}, { __proto__: { admin: true } }, { type: 'red' }, { type: 'straight', numbers: [17] },
  { type: 'straight', numbers: ['17'] }, { length: 3 }, () => 1, Symbol.iterator.description];
const FIELDS = ['amount', 'to', 'tableId', 'action', 'spot', 'settings', 'name', 'avatar', 'text', 'emote', 'ready', 'confirm', 'offerId', 'version', 'loanId',
  'challengeId', 'game', 'role', 'ratePct', 'termMin', 'playerId', 'before', 'key', 'numbers'];

test('garbage commands of every shape never throw, never move money wrongly, never pollute prototypes', () => {
  const c = clock();
  const room = new CasinoRoom({ code: 'FUZZ1', now: c.now, timers: c.timers });
  const ids = [];
  for (let i = 0; i < 3; i++) { const { player } = room.addPlayer({ name: 'P' + i }); room.setConnected(player.id, true); ids.push(player.id); }
  for (const id of ids.slice(1)) room.command(id, { type: 'ready', ready: true });
  room.command(ids[0], { type: 'start' });
  room.command(ids[0], { type: 'sit', tableId: 'poker' });
  room.command(ids[1], { type: 'sit', tableId: 'poker' });
  room.command(ids[2], { type: 'sit', tableId: 'roulette' });
  c.advance(3_000);
  let s = 12345;
  const rnd = (n) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return Math.floor((s / 2 ** 32) * n); };   // Math.imul: exact 32-bit math
  for (const bad of [null, undefined, 42, 'start', [], [{ type: 'start' }], { type: 7 }, { type: null }]) assert.ok(room.command(ids[0], bad).error);
  const seen = new Set(), accepted = new Set();
  for (let i = 0; i < 20_000; i++) {
    const cmd = { type: TYPES[rnd(TYPES.length)] };
    const n = rnd(5);
    for (let k = 0; k < n; k++) cmd[FIELDS[rnd(FIELDS.length)]] = VALUES[rnd(VALUES.length)];
    if (cmd.type === 'play' && rnd(2)) cmd.tableId = ['poker', 'roulette', 'blackjack'][rnd(3)];
    let res;
    assert.doesNotThrow(() => { res = room.command(ids[rnd(3)], cmd); }, `command ${JSON.stringify(cmd).slice(0, 200)}`);
    assert.ok(res && typeof res === 'object', 'every command answers');
    seen.add(cmd.type);
    if (res.ok) accepted.add(cmd.type);
    if (i % 500 === 0) c.advance(7_000);
  }
  assert.equal(seen.size, TYPES.length, 'every command type was fuzzed');
  assert.ok(accepted.size >= 8, `garbage sometimes lands on valid input too (${[...accepted].join(', ')})`);
  assert.deepEqual(room.economy.audit(), []);
  const chips = [...room.economy.accounts.values()].reduce((t, a) => t + a.cash + a.reserved, 0);
  assert.equal(chips + room.economy.house, [...room.economy.accounts.values()].reduce((t, a) => t + a.startingCash, 0));
  assert.equal({}.admin, undefined, 'Object.prototype untouched');
  assert.equal(Object.prototype.polluted, undefined);
  for (const p of room.humans()) assert.ok(p.name.length <= 20);
  assert.ok(room.chat.every((m) => m.text.length <= 240));
  JSON.stringify(room.toJSON());
});

// ───────────── sockets ─────────────
function connect(port) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${port}/games/casino/socket.io/?EIO=4&transport=websocket`);
    const acks = new Map();
    let ackId = 0;
    const client = {
      refused: null,
      dropped: false,
      // A reply that never comes (e.g. the server dropped this socket) resolves as { timeout: true } instead of hanging.
      emit(event, data) {
        return new Promise((res) => {
          const id = ackId++;
          const t = setTimeout(() => { acks.delete(id); res({ timeout: true }); }, 3_000);
          acks.set(id, (v) => { clearTimeout(t); res(v); });
          if (ws.readyState === 1) ws.send(`42${id}${JSON.stringify([event, data])}`);
        });
      },
      raw(frame) { ws.send(frame); },
      close() { ws.close(); },
    };
    ws.on('message', (raw) => {
      const m = String(raw);
      if (m[0] === '0') ws.send('40');
      else if (m === '2') ws.send('3');
      else if (m.startsWith('40')) resolve(client);
      else if (m.startsWith('44')) { client.refused = JSON.parse(m.slice(2)).message; resolve(client); }
      else if (m.startsWith('43')) {
        const id = Number(m.slice(2).match(/^\d+/)[0]);
        acks.get(id)?.(JSON.parse(m.slice(2 + String(id).length))[0]); acks.delete(id);
      }
    });
    ws.on('close', () => { client.dropped = true; resolve(client); });
    ws.on('error', () => resolve({ refused: 'error', close() {} }));
  });
}

let dataDir;
test.before(async () => { dataDir = await mkdtemp(join(tmpdir(), 'casino-sec-')); });
test.after(async () => { await rm(dataDir, { recursive: true, force: true }); });

async function server() {
  const httpServer = createServer();
  const casino = await attach({ httpServer, basePath: '/games/casino/', log: () => {}, dataDir: join(dataDir, String(Math.random())) });
  await new Promise((r) => httpServer.listen(0, r));
  return { port: httpServer.address().port, casino };
}

test('one network can\'t open unlimited sockets, rooms or code guesses', async () => {
  const s = await server();
  const socks = [];
  for (let i = 0; i < 41; i++) socks.push(await connect(s.port));
  assert.equal(socks.filter((x) => !x.refused).length, 40);
  assert.match(socks[40].refused, /Too many connections/);
  socks.forEach((x) => x.close());
  await new Promise((r) => setTimeout(r, 100));
  // Guessing room codes: each socket is rate-limited, and the network is cut off after 30 misses.
  const guessers = await Promise.all(Array.from({ length: 4 }, () => connect(s.port)));
  const answers = [];
  for (let i = 0; i < 36; i++) answers.push(await guessers[i % 4].emit('room:join', { code: 'ZZZ' + String(i).padStart(2, '2'), name: 'x' }));
  assert.ok(answers.slice(0, 30).every((a) => /No room/.test(a.error)));
  assert.ok(answers.slice(30).every((a) => /Too many wrong/.test(a.error)));
  // Opening rooms.
  const makers = await Promise.all(Array.from({ length: 3 }, () => connect(s.port)));
  const made = [];
  for (let i = 0; i < 22; i++) made.push(await makers[i % 3].emit('room:create', { name: 'm' + i }));
  assert.equal(made.filter((m) => m.ok).length, 20);
  assert.match(made[21].error, /Too many rooms/);
  [...guessers, ...makers].forEach((x) => x.close());
  await s.casino.close();
});

test('malformed socket frames are dropped without hurting the server or anyone else', async () => {
  const s = await server();
  // A player already in a room, who must not notice anything.
  const host = await connect(s.port);
  const made0 = await host.emit('room:create', { name: 'Host' });
  assert.ok(made0.ok);
  // Each bad frame on its own socket: the server may cut that socket off, but must stay up.
  for (const frame of ['42', '42[]', '42["cmd"]', '42["room:create",null]', '42{"a":1}', '4299999999999["cmd",{}]', '42["__proto__",{}]', 'garbage',
    '42["cmd",' + '1'.repeat(20) + ']', '42["cmd",{"type":"chat","text":"' + 'x'.repeat(20_000) + '"}]']) {
    const bad = await connect(s.port);
    bad.raw(frame);
    await new Promise((r) => setTimeout(r, 30));
    bad.close();
  }
  const hello = await host.emit('cmd', { type: 'chat', text: 'still here' });
  assert.ok(hello.ok, 'the existing player is unaffected');
  const c = await connect(s.port);
  const res = await c.emit('cmd', { type: 'chat', text: 'still alive?' });
  assert.match(res.error, /not in a room/, 'new connections still work');
  const made = await c.emit('room:create', { name: 'ok', settings: { startingCash: 'lots' } });
  assert.match(made.error, /Starting cash/);
  const fine = await c.emit('room:create', { name: 'ok', avatar: '<img src=x onerror=alert(1)>' });
  assert.ok(fine.ok);
  c.close(); host.close(); await s.casino.close();
});

test('the hub never serves casino server code or saved wallets', async () => {
  const PORT = 20000 + Math.floor(Math.random() * 20000);
  const casinoData = join(dataDir, 'hub');
  await mkdir(casinoData, { recursive: true });
  await writeFile(join(casinoData, 'rooms.json'), '{"rooms":[]}');
  const hub = spawn(process.execPath, [fileURLToPath(new URL('../server/relay.mjs', import.meta.url))], { env: { ...process.env, PORT: String(PORT), CASINO_DATA_DIR: casinoData }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => { hub.stdout.on('data', (d) => { if (/Game hub on/.test(String(d))) resolve(); }); hub.on('exit', (code) => reject(new Error('hub exited ' + code))); });
    const get = (p) => fetch(`http://localhost:${PORT}${p}`).then((r) => r.status);
    assert.equal(await get('/games/casino/'), 200);
    assert.equal(await get('/games/casino/socket.io/socket.io.min.js'), 200);
    for (const p of ['/games/casino/server/economy.mjs', '/games/casino/server/games/poker.mjs', '/games/casino/server/data/rooms.json', '/games/casino/server/',
      '/games/casino/%73erver/room.mjs', '/games/casino/js/../server/bank.mjs', '/games/casino/./server/social.mjs', '/package.json', '/.git/config']) {
      assert.equal(await get(p), 404, p);
    }
  } finally { hub.kill(); }
});
