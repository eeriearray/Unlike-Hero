// Dragon Clash gear: loadout budget and validation, size, the four instincts, and the gear abilities.
import test from 'node:test';
import assert from 'node:assert/strict';
import { D, Sim, Build, B, plain, duel, press, hits } from './dragon-clash-helpers.mjs';

const NONE = { size: 'medium', instinct: 'fury', ability: 'none' };
const geared = (element, gear) => Build.withGear(plain(element), Object.assign({}, NONE, gear));

test('a bare loadout is valid and free; gear costs its listed points', () => {
  const bare = geared('fire', {});
  assert.ok(Build.validateBuild(bare).ok);
  assert.equal(Build.gearCost(bare), 0);
  assert.equal(Build.gearCost(geared('fire', { instinct: 'bastion', ability: 'phase' })), 8);
});

test('the loadout must fit the 30-point gear budget', () => {
  const over = Build.withGear(plain('fire', { body: 'lithe' }), Object.assign({}, NONE, { size: 'huge', ability: 'aegis' })); // 28 + 12
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
  assert.equal(Build.validateBuild(Object.assign({}, b, { gear: Object.assign({}, b.gear, { instinct: 'adamant' }) })).ok, false);
  assert.equal(Build.validateBuild(Object.assign({}, b, { body: 'titan' })).ok, false, 'size must match the body');
  assert.equal(Build.validateBuild(Object.assign({}, b, { gear: Object.assign({}, b.gear, { ability: '__proto__' }) })).ok, false);
});

test('every loadout must pick a known instinct', () => {
  const b = geared('fire', {});
  assert.equal(Build.validateBuild(Object.assign({}, b, { gear: Object.assign({}, b.gear, { instinct: undefined }) })).ok, false);
  for (const id of Object.keys(D.INSTINCTS)) assert.ok(Build.validateBuild(geared('fire', { instinct: id })).ok, id);
});

test('Fury builds meter faster and keeps combos at full damage longer, with a smaller guard', () => {
  const meter = (ins) => { const { sim, A } = duel(geared('fire', { instinct: ins }), plain('ice'), { gap: 55 }); press(sim, 0, B.heavy, 40); return A.meter; };
  assert.ok(meter('fury') > meter('bastion') * 1.9);
  assert.ok(Build.deriveStats(geared('fire', { instinct: 'fury' })).guardMax < Build.deriveStats(geared('fire', { instinct: 'bastion' })).guardMax / 2);
  const third = (ins) => { const { sim, A, T } = duel(geared('fire', { instinct: ins }), plain('ice'), { gap: 60 }); let h = [];
    for (let n = 0; n < 3; n++) { T.x = A.x + 60; A.facing = 1; h = h.concat(hits(press(sim, 0, B.light, 8))); A.move = null; A.state = 'idle'; A.hitlag = 0; T.hitstun = 40; }
    return h[2].dmg; };
  assert.ok(third('fury') > third('bastion'));
});

test('Bastion parries with a wider window and counters for a quarter bar', () => {
  const st = Build.deriveStats(geared('fire', { instinct: 'bastion' }));
  assert.equal(st.parryWindow, 8); assert.equal(st.guardCounterCost, 25);
  const parried = (ins) => { const { sim } = duel(plain('fire'), geared('ice', { instinct: ins }), { gap: 60 }); const mv = D.MOVES.fsmash; const ev = [];
    for (let k = 0; k < 40; k++) { sim.step([{ held: 0, pressed: k === 0 ? B.heavy : 0 }, { held: k >= mv.startup - 7 ? B.guard : 0, pressed: 0 }]); ev.push(...sim.drainEvents()); }
    return ev.some((e) => e.type === 'parry'); };
  assert.ok(parried('bastion'), 'pressed 7 frames early: still a parry');
  assert.ok(!parried('fury'), 'pressed 7 frames early: only a block');
});

test('Tempest gets an extra air jump and wind-cancels a connected move into a dash', () => {
  assert.equal(Build.deriveStats(geared('fire', { instinct: 'tempest' })).airJumps, Build.deriveStats(geared('fire', {})).airJumps + 1);
  const { sim, A } = duel(geared('fire', { instinct: 'tempest' }), plain('ice'), { gap: 60 });
  A.meter = 100;
  const ev = [];
  for (let k = 0; k < 20; k++) { sim.step([{ held: 0, pressed: k === 0 ? B.light : k === D.MOVES.jab.startup + 1 ? B.dodge : 0 }, { held: 0, pressed: 0 }]); ev.push(...sim.drainEvents()); }
  assert.ok(ev.some((e) => e.type === 'cancel' && e.into === 'wind'));
  assert.equal(A.meter < 100, true);
});

test('Vengeance hits harder the more damage it has taken', () => {
  const dmg = (selfDmg) => { const { sim, A, T } = duel(geared('fire', { instinct: 'vengeance' }), plain('ice'), { gap: 55 }); A.dmg = selfDmg; press(sim, 0, B.heavy, 40); return T.dmg; };
  const r = dmg(120) / dmg(0);
  assert.ok(r > 1.25 && r < 1.35, String(r));
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
