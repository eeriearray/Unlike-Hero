/*!
 * Dragon Clash — CPU dragons.
 *
 * A bot reads the simulation like a player reads the screen and returns held buttons, nothing more. It never
 * touches fighter state, so a CPU has exactly the same moves, cooldowns and rules as a person.
 *   var bot = new DC.Bot(sim, fighterIndex, { level: 1..3, seed });
 *   input = bot.think();   // { held, pressed: 0 }
 * Training dummies use modes: 'stand', 'jump', 'dodge', 'cpu'.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dc-data.js'), require('./dc-sim.js'));
  else { root.DC = root.DC || {}; root.DC.Bot = factory(root.DC.Data, root.DC.Sim); }
})(typeof self !== 'undefined' ? self : this, function (D, Sim) {
  'use strict';
  var B = Sim.BTN;
  var LEVELS = {
    1: { react: 20, aim: 0.55, dodge: 0.05, aggression: 0.35, sig: 0.02, ability: 0.004 },
    2: { react: 11, aim: 0.8,  dodge: 0.18, aggression: 0.6,  sig: 0.035, ability: 0.008 },
    3: { react: 5,  aim: 0.95, dodge: 0.38, aggression: 0.8,  sig: 0.05, ability: 0.012 },
  };

  function Bot(sim, index, opts) {
    opts = opts || {};
    this.sim = sim; this.i = index;
    this.mode = opts.mode || 'cpu';
    this.cfg = LEVELS[opts.level || 2] || LEVELS[2];
    this.rand = Sim.rng((opts.seed || 7) * 7919 + index * 104729);
    this.hold = 0; this.tap = 0; this.tapT = 0; this.wait = 0; this.plan = null;
  }

  Bot.prototype.press = function (bits, ticks) { this.tap = bits; this.tapT = ticks || 2; };

  Bot.prototype.think = function () {
    var out = this.decide();
    var held = this.hold;
    if (this.tapT > 0) { held |= this.tap; this.tapT--; }
    else if (this.tapT === 0 && this.tap) { this.tap = 0; this.tapT = -3; } // release for a few ticks so the next press registers
    else if (this.tapT < 0) this.tapT++;
    return { held: held | (out || 0), pressed: 0 };
  };

  Bot.prototype.decide = function () {
    var sim = this.sim, me = sim.fighters[this.i], r = this.rand;
    this.hold = 0;
    if (!me || me.state === 'dead' || me.state === 'out') return 0;
    if (this.mode === 'stand') return 0;
    if (this.mode === 'jump') { if (me.grounded && this.tapT === 0 && r() < 0.05) this.press(B.jump, 8); return this.recover(me) || 0; }
    if (this.mode === 'dodge') {
      var near = this.target(me);
      if (near && Math.abs(near.x - me.x) < 140 && near.state === 'attack' && this.tapT === 0) this.press(B.dodge, 2);
      return this.recover(me) || 0;
    }
    var rec = this.recover(me);
    if (rec !== null) return rec;

    if (me.state === 'hitstun') {
      // Survival DI: hold toward the stage and up
      var mid = this.stageMid();
      this.hold = (me.x < mid ? B.right : B.left) | B.up;
      return 0;
    }
    if (me.state === 'ledge') {
      if (me.stateT > 10 + r() * 30 && this.tapT === 0) {
        var c = r();
        this.press(c < 0.35 ? B.jump : c < 0.55 ? B.light : c < 0.75 ? B.dodge : 0, 2);
        if (c >= 0.75) this.hold = me.ledge && me.ledge.side < 0 ? B.right : B.left;
      }
      return 0;
    }
    if (this.wait > 0) { this.wait--; this.hold = this.planHold || 0; return 0; }
    this.wait = Math.round(this.cfg.react * (0.6 + r() * 0.8));

    var t = this.target(me);
    if (!t) return 0;
    var dx = t.x - me.x, dy = t.y - me.y, adx = Math.abs(dx);
    var face = dx > 0 ? B.right : B.left;
    this.planHold = 0;

    // Dodge an incoming attack
    if (t.state === 'attack' && adx < 150 && Math.abs(dy) < 120 && r() < this.cfg.dodge && me.dodgeCd <= 0) {
      this.press(B.dodge, 2);
      this.planHold = r() < 0.5 ? (dx > 0 ? B.left : B.right) : 0;
      this.hold = this.planHold;
      return 0;
    }
    // Incoming projectile: jump over it sometimes
    for (var k = 0; k < sim.projectiles.length; k++) {
      var p = sim.projectiles[k];
      if (p.team !== me.team && Math.abs(p.x - me.x) < 160 && Math.abs(p.y - (me.y - 60)) < 90 && Math.sign(me.x - p.x) === Math.sign(p.vx || 1) && r() < this.cfg.dodge + 0.15) {
        if (me.grounded) this.press(B.jump, 6); else if (me.dodgeCd <= 0) this.press(B.dodge, 2);
        return 0;
      }
    }

    var reach = 95 * me.stats.scale[0];
    if (adx < reach && Math.abs(dy) < 90 && r() < this.cfg.aggression + 0.25) {
      this.hold = r() < this.cfg.aim ? face : 0;
      var heavy = t.dmg > 85 && r() < 0.5 ? true : r() < 0.18;
      if (me.grounded) {
        if (r() < this.cfg.ability && me.abilityCd <= 0) { this.hold = B.down; this.press(B.sig, 2); }
        else if (dy < -60) { this.hold |= B.up; this.press(heavy ? B.heavy : B.light, 2); }
        else if (r() < 0.2) { this.hold = B.down; this.press(heavy ? B.heavy : B.light, 2); }
        else this.press(heavy ? B.heavy : B.light, 2);
      } else {
        if (dy < -50) this.hold |= B.up; else if (dy > 50) this.hold |= B.down;
        this.press(heavy && dy <= 50 && dy >= -50 ? B.heavy : B.light, 2);
      }
      return 0;
    }
    // Mid-range signature
    if (adx > 180 && adx < 600 && Math.abs(dy) < 70 && me.sigCd <= 0 && r() < this.cfg.sig * 6) {
      this.hold = face;
      this.press(B.sig, 2);
      return 0;
    }
    // Approach, but don't run off the stage
    var safe = this.safeStep(me, dx > 0 ? 1 : -1);
    this.planHold = safe ? face : 0;
    this.hold = this.planHold;
    if (dy < -90 && me.grounded && r() < 0.4) this.press(B.jump, 7);
    else if (!me.grounded && dy < -60 && me.airJumps > 0 && me.vy > 0 && r() < 0.3) this.press(B.jump, 2);
    return 0;
  };

  Bot.prototype.target = function (me) {
    var best = null, bd = 1e9, sim = this.sim;
    sim.fighters.forEach(function (f) {
      if (f === me || !sim.opponents(me, f) || f.state === 'dead' || f.state === 'out') return;
      var d = Math.abs(f.x - me.x) + Math.abs(f.y - me.y) * 0.6;
      if (d < bd) { bd = d; best = f; }
    });
    return best;
  };

  Bot.prototype.stageMid = function () {
    var ps = this.sim.arena.platforms, lo = 1e9, hi = -1e9;
    ps.forEach(function (p) { if (p.solid) { lo = Math.min(lo, p.x); hi = Math.max(hi, p.x + p.w); } });
    return (lo + hi) / 2;
  };

  Bot.prototype.overStage = function (x) {
    return this.sim.arena.platforms.some(function (p) { return p.solid && x > p.x + 10 && x < p.x + p.w - 10; });
  };

  Bot.prototype.safeStep = function (me, dir) {
    if (!me.grounded) return true;
    var p = this.sim.arena.platforms[me.plat];
    if (!p) return true;
    var nx = me.x + dir * 60;
    return nx > p.x + 10 && nx < p.x + p.w - 10 || !p.solid;
  };

  /** Off the stage: steer home, jump, then use the recovery move. Returns held bits or null when safe. */
  Bot.prototype.recover = function (me) {
    if (me.grounded || me.state === 'ledge' || me.state === 'ledgeclimb' || me.state === 'hitstun') return null;
    var main = null;
    var self = this;
    this.sim.arena.platforms.forEach(function (p) {
      if (!p.solid) return;
      if (!main || Math.abs(p.x + p.w / 2 - me.x) < Math.abs(main.x + main.w / 2 - me.x)) main = p;
    });
    if (!main) return null;
    if (this.overStage(me.x) && me.y < main.y) return null;
    var toward = me.x < main.x + main.w / 2 ? B.right : B.left;
    var held = toward;
    if (me.vy > 0 || me.y > main.y + 40) {
      if (me.airJumps > 0 && this.tapT === 0 && me.y > main.y - 60) self.press(B.jump, 2);
      else if (!me.usedRecovery && me.airJumps === 0 && me.y > main.y - 20 && this.tapT === 0) { held |= B.up; self.press(B.heavy, 2); }
    }
    return held;
  };

  Bot.LEVELS = LEVELS;
  return Bot;
});
