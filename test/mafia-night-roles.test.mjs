// Every night role can pick a target, the pick is accepted, and private results reach only that player
// (shown on the morning paper's "private telegram" and in the Notebook). Also the narrator setting.  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { MafiaGame, ROLES, sanitizeSettings } = createRequire(import.meta.url)('../games/mafia/engine/mafia-engine.js');

function game(roles) {
  let s = 11; const rng = () => ((s = s * 16807 % 2147483647) / 2147483647);
  const g = new MafiaGame({ code: '1', rng, now: () => 0, timers: { set: () => 0, clear: () => {} }, settings: {} });
  g.addPlayer({ id: 'host', name: 'Host' });
  for (let i = 1; i < roles.length; i++) g.addBot('host');
  g.start('host');
  g.players.forEach((p, i) => { p.role = p.originalRole = roles[i]; p.usesLeft = {}; const ab = ROLES[p.role].ability; if (ab && ab.uses) p.usesLeft[ab.type] = ab.uses; });
  g.advance();                                     // roles -> night 1
  return g;
}

test('every role with a night ability gets targets and its pick is accepted', () => {
  const nightRoles = Object.keys(ROLES).filter(r => ROLES[r].ability && ROLES[r].ability.target !== 'dead');
  const g = game(['villager', ...nightRoles, 'villager', 'villager']);
  assert.equal(g.phase, 'night');
  for (const p of g.players) {
    if (!ROLES[p.role].ability || ROLES[p.role].ability.target === 'dead') continue;
    const ability = g.actionsFor(p).find(a => a.key === 'ability');
    assert.ok(ability && ability.targets.length, `${p.role} has night targets`);
    g.nightAction(p.id, 'ability', ability.targets[0]);
    assert.equal(g.nightChoices(p).ability, ability.targets[0], `${p.role}'s pick was recorded`);
  }
  for (const p of g.players.filter(x => g.isMafia(x))) {
    const kill = g.actionsFor(p).find(a => a.key === 'kill');
    assert.ok(kill && kill.targets.length, `${p.role} can vote on the family kill`);
    assert.ok(kill.targets.every(id => !g.isMafia(g.get(id))), 'the family never targets its own');
  }
});

test('investigation results reach only the investigator, dated for the morning paper', () => {
  const g = game(['detective', 'villager', 'godfather', 'consigliere', 'doctor', 'framer']);
  const [det, v, gf, con, , fr] = g.players;
  g.nightAction(det.id, 'ability', fr.id);       // the Framer appears evil
  g.nightAction(con.id, 'ability', det.id);
  g.nightAction(gf.id, 'kill', v.id);
  g.advance();                                    // resolve -> dawn
  assert.equal(g.phase, 'dawn');
  const telegram = p => { const view = g.viewFor(p.id); return view.me.log.filter(l => l.phase === 'night' && l.day === view.dawn.day).map(l => l.text); };
  assert.match(telegram(det).join(), /SUSPICIOUS/);
  assert.match(telegram(con).join(), /Detective/);
  const detText = det.log.at(-1).text;
  for (const p of g.players.filter(p => p !== det)) assert.ok(!JSON.stringify(g.viewFor(p.id)).includes(detText), `${p.role} cannot see the Detective's result`);
});

test('the narrator plays on the host only unless the host turns it on for everyone', () => {
  assert.equal(sanitizeSettings({}).narrator, 'host');
  assert.equal(sanitizeSettings({ narrator: 'all' }).narrator, 'all');
  assert.equal(sanitizeSettings({ narrator: 'anything else' }).narrator, 'host');
});
