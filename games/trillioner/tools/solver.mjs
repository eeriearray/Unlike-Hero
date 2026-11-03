#!/usr/bin/env node
// Proves generated cities can be finished: a bot that knows the secrets plays each seed through the real engine,
// with realistic travel and closing times, and must win inside 24:00.
//   node games/trillioner/tools/solver.mjs [seeds=100] [--verbose]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Bot = require('../engine/bot.js');
export function solve(seed) { return Bot.playDay(seed, Bot.knowsSecrets); }
if (process.argv[1] && process.argv[1].endsWith('solver.mjs')) {
  const n = Number(process.argv[2] || 100), verbose = process.argv.includes('--verbose');
  let wins = 0, worst = 0, sum = 0, spent = 0; const fails = [];
  for (let s = 1; s <= n; s++) {
    const r = solve(s);
    if (r.won) { wins++; worst = Math.max(worst, r.ms); sum += r.ms; spent += r.spent; } else fails.push({ seed: s, left: r.left / 1e11, income: r.income / 1e8, spent: r.spent / 1e11 });
    if (verbose) console.log(s, r.won ? 'WIN' : 'FAIL', (r.ms / 60000).toFixed(1) + ' min', 'spent $' + (r.spent / 1e11).toFixed(0) + 'B', 'left $' + (r.left / 1e11).toFixed(2) + 'B', 'demolished', r.demolished);
  }
  console.log(`Solver: ${wins}/${n} seeds won. Avg win ${(sum / Math.max(1, wins) / 60000).toFixed(1)} min, worst ${(worst / 60000).toFixed(1)} min, avg spent $${(spent / Math.max(1, wins) / 1e11).toFixed(0)}B.`);
  if (fails.length) console.log('Failures:', JSON.stringify(fails.slice(0, 8)));
  process.exitCode = fails.length ? 1 : 0;
}
