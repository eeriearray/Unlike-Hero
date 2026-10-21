// Dragon Clash gear: loadout budget and validation, stat effects of size, armour and weapons, and the gear abilities.
import test from 'node:test';
import assert from 'node:assert/strict';
import { D, Sim, Build, B, plain, duel, press, hits } from './dragon-clash-helpers.mjs';

const NONE = { size: 'medium', armor: 'none', weapon: 'claws', ability: 'none' };
const geared = (element, gear) => Build.withGear(plain(element), Object.assign({}, NONE, gear));

test('a bare loadout is valid and free; gear costs its listed points', () => {
  const bare = geared('fire', {});
  assert.ok(Build.validateBuild(bare).ok);
  assert.equal(Build.gearCost(bare), 0);
  assert.equal(Build.gearCost(geared('fire', { armor: 'iron', weapon: 'talons', ability: 'phase' })), 11 + 8 + 8);
});

test('the loadout must fit the 30-point gear budget', () => {
  const over = geared('fire', { armor: 'bone', weapon: 'greatclaws', ability: 'aegis' }); // 16 + 12 + 12
  const v = Build.validateBuild(over);
  assert.equal(v.ok, false);
  assert.match(v.errors.join(' '), /Loadout over budget/);
});

test('growing a size costs the difference in body points; shrinking is free', () => {
  const grow = D.BODIES.titan.cost - D.BODIES.balanced.cost;
  assert.equal(Build.gearCost(geared('earth', { size: 'huge' })), grow);
  assert.equal(Build.gearCost(geared('earth', { size: 'small' })), 0);
  assert.equal(geared('earth', { size: 'huge' }).body, 'titan');
  // The core 100-point build is still costed on the original body
  assert.equal(Build.totalCost(geared('earth', { size: 'huge' })), Build.totalCost(plain('earth')));
});

test('a tampered loadout is rejected', () => {
  const b = geared('fire', {});
  assert.equal(Build.validateBuild(Object.assign({}, b, { gear: Object.assign({}, b.gear, { armor: 'adamant' }) })).ok, false);
  assert.equal(Build.validateBuild(Object.assign({}, b, { body: 'titan' })).ok, false, 'size must match the body');
  assert.equal(Build.validateBuild(Object.assign({}, b, { gear: Object.assign({}, b.gear, { ability: '__proto__' }) })).ok, false);
});

test('armour soaks knockback and costs speed', () => {
  const s0 = Build.deriveStats(geared('fire', {})), s1 = Build.deriveStats(geared('fire', { armor: 'iron' }));
  assert.ok(Math.abs(s1.kbTaken / s0.kbTaken - 0.88) < 1e-9);
  assert.ok(s1.run < s0.run && s1.jump < s0.jump);
  const k = (gear) => { const { sim, T } = duel(plain('fire'), geared('ice', gear)); T.dmg = 80; return hits(press(sim, 0, B.heavy, 30))[0].kb; };
  assert.ok(k({ armor: 'bone' }) < k({}) * 0.9);
});

test('weapons boost only the attacks they are for', () => {
  const dmg = (gear, bits, held = 0) => { const { sim, T } = duel(geared('fire', gear), plain('ice'), { gap: 55 }); press(sim, 0, bits, 40, held); return T.dmg; };
  assert.ok(dmg({ weapon: 'talons' }, B.light) > dmg({}, B.light));
  assert.equal(dmg({ weapon: 'talons' }, B.heavy), dmg({}, B.heavy));
  assert.ok(dmg({ weapon: 'tailmace' }, B.heavy, B.down) > dmg({}, B.heavy, B.down));
});

test('Great Claws reach further with heavy attacks', () => {
  const reach = (gear) => { const { sim, A } = duel(geared('fire', gear), plain('ice')); sim.step([{ held: 0, pressed: B.heavy }, { held: 0, pressed: 0 }]);
    for (let i = 0; i < 40 && !sim.activeBoxes(A).length; i++) sim.step([]); return Math.max(...sim.activeBoxes(A).map((b) => b.x + b.w)) - A.x; };
  assert.ok(reach({ weapon: 'greatclaws' }) > reach({}) * 1.1);
});

test('Aegis absorbs one hit completely, then is gone', () => {
  const { sim, T } = duel(plain('fire'), geared('ice', { ability: 'aegis' }), { gap: 55 });
  press(sim, 1, B.gear, 2);
  assert.ok(T.aegis > 0);
  const ev = press(sim, 0, B.light, 30);
  assert.equal(T.dmg, 0);
  assert.ok(ev.some((e) => e.type === 'absorb'));
  assert.equal(T.aegis, 0);
  press(sim, 0, B.light, 30);
  assert.ok(T.dmg > 0, 'the second hit lands');
});

test('Fade breaks when you attack', () => {
  const { sim, A } = duel(geared('fire', { ability: 'fade' }), plain('ice'), { gap: 300 });
  press(sim, 0, B.gear, 5);
  assert.ok(A.fade > 0);
  const ev = press(sim, 0, B.light, 5);
  assert.equal(A.fade, 0);
  assert.ok(ev.some((e) => e.type === 'unfade'));
});

test('Rage adds 15% damage', () => {
  const dmg = (rage) => { const { sim, T } = duel(geared('fire', { ability: 'rage' }), plain('ice'), { gap: 55 }); if (rage) press(sim, 0, B.gear, 2); press(sim, 0, B.heavy, 40); return T.dmg; };
  const ratio = dmg(true) / dmg(false);
  assert.ok(ratio > 1.1 && ratio < 1.2, String(ratio));
});

test('Gust pushes enemies away without damage', () => {
  const { sim, T } = duel(geared('fire', { ability: 'gust' }), plain('ice'), { gap: 120 });
  const x0 = T.x;
  press(sim, 0, B.gear, 20);
  assert.equal(T.dmg, 0);
  assert.ok(T.x > x0 + 40, `${T.x - x0}`);
});

test('a decoy bursts when struck and hits the attacker', () => {
  const { sim, A, T } = duel(geared('fire', { ability: 'decoy' }), plain('ice'), { gap: 55 });
  press(sim, 0, B.gear, 1);
  assert.equal(sim.decoys.length, 1);
  A.x -= 400; // the owner walks away, the decoy stays
  const ev = press(sim, 1, B.light, 30);
  assert.ok(ev.some((e) => e.type === 'decoyPop'));
  assert.equal(sim.decoys.length, 0);
  assert.ok(T.dmg > 0, 'the attacker was caught in the burst');
});

test('a held gear button fires once, and the cooldown blocks a second use', () => {
  const { sim, T } = duel(plain('fire'), geared('ice', { ability: 'rage' }), { gap: 300 });
  const ev = press(sim, 1, B.gear, 60, B.gear);
  assert.equal(ev.filter((e) => e.type === 'gear').length, 1);
  assert.ok(T.gearCd > 0);
  const ev2 = press(sim, 1, B.gear, 2);
  assert.equal(ev2.filter((e) => e.type === 'gear').length, 0);
});

test('without a gear ability the button does nothing', () => {
  const { sim } = duel(plain('fire'), plain('ice'), { gap: 300 });
  assert.equal(press(sim, 0, B.gear, 5).filter((e) => e.type === 'gear').length, 0);
});
