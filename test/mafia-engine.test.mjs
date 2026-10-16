// Rules tests for the Mafia engine (games/mafia/engine/mafia-engine.js).  Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Engine = require('../games/mafia/engine/mafia-engine.js');
const { MafiaGame, buildRoleList, ROLES } = Engine;

// Deterministic RNG + a virtual clock so whole games run instantly.
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
function virtualClock() {
  let now = 0, seq = 0;
  const queue = new Map();
  return {
    now: () => now,
    timers: {
      set(fn, ms) { const id = ++seq; queue.set(id, { at: now + ms, fn }); return id; },
      clear(id) { queue.delete(id); },
    },
    /** Run timers in order until `pred()` is true or time runs out. */
    runUntil(pred, limitMs = 6 * 60 * 60 * 1000) {
      while (!pred() && now < limitMs) {
        let nextId = null, next = null;
        for (const [id, t] of queue) if (!next || t.at < next.at) { next = t; nextId = id; }
        if (!next) break;
        queue.delete(nextId);
        now = Math.max(now, next.at);
        next.fn();
      }
    },
  };
}

function makeGame({ seed = 1, players = 8, roles, settings } = {}) {
  const clock = virtualClock();
  const leaks = [];
  const game = new MafiaGame({ code: '123456', rng: seeded(seed), now: clock.now, timers: clock.timers, settings });
  const host = game.addPlayer({ id: 'host', name: 'Host' }).player;
  for (let i = 1; i < players; i++) game.addBot('host');
  if (roles) {
    // Force a role layout: start, then overwrite roles.
    game.start('host');
    game.players.forEach((p, i) => { p.role = p.originalRole = roles[i]; p.usesLeft = {}; const ab = ROLES[p.role].ability; if (ab && ab.uses) p.usesLeft[ab.type] = ab.uses; });
  }
  return { game, clock, host, leaks };
}

test('role lists respect size and keep Mafia a minority', () => {
  const all = { ...Engine.DEFAULT_SETTINGS, roles: Object.fromEntries(Object.keys(Engine.DEFAULT_SETTINGS.roles).map(k => [k, true])) };
  for (let n = 4; n <= 16; n++) {
    for (let seed = 1; seed < 30; seed++) {
      const list = buildRoleList(n, all, seeded(seed));
      assert.equal(list.length, n);
      const mafia = list.filter(r => ROLES[r].team === 'mafia').length;
      assert.ok(mafia >= 1 && mafia < n / 2, `n=${n} mafia=${mafia}`);
      assert.ok(list.some(r => ROLES[r].team === 'town'));
      if (n < 7) assert.ok(!list.includes('serial_killer'));
    }
  }
});

test('full bot games always finish with a winner and never leak roles', () => {
  const allRoles = Object.fromEntries(Object.keys(Engine.DEFAULT_SETTINGS.roles).map(k => [k, true]));
  const results = {};
  for (let seed = 1; seed <= 60; seed++) {
    const n = 4 + (seed % 13);
    const { game, clock } = makeGame({ seed, players: n, settings: { roles: allRoles, timers: { night: 20, discussion: 20, voting: 15, defense: 10, judgment: 10 } } });
    game.hooks.sync = () => {
      // Privacy check: a living non-mafia player never sees another living player's role.
      for (const viewer of game.players) {
        const v = game.viewFor(viewer.id);
        for (const p of v.players) {
          if (!p.role || p.id === viewer.id || game.phase === 'gameover') continue;
          const real = game.get(p.id);
          const mates = game.isMafia(viewer) && game.isMafia(real);
          assert.ok(mates || !real.alive, `seed ${seed}: ${viewer.name} saw ${real.name}'s role in ${game.phase}`);
        }
        if (game.phase !== 'gameover') assert.equal(v.winner, undefined);
      }
    };
    assert.deepEqual(game.start('host'), { ok: true });
    game.setReady('host');
    clock.runUntil(() => game.phase === 'gameover');
    assert.equal(game.phase, 'gameover', `seed ${seed} did not finish (day ${game.day})`);
    assert.ok(game.winner.title);
    results[game.winner.team] = (results[game.winner.team] || 0) + 1;
  }
  assert.ok(Object.keys(results).length >= 2, `only one faction ever wins: ${JSON.stringify(results)}`);
});

test('doctor heal stops the mafia kill; detective sees godfather as innocent and framed as suspicious', () => {
  const { game } = makeGame({ players: 6, roles: ['villager', 'detective', 'doctor', 'godfather', 'framer', 'villager'] });
  game.advance(); // roles -> night 1
  assert.equal(game.phase, 'night');
  const [v, det, doc, gf, fr, v2] = game.players;
  game.nightAction(gf.id, 'kill', v.id);
  game.nightAction(fr.id, 'kill', v.id);
  game.nightAction(fr.id, 'ability', v2.id);
  game.nightAction(doc.id, 'ability', v.id);
  game.nightAction(det.id, 'ability', gf.id);
  game.advance(); // resolve
  assert.equal(game.phase, 'dawn');
  assert.ok(v.alive, 'healed villager survives');
  assert.equal(game.dawn.saves, 1);
  assert.match(det.log.at(-1).text, /INNOCENT/);

  // Night 2: inspect the framed villager.
  while (game.phase !== 'night') game.advance();
  game.nightAction(fr.id, 'ability', v2.id);
  game.nightAction(det.id, 'ability', v2.id);
  game.nightAction(gf.id, 'kill', null);
  game.advance();
  assert.match(det.log.at(-1).text, /SUSPICIOUS/);
});

test('doctor cannot heal the same player two nights running', () => {
  const { game } = makeGame({ players: 5, roles: ['villager', 'doctor', 'mafioso', 'villager', 'villager'] });
  game.advance();
  const doc = game.players[1], v = game.players[0];
  assert.deepEqual(game.nightAction(doc.id, 'ability', v.id), { ok: true });
  game.advance();
  while (game.phase !== 'night') game.advance();
  assert.ok(game.nightAction(doc.id, 'ability', v.id).error);
});

test('bodyguard dies with the attacker and saves the target', () => {
  const { game } = makeGame({ players: 7, roles: ['villager', 'bodyguard', 'mafioso', 'godfather', 'villager', 'villager', 'villager'] });
  game.advance();
  const [v, bg, maf, gf] = game.players;
  game.nightAction(gf.id, 'kill', v.id);
  game.nightAction(maf.id, 'kill', v.id);
  game.nightAction(bg.id, 'ability', v.id);
  game.advance();
  assert.ok(v.alive);
  assert.ok(!bg.alive);
  assert.ok(!maf.alive, 'the Mafioso carried out the hit and was killed');
  assert.ok(gf.alive);
});

test('silenced players cannot talk but can vote', () => {
  const { game } = makeGame({ players: 6, roles: ['villager', 'silencer', 'mafioso', 'villager', 'villager', 'doctor'] });
  game.advance();
  const [v, sil, maf] = game.players;
  game.nightAction(sil.id, 'ability', v.id);
  game.nightAction(sil.id, 'kill', null);
  game.nightAction(maf.id, 'kill', null);
  game.advance(); // dawn
  assert.ok(game.dawn.silenced.includes(v.id));
  game.advance(); // discussion
  assert.ok(game.say(v.id, 'day', 'hello').error);
  assert.ok(game.viewFor(v.id).me.silenced);
  game.advance(); // voting
  assert.deepEqual(game.castVote(v.id, maf.id), { ok: true });
});

test('lynching the jester records a neutral win; town win ends the game', () => {
  const { game } = makeGame({ players: 5, roles: ['villager', 'jester', 'mafioso', 'villager', 'detective'] });
  game.advance(); // night
  const [v, jester, maf, v2, det] = game.players;
  game.nightAction(maf.id, 'kill', null);
  game.nightAction(det.id, 'ability', null);
  game.advance(); game.advance(); game.advance(); // dawn -> discussion -> voting
  for (const p of game.living()) if (p !== jester) game.castVote(p.id, jester.id);
  game.advance(); // defense
  assert.equal(game.accusedId, jester.id);
  game.advance(); // judgment
  for (const p of game.living()) if (p !== jester) game.castJudgment(p.id, 'guilty');
  game.advance(); // verdict
  assert.ok(game.verdict.executed && game.verdict.jester);
  assert.equal(game.neutralWins[0].id, jester.id);
  game.advance(); // night 2
  game.nightAction(maf.id, 'kill', null); game.nightAction(det.id, 'ability', null);
  game.advance(); game.advance(); game.advance();
  for (const p of game.living()) if (p !== maf) game.castVote(p.id, maf.id);
  game.advance(); game.advance();
  for (const p of game.living()) if (p !== maf) game.castJudgment(p.id, 'guilty');
  game.advance(); // verdict
  game.advance(); // -> gameover
  assert.equal(game.phase, 'gameover');
  assert.equal(game.winner.team, 'town');
  assert.ok(game.winner.winners.includes(jester.id), 'jester shares the win');
  assert.ok(!game.winner.winners.includes(maf.id));
});

test('mafia wins at parity', () => {
  const { game } = makeGame({ players: 4, roles: ['villager', 'villager', 'mafioso', 'villager'] });
  game.advance();
  game.nightAction(game.players[2].id, 'kill', game.players[0].id);
  game.advance(); // dawn: 1 mafia vs 2 town -> continue
  assert.equal(game.pendingWinner, null);
  game.advance(); game.advance(); game.advance(); // discussion, voting (nobody votes) -> verdict(no trial)
  assert.ok(game.verdict.noTrial);
  game.advance(); // night 2
  game.nightAction(game.players[2].id, 'kill', game.players[1].id);
  game.advance(); // dawn -> mafia 1 vs town 1
  assert.equal(game.pendingWinner.team, 'mafia');
  game.advance();
  assert.equal(game.phase, 'gameover');
});

test('executioner becomes a jester when the target dies at night', () => {
  const { game } = makeGame({ players: 6, roles: ['villager', 'executioner', 'mafioso', 'villager', 'villager', 'villager'] });
  const exe = game.players[1];
  exe.exeTargetId = game.players[0].id;
  game.advance();
  game.nightAction(game.players[2].id, 'kill', game.players[0].id);
  game.advance();
  assert.equal(exe.role, 'jester');
});

test('chat permissions: mafia chat is private, the dead talk only among themselves', () => {
  const { game } = makeGame({ players: 5, roles: ['villager', 'medium', 'mafioso', 'villager', 'villager'] });
  game.advance();
  const [v, med, maf] = game.players;
  assert.ok(game.say(maf.id, 'mafia', 'psst').ok);
  assert.ok(game.say(v.id, 'mafia', 'hi').error);
  assert.ok(!game.chatHistoryFor(v.id).mafia);
  assert.ok(game.say(v.id, 'day', 'hello?').error, 'no public chat at night');
  game.nightAction(maf.id, 'kill', v.id);
  game.advance(); // v dies
  assert.ok(game.say(v.id, 'dead', 'boo').ok);
  assert.ok(game.say(v.id, 'day', 'I was killed by...').error, 'ghosts cannot talk to the living');
  assert.ok(game.chatHistoryFor(med.id).dead, 'medium hears the dead');
  assert.ok(!game.chatHistoryFor(game.players[3].id).dead);
});

test('every narrated moment maps to a clip in the recording script', () => {
  const allRoles = Object.fromEntries(Object.keys(Engine.DEFAULT_SETTINGS.roles).map(k => [k, true]));
  const used = new Set();
  for (let seed = 1; seed <= 120; seed++) {
    const { game, clock } = makeGame({ seed, players: 4 + (seed % 13), settings: { roles: allRoles, timers: { night: 20, discussion: 20, voting: 15, defense: 10, judgment: 10 } } });
    const check = () => {
      const clips = [game.announcementClip, ...(game.dawn ? game.dawn.clips : []), ...(game.verdict ? game.verdict.clips : []), game.winner && game.winner.clip];
      for (const c of clips) if (c) { assert.ok(Engine.SCRIPT[c], `missing script line for clip "${c}"`); used.add(c); }
      if (game.dawn) assert.equal(game.dawn.clips.length, game.dawn.lines.length);
    };
    game.hooks.sync = check;
    game.start('host'); game.setReady('host');
    clock.runUntil(() => game.phase === 'gameover');
    check();
  }
  for (const c of Object.keys(Engine.SCRIPT)) assert.ok(!/\{|\(bot\)/.test(Engine.SCRIPT[c]), `script line ${c} must not contain names`);
  assert.ok(used.size > 40, `only ${used.size} clips exercised`);
});
