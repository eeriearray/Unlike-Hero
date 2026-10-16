/**
 * Audience vote ingestion for the hosted Party Pack (GDD §1.4 and deliverable 5).
 *
 * Problem: a streamed room can take 5,000+ votes per second during a 15-second vote. Writing
 * each vote to the database would mean 75,000 row locks on the same counter.
 *
 * Approach:
 *   1. Every gateway node keeps an in-memory tally per open vote: one Uint32 counter per option
 *      plus a Set of voter ids for de-duplication. Taking a vote is O(1) with no I/O and no locks.
 *   2. Every FLUSH_MS (200 ms) the node sends only the *deltas* since the last flush, as one
 *      pipelined batch: HINCRBY per option and SADD per voter batch into Redis. With 8 options
 *      that's at most about 10 commands per vote per node per flush, however many votes came in.
 *   3. Redis is the cross-node source of truth for the live tally; the game host reads it
 *      (or gets it pushed) to drive the vote bars and the Hype Meter.
 *   4. When the vote closes, the final flush runs and ONE row per vote is written to the
 *      durable database (Postgres) asynchronously. The database never sees per-vote writes.
 *
 * Changing a vote is supported (the voter's old option is decremented). Late votes after
 * close are rejected. If Redis is slow, deltas accumulate in memory (bounded by the option
 * count, not by vote volume), so backpressure costs nothing but latency.
 *
 * Runs on Node 22.6+ with type stripping (`node vote-ingest.test.ts`); no dependencies. The Redis
 * client is an interface so ioredis / node-redis / Upstash can be plugged in.
 */

export interface RedisPipeline {
  hincrby(key: string, field: string, by: number): RedisPipeline;
  sadd(key: string, ...members: string[]): RedisPipeline;
  expire(key: string, seconds: number): RedisPipeline;
  exec(): Promise<unknown>;
}
export interface RedisLike { pipeline(): RedisPipeline; }
export interface VoteArchive { saveFinalTally(voteId: string, counts: number[], voters: number): Promise<void>; }

export interface VoteSpec { voteId: string; options: number; closesAt: number; }
export type VoteResult = 'ok' | 'changed' | 'duplicate' | 'closed' | 'unknown-vote' | 'bad-option' | 'rate-limited';

const FLUSH_MS = 200;
const KEY_TTL_S = 3600;
const MAX_VOTERS_PER_VOTE = 2_000_000;      // memory guard: ~2M voter ids per vote per node
const VOTER_BATCH = 500;                    // SADD members per command

class OpenVote {
  readonly counts: Uint32Array;
  readonly pending: Int32Array;             // deltas not yet flushed (can go negative on vote changes)
  readonly choice = new Map<string, number>();
  newVoters: string[] = [];
  closed = false;
  readonly spec: VoteSpec;
  constructor(spec: VoteSpec) {
    this.spec = spec;
    this.counts = new Uint32Array(spec.options);
    this.pending = new Int32Array(spec.options);
  }
}

export class VoteIngest {
  private votes = new Map<string, OpenVote>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing: Promise<void> | null = null;
  // simple per-voter token bucket: blocks scripted spam without a lookup service
  private lastVoteAt = new Map<string, number>();

  private redis: RedisLike; private archive: VoteArchive; private now: () => number;
  constructor(redis: RedisLike, archive: VoteArchive, now: () => number = Date.now) { this.redis = redis; this.archive = archive; this.now = now; }

  start(): void { if (!this.timer) this.timer = setInterval(() => { void this.flush(); }, FLUSH_MS); }
  async stop(): Promise<void> { if (this.timer) clearInterval(this.timer); this.timer = null; await this.flush(); }

  open(spec: VoteSpec): void {
    if (spec.options < 1 || spec.options > 16) throw new RangeError('options must be 1..16');
    this.votes.set(spec.voteId, new OpenVote(spec));
  }

  /** Hot path: called for every incoming vote (WebSocket frame, chat command, HTTP beacon). No I/O. */
  cast(voteId: string, voterId: string, option: number): VoteResult {
    const v = this.votes.get(voteId);
    if (!v) return 'unknown-vote';
    if (v.closed || this.now() > v.spec.closesAt) return 'closed';
    if (!Number.isInteger(option) || option < 0 || option >= v.spec.options) return 'bad-option';
    const t = this.now(), last = this.lastVoteAt.get(voterId) ?? 0;
    if (t - last < 250) return 'rate-limited';
    this.lastVoteAt.set(voterId, t);

    const prev = v.choice.get(voterId);
    if (prev === option) return 'duplicate';
    if (prev === undefined) {
      if (v.choice.size >= MAX_VOTERS_PER_VOTE) return 'rate-limited';
      v.newVoters.push(voterId);
    } else {
      v.counts[prev]--; v.pending[prev]--;
    }
    v.choice.set(voterId, option);
    v.counts[option]++; v.pending[option]++;
    return prev === undefined ? 'ok' : 'changed';
  }

  /** This node's live tally (for the Hype Meter between flushes). */
  tally(voteId: string): number[] | null { const v = this.votes.get(voteId); return v ? Array.from(v.counts) : null; }

  /** Close a vote: final flush, archive one row, free memory. Returns this node's final counts. */
  async close(voteId: string): Promise<number[] | null> {
    const v = this.votes.get(voteId); if (!v) return null;
    v.closed = true;
    await this.flush();
    const counts = Array.from(v.counts);
    this.votes.delete(voteId);
    // fire-and-forget durable write; a failure is logged, never blocks the game
    this.archive.saveFinalTally(voteId, counts, v.choice.size).catch(err => console.error('archive failed', voteId, err));
    return counts;
  }

  /** Push accumulated deltas to Redis in one pipeline. Re-entrant calls wait for the running flush. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      const p = this.redis.pipeline(); let commands = 0;
      const sent: Array<{ v: OpenVote; deltas: Int32Array; voters: string[] }> = [];
      for (const v of this.votes.values()) {
        const deltas = v.pending.slice(); const voters = v.newVoters;
        if (!voters.length && deltas.every(d => d === 0)) continue;
        v.pending.fill(0); v.newVoters = [];
        const key = `vote:${v.spec.voteId}`;
        deltas.forEach((d, i) => { if (d) { p.hincrby(`${key}:counts`, String(i), d); commands++; } });
        for (let i = 0; i < voters.length; i += VOTER_BATCH) { p.sadd(`${key}:voters`, ...voters.slice(i, i + VOTER_BATCH)); commands++; }
        p.expire(`${key}:counts`, KEY_TTL_S); p.expire(`${key}:voters`, KEY_TTL_S); commands += 2;
        sent.push({ v, deltas, voters });
      }
      if (!commands) return;
      try { await p.exec(); }
      catch (err) {
        // Put the deltas back so nothing is lost; the next flush retries them.
        for (const { v, deltas, voters } of sent) { deltas.forEach((d, i) => { v.pending[i] += d; }); v.newVoters = voters.concat(v.newVoters); }
        throw err;
      }
    })().finally(() => { this.flushing = null; });
    return this.flushing;
  }
}
