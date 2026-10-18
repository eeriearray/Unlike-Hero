// Neon Casino — "Lucky Sevens" slot hall. Six machines; each player spins their own, nobody waits for anybody.
//
// Three reels, three visible rows, five paylines (three rows and both diagonals). The bet is the whole spin: each line is
// worth a fifth of it. Reel stops come from the room's CSPRNG on the server; the browser only animates to them. The
// bet is held when the reels start and settled once, when they stop (the wallet moves then, not before).
import { fmt } from './kit.mjs';

export const RULES = { seats: 6, spinMs: 4_000, resultsMs: 1_500, history: 12 };
export const SYMBOLS = ['S7', 'GEM', 'BELL', 'BAR', 'LEM', 'CHR'];
// One strip per reel (20 stops each). Every stop shows its symbol and the ones above and below it.
export const STRIPS = [
  ['CHR', 'LEM', 'BAR', 'CHR', 'BELL', 'LEM', 'CHR', 'S7', 'LEM', 'BAR', 'CHR', 'GEM', 'LEM', 'BELL', 'CHR', 'BAR', 'LEM', 'GEM', 'CHR', 'BELL'],
  ['LEM', 'CHR', 'BELL', 'LEM', 'BAR', 'CHR', 'GEM', 'LEM', 'CHR', 'S7', 'BAR', 'LEM', 'CHR', 'BELL', 'LEM', 'CHR', 'BAR', 'GEM', 'CHR', 'BELL'],
  ['BAR', 'CHR', 'LEM', 'BELL', 'CHR', 'LEM', 'GEM', 'CHR', 'BAR', 'LEM', 'S7', 'CHR', 'BELL', 'LEM', 'CHR', 'GEM', 'LEM', 'BAR', 'CHR', 'BELL'],
];
export const LINES = [[0, 0, 0], [1, 1, 1], [2, 2, 2], [0, 1, 2], [2, 1, 0]];
// Multiples of one line's stake. Three of a kind; two cherries on the left of a line pay a little too.
export const PAYS = { S7: 300, GEM: 100, BELL: 40, BAR: 20, LEM: 10, CHR: 8, CHR2: 4 };
export const MAX_MULT = 310;                 // a full screen of sevens: 5 lines × 300 ÷ 5 = 300× the whole bet

/** The 3×3 window for these stops: grid[reel][row]. */
export function windowAt(stops) {
  return STRIPS.map((strip, r) => [-1, 0, 1].map((d) => strip[(stops[r] + d + strip.length) % strip.length]));
}

/** Winning lines and the payout for a bet. Each line is worth bet/5 (rounded down, so a payout is always whole chips). */
export function evaluate(grid, bet) {
  const per = bet / LINES.length;
  const wins = [];
  let total = 0;
  LINES.forEach((line, i) => {
    const s = line.map((row, reel) => grid[reel][row]);
    let mult = 0, kind = null;
    if (s[0] === s[1] && s[1] === s[2]) { mult = PAYS[s[0]]; kind = s[0]; }
    else if (s[0] === 'CHR' && s[1] === 'CHR') { mult = PAYS.CHR2; kind = 'CHR2'; }
    if (mult) { const pay = Math.floor(per * mult); wins.push({ line: i, kind, mult, pay }); total += pay; }
  });
  return { wins, payout: total };
}

const settleTimers = new Map();             // `${room.code}:${pid}` -> handle (not saved)

function settle(room, table, pid) {
  const st = table.state, p = st.pending[pid];
  if (!p) return;
  room.timers.clear(settleTimers.get(`${room.code}:${pid}`)); settleTimers.delete(`${room.code}:${pid}`);
  delete st.pending[pid];
  const top = p.wins.find((w) => w.kind === 'S7');
  if (top) room.economy.tagRound(p.id, pid, 'triple-seven');
  const res = room.economy.settleRound(p.id, { [pid]: p.payout }, { mode: 'house', maxMultiplier: MAX_MULT, memo: `${table.name}: ${p.payout ? 'won ' + fmt(p.payout) : 'no win'}` });
  if (res.error) throw new Error(`slots settlement refused: ${res.error}`);
  const net = p.payout - p.bet;
  st.last[pid] = { no: p.no, grid: p.grid, wins: p.wins, bet: p.bet, payout: p.payout, net, at: room.now() };
  st.history.unshift({ pid, payout: p.payout, bet: p.bet });
  st.history.length = Math.min(st.history.length, RULES.history);
  const big = Math.max(2_000, Math.round(room.settings.startingCash * 0.2));
  if (net >= big || top) {
    room.log('win', `${room.get(pid)?.name || 'Someone'} won ${fmt(net)} at ${table.name}${top ? ' — three sevens!' : ''}`, { playerId: pid, amount: net });
    room.hooks.fx(null, { kind: 'big-win', playerId: pid, amount: net, table: table.id });
  }
}

function spin(room, table, pid, cmd) {
  const st = table.state;
  if (!st.seats.includes(pid)) return { error: 'Take a seat at a machine first.' };
  if (st.pending[pid]) return { error: 'The reels are still turning.' };
  const bet = cmd.amount;
  if (!Number.isSafeInteger(bet) || bet < table.minBet) return { error: `The minimum bet is ${fmt(table.minBet)}.` };
  if (bet > table.maxBet) return { error: `The maximum bet is ${fmt(table.maxBet)}.` };
  if (bet % LINES.length) return { error: `Bets are in multiples of ${LINES.length} (one share per line).` };
  const no = (st.counter[pid] = (st.counter[pid] || 0) + 1);
  const id = `${room.code}:${table.id}:${room.session.no}:${pid}:${no}`;
  const open = room.economy.openRound({ roundId: id, game: 'slots', tableId: table.id });
  if (open.error) return open;
  const res = room.economy.reserve({ betId: `${id}:b`, playerId: pid, roundId: id, amount: bet, memo: `${table.name}: ${fmt(bet)} spin` });
  if (res.error) { room.economy.voidRound(id); return res; }
  const stops = STRIPS.map((s) => room.rng(s.length));
  const grid = windowAt(stops);
  const ev = evaluate(grid, bet);
  st.pending[pid] = { id, no, bet, stops, grid, wins: ev.wins, payout: ev.payout, settleAt: room.now() + RULES.spinMs };
  settleTimers.set(`${room.code}:${pid}`, room.timers.set(() => { try { settle(room, table, pid); } finally { room.sync(); } }, RULES.spinMs));
  return { ok: true };
}

export const slots = {
  RULES,
  create() { return { seats: Array(RULES.seats).fill(null), pending: {}, last: {}, counter: {}, history: [], timer: null }; },

  sit(room, table, pid) {
    const st = table.state;
    if (st.seats.includes(pid)) return { ok: true };
    const i = st.seats.indexOf(null);
    if (i < 0) return { error: 'Every machine is taken. Watch, or try another table.' };
    st.seats[i] = pid;
    return { ok: true };
  },

  /** Standing up never cancels a spin: the reels finish and pay. */
  leave(room, table, pid) {
    const st = table.state;
    const i = st.seats.indexOf(pid);
    if (i >= 0) st.seats[i] = null;
  },

  command(room, table, pid, cmd) {
    if (room.session.phase !== 'live') return { error: room.session.phase === 'paused' ? 'The session is paused.' : 'The machines are switched off.' };
    if (cmd.action === 'spin') return spin(room, table, pid, cmd);
    return { error: 'Unknown move.' };
  },

  disconnected() {},
  pause() {},
  resume() {},

  /** Session ending: reels already turning stop and pay now. */
  close(room, table) { for (const pid of Object.keys(table.state.pending)) settle(room, table, pid); },

  view(room, table, viewer) {
    const st = table.state;
    const spins = {};
    for (const pid of st.seats) {
      if (!pid) continue;
      const p = st.pending[pid], l = st.last[pid];
      if (p) spins[pid] = { state: 'spinning', no: p.no, bet: p.bet, grid: pid === viewer ? p.grid : null };
      else if (l) spins[pid] = { state: 'done', no: l.no, bet: l.bet, grid: l.grid, wins: l.wins, payout: l.payout, net: l.net };
    }
    return {
      seats: st.seats.slice(),
      spins,
      history: st.history.slice(),
      timer: null,
      you: { seated: st.seats.includes(viewer), canSpin: st.seats.includes(viewer) && !st.pending[viewer] && room.session.phase === 'live' },
      rules: { strips: STRIPS, lines: LINES, pays: PAYS, spinMs: RULES.spinMs, step: LINES.length, symbols: SYMBOLS },
    };
  },

  snapshot(room, state) { return JSON.parse(JSON.stringify(state)); },
  /** After a restart there are no timers: settle anything that was mid-spin. */
  restore(room, table) { if (room.session.phase === 'live' || room.session.phase === 'paused') for (const pid of Object.keys(table.state.pending)) settle(room, table, pid); },
};
