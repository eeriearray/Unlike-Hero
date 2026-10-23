import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../games/the-hollow/',import.meta.url);
const files=await Promise.all(['art.js','heroes.js','characters.js'].map(f=>fs.readFile(new URL('js/'+f,root),'utf8')));
const ids='whisperling drowned_pilgrim hollow_stag grave_warden mirror_twin bellkeeper carrion_swarm hollow_hound weeping_statue abbey_warden'.split(' ');
function el(){const classes=new Set();return {classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),toggle(k,b){if(b)classes.add(k);else classes.delete(k);},contains:k=>classes.has(k)},offsetWidth:100,remove(){this.removed=true;}};}
function harness(){
 let now=0,id=0;const timers=new Map(),frames=[];const body=el(),foe=el(),hero=el(),hud=el(),scene=el();
 const document={body,hidden:false,addEventListener(){},querySelectorAll:s=>s==='.combat-scene'?[scene]:s==='.battle-foe'?[foe]:s==='.battle-hero'?[hero]:s==='#hud-me, .hp-p.you'||s==='#hud-me .character-art'?[hud]:[]};
 const window={HollowStory:{adventure:()=>'<button>Choose</button>'},HollowUI:{S:{view:null}},HollowFx:{prefs:{reducedScares:false},reduced:()=>false}};
 const sandbox={window,document,requestAnimationFrame:fn=>frames.push(fn),setTimeout:(fn,ms)=>{const n=++id;timers.set(n,{fn,at:now+ms});return n;},clearTimeout:n=>timers.delete(n)};
 for(const source of files) vm.runInNewContext(source,sandbox);
 function flush(){frames.splice(0).forEach(fn=>fn());}
 function advance(ms){const target=now+ms;for(let count=0;count<100;count++){const ready=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!ready)break;now=ready[1].at;timers.delete(ready[0]);ready[1].fn();}now=target;flush();}
 return {window,c:window.HollowCharacters,body,foe,hero,hud,scene,flush,advance,sync(v){window.HollowUI.S.view=v;window.HollowCharacters.sync(v);flush();}};
}
const view=()=>({phase:'playing',you:'p0',code:'TEST',cosmetics:{runId:'TEST:1'},me:{cls:'hunter',status:'alive',loc:'square'},players:[{id:'p0',cls:'hunter'},{id:'p1',cls:'medium'}],log:[{n:1,k:'enemy',d:{k:'enemy'}}],enc:{id:'e1',pid:'p0',kind:'enemy',loc:'square',enemy:{id:'whisperling',name:'Whisperling',hp:3,max:4}}});
test('all six heroes and ten foes retain original SVGs with scoped paint and rim filters',()=>{
 const h=harness(),all=[];
 for(const id of h.window.HollowHeroes.order)all.push(h.window.HollowHeroes.art(id,''));
 for(const id of ids)all.push(h.window.HollowArt.enemy(id));
 all.push(h.window.HollowArt.enemy('whisperling'));all.push(h.window.HollowArt.portrait('hunter','#aaa'));
 const used=new Set();for(const svg of all){assert.match(svg,/feTurbulence/);assert.match(svg,/feDisplacementMap/);assert.match(svg,/feMorphology/);assert.match(svg,/character-figure/);for(const [,id]of svg.matchAll(/id="([^"]+)"/g)){assert.ok(!used.has(id),'duplicate '+id);used.add(id);}}
});
test('combat requires a local active encounter and uses the actual actor and server health',()=>{
 const h=harness(),v=view(),before=JSON.stringify(v);const b=h.c.battle(v);assert.equal(b.hp,3);assert.equal(b.hero,'hunter');assert.equal(JSON.stringify(v),before);
 assert.equal(h.c.battle({...v,enc:{...v.enc,loc:'forest'}}),null);assert.equal(h.c.battle({...v,enc:{...v.enc,over:true}}),null);assert.equal(h.c.battle({...v,phase:'ended'}),null);
 v.enc.pid='p1';assert.equal(h.c.battle(v).hero,'medium');assert.equal(h.c.html(b),h.c.html(b),'stable markup keeps idle motion from restarting');assert.match(h.c.html(b),/Enemy health 3 of 4/);
});
test('loaded combat history never replays attacks or defeats',()=>{
 const h=harness(),v=view();v.log.push({n:2,k:'dmg',p:'p0',d:{k:'vit',n:-2}},{n:3,k:'enemy',p:'p0',loc:'square',d:{k:'defeat',id:'whisperling'}});h.sync(v);h.advance(1000);
 assert.ok(h.body.classList.contains('combat-active'));assert.equal(h.foe.classList.contains('character-dying'),false);assert.equal(h.hero.classList.contains('character-hit'),false);
});
test('confirmed hit and defeat follow the result beat and then restore the normal scene',()=>{
 const h=harness(),v=view();h.sync(v);v.enc={...v.enc,over:true};const r={by:'p0',loc:'square',chips:[{k:'enemy',n:-3}]};v.log.push({n:2,k:'enemy',p:'p0',loc:'square',d:{k:'defeat',id:'whisperling'}},{n:3,k:'result',loc:'square',d:{result:r}});h.sync(v);
 assert.ok(h.body.classList.contains('combat-active'));assert.equal(h.foe.classList.contains('character-dying'),false);h.c.result(r);assert.ok(h.foe.classList.contains('character-hit'));h.advance(380);assert.ok(h.foe.classList.contains('character-dying'));
 h.sync(v);assert.ok(h.body.classList.contains('combat-active'));h.advance(900);assert.equal(h.body.classList.contains('combat-active'),false);assert.ok(h.scene.removed);
});
test('retreat never dissolves a living foe; location change cancels delayed hits',()=>{
 const h=harness(),v=view();h.sync(v);h.c.result({by:'p0',loc:'square',chips:[{k:'vit',n:-1}]});v.me.loc='forest';v.enc=null;h.sync(v);h.advance(1000);assert.equal(h.hero.classList.contains('character-hit'),false);assert.equal(h.foe.classList.contains('character-dying'),false);assert.equal(h.body.classList.contains('combat-active'),false);
});
test('remote actors do not flash my HUD; reduced scares replace the attack lunge',()=>{
 const h=harness(),v=view();v.enc.pid='p1';h.sync(v);h.c.result({by:'p1',loc:'square',chips:[{k:'vit',n:-1}]});h.advance(360);assert.ok(h.hero.classList.contains('character-hit'));assert.equal(h.hud.classList.contains('character-hit'),false);
 h.window.HollowFx.prefs.reducedScares=true;h.foe.classList.remove('character-attacking');h.c.reaction('attack');assert.equal(h.foe.classList.contains('character-attacking'),false);assert.ok(h.foe.classList.contains('character-hit'));
});
test('boss telegraph uses authoritative values without exposing normal enemy weakness',()=>{
 const h=harness(),v=view();v.enc={id:'b1',pid:'p0',kind:'boss',loc:'square',boss:{hp:6,max:12,attack:{vit:-2,san:-1},phase:'Unbound'}};const b=h.c.battle(v);assert.equal(b.id,'abbey_warden');assert.match(h.c.html(b),/Next blow: 2 Vitality · 1 Sanity/);
 assert.doesNotMatch(h.c.html(h.c.battle(view())),/Weakness known/);h.sync(v);h.c.result({by:'p0',loc:'forest',chips:[{k:'enemy',n:-2}]});assert.equal(h.foe.classList.contains('character-hit'),false);
});

test('a newly fallen hero dissolves once; loading a fallen snapshot does not replay it',()=>{
 const h=harness(),v=view();h.sync(v);v.me.status='fallen';v.enc=null;v.log.push({n:2,k:'fall',p:'p0'});h.sync(v);assert.ok(h.hud.classList.contains('character-dying'));assert.ok(h.body.classList.contains('character-fallen'));h.advance(1000);h.sync(v);assert.equal(h.hud.classList.contains('character-dying'),false);
 const reload=harness();reload.sync(v);assert.equal(reload.hud.classList.contains('character-dying'),false);v.me.status='alive';h.sync(v);assert.equal(h.body.classList.contains('character-fallen'),false);
});
