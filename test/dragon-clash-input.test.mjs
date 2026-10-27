import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { B } from './dragon-clash-helpers.mjs';

function inputHarness() {
  const events = {}, pad = { axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) };
  const window = { DC: { Sim: { BTN: B } }, addEventListener(type, fn) { events[type] = fn; } };
  vm.runInNewContext(readFileSync(new URL('../games/dragon-clash/js/input.js', import.meta.url), 'utf8'), {
    window, navigator: { getGamepads: () => [pad] }, document: { body: { classList: { contains: () => false } } },
  });
  return { input: window.DCInput, pad, key(code) { events.keydown({ code, preventDefault() {} }); } };
}

test('keyboard rejects duplicate keys within a layout but allows sharing across layouts', () => {
  const { input, key } = inputHarness();
  const before = JSON.stringify(input.binds());
  assert.match(input.setBinding('kb1', 'heavy', ['KeyJ']), /already used/);
  assert.equal(JSON.stringify(input.binds()), before);
  assert.equal(input.setBinding('kb2', 'heavy', ['KeyJ']), null);
  assert.equal(input.conflicts(['kb1', 'kb2']).length, 0);
  key('KeyJ');
  assert.equal(input.read('kb1'), B.light);
  assert.equal(input.read('kb2'), B.heavy);
});

test('a free key works and arrow shortcuts yield to a remapped action', () => {
  const { input, key } = inputHarness();
  assert.equal(input.setBinding('kb2', 'left', ['KeyQ']), null);
  assert.equal(input.setBinding('kb1', 'heavy', ['ArrowLeft']), null);
  key('ArrowLeft');
  assert.equal(input.read('kb1'), B.heavy, 'arrow must not also move left');
});

test('saved bindings are deduplicated within each layout and resetting one preserves the other', () => {
  const { input } = inputHarness();
  input.load({ kb1: { heavy: ['KeyJ', 'KeyJ'] }, kb2: { light: ['KeyJ'] } });
  assert.equal(input.conflicts(['kb1', 'kb2']).length, 0);
  assert.equal(input.binds().kb1.heavy.length, 0);
  assert.equal(input.binds().kb2.light[0], 'KeyJ');
  assert.equal(input.setBinding('kb1', 'heavy', ['KeyQ']), null);
  assert.equal(input.setBinding('kb2', 'light', ['KeyK']), null);
  const otherLayout = JSON.stringify(input.binds().kb2);
  input.reset('kb1');
  assert.equal(JSON.stringify(input.binds().kb2), otherLayout);
  input.load(JSON.parse(JSON.stringify(input.binds())));
  assert.equal(JSON.stringify(input.binds().kb2), otherLayout);
  assert.equal(input.conflicts(['kb1', 'kb2']).length, 0);
  assert.equal(input.binds().kb1.heavy[0], 'KeyK');
});

test('gamepad rejects duplicate and reserved buttons and reads only the original action', () => {
  const { input, pad } = inputHarness();
  assert.match(input.setPadBinding('heavy', [2]), /already used/);
  for (const button of [9, 12, 13, 14, 15]) assert.match(input.setPadBinding('heavy', [button]), /reserved/);
  pad.buttons[2].pressed = true;
  assert.equal(input.read('pad0'), B.light);
  pad.buttons[2].pressed = false;
  assert.equal(input.setPadBinding('heavy', [10]), null);
  pad.buttons[10].pressed = true;
  assert.equal(input.read('pad0'), B.heavy);
});

test('saved gamepad conflicts and reserved buttons are removed', () => {
  const { input, pad } = inputHarness();
  input.loadPad({ light: [2, 2], heavy: [2], gear: [14], taunt: [9] });
  const assigned = Object.values(input.padBinds()).flat();
  assert.equal(new Set(assigned).size, assigned.length);
  assert.ok(!assigned.includes(9) && !assigned.includes(14));
  pad.buttons[2].pressed = true;
  assert.equal(input.read('pad0'), B.light);
  input.resetPad();
  assert.equal(input.padBinds().heavy[0], 3);
});
