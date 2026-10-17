/* Putt Club — particles and screen effects. One pooled point cloud (fixed capacity, recycled) plus a few
 * pooled ripple rings, so effects can never grow without bound. Confetti Chaos is a 2D overlay that keeps
 * the centre of the screen, the ball and the controls clear. */
(function (global) {
  'use strict';
  var PC = global.PC, THREE = global.THREE;
  var CAP = 1400;

  function Particles(scene) {
    this.n = 0; this.head = 0;
    this.pos = new Float32Array(CAP * 3); this.vel = new Float32Array(CAP * 3); this.col = new Float32Array(CAP * 3);
    this.size = new Float32Array(CAP); this.life = new Float32Array(CAP); this.max = new Float32Array(CAP); this.drag = new Float32Array(CAP); this.grav = new Float32Array(CAP); this.alpha = new Float32Array(CAP);
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, vertexColors: true,
      uniforms: { scale: { value: 400 } },
      vertexShader: 'attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard; gl_FragColor = vec4(vC, vA * smoothstep(0.5, 0.25, d)); }'
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 10;
    scene.add(this.points);
    // Expanding ripple rings (splashes, shield pops, landings).
    this.rings = [];
    for (var i = 0; i < 10; i++) {
      var m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m);
      this.rings.push({ m: m, t: 0, dur: 1, from: 0.2, to: 1.5 });
    }
    this.ringHead = 0;
    this.reduced = PC.reducedMotion();
  }

  var tmpC = new THREE.Color();
  Particles.prototype.emit = function (x, y, z, vx, vy, vz, color, size, life, grav, drag) {
    var i = this.head; this.head = (this.head + 1) % CAP; if (this.n < CAP) this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    tmpC.set(color); this.col[i * 3] = tmpC.r; this.col[i * 3 + 1] = tmpC.g; this.col[i * 3 + 2] = tmpC.b;
    this.size[i] = size; this.life[i] = life; this.max[i] = life; this.grav[i] = grav == null ? 9 : grav; this.drag[i] = drag == null ? 1.5 : drag;
  };

  Particles.prototype.ring = function (x, y, z, color, from, to, dur) {
    var r = this.rings[this.ringHead]; this.ringHead = (this.ringHead + 1) % this.rings.length;
    r.m.position.set(x, y, z); r.m.material.color.set(color); r.t = 0; r.dur = dur || 0.8; r.from = from || 0.2; r.to = to || 1.4; r.m.visible = true;
  };

  Particles.prototype.update = function (dt) {
    for (var i = 0; i < CAP; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      var d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      var k = this.life[i] / this.max[i];
      this.alpha[i] = Math.max(0, Math.min(1, k * 1.6));
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.alpha.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true; this.geo.attributes.size.needsUpdate = true;
    for (var j = 0; j < this.rings.length; j++) {
      var r = this.rings[j];
      if (!r.m.visible) continue;
      r.t += dt;
      var u = r.t / r.dur;
      if (u >= 1) { r.m.visible = false; continue; }
      var s = PC.lerp(r.from, r.to, PC.easeOutCubic(u));
      r.m.scale.set(s, s, s); r.m.material.opacity = (1 - u) * 0.8;
    }
  };

  function rnd(a, b) { return a + Math.random() * (b - a); }
  var CONFETTI = ['#ef6a43', '#f2bd47', '#5fb8b0', '#f6ecd8', '#e45b8f', '#5b7cfa'];
  var IMPACT = { wood: '#c49a6c', stone: '#d8d0c0', metal: '#ffd27a', brass: '#ffd27a', glass: '#bff4ff', rope: '#e3d2a8', hedge: '#5d9b4c', neon: '#4fe3f0', bumper: '#ffb08a', rubber: '#ffb08a' };

  /** Named bursts. p = THREE.Vector3 or {x,y,z}. */
  Particles.prototype.burst = function (kind, p, o) {
    o = o || {};
    var n, i, a, s, k = this.reduced ? 0.5 : 1;
    switch (kind) {
      case 'impact':
        n = Math.round(PC.clamp((o.s || 2) * 2, 3, 14) * k);
        for (i = 0; i < n; i++) { a = Math.random() * Math.PI * 2; s = rnd(0.6, 2.2); this.emit(p.x, p.y + 0.15, p.z, Math.cos(a) * s, rnd(1, 3), Math.sin(a) * s, IMPACT[o.mat] || '#ffffff', rnd(0.05, 0.1), rnd(0.25, 0.5), 9, 2); }
        break;
      case 'land':
        n = Math.round(10 * k);
        for (i = 0; i < n; i++) { a = (i / n) * Math.PI * 2; this.emit(p.x, p.y + 0.05, p.z, Math.cos(a) * 1.6, 0.4, Math.sin(a) * 1.6, o.color || '#e8dcc0', 0.12, 0.45, 1, 3); }
        this.ring(p.x, p.y + 0.02, p.z, '#ffffff', 0.15, 0.9, 0.5);
        break;
      case 'splash':
        n = Math.round(28 * k);
        for (i = 0; i < n; i++) { a = Math.random() * Math.PI * 2; s = rnd(0.5, 2.4); this.emit(p.x, p.y + 0.05, p.z, Math.cos(a) * s, rnd(2.5, 5.5), Math.sin(a) * s, i % 3 ? '#e9fbff' : '#8fd8e8', rnd(0.08, 0.16), rnd(0.5, 0.9), 12, 0.6); }
        this.ring(p.x, p.y + 0.02, p.z, '#ffffff', 0.2, 1.6, 0.9);
        this.ring(p.x, p.y + 0.02, p.z, '#ffffff', 0.1, 2.4, 1.3);
        break;
      case 'fall':
        n = Math.round(16 * k);
        for (i = 0; i < n; i++) { a = Math.random() * Math.PI * 2; this.emit(p.x, p.y, p.z, Math.cos(a) * 0.8, rnd(0.5, 2), Math.sin(a) * 0.8, '#4fe3f0', 0.1, 0.8, -1, 1); }
        break;
      case 'cup':
        n = Math.round((o.big ? 120 : 55) * k);
        for (i = 0; i < n; i++) { a = Math.random() * Math.PI * 2; s = rnd(0.5, o.big ? 3.6 : 2.4); this.emit(p.x, p.y + 0.2, p.z, Math.cos(a) * s, rnd(3.5, o.big ? 9 : 6.5), Math.sin(a) * s, CONFETTI[i % CONFETTI.length], rnd(0.09, 0.17), rnd(1.2, 2.2), 6, 1.4); }
        this.ring(p.x, p.y + 0.02, p.z, '#f2bd47', 0.3, 2.2, 0.9);
        break;
      case 'token':
        n = Math.round(30 * k);
        for (i = 0; i < n; i++) { a = Math.random() * Math.PI * 2; s = rnd(0.8, 2.6); this.emit(p.x, p.y, p.z, Math.cos(a) * s, rnd(1, 4), Math.sin(a) * s, i % 2 ? '#ffd27a' : '#fff4d6', rnd(0.07, 0.13), rnd(0.5, 0.9), 4, 2); }
        this.ring(p.x, p.y - 0.4, p.z, '#ffd27a', 0.2, 1.4, 0.6);
        break;
      case 'freeze':
        n = Math.round(36 * k);
        for (i = 0; i < n; i++) { a = Math.random() * Math.PI * 2; s = rnd(0.4, 2.2); this.emit(p.x, p.y + 0.2, p.z, Math.cos(a) * s, rnd(0.5, 3), Math.sin(a) * s, i % 2 ? '#dff6ff' : '#8fdcff', rnd(0.06, 0.12), rnd(0.6, 1.1), 3, 1.5); }
        this.ring(p.x, p.y + 0.02, p.z, '#8fdcff', 0.2, 1.6, 0.7);
        break;
      case 'frostDrift':
        this.emit(p.x + rnd(-0.3, 0.3), p.y + rnd(0, 0.5), p.z + rnd(-0.3, 0.3), 0, 0.3, 0, '#dff6ff', 0.05, 0.8, -0.2, 1);
        break;
      case 'gust':
        n = Math.round(40 * k);
        for (i = 0; i < n; i++) { var off = rnd(-1.5, 0.2), side = rnd(-0.7, 0.7); this.emit(p.x + o.dx * off - o.dz * side, p.y + rnd(0.1, 0.7), p.z + o.dz * off + o.dx * side, o.dx * rnd(6, 11), rnd(-0.2, 0.3), o.dz * rnd(6, 11), '#e8fbf8', rnd(0.05, 0.09), rnd(0.35, 0.6), 0, 1.2); }
        break;
      case 'swap':
        n = Math.round(30 * k);
        for (i = 0; i < n; i++) { a = (i / n) * Math.PI * 2; this.emit(p.x + Math.cos(a) * 0.5, p.y + 0.3, p.z + Math.sin(a) * 0.5, -Math.sin(a) * 2, rnd(0.5, 2), Math.cos(a) * 2, i % 2 ? '#c79bff' : '#f6ecd8', 0.1, 0.7, 1, 2); }
        this.ring(p.x, p.y + 0.02, p.z, '#c79bff', 0.2, 1.3, 0.6);
        break;
      case 'shield':
        n = Math.round(26 * k);
        for (i = 0; i < n; i++) { a = Math.random() * Math.PI * 2; var e = Math.random() * Math.PI; this.emit(p.x + Math.cos(a) * Math.sin(e) * 0.5, p.y + 0.3 + Math.cos(e) * 0.5, p.z + Math.sin(a) * Math.sin(e) * 0.5, Math.cos(a) * 2.5, Math.cos(e) * 2.5, Math.sin(a) * 2.5, '#9fdcff', 0.08, 0.5, 0, 3); }
        this.ring(p.x, p.y + 0.3, p.z, '#7cc8ff', 0.4, 2.2, 0.5);
        break;
      case 'power':
        n = Math.round(22 * k);
        for (i = 0; i < n; i++) { a = Math.random() * Math.PI * 2; s = rnd(0.5, 1.6); this.emit(p.x, p.y + 0.2, p.z, Math.cos(a) * s, rnd(1.5, 3.5), Math.sin(a) * s, o.color || '#ffd27a', rnd(0.07, 0.12), rnd(0.5, 0.8), 3, 2); }
        break;
      case 'turbo':
        this.emit(p.x + rnd(-0.06, 0.06), p.y + rnd(0, 0.1), p.z + rnd(-0.06, 0.06), rnd(-0.3, 0.3), rnd(0.4, 1.2), rnd(-0.3, 0.3), Math.random() < 0.5 ? '#ff7a3d' : '#ffd27a', rnd(0.08, 0.14), rnd(0.25, 0.45), -1, 2);
        break;
      case 'pad':
        n = Math.round(24 * k);
        for (i = 0; i < n; i++) { a = Math.random() * Math.PI * 2; this.emit(p.x + Math.cos(a) * 0.4, p.y + 0.05, p.z + Math.sin(a) * 0.4, Math.cos(a) * 0.5, rnd(3, 6), Math.sin(a) * 0.5, '#ffd27a', 0.1, 0.6, 6, 1); }
        this.ring(p.x, p.y + 0.03, p.z, '#ffb547', 0.3, 1.6, 0.5);
        break;
      case 'shot':
        n = Math.round(PC.clamp((o.power || 0.5) * 10, 3, 10) * k);
        for (i = 0; i < n; i++) { a = Math.random() * Math.PI * 2; this.emit(p.x, p.y + 0.05, p.z, Math.cos(a) * 0.9 - (o.dx || 0) * 1.2, rnd(0.3, 1), Math.sin(a) * 0.9 - (o.dz || 0) * 1.2, '#ffffff', 0.06, 0.35, 2, 3); }
        break;
    }
  };

  Particles.prototype.dispose = function (scene) {
    scene.remove(this.points); this.geo.dispose(); this.mat.dispose();
    this.rings.forEach(function (r) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); });
  };

  // ---------------------------------------------------------------- Confetti Chaos (screen overlay)

  function ScreenConfetti(canvas) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.until = 0; this.parts = [];
  }
  ScreenConfetti.prototype.start = function (seconds) { this.until = performance.now() + seconds * 1000; };
  ScreenConfetti.prototype.active = function () { return performance.now() < this.until || this.parts.length > 0; };
  ScreenConfetti.prototype.update = function (dt) {
    var c = this.c, g = this.g, w = c.clientWidth, h = c.clientHeight, dpr = Math.min(2, global.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    var on = performance.now() < this.until;
    var rate = PC.reducedMotion() ? 40 : 140;
    if (on) {
      for (var i = 0; i < rate * dt; i++) {
        // Spawn along the edges only; the middle 55% of the screen stays clear.
        var edge = Math.random(), x, y;
        if (edge < 0.35) { x = Math.random() * w * 0.22; y = -10; } else if (edge < 0.7) { x = w - Math.random() * w * 0.22; y = -10; } else { x = Math.random() * w; y = -10; }
        this.parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 120, r: Math.random() * 6, vr: (Math.random() - 0.5) * 8, s: 5 + Math.random() * 7, c: CONFETTI[Math.floor(Math.random() * CONFETTI.length)] });
      }
    }
    if (this.parts.length > 500) this.parts.splice(0, this.parts.length - 500);
    var cx = w / 2, cy = h / 2, rx = w * 0.3, ry = h * 0.3;
    for (var j = this.parts.length - 1; j >= 0; j--) {
      var p = this.parts[j];
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.vx += Math.sin(p.y * 0.02) * 20 * dt;
      if (p.y > h + 20) { this.parts.splice(j, 1); continue; }
      // Keep the play area clear: confetti that drifts toward the centre fades out.
      var dx = (p.x - cx) / rx, dy = (p.y - cy) / ry, inside = dx * dx + dy * dy;
      var alpha = inside < 1 ? Math.max(0, inside - 0.6) * 2.5 : 1;
      if (alpha <= 0.02) continue;
      g.save(); g.globalAlpha = alpha; g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore();
    }
  };

  PC.Particles = Particles;
  PC.ScreenConfetti = ScreenConfetti;
})(window);
