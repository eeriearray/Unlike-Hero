// Party Pack's game server, loaded by server/relay.mjs because game.json names it ("server").
// It only adds the Voice Booth's localhost-only upload endpoint; gameplay runs over the hub relay.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVoicePack, loadScript } from './voice-pack.mjs';

const VOICE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'voice');

export default async function attach({ httpServer, basePath, log = console.log, voiceDir = VOICE_DIR }) {
  const pack = createVoicePack({ dir: voiceDir, lines: await loadScript() });
  const previous = httpServer.listeners('request').slice();
  httpServer.removeAllListeners('request');
  httpServer.on('request', (req, res) => {
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400).end('Bad request'); return; }
    if (!url.pathname.startsWith(`${basePath}voice-pack/`)) { for (const l of previous) l.call(httpServer, req, res); return; }
    pack.handle(req, res, url, basePath).catch(() => { if (!res.headersSent) res.writeHead(500).end(); });
  });
  log(`[party-pack] voice uploads on ${basePath}voice-pack/ (localhost only)`);
  return { paths: [] };
}
