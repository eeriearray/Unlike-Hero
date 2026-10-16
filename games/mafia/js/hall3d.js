/* Mafia — the 3D town hall (Three.js r147, vendored).
   A lamp-lit meeting room: a round table, chairs, and one low-poly character per player, all built in code
   (no model files to download, no licences to track). Lighting follows the phase: evening lamplight in the lobby,
   moonlight at night, a warm sunrise at dawn, daylight for the meeting, a red-tinted spotlight for trials.

   window.MafiaHall3D
     supported()                  -> true if WebGL is available
     create(container)            -> hall
   hall.update(view, ui)          ui: { selectedId, canClick(player) -> bool, onPick(player) }
   hall.setInsets({top, right, bottom, left})   screen space covered by the HUD, so the table centres in what's left
   hall.react(playerId, emoji, fromName)        floating reaction over a character
   hall.say(playerId, text)                     speech bubble over a character
   hall.destroy()
   Name tags are HTML (crisp at any size) positioned over each character every frame. */
(function (global) {
  'use strict';
  var T = global.THREE;

  function supported() {
    try { var c = document.createElement('canvas'); return !!(T && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
  }

  // ───────────── looks ─────────────
  var COATS = [0x2b3140, 0x4a3324, 0x23383f, 0x4a2638, 0x2f402c, 0x4b4128, 0x1f2b47, 0x55301f, 0x34343a, 0x3a2950, 0x1f3d35, 0x512b2b, 0x404552, 0x5a4530, 0x283252, 0x46303f];
  var SKINS = [0xf1c9a5, 0xe0ac7e, 0xc68a5b, 0x9c6a43, 0x6e4a2f, 0xf3d5bd];
  var HAIRS = [0x1e1611, 0x3b2a1d, 0x6b4a2b, 0x8a8178, 0x2a2a2a, 0xa5522b];
  var TIES = [0x7d1622, 0x1f3d6b, 0xb08a3e, 0x2f5a3a, 0x5a2f6b, 0x101010];
  var HATS = ['fedora', 'cap', 'bowler', 'none', 'fedora', 'beret', 'fedora', 'none'];
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function shade(n, f) { var r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f); return hex((r << 16) | (g << 8) | b); }
  function hex(n) { return '#' + ('00000' + n.toString(16)).slice(-6); }
  /** A character's look, decided by their avatar choice (so the lobby picker previews exactly what the table shows). */
  function lookOf(avatar) {
    var list = (global.MafiaEngine && global.MafiaEngine.AVATARS) || [];
    var i = list.indexOf(avatar);
    if (i < 0) i = hash(String(avatar)) % 20;
    var look = { coat: COATS[i % COATS.length], skin: SKINS[(i * 5 + 1) % SKINS.length], hair: HAIRS[(i * 7 + 2) % HAIRS.length],
      tie: TIES[(i * 3) % TIES.length], hat: HATS[(i * 3 + Math.floor(i / 8)) % HATS.length] };
    look.css = { coat: hex(look.coat), skin: hex(look.skin), hair: hex(look.hair), hat: look.hat === 'none' ? hex(look.hair) : shade(look.coat, 0.7) };
    return look;
  }

  // Lighting per scene, blended smoothly every frame.
  var MOODS = {
    lobby: { hemi: 0.35, hemiSky: 0x8a6a55, lamp: 2.4, lampColor: 0xffc27a, win: 0.6, winColor: 0xb58aa0, candle: 1, fog: 0x120c0a, exposure: 1.05, sky: 'dusk' },
    night: { hemi: 0.32, hemiSky: 0x40508a, lamp: 1.7, lampColor: 0xffb070, win: 1.3, winColor: 0x8fa5e6, candle: 1, fog: 0x070a12, exposure: 1.15, sky: 'night' },
    dawn: { hemi: 0.4, hemiSky: 0xd59a7a, lamp: 0.8, lampColor: 0xffc890, win: 1.6, winColor: 0xff9c66, candle: 0.4, fog: 0x1c120f, exposure: 1.05, sky: 'dawn' },
    day: { hemi: 0.65, hemiSky: 0xc9d6e0, lamp: 0.9, lampColor: 0xffe2b8, win: 1.7, winColor: 0xfff1dc, candle: 0.15, fog: 0x1d1a17, exposure: 1.0, sky: 'day' },
    trial: { hemi: 0.14, hemiSky: 0x6a2a2a, lamp: 1.2, lampColor: 0xff8a6a, win: 0.5, winColor: 0xa0405a, candle: 0.8, fog: 0x120707, exposure: 1.0, sky: 'storm' },
    end: { hemi: 0.4, hemiSky: 0x8a6a55, lamp: 2.2, lampColor: 0xffc27a, win: 0.7, winColor: 0xd29a6a, candle: 1, fog: 0x120c0a, exposure: 1.05, sky: 'dusk' }
  };
  var SCENE_OF = { lobby: 'lobby', roles: 'lobby', night: 'night', dawn: 'dawn', discussion: 'day', voting: 'day', defense: 'trial', judgment: 'trial', verdict: 'trial', gameover: 'end' };

  // ───────────── procedural textures ─────────────
  function canvasTex(w, h, draw, repeat) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    t.anisotropy = 4;
    return t;
  }
  function rnd(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function woodTex(base, dark, planks, seed) {
    return canvasTex(512, 512, function (g, w, h) {
      var r = rnd(seed || 7);
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      var pw = w / planks;
      for (var p = 0; p < planks; p++) {
        g.fillStyle = 'rgba(0,0,0,' + (0.05 + r() * 0.12) + ')'; g.fillRect(p * pw, 0, pw, h);
        for (var i = 0; i < 26; i++) {
          g.strokeStyle = 'rgba(' + (r() < 0.5 ? '0,0,0' : '255,220,170') + ',' + (0.03 + r() * 0.06) + ')';
          g.lineWidth = 1 + r() * 2; g.beginPath();
          var x = p * pw + r() * pw; g.moveTo(x, 0);
          for (var y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y / 60 + r() * 2) * 3, y);
          g.stroke();
        }
        g.fillStyle = dark; g.fillRect(p * pw, 0, 2, h);
        var cut = r() * h; g.fillRect(p * pw, cut, pw, 2);
      }
    });
  }
  function feltTex() {
    return canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#3d1418'; g.fillRect(0, 0, w, h);
      var r = rnd(3);
      for (var i = 0; i < 4000; i++) { g.fillStyle = 'rgba(255,255,255,' + r() * 0.035 + ')'; g.fillRect(r() * w, r() * h, 1, 1); }
    }, [3, 3]);
  }
  function wallTex() {
    return canvasTex(512, 512, function (g, w, h) {
      var grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#3b2a20'); grd.addColorStop(1, '#2a1c15');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      for (var x = 0; x < w; x += 128) {
        g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 6; g.strokeRect(x + 14, 40, 100, h * 0.55);
        g.strokeStyle = 'rgba(255,220,170,.06)'; g.lineWidth = 2; g.strokeRect(x + 18, 44, 92, h * 0.55 - 8);
        g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 6; g.strokeRect(x + 14, h * 0.68, 100, h * 0.26);
      }
      g.fillStyle = 'rgba(176,138,70,.35)'; g.fillRect(0, h * 0.62, w, 6);
    }, [6, 1]);
  }
  function rugTex() {
    return canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = '#4a1219'; g.fillRect(0, 0, w, h);
      var cx = w / 2;
      [[0.49, '#2c0a0f', 10], [0.44, '#b08a3e', 3], [0.40, '#5e1720', 22], [0.30, '#b08a3e', 2], [0.27, '#3a0d13', 12]].forEach(function (ring) {
        g.strokeStyle = ring[1]; g.lineWidth = ring[2]; g.beginPath(); g.arc(cx, cx, w * ring[0], 0, Math.PI * 2); g.stroke();
      });
      for (var i = 0; i < 24; i++) {
        var a = (i / 24) * Math.PI * 2; g.fillStyle = 'rgba(176,138,62,.5)';
        g.beginPath(); g.arc(cx + Math.cos(a) * w * 0.35, cx + Math.sin(a) * w * 0.35, 6, 0, Math.PI * 2); g.fill();
      }
    });
  }
  var SKY = {
    dusk: ['#2b2346', '#a2556b', '#e59a6b'], night: ['#04070f', '#0c1630', '#1b2a4a'], dawn: ['#3b3561', '#e2836b', '#ffc98a'],
    day: ['#6f95b8', '#b9cfdc', '#e6e1cf'], storm: ['#1c1016', '#4a1e26', '#6b2a2a']
  };
  function drawSky(g, w, h, kind) {
    var c = SKY[kind] || SKY.dusk, grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, c[0]); grd.addColorStop(0.65, c[1]); grd.addColorStop(1, c[2]);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    var r = rnd(11);
    if (kind === 'night' || kind === 'dusk' || kind === 'storm') {
      for (var i = 0; i < 120; i++) { g.fillStyle = 'rgba(255,255,255,' + (kind === 'night' ? 0.4 + r() * 0.6 : r() * 0.35) + ')'; g.fillRect(r() * w, r() * h * 0.6, 1.5, 1.5); }
    }
    if (kind === 'night') { g.fillStyle = '#fbf6e2'; g.shadowColor = '#c8d4ff'; g.shadowBlur = 40; g.beginPath(); g.arc(w * 0.72, h * 0.22, 26, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0; }
    if (kind === 'dawn' || kind === 'day') { g.fillStyle = kind === 'dawn' ? '#ffd27a' : '#fff6da'; g.shadowColor = '#ffd27a'; g.shadowBlur = 60; g.beginPath(); g.arc(w * 0.3, h * (kind === 'dawn' ? 0.62 : 0.22), 34, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0; }
    // the town skyline with its clock tower
    g.fillStyle = kind === 'day' ? '#4b5560' : '#0d0b12';
    var x = 0;
    while (x < w) { var bw = 30 + r() * 50, bh = 40 + r() * 110; g.fillRect(x, h - bh, bw, bh); if (r() < 0.3) { g.beginPath(); g.moveTo(x, h - bh); g.lineTo(x + bw / 2, h - bh - 20); g.lineTo(x + bw, h - bh); g.fill(); } x += bw + 2; }
    g.fillRect(w * 0.47, h - 230, 30, 230); g.beginPath(); g.moveTo(w * 0.47 - 6, h - 230); g.lineTo(w * 0.47 + 15, h - 275); g.lineTo(w * 0.47 + 36, h - 230); g.fill();
    if (kind !== 'day') {
      g.fillStyle = '#ffcf7a';
      for (var k = 0; k < 90; k++) if (r() < 0.6) g.fillRect(r() * w, h - r() * 100, 3, 4);
      g.beginPath(); g.arc(w * 0.47 + 15, h - 205, 9, 0, Math.PI * 2); g.fill();
    }
  }

  // ───────────── the hall ─────────────
  function Hall(container) {
    var self = this;
    if (!tmpColor) { tmpColor = new T.Color(); tmpV = new T.Vector3(); }
    this.el = container;
    this.coarse = global.matchMedia && global.matchMedia('(pointer: coarse)').matches;
    this.renderer = new T.WebGLRenderer({ antialias: !this.coarse, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, this.coarse ? 1.5 : 2));
    this.renderer.outputEncoding = T.sRGBEncoding;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = !this.coarse;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.domElement.className = 'hall3d-canvas';
    container.appendChild(this.renderer.domElement);
    this.labels = document.createElement('div'); this.labels.className = 'hall3d-labels';
    container.appendChild(this.labels);

    this.scene = new T.Scene();
    this.scene.fog = new T.FogExp2(0x120c0a, 0.05);
    this.camera = new T.PerspectiveCamera(36, 1, 0.1, 80);
    this.insets = { top: 0, right: 0, bottom: 0, left: 0 };
    this.mood = Object.assign({}, MOODS.lobby);
    this.target = MOODS.lobby;
    this.skyKind = '';
    this.seats = {};
    this.order = [];
    this.view = null; this.ui = {};
    this.hover = null;
    this.tableR = 2.4;
    this.clock = new T.Clock();

    this.buildRoom();
    this.buildTable();
    this.setSky('dusk');

    this.raycaster = new T.Raycaster();
    this.pointer = new T.Vector2();
    var canvas = this.renderer.domElement;
    this.onMove = function (e) { self.pointerAt(e); self.pick(false); };
    this.onClick = function (e) { self.pointerAt(e); self.pick(true); };
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('click', this.onClick);
    this.onResize = function () { self.resize(); };
    global.addEventListener('resize', this.onResize);
    this.resize();
    this.alive = true;
    (function loop() { if (!self.alive) return; self.raf = global.requestAnimationFrame(loop); if (!document.hidden) self.frame(); })();
  }

  var H = Hall.prototype;

  H.std = function (color, rough, metal, extra) {
    return new T.MeshStandardMaterial(Object.assign({ color: color, roughness: rough == null ? 0.8 : rough, metalness: metal || 0 }, extra || {}));
  };

  H.buildRoom = function () {
    var s = this.scene;
    this.hemi = new T.HemisphereLight(0x8a6a55, 0x120a08, 0.35); s.add(this.hemi);
    // floor
    var floorTex = woodTex('#5a3a24', '#2a1a10', 6, 5); floorTex.repeat.set(8, 8); floorTex.wrapS = floorTex.wrapT = T.RepeatWrapping;
    var floor = new T.Mesh(new T.PlaneGeometry(40, 40), this.std(0xffffff, 0.85, 0, { map: floorTex }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    this.rug = new T.Mesh(new T.CircleGeometry(4.6, 64), this.std(0xffffff, 1, 0, { map: rugTex() }));
    this.rug.rotation.x = -Math.PI / 2; this.rug.position.y = 0.01; this.rug.receiveShadow = true; s.add(this.rug);
    // walls
    var wallMat = this.std(0xffffff, 0.9, 0, { map: wallTex() });
    var back = new T.Mesh(new T.PlaneGeometry(40, 10), wallMat); back.position.set(0, 5, -9); back.receiveShadow = true; s.add(back);
    var left = new T.Mesh(new T.PlaneGeometry(40, 10), wallMat); left.position.set(-11, 5, 0); left.rotation.y = Math.PI / 2; s.add(left);
    var right = left.clone(); right.position.x = 11; right.rotation.y = -Math.PI / 2; s.add(right);
    // tall windows onto the town
    this.skyTex = canvasTex(512, 512, function (g, w, h) { drawSky(g, w, h, 'dusk'); });
    var skyMat = new T.MeshBasicMaterial({ map: this.skyTex, toneMapped: false, fog: false });
    var frameMat = this.std(0x22160e, 0.7);
    var curtainMat = this.std(0x5a1420, 0.95);
    this.curtainMat = curtainMat;
    [-4.2, 0, 4.2].forEach(function (x, i) {
      var sky = new T.Mesh(new T.PlaneGeometry(2, 3.6), skyMat);
      sky.position.set(x, 4.1, -8.98);
      var off = (i - 1) * 0.28; sky.geometry = sky.geometry.clone();
      var uv = sky.geometry.attributes.uv; for (var k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * 0.32 + 0.34 + off);
      s.add(sky);
      [[0, 1.82, 2.2, 0.12], [0, -1.82, 2.2, 0.12], [-1.05, 0, 0.12, 3.76], [1.05, 0, 0.12, 3.76], [0, 0, 0.06, 3.6], [0, 0.4, 2, 0.06]].forEach(function (b) {
        var m = new T.Mesh(new T.BoxGeometry(b[2], b[3], 0.12), frameMat); m.position.set(x + b[0], 4.1 + b[1], -8.92); s.add(m);
      });
      [-1, 1].forEach(function (side) {
        var c = new T.Mesh(new T.BoxGeometry(0.55, 4.6, 0.14), curtainMat); c.position.set(x + side * 1.32, 4.1, -8.85); s.add(c);
      });
    });
    // light pouring in through the windows
    this.winLight = new T.DirectionalLight(0xb58aa0, 0.6);
    this.winLight.position.set(1.5, 6, -9); this.winLight.target.position.set(0, 0, 1);
    s.add(this.winLight); s.add(this.winLight.target);
    // a portrait of the founder, and a banner
    var frame = new T.Mesh(new T.BoxGeometry(1.2, 1.5, 0.08), this.std(0x7a5a28, 0.4, 0.6)); frame.position.set(-7.4, 4.4, -8.94); s.add(frame);
    var canvasMesh = new T.Mesh(new T.PlaneGeometry(1, 1.3), this.std(0x2a201a, 1)); canvasMesh.position.set(-7.4, 4.4, -8.89); s.add(canvasMesh);
    var frame2 = frame.clone(); frame2.position.x = 7.4; s.add(frame2);
    var canvas2 = canvasMesh.clone(); canvas2.position.x = 7.4; s.add(canvas2);
  };

  H.buildTable = function () {
    var s = this.scene, self = this;
    this.tableGroup = new T.Group(); s.add(this.tableGroup);
    this.woodMat = this.std(0xffffff, 0.55, 0.05, { map: woodTex('#6b4228', '#2b170b', 10, 9) });
    this.feltMat = this.std(0xffffff, 1, 0, { map: feltTex() });
    this.brassMat = this.std(0xb08a3e, 0.35, 0.8);
    // hanging lamp
    this.lamp = new T.Group(); this.lamp.position.set(0, 4.3, 0); s.add(this.lamp);
    var cord = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 4, 6), this.std(0x111111, 0.8)); cord.position.y = 2; this.lamp.add(cord);
    var shade = new T.Mesh(new T.ConeGeometry(0.75, 0.45, 32, 1, true), this.std(0x1d3a2a, 0.45, 0.4, { side: T.DoubleSide }));
    shade.position.y = 0.05; this.lamp.add(shade);
    var rim = new T.Mesh(new T.TorusGeometry(0.75, 0.02, 6, 32), this.brassMat); rim.rotation.x = Math.PI / 2; rim.position.y = -0.17; this.lamp.add(rim);
    this.bulb = new T.Mesh(new T.SphereGeometry(0.12, 16, 12), new T.MeshBasicMaterial({ color: 0xffe2b0 })); this.bulb.position.y = -0.08; this.lamp.add(this.bulb);
    this.lampLight = new T.SpotLight(0xffc27a, 2.4, 16, 0.9, 0.55, 1.1);
    this.lampLight.position.set(0, 4.15, 0); this.lampLight.target.position.set(0, 0, 0);
    this.lampLight.castShadow = !this.coarse; this.lampLight.shadow.mapSize.set(1024, 1024); this.lampLight.shadow.bias = -0.0008;
    s.add(this.lampLight); s.add(this.lampLight.target);
    // trial spotlight (aimed at the accused)
    this.spot = new T.SpotLight(0xfff0d0, 0, 12, 0.22, 0.4, 1);
    this.spot.position.set(0, 7, 3); s.add(this.spot); s.add(this.spot.target);
    // candles
    this.candles = new T.Group(); s.add(this.candles);
    this.flames = [];
    var waxMat = this.std(0xefe5cf, 0.6), flameMat = new T.MeshBasicMaterial({ color: 0xffc35a });
    [[-0.32, 0.36], [0, 0.22], [0.32, 0.36]].forEach(function (c, i) {
      var h = c[1];
      var wax = new T.Mesh(new T.CylinderGeometry(0.05, 0.055, h, 12), waxMat); wax.position.set(c[0], 0.8 + h / 2, i === 1 ? 0.12 : 0); wax.castShadow = true;
      var flame = new T.Mesh(new T.ConeGeometry(0.03, 0.09, 8), flameMat); flame.position.set(c[0], 0.8 + h + 0.05, wax.position.z);
      var holder = new T.Mesh(new T.CylinderGeometry(0.09, 0.11, 0.03, 16), self.brassMat); holder.position.set(c[0], 0.795, wax.position.z);
      self.candles.add(wax); self.candles.add(flame); self.candles.add(holder); self.flames.push(flame);
    });
    this.candleLight = new T.PointLight(0xffa64a, 1, 5, 2); this.candleLight.position.set(0, 1.4, 0.05); s.add(this.candleLight);
    // phase props on the table
    this.props = {};
    var box = new T.Group();
    var boxBody = new T.Mesh(new T.BoxGeometry(0.5, 0.36, 0.36), this.woodMat); boxBody.position.y = 0.98; boxBody.castShadow = true; box.add(boxBody);
    var slot = new T.Mesh(new T.BoxGeometry(0.28, 0.01, 0.04), this.std(0x050505, 1)); slot.position.y = 1.165; box.add(slot);
    var plate = new T.Mesh(new T.PlaneGeometry(0.22, 0.08), this.brassMat); plate.position.set(0, 0.98, 0.181); box.add(plate);
    box.position.set(0, 0, -0.55); this.props.voting = box;
    var gavel = new T.Group();
    var head = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.3, 16), this.woodMat); head.rotation.z = Math.PI / 2; head.position.y = 0.88; gavel.add(head);
    var handle = new T.Mesh(new T.CylinderGeometry(0.018, 0.022, 0.42, 8), this.woodMat); handle.rotation.x = Math.PI / 2; handle.position.set(0, 0.86, 0.2); gavel.add(handle);
    var block = new T.Mesh(new T.CylinderGeometry(0.16, 0.18, 0.05, 24), this.woodMat); block.position.set(0.3, 0.83, -0.1); gavel.add(block);
    gavel.position.set(0, 0, -0.55); gavel.rotation.y = 0.5; this.props.trial = gavel;
    var paperTex = canvasTex(256, 340, function (g, w, h) {
      g.fillStyle = '#efe5cf'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1712';
      g.font = 'bold 26px Georgia'; g.textAlign = 'center'; g.fillText('The Ravenport', w / 2, 40); g.fillText('Ledger', w / 2, 70);
      g.fillRect(14, 82, w - 28, 3); g.font = 'bold 30px Georgia'; g.fillText('MURDER!', w / 2, 124);
      g.fillStyle = 'rgba(29,23,18,.55)'; for (var y = 150; y < h - 20; y += 12) { g.fillRect(16, y, w / 2 - 24, 4); g.fillRect(w / 2 + 8, y, w / 2 - 24, 4); }
    });
    var paper = new T.Mesh(new T.PlaneGeometry(0.5, 0.66), this.std(0xffffff, 0.95, 0, { map: paperTex }));
    paper.rotation.x = -Math.PI / 2; paper.rotation.z = 0.35; paper.position.set(0.1, 0.805, -0.55); paper.receiveShadow = true;
    this.props.paper = paper;
    var deck = new T.Group();
    for (var d = 0; d < 6; d++) {
      var card = new T.Mesh(new T.BoxGeometry(0.22, 0.008, 0.32), this.std(d === 5 ? 0x7d1622 : 0xefe5cf, 0.6));
      card.position.set(Math.sin(d) * 0.01, 0.805 + d * 0.009, -0.55); card.rotation.y = d * 0.05; deck.add(card);
    }
    this.props.roles = deck;
    Object.keys(this.props).forEach(function (k) { self.props[k].visible = false; s.add(self.props[k]); });
    this.setTableSize(2.4);
  };

  H.setTableSize = function (R) {
    if (this.tableTop && Math.abs(this.tableR - R) < 0.01) return;
    this.tableR = R;
    var g = this.tableGroup;
    while (g.children.length) g.remove(g.children[0]);
    var top = new T.Mesh(new T.CylinderGeometry(R, R, 0.1, 64), this.woodMat); top.position.y = 0.75; top.castShadow = true; top.receiveShadow = true; g.add(top);
    var felt = new T.Mesh(new T.CylinderGeometry(R - 0.32, R - 0.32, 0.012, 64), this.feltMat); felt.position.y = 0.806; felt.receiveShadow = true; g.add(felt);
    var inlay = new T.Mesh(new T.TorusGeometry(R - 0.32, 0.012, 6, 64), this.brassMat); inlay.rotation.x = Math.PI / 2; inlay.position.y = 0.806; g.add(inlay);
    var apron = new T.Mesh(new T.CylinderGeometry(R - 0.1, R - 0.1, 0.14, 64, 1, true), this.woodMat); apron.position.y = 0.63; g.add(apron);
    var post = new T.Mesh(new T.CylinderGeometry(0.22, 0.3, 0.6, 24), this.woodMat); post.position.y = 0.3; post.castShadow = true; g.add(post);
    var foot = new T.Mesh(new T.CylinderGeometry(0.8, 0.95, 0.08, 32), this.woodMat); foot.position.y = 0.04; foot.receiveShadow = true; g.add(foot);
    this.tableTop = top;
    this.rug.scale.setScalar((R + 1.9) / 4.6);
  };

  // ───────────── characters ─────────────
  H.makeSeat = function (p) {
    var h = hash(p.id);
    var look = lookOf(p.avatar);
    var self = this;
    var seat = { id: p.id, root: new T.Group(), body: new T.Group(), headPivot: new T.Group(), pick: [], look: look, bob: (h % 1000) / 159 };
    var coatMat = this.std(look.coat, 0.75); seat.coatMat = coatMat;
    var skinMat = this.std(look.skin, 0.6), hairMat = this.std(look.hair, 0.9), shirtMat = this.std(0xece3cf, 0.8);
    var tieMat = this.std(look.tie, 0.5), dark = this.std(0x111111, 0.5);
    var add = function (parent, geo, mat, x, y, z, shadow) {
      var m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (shadow !== false) m.castShadow = true; parent.add(m); seat.pick.push(m); m.userData.pid = p.id; return m;
    };
    // chair (local +z faces the table)
    var chair = new T.Group(); seat.root.add(chair);
    add(chair, new T.BoxGeometry(0.58, 0.06, 0.55), this.woodMat, 0, 0.48, 0);
    add(chair, new T.BoxGeometry(0.58, 0.82, 0.06), this.woodMat, 0, 0.92, -0.27);
    add(chair, new T.BoxGeometry(0.46, 0.5, 0.02), this.std(0x5a1420, 0.95), 0, 0.98, -0.235, false);
    add(chair, new T.CylinderGeometry(0.035, 0.035, 0.08, 8), this.brassMat, -0.26, 1.35, -0.27, false);
    add(chair, new T.CylinderGeometry(0.035, 0.035, 0.08, 8), this.brassMat, 0.26, 1.35, -0.27, false);
    [[-0.25, -0.24], [0.25, -0.24], [-0.25, 0.24], [0.25, 0.24]].forEach(function (l) { add(chair, new T.BoxGeometry(0.05, 0.46, 0.05), self.woodMat, l[0], 0.23, l[1]); });
    // body
    seat.root.add(seat.body);
    var torso = add(seat.body, new T.CapsuleGeometry(0.23, 0.3, 6, 16), coatMat, 0, 0.92, 0.02); torso.scale.set(1.18, 1, 0.82);
    var shirt = add(seat.body, new T.ConeGeometry(0.11, 0.32, 3), shirtMat, 0, 1.03, 0.19, false); shirt.rotation.x = Math.PI; shirt.rotation.y = Math.PI / 3; shirt.scale.z = 0.3;
    add(seat.body, new T.BoxGeometry(0.045, 0.22, 0.02), tieMat, 0, 1.0, 0.215, false);
    seat.rose = add(seat.body, new T.SphereGeometry(0.035, 10, 8), this.std(0xc3283a, 0.4), -0.13, 1.08, 0.2, false); seat.rose.visible = false;
    [-1, 1].forEach(function (side) {
      var arm = add(seat.body, new T.CapsuleGeometry(0.07, 0.36, 4, 10), coatMat, side * 0.27, 0.95, 0.24); arm.rotation.x = 1.15; arm.rotation.z = side * -0.12;
      add(seat.body, new T.SphereGeometry(0.075, 12, 10), skinMat, side * 0.21, 0.83, 0.5);
    });
    // head
    seat.headPivot.position.set(0, 1.22, 0.02); seat.body.add(seat.headPivot);
    add(seat.headPivot, new T.CylinderGeometry(0.07, 0.08, 0.1, 10), skinMat, 0, 0.02, 0, false);
    add(seat.headPivot, new T.SphereGeometry(0.19, 24, 18), skinMat, 0, 0.2, 0);
    seat.eyes = [];
    [-1, 1].forEach(function (side) { seat.eyes.push(add(seat.headPivot, new T.SphereGeometry(0.022, 8, 6), dark, side * 0.068, 0.23, 0.168, false)); });
    add(seat.headPivot, new T.SphereGeometry(0.03, 8, 6), this.std(new T.Color(look.skin).multiplyScalar(0.85).getHex(), 0.6), 0, 0.19, 0.19, false);
    seat.tape = add(seat.headPivot, new T.BoxGeometry(0.16, 0.035, 0.02), this.std(0x8f8b80, 0.9), 0, 0.12, 0.172, false); seat.tape.visible = false;
    var hatMat = this.std(new T.Color(look.coat).multiplyScalar(0.7).getHex(), 0.7);
    if (look.hat === 'fedora') {
      add(seat.headPivot, new T.CylinderGeometry(0.3, 0.3, 0.025, 28), hatMat, 0, 0.33, 0);
      add(seat.headPivot, new T.CylinderGeometry(0.15, 0.18, 0.17, 20), hatMat, 0, 0.43, 0);
      add(seat.headPivot, new T.CylinderGeometry(0.182, 0.182, 0.04, 20), this.std(0x161010, 0.6), 0, 0.37, 0, false);
    } else if (look.hat === 'bowler') {
      var dome = add(seat.headPivot, new T.SphereGeometry(0.2, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), hatMat, 0, 0.32, 0); dome.scale.y = 0.85;
      add(seat.headPivot, new T.CylinderGeometry(0.26, 0.26, 0.02, 24), hatMat, 0, 0.32, 0);
    } else if (look.hat === 'cap') {
      var cap = add(seat.headPivot, new T.SphereGeometry(0.205, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hatMat, 0, 0.27, -0.01); cap.scale.set(1.05, 0.55, 1.1);
      add(seat.headPivot, new T.BoxGeometry(0.24, 0.02, 0.12), hatMat, 0, 0.29, 0.2);
    } else if (look.hat === 'beret') {
      var beret = add(seat.headPivot, new T.SphereGeometry(0.22, 20, 12), this.std(0x2a1a2a, 0.9), 0.03, 0.34, -0.01); beret.scale.set(1, 0.32, 1);
    } else {
      var hair = add(seat.headPivot, new T.SphereGeometry(0.2, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.8), hairMat, 0, 0.22, -0.02); hair.scale.set(1.04, 1.02, 1.06);
    }
    // the ghost a dead player becomes
    var ghostMat = new T.MeshStandardMaterial({ color: 0xcfe0ff, emissive: 0x6f86c9, emissiveIntensity: 0.6, transparent: true, opacity: 0.38, depthWrite: false });
    seat.ghost = new T.Group();
    var gh = add(seat.ghost, new T.SphereGeometry(0.2, 20, 16), ghostMat, 0, 1.45, 0, false);
    var gb = add(seat.ghost, new T.ConeGeometry(0.28, 0.75, 20, 1, true), ghostMat, 0, 1.05, 0, false); gb.rotation.x = Math.PI;
    gh.userData.pid = gb.userData.pid = p.id;
    seat.ghost.visible = false; seat.root.add(seat.ghost);
    // floor ring for hover / selection / my vote
    seat.ring = new T.Mesh(new T.RingGeometry(0.42, 0.52, 40), new T.MeshBasicMaterial({ color: 0xe8b45a, transparent: true, opacity: 0, depthWrite: false }));
    seat.ring.rotation.x = -Math.PI / 2; seat.ring.position.y = 0.02; seat.root.add(seat.ring);
    // name tag
    seat.tagEl = document.createElement('button');
    seat.tagEl.type = 'button'; seat.tagEl.className = 'n3d';
    seat.tagEl.innerHTML = '<span class="n3d-votes" hidden></span><span class="n3d-bubble" hidden></span><span class="n3d-name"></span><span class="n3d-tag"></span>';
    seat.tagEl.addEventListener('click', function () { self.clickSeat(p.id); });
    seat.tagEl.addEventListener('pointerenter', function () { self.setHover(p.id); });
    seat.tagEl.addEventListener('pointerleave', function () { self.setHover(null); });
    this.labels.appendChild(seat.tagEl);
    this.scene.add(seat.root);
    return seat;
  };

  H.removeSeat = function (id) {
    var s = this.seats[id]; if (!s) return;
    this.scene.remove(s.root);
    s.root.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    s.tagEl.remove();
    delete this.seats[id];
  };

  // ───────────── state ─────────────
  H.update = function (view, ui) {
    this.view = view; this.ui = ui || {};
    var players = view ? view.players : [];
    var self = this;
    // seats
    var ids = players.map(function (p) { return p.id; });
    Object.keys(this.seats).forEach(function (id) { if (ids.indexOf(id) < 0) self.removeSeat(id); });
    players.forEach(function (p) { if (!self.seats[p.id]) self.seats[p.id] = self.makeSeat(p); });
    var me = view && view.me ? view.me.id : null;
    var mine = Math.max(0, ids.indexOf(me));
    this.order = ids.slice(mine).concat(ids.slice(0, mine)); // you sit nearest the camera
    var n = Math.max(this.order.length, 1);
    this.setTableSize(Math.max(1.9, Math.min(3.8, 0.25 * n + 0.85)));
    var Rs = this.tableR + 0.72;
    this.order.forEach(function (id, i) {
      var s = self.seats[id], a = Math.PI / 2 + (i * 2 * Math.PI) / n;
      s.x = Rs * Math.cos(a); s.z = Rs * Math.sin(a);
      s.root.position.set(s.x, 0, s.z);
      s.root.scale.setScalar(1.2);
      s.root.rotation.y = Math.atan2(-s.x, -s.z);
    });
    // phase look
    var ph = view ? view.phase : 'lobby';
    var sceneKey = SCENE_OF[ph] || 'lobby';
    this.target = MOODS[sceneKey];
    this.setSky(this.target.sky);
    Object.keys(this.props).forEach(function (k) { self.props[k].visible = false; });
    if (ph === 'voting') this.props.voting.visible = true;
    else if (ph === 'defense' || ph === 'judgment' || ph === 'verdict') this.props.trial.visible = true;
    else if (ph === 'dawn' || ph === 'discussion') this.props.paper.visible = true;
    else if (ph === 'roles' || ph === 'lobby') this.props.roles.visible = true;
    this.accusedId = view && view.trial && (ph === 'defense' || ph === 'judgment') ? view.trial.accusedId : null;
    if (view && ph === 'verdict' && view.verdict && !view.verdict.noTrial && !view.verdict.executed) this.accusedId = null;
    // per-seat looks and tags
    players.forEach(function (p) { self.applySeat(self.seats[p.id], p, view); });
  };

  H.applySeat = function (s, p, view) {
    var me = view.me || {}, ph = view.phase, ui = this.ui;
    s.player = p;
    s.dead = !p.alive && ph !== 'lobby';
    s.asleep = ph === 'night' && p.alive && p.id !== me.id && !p.mafiaMate;
    s.body.visible = !s.dead;
    s.ghost.visible = s.dead;
    s.rose.visible = !!p.mafiaMate || (p.id === me.id && me.role && me.role.team === 'mafia');
    s.tape.visible = !!p.silenced;
    s.coatMat.color.setHex(p.connected || p.isBot ? s.look.coat : 0x3a3a3a);
    s.clickable = !!(ui.canClick && ui.canClick(p));
    s.mine = view.me && view.me.vote === p.id;
    s.selected = ui.selectedId === p.id;
    // tag text
    var votes = view.vote && view.vote.tally[p.id];
    var tag = s.dead ? (p.role ? p.role.name : (p.deathCause === 'lynch' ? 'Hanged' : 'Dead'))
      : p.mafiaMate && p.role ? p.role.name
      : p.id === me.id ? (me.role ? 'You · ' + me.role.name : 'You')
      : p.silenced ? 'Silenced'
      : !p.connected && !p.isBot ? 'Reconnecting…'
      : (ph === 'discussion' || ph === 'roles') && p.ready ? 'Ready'
      : p.isHost && ph === 'lobby' ? 'Host' : p.isBot && ph === 'lobby' ? 'Bot' : '';
    var el = s.tagEl;
    el.querySelector('.n3d-name').textContent = p.name;
    el.querySelector('.n3d-tag').textContent = tag;
    var v = el.querySelector('.n3d-votes'); v.hidden = !votes; v.textContent = votes ? votes + (votes === 1 ? ' vote' : ' votes') : '';
    el.className = 'n3d' + (p.id === me.id ? ' me' : '') + (s.dead ? ' dead' : '') + (s.clickable ? ' clickable' : '') + (s.selected ? ' selected' : '') +
      (s.mine ? ' voted' : '') + (p.id === this.accusedId ? ' accused' : '') + (p.role ? ' team-' + p.role.team : '') + (p.mafiaMate ? ' mate' : '');
    el.disabled = !s.clickable;
    el.setAttribute('aria-label', p.name + (tag ? ', ' + tag : '') + (votes ? ', ' + votes + ' votes' : ''));
  };

  H.setSky = function (kind) {
    if (this.skyKind === kind) return;
    this.skyKind = kind;
    var c = this.skyTex.image, g = c.getContext('2d');
    drawSky(g, c.width, c.height, kind);
    this.skyTex.needsUpdate = true;
  };

  // ───────────── input ─────────────
  H.pointerAt = function (e) {
    var r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  H.pick = function (click) {
    var meshes = [], self = this;
    Object.keys(this.seats).forEach(function (id) { meshes.push.apply(meshes, self.seats[id].pick); });
    this.raycaster.setFromCamera(this.pointer, this.camera);
    var hit = this.raycaster.intersectObjects(meshes, false).filter(function (h) { return h.object.visible || h.object.parent.visible; })[0];
    var id = hit ? hit.object.userData.pid : null;
    if (click) { if (id) this.clickSeat(id); return; }
    this.setHover(id);
  };
  H.setHover = function (id) {
    var s = id && this.seats[id];
    this.hover = s && s.clickable ? id : null;
    this.renderer.domElement.style.cursor = this.hover ? 'pointer' : '';
  };
  H.clickSeat = function (id) {
    var s = this.seats[id];
    if (s && s.clickable && this.ui.onPick) this.ui.onPick(s.player);
  };

  H.setInsets = function (ins) { this.insets = Object.assign({ top: 0, right: 0, bottom: 0, left: 0 }, ins); this.resize(); };

  H.resize = function () {
    var w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.w = w; this.h = h;
    var ins = this.insets;
    var fw = Math.max(200, w - ins.left - ins.right), fh = Math.max(200, h - ins.top - ins.bottom);
    this.camera.aspect = w / h;
    // Shift the optical centre into the part of the screen the HUD leaves free.
    this.camera.setViewOffset(w, h, (ins.right - ins.left) / 2, (ins.bottom - ins.top) / 2, w, h);
    this.camera.updateProjectionMatrix();
    this.freeAspect = fw / fh; this.freeH = fh / h;
  };

  // ───────────── animation ─────────────
  function lerp(a, b, t) { return a + (b - a) * t; }
  var tmpColor = null, tmpV = null; // created with the first hall (THREE may be absent)

  H.frame = function () {
    var dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime, k = 1 - Math.pow(0.02, dt);
    var m = this.mood, g = this.target;
    ['hemi', 'lamp', 'win', 'candle', 'exposure'].forEach(function (key) { m[key] = lerp(m[key], g[key], k); });
    this.hemi.intensity = m.hemi;
    this.hemi.color.lerp(tmpColor.setHex(g.hemiSky), k);
    this.lampLight.intensity = m.lamp * (1 + Math.sin(t * 7.3) * 0.01);
    this.lampLight.color.lerp(tmpColor.setHex(g.lampColor), k);
    this.bulb.material.color.copy(this.lampLight.color);
    this.winLight.intensity = m.win; this.winLight.color.lerp(tmpColor.setHex(g.winColor), k);
    this.scene.fog.color.lerp(tmpColor.setHex(g.fog), k);
    this.renderer.toneMappingExposure = m.exposure;
    var flick = 0.85 + Math.sin(t * 11) * 0.06 + Math.sin(t * 23.7) * 0.05;
    this.candleLight.intensity = m.candle * flick * 1.4;
    var fs = this.flames;
    for (var i = 0; i < fs.length; i++) { fs[i].scale.set(1, 0.85 + Math.sin(t * (9 + i * 3)) * 0.15, 1); fs[i].visible = m.candle > 0.2; }
    this.lamp.rotation.z = Math.sin(t * 0.6) * 0.02; this.lamp.rotation.x = Math.cos(t * 0.45) * 0.015;

    // camera: behind your seat, framed to fit the table in the free part of the screen
    var R = this.tableR + 1.25;
    var vfov = (this.camera.fov * Math.PI) / 180, tanV = Math.tan(vfov / 2) * this.freeH, tanH = tanV * this.freeAspect;
    // Tall (phone) screens look down from higher up and let the side seats touch the edges.
    var portrait = this.freeAspect < 0.9;
    var dist = portrait ? Math.max((R * 1.12) / tanH, (R * 1.05) / tanV) + 0.6 : Math.max(R / tanH, (R * 0.72) / tanV) + 1.1;
    var lobbyish = !this.view || this.view.phase === 'lobby' || this.view.phase === 'gameover';
    var az = lobbyish ? t * 0.06 : Math.sin(t * 0.07) * 0.06;
    var elev = portrait ? 0.95 : 0.5;
    this.lamp.visible = !portrait; // seen from overhead the shade would hide the table
    this.camera.position.set(Math.sin(az) * dist * Math.cos(elev), 0.6 + dist * Math.sin(elev), Math.cos(az) * dist * Math.cos(elev));
    this.camera.lookAt(0, 0.75, 0);

    // characters
    var accused = this.accusedId && this.seats[this.accusedId];
    if (accused) {
      this.spot.intensity = lerp(this.spot.intensity, 6, k);
      this.spot.target.position.set(accused.x, 1, accused.z);
      this.spot.position.set(accused.x * 0.4, 7, accused.z * 0.4 + 1.5);
    } else this.spot.intensity = lerp(this.spot.intensity, 0, k);
    var self = this, w2 = this.w / 2, h2 = this.h / 2;
    Object.keys(this.seats).forEach(function (id) {
      var s = self.seats[id];
      var breathe = Math.sin(t * 1.6 + s.bob) * 0.012;
      s.body.position.y = lerp(s.body.position.y, id === self.accusedId ? 0.3 : 0, k) + breathe * 0.2;
      s.body.scale.y = 1 + breathe;
      // heads: nod off at night, turn to watch the accused, glance around otherwise
      var tiltX = s.asleep ? 0.5 : -0.05, turnY = Math.sin(t * 0.3 + s.bob * 3) * 0.25;
      if (accused && accused !== s) {
        var dx = accused.x - s.x, dz = accused.z - s.z;
        turnY = Math.atan2(dx, dz) - s.root.rotation.y;
        while (turnY > Math.PI) turnY -= Math.PI * 2; while (turnY < -Math.PI) turnY += Math.PI * 2;
        turnY = Math.max(-1.1, Math.min(1.1, turnY));
      }
      s.headPivot.rotation.x = lerp(s.headPivot.rotation.x, tiltX, k);
      s.headPivot.rotation.y = lerp(s.headPivot.rotation.y, turnY, k * 0.6);
      var blink = s.asleep || (Math.sin(t * 0.9 + s.bob * 7) > 0.985) ? 0.15 : 1;
      s.eyes[0].scale.y = s.eyes[1].scale.y = blink;
      if (s.ghost.visible) s.ghost.position.y = 0.15 + Math.sin(t * 1.3 + s.bob) * 0.08;
      // highlight
      var glow = id === self.hover ? 0.18 : s.selected ? 0.12 : 0;
      s.coatMat.emissive.setRGB(glow, glow * 0.8, glow * 0.5);
      var ringOn = s.mine || s.selected || id === self.hover || id === self.accusedId;
      s.ring.material.color.setHex(s.mine || id === self.accusedId ? 0xe5484d : 0xe8b45a);
      s.ring.material.opacity = lerp(s.ring.material.opacity, ringOn ? 0.85 : 0, k);
      // project the name tag above the head
      tmpV.set(0, s.dead ? 2.0 : 1.82 + s.body.position.y, 0).applyMatrix4(s.root.matrixWorld).project(self.camera);
      var el = s.tagEl;
      if (tmpV.z > 1) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.transform = 'translate(-50%,-100%) translate(' + (tmpV.x * w2 + w2).toFixed(1) + 'px,' + (-tmpV.y * h2 + h2).toFixed(1) + 'px)';
      el.style.zIndex = String(Math.round((1 - tmpV.z) * 1000));
    });
    this.renderer.render(this.scene, this.camera);
  };

  // ───────────── floating feedback ─────────────
  H.react = function (id, emoji, fromName) {
    var s = this.seats[id]; if (!s) return;
    var f = document.createElement('span');
    f.className = 'n3d-float'; f.textContent = emoji;
    if (fromName) { var small = document.createElement('small'); small.textContent = fromName; f.appendChild(small); }
    s.tagEl.appendChild(f);
    setTimeout(function () { f.remove(); }, 1900);
  };
  H.say = function (id, text) {
    var s = this.seats[id]; if (!s) return;
    var b = s.tagEl.querySelector('.n3d-bubble');
    b.textContent = text.length > 70 ? text.slice(0, 68) + '…' : text;
    b.hidden = false;
    clearTimeout(s.sayT);
    s.sayT = setTimeout(function () { b.hidden = true; }, 4200);
  };

  H.destroy = function () {
    this.alive = false;
    global.cancelAnimationFrame(this.raf);
    global.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('pointermove', this.onMove);
    this.renderer.domElement.removeEventListener('click', this.onClick);
    this.renderer.dispose();
    this.el.innerHTML = '';
  };

  global.MafiaHall3D = { supported: supported, lookOf: lookOf, create: function (el) { return new Hall(el); } };
})(window);
