// End-to-end tests for Trillioner's Battle Spend server over real WebSockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

process.env.TRILLIONER_DATA_DIR = mkdtempSync(join(tmpdir(), 'trillioner-'));
const { default: attach } = await import('../games/trillioner/server/index.mjs');
const require = createRequire(import.meta.url);
const { R } = require('../games/trillioner/engine/engine.js');
const { buildRun } = require('../games/trillioner/engine/shuffle.js');
const { B, M } = R;

async function startServer() {
  const http = createServer((req, res) => res.writeHead(404).end());
  const srv = attach({ httpServer: http, basePath: '/games/trillioner/', log: () => {} });
  await new Promise((r) => http.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${http.address().port}/games/trillioner/ws`;
  return { url, srv, close: () => new Promise((r) => { srv.close(); http.closeAllConnections?.(); http.close(r); }) };
}
function client(url) {
  const ws = new WebSocket(url);
  let rid = 0;
  const pending = new Map();
  const c = { ws, view: null, lobby: null, started: null, events: [], waiters: [], closed: null };
  const poke = () => { c.waiters = c.waiters.filter((w) => !w()); };
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.t === 'reply') { pending.get(m.rid)?.(m.res); pending.delete(m.rid); }
    if (m.t === 'state') { c.view = m.view; c.events.push(...m.events); }
    if (m.t === 'lobby') c.lobby = m.room;
    if (m.t === 'start') c.started = m;
    if (m.t === 'closed') c.closed = m.reason;
    poke();
  });
  c.open = new Promise((r) => ws.on('open', r));
  c.req = async (t, data = {}) => { await c.open; const id = ++rid; ws.send(JSON.stringify({ t, rid: id, ...data })); return new Promise((r) => pending.set(id, r)); };
  c.cmd = (cmd) => c.req('cmd', { cmd });
  c.pos = (p) => ws.send(JSON.stringify({ t: 'pos', x: p.x, y: p.y, z: p.z, h: 0 }));
  c.until = (fn, ms = 4000) => new Promise((res, rej) => {
    if (fn()) return res();
    const to = setTimeout(() => rej(new Error('timed out waiting')), ms);
    c.waiters.push(() => { if (fn()) { clearTimeout(to); res(); return true; } return false; });
  });
  c.close = () => ws.terminate();
  return c;
}
async function match(s, bots = 0) {
  const a = client(s.url), b = client(s.url);
  const ra = await a.req('create', { name: 'Ann' });
  const rb = await b.req('join', { code: ra.code, name: 'Bob' });
  for (let i = 0; i < bots; i++) await a.req('addBot');
  await a.req('start');
  await a.until(() => a.started && a.view);
  await b.until(() => b.started && b.view);
  return { a, b, ra, rb, run: buildRun(a.started.seed), room: s.srv.rooms.get(ra.code) };
}
async function waitFor(fn, what, ms = 12000) {
  const end = Date.now() + ms;
  while (!fn()) { if (Date.now() > end) throw new Error('timed out: ' + what); await new Promise((r) => setTimeout(r, 50)); }
}
const padOf = (run, id) => run.padPos[id];
async function goBuy(c, run, id) { c.pos(padOf(run, id)); await new Promise((r) => setTimeout(r, 30)); return c.cmd({ t: 'buy', item: id }); }

test('rooms: create, join by code, host starts, non-host cannot', async () => {
  const s = await startServer();
  const a = client(s.url), b = client(s.url);
  const r = await a.req('create', { name: 'Ann' });
  assert.match(r.code, /^[A-Z]{4}$/);
  assert.equal((await b.req('join', { code: 'ZZZZ', name: 'Bob' })).error, 'No room with that code.');
  assert.equal((await b.req('join', { code: r.code, name: 'Bob' })).ok, true);
  await a.until(() => a.lobby && a.lobby.seats.length === 2);
  assert.ok((await b.req('start')).error);
  await a.req('start');
  await b.until(() => b.started);
  assert.equal(b.started.seed, a.started.seed);
  a.close(); b.close();
  await s.close();
});

test('a room needs two seats, and bots can fill them', async () => {
  const s = await startServer();
  const a = client(s.url);
  await a.req('create', { name: 'Ann' });
  assert.ok((await a.req('start')).error);
  await a.req('addBot');
  assert.equal((await a.req('start')).ok, true);
  await a.until(() => a.view && a.view.board.length === 2 && a.view.board.some((p) => p.bot));
  assert.equal(a.view.me.balance, 300 * B);
  a.close();
  await s.close();
});

test('Battle Spend: $300B each, 1 in-game hour is 20 seconds, same seed for everyone', async () => {
  const s = await startServer();
  const { a, b, room } = await match(s);
  assert.equal(a.view.me.balance, 300 * B);
  assert.equal(room.game.cfg.secPerHour, 20);
  assert.equal(room.game.dayLengthMs(), 8 * 60 * 1000);
  a.close(); b.close();
  await s.close();
});

test('shared stock: if a rival buys the only one, nobody else can', async () => {
  const s = await startServer();
  const { a, b, run } = await match(s);
  assert.equal((await goBuy(a, run, 'car_dealership')).ok, true);
  const r = await goBuy(b, run, 'car_dealership');
  assert.equal(r.code, 'sold');
  await b.until(() => b.events.some((e) => e.type === 'purchase' && e.item === 'car_dealership'));
  await b.until(() => b.view.board.find((p) => p.name === 'Ann').spent >= 4 * B);
  a.close(); b.close();
  await s.close();
});

test('purchases are rejected when the player is not near the pad', async () => {
  const s = await startServer();
  const { a, b, run } = await match(s);
  const r = await a.cmd({ t: 'buy', item: 'car_dealership' });   // still at the spawn, far away
  assert.equal(r.code, 'far');
  assert.equal(a.view.me.spent, 0);
  a.pos(padOf(run, 'car_dealership'));
  await new Promise((res) => setTimeout(res, 30));
  assert.equal((await a.cmd({ t: 'buy', item: 'car_dealership' })).ok, true);
  a.close(); b.close();
  await s.close();
});

test('the server ignores bad input and never trusts the client for gated deals', async () => {
  const s = await startServer();
  const { a, b, run } = await match(s);
  a.ws.send('not json');
  a.ws.send(JSON.stringify({ t: 'pos', x: 'NaN', y: null, z: {} }));
  assert.ok((await a.cmd({ t: 'buy', item: 'no_such_item' })).error);
  assert.ok((await a.cmd(null)).error);
  assert.equal((await goBuy(a, run, 'soda_giant')).code, 'locked');         // takeovers need a licence
  assert.equal((await goBuy(a, run, 'brokers_licence')).code, 'hidden');    // secret deal not found yet
  assert.equal((await a.cmd({ t: 'bid', id: 'a0', amount: 1e15 })).code, 'closed');
  a.close(); b.close();
  await s.close();
});

test('reconnects: a dropped seat goes to a bot and comes back with its token', async () => {
  const s = await startServer();
  const { a, b, rb, room } = await match(s);
  assert.equal((await a.req('resume', { code: rb.code, playerId: rb.playerId, token: 'wrong' })).error, 'That seat is gone.');
  b.close();
  await a.until(() => room.seats.find((x) => x.id === rb.playerId).autopilot === true);
  const pl = room.game.players[rb.playerId];
  assert.equal(pl.connected, false);
  await waitFor(() => pl.spent > 0, 'the bot plays the dropped seat');
  const back = client(s.url);
  const res = await back.req('resume', { code: rb.code, playerId: rb.playerId, token: rb.token });
  assert.equal(res.ok, true);
  assert.equal(res.phase, 'playing');
  await back.until(() => back.view && back.view.me.id === rb.playerId);
  assert.equal(room.seats.find((x) => x.id === rb.playerId).autopilot, false);
  a.close(); back.close();
  await s.close();
});

test('win detection: first below $1M with income at or under zero wins, immediately', async () => {
  const s = await startServer();
  const { a, b, ra, room } = await match(s);
  room.game.players[ra.playerId].balance = 1 * M - 1;
  await a.until(() => a.view.over);
  assert.equal(a.view.result, 'win');
  assert.equal(a.view.winner, ra.playerId);
  assert.equal(a.view.results.winnerName, 'Ann');
  await b.until(() => b.view.over);
  assert.equal(b.view.winner, ra.playerId);
  a.close(); b.close();
  await s.close();
});

test('if nobody goes broke, the lowest balance wins when the day ends', async () => {
  const s = await startServer();
  const { a, b, ra, rb, room } = await match(s);
  room.game.players[ra.playerId].balance = 5 * B;
  room.game.players[rb.playerId].balance = 9 * B;
  room.game.t = room.game.dayLengthMs() - 200;
  await a.until(() => a.view.over);
  assert.equal(a.view.result, 'timeup');
  assert.equal(a.view.winner, ra.playerId);
  a.close(); b.close();
  await s.close();
});

test('auctions: open to all, highest bid pays', async () => {
  const s = await startServer();
  const { a, b, ra, rb, room } = await match(s);
  const auc = room.game.auctions[0];
  room.game.t = auc.at;                       // bring the first auction forward
  await a.until(() => a.view.auctions && a.view.auctions.length === 1);
  assert.equal((await a.cmd({ t: 'bid', id: auc.id, amount: auc.min - 1 })).code, 'low');
  assert.equal((await a.cmd({ t: 'bid', id: auc.id, amount: auc.min })).ok, true);
  assert.equal((await b.cmd({ t: 'bid', id: auc.id, amount: auc.min })).code, 'low');
  const top = auc.min + 1 * B;
  assert.equal((await b.cmd({ t: 'bid', id: auc.id, amount: top })).ok, true);
  const annBefore = room.game.players[ra.playerId].spent, bobBefore = room.game.players[rb.playerId].spent;
  auc.left = 1;
  await a.until(() => a.events.some((e) => e.type === 'auctionEnd'));
  assert.equal(room.game.players[rb.playerId].spent - bobBefore, top);
  assert.equal(room.game.players[ra.playerId].spent, annBefore);
  assert.equal(auc.winner, rb.playerId);
  a.close(); b.close();
  await s.close();
});

test('attack cards: found in the city, up to 3 a match, each does what it says', async () => {
  const s = await startServer();
  const { a, b, ra, rb, room } = await match(s);
  const g = room.game, pa = g.players[ra.playerId], pb = g.players[rb.playerId];
  const take = async (kind) => { const c = g.cardSpots.find((x) => x.kind === kind && !x.taken); a.pos(c); await new Promise((r) => setTimeout(r, 30)); return a.cmd({ t: 'pickup', id: c.id }); };
  const far = g.cardSpots.find((x) => Math.hypot(x.x - pa.x, x.z - pa.z) > 40);
  assert.equal((await a.cmd({ t: 'pickup', id: far.id })).code, 'far');
  assert.equal((await take('refund')).ok, true);
  const before = pb.balance;
  assert.equal((await a.cmd({ t: 'play', kind: 'refund', target: rb.playerId })).ok, true);
  assert.ok(pb.balance >= before + 3 * B);
  // Boost needs a losing company
  assert.equal((await take('boost')).ok, true);
  assert.equal((await a.cmd({ t: 'play', kind: 'boost', target: rb.playerId })).code, 'none');
  g.buy(rb.playerId, 'steel_mill_biz') ;
  pb.owned.steel_mill_biz = { paid: 9 * B, closing: false, demolished: false };
  const lossy = g.bizIncome(pb);
  assert.equal((await a.cmd({ t: 'play', kind: 'boost', target: rb.playerId })).ok, true);
  assert.ok(g.bizIncome(pb) > lossy);
  // Forced Gift can be refused for $1B, and is once per match
  assert.equal((await take('gift')).ok, true);
  assert.equal(pa.cards.length + pa.cardsUsed, 3);
  const third = g.cardSpots.find((x) => !x.taken);
  a.pos(third); await new Promise((r) => setTimeout(r, 30));
  assert.equal((await a.cmd({ t: 'pickup', id: third.id })).code, 'full');
  const annBal = pa.balance, bobBal = pb.balance;
  assert.equal((await a.cmd({ t: 'play', kind: 'gift', target: rb.playerId })).ok, true);
  await b.until(() => b.events.some((e) => e.type === 'giftOffer'));
  assert.equal((await b.cmd({ t: 'refuse' })).ok, true);
  assert.ok(pb.balance <= bobBal - 1 * B + 200 * M);
  assert.ok(pa.balance >= annBal);   // the gift never left
  a.close(); b.close();
  await s.close();
});

test('Ban closes a shop to one rival only, for 45 seconds', async () => {
  const s = await startServer();
  const { a, b, ra, rb, run, room } = await match(s);
  const g = room.game, c = g.cardSpots.find((x) => x.kind === 'ban');
  a.pos(c); await new Promise((r) => setTimeout(r, 30));
  await a.cmd({ t: 'pickup', id: c.id });
  const site = run.items.car_dealership.site;
  assert.equal((await a.cmd({ t: 'play', kind: 'ban', target: rb.playerId, site })).ok, true);
  assert.equal((await goBuy(b, run, 'car_dealership')).code, 'banned');
  assert.equal((await goBuy(a, run, 'car_dealership')).ok, true);
  a.close(); b.close();
  await s.close();
});

test('a secret deal found by one player stays hidden from the others until bought', async () => {
  const s = await startServer();
  const { a, b, ra, rb, run, room } = await match(s);
  const g = room.game, door = run.secrets.broker_alley.pos;
  a.pos(door); b.pos(door);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal((await a.cmd({ t: 'discover', id: 'broker_alley' })).ok, true);
  assert.equal(g.players[ra.playerId].flags.broker_shop, true);
  assert.equal(g.players[rb.playerId].flags.broker_shop, undefined);
  assert.equal((await goBuy(b, run, 'brokers_licence')).code, 'hidden');
  assert.equal((await goBuy(a, run, 'brokers_licence')).ok, true);
  assert.equal((await goBuy(b, run, 'brokers_licence')).code, 'sold');   // bought: now everyone can see it went
  a.close(); b.close();
  await s.close();
});

test('bots spend real money and appear on the leaderboard', async () => {
  const s = await startServer();
  const { a, b, room } = await match(s, 2);
  const bots = room.seats.filter((x) => x.bot).map((x) => room.game.players[x.id]);
  assert.equal(bots.length, 2);
  await waitFor(() => bots.every((p) => p.spent > 0), 'both bots spend');
  assert.equal(a.view.board.length, 4);
  a.close(); b.close();
  await s.close();
});

test('property damage goes through the server, as spending, with the lower Battle cap', async () => {
  const s = await startServer();
  const { a, b, ra, room } = await match(s);
  const p = room.game.players[ra.playerId];
  const before = p.spent;
  assert.equal((await a.cmd({ t: 'damage', kind: 'car' })).paid, 200 * M);
  assert.equal(p.spent - before, 200 * M);
  p.damagePaid = R.DAMAGE_CAP_PVP;
  assert.equal((await a.cmd({ t: 'damage', kind: 'car' })).paid, 0);
  a.close(); b.close();
  await s.close();
});

test('Daily City board: submit and read back, sorted', async () => {
  const s = await startServer();
  const a = client(s.url);
  await a.req('daily', { day: '2026-11-03', entry: { name: 'Low', spent: 5 * B, win: null } });
  const r = await a.req('daily', { day: '2026-11-03', entry: { name: 'High', spent: 9 * B, win: 600000 } });
  assert.equal(r.ok, true);
  assert.equal(r.list[0].name, 'High');
  assert.equal(r.list[1].name, 'Low');
  assert.ok((await a.req('daily', { day: 'nope', entry: {} })).error);
  a.close();
  await s.close();
});
