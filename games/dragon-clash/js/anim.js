/*
 * Dragon Clash — animation state machine.
 *
 * Art available: the pack's real idle (97 frames, 24 used). Everything else is posed on a cutout rig cut from that
 * same painting (tools/process_pack.py → rig parts with joints): head, torso, upper/lower arms, thighs, shins,
 * plus the separate tail, horns and the modular wings. Each gameplay state has a clip — a function from the
 * fighter's state and timers to joint angles — and an Animator per dragon blends between them so transitions
 * never pop, idle can never override an attack, and a held button never restarts one (attacks follow the
 * simulation's move timer, which only starts on a press).
 *
 * Attack clips follow the simulation's own frame data: anticipation = startup frames, strike = active frames
 * (the pose is on screen exactly while the hitbox exists), follow-through then recovery = recovery frames.
 */
(function () {
  'use strict';
  var D = window.DC.Data;
  var R = Math.PI / 180;

  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }
  function out(t) { t = Math.max(0, Math.min(1, t)); return 1 - (1 - t) * (1 - t) * (1 - t); }
  function lerp(a, b, k) { return a + (b - a) * k; }

  var BONES = ['torso', 'head', 'nearArmUp', 'nearArmLo', 'farArmUp', 'farArmLo', 'farThigh', 'farShin', 'nearThigh', 'nearShin'];

  /** Pose in degrees: { torso, head, nAU, nAL, fAU, fAL, nT, nS, fT, fS, hip }. Missing = 0. */
  function P(o) {
    return { torso: o.torso || 0, head: o.head || 0, nearArmUp: o.nAU || 0, nearArmLo: o.nAL || 0, farArmUp: o.fAU || 0, farArmLo: o.fAL || 0,
             nearThigh: o.nT || 0, nearShin: o.nS || 0, farThigh: o.fT || 0, farShin: o.fS || 0, hip: o.hip || 0 };
  }
  function mixP(a, b, k) { var o = {}; for (var key in a) o[key] = lerp(a[key], b[key], k); return o; }
  function add(a, b) { var o = {}; for (var key in a) o[key] = a[key] + (b[key] || 0); return o; }

  var REST = P({});
  var AIR_TUCK = { nT: -50, nS: 75, fT: -25, fS: 60 };

  // ─────────────────────────── attack key poses ───────────────────────────
  // windup = end of anticipation, strike = while the hitbox is out, follow = early recovery overshoot.
  var ATTACK = {
    clawLight: { windup: P({ nAU: 55, nAL: -70, torso: -6, fAU: -15, fAL: -20, nT: -8, nS: 12, fT: 8, fS: 10, hip: 2 }),
                 strike: P({ nAU: -78, nAL: -18, torso: 16, head: 6, fAU: 35, fAL: -30, nT: -22, nS: 16, fT: 18, fS: 10, hip: 2 }),
                 follow: P({ nAU: -60, nAL: -40, torso: 12, head: 4, fAU: 25, fAL: -25, nT: -15, nS: 12, fT: 12, fS: 8, hip: 1 }) },
    clawHeavy: { windup: P({ nAU: 100, nAL: -85, fAU: -40, fAL: -45, torso: -18, head: -8, hip: 7, nT: -30, nS: 48, fT: 16, fS: 40 }),
                 strike: P({ nAU: -98, nAL: -6, fAU: 55, fAL: -20, torso: 32, head: 14, hip: 7, nT: -48, nS: 30, fT: 32, fS: 14 }),
                 follow: P({ nAU: -70, nAL: -50, fAU: 40, fAL: -30, torso: 26, head: 10, hip: 6, nT: -40, nS: 32, fT: 26, fS: 14 }) },
    up:        { windup: P({ hip: 8, nT: -30, nS: 52, fT: -22, fS: 46, torso: 24, head: 34, nAU: 35, nAL: -20, fAU: 25, fAL: -20 }),
                 strike: P({ hip: -2, torso: -14, head: -42, nAU: -165, nAL: -8, fAU: -150, fAL: -15, nT: -4, nS: 4, fT: 4, fS: 2 }),
                 follow: P({ hip: 0, torso: -8, head: -28, nAU: -140, nAL: -30, fAU: -125, fAL: -30 }) },
    tail:      { windup: P({ hip: 10, torso: 26, head: -20, nT: -40, nS: 60, fT: -14, fS: 42, nAU: -20, fAU: 25 }),
                 strike: P({ hip: 12, torso: 40, head: -24, nT: -44, nS: 64, fT: -10, fS: 46, nAU: -35, nAL: -20, fAU: 40 }),
                 follow: P({ hip: 10, torso: 34, head: -20, nT: -40, nS: 60, fT: -12, fS: 44, nAU: -25, fAU: 30 }) },
    spin:      { windup: P({ hip: 6, torso: 10, nAU: -30, nAL: -60, fAU: 30, fAL: -60, nT: -15, nS: 30, fT: 10, fS: 25 }),
                 strike: P({ hip: 4, torso: 6, nAU: -95, nAL: 0, fAU: 95, fAL: 0, nT: -20, nS: 22, fT: 20, fS: 22 }),
                 follow: P({ hip: 4, torso: 8, nAU: -60, nAL: -20, fAU: 60, fAL: -20 }) },
    stomp:     { windup: P({ nT: -62, nS: 82, fT: -50, fS: 72, nAU: -150, nAL: -20, fAU: -140, fAL: -20, torso: -6, head: -6 }),
                 strike: P({ nT: 6, nS: -2, fT: -6, fS: 2, nAU: -168, nAL: 0, fAU: -160, fAL: 0, torso: 8, head: 22 }),
                 follow: P({ nT: 0, nS: 8, fT: -4, fS: 8, nAU: -140, nAL: -20, fAU: -130, fAL: -20, torso: 6, head: 16 }) },
    burst:     { windup: P(Object.assign({ nAU: -40, nAL: -80, fAU: 40, fAL: -80, torso: 14, head: 10 }, AIR_TUCK)),
                 strike: P({ nAU: -150, nAL: -10, fAU: 150, fAL: -10, torso: -10, head: -22, nT: 4, nS: 10, fT: -4, fS: 10 }),
                 follow: P({ nAU: -120, nAL: -20, fAU: 120, fAL: -20, torso: -6, head: -14 }) },
    // Signature / ability families
    breath:    { windup: P({ head: -28, torso: -14, nAU: 40, nAL: -30, fAU: 30, fAL: -30, hip: 3, nT: -10, nS: 18, fT: 10, fS: 14 }),
                 strike: P({ head: 16, torso: 20, nAU: -62, nAL: -22, fAU: 40, fAL: -20, hip: 4, nT: -26, nS: 22, fT: 22, fS: 12 }),
                 follow: P({ head: 10, torso: 16, nAU: -45, nAL: -30, fAU: 30, fAL: -20, hip: 3, nT: -20, nS: 18, fT: 18, fS: 10 }) },
    throw:     { windup: P({ nAU: 150, nAL: -60, fAU: -50, fAL: -30, torso: -20, head: -10, hip: 5, nT: -20, nS: 30, fT: 20, fS: 25 }),
                 strike: P({ nAU: -70, nAL: -10, fAU: 45, fAL: -20, torso: 30, head: 10, hip: 6, nT: -40, nS: 28, fT: 30, fS: 12 }),
                 follow: P({ nAU: -50, nAL: -30, fAU: 35, fAL: -20, torso: 24, head: 8, hip: 5, nT: -32, nS: 24, fT: 24, fS: 10 }) },
    slam:      { windup: P({ nT: -78, nS: 72, nAU: -120, nAL: -30, fAU: -110, fAL: -30, torso: -8, head: -12, fT: 6, fS: 10 }),
                 strike: P({ nT: -14, nS: 8, hip: 11, torso: 28, head: 8, nAU: -40, nAL: -30, fAU: -30, fAL: -30, fT: 18, fS: 30 }),
                 follow: P({ nT: -16, nS: 14, hip: 9, torso: 22, head: 6, nAU: -30, nAL: -30, fAU: -20, fAL: -30, fT: 16, fS: 26 }) },
    nova:      { windup: P({ torso: 22, head: 18, nAU: -60, nAL: -95, fAU: -55, fAL: -95, hip: 9, nT: -25, nS: 45, fT: 15, fS: 40 }),
                 strike: P({ torso: -14, head: -28, nAU: -125, nAL: -5, fAU: 125, fAL: -5, hip: 2, nT: -26, nS: 10, fT: 26, fS: 10 }),
                 follow: P({ torso: -8, head: -18, nAU: -100, nAL: -20, fAU: 100, fAL: -20, hip: 2 }) },
    push:      { windup: P({ nAU: 55, nAL: -60, fAU: 45, fAL: -60, torso: -10, hip: 4, nT: -12, nS: 20, fT: 12, fS: 16 }),
                 strike: P({ nAU: -88, nAL: -6, fAU: -78, fAL: -8, torso: 22, head: 4, hip: 5, nT: -30, nS: 24, fT: 24, fS: 12 }),
                 follow: P({ nAU: -75, nAL: -20, fAU: -65, fAL: -20, torso: 18, hip: 4 }) },
    flex:      { windup: P({ nAU: 25, nAL: -60, fAU: -25, fAL: -60, hip: 6, torso: 12, head: 10, nT: -15, nS: 25, fT: 15, fS: 25 }),
                 strike: P({ nAU: 25, nAL: -115, fAU: -25, fAL: -115, hip: 8, torso: -8, head: -14, nT: -22, nS: 20, fT: 22, fS: 20 }),
                 follow: P({ nAU: 20, nAL: -100, fAU: -20, fAL: -100, hip: 7, torso: -4, head: -8, nT: -20, nS: 20, fT: 20, fS: 20 }) },
    grab:      { windup: P({ nAU: 45, nAL: -50, fAU: 35, fAL: -50, torso: -8, head: 4, hip: 4, nT: -14, nS: 22, fT: 12, fS: 18 }),
                 strike: P({ nAU: -86, nAL: -24, fAU: -74, fAL: -30, torso: 20, head: 6, hip: 6, nT: -34, nS: 26, fT: 26, fS: 14 }),
                 follow: P({ nAU: -70, nAL: -40, fAU: -60, fAL: -40, torso: 14, head: 4, hip: 5, nT: -26, nS: 22, fT: 20, fS: 12 }) },
    dash:      { windup: P({ hip: 8, torso: 30, head: -24, nAU: 50, fAU: 55, nT: -35, nS: 50, fT: 25, fS: 30 }),
                 strike: P({ hip: 7, torso: 36, head: -26, nAU: -80, nAL: -10, fAU: 60, nT: -45, nS: 40, fT: 35, fS: 25 }),
                 follow: P({ hip: 6, torso: 28, head: -18, nAU: -60, nAL: -30, fAU: 45, nT: -35, nS: 35, fT: 28, fS: 22 }) },
  };
  // Strike limbs fitted to each move's real hitbox (searched against the rig with forward kinematics, so the claw,
  // foot or horn is inside the hitbox on its active frames). Applied on top of the shared key poses.
  var STRIKE_FIT = {
    jab:         { nearArmUp: 0,   nearArmLo: -112 },
    fsmash:      { nearArmUp: -6,  nearArmLo: -84 },
    fair:        { nearArmUp: -10, nearArmLo: -60 },
    fheavyAir:   { nearArmUp: -10, nearArmLo: -80 },
    ledgeAttack: { nearArmUp: -38, nearArmLo: 0 },
    dair:        { nearThigh: 52,  nearShin: 0 },
    meteor:      { nearThigh: 48,  nearShin: 12 },
    uair:        { torso: 0,       head: -44 },
  };
  function fitted(K, mv) {
    var fit = STRIKE_FIT[mv];
    if (!fit) return K;
    var strike = Object.assign({}, K.strike, fit), follow = Object.assign({}, K.follow);
    for (var k in fit) follow[k] = lerp(fit[k], K.follow[k], 0.35);
    return { windup: K.windup, strike: strike, follow: follow };
  }

  var SPECIAL_FAMILY = {
    fireball: 'breath', flameBreath: 'breath', iceShard: 'throw', glacierLance: 'throw', bolt: 'breath', arcLash: 'breath',
    boulder: 'throw', rockPillar: 'slam', waterJet: 'breath', tidalWave: 'push',
    emberBurst: 'nova', cinderTrail: 'dash', frostWall: 'push', chillField: 'slam', staticPulse: 'nova', blinkStrike: 'dash',
    stoneSkin: 'flex', quakeStomp: 'slam', tidePool: 'slam', riptide: 'nova',
  };
  var MOUTH = { fireball: 1, flameBreath: 1, bolt: 1, arcLash: 1, waterJet: 1 };

  function moveDef(f, build) {
    if (!f.mv) return null;
    var d = f.mv === 'sig' ? D.SIGNATURES[build.signature] : f.mv === 'ability' ? D.ABILITIES[build.ability] : D.MOVES[f.mv];
    return f.ex && d ? D.exVersion(d) : d;
  }

  /** { phase: 'startup'|'active'|'recovery', p: 0..1, def } for the current attack. */
  function attackPhase(f, build) {
    var def = moveDef(f, build);
    if (!def) return null;
    var t = f.mT;
    if (t < def.startup) return { phase: 'startup', p: t / def.startup, def: def };
    if (t < def.startup + def.active) return { phase: 'active', p: (t - def.startup) / Math.max(1, def.active), def: def };
    return { phase: 'recovery', p: (t - def.startup - def.active) / Math.max(1, def.recovery), def: def };
  }

  function attackKey(f, build, def) {
    if (f.mv === 'sig' || f.mv === 'ability') return SPECIAL_FAMILY[f.mv === 'sig' ? build.signature : build.ability] || 'breath';
    var anim = def.anim || 'claw';
    if (anim === 'claw') return def.kind === 'heavy' ? 'clawHeavy' : 'clawLight';
    return anim;
  }

  // ─────────────────────────── clips ───────────────────────────
  /**
   * Target pose for one fighter snapshot. x carries animator extras: { time, phase (run cycle), flipT, knock, aj }.
   * Returns { b: degrees pose, extras: {...} }.
   */
  function clip(f, build, x) {
    var t = x.time, T = f.stT, e = { wing: null, tailAngle: 0, tailSwing: 0.1, tailCurl: 0, mouth: 0, glow: 0, lean: 0, rot: 0, pivot: 0, dx: 0, dy: 0, sx: 1, sy: 1, idle: false, snap: 0.3 };
    var b = REST, s = f.st;
    var fwd = f.vx * f.fc;   // + moving the way the dragon faces
    if (s === 'idle' && Math.abs(f.vx) > 0.7) {
      // Braking: the sim is already idle but momentum is still sliding the dragon, so brace instead of standing
      b = P({ torso: -10, head: 6, nT: -30, nS: 8, fT: 20, fS: 26, hip: 3, nAU: -25, nAL: -20, fAU: 25, fAL: -20 });
      e.tailAngle = -0.25; e.snap = 0.5;
    } else if (s === 'idle' && x.fidget > 0) {
      // Idle variation every so often: a look over the shoulder and a tail flick, or a wing stretch
      var fk = Math.sin(Math.min(1, x.fidget) * Math.PI);
      b = x.fidgetKind ? P({ head: -22 * fk, torso: -6 * fk, nAU: -30 * fk, fAU: 40 * fk, nAL: -20 * fk, fAL: -20 * fk })
                       : P({ head: 18 * fk, torso: 4 * fk, nAU: 10 * fk, fAU: -8 * fk });
      e.wing = x.fidgetKind ? 0.15 + 0.85 * fk : 0.1; e.tailAngle = x.fidgetKind ? 0 : -0.6 * fk; e.tailSwing = 0.25; e.snap = 0.2;
    } else if (s === 'idle') {
      e.idle = true;
      b = P({ torso: Math.sin(t * 2.2) * 1.2, head: Math.sin(t * 2.2 + 0.6) * 1.5 });
    } else if (s === 'run' && fwd < -0.6) {
      // Direction reversal: the body has turned, momentum hasn't. Push off the back leg, lean into the new way.
      b = P({ torso: 22, head: -10, nT: -36, nS: 52, fT: 34, fS: 10, hip: 5, nAU: 40, nAL: -30, fAU: -35, fAL: -30 });
      e.tailAngle = 0.35; e.snap = 0.55; e.wing = 0.25;
    } else if (s === 'run') {
      var run = Math.abs(f.vx), amp = Math.max(0.35, Math.min(1, run / 5.5)), ph = x.phase;
      var sn = Math.sin(ph), cs = Math.cos(ph);
      var accel = T < 10 ? 1 - T / 10 : 0;   // first steps: deeper lean while accelerating
      b = P({ nT: -34 * sn * amp, nS: (8 + 48 * Math.max(0, cs)) * amp, fT: 34 * sn * amp, fS: (8 + 48 * Math.max(0, -cs)) * amp,
              nAU: 30 * sn * amp, nAL: -40 * amp, fAU: -30 * sn * amp, fAL: -40 * amp,
              torso: (6 + 10 * amp) + 10 * accel + 2 * Math.sin(ph * 2), head: -8 * amp - 6 * accel + Math.sin(ph * 2) * 2, hip: (3 * Math.abs(sn) - 1) * amp });
      e.tailAngle = -0.18 * amp; e.tailSwing = 0.28; e.wing = 0.04; e.scarf = 1;
    } else if (s === 'squat') {
      b = P({ hip: 9, nT: -34, nS: 56, fT: -24, fS: 48, torso: 16, head: 8, nAU: 25, nAL: -20, fAU: 20, fAL: -20 });
      e.snap = 0.7;
    } else if (s === 'air') {
      var gd = x.ground == null ? 999 : x.ground;
      if (x.recoverT > 0) {
        // Righting after knockback: tuck, then open up
        var rk = 1 - x.recoverT / 14;
        b = mixP(P(Object.assign({ torso: 30, head: 25, nAU: -60, nAL: -100, fAU: -50, fAL: -100 }, AIR_TUCK)), P({ nT: -20, nS: 30, fT: 10, fS: 20, nAU: -70, nAL: -20, fAU: 60, fAL: -15 }), ease(rk));
        e.wing = 0.4 + 0.6 * rk; e.snap = 0.5;
      } else if (x.flipT > 0) {
        // Air jump: a tucked somersault
        var k = 1 - x.flipT / 22;
        b = P(Object.assign({ torso: 25, head: 20, nAU: -50, nAL: -90, fAU: -40, fAL: -90 }, AIR_TUCK));
        e.rot = out(k) * Math.PI * 2; e.pivot = 0.5; e.wing = 1 - Math.abs(Math.sin(k * Math.PI * 2)) * 0.7; e.snap = 0.6;
      } else if (f.vy < -6 && T < 7) {
        // Takeoff: legs still extended from the push, arms reaching up
        b = P({ nT: 8, nS: 4, fT: 22, fS: 12, torso: -4, head: -16, nAU: -70, nAL: -30, fAU: -40, fAL: -30 });
        e.wing = 1 - T / 7 * 0.6; e.tailAngle = 0.3; e.snap = 0.7;
      } else if (f.vy < -2.5) {
        // Ascent: knees come up
        b = P({ nT: -55, nS: 78, fT: -22, fS: 55, torso: 4, head: -14, nAU: -40, nAL: -45, fAU: 32, fAL: -30 });
        e.wing = T < 16 ? 1 - Math.abs(Math.sin(T * 0.24)) : 0.6; e.tailAngle = -0.35;
      } else if (f.vy <= 2.5) {
        // Apex: a balanced, open shape with the wings spread
        b = P({ nT: -35, nS: 55, fT: -8, fS: 40, torso: 2, head: -4, nAU: -55, nAL: -25, fAU: 45, fAL: -20 });
        e.wing = 0.85; e.tailAngle = 0.05;
      } else if (gd < 48) {
        // About to land: legs reach for the ground, wings brake
        b = P({ nT: -16, nS: 8, fT: 8, fS: 6, torso: 6, head: 6, nAU: -45, nAL: -30, fAU: 35, fAL: -25 });
        e.wing = 0.9; e.tailAngle = -0.2; e.snap = 0.6;
      } else {
        var fall = Math.min(1, f.vy / 8);
        b = mixP(P({ nT: -30, nS: 50, fT: -5, fS: 35, nAU: -45, nAL: -30, fAU: 35, fAL: -20, head: 0 }),
                 P({ nT: -12, nS: 22, fT: 16, fS: 14, nAU: -60, nAL: -18, fAU: 50, fAL: -12, torso: 6, head: 8 }), fall);
        e.wing = 0.5 + Math.sin(t * 7) * 0.14 * (1 - fall) + 0.2 * fall; e.tailAngle = 0.25 * fall;
      }
      e.scarf = 0.9;
    } else if (s === 'land') {
      if (x.knock) {
        // Knocked down after a tumble: flat on the back, then a push-up to rise in the last frames
        var up = Math.max(0, 1 - f.stT / 18);
        b = P({ nAU: -30, nAL: -20, fAU: 20, fAL: -20, head: -20 * up, nT: -20, nS: 20, fT: 10, fS: 30 });
        e.rot = -1.45 * up; e.pivot = 0; e.dy = 0; e.snap = 0.5; e.wing = 0;
      } else {
        // Impact then recovery: deepest on the first frames, rising by the end of the landing lag
        var imp = Math.max(0, 1 - T / 7);
        b = mixP(P({ hip: 4, nT: -20, nS: 32, fT: -12, fS: 26, torso: 8, nAU: -10, fAU: 10 }), P({ hip: 13, nT: -50, nS: 80, fT: -34, fS: 68, torso: 22, head: -8, nAU: -22, nAL: -30, fAU: 18, fAL: -22 }), imp);
        e.snap = 0.8; e.wing = 0.3 * imp;
      }
    } else if (s === 'dodge') {
      var roll = Math.abs(f.vx) > 1.5 || (T >= 3 && T < 18 && x.dashing);
      if (roll) {
        var back = fwd < 0;
        if (T < 3) b = P({ hip: 8, torso: 20, head: 0, nAU: 20, fAU: 25, nT: -25, nS: 45, fT: 10, fS: 40 });           // startup
        else if (T < 18) b = back
          ? P({ hip: 6, torso: -18, head: 14, nAU: -40, nAL: -60, fAU: -30, fAL: -60, nT: -45, nS: 40, fT: -20, fS: 50 })  // hop back, guard up
          : P({ hip: 9, torso: 36, head: -28, nAU: 62, nAL: -20, fAU: 66, fAL: -20, nT: -42, nS: 58, fT: 34, fS: 30 });     // dash forward, arms swept back
        else b = mixP(P({ hip: 7, torso: 20, nT: -30, nS: 40, fT: 15, fS: 25 }), REST, (T - 18) / 8);                    // recovery
        e.tailAngle = back ? 0.4 : -0.45;
      } else {
        // Spot dodge: duck into a guard, hold, rise
        var g = P({ hip: 7, torso: -12, head: 12, nAU: -82, nAL: -98, fAU: -46, fAL: -105, nT: -18, nS: 34, fT: 12, fS: 28 });
        b = T < 3 ? mixP(REST, g, T / 3) : T < 18 ? g : mixP(g, REST, (T - 18) / 8);
      }
      e.snap = 0.6; e.wing = 0.25;
    } else if (s === 'airdodge') {
      b = P(Object.assign({ torso: 14, head: 12, nAU: -82, nAL: -98, fAU: -46, fAL: -105 }, AIR_TUCK));
      e.rot = Math.sin(T * 0.18) * 0.25; e.pivot = 0.5; e.wing = 0.85; e.snap = 0.55;
    } else if (s === 'ledge') {
      b = P({ nAU: -168, nAL: -10, fAU: -158, fAL: -12, torso: -4, head: -18, nT: 8 + Math.sin(t * 3) * 4, nS: 16, fT: -8, fS: 22 });
      e.dy = 38; e.wing = 0.55 + Math.sin(t * 4) * 0.08; e.tailAngle = 0.6; e.snap = 0.5;
    } else if (s === 'ledgeclimb') {
      b = P({ nAU: -110, nAL: -40, fAU: -100, fAL: -40, torso: 30, head: -10, nT: -60, nS: 80, fT: -40, fS: 70, hip: 6 });
      e.snap = 0.5;
    } else if (s === 'hitstun') {
      var away = f.vx * f.fc <= 0 ? 1 : -1;   // pushed backward (usual) or forward (hit from behind)
      if (f.tb) {
        var w = t * 18;
        b = P({ nAU: -60 + Math.sin(w) * 50, nAL: -30, fAU: 40 + Math.sin(w + 2) * 50, fAL: -30, nT: -30 + Math.sin(w + 1) * 30, nS: 40, fT: 20 + Math.sin(w + 3) * 30, fS: 35, head: -20, torso: 10 });
        e.rot = t * 14 * (f.vx >= 0 ? 1 : -1) * f.fc; e.pivot = 0.5; e.wing = 0.8; e.tailSwing = 0.5;
      } else {
        // Light hits flinch, heavy and counter hits snap the whole body back
        var rec = Math.max(0, 1 - T / 24), amp = Math.min(1.5, 0.75 + Math.abs(f.vx) / 10) * (f.hk === 'counter' ? 1.25 : 1);
        b = mixP(REST, P({ torso: -24 * away * amp, head: -32 * away * amp, nAU: -48 * amp, nAL: -30, fAU: -22 * amp, fAL: -40, nT: -20, nS: 32, fT: 12, fS: 22, hip: 3 }), 0.45 + 0.55 * rec);
        e.wing = 0.6; e.tailAngle = -0.5 * away; e.snap = T < 2 ? 0.9 : 0.35;
      }
    } else if (s === 'guard' || s === 'blockstun') {
      // Forearms crossed over the face, wings wrapped forward; deeper and lower when crouch-guarding
      var G = f.cg ? P({ hip: 15, torso: -6, head: 14, nAU: -84, nAL: -100, fAU: -50, fAL: -108, nT: -50, nS: 84, fT: -30, fS: 70 })
                   : P({ hip: 7, torso: -12, head: 12, nAU: -82, nAL: -98, fAU: -46, fAL: -105, nT: -18, nS: 34, fT: 12, fS: 28 });
      if (s === 'blockstun') {
        // Recoil from the blocked blow, settling back into the guard (feet stay planted; the sim slides the body)
        var bk = Math.max(0, 1 - T / 9);
        b = add(G, P({ torso: -14 * bk, head: 12 * bk, nAU: 10 * bk, fAU: 8 * bk }));
        e.snap = T < 2 ? 0.9 : 0.4; e.lean = -0.08 * bk;
      } else { b = add(G, P({ torso: Math.sin(t * 3) * 1.5 })); e.snap = 0.55; }
      e.wing = 0.15; e.tailAngle = 0.3;
    } else if (s === 'crawl') {
      // Low creep: the crouch with the legs and arms trading steps, body level
      var cp = x.phase, cs2 = Math.sin(cp), cc2 = Math.cos(cp);
      b = P({ hip: 15, nT: -50 + 18 * cs2, nS: 82 - 10 * Math.max(0, cc2), fT: -34 - 18 * cs2, fS: 68 - 10 * Math.max(0, -cc2), torso: 30, head: -14,
              nAU: -30 + 25 * cs2, nAL: -50, fAU: 10 - 25 * cs2, fAL: -40 });
      e.snap = 0.45; e.tailAngle = -0.3; e.tailSwing = 0.3; e.wing = 0.05;
    } else if (s === 'crouch') {
      b = P({ hip: 14, nT: -48, nS: 80, fT: -32, fS: 66, torso: 20 + Math.sin(t * 2.2) * 1.5, head: -6, nAU: -22, nAL: -42, fAU: 16, fAL: -32 });
      e.snap = 0.5; e.tailAngle = -0.2; e.wing = 0.1;
    } else if (s === 'stagger') {
      // Dizzy: the head and body loll in slow circles, arms hang
      var wob = Math.sin(t * 5), wob2 = Math.cos(t * 5);
      b = P({ torso: 6 + wob * 10, head: 16 + wob2 * 18, nAU: 25 + wob * 8, nAL: -10, fAU: -15 - wob * 8, fAL: -10, hip: 4, nT: -16, nS: 26, fT: 10, fS: 22 });
      e.lean = wob * 0.06; e.snap = 0.25; e.wing = 0.05; e.tailAngle = 0.5; e.mouth = 0.3;
    } else if (s === 'recoil') {
      if (x.afterThrow) {
        // Follow-through of a throw: the body keeps going the way the victim went, then settles
        var ft = Math.max(0, 1 - T / 12);
        b = mixP(REST, P({ torso: 26, head: 10, nAU: -80, nAL: -10, fAU: -62, fAL: -20, hip: 6, nT: -30, nS: 26, fT: 24, fS: 12 }), ft);
      } else b = P({ torso: -16, head: -18, nAU: -40, nAL: -40, fAU: -20, fAL: -40, hip: 4, nT: -22, nS: 30, fT: 14, fS: 22 });
      e.snap = 0.45; e.wing = 0.4;
    } else if (s === 'grabbed') {
      // Held up and struggling
      var st2 = Math.sin(t * 16);
      b = P({ torso: -18, head: -22 + st2 * 5, nAU: -120 + st2 * 25, nAL: -40, fAU: -100 - st2 * 25, fAL: -40, nT: 8 + st2 * 14, nS: 20, fT: -10 - st2 * 14, fS: 24 });
      e.dy = -8; e.wing = 0.7 + st2 * 0.2; e.tailSwing = 0.5; e.snap = 0.6;
    } else if (s === 'throwing') {
      // Holding the victim at arm's length, then winding back for the hurl
      var wk = Math.min(1, T / 18);
      b = P({ nAU: -78 + wk * 40, nAL: -30, fAU: -64 + wk * 36, fAL: -30, torso: 12 - wk * 30, head: 4 - wk * 14, hip: 5, nT: -24, nS: 30, fT: 20, fS: 18 });
      e.snap = 0.5; e.wing = 0.3 + wk * 0.4; e.tailAngle = 0.3 + wk * 0.4;
    } else if (s === 'down') {
      // Flat on the back: hits the floor, bounces a little, lies still breathing
      var bounce = T < 10 ? Math.sin(T / 10 * Math.PI) * 6 : 0;
      b = P({ nAU: -30, nAL: -20, fAU: 20, fAL: -20, head: -20 + Math.sin(t * 2) * 2, nT: -20, nS: 20, fT: 10, fS: 30 });
      e.rot = -1.45; e.pivot = 0; e.dy = -bounce; e.snap = 0.6; e.wing = 0; e.tailAngle = 0.6;
    } else if (s === 'getup') {
      if (f.gu === 'roll') {
        var rk2 = Math.min(1, T / 28);
        b = P(Object.assign({ torso: 30, head: 25, nAU: -60, nAL: -100, fAU: -50, fAL: -100 }, AIR_TUCK));
        e.rot = -1.45 + out(rk2) * (Math.PI * 2 + 1.45) * (f.vx * f.fc < 0 ? -1 : 1); e.pivot = 0.4; e.snap = 0.6; e.wing = 0.2;
      } else {
        // Push up off the floor and stand
        var up2 = ease(Math.min(1, T / 16));
        b = mixP(P({ nAU: -100, nAL: -40, fAU: -40, fAL: -40, head: -10, nT: -60, nS: 90, fT: -40, fS: 80, hip: 10, torso: 24 }), REST, up2);
        e.rot = -1.45 * (1 - up2); e.pivot = 0; e.snap = 0.6;
      }
    } else if (s === 'wallsplat') {
      // Flattened against the wall, limbs splayed, then peeling off
      var sp = Math.max(0, 1 - T / 6);
      b = P({ torso: -20, head: -26, nAU: -150, nAL: -10, fAU: 140, fAL: -10, nT: -30, nS: 10, fT: 30, fS: 10, hip: 2 });
      e.sx = 1 - 0.18 * sp; e.sy = 1 + 0.08 * sp; e.rot = 0.1 * (f.ws || 1); e.pivot = 0.5; e.snap = 0.9; e.wing = 1;
    } else if (s === 'taunt') {
      // A roar: rear up, arms wide, wings spread, mouth open at the peak
      var tk = Math.min(1, T / 14), roar = T > 14 && T < 40 ? 1 : 0;
      b = mixP(REST, P({ torso: -14, head: -36 + Math.sin(t * 30) * 2 * roar, nAU: -120, nAL: -30, fAU: 110, fAL: -30, hip: -2, nT: -10, nS: 14, fT: 10, fS: 8 }), ease(tk));
      e.mouth = roar ? 1 : 0.2 * tk; e.wing = 0.4 + 0.6 * tk; e.tailCurl = 0.6; e.snap = 0.4; e.glow = roar * 0.6;
    } else if (s === 'attack') {
      var a = attackPhase(f, build);
      if (a) {
        var key = attackKey(f, build, a.def), K = fitted(ATTACK[key] || ATTACK.clawLight, f.mv);
        var heavy = a.def.kind === 'heavy' || a.def.kind === 'super' || f.mv === 'sig' || f.mv === 'ability';
        // Anticipation eases into the windup (and squashes a little for heavies), the strike snaps out stretched,
        // momentum carries into the follow-through, then the body settles back to a ready stance.
        var sq = heavy ? 0.06 : 0.03;
        if (a.phase === 'startup') { b = mixP(REST, K.windup, out(a.p)); e.glow = heavy ? ease(a.p) : 0; e.snap = 0.45; e.sx = 1 + sq * ease(a.p); e.sy = 1 - sq * ease(a.p); }
        else if (a.phase === 'active') { b = K.strike; e.snap = 0.85; e.glow = heavy ? 1 : 0; var st3 = Math.max(0, 1 - a.p * 2); e.sx = 1 + sq * 0.6 * st3; e.sy = 1 + sq * 0.5 * st3; }
        else { b = a.p < 0.3 ? mixP(K.strike, K.follow, a.p / 0.3) : mixP(K.follow, REST, ease((a.p - 0.3) / 0.7)); e.snap = 0.35; e.glow = heavy ? 1 - a.p : 0; }
        if (f.ex || f.mv === 'ultimate') e.glow = Math.max(e.glow, 0.8);
        if (!f.gr && (key === 'clawLight' || key === 'clawHeavy' || key === 'breath' || key === 'throw')) b = add(b, P({ nT: -30, nS: 50, fT: -20, fS: 35, hip: -b.hip }));
        var sigKey = f.mv === 'sig' ? build.signature : f.mv === 'ability' ? build.ability : null;
        if (sigKey && MOUTH[sigKey]) e.mouth = a.phase === 'startup' ? ease(a.p) : a.phase === 'active' ? 1 : 1 - a.p;
        if (key === 'tail') {
          // The tail cocks up behind, then sweeps through a low arc in front over the active frames; hips turn with it
          e.tailAngle = a.phase === 'startup' ? 0.9 * ease(a.p) : a.phase === 'active' ? lerp(0.9, -1.9, out(a.p)) : lerp(-1.9, 0, ease(a.p));
          e.lean = a.phase === 'startup' ? -0.07 * ease(a.p) : a.phase === 'active' ? lerp(-0.07, 0.16, a.p) : lerp(0.16, 0, ease(a.p));
          e.tailSwing = 0.2;
        }
        if (key === 'spin' && a.phase === 'active') { e.rot = a.p * Math.PI * 2; e.pivot = 0.45; e.tailSwing = 0.5; e.wing = 0.85; }
        if (key === 'stomp' || key === 'burst') e.wing = a.phase === 'active' ? 1 - Math.abs(Math.sin(a.p * Math.PI * 2)) * 0.7 : 0.6;
        if (key === 'up') { e.dx = a.phase === 'startup' ? 4 * out(a.p) : a.phase === 'active' ? 7 : 7 * (1 - ease(a.p)); if (a.phase === 'active') e.wing = 0.9; }
        if (key === 'clawHeavy' || key === 'dash') e.dx = a.phase === 'active' ? 8 : a.phase === 'startup' ? -5 * out(a.p) : 8 * (1 - ease(a.p));
        if (key === 'whirl') b = add(b, P({ nAU: Math.sin(t * 20) * 40 }));
      }
    }
    if (f.sk) e.glow = Math.max(e.glow, 0.6);
    return { b: b, e: e };
  }

  // ─────────────────────────── real pack frames, when present ───────────────────────────
  // Gameplay state → the pack sheet that shows it. Only sheets processed into assets/warrior are used; for anything
  // else (and for jump, fall, land, ledge, air attacks: the pack has no such frames) the rig above is drawn.
  var PACK_FOR_KEY = { up: 'attack1', clawLight: 'attack2', clawHeavy: 'attack3', breath: 'attack4', throw: 'attack4', nova: 'attack4', push: 'attack4', flex: 'attack4', slam: 'attack4' };
  function packFor(f, build, x) {
    var A = (window.DCArt && window.DCArt.packAnims) || {};
    var s = f.st, T = f.stT, n;
    function span(name, k) { return { name: name, frame: Math.max(0, Math.min(A[name].frames - 1, Math.floor(k * A[name].frames))) }; }
    if (s === 'run' && f.vx * f.fc >= -0.6) {
      n = Math.abs(f.vx) < 3.5 && A.walk ? 'walk' : A.run ? 'run' : A.walk ? 'walk' : null;
      // The stride phase advances with distance travelled, so the painted feet don't slide
      if (n) { var c = (x.phase / (Math.PI * 2)) % 1; return span(n, c < 0 ? c + 1 : c); }
    }
    if (s === 'dodge') {
      if ((Math.abs(f.vx) > 1.5 || x.dashing) && A.run2) return span('run2', T / 26);
      if (A.defense) return span('defense', T / 26);
    }
    if (s === 'airdodge' && (A.defense2 || A.defense)) return span(A.defense2 ? 'defense2' : 'defense', T / 30);
    if (s === 'hitstun' && !f.tb && A.hurt) return span('hurt', Math.min(1, T / 24));
    if (s === 'attack' && (f.gr || f.mv === 'sig' || f.mv === 'ability')) {
      var a = attackPhase(f, build);
      if (!a) return null;
      n = PACK_FOR_KEY[attackKey(f, build, a.def)];
      if (!n || !A[n]) return null;
      // Time-stretch the sheet onto the move's real frame data: the painted impact lands on the first active frame
      var N = A[n].frames, I = Math.max(1, Math.min(N - 2, A[n].impact)), hold = Math.min(2, N - 1 - I), fr;
      if (a.phase === 'startup') fr = a.p * I;
      else if (a.phase === 'active') fr = I + a.p * hold;
      else fr = I + hold + a.p * (N - 1 - I - hold);
      return { name: n, frame: Math.floor(fr) };
    }
    return null;
  }

  // ─────────────────────────── per-dragon animator ───────────────────────────
  function Animator() {
    this.cur = null; this.extras = null; this.idleMix = 1; this.phase = 0; this.prev = null;
    this.flipT = 0; this.knock = false; this.blinkT = 2 + Math.random() * 3; this.blink = 0; this.wingV = 0.1;
  }

  /** f: fighter snapshot; dt in seconds. Returns a pose for DCArt.draw. */
  Animator.prototype.update = function (f, build, time, dt, env) {
    var prev = this.prev;
    if (f.st === 'run' || f.st === 'crawl') this.phase += Math.max(0.12, Math.abs(f.vx) * (f.st === 'crawl' ? 0.09 : 0.055)) * (dt * 60);
    if (prev && f.aj < prev.aj && f.st === 'air' && prev.st !== 'ledge') this.flipT = 22;   // spent an air jump
    if (this.flipT > 0) this.flipT -= dt * 60;
    if (f.st === 'land' && prev && prev.st === 'hitstun' && prev.tb) this.knock = true;
    if (f.st !== 'land') this.knock = false;
    if (prev && prev.st === 'hitstun' && f.st === 'air') this.recoverT = 14;
    if (this.recoverT > 0) this.recoverT -= dt * 60;
    if (f.st === 'dodge' && f.stT < 2) this.dashing = Math.abs(f.vx) > 1;
    if (f.st === 'recoil' && prev && prev.st === 'throwing') this.afterThrow = true;
    if (f.st !== 'recoil') this.afterThrow = false;
    // Idle variations: after a few calm seconds, a short fidget
    if (f.st === 'idle' && Math.abs(f.vx) < 0.3) {
      this.calm = (this.calm || 0) + dt;
      if (this.fidget > 0) { this.fidget += dt / 1.4; if (this.fidget >= 1) { this.fidget = 0; this.calm = 0; } }
      else if (this.calm > 6 + (this.fidgetSeed = this.fidgetSeed || Math.random() * 4)) { this.fidget = 0.001; this.fidgetKind = !this.fidgetKind; this.fidgetSeed = Math.random() * 4; }
    } else { this.calm = 0; this.fidget = 0; }
    // Turning around: a quick squash through the turn instead of an instant mirror
    if (prev && prev.fc != null && prev.fc !== f.fc && (f.st === 'idle' || f.st === 'run' || f.st === 'crouch' || f.st === 'guard')) this.turnT = 1;
    this.turnT = Math.max(0, (this.turnT || 0) - dt * 60 / 6);
    this.prev = { st: f.st, aj: f.aj, tb: f.tb, fc: f.fc };

    var c = clip(f, build, { time: time, phase: this.phase, flipT: this.flipT, knock: this.knock, recoverT: this.recoverT || 0, ground: env && env.ground, dashing: this.dashing,
                            afterThrow: this.afterThrow, fidget: this.fidget || 0, fidgetKind: this.fidgetKind });
    if (this.turnT > 0) { c.e.sx = (c.e.sx || 1) * (1 - 0.55 * Math.sin(this.turnT * Math.PI)); c.e.idle = false; }
    var k = 1 - Math.pow(1 - c.e.snap, dt * 60);
    var tgt = c.b;
    if (!this.cur) this.cur = JSON.parse(JSON.stringify(tgt));
    for (var key in tgt) this.cur[key] = lerp(this.cur[key], tgt[key], k);
    // The pack's idle frames and the rig are never crossfaded (two different drawings blended = a ghost). The rig
    // eases back to its rest pose, which IS idle frame 0, and only then hands over to the idle loop from frame 0.
    // Any action hands straight back to the rig, which starts from that same pose.
    if (!c.e.idle) this.idleMix = 0;
    else if (this.idleMix < 1) {
      var settled = Math.abs(this.cur.hip) < 1;
      for (var bk in this.cur) if (bk !== 'hip' && Math.abs(this.cur[bk]) > 2.5) settled = false;
      if (settled) { this.idleMix = 1; this.idleStart = time; }
    }
    // Blinks every few seconds
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blink = 1; this.blinkT = 2.5 + Math.random() * 3.5; }
    this.blink = Math.max(0, this.blink - dt * 7);
    // Secondary motion: wings settle with a little lag
    var wingT = c.e.wing != null ? c.e.wing : 0.08 + Math.sin(time * 2.2) * 0.04;
    this.wingV = lerp(this.wingV, wingT, 1 - Math.pow(0.6, dt * 60));
    var out = toPose(this.cur, c.e, f, build, time, this.idleMix, this.blink > 0 ? Math.min(1, this.blink * 2) : 0, this.wingV);
    var pk = packFor(f, build, { phase: this.phase, dashing: this.dashing });
    if (pk) this.lastPack = pk;
    if (build.look.sprite && window.DCSprites) {
      out.spr = (this.spr || (this.spr = new window.DCSprites.Tracker())).update(build.look.sprite, f, build, time, dt, { force: env && env.force, knock: this.knock, dashing: this.dashing });
    }
    // Pack frames are complete drawings too: switch, never blend
    this.animMix = pk ? 1 : 0;
    out.anim = pk; out.animMix = this.animMix;
    if (this.idleMix === 1) out.frame = Math.floor((time - (this.idleStart || 0)) * (window.DCArt ? DCArt.rig.fps : 10));
    // Hit flash: only the first few frames of the hit-stop, so the victim stays readable
    if (f.hl > (this.lastHl || 0) && f.st === 'hitstun') this.flashT = 4;
    this.lastHl = f.hl;
    this.flashT = Math.max(0, (this.flashT || 0) - dt * 60);
    out.flash = this.flashT > 0 ? 0.45 * this.flashT / 4 : 0;
    // Foot contact: on the ground, the lowest foot of the posed rig sits exactly on the floor (crouches lower the
    // body instead of floating, strides keep a planted foot). Rotations (spins, knockdowns) are left alone.
    if (f.gr && this.idleMix < 1 && !out.rot && f.st !== 'ledgeclimb' && window.DCArt && DCArt.pointOf) {
      var dy0 = out.dy; out.dy = 0;
      var fa = DCArt.pointOf('nearFoot', build.body, out), fb = DCArt.pointOf('farFoot', build.body, out);
      out.dy = lerp(dy0, -Math.max(fa[1], fb[1]), (1 - this.idleMix) * (1 - this.animMix));
    }
    return out;
  };

  function toPose(b, e, f, build, time, idleMix, blink, wing) {
    var bones = {};
    BONES.forEach(function (n) { bones[n] = b[n] * R; });
    return { time: time, facing: f.fc, element: build.element, bones: bones, hip: b.hip, idleMix: idleMix,
             lean: e.lean, rot: e.rot, pivot: e.pivot, sx: e.sx, sy: e.sy, dx: e.dx, dy: e.dy,
             wing: wing, tailAngle: e.tailAngle + (f.vy || 0) * -0.012, tailSwing: e.tailSwing, tailCurl: e.tailCurl, mouth: e.mouth, glow: e.glow,
             blink: blink, scarf: e.scarf != null ? e.scarf : 0.3, flash: f.st === 'hitstun' && f.hl > 0 ? 0.45 : 0, alpha: 1 };
  }

  function x2phase(f) { return f.stT * Math.max(0.12, Math.abs(f.vx) * 0.055); }

  /** Stateless pose for one snapshot (no blending). Used by anything without an Animator. */
  function pose(f, build, time) {
    var c = clip(f, build, { time: time, phase: f.stT * 0.3, flipT: 0, knock: false });
    var p = toPose(c.b, c.e, f, build, time, c.e.idle ? 1 : 0, 0, c.e.wing);
    var pk = packFor(f, build, { phase: x2phase(f), dashing: Math.abs(f.vx) > 1.5 });
    if (pk) { p.anim = pk; p.animMix = 1; }
    if (f.st === 'dodge' || f.st === 'airdodge') p.alpha = 0.55;
    return p;
  }

  // ─────────────────────────── menus, forge, results ───────────────────────────
  var DEMO_MOVES = { attack: 'fsmash', light: 'jab', spin: 'dsmash', up: 'usmash', tail: 'dtilt' };
  /** Looping demo poses driven through the same clips as a real fight. */
  function showcase(kind, build, time, facing) {
    var f = { st: 'idle', stT: 0, fc: facing || 1, vx: 0, vy: 0, gr: true, mv: null, mT: 0, hl: 0, tb: false, aj: 1 };
    var extra = {};
    if (kind === 'run') { f.st = 'run'; f.vx = 6; f.stT = time * 60; }
    else if (kind === 'jump') {
      var c = (time % 1.6) / 1.6;
      if (c < 0.08) { f.st = 'squat'; }
      else if (c < 0.85) { f.st = 'air'; f.gr = false; f.stT = (c - 0.08) * 96; f.vy = -12 + (c - 0.08) * 32; extra.dy = -Math.sin((c - 0.08) / 0.77 * Math.PI) * 80; }
      else { f.st = 'land'; f.stT = (c - 0.85) * 96; }
    } else if (DEMO_MOVES[kind] || kind === 'special') {
      var mv = DEMO_MOVES[kind] || 'sig';
      var def = mv === 'sig' ? D.SIGNATURES[build.signature] : D.MOVES[mv];
      var total = def.startup + def.active + def.recovery + 30;
      var tt = (time * 60) % total;
      if (tt < def.startup + def.active + def.recovery) { f.st = 'attack'; f.mv = mv; f.mT = tt; }
    } else if (kind === 'hit') {
      var h = (time * 60) % 60;
      f.st = h < 26 ? 'hitstun' : 'idle'; f.stT = h; f.hl = h < 6 ? 1 : 0; f.vx = -3 * f.fc;
    }
    var p;
    if (kind === 'victory' || kind === 'defeat') {
      var b = kind === 'victory'
        ? P({ nAU: -150 + Math.sin(time * 5) * 8, nAL: -20, fAU: -140 + Math.sin(time * 5 + 1) * 8, fAL: -25, head: -32, torso: -8, hip: Math.max(0, Math.sin(time * 5)) * -2 })
        : P({ hip: 22, torso: 36, head: 30, nAU: -12, nAL: -20, fAU: 10, fAL: -20, nT: -85, nS: 108, fT: -60, fS: 96 });
      p = toPose(b, { wing: kind === 'victory' ? 0.6 + 0.4 * Math.sin(time * 5) : 0, tailAngle: kind === 'victory' ? -0.2 : 0.5, tailSwing: 0.12, tailCurl: kind === 'victory' ? 0.6 : 0,
                      mouth: kind === 'victory' ? 0.5 + 0.5 * Math.sin(time * 3) : 0, glow: 0, rot: 0, pivot: 0, dx: 0, dy: kind === 'defeat' ? 4 : 0, sx: 1, sy: 1, lean: 0 }, f, build, time, 0, 0, null);
    } else p = pose(f, build, time);
    if (extra.dy) p.dy = (p.dy || 0) + extra.dy;
    if (kind === 'idle') p.idleMix = 1;
    if (build.look.sprite && window.DCSprites && kind !== 'idle') p.spr = window.DCSprites.Tracker.showcase(kind, time);
    return p;
  }

  window.DCAnim = { packFor: packFor, pose: pose, clip: clip, Animator: Animator, attackPhase: attackPhase, moveDef: moveDef, showcase: showcase, attackKey: attackKey };
})();
