// Neon Casino — the loan desk, player-to-player loans, interest, deadlines and bankruptcy for one room.
//
// Money moves only through room.economy (casinoLoan / repayCasino / chargeInterest / p2pLoan / p2pRepay / collect).
// This module decides who may do what and when. Time here is *live* time: minutes of unpaused play, so interest
// and deadlines stop while the host has the session paused. See docs/DESIGN.md, "Loans and debt" and "Bankruptcy".
import { randomBytes } from 'node:crypto';
import { netWorth } from './economy.mjs';

export const BANK_TICK_MS = 5_000;          // how often interest and deadlines are checked during live play
export const BAILOUT_MS = 60_000;           // an insolvent player has this long to be rescued by a player loan
export const MAX_OFFERS_PER_PLAYER = 6;
const MIN = 60_000;
const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
const isWhole = (n) => Number.isSafeInteger(n);

// ───────────── helpers ─────────────
export function creditAvailable(room, pid) {
  const L = room.settings.loans, a = room.economy.account(pid), p = room.get(pid);
  if (!L.casino || !a || !a.staked || a.frozen || !p || p.status !== 'active') return 0;
  return Math.max(0, Math.min(L.creditLimit - a.debt, L.maxDebt - (a.debt + a.interest + a.owes)));
}

const interestFor = (room, debt) => (debt > 0 && room.settings.loans.interestPct > 0 ? Math.ceil((debt * room.settings.loans.interestPct) / 100) : 0);
export const p2pTotal = (amount, ratePct) => amount + Math.ceil((amount * ratePct) / 100);

function liveDueToWall(room, dueLive) {
  if (dueLive == null) return null;
  return room.now() + Math.max(0, dueLive - room.liveNow());
}

function moneyOpen(room) {
  const ph = room.session.phase;
  return ph === 'live' || ph === 'paused' ? null : { error: 'The loan desk opens when the session starts.' };
}

function name(room, pid) { return room.get(pid)?.name || 'Someone'; }

// ───────────── solvency ─────────────
/**
 * A player is insolvent when nothing is riding on the table, their cash is under the lowest table minimum, and the
 * casino credit they could still draw wouldn't lift them to it. Insolvency starts a bailout clock; if no one lends
 * them enough before it runs out, they're declared bankrupt. The 'floor' rule also bankrupts anyone whose net worth
 * falls to −floor, at once. Debts are never forgiven and no chips are created.
 */
export function isInsolvent(room, pid) {
  const a = room.economy.account(pid), min = room.settings.minBet;
  return !!a && a.reserved === 0 && a.cash < min && a.cash + creditAvailable(room, pid) < min;
}

export function checkSolvency(room, pid) {
  const p = room.get(pid), a = room.economy.account(pid);
  const ph = room.session.phase;
  if (!p || !a || !a.staked || p.status !== 'active' || room.ending || (ph !== 'live' && ph !== 'paused')) return;
  const B = room.settings.bankruptcy;
  if (B.mode === 'floor' && netWorth(a) <= -B.netWorthFloor) return declareBankrupt(room, pid, `net worth fell below ${fmt(-B.netWorthFloor)}`);
  const insolvent = isInsolvent(room, pid);
  if (insolvent && !p.insolvent) {
    p.insolvent = { since: room.now(), leftMs: BAILOUT_MS };
    room.log('broke', `${p.name} is out of chips — ${BAILOUT_MS / 1000}s for someone to lend them a lifeline`, { playerId: pid });
    room.hooks.fx(null, { kind: 'broke', playerId: pid });
    armBailout(room, pid);
  } else if (!insolvent && p.insolvent) {
    clearBailout(room, pid);
    p.insolvent = null;
    room.log('rescued', `${p.name} is back in the game`, { playerId: pid });
  }
}

function armBailout(room, pid) {
  const p = room.get(pid);
  clearBailout(room, pid);
  if (!p || !p.insolvent || room.session.phase !== 'live') return;
  p.insolvent.until = room.now() + p.insolvent.leftMs;
  room.bailoutTimers.set(pid, room.timers.set(() => {
    room.bailoutTimers.delete(pid);
    const q = room.get(pid);
    if (!q || !q.insolvent || q.status !== 'active') return;
    if (isInsolvent(room, pid)) declareBankrupt(room, pid, 'no one bailed them out');
    else { q.insolvent = null; room.log('rescued', `${q.name} is back in the game`, { playerId: pid }); }
    room.sync();
  }, p.insolvent.leftMs));
}

function clearBailout(room, pid) {
  room.timers.clear(room.bailoutTimers.get(pid));
  room.bailoutTimers.delete(pid);
}

export function declareBankrupt(room, pid, why) {
  const p = room.get(pid), a = room.economy.account(pid);
  if (!p || p.status === 'bankrupt') return;
  clearBailout(room, pid);
  p.insolvent = null;
  p.status = 'bankrupt';
  a.frozen = 'You\'re bankrupt. You can watch and chat until the host starts a new session.';
  room.leaveTable(pid);
  for (const [id, o] of room.offers) if (o.lender === pid || o.borrower === pid) room.offers.delete(id);
  const debts = a.debt + a.interest + a.owes;
  room.log('bankrupt', `${p.name} is bankrupt (${why})${debts ? ` with ${fmt(debts)} still owed` : ''}`, { playerId: pid });
  room.hooks.fx(null, { kind: 'bankrupt', playerId: pid });
}

// ───────────── live-time tick: interest and deadlines ─────────────
export function tick(room) {
  if (room.session.phase !== 'live') return;
  const L = room.settings.loans, live = room.liveNow(), e = room.economy;
  const touched = new Set();
  const period = L.interestEveryMin * MIN;
  while (live >= room.session.nextInterestLive) {
    room.session.nextInterestLive += period;
    const charged = [];
    for (const a of e.accounts.values()) {
      const amt = interestFor(room, a.debt);
      if (!amt) continue;
      e.chargeInterest(a.playerId, amt, `Casino interest (${L.interestPct}% of ${fmt(a.debt)})`);
      charged.push(`${name(room, a.playerId)} ${fmt(amt)}`);
      touched.add(a.playerId);
    }
    if (charged.length) room.log('interest', `Interest charged: ${charged.join(', ')}`);
  }
  // Past a deadline the lender (or the casino) takes what the borrower's cash covers, and keeps doing so each tick
  // until the loan is paid. Overdue debt never disappears.
  for (const loan of e.loans.values()) {
    if (loan.status !== 'open' || loan.dueLive == null || live < loan.dueLive) continue;
    const b = e.account(loan.borrower);
    if (!loan.overdue) {
      loan.overdue = true;
      room.log('overdue', `${name(room, loan.borrower)}'s ${loan.kind === 'casino' ? 'casino loan' : `loan from ${name(room, loan.lender)}`} is due`, { playerId: loan.borrower });
    }
    if (b.cash > 0) {
      const { collected } = e.collect(loan.id);
      if (collected) { touched.add(loan.borrower); if (loan.lender) touched.add(loan.lender); }
    }
  }
  for (const pid of touched) checkSolvency(room, pid);
  if (touched.size) room.sync();
}

// ───────────── commands ─────────────
function validTerms(room, { amount, ratePct, termMin }) {
  const L = room.settings.loans;
  if (!isWhole(amount) || amount < 1 || amount > 1_000_000) return 'The amount must be a whole number of chips.';
  if (!isWhole(ratePct) || ratePct < 0 || ratePct > L.p2pMaxPct) return `Interest must be a whole number from 0 to ${L.p2pMaxPct}%.`;
  if (!isWhole(termMin) || termMin < 5 || termMin > 600) return 'The term must be 5 to 600 minutes.';
  return null;
}

/** Everything that must hold for `lender` to lend `amount` (owed back as `total`) to `borrower` right now. */
function p2pBlocker(room, { lender, borrower, amount, ratePct, termMin }) {
  const L = room.settings.loans;
  if (!L.p2p) return 'The host has turned off player loans.';
  const closed = moneyOpen(room); if (closed) return closed.error;
  if (lender === borrower) return 'You can\'t lend to yourself.';
  const lp = room.get(lender), bp = room.get(borrower);
  const la = room.economy.account(lender), ba = room.economy.account(borrower);
  if (!lp || !bp || !la?.staked || !ba?.staked) return 'Both players need a wallet in this session.';
  if (lp.status !== 'active') return `${lp.name} can't lend right now.`;
  if (bp.status !== 'active') return `${bp.name} can't borrow right now.`;
  const terms = validTerms(room, { amount, ratePct, termMin }); if (terms) return terms;
  if (la.debt + la.interest > 0) return `${lp.name} owes the casino and can't lend until that's repaid.`;
  for (const l of room.economy.loans.values()) {
    if (l.status === 'open' && l.kind === 'p2p' && l.borrower === lender && l.lender === borrower) return `${lp.name} still owes ${bp.name} — repay that first.`;
  }
  if (amount > la.cash) return `${lp.name} only has ${fmt(la.cash)} in cash.`;
  const total = p2pTotal(amount, ratePct);
  if (ba.debt + ba.interest + ba.owes + total > L.maxDebt) return `That would take ${bp.name} past the ${fmt(L.maxDebt)} debt limit.`;
  return null;
}

export function command(room, pid, cmd) {
  const p = room.get(pid), e = room.economy, L = room.settings.loans;
  switch (cmd.type) {
    case 'borrow': {
      const closed = moneyOpen(room); if (closed) return closed;
      if (!L.casino) return { error: 'The host has turned off casino loans.' };
      if (p.status === 'bankrupt') return { error: 'Bankrupt players can\'t borrow.' };
      if (p.status !== 'active') return { error: 'Spectators can\'t borrow.' };
      const amount = cmd.amount;
      if (!isWhole(amount) || amount < 1) return { error: 'Borrow a positive whole number of chips.' };
      const left = creditAvailable(room, pid);
      if (amount > left) return { error: left ? `You can borrow up to ${fmt(left)} more.` : 'You\'ve reached your credit limit.' };
      const res = e.casinoLoan({ loanId: room.id('L'), playerId: pid, amount, ratePct: L.interestPct, dueLive: room.liveNow() + L.termMin * MIN });
      if (res.error) return res;
      room.log('loan', `${p.name} borrowed ${fmt(amount)} from the casino`, { playerId: pid, amount });
      checkSolvency(room, pid);
      return { ok: true };
    }
    case 'repay': {
      const closed = moneyOpen(room); if (closed) return closed;
      const res = e.repayCasino(pid, cmd.amount);
      if (res.error) return res;
      const a = e.account(pid);
      if (!a.debt && !a.interest) room.log('repay', `${p.name} paid off the casino`, { playerId: pid });
      checkSolvency(room, pid);
      return { ok: true };
    }
    case 'loan-offer': {
      const to = room.get(cmd.to);
      if (!to || to.id === pid) return { error: 'Pick another player.' };
      const role = cmd.role === 'borrow' ? 'borrow' : 'lend';
      const offer = {
        id: room.id('O'), lender: role === 'lend' ? pid : to.id, borrower: role === 'lend' ? to.id : pid,
        amount: cmd.amount, ratePct: cmd.ratePct, termMin: cmd.termMin, proposer: pid, awaiting: to.id, version: 1, createdAt: room.now(),
      };
      for (const o of room.offers.values()) {
        if ((o.lender === offer.lender && o.borrower === offer.borrower) || (o.lender === offer.borrower && o.borrower === offer.lender)) return { error: `You already have an open offer with ${to.name}.` };
      }
      const mine = [...room.offers.values()].filter((o) => o.lender === pid || o.borrower === pid).length;
      if (mine >= MAX_OFFERS_PER_PLAYER) return { error: 'Too many open loan offers. Settle some first.' };
      const block = p2pBlocker(room, offer);
      if (block) return { error: block };
      room.offers.set(offer.id, offer);
      room.hooks.fx([to.id], { kind: 'loan-offer', from: pid });
      return { ok: true, offerId: offer.id };
    }
    case 'loan-counter': {
      const o = room.offers.get(cmd.offerId);
      if (!o || (o.lender !== pid && o.borrower !== pid)) return { error: 'That offer is gone.' };
      if (o.awaiting !== pid) return { error: 'Waiting for the other player to answer.' };
      const next = { ...o, amount: cmd.amount, ratePct: cmd.ratePct, termMin: cmd.termMin };
      const block = p2pBlocker(room, next);
      if (block) return { error: block };
      Object.assign(o, { amount: next.amount, ratePct: next.ratePct, termMin: next.termMin, version: o.version + 1, awaiting: o.lender === pid ? o.borrower : o.lender });
      room.hooks.fx([o.awaiting], { kind: 'loan-offer', from: pid });
      return { ok: true };
    }
    case 'loan-accept': {
      const o = room.offers.get(cmd.offerId);
      if (!o || (o.lender !== pid && o.borrower !== pid)) return { error: 'That offer is gone.' };
      if (o.awaiting !== pid) return { error: 'Waiting for the other player to answer.' };
      if (cmd.version !== o.version) return { error: 'The terms just changed. Check them again before accepting.' };
      const block = p2pBlocker(room, o);
      if (block) return { error: block };
      const total = p2pTotal(o.amount, o.ratePct);
      const res = e.p2pLoan({ loanId: room.id('P'), lender: o.lender, borrower: o.borrower, amount: o.amount, total, ratePct: o.ratePct, dueLive: room.liveNow() + o.termMin * MIN });
      if (res.error) return res;
      room.offers.delete(o.id);
      room.log('loan', `${name(room, o.lender)} lent ${name(room, o.borrower)} ${fmt(o.amount)} — ${fmt(total)} due in ${o.termMin} min`, { playerId: o.borrower, amount: o.amount });
      checkSolvency(room, o.borrower);
      checkSolvency(room, o.lender);
      return { ok: true, loanId: res.loan.id };
    }
    case 'loan-decline': {
      const o = room.offers.get(cmd.offerId);
      if (!o || (o.lender !== pid && o.borrower !== pid)) return { error: 'That offer is gone.' };
      room.offers.delete(o.id);
      return { ok: true };
    }
    case 'loan-repay': {
      const closed = moneyOpen(room); if (closed) return closed;
      const loan = e.loans.get(cmd.loanId);
      if (!loan || loan.kind !== 'p2p' || loan.borrower !== pid) return { error: 'That isn\'t your loan.' };
      const res = e.p2pRepay(loan.id, cmd.amount);
      if (res.error) return res;
      if (!res.remaining) room.log('repay', `${p.name} paid back ${name(room, loan.lender)} in full`, { playerId: pid });
      checkSolvency(room, pid);
      checkSolvency(room, loan.lender);
      return { ok: true };
    }
    default:
      return null;
  }
}

// ───────────── lifecycle hooks used by room.mjs ─────────────
export function armTick(room) {
  stopTick(room);
  if (room.session.phase !== 'live') return;
  const loop = () => { room.bankTimer = room.timers.set(() => { room.bankTimer = null; tick(room); if (room.session.phase === 'live') loop(); }, BANK_TICK_MS); };
  loop();
}
export function stopTick(room) { room.timers.clear(room.bankTimer); room.bankTimer = null; }

export function pause(room) {
  stopTick(room);
  for (const p of room.humans()) {
    if (!p.insolvent) continue;
    clearBailout(room, p.id);
    if (p.insolvent.until) p.insolvent.leftMs = Math.max(1_000, p.insolvent.until - room.now());
    p.insolvent.until = null;
  }
}

export function resume(room) {
  armTick(room);
  for (const p of room.humans()) if (p.insolvent) armBailout(room, p.id);
}

export function stopAll(room) {
  stopTick(room);
  for (const pid of [...room.bailoutTimers.keys()]) clearBailout(room, pid);
  for (const p of room.humans()) p.insolvent = null;
  room.offers.clear();
}

/** Debts that are still open at the end of a session, for the final settlement. */
export function openDebts(room) {
  const out = [];
  for (const a of room.economy.accounts.values()) if (a.debt + a.interest > 0) out.push({ kind: 'casino', borrower: a.playerId, lender: null, due: a.debt + a.interest });
  for (const l of room.economy.loans.values()) if (l.kind === 'p2p' && l.status === 'open') out.push({ kind: 'p2p', borrower: l.borrower, lender: l.lender, due: l.due, overdue: !!l.overdue });
  return out.sort((x, y) => y.due - x.due);
}

// ───────────── views ─────────────
export function publicView(room) {
  return {
    debts: [...room.economy.loans.values()].filter((l) => l.kind === 'p2p' && l.status === 'open')
      .map((l) => ({ id: l.id, lender: l.lender, borrower: l.borrower, due: l.due, dueAt: liveDueToWall(room, l.dueLive), overdue: !!l.overdue })),
  };
}

export function viewFor(room, pid) {
  const e = room.economy, a = e.account(pid), L = room.settings.loans;
  if (!a || !a.staked) return null;
  const live = room.session.phase === 'live';
  const loanView = (l) => ({ id: l.id, kind: l.kind, lender: l.lender, borrower: l.borrower, principal: l.principal, total: l.total ?? l.principal, due: l.due,
    ratePct: l.ratePct, takenAt: l.takenAt, dueAt: liveDueToWall(room, l.dueLive), overdue: !!l.overdue, status: l.status });
  const mine = [...e.loans.values()].filter((l) => l.borrower === pid || l.lender === pid).sort((x, y) => y.takenAt - x.takenAt);
  return {
    creditAvailable: creditAvailable(room, pid),
    rules: { casino: L.casino, creditLimit: L.creditLimit, maxDebt: L.maxDebt, interestPct: L.interestPct, interestEveryMin: L.interestEveryMin, termMin: L.termMin, p2p: L.p2p, p2pMaxPct: L.p2pMaxPct },
    nextInterestAt: live || room.session.phase === 'paused' ? room.now() + Math.max(0, room.session.nextInterestLive - room.liveNow()) : null,
    nextInterest: interestFor(room, a.debt),
    clockRunning: live,
    loans: mine.filter((l) => l.status === 'open').map(loanView),
    closedLoans: mine.filter((l) => l.status !== 'open').slice(0, 10).map(loanView),
    offers: [...room.offers.values()].filter((o) => o.lender === pid || o.borrower === pid)
      .map((o) => ({ ...o, total: p2pTotal(o.amount, o.ratePct) })),
  };
}
