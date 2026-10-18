// Neon Casino — the social layer for one room: achievements, head-to-head challenges, who's watching which table,
// hot tables, player profiles and the session history. Achievements are awarded only from real, settled results;
// challenges move money through the economy like any table (both stakes reserved, settled once as a pool).
import { netWorth } from './economy.mjs';
import { shuffledDeck, rankValue, fmt } from './games/kit.mjs';

export const ACHIEVEMENTS = {
  'first-win': { name: 'First blood', desc: 'Win your first round.', icon: '🎯' },
  jackpot: { name: 'Jackpot', desc: 'Win half your starting cash or more in a single round.', icon: '💰' },
  natural: { name: 'Natural', desc: 'Hit a blackjack.', icon: '🂡' },
  'straight-up': { name: 'Bullseye', desc: 'Hit a straight-up number at roulette.', icon: '🎡' },
  monster: { name: 'Monster hand', desc: 'Win a poker pot with four of a kind or better.', icon: '🃏' },
  trail: { name: 'Trail blazer', desc: 'Win a Teen Patti pot with a trail.', icon: '🔥' },
  'on-fire': { name: 'On fire', desc: 'Win five rounds in a row.', icon: '⚡' },
  whale: { name: 'Whale', desc: 'Put the table maximum into a single round.', icon: '🐋' },
  'high-roller': { name: 'High roller', desc: 'Win a round at the high-roller table.', icon: '👑' },
  'grand-tour': { name: 'Grand tour', desc: 'Play a round of every casino game.', icon: '🧭' },
  comeback: { name: 'Comeback kid', desc: 'Climb back above your starting cash after falling below half of it.', icon: '🚀' },
  bailout: { name: 'Lifeline', desc: 'Get bailed out by another player while out of chips.', icon: '🛟' },
  'clean-slate': { name: 'Clean slate', desc: 'Pay off the casino in full.', icon: '🧾' },
  'loan-shark': { name: 'Loan shark', desc: 'Get paid back a player loan with interest.', icon: '🦈' },
  duelist: { name: 'Duelist', desc: 'Win a private challenge.', icon: '⚔️' },
  survivor: { name: 'Survivor', desc: 'Finish a session solvent after dropping below a quarter of your starting cash.', icon: '🛡️' },
  champion: { name: 'Champion', desc: 'Win the session.', icon: '🏆' },
};
export const DUELS = {
  highcard: { name: 'High card', desc: 'Each of you draws a card; the higher card wins. Ties draw again.' },
  dice: { name: 'Dice', desc: 'Each of you rolls two dice; the higher total wins. Ties roll again.' },
  coin: { name: 'Coin flip', desc: 'The challenger calls heads; the coin decides.' },
};
const CHALLENGE_TTL_MS = 60_000;
const GAMES = ['blackjack', 'roulette', 'poker', 'teenpatti'];

export const bigAmount = (room) => Math.max(2_000, Math.round(room.settings.startingCash * 0.2));

// ───────────── achievements ─────────────
export function award(room, pid, id) {
  if (!ACHIEVEMENTS[id] || !room.get(pid)) return false;
  const list = room.achievements[pid] || (room.achievements[pid] = []);
  if (list.some((a) => a.id === id)) return false;
  list.push({ id, at: room.now() });
  const a = ACHIEVEMENTS[id];
  room.log('achievement', `${room.get(pid).name} unlocked ${a.icon} ${a.name}`, { playerId: pid, achievement: id });
  room.hooks.fx(null, { kind: 'achievement', playerId: pid, id });
  return true;
}

/** After every settled round: stats-based achievements, game tags, big losses. */
export function onRound(room, round) {
  if (room.session.phase !== 'live' && room.session.phase !== 'paused') return;
  const start = room.settings.startingCash;
  const cfg = round.tableId ? room.table(round.tableId) : null;
  for (const r of round.result || []) {
    const pid = r.playerId, a = room.economy.account(pid);
    if (!a) continue;
    if (r.net > 0) award(room, pid, 'first-win');
    if (r.net >= start * 0.5) award(room, pid, 'jackpot');
    if ((a.streak || 0) >= 5) award(room, pid, 'on-fire');
    if (cfg && r.staked >= cfg.maxBet) award(room, pid, 'whale');
    if (cfg && cfg.highRoller && r.net > 0) award(room, pid, 'high-roller');
    if (GAMES.every((g) => a.byGame[g] && a.byGame[g].rounds > 0)) award(room, pid, 'grand-tour');
    if (a.lowNetWorth < start * 0.5 && netWorth(a) > start) award(room, pid, 'comeback');
    for (const tag of (round.tags && round.tags[pid]) || []) award(room, pid, tag);
    if (r.net <= -bigAmount(room) && round.game !== 'duel') room.hooks.fx([pid], { kind: 'big-loss', playerId: pid, amount: r.net });
  }
}

/** Events from the bank and the session that unlock achievements. */
export function onEvent(room, kind, data) {
  if (kind === 'rescued') award(room, data.playerId, 'bailout');
  else if (kind === 'casino-paid-off') award(room, data.playerId, 'clean-slate');
  else if (kind === 'p2p-repaid' && data.interest > 0) award(room, data.lender, 'loan-shark');
  else if (kind === 'session-end') {
    const s = data.summary;
    for (const id of s.winners) award(room, id, 'champion');
    for (const row of s.rows) if (row.status !== 'bankrupt' && row.lowNetWorth <= row.startingCash * 0.25) award(room, row.id, 'survivor');
  }
}

// ───────────── challenges ─────────────
function resolveDuel(room, game, a, b) {
  if (game === 'coin') {
    const side = room.rng(2) ? 'heads' : 'tails';
    return { winner: side === 'heads' ? a : b, draws: { coin: side } };
  }
  for (let tries = 0; tries < 20; tries++) {
    if (game === 'dice') {
      const ra = [1 + room.rng(6), 1 + room.rng(6)], rb = [1 + room.rng(6), 1 + room.rng(6)];
      const sa = ra[0] + ra[1], sb = rb[0] + rb[1];
      if (sa !== sb) return { winner: sa > sb ? a : b, draws: { [a]: ra, [b]: rb } };
    } else {
      const deck = shuffledDeck(room.rng);
      const ca = deck.pop(), cb = deck.pop();
      if (rankValue(ca) !== rankValue(cb)) return { winner: rankValue(ca) > rankValue(cb) ? a : b, draws: { [a]: ca, [b]: cb } };
    }
  }
  return { winner: room.rng(2) ? a : b, draws: {} };                     // astronomically unlikely
}

function challengeBlocker(room, from, to, amount) {
  const ph = room.session.phase;
  if (ph !== 'live') return ph === 'paused' ? 'The session is paused.' : 'Challenges open when the session starts.';
  const A = room.get(from), B = room.get(to);
  if (!B || from === to) return 'Pick another player.';
  if (A.status !== 'active') return 'You can\'t challenge anyone right now.';
  if (B.status !== 'active') return `${B.name} can't take challenges right now.`;
  const { minBet, maxBet } = room.settings;
  if (!Number.isSafeInteger(amount) || amount < minBet || amount > maxBet) return `Stakes run from ${fmt(minBet)} to ${fmt(maxBet)}.`;
  if (room.economy.account(from).cash < amount) return `You only have ${fmt(room.economy.account(from).cash)} in cash.`;
  if (room.economy.account(to).cash < amount) return `${B.name} doesn't have ${fmt(amount)} in cash.`;
  return null;
}

function expire(room, id) {
  room.timers.clear(room.challengeTimers.get(id));
  room.challengeTimers.delete(id);
  room.challenges.delete(id);
}

export function command(room, pid, cmd) {
  switch (cmd.type) {
    case 'challenge': {
      const game = DUELS[cmd.game] ? cmd.game : null;
      if (!game) return { error: 'Pick high card, dice or a coin flip.' };
      const block = challengeBlocker(room, pid, cmd.to, cmd.amount);
      if (block) return { error: block };
      for (const c of room.challenges.values()) if ((c.from === pid && c.to === cmd.to) || (c.from === cmd.to && c.to === pid)) return { error: 'You already have a challenge open with them.' };
      const c = { id: room.id('X'), from: pid, to: cmd.to, game, amount: cmd.amount, at: room.now(), expiresAt: room.now() + CHALLENGE_TTL_MS };
      room.challenges.set(c.id, c);
      room.challengeTimers.set(c.id, room.timers.set(() => { if (room.challenges.has(c.id)) { expire(room, c.id); room.sync(); } }, CHALLENGE_TTL_MS));
      room.hooks.fx([cmd.to], { kind: 'challenge', from: pid, game, amount: cmd.amount });
      return { ok: true, challengeId: c.id };
    }
    case 'challenge-accept': {
      const c = room.challenges.get(cmd.challengeId);
      if (!c || c.to !== pid) return { error: 'That challenge is gone.' };
      const block = challengeBlocker(room, c.from, c.to, c.amount);
      if (block) return { error: block };
      const e = room.economy;
      const roundId = `${room.code}:duel:${c.id}`;
      const opened = e.openRound({ roundId, game: 'duel', tableId: null });
      if (opened.error) return opened;
      const ra = e.reserve({ betId: `${roundId}:${c.from}`, playerId: c.from, roundId, amount: c.amount, memo: `${DUELS[c.game].name} challenge` });
      if (ra.error) { e.voidRound(roundId); return { error: ra.error }; }
      const rb = e.reserve({ betId: `${roundId}:${c.to}`, playerId: c.to, roundId, amount: c.amount, memo: `${DUELS[c.game].name} challenge` });
      if (rb.error) { e.voidRound(roundId); return { error: rb.error }; }
      expire(room, c.id);
      const { winner, draws } = resolveDuel(room, c.game, c.from, c.to);
      const loser = winner === c.from ? c.to : c.from;
      const res = e.settleRound(roundId, { [winner]: c.amount * 2, [loser]: 0 }, { mode: 'pool', memo: `${DUELS[c.game].name} challenge` });
      if (res.error) throw new Error(`duel settlement refused: ${res.error}`);
      const result = { id: c.id, game: c.game, amount: c.amount, from: c.from, to: c.to, winner, draws, at: room.now() };
      room.duels.unshift(result);
      room.duels.length = Math.min(room.duels.length, 20);
      room.log('duel', `${room.get(winner).name} beat ${room.get(loser).name} at ${DUELS[c.game].name.toLowerCase()} for ${fmt(c.amount)}`, { playerId: winner, amount: c.amount });
      award(room, winner, 'duelist');
      room.hooks.fx(null, { kind: 'duel', ...result });
      return { ok: true, result };
    }
    case 'challenge-decline': {
      const c = room.challenges.get(cmd.challengeId);
      if (!c || (c.to !== pid && c.from !== pid)) return { error: 'That challenge is gone.' };
      expire(room, c.id);
      return { ok: true };
    }
    case 'watch': {
      const p = room.get(pid);
      p.watching = cmd.tableId && room.table(cmd.tableId) ? cmd.tableId : null;
      return { ok: true };
    }
    case 'stats':
      return profile(room, cmd.playerId);
    case 'session-history':
      return sessionHistory(room);
    default:
      return null;
  }
}

export function clearChallenges(room) {
  for (const id of [...room.challenges.keys()]) expire(room, id);
}

// ───────────── tables: watchers and heat ─────────────
export function tableSocial(room, cfg, players) {
  const watchers = players.filter((p) => room.get(p.id)?.watching === cfg.id && p.tableId !== cfg.id && p.connected).map((p) => p.id);
  const t = room.table(cfg.id);
  let hot = null;
  if (t) {
    const open = room.economy.openRounds().filter((r) => r.tableId === cfg.id);
    const total = open.reduce((s, r) => s + [...room.economy.stakes(r.id).values()].reduce((a, b) => a + b, 0), 0);
    if (t.engine.allIn && t.engine.allIn(room, t)) hot = { label: 'All in!', amount: total };
    else if (total >= bigAmount(room)) hot = { label: 'Big money on the felt', amount: total };
  }
  return { watchers, hot };
}

// ───────────── profiles and history ─────────────
/** Net worth after each ledger entry for one player, thinned to at most `points` samples. */
export function trail(room, pid, points = 60) {
  const a = room.economy.account(pid);
  if (!a || !a.staked) return [];
  const out = [];
  for (const e of room.economy.ledger) {
    if (e.playerId !== pid) continue;
    const b = e.balance;
    out.push([e.at, b.cash + b.reserved + b.owed - b.debt - b.interest - b.owes]);
  }
  if (out.length <= points) return out;
  const step = (out.length - 1) / (points - 1);
  return Array.from({ length: points }, (_, i) => out[Math.round(i * step)]);
}

export function profile(room, pid) {
  const p = room.get(pid), a = room.economy.account(pid);
  if (!p) return { error: 'No such player.' };
  const ach = room.achievements[pid] || [];
  return {
    ok: true,
    profile: {
      id: p.id, name: p.name, avatar: p.avatar, status: p.status, tableId: p.tableId, joinedAt: p.joinedAt,
      stats: a && a.staked ? {
        startingCash: a.startingCash, cash: a.cash, netWorth: netWorth(a), profit: netWorth(a) - a.startingCash,
        debt: a.debt + a.interest, owes: a.owes, owed: a.owed,
        rounds: a.rounds, wins: a.wins || 0, losses: a.losses || 0, pushes: a.pushes || 0,
        won: a.won, lost: a.lost, biggestWin: a.biggestWin, biggestLoss: a.biggestLoss,
        streak: a.streak || 0, bestStreak: a.bestStreak || 0, peak: a.peakNetWorth, low: a.lowNetWorth, byGame: a.byGame,
      } : null,
      achievements: ach,
      trail: trail(room, pid),
      duels: room.duels.filter((d) => d.from === pid || d.to === pid).slice(0, 5),
    },
  };
}

const MAJOR = new Set(['session', 'win', 'achievement', 'duel', 'loan', 'repay', 'broke', 'rescued', 'bankrupt', 'overdue', 'host', 'join', 'leave']);
export function sessionHistory(room) {
  const since = room.session.startedAt || 0;
  const players = room.humans().filter((p) => room.economy.account(p.id)?.staked);
  return {
    ok: true,
    history: {
      startedAt: room.session.startedAt,
      events: room.feed.filter((f) => f.at >= since && MAJOR.has(f.kind)).slice(-300),
      trails: Object.fromEntries(players.map((p) => [p.id, trail(room, p.id, 80)])),
      startingCash: room.settings.startingCash,
    },
  };
}

// ───────────── views ─────────────
export function publicView(room) {
  return {
    achievements: room.achievements,
    challenges: [...room.challenges.values()],
    duels: room.duels.slice(0, 5),
  };
}
