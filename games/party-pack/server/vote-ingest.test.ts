// Load test for vote-ingest.ts: 75,000 votes (5,000/s for 15 s of game time) from 40,000 viewers
// against a fake Redis that counts round-trips. Run: node games/party-pack/server/vote-ingest.test.ts
import { VoteIngest, type RedisLike, type RedisPipeline } from './vote-ingest.ts';
import assert from 'node:assert/strict';

const store = new Map<string, number>(); let roundTrips = 0, commands = 0;
const redis: RedisLike = {
  pipeline() {
    const ops: Array<() => void> = [];
    const p: RedisPipeline = {
      hincrby(k, f, by) { ops.push(() => store.set(k + '#' + f, (store.get(k + '#' + f) ?? 0) + by)); return p; },
      sadd() { ops.push(() => {}); return p; },
      expire() { ops.push(() => {}); return p; },
      async exec() { roundTrips++; commands += ops.length; ops.forEach(o => o()); return []; }
    };
    return p;
  }
};
let archived: number[] = [];
let clock = 0;
const ingest = new VoteIngest(redis, { async saveFinalTally(_id, counts) { archived = counts; } }, () => clock);
ingest.open({ voteId: 'v1', options: 4, closesAt: 15_000 });

const expected = [0, 0, 0, 0]; const choice = new Map<string, number>();
const t0 = performance.now(); let accepted = 0;
for (let ms = 0; ms < 15_000; ms++) {
  clock = ms;
  for (let k = 0; k < 5; k++) {                              // 5 votes per millisecond = 5,000/s
    const voter = 'u' + Math.floor(Math.random() * 40_000);
    const opt = Math.random() < 0.6 ? 0 : Math.floor(Math.random() * 4);
    const r = ingest.cast('v1', voter, opt);
    if (r === 'ok' || r === 'changed') { const prev = choice.get(voter); if (prev !== undefined) expected[prev]--; expected[opt]++; choice.set(voter, opt); accepted++; }
  }
  if (ms % 200 === 199) await ingest.flush();               // the 200 ms flush tick
}
const castMs = performance.now() - t0;
clock = 16_000;
assert.equal(ingest.cast('v1', 'late-voter', 1), 'closed', 'votes after the timer are rejected');
const final = await ingest.close('v1');
assert.deepEqual(final, expected, 'node tally matches');
assert.deepEqual([0, 1, 2, 3].map(i => store.get('vote:v1:counts#' + i) ?? 0), expected, 'redis matches');
assert.deepEqual(archived, expected, 'archive matches');
assert.ok(roundTrips <= 76, `round trips ${roundTrips}`);
console.log(`75,000 votes in ${castMs.toFixed(0)} ms of CPU · ${accepted} accepted · ${roundTrips} Redis round trips · ${commands} commands · final ${expected.join('/')}`);
