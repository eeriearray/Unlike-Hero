/*!
 * Dragon Clash — the fight simulation.
 *
 * Deterministic, fixed 60 ticks per second, no DOM and no Math.random. The same file runs local matches in the
 * browser, online matches on the server (authoritative) and the automated tests.
 *
 *   var sim = new DC.Sim({ arena, fighters: [{ build, team, name }], stocks, timeLimit, friendlyFire, training });
 *   sim.step(inputs)          // inputs[i] = { held: bits, pressed: bits } for fighter i
 *   sim.drainEvents()         // [{ type: 'hit'|'ko'|'spawn'|'sfx'|..., ... }] since the last drain
 *   sim.snapshot()            // compact view for rendering / the network
 *   sim.result                // null until the match ends
 *
 * Hits come only from attack hitboxes overlapping hurtboxes. Each attack instance hits a target once
 * (multi-hit moves reset their hit list on an explicit schedule), so a lingering overlap never racks up hits.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dc-data.js'), require('./dc-build.js'));
  else { root.DC = root.DC || {}; root.DC.Sim = factory(root.DC.Data, root.DC.Build); }
})(typeof self !== 'undefined' ? self : this, function (D, Build) {
  'use strict';

  var P = D.PHYSICS;
  var BTN = { left: 1, right: 2, up: 4, down: 8, jump: 16, light: 32, heavy: 64, sig: 128, dodge: 256, gear: 512, guard: 1024, taunt: 2048, ability: 4096 };
  var ACTIONS = BTN.jump | BTN.light | BTN.heavy | BTN.sig | BTN.dodge | BTN.gear | BTN.guard | BTN.taunt | BTN.ability;
  // States in which a dragon is still inside the combo that put it there (it cannot act yet)
  var COMBO_STATES = { hitstun: 1, wallsplat: 1, grabbed: 1 };
  var DEG = Math.PI / 180;

  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sign(v) { return v < 0 ? -1 : 1; }
  function r1(v) { return Math.round(v * 10) / 10; }

  // Seeded RNG (mulberry32) so bots and any randomness replay identically.
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ─────────────────────────── Elemental interaction rules ───────────────────────────
  // Projectile meets projectile (opposing owners). Returns { rule, kill: 'a'|'b'|'both'|null }.
  var CLASH_RULES = [
    { rule: 'extinguish', test: function (a, b) { return a.element === 'water' && b.element === 'fire'; } },
    // Fire melts an ice shard but is spent doing it (it used to fly on, winning every trade against ice)
    { rule: 'melt',       both: true, test: function (a, b) { return a.element === 'fire' && b.element === 'ice'; } },
    { rule: 'absorb',     test: function (a, b) { return a.element === 'earth' && b.element === 'lightning' && (a.type === 'boulder' || a.type === 'quake'); } },
  ];
  var HAZARD_TYPES = { flames: 1, puddle: 1, chillField: 1, whirlpool: 1 };

  function resolveClash(a, b) {
    for (var i = 0; i < CLASH_RULES.length; i++) {
      if (CLASH_RULES[i].test(a, b)) return { rule: CLASH_RULES[i].rule, kill: CLASH_RULES[i].both ? 'both' : 'b' };
      if (CLASH_RULES[i].test(b, a)) return { rule: CLASH_RULES[i].rule, kill: CLASH_RULES[i].both ? 'both' : 'a' };
    }
    // Hazards on the floor don't cancel missiles; only the rules above affect them.
    if (HAZARD_TYPES[a.type] || HAZARD_TYPES[b.type]) return { rule: null, kill: null };
    return { rule: 'clash', kill: 'both' };
  }

  /** Damage of one hit after the elemental counter modifier. Only `elem` is modified. */
  function hitDamage(phys, elem, attackerElement, defenderElement, config) {
    return r1(phys + elem * D.elementMultiplier(attackerElement, defenderElement, config));
  }

  // ─────────────────────────────────── Sim ───────────────────────────────────
  function Sim(opts) {
    opts = opts || {};
    this.arena = D.ARENAS[opts.arena] || D.ARENAS.skyforge;
    this.stocks = clamp(opts.stocks | 0 || 3, 1, 9);
    this.timeLimit = opts.timeLimit | 0;          // ticks, 0 = none
    this.friendlyFire = !!opts.friendlyFire;
    this.training = opts.training || null;        // { infinite: true }
    this.elementConfig = opts.elementConfig || D.ELEMENT_CONFIG;
    this.random = rng(opts.seed || 1);
    this.tick = 0;
    this.events = [];
    this.projectiles = [];
    this.structures = [];
    this.nextId = 1;
    this.result = null;
    this.ledgeOwners = {};
    this.decoys = [];
    this.freeze = 0;          // super cinematic: the whole world waits
    this.freezeBy = -1;

    var self = this;
    var fs = opts.fighters || [];
    if (fs.length < 2) throw new Error('A match needs at least two dragons.');
    this.fighters = fs.map(function (spec, i) {
      var v = Build.validateBuild(spec.build);
      if (!v.ok) throw new Error('Invalid build for ' + (spec.name || 'player ' + (i + 1)) + ': ' + v.errors.join(' '));
      var b = Build.sanitize(spec.build);
      var st = Build.deriveStats(b);
      var f = {
        i: i, id: spec.id || 'f' + i, name: String(spec.name || b.name).slice(0, 24), team: spec.team | 0,
        build: b, stats: st, element: b.element,
        x: 0, y: 0, vx: 0, vy: 0, kbx: 0, kby: 0, facing: 1, grounded: true, plat: -1,
        state: 'idle', stateT: 0, move: null, moveDef: null, moveKind: null, moveT: 0, attackId: 0, hits: {}, multiN: 0,
        airJumps: st.airJumps, usedRecovery: false, usedBlink: false, airDodged: false, fastFall: false,
        dmg: 0, stocks: self.stocks, hitlag: 0, hitstun: 0, tumble: false, invuln: 0, landLag: 0,
        dodgeCd: 0, sigCd: 0, abilityCd: 0, ledge: null, ledgeRegrab: 0, ledgeInvulnUsed: false,
        status: { chill: 0, burn: 0, burnNext: 0, soaked: 0 }, buffs: { stoneSkin: 0 }, gearCd: 0, fade: 0, aegis: 0, rage: 0, ambush: 0, ambushMult: 1, phaseBoost: 1,
        buf: null, held: 0, prevHeld: 0, jumpT: 0, squat: 0, squatFromUp: false, dropT: 0, respawnT: 0,
        techWindow: 0, lastHitBy: -1, lastHitTick: -9999, prevDown: false, prevHeld2: 0, tapJump: spec.tapJump !== false,
        kos: 0, falls: 0, dealt: 0, taken: 0,
        guardHp: st.guardMax, guardPressT: -999, parryOk: false, crouchGuard: false, blockT: 0, staggerT: 0, recoilT: 0, armor: 0,
        meter: 0, combo: null, grab: -1, grabbedBy: -1, splatUsed: false, splatT: 0, splatSide: 0, wallTouch: 0, wallJumpCd: 0,
        getupHow: null, getupDir: 0, hitConfirm: false, moveEx: false, hitKind: '', landFromAttack: false, parries: 0,
      };
      return f;
    });
    this.fighters.forEach(function (f, i) { self.placeAtSpawn(f, i); });
  }

  Sim.BTN = BTN;
  Sim.resolveClash = resolveClash;
  Sim.hitDamage = hitDamage;
  Sim.rng = rng;

  var S = Sim.prototype;

  S.emit = function (e) { e.tick = this.tick; this.events.push(e); };
  S.drainEvents = function () { var e = this.events; this.events = []; return e; };

  S.placeAtSpawn = function (f, i) {
    var sp = this.arena.spawns[i % this.arena.spawns.length];
    f.x = sp[0]; f.y = sp[1]; f.vx = f.vy = f.kbx = f.kby = 0;
    f.facing = f.x < this.arena.size[0] / 2 ? 1 : -1;
    f.grounded = true; f.plat = this.platformAt(f.x, f.y);
    f.state = 'idle'; f.stateT = 0; f.move = null; f.hitstun = 0; f.tumble = false;
    f.airJumps = f.stats.airJumps; f.usedRecovery = false; f.usedBlink = false; f.airDodged = false;
    f.guardHp = f.stats.guardMax; f.combo = null; f.splatUsed = false; f.grab = -1; f.grabbedBy = -1; f.armor = 0;
  };

  S.platformAt = function (x, y) {
    var ps = this.arena.platforms;
    for (var k = 0; k < ps.length; k++) if (Math.abs(ps[k].y - y) < 1 && x >= ps[k].x && x <= ps[k].x + ps[k].w) return k;
    return -1;
  };

  S.hurtbox = function (f) {
    var w = f.stats.hurt.w, h = f.stats.hurt.h;
    // Crouching (and crouch-guarding) lowers the hurtbox, so high attacks can whiff over it
    if (f.state === 'crouch' || f.state === 'crawl' || ((f.state === 'guard' || f.state === 'blockstun') && f.crouchGuard)) h *= 0.66;
    return { x: f.x - w / 2, y: f.y - h, w: w, h: h };
  };

  S.isAlive = function (f) { return f.state !== 'dead' && f.state !== 'out'; };
  S.opponents = function (a, b) { return a.team !== b.team || (this.friendlyFire && a !== b); };

  // ─────────────────────────────── Step ───────────────────────────────
  S.step = function (inputs) {
    if (this.result) return;
    this.tick++;
    if (this.freeze > 0) {
      // The super's cinematic: nobody moves, no timers run, then the move plays out
      if (--this.freeze === 0) this.emit({ type: 'superGo', f: this.freezeBy });
      return;
    }
    var fs = this.fighters, i;
    for (i = 0; i < fs.length; i++) this.updateFighter(fs[i], (inputs && inputs[i]) || { held: 0, pressed: 0 });
    this.separate();
    this.updateStructures();
    this.updateProjectiles();
    this.updateDecoys();
    this.detectHits();
    for (i = 0; i < fs.length; i++) this.checkBlast(fs[i]);
    this.checkEnd();
  };

  S.updateFighter = function (f, input) {
    var held = input.held | 0;
    var pressed = (input.pressed | 0) | (held & ~f.prevHeld & (ACTIONS | BTN.up));
    if (!f.tapJump) pressed &= ~BTN.up;
    f.prevHeld = held;
    f.held = held;

    if (f.state === 'out') return;
    if (f.state === 'dead') {
      if (--f.respawnT <= 0) this.respawn(f);
      return;
    }
    // Input buffer: remember action presses for a few ticks so they come out as soon as the dragon can act.
    // Presses on the same tick arrive together; INPUT_PRIORITY decides between them when they are used.
    if (pressed & (ACTIONS | BTN.up)) f.buf = { bits: pressed & (ACTIONS | BTN.up), t: P.inputBuffer, held: held };
    else if (f.buf && --f.buf.t <= 0) f.buf = null;
    if (pressed & BTN.dodge) f.techWindow = 10;
    else if (f.techWindow > 0) f.techWindow--;
    // Parry window opens on a fresh Guard press; pressing again too soon gives none (mashing never parries)
    if (pressed & BTN.guard) { f.parryOk = this.tick - f.guardPressT > P.parryLockout; f.guardPressT = this.tick; }

    if (f.hitlag > 0) { f.hitlag--; return; }
    if (f.combo && !COMBO_STATES[f.state]) this.endCombo(f);

    // Timers
    if (f.invuln > 0) f.invuln--;
    if (f.dodgeCd > 0) f.dodgeCd--;
    if (f.sigCd > 0) f.sigCd--;
    if (f.abilityCd > 0) f.abilityCd--;
    if (f.ledgeRegrab > 0) f.ledgeRegrab--;
    if (f.dropT > 0) f.dropT--;
    if (f.buffs.stoneSkin > 0) f.buffs.stoneSkin--;
    if (f.gearCd > 0) f.gearCd--;
    if (f.fade > 0) f.fade--;
    if (f.aegis > 0) f.aegis--;
    if (f.rage > 0) f.rage--;
    if (f.ambush > 0) f.ambush--;
    if (f.armor > 0) f.armor--;
    if (f.wallJumpCd > 0) f.wallJumpCd--;
    if (f.state !== 'guard' && f.state !== 'blockstun' && f.guardHp < f.stats.guardMax) f.guardHp = Math.min(f.stats.guardMax, f.guardHp + P.guardRegen);
    this.updateStatus(f);
    f.stateT++;

    var dirX = ((held & BTN.right) ? 1 : 0) - ((held & BTN.left) ? 1 : 0);
    var dirY = ((held & BTN.down) ? 1 : 0) - ((held & BTN.up) ? 1 : 0);
    var moveMult = f.status.chill > 0 ? D.STATUS.chill.moveMult : 1;

    switch (f.state) {
      case 'hitstun': this.stHitstun(f, dirX, dirY); break;
      case 'attack': this.stAttack(f, dirX, dirY, held); break;
      case 'ledge': this.stLedge(f, dirX, dirY, held); return;
      case 'ledgeclimb': this.stLedgeClimb(f); return;
      case 'grabbed': this.stGrabbed(f); return;
      case 'throwing': this.stThrowing(f, dirX); return;
      case 'wallsplat': this.stWallsplat(f); return;
      case 'dodge': this.stDodge(f); break;
      case 'airdodge': this.stAirDodge(f); break;
      case 'guard': this.stGuard(f, dirX, dirY, held); break;
      case 'blockstun': this.stBlockstun(f, held); break;
      case 'stagger': if (--f.staggerT <= 0) this.setState(f, f.grounded ? 'idle' : 'air'); break;
      case 'recoil': if (--f.recoilT <= 0) this.setState(f, f.grounded ? 'idle' : 'air'); break;
      case 'down': this.stDown(f, dirX); break;
      case 'getup': this.stGetup(f); break;
      case 'taunt':
        if (f.stateT >= P.tauntTicks) { this.addMeter(f, P.meterTaunt); this.setState(f, f.grounded ? 'idle' : 'air'); }
        break;
      case 'land':
        if (--f.landLag <= 0) this.setState(f, 'idle');
        f.vx *= P.groundFriction;
        break;
      case 'squat':
        this.stSquat(f, dirX, held);
        break;
      default:
        this.stFree(f, dirX, dirY, held, moveMult);
    }
    this.physics(f, dirX, held, moveMult);
  };

  S.addMeter = function (f, v) { if (f) f.meter = clamp(f.meter + v, 0, P.meterMax); };

  /** The combo on f is over (it can act again): report it and clear its anti-infinite bookkeeping. */
  S.endCombo = function (f) {
    var C = f.combo;
    if (C && C.n >= 2) this.emit({ type: 'comboEnd', f: f.i, by: C.by, n: C.n, dmg: r1(C.dmg), x: f.x, y: f.y });
    f.combo = null; f.splatUsed = false;
  };

  S.setState = function (f, s) { f.state = s; f.stateT = 0; };

  S.updateStatus = function (f) {
    var st = f.status;
    if (st.chill > 0) st.chill--;
    if (st.soaked > 0) { st.soaked--; if (st.burn > 0) { st.burn = 0; this.emit({ type: 'rule', rule: 'extinguish', x: f.x, y: f.y - 70 }); } }
    if (st.burn > 0) {
      st.burn--;
      if (--st.burnNext <= 0) {
        st.burnNext = D.STATUS.burn.every;
        f.dmg = Math.min(P.maxDamage, r1(f.dmg + D.STATUS.burn.damage));
        f.taken += D.STATUS.burn.damage;
        this.emit({ type: 'burnTick', target: f.i, x: f.x, y: f.y - 80 });
      }
    }
  };

  function dirName(dirX, dirY) { return dirY < 0 ? 'up' : dirY > 0 ? 'down' : dirX !== 0 ? 'side' : 'neutral'; }

  // Free states: idle, run, crouch, air.
  S.stFree = function (f, dirX, dirY, held, moveMult) {
    var b = f.buf ? f.buf.bits : 0;
    var dir = dirName(dirX, dirY);
    if (f.grounded) {
      if (b & BTN.gear) { f.buf = null; this.useGear(f); return; }
      if (this.tryAttack(f, b, dir, dirX, held)) return;
      if (b & BTN.dodge && f.dodgeCd <= 0) { f.buf = null; this.startDodge(f, dirX); return; }
      if (b & (BTN.jump | BTN.up)) {
        var fromUp = !(b & BTN.jump);
        f.buf = null;
        this.setState(f, 'squat'); f.squat = 3; f.squatFromUp = fromUp;
        return;
      }
      if (b & BTN.taunt) { f.buf = null; this.setState(f, 'taunt'); this.emit({ type: 'taunt', f: f.i, x: f.x, y: f.y }); return; }
      if (held & BTN.guard) { this.setState(f, 'guard'); f.crouchGuard = !!(held & BTN.down); this.emit({ type: 'guardUp', f: f.i, x: f.x, y: f.y }); return; }
      var pl = this.arena.platforms[f.plat];
      if ((held & BTN.down) && pl && !pl.solid && (f.prevDown === false)) {
        f.grounded = false; f.dropT = 12; f.plat = -1; this.setState(f, 'air');
      }
      f.prevDown = !!(held & BTN.down);
      if (!f.grounded) return;
      if ((held & BTN.down) && pl && pl.solid) {
        // Down on solid ground: crouch, or crawl along low (and keep the small hurtbox) when a direction is held
        if (dirX !== 0) { f.facing = dirX; if (f.state !== 'crawl') this.setState(f, 'crawl'); }
        else if (f.state !== 'crouch') this.setState(f, 'crouch');
      } else if (dirX !== 0) {
        f.facing = dirX;
        if (f.state !== 'run') this.setState(f, 'run');
      } else if (f.state !== 'idle') this.setState(f, 'idle');
    } else {
      if (f.state !== 'air') this.setState(f, 'air');
      if (b & BTN.gear) { f.buf = null; this.useGear(f); return; }
      if (this.tryAttack(f, b, dir, dirX, held)) return;
      if (b & BTN.dodge && !f.airDodged && f.dodgeCd <= 0) {
        f.buf = null;
        f.airDodged = true;
        f.dodgeCd = f.stats.dodgeCd;
        var len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        f.vx = dirX / len * P.airDodgeSpeed; f.vy = dirY / len * P.airDodgeSpeed;
        f.kbx = f.kby = 0;
        this.setState(f, 'airdodge');
        this.emit({ type: 'sfx', id: 'dodge', f: f.i, x: f.x, y: f.y });
        return;
      }
      // Wall jump: kick off an arena wall you are touching (does not spend an air jump)
      if (b & (BTN.jump | BTN.up) && f.wallTouch && f.wallJumpCd <= 0) {
        f.buf = null;
        f.vx = -f.wallTouch * P.wallJumpSpeed; f.vy = -f.stats.jump * 0.85; f.jumpT = 0; f.kbx = f.kby = 0;
        f.facing = -f.wallTouch; f.wallJumpCd = 20; f.fastFall = false;
        this.emit({ type: 'walljump', f: f.i, x: f.x, y: f.y, side: f.wallTouch });
      } else if (b & (BTN.jump | BTN.up) && f.airJumps > 0 && f.stateT > 1) {
        f.buf = null;
        f.airJumps--;
        f.vy = -f.stats.jump * 0.94; f.jumpT = 0;
        if (dirX !== 0) { f.vx = dirX * f.stats.air * moveMult; f.facing = dirX; }
        f.fastFall = false;
        this.emit({ type: 'jump', air: true, f: f.i, x: f.x, y: f.y });
      }
      // Fast fall: tap down while falling
      if (dirY > 0 && !(f.prevHeld2 & BTN.down) && f.vy > -1) f.fastFall = true;
      f.prevHeld2 = held;
      this.tryLedge(f);
    }
  };

  S.startDodge = function (f, dirX) {
    if (dirX !== 0) { f.facing = dirX; f.dodgeDir = dirX; } else f.dodgeDir = 0;
    f.dodgeCd = f.stats.dodgeCd;
    this.setState(f, 'dodge');
    this.emit({ type: 'sfx', id: 'dodge', f: f.i, x: f.x, y: f.y });
  };

  S.stSquat = function (f, dirX, held) {
    var b = f.buf ? f.buf.bits : 0;
    // A tap-jump (up) followed quickly by an attack becomes a grounded up attack instead of a jump.
    if (f.squatFromUp && (b & (BTN.light | BTN.heavy))) { this.setState(f, 'idle'); this.tryAttack(f, b, 'up', dirX, held); return; }
    if (--f.squat > 0) return;
    var full = (held & (BTN.jump | (f.tapJump ? BTN.up : 0))) !== 0;
    f.grounded = false; f.plat = -1;
    f.vy = -f.stats.jump * (full ? 1 : P.shortHop);
    if (dirX !== 0) f.facing = dirX;
    this.setState(f, 'air');
    this.emit({ type: 'jump', air: false, f: f.i, x: f.x, y: f.y });
  };

  S.moveDef = function (f, key) {
    if (key === 'sig') return D.SIGNATURES[f.stats.signature];
    if (key === 'ability') return D.ABILITIES[f.stats.ability];
    return D.MOVES[key];
  };

  /**
   * Turn buffered button bits into a move. Categories are tried in D.INPUT_PRIORITY order, so simultaneous presses
   * always resolve the same way. `only` (cancels) limits the categories; the current move is never chosen again.
   */
  S.tryAttack = function (f, b, dir, dirX, held, only) {
    var guard = (held | 0) & BTN.guard, key = null, ex = false, order = D.INPUT_PRIORITY;
    // The elemental ability has its own button; Down + Signature still works too
    var special = b & (BTN.sig | BTN.ability), elemental = (b & BTN.ability) || dir === 'down';
    for (var i = 0; i < order.length && !key; i++) {
      var c = order[i];
      if (only && only.indexOf(c) < 0) continue;
      if (c === 'super' && guard && (b & BTN.heavy) && f.meter >= D.MOVES.ultimate.meter) key = 'ultimate';
      else if (c === 'ex' && guard && special && f.meter >= P.meterBar) { key = elemental ? 'ability' : 'sig'; ex = true; }
      else if (c === 'grab' && guard && (b & BTN.light) && f.grounded && !only) key = 'grab';
      else if (c === 'sig' && special) key = elemental ? 'ability' : 'sig';
      else if (c === 'light' && (b & BTN.light)) key = D.pickMove('light', dir, f.grounded);
      else if (c === 'heavy' && (b & BTN.heavy)) {
        // Command attack: Heavy while running flat out is a charging ram
        key = f.grounded && f.state === 'run' && dir === 'side' && Math.abs(f.vx) > f.stats.run * 0.8 && f.stateT > 4 ? 'dashAttack' : D.pickMove('heavy', dir, f.grounded);
      }
      if (key && only && key === f.move && !ex) key = null;
    }
    if (!key) return false;
    var def = this.moveDef(f, key);
    if (ex) def = D.exVersion(def);
    else {
      if (key === 'sig' && f.sigCd > 0) { f.buf = null; this.emit({ type: 'sfx', id: 'denied', x: f.x, y: f.y, f: f.i }); return true; }
      if (key === 'ability' && f.abilityCd > 0) { f.buf = null; this.emit({ type: 'sfx', id: 'denied', x: f.x, y: f.y, f: f.i }); return true; }
    }
    if (key === 'wingBurst' && f.usedRecovery) { f.buf = null; return false; }
    if ((def.groundOnly || (def.spawn && def.spawn.ground)) && !f.grounded) { f.buf = null; this.emit({ type: 'sfx', id: 'denied', x: f.x, y: f.y, f: f.i }); return true; }
    if (def.oncePerAir && !f.grounded && f.usedBlink) { f.buf = null; return true; }
    f.buf = null;
    if (ex) this.addMeter(f, -P.meterBar);
    if (key === 'ultimate') f.meter = 0;
    if (dirX !== 0 && (f.grounded || key === 'sig' || key === 'ability' || key === 'fair' || key === 'fheavyAir')) f.facing = dirX;
    this.startMove(f, key, def, ex);
    return true;
  };

  S.startMove = function (f, key, def, ex) {
    if (f.fade > 0) { f.fade = 0; f.ambush = 90; f.ambushMult = D.GEAR_ABILITIES.fade.ambush; this.emit({ type: 'unfade', f: f.i, x: f.x, y: f.y }); }
    var cancelled = f.state === 'attack' ? f.move : null;
    f.move = key; f.moveDef = def; f.moveT = 0; f.multiN = 0;
    f.moveKind = key === 'sig' ? 'sig' : key === 'ability' ? 'ability' : def.kind;
    f.moveEx = !!ex; f.hitConfirm = false;
    f.attackId = this.nextId++;
    f.hits = {};
    if (key === 'sig') f.sigCd = f.stats.sigCd;
    if (key === 'ability') f.abilityCd = f.stats.abilityCd;
    if (key === 'wingBurst') { f.usedRecovery = true; f.fastFall = false; }
    if (def.oncePerAir && !f.grounded) f.usedBlink = true;
    if (def.armor) f.armor = def.startup;
    if (def.invulnStartup) f.invuln = Math.max(f.invuln, def.startup);
    this.setState(f, 'attack');
    this.emit({ type: 'attack', f: f.i, move: key, kind: f.moveKind, element: f.element, x: f.x, y: f.y, ex: !!ex, cancel: cancelled });
    if (key === 'ultimate') {
      this.freeze = def.freeze; this.freezeBy = f.i;
      f.invuln = Math.max(f.invuln, def.startup + def.active);
      this.emit({ type: 'super', f: f.i, x: f.x, y: f.y, element: f.element, ticks: def.freeze });
    }
  };

  S.stAttack = function (f, dirX, dirY, held) {
    var def = f.moveDef;
    var t = ++f.moveT;
    var start = def.startup, end = def.startup + def.active, total = end + def.recovery;
    if (t === start) this.onActive(f, def);
    if (t >= start && t < end) {
      if (def.selfVel) {
        if (def.selfVel[1] && f.move !== 'wingBurst') f.vy = def.selfVel[1];
        if (def.selfVel[0]) f.vx = def.selfVel[0] * f.facing;
      }
      if (def.multi && (t - start) % def.multi.every === 0 && f.multiN < def.multi.max) { f.hits = {}; f.multiN++; }
      if (def.trail && (t - start) % def.trail.every === 0 && f.grounded) this.spawnTrail(f, def.trail);
    }
    if (def.lunge && t === start) f.vx += def.lunge * f.facing;
    // Cancel window: once this move has hit or been blocked, a buffered stronger move takes over
    if (f.hitConfirm && f.buf && t >= start && t < end + P.cancelLate) {
      if (def.jumpCancel && f.grounded && (f.buf.bits & (BTN.jump | BTN.up))) {
        f.buf = null; f.move = null; f.moveDef = null;
        this.setState(f, 'squat'); f.squat = 3; f.squatFromUp = false;
        this.emit({ type: 'cancel', f: f.i, into: 'jump', x: f.x, y: f.y });
        return;
      }
      // Tempest instinct: Dodge cancels a connected move into a dash for half a bar
      if (f.stats.windCancel && (f.buf.bits & BTN.dodge) && f.grounded && f.meter >= f.stats.windCancel) {
        f.buf = null; this.addMeter(f, -f.stats.windCancel); f.move = null; f.moveDef = null; f.moveEx = false;
        this.startDodge(f, dirX); f.dodgeCd = 0;
        this.emit({ type: 'cancel', f: f.i, into: 'wind', x: f.x, y: f.y });
        return;
      }
      var allowed = D.CANCELS[f.moveKind];
      var aid = f.attackId;
      if (allowed && this.tryAttack(f, f.buf.bits, dirName(dirX, dirY), dirX, held, allowed) && f.attackId !== aid) {
        this.emit({ type: 'cancel', f: f.i, into: f.move, x: f.x, y: f.y });
        return;
      }
    }
    // Aerials can drift
    if (!f.grounded && dirX !== 0) f.vx = clamp(f.vx + dirX * 0.35, -f.stats.air, f.stats.air);
    if (!f.grounded) this.tryLedge(f);
    if (t >= total) {
      f.move = null; f.moveDef = null; f.moveEx = false;
      this.setState(f, f.grounded ? 'idle' : 'air');
    }
  };

  // The first active frame: projectiles, structures, buffs, teleports.
  S.onActive = function (f, def) {
    var sp = def.spawn;
    if (f.move === 'wingBurst') { f.vy = def.selfVel[1]; f.vx *= 0.5; this.emit({ type: 'jump', air: true, burst: true, f: f.i, x: f.x, y: f.y }); }
    if (def.lunge) {}
    if (sp) {
      var dirs = sp.both ? [1, -1] : [f.facing];
      for (var k = 0; k < dirs.length; k++) this.spawnProjectile(f, sp, dirs[k]);
    }
    if (def.structure) {
      var s = def.structure;
      var sx = f.x + f.facing * s.dx;
      this.structures.push({ id: this.nextId++, owner: f.i, team: f.team, type: s.type, element: f.element,
        x: sx - s.w / 2, y: f.y - s.h, w: s.w, h: s.h, life: s.life, hp: s.hp });
      this.emit({ type: 'structure', kind: s.type, x: sx, y: f.y, element: f.element });
    }
    if (def.buff) {
      f.buffs[def.buff.type] = def.buff.ticks;
      this.emit({ type: 'buff', kind: def.buff.type, f: f.i, x: f.x, y: f.y });
    }
    if (def.blink) {
      // Stop just short of the nearest rival ahead within reach, so the strike lands instead of passing them
      var reach = def.blink, self = this;
      this.fighters.forEach(function (o) {
        if (o === f || !self.opponents(f, o) || !self.hittable(o)) return;
        var ahead = (o.x - f.x) * f.facing;
        if (ahead > 0 && ahead < def.blink + 60 && Math.abs(o.y - f.y) < 120) reach = Math.min(reach, Math.max(0, ahead - 55));
      });
      var nx = f.x + f.facing * reach;
      // From the ground it never carries you off the platform's edge (in the air it still crosses gaps)
      if (f.grounded && f.plat >= 0) { var pl = this.arena.platforms[f.plat]; nx = clamp(nx, pl.x + 12, pl.x + pl.w - 12); }
      this.emit({ type: 'blink', f: f.i, x0: f.x, y0: f.y, x1: nx, y1: f.y, element: f.element });
      f.x = nx;
      if (f.grounded && !this.supportAt(f.x, f.y)) { f.grounded = false; f.plat = -1; }
    }
  };

  S.supportAt = function (x, y) { return this.platformAt(x, y) >= 0; };

  S.spawnProjectile = function (f, sp, dir) {
    var x = f.x + dir * (sp.dx || 46), y;
    if (sp.ground) {
      if (f.plat < 0) return;
      var p = this.arena.platforms[f.plat];
      y = p.y;
      x = clamp(x, p.x + sp.w / 2, p.x + p.w - sp.w / 2);
    } else y = f.y + (sp.dy || -98) * f.stats.scale[1];
    var pr = {
      id: this.nextId++, owner: f.i, team: f.team, element: f.element, type: sp.type,
      x: x, y: y, vx: dir * sp.speed, vy: sp.vy || 0, gravity: sp.gravity || 0, w: sp.w, h: sp.h,
      life: sp.life, age: 0, delay: sp.delay || 0, ground: !!sp.ground, plat: sp.ground ? f.plat : -1,
      hit: sp, hits: {}, rehit: sp.rehit || 0, pierce: sp.ground || sp.type === 'iceShard' || sp.type === 'whirlpool' || sp.harmless,
      attackId: this.nextId++,
    };
    this.projectiles.push(pr);
    this.emit({ type: 'spawn', kind: sp.type, element: f.element, x: x, y: y, owner: f.i });
  };

  S.spawnTrail = function (f, tr) {
    var p = this.arena.platforms[f.plat];
    if (!p) return;
    this.projectiles.push({
      id: this.nextId++, owner: f.i, team: f.team, element: f.element, type: tr.type,
      x: f.x - f.facing * 20, y: p.y, vx: 0, vy: 0, gravity: 0, w: tr.w, h: tr.h, life: tr.life, age: 0, delay: 0,
      ground: true, plat: f.plat, hit: tr, hits: {}, rehit: tr.rehit, pierce: true, attackId: this.nextId++,
    });
  };

  S.stDodge = function (f) {
    var t = f.stateT;
    var total = P.dodgeTicks;
    if (t >= P.dodgeInvulnStart && t <= P.dodgeInvulnEnd) f.dodgeInv = true; else f.dodgeInv = false;
    if (f.dodgeDir) {
      var sp = P.dashSpeed * f.stats.dashMult * f.phaseBoost * (1 - t / total);
      f.vx = f.dodgeDir * sp;
    } else f.vx *= 0.6;
    if (t >= total) { f.dodgeInv = false; f.phaseBoost = 1; this.setState(f, 'idle'); }
  };

  S.stAirDodge = function (f) {
    var t = f.stateT;
    f.dodgeInv = t >= P.dodgeInvulnStart && t <= P.dodgeInvulnEnd;
    f.vx *= 0.9; f.vy *= 0.9;
    if (t >= P.airDodgeTicks) { f.dodgeInv = false; this.setState(f, 'air'); }
    this.tryLedge(f);
  };

  S.stHitstun = function (f, dirX, dirY) {
    if (--f.hitstun <= 0) { f.tumble = false; this.setState(f, f.grounded ? 'idle' : 'air'); return; }
    // Small drift so a launched dragon can still steer a little
    if (dirX !== 0) f.vx = clamp(f.vx + dirX * 0.12, -2.5, 2.5);
  };

  // ─────────────────────────────── Guard, parry, blockstun ───────────────────────────────
  S.stGuard = function (f, dirX, dirY, held) {
    var b = f.buf ? f.buf.bits : 0;
    if (!f.grounded) { this.setState(f, 'air'); return; }
    f.guardHp = Math.max(1, f.guardHp - P.guardHoldDrain);   // turtling slowly costs guard
    // Out of guard: grab (Light), EX (Signature), super (Heavy with a full meter), or a normal attack
    if (this.tryAttack(f, b, dirName(dirX, dirY), dirX, held)) return;
    if (b & BTN.dodge && f.dodgeCd <= 0) { f.buf = null; this.startDodge(f, dirX); return; }
    if (b & BTN.jump) { f.buf = null; this.setState(f, 'squat'); f.squat = 3; f.squatFromUp = false; return; }
    if (!(held & BTN.guard)) { this.setState(f, (held & BTN.down) ? 'crouch' : 'idle'); return; }
    f.crouchGuard = !!(held & BTN.down);
  };

  S.stBlockstun = function (f, held) {
    var b = f.buf ? f.buf.bits : 0;
    // Guard Counter: Heavy during blockstun with half a bar
    if ((b & BTN.heavy) && f.meter >= f.stats.guardCounterCost) {
      f.buf = null; this.addMeter(f, -f.stats.guardCounterCost);
      this.startMove(f, 'guardCounter', D.MOVES.guardCounter);
      this.emit({ type: 'guardCounter', f: f.i, x: f.x, y: f.y });
      return;
    }
    if (--f.blockT <= 0) this.setState(f, (held & BTN.guard) && f.grounded ? 'guard' : 'idle');
  };

  S.isGuarding = function (f) { return (f.state === 'guard' || f.state === 'blockstun') && f.grounded; };

  /** A guarding dragon blocks only what comes from in front of it. */
  S.facesAttack = function (B, spec, src) {
    var fx = spec.fromX != null ? spec.fromX : src ? src.x : B.x + B.facing;
    return (fx - B.x) * B.facing >= -8;
  };

  /** Is f standing against an arena wall (or, for guards, the stage edge) on side dir? */
  S.againstWall = function (f, dir, edgeToo) {
    var ps = this.arena.platforms, hw = f.stats.hurt.w / 2;
    for (var k = 0; k < ps.length; k++) {
      var p = ps[k];
      if (!p.wall || f.y <= p.y || f.y - f.stats.hurt.h >= p.y + p.h) continue;
      if (dir > 0 && Math.abs(f.x + hw - p.x) < 8) return true;
      if (dir < 0 && Math.abs(f.x - hw - (p.x + p.w)) < 8) return true;
    }
    var pl = edgeToo && f.grounded ? ps[f.plat] : null;
    return !!(pl && ((dir > 0 && f.x > pl.x + pl.w - 16) || (dir < 0 && f.x < pl.x + 16)));
  };

  /** A hit met a guard: parry, block or guard break. Returns what happened. */
  S.block = function (src, B, spec, dir, lagSrc) {
    var raw = (spec.phys || 0) + (spec.elem || 0);
    if (B.parryOk && this.tick - B.guardPressT <= B.stats.parryWindow) {
      // Perfect parry: no damage, no guard loss; a melee attacker is left staggering
      B.parryOk = false; B.parries++;
      B.hitlag = 10; this.addMeter(B, P.meterOnParry);
      if (lagSrc && lagSrc !== B) {
        lagSrc.hitlag = 10; lagSrc.move = null; lagSrc.moveDef = null; lagSrc.moveEx = false;
        lagSrc.staggerT = P.parryStun + B.stats.parryStunBonus; this.setState(lagSrc, 'stagger');
      }
      if (B.stats.parryRefill) B.guardHp = B.stats.guardMax;
      this.emit({ type: 'parry', f: B.i, by: src ? src.i : -1, x: B.x + B.facing * 24, y: B.y - B.stats.hurt.h * 0.55 });
      return 'parry';
    }
    var drain = (P.guardDrainBase + raw * P.guardDrainPerDmg) * (spec.kind === 'super' ? 2.2 : spec.kind === 'heavy' ? 1.3 : 1);
    B.guardHp -= drain;
    var lag = Math.round(Math.min(P.hitlagMax, P.hitlagBase + raw * P.hitlagPerDamage) * P.blockLagMult);
    B.hitlag = lag;
    if (lagSrc) { lagSrc.hitlag = lag; lagSrc.hitConfirm = true; }
    if (src) this.addMeter(src, raw * P.meterOnBlock * src.stats.meterHit);
    this.addMeter(B, raw * 0.3);
    if (B.guardHp <= 0) {
      // Guard crush: the guard shatters and the dragon is dizzy for a long, punishable moment
      B.guardHp = B.stats.guardMax * 0.35; B.staggerT = P.guardBreakStun; B.vx = dir * 3;
      this.setState(B, 'stagger');
      this.emit({ type: 'guardBreak', f: B.i, by: src ? src.i : -1, x: B.x, y: B.y - B.stats.hurt.h * 0.6 });
      return 'break';
    }
    B.blockT = Math.min(P.blockstunMax, Math.round(P.blockstunBase + raw * P.blockstunPerDmg));
    this.setState(B, 'blockstun');
    // Pushback; against a wall or the stage edge it goes back onto the attacker instead
    var push = (P.blockPushBase + (spec.kb || 0) * P.blockPushPerKb) * 1.6;
    if (this.againstWall(B, dir, true)) { if (lagSrc) lagSrc.vx = -dir * push; }
    else B.vx = dir * push;
    this.emit({ type: 'block', target: B.i, by: src ? src.i : -1, x: B.x + B.facing * 18, y: B.y - B.stats.hurt.h * 0.55, dmg: raw,
      guard: B.guardHp / B.stats.guardMax, heavy: spec.kind === 'heavy' || spec.kind === 'super', element: spec.elem > 0 ? spec.element : 'phys' });
    return 'block';
  };

  // ─────────────────────────────── Throws ───────────────────────────────
  S.grabConnect = function (A, B) {
    if (B.fade > 0) { B.fade = 0; this.emit({ type: 'unfade', f: B.i, x: B.x, y: B.y }); }
    A.grab = B.i; A.move = null; A.moveDef = null;
    this.setState(A, 'throwing');
    B.grabbedBy = A.i; B.move = null; B.moveDef = null; B.buf = null; B.vx = B.vy = B.kbx = B.kby = 0;
    B.facing = -A.facing;
    this.setState(B, 'grabbed');
    this.emit({ type: 'grab', f: A.i, target: B.i, x: (A.x + B.x) / 2, y: A.y - 70 });
  };

  S.stGrabbed = function (f) {
    var A = this.fighters[f.grabbedBy];
    if (!A || A.state !== 'throwing' || A.grab !== f.i) { f.grabbedBy = -1; this.setState(f, f.grounded ? 'idle' : 'air'); return; }
    var b = f.buf ? f.buf.bits : 0;
    // Throw break: any attack, guard or dodge press early in the hold
    if (f.stateT <= P.throwBreakWindow && (b & (BTN.light | BTN.heavy | BTN.guard | BTN.dodge))) { f.buf = null; this.throwBreak(A, f); return; }
    f.x = A.x + A.facing * (A.stats.hurt.w / 2 + f.stats.hurt.w / 2 + 4); f.y = A.y;
    f.vx = f.vy = f.kbx = f.kby = 0;
  };

  S.stThrowing = function (f, dirX) {
    var B = this.fighters[f.grab];
    if (!B || B.state !== 'grabbed' || B.grabbedBy !== f.i) { f.grab = -1; f.recoilT = P.throwEndLag; this.setState(f, 'recoil'); return; }
    f.vx = 0;
    if (f.stateT < P.throwHold) return;
    // Hold back to throw behind you
    var back = dirX === -f.facing;
    if (back) f.facing = -f.facing;
    var def = D.MOVES[back ? 'bthrow' : 'fthrow'];
    f.grab = -1; B.grabbedBy = -1;
    B.x = f.x + f.facing * (f.stats.hurt.w / 2 + B.stats.hurt.w / 2 + 4);
    this.emit({ type: 'throw', f: f.i, target: B.i, back: back, x: B.x, y: B.y - 60 });
    this.applyHit(f, B, { phys: def.phys * f.stats.physMult, elem: 0, element: f.element, kb: def.kb, growth: def.growth, angle: def.angle,
      kind: 'throw', unblockable: true, aid: 'throw' + f.attackId, moveKey: back ? 'bthrow' : 'fthrow', fromX: f.x }, f.facing, f);
    f.recoilT = P.throwEndLag; this.setState(f, 'recoil');
  };

  S.throwBreak = function (A, B) {
    A.grab = -1; B.grabbedBy = -1;
    A.vx = -A.facing * P.throwBreakPush; B.vx = A.facing * P.throwBreakPush;
    A.recoilT = B.recoilT = P.throwBreakRecoil;
    this.setState(A, 'recoil'); this.setState(B, 'recoil');
    this.emit({ type: 'throwBreak', f: B.i, by: A.i, x: (A.x + B.x) / 2, y: A.y - 70 });
  };

  /** Let go of any grab f is part of (hit by a third dragon, knocked out, left the match). */
  S.releaseGrab = function (f) {
    var o;
    if (f.grab >= 0) {
      o = this.fighters[f.grab];
      if (o && o.grabbedBy === f.i) { o.grabbedBy = -1; if (o.state === 'grabbed') this.setState(o, o.grounded ? 'idle' : 'air'); }
      f.grab = -1;
    }
    if (f.grabbedBy >= 0) {
      o = this.fighters[f.grabbedBy];
      if (o && o.grab === f.i) { o.grab = -1; if (o.state === 'throwing') { o.recoilT = 10; this.setState(o, 'recoil'); } }
      f.grabbedBy = -1;
    }
  };

  // ─────────────────────────────── Knockdown and wake-up ───────────────────────────────
  S.stDown = function (f, dirX) {
    var b = f.buf ? f.buf.bits : 0;
    f.vx *= P.groundFriction;
    if (f.stateT >= P.downMin) {
      if (b & (BTN.light | BTN.heavy)) { f.buf = null; this.startMove(f, 'getupAttack', D.MOVES.getupAttack); this.emit({ type: 'getup', f: f.i, how: 'attack', x: f.x, y: f.y }); return; }
      if ((b & BTN.dodge) || dirX !== 0) { f.buf = null; this.getup(f, 'roll', dirX || -f.facing); return; }
      if (b & (BTN.jump | BTN.up | BTN.guard)) { f.buf = null; this.getup(f, 'stand', 0); return; }
    }
    if (f.stateT >= P.downMax) this.getup(f, 'stand', 0);
  };

  S.getup = function (f, how, dir) {
    f.getupHow = how; f.getupDir = dir;
    f.invuln = Math.max(f.invuln, how === 'roll' ? P.getupRollTicks - 6 : P.getupTicks);
    if (dir) f.facing = how === 'roll' ? -dir : f.facing;
    this.setState(f, 'getup');
    this.emit({ type: 'getup', f: f.i, how: how, x: f.x, y: f.y });
  };

  S.stGetup = function (f) {
    var T = f.getupHow === 'roll' ? P.getupRollTicks : P.getupTicks;
    if (f.getupHow === 'roll') f.vx = f.getupDir * P.getupRollSpeed * (1 - f.stateT / T);
    if (f.stateT >= T) { f.getupHow = null; this.setState(f, 'idle'); }
  };

  // ─────────────────────────────── Walls ───────────────────────────────
  /** f hit an arena wall on side `side` (-1: wall to its left). Splat, tech or just stop. */
  S.hitWall = function (f, side) {
    var into = side < 0 ? f.vx + f.kbx < 0 : f.vx + f.kbx > 0;
    if (f.state === 'hitstun' && Math.abs(f.kbx) >= P.wallSplatKb && into) {
      if (f.techWindow > 0) {
        // Wall tech: kick off the wall instead of splatting
        f.kbx = 0; f.kby = 0; f.vx = -side * 3; f.vy = -5; f.hitstun = 0; f.tumble = false;
        f.invuln = Math.max(f.invuln, 14); this.setState(f, 'air');
        this.emit({ type: 'tech', f: f.i, x: f.x, y: f.y, wall: true });
        return;
      }
      if (!f.splatUsed) {
        f.splatUsed = true; f.splatSide = side; f.splatT = P.wallSplatTicks;
        f.kbx = f.kby = f.vx = f.vy = 0; f.hitstun = 0; f.tumble = false;
        f.dmg = Math.min(P.maxDamage, r1(f.dmg + 2)); f.taken += 2;
        this.setState(f, 'wallsplat');
        this.emit({ type: 'wallsplat', f: f.i, x: f.x - side * f.stats.hurt.w / 2, y: f.y - f.stats.hurt.h * 0.55, side: side });
        return;
      }
      f.kbx = -f.kbx * 0.45;   // already splatted in this combo: bounce off
      return;
    }
    if (side < 0) { f.vx = Math.max(0, f.vx); f.kbx = Math.max(0, f.kbx); } else { f.vx = Math.min(0, f.vx); f.kbx = Math.min(0, f.kbx); }
  };

  S.stWallsplat = function (f) {
    f.vx = f.vy = f.kbx = f.kby = 0;
    if (--f.splatT <= 0) { f.hitstun = P.wallSplatHitstun; f.vx = -f.splatSide * 1.5; this.setState(f, 'hitstun'); }
  };

  // ─────────────────────────────── Ledges ───────────────────────────────
  S.tryLedge = function (f) {
    if (f.ledgeRegrab > 0 || f.vy < -1) return;
    if (f.state === 'attack' && f.moveT < f.moveDef.startup) return;
    var ps = this.arena.platforms;
    for (var k = 0; k < ps.length; k++) {
      var p = ps[k];
      if (!p.solid || p.altar) continue;
      for (var side = -1; side <= 1; side += 2) {
        if (p.wall && side !== (p.x + p.w / 2 < this.arena.size[0] / 2 ? -1 : 1)) continue;
        var lx = side < 0 ? p.x : p.x + p.w;
        var key = k + ':' + side;
        if (this.ledgeOwners[key] !== undefined && this.ledgeOwners[key] !== f.i) continue;
        var hx = lx + side * 22;
        if (Math.abs(f.x - hx) < 34 && f.y > p.y + 30 && f.y < p.y + 140) {
          this.grabLedge(f, k, side, lx, p.y);
          return;
        }
      }
    }
  };

  S.grabLedge = function (f, k, side, lx, ly) {
    f.ledge = { plat: k, side: side, x: lx, y: ly };
    this.ledgeOwners[k + ':' + side] = f.i;
    f.x = lx + side * 20; f.y = ly + 104; f.vx = f.vy = f.kbx = f.kby = 0;
    f.facing = -side; f.grounded = false; f.fastFall = false;
    f.move = null; f.moveDef = null;
    f.airJumps = f.stats.airJumps; f.usedRecovery = false; f.usedBlink = false; f.airDodged = false;
    if (!f.ledgeInvulnUsed) { f.invuln = Math.max(f.invuln, P.ledgeInvuln); f.ledgeInvulnUsed = true; }
    this.setState(f, 'ledge');
    this.emit({ type: 'ledge', f: f.i, x: lx, y: ly });
  };

  S.releaseLedge = function (f) {
    if (f.ledge) delete this.ledgeOwners[f.ledge.plat + ':' + f.ledge.side];
    f.ledge = null;
  };

  S.stLedge = function (f, dirX, dirY, held) {
    var L = f.ledge, b = f.buf ? f.buf.bits : 0;
    if (f.stateT < 8) return;
    var toward = dirX === -L.side, away = dirX === L.side;
    if (b & BTN.jump || (b & BTN.up)) {
      f.buf = null; this.releaseLedge(f);
      f.y = L.y - 6; f.x = L.x + L.side * 10; f.vy = -f.stats.jump; f.grounded = false;
      this.setState(f, 'air'); this.emit({ type: 'jump', air: false, f: f.i, x: f.x, y: f.y });
    } else if (b & (BTN.light | BTN.heavy)) {
      f.buf = null; this.climb(f, 'attack');
    } else if (b & BTN.dodge) {
      f.buf = null; this.climb(f, 'roll');
    } else if (toward) {
      this.climb(f, 'climb');
    } else if (away || dirY > 0) {
      this.releaseLedge(f); f.ledgeRegrab = P.ledgeRegrab; f.y -= 20; this.setState(f, 'air');
    } else if (f.stateT > P.ledgeMaxHang) {
      this.climb(f, 'climb');   // nobody wants to dangle: a dragon left hanging pulls itself up
    }
  };

  S.climb = function (f, how) {
    var L = f.ledge;
    this.releaseLedge(f);
    f.climbHow = how;
    f.climbFrom = { x: f.x, y: f.y };
    f.climbTo = { x: L.x - L.side * (how === 'roll' ? 96 : 34), y: L.y };
    f.invuln = Math.max(f.invuln, how === 'roll' ? 22 : 14);
    this.setState(f, 'ledgeclimb');
  };

  S.stLedgeClimb = function (f) {
    var T = f.climbHow === 'roll' ? 24 : 14;
    var k = Math.min(1, f.stateT / T);
    f.x = f.climbFrom.x + (f.climbTo.x - f.climbFrom.x) * k;
    f.y = f.climbFrom.y + (f.climbTo.y - f.climbFrom.y) * Math.min(1, k * 1.6);
    if (f.stateT >= T) {
      f.x = f.climbTo.x; f.y = f.climbTo.y; f.grounded = true; f.plat = this.platformAt(f.x, f.y);
      f.vx = f.vy = 0;
      if (f.climbHow === 'attack') this.startMove(f, 'ledgeAttack', D.MOVES.ledgeAttack);
      else this.setState(f, 'idle');
    }
  };

  // ─────────────────────────────── Physics ───────────────────────────────
  S.physics = function (f, dirX, held, moveMult) {
    var st = f.stats;
    var free = f.state === 'idle' || f.state === 'run' || f.state === 'air' || f.state === 'crawl';
    if (f.grounded) {
      if (free && dirX !== 0) {
        var target = dirX * st.run * moveMult * (f.state === 'crawl' ? P.crawlSpeed : 1);
        f.vx += (target - f.vx) * 0.32;
      } else if (f.state !== 'dodge' && f.state !== 'getup') f.vx *= P.groundFriction;
      if (Math.abs(f.vx) < 0.05) f.vx = 0;
    } else {
      if ((free || f.state === 'attack') && dirX !== 0 && f.state !== 'attack') {
        var ta = dirX * st.air * moveMult;
        f.vx += (ta - f.vx) * 0.12;
      } else if (f.state !== 'airdodge') f.vx *= P.airFriction;
      if (f.state !== 'airdodge' || f.stateT > 14) {
        var g = P.gravity;
        if (f.state === 'attack' && f.move === 'wingBurst' && f.moveT < f.moveDef.startup + f.moveDef.active) g *= 0.55;
        f.vy += g;
        f.jumpT++;
        // Short hop: let go of jump early and the rise is cut.
        if (f.jumpT === 5 && f.vy < 0 && !(held & (BTN.jump | (f.tapJump ? BTN.up : 0))) && free) f.vy *= P.shortHop;
        var maxF = f.fastFall && free ? P.fastFall : P.maxFall;
        if (st.glide && free && (held & BTN.jump) && f.vy > 2.2) f.vy = 2.2;
        if (f.vy > maxF) f.vy = maxF;
      }
    }
    // Launch vector decays toward zero
    var kbl = Math.sqrt(f.kbx * f.kbx + f.kby * f.kby);
    if (kbl > 0) {
      var nk = Math.max(0, kbl - P.kbDecay);
      f.kbx *= nk / kbl; f.kby *= nk / kbl;
    }
    var px = f.x, py = f.y;
    f.x += f.vx + f.kbx;
    f.y += f.vy + f.kby;
    this.collide(f, px, py);
  };

  S.collide = function (f, px, py) {
    var ps = this.arena.platforms, k, p;
    var hw = f.stats.hurt.w / 2, h = f.stats.hurt.h;
    f.wallTouch = 0;
    // Walls of solid platforms
    for (k = 0; k < ps.length; k++) {
      p = ps[k];
      if (!p.solid) continue;
      if (p.wall && f.y > p.y + 4 && f.y - h < p.y + p.h) {
        // Arena walls are swept, so even a very fast launch cannot pass through them
        if (px - hw >= p.x + p.w - 0.5 && f.x - hw < p.x + p.w) { f.x = p.x + p.w + hw; this.hitWall(f, -1); continue; }
        if (px + hw <= p.x + 0.5 && f.x + hw > p.x) { f.x = p.x - hw; this.hitWall(f, 1); continue; }
      }
      if (f.y > p.y + 4 && f.y - h < p.y + p.h && f.x + hw > p.x && f.x - hw < p.x + p.w) {
        if (py <= p.y + 4 && f.vy + f.kby >= 0) continue; // will land below
        var dl = f.x + hw - p.x, dr = p.x + p.w - (f.x - hw), db = p.y + p.h - (f.y - h);
        if (db < dl && db < dr && f.vy + f.kby < 0) { f.y = p.y + p.h + h; f.vy = Math.max(0, f.vy); f.kby = Math.abs(f.kby) * 0.4; }
        else if (dl < dr) { f.x = p.x - hw; f.vx = Math.min(0, f.vx); f.kbx = -Math.abs(f.kbx) * 0.5; }
        else { f.x = p.x + p.w + hw; f.vx = Math.max(0, f.vx); f.kbx = Math.abs(f.kbx) * 0.5; }
      }
    }
    // Ice walls block opponents
    for (k = 0; k < this.structures.length; k++) {
      var s = this.structures[k];
      if (s.team === f.team && !this.friendlyFire) continue;
      if (f.y > s.y && f.y - h < s.y + s.h && f.x + hw > s.x && f.x - hw < s.x + s.w) {
        if (px < s.x + s.w / 2) { f.x = s.x - hw; f.vx = Math.min(0, f.vx); f.kbx = Math.min(0, f.kbx); }
        else { f.x = s.x + s.w + hw; f.vx = Math.max(0, f.vx); f.kbx = Math.max(0, f.kbx); }
      }
    }
    // Touching an arena wall (for wall jumps)
    for (k = 0; k < ps.length; k++) {
      p = ps[k];
      if (!p.wall || f.y <= p.y + 4 || f.y - h >= p.y + p.h) continue;
      if (Math.abs(f.x - hw - (p.x + p.w)) < 3) f.wallTouch = -1;
      else if (Math.abs(f.x + hw - p.x) < 3) f.wallTouch = 1;
    }
    // A guard holds its footing: blocking never slides a dragon off the edge
    if (f.grounded && (f.state === 'guard' || f.state === 'blockstun') && ps[f.plat]) f.x = clamp(f.x, ps[f.plat].x + 2, ps[f.plat].x + ps[f.plat].w - 2);
    // Landing
    if (f.grounded) {
      p = ps[f.plat];
      if (!p || f.x < p.x || f.x > p.x + p.w) {
        f.grounded = false; f.plat = -1; f.jumpT = 99;
        if (f.state === 'idle' || f.state === 'run' || f.state === 'crawl' || f.state === 'crouch') this.setState(f, 'air');
        if (f.state === 'dodge') { f.dodgeInv = false; this.setState(f, 'air'); }
      } else f.y = p.y;
      return;
    }
    var vy = f.vy + f.kby;
    if (vy < 0) return;
    for (k = 0; k < ps.length; k++) {
      p = ps[k];
      if (!p.solid && (f.dropT > 0 || (f.held & BTN.down && f.state !== 'hitstun' && f.fastFall))) continue;
      if (py <= p.y + 0.5 && f.y >= p.y && f.x >= p.x - 2 && f.x <= p.x + p.w + 2) {
        this.land(f, k, p, vy);
        return;
      }
    }
  };

  S.land = function (f, k, p, vy) {
    f.y = p.y; f.plat = k; f.grounded = true; f.vy = 0; f.kby = 0; f.fastFall = false;
    f.airJumps = f.stats.airJumps; f.usedRecovery = false; f.usedBlink = false; f.airDodged = false; f.ledgeInvulnUsed = false;
    this.emit({ type: 'land', f: f.i, x: f.x, y: f.y, hard: vy > 9 });
    f.landFromAttack = false;
    if (f.state === 'hitstun') {
      if (f.tumble && vy > 4) {
        f.hitstun = 0; f.tumble = false;
        if (f.techWindow > 0) { f.invuln = Math.max(f.invuln, 20); f.landLag = 8; f.kbx = 0; this.setState(f, 'land'); this.emit({ type: 'tech', f: f.i, x: f.x, y: f.y }); }
        else {
          // Untechable landing: knocked down flat, then a wake-up choice (stand, roll or get-up attack)
          f.kbx *= 0.3; this.setState(f, 'down');
          this.emit({ type: 'knockdown', f: f.i, x: f.x, y: f.y, hard: vy > 9 });
        }
      }
      return;
    }
    if (f.state === 'attack') {
      var lag = f.moveDef.landingLag;
      if (f.moveKind === 'sig' || f.moveKind === 'ability' || f.moveKind === 'super') return;   // specials continue on landing
      f.move = null; f.moveDef = null; f.moveEx = false;
      f.landLag = lag || P.landingLag; f.landFromAttack = true; this.setState(f, 'land');
      return;
    }
    if (f.state === 'airdodge') { f.dodgeInv = false; f.landLag = 8; this.setState(f, 'land'); return; }
    if (f.state === 'air') { f.landLag = P.landingLag; this.setState(f, 'land'); }
  };

  // Opponents on the ground gently push apart so they cannot stack.
  S.separate = function () {
    var fs = this.fighters;
    for (var a = 0; a < fs.length; a++) for (var b = a + 1; b < fs.length; b++) {
      var A = fs[a], B = fs[b];
      if (!A.grounded || !B.grounded || A.plat !== B.plat || !this.isAlive(A) || !this.isAlive(B)) continue;
      if (!this.opponents(A, B)) continue;
      var dx = B.x - A.x, min = (A.stats.hurt.w + B.stats.hurt.w) * 0.5;
      if (Math.abs(dx) < min) {
        var push = (min - Math.abs(dx)) * 0.25 * (dx === 0 ? (a < b ? 1 : -1) : sign(dx));
        A.x -= push; B.x += push;
      }
    }
  };

  // ─────────────────────────────── Gear abilities ───────────────────────────────
  S.useGear = function (f) {
    var id = f.stats.gearAbility, G = D.GEAR_ABILITIES[id];
    if (!id || f.gearCd > 0) { this.emit({ type: 'sfx', id: 'denied', x: f.x, y: f.y, f: f.i }); return; }
    f.gearCd = f.stats.gearCd;
    var self = this;
    if (id === 'fade') f.fade = G.duration;
    else if (id === 'aegis') f.aegis = G.duration;
    else if (id === 'rage') f.rage = G.duration;
    else if (id === 'phase') {
      f.invuln = Math.max(f.invuln, G.duration + 2);
      f.ambush = 72; f.ambushMult = G.ambush;
      if (f.grounded) { f.dodgeDir = f.facing; f.phaseBoost = 1.7; this.setState(f, 'dodge'); }
      else { f.vx = f.facing * 12; f.vy = Math.min(f.vy, -1); f.kbx = f.kby = 0; this.setState(f, 'airdodge'); }
    } else if (id === 'decoy') {
      this.decoys.push({ id: this.nextId++, owner: f.i, team: f.team, x: f.x, y: f.y, facing: f.facing, life: G.duration, w: f.stats.hurt.w, h: f.stats.hurt.h });
    } else if (id === 'gust') {
      this.fighters.forEach(function (B) {
        if (!self.opponents(f, B) || !self.hittable(B)) return;
        var ahead = (B.x - f.x) * f.facing;
        if (ahead < -20 || ahead > G.range || Math.abs((B.y - B.stats.hurt.h / 2) - (f.y - f.stats.hurt.h / 2)) > 140) return;
        self.applyHit(f, B, { phys: 3, elem: 0, element: f.element, kb: 10.5, growth: 0, angle: 16, kind: 'gear' }, f.facing, null);
      });
      // Throw incoming projectiles back at their owners
      this.projectiles.forEach(function (p) {
        if (p.team === f.team || p.hit.harmless || p.type === 'whirlpool' || p.type === 'chillField') return;
        var ahead = (p.x - f.x) * f.facing;
        if (ahead < -20 || ahead > G.range || Math.abs(p.y - (f.y - f.stats.hurt.h / 2)) > 140) return;
        p.vx = -p.vx || f.facing * 8; p.team = f.team; p.owner = f.i; p.element = f.element; p.life = Math.max(p.life, 40);
      });
    }
    this.emit({ type: 'gear', ability: id, f: f.i, x: f.x, y: f.y, facing: f.facing });
  };

  // Decoys burst when an opponent's attack or projectile touches them, hitting opponents close by
  S.updateDecoys = function () {
    var self = this;
    this.decoys = this.decoys.filter(function (d) {
      if (--d.life <= 0) { self.emit({ type: 'decoyGone', x: d.x, y: d.y }); return false; }
      var box = { x: d.x - d.w / 2, y: d.y - d.h, w: d.w, h: d.h }, struck = false;
      self.fighters.forEach(function (A) { if (!struck && A.team !== d.team && self.activeBoxes(A).some(function (b) { return overlap(b, box); })) struck = true; });
      self.projectiles.forEach(function (p) { if (!struck && p.team !== d.team && !p.hit.harmless && overlap(self.box(p), box)) { struck = true; if (!p.pierce) p.life = 0; } });
      if (!struck) return true;
      var owner = self.fighters[d.owner];
      self.fighters.forEach(function (B) {
        if (B.team === d.team || !self.hittable(B) || Math.abs(B.x - d.x) > 140 || Math.abs(B.y - d.y) > 150) return;
        self.applyHit(owner, B, { phys: 9, elem: 0, element: owner.element, kb: 8, growth: 0.07, angle: 50, kind: 'gear' }, B.x >= d.x ? 1 : -1, null);
      });
      self.emit({ type: 'decoyPop', x: d.x, y: d.y - d.h / 2, owner: d.owner });
      return false;
    });
  };

  // ─────────────────────────────── Hit detection ───────────────────────────────
  /** World-space active hitboxes of a fighter's current move (empty when not active). */
  S.activeBoxes = function (f) {
    if (f.state !== 'attack' || !f.moveDef || !f.moveDef.boxes) return [];
    var def = f.moveDef, t = f.moveT;
    if (t < def.startup || t >= def.startup + def.active) return [];
    var melee = f.moveKind === 'light' || f.moveKind === 'heavy';
    var sx = f.stats.scale[0] * (melee ? f.stats.reach : 1), sy = f.stats.scale[1] * (melee ? f.stats.reach : 1);
    return def.boxes.map(function (b) {
      var w = b.w * sx, h = b.h * sy, x0 = b.x * sx;
      return { x: f.facing > 0 ? f.x + x0 : f.x - x0 - w, y: f.y + b.y * sy, w: w, h: h };
    });
  };

  S.detectHits = function () {
    var fs = this.fighters, self = this;
    // Melee and instant specials
    var pending = [];
    fs.forEach(function (A) {
      if (!self.isAlive(A)) return;
      var boxes = self.activeBoxes(A);
      if (!boxes.length) return;
      if (A.moveKind === 'grab') {
        // A grab takes the first grounded rival in reach. Guarding does not stop it; attacks and dodges do.
        for (var g = 0; g < fs.length; g++) {
          var G = fs[g];
          if (G === A || !self.opponents(A, G) || !self.hittable(G) || !G.grounded || G.state === 'grabbed' || G.state === 'throwing') continue;
          var gb = self.hurtbox(G);
          if (boxes.some(function (bx) { return overlap(bx, gb); })) { self.grabConnect(A, G); break; }
        }
        return;
      }
      // Melee hits on ice walls
      self.structures.forEach(function (s) {
        if (!self.opponentsTeam(A.team, s.team) || s.hitBy === A.attackId) return;
        for (var j = 0; j < boxes.length; j++) if (overlap(boxes[j], s)) {
          s.hitBy = A.attackId;
          var hd = self.hitSpec(A, A.moveDef);
          if (A.element === 'fire' && hd.elem > 0) { s.hp = 0; self.emit({ type: 'rule', rule: 'melt', x: s.x + s.w / 2, y: s.y + s.h / 2 }); }
          else s.hp -= hd.phys + hd.elem;
          break;
        }
      });
      fs.forEach(function (B) {
        if (A === B || !self.opponents(A, B) || !self.hittable(B) || A.hits[B.i]) return;
        var hb = self.hurtbox(B);
        for (var j = 0; j < boxes.length; j++) {
          if (overlap(boxes[j], hb)) { pending.push([A, B, self.meleeHit(A, B)]); A.hits[B.i] = true; break; }
        }
      });
    });
    // Applied after detection so two dragons hitting each other on the same tick both land (a trade).
    pending.forEach(function (pr) { self.applyHit(pr[0], pr[1], pr[2].spec, pr[2].dir, pr[0]); });
  };

  S.opponentsTeam = function (ta, tb) { return ta !== tb || this.friendlyFire; };

  S.hittable = function (f) {
    return this.isAlive(f) && f.invuln <= 0 && !f.dodgeInv && f.state !== 'ledgeclimb' && f.state !== 'down';
  };

  // Damage/knockback numbers for a move, with body and upgrade modifiers. Pure data, no side effects.
  S.hitSpec = function (A, def) {
    var melee = A.moveKind === 'light' || A.moveKind === 'heavy';
    var phys = def.phys || 0, kbMult = 1;
    if (melee) phys *= A.stats.physMult * (A.moveKind === 'light' ? A.stats.lightPhys : 1);
    var finalHit = def.multi && A.multiN >= def.multi.max;
    return {
      phys: phys, elem: def.elem || 0, element: A.element,
      kb: (finalHit && def.finalKb ? def.finalKb : def.kb) * kbMult, growth: (finalHit && def.finalGrowth ? def.finalGrowth : def.growth) * kbMult,
      angle: def.angle, away: def.away, status: def.status, heavy: A.moveKind === 'heavy' || A.moveKind === 'super', kind: A.moveKind,
      aid: A.attackId, moveKey: A.move === 'sig' || A.move === 'ability' ? A.move + (A.moveEx ? 'EX' : '') : A.move, fromX: A.x,
    };
  };

  S.meleeHit = function (A, B) {
    var spec = this.hitSpec(A, A.moveDef);
    var dir = spec.away ? (Math.abs(B.x - A.x) < 4 ? A.facing : sign(B.x - A.x)) : A.facing;
    return { spec: spec, dir: dir };
  };

  /** Applies one hit. src = attacking fighter (for credit). lagSrc = fighter that also freezes (melee only). */
  S.applyHit = function (src, B, spec, dir, lagSrc) {
    if (!spec.unblockable && this.isGuarding(B) && this.facesAttack(B, spec, src)) return this.block(src, B, spec, dir, lagSrc);
    if (B.aegis > 0) {
      // Aegis takes the whole hit, once
      B.aegis = 0;
      if (lagSrc) lagSrc.hitlag = 8;
      this.emit({ type: 'absorb', target: B.i, by: src ? src.i : -1, x: B.x, y: B.y - B.stats.hurt.h * 0.55 });
      // The shield bursts: whoever struck it, if close, is blasted away
      if (src && src !== B && this.opponents(B, src) && this.hittable(src) && Math.abs(src.x - B.x) < 200 && Math.abs(src.y - B.y) < 160)
        this.applyHit(B, src, { phys: 4, elem: 0, element: B.element, kb: 8, growth: 0.06, angle: 45, kind: 'gear' }, src.x >= B.x ? 1 : -1, null);
      return 'absorb';
    }
    if (B.fade > 0) { B.fade = 0; this.emit({ type: 'unfade', f: B.i, x: B.x, y: B.y }); }
    this.releaseGrab(B);
    var rage = D.GEAR_ABILITIES.rage.mult, rageTaken = D.GEAR_ABILITIES.rage.takenMult;
    if (src && src.rage > 0) spec = Object.assign({}, spec, { phys: spec.phys * rage, elem: spec.elem * rage });
    if (src && src.ambush > 0 && spec.kind !== 'gear') { spec = Object.assign({}, spec, { phys: spec.phys * src.ambushMult, elem: spec.elem * src.ambushMult }); src.ambush = 0; }
    if (src && src.stats.airDamage > 1 && !src.grounded && spec.kind !== 'gear') spec = Object.assign({}, spec, { phys: spec.phys * src.stats.airDamage, elem: spec.elem * src.stats.airDamage });
    // Counter hit: struck during an attack's startup. Punish: struck while recovering from a whiffed action.
    var counter = B.state === 'attack' && B.moveDef && B.moveT < B.moveDef.startup;
    var punish = !counter && ((B.state === 'attack' && B.moveDef && B.moveT >= B.moveDef.startup + B.moveDef.active) ||
      (B.state === 'land' && B.landFromAttack) || (B.state === 'dodge' && B.stateT > P.dodgeInvulnEnd) || B.state === 'recoil' || B.state === 'stagger');
    // Combo bookkeeping: each new attack is one step; multi-hit moves stay on their step
    var CB = D.COMBO, C = B.combo || (B.combo = { n: 0, dmg: 0, by: src ? src.i : -1, ids: {}, moves: {} });
    var aid = spec.aid != null ? spec.aid : 't' + this.tick;
    if (!C.ids[aid]) { C.ids[aid] = true; C.n++; if (spec.moveKey) C.moves[spec.moveKey] = (C.moves[spec.moveKey] || 0) + 1; }
    var step = C.n - 1, sStep = Math.max(0, step - (src ? src.stats.scaleOffset : 0)), scale = CB.scaling[Math.min(sStep, CB.scaling.length - 1)];
    var stale = spec.moveKey && C.moves[spec.moveKey] > CB.staleAfter;
    var mult = D.elementMultiplier(spec.element, B.element, this.elementConfig);
    var elem = spec.elem * mult;
    var conduct = false;
    if (spec.element === 'lightning' && spec.elem > 0 && B.status.soaked > 0) {
      elem += 2; conduct = true; B.status.soaked = 0;   // arcs once, then the target is dry
      this.emit({ type: 'rule', rule: 'conduct', x: B.x, y: B.y - 70 });
    }
    var venge = src && src.stats.rageDamage ? 1 + src.stats.rageDamage * Math.min(1, src.dmg / 120) : 1;   // Vengeance instinct
    var dmg = r1((spec.phys + elem) * scale * venge * (counter ? CB.counterDamage : 1));
    B.dmg = Math.min(P.maxDamage, r1(B.dmg + dmg));
    B.taken += dmg; C.dmg += dmg;
    if (src && src !== B && src.stats.cdRefund && spec.kind !== 'gear') { src.sigCd = Math.max(0, src.sigCd - src.stats.cdRefund); src.abilityCd = Math.max(0, src.abilityCd - src.stats.cdRefund); }
    if (src) { src.dealt += dmg; if (src !== B) this.addMeter(src, dmg * P.meterOnHit * src.stats.meterHit); }
    this.addMeter(B, dmg * P.meterOnTaken * B.stats.meterTaken);
    if (lagSrc) lagSrc.hitConfirm = true;
    if (src) { B.lastHitBy = src.i; B.lastHitTick = this.tick; }
    var lag = Math.min(P.hitlagMax, Math.round(P.hitlagBase + dmg * P.hitlagPerDamage)) + (counter ? CB.counterHitlag : 0);

    // Super armour (EX specials): the damage lands, the dragon keeps going
    if (B.armor > 0 && B.state === 'attack' && spec.kind !== 'throw' && spec.kind !== 'super') {
      B.hitlag = Math.round(lag * 0.6); if (lagSrc) lagSrc.hitlag = B.hitlag;
      this.emit({ type: 'armor', target: B.i, by: src ? src.i : -1, x: B.x, y: B.y - B.stats.hurt.h * 0.55, dmg: dmg });
      return 'armor';
    }
    // Anti-infinite: a combo that reaches the step limit bursts the victim free
    if (step >= CB.maxSteps) {
      B.move = null; B.moveDef = null; B.hitstun = 0; B.tumble = false; B.invuln = Math.max(B.invuln, CB.burstInvuln);
      B.kbx = dir * 5; B.kby = -4; B.vx = B.vy = 0; B.grounded = false; B.plat = -1;
      this.setState(B, 'air');
      this.emit({ type: 'burst', f: B.i, by: src ? src.i : -1, x: B.x, y: B.y - B.stats.hurt.h * 0.55, n: C.n });
      this.endCombo(B);
      return 'burst';
    }

    // Knockback: grows with the target's damage, shrinks with weight. Elements never touch this.
    var kb = (spec.kb + spec.growth * B.dmg) * (200 / (B.stats.weight + 100)) * B.stats.kbTaken;
    if (B.buffs.stoneSkin > 0) kb *= D.ABILITIES.stoneSkin.buff.kbMult;
    if (B.rage > 0) kb *= rageTaken;
    if (B.stats.lastStand < 1 && B.dmg >= 100) kb *= B.stats.lastStand;
    if (src && src.stats.finisherKb > 1 && step >= 2) kb *= src.stats.finisherKb;
    var ang = spec.angle;
    if (B.grounded && ang < 0) ang = 24;  // a spike on the ground pops the target up instead
    // Directional influence
    var hx = ((B.held & BTN.right) ? 1 : 0) - ((B.held & BTN.left) ? 1 : 0);
    var hy = ((B.held & BTN.down) ? 1 : 0) - ((B.held & BTN.up) ? 1 : 0);
    if ((hx || hy) && kb > 6) {
      var lx = Math.cos(ang * DEG) * dir, ly = -Math.sin(ang * DEG);
      var il = Math.sqrt(hx * hx + hy * hy);
      var cross = lx * (hy / il) - ly * (hx / il);
      ang += -cross * P.diDegrees * dir;
    }
    B.kbx = Math.cos(ang * DEG) * kb * dir;
    B.kby = -Math.sin(ang * DEG) * kb;
    B.vx = 0; B.vy = 0;
    if (B.kby < -1 || kb > 9) { B.grounded = false; B.plat = -1; }
    var hs = Math.min(P.hitstunMax, Math.round(kb * P.hitstunPerKb));
    if (spec.element === 'lightning' && B.buffs.stoneSkin > 0) {
      hs = Math.round(hs * 0.5);
      this.emit({ type: 'rule', rule: 'grounded', x: B.x, y: B.y - 70 });
    }
    // Hitstun decays through long combos, and faster for a move used over and over (no loops)
    hs *= Math.max(CB.hitstunMin, 1 - CB.hitstunDecay * Math.max(0, step - 1));
    if (stale) hs *= CB.staleHitstun;
    if (counter) hs *= CB.counterHitstun;
    B.hitstun = Math.max(4, Math.round(hs));
    B.tumble = kb >= P.tumbleKb;
    // In the corner the attacker takes the pushback the wall stops the victim from taking
    if (lagSrc && B.grounded && this.againstWall(B, dir)) lagSrc.vx = -dir * (2 + kb * 0.4);
    if (B.state === 'ledge') this.releaseLedge(B);
    B.move = null; B.moveDef = null; B.dodgeInv = false; B.moveEx = false; B.armor = 0;
    B.usedRecovery = false; B.airDodged = false; B.usedBlink = false; B.fastFall = false; B.ledgeInvulnUsed = false;
    this.setState(B, 'hitstun');
    B.hitlag = lag;
    if (lagSrc) lagSrc.hitlag = lag;
    B.hitKind = counter ? 'counter' : punish ? 'punish' : '';
    // Status effects: short, never stacked, never on a target that is already affected.
    if (spec.status === 'chill' && B.status.chill <= 0) B.status.chill = D.STATUS.chill.ticks;
    if (spec.status === 'burn' && B.status.burn <= 0) {
      if (B.status.soaked > 0) this.emit({ type: 'rule', rule: 'extinguish', x: B.x, y: B.y - 70 });
      else { B.status.burn = D.STATUS.burn.ticks; B.status.burnNext = D.STATUS.burn.every; }
    }
    if (spec.status === 'soaked') { B.status.soaked = D.STATUS.soaked.ticks; B.status.burn = 0; }
    this.emit({ type: 'hit', target: B.i, by: src ? src.i : -1, x: B.x, y: B.y - B.stats.hurt.h * 0.55, dmg: dmg,
      kb: r1(kb), angle: ang, dir: dir, element: spec.elem > 0 ? spec.element : 'phys', heavy: !!spec.heavy, kind: spec.kind,
      mult: mult, conduct: conduct, lag: lag, counter: counter, punish: punish, combo: C.n, comboDmg: r1(C.dmg), scale: scale,
      strength: spec.kind === 'super' ? 'super' : spec.kind === 'throw' ? 'heavy' : dmg >= 11 ? 'heavy' : dmg >= 6 ? 'medium' : 'light' });
    return 'hit';
  };

  // ─────────────────────────────── Projectiles & structures ───────────────────────────────
  S.updateStructures = function () {
    var self = this;
    this.structures = this.structures.filter(function (s) {
      s.life--;
      if (s.life <= 0 || s.hp <= 0) { self.emit({ type: 'break', kind: s.type, x: s.x + s.w / 2, y: s.y + s.h / 2, element: s.element }); return false; }
      return true;
    });
  };

  S.updateProjectiles = function () {
    var self = this, ps = this.projectiles, fs = this.fighters, i, j;
    for (i = 0; i < ps.length; i++) {
      var p = ps[i];
      p.age++; p.life--;
      if (p.delay > 0) { p.delay--; continue; }
      p.vy += p.gravity;
      p.x += p.vx; p.y += p.vy;
      if (p.ground) {
        var pl = this.arena.platforms[p.plat];
        if (!pl || p.x < pl.x || p.x > pl.x + pl.w) p.life = 0;
      } else {
        // Missiles stop on solid ground
        for (j = 0; j < this.arena.platforms.length; j++) {
          var q = this.arena.platforms[j];
          if (q.solid && p.x > q.x && p.x < q.x + q.w && p.y > q.y && p.y < q.y + q.h) { p.life = 0; this.emit({ type: 'pop', kind: p.type, x: p.x, y: q.y, element: p.element }); }
        }
      }
      if (p.type === 'whirlpool') {
        fs.forEach(function (f) {
          if (!self.opponents(fs[p.owner], f) || !self.hittable(f)) return;
          if (overlap(self.box(p), self.hurtbox(f))) { f.x += clamp(p.x - f.x, -p.hit.pull, p.hit.pull); }
        });
      }
    }
    // Projectiles vs structures
    for (i = 0; i < ps.length; i++) {
      var a = ps[i];
      if (a.life <= 0 || a.delay > 0 || a.hit.harmless) continue;
      for (j = 0; j < this.structures.length; j++) {
        var s = this.structures[j];
        if (!this.opponentsTeam(a.team, s.team) || !overlap(this.box(a), s)) continue;
        if (a.element === 'fire') { s.hp = 0; a.life = 0; this.emit({ type: 'rule', rule: 'melt', x: s.x + s.w / 2, y: s.y + s.h / 2 }); }
        else if (!HAZARD_TYPES[a.type]) { s.hp -= (a.hit.phys || 0) + (a.hit.elem || 0); a.life = 0; this.emit({ type: 'pop', kind: a.type, x: a.x, y: a.y, element: a.element }); }
      }
    }
    // Projectile vs projectile
    for (i = 0; i < ps.length; i++) for (j = i + 1; j < ps.length; j++) {
      var A = ps[i], B = ps[j];
      if (A.life <= 0 || B.life <= 0 || A.delay > 0 || B.delay > 0 || !this.opponentsTeam(A.team, B.team)) continue;
      if (!overlap(this.box(A), this.box(B))) continue;
      var r = resolveClash(A, B);
      if (!r.kill) continue;
      if (r.kill === 'a' || r.kill === 'both') A.life = 0;
      if (r.kill === 'b' || r.kill === 'both') B.life = 0;
      this.emit({ type: 'rule', rule: r.rule, x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 });
    }
    // Projectile vs fighters
    for (i = 0; i < ps.length; i++) {
      var pr = ps[i];
      if (pr.life <= 0 || pr.delay > 0) continue;
      var owner = fs[pr.owner];
      for (j = 0; j < fs.length; j++) {
        var f = fs[j];
        if (f.team === pr.team && !this.friendlyFire) continue;
        if (f.i === pr.owner) continue;
        if (!this.hittable(f)) continue;
        if (!overlap(this.box(pr), this.hurtbox(f))) continue;
        if (pr.hit.harmless) {
          if (pr.hit.status === 'soaked') { if (f.status.soaked <= 0 && f.status.burn > 0) this.emit({ type: 'rule', rule: 'extinguish', x: f.x, y: f.y - 70 }); f.status.soaked = D.STATUS.soaked.ticks; f.status.burn = 0; }
          continue;
        }
        var last = pr.hits[f.i];
        if (last !== undefined && (!pr.rehit || this.tick - last < pr.rehit)) continue;
        pr.hits[f.i] = this.tick;
        var spec = { phys: pr.hit.phys || 0, elem: pr.hit.elem || 0, element: pr.element, kb: pr.hit.kb, growth: pr.hit.growth,
          angle: pr.hit.angle, status: pr.hit.status, heavy: false, kind: 'proj', aid: pr.attackId, moveKey: 'proj:' + pr.type, fromX: pr.x - (pr.vx || 0) };
        var dir = pr.vx !== 0 ? sign(pr.vx) : sign(f.x - pr.x);
        this.applyHit(owner, f, spec, dir, null);
        if (!pr.pierce) { pr.life = 0; break; }
      }
    }
    this.projectiles = ps.filter(function (p) {
      if (p.life > 0) return true;
      self.emit({ type: 'fade', kind: p.type, x: p.x, y: p.y, element: p.element });
      return false;
    });
  };

  S.box = function (p) {
    if (p.ground) return { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h };
    return { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
  };

  // ─────────────────────────────── KOs and the end ───────────────────────────────
  S.checkBlast = function (f) {
    if (!this.isAlive(f)) return;
    var bz = this.arena.blast;
    if (f.x > bz.left && f.x < bz.right && f.y < bz.bottom && f.y > bz.top) return;
    var by = (f.lastHitBy >= 0 && this.tick - f.lastHitTick < 360) ? f.lastHitBy : -1;
    if (by >= 0 && by !== f.i) this.fighters[by].kos++;
    f.falls++;
    this.releaseLedge(f);
    this.releaseGrab(f);
    this.endCombo(f);
    if (!(this.training && this.training.infinite)) f.stocks--;
    this.emit({ type: 'ko', f: f.i, by: by, x: clamp(f.x, bz.left, bz.right), y: clamp(f.y, bz.top, bz.bottom), stocks: f.stocks });
    f.move = null; f.moveDef = null; f.status = { chill: 0, burn: 0, burnNext: 0, soaked: 0 }; f.buffs.stoneSkin = 0; f.fade = f.aegis = f.rage = f.ambush = 0;
    if (f.stocks > 0) { f.state = 'dead'; f.respawnT = P.respawnTicks; }
    else { f.state = 'out'; f.x = -9999; }
  };

  S.respawn = function (f) {
    this.placeAtSpawn(f, f.i);
    var main = this.arena.platforms[0];
    f.x = clamp(main.x + main.w / 2 + (f.i % 2 ? 60 : -60) * (1 + (f.i >> 1)), main.x + 40, main.x + main.w - 40);
    f.y = main.y; f.plat = 0; f.grounded = true;
    f.dmg = this.training && this.training.keepDamage ? f.dmg : 0;
    f.invuln = P.respawnInvuln;
    f.lastHitBy = -1;
    this.emit({ type: 'respawn', f: f.i, x: f.x, y: f.y });
  };

  /** A player left: their dragon is removed from the match. */
  S.forfeit = function (i) {
    var f = this.fighters[i];
    if (!f || f.state === 'out') return;
    f.stocks = 0; f.state = 'out'; f.x = -9999; f.forfeit = true;
    this.releaseLedge(f);
    this.releaseGrab(f);
    this.emit({ type: 'forfeit', f: i });
    this.checkEnd();
  };

  S.teamsAlive = function () {
    var alive = {};
    this.fighters.forEach(function (f) { if (f.state !== 'out') alive[f.team] = true; });
    return Object.keys(alive).map(Number);
  };

  S.checkEnd = function () {
    if (this.result || (this.training && this.training.infinite)) return;
    var alive = this.teamsAlive();
    if (alive.length <= 1) return this.finish(alive.length ? alive[0] : -1, 'stocks');
    if (this.timeLimit && this.tick >= this.timeLimit) {
      // Most stocks, then least damage taken, wins.
      var score = {};
      this.fighters.forEach(function (f) {
        var s = score[f.team] || (score[f.team] = { stocks: 0, dmg: 0 });
        s.stocks += Math.max(0, f.stocks); if (f.state !== 'out') s.dmg += f.dmg;
      });
      var best = alive.sort(function (a, b) { return score[b].stocks - score[a].stocks || score[a].dmg - score[b].dmg || a - b; })[0];
      this.finish(best, 'time');
    }
  };

  S.finish = function (team, reason) {
    this.result = {
      winnerTeam: team, reason: reason, ticks: this.tick,
      fighters: this.fighters.map(function (f) {
        return { i: f.i, id: f.id, name: f.name, team: f.team, stocks: Math.max(0, f.stocks), dmg: f.dmg, kos: f.kos, falls: f.falls, dealt: r1(f.dealt), taken: r1(f.taken), forfeit: !!f.forfeit };
      }),
    };
    this.emit({ type: 'end', winnerTeam: team, reason: reason });
  };

  // ─────────────────────────────── Training helpers ───────────────────────────────
  S.setDamage = function (i, v) { var f = this.fighters[i]; if (f) f.dmg = clamp(v, 0, P.maxDamage); };
  S.resetPositions = function () {
    var self = this;
    this.projectiles = []; this.structures = []; this.ledgeOwners = {}; this.decoys = []; this.freeze = 0;
    this.fighters.forEach(function (f, i) {
      self.placeAtSpawn(f, i); f.dmg = 0; f.hitlag = 0; f.invuln = 0;
      f.status = { chill: 0, burn: 0, burnNext: 0, soaked: 0 }; f.buffs.stoneSkin = 0; f.sigCd = f.abilityCd = f.dodgeCd = f.gearCd = 0; f.fade = f.aegis = f.rage = f.ambush = 0;
      f.meter = 0; f.move = null; f.moveDef = null;
    });
  };

  // ─────────────────────────────── Snapshot ───────────────────────────────
  /** Everything a renderer needs, small enough to send 30 times a second. */
  S.snapshot = function () {
    var self = this;
    return {
      t: this.tick,
      tl: this.timeLimit ? Math.max(0, this.timeLimit - this.tick) : 0,
      fz: this.freeze, fzb: this.freezeBy,
      f: this.fighters.map(function (f) {
        return {
          x: r1(f.x), y: r1(f.y), vx: r1(f.vx + f.kbx), vy: r1(f.vy + f.kby), fc: f.facing, st: f.state, stT: f.stateT,
          mv: f.move, mT: f.moveT, d: f.dmg, s: f.stocks, hl: f.hitlag, inv: f.invuln > 0 || !!f.dodgeInv, tb: f.tumble, gr: f.grounded,
          ch: f.status.chill > 0 ? 1 : 0, bu: f.status.burn > 0 ? 1 : 0, so: f.status.soaked > 0 ? 1 : 0, sk: f.buffs.stoneSkin > 0 ? 1 : 0, gc: f.gearCd, fd: f.fade > 0 ? 1 : 0, ag: f.aegis > 0 ? 1 : 0, rg: f.rage > 0 ? 1 : 0,
          sc: f.sigCd, ac: f.abilityCd, dc: f.dodgeCd, aj: f.airJumps, ls: f.ledge ? f.ledge.side : 0,
          gh: Math.round(f.guardHp), gm: Math.round(f.stats.guardMax), mt: Math.floor(f.meter), cb: f.combo ? f.combo.n : 0, cdm: f.combo ? r1(f.combo.dmg) : 0,
          hk: f.state === 'hitstun' ? f.hitKind : '', ex: f.moveEx ? 1 : 0, cg: f.crouchGuard ? 1 : 0, gu: f.getupHow, ws: f.splatSide, ar: f.armor > 0 ? 1 : 0,
        };
      }),
      p: this.projectiles.map(function (p) {
        return { id: p.id, ty: p.type, x: r1(p.x), y: r1(p.y), vx: r1(p.vx), vy: r1(p.vy), w: p.w, h: p.h, el: p.element, o: p.owner, a: p.age, l: p.life, dl: p.delay, g: p.ground ? 1 : 0 };
      }),
      d: this.decoys.map(function (d) { return { id: d.id, o: d.owner, x: d.x, y: d.y, fc: d.facing, l: d.life }; }),
      s: this.structures.map(function (s) { return { id: s.id, ty: s.type, x: s.x, y: s.y, w: s.w, h: s.h, l: s.life, el: s.element, hp: s.hp }; }),
      end: this.result,
    };
  };

  /** Static setup a client needs once per match (names, builds, teams, arena). */
  S.setup = function () {
    return {
      arena: this.arena.id, stocks: this.stocks, timeLimit: this.timeLimit,
      fighters: this.fighters.map(function (f) { return { id: f.id, name: f.name, team: f.team, build: f.build }; }),
    };
  };

  return Sim;
});
