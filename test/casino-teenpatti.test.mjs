// Neon Casino Teen Patti (games/casino/server/games/teenpatti.mjs): hand ranks, boot, blind and seen stakes, show,
// pot limit, all-in side pots, privacy and chip conservation, played through a real room.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { CasinoRoom } from '../games/casino/server/room.mjs';
import { eval3, handName, RULES } from '../games/casino/server/games/teenpatti.mjs';
import { compareKeys } from '../games/casino/server/games/kit.mjs';

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
function seeded(seed) { let s = seed >>> 0; return (n) => { s = (s * 1664525 + 1013904223) >>> 0; return Math.floor((s / 2 ** 32) * n); }; }
const beats = (a, b) => compareKeys(eval3(a), eval3(b)) > 0;

function setup(n = 3, { seed = 5, cash } = {}) {
  const c = clock();
  const room = new CasinoRoom({ code: 'TP001', now: c.now, timers: c.timers, rng: seeded(seed) });
  const ids = [];
  for (let i = 0; i < n; i++) { const { player } = room.addPlayer({ name: 'P' + i }); room.setConnected(player.id, true); ids.push(player.id); }
  for (const id of ids.slice(1)) room.command(id, { type: 'ready', ready: true });
  room.command(ids[0], { type: 'start' });
  const e = room.economy;
  if (cash) cash.forEach((target, i) => {
    const id = ids[i], loss = e.account(id).cash - target;
    if (loss > 0) { e.openRound({ roundId: 'trim' + i, game: 'blackjack' }); e.reserve({ betId: 'trim' + i, playerId: id, roundId: 'trim' + i, amount: loss }); e.settleRound('trim' + i, {}, { mode: 'house', maxMultiplier: 2 }); }
  });
  for (const id of ids) assert.ok(room.command(id, { type: 'sit', tableId: 'teenpatti' }).ok);
  c.advance(RULES.startMs);
  const st = () => room.tableState.teenpatti;
  const h = () => st().hand;
  const play = (id, action) => room.command(id, { type: 'play', tableId: 'teenpatti', action });
  const turn = () => h().players[h().turn].pid;
  const rig = (cards) => { for (const p of h().players) if (cards[p.pid]) p.cards = cards[p.pid]; };
  const cash_ = (id) => e.account(id).cash;
  const chips = () => ids.reduce((s, id) => s + e.account(id).cash + e.account(id).reserved, 0);
  return { room, ids, c, e, st, h, play, turn, rig, cash: cash_, chips, view: (id) => room.viewFor(id).tables.find((t) => t.id === 'teenpatti').state };
}

test('hand ranks: trail > pure sequence > sequence > color > pair > high card', () => {
  const ladder = [['AS', 'AD', 'AH'], ['2S', '2D', '2H'], ['AH', 'KH', 'QH'], ['AS', '2S', '3S'], ['KD', 'QD', 'JD'], ['4C', '3C', '2C'],
    ['AH', 'KD', 'QC'], ['AH', '2D', '3C'], ['KS', 'QD', 'JH'], ['4S', '3D', '2H'], ['AS', 'JS', '8S'], ['AH', 'AD', 'KC'], ['2H', '2D', 'AC'], ['AS', 'KD', 'JC'], ['5S', '3D', '2C']];
  for (let i = 0; i < ladder.length - 1; i++) assert.ok(beats(ladder[i], ladder[i + 1]), `${ladder[i]} beats ${ladder[i + 1]}`);
  assert.equal(handName(['AH', 'KH', 'QH']), 'Pure sequence');
  assert.equal(handName(['7S', '7D', '7C']), 'Trail');
  assert.equal(compareKeys(eval3(['AS', 'KD', 'JC']), eval3(['AH', 'KC', 'JD'])), 0, 'a true tie');
  assert.ok(beats(['QS', 'QD', '9C'], ['QH', 'QC', '8D']), 'pair kicker');
});

test('everyone posts the boot; blind pays the stake, seen pays double, a raise doubles the stake', () => {
  const t = setup(3);
  for (const id of t.ids) assert.equal(t.cash(id), 9_900);
  const a = t.turn();
  assert.ok(t.play(a, 'chaal').ok);
  assert.equal(t.cash(a), 9_800, 'blind chaal = stake (100)');
  const b = t.turn();
  assert.ok(t.play(b, 'see').ok);
  assert.ok(t.view(b).hand.players.find((p) => p.pid === b).cards.length === 3, 'seeing shows your own cards');
  assert.ok(t.play(b, 'chaal').ok);
  assert.equal(t.cash(b), 9_700, 'seen chaal = 2 × stake');
  const c = t.turn();
  assert.ok(t.play(c, 'raise').ok);
  assert.equal(t.cash(c), 9_700, 'blind raise = 2 × stake');
  assert.equal(t.h().stake, 200);
  assert.equal(t.turn(), a);
  assert.ok(t.play(a, 'chaal').ok);
  assert.equal(t.cash(a), 9_600, 'blind chaal at the new stake');
  assert.ok(t.play(b, 'chaal').ok);
  assert.equal(t.cash(b), 9_300, 'seen chaal at the new stake = 400');
  assert.deepEqual(t.e.audit(), []);
});

test('cards stay hidden until you look, and other hands until the show', () => {
  const t = setup(3);
  const [a, b] = t.h().players.map((p) => p.pid);
  assert.equal(t.view(a).hand.players.find((p) => p.pid === a).cards, null, 'blind: not even you see your cards');
  t.play(a, 'see');
  assert.equal(t.view(a).hand.players.find((p) => p.pid === a).cards.length, 3);
  assert.equal(t.view(a).hand.players.find((p) => p.pid === b).cards, null);
  assert.equal(t.view(b).hand.players.find((p) => p.pid === a).seen, true, 'whether someone is blind or seen is public');
  assert.ok(!('deck' in t.view(a).hand));
});

test('a show with two players left pays the better hand', () => {
  const t = setup(2);
  const [a, b] = t.h().players.map((p) => p.pid);
  t.rig({ [a]: ['KS', 'KD', '2C'], [b]: ['AH', 'QD', '9C'] });
  assert.equal(t.turn(), a);
  assert.ok(t.play(a, 'chaal').ok);
  assert.ok(t.play(b, 'show').ok);
  assert.equal(t.st().phase, 'results');
  assert.equal(t.st().last.hands[a].name, 'Pair');
  assert.equal(t.cash(a), 10_200);
  assert.equal(t.cash(b), 9_800);
});

test('the show payment goes into the pot; the winner takes all of it', () => {
  const t = setup(2);
  const [a, b] = t.h().players.map((p) => p.pid);
  t.rig({ [a]: ['2S', '5D', '9C'], [b]: ['KS', 'KD', '2C'] });
  t.play(a, 'see');
  t.play(a, 'show');                                  // seen: the show costs 2 × stake = 200; b is still blind
  assert.equal(t.st().last.pots.length, 1);
  assert.equal(t.st().last.pots[0].amount, 400);
  assert.equal(t.cash(b), 10_300, 'b wins a\'s boot and the full show payment');
  assert.equal(t.cash(a), 9_700);
});

test('show needs exactly two players; packing hands the pot to the last one in', () => {
  const t = setup(3);
  const first = t.turn();
  assert.match(t.play(first, 'show').error, /two players/);
  t.play(first, 'pack');
  const second = t.turn();
  t.play(second, 'pack');
  assert.equal(t.st().phase, 'results');
  const winner = t.ids.find((id) => id !== first && id !== second);
  assert.equal(t.cash(winner), 10_200);
  assert.equal(t.chips(), 30_000);
});

test('the pot limit forces a show', () => {
  const t = setup(2);
  let guard = 0;
  while (t.st().phase === 'playing' && guard++ < 50) t.play(t.turn(), 'raise');
  assert.equal(t.st().phase, 'results');
  assert.ok(t.h().log.some((l) => l.action === 'pot-limit'));
  assert.ok(t.st().last.shown);
  assert.ok(t.st().last.pots.reduce((s, p) => s + p.amount, 0) >= 100 * RULES.potLimitBoots);
  assert.equal(t.chips(), 20_000);
});

test('a player who can\'t afford the chaal can go all in; side pots keep it fair', () => {
  const t = setup(3, { cash: [10_000, 10_000, 450] });
  const short = t.h().players.find((p) => t.cash(p.pid) + t.e.account(p.pid).reserved === 450);
  const others = t.h().players.filter((p) => p !== short);
  t.rig({ [short.pid]: ['AS', 'AD', 'AH'], [others[0].pid]: ['KS', 'KD', 'KH'], [others[1].pid]: ['2S', '7D', '9H'] });
  // Raise until the short stack can't cover the chaal.
  let guard = 0;
  while (t.st().phase === 'playing' && guard++ < 30) {
    const pid = t.turn();
    if (pid === short.pid) {
      const you = t.view(pid).you;
      if (you.moves.includes('allin')) { assert.match(t.play(pid, 'chaal').error, /all in/); assert.ok(t.play(pid, 'allin').ok); }
      else t.play(pid, 'chaal');
    } else t.play(pid, 'raise');
  }
  assert.equal(t.st().phase, 'results');
  const last = t.st().last;
  assert.equal(last.pots[0].winners[0], short.pid, 'the trail of aces takes the main pot');
  assert.equal(last.pots[last.pots.length - 1].winners[0], others[0].pid, 'the trail of kings takes the side pot');
  assert.equal(t.cash(short.pid), last.pots[0].amount);
  assert.equal(t.chips() + t.e.house, 30_000);
  assert.deepEqual(t.e.audit(), []);
});

test('a stalled turn packs; standing up packs; ending the session returns the pot', () => {
  const t = setup(3);
  const first = t.turn();
  t.c.advance(RULES.turnMs);
  assert.ok(t.h().players.find((p) => p.pid === first).folded);
  t.room.command(t.turn(), { type: 'stand-up' });
  assert.equal(t.st().phase, 'results');
  const u = setup(3);
  u.play(u.turn(), 'raise');
  u.room.command(u.ids[0], { type: 'end' });
  for (const id of u.ids) assert.equal(u.cash(id), 10_000);
});

test('300 random hands never create or lose a chip', () => {
  const t = setup(4, { seed: 21 });
  const rnd = seeded(5);
  for (let hand = 0; hand < 300 && t.st().phase !== 'waiting'; hand++) {
    let guard = 0;
    while (t.st().phase === 'playing' && guard++ < 300) {
      const pid = t.turn();
      const moves = t.view(pid).you.moves.filter((m) => m !== 'see');
      if (rnd(4) === 0 && t.view(pid).you.moves.includes('see')) t.play(pid, 'see');
      if (rnd(12) === 0) { t.c.advance(RULES.turnMs); continue; }
      const pick = ['chaal', 'chaal', 'chaal', 'raise', 'pack', 'show', 'allin'][rnd(7)];
      if (moves.includes(pick)) t.play(pid, pick); else t.play(pid, moves.includes('chaal') ? 'chaal' : moves[0]);
    }
    assert.notEqual(t.st().phase, 'playing', `hand ${hand} got stuck`);
    assert.equal(t.chips(), 40_000, `hand ${hand}`);
    assert.deepEqual(t.e.audit(), []);
    t.c.advance(RULES.resultsMs);
  }
  assert.ok(t.room.session.rounds > 20);
});
