// Neon Casino — pieces shared by table engines: pausable table timers, decks, and pot splitting.

/**
 * Table timers. Handles live in room.tableTimers (never saved); the saved state holds { kind, endsAt | remainingMs, ms }.
 * `fire(room, table, kind)` is called when a timer runs out.
 */
export function tableTimers(fire) {
  const t = {
    set(room, table, kind, ms) {
      t.clear(room, table);
      const st = table.state;
      st.timer = { kind, endsAt: room.now() + ms, ms };
      if (room.session.phase !== 'live') { st.timer.remainingMs = ms; st.timer.endsAt = null; return; }
      room.tableTimers.set(table.id, room.timers.set(() => {
        room.tableTimers.delete(table.id);
        if (st.timer && st.timer.kind === kind) { st.timer = null; fire(room, table, kind); room.sync(); }
      }, ms));
    },
    clear(room, table) {
      room.timers.clear(room.tableTimers.get(table.id));
      room.tableTimers.delete(table.id);
      table.state.timer = null;
    },
    pause(room, table) {
      const tm = table.state.timer;
      room.timers.clear(room.tableTimers.get(table.id));
      room.tableTimers.delete(table.id);
      if (tm && tm.endsAt) { tm.remainingMs = Math.max(0, tm.endsAt - room.now()); tm.endsAt = null; }
    },
    resume(room, table, minMs = 0) {
      const tm = table.state.timer;
      if (!tm) return;
      t.set(room, table, tm.kind, Math.max(minMs, tm.remainingMs ?? tm.ms));
    },
    snapshot(room, state) {
      const copy = JSON.parse(JSON.stringify(state));
      if (copy.timer && copy.timer.endsAt) { copy.timer.remainingMs = Math.max(0, copy.timer.endsAt - room.now()); copy.timer.endsAt = null; }
      return copy;
    },
    view(st) { return st.timer ? { kind: st.timer.kind, endsAt: st.timer.endsAt, remainingMs: st.timer.remainingMs ?? null, ms: st.timer.ms } : null; },
  };
  return t;
}

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['S', 'H', 'D', 'C'];
export const rankValue = (card) => RANKS.indexOf(card[0]) + 2;   // 2..14

/** A freshly shuffled 52-card deck (Fisher–Yates with the room's RNG). */
export function shuffledDeck(rng) {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(r + s);
  for (let i = deck.length - 1; i > 0; i--) { const j = rng(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}

/**
 * Main and side pots from what each player put in. Folded players' chips stay in the pots but they can't win them.
 * contrib: { pid: chips }, live: Set of pids still in the hand. Returns [{ amount, eligible: [pid] }] smallest first.
 * A pot only one player is eligible for (an uncalled bet) simply goes back to that player.
 */
export function sidePots(contrib, live) {
  const levels = [...new Set(Object.entries(contrib).filter(([pid, c]) => live.has(pid) && c > 0).map(([, c]) => c))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    for (const c of Object.values(contrib)) amount += Math.max(0, Math.min(c, level) - prev);
    const eligible = Object.keys(contrib).filter((pid) => live.has(pid) && contrib[pid] >= level);
    if (amount) pots.push({ amount, eligible });
    prev = level;
  }
  // Chips above the highest live contribution (a folded player who put in more than anyone still live) join the last pot.
  const total = Object.values(contrib).reduce((a, b) => a + b, 0);
  const counted = pots.reduce((a, p) => a + p.amount, 0);
  if (total > counted && pots.length) pots[pots.length - 1].amount += total - counted;
  return pots;
}

/** Split a pot between winners (already in seat order from the button). Odd chips go to the first winners. */
export function splitPot(amount, winners) {
  const out = {};
  const share = Math.floor(amount / winners.length);
  let odd = amount - share * winners.length;
  for (const w of winners) { out[w] = share + (odd > 0 ? 1 : 0); odd--; }
  return out;
}

/** Best entries of a list by a comparable key array. */
export function best(list, keyOf) {
  let top = [], topKey = null;
  for (const x of list) {
    const k = keyOf(x);
    const c = topKey ? compareKeys(k, topKey) : 1;
    if (c > 0) { top = [x]; topKey = k; } else if (c === 0) top.push(x);
  }
  return top;
}

export function compareKeys(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

export const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
