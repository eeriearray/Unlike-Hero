// Neon Casino — one private room: players, host controls, settings, the session lifecycle, feed and chat.
// The room owns one Economy shared by every table. All state changes arrive through command(playerId, cmd);
// each player sees only viewFor(playerId). Time and timers are injectable so tests run instantly.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Economy, netWorth } from './economy.mjs';

export const MAX_PLAYERS = 12;
export const HOST_GRACE_MS = 90_000;
export const AVATARS = ['fox', 'tiger', 'panda', 'owl', 'frog', 'octopus', 'unicorn', 'dragon', 'cat', 'wolf', 'koala', 'shark', 'monkey', 'penguin', 'lion', 'robot'];
export const EMOTES = ['clap', 'fire', 'laugh', 'shock', 'cry', 'money', 'pray', 'cool'];

export const GAMES = {
  blackjack: { name: 'Blackjack' },
  roulette: { name: 'Roulette' },
  poker: { name: "Texas Hold'em" },
  teenpatti: { name: 'Teen Patti' },
};
// Table engines register here as each game is built (Stage 2+). A table without an engine is listed but closed.
export const ENGINES = {};

export const DEFAULT_SETTINGS = {
  startingCash: 10_000,
  minBet: 100,
  maxBet: 5_000,
  highRollerMin: 2_500,
  lateJoin: true,
  session: { mode: 'manual', minutes: 60, rounds: 50 },
  loans: { casino: true, creditLimit: 10_000, interestPct: 10, interestEveryMin: 10, termMin: 30, maxDebt: 20_000, p2p: true, p2pMaxPct: 50 },
  bankruptcy: { mode: 'standard', netWorthFloor: 10_000 },
};

// [label, min, max] for every number; enums and booleans below. Unknown keys are ignored.
const NUMBERS = {
  startingCash: ['Starting cash', 1_000, 1_000_000],
  minBet: ['Minimum bet', 1, 100_000],
  maxBet: ['Maximum bet', 1, 1_000_000],
  highRollerMin: ['High-roller minimum', 1, 1_000_000],
  'session.minutes': ['Session length', 5, 600],
  'session.rounds': ['Round limit', 5, 2_000],
  'loans.creditLimit': ['Credit limit', 0, 1_000_000],
  'loans.interestPct': ['Interest rate', 0, 100],
  'loans.interestEveryMin': ['Interest period', 1, 120],
  'loans.termMin': ['Loan term', 5, 600],
  'loans.maxDebt': ['Maximum debt', 0, 2_000_000],
  'loans.p2pMaxPct': ['Player loan rate cap', 0, 100],
  'bankruptcy.netWorthFloor': ['Bankruptcy floor', 0, 2_000_000],
};
const ENUMS = { 'session.mode': ['manual', 'time', 'rounds'], 'bankruptcy.mode': ['standard', 'floor'] };
const BOOLS = ['lateJoin', 'loans.casino', 'loans.p2p'];
// While a session is running these stay fixed: changing them would make wallets unequal or move the finish line.
const LOCKED_WHILE_LIVE = ['startingCash', 'session.mode', 'session.minutes', 'session.rounds'];

const getPath = (o, path) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);
function setPath(o, path, value) {
  const keys = path.split('.');
  let cur = o;
  for (const k of keys.slice(0, -1)) cur = cur[k];
  cur[keys.at(-1)] = value;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

/** Merge a settings patch into current settings. Returns { settings, changed } or { error }. */
export function normalizeSettings(patch, current = DEFAULT_SETTINGS, { live = false } = {}) {
  const out = clone(current);
  const changed = [];
  if (!patch || typeof patch !== 'object') return { error: 'Settings must be an object.' };
  const apply = (path, value) => {
    if (value === undefined || value === getPath(current, path)) return null;
    if (live && LOCKED_WHILE_LIVE.includes(path)) return `${NUMBERS[path]?.[0] || 'Session settings'} can't change during a session.`;
    if (NUMBERS[path]) {
      const [label, min, max] = NUMBERS[path];
      if (!Number.isSafeInteger(value) || value < min || value > max) return `${label} must be a whole number from ${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')}.`;
    } else if (ENUMS[path]) {
      if (!ENUMS[path].includes(value)) return `Unknown option "${value}".`;
    } else if (BOOLS.includes(path)) {
      if (typeof value !== 'boolean') return 'Switches must be true or false.';
    } else return null;
    setPath(out, path, value);
    changed.push(path);
    return null;
  };
  for (const path of [...Object.keys(NUMBERS), ...Object.keys(ENUMS), ...BOOLS]) {
    const err = apply(path, getPath(patch, path));
    if (err) return { error: err };
  }
  if (out.minBet > out.maxBet) return { error: 'The minimum bet can\'t be above the maximum bet.' };
  if (out.maxBet > out.startingCash) return { error: 'The maximum bet can\'t be above the starting cash.' };
  if (out.highRollerMin < out.minBet || out.highRollerMin > out.maxBet) return { error: 'The high-roller minimum must sit between the minimum and maximum bet.' };
  if (out.loans.creditLimit > out.loans.maxDebt) return { error: 'The credit limit can\'t be above the maximum debt.' };
  return { settings: out, changed };
}

export function tablesFor(settings) {
  const { minBet, maxBet, highRollerMin } = settings;
  return [
    { id: 'blackjack', game: 'blackjack', name: 'Blackjack', minBet, maxBet, highRoller: false },
    { id: 'roulette', game: 'roulette', name: 'Roulette', minBet, maxBet, highRoller: false },
    { id: 'poker', game: 'poker', name: "Texas Hold'em", minBet, maxBet, highRoller: false },
    { id: 'teenpatti', game: 'teenpatti', name: 'Teen Patti', minBet, maxBet, highRoller: false },
    { id: 'blackjack-vip', game: 'blackjack', name: 'High Roller Blackjack', minBet: highRollerMin, maxBet, highRoller: true },
  ];
}

// Control characters, zero-width marks and bidi overrides (which can disguise a name or a chat line).
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069]', 'g');
export function cleanText(s, max) {
  return String(s == null ? '' : s).replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
function sameHash(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export class CasinoRoom {
  constructor({ code, now = Date.now, timers = { set: setTimeout, clear: clearTimeout }, hooks = {}, settings } = {}) {
    this.code = code;
    this.now = now;
    this.timers = timers;
    this.hooks = { sync() {}, fx() {}, ...hooks };
    this.createdAt = now();
    this.hostId = null;
    this.settings = clone(settings || DEFAULT_SETTINGS);
    this.session = { no: 1, phase: 'lobby', startedAt: null, endsAt: null, remainingMs: null, rounds: 0, endedAt: null, summary: null, notice: null, endReason: null };
    this.players = new Map();
    this.creds = new Map();           // playerId -> { token: sha, device: sha }  (server only, never in a view)
    this.feed = [];
    this.chat = [];
    this.seq = 0;
    this.sessionTimer = null;
    this.hostTimer = null;
    this.economy = new Economy({ now });
    this.wireEconomy();
  }

  wireEconomy() {
    this.economy.onSettle = () => {
      this.session.rounds += 1;
      if (this.session.phase === 'live' && this.settings.session.mode === 'rounds' && this.session.rounds >= this.settings.session.rounds) {
        this.endSession('Round limit reached');
      }
    };
  }

  // ───────────── helpers ─────────────
  get(id) { return this.players.get(id) || null; }
  humans() { return [...this.players.values()]; }
  connected() { return this.humans().filter((p) => p.connected); }
  sync() { this.hooks.sync(); }
  id(prefix) { return `${prefix}${(++this.seq).toString(36)}${randomBytes(3).toString('hex')}`; }

  log(kind, text, extra = {}) {
    this.feed.push({ id: this.id('f'), at: this.now(), kind, text, ...extra });
    if (this.feed.length > 200) this.feed.splice(0, this.feed.length - 200);
  }

  uniqueName(name, selfId) {
    const base = cleanText(name, 20) || 'Player';
    const taken = new Set(this.humans().filter((p) => p.id !== selfId).map((p) => p.name.toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    for (let i = 2; ; i++) { const n = `${base.slice(0, 17)} ${i}`; if (!taken.has(n.toLowerCase())) return n; }
  }

  issueToken(playerId) {
    const token = randomBytes(18).toString('base64url');
    const c = this.creds.get(playerId) || {};
    c.token = sha(token);
    this.creds.set(playerId, c);
    return token;
  }

  checkToken(playerId, token) {
    const c = this.creds.get(playerId);
    return !!(c && token && sameHash(c.token, sha(token)) && this.players.has(playerId));
  }

  // ───────────── membership ─────────────
  /** Join (or rejoin from the same device). Returns { player, token, rejoined } or { error }. */
  addPlayer({ name, avatar, deviceKey } = {}) {
    const device = typeof deviceKey === 'string' && deviceKey.length >= 16 && deviceKey.length <= 128 ? sha(deviceKey) : null;
    if (device) {
      for (const [pid, c] of this.creds) {
        if (c.device && sameHash(c.device, device) && this.players.has(pid)) {
          const p = this.players.get(pid);
          if (p.left) { p.left = false; this.log('join', `${p.name} is back`, { playerId: pid }); }
          return { player: p, token: this.issueToken(pid), rejoined: true };
        }
      }
    }
    if (this.players.size >= MAX_PLAYERS) return { error: `This room is full (${MAX_PLAYERS} players).` };
    const id = 'p' + randomBytes(6).toString('hex');
    const p = {
      id,
      name: this.uniqueName(name),
      avatar: AVATARS.includes(avatar) ? avatar : AVATARS[this.players.size % AVATARS.length],
      joinedAt: this.now(), lastSeen: this.now(),
      connected: false, left: false, ready: false, tableId: null,
      status: 'active',
    };
    this.players.set(id, p);
    this.creds.set(id, { device });
    if (!this.hostId) this.hostId = id;
    this.economy.open(id);
    const phase = this.session.phase;
    if (phase === 'live' || phase === 'paused') {
      if (this.settings.lateJoin) {
        this.economy.stake(id, this.settings.startingCash);
        this.log('join', `${p.name} joined mid-session with ${money(this.settings.startingCash)}`, { playerId: id });
      } else {
        p.status = 'spectator';
        this.log('join', `${p.name} joined as a spectator (late joining is off)`, { playerId: id });
      }
    } else if (phase === 'ended') {
      p.status = 'spectator';
      this.log('join', `${p.name} joined — they'll play when the next session starts`, { playerId: id });
    } else {
      this.log('join', `${p.name} joined the room`, { playerId: id });
    }
    this.sync();
    return { player: p, token: this.issueToken(id), rejoined: false };
  }

  setConnected(id, on) {
    const p = this.get(id);
    if (!p) return;
    p.connected = on;
    p.lastSeen = this.now();
    if (on) p.left = false;
    this.checkHost();
    this.sync();
  }

  /** Explicit leave. In the lobby the seat goes away; once money exists the player and wallet stay on the books. */
  removePlayer(id) {
    const p = this.get(id);
    if (!p) return;
    if (this.session.phase === 'lobby' && this.economy.account(id)?.staked !== true) {
      this.players.delete(id);
      this.creds.delete(id);
      this.economy.accounts.delete(id);
      this.log('leave', `${p.name} left`, { playerId: id });
    } else {
      p.connected = false; p.left = true; p.ready = false; p.lastSeen = this.now();
      this.log('leave', `${p.name} left the room — their wallet stays on the books`, { playerId: id });
    }
    if (this.hostId === id) this.migrateHost();
    this.sync();
  }

  migrateHost() {
    const next = this.humans().filter((p) => p.connected && p.id !== this.hostId).sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (!next) { if (!this.players.has(this.hostId)) this.hostId = this.humans()[0]?.id || null; return; }
    this.hostId = next.id;
    this.log('host', `${next.name} is now the host`, { playerId: next.id });
  }

  /** A host who stays away for HOST_GRACE_MS hands the room to someone present. */
  checkHost() {
    this.timers.clear(this.hostTimer);
    this.hostTimer = null;
    const host = this.get(this.hostId);
    if (!host) { this.migrateHost(); return; }
    if (host.connected) return;
    const wait = HOST_GRACE_MS - (this.now() - host.lastSeen);
    if (wait <= 0) { this.migrateHost(); return; }
    this.hostTimer = this.timers.set(() => { this.hostTimer = null; const h = this.get(this.hostId); if (h && !h.connected) { this.migrateHost(); this.sync(); } }, wait);
  }

  // ───────────── session lifecycle ─────────────
  startSession() {
    const s = this.session;
    const waiting = this.connected().filter((p) => p.id !== this.hostId && !p.ready && p.status !== 'spectator');
    if (waiting.length) return { error: `Waiting for ${waiting.map((p) => p.name).join(', ')} to be ready.` };
    for (const p of this.humans()) {
      p.status = 'active';
      p.ready = false;
      this.economy.stake(p.id, this.settings.startingCash);
    }
    s.phase = 'live';
    s.startedAt = this.now();
    s.rounds = 0;
    s.summary = null;
    s.endReason = null;
    s.remainingMs = this.settings.session.mode === 'time' ? this.settings.session.minutes * 60_000 : null;
    this.economy.locked = false;
    this.armSessionTimer();
    this.log('session', `Session ${s.no} started — everyone has ${money(this.settings.startingCash)}`);
    this.hooks.fx(null, { kind: 'session-start' });
    return { ok: true };
  }

  armSessionTimer() {
    const s = this.session;
    this.timers.clear(this.sessionTimer);
    this.sessionTimer = null;
    s.endsAt = null;
    if (s.phase !== 'live' || s.remainingMs == null) return;
    s.endsAt = this.now() + s.remainingMs;
    this.sessionTimer = this.timers.set(() => { this.sessionTimer = null; if (this.session.phase === 'live') { this.endSession('Time is up'); this.sync(); } }, s.remainingMs);
  }

  pauseSession() {
    const s = this.session;
    if (s.phase !== 'live') return { error: 'Only a live session can be paused.' };
    if (s.endsAt) s.remainingMs = Math.max(0, s.endsAt - this.now());
    this.timers.clear(this.sessionTimer);
    this.sessionTimer = null;
    s.endsAt = null;
    s.phase = 'paused';
    this.economy.locked = true;
    this.log('session', 'The host paused the session — betting is closed');
    return { ok: true };
  }

  resumeSession() {
    if (this.session.phase !== 'paused') return { error: 'The session isn\'t paused.' };
    this.session.phase = 'live';
    this.economy.locked = false;
    this.armSessionTimer();
    this.log('session', 'The session resumed — betting is open');
    return { ok: true };
  }

  /** Stop betting, close open rounds safely, rank everyone. */
  endSession(reason = 'The host ended the session') {
    const s = this.session;
    if (s.phase !== 'live' && s.phase !== 'paused') return { error: 'There\'s no session running.' };
    this.economy.locked = true;
    for (const t of tablesFor(this.settings)) ENGINES[t.game]?.close?.(this, t);   // let tables finish or void their hands
    this.economy.voidAllOpen('Session ended — open bet refunded');
    this.timers.clear(this.sessionTimer);
    this.sessionTimer = null;
    s.phase = 'ended';
    s.endsAt = null;
    s.remainingMs = null;
    s.endedAt = this.now();
    s.endReason = reason;
    s.summary = this.summarize();
    const w = s.summary.winners.map((id) => this.get(id)?.name).filter(Boolean);
    this.log('session', `${reason}. ${w.length ? `${w.join(' & ')} won with ${money(s.summary.rows[0].netWorth)}` : 'No winner'}`);
    this.hooks.fx(null, { kind: 'session-end' });
    return { ok: true };
  }

  /** Explicit host action: archive the session and give everyone the same fresh wallet. */
  restartSession() {
    const s = this.session;
    if (s.phase === 'live' || s.phase === 'paused') this.endSession('The host restarted the session');
    const prev = s.no;
    // Players who left are archived with the old session and don't take a seat in the new one.
    for (const p of this.humans()) if (p.left && p.id !== this.hostId) { this.players.delete(p.id); this.creds.delete(p.id); }
    this.economy.resetSession(this.humans().map((p) => p.id), this.settings.startingCash);
    this.economy.locked = true;
    Object.assign(s, { no: prev + 1, phase: 'lobby', startedAt: null, endsAt: null, remainingMs: null, rounds: 0, endedAt: null, summary: null, endReason: null });
    for (const p of this.humans()) { p.ready = false; p.status = 'active'; p.tableId = null; }
    s.notice = { id: this.id('n'), at: this.now(), text: `The host reset the economy. Session ${prev} is archived; everyone starts session ${s.no} with ${money(this.settings.startingCash)} when the host deals in.` };
    this.log('session', s.notice.text);
    return { ok: true };
  }

  summarize() {
    const rows = this.humans().map((p) => {
      const a = this.economy.account(p.id);
      if (!a || !a.staked) return null;
      const nw = netWorth(a);
      return {
        id: p.id, name: p.name, avatar: p.avatar, status: p.status,
        startingCash: a.startingCash, cash: a.cash, debt: a.debt + a.interest, owes: a.owes, owed: a.owed,
        netWorth: nw, profit: nw - a.startingCash, won: a.won, lost: a.lost, rounds: a.rounds,
        lowNetWorth: a.lowNetWorth, peakNetWorth: a.peakNetWorth, byGame: a.byGame,
      };
    }).filter(Boolean).sort((x, y) => y.netWorth - x.netWorth || x.name.localeCompare(y.name));
    rows.forEach((r, i) => { r.rank = i && r.netWorth === rows[i - 1].netWorth ? rows[i - 1].rank : i + 1; });
    const top = rows[0];
    const winners = top ? rows.filter((r) => r.netWorth === top.netWorth).map((r) => r.id) : [];
    const best = [...rows].sort((a, b) => b.profit - a.profit)[0];
    const worst = [...rows].sort((a, b) => a.profit - b.profit)[0];
    const games = {};
    for (const r of rows) for (const [g, st] of Object.entries(r.byGame)) {
      const t = games[g] || (games[g] = { game: g, rounds: 0, net: 0 });
      t.rounds += st.rounds; t.net += st.net;
    }
    const gameList = Object.values(games).sort((a, b) => b.net - a.net || b.rounds - a.rounds);
    // A comeback: climbed back at least 10% of starting cash from the session's low point, which was underwater.
    const comeback = rows
      .map((r) => ({ id: r.id, from: r.lowNetWorth, to: r.netWorth, gain: r.netWorth - r.lowNetWorth }))
      .filter((c) => c.from < (this.economy.account(c.id)?.startingCash || 0) && c.gain >= 0.1 * this.settings.startingCash)
      .sort((a, b) => b.gain - a.gain)[0] || null;
    return {
      rows, winners,
      biggestWinner: best && best.profit > 0 ? { id: best.id, profit: best.profit } : null,
      biggestLoser: worst && worst.profit < 0 ? { id: worst.id, profit: worst.profit } : null,
      bestGame: gameList[0] || null,
      comeback,
      rounds: this.session.rounds,
      startedAt: this.session.startedAt,
      endedAt: this.now(),
    };
  }

  // ───────────── commands ─────────────
  command(playerId, cmd) {
    const p = this.get(playerId);
    if (!p) return { error: 'You are not in this room.' };
    if (!cmd || typeof cmd.type !== 'string') return { error: 'Unknown command.' };
    const isHost = playerId === this.hostId;
    const hostOnly = () => (isHost ? null : { error: 'Only the host can do that.' });
    let res;
    switch (cmd.type) {
      case 'profile': {
        const name = cmd.name !== undefined ? this.uniqueName(cmd.name, playerId) : p.name;
        if (cmd.avatar !== undefined && !AVATARS.includes(cmd.avatar)) return { error: 'Pick one of the avatars.' };
        if (name !== p.name) this.log('profile', `${p.name} is now ${name}`, { playerId });
        p.name = name;
        if (cmd.avatar) p.avatar = cmd.avatar;
        res = { ok: true };
        break;
      }
      case 'ready':
        if (this.session.phase !== 'lobby') return { error: 'Ready-up happens in the lobby.' };
        p.ready = !!cmd.ready;
        res = { ok: true };
        break;
      case 'settings': {
        const e = hostOnly(); if (e) return e;
        const live = this.session.phase === 'live' || this.session.phase === 'paused';
        const n = normalizeSettings(cmd.settings, this.settings, { live });
        if (n.error) return n;
        this.settings = n.settings;
        if (n.changed.length) this.log('settings', `The host changed ${n.changed.length === 1 ? 'a setting' : n.changed.length + ' settings'}`, { changed: n.changed });
        res = { ok: true, changed: n.changed };
        break;
      }
      case 'start': {
        const e = hostOnly(); if (e) return e;
        if (this.session.phase !== 'lobby') return { error: 'The session has already started.' };
        res = this.startSession();
        break;
      }
      case 'pause': { const e = hostOnly(); if (e) return e; res = this.pauseSession(); break; }
      case 'resume': { const e = hostOnly(); if (e) return e; res = this.resumeSession(); break; }
      case 'end': { const e = hostOnly(); if (e) return e; res = this.endSession(); break; }
      case 'restart': {
        const e = hostOnly(); if (e) return e;
        if (cmd.confirm !== true) return { error: 'Restarting resets every wallet. Confirm to continue.' };
        if (this.session.phase === 'lobby') return { error: 'The session hasn\'t started yet.' };
        res = this.restartSession();
        break;
      }
      case 'host': {
        const e = hostOnly(); if (e) return e;
        const to = this.get(cmd.to);
        if (!to || to.id === playerId) return { error: 'Pick another player.' };
        this.hostId = to.id;
        this.log('host', `${p.name} handed the host role to ${to.name}`, { playerId: to.id });
        res = { ok: true };
        break;
      }
      case 'chat': {
        const text = cleanText(cmd.text, 240);
        if (!text) return { error: 'Say something first.' };
        this.chat.push({ id: this.id('c'), at: this.now(), from: playerId, text });
        if (this.chat.length > 100) this.chat.splice(0, this.chat.length - 100);
        res = { ok: true };
        break;
      }
      case 'emote':
        if (!EMOTES.includes(cmd.emote)) return { error: 'Unknown reaction.' };
        this.hooks.fx(null, { kind: 'emote', from: playerId, emote: cmd.emote });
        return { ok: true };                       // reactions are fleeting: no state change, no sync
      case 'history': {
        const before = Number.isSafeInteger(cmd.before) ? cmd.before : Infinity;
        return { ok: true, entries: this.economy.history(playerId, { limit: 100, before }) };
      }
      default:
        return { error: 'Unknown command.' };
    }
    if (res && res.ok) this.sync();
    return res;
  }

  // ───────────── views ─────────────
  publicPlayer(p) {
    const a = this.economy.account(p.id);
    const staked = !!(a && a.staked);
    return {
      id: p.id, name: p.name, avatar: p.avatar, connected: p.connected, left: p.left, ready: p.ready,
      status: p.status, isHost: p.id === this.hostId, tableId: p.tableId,
      hasWallet: staked,
      cash: staked ? a.cash : 0, reserved: staked ? a.reserved : 0,
      debt: staked ? a.debt + a.interest : 0, owes: staked ? a.owes : 0, owed: staked ? a.owed : 0,
      netWorth: staked ? netWorth(a) : 0, startingCash: staked ? a.startingCash : 0,
      won: staked ? a.won : 0, lost: staked ? a.lost : 0, rounds: staked ? a.rounds : 0,
    };
  }

  viewFor(playerId) {
    const me = this.get(playerId);
    const a = this.economy.account(playerId);
    const s = this.session;
    const players = this.humans().map((p) => this.publicPlayer(p));
    const leaderboard = players.filter((p) => p.hasWallet).sort((x, y) => y.netWorth - x.netWorth || x.name.localeCompare(y.name)).map((p) => p.id);
    return {
      code: this.code,
      you: playerId,
      hostId: this.hostId,
      isHost: playerId === this.hostId,
      serverNow: this.now(),
      session: {
        no: s.no, phase: s.phase, startedAt: s.startedAt, endsAt: s.endsAt, remainingMs: s.remainingMs,
        rounds: s.rounds, mode: this.settings.session.mode, roundLimit: this.settings.session.rounds,
        endReason: s.endReason, summary: s.summary, notice: s.notice,
      },
      settings: this.settings,
      tables: tablesFor(this.settings).map((t) => ({ ...t, open: !!ENGINES[t.game], seated: players.filter((p) => p.tableId === t.id).map((p) => p.id) })),
      players,
      leaderboard,
      feed: this.feed.slice(-40),
      chat: this.chat.slice(-60),
      me: me && a ? {
        account: {
          cash: a.cash, reserved: a.reserved, debt: a.debt, interest: a.interest, owes: a.owes, owed: a.owed,
          netWorth: netWorth(a), startingCash: a.startingCash, staked: a.staked, won: a.won, lost: a.lost,
          rounds: a.rounds, biggestWin: a.biggestWin, biggestLoss: a.biggestLoss, byGame: a.byGame,
        },
        history: this.economy.history(playerId, { limit: 30 }),
      } : null,
    };
  }

  // ───────────── persistence ─────────────
  toJSON() {
    return {
      v: 1, code: this.code, createdAt: this.createdAt, hostId: this.hostId, settings: this.settings, seq: this.seq,
      session: { ...this.session, endsAt: null, remainingMs: this.session.endsAt ? Math.max(0, this.session.endsAt - this.now()) : this.session.remainingMs },
      players: this.humans(), creds: [...this.creds], feed: this.feed, chat: this.chat, economy: this.economy.toJSON(),
    };
  }

  /** Restore a snapshot. Everyone starts disconnected; a live session's clock resumes from where it was saved. */
  static fromJSON(data, opts = {}) {
    const room = new CasinoRoom({ ...opts, code: data.code, settings: data.settings });
    room.createdAt = data.createdAt; room.hostId = data.hostId; room.seq = data.seq;
    room.session = data.session;
    for (const p of data.players) room.players.set(p.id, { ...p, connected: false });
    room.creds = new Map(data.creds);
    room.feed = data.feed; room.chat = data.chat;
    room.economy = Economy.fromJSON(data.economy, { now: room.now });
    room.wireEconomy();
    room.armSessionTimer();
    return room;
  }

  destroy() {
    this.timers.clear(this.sessionTimer);
    this.timers.clear(this.hostTimer);
  }
}
