// Bot-vs-bot balance check for the sprite dragons: every pairing, sides and arenas alternated. A rough signal, not
// proof of balance: CPUs favour heavy, simple builds and do not exploit speed or air mobility the way people do.
// With level-3 CPUs every dragon should land roughly between 45% and 55%.
//   node tools/balance-matrix.cjs [games per pairing = 60] [CPU level 1-3 = 3] [seed = 1]
const D = require('../engine/dc-data.js'), Build = require('../engine/dc-build.js'), Sim = require('../engine/dc-sim.js'), Bot = require('../engine/dc-ai.js');
const N = +process.argv[2] || 60, level = +process.argv[3] || 3;
let seed = +process.argv[4] || 1;
const ids = D.PRESETS.filter((p) => p.look && p.look.sprite).map((p) => p.id);
const arenas = Object.keys(D.ARENAS).filter((a) => a !== 'training');
const name = (id) => D.PRESETS.find((p) => p.id === id).name;
const win = Object.fromEntries(ids.map((i) => [i, 0])), games = Object.fromEntries(ids.map((i) => [i, 0])), pairs = [];
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
  const score = { [ids[i]]: 0, [ids[j]]: 0 };
  for (let n = 0; n < N; n++) {
    const [a, b] = n % 2 ? [ids[j], ids[i]] : [ids[i], ids[j]];
    const sim = new Sim({ arena: arenas[n % arenas.length], stocks: 3, seed: seed++, timeLimit: 60 * 60 * 4,
      fighters: [{ build: Build.presetBuild(a), team: 0 }, { build: Build.presetBuild(b), team: 1 }] });
    const bots = [new Bot(sim, 0, { level, seed: seed * 7 }), new Bot(sim, 1, { level, seed: seed * 13 })];
    for (let t = 0; !sim.result && t < 60 * 60 * 5; t++) { sim.step(bots.map((x) => x.think())); sim.drainEvents(); }
    games[a]++; games[b]++;
    const r = sim.result, w = r && r.winnerTeam >= 0 ? [a, b][r.winnerTeam] : null;
    if (w) { win[w]++; score[w]++; }
  }
  pairs.push(score);
}
console.log(`Win rates (CPU level ${level}, ${N} games per pairing):`);
for (const i of ids) console.log('  ' + name(i).padEnd(10), String(Math.round(100 * win[i] / games[i])).padStart(3) + '%');
console.log('Matchups:');
for (const p of pairs) console.log('  ' + Object.entries(p).map(([d, w]) => name(d) + ' ' + w).join('  –  '));
