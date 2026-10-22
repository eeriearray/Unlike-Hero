// Dragon Clash animation ↔ gameplay sync: on every melee move's active frames, the striking claw, foot or horn of
// the posed rig (forward kinematics through the real rig data) is inside that move's simulation hitbox, for every
// body type. Also: no state falls back to the idle pose while the dragon is moving.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { D, Build, Sim } from './dragon-clash-helpers.mjs';

// Load the browser animation and art modules into a sandbox with the generated rig.
const dir = new URL('../games/dragon-clash/', import.meta.url);
const window = { DC: { Data: D, Build, Sim } };
const ctx = vm.createContext({ window, Math, Object, JSON, Promise, console });
for (const f of ['assets/warrior/rig.js', 'js/art.js', 'js/anim.js']) vm.runInContext(readFileSync(new URL(f, dir), 'utf8'), ctx, { filename: f });
const { DCArt: Art, DCAnim: Anim } = window;

const LIMB = { clawLight: 'nearHand', clawHeavy: 'nearHand', up: 'hornTip', stomp: 'nearFoot' };
const MELEE = ['jab', 'utilt', 'fsmash', 'usmash', 'fair', 'uair', 'dair', 'fheavyAir', 'meteor', 'ledgeAttack'];
const AIR = new Set(['fair', 'uair', 'dair', 'fheavyAir', 'meteor']);

test('the striking limb is inside the hitbox on active frames, for every body type', () => {
  let checked = 0;
  for (const body of Object.keys(D.BODIES)) {
    const b = Object.assign(Build.presetBuild('warrior'), { body, mobility: 'stomper', upgrade: 'none' });
    const st = Build.deriveStats(b);
    for (const mv of MELEE) {
      const def = D.MOVES[mv];
      for (let at = def.startup; at < def.startup + def.active; at++) {
        const f = { st: 'attack', stT: at, mv, mT: at, fc: 1, vx: 0, vy: 0, gr: !AIR.has(mv), hl: 0, tb: false, aj: 1 };
        const limb = LIMB[Anim.attackKey(f, b, def)];
        if (!limb) continue;
        const p = Art.pointOf(limb, b.body, Anim.pose(f, b, 0));
        const boxes = Sim.prototype.activeBoxes({ state: 'attack', moveDef: def, moveT: at, moveKind: def.kind, stats: st, facing: 1, x: 0, y: 0 });
        const inside = boxes.some((x) => p[0] >= x.x && p[0] <= x.x + x.w && p[1] >= x.y && p[1] <= x.y + x.h);
        assert.ok(inside, `${body} ${mv} frame ${at}: ${limb} at (${p[0].toFixed(0)}, ${p[1].toFixed(0)}) is outside ${JSON.stringify(boxes[0])}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 100, 'checked ' + checked + ' frames');
});

test('mirrored: facing left puts the limb in the mirrored hitbox', () => {
  const b = Build.presetBuild('emberfang'), st = Build.deriveStats(b), def = D.MOVES.fsmash, at = def.startup + 1;
  const f = { st: 'attack', stT: at, mv: 'fsmash', mT: at, fc: -1, vx: 0, vy: 0, gr: true, hl: 0, tb: false, aj: 1 };
  const p = Art.pointOf('nearHand', b.body, Anim.pose(f, b, 0));
  const box = Sim.prototype.activeBoxes({ state: 'attack', moveDef: def, moveT: at, moveKind: 'heavy', stats: st, facing: -1, x: 0, y: 0 })[0];
  assert.ok(p[0] >= box.x && p[0] <= box.x + box.w && p[1] >= box.y && p[1] <= box.y + box.h);
});

test('moving states never show the idle pose', () => {
  const b = Build.presetBuild('emberfang');
  const base = { stT: 5, fc: 1, vx: 0, vy: 0, gr: true, hl: 0, tb: false, aj: 1, mv: null, mT: 0 };
  const states = [{ st: 'run', vx: 5 }, { st: 'idle', vx: 3 }, { st: 'air', vy: -8, gr: false }, { st: 'air', vy: 0, gr: false }, { st: 'air', vy: 8, gr: false },
    { st: 'land' }, { st: 'dodge', vx: 6 }, { st: 'dodge' }, { st: 'hitstun', vx: -4 }, { st: 'squat' }];
  for (const s of states) {
    const p = Anim.pose(Object.assign({}, base, s), b, 0);
    assert.equal(p.idleMix, 0, s.st + ' (vx ' + (s.vx || 0) + ') must use an action pose, not the idle frames');
    const moved = Object.values(p.bones).some((a) => Math.abs(a) > 0.1);
    assert.ok(moved, s.st + ' has a distinct pose');
  }
});
