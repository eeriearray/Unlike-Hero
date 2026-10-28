import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { B, D, plain, duel } from './dragon-clash-helpers.mjs';

function inputHarness() {
  const events = {}, pad = { axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) };
  const window = { DC: { Sim: { BTN: B } }, addEventListener(type, fn) { events[type] = fn; } };
  vm.runInNewContext(readFileSync(new URL('../games/dragon-clash/js/input.js', import.meta.url), 'utf8'), {
    window, navigator: { getGamepads: () => [pad] }, document: { body: { classList: { contains: () => false } } },
  });
  return { input: window.DCInput, pad, window, events, release(code) { events.keyup({ code }); }, key(code) { events.keydown({ code, preventDefault() {} }); } };
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


test('quick keyboard taps reach the local simulation exactly once', () => {
  const { input, key, release, window } = inputHarness();
  window.DC.Data = D;
  vm.runInNewContext(readFileSync(new URL('../games/dragon-clash/js/match.js', import.meta.url), 'utf8'), { window });
  const match = Object.create(window.DCMatch.prototype);
  match.o = { controllers: [{ type: 'human', device: 'kb1', i: 0 }] };
  key('KeyO'); release('KeyO');
  const inputs = match.readInputs();
  assert.equal(inputs[0].held, 0);
  assert.equal(inputs[0].pressed, B.ability);
  const { sim, A } = duel(plain('fire'), plain('ice'), { gap: 500 });
  sim.step(inputs);
  assert.equal(A.move, 'ability');
  assert.equal(match.readInputs()[0].pressed, 0);
});

test('online sends a quick tap even when held bits did not change', () => {
  const { input, key, release, window } = inputHarness();
  vm.runInNewContext(readFileSync(new URL('../games/dragon-clash/js/match.js', import.meta.url), 'utf8'), { window, performance: { now: () => 200 } });
  const match = Object.create(window.DCMatch.prototype), packets = [];
  match.o = { device: 'kb1', net: { sendInput: (held, counts) => packets.push({ held, counts: { ...counts } }) } };
  match.lastSend = 200;
  key('KeyO'); release('KeyO');
  match.sendInput();
  assert.equal(packets.length, 1);
  assert.equal(packets[0].held, 0);
  assert.equal(packets[0].counts.ability, 1);
  match.sendInput();
  assert.equal(packets.length, 1, 'consumed presses are not resent as new presses');
});

test('press latches ignore key repeat, clear on blur, and stay independent per keyboard', () => {
  const { input, key, release, events } = inputHarness();
  input.setBinding('kb2', 'ability', ['KeyO']);
  key('KeyO'); release('KeyO');
  assert.equal(input.sample('kb1').pressed, B.ability);
  assert.equal(input.sample('kb2').pressed, B.ability);
  events.keydown({ code: 'KeyO', repeat: true, preventDefault() {} });
  assert.equal(input.sample('kb1').pressed, 0);
  release('KeyO'); key('KeyO'); events.blur();
  assert.equal(input.sample('kb1').pressed, 0);
  assert.equal(input.read('kb1'), 0);
  key('KeyO'); input.clearPresses();
  assert.equal(input.sample('kb1').pressed, 0);
});

test('ability taps during hit-stop and super freeze survive until gameplay resumes', () => {
  for (const pause of ['hitlag', 'freeze']) {
    const { sim, A } = duel(plain('fire'), plain('ice'), { gap: 500 });
    if (pause === 'hitlag') A.hitlag = D.PHYSICS.inputBuffer + 5;
    else sim.freeze = D.PHYSICS.inputBuffer + 5;
    sim.step([{ held: 0, pressed: B.ability }]);
    for (let i = 0; i < D.PHYSICS.inputBuffer + 6; i++) sim.step([]);
    assert.equal(A.move, 'ability', pause);
    assert.ok(A.abilityCd > 0, pause);
  }
});

test('on-screen ability taps survive release before the next input poll', () => {
  const { input, window, events } = inputHarness();
  function element(a) {
    return { dataset: { a }, style: { setProperty() {} }, classList: { add() {}, remove() {} },
      events: {}, addEventListener(type, fn) { this.events[type] = fn; },
      setPointerCapture(id) { this.captured = id; } };
  }
  const buttons = input.ACTIONS.map(element), zone = element(), knob = element(), box = element(), pause = element();
  knob.querySelector = () => element();
  const root = element();
  root.querySelector = (selector) => ({ '.t-stick-zone': zone, '.t-stick': knob, '.t-buttons': box, '.t-pause': pause })[selector];
  root.querySelectorAll = (selector) => selector === '.on' ? [] : buttons;
  window.innerWidth = 900; window.innerHeight = 450;
  vm.runInNewContext(readFileSync(new URL('../games/dragon-clash/js/touch.js', import.meta.url), 'utf8'), {
    window, navigator: {}, document: { createElement: () => root, body: { appendChild() {} } },
  });
  window.DCTouch.show();
  const button = buttons.find((b) => b.dataset.a === 'ability');
  button.events.pointerdown({ pointerId: 1, preventDefault() {} });
  assert.equal(button.captured, 1);
  // Pointer release is delivered globally, including outside the original button.
  events.pointerup({ pointerId: 1 });
  assert.equal(input.read('touch'), 0);
  assert.equal(input.sample('touch').pressed, B.ability);
  assert.equal(input.sample('touch').pressed, 0, 'a tap must be consumed only once');
  window.DCTouch.hide();
  window.DCTouch.show();
  button.events.pointerdown({ pointerId: 2, preventDefault() {} });
  window.DCTouch.hide();
  assert.equal(input.sample('touch').pressed, 0, 'hidden controls discard pending presses');
});
