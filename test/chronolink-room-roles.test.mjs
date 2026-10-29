import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

const html = readFileSync(new URL('../games/chronolink/index.html', import.meta.url), 'utf8');
function client(id, since, hash = '') {
  const elements = {}, sent = [];
  const G = { started: false, role: 'BOTH', view: 'split' };
  const context = vm.createContext({
    G, location: { hash, search: '' }, document: { hidden: false },
    ROLE_ERA: { ANCHOR: 'past', ECHO: 'future' }, crypto: webcrypto,
    $: name => elements[name] ||= { hidden: true, textContent: '', value: '', addEventListener() {} },
    hub: { room: () => ({ emit: (_, m) => sent.push(structuredClone(m)), on() {}, leave() {} }) },
    applyView() {}, updateHUD() {}, log() {}, focusControls() {}, setMenu() {},
    Sound: { playRadioStatic() {} }, snapshot: () => ({}), applySnapshot() {},
    start() { G.started = true; },
  });
  vm.runInContext(html.slice(html.indexOf('const Net = {'), html.indexOf('const posOf =')), context);
  vm.runInContext(`Net.id = '${id}'; Net.since = ${since};`, context);
  const wiring = html.indexOf("if (hub) {\n  $('backBtn')");
  vm.runInContext(html.slice(wiring, html.indexOf("addEventListener('resize'", wiring)), context);
  return { G, elements, sent, run: code => vm.runInContext(code, context), receive(m) {
    context.message = m; vm.runInContext('Net.recv(message)', context);
  } };
}
function connect(a, b) {
  a.run('Net.beat()'); b.run('Net.beat()');
  for (let i = 0; i < 4 && (a.sent.length || b.sent.length); i++) {
    while (a.sent.length) b.receive(a.sent.shift());
    while (b.sent.length) a.receive(b.sent.shift());
  }
}

for (const role of ['ANCHOR', 'ECHO']) for (const hostOlder of [true, false]) {
  test(`creator keeps ${role} when ${hostOlder ? 'creator' : 'joiner'} tab is older, despite conflicting hub role`, () => {
    const host = client('host', hostOlder ? 1 : 2);
    const friend = client('friend', hostOlder ? 2 : 1, '#' + role.toLowerCase());
    host.elements.roomRole.value = role;
    host.elements.roomNew.onclick();
    const code = host.elements.roomCode.value;
    assert.match(code, /^[A-Z]{4}$/);
    assert.equal(host.G.view, 'solo');
    assert.equal(host.G.soloEra, role === 'ANCHOR' ? 'past' : 'future');
    friend.elements.roomCode.value = code;
    // The creator-only selector must not influence joining an existing room.
    friend.elements.roomRole.value = role;
    friend.elements.roomJoin.onclick();
    connect(host, friend);
    assert.equal(host.G.role, role);
    assert.equal(friend.G.role, role === 'ANCHOR' ? 'ECHO' : 'ANCHOR');
    host.run("Net.unlink('Partner left')"); friend.run("Net.unlink('Partner left')");
    connect(host, friend);
    assert.equal(host.G.role, role);
    assert.equal(friend.G.role, role === 'ANCHOR' ? 'ECHO' : 'ANCHOR');
  });
}

test('room role defaults to the role requested by the hub URL', () => {
  assert.equal(client('echo', 1, '#echo').elements.roomRole.value, 'ECHO');
  assert.equal(client('anchor', 1, '#anchor').elements.roomRole.value, 'ANCHOR');
  assert.equal(client('default', 1).elements.roomRole.value, 'ANCHOR');
});
