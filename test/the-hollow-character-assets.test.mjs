import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const game = new URL('../games/the-hollow/', import.meta.url);
const source = await fs.readFile(new URL('js/character-assets.js',game),'utf8');
test('full delivery covers six heroes, ten enemies and four NPCs with budgeted derivatives',async()=>{
 const m=JSON.parse(await fs.readFile(new URL('art/manifest.json',game)));
 const map=JSON.parse(await fs.readFile(new URL('art/character-art.json',game)));
 assert.equal(Object.keys(map.heroes).length,6);assert.equal(Object.keys(map.enemies).length,10);assert.equal(Object.keys(map.npcs).length,4);
 const entries=Object.values(m.assets).filter(a=>a.pack==='the_hollow_task3');assert.equal(entries.length,52);
 for(const a of entries){assert.equal((await fs.stat(new URL(a.file,game))).size,a.bytes);if(a.source.includes('fullbody')){assert.equal(a.transparent,true);assert.ok(a.width<=1200 && a.height<=1200);assert.deepEqual(a.sourceDimensions,a.source.includes('carrion_swarm')||a.source.includes('hollow_hound')?[2400,1800]:[1600,2400]);}if(a.source.includes('silhouette'))assert.equal(a.transparent,false);}
});
test('supplied character wrappers preserve unknown heroes, fallback markup and explicit accessible labels',async()=>{
 const g={HollowArt:{esc:s=>s,portrait:id=>`seal:${id}`,enemy:id=>`foe:${id}`},HollowHeroes:{art:id=>`hero:${id}`},HollowAssets:{ready:Promise.resolve()}};
 const doc={currentScript:{src:'https://example.test/js/character-assets.js'},getElementById:()=>null,body:{},querySelectorAll:()=>[]};
 vm.runInNewContext(source,{window:g,document:doc,URL,fetch:async()=>({ok:false}),requestAnimationFrame:()=>{}});
 assert.equal(g.HollowHeroes.art('unknown'),'hero:unknown');assert.equal(g.HollowArt.enemy('unknown'),'foe:unknown');
 assert.match(g.HollowHeroes.art('hunter'),/data-character-id="hunter"/);
 assert.match(g.HollowArt.enemy('abbey_warden'),/data-character-id="abbey_warden"/);
 assert.match(g.HollowHeroes.art('occultist'),/data-character-variant="fullbody"/);assert.match(g.HollowHeroes.art('occultist'),/hero:occultist/);
 assert.match(g.HollowArt.portrait('occultist'),/aria-label="Occultist"/);assert.match(g.HollowArt.enemy('bellkeeper'),/foe:bellkeeper/);
});
