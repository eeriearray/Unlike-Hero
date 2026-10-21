// The hub relay: direct messages reach only their target, spoofed senders are dropped, and games can ask for
// bigger rooms in game.json (multiplayer.roomLimit). Starts the real server/relay.mjs on a spare port.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const PORT = 20000 + Math.floor(Math.random() * 20000);
let hub;
test.before(async () => {
  hub = spawn(process.execPath, [fileURLToPath(new URL('../server/relay.mjs', import.meta.url))], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { hub.stdout.on('data', d => { if (/Game hub on/.test(String(d))) resolve(); }); hub.on('exit', c => reject(new Error('hub exited ' + c))); });
});
test.after(() => hub && hub.kill());

const open = room => new Promise(resolve => {
  const ws = new WebSocket(`ws://localhost:${PORT}/relay?room=${encodeURIComponent(room)}`);
  ws.got = []; ws.on('message', m => ws.got.push(JSON.parse(String(m))));
  ws.on('open', () => resolve(ws)); ws.on('error', () => resolve(null)); ws.on('close', () => { ws.closedEarly = true; });
});
const frame = (ws, o) => ws.send(JSON.stringify(Object.assign({ room: 'r' }, o)));
const settle = () => new Promise(r => setTimeout(r, 150));

test('a direct message reaches only its target, and spoofed senders are dropped', async () => {
  const room = 'party-pack:T' + PORT;
  const [a, b, c] = await Promise.all([open(room), open(room), open(room)]);
  frame(a, { t: 'hello', from: 'conn-a' }); frame(b, { t: 'hello', from: 'conn-b' }); frame(c, { t: 'hello', from: 'conn-c' });
  await settle(); [a, b, c].forEach(w => { w.got = []; });
  frame(a, { t: 'msg', from: 'conn-a', to: 'conn-b', topic: 'view', data: { secret: 'you are the Imposter' } });
  frame(a, { t: 'msg', from: 'conn-a', topic: 'stage', data: { public: true } });
  frame(c, { t: 'msg', from: 'conn-a', topic: 'spoof', data: {} });             // c pretends to be a
  await settle();
  assert.deepEqual(b.got.map(m => m.topic), ['view', 'stage'], 'the target gets the private and the public message');
  assert.deepEqual(c.got.map(m => m.topic), ['stage'], 'everyone else only gets the public one');
  assert.ok(!a.got.some(m => m.topic === 'spoof') && !b.got.some(m => m.topic === 'spoof'), 'a frame with someone else\'s id is dropped');
  [a, b, c].forEach(w => w.close());
});

test('rooms are 16 connections unless the game asks for more', async () => {
  const fill = async (room, n) => { const out = []; for (let i = 0; i < n; i++) out.push(await open(room)); await settle(); return out; };
  const small = await fill('short-fuse:L' + PORT, 17);
  assert.equal(small.filter(w => w && !w.closedEarly).length, 16, 'default limit');
  const party = await fill('party-pack:L' + PORT, 20);
  assert.equal(party.filter(w => w && !w.closedEarly).length, 20, 'Party Pack asked for 40');
  [...small, ...party].forEach(w => w && w.close());
});
