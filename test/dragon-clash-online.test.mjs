// Dragon Clash online server: separate WebSocket clients create and join rooms, the server rejects bad builds,
// runs the match itself and reports the result; a cup advances only from finished server matches.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import WebSocket from 'ws';
import attach from '../games/dragon-clash/server/index.mjs';
import { Build, plain } from './dragon-clash-helpers.mjs';

let http, port;
test.before(async () => {
  http = createServer((req, res) => res.end());
  attach({ httpServer: http, basePath: '/games/dragon-clash/', log: () => {}, tickMs: 0.02, graceMs: 200 });
  await new Promise((r) => http.listen(0, r));
  port = http.address().port;
});
test.after(() => { http.closeAllConnections(); http.close(); });

function client() {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${port}/games/dragon-clash/ws`);
    ws.got = [];
    ws.waiters = [];
    ws.on('message', (d) => {
      const m = JSON.parse(String(d));
      if (m.t !== 'snap') ws.got.push(m);
      else { ws.snaps = (ws.snaps || 0) + 1; ws.last = m.s; }
      ws.waiters = ws.waiters.filter((w) => !(w.pred(m) && (w.res(m), true)));
    });
    ws.do = (o) => ws.send(JSON.stringify(o));
    ws.wait = (pred, ms = 15000) => new Promise((res, rej) => {
      const hit = ws.got.find(pred);
      if (hit) { ws.got.splice(ws.got.indexOf(hit), 1); return res(hit); }
      const t = setTimeout(() => rej(new Error('timeout')), ms);
      ws.waiters.push({ pred, res: (m) => { clearTimeout(t); ws.got.splice(ws.got.indexOf(m), 1); res(m); } });
    });
    ws.on('open', () => resolve(ws));
  });
}
const type = (t, more = () => true) => (m) => m.t === t && more(m);

test('two clients play a versus match the server runs and decides', async () => {
  const a = await client(), b = await client();
  a.do({ t: 'create', mode: 'versus', name: 'Ann' });
  const ja = await a.wait(type('joined'));
  b.do({ t: 'join', code: ja.code, name: 'Bob' });
  await b.wait(type('joined'));

  const over = plain('ice', { body: 'titan', mobility: 'dasher', signature: 'glacierLance', ability: 'frostWall', upgrade: 'ironWill' });
  a.do({ t: 'build', build: over });
  assert.match((await a.wait(type('error'))).msg, /Build rejected/);

  a.do({ t: 'build', build: Build.presetBuild('emberfang') });
  b.do({ t: 'build', build: Object.assign(Build.presetBuild('tidefang'), { weight: 999 }) });
  b.do({ t: 'team', team: 1 });
  a.do({ t: 'ready', ready: true }); b.do({ t: 'ready', ready: true });
  await a.wait(type('room', (m) => m.room.members.length === 2 && m.room.members.every((x) => x.ready)));
  b.do({ t: 'start' });
  assert.match((await b.wait(type('error'))).msg, /host/);
  a.do({ t: 'start' });
  const ma = await a.wait(type('match')), mb = await b.wait(type('match'));
  assert.equal(ma.match.id, mb.match.id);
  assert.notEqual(ma.you, mb.you);
  assert.ok(!('weight' in ma.match.setup.fighters[mb.you].build), 'tampered fields never reach the match');

  await new Promise((r) => setTimeout(r, 50));
  b.do({ t: 'forfeit' });
  const ea = await a.wait(type('end'));
  assert.equal(ea.result.winnerTeam, ma.match.setup.fighters[ma.you].team);
  assert.ok(a.snaps > 0 && b.snaps > 0, 'both clients received snapshots');
  a.close(); b.close();
});

test('a dropped player rejoins with their token', async () => {
  const a = await client();
  a.do({ t: 'create', mode: 'versus', name: 'Ann' });
  const j = await a.wait(type('joined'));
  a.close();
  const a2 = await client();
  a2.do({ t: 'join', code: j.code, token: j.token });
  const r = await a2.wait(type('joined'));
  assert.equal(r.you, j.you);
  assert.ok(r.rejoined);
  a2.close();
});

test('an online cup with CPUs advances only from server-run matches', async () => {
  const a = await client();
  a.do({ t: 'create', mode: 'cup', name: 'Ann', build: Build.presetBuild('voltscale') });
  await a.wait(type('joined'));
  for (const lv of [1, 2, 3]) a.do({ t: 'bot', op: 'add', level: lv });
  await a.wait(type('room', (m) => m.room.members.length === 4));
  a.do({ t: 'ready', ready: true });
  a.do({ t: 'start' });
  await a.wait(type('match'));
  const cupStart = await a.wait(type('room', (m) => m.room.cup && m.room.cup.rounds[0].every((x) => x.status === 'live')));
  assert.equal(cupStart.room.cup.rounds[0].length, 2);
  a.do({ t: 'forfeit' });
  await a.wait(type('end'));
  const done = await a.wait(type('room', (m) => m.room.state === 'done'), 30000);
  const t = done.room.cup;
  assert.equal(t.status, 'done');
  assert.ok(t.champion && t.champion !== done.you);
  assert.equal(t.log.length, 3);
  a.close();
});

/** A 1v1 against a server-filled CPU; resolves once the match has started for `a`. */
async function soloMatch(build) {
  const a = await client();
  a.do({ t: 'create', mode: 'versus', name: 'Solo', build, tapJump: true });
  await a.wait(type('joined'));
  a.do({ t: 'ready', ready: true });
  await a.wait(type('room', (m) => m.room.members.some((x) => x.ready)));
  a.do({ t: 'start' });
  const mt = await a.wait(type('match'));
  return { a, mt };
}
const until = (pred, ms = 8000) => new Promise((res, rej) => { const t0 = Date.now(); (function poll() { if (pred()) return res(); if (Date.now() - t0 > ms) return rej(new Error('timeout')); setTimeout(poll, 5); })(); });

test('online: holding Guard reaches the server (it sits above the first ten button bits)', async () => {
  const { a, mt } = await soloMatch(Build.presetBuild('frostwing-hd'));
  a.do({ t: 'input', h: 1024, c: {} });
  await until(() => a.last && a.last.cd === 0 && a.last.f[mt.you].st === 'guard');
  a.close();
});

test('online: the very first press of a button counts', async () => {
  const { a, mt } = await soloMatch(Build.presetBuild('emberfang-hd'));
  await until(() => a.last && a.last.cd === 0);
  a.do({ t: 'input', h: 0, c: { jump: 1 } });
  await until(() => a.last && !a.last.f[mt.you].gr);
  a.close();
});

test('online: CPUs are painted sprite dragons, and a mirror match gets a recolour', async () => {
  const { a, mt } = await soloMatch(Build.presetBuild('voltscale-hd'));
  const [me, cpu] = mt.match.setup.fighters;
  assert.ok(cpu.build.look.sprite, 'the CPU uses a sprite dragon');
  if (cpu.build.id === me.build.id) assert.notEqual(cpu.build.look.tint || '', me.build.look.tint || '');
  a.close();
  const b = await client(), c = await client();
  b.do({ t: 'create', mode: 'versus', name: 'B', build: Build.presetBuild('tidefang-hd') });
  const jb = await b.wait(type('joined'));
  c.do({ t: 'join', code: jb.code, name: 'C', build: Build.presetBuild('tidefang-hd') });
  await c.wait(type('joined'));
  c.do({ t: 'team', team: 1 }); b.do({ t: 'ready', ready: true }); c.do({ t: 'ready', ready: true });
  await b.wait(type('room', (m) => m.room.members.length === 2 && m.room.members.every((x) => x.ready) && m.room.members.some((x) => x.team === 1)));
  b.do({ t: 'start' });
  const m2 = await b.wait(type('match'));
  const [f1, f2] = m2.match.setup.fighters;
  assert.equal(f1.build.id, f2.build.id);
  assert.notEqual(f1.build.look.tint || '', f2.build.look.tint || '', 'identical dragons on opposing sides are told apart');
  b.close(); c.close();
});
