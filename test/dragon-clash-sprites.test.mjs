// Sprite-pack dragons: selectable archetypes that fight exactly like their rig twins, whose pack id survives
// sanitising (it is what online players send), and whose manifests carry what the renderer needs.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { D, Build, Sim } from './dragon-clash-helpers.mjs';

const ROOT = new URL('../games/dragon-clash/assets/dragons/', import.meta.url);

test('each sprite dragon has the stats of its rig archetype and only differs in art', () => {
  for (const id of Object.keys(D.SPRITES)) {
    const hd = Build.presetBuild(id + '-hd'), rig = Build.presetBuild(id);
    assert.equal(hd.look.sprite, id);
    assert.deepEqual(Build.deriveStats(hd), Build.deriveStats(rig));
    assert.ok(Build.validateBuild(hd).ok);
  }
});

test('the sprite pack id is kept by sanitize (online) and unknown packs are rejected', () => {
  const hd = Build.presetBuild('emberfang-hd');
  assert.equal(Build.sanitize(JSON.parse(JSON.stringify(hd))).look.sprite, 'emberfang');
  const bad = Build.sanitize(hd); bad.look.sprite = '../../etc';
  assert.equal(Build.validateBuild(bad).ok, false);
  assert.equal(Build.sanitize(bad).look.sprite, undefined);
});

test('sprites are cosmetic: a sprite dragon and its rig twin play identical matches', () => {
  const run = (a) => {
    const s = new Sim({ seed: 7, stocks: 1, fighters: [{ build: Build.presetBuild(a), team: 0 }, { build: Build.presetBuild('ironmaw'), team: 1 }] });
    for (let i = 0; i < 300; i++) s.step([{ held: i % 40 < 20 ? 2 : 0, pressed: 0 }, { held: 0, pressed: 0 }]);
    return JSON.stringify(s.snapshot().f.map((f) => [f.x, f.y, f.st, f.d]));
  };
  assert.equal(run('emberfang-hd'), run('emberfang'));
});

test('every pack has a manifest with the 25 animations and per-frame foot rows', () => {
  for (const id of Object.keys(D.SPRITES)) {
    const m = JSON.parse(fs.readFileSync(new URL(id + '/manifest.json', ROOT)));
    assert.ok(m.cx > 100 && m.cx < 250, id + ' cx');
    assert.equal(Object.keys(m.anims).length, 25, id);
    for (const [name, a] of Object.entries(m.anims)) {
      assert.equal(a.bot.length, a.n, id + ' ' + name);
      assert.ok(fs.existsSync(new URL(id + '/' + name + '.png', ROOT)), id + ' ' + name + '.png');
    }
  }
});
