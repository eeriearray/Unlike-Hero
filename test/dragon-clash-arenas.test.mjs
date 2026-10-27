import test from 'node:test';
import assert from 'node:assert/strict';
import { D, Sim, plain } from './dragon-clash-helpers.mjs';

const fighters = (perTeam) => Array.from({ length: perTeam * 2 }, (_, i) => ({
  build: plain('fire'), team: Math.floor(i / perTeam),
}));

for (const id of D.ARENA_ORDER) {
  test(`${id}: team arenas have more room, supported spawns and matching online geometry`, () => {
    const original = JSON.stringify(D.ARENAS[id]);
    const duel = new Sim({ arena: id, fighters: fighters(1) });
    for (const perTeam of [2, 3]) {
      const sim = new Sim({ arena: id, fighters: fighters(perTeam) });
      const arena = sim.arena, scale = perTeam === 2 ? 1.45 : 1.8;
      assert.equal(arena.platforms[0].w, duel.arena.platforms[0].w * scale);
      assert.deepEqual(arena.platforms.map(p => p.y), duel.arena.platforms.map(p => p.y));
      const setup = sim.setup();
      assert.deepEqual(D.arenaForMatch(setup.arena, setup.fighters), arena, 'online reconstructs the same map');
      for (const f of sim.fighters) {
        assert.ok(f.plat >= 0, `seat ${f.i} starts on a platform`);
        assert.equal(f.x < arena.size[0] / 2, f.team === 0, 'teammates start on the same side');
        const spawn = [f.x, f.y];
        sim.respawn(f);
        assert.deepEqual([f.x, f.y], spawn, 'respawn uses the spaced team spawn');
        assert.ok(f.plat >= 0);
      }
      const target = sim.fighters[0];
      target.x = arena.blast.right + 1;
      sim.step([]);
      assert.equal(target.stocks, 2, 'expanded blast boundary still produces a ring-out');
    }
    assert.equal(JSON.stringify(D.ARENAS[id]), original, 'base map stays unchanged');
  });
}

test('duels, free-for-all and training retain their original layouts', () => {
  assert.equal(D.arenaForMatch('skyforge', fighters(1)), D.ARENAS.skyforge);
  assert.equal(D.arenaForMatch('skyforge', fighters(2).map((f, i) => ({ ...f, team: i }))), D.ARENAS.skyforge);
  assert.equal(D.arenaForMatch('training', fighters(3)), D.ARENAS.training);
});
