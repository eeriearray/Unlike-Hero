// Deterministic presentation fixtures only. Never reads a saved or live expedition.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { HollowGame, data, catalog, CFG } = require('../games/the-hollow/engine/index.js');
function make() {
  const game = new HollowGame({ code: 'ARTS', seed: 61, now: () => 1000000 });
  for (const [id, name, cls] of [['p0','Isolde','occultist'],['p1','Corvin','hunter']]) {
    game.addPlayer({ id, name }); game.command(id, { t: 'pick', cls }); game.command(id, { t: 'ready' });
  }
  game.command('p0', { t: 'start' });
  return game;
}
const sample = make();
for (const id of ['foyer','forest','nave','sealed_crypt']) { sample.w.locs[id].seen = true; sample.markSeen(id); }
const playing = sample.viewFor('p0'); sample.destroy();
// Show the four route symbols explicitly in the isolated sample map.
playing.map.edges.slice(0, 4).forEach((edge, i) => {
  edge.state = ['open','open','locked','guarded'][i]; edge.type = i === 1 ? 'hidden' : 'path';
  if (i >= 2) edge.why = 'Sample blocked road';
});
const endings = {};
for (const key of Object.keys(data.endings)) {
  const game = make();
  game.w.round = 7; game.w.clock = key === 'doom' ? CFG.clockMax : 20;
  if (key === 'wipe') game.players.forEach(p => { p.status = 'fallen'; p.vit = 0; });
  if (key === 'escape') game.players.forEach(p => { p.status = 'escaped'; });
  if (key === 'bargain') game.get('p0').fate = 'bound';
  game.finish(data.endings[key].results.true, key, 'true', null, game.get('p0'));
  endings[key] = game.viewFor('p0'); game.destroy();
}
const output = { note: 'Isolated presentation samples. No real expedition, player record or save is loaded.', catalog: catalog(), playing, endings };
await fs.writeFile(new URL('../games/the-hollow/art/chapter-preview.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log('Wrote chapter-preview.json with one sample map and seven real engine ending views.');
