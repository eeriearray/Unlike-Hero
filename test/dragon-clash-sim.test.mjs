// Dragon Clash combat mechanics: hitboxes vs hurtboxes, one hit per attack, dodges, knockback, ring-outs,
// teams, elemental interaction rules and determinism.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { D, Sim, Bot, Build, B, plain, duel, press, hits } from './dragon-clash-helpers.mjs';

test('a lingering hitbox hits a target only once per attack', () => {
  const { sim } = duel(plain('fire'), plain('ice'), { gap: 50 });
  const ev = press(sim, 0, B.heavy, 60, B.down); // Tail Cyclone: 6 active frames overlapping the target
  assert.equal(hits(ev).length, 1);
});

test('out of range means no hit: sprites are irrelevant, only hitboxes count', () => {
  const { sim } = duel(plain('fire'), plain('ice'), { gap: 170 });
  assert.equal(hits(press(sim, 0, B.light, 30)).length, 0);
});

test('a dodge in its invulnerable frames is not hit', () => {
  const { sim, T } = duel(plain('fire'), plain('ice'), { gap: 60 });
  const inputs = [{ held: 0, pressed: B.heavy }, { held: 0, pressed: 0 }];
  sim.step(inputs);
  for (let i = 0; i < 9; i++) sim.step([{ held: 0, pressed: 0 }, { held: 0, pressed: 0 }]);
  sim.step([{ held: 0, pressed: 0 }, { held: 0, pressed: B.dodge }]); // spot dodge just before the claw comes out
  let ev = sim.drainEvents();
  for (let i = 0; i < 30; i++) { sim.step([{ held: 0, pressed: 0 }, { held: 0, pressed: 0 }]); ev = ev.concat(sim.drainEvents()); }
  assert.equal(T.dmg, 0, 'dodged');
  assert.equal(hits(ev).length, 0);
});

test('knockback grows with damage', () => {
  const a = duel(plain('fire'), plain('ice')), b = duel(plain('fire'), plain('ice'));
  b.T.dmg = 120;
  const k0 = hits(press(a.sim, 0, B.heavy, 30))[0].kb, k1 = hits(press(b.sim, 0, B.heavy, 30))[0].kb;
  assert.ok(k1 > k0 * 2, `${k1} vs ${k0}`);
});

test('a ring-out costs a stock and the last stock ends the match', () => {
  const { sim, T } = duel(plain('fire'), plain('ice'), { stocks: 1, x: 1150, gap: 60 });
  T.dmg = 260;
  press(sim, 0, B.heavy, 400);
  assert.equal(T.stocks, 0);
  assert.ok(sim.result);
  assert.equal(sim.result.winnerTeam, 0);
  assert.equal(sim.result.fighters[0].kos, 1);
});

test('teammates cannot hurt each other unless friendly fire is on', () => {
  const extra = [{ build: plain('water'), team: 1 }];
  const off = duel(plain('fire'), plain('ice'), { sameTeam: true, extra });
  press(off.sim, 0, B.heavy, 30);
  assert.equal(off.T.dmg, 0);
  const on = duel(plain('fire'), plain('ice'), { sameTeam: true, extra, friendlyFire: true });
  press(on.sim, 0, B.heavy, 30);
  assert.ok(on.T.dmg > 0);
});

test('a team wins only when every rival is out', () => {
  const sim = new Sim({ stocks: 1, fighters: [plain('fire'), plain('ice'), plain('earth'), plain('water')].map((b, i) => ({ build: b, team: i >> 1 })) });
  sim.forfeit(2);
  sim.step([]);
  assert.equal(sim.result, null, 'one rival left');
  sim.forfeit(3);
  assert.equal(sim.result.winnerTeam, 0);
});

test('time out: most stocks, then least damage, wins', () => {
  const { sim, A, T } = duel(plain('fire'), plain('ice'), { timeLimit: 5 });
  A.dmg = 80; T.dmg = 20;
  for (let i = 0; i < 6; i++) sim.step([]);
  assert.equal(sim.result.reason, 'time');
  assert.equal(sim.result.winnerTeam, 1);
});

test('elemental rules: water douses fire, fire melts ice (and is spent), earth absorbs bolts, the rest clash', () => {
  const p = (element, type) => ({ element, type });
  assert.deepEqual(Sim.resolveClash(p('water', 'wave'), p('fire', 'fireball')), { rule: 'extinguish', kill: 'b' });
  assert.deepEqual(Sim.resolveClash(p('ice', 'iceShard'), p('fire', 'fireball')), { rule: 'melt', kill: 'both' });
  assert.deepEqual(Sim.resolveClash(p('earth', 'boulder'), p('lightning', 'bolt')), { rule: 'absorb', kill: 'b' });
  assert.deepEqual(Sim.resolveClash(p('ice', 'iceShard'), p('lightning', 'bolt')), { rule: 'clash', kill: 'both' });
});

test('a fireball melts a Frost Wall', () => {
  const { sim } = duel(plain('ice'), plain('fire'), { gap: 300 });
  const ev = press(sim, 0, B.sig, 15, B.down); // Frost Wall
  assert.equal(sim.structures.length, 1);
  const ev2 = press(sim, 1, B.sig, 80);
  assert.ok(ev2.concat(ev).some((e) => e.type === 'rule' && e.rule === 'melt'));
  assert.equal(sim.structures.length, 0);
});

test('lightning arcs once through a soaked target (+2%)', () => {
  const { sim, T } = duel(plain('lightning'), plain('fire'), { gap: 200 });
  T.status.soaked = 100;
  const h = hits(press(sim, 0, B.sig, 40))[0];
  assert.ok(h.conduct);
  assert.equal(h.dmg, Math.round((D.SIGNATURES.bolt.spawn.elem + 2) * 10) / 10);
  assert.equal(T.status.soaked, 0, 'dry after one arc');
});

test('Stone Skin halves lightning hitstun and cuts knockback, but never blocks the hit', () => {
  const run = (skin) => {
    const { sim, T } = duel(plain('lightning'), plain('earth'), { gap: 200 });
    T.dmg = 80;
    if (skin) T.buffs.stoneSkin = 60;
    const ev = press(sim, 0, B.sig, 1);
    for (let i = 0; i < 20 && !hits(ev).length; i++) { sim.step([]); ev.push(...sim.drainEvents()); }
    return { h: hits(ev)[0], T };
  };
  const plainHit = run(false), skin = run(true);
  assert.ok(skin.h, 'still hit');
  assert.ok(skin.h.kb < plainHit.h.kb);
  assert.ok(skin.T.hitstun <= Math.ceil(plainHit.T.hitstun / 2) + 1);
});

test('a dragon falling beside the stage grabs the ledge, then can climb back', () => {
  const { sim, A } = duel(plain('fire'), plain('ice'));
  const p = D.ARENAS.skyforge.platforms[0];
  A.x = p.x - 22; A.y = p.y + 60; A.grounded = false; A.state = 'air'; A.vy = 2;
  sim.step([]);
  assert.equal(A.state, 'ledge');
  for (let i = 0; i < 10; i++) sim.step([]);
  sim.step([{ held: B.right, pressed: 0 }]);
  for (let i = 0; i < 20; i++) sim.step([{ held: 0, pressed: 0 }]);
  assert.ok(A.grounded && A.x > p.x, 'back on stage');
});

test('a dragon left hanging on a ledge climbs up by itself within about a second', () => {
  const { sim, A } = duel(plain('fire'), plain('ice'));
  const p = D.ARENAS.skyforge.platforms[0];
  A.x = p.x - 22; A.y = p.y + 60; A.grounded = false; A.state = 'air'; A.vy = 2;
  sim.step([]);
  assert.equal(A.state, 'ledge');
  for (let i = 0; i < 100; i++) sim.step([]);
  assert.ok(A.grounded && A.x > p.x, 'back on stage without any input');
});

test('the same seed and inputs replay the same match', () => {
  const run = () => {
    const sim = new Sim({ stocks: 1, seed: 42, timeLimit: 60 * 60 * 2, fighters: [{ build: Build.presetBuild('voltscale'), team: 0 }, { build: Build.presetBuild('tidefang'), team: 1 }] });
    const bots = [new Bot(sim, 0, { seed: 3 }), new Bot(sim, 1, { seed: 4 })];
    while (!sim.result) sim.step(bots.map((b) => b.think()));
    return JSON.stringify(sim.result);
  };
  assert.equal(run(), run());
});

test('holding an attack button starts one attack, not one per frame', () => {
  const { sim } = duel(plain('fire'), plain('ice'), { gap: 300 });
  let attacks = 0;
  for (let i = 0; i < 120; i++) {
    sim.step([{ held: B.heavy, pressed: 0 }, { held: 0, pressed: 0 }]);
    attacks += sim.drainEvents().filter((e) => e.type === 'attack' && e.f === 0).length;
  }
  assert.equal(attacks, 1);
});
