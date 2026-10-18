// Neon Casino — blackjack. One engine object drives every blackjack table in a room.
//
// The table's state is plain JSON (saved with the room). The shoe and the dealer's hole card stay here; views only
// show what a player at the table could see. Money moves only through room.economy: a bet reserves chips, a double
// or split reserves more, and the round settles once with house payouts capped at 2.5× the stake.
//
// Rules: 6 decks, reshuffled when 75% has been dealt. Dealer peeks for blackjack with an ace or ten showing and
// stands on soft 17. Blackjack pays 3:2 (rounded down to a whole chip). Double on any first two cards, including
// after a split. Split equal ranks up to four hands; split aces get one card each, and 21 on a split hand is not a
// blackjack. No insurance or surrender.

export const RULES = {
  decks: 6,
  penetration: 0.75,
  seats: 5,
  maxHands: 4,
  bettingMs: 15_000,     // after the first bet, the others have this long before the deal
  turnMs: 20_000,        // per decision; a hand that runs out of time stands
  resultsMs: 5_000,      // results stay on the felt before the next round
  maxMultiplier: 2.5,
};

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];

export function cardValue(card) {
  const r = card[0];
  if (r === 'A') return 11;
  if (r === 'T' || r === 'J' || r === 'Q' || r === 'K') return 10;
  return Number(r);
}

/** { total, soft } — soft means an ace is still counted as 11. */
export function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) { total += cardValue(c); if (c[0] === 'A') aces++; }
  while (total > 21 && aces) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}

export const isNatural = (hand) => hand.cards.length === 2 && !hand.fromSplit && handValue(hand.cards).total === 21;

export function newShoe(rng, decks = RULES.decks) {
  const shoe = [];
  for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) shoe.push(r + s);
  for (let i = shoe.length - 1; i > 0; i--) { const j = rng(i + 1); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; }   // Fisher–Yates
  return shoe;
}

/** Chips returned for one finished hand (stake included). */
export function handPayout(hand, dealerCards) {
  const me = handValue(hand.cards).total;
  const dealer = handValue(dealerCards).total;
  const dealerBJ = dealerCards.length === 2 && dealer === 21;
  if (me > 21) return { result: 'bust', payout: 0 };
  if (isNatural(hand)) return dealerBJ ? { result: 'push', payout: hand.bet } : { result: 'blackjack', payout: hand.bet + Math.floor(hand.bet * 1.5) };
  if (dealerBJ) return { result: 'lose', payout: 0 };
  if (dealer > 21 || me > dealer) return { result: 'win', payout: hand.bet * 2 };
  if (me === dealer) return { result: 'push', payout: hand.bet };
  return { result: 'lose', payout: 0 };
}

const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');

// ───────────── timers (handles live outside the saved state) ─────────────
function setTimer(room, table, kind, ms, fn) {
  clearTimer(room, table);
  const st = table.state;
  st.timer = { kind, endsAt: room.now() + ms, ms };
  if (room.session.phase !== 'live') { st.timer.remainingMs = ms; st.timer.endsAt = null; return; }   // paused: armed on resume
  room.tableTimers.set(table.id, room.timers.set(() => {
    room.tableTimers.delete(table.id);
    if (st.timer && st.timer.kind === kind) { st.timer = null; fn(); room.sync(); }
  }, ms));
}
function clearTimer(room, table) {
  room.timers.clear(room.tableTimers.get(table.id));
  room.tableTimers.delete(table.id);
  table.state.timer = null;
}
function fire(room, table, kind) {
  if (kind === 'betting') deal(room, table);
  else if (kind === 'turn') { const h = currentHand(table); if (h) { h.done = true; h.timedOut = true; } advance(room, table); }
  else if (kind === 'results') nextRound(room, table);
}

// ───────────── round flow ─────────────
function draw(room, table) {
  const st = table.state;
  if (!st.shoe.length) { st.shoe = newShoe(room.rng); st.shuffles += 1; }
  return st.shoe.pop();
}

function currentHand(table) {
  const r = table.state.round;
  return r && r.turn != null ? r.hands[r.turn] : null;
}

function seatedIds(table) { return table.state.seats.filter(Boolean); }

/** Seated players the betting clock should wait for: online, playing, able to cover the minimum, not yet bet. */
function stillToBet(room, table) {
  const r = table.state.round;
  return seatedIds(table).filter((id) => {
    const p = room.get(id), a = room.economy.account(id);
    return !(r && r.bets[id]) && p && p.connected && p.status === 'active' && a && a.cash >= table.minBet;
  });
}

function openRound(room, table) {
  const st = table.state;
  st.roundNo += 1;
  const id = `${room.code}:${table.id}:${room.session.no}:${st.roundNo}`;
  const res = room.economy.openRound({ roundId: id, game: 'blackjack', tableId: table.id });
  if (res.error) return res;
  st.round = { id, bets: {}, hands: [], dealer: [], turn: null, holeHidden: true };
  st.phase = 'betting';
  st.last = null;
  return { ok: true };
}

function placeBet(room, table, pid, amount) {
  const st = table.state;
  if (!st.seats.includes(pid)) return { error: 'Take a seat to bet.' };
  if (st.phase !== 'idle' && st.phase !== 'betting') return { error: 'Wait for the next round to bet.' };
  if (!Number.isSafeInteger(amount)) return { error: 'Bets are whole chips.' };
  if (amount < table.minBet || amount > table.maxBet) return { error: `Bets at this table are ${fmt(table.minBet)} to ${fmt(table.maxBet)}.` };
  if (st.round && st.round.bets[pid]) return { error: 'Your bet is already down for this round.' };
  if (!st.round) { const o = openRound(room, table); if (o.error) return o; }
  const res = room.economy.reserve({ betId: `${st.round.id}:${pid}:0`, playerId: pid, roundId: st.round.id, amount, memo: `${table.name} bet` });
  if (res.error) { if (!Object.keys(st.round.bets).length) { room.economy.voidRound(st.round.id); st.round = null; st.phase = 'idle'; } return res; }
  st.round.bets[pid] = amount;
  const waiting = stillToBet(room, table);
  if (!waiting.length) deal(room, table);
  else if (!st.timer) setTimer(room, table, 'betting', RULES.bettingMs, () => fire(room, table, 'betting'));
  return { ok: true };
}

function deal(room, table) {
  const st = table.state, r = st.round;
  clearTimer(room, table);
  if (!r) return;
  const bettors = st.seats.filter((id) => id && r.bets[id]);
  // A bettor who stood up before the deal still plays: the bet is committed. Their hand is placed after the seated ones.
  for (const id of Object.keys(r.bets)) if (!bettors.includes(id)) bettors.push(id);
  if (!bettors.length) { room.economy.voidRound(r.id); st.round = null; st.phase = 'idle'; return; }
  if (st.shoe.length < RULES.decks * 52 * (1 - RULES.penetration)) { st.shoe = newShoe(room.rng); st.shuffles += 1; }
  r.hands = bettors.map((id) => ({ owner: id, cards: [], bet: r.bets[id], betIds: [`${r.id}:${id}:0`], doubled: false, fromSplit: false, splitAces: false, done: false }));
  for (let pass = 0; pass < 2; pass++) { for (const h of r.hands) h.cards.push(draw(room, table)); r.dealer.push(draw(room, table)); }
  st.phase = 'playing';
  for (const h of r.hands) {
    if (!st.seats.includes(h.owner)) h.done = true;               // left the table: stands
    if (handValue(h.cards).total === 21) h.done = true;           // blackjack plays itself
  }
  const up = r.dealer[0];
  if ((up[0] === 'A' || cardValue(up) === 10) && handValue(r.dealer).total === 21) {
    r.holeHidden = false;
    r.dealerPeek = true;
    for (const h of r.hands) h.done = true;
    return finish(room, table);
  }
  r.turn = -1;
  advance(room, table);
}

function advance(room, table) {
  const st = table.state, r = st.round;
  clearTimer(room, table);
  const next = r.hands.findIndex((h, i) => i > r.turn && !h.done);
  const again = r.turn >= 0 && r.hands[r.turn] && !r.hands[r.turn].done ? r.turn : -1;   // same hand still playing (after a hit or split)
  const idx = again >= 0 ? again : next;
  if (idx < 0) { r.turn = null; return dealerPlays(room, table); }
  r.turn = idx;
  setTimer(room, table, 'turn', RULES.turnMs, () => fire(room, table, 'turn'));
}

function dealerPlays(room, table) {
  const r = table.state.round;
  r.holeHidden = false;
  const live = r.hands.some((h) => handValue(h.cards).total <= 21 && !isNatural(h));
  if (live) {
    while (handValue(r.dealer).total < 17) r.dealer.push(draw(room, table));   // stands on all 17s, soft included
  }
  finish(room, table);
}

function finish(room, table) {
  const st = table.state, r = st.round;
  r.turn = null;
  r.holeHidden = false;
  const payouts = {};
  for (const h of r.hands) {
    const { result, payout } = handPayout(h, r.dealer);
    h.result = result;
    h.payout = payout;
    payouts[h.owner] = (payouts[h.owner] || 0) + payout;
  }
  st.phase = 'results';
  for (const h of r.hands) if (h.result === 'blackjack') room.economy.tagRound(r.id, h.owner, 'natural');
  const res = room.economy.settleRound(r.id, payouts, { mode: 'house', maxMultiplier: RULES.maxMultiplier, memo: `${table.name} result` });
  if (res.error) throw new Error(`blackjack settlement refused: ${res.error}`);
  const per = {};
  for (const x of res.results || []) per[x.playerId] = { staked: x.staked, payout: x.payout, net: x.net, cash: room.economy.account(x.playerId).cash };
  st.last = { roundId: r.id, dealer: r.dealer.slice(), dealerTotal: handValue(r.dealer).total, hands: r.hands.map(publicHand), players: per, at: room.now() };
  // Notable moments for the feed and the win moment: naturals and wins of at least 20% of the starting cash.
  const big = Math.max(2_000, Math.round(room.settings.startingCash * 0.2));
  for (const [pid, x] of Object.entries(per)) {
    const p = room.get(pid);
    const natural = r.hands.some((h) => h.owner === pid && h.result === 'blackjack');
    if (x.net >= big) room.log('win', `${p?.name || 'Someone'} won ${fmt(x.net)} at ${table.name}${natural ? ' with a blackjack' : ''}`, { playerId: pid, amount: x.net });
    else if (natural) room.log('win', `${p?.name || 'Someone'} hit blackjack at ${table.name}`, { playerId: pid });
    if (x.net >= big || natural) room.hooks.fx(null, { kind: 'big-win', playerId: pid, amount: x.net, table: table.id, blackjack: natural });
  }
  if (room.session.phase === 'live' || room.session.phase === 'paused') setTimer(room, table, 'results', RULES.resultsMs, () => fire(room, table, 'results'));
}

function nextRound(room, table) {
  const st = table.state;
  clearTimer(room, table);
  st.round = null;
  st.phase = 'idle';
}

function act(room, table, pid, action) {
  const st = table.state, r = st.round;
  if (st.phase !== 'playing' || !r) return { error: 'There is no hand to play right now.' };
  const h = currentHand(table);
  if (!h || h.owner !== pid) return { error: 'It isn\'t your turn.' };
  const two = h.cards.length === 2;
  switch (action) {
    case 'hit':
      h.cards.push(draw(room, table));
      if (handValue(h.cards).total >= 21) h.done = true;
      break;
    case 'stand':
      h.done = true;
      break;
    case 'double': {
      if (!two || h.splitAces) return { error: 'You can only double on your first two cards.' };
      const res = room.economy.reserve({ betId: `${r.id}:${pid}:${h.betIds.length}:${r.turn}`, playerId: pid, roundId: r.id, amount: h.bet, memo: `${table.name} double down` });
      if (res.error) return res;
      h.betIds.push(res.bet.id);
      h.bet *= 2;
      h.doubled = true;
      h.cards.push(draw(room, table));
      h.done = true;
      break;
    }
    case 'split': {
      if (!two || h.cards[0][0] !== h.cards[1][0]) return { error: 'You can only split two cards of the same rank.' };
      if (r.hands.filter((x) => x.owner === pid).length >= RULES.maxHands) return { error: `At most ${RULES.maxHands} hands.` };
      const res = room.economy.reserve({ betId: `${r.id}:${pid}:split:${r.hands.length}`, playerId: pid, roundId: r.id, amount: h.bet, memo: `${table.name} split` });
      if (res.error) return res;
      const aces = h.cards[0][0] === 'A';
      const second = { owner: pid, cards: [h.cards.pop()], bet: h.bet, betIds: [res.bet.id], doubled: false, fromSplit: true, splitAces: aces, done: false };
      h.fromSplit = true;
      h.splitAces = aces;
      h.cards.push(draw(room, table));
      second.cards.push(draw(room, table));
      r.hands.splice(r.turn + 1, 0, second);
      for (const x of [h, second]) if (aces || handValue(x.cards).total === 21) x.done = true;
      break;
    }
    default:
      return { error: 'Unknown move.' };
  }
  advance(room, table);
  return { ok: true };
}

function publicHand(h) {
  const v = handValue(h.cards);
  return { owner: h.owner, cards: h.cards.slice(), bet: h.bet, total: v.total, soft: v.soft, doubled: h.doubled, fromSplit: h.fromSplit, done: h.done, timedOut: !!h.timedOut, result: h.result || null, payout: h.payout ?? null };
}

// ───────────── engine interface used by room.mjs ─────────────
export const blackjack = {
  RULES,
  create() {
    return { phase: 'idle', seats: Array(RULES.seats).fill(null), shoe: [], shuffles: 0, roundNo: 0, round: null, last: null, timer: null };
  },

  sit(room, table, pid) {
    const st = table.state;
    if (st.seats.includes(pid)) return { ok: true };
    const a = room.economy.account(pid);
    if (table.highRoller && (!a || a.cash < table.minBet)) return { error: `The high-roller table needs at least ${fmt(table.minBet)} in cash to sit.` };
    const i = st.seats.indexOf(null);
    if (i < 0) return { error: 'This table is full. Watch, or try another table.' };
    st.seats[i] = pid;
    return { ok: true };
  },

  /** Standing up never cancels money already on the felt: open hands stand, a placed bet still plays. */
  leave(room, table, pid) {
    const st = table.state;
    const i = st.seats.indexOf(pid);
    if (i >= 0) st.seats[i] = null;
    if (st.phase === 'playing' && st.round) {
      for (const h of st.round.hands) if (h.owner === pid) h.done = true;
      const cur = currentHand(table);
      if (cur && cur.owner === pid) advance(room, table);
    }
    if (st.phase === 'betting' && st.round) {
      const waiting = stillToBet(room, table);
      if (!waiting.length && Object.keys(st.round.bets).length) deal(room, table);
      else if (!Object.keys(st.round.bets).length && !seatedIds(table).length) { room.economy.voidRound(st.round.id); clearTimer(room, table); st.round = null; st.phase = 'idle'; }
    }
  },

  command(room, table, pid, cmd) {
    if (room.session.phase !== 'live') return { error: room.session.phase === 'paused' ? 'The session is paused.' : 'The tables are closed.' };
    if (cmd.action === 'bet') return placeBet(room, table, pid, cmd.amount);
    return act(room, table, pid, cmd.action);
  },

  /** A player's connection dropped: if everyone else has bet, don't make the table wait for them. */
  disconnected(room, table) {
    const st = table.state;
    if (st.phase === 'betting' && st.round) {
      const waiting = stillToBet(room, table);
      if (!waiting.length && Object.keys(st.round.bets).length) deal(room, table);
    }
  },

  pause(room, table) {
    const st = table.state;
    const t = st.timer;
    room.timers.clear(room.tableTimers.get(table.id));
    room.tableTimers.delete(table.id);
    if (t && t.endsAt) { t.remainingMs = Math.max(0, t.endsAt - room.now()); t.endsAt = null; }
  },

  resume(room, table) {
    const t = table.state.timer;
    if (!t) return;
    const kind = t.kind;
    const ms = t.kind === 'turn' ? Math.max(t.remainingMs ?? t.ms, 5_000) : (t.remainingMs ?? t.ms);
    setTimer(room, table, kind, ms, () => fire(room, table, kind));
  },

  /** Session ending: a dealt round is played out (open hands stand) and paid; undealt bets are refunded. */
  close(room, table) {
    const st = table.state;
    if (st.phase === 'betting' && st.round) { room.economy.voidRound(st.round.id, `${table.name}: session ended before the deal — bet refunded`); }
    else if (st.phase === 'playing' && st.round) { for (const h of st.round.hands) h.done = true; st.round.turn = null; dealerPlays(room, table); }
    clearTimer(room, table);
    if (st.phase !== 'results') { st.round = null; st.phase = 'idle'; }
  },

  view(room, table, viewer) {
    const st = table.state, r = st.round;
    const hands = r ? r.hands.map(publicHand) : [];
    const dealer = r ? (r.holeHidden && r.dealer.length ? [r.dealer[0], null] : r.dealer.slice()) : [];
    const shown = dealer.filter(Boolean);
    const cur = currentHand(table);
    const mine = cur && cur.owner === viewer ? cur : null;
    const acct = room.economy.account(viewer);
    const moves = [];
    if (mine && room.session.phase === 'live') {
      moves.push('hit', 'stand');
      if (mine.cards.length === 2 && !mine.splitAces && acct && acct.cash >= mine.bet) moves.push('double');
      if (mine.cards.length === 2 && mine.cards[0][0] === mine.cards[1][0] && acct && acct.cash >= mine.bet && r.hands.filter((x) => x.owner === viewer).length < RULES.maxHands) moves.push('split');
    }
    return {
      phase: st.phase,
      seats: st.seats.slice(),
      timer: st.timer ? { kind: st.timer.kind, endsAt: st.timer.endsAt, remainingMs: st.timer.remainingMs ?? null, ms: st.timer.ms } : null,
      round: r ? { id: r.id, bets: { ...r.bets }, hands, turn: r.turn, dealer, dealerTotal: shown.length ? handValue(shown).total : null, dealerSoft: shown.length ? handValue(shown).soft : false, dealerPeek: !!r.dealerPeek } : null,
      last: st.last,
      shoe: { remaining: st.shoe.length, size: RULES.decks * 52 },
      rules: { decks: RULES.decks, seats: RULES.seats, maxHands: RULES.maxHands, bettingSec: RULES.bettingMs / 1000, turnSec: RULES.turnMs / 1000, blackjackPays: '3:2', dealerStandsOn: 'all 17s' },
      you: {
        seated: st.seats.includes(viewer),
        canBet: st.seats.includes(viewer) && (st.phase === 'idle' || st.phase === 'betting') && !(r && r.bets[viewer]) && room.session.phase === 'live',
        moves,
      },
    };
  },

  /** Saved state keeps time left rather than a wall-clock deadline. */
  snapshot(room, state) {
    const copy = JSON.parse(JSON.stringify(state));
    if (copy.timer && copy.timer.endsAt) { copy.timer.remainingMs = Math.max(0, copy.timer.endsAt - room.now()); copy.timer.endsAt = null; }
    return copy;
  },

  /** After a restore from disk: re-arm whichever timer was running. */
  restore(room, table) {
    if (table.state.timer && room.session.phase === 'live') this.resume(room, table);
  },
};
