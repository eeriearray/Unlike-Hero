import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('../games/the-hollow/', import.meta.url);
const window = { HollowUI: { howtoModal: () => '<h2>HOW TO PLAY</h2>' }, HollowArt: { esc: x => x }, HollowCards: { tray: () => '' } };
vm.runInNewContext(fs.readFileSync(new URL('js/guidance.js', root), 'utf8'), { window });
const next = window.HollowGuidance.next;
const view = (enc, ap = 3, loc = 'square') => ({ game: { ap }, me: { loc }, enc });
test('guidance adapts to actionable choices, combat and exhausted actions', () => {
  assert.match(next(view({ options: [{ id: 'board', state: 'ok' }] })), /Read the notice board/);
  assert.match(next(view({ options: [{ id: 'board', state: 'done' }] })), /Travel/);
  assert.match(next(view({ kind: 'enemy' }, 2, 'belltower')), /Flee/);
  assert.match(next(view({ kind: 'enemy' }, 0, 'belltower')), /End your turn/);
  assert.match(next(view({ over: true })), /Continue/);
  assert.match(next(view(null, 2, 'heart_chamber')), /propose/);
});
test('authored bell tower has matching real encounter choices and travel', () => {
  let scene;
  vm.runInNewContext(fs.readFileSync(new URL('js/scenes/belltower.js', root), 'utf8'), { window: { HollowScenes: { register: s => scene = s } } });
  assert.equal(scene.id, 'belltower');
  assert.deepEqual(Array.from(Object.values(scene.objects).flatMap(o => o.actions).filter(a => a.opt), a => a.opt).sort(), ['climb', 'frame', 'listen']);
  assert.ok(Object.values(scene.objects).some(o => o.actions.some(a => a.act === 'travel')));
  assert.ok(scene.layers()[0].svg.includes('bt-stone'));
});
