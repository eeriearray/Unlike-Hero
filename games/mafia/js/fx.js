/* Mafia — visual effects: a canvas particle system (ambient layer behind the UI, bursts above it), screen shake and flashes.
   window.MafiaFX: burst(type, x, y, n), burstAt(element, type, n), ambient(type|null), shake(hard), flash(color). */
(function (global) {
  'use strict';
  var canvas, g, bgCanvas, bg, W = 0, H = 0, dpr = 1;
  var parts = [], ambientType = null, running = false, last = 0;
  var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setup() {
    canvas = document.getElementById('fx');
    bgCanvas = document.getElementById('fx-bg') || canvas;
    if (!canvas) return false;
    g = canvas.getContext('2d');
    bg = bgCanvas.getContext('2d');
    resize();
    global.addEventListener('resize', resize);
    return true;
  }
  function resize() {
    dpr = Math.min(2, global.devicePixelRatio || 1);
    W = global.innerWidth; H = global.innerHeight;
    [canvas, bgCanvas].forEach(function (c) { c.width = W * dpr; c.height = H * dpr; c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); });
  }
  function rand(a, b) { return a + Math.random() * (b - a); }

  var MAKERS = {
    blood: function (x, y) {
      var a = rand(0, Math.PI * 2), s = rand(2, 9);
      return { x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, g: 0.32, r: rand(2, 6), life: rand(50, 90), color: 'hsl(' + rand(350, 360) + ',85%,' + rand(28, 45) + '%)', drag: 0.985, shape: 'drop' };
    },
    confetti: function (x, y) {
      var a = rand(-Math.PI * 0.85, -Math.PI * 0.15), s = rand(6, 15);
      return { x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.22, r: rand(4, 8), life: rand(110, 170), color: 'hsl(' + rand(0, 360) + ',80%,60%)', drag: 0.985, rot: rand(0, 6), vr: rand(-0.3, 0.3), shape: 'rect' };
    },
    gold: function (x, y) {
      var a = rand(-Math.PI * 0.9, -Math.PI * 0.1), s = rand(4, 12);
      return { x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.18, r: rand(3, 7), life: rand(100, 160), color: 'hsl(' + rand(40, 52) + ',85%,' + rand(50, 70) + '%)', drag: 0.985, rot: rand(0, 6), vr: rand(-0.3, 0.3), shape: 'rect' };
    },
    sparkle: function (x, y) {
      var a = rand(0, Math.PI * 2), s = rand(1, 4);
      return { x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, g: -0.02, r: rand(1.5, 3.5), life: rand(40, 80), color: 'hsl(' + rand(130, 160) + ',80%,70%)', drag: 0.96, shape: 'glow' };
    },
    ghost: function (x, y) {
      return { x: x + rand(-30, 30), y: y, vx: rand(-0.4, 0.4), vy: rand(-1.6, -0.6), g: 0, r: rand(8, 20), life: rand(80, 140), color: 'rgba(200,215,255,', drag: 1, shape: 'wisp' };
    },
    embers: function () {
      return { x: rand(0, W), y: H + 10, vx: rand(-0.3, 0.3), vy: rand(-1.4, -0.5), g: 0, r: rand(1, 2.6), life: rand(240, 420), color: 'hsl(' + rand(20, 40) + ',95%,60%)', drag: 1, shape: 'glow', wobble: rand(0, 6) };
    },
    motes: function () {
      return { x: rand(0, W), y: rand(0, H), vx: rand(-0.15, 0.15), vy: rand(-0.2, 0.05), g: 0, r: rand(0.8, 2), life: rand(300, 500), color: 'hsl(' + rand(210, 230) + ',60%,80%)', drag: 1, shape: 'glow', wobble: rand(0, 6) };
    },
    rain: function () {
      return { x: rand(-50, W + 50), y: rand(-60, -10), vx: -1.5, vy: rand(12, 18), g: 0, r: rand(10, 22), life: 120, color: 'rgba(170,190,220,0.35)', drag: 1, shape: 'line' };
    }
  };
  var AMBIENT_RATE = { embers: 0.35, motes: 0.25, rain: 5 };

  function step(t) {
    var dt = Math.min(3, (t - last) / 16.67 || 1); last = t;
    var top = g;
    top.clearRect(0, 0, W, H);
    if (bg !== top) bg.clearRect(0, 0, W, H);
    if (ambientType && !reduced) {
      var n = AMBIENT_RATE[ambientType] * dt;
      while (n > 0) { if (Math.random() < n) { var a = MAKERS[ambientType](); a.ambient = true; parts.push(a); } n -= 1; }
    }
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      g = p.ambient ? bg : top;
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g * dt;
      p.x += p.vx * dt + (p.wobble != null ? Math.sin((p.life + p.wobble) * 0.05) * 0.3 : 0);
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.y > H + 40 || p.y < -80) { parts.splice(i, 1); continue; }
      var alpha = Math.min(1, p.life / 40);
      g.globalAlpha = alpha;
      switch (p.shape) {
        case 'rect':
          p.rot += p.vr * dt;
          g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.color; g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); g.restore();
          break;
        case 'line':
          g.strokeStyle = p.color; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + p.vx, p.y - p.r); g.stroke();
          break;
        case 'wisp':
          var grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          grd.addColorStop(0, p.color + (0.35 * alpha) + ')'); grd.addColorStop(1, p.color + '0)');
          g.fillStyle = grd; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
          break;
        case 'glow':
          g.fillStyle = p.color; g.shadowColor = p.color; g.shadowBlur = 8;
          g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
          break;
        default: // drop
          g.fillStyle = p.color; g.beginPath(); g.ellipse(p.x, p.y, p.r * 0.75, p.r, Math.atan2(p.vy, p.vx) + Math.PI / 2, 0, Math.PI * 2); g.fill();
      }
    }
    g = top;
    g.globalAlpha = 1; bg.globalAlpha = 1;
    if (parts.length || ambientType) global.requestAnimationFrame(step);
    else running = false;
  }
  function kick() { if (!running && (canvas || setup())) { running = true; last = performance.now(); global.requestAnimationFrame(step); } }

  var API = {
    burst: function (type, x, y, n) {
      if (!MAKERS[type] || (!canvas && !setup())) return;
      n = reduced ? Math.min(6, n || 30) : (n || 30);
      for (var i = 0; i < n; i++) parts.push(MAKERS[type](x, y));
      if (parts.length > 900) parts.splice(0, parts.length - 900);
      kick();
    },
    burstAt: function (el, type, n) {
      if (!el) { API.burst(type, global.innerWidth / 2, global.innerHeight / 2, n); return; }
      var r = el.getBoundingClientRect();
      API.burst(type, r.left + r.width / 2, r.top + r.height / 2, n);
    },
    ambient: function (type) {
      var next = MAKERS[type] && AMBIENT_RATE[type] ? type : null;
      if (next !== ambientType) parts.forEach(function (p) { if (p.ambient) p.life = Math.min(p.life, 40); }); // fade the old weather out
      ambientType = next;
      if (ambientType) kick();
    },
    shake: function (hard) {
      if (reduced) return;
      var el = document.querySelector('.app');
      if (!el) return;
      var cls = hard ? 'shake-hard' : 'shake';
      el.classList.remove('shake', 'shake-hard'); void el.offsetWidth; el.classList.add(cls);
      setTimeout(function () { el.classList.remove(cls); }, 900);
      if (navigator.vibrate) { try { navigator.vibrate(hard ? [80, 40, 120] : 60); } catch (e) { /* unsupported */ } }
    },
    flash: function (color) {
      var d = document.createElement('div');
      d.className = 'flash'; d.style.background = color || 'rgba(208,26,51,.55)';
      document.body.appendChild(d);
      setTimeout(function () { d.remove(); }, 800);
    }
  };
  global.MafiaFX = API;
})(window);
