// Party Pack's game server, loaded by server/relay.mjs because game.json names it ("server").
// It adds two small localhost-only endpoints; gameplay itself runs over the hub relay:
//   <base>voice-pack/*  the Voice Booth's uploads (voice-pack.mjs)
//   <base>net-info      this computer's Wi-Fi/LAN addresses, so the Main Stage can put a join link
//                       and QR code on screen that phones can actually open (localhost never works on a phone)
import { networkInterfaces } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVoicePack, loadScript, isLocal } from './voice-pack.mjs';

const VOICE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'voice');

/** IPv4 addresses other devices on the network can reach: private ranges first; skips loopback, link-local
    (169.254.x) and the 192.0.0.x address macOS uses on IPv6-only/mobile links, which phones can't reach. */
export function lanAddresses(ifaces = networkInterfaces()) {
  const out = [];
  for (const [name, list] of Object.entries(ifaces)) for (const a of list || []) {
    if (a.family !== 'IPv4' && a.family !== 4) continue;
    if (a.internal || /^(127\.|169\.254\.|192\.0\.0\.)/.test(a.address)) continue;
    out.push({ address: a.address, name, private: /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address) });
  }
  return out.sort((x, y) => (y.private - x.private) || (/^en|^wl|^eth/.test(y.name) - /^en|^wl|^eth/.test(x.name))).map(a => a.address);
}

export default async function attach({ httpServer, basePath, log = console.log, voiceDir = VOICE_DIR }) {
  const pack = createVoicePack({ dir: voiceDir, lines: await loadScript() });
  const previous = httpServer.listeners('request').slice();
  httpServer.removeAllListeners('request');
  httpServer.on('request', (req, res) => {
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400).end('Bad request'); return; }
    if (url.pathname === `${basePath}net-info`) {
      res.writeHead(isLocal(req) ? 200 : 403, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(isLocal(req) ? { addresses: lanAddresses(), port: httpServer.address() && httpServer.address().port } : { error: 'localhost only' }));
      return;
    }
    if (!url.pathname.startsWith(`${basePath}voice-pack/`)) { for (const l of previous) l.call(httpServer, req, res); return; }
    pack.handle(req, res, url, basePath).catch(() => { if (!res.headersSent) res.writeHead(500).end(); });
  });
  log(`[party-pack] voice uploads on ${basePath}voice-pack/ (localhost only)`);
  return { paths: [] };
}
