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
const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');

export function netWorth(a) {
  return a.cash + a.reserved + a.owed - a.debt - a.interest - a.owes;
}

function blankAccount(playerId) {
  return {
    playerId,
    cash: 0, reserved: 0, debt: 0, interest: 0, owes: 0, owed: 0,
    startingCash: 0, staked: false,
    won: 0, lost: 0, rounds: 0, biggestWin: 0, biggestLoss: 0,
    wins: 0, losses: 0, pushes: 0, streak: 0, bestStreak: 0,   // streak > 0: wins in a row; < 0: losses in a row
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
    this.house = 0;            // chips the house has taken in minus paid out (games and loans). Σ(cash + reserved) + house = Σ stakes
    this.loans = new Map();    // loanId -> { id, kind: casino | p2p, lender, borrower, principal, due, ratePct, takenAt, dueLive, status }
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

  /** Games mark notable moments on a round before settling it (a natural, a straight-up hit…); achievements read them. */
  tagRound(roundId, playerId, tag) {
    const round = this.rounds.get(roundId);
    if (!round) return;
    round.tags = round.tags || {};
    (round.tags[playerId] = round.tags[playerId] || []).push(tag);
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

  /** Take back one open bet before its round resolves (e.g. "undo" before the wheel spins). */
  cancelBet(betId, memo = 'Bet taken back') {
    const b = this.bets.get(betId);
    if (!b || b.state !== 'open') return { error: 'That bet can\'t be taken back.' };
    const round = this.rounds.get(b.roundId);
    if (!round || round.state !== 'open') return { error: 'That bet can\'t be taken back.' };
    b.state = 'refunded';
    this.post(b.playerId, 'refund', { reserved: -b.amount, cash: b.amount }, { roundId: b.roundId, game: round.game, tableId: round.tableId, memo });
    return { ok: true };
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
      if (net > 0) { acct.won += net; acct.biggestWin = Math.max(acct.biggestWin, net); acct.wins = (acct.wins || 0) + 1; acct.streak = Math.max(0, acct.streak || 0) + 1; }
      if (net < 0) { acct.lost += -net; acct.biggestLoss = Math.max(acct.biggestLoss, -net); acct.losses = (acct.losses || 0) + 1; acct.streak = Math.min(0, acct.streak || 0) - 1; }
      if (net === 0) acct.pushes = (acct.pushes || 0) + 1;
      acct.bestStreak = Math.max(acct.bestStreak || 0, acct.streak);
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

  // ───────────── loans ─────────────
  /** Casino loan: cash and debt rise together, so net worth is unchanged until interest is charged. */
  casinoLoan({ loanId, playerId, amount, ratePct = 0, dueLive = null, memo }) {
    if (typeof loanId !== 'string' || !loanId || this.loans.has(loanId)) return { error: 'Loan id required.' };
    if (!isAmount(amount)) return { error: 'Borrow a positive whole number of chips.' };
    const acct = this.accounts.get(playerId);
    if (!acct || !acct.staked) return { error: 'You have no wallet in this session.' };
    if (acct.frozen) return { error: acct.frozen };
    const loan = { id: loanId, kind: 'casino', lender: null, borrower: playerId, principal: amount, due: amount, ratePct, takenAt: this.now(), dueLive, status: 'open' };
    this.loans.set(loanId, loan);
    this.house -= amount;
    this.post(playerId, 'loan', { cash: amount, debt: amount }, { loanId, memo: memo || 'Casino loan' });
    return { ok: true, loan };
  }

  /** Repay the casino from cash: accrued interest first, then the oldest loans. */
  repayCasino(playerId, amount, memo) {
    const acct = this.accounts.get(playerId);
    if (!acct) return { error: 'You have no wallet in this session.' };
    if (!isAmount(amount)) return { error: 'Repay a positive whole number of chips.' };
    const owed = acct.debt + acct.interest;
    if (!owed) return { error: 'You don\'t owe the casino anything.' };
    if (amount > owed) return { error: `You only owe the casino ${fmt(owed)}.` };
    if (amount > acct.cash) return { error: `Not enough cash: you have ${fmt(acct.cash)} available.` };
    const toInterest = Math.min(amount, acct.interest);
    let toPrincipal = amount - toInterest;
    const touched = [];
    for (const loan of this.casinoLoansOf(playerId)) {
      if (!toPrincipal) break;
      const part = Math.min(loan.due, toPrincipal);
      loan.due -= part; toPrincipal -= part;
      if (!loan.due) loan.status = 'repaid';
      touched.push(loan.id);
    }
    this.house += amount;
    this.post(playerId, 'repay', { cash: -amount, interest: -toInterest, debt: -(amount - toInterest) }, { loans: touched, memo: memo || 'Repaid the casino' });
    return { ok: true, interest: toInterest, principal: amount - toInterest };
  }

  /** Interest owed to the casino. Lowers net worth; moves no cash. */
  chargeInterest(playerId, amount, memo) {
    if (!isAmount(amount)) return { error: 'Interest must be a positive whole number.' };
    if (!this.accounts.has(playerId)) return { error: 'No such wallet.' };
    this.post(playerId, 'interest', { interest: amount }, { memo: memo || 'Casino interest' });
    return { ok: true };
  }

  casinoLoansOf(playerId) {
    return [...this.loans.values()].filter((l) => l.kind === 'casino' && l.borrower === playerId && l.status === 'open').sort((a, b) => a.takenAt - b.takenAt);
  }

  /**
   * Player-to-player loan, already agreed by both sides. The borrower receives `amount` now and owes `total`
   * (amount plus the agreed flat interest). Chips only move between the two players.
   */
  p2pLoan({ loanId, lender, borrower, amount, total, ratePct, dueLive = null }) {
    if (typeof loanId !== 'string' || !loanId || this.loans.has(loanId)) return { error: 'Loan id required.' };
    if (lender === borrower) return { error: 'You can\'t lend to yourself.' };
    if (!isAmount(amount) || !Number.isSafeInteger(total) || total < amount) return { error: 'Invalid loan terms.' };
    const L = this.accounts.get(lender), B = this.accounts.get(borrower);
    if (!L || !L.staked || !B || !B.staked) return { error: 'Both players need a wallet in this session.' };
    if (amount > L.cash) return { error: `The lender only has ${fmt(L.cash)} in cash.` };
    const loan = { id: loanId, kind: 'p2p', lender, borrower, principal: amount, total, due: total, ratePct, takenAt: this.now(), dueLive, status: 'open' };
    this.loans.set(loanId, loan);
    this.post(lender, 'p2p-lend', { cash: -amount, owed: total }, { loanId, counterparty: borrower, memo: 'Lent to a player' });
    this.post(borrower, 'p2p-borrow', { cash: amount, owes: total }, { loanId, counterparty: lender, memo: 'Borrowed from a player' });
    return { ok: true, loan };
  }

  p2pRepay(loanId, amount, memo) {
    const loan = this.loans.get(loanId);
    if (!loan || loan.kind !== 'p2p' || loan.status !== 'open') return { error: 'That loan isn\'t open.' };
    if (!isAmount(amount)) return { error: 'Repay a positive whole number of chips.' };
    if (amount > loan.due) return { error: `Only ${fmt(loan.due)} is left on this loan.` };
    const B = this.accounts.get(loan.borrower);
    if (amount > B.cash) return { error: `Not enough cash: you have ${fmt(B.cash)} available.` };
    loan.due -= amount;
    if (!loan.due) loan.status = 'repaid';
    this.post(loan.borrower, 'p2p-repay', { cash: -amount, owes: -amount }, { loanId, counterparty: loan.lender, memo: memo || 'Repaid a player' });
    this.post(loan.lender, 'p2p-repaid', { cash: amount, owed: -amount }, { loanId, counterparty: loan.borrower, memo: memo || 'A player repaid you' });
    return { ok: true, remaining: loan.due };
  }

  /** At a loan's deadline: take what the borrower's cash can cover. Whatever is left stays owed. */
  collect(loanId) {
    const loan = this.loans.get(loanId);
    if (!loan || loan.status !== 'open') return { ok: true, collected: 0 };
    const B = this.accounts.get(loan.borrower);
    if (loan.kind === 'casino') {
      const want = Math.min(B.cash, loan.due + B.interest);
      if (want) this.repayCasino(loan.borrower, want, 'Collected by the casino at the deadline');
      return { ok: true, collected: want };
    }
    const want = Math.min(B.cash, loan.due);
    if (want) this.p2pRepay(loanId, want, 'Collected at the deadline');
    return { ok: true, collected: want };
  }

  openRounds() { return [...this.rounds.values()].filter((r) => r.state === 'open'); }

  voidAllOpen(memo) { for (const r of this.openRounds()) this.voidRound(r.id, memo); }

  /** Archive this session and give every listed player a fresh, identical wallet. */
  resetSession(playerIds, startingCash) {
    this.voidAllOpen('Session restarted — bet refunded');
    this.archive.push({ session: this.session, ledger: this.ledger, loans: [...this.loans.values()], accounts: [...this.accounts.values()].map((a) => ({ ...a, netWorth: netWorth(a) })) });
    if (this.archive.length > 5) this.archive.shift();
    this.session += 1;
    this.ledger = [];
    this.accounts = new Map();
    this.bets = new Map();
    this.rounds = new Map();
    this.loans = new Map();
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
      let debt = 0, owes = 0, owed = 0;
      for (const l of this.loans.values()) {
        if (l.status !== 'open') continue;
        if (l.kind === 'casino' && l.borrower === a.playerId) debt += l.due;
        if (l.kind === 'p2p' && l.borrower === a.playerId) owes += l.due;
        if (l.kind === 'p2p' && l.lender === a.playerId) owed += l.due;
      }
      if (debt !== a.debt) problems.push(`${a.playerId}.debt is ${a.debt} but open casino loans total ${debt}`);
      if (owes !== a.owes) problems.push(`${a.playerId}.owes is ${a.owes} but open player loans total ${owes}`);
      if (owed !== a.owed) problems.push(`${a.playerId}.owed is ${a.owed} but loans to others total ${owed}`);
    }
    return problems;
  }

  toJSON() {
    return {
      session: this.session, seq: this.seq, locked: this.locked, house: this.house,
      accounts: [...this.accounts.values()], ledger: this.ledger,
      bets: [...this.bets.values()], rounds: [...this.rounds.values()], loans: [...this.loans.values()], archive: this.archive,
    };
  }

  static fromJSON(data, opts = {}) {
    const e = new Economy({ ...opts, session: data.session });
    e.seq = data.seq; e.locked = data.locked; e.house = data.house || 0;
    for (const a of data.accounts) e.accounts.set(a.playerId, a);
    e.ledger = data.ledger;
    for (const b of data.bets) e.bets.set(b.id, b);
    for (const r of data.rounds) e.rounds.set(r.id, r);
    for (const l of data.loans || []) e.loans.set(l.id, l);
    e.archive = data.archive || [];
    return e;
  }
}
