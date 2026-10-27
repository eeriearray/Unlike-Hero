import test from 'node:test';
import assert from 'node:assert/strict';
import { pullAim } from '../games/recess/js/games/common.js';

function setup(capture) {
  const win = new EventTarget();
  const svg = new EventTarget();
  Object.assign(svg, {
    ownerDocument: { defaultView: win }, style: {},
    // Identity coordinates: board spans 0..100 on both axes.
    createSVGPoint: () => ({ matrixTransform() { return { x: this.x, y: this.y }; } }),
    getScreenCTM: () => ({ inverse() { return {}; } }),
    setPointerCapture: capture
  });
  const shots = [], aims = [];
  let cancelled = 0;
  const destroy = pullAim(svg, {
    origin: () => ({ x: 5, y: 50 }), maxPull: 26,
    onAim: v => aims.push(v), onShoot: v => shots.push(v), onCancel: () => cancelled++
  });
  const send = (target, type, x, y, id = 1) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { clientX: x, clientY: y, pointerId: id, button: 0 });
    target.dispatchEvent(event);
  };
  return { win, svg, shots, aims, destroy, send, cancelled: () => cancelled };
}

for (const capture of [undefined, () => { throw new Error('capture unavailable'); }]) {
  test(`release beyond board shoots once when pointer capture is ${capture ? 'failing' : 'unavailable'}`, () => {
    const t = setup(capture);
    t.send(t.svg, 'pointerdown', 5, 50);
    t.send(t.win, 'pointermove', -60, 50);
    assert.equal(t.aims.at(-1).power, 1);
    t.send(t.win, 'pointerup', -100, 50);
    t.send(t.win, 'pointerup', -100, 50);
    assert.equal(t.shots.length, 1);
    assert.equal(t.shots[0].dx, 26);
    assert.equal(t.shots[0].dy, 0);
    assert.equal(t.shots[0].power, 1);
    t.destroy();
  });
}

test('another touch cannot replace, release or cancel an active drag', () => {
  const t = setup();
  t.send(t.svg, 'pointerdown', 5, 50);
  t.send(t.svg, 'pointerdown', 6, 50, 2);
  t.send(t.win, 'pointercancel', 6, 50, 2);
  t.send(t.win, 'pointerup', -40, 50, 2);
  assert.equal(t.shots.length, 0);
  assert.equal(t.cancelled(), 0);
  t.send(t.win, 'pointerup', -40, 50);
  assert.equal(t.shots.length, 1);
  t.destroy();
});

for (const reason of ['pointercancel', 'blur', 'destroy']) {
  test(`${reason} clears aiming without a shot and permits a later drag`, () => {
    const t = setup();
    t.send(t.svg, 'pointerdown', 5, 50);
    if (reason === 'destroy') t.destroy();
    else if (reason === 'blur') t.win.dispatchEvent(new Event('blur'));
    else t.send(t.win, 'pointercancel', -40, 50);
    t.send(t.win, 'pointerup', -40, 50);
    assert.equal(t.shots.length, 0);
    assert.equal(t.cancelled(), 1);
    t.send(t.svg, 'pointerdown', 5, 50);
    t.send(t.win, 'pointerup', -40, 50);
    assert.equal(t.shots.length, reason === 'destroy' ? 0 : 1);
    t.destroy();
  });
}

test('a tap cancels and a release within the board preserves partial power', () => {
  const t = setup();
  t.send(t.svg, 'pointerdown', 5, 50);
  t.send(t.win, 'pointerup', 5, 50);
  assert.equal(t.cancelled(), 1);
  t.send(t.svg, 'pointerdown', 5, 50);
  t.send(t.win, 'pointerup', 18, 50);
  assert.equal(t.shots[0].dx, -13);
  assert.equal(t.shots[0].power, 0.5);
  t.destroy();
});
