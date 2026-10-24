import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../games/the-hollow/js/',import.meta.url);
class El {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.hidden=false;this.className='';this.dataset={};this.attrs={};this.open=false;this.isConnected=true;
 this.classList={add:(s)=>{if(!this.className.split(' ').includes(s))this.className+=' '+s;},remove:s=>{this.className=this.className.split(' ').filter(x=>x!==s).join(' ');},toggle:(s,b)=>b?this.classList.add(s):this.classList.remove(s)};}
 appendChild(e){this.children.push(e);e.parent=this;return e;}
 replaceChildren(...e){this.children=[];e.forEach(x=>this.appendChild(x));}
 remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,f){this[k]=f;}
 focus(){this.focused=true;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 cloneNode(){return new El(this.tagName);}
 querySelectorAll(s){return this.children.flatMap(e=>[...(s.startsWith('.')?e.className.split(' ').includes(s.slice(1)):e.tagName===s.toUpperCase())?[e]:[],...e.querySelectorAll(s)]);}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
 set innerHTML(html){this.children=[];for(const m of html.matchAll(/<(div|article|span|h1|p|button|small)\b([^>]*)>/g)){const e=new El(m[1]);e.className=/class="([^"]*)"/.exec(m[2])?.[1]||'';e.hidden=/\bhidden\b/.test(m[2]);this.appendChild(e);}}
}
function store(){const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};}
function arrival(){return {phase:'playing',code:'TEST',cosmetics:{runId:'TEST:1'},game:{round:1},you:'p',me:{loc:'square',status:'alive'},opening:{evidence:{}}};}
function startSuspense(h){const d=h.dialog();d.querySelector('.warning-listen').onclick();for(let i=0;i<3;i++)d.querySelector('.warning-next').onclick();}
function harness(storage=store()){
 let now=0,id=0,blocked=false;const timers=new Map(),listeners={},played=[];const body=new El('body'),host=body.appendChild(new El());
 const document={body,hidden:false,activeElement:null,createElement:t=>new El(t),querySelector:()=>blocked?{}:null,addEventListener:(k,f)=>(listeners[k]||=[]).push(f)};
 const prefs={jumpScares:true,reducedScares:false};
 const window={localStorage:storage,HollowFx:{prefs,reduced:()=>prefs.motion===true,apply(){}},HollowUI:{S:{ui:{},view:arrival()}},
 HollowAssets:{load:async()=>null},HollowScareFace:{draw:()=>true},HollowAudio:{sfx:n=>played.push(n),hush(){},caption(){},unlock(){}},HollowFeedbackAudio:{prepare(){},play:()=>played.push('IMPACT'),stop:()=>played.push('stop')},HollowStage:{el:()=>host},HollowEvents:{busy:()=>false}};
 const context={window,document,Set,Array,performance:{now:()=>now},setTimeout:(fn,ms)=>{const k=++id;timers.set(k,{fn,at:now+ms});return k;},clearTimeout:k=>timers.delete(k),setInterval:(fn,ms)=>{const k=++id;timers.set(k,{fn,at:now+ms,repeat:ms});return k;},clearInterval:k=>timers.delete(k)};
 for(const file of ['feedback-policy.js','dread.js'])vm.runInNewContext(fs.readFileSync(new URL(file,base),'utf8'),context);
 function advance(ms){for(let t=0;t<ms;t+=100){now+=Math.min(100,ms-t);for(const [k,v]of [...timers])if(v.at<=now){if(v.repeat)v.at=now+v.repeat;else timers.delete(k);v.fn();}}}
 return {d:window.HollowDread,window,document,body,host,prefs,played,advance,block:b=>blocked=b,dialog:()=>body.children.find(e=>e.tagName==='DIALOG'),dispatch:(k,e={})=>(listeners[k]||[]).forEach(f=>f(e))};
}
test('the warning needs a Listen gesture, builds to one scare, and continues exactly once',()=>{
 const h=harness(),v=arrival(),before=JSON.stringify(v);let continued=0;
 assert.ok(h.d.open(v,()=>continued++));h.advance(20000);assert.equal(h.played.includes('IMPACT'),false);
 const dialog=h.dialog();startSuspense(h);h.advance(6500);assert.equal(h.played.filter(x=>x==='IMPACT').length,1);
 assert.ok(dialog.querySelector('.dread-closeup'));h.advance(1500);assert.equal(dialog.querySelector('.warning-enter').hidden,false);dialog.querySelector('.warning-enter').onclick();dialog.querySelector('.warning-enter').onclick();assert.equal(continued,1);assert.equal(JSON.stringify(v),before);
});
test('each warning page waits indefinitely for the reader; only the door sequence is timed',()=>{
 const h=harness();h.d.open(arrival(),()=>{});const d=h.dialog();d.querySelector('.warning-listen').onclick();
 for(let page=0;page<3;page++){
  h.advance(60000);assert.equal(d.dataset.beat,page);assert.equal(h.played.includes('IMPACT'),false);
  assert.equal(d.querySelector('.warning-next').hidden,false);d.querySelector('.warning-next').onclick();
 }
 assert.equal(d.dataset.beat,3);assert.equal(d.querySelector('.warning-next').hidden,true);
 h.advance(4900);assert.ok(d.className.includes('warning-blackout'));assert.equal(h.played.includes('IMPACT'),false);
 h.advance(1500);assert.equal(h.played.filter(x=>x==='IMPACT').length,1);
 h.advance(1600);assert.equal(d.dataset.beat,4);h.advance(60000);assert.equal(d.dataset.beat,4);
});
test('Skip and Escape cancel pending scares and do not replay the warning after reload',()=>{
 const storage=store(),h=harness(storage);let continued=0;h.d.open(arrival(),()=>continued++);startSuspense(h);h.advance(5000);
 h.dispatch('keydown',{key:'Escape',preventDefault(){},stopImmediatePropagation(){}});h.advance(20000);assert.equal(continued,1);assert.equal(h.played.includes('IMPACT'),false);
 assert.equal(harness(storage).d.open(arrival(),()=>{}),false);
 const h2=harness();h2.d.open(arrival(),()=>continued++);h2.dialog().querySelector('.warning-skip').onclick();assert.equal(continued,2);
});
test('gentle preferences preserve the hook and continuation without a surprise or timer',()=>{
 for(const pref of ['reducedScares','motion','jumpScares']){
  const h=harness();h.prefs[pref]=pref!=='jumpScares';let done=0;h.d.open(arrival(),()=>done++);h.dialog().querySelector('.warning-listen').onclick();h.advance(30000);
  assert.equal(h.played.includes('IMPACT'),false);assert.equal(h.dialog().querySelector('.warning-enter').hidden,false);h.dialog().querySelector('.warning-enter').onclick();assert.equal(done,1);
 }
});
test('backgrounding pauses the build-up; changing effects cancels a shown scare immediately',()=>{
 const h=harness();h.d.open(arrival(),()=>{});startSuspense(h);h.advance(4200);
 h.document.hidden=true;h.dispatch('visibilitychange');h.advance(30000);assert.equal(h.played.includes('IMPACT'),false);
 h.document.hidden=false;h.dispatch('visibilitychange');h.advance(2300);assert.equal(h.played.filter(x=>x==='IMPACT').length,1);
 h.prefs.reducedScares=true;h.window.HollowFx.apply();assert.equal(h.body.querySelector('.dread-shock'),null);assert.equal(h.dialog().querySelector('.dread-shock'),null);
});
test('loaded discoveries never replay; fresh local discoveries wait for menus and persist their claims',()=>{
 const storage=store(),h=harness(storage),v=arrival();h.d.sync(v);
 v.me.loc='graveyard';v.opening.evidence.route=true;h.window.HollowUI.S.view=v;h.block(true);h.d.sync(v);h.advance(2000);assert.equal(h.played.includes('IMPACT'),false);
 h.block(false);h.advance(300);assert.equal(h.played.filter(x=>x==='IMPACT').length,1);
 h.advance(30000);h.d.sync(v);assert.equal(h.played.filter(x=>x==='IMPACT').length,1);
 const restored=harness(storage);restored.d.sync(v);restored.advance(30000);assert.equal(restored.played.includes('IMPACT'),false);
});
test('remote discoveries and old arrivals do not inject an unrelated local scare',()=>{
 const h=harness(),v=arrival();h.d.sync(v);v.opening.evidence.route=true;h.window.HollowUI.S.view=v;h.d.sync(v);h.advance(20000);assert.equal(h.played.includes('IMPACT'),false);
 assert.equal(h.d.open({...arrival(),game:{round:3}},()=>{}),false);
 assert.equal(h.d.open({...arrival(),opening:{evidence:{entered:true}}},()=>{}),false);
});
