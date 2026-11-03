/* What you wear and who follows you: dresses a figure from a style, builds pets, renders real 3D thumbnails. */
(function () {
  var TR = window.TR = window.TR || {};
  var X = window.TRD.extras, BY = X.BY_ID;

  function shine(m, look) { if (look.shine) { m.material.emissive.setHex(look.color); m.material.emissiveIntensity = 0.32; } return m; }
  function solid(geo, color, x, y, z, parent) {
    var m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: color }));
    m.position.set(x, y, z); parent.add(m);
    return m;
  }

  var HAT = {
    cap: function (a, c) { a.ball(0.44, 0.24, 0.44, c, 0, 0.6, 0); a.part(0.56, 0.05, 0.4, c, 0, 0.48, -0.5); },
    beanie: function (a, c) { a.ball(0.46, 0.34, 0.46, c, 0, 0.6, 0); a.ball(0.1, 0.1, 0.1, 0xffffff, 0, 0.96, 0); },
    cowboy: function (a, c) { a.ball(0.86, 0.05, 0.72, c, 0, 0.62, 0); a.part(0.54, 0.36, 0.46, c, 0, 0.8, 0); a.part(0.56, 0.08, 0.48, 0x2a1a10, 0, 0.68, 0); },
    tophat: function (a, c) { a.ball(0.62, 0.04, 0.62, c, 0, 0.68, 0); a.cyl(0.32, 0.72, c, 0, 1.04, 0); a.cyl(0.33, 0.1, 0xc22a2a, 0, 0.76, 0); },
    tall: function (a, c) { a.ball(0.62, 0.04, 0.62, c, 0, 0.68, 0); a.cyl(0.3, 1.9, c, 0, 1.62, 0); a.cyl(0.31, 0.14, 0xffc53d, 0, 0.8, 0); },
    crown: function (a, c, look) {
      a.cyl(0.38, 0.2, c, 0, 0.74, 0);
      for (var i = 0; i < 6; i++) {
        var t = i / 6 * 6.283;
        a.cone(0.11, 0.28, c, Math.sin(t) * 0.33, 0.96, Math.cos(t) * 0.33);
        a.ball(0.05, 0.05, 0.05, [0xff3b5c, 0x37d67a, 0x3da8ff][i % 3], Math.sin(t) * 0.385, 0.74, Math.cos(t) * 0.385);
      }
    }
  };
  var GLASSES = {
    round: function (a, c) { a.ring(0.12, 0.02, c, -0.16, 0.36, -0.4); a.ring(0.12, 0.02, c, 0.16, 0.36, -0.4); a.part(0.1, 0.02, 0.02, c, 0, 0.38, -0.41); },
    shades: function (a, c) { a.part(0.3, 0.17, 0.05, c, -0.17, 0.36, -0.4); a.part(0.3, 0.17, 0.05, c, 0.17, 0.36, -0.4); a.part(0.12, 0.03, 0.03, c, 0, 0.4, -0.41); },
    star: function (a, c) { a.star(0.2, c, -0.17, 0.36, -0.4); a.star(0.2, c, 0.17, 0.36, -0.4); },
    monocle: function (a, c) { a.ring(0.15, 0.025, 0xffc53d, 0.16, 0.36, -0.41); a.ball(0.13, 0.13, 0.02, c, 0.16, 0.36, -0.41); }
  };
  var NECK = {
    chain: function (a, c) { var r = a.ring(0.27, 0.035, c, 0, 0.72, -0.05); r.rotation.x = 1.15; },
    pearls: function (a, c) { for (var i = 0; i < 12; i++) { var t = i / 12 * 6.283; a.ball(0.075, 0.075, 0.075, c, Math.sin(t) * 0.27, 0.71 - Math.cos(t) * 0.1, -0.05 + Math.cos(t) * 0.2 - 0.03); } },
    medal: function (a, c) { a.part(0.12, 0.34, 0.02, 0xd9352c, 0, 0.6, -0.245); a.cyl(0.14, 0.04, c, 0, 0.38, -0.27).rotation.x = 1.57; },
    pendant: function (a, c) { var r = a.ring(0.27, 0.02, 0xffc53d, 0, 0.72, -0.05); r.rotation.x = 1.15; a.gem(0.2, c, 0, 0.38, -0.3); }
  };
  var HAIR = {
    spike: function (a, c) { [[0, 0.82, 0], [0.2, 0.76, 0.06], [-0.2, 0.76, 0.06], [0.12, 0.74, -0.2], [-0.12, 0.74, -0.2], [0, 0.72, 0.28], [0.28, 0.62, -0.04], [-0.28, 0.62, -0.04]].forEach(function (s) { a.cone(0.12, 0.34, c, s[0], s[1], s[2]); }); },
    long: function (a, c) { a.ball(0.44, 0.5, 0.2, c, 0, 0.3, 0.27); a.ball(0.12, 0.42, 0.2, c, -0.38, 0.26, 0.04); a.ball(0.12, 0.42, 0.2, c, 0.38, 0.26, 0.04); },
    afro: function (a, c) { a.ball(0.66, 0.6, 0.66, c, 0, 0.62, 0.06); },
    mohawk: function (a, c) { for (var i = 0; i < 6; i++) a.ball(0.07, 0.24, 0.11, c, 0, 0.82 - Math.abs(i - 2.5) * 0.04, 0.32 - i * 0.13); }
  };

  /** Puts small parts on one joint and remembers them, so a change of clothes can take them off. */
  function kit(parent, bin, look) {
    function keep(m) { m.castShadow = false; bin.push(m); return shine(m, look); }
    var P = TR.player;
    return {
      ball: function (rx, ry, rz, c, x, y, z) { return keep(P.ball(rx, ry, rz, c, x, y, z, parent)); },
      part: function (w, h, d, c, x, y, z) { return keep(P.part(w, h, d, c, x, y, z, parent)); },
      cyl: function (r, h, c, x, y, z) { return keep(solid(new THREE.CylinderGeometry(r, r, h, 20), c, x, y, z, parent)); },
      cone: function (r, h, c, x, y, z) { return keep(solid(new THREE.ConeGeometry(r, h, 10), c, x, y, z, parent)); },
      ring: function (r, tube, c, x, y, z) { return keep(solid(new THREE.TorusGeometry(r, tube, 8, 24), c, x, y, z, parent)); },
      gem: function (r, c, x, y, z) { var m = keep(solid(new THREE.OctahedronGeometry(r), c, x, y, z, parent)); m.scale.y = 1.25; return m; },
      star: function (r, c, x, y, z) { var m = keep(solid(new THREE.OctahedronGeometry(r, 0), c, x, y, z, parent)); m.scale.z = 0.25; return m; }
    };
  }
  function paint(mesh, color, look) {
    mesh.material.color.setHex(color);
    mesh.material.emissive.setHex(look && look.shine ? color : 0);
    mesh.material.emissiveIntensity = look && look.shine ? 0.28 : 1;
  }
  function lookOf(style, slot) { var id = style && style[slot], x = id && BY[id]; return x ? x.look : null; }

  var TRAILS = { t: 0 };
  var W = TR.wardrobe = {
    /** Dresses a figure from a style. Safe to call again with a different style. */
    dress: function (p, style) {
      (p.worn || []).forEach(function (m) { m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); });
      p.worn = [];
      var b = p.base, top = lookOf(style, 'top'), legs = lookOf(style, 'legs'), shoes = lookOf(style, 'shoes'), hair = lookOf(style, 'hair'), hat = lookOf(style, 'hat');
      var shirt = top ? top.color : b.shirt, leg = legs ? legs.color : b.leg;
      paint(p.body, shirt, top); paint(p.armL.userData.mesh, shirt, top); paint(p.armR.userData.mesh, shirt, top);
      [p.legL, p.legR, p.shinL, p.shinR].forEach(function (j) { paint(j.userData.mesh, leg, legs); });
      paint(p.pelvis, leg, legs);
      paint(p.shoeL, shoes ? shoes.color : b.shoe, shoes); paint(p.shoeR, shoes ? shoes.color : b.shoe, shoes);
      paint(p.hairM, hair ? hair.color : b.hair, hair);
      if (top && top.trim) kit(p.chest, p.worn, {}).part(0.16, 0.66, 0.04, top.trim, 0, 0.36, -0.235);
      if (hair && HAIR[hair.style] && !(hat && hair.style !== 'long')) HAIR[hair.style](kit(p.headJ, p.worn, hair), hair.color);
      if (hat) HAT[hat.model](kit(p.headJ, p.worn, hat), hat.color, hat);
      var gl = lookOf(style, 'glasses'); if (gl) GLASSES[gl.model](kit(p.headJ, p.worn, gl), gl.color);
      var ne = lookOf(style, 'neck'); if (ne) NECK[ne.model](kit(p.chest, p.worn, ne), ne.color);
      var wr = lookOf(style, 'wrist');
      if (wr) {
        var k = kit(p.foreL, p.worn, wr);
        k.ring(0.13, 0.04, wr.color, 0, -0.32, 0).rotation.x = 1.57;
        k.cyl(0.09, 0.04, wr.color === 0xffc53d ? 0xfff2b0 : 0xffffff, -0.14, -0.32, 0).rotation.z = 1.57;
      }
      if (p.crown && hat) p.crown.visible = false;
    },

    // ── pets ──
    pets: [],
    petGeo: {},
    buildPet: function (kind) {
      if (W.petGeo[kind]) return W.petGeo[kind];
      var g = new TR.Geo(), bk = 0x17171c;
      function legs(c, x, z, h, w) { [[-x, -z], [x, -z], [-x, z], [x, z]].forEach(function (l) { g.blob(l[0], h * 0.5, l[1], w * 0.55, h * 0.56, w * 0.55, c); }); }
      function eyes(y, z, x) { g.blob(-x, y, z, 0.05, 0.06, 0.03, bk).blob(x, y, z, 0.05, 0.06, 0.03, bk); }
      if (kind === 'pig') {
        var pk = 0xf7a8b8; legs(pk, 0.22, 0.24, 0.3, 0.17);
        g.blob(0, 0.55, 0, 0.38, 0.33, 0.5, pk).blob(0, 0.7, -0.48, 0.28, 0.27, 0.27, pk).blob(0, 0.66, -0.75, 0.13, 0.1, 0.05, 0xe77f97);
        g.blob(-0.18, 0.95, -0.46, 0.08, 0.11, 0.05, pk).blob(0.18, 0.95, -0.46, 0.08, 0.11, 0.05, pk); eyes(0.78, -0.72, 0.13);
        g.blob(0, 0.72, 0.5, 0.06, 0.06, 0.1, 0xe77f97);
      } else if (kind === 'dog') {
        var dg = 0xc98a4b; legs(dg, 0.2, 0.28, 0.42, 0.15);
        g.blob(0, 0.68, 0, 0.3, 0.3, 0.5, dg).blob(0, 0.98, -0.46, 0.27, 0.27, 0.28, dg).blob(0, 0.9, -0.72, 0.13, 0.11, 0.14, 0xf0d5ae).blob(0, 0.96, -0.86, 0.05, 0.05, 0.03, bk);
        g.blob(-0.28, 0.92, -0.44, 0.08, 0.2, 0.13, 0x7a4e24).blob(0.28, 0.92, -0.44, 0.08, 0.2, 0.13, 0x7a4e24); eyes(1.06, -0.72, 0.12);
        g.blob(0, 0.98, 0.52, 0.06, 0.2, 0.06, dg); g.rbox(0, 0.76, -0.3, 0.42, 0.06, 0.26, 0xd9352c, 0.02, 0, 1);
      } else if (kind === 'cat') {
        var ct = 0xe59a3c; legs(ct, 0.16, 0.2, 0.3, 0.12);
        g.blob(0, 0.5, 0, 0.25, 0.26, 0.4, ct).blob(0, 0.82, -0.34, 0.27, 0.24, 0.24, ct);
        g.gable(-0.2, 1, -0.34, 0.16, 0.2, 0.06, ct).gable(0.2, 1, -0.34, 0.16, 0.2, 0.06, ct);
        g.blob(-0.1, 0.86, -0.57, 0.07, 0.03, 0.02, bk).blob(0.1, 0.86, -0.57, 0.07, 0.03, 0.02, bk); g.blob(0, 0.78, -0.58, 0.03, 0.03, 0.02, 0xff8fb0);
        g.blob(0, 0.86, 0.44, 0.05, 0.36, 0.05, 0xb56f22);
      } else if (kind === 'penguin') {
        g.blob(0, 0.68, 0, 0.36, 0.56, 0.32, 0x16171d).blob(0, 0.62, -0.13, 0.27, 0.42, 0.22, 0xf8f8f4).blob(0, 1.28, 0, 0.27, 0.26, 0.26, 0x16171d);
        g.blob(0, 1.24, -0.28, 0.1, 0.05, 0.1, 0xffa11f); g.blob(-0.1, 1.34, -0.22, 0.06, 0.06, 0.03, 0xffffff).blob(0.1, 1.34, -0.22, 0.06, 0.06, 0.03, 0xffffff);
        g.blob(-0.38, 0.72, 0, 0.07, 0.34, 0.14, 0x16171d).blob(0.38, 0.72, 0, 0.07, 0.34, 0.14, 0x16171d);
        g.blob(-0.15, 0.06, -0.14, 0.13, 0.05, 0.18, 0xffa11f).blob(0.15, 0.06, -0.14, 0.13, 0.05, 0.18, 0xffa11f);
        g.blob(-0.09, 1.0, -0.26, 0.09, 0.06, 0.03, 0xd9352c).blob(0.09, 1.0, -0.26, 0.09, 0.06, 0.03, 0xd9352c);
      } else if (kind === 'tiger') {
        var tg = 0xf28a1f; legs(tg, 0.28, 0.42, 0.55, 0.22);
        g.blob(0, 0.9, 0, 0.42, 0.4, 0.78, tg).blob(0, 1.2, -0.8, 0.38, 0.36, 0.36, tg).blob(0, 1.05, -1.1, 0.2, 0.14, 0.12, 0xfff0d8).blob(0, 1.12, -1.22, 0.06, 0.05, 0.03, bk);
        g.blob(-0.28, 1.54, -0.8, 0.1, 0.1, 0.05, tg).blob(0.28, 1.54, -0.8, 0.1, 0.1, 0.05, tg); eyes(1.3, -1.12, 0.17);
        [-0.5, -0.2, 0.1, 0.4].forEach(function (z) { g.rbox(0, 1.22, z, 0.2, 0.1, 0.09, bk, 0.03, 0, 1); g.rbox(-0.42, 0.82, z, 0.05, 0.34, 0.09, bk, 0.02, 0, 1); g.rbox(0.42, 0.82, z, 0.05, 0.34, 0.09, bk, 0.02, 0, 1); });
        g.blob(0, 1.05, 0.92, 0.07, 0.07, 0.36, tg);
      } else if (kind === 'elephant') {
        var el = 0x9aa5b1; legs(el, 0.25, 0.3, 0.42, 0.24);
        g.blob(0, 0.76, 0, 0.42, 0.42, 0.56, el).blob(0, 1.0, -0.52, 0.33, 0.33, 0.3, el);
        g.blob(-0.44, 1.02, -0.45, 0.3, 0.32, 0.06, 0xc58f9c).blob(0.44, 1.02, -0.45, 0.3, 0.32, 0.06, 0xc58f9c);
        g.blob(0, 0.86, -0.82, 0.11, 0.14, 0.11, el).blob(0, 0.68, -0.9, 0.09, 0.14, 0.09, el).blob(0, 0.52, -0.93, 0.07, 0.11, 0.07, el);
        eyes(1.12, -0.78, 0.17); g.blob(0, 0.78, 0.56, 0.04, 0.2, 0.04, el);
      } else {
        var dr = 0x37c46b, wg = 0xffc53d;
        g.blob(0, 0.5, 0, 0.32, 0.34, 0.54, dr).blob(0, 0.86, -0.52, 0.28, 0.26, 0.32, dr).blob(0, 0.78, -0.82, 0.14, 0.1, 0.14, 0x2aa358);
        g.blob(-0.15, 1.12, -0.48, 0.05, 0.16, 0.05, wg).blob(0.15, 1.12, -0.48, 0.05, 0.16, 0.05, wg); eyes(0.98, -0.78, 0.13);
        g.blob(-0.62, 0.66, 0.06, 0.46, 0.05, 0.3, wg).blob(0.62, 0.66, 0.06, 0.46, 0.05, 0.3, wg);
        g.blob(0, 0.46, 0.68, 0.1, 0.1, 0.3, dr).blob(0, 0.44, 1.02, 0.05, 0.05, 0.18, wg);
      }
      return (W.petGeo[kind] = g.geometry());
    },
    setPets: function (ids, scene) {
      var key = ids.join(',');
      if (W.petKey === key) return;
      W.petKey = key;
      W.pets.forEach(function (q) { q.mesh.parent.remove(q.mesh); });
      var P = TR.player.pos;
      W.pets = ids.map(function (id, i) {
        var kind = BY[id].look.model, m = new THREE.Mesh(W.buildPet(kind), W.petMat || (W.petMat = new THREE.MeshLambertMaterial({ vertexColors: true })));
        m.castShadow = true; m.frustumCulled = false;
        scene.add(m);
        return { mesh: m, kind: kind, x: P.x + 2 + i, y: P.y, z: P.z + 2, h: 0, t: i * 1.3, slot: i };
      });
    },
    updatePets: function (dt, pos, heading, hidden) {
      W.pets.forEach(function (q) {
        q.mesh.visible = !hidden;
        var side = (q.slot - (W.pets.length - 1) / 2) * 2, back = 2.6 + (q.slot === 1 ? 1 : 0);
        var bx = Math.sin(heading) * back + Math.cos(heading) * side, bz = Math.cos(heading) * back - Math.sin(heading) * side;
        var tx = pos.x + bx, tz = pos.z + bz, dx = tx - q.x, dz = tz - q.z, d = Math.hypot(dx, dz);
        if (d > 45) { q.x = tx; q.z = tz; q.y = pos.y; d = 0; }
        var sp = Math.min(d * 3.2, 34), go = d > 0.45;
        if (go) { q.x += dx / d * sp * dt; q.z += dz / d * sp * dt; var want = Math.atan2(-dx, -dz), turn = ((want - q.h + 9.42477) % 6.28319) - 3.14159; q.h += turn * Math.min(1, dt * 9); }
        q.t += dt * (go ? 11 : 2);
        var fly = q.kind === 'dragon', hop = fly ? 2 + Math.sin(q.t * 0.4) * 0.35 : go ? Math.abs(Math.sin(q.t)) * 0.3 : 0;
        q.y += (pos.y - q.y) * Math.min(1, dt * 8);
        q.mesh.position.set(q.x, q.y + hop, q.z);
        q.mesh.rotation.set(fly ? 0 : go ? Math.sin(q.t) * 0.08 : 0, q.h, fly ? Math.sin(q.t * 0.7) * 0.18 : go ? Math.cos(q.t) * 0.05 : 0);
      });
    },

    /** Footprint effects you bought. */
    updateTrail: function (dt, pos, moving, style) {
      var look = lookOf(style, 'fx');
      if (!look) return;
      TRAILS.t -= dt;
      if (TRAILS.t > 0 || (!moving && !look.aura)) return;
      TRAILS.t = moving ? 0.05 : 0.14;
      var a = Math.random() * 6.283, r = look.aura ? 1 : 0.4, c = look.trail[Math.random() < 0.5 ? 0 : 1];
      TR.fx.spawn(pos.x + Math.cos(a) * r, pos.y + (look.aura ? Math.random() * 2.4 : 0.2), pos.z + Math.sin(a) * r, 0, look.aura ? 1.6 : 1, 0, c, 0.8, 0.5, 0);
    },

    // ── thumbnails: the real models, drawn once ──
    thumbs: {}, queue: [],
    rig: function () {
      if (W.tr) return W.tr;
      var r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      r.setSize(160, 160, false); r.outputEncoding = THREE.sRGBEncoding;
      var sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, 0.05, 200);
      sc.add(new THREE.HemisphereLight(0xffffff, 0x8a93a8, 1.05));
      var d = new THREE.DirectionalLight(0xffffff, 0.95); d.position.set(-2, 4, -5); sc.add(d);
      return (W.tr = { r: r, sc: sc, cam: cam });
    },
    snap: function (obj, cx, cy, cz, dist, fromX) {
      var t = W.rig();
      t.sc.add(obj);
      t.cam.position.set(cx + (fromX || 0.32) * dist, cy + 0.22 * dist, cz - dist);
      t.cam.lookAt(cx, cy, cz);
      t.r.render(t.sc, t.cam);
      var url = t.r.domElement.toDataURL();
      t.sc.remove(obj);
      return url;
    },
    frame: function (obj) {
      var b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()), m = Math.max(s.x, s.y, s.z) || 1;
      return { c: c, d: m * 2.2 };
    },
    snapFit: function (obj) { obj.updateMatrixWorld(true); var f = W.frame(obj); return W.snap(obj, f.c.x, f.c.y, f.c.z, f.d); },
    FRAMES: { hair: [2.62, 2.1], hat: [2.95, 3.1], glasses: [2.5, 1.5], top: [1.5, 3], neck: [1.9, 1.5], wrist: [1.05, 1.5, -0.55], legs: [0.72, 2.9], shoes: [0.14, 1.7] },
    /** Draws one thumbnail and returns its URL. key: 'x:<extra id>', 'g:<goods kind>' or 'v:<vehicle>'. */
    draw: function (key) {
      var kind = key.slice(0, 1), id = key.slice(2), url = '';
      if (kind === 'x') {
        var x = BY[id];
        if (x.slot === 'pet') {
          var pm = new THREE.Mesh(W.buildPet(x.look.model), new THREE.MeshLambertMaterial({ vertexColors: true }));
          pm.rotation.y = 0;
          url = W.snapFit(pm);
        } else if (x.slot === 'fx') {
          url = W.fxIcon(x);
        } else {
          var fig = TR.player.figure(0xd9dde4, 0x4a3a30, 0xf7cfa6), st = {}; st[x.slot] = id;
          W.dress(fig.parts, st);
          fig.group.updateMatrixWorld(true);
          var f = W.FRAMES[x.slot];
          url = W.snap(fig.group, f[2] || 0, f[0], 0, f[1]);
          (fig.parts.worn || []).forEach(function (m) { m.geometry.dispose(); m.material.dispose(); });
        }
      } else if (kind === 'g') {
        var mesh = TR.goods.meshes[id];
        if (mesh) url = W.snapFit(new THREE.Mesh(mesh.geometry, new THREE.MeshLambertMaterial({ vertexColors: true })));
      } else if (kind === 'v') {
        var sp = TR.vehicles.SPECS[id];
        if (sp) { var vm = sp.build().mesh(new THREE.MeshLambertMaterial({ vertexColors: true }), false, false); vm.matrixAutoUpdate = true; url = W.snapFit(vm); }
      }
      return url;
    },
    fxIcon: function (x) {
      var c = document.createElement('canvas'); c.width = c.height = 160;
      var g = c.getContext('2d'), rng = new window.TrillionerRng.Rng(x.id);
      for (var i = 0; i < 26; i++) {
        var r = rng.range(3, 12), px = rng.range(16, 144), py = rng.range(16, 144), col = x.look.trail[i % 2];
        g.fillStyle = '#' + ('00000' + col.toString(16)).slice(-6);
        g.beginPath();
        for (var k = 0; k < 8; k++) { var a = k / 8 * 6.283, q = k % 2 ? r * 0.4 : r; g.lineTo(px + Math.cos(a) * q, py + Math.sin(a) * q); }
        g.fill();
      }
      return c.toDataURL();
    },
    /** Fills <img data-thumb> a few at a time, so opening a screen never stalls the game. */
    fill: function (root) {
      root.querySelectorAll('img[data-thumb]').forEach(function (im) {
        var k = im.getAttribute('data-thumb');
        if (W.thumbs[k]) { im.src = W.thumbs[k]; im.removeAttribute('data-thumb'); } else W.queue.push(im);
      });
      if (!W.pumping) W.pump();
    },
    pump: function () {
      W.pumping = true;
      var n = 0;
      while (W.queue.length && n < 4) {
        var im = W.queue.shift(), k = im.getAttribute('data-thumb');
        if (!k) continue;
        if (!W.thumbs[k]) { try { W.thumbs[k] = W.draw(k) || TRANSPARENT; } catch (e) { W.thumbs[k] = TRANSPARENT; } n++; }
        im.src = W.thumbs[k]; im.removeAttribute('data-thumb');
      }
      if (W.queue.length) setTimeout(W.pump, 16); else W.pumping = false;
    }
  };
  var TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
})();
