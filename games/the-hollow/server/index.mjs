// THE HOLLOW — game server: the authoritative table for online expeditions.
//
// Loaded by server/relay.mjs because games/the-hollow/game.json names it in "server".
// Runs Socket.io at /games/the-hollow/socket.io. Every roll, reward and rule lives in ../engine; a client only
// ever receives game.viewFor(itsOwnId), so private objectives and unfound secrets never leave the server.
// Rooms survive a server restart (saved to ./.data/rooms.json) so a refresh, a crash or a deploy does not end an expedition.
import { Server } from 'socket.io';
import { createRequire } from 'node:module';
import { randomBytes, randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';

const require = createRequire(import.meta.url);
const Engine = require('../engine/index.js');
const { HollowGame } = Engine;
const CATALOG = Engine.catalog();

const DATA_DIR = process.env.HOLLOW_DATA_DIR || fileURLToPath(new URL('./.data/', import.meta.url));
const LOBBY_GRACE_MS = 2 * 60_000;        // a lobby seat survives a refresh, a locked phone or a Wi-Fi drop
const LOBBY_IDLE_MS = 15 * 60_000;        // an empty lobby is closed after this
const GAME_IDLE_MS = 6 * 60 * 60_000;     // an abandoned expedition is closed after this
const ENDED_KEEP_MS = 30 * 60_000;        // finished expeditions linger so late players can read the results
const MAX_ROOMS = 300;
const RATE = { burst: 24, perSecond: 8 }; // per-socket command budget
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** IPv4 addresses other devices on the same Wi-Fi can reach (private ranges and Wi-Fi/Ethernet first). */
function lanAddresses() {
  const out = [];
  for (const [nic, list] of Object.entries(networkInterfaces())) for (const a of list || []) {
    if ((a.family !== 'IPv4' && a.family !== 4) || a.internal || /^(127\.|169\.254\.|192\.0\.0\.)/.test(a.address)) continue;
    out.push({ address: a.address, nic, private: /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address) });
  }
  return out.sort((x, y) => (y.private - x.private) || (/^en|^wl|^eth/.test(y.nic) - /^en|^wl|^eth/.test(x.nic))).map((a) => a.address);
}

export default function attach({ httpServer, basePath, log = console.log, dataDir = DATA_DIR, persist = true }) {
  const path = `${basePath}socket.io`;

  // <basePath>net-info: this computer's Wi-Fi address, so a host who opened the game on localhost copies an invite
  // link the other devices can open. Answered only to this computer.
  const previous = httpServer.listeners('request').slice();
  httpServer.removeAllListeners('request');
  httpServer.on('request', (req, res) => {
    if ((req.url || '').split('?')[0] !== `${basePath}net-info`) { for (const l of previous) l.call(httpServer, req, res); return; }
    const a = req.socket.remoteAddress || '';
    const local = a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
    res.writeHead(local ? 200 : 403, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(local ? { addresses: lanAddresses(), port: httpServer.address() && httpServer.address().port } : { error: 'localhost only' }));
  });

  const io = new Server(httpServer, {
    path, serveClient: true, destroyUpgrade: false, maxHttpBufferSize: 16 * 1024, pingInterval: 15_000, pingTimeout: 20_000,
  });

  /** code -> { game, sockets: Map<pid, socket>, tokens: Map<pid, token>, grace: Map, syncQueued, touched, dirty } */
  const rooms = new Map();
  const file = join(dataDir, 'rooms.json');

  function newCode() {
    for (let i = 0; i < 80; i++) {
      let c = ''; for (let k = 0; k < 4; k++) c += CODE_CHARS[randomInt(CODE_CHARS.length)];
      if (!rooms.has(c)) return c;
    }
    return null;
  }

  function makeRoom(code, game, tokens) {
    const room = { code, game, sockets: new Map(), tokens: tokens || new Map(), grace: new Map(), syncQueued: false, touched: Date.now(), dirty: true };
    game.hooks = { sync: () => { room.dirty = true; queueSync(room); } };
    rooms.set(code, room);
    return room;
  }

  function createRoom() {
    const code = newCode();
    if (!code || rooms.size >= MAX_ROOMS) return null;
    return makeRoom(code, new HollowGame({ code }));
  }

  function queueSync(room) {
    if (room.syncQueued) return;
    room.syncQueued = true;
    setImmediate(() => {
      room.syncQueued = false;
      for (const [id, s] of room.sockets) s.emit('state', room.game.viewFor(id));
    });
  }

  function closeRoom(room, reason) {
    room.game.destroy();
    for (const t of room.grace.values()) clearTimeout(t);
    // on shutdown nobody is told the room closed: it is saved, and their seats come back when the server does
    for (const s of room.sockets.values()) { if (reason !== 'shutdown') s.emit('closed', { reason }); s.leave(`room:${room.code}`); s.data = {}; }
    rooms.delete(room.code);
    if (reason !== 'shutdown') save(true);   // on shutdown the file keeps every room, so a restart can bring them back
  }

  function bind(socket, room, playerId) {
    const prev = room.sockets.get(playerId);
    if (prev && prev !== socket) { prev.emit('closed', { reason: 'replaced' }); prev.data = {}; prev.leave(`room:${room.code}`); }
    clearTimeout(room.grace.get(playerId)); room.grace.delete(playerId);
    room.sockets.set(playerId, socket);
    socket.data = { code: room.code, playerId };
    socket.join(`room:${room.code}`);
    const p = room.game.get(playerId);
    if (p && !p.connected) room.game.setConnected(playerId, true);   // a refresh of a live seat (page back from the background) is not a "return"
    room.touched = Date.now();
    queueSync(room);
  }

  function seat(room, playerId) {
    let token = room.tokens.get(playerId);
    if (!token) { token = randomBytes(18).toString('base64url'); room.tokens.set(playerId, token); }
    return { ok: true, code: room.code, playerId, token, catalog: CATALOG };
  }

  function unbind(socket, { leaving = false } = {}) {
    const { code, playerId } = socket.data || {};
    const room = code && rooms.get(code);
    socket.data = {};
    if (!room || room.sockets.get(playerId) !== socket) return;
    room.sockets.delete(playerId);
    socket.leave(`room:${code}`);
    const game = room.game;
    if (game.phase === 'lobby') {
      if (leaving) { game.removePlayer(playerId); room.tokens.delete(playerId); }
      else {
        game.setConnected(playerId, false);
        room.grace.set(playerId, setTimeout(() => {
          room.grace.delete(playerId);
          if (!room.sockets.has(playerId) && game.phase === 'lobby') { game.removePlayer(playerId); room.tokens.delete(playerId); }
        }, LOBBY_GRACE_MS));
      }
    } else game.setConnected(playerId, false);   // in a game the seat is kept, and the table's AFK policy applies
    room.touched = Date.now();
  }

  io.on('connection', (socket) => {
    let tokens = RATE.burst, last = Date.now();
    const allow = () => {
      const now = Date.now();
      tokens = Math.min(RATE.burst, tokens + ((now - last) / 1000) * RATE.perSecond);
      last = now;
      if (tokens < 1) return false;
      tokens -= 1; return true;
    };
    const reply = (ack, data) => { if (typeof ack === 'function') ack(data); };
    const name = (d) => String((d && d.name) || '').slice(0, 40);

    socket.on('room:create', (data, ack) => {
      if (!allow()) return reply(ack, { error: 'Too many requests.' });
      unbind(socket, { leaving: true });
      const room = createRoom();
      if (!room) return reply(ack, { error: 'The server is full. Try again later.' });
      const res = room.game.addPlayer({ id: 'p' + randomBytes(6).toString('hex'), name: name(data) });
      if (res.error) return reply(ack, res);
      bind(socket, room, res.player.id);
      log(`[the-hollow] room ${room.code} created (${rooms.size} open)`);
      reply(ack, seat(room, res.player.id));
    });

    socket.on('room:join', (data, ack) => {
      if (!allow()) return reply(ack, { error: 'Too many requests.' });
      const room = rooms.get(String(data && data.code || '').trim().toUpperCase());
      if (!room) return reply(ack, { error: 'No expedition with that code. It may have ended or expired.' });
      if (room.game.phase === 'ended') return reply(ack, { error: 'That expedition has already ended.' });
      if (room.game.phase !== 'lobby') {
        // Lost your seat's key (another device, cleared browser, phone died)? Joining with the same name takes back a
        // seat whose player is away. The old key stops working, so the seat is never held twice.
        const want = name(data).trim().replace(/\s+/g, ' ').toLowerCase();
        const p = want && room.game.players.find((x) => !x.bot && x.name.toLowerCase() === want && !room.sockets.has(x.id));
        if (!p) return reply(ack, { error: 'That expedition has already set out. To take back your seat, join with the same name you played under.' });
        unbind(socket, { leaving: true });
        room.tokens.delete(p.id);
        bind(socket, room, p.id);
        log(`[the-hollow] ${p.name} took back a seat in ${room.code}`);
        return reply(ack, seat(room, p.id));
      }
      unbind(socket, { leaving: true });
      const res = room.game.addPlayer({ id: 'p' + randomBytes(6).toString('hex'), name: name(data) });
      if (res.error) return reply(ack, res);
      bind(socket, room, res.player.id);
      reply(ack, seat(room, res.player.id));
    });

    socket.on('room:resume', (data, ack) => {
      if (!allow()) return reply(ack, { error: 'Too many requests.' });
      const room = rooms.get(String(data && data.code || '').toUpperCase());
      const playerId = String(data && data.playerId || '');
      if (!room || room.tokens.get(playerId) !== String(data && data.token || '') || !room.game.get(playerId)) {
        return reply(ack, { error: 'That seat is gone. The expedition may have ended or expired.' });
      }
      bind(socket, room, playerId);
      reply(ack, seat(room, playerId));
    });

    socket.on('room:leave', (_data, ack) => { unbind(socket, { leaving: true }); reply(ack, { ok: true }); });

    socket.on('cmd', (cmd, ack) => {
      if (!allow()) return reply(ack, { error: 'Slow down.' });
      const { code, playerId } = socket.data || {};
      const room = code && rooms.get(code);
      if (!room) return reply(ack, { error: 'You are not in an expedition.' });
      room.touched = Date.now();
      let res;
      try { res = room.game.command(playerId, cmd); } catch (e) { log('[the-hollow] command failed', e); res = { error: 'Server error.' }; }
      if (res && res.error) socket.emit('state', room.game.viewFor(playerId));   // heal any stale client
      reply(ack, res);
    });

    socket.on('disconnect', () => unbind(socket));
  });

  // One heartbeat: timers for every game (turn clocks, AFK policy, companions), expiry, persistence.
  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      try { room.game.tick(); } catch (e) { log('[the-hollow] tick failed', e); }
      const g = room.game, anyone = [...room.sockets.keys()].length > 0;
      if (g.phase === 'lobby' && !anyone && now - room.touched > LOBBY_IDLE_MS) closeRoom(room, 'idle');
      else if (g.phase === 'playing' && !anyone && now - room.touched > GAME_IDLE_MS) closeRoom(room, 'idle');
      else if (g.phase === 'ended' && now - room.touched > ENDED_KEEP_MS && !anyone) closeRoom(room, 'ended');
    }
    save(false);
  }, 1000);
  heartbeat.unref && heartbeat.unref();

  let lastSave = 0;
  function save(force) {
    if (!persist) return;
    const now = Date.now();
    if (!force && now - lastSave < 8000) return;
    const dirty = [...rooms.values()].some((r) => r.dirty);
    if (!force && !dirty) return;
    lastSave = now;
    try {
      mkdirSync(dataDir, { recursive: true });
      const out = { saved: now, rooms: [...rooms.values()].filter((r) => r.game.phase !== 'ended').map((r) => ({ code: r.code, touched: r.touched, tokens: Object.fromEntries(r.tokens), snap: r.game.snapshot() })) };
      const tmp = file + '.tmp';
      writeFileSync(tmp, JSON.stringify(out));
      renameSync(tmp, file);
      for (const r of rooms.values()) r.dirty = false;
    } catch (e) { log('[the-hollow] could not save rooms:', e.message); }
  }

  function load() {
    if (!persist || !existsSync(file)) return;
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'));
      let n = 0;
      for (const r of data.rooms || []) {
        if (Date.now() - r.touched > GAME_IDLE_MS) continue;
        const game = HollowGame.restore(r.snap, {});
        const room = makeRoom(r.code, game, new Map(Object.entries(r.tokens || {})));
        room.touched = Date.now(); room.dirty = false; n++;
      }
      if (n) log(`[the-hollow] restored ${n} expedition(s)`);
    } catch (e) { log('[the-hollow] could not restore rooms:', e.message); }
  }
  load();

  log(`[the-hollow] game server on ${path}`);
  return { paths: [path], close: () => { save(true); clearInterval(heartbeat); for (const r of [...rooms.values()]) closeRoom(r, 'shutdown'); io.close(); } };
}
