/* Putt Club — power-up registry.
 *
 * Each power-up is one entry: how rare it is, who it can target, how long it lasts, what it does to the
 * ball (mods) and what happens when it is used (use). engine/match.js only talks to this registry, so a
 * new power-up is a new entry here plus an icon and effect in js/fx.js.
 *
 *   rarity   common | uncommon | rare (weights below)
 *   target   'self' | 'opponent'
 *   hostile  hostile power-ups are blocked by Bubble Guard and respect per-target cooldowns
 *   effect   { duration (seconds of hole time), shots (shots it lasts), until: 'hole' }
 *   mods(ball, effect)   adjust physics fields while the effect is active
 *   use(ctx, user, target) -> { error } | { ok, ... }   server-side rules; ctx is provided by the match
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./physics.js'));
  else root.PuttPowerups = factory(root.PuttPhysics);
})(typeof self !== 'undefined' ? self : this, function (P) {
  'use strict';

  var WEIGHTS = { common: 10, uncommon: 6, rare: 3 };
  var R = P.C.R;

  var LIST = [
    {
      id: 'turbo', name: 'Rocket Putt', kind: 'Turbo Shot', rarity: 'common', target: 'self',
      desc: 'Your next shot launches 50% harder, with a flame trail. Great for long holes.',
      effect: { shots: 1, duration: 45 },
      shotPower: 1.5
    },
    {
      id: 'sticky', name: 'Honey Roll', kind: 'Sticky Ball', rarity: 'common', target: 'self',
      desc: 'Your next 2 shots roll through honey: much more grip, so delicate putts stop where you want.',
      effect: { shots: 2, duration: 45 },
      mods: function (b) { b.fric *= 2.6; }
    },
    {
      id: 'ghost', name: 'Phantom Putt', kind: 'Ghost Shot', rarity: 'uncommon', target: 'self',
      desc: 'Your next shot passes through obstacles: hedges, gates, spinners, bumpers and other balls. Outer rails still count, and the cup still catches you.',
      effect: { shots: 1, duration: 45 },
      mods: function (b, e) { if (e.live) b.ghost = true; }
    },
    {
      id: 'giant', name: 'Boulder Ball', kind: 'Giant Ball', rarity: 'uncommon', target: 'self',
      desc: 'Your ball grows huge for 20 seconds. It bullies other balls out of the way but squeezes through gaps badly.',
      effect: { duration: 20 },
      conflicts: ['tiny'],
      mods: function (b) { b.rTarget = R * 1.65; }
    },
    {
      id: 'tiny', name: 'Pocket Ball', kind: 'Tiny Ball', rarity: 'common', target: 'self',
      desc: 'Your ball shrinks for 20 seconds. Slips through tight gaps, but gets shoved around easily.',
      effect: { duration: 20 },
      conflicts: ['giant'],
      mods: function (b) { b.rTarget = R * 0.58; }
    },
    {
      id: 'reverse', name: 'Mirror Mixup', kind: 'Reverse Controls', rarity: 'uncommon', target: 'opponent', hostile: true,
      desc: 'An opponent\'s aim is flipped for 15 seconds: their shots go the way they pull, not the way they aim. Their aiming guide goes dark too.',
      effect: { duration: 15 },
      reject: function (ctx, user, target) { if (ctx.has(target, 'reverse')) return target.name + ' is already mixed up.'; }
    },
    {
      id: 'freeze', name: 'Frost Ray', kind: 'Freeze Ray', rarity: 'rare', target: 'opponent', hostile: true,
      desc: 'Freezes an opponent\'s ball solid for 4 seconds, mid-roll or at rest. It carries on exactly where it was when it thaws. Frozen balls are immune for 12 seconds after.',
      effect: { duration: 4 },
      immunity: 12,
      reject: function (ctx, user, target) {
        if (ctx.has(target, 'freeze')) return target.name + ' is already frozen.';
        if (target.frostImmuneUntil > ctx.t) return target.name + ' is still thawing out.';
      },
      mods: function (b) { b.frozen = true; }
    },
    {
      id: 'gust', name: 'Gale Cannon', kind: 'Gust Cannon', rarity: 'uncommon', target: 'opponent', hostile: true,
      desc: 'Blasts an opponent\'s ball with a gust of wind, straight away from your ball. If it lands in a hazard they go back with no penalty.',
      instant: true,
      reject: function (ctx, user, target) {
        if (target.gustCdUntil > ctx.t) return target.name + ' was just blown around. Give them a moment.';
        if (ctx.has(target, 'freeze')) return target.name + ' is frozen solid.';
      },
      use: function (ctx, user, target) {
        var a = user.ball, b = target.ball, dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz);
        if (l < 0.05) { dx = -ctx.world.teeDir[0]; dz = -ctx.world.teeDir[1]; l = 1; }
        dx /= l; dz /= l;
        target.gustCdUntil = ctx.t + 6;
        target.gustSafe = { x: b.x, y: b.y, z: b.z, until: ctx.t + 8 };
        P.push(b, dx * 7.5, dz * 7.5);
        ctx.setMoving(target);
        return { ok: true, dir: [dx, dz] };
      }
    },
    {
      id: 'swap', name: 'Switcheroo', kind: 'Ball Swap', rarity: 'rare', target: 'opponent', hostile: true,
      desc: 'Swap places with an opponent. Both balls must be at rest. Strokes and scores stay with their owners.',
      instant: true,
      reject: function (ctx, user, target) {
        if (user.ball.moving || target.ball.moving) return 'Both balls must be at rest to swap.';
        if (ctx.has(user, 'freeze') || ctx.has(target, 'freeze')) return 'Frozen balls cannot swap.';
        if (!user.shotOnce || !target.shotOnce) return 'Both players need to have taken their first shot.';
      },
      use: function (ctx, user, target) {
        var a = user.ball, b = target.ball;
        var from = [a.x, a.y, a.z], to = [b.x, b.y, b.z];
        // Swap through Rapier, lifted a hair so neither spawns overlapping the floor.
        P.place(a, to[0], to[1] + 0.005, to[2]);
        P.place(b, from[0], from[1] + 0.005, from[2]);
        var t = a.safe; a.safe = b.safe; b.safe = t;
        return { ok: true, from: from, to: to };
      }
    },
    {
      id: 'shield', name: 'Bubble Guard', kind: 'Shield Bubble', rarity: 'uncommon', target: 'self',
      desc: 'A bubble that pops the next hostile power-up aimed at you. Lasts until it blocks something or the hole ends.',
      effect: { until: 'hole' }
    },
    {
      id: 'magnet', name: 'Cup Magnet', kind: 'Magnet', rarity: 'common', target: 'self',
      desc: 'For your next 2 shots the cup gently pulls your ball in when it rolls within about 3.5 units, as long as no wall is in the way.',
      effect: { shots: 2, duration: 45 },
      mods: function (b) { b.magnet = true; }
    },
    {
      id: 'confetti', name: 'Party Popper', kind: 'Confetti Chaos', rarity: 'common', target: 'opponent', hostile: true,
      desc: 'Showers an opponent\'s screen edges with confetti for 6 seconds. Their ball, the cup and the aiming controls stay clear.',
      effect: { duration: 6 },
      reject: function (ctx, user, target) { if (ctx.has(target, 'confetti')) return target.name + ' is already partying.'; }
    }
  ];

  var BY_ID = {};
  LIST.forEach(function (p) { p.weight = WEIGHTS[p.rarity]; BY_ID[p.id] = p; });

  /**
   * Pick a power-up. Players in the bottom half of the standings draw rare items a little more often,
   * so the leader can't snowball and trailing friends get a shot at chaos.
   */
  function roll(rng, opts) {
    var behind = opts && opts.behind, pool = (opts && opts.pool) || LIST, total = 0, weights = [];
    pool.forEach(function (p) { var wgt = p.weight * (behind && p.rarity === 'rare' ? 1.6 : 1); weights.push(wgt); total += wgt; });
    var x = rng() * total;
    for (var i = 0; i < pool.length; i++) { x -= weights[i]; if (x < 0) return pool[i].id; }
    return pool[pool.length - 1].id;
  }

  /** Public description list for the How-to-play screen. */
  function catalog() {
    return LIST.map(function (p) { return { id: p.id, name: p.name, kind: p.kind, rarity: p.rarity, target: p.target, hostile: !!p.hostile, desc: p.desc }; });
  }

  return { LIST: LIST, BY_ID: BY_ID, WEIGHTS: WEIGHTS, roll: roll, catalog: catalog };
});
