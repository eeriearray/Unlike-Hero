/* Presentation decisions only. No commands, stat changes or gameplay RNG. */
(function (g) {
  'use strict';
  var statuses = {
    blessed: { name: 'Blessed', path: 'M12 2l2.5 6 6.5 1-5 4.5 1 7-5-3.5L7 20.5l1-7L3 9l6.5-1z' },
    cursed: { name: 'Cursed', path: 'M5 5l14 14M19 5L5 19M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20' },
    marked: { name: 'Marked', path: 'M2 12q10-14 20 0-10 14-20 0zM12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8' },
    bleeding: { name: 'Bleeding', path: 'M12 2C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-13zM8 15q0 4 4 4' },
    hunted: { name: 'Hunted', path: 'M4 3l3 13M10 2l2 13M16 3l2 13M4 21l16-4' }
  };
  function fraction(me) { return Math.max(0, Math.min(1, Number(me.san) / Math.max(1, Number(me.maxSan) || 1))); }
  function tier(me) { var f = fraction(me); return f <= .3 ? 'panic' : f <= .65 ? 'asymmetric' : 'subtle'; }
  function gentle(p, reduced) { return !!p.reducedScares || !!reduced; }
  function profile(me, p, reduced) {
    var level = tier(me), mild = gentle(p, reduced);
    return { tier: level, opacity: mild ? (level === 'panic' ? .15 : .08) : level === 'panic' ? .38 : level === 'asymmetric' ? .24 : .12,
      pulse: !mild, distort: !mild && p.distort !== false && level === 'panic' };
  }
  function runKey(v) {
    // Conservative fallback for older servers: never replay a scare for a room code.
    return v.cosmetics && v.cosmetics.runId ? String(v.cosmetics.runId) : 'legacy:' + v.code;
  }
  function hash(text) { var h = 2166136261; for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function freshDanger(events, v) {
    return events.some(function (e) {
      return ((e.p === v.you && ['dmg', 'move', 'trap'].includes(e.k)) || (e.k === 'enemy' && e.loc === v.me.loc));
    });
  }
  function eligible(v, p, context) {
    return !!v && v.phase === 'playing' && v.me && v.me.status === 'alive' && fraction(v.me) <= .3 &&
      v.game.round >= 3 && context.age >= 20000 && p.jumpScares !== false && !gentle(p, context.reduced) &&
      !context.hidden && !context.blocked && !context.used && context.danger && hash(runKey(v) + ':' + context.event) % 16 === 0;
  }
  function claim(storage, key) {
    try {
      var name = 'hollow.scare.v1:' + key;
      if (storage.getItem(name)) return false;
      storage.setItem(name, '1'); return true;
    } catch (e) {
      // If persistence is blocked, suppress surprises rather than replay after reload.
      return false;
    }
  }
  function damagePlan(p, reduced, sample) {
    var mild = gentle(p, reduced), r = Math.max(0, Math.min(.999999, Number(sample) || 0));
    return { duration: 300 + Math.floor(r * 301), texture: !mild, shake: !mild, opacity: mild ? .12 : .55 };
  }
  g.HollowFeedbackPolicy = { statuses: statuses, fraction: fraction, tier: tier, gentle: gentle,
    profile: profile, runKey: runKey, eligible: eligible, freshDanger: freshDanger, claim: claim, damagePlan: damagePlan };
})(window);
