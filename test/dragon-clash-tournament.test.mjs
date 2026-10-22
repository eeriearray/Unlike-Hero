// Dragon Clash single-elimination brackets: byes, valid results only, and progression from real matches.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { Cup, Sim, Bot, Build } from './dragon-clash-helpers.mjs';

const field = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + (i + 1), name: 'P' + (i + 1) }));

test('seed order puts top seeds apart', () => {
  assert.deepEqual(Cup.seedOrder(4), [1, 4, 2, 3]);
  assert.deepEqual(Cup.seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
});

test('byes go to the top seeds and never pair two empty slots', () => {
  for (let n = 2; n <= 8; n++) {
    const t = Cup.create(field(n));
    const byes = t.rounds[0].filter((m) => m.bye);
    assert.equal(byes.length, t.size - n, n + ' players');
    for (const m of t.rounds[0]) assert.ok(m.a || m.b, 'no bye vs bye');
    const byeWinners = byes.map((m) => m.winner).sort();
    assert.deepEqual(byeWinners, field(n).slice(0, t.size - n).map((e) => e.id).sort(), 'top seeds get the byes');
  }
});

test('results must name a player in a playable match', () => {
  const t = Cup.create(field(4));
  const m = t.rounds[0][0];
  assert.throws(() => Cup.reportResult(t, m.id, 'p3'), /one of the two/);
  assert.throws(() => Cup.reportResult(t, t.rounds[1][0].id, 'p1'), /cannot take a result/);
  Cup.reportResult(t, m.id, m.a);
  assert.throws(() => Cup.reportResult(t, m.id, m.a), /cannot take a result/);
});

test('winners advance, losers are out, and the final crowns a champion', () => {
  const t = Cup.create(field(8));
  let guard = 0;
  while (t.status !== 'done' && guard++ < 20) {
    for (const m of Cup.readyMatches(t)) { Cup.start(t, m.id); Cup.reportResult(t, m.id, m.b); }
  }
  assert.equal(t.status, 'done');
  assert.equal(t.log.length, 7);
  assert.equal(t.entrants.filter((e) => !e.out).length, 1);
  assert.equal(t.entrants.find((e) => !e.out).id, t.champion);
  assert.throws(() => Cup.reportResult(t, t.rounds[2][0].id, t.champion), /over/);
});

test('a 3-dragon cup driven only by real simulated fights', () => {
  const ids = ['emberfang', 'ironmaw', 'tidefang'];
  const t = Cup.create(ids.map((id) => ({ id, name: id })));
  const finals = [];
  while (t.status !== 'done') {
    const m = Cup.readyMatches(t)[0];
    Cup.start(t, m.id);
    const sim = new Sim({ stocks: 1, timeLimit: 60 * 60 * 3, seed: 7, fighters: [{ build: Build.presetBuild(m.a), team: 0 }, { build: Build.presetBuild(m.b), team: 1 }] });
    const bots = [new Bot(sim, 0, { level: 3, seed: 1 }), new Bot(sim, 1, { level: 3, seed: 2 })];
    while (!sim.result) sim.step(bots.map((b) => b.think()));
    const w = sim.result.winnerTeam === 0 ? m.a : m.b;
    Cup.reportResult(t, m.id, w, { reason: sim.result.reason });
    finals.push(w);
  }
  assert.equal(t.champion, finals[finals.length - 1], 'the champion is whoever won the last real fight');
});
