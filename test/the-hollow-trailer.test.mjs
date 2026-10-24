import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const root=new URL('../games/the-hollow/',import.meta.url);
const code=await fs.readFile(new URL('js/trailer.js',root),'utf8');
function harness({muted=false,reduced=false,missing=false,deferred=false,rejectPlayback=false}={}) {
 const listeners={},focus=[],mix=[],docs=[],timers=new Map();let timerId=0;let resolve;const trigger={isConnected:true,focus(){focus.push('trigger');}};
 const doc={activeElement:trigger,hidden:false,addEventListener(k,f){listeners[k]=f;},body:{appendChild(el){el.isConnected=true;docs.push(el);}},createElement(){
  function control(name){return {disabled:false,textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;},focus(){doc.activeElement=this;focus.push(name);},addEventListener(k,f){this[k]=f;}};}
  const button=control('close'),toggle=control('toggle'),mute=control('mute');toggle.disabled=true;
  const details={open:false,focus(){doc.activeElement=details;}};
  const video={paused:true,plays:0,pauses:0,loads:0,events:{},pause(){this.paused=true;this.pauses++;},load(){this.loads++;},play(){this.plays++;if(rejectPlayback)return Promise.reject(Error('playback blocked'));this.paused=false;},removeAttribute(k){delete this[k];},addEventListener(k,f){this.events[k]=f;}};
  const status={textContent:''},ambient={style:{}},glow={draws:0,getContext(){return {drawImage:()=>this.draws++};}},classes=new Set();
  return {video,button,toggle,mute,details,status,glow,classes,classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),toggle(k,on){if(on)classes.add(k);else classes.delete(k);}},events:{},setAttribute(){},innerHTML:'',showModal(){this.open=true;},close(){this.open=false;},remove(){this.isConnected=false;docs.splice(docs.indexOf(this),1);},addEventListener(k,f){this.events[k]=f;},querySelector(s){return {'video':video,'.trailer-status':status,'details':details,'[data-trailer-close]':button,'[data-trailer-toggle]':toggle,'[data-trailer-mute]':mute,'canvas':glow,'.trailer-ambient':ambient}[s];},querySelectorAll(){return [button,toggle,mute,details];}};
 }};
 const window={HollowArt:{esc:x=>x},HollowAssets:{ready:deferred?new Promise(r=>resolve=r):Promise.resolve(),url:id=>missing?null:'https://example.test/'+id},HollowAudio:{settings:()=>({muted,master:.42}),setMediaFocus:v=>mix.push(v)},HollowFx:{prefs:{reducedScares:reduced},reduced:()=>reduced}};
 vm.runInNewContext(code,{window,document:doc,Promise,setTimeout(f){timers.set(++timerId,f);return timerId;},clearTimeout(id){timers.delete(id);}});
 return {api:window.HollowTrailer,timers,docs,listeners,doc,mix,focus,resolve:()=>resolve()};
}
test('trailer opens once, has no autoplay, respects user audio, and releases media/focus on close',async()=>{
 const h=harness({muted:true});assert.ok(await h.api.open());const el=h.docs[0];
 assert.equal(el.video.plays,0);assert.equal(el.video.volume,.42);assert.equal(el.video.muted,true);
 assert.equal(await h.api.open(),false);assert.equal(h.docs.length,1);
 el.button.click();assert.equal(h.docs.length,0);assert.equal(el.video.src,undefined);assert.equal(el.video.pauses,1);assert.equal(el.video.loads,1);
 assert.deepEqual(h.mix,[true,false]);assert.equal(h.focus.at(-1),'trigger');h.api.close();assert.equal(el.video.loads,1);
});
test('reduced effects exposes the story and failed video remains readable and closable',async()=>{
 const h=harness({reduced:true});await h.api.open();const el=h.docs[0];assert.ok(el.details.open);assert.equal(el.video.plays,0);
 el.video.events.error();assert.match(el.status.textContent,/could not load/);
 let prevented=false;h.listeners.keydown({key:'Escape',preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(h.docs.length,0);
 const missing=harness({missing:true});assert.equal(await missing.api.open(),false);assert.ok(missing.docs[0].details.open);missing.api.close();
});
test('closing during catalogue loading never starts a detached video; backgrounding pauses playback',async()=>{
 const h=harness({deferred:true});const pending=h.api.open();const el=h.docs[0];h.api.close();h.resolve();assert.equal(await pending,false);assert.equal(el.video.src,undefined);
 const other=harness();await other.api.open();const video=other.docs[0].video;video.play();other.doc.hidden=true;other.listeners.visibilitychange();assert.ok(video.paused);assert.equal(video.plays,1);other.api.close();
});
test('prepared opening media retains source provenance, byte integrity and the shared asset budget',async()=>{
 const m=JSON.parse(await fs.readFile(new URL('art/manifest.json',root),'utf8'));
 for(const id of ['opening_trailer','opening_trailer_poster','opening_belfry_interior']){
  const e=m.assets[id],bytes=await fs.readFile(new URL(e.file,root));assert.equal(bytes.length,e.bytes);assert.match(e.sourceSha256,/^[a-f0-9]{64}$/);assert.equal(createHash('sha256').update(bytes).digest('hex'),e.sha256);
 }
 assert.equal(m.assets.opening_trailer.type,'video');assert.equal(m.assets.opening_trailer.seconds,60);assert.ok(m.assets.opening_trailer.onDemand);assert.ok(m.totalBytes<40_000_000);
});

test('trailer keyboard focus stays within the player until Escape restores its trigger',async()=>{
 const h=harness();await h.api.open();const el=h.docs[0];let prevented=0;
 h.doc.activeElement=el.details;h.listeners.keydown({key:'Tab',shiftKey:false,preventDefault(){prevented++;}});assert.equal(h.doc.activeElement,el.button);
 h.listeners.keydown({key:'Tab',shiftKey:true,preventDefault(){prevented++;}});assert.equal(h.doc.activeElement,el.details);assert.equal(prevented,2);h.api.close();
});

test('hosting starts playback and continues exactly once when skipped or finished',async()=>{
 for(const finish of ['skip','ended','escape']) {
  const h=harness();let hosted=0;
  await h.api.open({autoplay:true,after:()=>hosted++});const el=h.docs[0];
  assert.equal(hosted,0);assert.equal(el.video.plays,1);assert.match(el.innerHTML,/Skip trailer/);
  if(finish==='skip')el.button.click();
  if(finish==='ended')el.video.events.ended();
  if(finish==='escape')h.listeners.keydown({key:'Escape',preventDefault(){}});
  assert.equal(hosted,1);h.api.close();el.video.events.ended();assert.equal(hosted,1);
 }
});
test('host retries cannot create duplicate continuations, and unavailable video remains skippable',async()=>{
 const h=harness({missing:true});let hosted=0,duplicate=0;
 await h.api.open({autoplay:true,after:()=>hosted++});
 assert.equal(await h.api.open({autoplay:true,after:()=>duplicate++}),false);
 assert.equal(hosted,0);h.docs[0].button.click();assert.equal(hosted,1);assert.equal(duplicate,0);
});
test('hosting respects reduced effects and never starts a video closed during catalogue loading',async()=>{
 const reduced=harness({reduced:true});await reduced.api.open({autoplay:true,after:()=>{}});assert.equal(reduced.docs[0].video.plays,0);reduced.api.close();
 const pending=harness({deferred:true});let hosted=0;
 const opening=pending.api.open({autoplay:true,after:()=>hosted++});const video=pending.docs[0].video;
 pending.api.close();pending.resolve();await opening;assert.equal(hosted,1);assert.equal(video.plays,0);
});

test('a browser playback rejection leaves Play and Skip available without hosting early',async()=>{
 const h=harness({rejectPlayback:true});let hosted=0;
 await h.api.open({autoplay:true,after:()=>hosted++});await Promise.resolve();
 assert.match(h.docs[0].status.textContent,/Press Play/);assert.equal(hosted,0);
 h.docs[0].button.click();assert.equal(hosted,1);
});


test('cinematic playback uses custom controls and releases the ambient animation when paused or closed',async()=>{
 const h=harness();await h.api.open({autoplay:true});const el=h.docs[0];
 assert.doesNotMatch(el.innerHTML,/<video[^>]*\scontrols(?:\s|>)/);assert.equal(el.toggle.textContent,'Pause');assert.equal(el.glow.draws,1);assert.equal(h.timers.size,1);
 el.toggle.click();assert.ok(el.video.paused);assert.equal(el.toggle.textContent,'Play');assert.equal(h.timers.size,0);
 el.toggle.click();assert.equal(el.video.plays,2);assert.equal(h.timers.size,1);
 el.mute.click();assert.equal(el.video.muted,true);assert.equal(el.mute.attrs['aria-label'],'Unmute trailer');
 h.api.close();assert.equal(h.timers.size,0);
});
test('cinema keyboard shortcuts pause and mute while Space retains normal button behavior',async()=>{
 const h=harness();await h.api.open({autoplay:true});const el=h.docs[0];let prevented=0;
 const key=(key,target)=>h.listeners.keydown({key,target,preventDefault(){prevented++;}});
 key('k');assert.ok(el.video.paused);key(' ');assert.equal(el.video.paused,false);
 key(' ',{closest:()=>el.button});assert.equal(el.video.paused,false);assert.equal(prevented,2);
 key('m');assert.equal(el.video.muted,true);h.api.close();
});
test('reduced effects keep the ambient background static even after explicit playback',async()=>{
 const h=harness({reduced:true});await h.api.open({autoplay:true});const el=h.docs[0];
 el.toggle.click();assert.equal(el.video.plays,1);assert.equal(el.glow.draws,0);assert.equal(h.timers.size,0);h.api.close();
});
