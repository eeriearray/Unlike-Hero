// Trillioner game server: authoritative Battle Spend rooms, plus the Daily City board.
//
// Loaded by server/relay.mjs because games/trillioner/game.json names it in "server". Speaks plain JSON over a
// WebSocket at /games/trillioner/ws. The engine (../engine/engine.js) runs here and decides every purchase;
// each socket only receives game.viewFor(itsOwnPlayer). This folder is never served over HTTP.
//
// Client -> server  { t: 'create'|'join'|'resume'|'leave'|'start'|'addBot'|'removeBot'|'cmd'|'pos'|'daily', rid, ... }
// Server -> client  { t: 'reply', rid, res }  { t: 'lobby', room }  { t: 'start', seed }  { t: 'state', view, events }  { t: 'closed', reason }
import { WebSocketServer } from 'ws';
import { createRequire } from 'node:module';
import { randomBytes, randomInt } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { Game } = require('../engine/engine.js');
const Bot = require('../engine/bot.js');

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const MAX_SEATS = 8, MIN_SEATS = 2, MAX_ROOMS = 200;
const TICK_MS = 100, PUSH_EVERY = 2;             // engine at 10 Hz, views at 5 Hz
const GRACE_MS = 15_000;                         // lobby seats survive a refresh
const IDLE_ROOM_MS = 10 * 60_000;
const RATE = { burst: 80, perSecond: 40 };
const PING_MS = 20_000;
const BOT_NAMES = ['Mrs. Moneybags', 'Sir Buysalot', 'Baron Von Bargain', 'Duchess Debit', 'The Twins', 'Lord Ledger', 'Countess Coupon'];
const DATA_DIR = process.env.TRILLIONER_DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), '.data');
const DAILY_FILE = join(DATA_DIR, 'daily.json');

export default function attach({ httpServer, basePath, log = console.log, tickMs = TICK_MS }) {
  const path = `${basePath}ws`;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const rooms = new Map();
  let daily = {};
  try { daily = JSON.parse(readFileSync(DAILY_FILE, 'utf8')); } catch { /* first run */ }

  httpServer.on('upgrade', (req, socket, head) => {
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { return; }
    if (url.pathname !== path) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
  const cleanName = (n, d = 'Player') => String(typeof n === 'string' ? n : d).replace(/[<>&"']/g, '').trim().slice(0, 18) || d;
  function newCode() {
    for (let i = 0; i < 60; i++) {
      let c = '';
      for (let k = 0; k < 4; k++) c += CODE_CHARS[randomInt(CODE_CHARS.length)];
      if (!rooms.has(c)) return c;
    }
    return null;
  }

  function lobbyInfo(room) {
    return { code: room.code, host: room.host, phase: room.phase, seats: room.seats.map((s) => ({ id: s.id, name: s.name, bot: s.bot, connected: !!s.ws || s.bot })) };
  }
  function pushLobby(room) { for (const s of room.seats) send(s.ws, { t: 'lobby', room: lobbyInfo(room) }); }
  function newSeat(room, name, bot) {
    const seat = { id: 'p' + randomBytes(6).toString('hex'), name: cleanName(name), bot: !!bot, ws: null, token: bot ? null : randomBytes(18).toString('base64url'), grace: null, autopilot: false };
    room.seats.push(seat);
    return seat;
  }
  function bind(ws, room, seat) {
    if (seat.ws && seat.ws !== ws) { send(seat.ws, { t: 'closed', reason: 'replaced' }); seat.ws.seat = null; }
    clearTimeout(seat.grace); seat.grace = null;
    seat.ws = ws; seat.autopilot = false;
    ws.seat = { code: room.code, id: seat.id };
    if (room.game) { const p = room.game.players[seat.id]; if (p) { p.connected = true; p.bot = false; } }
    clearTimeout(room.idle); room.idle = null;
  }
  function closeRoom(room, reason) {
    clearInterval(room.timer);
    clearTimeout(room.idle);
    for (const s of room.seats) { clearTimeout(s.grace); send(s.ws, { t: 'closed', reason }); if (s.ws) s.ws.seat = null; }
    rooms.delete(room.code);
    log(`[trillioner] room ${room.code} closed (${reason}); ${rooms.size} open`);
  }
  function checkIdle(room) {
    if (room.seats.some((s) => s.ws)) return;
    if (room.phase === 'lobby') { closeRoom(room, 'empty'); return; }
    clearTimeout(room.idle);
    room.idle = setTimeout(() => closeRoom(room, 'idle'), IDLE_ROOM_MS);
    room.idle.unref?.();
  }
  function unbind(ws, leaving) {
    const { code, id } = ws.seat || {};
    const room = code && rooms.get(code);
    ws.seat = null;
    if (!room) return;
    const seat = room.seats.find((s) => s.id === id);
    if (!seat || seat.ws !== ws) return;
    seat.ws = null;
    if (room.phase === 'lobby') {
      const drop = () => {
        room.seats = room.seats.filter((s) => s !== seat);
        if (room.host === seat.id) { const h = room.seats.find((s) => !s.bot); if (h) room.host = h.id; }
        pushLobby(room);
        checkIdle(room);
      };
      if (leaving) drop();
      else { seat.grace = setTimeout(drop, GRACE_MS); seat.grace.unref?.(); pushLobby(room); }
    } else {
      // a bot plays the dropped seat until the player returns
      seat.autopilot = true;
      const p = room.game.players[seat.id];
      if (p) { p.connected = false; p.botState = null; if (leaving) seat.token = null; }
      room.game.feedPush(seat.name + (leaving ? ' left. A bot takes over.' : ' dropped. A bot is covering.'));
    }
    checkIdle(room);
  }

  function startMatch(room) {
    const seed = randomInt(2 ** 31);
    room.seed = seed;
    room.game = new Game({ seed, mode: 'battle', requireNear: true, players: room.seats.map((s) => ({ id: s.id, name: s.name, bot: s.bot })) });
    room.phase = 'playing';
    room.tickNo = 0;
    for (const s of room.seats) send(s.ws, { t: 'start', seed, you: s.id, stock: room.game.stock });
    room.timer = setInterval(() => tickRoom(room), tickMs);
    room.timer.unref?.();
    log(`[trillioner] room ${room.code} started with ${room.seats.length} seats`);
  }
  function tickRoom(room) {
    const g = room.game;
    if (!g.over) {
      g.tick(TICK_MS / 1000);
      for (const s of room.seats) if ((s.bot || s.autopilot) && !g.over) Bot.battleStep(g, g.players[s.id], TICK_MS / 1000);
    }
    room.tickNo++;
    if (room.tickNo % PUSH_EVERY === 0 || g.over) {
      for (const s of room.seats) {
        const ev = g.drain(s.id);
        if (s.ws) send(s.ws, { t: 'state', view: g.viewFor(s.id), events: ev });
      }
    }
    if (g.over && !room.ended) {
      room.ended = true;
      log(`[trillioner] room ${room.code} finished: ${g.result}, winner ${g.winner && g.players[g.winner].name}`);
      clearInterval(room.timer);
      const closer = setTimeout(() => closeRoom(room, 'finished'), IDLE_ROOM_MS);
      closer.unref?.();
    }
  }

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
      if (!allow()) { if (msg.t !== 'pos') reply({ error: 'Slow down.' }); return; }
      const here = () => { const { code, id } = ws.seat || {}; const room = code && rooms.get(code); return room ? { room, seat: room.seats.find((s) => s.id === id) } : {}; };

      switch (msg.t) {
        case 'create': {
          unbind(ws, true);
          if (rooms.size >= MAX_ROOMS) return reply({ error: 'The server is full. Try again later.' });
          const code = newCode();
          if (!code) return reply({ error: 'The server is full. Try again later.' });
          const room = { code, seats: [], host: null, phase: 'lobby', game: null, timer: null, idle: null, seed: null, ended: false };
          rooms.set(code, room);
          const seat = newSeat(room, msg.name);
          room.host = seat.id;
          bind(ws, room, seat);
          reply({ ok: true, code, playerId: seat.id, token: seat.token });
          return pushLobby(room);
        }
        case 'join': {
          const room = rooms.get(String(msg.code || '').trim().toUpperCase());
          if (!room) return reply({ error: 'No room with that code.' });
          if (room.phase !== 'lobby') return reply({ error: 'That match has already started.' });
          if (room.seats.length >= MAX_SEATS) return reply({ error: 'That room is full.' });
          unbind(ws, true);
          const seat = newSeat(room, msg.name);
          bind(ws, room, seat);
          reply({ ok: true, code: room.code, playerId: seat.id, token: seat.token });
          return pushLobby(room);
        }
        case 'resume': {
          const room = rooms.get(String(msg.code || '').toUpperCase());
          const seat = room && room.seats.find((s) => s.id === String(msg.playerId || ''));
          if (!seat || !seat.token || seat.token !== String(msg.token || '')) return reply({ error: 'That seat is gone.' });
          bind(ws, room, seat);
          reply({ ok: true, code: room.code, playerId: seat.id, token: seat.token, phase: room.phase, seed: room.seed, stock: room.game ? room.game.stock : null });
          if (room.phase === 'lobby') pushLobby(room);
          return;
        }
        case 'leave':
          unbind(ws, true);
          return reply({ ok: true });
        case 'addBot': {
          const { room, seat } = here();
          if (!room || room.host !== seat?.id || room.phase !== 'lobby') return reply({ error: 'Only the host can add bots.' });
          if (room.seats.length >= MAX_SEATS) return reply({ error: 'The room is full.' });
          newSeat(room, BOT_NAMES[room.seats.length % BOT_NAMES.length], true);
          reply({ ok: true });
          return pushLobby(room);
        }
        case 'removeBot': {
          const { room, seat } = here();
          if (!room || room.host !== seat?.id || room.phase !== 'lobby') return reply({ error: 'Only the host can do that.' });
          const i = room.seats.map((s) => s.bot).lastIndexOf(true);
          if (i >= 0) room.seats.splice(i, 1);
          reply({ ok: true });
          return pushLobby(room);
        }
        case 'start': {
          const { room, seat } = here();
          if (!room || room.host !== seat?.id) return reply({ error: 'Only the host can start.' });
          if (room.phase !== 'lobby') return reply({ error: 'Already started.' });
          if (room.seats.length < MIN_SEATS) return reply({ error: 'You need at least 2 seats. Add a bot?' });
          startMatch(room);
          return reply({ ok: true });
        }
        case 'pos': { // ten times a second, no reply
          const { room, seat } = here();
          if (!room || !room.game || !seat) return;
          room.game.setPos(seat.id, Number(msg.x), Number(msg.y), Number(msg.z), Number(msg.h) || 0, msg.inv ? String(msg.inv) : null, msg.d ? String(msg.d) : null);
          return;
        }
        case 'cmd': {
          const { room, seat } = here();
          if (!room || !room.game || !seat) return reply({ error: 'You are not in a match.' });
          let res;
          try { res = room.game.command(seat.id, msg.cmd); } catch (e) { log('[trillioner] command failed', e); res = { error: 'Server error.' }; }
          return reply(res);
        }
        case 'daily': { // Daily City board, kept for a week
          const day = String(msg.day || '').slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return reply({ error: 'Bad day.' });
          const e = msg.entry || {};
          const spent = Number(e.spent);
          if (Number.isSafeInteger(spent) && spent >= 0 && spent < 1e15) {
            const list = daily[day] = daily[day] || [];
            list.push({ name: cleanName(e.name), spent, win: Number.isFinite(e.win) && e.win > 0 ? Math.floor(e.win) : null });
            list.sort((a, b) => b.spent - a.spent);
            if (list.length > 200) list.length = 200;
            for (const k of Object.keys(daily).sort().slice(0, -7)) delete daily[k];
            try { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(DAILY_FILE, JSON.stringify(daily)); } catch (err) { log('[trillioner] could not save the daily board', err.message); }
          }
          return reply({ ok: true, list: daily[day] || [] });
        }
        default:
          return reply({ error: 'Unknown message.' });
      }
    });
    ws.on('close', () => unbind(ws, false));
    ws.on('error', () => ws.terminate());
  });

  const pinger = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      try { ws.ping(); } catch { /* closing */ }
    }
  }, PING_MS);
  pinger.unref?.();

  log(`[trillioner] game server on ${path}`);
  return { paths: [path], rooms, close: () => { clearInterval(pinger); for (const r of [...rooms.values()]) closeRoom(r, 'shutdown'); wss.close(); } };
}
