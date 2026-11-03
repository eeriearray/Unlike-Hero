// Solvability, difficulty, determinism and reachability over many generated cities.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Bot = require('../games/trillioner/engine/bot.js');
const { Game, R } = require('../games/trillioner/engine/engine.js');
const { buildRun } = require('../games/trillioner/engine/shuffle.js');
const Secrets = require('../games/trillioner/engine/data/secrets.js');
const D = require('../games/trillioner/engine/data/districts.js');
const { B } = R;
const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);

test('solver: for 100 seeds a bot that knows the secrets wins inside 24:00', () => {
  const failed = [];
  for (const s of SEEDS) {
    const r = Bot.playDay(s, Bot.knowsSecrets);
    if (!r.won || r.ms > 24 * 60000) failed.push(s);
  }
  assert.deepEqual(failed, []);
});

test('difficulty: for 100 seeds a visible-only bot ends with at least $400B left', () => {
  for (const s of SEEDS) {
    const r = Bot.playDay(s, Bot.visibleOnly);
    assert.equal(r.won, false, `seed ${s}`);
    assert.ok(r.left >= 400 * B, `seed ${s} left ${r.left / B}`);
  }
});

test('difficulty: an all-earners bot that never demolishes does not win', () => {
  for (const s of SEEDS) {
    const r = Bot.playDay(s, Bot.allEarners);
    assert.equal(r.won, false, `seed ${s}`);
    assert.equal(r.demolished, 0);
    assert.ok(r.income > 0, `seed ${s}`);
  }
});

test('determinism: same seed and commands give identical results', () => {
  const sig = (r) => JSON.stringify([r.player.balance, r.player.spent, r.ms, r.player.history, Object.keys(r.player.owned), Object.keys(r.player.flags)]);
  for (const s of [1, 42, 77]) {
    assert.equal(sig(Bot.playDay(s, Bot.knowsSecrets)), sig(Bot.playDay(s, Bot.knowsSecrets)));
    assert.equal(sig(Bot.playDay(s, Bot.visibleOnly)), sig(Bot.playDay(s, Bot.visibleOnly)));
  }
  assert.deepEqual(buildRun(9).list.map((i) => i.price), buildRun(9).list.map((i) => i.price));
});

test('shuffling really changes the city, and budgets stay exact on every seed', () => {
  const a = buildRun(1), b = buildRun(2);
  assert.notDeepEqual(a.list.map((i) => i.price), b.list.map((i) => i.price));
  assert.notDeepEqual(a.events, b.events);
  assert.notDeepEqual(a.fog, b.fog);
  assert.notDeepEqual(Object.values(a.secrets).map((s) => s.clueText), Object.values(b.secrets).map((s) => s.clueText));
  assert.notDeepEqual(Object.values(a.secrets).map((s) => s.pos), Object.values(b.secrets).map((s) => s.pos));
  for (const s of SEEDS) {
    const run = buildRun(s);
    const sum = {};
    for (const i of run.list) if (!i.surprise) { sum[i.district] = (sum[i.district] || 0) + i.price * i.stock; assert.ok(i.price > 0, `${s} ${i.id}`); }
    for (const [k, d] of Object.entries(D.DISTRICTS)) assert.equal(sum[k], d.budget, `seed ${s} ${k}`);
    const changed = run.list.filter((i) => i.flex).length;
    assert.ok(changed > 200);
    assert.ok(run.events.length >= 2 && run.events.length <= 4);
    assert.equal(run.fog.length, 3);
  }
});

test('at least 20 chains and at least 3 secrets in every district', () => {
  const chains = new Set(Secrets.SECRETS.map((s) => s.chain));
  assert.ok(chains.size >= 20, String(chains.size));
  for (const need of ['clock_tower', 'mr_grey', 'sunken_vault', 'asteroid', 'corner_towers', 'tuxedo', 'broker', 'lobbyist']) assert.ok(chains.has(need), need);
  for (const k of Object.keys(D.DISTRICTS)) assert.ok(Secrets.SECRETS.filter((s) => s.district === k).length >= 3, k);
});

test('reachability: everything can be reached with things obtainable in that run', () => {
  for (const seed of [1, 2, 3, 4, 5, 50, 99]) {
    const g = new Game({ seed });
    const p = g.players.p1;
    p.balance = 1e15;
    const list = g.run.list.filter((i) => !i.surprise), done = new Set();
    const ignoreTime = (gate) => (gate || []).filter((x) => !x.hours && !x.weather && !x.window);
    for (let pass = 0; pass < 30; pass++) {
      let moved = false;
      for (const it of list) {
        if (done.has(it.id) || (it.secret && !p.flags[it.secret]) || g.gateFails(p, ignoreTime(it.gate))) continue;
        done.add(it.id); moved = true;
        p.owned[it.id] = { paid: it.price, closing: false, demolished: false };
        (it.reward && it.reward.vehicles || []).forEach((v) => { p.vehicles[v] = true; });
        if (it.wearable) p.wear[it.wearable] = true;
        if (it.power) p.powers[it.power] = true;
      }
      for (const [k, s] of Object.entries(g.run.secrets)) {
        if (p.flags['s:' + k] || g.gateFails(p, ignoreTime(s.gate))) continue;
        p.flags['s:' + k] = true; (s.opens || []).forEach((f) => { p.flags[f] = true; }); moved = true;
      }
      if (!moved) break;
    }
    const missing = list.filter((i) => !done.has(i.id)).map((i) => i.id);
    assert.deepEqual(missing, [], `seed ${seed}`);
    const unfound = Object.keys(g.run.secrets).filter((k) => !p.flags['s:' + k]);
    assert.deepEqual(unfound, [], `seed ${seed}`);
  }
});

test('the game never exposes a count of undiscovered secrets', () => {
  const g = new Game({ seed: 3 });
  const res = g.results('p1');
  assert.equal(res.secrets, 0);
  assert.ok(!('secretsLeft' in res) && !('total' in res));
});

test('hints count as spending and are not the whole answer', () => {
  const g = new Game({ seed: 3 });
  const p = g.players.p1;
  p.flags.under = true;
  const before = p.spent;
  const r = g.buy('p1', 'hint_grey_a');
  assert.equal(r.ok, true);
  assert.equal(p.spent - before, 2 * B);
  const ev = g.drain('p1').filter((e) => e.type === 'hint');
  assert.equal(ev.length, 1);
});
