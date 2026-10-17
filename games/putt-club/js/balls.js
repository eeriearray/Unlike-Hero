/* Putt Club — ball visuals: colour + symbol skin, rolling, contact shadow, and the look of every effect
 * (turbo trail, sticky honey, ghost, giant/tiny squash, frost shell, shield bubble, magnet aura, mirror ring). */
(function (global) {
  'use strict';
  var PC = global.PC, THREE = global.THREE, Phys = global.PuttPhysics, Match = global.PuttMatch;
  var R = Phys.C.R;
  var skins = {};

  function skin(colorIdx) {
    if (skins[colorIdx]) return skins[colorIdx];
    var c = document.createElement('canvas'); c.width = 256; c.height = 128;
    var g = c.getContext('2d'), col = Match.COLORS[colorIdx];
    g.fillStyle = col; g.fillRect(0, 0, 256, 128);
    // Soft band and the player's symbol, twice around the ball.
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(0, 54, 256, 20);
    var sym = Match.SYMBOLS[colorIdx], path = PC.icons.SYMBOL[sym];
    var light = colorIdx === 7;
    [64, 192].forEach(function (x) {
      g.save(); g.translate(x - 24, 40); g.scale(2, 2);
      var p = path.match(/d="([^"]+)"/);
      g.fillStyle = light ? '#26313f' : '#fbf6ea';
      if (p) g.fill(new Path2D(p[1]));
      else if (sym === 'circle') { g.beginPath(); g.arc(12, 12, 6, 0, 7); g.fill(); }
      else if (sym === 'square') { g.fillRect(6.2, 6.2, 11.6, 11.6); }
      g.restore();
    });
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    skins[colorIdx] = t;
    return t;
  }

  var sphereGeo = null, shellGeo = null, bubbleGeo = null, ringGeo = null, blobGeo = null;
  function geos() {
    if (sphereGeo) return;
    sphereGeo = new THREE.SphereGeometry(1, 32, 20);
    shellGeo = new THREE.IcosahedronGeometry(1, 1);
    bubbleGeo = new THREE.SphereGeometry(1, 28, 16);
    ringGeo = new THREE.TorusGeometry(1, 0.06, 6, 40);
    blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
  }

  var bubbleMat = null;
  function bubbleMaterial() {
    if (bubbleMat) return bubbleMat;
    bubbleMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color('#7cc8ff') } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; uniform float time; void main(){ vec3 p = position * (1.0 + 0.04*sin(time*4.0 + position.y*6.0)); vec4 mv = modelViewMatrix * vec4(p,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; uniform vec3 color; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(color * (0.25 + f*1.4), 0.15 + f*0.7); }'
    });
    return bubbleMat;
  }

  function BallView(scene, player, isMe, kit) {
    geos();
    this.id = player.id; this.isMe = isMe; this.color = player.color;
    this.root = new THREE.Group(); scene.add(this.root);
    this.mat = new THREE.MeshStandardMaterial({ map: skin(player.color), roughness: 0.32, metalness: 0.02, bumpMap: PC.tex.dimples(), bumpScale: 0.05, transparent: true, emissive: new THREE.Color('#000000') });
    this.mesh = new THREE.Mesh(sphereGeo, this.mat); this.mesh.castShadow = true;
    this.spin = new THREE.Group(); this.spin.add(this.mesh); this.root.add(this.spin);
    this.shadow = new THREE.Mesh(blobGeo, kit.blob); this.shadow.renderOrder = 3; scene.add(this.shadow);
    // Own-ball ground ring so you always find yourself.
    if (isMe) {
      this.ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.12, 40), new THREE.MeshBasicMaterial({ color: Match.COLORS[player.color], transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
      this.ring.rotation.x = -Math.PI / 2; this.ring.renderOrder = 4; scene.add(this.ring);
    }
    // Effect layers (hidden until needed).
    this.frost = new THREE.Mesh(shellGeo, new THREE.MeshStandardMaterial({ color: '#bfeaff', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.7, flatShading: true, emissive: '#3a8fb8', emissiveIntensity: 0.4 }));
    this.frost.visible = false; this.root.add(this.frost);
    this.bubble = new THREE.Mesh(bubbleGeo, bubbleMaterial()); this.bubble.visible = false; this.root.add(this.bubble);
    this.aura = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ff5d6c', transparent: true, opacity: 0.8, toneMapped: false }));
    this.aura.rotation.x = Math.PI / 2; this.aura.visible = false; this.root.add(this.aura);
    this.mirror = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#d85db0', transparent: true, opacity: 0.85, toneMapped: false }));
    this.mirror.visible = false; this.root.add(this.mirror);
    this.honey = new THREE.Group();
    for (var i = 0; i < 4; i++) { var d = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: '#f2b630', roughness: 0.15, transparent: true, opacity: 0.85 })); d.position.set(Math.cos(i * 1.7) * 0.85, Math.sin(i * 2.3) * 0.5, Math.sin(i * 1.7) * 0.85); this.honey.add(d); }
    this.honey.visible = false; this.root.add(this.honey);
    // Trail ribbon.
    this.trailN = 26;
    this.trailPts = [];
    var tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(this.trailN * 2 * 3), 3));
    tg.setAttribute('alpha', new THREE.Float32BufferAttribute(new Float32Array(this.trailN * 2), 1));
    var idx = []; for (var k = 0; k < this.trailN - 1; k++) { var a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    tg.setIndex(idx);
    this.trailMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { color: { value: new THREE.Color('#ff7a3d') } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 color; varying float vA; void main(){ gl_FragColor = vec4(color, vA); }'
    });
    this.trail = new THREE.Mesh(tg, this.trailMat); this.trail.frustumCulled = false; this.trail.visible = false; scene.add(this.trail);

    this.pos = new THREE.Vector3(); this.prev = null; this.r = R; this.squash = 0; this.lastR = R;
    this.holedAt = 0; this.sink = 0; this.visible = true; this.effects = {}; this.vel = { x: 0, z: 0 }; this.sinkVel = { x: 0, z: 0 };
    this.quat = new THREE.Quaternion();
  }

  var tmpAxis = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

  /** state: { x, y, z, r, flags }, effects: { kind: true }, ctx: { t, dt, camera, cup, floorY } */
  BallView.prototype.update = function (s, effects, ctx) {
    var dt = ctx.dt;
    this.effects = effects;
    var holed = !!(s.flags & 2);
    if (holed && !this.holedAt) {
      this.holedAt = ctx.t; this.sinkFrom = this.pos.clone();
      // Keep the speed it arrived with (capped), so it carries on into the hole instead of stopping on the lip.
      var vl = Math.hypot(this.vel.x, this.vel.z), cap = vl > 5 ? 5 / vl : 1;
      this.sinkVel = { x: this.vel.x * cap, z: this.vel.z * cap };
    }
    if (!holed) { this.holedAt = 0; this.sink = 0; }
    var x = s.x, y = s.y, z = s.z;
    if (this.holedAt) {
      // Drop into the cup: it carries on along its line, curls toward the centre against the far wall,
      // and falls under gravity.
      var st = ctx.t - this.holedAt, T = 0.42, k = PC.clamp(st / T, 0, 1);
      var carry = 0.07 * (1 - Math.exp(-st / 0.07));
      var cx = this.sinkFrom.x + this.sinkVel.x * carry, cz = this.sinkFrom.z + this.sinkVel.z * carry;
      var c = PC.clamp(st / 0.26, 0, 1), pull = c * c * (3 - 2 * c);
      x = PC.lerp(cx, ctx.cup.x, pull); z = PC.lerp(cz, ctx.cup.z, pull);
      var fall = Math.min(0.5, 0.5 * 22 * Math.max(0, st - 0.03) * Math.max(0, st - 0.03));
      y = ctx.cup.y - fall;
      this.sink = k;
    }
    // Rolling: rotate by distance travelled.
    if (this.prev) {
      var dx = x - this.prev.x, dz = z - this.prev.z, d = Math.hypot(dx, dz);
      if (d > 1e-5 && d < 2) {
        tmpAxis.set(dz, 0, -dx).normalize();
        tmpQ.setFromAxisAngle(tmpAxis, d / Math.max(0.05, s.r));
        this.spin.quaternion.premultiply(tmpQ);
      }
      this.speed = d / Math.max(dt, 1e-3);
      if (!this.holedAt) { var a = Math.min(1, dt * 20); this.vel.x += (dx / Math.max(dt, 1e-3) - this.vel.x) * a; this.vel.z += (dz / Math.max(dt, 1e-3) - this.vel.z) * a; }
    } else this.speed = 0;
    this.prev = { x: x, z: z };
    // Squash and stretch when the size changes.
    if (Math.abs(s.r - this.lastR) > 0.002) this.squash = 1;
    this.lastR = s.r;
    this.squash = Math.max(0, this.squash - dt * 2.2);
    var wob = Math.sin(this.squash * 14) * this.squash * 0.18;
    this.r = s.r;
    this.pos.set(x, y + s.r, z);
    this.root.position.copy(this.pos);
    this.spin.scale.set(s.r * (1 + wob), s.r * (1 - wob), s.r * (1 + wob));
    var vis = !(this.holedAt && this.sink >= 1);
    this.root.visible = vis;
    // Contact shadow on the floor under the ball (fades with height).
    var fy = ctx.floorY(x, z, y);
    if (fy == null || this.holedAt) this.shadow.visible = false;
    else {
      var hgt = Math.max(0, y - fy);
      this.shadow.visible = true;
      this.shadow.position.set(x, fy + 0.008, z);
      var sc = s.r * 3.2 * (1 + hgt * 0.6);
      this.shadow.scale.set(sc, 1, sc);
      this.shadow.material.opacity = 0.55;
    }
    if (this.ring) {
      this.ring.visible = vis && !(s.flags & 1) && !this.holedAt && fy != null;
      if (this.ring.visible) { this.ring.position.set(x, fy + 0.01, z); var rs = s.r * (1.35 + Math.sin(ctx.t * 3) * 0.08); this.ring.scale.set(rs, rs, rs); }
    }
    // Effects.
    var ghost = effects.ghostLive || !!(s.flags & 8);
    this.mat.opacity = ghost ? 0.45 : 1;
    this.mat.depthWrite = !ghost;
    this.mat.emissive.set(effects.sticky ? '#5a3a00' : effects.turbo ? '#4a1a00' : '#000000');
    this.frost.visible = !!(s.flags & 4);
    if (this.frost.visible) { this.frost.scale.setScalar(s.r * 1.35); this.frost.rotation.y += dt * 0.3; }
    this.bubble.visible = !!effects.shield;
    if (this.bubble.visible) { this.bubble.scale.setScalar(s.r * 2.1); bubbleMat.uniforms.time.value = ctx.t; }
    this.aura.visible = !!effects.magnet;
    if (this.aura.visible) { var as = s.r * (1.6 + 0.2 * Math.sin(ctx.t * 6)); this.aura.scale.setScalar(as); this.aura.material.opacity = 0.5 + 0.3 * Math.sin(ctx.t * 6); }
    this.mirror.visible = !!effects.reverse;
    if (this.mirror.visible) { this.mirror.position.y = s.r * 2.2; this.mirror.scale.setScalar(s.r * 0.9); this.mirror.rotation.x = Math.PI / 2; this.mirror.rotation.z = ctx.t * 3; }
    this.honey.visible = !!effects.sticky;
    if (this.honey.visible) this.honey.scale.setScalar(s.r * 1.05);
    // Turbo trail (and a faint one for ghost shots).
    var trailOn = (effects.turboLive || ghost) && (s.flags & 1);
    if (trailOn) {
      this.trailPts.unshift(this.pos.clone());
      if (this.trailPts.length > this.trailN) this.trailPts.length = this.trailN;
    } else if (this.trailPts.length) this.trailPts.pop();
    this.trail.visible = this.trailPts.length > 1;
    if (this.trail.visible) {
      this.trailMat.uniforms.color.value.set(ghost && !effects.turboLive ? '#b9c7ff' : '#ff7a3d');
      var pos = this.trail.geometry.attributes.position.array, al = this.trail.geometry.attributes.alpha.array;
      var camDir = new THREE.Vector3().subVectors(ctx.camera.position, this.pos).normalize();
      for (var i = 0; i < this.trailN; i++) {
        var p = this.trailPts[Math.min(i, this.trailPts.length - 1)], q = this.trailPts[Math.min(i + 1, this.trailPts.length - 1)];
        var dir = new THREE.Vector3().subVectors(p, q); if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0);
        var side = new THREE.Vector3().crossVectors(dir, camDir).normalize().multiplyScalar(s.r * 0.9 * (1 - i / this.trailN));
        pos[i * 6] = p.x + side.x; pos[i * 6 + 1] = p.y + side.y; pos[i * 6 + 2] = p.z + side.z;
        pos[i * 6 + 3] = p.x - side.x; pos[i * 6 + 4] = p.y - side.y; pos[i * 6 + 5] = p.z - side.z;
        var a = (1 - i / this.trailN) * 0.75 * (i < this.trailPts.length ? 1 : 0);
        al[i * 2] = a; al[i * 2 + 1] = a;
      }
      this.trail.geometry.attributes.position.needsUpdate = true; this.trail.geometry.attributes.alpha.needsUpdate = true;
    }
  };

  BallView.prototype.dispose = function (scene) {
    scene.remove(this.root); scene.remove(this.shadow); scene.remove(this.trail);
    if (this.ring) { scene.remove(this.ring); this.ring.geometry.dispose(); this.ring.material.dispose(); }
    this.mat.dispose(); this.frost.material.dispose(); this.trail.geometry.dispose(); this.trailMat.dispose();
    this.honey.children.forEach(function (c) { c.geometry.dispose(); c.material.dispose(); });
  };

  PC.BallView = BallView;
})(window);
