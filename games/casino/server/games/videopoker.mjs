// Neon Casino — Video Poker, Jacks or Better (9/6). Six machines, one player each.
//
// Deal five cards, hold the ones you like, draw replacements once, and the best hand is paid by the table. The deck is
// shuffled with the room's CSPRNG and never leaves the server; the replacement cards are already decided when you deal.
// A hand left untouched for a minute draws on its own (keeping every card), so a bet is never stuck.
import { shuffledDeck, fmt } from './kit.mjs';
import { eval5 } from './poker.mjs';

export const RULES = { seats: 6, idleMs: 60_000 };
// Multiples of the bet.
export const PAYTABLE = [
  ['royal', 'Royal flush', 800], ['sflush', 'Straight flush', 50], ['four', 'Four of a kind', 25], ['full', 'Full house', 9], ['flush', 'Flush', 6],
  ['straight', 'Straight', 4], ['three', 'Three of a kind', 3], ['twopair', 'Two pair', 2], ['jacks', 'Jacks or better', 1],
];
const MULT = Object.fromEntries(PAYTABLE.map(([k, , m]) => [k, m]));
export const MAX_MULT = 800;

/** Which pay-table line these five cards make, or null. */
export function rankOf(cards) {
  const k = eval5(cards);
  switch (k[0]) {
    case 8: return k[1] === 14 ? 'royal' : 'sflush';
    case 7: return 'four';
    case 6: return 'full';
    case 5: return 'flush';
    case 4: return 'straight';
    case 3: return 'three';
    case 2: return 'twopair';
    case 1: return k[1] >= 11 ? 'jacks' : null;
    default: return null;
  }
}
export const nameOf = (key) => (PAYTABLE.find((r) => r[0] === key) || [])[1] || 'No win';

const idleTimers = new Map();
const tkey = (room, pid) => `${room.code}:${pid}`;
function clearIdle(room, pid) { room.timers.clear(idleTimers.get(tkey(room, pid))); idleTimers.delete(tkey(room, pid)); }
function armIdle(room, table, pid) {
  clearIdle(room, pid);
  idleTimers.set(tkey(room, pid), room.timers.set(() => { idleTimers.delete(tkey(room, pid)); try { draw(room, table, pid); } finally { room.sync(); } }, RULES.idleMs));
}

function deal(room, table, pid, cmd) {
  const st = table.state;
  if (!st.seats.includes(pid)) return { error: 'Take a seat at a machine first.' };
  const cur = st.hands[pid];
  if (cur && cur.phase === 'hold') return { error: 'Finish this hand first.' };
  const bet = cmd.amount;
  if (!Number.isSafeInteger(bet) || bet < table.minBet) return { error: `The minimum bet is ${fmt(table.minBet)}.` };
  if (bet > table.maxBet) return { error: `The maximum bet is ${fmt(table.maxBet)}.` };
  const no = (st.counter[pid] = (st.counter[pid] || 0) + 1);
  const id = `${room.code}:${table.id}:${room.session.no}:${pid}:${no}`;
  const open = room.economy.openRound({ roundId: id, game: 'videopoker', tableId: table.id });
  if (open.error) return open;
  const res = room.economy.reserve({ betId: `${id}:b`, playerId: pid, roundId: id, amount: bet, memo: `${table.name}: ${fmt(bet)} hand` });
  if (res.error) { room.economy.voidRound(id); return res; }
  const deck = shuffledDeck(room.rng);
  st.hands[pid] = { id, no, bet, deck: deck.slice(5), cards: deck.slice(0, 5), held: [false, false, false, false, false], phase: 'hold', at: room.now() };
  armIdle(room, table, pid);
  return { ok: true };
}

function draw(room, table, pid) {
  const st = table.state, h = st.hands[pid];
  if (!h || h.phase !== 'hold') return { error: 'Deal a hand first.' };
  clearIdle(room, pid);
  h.cards = h.cards.map((c, i) => (h.held[i] ? c : h.deck.shift()));
  const rank = rankOf(h.cards);
  const payout = rank ? h.bet * MULT[rank] : 0;
  h.phase = 'done'; h.rank = rank; h.payout = payout; h.deck = [];
  if (rank === 'royal') room.economy.tagRound(h.id, pid, 'royal');
  const res = room.economy.settleRound(h.id, { [pid]: payout }, { mode: 'house', maxMultiplier: MAX_MULT, memo: `${table.name}: ${nameOf(rank)}` });
  if (res.error) throw new Error(`video poker settlement refused: ${res.error}`);
  const net = payout - h.bet;
  const big = Math.max(2_000, Math.round(room.settings.startingCash * 0.2));
  if (rank && (net >= big || MULT[rank] >= 25)) {
    room.log('win', `${room.get(pid)?.name || 'Someone'} made ${nameOf(rank).toLowerCase()} at ${table.name} and won ${fmt(net)}`, { playerId: pid, amount: net });
    room.hooks.fx(null, { kind: 'big-win', playerId: pid, amount: net, table: table.id });
  }
  return { ok: true };
}

export const videopoker = {
  RULES,
  create() { return { seats: Array(RULES.seats).fill(null), hands: {}, counter: {}, timer: null }; },

  sit(room, table, pid) {
    const st = table.state;
    if (st.seats.includes(pid)) return { ok: true };
    const i = st.seats.indexOf(null);
    if (i < 0) return { error: 'Every machine is taken. Watch, or try another table.' };
    st.seats[i] = pid;
    return { ok: true };
  },

  /** Standing up with a hand open draws it (holding what you held) so the bet settles. */
  leave(room, table, pid) {
    const st = table.state;
    if (st.hands[pid] && st.hands[pid].phase === 'hold') draw(room, table, pid);
    const i = st.seats.indexOf(pid);
    if (i >= 0) st.seats[i] = null;
  },

  command(room, table, pid, cmd) {
    if (room.session.phase !== 'live') return { error: room.session.phase === 'paused' ? 'The session is paused.' : 'The machines are switched off.' };
    const st = table.state, h = st.hands[pid];
    switch (cmd.action) {
      case 'deal': return deal(room, table, pid, cmd);
      case 'hold': {
        if (!st.seats.includes(pid) || !h || h.phase !== 'hold') return { error: 'Deal a hand first.' };
        if (!Number.isInteger(cmd.index) || cmd.index < 0 || cmd.index > 4) return { error: 'Pick one of the five cards.' };
        h.held[cmd.index] = cmd.hold === undefined ? !h.held[cmd.index] : !!cmd.hold;
        armIdle(room, table, pid);
        return { ok: true };
      }
      case 'draw': return st.seats.includes(pid) ? draw(room, table, pid) : { error: 'Take a seat first.' };
      default: return { error: 'Unknown move.' };
    }
  },

  disconnected() {},
  pause(room, table) { for (const pid of Object.keys(table.state.hands)) clearIdle(room, pid); },
  resume(room, table) { for (const [pid, h] of Object.entries(table.state.hands)) if (h.phase === 'hold') armIdle(room, table, pid); },
  close(room, table) { for (const [pid, h] of Object.entries(table.state.hands)) if (h.phase === 'hold') draw(room, table, pid); },

  view(room, table, viewer) {
    const st = table.state, hands = {};
    for (const pid of st.seats) {
      const h = pid && st.hands[pid];
      if (!h) continue;
      const mine = pid === viewer, open = h.phase === 'hold';
      hands[pid] = {
        phase: h.phase, no: h.no, bet: h.bet,
        cards: open && !mine ? [null, null, null, null, null] : h.cards.slice(),
        held: open && !mine ? null : h.held.slice(),
        rank: h.phase === 'done' ? h.rank : null, name: h.phase === 'done' ? nameOf(h.rank) : null, payout: h.phase === 'done' ? h.payout : null,
        net: h.phase === 'done' ? h.payout - h.bet : null,
      };
    }
    const mine = st.hands[viewer];
    return {
      seats: st.seats.slice(), hands, timer: null,
      you: { seated: st.seats.includes(viewer), canDeal: st.seats.includes(viewer) && !(mine && mine.phase === 'hold') && room.session.phase === 'live', holding: !!(mine && mine.phase === 'hold') },
      rules: { paytable: PAYTABLE, idleSec: RULES.idleMs / 1000 },
    };
  },

  snapshot(room, state) { return JSON.parse(JSON.stringify(state)); },
  restore(room, table) { if (room.session.phase === 'live') for (const [pid, h] of Object.entries(table.state.hands)) if (h.phase === 'hold') armIdle(room, table, pid); },
};
