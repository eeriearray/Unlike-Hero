// Prompt packs shared through the hub: a saved pack gets a valid 7-digit code that loads it back,
// profanity and junk are refused.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { createPackStore, validCode } from '../games/party-pack/server/packs.mjs';

function call(store, method, rest, body) {
  const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []); req.method = method;
  const res = { code: 0, body: '', headersSent: false, writeHead(c) { this.code = c; this.headersSent = true; return this; }, end(b) { this.body = b || ''; } };
  return store.handle(req, res, rest).then(() => ({ code: res.code, json: res.body ? JSON.parse(res.body) : null }));
}

test('a shared pack gets a code that loads it on any device', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pp-packs-'));
  try {
    const store = await createPackStore({ dir });
    const pack = { kind: 'quip', title: 'Office roasts', author: 'Sam', items: ['The worst thing to say in a standup', 'A rejected company motto'] };
    const saved = await call(store, 'POST', '', pack);
    assert.equal(saved.code, 200); assert.ok(validCode(saved.json.code), 'a 7-digit Luhn code');
    const loaded = await call(store, 'GET', '/' + saved.json.code);
    assert.equal(loaded.code, 200); assert.deepEqual(loaded.json.items, pack.items); assert.equal(loaded.json.title, 'Office roasts');
    assert.equal((await call(store, 'POST', '', { ...pack, items: ['what the f u c k'] })).code, 400, 'profanity refused');
    assert.equal((await call(store, 'POST', '', { kind: 'nope', items: ['x'] })).code, 400, 'unknown game refused');
    assert.equal((await call(store, 'GET', '/1234567')).code, validCode('1234567') ? 404 : 400);
    const other = '000000' + '0';                             // valid Luhn, never saved
    assert.equal((await call(store, 'GET', '/' + other)).code, 404);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
