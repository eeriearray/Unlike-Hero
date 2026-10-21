/*
 * Dragon Clash — visual effects and arenas.
 * Particles, projectiles, attack trails, elemental specials, hit sparks, KO blasts and the arena backdrops.
 * Effects are bright but short and capped, so the dragons stay readable.
 */
(function () {
  'use strict';
  var D = window.DC.Data, Art = window.DCArt;
  var TAU = Math.PI * 2;
  var MAX_PARTICLES = 700;

  function el(id) { return D.ELEMENTS[id] || { color: '#ffffff', glow: '#ffffff', dark: '#444444' }; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function FX() { this.parts = []; this.shake = 0; this.flash = 0; this.popups = []; }

  FX.prototype.add = function (p) {
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
        this.addShake(e.kb > 12 ? Math.min(8, (e.kb - 10) * 0.45) : 0, settings);
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
      case 'attack':
        // Wing-burst gust handled on jump; nothing here.
        break;
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
          x.globalAlpha = k * 0.6; x.fillStyle = p.color; x.beginPath(); x.arc(p.x, p.y, p.size * (2 - k), 0, TAU); x.fill();
          break;
        case 'shard':
          x.fillStyle = p.color; x.save(); x.translate(p.x, p.y); x.rotate(p.life * 0.3);
          x.beginPath(); x.moveTo(0, -p.size); x.lineTo(p.size * 0.5, p.size * 0.6); x.lineTo(-p.size * 0.5, p.size * 0.6); x.fill(); x.restore();
          break;
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
          x.save(); x.translate(p.x, p.y); x.rotate(p.rotA); x.fillStyle = p.color; x.strokeStyle = 'rgba(40,26,12,0.9)'; x.lineWidth = 1;
          x.beginPath(); x.moveTo(-p.size, -p.size * 0.3); x.lineTo(-p.size * 0.2, -p.size); x.lineTo(p.size, -p.size * 0.4); x.lineTo(p.size * 0.6, p.size * 0.7); x.lineTo(-p.size * 0.6, p.size * 0.8); x.closePath(); x.fill(); x.stroke();
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
    x.textAlign = 'center'; x.font = '900 18px "Lilita One", system-ui, sans-serif';
    this.popups.forEach(function (p) {
      x.globalAlpha = Math.min(1, p.life / 15);
      x.lineWidth = 4; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.strokeText(p.text, p.x, p.y);
      x.fillStyle = p.color; x.fillText(p.text, p.x, p.y);
    });
    x.restore();
  };

  function hex(c) { return c && c[0] === '#' ? c : '#ffffff'; }

  function lightning(x, x0, y0, x1, y1, color, w, segs) {
    x.save();
    x.strokeStyle = color; x.lineWidth = w; x.lineJoin = 'round'; x.shadowColor = color; x.shadowBlur = 12;
    x.beginPath(); x.moveTo(x0, y0);
    for (var i = 1; i < segs; i++) {
      var k = i / segs;
      x.lineTo(x0 + (x1 - x0) * k + rnd(-10, 10), y0 + (y1 - y0) * k + rnd(-10, 10));
    }
    x.lineTo(x1, y1); x.stroke();
    x.strokeStyle = '#ffffff'; x.lineWidth = w * 0.4; x.shadowBlur = 0; x.stroke();
    x.restore();
  }

  // ─────────────── projectiles & structures ───────────────
  function drawProjectile(x, p, t, fx) {
    var c = el(p.el);
    x.save();
    x.translate(p.x, p.y);
    var dir = p.vx < 0 ? -1 : 1;
    switch (p.ty) {
      case 'fireball': {
        var g = x.createRadialGradient(0, 0, 0, 0, 0, 26);
        g.addColorStop(0, '#fff6c8'); g.addColorStop(0.35, '#ffb02e'); g.addColorStop(0.7, 'rgba(255,90,30,0.7)'); g.addColorStop(1, 'rgba(255,60,20,0)');
        x.fillStyle = g; x.beginPath(); x.arc(0, 0, 26, 0, TAU); x.fill();
        if (fx && Math.random() < 0.8) fx.add({ x: p.x - dir * 10, y: p.y + rnd(-6, 6), vx: -dir * rnd(1, 3), vy: rnd(-1.5, 0.5), life: 18, size: rnd(3, 7), color: Math.random() < 0.5 ? '#ff6a2a' : '#ffcf4a', type: 'dot' });
        break;
      }
      case 'iceShard':
      case 'lance': {
        var L = p.ty === 'lance' ? 40 : 24;
        x.scale(dir, 1);
        x.fillStyle = 'rgba(200,245,255,0.95)'; x.strokeStyle = '#ffffff'; x.lineWidth = 1.5;
        x.shadowColor = c.color; x.shadowBlur = 14;
        x.beginPath(); x.moveTo(L, 0); x.lineTo(-L * 0.4, -p.h / 2); x.lineTo(-L, 0); x.lineTo(-L * 0.4, p.h / 2); x.closePath(); x.fill(); x.stroke();
        if (fx && Math.random() < 0.5) fx.add({ x: p.x - dir * L, y: p.y + rnd(-5, 5), vx: 0, vy: rnd(-0.5, 0.5), life: 20, size: 3, color: '#e8fbff', type: 'dot' });
        break;
      }
      case 'bolt':
        x.restore();
        lightning(x, p.x - dir * 30, p.y, p.x + dir * 24, p.y, c.color, 4, 5);
        lightning(x, p.x - dir * 30, p.y, p.x + dir * 24, p.y, c.glow, 2, 4);
        return;
      case 'boulder': {
        x.rotate(t * 6 * dir);
        x.fillStyle = '#8a6a4a'; x.strokeStyle = '#3a2814'; x.lineWidth = 2.5;
        x.beginPath();
        for (var i = 0; i < 8; i++) { var a = i / 8 * TAU, r = 20 + (i % 3) * 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        x.closePath(); x.fill(); x.stroke();
        x.strokeStyle = 'rgba(255,220,160,0.35)'; x.beginPath(); x.moveTo(-8, -6); x.lineTo(6, 4); x.stroke();
        break;
      }
      case 'wave': {
        x.scale(dir, 1);
        var gw = x.createLinearGradient(0, -p.h, 0, 0);
        gw.addColorStop(0, 'rgba(168,255,244,0.95)'); gw.addColorStop(1, 'rgba(15,143,160,0.9)');
        x.fillStyle = gw;
        x.beginPath(); x.moveTo(-p.w / 2 - 20, 0);
        x.quadraticCurveTo(-p.w / 2, -p.h * 0.6, p.w / 4, -p.h);
        x.quadraticCurveTo(p.w / 2 + 6, -p.h + 4, p.w / 2, -p.h * 0.6 + Math.sin(t * 10) * 3);
        x.quadraticCurveTo(p.w / 2 - 10, -p.h * 0.8, p.w / 2 - 4, 0);
        x.closePath(); x.fill();
        x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 2; x.stroke();
        if (fx && Math.random() < 0.6) fx.add({ x: p.x + dir * p.w / 2, y: p.y - p.h * 0.8, vx: dir * rnd(0, 2), vy: rnd(-3, -1), life: 18, size: 3, color: '#c8fff8', type: 'dot', grav: 0.2 });
        break;
      }
      case 'quake': {
        x.fillStyle = '#7a5a3a';
        for (var q = 0; q < 4; q++) { x.beginPath(); x.moveTo(-p.w / 2 + q * 12, 0); x.lineTo(-p.w / 2 + q * 12 + 6, -12 - (q % 2) * 12 - Math.sin(t * 20 + q) * 4); x.lineTo(-p.w / 2 + q * 12 + 12, 0); x.fill(); }
        if (fx && Math.random() < 0.6) fx.add({ x: p.x, y: p.y, vx: rnd(-1, 1), vy: rnd(-4, -2), life: 20, size: 4, color: '#a0794a', type: 'shard', grav: 0.3 });
        break;
      }
      case 'chillField': {
        var active = p.dl <= 0;
        x.strokeStyle = active ? 'rgba(200,245,255,0.9)' : 'rgba(200,245,255,' + (0.4 + 0.3 * Math.sin(t * 20)) + ')';
        x.setLineDash(active ? [] : [8, 6]); x.lineWidth = 3;
        x.beginPath(); x.ellipse(0, -p.h / 2, p.w / 2, p.h / 2, 0, 0, TAU); x.stroke();
        if (active) { x.fillStyle = 'rgba(160,230,255,0.28)'; x.fill(); }
        x.setLineDash([]);
        break;
      }
      case 'puddle': {
        x.fillStyle = 'rgba(47,211,200,0.45)'; x.strokeStyle = 'rgba(168,255,244,0.8)'; x.lineWidth = 2;
        x.beginPath(); x.ellipse(0, -3, p.w / 2, 8, 0, 0, TAU); x.fill(); x.stroke();
        x.strokeStyle = 'rgba(255,255,255,0.5)';
        x.beginPath(); x.ellipse(Math.sin(t * 2) * 20, -3, 14 + (t * 20 % 20), 3, 0, 0, TAU); x.stroke();
        break;
      }
      case 'whirlpool': {
        x.strokeStyle = 'rgba(47,211,200,0.85)'; x.lineWidth = 4;
        for (var w = 0; w < 3; w++) { x.beginPath(); x.arc(0, 0, 20 + w * 14, t * 8 + w * 2, t * 8 + w * 2 + 4); x.stroke(); }
        x.fillStyle = 'rgba(15,143,160,0.25)'; x.beginPath(); x.arc(0, 0, 55, 0, TAU); x.fill();
        break;
      }
      case 'flames': {
        var k = Math.min(1, p.l / 30);
        for (var fl = 0; fl < 3; fl++) {
          var h = (18 + Math.sin(t * 16 + fl * 2 + p.id) * 6) * k;
          x.fillStyle = ['rgba(255,90,30,0.85)', 'rgba(255,170,40,0.85)', 'rgba(255,240,150,0.9)'][fl];
          x.beginPath(); x.moveTo(-12 + fl * 4, 0); x.quadraticCurveTo(-4 + fl * 3, -h, 2 + fl * 2, -h * 1.2); x.quadraticCurveTo(8, -h * 0.5, 12 - fl * 3, 0); x.fill();
        }
        break;
      }
    }
    x.restore();
  }

  function drawStructure(x, s, t) {
    if (s.ty === 'iceWall') {
      x.save();
      var k = Math.min(1, s.l / 20);
      x.globalAlpha = k;
      var g = x.createLinearGradient(s.x, s.y, s.x + s.w, s.y + s.h);
      g.addColorStop(0, 'rgba(232,251,255,0.95)'); g.addColorStop(1, 'rgba(95,184,255,0.85)');
      x.fillStyle = g; x.strokeStyle = '#ffffff'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(s.x, s.y + s.h); x.lineTo(s.x - 4, s.y + 30); x.lineTo(s.x + s.w * 0.3, s.y); x.lineTo(s.x + s.w * 0.7, s.y + 14); x.lineTo(s.x + s.w + 4, s.y + 40); x.lineTo(s.x + s.w, s.y + s.h); x.closePath();
      x.fill(); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,0.6)'; x.beginPath(); x.moveTo(s.x + 8, s.y + s.h - 10); x.lineTo(s.x + s.w * 0.4, s.y + 20); x.stroke();
      x.restore();
    }
  }

  // Instant specials and melee trails drawn from a fighter's current move.
  function drawAttackFx(x, f, setup, t, fx, pose) {
    if (f.st !== 'attack' || !f.mv) return;
    var build = setup.build;
    var a = window.DCAnim.attackPhase(f, build);
    if (!a) return;
    var def = a.def, c = el(build.element), fc = f.fc;
    var sc = D.BODIES[build.body].scale;
    var mouth = pose && pose.bones ? Art.pointOf('mouth', build.body, pose) : Art.anchor('mouth', build.body, fc, 0);
    var mx = f.x + mouth[0], my = f.y + mouth[1];
    x.save();
    // Telegraph: element glow at the mouth during startup of specials and heavies
    if (a.phase === 'startup' && (f.mv === 'sig' || f.mv === 'ability' || def.kind === 'heavy')) {
      // Energy gathers where the blow will come from: the claw for melee, the mouth for breath
      var src = pose && pose.bones ? Art.pointOf(window.DCAnim.attackKey(f, build, def) === 'breath' ? 'mouth' : 'nearHand', build.body, pose) : mouth;
      mx = f.x + src[0]; my = f.y + src[1];
      var r = 6 + a.p * 22;
      var g = x.createRadialGradient(mx, my, 0, mx, my, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, Art.alpha(c.color, 0.8)); g.addColorStop(1, Art.alpha(c.color, 0));
      x.fillStyle = g; x.beginPath(); x.arc(mx, my, r, 0, TAU); x.fill();
      if (f.mv === 'sig' && def === D.SIGNATURES.rockPillar) {
        // Rumble where the pillar will rise
        var px = f.x + fc * (150 + 28) * sc[0];
        x.fillStyle = 'rgba(160,121,74,' + (0.3 + a.p * 0.5) + ')';
        x.fillRect(px - 30, f.y - 6 - Math.random() * 4, 60, 6);
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
        var jx = f.x + fc * 28 * sc[0], jy = f.y - 89 * sc[1];
        var jg = x.createLinearGradient(jx, jy, jx + fc * 200, jy);
        jg.addColorStop(0, 'rgba(168,255,244,0.95)'); jg.addColorStop(1, 'rgba(47,211,200,0.25)');
        x.fillStyle = jg; x.fillRect(Math.min(jx, jx + fc * 200), jy - 12 - Math.sin(t * 40) * 2, 200, 24 + Math.sin(t * 40) * 4);
        fx.add({ x: jx + fc * 200, y: jy, vx: fc * rnd(1, 3), vy: rnd(-3, 1), life: 16, size: 4, color: '#c8fff8', type: 'dot', grav: 0.25 });
      } else if (key === 'rockPillar') {
        var bx = f.x + fc * (150 + 28) * sc[0], k = Math.min(1, a.p * 3);
        x.fillStyle = '#8a6a4a'; x.strokeStyle = '#3a2814'; x.lineWidth = 3;
        x.beginPath(); x.moveTo(bx - 26, f.y); x.lineTo(bx - 18, f.y - 130 * k); x.lineTo(bx + 4, f.y - 150 * k); x.lineTo(bx + 22, f.y - 124 * k); x.lineTo(bx + 26, f.y); x.closePath(); x.fill(); x.stroke();
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
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, th === 'grid' ? 'rgba(0,0,10,0.35)' : 'rgba(10,4,24,0.45)');
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

  window.DCFX = { FX: FX, drawVignette: drawVignette, drawTrail: drawTrail, drawProjectile: drawProjectile, drawStructure: drawStructure, drawAttackFx: drawAttackFx,
                  drawBackdrop: drawBackdrop, drawPlatforms: drawPlatforms, lightning: lightning, el: el };
})();
