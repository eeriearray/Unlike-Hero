import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { data: D } = require('../games/the-hollow/engine/index.js');
const game = new URL('../games/the-hollow/', import.meta.url);
const read = async file => JSON.parse(await fs.readFile(new URL(file, game), 'utf8'));
const config = await read('art/presentation.json'), manifest = await read('art/manifest.json');

test('every engine item has a listed icon, with rarity from existing metadata', async () => {
  assert.deepEqual(Object.keys(config.items).sort(), Object.keys(D.items).sort());
  for (const [id, m] of Object.entries(config.items)) {
    assert.equal(manifest.assets[m.asset].type, 'image', id);
    const expected = D.items[id].kind === 'relic' ? 'relic' : D.items[id].rare ? 'rare' : 'common';
    assert.equal(m.rarity, expected, id);
    assert.notEqual(manifest.assets[m.asset].pack, 'free_survival_horror_items_pack');
    await fs.access(new URL(manifest.assets[m.asset].file, game));
  }
  for (const id of Object.values(config.ui)) assert.ok(manifest.assets[id]);
  assert.equal(manifest.assets[config.ui.font].type, 'font');
});
test('derived UI crops retain source provenance, safe bounds and pack attribution', async () => {
  const slices = JSON.parse(await fs.readFile(new URL('../tools/hollow-asset-slices.json', import.meta.url), 'utf8'));
  for (const recipe of slices) {
    const entry = manifest.assets[recipe.id];
    assert.equal(entry.pack, recipe.pack);
    assert.equal(entry.source, recipe.source);
    assert.deepEqual(entry.crop, recipe.crop);
    assert.deepEqual(entry.border, recipe.border);
    const [x,y,w,h] = recipe.crop;
    assert.ok(x >= 0 && y >= 0 && x+w <= 256 && y+h <= 256);
    assert.ok(recipe.border[0]+recipe.border[2] < h && recipe.border[1]+recipe.border[3] < w);
    assert.ok(entry.pixel);
  }
});

function node(id) {
  return { dataset: { hollowItem: id }, isConnected: true, classes: new Set(), children: [],
    classList: { add(...names) { names.forEach(x => this.owner.classes.add(x)); }, remove(name) { this.owner.classes.delete(name); } },
    appendChild(child) { this.children.push(child); } };
}
async function presentation(imageSuccess) {
  const nodes = [node('tonic'), node('moonrelic'), node('unlisted')];
  nodes.forEach(n => { n.classList.owner = n; });
  const requests = [];
  const document = { currentScript: { src: 'https://example.test/games/the-hollow/js/presentation.js' },
    documentElement: { style: { setProperty() {} } }, body: { classList: { add() {} } },
    querySelectorAll: selector => selector === '.imported-item' ? nodes : [] };
  const window = {
    HollowArt: { esc: String, itemArt: id => '<svg data-fallback="' + id + '"></svg>' },
    HollowUI: { S: { cat: { items: D.items }, view: { me: { inv: [{ id: 'tonic', n: 2 }] } } }, journal: () => '<p>Existing journal</p>' },
    HollowAssets: { ready: Promise.resolve(), get: id => manifest.assets[id], load: async id => {
      if (manifest.assets[id]) requests.push(id);
      return imageSuccess && manifest.assets[id] ? { src: 'https://example.test/' + manifest.assets[id].file, cloneNode: () => ({}) } : null;
    } }
  };
  vm.runInNewContext(await fs.readFile(new URL('js/presentation.js', game), 'utf8'), {
    window, document, URL, FontFace: undefined, fetch: async () => ({ ok: true, json: async () => config }),
    MutationObserver: class { observe() {} }, requestAnimationFrame: f => f()
  });
  await window.HollowPresentation.ready;
  await new Promise(resolve => setImmediate(resolve));
  return { window, nodes, requests };
}
test('item art loads once through the registry; failed icons preserve SVG and unknown ids request nothing', async () => {
  const failed = await presentation(false);
  assert.equal(failed.nodes[0].dataset.assetStatus, 'fallback');
  assert.equal(failed.nodes[0].children.length, 0);
  assert.equal(failed.nodes[2].dataset.assetStatus, undefined);
  const loaded = await presentation(true);
  assert.equal(loaded.nodes[0].dataset.assetStatus, 'ready');
  assert.equal(loaded.nodes[0].classes.has('pixel'), false, 'Task 4 illustrations must not be nearest-neighbour pixel art');
  assert.ok(loaded.nodes[1].classes.has('rarity-rare'));
  assert.equal(loaded.nodes[0].children.length, 1);
  assert.match(loaded.window.HollowArt.itemArt('tonic', 42), /data-fallback="tonic"/);
  loaded.nodes[0].children[0].remove = () => {};
  loaded.nodes[0].children[0].onerror();
  assert.equal(loaded.nodes[0].dataset.assetStatus, 'fallback');
  assert.ok(!loaded.nodes[0].classes.has('raster-ready'));
});
test('journal shows carried items only, and card badges use disclosed purchase labels or costs', async () => {
  const { window } = await presentation(false), ui = window.HollowUI, p = window.HollowPresentation;
  assert.match(ui.journal(), /Minor Tonic ×2/);
  assert.match(ui.journal(), /Existing journal/);
  assert.doesNotMatch(ui.journal(), /Saint/);
  assert.equal(p.itemForOption(null, 'Buy a Minor Tonic'), 'tonic');
  assert.equal(p.itemForOption({ cost: { item: 'candle' } }), 'candle');
  assert.equal(p.itemForOption(null, 'Salt the glass and read the dust'), null);
  assert.equal(p.itemForOption(null, 'Search the vestry'), null);
});
test('physical die preserves every authoritative face/tier and has twenty finite 3D faces', async () => {
  const window = { HollowArt: { esc: String, die: (n,tier) => '<svg data-original="' + n + ':' + tier + '"></svg>' } };
  vm.runInNewContext(await fs.readFile(new URL('js/physical-dice.js', game), 'utf8'), { window });
  for (let n = 1; n <= 20; n++) {
    const tier = n === 1 ? 'fumble' : n === 20 ? 'crit' : 'ok';
    const html = window.HollowArt.die(n, tier);
    assert.equal((html.match(/class="d20-face /g) || []).length, 20);
    assert.match(html, new RegExp('face-0[\\s\\S]*?text-anchor="middle">' + n + '</text>'));
    assert.match(html, new RegExp('data-original="' + n + ':' + tier + '"'));
    assert.doesNotMatch(html, /NaN|Infinity/);
    const numbers = [...html.matchAll(/text-anchor="middle">(\d+)<\/text>/g)].map(m => Number(m[1]));
    assert.deepEqual(numbers.slice().sort((a,b) => a-b), Array.from({ length: 20 }, (_,i) => i+1));
    const matrices = [...html.matchAll(/matrix3d\(([^)]+)\)/g)].map(m => m[1].split(',').map(Number));
    assert.ok(matrices.every(m => m.length === 16 && m.every(Number.isFinite)));
    const front = matrices[0];
    assert.ok(front[10] > .99, 'front normal must face the viewer');
  }
});
