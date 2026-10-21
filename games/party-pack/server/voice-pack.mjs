// Party Pack's voice pack: one audio file per host line in games/party-pack/voice/, listed in voice/index.json.
//
// The Voice Booth (index.html#booth) uploads or records lines through endpoints that only answer requests from
// this computer (localhost), so players on the network can never overwrite the hosts:
//   PUT    <base>voice-pack/clip?id=<line id>&ext=<mp3|m4a|wav|ogg|webm>   body: the audio file
//   DELETE <base>voice-pack/clip?id=<line id>
//   GET    <base>voice-pack/status                                          → { ok, count, total }
// Players only ever read the static files (voice/index.json and the clips).
import { mkdir, readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const EXTS = ['mp3', 'm4a', 'wav', 'ogg', 'webm'];
const MAX_BYTES = 4 * 1024 * 1024;

/** The host script, read from the same content.js the browser uses: [{ id, host, key, text, edge }]. */
export async function loadScript(contentFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'content.js')) {
  const sandbox = {}; sandbox.window = sandbox;
  vm.runInNewContext(await readFile(contentFile, 'utf8'), sandbox, { filename: contentFile });
  return sandbox.PP.scriptLines();
}

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

export function createVoicePack({ dir, lines }) {
  const indexFile = join(dir, 'index.json');
  const order = lines.map(l => l.id); const known = new Set(order);

  async function load() {
    try { const j = JSON.parse(await readFile(indexFile, 'utf8')); return { note: j.note, clips: j.clips || {} }; }
    catch { return { clips: {} }; }
  }
  async function save(index) {
    const clips = {};
    for (const id of order) if (index.clips[id]) clips[id] = index.clips[id];     // script order, known ids only
    const note = index.note || 'Party Pack host voices. Upload or record lines in the Voice Booth (index.html#booth); see SCRIPT.md for every line.';
    await writeFile(indexFile, JSON.stringify({ note, clips }, null, 2) + '\n');
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
    if (!isLocal(req)) { json(403, { error: 'Voices can only be saved from the computer running the hub (open it at http://localhost).' }); return true; }
    try {
      await mkdir(dir, { recursive: true });
      const index = await load();
      if (p === `${base}voice-pack/status`) { json(200, { ok: true, count: Object.keys(index.clips).filter(id => known.has(id)).length, total: order.length }); return true; }
      if (p === `${base}voice-pack/clip`) {
        const id = url.searchParams.get('id') || '';
        if (!known.has(id)) { json(400, { error: 'Unknown line.' }); return true; }
        if (req.method === 'DELETE') {
          await removeFiles(id); delete index.clips[id]; await save(index);
          json(200, { ok: true }); return true;
        }
        const ext = (url.searchParams.get('ext') || '').toLowerCase();
        if (req.method !== 'PUT' || !EXTS.includes(ext)) { json(400, { error: 'Send the audio with PUT and a known extension (mp3, m4a, wav, ogg, webm).' }); return true; }
        const body = await readBody(req, MAX_BYTES);
        if (body.length < 200) { json(400, { error: 'That audio file is empty.' }); return true; }
        await removeFiles(id);
        await writeFile(join(dir, `${id}.${ext}`), body);
        index.clips[id] = `${id}.${ext}`;
        await save(index);
        json(200, { ok: true, file: index.clips[id] }); return true;
      }
      json(404, { error: 'Not found.' }); return true;
    } catch (e) {
      json(e.message === 'too large' ? 413 : 500, { error: e.message === 'too large' ? 'That file is too big (4 MB max per line).' : 'Could not save.' });
      return true;
    }
  }

  return { handle, load };
}
