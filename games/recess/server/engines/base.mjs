// Shared plumbing for every RECESS match engine.
//
// An engine owns the state of exactly one match. The server never looks inside it; it only calls:
//   handleAction(playerId, action) -> { ok, error? }   validate and apply one client action
//   getView(playerId)              -> object            what that player is allowed to see
//   playerLeft(playerId)                                a human left the match for good
//   dispose()                                           the match is being thrown away
// and engines call this.notify() whenever their state changes on its own (timers, bots).
import { randomInt } from 'node:crypto';

export class BaseEngine {
  constructor(matchId, players, onUpdate, options = {}) {
    this.matchId = matchId;
    this.players = players; // [{ id, name, avatar, isBot }]
    this.onUpdate = onUpdate;
    this.options = options;
    this.timers = new Set();
    this.disposed = false;
    this.abandoned = null; // { by: name } once the match cannot continue
    this.left = new Set();
    this.announcements = []; // lines for the room's activity feed, drained by the server
  }

  announce(text) { this.announcements.push(text); }

  /** setTimeout that is cleared automatically when the match is disposed. */
  later(fn, ms) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (!this.disposed) fn();
    }, ms);
    this.timers.add(t);
    return t;
  }

  cancel(t) {
    if (t) { clearTimeout(t); this.timers.delete(t); }
  }

  dispose() {
    this.disposed = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  notify() {
    if (!this.disposed && this.onUpdate) this.onUpdate();
  }

  player(id) { return this.players.find(p => p.id === id); }

  activePlayers() { return this.players.filter(p => !this.left.has(p.id)); }

  /** Default: a match for a fixed number of players ends when anyone leaves. Engines that can carry on override this. */
  playerLeft(playerId) {
    if (this.left.has(playerId)) return;
    this.left.add(playerId);
    const p = this.player(playerId);
    this.abandoned = { by: p ? p.name : 'A player' };
    this.dispose();
    this.disposed = false; // keep sending views so the others see why it ended
  }

  basePlayers() {
    return this.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, isBot: !!p.isBot, left: this.left.has(p.id) }));
  }

  static rand(n) { return randomInt(n); }

  static shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
