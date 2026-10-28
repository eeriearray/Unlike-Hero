import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../games/chronolink/index.html', import.meta.url), 'utf8');
function controlsHarness(role, view, soloEra) {
  const listeners = {}, elements = {};
  const calls = [];
  const G = { role, view, soloEra, started: true, t: 1 };
  const context = vm.createContext({ G, Set, Math,
    $: id => elements[id] ||= { hidden: true },
    addEventListener: (type, handler) => { listeners[type] = handler; },
    interact: who => calls.push(who), ping() {}, pin() {}, hint() {},
    controls: who => role === 'BOTH' || who === (role === 'ANCHOR' ? 'A' : 'E'),
    camYaw: () => 0,
  });
  const input = html.slice(html.indexOf('const held = { A:'), html.indexOf('const walkable ='));
  vm.runInContext(input, context);
  const key = (code, type = 'keydown') => listeners[type]({ code, repeat: false, target: {tagName: 'CANVAS'}, preventDefault() {} });
  const vector = who => JSON.parse(vm.runInContext(`JSON.stringify(inputVector('${who}'))`, context));
  return { G, key, vector, calls, blur: () => listeners.blur(), context };
}

test('solo Echo view routes WASD and E to the visible Echo while waiting for a partner', () => {
  const h = controlsHarness('BOTH', 'solo', 'future');
  h.key('KeyW'); h.key('KeyE');
  assert.deepEqual(h.vector('A'), [0, 0]);
  assert.notDeepEqual(h.vector('E'), [0, 0]);
  assert.deepEqual(h.calls, ['E']);
});

test('solo Anchor accepts arrows and Enter for the visible Anchor', () => {
  const h = controlsHarness('BOTH', 'solo', 'past');
  h.key('ArrowUp'); h.key('Enter');
  assert.notDeepEqual(h.vector('A'), [0, 0]);
  assert.deepEqual(h.vector('E'), [0, 0]);
  assert.deepEqual(h.calls, ['A']);
});

test('split screen keeps the two keyboard control sets independent', () => {
  const h = controlsHarness('BOTH', 'split', 'past');
  h.key('KeyW');
  assert.notDeepEqual(h.vector('A'), [0, 0]);
  assert.deepEqual(h.vector('E'), [0, 0]);
  h.key('ArrowUp'); h.key('KeyE'); h.key('Enter');
  assert.notDeepEqual(h.vector('E'), [0, 0]);
  assert.deepEqual(h.calls, ['A', 'E']);
});

test('a linked Echo accepts either movement set and both use keys', () => {
  for (const code of ['KeyW', 'ArrowUp']) {
    const h = controlsHarness('ECHO', 'solo', 'future');
    h.key(code); h.key('KeyE'); h.key('Enter');
    assert.deepEqual(h.vector('A'), [0, 0]);
    assert.notDeepEqual(h.vector('E'), [0, 0]);
    assert.deepEqual(h.calls, ['E', 'E']);
    h.key(code, 'keyup'); h.G.t = 2;
    assert.deepEqual(h.vector('E'), [0, 0]);
  }
});
