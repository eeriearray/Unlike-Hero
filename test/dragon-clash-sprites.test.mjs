// Sprite-pack dragons: selectable archetypes that fight exactly like their rig twins, whose pack id survives
// sanitising (it is what online players send), and whose manifests carry what the renderer needs.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { D, Build, Sim, B } from './dragon-clash-helpers.mjs';

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

test('every one of the 25 sheets is shown by some game situation', async () => {
  const { readFileSync } = await import('node:fs');
  const vm = await import('node:vm');
  const window = { DC: { Data: D } };
  const ctx = vm.createContext({ window, Math, Object, JSON, Promise, console });
  for (const f of ['js/sprite.js', 'js/anim.js']) vm.runInContext(readFileSync(new URL('../games/dragon-clash/' + f, import.meta.url), 'utf8'), ctx);
  const S = window.DCSprites, id = 'emberfang';
  const man = JSON.parse(readFileSync(new URL('../games/dragon-clash/assets/dragons/' + id + '/manifest.json', import.meta.url), 'utf8')).anims;
  const p = { sheets: {}, cx: 165, hold: 4, active: {}, failed: false };
  for (const k of Object.keys(S.NAMES)) { const m = man[S.NAMES[k]]; p.sheets[k] = { n: m.n, cols: m.cols, bot: m.bot, cw: 1, ch: 1, res: 1 }; if (m.active) p.active[k] = [m.active[0] * 3, (m.active[m.active.length - 1] + 1) * 3]; }
  S.packs[id] = p;
  const build = Build.presetBuild('emberfang-hd'), seen = new Set();
  const base = { stT: 5, fc: 1, vx: 0, vy: 0, gr: true, hl: 0, tb: false, aj: 1, mv: null, mT: 0 };
  const run = (snaps, env) => { const tr = new S.Tracker(); let t = 0; for (const s of snaps) { t += 1 / 60; const o = tr.update(id, Object.assign({}, base, s), build, t, 1 / 60, env || {}); if (o) seen.add(o.a); } };
  const many = (s, n = 40) => Array.from({ length: n }, (_, i) => Object.assign({ stT: i }, s));
  run([{ st: 'idle' }]);
  run(many({ st: 'run', vx: 4 }));
  run([{ st: 'crawl', vx: 2 }, { st: 'crouch' }]);
  run([{ st: 'squat' }, { st: 'air', vy: -10, gr: false }, { st: 'air', vy: 5, gr: false }, { st: 'land' }]);
  run([{ st: 'air', vy: -10, gr: false, aj: 1 }, { st: 'air', vy: -10, gr: false, aj: 0 }]);
  run([{ st: 'dodge', vx: -6 }, { st: 'dodge', vx: 6 }, { st: 'guard' }, { st: 'blockstun' }]);
  for (const mv of ['jab', 'fsmash', 'utilt', 'dtilt', 'usmash', 'sig', 'ability']) run([{ st: 'attack', mv, mT: 8 }]);
  run([{ st: 'hitstun' }, { st: 'idle' }, { st: 'hitstun' }, { st: 'hitstun', tb: true }]);
  run([{ st: 'down' }, { st: 'getup' }]);
  run([{ st: 'idle' }], { force: 'victory' }); run([{ st: 'idle' }], { force: 'defeat' });
  const missing = Object.keys(S.NAMES).filter((k) => !seen.has(k));
  assert.deepEqual(missing, [], 'never shown: ' + missing.map((k) => S.NAMES[k]).join(', '));
});

test('Down + a direction on solid ground crawls: slow, low hurtbox', () => {
  const sim = new Sim({ arena: 'skyforge', seed: 1, fighters: [{ build: Build.presetBuild('emberfang'), team: 0 }, { build: Build.presetBuild('frostwing'), team: 1 }] });
  const A = sim.fighters[0], x0 = A.x;
  for (let k = 0; k < 30; k++) sim.step([{ held: B.down | B.right, pressed: 0 }, { held: 0, pressed: 0 }]);
  assert.equal(A.state, 'crawl');
  assert.ok(A.x > x0 + 20 && A.x - x0 < A.stats.run * 30 * 0.5, 'crawled ' + (A.x - x0));
  assert.ok(sim.hurtbox(A).h < A.stats.hurt.h);
});
