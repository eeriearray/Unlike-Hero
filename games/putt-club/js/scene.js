/* Putt Club — the 3D scene: renderer, lights, the current hole, balls, aiming visuals, effects and the
 * render loop. Remote balls are drawn ~100 ms in the past from interpolated server snapshots. Your own ball
 * is drawn from a local prediction of your shot (same physics as the server), corrected smoothly toward the
 * server's positions, so your putt reacts instantly but always ends where the server says. */
(function (global) {
  'use strict';
  var PC = global.PC, THREE = global.THREE, Phys = global.PuttPhysics, Courses = global.PuttCourses, Match = global.PuttMatch;

  function quality() {
    var q = PC.store.get('quality', 'auto');
    if (q !== 'auto') return q;
    return PC.isTouch() || (navigator.hardwareConcurrency || 4) <= 4 ? 'low' : 'high';
  }

  function Scene(canvas, dom) {
    var self = this;
    this.canvas = canvas; this.dom = dom;
    this.quality = quality();
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: this.quality !== 'low', powerPreference: 'high-performance' }); }
    catch (e) { this.failed = true; return; }
    this.renderer = renderer;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    PC.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.pixelRatio = Math.min(global.devicePixelRatio || 1, this.quality === 'low' ? 1.25 : 2);
    renderer.setPixelRatio(this.pixelRatio);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    this.rig = new PC.CameraRig(this.camera);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#888888', 0.6); this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight('#ffffff', 0.1); this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight('#ffffff', 1.4);
    this.sun.castShadow = true;
    var sz = this.quality === 'low' ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sz, sz);
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.025;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.MeshBasicMaterial());
    this.scene.add(this.sky);

    this.particles = new PC.Particles(this.scene);
    this.confetti = new PC.ScreenConfetti(dom.confetti);
    this.interp = new PC.net.Interp();
    this.balls = {};
    this.labels = {};
    this.holeView = null; this.holeKey = null; this.world = null;
    this.view = null; this.me = null;
    this.aim = null; this.pred = null; this.smooth = {};
    this.t = 0; this.last = performance.now(); this.slowFrames = 0;
    this.buildAimVisuals();
    this.resize();
    global.addEventListener('resize', function () { self.resize(); });
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); PC.emit('toast', { text: 'Graphics were reset by the browser. Reload if the course looks wrong.', kind: 'warn' }); });
    requestAnimationFrame(function loop(now) { self.frame(now); requestAnimationFrame(loop); });
  }

  var S = Scene.prototype;

  S.resize = function () {
    var w = this.canvas.clientWidth || global.innerWidth, h = this.canvas.clientHeight || global.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.particles.mat.uniforms.scale.value = h * this.pixelRatio / (2 * Math.tan(this.camera.fov * Math.PI / 360));
  };

  S.applyTheme = function (themeId) {
    var th = PC.themes.THEMES[themeId];
    this.theme = themeId;
    this.sky.material.dispose();
    this.sky.material = PC.themes.skyMaterial(th);
    this.scene.fog = new THREE.Fog(th.fog.color, th.fog.near, th.fog.far);
    this.fogBase = th.fog;
    this.hemi.color.set(th.hemi.sky); this.hemi.groundColor.set(th.hemi.ground); this.hemi.intensity = th.hemi.intensity;
    this.ambient.intensity = th.ambient;
    this.sun.color.set(th.sun.color); this.sun.intensity = th.sun.intensity;
    this.sunDir = new THREE.Vector3().fromArray(th.sun.dir).normalize();
    this.renderer.toneMappingExposure = th.exposure || (themeId === 'neon' ? 1.1 : 0.95);
  };

  /** Load a hole (course id, hole index, mirror). Reuses the current one if unchanged. */
  S.loadHole = function (courseId, holeIdx, mirror, opts) {
    var key = courseId + ':' + holeIdx + ':' + (mirror ? 'm' : '');
    if (key === this.holeKey) return false;
    var course = Courses.byId(courseId), hole = course.holes[holeIdx];
    if (this.holeView) { this.scene.remove(this.holeView.group); this.holeView.dispose(); }
    if (this.world && this.world._pred) { Phys.freeSim(this.world._pred); this.world._pred = null; }
    this.clearBalls();
    this.holeKey = key;
    this.world = Phys.compileHole(hole, { mirror: mirror });
    this.hole = hole;
    this.applyTheme(hole.theme);
    this.holeView = PC.world.build(hole, this.world, { mirror: mirror, quality: this.quality, tokens: (opts && opts.tokens) || [] });
    this.scene.add(this.holeView.group);
    // Fit the shadow camera to the hole.
    var b = this.world.bounds, cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2, r = Math.max(b[2] - b[0], b[3] - b[1]) * 0.75 + 4;
    var sc = this.sun.shadow.camera;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = 80; sc.updateProjectionMatrix();
    this.sun.position.set(cx + this.sunDir.x * 40, this.sunDir.y * 40, cz + this.sunDir.z * 40);
    this.sun.target.position.set(cx, 0, cz);
    this.rig.setHole(this.world, { intro: opts && opts.intro ? opts.intro : 0 });
    var od = this.rig.overviewDist();
    this.scene.fog.near = Math.max(this.fogBase.near, od * 1.15); this.scene.fog.far = this.scene.fog.near + (this.fogBase.far - this.fogBase.near);
    if (opts && opts.menu) this.rig.mode = 'menu';
    else if (!(opts && opts.intro)) this.rig.mode = 'play';
    this.interp.reset();
    this.pred = null; this.smooth = {};
    PC.audio.music(hole.theme);
    return true;
  };

  S.menuBackdrop = function (courseIdx) {
    var c = Courses.COURSES[courseIdx % Courses.COURSES.length];
    this.view = null; this.me = null;
    this.loadHole(c.id, (courseIdx * 2 + 1) % 6, false, { menu: true });
    this.rig.mode = 'menu';
  };

  S.clearBalls = function () {
    var self = this;
    Object.keys(this.balls).forEach(function (id) { self.balls[id].dispose(self.scene); });
    this.balls = {};
    Object.keys(this.labels).forEach(function (id) { self.labels[id].remove(); });
    this.labels = {};
  };

  /** A new room view from the server. */
  S.setView = function (v) {
    this.view = v;
    this.me = v.players.find(function (p) { return p.id === v.you; }) || null;
    if (!v.course || !v.hole || v.phase === 'lobby') { return; }
    var loaded = this.loadHole(v.course.id, v.hole.index, v.course.mirror, { intro: v.phase === 'intro' ? Math.max(1.2, (v.timeLeft || 3) - 0.3) : 0, tokens: v.tokens });
    if (loaded) PC.emit('holeLoaded', v);
    var self = this;
    (v.tokens || []).forEach(function (tk) { self.holeView.setToken(tk.id, tk.active); });
    // Ball views for everyone in the room.
    var seen = {};
    v.players.forEach(function (p) {
      seen[p.id] = true;
      if (!self.balls[p.id] || self.balls[p.id].color !== p.color) {
        if (self.balls[p.id]) self.balls[p.id].dispose(self.scene);
        self.balls[p.id] = new PC.BallView(self.scene, p, p.id === v.you, PC.themes.materials(self.hole.theme));
      }
      if (!self.labels[p.id]) {
        var el = document.createElement('div'); el.className = 'ball-label' + (p.id === v.you ? ' me' : '');
        self.dom.labels.appendChild(el); self.labels[p.id] = el;
      }
      var el2 = self.labels[p.id];
      var txt = (p.id === v.you ? 'You' : p.name);
      if (el2.dataset.txt !== txt + p.color + p.connected) {
        el2.dataset.txt = txt + p.color + p.connected;
        el2.innerHTML = '<span class="dot" style="background:' + Match.COLORS[p.color] + '">' + PC.icons.symbol(Match.SYMBOLS[p.color]) + '</span><span>' + escapeHtml(txt) + '</span>' + (p.connected || p.bot ? '' : PC.icons.ui('offline', 'tiny'));
      }
    });
    Object.keys(this.balls).forEach(function (id) { if (!seen[id]) { self.balls[id].dispose(self.scene); delete self.balls[id]; if (self.labels[id]) { self.labels[id].remove(); delete self.labels[id]; } } });
    if (v.phase === 'play' && this.rig.mode === 'intro' && (v.timeLeft || 0) > 1) this.rig.mode = 'play';
  };

  S.onSnap = function (snap) { this.interp.push(snap); };

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ---------------------------------------------------------------- own ball

  /** Physics-ready copy of a ball from its latest snapshot plus the effects we know about. */
  S.ballState = function (id) {
    var s = this.interp.latest(id);
    if (!s || !this.world) return null;
    var b = { id: id, x: s.x, y: s.y, z: s.z, r: s.r, rTarget: s.r, fric: 1, ghost: false, magnet: false };
    var p = this.view && this.view.players.find(function (q) { return q.id === id; });
    if (p) p.effects.forEach(function (e) {
      if (e.kind === 'sticky') b.fric *= 2.6;
      if (e.kind === 'ghost') b.ghost = true;
      if (e.kind === 'magnet') b.magnet = true;
      if (e.kind === 'giant') b.rTarget = Phys.C.R * 1.65;
      if (e.kind === 'tiny') b.rTarget = Phys.C.R * 0.58;
    });
    return b;
  };

  S.myEffects = function () {
    var out = {};
    if (this.me) this.me.effects.forEach(function (e) { out[e.kind] = e; });
    return out;
  };

  /** Speed and direction the server will use for this aim. */
  S.shotParams = function (aim) {
    var fx = this.myEffects();
    var strength = Match.STRENGTH[(this.view && this.view.settings.strength) || 'normal'];
    var speed = Phys.shotSpeed(aim.power, strength);
    if (fx.turbo) speed = Math.min(speed * 1.5, Phys.C.MAX_SPEED * 0.9);
    var dir = aim.dir.slice();
    if (fx.reverse) { dir[0] = -dir[0]; dir[1] = -dir[1]; }
    return { dir: dir, speed: speed, reversed: !!fx.reverse };
  };

  /** A shot was sent: block a second one until the server shows the ball moving. */
  S.startPrediction = function () { this.shotAt = performance.now(); };
  S.confirmShot = function () {};

  // ---------------------------------------------------------------- aiming visuals

  S.buildAimVisuals = function () {
    var dotGeo = new THREE.CircleGeometry(0.07, 12); dotGeo.rotateX(-Math.PI / 2);
    this.dots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color: '#fbf6ea', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }), 60);
    this.dots.count = 0; this.dots.frustumCulled = false; this.dots.renderOrder = 6; this.scene.add(this.dots);
    var sh = new THREE.Shape();
    sh.moveTo(-0.07, 0); sh.lineTo(0.07, 0); sh.lineTo(0.07, 0.75); sh.lineTo(0.2, 0.75); sh.lineTo(0, 1); sh.lineTo(-0.2, 0.75); sh.lineTo(-0.07, 0.75); sh.closePath();
    var ag = new THREE.ShapeGeometry(sh); ag.rotateX(-Math.PI / 2);
    this.arrowMat = new THREE.MeshBasicMaterial({ color: '#f2bd47', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
    this.arrow = new THREE.Mesh(ag, this.arrowMat); this.arrow.visible = false; this.arrow.renderOrder = 7; this.scene.add(this.arrow);
    this.powerRingMat = new THREE.MeshBasicMaterial({ color: '#f2bd47', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    this.powerRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 48, 1, 0, Math.PI * 2), this.powerRingMat);
    this.powerRing.rotation.x = -Math.PI / 2; this.powerRing.visible = false; this.powerRing.renderOrder = 7; this.scene.add(this.powerRing);
    this.endMarker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 32), new THREE.MeshBasicMaterial({ color: '#fbf6ea', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
    this.endMarker.rotation.x = -Math.PI / 2; this.endMarker.visible = false; this.endMarker.renderOrder = 6; this.scene.add(this.endMarker);
    this.previewAt = 0;
  };

  var AIM_UP = new THREE.Vector3(0, 1, 0), AIM_N = new THREE.Vector3(), AIM_TILT = new THREE.Quaternion(), AIM_Q = new THREE.Quaternion();
  var AIM_FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  var POWER_LOW = new THREE.Color('#5fb8b0'), POWER_MID = new THREE.Color('#f2bd47'), POWER_HIGH = new THREE.Color('#ef6a43');
  S.setAim = function (aim) { this.aim = aim; };

  /** The aim arrow and power ring glide toward the pull (eased), so aiming feels smooth, never twitchy. */
  S.updateAim = function (ball, dt) {
    var aim = this.aim, va = this.aimVis || (this.aimVis = { ang: 0, power: 0, alpha: 0, on: false });
    var show = !!(aim && ball && this.world);
    var dtc = Math.min(dt || 0.016, 0.05);
    if (show) {
      var sp = this.shotParams(aim), ang = Math.atan2(aim.dir[0], aim.dir[1]);
      if (!va.on) { va.ang = ang; va.power = 0; }
      va.on = true; va.reversed = sp.reversed;
      va.ang = PC.angleLerp(va.ang, ang, 1 - Math.exp(-22 * dtc));
      va.power = PC.damp(va.power, aim.power, 40, dtc);
      va.alpha = PC.damp(va.alpha, 1, 14, dtc);
      va.ball = ball;
    } else {
      va.on = false;
      va.alpha = PC.damp(va.alpha, 0, 16, dtc);
    }
    var vis = va.alpha > 0.02 && va.ball;
    this.arrow.visible = vis; this.powerRing.visible = vis;
    this.dots.count = 0; this.endMarker.visible = false;
    if (!vis) return;
    var bl = va.ball, p = va.power;
    var col = p < 0.5 ? POWER_LOW.clone().lerp(POWER_MID, p * 2) : POWER_MID.clone().lerp(POWER_HIGH, (p - 0.5) * 2);
    if (va.reversed) col.set('#d85db0');
    this.arrowMat.color.copy(col); this.powerRingMat.color.copy(col);
    this.arrowMat.opacity = 0.92 * va.alpha; this.powerRingMat.opacity = 0.85 * va.alpha;
    var y = bl.pos.y - bl.r + 0.02, dx = Math.sin(va.ang), dz = Math.cos(va.ang);
    // Lay the arrow and ring on the floor's slope, so an uphill arrow doesn't dip under the ground.
    var f = Phys.floorAt(this.world, bl.pos.x, bl.pos.z, bl.pos.y - bl.r + 0.05, this.t || 0);
    var gx = f ? f.gx : 0, gz = f ? f.gz : 0, ax = bl.pos.x + dx * bl.r * 1.5, az = bl.pos.z + dz * bl.r * 1.5;
    AIM_N.set(-gx, 1, -gz).normalize();
    AIM_TILT.setFromUnitVectors(AIM_UP, AIM_N);
    AIM_Q.setFromAxisAngle(AIM_UP, va.ang + Math.PI);
    this.arrow.quaternion.copy(AIM_TILT).multiply(AIM_Q);
    this.arrow.position.set(ax, y + 0.01 + gx * (ax - bl.pos.x) + gz * (az - bl.pos.z), az);
    this.arrow.scale.set(0.9 + p * 0.5, 1, 0.45 + p * 2.6);
    this.powerRing.quaternion.copy(AIM_TILT).multiply(AIM_FLAT);
    this.powerRing.position.set(bl.pos.x, y + 0.002, bl.pos.z);
    var rs = (bl.r / Phys.C.R) * (1 + Math.sin(this.t * 6) * 0.03 * p);
    this.powerRing.scale.set(rs, rs, rs);
    var g = this.powerRing.geometry, want = Math.max(0.01, p * Math.PI * 2);
    if (Math.abs((g.parameters.thetaLength || 0) - want) > 0.03) {
      g.dispose();
      this.powerRing.geometry = new THREE.RingGeometry(0.4, 0.5, 64, 1, Math.PI / 2, want);
    }
  };

  // ---------------------------------------------------------------- events from the server

  S.screenPan = function (x, z) {
    var v = new THREE.Vector3(x, 0, z).project(this.camera);
    return PC.clamp(v.x * 0.7, -0.8, 0.8);
  };
  S.ballPos = function (id) { var b = this.balls[id]; return b ? b.pos.clone() : null; };

  S.onFx = function (e) {
    var p = e.x != null ? new THREE.Vector3(e.x, (e.y || 0), e.z) : null, A = PC.audio, self = this;
    var pan = p ? this.screenPan(p.x, p.z) : 0;
    var near = function () { return p ? Math.max(0.25, 1 - self.camera.position.distanceTo(p) / 45) : 1; };
    switch (e.type) {
      case 'shot': A.play('strike', e.power * (e.id === (this.me && this.me.id) ? 1 : 0.6)); if (p) this.particles.burst('shot', p, e); break;
      case 'wall': A.play('wall', e.mat, e.s * near(), pan); if (p && e.s > 2.5) this.particles.burst('impact', p, e); break;
      case 'bumper': A.play('bumper', e.s * near(), pan); if (this.holeView) this.holeView.bump(e.x, e.z); if (p) this.particles.burst('impact', p, { mat: 'bumper', s: e.s }); break;
      case 'ball': A.play('ball', e.s * near(), pan); if (p) this.particles.burst('impact', p, { mat: 'stone', s: e.s }); break;
      case 'land': A.play('land', e.s * near(), pan); if (p) this.particles.burst('land', p, { color: this.theme === 'neon' ? '#4fe3f0' : '#efe2c4' }); break;
      case 'pad': A.play('pad'); if (this.holeView) this.holeView.pad(e.x, e.z); if (p) this.particles.burst('pad', p); break;
      case 'lip': A.play('lip'); break;
      case 'holed': A.play('cup', e.rel); if (p) this.particles.burst('cup', p, { big: e.strokes === 1 || e.rel < 0 }); break;
      case 'splash':
        if (e.kind === 'water') { A.play('splash'); this.particles.burst('splash', new THREE.Vector3(e.fx, e.fy, e.fz)); }
        else { A.play('fall'); this.particles.burst('fall', new THREE.Vector3(e.fx, e.fy, e.fz)); }
        this.smooth[e.id] = null;
        break;
      case 'token':
        A.play('token');
        if (this.holeView) { this.holeView.setToken(e.token, false); var tp = this.holeView.tokenPos(e.token); if (tp) this.particles.burst('token', tp); }
        break;
      case 'tokenBack': if (this.holeView) this.holeView.setToken(e.token, true); break;
      case 'power': this.powerFx(e); break;
      case 'blocked': A.play('blocked'); var bp = this.ballPos(e.id); if (bp) this.particles.burst('shield', bp); break;
      case 'effectEnd': if (e.power === 'freeze') { var fp = this.ballPos(e.id); if (fp) this.particles.burst('freeze', fp); } break;
      case 'reset': A.play('whoosh'); this.smooth[e.id] = null; break;
      case 'hole': A.play('hole'); break;
      case 'go': A.play('go'); break;
      case 'final': A.play('victory'); break;
    }
  };

  S.powerFx = function (e) {
    var A = PC.audio, me = this.me && this.me.id;
    A.play('power', e.power);
    var tp = this.ballPos(e.target), up = this.ballPos(e.id);
    var col = PC.POWER_COLORS[e.power];
    switch (e.power) {
      case 'freeze': if (tp) this.particles.burst('freeze', tp); break;
      case 'gust': if (tp && e.dir) this.particles.burst('gust', tp, { dx: e.dir[0], dz: e.dir[1] }); break;
      case 'swap':
        if (e.from) this.particles.burst('swap', new THREE.Vector3(e.from[0], e.from[1], e.from[2]));
        if (e.to) this.particles.burst('swap', new THREE.Vector3(e.to[0], e.to[1], e.to[2]));
        this.smooth[e.id] = null; this.smooth[e.target] = null;
        break;
      case 'confetti':
        if (e.target === me) this.confetti.start(6);
        if (tp) this.particles.burst('cup', tp, {});
        break;
      case 'shield': if (up) this.particles.burst('shield', up); break;
      default: if (tp) this.particles.burst('power', tp, { color: col });
    }
  };

  // ---------------------------------------------------------------- frame

  S.frame = function (now) {
    var dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    // Graceful degradation: sustained slow frames lower the resolution once.
    if (dt > 0.034) this.slowFrames++; else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 150 && this.pixelRatio > 1) { this.pixelRatio = 1; this.renderer.setPixelRatio(1); this.resize(); this.slowFrames = 0; }
    if (this.dom.hidden && this.dom.hidden()) return;
    var serverNow = this.interp.serverNow(), renderT = serverNow - this.interp.delay;
    var self = this, focus = null, myBall = null, rolling = 0;
    if (this.holeView) {
      this.holeView.update(this.view ? Math.max(0, renderT) : this.t, dt);
      var cup = new THREE.Vector3(this.world.cup[0], this.world.cupH, this.world.cup[1]);
      var floorY = function (x, z, y) { var f = Phys.floorAt(self.world, x, z, y + 0.05, Math.max(0, renderT)); return f ? f.h : null; };
      var nearCup = false;
      this.view && this.view.players.forEach(function (p) {
        var bv = self.balls[p.id];
        if (!bv) return;
        var isMe = self.me && p.id === self.me.id;
        var s = self.sampleBall(p.id, isMe, serverNow, renderT, dt);
        if (!s) return;
        var fx = {};
        p.effects.forEach(function (e) { fx[e.kind] = true; if (e.live) fx[e.kind + 'Live'] = true; });
        bv.update(s, fx, { t: self.t, dt: dt, camera: self.camera, cup: cup, floorY: floorY });
        if ((s.flags & 1) && fx.turboLive) self.particles.burst('turbo', bv.pos);
        if ((s.flags & 4) && Math.random() < 0.3) self.particles.burst('frostDrift', bv.pos);
        if (Math.hypot(s.x - cup.x, s.z - cup.z) < 1.4 && !(s.flags & 2)) nearCup = true;
        if (s.flags & 1) rolling = Math.max(rolling, (bv.speed || 0) * (isMe ? 1 : 0.5));
        if (isMe) { myBall = bv; focus = { pos: bv.pos.clone(), moving: !!(s.flags & 1), vel: [s.vx || 0, s.vz || 0] }; }
        self.placeLabel(p, bv, s);
      });
      this.holeView.liftFlag(nearCup ? 1 : 0);
    }
    PC.audio.roll(rolling);
    if (focus && this.aim) { focus.aiming = true; focus.aimDir = this.shotParams(this.aim).dir; focus.power = this.aim.power; }
    if (this.me && this.me.finished && this.rig.mode === 'play') focus = this.spectateFocus() || focus;
    this.rig.update(dt, focus, this.t);
    this.updateAim(this.aim && this.canAim() ? myBall : null, dt);
    this.particles.update(dt);
    if (this.confetti.active()) { this.dom.confetti.style.display = 'block'; this.confetti.update(dt); } else this.dom.confetti.style.display = 'none';
    this.renderer.render(this.scene, this.camera);
    if (this.dom.onFrame) this.dom.onFrame(dt);
  };

  /** Which position to draw a ball at this frame: always the server's path, smoothly interpolated. */
  S.sampleBall = function (id, isMe, serverNow, renderT, dt) {
    var target = null;
    // Drawn straight from the interpolated snapshots on one steady clock. (An extra smoothing pass here
    // made a ball look like it gathered speed after the putt and lag behind on every change.)
    target = this.interp.sample(id, renderT);
    return target;
  };

  /** After you finish, watch whoever is still playing (the furthest from the cup). */
  S.spectateFocus = function () {
    var self = this, best = null;
    this.view.players.forEach(function (p) {
      if (p.finished || !self.balls[p.id]) return;
      var bv = self.balls[p.id];
      if (!best || bv.speed > best.speed) best = bv;
    });
    return best ? { pos: best.pos.clone(), moving: best.speed > 0.2 } : null;
  };

  S.placeLabel = function (p, bv, s) {
    var el = this.labels[p.id];
    if (!el) return;
    var v = bv.pos.clone(); v.y += s.r + 0.45;
    v.project(this.camera);
    var visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && bv.root.visible && !(s.flags & 2);
    if (!visible) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
    el.style.display = '';
    var w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    el.style.transform = 'translate(' + ((v.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - v.y) / 2 * h).toFixed(1) + 'px) translate(-50%,-100%)';
    el.classList.toggle('moving', !!(s.flags & 1));
  };

  S.canAim = function () {
    var v = this.view, me = this.me;
    if (!v || !me || v.phase !== 'play' || me.finished) return false;
    var s = this.interp.latest(me.id);
    if (!s || (s.flags & 1) || (s.flags & 4)) return false;
    if (this.shotAt && performance.now() - this.shotAt < 600 && !(s.flags & 1)) return false; // shot sent, waiting for it to start
    return true;
  };

  S.myBallView = function () {
    var b = this.me && this.balls[this.me.id];
    return b ? { pos: b.pos, r: b.r } : null;
  };

  S.defaultAim = function () {
    var b = this.myBallView(), w = this.world;
    if (!b || !w) return [0, -1];
    var dx = w.cup[0] - b.pos.x, dz = w.cup[1] - b.pos.z, l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  };

  PC.Scene = Scene;
})(window);
