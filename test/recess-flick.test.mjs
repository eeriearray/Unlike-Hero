// Balance rules for RECESS's flick games (Pen Fight, Marble Knockout).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PenFightEngine } from '../games/recess/server/engines/penfight.mjs';
import { MarblesEngine } from '../games/recess/server/engines/marbles.mjs';

const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];

test('Pen Fight: one full-power flick from the start position never clears the desk', () => {
  for (let i = 0; i < 40; i++) {
    const e = new PenFightEngine('m', players, () => {}, {});
    const me = e.pens.find(p => p.id === e.turn);
    const them = e.pens.find(p => p.id !== e.turn);
    const a = Math.atan2(them.y - me.y, them.x - me.x);
    e.handleAction(e.turn, { type: 'flick', grab: 0, jx: Math.cos(a) * 1000, jy: Math.sin(a) * 1000 });
    assert.equal(e.pens.find(p => p.id === them.id).gone, null, 'the other pen should still be on the desk');
    e.dispose();
  }
});

test('Marble Knockout: knocking out a shooter scores 2 but gives no extra shot', () => {
  const e = new MarblesEngine('m', players, () => {}, {});
  e.dispose(); e.disposed = false;
  const shooterA = e.bodies.find(b => b.id === 'a');
  const shooterB = e.bodies.find(b => b.id === 'b');
  // Park B's shooter right next to A's, pointing out of the ring, and clear the targets out of the way.
  for (const t of e.bodies.filter(b => b.kind === 'target')) { t.x = 50 + (Number(t.id.slice(1)) - 4) * 4.5; t.y = 50; }
  Object.assign(shooterA, { x: 50, y: 80 });
  Object.assign(shooterB, { x: 50, y: 85.5 });
  e.turn = 'a';
  e.handleAction('a', { type: 'shoot', vx: 0, vy: 57 });
  e.handleAction('a', { type: 'shot-done', seq: e.shot.seq });
  assert.equal(e.scores.a, 2);
  assert.equal(e.turn, 'b');
});

test('Marble Knockout: a turn ends after three shots even on a knockout streak', () => {
  const e = new MarblesEngine('m', players, () => {}, {});
  e.dispose(); e.disposed = false;
  e.turn = 'a';
  e.bodies.filter(b => b.kind === 'target').forEach((t, k) => Object.assign(t, { x: 25, y: 30 + k * 5 }));
  Object.assign(e.bodies.find(b => b.id === 'b'), { x: 80, y: 50 });
  for (let k = 0; k < 3; k++) {
    assert.equal(e.turn, 'a');
    // Shooter in the middle, a target just inside the chalk below it: every shot knocks one out.
    Object.assign(e.bodies.find(b => b.id === 'a'), { x: 50, y: 50 });
    Object.assign(e.bodies.find(b => b.kind === 'target' && !b.gone), { x: 50, y: 86 });
    e.handleAction('a', { type: 'shoot', vx: 0, vy: 57 });
    e.handleAction('a', { type: 'shot-done', seq: e.shot.seq });
  }
  assert.equal(e.scores.a >= 3, true);
  assert.equal(e.turn, 'b', 'the turn passes after three shots');
});
