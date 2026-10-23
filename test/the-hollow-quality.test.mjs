import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../games/the-hollow/', import.meta.url);
const source = await fs.readFile(new URL('js/quality.js', root), 'utf8');
function setup(deny = false) {
  const memory = new Map(), style = {};
  const storage = { getItem: key => { if (deny) throw Error('denied'); return memory.get(key); },
    setItem: (key, value) => { if (deny) throw Error('denied'); memory.set(key, value); } };
  const body = { style: { setProperty: (name, value) => { style[name] = value; } }, dataset: {}, children: [],
    classList: { toggle() {} } };
  const document = { body, documentElement: { style: {} }, addEventListener() {}, getElementById() { return null; }, querySelector() { return null; } };
  const window = { localStorage: storage, HollowFx: { prefs: { large: false } },
    HollowUI: { settingsModal: () => '<div class="switch"><input id="s-large" type="checkbox" data-act="largebox"><label for="s-large">Larger text</label></div>' },
    addEventListener() {} };
  vm.runInNewContext(source, { window, document, requestAnimationFrame() {} });
  return { api: window.HollowQuality, ui: window.HollowUI, memory, style, body, root: document.documentElement };
}
test('text size offers four valid persistent sizes and never changes game rules', () => {
  const h = setup();
  assert.match(h.ui.settingsModal(), /<select id="s-text-size"/);
  assert.doesNotMatch(h.ui.settingsModal(), /s-large/);
  assert.equal(h.api.setScale(150), true);
  assert.equal(h.style['--fs'], '24px');
  assert.equal(h.root.style.fontSize, '24px');
  assert.equal(h.memory.get('hollow.quality.v1'), '150');
  assert.equal(h.api.setScale('900'), false);
  assert.equal(h.api.getScale(), 150);
});
test('blocked preference storage still allows text sizing for the session', () => {
  const h = setup(true);
  assert.doesNotThrow(() => h.api.setScale(130));
  assert.equal(h.api.getScale(), 130);
  assert.equal(h.style['--fs'], '20.8px');
});
