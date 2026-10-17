/* Putt Club — builds the 3D diorama for one hole from the compiled physics world (engine/physics.js) and the
 * hole's decoration list. What you see is what the ball hits: floors, rails, obstacles and hazards all come
 * from the same data. Returns { group, update(t, dt), bump(i), pad(i), setToken(id, on), dispose() }. */
(function (global) {
  'use strict';
  var PC = global.PC, THREE = global.THREE, Phys = global.PuttPhysics;

  // ---------------------------------------------------------------- geometry batching

  function Batch() { this.pos = []; this.nor = []; this.uv = []; this.idx = []; }
  Batch.prototype.quad = function (a, b, c, d, n, uvs) {
    var o = this.pos.length / 3;
    [a, b, c, d].forEach(function (p, i) { this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.uv.push(uvs[i][0], uvs[i][1]); }, this);
    this.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  Batch.prototype.geometry = function () {
    if (!this.idx.length) return null;
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  };

  function topFace(batch, f, lift, uvScale) {
    var contour = f.poly.map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var tris = THREE.ShapeUtils.triangulateShape(contour, []);
    var o = batch.pos.length / 3;
    var nx = -f.gx, nz = -f.gz, nl = Math.hypot(nx, 1, nz);
    f.poly.forEach(function (p) {
      batch.pos.push(p[0], Phys.heightOn(f, p[0], p[1]) + lift, p[1]);
      batch.nor.push(nx / nl, 1 / nl, nz / nl);
      batch.uv.push(p[0] / uvScale, -p[1] / uvScale);
    });
    tris.forEach(function (t) {
      // Make sure the face points up.
      var a = f.poly[t[0]], b = f.poly[t[1]], c = f.poly[t[2]];
      var cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cross > 0) batch.idx.push(o + t[0], o + t[2], o + t[1]); else batch.idx.push(o + t[0], o + t[1], o + t[2]);
    });
  }

  function sideFaces(batch, f, bottomOf) {
    var n = f.poly.length;
    var cw = polyArea(f.poly) < 0;
    for (var i = 0; i < n; i++) {
      var a = f.poly[i], b = f.poly[(i + 1) % n];
      var ha = Phys.heightOn(f, a[0], a[1]), hb = Phys.heightOn(f, b[0], b[1]);
      var ba = bottomOf(ha), bb = bottomOf(hb);
      var ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez);
      if (L < 1e-4) continue;
      var nx = ez / L, nz = -ex / L;
      if (cw) { nx = -nx; nz = -nz; }
      var u = L / 2;
      var A = [a[0], ha, a[1]], B = [b[0], hb, b[1]], Bb = [b[0], bb, b[1]], Ab = [a[0], ba, a[1]];
      var uvs = [[0, ha / 2], [u, hb / 2], [u, bb / 2], [0, ba / 2]];
      // Outward-facing winding.
      if (cw) batch.quad(A, B, Bb, Ab, [nx, 0, nz], uvs);
      else batch.quad(B, A, Ab, Bb, [nx, 0, nz], [uvs[1], uvs[0], uvs[3], uvs[2]]);
    }
  }

  function polyArea(poly) { var s = 0; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) s += (poly[j][0] - poly[i][0]) * (poly[j][1] + poly[i][1]); return s / 2; }

  function addMesh(group, geometry, material, cast, receive) {
    if (!geometry) return null;
    var m = new THREE.Mesh(geometry, material);
    m.castShadow = !!cast; m.receiveShadow = receive !== false;
    group.add(m);
    return m;
  }

  /** Box instance between two points (x/z) with a bottom height that may slope. */
  function segMatrix(ax, ay, az, bx, by, bz, height, width, lift) {
    var dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
    var xAxis = new THREE.Vector3(dx, dy, dz).normalize();
    var yAxis = new THREE.Vector3(0, 1, 0).sub(xAxis.clone().multiplyScalar(xAxis.y)).normalize();
    var zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
    var m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    m.scale(new THREE.Vector3(len, height, width));
    m.setPosition((ax + bx) / 2, (ay + by) / 2 + height / 2 + (lift || 0), (az + bz) / 2);
    return m;
  }

  function instanced(group, geometry, material, mats, cast) {
    if (!mats.length) return null;
    var im = new THREE.InstancedMesh(geometry, material, mats.length);
    mats.forEach(function (m, i) { im.setMatrixAt(i, m); });
    im.castShadow = cast !== false; im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
    return im;
  }

  var unitBox = null, unitCyl = null, unitPost = null;
  function prims() {
    if (!unitBox) {
      unitBox = new THREE.BoxGeometry(1, 1, 1);
      unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
      unitPost = new THREE.CylinderGeometry(0.5, 0.56, 1, 8);
    }
  }

  // ---------------------------------------------------------------- the hole

  function build(hole, w, opts) {
    prims();
    opts = opts || {};
    var themeId = hole.theme, th = PC.themes.THEMES[themeId], kit = PC.themes.materials(themeId);
    var group = new THREE.Group(), animators = [], disposables = [];
    var mirror = opts.mirror ? -1 : 1;
    var rng = PC.rng(hole.id + (opts.mirror ? 'm' : ''));
    var hi = opts.quality !== 'low';
    var bounds = w.bounds, cx = (bounds[0] + bounds[2]) / 2, cz = (bounds[1] + bounds[3]) / 2;
    var span = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]);
    function floorH(x, z) { var f = Phys.floorAt(w, x, z, 50, 0); return f ? f.h : null; }
    function onFloor(x, z, pad) {
      pad = pad || 0;
      if (floorH(x, z) != null) return true;
      if (!pad) return false;
      for (var a = 0; a < 8; a++) if (floorH(x + Math.cos(a * 0.785) * pad, z + Math.sin(a * 0.785) * pad) != null) return true;
      return false;
    }

    // ---- floors
    var floorBatches = {}, sideBatch = new Batch(), thinBatch = new Batch(), glowEdges = [];
    var baseY = th.base === 'water' ? th.water.level - 1.0 : th.base === 'lawn' ? -0.86 : null;
    w.floors.forEach(function (f) {
      var key = f.mat;
      if (themeId === 'neon' && key === 'grass') key = 'metal';
      if (!kit.floor[key]) key = themeId === 'neon' ? 'metal' : 'grass';
      var b = floorBatches[key] || (floorBatches[key] = new Batch());
      topFace(b, f, f.overlay ? 0.004 : 0, key === 'grass' ? 4 : 2.5);
      if (f.overlay) return;
      var thin = f.mat === 'bridge' || f.mat === 'glass';
      sideFaces(thin ? thinBatch : sideBatch, f, function (h) {
        if (thin) return h - (f.mat === 'glass' ? 0.08 : 0.16);
        return baseY != null ? Math.min(baseY, h - 0.4) : h - th.sideDepth;
      });
      if (f.mat === 'glass' || (themeId === 'neon' && f.rails === false)) glowEdges.push(f);
      // Bridges stand on posts.
      if (f.mat === 'bridge' && th.base === 'water') {
        var bb = f.bb;
        for (var px = bb[0] + 0.3; px <= bb[2] - 0.2; px += 1.6) for (var pz = bb[1] + 0.3; pz <= bb[3] - 0.2; pz += 1.6) {
          if (!Phys.inPoly(f.poly, px, pz)) continue;
          var pm = new THREE.Mesh(unitPost, kit.post); pm.scale.set(0.16, 1.4, 0.16); pm.position.set(px, Phys.heightOn(f, px, pz) - 0.8, pz); pm.castShadow = false; group.add(pm);
        }
      }
    });
    Object.keys(floorBatches).forEach(function (k) { var m = addMesh(group, floorBatches[k].geometry(), kit.floor[k], false, true); if (m) disposables.push(m.geometry); });
    var sm = addMesh(group, sideBatch.geometry(), kit.side, true, true); if (sm) disposables.push(sm.geometry);
    var tm = addMesh(group, thinBatch.geometry(), themeId === 'neon' ? kit.metal : kit.post, true, true); if (tm) disposables.push(tm.geometry);

    // Glowing edges on open catwalks (Neon) so the drop is readable.
    var glowMats = [];
    glowEdges.forEach(function (f) {
      for (var i = 0; i < f.poly.length; i++) {
        var a = f.poly[i], b = f.poly[(i + 1) % f.poly.length];
        var shared = w.floors.some(function (g) { return g !== f && !g.overlay && g.poly.some(function (p, j) { var q = g.poly[(j + 1) % g.poly.length]; return near(p, a) && near(q, b) || near(p, b) && near(q, a) || onSeg(a, b, p) && onSeg(a, b, q); }); });
        if (shared) continue;
        glowMats.push(segMatrix(a[0], Phys.heightOn(f, a[0], a[1]), a[1], b[0], Phys.heightOn(f, b[0], b[1]), b[1], 0.03, 0.05, 0));
      }
    });
    instanced(group, unitBox, kit.neonCyan, glowMats, false);

    // ---- rails, posts, caps and the soft occlusion beside them
    var railBody = [], railCap = [], posts = {}, ropes = [], ao = [], interior = {};
    w.walls.forEach(function (wl) {
      if (wl.ledge) return;
      var h0 = wl.rail ? wl.h0 : wl.top - (wl.top - (floorH((wl.ax + wl.bx) / 2, (wl.az + wl.bz) / 2) || 0));
      if (wl.rail) {
        var hh = wl.height, h1 = wl.h1;
        if (wl.mat === 'rope') {
          ropes.push(segMatrix(wl.ax, h0 + hh * 0.75, wl.az, wl.bx, h1 + hh * 0.75, wl.bz, 0.035, 0.035, 0));
          addPost(wl.ax, wl.az, h0, hh + 0.08, 0.12, 'rope'); addPost(wl.bx, wl.bz, h1, hh + 0.08, 0.12, 'rope');
          return;
        }
        railBody.push(segMatrix(wl.ax, h0 - 0.18, wl.az, wl.bx, h1 - 0.18, wl.bz, hh + 0.18 - 0.05, wl.thick * 2, 0));
        if (themeId === 'neon') railCap.push(segMatrix(wl.ax, h0 + hh - 0.05, wl.az, wl.bx, h1 + hh - 0.05, wl.bz, 0.03, 0.05, 0.02));
        else railCap.push(segMatrix(wl.ax, h0 + hh - 0.05, wl.az, wl.bx, h1 + hh - 0.05, wl.bz, 0.05, wl.thick * 2 + 0.05, 0));
        addPost(wl.ax, wl.az, h0, hh + 0.06, wl.thick * 2 + 0.1, 'rail'); addPost(wl.bx, wl.bz, h1, hh + 0.06, wl.thick * 2 + 0.1, 'rail');
        // Occlusion strip on the floor side of the rail.
        var ex = wl.bx - wl.ax, ez = wl.bz - wl.az, L = Math.hypot(ex, ez), nx = -ez / L, nz = ex / L;
        [1, -1].forEach(function (sgn) {
          var mx = (wl.ax + wl.bx) / 2 + nx * sgn * 0.4, mz = (wl.az + wl.bz) / 2 + nz * sgn * 0.4;
          if (floorH(mx, mz) == null) return;
          var off = wl.thick + 0.17;
          var m = segMatrix(wl.ax + nx * sgn * off, h0 + 0.006, wl.az + nz * sgn * off, wl.bx + nx * sgn * off, h1 + 0.006, wl.bz + nz * sgn * off, 0.001, 0.34, 0);
          // Rotate the strip so its gradient fades away from the rail.
          if (sgn < 0) m.multiply(new THREE.Matrix4().makeRotationX(Math.PI));
          ao.push(m);
        });
      } else {
        var base = floorH((wl.ax + wl.bx) / 2, (wl.az + wl.bz) / 2) || 0;
        (interior[wl.mat] = interior[wl.mat] || []).push(segMatrix(wl.ax, base - 0.1, wl.az, wl.bx, base - 0.1, wl.bz, wl.top - base + 0.1, wl.thick * 2, 0));
        addPost(wl.ax, wl.az, base, wl.top - base, wl.thick * 2, 'interior-' + wl.mat);
        addPost(wl.bx, wl.bz, base, wl.top - base, wl.thick * 2, 'interior-' + wl.mat);
      }
    });
    function addPost(x, z, h, height, size, kind) {
      var key = Math.round(x * 20) + ',' + Math.round(z * 20);
      if (posts[key] && posts[key].h >= h) return;
      posts[key] = { x: x, z: z, h: h, height: height, size: size, kind: kind };
    }
    function near(a, b) { return Math.abs(a[0] - b[0]) < 1e-3 && Math.abs(a[1] - b[1]) < 1e-3; }
    function onSeg(a, b, p) {
      var ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez;
      var cr = Math.abs(ex * (p[1] - a[1]) - ez * (p[0] - a[0])) / Math.sqrt(L2);
      var u = ((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / L2;
      return cr < 1e-3 && u > -1e-3 && u < 1 + 1e-3;
    }
    instanced(group, unitBox, kit.rail, railBody, true);
    if (themeId === 'neon') instanced(group, unitBox, kit.metal, railBody.map(function (m) { var c = m.clone(); var p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); c.decompose(p, q, s); p.y += s.y / 2 - 0.02; return new THREE.Matrix4().compose(p, q, new THREE.Vector3(s.x, 0.04, s.z + 0.04)); }), false);
    instanced(group, unitBox, kit.railCap, railCap, false);
    instanced(group, unitCyl, kit.rope, ropes, false);
    var aoGeo = new THREE.PlaneGeometry(1, 1); aoGeo.rotateX(-Math.PI / 2);
    var aoMesh = instanced(group, aoGeo, kit.ao, ao.map(function (m) { var c = m.clone(); var s = new THREE.Vector3(); var q = new THREE.Quaternion(); var p = new THREE.Vector3(); c.decompose(p, q, s); return new THREE.Matrix4().compose(p, q, new THREE.Vector3(s.x, 1, s.z)); }), false);
    if (aoMesh) { aoMesh.receiveShadow = false; aoMesh.renderOrder = 1; }
    Object.keys(interior).forEach(function (mat) { instanced(group, unitBox, mat === 'hedge' ? kit.hedge : mat === 'brass' ? kit.brass : kit.stone, interior[mat], true); });
    var postMats = [], postCaps = [];
    Object.keys(posts).forEach(function (k) {
      var p = posts[k];
      if (p.kind.indexOf('interior') === 0) {
        if (p.kind === 'interior-hedge') return;
        postMats.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.h + p.height / 2, p.z), new THREE.Quaternion(), new THREE.Vector3(p.size, p.height, p.size)));
        return;
      }
      postMats.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.h + p.height / 2 - 0.1, p.z), new THREE.Quaternion(), new THREE.Vector3(p.size, p.height + 0.2, p.size)));
      postCaps.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.h + p.height + 0.035, p.z), new THREE.Quaternion(), new THREE.Vector3(p.size * 0.86, 0.07, p.size * 0.86)));
    });
    instanced(group, unitPost, themeId === 'garden' ? kit.stone : themeId === 'neon' ? kit.metal : kit.post, postMats, true);
    instanced(group, unitCyl, themeId === 'garden' ? kit.brass : themeId === 'neon' ? kit.neonCyan : kit.cream, postCaps, false);

    // ---- spinners
    var spinMeshes = w.spinners.map(function (s) {
      var g = new THREE.Group(); g.position.set(s.cx, s.h, s.cz);
      var armMat = s.mat === 'brass' ? kit.brass : s.mat === 'metal' ? kit.metal : themeId === 'garden' ? kit.coral : kit.wood;
      for (var a = 0; a < s.arms; a++) {
        var arm = new THREE.Mesh(unitBox, armMat);
        arm.scale.set(s.len, s.top - s.h - 0.04, s.thick * 2); arm.position.y = (s.top - s.h) / 2; arm.rotation.y = -(a * Math.PI) / s.arms;
        arm.castShadow = true; arm.receiveShadow = true; g.add(arm);
        var trim = new THREE.Mesh(unitBox, themeId === 'neon' ? kit.neonAmber : kit.cream);
        trim.scale.set(s.len + 0.02, 0.04, s.thick * 2 + 0.02); trim.position.y = s.top - s.h - 0.02; trim.rotation.y = arm.rotation.y; g.add(trim);
      }
      var hub;
      if (themeId === 'garden') {
        hub = new THREE.Mesh(PC.props.gearGeometry(10, 1, 0.82, 0.3), kit.brass);
        hub.rotation.x = Math.PI / 2; hub.scale.set(s.hub * 1.25, s.hub * 1.25, 1); hub.position.y = s.top - s.h + 0.04;
      } else {
        hub = new THREE.Mesh(unitCyl, themeId === 'neon' ? kit.metal : kit.brass);
        hub.scale.set(s.hub * 2, s.top - s.h + 0.12, s.hub * 2); hub.position.y = (s.top - s.h + 0.12) / 2;
      }
      hub.castShadow = true; g.add(hub);
      var post = new THREE.Mesh(unitCyl, kit.navy); post.scale.set(s.hub * 1.2, s.top - s.h, s.hub * 1.2); post.position.y = (s.top - s.h) / 2; g.add(post);
      group.add(g);
      return g;
    });

    // ---- sliders
    var slideMeshes = w.sliders.map(function (s) {
      var m = new THREE.Mesh(unitBox, s.mat === 'hedge' ? kit.hedge : s.mat === 'metal' ? kit.metal : kit.brass);
      m.scale.set(s.len, s.top - s.h, s.thick * 2); m.castShadow = true; m.receiveShadow = true;
      group.add(m);
      // Groove the bar runs in.
      var groove = new THREE.Mesh(unitBox, kit.navy);
      var L = Math.hypot(s.bx - s.ax, s.bz - s.az) + s.len;
      groove.scale.set(L, 0.01, 0.12); groove.position.set((s.ax + s.bx) / 2, s.h + 0.003, (s.az + s.bz) / 2);
      groove.rotation.y = -Math.atan2(s.bz - s.az, s.bx - s.ax); groove.receiveShadow = true;
      group.add(groove);
      return m;
    });

    // ---- gates
    var gateMeshes = w.gates.map(function (g) {
      var L = Math.hypot(g.bx - g.ax, g.bz - g.az), ang = -Math.atan2(g.bz - g.az, g.bx - g.ax);
      var neon = g.mat === 'neon';
      var panel = new THREE.Mesh(unitBox, neon ? new THREE.MeshBasicMaterial({ color: '#ff5d6c', transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false }) : kit.brass);
      panel.scale.set(L, g.height, neon ? 0.05 : g.thick * 2);
      panel.position.set((g.ax + g.bx) / 2, g.h, (g.az + g.bz) / 2); panel.rotation.y = ang; panel.castShadow = !neon;
      group.add(panel);
      [[g.ax, g.az], [g.bx, g.bz]].forEach(function (p) {
        var post = new THREE.Mesh(unitPost, neon ? kit.metal : kit.stone);
        post.scale.set(0.3, g.height + 0.25, 0.3); post.position.set(p[0], g.h + (g.height + 0.25) / 2, p[1]); post.castShadow = true; group.add(post);
        var lamp = new THREE.Mesh(unitCyl, neon ? kit.neonAmber : kit.brass); lamp.scale.set(0.22, 0.08, 0.22); lamp.position.set(p[0], g.h + g.height + 0.29, p[1]); group.add(lamp);
      });
      return { panel: panel, gate: g, neon: neon };
    });

    // ---- bumpers
    var bumperMeshes = w.bumpers.map(function (b) {
      var g = new THREE.Group(); g.position.set(b.x, b.h, b.z);
      var height = b.top - b.h;
      if (b.post) {
        if (b.mat === 'stone' && themeId !== 'neon') {
          var r = PC.props.build('rock', kit, rng, { s: b.r * 1.35 });
          r.position.y = height * 0.25; r.scale.y *= 1.4; g.add(r);
        } else {
          var p = new THREE.Mesh(unitPost, kit.metal); p.scale.set(b.r * 2, height, b.r * 2); p.position.y = height / 2; p.castShadow = true; g.add(p);
          var ring = new THREE.Mesh(unitCyl, kit.neonCyan); ring.scale.set(b.r * 2.05, 0.05, b.r * 2.05); ring.position.y = height * 0.8; g.add(ring);
        }
      } else {
        var body = new THREE.Mesh(unitCyl, kit.bumper); body.scale.set(b.r * 2, height * 0.8, b.r * 2); body.position.y = height * 0.4; body.castShadow = true; g.add(body);
        var band = new THREE.Mesh(unitCyl, kit.bumperRing); band.scale.set(b.r * 2.12, height * 0.18, b.r * 2.12); band.position.y = height * 0.35; g.add(band);
        var dome = new THREE.Mesh(new THREE.SphereGeometry(b.r * 0.95, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), kit.bumper); dome.position.y = height * 0.8; dome.castShadow = true; g.add(dome);
      }
      group.add(g);
      return { g: g, hit: 0 };
    });

    // ---- launch pads and magnets
    var padMeshes = w.pads.map(function (p) {
      var m = new THREE.Mesh(new THREE.CircleGeometry(p.r, 32), kit.pad.clone());
      m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(-p.dx, -p.dz);
      m.position.set(p.x, p.h + 0.006, p.z); group.add(m);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(p.r, 0.05, 6, 40), kit.neonAmber); ring.rotation.x = Math.PI / 2; ring.position.set(p.x, p.h + 0.03, p.z); group.add(ring);
      return { m: m, pulse: 0 };
    });
    var magnetRings = w.magnets.map(function (mg) {
      var mat = (mg.k > 0 ? kit.ringCyan : kit.ringAmber).clone();
      var m = new THREE.Mesh(new THREE.CircleGeometry(mg.r, 40), mat); m.rotation.x = -Math.PI / 2; m.position.set(mg.x, mg.h + 0.007, mg.z);
      group.add(m);
      var coil = new THREE.Group(); coil.position.set(mg.x, mg.h, mg.z);
      for (var i = 0; i < 3; i++) { var t = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 24), mg.k > 0 ? kit.neonCyan : kit.neonAmber); t.rotation.x = Math.PI / 2; t.position.y = 0.15 + i * 0.16; coil.add(t); }
      group.add(coil);
      return { m: m, k: mg.k };
    });

    // ---- moving platforms
    var platMeshes = w.platforms.map(function (p) {
      var g = new THREE.Group();
      var deck = new THREE.Mesh(unitBox, kit.floor.wood || kit.wood); deck.scale.set(p.hw * 2, 0.24, p.hd * 2); deck.position.y = -0.12; deck.castShadow = true; deck.receiveShadow = true; g.add(deck);
      var trim = new THREE.Mesh(unitBox, kit.brass); trim.scale.set(p.hw * 2 + 0.06, 0.06, p.hd * 2 + 0.06); trim.position.y = -0.26; g.add(trim);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
        var b = new THREE.Mesh(unitCyl, kit.brass); b.scale.set(0.14, 0.18, 0.14); b.position.set(c[0] * (p.hw - 0.12), 0.09, c[1] * (p.hd - 0.12)); g.add(b);
      });
      group.add(g);
      return { g: g, p: p };
    });

    // ---- cup and flag
    var cup = new THREE.Mesh(new THREE.CircleGeometry(Phys.C.CUP_R * 1.02, 40), kit.cup);
    cup.rotation.x = -Math.PI / 2; cup.position.set(w.cup[0], w.cupH + 0.004, w.cup[1]); cup.renderOrder = 2;
    group.add(cup);
    var flagGroup = new THREE.Group(); flagGroup.position.set(w.cup[0], w.cupH, w.cup[1]); group.add(flagGroup);
    var pole = new THREE.Mesh(unitCyl, kit.pole); pole.scale.set(0.045, 1.9, 0.045); pole.position.y = 0.95; pole.castShadow = true; flagGroup.add(pole);
    var clothGeo = new THREE.PlaneGeometry(0.7, 0.44, 10, 2); clothGeo.translate(0.35, 0, 0);
    var cloth = new THREE.Mesh(clothGeo, kit.flag); cloth.position.y = 1.65; cloth.castShadow = true; flagGroup.add(cloth);
    var clothBase = clothGeo.attributes.position.array.slice();
    var flagLift = 0;

    // ---- power-up crates
    var crateGeo = (function () {
      var s = new THREE.Shape(), r = 0.08, h = 0.21;
      s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h); s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
      var g = new THREE.ExtrudeGeometry(s, { depth: 0.34, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 3 });
      g.translate(0, 0, -0.17);
      // Box-project UVs so the crate texture lands on each face.
      var pos = g.attributes.position, uv = g.attributes.uv;
      for (var i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 0.25) * 2, (pos.getY(i) + 0.25) * 2);
      return g;
    })();
    var tokenMeshes = (opts.tokens || []).map(function (tk) {
      var g = new THREE.Group(); g.position.set(tk.x, tk.y, tk.z);
      var crate = new THREE.Mesh(crateGeo, kit.crate); crate.castShadow = true; crate.position.y = 0.5; g.add(crate);
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: PC.tex.glow(), color: '#ffd27a', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(1.3, 1.3, 1); glow.position.y = 0.5; g.add(glow);
      var shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), kit.blob); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; g.add(shadow);
      group.add(g);
      return { g: g, crate: crate, glow: glow, shadow: shadow, active: tk.active !== false, s: tk.active !== false ? 1 : 0, phase: rng() * 6 };
    });

    // ---- base: water, lawn or the void
    var waterMat = null;
    if (th.base === 'water') {
      waterMat = PC.themes.waterMaterial(th, [cx, cz], span * 0.6);
      var water = new THREE.Mesh(new THREE.PlaneGeometry(260, 260, 1, 1), waterMat);
      water.rotation.x = -Math.PI / 2; water.position.y = th.water.level; water.renderOrder = 0;
      group.add(water);
      // Sea floor so the shallows have something under them.
      var bed = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshLambertMaterial({ color: '#c9b48a' }));
      bed.rotation.x = -Math.PI / 2; bed.position.y = th.water.level - 1.3; group.add(bed);
      // Foam where the course meets the water.
      var foamMats = [];
      w.floors.forEach(function (f) {
        if (f.overlay || f.mat === 'bridge') return;
        for (var i = 0; i < f.poly.length; i++) {
          var a = f.poly[i], b = f.poly[(i + 1) % f.poly.length], ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez);
          if (L < 0.2) continue;
          var nx = ez / L, nz = -ex / L;
          if (polyArea(f.poly) < 0) { nx = -nx; nz = -nz; }
          var mx = (a[0] + b[0]) / 2 + nx * 0.35, mz = (a[1] + b[1]) / 2 + nz * 0.35;
          if (floorH(mx, mz) != null) continue;
          foamMats.push(segMatrix(a[0] + nx * 0.3, th.water.level + 0.012, a[1] + nz * 0.3, b[0] + nx * 0.3, th.water.level + 0.012, b[1] + nz * 0.3, 0.001, 0.6, 0));
        }
      });
      var foamGeo = new THREE.PlaneGeometry(1, 1); foamGeo.rotateX(-Math.PI / 2);
      var foam = instanced(group, foamGeo, kit.foam, foamMats.map(function (m) { var p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); return new THREE.Matrix4().compose(p, q, new THREE.Vector3(s.x + 0.6, 1, s.z)); }), false);
      if (foam) foam.receiveShadow = false;
    } else if (th.base === 'lawn') {
      var lawn = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), kit.lawn); lawn.rotation.x = -Math.PI / 2; lawn.position.y = -0.86; lawn.receiveShadow = true; group.add(lawn);
      var path = new THREE.Mesh(new THREE.RingGeometry(span * 0.62 + 3, span * 0.62 + 4.6, 64), kit.gravel); path.rotation.x = -Math.PI / 2; path.position.set(cx, -0.85, cz); path.receiveShadow = true; group.add(path);
    } else {
      var gridMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: true,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 } }]),
        vertexShader: '#include <fog_pars_vertex>\nvarying vec2 vP; void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vP = wp.xz; vec4 mvPosition = viewMatrix*wp; gl_Position = projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
        fragmentShader: '#include <fog_pars_fragment>\nuniform float time; varying vec2 vP; void main(){ vec2 g = abs(fract(vP/2.0 - 0.5) - 0.5) / fwidth(vP/2.0); float l = 1.0 - min(min(g.x, g.y), 1.0); float pulse = 0.5 + 0.5*sin(time*0.8 - length(vP)*0.15); vec3 c = mix(vec3(0.05,0.35,0.42), vec3(0.3,0.9,1.0), pulse*0.4); gl_FragColor = vec4(c, l*0.55);\n#include <fog_fragment>\n}',
        extensions: { derivatives: true }
      });
      var grid = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), gridMat); grid.rotation.x = -Math.PI / 2; grid.position.y = -9; group.add(grid);
      animators.push(function (t) { gridMat.uniforms.time.value = t; });
    }
    // Ponds (Clockwork Garden) and any water regions.
    if (hole.water && hole.water.regions && th.base !== 'water') {
      var pondTheme = { water: { shallow: '#7cc7b7', deep: '#2f6f6a' }, sun: th.sun };
      hole.water.regions.forEach(function (r) {
        var x0 = Math.min(r[0] * mirror, r[2] * mirror), x1 = Math.max(r[0] * mirror, r[2] * mirror);
        var pm = PC.themes.waterMaterial(pondTheme, [(x0 + x1) / 2, (r[1] + r[3]) / 2], Math.max(x1 - x0, r[3] - r[1]));
        var pond = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, r[3] - r[1]), pm); pond.rotation.x = -Math.PI / 2; pond.position.set((x0 + x1) / 2, hole.water.level, (r[1] + r[3]) / 2); group.add(pond);
        var basin = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.1, r[3] - r[1]), new THREE.MeshLambertMaterial({ color: '#29453c' })); basin.position.set((x0 + x1) / 2, -0.8, (r[1] + r[3]) / 2); group.add(basin);
        // Stone walls of the pond between the lawns.
        [[x0, x1, r[1]], [x0, x1, r[3]]].forEach(function () {});
        var leftWall = new THREE.Mesh(unitBox, kit.side); leftWall.scale.set(0.3, 0.6, r[3] - r[1]); leftWall.position.set(x0 - 0.15, -0.55, (r[1] + r[3]) / 2); group.add(leftWall);
        var rightWall = leftWall.clone(); rightWall.position.x = x1 + 0.15; group.add(rightWall);
        animators.push(function (t) { pm.uniforms.time.value = t; });
      });
    }

    // ---- decoration
    function place(kind, x, z, s, rot, h) {
      var o = PC.props.build(kind, kit, rng, { s: s || 1, speed: 1.1 });
      if (!o) return null;
      var fh = floorH(x, z);
      var y = h != null ? h : fh != null ? fh : (th.base === 'water' ? th.water.level : th.base === 'lawn' ? -0.86 : -0.3);
      if (h == null && fh == null && th.base === 'water' && ['palm', 'hut', 'umbrella', 'rock', 'lighthouse'].indexOf(kind) >= 0) {
        // A little sand islet under anything standing in the sea.
        var isle = new THREE.Mesh(isleGeo(rng), kit.floor.sand);
        var is = kind === 'umbrella' ? 1.25 : kind === 'hut' ? 1.6 : kind === 'lighthouse' ? 2.2 : 1;
        isle.scale.set(is * (s || 1), 1, is * (s || 1));
        isle.position.set(x, th.water.level - 0.05, z); isle.receiveShadow = true; group.add(isle);
        y = th.water.level + 0.16;
      }
      o.position.set(x, y, z); o.userData.baseY = y;
      if (rot != null) o.rotation.y = rot;
      group.add(o);
      if (o.userData.animate) animators.push(o.userData.animate);
      return o;
    }
    (hole.decor || []).forEach(function (d) { place(d.kind, d.at[0] * mirror, d.at[1], d.s, d.rot != null ? d.rot * mirror : rng() * 6, d.h); });
    scatter(hole, w, themeId, rng, place, onFloor, cx, cz, span, hi);

    // Neon: a couple of coloured lights for mood.
    if (themeId === 'neon') {
      var l1 = new THREE.PointLight('#37d6e6', 1.2, 22, 2); l1.position.set(bounds[0] - 1, 3, cz + 2); group.add(l1);
      var l2 = new THREE.PointLight('#ffb547', 0.9, 22, 2); l2.position.set(bounds[2] + 1, 3, cz - 3); group.add(l2);
    }

    // ---------------------------------------------------------------- per-frame update
    var dirty = 0;
    function update(t, dt) {
      var dyn = Phys.dynamicAt(w, t);
      spinMeshes.forEach(function (m, i) { m.rotation.y = -dyn.spinners[i]; });
      slideMeshes.forEach(function (m, i) { var s = dyn.sliders[i], sl = w.sliders[i]; m.position.set(s.cx, sl.h + (sl.top - sl.h) / 2, s.cz); m.rotation.y = -sl.ang; });
      gateMeshes.forEach(function (gm, i) {
        var k = dyn.gates[i], g = gm.gate;
        if (gm.neon) { gm.panel.position.y = g.h + g.height / 2; gm.panel.scale.y = g.height * Math.max(0.02, k); gm.panel.position.y = g.h + g.height * k / 2; gm.panel.material.opacity = 0.15 + 0.5 * k; gm.panel.visible = k > 0.02; }
        else gm.panel.position.y = g.h - g.height / 2 + g.height * k;
      });
      platMeshes.forEach(function (pm, i) { var p = dyn.platforms[i]; pm.g.position.set(p.x, pm.p.h, p.z); });
      bumperMeshes.forEach(function (b) { if (b.hit > 0) { b.hit = Math.max(0, b.hit - dt * 4); var s = 1 + Math.sin(b.hit * Math.PI) * 0.22; b.g.scale.set(s, 1 - (s - 1) * 0.6, s); } });
      padMeshes.forEach(function (p) { p.pulse = Math.max(0, p.pulse - dt * 2.5); p.m.material.opacity = 0.7 + 0.3 * Math.sin(t * 4) * 0.5 + p.pulse * 0.6; });
      magnetRings.forEach(function (r) { var u = ((t * 0.5) % 1); r.m.scale.setScalar(r.k > 0 ? 1 - u * 0.5 : 0.5 + u * 0.5); r.m.material.opacity = 0.5 * (r.k > 0 ? 1 - u : u) + 0.1; });
      tokenMeshes.forEach(function (tk) {
        var target = tk.active ? 1 : 0;
        tk.s = PC.damp(tk.s, target, 7, dt);
        var s = tk.s < 0.01 ? 0.0001 : tk.s;
        tk.crate.scale.setScalar(s); tk.glow.scale.setScalar(1.3 * s); tk.shadow.scale.setScalar(s);
        tk.crate.position.y = 0.5 + Math.sin(t * 2 + tk.phase) * 0.07;
        tk.crate.rotation.y = t * 0.9 + tk.phase; tk.crate.rotation.x = Math.sin(t * 0.7 + tk.phase) * 0.15;
      });
      // Flag ripples; it lifts out of the way while a ball is near the cup.
      var arr = clothGeo.attributes.position.array;
      for (var i = 0; i < arr.length; i += 3) { var x = clothBase[i]; arr[i + 2] = clothBase[i + 2] + Math.sin(t * 5 + x * 7) * 0.06 * x; }
      clothGeo.attributes.position.needsUpdate = true;
      flagGroup.position.y = w.cupH + flagLift * 0.9;
      if (waterMat) waterMat.uniforms.time.value = t;
      if (kit.foam.map) kit.foam.map.offset.x = (t * 0.02) % 1, kit.foam.opacity = 0.55 + Math.sin(t * 1.2) * 0.2;
      for (var a = 0; a < animators.length; a++) animators[a](t);
      void dirty;
    }

    return {
      group: group, world: w, hole: hole,
      update: update,
      bump: function (x, z) {
        var best = null, bd = 2;
        bumperMeshes.forEach(function (b, i) { var bb = w.bumpers[i], d = Math.hypot(bb.x - x, bb.z - z); if (d < bd) { bd = d; best = b; } });
        if (best) best.hit = 1;
      },
      pad: function (x, z) { padMeshes.forEach(function (p, i) { if (Math.hypot(w.pads[i].x - x, w.pads[i].z - z) < 2) p.pulse = 1; }); },
      setToken: function (id, on) { if (tokenMeshes[id]) tokenMeshes[id].active = on; },
      tokenPos: function (id) { var t = tokenMeshes[id]; return t ? t.g.position.clone().add(new THREE.Vector3(0, 0.5, 0)) : null; },
      liftFlag: function (v) { flagLift = PC.damp(flagLift, v, 6, 1 / 60); },
      dispose: function () {
        group.traverse(function (o) { if (o.geometry && o.geometry !== unitBox && o.geometry !== unitCyl && o.geometry !== unitPost && disposables.indexOf(o.geometry) < 0) o.geometry.dispose(); });
        disposables.forEach(function (g) { g.dispose(); });
        if (waterMat) waterMat.dispose();
      }
    };
  }

  /** A low, lumpy sand mound for things standing in the sea. */
  function isleGeo(rng) {
    var g = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), pos = g.attributes.position;
    var seed = rng() * 10;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x);
      var r = 1 + 0.12 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 5 + seed * 2);
      pos.setXYZ(i, x * r * 1.2, y * 0.3, z * r * 1.2);
    }
    g.computeVertexNormals();
    return g;
  }

  /** Theme dressing around the course, deterministic per hole and kept off the playing surface. */
  function scatter(hole, w, themeId, rng, place, onFloor, cx, cz, span, hi) {
    var b = w.bounds, n = hi ? 1 : 0.5;
    function ring(count, minR, maxR, fn) {
      var placed = 0, tries = 0;
      while (placed < count * n && tries++ < count * 30) {
        var a = rng() * Math.PI * 2, r = minR + rng() * (maxR - minR);
        var x = cx + Math.cos(a) * r * ((b[2] - b[0]) / span + 0.4), z = cz + Math.sin(a) * r * ((b[3] - b[1]) / span + 0.4);
        if (onFloor(x, z, 2.2)) continue;
        fn(x, z); placed++;
      }
    }
    var half = span / 2;
    if (themeId === 'cove') {
      ring(5, half + 3, half + 11, function (x, z) { place('palm', x, z, 0.9 + rng() * 0.5); if (rng() < 0.6) place('rock', x + 1.2, z + 0.4, 0.6 + rng() * 0.6); });
      ring(7, half + 1.5, half + 14, function (x, z) { place('rock', x, z, 0.5 + rng() * 1.1, null, -0.4); });
      ring(1, half + 8, half + 14, function (x, z) { place('boat', x, z, 1, rng() * 6, -0.42); });
    } else if (themeId === 'garden') {
      ring(8, half + 2.5, half + 7, function (x, z) { place(rng() < 0.5 ? 'topiary' : 'hedgeBall', x, z, 0.9 + rng() * 0.4); });
      ring(6, half + 2, half + 9, function (x, z) { place('flowers', x, z, 0.8 + rng() * 0.5); });
      ring(3, half + 4, half + 10, function (x, z) { place('gear', x, z, 1 + rng() * 0.8); });
      ring(3, half + 3, half + 8, function (x, z) { place('lamp', x, z, 1); });
    } else {
      ring(8, half + 7, half + 15, function (x, z) { place('pillar', x, z, 0.9 + rng() * 0.4, 0, -7.5 - rng() * 2); });
      ring(6, half + 2.5, half + 10, function (x, z) { place('crystal', x, z, 0.8 + rng() * 0.8, null, -2.5 - rng() * 3); });
    }
  }

  PC.world = { build: build };
})(window);
