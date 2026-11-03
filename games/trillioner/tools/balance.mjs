#!/usr/bin/env node
// Balance simulator: plays whole days through the real engine and prints how far each kind of player gets.
//   node games/trillioner/tools/balance.mjs [seeds=20]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Bot = require('../engine/bot.js');
const seeds = Number(process.argv[2] || 20);
const fmt = (c) => '$' + (c / 1e11).toFixed(1) + 'B';
const strategies = { 'visible only': Bot.visibleOnly, 'all earners': Bot.allEarners };
try { const Solver = require('./solver-core.js'); strategies['knows secrets'] = Solver.strategy; } catch { /* the solver arrives at M5 */ }
for (const [name, strat] of Object.entries(strategies)) {
  let spent = 0, left = 0, wins = 0, t = 0, minLeft = Infinity, maxSpent = 0;
  for (let s = 1; s <= seeds; s++) {
    const r = Bot.playDay(s, strat);
    spent += r.spent; left += r.left; wins += r.won ? 1 : 0; t += r.ms;
    minLeft = Math.min(minLeft, r.left); maxSpent = Math.max(maxSpent, r.spent);
  }
  console.log(`${name.padEnd(14)} wins ${wins}/${seeds}  avg spent ${fmt(spent / seeds)} (max ${fmt(maxSpent)})  avg left ${fmt(left / seeds)} (min ${fmt(minLeft)})  avg run ${(t / seeds / 60000).toFixed(1)} min`);
}
