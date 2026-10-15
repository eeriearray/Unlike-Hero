// Studio narrator: a neural text-to-speech voice (Kokoro, 82M parameters) running on the hub server.
//
// The model loads in the background on first start (a ~90 MB one-time download, cached in .cache/ at the
// repo root). Until it is ready — or if the optional "kokoro-js" dependency is not installed — the status
// endpoint says so and browsers fall back to their own speech voices.
//
// Only lines the game itself produced can be spoken (see allow()), so the endpoint cannot be used to make
// the server read arbitrary text.
import { join } from 'node:path';

export const VOICES = {
  bm_george: 'George — deep British storyteller',
  am_michael: 'Michael — warm American',
  bm_fable: 'Fable — old-world narrator',
  am_onyx: 'Onyx — low and gravelly',
  bm_lewis: 'Lewis — dry British',
  am_fenrir: 'Fenrir — hard-boiled'
};
export const DEFAULT_VOICE = 'bm_george';
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const SPEED = 0.92;
const CACHE_MAX = 400;      // synthesized clips kept in memory
const ALLOW_MAX = 6000;     // narration lines remembered as speakable

/** 16-bit PCM WAV from mono float samples. */
export function encodeWav(samples, rate) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
  }
  return buf;
}

/**
 * @param {object} opts
 *   root      repo root (model cache goes to <root>/.cache/tts)
 *   log       logger
 *   engine    optional stand-in: async (text, voice) => Buffer (tests)
 */
export function createNarrator({ root, log = console.log, engine = null } = {}) {
  let state = engine ? 'ready' : 'off';
  let tts = null, error = '';
  const cache = new Map();             // `${voice}|${text}` -> Promise<Buffer>
  const allowed = new Set();
  const recentVoices = new Map([[DEFAULT_VOICE, Date.now()]]);
  let chain = Promise.resolve();       // synthesis is CPU-bound: one clip at a time

  async function load() {
    if (engine || state === 'loading' || state === 'ready') return;
    state = 'loading';
    try {
      const mod = await import('kokoro-js');
      try {
        const hf = await import('@huggingface/transformers');
        if (hf.env) { hf.env.cacheDir = join(root, '.cache', 'tts'); hf.env.allowRemoteModels = true; }
      } catch { /* cache location is a nicety */ }
      log('[mafia] loading the studio narrator voice (first run downloads ~90 MB)…');
      tts = await mod.KokoroTTS.from_pretrained(MODEL, { dtype: 'q8', device: 'cpu' });
      state = 'ready';
      log('[mafia] studio narrator ready');
    } catch (e) {
      state = 'unavailable';
      error = e && e.code === 'ERR_MODULE_NOT_FOUND' ? 'kokoro-js is not installed' : String(e && e.message || e).slice(0, 200);
      log(`[mafia] studio narrator unavailable (${error}); players will hear their browser's voice`);
      // A failed download (offline, flaky network) is retried; a missing package is not.
      if (!/not installed/.test(error)) setTimeout(() => { state = 'off'; load(); }, 5 * 60_000).unref();
    }
  }

  async function render(text, voice) {
    if (engine) return engine(text, voice);
    const audio = await tts.generate(text, { voice, speed: SPEED });
    return encodeWav(audio.audio, audio.sampling_rate);
  }

  function synth(text, voice) {
    const key = `${voice}|${text}`;
    if (cache.has(key)) { const p = cache.get(key); cache.delete(key); cache.set(key, p); return p; }
    const p = chain = chain.then(() => render(text, voice), () => render(text, voice));
    p.catch(() => cache.delete(key));
    cache.set(key, p);
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return p;
  }

  /** Mark lines as speakable and render them ahead of time in the voices players are using. */
  function allow(lines) {
    for (const text of lines) {
      if (!text || allowed.has(text)) continue;
      allowed.add(text);
      if (allowed.size > ALLOW_MAX) allowed.delete(allowed.values().next().value);
      if (state !== 'ready') continue;
      const cutoff = Date.now() - 15 * 60_000;
      for (const [voice, at] of recentVoices) if (at > cutoff) synth(text, voice).catch(() => {});
    }
  }

  /** HTTP: GET <base>tts/status  and  GET <base>tts?v=<voice>&t=<text> */
  async function handle(req, res, url) {
    const send = (code, body, type = 'application/json; charset=utf-8', extra = {}) => {
      res.writeHead(code, { 'content-type': type, 'cache-control': code === 200 && type === 'audio/wav' ? 'public, max-age=86400' : 'no-store', ...extra });
      res.end(body);
    };
    if (url.pathname.endsWith('/tts/status')) {
      return send(200, JSON.stringify({ state, voices: VOICES, defaultVoice: DEFAULT_VOICE, error: state === 'unavailable' ? error : undefined }));
    }
    if (state !== 'ready') return send(503, JSON.stringify({ error: 'The studio narrator is not ready.' }));
    const voice = url.searchParams.get('v') || DEFAULT_VOICE;
    const text = (url.searchParams.get('t') || '').slice(0, 320);
    if (!VOICES[voice]) return send(400, JSON.stringify({ error: 'Unknown voice.' }));
    if (!allowed.has(text)) return send(403, JSON.stringify({ error: 'The narrator only reads the story.' }));
    recentVoices.set(voice, Date.now());
    try {
      const wav = await synth(text, voice);
      send(200, wav, 'audio/wav', { 'content-length': wav.length });
    } catch (e) {
      log('[mafia] narration failed', e && e.message);
      send(500, JSON.stringify({ error: 'Narration failed.' }));
    }
  }

  return { load, allow, handle, get state() { return state; } };
}
