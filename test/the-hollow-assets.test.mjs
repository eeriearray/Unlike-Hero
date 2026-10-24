import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const game = new URL('../games/the-hollow/', import.meta.url);
const registry = await fs.readFile(new URL('js/assets.js', game), 'utf8');
function browser(manifest, fail = false) {
  const calls = [];
  const window = {};
  const context = { window, URL, Map, document: { currentScript: { src: 'https://example.test/games/the-hollow/js/assets.js' } },
    fetch: async url => { calls.push(String(url)); if (fail) throw Error('offline'); return { ok: true, json: async () => manifest, arrayBuffer: async () => new ArrayBuffer(1) }; },
    Image: class { set src(url) { calls.push(url); queueMicrotask(() => this.onerror()); } } };
  vm.runInNewContext(registry, context);
  return { api: window.HollowAssets, calls };
}
test('manifest entries exist, byte counts match, payload stays below 40 MB', async () => {
  const raw = await fs.readFile(new URL('art/manifest.json', game));
  const manifest = JSON.parse(raw);
  let total = 0;
  for (const [id, asset] of Object.entries(manifest.assets)) {
    assert.match(id, /^[a-z0-9_]+$/);
    assert.match(asset.file, /^art\/generated\/[a-z0-9_]+\.(webp|mp3|ogg|ttf|mp4)$/);
    const size = (await fs.stat(new URL(asset.file, game))).size;
    assert.equal(size, asset.bytes);
    total += size;
    for (const region of asset.regions) assert.ok(manifest.regions[region].includes(id));
  }
  assert.ok(total > 0);
  assert.equal(total, manifest.totalBytes);
  assert.ok(total + raw.length < 40_000_000);
  for (const p of manifest.packs.filter(p => p.status === 'excluded')) {
    assert.equal(Object.values(manifest.assets).filter(a => a.pack === p.id).length, 0);
  }
});
test('unknown and unsafe ids never request media; images failing to load return null', async () => {
  const { api, calls } = browser({ version: 1, assets: {
    valid: { file: 'art/generated/test.webp', type: 'image', regions: ['village'] },
    unsafe: { file: '../private.png', type: 'image', regions: ['village'] }
  } });
  await api.ready;
  assert.equal(calls.length, 1); // Manifest only: no global media preload.
  assert.equal(await api.load('unknown'), null);
  assert.equal(await api.load('toString'), null);
  assert.equal(await api.load('unsafe'), null);
  await api.preloadRegion('woods');
  assert.equal(calls.length, 1);
  await api.preloadRegion('village');
  assert.equal(calls.length, 2);
  assert.equal(await api.load('valid'), null);
  assert.equal(api.allowedPaths['art/generated/test.webp'], undefined);
});
test('missing manifest leaves procedural mode usable', async () => {
  const { api, calls } = browser(null, true);
  await api.ready;
  assert.equal(await api.load('anything'), null);
  assert.equal(calls.length, 1);
});
test('decoded scene cache evicts old backgrounds and retains the current place', async () => {
  const assets = Object.fromEntries(Array.from({ length: 8 }, (_, i) => ['place' + i,
    { file: `art/generated/place${i}.webp`, type: 'image', regions: ['village'] }]));
  const calls = [];
  const window = {};
  class ImageOK {
    naturalWidth = 1024; naturalHeight = 1024;
    decode() { return Promise.resolve(); }
    set src(value) { calls.push(value); queueMicrotask(() => this.onload()); }
  }
  vm.runInNewContext(registry, { window, URL, Map, Image: ImageOK,
    document: { currentScript: { src: 'https://example.test/games/the-hollow/js/assets.js' } },
    fetch: async () => ({ ok: true, json: async () => ({ version: 1, assets }) }) });
  const api = window.HollowAssets;
  await api.ready;
  api.keep('place0');
  for (let i = 0; i < 8; i++) await api.load('place' + i);
  assert.ok(api.stats().backgrounds <= 6);
  assert.ok(api.stats().backgroundBytes <= api.stats().imageBudget);
  const before = calls.length;
  await api.load('place0');
  assert.equal(calls.length, before, 'the visible scene stays resident');
  await api.load('place1');
  assert.equal(calls.length, before + 1, 'the least recent neighbour is reloaded on demand');
});

test('replaced media uses content-versioned URLs while legacy assets retain their paths', async () => {
  const manifest = hash => ({version:1,assets:{item:{file:'art/generated/item.webp',type:'image',sha256:hash,regions:['shared']},legacy:{file:'art/generated/legacy.webp',type:'image',regions:[]}}});
  const a=browser(manifest('a'.repeat(64))).api,b=browser(manifest('b'.repeat(64))).api;
  await Promise.all([a.ready,b.ready]);
  assert.notEqual(a.url('item'),b.url('item'));
  assert.equal(new URL(a.url('item')).searchParams.get('v'),'a'.repeat(16));
  assert.equal(new URL(a.url('legacy')).search,'');
  assert.equal(a.url('missing'),null);
});

test('video URLs are allowlisted but video bytes are never globally prefetched', async () => {
 const {api,calls}=browser({version:1,assets:{trailer:{file:'art/generated/trailer.mp4',type:'video',regions:['shared']}}});
 await api.ready;assert.ok(api.url('trailer').endsWith('/art/generated/trailer.mp4'));
 assert.equal(await api.load('trailer'),null);await api.preloadRegion('shared');assert.equal(calls.length,1);
});
