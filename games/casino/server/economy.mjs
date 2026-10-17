// Neon Casino — the shared economy. One wallet per player, an append-only ledger, and bets that settle exactly once.
//
// Every table game moves money only through this module:
//   reserve()      cash → reserved, when a bet is placed
//   settleRound()  reserved → gone, payout → cash, once per round
//   voidRound()    reserved → cash, when a round is cancelled
// Each operation validates everything before it changes anything, so a rejected call leaves no trace.
// Amounts are whole chips. See docs/DESIGN.md for the rules.

export const FIELDS = ['cash', 'reserved', 'debt', 'interest', 'owes', 'owed'];

export const isAmount = (n) => Number.isSafeInteger(n) && n > 0;

export function netWorth(a) {
  return a.cash + a.reserved + a.owed - a.debt - a.interest - a.owes;
}

function blankAccount(playerId) {
  return {
    playerId,
    cash: 0, reserved: 0, debt: 0, interest: 0, owes: 0, owed: 0,
    startingCash: 0, staked: false,
    won: 0, lost: 0, rounds: 0, biggestWin: 0, biggestLoss: 0,
    peakNetWorth: 0, lowNetWorth: 0,
    byGame: {},          // game -> { rounds, won, lost, net }
  };
}

export class Economy {
  constructor({ now = Date.now, session = 1 } = {}) {
    this.now = now;
    this.session = session;
    this.accounts = new Map();
    this.ledger = [];
    this.seq = 0;
    this.bets = new Map();     // betId -> { id, playerId, roundId, amount, state: open | settled | refunded }
    this.rounds = new Map();   // roundId -> { id, game, tableId, state: open | settled | void, bets: [], result }
    this.locked = true;        // no betting until the session is live
    this.house = 0;            // the house's running result from house-banked games (positive = house is up)
    this.archive = [];         // earlier sessions: { session, ledger, accounts }
    this.onSettle = null;      // hook(round) after a round settles
  }

  open(playerId) {
    if (!this.accounts.has(playerId)) this.accounts.set(playerId, blankAccount(playerId));
    return this.accounts.get(playerId);
  }

  account(playerId) { return this.accounts.get(playerId) || null; }

  /** The only place wallet fields change. Throws if a field would go negative: callers validate first. */
  post(playerId, type, deltas, meta = {}) {
    const acct = this.accounts.get(playerId);
    if (!acct) throw new Error(`ledger: no account ${playerId}`);
    const next = {};
    for (const f of FIELDS) {
      const d = deltas[f] || 0;
      if (!Number.isSafeInteger(d)) throw new Error(`ledger: ${f} delta ${d} is not a whole number`);
      next[f] = acct[f] + d;
      if (next[f] < 0) throw new Error(`ledger: ${type} would make ${playerId}.${f} negative`);
    }
    Object.assign(acct, next);
    const entry = { seq: ++this.seq, at: this.now(), session: this.session, playerId, type };
    for (const f of FIELDS) entry[f] = deltas[f] || 0;
    entry.balance = { ...next };
    Object.assign(entry, meta);
    this.ledger.push(entry);
    const nw = netWorth(acct);
    if (nw > acct.peakNetWorth) acct.peakNetWorth = nw;
    if (nw < acct.lowNetWorth) acct.lowNetWorth = nw;
    return entry;
  }

  /** Session starting cash. Once per player per session, so a duplicate start can't pay twice. */
  stake(playerId, amount) {
    if (!isAmount(amount)) return { error: 'Starting cash must be a positive whole number.' };
    const acct = this.open(playerId);
    if (acct.staked) return { error: 'This player already received their starting cash.' };
    acct.staked = true;
    acct.startingCash = amount;
    acct.peakNetWorth = acct.lowNetWorth = amount;
    const entry = this.post(playerId, 'stake', { cash: amount }, { memo: 'Starting cash' });
    return { ok: true, entry };
  }

  openRound({ roundId, game, tableId }) {
    if (typeof roundId !== 'string' || !roundId) return { error: 'Round id required.' };
    if (this.rounds.has(roundId)) return { error: 'That round already exists.' };
    const round = { id: roundId, game: String(game || 'table'), tableId: tableId || null, state: 'open', bets: [], openedAt: this.now(), result: null };
    this.rounds.set(roundId, round);
    return { ok: true, round };
  }

  /** Lock chips for a bet. Idempotent per betId: a retried request returns the original bet. */
  reserve({ betId, playerId, roundId, amount, memo }) {
    if (typeof betId !== 'string' || !betId) return { error: 'Bet id required.' };
    const prior = this.bets.get(betId);
    if (prior) {
      if (prior.playerId === playerId && prior.roundId === roundId && prior.amount === amount) return { ok: true, bet: prior, duplicate: true };
      return { error: 'That bet id is already used.' };
    }
    if (!isAmount(amount)) return { error: 'A bet must be a positive whole number of chips.' };
    const acct = this.accounts.get(playerId);
    if (!acct || !acct.staked) return { error: 'You have no wallet in this session.' };
    if (acct.frozen) return { error: acct.frozen };
    if (this.locked) return { error: 'Betting is closed right now.' };
    const round = this.rounds.get(roundId);
    if (!round || round.state !== 'open') return { error: 'This round is no longer taking bets.' };
    if (amount > acct.cash) return { error: `Not enough cash: you have $${acct.cash.toLocaleString('en-US')} available.` };
    const bet = { id: betId, playerId, roundId, amount, state: 'open' };
    this.bets.set(betId, bet);
    round.bets.push(betId);
    this.post(playerId, 'bet', { cash: -amount, reserved: amount }, { roundId, game: round.game, tableId: round.tableId, memo: memo || `Bet · ${round.game}` });
    return { ok: true, bet };
  }

  /** Per-player stakes still open in a round. */
  stakes(roundId) {
    const round = this.rounds.get(roundId);
    const out = new Map();
    if (!round) return out;
    for (const id of round.bets) {
      const b = this.bets.get(id);
      if (b.state === 'open') out.set(b.playerId, (out.get(b.playerId) || 0) + b.amount);
    }
    return out;
  }

  /**
   * Settle a round once. payouts: { playerId: chipsReturned } (stake included; 0 = lost).
   *   mode 'house': each payout ≤ staked × maxMultiplier; the house covers the difference.
   *   mode 'pool':  Σ payouts must equal Σ stakes; chips only move between players.
   * Players who staked but are missing from payouts lose their stake.
   */
  settleRound(roundId, payouts, { mode, maxMultiplier, memo } = {}) {
    const round = this.rounds.get(roundId);
    if (!round) return { error: 'No such round.' };
    if (round.state === 'settled') return { ok: true, duplicate: true, results: round.result };
    if (round.state !== 'open') return { error: 'This round was cancelled.' };
    if (mode !== 'house' && mode !== 'pool') return { error: 'Settlement mode must be house or pool.' };
    const stakes = this.stakes(roundId);
    const pay = new Map();
    for (const [pid, amt] of Object.entries(payouts || {})) {
      if (!Number.isSafeInteger(amt) || amt < 0) return { error: `Invalid payout ${amt} for ${pid}.` };
      if (!stakes.has(pid)) { if (amt === 0) continue; return { error: `${pid} has no stake in this round.` }; }
      pay.set(pid, amt);
    }
    if (mode === 'house') {
      if (!(maxMultiplier > 0)) return { error: 'House settlement needs a maximum multiplier.' };
      for (const [pid, amt] of pay) if (amt > stakes.get(pid) * maxMultiplier) return { error: `Payout for ${pid} exceeds the table's maximum.` };
    } else {
      const totalIn = [...stakes.values()].reduce((a, b) => a + b, 0);
      const totalOut = [...pay.values()].reduce((a, b) => a + b, 0);
      if (totalIn !== totalOut) return { error: `Pool payouts (${totalOut}) must equal the pot (${totalIn}).` };
    }
    // Validated — now apply.
    const results = [];
    for (const [pid, staked] of stakes) {
      const payout = pay.get(pid) || 0;
      const net = payout - staked;
      this.post(pid, 'settle', { reserved: -staked, cash: payout }, { roundId, game: round.game, tableId: round.tableId, staked, payout, net, memo: memo || `${round.game} result` });
      const acct = this.accounts.get(pid);
      acct.rounds += 1;
      if (net > 0) { acct.won += net; acct.biggestWin = Math.max(acct.biggestWin, net); }
      if (net < 0) { acct.lost += -net; acct.biggestLoss = Math.max(acct.biggestLoss, -net); }
      const g = acct.byGame[round.game] || (acct.byGame[round.game] = { rounds: 0, won: 0, lost: 0, net: 0 });
      g.rounds += 1; g.net += net; if (net > 0) g.won += net; else g.lost += -net;
      if (mode === 'house') this.house -= net;
      results.push({ playerId: pid, staked, payout, net });
    }
    for (const id of round.bets) { const b = this.bets.get(id); if (b.state === 'open') b.state = 'settled'; }
    round.state = 'settled';
    round.result = results;
    round.settledAt = this.now();
    if (this.onSettle) this.onSettle(round);
    return { ok: true, results };
  }

  /** Cancel a round and refund every open bet. Safe to call twice. */
  voidRound(roundId, memo = 'Round cancelled — bet refunded') {
    const round = this.rounds.get(roundId);
    if (!round) return { error: 'No such round.' };
    if (round.state !== 'open') return { ok: true, duplicate: true };
    for (const id of round.bets) {
      const b = this.bets.get(id);
      if (b.state !== 'open') continue;
      b.state = 'refunded';
      this.post(b.playerId, 'refund', { reserved: -b.amount, cash: b.amount }, { roundId, game: round.game, tableId: round.tableId, memo });
    }
    round.state = 'void';
    return { ok: true };
  }

  openRounds() { return [...this.rounds.values()].filter((r) => r.state === 'open'); }

  voidAllOpen(memo) { for (const r of this.openRounds()) this.voidRound(r.id, memo); }

  /** Archive this session and give every listed player a fresh, identical wallet. */
  resetSession(playerIds, startingCash) {
    this.voidAllOpen('Session restarted — bet refunded');
    this.archive.push({ session: this.session, ledger: this.ledger, accounts: [...this.accounts.values()].map((a) => ({ ...a, netWorth: netWorth(a) })) });
    if (this.archive.length > 5) this.archive.shift();
    this.session += 1;
    this.ledger = [];
    this.accounts = new Map();
    this.bets = new Map();
    this.rounds = new Map();
    this.house = 0;
    for (const id of playerIds) this.open(id);
    return { ok: true, session: this.session, startingCash };
  }

  history(playerId, { limit = 100, before = Infinity } = {}) {
    const out = [];
    for (let i = this.ledger.length - 1; i >= 0 && out.length < limit; i--) {
      const e = this.ledger[i];
      if (e.playerId === playerId && e.seq < before) out.push(e);
    }
    return out;
  }

  /** Replays the ledger and checks every invariant. Returns a list of problems (empty = healthy). */
  audit() {
    const problems = [];
    const sums = new Map();
    for (const e of this.ledger) {
      const s = sums.get(e.playerId) || Object.fromEntries(FIELDS.map((f) => [f, 0]));
      for (const f of FIELDS) {
        s[f] += e[f];
        if (s[f] < 0) problems.push(`entry ${e.seq}: ${e.playerId}.${f} went negative`);
        if (s[f] !== e.balance[f]) problems.push(`entry ${e.seq}: ${e.playerId}.${f} balance mismatch`);
      }
      sums.set(e.playerId, s);
    }
    for (const a of this.accounts.values()) {
      const s = sums.get(a.playerId) || Object.fromEntries(FIELDS.map((f) => [f, 0]));
      for (const f of FIELDS) if (s[f] !== a[f]) problems.push(`${a.playerId}.${f} is ${a[f]} but the ledger says ${s[f]}`);
      let open = 0;
      for (const b of this.bets.values()) if (b.playerId === a.playerId && b.state === 'open') open += b.amount;
      if (open !== a.reserved) problems.push(`${a.playerId}.reserved is ${a.reserved} but open bets total ${open}`);
    }
    return problems;
  }

  toJSON() {
    return {
      session: this.session, seq: this.seq, locked: this.locked, house: this.house,
      accounts: [...this.accounts.values()], ledger: this.ledger,
      bets: [...this.bets.values()], rounds: [...this.rounds.values()], archive: this.archive,
    };
  }

  static fromJSON(data, opts = {}) {
    const e = new Economy({ ...opts, session: data.session });
    e.seq = data.seq; e.locked = data.locked; e.house = data.house || 0;
    for (const a of data.accounts) e.accounts.set(a.playerId, a);
    e.ledger = data.ledger;
    for (const b of data.bets) e.bets.set(b.id, b);
    for (const r of data.rounds) e.rounds.set(r.id, r);
    e.archive = data.archive || [];
    return e;
  }
}
