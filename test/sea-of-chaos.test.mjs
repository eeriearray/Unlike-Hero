import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, step, aimBroadside, botControl, RULES } from '../games/sea-of-chaos/plunder.js';
import { TEAMS, ISLANDS, EDGE, BANK_RADIUS, collideSea, shoreRadius } from '../games/sea-of-chaos/sea-map.js';
import { snapshot, readSnapshot } from '../games/sea-of-chaos/network.js';

const crew = n => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `C${i}`, ai: true }));
const run = (w, seconds, controls = {}) => { for (let i = 0; i < seconds * 30; i++) step(w, controls, 1 / 30); return w; };

test('captains alternate crews and spawn inside their own harbor', () => {
 const w = createMatch(crew(6), { seed: 1 });
 assert.deepEqual(w.ships.map(s => s.team), [0, 1, 0, 1, 0, 1]);
 for (const s of w.ships) assert.ok(Math.hypot(s.x - TEAMS[s.team].x, s.z - TEAMS[s.team].z) < BANK_RADIUS);
});

test('bot matches finish with banked gold, sinkings, whirlpools and a galleon', () => {
 const all = new Set();
 for (const n of [2, 4, 6]) {
  const w = createMatch(crew(n), { seed: n * 13 }), seen = new Set();
  let last = 0;
  while (w.phase === 'play') { step(w, {}, 1 / 30); for (const e of w.events) if (e.n > last) seen.add(e.type); last = w.eventN; }
  assert.equal(w.phase, 'over');
  assert.ok(w.teams[0].score + w.teams[1].score > 60, `${n} captains banked too little`);
  for (const type of ['bank', 'galleon', 'final', 'end']) assert.ok(seen.has(type), `${n} captains never saw ${type}`);
  seen.forEach(t => all.add(t));
  assert.equal(w.winner, w.teams[0].score === w.teams[1].score ? -1 : w.teams[0].score > w.teams[1].score ? 0 : 1);
 }
 assert.ok(all.has('sink') && all.has('whirlpool'));
});

test('sinking spills carried gold plus a bounty for anyone to grab', () => {
 const w = createMatch([{ id: 'a', ai: false }, { id: 'b', ai: false }], { seed: 2 });
 const [a, b] = w.ships;
 Object.assign(a, { x: 0, z: 30, a: 0, shield: 0 }); Object.assign(b, { x: 25, z: 30, a: 0, shield: 0, gold: 20, hp: 5 });
 w.loot = []; w.whirls = [];
 run(w, 1.5, { a: { fire: true, throttle: 0 }, b: { throttle: 0 } });
 assert.ok(b.dead, 'broadside should sink the damaged ship');
 const spilled = w.loot.filter(l => l.kind === 'coins').reduce((sum, l) => sum + l.value, 0);
 assert.equal(spilled, 20 + RULES.bounty);
 assert.equal(b.gold, 0);
 assert.equal(a.sinks, 1);
});

test('gold only counts once it is banked, and counts double in the final rush', () => {
 const w = createMatch([{ id: 'a', ai: false }, { id: 'b', ai: false }], { seed: 3 });
 const [a] = w.ships;
 a.gold = 15; a.x = 0; a.z = 40;
 run(w, 0.2, {});
 assert.equal(w.teams[0].score, 0);
 a.x = TEAMS[0].x; a.z = TEAMS[0].z;
 run(w, 0.1, {});
 assert.equal(w.teams[0].score, 15); assert.equal(a.gold, 0);
 w.t = w.duration - RULES.finalRush + 1; a.gold = 10;
 run(w, 0.1, {});
 assert.equal(w.teams[0].score, 35);
});

test('broadsides pick the side a rival is on and ignore targets ahead', () => {
 const w = createMatch([{ id: 'a' }, { id: 'b' }], { seed: 4 });
 const [a, b] = w.ships;
 Object.assign(a, { x: 0, z: 0, a: 0 });
 Object.assign(b, { x: -30, z: 0 }); // starboard of a ship heading +z is -x
 assert.equal(aimBroadside(w, a).side, 1);
 Object.assign(b, { x: 30, z: 0 });
 assert.equal(aimBroadside(w, a).side, -1);
 Object.assign(b, { x: 0, z: 30 });
 assert.equal(aimBroadside(w, a), null);
});

test('ships never end up on land or outside the sea', () => {
 const w = createMatch(crew(6), { seed: 5 });
 for (let i = 0; i < 90 * 30; i++) {
  step(w, {}, 1 / 30);
  for (const s of w.ships) {
   assert.ok(Math.hypot(s.x, s.z) <= EDGE + 0.01);
   for (const isle of ISLANDS) assert.ok(Math.hypot(s.x - isle.x, s.z - isle.z) >= shoreRadius(isle) + 3.1, `${s.id} beached on ${isle.kind}`);
  }
 }
 const s = { x: ISLANDS[2].x, z: ISLANDS[2].z + 1, v: 10 };
 assert.ok(collideSea(s));
});

test('snapshots round-trip and stay under the relay cap', () => {
 const w = run(createMatch(crew(6), { seed: 6 }), 70);
 const packet = snapshot(w), size = JSON.stringify(packet).length, back = readSnapshot(packet);
 assert.ok(size < 14000, `snapshot is ${size} bytes`);
 assert.equal(back.ships.length, 6);
 assert.equal(back.teams[0].score, w.teams[0].score);
 assert.ok(Math.abs(back.ships[0].x - w.ships[0].x) < 0.01);
});

test('whirlpools roam unpredictably, drag ships in and grind hulls', () => {
 const w = createMatch([{ id: 'a' }, { id: 'b' }], { seed: 7 });
 const h = w.whirls[0], start = { x: h.x, z: h.z }, headings = new Set();
 for (let i = 0; i < 20 * 30; i++) { step(w, { a: { throttle: 0 }, b: { throttle: 0 } }, 1 / 30); headings.add(Math.round(h.heading)); }
 assert.ok(Math.hypot(h.x - start.x, h.z - start.z) > 20, 'whirlpool should travel');
 assert.ok(headings.size > 2, 'whirlpool should change direction');
 for (const isle of ISLANDS) assert.ok(Math.hypot(h.x - isle.x, h.z - isle.z) > shoreRadius(isle));
 const [a] = w.ships;
 Object.assign(a, { x: h.x + 14, z: h.z, v: 0, shield: 0, hp: 100 });
 const before = Math.hypot(a.x - h.x, a.z - h.z);
 for (let i = 0; i < 10; i++) step(w, { a: { throttle: 0 } }, 1 / 30);
 assert.ok(Math.hypot(a.x - h.x, a.z - h.z) < before, 'ships are pulled inward');
 Object.assign(a, { x: h.x, z: h.z });
 step(w, { a: { throttle: 0 } }, 1 / 30);
 assert.ok(a.hp < 100, 'the eye grinds the hull');
});

test('a whirlpool swallows a ship that drifts in, but a boost escapes the rim', () => {
 const w = createMatch([{ id: 'a' }, { id: 'b' }], { seed: 8 });
 const [a, b] = w.ships, h = w.whirls[0];
 Object.assign(h, { speed: 0, lurch: 99 }); h.heading = 0;
 Object.assign(a, { x: h.x + h.r * 0.5, z: h.z, v: 0, shield: 3, hp: 100 });
 let swallowed = false;
 for (let i = 0; i < 8 * 30 && !swallowed; i++) {
  h.speed = 0; step(w, { a: { throttle: 0 }, b: { throttle: 0 } }, 1 / 30);
  swallowed = w.events.some(e => e.type === 'sink' && e.id === 'a' && e.by === 'whirlpool');
 }
 assert.ok(swallowed, 'an idle ship should be dragged under, even with spawn protection');
 Object.assign(b, { x: h.x + h.r * 0.8, z: h.z, a: Math.PI / 2, v: 10, shield: 0, hp: 100 }); // heading away (+x)
 for (let i = 0; i < 4 * 30; i++) { h.speed = 0; step(w, { b: { throttle: 1, boost: true } }, 1 / 30); }
 assert.ok(!b.dead && Math.hypot(b.x - h.x, b.z - h.z) > h.r, 'boosting away from the rim escapes');
});


test('bots cruise below player full sail and save boosts for danger', () => {
 const w = createMatch([{ id: 'bot', ai: true }], { seed: 31 });
 const s = w.ships[0];
 Object.assign(s, { x: 0, z: 30, a: 0, gold: 0 });
 w.whirls = []; w.loot = [{ x: 0, z: 55, value: 8 }]; w.powers = [];
 const cruise = botControl(w, s);
 assert.ok(cruise.throttle > 0 && cruise.throttle <= 0.8);
 assert.equal(cruise.boost, false);
 Object.assign(s, { gold: 40, a: -Math.PI / 2 });
 assert.equal(botControl(w, s).boost, false, 'a laden bot should not sprint home on cooldown');
 w.whirls = [{ x: s.x + 12, z: s.z, r: RULES.whirlRadius }];
 assert.equal(botControl(w, s).boost, true, 'bots can still escape a whirlpool');
});

test('moving-target aim stays precise for players but underleads for bots', () => {
 const w = createMatch([{ id: 'a' }, { id: 'b' }], { seed: 32 });
 const [a, b] = w.ships;
 Object.assign(a, { x: 0, z: 30, a: 0 });
 Object.assign(b, { x: 30, z: 30, a: 0, v: RULES.speed });
 const player = aimBroadside(w, a);
 assert.ok(Math.abs(player.dir - Math.atan2(30, RULES.speed * 30 / RULES.ballSpeed)) < 1e-9);
 a.ai = true;
 const bot = aimBroadside(w, a);
 assert.equal(bot.target, player.target);
 assert.ok(bot.dir > player.dir && bot.dir < Math.PI / 2, 'bots lead less, making moving players harder to hit');
});

test('bots leave a longer dodge window between broadsides without slowing player reloads', () => {
 function volleys(ai) {
  const w = createMatch([{ id: 'a', ai }, { id: 'b' }], { seed: 33 });
  w.whirls = []; w.loot = []; w.chestClock = 99;
  let fired = 0, last = 0;
  for (let i = 0; i < 6 * 30; i++) {
   // Hold the same broadside opportunity throughout, isolating firing cadence from navigation.
   Object.assign(w.ships[0], { x: 0, z: 30, a: 0, v: 0, yawRate: 0, rudder: 0 });
   Object.assign(w.ships[1], { x: 30, z: 30, v: 0, shield: 99 });
   step(w, { a: { fire: true } });
   fired += w.events.filter(e => e.n > last && e.type === 'fire' && e.id === 'a').length;
   last = w.eventN;
  }
  return fired;
 }
 const player = volleys(false), bot = volleys(true);
 assert.equal(player, 5, 'the player keeps the existing reload rate');
 assert.ok(bot > 0 && bot <= player * 0.6, `${bot} bot volleys vs ${player} player volleys`);
});
