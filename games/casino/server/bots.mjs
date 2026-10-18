// Neon Casino — house bots. A bot is an ordinary player in the room who plays through exactly the same commands a person
// would send (room.command), reading only the view the server gives that player. So the rules, limits and payouts apply
// to them unchanged; this file only decides what a plausible, not-too-clever player would do next.

const NAMES = ['Mara', 'Boris', 'Lulu', 'Otto', 'Pip', 'Zed', 'Ines', 'Kai', 'Nell', 'Gus', 'Roxy', 'Dex'];
const MAX_BOTS = 6;
const next = new WeakMap();                       // bot player -> earliest time (ms) of their next action

export function addBot(room) {
  if (room.humans().filter((p) => p.isBot && !p.left).length >= MAX_BOTS) return { error: `A room can have up to ${MAX_BOTS} bots.` };
  if (room.players.size >= room.maxPlayers) return { error: 'This room is full.' };
  const used = new Set([...room.players.values()].map((p) => p.avatar));
  const free = room.avatars.filter((a) => !used.has(a));
  const avatar = (free.length ? free : room.avatars)[room.rng((free.length ? free : room.avatars).length)];
  const takenNames = new Set([...room.players.values()].map((p) => p.name.toLowerCase()));
  const name = NAMES.filter((n) => !takenNames.has((n + ' (bot)').toLowerCase()))[0] || 'Bot';
  const id = 'b' + room.id('');
  const p = { id, name: room.uniqueName(name + ' (bot)'), avatar, joinedAt: room.now(), lastSeen: room.now(), connected: true, left: false, ready: true, tableId: null, status: 'active', isBot: true };
  room.players.set(id, p);
  room.economy.open(id);
  if (room.session.phase === 'live' || room.session.phase === 'paused') room.economy.stake(id, room.settings.startingCash);
  room.log('join', `${p.name} sat down at the casino`, { playerId: id });
  room.scheduleBots();
  return { ok: true, id };
}

export function removeBot(room, id) {
  const p = room.get(id);
  if (!p || !p.isBot) return { error: 'That isn\'t a bot.' };
  room.leaveTable(id);
  if (room.session.phase === 'lobby' && room.economy.account(id)?.staked !== true) { room.players.delete(id); room.economy.accounts.delete(id); }
  else { p.connected = false; p.left = true; }
  room.log('leave', `${p.name} left the casino`, { playerId: id });
  return { ok: true };
}

export const hasBots = (room) => room.humans().some((p) => p.isBot && !p.left);

/** One pass: every bot that is due does at most one thing. Called every second or so while the room has bots. */
export function runBots(room) {
  if (room.session.phase !== 'live') return;
  const now = room.now();
  for (const p of room.humans()) {
    if (!p.isBot || p.left || p.status !== 'active') continue;
    if ((next.get(p) || 0) > now) continue;
    const acted = act(room, p);
    next.set(p, now + (acted ? 900 + room.rng(2200) : 600));
  }
}

const cmd = (room, p, c) => { const r = room.command(p.id, c); return !!(r && r.ok); };

function act(room, p) {
  if (!p.tableId) {
    // Join the table with the most people at it (a human first), else any ordinary table.
    const tables = room.openTables().filter((t) => !t.highRoller);
    const score = (t) => room.humans().filter((q) => q.tableId === t.id).reduce((n, q) => n + (q.isBot ? 1 : 3), 0) + room.rng(3);
    const t = tables.sort((a, b) => score(b) - score(a))[0];
    return t ? cmd(room, p, { type: 'sit', tableId: t.id }) : false;
  }
  const t = room.table(p.tableId);
  if (!t) return false;
  const v = t.engine.view(room, t, p.id), you = v.you;
  const seated = v.seated !== undefined ? v.seated : you && you.seated;       // blackjack and roulette say it on `you`, the card games on the table
  if (!you || !seated) return false;
  const acct = room.economy.account(p.id), cash = acct ? acct.cash : 0;
  const play = (action, extra) => cmd(room, p, { type: 'play', tableId: t.id, action, ...(extra || {}) });
  switch (t.game) {
    case 'blackjack': return blackjack(room, p, t, v, you, cash, play);
    case 'roulette': return roulette(room, t, v, you, cash, play);
    case 'poker': return poker(room, v, you, play);
    case 'teenpatti': return teenpatti(room, v, you, play);
  }
  return false;
}

function blackjack(room, p, t, v, you, cash, play) {
  if (you.canBet) {
    const mult = 1 + room.rng(3);
    return play('bet', { amount: Math.max(t.minBet, Math.min(t.maxBet, cash, t.minBet * mult)) });
  }
  if (!you.moves.length) return false;
  const r = v.round, h = r && r.hands[r.turn];
  if (!h) return false;
  const total = h.total, soft = h.soft;
  if (you.moves.includes('split') && (h.cards[0][0] === 'A' || h.cards[0][0] === '8')) return play('split');
  if (you.moves.includes('double') && ((!soft && (total === 10 || total === 11)) || (soft && total >= 15 && total <= 17 && room.rng(2)))) return play('double');
  return play(total < (soft ? 18 : 17) ? 'hit' : 'stand');
}

function roulette(room, t, v, you, cash, play) {
  if (!you.canBet || you.done) return false;
  const chip = Math.max(t.minBet, Math.min(cash, t.minBet * (1 + room.rng(2))));
  if (cash < t.minBet) return false;
  if (you.total === 0) {
    const pick = room.rng(6);
    const spot = pick < 2 ? { type: 'red' } : pick < 4 ? { type: 'black' } : pick === 4 ? { type: 'dozen', key: 1 + room.rng(3) } : { type: 'straight', numbers: [room.rng(37)] };
    return play('bet', { spot, amount: chip });
  }
  if (you.total < chip * 3 && cash >= t.minBet && room.rng(3) === 0) return play('bet', { spot: { type: 'straight', numbers: [room.rng(37)] }, amount: chip });
  return play('done');
}

function poker(room, v, you, play) {
  if (!you.moves || !you.moves.length) return false;
  const h = v.hand, toCall = you.toCall || 0, bb = h ? h.bb : 100, roll = room.rng(100);
  const canRaise = you.moves.includes('raise');
  if (toCall === 0) return canRaise && roll < 22 ? play('raise', { to: Math.min(you.maxRaiseTo, you.minRaiseTo + bb * room.rng(3)) }) : play('check');
  if (toCall <= bb * 2 || roll < 35) return canRaise && roll < 10 ? play('raise', { to: you.minRaiseTo }) : play('call');
  return play('fold');
}

function teenpatti(room, v, you, play) {
  const m = you.moves || [];
  if (m.includes('see') && room.rng(100) < 40) return play('see');
  if (!m.includes('pack')) return false;                                        // not our turn
  const roll = room.rng(100);
  if (m.includes('show') && roll < 45) return play('show');
  if (m.includes('raise') && roll < 15) return play('raise');
  if (m.includes('chaal')) return roll > 92 && you.seen ? play('pack') : play('chaal');
  return m.includes('allin') ? play('allin') : play('pack');
}
