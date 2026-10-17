// Putt Club game server — authoritative rooms for online play.
//
// Loaded by server/relay.mjs because games/putt-club/game.json names it in "server".
// Runs Socket.io at /games/putt-club/socket.io. Each room owns one PuttMatch (engine/match.js) that simulates
// every ball at 60 Hz; clients only send intents (shoot, use an item, vote) and receive:
//   'state'  the room view (coalesced, on change)      'snap'  ball positions, 20 Hz while balls can move
//   'fx'     batched one-off events (sounds, effects)  'closed' the room went away
// This folder is never served over HTTP (relay.mjs blocks paths containing /server/).
import { Server } from 'socket.io';
import { createRequire } from 'node:module';
import { randomBytes, randomInt } from 'node:crypto';
import { networkInterfaces } from 'node:os';

const require = createRequire(import.meta.url);
const PuttMatch = require('../engine/match.js');

const TICK = 1 / 60;
const SNAP_EVERY = 3;                     // ticks per snapshot (20 Hz)
const LOBBY_GRACE_MS = 20_000;            // a lobby seat survives a refresh or a brief drop
const IDLE_ROOM_MS = 5 * 60_000;          // rooms with no connected humans close after this
const MAX_ROOMS = 300;
const RATE = { burst: 30, perSecond: 12 }; // per-socket command budget
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no I, L or O: easy to read aloud

/** IPv4 addresses phones on the same Wi-Fi can reach (private ranges first; no loopback or link-local). */
export function lanAddresses(ifaces = networkInterfaces()) {
  const out = [];
  for (const [name, list] of Object.entries(ifaces)) for (const a of list || []) {
    if (a.family !== 'IPv4' && a.family !== 4) continue;
    if (a.internal || /^(127\.|169\.254\.|192\.0\.0\.)/.test(a.address)) continue;
    out.push({ address: a.address, name, private: /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address) });
  }
  return out.sort((x, y) => (y.private - x.private) || (/^en|^wl|^eth/.test(y.name) - /^en|^wl|^eth/.test(x.name))).map((a) => a.address);
}

function isLocal(req) {
  const a = req.socket.remoteAddress || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}

export default async function attach({ httpServer, basePath, log = console.log, tickMs = 1000 / 60 }) {
  await PuttMatch.physics.init(); // Rapier (WASM)
  const path = `${basePath}socket.io`;

  // <basePath>net-info: this computer's Wi-Fi address, so a host on localhost can share a link phones can open.
  const previous = httpServer.listeners('request').slice();
  httpServer.removeAllListeners('request');
  httpServer.on('request', (req, res) => {
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400).end('Bad request'); return; }
    if (url.pathname !== `${basePath}net-info`) { for (const l of previous) l.call(httpServer, req, res); return; }
    const local = isLocal(req);
    res.writeHead(local ? 200 : 403, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(local ? { addresses: lanAddresses(), port: httpServer.address() && httpServer.address().port } : { error: 'localhost only' }));
  });
  const io = new Server(httpServer, {
    path,
    serveClient: true,           // <basePath>socket.io/socket.io.min.js
    destroyUpgrade: false,       // leave other WebSocket upgrades (the hub relay) alone
    maxHttpBufferSize: 8 * 1024,
    pingInterval: 10_000,
    pingTimeout: 12_000
  });

  /** code -> { match, sockets: Map<playerId, socket>, tokens: Map<playerId, token>, graceTimers, idleTimer, dirty, fxQueue, tickN } */
  const rooms = new Map();

  function newCode() {
    for (let i = 0; i < 80; i++) {
      let code = '';
      for (let k = 0; k < 4; k++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
      if (!rooms.has(code)) return code;
    }
    return null;
  }

  function createRoom() {
    if (rooms.size >= MAX_ROOMS) return null;
    const code = newCode();
    if (!code) return null;
    const room = { code, sockets: new Map(), tokens: new Map(), graceTimers: new Map(), idleTimer: null, dirty: true, fxQueue: [], privateFx: new Map(), tickN: 0 };
    room.match = new PuttMatch({
      code,
      hooks: {
        state: () => { room.dirty = true; },
        fx: (ev, to) => {
          if (!to) { if (room.fxQueue.length < 64) room.fxQueue.push(ev); return; }
          for (const id of to) { const q = room.privateFx.get(id) || []; if (q.length < 32) q.push(ev); room.privateFx.set(id, q); }
        }
      }
    });
    rooms.set(code, room);
    return room;
  }

  function closeRoom(room, reason) {
    room.match.destroy();
    for (const t of room.graceTimers.values()) clearTimeout(t);
    clearTimeout(room.idleTimer);
    for (const s of room.sockets.values()) { s.emit('closed', { reason }); s.leave(`room:${room.code}`); s.data = {}; }
    rooms.delete(room.code);
    log(`[putt-club] room ${room.code} closed (${reason}); ${rooms.size} open`);
  }

  function checkIdle(room) {
    clearTimeout(room.idleTimer);
    const m = room.match;
    if (m.players.some((p) => !p.bot && p.connected)) return;
    if (!m.players.some((p) => !p.bot)) { closeRoom(room, 'empty'); return; }
    room.idleTimer = setTimeout(() => closeRoom(room, 'idle'), IDLE_ROOM_MS);
  }

  function bind(socket, room, playerId) {
    const prev = room.sockets.get(playerId);
    if (prev && prev !== socket) { prev.emit('closed', { reason: 'replaced' }); prev.data = {}; prev.leave(`room:${room.code}`); }
    clearTimeout(room.graceTimers.get(playerId));
    room.graceTimers.delete(playerId);
    room.sockets.set(playerId, socket);
    socket.data = { code: room.code, playerId };
    socket.join(`room:${room.code}`);
    room.match.setConnected(playerId, true);
    clearTimeout(room.idleTimer);
    room.dirty = true;
    // A fresh client needs the full picture straight away.
    socket.emit('state', room.match.view(playerId));
    if (room.match.world) socket.emit('snap', room.match.snapshot());
  }

  function seat(room, playerId) {
    const token = randomBytes(18).toString('base64url');
    room.tokens.set(playerId, token);
    return { ok: true, code: room.code, playerId, token };
  }

  function unbind(socket, { leaving = false } = {}) {
    const { code, playerId } = socket.data || {};
    const room = code && rooms.get(code);
    socket.data = {};
    if (!room || room.sockets.get(playerId) !== socket) return;
    room.sockets.delete(playerId);
    socket.leave(`room:${code}`);
    const m = room.match;
    if (leaving && m.phase === 'lobby') { m.removePlayer(playerId); room.tokens.delete(playerId); }
    else if (leaving) { m.setConnected(playerId, false); }
    else {
      m.setConnected(playerId, false);
      if (m.phase === 'lobby') {
        // Keep the lobby seat briefly so a page refresh doesn't lose it.
        room.graceTimers.set(playerId, setTimeout(() => {
          room.graceTimers.delete(playerId);
          if (!room.sockets.has(playerId) && m.phase === 'lobby') { m.removePlayer(playerId); room.tokens.delete(playerId); }
          checkIdle(room);
        }, LOBBY_GRACE_MS));
      }
    }
    checkIdle(room);
  }

  // One loop drives every room: fixed 60 Hz simulation steps, 20 Hz snapshots, coalesced state pushes.
  let last = performance.now(), acc = 0;
  const loop = setInterval(() => {
    const now = performance.now();
    acc = Math.min(acc + (now - last) / 1000, TICK * 6);
    last = now;
    let steps = 0;
    while (acc >= TICK) { acc -= TICK; steps++; }
    if (!steps) return;
    for (const room of rooms.values()) {
      const m = room.match;
      for (let i = 0; i < steps; i++) {
        try { m.tick(TICK); } catch (e) { log('[putt-club] tick failed', e); }
        room.tickN++;
      }
      const live = m.phase === 'intro' || m.phase === 'play';
      if (live && room.tickN % SNAP_EVERY < steps) io.to(`room:${room.code}`).emit('snap', m.snapshot());
      if (room.fxQueue.length) { io.to(`room:${room.code}`).emit('fx', room.fxQueue); room.fxQueue = []; }
      if (room.privateFx.size) {
        for (const [id, evs] of room.privateFx) room.sockets.get(id)?.emit('fx', evs);
        room.privateFx.clear();
      }
      if (room.dirty || (live && room.tickN % 30 < steps)) {
        room.dirty = false;
        for (const [id, s] of room.sockets) s.emit('state', m.view(id));
      }
    }
  }, tickMs);
  loop.unref?.();

  io.on('connection', (socket) => {
    let tokens = RATE.burst, lastT = Date.now();
    const allow = () => {
      const now = Date.now();
      tokens = Math.min(RATE.burst, tokens + ((now - lastT) / 1000) * RATE.perSecond);
      lastT = now;
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    };
    const reply = (ack, data) => { if (typeof ack === 'function') ack(data); };
    const profile = (d) => ({ name: d && typeof d.name === 'string' ? d.name : '', color: d && Number.isInteger(d.color) ? d.color : undefined });

    socket.on('room:create', (data, ack) => {
      if (!allow()) return reply(ack, { error: 'Too many requests.' });
      unbind(socket, { leaving: true });
      const room = createRoom();
      if (!room) return reply(ack, { error: 'The server is full. Try again later.' });
      const res = room.match.addPlayer({ id: 'p' + randomBytes(6).toString('hex'), ...profile(data) });
      if (res.error) return reply(ack, res);
      const s = seat(room, res.player.id);
      bind(socket, room, res.player.id);
      log(`[putt-club] room ${room.code} created (${rooms.size} open)`);
      reply(ack, s);
    });

    socket.on('room:join', (data, ack) => {
      if (!allow()) return reply(ack, { error: 'Too many requests.' });
      const code = String((data && data.code) || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
      const room = rooms.get(code);
      if (!room) return reply(ack, { error: `No room called ${code || '…'}. Check the code with your host.` });
      const m = room.match;
      const want = profile(data);
      // A friend whose browser lost its seat mid-match can take it back by joining with the same name.
      if (m.phase !== 'lobby' && want.name) {
        const lost = m.players.find((p) => !p.bot && !p.connected && p.name.toLowerCase() === want.name.trim().toLowerCase());
        if (lost) { unbind(socket, { leaving: true }); const s = seat(room, lost.id); bind(socket, room, lost.id); return reply(ack, { ...s, rejoined: true }); }
      }
      if (m.players.length >= PuttMatch.MAX_PLAYERS) return reply(ack, { error: `Room ${code} is full (8 players).` });
      unbind(socket, { leaving: true });
      const res = m.addPlayer({ id: 'p' + randomBytes(6).toString('hex'), ...want });
      if (res.error) return reply(ack, res);
      const s = seat(room, res.player.id);
      bind(socket, room, res.player.id);
      reply(ack, s);
    });

    socket.on('room:resume', (data, ack) => {
      if (!allow()) return reply(ack, { error: 'Too many requests.' });
      const room = rooms.get(String((data && data.code) || ''));
      const playerId = String((data && data.playerId) || '');
      if (!room || room.tokens.get(playerId) !== String((data && data.token) || '') || !room.match.get(playerId)) {
        return reply(ack, { error: 'That seat is gone.' });
      }
      bind(socket, room, playerId);
      reply(ack, { ok: true, code: room.code, playerId, token: room.tokens.get(playerId) });
    });

    socket.on('room:leave', (_d, ack) => { unbind(socket, { leaving: true }); reply(ack, { ok: true }); });

    socket.on('cmd', (cmd, ack) => {
      if (!allow()) return reply(ack, { error: 'Slow down.' });
      const { code, playerId } = socket.data || {};
      const room = code && rooms.get(code);
      if (!room) return reply(ack, { error: 'You are not in a room.' });
      if (!cmd || typeof cmd !== 'object') return reply(ack, { error: 'Bad command.' });
      let res;
      try { res = room.match.command(playerId, cmd); } catch (e) { log('[putt-club] command failed', e); res = { error: 'Server error.' }; }
      if (res && res.kicked) {
        const s = room.sockets.get(res.kicked);
        if (s) { s.emit('closed', { reason: 'kicked' }); s.leave(`room:${code}`); s.data = {}; room.sockets.delete(res.kicked); }
        room.tokens.delete(res.kicked);
      }
      reply(ack, res && res.player ? { ok: true } : res);
    });

    socket.on('clock', (_d, ack) => reply(ack, { now: Date.now() }));

    socket.on('disconnect', () => unbind(socket));
  });

  log(`[putt-club] game server on ${path}`);
  return {
    paths: [path],
    rooms,
    close: () => { clearInterval(loop); for (const r of [...rooms.values()]) closeRoom(r, 'shutdown'); io.close(); }
  };
}
