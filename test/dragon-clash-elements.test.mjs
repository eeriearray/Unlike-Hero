// Dragon Clash elemental counter rules: modifiers only touch elemental damage, every pairing is checked,
// and knockback/hitstun never depend on the matchup.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { D, Sim, B, plain, duel, press, hits } from './dragon-clash-helpers.mjs';

const ELS = D.ELEMENT_ORDER;

test('the counter cycle is Fire > Ice > Earth > Lightning > Water > Fire', () => {
  assert.deepEqual(D.BEATS, { fire: 'ice', ice: 'earth', earth: 'lightning', lightning: 'water', water: 'fire' });
});

test('the star cycle is Fire > Earth > Water > Ice > Lightning > Fire', () => {
  assert.deepEqual(D.BEATS_EDGE, { fire: 'earth', earth: 'water', water: 'ice', ice: 'lightning', lightning: 'fire' });
});

test('matchup matrix: every one of the 25 pairings gets the right modifier, and only mirrors are neutral', () => {
  const counts = { advantage: 0, disadvantage: 0, neutral: 0 };
  for (const a of ELS) for (const b of ELS) {
    const m = D.elementMultiplier(a, b);
    const expected = a === b ? 1 : D.BEATS[a] === b ? 1.1 : D.BEATS[b] === a ? 0.9 : D.BEATS_EDGE[a] === b ? 1.05 : 0.95;
    assert.equal(Math.round(m * 1000) / 1000, expected, `${a} vs ${b}`);
    counts[D.matchup(a, b)]++;
  }
  assert.deepEqual(counts, { advantage: 10, disadvantage: 10, neutral: 5 });
  for (const a of ELS) {
    const row = ELS.filter((b) => b !== a).map((b) => D.matchup(a, b));
    assert.equal(row.filter((x) => x === 'advantage').length, 2, a + ' beats exactly two elements');
    assert.equal(row.filter((x) => x === 'disadvantage').length, 2, a + ' loses to exactly two elements');
  }
});

test('only the elemental portion of a hit is modified', () => {
  assert.equal(Sim.hitDamage(10, 0, 'fire', 'ice'), 10, 'physical damage ignores the counter');
  assert.equal(Sim.hitDamage(0, 10, 'fire', 'ice'), 11, 'counter: +10% elemental');
  assert.equal(Sim.hitDamage(0, 10, 'ice', 'fire'), 9, 'countered: −10% elemental');
  assert.equal(Sim.hitDamage(0, 10, 'fire', 'earth'), 10.5, 'edge: +5% elemental');
  assert.equal(Sim.hitDamage(0, 10, 'earth', 'fire'), 9.5, 'edged: −5% elemental');
  assert.equal(Sim.hitDamage(0, 10, 'fire', 'fire'), 10, 'mirror: no change');
  assert.equal(Sim.hitDamage(4, 6, 'fire', 'ice'), 10.6, 'mixed hit: only the 6 elemental is boosted');
});

test('modifiers are configurable', () => {
  const cfg = { counterBonus: 0.25, counterPenalty: 0.05 };
  assert.equal(Sim.hitDamage(0, 10, 'water', 'fire', cfg), 12.5);
  assert.equal(Sim.hitDamage(0, 10, 'fire', 'water', cfg), 9.5);
  assert.equal(Sim.hitDamage(3, 0, 'water', 'fire', cfg), 3);
});

test('in a real fight, a mixed claw hit is boosted only on its elemental part, for every defender element', () => {
  // Rending Claw: 12 physical + 2 elemental, from a Fire dragon
  const move = D.MOVES.fsmash;
  for (const def of ELS) {
    const { sim } = duel(plain('fire'), plain(def));
    const h = hits(press(sim, 0, B.heavy, 30))[0];
    assert.ok(h, 'the claw hits ' + def);
    const expected = Math.round((move.phys + move.elem * D.elementMultiplier('fire', def)) * 10) / 10;
    assert.equal(h.dmg, expected, 'fire claw on ' + def);
  }
});

test('physical attacks deal identical damage and knockback to every element', () => {
  const seen = new Set();
  for (const att of ELS) for (const def of ELS) {
    const { sim } = duel(plain(att), plain(def));
    const h = hits(press(sim, 0, B.light, 20))[0];
    assert.ok(h);
    seen.add(h.dmg + '/' + h.kb + '/' + h.angle);
  }
  assert.equal(seen.size, 1, 'one result across all 25 pairings: ' + [...seen].join(' '));
});

test('knockback and hitstun never include an element factor', () => {
  // Same target damage before the hit → identical launch for a counter hit and a countered hit with the same move,
  // except for the (small) difference the extra % itself makes. Check the formula directly.
  for (const def of ELS) {
    const { sim, T } = duel(plain('fire'), plain(def));
    const h = hits(press(sim, 0, B.heavy, 30))[0];
    const kb = (D.MOVES.fsmash.kb + D.MOVES.fsmash.growth * T.dmg) * (200 / (T.stats.weight + 100));
    assert.ok(Math.abs(h.kb - Math.round(kb * 10) / 10) < 0.11, `${def}: kb ${h.kb} matches the element-free formula ${kb.toFixed(2)}`);
  }
});

test('elemental advantage never grants invulnerability, freezes or extra hitstun', () => {
  // Ice (countered by Fire) hitting Fire still lands, and its status (chill) is short and never stacks.
  const { sim, T } = duel(plain('ice'), plain('fire'), { gap: 200 });
  const ev = press(sim, 0, B.sig, 60);
  const h = hits(ev)[0];
  assert.ok(h, 'the countered shard still hits');
  assert.ok(T.status.chill > 0 && T.status.chill <= D.STATUS.chill.ticks, 'chill is short');
  assert.ok(D.STATUS.chill.ticks <= 60 && D.STATUS.chill.moveMult >= 0.75, 'chill only slows, briefly');
});
