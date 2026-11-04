/* The stuff a real street is full of: traffic lights, parked cars, bins, hydrants, rooftop clutter, billboards for things nobody needs. */
(function () {
  var TR = window.TR = window.TR || {};
  var D = window.TRD.districts;
  var MAX_PARKED = 50, CARS = [0x2b2d33, 0x8c8f94, 0xd8d8d4, 0x5a1f22, 0x1e2f4a, 0x3f4a3c, 0x6b5b45, 0xb9b4a8];
  // Every ad is for something a billionaire would buy, or something nobody should.
  var ADS = [
    ['#101820', '#f2c230', 'EASY LOANS', 'You cannot afford not to.'],
    ['#c8102e', '#ffffff', 'SENATOR KRUMB', 'He can be bought. Ask how!'],
    ['#f4f1e8', '#17181c', 'DR. GLOSS', 'Teeth they can see from orbit'],
    ['#0a5c5a', '#f4f1e8', 'NOTHING WATER', 'Now with less of everything'],
    ['#17181c', '#ff4a3d', 'BURGER EMPIRE', 'The meat is legally meat'],
    ['#2b2d6e', '#ffffff', 'TAX? WHAT TAX?', 'Offshore Friends LLC'],
    ['#e8e2d0', '#a3271f', 'YOUR FACE HERE', 'Only $4,000,000,000'],
    ['#222428', '#7dd3fc', 'PHONE FOR YOUR PHONE', 'It has been a long day for it']
  ];

  function adAtlas() {
    var c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
    var g = c.getContext('2d');
    ADS.forEach(function (a, i) {
      var x = (i % 2) * 512, y = Math.floor(i / 2) * 256;
      g.fillStyle = a[0]; g.fillRect(x, y, 512, 256);
      g.fillStyle = a[1]; g.textAlign = 'left'; g.textBaseline = 'middle';
      var fs = 74; g.font = '900 ' + fs + 'px Impact, "Arial Narrow", Arial, sans-serif';
      while (g.measureText(a[2]).width > 470 && fs > 30) { fs -= 2; g.font = '900 ' + fs + 'px Impact, "Arial Narrow", Arial, sans-serif'; }
      g.fillText(a[2], x + 22, y + 104);
      g.font = 'italic 600 28px Georgia, serif';
      g.fillText(a[3], x + 22, y + 186);
      g.fillStyle = 'rgba(0,0,0,.12)'; for (var k = 0; k < 7; k++) g.fillRect(x + 73 * k, y, 2, 256);   // paper seams
    });
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    return t;
  }
  function roads() {
    var out = [];
    D.ROADS.forEach(function (r) { for (var i = 1; i < r.pts.length; i++) out.push({ a: r.pts[i - 1], b: r.pts[i], w: r.w }); });
    return out;
  }
  function free(x, z, r) {
    var W = TR.world;
    if (W.isWater(x, z) || W.collide.near(x, z, r, []).some(function (b) { return b.y0 > -5 && b.y0 < 3 && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r; })) return false;
    return !D.ROADS.some(function (R) {
      for (var i = 1; i < R.pts.length; i++) {
        var a = R.pts[i - 1], b = R.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
        if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < R.w / 2 + 0.6) return true;
      }
    });
  }

  function distToSeg(x, z, s) {
    var dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], t = Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - s.a[0] - dx * t, z - s.a[1] - dz * t);
  }
  /** Doors have to stay reachable. */
  function nearDoor(x, z) {
    return Object.keys(D.DISTRICTS).some(function (k) {
      return (D.DISTRICTS[k].buildings || []).some(function (b) {
        if (!b.enter || (b.y != null && b.y < -5)) return false;
        var f = window.TrillionerLayout.frontOf(b);
        return Math.hypot(f.x - x, f.z - z) < 8;
      });
    });
  }

  var st = TR.street = {
    /** A parked car, cheap enough to have hundreds of. Faces along (ux,uz). */
    parked: function (x, z, ux, uz, color) {
      st.cars.push({ x: x, z: z, h: Math.atan2(-ux, -uz), c: color });
      TR.world.collide.addBox(x, 0, z, Math.abs(ux) > 0.5 ? 5.4 : 2.5, 1.7, Math.abs(ux) > 0.5 ? 2.5 : 5.4);
    },
    /** Only the nearest are drawn, so a city full of parked cars costs what fifty do. */
    update: function (dt, pos, hidden) {
      st.t = (st.t || 0) - dt;
      if (!st.mesh) return;
      st.mesh.visible = !hidden;
      if (st.t > 0 || hidden) return;
      st.t = 0.6;
      var near = st.cars.map(function (q) { return { q: q, d: (q.x - pos.x) * (q.x - pos.x) + (q.z - pos.z) * (q.z - pos.z) }; }).sort(function (a, b) { return a.d - b.d; }).slice(0, MAX_PARKED), o = new THREE.Object3D(), col = new THREE.Color();
      near.forEach(function (e, i) {
        o.position.set(e.q.x, 0, e.q.z); o.rotation.set(0, e.q.h, 0); o.updateMatrix();
        st.mesh.setMatrixAt(i, o.matrix); st.mesh.setColorAt(i, col.setHex(e.q.c));
      });
      st.mesh.count = near.length;
      st.mesh.instanceMatrix.needsUpdate = true;
      if (st.mesh.instanceColor) st.mesh.instanceColor.needsUpdate = true;
    },
    trafficLight: function (g, n, x, z, nx, nz) {
      g.cyl(x, 0, z, 0.1, 5.4, 0x2a2c30, 8);
      g.box(x + nx * 1.4, 5.2, z + nz * 1.4, Math.abs(nx) * 2.8 + 0.12, 0.12, Math.abs(nz) * 2.8 + 0.12, 0x2a2c30);
      var hx = x + nx * 2.6, hz = z + nz * 2.6;
      g.box(hx, 4.1, hz, 0.42, 1.14, 0.42, 0x17181c);
      n.box(hx, 4.86, hz - 0.22, 0.24, 0.24, 0.02, 0xc4241c).box(hx, 4.5, hz - 0.22, 0.24, 0.24, 0.02, 0x4a3c10).box(hx, 4.16, hz - 0.22, 0.24, 0.24, 0.02, 0x1a5a2c);
      TR.world.collide.addBox(x, 0, z, 0.3, 5, 0.3);
    },
    furniture: function (g, x, z, rng) {
      var r = rng.next();
      if (r < 0.34) { g.cyl(x, 0, z, 0.3, 1, 0x3a3f3a, 10); g.cyl(x, 1, z, 0.33, 0.06, 0x23262a, 10); }         // bin
      else if (r < 0.56) { g.cyl(x, 0, z, 0.15, 0.68, 0xa8291f, 8); g.cyl(x, 0.68, z, 0.09, 0.14, 0xc8c8c0, 6); } // hydrant
      else if (r < 0.8) { g.box(x, 0, z, 0.72, 1.3, 0.56, rng.pick([0x234a7a, 0xa8291f, 0x2a6a4a, 0xc9a227])); g.box(x, 0.84, z - 0.29, 0.56, 0.34, 0.02, 0xb9c8d0); } // newspaper box
      else { g.box(x, 0.48, z, 1.9, 0.09, 0.5, 0x4a3524); g.box(x, 0.48, z + 0.22, 1.9, 0.5, 0.08, 0x4a3524); g.box(x - 0.8, 0, z, 0.08, 0.5, 0.4, 0x222222); g.box(x + 0.8, 0, z, 0.08, 0.5, 0.4, 0x222222); } // bench
      TR.world.collide.addBox(x, 0, z, 0.7, 1.2, 0.7);
    },
    /** Air conditioners, tanks and vents: every flat roof in a real city is a mess. */
    roofClutter: function (g, x, top, z, w, d, rng) {
      var n = 2 + rng.int(4);
      for (var i = 0; i < n; i++) {
        var px = x + rng.range(-w * 0.34, w * 0.34), pz = z + rng.range(-d * 0.34, d * 0.34), k = rng.next();
        if (k < 0.5) { g.box(px, top, pz, 2.1, 1.25, 1.5, 0x8d9094); g.box(px, top + 1.25, pz, 1.3, 0.1, 1.3, 0x55585c); }
        else if (k < 0.75) { g.box(px, top, pz, 0.2, 2.8, 0.2, 0x3f3226).box(px + 1.7, top, pz, 0.2, 2.8, 0.2, 0x3f3226).box(px, top, pz + 1.7, 0.2, 2.8, 0.2, 0x3f3226).box(px + 1.7, top, pz + 1.7, 0.2, 2.8, 0.2, 0x3f3226); g.cyl(px + 0.85, top + 2.8, pz + 0.85, 1.3, 2.6, 0x6e5238, 10, 1.2); }
        else { g.box(px, top, pz, 0.7, 1.6, 0.7, 0x6a6d70); g.box(px, top + 1.6, pz, 0.95, 0.12, 0.95, 0x3a3c40); }
      }
    },
    /** Copies a model into the city's merged geometry, turned and placed. */
    stamp: function (src, x, y, z, ry) {
      var out = TR.world.geo(x, z, 'solid'), c = Math.cos(ry || 0), n = Math.sin(ry || 0);
      for (var i = 0; i < src.p.length; i += 3) {
        var px = src.p[i], py = src.p[i + 1], pz = src.p[i + 2], ax = src.n[i], ay = src.n[i + 1], az = src.n[i + 2];
        out.p.push(x + px * c + pz * n, y + py, z - px * n + pz * c);
        out.n.push(ax * c + az * n, ay, -ax * n + az * c);
        out.c.push(src.c[i], src.c[i + 1], src.c[i + 2]);
      }
      out.count += src.count;
    },
    /** Finds open ground: nothing on it, no road through it. */
    clearAt: function (x, z, hw, hd) {
      var W = TR.world;
      for (var a = -1; a <= 1; a += 0.5) for (var b = -1; b <= 1; b += 0.5) { var qx = x + a * hw, qz = z + b * hd; if (W.isWater(qx, qz) || W.roadDist(qx, qz) < 1.5) return false; }
      return !W.collide.near(x, z, Math.max(hw, hd) + 2, []).some(function (q) { return q.y0 > -5 && q.y0 < 12 && x + hw > q.x0 && x - hw < q.x1 && z + hd > q.z0 && z - hd < q.z1; });
    },
    /** What makes an airport an airport and a harbour a harbour, from the street. */
    landmarks: function () {
      var W = TR.world, D2 = D.DISTRICTS, b = D2.airport.bounds, placed = [], stripes = [0xa81d24, 0x1d5f8f, 0xc8a02a];
      for (var x = b[0] + 24; x < b[2] - 24 && placed.length < 3; x += 10) for (var z = b[1] + 24; z < b[3] - 24 && placed.length < 3; z += 10) {
        if (!st.clearAt(x, z, 19, 23) || placed.some(function (q) { return Math.hypot(q[0] - x, q[1] - z) < 60; })) continue;
        placed.push([x, z]);
        var fl = W.geo(x, z, 'flat');
        fl.tile(x - 19, z - 23, x + 19, z + 23, 0.03, 0x6f7174);
        fl.tile(x - 0.25, z - 23, x + 0.25, z + 23, 0.05, 0xd8b43a);
        st.stamp(TR.models.airliner(new TR.Geo(), stripes[placed.length - 1]), x, 0, z, 0);
        W.collide.addBox(x, 0, z, 5.6, 7, 38);
        W.collide.addBox(x, 2.6, z + 0.4, 34, 1.6, 7);
      }
      st.planes = placed.length;
      // ships at anchor, in open water off the docks
      var ships = 0, colors = [0x1d3a56, 0x4a2a24];
      for (var sx = 130; sx < 350 && ships < 2; sx += 12) for (var sz = 296; sz < 356 && ships < 2; sz += 8) {
        var wet = true;
        for (var a = -1; a <= 1; a += 0.5) for (var e = -1; e <= 1; e += 1) if (!W.isWater(sx + a * 30, sz + e * 9)) wet = false;
        if (!wet || W.collide.near(sx, sz, 36, []).some(function (q) { return q.y0 > -5 && q.y0 < 12 && sx + 30 > q.x0 && sx - 30 < q.x1 && sz + 12 > q.z0 && sz - 12 < q.z1; })) continue;
        st.stamp(TR.models.cargoShip(new TR.Geo(), colors[ships]), sx, -1, sz, Math.PI / 2);
        W.collide.addBox(sx, -2, sz, 52, 12, 13);
        ships++;
        sx += 60;
        break;
      }
      st.ships = ships;
    },
    build: function () {
      var W = TR.world, rng = new window.TrillionerRng.Rng('street'), segs = roads(), corners = {};
      st.cars = [];
      st.mesh = new THREE.InstancedMesh(TR.models.sedan(new TR.Geo(), 0xffffff).geometry(), TR.tintedMaterial(), MAX_PARKED);
      st.mesh.frustumCulled = false; st.mesh.castShadow = true; st.mesh.count = 0;
      st.mesh.setColorAt(0, new THREE.Color(0xffffff));
      W.surface.add(st.mesh);
      // junctions from where road segments meet
      segs.forEach(function (s) { [s.a, s.b].forEach(function (p) { var k = p[0] + ',' + p[1]; (corners[k] = corners[k] || { x: p[0], z: p[1], n: 0, w: s.w }).n++; }); });
      Object.keys(corners).forEach(function (k) {
        var c = corners[k];
        if (c.n < 2) return;
        var off = c.w / 2 + 1.6;
        [[off, off, -1, 0], [-off, -off, 1, 0]].forEach(function (s) {
          var x = c.x + s[0], z = c.z + s[1];
          if (free(x, z, 0.6)) st.trafficLight(W.geo(x, z, 'solid'), W.geo(x, z, 'neon'), x, z, s[2], s[3]);
        });
      });
      // along each road: parked cars at the kerb, furniture on the pavement, a billboard now and then
      var ads = { p: [], uv: [], idx: [] };
      segs.forEach(function (s) {
        var dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = uz, nz = -ux;
        for (var d = 16; d < L - 16; d += rng.range(9, 20)) {
          var side = rng.next() < 0.5 ? 1 : -1, cx = s.a[0] + ux * d, cz = s.a[1] + uz * d;
          if (rng.next() < 0.55) {
            var kx = cx + nx * side * (s.w / 2 - 1.2), kz = cz + nz * side * (s.w / 2 - 1.2);
            if (!W.isWater(kx, kz) && !nearDoor(kx, kz) && !W.collide.near(kx, kz, 2.4, []).some(function (b) { return b.y0 > -5 && b.y0 < 2 && kx > b.x0 - 2.4 && kx < b.x1 + 2.4 && kz > b.z0 - 2.4 && kz < b.z1 + 2.4; }) && !segs.some(function (o) { return o !== s && distToSeg(kx, kz, o) < o.w / 2 + 6; }))
              st.parked(kx, kz, ux * side, uz * side, rng.pick(CARS));
          }
          var fx = cx + nx * side * (s.w / 2 + 2.2), fz = cz + nz * side * (s.w / 2 + 2.2);
          if (rng.next() < 0.5 && free(fx, fz, 1) && !nearDoor(fx, fz)) st.furniture(W.geo(fx, fz, 'solid'), fx, fz, rng);
        }
        for (var b = 40; b < L - 30; b += 130) {
          var sd = (Math.floor(b) % 2) ? 1 : -1, bx = s.a[0] + ux * b + nx * sd * (s.w / 2 + 6), bz = s.a[1] + uz * b + nz * sd * (s.w / 2 + 6);
          if (!free(bx, bz, 3.5)) continue;
          var g = W.geo(bx, bz, 'solid'), hw = 7, y0 = 7.4, hh = 3.5, ad = rng.int(ADS.length), u0 = (ad % 2) * 0.5, v1 = 1 - Math.floor(ad / 2) * 0.25, v0 = v1 - 0.25;
          g.cyl(bx - ux * 4, 0, bz - uz * 4, 0.24, y0, 0x3a3c40, 8); g.cyl(bx + ux * 4, 0, bz + uz * 4, 0.24, y0, 0x3a3c40, 8);
          W.collide.addBox(bx, 0, bz, 8.6, 6, 1);
          // both faces of the board
          [[1, 0.06], [-1, -0.06]].forEach(function (f) {
            var o = ads.p.length / 3, sx = -nx * sd * f[0] * 0.12, sz = -nz * sd * f[0] * 0.12, dirx = ux * f[0] * sd, dirz = uz * f[0] * sd;
            [[-1, 0], [1, 0], [1, 1], [-1, 1]].forEach(function (c, i) {
              ads.p.push(bx + sx + dirx * c[0] * hw, y0 + c[1] * hh * 2 - 0.2, bz + sz + dirz * c[0] * hw);
              ads.uv.push(u0 + (c[0] + 1) * 0.25, c[1] ? v1 : v0);
            });
            ads.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
          });
          g.box(bx, y0 - 0.3, bz, Math.abs(ux) * (hw * 2 + 0.4) + 0.2, hh * 2 + 0.5, Math.abs(uz) * (hw * 2 + 0.4) + 0.2, 0x26282c);
        }
      });
      st.landmarks();
      if (ads.idx.length) {
        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(ads.p, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(ads.uv, 2));
        geo.setIndex(ads.idx);
        var mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: adAtlas(), side: THREE.DoubleSide }));
        W.surface.add(mesh);
      }
    }
  };
})();
