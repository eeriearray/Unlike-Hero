// Bot-vs-bot matchup matrix for the archetypes. A rough signal, not proof of balance: CPUs favour heavy,
// simple builds and do not exploit speed or air mobility the way people do.
//   node tools/balance-matrix.cjs [seedsPerPairing]
const D = require('../engine/dc-data.js'), Build = require('../engine/dc-build.js'), Sim = require('../engine/dc-sim.js'), Bot = require('../engine/dc-ai.js');
const ids = D.PRESETS.map((p) => p.id), seeds = +process.argv[2] || 4;
const wins = Object.fromEntries(ids.map((i) => [i, 0])), games = Object.fromEntries(ids.map((i) => [i, 0])), grid = {};
for (const a of ids) for (const b of ids) {
  if (a === b) continue;
  let aw = 0;
  for (let s = 1; s <= seeds; s++) {
    const sim = new Sim({ stocks: 2, timeLimit: 60 * 60 * 3, seed: s, fighters: [{ build: Build.presetBuild(a), team: 0 }, { build: Build.presetBuild(b), team: 1 }] });
    const bots = [new Bot(sim, 0, { level: 3, seed: s }), new Bot(sim, 1, { level: 3, seed: s + 50 })];
    while (!sim.result) sim.step(bots.map((x) => x.think()));
    if (sim.result.winnerTeam === 0) { aw++; wins[a]++; } else wins[b]++;
    games[a]++; games[b]++;
  }
  grid[a + '>' + b] = aw / seeds;
}
console.log('win rate (both sides of every pairing, level-3 CPUs, 2 stocks):');
for (const i of ids) console.log('  ' + i.padEnd(10) + (100 * wins[i] / games[i]).toFixed(0).padStart(4) + '%');
