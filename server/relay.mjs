#!/usr/bin/env node
// One small server for the whole hub:
//   • serves this folder over HTTP (the hub at /, every game under /games/<id>/)
//   • relays multiplayer messages over WebSocket at /relay?room=<name>
//   • serves /shared/sdk/hub-config.js pointing games at that relay, so cross-device
//     multiplayer works with no extra setup.
// Run:  npm install  &&  npm start        (PORT=8080 by default)
// Rooms are in memory and disappear when everyone leaves. Nothing is stored.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const MAX_MSG = 16 * 1024;          // bytes per message
const MAX_PER_ROOM = 16;            // sockets per room
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
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
    res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(await readFile(file));
  } catch (e) { res.writeHead(500).end('Server error'); }
});

const rooms = new Map();            // room name -> Set of sockets
const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://x');
  const room = (url.searchParams.get('room') || '').slice(0, 120);
  if (url.pathname !== '/relay' || !room) { socket.destroy(); return; }
  const members = rooms.get(room) || new Set();
  if (members.size >= MAX_PER_ROOM) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => {
    members.add(ws); rooms.set(room, members);
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      for (const peer of members) if (peer !== ws && peer.readyState === 1) peer.send(data.toString());
    });
    ws.on('close', () => { members.delete(ws); if (!members.size) rooms.delete(room); });
    ws.on('error', () => ws.close());
  });
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.error(`Port ${PORT} is already in use (is the hub already running?). Stop the other process or run: PORT=8081 npm start`); process.exit(1); }
  throw e;
});
server.listen(PORT, () => {
  console.log(`Game hub on http://localhost:${PORT}  (relay at ws://localhost:${PORT}/relay)`);
  console.log('Other devices on your network: use this computer\'s IP address instead of localhost.');
});
