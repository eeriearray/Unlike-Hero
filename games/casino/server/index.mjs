// Neon Casino game server — the bank and the dealer for every room.
//
// Loaded by server/relay.mjs because games/casino/game.json names it in "server". Runs Socket.io at
// /games/casino/socket.io. Clients send intents; the room validates and applies them, and each socket only ever
// receives room.viewFor(itsOwnPlayer). Rooms are saved to server/data/rooms.json so a restart keeps every wallet.
// This folder is never served over HTTP (relay.mjs blocks any path containing /server/).
import { Server } from 'socket.io';
import { randomInt } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CasinoRoom, normalizeSettings, DEFAULT_SETTINGS } from './room.mjs';

const DATA_DIR = fileURLToPath(new URL('./data/', import.meta.url));
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I
const LOBBY_GRACE_MS = 2 * 60_000;     // a lobby seat with nobody on it is released after this
const IDLE_ROOM_MS = 24 * 60 * 60_000; // rooms nobody has visited for a day are closed
const MAX_ROOMS = 300;
const RATE = { burst: 20, perSecond: 8 }; // per-socket command budget
const SAVE_DELAY_MS = 750;

export default async function attach({ httpServer, basePath, log = console.log, dataDir = DATA_DIR, persist = true }) {
  const path = `${basePath}socket.io`;
  const io = new Server(httpServer, {
    path,
    serveClient: true,           // <basePath>socket.io/socket.io.min.js
    destroyUpgrade: false,       // leave other WebSocket upgrades (the hub relay, other games) alone
    maxHttpBufferSize: 16 * 1024,
    pingInterval: 15_000,
    pingTimeout: 20_000,
  });

  /** code -> { room, sockets: Map<playerId, Set<socket>>, graceTimers: Map, syncQueued } */
  const rooms = new Map();
  const file = join(dataDir, 'rooms.json');
  let saveTimer = null;

  function scheduleSave() {
    if (!persist || saveTimer) return;
    saveTimer = setTimeout(() => { saveTimer = null; save().catch((e) => log('[casino] save failed', e.message)); }, SAVE_DELAY_MS);
  }
  async function save() {
    await mkdir(dataDir, { recursive: true });
    const data = JSON.stringify({ savedAt: Date.now(), rooms: [...rooms.values()].map((r) => r.room.toJSON()) });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, file);   // atomic: a crash mid-write never leaves a half file
  }

  function newCode() {
    for (let i = 0; i < 100; i++) {
      let code = '';
      for (let j = 0; j < 5; j++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
      if (!rooms.has(code)) return code;
    }
    return null;
  }

  function entryFor(room) {
    const entry = { room, sockets: new Map(), graceTimers: new Map(), syncQueued: false };
    room.hooks.sync = () => queueSync(entry);
    room.hooks.fx = (recipients, data) => {
      if (!recipients) io.to(`room:${room.code}`).emit('fx', data);
      else for (const id of recipients) for (const s of entry.sockets.get(id) || []) s.emit('fx', data);
    };
    rooms.set(room.code, entry);
    return entry;
  }

  // Coalesce bursts of changes into one push per tick, each socket getting its own player's view.
  function queueSync(entry) {
    scheduleSave();
    if (entry.syncQueued) return;
    entry.syncQueued = true;
    setImmediate(() => {
      entry.syncQueued = false;
      for (const [id, set] of entry.sockets) {
        const view = entry.room.viewFor(id);
        for (const s of set) s.emit('state', view);
      }
    });
  }

  function closeRoom(entry, reason) {
    entry.room.destroy();
    for (const t of entry.graceTimers.values()) clearTimeout(t);
    for (const set of entry.sockets.values()) for (const s of set) { s.emit('closed', { reason }); s.leave(`room:${entry.room.code}`); s.data = {}; }
    rooms.delete(entry.room.code);
    scheduleSave();
  }

  function bind(socket, entry, playerId) {
    const { room } = entry;
    socket.data = { code: room.code, playerId };
    socket.join(`room:${room.code}`);
    const set = entry.sockets.get(playerId) || new Set();
    set.add(socket);
    entry.sockets.set(playerId, set);
    clearTimeout(entry.graceTimers.get(playerId));
    entry.graceTimers.delete(playerId);
    room.setConnected(playerId, true);
  }

  // A player may have several tabs open; they stay "online" until the last one goes.
  function unbind(socket, { leaving = false } = {}) {
    const { code, playerId } = socket.data || {};
    socket.data = {};
    const entry = code && rooms.get(code);
    if (!entry) return;
    socket.leave(`room:${code}`);
    const set = entry.sockets.get(playerId);
    if (set) { set.delete(socket); if (!set.size) entry.sockets.delete(playerId); }
    const { room } = entry;
    if (!room.get(playerId)) return;
    if (leaving) {
      for (const s of entry.sockets.get(playerId) || []) { s.emit('closed', { reason: 'left' }); s.leave(`room:${code}`); s.data = {}; }
      entry.sockets.delete(playerId);
      room.removePlayer(playerId);
      return;
    }
    if (entry.sockets.has(playerId)) return;
    room.setConnected(playerId, false);
    if (room.session.phase === 'lobby') {
      entry.graceTimers.set(playerId, setTimeout(() => {
        entry.graceTimers.delete(playerId);
        if (!entry.sockets.has(playerId) && room.session.phase === 'lobby' && room.get(playerId)) room.removePlayer(playerId);
      }, LOBBY_GRACE_MS));
    }
  }

  // Restore rooms saved by a previous run.
  if (persist) {
    try {
      const data = JSON.parse(await readFile(file, 'utf8'));
      for (const r of data.rooms || []) {
        try { entryFor(CasinoRoom.fromJSON(r)); } catch (e) { log(`[casino] could not restore room ${r && r.code}: ${e.message}`); }
      }
      if (rooms.size) log(`[casino] restored ${rooms.size} room(s)`);
    } catch (e) { if (e.code !== 'ENOENT') log('[casino] could not read saved rooms:', e.message); }
  }

  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const entry of rooms.values()) {
      const r = entry.room;
      if (entry.sockets.size) continue;
      const last = Math.max(r.createdAt, ...r.humans().map((p) => p.lastSeen || 0));
      if (now - last > IDLE_ROOM_MS) closeRoom(entry, 'idle');
    }
  }, 10 * 60_000);
  sweeper.unref?.();

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
    const profile = (d) => ({ name: d && d.name, avatar: d && d.avatar, deviceKey: d && d.deviceKey });
    const seat = (entry, res) => ({ ok: true, code: entry.room.code, playerId: res.player.id, token: res.token, rejoined: !!res.rejoined });

    socket.on('room:create', (data, ack) => {
      if (!allow()) return reply(ack, { error: 'Too many requests. Wait a moment.' });
      if (rooms.size >= MAX_ROOMS) return reply(ack, { error: 'The casino is full. Try again later.' });
      let settings = DEFAULT_SETTINGS;
      if (data && data.settings) { const n = normalizeSettings(data.settings); if (n.error) return reply(ack, n); settings = n.settings; }
      const code = newCode();
      if (!code) return reply(ack, { error: 'Could not make a room code. Try again.' });
      unbind(socket, { leaving: true });
      const entry = entryFor(new CasinoRoom({ code, settings }));
      const res = entry.room.addPlayer(profile(data));
      if (res.error) { rooms.delete(code); return reply(ack, res); }
      bind(socket, entry, res.player.id);
      log(`[casino] room ${code} opened (${rooms.size} open)`);
      reply(ack, seat(entry, res));
    });

    socket.on('room:join', (data, ack) => {
      if (!allow()) return reply(ack, { error: 'Too many requests. Wait a moment.' });
      const entry = rooms.get(String(data && data.code || '').trim().toUpperCase());
      if (!entry) return reply(ack, { error: 'No room with that code. Check it with the host.' });
      unbind(socket, { leaving: false });
      const res = entry.room.addPlayer(profile(data));
      if (res.error) return reply(ack, res);
      bind(socket, entry, res.player.id);
      reply(ack, seat(entry, res));
    });

    socket.on('room:resume', (data, ack) => {
      if (!allow()) return reply(ack, { error: 'Too many requests. Wait a moment.' });
      const entry = rooms.get(String(data && data.code || ''));
      const playerId = String(data && data.playerId || '');
      if (!entry || !entry.room.checkToken(playerId, String(data && data.token || ''))) return reply(ack, { error: 'That seat is no longer available.' });
      if (socket.data && socket.data.playerId !== playerId) unbind(socket);
      if (!socket.data || !socket.data.playerId) bind(socket, entry, playerId);
      reply(ack, { ok: true, code: entry.room.code, playerId, token: data.token });
    });

    socket.on('room:leave', (_data, ack) => { unbind(socket, { leaving: true }); reply(ack, { ok: true }); });

    socket.on('cmd', (cmd, ack) => {
      if (!allow()) return reply(ack, { error: 'Slow down a little.' });
      const { code, playerId } = socket.data || {};
      const entry = code && rooms.get(code);
      if (!entry) return reply(ack, { error: 'You are not in a room.' });
      let res;
      try { res = entry.room.command(playerId, cmd); } catch (e) { log('[casino] command failed', e); res = { error: 'Something went wrong on the server. Try again.' }; }
      reply(ack, res);
    });

    socket.on('disconnect', () => unbind(socket));
  });

  log(`[casino] game server on ${path}`);
  return {
    paths: [path],
    rooms,
    save,
    close: async () => {
      clearInterval(sweeper);
      clearTimeout(saveTimer);
      if (persist) await save().catch(() => {});
      for (const e of rooms.values()) { e.room.destroy(); for (const t of e.graceTimers.values()) clearTimeout(t); }
      io.close();
    },
  };
}
