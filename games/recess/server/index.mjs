// RECESS game server: rooms, matchmaking queues and isolated match sessions.
//
// Everything lives in memory. A server restart forgets every room; clients are told so honestly
// when their resume fails. The server is authoritative: clients send intents, engines validate them,
// and each player only ever receives the view their engine builds for them.
import { WebSocketServer } from 'ws';
import { randomInt, randomBytes } from 'node:crypto';
import { GAMES } from './registry.mjs';
import { AVATAR_IDS, REACTIONS, MOODS } from '../shared/avatars.js';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no I, L, O: easy to read aloud
const MAX_ROOMS = 200;
const MAX_PLAYERS = 16;
const RECONNECT_GRACE_MS = 30_000;
const QUEUE_TIMEOUT_MS = 10 * 60_000;
const EMPTY_ROOM_MS = 10 * 60_000;
const RATE_WINDOW_MS = 2000;
const RATE_MAX = 40;

const BOT_NAMES = ['Bunty', 'Chintu', 'Pappu', 'Munni', 'Guddu', 'Pinky', 'Bablu', 'Tinku'];
const BOT_AVATARS = ['spiky', 'plaits', 'cap', 'bow', 'specs', 'bun', 'band', 'curly'];

export const ROOM_CODE = /^[A-HJKMNP-Z]{4}$/;

const id = (prefix) => prefix + randomBytes(5).toString('hex');
const cleanName = (s, fallback) => (typeof s === 'string' ? s : '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || fallback;
const cleanAvatar = (a) => (AVATAR_IDS.includes(a) ? a : AVATAR_IDS[randomInt(AVATAR_IDS.length)]);

export default function attach({ httpServer, basePath, log = console.log }) {
  const path = `${basePath}ws`;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const rooms = new Map(); // code -> room

  httpServer.on('upgrade', (req, socket, head) => {
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { return; }
    if (url.pathname !== path) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  // ─── helpers ───────────────────────────────────────────────────────────

  function send(ws, msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  function generateCode() {
    for (let i = 0; i < 100; i++) {
      let code = '';
      for (let k = 0; k < 4; k++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
      if (!rooms.has(code)) return code;
    }
    return null;
  }

  function feed(room, text, extra = {}) {
    room.feed.push({ text: String(text).slice(0, 160), time: Date.now(), ...extra });
    if (room.feed.length > 60) room.feed.shift();
  }

  function uniqueName(room, name, exceptId) {
    const taken = new Set([...room.players.values()].filter(p => p.id !== exceptId).map(p => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let n = 2; n < 99; n++) {
      const candidate = `${name.slice(0, 13)} ${n}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return name;
  }

  function queuedGame(room, playerId) {
    for (const [gameType, q] of room.queues) if (q.has(playerId)) return gameType;
    return null;
  }

  function dequeue(room, playerId) {
    for (const q of room.queues.values()) q.delete(playerId);
  }

  function lobbyView(room, forId) {
    const queues = {};
    const queueMembers = {};
    for (const [g, q] of room.queues) {
      queues[g] = q.size;
      queueMembers[g] = [...q.keys()];
    }
    const matches = [...room.matches.values()].map(m => ({
      matchId: m.matchId,
      gameType: m.gameType,
      players: m.engine.players.map(p => ({ id: p.id, name: p.name, isBot: !!p.isBot }))
    }));
    return {
      code: room.code,
      hostId: room.hostId,
      me: forId,
      serverTime: Date.now(),
      players: [...room.players.values()].map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        mood: p.mood,
        online: room.sockets.has(p.id),
        status: p.currentMatchId ? 'in-game' : (queuedGame(room, p.id) ? 'queued' : 'idle'),
        currentGame: p.currentGame || queuedGame(room, p.id)
      })),
      queues,
      queueMembers,
      myQueue: queuedGame(room, forId),
      matches,
      feed: room.feed.slice(-25),
      chat: room.feed.slice(-25) // older clients/tests read `chat`
    };
  }

  function broadcastRoom(room) {
    for (const [playerId, ws] of room.sockets) send(ws, { t: 'lobby-state', view: lobbyView(room, playerId) });
  }

  function toRoom(room, msg, exceptId) {
    for (const [pid, ws] of room.sockets) if (pid !== exceptId) send(ws, msg);
  }

  // Coalesce several state changes in one tick into a single message per player.
  function syncMatch(room, matchId) {
    const m = room.matches.get(matchId);
    if (!m || m.syncQueued) return;
    m.syncQueued = true;
    queueMicrotask(() => {
      m.syncQueued = false;
      if (!room.matches.has(matchId)) return;
      const e = m.engine;
      if (e.announcements?.length) {
        for (const a of e.announcements.splice(0)) feed(room, a, { kind: 'result', game: m.gameType });
        broadcastRoom(room);
      }
      for (const p of e.players) {
        if (p.isBot) continue;
        const pl = room.players.get(p.id);
        if (!pl || pl.currentMatchId !== matchId) continue; // returned to lobby
        const ws = room.sockets.get(p.id);
        if (!ws) continue;
        const view = e.getView(p.id);
        view.abandoned = e.abandoned || null;
        view.serverTime = Date.now();
        send(ws, { t: 'game-state', matchId, view });
      }
    });
  }

  function startMatch(room, gameType, players, options = {}) {
    const game = GAMES[gameType];
    const matchId = id('m_');
    const entry = { matchId, gameType, engine: null, syncQueued: false };
    room.matches.set(matchId, entry);
    try {
      entry.engine = new game.Engine(matchId, players, () => syncMatch(room, matchId), options || {});
    } catch (e) {
      room.matches.delete(matchId);
      log(`RECESS: could not start ${gameType}:`, e.message);
      return null;
    }
    for (const p of players) {
      if (p.isBot) continue;
      dequeue(room, p.id);
      const pl = room.players.get(p.id);
      if (pl) { pl.currentMatchId = matchId; pl.currentGame = gameType; }
    }
    if (!game.solo) {
      const names = players.map(p => p.name);
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
      feed(room, `${list} started ${game.name}.`, { kind: 'start', game: gameType });
    }
    broadcastRoom(room);
    syncMatch(room, matchId);
    return matchId;
  }

  function humansFrom(room, ids) {
    return ids.map(pid => room.players.get(pid)).filter(Boolean)
      .map(p => ({ id: p.id, name: p.name, avatar: p.avatar, isBot: false }));
  }

  function withBots(players, count) {
    const out = [...players];
    const used = new Set(out.map(p => p.name));
    let i = 0;
    while (out.length < count) {
      let name = BOT_NAMES[i % BOT_NAMES.length];
      if (used.has(name)) name = `${name} ${Math.floor(i / BOT_NAMES.length) + 2}`;
      used.add(name);
      out.push({ id: id('bot_'), name, avatar: BOT_AVATARS[i % BOT_AVATARS.length], isBot: true });
      i++;
    }
    return out;
  }

  // Start as many full matches as the queue allows (auto games only).
  function checkQueue(room, gameType) {
    const game = GAMES[gameType];
    const q = room.queues.get(gameType);
    if (!game.auto) return;
    while (q.size >= game.max) {
      const ids = [...q.keys()].slice(0, game.max);
      const opts = room.queueOptions.get(gameType);
      ids.forEach(pid => q.delete(pid));
      startMatch(room, gameType, humansFrom(room, ids), opts);
    }
    if (!q.size) room.queueOptions.delete(gameType);
  }

  function leaveMatch(room, playerId, matchId) {
    const pl = room.players.get(playerId);
    const m = room.matches.get(matchId);
    if (pl && pl.currentMatchId === matchId) { pl.currentMatchId = null; pl.currentGame = null; }
    if (!m) return;
    const stillIn = m.engine.players.filter(p => !p.isBot && room.players.get(p.id)?.currentMatchId === matchId);
    if (!stillIn.length) {
      m.engine.dispose();
      room.matches.delete(matchId);
      return;
    }
    // Others are still playing: tell the engine this seat is gone so it can carry on or end the match.
    m.engine.playerLeft?.(playerId);
    syncMatch(room, matchId);
  }

  function removePlayer(room, playerId) {
    const p = room.players.get(playerId);
    if (!p) return;
    dequeue(room, playerId);
    if (p.currentMatchId) leaveMatch(room, playerId, p.currentMatchId);
    room.sockets.delete(playerId);
    room.players.delete(playerId);
    room.tokens.delete(playerId);
    feed(room, `${p.name} went home.`, { kind: 'leave' });
    if (room.hostId === playerId && room.players.size) {
      room.hostId = room.players.keys().next().value;
      feed(room, `${room.players.get(room.hostId).name} is the new class monitor (host).`, { kind: 'info' });
    }
    if (!room.players.size) closeRoom(room);
    else broadcastRoom(room);
  }

  function closeRoom(room) {
    for (const m of room.matches.values()) m.engine.dispose();
    room.matches.clear();
    rooms.delete(room.code);
  }

  // Housekeeping: stale queue entries and rooms nobody is connected to.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      let changed = false;
      for (const q of room.queues.values()) {
        for (const [pid, since] of q) {
          if (now - since > QUEUE_TIMEOUT_MS) { q.delete(pid); changed = true; }
        }
      }
      if (room.sockets.size === 0) {
        room.emptySince ??= now;
        if (now - room.emptySince > EMPTY_ROOM_MS) { closeRoom(room); continue; }
      } else room.emptySince = null;
      if (changed) broadcastRoom(room);
    }
  }, 30_000);
  sweeper.unref?.();

  function newRoom(host) {
    const code = generateCode();
    if (!code || rooms.size >= MAX_ROOMS) return null;
    const room = {
      code,
      hostId: host.id,
      players: new Map([[host.id, host]]),
      tokens: new Map(),
      sockets: new Map(),
      queues: new Map(Object.keys(GAMES).map(g => [g, new Map()])), // gameType -> Map(playerId -> queuedAt)
      queueOptions: new Map(),
      matches: new Map(),
      feed: [],
      emptySince: null
    };
    feed(room, `Room ${code} is open. Share the code and pick a game!`, { kind: 'info' });
    rooms.set(code, room);
    return room;
  }

  function newPlayer(msg) {
    return {
      id: id('p_'),
      name: cleanName(msg.name, 'Desk Buddy'),
      avatar: cleanAvatar(msg.avatar),
      mood: MOODS[0],
      currentMatchId: null,
      currentGame: null
    };
  }

  // ─── connections ───────────────────────────────────────────────────────

  wss.on('connection', (ws) => {
    let roomCode = null;
    let playerId = null;
    let windowStart = Date.now();
    let windowCount = 0;

    function bind(room, pid) {
      const old = room.sockets.get(pid);
      if (old && old !== ws) { send(old, { t: 'kicked', reason: 'This player opened RECESS in another tab.' }); old.close(); }
      room.sockets.set(pid, ws);
      roomCode = room.code;
      playerId = pid;
    }

    ws.on('message', (raw) => {
      const now = Date.now();
      if (now - windowStart > RATE_WINDOW_MS) { windowStart = now; windowCount = 0; }
      if (++windowCount > RATE_MAX) return; // flood: silently drop

      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
      const { t, rid } = msg;
      const reply = (res) => send(ws, { t: 'reply', rid, res });

      if (t === 'ping') return reply({ ok: true, serverTime: now });

      if (t === 'create') {
        if (roomCode) return reply({ ok: false, error: 'Already in a room' });
        const host = newPlayer(msg);
        const room = newRoom(host);
        if (!room) return reply({ ok: false, error: 'The playground is full right now. Try again in a minute.' });
        const token = randomBytes(12).toString('hex');
        room.tokens.set(host.id, token);
        bind(room, host.id);
        reply({ ok: true, code: room.code, playerId: host.id, token });
        broadcastRoom(room);
        return;
      }

      if (t === 'join') {
        if (roomCode) return reply({ ok: false, error: 'Already in a room' });
        const code = String(msg.code || '').toUpperCase().trim();
        if (!ROOM_CODE.test(code)) return reply({ ok: false, error: 'Room codes are 4 letters, like KPQR.' });
        const room = rooms.get(code);
        if (!room) return reply({ ok: false, error: 'No room with that code. Check it with whoever made the room.' });
        if (room.players.size >= MAX_PLAYERS) return reply({ ok: false, error: `That room is full (${MAX_PLAYERS} players).` });
        const p = newPlayer(msg);
        p.name = uniqueName(room, p.name);
        room.players.set(p.id, p);
        const token = randomBytes(12).toString('hex');
        room.tokens.set(p.id, token);
        bind(room, p.id);
        feed(room, `${p.name} joined the desk.`, { kind: 'join' });
        reply({ ok: true, code, playerId: p.id, token, name: p.name });
        broadcastRoom(room);
        return;
      }

      if (t === 'resume') {
        const code = String(msg.code || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) return reply({ ok: false, error: 'That room has closed. Rooms live in memory, so a server restart or a long break ends them.', gone: true });
        const expected = room.tokens.get(msg.playerId);
        if (!expected || expected !== msg.token) return reply({ ok: false, error: 'You are no longer in that room.', gone: true });
        bind(room, msg.playerId);
        const p = room.players.get(playerId);
        reply({ ok: true, code, playerId, name: p.name, currentMatchId: p.currentMatchId || null });
        broadcastRoom(room);
        if (p.currentMatchId) syncMatch(room, p.currentMatchId);
        return;
      }

      const room = rooms.get(roomCode);
      if (!room || !playerId || !room.players.has(playerId)) return reply({ ok: false, error: 'Not in a room' });
      const me = room.players.get(playerId);

      switch (t) {
        case 'queue': {
          const game = GAMES[msg.gameType];
          if (!game) return reply({ ok: false, error: 'Unknown game' });
          if (me.currentMatchId) return reply({ ok: false, error: 'Finish or leave your current game first' });
          dequeue(room, playerId);
          const options = (msg.options && typeof msg.options === 'object') ? msg.options : {};
          if (game.solo) {
            const matchId = startMatch(room, game.id, humansFrom(room, [playerId]), options);
            return reply({ ok: !!matchId, matchId });
          }
          if (msg.withBots) {
            if (!game.bots) return reply({ ok: false, error: `${game.name} needs real classmates` });
            const seats = Math.max(game.min, Math.min(game.max, Number(msg.seats) || game.min));
            const matchId = startMatch(room, game.id, withBots(humansFrom(room, [playerId]), seats), options);
            return reply({ ok: !!matchId, matchId });
          }
          const q = room.queues.get(game.id);
          if (!q.size) room.queueOptions.set(game.id, options);
          q.set(playerId, Date.now());
          if (q.size === 1) feed(room, `${me.name} is waiting for ${game.name}. Join them!`, { kind: 'queue', game: game.id });
          reply({ ok: true, queued: true });
          checkQueue(room, game.id);
          broadcastRoom(room);
          return;
        }

        case 'start-queue': {
          // Manual start: any waiting player may start once the minimum is reached; optionally fill with bots.
          const game = GAMES[msg.gameType];
          if (!game) return reply({ ok: false, error: 'Unknown game' });
          const q = room.queues.get(game.id);
          if (!q.has(playerId)) return reply({ ok: false, error: 'Join the waiting list first' });
          const ids = [...q.keys()].slice(0, game.max);
          let players = humansFrom(room, ids);
          if (players.length < game.min) {
            if (!msg.fillBots || !game.bots) return reply({ ok: false, error: `${game.name} needs at least ${game.min} players` });
            players = withBots(players, game.min);
          }
          if (!game.manual && players.length < game.max && !msg.fillBots) return reply({ ok: false, error: 'This game starts by itself when full' });
          const opts = room.queueOptions.get(game.id);
          ids.forEach(pid => q.delete(pid));
          if (!q.size) room.queueOptions.delete(game.id);
          const matchId = startMatch(room, game.id, players, opts);
          return reply({ ok: !!matchId, matchId });
        }

        case 'leave-queue':
          dequeue(room, playerId);
          reply({ ok: true });
          broadcastRoom(room);
          return;

        case 'challenge': {
          const game = GAMES[msg.gameType];
          const target = room.players.get(msg.targetId);
          if (!game || game.solo || !target || target.id === playerId) return reply({ ok: false, error: 'Cannot challenge that player' });
          if (me.currentMatchId) return reply({ ok: false, error: 'Finish your current game first' });
          dequeue(room, playerId);
          room.queues.get(game.id).set(playerId, Date.now());
          send(room.sockets.get(target.id), { t: 'challenge', from: { id: me.id, name: me.name, avatar: me.avatar }, gameType: game.id });
          feed(room, `${me.name} challenged ${target.name} to ${game.name}!`, { kind: 'challenge', game: game.id });
          reply({ ok: true });
          checkQueue(room, game.id);
          broadcastRoom(room);
          return;
        }

        case 'accept-challenge': {
          const game = GAMES[msg.gameType];
          if (!game) return reply({ ok: false, error: 'Unknown game' });
          if (me.currentMatchId) return reply({ ok: false, error: 'Finish your current game first' });
          const q = room.queues.get(game.id);
          if (!q.has(msg.fromId)) return reply({ ok: false, error: 'That challenge has expired' });
          dequeue(room, playerId);
          if (game.max === 2) {
            q.delete(msg.fromId);
            const matchId = startMatch(room, game.id, humansFrom(room, [msg.fromId, playerId]), room.queueOptions.get(game.id));
            if (!q.size) room.queueOptions.delete(game.id);
            return reply({ ok: !!matchId, matchId });
          }
          q.set(playerId, Date.now());
          reply({ ok: true, queued: true });
          checkQueue(room, game.id);
          broadcastRoom(room);
          return;
        }

        case 'game-action': {
          const m = room.matches.get(msg.matchId);
          if (!m) return reply({ ok: false, error: 'That game has ended' });
          if (me.currentMatchId !== m.matchId || !m.engine.players.some(p => p.id === playerId)) {
            return reply({ ok: false, error: 'You are not playing in that game' });
          }
          if (m.engine.abandoned) return reply({ ok: false, error: 'This game was abandoned' });
          const action = msg.action;
          if (!action || typeof action !== 'object' || typeof action.type !== 'string') return reply({ ok: false, error: 'Bad action' });
          let res;
          try {
            res = m.engine.handleAction(playerId, action) || { ok: false, error: 'No response' };
          } catch (e) {
            log(`RECESS ${m.gameType} action error:`, e);
            res = { ok: false, error: 'That move confused the referee' };
          }
          reply(res);
          syncMatch(room, m.matchId);
          return;
        }

        case 'leave-match': {
          const mid = msg.matchId || me.currentMatchId;
          leaveMatch(room, playerId, mid);
          reply({ ok: true });
          broadcastRoom(room);
          return;
        }

        case 'react': {
          if (!REACTIONS.includes(msg.kind)) return reply({ ok: false, error: 'Unknown reaction' });
          toRoom(room, { t: 'reaction', playerId, kind: msg.kind, matchId: me.currentMatchId || null });
          return reply({ ok: true });
        }

        case 'profile': {
          if (msg.name !== undefined) me.name = uniqueName(room, cleanName(msg.name, me.name), me.id);
          if (msg.avatar !== undefined) me.avatar = cleanAvatar(msg.avatar);
          if (MOODS.includes(msg.mood)) me.mood = msg.mood;
          reply({ ok: true, name: me.name });
          broadcastRoom(room);
          return;
        }

        case 'chat': {
          const text = cleanName(String(msg.text || '').slice(0, 120), '').slice(0, 120);
          if (text) { feed(room, text, { kind: 'chat', from: me.name, avatar: me.avatar }); broadcastRoom(room); }
          return reply({ ok: true });
        }

        case 'leave':
          removePlayer(room, playerId);
          roomCode = null;
          playerId = null;
          return reply({ ok: true });

        default:
          return reply({ ok: false, error: 'Unknown command' });
      }
    });

    ws.on('close', () => {
      const room = rooms.get(roomCode);
      if (!room || !playerId) return;
      const pid = playerId;
      if (room.sockets.get(pid) !== ws) return; // replaced by a newer tab
      room.sockets.delete(pid);
      broadcastRoom(room); // shows them offline
      setTimeout(() => {
        if (rooms.get(room.code) === room && !room.sockets.has(pid)) removePlayer(room, pid);
      }, RECONNECT_GRACE_MS).unref?.();
    });

    ws.on('error', () => ws.close());
  });

  return {
    paths: [path],
    rooms,
    close: () => {
      clearInterval(sweeper);
      for (const room of rooms.values()) closeRoom(room);
      wss.close();
    }
  };
}
