/*!
 * Dragon Clash — rules data.
 *
 * Every number that decides a fight lives here: elements and the counter cycle, frame data for every move,
 * the 100-point build catalog, arenas and match formats. The simulation, the Dragon Forge, the in-game
 * manual and the automated tests all read these tables, so they can never disagree.
 *
 * Loaded as a classic <script> (window.DC.Data) and by Node (require) for the server and tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.DC = root.DC || {}; root.DC.Data = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TICK_RATE = 60;

  // ─────────────────────────────── Elements ───────────────────────────────
  var ELEMENTS = {
    fire:      { id: 'fire',      name: 'Fire',      icon: 'fire', color: '#ff6a2a', glow: '#ffcf4a', dark: '#7a1c08' },
    ice:       { id: 'ice',       name: 'Ice',       icon: 'ice', color: '#7fe0ff', glow: '#e8fbff', dark: '#1d4f7a' },
    lightning: { id: 'lightning', name: 'Lightning', icon: 'lightning', color: '#ffe14a', glow: '#b48cff', dark: '#3d2a7a' },
    earth:     { id: 'earth',     name: 'Earth',     icon: 'earth', color: '#c58b4c', glow: '#ffd59a', dark: '#4a3320' },
    water:     { id: 'water',     name: 'Water',     icon: 'water', color: '#2fd3c8', glow: '#a8fff4', dark: '#0d4a6a' },
  };
  var ELEMENT_ORDER = ['fire', 'ice', 'earth', 'lightning', 'water'];
  // Two interlocking cycles, so every pairing has a winner (only a mirror is even):
  //   main cycle (strong):  Fire → Ice → Earth → Lightning → Water → Fire
  //   star cycle (edge):    Fire → Earth → Water → Ice → Lightning → Fire
  // Each element strongly beats one, edges out another, is strongly beaten by one and edged by another.
  var BEATS = { fire: 'ice', ice: 'earth', earth: 'lightning', lightning: 'water', water: 'fire' };
  var BEATS_EDGE = { fire: 'earth', earth: 'water', water: 'ice', ice: 'lightning', lightning: 'fire' };

  // Tunable. Applied ONLY to the elemental portion of a hit's damage. Never to knockback, hitstun, speed or recovery.
  var ELEMENT_CONFIG = { counterBonus: 0.10, counterPenalty: 0.10, edgeBonus: 0.05, edgePenalty: 0.05 };

  function elementMultiplier(attacker, defender, config) {
    var c = config || ELEMENT_CONFIG;
    if (!attacker || !defender || attacker === defender) return 1;
    if (BEATS[attacker] === defender) return 1 + c.counterBonus;
    if (BEATS[defender] === attacker) return 1 - c.counterPenalty;
    if (BEATS_EDGE[attacker] === defender) return 1 + (c.edgeBonus || 0);
    if (BEATS_EDGE[defender] === attacker) return 1 - (c.edgePenalty || 0);
    return 1;
  }

  /** 'advantage' | 'disadvantage' | 'neutral' (for UI badges; neutral is only a mirror). */
  function matchup(a, b) {
    if (BEATS[a] === b || BEATS_EDGE[a] === b) return 'advantage';
    if (BEATS[b] === a || BEATS_EDGE[b] === a) return 'disadvantage';
    return 'neutral';
  }

  /** 'strong' for the main cycle, 'edge' for the star cycle, '' for a mirror. */
  function matchupTier(a, b) {
    if (BEATS[a] === b || BEATS[b] === a) return 'strong';
    if (BEATS_EDGE[a] === b || BEATS_EDGE[b] === a) return 'edge';
    return '';
  }

  /**
   * Explicit elemental interaction rules. The simulation looks these up by id; nothing else in the code
   * special-cases one element against another. Each rule is small, visible and avoidable.
   */
  var INTERACTIONS = {
    melt:       { id: 'melt',       text: 'Fire melts ice barriers; a fire shot and an ice shard melt each other.',                  icons: ['fire', 'ice'] },
    extinguish: { id: 'extinguish', text: 'Water puts out fire projectiles, flames and burns.',       icons: ['water', 'fire'] },
    grounded:   { id: 'grounded',   text: 'Stone Skin grounds lightning: its hitstun is halved.',     icons: ['earth', 'lightning'] },
    conduct:    { id: 'conduct',    text: 'Lightning arcs once through soaked targets (+2%).',         icons: ['lightning', 'water'] },
    clash:      { id: 'clash',      text: 'Other opposing projectiles cancel each other out.',        icons: ['clash'] },
  };

  // Status effects: short, capped, never stack, always shown on the dragon.
  var STATUS = {
    chill:  { id: 'chill',  ticks: 45,  moveMult: 0.8, text: 'Chilled: 20% slower for 0.75 s' },
    burn:   { id: 'burn',   ticks: 90,  every: 30, damage: 1, text: 'Burning: 1% every 0.5 s for 1.5 s' },
    soaked: { id: 'soaked', ticks: 150, text: 'Soaked: conducts lightning, immune to burning' },
  };

  // ─────────────────────────────── Physics ───────────────────────────────
  var PHYSICS = {
    gravity: 0.62, maxFall: 11.5, fastFall: 16, groundFriction: 0.72, airFriction: 0.985,
    shortHop: 0.62,              // a released jump within 5 ticks cuts upward speed by this factor
    kbDecay: 0.52,               // launch speed lost per tick
    hitstunPerKb: 1.85, hitstunMax: 72,
    tumbleKb: 17,                // launches at or above this spin the dragon
    hitlagBase: 3, hitlagPerDamage: 0.45, hitlagMax: 13,
    diDegrees: 14,               // directional influence: hold away/sideways while hit
    respawnTicks: 70, respawnInvuln: 120,
    ledgeInvuln: 36, ledgeRegrab: 34, ledgeMaxHang: 60,
    landingLag: 4, inputBuffer: 6,
    dodgeInvulnStart: 3, dodgeInvulnEnd: 18, dodgeTicks: 26, airDodgeTicks: 30, airDodgeSpeed: 8.5,
    dashSpeed: 9.5,
    maxDamage: 999,
    // Guard (hold Guard on the ground). A guard bar drains when hits are blocked and refills when you let go.
    guardMax: 60, guardRegen: 0.3, guardHoldDrain: 0.06, guardDrainBase: 2, guardDrainPerDmg: 1.5,
    blockstunBase: 4, blockstunPerDmg: 1.0, blockstunMax: 22, blockLagMult: 0.6, blockPushBase: 2.5, blockPushPerKb: 0.35,
    guardBreakStun: 100,         // dizzy ticks after the guard bar breaks
    parryWindow: 5,              // ticks after pressing Guard in which a hit is parried
    parryLockout: 24,            // pressing Guard again sooner than this gives no parry window (no mashing)
    parryStun: 22,               // the parried attacker staggers this long
    // Throws (Guard + Light on the ground)
    throwHold: 18, throwBreakWindow: 12, throwBreakPush: 5.5, throwBreakRecoil: 14, throwEndLag: 12,
    // Cancels: a move that hit or was blocked can cancel into a stronger one until this many ticks after its active frames
    cancelLate: 6,
    // Knockdown after an untechable tumble landing, then a choice of get-up
    downMin: 14, downMax: 50, getupTicks: 20, getupRollTicks: 28, getupRollSpeed: 6.5,
    // Walls (arenas with wall pillars)
    wallSplatKb: 6.5, wallSplatTicks: 30, wallSplatHitstun: 16, wallJumpSpeed: 7.5,
    // Super meter: 3 bars. EX specials cost one bar, the Dragon Fury super all three.
    meterMax: 300, meterBar: 100, meterOnHit: 1.2, meterOnTaken: 0.8, meterOnBlock: 0.5, meterOnParry: 25, meterTaunt: 12,
    tauntTicks: 50,
    crawlSpeed: 0.38,            // crawling (Down + direction) moves at this fraction of running speed
  };

  // Combo scaling and anti-infinite rules. A combo is every hit a dragon takes before it can act again; multi-hit
  // moves count as one step. Damage is scaled by step; from step 3 each hit also gives less hitstun, a move reused
  // in the same combo gives even less, and at maxSteps the victim bursts free (brief invulnerability).
  var COMBO = {
    scaling: [1, 1, 0.9, 0.8, 0.7, 0.62, 0.55, 0.5, 0.45, 0.4],
    hitstunDecay: 0.07, hitstunMin: 0.45, staleHitstun: 0.7, staleAfter: 2,
    maxSteps: 12, burstInvuln: 40,
    counterDamage: 1.1, counterHitstun: 1.25, counterHitlag: 4,
  };

  // When several buttons arrive on the same tick, the first one in this list wins. Guard + button combinations come
  // first because they are deliberate two-button commands; Light beats Heavy so a sloppy double press is the safe move.
  var INPUT_PRIORITY = ['gear', 'super', 'ex', 'grab', 'sig', 'light', 'heavy', 'dodge', 'jump', 'taunt'];

  // Which kinds of move may cancel into which, on hit or block. A move never cancels into itself.
  var CANCELS = { light: ['super', 'ex', 'sig', 'heavy'], heavy: ['super', 'ex', 'sig'], sig: ['super'], ability: ['super'] };

  // ─────────────────────────────── Moves ───────────────────────────────
  // Boxes are relative to the dragon's feet, x forward (mirrored by facing), y up negative.
  // phys = physical damage (never element-modified), elem = elemental damage (counter-modified).
  // angle in degrees, 0 = forward, 90 = up, negative = down (a spike). 'away' launches away from the attacker's centre.
  var MOVES = {
    jab:     { name: 'Claw Jab', kind: 'light', startup: 4, active: 3, recovery: 10, phys: 4, elem: 0,
               kb: 3.4, growth: 0.055, angle: 38, boxes: [{ x: 18, y: -88, w: 56, h: 32 }], lunge: 1.6, anim: 'claw' },
    utilt:   { name: 'Horn Flick', kind: 'light', startup: 5, active: 5, recovery: 12, phys: 5, elem: 0,
               kb: 3.8, growth: 0.07, angle: 86, boxes: [{ x: -14, y: -168, w: 66, h: 56 }], anim: 'up', jumpCancel: true },
    dtilt:   { name: 'Tail Sweep', kind: 'light', startup: 6, active: 4, recovery: 14, phys: 5, elem: 0,
               kb: 3.6, growth: 0.06, angle: 18, boxes: [{ x: 8, y: -30, w: 82, h: 28 }], anim: 'tail' },
    fsmash:  { name: 'Rending Claw', kind: 'heavy', startup: 16, active: 4, recovery: 27, phys: 12, elem: 2,
               kb: 6.6, growth: 0.145, angle: 38, boxes: [{ x: 24, y: -100, w: 66, h: 60 }], lunge: 4.5, anim: 'claw' },
    usmash:  { name: 'Horn Uppercut', kind: 'heavy', startup: 14, active: 5, recovery: 25, phys: 11, elem: 2,
               kb: 6.4, growth: 0.14, angle: 86, boxes: [{ x: -24, y: -184, w: 84, h: 74 }], anim: 'up' },
    dsmash:  { name: 'Tail Cyclone', kind: 'heavy', startup: 13, active: 6, recovery: 27, phys: 10, elem: 2,
               kb: 6, growth: 0.13, angle: 24, away: true, boxes: [{ x: -92, y: -42, w: 184, h: 38 }], anim: 'spin' },
    nair:    { name: 'Wing Spin', kind: 'light', startup: 5, active: 10, recovery: 10, phys: 6, elem: 0,
               kb: 3.8, growth: 0.07, angle: 45, away: true, boxes: [{ x: -54, y: -118, w: 108, h: 96 }], anim: 'spin', landingLag: 6 },
    fair:    { name: 'Sky Claw', kind: 'light', startup: 6, active: 4, recovery: 12, phys: 7, elem: 0,
               kb: 4, growth: 0.09, angle: 40, boxes: [{ x: 18, y: -108, w: 64, h: 56 }], anim: 'claw', landingLag: 7 },
    uair:    { name: 'Horn Spire', kind: 'light', startup: 5, active: 5, recovery: 11, phys: 6, elem: 0,
               kb: 4, growth: 0.08, angle: 84, boxes: [{ x: -30, y: -182, w: 64, h: 56 }], anim: 'up', landingLag: 6 },
    dair:    { name: 'Talon Spike', kind: 'light', startup: 9, active: 4, recovery: 16, phys: 8, elem: 0,
               kb: 3.4, growth: 0.085, angle: -72, boxes: [{ x: -26, y: -34, w: 52, h: 44 }], anim: 'stomp', landingLag: 12 },
    fheavyAir: { name: 'Diving Rake', kind: 'heavy', startup: 12, active: 6, recovery: 20, phys: 10, elem: 2,
               kb: 5.6, growth: 0.12, angle: 34, boxes: [{ x: 20, y: -110, w: 72, h: 64 }], selfVel: [5, -2], anim: 'claw', landingLag: 14 },
    // Recovery: rises, once per airtime. Weak hit so it is a recovery first.
    wingBurst: { name: 'Wing Burst', kind: 'heavy', startup: 5, active: 10, recovery: 20, phys: 5, elem: 0,
               kb: 4, growth: 0.05, angle: 80, away: true, boxes: [{ x: -46, y: -150, w: 92, h: 120 }], selfVel: [0, -15.5], recovery_move: true, anim: 'burst', landingLag: 10 },
    meteor:  { name: 'Meteor Dive', kind: 'heavy', startup: 10, active: 16, recovery: 18, phys: 10, elem: 0,
               kb: 4.6, growth: 0.1, angle: -78, boxes: [{ x: -30, y: -40, w: 60, h: 50 }], selfVel: [0, 13], anim: 'stomp', landingLag: 16 },
    ledgeAttack: { name: 'Ledge Swipe', kind: 'light', startup: 10, active: 4, recovery: 16, phys: 6, elem: 0,
               kb: 4.5, growth: 0.04, angle: 30, boxes: [{ x: 10, y: -70, w: 80, h: 50 }], anim: 'claw' },
    // Command attack: Heavy while running at speed.
    dashAttack: { name: 'Charging Ram', kind: 'heavy', startup: 9, active: 6, recovery: 22, phys: 9, elem: 1,
               kb: 5.8, growth: 0.1, angle: 42, boxes: [{ x: 6, y: -104, w: 74, h: 80 }], lunge: 6.5, anim: 'dash' },
    // Wake-up attack from a knockdown: hits both sides, invulnerable until it is active.
    getupAttack: { name: 'Rising Sweep', kind: 'light', startup: 10, active: 5, recovery: 20, phys: 6, elem: 0,
               kb: 4.8, growth: 0.04, angle: 28, away: true, boxes: [{ x: -84, y: -54, w: 168, h: 50 }], anim: 'spin', invulnStartup: true },
    // Guard Counter: Heavy during blockstun with half a bar. Invulnerable startup, pushes the attacker away.
    guardCounter: { name: 'Guard Counter', kind: 'heavy', startup: 6, active: 4, recovery: 24, phys: 4, elem: 0,
               kb: 7.6, growth: 0.02, angle: 34, boxes: [{ x: 4, y: -120, w: 82, h: 100 }], anim: 'push', meter: 50, invulnStartup: true },
    // Guard + Light on the ground. Beats guard, loses to attacks. The throw comes out after the hold.
    grab:    { name: 'Claw Grab', kind: 'grab', startup: 6, active: 3, recovery: 24, phys: 0, elem: 0,
               kb: 0, growth: 0, angle: 0, boxes: [{ x: 6, y: -114, w: 58, h: 96 }], anim: 'grab' },
    fthrow:  { name: 'Hurl', kind: 'throw', phys: 8, elem: 0, kb: 6.8, growth: 0.11, angle: 40 },
    bthrow:  { name: 'Tail Toss', kind: 'throw', phys: 9, elem: 0, kb: 7.2, growth: 0.12, angle: 44 },
    // Dragon Fury: Guard + Heavy with a full meter. The world stops for the cinematic, then a huge elemental blast.
    // The blast reaches 90 below the feet too, so a Fury from the top of a high jump still catches a grounded rival.
    ultimate: { name: 'Dragon Fury', kind: 'super', startup: 8, active: 14, recovery: 30, phys: 12, elem: 14,
               kb: 9.5, growth: 0.17, angle: 38, boxes: [{ x: -10, y: -186, w: 340, h: 276 }], anim: 'nova', freeze: 50, meter: 300 },
  };

  /** An EX (enhanced) special: one bar, faster, stronger, armoured through its startup, ignores the cooldown. */
  var exCache = {};
  function exVersion(def) {
    if (!def) return def;
    var key = def.name;
    if (exCache[key]) return exCache[key];
    var ex = JSON.parse(JSON.stringify(def));
    ex.name = def.name + ' EX'; ex.ex = true; ex.armor = true;
    ex.startup = Math.max(3, Math.ceil(def.startup * 0.7));
    var boost = function (o) { if (!o) return; if (o.phys) o.phys *= 1.4; if (o.elem) o.elem *= 1.5; if (o.kb) o.kb *= 1.15; if (o.speed) o.speed *= 1.2; if (o.finalKb) o.finalKb *= 1.15; };
    boost(ex); boost(ex.spawn); boost(ex.trail);
    if (ex.boxes) ex.boxes = ex.boxes.map(function (b) { return { x: b.x, y: b.y - 6, w: b.w * 1.15, h: b.h + 12 }; });
    exCache[key] = ex;
    return ex;
  }

  /**
   * Frame data for the move list: startup, active, recovery and the advantage (+/− frames) after the first active
   * frame connects with a standing, undamaged target. Hitstop freezes both dragons equally, so it cancels out.
   */
  function frameData(def) {
    var src = def.spawn || def.trail || def;
    var dmg = (src.phys || 0) + (src.elem || 0);
    var kb = (src.kb || 0) + (src.growth || 0) * dmg;
    var hitstun = Math.max(4, Math.min(PHYSICS.hitstunMax, Math.round(kb * PHYSICS.hitstunPerKb)));
    var blockstun = Math.min(PHYSICS.blockstunMax, Math.round(PHYSICS.blockstunBase + dmg * PHYSICS.blockstunPerDmg));
    var after = (def.spawn ? 0 : Math.max(0, (def.active || 1) - 1)) + (def.recovery || 0);
    return { startup: def.startup, active: def.active, recovery: def.recovery, damage: Math.round(dmg * 10) / 10,
             onHit: def.kind === 'grab' ? null : hitstun - after, onBlock: def.kind === 'grab' || def.kind === 'throw' ? null : blockstun - after };
  }

  // Which move a button + direction + ground/air chooses.
  function pickMove(button, dir, grounded) {
    if (button === 'light') {
      if (grounded) return dir === 'up' ? 'utilt' : dir === 'down' ? 'dtilt' : 'jab';
      return dir === 'up' ? 'uair' : dir === 'down' ? 'dair' : dir === 'side' ? 'fair' : 'nair';
    }
    if (button === 'heavy') {
      if (grounded) return dir === 'up' ? 'usmash' : dir === 'down' ? 'dsmash' : 'fsmash';
      return dir === 'up' ? 'wingBurst' : dir === 'down' ? 'meteor' : 'fheavyAir';
    }
    return null;
  }

  // ─────────────────────── Signature moves and elemental abilities ───────────────────────
  // Signature: L (neutral / side). Elemental ability: Down + L. Every one has a cooldown and a readable telegraph.
  var SIGNATURES = {
    fireball:     { element: 'fire', name: 'Fireball', cost: 22, desc: 'Fast fireball. Burns on hit.',
                    startup: 16, active: 1, recovery: 24, cooldown: 72, spawn: { type: 'fireball', speed: 9, life: 70, w: 34, h: 26, phys: 0, elem: 7, kb: 4.2, growth: 0.07, angle: 30, status: 'burn' } },
    flameBreath:  { element: 'fire', name: 'Flame Breath', cost: 26, desc: 'Short cone of fire: 5 quick hits.',
                    startup: 12, active: 26, recovery: 18, cooldown: 90, multi: { every: 6, max: 5 }, phys: 0, elem: 2.4,
                    kb: 2.2, growth: 0.02, angle: 35, finalKb: 5.6, finalGrowth: 0.09, boxes: [{ x: 30, y: -120, w: 120, h: 58 }] },
    iceShard:     { element: 'ice', name: 'Ice Shard', cost: 24, desc: 'Piercing shard that chills (20% slower, 0.75 s).',
                    startup: 14, active: 1, recovery: 18, cooldown: 50, spawn: { type: 'iceShard', speed: 11, life: 60, w: 40, h: 16, phys: 1, elem: 7, kb: 3.8, growth: 0.06, angle: 25, status: 'chill', structure: false } },
    glacierLance: { element: 'ice', name: 'Glacier Lance', cost: 26, desc: 'Slow, heavy lance. Big knockback.',
                    startup: 22, active: 1, recovery: 22, cooldown: 96, spawn: { type: 'lance', speed: 6.5, life: 95, w: 64, h: 22, phys: 2, elem: 9, kb: 6.2, growth: 0.11, angle: 30 } },
    bolt:         { element: 'lightning', name: 'Bolt', cost: 22, desc: 'Very fast, light bolt. Low knockback.',
                    startup: 9, active: 1, recovery: 16, cooldown: 46, spawn: { type: 'bolt', speed: 17, life: 34, w: 46, h: 12, phys: 0, elem: 6, kb: 3.4, growth: 0.05, angle: 20 } },
    arcLash:      { element: 'lightning', name: 'Arc Lash', cost: 26, desc: 'Long thin arc after a visible charge.',
                    startup: 16, active: 4, recovery: 22, cooldown: 80, phys: 0, elem: 9, kb: 5.2, growth: 0.1, angle: 28,
                    boxes: [{ x: 30, y: -96, w: 230, h: 22 }] },
    boulder:      { element: 'earth', name: 'Boulder', cost: 24, desc: 'Lobbed boulder. Slow, hits hard.',
                    startup: 18, active: 1, recovery: 22, cooldown: 80, spawn: { type: 'boulder', speed: 6, vy: -9, gravity: 0.42, life: 120, w: 40, h: 40, phys: 3, elem: 9, kb: 6, growth: 0.1, angle: 45 } },
    rockPillar:   { element: 'earth', name: 'Rock Pillar', cost: 26, desc: 'A pillar erupts ahead after a rumble.',
                    startup: 24, active: 8, recovery: 24, cooldown: 96, phys: 2, elem: 9, kb: 6, growth: 0.11, angle: 84,
                    boxes: [{ x: 150, y: -120, w: 56, h: 120 }], groundOnly: true },
    waterJet:     { element: 'water', name: 'Water Jet', cost: 22, desc: 'Jet of 3 hits that pushes. Soaks.',
                    startup: 11, active: 18, recovery: 16, cooldown: 54, multi: { every: 6, max: 3 }, phys: 0, elem: 2.6,
                    kb: 3.6, growth: 0.04, angle: 15, finalKb: 4.8, finalGrowth: 0.08, status: 'soaked', boxes: [{ x: 28, y: -104, w: 200, h: 34 }] },
    tidalWave:    { element: 'water', name: 'Tidal Wave', cost: 26, desc: 'A wave rolls along the ground. Jump it.',
                    startup: 16, active: 1, recovery: 22, cooldown: 72, spawn: { type: 'wave', speed: 8.5, life: 72, w: 60, h: 68, ground: true, phys: 1, elem: 8, kb: 5.2, growth: 0.09, angle: 55, status: 'soaked' } },
  };

  var ABILITIES = {
    emberBurst:   { element: 'fire', name: 'Ember Burst', cost: 15, desc: 'Close burst of embers around you.',
                    startup: 10, active: 5, recovery: 22, cooldown: 150, phys: 0, elem: 6, kb: 5, growth: 0.08, angle: 50, away: true, status: 'burn',
                    boxes: [{ x: -70, y: -130, w: 140, h: 130 }] },
    cinderTrail:  { element: 'fire', name: 'Cinder Trail', cost: 20, desc: 'Dash forward leaving flames on the floor.',
                    startup: 6, active: 14, recovery: 18, cooldown: 180, selfVel: [10, 0], trail: { type: 'flames', life: 60, every: 4, phys: 0, elem: 1.5, kb: 2.5, growth: 0.02, angle: 70, rehit: 30, w: 34, h: 30 } },
    frostWall:    { element: 'ice', name: 'Frost Wall', cost: 20, desc: 'Ice barrier ahead for 2 s. Blocks shots. Fire melts it.',
                    startup: 12, active: 1, recovery: 20, cooldown: 240, structure: { type: 'iceWall', dx: 80, w: 30, h: 110, life: 120, hp: 24 } },
    chillField:   { element: 'ice', name: 'Chill Field', cost: 18, desc: 'Frost circle forms, then chills anyone inside.',
                    startup: 8, active: 1, recovery: 18, cooldown: 200, spawn: { type: 'chillField', speed: 0, life: 50, delay: 24, w: 170, h: 70, ground: true, phys: 0, elem: 3, kb: 2.5, growth: 0.02, angle: 70, status: 'chill', dx: 90 } },
    staticPulse:  { element: 'lightning', name: 'Static Pulse', cost: 15, desc: 'Instant spark ring. Low knockback, fast.',
                    startup: 5, active: 4, recovery: 18, cooldown: 120, phys: 0, elem: 5, kb: 4.4, growth: 0.05, angle: 60, away: true,
                    boxes: [{ x: -64, y: -124, w: 128, h: 120 }] },
    blinkStrike:  { element: 'lightning', name: 'Blink Strike', cost: 22, desc: 'Teleport up to 150 px, stopping in front of a rival, and strike. Once per jump.',
                    startup: 10, active: 4, recovery: 22, cooldown: 150, blink: 150, oncePerAir: true, phys: 1, elem: 6, kb: 4.6, growth: 0.08, angle: 40,
                    boxes: [{ x: -10, y: -120, w: 80, h: 100 }] },
    stoneSkin:    { element: 'earth', name: 'Stone Skin', cost: 20, desc: '0.75 s of armour: 35% less knockback. Never invulnerable.',
                    startup: 8, active: 1, recovery: 30, cooldown: 300, buff: { type: 'stoneSkin', ticks: 45, kbMult: 0.65 } },
    quakeStomp:   { element: 'earth', name: 'Quake Stomp', cost: 20, desc: 'Shockwaves both ways along the floor. Jump them.',
                    startup: 16, active: 1, recovery: 30, cooldown: 180, groundOnly: true, spawn: { type: 'quake', speed: 8, life: 40, w: 46, h: 30, ground: true, both: true, phys: 2, elem: 6, kb: 5, growth: 0.07, angle: 75 } },
    tidePool:     { element: 'water', name: 'Tide Pool', cost: 16, desc: 'Puddle for 2.5 s: soaks, puts out fire.',
                    startup: 10, active: 1, recovery: 18, cooldown: 220, spawn: { type: 'puddle', speed: 0, life: 150, w: 170, h: 18, ground: true, dx: 50, phys: 0, elem: 0, kb: 0, growth: 0, angle: 0, status: 'soaked', harmless: true } },
    riptide:      { element: 'water', name: 'Riptide', cost: 20, desc: 'Whirlpool that drags targets toward its centre.',
                    startup: 14, active: 1, recovery: 20, cooldown: 200, spawn: { type: 'whirlpool', speed: 2, life: 60, w: 110, h: 110, phys: 0, elem: 1.2, kb: 1.4, growth: 0, angle: 90, rehit: 12, pull: 1.8, status: 'soaked', dy: -60 } },
  };

  // ─────────────────────────────── Build catalog ───────────────────────────────
  var BUDGET = 100;

  var BODIES = {
    lithe:    { name: 'Lithe Frame',    cost: 10, weight: 82,  hurt: { w: 40, h: 112 }, scale: [0.84, 0.91], physMult: 0.95, speedMult: 1,
                desc: 'Light and small: easy to launch, hard to hit.' },
    balanced: { name: 'Balanced Frame', cost: 20, weight: 100, hurt: { w: 46, h: 128 }, scale: [1, 1], physMult: 1, speedMult: 1,
                desc: 'No weakness, no edge.' },
    armored:  { name: 'Armored Frame',  cost: 30, weight: 114, hurt: { w: 54, h: 142 }, scale: [1.14, 1.1], physMult: 1.05, speedMult: 0.97,
                desc: 'Survives longer, a bigger target.' },
    titan:    { name: 'Titan Frame',    cost: 38, weight: 128, hurt: { w: 66, h: 154 }, scale: [1.3, 1.2], physMult: 1.1, speedMult: 0.92,
                desc: 'Heaviest and hardest-hitting. Slow, huge target.' },
  };

  var MOBILITY = {
    stomper: { name: 'Stomper', cost: 8,  run: 4.4, air: 3.4, jump: 13.2, airJumps: 1, dodgeCd: 62, dashMult: 0.9,
               desc: 'Slow on foot, one air jump.' },
    strider: { name: 'Strider', cost: 18, run: 5.3, air: 4.0, jump: 13.8, airJumps: 1, dodgeCd: 54, dashMult: 1,
               desc: 'Solid all-round movement.' },
    dasher:  { name: 'Dasher',  cost: 28, run: 6.5, air: 4.5, jump: 14.2, airJumps: 1, dodgeCd: 44, dashMult: 1.2,
               desc: 'Fastest on the ground, quicker dodges.' },
    skyborne:{ name: 'Skyborne',cost: 28, run: 5.0, air: 4.8, jump: 13.4, airJumps: 2, dodgeCd: 54, dashMult: 1, glide: true,
               desc: 'Two air jumps and a glide (hold jump while falling).' },
  };

  var UPGRADES = {
    none:           { name: 'No upgrade',     cost: 0,  desc: 'Bank the points.' },
    keenClaws:      { name: 'Keen Claws',     cost: 10, desc: 'Light attacks +12% physical damage.', lightPhys: 1.12 },
    longReach:      { name: 'Long Reach',     cost: 12, desc: 'Melee hitboxes 12% larger.', reach: 1.12 },
    secondWind:     { name: 'Second Wind',    cost: 16, desc: '+1 air jump.', airJumps: 1 },
    quickDodge:     { name: 'Quick Dodge',    cost: 10, desc: 'Dodge cooldown 25% shorter.', dodgeCd: 0.75 },
    elementalFocus: { name: 'Elemental Focus',cost: 12, desc: 'Signature and ability cooldowns 20% shorter.', cooldown: 0.8 },
    ironWill:       { name: 'Iron Will',      cost: 16, desc: 'Take 8% less knockback.', kbTaken: 0.92 },
  };

  // ─────────────────────────────── Gear (loadout chosen before each fight) ───────────────────────────────
  // A second budget, the same for every dragon, on top of the 100-point build. Size swaps the body frame: going up
  // costs the difference in body cost, going down is free and refunds nothing.
  var GEAR_BUDGET = 30;
  var SIZES = {
    small:  { name: 'Small',  body: 'lithe',    icon: 'size', desc: 'Hard to hit, easy to launch.' },
    medium: { name: 'Medium', body: 'balanced', icon: 'size', desc: 'The all-rounder.' },
    large:  { name: 'Large',  body: 'armored',  icon: 'size', desc: 'Heavier, hits harder, bigger target.' },
    huge:   { name: 'Huge',   body: 'titan',    icon: 'size', desc: 'Very heavy and strong, slow, huge target.' },
  };
  // Instinct: a priced, exclusive choice made before every fight that changes how a dragon wants to play.
  var INSTINCTS = {
    fury:      { name: 'Fury',      icon: 'fury', cost: 4, meterHit: 1.5, meterTaken: 1, guardMax: 0.65, scaleOffset: 1, cdRefund: 30, finisherKb: 1.15,
                 desc: 'All-out offence. Every hit you land trims 0.5 s off your Special and Ability cooldowns, +50% meter from hits, combos keep full damage one hit longer and combo finishers launch 15% harder. Your guard bar is 35% smaller.' },
    bastion:   { name: 'Bastion',   icon: 'bastion', cost: 6, meterHit: 0.75, meterTaken: 1, guardMax: 1.5, parryWindow: 8, guardCounterCost: 25, parryStunBonus: 24, parryRefill: true,
                 desc: 'Wall of scales. Guard bar +50%, an 8-frame parry window and Guard Counters for a quarter bar. A perfect parry refills your guard and leaves the attacker reeling much longer. 25% less meter from hits.' },
    tempest:   { name: 'Tempest',   icon: 'tempest', cost: 8, meterHit: 1, meterTaken: 1, guardMax: 1, airJumps: 1, dodgeCd: 0.7, kbTaken: 1.08, windCancel: 50, airDamage: 1.2,
                 desc: 'Never still. +1 air jump, dodges recover 30% sooner, hits landed while airborne deal +20%, and Dodge cancels a move that connected into a dash (half a bar). Takes 8% more knockback.' },
    vengeance: { name: 'Vengeance', icon: 'vengeance', cost: 10, meterHit: 1, meterTaken: 2, guardMax: 1, rageDamage: 0.3, lastStand: 0.85,
                 desc: 'Hurt it and it hurts back. Deals up to +30% damage as its own damage % climbs (full at 120%), builds double meter from taking hits, and past 100% damage takes 15% less knockback (Last Stand).' },
  };
  // Abilities: their own button, cooldowns in ticks (60 = 1 s). All are visible and have a counter.
  var GEAR_ABILITIES = {
    none:  { name: 'No ability', cost: 0, icon: 'none', cooldown: 0, desc: 'Bank the points.' },
    fade:  { name: 'Fade',       cost: 10, icon: 'fade', cooldown: 720, duration: 135, ambush: 1.6, desc: 'Turn to a faint shimmer for 2.25 s. Ends when you attack or are hit. The attack that breaks it hits 60% harder.' },
    aegis: { name: 'Aegis',      cost: 12, icon: 'aegis', cooldown: 720, duration: 180, desc: 'A shield that absorbs one hit within 3 s, then bursts and blasts the attacker away.' },
    phase: { name: 'Phase Dash', cost: 8,  icon: 'phase', cooldown: 480, duration: 14,  ambush: 1.25, desc: 'A fast dash through attacks (invulnerable while dashing). Your next hit within 1.2 s deals +25%.' },
    decoy: { name: 'Decoy',      cost: 10, icon: 'decoy', cooldown: 720, duration: 180, desc: 'Leave a copy that bursts when struck: a wide, hard-hitting blast on nearby enemies.' },
    rage:  { name: 'Rage',       cost: 10, icon: 'rage', cooldown: 900, duration: 300, mult: 1.3, takenMult: 1.15, desc: '5 s of +30% damage dealt and +15% knockback taken.' },
    gust:  { name: 'Gust',       cost: 8,  icon: 'gust', cooldown: 420, range: 230, desc: 'A wing blast that shoves enemies in front away and throws their projectiles back at them.' },
  };

  // ─────────────────────────────── Cosmetics (no combat effect) ───────────────────────────────
  var PARTS = {
    head:   { warrior: 'Warrior', beak: 'Beaked', maw: 'Iron Maw', frill: 'Frilled', crest: 'Bladed Crest', whiskers: 'Ember Whiskers' },
    horns:  { warrior: 'Warrior Horns', curved: 'Swept', crystal: 'Crystal', forked: 'Forked', ram: 'Ram', fin: 'Fin Crest', none: 'None' },
    wings:  { none: 'None', bat: 'Bat', ember: 'Ember', crystal: 'Crystal', storm: 'Storm', stub: 'Stone Stubs', fin: 'Fin' },
    tail:   { warrior: 'Warrior Tail', flame: 'Flame Tip', crystal: 'Ice Blade', bolt: 'Bolt', club: 'Rock Club', fluke: 'Fluke' },
    spikes: { none: 'None', thorns: 'Thorns', crystals: 'Crystals', plates: 'Stone Plates', fins: 'Dorsal Fins' },
    armor:  { none: 'None', pauldrons: 'Pauldrons', chest: 'Chest Plate', rock: 'Rock Hide', scale: 'Scale Mail' },
    eyes:   { warrior: 'Warrior', glow: 'Glowing', fierce: 'Fierce', slit: 'Slit', calm: 'Calm' },
    markings: { none: 'None', stripes: 'Stripes', bolts: 'Bolts', spots: 'Spots', runes: 'Runes', waves: 'Waves', embers: 'Embers' },
    accessory: { none: 'None', crown: 'Crown', scarf: 'Scarf', hornRings: 'Horn Rings', amulet: 'Amulet' },
    aura:   { none: 'None', subtle: 'Subtle', blazing: 'Blazing' },
  };

  // HD sprite recolours (cosmetic): a scale colour re-hues the painted art keeping its shading, a finish changes its
  // surface. Both are optional look fields; missing means natural.
  var TINTS = { none: { name: 'Natural' }, crimson: { name: 'Crimson', color: '#d8301c' }, ember: { name: 'Ember', color: '#ff8a1c' },
                gold: { name: 'Gold', color: '#e8c040' }, jade: { name: 'Jade', color: '#2fae6a' }, azure: { name: 'Azure', color: '#2f7ad8' },
                frost: { name: 'Frost', color: '#7fd8ff' }, violet: { name: 'Violet', color: '#8a3ad8' }, rose: { name: 'Rose', color: '#e0508a' } };
  var SHADES = { none: { name: 'Natural' }, shadow: { name: 'Shadow' }, gilded: { name: 'Gilded' }, bone: { name: 'Bone' }, spectral: { name: 'Spectral' } };

  // Archetypes: each is a valid ≤100-point build plus a distinct look.
  var PRESETS = [
    { id: 'emberfang', name: 'Emberfang', element: 'fire', body: 'balanced', mobility: 'dasher', signature: 'fireball', ability: 'cinderTrail', upgrade: 'keenClaws',
      look: { head: 'whiskers', horns: 'curved', wings: 'ember', tail: 'flame', spikes: 'thorns', armor: 'none', eyes: 'fierce', markings: 'embers', accessory: 'none', aura: 'subtle',
              primary: '#d8361c', secondary: '#ffb02e', belly: '#ff9a5a', eye: '#ffe14a' } },
    { id: 'frostwing', name: 'Frostwing', element: 'ice', body: 'lithe', mobility: 'skyborne', signature: 'iceShard', ability: 'frostWall', upgrade: 'elementalFocus',
      look: { head: 'beak', horns: 'crystal', wings: 'crystal', tail: 'crystal', spikes: 'crystals', armor: 'none', eyes: 'glow', markings: 'runes', accessory: 'none', aura: 'subtle',
              primary: '#5fb8ff', secondary: '#e6fbff', belly: '#bfeaff', eye: '#bff6ff' } },
    { id: 'voltscale', name: 'Voltscale', element: 'lightning', body: 'lithe', mobility: 'dasher', signature: 'bolt', ability: 'blinkStrike', upgrade: 'quickDodge',
      look: { head: 'crest', horns: 'forked', wings: 'storm', tail: 'bolt', spikes: 'none', armor: 'scale', eyes: 'slit', markings: 'bolts', accessory: 'none', aura: 'subtle',
              primary: '#5a3cc8', secondary: '#ffe14a', belly: '#9f8cff', eye: '#fff36a' } },
    { id: 'ironmaw', name: 'Ironmaw', element: 'earth', body: 'titan', mobility: 'stomper', signature: 'boulder', ability: 'quakeStomp', upgrade: 'keenClaws',
      look: { head: 'maw', horns: 'ram', wings: 'stub', tail: 'club', spikes: 'plates', armor: 'rock', eyes: 'calm', markings: 'none', accessory: 'none', aura: 'none',
              primary: '#8a6a4a', secondary: '#d8c08a', belly: '#c79c6a', eye: '#ffb84a' } },
    { id: 'tidefang', name: 'Tidefang', element: 'water', body: 'balanced', mobility: 'strider', signature: 'tidalWave', ability: 'riptide', upgrade: 'secondWind',
      look: { head: 'frill', horns: 'fin', wings: 'fin', tail: 'fluke', spikes: 'fins', armor: 'none', eyes: 'calm', markings: 'waves', accessory: 'none', aura: 'subtle',
              primary: '#0f8fa0', secondary: '#7ff2e4', belly: '#a9f0e0', eye: '#e8fffb' } },
    { id: 'warrior', name: 'Dragon Warrior', element: 'earth', body: 'balanced', mobility: 'strider', signature: 'rockPillar', ability: 'stoneSkin', upgrade: 'keenClaws',
      look: { head: 'warrior', horns: 'warrior', wings: 'none', tail: 'warrior', spikes: 'none', armor: 'none', eyes: 'warrior', markings: 'none', accessory: 'none', aura: 'none',
              primary: '#3c9a3a', secondary: '#f2c23a', belly: '#9bc46a', eye: '#ff3b3b' } },
  ];

  // Sprite-pack dragons: the five archetypes above, drawn from painted sheets (assets/dragons/<id>/, see js/sprite.js).
  // Same stats as the rig archetype; look.sprite only picks the art (cosmetic, never read by the simulation). The rig
  // look stays on the build as the fallback when the sheets cannot load.
  var SPRITES = { emberfang: 'Emberfang', frostwing: 'Frostwing', ironmaw: 'Ironmaw', voltscale: 'Voltscale', tidefang: 'Tidefang' };
  Object.keys(SPRITES).forEach(function (id) {
    var base = PRESETS.filter(function (p) { return p.id === id; })[0];
    var hd = JSON.parse(JSON.stringify(base));
    hd.id = id + '-hd'; hd.name = base.name; hd.look.sprite = id;
    PRESETS.push(hd);
  });

  // ─────────────────────────────── Arenas ───────────────────────────────
  // Solid platforms have ledges; 'soft' platforms can be dropped through (down) and jumped up through.
  var ARENAS = {
    skyforge: { id: 'skyforge', name: 'Skyforge Spire', theme: 'storm', blurb: 'A dragon-forged tower above the stormline. Lightning crowns the upper platforms.',
                size: [1600, 900], blast: { left: -260, right: 1860, top: -520, bottom: 1180 },
                platforms: [
                  { x: 340, y: 640, w: 920, h: 170, solid: true },
                  { x: 450, y: 470, w: 210, h: 14 },
                  { x: 940, y: 470, w: 210, h: 14 },
                  { x: 695, y: 320, w: 210, h: 14 },
                ],
                spawns: [[560, 640], [1040, 640], [460, 640], [1140, 640], [660, 640], [940, 640]] },
    frostfall: { id: 'frostfall', name: 'Frostfall Rift', theme: 'crystal', blurb: 'A frozen dragon hollow lit by living crystals and falling ice.',
                size: [1600, 900], blast: { left: -260, right: 1860, top: -520, bottom: 1180 },
                platforms: [
                  { x: 300, y: 650, w: 420, h: 150, solid: true },
                  { x: 880, y: 650, w: 420, h: 150, solid: true },
                  { x: 700, y: 520, w: 200, h: 14 },
                  { x: 420, y: 430, w: 180, h: 14 },
                  { x: 1000, y: 430, w: 180, h: 14 },
                ],
                spawns: [[470, 650], [1130, 650], [380, 650], [1220, 650], [600, 650], [1000, 650]] },
    training: { id: 'training', name: 'Training Grounds', theme: 'blossom', blurb: 'A quiet dragon dojo garden with drifting petals and temple lanterns.',
                size: [1600, 900], blast: { left: -260, right: 1860, top: -520, bottom: 1180 },
                platforms: [
                  { x: 300, y: 640, w: 1000, h: 170, solid: true },
                  { x: 520, y: 470, w: 200, h: 14 },
                  { x: 880, y: 470, w: 200, h: 14 },
                ],
                spawns: [[600, 640], [1000, 640]] },
    caldera: { id: 'caldera', name: 'Ember Caldera', theme: 'volcano', blurb: 'A basalt crown over a lava lake. Two low ledges step down off the sides.',
                size: [1600, 900], blast: { left: -260, right: 1860, top: -520, bottom: 1180 },
                platforms: [
                  { x: 430, y: 640, w: 740, h: 180, solid: true },
                  { x: 200, y: 730, w: 180, h: 120, solid: true },
                  { x: 1220, y: 730, w: 180, h: 120, solid: true },
                  { x: 690, y: 470, w: 220, h: 14 },
                ],
                spawns: [[600, 640], [1000, 640], [290, 730], [1310, 730], [700, 640], [900, 640]] },
    stormcrown: { id: 'stormcrown', name: 'Stormcrown Peaks', theme: 'storm', blurb: 'Three summits in a thunderhead. Mind the gaps.',
                size: [1600, 900], blast: { left: -260, right: 1860, top: -520, bottom: 1180 },
                platforms: [
                  { x: 650, y: 600, w: 300, h: 210, solid: true },
                  { x: 240, y: 680, w: 320, h: 150, solid: true },
                  { x: 1040, y: 680, w: 320, h: 150, solid: true },
                  { x: 690, y: 430, w: 220, h: 14 },
                ],
                spawns: [[400, 680], [1200, 680], [740, 600], [860, 600], [320, 680], [1280, 680]] },
    jade: { id: 'jade', name: 'Jade Terrace', theme: 'blossom', blurb: 'A temple garden in spring. Three floating terraces over a wide floor.',
                size: [1600, 900], blast: { left: -260, right: 1860, top: -520, bottom: 1180 },
                platforms: [
                  { x: 360, y: 640, w: 880, h: 170, solid: true },
                  { x: 440, y: 500, w: 200, h: 14 },
                  { x: 960, y: 500, w: 200, h: 14 },
                  { x: 700, y: 365, w: 200, h: 14 },
                ],
                spawns: [[560, 640], [1040, 640], [460, 640], [1140, 640], [680, 640], [920, 640]] },
    colosseum: { id: 'colosseum', name: 'Dragon Colosseum', theme: 'arena', blurb: 'Walled sand pit. Wall splats, wall jumps and corner pressure; KOs go over the top.',
                size: [1600, 900], blast: { left: -260, right: 1860, top: -460, bottom: 1180 },
                platforms: [
                  { x: 340, y: 660, w: 920, h: 180, solid: true },
                  { x: 220, y: 330, w: 120, h: 510, solid: true, wall: true },
                  { x: 1260, y: 330, w: 120, h: 510, solid: true, wall: true },
                  { x: 690, y: 480, w: 220, h: 14 },
                ],
                spawns: [[600, 660], [1000, 660], [480, 660], [1120, 660], [720, 660], [880, 660]] },
    crystal: { id: 'crystal', name: 'Crystal Hollow', theme: 'crystal', blurb: 'A glowing geode cavern. Small floor, low side perches.',
                size: [1600, 900], blast: { left: -240, right: 1840, top: -480, bottom: 1160 },
                platforms: [
                  { x: 440, y: 640, w: 720, h: 180, solid: true },
                  { x: 250, y: 545, w: 170, h: 14 },
                  { x: 1180, y: 545, w: 170, h: 14 },
                  { x: 700, y: 455, w: 200, h: 14 },
                ],
                spawns: [[600, 640], [1000, 640], [520, 640], [1080, 640], [740, 640], [860, 640]] },
    shrine: { id: 'shrine', name: 'Sunken Shrine', theme: 'reef', blurb: 'A drowned temple. A raised altar splits the floor.',
                size: [1600, 900], blast: { left: -260, right: 1860, top: -520, bottom: 1180 },
                platforms: [
                  { x: 320, y: 660, w: 960, h: 170, solid: true },
                  { x: 720, y: 580, w: 160, h: 80, solid: true, altar: true },
                  { x: 400, y: 500, w: 190, h: 14 },
                  { x: 1010, y: 500, w: 190, h: 14 },
                ],
                spawns: [[520, 660], [1080, 660], [420, 660], [1180, 660], [620, 660], [980, 660]] },
  };
  // Arenas offered in Versus, tournaments and online rooms, in menu order (training stays separate).
  var ARENA_ORDER = ['skyforge', 'frostfall', 'caldera', 'stormcrown', 'jade', 'colosseum', 'crystal', 'shrine'];

  var FORMATS = {
    '1v1': { id: '1v1', name: '1 v 1', teams: 2, perTeam: 1 },
    '2v2': { id: '2v2', name: '2 v 2', teams: 2, perTeam: 2 },
    '3v3': { id: '3v3', name: '3 v 3', teams: 2, perTeam: 3 },
    'ffa': { id: 'ffa', name: 'Free-for-all (4)', teams: 4, perTeam: 1 },
  };
  var TEAM_COLORS = ['#ff4d5a', '#3d8bff', '#3ddc84', '#ffc93d'];
  var TEAM_NAMES = ['Red', 'Blue', 'Green', 'Gold'];

  return {
    TICK_RATE: TICK_RATE, ELEMENTS: ELEMENTS, ELEMENT_ORDER: ELEMENT_ORDER, BEATS: BEATS, BEATS_EDGE: BEATS_EDGE, matchupTier: matchupTier, ELEMENT_CONFIG: ELEMENT_CONFIG,
    elementMultiplier: elementMultiplier, matchup: matchup, INTERACTIONS: INTERACTIONS, STATUS: STATUS,
    PHYSICS: PHYSICS, MOVES: MOVES, pickMove: pickMove, SIGNATURES: SIGNATURES, ABILITIES: ABILITIES,
    GEAR_BUDGET: GEAR_BUDGET, SIZES: SIZES, INSTINCTS: INSTINCTS, GEAR_ABILITIES: GEAR_ABILITIES,
    BUDGET: BUDGET, BODIES: BODIES, MOBILITY: MOBILITY, UPGRADES: UPGRADES, PARTS: PARTS, PRESETS: PRESETS, SPRITES: SPRITES, TINTS: TINTS, SHADES: SHADES,
    ARENAS: ARENAS, ARENA_ORDER: ARENA_ORDER, FORMATS: FORMATS, TEAM_COLORS: TEAM_COLORS, TEAM_NAMES: TEAM_NAMES,
    COMBO: COMBO, INPUT_PRIORITY: INPUT_PRIORITY, CANCELS: CANCELS, exVersion: exVersion, frameData: frameData,
  };
});
