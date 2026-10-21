// Dragon Clash game server — authoritative online matches and tournaments.
//
// Loaded by server/relay.mjs because games/dragon-clash/game.json names it in "server".
// WebSocket at /games/dragon-clash/ws. The server runs the same engine files the browser does
// (engine/dc-sim.js), at 60 ticks per second, with each client's inputs. Clients only send buttons;
// builds are validated here, results come only from these simulations, and tournament brackets
// advance only from them. Snapshots go out 30 times a second.
import { WebSocketServer } from 'ws';
import { createRequire } from 'node:module';
import { randomBytes, randomInt } from 'node:crypto';

const require = createRequire(import.meta.url);
const D = require('../engine/dc-data.js');
const Build = require('../engine/dc-build.js');
const Sim = require('../engine/dc-sim.js');
const Bot = require('../engine/dc-ai.js');
const Cup = require('../engine/dc-tournament.js');

const TICK_MS = 1000 / 60;
const SNAP_EVERY = 2;              // ticks between snapshots (30 Hz)
const COUNTDOWN = 150;             // ticks
const GRACE_MS = 20_000;           // a dropped player can reconnect for this long
const IDLE_ROOM_MS = 10 * 60_000;
const MAX_ROOMS = 300;
const MAX_MEMBERS = 8;
const MAX_MSG = 8 * 1024;
const RATE = { burst: 40, perSecond: 90 }; // inputs are frequent; everything else is cheap
const MATCH_TIME = 60 * 60 * 6;    // 6 minute safety limit on every online match

export default function attach({ httpServer, basePath, log = console.log, tickMs = TICK_MS, graceMs = GRACE_MS }) {
  const path = `${basePath}ws`;
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG });
  httpServer.on('upgrade', (req, socket, head) => {
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { return; }
    if (url.pathname !== path) return;
    wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws));
  });

  const rooms = new Map();
  let nextMatch = 1;

  // ─────────────────────────── connections ───────────────────────────
  function onConnection(ws) {
    const conn = { ws, member: null, room: null, tokens: RATE.burst, last: Date.now() };
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      const now = Date.now();
      conn.tokens = Math.min(RATE.burst, conn.tokens + (now - conn.last) / 1000 * RATE.perSecond);
      conn.last = now;
      if (conn.tokens < 1) return;
      conn.tokens--;
      let m;
      try { m = JSON.parse(data.toString()); } catch { return; }
      if (!m || typeof m.t !== 'string') return;
      try { handle(conn, m); } catch (e) { send(ws, { t: 'error', msg: 'Server error: ' + e.message }); log('[dragon-clash]', e); }
    });
    ws.on('close', () => onClose(conn));
    ws.on('error', () => {});
    send(ws, { t: 'hello', v: 1 });
  }

  function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
  function err(conn, msg) { send(conn.ws, { t: 'error', msg }); }
  function cleanName(n) { return String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Dragon'; }

  function handle(conn, m) {
    const room = conn.room, me = conn.member;
    switch (m.t) {
      case 'create': {
        if (rooms.size >= MAX_ROOMS) return err(conn, 'The server is full. Try again soon.');
        const r = createRoom(m.mode === 'cup' ? 'cup' : 'versus');
        join(conn, r, m);
        return;
      }
      case 'join': {
        const r = rooms.get(String(m.code || '').toUpperCase());
        if (!r) return err(conn, 'No room with that code.');
        // Reconnect with a token
        if (m.token) {
          for (const mem of r.members.values()) if (mem.token === m.token) return rebind(conn, r, mem);
        }
        if (r.state !== 'lobby') return err(conn, 'That room has already started.');
        if ([...r.members.values()].length >= MAX_MEMBERS) return err(conn, 'That room is full.');
        join(conn, r, m);
        return;
      }
    }
    if (!room || !me) return err(conn, 'Join a room first.');
    const host = room.host === me.id;
    switch (m.t) {
      case 'leave': leave(conn); return;
      case 'name': me.name = cleanName(m.name); push(room); return;
      case 'build': {
        if (me.ready && room.state === 'lobby') return err(conn, 'Unready to change your dragon.');
        if (room.state !== 'lobby') return err(conn, 'Dragons are locked in once the room starts.');
        const v = Build.validateBuild(m.build);
        if (!v.ok) return err(conn, 'Build rejected: ' + v.errors.join(' '));
        me.build = Build.sanitize(m.build);
        push(room);
        return;
      }
      case 'ready':
        if (room.state !== 'lobby') return;
        if (m.ready && !me.build) return err(conn, 'Pick a dragon first.');
        me.ready = !!m.ready; push(room); return;
      case 'team': {
        const f = D.FORMATS[room.settings.format];
        const t = m.team | 0;
        if (room.mode !== 'versus' || t < 0 || t >= f.teams) return;
        me.team = t; push(room); return;
      }
      case 'settings': {
        if (!host || room.state !== 'lobby') return;
        const s = room.settings;
        if (m.format && D.FORMATS[m.format]) s.format = m.format;
        if (m.arena && D.ARENAS[m.arena] && m.arena !== 'training') s.arena = m.arena;
        if (m.stocks) s.stocks = Math.max(1, Math.min(5, m.stocks | 0));
        if (m.time != null) s.time = [0, 3, 5, 8].includes(m.time | 0) ? m.time | 0 : 0;
        const teams = D.FORMATS[s.format].teams;
        for (const mem of room.members.values()) if (mem.team >= teams) mem.team = 0;
        push(room);
        return;
      }
      case 'bot': {
        if (!host || room.state !== 'lobby') return;
        if (m.op === 'add') {
          if (room.members.size >= MAX_MEMBERS) return err(conn, 'Room is full.');
          const preset = D.PRESETS[randomInt(D.PRESETS.length)];
          const id = 'b' + randomBytes(4).toString('hex');
          const b = Build.presetBuild(preset.id);
          room.members.set(id, { id, name: 'CPU ' + preset.name, bot: true, level: Math.max(1, Math.min(3, m.level | 0 || 2)), build: Build.sanitize(b), ready: true, team: smallestTeam(room), connected: true, token: null });
        } else if (m.op === 'remove') {
          const b = room.members.get(m.id);
          if (b && b.bot) room.members.delete(m.id);
        }
        push(room);
        return;
      }
      case 'start': {
        if (!host) return err(conn, 'Only the host can start.');
        if (room.state !== 'lobby') return;
        const humans = [...room.members.values()].filter((x) => !x.bot);
        if (humans.some((x) => !x.build || !x.ready)) return err(conn, 'Everyone needs a dragon and to be ready.');
        if (room.mode === 'versus') startVersus(room, conn);
        else startCup(room, conn);
        return;
      }
      case 'input': {
        const mt = me.match && room.matches.get(me.match);
        if (!mt) return;
        const slot = mt.slots.indexOf(me.id);
        if (slot < 0) return;
        const inp = mt.inputs[slot];
        inp.held = (m.h | 0) & 511;
        if (m.c && typeof m.c === 'object') {
          for (const k of Object.keys(Sim.BTN)) {
            const c = m.c[k] | 0;
            if (inp.counters[k] !== undefined && ((c - inp.counters[k]) & 255) > 0 && ((c - inp.counters[k]) & 255) < 16) inp.pending |= Sim.BTN[k];
            inp.counters[k] = c;
          }
        }
        return;
      }
      case 'spectate': {
        for (const mt of room.matches.values()) mt.spectators.delete(me.id);
        const mt = room.matches.get(m.match);
        if (!mt || mt.slots.includes(me.id)) return;
        mt.spectators.add(me.id);
        send(conn.ws, { t: 'match', match: matchInfo(mt), you: -1, spectator: true });
        return;
      }
      case 'unspectate': for (const mt of room.matches.values()) mt.spectators.delete(me.id); return;
      case 'forfeit': {
        const mt = me.match && room.matches.get(me.match);
        if (mt) { const i = mt.slots.indexOf(me.id); if (i >= 0) mt.sim.forfeit(i); }
        return;
      }
      case 'rematch': {
        if (!host || room.mode !== 'versus' || room.state !== 'results') return;
        room.state = 'lobby';
        for (const mem of room.members.values()) if (!mem.bot) mem.ready = false;
        push(room);
        return;
      }
      case 'newcup': {
        if (!host || room.mode !== 'cup' || room.state !== 'done') return;
        room.state = 'lobby'; room.cup = null;
        for (const mem of room.members.values()) if (!mem.bot) mem.ready = false;
        push(room);
        return;
      }
    }
  }

  // ─────────────────────────── rooms ───────────────────────────
  function newCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    for (let i = 0; i < 50; i++) {
      let c = '';
      for (let k = 0; k < 4; k++) c += A[randomInt(A.length)];
      if (!rooms.has(c)) return c;
    }
    return null;
  }

  function createRoom(mode) {
    const code = newCode();
    const r = { code, mode, host: null, members: new Map(), settings: { format: '1v1', arena: 'skyforge', stocks: mode === 'cup' ? 2 : 3, time: 0 },
      state: 'lobby', matches: new Map(), cup: null, lastResult: null, idle: null };
    rooms.set(code, r);
    return r;
  }

  function smallestTeam(room) {
    const f = D.FORMATS[room.settings.format];
    const counts = new Array(f.teams).fill(0);
    for (const m of room.members.values()) counts[m.team % f.teams]++;
    return counts.indexOf(Math.min(...counts));
  }

  function join(conn, room, m) {
    const id = 'm' + randomBytes(5).toString('hex');
    const mem = { id, name: cleanName(m.name), bot: false, build: null, ready: false, team: smallestTeam(room), connected: true, token: randomBytes(16).toString('base64url'), conn, match: null, grace: null };
    if (m.build) { const v = Build.validateBuild(m.build); if (v.ok) mem.build = Build.sanitize(m.build); }
    room.members.set(id, mem);
    if (!room.host) room.host = id;
    conn.room = room; conn.member = mem;
    clearTimeout(room.idle);
    send(conn.ws, { t: 'joined', code: room.code, you: id, token: mem.token });
    push(room);
  }

  function rebind(conn, room, mem) {
    if (mem.conn && mem.conn !== conn) { send(mem.conn.ws, { t: 'closed', reason: 'replaced' }); mem.conn.room = null; mem.conn.member = null; }
    clearTimeout(mem.grace); mem.grace = null;
    mem.conn = conn; mem.connected = true;
    conn.room = room; conn.member = mem;
    clearTimeout(room.idle);
    send(conn.ws, { t: 'joined', code: room.code, you: mem.id, token: mem.token, rejoined: true });
    push(room);
    const mt = mem.match && room.matches.get(mem.match);
    if (mt) send(conn.ws, { t: 'match', match: matchInfo(mt), you: mt.slots.indexOf(mem.id) });
  }

  function leave(conn) {
    const room = conn.room, mem = conn.member;
    if (!room || !mem) return;
    conn.room = null; conn.member = null;
    dropMember(room, mem, true);
  }

  function onClose(conn) {
    const room = conn.room, mem = conn.member;
    if (!room || !mem || mem.conn !== conn) return;
    mem.connected = false; mem.conn = null;
    // In a lobby, a short grace for refreshes; in a match, the dragon idles until the grace runs out, then forfeits.
    mem.grace = setTimeout(() => dropMember(room, mem, false), graceMs);
    mem.grace.unref?.();
    push(room);
  }

  // Leaving (or not coming back within the grace period): gone from a lobby; otherwise their dragon forfeits.
  function dropMember(room, mem, voluntary) {
    clearTimeout(mem.grace); mem.grace = null;
    if (voluntary) { mem.connected = false; mem.conn = null; }
    for (const m of room.matches.values()) m.spectators.delete(mem.id);
    if (room.state === 'lobby') room.members.delete(mem.id);
    else {
      mem.left = true;
      const mt = mem.match && room.matches.get(mem.match);
      if (mt) { const i = mt.slots.indexOf(mem.id); if (i >= 0) mt.sim.forfeit(i); }
      if (room.cup && room.cup.status !== 'done') {
        const wm = Cup.matchFor(room.cup, mem.id);
        if (wm && wm.status === 'ready') { Cup.reportResult(room.cup, wm.id, wm.a === mem.id ? wm.b : wm.a, { reason: 'forfeit' }); scheduleCup(room); }
      }
    }
    if (room.host === mem.id) {
      const next = [...room.members.values()].find((x) => !x.bot && x.connected && !x.left);
      room.host = next ? next.id : null;
    }
    const humans = [...room.members.values()].filter((x) => !x.bot && x.connected && !x.left);
    if (!humans.length) {
      clearTimeout(room.idle);
      room.idle = setTimeout(() => closeRoom(room), voluntary ? 0 : IDLE_ROOM_MS);
      room.idle.unref?.();
    }
    push(room);
  }

  function closeRoom(room) {
    for (const mt of room.matches.values()) clearInterval(mt.timer);
    for (const m of room.members.values()) if (m.conn) send(m.conn.ws, { t: 'closed', reason: 'empty' });
    rooms.delete(room.code);
  }

  function view(room) {
    return {
      code: room.code, mode: room.mode, host: room.host, settings: room.settings, state: room.state,
      members: [...room.members.values()].filter((m) => !m.left).map((m) => ({ id: m.id, name: m.name, bot: m.bot, level: m.level, team: m.team, ready: m.ready, connected: m.connected, build: m.build })),
      cup: room.cup,
      live: [...room.matches.values()].filter((mt) => !mt.sim.result).map((mt) => ({ id: mt.id, cupMatch: mt.cupMatch, names: mt.slots.map((s) => (room.members.get(s) || {}).name) })),
      lastResult: room.lastResult,
    };
  }

  function push(room) {
    const v = view(room);
    for (const m of room.members.values()) if (m.conn) send(m.conn.ws, { t: 'room', room: v, you: m.id });
  }

  // ─────────────────────────── matches ───────────────────────────
  function startVersus(room, conn) {
    const f = D.FORMATS[room.settings.format];
    const teams = Array.from({ length: f.teams }, () => []);
    for (const m of room.members.values()) teams[m.team % f.teams].push(m);
    if (teams.some((t) => t.length > f.perTeam)) return err(conn, 'Too many dragons on one team for ' + f.name + '.');
    // Fill empty seats with CPUs
    teams.forEach((t, ti) => {
      while (t.length < f.perTeam) {
        const preset = D.PRESETS[randomInt(D.PRESETS.length)];
        const id = 'b' + randomBytes(4).toString('hex');
        const bot = { id, name: 'CPU ' + preset.name, bot: true, level: 2, build: Build.sanitize(Build.presetBuild(preset.id)), ready: true, team: ti, connected: true };
        room.members.set(id, bot);
        t.push(bot);
      }
    });
    const order = teams.flat();
    room.state = 'playing';
    runMatch(room, order, { onEnd: (mt, result) => {
      room.state = 'results';
      room.lastResult = { result, setup: mt.sim.setup(), labels: mt.slots.map((s) => (room.members.get(s) || {}).name) };
      for (const m of room.members.values()) if (m.conn) send(m.conn.ws, { t: 'end', m: mt.id, ...room.lastResult, spectator: !mt.slots.includes(m.id) });
      push(room);
    } });
    push(room);
  }

  function runMatch(room, members, opts) {
    const id = 'x' + nextMatch++;
    const sim = new Sim({
      arena: room.settings.arena, stocks: room.settings.stocks, timeLimit: room.settings.time ? room.settings.time * 3600 : MATCH_TIME,
      seed: randomInt(1, 1e9),
      fighters: members.map((m, i) => ({ id: m.id, name: m.name, build: m.build, team: opts.teams ? opts.teams[i] : m.team })),
    });
    const mt = { id, sim, slots: members.map((m) => m.id), inputs: members.map(() => ({ held: 0, pending: 0, counters: {} })),
      bots: new Map(), countdown: COUNTDOWN, spectators: new Set(), events: [], tick: 0, cupMatch: opts.cupMatch || null, timer: null, ended: false };
    members.forEach((m, i) => { if (m.bot) mt.bots.set(i, new Bot(sim, i, { level: m.level || 2, seed: randomInt(1, 1e6) })); else m.match = id; });
    room.matches.set(id, mt);
    for (const m of members) if (m.conn) send(m.conn.ws, { t: 'match', match: matchInfo(mt), you: mt.slots.indexOf(m.id) });

    let last = performance.now(), acc = 0;
    mt.timer = setInterval(() => {
      const now = performance.now();
      acc += Math.min(tickMs < TICK_MS ? 1e9 : 250, now - last); last = now;
      while (acc >= tickMs) { acc -= tickMs; step(room, mt, opts); if (mt.ended) break; }
    }, tickMs < TICK_MS ? 1 : 8);
    return mt;
  }

  function step(room, mt, opts) {
    if (mt.ended) return;
    mt.tick++;
    if (mt.countdown > 0) mt.countdown--;
    else if (!mt.sim.result) {
      const inputs = mt.slots.map((sid, i) => {
        if (mt.bots.has(i)) return mt.bots.get(i).think();
        const mem = room.members.get(sid), inp = mt.inputs[i];
        if (!mem || !mem.connected) return { held: 0, pressed: 0 };
        const out = { held: inp.held, pressed: inp.pending };
        inp.pending = 0;
        return out;
      });
      mt.sim.step(inputs);
      mt.events.push(...mt.sim.drainEvents());
    }
    if (mt.tick % SNAP_EVERY === 0 || mt.sim.result) {
      const snap = mt.sim.snapshot();
      snap.ev = mt.events; snap.cd = mt.countdown;
      mt.events = [];
      const msg = JSON.stringify({ t: 'snap', m: mt.id, s: snap });
      for (const sid of [...mt.slots, ...mt.spectators]) { const mem = room.members.get(sid); if (mem && mem.conn && mem.conn.ws.readyState === 1) mem.conn.ws.send(msg); }
    }
    if (mt.sim.result && !mt.ended) {
      mt.ended = true;
      clearInterval(mt.timer);
      for (const sid of mt.slots) { const mem = room.members.get(sid); if (mem && mem.match === mt.id) mem.match = null; }
      setTimeout(() => { room.matches.delete(mt.id); opts.onEnd(mt, mt.sim.result); for (const m of [...room.members.values()]) if (m.left) room.members.delete(m.id); }, tickMs < TICK_MS ? 5 : 2500);
    }
  }

  function matchInfo(mt) { return { id: mt.id, setup: mt.sim.setup(), cupMatch: mt.cupMatch }; }

  // ─────────────────────────── tournaments ───────────────────────────
  function startCup(room, conn) {
    const entrants = [...room.members.values()].filter((m) => m.build);
    if (entrants.length < 2) return err(conn, 'A cup needs at least 2 dragons (add CPUs).');
    room.cup = Cup.create(entrants.map((m) => ({ id: m.id, name: m.name, bot: !!m.bot, buildSnapshot: m.build })), { id: room.code });
    room.state = 'cup';
    scheduleCup(room);
    push(room);
  }

  function scheduleCup(room) {
    const t = room.cup;
    if (!t) return;
    if (t.status === 'done') { room.state = 'done'; push(room); return; }
    for (const m of Cup.readyMatches(t)) {
      const a = room.members.get(m.a), b = room.members.get(m.b);
      // A player who already left forfeits
      if (!a || a.left) { Cup.reportResult(t, m.id, m.b, { reason: 'forfeit' }); continue; }
      if (!b || b.left) { Cup.reportResult(t, m.id, m.a, { reason: 'forfeit' }); continue; }
      Cup.start(t, m.id);
      runMatch(room, [a, b], { teams: [0, 1], cupMatch: m.id, onEnd: (mt, result) => {
        const winner = result.winnerTeam === 0 ? a.id : result.winnerTeam === 1 ? b.id : null;
        // A draw is replayed by the seed rule: the higher seed advances (documented).
        const w = winner || (Cup.entrant(t, a.id).seed < Cup.entrant(t, b.id).seed ? a.id : b.id);
        Cup.reportResult(t, m.id, w, { reason: result.reason, ticks: result.ticks });
        const res = { result, setup: mt.sim.setup(), labels: [a.name, b.name], cupMatch: m.id };
        for (const mem of [a, b]) if (mem.conn) send(mem.conn.ws, { t: 'end', m: mt.id, ...res });
        for (const sid of mt.spectators) { const mem = room.members.get(sid); if (mem && mem.conn) send(mem.conn.ws, { t: 'end', m: mt.id, spectator: true, ...res }); }
        scheduleCup(room);
        push(room);
      } });
    }
    if (t.status === 'done') room.state = 'done';
    push(room);
  }

  log('Dragon Clash online server at ' + path);
  return { paths: [path], rooms };
}
