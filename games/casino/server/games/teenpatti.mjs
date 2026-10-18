// Neon Casino — Teen Patti (3 Patti) between players. The casino deals; chips only move between players.
//
// Everyone posts the boot (the table minimum) and gets three cards face down. Playing blind, you bet the current
// stake; once you've seen your cards, you bet double. A raise doubles the stake. With two players left either may ask
// for a show. When the pot reaches the limit (128 boots), everyone still in shows. A player who can't afford the next
// bet may go all in, which ends the betting and shows every hand; side pots keep it fair. Ties split the pot.
// No side shows. Cards stay on the server; a player only receives their own cards after choosing to see them.
import { tableTimers, shuffledDeck, rankValue, sidePots, splitPot, best, fmt } from './kit.mjs';

export const RULES = { seats: 6, turnMs: 25_000, offlineTurnMs: 6_000, resultsMs: 7_000, startMs: 3_000, potLimitBoots: 128 };
export const HAND_NAMES = ['', 'High card', 'Pair', 'Color', 'Sequence', 'Pure sequence', 'Trail'];

/** Comparable key for three cards: [category, tiebreakers…]. Category 6 = trail … 1 = high card. */
export function eval3(cards) {
  const vals = cards.map(rankValue).sort((a, b) => b - a);
  const flush = cards[0][1] === cards[1][1] && cards[1][1] === cards[2][1];
  if (vals[0] === vals[2]) return [6, vals[0]];
  let seq = 0;
  if (vals[0] === 14 && vals[1] === 13 && vals[2] === 12) seq = 15;              // A-K-Q, the top sequence
  else if (vals[0] === 14 && vals[1] === 3 && vals[2] === 2) seq = 14;           // A-2-3, the second
  else if (vals[0] - vals[1] === 1 && vals[1] - vals[2] === 1) seq = vals[0];
  if (seq && flush) return [5, seq];
  if (seq) return [4, seq];
  if (flush) return [3, ...vals];
  if (vals[0] === vals[1]) return [2, vals[0], vals[2]];
  if (vals[1] === vals[2]) return [2, vals[1], vals[0]];
  return [1, ...vals];
}
export const handName = (cards) => HAND_NAMES[eval3(cards)[0]];

const timers = tableTimers((room, table, kind) => {
  if (kind === 'turn') { const h = table.state.hand; if (h && h.turn != null) act(room, table, h.players[h.turn].pid, { action: 'pack' }, true); }
  else if (kind === 'results' || kind === 'start') { table.state.phase = 'waiting'; table.state.hand = null; maybeStart(room, table, true); }
});

function eligible(room, table, pid) {
  const p = room.get(pid), a = room.economy.account(pid);
  return !!(p && a && p.connected && p.status === 'active' && a.cash >= table.minBet * 2 && !a.frozen);
}

function maybeStart(room, table, now = false) {
  const st = table.state;
  if (st.phase !== 'waiting' || room.session.phase !== 'live') return;
  const ready = st.seats.filter((pid) => pid && eligible(room, table, pid));
  if (ready.length < 2) { timers.clear(room, table); return; }
  if (now) startHand(room, table);
  else if (!st.timer) timers.set(room, table, 'start', RULES.startMs);
}

function startHand(room, table) {
  const st = table.state;
  timers.clear(room, table);
  const n = st.seats.length;
  const seatsIn = st.seats.map((pid, i) => (pid && eligible(room, table, pid) ? i : -1)).filter((i) => i >= 0);
  if (seatsIn.length < 2) { st.phase = 'waiting'; return; }
  const after = (from) => Array.from({ length: n }, (_, k) => (from + 1 + k) % n);
  st.dealer = after(st.dealer ?? -1).find((i) => seatsIn.includes(i));
  st.handNo += 1;
  const id = `${room.code}:${table.id}:${room.session.no}:${st.handNo}`;
  if (room.economy.openRound({ roundId: id, game: 'teenpatti', tableId: table.id }).error) return;
  const boot = table.minBet;
  const potLimit = boot * RULES.potLimitBoots;
  const deck = shuffledDeck(room.rng);
  const order = after(st.dealer).filter((i) => seatsIn.includes(i));     // first to act sits left of the dealer
  const h = {
    id, deck, boot, stake: boot, potLimit, seq: 0, log: [], turn: 0,
    players: order.map((seat) => ({ pid: st.seats[seat], seat, cards: [], seen: false, folded: false, allIn: false, contrib: 0,
      stack: Math.min(room.economy.account(st.seats[seat]).cash, potLimit) })),
  };
  st.hand = h;
  st.phase = 'playing';
  st.last = null;
  for (let r = 0; r < 3; r++) for (const p of h.players) p.cards.push(h.deck.pop());
  for (const p of h.players) put(room, table, p, boot, 'boot');
  armTurn(room, table);
}

function put(room, table, p, amount, why) {
  const h = table.state.hand;
  const cash = room.economy.account(p.pid).cash;
  const chips = Math.min(amount, p.stack, cash);
  if (chips > 0) {
    const res = room.economy.reserve({ betId: `${h.id}:${p.pid}:${++h.seq}`, playerId: p.pid, roundId: h.id, amount: chips, memo: `${table.name}: ${why}` });
    if (res.error) { p.stack = 0; return 0; }
    p.stack -= chips; p.contrib += chips;
  }
  p.stack = Math.min(p.stack, cash - chips);
  return chips;
}

const pot = (h) => h.players.reduce((s, p) => s + p.contrib, 0);
const costs = (h, p) => { const chaal = p.seen ? h.stake * 2 : h.stake; return { chaal, raise: chaal * 2, show: chaal }; };

function armTurn(room, table) {
  const h = table.state.hand, p = h.players[h.turn];
  timers.set(room, table, 'turn', room.get(p.pid)?.connected === false ? RULES.offlineTurnMs : RULES.turnMs);
}

function act(room, table, pid, cmd, auto = false) {
  const st = table.state, h = st.hand;
  if (st.phase !== 'playing' || !h) return { error: 'There is no hand to play right now.' };
  const me = h.players.find((q) => q.pid === pid);
  if (!me || me.folded) return { error: 'You\'re not in this hand.' };
  if (cmd.action === 'see') {                              // looking at your cards is allowed any time
    if (me.seen) return { error: 'You\'ve already seen your cards.' };
    me.seen = true;
    h.log.push({ pid, action: 'see' });
    return { ok: true };
  }
  const p = h.players[h.turn];
  if (p.pid !== pid) return { error: 'It isn\'t your turn.' };
  const c = costs(h, p);
  const live = h.players.filter((q) => !q.folded);
  switch (cmd.action) {
    case 'pack': p.folded = true; break;
    case 'chaal':
      if (p.stack < c.chaal) return { error: `Chaal costs ${fmt(c.chaal)}; you can go all in or pack.` };
      put(room, table, p, c.chaal, p.seen ? 'chaal (seen)' : 'chaal (blind)');
      break;
    case 'raise':
      if (p.stack < c.raise) return { error: `A raise costs ${fmt(c.raise)}.` };
      put(room, table, p, c.raise, 'raise');
      h.stake *= 2;
      break;
    case 'show':
      if (live.length !== 2) return { error: 'A show needs exactly two players left.' };
      put(room, table, p, Math.min(c.show, p.stack), 'show');
      h.log.push({ pid, action: 'show', auto });
      showdown(room, table, live);
      return { ok: true };
    case 'allin':
      if (p.stack >= c.chaal) return { error: 'You can afford to chaal — all in is for when you can\'t.' };
      put(room, table, p, p.stack, 'all in');
      p.allIn = true;
      h.log.push({ pid, action: 'allin', auto });
      showdown(room, table, live);
      return { ok: true };
    default: return { error: 'Unknown move.' };
  }
  h.log.push({ pid, action: cmd.action, auto });
  advance(room, table);
  return { ok: true };
}

function advance(room, table) {
  const h = table.state.hand;
  timers.clear(room, table);
  const live = h.players.filter((p) => !p.folded);
  if (live.length === 1) return finish(room, table, live, false);
  if (pot(h) >= h.potLimit) { h.log.push({ action: 'pot-limit' }); return showdown(room, table, live); }
  const n = h.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (h.turn + k) % n;
    if (!h.players[i].folded) { h.turn = i; return armTurn(room, table); }
  }
}

function showdown(room, table, live) { finish(room, table, live, true); }

function finish(room, table, live, shown) {
  const st = table.state, h = st.hand;
  timers.clear(room, table);
  h.turn = null;
  const contrib = Object.fromEntries(h.players.map((p) => [p.pid, p.contrib]));
  // Side pots only matter when someone is all in; otherwise every chip (show payments included) goes to the winner.
  const total = Object.values(contrib).reduce((a, b) => a + b, 0);
  const pots = h.players.some((p) => p.allIn) ? sidePots(contrib, new Set(live.map((p) => p.pid))) : [{ amount: total, eligible: live.map((p) => p.pid) }];
  const payouts = {}, potResults = [];
  for (const pt of pots) {
    const contenders = h.players.filter((p) => pt.eligible.includes(p.pid));
    const winners = shown && contenders.length > 1 ? best(contenders, (p) => eval3(p.cards)) : contenders;
    for (const [pid, amt] of Object.entries(splitPot(pt.amount, winners.map((w) => w.pid)))) payouts[pid] = (payouts[pid] || 0) + amt;
    potResults.push({ amount: pt.amount, winners: winners.map((w) => w.pid), hand: shown && contenders.length > 1 ? handName(winners[0].cards) : null });
  }
  st.phase = 'results';
  const res = room.economy.settleRound(h.id, payouts, { mode: 'pool', memo: `${table.name} hand` });
  if (res.error) throw new Error(`teen patti settlement refused: ${res.error}`);
  const per = {};
  for (const x of res.results || []) per[x.playerId] = { staked: x.staked, payout: x.payout, net: x.net, cash: room.economy.account(x.playerId).cash };
  st.last = { handId: h.id, pots: potResults, players: per, shown, hands: shown ? Object.fromEntries(live.map((p) => [p.pid, { cards: p.cards, name: handName(p.cards) }])) : {} };
  const big = Math.max(2_000, Math.round(room.settings.startingCash * 0.2));
  for (const [pid, x] of Object.entries(per)) {
    if (x.net >= big) {
      const pr = potResults.find((q) => q.winners.includes(pid));
      room.log('win', `${room.get(pid)?.name || 'Someone'} won a ${fmt(x.payout)} pot at ${table.name}${pr && pr.hand ? ` with a ${pr.hand.toLowerCase()}` : ''}`, { playerId: pid, amount: x.net });
      room.hooks.fx(null, { kind: 'big-win', playerId: pid, amount: x.net, table: table.id });
    }
  }
  if (room.session.phase === 'live' || room.session.phase === 'paused') timers.set(room, table, 'results', RULES.resultsMs);
}

export const teenpatti = {
  RULES,
  create() { return { phase: 'waiting', seats: Array(RULES.seats).fill(null), dealer: null, handNo: 0, hand: null, last: null, timer: null }; },

  sit(room, table, pid) {
    const st = table.state;
    if (st.seats.includes(pid)) return { ok: true };
    const a = room.economy.account(pid);
    if (!a || a.cash < table.minBet * 2) return { error: `You need at least ${fmt(table.minBet * 2)} to sit at ${table.name}.` };
    const i = st.seats.indexOf(null);
    if (i < 0) return { error: 'This table is full. Watch, or try another table.' };
    st.seats[i] = pid;
    maybeStart(room, table);
    return { ok: true };
  },

  /** Standing up mid-hand packs; chips already in the pot stay there. */
  leave(room, table, pid) {
    const st = table.state, h = st.hand;
    if (st.phase === 'playing' && h) {
      const p = h.players.find((q) => q.pid === pid);
      if (p && !p.folded) {
        if (h.players[h.turn]?.pid === pid) act(room, table, pid, { action: 'pack' }, true);
        else { p.folded = true; const live = h.players.filter((q) => !q.folded); if (live.length === 1) finish(room, table, live, false); }
      }
    }
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

  /** Session ending mid-hand: nobody has won it, so every chip goes back to whoever put it in. */
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
    let c = null;
    if (me && !me.folded) {
      c = costs(h, me);
      if (!me.seen) moves.push('see');
      if (cur === me && room.session.phase === 'live') {
        moves.push('pack');
        if (me.stack >= c.chaal) moves.push('chaal'); else moves.push('allin');
        if (me.stack >= c.raise) moves.push('raise');
        if (h.players.filter((p) => !p.folded).length === 2) moves.push('show');
      }
    }
    return {
      phase: st.phase,
      seats: st.seats.slice(),
      dealer: st.dealer,
      timer: timers.view(st),
      hand: h ? {
        id: h.id, boot: h.boot, stake: h.stake, potLimit: h.potLimit, pot: pot(h), turn: cur ? cur.pid : null,
        players: h.players.map((p) => ({ pid: p.pid, seat: p.seat, seen: p.seen, folded: p.folded, allIn: p.allIn, contrib: p.contrib, stack: p.stack,
          cards: p.pid === viewer && p.seen ? p.cards.slice() : null })),
        log: h.log.slice(-8),
      } : null,
      last: st.last,
      you: me ? { inHand: true, seen: me.seen, folded: me.folded, moves, costs: c, stack: me.stack, hand: me.seen ? handName(me.cards) : null } : { inHand: false, moves: [] },
      seated: st.seats.includes(viewer),
      rules: { boot: table.minBet, potLimit: table.minBet * RULES.potLimitBoots, turnSec: RULES.turnMs / 1000, seats: RULES.seats },
    };
  },

  snapshot(room, state) { return timers.snapshot(room, state); },
  restore(room, table) {
    if (room.session.phase !== 'live') return;
    if (table.state.timer) timers.resume(room, table, 5_000);
    else maybeStart(room, table);
  },
};
