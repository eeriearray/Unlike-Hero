// Rules tests for RIFTBREAK (games/riftbreak/engine/riftbreak-engine.js).  Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const E = require('../games/riftbreak/engine/riftbreak-engine.js');
const { Match, RiftGame, BotBrain, isLegal, stageOf, LIMITS, RULES, RULE_POOL, COLLAPSES } = E;

let nextId = 1000;
const C = (kind, color = null, value) => ({ id: nextId++, kind, color, ...(kind === 'num' ? { value } : {}) });
const N = (color, value) => C('num', color, value);

/** A match with hand-built hands and table. players: array of hands. */
function rig(hands, { top = N('cyan', 5), color, rule = 'stable', meltdown = 0, turn = 0, queue, nextCollapse, drawPile } = {}) {
  const m = new Match(hands.map((_, i) => ({ id: 'p' + i, name: 'P' + i })), { seed: 42, firstSeat: 0 });
  m.players.forEach((p, i) => { p.hand = hands[i]; });
  m.discard = [top];
  m.color = color || top.color;
  m.rule = rule;
  m.meltdown = meltdown;
  m.turn = turn;
  m.phase = 'turn';
  if (queue) m.queue = queue.slice();
  if (nextCollapse) m.nextCollapse = nextCollapse;
  if (drawPile) m.drawPile = drawPile;
  return m;
}
const ids = (m, i) => m.players[i].hand.map(c => c.id);
const ok = r => assert.ok(r && r.ok, JSON.stringify(r));
const lastEvent = (m, t) => [...m.events].reverse().find(e => e.t === t);

function virtualClock() {
  let now = 0, seq = 0;
  const queue = new Map();
  return {
    now: () => now,
    timers: { set(fn, ms) { const id = ++seq; queue.set(id, { at: now + ms, fn }); return id; }, clear(id) { queue.delete(id); } },
    advance(ms) { const end = now + ms; this.runUntil(() => false, end); now = Math.max(now, end); },
    runUntil(pred, limit = now + 6 * 60 * 60 * 1000) {
      while (!pred()) {
        let nextId = null, next = null;
        for (const [id, t] of queue) if (!next || t.at < next.at) { next = t; nextId = id; }
        if (!next || next.at > limit) break;
        queue.delete(nextId);
        now = Math.max(now, next.at);
        next.fn();
      }
    },
  };
}

// ─────────────────────────── Deck and deal ───────────────────────────

test('deck has 118 cards with the documented distribution', () => {
  const d = E.buildDeck();
  assert.equal(d.length, 118);
  const count = (f) => d.filter(f).length;
  assert.equal(count(c => c.kind === 'num'), 76);
  assert.equal(count(c => c.kind === 'num' && c.value === 0), 4);
  for (const k of ['skip', 'reverse', 'surge']) assert.equal(count(c => c.kind === k), 8);
  for (const k of ['stabilize', 'rift', 'wild', 'overload']) assert.equal(count(c => c.kind === k), 4);
  assert.equal(count(c => c.kind === 'wildrift'), 2);
  for (const s of E.SUITS) assert.equal(count(c => c.color === s), 27);
});

test('deal: seven cards each, a number on top, six-rule queue, deterministic per seed', () => {
  const players = [1, 2, 3, 4, 5].map(i => ({ id: 'p' + i, name: 'P' + i }));
  const a = new Match(players, { seed: 7 }), b = new Match(players, { seed: 7 }), c = new Match(players, { seed: 8 });
  a.players.forEach(p => assert.equal(p.hand.length, 7));
  assert.equal(a.top().kind, 'num');
  assert.equal(a.drawPile.length + a.discard.length + 35, 118);
  assert.equal(a.pool.length, 6);
  assert.equal(new Set(a.pool).size, 6);
  assert.deepEqual(a.players.map(p => p.hand.map(x => x.id)), b.players.map(p => p.hand.map(x => x.id)));
  assert.notDeepEqual(a.players[0].hand.map(x => x.kind + x.color + x.value), c.players[0].hand.map(x => x.kind + x.color + x.value));
  assert.equal(a.rule, 'stable');
  assert.ok(COLLAPSES[a.nextCollapse]);
});

test('the shuffle is unbiased enough: every position sees every card', () => {
  const rng = E.makeRng(99);
  const hits = Array.from({ length: 10 }, () => new Array(10).fill(0));
  for (let i = 0; i < 20000; i++) {
    const a = E.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
    a.forEach((v, pos) => hits[v][pos]++);
  }
  for (const row of hits) for (const h of row) assert.ok(h > 1700 && h < 2300, `position count ${h}`);
});

// ─────────────────────────── Legality ───────────────────────────

const ctx = (o) => ({ phase: 'turn', color: 'cyan', top: N('cyan', 5), rule: 'stable', meltdown: 0, stack: 0, drawn: [], ...o });

test('normal matching: color, number, symbol; wilds always', () => {
  assert.ok(isLegal(ctx(), N('cyan', 2)));
  assert.ok(isLegal(ctx(), N('gold', 5)));
  assert.ok(!isLegal(ctx(), N('gold', 6)));
  assert.ok(isLegal(ctx({ top: C('skip', 'gold'), color: 'gold' }), C('skip', 'violet')));
  assert.ok(!isLegal(ctx(), C('skip', 'violet')));
  for (const k of ['wild', 'overload', 'wildrift']) assert.ok(isLegal(ctx(), C(k)));
});

test('Odd World: even numbers and zero are blocked, odd matches still work, actions unaffected', () => {
  const c = ctx({ rule: 'odd_world' });
  assert.ok(!isLegal(c, N('cyan', 4)));
  assert.ok(!isLegal(c, N('cyan', 0)));
  assert.ok(isLegal(c, N('cyan', 3)));
  assert.ok(isLegal(c, N('gold', 5)));
  assert.ok(isLegal(c, C('skip', 'cyan')));
});

test('Color Lock: number and symbol matches stop counting', () => {
  const c = ctx({ rule: 'color_lock' });
  assert.ok(!isLegal(c, N('gold', 5)));
  assert.ok(isLegal(c, N('cyan', 1)));
  assert.ok(!isLegal(ctx({ rule: 'color_lock', top: C('skip', 'gold'), color: 'gold' }), C('skip', 'violet')));
  assert.ok(isLegal(c, C('wild')));
});

test('Echo: a number one step away plays on any color', () => {
  const c = ctx({ rule: 'echo' });
  assert.ok(isLegal(c, N('gold', 4)));
  assert.ok(isLegal(c, N('violet', 6)));
  assert.ok(!isLegal(c, N('violet', 7)));
  assert.ok(!isLegal(ctx({ rule: 'echo', top: C('skip', 'cyan') }), N('gold', 1)));
});

test('Open Fire: Surge plays on anything', () => {
  assert.ok(isLegal(ctx({ rule: 'open_fire' }), C('surge', 'violet')));
  assert.ok(!isLegal(ctx(), C('surge', 'violet')));
});

test('Critical and Breaking stages let Rifts play on anything, even under Color Lock', () => {
  assert.ok(!isLegal(ctx({ meltdown: 3 }), C('rift', 'gold')));
  assert.ok(isLegal(ctx({ meltdown: 4 }), C('rift', 'gold')));
  assert.ok(isLegal(ctx({ meltdown: 8, rule: 'color_lock' }), C('rift', 'gold')));
});

test('facing an attack only attacks (below the cap) and Stabilize are legal, in any color', () => {
  const c = ctx({ phase: 'attack', stack: 4 });
  assert.ok(isLegal(c, C('surge', 'violet')));
  assert.ok(isLegal(c, C('overload')));
  assert.ok(isLegal(c, C('stabilize', 'gold')));
  assert.ok(!isLegal(c, N('cyan', 5)));
  assert.ok(!isLegal(c, C('wild')));
  assert.ok(!isLegal(ctx({ phase: 'attack', stack: 10 }), C('surge', 'cyan')));
  assert.ok(isLegal(ctx({ phase: 'attack', stack: 10 }), C('stabilize', 'cyan')));
});

test('meltdown stages: 0–3 unstable, 4–6 critical, 7–9 breaking', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(stageOf), [0, 0, 0, 0, 1, 1, 1, 2, 2, 2]);
});

test('the engine refuses illegal plays, cards not in hand, and plays out of turn', () => {
  const m = rig([[N('gold', 7), N('cyan', 1)], [N('cyan', 2)]]);
  assert.match(m.play('p0', m.players[0].hand[0].id).error, /can.t be played/);
  assert.match(m.play('p0', 99999).error, /not in your hand/);
  assert.match(m.play('p1', m.players[1].hand[0].id).error, /not your turn/);
  assert.match(m.play('p0', C('wild').id).error, /not in your hand/);
});

// ─────────────────────────── Card effects ───────────────────────────

test('Skip skips the next player; in a two-player game you go again', () => {
  const m = rig([[C('skip', 'cyan'), N('cyan', 1)], [N('cyan', 2)], [N('cyan', 3)]]);
  ok(m.play('p0', ids(m, 0)[0]));
  assert.equal(m.current().id, 'p2');
  assert.equal(lastEvent(m, 'skip').target, 'p1');
  const two = rig([[C('skip', 'cyan'), N('cyan', 1)], [N('cyan', 2)]]);
  ok(two.play('p0', ids(two, 0)[0]));
  assert.equal(two.current().id, 'p0');
});

test('Reverse flips direction; with two players it acts as a Skip', () => {
  const m = rig([[C('reverse', 'cyan'), N('cyan', 1)], [N('cyan', 2)], [N('cyan', 3)], [N('cyan', 4)]]);
  ok(m.play('p0', ids(m, 0)[0]));
  assert.equal(m.dir, -1);
  assert.equal(m.current().id, 'p3');
  const two = rig([[C('reverse', 'cyan'), N('cyan', 1)], [N('cyan', 2)]]);
  ok(two.play('p0', ids(two, 0)[0]));
  assert.equal(two.current().id, 'p0');
});

test('Wild requires a color and sets it', () => {
  const m = rig([[C('wild'), N('cyan', 1)], [N('cyan', 2)]]);
  assert.match(m.play('p0', ids(m, 0)[0]).error, /Choose a color/);
  ok(m.play('p0', ids(m, 0)[0], { color: 'violet' }));
  assert.equal(m.color, 'violet');
});

test('Surge starts an attack; the next player can counter, block or accept', () => {
  const m = rig([[C('surge', 'cyan'), N('cyan', 1)], [C('surge', 'gold'), N('gold', 1)], [N('cyan', 3), N('cyan', 4)]], { drawPile: Array.from({ length: 30 }, (_, i) => N('gold', i % 10)) });
  ok(m.play('p0', ids(m, 0)[0]));
  assert.equal(m.stack, 2);
  assert.equal(m.phase, 'attack');
  assert.equal(m.current().id, 'p1');
  assert.deepEqual(m.legalFor('p1'), [ids(m, 1)[0]]);
  ok(m.play('p1', ids(m, 1)[0]));
  assert.equal(m.stack, 4);
  assert.equal(m.current().id, 'p2');
  assert.equal(m.legalFor('p2').length, 0);
  ok(m.draw('p2'));
  assert.equal(m.players[2].hand.length, 6);
  assert.equal(m.stack, 0);
  assert.equal(m.phase, 'turn');
  assert.equal(m.current().id, 'p0');
});

test('Overload adds 4, sets the color and raises Meltdown by 1', () => {
  const m = rig([[C('overload'), N('cyan', 1)], [N('cyan', 2)]]);
  ok(m.play('p0', ids(m, 0)[0], { color: 'gold' }));
  assert.equal(m.stack, 4);
  assert.equal(m.color, 'gold');
  assert.equal(m.meltdown, 1);
  assert.deepEqual(lastEvent(m, 'meltdown').reasons, ['Overload']);
});

test('Overcharge adds +1 card and +1 Meltdown, and only applies to attacks', () => {
  const m = rig([[C('surge', 'cyan'), N('cyan', 1)], [N('gold', 2)]]);
  ok(m.play('p0', ids(m, 0)[0], { overcharge: true }));
  assert.equal(m.stack, 3);
  assert.equal(m.meltdown, 2);   // Surge +1, Overcharge +1
  assert.deepEqual(lastEvent(m, 'meltdown').reasons, ['Surge', 'Overcharge']);
  const n = rig([[N('cyan', 3), N('cyan', 1)], [N('gold', 2)]]);
  ok(n.play('p0', ids(n, 0)[0], { overcharge: true }));
  assert.equal(n.meltdown, 0);
});

test('every attack destabilizes reality: Surge raises Meltdown by 1', () => {
  const m = rig([[C('surge', 'cyan'), N('cyan', 1)], [N('gold', 2)]], { meltdown: 3 });
  ok(m.play('p0', ids(m, 0)[0]));
  assert.equal(m.meltdown, 4);
  assert.equal(lastEvent(m, 'meltdown').stageTo, 1);
});

test('a new match starts at Meltdown 2', () => {
  assert.equal(new Match([{ id: 'a' }, { id: 'b' }], { seed: 1 }).meltdown, LIMITS.meltdownStart);
  assert.equal(LIMITS.meltdownStart, 2);
});

test('the attack stack is capped at 10 and cannot be countered at the cap', () => {
  const m = rig([[C('overload'), N('cyan', 1)], [C('overload'), N('cyan', 1)], [C('surge', 'cyan'), C('stabilize', 'gold'), N('gold', 1)], [N('cyan', 4)]],
    { drawPile: Array.from({ length: 40 }, () => N('gold', 3)) });
  ok(m.play('p0', ids(m, 0)[0], { color: 'cyan', overcharge: true }));   // 5
  ok(m.play('p1', ids(m, 1)[0], { color: 'cyan', overcharge: true }));   // 10 (capped)
  assert.equal(m.stack, 10);
  assert.deepEqual(m.legalFor('p2'), [ids(m, 2)[1]]);   // only Stabilize
  const over = rig([[C('surge', 'cyan'), N('cyan', 1)], [N('cyan', 2)]]);
  over.stack = 9; over.phase = 'attack';
  ok(over.play('p0', ids(over, 0)[0], { overcharge: true }));
  assert.equal(over.stack, 10);
  assert.ok(lastEvent(over, 'stack').capped);
});

test('Stabilize lowers Meltdown by 2 (never below 0) and blocks half an attack', () => {
  const m = rig([[C('stabilize', 'cyan'), N('cyan', 1)], [N('cyan', 2)]], { meltdown: 5 });
  ok(m.play('p0', ids(m, 0)[0]));
  assert.equal(m.meltdown, 3);
  const z = rig([[C('stabilize', 'cyan'), N('cyan', 1)], [N('cyan', 2)]], { meltdown: 1 });
  ok(z.play('p0', ids(z, 0)[0]));
  assert.equal(z.meltdown, 0);

  const b = rig([[C('overload'), N('cyan', 1)], [C('stabilize', 'violet'), N('gold', 1)], [N('cyan', 3)]], { meltdown: 2, drawPile: Array.from({ length: 20 }, () => N('gold', 3)) });
  ok(b.play('p0', ids(b, 0)[0], { color: 'cyan', overcharge: true }));   // 5 cards, meltdown 4
  ok(b.play('p1', ids(b, 1)[0]));
  assert.equal(lastEvent(b, 'block').took, 2);
  assert.equal(b.players[1].hand.length, 3);
  assert.equal(b.stack, 0);
  assert.equal(b.meltdown, 2);
  assert.equal(b.current().id, 'p2');
  assert.equal(b.phase, 'turn');
});

test('Rift shifts reality to the next queued rule and raises Meltdown by 1', () => {
  const m = rig([[C('rift', 'cyan'), N('cyan', 1)], [N('cyan', 2)]], { queue: ['odd_world', 'echo'] });
  ok(m.play('p0', ids(m, 0)[0]));
  assert.equal(m.rule, 'odd_world');
  assert.equal(m.queue[0], 'echo');
  assert.equal(m.meltdown, 1);
  const r = lastEvent(m, 'rift');
  assert.deepEqual([r.from, r.to, r.next], ['stable', 'odd_world', 'echo']);
});

test('Wild Rift picks a color and shifts reality', () => {
  const m = rig([[C('wildrift'), N('cyan', 1)], [N('cyan', 2)]], { queue: ['mirror'] });
  ok(m.play('p0', ids(m, 0)[0], { color: 'gold' }));
  assert.equal(m.rule, 'mirror');
  // Mirror applies at the end of this very turn: gold flips to violet.
  assert.equal(m.color, 'violet');
});

test('the Rift queue reshuffles when used up and never repeats the rule just entered', () => {
  const m = rig([[...Array.from({ length: 12 }, () => C('wildrift'))], [N('cyan', 2)]], { queue: ['echo'] });
  m.pool = ['echo', 'mirror', 'spotlight'];
  m.meltdown = 0;
  ok(m.play('p0', ids(m, 0)[0], { color: 'cyan' }));
  assert.equal(m.rule, 'echo');
  assert.equal(m.queue.length, 3);
  assert.equal(m.queue[2], 'echo');
  assert.notEqual(m.queue[0], 'echo');
});

test('a 0 is coolant: Meltdown −1', () => {
  const m = rig([[N('cyan', 0), N('cyan', 1)], [N('cyan', 2)]], { meltdown: 4 });
  ok(m.play('p0', ids(m, 0)[0]));
  assert.equal(m.meltdown, 3);
  assert.equal(lastEvent(m, 'meltdown').stageTo, 0);
});

// ─────────────────────────── Reality Rules ───────────────────────────

test('Aftershock: non-number cards raise Meltdown by 1; a Rift uses the rule in force when it was played', () => {
  const m = rig([[C('skip', 'cyan'), N('cyan', 1), N('cyan', 2)], [N('cyan', 2)]], { rule: 'aftershock' });
  ok(m.play('p0', ids(m, 0)[0]));
  assert.equal(m.meltdown, 1);
  ok(m.play('p0', ids(m, 0)[0]));
  assert.equal(m.meltdown, 1);
  const r = rig([[C('rift', 'cyan'), N('cyan', 1)], [N('cyan', 2)]], { rule: 'stable', queue: ['aftershock'] });
  ok(r.play('p0', ids(r, 0)[0]));
  assert.equal(r.meltdown, 1);   // Rift +1 only; Aftershock starts with the next card
  const a = rig([[C('rift', 'cyan'), N('cyan', 1)], [N('cyan', 2)]], { rule: 'aftershock', queue: ['echo'] });
  ok(a.play('p0', ids(a, 0)[0]));
  assert.equal(a.meltdown, 2);
  assert.deepEqual(lastEvent(a, 'meltdown').reasons, ['Rift', 'Aftershock']);
});

test('Low Gravity: lower number +1, higher −1, equal nothing', () => {
  const m = rig([[N('cyan', 3), N('cyan', 8), N('gold', 8), N('cyan', 1)], [N('violet', 1)]], { rule: 'low_gravity', meltdown: 2 });
  ok(m.play('p0', ids(m, 0)[0])); assert.equal(m.meltdown, 3);  // 5 → 3 lower
  m.turn = 0; ok(m.play('p0', ids(m, 0)[0])); assert.equal(m.meltdown, 2);  // 3 → 8 higher
  m.turn = 0; ok(m.play('p0', ids(m, 0)[0])); assert.equal(m.meltdown, 2);  // 8 → 8 equal
});

test('Hot Potato: drawing and not playing draws one more', () => {
  const m = rig([[N('gold', 1)], [N('cyan', 2)]], { rule: 'hot_potato', drawPile: [N('violet', 7), N('violet', 8)] });
  ok(m.draw('p0'));
  assert.equal(m.players[0].hand.length, 3);
  assert.equal(m.current().id, 'p1');
  const keep = rig([[N('gold', 1)], [N('cyan', 2)]], { rule: 'hot_potato', drawPile: [N('violet', 7), N('cyan', 8)] });
  ok(keep.draw('p0'));
  assert.equal(keep.phase, 'drawn');
  ok(keep.pass('p0'));
  assert.equal(keep.players[0].hand.length, 3);
});

test('Hot Potato does not apply when accepting an attack', () => {
  const m = rig([[N('gold', 1)], [N('cyan', 2)]], { rule: 'hot_potato', drawPile: Array.from({ length: 10 }, () => N('violet', 7)) });
  m.stack = 2; m.phase = 'attack';
  ok(m.draw('p0'));
  assert.equal(m.players[0].hand.length, 3);
});

test('Mirror flips the active color at the end of every turn', () => {
  const m = rig([[N('cyan', 1), N('cyan', 2)], [N('crimson', 3), N('crimson', 4)]], { rule: 'mirror' });
  ok(m.play('p0', ids(m, 0)[0]));
  assert.equal(m.color, 'crimson');
  ok(m.play('p1', ids(m, 1)[0]));
  assert.equal(m.color, 'cyan');
  assert.equal(lastEvent(m, 'color').cause, 'mirror');
});

test('Spotlight: three cards or fewer draw two', () => {
  const m = rig([[N('gold', 1), N('gold', 2), N('gold', 3)], [N('cyan', 2)]], { rule: 'spotlight', drawPile: [N('violet', 7), N('violet', 8), N('violet', 9)] });
  ok(m.draw('p0'));
  assert.equal(m.players[0].hand.length, 5);
  const big = rig([[N('gold', 1), N('gold', 2), N('gold', 3), N('gold', 4)], [N('cyan', 2)]], { rule: 'spotlight', drawPile: [N('violet', 7), N('violet', 8)] });
  ok(big.draw('p0'));
  assert.equal(big.players[0].hand.length, 5);
});

test('every rule in the pool has a one-sentence description', () => {
  for (const id of RULE_POOL) {
    assert.ok(RULES[id], id);
    assert.ok(RULES[id].text.length < 120, id);
    assert.equal(RULES[id].text.split('. ').length <= 2, true, id);
  }
});

// ─────────────────────────── Meltdown and Collapse ───────────────────────────

test('Breaking stage adds +1 to every attack', () => {
  const m = rig([[C('surge', 'cyan'), N('cyan', 1)], [N('gold', 2)]], { meltdown: 7 });
  ok(m.play('p0', ids(m, 0)[0]));
  assert.equal(m.stack, 3);
  assert.deepEqual(lastEvent(m, 'stack').bonus, ['breaking']);
});

test('reaching 10 triggers the announced Collapse Event and resets to 3', () => {
  const m = rig([[C('rift', 'cyan'), N('cyan', 1)], [N('gold', 2)], [N('gold', 3)]], { meltdown: 9, nextCollapse: 'shockwave', queue: ['echo', 'mirror'], drawPile: Array.from({ length: 10 }, () => N('violet', 1)) });
  ok(m.play('p0', ids(m, 0)[0]));
  assert.equal(lastEvent(m, 'collapse').event, 'shockwave');
  assert.equal(m.meltdown, 3);
  assert.deepEqual(m.players.map(p => p.hand.length), [1, 2, 2]);
  assert.ok(COLLAPSES[m.nextCollapse]);
  assert.equal(lastEvent(m, 'meltdown').reset, true);
});

test('Gravity Well: the players with the fewest cards draw 2 (including the trigger)', () => {
  const m = rig([[C('overload'), N('cyan', 1), N('cyan', 3)], [N('gold', 2)], [N('gold', 3), N('gold', 4)]], { meltdown: 9, nextCollapse: 'gravity_well', drawPile: Array.from({ length: 10 }, () => N('violet', 1)) });
  ok(m.play('p0', ids(m, 0)[0], { color: 'cyan' }));
  assert.deepEqual(m.players.map(p => p.hand.length), [2, 3, 2]);
});

test('Reality Fracture shifts the rule; Chain Reaction boosts the next attack by 2', () => {
  const f = rig([[C('overload'), N('cyan', 1), N('cyan', 2)], [N('gold', 2)]], { meltdown: 9, nextCollapse: 'fracture', queue: ['color_lock', 'echo'] });
  ok(f.play('p0', ids(f, 0)[0], { color: 'cyan' }));
  assert.equal(f.rule, 'color_lock');
  assert.equal(lastEvent(f, 'rift').cause, 'fracture');

  const c = rig([[C('overload'), N('cyan', 1), N('cyan', 2)], [C('surge', 'cyan'), N('gold', 2)], [N('gold', 2)]], { meltdown: 9, nextCollapse: 'chain', drawPile: Array.from({ length: 20 }, () => N('violet', 1)) });
  ok(c.play('p0', ids(c, 0)[0], { color: 'cyan' }));   // stack 4 (+1 breaking) = 5, collapse → chain armed
  assert.equal(c.stack, 5);
  assert.equal(c.chainBonus, 2);
  ok(c.play('p1', ids(c, 1)[0]));                       // +2 surge +2 chain (meltdown now 3: no breaking bonus)
  assert.equal(c.stack, 9);
  assert.equal(c.chainBonus, 0);
});

test('Collapse events come from a bag: all four appear before any repeats', () => {
  const m = rig([[N('cyan', 1)], [N('cyan', 2)]]);
  m.collapseBag = [];
  const seen = new Set();
  for (let i = 0; i < 4; i++) seen.add(m.drawCollapse());
  assert.equal(seen.size, 4);
});

test('Meltdown never goes above 10 or below 0', () => {
  const m = rig([[N('cyan', 0), N('cyan', 0), N('cyan', 1)], [N('cyan', 2)]]);
  ok(m.play('p0', ids(m, 0)[0]));
  assert.equal(m.meltdown, 0);
  const h = rig([[C('overload'), N('cyan', 1), N('cyan', 2)], [N('cyan', 2)]], { meltdown: 9, rule: 'aftershock', nextCollapse: 'chain' });
  ok(h.play('p0', ids(h, 0)[0], { color: 'cyan', overcharge: true }));   // +3 → collapse at 10 → reset 3
  assert.equal(h.meltdown, 3);
  assert.equal(lastEvent(h, 'meltdown').from, 10);
});

// ─────────────────────────── Turn flow, edge cases ───────────────────────────

test('drawing a playable card lets you play it (and only it) or pass', () => {
  const m = rig([[N('gold', 1), N('cyan', 9)], [N('cyan', 2)]], { drawPile: [N('violet', 7)], top: N('violet', 5), color: 'violet' });
  ok(m.draw('p0'));
  assert.equal(m.phase, 'drawn');
  assert.deepEqual(m.legalFor('p0'), [m.drawn[0]]);
  assert.match(m.draw('p0').error, /Play the card you drew/);
  ok(m.play('p0', m.drawn[0]));
  assert.equal(m.current().id, 'p1');
});

test('drawing an unplayable card ends the turn automatically', () => {
  const m = rig([[N('gold', 1)], [N('cyan', 2)]], { drawPile: [N('violet', 7)] });
  const r = m.draw('p0');
  assert.equal(r.playable, false);
  assert.equal(m.current().id, 'p1');
});

test('empty draw pile reshuffles the discard pile except its top card', () => {
  const m = rig([[N('gold', 1)], [N('cyan', 2)]], { drawPile: [] });
  m.discard = [N('violet', 1), N('violet', 2), N('violet', 3), N('cyan', 5)];
  ok(m.draw('p0'));
  assert.ok(lastEvent(m, 'reshuffle'));
  assert.equal(m.discard.length, 1);
  assert.equal(m.top().value, 5);
  assert.equal(m.drawPile.length, 2);
});

test('with both piles empty, drawing gives nothing and the turn still passes', () => {
  const m = rig([[N('gold', 1)], [N('cyan', 2)]], { drawPile: [] });
  ok(m.draw('p0'));
  assert.equal(m.players[0].hand.length, 1);
  assert.equal(m.current().id, 'p1');
  m.stack = 4; m.phase = 'attack';
  ok(m.draw('p1'));
  assert.equal(m.current().id, 'p0');
  assert.equal(m.stack, 0);
});

test('hand limit: nobody holds more than 25 cards', () => {
  const m = rig([[...Array.from({ length: 24 }, () => N('gold', 1))], [N('cyan', 2)]], { drawPile: Array.from({ length: 20 }, () => N('violet', 3)) });
  m.stack = 10; m.phase = 'attack';
  ok(m.draw('p0'));
  assert.equal(m.players[0].hand.length, 25);
});

test('winning with an action card ends the match immediately; pending effects do not resolve', () => {
  const m = rig([[C('overload')], [N('cyan', 2)]], { meltdown: 9 });
  ok(m.play('p0', ids(m, 0)[0], { color: 'gold' }));
  assert.equal(m.winner, 'p0');
  assert.equal(m.phase, 'end');
  assert.ok(!lastEvent(m, 'collapse'), 'no collapse after a win');
  assert.match(m.play('p1', ids(m, 1)[0]).error, /over/);
  assert.equal(m.ranking()[0].id, 'p0');
});

test('winning with a Rift or Skip also counts', () => {
  for (const kind of ['rift', 'skip', 'surge', 'stabilize', 'reverse']) {
    const m = rig([[C(kind, 'cyan')], [N('cyan', 2)]]);
    ok(m.play('p0', ids(m, 0)[0]));
    assert.equal(m.winner, 'p0', kind);
  }
});

test('Last card: calling protects you; forgetting lets anyone catch you for 2 until the next turn ends', () => {
  const pile = Array.from({ length: 10 }, () => N('violet', 9));
  const m = rig([[N('cyan', 1), N('cyan', 2)], [N('cyan', 3), N('cyan', 4), N('cyan', 6)], [N('gold', 3), N('cyan', 7)]], { drawPile: pile });
  ok(m.play('p0', ids(m, 0)[0], { call: true }));
  assert.equal(m.exposed, null);
  assert.match(m.catchPlayer('p1', 'p0').error, /Too late/);

  const f = rig([[N('cyan', 1), N('cyan', 2)], [N('cyan', 3), N('cyan', 4)], [N('cyan', 6), N('cyan', 7)]], { drawPile: pile.slice() });
  ok(f.play('p0', ids(f, 0)[0]));
  assert.equal(f.exposed.id, 'p0');
  assert.match(f.catchPlayer('p0', 'p0').error, /save yourself/);
  ok(f.catchPlayer('p2', 'p0'));
  assert.equal(f.players[0].hand.length, 3);
  assert.equal(lastEvent(f, 'caught').by, 'p2');

  const late = rig([[N('cyan', 1), N('cyan', 2)], [N('cyan', 3), N('cyan', 4)], [N('cyan', 6), N('cyan', 7)]]);
  ok(late.play('p0', ids(late, 0)[0]));
  ok(late.call('p0'));
  assert.equal(late.exposed, null);

  const window = rig([[N('cyan', 1), N('cyan', 2)], [N('cyan', 3), N('cyan', 4)], [N('cyan', 6), N('cyan', 7)]]);
  ok(window.play('p0', ids(window, 0)[0]));
  ok(window.play('p1', ids(window, 1)[0], { call: true }));
  assert.equal(window.exposed, null, 'the window closes when the next player finishes their turn');
});

test('the call button only arms with two cards on your own turn', () => {
  const m = rig([[N('cyan', 1), N('cyan', 2), N('cyan', 3)], [N('cyan', 3), N('cyan', 4)]]);
  assert.ok(m.call('p0').error);
  assert.ok(m.call('p1').error);
});

test('duplicate and stale requests are rejected by version', () => {
  const m = rig([[N('cyan', 1), N('cyan', 2), N('cyan', 3)], [N('cyan', 4), N('cyan', 6)]]);
  const v = m.version;
  const card = ids(m, 0)[0];
  ok(m.play('p0', card, {}, v));
  const again = m.play('p0', card, {}, v);
  assert.ok(again.error);
  assert.equal(m.players[0].hand.length, 2);
  const stale = m.play('p1', ids(m, 1)[0], {}, v);
  assert.equal(stale.error, 'stale');
  ok(m.play('p1', ids(m, 1)[0], {}, m.version));
});

test('timeout draws or accepts and always ends the turn', () => {
  const m = rig([[N('gold', 1)], [N('cyan', 2)]], { drawPile: [N('cyan', 9), N('cyan', 8)] });
  ok(m.timeout('p0'));
  assert.equal(m.current().id, 'p1');
  assert.equal(m.players[0].hand.length, 2);
  m.stack = 4; m.phase = 'attack';
  m.drawPile = Array.from({ length: 6 }, () => N('gold', 2));
  ok(m.timeout('p1'));
  assert.equal(m.players[1].hand.length, 5);
});

test('views never contain another player’s cards; drawn-card ids are only shown to the drawer', () => {
  const m = new Match([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }], { seed: 3 });
  for (let i = 0; i < 30 && !m.winner; i++) {
    const cur = m.current().id;
    const legal = m.legalFor(cur);
    if (legal.length) m.play(cur, legal[0], { color: 'cyan' }); else m.draw(cur);
    if (m.phase === 'drawn') m.pass(cur);
  }
  const va = JSON.stringify(m.viewFor('a'));
  for (const p of m.players) {
    if (p.id === 'a') continue;
    for (const c of p.hand) assert.ok(!new RegExp(`"id":${c.id}[,}]`).test(va) || m.discard.some(d => d.id === c.id), `leaked card ${c.id}`);
  }
  for (const e of m.viewFor('a').events) if (e.t === 'draw' && e.pid !== 'a') assert.equal(e.cards, undefined);
});

// ─────────────────────────── Bots and full games ───────────────────────────

function runMatch(levels, seed) {
  const m = new Match(levels.map((l, i) => ({ id: 'b' + i, name: 'B' + i })), { seed });
  const brains = levels.map((l, i) => new BotBrain(l, E.makeRng(seed * 31 + i)));
  let errors = 0, steps = 0;
  while (!m.winner && steps < 5000) {
    steps++;
    const cur = m.current();
    const i = m.players.indexOf(cur);
    const view = m.viewFor(cur.id);
    view.me = cur.id;
    const cmd = brains[i].decide(view);
    let r;
    if (cmd.type === 'play') r = m.play(cur.id, cmd.card, cmd, cmd.v);
    else if (cmd.type === 'draw') r = m.draw(cur.id, cmd.v);
    else r = m.pass(cur.id, cmd.v);
    if (r.error) errors++;
    // Others catch forgetful players.
    if (m.exposed && !m.winner) { const other = m.players.find(p => p.id !== m.exposed.id); m.catchPlayer(other.id, m.exposed.id); }
    const total = m.players.reduce((n, p) => n + p.hand.length, 0) + m.drawPile.length + m.discard.length;
    assert.equal(total, 118, 'cards are conserved');
    assert.ok(m.meltdown >= 0 && m.meltdown <= 9 || m.winner, `meltdown ${m.meltdown}`);
    assert.ok(m.stack <= LIMITS.stackCap);
  }
  return { m, errors, steps };
}

test('bots of every level only make legal moves and every match ends (2–8 players)', () => {
  let total = 0;
  for (let n = 2; n <= 8; n++) {
    for (let s = 0; s < 18; s++) {
      const levels = Array.from({ length: n }, (_, i) => E.LEVELS[(i + s) % 3]);
      const { m, errors } = runMatch(levels, 1000 + n * 100 + s);
      assert.equal(errors, 0, `bot errors with ${n} players, seed ${s}`);
      assert.ok(m.winner, 'match finished');
      assert.equal(m.endReason, 'empty', 'won by emptying a hand, not the turn limit');
      total++;
    }
  }
  assert.equal(total, 126);
});

test('matches feel different: rules rotate and collapses happen', () => {
  const rulesSeen = new Set(), collapses = new Set();
  let turns = 0, games = 0, rifts = 0;
  for (let s = 0; s < 60; s++) {
    const { m } = runMatch(['normal', 'normal', 'hard', 'easy', 'normal', 'hard'], 5000 + s);
    games++;
    turns += m.turnCount;
    m.events.length; // events are a ring buffer; count from the whole run below
  }
  // Count across a fresh run with an unbounded log.
  for (let s = 0; s < 30; s++) {
    const m = new Match(Array.from({ length: 6 }, (_, i) => ({ id: 'b' + i, name: 'B' })), { seed: 9000 + s });
    const brains = m.players.map((_, i) => new BotBrain('normal', E.makeRng(s * 7 + i)));
    const realEmit = m.emit.bind(m);
    m.emit = (e) => { if (e.t === 'rift') { rulesSeen.add(e.to); rifts++; } if (e.t === 'collapse') collapses.add(e.event); return realEmit(e); };
    let guard = 0;
    while (!m.winner && guard++ < 5000) {
      const cur = m.current(); const v = m.viewFor(cur.id); v.me = cur.id;
      const c = brains[m.players.indexOf(cur)].decide(v);
      if (c.type === 'play') m.play(cur.id, c.card, c); else if (c.type === 'draw') m.draw(cur.id); else m.pass(cur.id);
    }
  }
  assert.ok(rulesSeen.size >= 8, `rules seen: ${[...rulesSeen]}`);
  assert.equal(collapses.size, 4, `collapses: ${[...collapses]}`);
  assert.ok(rifts / 30 >= 2, `rifts per game ${rifts / 30}`);
  const avg = turns / games;
  assert.ok(avg > 25 && avg < 260, `average turns per 6-player match: ${avg}`);
});

test('hard bots beat easy bots more often than chance', () => {
  let hardWins = 0, games = 120;
  for (let s = 0; s < games; s++) {
    const levels = s % 2 ? ['hard', 'easy', 'easy', 'easy'] : ['easy', 'easy', 'hard', 'easy'];
    const { m } = runMatch(levels, 20000 + s);
    const i = m.players.findIndex(p => p.id === m.winner);
    if (levels[i] === 'hard') hardWins++;
  }
  assert.ok(hardWins / games > 0.33, `hard won ${hardWins}/${games} (chance is 25%)`);
});

test('a bot’s decision depends only on its own view (no hidden information)', () => {
  const m = new Match([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }], { seed: 77 });
  const v1 = m.viewFor(m.current().id); v1.me = m.current().id;
  // Scramble every other hand: the bot's choice must not change.
  const before = new BotBrain('hard', E.makeRng(1)).decide(JSON.parse(JSON.stringify(v1)));
  m.players.forEach(p => { if (p.id !== v1.me) p.hand.reverse(); });
  const v2 = m.viewFor(v1.me); v2.me = v1.me;
  const after = new BotBrain('hard', E.makeRng(1)).decide(v2);
  assert.deepEqual(before, after);
  assert.equal(v1.hands, undefined);
});

// ─────────────────────────── RiftGame session ───────────────────────────

function session(opts = {}) {
  const clock = virtualClock();
  let syncs = 0;
  const g = new RiftGame({ code: 'TEST', seed: opts.seed ?? 5, timers: clock.timers, now: clock.now, random: E.makeRng(11), hooks: { sync: () => syncs++ }, settings: opts.settings });
  return { g, clock, syncs: () => syncs };
}

test('lobby: first human hosts, only the host configures; start fills empty seats with bots', () => {
  const { g } = session();
  const a = g.addPlayer({ id: 'a', name: 'Ada' }).player;
  g.addPlayer({ id: 'b', name: 'Bo' });
  assert.equal(g.hostId, 'a');
  assert.ok(g.command('b', { type: 'settings', settings: { seats: 4 } }).error);
  ok(g.command('a', { type: 'settings', settings: { seats: 5, botLevel: 'hard', turnTimer: 25 } }));
  assert.ok(g.command('b', { type: 'start' }).error);
  ok(g.command('a', { type: 'start' }));
  assert.equal(g.seats.length, 5);
  assert.equal(g.seats.filter(s => s.isBot && s.level === 'hard').length, 3);
  assert.equal(g.phase, 'playing');
  assert.equal(a.name, 'Ada');
  const late = g.addPlayer({ id: 'z', name: 'Late' }).player;
  assert.equal(late.waiting, true, 'joining mid-match waits for the next one');
  assert.equal(g.match.get('z'), null);
  assert.equal(g.viewFor('z').match.hand, undefined);
});

test('settings are clamped and sanitized', () => {
  const s = E.sanitizeSettings({ seats: 99, botLevel: 'godlike', turnTimer: 7, lastCall: 0 });
  assert.equal(s.seats, 8);
  assert.equal(s.botLevel, 'normal');
  assert.equal(s.turnTimer, 0);
  assert.equal(s.lastCall, false);
});

test('a full session with bots plays to the end on its own, then rematches with the winner’s left neighbour leading', () => {
  const { g, clock } = session({ settings: { seats: 6, botSpeed: 'fast' } });
  g.addPlayer({ id: 'h', name: 'Host' });
  g.seats[0].isBot = true; g.seats[0].level = 'hard'; // let the host seat play itself for this test
  ok(g.start('h'));
  clock.runUntil(() => g.phase === 'ended');
  assert.equal(g.phase, 'ended');
  const winner = g.match.winner;
  assert.equal(g.seat(winner).wins, 1);
  ok(g.start('h'));
  const wi = g.seats.findIndex(s => s.id === winner);
  assert.equal(g.match.players[g.match.turn].id, g.seats[(wi + 1) % g.seats.length].id);
});

test('turn timer: a human who doesn’t act draws and passes', () => {
  const { g, clock } = session({ settings: { seats: 2, turnTimer: 15 } });
  g.addPlayer({ id: 'a', name: 'A' });
  g.addPlayer({ id: 'b', name: 'B' });
  ok(g.start('a'));
  const m = g.match;
  const cur = m.current().id;
  const before = m.get(cur).hand.length;
  clock.advance(15100);
  assert.notEqual(m.current().id, cur);
  assert.ok(m.get(cur).hand.length >= before + 1);
  assert.ok(lastEvent(m, 'timeout'));
});

test('disconnect: a Normal bot plays the seat after 10 s; reconnecting takes it back', () => {
  const { g, clock } = session({ settings: { seats: 2 } });
  g.addPlayer({ id: 'a', name: 'A' });
  g.addPlayer({ id: 'b', name: 'B' });
  ok(g.start('a'));
  const m = g.match;
  m.turn = m.players.findIndex(p => p.id === 'b');
  m.phase = 'turn';
  g.setConnected('b', false);
  clock.advance(9000);
  assert.equal(g.seat('b').autopilot, false);
  clock.advance(1500);
  assert.equal(g.seat('b').autopilot, true);
  clock.advance(3000);
  assert.notEqual(m.current().id, 'b', 'autopilot took the turn');
  g.setConnected('b', true);
  assert.equal(g.seat('b').autopilot, false);
  assert.equal(g.seat('b').connected, true);
});

test('a human leaving mid-match is replaced by a bot so the round finishes', () => {
  const { g, clock } = session({ settings: { seats: 3, botSpeed: 'fast' } });
  g.addPlayer({ id: 'a', name: 'A' });
  g.addPlayer({ id: 'b', name: 'B' });
  ok(g.start('a'));
  ok(g.removePlayer('a', 'a'));
  ok(g.removePlayer('b', 'b'));
  clock.runUntil(() => g.phase === 'ended');
  assert.equal(g.phase, 'ended');
});

test('bots catch a human who forgets to call Last card', () => {
  let caught = 0;
  for (let s = 0; s < 12; s++) {
    const { g, clock } = session({ seed: s, settings: { seats: 4, botLevel: 'hard' } });
    g.addPlayer({ id: 'h', name: 'H' });
    ok(g.start('h'));
    const m = g.match;
    m.turn = 0; m.phase = 'turn';
    m.players[0].hand = [N(m.color, 3), N(m.color, 4)];
    m.discard.push(N(m.color, 5));
    ok(g.command('h', { type: 'play', card: m.players[0].hand[0].id }));
    clock.advance(5000);
    if (m.events.some(e => e.t === 'caught' && e.pid === 'h') || m.players[0].hand.length >= 3) caught++;
  }
  assert.ok(caught >= 8, `caught ${caught}/12`);
});

test('commands from strangers and unknown types are rejected', () => {
  const { g } = session();
  g.addPlayer({ id: 'a', name: 'A' });
  assert.ok(g.command('ghost', { type: 'start' }).error);
  assert.ok(g.command('a', { type: 'explode' }).error);
  assert.ok(g.command('a', null).error);
  assert.ok(g.command('a', { type: 'play', card: 1 }).error);
});

test('if the host drops, the first connected human can run the room', () => {
  const { g } = session();
  g.addPlayer({ id: 'a', name: 'A' });
  g.addPlayer({ id: 'b', name: 'B' });
  g.addPlayer({ id: 'c', name: 'C' });
  assert.ok(g.command('b', { type: 'addBot' }).error);
  g.setConnected('a', false);
  ok(g.command('b', { type: 'addBot' }));
  assert.ok(g.command('c', { type: 'addBot' }).error);
  assert.equal(g.viewFor('b').canHost, true);
});

test('end-of-match stats count plays, attacks, rifts and collapses', () => {
  const m = rig([[C('rift', 'cyan'), C('surge', 'cyan'), N('cyan', 1)], [N('gold', 2), N('gold', 3)]], { meltdown: 8, nextCollapse: 'chain', drawPile: Array.from({ length: 10 }, () => N('violet', 1)) });
  ok(m.play('p0', ids(m, 0)[0]));     // rift → 9
  m.turn = 0;
  ok(m.play('p0', ids(m, 0)[0]));     // surge → 10 → collapse
  ok(m.draw('p1'));
  m.turn = 0; m.phase = 'turn'; m.color = 'cyan';
  ok(m.play('p0', ids(m, 0)[0]));
  const st = m.viewFor('p0').stats.p0;
  assert.equal(st.played, 3);
  assert.equal(st.rifts, 1);
  assert.equal(st.collapses, 1);
  assert.equal(st.attacked, 3);
});

test('rematch after a human left mid-match refills the seat with a bot (no hang)', () => {
  const { g, clock } = session({ settings: { seats: 4, botSpeed: 'fast' } });
  g.addPlayer({ id: 'a', name: 'A' });
  g.addPlayer({ id: 'b', name: 'B' });
  ok(g.start('a'));
  ok(g.removePlayer('b', 'b'));            // b leaves mid-match: a bot plays their hand
  g.seats[0].isBot = true; g.seats[0].level = 'normal';
  clock.runUntil(() => g.phase === 'ended');
  g.seats[0].isBot = false;
  assert.equal(g.phase, 'ended');
  const t = Date.now();
  ok(g.start('a'));
  assert.ok(Date.now() - t < 200);
  assert.equal(g.seats.length, 4);
  assert.equal(g.seat('b'), null);
});

test('the host can add a bot between matches (results screen) but not during one', () => {
  const { g, clock } = session({ settings: { seats: 2, botSpeed: 'fast' } });
  g.addPlayer({ id: 'a', name: 'A' });
  ok(g.start('a'));
  assert.ok(g.addBot('a').error);
  g.seats[0].isBot = true;
  clock.runUntil(() => g.phase === 'ended');
  g.seats[0].isBot = false;
  ok(g.addBot('a'));
  assert.equal(g.seats.length, 3);
});
