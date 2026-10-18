// Neon Casino — European roulette (single zero). One engine for every roulette table in a room.
//
// Everyone at the table bets during one betting window; each chip on the layout is its own bet in the economy, so
// "undo" refunds exactly that chip. The wheel is spun with the room's CSPRNG when betting closes, and the spin settles
// once with house payouts capped at 36× the stake. Zero loses every outside bet (no la partage).
import { tableTimers, fmt } from './kit.mjs';

export const RULES = { seats: 8, bettingMs: 25_000, spinMs: 7_000, resultsMs: 6_000, maxBetsPerPlayer: 40, history: 15 };
export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
// Profit per chip on a win (a win returns stake × (payout + 1)).
export const PAYOUT = { straight: 35, split: 17, street: 11, trio: 11, corner: 8, sixline: 5, dozen: 2, column: 2, red: 1, black: 1, odd: 1, even: 1, low: 1, high: 1 };
export const colorOf = (n) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const ALL = range(1, 36);
const OUTSIDE = {
  red: ALL.filter((n) => RED.has(n)), black: ALL.filter((n) => !RED.has(n)),
  odd: ALL.filter((n) => n % 2), even: ALL.filter((n) => !(n % 2)),
  low: range(1, 18), high: range(19, 36),
};

/**
 * Validate a bet spot. Inside bets name their numbers; dozens and columns name 1–3; even-money bets need nothing.
 * Returns { type, numbers, label } or { error }. Numbers on the layout: column c (0–11) holds 3c+1, 3c+2, 3c+3.
 */
export function normalizeSpot(spot) {
  if (!spot || typeof spot !== 'object' || !(spot.type in PAYOUT)) return { error: 'Unknown bet.' };
  const { type } = spot;
  if (OUTSIDE[type]) return { type, numbers: OUTSIDE[type], label: { red: 'Red', black: 'Black', odd: 'Odd', even: 'Even', low: '1–18', high: '19–36' }[type] };
  if (type === 'dozen' || type === 'column') {
    const k = spot.key;
    if (k !== 1 && k !== 2 && k !== 3) return { error: 'Pick dozen or column 1, 2 or 3.' };
    if (type === 'dozen') return { type, key: k, numbers: range(12 * (k - 1) + 1, 12 * k), label: ['1st 12', '2nd 12', '3rd 12'][k - 1] };
    return { type, key: k, numbers: ALL.filter((n) => n % 3 === k % 3), label: `Column ${k}` };
  }
  const nums = Array.isArray(spot.numbers) ? [...new Set(spot.numbers)].sort((a, b) => a - b) : [];
  if (!nums.length || nums.some((n) => !Number.isInteger(n) || n < 0 || n > 36)) return { error: 'Numbers run from 0 to 36.' };
  const row = (n) => (n - 1) % 3;      // 0 = bottom (1, 4, 7…), 2 = top (3, 6, 9…)
  const [a, b] = nums;
  const ok = {
    straight: () => nums.length === 1,
    split: () => nums.length === 2 && ((a === 0 && b <= 3) || (a > 0 && b - a === 3) || (a > 0 && b - a === 1 && row(a) !== 2)),
    street: () => nums.length === 3 && a > 0 && row(a) === 0 && nums[2] === a + 2,
    trio: () => nums.length === 3 && a === 0 && ((nums[1] === 1 && nums[2] === 2) || (nums[1] === 2 && nums[2] === 3)),
    corner: () => nums.length === 4 && a > 0 && row(a) !== 2 && nums[1] === a + 1 && nums[2] === a + 3 && nums[3] === a + 4,
    sixline: () => nums.length === 6 && a > 0 && row(a) === 0 && nums[5] === a + 5,
  }[type];
  if (!ok || !ok()) return { error: 'Those numbers don\'t make that bet on the layout.' };
  return { type, numbers: nums, label: type === 'straight' ? String(a) : `${type[0].toUpperCase() + type.slice(1)} ${nums.join('-')}` };
}

export const betWins = (bet, n) => bet.numbers.includes(n);
export const betReturn = (bet, n) => (betWins(bet, n) ? bet.amount * (PAYOUT[bet.type] + 1) : 0);

const timers = tableTimers((room, table, kind) => {
  if (kind === 'betting') spin(room, table);
  else if (kind === 'spin') settle(room, table);
  else if (kind === 'results') { table.state.round = null; table.state.phase = 'idle'; }
});

function openRound(room, table) {
  const st = table.state;
  st.roundNo += 1;
  const id = `${room.code}:${table.id}:${room.session.no}:${st.roundNo}`;
  const res = room.economy.openRound({ roundId: id, game: 'roulette', tableId: table.id });
  if (res.error) return res;
  st.round = { id, bets: [], done: {}, result: null, seq: 0 };
  st.phase = 'betting';
  st.last = null;
  timers.set(room, table, 'betting', RULES.bettingMs);
  return { ok: true };
}

function myBets(st, pid) { return st.round ? st.round.bets.filter((b) => b.owner === pid) : []; }

function maybeSpinEarly(room, table) {
  const st = table.state, r = st.round;
  if (!r || st.phase !== 'betting' || !r.bets.length) return;
  const bettors = [...new Set(r.bets.map((b) => b.owner))];
  const waiting = bettors.filter((id) => !r.done[id] && st.seats.includes(id) && room.get(id)?.connected);
  if (!waiting.length) spin(room, table);
}

function spin(room, table) {
  const st = table.state, r = st.round;
  timers.clear(room, table);
  if (!r) return;
  if (!r.bets.length) { room.economy.voidRound(r.id); st.round = null; st.phase = 'idle'; return; }
  r.result = room.rng(37);
  r.spunAt = room.now();
  st.phase = 'spinning';
  timers.set(room, table, 'spin', RULES.spinMs);
}

function settle(room, table) {
  const st = table.state, r = st.round, n = r.result;
  timers.clear(room, table);
  const payouts = {};
  for (const b of r.bets) { b.won = betWins(b, n); b.returned = betReturn(b, n); payouts[b.owner] = (payouts[b.owner] || 0) + b.returned; }
  st.phase = 'results';
  st.history.unshift(n);
  st.history.length = Math.min(st.history.length, RULES.history);
  const res = room.economy.settleRound(r.id, payouts, { mode: 'house', maxMultiplier: PAYOUT.straight + 1, memo: `${table.name}: ${n} ${colorOf(n)}` });
  if (res.error) throw new Error(`roulette settlement refused: ${res.error}`);
  const per = {};
  for (const x of res.results || []) per[x.playerId] = { staked: x.staked, payout: x.payout, net: x.net, cash: room.economy.account(x.playerId).cash };
  st.last = { result: n, color: colorOf(n), players: per, at: room.now() };
  const big = Math.max(2_000, Math.round(room.settings.startingCash * 0.2));
  for (const [pid, x] of Object.entries(per)) {
    const straight = r.bets.some((b) => b.owner === pid && b.won && b.type === 'straight');
    if (x.net >= big || straight) {
      room.log('win', `${room.get(pid)?.name || 'Someone'} won ${fmt(x.net)} at ${table.name}${straight ? ` — straight up on ${n}` : ''}`, { playerId: pid, amount: x.net });
      room.hooks.fx(null, { kind: 'big-win', playerId: pid, amount: x.net, table: table.id });
    }
  }
  if (room.session.phase === 'live' || room.session.phase === 'paused') timers.set(room, table, 'results', RULES.resultsMs);
}

function placeBet(room, table, pid, cmd) {
  const st = table.state;
  if (!st.seats.includes(pid)) return { error: 'Take a seat to bet.' };
  if (st.phase !== 'idle' && st.phase !== 'betting') return { error: 'No more bets — wait for the next spin.' };
  const spot = normalizeSpot(cmd.spot);
  if (spot.error) return spot;
  const amount = cmd.amount;
  if (!Number.isSafeInteger(amount) || amount < table.minBet) return { error: `Each bet is at least ${fmt(table.minBet)}.` };
  const mine = myBets(st, pid);
  const total = mine.reduce((s, b) => s + b.amount, 0);
  if (total + amount > table.maxBet) return { error: `Your bets on one spin are capped at ${fmt(table.maxBet)} (${fmt(table.maxBet - total)} left).` };
  if (mine.length >= RULES.maxBetsPerPlayer) return { error: `At most ${RULES.maxBetsPerPlayer} bets per spin.` };
  if (!st.round) { const o = openRound(room, table); if (o.error) return o; }
  const r = st.round;
  const id = `${r.id}:${pid}:${++r.seq}`;
  const res = room.economy.reserve({ betId: id, playerId: pid, roundId: r.id, amount, memo: `${table.name}: ${spot.label}` });
  if (res.error) { if (!r.bets.length) { room.economy.voidRound(r.id); timers.clear(room, table); st.round = null; st.phase = 'idle'; } return res; }
  r.bets.push({ id, owner: pid, type: spot.type, key: spot.key, numbers: spot.numbers, label: spot.label, amount });
  delete r.done[pid];
  return { ok: true };
}

function takeBack(room, table, pid, which) {
  const st = table.state, r = st.round;
  if (st.phase !== 'betting' || !r) return { error: 'There are no bets to take back.' };
  const mine = myBets(st, pid);
  const drop = which === 'all' ? mine : mine.slice(-1);
  if (!drop.length) return { error: 'You have no bets on this spin.' };
  for (const b of drop) {
    const res = room.economy.cancelBet(b.id, `${table.name}: ${b.label} taken back`);
    if (res.error) return res;
    r.bets.splice(r.bets.indexOf(b), 1);
  }
  delete r.done[pid];
  maybeSpinEarly(room, table);
  return { ok: true };
}

export const roulette = {
  RULES,
  create() { return { phase: 'idle', seats: Array(RULES.seats).fill(null), roundNo: 0, round: null, last: null, history: [], timer: null }; },

  sit(room, table, pid) {
    const st = table.state;
    if (st.seats.includes(pid)) return { ok: true };
    const i = st.seats.indexOf(null);
    if (i < 0) return { error: 'This table is full. Watch, or try another table.' };
    st.seats[i] = pid;
    return { ok: true };
  },

  /** Chips already on the layout stay there and are paid or lost on the spin. */
  leave(room, table, pid) {
    const st = table.state;
    const i = st.seats.indexOf(pid);
    if (i >= 0) st.seats[i] = null;
    maybeSpinEarly(room, table);
  },

  command(room, table, pid, cmd) {
    if (room.session.phase !== 'live') return { error: room.session.phase === 'paused' ? 'The session is paused.' : 'The tables are closed.' };
    switch (cmd.action) {
      case 'bet': return placeBet(room, table, pid, cmd);
      case 'undo': return takeBack(room, table, pid, 'last');
      case 'clear': return takeBack(room, table, pid, 'all');
      case 'done': {
        const st = table.state;
        if (st.phase !== 'betting' || !myBets(st, pid).length) return { error: 'Place a bet first.' };
        st.round.done[pid] = true;
        maybeSpinEarly(room, table);
        return { ok: true };
      }
      default: return { error: 'Unknown move.' };
    }
  },

  disconnected(room, table) { maybeSpinEarly(room, table); },
  pause(room, table) { timers.pause(room, table); },
  resume(room, table) { timers.resume(room, table); },

  /** Session ending: a ball already spinning lands and pays; chips on an unspun layout come back. */
  close(room, table) {
    const st = table.state;
    if (st.phase === 'betting' && st.round) room.economy.voidRound(st.round.id, `${table.name}: session ended before the spin — bet refunded`);
    else if (st.phase === 'spinning' && st.round) settle(room, table);
    timers.clear(room, table);
    if (st.phase !== 'results') { st.round = null; st.phase = 'idle'; }
  },

  view(room, table, viewer) {
    const st = table.state, r = st.round;
    const mine = myBets(st, viewer);
    return {
      phase: st.phase,
      seats: st.seats.slice(),
      timer: timers.view(st),
      round: r ? {
        id: r.id,
        bets: r.bets.map((b) => ({ id: b.id, owner: b.owner, type: b.type, key: b.key, numbers: b.numbers, label: b.label, amount: b.amount, won: b.won, returned: b.returned })),
        done: { ...r.done },
        result: st.phase === 'spinning' || st.phase === 'results' ? r.result : null,
        spunAt: r.spunAt || null,
      } : null,
      last: st.last,
      history: st.history.slice(),
      you: {
        seated: st.seats.includes(viewer),
        canBet: st.seats.includes(viewer) && (st.phase === 'idle' || st.phase === 'betting') && room.session.phase === 'live',
        total: mine.reduce((s, b) => s + b.amount, 0),
        done: !!(r && r.done[viewer]),
      },
      rules: { payouts: PAYOUT, spinSec: RULES.spinMs / 1000, bettingSec: RULES.bettingMs / 1000, maxBets: RULES.maxBetsPerPlayer },
    };
  },

  snapshot(room, state) { return timers.snapshot(room, state); },
  restore(room, table) { if (table.state.timer && room.session.phase === 'live') timers.resume(room, table); },
};
