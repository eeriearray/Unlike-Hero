// Party Pack host voices: only this computer may save clips, only for real script lines.  Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { createVoicePack, loadScript } from '../games/party-pack/server/voice-pack.mjs';

const BASE = '/games/party-pack/';
function call(pack, { method = 'PUT', path, body = Buffer.alloc(0), ip = '127.0.0.1' }) {
  const req = Readable.from(body.length ? [body] : []);
  req.method = method; req.socket = { remoteAddress: ip };
  const res = { code: 0, body: '', headersSent: false, writeHead(c) { this.code = c; this.headersSent = true; return this; }, end(b) { this.body = b || ''; } };
  return pack.handle(req, res, new URL(path, 'http://x'), BASE).then(() => ({ code: res.code, json: res.body ? JSON.parse(res.body) : null }));
}

test('the host script has unique ids and no player-name placeholders', async () => {
  const lines = await loadScript();
  assert.ok(lines.length >= 80, `${lines.length} lines`);
  assert.equal(new Set(lines.map(l => l.id)).size, lines.length, 'ids are unique');
  assert.ok(lines.every(l => !/\{\w+\}/.test(l.text)), 'no {name} placeholders: one recording must fit every game');
});

test('voice pack saves, replaces and deletes clips from localhost only', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pp-voice-'));
  try {
    const pack = createVoicePack({ dir, lines: await loadScript() });
    const audio = Buffer.alloc(4000, 7);
    const clip = (id, ext) => `${BASE}voice-pack/clip?id=${id}&ext=${ext}`;
    assert.equal((await call(pack, { path: clip('quip.intro.0', 'mp3'), body: audio, ip: '192.168.1.40' })).code, 403, 'other devices cannot write');
    assert.equal((await call(pack, { path: clip('not-a-line', 'mp3'), body: audio })).code, 400);
    assert.equal((await call(pack, { path: clip('quip.intro.0', 'exe'), body: audio })).code, 400);
    assert.equal((await call(pack, { path: clip('quip.intro.0', 'mp3'), body: Buffer.alloc(10) })).code, 400, 'empty file');
    assert.equal((await call(pack, { path: clip('../../etc', 'mp3'), body: audio })).code, 400, 'no path tricks');

    assert.equal((await call(pack, { path: clip('quip.intro.0', 'mp3'), body: audio })).code, 200);
    assert.equal((await call(pack, { path: clip('edge.tie4.0', 'wav'), body: audio })).code, 200);
    assert.equal((await call(pack, { path: clip('quip.intro.0', 'm4a'), body: audio })).code, 200, 'replaces the mp3');
    let index = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8'));
    assert.deepEqual(index.clips, { 'quip.intro.0': 'quip.intro.0.m4a', 'edge.tie4.0': 'edge.tie4.0.wav' });
    assert.deepEqual((await readdir(dir)).sort(), ['edge.tie4.0.wav', 'index.json', 'quip.intro.0.m4a']);
    assert.deepEqual((await call(pack, { method: 'GET', path: `${BASE}voice-pack/status` })).json, { ok: true, count: 2, total: (await loadScript()).length });

    assert.equal((await call(pack, { method: 'DELETE', path: `${BASE}voice-pack/clip?id=quip.intro.0` })).code, 200);
    index = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8'));
    assert.deepEqual(Object.keys(index.clips), ['edge.tie4.0']);
    assert.deepEqual((await readdir(dir)).sort(), ['edge.tie4.0.wav', 'index.json']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('join links use an address phones can reach', async () => {
  const { lanAddresses } = await import('../games/party-pack/server/index.mjs');
  const v4 = (address, internal = false) => ({ family: 'IPv4', address, internal });
  assert.deepEqual(lanAddresses({ lo0: [v4('127.0.0.1', true)], en0: [v4('192.0.0.2')] }), [], 'loopback and the mobile-link 192.0.0.x address are useless to phones');
  assert.deepEqual(lanAddresses({ utun4: [v4('100.80.1.2')], bridge0: [v4('169.254.9.9')], en0: [v4('192.168.1.23'), { family: 'IPv6', address: 'fe80::1', internal: false }] }), ['192.168.1.23', '100.80.1.2'], 'home Wi-Fi first');
});
