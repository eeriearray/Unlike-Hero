// The narrator's voice pack: recorded clips in games/mafia/voice/, listed in voice/index.json.
//
// The recording studio (games/mafia/record.html) saves takes here through two endpoints that only answer
// requests from this computer (localhost), so players on the network can never overwrite the narration:
//   PUT <base>voice-pack/clip?id=<clip>&ext=<webm|ogg|mp3|m4a|wav>   body: the audio file
//   DELETE <base>voice-pack/clip?id=<clip>
//   PUT <base>voice-pack/settings                                     body: {"deepen": 0.94}
// Players only ever read the static files (voice/index.json and the clips).
import { mkdir, readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const EXTS = ['webm', 'ogg', 'mp3', 'm4a', 'wav'];
const MAX_BYTES = 3 * 1024 * 1024;

export function isLocal(req) {
  const a = (req.socket && req.socket.remoteAddress) || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const parts = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else parts.push(c); });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}

export function createVoicePack({ dir, script }) {
  const indexFile = join(dir, 'index.json');

  async function load() {
    try { const j = JSON.parse(await readFile(indexFile, 'utf8')); return { deepen: Number(j.deepen) || 1, clips: j.clips || {} }; }
    catch { return { deepen: 0.95, clips: {} }; }
  }
  async function save(index) {
    const clips = {};
    for (const id of Object.keys(script)) if (index.clips[id]) clips[id] = index.clips[id]; // script order, known ids only
    await writeFile(indexFile, JSON.stringify({ deepen: index.deepen, clips }, null, 2) + '\n');
  }
  async function removeFiles(id) {
    const files = await readdir(dir).catch(() => []);
    await Promise.all(files.filter((f) => f.startsWith(id + '.') && EXTS.includes(f.slice(id.length + 1))).map((f) => unlink(join(dir, f)).catch(() => {})));
  }

  /** Returns true if it handled the request. */
  async function handle(req, res, url, base) {
    const p = url.pathname;
    if (!p.startsWith(`${base}voice-pack/`)) return false;
    const json = (code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    if (!isLocal(req)) { json(403, { error: 'Recordings can only be saved from the computer running the hub (open http://localhost).' }); return true; }
    try {
      await mkdir(dir, { recursive: true });
      const index = await load();
      if (p === `${base}voice-pack/clip`) {
        const id = url.searchParams.get('id') || '';
        if (!script[id]) { json(400, { error: 'Unknown line.' }); return true; }
        if (req.method === 'DELETE') {
          await removeFiles(id); delete index.clips[id]; await save(index);
          json(200, { ok: true }); return true;
        }
        const ext = url.searchParams.get('ext') || '';
        if (req.method !== 'PUT' || !EXTS.includes(ext)) { json(400, { error: 'Send the audio with PUT and a known extension.' }); return true; }
        const body = await readBody(req, MAX_BYTES);
        if (body.length < 200) { json(400, { error: 'That recording is empty.' }); return true; }
        await removeFiles(id);
        await writeFile(join(dir, `${id}.${ext}`), body);
        index.clips[id] = `${id}.${ext}`;
        await save(index);
        json(200, { ok: true, file: index.clips[id] }); return true;
      }
      if (p === `${base}voice-pack/settings` && req.method === 'PUT') {
        const body = JSON.parse((await readBody(req, 4096)).toString('utf8') || '{}');
        if ('deepen' in body) index.deepen = Math.max(0.8, Math.min(1.05, Number(body.deepen) || 1));
        await save(index);
        json(200, { ok: true, deepen: index.deepen }); return true;
      }
      json(404, { error: 'Not found.' }); return true;
    } catch (e) {
      json(e.message === 'too large' ? 413 : 500, { error: e.message === 'too large' ? 'Recording is too long (3 MB max).' : 'Could not save.' });
      return true;
    }
  }

  return { handle, load };
}
