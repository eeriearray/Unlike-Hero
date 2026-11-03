// Catalog and city content: exactly 8 districts, exact budgets, minimums, every required item.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../games/trillioner/engine/data/rules.js');
const D = require('../games/trillioner/engine/data/districts.js');
const Items = require('../games/trillioner/engine/data/items.js');
const { buildRun } = require('../games/trillioner/engine/shuffle.js');
const { B, M } = R;
const list = Items.build();

const REQUIRED = {
  bank: 20, mint: 40, phone_company: 30, corner_nw: 12, corner_ne: 12, corner_sw: 12, corner_se: 12, brokers_licence: 1, lobby_firm: 3,
  soda_giant: 30, burger_empire: 15, streaming_service: 18, social_app: 24, crypto_exchange: 8, golden_metro: 10, free_wifi: 8, skyline_show: 6,
  grand_hotel_biz: 6, fashion_house_biz: 5, diamond_fountain: 1, diplomatic_pass: 2, scottish_castle: 1, alpine_ski: 12, pacific_islands: 18, saharan_solar: 25,
  skate_shop_biz: 1, pizza_chain: 3, zoo_biz: 5, wonderland_park: 25, school_biz: 1, observatory_biz: 2, stadium_biz: 15, park_a: 4, park_b: 4, park_c: 4,
  car_dealership: 4, race_track: 6, car_factory_biz: 18, fireworks_factory: 2, demolition_company: 10, scrapyard_biz: 1, steel_mill_biz: 9, power_station_biz: 20, harbour_bridge: 12, metro_line: 15,
  boatyard_biz: 8, yacht_fleet: 4, cruise_line: 14, container_port: 25, lighthouse_biz: 0.5, aquarium_biz: 3,
  airline: 35, helicopter_company: 15, jet_fleet: 8, hangar_city: 3, rocket: 12, moon_land: 10, asteroid_mining: 20, mars_hotel: 5, jetpack: 3,
  fire_department: 6, newspaper_biz: 5, museum_biz: 4, theatre_biz: 1, laundromat: 0.01,
  gold_train: 10, mole_machine: 8, secret_casino_biz: 15, vault_oddities_biz: 6, lake_resort_biz: 9
};
const INCOME = { skate_shop_biz: 1, car_dealership: 4, pizza_chain: 3, scrapyard_biz: 1, fire_department: 0, zoo_biz: -2, boatyard_biz: 6, helicopter_company: 15, fireworks_factory: 2, demolition_company: 8, mint: 50, mole_machine: 0, bank: 25, airline: 40, newspaper_biz: 5, phone_company: 35, observatory_biz: 0, brokers_licence: 0, lobby_firm: 2, asteroid_mining: 120 };
const LOSERS = ['streaming_service', 'social_app', 'crypto_exchange', 'wonderland_park', 'steel_mill_biz', 'secret_casino_biz', 'zoo_biz'];
const BUDGETS = { downtown: 360, luxury: 260, suburbs: 200, industrial: 160, harbour: 120, airport: 120, under: 120, oldtown: 60 };
const total = (rows) => rows.reduce((a, i) => a + i.price * i.stock, 0);
const byId = Object.fromEntries(list.map((i) => [i.id, i]));

test('exactly 8 districts, seven on the surface and one underground', () => {
  const ids = Object.keys(D.DISTRICTS);
  assert.equal(ids.length, 8);
  assert.equal(ids.filter((k) => D.DISTRICTS[k].level === 'under').length, 1);
  assert.deepEqual(ids.slice().sort(), Object.keys(BUDGETS).sort());
});

test('every district budget matches exactly, and they total $1.4T', () => {
  for (const [d, b] of Object.entries(BUDGETS)) {
    assert.equal(total(list.filter((i) => i.district === d)), b * B, d);
    assert.equal(D.DISTRICTS[d].budget, b * B, d);
  }
  assert.equal(total(list), 1400 * B);
});

test('catalog size: 400 to 600 purchases, at least 40 in each district', () => {
  assert.ok(list.length >= 400 && list.length <= 600, String(list.length));
  for (const d of Object.keys(BUDGETS)) {
    const n = list.filter((i) => i.district === d).length;
    assert.ok(n >= 40, `${d} has ${n}`);
  }
});

test('ids are unique and every price and stock is a positive whole number', () => {
  assert.equal(new Set(list.map((i) => i.id)).size, list.length);
  for (const i of list) {
    assert.ok(Number.isSafeInteger(i.price) && i.price > 0, i.id);
    assert.ok(Number.isSafeInteger(i.stock) && i.stock > 0, i.id);
  }
});

test('every required item exists at the brief\'s price', () => {
  for (const [id, b] of Object.entries(REQUIRED)) {
    assert.ok(byId[id], `missing ${id}`);
    assert.equal(byId[id].price, Math.round(b * B), id);
  }
});

test('incomes match the brief, and are multiples of 10 cents a second', () => {
  for (const [id, m] of Object.entries(INCOME)) assert.equal(byId[id].income, m * M, id);
  for (const id of LOSERS) assert.ok(byId[id].income < 0, id);
  for (const i of list) assert.equal(Math.abs(i.income) % 10, 0, i.id);
});

test('visible deals stay within the $300B to $450B the brief allows', () => {
  const visible = total(list.filter((i) => !i.gate && !i.secret));
  assert.ok(visible >= 300 * B && visible <= 450 * B, String(visible / B));
  assert.equal(total(list.filter((i) => i.district === 'under' && !i.secret && !i.gate)), 0);
});

test('every district meets the world minimums', () => {
  for (const d of Object.values(D.DISTRICTS)) {
    assert.ok((d.buildings || []).filter((b) => b.enter).length >= 4, `${d.id} enterable`);
    assert.ok(d.stairs && d.stairs.length, `${d.id} rooftop route`);
    assert.ok(d.landmarks && d.landmarks.length, `${d.id} landmark`);
    assert.ok(d.crowd > 0, `${d.id} crowd`);
    assert.ok(d.change, `${d.id} small change`);
  }
});

test('everything is sold indoors: every pad is in a room, behind a door', () => {
  const run = buildRun(1);
  for (const i of run.list) {
    const p = run.padPos[i.id];
    assert.ok(p && Number.isFinite(p.x) && Number.isFinite(p.z), i.id);
    assert.ok(p.x >= 3000, `${i.id} is on the street`);
    const s = run.sites[i.site];
    assert.equal(s.kind, 'room', i.id);
    assert.ok(s.front, i.id);
  }
});

test('buildings never overlap each other', () => {
  const list = [];
  for (const d of Object.values(D.DISTRICTS)) for (const b of d.buildings) list.push(b);
  const clash = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    const under = (x) => (x.y != null ? x.y : (D.DISTRICTS.under.buildings.includes(x) ? -60 : 0));
    if (Math.abs(under(a) - under(b)) > 5) continue;
    if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2) clash.push(`${a.id}/${b.id}`);
  }
  assert.deepEqual(clash, []);
});

test('no door opens into a building', () => {
  const run = buildRun(1), rooms = Object.values(run.sites).filter((s) => s.kind === 'room');
  const bad = [];
  for (const s of rooms) for (const o of rooms) {
    if (s === o || Math.abs(s.y - o.y) > 5) continue;
    if (Math.abs(s.front.x - o.b.x) < o.b.w / 2 + 0.7 && Math.abs(s.front.z - o.b.z) < o.b.d / 2 + 0.7) bad.push(`${s.id} into ${o.id}`);
  }
  assert.deepEqual(bad, []);
});

test('at least 18 usable things exist and every one is sold', () => {
  const usable = new Set();
  for (const i of list) if (i.reward) { (i.reward.vehicles || []).forEach((v) => usable.add(v)); (i.reward.gear || []).forEach((g) => usable.add(g)); }
  assert.ok(usable.size >= 18, `only ${usable.size}: ${[...usable]}`);
  for (const need of ['hoverboard', 'sports_car', 'scooter', 'monster_truck', 'ladder_truck', 'elephant', 'speedboat', 'submarine', 'helicopter', 'launcher', 'wrecking_truck', 'money_cannon', 'mole_machine', 'jetpack', 'private_train']) assert.ok(usable.has(need), need);
});

test('no road is blocked by a named building, a stall, a stair or a landmark', () => {
  const blocks = [];
  for (const d of Object.values(D.DISTRICTS)) {
    if (d.level === 'under') continue;
    for (const b of d.buildings) if (b.y == null || b.y < 1) blocks.push([b.id, b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2]);
    for (const st of d.stairs || []) blocks.push(['stair ' + d.id, st.x - 5, st.z - 5, st.x + 5, st.z + 5]);
    for (const l of d.landmarks || []) if (l.kind !== 'bigsign' && l.kind !== 'crane') { const r = l.kind === 'ferris' ? 5 : l.r || 7; blocks.push([l.kind, l.x - r, l.z - r, l.x + r, l.z + r]); }
  }
  const hits = [];
  for (const R of D.ROADS) for (let i = 0; i < R.pts.length - 1; i++) {
    const [ax, az] = R.pts[i], [bx, bz] = R.pts[i + 1], l = Math.hypot(bx - ax, bz - az);
    for (let s = 0; s <= l; s += 2) {
      const x = ax + (bx - ax) * s / l, z = az + (bz - az) * s / l;
      for (const b of blocks) if (x > b[1] - 2 && x < b[3] + 2 && z > b[2] - 2 && z < b[4] + 2) hits.push(b[0]);
    }
  }
  assert.deepEqual([...new Set(hits)], []);
});
