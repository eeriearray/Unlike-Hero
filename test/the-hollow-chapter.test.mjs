import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../games/the-hollow/',import.meta.url);
const files=await Promise.all(['art.js','ui.js','story.js','map.js','chapter-art.js','chapter.js'].map(f=>fs.readFile(new URL('js/'+f,root),'utf8')));
const fixture=JSON.parse(await fs.readFile(new URL('art/chapter-preview.json',root),'utf8'));
const manifest=JSON.parse(await fs.readFile(new URL('art/manifest.json',root),'utf8'));
const clone=v=>JSON.parse(JSON.stringify(v));
function harness({denied=false}={}){
 let now=0,next=0;const intervals=new Map(),frames=[],listeners={},memory=new Map();let doc;
 function match(el,s){if(s.startsWith('#'))return el.id===s.slice(1);if(s.startsWith('.'))return el.className.split(' ').includes(s.slice(1));const m=s.match(/^\[data-([a-z-]+)="([^"]+)"\]$/);if(m)return el.dataset[m[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]===m[2];return el.tag===s;}
 class El{
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.className='';this.id='';this.style={};this.classList={add:k=>{this.className+=' '+k;},toggle:(k,on)=>{if(on)this.className+=' '+k;else this.className=this.className.split(' ').filter(x=>x!==k).join(' ');}};}
  get isConnected(){return this===doc.body||!!this.parent?.isConnected;}
  appendChild(el){el.parent=this;this.children.push(el);return el;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}
  setAttribute(k,v){this.attrs[k]=v;}
  get all(){return this.children.flatMap(e=>[e,...e.all]);}
  querySelectorAll(s){return this.all.filter(e=>s.split(',').some(x=>match(e,x.trim())));}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  set innerHTML(html){this.children=[];for(const m of html.matchAll(/<([a-z][a-z0-9-]*)([^>]*)>/g)){const el=new El(m[1]);for(const a of m[2].matchAll(/([a-z-]+)="([^"]*)"/g)){if(a[1]==='id')el.id=a[2];else if(a[1]==='class')el.className=a[2];else if(a[1].startsWith('data-'))el.dataset[a[1].slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=a[2];}this.appendChild(el);}}
  getBoundingClientRect(){return {left:20,top:30,bottom:70,width:this.tag==='section'?300:60,height:this.tag==='section'?240:40};}
  focus(){doc.activeElement=this;}
  showModal(){this.open=true;} close(){this.open=false;}
  addEventListener(){} closest(){return this;}
  click(){this.clicked=(this.clicked||0)+1;dispatch('click',this);}
 }
 const body=new El();doc={body,hidden:false,activeElement:null,createElement:t=>new El(t),querySelectorAll:s=>body.querySelectorAll(s),querySelector:s=>body.querySelector(s),getElementById:id=>body.querySelector('#'+id),addEventListener:(k,fn)=>(listeners[k]||=[]).push(fn)};
 const storage={getItem:k=>{if(denied)throw Error('denied');return memory.get(k);},setItem:(k,v)=>{if(denied)throw Error('denied');memory.set(k,v);}};
 const window={localStorage:storage,addEventListener(){},HollowAssets:{ready:Promise.resolve(),load:async()=>null},HollowFx:{prefs:{},reduced:()=>false},HollowAudio:{settings:()=>({master:.8,music:.55,ambient:.75,sfx:.85}),unlock(){},setRegion(){},setMood(){}}};
 function dispatch(k,target,extra={}){const e={target,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(const fn of listeners[k]||[]){fn(e);if(e.stopped)break;}return e;}
 const sandbox={window,document:doc,innerWidth:390,innerHeight:844,performance:{now:()=>now},requestAnimationFrame:fn=>frames.push(fn),cancelAnimationFrame(){},setInterval:(fn)=>{intervals.set(++next,fn);return next;},clearInterval:id=>intervals.delete(id)};
 for(const source of files)vm.runInNewContext(source,sandbox);
 window.HollowUI.S.cat=clone(fixture.catalog);window.HollowUI.S.net={kind:'offline'};
 return {w:window,c:window.HollowChapter,doc,memory,intervals,El,dispatch,advance(ms){now+=ms;[...intervals.values()].forEach(fn=>fn());},flush(){frames.splice(0).forEach(fn=>fn());},view(v){window.HollowUI.S.view=clone(v);}};
}
test('title and seven ending images exist, are unique, and use registry IDs',async()=>{
 const h=harness(),art=h.w.HollowChapterArt;assert.equal(new Set(Object.values(art.endings)).size,7);
 for(const id of [art.title,...Object.values(art.endings)]){assert.equal(manifest.assets[id].type,'image');await fs.access(new URL(manifest.assets[id].file,root));}
});
test('title keeps solo, host, join and save controls; ending wrappers retain full legacies',()=>{
 const h=harness(),UI=h.w.HollowUI;const title=UI.title({online:true,solo:true,last:{code:'TEST'}});
 for(const action of ['solo','host','join','solo-continue','rejoin'])assert.ok(title.includes('data-act="'+action+'"'));
 for(const [key,v]of Object.entries(fixture.endings)){h.view(v);const before=JSON.stringify(UI.S.view),html=UI.ending();assert.ok(html.includes('data-ending="'+key+'"'));assert.match(html,/Complete expedition record/);assert.match(html,/Personal legacies/);assert.match(html,/Play again/);assert.equal(JSON.stringify(UI.S.view),before);}
});
test('ending variants keep the right photograph, and unknown IDs have a safe fallback',()=>{
 const h=harness();for(const key of Object.keys(fixture.endings)){assert.equal(h.c.endingKey({id:key+'_flawed'}),key);assert.equal(h.c.endingKey({endingKey:key,id:'anything'}),key);}
 assert.equal(h.c.endingKey({endingKey:'__proto__',id:'unexpected'}),'doom');
});
test('summaries use actual rounds, clues, relics and fates, including bound survivors',()=>{
 const h=harness(),v={ended:{round:8,results:[{name:'A',fate:'survived',relics:['x']},{name:'B',fate:'fallen',relics:[]},{name:'C',fate:'bound',relics:['y']}]},world:{clues:[{},{}]}};
 const s=h.c.summary(v);assert.equal(s.rounds,8);assert.equal(s.clues,2);assert.equal(s.relics,2);assert.deepEqual(Array.from(s.survivors),['A','C (bound to the ledger)']);
});
test('prologue lasts 60 visible seconds, pauses when hidden, and completion fires once',()=>{
 const h=harness();let completed=0;h.c.openIntro(()=>completed++);assert.equal(h.doc.querySelector('progress').value,0);h.advance(15000);assert.equal(h.doc.querySelector('h2').textContent,'A bell with no keeper');
 h.doc.hidden=true;h.advance(90000);assert.equal(completed,0);h.doc.hidden=false;h.advance(44000);assert.equal(completed,0);h.advance(1000);assert.equal(completed,1);assert.equal(h.intervals.size,0);h.c.finishIntro();assert.equal(completed,1);assert.ok(h.memory.get('hollow.prologue.v1'));
});
test('new games begin immediately; prologue remains available on request',()=>{
 const h=harness();
 for(const action of ['host','solo','join','rejoin','solo-continue']){const b=h.doc.body.appendChild(new h.El('button'));b.dataset.act=action;assert.equal(h.dispatch('click',b).stopped,undefined);}
 assert.equal(h.doc.querySelector('.chapter-intro'),null);
 h.c.openIntro();assert.ok(h.doc.querySelector('.chapter-intro'));h.c.finishIntro();
});
test('five HUD tips finish and persist; blocked storage does not break intro or tour',()=>{
 for(const denied of [false,true]){const h=harness({denied});h.view(fixture.playing);h.c.openTour();assert.ok(h.doc.querySelector('.chapter-tip'));
 for(let i=0;i<5;i++)h.dispatch('click',h.doc.querySelector('[data-chapter="tip-next"]'));
 assert.equal(h.doc.querySelector('.chapter-tip'),null);if(!denied)assert.ok(h.memory.get('hollow.hud-guide.v1'));assert.doesNotThrow(()=>{h.c.openIntro();h.c.finishIntro();});}
});
test('parchment map preserves the authoritative graph and fog, with four distinct route symbols',()=>{
 const h=harness();h.view(fixture.playing);const v=h.w.HollowUI.S.view,before=JSON.stringify(v),svg=h.w.HollowMap.render();assert.match(svg,/chapter-map/);assert.match(svg,/fogmask/);assert.match(svg,/data-bg="1"/);
 const nodes=[...svg.matchAll(/data-act="selnode" data-loc="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(nodes.sort(),Object.keys(v.map.locs).sort());
 for(const kind of ['path','hidden','locked','guarded'])assert.ok(svg.includes('data-route="'+kind+'"'));
 assert.equal([...svg.matchAll(/class="map-road/g)].length,v.map.edges.length);assert.equal(JSON.stringify(v),before);assert.equal(h.w.HollowMap.roadKind({type:'hidden',state:'locked'}),'locked');
});
test('HUD tips replace legacy coaching and can be replayed from in-game Settings only',()=>{
 const h=harness();assert.equal(h.w.HollowStory.coach(),'');assert.doesNotMatch(h.w.HollowUI.settingsModal(),/Show the five HUD tips/);h.view(fixture.playing);assert.match(h.w.HollowUI.settingsModal(),/Show the five HUD tips/);assert.equal(h.c.tips.length,5);assert.equal(h.c.scenes.length,4);
});
