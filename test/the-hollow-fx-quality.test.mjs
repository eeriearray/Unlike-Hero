import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source = await fs.readFile(new URL('../games/the-hollow/js/fx.js', import.meta.url), 'utf8');

test('dust reuses one offscreen sprite and stops scheduling frames when hidden or reduced', () => {
  let next = 0, sprites = 0, draws = 0;
  const frames = new Map(), listeners = {};
  const context2d = { clearRect() {}, beginPath() {}, arc() {}, fill() {}, drawImage() { draws++; } };
  const canvas = { width: 0, height: 0, getContext: () => context2d };
  const document = { hidden: false, body: { classList: { toggle() {} } },
    getElementById: id => id === 'dust' ? canvas : null,
    addEventListener: (name, fn) => { listeners[name] = fn; } };
  const window = { matchMedia: () => ({ matches: false, addEventListener() {} }),
    OffscreenCanvas: class { constructor() { sprites++; } getContext() { return context2d; } } };
  const requestAnimationFrame = fn => { const id = ++next; frames.set(id, fn); return id; };
  vm.runInNewContext(source, { window, document, innerWidth: 390, innerHeight: 844,
    addEventListener() {}, requestAnimationFrame, cancelAnimationFrame: id => frames.delete(id),
    localStorage: { getItem: () => null } });
  const fx = window.HollowFx;
  fx.startDust(); fx.startDust();
  assert.equal(sprites, 1);
  assert.equal(frames.size, 1);
  const [id, frame] = [...frames][0]; frames.delete(id); frame();
  assert.equal(draws, 24, 'phone draw count is bounded');
  assert.equal(frames.size, 1);
  fx.prefs.motion = 'on'; fx.apply();
  assert.equal(frames.size, 0);
  fx.prefs.motion = 'off'; fx.apply();
  assert.equal(frames.size, 1);
  document.hidden = true; listeners.visibilitychange();
  assert.equal(frames.size, 0);
});
