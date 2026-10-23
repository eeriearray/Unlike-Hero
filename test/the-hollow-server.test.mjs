// Integration test for THE HOLLOW's game server: real WebSocket clients speaking the Socket.io wire protocol
// (Engine.IO v4: "0" open, "40" connect, "42<id>[...]" event, "43<id>[...]" ack) against games/the-hollow/server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import attach from '../games/the-hollow/server/index.mjs';

const BASE = '/games/the-hollow/';
async function boot(opts = {}) {
  const http = createServer((req, res) => res.writeHead(404).end());
  const dataDir = mkdtempSync(join(tmpdir(), 'hollow-'));
  const game = attach({ httpServer: http, basePath: BASE, log: () => {}, dataDir, persist: opts.persist !== false });
  await new Promise((r) => http.listen(0, r));
  return { http, game, dataDir, port: http.address().port, close: () => { game.close(); http.close(); rmSync(dataDir, { recursive: true, force: true }); } };
}

// a minimal Socket.io client
function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}${BASE}socket.io/?EIO=4&transport=websocket`);
  const handlers = {}, acks = {}, states = [];
  let id = 0, ready;
  const opened = new Promise((r) => { ready = r; });
  ws.on('message', (raw) => {
    const m = raw.toString();
    if (m === '2') { ws.send('3'); return; }
    if (m[0] === '0') { ws.send('40'); return; }
    if (m.startsWith('40')) { ready(); return; }
    if (m.startsWith('43')) { const i = m.match(/^43(\d+)/); const body = JSON.parse(m.slice(2 + i[1].length)); const f = acks[i[1]]; if (f) { delete acks[i[1]]; f(body[0]); } return; }
    if (m.startsWith('42')) { const [ev, data] = JSON.parse(m.slice(2)); if (ev === 'state') states.push(data); (handlers[ev] || []).forEach((f) => f(data)); }
  });
  const c = {
    ws, states, opened,
    emit: (ev, data) => new Promise((resolve) => { const n = ++id; acks[n] = resolve; ws.send('42' + n + JSON.stringify([ev, data])); }),
    on: (ev, f) => { (handlers[ev] = handlers[ev] || []).push(f); },
    last: () => states[states.length - 1],
    until: async (pred, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = c.last(); if (s && pred(s)) return s; await new Promise((r) => setTimeout(r, 15)); } throw new Error('timed out waiting for state; last=' + JSON.stringify((c.last() || {}).phase)); },
    close: () => ws.close()
  };
  return c;
}

test('create, join, choose characters, ready up and start: real clients, one authoritative table', async () => {
  const s = await boot({ persist: false });
  try {
    const a = client(s.port), b = client(s.port);
    await a.opened; await b.opened;
    const ca = await a.emit('room:create', { name: 'Ann' });
    assert.ok(ca.ok && /^[A-Z]{4}$/.test(ca.code), 'a 4-letter room code'); assert.ok(ca.catalog && Object.keys(ca.catalog.locations).length === 42);
    assert.ok(!JSON.stringify(ca.catalog).includes('"ok"'), 'the catalog carries no outcomes');
    assert.ok((await b.emit('room:join', { code: 'ZZZZ', name: 'Bob' })).error, 'unknown code');
    const cb = await b.emit('room:join', { code: ca.code.toLowerCase(), name: 'Bob' });
    assert.ok(cb.ok, cb.error);
    await a.until((v) => v.players.length === 2);
    assert.ok((await a.emit('cmd', { t: 'start' })).error, 'nobody has picked');
    assert.ok(!(await a.emit('cmd', { t: 'pick', cls: 'occultist' })).error);
    assert.ok((await b.emit('cmd', { t: 'pick', cls: 'occultist' })).error, 'taken');
    assert.ok(!(await b.emit('cmd', { t: 'pick', cls: 'hunter' })).error);
    assert.ok((await b.emit('cmd', { t: 'start' })).error, 'only the host starts');
    await b.emit('cmd', { t: 'ready' });
    const r = await a.emit('cmd', { t: 'start' }); assert.ok(r.ok, r.error);
    const va = await a.until((v) => v.phase === 'playing'), vb = await b.until((v) => v.phase === 'playing');
    assert.equal(va.game.active, va.players[0].id);
    // secrets stay on the server: each sees only their own objective
    assert.ok(va.me.objective.text && vb.me.objective.text);
    assert.ok(!JSON.stringify(va).includes(vb.me.objective.text) || va.me.objective.id === vb.me.objective.id);
    assert.equal(vb.players.find((p) => p.id === va.you).revealed, null);
    assert.equal(va.world.secrets, undefined);
    // turn order is enforced by the server
    assert.ok((await b.emit('cmd', { t: 'move', mode: 'step', to: 'chapel' })).error, 'not B\'s turn');
    const mv = await a.emit('cmd', { t: 'move', mode: 'step', to: 'chapel' }); assert.ok(mv.ok, mv.error);
    const vb2 = await b.until((v) => v.players.find((p) => p.id === va.you).loc === 'chapel');
    assert.ok(vb2.log.some((e) => /Abandoned Chapel/.test(e.t)), 'B sees the same consequences');
    // a duplicate command id is not applied twice
    const c1 = await a.emit('cmd', { t: 'investigate', cid: 'x1' }), c2 = await a.emit('cmd', { t: 'investigate', cid: 'x1' });
    assert.ok(c1.ok && c2.dup);
    // a client that sends nonsense gets an error and the room survives
    assert.ok((await a.emit('cmd', { t: 'noop' })).error); assert.ok((await a.emit('cmd', 5)).error);
    a.close(); b.close();
  } finally { s.close(); }
});

test('a dropped player reconnects to the same seat and gets the full state back', async () => {
  const s = await boot({ persist: false });
  try {
    const a = client(s.port); await a.opened;
    const ca = await a.emit('room:create', { name: 'Ann' });
    await a.emit('cmd', { t: 'pick', cls: 'medium' }); await a.emit('cmd', { t: 'addbot' }); await a.emit('cmd', { t: 'start' });
    const before = await a.until((v) => v.phase === 'playing');
    a.close();
    await new Promise((r) => setTimeout(r, 100));
    const a2 = client(s.port); await a2.opened;
    assert.ok((await a2.emit('room:resume', { code: ca.code, playerId: ca.playerId, token: 'wrong' })).error, 'a wrong token is refused');
    const res = await a2.emit('room:resume', { code: ca.code, playerId: ca.playerId, token: ca.token });
    assert.ok(res.ok, res.error);
    const after = await a2.until((v) => v.phase === 'playing');
    assert.deepEqual(after.me.inv, before.me.inv); assert.equal(after.game.round, before.game.round);
    assert.ok(after.log.some((e) => /returned/.test(e.t)), 'the table is told');
    // opening the seat elsewhere replaces the old connection
    const a3 = client(s.port); await a3.opened; let closed = null; a2.on('closed', (d) => { closed = d; });
    assert.ok((await a3.emit('room:resume', { code: ca.code, playerId: ca.playerId, token: ca.token })).ok);
    await new Promise((r) => setTimeout(r, 100)); assert.equal(closed && closed.reason, 'replaced');
    a2.close(); a3.close();
  } finally { s.close(); }
});

test('expeditions survive a server restart', async () => {
  const s1 = await boot();
  const a = client(s1.port); await a.opened;
  const ca = await a.emit('room:create', { name: 'Ann' });
  await a.emit('cmd', { t: 'pick', cls: 'exorcist' }); await a.emit('cmd', { t: 'start' });
  await a.until((v) => v.phase === 'playing');
  await a.emit('cmd', { t: 'interact' });
  a.close();
  s1.game.close();   // writes the rooms file
  assert.ok(existsSync(join(s1.dataDir, 'rooms.json')));
  const saved = JSON.parse(readFileSync(join(s1.dataDir, 'rooms.json'), 'utf8'));
  assert.equal(saved.rooms.length, 1);
  // a new server on the same data directory
  const http2 = createServer(); const game2 = attach({ httpServer: http2, basePath: BASE, log: () => {}, dataDir: s1.dataDir });
  await new Promise((r) => http2.listen(0, r));
  try {
    const b = client(http2.address().port); await b.opened;
    const res = await b.emit('room:resume', { code: ca.code, playerId: ca.playerId, token: ca.token });
    assert.ok(res.ok, res.error);
    const v = await b.until((x) => x.phase === 'playing');
    assert.equal(v.me.cls, 'exorcist'); assert.ok(v.enc, 'even the open encounter is restored');
    b.close();
  } finally { game2.close(); http2.close(); s1.http.close(); rmSync(s1.dataDir, { recursive: true, force: true }); }
});

test('rooms that have ended or never existed give clear errors', async () => {
  const s = await boot({ persist: false });
  try {
    const a = client(s.port); await a.opened;
    assert.match((await a.emit('room:join', { code: 'NOPE', name: 'x' })).error, /No expedition/);
    assert.match((await a.emit('room:resume', { code: 'NOPE', playerId: 'p', token: 't' })).error, /seat is gone/);
    assert.match((await a.emit('cmd', { t: 'endturn' })).error, /not in an expedition/);
    // joining after the expedition has started is refused politely
    const ca = await a.emit('room:create', { name: 'Ann' }); await a.emit('cmd', { t: 'pick', cls: 'hunter' }); await a.emit('cmd', { t: 'start' });
    const b = client(s.port); await b.opened;
    assert.match((await b.emit('room:join', { code: ca.code, name: 'Late' })).error, /already set out/);
    a.close(); b.close();
  } finally { s.close(); }
});

test('a player who lost their seat key takes the seat back by joining with the same name', async () => {
  const s = await boot({ persist: false });
  try {
    const a = client(s.port), b = client(s.port); await a.opened; await b.opened;
    const ca = await a.emit('room:create', { name: 'Ann' });
    const cb = await b.emit('room:join', { code: ca.code, name: 'Bob' });
    await a.emit('cmd', { t: 'pick', cls: 'hunter' }); await b.emit('cmd', { t: 'pick', cls: 'medium' }); await b.emit('cmd', { t: 'ready' });
    assert.ok((await a.emit('cmd', { t: 'start' })).ok);
    await b.until((v) => v.phase === 'playing');
    const c = client(s.port); await c.opened;
    assert.match((await c.emit('room:join', { code: ca.code, name: 'Bob' })).error, /same name/, 'a seat whose player is here cannot be taken');
    b.close(); await new Promise((r) => setTimeout(r, 100));
    assert.match((await c.emit('room:join', { code: ca.code, name: 'Stranger' })).error, /same name/);
    const back = await c.emit('room:join', { code: ca.code, name: ' bob ' });
    assert.ok(back.ok, back.error); assert.equal(back.playerId, cb.playerId);
    const v = await c.until((x) => x.phase === 'playing' && x.you === cb.playerId);
    assert.equal(v.me.cls, 'medium');
    const old = client(s.port); await old.opened;
    assert.match((await old.emit('room:resume', { code: ca.code, playerId: cb.playerId, token: cb.token })).error, /seat is gone/, 'the old key no longer works');
    a.close(); c.close(); old.close();
  } finally { s.close(); }
});

test('a refreshed live seat is not announced as a return, and a server shutdown does not tell players the room closed', async () => {
  const s = await boot();
  const a = client(s.port); await a.opened;
  const ca = await a.emit('room:create', { name: 'Ann' });
  await a.emit('cmd', { t: 'pick', cls: 'hunter' }); await a.emit('cmd', { t: 'start' });
  await a.until((v) => v.phase === 'playing');
  const returns = () => a.last().log.filter((e) => /returned/.test(e.t)).length;
  const n0 = returns();
  assert.ok((await a.emit('room:resume', { code: ca.code, playerId: ca.playerId, token: ca.token })).ok);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(returns(), n0);
  let closed = null; a.on('closed', (d) => { closed = d; });
  s.game.close(); await new Promise((r) => setTimeout(r, 50));
  assert.equal(closed, null);
  assert.equal(JSON.parse(readFileSync(join(s.dataDir, 'rooms.json'), 'utf8')).rooms.length, 1, 'the room is saved for the restart');
  a.close(); s.http.close(); rmSync(s.dataDir, { recursive: true, force: true });
});

test('net-info gives this computer its Wi-Fi address for invite links', async () => {
  const s = await boot({ persist: false });
  try {
    const r = await fetch(`http://localhost:${s.port}${BASE}net-info`);
    assert.equal(r.status, 200);
    const j = await r.json(); assert.ok(Array.isArray(j.addresses)); assert.equal(j.port, s.port);
    assert.equal((await fetch(`http://localhost:${s.port}/other`)).status, 404, 'other requests still reach the hub');
  } finally { s.close(); }
});
