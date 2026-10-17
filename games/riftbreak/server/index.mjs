// RIFTBREAK game server — authoritative rooms for online play.
//
// Loaded by server/relay.mjs because games/riftbreak/game.json names it in "server".
// Speaks plain JSON over a WebSocket at /games/riftbreak/ws. The rules engine (../engine/riftbreak-engine.js)
// runs here: shuffles, draws, legality, turn order and the win are all decided on the server, and each
// socket only ever receives game.viewFor(itsOwnPlayer) — never another player's hand.
// This folder is never served over HTTP (relay.mjs blocks any path containing /server/).
//
// Client → server   { t: 'create'|'join'|'resume'|'leave'|'cmd', rid, ... }
// Server → client   { t: 'reply', rid, res }   { t: 'state', view }   { t: 'closed', reason }
import { WebSocketServer } from 'ws';
import { createRequire } from 'node:module';
import { randomBytes, randomInt } from 'node:crypto';

const require = createRequire(import.meta.url);
const { RiftGame } = require('../engine/riftbreak-engine.js');

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ';   // no I, L, O: easy to read aloud
const LOBBY_GRACE_MS = 20_000;                  // a lobby seat survives a refresh or a brief drop
const IDLE_ROOM_MS = 15 * 60_000;               // rooms with no connected humans close after this
const MAX_ROOMS = 400;
const RATE = { burst: 24, perSecond: 8 };       // per-socket message budget
const PING_MS = 20_000;

export default function attach({ httpServer, basePath, log = console.log, timers }) {
  const path = `${basePath}ws`;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
  const T = timers || { set: (fn, ms) => setTimeout(fn, ms), clear: (t) => clearTimeout(t) };

  /** code -> { code, game, sockets: Map<playerId, ws>, tokens: Map<playerId, token>, grace: Map, idleTimer, queued } */
  const rooms = new Map();

  httpServer.on('upgrade', (req, socket, head) => {
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { return; }
    if (url.pathname !== path) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  function newCode() {
    for (let i = 0; i < 60; i++) {
      let code = '';
      for (let k = 0; k < 4; k++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
      if (!rooms.has(code)) return code;
    }
    return null;
  }

  function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }

  function createRoom() {
    const code = newCode();
    if (!code || rooms.size >= MAX_ROOMS) return null;
    const room = { code, sockets: new Map(), tokens: new Map(), grace: new Map(), idleTimer: null, queued: false };
    room.game = new RiftGame({ code, timers: T, hooks: { sync: () => queueSync(room) } });
    rooms.set(code, room);
    return room;
  }

  // Coalesce bursts of changes into one push per tick. Each socket gets the events it hasn't seen yet.
  function queueSync(room) {
    if (room.queued) return;
    room.queued = true;
    setImmediate(() => {
      room.queued = false;
      for (const [id, ws] of room.sockets) pushState(room, id, ws);
    });
  }
  function pushState(room, id, ws) {
    const round = room.game.round;
    const since = ws.round === round ? ws.seen : null;
    const view = room.game.viewFor(id, since);
    if (view.match && view.match.events.length) ws.seen = view.match.events[view.match.events.length - 1].seq;
    else if (ws.round !== round) ws.seen = 0;
    ws.round = round;
    send(ws, { t: 'state', view });
  }

  function closeRoom(room, reason) {
    room.game.destroy();
    for (const t of room.grace.values()) T.clear(t);
    T.clear(room.idleTimer);
    for (const ws of room.sockets.values()) { send(ws, { t: 'closed', reason }); ws.seat = null; }
    rooms.delete(room.code);
    log(`[riftbreak] room ${room.code} closed (${reason}); ${rooms.size} open`);
  }

  function checkIdle(room) {
    T.clear(room.idleTimer);
    const humans = room.game.seats.filter((s) => !s.isBot && !s.left);
    if (humans.some((s) => s.connected)) return;
    if (room.game.phase === 'lobby' && !humans.length) { closeRoom(room, 'empty'); return; }
    room.idleTimer = T.set(() => closeRoom(room, 'idle'), IDLE_ROOM_MS);
  }

  function bind(ws, room, playerId) {
    const prev = room.sockets.get(playerId);
    if (prev && prev !== ws) { send(prev, { t: 'closed', reason: 'replaced' }); prev.seat = null; }
    T.clear(room.grace.get(playerId));
    room.grace.delete(playerId);
    room.sockets.set(playerId, ws);
    ws.seat = { code: room.code, playerId };
    ws.seen = 0; ws.round = -1;   // first push carries the full recent event log
    room.game.setConnected(playerId, true);
    T.clear(room.idleTimer);
    queueSync(room);
  }

  function seatReply(room, playerId) {
    const token = randomBytes(18).toString('base64url');
    room.tokens.set(playerId, token);
    return { ok: true, code: room.code, playerId, token };
  }

  function unbind(ws, { leaving = false } = {}) {
    const { code, playerId } = ws.seat || {};
    const room = code && rooms.get(code);
    ws.seat = null;
    if (!room || room.sockets.get(playerId) !== ws) return;
    room.sockets.delete(playerId);
    const game = room.game;
    if (leaving) {
      game.removePlayer(playerId, playerId);
      if (game.phase === 'lobby') room.tokens.delete(playerId);
    } else if (game.phase === 'lobby') {
      game.setConnected(playerId, false);
      room.grace.set(playerId, T.set(() => {
        room.grace.delete(playerId);
        if (!room.sockets.has(playerId) && game.phase === 'lobby') { game.removePlayer(playerId, playerId); room.tokens.delete(playerId); }
        checkIdle(room);
      }, LOBBY_GRACE_MS));
    } else {
      game.setConnected(playerId, false);   // the engine hands the seat to a bot after a short grace
    }
    checkIdle(room);
  }

  const profile = (d) => ({ name: d && typeof d.name === 'string' ? d.name : 'Player', avatar: d && d.avatar });

  wss.on('connection', (ws) => {
    let budget = RATE.burst, last = Date.now();
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    const allow = () => {
      const now = Date.now();
      budget = Math.min(RATE.burst, budget + ((now - last) / 1000) * RATE.perSecond);
      last = now;
      if (budget < 1) return false;
      budget -= 1;
      return true;
    };

    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      const reply = (res) => send(ws, { t: 'reply', rid: msg.rid, res });
      if (!allow()) return reply({ error: 'Slow down.' });

      switch (msg.t) {
        case 'create': {
          unbind(ws, { leaving: true });
          const room = createRoom();
          if (!room) return reply({ error: 'The server is full. Try again later.' });
          const res = room.game.addPlayer({ id: 'p' + randomBytes(6).toString('hex'), ...profile(msg) });
          if (res.error) return reply(res);
          if (msg.settings) room.game.updateSettings(res.player.id, msg.settings);
          bind(ws, room, res.player.id);
          log(`[riftbreak] room ${room.code} created (${rooms.size} open)`);
          return reply(seatReply(room, res.player.id));
        }
        case 'join': {
          const room = rooms.get(String(msg.code || '').trim().toUpperCase());
          if (!room) return reply({ error: 'No room with that code.' });
          unbind(ws, { leaving: true });
          const res = room.game.addPlayer({ id: 'p' + randomBytes(6).toString('hex'), ...profile(msg) });
          if (res.error) return reply(res);
          bind(ws, room, res.player.id);
          return reply(seatReply(room, res.player.id));
        }
        case 'resume': {
          const room = rooms.get(String(msg.code || '').toUpperCase());
          const playerId = String(msg.playerId || '');
          if (!room || !room.tokens.has(playerId) || room.tokens.get(playerId) !== String(msg.token || '') || !room.game.seat(playerId) || room.game.seat(playerId).left) {
            return reply({ error: 'That seat is gone.' });
          }
          bind(ws, room, playerId);
          return reply({ ok: true, code: room.code, playerId, token: room.tokens.get(playerId) });
        }
        case 'leave':
          if (ws.seat) log(`[riftbreak] a player left room ${ws.seat.code}`);
          unbind(ws, { leaving: true });
          return reply({ ok: true });
        case 'cmd': {
          const { code, playerId } = ws.seat || {};
          const room = code && rooms.get(code);
          if (!room) return reply({ error: 'You are not in a room.' });
          let res;
          try { res = room.game.command(playerId, msg.cmd); } catch (e) { log('[riftbreak] command failed', e); res = { error: 'Server error.' }; }
          return reply(res && res.player ? { ok: true } : res);
        }
        default:
          return reply({ error: 'Unknown message.' });
      }
    });

    ws.on('close', () => unbind(ws));
    ws.on('error', () => ws.terminate());
  });

  // Drop sockets that stopped answering (closed laptop lids, dead Wi-Fi) so their seat goes to autopilot.
  const pinger = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      try { ws.ping(); } catch { /* closing */ }
    }
  }, PING_MS);
  pinger.unref?.();

  log(`[riftbreak] game server on ${path}`);
  return {
    paths: [path],
    rooms,
    close: () => { clearInterval(pinger); for (const r of [...rooms.values()]) closeRoom(r, 'shutdown'); wss.close(); },
  };
}
