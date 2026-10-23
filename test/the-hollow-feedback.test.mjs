import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { HollowGame, data: D } = require('../games/the-hollow/engine/index.js');
const game = new URL('../games/the-hollow/', import.meta.url);
const read = async file => JSON.parse(await fs.readFile(new URL(file, game), 'utf8'));
const source = async file => fs.readFile(new URL('js/' + file, game), 'utf8');
const config = await read('art/feedback.json'), manifest = await read('art/manifest.json');
const policyWindow = {};
vm.runInNewContext(await source('feedback-policy.js'), { window: policyWindow });
const P = policyWindow.HollowFeedbackPolicy;
const view = (san = 1) => ({ phase: 'playing', code: 'TEST', cosmetics: { runId: 'TEST:1' }, you: 'p0', game: { round: 4 }, me: { status: 'alive', san, maxSan: 7, loc: 'square', sts: ['marked', 'blessed'] }, log: [] });
const prefs = { jumpScares: true, reducedScares: false, distort: true };
const context = { age: 21000, reduced: false, hidden: false, blocked: false, used: false, danger: true, event: 0 };
function eligibleEvent(v = view()) { for (let n = 1; n < 1000; n++) if (P.eligible(v, prefs, { ...context, event: n })) return n; throw Error('No cosmetic opportunity'); }
function storage() { const map = new Map(); return { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value) }; }

test('feedback assets are listed, exist and use the intended packs', async () => {
  for (const [tier, id] of Object.entries(config.sanity)) {
    assert.equal(manifest.assets[id].pack, 'the_hollow_task4');
    assert.equal(manifest.assets[id].type, 'image');
    await fs.access(new URL(manifest.assets[id].file, game));
  }
  assert.equal(config.damage.length, 1);
  for (const id of config.damage) {
    assert.equal(manifest.assets[id].pack, 'the_hollow_task4');
    await fs.access(new URL(manifest.assets[id].file, game));
  }
  assert.equal(manifest.assets[config.impact].type, 'audio');
  assert.match(manifest.assets[config.impact].source, /Stinger.wav$/);
});
test('sanity boundaries and gentler preferences control pulse, strength and distortion', () => {
  assert.equal(P.tier({ san: 7, maxSan: 7 }), 'subtle');
  assert.equal(P.tier({ san: 4, maxSan: 7 }), 'asymmetric');
  assert.equal(P.tier({ san: 2, maxSan: 7 }), 'panic');
  assert.equal(P.tier({ san: -1, maxSan: 7 }), 'panic');
  for (const reduced of [false, true]) {
    const profile = P.profile({ san: 1, maxSan: 7 }, { ...prefs, reducedScares: true }, reduced);
    assert.equal(profile.distort, false); assert.equal(profile.pulse, false); assert.ok(profile.opacity <= .15);
  }
  assert.equal(P.profile({ san: 1, maxSan: 7 }, prefs, true).distort, false);
  assert.equal(P.profile({ san: 1, maxSan: 7 }, { ...prefs, distort: false }, false).distort, false);
});
test('every scare exclusion is enforced; only a small subset of real danger events qualify', () => {
  const event = eligibleEvent(), c = { ...context, event };
  assert.ok(P.eligible(view(), prefs, c));
  for (const change of [{ reduced: true }, { hidden: true }, { blocked: true }, { used: true }, { danger: false }, { age: 1000 }]) assert.equal(P.eligible(view(), prefs, { ...c, ...change }), false);
  for (const change of [{ jumpScares: false }, { reducedScares: true }]) assert.equal(P.eligible(view(), { ...prefs, ...change }, c), false);
  for (const v of [view(7), { ...view(), phase: 'ended' }, { ...view(), me: { ...view().me, status: 'fallen' } }, { ...view(), game: { round: 1 } }]) assert.equal(P.eligible(v, prefs, c), false);
  const opportunities = Array.from({ length: 1000 }, (_, event) => P.eligible(view(), prefs, { ...context, event })).filter(Boolean).length;
  assert.ok(opportunities > 30 && opportunities < 100);
  assert.ok(P.freshDanger([{ n: 1, k: 'dmg', p: 'p0' }], view()));
  assert.equal(P.freshDanger([{ n: 1, k: 'dmg', p: 'someone_else' }], view()), false);
});
test('a durable claim permits one scare per run, including after reload and denied storage', () => {
  const s = storage(); assert.ok(P.claim(s, 'run-one')); assert.equal(P.claim(s, 'run-one'), false);
  assert.equal(P.claim(s, 'run-one'), false); assert.ok(P.claim(s, 'run-two'));
  assert.equal(P.claim({ getItem() { throw Error('blocked'); } }, 'run'), false);
});
test('damage reactions stay within 300–600 ms and suppress texture/shake in reduced modes', () => {
  for (const r of [-1, 0, .5, 1, 10]) { const p = P.damagePlan(prefs, false, r); assert.ok(p.duration >= 300 && p.duration <= 600); }
  assert.equal(P.damagePlan(prefs, true, .5).texture, false);
  assert.equal(P.damagePlan({ ...prefs, reducedScares: true }, false, .5).shake, false);
  assert.deepEqual(Object.keys(P.statuses).sort(), Object.keys(D.statuses).sort());
  assert.equal(new Set(Object.values(P.statuses).map(s => s.path)).size, 5);
});
test('cosmetic run identity survives engine restore and exposes no RNG seed', () => {
  const g = new HollowGame({ code: 'COSM', seed: 1234, now: () => 123456 }); g.addPlayer({ id: 'p0', name: 'Tester' });
  const first = g.viewFor('p0');
  assert.equal(first.cosmetics.runId, 'COSM:123456'); assert.deepEqual(Object.keys(first.cosmetics), ['runId']);
  const restored = HollowGame.restore(g.snapshot(), { now: () => 999999 });
  assert.equal(restored.viewFor('p0').cosmetics.runId, first.cosmetics.runId);
  g.destroy(); restored.destroy();
});

class El {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.hidden = false; this.parentNode = null; this.className = ''; this.attrs = {}; this.style = { setProperty: (k,v) => { this.style[k] = v; } }; const own = this;
    this.classList = { add(...s) { own.className = [...new Set(own.className.split(' ').filter(Boolean).concat(s))].join(' '); }, remove(...s) { own.className = own.className.split(' ').filter(x => !s.includes(x)).join(' '); }, contains(s) { return own.className.split(' ').includes(s); }, toggle(s,b) { if (b === undefined) b = !this.contains(s); if (b) this.add(s); else this.remove(s); return b; } };
  }
  get isConnected() { return this.connected || !!(this.parentNode && this.parentNode.isConnected); }
  appendChild(el) { el.parentNode = this; this.children.push(el); return el; }
  replaceChildren(...els) { this.children.forEach(e => { e.parentNode = null; }); this.children = []; els.forEach(e => this.appendChild(e)); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(e => e !== this); this.parentNode = null; }
  setAttribute(k,v) { this.attrs[k] = v; }
  querySelector(selector) { return this.children.find(e => selector.slice(1).split('.').every(c => e.classList.contains(c))) || null; }
  set innerHTML(html) { this.replaceChildren(); for (const m of html.matchAll(/<(div|svg|canvas)[^>]*class="([^"]*)"[^>]*>/g)) { const e = new El(m[1]); e.className = m[2]; this.appendChild(e); } }
  cloneNode() { const e = new El(this.tagName); e.src = this.src; return e; }
}
async function harness({ preview = false, saved = storage() } = {}) {
  let now = 0, nextTimer = 0; const timers = new Map(), listeners = {}, requests = [], played = [];
  const body = new El('body'); body.connected = true; if (preview) body.dataset.feedbackPreview = 'true';
  const host = new El(); body.appendChild(host);
  const document = { body, hidden: false, currentScript: { src: 'https://example.test/games/the-hollow/js/feedback.js' }, createElement: tag => new El(tag), querySelector: () => null, getElementById: () => null,
    addEventListener: (name, fn) => (listeners[name] ||= []).push(fn) };
  const p = { ...prefs };
  const window = { localStorage: saved, HollowFeedbackPolicy: P, HollowArt: { esc: String, enemy: () => '<svg></svg>' },
    HollowUI: { S: { ui: { tab: 'act' }, cat: { statuses: D.statuses } }, settingsModal: () => '<h2>Settings</h2><hr class="div"><select id="s-motion"></select>' },
    HollowFx: { prefs: p, reduced: () => p.motion === 'on', apply() {}, save() { saved.setItem('saved-preferences', JSON.stringify(p)); } },
    HollowStage: { el: () => host, flash() {} }, HollowStory: { bar: () => '<header>HUD</header>' },
    HollowFeedbackAudio: { prepare() {}, stop: () => played.push('stop'), play: () => played.push('play') },
    HollowScareFace: { draw: () => true }, HollowAudio: { settings: () => ({ captions: false }), sfx: name => played.push(name) },
    HollowAssets: { ready: Promise.resolve(), load: async id => { requests.push(id); return null; } } };
  vm.runInNewContext(await source('feedback.js'), { window, document, URL, performance: { now: () => now },
    fetch: async () => ({ ok: true, json: async () => config }), setTimeout: (fn, ms) => { const id=++nextTimer; timers.set(id,{fn,at:now+ms}); return id; }, clearTimeout: id => timers.delete(id) });
  await window.HollowFeedback.ready;
  const advance = ms => { now += ms; for (const [id,t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); } };
  return { window, document, host, requests, played, advance, dispatch: (name,e) => (listeners[name] || []).forEach(fn => fn(e)) };
}
test('live integration does not replay loaded history and keeps failure fallbacks usable', async () => {
  const h = await harness(), v = view(), event = eligibleEvent(v), f = h.window.HollowFeedback;
  v.log = [{ n: event, k: 'dmg', p: 'p0' }]; f.sync(v); h.advance(30000); f.sync(v); h.advance(1000);
  assert.equal(h.played.includes('play'), false);
  h.window.HollowStage.flash('fx-hurt',500); await Promise.resolve();
  const root = h.host.querySelector('.feedback-root'), hit = root.querySelector('.feedback-hit');
  assert.ok(hit.classList.contains('on')); h.advance(600); assert.equal(hit.classList.contains('on'),false);
  const html = f.badges(v); assert.match(html, /Marked:/); assert.match(html, /Blessed:/);
  assert.match(h.window.HollowUI.settingsModal(), /data-feedback-pref="jumpScares"/);
  assert.match(h.window.HollowUI.settingsModal(), /s-motion/);
});
test('turning down scares immediately cancels a shown face and preserves preferences', async () => {
  const h = await harness({ preview: true }), f = h.window.HollowFeedback; f.sync(view());
  assert.ok(f.previewScare());
  const layer = h.host.querySelector('.feedback-root').querySelector('.feedback-scare'); assert.ok(layer.classList.contains('on'));
  h.dispatch('change',{ target: { dataset: { feedbackPref: 'reducedScares' }, checked: true } });
  assert.equal(layer.classList.contains('on'),false); assert.equal(f.previewScare(),false);
  assert.ok(h.document.body.classList.contains('reduced-scares'));
  const gameHarness = await harness(); gameHarness.dispatch('change',{target:{dataset:{feedbackPref:'jumpScares'},checked:false}});
  assert.equal(gameHarness.window.HollowFx.prefs.jumpScares,false);
  assert.ok(gameHarness.window.localStorage.getItem('saved-preferences'));
});
test('the integration consumes its run claim before showing a natural scare, including across reload', async () => {
  const s=storage(), h=await harness({saved:s}), v=view(), f=h.window.HollowFeedback;
  f.sync(v); h.advance(21000); const event=eligibleEvent(v); v.log=[{n:event,k:'dmg',p:'p0'}]; f.sync(v); h.advance(900);
  assert.equal(h.played.filter(p=>p==='play').length,1);
  for(let n=event+1;n<event+100;n++){v.log=[{n,k:'dmg',p:'p0'}];f.sync(v);h.advance(1000);}
  assert.equal(h.played.filter(p=>p==='play').length,1);
  const reload=await harness({saved:s});reload.window.HollowFeedback.sync({...view(),log:[]});reload.advance(21000);
  reload.window.HollowFeedback.sync({...view(),log:[{n:event,k:'dmg',p:'p0'}]});reload.advance(900);
  assert.equal(reload.played.filter(p=>p==='play').length,0);
});
async function impactHarness(reduced = false) {
  const state = { master: .8, sfx: .85, muted: false }, events = {}, sources = [], contexts = [];
  const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  class Context {
    constructor() { this.currentTime = 0; this.state = 'running'; contexts.push(this); }
    createGain() { return { gain: parameter(), connect() {} }; }
    createDynamicsCompressor() { return { threshold: parameter(), knee: parameter(), ratio: parameter(), connect() {} }; }
    source() { const s = { connect() {}, start(...args) { this.args=args; }, stop() { this.stopped=true; } }; sources.push(s); return s; }
    createBufferSource() { return this.source(); }
    createOscillator() { return Object.assign(this.source(), { frequency: parameter() }); }
    async decodeAudioData() { return { duration: 2.26 }; }
  }
  const window = { AudioContext: Context, HollowFx: { prefs: { jumpScares: true }, reduced: () => reduced },
    HollowAudio: { settings: () => ({ ...state }), setVolume(k,v) { state[k]=v; }, setMuted(v) { state.muted=v; } },
    HollowAssets: { load: async () => new ArrayBuffer(4) } };
  vm.runInNewContext(await source('feedback-audio.js'), { window, document: { addEventListener: (name,fn) => { events[name]=fn; } } });
  return { window, sources, contexts, unlock: () => events.pointerdown() };
}
test('scare impact needs a gesture, uses a short bounded cue and obeys master/mute changes', async () => {
  const h=await impactHarness(), audio=h.window.HollowFeedbackAudio;
  assert.equal(audio.play(),false);assert.equal(h.contexts.length,0);
  h.unlock();await audio.prepare(config.impact);assert.ok(audio.play());
  assert.ok(h.sources[0].args[2] <= .54);
  h.window.HollowAudio.setVolume('master',0);assert.ok(h.sources[0].stopped);assert.equal(audio.play(),false);
  h.window.HollowAudio.setVolume('master',.8);assert.ok(audio.play());
  h.window.HollowAudio.setMuted(true);assert.ok(h.sources[1].stopped);assert.equal(audio.play(),false);
});
test('reduced motion never creates an impact audio context', async () => {
  const h=await impactHarness(true);h.unlock();assert.equal(h.contexts.length,0);assert.equal(h.window.HollowFeedbackAudio.play(),false);
});
test('a browser that denies the storage property itself suppresses a natural scare safely', async () => {
  const h=await harness(), v=view(), f=h.window.HollowFeedback;
  Object.defineProperty(h.window,'localStorage',{get(){throw Error('Storage denied');}});
  f.sync(v);h.advance(21000);v.log=[{n:eligibleEvent(v),k:'dmg',p:'p0'}];f.sync(v);
  assert.doesNotThrow(()=>h.advance(900));assert.equal(h.played.includes('play'),false);
});

test('personal objective cue fires on a new completion, once, and never on resume', async () => {
  const h = await harness(), v = view(7), f = h.window.HollowFeedback;
  v.me.objective = { done: false }; f.sync(v);
  v.me.objective.done = true; f.sync(v); f.sync(v);
  assert.equal(h.played.filter(x => x === 'completion').length, 1);
  const resumed = await harness(); resumed.window.HollowFeedback.sync(v);
  assert.equal(resumed.played.filter(x => x === 'completion').length, 0);
});
