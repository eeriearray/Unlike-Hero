#!/usr/bin/env node
// One small server for the whole hub:
//   • serves this folder over HTTP (the hub at /, every game under /games/<id>/)
//   • relays multiplayer messages over WebSocket at /relay?room=<name>
//   • serves /shared/sdk/hub-config.js pointing games at that relay, so cross-device
//     multiplayer works with no extra setup.
//   • loads optional per-game servers: a game whose game.json has "server": "server/index.mjs"
//     gets that module attached to this HTTP server (see docs/ARCHITECTURE.md, "Game servers").
// Run:  npm install  &&  npm start        (PORT=8080 by default)
// Rooms are in memory and disappear when everyone leaves. Nothing is stored.
import { createServer } from 'node:http';
import { networkInterfaces, platform } from 'node:os';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const MAX_MSG = 16 * 1024;          // bytes per message
const MAX_PER_ROOM = 16;            // sockets per room
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
// Code revalidates on every load (a 304 when unchanged), so edits show up at once; art, sound and models are cached for an
// hour. Text is gzipped once per file version and kept in memory. Over a slow Wi-Fi this is most of a page's load time.
const LONG_CACHE = /\.(png|jpe?g|webp|svg|mp3|ogg|wav|webm|m4a|woff2|glb|gltf)$/i;
const COMPRESS = /\.(html|m?js|css|json|svg|md|txt|gltf)$/i;
const gzCache = new Map();
const BLOCKED = /(^|\/)(node_modules|server|tools|\.git)(\/|$)|(^|\/)\.|^package(-lock)?\.json$/;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let path = decodeURIComponent(url.pathname);
    if (path === '/shared/sdk/hub-config.js') {
      res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-store' });
      res.end("window.HUB_CONFIG = { relayUrl: (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/relay' };\n");
      return;
    }
    if (path.endsWith('/')) path += 'index.html';
    const rel = normalize(path).replace(/^([/\\])+/, '');
    if (rel.startsWith('..') || BLOCKED.test(rel.replace(/\\/g, '/'))) { res.writeHead(404).end('Not found'); return; }
    const file = join(root, rel);
    const info = await stat(file).catch(() => null);
    if (!info) { res.writeHead(404).end('Not found'); return; }
    if (info.isDirectory()) { res.writeHead(301, { location: path + '/' }).end(); return; }
    const etag = `"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`;
    const head = { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': LONG_CACHE.test(file) ? 'public, max-age=3600' : 'no-cache',
                   etag, 'last-modified': info.mtime.toUTCString(), 'accept-ranges': 'bytes', vary: 'accept-encoding' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, head).end(); return; }
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && info.size) {
      // Safari plays <audio>/<video> only from servers that answer range requests
      let a = range[1] === '' ? Math.max(0, info.size - Number(range[2])) : Number(range[1]), b = range[1] !== '' && range[2] !== '' ? Number(range[2]) : info.size - 1;
      b = Math.min(b, info.size - 1);
      if (a > b) { res.writeHead(416, { 'content-range': `bytes */${info.size}` }).end(); return; }
      const body = (await readFile(file)).subarray(a, b + 1);
      res.writeHead(206, { ...head, 'content-range': `bytes ${a}-${b}/${info.size}`, 'content-length': body.length }).end(req.method === 'HEAD' ? undefined : body);
      return;
    }
    let body = await readFile(file);
    if (COMPRESS.test(file) && body.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      let gz = gzCache.get(file);
      if (!gz || gz.etag !== etag) { gz = { etag, data: gzipSync(body) }; gzCache.set(file, gz); }
      body = gz.data; head['content-encoding'] = 'gzip';
    }
    head['content-length'] = body.length;
    res.writeHead(200, head);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (e) { res.writeHead(500).end('Server error'); }
});

// Game servers claim URL prefixes for their own WebSocket upgrades; the relay leaves those alone.
const claimedPaths = [];
// Games can ask for bigger relay rooms in game.json: "multiplayer": { "roomLimit": 40 } (2–200; default 16).
const roomLimits = new Map();
async function loadGameServers() {
  const gamesDir = join(root, 'games');
  for (const dir of (await readdir(gamesDir, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort()) {
    const manifest = await readFile(join(gamesDir, dir, 'game.json'), 'utf8').then(JSON.parse).catch(() => null);
    const limit = Number(manifest && manifest.multiplayer && manifest.multiplayer.roomLimit);
    if (limit) roomLimits.set(dir, Math.max(2, Math.min(200, Math.round(limit))));
    if (!manifest || !manifest.server) continue;
    try {
      const mod = await import(pathToFileURL(join(gamesDir, dir, manifest.server)).href);
      const res = await mod.default({ httpServer: server, basePath: `/games/${dir}/`, gameId: dir });
      claimedPaths.push(...((res && res.paths) || []));
    } catch (e) {
      console.error(`Game server for ${dir} failed to load (the game's online mode will be unavailable):`, e.message);
    }
  }
}

const rooms = new Map();            // room name -> Set of sockets
const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG });
server.on('upgrade', (req, socket, head) => {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { socket.destroy(); return; }   // malformed path: drop it, don't crash the hub
  if (claimedPaths.some(p => url.pathname.startsWith(p))) return; // handled by a game server
  const room = (url.searchParams.get('room') || '').slice(0, 120);
  if (url.pathname !== '/relay' || !room) { socket.destroy(); return; }
  const members = rooms.get(room) || new Set();
  if (members.size >= (roomLimits.get(room.split(':')[0]) || MAX_PER_ROOM)) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => {
    members.add(ws); rooms.set(room, members);
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      const text = data.toString();
      let msg; try { msg = JSON.parse(text); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      // A socket's connection id is the "from" of its first frame; frames claiming another id are dropped.
      if (!ws.conn && typeof msg.from === 'string') ws.conn = msg.from.slice(0, 64);
      if (msg.from !== ws.conn) return;
      // Direct messages ("to": a connection id) reach only that socket, so private views stay private.
      if (typeof msg.to === 'string') { for (const peer of members) if (peer.conn === msg.to && peer.readyState === 1) peer.send(text); return; }
      for (const peer of members) if (peer !== ws && peer.readyState === 1) peer.send(text);
    });
    ws.on('close', () => { members.delete(ws); if (!members.size) rooms.delete(room); });
    ws.on('error', () => ws.close());
  });
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.error(`Port ${PORT} is already in use (is the hub already running?). Stop the other process or run: PORT=8081 npm start`); process.exit(1); }
  throw e;
});
await loadGameServers();
server.listen(PORT, () => {
  console.log(`Game hub on http://localhost:${PORT}  (relay at ws://localhost:${PORT}/relay)`);
  // Print the exact address friends on the same Wi-Fi or hotspot should open. Skips addresses phones can't
  // reach: link-local 169.254.x and the 192.0.0.x a Mac gets on a USB/mobile link with no shared network.
  const lan = Object.values(networkInterfaces()).flat()
    .filter(a => a && (a.family === 'IPv4' || a.family === 4) && !a.internal && !/^(169\.254\.|192\.0\.0\.)/.test(a.address))
    .map(a => a.address);
  // Some phone hotspots (an iPhone sharing an IPv6-only carrier like Jio) give no IPv4 address at all: offer the
  // Wi-Fi's IPv6 address instead. It changes whenever the hotspot reconnects, so Macs also print their .local name.
  const lan6 = lan.length ? [] : ipv6Addresses().map(ip => `[${ip}]`);
  if (lan.length || lan6.length) {
    console.log('\nFriends on the same Wi-Fi or hotspot open:');
    for (const ip of lan.concat(lan6)) console.log(`   http://${ip}:${PORT}`);
    const local = localName();
    if (local) console.log(`   http://${local}:${PORT}   (iPhone, iPad and Mac: keeps working when the address changes)`);
    if (lan6.length) console.log('   (open the link on this computer too, so invite links and QR codes use it)');
    console.log('');
  } else {
    console.log('\nFriends can\'t reach this computer yet: it isn\'t on a Wi-Fi network or hotspot.');
    console.log('Connect it to the same Wi-Fi or phone hotspot as your friends (over Wi-Fi, not a USB cable), then restart: npm start\n');
  }
});

/** This Mac's Bonjour name (name.local), which Apple devices on the same network resolve whatever its address. */
function localName() {
  if (platform() !== 'darwin') return '';
  try { const n = execFileSync('scutil', ['--get', 'LocalHostName'], { encoding: 'utf8' }).trim(); return n ? n + '.local' : ''; } catch { return ''; }
}

/** Stable global IPv6 addresses of the network adapters (not temporary privacy addresses, not the 464XLAT one). */
function ipv6Addresses() {
  if (platform() === 'darwin') {
    try {
      // macOS marks each address: keep "autoconf secured", skip "temporary" and "clat46"
      return execFileSync('ifconfig', { encoding: 'utf8' }).split('\n')
        .filter(l => /^\s*inet6 [23][0-9a-f]{3}:/i.test(l) && /autoconf secured/.test(l) && !/temporary|clat46|deprecated/.test(l))
        .map(l => l.trim().split(/\s+/)[1]);
    } catch { /* fall through */ }
  }
  return Object.entries(networkInterfaces()).filter(([n]) => !/^(utun|awdl|llw|lo|docker|br-|veth)/.test(n)).flatMap(([, l]) => l || [])
    .filter(a => (a.family === 'IPv6' || a.family === 6) && !a.internal && /^[23]/.test(a.address)).map(a => a.address).slice(0, 1);
}
