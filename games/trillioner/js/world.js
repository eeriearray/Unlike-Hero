/* Builds the city from the district tables: ground, roads, buildings, filler blocks, signs, landmarks, sky, Under City. */
(function () {
  var TR = window.TR = window.TR || {};
  var D = window.TRD.districts, Rng = window.TrillionerRng.Rng;
  var CHUNK = 120, UY = D.UNDER_Y;

  // Ground art by district: tile size and the colours the tiles are drawn from.
  var GROUND = {
    downtown: { size: 6, colors: [0xefe6cc, 0xe8dcbc, 0xf3ecd8, 0xe3d6b2], inlay: 0xd9b45a },
    luxury: { size: 8, colors: [0xfbdde6, 0xf7cfdb, 0xfdeaf0, 0xf5c5d4], check: 1 },
    suburbs: { size: 10, colors: [0x7fd05c, 0x76c854, 0x88d864, 0x6fc04e], grass: 1 },
    industrial: { size: 12, colors: [0xa8abad, 0x9ea1a4, 0xb0b3b4, 0x97999c], stain: 1 },
    harbour: { size: 7, colors: [0xdcc9a0, 0xd3bf94, 0xe3d2ac, 0xcbb688] },
    airport: { size: 14, colors: [0xb4c0c8, 0xaab7c0, 0xbcc7ce, 0xa3b0b9] },
    oldtown: { size: 5, colors: [0xcf9a6e, 0xc48c60, 0xd8a67c, 0xba8256], check: 0 },
    under: { size: 10, colors: [0x4c3388, 0x553a95, 0x46307e, 0x5c40a0] }
  };
  var SKY = [ // hour, top, horizon, sun colour, sun, ambient, window glow
    [0, 0x05070f, 0x161a2a, 0x8fa0c8, 0.26, 0.4, 1],
    [4.8, 0x070a16, 0x1c2030, 0x8fa0c8, 0.26, 0.4, 1],
    [6, 0x5a7ea8, 0xe8c9a0, 0xffd9ae, 1.0, 0.46, 0.35],
    [8, 0x4f7fb4, 0xcfd6d4, 0xfff0d8, 1.32, 0.48, 0],
    [16, 0x4f7fb4, 0xcfd6d4, 0xfff0d8, 1.32, 0.48, 0],
    [18, 0x51688e, 0xe6a878, 0xffb070, 1.05, 0.44, 0.3],
    [19.4, 0x1e2440, 0xc4664c, 0xff8050, 0.5, 0.34, 0.8],
    [21, 0x05070f, 0x161a2a, 0x8fa0c8, 0.26, 0.4, 1],
    [24, 0x05070f, 0x161a2a, 0x8fa0c8, 0.26, 0.4, 1]
  ].map(function (k) { return { h: k[0], top: new THREE.Color(k[1]), hor: new THREE.Color(k[2]), sun: new THREE.Color(k[3]), si: k[4], am: k[5], glow: k[6] }; });

  var shadeC = new THREE.Color();
  /** A lighter or darker version of a hex colour. */
  function shade(hex, k) {
    var r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
    return (Math.min(255, Math.round(r * k)) << 16) | (Math.min(255, Math.round(g * k)) << 8) | Math.min(255, Math.round(b * k));
  }

  var world = TR.world = {
    scene: null, surface: null, under: null, collide: null, hemi: null, sun: null, chunks: {}, meshes: {}, ranges: {}, gone: {}, rails: [], buildingBoxes: {}, runLayer: null,
    windowMat: null, neonMat: null, waterMat: null, space: 'surface', fountains: [], screens: [], clockFaces: [], spinners: [], props: [],

    init: function (scene) {
      world.scene = scene;
      world.buildSky(scene);
      world.collide = new TR.Collide();
      world.surface = new THREE.Group();
      world.under = new THREE.Group();
      world.under.visible = false;
      scene.add(world.surface, world.under);
      world.solid = TR.surfaceDetail(new THREE.MeshLambertMaterial({ vertexColors: true }));
      // Only some panes light up at night: panes drawn in the lighter colour are the lit ones.
      world.windowMat = TR.glassDetail(new THREE.MeshPhongMaterial({ vertexColors: true, emissive: 0xffd98a, emissiveIntensity: 0, specular: 0xffffff, shininess: 120 }), world.skyU.hor);
      world.neonMat = new THREE.MeshBasicMaterial({ vertexColors: true });
      world.hemi = new THREE.HemisphereLight(0xdcefff, 0xb7a58c, 0.6);
      scene.add(world.hemi);
      world.sun = new THREE.DirectionalLight(0xfff4d8, 1);
      world.sun.castShadow = true;
      world.sun.shadow.mapSize.set(2048, 2048);
      var sc = world.sun.shadow.camera;
      sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -95; sc.near = 10; sc.far = 460;
      world.sun.shadow.bias = -0.0004;
      world.sun.shadow.normalBias = 0.5;
      scene.add(world.sun, world.sun.target);
      scene.fog = new THREE.Fog(0xc4eaff, 200, 760);
      world.buildCity();
    },

    geo: function (x, z, layer, under) {
      var k = (under ? 'u' : 's') + Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK) + ':' + layer;
      return world.chunks[k] || (world.chunks[k] = new TR.Geo());
    },

    buildCity: function () {
      var ids = Object.keys(D.DISTRICTS);
      world.walk = new TR.Geo(); world.road = new TR.Geo(); world.paint = new TR.Geo();
      world.aoP = []; world.aoC = [];
      ids.forEach(function (id) { if (D.DISTRICTS[id].level !== 'under') world.buildGround(D.DISTRICTS[id]); });
      D.ROADS.forEach(world.buildRoad);
      world.signs = new TR.SignAtlas();
      world.usigns = new TR.SignAtlas();
      ids.forEach(function (id) { var d = D.DISTRICTS[id]; if (d.level === 'under') world.buildUnder(d); else world.buildDistrict(d); });
      world.buildRails();
      TR.street.build();
      TR.vehicles.scene = world.scene;
      TR.vehicles.buildRail();
      Object.keys(world.chunks).forEach(function (k) {
        var layer = k.split(':')[1], geo = world.chunks[k], under = k.charAt(0) === 'u';
        var mesh = layer === 'solid' ? geo.mesh(world.solid, true, true) : layer === 'flat' ? geo.mesh(world.solid, false, true) : layer === 'window' ? geo.mesh(world.windowMat) : geo.mesh(world.neonMat);
        mesh.geometry.computeBoundingSphere();
        world.meshes[k] = mesh;
        (under ? world.under : world.surface).add(mesh);
      });
      world.surface.add(world.signs.mesh());
      world.under.add(world.usigns.mesh());
      world.buildDecals();
      world.buildClouds();
      world.buildSea();
      world.animated();
    },

    // Pavements, roads and paint are one decal layer drawn over the ground, in order, so they never fight each other.
    buildDecals: function () {
      var all = new TR.Geo();
      [world.walk, world.road, world.paint].forEach(function (g) { all.p = all.p.concat(g.p); all.n = all.n.concat(g.n); all.c = all.c.concat(g.c); });
      var mat = TR.surfaceDetail(new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, depthWrite: false }));
      var m = all.mesh(mat, false, true);
      m.frustumCulled = false; m.renderOrder = 1;
      world.surface.add(m);
      // soft contact shadows at the foot of every building
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(world.aoP, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(world.aoC, 4));
      var ao = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, fog: false }));
      ao.frustumCulled = false; ao.renderOrder = 2;
      world.surface.add(ao);
    },
    /** A dark soft ring on the ground around a box. */
    aoRing: function (x0, z0, x1, z1, r, strength) {
      var P = world.aoP, C2 = world.aoC, a = strength == null ? 0.38 : strength, y = 0.03;
      function q(ax, az, bx, bz, cx, cz, dx, dz) { // a,b inner edge; c,d outer edge
        P.push(ax, y, az, bx, y, bz, cx, y, cz, ax, y, az, cx, y, cz, dx, y, dz);
        C2.push(0, 0, 0, a, 0, 0, 0, a, 0, 0, 0, 0, 0, 0, 0, a, 0, 0, 0, 0, 0, 0, 0, 0);
      }
      q(x0, z1, x1, z1, x1 + r, z1 + r, x0 - r, z1 + r); q(x1, z1, x1, z0, x1 + r, z0 - r, x1 + r, z1 + r);
      q(x1, z0, x0, z0, x0 - r, z0 - r, x1 + r, z0 - r); q(x0, z0, x0, z1, x0 - r, z1 + r, x0 - r, z0 - r);
    },

    // The sky: a gradient dome with sun, moon and stars that follows the camera.
    buildSky: function (scene) {
      world.skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, night: { value: 0 } };
      var mat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: world.skyU,
        vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vD; uniform vec3 top,hor,sunCol,sunDir; uniform float night;' +
          'float h(vec3 p){ return fract(sin(dot(floor(p),vec3(12.98,78.23,37.72)))*43758.55); }' +
          'void main(){ vec3 d=normalize(vD); float t=pow(clamp(d.y,0.0,1.0),0.55); vec3 c=mix(hor,top,t); float s=max(dot(d,sunDir),0.0);' +
          'c+=sunCol*(pow(s,6.0)*0.22+pow(s,60.0)*0.5+smoothstep(0.9985,0.9992,s)*3.0);' +
          'float st=h(d*180.0); c+=vec3(1.0)*night*step(0.9975,st)*clamp(d.y*4.0,0.0,1.0);' +
          'gl_FragColor=vec4(c,1.0);\n#include <encodings_fragment>\n}'
      });
      world.sky = new THREE.Mesh(new THREE.SphereGeometry(100, 24, 16), mat);
      world.sky.frustumCulled = false; world.sky.renderOrder = -10;
      scene.add(world.sky);
    },
    // Fluffy blocky clouds, one mesh.
    buildClouds: function () {
      var rng = new Rng('clouds'), g = new TR.Geo();
      for (var i = 0; i < 34; i++) {
        var x = rng.range(-720, 720), z = rng.range(-720, 720), y = rng.range(150, 225), n = 3 + rng.int(4), base = rng.range(16, 34);
        for (var k = 0; k < n; k++) {
          var w = base * rng.range(0.5, 0.95), d = base * rng.range(0.4, 0.7), h = base * rng.range(0.26, 0.46);
          g.blob(x + (k / Math.max(1, n - 1) - 0.5) * base * 2.2, y + rng.range(-1, 4), z + rng.range(-base, base) * 0.35, w, h, d, 0xffffff);
        }
      }
      world.cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0.28 });
      world.clouds = g.mesh(world.cloudMat, false, false);
      world.clouds.matrixAutoUpdate = true; world.clouds.frustumCulled = false;
      world.surface.add(world.clouds);
    },
    // Water with a moving ripple texture and a sparkle.
    buildSea: function () {
      var c = document.createElement('canvas'); c.width = c.height = 256;
      var x = c.getContext('2d'), rng = new Rng('water');
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
      for (var i = 0; i < 520; i++) {
        var px = rng.range(0, 256), py = rng.range(0, 256), l = rng.range(10, 44);
        x.strokeStyle = rng.next() < 0.5 ? 'rgba(255,255,255,.9)' : 'rgba(150,205,240,.75)';
        x.lineWidth = rng.range(1, 3);
        x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + l / 2, py + rng.range(-3, 3), px + l, py); x.stroke();
      }
      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(110, 110); tex.anisotropy = 4; tex.encoding = THREE.sRGBEncoding;
      world.waterTex = tex;
      var mat = world.waterMat = new THREE.MeshPhongMaterial({ color: 0x2aa6e8, map: tex, specular: 0xbfe8ff, shininess: 90, transparent: true, opacity: 0.86 });
      var sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), mat);
      sea.rotation.x = -Math.PI / 2; sea.position.y = -1.6; sea.renderOrder = 3;
      world.surface.add(sea);
      world.sea = sea;
      var bed = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x175a7e }));
      bed.rotation.x = -Math.PI / 2; bed.position.y = world.SEABED;
      world.surface.add(bed);
      // foam where the sea meets the land
      var fg = new TR.Geo(), edges = [[-360, -360, 360, -360], [360, -360, 360, 120], [306, 120, 360, 120], [306, 120, 306, 282], [120, 282, 306, 282], [120, 282, 120, 360], [-360, 360, 120, 360], [-360, -360, -360, 360]];
      edges.forEach(function (e) { fg.strip(e[0], e[1], e[2], e[3], 2.4, -1.42, 0xe8f7ff); });
      world.foam = fg.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 }));
      world.foam.renderOrder = 4; world.foam.frustumCulled = false;
      world.surface.add(world.foam);
    },

    SEABED: -24,

    // Grind rails for the hoverboard, in open ground: never across a road, a pavement or a doorway.
    RAILS: [[[14, -15], [40, -15]], [[-30, 36], [10, 36]], [[-110, 256], [-50, 256]], [[132, 14], [160, 14]], [[-280, 104], [-250, 104]], [[128, 214], [168, 214]], [[60, -140], [96, -140]]],
    buildRails: function () {
      world.RAILS.forEach(function (r) {
        // a solid rail across a road would stop every car on it
        for (var t = 0; t <= 1; t += 0.05) if (world.roadDist(r[0][0] + (r[1][0] - r[0][0]) * t, r[0][1] + (r[1][1] - r[0][1]) * t) < 0.5) return;
        var a = r[0], b = r[1], y = 1.6, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, l = Math.hypot(b[0] - a[0], b[1] - a[1]), g = world.geo(mx, mz, 'solid');
        g.rbox(mx, y - 0.14, mz, Math.abs(b[0] - a[0]) + 0.3, 0.26, Math.abs(b[1] - a[1]) + 0.3, 0xdfe4ea, 0.1, 0.1, 1);
        var n = Math.max(2, Math.round(l / 6));
        for (var i = 0; i <= n; i++) { var px = a[0] + (b[0] - a[0]) * i / n, pz = a[1] + (b[1] - a[1]) * i / n; g.cyl(px, 0, pz, 0.14, y - 0.1, 0x666a70, 8).cyl(px, 0, pz, 0.32, 0.1, 0x555960, 8); }
        // solid to anyone on the ground; jump or ride up onto it
        world.collide.add(Math.min(a[0], b[0]) - 0.2, 0, Math.min(a[1], b[1]) - 0.2, Math.max(a[0], b[0]) + 0.2, y + 0.1, Math.max(a[1], b[1]) + 0.2, { rail: 1 });
        world.rails.push({ a: a, b: b, y: y, l: l });
      });
    },

    buildGround: function (d) {
      var b = d.land || d.bounds, art = GROUND[d.id], S = art.size, rng = new Rng('ground:' + d.id);
      for (var x = b[0]; x < b[2]; x += S) for (var z = b[1]; z < b[3]; z += S) {
        var x1 = Math.min(x + S, b[2]), z1 = Math.min(z + S, b[3]), cx = (x + x1) / 2, cz = (z + z1) / 2, c = rng.pick(art.colors);
        if (art.check) c = art.colors[(Math.floor((x - b[0]) / S) + Math.floor((z - b[1]) / S)) % 2 ? 0 : 2];
        if (art.inlay && Math.floor((x - b[0]) / S) % 6 === 0 && Math.floor((z - b[1]) / S) % 6 === 0) c = art.inlay;
        if (art.stain && rng.next() < 0.04) c = 0x7f8285;
        world.geo(cx, cz, 'flat').tile(x, z, x1, z1, 0, c);
      }
      // skirt so the land has a side at the water
      var g = world.geo((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 'flat');
      g.box((b[0] + b[2]) / 2, -30, (b[1] + b[3]) / 2, b[2] - b[0], 29.98, b[3] - b[1], 0xb9a57e);
    },

    buildRoad: function (r, ri) {
      var walk = world.walk, road = world.road, paint = world.paint, Y = 0.02;
      for (var i = 0; i < r.pts.length - 1; i++) {
        var a = r.pts[i], b = r.pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, px = -uz, pz = ux;
        walk.strip(a[0], a[1], b[0], b[1], r.w + 6, Y, 0xd8d4c9);
        walk.strip(a[0], a[1], b[0], b[1], r.w + 1, Y, 0x9a988f);
        road.strip(a[0], a[1], b[0], b[1], r.w, Y, 0x303236);
        var STEP = 3, wasCross = false, kerbStart = null, K = world.geo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 'flat');
        for (var s = 0; s < len; s += STEP) {
          var x = a[0] + ux * (s + STEP / 2), z = a[1] + uz * (s + STEP / 2), cross = world.crossing(x, z, ri);
          var x0 = a[0] + ux * s, z0 = a[1] + uz * s, x1 = x0 + ux * STEP, z1 = z0 + uz * STEP, off = r.w / 2 - 0.55;
          if (!cross) {
            paint.strip(x0 + px * off, z0 + pz * off, x1 + px * off, z1 + pz * off, 0.28, Y, 0xf2f2ea);
            paint.strip(x0 - px * off, z0 - pz * off, x1 - px * off, z1 - pz * off, 0.28, Y, 0xf2f2ea);
            if (Math.floor(s / STEP) % 3 === 0) paint.strip(x0, z0, x0 + ux * 3.4, z0 + uz * 3.4, 0.36, Y, 0xffd24a);
          }
          if (cross !== wasCross && s > 0) { // zebra crossing where the road meets a junction
            var back = cross ? -2.6 : 2.6, zx = x0 + ux * back, zz = z0 + uz * back;
            for (var k = -r.w / 2 + 1; k < r.w / 2 - 0.5; k += 1.7) paint.strip(zx + px * k - ux * 1.6, zz + pz * k - uz * 1.6, zx + px * k + ux * 1.6, zz + pz * k + uz * 1.6, 0.8, Y, 0xf6f6ee);
          }
          // raised kerbs, in unbroken runs between junctions
          if (!cross && kerbStart == null) kerbStart = s;
          if ((cross || s + STEP >= len) && kerbStart != null) { world.kerb(a[0] + ux * kerbStart, a[1] + uz * kerbStart, a[0] + ux * (s + (cross ? 0 : STEP)), a[1] + uz * (s + (cross ? 0 : STEP)), px, pz, r.w / 2 + 0.4); kerbStart = null; }
          wasCross = cross;
        }
      }
    },
    kerb: function (x0, z0, x1, z1, px, pz, off) {
      var l = Math.hypot(x1 - x0, z1 - z0); if (l < 1) return;
      var n = Math.ceil(l / CHUNK);
      for (var i = 0; i < n; i++) {
        var a0 = i / n, a1 = (i + 1) / n, sx = x0 + (x1 - x0) * a0, sz = z0 + (z1 - z0) * a0, ex = x0 + (x1 - x0) * a1, ez = z0 + (z1 - z0) * a1;
        [1, -1].forEach(function (sd) {
          var g = world.geo((sx + ex) / 2 + px * off * sd, (sz + ez) / 2 + pz * off * sd, 'flat'), h = 0.2, w = 0.3;
          var ax = sx + px * sd * (off - w), az = sz + pz * sd * (off - w), bx = ex + px * sd * (off - w), bz = ez + pz * sd * (off - w), cx = ex + px * sd * (off + w), cz = ez + pz * sd * (off + w), dx = sx + px * sd * (off + w), dz = sz + pz * sd * (off + w);
          g.strip((ax + dx) / 2, (az + dz) / 2, (bx + cx) / 2, (bz + cz) / 2, w * 2, h, 0xd2cec2);
          var nx = -px * sd, nz = -pz * sd;     // the face toward the road
          g.quad(bx, 0, bz, ax, 0, az, ax, h, az, bx, h, bz, nx, 0, nz, 0x8d8b83, 0.62, 1);
          g.quad(ax, 0, az, bx, 0, bz, bx, h, bz, ax, h, az, nx, 0, nz, 0x8d8b83, 0.62, 1);
        });
      }
    },
    /** Is this point of a road inside another road? */
    crossing: function (x, z, self) {
      for (var r = 0; r < D.ROADS.length; r++) {
        if (r === self) continue;
        var R = D.ROADS[r];
        for (var i = 0; i < R.pts.length - 1; i++) {
          var a = R.pts[i], b = R.pts[i + 1], vx = b[0] - a[0], vz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz)));
          if (Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t) < R.w / 2 + 1) return true;
        }
      }
      return false;
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

    /** Runs fn, remembering which vertices it wrote so the building can be erased when demolished. */
    tracked: function (id, x, z, under, fn) {
      var layers = ['solid', 'window', 'neon'], before = layers.map(function (l) { return world.geo(x, z, l, under).p.length; });
      fn();
      if (!id) return;
      var key = (under ? 'u' : 's') + Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
      world.ranges[id] = layers.map(function (l, i) { return { chunk: key + ':' + l, from: before[i], to: world.geo(x, z, l, under).p.length }; });
    },
    setBuildingGone: function (id, gone) {
      (world.ranges[id] || []).forEach(function (r) {
        var m = world.meshes[r.chunk]; if (!m || r.to === r.from) return;
        var attr = m.geometry.attributes.position;
        if (!m.userData.backup) m.userData.backup = attr.array.slice();
        for (var i = r.from; i < r.to; i++) attr.array[i] = gone ? 0 : m.userData.backup[i];
        attr.needsUpdate = true;
      });
      var box = world.buildingBoxes[id];
      if (box) box.off = !!gone;
      if (gone) world.gone[id] = true; else delete world.gone[id];
    },
    /** New run: everything the last run did to the city is undone. */
    resetRun: function () {
      Object.keys(world.gone).forEach(function (id) { world.setBuildingGone(id, false); });
      if (world.rocket) { world.rocket.position.y = 0; world.rocket.visible = true; world.rocketFlying = 0; }
      if (world.runLayer) {
        world.scene.remove(world.runLayer);
        world.runLayer.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      }
      (world.projectBoxes || []).forEach(function (b) { b.off = true; });
      world.projectBoxes = [];
      world.runLayer = new THREE.Group();
      world.scene.add(world.runLayer);
    },
    runMesh: function (g, mat, cast) {
      var m = g.mesh(mat, cast, cast);
      m.geometry.computeBoundingSphere();
      world.runLayer.add(m);
      return m;
    },
    /** Rubble lot where a building stood. Stays for the run. */
    addRubble: function (b, y) {
      var g = new TR.Geo(), r = new Rng('rubble:' + b.id), cols = [0x8a8378, 0x6f6a62, 0xa89f90, 0x5a554e];
      g.box(b.x, y, b.z, b.w, 0.3, b.d, 0x77706a);
      for (var i = 0; i < 26; i++) {
        var s = r.range(1, 4);
        g.box(b.x + r.range(-b.w / 2, b.w / 2) * 0.9, y + 0.2, b.z + r.range(-b.d / 2, b.d / 2) * 0.9, s, r.range(0.5, 2.4), s * r.range(0.7, 1.5), r.pick(cols), r.range(0, 3));
      }
      if (b.enter) { var f = TrillionerLayout.frontOf(b), wx = f.x - f.nx * f.off, wz = f.z - f.nz * f.off; g.box(wx, y, wz, 5, 1.4, 5, 0x2b2b3f); }   // the cellar door survives
      world.runMesh(g, world.solid, true);
    },
    /** The owner's gold trim around the roof. */
    addTrim: function (b, y) {
      var g = new TR.Geo(), top = y + b.h + 0.8, t = 0.7, gold = 0xffc53d;
      g.box(b.x, top, b.z - b.d / 2, b.w + 1.4, t, t, gold).box(b.x, top, b.z + b.d / 2, b.w + 1.4, t, t, gold);
      g.box(b.x - b.w / 2, top, b.z, t, t, b.d + 1.4, gold).box(b.x + b.w / 2, top, b.z, t, t, b.d + 1.4, gold);
      world.runMesh(g, world.neonMat);
    },
    /** Bought city projects that are not a whole building still change the street. */
    addVisual: function (kind) {
      var g = new TR.Geo(), n = new TR.Geo(), c = world.collide;
      if (kind === 'harbour_bridge') {
        for (var i = 0; i < 12; i++) { var x = 124 + i * 8; g.box(x + 4, 7, 300, 8.2, 0.8, 14, 0xd9352c); if (i % 3 === 0) { g.box(x, -3, 293, 1.2, 28, 1.2, 0xd9352c); g.box(x, -3, 307, 1.2, 28, 1.2, 0xd9352c); } }
        world.projectBoxes.push(c.add(124, 7, 293, 220, 7.8, 307, { project: kind }));
      } else if (kind === 'metro_line') {
        TR.vehicles.RAIL.forEach(function (p) { n.box(p[0], TR.vehicles.RAIL_Y + 0.6, p[1], 7, 1, 7, 0x7dffea); n.box(p[0], 0, p[1], 2, TR.vehicles.RAIL_Y, 2, 0x2ad0ff); });
      } else if (kind === 'golden_metro') {
        g.box(-22, 0, -22, 22, 5, 14, 0xffc53d).box(-22, 5, -22, 26, 1, 18, 0xfff0b0);
        world.projectBoxes.push(c.addBox(-22, 0, -22, 22, 6, 14, { project: kind }));
      } else if (kind === 'free_wifi') {
        [[-40, -40], [40, 40], [40, -14], [-14, 40]].forEach(function (p) { g.box(p[0], 0, p[1], 0.5, 12, 0.5, 0xaaaaaa); n.cyl(p[0], 12, p[1], 2, 0.3, 0x7dd8ff, 8); });
      } else if (kind === 'skyline_show') {
        [[60, -62], [-104, -104], [104, -104], [-104, 104], [104, 104]].forEach(function (p) { n.cyl(p[0], 80, p[1], 1, 400, 0xff7de9, 6, 5); });
      } else if (kind === 'park') {
        [[-150, -160], [-175, -160], [-200, -160]].forEach(function (p, i) {
          n.strip(p[0] - 10, p[1], p[0] + 10, p[1], 20, 0.08, 0x5fd35f);
          g.cyl(p[0] - 5, 0, p[1] + 4, 0.5, 3, 0x7a5230, 6).cyl(p[0] - 5, 2.4, p[1] + 4, 2.4, 3.6, 0x4fae4f, 7, 0.6).cyl(p[0] + 5, 0, p[1] - 4, 0.5, 3, 0x7a5230, 6).cyl(p[0] + 5, 2.4, p[1] - 4, 2.4, 3.6, 0x3d9b4a, 7, 0.6);
        });
      }
      if (g.count) world.runMesh(g, world.solid, true);
      if (n.count) world.runMesh(n, world.neonMat);
    },
    /** Statues rise in the plazas as the spent total climbs. */
    addStatue: function (i) {
      var spots = [[-30, -30], [30, 30], [-30, 30], [240, 48], [-160, -26], [-60, 226], [190, 136], [-6, -134], [160, -134]], s = spots[i % spots.length], g = new TR.Geo();
      g.box(s[0], 0, s[1], 5, 2, 5, 0xeeeeee).box(s[0], 2, s[1], 2, 2.6, 1.2, 0xffc53d).box(s[0], 4.6, s[1], 1.5, 1.5, 1.5, 0xffc53d).box(s[0] - 1.3, 3, s[1], 0.6, 2.4, 0.6, 0xffc53d).box(s[0] + 1.3, 3.6, s[1], 0.6, 2.8, 0.6, 0xffc53d);
      world.projectBoxes.push(world.collide.addBox(s[0], 0, s[1], 5, 2, 5, { statue: i }));
      world.runMesh(g, world.solid, true);
    },
    launchRocket: function () { world.rocketFlying = 0.001; },
    /** A bought project rises from its lot. */
    addProject: function (b, y) {
      var g = new TR.Geo();
      g.box(b.x, y, b.z, b.w, b.h, b.d, b.wall).box(b.x, y + b.h, b.z, b.w + 1, 0.8, b.d + 1, b.roof);
      world.runMesh(g, world.solid, true);
      world.projectBoxes.push(world.collide.addBox(b.x, y, b.z, b.w, b.h + 0.8, b.d, { project: b.id }));
    },

    addBuilding: function (b, d, base, under) {
      var y = b.y != null ? b.y : (base || 0), g = world.geo(b.x, b.z, 'solid', under), shape = b.shape || (d.filler ? d.filler.shape : 'under');
      var wall = b.wall != null ? b.wall : d.walls[0], roof = b.roof != null ? b.roof : d.roofs[0], x = b.x, z = b.z, w = b.w, dd = b.d, h = b.h;
      var rng = new Rng('b:' + Math.round(x) + ',' + Math.round(z)), trim = shade(wall, 1.16), dark = shade(wall, 0.72);
      var FLOOR = h > 60 ? 6 : 3.7;
      var rc = shape === 'container' ? 0.1 : Math.min(0.35, Math.min(w, dd) * 0.03);
      g.rbox(x, y, z, w, h, dd, wall, rc, 0.2, 2);
      g.rbox(x, y, z, w + 0.8, 1.15, dd + 0.8, dark, rc + 0.3, 0.2, 1);                         // plinth
      for (var f = FLOOR * 2; f < h - 2; f += FLOOR * 2) g.rbox(x, y + f - 0.55, z, w + 0.5, 0.36, dd + 0.5, trim, rc + 0.2, 0.12, 1);  // string courses
      g.rbox(x, y + h - 0.7, z, w + 0.9, 0.7, dd + 0.9, trim, rc + 0.3, 0.22, 1);                  // cornice
      if (shape !== 'container') world.windows(x, y, z, w, h, dd, b, under, shape, FLOOR, rng);
      var top = y + h;
      if (shape !== 'house' && !under && h > 7 && !b.home) TR.street.roofClutter(g, x, top, z, w, dd, rng);
      if (shape === 'house') {
        var along = dd >= w;
        g.rbox(x, top - 0.3, z, w + 1.5, 0.55, dd + 1.5, shade(roof, 0.8), rc + 0.5, 0.12, 1);
        g.gable(x, top + 0.2, z, w + 0.5, Math.min(w, dd) * 0.42, dd + 0.5, roof, along);
        if (rng.next() < 0.7) g.box(x + w * 0.22, top + 0.4, z + dd * 0.15, 1.1, 3.2, 1.1, 0xb5533c);
      } else if (shape === 'tower') {
        world.parapet(g, x, top, z, w, dd, trim);
        g.box(x, top, z, w * 0.72, 3.4, dd * 0.72, shade(wall, 0.92)).box(x, top + 3.4, z, w * 0.72 + 0.5, 0.35, dd * 0.72 + 0.5, roof);
        g.box(x, top + 3.75, z, w * 0.38, 3.2, dd * 0.38, wall).cyl(x, top + 6.95, z, 0.3, 7, 0xd9d9d9, 6, 0.08);
      } else if (shape === 'factory') {
        var teeth = Math.max(2, Math.floor(w / 7));
        g.rbox(x, top - 0.3, z, w + 0.8, 0.5, dd + 0.8, shade(roof, 0.8), rc + 0.3, 0.1, 1);
        for (var i = 0; i < teeth; i++) g.gable(x - w / 2 + 0.3 + (i + 0.5) * ((w - 0.6) / teeth), top + 0.2, z, (w - 0.6) / teeth, 2.4, dd - 0.4, i % 2 ? roof : shade(roof, 0.86), true);
        g.cyl(x + w * 0.28, top, z - dd * 0.28, 1.1, 8, 0x6b6f75, 8, 0.8).cyl(x + w * 0.28, top + 8, z - dd * 0.28, 0.95, 0.6, 0xd9352c, 8);
      } else if (shape === 'hangar') {
        g.rbox(x, top - 0.2, z, w + 0.4, 0.4, dd + 0.4, shade(roof, 0.8), rc, 0.1, 1);
        for (var k = 0; k < 5; k++) { var t0 = k / 5, t1 = (k + 1) / 5, hx = w / 2 * Math.cos(t0 * Math.PI / 2), ry = Math.sin(t1 * Math.PI / 2) * w * 0.28; g.box(x, top + Math.sin(t0 * Math.PI / 2) * w * 0.28, z, hx * 2, ry - Math.sin(t0 * Math.PI / 2) * w * 0.28, dd, k % 2 ? roof : shade(roof, 0.92)); }
      } else if (shape === 'brick') {
        g.rbox(x, top - 0.3, z, w + 1.4, 0.55, dd + 1.4, shade(roof, 0.8), rc + 0.5, 0.12, 1);
        g.gable(x, top + 0.2, z, w + 0.4, Math.min(w, dd) * 0.34, dd + 0.4, roof, dd >= w);
        g.box(x + w * 0.26, top, z, 1.5, 3.6, 1.5, 0x7d4a2c).box(x + w * 0.26, top + 3.6, z, 1.9, 0.3, 1.9, 0x3a2115);
      } else if (shape === 'villa') {
        world.parapet(g, x, top, z, w, dd, 0xfff4f7);
        for (var c2 = 0; c2 < Math.floor(w / 5); c2++) g.cyl(x - w / 2 + (c2 + 0.5) * (w / Math.floor(w / 5)), y + 1.1, z + dd / 2 + 1.2, 0.42, h * 0.55, 0xfff4f7, 8);
        g.box(x, y + 1.1 + h * 0.55, z + dd / 2 + 1.2, w, 0.5, 2.6, 0xfff4f7);
        g.box(x, top, z, w * 0.46, 1.6, dd * 0.46, roof);
      } else if (shape === 'container') {
        world.containers(g, x, y, z, w, h, dd, d, rng);
      } else {
        world.parapet(g, x, top, z, w, dd, roof);
        world.roofJunk(g, x, top, z, w, dd, rng);
      }
      if (shape === 'tower' || shape === 'factory') world.roofJunk(g, x - w * 0.12, top, z + dd * 0.12, w * 0.5, dd * 0.5, rng);
      if (b.id) world.ornament(b, d, g, y, under);
      if (b.busy) world.busySign(b, y, under);
      if (b.boarded && b.id) world.boards(b, x, y, z, w, h, dd, g);
      var box = world.collide.addBox(x, y, z, w, h + 0.8, dd, b.id ? { building: b.id } : null);
      if (b.id) world.buildingBoxes[b.id] = box;
      if (!under && !y) world.aoRing(x - w / 2, z - dd / 2, x + w / 2, z + dd / 2, 3.2);
    },
    /** Big windows full of stock either side of the door, with a striped canopy over them. */
    shopfront: function (b, side, y, under, len, hw, hd) {
      var g = world.geo(b.x, b.z, 'window', under), s = world.geo(b.x, b.z, 'solid', under), n = world.geo(b.x, b.z, 'neon', under), rng = new Rng('front:' + b.id), bay = (len - 6) / 2;
      if (bay < 1.5) return;
      [-1, 1].forEach(function (e) {
        var u = e * (3 + bay / 2);
        g.panel(side, b.x, b.z, hw, hd, 0.05, u, y + 0.9, bay + 0.3, 3.3, 0x23263a);
        g.panel(side, b.x, b.z, hw, hd, 0.09, u, y + 1.05, bay, 3, 0xa8cfe2);
      });
      var ax = side === 's' || side === 'n', dir = side === 's' || side === 'e' ? 1 : -1, stripes = Math.max(4, Math.floor(len / 2.4)), a = b.wall || 0xffc53d, c1 = b.neon ? 0xe0413f : 0x3f7fa8;
      for (var i = 0; i < stripes; i++) {
        var v = -len / 2 + (i + 0.5) * (len / stripes), col = i % 2 ? c1 : 0xfffaf0;
        var cx = ax ? b.x + (side === 's' ? v : -v) : b.x + dir * (hw + 1.1), cz = ax ? b.z + dir * (hd + 1.1) : b.z + (side === 'e' ? -v : v);
        s.box(cx, y + 4.5, cz, ax ? len / stripes : 2.2, 0.22, ax ? 2.2 : len / stripes, col);
      }
    },
    /** Porches, domes, spires: the things that make a civic building more than a box. */
    ornament: function (b, d, g, y, under) {
      var id = b.id, x = b.x, z = b.z, top = y + b.h, stone = 0xf4efe2;
      if (id === 'city_hall' || id === 'observatory' || id === 'museum' || id === 'embassy') {
        var r = Math.min(b.w, b.d) * 0.3, dome = id === 'observatory' ? 0xd8dee8 : id === 'embassy' ? 0x8fbf9a : 0x6ea88a;
        g.cyl(x, top, z, r + 0.7, 1.6, stone, 18).blob(x, top + 1.6, z, r, r * 0.85, r, dome).cyl(x, top + 1.6 + r * 0.82, z, 0.26, 2.2, 0xffc53d, 8, 0.05);
      }
      if (id === 'city_hall' || id === 'bank' || id === 'exchange' || id === 'museum' || id === 'embassy' || id === 'grand_hotel' || id === 'global_trade' || id === 'theatre') {
        // columns and a pediment across the front
        var f = TrillionerLayout.frontOf(b), H = Math.min(b.h * 0.5, 7.6), wx = f.x - f.nx * f.off, wz = f.z - f.nz * f.off, along = !!f.nz, span = Math.min((along ? b.w : b.d) - 2, 22), cols = 6;
        for (var i = 0; i < cols; i++) {
          var u = -span / 2 + i * span / (cols - 1);
          if (Math.abs(u) < 3.4) continue;
          var cx = wx + f.nx * 3 + (along ? u : 0), cz = wz + f.nz * 3 + (along ? 0 : u);
          g.cyl(cx, y + 0.3, cz, 0.56, H, stone, 12, 0.44).rbox(cx, y, cz, 1.5, 0.34, 1.5, stone, 0.2, 0.08, 1).rbox(cx, y + H + 0.2, cz, 1.4, 0.3, 1.4, stone, 0.2, 0.08, 1);
          world.collide.addBox(cx, y, cz, 1, H, 1);
        }
        var bx = wx + f.nx * 2.2, bz = wz + f.nz * 2.2;
        g.rbox(bx, y + H + 0.5, bz, along ? span + 2 : 5.6, 0.9, along ? 5.6 : span + 2, stone, 0.3, 0.14, 1);
        g.gable(bx, y + H + 1.4, bz, along ? span + 2.4 : 6, 2.1, along ? 6 : span + 2.4, stone, !along);
        world.collide.addBox(bx, y + H + 0.5, bz, along ? span + 2 : 5.6, 3, along ? 5.6 : span + 2);
      }
      if (id === 'trillion_tower') {
        g.rbox(x, top, z, b.w * 0.74, 8, b.d * 0.74, b.wall, 3, 0.4, 2);
        g.rbox(x, top + 8, z, b.w * 0.46, 7, b.d * 0.46, 0xffd96a, 2.4, 0.4, 2);
        world.collide.addBox(x, top, z, b.w * 0.74, 8, b.d * 0.74); world.collide.addBox(x, top + 8, z, b.w * 0.46, 7, b.d * 0.46);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { g.cyl(x + c[0] * b.w * 0.2, top + 15, z + c[1] * b.d * 0.2, 0.5, 9, 0xfff0b0, 8, 0.06); });
      }
      if (b.twin) g.cyl(x, top, z, b.w * 0.34, 7, b.wall, 12, 0.1);
      if (id === 'trillion_tower' || id === 'global_trade' || id === 'grand_hotel') {
        for (var fr = 1; fr * 26 < b.h; fr++) g.rbox(x, y + fr * 26, z, b.w + 2, 1.1, b.d + 2, 0xfff4cc, 3, 0.3, 1);
      }
    },
    parapet: function (g, x, y, z, w, d, color) {
      var r = Math.min(0.35, Math.min(w, d) * 0.03);
      g.rbox(x, y, z, w - 0.4, 0.34, d - 0.4, shade(color, 0.72), r, 0.1, 1);
      g.rbox(x, y, z, w + 0.4, 0.92, d + 0.4, shade(color, 1.08), r + 0.1, 0.18, 1);
      g.rbox(x, y + 0.5, z, w - 1, 0.52, d - 1, shade(color, 0.72), r, 0.04, 1);
    },
    roofJunk: function (g, x, y, z, w, d, rng) {
      var n = 1 + rng.int(3);
      for (var i = 0; i < n; i++) {
        var px = x + rng.range(-0.3, 0.3) * w, pz = z + rng.range(-0.3, 0.3) * d, t = rng.next();
        if (t < 0.4) g.box(px, y + 0.2, pz, 2.2, 1.3, 1.7, 0xc4c8cc).box(px, y + 1.5, pz, 1.2, 0.2, 1.2, 0x7f8388);
        else if (t < 0.7) { g.cyl(px, y + 2, pz, 1.3, 2.4, 0x8d6e4b, 8).cyl(px, y + 4.4, pz, 1.5, 0.9, 0x6b4d2c, 8, 0.1); [[-1, -1], [1, 1], [-1, 1], [1, -1]].forEach(function (c) { g.box(px + c[0] * 0.9, y + 0.2, pz + c[1] * 0.9, 0.2, 1.9, 0.2, 0x444444); }); }
        else g.box(px, y + 0.2, pz, 2.6, 0.5, 2.6, 0xe7ebee).box(px, y + 0.7, pz, 2, 0.1, 2, 0x8fc6e6);
      }
    },
    // Harbour stacks are containers, not buildings: ribbed, painted, stacked.
    containers: function (g, x, y, z, w, h, d, dist, rng) {
      var rows = Math.max(1, Math.round(h / 3)), cols = Math.max(1, Math.floor(w / 6.4));
      g.box(x, y, z, w + 0.1, 0.1, d + 0.1, 0x444444);
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var cw = w / cols, cx = x - w / 2 + (c + 0.5) * cw, cy = y + (r / rows) * h, col = rng.pick([0xd9483b, 0x2f8fd0, 0xf2c14e, 0x3fae8c, 0xee7c30, 0x7d5fc4]);
        g.box(cx, cy, z, cw - 0.2, h / rows - 0.1, d + 0.3, col);
        for (var k = 0; k < 5; k++) g.box(cx - cw / 2 + (k + 0.5) * cw / 5, cy + 0.15, z, 0.14, h / rows - 0.4, d + 0.42, shade(col, 0.8));
      }
    },

    windows: function (x, y, z, w, h, d, b, under, shape, FLOOR, rng) {
      var g = world.geo(x, z, 'window', under), hw = w / 2, hd = d / 2, boarded = b.boarded;
      var frame = boarded ? 0x4a3b2c : (shape === 'tower' ? 0x2f4a66 : shape === 'villa' ? 0xffffff : shape === 'brick' ? 0xf2e6cc : shape === 'house' ? 0xffffff : 0x53606d);
      var DIM = 0x4f83ad, LIT = 0xa8cfe2, BOARD = 0x2d241b;
      var ww = h > 60 ? 3.4 : 1.9, wh = h > 60 ? 3.4 : 2, gap = h > 60 ? 5.4 : 4.4, start = shape === 'tower' ? 4.6 : 1.8, rc = Math.min(0.35, Math.min(w, d) * 0.13);
      var ledge = h > 60 || boarded ? 0 : (shape === 'brick' ? 0xe6d4b4 : shape === 'villa' ? 0xffffff : shape === 'house' ? 0xfafafa : 0xc8ccd2);
      if (b.shop) start = Math.max(start, 5.2);
      [['s', w], ['n', w], ['e', d], ['w', d]].forEach(function (f) {
        var side = f[0], len = f[1] - rc * 2, n = Math.max(1, Math.floor((len - 1.2) / gap));
        for (var fl = start; fl + wh < h - 0.7; fl += FLOOR) {
          for (var i = 0; i < n; i++) {
            var u = -len / 2 + (i + 0.5) * (len / n);
            g.panel(side, x, z, hw, hd, 0.05, u, y + fl - 0.14, ww + 0.28, wh + 0.28, frame);
            g.panel(side, x, z, hw, hd, 0.09, u, y + fl, ww, wh, boarded ? BOARD : rng.next() < 0.38 ? LIT : DIM);
            if (ledge) {
              // a sill to catch the light and a lintel above, so the window sits in the wall rather than on it
              var cu = side === 's' ? x + u : side === 'n' ? x - u : side === 'e' ? x + hw + 0.14 : x - hw - 0.14, cv = side === 's' ? z + hd + 0.14 : side === 'n' ? z - hd - 0.14 : side === 'e' ? z - u : z + u, ax = side === 's' || side === 'n';
              g.box(cu, y + fl - 0.34, cv, ax ? ww + 0.7 : 0.34, 0.2, ax ? 0.34 : ww + 0.7, ledge);
              g.box(cu, y + fl + wh + 0.12, cv, ax ? ww + 0.5 : 0.26, 0.22, ax ? 0.26 : ww + 0.5, ledge);
              if (ax) { g.panel(side, x, z, hw, hd, 0.095, u, y + fl + wh - 0.28, ww, 0.28, 0x22303e); } else { g.panel(side, x, z, hw, hd, 0.095, u, y + fl + wh - 0.28, ww, 0.28, 0x22303e); }
            }
          }
        }
        if (shape === 'tower' && !b.shop) g.panel(side, x, z, hw, hd, 0.05, 0, y + 1.3, len - 2.4, 2.9, 0x355a78); // glass shopfronts
        if (b.shop && !b.plain && side === b.door) world.shopfront(b, side, y, under, len, hw, hd);
      });
    },

    /** The Race Track: a real oval with kerbs, a chequered line and a grandstand. */
    raceTrack: function (d, taken) {
      var t = d.track, W = world.walk, g = world.geo(t.x, t.z, 'solid'), N = 48, i;
      function pt(a, k) { return [t.x + Math.cos(a) * t.rx * k, t.z + Math.sin(a) * t.rz * k]; }
      W.tile(t.x - t.rx - 6, t.z - t.rz - 6, t.x + t.rx + 6, t.z + t.rz + 6, 0.012, 0x74c256);
      for (i = 0; i < N; i++) {
        var a0 = i / N * 6.2832, a1 = (i + 1) / N * 6.2832, p0 = pt(a0, 1), p1 = pt(a1, 1), q0 = pt(a0, 1.2), q1 = pt(a1, 1.2), r0 = pt(a0, 0.8), r1 = pt(a1, 0.8);
        W.strip(p0[0], p0[1], p1[0], p1[1], 8.4, 0.018, i % 2 ? 0xd9352c : 0xf6f6f0);
        W.strip(p0[0], p0[1], p1[0], p1[1], 7.2, 0.02, 0x3d414c);
      }
      for (i = 0; i < 8; i++) for (var j = 0; j < 2; j++) W.tile(t.x + j * 1.2, t.z + t.rz - 3.6 + i * 0.9, t.x + j * 1.2 + 1.2, t.z + t.rz - 2.7 + i * 0.9, 0.022, (i + j) % 2 ? 0x111111 : 0xffffff);
      // grandstand on the infield
      for (i = 0; i < 4; i++) g.rbox(t.x, i * 0.9, t.z - 2 + i * 1.4, t.rx * 0.9, 0.9, 1.4, i % 2 ? 0xc8ccd2 : 0xe0442f, 0.15, 0.08, 1);
      g.box(t.x, 3.6, t.z + 3.4, t.rx * 0.9, 3, 0.4, 0x8a8f96);
      world.collide.addBox(t.x, 0, t.z + 0.2, t.rx * 0.9, 6, 6);
      taken.push([t.x - t.rx - 7, t.z - t.rz - 7, t.x + t.rx + 7, t.z + t.rz + 7]);
    },
    /** A column of light over a place the whole city should know about. */
    setBeam: function (site, color) {
      if (!world.beam) {
        var m = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 260, 18, 1, true), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        m.frustumCulled = false;
        world.surface.add(m);
        world.beam = m;
      }
      world.beam.visible = !!site;
      if (site) { world.beam.position.set(site.front.x, 130, site.front.z); world.beam.material.color.setHex(color || 0xffc53d); }
    },
    /** A building shows its trade: neon and bright if it earns, boards and gloom if it loses. */
    natureOf: function (bid) {
      if (!world.natures) {
        world.natures = {};
        TRD.items.build().forEach(function (it) { if (it.bldg && it.income) world.natures[it.bldg] = it.income > 0 ? 'busy' : 'dead'; });
      }
      return world.natures[bid];
    },
    /** Pale planks nailed across every face of a building that loses money, readable from the street. */
    boards: function (b, x, y, z, w, h, dd, g) {
      var c = 0xc9a26b, tall = Math.min(h - 2, 13), o = 0.36;
      [0.34, 0.66].forEach(function (lv) {
        var py = y + tall * lv;
        [-0.3, 0.3].forEach(function (u) {
          [-0.45, 0.45].forEach(function (dy) {
            g.box(x + u * w, py + dy, z + dd / 2 + o, w * 0.26, 0.5, 0.12, c);
            g.box(x + u * w, py + dy, z - dd / 2 - o, w * 0.26, 0.5, 0.12, c);
          });
          var sp = dd * 0.26;
          g.box(x + w / 2 + o, py + 0.45, z + u * dd, 0.12, 0.5, sp, c);
          g.box(x + w / 2 + o, py - 0.45, z + u * dd, 0.12, 0.5, sp, c);
          g.box(x - w / 2 - o, py + 0.45, z + u * dd, 0.12, 0.5, sp, c);
          g.box(x - w / 2 - o, py - 0.45, z + u * dd, 0.12, 0.5, sp, c);
        });
      });
    },
    busySign: function (b, y, under) {
      var n = world.geo(b.x, b.z, 'neon', under), top = y + b.h - 0.9, c = 0x4dffb0, t = 0.2;
      n.box(b.x, top, b.z + b.d / 2 + 0.28, b.w - 3, t, t, c).box(b.x, top, b.z - b.d / 2 - 0.28, b.w - 3, t, t, c).box(b.x + b.w / 2 + 0.28, top, b.z, t, t, b.d - 3, c).box(b.x - b.w / 2 - 0.28, top, b.z, t, t, b.d - 3, c);
      var f = TrillionerLayout.frontOf(b), wx = f.x - f.nx * f.off, wz = f.z - f.nz * f.off, side = f.nz ? 3.6 : 0, sd = f.nx ? 3.6 : 0;
      n.box(wx + f.nx * 0.5 + side, y + 3.4, wz + f.nz * 0.5 + sd, f.nz ? 1.5 : 0.1, 0.7, f.nz ? 0.1 : 1.5, 0x4dffb0);   // lit OPEN panel by the door
    },
    buildDistrict: function (d) {
      var taken = [];
      if (d.track) world.raceTrack(d, taken);
      (d.buildings || []).forEach(function (b) { var nat = world.natureOf(b.id); if (nat === 'dead') b.boarded = 1; if (nat === 'busy') { b.neon = 1; b.busy = 1; } });
      if (d.hill) world.hill(d);
      if (d.pier) world.pier(d);
      (d.runways || []).forEach(function (r) { world.runway(r); });
      (d.buildings || []).forEach(function (b) {
        if (!b.project) {
          world.tracked(b.id, b.x, b.z, false, function () { world.addBuilding(b, d); world.door(b, d); });
          if (!b.hiddenSign && !b.plain) world.signs.add(b.name, b, d);
          if (b.walled) world.compound(b);
          if (b.helipad) world.helipad(b);
        }
        taken.push([b.x - b.w / 2 - 7, b.z - b.d / 2 - 7, b.x + b.w / 2 + 7, b.z + b.d / 2 + 7]);
        var f = TrillionerLayout.frontOf(b);
        taken.push([Math.min(f.x, f.x + (f.nz ? 22 : f.nx * 6)) - 4, Math.min(f.z, f.z + (f.nx ? 22 : f.nz * 6)) - 4, Math.max(f.x, f.x + (f.nz ? 22 : f.nx * 6)) + 4, Math.max(f.z, f.z + (f.nx ? 22 : f.nz * 6)) + 4]);
      });
      (d.stairs || []).forEach(function (st) { world.stair(st, d, 0, false); taken.push([st.x - 8, st.z - 8, st.x + 8, st.z + 8]); });
      (d.landmarks || []).forEach(function (l) { world.landmark(l, d); var r = (l.r || (l.w || 20) / 2) + 8; taken.push([l.x - r, l.z - r, l.x + r, l.z + r]); });
      world.RAILS.forEach(function (r) {
        var b = d.bounds, mx = (r[0][0] + r[1][0]) / 2, mz = (r[0][1] + r[1][1]) / 2;
        if (mx >= b[0] && mx < b[2] && mz >= b[1] && mz < b[3]) taken.push([Math.min(r[0][0], r[1][0]) - 4, Math.min(r[0][1], r[1][1]) - 4, Math.max(r[0][0], r[1][0]) + 4, Math.max(r[0][1], r[1][1]) + 4]);
      });
      world.fill(d, taken);
      world.scatter(d, taken);
    },

    door: function (b, d, under) {
      var f = TrillionerLayout.frontOf(b), y = b.y != null ? b.y : (under ? UY : 0), g = world.geo(b.x, b.z, 'solid', under), n = world.geo(b.x, b.z, 'neon', under);
      var dw = b.w < 10 ? 3 : 5, dh = b.h < 5 ? 2.8 : 4.4, dx = f.nx ? (f.x - f.nx * f.off) : f.x, dz = f.nz ? (f.z - f.nz * f.off) : f.z, alongX = !!f.nz;
      var plainDoor = b.plain || b.hiddenSign;
      var col = b.boarded ? 0x4a3b2c : (b.neon ? (d.neon || 0xffc53d) : shade(b.wall || d.walls[0], 0.62));
      g.box(dx + f.nx * 0.2, y, dz + f.nz * 0.2, alongX ? dw + 1.2 : 0.3, dh + 0.5, alongX ? 0.3 : dw + 1.2, shade(col, 0.8));
      g.box(dx + f.nx * 0.34, y, dz + f.nz * 0.34, alongX ? dw : 0.3, dh, alongX ? 0.3 : dw, b.enter ? 0x202436 : 0x7a7f88);
      if (b.enter && plainDoor) {
        g.box(dx + f.nx * 0.5, y, dz + f.nz * 0.5, alongX ? dw - 0.4 : 0.16, dh - 0.2, alongX ? 0.16 : dw - 0.4, 0x5a4636);
      } else if (b.enter) {
        // double glass doors, lit from inside, with a mat that says this one opens
        var cx = alongX ? 1.26 : 0, cz = alongX ? 0 : 1.26;
        var pw = dw / 2 - 0.4; cx = alongX ? dw * 0.25 : 0; cz = alongX ? 0 : dw * 0.25;
        n.box(dx + f.nx * 0.5 - cx, y + 0.3, dz + f.nz * 0.5 - cz, alongX ? pw : 0.1, dh - 0.8, alongX ? 0.1 : pw, b.boarded ? 0x3a3328 : 0xc9b98a);
        n.box(dx + f.nx * 0.5 + cx, y + 0.3, dz + f.nz * 0.5 + cz, alongX ? pw : 0.1, dh - 0.8, alongX ? 0.1 : pw, b.boarded ? 0x3a3328 : 0xc9b98a);
        g.box(dx + f.nx * 0.6, y, dz + f.nz * 0.6, alongX ? 0.24 : 0.14, dh, alongX ? 0.14 : 0.24, 0x23263a);
        g.box(dx + f.nx * 0.62 - cx * 0.2, y + 1.7, dz + f.nz * 0.62 - cz * 0.2, alongX ? 0.12 : 0.1, 0.9, alongX ? 0.1 : 0.12, 0xffd24a);
        g.box(dx + f.nx * 0.62 + cx * 0.2, y + 1.7, dz + f.nz * 0.62 + cz * 0.2, alongX ? 0.12 : 0.1, 0.9, alongX ? 0.1 : 0.12, 0xffd24a);
        var canopy = alongX ? [dw + 2, 3.2] : [3.2, dw + 2];
        g.box(dx + f.nx * 1.5, y + dh + 0.1, dz + f.nz * 1.5, canopy[0], 0.35, canopy[1], col);
        world.collide.addBox(dx + f.nx * 1.5, y + dh + 0.1, dz + f.nz * 1.5, canopy[0], 0.35, canopy[1]);
        n.box(dx + f.nx * 3, y + dh + 0.02, dz + f.nz * 3, alongX ? dw + 2 : 0.14, 0.14, alongX ? 0.14 : dw + 2, 0xffe9b0);
        g.box(dx + f.nx * 1.8, y, dz + f.nz * 1.8, alongX ? dw + 1 : 3.2, 0.12, alongX ? 3.2 : dw + 1, 0xc8c4b8);
        g.box(dx + f.nx * 1.8, y + 0.12, dz + f.nz * 1.8, alongX ? dw - 0.6 : 2.4, 0.03, alongX ? 2.4 : dw - 0.6, 0xc73e4f);
      }
      if (b.boarded) for (var i = 0; i < 3; i++) g.box(dx + f.nx * 0.6, y + 0.8 + i * 1.3, dz + f.nz * 0.6, alongX ? dw + 1 : 0.2, 0.3, alongX ? 0.2 : dw + 1, 0x8d6e4b);
    },

    // The hill: stacked terraces, low enough to walk up.
    hill: function (d) {
      var h = d.hill, b = d.bounds;
      for (var i = 0; i < h.steps; i++) {
        var half = h.top / 2 + (h.steps - 1 - i) * h.run, x0 = Math.max(b[0], h.x - half), x1 = Math.min(b[2], h.x + half), z0 = Math.max(b[1], h.z - half), z1 = Math.min(b[3], h.z + half);
        var top = (i + 1) * h.rise, c = i % 2 ? 0x74cc56 : 0x82d862;
        world.geo((x0 + x1) / 2, (z0 + z1) / 2, 'flat').box((x0 + x1) / 2, top - h.rise, (z0 + z1) / 2, x1 - x0, h.rise, z1 - z0, c);
        world.collide.add(x0, 0, z0, x1, top, z1, { hill: 1 });
      }
    },
    pier: function (d) {
      var p = d.pier, z = (p.z0 + p.z1) / 2, l = p.z1 - p.z0, g = world.geo(p.x, z, 'solid');
      g.box(p.x, -0.5, z, p.w, 0.7, l, 0xa8815a);
      for (var i = 0; i < 6; i++) { g.box(p.x - p.w / 2, -8, p.z0 + i * l / 5, 0.8, 8, 0.8, 0x6b4d2c); g.box(p.x + p.w / 2, -8, p.z0 + i * l / 5, 0.8, 8, 0.8, 0x6b4d2c); }
      world.collide.add(p.x - p.w / 2, -2, p.z0, p.x + p.w / 2, 0.2, p.z1, { pier: 1 });
    },
    runway: function (r) {
      var g = world.geo(r.x, r.z, 'flat');
      g.strip(r.x - r.w / 2, r.z, r.x + r.w / 2, r.z, r.d, 0.05, r.pad ? 0x9a9a9a : 0x3a3f47);
      if (!r.pad) for (var i = 0; i < 11; i++) { var x = r.x - r.w / 2 + 6 + i * 11.5; g.strip(x, r.z, x + 6, r.z, 1, 0.07, 0xffffff); }
    },
    compound: function (b) { // a wall tall enough that only a helicopter gets in
      var pad = 12, h = 26, c = world.collide, g = world.geo(b.x, b.z, 'solid'), x0 = b.x - b.w / 2 - pad, x1 = b.x + b.w / 2 + pad, z0 = b.z - b.d / 2 - pad, z1 = b.z + b.d / 2 + pad + 6, col = 0x5a6670;
      g.box((x0 + x1) / 2, 0, z0, x1 - x0, h, 2, col).box((x0 + x1) / 2, 0, z1, x1 - x0, h, 2, col).box(x0, 0, (z0 + z1) / 2, 2, h, z1 - z0, col).box(x1, 0, (z0 + z1) / 2, 2, h, z1 - z0, col);
      c.add(x0 - 1, 0, z0 - 1, x1 + 1, h, z0 + 1); c.add(x0 - 1, 0, z1 - 1, x1 + 1, h, z1 + 1); c.add(x0 - 1, 0, z0, x0 + 1, h, z1); c.add(x1 - 1, 0, z0, x1 + 1, h, z1);
    },
    helipad: function (b) {
      var g = world.geo(b.x, b.z, 'neon'), y = b.h + 15.02;   // on the top tier of the crown
      g.cyl(b.x, y, b.z, 6.8, 0.1, 0x2d2d3a, 20);
      g.box(b.x - 2, y + 0.1, b.z, 0.9, 0.06, 5.4, 0xffffff).box(b.x + 2, y + 0.1, b.z, 0.9, 0.06, 5.4, 0xffffff).box(b.x, y + 0.1, b.z, 3.2, 0.06, 0.9, 0xffffff);
    },
    /** A spiral fire escape with a bridge to the roof: the rooftop route every district gets. */
    stair: function (st, d, base, under) {
      var y0 = base || 0, n = Math.ceil(st.to / 0.6), g = world.geo(st.x, st.z, 'solid', under), c = world.collide, R = 3.6;
      g.cyl(st.x, y0, st.z, 0.8, st.to + 2, 0x777b80, 8);
      c.addBox(st.x, y0, st.z, 1.2, st.to + 2, 1.2);
      for (var i = 0; i < n; i++) {
        var a = i / 11 * Math.PI * 2, x = st.x + Math.cos(a) * R, z = st.z + Math.sin(a) * R, top = y0 + (i + 1) * 0.6;
        g.box(x, top - 0.25, z, 3, 0.25, 3, i % 2 ? 0xf0a030 : 0xdf8f20);
        c.add(x - 1.6, top - 0.5, z - 1.6, x + 1.6, top, z + 1.6);
      }
      var dx = st.dir === 'e' ? 1 : st.dir === 'w' ? -1 : 0, dz = st.dir === 's' ? 1 : st.dir === 'n' ? -1 : 0, top2 = y0 + st.to + 0.8;
      var cx = st.x + dx * st.len / 2, cz = st.z + dz * st.len / 2, w = dx ? st.len + 6 : 7, dd = dz ? st.len + 6 : 7;
      g.box(cx, top2 - 0.4, cz, w, 0.4, dd, 0xb0b4b8);
      c.addBox(cx, top2 - 0.8, cz, w, 0.8, dd);
    },
    landmark: function (l, d, under) {
      var base = under ? UY : 0, g = world.geo(l.x, l.z, 'solid', under), n = world.geo(l.x, l.z, 'neon', under), c = world.collide;
      if (l.kind === 'chimney') {
        g.cyl(l.x, 0, l.z, l.r, l.h, 0x9c5a3c, 12, l.r * 0.62);
        for (var i = 1; i < 4; i++) g.cyl(l.x, l.h * i / 4, l.z, l.r * (1 - i * 0.1) + 0.4, 2.4, i % 2 ? 0xffffff : 0xd9352c, 12);
        g.cyl(l.x, l.h, l.z, l.r * 0.66, 2, 0x2a2a2a, 12);
        c.add(l.x - l.r, 0, l.z - l.r, l.x + l.r, l.h, l.z + l.r);
        world.smokers = world.smokers || []; world.smokers.push({ x: l.x, y: l.h + 2, z: l.z, s: 9, c: 0xb9bdc4 });
      } else if (l.kind === 'bigsign') {
        g.box(l.x - l.w / 2 + 3, 0, l.z, 1.4, l.h, 1.4, 0x444444).box(l.x + l.w / 2 - 3, 0, l.z, 1.4, l.h, 1.4, 0x444444);
        c.addBox(l.x - l.w / 2 + 3, 0, l.z, 1.4, l.h, 1.4); c.addBox(l.x + l.w / 2 - 3, 0, l.z, 1.4, l.h, 1.4);
        world.signs.addFlat(l.text, l.x, l.h - 3.5, l.z + 0.8, l.w, 8, d.neon || 0xffc53d, 0);
      } else if (l.kind === 'screen') {
        g.box(l.x, 0, l.z, 2, l.h, 2, 0x444444);
        c.addBox(l.x, 0, l.z, 2, l.h, 2);
        world.screens.push(l);
      } else if (l.kind === 'globe') {
        for (var k = 0; k < 9; k++) {
          var t = (k + 0.5) / 9, h = l.r * 2 / 9, a0 = Math.sqrt(Math.max(0, 1 - Math.pow(2 * k / 9 - 1, 2))), a1 = Math.sqrt(Math.max(0, 1 - Math.pow(2 * (k + 1) / 9 - 1, 2)));
          g.cyl(l.x, 3 + k * h, l.z, l.r * a0, h, k % 3 ? 0x3da8ff : 0x5dbb63, 14, l.r * a1);
        }
        g.cyl(l.x, 0, l.z, 3, 3, 0xd6547c, 10, 1.4);
        c.addBox(l.x, 0, l.z, l.r * 1.4, l.r * 2 + 3, l.r * 1.4);
      } else if (l.kind === 'ferris') {
        g.box(l.x, 0, l.z - 3, 2, l.r + 3, 2, 0x8e7dbe).box(l.x, 0, l.z + 3, 2, l.r + 3, 2, 0x8e7dbe);
        c.addBox(l.x, 0, l.z, 2, l.r + 3, 8);
        // broken: one side sags and a few cars are gone
        for (var j = 0; j < 16; j++) {
          var ang = j / 16 * Math.PI * 2, fx = l.x + Math.cos(ang) * l.r, fy = l.r + 3 + Math.sin(ang) * l.r * 0.98 - (j > 10 ? 2 : 0);
          g.box(fx, fy, l.z, 2.2, 2.2, 0.8, 0xc9a0dc);
          if (j % 4 !== 3) g.box(fx, fy - 2.4, l.z, 2.4, 2, 2.4, [0xff7a59, 0xffd166, 0x7ad0ff][j % 3]);
        }
      } else if (l.kind === 'crane') {
        var col = l.label === 'rusted' ? 0x9c5a3c : 0xe25c4f;
        g.box(l.x, 0, l.z, 3, l.h, 3, col).box(l.x + 9, l.h, l.z, 26, 2, 2, col).box(l.x + 20, l.h - 8, l.z, 0.4, 8, 0.4, 0x333333).box(l.x + 20, l.h - 11, l.z, 5, 3, 5, 0x555555);
        c.addBox(l.x, 0, l.z, 3, l.h, 3);
        if (l.label === 'rusted') { g.box(l.x, l.h + 0.1, l.z, 14, 0.5, 10, col); c.addBox(l.x, l.h, l.z, 14, 0.6, 10); }
      } else if (l.kind === 'lighthouse') {
        g.cyl(l.x, 8, l.z, 5, l.h - 8, 0xd9352c, 12, 3.4);
        for (i = 1; i < 3; i++) g.cyl(l.x, 8 + (l.h - 8) * i / 3, l.z, 4.8 - i * 0.5, 3, 0xffffff, 12);
        n.cyl(l.x, l.h, l.z, 3.2, 3, 0xfff6a0, 10);
        g.cyl(l.x, l.h + 3, l.z, 3.6, 2.4, 0x7d1c19, 10, 0);
        c.addBox(l.x, 8, l.z, 7, l.h, 7);
      } else if (l.kind === 'rocket') {
        g.box(l.x, 0, l.z, 26, 2, 26, 0x777b80);
        world.rocketBase = { x: l.x, z: l.z, h: l.h };
        c.addBox(l.x, 0, l.z, 26, 2, 26);
      } else if (l.kind === 'clock') {
        g.box(l.x, 0, l.z, 13, l.h, 13, 0xb5533c).box(l.x, l.h, l.z, 15, 1.4, 15, 0x6b3a26).cyl(l.x, l.h + 1.4, l.z, 8, 10, 0x54301f, 4, 0);
        c.addBox(l.x, 0, l.z, 13, l.h + 1.4, 13);
        world.clockTower = l;
      } else if (l.kind === 'goldtrain') {
        var y = base + 0.2;
        g.box(l.x, base, l.z, 130, 0.3, 5, 0x444444);
        for (i = -3; i < 3; i++) { g.box(l.x + i * 13 + 6, y + 0.8, l.z, 11.4, 4.2, 4, 0xffc53d); g.box(l.x + i * 13 + 6, y + 5, l.z, 11.8, 0.5, 4.4, 0xb58a00); }
        c.addBox(l.x, base, l.z, 80, 6, 4.4);
      }
    },

    // Filler blocks: fixed for every seed. Gaps between them are the alleys.
    fill: function (d, taken) {
      var f = d.filler; if (!f) return;
      var rng = new Rng('fill:' + d.id), b = d.land || d.bounds, step = f.step;
      for (var x = b[0] + step / 2; x < b[2]; x += step) for (var z = b[1] + step / 2; z < b[3]; z += step) {
        var w = rng.range(step * 0.5, step * 0.74), dd = rng.range(step * 0.5, step * 0.74), h = rng.range(f.hMin, f.hMax);
        var px = x + rng.range(-2, 2), pz = z + rng.range(-2, 2);
        var skip = rng.next() < (f.gap || 0.2), wall = rng.pick(d.walls), roof = rng.pick(d.roofs);
        if (px - w / 2 < b[0] + 4 || px + w / 2 > b[2] - 4 || pz - dd / 2 < b[1] + 4 || pz + dd / 2 > b[3] - 4) continue;
        var rd0 = world.roadDist(px, pz);
        if (skip || rd0 < Math.max(w, dd) / 2 * 1.42 + 4) { // no building fits: the gap still gets something
          var free = true, lw = Math.min(w, Math.max(6, (rd0 - 3) * 1.3)), ld = Math.min(dd, Math.max(6, (rd0 - 3) * 1.3));
          if (rd0 < 7) continue;
          if (d.hill && Math.max(Math.abs(px - d.hill.x), Math.abs(pz - d.hill.z)) < d.hill.top / 2 + d.hill.steps * d.hill.run + 4) continue;
          for (var ti = 0; ti < taken.length; ti++) { var tt = taken[ti]; if (px + lw / 2 > tt[0] && px - lw / 2 < tt[2] && pz + ld / 2 > tt[1] && pz - ld / 2 < tt[3]) { free = false; break; } }
          if (free) { world.lot(d, px, pz, lw, ld, rng); taken.push([px - lw / 2, pz - ld / 2, px + lw / 2, pz + ld / 2]); }
          continue;
        }
        if (d.hill && Math.max(Math.abs(px - d.hill.x), Math.abs(pz - d.hill.z)) < d.hill.top / 2 + d.hill.steps * d.hill.run + dd) continue;
        var clash = false;
        for (var i = 0; i < taken.length; i++) { var t = taken[i]; if (px + w / 2 > t[0] && px - w / 2 < t[2] && pz + dd / 2 > t[1] && pz - dd / 2 < t[3]) { clash = true; break; } }
        if (clash) continue;
        world.addBuilding({ id: null, x: px, z: pz, w: w, d: dd, h: h, wall: wall, roof: roof }, d);
        world.fillers = world.fillers || []; world.fillers.push([px, pz, w, dd, d.id]);
      }
    },

    /** Every gap between buildings is a place: a park, a car park, a yard, a square. */
    lot: function (d, x, z, w, h, rng) {
      var g = world.geo(x, z, 'solid'), W = world.walk, x0 = x - w / 2, x1 = x + w / 2, z0 = z - h / 2, z1 = z + h / 2, i, c = world.collide;
      var kinds = { downtown: ['square', 'park', 'parking'], luxury: ['garden', 'pool', 'square'], suburbs: ['park', 'garden', 'pond', 'playground'], industrial: ['parking', 'yard', 'tanks'], harbour: ['yard', 'fishing'], airport: ['planes', 'park'], oldtown: ['square', 'park', 'market'] };
      var kind = rng.pick(kinds[d.id] || ['park']);
      function tree(px, pz) { world.prop(d, 'tree', px, 0, pz, rng, false); }
      if (kind === 'park' || kind === 'garden' || kind === 'pond' || kind === 'playground' || kind === 'pool') {
        W.tile(x0, z0, x1, z1, 0.015, kind === 'garden' ? 0x6ec85a : 0x7fd05c);
        W.tile(x0, z - 0.8, x1, z + 0.8, 0.016, 0xe6dcc2);
        for (i = 0; i < Math.max(2, Math.floor(w * h / 70)); i++) { var a = rng.range(x0 + 1.5, x1 - 1.5), b = rng.range(z0 + 1.5, z1 - 1.5); if (Math.abs(b - z) > 2) { if (kind === 'garden' && i % 2) world.prop(d, 'flowers', a, 0, b, rng, false); else tree(a, b); } }
        if (kind === 'pond' || kind === 'pool') { var r = Math.min(w, h) * 0.26; world.geo(x, z, 'neon').cyl(x, 0.02, z, r, 0.05, kind === 'pool' ? 0x4dd6ff : 0x3da8c8, 16); g.cyl(x, 0, z, r + 0.5, 0.05, 0xd8d4c9, 16); }
        if (kind === 'playground' && w > 9) { c.addBox(x - 2, 0, z + 2.4, 0.4, 3, 0.4); c.addBox(x + 2, 0, z + 2.4, 0.4, 3, 0.4); g.box(x - 2, 0, z + 2.4, 0.2, 3, 0.2, 0xff5a7a).box(x + 2, 0, z + 2.4, 0.2, 3, 0.2, 0xff5a7a).box(x, 3, z + 2.4, 4.3, 0.2, 0.2, 0xff5a7a).box(x - 0.8, 1, z + 2.4, 0.7, 0.1, 0.3, 0xffd24a).box(x + 0.8, 1, z + 2.4, 0.7, 0.1, 0.3, 0x4dabf7); }
      } else if (kind === 'square' || kind === 'market') {
        var sc = d.id === 'oldtown' ? 0xdab18a : d.id === 'luxury' ? 0xfff0f4 : 0xf3e6c2;
        W.tile(x0, z0, x1, z1, 0.015, sc);
        W.tile(x - 1.5, z0, x + 1.5, z1, 0.016, shade(sc, 0.86)); W.tile(x0, z - 1.5, x1, z + 1.5, 0.016, shade(sc, 0.86));
        if (kind === 'market') {
          for (i = 0; i < 3; i++) { var mx = x0 + (i + 0.5) * (w / 3), col = [0xe25c4f, 0xf2c14e, 0x4a90c2][i]; g.box(mx, 0, z, 2.4, 1, 1.4, 0xb98a5a); g.gable(mx, 2.8, z, 3.2, 0.9, 2.4, col, false); g.box(mx - 1.4, 0, z - 1, 0.14, 2.8, 0.14, 0x6b4d2c).box(mx + 1.4, 0, z + 1, 0.14, 2.8, 0.14, 0x6b4d2c); c.addBox(mx, 0, z, 2.4, 1, 1.4); }
        } else {
          g.cyl(x, 0, z, 2.2, 0.7, 0xe2dccb, 10).cyl(x, 0.7, z, 0.5, 2.2, 0xd2cab6, 8).cyl(x, 2.9, z, 1.1, 0.3, 0xe2dccb, 8);
          world.geo(x, z, 'neon').cyl(x, 0.7, z, 1.9, 0.05, 0x46b4f0, 10);
          c.addBox(x, 0, z, 3.2, 1.6, 3.2);
          world.fountains.push({ x: x, y: 0, z: z, district: d.id, small: 1 });
          world.prop(d, 'bench', x0 + 2, 0, z0 + 2, rng, false); world.prop(d, 'planter', x1 - 2, 0, z1 - 2, rng, false);
        }
      } else if (kind === 'parking') {
        W.tile(x0, z0, x1, z1, 0.015, 0x5a5e68);
        var cols = Math.max(1, Math.floor(w / 3.4));
        for (i = 0; i <= cols; i++) W.strip(x0 + i * w / cols, z0 + 0.5, x0 + i * w / cols, z0 + 5.5, 0.16, 0.016, 0xf2f2ea);
        for (i = 0; i < cols; i++) if (rng.next() < 0.7) {
          var px = x0 + (i + 0.5) * w / cols, pz = z0 + 3, cc = rng.pick([0xff4d4d, 0x3f83ff, 0xffd02e, 0x2ecf7a, 0xf4f4f4, 0xff8a1f, 0x37474f]);
          world.smashable(px, 0, pz, false, function () { g.box(px, 0.3, pz, 2, 0.7, 4.2, cc).box(px, 1, pz + 0.2, 1.75, 0.6, 2.2, 0x233a50).box(px, 1.6, pz + 0.2, 1.8, 0.1, 2.2, cc); }, 2, 1.6);
        }
      } else if (kind === 'yard' || kind === 'fishing') {
        W.tile(x0, z0, x1, z1, 0.015, kind === 'yard' ? 0x8d8f91 : 0xcbb688);
        for (i = 0; i < Math.max(3, Math.floor(w * h / 45)); i++) { var yk = kind === 'yard' ? rng.pick(['crate', 'barrel', 'pallet']) : rng.pick(['net', 'crate', 'barrel']); world.prop(d, yk, rng.range(x0 + 1.5, x1 - 1.5), 0, rng.range(z0 + 1.5, z1 - 1.5), rng, false); }
      } else if (kind === 'tanks') {
        W.tile(x0, z0, x1, z1, 0.015, 0x8d8f91);
        var tr = Math.min(w, h) * 0.2, tc = rng.pick([0xe9e4d8, 0xd9352c, 0x7a8aa0]);
        [[-1, 0], [1, 0]].forEach(function (s) { var tx = x + s[0] * w * 0.24; g.cyl(tx, 0, z, tr, h * 0.5 + 4, tc, 12).cyl(tx, h * 0.5 + 4, z, tr, 0.9, shade(tc, 0.85), 12, tr * 0.5); c.addBox(tx, 0, z, tr * 1.6, h * 0.5 + 4, tr * 1.6); world.aoRing(tx - tr, z - tr, tx + tr, z + tr, 2); });
        world.smokers = world.smokers || []; world.smokers.push({ x: x + w * 0.24, y: h * 0.5 + 6, z: z });
      } else if (kind === 'planes') {
        W.tile(x0, z0, x1, z1, 0.015, 0x77c95a);
        if (w > 12 && h > 12) { g.box(x, 1.2, z, 2.6, 2.6, 11, 0xffffff).box(x, 2, z - 0.6, 15, 0.3, 3, 0x3d8bd4).box(x, 3.4, z + 4.8, 0.3, 3.2, 2, 0xd9352c).box(x, 3.4, z + 4.8, 5, 0.25, 1.4, 0x3d8bd4).box(x, 0, z - 3, 0.4, 1.2, 0.4, 0x222222).box(x - 2.4, 0, z + 1, 0.4, 1.2, 0.4, 0x222222).box(x + 2.4, 0, z + 1, 0.4, 1.2, 0.4, 0x222222); c.addBox(x, 0, z, 3, 3.8, 11); }
      }
    },

    /** Gold rolls up a building you just bought, and banners drop down its face. */
    goldSweep: function (b, y) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.8, 1, b.d + 0.8), new THREE.MeshBasicMaterial({ color: 0xffc53d, transparent: true, opacity: 0.75, depthWrite: false }));
      m.position.set(b.x, y, b.z);
      world.runLayer.add(m);
      world.sweeps = world.sweeps || [];
      world.sweeps.push({ m: m, t: 0, h: b.h, y: y });
      // a coat of gold over the whole building: the windows still show through, the roof goes solid
      var coat = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.5, b.h + 0.4, b.d + 0.5), world.goldCoat || (world.goldCoat = new THREE.MeshLambertMaterial({ color: 0xffc53d, emissive: 0x9a6a00, emissiveIntensity: 0.55, transparent: true, opacity: 0.62, depthWrite: false })));
      coat.position.set(b.x, y + b.h / 2, b.z); coat.renderOrder = 1;
      world.runLayer.add(coat);
      var g = new TR.Geo(), n = Math.max(2, Math.floor(b.w / 9)), f = TrillionerLayout.frontOf(b), hh = Math.min(b.h * 0.72, 22);
      for (var i = 0; i < n; i++) {
        var u = -b.w / 2 + (i + 0.5) * (b.w / n);
        g.panel('s', b.x, b.z, b.w / 2, b.d / 2, 0.22, u, y + b.h - hh, 3, hh, 0xffc53d).panel('n', b.x, b.z, b.w / 2, b.d / 2, 0.22, u, y + b.h - hh, 3, hh, 0xffc53d);
        g.panel('s', b.x, b.z, b.w / 2, b.d / 2, 0.24, u, y + b.h - hh, 1, hh, 0xd9352c).panel('n', b.x, b.z, b.w / 2, b.d / 2, 0.24, u, y + b.h - hh, 1, hh, 0xd9352c);
      }
      world.runMesh(g, world.neonMat);
    },

    // Street props, one look per district, plus smaller decoration along the pavements.
    scatter: function (d, taken) {
      var rng = new Rng('props:' + d.id), b = d.land || d.bounds, under = d.level === 'under', y = under ? UY : 0, area = (b[2] - b[0]) * (b[3] - b[1]);
      var n = under ? 150 : Math.round(area / 620), tries = 0, placed = 0;
      while (placed < n && tries++ < n * 10) {
        var x = rng.range(b[0] + 3, b[2] - 3), z = rng.range(b[1] + 3, b[3] - 3), rd = under ? 8 : world.roadDist(x, z), green = d.id === 'suburbs' || d.id === 'luxury';
        if (rd < 3.2 || (!under && !green && rd > 7)) continue;
        var clash = false;
        for (var i = 0; i < taken.length; i++) { var t = taken[i]; if (x > t[0] && x < t[2] && z > t[1] && z < t[3]) { clash = true; break; } }
        if (clash) continue;
        var near = world.collide.near(x, z, 2.4, []).some(function (bx) { return !(bx.tag && bx.tag.hill) && x > bx.x0 - 2 && x < bx.x1 + 2 && z > bx.z0 - 2 && z < bx.z1 + 2; });
        if (near) continue;
        placed++;
        var kind = d.prop, pick = rng.next();
        if (!under && pick < 0.3) kind = world.EXTRA[d.id][rng.int(world.EXTRA[d.id].length)];
        world.prop(d, kind, x, y, z, rng, under);
      }
    },
    EXTRA: {
      downtown: ['planter', 'bench', 'bin', 'tree'], luxury: ['hedgeball', 'parasol', 'planter', 'tree'], suburbs: ['fence', 'mailbox', 'flowers', 'tree'],
      industrial: ['barrel', 'pallet', 'cone'], harbour: ['crate', 'barrel', 'net'], airport: ['cone', 'sign'], oldtown: ['barrel', 'flowers', 'bench', 'tree']
    },
    /** A prop the monster truck can flatten. It gets its own vertex range and a tagged collision box. */
    smashable: function (x, y, z, under, draw, size, h) {
      var id = 'p' + (world.propN = (world.propN || 0) + 1);
      world.tracked(id, x, z, under, draw);
      world.buildingBoxes[id] = world.collide.addBox(x, y, z, size, h, size, { prop: id });
    },
    smash: function (id) { world.setBuildingGone(id, true); },
    prop: function (d, kind, x, y, z, rng, under) {
      var g = world.geo(x, z, 'solid', under), n = world.geo(x, z, 'neon', under), c = world.collide;
      if (kind === 'tree') {
        var th = rng.range(2.6, 3.6), leaf = rng.pick(d.id === 'oldtown' ? [0x6fa84a, 0x8ab04a] : [0x4cb84c, 0x5fc95a, 0x3daa4e, 0x74cf58]);
        g.cyl(x, y, z, 0.42, th, 0x7a5230, 6, 0.3);
        g.blob(x, y + th + 0.9, z, 2.2, 1.9, 2.2, leaf).blob(x + 0.7, y + th + 2.3, z - 0.4, 1.5, 1.3, 1.5, shade(leaf, 1.12)).blob(x - 1.1, y + th + 0.5, z + 0.9, 1.25, 1.1, 1.25, shade(leaf, 0.9));
        c.addBox(x, y, z, 0.7, th, 0.7);
        if (!under) world.aoRing(x - 1.2, z - 1.2, x + 1.2, z + 1.2, 1.5, 0.26);
      } else if (kind === 'palm') {
        g.cyl(x, y, z, 0.42, 7.4, 0xb58a5a, 6, 0.24);
        for (var i = 0; i < 7; i++) { var a = i / 7 * 6.283; g.box(x + Math.cos(a) * 1.7, y + 7.2 - (i % 2) * 0.3, z + Math.sin(a) * 1.7, 3.8, 0.2, 1, i % 2 ? 0x37b667 : 0x4fcf7c, -a); }
        c.addBox(x, y, z, 0.7, 7, 0.7);
      } else if (kind === 'lamp') {
        world.smashable(x, y, z, under, function () { g.box(x, y, z, 0.7, 0.5, 0.7, 0x2c2f3a).box(x, y, z, 0.26, 6.4, 0.26, 0x3a3f4c).box(x + 0.8, y + 6.3, z, 1.9, 0.16, 0.26, 0x3a3f4c); n.box(x + 1.5, y + 5.95, z, 0.9, 0.34, 0.6, 0xfff2c0); }, 0.5, 6);
      } else if (kind === 'lantern') {
        world.smashable(x, y, z, under, function () { g.box(x, y, z, 0.22, 4, 0.22, 0x2f2118).box(x, y + 4, z, 1, 0.14, 1, 0x2f2118).box(x, y + 5.15, z, 1, 0.14, 1, 0x2f2118); n.box(x, y + 4.14, z, 0.72, 1, 0.72, 0xffb347); }, 0.4, 4);
      } else if (kind === 'crate') {
        var cs = rng.range(1.4, 2.4), cc = rng.pick([0xc0915a, 0xa97c49, 0x8d6e4b]);
        world.smashable(x, y, z, under, function () { g.box(x, y, z, cs, cs, cs, cc).box(x, y + cs * 0.45, z, cs + 0.08, cs * 0.1, cs + 0.08, shade(cc, 0.7)); }, cs, cs);
      } else if (kind === 'bollard') {
        world.smashable(x, y, z, under, function () { g.cyl(x, y, z, 0.42, 1.1, 0x2a3442, 8, 0.32).cyl(x, y + 1.1, z, 0.46, 0.2, 0xf2c14e, 8); }, 0.8, 1.2);
      } else if (kind === 'beacon') {
        g.box(x, y, z, 0.2, 2.2, 0.2, 0xf4f4f4).box(x, y + 1, z, 0.22, 0.4, 0.22, 0xe0442f); n.box(x, y + 2.2, z, 0.5, 0.5, 0.5, 0xff4a30);
        c.addBox(x, y, z, 0.4, 2.6, 0.4);
      } else if (kind === 'mushroom') {
        var h = rng.range(2, 6), mc = rng.pick([0xc77dff, 0x7dffea, 0xff7de9]);
        g.cyl(x, y, z, 0.5, h, 0xe6dcf5, 7, 0.32); n.cyl(x, y + h, z, h * 0.72, h * 0.32, mc, 9, 0.12);
        c.addBox(x, y, z, 0.8, h, 0.8);
      } else if (kind === 'planter') {
        world.smashable(x, y, z, under, function () { g.box(x, y, z, 3, 0.8, 1.4, 0xbfb7a4).box(x, y + 0.8, z, 2.7, 0.7, 1.1, 0x4fbf5a); for (var k = 0; k < 5; k++) g.box(x - 1.1 + k * 0.55, y + 1.5, z + (k % 2 ? 0.2 : -0.2), 0.3, 0.3, 0.3, [0xff5a7a, 0xffd24a, 0xffffff][k % 3]); }, 2, 1.4);
      } else if (kind === 'bench') {
        world.smashable(x, y, z, under, function () { g.box(x, y + 0.55, z, 3, 0.16, 0.8, 0x9c6b3d).box(x, y + 1, z - 0.36, 3, 0.5, 0.12, 0x9c6b3d).box(x - 1.2, y, z, 0.2, 0.55, 0.7, 0x333842).box(x + 1.2, y, z, 0.2, 0.55, 0.7, 0x333842); }, 1.5, 1);
      } else if (kind === 'bin') {
        world.smashable(x, y, z, under, function () { g.cyl(x, y, z, 0.42, 1.2, 0x3f7a55, 8, 0.48).cyl(x, y + 1.2, z, 0.52, 0.12, 0x2c5a3e, 8); }, 0.8, 1.2);
      } else if (kind === 'hedgeball') {
        world.smashable(x, y, z, under, function () { g.box(x, y, z, 1, 0.8, 1, 0xfff4f7).blob(x, y + 1.6, z, 1.05, 1.05, 1.05, 0x3daa4e); }, 1, 1.5);
      } else if (kind === 'parasol') {
        g.box(x, y, z, 0.14, 3, 0.14, 0xffffff).cyl(x, y + 2.7, z, 2.2, 0.8, rng.pick([0xff7aa2, 0xffffff, 0xffd24a]), 8, 0.15);
        c.addBox(x, y, z, 0.4, 3, 0.4);
      } else if (kind === 'fence') {
        for (var fi = 0; fi < 6; fi++) g.box(x + fi * 0.8 - 2, y, z, 0.26, 1.1, 0.12, 0xffffff);
        g.box(x, y + 0.7, z, 4.6, 0.14, 0.1, 0xffffff);
        c.addBox(x, y, z, 4.8, 1.1, 0.3);
      } else if (kind === 'mailbox') {
        g.box(x, y, z, 0.16, 1, 0.16, 0x8d6e4b).box(x, y + 1, z, 0.5, 0.42, 0.9, rng.pick([0xe0442f, 0x2f8fd0, 0xffffff]));
        c.addBox(x, y, z, 0.5, 1.4, 0.8);
      } else if (kind === 'flowers') {
        for (var fl = 0; fl < 9; fl++) { var fx = x + rng.range(-1.2, 1.2), fz = z + rng.range(-1.2, 1.2); g.box(fx, y, fz, 0.1, 0.45, 0.1, 0x3daa4e).box(fx, y + 0.45, fz, 0.32, 0.26, 0.32, rng.pick([0xff5a7a, 0xffd24a, 0xffffff, 0xc77dff])); }
      } else if (kind === 'barrel') {
        var bc = rng.pick([0xc0602f, 0x2f6fb5, 0x6d7278, 0x8d6e4b]);
        world.smashable(x, y, z, under, function () { g.cyl(x, y, z, 0.62, 1.6, bc, 9).cyl(x, y + 0.45, z, 0.65, 0.12, shade(bc, 0.7), 9).cyl(x, y + 1.1, z, 0.65, 0.12, shade(bc, 0.7), 9); }, 1.1, 1.6);
      } else if (kind === 'pallet') {
        world.smashable(x, y, z, under, function () { g.box(x, y, z, 2.2, 0.22, 2.2, 0xa97c49).box(x, y + 0.22, z, 1.9, 1, 1.9, rng.pick([0xe9d8b8, 0x7a8aa0, 0xb07f4a])); }, 2, 1.2);
      } else if (kind === 'cone') {
        world.smashable(x, y, z, under, function () { g.box(x, y, z, 0.9, 0.1, 0.9, 0x222222).cyl(x, y + 0.1, z, 0.36, 0.95, 0xff7a1a, 8, 0.05).cyl(x, y + 0.45, z, 0.26, 0.2, 0xffffff, 8, 0.2); }, 0.7, 1);
      } else if (kind === 'net') {
        g.box(x, y, z, 2.4, 0.34, 2.4, 0x5f7f6a).box(x + 0.2, y + 0.34, z, 1.4, 0.26, 1.5, 0x7f9f8a).cyl(x - 0.8, y + 0.3, z + 0.7, 0.3, 0.5, 0xffd24a, 7);
        c.addBox(x, y, z, 2.4, 0.6, 2.4);
      } else if (kind === 'sign') {
        g.box(x, y, z, 0.16, 2.4, 0.16, 0x777b80).box(x, y + 2, z, 2.2, 1, 0.1, 0xffd24a);
        c.addBox(x, y, z, 0.4, 3, 0.4);
      }
    },

    buildUnder: function (d) {
      var b = d.bounds, g, y = UY;
      for (var x = b[0]; x < b[2]; x += CHUNK) for (var z = b[1]; z < b[3]; z += CHUNK) {
        var cx = x + CHUNK / 2, cz = z + CHUNK / 2;
        g = world.geo(cx, cz, 'flat', true);
        var ur = new Rng('u:' + x + ',' + z), art = GROUND.under;
        for (var ti = 0; ti < CHUNK; ti += art.size) for (var tj = 0; tj < CHUNK; tj += art.size) g.tile(x + ti, z + tj, x + ti + art.size, z + tj + art.size, y, ur.pick(art.colors));
        g.box(cx, y + 34, cz, CHUNK, 2, CHUNK, 0x1c1030);
      }
      var c = world.collide, h = 40;
      c.add(b[0] - 4, y, b[1], b[0], y + h, b[3]); c.add(b[2], y, b[1], b[2] + 4, y + h, b[3]); c.add(b[0], y, b[1] - 4, b[2], y + h, b[1]); c.add(b[0], y, b[3], b[2], y + h, b[3] + 4);
      var taken = [];
      (d.buildings || []).forEach(function (bb) {
        world.tracked(bb.id, bb.x, bb.z, true, function () { world.addBuilding(bb, d, UY, true); world.door(bb, d, true); });
        if (!bb.plain) world.usigns.add(bb.name, bb, d, UY);
        taken.push([bb.x - bb.w / 2 - 8, bb.z - bb.d / 2 - 8, bb.x + bb.w / 2 + 8, bb.z + bb.d / 2 + 8]);
      });
      (d.stairs || []).forEach(function (st) { world.stair(st, d, UY, true); taken.push([st.x - 8, st.z - 8, st.x + 8, st.z + 8]); });
      (d.landmarks || []).forEach(function (l) { world.landmark(l, d, true); taken.push([l.x - 70, l.z - 5, l.x + 70, l.z + 5]); });
      // festival lights strung across the cavern market
      for (var li = 0; li < 46; li++) {
        var lx = -130 + li * 6, ln = world.geo(lx, 60, 'neon', true);
        ln.box(lx, y + 15 + Math.sin(li * 0.6) * 2, 62, 0.8, 0.8, 0.8, [0xffd24a, 0xff7de9, 0x7dffea, 0xc77dff][li % 4]);
        ln = world.geo(lx, 20, 'neon', true);
        ln.box(lx, y + 15 + Math.cos(li * 0.6) * 2, 20, 0.8, 0.8, 0.8, [0xff7de9, 0xffd24a, 0xc77dff, 0x7dffea][li % 4]);
      }
      // the lake
      if (d.lake) { world.geo(d.lake.x, d.lake.z, 'neon', true).cyl(d.lake.x, y + 0.1, d.lake.z, d.lake.r, 0.05, 0x3da8c8, 24); taken.push([d.lake.x - d.lake.r, d.lake.z - d.lake.r, d.lake.x + d.lake.r, d.lake.z + d.lake.r]); }
      // cavern pillars and platforms: the city's old foundations
      var rng = new Rng('under'), n = 0, tries = 0;
      while (n < 90 && tries++ < 600) {
        var px = rng.range(-340, 340), pz = rng.range(-340, 340), s = rng.range(5, 14), clash = false;
        for (var i = 0; i < taken.length; i++) { var t = taken[i]; if (px + s > t[0] && px - s < t[2] && pz + s > t[1] && pz - s < t[3]) { clash = true; break; } }
        if (clash) continue;
        n++;
        world.geo(px, pz, 'solid', true).cyl(px, y, pz, s, 36, rng.pick(d.walls), 7, s * 0.7);
        c.addBox(px, y, pz, s * 1.4, 36, s * 1.4);
      }
      world.scatter(d, taken);
      // the deepest level: a separate floor reached by the Mole Machine
      var DY = D.DEEP_Y, g2 = world.geo(0, -180, 'flat', true);
      g2.box(0, DY - 2, -180, 90, 2, 60, 0x4a2a10);
      g2.box(0, DY + 16, -180, 90, 2, 60, 0x2a1a08);
      c.add(-50, DY, -214, 50, DY + 18, -210); c.add(-50, DY, -150, 50, DY + 18, -146); c.add(-49, DY, -214, -45, DY + 18, -146); c.add(45, DY, -214, 49, DY + 18, -146);
      for (i = 0; i < 12; i++) { var vx = -40 + i * 7.2; world.geo(vx, -205, 'neon', true).box(vx, DY, -205, 1.2, 8 + (i % 3) * 3, 1.2, 0xffd24a); }
      // the wall the Mole Machine digs through, plainly marked
      var w = world.geo(0, -120, 'solid', true);
      w.box(0, y, -128, 30, 20, 3, 0x6b4d2c);
      for (i = 0; i < 3; i++) world.geo(0, -120, 'neon', true).box(-8 + i * 8, y + 6, -126.3, 5, 5, 0.2, 0xff3b30);
      world.moleWall = { x: 0, y: y, z: -126 };
      c.addBox(0, y, -128, 30, 20, 3);
    },
    // Things that move or change every frame: one extra mesh each.
    animated: function () {
      // The clock tower's face always shows the in-game time.
      var ct = world.clockTower, cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
      world.clockCtx = cv.getContext('2d');
      world.clockTex = new THREE.CanvasTexture(cv); world.clockTex.encoding = THREE.sRGBEncoding;
      var mat = new THREE.MeshBasicMaterial({ map: world.clockTex });
      [[0, 0, 6.6, 0], [0, 0, -6.6, Math.PI], [6.6, 0, 0, Math.PI / 2], [-6.6, 0, 0, -Math.PI / 2]].forEach(function (f) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), mat);
        m.position.set(ct.x + f[0], ct.h - 8, ct.z + f[2]); m.rotation.y = f[3];
        world.surface.add(m);
      });
      // Headlines on city screens
      var sv = document.createElement('canvas'); sv.width = 512; sv.height = 256;
      world.screenCtx = sv.getContext('2d');
      world.screenTex = new THREE.CanvasTexture(sv); world.screenTex.encoding = THREE.sRGBEncoding;
      world.screens.forEach(function (l) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(l.w, l.w / 2), new THREE.MeshBasicMaterial({ map: world.screenTex, side: THREE.DoubleSide }));
        m.position.set(l.x, l.h + l.w / 4, l.z);
        world.surface.add(m);
      });
      world.headline('SPEND MORE');
      // The big rocket on its pad
      var rb = world.rocketBase, g = new THREE.Group(), rg = new TR.Geo();
      rg.cyl(0, 2, 0, 6, rb.h * 0.62, 0xffffff, 12).cyl(0, 2 + rb.h * 0.62, 0, 6, rb.h * 0.28, 0xd9352c, 12, 0.4);
      rg.box(-8, 2, 0, 4, 18, 1.4, 0xd9352c).box(8, 2, 0, 4, 18, 1.4, 0xd9352c).box(0, 2, -8, 1.4, 18, 4, 0xd9352c).box(0, 2, 8, 1.4, 18, 4, 0xd9352c);
      var rm = rg.mesh(world.solid, true, false); rm.matrixAutoUpdate = true;
      g.add(rm); g.position.set(rb.x, 0, rb.z);
      world.surface.add(g);
      world.rocket = g;
    },
    headline: function (text) {
      var c = world.screenCtx; if (!c) return;
      c.fillStyle = '#10163a'; c.fillRect(0, 0, 512, 256);
      c.fillStyle = '#ffc53d'; c.textAlign = 'center'; c.textBaseline = 'middle';
      var words = String(text).split(' '), lines = [], cur = '';
      c.font = '900 56px Arial Black, Arial';
      words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > 480) { lines.push(cur); cur = w; } else cur = t; });
      lines.push(cur);
      lines.slice(0, 3).forEach(function (l, i, a) { c.fillText(l, 256, 128 + (i - (a.length - 1) / 2) * 66); });
      world.screenTex.needsUpdate = true;
    },
    drawClock: function (hour) {
      var c = world.clockCtx, S = 128;
      c.fillStyle = '#fff6e0'; c.beginPath(); c.arc(64, 64, 62, 0, 7); c.fill();
      c.strokeStyle = '#3a2115'; c.lineWidth = 5; c.stroke();
      for (var i = 0; i < 12; i++) { var a = i / 12 * 6.283; c.fillStyle = '#3a2115'; c.fillRect(64 + Math.sin(a) * 52 - 2, 64 - Math.cos(a) * 52 - 2, 4, 4); }
      function hand(frac, len, w) { c.lineWidth = w; c.beginPath(); c.moveTo(64, 64); var a = frac * 6.283; c.lineTo(64 + Math.sin(a) * len, 64 - Math.cos(a) * len); c.stroke(); }
      hand((hour % 12) / 12, 32, 6);
      hand((hour % 1), 48, 4);
      world.clockTex.needsUpdate = true;
    },

    /** Far chunks drop their window detail and everything past the fog is culled by the camera's far plane. */
    lod: function (pos, camera) {
      var q = (TR.settings && TR.settings.windows) || 340, keys = Object.keys(world.meshes);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k.charAt(0) !== 's' || k.indexOf(':window') < 0) continue;
        var m = world.meshes[k], c = m.geometry.boundingSphere.center;
        m.visible = Math.hypot(c.x - pos.x, c.z - pos.z) < q;
      }
      camera.far = Math.max(300, world.scene.fog.far * 1.1);
      camera.updateProjectionMatrix();
    },
    /** Which space is drawn: the surface, the Under City, or a room (neither). */
    setSpace: function (space) {
      if (world.space === space) return;
      world.space = space;
      world.surface.visible = space === 'surface';
      world.under.visible = space === 'under';
    },

    /** Water at this point of the surface? */
    isWater: function (x, z) {
      if (x > 3000) return false;
      if (Math.abs(x) > 360 || Math.abs(z) > 360) return true;
      if (x >= 120 && z >= 120) return !(x < 306 && z < 282);
      return false;
    },
    districtAt: function (x, z, y) {
      if (y < -20) return 'under';
      var ids = Object.keys(D.DISTRICTS);
      for (var i = 0; i < ids.length; i++) {
        var d = D.DISTRICTS[ids[i]], b = d.bounds;
        if (d.level === 'under') continue;
        if (x >= b[0] && x < b[2] && z >= b[1] && z < b[3]) return d.id;
      }
      return null;
    },

    /** Sky, sun and window lights for an hour of the clock. */
    setTime: function (hour, weather, target, frantic) {
      if (Math.floor(hour * 60) !== world.lastMinute) { world.lastMinute = Math.floor(hour * 60); world.drawClock(hour); }
      if (world.space !== 'surface') {
        var under = world.space === 'under', uc = new THREE.Color(under ? 0x241542 : 0x14162a);
        world.scene.background = uc; world.scene.fog.color.copy(uc);
        world.scene.fog.near = under ? 80 : 2000; world.scene.fog.far = under ? 340 : 4000;
        world.hemi.color.setHex(under ? 0xd8b8ff : 0xfff4e4); world.hemi.groundColor.setHex(under ? 0x4a2f7a : 0xb9a58c);
        world.hemi.intensity = under ? 1.05 : 1;
        world.sun.intensity = under ? 0.25 : 0.32;
        world.sun.color.setHex(0xfff0dc);
        world.windowMat.emissiveIntensity = 1.5;
        world.neonMat.color.setScalar(under ? 1.9 : 1.3);
        world.sky.visible = false;
        world.sun.position.set(target.x + 30, target.y + 140, target.z + 30); world.sun.target.position.set(target.x, target.y, target.z);
        return;
      }
      world.sky.visible = true;
      world.scene.background = null;
      var k0 = SKY[0], k1 = SKY[1];
      for (var i = 0; i < SKY.length - 1; i++) if (hour >= SKY[i].h && hour < SKY[i + 1].h) { k0 = SKY[i]; k1 = SKY[i + 1]; break; }
      var f = (hour - k0.h) / (k1.h - k0.h), top = world.skyU.top.value, hor = world.skyU.hor.value;
      top.copy(k0.top).lerp(k1.top, f); hor.copy(k0.hor).lerp(k1.hor, f);
      var sunCol = world.skyU.sunCol.value.copy(k0.sun).lerp(k1.sun, f), si = k0.si + (k1.si - k0.si) * f, am = k0.am + (k1.am - k0.am) * f, glow = k0.glow + (k1.glow - k0.glow) * f;
      var fogNear = 200, fogFar = 760;
      if (frantic) { hor.lerp(new THREE.Color(0xff3b5c), 0.22 + Math.sin(performance.now() * 0.004) * 0.06); top.lerp(new THREE.Color(0x4a1030), 0.2); }
      if (weather === 'fog') { var fg = new THREE.Color(0xaeb6bc).multiplyScalar(Math.max(0.1, Math.min(1, si / 1.1))); hor.lerp(fg, 0.75); top.lerp(fg, 0.6); si *= 0.6; fogNear = 60; fogFar = 300; }
      if (weather === 'rain') { var dim = Math.max(0.12, Math.min(1, si / 1.1)), rn = new THREE.Color(0x76859a).multiplyScalar(dim); hor.lerp(rn, 0.7); top.lerp(new THREE.Color(0x4a586c).multiplyScalar(dim), 0.8); si *= 0.5; fogNear = 90; fogFar = 420; }
      var q = (TR.settings && TR.settings.drawDist) || 1;
      world.scene.fog.color.copy(hor);
      world.scene.fog.near += (fogNear * q - world.scene.fog.near) * 0.04;
      world.scene.fog.far += (fogFar * q - world.scene.fog.far) * 0.04;
      world.hemi.color.copy(top).lerp(new THREE.Color(0xffffff), 0.55);
      world.hemi.groundColor.setHex(0xb7a58c);
      world.hemi.intensity = am;
      world.sun.intensity = si; world.sun.color.copy(sunCol);
      world.windowMat.emissiveIntensity = glow * 1.7;
      world.neonMat.color.setScalar(1 + glow * 1.5);
      if (world.cloudMat) { world.cloudMat.emissive.copy(hor).lerp(top, 0.2); world.cloudMat.emissiveIntensity = 0.55; }
      // the sun rises east (+x) and sets west; at night the same light is the moon
      var a = hour >= 6 && hour < 19 ? (hour - 6) / 13 * Math.PI : ((hour + 5) % 24) / 11 * Math.PI, sx = Math.cos(a), sy = Math.max(0.28, Math.sin(a));
      world.skyU.sunDir.value.set(sx, Math.max(0.1, Math.sin(a)), 0.3).normalize();
      world.skyU.night.value = glow > 0.7 ? glow : 0;
      var ox = Math.round(target.x / 8) * 8, oz = Math.round(target.z / 8) * 8;  // snapped so shadows do not shimmer
      world.sun.position.set(ox + sx * 170, sy * 240, oz + 80);
      world.sun.target.position.set(ox, 0, oz);
    },

    update: function (dt, t) {
      if (world.sea) {
        world.sea.position.y = -1.6 + Math.sin(t * 0.8) * 0.12;
        world.waterTex.offset.set(t * 0.012, t * 0.007);
      }
      if (world.sky && TR.app.camera) world.sky.position.copy(TR.app.camera.position);
      if (world.clouds) world.clouds.position.x = (t * 1.6) % 300 - 150;
      (world.sweeps || []).forEach(function (w) {
        w.t += dt;
        var k = Math.min(1, w.t / 0.9);
        w.m.scale.y = Math.max(0.01, w.h * k); w.m.position.y = w.y + w.h * k / 2;
        w.m.material.opacity = w.t < 0.9 ? 0.75 : Math.max(0, 0.75 - (w.t - 0.9) * 1.2);
        if (w.t > 1.6) { w.m.visible = false; }
      });
      if (world.sweeps) world.sweeps = world.sweeps.filter(function (w) { return w.t <= 1.6; });
      if (world.rocketFlying) {
        world.rocketFlying += dt;
        var tf = world.rocketFlying;
        world.rocket.position.y = tf * tf * 6;
        for (var i = 0; i < 6; i++) TR.fx.spawn(world.rocket.position.x + (Math.random() - 0.5) * 8, world.rocket.position.y, world.rocket.position.z + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14, -18, (Math.random() - 0.5) * 14, i % 2 ? 0xff7a1a : 0xffd24a, 1.2, 2.6, 0);
        if (tf > 14) { world.rocketFlying = 0; world.rocket.visible = false; }
      }
    }
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
    var lum = (((color >> 16) & 255) * 0.299 + ((color >> 8) & 255) * 0.587 + (color & 255) * 0.114) / 255, dark = lum > 0.55;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    var face = ['900 %px Impact, "Arial Narrow", Arial, sans-serif', 'italic 700 %px Georgia, "Times New Roman", serif', '700 %px "Helvetica Neue", Arial, sans-serif', '700 %px "American Typewriter", Georgia, serif'][this.i % 4], fs = 70;
    c.font = face.replace('%', fs);
    while (c.measureText(text).width > this.cw - 30 && fs > 22) { fs -= 2; c.font = face.replace('%', fs); }
    c.fillStyle = dark ? '#16171c' : '#f4efe2';
    c.fillText(text, x + this.cw / 2, y + this.ch / 2 + 2);
    var s = this.size;
    return { u0: (x + 2) / s, u1: (x + this.cw - 2) / s, v0: 1 - (y + this.ch - 2) / s, v1: 1 - (y + 2) / s };
  };
  /** A sign quad facing +z (rot 0), rotated about y. Double sided via the material. */
  SignAtlas.prototype.addFlat = function (text, x, y, z, w, h, color, rot) {
    var uv = this.cell(text, color), cos = Math.cos(rot || 0), sin = Math.sin(rot || 0), n = this.p.length / 3, hw = w / 2, hh = h / 2;
    [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(function (c, i) {
      this.p.push(x + c[0] * cos, y + c[1], z - c[0] * sin);
      this.uv.push(i === 0 || i === 3 ? uv.u0 : uv.u1, i < 2 ? uv.v0 : uv.v1);
    }, this);
    this.index.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  SignAtlas.prototype.add = function (name, b, d, base) {
    var color = b.boarded ? 0x5b4a3a : (d.neon || 0xffc53d), f = TrillionerLayout.frontOf(b), y = b.y != null ? b.y : (base || 0);
    // a sign over the door, the size a shop would pay for
    var h = Math.min(b.h < 12 ? 1.5 : 1.9, b.h * 0.2), w = Math.min((f.nz ? b.w : b.d) * 0.72, h * 8), sy = y + Math.min(b.h - h * 0.6 - 0.4, 5.45 + h / 2);
    if (f.nz) this.addFlat(name, f.x, sy, b.z + f.nz * (b.d / 2 + 0.3), w, h, color, f.nz > 0 ? 0 : Math.PI);
    else this.addFlat(name, b.x + f.nx * (b.w / 2 + 0.3), sy, f.z, w, h, color, f.nx > 0 ? Math.PI / 2 : -Math.PI / 2);
  };
  SignAtlas.prototype.mesh = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.index);
    var tex = new THREE.CanvasTexture(this.canvas);
    tex.anisotropy = 16; tex.encoding = THREE.sRGBEncoding;
    var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }));
    m.frustumCulled = false;
    return m;
  };
  TR.SignAtlas = SignAtlas;
})();
