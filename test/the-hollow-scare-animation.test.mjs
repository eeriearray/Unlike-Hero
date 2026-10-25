import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../games/the-hollow/js/scare-face.js', import.meta.url), 'utf8');
function harness(loaded = true, variant = 'door') {
  let now = 0, next = 0, impacts = 0, completions = 0;
  const frames = new Map(), ops = [];
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, { get: (_, key) => (...args) => { ops.push([key, ...args]); return gradient; }, set: () => true });
  const canvas = { setAttribute() {}, getContext: () => context };
  const target = { setAttribute() {}, isConnected: true, getBoundingClientRect: () => ({ width: 390, height: 720 }), replaceChildren() {} };
  const document = { currentScript: { src: 'https://example.test/js/scare-face.js' }, hidden: false, createElement: () => canvas };
  const window = { Image: class { complete = loaded; naturalWidth = loaded ? 1254 : 0; naturalHeight = loaded ? 1254 : 0; }, HollowFx: { prefs: { jumpScares: true }, reduced: () => false }, requestAnimationFrame: cb => { frames.set(++next, cb); return next; }, cancelAnimationFrame: id => frames.delete(id) };
  vm.runInNewContext(source, { window, document, URL, performance: { now: () => now } });
  const stop = window.HollowScareFace.play(target, { variant: variant, onImpact: () => impacts++, onComplete: () => completions++ });
  function advance(ms) { now = ms; const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb(now)); }
  return { window, document, target, canvas, ops, frames, stop, advance, impacts: () => impacts, completions: () => completions };
}
test('creature has a silent anticipation, one synchronized impact and bounded completion', () => {
  const h = harness(); assert.equal(h.impacts(), 0); h.advance(400); assert.equal(h.impacts(), 0);
  const before = JSON.stringify(h.ops); h.ops.length = 0; h.advance(580);
  assert.equal(h.impacts(), 1); assert.notEqual(JSON.stringify(h.ops), before);
  h.advance(900); assert.equal(h.impacts(), 1); h.advance(1500);
  assert.equal(h.completions(), 1); assert.equal(h.frames.size, 0);
  assert.equal(h.canvas.width, 390); assert.equal(h.canvas.height, 720);
});
test('cancellation, hidden tabs, detached hosts and gentle preferences stop before impact', () => {
  for (const cancel of [h => h.stop(), h => { h.document.hidden = true; }, h => { h.target.isConnected = false; }, h => { h.window.HollowFx.prefs.reducedScares = true; }, h => { h.window.HollowFx.prefs.jumpScares = false; }, h => { h.window.HollowFx.reduced = () => true; }]) {
    const h = harness(); cancel(h); h.advance(600); h.advance(1600);
    assert.equal(h.impacts(), 0); assert.equal(h.frames.size, 0); assert.equal(h.completions(), 0);
  }
});

test('textured face deforms across frames and missing texture stays quiet', () => {
  const h = harness(); h.ops.length = 0; h.advance(580);
  const first = h.ops.filter(op => op[0] === 'drawImage');
  assert.equal(first.length, 100);
  h.ops.length = 0; h.advance(800);
  const later = h.ops.filter(op => op[0] === 'drawImage');
  assert.notDeepEqual(first.map(op => op.slice(6)), later.map(op => op.slice(6)));
  const missing = harness(false); missing.advance(600); missing.advance(1500);
  assert.equal(missing.impacts(), 0); assert.equal(missing.frames.size, 0);
});

test('cinematic edit has an empty beat before the attack and a single dark aftermath', () => {
  const h = harness(), shot = h.window.HollowScareFace.shot;
  assert.equal(shot(150).phase, 'presence');
  for (const ms of [260, 350, 489, 1170, 1400]) {
    h.ops.length = 0; h.advance(ms);
    assert.equal(h.ops.some(op => op[0] === 'drawImage'), false);
  }
  assert.equal(shot(490).phase, 'attack');
  assert.equal(shot(575).attack, 1);
  assert.equal(shot(835).snap, 1);
  assert.equal(shot(1400).phase, 'aftermath');
});
test('attack and neck snap change framing as well as facial shape', () => {
  const h = harness(); h.ops.length = 0; h.advance(600);
  const attack = h.ops.filter(op => ['translate', 'rotate', 'drawImage'].includes(op[0]));
  h.ops.length = 0; h.advance(850);
  const snap = h.ops.filter(op => ['translate', 'rotate', 'drawImage'].includes(op[0]));
  assert.notDeepEqual(attack[0], snap[0]);
  assert.notDeepEqual(attack[1], snap[1]);
  assert.ok(snap[2][8] > attack[2][8]);
});

test('each scene uses its own texture, staging and impact time', () => {
  const seen = new Set(), times = new Set();
  for (const variant of ['door', 'graveyard', 'tower', 'danger']) {
    const h = harness(true, variant), p = h.window.HollowScareFace.profiles[variant];
    seen.add(p.file); times.add(p.impact);
    h.advance(p.impact - 1); assert.equal(h.impacts(), 0);
    h.ops.length = 0; h.advance(p.impact + 35); assert.equal(h.impacts(), 1);
    assert.ok(h.ops.some(op => op[0] === 'drawImage'));
    h.advance(1500); assert.equal(h.frames.size, 0);
  }
  assert.equal(seen.size, 4); assert.equal(times.size, 4);
});
test('a delayed frame cannot play an impact after the creature has disappeared', () => {
  const h = harness(); h.advance(1300); assert.equal(h.impacts(), 0);
});
