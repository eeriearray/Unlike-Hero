// Rules tests for Putt Club's authoritative match (games/putt-club/engine/match.js): scoring, power-ups,
// phases, hosts and tournaments. Everything runs on the match's own tick clock, so whole games take milliseconds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PuttMatch = require('../games/putt-club/engine/match.js');
const P = require('../games/putt-club/engine/physics.js');
const Powerups = require('../games/putt-club/engine/powerups.js');
await P.init();

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function room(n = 2, settings = {}) {
  const fx = [];
  const m = new PuttMatch({ code: 'TEST', rng: seeded(42), hooks: { fx: (e, to) => fx.push({ ...e, to }) } });
  m.botBudget = Infinity;
  for (let i = 0; i < n; i++) m.addPlayer({ id: 'p' + i, name: 'P' + i });
  m.players.forEach((p) => { p.ready = true; });
  if (Object.keys(settings).length) assert.ok(m.command('p0', { type: 'settings', settings }).ok);
  return { m, fx };
}
function run(m, seconds) { for (let i = 0; i < seconds * 60; i++) m.tick(1 / 60); }
function toPlay(m) { assert.ok(m.command('p0', { type: 'start' }).ok); run(m, 3.8); assert.equal(m.phase, 'play'); }
function untilRest(m, ids) { for (let i = 0; i < 60 * 30 && ids.some((id) => m.get(id).ball.moving); i++) m.tick(1 / 60); }
function give(m, id, power) { m.get(id).inventory.push(power); }

test('lobby: 8 players max, unique colours, first player hosts, start needs everyone ready', () => {
  const m = new PuttMatch({ code: 'X' });
  for (let i = 0; i < 8; i++) assert.ok(m.addPlayer({ id: 'p' + i, name: 'P' + i }).ok);
  assert.match(m.addPlayer({ id: 'p9', name: 'Late' }).error, /full/);
  assert.equal(new Set(m.players.map((p) => p.color)).size, 8);
  assert.ok(m.get('p0').isHost);
  assert.match(m.command('p0', { type: 'start' }).error, /ready/);
  m.players.forEach((p) => m.command(p.id, { type: 'ready', ready: true }));
  assert.match(m.command('p3', { type: 'start' }).error, /host/);
  assert.ok(m.command('p0', { type: 'start' }).ok);
});

test('names are sanitised and settings are validated and host-only', () => {
  const { m } = room(2);
  m.command('p1', { type: 'profile', name: '  <b>Ann</b>\u0000 the very long named golfer  ' });
  assert.equal(m.get('p1').name, 'bAnn/b the very');
  assert.match(m.command('p1', { type: 'settings', settings: { maxStrokes: 3 } }).error, /host/);
  m.command('p0', { type: 'settings', settings: { maxStrokes: 99, shotTimer: 7, mode: 'nope', courses: 6 } });
  assert.equal(m.settings.maxStrokes, 12);
  assert.equal(m.settings.shotTimer, 0);
  assert.equal(m.settings.mode, 'casual');
  assert.equal(m.settings.courses, 6);
});

test('shots are validated: phase, rest, rate, finite input; strokes count only real shots', () => {
  const { m } = room(2);
  assert.match(m.command('p0', { type: 'shoot', dx: 0, dz: -1, power: 0.5 }).error, /Not now/);
  toPlay(m);
  for (const bad of [{ dx: NaN, dz: 1, power: 0.5 }, { dx: 0, dz: 0, power: 0.5 }, { dx: 0, dz: -1, power: 'x' }, { dx: 0, dz: -1, power: 0 }]) {
    assert.ok(m.command('p0', { type: 'shoot', ...bad }).error, JSON.stringify(bad));
  }
  assert.equal(m.get('p0').strokes, 0);
  assert.ok(m.command('p0', { type: 'shoot', dx: 0, dz: -1, power: 0.2 }).ok);
  assert.match(m.command('p0', { type: 'shoot', dx: 0, dz: -1, power: 0.2 }).error, /stop|fast/);
  assert.equal(m.get('p0').strokes, 1);
  // Power is clamped, so a huge number can't break the speed limit.
  untilRest(m, ['p0']);
  run(m, 1);
  const r = m.command('p0', { type: 'shoot', dx: 0, dz: -1, power: 1e9 });
  assert.ok(r.speed <= P.C.MAX_SHOT * 1.0001);
});

test('clients cannot report scores: unknown commands and fake fields are ignored', () => {
  const { m } = room(2);
  toPlay(m);
  assert.match(m.command('p0', { type: 'score', strokes: 1 }).error, /Unknown/);
  m.command('p0', { type: 'shoot', dx: 0, dz: -1, power: 0.3, strokes: -5, holed: true, x: 0, z: -6.6 });
  assert.equal(m.get('p0').strokes, 1);
  assert.equal(m.get('p0').finished, false);
});

test('water costs a stroke and returns the ball to its last resting spot', () => {
  const { m, fx } = room(1, { course: 'sunset-cove' });
  toPlay(m);
  const p = m.get('p0');
  m.round.holeIdx = 2; m.startHole(); run(m, 3.8); // Tidepool: straight down the middle is the pool
  const start = [p.ball.x, p.ball.z];
  m.command('p0', { type: 'shoot', dx: 0, dz: -1, power: 0.6 });
  untilRest(m, ['p0']);
  assert.ok(fx.some((e) => e.type === 'splash' && e.penalty === 1));
  assert.equal(p.strokes, 2);
  assert.ok(Math.hypot(p.ball.x - start[0], p.ball.z - start[1]) < 1e-6);
});

test('max strokes ends a hole for that player with max + 1', () => {
  const { m } = room(2, { maxStrokes: 5 });
  toPlay(m);
  for (let i = 0; i < 5; i++) { m.command('p0', { type: 'shoot', dx: 1, dz: 0, power: 0.05 }); untilRest(m, ['p0']); run(m, 0.5); }
  const p = m.get('p0');
  assert.ok(p.finished); assert.equal(p.status, 'maxed');
  assert.match(m.command('p0', { type: 'shoot', dx: 0, dz: -1, power: 0.5 }).error, /finished/);
  // The other player holes out; the hole ends and p0 is scored 6.
  const q = m.get('p1');
  P.place(q.ball, 0, 0, -6.0);
  m.command('p1', { type: 'shoot', dx: 0, dz: -1, power: 0.12 });
  untilRest(m, ['p1']);
  run(m, 0.2);
  assert.equal(m.phase, 'holeResults');
  assert.equal(p.holes[0].score, 6);
  assert.equal(q.holes[0].score, 1);
  assert.equal(q.stats.aces, 1);
});

test('reset sends the ball to the tee with the configured penalty', () => {
  const { m } = room(2, { resetPenalty: 2 });
  toPlay(m);
  m.command('p0', { type: 'shoot', dx: 0, dz: -1, power: 0.3 });
  untilRest(m, ['p0']);
  assert.ok(m.command('p0', { type: 'reset' }).ok);
  assert.equal(m.get('p0').strokes, 3);
});

test('hole time limit scores unfinished players and moves on; last ball standing gets a 30 s hurry-up', () => {
  const { m, fx } = room(2, { holeTime: 90 });
  toPlay(m);
  const q = m.get('p1');
  P.place(q.ball, 0, 0, -6.0);
  m.command('p1', { type: 'shoot', dx: 0, dz: -1, power: 0.12 });
  untilRest(m, ['p1']);
  assert.ok(fx.some((e) => e.type === 'hurry' && e.id === 'p0'));
  run(m, 31);
  assert.equal(m.phase, 'holeResults');
  assert.equal(m.get('p0').holes[0].status, 'dnf');
  assert.equal(m.get('p0').holes[0].score, m.settings.maxStrokes + 1);
});

test('crates award a weighted random power-up; inventory holds two', () => {
  const { m, fx } = room(1);
  toPlay(m);
  const p = m.get('p0'), tk = m.tokens[0];
  P.place(p.ball, tk.x, tk.y, tk.z + 1.5);
  m.command('p0', { type: 'shoot', dx: 0, dz: -1, power: 0.25 });
  untilRest(m, ['p0']);
  assert.equal(p.inventory.length, 1);
  assert.ok(Powerups.BY_ID[p.inventory[0]]);
  assert.ok(fx.some((e) => e.type === 'token' && e.id === 'p0'));
  assert.equal(tk.active, false);
  // Weighted roll: commons show up more than rares.
  const rng = seeded(1), counts = {};
  for (let i = 0; i < 6000; i++) { const id = Powerups.roll(rng); counts[id] = (counts[id] || 0) + 1; }
  assert.ok(counts.turbo > counts.freeze * 2, JSON.stringify(counts));
  assert.equal(Object.keys(counts).length, 12);
});

test('all twelve power-ups exist with unique names and descriptions', () => {
  const ids = Powerups.LIST.map((p) => p.id);
  assert.deepEqual(ids.sort(), ['confetti', 'freeze', 'ghost', 'giant', 'gust', 'magnet', 'reverse', 'shield', 'sticky', 'swap', 'tiny', 'turbo']);
  assert.equal(new Set(Powerups.LIST.map((p) => p.name)).size, 12);
  for (const p of Powerups.LIST) assert.ok(p.desc.length > 30, p.id);
});

test('turbo boosts the next shot only; sticky raises friction for two shots', () => {
  const { m } = room(2);
  toPlay(m);
  give(m, 'p0', 'turbo');
  assert.ok(m.command('p0', { type: 'use', slot: 0 }).ok);
  const a = m.command('p0', { type: 'shoot', dx: 1, dz: 0, power: 0.5 });
  const b = m.command('p1', { type: 'shoot', dx: 1, dz: 0, power: 0.5 });
  assert.ok(Math.abs(a.speed / b.speed - 1.5) < 1e-6);
  untilRest(m, ['p0', 'p1']);
  assert.equal(m.hasEffect(m.get('p0'), 'turbo'), false);
  run(m, 1.3);
  give(m, 'p0', 'sticky');
  m.command('p0', { type: 'use', slot: 0 });
  m.command('p0', { type: 'shoot', dx: 0, dz: 1, power: 0.1 });
  assert.equal(m.get('p0').ball.fric, 2.6);
  untilRest(m, ['p0']); run(m, 0.5);
  assert.ok(m.hasEffect(m.get('p0'), 'sticky'), 'one sticky shot left');
  m.command('p0', { type: 'shoot', dx: 0, dz: 1, power: 0.1 });
  untilRest(m, ['p0']);
  assert.equal(m.hasEffect(m.get('p0'), 'sticky'), false);
  assert.equal(m.get('p0').ball.fric, 1);
});

test('hostile power-ups need a valid opponent: not yourself, not finished, not disconnected', () => {
  const { m } = room(3);
  toPlay(m);
  give(m, 'p0', 'freeze');
  assert.match(m.command('p0', { type: 'use', slot: 0, target: 'p0' }).error, /opponent/);
  assert.match(m.command('p0', { type: 'use', slot: 0 }).error, /opponent/);
  m.get('p1').finished = true;
  assert.match(m.command('p0', { type: 'use', slot: 0, target: 'p1' }).error, /finished/);
  m.setConnected('p2', false);
  assert.match(m.command('p0', { type: 'use', slot: 0, target: 'p2' }).error, /disconnected/);
  assert.equal(m.get('p0').inventory.length, 1, 'a rejected use keeps the item');
});

test('freeze stops a rolling ball, it resumes, and immunity prevents a freeze lock', () => {
  const { m } = room(2);
  toPlay(m);
  m.command('p1', { type: 'shoot', dx: 0, dz: -1, power: 0.7 });
  m.tick(0.2);
  give(m, 'p0', 'freeze'); give(m, 'p0', 'freeze');
  assert.ok(m.command('p0', { type: 'use', slot: 0, target: 'p1' }).ok);
  const b = m.get('p1').ball, z = b.z;
  run(m, 2);
  assert.equal(b.z, z, 'frozen in place');
  assert.match(m.command('p1', { type: 'shoot', dx: 0, dz: -1, power: 0.5 }).error, /frozen/);
  run(m, 2.2);
  assert.ok(b.z < z, 'thawed and moving again');
  assert.match(m.command('p0', { type: 'use', slot: 0, target: 'p1' }).error, /thawing/);
});

test('shield blocks one hostile power-up, is used up, and ignores harmless ones', () => {
  const { m, fx } = room(2);
  toPlay(m);
  give(m, 'p1', 'shield');
  m.command('p1', { type: 'use', slot: 0 });
  give(m, 'p1', 'turbo');
  run(m, 1.3);
  m.command('p1', { type: 'use', slot: 0 }); // own helpful item: shield stays
  assert.ok(m.hasEffect(m.get('p1'), 'shield'));
  give(m, 'p0', 'reverse'); give(m, 'p0', 'reverse');
  assert.ok(m.command('p0', { type: 'use', slot: 0, target: 'p1' }).blocked);
  assert.ok(fx.some((e) => e.type === 'blocked' && e.id === 'p1' && e.by === 'p0'));
  assert.equal(m.hasEffect(m.get('p1'), 'shield'), false);
  assert.equal(m.hasEffect(m.get('p1'), 'reverse'), false);
  run(m, 1.3);
  assert.ok(m.command('p0', { type: 'use', slot: 0, target: 'p1' }).ok);
  assert.ok(m.hasEffect(m.get('p1'), 'reverse'));
  assert.equal(m.get('p1').stats.blocks, 1);
});

test('reverse flips the shot direction for its duration only', () => {
  const { m } = room(2);
  toPlay(m);
  give(m, 'p0', 'reverse');
  m.command('p0', { type: 'use', slot: 0, target: 'p1' });
  const r = m.command('p1', { type: 'shoot', dx: 0, dz: -1, power: 0.2 });
  assert.equal(r.dz, 1);
  assert.match(m.command('p0', { type: 'use', slot: 0, target: 'p1' }).error, /slot/);
  run(m, 16);
  assert.equal(m.hasEffect(m.get('p1'), 'reverse'), false);
});

test('swap exchanges ball positions but never strokes, and needs both balls at rest after a first shot', () => {
  const { m } = room(2);
  toPlay(m);
  give(m, 'p0', 'swap');
  assert.match(m.command('p0', { type: 'use', slot: 0, target: 'p1' }).error, /first shot/);
  m.command('p0', { type: 'shoot', dx: 0, dz: -1, power: 0.5 });
  m.command('p1', { type: 'shoot', dx: 0, dz: -1, power: 0.15 });
  untilRest(m, ['p0', 'p1']);
  const a = m.get('p0'), b = m.get('p1');
  const pa = [a.ball.x, a.ball.z], pb = [b.ball.x, b.ball.z], sa = a.strokes, sb = b.strokes;
  assert.ok(m.command('p0', { type: 'use', slot: 0, target: 'p1' }).ok);
  assert.deepEqual([a.ball.x, a.ball.z], pb);
  assert.deepEqual([b.ball.x, b.ball.z], pa);
  assert.equal(a.strokes, sa); assert.equal(b.strokes, sb);
});

test('gust pushes the target away from the attacker; a gust into water is not penalised', () => {
  const { m, fx } = room(2, { course: 'sunset-cove' });
  toPlay(m);
  m.round.holeIdx = 2; m.startHole(); run(m, 3.8); // Tidepool
  const a = m.get('p0'), b = m.get('p1');
  a.shotOnce = b.shotOnce = true;
  P.place(a.ball, 0, 0, 4); P.place(b.ball, 0, 0, 2.4); // b sits just above the pool
  const strokes = b.strokes;
  give(m, 'p0', 'gust');
  assert.ok(m.command('p0', { type: 'use', slot: 0, target: 'p1' }).ok);
  assert.ok(b.ball.vz < 0, 'pushed away from p0 (towards -z)');
  untilRest(m, ['p1']);
  const splash = fx.find((e) => e.type === 'splash' && e.id === 'p1');
  assert.ok(splash, 'the gust blew p1 into the pool');
  assert.equal(splash.penalty, 0);
  assert.equal(b.strokes, strokes);
  assert.ok(Math.hypot(b.ball.x - 0, b.ball.z - 2.4) < 1e-6, 'back where the gust found it');
});

test('giant and tiny cancel each other; magnet and ghost go live only for the shot', () => {
  const { m } = room(2);
  toPlay(m);
  give(m, 'p0', 'giant'); give(m, 'p0', 'tiny');
  m.command('p0', { type: 'use', slot: 0 });
  assert.ok(m.get('p0').ball.rTarget > P.C.R);
  run(m, 1.3);
  m.command('p0', { type: 'use', slot: 0 });
  assert.ok(m.get('p0').ball.rTarget < P.C.R);
  assert.equal(m.hasEffect(m.get('p0'), 'giant'), false);
  give(m, 'p1', 'ghost');
  m.command('p1', { type: 'use', slot: 0 });
  assert.equal(m.get('p1').ball.ghost, false);
  m.command('p1', { type: 'shoot', dx: 0, dz: -1, power: 0.3 });
  assert.equal(m.get('p1').ball.ghost, true);
  untilRest(m, ['p1']);
  assert.equal(m.get('p1').ball.ghost, false);
});

test('temporary effects are cleared between holes', () => {
  const { m } = room(2);
  toPlay(m);
  give(m, 'p0', 'giant');
  m.command('p0', { type: 'use', slot: 0 });
  m.endHole();
  assert.equal(m.get('p0').effects.length, 0);
});

test('standings: lowest total wins, ties share a rank; relative to par is right', () => {
  const { m } = room(3);
  toPlay(m);
  const [a, b, c] = m.players;
  a.holes = [{ score: 2, par: 2, status: 'holed' }, { score: 3, par: 3, status: 'holed' }];
  b.holes = [{ score: 3, par: 2, status: 'holed' }, { score: 2, par: 3, status: 'holed' }];
  c.holes = [{ score: 4, par: 2, status: 'holed' }, { score: 9, par: 3, status: 'maxed' }];
  const s = m.standings();
  assert.deepEqual(s.map((r) => r.rank), [1, 1, 3]);
  assert.equal(s[2].id, 'p2');
  assert.equal(s[0].rel, 0);
  assert.equal(s[2].rel, 8);
});

test('awards come from real stats and are never handed out on a tie', () => {
  const { m } = room(3);
  toPlay(m);
  const [a, b, c] = m.players;
  a.stats.hostileLanded = 4; b.stats.hostileLanded = 1;
  b.stats.bankHoles = 2; c.stats.bankHoles = 2;
  c.stats.aces = 1;
  const awards = PuttMatch.computeAwards(m);
  const by = (id) => awards.find((x) => x.id === id);
  assert.equal(by('hostileLanded').player, 'p0');
  assert.equal(by('bankHoles'), undefined, 'tied bank-shot counts: no award');
  assert.equal(by('ace-p2').player, 'p2');
  assert.ok(by('winner'));
});

test('a full casual course plays to the end with bots and supports a vote and rematch', { timeout: 120_000 }, () => {
  const { m } = room(1, { course: 'neon-underground' });
  m.addBot('p0'); m.addBot('p0');
  m.get('p0').bot = true; m.get('p0').skill = 0.85;
  m.command('p0', { type: 'start' });
  for (let i = 0; i < 60 * 60 * 20 && m.phase !== 'final'; i++) m.tick(1 / 60);
  assert.equal(m.phase, 'final');
  for (const p of m.players) {
    assert.equal(p.holes.length, 6);
    for (const h of p.holes) assert.ok(h.score >= 1 && h.score <= m.settings.maxStrokes + 1);
  }
  assert.ok(m.awards.some((a) => a.id === 'winner'));
  m.get('p0').bot = false;
  assert.ok(m.command('p0', { type: 'vote', course: 'clockwork-garden' }).ok);
  assert.ok(m.command('p0', { type: 'next' }).ok);
  assert.equal(m.settings.course, 'clockwork-garden');
  assert.equal(m.phase, 'intro');
});

test('tournament: three courses in order, mirrored second lap, totals accumulate, items optional between courses', () => {
  const { m } = room(2, { mode: 'tournament', courses: 6, keepPowerups: true });
  m.command('p0', { type: 'start' });
  assert.deepEqual(m.round.order.map((o) => o.id + (o.mirror ? '*' : '')), ['sunset-cove', 'clockwork-garden', 'neon-underground', 'sunset-cove*', 'clockwork-garden*', 'neon-underground*']);
  // Fast-forward through the first course by ending holes.
  for (let h = 0; h < 6; h++) { run(m, 3.8); m.endHole(); run(m, 7); }
  assert.equal(m.phase, 'courseResults');
  m.get('p0').inventory = ['magnet'];
  run(m, 10.5);
  assert.equal(m.round.courseIdx, 1);
  assert.equal(m.round.course.id, 'clockwork-garden');
  assert.deepEqual(m.get('p0').inventory, ['magnet']);
  assert.equal(m.get('p0').courseTotals[0], 6 * (m.settings.maxStrokes + 1));
  assert.equal(m.standings()[0].total, 6 * (m.settings.maxStrokes + 1));
});

test('host leaves: hosting passes to a connected human, and the match continues', () => {
  const { m } = room(3);
  toPlay(m);
  m.setConnected('p0', false);
  assert.ok(m.get('p1').isHost);
  assert.equal(m.get('p0').isHost, false);
  run(m, 1);
  assert.equal(m.phase, 'play');
  m.setConnected('p0', true);
  assert.equal(m.players.filter((p) => p.isHost).length, 1);
});

test('a disconnected player keeps their score and does not hold the hole up', () => {
  const { m } = room(2);
  toPlay(m);
  m.command('p0', { type: 'shoot', dx: 0, dz: -1, power: 0.2 });
  untilRest(m, ['p0']);
  m.setConnected('p0', false);
  const q = m.get('p1');
  P.place(q.ball, 0, 0, -6.0);
  m.command('p1', { type: 'shoot', dx: 0, dz: -1, power: 0.12 });
  untilRest(m, ['p1']);
  run(m, 0.2);
  assert.equal(m.phase, 'holeResults');
  assert.equal(m.get('p0').holes[0].status, 'timeout');
  assert.equal(m.get('p0').holes[0].score, 3);
});
