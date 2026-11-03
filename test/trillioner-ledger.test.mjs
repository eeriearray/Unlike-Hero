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

test('money does not grow by itself: the balance holds still with no businesses', () => {
  const g = fresh();
  const p = g.players.p1;
  steps(g, 3000);
  assert.equal(p.balance, 1e14);
  assert.equal(g.totalIncome(p), 0);
});

test('business income is exact, and only starts when the deal closes', () => {
  const g = fresh();
  const p = g.players.p1;
  g.buy('p1', 'car_dealership');                 // $4B, +$4M/s, closes at once
  const after = p.balance;
  steps(g, 100);
  assert.equal(p.balance, after + 10 * 4 * M);
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

test('property damage is spending, with a cap, and cannot go below zero', () => {
  const g = fresh();
  const p = g.players.p1;
  assert.equal(g.damage('p1', 'prop').paid, 25 * M);
  assert.equal(g.damage('p1', 'car').paid, 200 * M);
  assert.equal(p.spent, 225 * M);
  assert.equal(p.balance, 1e14 - 225 * M);
  assert.ok(g.damage('p1', 'nope').error);
  p.damagePaid = R.DAMAGE_CAP - 1 * M;
  assert.equal(g.damage('p1', 'car').paid, 1 * M);
  assert.equal(g.damage('p1', 'car').paid, 0);
  p.damagePaid = 0; p.balance = 10 * M;
  assert.equal(g.damage('p1', 'prop').paid, 10 * M);
  assert.equal(p.balance, 0);
});

// ── Own It: spending on yourself ──
{
  const Extras = createRequire(import.meta.url)('../games/trillioner/engine/data/extras.js');
  const fresh = () => { const G = new (createRequire(import.meta.url)('../games/trillioner/engine/engine.js').Game)({ seed: 7, mode: 'day', players: [{ id: 'me', name: 'Me' }] }); G.requireNear = false; return G; };
  test('buying an extra takes exact cents, wears it, and cannot be bought twice', () => {
    const g = fresh(), start = g.players.me.balance, x = Extras.BY_ID.hat_crown;
    assert.equal(g.command('me', { t: 'extra', id: 'hat_crown' }).ok, true);
    assert.equal(g.players.me.balance, start - x.price);
    assert.equal(g.players.me.spent, x.price);
    assert.equal(g.players.me.style.hat, 'hat_crown');
    assert.equal(g.command('me', { t: 'extra', id: 'hat_crown' }).code, 'owned');
    assert.equal(g.players.me.balance, start - x.price);
  });
  test('you must be inside a shop to buy an extra or open a box', () => {
    const g = fresh(); g.requireNear = true;
    assert.equal(g.command('me', { t: 'extra', id: 'hat_cap' }).code, 'far');
    assert.equal(g.command('me', { t: 'box' }).code, 'far');
    g.players.me.inv = 'plaza_shops';
    assert.equal(g.command('me', { t: 'extra', id: 'hat_cap' }).ok, true);
  });
  test('you can only wear what you own, and at most 3 pets follow you', () => {
    const g = fresh();
    assert.ok(g.command('me', { t: 'wear', slot: 'hat', id: 'hat_cap' }).error);
    for (const id of ['pet_pig', 'pet_dog', 'pet_cat', 'pet_tiger']) g.command('me', { t: 'extra', id });
    assert.deepEqual(g.players.me.style.pet, ['pet_dog', 'pet_cat', 'pet_tiger']);
    g.command('me', { t: 'wear', slot: 'pet', id: 'pet_cat' });
    assert.deepEqual(g.players.me.style.pet, ['pet_dog', 'pet_tiger']);
  });
  test('mystery boxes are deterministic, stop at the limit and never repeat an item', () => {
    const open = () => { const g = fresh(), got = []; for (let i = 0; i < 30; i++) { const r = g.command('me', { t: 'box' }); if (r.ok) got.push(r.id); } return { got, g }; };
    const a = open(), b = open();
    assert.deepEqual(a.got, b.got);
    assert.equal(a.got.length, Extras.BOX_LIMIT);
    assert.equal(new Set(a.got).size, a.got.length);
    assert.equal(a.g.players.me.spent, Extras.BOX_LIMIT * Extras.BOX_PRICE);
  });
  test('throwing cash is rate limited and capped for the day', () => {
    const g = fresh();
    assert.equal(g.command('me', { t: 'rain' }).ok, true);
    assert.equal(g.command('me', { t: 'rain' }).code, 'wait');
    let thrown = 1;
    for (let i = 0; i < 400; i++) { g.tick(0.25); if (g.command('me', { t: 'rain' }).ok) thrown++; }
    assert.equal(thrown, Extras.RAIN_LIMIT);
    assert.equal(g.players.me.rainUsed, Extras.RAIN_LIMIT);
  });
  test('all extras together cannot close the gap for a visible-only player', () => {
    const shop = Extras.CATALOG.reduce((a, x) => a + x.price, 0);
    const all = shop + Extras.BOX_LIMIT * Extras.BOX_PRICE + Extras.RAIN_LIMIT * Extras.RAIN_THROW;
    assert.ok(shop <= Extras.SHOP_LIMIT);
    assert.ok(all <= 110 * 100 * 1e9, 'visible-only left at least $540B, and must keep $400B unspent');
  });
}

// ── The Refund Office ──
{
  const req = createRequire(import.meta.url), Rules = req('../games/trillioner/engine/data/rules.js');
  const Eng = req('../games/trillioner/engine/engine.js');
  test('a catch puts money back, is rate limited and stops at the daily cap', () => {
    const g = new Eng.Game({ seed: 3, mode: 'day', players: [{ id: 'me', name: 'Me' }] }), p = g.players.me;
    p.spent = 500 * Rules.B; p.balance -= p.spent;
    const b0 = p.balance, r = g.command('me', { t: 'caught' });
    assert.equal(r.ok, true);
    assert.equal(p.balance, b0 + r.back);
    assert.equal(g.command('me', { t: 'caught' }).code, 'wait');
    for (let i = 0; i < 80; i++) { g.tick(5); g.command('me', { t: 'caught' }); }
    assert.equal(p.refunded, Rules.REFUND_CAP);
    assert.equal(p.balance + p.spent, Rules.MODES.day.start);
  });
  test('rooms online have no Refund Office', () => {
    const g = new Eng.Game({ seed: 3, mode: 'battle', players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });
    assert.equal(g.command('a', { t: 'caught' }).code, 'closed');
  });
  test('a run can still be won after the worst the Refund Office can do', () => {
    const Bot = req('../games/trillioner/engine/bot.js');
    for (let s = 1; s <= 25; s++) { const r = Bot.playDay(s, Bot.knowsSecrets, { refunded: Rules.REFUND_CAP }); assert.equal(r.won, true, 'seed ' + s); }
  });
}
