// Ledger and win rules for Trillioner. Money is integer cents; these lock the exact arithmetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Game, quote, closeMs, R } = require('../games/trillioner/engine/engine.js');
const { B, M, T } = R;

const fresh = (o = {}) => new Game({ seed: 7, mode: 'day', ...o });
const steps = (g, n) => { for (let i = 0; i < n; i++) g.step(); };

test('the run starts at exactly $1T in integer cents', () => {
  const g = fresh();
  assert.equal(g.players.p1.balance, 1e14);
  assert.ok(Number.isSafeInteger(g.players.p1.balance));
});

test('interest is exact: balance / 120000 per step with the remainder carried', () => {
  const g = fresh();
  const p = g.players.p1;
  p.balance = 123456789012345;
  let bal = p.balance, rem = 0;
  for (let i = 0; i < 600; i++) {
    rem += bal % 120000;
    let gain = Math.floor(bal / 120000);
    if (rem >= 120000) { gain += 1; rem -= 120000; }
    bal += gain;
  }
  steps(g, 600);
  assert.equal(p.balance, bal);
  assert.ok(Number.isSafeInteger(p.balance));
});

test('$1T earns about $83M per real second at the start', () => {
  const g = fresh();
  assert.equal(g.interestPerS(g.players.p1), Math.floor(1e14 / 120000) * 10);
  const dollars = g.interestPerS(g.players.p1) / 100;
  assert.ok(Math.abs(dollars - 83.33e6) < 0.01e6, String(dollars));
});

test('no interest below $1B', () => {
  const g = fresh();
  const p = g.players.p1;
  p.balance = 1 * B - 1;
  steps(g, 100);
  assert.equal(p.balance, 1 * B - 1);
});

test('frame rate does not change results: tick partitions agree', () => {
  const a = fresh(), b = fresh();
  a.tick(30);
  for (let i = 0; i < 1800; i++) b.tick(1 / 60);
  // floating point leaves at most one step of difference in accumulated time; compare after matching step count
  while (b.t < a.t) b.step();
  assert.equal(a.t, b.t);
  assert.equal(a.players.p1.balance, b.players.p1.balance);
});

test('buying takes money at once and adds to spent', () => {
  const g = fresh();
  const p = g.players.p1;
  const r = g.buy('p1', 'car_dealership');
  assert.equal(r.ok, true);
  assert.equal(p.balance, 1e14 - 4 * B);
  assert.equal(p.spent, 4 * B);
  assert.equal(g.stock.car_dealership, 0);
  assert.equal(g.buy('p1', 'car_dealership').code, 'sold');
});

test('unaffordable purchases fail with no debt', () => {
  const g = fresh();
  const p = g.players.p1;
  p.balance = 1 * B;
  const r = g.buy('p1', 'car_dealership');
  assert.equal(r.error, 'Too expensive');
  assert.equal(p.balance, 1 * B);
  assert.equal(p.spent, 0);
});

test('Frenzy climbs one step per purchase in the window and resets when it lapses', () => {
  const g = fresh();
  const p = g.players.p1;
  assert.equal(g.buy('p1', 'scrapyard_biz').mult, 1);   // $1B, starts the window
  assert.equal(p.frenzy, 1);
  assert.equal(g.buy('p1', 'fireworks_factory').mult, 1); // within 5s: climbs to x2 for the next one
  assert.equal(p.frenzy, 2);
  const r = g.buy('p1', 'car_dealership');                // pays x2
  assert.equal(r.mult, 2);
  assert.equal(r.extra, 2 * B);                           // capped at $2B ($4B x 1 would be $4B extra)
  assert.equal(p.frenzy, 3);
  steps(g, 50);
  assert.equal(p.frenzy, 1);
});

test('Frenzy extra is capped at $2B and falls back to the highest affordable multiplier', () => {
  const q = quote(100 * B, 5, 1 * T);
  assert.equal(q.extra, 2 * B);
  assert.equal(q.total, 102 * B);
  const q2 = quote(1 * B, 5, 2.5 * B);   // x3 to x5 all cost $3B with the cap; x2 at $2B is the highest that fits
  assert.equal(q2.mult, 2);
  assert.equal(q2.total, 2 * B);
  const q3 = quote(1 * B, 5, 0.5 * B);
  assert.equal(q3.ok, false);
});

test('purchases under $100M neither build nor pay Frenzy', () => {
  const q = quote(99 * M, 5, 1 * T);
  assert.equal(q.mult, 1);
  assert.equal(q.total, 99 * M);
  const g = fresh();
  g.buy('p1', 'ind_change_0');
  assert.equal(g.players.p1.frenzy, 1);
  assert.equal(g.players.p1.frenzyLeft, 0);
});

test('big deals close in 10 to 30 seconds; money leaves first and income starts at closing', () => {
  assert.equal(closeMs(10 * B), 10000);
  assert.equal(closeMs(100 * B), 30000);
  assert.equal(closeMs(500 * B), 30000);
  assert.equal(closeMs(9 * B), 0);
  const g = fresh();
  const p = g.players.p1;
  g.buy('p1', 'demolition_company');   // $10B, 10s, +$8M/s
  assert.equal(p.balance, 1e14 - 10 * B);
  assert.equal(g.bizIncome(p), 0);
  assert.equal(p.vehicles.wrecking_truck, undefined);
  steps(g, 100);
  assert.equal(g.bizIncome(p), 8 * M);
  assert.equal(p.vehicles.wrecking_truck, true);
});

test('demolition costs exactly 40% of the purchase price, 32% with the wrecking truck, and ends income', () => {
  const g = fresh();
  const p = g.players.p1;
  g.buy('p1', 'car_dealership');
  p.frenzy = 1; p.frenzyLeft = 0;
  const before = p.balance, spent = p.spent;
  const r = g.demolish('p1', 'car_dealership');
  assert.equal(r.fee, 1.6 * B);
  assert.equal(p.balance, before - 1.6 * B);
  assert.equal(p.spent, spent + 1.6 * B);
  assert.equal(g.bizIncome(p), 0);
  assert.equal(p.vehicles.sports_car, true);    // vehicles stay
  assert.equal(g.demolish('p1', 'car_dealership').code, 'rubble');

  g.buy('p1', 'race_track');
  p.vehicles.wrecking_truck = true;
  p.frenzy = 1; p.frenzyLeft = 0;
  assert.equal(g.demolish('p1', 'race_track', true).fee, 1.92 * B);
});

test('balance never goes below zero from losses', () => {
  const g = fresh();
  const p = g.players.p1;
  g.buy('p1', 'steel_mill_biz');
  p.frenzyLeft = 0; p.frenzy = 1;
  p.balance = 5 * M;       // losing $9M/s
  p.won = true;            // keep the economy running past the win so the floor is what's under test
  for (const c of p.closings) c.leftMs = 0;
  p.closings.length = 0; p.owned.steel_mill_biz.closing = false;
  steps(g, 20);
  assert.equal(p.balance, 0);
});

test('win: below $1M with positive income does not win', () => {
  const g = fresh();
  const p = g.players.p1;
  g.buy('p1', 'car_dealership');
  p.balance = 1000;
  steps(g, 1);
  assert.equal(p.won, false);
  assert.equal(g.over, false);
});

test('win: below $1M with income at or under zero wins, then opens the frozen 60-second Perfect Zero window', () => {
  const g = fresh();
  const p = g.players.p1;
  p.balance = 1 * M - 1;
  steps(g, 1);
  assert.equal(p.won, true);
  assert.equal(g.frozen, true);
  assert.equal(g.over, false);
  const t = g.t;
  steps(g, 10);
  assert.equal(g.t, t);          // clock frozen
  assert.equal(p.perfectLeft, 60000 - 1000);
  steps(g, 600);
  assert.equal(g.over, true);
  assert.equal(g.result, 'win');
  assert.equal(p.perfect, false);
});

test('Perfect Zero needs exactly $0.00 and exactly zero income', () => {
  const g = fresh();
  const p = g.players.p1;
  p.balance = 37;
  steps(g, 1);                   // wins at 37 cents with zero income
  assert.equal(p.won, true);
  assert.equal(g.toss('p1').paid, 12);
  assert.equal(p.balance, 25);
  g.buy('p1', 'ind_change_0');   // $0.25
  assert.equal(p.balance, 0);
  steps(g, 1);
  assert.equal(g.over, true);
  assert.equal(g.result, 'perfect');
  assert.equal(p.perfect, true);
});

test('$0.00 with non-zero income is not Perfect Zero', () => {
  const g = fresh();
  const p = g.players.p1;
  g.buy('p1', 'steel_mill_biz');
  p.closings.length = 0; p.owned.steel_mill_biz.closing = false;
  p.balance = 0;
  steps(g, 1);
  assert.equal(p.won, true);
  assert.equal(g.isPerfect(p), false);
});

test('a deal still closing blocks the win until it settles', () => {
  const g = fresh();
  const p = g.players.p1;
  g.buy('p1', 'demolition_company');
  p.balance = 100;
  steps(g, 1);
  assert.equal(p.won, false);
});

test('the day ends after exactly 24 real minutes', () => {
  const g = fresh();
  const p = g.players.p1;
  steps(g, 24 * 60 * 10 - 1);
  assert.equal(g.over, false);
  steps(g, 1);
  assert.equal(g.over, true);
  assert.equal(g.result, 'timeup');
  assert.equal(g.t, 24 * 60 * 1000);
});

test('Clout: 1 per $1B rounded down, at least 1, win +200, Perfect Zero +500', () => {
  const g = fresh();
  const p = g.players.p1;
  assert.equal(g.clout(p), 1);
  p.spent = 2.9 * B;
  assert.equal(g.clout(p), 2);
  p.won = true;
  assert.equal(g.clout(p), 202);
  p.perfect = true;
  assert.equal(g.clout(p), 702);
});

test('the money cannon stops at its $30B limit and counts as spending', () => {
  const g = fresh();
  const p = g.players.p1;
  p.gear.money_cannon = true;
  assert.equal(g.setCannon('p1', true).ok, true);
  const before = p.spent;
  steps(g, 10);
  assert.equal(p.spent - before, 200 * M);
  steps(g, 2000);
  assert.equal(p.cannonUsed, 30 * B);
  assert.equal(p.spent - before, 30 * B);
  assert.equal(p.cannonOn, false);
  assert.equal(g.setCannon('p1', true).code, 'empty');
});

test('a whole simulated day runs to 24:00 through the bot and stays in integer cents', () => {
  const Bot = require('../games/trillioner/engine/bot.js');
  const r = Bot.playDay(3, Bot.visibleOnly);
  assert.equal(r.result, 'timeup');
  assert.equal(r.ms, 24 * 60000);
  assert.ok(Number.isSafeInteger(r.player.balance) && Number.isSafeInteger(r.player.spent));
  assert.ok(r.player.history.length >= 90);
});

test('buy the whole store: one purchase for everything left there, counted once', () => {
  const g = fresh();
  const p = g.players.p1;
  const site = g.run.sites.jewel_row, goods = site.items.filter((i) => g.items[i].kind === 'good');
  const sum = goods.reduce((a, i) => a + g.items[i].price * g.stock[i], 0);
  const r = g.buyStore('p1', 'jewel_row');
  assert.equal(r.ok, true);
  assert.equal(p.spent, sum);
  for (const i of goods) assert.equal(g.stock[i], 0);
  assert.equal(g.buyStore('p1', 'jewel_row').code, 'sold');
});

test('engine code never uses Math.random', () => {
  const { readFileSync, readdirSync } = require('node:fs');
  const root = new URL('../games/trillioner/engine/', import.meta.url);
  for (const dir of ['', 'data/']) for (const f of readdirSync(new URL(dir, root))) {
    if (!f.endsWith('.js')) continue;
    assert.ok(!readFileSync(new URL(dir + f, root), 'utf8').includes('Math.random'), f);
  }
});
