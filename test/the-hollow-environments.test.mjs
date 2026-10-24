import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {data:D}=require('../games/the-hollow/engine/index.js');
const root=new URL('../games/the-hollow/',import.meta.url);
const read=async path=>JSON.parse(await fs.readFile(new URL(path,root),'utf8'));
const manifest=await read('art/manifest.json');

test('every location uses its own matching supplied illustration, without later-phase stock substitutions',async()=>{
 const index=await read('art/scenes/index.json'), hashes=new Set();
 for(const [id,loc] of Object.entries(D.locations)){
  const cfg=await read(index.places[id].file),entry=manifest.assets[cfg.background];
  assert.equal(entry.source,`environments/${loc.region}/${id}.webp`);
  assert.ok(['the_hollow_task1','the_hollow_task2'].includes(entry.pack));
  assert.deepEqual([entry.width,entry.height],[2560,1440]);
  assert.equal(cfg.artDirection,'supplied');
  assert.equal(Object.keys(cfg.moods).length,0);
  const bytes=await fs.readFile(new URL(entry.file,root));
  const hash=createHash('sha256').update(bytes).digest('hex');
  assert.ok(!hashes.has(hash),`duplicated scene: ${id}`);hashes.add(hash);
 }
 assert.equal(hashes.size,42);
});

test('specific interaction close-ups render their delivered artwork and retain fallback if unavailable',async()=>{
 const window={HollowArt:{esc:String,scene:()=>'<svg data-fallback="scene"></svg>'},
  HollowUI:{S:{view:{enc:null}}},HollowFx:{reduced:()=>false},
  HollowStage:{place:()=>null,refresh(){},el:()=>null,cat:()=>({locations:D.locations,regions:D.regions})},
  HollowAssets:{get:id=>manifest.assets[id],url:id=>'/'+manifest.assets[id].file,
   allowedPaths:Object.fromEntries(Object.values(manifest.assets).map(e=>[e.file,true]))}};
 const source=await fs.readFile(new URL('js/photo-scenes.js',root),'utf8');
 vm.runInNewContext(source,{window,URL,Set,Number,document:{currentScript:{src:'https://example.test/games/the-hollow/js/photo-scenes.js'}},
  fetch:async url=>({ok:true,json:()=>read(new URL(url).pathname.split('/games/the-hollow/')[1])})});
 const api=window.HollowPhotoScenes;
 for(const [loc,id,expected] of [['square','board','notice_board_closeup'],['square','well','well_closeup'],['belltower','frame','bell_frame_closeup'],['belltower','climb','belfry_interior'],['belltower','listen','hanging_rope_closeup']]){
  await api.ensure(loc);const scene=api.resolve(loc,{objects:{}}),detail=scene.objects[id].closeup;
  assert.ok(detail.includes(expected));
  assert.equal(manifest.assets[detail].type,'image');
  assert.ok(api.closeup(scene,id,'big').includes(manifest.assets[detail].file));
  delete window.HollowAssets.allowedPaths[manifest.assets[detail].file];
  const fallback=api.closeup(scene,id,'big');
  assert.doesNotMatch(fallback,/<img/);assert.match(fallback,/data-fallback="scene"/);
 }
});

test('chapter, endings and reserve artwork are installed, and the separate Task 2 manifest matches',async()=>{
 const window={};vm.runInNewContext(await fs.readFile(new URL('js/chapter-art.js',root),'utf8'),{window});
 const chapter=window.HollowChapterArt,report=await read('art/environment-import-report.json');
 assert.equal(manifest.assets[chapter.title].source,'chapter/chapter_one.webp');
 assert.equal(Object.keys(chapter.endings).length,7);
 for(const [key,id]of Object.entries(chapter.endings))assert.equal(manifest.assets[id].source,`endings/ending_${key}.webp`);
 assert.equal(report.deliveries.task1.images.length,23);assert.equal(report.deliveries.task2.images.length,35);
 assert.equal(report.externalManifestMatchesArchive,true);
 for(const key of ['caretaker_room','caretaker_note_blank'])assert.ok(manifest.assets[report.supplemental[key]]);
});
