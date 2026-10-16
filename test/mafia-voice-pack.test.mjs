// Narrator voice pack: only this computer may save takes, only for real script lines.  Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';
import { createVoicePack } from '../games/mafia/server/voice-pack.mjs';

const { SCRIPT } = createRequire(import.meta.url)('../games/mafia/engine/mafia-engine.js');

function call(pack, { method = 'PUT', path, body = Buffer.alloc(0), ip = '127.0.0.1' }) {
  const req = Readable.from(body.length ? [body] : []);
  req.method = method; req.socket = { remoteAddress: ip };
  const res = { code: 0, body: '', headersSent: false, writeHead(c) { this.code = c; this.headersSent = true; return this; }, end(b) { this.body = b || ''; } };
  return pack.handle(req, res, new URL(path, 'http://x'), '/games/mafia/').then(() => ({ code: res.code, json: res.body ? JSON.parse(res.body) : null }));
}

test('voice pack saves, replaces and deletes takes from localhost only', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mafia-voice-'));
  try {
    const pack = createVoicePack({ dir, script: SCRIPT });
    const audio = Buffer.alloc(4000, 7);
    assert.equal((await call(pack, { path: '/games/mafia/voice-pack/clip?id=deal&ext=webm', body: audio, ip: '192.168.1.40' })).code, 403);
    assert.equal((await call(pack, { path: '/games/mafia/voice-pack/clip?id=not-a-line&ext=webm', body: audio })).code, 400);
    assert.equal((await call(pack, { path: '/games/mafia/voice-pack/clip?id=deal&ext=exe', body: audio })).code, 400);
    assert.equal((await call(pack, { path: '/games/mafia/voice-pack/clip?id=deal&ext=webm', body: Buffer.alloc(10) })).code, 400);

    assert.equal((await call(pack, { path: '/games/mafia/voice-pack/clip?id=deal&ext=webm', body: audio })).code, 200);
    assert.equal((await call(pack, { path: '/games/mafia/voice-pack/clip?id=weather.1&ext=mp3', body: audio })).code, 200);
    assert.equal((await call(pack, { path: '/games/mafia/voice-pack/clip?id=deal&ext=m4a', body: audio })).code, 200); // replaces the webm take
    let index = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8'));
    assert.deepEqual(index.clips, { deal: 'deal.m4a', 'weather.1': 'weather.1.mp3' });
    assert.deepEqual((await readdir(dir)).sort(), ['deal.m4a', 'index.json', 'weather.1.mp3']);

    assert.equal((await call(pack, { path: '/games/mafia/voice-pack/settings', body: Buffer.from('{"deepen":0.5}') })).json.deepen, 0.8, 'deepen is clamped');
    assert.equal((await call(pack, { method: 'DELETE', path: '/games/mafia/voice-pack/clip?id=deal' })).code, 200);
    index = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8'));
    assert.deepEqual(Object.keys(index.clips), ['weather.1']);
    assert.ok(!(await readdir(dir)).includes('deal.m4a'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
