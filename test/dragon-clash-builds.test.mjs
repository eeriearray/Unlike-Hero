// Dragon Clash builds: the 100-point budget is enforced by the rules (not the UI), stats only come from the
// catalog, and cosmetics never change combat.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { D, Build, Sim, plain } from './dragon-clash-helpers.mjs';

test('every archetype is a valid build within the budget', () => {
  for (const p of D.PRESETS) {
    const v = Build.validateBuild(Build.presetBuild(p.id));
    assert.ok(v.ok, p.id + ': ' + v.errors.join(' '));
    assert.ok(v.cost <= D.BUDGET);
  }
});

test('over-budget builds are rejected by validation and by the simulation', () => {
  const b = plain('ice', { body: 'titan', mobility: 'dasher', signature: 'glacierLance', ability: 'frostWall', upgrade: 'ironWill' });
  const v = Build.validateBuild(b);
  assert.equal(v.ok, false);
  assert.ok(v.cost > D.BUDGET && v.errors.some((e) => /Over budget/.test(e)));
  assert.throws(() => new Sim({ fighters: [{ build: b, team: 0 }, { build: plain('fire'), team: 1 }] }), /Invalid build/);
});

test('mismatched, unknown or malformed parts are rejected', () => {
  const bad = [
    plain('fire', { signature: 'iceShard' }),
    plain('fire', { ability: 'tidePool' }),
    plain('fire', { body: 'colossus' }),
    plain('fire', { upgrade: 'godMode' }),
    plain('fire', { element: 'shadow' }),
    plain('fire', { name: '' }),
    plain('fire', { name: 'x'.repeat(40) }),
    plain('fire', { look: Object.assign({}, plain('fire').look, { primary: 'red' }) }),
    plain('fire', { look: Object.assign({}, plain('fire').look, { wings: 'jetpack' }) }),
    plain('fire', { body: '__proto__' }),
    null,
  ];
  for (const b of bad) assert.equal(Build.validateBuild(b).ok, false, JSON.stringify(b && { body: b.body, sig: b.signature, name: b.name }));
});

test('client-side stat tampering has no effect: stats come only from catalog ids', () => {
  const b = plain('earth');
  Object.assign(b, { weight: 999, stats: { weight: 999, run: 99 }, cost: 0, kb: 0 });
  const sim = new Sim({ fighters: [{ build: b, team: 0 }, { build: plain('fire'), team: 1 }] });
  assert.equal(sim.fighters[0].stats.weight, D.BODIES.balanced.weight);
  assert.equal(sim.fighters[0].stats.run, D.MOBILITY.strider.run);
  assert.equal(Build.sanitize(b).weight, undefined, 'unknown fields are dropped before storing or sending');
});

test('cosmetics never change combat stats', () => {
  const a = plain('fire'), b = plain('fire');
  b.look = { head: 'maw', horns: 'ram', wings: 'storm', tail: 'club', spikes: 'plates', armor: 'rock', eyes: 'slit', markings: 'runes', accessory: 'crown', aura: 'blazing', primary: '#000000', secondary: '#ffffff', belly: '#123456', eye: '#abcdef' };
  assert.ok(Build.validateBuild(b).ok);
  assert.deepEqual(Build.deriveStats(a), Build.deriveStats(b));
  assert.equal(Build.totalCost(a), Build.totalCost(b));
});

test('the heaviest body cannot be combined with the fastest mobility', () => {
  const cheapestSig = Math.min(...Object.values(D.SIGNATURES).map((s) => s.cost));
  const cheapestAb = Math.min(...Object.values(D.ABILITIES).map((s) => s.cost));
  for (const mob of ['dasher', 'skyborne']) {
    assert.ok(D.BODIES.titan.cost + D.MOBILITY[mob].cost + cheapestSig + cheapestAb > D.BUDGET, 'titan + ' + mob + ' is over budget');
  }
});

test('every element gets the same budget and has a full kit at each price point', () => {
  for (const el of D.ELEMENT_ORDER) {
    const sigs = Object.values(D.SIGNATURES).filter((s) => s.element === el);
    const abs = Object.values(D.ABILITIES).filter((s) => s.element === el);
    assert.equal(sigs.length, 2, el + ' has two signatures');
    assert.equal(abs.length, 2, el + ' has two abilities');
    assert.ok(Math.min(...sigs.map((s) => s.cost)) === 22 || Math.min(...sigs.map((s) => s.cost)) === 24, el + ' cheapest signature costs about the same');
  }
});

test('count of legal builds per element is similar (no element is starved of options)', () => {
  const per = {};
  for (const el of D.ELEMENT_ORDER) {
    let n = 0;
    for (const body of Object.keys(D.BODIES)) for (const mobility of Object.keys(D.MOBILITY)) for (const upgrade of Object.keys(D.UPGRADES))
      for (const signature of Object.keys(D.SIGNATURES).filter((k) => D.SIGNATURES[k].element === el))
        for (const ability of Object.keys(D.ABILITIES).filter((k) => D.ABILITIES[k].element === el))
          if (Build.validateBuild(plain(el, { body, mobility, upgrade, signature, ability })).ok) n++;
    per[el] = n;
  }
  const vals = Object.values(per);
  assert.ok(Math.min(...vals) / Math.max(...vals) > 0.75, 'legal builds per element: ' + JSON.stringify(per));
});
