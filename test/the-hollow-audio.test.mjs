import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../games/the-hollow/', import.meta.url);
const sources = await Promise.all(['audio.js','audio-map.js','recorded-audio.js','feedback-audio.js'].map(f => fs.readFile(new URL('js/'+f,root),'utf8')));
const manifest = JSON.parse(await fs.readFile(new URL('art/manifest.json',root),'utf8'));
function harness({ missing = false, corrupt = false } = {}) {
  let now = 0, created = 0, observer, dialog = false;
  const requests = [], nodes = [], intervals = [], storage = new Map(), captions = [];
  function param(value = 0) { return { value, events: [], setValueAtTime(v,t) { this.value=v; this.events.push(['set',v,t]); }, linearRampToValueAtTime(v,t) { this.value=v; this.events.push(['ramp',v,t]); }, exponentialRampToValueAtTime(v,t) { this.value=v; }, setTargetAtTime(v,t,k) { this.value=v; this.events.push(['target',v,t,k]); }, cancelScheduledValues() {}, cancelAndHoldAtTime() {} }; }
  function node() { const n = { links: [], connect(dest) { this.links.push(dest); }, disconnect() { this.links=[]; }, start(...args) { this.started=args; }, stop(t) { this.stopped=t; }, gain:param(1),frequency:param(100),detune:param(),Q:param(),pan:param(),playbackRate:param(1),threshold:param(),ratio:param(),attack:param(),release:param() }; nodes.push(n);return n; }
  class Context {
    constructor() { created++; this.currentTime=0;this.sampleRate=100;this.state='running';this.destination=node(); }
    createGain=node; createDynamicsCompressor=node; createConvolver=node; createBiquadFilter=node; createOscillator=node; createBufferSource=node; createStereoPanner=node;
    createBuffer(channels,length,rate) { return { length,numberOfChannels:channels,duration:length/rate,getChannelData:()=>new Float32Array(length) }; }
    async decodeAudioData() { if(corrupt) throw Error('decode rejected');return this.createBuffer(2,500,100); }
    async resume() {this.state='running';} async suspend(){this.state='suspended';}
  }
  const document = {hidden:false,body:{},querySelector:()=>dialog?{}:null,addEventListener() {}};
  const window = {HollowFx:{prefs:{jumpScares:true},reduced:()=>false},AudioContext:Context,MutationObserver:class {constructor(fn){observer=fn;} observe(){}},HollowAssets:{ready:Promise.resolve(),get:id=>missing?null:manifest.assets[id],load:async id=>{requests.push(id);return new ArrayBuffer(4);},release() {}}};
  const sandbox = {window,document,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},performance:{now:()=>now},setInterval:fn=>intervals.push(fn),clearInterval(){},setTimeout(){return 1;},clearTimeout(){}};
  for(const source of sources) vm.runInNewContext(source,sandbox);
  window.HollowAudio.onCaption(text=>captions.push(text));
  return {window,a:window.HollowAudio,map:window.HollowAudioMap,requests,nodes,storage,captions,created:()=>created,flush:async()=>{for(let i=0;i<15;i++)await Promise.resolve();},tick:t=>{now=t*1000;window.HollowAudio.backend().ctx.currentTime=t;intervals.forEach(fn=>fn());},dialog:on=>{dialog=on;observer();}};
}
test('all curated audio mappings resolve to existing manifest audio; legacy event names remain', async()=>{
  const h=harness();
  for(const id of [...Object.values(h.map.tracks),...Object.values(h.map.beds),...Object.values(h.map.sfx)]) {assert.equal(manifest.assets[id]?.type,'audio');await fs.access(new URL(manifest.assets[id].file,root));}
  for(const name of 'zoom paper water creak bell ignite snuff whisper coin stash dice success fail crit fumble clue pickup toll sanity damage heal'.split(' ')) assert.ok(h.a.sfxNames.includes(name));
});
test('gesture creates one shared context, schedules intro then loop, and keeps slider persistence',async()=>{
  const h=harness();h.a.setRegion('village');h.a.sfx('click');assert.equal(h.created(),0);assert.equal(h.requests.length,0);
  h.a.unlock();await h.flush();h.a.unlock();assert.equal(h.created(),1);
  const d=h.a.diagnostics();assert.equal(d.music.length,2);assert.equal(d.music[0],h.map.tracks.intro);assert.equal(d.music[1],h.map.tracks.loop);
  const recorded=h.nodes.filter(n=>n.buffer?.duration===5&&n.started&&n.playbackRate);assert.ok(recorded.some(n=>n.loop&&n.started[0]>0));
  h.a.setVolume('music',.31);h.a.setVolume('ambient',.27);h.a.setMuted(true);assert.equal(h.a.backend().master.gain.value,0);assert.equal(h.a.playAsset(h.map.sfx.click),false);
  const saved=JSON.parse(h.storage.get('hollow.audio.v1'));assert.equal(saved.music,.31);assert.equal(saved.ambient,.27);assert.equal(saved.muted,true);
});
test('rapid region changes discard stale decodes and crossfade to the latest region',async()=>{
  const h=harness();h.a.unlock();await h.flush();h.tick(10);
  const old=h.nodes.filter(n=>n.buffer&&n.started&&n.loop);
  h.a.setRegion('crypt');h.a.setRegion('woods');await h.flush();
  assert.equal(h.a.diagnostics().music.at(-1),h.map.tracks.woods);assert.equal(h.a.diagnostics().ambience[0],h.map.beds.woods);
  assert.ok(old.some(n=>n.stopped===12.02));assert.equal(h.a.diagnostics().transitionSeconds,2);
  assert.equal(h.a.backend().synthMusic.gain.value,0);assert.equal(h.a.backend().synthAmbient.gain.value,0);
});
test('missing and corrupt samples retain synthesis without delayed SFX or unlisted requests',async()=>{
  for(const options of [{missing:true},{corrupt:true}]){
    const h=harness(options);h.a.unlock();await h.flush();assert.equal(h.a.diagnostics().music.length,0);assert.equal(h.a.backend().synthMusic.gain.value,1);
    h.a.setCaptions(true);h.a.sfx('damage');assert.equal(h.captions.length,1);assert.ok(h.nodes.some(n=>n.started));
    await h.a.prepareAsset('not-listed');assert.ok(!h.requests.includes('not-listed'));
  }
});
test('dialog and voice ducking release without overwriting user gains; sanity and phase affect audio',async()=>{
  const h=harness();h.a.unlock();await h.flush();h.dialog(true);assert.ok(h.a.diagnostics().ducked);h.dialog(false);assert.equal(h.a.diagnostics().ducked,false);
  h.a.sfx('whisper');assert.ok(h.a.diagnostics().ducked);const pan=h.nodes.find(n=>n.pan.value!==0);assert.ok(pan&&Math.abs(pan.pan.value)<=.8);
  h.a.setState({phase:'playing',game:{haunt:3},me:{san:1,maxSan:8,status:'alive'}});h.a.setLevel(1);const before=h.nodes.length;h.tick(10);
  assert.ok(h.nodes.length>before);assert.equal(h.a.diagnostics().phase,3);assert.equal(h.a.diagnostics().sanity,.125);assert.ok(h.nodes.some(n=>n.frequency.value<2000));
  h.tick(20);assert.equal(h.a.diagnostics().ducked,false);assert.equal(h.a.backend().music.gain.value,.55);
});
test('ending plays an outro once; temporary combat track is quieter and pitched',async()=>{
  const h=harness();h.a.unlock();await h.flush();await h.a.setMood('boss');
  assert.ok(h.nodes.some(n=>n.buffer&&n.playbackRate.value===.82));await h.a.setMood('victory');
  assert.deepEqual(Array.from(h.a.diagnostics().music),[h.map.tracks.outro]);const final=h.nodes.filter(n=>n.buffer?.duration===5&&n.started).at(-1);assert.equal(final.loop,false);
});

test('optional scare impact shares the context, remains bounded and stops when scares are reduced',async()=>{
  const h=harness(), feedback=h.window.HollowFeedbackAudio;assert.equal(feedback.play(),false);h.a.unlock();await h.flush();await feedback.prepare(h.map.sfx.impact);
  assert.equal(feedback.play(),true);assert.equal(h.created(),1);assert.ok(h.nodes.some(n=>n.started&&n.started[2]<=.54));
  h.window.HollowFx.prefs.reducedScares=true;assert.equal(feedback.play(),false);h.a.setMuted(true);assert.equal(h.a.playImpact(h.map.sfx.impact),false);
});

test('Task 4 well ambience follows the place and completion keeps its full duration', async () => {
  const h = harness(); h.a.unlock(); await h.flush();
  await h.a.setRegion('village'); await h.a.setPlace('square'); await h.flush();
  assert.deepEqual(Array.from(h.a.diagnostics().ambience), [h.map.placeBeds.square]);
  await h.a.setPlace('chapel'); await h.flush();
  assert.deepEqual(Array.from(h.a.diagnostics().ambience), [h.map.placeBeds.chapel]);
  await h.a.prepareAsset(h.map.sfx.completion); h.a.sfx('completion');
  const cue = h.nodes.filter(n => n.started && n.buffer).at(-1);
  assert.equal(cue.started[2], 3.5);
  assert.equal(cue.loop, false);
  assert.equal(h.created(), 1);
});

test('trailer focus silences the game mix without altering saved volume or mute preferences',async()=>{
 const h=harness();h.a.unlock();await h.flush();const before=h.a.settings();
 h.a.setMediaFocus(true);assert.equal(h.a.backend().master.gain.value,0);
 assert.deepEqual(h.a.settings(),before);
 h.a.setMediaFocus(false);assert.equal(h.a.backend().master.gain.value,before.master);
 h.a.setMuted(true);h.a.setMediaFocus(true);h.a.setMediaFocus(false);assert.equal(h.a.backend().master.gain.value,0);
});

test('room ambience changes without restarting the current music or replaying its introduction',async()=>{
 const h=harness();h.a.unlock();await h.flush();await h.a.setRegion('village');await h.a.setPlace('square');await h.flush();
 const scheduledMusic=h.nodes.filter(n=>n.buffer&&n.loop&&n.started?.[0]>0);
 assert.equal(scheduledMusic.length,1);
 const before=h.nodes.filter(n=>n.buffer&&n.loop&&n.started).length;
 await h.a.setPlace('chapel');await h.flush();
 assert.equal(scheduledMusic[0].stopped,undefined,'the same music source continues');
 assert.equal(h.nodes.filter(n=>n.buffer&&n.loop&&n.started).length,before+1,'only a new ambient bed starts');
 assert.equal(h.a.diagnostics().ambience[0],h.map.placeBeds.chapel);
});
test('supplied interaction recordings preserve duration, spatial placement, captions and mute controls',async()=>{
 const h=harness();h.a.unlock();await h.flush();h.a.setCaptions(true);
 for(const [name,duration] of [['ink',1.5],['knock',2],['iron',1]]) {
  await h.a.prepareAsset(h.map.sfx[name]);h.a.sfx(name,{pan:.6});
  const cue=h.nodes.filter(n=>n.buffer&&n.started).at(-1);assert.equal(cue.started[2],duration);
  assert.ok(h.captions.at(-1).length>0);
 }
 assert.ok(h.nodes.some(n=>n.pan.value===.6));
 h.a.setMuted(true);assert.equal(h.a.playAsset(h.map.sfx.ink),false);
});
