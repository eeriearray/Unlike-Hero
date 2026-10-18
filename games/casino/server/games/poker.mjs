// Neon Casino — no-limit Texas Hold'em between players. The casino deals; chips only move between players.
//
// Stacks come straight from the shared wallet: each hand a player can risk up to min(cash, table maximum), and every
// chip they put in is reserved in the economy. The hand settles once as a pool (Σ payouts = Σ stakes) using main and
// side pots. Hole cards and the deck never leave the server until showdown.
//
// Rules: blinds are half the table minimum and the table minimum; heads-up the button posts the small blind and acts
// first before the flop. A raise must be at least the previous bet or raise; an all-in for less doesn't reopen raising
// to players who already acted. A stalled turn checks if it can, otherwise folds.
import { tableTimers, shuffledDeck, rankValue, sidePots, splitPot, best, compareKeys, fmt } from './kit.mjs';

export const RULES = { seats: 6, turnMs: 25_000, offlineTurnMs: 6_000, resultsMs: 7_000, startMs: 3_000 };
export const HAND_NAMES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];

// ───────────── hand evaluation ─────────────
/** Comparable key for exactly five cards: [category, tiebreakers…]. */
export function eval5(cards) {
  const vals = cards.map(rankValue).sort((a, b) => b - a);
  const flush = cards.every((c) => c[1] === cards[0][1]);
  const uniq = [...new Set(vals)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (vals[0] - vals[4] === 4) straightHigh = vals[0];
    else if (vals[0] === 14 && vals[1] === 5) straightHigh = 5;            // A-2-3-4-5
  }
  const counts = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  const groups = Object.entries(counts).map(([v, n]) => [n, Number(v)]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const byGroup = groups.map((g) => g[1]);
  if (straightHigh && flush) return [8, straightHigh];
  if (groups[0][0] === 4) return [7, ...byGroup];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, ...byGroup];
  if (flush) return [5, ...vals];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][0] === 3) return [3, ...byGroup];
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, ...byGroup];
  if (groups[0][0] === 2) return [1, ...byGroup];
  return [0, ...vals];
}

/** Best five of five to seven cards: { key, cards, name }. */
export function bestHand(cards) {
  let top = null;
  const pick = (start, chosen) => {
    if (chosen.length === 5) {
      const key = eval5(chosen);
      if (!top || compareKeys(key, top.key) > 0) top = { key, cards: chosen.slice() };
      return;
    }
    for (let i = start; i <= cards.length - (5 - chosen.length); i++) { chosen.push(cards[i]); pick(i + 1, chosen); chosen.pop(); }
  };
  pick(0, []);
  top.name = top.key[0] === 8 && top.key[1] === 14 ? 'Royal flush' : HAND_NAMES[top.key[0]];
  return top;
}

// ───────────── table flow ─────────────
const timers = tableTimers((room, table, kind) => {
  if (kind === 'turn') autoAct(room, table);
  else if (kind === 'results' || kind === 'start') { table.state.phase = 'waiting'; table.state.hand = null; maybeStart(room, table, true); }
});

const blinds = (table) => ({ sb: Math.max(1, Math.floor(table.minBet / 2)), bb: table.minBet });

function eligible(room, table, pid) {
  const p = room.get(pid), a = room.economy.account(pid);
  return !!(p && a && p.connected && p.status === 'active' && a.cash >= blinds(table).bb && !a.frozen);
}

function maybeStart(room, table, now = false) {
  const st = table.state;
  if (st.phase !== 'waiting' || room.session.phase !== 'live') return;
  const ready = st.seats.filter((pid) => pid && eligible(room, table, pid));
  if (ready.length < 2) { timers.clear(room, table); return; }
  if (now) startHand(room, table);
  else if (!st.timer) timers.set(room, table, 'start', RULES.startMs);
}

/** Seats from `from` (exclusive) going clockwise. */
function seatOrder(st, from) {
  const out = [];
  for (let k = 1; k <= st.seats.length; k++) out.push((from + k) % st.seats.length);
  return out;
}

function startHand(room, table) {
  const st = table.state;
  timers.clear(room, table);
  const seatsIn = st.seats.map((pid, i) => (pid && eligible(room, table, pid) ? i : -1)).filter((i) => i >= 0);
  if (seatsIn.length < 2) { st.phase = 'waiting'; return; }
  // Move the button to the next seat in the hand.
  st.button = seatOrder(st, st.button ?? -1).find((i) => seatsIn.includes(i));
  st.handNo += 1;
  const id = `${room.code}:${table.id}:${room.session.no}:${st.handNo}`;
  const opened = room.economy.openRound({ roundId: id, game: 'poker', tableId: table.id });
  if (opened.error) return;
  const order = [st.button, ...seatOrder(st, st.button)].filter((i, k, arr) => seatsIn.includes(i) && arr.indexOf(i) === k);
  const deck = shuffledDeck(room.rng);
  const { sb, bb } = blinds(table);
  const h = {
    id, deck, board: [], street: 'preflop', currentBet: 0, minRaise: bb, sb, bb, seq: 0, log: [],
    players: order.map((seat) => {
      const pid = st.seats[seat];
      return { pid, seat, hole: [], stack: Math.min(room.economy.account(pid).cash, table.maxBet), contrib: 0, street: 0, folded: false, allIn: false, acted: false, mayRaise: true };
    }),
    turn: null,
  };
  st.hand = h;
  st.phase = 'playing';
  st.last = null;
  for (let r = 0; r < 2; r++) for (const p of h.players) p.hole.push(h.deck.pop());
  // Blinds: heads-up the button is the small blind; otherwise the two players after the button.
  const n = h.players.length;
  const sbIdx = n === 2 ? 0 : 1, bbIdx = n === 2 ? 1 : 2 % n;
  put(room, table, h.players[sbIdx], sb, 'small blind');
  put(room, table, h.players[bbIdx], bb, 'big blind');
  h.currentBet = Math.max(...h.players.map((p) => p.street));
  h.minRaise = bb;
  h.turn = nextToAct(h, bbIdx);
  if (h.turn == null) return runOut(room, table);
  armTurn(room, table);
}

/** Move chips from a player's stack into the pot (reserved in the shared wallet). */
function put(room, table, p, amount, why) {
  const h = table.state.hand;
  const cash = room.economy.account(p.pid).cash;     // the wallet can shrink mid-hand (a loan deadline), so re-check it
  const chips = Math.min(amount, p.stack, cash);
  if (chips > 0) {
    const res = room.economy.reserve({ betId: `${h.id}:${p.pid}:${++h.seq}`, playerId: p.pid, roundId: h.id, amount: chips, memo: `${table.name}: ${why}` });
    if (res.error) { p.stack = 0; p.allIn = true; return 0; }
    p.stack -= chips; p.contrib += chips; p.street += chips;
  }
  p.stack = Math.min(p.stack, cash - chips);
  if (p.stack <= 0) { p.stack = 0; p.allIn = true; }
  return chips;
}

const canAct = (p) => !p.folded && !p.allIn;

function nextToAct(h, fromIdx) {
  const n = h.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (fromIdx + k) % n, p = h.players[i];
    if (canAct(p) && (!p.acted || p.street < h.currentBet)) return i;
  }
  return null;
}

function armTurn(room, table) {
  const h = table.state.hand, p = h.players[h.turn];
  timers.set(room, table, 'turn', room.get(p.pid)?.connected === false ? RULES.offlineTurnMs : RULES.turnMs);
}

function autoAct(room, table) {
  const h = table.state.hand;
  if (!h || h.turn == null) return;
  const p = h.players[h.turn];
  act(room, table, p.pid, { action: p.street >= h.currentBet ? 'check' : 'fold' }, true);
}

function act(room, table, pid, cmd, auto = false) {
  const st = table.state, h = st.hand;
  if (st.phase !== 'playing' || !h || h.turn == null) return { error: 'There is no hand to play right now.' };
  const p = h.players[h.turn];
  if (p.pid !== pid) return { error: 'It isn\'t your turn.' };
  const toCall = h.currentBet - p.street;
  switch (cmd.action) {
    case 'fold': p.folded = true; break;
    case 'check':
      if (toCall > 0) return { error: `You need to call ${fmt(toCall)}, raise or fold.` };
      break;
    case 'call':
      if (toCall <= 0) return { error: 'Nothing to call — check instead.' };
      put(room, table, p, toCall, 'call');
      break;
    case 'raise':
    case 'allin': {
      const max = p.street + p.stack;
      const to = cmd.action === 'allin' ? max : cmd.to;
      if (!Number.isSafeInteger(to)) return { error: 'Raise to a whole number of chips.' };
      if (to <= h.currentBet) {
        if (cmd.action === 'allin' && to > p.street) { put(room, table, p, to - p.street, 'all in'); break; }   // all-in to call less
        return { error: `Raise to more than ${fmt(h.currentBet)}.` };
      }
      if (to > max) return { error: `You can put in at most ${fmt(max)} this hand.` };
      if (!p.mayRaise) return { error: 'You can only call or fold — the last all-in wasn\'t a full raise.' };
      const raiseBy = to - h.currentBet;
      const full = raiseBy >= h.minRaise;
      if (!full && to < max) return { error: `The minimum raise is to ${fmt(h.currentBet + h.minRaise)}.` };
      put(room, table, p, to - p.street, cmd.action === 'allin' ? 'all in' : h.currentBet ? 'raise' : 'bet');
      h.currentBet = to;
      for (const q of h.players) {
        if (q === p || !canAct(q)) continue;
        if (full) { q.acted = false; q.mayRaise = true; }
        else { if (q.acted) q.mayRaise = false; q.acted = false; }
      }
      if (full) h.minRaise = raiseBy;
      break;
    }
    default:
      return { error: 'Unknown move.' };
  }
  p.acted = true;
  h.log.push({ pid, action: cmd.action, street: h.street, to: p.street, auto });
  advance(room, table);
  return { ok: true };
}

function advance(room, table) {
  const h = table.state.hand;
  timers.clear(room, table);
  const live = h.players.filter((p) => !p.folded);
  if (live.length === 1) return finish(room, table, live);
  const idx = nextToAct(h, h.turn ?? -1);
  if (idx != null) { h.turn = idx; return armTurn(room, table); }
  // Betting round over.
  if (h.street === 'river') return showdown(room, table);
  nextStreet(h);
  if (h.players.filter(canAct).length <= 1 && live.every((p) => p.allIn || p.street >= h.currentBet)) return runOut(room, table);
  h.turn = nextToAct(h, 0);                        // after the flop the first player left of the button acts first
  if (h.turn == null) return runOut(room, table);
  armTurn(room, table);
}

function nextStreet(h) {
  const deal = { preflop: 3, flop: 1, turn: 1 }[h.street];
  h.street = { preflop: 'flop', flop: 'turn', turn: 'river' }[h.street];
  for (let i = 0; i < deal; i++) h.board.push(h.deck.pop());
  h.currentBet = 0;
  h.minRaise = h.bb;
  for (const p of h.players) { p.street = 0; p.acted = false; p.mayRaise = true; }
}

/** Nobody left who can bet: deal the rest of the board and show down. */
function runOut(room, table) {
  const h = table.state.hand;
  while (h.street !== 'river') nextStreet(h);
  showdown(room, table);
}

function showdown(room, table) {
  const h = table.state.hand;
  const live = h.players.filter((p) => !p.folded);
  for (const p of live) p.best = bestHand([...p.hole, ...h.board]);
  finish(room, table, live, true);
}

function finish(room, table, live, shown = false) {
  const st = table.state, h = st.hand;
  timers.clear(room, table);
  h.turn = null;
  const contrib = Object.fromEntries(h.players.map((p) => [p.pid, p.contrib]));
  const liveSet = new Set(live.map((p) => p.pid));
  const pots = sidePots(contrib, liveSet);
  const payouts = {};
  const potResults = [];
  // Seat order from the left of the button, for odd chips.
  const order = h.players.slice(1).concat(h.players.slice(0, 1));
  for (const pot of pots) {
    const contenders = order.filter((p) => pot.eligible.includes(p.pid));
    const winners = shown && contenders.length > 1 ? best(contenders, (p) => p.best.key) : contenders;
    const split = splitPot(pot.amount, winners.map((w) => w.pid));
    for (const [pid, amt] of Object.entries(split)) payouts[pid] = (payouts[pid] || 0) + amt;
    potResults.push({ amount: pot.amount, winners: winners.map((w) => w.pid), hand: shown && contenders.length > 1 ? winners[0].best.name : null, uncalled: pot.eligible.length === 1 && live.length > 1 });
  }
  st.phase = 'results';
  if (shown) for (const p of live) if (p.best.key[0] >= 7 && (payouts[p.pid] || 0) > p.contrib) room.economy.tagRound(h.id, p.pid, 'monster');
  const res = room.economy.settleRound(h.id, payouts, { mode: 'pool', memo: `${table.name} hand` });
  if (res.error) throw new Error(`poker settlement refused: ${res.error}`);
  const per = {};
  for (const x of res.results || []) per[x.playerId] = { staked: x.staked, payout: x.payout, net: x.net, cash: room.economy.account(x.playerId).cash };
  st.last = {
    handId: h.id, board: h.board.slice(), pots: potResults, players: per, shown,
    hands: shown ? Object.fromEntries(live.map((p) => [p.pid, { hole: p.hole, name: p.best.name, cards: p.best.cards }])) : {},
  };
  const big = Math.max(2_000, Math.round(room.settings.startingCash * 0.2));
  for (const [pid, x] of Object.entries(per)) {
    if (x.net >= big) {
      const pot = potResults.find((pr) => pr.winners.includes(pid));
      room.log('win', `${room.get(pid)?.name || 'Someone'} won a ${fmt(x.payout)} pot at ${table.name}${pot && pot.hand ? ` with ${pot.hand.toLowerCase()}` : ''}`, { playerId: pid, amount: x.net });
      room.hooks.fx(null, { kind: 'big-win', playerId: pid, amount: x.net, table: table.id });
    }
  }
  if (room.session.phase === 'live' || room.session.phase === 'paused') timers.set(room, table, 'results', RULES.resultsMs);
}

function foldOut(room, table, pid) {
  const h = table.state.hand;
  if (table.state.phase !== 'playing' || !h) return;
  const p = h.players.find((q) => q.pid === pid);
  if (!p || p.folded) return;
  if (h.players[h.turn]?.pid === pid) { act(room, table, pid, { action: 'fold' }, true); return; }
  p.folded = true;
  const live = h.players.filter((q) => !q.folded);
  if (live.length === 1) finish(room, table, live);
}

export const poker = {
  RULES,
  create() { return { phase: 'waiting', seats: Array(RULES.seats).fill(null), button: null, handNo: 0, hand: null, last: null, timer: null }; },

  sit(room, table, pid) {
    const st = table.state;
    if (st.seats.includes(pid)) return { ok: true };
    const a = room.economy.account(pid);
    if (!a || a.cash < blinds(table).bb) return { error: `You need at least ${fmt(blinds(table).bb)} to sit at ${table.name}.` };
    const i = st.seats.indexOf(null);
    if (i < 0) return { error: 'This table is full. Watch, or try another table.' };
    st.seats[i] = pid;
    maybeStart(room, table);
    return { ok: true };
  },

  /** Standing up mid-hand folds; chips already in the pot stay there. */
  leave(room, table, pid) {
    const st = table.state;
    foldOut(room, table, pid);
    const i = st.seats.indexOf(pid);
    if (i >= 0) st.seats[i] = null;
  },

  command(room, table, pid, cmd) {
    if (room.session.phase !== 'live') return { error: room.session.phase === 'paused' ? 'The session is paused.' : 'The tables are closed.' };
    if (cmd.action === 'deal') { maybeStart(room, table, true); return { ok: true }; }
    return act(room, table, pid, cmd);
  },

  disconnected(room, table, pid) {
    const h = table.state.hand;
    if (h && h.turn != null && h.players[h.turn].pid === pid) timers.set(room, table, 'turn', RULES.offlineTurnMs);
  },
  pause(room, table) { timers.pause(room, table); },
  resume(room, table) { timers.resume(room, table, table.state.timer && table.state.timer.kind === 'turn' ? 5_000 : 0); maybeStart(room, table); },

  /** Session ending mid-hand: nobody has won it yet, so every chip in the pot goes back to whoever put it in. */
  close(room, table) {
    const st = table.state;
    if (st.phase === 'playing' && st.hand) room.economy.voidRound(st.hand.id, `${table.name}: session ended mid-hand — chips returned`);
    timers.clear(room, table);
    if (st.phase !== 'results') { st.hand = null; st.phase = 'waiting'; }
  },

  view(room, table, viewer) {
    const st = table.state, h = st.hand;
    const me = h && h.players.find((p) => p.pid === viewer);
    const cur = h && h.turn != null ? h.players[h.turn] : null;
    const moves = [];
    if (cur && cur.pid === viewer && room.session.phase === 'live') {
      const toCall = h.currentBet - cur.street, max = cur.street + cur.stack;
      moves.push('fold');
      moves.push(toCall > 0 ? 'call' : 'check');
      if (max > h.currentBet && cur.mayRaise) moves.push('raise');
      moves.push('allin');
    }
    return {
      phase: st.phase,
      seats: st.seats.slice(),
      button: st.button,
      timer: timers.view(st),
      hand: h ? {
        id: h.id, street: h.street, board: h.board.slice(), currentBet: h.currentBet, minRaise: h.minRaise, sb: h.sb, bb: h.bb,
        pot: h.players.reduce((s, p) => s + p.contrib, 0),
        turn: cur ? cur.pid : null,
        players: h.players.map((p) => ({ pid: p.pid, seat: p.seat, stack: p.stack, contrib: p.contrib, street: p.street, folded: p.folded, allIn: p.allIn, cards: p.hole.length,
          hole: p.pid === viewer ? p.hole.slice() : null })),
        log: h.log.slice(-8),
      } : null,
      last: st.last,
      you: me ? {
        inHand: true, folded: me.folded, moves, toCall: Math.max(0, h.currentBet - me.street), stack: me.stack, street: me.street,
        minRaiseTo: Math.min(me.street + me.stack, h.currentBet + h.minRaise), maxRaiseTo: me.street + me.stack,
        best: h.board.length >= 3 ? bestHand([...me.hole, ...h.board]).name : null,
      } : { inHand: false, moves: [] },
      seated: st.seats.includes(viewer),
      rules: { sb: blinds(table).sb, bb: blinds(table).bb, maxIn: table.maxBet, turnSec: RULES.turnMs / 1000, seats: RULES.seats },
    };
  },

  /** Someone still in the hand is all in (the floor and watchers see the table as hot). */
  allIn(room, table) { const st = table.state; return st.phase === 'playing' && !!st.hand && st.hand.players.some((p) => p.allIn && !p.folded); },

  snapshot(room, state) { return timers.snapshot(room, state); },
  restore(room, table) {
    if (room.session.phase !== 'live') return;
    if (table.state.timer) timers.resume(room, table, 5_000);
    else maybeStart(room, table);
  },
};
