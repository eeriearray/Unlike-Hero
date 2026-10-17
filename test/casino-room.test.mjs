// Neon Casino rooms (games/casino/server/room.mjs): joining, host controls, settings, the session lifecycle,
// rankings, private views and save/restore.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { CasinoRoom, normalizeSettings, DEFAULT_SETTINGS, MAX_PLAYERS, HOST_GRACE_MS } from '../games/casino/server/room.mjs';

function clock() {
  let now = 1_000_000, seq = 0;
  const queue = new Map();
  return {
    now: () => now,
    timers: { set(fn, ms) { const id = ++seq; queue.set(id, { at: now + ms, fn }); return id; }, clear(id) { queue.delete(id); } },
    advance(ms) {
      const until = now + ms;
      for (;;) {
        let next = null, nextId = null;
        for (const [id, t] of queue) if (t.at <= until && (!next || t.at < next.at)) { next = t; nextId = id; }
        if (!next) break;
        queue.delete(nextId); now = next.at; next.fn();
      }
      now = until;
    },
  };
}

function setup(n = 3, settings) {
  const c = clock();
  const fx = [];
  const room = new CasinoRoom({ code: 'ABCDE', now: c.now, timers: c.timers, settings, hooks: { fx: (r, d) => fx.push(d) } });
  const ids = [];
  for (let i = 0; i < n; i++) {
    const res = room.addPlayer({ name: ['Asha', 'Ben', 'Chen', 'Dev'][i] || 'P' + i, avatar: 'fox', deviceKey: 'device-key-' + i.toString().padStart(8, '0') });
    room.setConnected(res.player.id, true);
    ids.push(res.player.id);
  }
  return { room, ids, c, fx, host: ids[0] };
}
function startLive(t) {
  for (const id of t.ids.slice(1)) assert.ok(t.room.command(id, { type: 'ready', ready: true }).ok);
  assert.ok(t.room.command(t.host, { type: 'start' }).ok);
}
const cash = (room, id) => room.economy.account(id).cash;

test('settings are validated field by field and across fields', () => {
  assert.ok(normalizeSettings({ startingCash: 50_000 }).settings);
  for (const bad of [{ startingCash: 10 }, { startingCash: 1e9 }, { startingCash: '10000' }, { minBet: 0 }, { minBet: 2.5 },
    { minBet: 6_000 }, { maxBet: 20_000 }, { highRollerMin: 50 }, { session: { mode: 'forever' } }, { lateJoin: 'yes' },
    { loans: { creditLimit: 30_000 } }, { loans: { interestPct: 101 } }, null]) {
    assert.ok(normalizeSettings(bad).error, JSON.stringify(bad));
  }
  const n = normalizeSettings({ minBet: 50, evil: 1, loans: { casino: false, __proto__: { x: 1 } } });
  assert.deepEqual(n.changed.sort(), ['loans.casino', 'minBet']);
  assert.equal(n.settings.evil, undefined);
  assert.ok(normalizeSettings({ startingCash: 20_000 }, DEFAULT_SETTINGS, { live: true }).error, 'starting cash is fixed mid-session');
  assert.ok(normalizeSettings({ maxBet: 2_500 }, DEFAULT_SETTINGS, { live: true }).settings, 'table limits can change mid-session');
});

test('the first player hosts; names are cleaned and made unique; rooms cap out', () => {
  const t = setup(2);
  assert.equal(t.room.hostId, t.host);
  const dup = t.room.addPlayer({ name: '  asha\u0000  ', avatar: 'not-an-avatar' });
  assert.equal(dup.player.name, 'asha 2');
  assert.ok(t.room.players.size === 3);
  while (t.room.players.size < MAX_PLAYERS) t.room.addPlayer({ name: 'x' });
  assert.match(t.room.addPlayer({ name: 'late' }).error, /full/);
});

test('only the host runs the session, and only when everyone present is ready', () => {
  const t = setup(3);
  const [, b, c] = t.ids;
  assert.match(t.room.command(b, { type: 'start' }).error, /host/);
  t.room.command(b, { type: 'ready', ready: true });
  assert.match(t.room.command(t.host, { type: 'start' }).error, /Chen/);
  t.room.setConnected(c, false);   // someone who walked away doesn't block the table
  assert.ok(t.room.command(t.host, { type: 'start' }).ok);
  for (const id of t.ids) assert.equal(cash(t.room, id), 10_000, 'everyone, even the absent player, starts equal');
  assert.equal(t.room.session.phase, 'live');
  assert.equal(t.room.economy.locked, false);
  assert.ok(t.room.command(t.host, { type: 'start' }).error, 'a second start does nothing');
  assert.equal(cash(t.room, b), 10_000);
  assert.deepEqual(t.room.economy.audit(), []);
});

test('pausing locks betting and freezes the clock; ending refunds open bets and ranks everyone', () => {
  const t = setup(3, { ...DEFAULT_SETTINGS, session: { mode: 'time', minutes: 30, rounds: 50 } });
  startLive(t);
  const [a, b, c] = t.ids;
  const e = t.room.economy;
  // A finished round: Ben loses 2,000 to the house, Asha wins 1,500.
  e.openRound({ roundId: 'r1', game: 'blackjack' });
  e.reserve({ betId: '1', playerId: a, roundId: 'r1', amount: 1_500 });
  e.reserve({ betId: '2', playerId: b, roundId: 'r1', amount: 2_000 });
  e.settleRound('r1', { [a]: 3_000 }, { mode: 'house', maxMultiplier: 2.5 });
  assert.equal(t.room.session.rounds, 1);
  // A round still open when the session ends.
  e.openRound({ roundId: 'r2', game: 'roulette' });
  e.reserve({ betId: '3', playerId: c, roundId: 'r2', amount: 800 });
  t.c.advance(10 * 60_000);
  assert.ok(t.room.command(t.host, { type: 'pause' }).ok);
  assert.match(e.reserve({ betId: '4', playerId: a, roundId: 'r2', amount: 100 }).error, /closed/);
  t.c.advance(60 * 60_000);                       // paused time doesn't count
  assert.equal(t.room.session.phase, 'paused');
  assert.ok(t.room.command(t.host, { type: 'resume' }).ok);
  assert.equal(t.room.session.endsAt - t.c.now(), 20 * 60_000);
  t.c.advance(20 * 60_000);
  assert.equal(t.room.session.phase, 'ended');
  assert.equal(t.room.session.endReason, 'Time is up');
  assert.equal(cash(t.room, c), 10_000, 'the open roulette bet came back');
  const s = t.room.session.summary;
  assert.deepEqual(s.rows.map((r) => [r.name, r.netWorth, r.rank]), [['Asha', 11_500, 1], ['Chen', 10_000, 2], ['Ben', 8_000, 3]]);
  assert.deepEqual(s.winners, [a]);
  assert.equal(s.biggestWinner.id, a);
  assert.equal(s.biggestLoser.id, b);
  assert.equal(s.bestGame.game, 'blackjack');
  assert.match(e.reserve({ betId: '5', playerId: a, roundId: 'r2', amount: 100 }).error, /closed|no longer/);
  assert.deepEqual(e.audit(), []);
});

test('a round limit ends the session after the last round settles', () => {
  const t = setup(2, { ...DEFAULT_SETTINGS, session: { mode: 'rounds', minutes: 60, rounds: 5 } });
  startLive(t);
  const e = t.room.economy;
  for (let i = 0; i < 5; i++) {
    e.openRound({ roundId: 'r' + i, game: 'roulette' });
    e.reserve({ betId: 'b' + i, playerId: t.ids[1], roundId: 'r' + i, amount: 100 });
    e.settleRound('r' + i, {}, { mode: 'house', maxMultiplier: 36 });
  }
  assert.equal(t.room.session.phase, 'ended');
  assert.equal(t.room.session.endReason, 'Round limit reached');
  assert.equal(t.room.session.summary.rows.find((r) => r.id === t.ids[1]).lost, 500);
});

test('restart needs the host\'s confirmation, resets everyone equally and tells every player', () => {
  const t = setup(2);
  startLive(t);
  const [a, b] = t.ids;
  const e = t.room.economy;
  e.openRound({ roundId: 'r1', game: 'blackjack' });
  e.reserve({ betId: '1', playerId: b, roundId: 'r1', amount: 4_000 });
  e.settleRound('r1', {}, { mode: 'house', maxMultiplier: 2 });
  assert.match(t.room.command(t.host, { type: 'restart' }).error, /Confirm/);
  assert.match(t.room.command(b, { type: 'restart', confirm: true }).error, /host/);
  assert.equal(cash(t.room, b), 6_000, 'no reset without the host');
  assert.ok(t.room.command(t.host, { type: 'restart', confirm: true }).ok);
  assert.equal(t.room.session.phase, 'lobby');
  assert.equal(t.room.session.no, 2);
  for (const id of [a, b]) assert.match(t.room.viewFor(id).session.notice.text, /reset the economy/);
  startLive(t);
  assert.equal(cash(t.room, a), 10_000);
  assert.equal(cash(t.room, b), 10_000);
  assert.equal(e.archive.length, 1);
});

test('rejoining from the same device returns the same seat and wallet instead of a fresh stake', () => {
  const t = setup(2);
  startLive(t);
  const b = t.ids[1];
  const e = t.room.economy;
  e.openRound({ roundId: 'r1', game: 'blackjack' });
  e.reserve({ betId: '1', playerId: b, roundId: 'r1', amount: 7_000 });
  e.settleRound('r1', {}, { mode: 'house', maxMultiplier: 2 });
  t.room.removePlayer(b);
  assert.ok(t.room.get(b), 'leaving mid-session keeps the player on the books');
  assert.equal(t.room.viewFor(t.host).players.find((p) => p.id === b).cash, 3_000);
  const again = t.room.addPlayer({ name: 'Ben again', deviceKey: 'device-key-00000001' });
  assert.equal(again.player.id, b);
  assert.ok(again.rejoined);
  assert.equal(cash(t.room, b), 3_000, 'the loss is still there');
  assert.ok(t.room.checkToken(b, again.token));
  assert.ok(!t.room.checkToken(b, 'guess'));
});

test('late joiners get the starting stake, or spectate when late joining is off', () => {
  const t = setup(1);
  startLive(t);
  const late = t.room.addPlayer({ name: 'Late' }).player;
  assert.equal(cash(t.room, late.id), 10_000);
  t.room.command(t.host, { type: 'settings', settings: { lateJoin: false } });
  const watcher = t.room.addPlayer({ name: 'Watcher' }).player;
  assert.equal(watcher.status, 'spectator');
  assert.equal(t.room.economy.account(watcher.id).staked, false);
  t.room.economy.openRound({ roundId: 'r1', game: 'roulette' });
  assert.ok(t.room.economy.reserve({ betId: 'w', playerId: watcher.id, roundId: 'r1', amount: 100 }).error);
});

test('a host who disappears hands the room to someone present', () => {
  const t = setup(3);
  t.room.setConnected(t.host, false);
  t.c.advance(HOST_GRACE_MS - 1000);
  assert.equal(t.room.hostId, t.host);
  t.c.advance(2000);
  assert.equal(t.room.hostId, t.ids[1]);
  t.room.command(t.ids[1], { type: 'host', to: t.ids[2] });
  assert.equal(t.room.hostId, t.ids[2]);
});

test('views show everyone\'s public finances but never credentials or another player\'s history', () => {
  const t = setup(2);
  startLive(t);
  const v = t.room.viewFor(t.ids[1]);
  const json = JSON.stringify(v);
  assert.ok(!/token|device/i.test(json), 'no credential material in a view');
  assert.ok(v.players.every((p) => p.cash === 10_000 && p.netWorth === 10_000 && p.debt === 0));
  assert.ok(v.me.history.every((h) => h.playerId === t.ids[1]));
  assert.equal(v.isHost, false);
  assert.ok(t.room.command(t.ids[1], { type: 'history' }).entries.every((h) => h.playerId === t.ids[1]));
});

test('chat is cleaned and capped; unknown commands and reactions are refused', () => {
  const t = setup(2);
  assert.ok(t.room.command(t.ids[1], { type: 'chat', text: '  hi\u202e  there  ' }).ok);
  assert.equal(t.room.chat.at(-1).text, 'hi there');
  assert.ok(t.room.command(t.ids[1], { type: 'chat', text: '   ' }).error);
  t.room.command(t.ids[1], { type: 'chat', text: 'x'.repeat(5_000) });
  assert.equal(t.room.chat.at(-1).text.length, 240);
  assert.ok(t.room.command(t.ids[1], { type: 'emote', emote: 'clap' }).ok);
  assert.equal(t.fx.at(-1).emote, 'clap');
  assert.ok(t.room.command(t.ids[1], { type: 'emote', emote: '<script>' }).error);
  assert.ok(t.room.command(t.ids[1], { type: 'payout', amount: 1e6 }).error);
  assert.ok(t.room.command('stranger', { type: 'chat', text: 'hi' }).error);
});

test('a saved room restores wallets, credentials and the session clock', () => {
  const t = setup(2, { ...DEFAULT_SETTINGS, session: { mode: 'time', minutes: 30, rounds: 50 } });
  startLive(t);
  const b = t.ids[1];
  const e = t.room.economy;
  e.openRound({ roundId: 'r1', game: 'blackjack' });
  e.reserve({ betId: '1', playerId: b, roundId: 'r1', amount: 1_200 });
  t.c.advance(5 * 60_000);
  const tok = t.room.addPlayer({ deviceKey: 'device-key-00000001' }).token;
  const snapshot = JSON.parse(JSON.stringify(t.room.toJSON()));
  const c2 = clock();
  const restored = CasinoRoom.fromJSON(snapshot, { now: c2.now, timers: c2.timers });
  assert.deepEqual(restored.economy.audit(), []);
  assert.equal(restored.economy.account(b).reserved, 1_200);
  assert.ok(restored.checkToken(b, tok));
  assert.ok(restored.humans().every((p) => !p.connected));
  assert.equal(restored.session.endsAt - c2.now(), 25 * 60_000);
  c2.advance(25 * 60_000);
  assert.equal(restored.session.phase, 'ended');
  assert.equal(restored.economy.account(b).cash, 10_000, 'the unresolved bet was refunded at the end');
});
