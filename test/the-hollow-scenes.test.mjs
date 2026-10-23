import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { data: D } = require('../games/the-hollow/engine/index.js');
const game = new URL('../games/the-hollow/', import.meta.url);
const read = async file => JSON.parse(await fs.readFile(new URL(file, game), 'utf8'));
const index = await read('art/scenes/index.json');
const manifest = await read('art/manifest.json');
const source = await fs.readFile(new URL('js/photo-scenes.js', game), 'utf8');

test('all 42 places have listed backgrounds, valid bounds, exact engine option coverage and valid neighbours', async () => {
  assert.equal(Object.keys(index.places).length, 42);
  assert.deepEqual(Object.keys(index.places).sort(), Object.keys(D.locations).sort());
  for (const [id, entry] of Object.entries(index.places)) {
    const c = await read(entry.file);
    assert.equal(c.id, id);
    assert.equal(c.region, D.locations[id].region);
    assert.equal(c.background, entry.background);
    assert.equal(manifest.assets[c.background].type, 'image');
    await fs.access(new URL(manifest.assets[c.background].file, game));
    assert.deepEqual(c.hotspots.filter(h => h.optionId).map(h => h.optionId).concat(c.controlsOnly || []).sort(), (D.locations[id].options || []).map(o => o.id).sort(), id);
    assert.equal(new Set(c.hotspots.map(h => h.id)).size, c.hotspots.length);
    for (const h of c.hotspots) {
      assert.ok(h.x >= 0 && h.y >= 0 && h.w >= 84 && h.h >= 84 && h.x + h.w <= 1600 && h.y + h.h <= 900, `${id}/${h.id}`);
      if (h.optionId) assert.equal(h.hidden, !!D.locations[id].options.find(o => o.id === h.optionId).hidden);
      if (h.move) assert.ok(D.edges.some(e => e.includes(id) && e.includes(h.move)));
    }
    assert.ok(c.hotspots.some(h => h.action === 'investigate'));
    assert.ok(c.hotspots.some(h => h.action === 'travel')); // Also gives Warden a usable stage.
    assert.deepEqual(entry.neighbours.sort(), D.edges.filter(e => e[0] === id || e[1] === id).map(e => e[0] === id ? e[1] : e[0]).sort());
  }
});

function sandbox(overrides = {}) {
  const calls = [];
  const window = {
    HollowArt: { esc: x => x.replaceAll('&', '&amp;').replaceAll('<', '&lt;'), scene: () => '<svg><rect/></svg>' },
    HollowAssets: { get: id => manifest.assets[id], allowedPaths: {}, load: async id => { calls.push(id); return null; }, release: () => {} },
    HollowUI: { S: { view: { enc: null } } },
    HollowFx: { reduced: () => false },
    HollowStage: { place: () => null, refresh: () => {}, cat: () => ({ locations: D.locations, regions: D.regions }) }
  };
  const context = { window, URL, Set, Number, document: { currentScript: { src: 'https://example.test/games/the-hollow/js/photo-scenes.js' } },
    fetch: async url => {
      const file = new URL(url).pathname.split('/games/the-hollow/')[1];
      calls.push(file);
      return { ok: true, json: () => file in overrides ? overrides[file] : read(file) };
    } };
  vm.runInNewContext(source, context);
  return { window, api: window.HollowPhotoScenes, calls };
}
test('metadata stays lazy and malformed or unlisted scenes preserve fallback', async () => {
  const { api, calls } = sandbox({ 'art/scenes/square.json': { id: 'wrong' } });
  await api.ready;
  assert.deepEqual(calls, ['art/scenes/index.json']);
  await api.ensure('not_a_place');
  assert.equal(calls.length, 1);
  await api.ensure('square');
  const fallback = { objects: {} };
  assert.equal(api.resolve('square', fallback), fallback);
});
test('hidden hotspots follow encounter visibility and option actions remain identical', async () => {
  const { api, window } = sandbox();
  await api.ensure('chapel');
  const scene = api.resolve('chapel', { objects: {} });
  const nodes = Object.fromEntries(Object.keys(scene.objects).map(id => [id, { style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }]));
  const world = { querySelector: selector => selector.startsWith('.obj-') ? nodes[selector.slice(5)] : null };
  scene.state(world, { phase: 1 });
  assert.equal(nodes.hatch.style.display, 'none');
  assert.equal(nodes.hatch.attrs.tabindex, '-1');
  window.HollowUI.S.view.enc = { loc: 'chapel', options: [{ id: 'hatch', state: 'ok' }] };
  scene.state(world, { phase: 2 });
  assert.equal(nodes.hatch.style.display, '');
  assert.equal(nodes.hatch.attrs.tabindex, '0');
  assert.deepEqual(JSON.parse(JSON.stringify(scene.objects.altar.actions)), [{ opt: 'pray' }]);
});
test('preloading is limited to the current place and at most two discovered legal neighbours', async () => {
  const { api } = sandbox();
  await api.ready;
  const moves = [{ to: 'chapel', ok: true }, { to: 'graveyard', ok: true },
    { to: 'nursery', ok: true }, { to: 'belltower', ok: false }, { to: 'library', ok: true }];
  const view = { map: { locs: { square: {}, chapel: {}, graveyard: {}, nursery: {}, library: {} } }, act: { moves } };
  assert.deepEqual(Array.from(api.preloadPlan('square', view)), ['square', 'chapel', 'graveyard']);
  assert.deepEqual(Array.from(api.preloadPlan('square', { map: { locs: { square: {} } }, act: { moves } })), ['square']);
  assert.deepEqual(Array.from(api.preloadPlan('not_a_place', view)), []);
});
