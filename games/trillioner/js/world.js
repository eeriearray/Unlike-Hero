/* Builds the surface city from the district tables: ground, roads, buildings, filler blocks, signs, landmarks, sky. */
(function () {
  var TR = window.TR = window.TR || {};
  var D = window.TRD.districts, Rng = window.TrillionerRng.Rng;
  var CHUNK = 120;

  var world = TR.world = {
    scene: null, surface: null, collide: null, hemi: null, sun: null, chunks: {}, buildingBoxes: {}, sky: 0x87ceeb,
    windowMat: null, neonMat: null, signMat: null, waterMat: null,

    init: function (scene) {
      world.scene = scene;
      world.collide = new TR.Collide();
      world.surface = new THREE.Group();
      scene.add(world.surface);
      world.solid = new THREE.MeshLambertMaterial({ vertexColors: true });
      world.windowMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffe9a0, emissiveIntensity: 0 });
      world.neonMat = new THREE.MeshBasicMaterial({ vertexColors: true });
      world.hemi = new THREE.HemisphereLight(0xffffff, 0x8a9a7a, 0.62);
      scene.add(world.hemi);
      world.sun = new THREE.DirectionalLight(0xfff4d8, 0.9);
      world.sun.castShadow = true;
      world.sun.shadow.mapSize.set(1536, 1536);
      var sc = world.sun.shadow.camera;
      sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 420;
      world.sun.shadow.bias = -0.0008;
      scene.add(world.sun, world.sun.target);
      scene.fog = new THREE.Fog(0x87ceeb, 150, 640);
      world.buildCity();
    },

    geo: function (x, z, layer) {
      var k = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK) + ':' + layer;
      return world.chunks[k] || (world.chunks[k] = new TR.Geo());
    },

    buildCity: function () {
      var ids = Object.keys(D.DISTRICTS);
      ids.forEach(function (id) { if (D.DISTRICTS[id].level !== 'under') world.buildGround(D.DISTRICTS[id]); });
      D.ROADS.forEach(world.buildRoad);
      world.signs = new TR.SignAtlas();
      ids.forEach(function (id) { var d = D.DISTRICTS[id]; if (d.level !== 'under') world.buildDistrict(d); });
      Object.keys(world.chunks).forEach(function (k) {
        var layer = k.split(':')[1], geo = world.chunks[k];
        var mesh = layer === 'solid' ? geo.mesh(world.solid, true, true) : layer === 'flat' ? geo.mesh(world.solid, false, true) : layer === 'window' ? geo.mesh(world.windowMat) : geo.mesh(world.neonMat);
        mesh.frustumCulled = true;
        mesh.geometry.computeBoundingSphere();
        world.surface.add(mesh);
      });
      world.surface.add(world.signs.mesh());
      // sea
      var sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), world.waterMat = new THREE.MeshLambertMaterial({ color: 0x2f9fe0, transparent: true, opacity: 0.88 }));
      sea.rotation.x = -Math.PI / 2; sea.position.y = -1.6;
      world.scene.add(sea);
      world.sea = sea;
    },

    buildGround: function (d) {
      var b = d.bounds, step = CHUNK;
      for (var x = b[0]; x < b[2]; x += step) for (var z = b[1]; z < b[3]; z += step) {
        var x1 = Math.min(x + step, b[2]), z1 = Math.min(z + step, b[3]);
        var g = world.geo((x + x1) / 2, (z + z1) / 2, 'flat');
        g.box((x + x1) / 2, -3, (z + z1) / 2, x1 - x, 3, z1 - z, d.ground);
      }
    },

    buildRoad: function (r) {
      for (var i = 0; i < r.pts.length - 1; i++) {
        var a = r.pts[i], b = r.pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(len / CHUNK);
        for (var s = 0; s < n; s++) {
          var t0 = s / n, t1 = (s + 1) / n, x0 = a[0] + (b[0] - a[0]) * t0, z0 = a[1] + (b[1] - a[1]) * t0, x1 = a[0] + (b[0] - a[0]) * t1, z1 = a[1] + (b[1] - a[1]) * t1;
          var g = world.geo((x0 + x1) / 2, (z0 + z1) / 2, 'flat');
          g.strip(x0, z0, x1, z1, r.w + 4, 0.02, 0xc9c9c2);
          g.strip(x0, z0, x1, z1, r.w, 0.04, 0x45474f);
          var segLen = len / n, dashes = Math.floor(segLen / 9), ux = (x1 - x0) / segLen, uz = (z1 - z0) / segLen;
          for (var k = 0; k < dashes; k++) {
            var px = x0 + ux * (k * 9 + 2), pz = z0 + uz * (k * 9 + 2);
            g.strip(px, pz, px + ux * 4, pz + uz * 4, 0.5, 0.06, 0xfff2b0);
          }
        }
      }
    },

    roadDist: function (x, z) {
      var best = 1e9;
      for (var r = 0; r < D.ROADS.length; r++) {
        var R = D.ROADS[r];
        for (var i = 0; i < R.pts.length - 1; i++) {
          var a = R.pts[i], b = R.pts[i + 1], vx = b[0] - a[0], vz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz)));
          var d = Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t) - R.w / 2;
          if (d < best) best = d;
        }
      }
      return best;
    },

    addBuilding: function (b, d, base) {
      var y = base || 0, g = world.geo(b.x, b.z, 'solid');
      var wall = b.wall != null ? b.wall : d.walls[0], roof = b.roof != null ? b.roof : d.roofs[0];
      g.box(b.x, y, b.z, b.w, b.h, b.d, wall);
      g.box(b.x, y + b.h, b.z, b.w + 1, 0.8, b.d + 1, roof);
      world.windows(b.x, y, b.z, b.w, b.h, b.d, b.boarded);
      var box = world.collide.addBox(b.x, y, b.z, b.w, b.h + 0.8, b.d, { building: b.id });
      world.buildingBoxes[b.id] = box;
    },

    windows: function (x, y, z, w, h, d, boarded) {
      var g = world.geo(x, z, 'window');
      var color = boarded ? 0x4a3b2c : 0x3f6e96;
      var rows = Math.max(1, Math.floor((h - 2) / 3.4));
      for (var r = 0; r < rows; r++) {
        var wy = y + 2 + r * 3.4;
        var nx = Math.floor(w / 4);
        for (var i = 0; i < nx; i++) {
          var wx = x - w / 2 + (i + 0.5) * (w / nx);
          g.box(wx, wy, z + d / 2, 2, 1.9, 0.14, color);
          g.box(wx, wy, z - d / 2, 2, 1.9, 0.14, color);
        }
        var nz = Math.floor(d / 4);
        for (i = 0; i < nz; i++) {
          var wz = z - d / 2 + (i + 0.5) * (d / nz);
          g.box(x + w / 2, wy, wz, 0.14, 1.9, 2, color);
          g.box(x - w / 2, wy, wz, 0.14, 1.9, 2, color);
        }
      }
    },

    buildDistrict: function (d) {
      var taken = [];
      (d.buildings || []).forEach(function (b) {
        if (!b.project) {
          world.addBuilding(b, d);
          world.door(b, d);
          world.signs.add(b.name, b, d);
        }
        taken.push([b.x - b.w / 2 - 6, b.z - b.d / 2 - 6, b.x + b.w / 2 + 6, b.z + b.d / 2 + 6]);
      });
      (d.stalls || []).forEach(function (s) {
        var c = s.cols || 6, sp = s.spacing || 6, w = (s.dir === 'z' ? 12 : c * sp + 4), dd = (s.dir === 'z' ? c * sp + 4 : 12);
        taken.push([s.x - (s.dir === 'z' ? 2 : w / 2), s.z - (s.dir === 'z' ? dd / 2 : 2), s.x + w, s.z + dd]);
      });
      if (d.change) taken.push([d.change.x - 14, d.change.z - 6, d.change.x + 14, d.change.z + 6]);
      (d.landmarks || []).forEach(function (l) { world.landmark(l, d); var r = (l.r || l.w / 2 || 10) + 6; taken.push([l.x - r, l.z - r, l.x + r, l.z + r]); });
      if (d.change) world.fountain(d);
      world.fill(d, taken);
    },

    door: function (b, d) {
      var f = TrillionerLayout.frontOf(b), g = world.geo(b.x, b.z, 'solid'), n = world.geo(b.x, b.z, 'neon');
      var dw = 5, dh = 4.4, dx = f.nx ? (f.x - f.nx * 5.5) : f.x, dz = f.nz ? (f.z - f.nz * 5.5) : f.z;
      var w = f.nz ? dw : 0.3, dd = f.nz ? 0.3 : dw;
      g.box(dx + f.nx * 0.2, 0, dz + f.nz * 0.2, w, dh, dd, b.enter ? 0x2b2b3f : 0x8a8a8a);
      if (b.enter) n.box(dx + f.nx * 0.3, dh, dz + f.nz * 0.3, f.nz ? dw + 1 : 0.3, 0.5, f.nz ? 0.3 : dw + 1, b.neon ? (d.neon || 0xffc53d) : 0xfff0c0);
      if (b.boarded) for (var i = 0; i < 3; i++) g.box(dx + f.nx * 0.4, 0.8 + i * 1.3, dz + f.nz * 0.4, f.nz ? dw + 1 : 0.2, 0.3, f.nz ? 0.2 : dw + 1, 0x8d6e4b);
    },

    landmark: function (l, d) {
      var g = world.geo(l.x, l.z, 'solid'), n = world.geo(l.x, l.z, 'neon');
      if (l.kind === 'chimney') {
        g.cyl(l.x, 0, l.z, l.r, l.h, 0x9c5a3c, 12, l.r * 0.62);
        for (var i = 1; i < 4; i++) g.cyl(l.x, l.h * i / 4, l.z, l.r * (1 - i * 0.1) + 0.4, 2.4, i % 2 ? 0xffffff : 0xd9352c, 12);
        g.cyl(l.x, l.h, l.z, l.r * 0.66, 2, 0x2a2a2a, 12);
        world.collide.add(l.x - l.r, 0, l.z - l.r, l.x + l.r, l.h, l.z + l.r, { landmark: 1 });
      } else if (l.kind === 'bigsign') {
        g.box(l.x - l.w / 2 + 3, 0, l.z, 1.4, l.h, 1.4, 0x444444);
        g.box(l.x + l.w / 2 - 3, 0, l.z, 1.4, l.h, 1.4, 0x444444);
        world.collide.addBox(l.x - l.w / 2 + 3, 0, l.z, 1.4, l.h, 1.4);
        world.collide.addBox(l.x + l.w / 2 - 3, 0, l.z, 1.4, l.h, 1.4);
        world.signs.addFlat(l.text, l.x, l.h - 3.5, l.z + 0.8, l.w, 8, d.neon || 0xffc53d, 0, true);
      }
    },

    fountain: function (d) {
      var c = d.change, g = world.geo(c.x, c.z, 'solid');
      g.cyl(c.x, 0, c.z - 7, 4.4, 0.9, 0xd8dde3, 12);
      g.cyl(c.x, 0.9, c.z - 7, 3.8, 0.1, 0x46b4f0, 12);
      g.cyl(c.x, 0.9, c.z - 7, 0.7, 2.6, 0xe9edf2, 8);
      world.collide.add(c.x - 3.6, 0, c.z - 10.6, c.x + 3.6, 0.9, c.z - 3.4, { fountain: d.id });
      world.fountains = world.fountains || [];
      world.fountains.push({ x: c.x, z: c.z - 7, district: d.id });
    },

    // Filler blocks: fixed for every seed. Gaps between them are the alleys.
    fill: function (d, taken) {
      var f = d.filler; if (!f) return;
      var rng = new Rng('fill:' + d.id), b = d.bounds, step = f.step;
      for (var x = b[0] + step / 2; x < b[2]; x += step) for (var z = b[1] + step / 2; z < b[3]; z += step) {
        var w = rng.range(step * 0.45, step * 0.72), dd = rng.range(step * 0.45, step * 0.72), h = rng.range(f.hMin, f.hMax);
        var px = x + rng.range(-3, 3), pz = z + rng.range(-3, 3);
        if (rng.next() < (f.gap || 0.2)) continue;
        if (px - w / 2 < b[0] + 4 || px + w / 2 > b[2] - 4 || pz - dd / 2 < b[1] + 4 || pz + dd / 2 > b[3] - 4) continue;
        if (world.roadDist(px, pz) < Math.max(w, dd) / 2 + 6) continue;
        var clash = false;
        for (var i = 0; i < taken.length; i++) { var t = taken[i]; if (px + w / 2 > t[0] && px - w / 2 < t[2] && pz + dd / 2 > t[1] && pz - dd / 2 < t[3]) { clash = true; break; } }
        if (clash || (d.isWater && d.isWater(px, pz))) continue;
        world.addBuilding({ id: null, x: px, z: pz, w: w, d: dd, h: h, wall: rng.pick(d.walls), roof: rng.pick(d.roofs) }, d);
      }
    },

    isWater: function (x, z) { return Math.abs(x) > 360 || Math.abs(z) > 360; },

    /** Sky, sun and window lights for an hour of the clock. */
    setTime: function (hour, weather, target) {
      var sunUp = Math.sin((hour - 6) / 12 * Math.PI);            // 1 at noon, -1 at midnight
      var day = Math.max(0, Math.min(1, sunUp * 3 + 0.35));
      var dusk = Math.max(0, 1 - Math.abs(sunUp) * 4) * (sunUp > -0.25 ? 1 : 0);
      var sky = new THREE.Color(0x10163a).lerp(new THREE.Color(0x7fd0ff), day).lerp(new THREE.Color(0xff9a5a), dusk * 0.6);
      var fogNear = 150, fogFar = 640;
      if (weather === 'fog') { sky.lerp(new THREE.Color(0xc4ccd4), 0.75); fogNear = 25; fogFar = 170; }
      if (weather === 'rain') { sky.lerp(new THREE.Color(0x6b7787), 0.6); fogNear = 90; fogFar = 420; }
      var q = TR.settings && TR.settings.drawDist ? TR.settings.drawDist : 1;
      world.scene.background = sky;
      world.scene.fog.color.copy(sky);
      world.scene.fog.near += (fogNear * q - world.scene.fog.near) * 0.03;
      world.scene.fog.far += (fogFar * q - world.scene.fog.far) * 0.03;
      world.hemi.intensity = 0.36 + day * 0.34;
      world.sun.intensity = 0.1 + day * 0.85;
      world.sun.color.setHex(dusk > 0.3 ? 0xffc48a : 0xfff4d8);
      world.windowMat.emissiveIntensity = (1 - day) * 0.95;
      var a = (hour - 6) / 12 * Math.PI;
      world.sun.position.set(target.x + Math.cos(a) * 140, 60 + Math.max(0.15, sunUp) * 150, target.z + 70);
      world.sun.target.position.set(target.x, 0, target.z);
    },

    update: function (dt, t) { if (world.sea) world.sea.position.y = -1.6 + Math.sin(t * 0.8) * 0.12; }
  };

  // All big signs share one texture atlas and one mesh.
  function SignAtlas() {
    this.size = 2048; this.cw = 512; this.ch = 96;
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.clearRect(0, 0, this.size, this.size);
    this.i = 0; this.p = []; this.uv = []; this.index = [];
  }
  SignAtlas.prototype.cell = function (text, color) {
    var cols = Math.floor(this.size / this.cw), col = this.i % cols, row = Math.floor(this.i / cols), x = col * this.cw, y = row * this.ch, c = this.ctx;
    this.i++;
    c.fillStyle = '#' + new THREE.Color(color).getHexString();
    c.fillRect(x + 2, y + 2, this.cw - 4, this.ch - 4);
    c.fillStyle = '#fff';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    var fs = 62; c.font = '900 ' + fs + 'px Arial Black, Arial, sans-serif';
    while (c.measureText(text).width > this.cw - 28 && fs > 20) { fs -= 2; c.font = '900 ' + fs + 'px Arial Black, Arial, sans-serif'; }
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 5; c.strokeText(text, x + this.cw / 2, y + this.ch / 2 + 2);
    c.fillText(text, x + this.cw / 2, y + this.ch / 2 + 2);
    var s = this.size;
    return { u0: (x + 2) / s, u1: (x + this.cw - 2) / s, v0: 1 - (y + this.ch - 2) / s, v1: 1 - (y + 2) / s };
  };
  /** A sign quad facing +z (rot 0), rotated about y. Double sided via the material. */
  SignAtlas.prototype.addFlat = function (text, x, y, z, w, h, color, rot, both) {
    var uv = this.cell(text, color), cos = Math.cos(rot || 0), sin = Math.sin(rot || 0), n = this.p.length / 3;
    var hw = w / 2, hh = h / 2;
    [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(function (c, i) {
      this.p.push(x + c[0] * cos, y + c[1], z - c[0] * sin);
      this.uv.push(i === 0 || i === 3 ? uv.u0 : uv.u1, i < 2 ? uv.v0 : uv.v1);
    }, this);
    this.index.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  SignAtlas.prototype.add = function (name, b, d) {
    var color = b.boarded ? 0x5b4a3a : (d.neon || 0xffc53d), f = TrillionerLayout.frontOf(b), w = Math.min(b.w * 0.9, 34), h = w * 0.19;
    if (f.nz) this.addFlat(name, b.x, b.h - h * 0.6, b.z + f.nz * (b.d / 2 + 0.3), w, h, color, f.nz > 0 ? 0 : Math.PI);
    else { w = Math.min(b.d * 0.9, 34); h = w * 0.19; this.addFlat(name, b.x + f.nx * (b.w / 2 + 0.3), b.h - h * 0.6, b.z, w, h, color, f.nx > 0 ? Math.PI / 2 : -Math.PI / 2); }
  };
  SignAtlas.prototype.mesh = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.index);
    var tex = new THREE.CanvasTexture(this.canvas);
    tex.anisotropy = 4;
    var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }));
    m.frustumCulled = false;
    return m;
  };
  TR.SignAtlas = SignAtlas;
})();
