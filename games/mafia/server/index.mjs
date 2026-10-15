// Mafia game server — the authoritative "God" for online rooms.
//
// Loaded by server/relay.mjs because games/mafia/game.json names it in "server".
// Runs Socket.io at /games/mafia/socket.io and keeps every secret (roles, night actions,
// private chats) on the server. Each client only ever receives game.viewFor(itsOwnId).
// This folder is never served over HTTP (relay.mjs blocks any path containing /server/).
import { Server } from 'socket.io';
import { createRequire } from 'node:module';
import { randomBytes, randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createNarrator } from './narrator.mjs';

const require = createRequire(import.meta.url);
const { MafiaGame, narrationLines, speechText, NARRATOR_PREVIEW } = require('../engine/mafia-engine.js');
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const LOBBY_GRACE_MS = 20_000;          // a lobby seat survives a refresh / brief drop
const IDLE_ROOM_MS = 10 * 60_000;       // rooms with no connected humans are closed after this
const MAX_ROOMS = 500;
const RATE = { burst: 20, perSecond: 6 }; // per-socket command budget

export default function attach({ httpServer, basePath, log = console.log, ttsEngine = null }) {
  const path = `${basePath}socket.io`;

  // Studio narrator over plain HTTP: <basePath>tts and <basePath>tts/status.
  const narrator = createNarrator({ root: REPO_ROOT, log, engine: ttsEngine });
  narrator.allow([speechText(NARRATOR_PREVIEW)]);
  narrator.load();
  const ttsPath = `${basePath}tts`;
  const ttsHits = new Map(); // ip -> [windowStart, count]
  const previous = httpServer.listeners('request').slice();
  httpServer.removeAllListeners('request');
  httpServer.on('request', (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname !== ttsPath && url.pathname !== `${ttsPath}/status`) { for (const l of previous) l.call(httpServer, req, res); return; }
    const ip = req.socket.remoteAddress || '';
    const now = Date.now(), hit = ttsHits.get(ip) || [now, 0];
    if (now - hit[0] > 60_000) { hit[0] = now; hit[1] = 0; }
    if (++hit[1] > 240) { res.writeHead(429).end(); return; }
    ttsHits.set(ip, hit);
    if (ttsHits.size > 5000) ttsHits.clear();
    narrator.handle(req, res, url).catch(() => { if (!res.headersSent) res.writeHead(500).end(); });
  });
  const io = new Server(httpServer, {
    path,
    serveClient: true,           // /games/mafia/socket.io/socket.io.min.js
    destroyUpgrade: false,       // leave other WebSocket upgrades (the hub relay) alone
    maxHttpBufferSize: 16 * 1024,
    pingInterval: 20_000,
    pingTimeout: 25_000,
  });

  /** code -> { game, sockets: Map<playerId, socket>, tokens: Map<playerId, token>, graceTimers: Map, idleTimer, syncQueued } */
  const rooms = new Map();

  function newCode() {
    for (let i = 0; i < 50; i++) {
      const code = String(randomInt(100000, 1000000));
      if (!rooms.has(code)) return code;
    }
    return null;
  }

  function createRoom() {
    const code = newCode();
    if (!code || rooms.size >= MAX_ROOMS) return null;
    const room = { code, sockets: new Map(), tokens: new Map(), graceTimers: new Map(), idleTimer: null, syncQueued: false };
    room.game = new MafiaGame({
      code,
      hooks: {
        sync: () => queueSync(room),
        chat: (msg, recipients) => { for (const id of recipients) room.sockets.get(id)?.emit('chat', msg); },
        fx: (recipients, data) => {
          if (!recipients) io.to(`room:${code}`).emit('fx', data);
          else for (const id of recipients) room.sockets.get(id)?.emit('fx', data);
        },
        chatReset: () => { for (const [id, s] of room.sockets) s.emit('chat:history', room.game.chatHistoryFor(id)); },
      },
    });
    rooms.set(code, room);
    return room;
  }

  // Coalesce bursts of changes (e.g. resolving a night) into one state push per tick.
  function queueSync(room) {
    if (room.syncQueued) return;
    room.syncQueued = true;
    setImmediate(() => {
      room.syncQueued = false;
      narrator.allow(narrationLines(room.game)); // pre-render this phase's story before anyone asks
      for (const [id, s] of room.sockets) s.emit('state', room.game.viewFor(id));
    });
  }

  function closeRoom(room, reason) {
    room.game.destroy();
    for (const t of room.graceTimers.values()) clearTimeout(t);
    clearTimeout(room.idleTimer);
    for (const s of room.sockets.values()) { s.emit('closed', { reason }); s.leave(`room:${room.code}`); s.data = {}; }
    rooms.delete(room.code);
  }

  function checkIdle(room) {
    clearTimeout(room.idleTimer);
    const anyone = room.game.players.some((p) => !p.isBot && p.connected);
    if (anyone) return;
    if (room.game.phase === 'lobby' && !room.game.players.some((p) => !p.isBot)) { closeRoom(room, 'empty'); return; }
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
    room.game.setConnected(playerId, true);
    clearTimeout(room.idleTimer);
    socket.emit('chat:history', room.game.chatHistoryFor(playerId));
    queueSync(room);
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
    const game = room.game;
    if (leaving || game.phase !== 'lobby') {
      if (leaving && game.phase === 'lobby') { game.removePlayer(playerId); room.tokens.delete(playerId); }
      else game.setConnected(playerId, false);
    } else {
      // Lobby: keep the seat briefly so a page refresh doesn't lose it.
      game.setConnected(playerId, false);
      room.graceTimers.set(playerId, setTimeout(() => {
        room.graceTimers.delete(playerId);
        if (!room.sockets.has(playerId) && game.phase === 'lobby') { game.removePlayer(playerId); room.tokens.delete(playerId); }
        checkIdle(room);
      }, LOBBY_GRACE_MS));
    }
    checkIdle(room);
  }

  io.on('connection', (socket) => {
    let tokens = RATE.burst, last = Date.now();
    const allow = () => {
      const now = Date.now();
      tokens = Math.min(RATE.burst, tokens + ((now - last) / 1000) * RATE.perSecond);
      last = now;
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    };
    const reply = (ack, data) => { if (typeof ack === 'function') ack(data); };
    const profile = (d) => ({ name: d && d.name, avatar: d && d.avatar });

    socket.on('room:create', (data, ack) => {
      if (!allow()) return reply(ack, { error: 'Too many requests.' });
      unbind(socket, { leaving: true });
      const room = createRoom();
      if (!room) return reply(ack, { error: 'The server is full. Try again later.' });
      const res = room.game.addPlayer({ id: 'p' + randomBytes(6).toString('hex'), ...profile(data) });
      if (res.error) return reply(ack, res);
      bind(socket, room, res.player.id);
      log(`[mafia] room ${room.code} created (${rooms.size} open)`);
      reply(ack, seat(room, res.player.id));
    });

    socket.on('room:join', (data, ack) => {
      if (!allow()) return reply(ack, { error: 'Too many requests.' });
      const room = rooms.get(String(data && data.code || '').trim());
      if (!room) return reply(ack, { error: 'No room with that code.' });
      unbind(socket, { leaving: true });
      const res = room.game.addPlayer({ id: 'p' + randomBytes(6).toString('hex'), ...profile(data) });
      if (res.error) return reply(ack, res);
      bind(socket, room, res.player.id);
      reply(ack, seat(room, res.player.id));
    });

    socket.on('room:resume', (data, ack) => {
      if (!allow()) return reply(ack, { error: 'Too many requests.' });
      const room = rooms.get(String(data && data.code || ''));
      const playerId = String(data && data.playerId || '');
      if (!room || !room.tokens.has(playerId) || room.tokens.get(playerId) !== String(data.token || '') || !room.game.get(playerId)) {
        return reply(ack, { error: 'That seat is gone.' });
      }
      bind(socket, room, playerId);
      reply(ack, { ok: true, code: room.code, playerId, token: room.tokens.get(playerId) });
    });

    socket.on('room:leave', (_data, ack) => { unbind(socket, { leaving: true }); reply(ack, { ok: true }); });

    socket.on('cmd', (cmd, ack) => {
      if (!allow()) return reply(ack, { error: 'Slow down.' });
      const { code, playerId } = socket.data || {};
      const room = code && rooms.get(code);
      if (!room) return reply(ack, { error: 'You are not in a room.' });
      let res;
      try { res = room.game.command(playerId, cmd); } catch (e) { log('[mafia] command failed', e); res = { error: 'Server error.' }; }
      reply(ack, res && res.player ? { ok: true } : res);
    });

    socket.on('disconnect', () => unbind(socket));
  });

  log(`[mafia] game server on ${path}`);
  return { paths: [path], close: () => { for (const r of rooms.values()) closeRoom(r, 'shutdown'); io.close(); } };
}
