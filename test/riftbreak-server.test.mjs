// End-to-end tests for RIFTBREAK's online server (games/riftbreak/server/index.mjs) over real WebSockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import attach from '../games/riftbreak/server/index.mjs';

async function startServer() {
  const http = createServer((req, res) => res.writeHead(404).end());
  const srv = attach({ httpServer: http, basePath: '/games/riftbreak/', log: () => {} });
  await new Promise((r) => http.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${http.address().port}/games/riftbreak/ws`;
  return { url, srv, close: () => new Promise((r) => { srv.close(); http.closeAllConnections?.(); http.close(r); }) };
}

/** A tiny client: request/reply by rid, and the latest pushed view. */
function client(url) {
  const ws = new WebSocket(url);
  let rid = 0;
  const pending = new Map();
  const c = { ws, view: null, views: [], closed: null, waiters: [] };
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.t === 'reply') { pending.get(m.rid)?.(m.res); pending.delete(m.rid); }
    if (m.t === 'state') { c.view = m.view; c.views.push(m.view); c.waiters = c.waiters.filter((w) => !w(m.view)); }
    if (m.t === 'closed') c.closed = m.reason;
  });
  c.open = new Promise((r) => ws.on('open', r));
  c.req = async (t, data = {}) => { await c.open; const id = ++rid; ws.send(JSON.stringify({ t, rid: id, ...data })); return new Promise((r) => pending.set(id, r)); };
  c.cmd = (cmd) => c.req('cmd', { cmd });
  c.until = (pred, ms = 3000) => new Promise((resolve, reject) => {
    if (c.view && pred(c.view)) return resolve(c.view);
    const timer = setTimeout(() => reject(new Error('timed out waiting for state')), ms);
    c.waiters.push((v) => { if (pred(v)) { clearTimeout(timer); resolve(v); return true; } return false; });
  });
  c.close = () => ws.close();
  return c;
}

test('create, join by code, host-only settings, start with bots; each player sees only their own hand', async () => {
  const s = await startServer();
  const a = client(s.url), b = client(s.url);
  const ra = await a.req('create', { name: 'Ada' });
  assert.ok(ra.ok && /^[A-Z]{4}$/.test(ra.code));
  const rb = await b.req('join', { code: ra.code.toLowerCase(), name: 'Bo' });
  assert.ok(rb.ok);
  assert.ok((await b.cmd({ type: 'settings', settings: { seats: 4 } })).error);
  assert.ok((await a.cmd({ type: 'settings', settings: { seats: 4, botLevel: 'easy' } })).ok);
  assert.ok((await a.cmd({ type: 'start' })).ok);
  const va = await a.until((v) => v.phase === 'playing' && v.match);
  const vb = await b.until((v) => v.phase === 'playing' && v.match);
  assert.equal(va.seats.length, 4);
  assert.equal(va.match.hand.length, 7);
  const aIds = new Set(va.match.hand.map((c) => c.id));
  for (const c of vb.match.hand) assert.ok(!aIds.has(c.id));
  // The raw frames for B never contain A's card ids in a hand.
  for (const v of b.views) if (v.match && v.match.hand) for (const c of v.match.hand) assert.ok(!aIds.has(c.id) || v.match.top.id === c.id);
  assert.equal(va.match.hands, undefined);
  a.close(); b.close();
  await s.close();
});

test('illegal, out-of-turn and duplicate commands are refused by the server', async () => {
  const s = await startServer();
  const a = client(s.url), b = client(s.url);
  const { code } = await a.req('create', { name: 'A' });
  await b.req('join', { code, name: 'B' });
  await a.cmd({ type: 'settings', settings: { seats: 2 } });
  await a.cmd({ type: 'start' });
  const v = await a.until((x) => x.match);
  const me = v.match.turn === v.you ? a : b;
  const other = me === a ? b : a;
  const mv = await me.until((x) => x.match);
  const ov = await other.until((x) => x.match);
  assert.match((await other.cmd({ type: 'draw' })).error, /not your turn/);
  const illegal = mv.match.hand.find((c) => !mv.match.legal.includes(c.id));
  if (illegal) assert.ok((await me.cmd({ type: 'play', card: illegal.id, color: 'cyan', v: mv.match.version })).error);
  assert.ok((await me.cmd({ type: 'play', card: ov.match.hand[0].id, color: 'cyan' })).error, 'cannot play a card from someone else’s hand');
  const first = await me.cmd({ type: 'draw', v: mv.match.version });
  assert.ok(first.ok);
  const dup = await me.cmd({ type: 'draw', v: mv.match.version });
  assert.ok(dup.error, 'the duplicate draw is rejected');
  assert.ok((await me.cmd({ type: 'nonsense' })).error);
  a.close(); b.close();
  await s.close();
});

test('a dropped player resumes their seat with the token and gets their hand back', async () => {
  const s = await startServer();
  const a = client(s.url);
  const seat = await a.req('create', { name: 'A' });
  await a.cmd({ type: 'settings', settings: { seats: 3, botSpeed: 'relaxed' } });
  await a.cmd({ type: 'start' });
  const before = await a.until((v) => v.match);
  a.ws.terminate();
  await new Promise((r) => setTimeout(r, 100));
  const room = s.srv.rooms.get(seat.code);
  assert.equal(room.game.seat(seat.playerId).connected, false);
  const a2 = client(s.url);
  assert.ok((await a2.req('resume', { code: seat.code, playerId: seat.playerId, token: 'wrong' })).error);
  const res = await a2.req('resume', { code: seat.code, playerId: seat.playerId, token: seat.token });
  assert.ok(res.ok);
  const after = await a2.until((v) => v.match);
  assert.equal(after.you, seat.playerId);
  assert.ok(after.match.hand.length >= 1);
  assert.equal(after.match.events.length > 0, true, 'a resumed client gets the recent event log');
  assert.equal(room.game.seat(seat.playerId).connected, true);
  void before;
  a2.close();
  await s.close();
});

test('opening the same seat in a second tab replaces the first', async () => {
  const s = await startServer();
  const a = client(s.url);
  const seat = await a.req('create', { name: 'A' });
  const tab2 = client(s.url);
  assert.ok((await tab2.req('resume', seat)).ok);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(a.closed, 'replaced');
  tab2.close(); a.close();
  await s.close();
});

test('unknown room codes and malformed frames are handled', async () => {
  const s = await startServer();
  const a = client(s.url);
  assert.match((await a.req('join', { code: 'ZZZZ', name: 'x' })).error, /No room/);
  a.ws.send('not json');
  a.ws.send(JSON.stringify([1, 2, 3]));
  assert.match((await a.cmd({ type: 'start' })).error, /not in a room/);
  a.close();
  await s.close();
});

test('a lobby empties and closes when its only player leaves', async () => {
  const s = await startServer();
  const a = client(s.url);
  const { code } = await a.req('create', { name: 'A' });
  assert.ok(s.srv.rooms.has(code));
  await a.req('leave');
  assert.equal(s.srv.rooms.has(code), false);
  a.close();
  await s.close();
});
