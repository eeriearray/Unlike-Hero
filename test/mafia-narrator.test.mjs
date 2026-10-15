// Studio narrator: only the story may be spoken, audio is valid WAV, clips are cached.  Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createNarrator, encodeWav, DEFAULT_VOICE } from '../games/mafia/server/narrator.mjs';

const require = createRequire(import.meta.url);
const { MafiaGame, narrationLines, speechText } = require('../games/mafia/engine/mafia-engine.js');

function fakeRes() {
  const r = { code: 0, headers: {}, body: null, headersSent: false };
  r.writeHead = (c, h) => { r.code = c; Object.assign(r.headers, h || {}); r.headersSent = true; return r; };
  r.end = (b) => { r.body = b; };
  return r;
}
const get = async (n, path) => { const res = fakeRes(); await n.handle({}, res, new URL(path, 'http://x')); return res; };

test('narrator speaks only lines the game produced, as cached WAV', async () => {
  let renders = 0;
  const n = createNarrator({ root: '.', log: () => {}, engine: async () => { renders++; return encodeWav(new Float32Array([0, 0.5, -0.5]), 24000); } });
  const status = JSON.parse((await get(n, '/games/mafia/tts/status')).body);
  assert.equal(status.state, 'ready');
  assert.ok(status.voices[DEFAULT_VOICE]);

  assert.equal((await get(n, '/games/mafia/tts?t=' + encodeURIComponent('Say anything I want'))).code, 403);

  const game = new MafiaGame({ timers: { set: () => 0, clear: () => {} } });
  game.addPlayer({ id: 'h', name: 'Host' });
  for (let i = 0; i < 4; i++) game.addBot('h');
  game.start('h');
  game.advance(); // night: an announcement to narrate
  const lines = narrationLines(game);
  assert.ok(lines.length && lines.every(l => l === speechText(l)));
  n.allow(lines);
  await new Promise(r => setTimeout(r, 10));
  const res = await get(n, '/games/mafia/tts?v=' + DEFAULT_VOICE + '&t=' + encodeURIComponent(lines[0]));
  assert.equal(res.code, 200);
  assert.equal(res.headers['content-type'], 'audio/wav');
  assert.equal(res.body.toString('ascii', 0, 4), 'RIFF');
  const before = renders;
  await get(n, '/games/mafia/tts?v=' + DEFAULT_VOICE + '&t=' + encodeURIComponent(lines[0]));
  assert.equal(renders, before, 'second request is served from cache');
  assert.equal((await get(n, '/games/mafia/tts?v=nobody&t=' + encodeURIComponent(lines[0]))).code, 400);
});

test('narrator without the model reports itself unavailable instead of failing', async () => {
  const n = createNarrator({ root: '.', log: () => {} });
  assert.equal((await get(n, '/games/mafia/tts?t=x')).code, 503);
});
