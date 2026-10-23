import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {data: D} = require('../games/the-hollow/engine/index.js');
const root = new URL('../games/the-hollow/', import.meta.url);
const json = async file => JSON.parse(await fs.readFile(new URL(file, root), 'utf8'));

test('Task 4 item variants match every engine item and preserve transparent masters', async () => {
  const manifest = await json('art/manifest.json'), p = await json('art/presentation.json');
  for (const id of Object.keys(D.items)) {
    for (const [key, size] of [['thumb',128],['asset',256],['detail',1024]]) {
      const a = manifest.assets[p.items[id][key]];
      assert.ok(a, `${id}/${key}`);
      assert.equal(a.pack, 'the_hollow_task4');
      assert.deepEqual([a.width,a.height], [size,size]);
      assert.equal(a.alpha[0], 0, 'background must include transparent pixels');
      assert.ok(a.alpha[1] > 0, 'illustration must not be empty');
      await fs.access(new URL(a.file, root));
    }
  }
});
test('imported symbols render as vector artwork while legacy and unknown symbols remain usable', async () => {
  const window = {};
  for (const file of ['js/task4-icons.js','js/art.js']) vm.runInNewContext(await fs.readFile(new URL(file,root),'utf8'), {window});
  assert.equal(Object.keys(window.HollowGlyphs).length,29);
  const icon = window.HollowArt.glyph('chest',24);
  assert.match(icon,/viewBox="0 0 128 128"/);
  assert.match(icon,/width="24"/);
  assert.doesNotMatch(icon,/<script|onload=|href=|url\(/i);
  assert.notEqual(window.HollowArt.glyph('navigation/current_location'), window.HollowArt.glyph('navigation/visited_location'));
  assert.match(window.HollowArt.glyph('bell'),/viewBox="0 0 24 24"/);
  assert.match(window.HollowArt.glyph('unknown'),/<svg/);
});
test('supplied UI kit and effects resolve through the central registry without replacing scene art', async () => {
  const p=await json('art/presentation.json'), f=await json('art/feedback.json'), m=await json('art/manifest.json');
  assert.equal(Object.keys(p.components).length,18);
  for(const id of [...Object.values(p.components),...Object.values(f.atmosphere)]) {
    assert.equal(m.assets[id]?.pack,'the_hollow_task4');
    assert.equal(m.assets[id]?.type,'image');
  }
  const scenes=await json('art/scenes/index.json');
  assert.ok(Object.values(scenes.places).every(p => m.assets[p.background].pack !== 'the_hollow_task4'));
});

test('updated Task 4 media has verified delivery provenance and intact prepared bytes', async () => {
  const delivery = await json('art/task4-delivery-manifest.json');
  const manifest = await json('art/manifest.json'), report = await json('art/task4-import-report.json');
  const rows = new Map(delivery.assets.map(a => [a.path,a]));
  assert.equal(rows.size,188);
  assert.equal(report.deliveryManifest.verifiedFiles,188);
  let count=0;
  for(const entry of Object.values(manifest.assets).filter(a=>a.pack==='the_hollow_task4')) {
    assert.equal(entry.sourceSha256, rows.get(entry.source)?.sha256,entry.source);
    assert.equal(entry.sha256,createHash('sha256').update(await fs.readFile(new URL(entry.file,root))).digest('hex'),entry.file);
    count++;
  }
  assert.equal(count,137);
});
