// Mafia narration plays one line at a time: a new line stops the old one, and a clip that finishes loading
// after narration moved on never starts.  Runs the real games/mafia/js/audio.js against a fake Web Audio.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function harness() {
  const sources = [];
  const node = () => new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'gain' || k === 'frequency' || k === 'Q' || k === 'threshold' || k === 'ratio' || k === 'attack' || k === 'release' || k === 'playbackRate' ? (t[k] = { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }) : () => node()) });
  const buffer = () => ({ sampleRate: 44100, duration: 1, getChannelData: () => { const d = new Float32Array(44100); d.fill(0.3, 4000, 40000); return d; } });
  class FakeContext {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = node(); }
    createGain() { return node(); } createBiquadFilter() { return node(); } createDynamicsCompressor() { return node(); }
    createConvolver() { return node(); } createOscillator() { return node(); } createAnalyser() { return node(); }
    createBuffer() { return buffer(); } resume() {} decodeAudioData(b, ok) { ok(buffer()); }
    createBufferSource() {
      const s = { url: null, started: false, stopped: false, onended: null, playbackRate: { value: 1 }, connect() {},
        start() { s.started = true; }, stop() { if (!s.started) throw new Error('not started'); s.stopped = true; } };
      sources.push(s); return s;
    }
  }
  // fetch resolves when the test says so, per URL
  const pending = {};
  const fetch = url => new Promise(res => { pending[url] = () => res({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }); });
  const window = { AudioContext: FakeContext, localStorage: { getItem: () => null, setItem() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, fetch };
  window.window = window;
  vm.runInNewContext(readFileSync(new URL('../games/mafia/js/audio.js', import.meta.url), 'utf8'), Object.assign(window, { Math, Promise, Float32Array, JSON, Object, Array, Error }));
  const tick = () => new Promise(r => setImmediate(r));
  const playing = () => sources.filter(s => s.started && !s.stopped);
  return { A: window.MafiaAudio, sources, pending, tick, playing };
}

test('a new narration line stops the one that was playing', async () => {
  const { A, pending, tick, playing } = harness();
  const first = A.playVoice('voice/night.1.mp3'); pending['voice/night.1.mp3'](); await tick(); await tick();
  assert.equal(playing().length, 1, 'first line playing');
  A.playVoice('voice/found.1.mp3'); pending['voice/found.1.mp3'](); await tick(); await tick();
  assert.equal(playing().length, 1, 'never two lines at once');
  await first;                                                     // the interrupted line's promise still settles
});

test('a line that finishes loading after narration moved on never starts', async () => {
  const { A, pending, tick, playing, sources } = harness();
  A.playVoice('voice/slow.mp3');                                   // still downloading…
  A.playVoice('voice/fast.mp3'); pending['voice/fast.mp3'](); await tick(); await tick();
  pending['voice/slow.mp3'](); await tick(); await tick();         // …finishes late
  assert.equal(sources.length, 1, 'the stale clip never got a source');
  assert.equal(playing().length, 1);
});

test('stopping narration also cancels a line that is still loading', async () => {
  const { A, pending, tick, playing } = harness();
  const p = A.playVoice('voice/late.mp3');
  A.stopVoice();
  pending['voice/late.mp3'](); await tick(); await tick();
  assert.equal(playing().length, 0);
  await p;                                                         // resolves instead of hanging the narration sequence
});
