/* Neon Casino — the 3D back room (Three.js r147). One engine draws every table: a dim tavern lit by a single swinging
   lamp, a worn table, chairs with animal regulars, dealt cards and stacked chips. The tables (js/blackjack.js,
   js/cardroom.js, js/roulette.js) only describe what is on the table as a plain "model"; this file turns it into meshes
   and animates the changes. It never decides anything about the game.

   CasinoGL.Stage  — React component: <Stage kind="oval|moon|roulette" model=${…} fallback=${…}>…hud…</Stage>
   Model, all optional:
     n, mySeat, theme{felt, ink, print, print2}, seats[{pid,name,avatar,cash,me,offline,folded,status,statusCls,result,canSit}],
     turnSeat, timer{pct,secs,urgent}, onSit, hands[{id,seat,cards,bet,total,totalCls,note,noteCls,dim}], dealer{cards,total,totalCls},
     board[], pot, potLabel, button, wheel{round,phase,spinSec}, bets[{key,numbers,type,amount,mine}] */
(function (global) {
  'use strict';
  var T = global.THREE, GL = global.CasinoGL, K = GL && GL.kit;
  if (!T || !K) return;
  var R = global.React, html = global.CasinoUI && global.CasinoUI.html;

  // Graphics quality: 0 high (shadows), 1 medium (default), 2 low (no haze/extra lights, 1x pixels, no antialiasing).
  // It drops a notch by itself whenever the browser loses the GPU context, and the player can set it from the table.
  GL.getQuality = function () { try { var q = parseInt(localStorage.getItem('hub.casino.quality'), 10); if (q >= 0 && q <= 2) return q; } catch (e) {} return 1; };
  GL.setQuality = function (q) { try { localStorage.setItem('hub.casino.quality', String(q)); } catch (e) {} };
  var TOP = 0.8;                                         // height of the felt
  var TAU = Math.PI * 2;
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function wrapPi(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function short(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'K' : String(Math.round(n)); }

  // ───────────── shapes ─────────────
  function ellipseShape(rx, rz, hole) {
    var s = new T.Shape(); s.absellipse(0, 0, rx, rz, 0, TAU, false, 0);
    if (hole) { var h = new T.Path(); h.absellipse(0, 0, hole[0], hole[1], 0, TAU, true, 0); s.holes.push(h); }
    return s;
  }
  // The half-moon blackjack table: an arc of radius Rr about (0, cy) with straight sides up to y = top (shape y is -world z).
  function moonShape(Rr, cy, top, hole) {
    var s = new T.Shape(); s.moveTo(-Rr, top); s.lineTo(-Rr, cy); s.absarc(0, cy, Rr, Math.PI, TAU, false); s.lineTo(Rr, top); s.lineTo(-Rr, top);
    if (hole) { var h = new T.Path(); h.moveTo(-hole[0], hole[2]); h.lineTo(-hole[0], cy); h.absarc(0, cy, hole[0], Math.PI, TAU, false); h.lineTo(hole[0], hole[2]); h.lineTo(-hole[0], hole[2]); s.holes.push(h); }
    return s;
  }
  function roundRect(w, d, r, cz, hole) {
    var s = new T.Shape(), hw = w, hd = d;
    s.moveTo(-hw + r, -hd + cz); s.lineTo(hw - r, -hd + cz); s.absarc(hw - r, -hd + r + cz, r, -Math.PI / 2, 0, false); s.lineTo(hw, hd - r + cz); s.absarc(hw - r, hd - r + cz, r, 0, Math.PI / 2, false);
    s.lineTo(-hw + r, hd + cz); s.absarc(-hw + r, hd - r + cz, r, Math.PI / 2, Math.PI, false); s.lineTo(-hw, -hd + r + cz); s.absarc(-hw + r, -hd + r + cz, r, Math.PI, 1.5 * Math.PI, false);
    return s;
  }

  // ───────────── the engine ─────────────
  function Engine(el, kind, onLost) {
    var self = this; GL.last = this; GL.live = (GL.live || 0) + 1;
    this.el = el; this.kind = kind; this.table = TABLES[kind];
    this.coarse = !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches);
    this.q = GL.getQuality();
    this.noShadow = this.coarse || this.q >= 1;
    this.maxDpr = this.q >= 2 ? 1 : this.q === 1 ? 1.25 : 1.5;
    this.renderer = new T.WebGLRenderer({ antialias: this.q < 2 && !this.coarse });       // no powerPreference: asking for the discrete GPU can make dual-GPU laptops drop the context
    this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, this.maxDpr));
    this.renderer.outputEncoding = T.sRGBEncoding;
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = !this.noShadow; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.setClearColor(0x050302);
    this.canvas = this.renderer.domElement; this.canvas.className = 'gl-canvas'; this.canvas.setAttribute('role', 'img'); this.canvas.setAttribute('aria-label', 'The table, in 3D. Everything you can do is in the controls below it.');
    el.appendChild(this.canvas);
    this.labelsEl = document.createElement('div'); this.labelsEl.className = 'gl-labels'; el.appendChild(this.labelsEl);

    this.scene = new T.Scene();
    this.scene.fog = new T.FogExp2(0x0c0705, 0.07);
    this.camera = new T.PerspectiveCamera(50, 1, 0.1, 40);
    this.camPos = new T.Vector3(0, 2, 4); this.camLook = new T.Vector3(0, 0.8, 0); this.camInit = false; this.orbit = { yaw: 0, pitch: 0, zoom: 1, ty: 0, tp: 0, tz: 1 };
    this.clock = new T.Clock();
    this.seats = {}; this.cards = {}; this.chips = {}; this.lbl = {};
    this.model = null; this.dealCount = 0; this.sceneT = 0;
    this.mats();
    this.room();
    this.lamp();
    this.dust();
    if (this.q >= 2) { this.back.visible = false; this.fill.visible = false; this.motes.visible = false; }       // low: fewer lights and no dust
    this.ctx = this.table.build(this) || {};
    this.deck = new T.Vector3(0, TOP + 0.02, 0);
    if (this.ctx.deck) this.deck.set(this.ctx.deck.position.x, TOP + 0.06, this.ctx.deck.position.z);
    this.visible = true; this.alive = true; this.frameMs = 16; this.slow = 0;
    this.resize();
    this.prewarm();
    if (global.ResizeObserver) { this.ro = new ResizeObserver(function () { self.resize(); }); this.ro.observe(el); }
    else { this.onResize = function () { self.resize(); }; global.addEventListener('resize', this.onResize); }
    if (global.IntersectionObserver) { this.io = new IntersectionObserver(function (e) { self.visible = e[0].isIntersecting; }); this.io.observe(el); }
    this.onLostCb = onLost;
    this.onVis = function () { if (document.hidden) return; self.clock.getDelta(); if (self.renderer.getContext().isContextLost() && self.onLostCb) self.onLostCb(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.onLost = function (e) {
      e.preventDefault(); self.lost = true;
      // three.js restores the context by itself; if the browser doesn't give it back soon, build a fresh scene instead of leaving a black or white box
      setTimeout(function () { if (self.lost && self.alive && self.onLostCb) self.onLostCb(); }, 1200);
    };
    this.onRestored = function () { self.lost = false; self.clock.getDelta(); };
    // Look around by dragging (mouse or finger); wheel or pinch to zoom; double-click or double-tap to reset.
    var ptrs = {}, drag = null, pinch = null, lastTap = 0;
    function count() { return Object.keys(ptrs).length; }
    this.onDown = function (e) {
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { self.canvas.setPointerCapture(e.pointerId); } catch (x) {}
      if (count() === 1) { drag = { x: e.clientX, y: e.clientY, yaw: self.orbit.ty, pitch: self.orbit.tp }; self.canvas.classList.add('grab'); var now = Date.now(); if (now - lastTap < 320) self.look(null); lastTap = now; }
      else if (count() === 2) { var k = Object.keys(ptrs), a2 = ptrs[k[0]], b2 = ptrs[k[1]]; pinch = { d: Math.hypot(a2.x - b2.x, a2.y - b2.y), z: self.orbit.tz }; drag = null; }
    };
    this.onMove = function (e) {
      if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (pinch && count() === 2) { var k = Object.keys(ptrs), a2 = ptrs[k[0]], b2 = ptrs[k[1]]; self.orbit.tz = clamp(pinch.z * pinch.d / Math.max(20, Math.hypot(a2.x - b2.x, a2.y - b2.y)), 0.55, 1.4); return; }
      if (!drag) return;
      self.orbit.ty = clamp(drag.yaw - (e.clientX - drag.x) * 0.006, -1.6, 1.6);
      self.orbit.tp = clamp(drag.pitch + (e.clientY - drag.y) * 0.004, -0.6, 0.6);
    };
    this.onUp = function (e) { delete ptrs[e.pointerId]; pinch = null; if (count() === 1) { var k = Object.keys(ptrs)[0]; drag = { x: ptrs[k].x, y: ptrs[k].y, yaw: self.orbit.ty, pitch: self.orbit.tp }; } else { drag = null; self.canvas.classList.remove('grab'); } };
    this.onWheel = function (e) { e.preventDefault(); self.orbit.tz = clamp(self.orbit.tz * (e.deltaY > 0 ? 1.08 : 0.93), 0.55, 1.4); };
    this.canvas.addEventListener('pointerdown', this.onDown); this.canvas.addEventListener('pointermove', this.onMove); this.canvas.addEventListener('pointerup', this.onUp); this.canvas.addEventListener('pointercancel', this.onUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('webglcontextlost', this.onLost); this.canvas.addEventListener('webglcontextrestored', this.onRestored);
    this.errors = 0;
    (function loop() {
      if (!self.alive) return; self.raf = global.requestAnimationFrame(loop);
      if (document.hidden || !self.visible || self.lost) return;
      try { self.frame(); self.errors = 0; }
      catch (e) {
        // one bad frame must never leave a blank canvas: log it, keep going, and rebuild the scene if it keeps failing
        if (global.console && self.errors === 0) console.warn('3D frame failed:', e);
        if (++self.errors === 30 && self.onLostCb) self.onLostCb();
      }
    })();
  }
  var E = Engine.prototype;

  E.mats = function () {
    var M = this.m = {};
    M.vc = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, flatShading: true });
    M.vcSmooth = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
    M.wood = new T.MeshStandardMaterial({ map: K.woodTex('#5a3820', '#1c0f07', 5, 7, [0.55, 0.55]), roughness: 0.62 });
    M.woodDark = new T.MeshStandardMaterial({ map: K.woodTex('#2c1a0e', '#100803', 6, 21, [3, 3]), roughness: 0.8 });
    M.leather = new T.MeshStandardMaterial({ map: K.leatherTex(), roughness: 0.55 });
    M.brass = new T.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.38, metalness: 0.7, emissive: 0x2a1e08 });
    var atlas = K.cardAtlas(this.coarse ? 0.75 : 1);
    M.card = new T.MeshStandardMaterial({ map: atlas, roughness: 0.65, emissive: 0xffffff, emissiveMap: atlas, emissiveIntensity: 0.42 });     // cards glow a little so they read in the dim room
    M.floor = new T.MeshStandardMaterial({ map: K.woodTex('#2a1a10', '#0a0503', 8, 41, [3.5, 3.5], 40), roughness: 0.85 });
    M.wall = new T.MeshStandardMaterial({ map: K.wallTex(), roughness: 0.95, side: T.BackSide });
    M.glow = new T.MeshBasicMaterial({ color: 0xffd9a0 });
    M.ring = new T.MeshBasicMaterial({ color: 0xf5c451, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false });
  };

  /** The room: planked floor, panelled walls fading into black, a shelf of bottles, barrels, a pair of far tables. */
  E.room = function () {
    var s = this.scene, M = this.m;
    var floor = new T.Mesh(new T.PlaneGeometry(16, 16), M.floor); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    var wall = new T.Mesh(new T.CylinderGeometry(6.5, 6.5, 4.6, 24, 1, true), M.wall); wall.position.y = 2.3; s.add(wall);
    var ceil = new T.Mesh(new T.CircleGeometry(6.6, 24), new T.MeshBasicMaterial({ color: 0x0a0604 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = 4.55; s.add(ceil);
    // furniture, merged into one vertex-coloured mesh
    var b = new K.Builder(8), sh = K.Shapes(b), r = K.rnd(4);
    sh.box('#2a1a0e', 0, 1.5, -6.1, 3.6, 0.07, 0.5); sh.box('#2a1a0e', 0, 2.1, -6.1, 3.6, 0.07, 0.5); sh.box('#1c1009', 0, 1.8, -6.32, 3.7, 1.5, 0.1);
    var bottle = ['#3a5a2a', '#6a3a1a', '#2a3a5a', '#7a5a1a', '#4a2a3a'];
    for (var i = 0; i < 14; i++) for (var row = 0; row < 2; row++) {
      var bx = -1.65 + i * 0.255 + r() * 0.04, by = row ? 2.14 : 1.54, col = bottle[Math.floor(r() * bottle.length)], tall = 0.34 + r() * 0.14;
      sh.cyl(col, bx, by + tall / 2, -6.1, 0, 0, 0, 0.055, tall, 0.055); sh.cyl(col, bx, by + tall + 0.05, -6.1, 0, 0, 0, 0.022, 0.1, 0.022); sh.cyl('#c8a060', bx, by + tall + 0.11, -6.1, 0, 0, 0, 0.026, 0.03, 0.026);
    }
    [[-4.2, -4.0], [4.3, -3.6], [-4.6, 1.8], [4.7, 2.4], [3.2, -4.8]].forEach(function (p) {
      sh.cyl('#4a2e18', p[0], 0.45, p[1], 0, 0, 0, 0.42, 0.9, 0.42); sh.cyl('#241408', p[0], 0.25, p[1], 0, 0, 0, 0.44, 0.04, 0.44); sh.cyl('#241408', p[0], 0.65, p[1], 0, 0, 0, 0.44, 0.04, 0.44); sh.cyl('#5a3a20', p[0], 0.91, p[1], 0, 0, 0, 0.38, 0.02, 0.38);
    });
    [[-3.6, -2.6], [3.9, -1.4]].forEach(function (p) {                                           // distant tables, dim with a candle each
      sh.cyl('#2a1a0e', p[0], 0.75, p[1], 0, 0, 0, 0.7, 0.05, 0.7); sh.cyl('#1a0f08', p[0], 0.37, p[1], 0, 0, 0, 0.07, 0.74, 0.07);
      sh.cyl('#e8d8b0', p[0] + 0.1, 0.83, p[1], 0, 0, 0, 0.018, 0.1, 0.018);
    });
    sh.box('#201208', 0, 2.6, -6.3, 0.9, 0.6, 0.05); sh.box('#7a1a1a', 0, 2.6, -6.27, 0.8, 0.5, 0.02);   // a faded sign
    var furn = new T.Mesh(b.build(), M.vc); s.add(furn);
    this.candles = [];
    [[-3.5, -2.6], [4.0, -1.4]].forEach(function (p) { var c = new T.Mesh(new T.SphereGeometry(0.03, 6, 5), M.glow); c.position.set(p[0] + 0.1, 0.9, p[1]); s.add(c); });
    this.hemi = new T.HemisphereLight(0x9a7a5a, 0x0a0604, 0.5); s.add(this.hemi);
    this.back = new T.PointLight(0xff8040, 1.2, 9, 1.6); this.back.position.set(0, 2.2, -5.2); s.add(this.back);
    this.fill = new T.PointLight(0x7a8a9a, 0.5, 10, 1.5); this.fill.position.set(0, 2.2, 3.4); s.add(this.fill);
  };

  /** The hanging lamp: enamel shade, bulb, a cord to the ceiling and a soft cone of haze. It swings, and the light with it. */
  E.lamp = function () {
    var M = this.m, g = this.lampG = new T.Group(); g.position.set(0, 4.5, 0);
    var cord = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 2.3, 4), new T.MeshBasicMaterial({ color: 0x0a0806 })); cord.position.y = -1.15; g.add(cord);
    g.position.y = 4.55;
    var arm = new T.Group(); arm.position.y = -2.3; g.add(arm); this.swing = arm;
    var shade = new T.Mesh(new T.ConeGeometry(0.46, 0.3, 20, 1, true), new T.MeshStandardMaterial({ color: 0x1f3a2a, roughness: 0.5, metalness: 0.3, side: T.DoubleSide, emissive: 0x0a1a10 }));
    shade.position.y = -0.02; arm.add(shade);
    var inner = new T.Mesh(new T.ConeGeometry(0.44, 0.28, 20, 1, true), new T.MeshBasicMaterial({ color: 0xffd9a0, side: T.BackSide })); inner.position.y = -0.03; arm.add(inner);
    var bulb = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), M.glow); bulb.position.y = -0.14; arm.add(bulb);
    var spot = this.spot = new T.SpotLight(0xffc27a, 2.7, 9, 0.62, 0.9, 1.1);
    spot.position.set(0, -0.1, 0); arm.add(spot); var tgt = new T.Object3D(); tgt.position.set(0, -3, 0); arm.add(tgt); spot.target = tgt;
    spot.castShadow = !this.noShadow; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005; spot.shadow.camera.near = 0.5; spot.shadow.camera.far = 6;
    var glow = this.bulbLight = new T.PointLight(0xffb868, 0.9, 5, 1.3); glow.position.set(0, -0.35, 0); arm.add(glow);
    // haze cone: brighter at the shade, fading with distance
    var c = document.createElement('canvas'); c.width = 4; c.height = 64; var cg = c.getContext('2d'), gr = cg.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(255,214,150,.07)'); gr.addColorStop(0.6, 'rgba(255,200,130,.015)'); gr.addColorStop(1, 'rgba(255,200,130,0)'); cg.fillStyle = gr; cg.fillRect(0, 0, 4, 64);
    var ht = new T.CanvasTexture(c); ht.encoding = T.sRGBEncoding;
    var haze = new T.Mesh(new T.CylinderGeometry(0.4, 1.5, 2.6, 24, 1, true), new T.MeshBasicMaterial({ map: ht, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false }));
    haze.position.y = -1.45; arm.add(haze);
    this.lampMeshes = [shade, inner, bulb, haze, cord];
    if (this.q >= 2) haze.visible = false;
    this.scene.add(g);
  };

  E.dust = function () {
    var n = 110, p = new Float32Array(n * 3), r = K.rnd(9);
    for (var i = 0; i < n; i++) { p[i * 3] = (r() - 0.5) * 3.4; p[i * 3 + 1] = 0.9 + r() * 2.4; p[i * 3 + 2] = (r() - 0.5) * 3.4; }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3));
    var dc = document.createElement('canvas'); dc.width = dc.height = 16; var dg = dc.getContext('2d'), dgr = dg.createRadialGradient(8, 8, 0, 8, 8, 8); dgr.addColorStop(0, 'rgba(255,255,255,1)'); dgr.addColorStop(1, 'rgba(255,255,255,0)'); dg.fillStyle = dgr; dg.fillRect(0, 0, 16, 16);
    this.motes = new T.Points(g, new T.PointsMaterial({ map: new T.CanvasTexture(dc), color: 0xffe2b0, size: 0.03, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }));
    this.moteSeed = r; this.scene.add(this.motes);
  };

  E.resize = function () {
    var w = Math.max(1, this.el.clientWidth), h = Math.max(1, this.el.clientHeight);
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h; this.aspect = w / h; this.portrait = this.aspect < 1.2;           // compact: phones and narrow panes get the overhead view
    this.renderer.setSize(w, h, false);
    this.camera.aspect = this.aspect;
    if (this.portrait && this.coarse) this.camera.setViewOffset(w, h, 0, Math.round(h * 0.1), w, h); else this.camera.clearViewOffset();    // keep the action clear of the sticky dock
    this.camera.updateProjectionMatrix();
    this.hemi.intensity = this.portrait ? 0.85 : 0.5;
    if (this.lampMeshes) this.lampMeshes.forEach(function (m) { m.visible = !this.portrait; }, this);                    // seen from above the shade would hide the table
    // setSize clears the canvas and the ResizeObserver fires after our animation frame, so without this the cleared (white or black) canvas gets painted
    if (this.camInit) { try { this.renderer.render(this.scene, this.camera); } catch (e) {} }
  };

  /** Compile every shader the table will need now, so the first card, chip or highlight doesn't stall a frame mid-game. */
  E.prewarm = function () {
    var M = this.m, tmp = [];
    [[new T.PlaneGeometry(0.1, 0.1), M.card], [new T.BoxGeometry(0.1, 0.1, 0.1), M.vc], [new T.BoxGeometry(0.1, 0.1, 0.1), M.vcSmooth], [new T.PlaneGeometry(0.1, 0.1), M.ring], [new T.BoxGeometry(0.1, 0.1, 0.1), M.glow]].forEach(function (p) {
      var m = new T.Mesh(p[0], p[1]); m.position.set(0, -50, 0); m.frustumCulled = false; this.scene.add(m); tmp.push(m);
    }, this);
    try { this.renderer.compile(this.scene, this.camera); } catch (e) {}
    tmp.forEach(function (m) { this.scene.remove(m); m.geometry.dispose(); }, this);
  };

  // ───────────── syncing the model ─────────────
  E.update = function (m) {
    var wasMine = this.model && this.model.turnSeat === this.model.mySeat && this.model.mySeat >= 0;
    this.model = m;
    if (m.turnSeat >= 0 && m.turnSeat === m.mySeat && !wasMine && GL.audio) GL.audio.turn();
    if (m.onSit) this.onSit = m.onSit;
    var L = this.table.layout(this, m);
    this.syncSeats(m, L);
    this.syncCards(L.cards || []);
    this.syncChips(L.chips || []);
    this.syncLabels(L.labels || []);
    if (this.table.sync) this.table.sync(this, m);
  };

  E.seatPose = function (i) { return this.table.seatPose(this, i, this.model); };

  E.syncSeats = function (m, L) {
    var self = this, n = (m.seats || []).length, seen = {};
    (m.seats || []).forEach(function (s, i) {
      seen[i] = true;
      var pose = self.seatPose(i), st = self.seats[i];
      if (!st) { st = self.seats[i] = { i: i, root: new T.Group(), phase: Math.random() * 6, look: 0, lean: 0, react: 0, kind: '' }; self.scene.add(st.root); st.chair = new T.Mesh(self.chairGeo(), self.m.woodDark); st.chair.castShadow = !self.noShadow; st.chair.receiveShadow = true; st.root.add(st.chair); }
      st.pose = pose; st.data = s;
      var wantKey = s.pid ? s.avatar : '';
      if (st.avKey !== wantKey) {
        if (st.animal) { st.root.remove(st.animal.root); disposeAnimal(st.animal); st.animal = null; }
        if (wantKey) { st.animal = K.buildAnimal(s.avatar, self.m.vc); st.root.add(st.animal.root); self.shadowize(st.animal.root); st.react = 0; st.lastResult = null; }
        st.avKey = wantKey;
      }
      // reactions fire when the result first appears
      if (st.animal && s.result !== st.lastResult) { if (s.result === 'win') { st.react = 1; st.reactKind = 'win'; if (s.me && GL.audio) GL.audio.win(); } else if (s.result === 'lose') { st.react = 1; st.reactKind = 'lose'; if (s.me && GL.audio) GL.audio.lose(); } st.lastResult = s.result; }
      if (!st.snapped) { st.root.position.set(pose.x, 0, pose.z); st.root.rotation.y = pose.ry; st.snapped = true; }
    });
    Object.keys(this.seats).forEach(function (k) {
      if (!seen[k]) { var st = self.seats[k]; self.scene.remove(st.root); if (st.animal) disposeAnimal(st.animal); delete self.seats[k]; }
    });
  };
  function disposeAnimal(a) { a.body.geometry.dispose(); a.head.children.forEach(function (c) { c.geometry.dispose(); }); }
  E.chairGeo = function () { return this._chair || (this._chair = K.chairGeo()); };
  E.shadowize = function (o) { if (this.noShadow) return; o.traverse(function (c) { if (c.isMesh) c.castShadow = true; }); };

  /** Cards: a mesh each, keyed by id. New cards slide out of the deck (staggered), a changed face flips over. */
  E.syncCards = function (list) {
    var self = this, seen = {}, spawn = 0;
    list.forEach(function (c) {
      seen[c.id] = true;
      var e = self.cards[c.id];
      if (!e) {
        var mesh = new T.Mesh(K.cardGeo(c.face), self.m.card); mesh.castShadow = !self.noShadow; mesh.rotation.z = Math.PI;
        e = self.cards[c.id] = { mesh: mesh, face: c.face || null, delay: (c.instant ? 0 : (spawn++) * 0.16 + 0.05), flip: Math.PI, key: c.face || 'x' };
        var from = c.from || self.deck;
        mesh.position.set(from.x, from.y, from.z); mesh.scale.setScalar(0.8); mesh.visible = !!c.instant;
        e.born = c.instant; self.scene.add(mesh);
      }
      if ((c.face || null) !== e.face) { e.face = c.face || null; e.mesh.geometry = K.cardGeo(e.face); if (GL.audio && e.born !== undefined) GL.audio.card(true); }
      e.t = c; e.flipTo = c.face ? 0 : Math.PI;
    });
    Object.keys(this.cards).forEach(function (id) {
      if (!seen[id]) { var e = self.cards[id]; e.dying = true; e.t = { x: self.deck.x, y: self.deck.y, z: self.deck.z, ry: 0, tilt: 0, scale: 0.7 }; if (e.dyingT == null) e.dyingT = 0; }
    });
  };
  E.stepCards = function (dt) {
    var self = this, k = 1 - Math.pow(0.0015, dt);
    Object.keys(this.cards).forEach(function (id) {
      var e = self.cards[id], m = e.mesh, t = e.t;
      if (!t) return;
      if (e.delay > 0) { e.delay -= dt; if (e.delay > 0) return; m.visible = true; if (GL.audio) GL.audio.card(); }
      if (e.dying) { e.dyingT += dt; if (e.dyingT > 0.7) { self.scene.remove(m); delete self.cards[id]; return; } }
      var tilt = t.tilt || 0, lift = Math.sin(clamp(Math.abs(wrapPi(m.rotation.z - e.flipTo)) / Math.PI, 0, 1) * Math.PI) * 0.09 + Math.sin(tilt) * 0.046 * (t.scale || 1);
      m.position.x = lerp(m.position.x, t.x, k); m.position.z = lerp(m.position.z, t.z, k); m.position.y = lerp(m.position.y, t.y + lift, k);
      m.rotation.z = lerp(m.rotation.z, e.flipTo, 1 - Math.pow(0.003, dt));
      m.rotation.x = lerp(m.rotation.x, tilt, k); m.rotation.y = lerp(m.rotation.y, t.ry || 0, k);
      m.scale.setScalar(lerp(m.scale.x, t.scale || 1, k));
    });
  };

  /** Chips: one merged stack per key; rebuilt when the amount changes, sliding in from `from` (a seat) when new. */
  function chipValues(amount) {
    var vals = [100000, 25000, 5000, 1000, 500, 100, 25], out = [], left = amount;
    for (var i = 0; i < vals.length && out.length < 8; i++) while (left >= vals[i] && out.length < 8) { out.push(vals[i]); left -= vals[i]; }
    if (!out.length && amount > 0) out.push(25);
    return out.reverse();
  }
  E.syncChips = function (list) {
    var self = this, seen = {};
    list.forEach(function (c) {
      seen[c.id] = true;
      var e = self.chips[c.id];
      if (!e) {
        e = self.chips[c.id] = { mesh: new T.Mesh(K.chipStackGeo(chipValues(c.amount)), self.m.vc), amount: c.amount };
        e.mesh.material = self.m.vcSmooth; e.mesh.castShadow = !self.noShadow;
        var f = c.from || { x: c.x, z: c.z }; e.mesh.position.set(f.x, c.y == null ? TOP + 0.01 : c.y, f.z); self.scene.add(e.mesh); if (GL.audio) GL.audio.chip(2);
      } else if (e.amount !== c.amount) { if (GL.audio && c.amount > e.amount) GL.audio.chip(1); e.mesh.geometry = K.chipStackGeo(chipValues(c.amount)); e.amount = c.amount; }
      e.t = c;
    });
    Object.keys(this.chips).forEach(function (id) { if (!seen[id]) { self.scene.remove(self.chips[id].mesh); delete self.chips[id]; } });
  };
  E.stepChips = function (dt) {
    var k = 1 - Math.pow(0.002, dt), self = this;
    Object.keys(this.chips).forEach(function (id) {
      var e = self.chips[id], t = e.t, m = e.mesh;
      m.position.x = lerp(m.position.x, t.x, k); m.position.z = lerp(m.position.z, t.z, k); m.position.y = lerp(m.position.y, t.y == null ? TOP + 0.012 : t.y, k);
    });
  };

  /** HTML labels pinned to a point in the room. Reused by id; only touched when their content changes. */
  E.syncLabels = function (list) {
    var self = this, seen = {};
    list.forEach(function (l) {
      seen[l.id] = true;
      var e = self.lbl[l.id];
      if (!e) { var el = document.createElement('div'); el.className = 'gl-label'; self.labelsEl.appendChild(el); e = self.lbl[l.id] = { el: el, v: new T.Vector3(), html: null, cls: null }; }
      e.v.set(l.x, l.y, l.z); e.off = l.off || 0;
      if (e.html !== l.html) { e.el.innerHTML = l.html; e.html = l.html; }
      var cls = 'gl-label ' + (l.cls || ''); if (e.cls !== cls) { e.el.className = cls; e.cls = cls; }
      if (l.bar != null) { var u = e.el.querySelector('.bar u'); if (u) u.style.width = l.bar + '%'; }
      e.prio = l.prio || 0;
    });
    Object.keys(this.lbl).forEach(function (id) { if (!seen[id]) { self.lbl[id].el.remove(); delete self.lbl[id]; } });
  };
  E.stepLabels = function () {
    var w2 = this.w / 2, h2 = this.h / 2, v = new T.Vector3(), self = this;
    Object.keys(this.lbl).forEach(function (id) {
      var e = self.lbl[id];
      v.copy(e.v).project(self.camera);
      if (v.z > 1 || v.z < -1) { e.el.style.display = 'none'; return; }
      e.el.style.display = '';
      e.el.style.transform = 'translate(-50%,-100%) translate(' + (v.x * w2 + w2).toFixed(1) + 'px,' + (-v.y * h2 + h2 + e.off).toFixed(1) + 'px)';
      e.el.style.zIndex = String(10 + e.prio + Math.round((1 - v.z) * 500));
    });
  };

  // ───────────── frame ─────────────
  E.frame = function () {
    var dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime, self = this;
    this.frameMs = lerp(this.frameMs, dt * 1000, 0.05);
    // if the device can't hold ~30fps for a while, drop the resolution once
    if (this.frameMs > 34) { this.slow += dt; if (this.slow > 2.5 && !this.lowered) { this.lowered = true; this.renderer.setPixelRatio(Math.max(0.75, Math.min(global.devicePixelRatio || 1, 1) * 0.85)); this.renderer.setSize(this.w, this.h, false); } } else this.slow = Math.max(0, this.slow - dt);
    // lamp sways: the pool of light slides across the felt
    this.swing.rotation.z = Math.sin(t * 0.55) * 0.045; this.swing.rotation.x = Math.cos(t * 0.41) * 0.03;
    this.spot.intensity = 2.7 * (1 + Math.sin(t * 9.1) * 0.012 + Math.sin(t * 3.3) * 0.01);
    var p = this.motes.geometry.attributes.position, a = p.array;
    for (var i = 0; i < a.length; i += 3) { a[i] += Math.sin(t * 0.3 + i) * 0.0006; a[i + 1] += Math.sin(t * 0.2 + i * 2) * 0.0004 - 0.00012; if (a[i + 1] < 0.8) a[i + 1] = 3.2; }
    p.needsUpdate = true;
    // camera
    if (this.model) {
      var cam = this.table.camera(this, this.model);
      var okCam = cam.pos.concat(cam.look, [cam.fov]).every(isFinite);
      if (!okCam) cam = { pos: [0, 2.6, 3.2], look: [0, 0.7, 0], fov: 55 };
      var kk = this.camInit && isFinite(this.camPos.x + this.camPos.y + this.camPos.z + this.camLook.x + this.camLook.y + this.camLook.z) ? 1 - Math.pow(0.1, dt) : 1; this.camInit = true;
      if (Math.abs(this.camera.fov - cam.fov) > 0.01) { this.camera.fov = lerp(this.camera.fov, cam.fov, kk); this.camera.updateProjectionMatrix(); }
      this.camPos.x = lerp(this.camPos.x, cam.pos[0], kk); this.camPos.y = lerp(this.camPos.y, cam.pos[1], kk); this.camPos.z = lerp(this.camPos.z, cam.pos[2], kk);
      this.camLook.x = lerp(this.camLook.x, cam.look[0], kk); this.camLook.y = lerp(this.camLook.y, cam.look[1], kk); this.camLook.z = lerp(this.camLook.z, cam.look[2], kk);
    }
    var sway = this.portrait ? 0.5 : 1; if (this.model && this.model.seats && this.model.seats.some(function (q) { return q.canSit; })) sway = 0;   // hold still so the sit buttons are easy to hit
    this.camera.position.set(this.camPos.x + Math.sin(t * 0.37) * 0.035 * sway, this.camPos.y + Math.sin(t * 0.53) * 0.02 * sway, this.camPos.z + Math.cos(t * 0.29) * 0.02 * sway);
    var ob = this.orbit, ko = 1 - Math.pow(0.001, dt);
    ob.yaw = lerp(ob.yaw, ob.ty, ko); ob.pitch = lerp(ob.pitch, ob.tp, ko); ob.zoom = lerp(ob.zoom, ob.tz, ko);
    if (Math.abs(ob.yaw) > 0.001 || Math.abs(ob.pitch) > 0.001 || Math.abs(ob.zoom - 1) > 0.001) {          // look around: orbit the camera about what it's looking at
      var off = this.camera.position.clone().sub(this.camLook), len = off.length() * ob.zoom;
      var yaw = Math.atan2(off.x, off.z) + ob.yaw, hz = Math.hypot(off.x, off.z), el = clamp(Math.atan2(off.y, hz) + ob.pitch, 0.08, 1.45);
      this.camera.position.set(this.camLook.x + Math.sin(yaw) * Math.cos(el) * len, this.camLook.y + Math.sin(el) * len, this.camLook.z + Math.cos(yaw) * Math.cos(el) * len);
    }
    var lx = this.lampG.position.x, lz = this.lampG.position.z, cp = this.camera.position;   // never let the camera pass through the lamp's glowing shade, which fills the screen with white or black
    var dxl = cp.x - lx, dzl = cp.z - lz, dl = Math.hypot(dxl, dzl);
    if (cp.y > 1.7 && cp.y < 2.8 && dl < 0.75) { var kpush = (0.75 / (dl || 0.001)); cp.x = lx + dxl * kpush; cp.z = lz + dzl * kpush; }
    cp.x = clamp(cp.x, -5.5, 5.5); cp.z = clamp(cp.z, -5.5, 5.5); cp.y = clamp(cp.y, 0.45, 4.2);
    this.camera.lookAt(this.camLook); this.camera.updateMatrixWorld();
    this.animals(dt, t);
    this.stepCards(dt); this.stepChips(dt);
    if (this.table.tick) this.table.tick(this, dt, t);
    this.stepLabels();
    this.renderer.render(this.scene, this.camera);
  };

  /** Breathing, head turns toward whoever is acting, win and lose reactions, the open-seat glow. */
  E.animals = function (dt, t) {
    var m = this.model; if (!m) return;
    var self = this, kk = 1 - Math.pow(0.04, dt);
    var turn = m.turnSeat != null && m.turnSeat >= 0 ? this.seats[m.turnSeat] : null;
    Object.keys(this.seats).forEach(function (k) {
      var st = self.seats[k], an = st.animal; if (!an) return;
      var d = st.data, p = st.pose;
      st.root.position.x = lerp(st.root.position.x, p.x, kk); st.root.position.z = lerp(st.root.position.z, p.z, kk); st.root.rotation.y = lerp(st.root.rotation.y, p.ry, kk);
      var breathe = Math.sin(t * 1.5 + st.phase), idle = d.offline ? 0.4 : 1;
      var onTurn = turn === st;
      st.react = Math.max(0, st.react - dt / 2.4);
      var rk = st.reactKind, r = st.react, win = rk === 'win' ? r : 0, lose = rk === 'lose' ? r : 0;
      var lean = (onTurn ? 0.1 : 0) + (d.folded ? -0.06 : 0) + lose * 0.28 - win * 0.1;
      st.lean = lerp(st.lean, lean, kk);
      an.body.rotation.x = st.lean * 0.5 + breathe * 0.006 * idle;
      an.body.position.y = Math.max(0, Math.sin(win * Math.PI * 6) * 0.04 * win) + breathe * 0.004 * idle;
      an.body.scale.y = 1 + breathe * 0.012 * idle;
      // gaze
      var tx = 0, tz = 0, wander = Math.sin(t * 0.23 + st.phase * 3) * 0.35;
      var tgt = turn && turn !== st ? turn.pose : null, look;
      if (d.me) look = 0;
      else if (tgt) look = wrapPi(Math.atan2(tgt.x - p.x, tgt.z - p.z) - p.ry);
      else look = wrapPi(Math.atan2(-p.x * 0.4, -p.z * 0.4) - p.ry) + wander;
      if (onTurn && !d.me) look = wrapPi(Math.atan2(self.camPos.x - p.x, self.camPos.z - p.z) - p.ry) * 0.5;
      if (win > 0) look += Math.sin(t * 14) * 0.18 * win;
      st.look = lerp(st.look, clamp(look, -1.15, 1.15), 1 - Math.pow(0.1, dt));
      an.head.rotation.y = d.me ? 0 : st.look;
      an.head.rotation.x = lerp(an.head.rotation.x, (d.folded ? 0.28 : 0.05) + lose * 0.5 - win * 0.25 + (onTurn ? 0.1 : 0) + breathe * 0.01, kk);
      an.head.position.y = 0.99 + breathe * 0.004 * idle + win * 0.03;
      var blink = (Math.sin(t * 0.9 + st.phase * 7) > 0.987 || d.offline) ? 0.12 : 1;
      an.eyes.scale.y = lerp(an.eyes.scale.y, blink, 0.5);
      an.root.visible = !(d.me && self.table.hideSelf(self));           // first person: you're looking out of your own head
    });
    if (this.ctx.ring && m.turnSeat != null && m.turnSeat >= 0 && this.seats[m.turnSeat]) {
      var ts = this.seats[m.turnSeat], rp = this.table.ringPos ? this.table.ringPos(this, m.turnSeat) : null;
      if (rp) { this.ctx.ring.visible = true; this.ctx.ring.position.set(rp.x, TOP + 0.012, rp.z); this.ctx.ring.material.opacity = 0.5 + Math.sin(t * 4) * 0.15; }
    } else if (this.ctx.ring) this.ctx.ring.visible = false;
  };

  /** Look around from the buttons: dx/dy in radians, or null to go back to the default view. */
  E.look = function (dx, dy) { var o = this.orbit; if (dx == null) { o.ty = o.tp = 0; o.tz = 1; return; } o.ty = clamp(o.ty + dx, -1.6, 1.6); o.tp = clamp(o.tp + (dy || 0), -0.6, 0.6); };
  E.destroy = function () {
    if (!this.alive) return;
    this.alive = false; GL.live--; global.cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect(); if (this.io) this.io.disconnect();
    if (this.onResize) global.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVis);
    this.canvas.removeEventListener('webglcontextlost', this.onLost); this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    Object.keys(this.m).forEach(function (k) { var mm = this.m[k]; if (mm.map) mm.map.dispose(); mm.dispose(); }, this);
    this.renderer.dispose(); if (this.renderer.forceContextLoss) this.renderer.forceContextLoss();
    this.el.innerHTML = '';
  };

  // ───────────── camera rig ─────────────
  /** Look at `target` from direction (az, elev), far enough that `width` × `height` metres around it fit the screen. */
  function rig(E, target, width, height, elev, az, fov) {
    var tv = Math.tan(fov * Math.PI / 360), th = tv * E.aspect;
    var d = Math.max(width / 2 / th, height / 2 / tv);
    return { pos: [target[0] + Math.sin(az) * Math.cos(elev) * d, target[1] + Math.sin(elev) * d, target[2] + Math.cos(az) * Math.cos(elev) * d], look: target, fov: fov };
  }
  GL.rig = rig;

  // ───────────── labels shared by the tables ─────────────
  function seatTag(E, i, s, pose, extra) {
    var bar = null, cls = 'gl-tag' + (s.me ? ' me' : '') + (extra && extra.turn ? ' turn' : '') + (s.offline ? ' offline' : '') + (s.folded ? ' folded' : '');
    var inner = '<b class="n">' + esc(s.name) + (s.me ? ' <em>you</em>' : '') + '</b><span class="c">' + money(s.cash) + '</span>' + (s.status ? '<em class="s ' + (s.statusCls || '') + '">' + esc(s.status) + '</em>' : '');
    if (extra && extra.turn && extra.timer) { inner += '<i class="bar' + (extra.timer.urgent ? ' urgent' : '') + '"><u></u></i>'; bar = extra.timer.pct; }
    return { id: 'seat' + i, x: pose.x, y: 1.74, z: pose.z, html: inner, cls: cls, bar: bar, prio: s.me ? 0 : 5 };
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  GL.esc = esc;
  /** Open chairs get a "Sit here" button; everyone else's tag floats over their head. */
  E.seatLabels = function (m, out) {
    var self = this;
    (m.seats || []).forEach(function (s, i) {
      var pose = self.seatPose(i);
      if (s.pid && s.me && !self.portrait && self.table.hideSelf(self)) return;           // first person: your wallet and clock are in the HUD
      if (s.pid) out.push(seatTag(self, i, s, pose, { turn: m.turnSeat === i, timer: m.turnSeat === i ? m.timer : null }));
      else if (s.canSit) out.push({ id: 'seat' + i, x: pose.x, y: 1.0, z: pose.z, html: '<button type="button" class="gl-sit" data-seat="' + i + '">Sit here</button>', cls: 'gl-sitwrap', prio: 900 });
    });
  };

  // ───────────── the tables ─────────────
  var TABLES = {};
  var CARD_S = 2.5;
  function cardTilt(E) { return E.portrait ? 0.45 : 0.85; }
  function feltMat(E, tex) { return new T.MeshStandardMaterial({ map: tex, roughness: 0.95 }); }
  /** Wood slab + padded leather rail + brass trim + felt for any outline. shapes: { slab, rail:[outer,inner], felt, trim } */
  function tableBody(E, shapes, feltTex, bbox, pedestal) {
    var g = new T.Group(), M = E.m;
    function ext(shape, depth, bevel, mat, y) {
      var geo = new T.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 48 });
      var m = new T.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.castShadow = !E.noShadow; m.receiveShadow = true; g.add(m); return m;
    }
    ext(shapes.slab, 0.1, 0.012, M.wood, 0.62);                                  // underside apron: 0.62–0.72
    ext(shapes.railRing, 0.05, 0.03, M.leather, 0.76);                           // the padded rail, 0.76–0.84 with its bevel
    ext(shapes.trim, 0.012, 0, M.brass, 0.788);
    var felt = new T.Mesh(new T.ShapeGeometry(shapes.felt, 40), feltMat(E, feltTex));
    felt.rotation.x = -Math.PI / 2; felt.position.y = 0.795; felt.receiveShadow = true; g.add(felt);
    felt.material.map.wrapS = felt.material.map.wrapT = T.ClampToEdgeWrapping;
    felt.material.map.repeat.set(1 / bbox.w, 1 / bbox.h); felt.material.map.offset.set(-bbox.x0 / bbox.w, -bbox.y0 / bbox.h);
    E.feltMesh = felt;
    var b = new K.Builder(2), s = K.Shapes(b);
    (pedestal || [[0, 0]]).forEach(function (p) { s.cyl('#1c1008', p[0], 0.33, p[1], 0, 0, 0, 0.24, 0.66, 0.24); s.cyl('#2a180c', p[0], 0.03, p[1], 0, 0, 0, 0.55, 0.06, 0.55); s.cyl('#241408', p[0], 0.2, p[1], 0, 0, 0, 0.3, 0.1, 0.3); });
    var base = new T.Mesh(b.build(), M.vc); g.add(base);
    E.scene.add(g); return g;
  }
  function ringMesh(E, r) { var m = new T.Mesh(new T.RingGeometry(r * 0.85, r, 40), E.m.ring); m.rotation.x = -Math.PI / 2; m.visible = false; E.scene.add(m); return m; }
  function deckMesh(E, x, z) { var b = new K.Builder(1), s = K.Shapes(b); s.box('#4e1218', 0, 0.02, 0, 0.075, 0.036, 0.105); s.box('#e6dcc3', 0, 0.02, 0, 0.076, 0.03, 0.106); s.box('#4e1218', 0, 0.039, 0, 0.075, 0.004, 0.105); var m = new T.Mesh(b.build(), E.m.vc); m.position.set(x, TOP, z); m.rotation.y = 0.25; E.scene.add(m); return m; }

  // ── oval: Texas Hold'em and Teen Patti ──
  var OV = { rx: 1.5, rz: 0.96 };
  TABLES.oval = {
    build: function (E) {
      var rx = OV.rx, rz = OV.rz;
      var tex = null;
      E.ovalTex = null;
      var shapes = { slab: ellipseShape(rx + 0.2, rz + 0.2), railRing: ellipseShape(rx + 0.19, rz + 0.19, [rx, rz]), trim: ellipseShape(rx + 0.01, rz + 0.01, [rx - 0.012, rz - 0.012]), felt: ellipseShape(rx - 0.012, rz - 0.012) };
      var m = E.model;
      E.feltTexKey = null;
      var placeholder = K.feltTex(64, 64, '#123f82', '#dfeaff', null);
      var body = tableBody(E, shapes, placeholder, { x0: -rx, y0: -rz, w: rx * 2, h: rz * 2 });
      E.ctxBody = body;
      var d = deckMesh(E, -0.62, -0.18);
      return { ring: ringMesh(E, 0.17), deck: d };
    },
    retheme: function (E, th) {
      var key = th.felt + th.print + (th.print2 || '');
      if (E.feltTexKey === key) return; E.feltTexKey = key;
      var W = 1200, H = Math.round(1200 * OV.rz / OV.rx), old = E.feltMesh.material.map;
      var tex = K.feltTex(W, H, th.felt, th.ink, function (g, w, h, ink) {
        g.strokeStyle = ink; g.globalAlpha = 0.22; g.lineWidth = 3; g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.4, h * 0.4, 0, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.28, h * 0.27, 0, 0, TAU); g.stroke();
        g.globalAlpha = 0.34; g.fillStyle = ink; g.textAlign = 'center'; g.font = '700 ' + Math.round(h * 0.075) + 'px "Cormorant Garamond", Georgia, serif';
        K.arcText(g, th.print, w / 2, h * 0.5 - h * 0.02, h * 0.34, Math.PI / 2, Math.round(h * 0.07), h * 0.014);
        g.save(); g.translate(w / 2, h * 0.26); g.font = '600 ' + Math.round(h * 0.045) + 'px "Cormorant Garamond", Georgia, serif'; g.fillText(th.print2 || '', 0, 0); g.restore();
        g.globalAlpha = 1;
      }, 5);
      tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping; tex.repeat.set(1 / (OV.rx * 2), 1 / (OV.rz * 2)); tex.offset.set(0.5, 0.5);
      E.feltMesh.material.map = tex; E.feltMesh.material.needsUpdate = true; if (old) old.dispose();
    },
    seatPose: function (E, i, m) {
      var n = m.n || 6, my = m.mySeat >= 0 ? m.mySeat : -0.5;
      var slot = (i - my + n) % n, a = slot * TAU / n, rx = OV.rx + 0.05, rz = OV.rz + 0.05;
      var px = Math.sin(a) * rx, pz = Math.cos(a) * rz, nx = Math.sin(a) / rx, nz = Math.cos(a) / rz, nl = Math.hypot(nx, nz);
      var off = 0.46, x = px + nx / nl * off, z = pz + nz / nl * off;
      return { x: x, z: z, ry: Math.atan2(-x, -z), a: a, slot: slot };
    },
    ringPos: function (E, seat) { var p = E.seatPose(seat); return { x: p.x * 0.62, z: p.z * 0.6 }; },
    layout: function (E, m) {
      TABLES.oval.retheme(E, m.theme);
      var out = { cards: [], chips: [], labels: [] }, n = (m.seats || []).length, tilt = cardTilt(E);
      (m.hands || []).forEach(function (h) {
        var pose = E.seatPose(h.seat), s = m.seats[h.seat], me = s && s.me, cnt = h.cards.length, base = me ? { x: pose.x * 0.4, z: pose.z * 0.33 } : { x: pose.x * 0.52, z: pose.z * 0.5 };   // yours sit further in, clear of your own head
        var sp = me ? 0.2 : 0.15;
        h.cards.forEach(function (c, j) {
          out.cards.push({ id: h.id + ':' + j, face: c, x: base.x + (j - (cnt - 1) / 2) * sp, y: TOP + 0.004 + j * 0.0012, z: base.z + (me ? 0.06 : 0), ry: (me ? 0 : (pose.slot % 2 ? 0.1 : -0.1)) + (j - (cnt - 1) / 2) * 0.05, tilt: me ? tilt : tilt * 0.9, scale: me ? CARD_S * 1.3 : CARD_S * 1.12, from: h.from });
        });
        if (h.bet) out.chips.push({ id: 'bet' + h.seat, amount: h.bet, x: pose.x * 0.4, z: pose.z * 0.38, from: { x: pose.x, z: pose.z } });
        if (h.note) out.labels.push({ id: 'note' + h.seat, x: base.x, y: TOP + 0.2, z: base.z, html: esc(h.note), cls: 'gl-note ' + (h.noteCls || ''), prio: 2 });
      });
      (m.board || []).forEach(function (c, j) { out.cards.push({ id: 'board:' + j, face: c, x: (j - 2) * 0.22, y: TOP + 0.004, z: -0.03, ry: 0, tilt: tilt, scale: CARD_S * 1.3 }); });
      if (m.pot) out.chips.push({ id: 'pot', amount: m.pot, x: 0, z: 0.3, from: { x: 0, z: 0.5 } });
      if (m.potLabel) out.labels.push({ id: 'pot', x: 0, y: TOP + 0.3, z: 0.18, html: m.potLabel, cls: 'gl-pot', prio: 4 });
      if (m.button != null && m.button >= 0 && E.ctx.dealerBtn !== false) {
        var bp = E.seatPose(m.button); out.labels.push({ id: 'btn', x: bp.x * 0.46 + (bp.z > 0 ? 0.28 : -0.28) * 0.3, y: TOP + 0.05, z: bp.z * 0.46, html: m.buttonLabel || 'D', cls: 'gl-btn', prio: 1 });
      }
      E.seatLabels(m, out.labels);
      return out;
    },
    camera: function (E, m) {
      if (E.portrait || m.mySeat < 0) return E.portrait ? rig(E, [0, 0.66, 0.05], 3.35, 2.5, 0.95, 0, 56) : rig(E, [0, 0.74, -0.05], 4.5, 2.5, 0.3, 0, 52);
      var my = E.seatPose(m.mySeat), l = Math.hypot(my.x, my.z) || 1;       // sit in your chair: just behind where your head is
      return { pos: [my.x + my.x / l * 1.35, 2.2, my.z + my.z / l * 1.35], look: [0, 0.6, -0.2], fov: 56 };
    }
  };

  // ── half-moon: Blackjack ──
  var BJ = { R: 1.75, zd: -0.6, SEAT_DEG: [32, 61, 90, 119, 148] };
  function bjSeat(i) { var d = BJ.SEAT_DEG[i] * Math.PI / 180; return { c: Math.cos(d), s: Math.sin(d) }; }
  TABLES.moon = {
    build: function (E) {
      var R = BJ.R, zy = -BJ.zd;                                                 // shape y is -world z
      var shapes = { slab: moonShape(R + 0.2, zy, zy + 0.2), railRing: moonShape(R + 0.19, zy, zy + 0.19, [R, 0, zy]), trim: moonShape(R + 0.01, zy, zy + 0.01, [R - 0.012, 0, zy]), felt: moonShape(R - 0.012, zy, zy) };
      // moonShape holes use [radius, _, zy]; build the felt texture for the half-moon's bounding box
      var W = 1500, H = 770, ink = '#d8f5e4', placeholder = K.feltTex(64, 64, '#0f4a30', ink, null);
      var body = tableBody(E, shapes, placeholder, { x0: -R, y0: zy - R, w: R * 2, h: R }, [[0, 0.05]]);
      E.bjTex = null;
      var shoe = new K.Builder(2), s = K.Shapes(shoe);
      s.box('#17100a', 0, 0.045, 0, 0.17, 0.09, 0.12); s.box('#e6dcc3', 0, 0.075, 0.03, 0.15, 0.03, 0.09); s.box('#4e1218', 0, 0.05, 0.065, 0.16, 0.1, 0.01);
      var sm = new T.Mesh(shoe.build(), E.m.vc); sm.position.set(-0.9, TOP, BJ.zd + 0.22); sm.rotation.y = -0.2; E.scene.add(sm);
      var tray = new K.Builder(4), ts = K.Shapes(tray); ts.box('#0e0a07', 0, 0.02, 0, 0.7, 0.04, 0.12);
      ['#2c2a36', '#8b3fd1', '#c9971c', '#d6323f', '#23a35d', '#2f6fe0'].forEach(function (c, i) { ts.cyl(c, -0.27 + i * 0.108, 0.07, 0, 0, 0, 0, 0.04, 0.05, 0.04); });
      var tm = new T.Mesh(tray.build(), E.m.vc); tm.position.set(0.1, TOP, BJ.zd + 0.12); E.scene.add(tm);
      // the dealer, standing behind the straight edge
      var d = K.buildAnimal('raven', E.m.vc, { standing: true, reach: 0.5 }); d.root.position.set(0, 0, BJ.zd - 0.45); d.root.rotation.y = 0; E.scene.add(d.root); E.shadowize(d.root);
      E.dealer = { animal: d, phase: 1.7, look: 0 };
      var dl = new T.PointLight(0xffd0a0, 1.1, 3.2, 1.4); dl.position.set(0, 2.1, BJ.zd + 0.1); E.scene.add(dl);
      E.lampG.position.z = 0.1;
      return { ring: ringMesh(E, 0.2) };
    },
    retheme: function (E, th) {
      var key = th.felt + th.ink; if (E.feltTexKey === key) return; E.feltTexKey = key;
      var R = BJ.R, zy = -BJ.zd, W = 1500, H = 770, old = E.feltMesh.material.map;
      var tex = K.feltTex(W, H, th.felt, th.ink, function (g, w, h, ink) {
        g.fillStyle = ink; g.strokeStyle = ink; g.globalAlpha = 0.32;
        K.arcText(g, 'BLACKJACK PAYS 3 TO 2', w / 2, 0, h * 0.5, Math.PI / 2, Math.round(h * 0.062), h * 0.012);
        g.globalAlpha = 0.26; K.arcText(g, 'DEALER MUST STAND ON ALL 17s', w / 2, 0, h * 0.4, Math.PI / 2, Math.round(h * 0.044), h * 0.008);
        g.globalAlpha = 0.22; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, 0, h * 0.3, 0.45, Math.PI - 0.45); g.stroke();
        g.globalAlpha = 0.3; g.lineWidth = 3;
        BJ.SEAT_DEG.forEach(function (deg, i) { var a = deg * Math.PI / 180, r = 1.12 / R * h; g.beginPath(); g.arc(w / 2 + Math.cos(a) * r * 1, Math.sin(a) * r, h * 0.075, 0, TAU); g.stroke(); });
        g.globalAlpha = 1;
      }, 9);
      tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping; tex.repeat.set(1 / (R * 2), 1 / R); tex.offset.set(0.5, -(zy - R) / R);
      E.feltMesh.material.map = tex; E.feltMesh.material.needsUpdate = true; if (old) old.dispose();
    },
    seatPose: function (E, i) {
      var s = bjSeat(i), rs = BJ.R + 0.58, x = s.c * rs, z = BJ.zd + s.s * rs;
      return { x: x, z: z, ry: Math.atan2(-x, BJ.zd - z), c: s.c, s: s.s };
    },
    spot: function (i, hi, hc) {
      var s = bjSeat(i), r = 1.12, tx = -s.s, tz = s.c;                      // tangent along the arc
      var off = (hi - (hc - 1) / 2) * 0.3;
      return { x: s.c * r + tx * off * 1, z: BJ.zd + s.s * r + tz * off };
    },
    ringPos: function (E, seat) { var p = TABLES.moon.spot(seat, 0, 1); return { x: p.x, z: p.z }; },
    layout: function (E, m) {
      TABLES.moon.retheme(E, m.theme);
      var out = { cards: [], chips: [], labels: [] }, tilt = cardTilt(E);
      var shoe = { x: -0.9, y: TOP + 0.12, z: BJ.zd + 0.22 }; E.deck.set(shoe.x, shoe.y, shoe.z);
      var dl = m.dealer || { cards: [] };
      dl.cards.forEach(function (c, j) { out.cards.push({ id: 'dealer:' + j, face: c, x: (j - Math.max(0, dl.cards.length - 1) / 2) * 0.17, y: TOP + 0.004 + j * 0.001, z: BJ.zd + 0.42, ry: 0, tilt: tilt * 0.6, scale: CARD_S }); });
      if (dl.total != null) out.labels.push({ id: 'dtotal', x: 0, y: TOP + 0.24, z: BJ.zd + 0.4, html: '<b>' + dl.total + '</b>', cls: 'gl-total ' + (dl.totalCls || ''), prio: 4 });
      var perSeat = {};
      (m.hands || []).forEach(function (h) { (perSeat[h.seat] = perSeat[h.seat] || []).push(h); });
      Object.keys(perSeat).forEach(function (k) {
        var hs = perSeat[k], seat = +k;
        hs.forEach(function (h, hi) {
          var sp = TABLES.moon.spot(seat, hi, hs.length), cnt = h.cards.length, w = hs.length > 1 ? 0.085 : 0.11, mine = m.seats[seat] && m.seats[seat].me;
          h.cards.forEach(function (c, j) { out.cards.push({ id: h.id + ':' + j, face: c, x: sp.x + (j - (cnt - 1) / 2) * w, y: TOP + 0.004 + j * 0.0012, z: sp.z + j * -0.012, ry: (j - (cnt - 1) / 2) * 0.06, tilt: tilt * (mine ? 1 : 0.7), scale: CARD_S * (hs.length > 1 ? 0.8 : 0.95) }); });
          if (h.bet) out.chips.push({ id: 'bet:' + h.id, amount: h.bet, x: sp.x - bjSeat(seat).c * 0.24, z: sp.z - bjSeat(seat).s * 0.24, from: E.seatPose(seat) });
          var html = '';
          if (h.total != null) html += '<b>' + esc(h.total) + '</b>';
          if (h.note) html += '<small class="' + (h.noteCls || '') + '">' + esc(h.note) + '</small>';
          if (html) out.labels.push({ id: 'ht:' + h.id, x: sp.x, y: TOP + 0.2, z: sp.z - 0.02, html: html, cls: 'gl-total ' + (h.totalCls || '') + (h.active ? ' active' : ''), prio: 4 });
        });
      });
      // a bet placed before the deal (no hand yet)
      (m.bets || []).forEach(function (b) { var sp = TABLES.moon.spot(b.seat, 0, 1); out.chips.push({ id: 'bet:' + b.seat, amount: b.amount, x: sp.x, z: sp.z, from: E.seatPose(b.seat) }); });
      E.seatLabels(m, out.labels);
      if (m.status) out.labels.push({ id: 'status', x: 0, y: TOP + 0.5, z: BJ.zd + 0.95, html: esc(m.status), cls: 'gl-status', prio: 1 });
      return out;
    },
    tick: function (E, dt, t) {
      var d = E.dealer, m = E.model; if (!d || !m) return;
      var an = d.animal, kk = 1 - Math.pow(0.04, dt), breathe = Math.sin(t * 1.4 + d.phase);
      an.body.scale.y = 1 + breathe * 0.01; an.head.position.y = 0.99 + breathe * 0.004;
      var tgt = m.turnSeat != null && m.turnSeat >= 0 ? E.seatPose(m.turnSeat) : null, look = tgt ? Math.atan2(tgt.x, tgt.z - (BJ.zd - 0.45)) : Math.sin(t * 0.3) * 0.5;
      d.look = lerp(d.look, clamp(look, -1.1, 1.1), 1 - Math.pow(0.1, dt)); an.head.rotation.y = d.look; an.head.rotation.x = 0.1 + breathe * 0.01;
      an.eyes.scale.y = Math.sin(t * 0.8 + 2) > 0.988 ? 0.12 : 1;
    },
    camera: function (E, m) {
      if (E.portrait) { var mp = m.mySeat >= 0 ? E.seatPose(m.mySeat) : null; return rig(E, [mp ? mp.x * 0.5 : 0, 0.66, 0.35], mp ? 4.3 : 3.5, 3.0, 0.95, 0, 56); }
      var my = m.mySeat >= 0 ? E.seatPose(m.mySeat) : null, az = 0, tx = 0;
      if (my) { az = Math.atan2(my.x, my.z - BJ.zd) * 0.7; tx = my.x * 0.2; }
      return rig(E, [tx, 0.78, BJ.zd + 0.55], 3.9, 2.3, 0.62, az * 0.6, 52);
    }
  };

  TABLES.oval.hideSelf = TABLES.moon.hideSelf = function () { return false; };
  GL.TABLES = TABLES; GL.Engine = Engine;
  GL.helpers = { seatTag: seatTag, rig: rig, tableBody: tableBody, roundRect: roundRect, ringMesh: ringMesh, deckMesh: deckMesh, money: money, short: short, lerp: lerp, clamp: clamp, TOP: TOP, TAU: TAU, wrapPi: wrapPi, CARD_S: CARD_S, cardTilt: cardTilt };

  // ───────────── React wrapper ─────────────
  if (!R || !html) return;
  /** <Stage kind model fallback>children = HUD drawn over the canvas</Stage>. Falls back to `fallback` when WebGL can't start. */
  function Stage(props) {
    var ref = R.useRef(null), eng = R.useRef(null), st = R.useState(false), failed = st[0], setFailed = st[1], ep = R.useState(0), epoch = ep[0], setEpoch = ep[1];
    R.useEffect(function () {
      if (!ref.current) return;
      try { eng.current = new Engine(ref.current, props.kind, function () { GL.setQuality(Math.min(2, GL.getQuality() + 1)); setEpoch(function (n) { return n + 1; }); }); safeUpdate(eng.current, props.model); }
      catch (e) { if (global.console) console.warn('3D table unavailable, using the flat table:', e); if (eng.current) { try { eng.current.destroy(); } catch (x) {} eng.current = null; } setFailed(true); return; }
      var click = function (ev) { var b = ev.target.closest && ev.target.closest('.gl-sit'); if (b && eng.current && eng.current.onSit) { ev.preventDefault(); eng.current.onSit(+b.getAttribute('data-seat')); } };
      ref.current.addEventListener('click', click);
      return function () { if (ref.current) ref.current.removeEventListener('click', click); if (eng.current) { eng.current.destroy(); eng.current = null; } };
    }, [props.kind, epoch]);
    R.useEffect(function () { if (eng.current) safeUpdate(eng.current, props.model); });
    if (failed) return props.fallback || null;
    var ms = R.useState(GL.audio ? GL.audio.isMuted() : true), muted = ms[0], setMuted = ms[1];
    R.useEffect(function () { return GL.audio ? GL.audio.onChange(setMuted) : undefined; }, []);
    return html`<div className=${'gl-stage gl-' + props.kind}><div className="gl-view" ref=${ref}></div><div className="gl-hud">${props.children}
      
<button type="button" className="gl-quality" title=${'Graphics quality: ' + ['High', 'Medium', 'Low'][GL.getQuality()] + '. Click to change if the picture flickers or goes blank.'} aria-label="Graphics quality" onClick=${function () { GL.setQuality((GL.getQuality() + 1) % 3); setEpoch(function (n) { return n + 1; }); }}>⚙ ${['H', 'M', 'L'][GL.getQuality()]}</button>
      ${GL.audio ? html`<button type="button" className="gl-mute" aria-pressed=${!muted} aria-label=${muted ? 'Turn sound on' : 'Mute sound'} onClick=${function () { GL.audio.init(); GL.audio.setMuted(!muted); }}>${muted ? '🔇' : '🔊'}</button>` : null}</div></div>`;
  }
  GL.Stage = Stage;
  /** A model the scene can't draw (say, a player stood up mid-round) is skipped, never thrown into React. */
  function safeUpdate(e, m) { try { e.update(m); } catch (err) { if (global.console) console.warn('3D table update skipped:', err); } }
})(window);
