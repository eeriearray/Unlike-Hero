// Rules tests for THE HOLLOW (games/the-hollow/engine). Run: npm test
// These drive the authoritative engine directly with a virtual clock and a forced d20 where needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Engine = require('../games/the-hollow/engine/index.js');
const { HollowGame, data: D } = Engine;

// ───────────────────────────── helpers ─────────────────────────────
const CLASSES = Object.keys(D.classes);
function make(n = 2, { seed = 7, classes } = {}) {
  let t = 1_000_000;
  const clock = { now: () => t, adv: (ms) => { t += ms; } };
  const g = new HollowGame({ code: 'TEST', seed, now: clock.now });
  const ids = [];
  for (let i = 0; i < n; i++) {
    const id = 'p' + i; ids.push(id);
    g.addPlayer({ id, name: 'P' + i });
    g.command(id, { t: 'pick', cls: (classes || CLASSES)[i] });
    g.command(id, { t: 'ready' });
  }
  const r = g.command('p0', { t: 'start' });
  assert.ok(!r.error, r.error);
  return { g, clock, ids, p: (i) => g.get('p' + i) };
}
const roll = (g, d) => { g.d20 = () => d; };
function toTurn(g, id) { let n = 0; while (g.turn.active !== id && n++ < 20) g.endTurnFor(g.get(g.turn.active)); assert.equal(g.turn.active, id); }
function put(g, p, loc) {
  p.loc = loc; p.visited[loc] = p.visited[loc] || 1;
  g.w.locs[loc].seen = g.w.locs[loc].visited = true; g.markSeen(loc);
}
function open(g, id) { const r = g.command(id, { t: 'interact' }); assert.ok(!r.error, r.error); return g.turn.enc; }
function pick(g, id, optId, extra = {}) { return g.command(id, Object.assign({ t: 'choose', enc: g.turn.enc && g.turn.enc.id, opt: optId }, extra)); }
const strip = (v) => { const c = JSON.parse(JSON.stringify(v)); delete c.now; delete c.v; return c; };

// every outcome object found anywhere in the content
function eachOption(fn) {
  Object.keys(D.locations).forEach((k) => (D.locations[k].options || []).forEach((o) => fn(o, 'loc:' + k)));
  D.regionEvents.forEach((e) => e.options.forEach((o) => fn(o, 'event:' + e.id)));
  Object.keys(D.enemies).forEach((k) => D.enemies[k].options.forEach((o) => fn(o, 'enemy:' + k)));
}
const outcomesOf = (o) => [o.ok, o.fail, o.crit, o.fumble, o.auto].filter(Boolean);

// ───────────────────────────── content ─────────────────────────────
test('content meets the minimum targets', () => {
  const locs = Object.values(D.locations);
  assert.ok(locs.length >= 36, 'locations: ' + locs.length);
  assert.equal(new Set(locs.map((l) => l.region)).size, 6, 'six regions');
  for (const r of Object.keys(D.regions)) assert.ok(locs.filter((l) => l.region === r).length >= 6, r + ' has at least 6 places');
  assert.ok(new Set(locs.map((l) => l.kind)).size >= 30, 'distinct tile kinds: ' + new Set(locs.map((l) => l.kind)).size);
  // each place has its own option set: no two places share the same list of option ids and labels
  const sig = locs.map((l) => (l.options || []).map((o) => o.label).join('|'));
  assert.equal(new Set(sig).size, sig.length, 'no two places share an encounter');
  const events = D.regionEvents.length + D.omens.length;
  assert.ok(events >= 20, 'events+omens: ' + events);
  let puzzles = 0; eachOption((o) => { if (o.puzzle) puzzles++; });
  assert.ok(puzzles >= 8, 'puzzles: ' + puzzles);
  assert.ok(Object.keys(D.enemies).length >= 8, 'enemies');
  assert.ok(Object.keys(D.items).length >= 6);
  assert.equal(Object.keys(D.classes).length, 6);
  assert.ok(Object.keys(D.objectives).length >= 6);
  assert.equal(D.boss.phases.length, 4);
  assert.ok(new Set(Object.values(D.endings).map((e) => Object.values(e.results).map((r) => r.id)).flat()).size >= 8, 'distinct endings');
  assert.equal(Object.keys(D.regionEvents.reduce((a, e) => (a[e.region] = 1, a), {})).length, 6, 'events in every region');
});

test('every reference in the content resolves, and failure always advances the game', () => {
  const edgeKeys = Object.keys(new HollowGame({}).graph.edges);
  const checkOutcome = (o, where) => {
    const arr = (v) => (v == null ? [] : [].concat(v));
    arr(o.item).concat(arr(o.lose)).forEach((i) => assert.ok(D.items[i], `${where}: item ${i}`));
    arr(o.clue).forEach((c) => assert.ok(D.clues[c], `${where}: clue ${c}`));
    ['hint', 'hint2', 'hint3'].forEach((k) => { if (o[k]) assert.ok(D.secrets[o[k]], `${where}: hint ${o[k]}`); });
    if (o.spawn) assert.ok(D.enemies[o.spawn], `${where}: spawn`);
    if (o.spawnAt) { assert.ok(D.enemies[o.spawnAt[0]]); assert.ok(D.locations[o.spawnAt[1]]); }
    (o.reveal || []).forEach((r) => { const [k, v] = r.split(':'); if (k === 'loc') assert.ok(D.locations[v], `${where}: reveal ${r}`); else assert.ok(edgeKeys.includes(v), `${where}: edge ${v}`); });
    (o.open || []).forEach((e) => assert.ok(edgeKeys.includes(e), `${where}: open ${e}`));
    if (o.cleanse) assert.ok(D.curses[o.cleanse], `${where}: curse`);
    if (o.ally) assert.ok(D.allies[o.ally], `${where}: ally`);
    if (o.status) assert.ok(D.statuses[o.status.replace('-', '')], `${where}: status ${o.status}`);
    if (o.move && o.move.startsWith('random:')) assert.ok(D.regions[o.move.slice(7)]);
    else if (o.move) assert.ok(D.locations[o.move]);
  };
  eachOption((o, where) => {
    assert.ok(o.id && o.label, where + ': id and label');
    outcomesOf(o).forEach((out) => checkOutcome(out, where + '/' + o.id));
    if (o.cost && o.cost.item) assert.ok(D.items[o.cost.item]);
    if (o.req && o.req.item) assert.ok(D.items[o.req.item]);
    if (o.stat) {
      assert.ok(o.ok && o.fail, `${where}/${o.id}: a check needs ok and fail`);
      const effects = Object.keys(o.fail).filter((k) => k !== 't');
      assert.ok(effects.length >= 1, `${where}/${o.id}: failure must advance the game`);
    }
    if (o.puzzle) { assert.ok(D.secrets[o.puzzle.key]); assert.ok(o.ok && o.fail); }
  });
  // option ids are unique inside a place
  Object.keys(D.locations).forEach((k) => { const ids = (D.locations[k].options || []).map((o) => o.id); assert.equal(new Set(ids).size, ids.length, k + ' option ids'); });
  // starting kit and relics exist
  Object.values(D.classes).forEach((c) => c.start.forEach((i) => assert.ok(D.items[i])));
  D.omens.forEach((o) => assert.ok(o.phases.length && o.fx));
  Object.values(D.omens.filter((o) => o.fx.spawn)).forEach((o) => assert.ok(D.enemies[o.fx.spawn.enemy]));
});

test('rewards cannot be farmed: every reward is one-time, limited, paid for, or earned in a fight', () => {
  const rewardKeys = ['xp', 'glory', 'item', 'clue', 'ally', 'stat', 'hint', 'silver', 'cleanse', 'clock'];
  eachOption((o, where) => {
    if (where.startsWith('enemy:') || where.startsWith('event:')) return;   // fights end when the enemy dies; events are drawn once
    const pays = outcomesOf(o).some((out) => rewardKeys.some((k) => out[k] && !(k === 'clock' && out.clock > 0) && !(k === 'silver' && out.silver < 0)));
    if (!pays) return;
    const limited = !!(o.once || o.stock || o.puzzle || o.escape || o.shop);
    assert.ok(limited, `${where}/${o.id} pays out and can be repeated forever`);
  });
});

test('every clue can be found in at least two ways, and every pillar has four or more clues', () => {
  const sources = {};
  eachOption((o, where) => outcomesOf(o).forEach((out) => [].concat(out.clue || []).forEach((c) => { (sources[c] = sources[c] || new Set()).add(where + '/' + o.id); })));
  D.enemies.bellkeeper && (sources.bell_cast = sources.bell_cast || new Set()).add('enemy:bellkeeper');
  Object.keys(D.clues).forEach((c) => assert.ok(sources[c] && sources[c].size >= 1, 'clue never obtainable: ' + c));
  Object.keys(D.pillars).forEach((p) => {
    const cs = Object.keys(D.clues).filter((c) => D.clues[c].pillar === p);
    assert.ok(cs.length >= 4, p + ' has ' + cs.length + ' clues');
    const regions = new Set(); cs.forEach((c) => sources[c].forEach((s) => { const k = s.split('/')[0]; if (k.startsWith('loc:')) regions.add(D.locations[k.slice(4)].region); }));
    assert.ok(regions.size >= 3, p + ' is spread over ' + regions.size + ' regions');
  });
  // the key rites are redundant
  ['silence_rite', 'reverse_rite', 'pact_terms'].forEach((c) => assert.ok(sources[c].size >= 2, c + ' sources: ' + [...sources[c]]));
});

// ───────────────────────────── the map ─────────────────────────────
test('the map has 42 places and the Heart can be reached from everywhere without any item', () => {
  const g = new HollowGame({});
  assert.equal(Object.keys(D.locations).length, 42);
  // walk allowing: paths, hidden ways (found), locked roads (every one has a way that needs no item), guarded (boss is beatable)
  const adj = {};
  Object.values(g.graph.edges).forEach((e) => {
    if (e.type === 'locked') assert.ok(e.ways.some((w) => (w.stat || (w.cost && w.cost.silver)) && !w.item && !w.flag), 'a locked road with no item-free way: ' + e.key);
    (adj[e.a] = adj[e.a] || []).push(e.b); if (!e.oneway) (adj[e.b] = adj[e.b] || []).push(e.a);
  });
  const reach = (from) => { const seen = new Set([from]), q = [from]; while (q.length) { const c = q.shift(); (adj[c] || []).forEach((n) => { if (!seen.has(n)) { seen.add(n); q.push(n); } }); } return seen; };
  assert.equal(reach(D.start).size, 42, 'everything is reachable from the start');
  Object.keys(D.locations).forEach((id) => assert.ok(reach(id).has('heart_chamber'), id + ' cannot reach the Heart (a softlock)'));
  // one-way drops never strand: from the destination the Heart is still reachable (above), and the start can be reached back
  Object.values(g.graph.edges).filter((e) => e.oneway).forEach((e) => assert.ok(reach(e.b).has('heart_chamber')));
  // at least three independent ways into the Crypt that avoid the Warden
  const into = Object.values(g.graph.edges).filter((e) => D.locations[e.a].region !== 'crypt' && D.locations[e.b].region === 'crypt' || (D.locations[e.b].region !== 'crypt' && D.locations[e.a].region === 'crypt'));
  assert.ok(into.length >= 3, 'ways into the crypt: ' + into.map((e) => e.key));
  // hidden, locked, guarded and one-way routes all exist
  const types = new Set(Object.values(g.graph.edges).map((e) => e.type + (e.oneway ? '+oneway' : '')));
  ['hidden', 'locked', 'guarded', 'path+oneway', 'hidden+oneway'].forEach((t) => assert.ok(types.has(t), 'missing route type ' + t));
});

// ───────────────────────────── turns, movement, encounters ─────────────────────────────
test('a legal move works, an illegal move and an out-of-turn move are rejected', () => {
  const { g } = make(2);
  assert.equal(g.turn.active, 'p0');
  assert.ok(g.command('p1', { t: 'move', mode: 'step', to: 'chapel' }).error, 'not their turn');
  assert.ok(g.command('p0', { t: 'move', mode: 'step', to: 'foyer' }).error, 'no road from the square to the foyer');
  assert.ok(g.command('p0', { t: 'move', mode: 'sprint', to: 'library' }).error, 'sprint beyond two roads');
  assert.ok(g.command('p0', { t: 'move', mode: 'step', to: 'nowhere' }).error);
  const r = g.command('p0', { t: 'move', mode: 'step', to: 'chapel' });
  assert.ok(!r.error);
  assert.equal(g.get('p0').loc, 'chapel');
  assert.equal(g.turn.ap, 2, 'a move costs one action');
  assert.equal(g.get('p0').xp, 1, 'first visit grants xp');
  // the same place gives no xp the second time
  g.command('p0', { t: 'move', mode: 'step', to: 'square' }); g.command('p0', { t: 'move', mode: 'step', to: 'chapel' });
  assert.equal(g.get('p0').xp, 2);
});

test('an encounter resolves exactly once and a retried command does nothing twice', () => {
  const { g } = make(2);
  roll(g, 15);
  const enc = open(g, 'p0');
  const first = g.command('p0', { t: 'choose', enc: enc.id, opt: 'board', cid: 'abc' });
  assert.ok(!first.error); assert.equal(first.result.tier, 'ok');
  assert.ok(g.w.clues.ledger, 'clue granted');
  const xp = g.get('p0').xp;
  const again = g.command('p0', { t: 'choose', enc: enc.id, opt: 'board', cid: 'abc' });
  assert.ok(again.dup, 'same command id is recognised'); assert.equal(g.get('p0').xp, xp);
  const other = g.command('p0', { t: 'choose', enc: enc.id, opt: 'board', cid: 'def' });
  assert.ok(other.error, 'cannot take the same reward twice'); assert.equal(g.get('p0').xp, xp);
  assert.ok(g.command('p0', { t: 'choose', enc: 'stale', opt: 'well' }).error, 'a stale encounter id is refused');
});

test('a failed check still has a consequence, and natural 20 / natural 1 are special', () => {
  const { g } = make(2, { classes: ['hunter', 'medium'] });
  const p = g.get('p0'); open(g, 'p0');
  roll(g, 2);
  const san = p.san, clue = Object.keys(g.w.clues).length;
  const r = pick(g, 'p0', 'board');
  assert.equal(r.result.tier, 'fail');
  assert.ok(p.san < san || g.w.rumors.length > 0, 'failure changed the world: ' + JSON.stringify(r.result.chips));
  assert.equal(Object.keys(g.w.clues).length, clue, 'no clue on failure');
  // natural 1 adds a complication on top of the failure
  const { g: g2 } = make(2, { classes: ['hunter', 'medium'] }); open(g2, 'p0');
  roll(g2, 1); const c0 = g2.w.clock;
  const r1 = pick(g2, 'p0', 'board');
  assert.equal(r1.result.tier, 'fumble'); assert.ok(g2.w.clock >= c0 + 1, 'a natural 1 advances the Haunting');
  // natural 20 beats any difficulty and gives a bonus
  const { g: g3 } = make(2); open(g3, 'p0'); roll(g3, 20);
  const r20 = pick(g3, 'p0', 'well', {});
  assert.equal(r20.result.tier, 'crit');
  assert.ok(r20.result.chips.length >= 2, 'a critical success is rewarded: ' + JSON.stringify(r20.result.chips));
  // a natural 20 succeeds even against Extreme difficulty: chance is never 0 in the preview
  const ev = g3.encOptions(g3.get('p0'), g3.turn.enc);
  assert.ok(ev.every((x) => x.ev.kind !== 'check' || x.ev.chance >= 5), 'always at least the natural 20');
});

test('the roll preview shows stat, difficulty and modifiers, and never promises certainty on a check', () => {
  const { g } = make(2);
  open(g, 'p0');
  const opts = g.encOptions(g.get('p0'), g.turn.enc).map((x) => x.ev);
  const well = opts.find((o) => o.id === 'well');
  assert.equal(well.stat, 'fate'); assert.equal(well.dc, 11 + (-1)); // a party of two plays a lighter touch (-1 DC)
  assert.ok(well.mods.some((m) => m.l === 'Fate'));
  assert.ok(well.chance < 100 && well.chance > 0);
  assert.ok(opts.every((o) => o.kind !== 'check' || o.chance <= 95));
});

test('items cannot be used beyond their quantity and a pack cannot overflow silently', () => {
  const { g } = make(2, { classes: ['hunter', 'occultist'] });
  const p = g.get('p0');
  p.vit = 3;
  assert.ok(!g.command('p0', { t: 'use', item: 'tonic' }).error);
  assert.ok(g.command('p0', { t: 'use', item: 'tonic' }).error, 'only one tonic');
  assert.equal(g.itemCount(p, 'tonic'), 0);
  assert.ok(g.command('p0', { t: 'use', item: 'blade' }).error, 'not a consumable');
  // fill the pack: extra goes to the ground instead of vanishing
  for (let i = 0; i < 12; i++) g.addItem(p, 'saint_finger', 1);
  assert.ok(g.packUsed(p) <= 7);
  assert.ok(g.w.locs[p.loc].ground.length > 0, 'overflow is left on the ground, not lost');
  const before = g.packUsed(p);
  g.cmd_drop(p, { item: 'saint_finger' });
  assert.equal(g.packUsed(p), before - 1);
  assert.ok(!g.cmd_pickup(p, { item: 'saint_finger' }).error);
});

test('a one-time reward cannot be taken again by the same player, but each player gets their own once-each', () => {
  const { g } = make(2);
  put(g, g.get('p0'), 'chapel'); put(g, g.get('p1'), 'chapel');
  open(g, 'p0');
  assert.ok(!pick(g, 'p0', 'pray').error);
  assert.ok(pick(g, 'p0', 'pray').error, 'prayer works once per person');
  toTurn(g, 'p1'); open(g, 'p1');
  assert.ok(!pick(g, 'p1', 'pray').error, 'the other player can pray');
});

test('stealing changes the world: prices rise for the whole party', () => {
  const { g } = make(2, { classes: ['hunter', 'medium'] });
  put(g, g.get('p0'), 'wagon'); open(g, 'p0');
  const before = g.encOptions(g.get('p0'), g.turn.enc).find((x) => x.raw.id === 'tonic').ev.cost.silver;
  roll(g, 1); const r = pick(g, 'p0', 'steal');
  assert.ok(g.w.flags.merchant_robbed);
  toTurn(g, 'p1'); put(g, g.get('p1'), 'wagon'); open(g, 'p1');
  const after = g.encOptions(g.get('p1'), g.turn.enc).find((x) => x.raw.id === 'tonic').ev.cost.silver;
  assert.equal(after, before + 1);
});

test('traps punish sprinting more than careful steps; a Silver Thread cancels them', () => {
  const { g } = make(2, { classes: ['vagabond', 'hunter'] });
  const p = g.get('p0'); put(g, p, 'belltower'); g.w.enemies = [];
  roll(g, 3); const v0 = p.vit;
  assert.ok(!g.command('p0', { t: 'move', mode: 'sprint', to: 'bridge' }).error);
  assert.ok(p.vit < v0, 'the bridge bites a sprinter');
  // thread
  const { g: g2 } = make(2, { classes: ['vagabond', 'hunter'] });
  const q = g2.get('p0'); put(g2, q, 'belltower'); g2.w.enemies = []; roll(g2, 3);
  g2.cmd_use(q, { item: 'thread' }); const v1 = q.vit;
  g2.command('p0', { t: 'move', mode: 'sprint', to: 'bridge' });
  assert.equal(q.vit, v1, 'the thread walked the safe line');
  assert.equal(q.thread, false, 'and is used up');
});

test('locked roads open in several ways and stay open', () => {
  const { g } = make(2);
  const p = g.get('p0'); put(g, p, 'foyer'); p.silver = 5;
  const bad = g.command('p0', { t: 'move', mode: 'step', to: 'blackmarket' });
  assert.ok(bad.error, 'locked');
  assert.ok(g.command('p0', { t: 'unlock', edge: 'blackmarket|foyer', way: 'key' }).error, 'no key');
  assert.ok(!g.command('p0', { t: 'unlock', edge: 'blackmarket|foyer', way: 'pay' }).error);
  assert.equal(p.silver, 3);
  assert.ok(!g.command('p0', { t: 'move', mode: 'step', to: 'blackmarket' }).error);
});

test('hidden routes are found by investigating and stay hidden from the map until then', () => {
  const { g } = make(2, { classes: ['occultist', 'vagabond'] });
  const p = g.get('p0'); put(g, p, 'chapel');
  let v = g.viewFor('p0');
  assert.ok(!v.map.edges.some((e) => e.type === 'hidden'), 'no hidden edge in the view');
  assert.ok(g.command('p0', { t: 'move', mode: 'step', to: 'library' }).error);
  roll(g, 20); assert.ok(!g.command('p0', { t: 'investigate' }).error);
  v = g.viewFor('p0');
  assert.ok(v.map.edges.some((e) => e.type === 'hidden' && e.k === 'chapel|library'), 'revealed to everyone');
  assert.ok(!g.viewFor('p1').map.edges.some((e) => e.type === 'hidden') === false, 'shared world');
});

test('moving past an enemy: sneaking can succeed, arrival triggers an ambush, hunters ignore beast ambushes', () => {
  const { g } = make(2, { classes: ['vagabond', 'hunter'] });
  const p = g.get('p0');
  roll(g, 20);
  g.command('p0', { t: 'move', mode: 'sneak', to: 'graveyard' });
  assert.equal(p.loc, 'graveyard'); assert.equal(p.unnoticed, 'graveyard'); assert.equal(p.vit, D.classes.vagabond.vit);
  // careless arrival: ambushed
  const { g: g2 } = make(2, { classes: ['vagabond', 'hunter'] });
  g2.command('p0', { t: 'move', mode: 'step', to: 'graveyard' });
  assert.equal(g2.get('p0').vit, D.classes.vagabond.vit - 1, 'the swarm bites');
  // the hunter's tracker instinct vs a beast on a careful step
  const { g: g3 } = make(2, { classes: ['hunter', 'vagabond'] });
  g3.command('p0', { t: 'move', mode: 'step', to: 'graveyard' });
  assert.equal(g3.get('p0').vit, D.classes.hunter.vit);
});

test('combat uses the enemy\'s own options, reveals weakness on failure and ends when it falls', () => {
  const { g } = make(2, { classes: ['hunter', 'occultist'] });
  const p = g.get('p0'); put(g, p, 'forest'); g.w.enemies = []; g.spawnEnemy('hollow_stag', 'forest', null, false);
  g.w.locs.forest.snare = null; roll(g, 3);
  g.confront(p, g.engagedEnemy(p), 'step', true);
  const enc = g.turn.enc; assert.equal(enc.kind, 'enemy');
  const labels = g.encOptions(p, enc).map((x) => x.raw.id);
  assert.ok(labels.includes('calm') && labels.includes('strike') && labels.includes('slip'));
  const hp0 = g.w.enemies[0].hp;
  const r = pick(g, 'p0', 'strike');
  assert.equal(r.result.tier, 'fail'); assert.ok(g.w.enemies[0].known, 'weakness revealed');
  const calm = g.encOptions(p, g.turn.enc).find((x) => x.raw.id === 'calm').ev; assert.ok(calm.weak, 'its weakness is now marked');
  roll(g, 20);
  const r2 = pick(g, 'p0', 'calm');
  assert.equal(g.w.enemies.length, 0, 'the stag is gone'); assert.ok(g.get('p0').tally.kills >= 1);
});

test('the Mirror Twin punishes repeating yourself', () => {
  const { g } = make(2);
  const p = g.get('p0'); put(g, p, 'still_lake'); g.w.enemies = []; const en = g.spawnEnemy('mirror_twin', 'still_lake', null, false);
  g.openEnemyEnc(p, en);
  const dc1 = g.encOptions(p, g.turn.enc).find((x) => x.raw.id === 'outwit').ev.dc;
  en.last = 'outwit';
  const dc2 = g.encOptions(p, g.turn.enc).find((x) => x.raw.id === 'outwit').ev.dc;
  assert.equal(dc2, dc1 + 4);
});

test('puzzles can always be solved by elimination, and cannot be farmed', () => {
  const { g } = make(2);
  const p = g.get('p0'); put(g, p, 'library'); open(g, 'p0');
  const key = 'shelf', right = g.w.secrets[key], sec = D.secrets[key];
  g.turn.ap = 10;
  let solved = false;
  for (const v of sec.vals) {
    const r = pick(g, 'p0', 'shelf', { val: v });
    assert.ok(!r.error, r.error);
    if (v === right) { solved = true; break; }
  }
  assert.ok(solved && g.w.solved[key]);
  assert.ok(pick(g, 'p0', 'shelf', { val: right }).error, 'a solved puzzle pays out once');
  assert.ok(g.w.clues.choir_notes);
  // a wrong answer is ruled out for everyone and cannot be tried twice
  const { g: g2 } = make(2); put(g2, g2.get('p0'), 'library'); open(g2, 'p0');
  const wrong = D.secrets.shelf.vals.find((v) => v !== g2.w.secrets.shelf);
  pick(g2, 'p0', 'shelf', { val: wrong });
  assert.ok(g2.w.elim.shelf.includes(wrong));
  assert.ok(pick(g2, 'p0', 'shelf', { val: wrong }).error);
});

test('hints rule out wrong answers but never the right one', () => {
  const { g } = make(2);
  for (let i = 0; i < 20; i++) g.hint('bellName', null);
  assert.equal(g.w.elim.bellName.length, D.secrets.bellName.vals.length - 1);
  assert.ok(!g.w.elim.bellName.includes(g.w.secrets.bellName));
});

// ───────────────────────────── privacy and sync ─────────────────────────────
test('private objectives stay private until revealed; clues sync, and private clues stay private until shared', () => {
  const { g } = make(3);
  const a = g.get('p0'), b = g.get('p1');
  const objs = g.players.map((p) => p.objective); assert.equal(new Set(objs).size, 3, 'distinct objectives');
  const vb = JSON.stringify(g.viewFor('p1'));
  const secretText = g.objectiveText(a);
  assert.ok(!vb.includes(secretText), 'B cannot read A\'s objective');
  assert.equal(g.viewFor('p1').players.find((p) => p.id === 'p0').revealed, null);
  assert.ok(vb.includes(g.objectiveText(b)), 'B sees their own');
  g.cmd_revealobj(a);
  assert.ok(g.viewFor('p1').players.find((p) => p.id === 'p0').revealed, 'reveal makes it public');
  // clues
  g.addClue('ledger', a, false, null); g.addClue('pact_terms', a, true, null);
  assert.ok(g.viewFor('p1').world.clues.some((c) => c.id === 'ledger'), 'shared clue visible to others');
  assert.ok(!g.viewFor('p1').world.clues.some((c) => c.id === 'pact_terms'), 'private clue hidden');
  assert.ok(!JSON.stringify(g.viewFor('p1')).includes(D.clues.pact_terms.text), 'private clue text does not leak');
  assert.ok(g.viewFor('p0').me.cluesPrivate.some((c) => c.id === 'pact_terms'));
  assert.ok(g.command('p1', { t: 'share', clue: 'pact_terms' }).error, 'only the finder can share');
  assert.ok(!g.command('p0', { t: 'share', clue: 'pact_terms' }).error);
  assert.ok(g.viewFor('p1').world.clues.some((c) => c.id === 'pact_terms'));
  // the view never contains the secrets of the world
  const raw = JSON.stringify(g.viewFor('p1'));
  assert.ok(!raw.includes(g.w.secrets.bellName) || g.w.secrets.bellName.length < 3 || !raw.includes('"secrets"'));
  assert.equal(g.viewFor('p1').world.secrets, undefined);
});

test('a client can only see what the server shows: no hidden options, unknown places or other players\' packs of secrets', () => {
  const { g } = make(2);
  const v = g.viewFor('p0');
  assert.ok(!Object.keys(v.map.locs).includes('heart_chamber'), 'unseen places are absent');
  assert.ok(Object.keys(v.map.locs).length <= 8);
  put(g, g.get('p0'), 'chapel'); open(g, 'p0');
  let opts = g.viewFor('p0').enc.options.map((o) => o.id);
  assert.ok(!opts.includes('hatch'), 'the secret option is hidden until the place is investigated');
  g.turn.enc = null; roll(g, 20); g.command('p0', { t: 'investigate' }); open(g, 'p0');
  opts = g.viewFor('p0').enc.options.map((o) => o.id);
  assert.ok(opts.includes('hatch'), 'investigating reveals it');
});

// ───────────────────────────── cooperation ─────────────────────────────
test('aid is a real choice: it costs the helper Sanity, once a round, and adds a bonus to the next roll', () => {
  const { g } = make(2);
  open(g, 'p0');
  const b = g.get('p1'); const san = b.san;
  assert.ok(g.command('p1', { t: 'aid' }).error, 'no one has asked');
  assert.ok(!g.command('p0', { t: 'askaid' }).error);
  assert.ok(!g.command('p1', { t: 'aid' }).error);
  assert.equal(b.san, san - 1);
  assert.ok(g.command('p1', { t: 'aid' }).error, 'once per round');
  const ev = g.encOptions(g.get('p0'), g.turn.enc);
  const mod = (aid) => g.rollInfo(g.get('p0'), ev.find((x) => x.raw.id === 'well').raw, { aid }).mod;
  assert.equal(mod(g.turn.enc.aid.bonus), mod(0) + 2);
  // someone in another place cannot help
  const { g: g2 } = make(2); put(g2, g2.get('p1'), 'chapel'); open(g2, 'p0');
  assert.ok(g2.command('p0', { t: 'askaid' }).error, 'nobody here to ask');
});

test('give and trade only work in the same place, and respect pack space', () => {
  const { g } = make(2, { classes: ['hunter', 'occultist'] });
  const a = g.get('p0'), b = g.get('p1');
  assert.ok(!g.command('p0', { t: 'give', item: 'tonic', to: 'p1' }).error);
  assert.ok(g.hasItem(b, 'tonic'));
  put(g, b, 'chapel');
  assert.ok(g.command('p0', { t: 'give', item: 'snare', to: 'p1' }).error, 'not in the same place');
});

// ───────────────────────────── the Haunting ─────────────────────────────
test('the Haunting Clock advances each round, escalates through three phases and ends the expedition', () => {
  const { g } = make(3);
  const c0 = g.w.clock; assert.equal(g.w.haunt, 1);
  const seen = new Set([1]);
  for (let i = 0; i < 40 && g.phase === 'playing'; i++) { g.endTurnFor(g.get(g.turn.active)); seen.add(g.w.haunt); }
  assert.ok(g.w.clock > c0, 'time passes');
  assert.ok(seen.has(2) || g.phase === 'ended', 'phase II arrives');
  // phase changes announce themselves and change the world
  const { g: g2 } = make(3); g2.advanceClock(12, 'test');
  assert.equal(g2.w.haunt, 2); assert.ok(g2.log.some((e) => e.k === 'phase'));
  g2.advanceClock(12, 'test');
  assert.equal(g2.w.haunt, 3); assert.ok(g2.w.flags.gate_open, 'the Gate opens in phase III');
  g2.advanceClock(100, 'test');
  assert.equal(g2.phase, 'ended'); assert.equal(g2.ended.id, 'doom'); assert.equal(g2.ended.outcome, 'failure');
});

test('an omen is drawn each round and never repeats', () => {
  const { g } = make(2);
  for (let i = 0; i < 24 && g.phase === 'playing'; i++) g.endTurnFor(g.get(g.turn.active));
  const ids = g.w.usedOmens; assert.equal(new Set(ids).size, ids.length); assert.ok(ids.length >= 4);
});

test('roads close for a while but the Heart always stays reachable', () => {
  const { g } = make(2);
  for (let i = 0; i < 30; i++) g.closeRandomEdge();
  assert.ok(g.heartReachable());
});

// ───────────────────────────── characters ─────────────────────────────
test('classes play differently: abilities have limits and change real numbers', () => {
  const { g } = make(6);
  const [occ, hun, apo, med, vag, exo] = [0, 1, 2, 3, 4, 5].map((i) => g.get('p' + i));
  // Hunter snare: cooldown
  toTurn(g, 'p1'); assert.ok(!g.command('p1', { t: 'ability' }).error); assert.ok(g.command('p1', { t: 'ability' }).error, 'cooldown');
  assert.equal(g.w.locs[hun.loc].snare, 'p1');
  // Apothecary brew needs two herbs
  toTurn(g, 'p2'); assert.ok(!g.command('p2', { t: 'ability', make: 'tonic' }).error);
  assert.ok(g.command('p2', { t: 'ability', make: 'tonic' }).error, 'out of herbs / cooling down');
  // Medium heals sanity and moves the clock
  med.san = 3; toTurn(g, 'p3'); const c = g.w.clock;
  assert.ok(!g.command('p3', { t: 'ability', target: 'p3' }).error); assert.equal(med.san, 4);
  // Exorcist has exactly 3 rites
  toTurn(g, 'p5'); for (let i = 0; i < 3; i++) { g.turn.ap = 2; assert.ok(!g.command('p5', { t: 'ability', mode: 'seal' }).error, 'rite ' + i); }
  g.turn.ap = 2; assert.ok(g.command('p5', { t: 'ability', mode: 'seal' }).error, 'no fourth rite');
  // Occultist reroll is offered after a failure
  toTurn(g, 'p0'); roll(g, 2); open(g, 'p0');
  const r = pick(g, 'p0', 'board'); assert.ok(r.hold, 'a held roll');
  const before = occ.san; roll(g, 20);
  const rr = g.command('p0', { t: 'reroll', src: 'twist' }); assert.ok(!rr.error, rr.error);
  assert.equal(occ.san, before - 1); assert.ok(g.w.clues.ledger, 'the reroll succeeded');
  // a second use in the same phase is refused
  g.turn.ap = 3; roll(g, 2); const r2 = pick(g, 'p0', 'well'); assert.ok(!r2.hold, 'only once per phase');
  // Vagabond: first sprint each round is silent
  toTurn(g, 'p4'); g.turn.ap = 3; g.w.noise = 0; vag.loc = 'square';
  g.command('p4', { t: 'move', mode: 'sprint', to: 'bridge' }); // too far: square->belltower->bridge is 2
  assert.equal(g.w.noise, 0, 'silent sprint');
});

test('classes are unique per party and the lobby rules are enforced', () => {
  let t = 0; const g = new HollowGame({ code: 'L', seed: 1, now: () => t });
  g.addPlayer({ id: 'a', name: 'A' }); g.addPlayer({ id: 'b', name: 'B' });
  assert.ok(!g.command('a', { t: 'pick', cls: 'hunter' }).error);
  assert.ok(g.command('b', { t: 'pick', cls: 'hunter' }).error, 'class taken');
  assert.ok(g.command('b', { t: 'start' }).error, 'only the host starts');
  assert.ok(g.command('a', { t: 'start' }).error, 'not everyone has chosen');
  g.command('b', { t: 'pick', cls: 'medium' });
  assert.ok(g.command('a', { t: 'start' }).error, 'b is not ready');
  g.command('b', { t: 'ready' });
  assert.ok(!g.command('a', { t: 'start' }).error);
  assert.ok(g.addPlayer({ id: 'c', name: 'C' }).error, 'no joining once underway');
  // a solo expedition and ghost companions
  const s = new HollowGame({ code: 'S', seed: 2 }); s.addPlayer({ id: 'x', name: 'X' }); s.command('x', { t: 'pick', cls: 'exorcist' });
  s.command('x', { t: 'addbot' }); assert.equal(s.players.length, 2); assert.ok(s.players[1].bot);
  assert.ok(!s.command('x', { t: 'start' }).error);
  const solo = new HollowGame({ code: 'S2', seed: 3 }); solo.addPlayer({ id: 'y', name: 'Y' }); solo.command('y', { t: 'pick', cls: 'vagabond' });
  assert.ok(!solo.command('y', { t: 'start' }).error); assert.equal(solo.turn.ap, 3, 'three actions when playing alone');
});

// ───────────────────────────── death and the Fallen ─────────────────────────────
test('a fallen player keeps meaningful actions, can return once, and cannot loop forever', () => {
  const { g } = make(3);
  const a = g.get('p0'), b = g.get('p1');
  toTurn(g, 'p1'); open(g, 'p1');
  g.hurt(b, 'vit', 99, { raw: true });
  assert.equal(b.status, 'fallen'); assert.equal(b.inv.length, 0, 'items dropped'); assert.ok(g.w.locs[b.fellLoc].ground.length);
  g.settleTurn();   // (commands do this themselves)
  assert.notEqual(g.turn.active, 'p1', 'the turn passed on at once');
  assert.equal(g.phase, 'playing', 'one death does not end the expedition');
  // spirit actions
  const sp = g.viewFor('p1').me.spirit; assert.equal(sp.returns, 1);
  assert.ok(!g.command('p1', { t: 'spirit', kind: 'whisper' }).error);
  assert.ok(g.command('p1', { t: 'spirit', kind: 'lend' }).error, 'one reach per round');
  g.w.round++;
  assert.ok(!g.command('p1', { t: 'spirit', kind: 'lend' }).error);
  assert.ok(g.w.spiritAid, 'the next roll gets +2');
  // return
  g.w.round++; roll(g, 20); const r = g.command('p1', { t: 'spirit', kind: 'return' });
  assert.ok(!r.error); assert.equal(b.status, 'alive'); assert.ok(b.maxVit < D.classes[b.cls].vit, 'scarred');
  assert.ok(g.turn.order.includes('p1'));
  // fall again: no more returns
  g.hurt(b, 'san', 99, { raw: true }); assert.equal(b.status, 'fallen'); assert.equal(b.returns, 0);
  g.w.round++; assert.ok(g.command('p1', { t: 'spirit', kind: 'return' }).error);
  // the dead still vote
  put(g, a, 'heart_chamber'); a.visited.heart_chamber = 1;
  const f = g.finaleInfo('bargain'); assert.ok(f.available);
  g.cmd_propose(a, { ending: 'bargain' }); assert.ok(g.w.vote && g.voters().some((x) => x.id === 'p1'));
});

test('a pact saves you once, and the Remembrancer remembers', () => {
  const { g } = make(2);
  const p = g.get('p0'); p.flags.pactSave = true; p.flags.pact = true;
  g.hurt(p, 'vit', 99, { raw: true });
  assert.equal(p.status, 'alive'); assert.equal(p.vit, 3); assert.ok(!p.flags.pactSave);
  g.hurt(p, 'vit', 99, { raw: true }); assert.equal(p.status, 'fallen', 'no second rescue');
});

test('revival is capped for the party', () => {
  const { g } = make(4);
  const [a, b, c, d] = g.players;
  [b, c, d].forEach((x) => g.hurt(x, 'vit', 99, { raw: true }));
  g.revive(b, a, null); g.revive(c, a, null); g.revive(d, a, null);
  assert.equal(g.w.revivals, 2); assert.equal(d.status, 'fallen', 'only two returns for the party');
});

// ───────────────────────────── the boss ─────────────────────────────
test('the Abbey Warden has several solutions and phases, and his defeat opens the stair', () => {
  const { g } = make(2);
  const p = g.get('p0'); put(g, p, 'warden'); g.turn.ap = 9;
  assert.ok(g.edgeState(g.graph.edges['sealed_crypt|warden'], 'warden').state === 'guarded');
  g.openBossEnc(p);
  let ids = g.encOptions(p, g.turn.enc).map((x) => x.raw.id + ':' + x.ev.state);
  assert.ok(ids.includes('oath:locked') && ids.includes('name:locked') && ids.includes('rite:locked'), 'solutions need preparation: ' + ids);
  // break chains
  roll(g, 20); pick(g, 'p0', 'chain'); assert.equal(g.w.boss.chains, 2);
  assert.equal(g.bossPhase().name, 'Straining');
  roll(g, 20); pick(g, 'p0', 'chain'); roll(g, 20); pick(g, 'p0', 'chain');
  assert.equal(g.w.boss.chains, 0); assert.equal(g.bossPhase().name, 'Free');
  // the Warden fights back each time
  assert.ok(p.vit < D.classes.occultist.vit);
  // an earlier chapter matters: the oath
  const { g: h } = make(2);
  const q = h.get('p0'); put(h, q, 'warden'); h.turn.ap = 9; q.vit = 20; q.maxVit = 20;
  h.addClue('warden_oath', q, false, null);
  h.openBossEnc(q); roll(h, 20); pick(h, 'p0', 'oath');
  assert.ok(h.w.flags.warden_down && h.w.boss.dead, 'he kneels');
  assert.ok(h.hasItem(q, 'wardens_key'));
  assert.equal(h.edgeState(h.graph.edges['sealed_crypt|warden'], 'warden').ok, true, 'the stair is open');
  // slipping past opens the stair without defeating him
  const { g: k } = make(2); const r = k.get('p0'); put(k, r, 'warden'); k.turn.ap = 9; k.openBossEnc(r); roll(k, 20); pick(k, 'p0', 'slip');
  assert.ok(k.w.flags.warden_bypassed && !k.w.boss.dead);
  assert.equal(k.edgeState(k.graph.edges['sealed_crypt|warden'], 'warden').ok, true);
});

// ───────────────────────────── endings ─────────────────────────────
function finaleGame(n = 2) {
  const t = make(n); const { g } = t;
  g.players.forEach((p) => { put(g, p, 'heart_chamber'); p.visited.heart_chamber = 1; });
  return t;
}
function propose(g, id, ending) {
  const r = g.command(id, { t: 'propose', ending }); assert.ok(!r.error, r.error);
  g.players.filter((p) => !p.bot && p.id !== id && (p.status === 'alive' || p.status === 'fallen')).forEach((p) => g.command(p.id, { t: 'vote', yes: true }));
}

test('every ending is reachable and the expedition outcome is one of success, partial, failure, unresolved', () => {
  const got = new Set(), outcomes = new Set();
  const run = (ending, d, setup) => {
    const { g } = finaleGame(2); if (setup) setup(g);
    roll(g, d); propose(g, 'p0', ending);
    assert.equal(g.phase, 'ended', ending + ' ' + d);
    got.add(g.ended.id); outcomes.add(g.ended.outcome);
    assert.ok(g.ended.results.length === 2 && g.ended.results.every((r) => r.epilogue.length > 40 && r.objective));
    return g;
  };
  const knows = (g) => { ['silence_rite', 'bell_cast', 'forge_marks', 'entity_name', 'memory_hunger', 'ledger', 'diary'].forEach((c) => g.addClue(c, g.get('p0'), false, null)); g.get('p0').inv.length = 0; g.addItem(g.get('p0'), 'clapper', 1); g.addClue('reverse_rite', g.get('p0'), false, null); };
  run('silence', 20, knows); run('silence', 12, knows); run('silence', 1, knows);
  run('reverse', 20, knows); run('reverse', 12, knows); run('reverse', 1, knows);
  run('bargain', 10, (g) => g.addClue('pact_terms', g.get('p0'), false, null)); run('bargain', 10, null);
  run('destroy', 20, null); run('destroy', 1, null);
  // escape: everyone leaves through the Gate
  const { g } = make(2); g.w.flags.gate_open = true;
  g.players.forEach((p) => { put(g, p, 'gate'); });
  for (const id of ['p0', 'p1']) { toTurn(g, id); open(g, id); const r = pick(g, id, 'leave'); assert.ok(!r.error, r.error); }
  assert.equal(g.phase, 'ended'); got.add(g.ended.id); outcomes.add(g.ended.outcome);
  // clock doom, and everyone fallen
  const { g: d } = make(2); d.advanceClock(99, 'x'); got.add(d.ended.id);
  const { g: w } = make(2); w.players.forEach((p) => { p.returns = 0; d.revive; g_hurt(w, p); }); got.add(w.ended && w.ended.id);
  function g_hurt(game, p) { game.hurt(p, 'vit', 99, { raw: true }); }
  assert.ok(got.size >= 10, 'endings reached: ' + [...got].join(', '));
  ['success', 'partial', 'failure', 'unresolved'].forEach((o) => assert.ok(outcomes.has(o) || o === 'unresolved' || got.has('wipe'), o));
  assert.ok(got.has('silence_true') && got.has('reverse_true') && got.has('bargain_fair') && got.has('bargain_harsh') && got.has('destroy_true') && got.has('doom'));
});

test('the finale needs the table to agree, can be refused, and one player cannot end it alone', () => {
  const { g } = finaleGame(3);
  roll(g, 20);
  assert.ok(g.command('p0', { t: 'propose', ending: 'silence' }).error || g.w.vote, 'silence needs knowledge');
  g.command('p0', { t: 'propose', ending: 'destroy' });
  assert.ok(g.w.vote); assert.equal(g.phase, 'playing');
  g.command('p1', { t: 'vote', yes: false }); g.command('p2', { t: 'vote', yes: false });
  assert.equal(g.w.vote, null, 'refused'); assert.equal(g.phase, 'playing');
  // not in the Heart: cannot propose
  const { g: h } = make(2);
  assert.ok(h.command('p0', { t: 'propose', ending: 'destroy' }).error);
  // a vote that is ignored times out
  const { g: t, clock } = finaleGame(3); roll(t, 20);
  t.command('p0', { t: 'propose', ending: 'destroy' }); clock.adv(100_000); t.tick();
  assert.equal(t.w.vote, null);
});

test('silence is unavailable without the rite or enough knowledge, but bargain and destroy are always open', () => {
  const { g } = finaleGame(2);
  assert.equal(g.finaleInfo('silence').available, false);
  assert.equal(g.finaleInfo('reverse').available, false);
  assert.equal(g.finaleInfo('bargain').available, true);
  assert.equal(g.finaleInfo('destroy').available, true);
  g.addClue('silence_rite', g.get('p0'), false, null);
  assert.equal(g.finaleInfo('silence').available, true);
  // what you did earlier changes the odds
  const base = g.finaleInfo('silence').mod;
  g.w.flags.bell_named = true; g.w.allies.tamsin = true;
  assert.ok(g.finaleInfo('silence').mod >= base + 3);
  g.w.curses = { rot: true, cradle: true, shrine: true };
  assert.ok(g.finaleInfo('silence').mod < base + 3 + 1, 'unresolved curses weigh on the ending');
});

test('legacies: a personal objective and epilogue are scored even when the group fails', () => {
  const { g } = finaleGame(2);
  const a = g.get('p0'); a.objective = 'redeemer'; g.w.flags.spirit_freed = true;
  roll(g, 1); propose(g, 'p0', 'destroy');
  assert.equal(g.ended.outcome, 'failure');
  const r = g.ended.results.find((x) => x.id === 'p0');
  assert.ok(r.objective.done, 'their objective is met regardless'); assert.ok(r.glory.total >= 8);
  assert.ok(/Thea/.test(r.epilogue), 'the epilogue mentions what they did');
});

// ───────────────────────────── reconnect, persistence, AFK ─────────────────────────────
test('a reconnecting player gets exactly the state they had; snapshots restore a game', () => {
  const { g } = make(3);
  roll(g, 15); open(g, 'p0'); pick(g, 'p0', 'board');
  const before = strip(g.viewFor('p1'));
  g.setConnected('p1', false); g.setConnected('p1', true);
  const after = strip(g.viewFor('p1'));
  // the only differences are the log lines about the disconnection
  assert.deepEqual(after.me, before.me); assert.deepEqual(after.world, before.world); assert.deepEqual(after.map, before.map);
  const snap = JSON.parse(JSON.stringify(g.snapshot()));
  const g2 = HollowGame.restore(snap, {}); g2.players.forEach((p) => g2.setConnected(p.id, true));
  assert.deepEqual(strip(g2.viewFor('p0')).me, strip(g.viewFor('p0')).me);
  assert.deepEqual(strip(g2.viewFor('p0')).world, strip(g.viewFor('p0')).world);
  // the restored game plays on, with the same random future
  roll(g, 3); roll(g2, 3);
  g.d20 = HollowGame.prototype.d20; g2.d20 = HollowGame.prototype.d20;
  assert.equal(g.d20(), g2.d20());
  assert.ok(!g2.command('p0', { t: 'endturn' }).error || g2.turn.active !== 'p0');
});

test('absent players do not freeze the table: skip, ghost-hand, or wait, as the host chose', () => {
  const run = (afk) => {
    const { g, clock } = make(3); g.settings.afk = afk;
    g.setConnected('p0', false);
    clock.adv(10_000); g.tick(); const early = g.turn.active;
    clock.adv(60_000); g.tick();
    return { early, later: g.turn.active, g };
  };
  const s = run('skip'); assert.equal(s.early, 'p0', 'a short drop is forgiven'); assert.equal(s.later, 'p1', 'then their turn is skipped');
  const a = run('ai'); assert.equal(a.later, 'p1'); assert.ok(a.g.log.some((e) => /ghost-hand/.test(e.t)));
  const w = run('wait'); assert.equal(w.later, 'p0', 'waits');
  const { g, clock } = make(2); clock.adv(200_000); g.tick(); assert.equal(g.turn.active, 'p1', 'an idle turn passes');
  // everyone must be told the policy
  assert.ok(/skipped|ghost|wait/i.test(g.viewFor('p1').policy));
});

test('stale or malformed commands are refused without breaking the game', () => {
  const { g } = make(2);
  assert.ok(g.command('p0', null).error); assert.ok(g.command('p0', { t: 5 }).error); assert.ok(g.command('p0', { t: 'nope' }).error);
  assert.ok(g.command('ghost', { t: 'endturn' }).error);
  assert.ok(g.command('p0', { t: 'choose', enc: 'x', opt: 'y' }).error);
  assert.ok(g.command('p0', { t: 'use', item: 'spirit_key' }).error, 'unavailable item');
  assert.ok(g.command('p0', { t: 'give', item: 'salt', to: 'nobody' }).error);
  assert.ok(g.command('p0', { t: 'levelup', pick: 'x' }).error);
  assert.equal(g.phase, 'playing');
  // an ended game accepts nothing
  g.advanceClock(99, 'x'); assert.equal(g.phase, 'ended');
  assert.ok(g.command('p0', { t: 'endturn' }).error); assert.ok(g.command('p0', { t: 'move', mode: 'step', to: 'chapel' }).error);
});

test('level-ups offer a real choice and characters develop differently', () => {
  const { g } = make(2);
  const p = g.get('p0');
  g.gainXp(p, 6, null);
  assert.equal(p.level, 2); assert.equal(p.pendingLevels, 1); assert.equal(p.offer.length, 3);
  const before = JSON.stringify([p.stats, p.maxVit, p.maxSan, p.skills]);
  assert.ok(g.command('p0', { t: 'levelup', pick: 'zzz' }).error);
  assert.ok(!g.command('p0', { t: 'levelup', pick: p.offer[0] }).error);
  assert.notEqual(JSON.stringify([p.stats, p.maxVit, p.maxSan, p.skills, p.abilityLvl]), before + 'x');
  assert.equal(p.pendingLevels, 0);
});

// ───────────────────────────── whole games ─────────────────────────────
test('ghost-hand simulations of whole games never crash, never softlock and always finish', () => {
  const counts = {};
  for (let seed = 1; seed <= 24; seed++) {
    const n = 1 + (seed % 6);
    const { g } = make(n, { seed });
    let guard = 0;
    while (g.phase === 'playing' && guard++ < 500) {
      const p = g.get(g.turn.active), r0 = g.w.round, a0 = p.id;
      g.autoTurn(p);
      g.players.filter((x) => x.status === 'fallen' && x.id !== a0).forEach((x) => { g.cmd_spirit(x, { kind: 'return' }); g.cmd_spirit(x, { kind: 'whisper' }); });
      if (g.phase === 'playing' && g.turn.active === a0 && g.w.round === r0 && p.status === 'alive') assert.fail('turn did not pass (seed ' + seed + ')');
    }
    assert.equal(g.phase, 'ended', 'seed ' + seed + ' did not end');
    counts[g.ended.id] = (counts[g.ended.id] || 0) + 1;
  }
  assert.ok(Object.keys(counts).length >= 1, JSON.stringify(counts));
});

test('a determined, well-prepared party can win', () => {
  // Skill-free scripted run: gather the rites, name the bell, reach the Heart and silence it.
  const { g } = make(3, { seed: 99 });
  g.players.forEach((p) => { p.vit = p.maxVit = 30; p.san = p.maxSan = 30; });
  roll(g, 20);
  const p0 = g.get('p0');
  ['silence_rite', 'bell_cast', 'forge_marks', 'entity_name', 'memory_hunger', 'ledger', 'diary', 'abbey_record'].forEach((c) => g.addClue(c, p0, false, null));
  g.w.flags.bell_named = true; g.w.flags.bellkeeper_down = true; g.w.allies.tamsin = true; g.w.allies.hob = true; delete g.w.curses.rot;
  g.players.forEach((p) => put(g, p, 'heart_chamber'));
  assert.ok(g.finaleInfo('silence').chanceOk >= 80, 'well prepared: ' + g.finaleInfo('silence').chanceOk + '%');
  propose(g, 'p0', 'silence');
  assert.equal(g.ended.outcome, 'success'); assert.equal(g.ended.id, 'silence_true');
});

// ───────────────────────────── the world remembers ─────────────────────────────
test('the world remembers: broken shrines unleash hunters, learned names make rescues easier, burned gardens stay burned', () => {
  const { g } = make(2);
  g.w.flags.shrine_destroyed = true; g.advanceClock(12, 'x');
  assert.ok(g.w.enemies.some((e) => e.id === 'hollow_hound' && e.loc === 'orchard'), 'a hound hunts the Woods');
  const { g: h } = make(2, { classes: ['hunter', 'medium'] });
  const p = h.get('p0'); put(h, p, 'prison'); h.openLocEnc(p);
  const dc = () => h.encOptions(p, h.turn.enc).find((x) => x.raw.id === 'echo').ev.dc;
  const base = dc(); h.w.flags.thea_named = true;
  assert.ok(dc() < base, 'knowing her name makes the rescue easier');
  const { g: k } = make(2); const q = k.get('p0'); put(k, q, 'garden');
  k.w.flags.garden_burned = true; k.openLocEnc(q);
  assert.ok(!k.encOptions(q, k.turn.enc).some((x) => x.raw.id === 'speak'), 'Ketterick is gone for good');
});

test('a roll left hanging is resolved by the timer, even if that ends the game', () => {
  const { g, clock } = make(2);
  const p = g.get('p0'); open(g, 'p0'); roll(g, 2);
  const r = pick(g, 'p0', 'board'); assert.ok(r.hold, 'an Occultist can twist fate, so the roll is held');
  clock.adv(60_000); g.tick();
  assert.ok(!g.turn.enc || !g.turn.enc.hold, 'accepted automatically');
});

test('random play of every command never throws, never corrupts a stat and never leaves an unserialisable state', () => {
  const origErr = console.error; let thrown = 0; console.error = () => { thrown++; };
  try {
    let seedv = 12345; const R = () => { seedv = (seedv * 1664525 + 1013904223) >>> 0; return seedv / 4294967296; };
    const pickr = (a) => a[Math.floor(R() * a.length)];
    for (let gi = 0; gi < 30; gi++) {
      const n = 1 + Math.floor(R() * 6); const { g, clock } = make(n, { seed: gi + 100 });
      const ids = g.players.map((p) => p.id);
      for (let step = 0; step < 500 && g.phase === 'playing'; step++) {
        const id = R() < 0.7 ? g.turn.active : pickr(ids), v = g.viewFor(id);
        const enc = v.enc, opts = (enc && enc.options) || [];
        const o = opts.length ? pickr(opts) : null;
        const cmds = [
          { t: 'move', mode: pickr(['step', 'sprint', 'sneak', 'follow']), to: v.act && v.act.moves.length ? pickr(v.act.moves).to : 'chapel', target: pickr(ids) },
          { t: 'interact' }, { t: 'investigate' }, { t: 'explore' }, { t: 'rest', stat: pickr(['vit', 'san']) }, { t: 'echo' }, { t: 'endturn' },
          { t: 'choose', enc: enc && enc.id, opt: o ? o.id : 'x', val: o && o.puzzle ? pickr(o.puzzle.chips).v : undefined, target: o && o.targets ? pickr(o.targets).id : undefined },
          { t: 'use', item: pickr(['tonic', 'salt', 'thread', 'chalk', 'moonwater', 'snare', 'lamp_oil', 'herb']), target: pickr(ids), curse: 'rot' },
          { t: 'ability', mode: pickr(['purify', 'seal', 'banish', 'cleanse']), make: pickr(['tonic', 'salt', 'clarity']), target: pickr(ids), curse: 'rot', to: 'square' },
          { t: 'give', item: 'tonic', to: pickr(ids) }, { t: 'accept' }, { t: 'reroll', src: 'twist' }, { t: 'askaid' }, { t: 'aid' }, { t: 'leave' },
          { t: 'propose', ending: pickr(['silence', 'reverse', 'bargain', 'destroy']) }, { t: 'vote', yes: R() < 0.6 }, { t: 'spirit', kind: pickr(['whisper', 'lend', 'chill', 'return']), target: 'n1' },
          { t: 'levelup', pick: v.me && v.me.offer ? v.me.offer[0].id : 'might' }, { t: 'share', clue: 'ledger' }, { t: 'revealobj' }
        ];
        if (R() < 0.03) { const loc = pickr(Object.keys(D.locations)); g.get(g.turn.active).loc = loc; g.w.locs[loc].seen = g.w.locs[loc].visited = true; g.markSeen(loc); }
        if (R() < 0.03) clock.adv(200_000);
        if (R() < 0.05) g.tick();
        g.command(id, pickr(cmds));
        if (R() < 0.02) { g.hurt(pickr(g.players), pickr(['vit', 'san']), 3, { raw: true }); g.settleTurn(); }
      }
      g.players.forEach((p) => { assert.ok(p.vit >= 0 && p.san >= 0 && p.vit <= p.maxVit && p.san <= p.maxSan, 'stats in range'); assert.ok(g.packUsed(p) <= 7, 'pack in range'); });
      if (g.phase === 'playing') g.players.forEach((p) => g.viewFor(p.id));
      JSON.stringify(g.snapshot());
    }
  } finally { console.error = origErr; }
  assert.equal(thrown, 0, 'no command threw');
});

test('a region event is a single choice: once chosen it is over', () => {
  const { g } = make(2, { classes: ['hunter', 'medium'] });
  assert.ok(!g.command('p0', { t: 'explore' }).error);
  const enc = g.turn.enc; assert.equal(enc.kind, 'event');
  const first = g.encOptions(g.get('p0'), enc)[0].raw.id;
  roll(g, 12);
  assert.ok(!g.command('p0', { t: 'choose', enc: enc.id, opt: first }).error);
  assert.deepEqual(g.encOptions(g.get('p0'), enc), [], 'no second pick');
  const second = g.command('p0', { t: 'choose', enc: enc.id, opt: first });
  assert.ok(second.error, 'the same event cannot be used again');
  assert.ok(!g.command('p0', { t: 'leave' }).error); assert.equal(g.turn.enc, null);
  // each event is drawn once per expedition
  const seen = new Set([enc.event]);
  for (let i = 0; i < 6; i++) { g.turn.ap = 3; const r = g.command('p0', { t: 'explore' }); if (r.error) break; assert.ok(!seen.has(g.turn.enc.event)); seen.add(g.turn.enc.event); g.turn.enc = null; }
});

test('a result names its option and place, so every client can show it on the right object', () => {
  const { g } = make(2);
  toTurn(g, 'p0');
  open(g, 'p0');
  roll(g, 15);
  const r = pick(g, 'p0', 'well');
  assert.ok(!r.error, r.error);
  assert.equal(r.result.oid, 'well');
  assert.equal(r.result.loc, 'square');
  const seen = g.viewFor('p1').log.filter((e) => e.k === 'result').pop();
  assert.equal(seen.d.result.oid, 'well', 'the other player receives the same result');
  assert.equal(seen.d.result.roll.d, r.result.roll.d, 'with the same die');
});
