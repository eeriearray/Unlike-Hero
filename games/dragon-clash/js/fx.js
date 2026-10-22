/*
 * Dragon Clash — visual effects and arenas.
 * Particles, projectiles, attack trails, elemental specials, hit sparks, KO blasts and the arena backdrops.
 * Effects are bright but short and capped, so the dragons stay readable.
 */
(function () {
  'use strict';
  var D = window.DC.Data, Art = window.DCArt;
  var FXanim;
  function gearImg(name) { var g = Art && Art.gearImgs; return g ? g['fx-' + name] : null; }
  /** Plays a painted effect sheet once if its frames are loaded; false means fall back to drawn particles. */
  FXanim = function (fx, name, n, x, y, w, h, life, o) {
    if (!gearImg(name + '-1')) return false;
    var p = { type: 'anim', name: name, n: n, x: x, y: y, w: w, h: h, vx: 0, vy: 0, life: life, drag: 1 };
    for (var k in o || {}) p[k] = o[k];
    fx.add(p); return true;
  };
  var TAU = Math.PI * 2;
  var MAX_PARTICLES = 700;

  function el(id) { return D.ELEMENTS[id] || { color: '#ffffff', glow: '#ffffff', dark: '#444444' }; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function FX() { this.parts = []; this.shake = 0; this.flash = 0; this.popups = []; }

  FX.prototype.add = function (p) {
    // Low effects setting: half the particles, a smaller cap
    if (this.low && (this.parts.length >= MAX_PARTICLES / 2 || ((this.lowN = (this.lowN || 0) + 1) & 1))) return;
    if (this.parts.length >= MAX_PARTICLES) this.parts.shift();
    p.life = p.life || 30; p.max = p.life; p.size = p.size || 4; p.drag = p.drag != null ? p.drag : 0.94; p.grav = p.grav || 0;
    this.parts.push(p);
  };

  FX.prototype.burst = function (x, y, n, o) {
    for (var i = 0; i < n; i++) {
      var a = o.angle != null ? o.angle + rnd(-o.spread || -0.6, o.spread || 0.6) : rnd(0, TAU);
      var s = rnd(o.speed * 0.4, o.speed);
      this.add({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(o.life * 0.6, o.life), size: rnd(o.size * 0.6, o.size),
                 color: o.colors[i % o.colors.length], type: o.type || 'dot', grav: o.grav || 0, drag: o.drag });
    }
  };

  FX.prototype.ring = function (x, y, r, color, life, width) {
    this.add({ x: x, y: y, vx: 0, vy: 0, life: life || 18, size: r, color: color, type: 'ring', width: width || 4, drag: 1 });
  };

  FX.prototype.addShake = function (v, settings) { this.shake = Math.min(14, Math.max(this.shake, v * ((settings && settings.shake) != null ? settings.shake : 1))); };

  /** Turn a simulation event into effects. */
  FX.prototype.onEvent = function (e, fighters, settings) {
    var c;
    switch (e.type) {
      case 'hit':
        this.impact(e);
        this.strike(e);
        // Mass comes from hitstop, recoil and sound; the screen only shakes for the big ones
        this.addShake(e.strength === 'super' ? 10 : e.kb > 12 ? Math.min(8, (e.kb - 10) * 0.45) : e.counter && e.strength === 'heavy' ? 3 : 0, settings);
        if (e.mult > 1) this.popup(e.x, e.y - 46, '▲', el(e.element).color);
        if (e.mult < 1) this.popup(e.x, e.y - 46, '▼', '#9aa3b8');
        break;
      case 'ko':
        var f = fighters && fighters[e.f];
        c = f ? el(f.build.element) : el('fire');
        var ang = Math.atan2(800 / 2 - e.y, 1600 / 2 - e.x);
        this.burst(e.x, e.y, 60, { angle: ang, spread: 0.5, speed: 26, life: 50, size: 7, colors: [c.glow, c.color, '#ffffff'], type: 'spark', drag: 0.95 });
        this.add({ x: e.x, y: e.y, vx: Math.cos(ang), vy: Math.sin(ang), life: 40, size: 1, color: c.color, type: 'beam', drag: 1 });
        this.ring(e.x, e.y, 140, c.glow, 26, 10);
        this.addShake(9, settings);
        this.flash = 0.35;
        break;
      case 'land':
        this.dust(e.x, e.y, e.hard ? 8 : 4, 18, 0);
        if (e.hard) this.burst(e.x, e.y, 10, { angle: -Math.PI / 2, spread: 1.5, speed: 4, life: 24, size: 7, colors: ['rgba(230,220,200,0.6)'], type: 'smoke', grav: -0.02 });
        break;
      case 'jump':
        if (e.burst) this.ring(e.x, e.y - 60, 60, 'rgba(255,255,255,0.8)', 16, 5);
        else if (e.air) this.ring(e.x, e.y - 10, 34, 'rgba(255,255,255,0.6)', 12, 3);
        else this.burst(e.x, e.y, 8, { angle: -Math.PI / 2, spread: 1.4, speed: 3, life: 20, size: 6, colors: ['rgba(230,220,200,0.55)'], type: 'smoke' });
        break;
      case 'spawn':
        c = el(e.element);
        this.burst(e.x, e.y, 10, { speed: 4, life: 14, size: 4, colors: [c.glow, c.color], type: 'dot' });
        break;
      case 'rule':
        var lbl = { melt: 'MELT', extinguish: 'DOUSE', conduct: 'ARC', grounded: 'GROUNDED', clash: 'CLASH', absorb: 'ABSORB' }[e.rule];
        if (lbl) this.popup(e.x, e.y - 20, lbl, e.rule === 'clash' ? '#ffffff' : '#ffe9a8');
        this.burst(e.x, e.y, 14, { speed: 5, life: 22, size: 4, colors: ['#ffffff', '#cfefff', '#ffd36a'], type: 'spark' });
        break;
      case 'break':
        c = el(e.element);
        this.burst(e.x, e.y, 18, { speed: 6, life: 30, size: 7, colors: [c.glow, c.color, '#ffffff'], type: 'shard', grav: 0.3 });
        break;
      case 'pop':
      case 'fade':
        if (e.kind === 'puddle' || e.kind === 'flames' || e.kind === 'chillField') break;
        c = el(e.element);
        this.burst(e.x, e.y, 8, { speed: 3, life: 16, size: 4, colors: [c.glow, c.color], type: 'dot' });
        break;
      case 'tech':
        this.ring(e.x, e.y - 40, 50, '#ffffff', 14, 4);
        break;
      case 'respawn':
        this.add({ x: e.x, y: e.y, vx: 0, vy: 0, life: 40, size: 70, color: 'rgba(255,255,255,0.7)', type: 'pillar', drag: 1 });
        break;
      case 'burnTick':
        this.burst(e.x, e.y, 4, { angle: -Math.PI / 2, spread: 0.6, speed: 2.5, life: 22, size: 4, colors: ['#ff6a2a', '#ffcf4a'], type: 'dot' });
        break;
      case 'blink':
        c = el(e.element);
        this.add({ x: e.x0, y: e.y0 - 70, x2: e.x1, y2: e.y1 - 70, vx: 0, vy: 0, life: 14, size: 3, color: c.color, type: 'bolt', drag: 1 });
        break;
      case 'structure':
        c = el(e.element);
        this.burst(e.x, e.y - 50, 16, { speed: 4, life: 20, size: 5, colors: [c.glow, '#ffffff'], type: 'shard' });
        break;
      case 'buff':
        this.ring(e.x, e.y - 64, 70, '#d8b07a', 22, 7);
        this.burst(e.x, e.y - 60, 14, { speed: 4, life: 26, size: 6, colors: ['#a0794a', '#d8c08a'], type: 'shard', grav: 0.25 });
        break;
      case 'gear': {
        var y = e.y - 70;
        if (e.ability === 'fade') this.burst(e.x, y, 18, { speed: 3, life: 30, size: 9, colors: ['rgba(200,220,255,0.35)', 'rgba(160,180,220,0.3)'], type: 'smoke', grav: -0.03 });
        else if (e.ability === 'aegis') { this.ring(e.x, y, 90, '#ffe08a', 20, 6); this.burst(e.x, y, 12, { speed: 5, life: 20, size: 4, colors: ['#fff6cf', '#ffd36a'], type: 'spark' }); }
        else if (e.ability === 'phase' && FXanim(this, 'phase', 7, e.x, y, 200, 200, 22, { flip: e.facing < 0 })) { /* painted */ }
        else if (e.ability === 'phase') { this.ring(e.x, y, 60, '#cfe8ff', 14, 4); this.burst(e.x, y, 16, { angle: e.facing > 0 ? Math.PI : 0, spread: 0.5, speed: 9, life: 16, size: 4, colors: ['#ffffff', '#9fd0ff'], type: 'spark' }); }
        else if (e.ability === 'decoy' && FXanim(this, 'decoy-pop', 6, e.x, y, 170, 170, 24)) { /* painted */ }
        else if (e.ability === 'decoy') this.burst(e.x, y, 20, { speed: 4, life: 28, size: 10, colors: ['rgba(220,210,240,0.5)', 'rgba(180,170,210,0.4)'], type: 'smoke', grav: -0.02 });
        else if (e.ability === 'rage') { this.ring(e.x, y, 100, '#ff4a2a', 22, 8); this.burst(e.x, y, 20, { speed: 7, life: 24, size: 5, colors: ['#ff4a2a', '#ffb02e', '#ffffff'], type: 'spark' }); this.addShake(3, settings); }
        else if (e.ability === 'gust' && FXanim(this, 'gust', 8, e.x + e.facing * 150, y, 300, 150, 26, { flip: e.facing < 0 })) { /* painted */ }
        else if (e.ability === 'gust') {
          var dir = e.facing > 0 ? 0 : Math.PI;
          this.burst(e.x + e.facing * 40, y, 26, { angle: dir, spread: 0.35, speed: 16, life: 22, size: 12, colors: ['rgba(235,245,255,0.55)', 'rgba(200,225,255,0.4)'], type: 'smoke', drag: 0.9 });
          this.burst(e.x + e.facing * 40, y, 12, { angle: dir, spread: 0.25, speed: 20, life: 14, size: 3, colors: ['#ffffff'], type: 'spark' });
        }
        break;
      }
      case 'absorb':
        if (!FXanim(this, 'aegis-break', 8, e.x, e.y, 260, 260, 28)) this.ring(e.x, e.y, 110, '#fff2b0', 18, 9);
        this.burst(e.x, e.y, 24, { speed: 9, life: 26, size: 6, colors: ['#ffe08a', '#fff6cf', '#ffffff'], type: 'shard', grav: 0.2 });
        this.popup(e.x, e.y - 40, 'BLOCKED', '#ffe08a');
        this.addShake(4, settings);
        break;
      case 'decoyPop':
        FXanim(this, 'decoy-pop', 6, e.x, e.y, 220, 220, 26);
        this.burst(e.x, e.y, 26, { speed: 6, life: 30, size: 11, colors: ['rgba(220,210,240,0.6)', 'rgba(255,255,255,0.5)'], type: 'smoke', grav: -0.02 });
        this.ring(e.x, e.y, 80, '#e6dcff', 16, 5);
        this.popup(e.x, e.y - 40, 'DECOY', '#e6dcff');
        break;
      case 'decoyGone':
        this.burst(e.x, e.y - 60, 12, { speed: 2.5, life: 26, size: 9, colors: ['rgba(220,210,240,0.4)'], type: 'smoke', grav: -0.03 });
        break;
      case 'unfade':
        this.burst(e.x, e.y - 70, 10, { speed: 3, life: 16, size: 3, colors: ['#cfe8ff', '#ffffff'], type: 'spark' });
        break;
      case 'block': {
        // A hex shield spark facing the blow; heavier blocks throw more
        var n = e.heavy ? 14 : 8, col = e.guard < 0.3 ? '#ff8a5a' : '#bfe8ff';
        this.add({ x: e.x, y: e.y, vx: 0, vy: 0, life: 10, size: e.heavy ? 34 : 24, color: col, type: 'hex', drag: 1 });
        this.burst(e.x, e.y, n, { speed: e.heavy ? 7 : 5, life: 14, size: 3, colors: [col, '#ffffff'], type: 'spark', drag: 0.85 });
        if (e.heavy) this.addShake(2, settings);
        break;
      }
      case 'parry':
        this.add({ x: e.x, y: e.y, vx: 0, vy: 0, life: 16, size: 70, color: '#ffffff', type: 'glint', drag: 1 });
        this.ring(e.x, e.y, 60, '#bff6ff', 16, 6); this.ring(e.x, e.y, 100, 'rgba(255,255,255,0.7)', 22, 3);
        this.burst(e.x, e.y, 18, { speed: 10, life: 16, size: 3, colors: ['#ffffff', '#bff6ff'], type: 'spark', drag: 0.84 });
        this.flash = Math.max(this.flash, 0.18);
        break;
      case 'guardBreak':
        this.burst(e.x, e.y, 28, { speed: 9, life: 34, size: 9, colors: ['#bfe8ff', '#ffffff', '#ff9a3a'], type: 'shard', grav: 0.3 });
        this.ring(e.x, e.y, 120, '#ff9a3a', 22, 8);
        this.popup(e.x, e.y - 50, 'BREAK!', '#ff9a3a');
        this.addShake(6, settings); this.flash = Math.max(this.flash, 0.15);
        break;
      case 'grab': this.ring(e.x, e.y, 40, 'rgba(255,255,255,0.8)', 10, 4); break;
      case 'throw':
        this.burst(e.x, e.y, 10, { speed: 6, life: 18, size: 4, colors: ['#ffffff'], type: 'spark' });
        this.addShake(3, settings);
        break;
      case 'throwBreak':
        this.ring(e.x, e.y, 70, '#e6dcff', 16, 5);
        this.burst(e.x, e.y, 14, { speed: 8, life: 14, size: 3, colors: ['#ffffff', '#e6dcff'], type: 'spark', drag: 0.85 });
        break;
      case 'wallsplat':
        // Cracks spider out on the wall where the dragon hit, with dust falling off it
        this.add({ x: e.x, y: e.y, vx: 0, vy: 0, life: 90, size: 46, color: 'rgba(40,24,16,0.85)', type: 'crack', drag: 1, side: e.side, seed: Math.random() * 1000 });
        this.burst(e.x, e.y, 16, { angle: e.side < 0 ? 0 : Math.PI, spread: 1.2, speed: 6, life: 30, size: 5, colors: ['#c8a878', '#8a6a4a'], type: 'rock', grav: 0.35 });
        this.dust(e.x, e.y + 40, 6, 20, -e.side);
        this.addShake(6, settings);
        break;
      case 'knockdown':
        this.dust(e.x, e.y, e.hard ? 12 : 8, 40, 0);
        this.addShake(e.hard ? 4 : 2, settings);
        break;
      case 'getup': if (e.how === 'roll') this.dust(e.x, e.y, 6, 16, 0); break;
      case 'walljump':
        this.ring(e.x - e.side * 20, e.y - 70, 40, 'rgba(255,255,255,0.75)', 12, 3);
        this.dust(e.x - e.side * 22, e.y - 60, 6, 10, -e.side);
        break;
      case 'burst':
        this.ring(e.x, e.y, 150, '#9fdcff', 24, 9); this.ring(e.x, e.y, 90, '#ffffff', 16, 4);
        this.burst(e.x, e.y, 24, { speed: 11, life: 20, size: 4, colors: ['#ffffff', '#9fdcff'], type: 'spark', drag: 0.86 });
        break;
      case 'armor': this.ring(e.x, e.y, 54, '#ffb03a', 10, 5); break;
      case 'taunt': {
        // A small element emote: flame puff, snowflakes, sparks, pebbles or bubbles
        var fe = fighters && fighters[e.f] && fighters[e.f].build.element, ec = el(fe);
        var ty = fe === 'earth' ? 'rock' : fe === 'ice' ? 'shard' : fe === 'water' ? 'drop' : 'dot';
        this.burst(e.x, e.y - 130, 16, { angle: -Math.PI / 2, spread: 1.1, speed: 4, life: 40, size: fe === 'earth' ? 5 : 4, colors: [ec.color, ec.glow, '#ffffff'], type: ty, grav: fe === 'fire' || fe === 'lightning' ? -0.04 : 0.12 });
        break;
      }
      case 'super':
        this.ring(e.x, e.y - 80, 220, el(e.element).glow, 30, 10);
        this.flash = Math.max(this.flash, 0.3);
        break;
      case 'superGo': this.addShake(8, settings); break;
      case 'attack':
        // Wing-burst gust handled on jump; nothing here.
        break;
    }
  };

  /** The strike itself, on top of the element impact: sized and coloured by strength, gold for counter hits. */
  FX.prototype.strike = function (e) {
    var x = e.x, y = e.y, st = e.strength || 'light';
    var size = { light: 18, medium: 28, heavy: 42, super: 70 }[st] || 18;
    if (e.counter) {
      this.add({ x: x, y: y, vx: 0, vy: 0, life: 12, size: size * 1.4, color: '#ffcf4a', type: 'star', drag: 1, rotA: Math.random() });
      this.ring(x, y, size * 2.2, '#ffcf4a', 14, 5); this.ring(x, y, size * 1.3, '#ffffff', 10, 3);
    }
    if (st === 'heavy' || st === 'super') {
      // Heavy: a hard white flash at the contact point and a shockwave ring that travels with the launch
      this.add({ x: x, y: y, vx: 0, vy: 0, life: 6, size: size * 1.6, color: '#ffffff', type: 'flare', drag: 1 });
      this.ring(x, y, size * 2.6, 'rgba(255,255,255,0.9)', 14, st === 'super' ? 10 : 6);
      if (st === 'super') this.flash = Math.max(this.flash, 0.4);
    } else if (st === 'medium') {
      this.ring(x, y, size * 1.6, 'rgba(255,255,255,0.75)', 10, 4);
    }
  };

  /** Each element has its own impact, not a recoloured spark burst. Size follows knockback; effects stay short. */
  FX.prototype.impact = function (e) {
    var kb = e.kb, k = Math.min(1.6, 0.6 + kb / 16), x = e.x, y = e.y;
    var ang = -e.angle * Math.PI / 180, dir = e.dir || 1;
    var hx = Math.cos(ang) * dir, hy = Math.sin(ang);          // launch direction
    var i;
    // Every hit: a short directional streak burst along the launch, so you can read where it sends you
    for (i = 0; i < 4 + Math.round(kb / 4); i++) {
      var a = Math.atan2(hy, hx) + rnd(-0.5, 0.5), sp = rnd(6, 11) * k;
      this.add({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(8, 13), size: rnd(3, 5) * k, color: '#ffffff', type: 'spark', drag: 0.84 });
    }
    switch (e.element) {
      case 'fire':
        this.add({ x: x, y: y, vx: 0, vy: 0, life: 10, size: 46 * k, color: '#ff8a2a', type: 'flare', drag: 1 });
        for (i = 0; i < 10 * k; i++) this.add({ x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: rnd(-2.5, 2.5) + hx * 2, vy: rnd(-3.5, -0.5), life: rnd(18, 30), size: rnd(9, 15) * k, color: '#ff7a2f', type: 'flame', drag: 0.92, grav: -0.06 });
        for (i = 0; i < 12 * k; i++) this.add({ x: x, y: y, vx: rnd(-5, 5) + hx * 3, vy: rnd(-6, 1), life: rnd(22, 40), size: rnd(1.5, 3), color: Math.random() < 0.5 ? '#ffcf4a' : '#ff6a2a', type: 'ember', drag: 0.95, grav: -0.03 });
        break;
      case 'ice':
        this.add({ x: x, y: y, vx: 0, vy: 0, life: 14, size: 34 * k, color: '#e8fbff', type: 'frostStar', drag: 1 });
        for (i = 0; i < 12 * k; i++) { var ia = rnd(0, TAU), is = rnd(3, 8) * k; this.add({ x: x, y: y, vx: Math.cos(ia) * is + hx * 2, vy: Math.sin(ia) * is, life: rnd(20, 34), size: rnd(4, 8) * k, color: i % 3 ? '#bff6ff' : '#ffffff', type: 'shard', drag: 0.93, grav: 0.22 }); }
        this.burst(x, y, 10, { speed: 2, life: 30, size: 3, colors: ['#e8fbff'], type: 'dot', drag: 0.96 });
        break;
      case 'lightning':
        this.flash = Math.max(this.flash, 0.12 * k);
        for (i = 0; i < 5; i++) { var la = rnd(0, TAU), ll = rnd(30, 60) * k; this.add({ x: x, y: y, x2: x + Math.cos(la) * ll, y2: y + Math.sin(la) * ll, vx: 0, vy: 0, life: rnd(6, 10), size: 2.5, color: i % 2 ? '#ffe14a' : '#b48cff', type: 'bolt', drag: 1 }); }
        this.add({ x: x, y: y, vx: 0, vy: 0, life: 6, size: 40 * k, color: '#fff6a8', type: 'flare', drag: 1 });
        this.burst(x, y, 10, { speed: 9 * k, life: 10, size: 2.5, colors: ['#ffffff', '#ffe14a'], type: 'spark', drag: 0.8 });
        break;
      case 'earth':
        for (i = 0; i < 9 * k; i++) { var ra = Math.atan2(hy, hx) + rnd(-1.2, 1.2), rs = rnd(3, 8) * k; this.add({ x: x, y: y, vx: Math.cos(ra) * rs, vy: Math.sin(ra) * rs - 2, life: rnd(26, 40), size: rnd(4, 9) * k, color: i % 2 ? '#8a6a4a' : '#a0794a', type: 'rock', drag: 0.97, grav: 0.38, spin: rnd(-0.3, 0.3) }); }
        for (i = 0; i < 7; i++) this.add({ x: x + rnd(-12, 12), y: y + rnd(-6, 12), vx: rnd(-1.5, 1.5), vy: rnd(-1.2, 0), life: rnd(30, 46), size: rnd(10, 18) * k, color: 'rgba(196,160,110,0.5)', type: 'smoke', drag: 0.95, grav: -0.01 });
        break;
      case 'water':
        this.add({ x: x, y: y, vx: 0, vy: 0, life: 18, size: 30 * k, color: '#a8fff4', type: 'ripple', drag: 1 });
        for (i = 0; i < 16 * k; i++) { var wa = -Math.PI / 2 + rnd(-1.4, 1.4) + hx * 0.4, ws = rnd(3, 8) * k; this.add({ x: x, y: y, vx: Math.cos(wa) * ws, vy: Math.sin(wa) * ws, life: rnd(22, 36), size: rnd(2.5, 4.5), color: i % 3 ? '#8ff5ff' : '#ffffff', type: 'drop', drag: 0.98, grav: 0.32 }); }
        this.burst(x, y, 6, { speed: 1.5, life: 30, size: 12, colors: ['rgba(168,255,244,0.35)'], type: 'smoke' });
        break;
      default:
        // Physical: a white star and a small ring
        this.add({ x: x, y: y, vx: 0, vy: 0, life: 7, size: 26 * k, color: '#ffffff', type: 'star', drag: 1, rotA: rnd(0, 1) });
        this.ring(x, y, 12 + kb * 1.6, 'rgba(255,255,255,0.8)', 10, e.heavy ? 5 : 3);
    }
  };

  /** Feet dust: a small puff, for footfalls, dashes and landings. */
  FX.prototype.dust = function (x, y, n, spread, dir) {
    for (var i = 0; i < n; i++) this.add({ x: x + rnd(-spread, spread), y: y - 2, vx: rnd(-1.2, 1.2) + (dir || 0) * rnd(0.5, 2), vy: rnd(-1.4, -0.3), life: rnd(16, 26), size: rnd(4, 8), color: 'rgba(225,215,200,0.45)', type: 'smoke', drag: 0.93, grav: -0.01 });
  };

  FX.prototype.popup = function (x, y, text, color) {
    this.popups.push({ x: x, y: y, text: text, color: color, life: 40 });
    if (this.popups.length > 12) this.popups.shift();
  };

  FX.prototype.update = function () {
    var ps = this.parts;
    for (var i = ps.length - 1; i >= 0; i--) {
      var p = ps[i];
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.grav;
      p.x += p.vx; p.y += p.vy;
      if (--p.life <= 0) ps.splice(i, 1);
    }
    for (i = this.popups.length - 1; i >= 0; i--) { this.popups[i].y -= 0.8; if (--this.popups[i].life <= 0) this.popups.splice(i, 1); }
    this.shake *= 0.82; if (this.shake < 0.2) this.shake = 0;
    this.flash *= 0.85;
  };

  FX.prototype.draw = function (x) {
    var ps = this.parts;
    x.save();
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i], k = p.life / p.max;
      x.globalAlpha = Math.min(1, k * 1.4);
      switch (p.type) {
        case 'spark':
          x.strokeStyle = p.color; x.lineWidth = p.size * 0.6; x.lineCap = 'round';
          x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); x.stroke();
          break;
        case 'dot':
          x.fillStyle = p.color; x.beginPath(); x.arc(p.x, p.y, p.size * k, 0, TAU); x.fill();
          break;
        case 'smoke':
          // A soft-edged puff (cached sprite per colour) rather than a hard disc
          var pr = p.size * (2 - k) * 1.5;
          x.globalAlpha = k * 0.7; x.drawImage(puff(p.color), p.x - pr, p.y - pr, pr * 2, pr * 2);
          break;
        case 'shard':
          x.fillStyle = p.color; x.save(); x.translate(p.x, p.y); x.rotate(p.life * 0.3);
          x.beginPath(); x.moveTo(0, -p.size); x.lineTo(p.size * 0.5, p.size * 0.6); x.lineTo(-p.size * 0.5, p.size * 0.6); x.fill(); x.restore();
          break;
        case 'anim': {
          // A painted effect from the customization pack, played once over its life (assets/gear/fx-<name>-<n>.png)
          var fr = gearImg(p.name + '-' + Math.min(p.n, 1 + Math.floor((1 - k) * p.n)));
          if (fr) {
            x.globalAlpha = p.alpha != null ? p.alpha : 1;
            x.save(); x.translate(p.x, p.y); if (p.flip) x.scale(-1, 1);
            x.drawImage(fr, -p.w / 2, -p.h / 2, p.w, p.h); x.restore();
          }
          break;
        }
        case 'ring':
          x.strokeStyle = p.color; x.lineWidth = p.width * k; x.beginPath(); x.arc(p.x, p.y, p.size * (1.15 - k * 0.85), 0, TAU); x.stroke();
          break;
        case 'flare':
          var g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.3, Art.alpha(hex(p.color), 0.6)); g.addColorStop(1, 'rgba(255,255,255,0)');
          x.fillStyle = g; x.beginPath(); x.arc(p.x, p.y, p.size, 0, TAU); x.fill();
          break;
        case 'beam':
          x.save(); x.translate(p.x, p.y); x.rotate(Math.atan2(p.vy, p.vx));
          var bg = x.createLinearGradient(0, 0, 900, 0);
          bg.addColorStop(0, Art.alpha(hex(p.color), 0.95 * k)); bg.addColorStop(1, 'rgba(255,255,255,0)');
          x.fillStyle = bg; x.fillRect(0, -40 * k, 900, 80 * k);
          x.fillStyle = 'rgba(255,255,255,' + (0.9 * k) + ')'; x.fillRect(0, -10 * k, 700, 20 * k);
          x.restore();
          break;
        case 'pillar':
          var pg = x.createLinearGradient(p.x, p.y - 600, p.x, p.y);
          pg.addColorStop(0, 'rgba(255,255,255,0)'); pg.addColorStop(1, 'rgba(255,255,255,' + 0.6 * k + ')');
          x.fillStyle = pg; x.fillRect(p.x - p.size / 2 * k, p.y - 600, p.size * k, 600);
          break;
        case 'bolt':
          lightning(x, p.x, p.y, p.x2, p.y2, p.color, 3 * k, 8);
          break;
        case 'flame': {
          // Colour ramps white-yellow → orange → red → smoke as it lives
          var age = 1 - k, r = p.size * (0.6 + age * 0.8);
          var fc = age < 0.25 ? '255,236,170' : age < 0.55 ? '255,150,50' : age < 0.8 ? '220,60,30' : '90,70,70';
          var fg = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          fg.addColorStop(0, 'rgba(' + fc + ',' + (0.9 * k) + ')'); fg.addColorStop(1, 'rgba(' + fc + ',0)');
          x.fillStyle = fg; x.beginPath(); x.arc(p.x, p.y, r, 0, TAU); x.fill();
          break;
        }
        case 'ember':
          x.fillStyle = p.color; x.globalAlpha = k * (0.6 + 0.4 * Math.sin(p.life * 0.9));
          x.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;
        case 'frostStar': {
          var fr = p.size * (1.2 - k * 0.5);
          x.strokeStyle = p.color; x.lineWidth = 2.5 * k;
          for (var q = 0; q < 6; q++) { var qa = q * Math.PI / 3; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x + Math.cos(qa) * fr, p.y + Math.sin(qa) * fr);
            x.moveTo(p.x + Math.cos(qa) * fr * 0.6, p.y + Math.sin(qa) * fr * 0.6); x.lineTo(p.x + Math.cos(qa + 0.4) * fr * 0.85, p.y + Math.sin(qa + 0.4) * fr * 0.85); x.stroke(); }
          break;
        }
        case 'rock':
          p.rotA = (p.rotA || 0) + (p.spin || 0.1);
          // A chip of stone: base colour, a lit upper facet and a shadowed lower one
          x.save(); x.translate(p.x, p.y); x.rotate(p.rotA); x.fillStyle = p.color;
          x.beginPath(); x.moveTo(-p.size, -p.size * 0.3); x.lineTo(-p.size * 0.2, -p.size); x.lineTo(p.size, -p.size * 0.4); x.lineTo(p.size * 0.6, p.size * 0.7); x.lineTo(-p.size * 0.6, p.size * 0.8); x.closePath(); x.fill();
          x.fillStyle = 'rgba(255,236,205,0.35)'; x.beginPath(); x.moveTo(-p.size, -p.size * 0.3); x.lineTo(-p.size * 0.2, -p.size); x.lineTo(p.size, -p.size * 0.4); x.lineTo(0, 0); x.closePath(); x.fill();
          x.fillStyle = 'rgba(20,10,4,0.35)'; x.beginPath(); x.moveTo(p.size, -p.size * 0.4); x.lineTo(p.size * 0.6, p.size * 0.7); x.lineTo(-p.size * 0.6, p.size * 0.8); x.lineTo(0, 0); x.closePath(); x.fill();
          x.restore();
          break;
        case 'drop': {
          var dl = Math.sqrt(p.vx * p.vx + p.vy * p.vy) + 1;
          x.save(); x.translate(p.x, p.y); x.rotate(Math.atan2(p.vy, p.vx)); x.fillStyle = p.color;
          x.beginPath(); x.ellipse(0, 0, p.size + dl * 0.6, p.size * 0.7, 0, 0, TAU); x.fill(); x.restore();
          break;
        }
        case 'ripple':
          x.strokeStyle = p.color; x.lineWidth = 3 * k;
          x.beginPath(); x.ellipse(p.x, p.y, p.size * (1.6 - k), p.size * (1.6 - k) * 0.55, 0, 0, TAU); x.stroke();
          x.beginPath(); x.ellipse(p.x, p.y, p.size * (1.1 - k * 0.6), p.size * (1.1 - k * 0.6) * 0.55, 0, 0, TAU); x.stroke();
          break;
        case 'hex': {
          var hr = p.size * (1.25 - k * 0.35);
          x.strokeStyle = p.color; x.lineWidth = 3 * k + 1;
          x.beginPath(); for (var hi = 0; hi <= 6; hi++) { var ha = hi * Math.PI / 3 + Math.PI / 6; x.lineTo(p.x + Math.cos(ha) * hr, p.y + Math.sin(ha) * hr); } x.stroke();
          x.globalAlpha = k * 0.25; x.fillStyle = p.color; x.fill();
          break;
        }
        case 'glint': {
          var gl = p.size * (0.4 + (1 - k) * 0.8);
          x.strokeStyle = p.color; x.lineWidth = 3 * k; x.lineCap = 'round';
          x.beginPath(); x.moveTo(p.x - gl, p.y); x.lineTo(p.x + gl, p.y); x.moveTo(p.x, p.y - gl * 0.7); x.lineTo(p.x, p.y + gl * 0.7); x.stroke();
          break;
        }
        case 'crack': {
          // Deterministic per crack so it does not flicker; fades over its last half
          x.globalAlpha = Math.min(1, k * 2); x.strokeStyle = p.color; x.lineWidth = 2;
          var rs = p.seed;
          for (var cl = 0; cl < 7; cl++) {
            var ca = (cl / 7) * Math.PI * 2, cx2 = p.x, cy2 = p.y;
            x.beginPath(); x.moveTo(cx2, cy2);
            for (var cs = 0; cs < 4; cs++) { rs = (rs * 9301 + 49297) % 233280; ca += (rs / 233280 - 0.5) * 0.8; cx2 += Math.cos(ca) * p.size * 0.28 * (p.side ? 0.4 : 1); cy2 += Math.sin(ca) * p.size * 0.28; x.lineTo(cx2, cy2); }
            x.stroke();
          }
          break;
        }
        case 'star': {
          x.save(); x.translate(p.x, p.y); x.rotate(p.rotA || 0); x.fillStyle = p.color;
          var sr = p.size * (0.5 + k * 0.5);
          x.beginPath(); for (var si = 0; si < 8; si++) { var sa = si * Math.PI / 4, rr = si % 2 ? sr * 0.25 : sr; x.lineTo(Math.cos(sa) * rr, Math.sin(sa) * rr); } x.closePath(); x.fill();
          x.restore();
          break;
        }
      }
    }
    x.globalAlpha = 1;
    x.textAlign = 'center'; x.font = '900 18px Cinzel, serif';
    this.popups.forEach(function (p) {
      x.globalAlpha = Math.min(1, p.life / 15);
      x.lineWidth = 4; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.strokeText(p.text, p.x, p.y);
      x.fillStyle = p.color; x.fillText(p.text, p.x, p.y);
    });
    x.restore();
  };

  function hex(c) { return c && c[0] === '#' ? c : '#ffffff'; }

  // ─────────────── effect helpers: seeded shapes, additive light ───────────────
  /** Stable pseudo-random in [0,1) for a number, so shapes keep their silhouette from frame to frame. */
  function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
  /** The light an effect throws on the air around it (draw with 'lighter'). */
  function glow(x, cx, cy, r, rgb, a) {
    var g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(0.4, 'rgba(' + rgb + ',' + (a * 0.35) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  }
  var puffs = {};
  /** A soft radial puff in the given colour, rendered once and reused for every smoke particle of that colour. */
  function puff(color) {
    if (puffs[color]) return puffs[color];
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32), m = /rgba?\(([^)]+)\)/.exec(color), parts = m ? m[1].split(',') : null;
    var rgb = parts ? parts.slice(0, 3).join(',') : '255,255,255', a = parts && parts[3] != null ? +parts[3] : 1;
    if (!parts && color[0] === '#') { var n = parseInt(color.slice(1), 16); rgb = (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255); }
    rg.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); rg.addColorStop(0.5, 'rgba(' + rgb + ',' + a * 0.55 + ')'); rg.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    return (puffs[color] = c);
  }
  function poly(x, pts) { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); }
  /** An irregular stone outline of n corners around radius r. */
  function rockPts(seed, r, n) {
    var pts = [];
    for (var i = 0; i < n; i++) { var a = (i + (hash(seed + i) - 0.5) * 0.6) / n * TAU, rr = r * (0.76 + hash(seed * 3.1 + i) * 0.34); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    return pts;
  }
  /**
   * A lit stone silhouette: body shaded from a fixed upper-left light whatever the spin, faceted planes,
   * a warm rim on the lit edge and a dark contact edge. pts are in the rotated frame.
   */
  function stone(x, pts, rot, R, cols) {
    x.save(); x.rotate(rot); poly(x, pts); x.rotate(-rot);
    var g = x.createRadialGradient(-R * 0.45, -R * 0.5, R * 0.1, -R * 0.1, -R * 0.1, R * 1.45);
    g.addColorStop(0, cols[0]); g.addColorStop(0.4, cols[1]); g.addColorStop(0.8, cols[2]); g.addColorStop(1, cols[3]);
    x.fillStyle = g; x.fill();
    x.save(); x.clip();
    // Facets: each wedge from an off-centre point to one edge, shaded by how much it faces the light
    var n = pts.length, cx = R * 0.22, cy = -R * 0.18;
    for (var i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n], ang = Math.atan2(a[1] + b[1], a[0] + b[0]) + rot;
      var lit = Math.cos(ang + Math.PI * 0.75);
      x.save(); x.rotate(rot); x.beginPath(); x.moveTo(cx, cy); x.lineTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.closePath(); x.restore();
      x.fillStyle = lit > 0 ? 'rgba(255,240,215,' + (lit * 0.1) + ')' : 'rgba(10,6,2,' + (-lit * 0.22) + ')'; x.fill();
    }
    x.restore();
    x.save(); x.rotate(rot); poly(x, pts); x.restore();
    x.strokeStyle = 'rgba(18,10,4,0.55)'; x.lineWidth = 2.5; x.lineJoin = 'round'; x.stroke();
    var rim = x.createLinearGradient(-R, -R, R * 0.4, R * 0.4);
    rim.addColorStop(0, 'rgba(255,238,205,0.85)'); rim.addColorStop(0.45, 'rgba(255,238,205,0)'); rim.addColorStop(0.7, 'rgba(0,0,0,0)'); rim.addColorStop(1, 'rgba(12,6,2,0.75)');
    x.strokeStyle = rim; x.lineWidth = 2; x.lineJoin = 'round'; x.stroke();
    x.restore();
  }
  /** A two-faced crystal or rock spike rising from the floor: lit left face, shaded right face. */
  function spike(x, sx, bw, h, lean, lite, dark) {
    var ax = sx + lean, mid = sx + bw * 0.15;
    var gl = x.createLinearGradient(sx - bw, 0, ax, -h); gl.addColorStop(0, lite[1]); gl.addColorStop(1, lite[0]);
    x.fillStyle = gl; x.beginPath(); x.moveTo(sx - bw, 0); x.lineTo(ax, -h); x.lineTo(mid, 0); x.closePath(); x.fill();
    var gd = x.createLinearGradient(mid, 0, ax, -h); gd.addColorStop(0, dark[1]); gd.addColorStop(1, dark[0]);
    x.fillStyle = gd; x.beginPath(); x.moveTo(mid, 0); x.lineTo(ax, -h); x.lineTo(sx + bw, 0); x.closePath(); x.fill();
  }

  /**
   * A forked lightning arc: midpoint-displaced so it reads as a real discharge, drawn as an additive glow,
   * a coloured channel and a white-hot core. seed keeps the shape still between re-rolls.
   */
  function lightning(x, x0, y0, x1, y1, color, w, segs, seed) {
    var s = seed != null ? seed : Math.random() * 1000, n = 0;
    function r() { return hash(s + (n++) * 1.37) - 0.5; }
    var len = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)) || 1, nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
    var pts = [[x0, y0], [x1, y1]], amp = Math.min(34, len * 0.3);
    while (pts.length < Math.max(4, segs * 1.5)) {
      var out = [pts[0]];
      for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i], d = r() * amp; out.push([(a[0] + b[0]) / 2 + nx * d, (a[1] + b[1]) / 2 + ny * d]); out.push(b); }
      pts = out; amp *= 0.55;
    }
    var line = function (p) { x.beginPath(); x.moveTo(p[0][0], p[0][1]); for (var j = 1; j < p.length; j++) x.lineTo(p[j][0], p[j][1]); };
    x.save(); x.globalCompositeOperation = 'lighter'; x.lineJoin = 'round'; x.lineCap = 'round';
    line(pts);
    x.strokeStyle = Art.alpha(hex(color), 0.07); x.lineWidth = w * 6; x.stroke();
    x.strokeStyle = Art.alpha(hex(color), 0.1); x.lineWidth = w * 2.6; x.stroke();
    x.strokeStyle = Art.alpha(hex(color), 0.9); x.lineWidth = w; x.stroke();
    x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = Math.max(1, w * 0.38); x.stroke();
    // One or two thin forks peeling off the main channel
    for (var f = 0; f < 2; f++) {
      var k0 = 2 + Math.floor((r() + 0.5) * (pts.length - 4)), p0 = pts[k0], fl = len * (0.1 + (r() + 0.5) * 0.12), fa = Math.atan2(y1 - y0, x1 - x0) + (r() < 0 ? -1 : 1) * (0.4 + (r() + 0.5) * 0.6);
      var fp = [p0], cx = p0[0], cy = p0[1];
      for (var q = 0; q < 4; q++) { cx += Math.cos(fa + r() * 1.2) * fl / 4; cy += Math.sin(fa + r() * 1.2) * fl / 4; fp.push([cx, cy]); }
      line(fp); x.strokeStyle = Art.alpha(hex(color), 0.12); x.lineWidth = w * 2; x.stroke();
      x.strokeStyle = Art.alpha(hex(color), 0.7); x.lineWidth = Math.max(0.8, w * 0.4); x.stroke();
    }
    x.restore();
  }

  // ─────────────── projectiles & structures ───────────────
  function drawProjectile(x, p, t, fx) {
    x.save();
    x.translate(p.x, p.y);
    var dir = p.vx < 0 ? -1 : 1, i, k;
    switch (p.ty) {
      case 'fireball': {
        // A comet of fire: flickering tongues streaming back off a white-hot core
        var fa = Math.atan2(p.vy, p.vx || dir), fl = t * 26 + p.id * 3;
        x.rotate(fa); x.globalCompositeOperation = 'lighter';
        glow(x, -6, 0, 64, '255,110,30', 0.32);
        // The tail: overlapping soft blooms that shrink and cool from yellow to deep red, each wavering on its own
        for (i = 9; i >= 1; i--) {
          var u = i / 10, br = 17 * (1 - u * 0.8), bx = -i * 6.5, by = Math.sin(fl * 0.9 - i * 0.8) * 3 * u;
          glow(x, bx, by, br * 1.9, u < 0.3 ? '255,200,90' : u < 0.6 ? '255,120,40' : '220,60,25', 0.55 * (1 - u * 0.6));
        }
        var cg = x.createRadialGradient(3, -2, 0, 0, 0, 19);
        cg.addColorStop(0, 'rgba(255,255,245,1)'); cg.addColorStop(0.3, 'rgba(255,228,140,0.95)'); cg.addColorStop(0.7, 'rgba(255,130,40,0.7)'); cg.addColorStop(1, 'rgba(255,70,20,0)');
        x.fillStyle = cg; x.beginPath(); x.arc(0, 0, 19, 0, TAU); x.fill();
        for (i = 0; i < 2; i++) glow(x, Math.cos(fl * 0.35 + i * Math.PI) * 5, Math.sin(fl * 0.35 + i * Math.PI) * 5, 9, '255,255,220', 0.55);
        if (fx) {
          if (Math.random() < 0.6) fx.add({ x: p.x - dir * 12 + rnd(-4, 4), y: p.y + rnd(-7, 7), vx: -p.vx * 0.15 + rnd(-0.5, 0.5), vy: rnd(-1.2, 0.2), life: rnd(14, 22), size: rnd(6, 11), color: '#ff7a2f', type: 'flame', drag: 0.92, grav: -0.05 });
          if (Math.random() < 0.35) fx.add({ x: p.x - dir * 10, y: p.y + rnd(-8, 8), vx: -p.vx * 0.3 + rnd(-1, 1), vy: rnd(-2, 0.5), life: rnd(18, 30), size: rnd(1.5, 3), color: Math.random() < 0.5 ? '#ffd36a' : '#ff9a3a', type: 'ember', drag: 0.95, grav: -0.03 });
        }
        break;
      }
      case 'iceShard':
      case 'lance': {
        // A faceted crystal: pale lit upper face, deep blue lower face, a bright ridge and a frost wake
        var lance = p.ty === 'lance', L = lance ? 46 : 27, Hh = p.h / 2 + 1;
        x.scale(dir, 1);
        x.globalCompositeOperation = 'lighter';
        var WL = L * (lance ? 4 : 3.4);
        for (i = 0; i < 3; i++) {
          var ww = Hh * (1.1 - i * 0.35), wl = WL * (1 - i * 0.25), wake = x.createLinearGradient(-L * 0.4, 0, -wl, 0);
          wake.addColorStop(0, 'rgba(' + (i === 2 ? '255,255,255' : '160,230,255') + ',' + (0.14 + i * 0.1) + ')'); wake.addColorStop(1, 'rgba(120,210,255,0)');
          x.fillStyle = wake; x.beginPath(); x.moveTo(-L * 0.4, -ww); x.quadraticCurveTo(-wl * 0.5, -ww * 0.45, -wl, 0); x.quadraticCurveTo(-wl * 0.5, ww * 0.45, -L * 0.4, ww); x.fill();
        }
        glow(x, 0, 0, L * 1.5, '127,224,255', 0.26);
        x.globalCompositeOperation = 'source-over';
        var crystal = function (ox, oy, l, h, a) {
          x.save(); x.translate(ox, oy); x.rotate(a);
          var gt = x.createLinearGradient(0, -h, 0, 0); gt.addColorStop(0, '#f6feff'); gt.addColorStop(1, '#b4ecff');
          x.fillStyle = gt; x.beginPath(); x.moveTo(l, 0); x.lineTo(-l * 0.3, -h); x.lineTo(-l, 0); x.closePath(); x.fill();
          var gb = x.createLinearGradient(0, 0, 0, h); gb.addColorStop(0, '#5cb4e6'); gb.addColorStop(1, '#1f5c96');
          x.fillStyle = gb; x.beginPath(); x.moveTo(l, 0); x.lineTo(-l, 0); x.lineTo(-l * 0.3, h); x.closePath(); x.fill();
          x.fillStyle = 'rgba(255,255,255,0.6)'; x.beginPath(); x.moveTo(l * 0.92, -0.5); x.lineTo(-l * 0.15, -h * 0.5); x.lineTo(-l * 0.55, -0.5); x.closePath(); x.fill();
          x.fillStyle = 'rgba(160,230,255,0.35)'; x.beginPath(); x.moveTo(l * 0.6, 0.5); x.lineTo(-l * 0.3, h * 0.75); x.lineTo(-l * 0.7, 0.5); x.closePath(); x.fill();
          x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = 1; x.beginPath(); x.moveTo(-l, 0); x.lineTo(l, 0); x.stroke();
          x.restore();
        };
        if (lance) { crystal(-L * 0.2, -Hh * 0.42, L * 0.55, Hh * 0.6, -0.12); crystal(-L * 0.3, Hh * 0.4, L * 0.45, Hh * 0.5, 0.1); }
        crystal(0, 0, L, Hh, 0);
        // A glint that rolls along the tip
        x.globalCompositeOperation = 'lighter';
        var gs = 5 + 4 * Math.sin(t * 14 + p.id);
        x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 1.4; x.lineCap = 'round';
        x.beginPath(); x.moveTo(L * 0.72 - gs, -1); x.lineTo(L * 0.72 + gs, -1); x.moveTo(L * 0.72, -1 - gs * 0.8); x.lineTo(L * 0.72, -1 + gs * 0.8); x.stroke();
        glow(x, L * 0.72, -1, 8, '255,255,255', 0.6);
        if (fx && Math.random() < 0.55) fx.add({ x: p.x - dir * L * rnd(0.3, 1), y: p.y + rnd(-Hh, Hh), vx: -p.vx * 0.05, vy: rnd(-0.4, 0.4), life: rnd(16, 26), size: rnd(2.5, 4.5), color: Math.random() < 0.6 ? '#ffffff' : '#bfefff', type: 'frostStar', drag: 0.94 });
        break;
      }
      case 'bolt': {
        // A ball of plasma dragging a crackling channel, re-rolled ~24 times a second so it snaps rather than shimmers
        var seed = Math.floor(t * 24) * 7 + p.id * 13, hx = dir * 16;
        x.globalCompositeOperation = 'lighter';
        glow(x, hx, 0, 54, '255,215,80', 0.3); glow(x, hx, 0, 34, '180,140,255', 0.25);
        x.restore(); x.save();
        lightning(x, p.x - dir * 56, p.y + (hash(seed) - 0.5) * 10, p.x + hx, p.y, '#ffe14a', 2.6, 6, seed);
        lightning(x, p.x - dir * 40, p.y + (hash(seed + 3) - 0.5) * 16, p.x + hx, p.y, '#b48cff', 1.6, 5, seed + 50);
        x.globalCompositeOperation = 'lighter';
        glow(x, p.x + hx, p.y, 13, '255,255,255', 0.95);
        if (fx && Math.random() < 0.4) fx.add({ x: p.x + hx, y: p.y, x2: p.x + hx + rnd(-28, 28), y2: p.y + rnd(-28, 28), vx: 0, vy: 0, life: 4, size: 1.5, color: '#ffe14a', type: 'bolt', drag: 1 });
        break;
      }
      case 'boulder': {
        // A lit, faceted stone tumbling along its arc: a dust wake behind, earth-power seams glowing through it
        var R = 23, rot = t * 5.5 * dir + p.id;
        var pts = rockPts(p.id * 7.3, R, 11);
        x.globalCompositeOperation = 'lighter'; glow(x, 0, 0, R * 2.1, '255,170,90', 0.16); x.globalCompositeOperation = 'source-over';
        stone(x, pts, rot, R, ['#d0ab7c', '#8c6642', '#4a321c', '#1c120a']);
        x.save(); x.rotate(rot); poly(x, pts); x.clip();
        // Grain: pits and flecks scattered over the face
        for (i = 0; i < 14; i++) { var gx2 = (hash(p.id + i * 3) - 0.5) * R * 1.6, gy2 = (hash(p.id + i * 5 + 1) - 0.5) * R * 1.6; x.fillStyle = i % 3 ? 'rgba(30,18,8,0.2)' : 'rgba(255,236,200,0.18)'; x.beginPath(); x.arc(gx2, gy2, 0.5 + hash(i + p.id) * 0.8, 0, TAU); x.fill(); }
        // Earth-power seams: a hairline fracture that branches, glowing faintly from inside
        x.globalCompositeOperation = 'lighter'; x.lineCap = 'round'; x.lineJoin = 'round';
        var pulse = 0.5 + 0.3 * Math.sin(t * 10 + p.id), a0 = pts[1], cx3 = (hash(p.id + 2) - 0.5) * R * 0.5, cy3 = (hash(p.id + 4) - 0.5) * R * 0.5;
        x.beginPath(); x.moveTo(a0[0] * 0.95, a0[1] * 0.95); x.lineTo(a0[0] * 0.45 + 2, a0[1] * 0.45 - 2); x.lineTo(cx3, cy3);
        x.lineTo(pts[6][0] * 0.5, pts[6][1] * 0.5 + 2); x.lineTo(pts[6][0] * 0.95, pts[6][1] * 0.95);
        x.moveTo(cx3, cy3); x.lineTo(pts[9][0] * 0.55 - 1, pts[9][1] * 0.55); x.lineTo(pts[9][0] * 0.9, pts[9][1] * 0.9);
        x.strokeStyle = 'rgba(255,140,50,' + (pulse * 0.3) + ')'; x.lineWidth = 3.5; x.stroke();
        x.strokeStyle = 'rgba(255,214,150,' + (pulse * 0.55) + ')'; x.lineWidth = 0.8; x.stroke();
        x.restore();
        if (fx) {
          if (Math.random() < 0.5) fx.add({ x: p.x + rnd(-10, 10), y: p.y + rnd(-10, 10), vx: -p.vx * 0.2, vy: -p.vy * 0.1 - 0.3, life: rnd(22, 34), size: rnd(6, 10), color: 'rgba(200,172,130,0.4)', type: 'smoke', drag: 0.95 });
          if (Math.random() < 0.12) fx.add({ x: p.x + rnd(-14, 14), y: p.y + rnd(-14, 14), vx: -p.vx * 0.2 + rnd(-1, 1), vy: rnd(-1.5, 0.5), life: rnd(26, 40), size: rnd(2, 3.5), color: '#8a6a4a', type: 'rock', drag: 0.98, grav: 0.32, spin: rnd(-0.3, 0.3) });
        }
        break;
      }
      case 'wave': {
        // A breaking wave: long back slope, a curling lip of foam, a shaded hollow under it, spray off the top
        x.scale(dir, 1);
        k = Math.min(1, (p.a || 0) / 8) * Math.min(1, (p.l || 99) / 10);
        var W = p.w, H = p.h * (0.35 + 0.65 * k) * 1.12, ph = t * 9 + p.id, crestX = W * 0.16, lipX = W * 0.66;
        var back = [];
        for (i = 0; i <= 16; i++) {
          var s = i / 16, e = s * s * (3 - 2 * s);
          back.push([-W * 1.3 + (crestX + W * 1.3) * s, -H * Math.pow(e, 1.35) + Math.sin(ph + s * 10) * 1.6 * Math.sin(s * Math.PI)]);
        }
        var crest = back[16], lipY = -H * 0.6 + Math.sin(ph * 1.3) * 2;
        var bez = function (u) { var v = 1 - u; return [v * v * v * crest[0] + 3 * v * v * u * (W * 0.42) + 3 * v * u * u * (lipX + 6) + u * u * u * lipX, v * v * v * crest[1] + 3 * v * v * u * (-H * 1.14) + 3 * v * u * u * (-H * 0.98) + u * u * u * lipY]; };
        var body = function () {
          x.beginPath(); x.moveTo(-W * 1.35, 2);
          for (var j = 0; j <= 16; j++) x.lineTo(back[j][0], back[j][1]);
          x.bezierCurveTo(W * 0.42, -H * 1.14, lipX + 6, -H * 0.98, lipX, lipY);
          x.quadraticCurveTo(W * 0.52, -H * 0.66, W * 0.47, -H * 0.48);
          x.quadraticCurveTo(W * 0.3, -H * 0.24, W * 0.6, 2); x.closePath();
        };
        body();
        var wg = x.createLinearGradient(0, -H * 1.1, 0, 2);
        wg.addColorStop(0, 'rgba(206,255,248,0.97)'); wg.addColorStop(0.22, 'rgba(96,228,216,0.95)'); wg.addColorStop(0.62, 'rgba(22,146,166,0.93)'); wg.addColorStop(1, 'rgba(8,66,94,0.92)');
        x.fillStyle = wg; x.fill();
        x.save(); x.clip();
        // Shade inside the curl, and a translucent sheen where light passes through the back slope
        var hg = x.createRadialGradient(W * 0.46, -H * 0.36, 0, W * 0.46, -H * 0.36, H * 0.75);
        hg.addColorStop(0, 'rgba(2,36,58,0.6)'); hg.addColorStop(1, 'rgba(2,36,58,0)');
        x.fillStyle = hg; x.fillRect(-W * 1.4, -H * 1.3, W * 2.2, H * 1.4);
        x.globalCompositeOperation = 'lighter';
        var sg = x.createRadialGradient(-W * 0.2, -H * 0.55, 0, -W * 0.2, -H * 0.55, H * 0.9);
        sg.addColorStop(0, 'rgba(140,255,236,0.28)'); sg.addColorStop(1, 'rgba(140,255,236,0)');
        x.fillStyle = sg; x.fillRect(-W * 1.4, -H * 1.3, W * 2.2, H * 1.4);
        // Current lines running parallel to the surface
        x.lineCap = 'round';
        for (var b = 0; b < 3; b++) {
          x.beginPath();
          for (i = 3; i <= 15; i++) { var dy = H * (0.17 + b * 0.2) * Math.min(1, i / 10); var yy = back[i][1] + dy + Math.sin(ph * 0.7 + i * 0.9 + b * 2) * 1.5; if (i === 3) x.moveTo(back[i][0], yy); else x.lineTo(back[i][0], yy); }
          x.strokeStyle = 'rgba(210,255,250,' + (0.13 - b * 0.03) + ')'; x.lineWidth = 1.6 - b * 0.3; x.stroke();
        }
        x.restore();
        // Specular streak just under the surface
        x.save(); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round';
        var spg = x.createLinearGradient(back[4][0], 0, crest[0], 0);
        spg.addColorStop(0, 'rgba(255,255,255,0)'); spg.addColorStop(1, 'rgba(255,255,255,0.75)');
        x.beginPath(); for (i = 4; i <= 16; i++) { if (i === 4) x.moveTo(back[i][0], back[i][1] + 3); else x.lineTo(back[i][0], back[i][1] + 3); }
        x.strokeStyle = spg; x.lineWidth = 2; x.stroke();
        x.restore();
        // Foam: churning clusters along the crest and lip, thinning toward the tail, and a frothy base
        x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
        var lip = function () { x.beginPath(); for (var j = 10; j <= 16; j++) { if (j === 10) x.moveTo(back[j][0], back[j][1] + 1); else x.lineTo(back[j][0], back[j][1] + 1); } for (var u3 = 0.1; u3 <= 1.001; u3 += 0.1) { var bq = bez(u3); x.lineTo(bq[0], bq[1] + 1); } };
        lip(); var fg2 = x.createLinearGradient(back[10][0], 0, lipX, 0); fg2.addColorStop(0, 'rgba(255,255,255,0)'); fg2.addColorStop(0.45, 'rgba(255,255,255,0.95)'); fg2.addColorStop(1, 'rgba(255,255,255,1)');
        x.strokeStyle = fg2; x.lineWidth = 4.5 * (0.6 + k * 0.4); x.stroke();
        x.restore();
        for (i = 0; i < 18; i++) {
          var u = i / 17, fp = bez(u), fr = (1 + hash(p.id + i) * 2.4) * (1 + 0.3 * Math.sin(ph * 2 + i)) * (0.6 + k * 0.4);
          fp[0] += Math.sin(ph * 1.7 + i * 2.3) * 2.2; fp[1] += Math.cos(ph * 1.3 + i) * 2.2 - 1.5;
          x.fillStyle = 'rgba(255,255,255,' + (0.55 + hash(i * 3 + p.id) * 0.45) + ')'; x.beginPath(); x.arc(fp[0], fp[1], fr, 0, TAU); x.fill();
        }
        var bf = x.createLinearGradient(-W * 1.3, 0, W * 0.6, 0); bf.addColorStop(0, 'rgba(240,255,252,0)'); bf.addColorStop(0.5, 'rgba(240,255,252,0.45)'); bf.addColorStop(1, 'rgba(240,255,252,0.65)');
        x.fillStyle = bf; x.beginPath(); x.moveTo(-W * 1.3, 2);
        for (i = 0; i <= 12; i++) x.lineTo(-W * 1.3 + i / 12 * W * 1.9, -3 - 3 * Math.abs(Math.sin(ph * 0.9 + i * 1.7)));
        x.lineTo(W * 0.6, 2); x.closePath(); x.fill();
        for (i = 0; i < 14; i++) { x.fillStyle = 'rgba(255,255,255,' + (0.4 + hash(p.id + i * 5) * 0.5) + ')'; x.beginPath(); x.arc(-W * 1.1 + hash(i * 7 + Math.floor(ph * 0.6)) * W * 1.7, -1 - hash(i + 3) * 4, 0.8 + hash(i * 2) * 1.4, 0, TAU); x.fill(); }
        if (fx) {
          var lp = bez(0.9);
          if (Math.random() < 0.8) fx.add({ x: p.x + dir * lp[0], y: p.y + lp[1], vx: dir * rnd(0.5, 2) + p.vx * 0.35, vy: rnd(-3.5, -1.2), life: rnd(16, 26), size: rnd(1.4, 2.6), color: Math.random() < 0.5 ? '#ffffff' : '#c8fff8', type: 'drop', drag: 0.98, grav: 0.26 });
          if (Math.random() < 0.45) fx.add({ x: p.x + dir * crest[0], y: p.y + crest[1], vx: -dir * rnd(0.4, 1.4) + p.vx * 0.3, vy: rnd(-0.8, -0.2), life: rnd(22, 32), size: rnd(5, 8), color: 'rgba(225,255,250,0.2)', type: 'smoke', drag: 0.95 });
        }
        break;
      }
      case 'quake': {
        // Stone fangs punching up through the floor in a rolling ripple, a molten seam glowing at their roots
        x.globalCompositeOperation = 'lighter';
        x.save(); x.scale(1, 0.3); glow(x, 0, 0, p.w * 0.9, '255,160,70', 0.35); x.restore();
        x.strokeStyle = 'rgba(255,190,110,0.8)'; x.lineWidth = 2; x.lineJoin = 'round';
        x.beginPath(); for (i = 0; i <= 8; i++) { var cxq = -p.w * 0.7 + i / 8 * p.w * 1.4; if (i) x.lineTo(cxq, -1 + (hash(p.id + i) - 0.5) * 3); else x.moveTo(cxq, -1); } x.stroke();
        x.globalCompositeOperation = 'source-over';
        for (var q = 0; q < 5; q++) {
          var rise = 0.5 + 0.5 * Math.sin(t * 15 - q * 1.15 + p.id), hq = (14 + hash(p.id + q * 3) * 24) * (0.3 + 0.7 * rise), qx = -p.w / 2 + q * p.w / 4 + (hash(q + p.id) - 0.5) * 6, bw = 6 + hash(q * 7 + p.id) * 5, ln = (hash(q + 11) - 0.5) * 12;
          // A broken slab: chipped shoulders, a split down its face
          var sh = [[qx - bw, 0], [qx - bw * 0.85, -hq * 0.42], [qx - bw * 0.35 + ln * 0.6, -hq * 0.78], [qx + ln, -hq], [qx + ln + bw * 0.35, -hq * 0.84], [qx + bw * 0.7, -hq * 0.5], [qx + bw, 0]];
          var lg2 = x.createLinearGradient(qx - bw, -hq, qx + bw, 0); lg2.addColorStop(0, '#e6c99a'); lg2.addColorStop(0.5, '#9a7650'); lg2.addColorStop(1, '#3a2818');
          x.fillStyle = lg2; poly(x, sh); x.fill();
          x.fillStyle = 'rgba(20,10,4,0.4)'; x.beginPath(); x.moveTo(qx + ln, -hq); x.lineTo(qx + ln + bw * 0.35, -hq * 0.84); x.lineTo(qx + bw * 0.7, -hq * 0.5); x.lineTo(qx + bw, 0); x.lineTo(qx + bw * 0.1, 0); x.lineTo(qx + ln * 0.3 + 1, -hq * 0.45); x.closePath(); x.fill();
          x.strokeStyle = 'rgba(255,236,200,0.55)'; x.lineWidth = 1; x.beginPath(); x.moveTo(qx - bw * 0.85, -hq * 0.42); x.lineTo(qx - bw * 0.35 + ln * 0.6, -hq * 0.78); x.lineTo(qx + ln, -hq); x.stroke();
        }
        for (q = 0; q < 6; q++) {
          var rx2 = (q / 5 - 0.5) * p.w * 1.25 + (hash(q * 13 + p.id) - 0.5) * 6, rr2 = 2 + hash(q + p.id * 2) * 2.6, rg2 = x.createLinearGradient(rx2 - rr2, -rr2 * 1.6, rx2 + rr2, 0);
          rg2.addColorStop(0, '#d2b182'); rg2.addColorStop(1, '#4a3420');
          x.save(); x.translate(rx2, -rr2 * 0.6); x.scale(1.3, 0.8); poly(x, rockPts(q * 5 + p.id, rr2, 6)); x.restore(); x.fillStyle = rg2; x.fill();
        }
        if (fx && Math.random() < 0.6) {
          fx.add({ x: p.x + rnd(-p.w / 2, p.w / 2), y: p.y - 4, vx: rnd(-1, 1), vy: rnd(-1.2, -0.3), life: rnd(22, 32), size: rnd(7, 11), color: 'rgba(196,164,120,0.42)', type: 'smoke', drag: 0.94, grav: -0.01 });
          fx.add({ x: p.x + rnd(-p.w / 2, p.w / 2), y: p.y - 6, vx: rnd(-1.5, 1.5), vy: rnd(-5, -2.5), life: 26, size: rnd(2, 4), color: '#9a7650', type: 'rock', drag: 0.98, grav: 0.34, spin: rnd(-0.3, 0.3) });
        }
        break;
      }
      case 'chillField': {
        // Telegraph: frost creeping across the floor. Active: frozen ground, ice crystals and a column of cold mist
        var active = p.dl <= 0, fw = p.w / 2;
        k = active ? Math.min(1, (p.l || 50) / 12) : 0.5 + 0.5 * Math.sin(t * 16);
        x.save(); x.scale(1, 0.14);
        var gg = x.createRadialGradient(0, 0, 0, 0, 0, fw);
        gg.addColorStop(0, 'rgba(235,252,255,' + (active ? 0.8 : 0.3 * k) + ')'); gg.addColorStop(0.7, 'rgba(150,220,255,' + (active ? 0.45 : 0.15 * k) + ')'); gg.addColorStop(1, 'rgba(150,220,255,0)');
        x.fillStyle = gg; x.beginPath(); x.arc(0, 0, fw, 0, TAU); x.fill(); x.restore();
        if (active) {
          for (i = 0; i < 6; i++) {
            var mx = (hash(p.id + i) - 0.5) * p.w * 0.8, my = -p.h * (0.2 + 0.6 * ((t * 0.6 + hash(i * 3 + p.id)) % 1)), mr = 26 + hash(i + 7) * 20;
            var mg = x.createRadialGradient(mx, my, 0, mx, my, mr);
            mg.addColorStop(0, 'rgba(225,246,255,' + (0.22 * k) + ')'); mg.addColorStop(1, 'rgba(225,246,255,0)');
            x.fillStyle = mg; x.beginPath(); x.arc(mx, my, mr, 0, TAU); x.fill();
          }
          x.globalAlpha = k;
          // Crystals grow in clusters of three, the outer ones leaning away from the tallest
          for (i = 0; i < 4; i++) {
            var ccx = (i / 3 - 0.5) * p.w * 0.72 + (hash(p.id + i * 2) - 0.5) * 18, ch = (14 + hash(i * 5 + p.id) * 14) * k;
            spike(x, ccx - 5, 3 + hash(i) * 1.5, ch * 0.55, -ch * 0.35, ['#ffffff', '#bfeaff'], ['#78c4ee', '#2f6fa4']);
            spike(x, ccx + 5, 3 + hash(i + 2) * 1.5, ch * 0.45, ch * 0.3, ['#ffffff', '#bfeaff'], ['#78c4ee', '#2f6fa4']);
            spike(x, ccx, 4 + hash(i + 1) * 2, ch, (hash(i + 4) - 0.5) * 4, ['#ffffff', '#c8eeff'], ['#6ab8e6', '#24609a']);
          }
          x.globalAlpha = 1;
        }
        x.globalCompositeOperation = 'lighter';
        for (i = 0; i < 8; i++) {
          var tw = Math.max(0, Math.sin(t * 6 + i * 2.3 + p.id)), gx = (hash(p.id + i * 9) - 0.5) * p.w * 0.9, gy = active ? -hash(i * 4) * p.h : -2;
          if (tw > 0.2) { x.strokeStyle = 'rgba(255,255,255,' + tw * 0.9 + ')'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(gx - 4 * tw, gy); x.lineTo(gx + 4 * tw, gy); x.moveTo(gx, gy - 4 * tw); x.lineTo(gx, gy + 4 * tw); x.stroke(); }
        }
        break;
      }
      case 'puddle': {
        // Still water with a soft edge, a sky sheen and rings spreading from falling drips
        k = Math.min(1, (p.a || 20) / 12) * Math.min(1, (p.l || 99) / 20);
        var rw = p.w / 2 * (0.5 + 0.5 * k);
        x.save(); x.scale(1, 0.15);
        var pg = x.createRadialGradient(0, -20, 0, 0, -20, rw);
        pg.addColorStop(0, 'rgba(110,232,222,' + 0.6 * k + ')'); pg.addColorStop(0.75, 'rgba(18,120,142,' + 0.55 * k + ')'); pg.addColorStop(1, 'rgba(18,120,142,0)');
        x.fillStyle = pg; x.beginPath(); x.arc(0, -20, rw, 0, TAU); x.fill(); x.restore();
        x.globalCompositeOperation = 'lighter';
        x.fillStyle = 'rgba(220,255,250,' + 0.22 * k + ')'; x.beginPath(); x.ellipse(-rw * 0.25, -4, rw * 0.38, 1.8, 0, 0, TAU); x.fill();
        for (i = 0; i < 3; i++) {
          var cyc = t * 0.7 + i / 3, ci = Math.floor(cyc), u2 = cyc - ci, rx = (hash(ci * 3 + i + p.id) - 0.5) * rw * 1.1;
          x.strokeStyle = 'rgba(200,255,250,' + (1 - u2) * 0.55 * k + ')'; x.lineWidth = 1.3;
          x.beginPath(); x.ellipse(rx, -3, 4 + u2 * 26, 1 + u2 * 4, 0, 0, TAU); x.stroke();
        }
        break;
      }
      case 'whirlpool': {
        // A vortex: dark eye, tapered spiral arms of water and foam flecks being dragged inward
        var Rw = p.w / 2, rot = t * 5 + p.id;
        var vg = x.createRadialGradient(0, 0, 0, 0, 0, Rw);
        vg.addColorStop(0, 'rgba(2,24,40,0.85)'); vg.addColorStop(0.4, 'rgba(10,86,108,0.55)'); vg.addColorStop(0.8, 'rgba(30,170,180,0.18)'); vg.addColorStop(1, 'rgba(47,211,200,0)');
        x.fillStyle = vg; x.beginPath(); x.arc(0, 0, Rw, 0, TAU); x.fill();
        for (var arm = 0; arm < 5; arm++) {
          var outer = [], inner = [];
          for (i = 0; i <= 20; i++) {
            var sa = i / 20, an = rot + arm * TAU / 5 + sa * 3.6, rr = Rw * (0.96 - sa * 0.86), hw = (0.5 + 4 * Math.sin(Math.min(1, sa * 1.6) * Math.PI * 0.5) * (1 - sa)) * (arm % 2 ? 0.8 : 1);
            outer.push([Math.cos(an) * (rr + hw), Math.sin(an) * (rr + hw)]); inner.unshift([Math.cos(an) * (rr - hw), Math.sin(an) * (rr - hw)]);
          }
          var ag = x.createRadialGradient(0, 0, Rw * 0.1, 0, 0, Rw);
          ag.addColorStop(0, 'rgba(120,230,224,0)'); ag.addColorStop(0.5, arm % 2 ? 'rgba(90,220,214,0.5)' : 'rgba(150,250,240,0.65)'); ag.addColorStop(0.85, arm % 2 ? 'rgba(140,240,232,0.75)' : 'rgba(215,255,250,0.9)'); ag.addColorStop(1, 'rgba(215,255,250,0)');
          x.fillStyle = ag; poly(x, outer.concat(inner)); x.fill();
        }
        x.globalCompositeOperation = 'lighter';
        glow(x, 0, 0, Rw * 0.3, '120,255,240', 0.2);
        for (i = 0; i < 12; i++) {
          var fr2 = Rw * (0.3 + hash(p.id + i) * 0.62), fa2 = hash(i * 7 + p.id) * TAU + rot * (1.6 - fr2 / Rw);
          x.fillStyle = 'rgba(235,255,252,' + (0.35 + hash(i + 5) * 0.4) + ')'; x.beginPath(); x.arc(Math.cos(fa2) * fr2, Math.sin(fa2) * fr2, 0.7 + hash(i) * 1.1, 0, TAU); x.fill();
        }
        break;
      }
      case 'flames': {
        // A patch of burning ground: tongues of fire licking up off a hot glow, sparks lifting away
        k = Math.min(1, (p.l || 30) / 30) * Math.min(1, ((p.a || 6) + 1) / 6);
        x.globalCompositeOperation = 'lighter';
        x.save(); x.scale(1, 0.4); glow(x, 0, -4, 40 * k, '255,110,30', 0.5); x.restore();
        for (var layer = 0; layer < 2; layer++) {
          for (i = 0; i < 7; i++) {
            var fo = (i - 3) * 4.5 + (hash(p.id + i) - 0.5) * 4, fh = (layer ? 8 + hash(i + p.id) * 8 : 12 + hash(p.id * 3 + i) * 14 + 12 * (1 - Math.abs(i - 3) / 3.5)) * (1 - Math.abs(i - 3) / 5) * k * (0.7 + 0.3 * Math.sin(t * 17 + i * 1.9 + p.id)), sw = Math.sin(t * 9 + i * 1.3 + p.id) * 4, bw2 = layer ? 3 : 5.5;
            var flg = x.createLinearGradient(0, 0, 0, -fh);
            if (layer) { flg.addColorStop(0, 'rgba(255,250,220,0.35)'); flg.addColorStop(0.25, 'rgba(255,250,220,0.85)'); flg.addColorStop(1, 'rgba(255,220,120,0)'); }
            else { flg.addColorStop(0, 'rgba(255,90,20,0.3)'); flg.addColorStop(0.2, 'rgba(255,100,25,0.75)'); flg.addColorStop(0.55, 'rgba(255,160,40,0.5)'); flg.addColorStop(1, 'rgba(255,200,80,0)'); }
            x.fillStyle = flg; x.beginPath(); x.moveTo(fo - bw2, 0);
            x.bezierCurveTo(fo - bw2, -fh * 0.45, fo + sw * 0.5 - bw2 * 0.3, -fh * 0.7, fo + sw, -fh);
            x.bezierCurveTo(fo + sw * 0.5 + bw2 * 0.3, -fh * 0.7, fo + bw2, -fh * 0.45, fo + bw2, 0); x.closePath(); x.fill();
          }
        }
        if (fx && Math.random() < 0.18 * k) fx.add({ x: p.x + rnd(-12, 12), y: p.y - rnd(6, 20), vx: rnd(-0.6, 0.6), vy: rnd(-2.2, -1), life: rnd(20, 34), size: rnd(1.5, 2.5), color: Math.random() < 0.5 ? '#ffd36a' : '#ff8a3a', type: 'ember', drag: 0.97, grav: -0.02 });
        break;
      }
    }
    x.restore();
  }

  function drawStructure(x, s, t) {
    if (s.ty === 'iceWall') {
      // A wall of clustered crystal columns: each lit on its left face, shaded on its right, frost mist at the foot
      x.save();
      var k = Math.min(1, s.l / 20), i;
      x.globalAlpha = k;
      x.translate(s.x, s.y + s.h);
      // Back row first (darker, leaning out), then the front row; each column a hexagonal prism with a faceted point
      var cols = [[0.22, 0.7, -0.22, 0.2, 1], [0.78, 0.74, 0.2, 0.2, 1], [0.12, 0.55, -0.32, 0.17, 0], [0.42, 1, -0.05, 0.27, 0], [0.66, 0.84, 0.12, 0.23, 0], [0.9, 0.5, 0.34, 0.16, 0]];
      for (i = 0; i < cols.length; i++) {
        var c = cols[i], cx = c[0] * s.w, hh = s.h * c[1] * (0.92 + hash(s.id + i) * 0.1), bw = s.w * c[3], back = c[4];
        x.save(); x.translate(cx, 0); x.rotate(c[2]);
        var tip = hh * 0.82;
        var lg = x.createLinearGradient(-bw, 0, 0, -hh); lg.addColorStop(0, back ? 'rgba(90,160,214,0.85)' : 'rgba(150,215,250,0.9)'); lg.addColorStop(1, back ? 'rgba(190,232,252,0.9)' : 'rgba(248,254,255,0.96)');
        x.fillStyle = lg; x.beginPath(); x.moveTo(-bw, 0); x.lineTo(-bw, -tip); x.lineTo(0, -hh); x.lineTo(0, 0); x.closePath(); x.fill();
        var dg = x.createLinearGradient(0, 0, bw, -hh); dg.addColorStop(0, back ? 'rgba(20,70,130,0.88)' : 'rgba(34,100,166,0.9)'); dg.addColorStop(1, back ? 'rgba(80,150,210,0.88)' : 'rgba(120,196,240,0.92)');
        x.fillStyle = dg; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -hh); x.lineTo(bw, -tip); x.lineTo(bw, 0); x.closePath(); x.fill();
        // Refraction: a pale inner band and the bright ridge
        x.fillStyle = 'rgba(255,255,255,' + (back ? 0.12 : 0.22) + ')'; x.beginPath(); x.moveTo(-bw * 0.7, -tip * 0.1); x.lineTo(-bw * 0.45, -tip * 0.95); x.lineTo(-bw * 0.25, -tip * 0.9); x.lineTo(-bw * 0.5, -tip * 0.05); x.closePath(); x.fill();
        x.strokeStyle = 'rgba(255,255,255,' + (back ? 0.45 : 0.9) + ')'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -hh); x.lineTo(-bw, -tip); x.stroke();
        x.restore();
      }
      x.globalCompositeOperation = 'lighter';
      glow(x, s.w * 0.5, -s.h * 0.5, s.h * 0.7, '160,230,255', 0.18 + 0.06 * Math.sin(t * 4));
      x.save(); x.scale(1, 0.25); glow(x, s.w * 0.5, 0, s.w * 0.9, '220,245,255', 0.35); x.restore();
      x.restore();
    }
  }

  // Instant specials and melee trails drawn from a fighter's current move.
  var RANGED_FX = { rockPillar: 1, arcLash: 1, waterJet: 1 };
  function drawAttackFx(x, f, setup, t, fx, pose) {
    if (f.st !== 'attack' || !f.mv) return;
    var build = setup.build;
    var a = window.DCAnim.attackPhase(f, build);
    if (!a) return;
    var def = a.def, c = el(build.element), fc = f.fc;
    var sc = D.BODIES[build.body].scale;
    // Painted sprite dragons carry their own attack art in the sheets: only effects that reach past the sprite are drawn
    var key0 = f.mv === 'sig' ? build.signature : f.mv === 'ability' ? build.ability : f.mv;
    var painted = build.look.sprite && window.DCSprites && window.DCSprites.usable(build.look.sprite);
    if (painted && !RANGED_FX[key0]) return;
    var mouth = pose && pose.bones ? Art.pointOf('mouth', build.body, pose) : Art.anchor('mouth', build.body, fc, 0);
    var mx = f.x + mouth[0], my = f.y + mouth[1];
    x.save();
    // Telegraph: element glow at the mouth during startup of specials and heavies
    if (a.phase === 'startup' && (f.mv === 'sig' || f.mv === 'ability' || def.kind === 'heavy')) {
      if (!painted) {
        // Energy gathers where the blow will come from: the claw for melee, the mouth for breath
        var src = pose && pose.bones ? Art.pointOf(window.DCAnim.attackKey(f, build, def) === 'breath' ? 'mouth' : 'nearHand', build.body, pose) : mouth;
        mx = f.x + src[0]; my = f.y + src[1];
        var r = 6 + a.p * 22;
        var g = x.createRadialGradient(mx, my, 0, mx, my, r);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, Art.alpha(c.color, 0.8)); g.addColorStop(1, Art.alpha(c.color, 0));
        x.fillStyle = g; x.beginPath(); x.arc(mx, my, r, 0, TAU); x.fill();
      }
      if (f.mv === 'sig' && def === D.SIGNATURES.rockPillar) {
        // Rumble where the pillar will rise
        var px = f.x + fc * (150 + 28) * sc[0];
        x.save(); x.globalCompositeOperation = 'lighter'; x.translate(px, f.y); x.scale(1, 0.25); glow(x, 0, 0, 40 + a.p * 20, '255,170,90', 0.15 + a.p * 0.3); x.restore();
        if (Math.random() < 0.5) fx.add({ x: px + rnd(-28, 28), y: f.y - 2, vx: rnd(-0.6, 0.6), vy: rnd(-2.5, -1), life: 18, size: rnd(1.5, 3), color: '#a0794a', type: 'rock', drag: 0.98, grav: 0.25, spin: rnd(-0.3, 0.3) });
      }
      if (f.mv === 'sig' && def === D.SIGNATURES.arcLash) {
        x.strokeStyle = Art.alpha(c.color, 0.25 + a.p * 0.35); x.setLineDash([10, 10]); x.lineWidth = 2;
        x.beginPath(); x.moveTo(f.x + fc * 30 * sc[0], f.y - 85 * sc[1]); x.lineTo(f.x + fc * 260 * sc[0], f.y - 85 * sc[1]); x.stroke(); x.setLineDash([]);
      }
    }
    if (a.phase === 'active') {
      var boxes = def.boxes || [];
      var key = f.mv === 'sig' ? build.signature : f.mv === 'ability' ? build.ability : f.mv;
      if (key === 'flameBreath') {
        for (var i = 0; i < 4; i++) fx.add({ x: mx, y: my, vx: fc * rnd(7, 11), vy: rnd(-2.2, 1.6), life: rnd(14, 20), size: rnd(6, 11), color: ['#ff6a2a', '#ffb02e', '#ffe9a8', '#ff3b1c'][i], type: 'dot', drag: 0.93 });
      } else if (key === 'arcLash') {
        lightning(x, f.x + fc * 30 * sc[0], f.y - 85 * sc[1], f.x + fc * 260 * sc[0], f.y - 85 * sc[1], c.color, 5, 10);
      } else if (key === 'waterJet') {
        // A pressurised stream: a turbulent translucent body, a bright core and streaks racing down it, spraying at the end
        var jx = f.x + fc * 28 * sc[0], jy = f.y - 89 * sc[1], JL = 200;
        x.save(); x.translate(jx, jy); x.scale(fc, 1);
        var edge = function (side, amp) { for (var j = 0; j <= 20; j++) { var u = j / 20, hw = (7 + u * 9) + Math.sin(t * 38 - u * 14 + side) * amp * u; x.lineTo(u * JL, side * hw); } };
        x.beginPath(); x.moveTo(0, -6); edge(-1, 3); for (var j2 = 20; j2 >= 0; j2--) { var u2 = j2 / 20; x.lineTo(u2 * JL, (7 + u2 * 9) + Math.sin(t * 38 - u2 * 14 + 1) * 3 * u2); } x.closePath();
        var jg = x.createLinearGradient(0, 0, JL, 0);
        jg.addColorStop(0, 'rgba(120,236,226,0.9)'); jg.addColorStop(0.7, 'rgba(40,180,190,0.6)'); jg.addColorStop(1, 'rgba(40,180,190,0)');
        x.fillStyle = jg; x.fill();
        x.globalCompositeOperation = 'lighter';
        var cg2 = x.createLinearGradient(0, 0, JL * 0.9, 0); cg2.addColorStop(0, 'rgba(235,255,252,0.85)'); cg2.addColorStop(1, 'rgba(235,255,252,0)');
        x.fillStyle = cg2; x.beginPath(); x.moveTo(0, -2.5); x.quadraticCurveTo(JL * 0.5, -4, JL * 0.9, 0); x.quadraticCurveTo(JL * 0.5, 4, 0, 2.5); x.fill();
        x.lineCap = 'round';
        for (var st = 0; st < 5; st++) {
          var sx0 = ((t * 900 + st * 47) % (JL + 60)) - 30, sy0 = (hash(st + Math.floor((t * 900 + st * 47) / (JL + 60))) - 0.5) * 14 * (0.4 + sx0 / JL);
          x.strokeStyle = 'rgba(255,255,255,' + (0.55 * (1 - Math.max(0, sx0) / JL)) + ')'; x.lineWidth = 1.5;
          x.beginPath(); x.moveTo(Math.max(0, sx0 - 26), sy0); x.lineTo(Math.max(0, sx0), sy0); x.stroke();
        }
        x.restore();
        fx.add({ x: jx + fc * JL, y: jy + rnd(-10, 10), vx: fc * rnd(1, 4), vy: rnd(-3.5, 1), life: rnd(14, 22), size: rnd(1.5, 3), color: Math.random() < 0.5 ? '#ffffff' : '#c8fff8', type: 'drop', drag: 0.98, grav: 0.25 });
        if (Math.random() < 0.4) fx.add({ x: jx + fc * JL * rnd(0.8, 1), y: jy, vx: fc * rnd(0.5, 1.5), vy: rnd(-0.6, 0), life: 24, size: rnd(6, 9), color: 'rgba(220,255,250,0.22)', type: 'smoke', drag: 0.95 });
      } else if (key === 'rockPillar') {
        // A basalt column bursting up: lit and shaded faces, strata bands, a broken crown and rubble at its foot
        var bx = f.x + fc * (150 + 28) * sc[0], k = Math.min(1, a.p * 3), ph2 = 150 * (1 - Math.pow(1 - k, 3));
        x.save(); x.translate(bx, f.y);
        var lf = x.createLinearGradient(-26, 0, 0, 0); lf.addColorStop(0, '#d6b486'); lf.addColorStop(1, '#a07a50');
        x.fillStyle = lf; x.beginPath(); x.moveTo(-26, 0); x.lineTo(-20, -ph2 * 0.86); x.lineTo(-8, -ph2 * 0.97); x.lineTo(2, -ph2); x.lineTo(0, 0); x.closePath(); x.fill();
        var df = x.createLinearGradient(0, 0, 26, 0); df.addColorStop(0, '#6a4c30'); df.addColorStop(1, '#2e1f12');
        x.fillStyle = df; x.beginPath(); x.moveTo(0, 0); x.lineTo(2, -ph2); x.lineTo(14, -ph2 * 0.9); x.lineTo(22, -ph2 * 0.82); x.lineTo(26, 0); x.closePath(); x.fill();
        x.strokeStyle = 'rgba(20,10,4,0.35)'; x.lineWidth = 1.2;
        for (var sb = 1; sb < 6; sb++) { var sy = -ph2 * sb / 6.2; x.beginPath(); x.moveTo(-24 + sb * 0.5, sy + 2); x.lineTo(-6, sy - 1); x.lineTo(1, sy + 1); x.lineTo(24 - sb * 0.4, sy - 2); x.stroke(); }
        x.strokeStyle = 'rgba(255,236,200,0.6)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(-26, 0); x.lineTo(-20, -ph2 * 0.86); x.lineTo(-8, -ph2 * 0.97); x.lineTo(2, -ph2); x.stroke();
        for (var rb = 0; rb < 5; rb++) { var rx3 = (rb - 2) * 13 + (hash(rb + 3) - 0.5) * 6, rr3 = 3 + hash(rb) * 4, rg3 = x.createLinearGradient(rx3 - rr3, -rr3 * 1.5, rx3 + rr3, 0); rg3.addColorStop(0, '#c8a678'); rg3.addColorStop(1, '#3a2818');
          x.save(); x.translate(rx3, -rr3 * 0.5); x.scale(1.3, 0.8); poly(x, rockPts(rb * 7 + 1, rr3, 6)); x.restore(); x.fillStyle = rg3; x.fill(); }
        x.restore();
        if (a.p < 0.35) { fx.add({ x: bx + rnd(-26, 26), y: f.y - rnd(0, ph2), vx: rnd(-2.5, 2.5), vy: rnd(-5, -1.5), life: 30, size: rnd(2, 4.5), color: Math.random() < 0.5 ? '#9a7650' : '#c8a678', type: 'rock', drag: 0.98, grav: 0.35, spin: rnd(-0.3, 0.3) });
          fx.add({ x: bx + rnd(-30, 30), y: f.y - 6, vx: rnd(-2, 2), vy: rnd(-1.4, -0.3), life: rnd(24, 36), size: rnd(8, 13), color: 'rgba(196,164,120,0.4)', type: 'smoke', drag: 0.94, grav: -0.01 }); }
      } else if (key === 'emberBurst' || key === 'staticPulse') {
        var rr = 40 + a.p * 60;
        x.strokeStyle = Art.alpha(c.color, 1 - a.p); x.lineWidth = 8;
        x.beginPath(); x.arc(f.x, f.y - 64, rr, 0, TAU); x.stroke();
        if (key === 'staticPulse') for (var s = 0; s < 3; s++) { var aa = rnd(0, TAU); lightning(x, f.x, f.y - 64, f.x + Math.cos(aa) * rr, f.y - 64 + Math.sin(aa) * rr, c.color, 2, 4); }
        else fx.burst(f.x, f.y - 64, 3, { speed: 6, life: 16, size: 5, colors: ['#ff6a2a', '#ffcf4a'], type: 'dot' });
      } else if (key === 'blinkStrike') {
        x.strokeStyle = Art.alpha(c.color, 0.9); x.lineWidth = 4;
        x.beginPath(); x.arc(f.x + fc * 30, f.y - 70, 46, -1.2, 1.2); x.stroke();
      } else if (key === 'cinderTrail') {
        fx.add({ x: f.x - fc * 20, y: f.y - rnd(10, 60), vx: -fc * 2, vy: rnd(-1, 0), life: 18, size: 6, color: '#ff8a2a', type: 'dot' });
      } else if (boxes.length && (def.anim === 'tail' || def.anim === 'spin')) {
        // Tail sweeps and spins: a sweeping arc over the hitbox (claws and horns get a real hand trail instead)
        var b = boxes[0];
        var bx0 = fc > 0 ? f.x + b.x * sc[0] : f.x - (b.x + b.w) * sc[0], by0 = f.y + b.y * sc[1];
        var cx = bx0 + b.w * sc[0] / 2, cy = by0 + b.h * sc[1] / 2, rad = Math.max(b.w * sc[0], b.h * sc[1]) * 0.55;
        var col = def.kind === 'heavy' ? c.color : '#ffffff';
        x.strokeStyle = Art.alpha(def.kind === 'heavy' ? col : '#ffffff', 0.85 * (1 - a.p * 0.6)); x.lineCap = 'round';
        var anim = def.anim;
        var start = anim === 'up' ? -Math.PI * 0.95 : anim === 'stomp' ? 0.3 : anim === 'spin' ? 0 : -1.1;
        var span = anim === 'spin' ? TAU * Math.min(1, a.p + 0.3) : anim === 'up' ? Math.PI * 0.9 : 2.2;
        for (var l = 0; l < 3; l++) {
          x.lineWidth = (def.kind === 'heavy' ? 7 : 4) - l * 1.5;
          x.beginPath();
          if (fc > 0) x.arc(cx, cy, rad - l * 6, start, start + span * Math.min(1, 0.35 + a.p));
          else x.arc(cx, cy, rad - l * 6, Math.PI - start - span * Math.min(1, 0.35 + a.p), Math.PI - start);
          x.stroke();
        }
        if (def.kind === 'heavy' && Math.random() < 0.6) fx.add({ x: cx + rnd(-rad, rad) * 0.6, y: cy + rnd(-rad, rad) * 0.6, vx: rnd(-1, 1), vy: rnd(-2, 0), life: 14, size: 4, color: c.glow, type: 'dot' });
      }
    }
    x.restore();
  }

  /**
   * A swing trail following the attacking hand (points from the rig's forward kinematics, newest last).
   * Light attacks leave a clean white streak; heavies and specials carry the element's look.
   */
  function drawTrail(x, pts, element, heavy, fx) {
    if (pts.length < 3) return;
    var n = pts.length, w0 = heavy ? 15 : 9;
    var style = heavy ? element : 'phys';
    var L = [], Rr = [];
    for (var i = 0; i < n; i++) {
      var p = pts[i], q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      var dx = q.x - o.x, dy = q.y - o.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
      var w = w0 * (i / (n - 1)) * Math.min(1, p.a);
      L.push([p.x - dy / l * w, p.y + dx / l * w]); Rr.push([p.x + dy / l * w * 0.35, p.y - dx / l * w * 0.35]);
    }
    var head = pts[n - 1], tail = pts[0];
    x.save();
    if (style === 'lightning') {
      for (var b = 0; b < 2; b++) {
        x.beginPath();
        pts.forEach(function (p, k) { var jx = p.x + rnd(-5, 5), jy = p.y + rnd(-5, 5); if (k) x.lineTo(jx, jy); else x.moveTo(jx, jy); });
        x.strokeStyle = b ? '#ffffff' : '#ffe14a'; x.lineWidth = b ? 2 : 6; x.shadowColor = '#b48cff'; x.shadowBlur = 14; x.stroke();
      }
      if (fx && Math.random() < 0.5) fx.add({ x: head.x, y: head.y, x2: head.x + rnd(-30, 30), y2: head.y + rnd(-30, 30), vx: 0, vy: 0, life: 5, size: 2, color: '#ffe14a', type: 'bolt', drag: 1 });
      x.restore();
      return;
    }
    x.beginPath(); x.moveTo(L[0][0], L[0][1]);
    for (i = 1; i < n; i++) x.lineTo(L[i][0], L[i][1]);
    for (i = n - 1; i >= 0; i--) x.lineTo(Rr[i][0], Rr[i][1]);
    x.closePath();
    var g = x.createLinearGradient(tail.x, tail.y, head.x, head.y);
    var cols = { phys: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)'], fire: ['rgba(255,60,20,0)', 'rgba(255,190,60,0.95)'], ice: ['rgba(127,224,255,0)', 'rgba(232,251,255,0.95)'],
                 earth: ['rgba(120,90,60,0)', 'rgba(216,192,138,0.9)'], water: ['rgba(15,143,160,0)', 'rgba(168,255,244,0.85)'] }[style] || ['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)'];
    g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
    x.fillStyle = g; x.fill();
    if (style === 'ice') { x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 1.2; x.beginPath(); L.forEach(function (p, k) { if (k) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); }); x.stroke(); }
    if (fx && Math.random() < 0.7) {
      if (style === 'fire') fx.add({ x: head.x + rnd(-4, 4), y: head.y + rnd(-4, 4), vx: rnd(-1, 1), vy: rnd(-2, -0.5), life: rnd(14, 22), size: rnd(6, 10), color: '#ff7a2f', type: 'flame', drag: 0.92, grav: -0.05 });
      else if (style === 'ice') fx.add({ x: head.x, y: head.y, vx: rnd(-1, 1), vy: rnd(-1, 1), life: 18, size: 3, color: '#ffffff', type: 'shard', drag: 0.95, grav: 0.1 });
      else if (style === 'earth') fx.add({ x: head.x, y: head.y, vx: rnd(-1, 1), vy: rnd(-1, 0), life: 26, size: 9, color: 'rgba(196,160,110,0.4)', type: 'smoke', drag: 0.95 });
      else if (style === 'water') fx.add({ x: head.x, y: head.y, vx: rnd(-2, 2), vy: rnd(-3, -1), life: 20, size: 2.5, color: '#8ff5ff', type: 'drop', drag: 0.98, grav: 0.3 });
    }
    x.restore();
  }

  /** Element energy around a dragon unleashing its super (drawn in world space, behind it). */
  function drawSuperAura(x, f, setup, t) {
    var c = el(setup.build.element), sc = D.BODIES[setup.build.body].scale, cy = f.y - 75 * sc[1];
    x.save(); x.globalCompositeOperation = 'lighter';
    var R = 170 * sc[1] * (1 + 0.05 * Math.sin(t * 20));
    var g = x.createRadialGradient(f.x, cy, 10, f.x, cy, R);
    g.addColorStop(0, Art.alpha(c.glow, 0.55)); g.addColorStop(0.4, Art.alpha(c.color, 0.3)); g.addColorStop(1, Art.alpha(c.color, 0));
    x.fillStyle = g; x.beginPath(); x.arc(f.x, cy, R, 0, TAU); x.fill();
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * TAU + t * 3, r0 = 60 * sc[1], r1 = (150 + 40 * Math.sin(t * 9 + i)) * sc[1];
      x.strokeStyle = Art.alpha(i % 2 ? c.glow : c.color, 0.5); x.lineWidth = 3;
      x.beginPath(); x.moveTo(f.x + Math.cos(a) * r0, cy + Math.sin(a) * r0); x.lineTo(f.x + Math.cos(a) * r1, cy + Math.sin(a) * r1); x.stroke();
    }
    x.restore();
  }

  /** EX specials and armour: a flickering outline-glow so the extra power reads at a glance. */
  function drawPowerAura(x, f, build, t, armor) {
    var c = el(build.element), sc = D.BODIES[build.body].scale, cy = f.y - 70 * sc[1];
    x.save(); x.globalCompositeOperation = 'lighter';
    var col = armor ? '#ffb03a' : c.glow, R = 95 * sc[1] * (1 + 0.08 * Math.sin(t * 30));
    var g = x.createRadialGradient(f.x, cy, R * 0.4, f.x, cy, R);
    g.addColorStop(0, Art.alpha(col, 0)); g.addColorStop(0.75, Art.alpha(col, 0.22)); g.addColorStop(1, Art.alpha(col, 0));
    x.fillStyle = g; x.beginPath(); x.arc(f.x, cy, R, 0, TAU); x.fill();
    x.restore();
  }

  // ─────────────── arenas ───────────────
  var bgCache = {};
  function stars(seed, n, w, h) {
    var out = [], s = seed;
    for (var i = 0; i < n; i++) { s = (s * 9301 + 49297) % 233280; var a = s / 233280; s = (s * 9301 + 49297) % 233280; var b = s / 233280; out.push([a * w, b * h, (i % 3) + 1]); }
    return out;
  }

  /** Background in screen space with light parallax from the camera. */
  function drawBackdrop(x, arena, cam, W, H, t) {
    var th = arena.theme;
    var g = x.createLinearGradient(0, 0, 0, H);
    if (th === 'dusk') { g.addColorStop(0, '#2b1d5c'); g.addColorStop(0.55, '#8a3a6e'); g.addColorStop(0.85, '#ff8a4a'); g.addColorStop(1, '#ffc46a'); }
    else if (th === 'night') { g.addColorStop(0, '#060d24'); g.addColorStop(0.6, '#163a64'); g.addColorStop(1, '#3a7aa8'); }
    else { g.addColorStop(0, '#141a2a'); g.addColorStop(1, '#1f2a40'); }
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    var px = (cam.x - 800) * 0.05, py = (cam.y - 450) * 0.05;
    if (th === 'grid') {
      x.strokeStyle = 'rgba(120,160,255,0.08)'; x.lineWidth = 1;
      for (var gx = -((cam.x * 0.3) % 60); gx < W; gx += 60) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); }
      for (var gy = -((cam.y * 0.3) % 60); gy < H; gy += 60) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }
      return;
    }
    var key = th + W + 'x' + H;
    var st = bgCache[key] || (bgCache[key] = stars(th === 'night' ? 7 : 3, th === 'night' ? 160 : 70, W, H * 0.6));
    x.fillStyle = 'rgba(255,255,255,0.75)';
    st.forEach(function (s, i) { x.globalAlpha = 0.4 + 0.4 * Math.sin(t * 1.5 + i); x.fillRect(s[0] - px * 0.3, s[1] - py * 0.3, s[2], s[2]); });
    x.globalAlpha = 1;
    if (th === 'night') {
      // Aurora
      for (var a = 0; a < 3; a++) {
        x.fillStyle = ['rgba(47,211,200,0.10)', 'rgba(127,224,255,0.08)', 'rgba(180,140,255,0.07)'][a];
        x.beginPath(); x.moveTo(0, H * 0.25 + a * 30);
        for (var ax = 0; ax <= W; ax += 40) x.lineTo(ax, H * 0.2 + a * 40 + Math.sin(ax * 0.006 + t * 0.4 + a) * 40);
        x.lineTo(W, 0); x.lineTo(0, 0); x.fill();
      }
    } else {
      // Sun
      var sg = x.createRadialGradient(W * 0.72 - px, H * 0.62 - py, 10, W * 0.72 - px, H * 0.62 - py, H * 0.45);
      sg.addColorStop(0, 'rgba(255,240,190,0.95)'); sg.addColorStop(0.15, 'rgba(255,190,110,0.6)'); sg.addColorStop(1, 'rgba(255,140,80,0)');
      x.fillStyle = sg; x.fillRect(0, 0, W, H);
    }
    // Mountains (two layers)
    [[0.15, th === 'night' ? '#0f2846' : '#5a2a5e', 0.62, 70], [0.3, th === 'night' ? '#0a1a30' : '#3a1a46', 0.74, 110]].forEach(function (L, li) {
      x.fillStyle = L[1];
      x.beginPath(); x.moveTo(0, H);
      for (var mx = -40; mx <= W + 40; mx += 30) {
        var hgt = Math.sin(mx * 0.004 + li * 3) * L[3] + Math.sin(mx * 0.013 + li) * L[3] * 0.35;
        x.lineTo(mx - px * L[0] * 20, H * L[2] - hgt - py * L[0] * 10);
      }
      x.lineTo(W, H); x.closePath(); x.fill();
    });
    // Distant spires and towers: the Skyforge's silhouette (deeper parallax than the mountains)
    var spireCol = th === 'night' ? 'rgba(20,46,76,0.9)' : 'rgba(70,30,74,0.85)';
    x.fillStyle = spireCol;
    [[0.08, 0.5, 26], [0.2, 0.42, 18], [0.83, 0.38, 30], [0.93, 0.47, 20], [0.68, 0.52, 14]].forEach(function (sp, i) {
      var sx = W * sp[0] - px * 6, sy = H * sp[1] - py * 4, sw = sp[2];
      x.beginPath(); x.moveTo(sx - sw, H * 0.75); x.lineTo(sx - sw * 0.6, sy + 30); x.lineTo(sx, sy - 40); x.lineTo(sx + sw * 0.6, sy + 30); x.lineTo(sx + sw, H * 0.75); x.fill();
      // Lit windows
      x.fillStyle = th === 'night' ? 'rgba(127,224,255,0.55)' : 'rgba(255,200,120,0.6)';
      for (var wi = 0; wi < 3; wi++) x.fillRect(sx - 2, sy + 40 + wi * 22, 4, 7);
      x.fillStyle = spireCol;
    });
    // Light shafts from the sun (dusk) or the aurora (night): soft, additive, slow
    x.save(); x.globalCompositeOperation = 'lighter';
    for (var ls = 0; ls < 4; ls++) {
      var lx = W * (0.55 + ls * 0.09) - px * 2, a = 0.035 + 0.02 * Math.sin(t * 0.4 + ls);
      var lg = x.createLinearGradient(lx, 0, lx - W * 0.25, H);
      lg.addColorStop(0, th === 'night' ? 'rgba(127,224,255,' + a + ')' : 'rgba(255,210,150,' + a + ')'); lg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = lg; x.beginPath(); x.moveTo(lx, 0); x.lineTo(lx + 60, 0); x.lineTo(lx - W * 0.2, H); x.lineTo(lx - W * 0.28, H); x.fill();
    }
    x.restore();
    // Cloud bands drifting across, two speeds
    for (var cl = 0; cl < 6; cl++) {
      var spd = cl % 2 ? 6 : 11, cw = W * 0.35;
      var cx = ((cl * W * 0.37 + t * spd) % (W + cw * 2)) - cw - px * (cl % 2 ? 3 : 8), cy = H * (0.22 + (cl % 3) * 0.12) - py * 3;
      var cg = x.createRadialGradient(cx, cy, 0, cx, cy, cw * 0.5);
      cg.addColorStop(0, th === 'night' ? 'rgba(160,200,255,0.10)' : 'rgba(255,190,200,0.13)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = cg; x.save(); x.translate(cx, cy); x.scale(1, 0.28); x.translate(-cx, -cy); x.beginPath(); x.arc(cx, cy, cw * 0.5, 0, TAU); x.fill(); x.restore();
    }
    // Floating rocks with a lit rim
    for (var r = 0; r < 5; r++) {
      var rx = (W * (0.1 + r * 0.2) - px * 4 + Math.sin(t * 0.3 + r) * 6), ry = H * (0.35 + (r % 2) * 0.12) + Math.sin(t * 0.6 + r * 2) * 8 - py * 3;
      x.fillStyle = th === 'night' ? '#1c3550' : '#4a2446';
      x.beginPath(); x.moveTo(rx - 30, ry); x.lineTo(rx + 30, ry); x.lineTo(rx + 12, ry + 26); x.lineTo(rx - 8, ry + 30); x.closePath(); x.fill();
      x.fillStyle = th === 'night' ? 'rgba(200,240,255,0.5)' : 'rgba(255,190,120,0.55)'; x.fillRect(rx - 30, ry - 2, 60, 3);
    }
    if (th === 'night') {
      // Snowfall (screen space, very light)
      x.fillStyle = 'rgba(235,248,255,0.7)';
      for (var sn = 0; sn < 70; sn++) { var sx2 = (sn * 97.3 + t * (12 + sn % 5 * 4) + Math.sin(t + sn) * 10) % W, sy2 = (sn * 53.7 + t * (28 + sn % 7 * 6)) % H; x.fillRect(sx2, sy2, 1.6 + sn % 2, 1.6 + sn % 2); }
    }
  }

  /** Screen-space finishing pass: a soft vignette so the centre (and the fighters) carry the light. */
  function drawVignette(x, W, H, th) {
    var g = x.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75);
    var T = window.DCScenery && window.DCScenery.THEMES[th];
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, T && T.vignette ? T.vignette : th === 'grid' ? 'rgba(0,0,10,0.35)' : 'rgba(10,4,24,0.45)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }

  function drawPlatforms(x, arena, t) {
    var th = arena.theme;
    arena.platforms.forEach(function (p) {
      if (p.solid) {
        // Body of the island
        var g = x.createLinearGradient(0, p.y, 0, p.y + p.h);
        if (th === 'night') { g.addColorStop(0, '#5a7a9a'); g.addColorStop(1, '#1a2a3e'); }
        else if (th === 'grid') { g.addColorStop(0, '#3a4a6a'); g.addColorStop(1, '#1a2238'); }
        else { g.addColorStop(0, '#7a5a6a'); g.addColorStop(1, '#2e1a2e'); }
        x.fillStyle = g;
        x.beginPath(); x.moveTo(p.x, p.y);
        x.lineTo(p.x + p.w, p.y); x.lineTo(p.x + p.w - 20, p.y + p.h * 0.55); x.lineTo(p.x + p.w * 0.65, p.y + p.h); x.lineTo(p.x + p.w * 0.35, p.y + p.h * 0.95); x.lineTo(p.x + 20, p.y + p.h * 0.55);
        x.closePath(); x.fill();
        // Rock strata and cracks
        x.save(); x.clip();
        x.strokeStyle = th === 'night' ? 'rgba(200,240,255,0.10)' : 'rgba(255,220,180,0.10)'; x.lineWidth = 3;
        for (var st = 1; st < 5; st++) { x.beginPath(); x.moveTo(p.x, p.y + st * p.h / 5.5); for (var sx3 = p.x; sx3 <= p.x + p.w; sx3 += 40) x.lineTo(sx3, p.y + st * p.h / 5.5 + Math.sin(sx3 * 0.05 + st) * 4); x.stroke(); }
        x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2;
        for (var ck = 0; ck < 7; ck++) { var cx3 = p.x + 60 + ck * (p.w - 120) / 6; x.beginPath(); x.moveTo(cx3, p.y + 10); x.lineTo(cx3 + 8, p.y + 34); x.lineTo(cx3 - 4, p.y + 58); x.stroke(); }
        x.restore();
        // Moss (dusk) or snow (night) cap hanging over the lip
        x.fillStyle = th === 'night' ? '#e8f6ff' : th === 'grid' ? '#5a6a9a' : '#6a8a4a';
        for (var mz = p.x; mz < p.x + p.w; mz += 18) { x.beginPath(); x.moveTo(mz, p.y + 4); x.quadraticCurveTo(mz + 9, p.y + 12 + Math.sin(mz) * 4, mz + 18, p.y + 4); x.fill(); }
        // Top surface and bright edges so the ledges read clearly
        x.fillStyle = th === 'night' ? '#cfefff' : th === 'grid' ? '#8aa8ff' : '#ffd38a';
        x.fillRect(p.x, p.y - 2, p.w, 8);
        x.fillStyle = th === 'night' ? '#e8fbff' : th === 'grid' ? '#c8d8ff' : '#fff0c0';
        x.fillRect(p.x, p.y - 2, p.w, 2);
        x.fillStyle = 'rgba(255,255,255,0.9)';
        x.fillRect(p.x - 3, p.y - 3, 8, 10); x.fillRect(p.x + p.w - 5, p.y - 3, 8, 10);
        if (th === 'dusk') {
          x.fillStyle = 'rgba(255,200,120,0.15)';
          for (var k = 0; k < 6; k++) x.fillRect(p.x + 40 + k * (p.w - 80) / 5, p.y + 16, 4, 30);
        }
        if (th === 'grid') {
          x.fillStyle = 'rgba(200,220,255,0.35)'; x.font = '11px system-ui';
          for (var m = 0; m <= p.w; m += 100) { x.fillRect(p.x + m, p.y + 6, 1, 10); x.fillText(String(m), p.x + m + 3, p.y + 18); }
        }
      } else {
        x.fillStyle = th === 'night' ? 'rgba(200,240,255,0.85)' : th === 'grid' ? 'rgba(160,190,255,0.85)' : 'rgba(255,220,160,0.9)';
        x.fillRect(p.x, p.y, p.w, 6);
        x.fillStyle = 'rgba(255,255,255,0.25)';
        x.fillRect(p.x + 6, p.y + 6, p.w - 12, p.h - 6);
        x.fillStyle = th === 'night' ? 'rgba(127,224,255,0.12)' : 'rgba(255,200,120,0.12)';
        x.fillRect(p.x, p.y + 8, p.w, 20 + Math.sin(t * 2 + p.x) * 3);
      }
    });
  }

  window.DCFX = { FX: FX, drawVignette: drawVignette, drawSuperAura: drawSuperAura, drawPowerAura: drawPowerAura, drawTrail: drawTrail, drawProjectile: drawProjectile, drawStructure: drawStructure, drawAttackFx: drawAttackFx,
                  drawBackdrop: drawBackdrop, drawPlatforms: drawPlatforms, lightning: lightning, el: el };
})();
