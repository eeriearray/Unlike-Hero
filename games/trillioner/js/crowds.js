/*
 * The crowd. Instanced, but people have knees and elbows: the vertex shader swings each limb from its joint using a
 * phase per person, so walking costs nothing on the CPU. Everyone follows the pavements and collides with the world.
 */
(function () {
  var TR = window.TR = window.TR || {};
  var D = window.TRD.districts, dummy = new THREE.Object3D(), col = new THREE.Color();
  var SHIRTS = [0xe8504f, 0x3c8fe0, 0x4cb860, 0xf2c23a, 0xa45ad6, 0xf08a2c, 0x1fb39a, 0xe45c94, 0xf2f2ee, 0x5570e8, 0xc73f73, 0x86c43a, 0x7d8896, 0x2f3b52];
  var KIND = { paint: 0, shirt: 1, trousers: 2, skin: 3, hair: 4 };
  var LIMB = { none: 0, thighL: 1, shinL: 2, thighR: 3, shinR: 4, armL: 5, foreL: 6, armR: 7, foreR: 8, head: 9 };

  function bodyGeometry() {
    var g = new TR.Geo(), aKind = [], aLimb = [];
    function add(kind, limb, fn) {
      var from = g.p.length / 3; fn();
      for (var i = from; i < g.p.length / 3; i++) { aKind.push(kind); aLimb.push(limb); }
    }
    var W = 0xffffff, S = 1;
    // legs: thigh pivots at the hip (1.02), shin at the knee (0.54)
    add(KIND.trousers, LIMB.thighL, function () { g.rbox(-0.2, 0.52, 0, 0.27, 0.56, 0.3, W, 0.12, 0.1, S); });
    add(KIND.trousers, LIMB.thighR, function () { g.rbox(0.2, 0.52, 0, 0.27, 0.56, 0.3, W, 0.12, 0.1, S); });
    add(KIND.trousers, LIMB.shinL, function () { g.rbox(-0.2, 0.12, 0, 0.23, 0.46, 0.25, W, 0.1, 0.08, S); });
    add(KIND.trousers, LIMB.shinR, function () { g.rbox(0.2, 0.12, 0, 0.23, 0.46, 0.25, W, 0.1, 0.08, S); });
    add(KIND.paint, LIMB.shinL, function () { g.rbox(-0.2, 0, -0.05, 0.27, 0.16, 0.46, 0x2a2a33, 0.1, 0.07, S); });
    add(KIND.paint, LIMB.shinR, function () { g.rbox(0.2, 0, -0.05, 0.27, 0.16, 0.46, 0x2a2a33, 0.1, 0.07, S); });
    // torso: narrower at the waist, wider at the shoulders
    add(KIND.shirt, LIMB.none, function () { g.rbox(0, 0.96, 0, 0.66, 0.44, 0.38, W, 0.17, 0.12, S); g.rbox(0, 1.32, 0, 0.8, 0.54, 0.42, W, 0.2, 0.17, S); });
    // arms: upper pivots at the shoulder (1.74), forearm at the elbow (1.32)
    add(KIND.shirt, LIMB.armL, function () { g.rbox(-0.5, 1.3, 0, 0.21, 0.5, 0.23, W, 0.1, 0.09, S); });
    add(KIND.shirt, LIMB.armR, function () { g.rbox(0.5, 1.3, 0, 0.21, 0.5, 0.23, W, 0.1, 0.09, S); });
    add(KIND.skin, LIMB.foreL, function () { g.rbox(-0.5, 0.86, 0, 0.17, 0.48, 0.19, W, 0.08, 0.08, S); });
    add(KIND.skin, LIMB.foreR, function () { g.rbox(0.5, 0.86, 0, 0.17, 0.48, 0.19, W, 0.08, 0.08, S); });
    // head
    add(KIND.skin, LIMB.head, function () { g.rbox(0, 1.82, 0, 0.22, 0.2, 0.22, W, 0.1, 0.05, 1); g.blob(0, 2.28, 0, 0.32, 0.36, 0.33, W); });
    add(KIND.hair, LIMB.head, function () { g.blob(0, 2.4, 0.05, 0.345, 0.3, 0.34, W); });
    add(KIND.paint, LIMB.head, function () { g.rbox(-0.13, 2.27, -0.32, 0.07, 0.1, 0.02, 0x1d1d24, 0.02, 0.02, 1); g.rbox(0.13, 2.27, -0.32, 0.07, 0.1, 0.02, 0x1d1d24, 0.02, 0.02, 1); });
    var geo = g.geometry();
    geo.setAttribute('aKind', new THREE.Float32BufferAttribute(aKind, 1));
    geo.setAttribute('aLimb', new THREE.Float32BufferAttribute(aLimb, 1));
    return geo;
  }

  var WALK_GLSL = [
    'attribute float aKind; attribute float aLimb; attribute vec3 aWalk;',
    'mat3 rx(float a){ float c = cos(a), s = sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }',
    'vec3 about(vec3 p, float y, float a){ p.y -= y; p.z += 0.0; p = rx(a) * p; p.y += y; return p; }'
  ].join('\n');
  // Forward is -z. A positive rotation about x lifts the -z side.
  var WALK_MAIN = [
    '#include <begin_vertex>',
    'float ph = aWalk.x, amp = aWalk.y, cheer = aWalk.z, sw = sin(ph), cw = cos(ph);',
    'vec3 q = transformed;',
    'float limb = aLimb;',
    'if (limb > 0.5 && limb < 4.5) {',                                   // legs
    '  float side = limb < 2.5 ? 1.0 : -1.0, s = sw * side, c = cw * side;',
    '  float hip = -s * 0.62 * amp;',                                    // legs swing opposite each other
    '  float knee = max(0.0, c) * 1.05 * amp + 0.1 * amp;',              // the knee folds as the leg comes through
    '  if (limb == 2.0 || limb == 4.0) q = about(q, 0.56, knee);',
    '  q = about(q, 1.04, hip);',
    '} else if (limb > 4.5 && limb < 8.5) {',                            // arms
    '  float side = limb < 6.5 ? -1.0 : 1.0, s = sw * side;',
    '  float sh = -s * 0.5 * amp;',
    '  if (cheer > 0.5) sh = -2.7 + sin(ph * 2.0 + side) * 0.25;',
    '  if (limb == 6.0 || limb == 8.0) q = about(q, 1.32, -(0.28 + max(0.0, s) * 0.55) * max(amp, 0.25));',
    '  q = about(q, 1.76, sh);',
    '}',
    'float twist = sw * 0.09 * amp;',                                    // shoulders counter-rotate a little
    'if (q.y > 0.95) { float t = twist * smoothstep(0.95, 1.8, q.y); float c2 = cos(t), s2 = sin(t); q.xz = mat2(c2, -s2, s2, c2) * q.xz; }',
    'if (q.y > 1.0) q.z -= amp * 0.09 * (q.y - 1.0);',                   // lean into the walk
    'q.y += abs(cw) * 0.055 * amp;',                                     // the body rises over each step
    'q.x += sw * 0.02 * amp;',
    'if (limb == 9.0) q.y += sin(ph * 2.0) * 0.008;',
    'transformed = q;'
  ].join('\n');
  var COLOR_MAIN = [
    'vColor = color;',
    '#ifdef USE_INSTANCING_COLOR',
    'float tone = fract(instanceColor.r * 7.13 + instanceColor.b * 3.7);',
    'if (aKind == 1.0) vColor = instanceColor * color.r;',
    'else if (aKind == 2.0) vColor = mix(vec3(0.05, 0.07, 0.13), mix(instanceColor.zxy * 0.5, vec3(0.3, 0.26, 0.2), 0.5), tone) * color.r;',
    'else if (aKind == 3.0) vColor = mix(vec3(0.92, 0.62, 0.42), vec3(0.34, 0.17, 0.09), tone * tone) * color.r;',
    'else if (aKind == 4.0) vColor = mix(vec3(0.02, 0.015, 0.012), vec3(0.42, 0.23, 0.07), fract(tone * 3.1) * fract(tone * 3.1)) * color.r;',
    '#endif'
  ].join('\n');

  var scratch = { x: 0, y: 0, z: 0, ground: 0 };
  var cr = TR.crowds = {
    mesh: null, people: [], max: 90, scareAt: null, scareT: 0, lureAt: null, lureT: 0, cheerT: 0, segs: [], walk: null,
    init: function (scene, count) {
      cr.max = count || 90;
      D.ROADS.forEach(function (R) {
        for (var i = 0; i < R.pts.length - 1; i++) {
          var a = R.pts[i], b = R.pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          cr.segs.push({ ax: a[0], az: a[1], ux: (b[0] - a[0]) / l, uz: (b[1] - a[1]) / l, l: l, w: R.w });
        }
      });
      var geo = bodyGeometry(), N = 240;
      cr.walk = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
      cr.walk.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aWalk', cr.walk);
      var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      mat.onBeforeCompile = function (sh) {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + WALK_GLSL)
          .replace('#include <begin_vertex>', WALK_MAIN).replace('#include <color_vertex>', COLOR_MAIN);
      };
      cr.mesh = new THREE.InstancedMesh(geo, mat, N);
      cr.mesh.frustumCulled = false;
      cr.mesh.castShadow = true;
      cr.mesh.setColorAt(0, col.setHex(0xffffff));
      scene.add(cr.mesh);
      for (var i = 0; i < N; i++) cr.people.push({ x: 1e6, y: 0, z: 1e6, h: 0, th: 0, sp: 1.5, c: SHIRTS[i % SHIRTS.length], s: 0.9 + ((i * 7) % 6) * 0.035, ph: i * 0.7, off: true, seg: null, u: 0, dir: 1, lane: 1.6, side: 1, pause: 0, wander: 0 });
      cr.mesh.count = 0;
    },
    /** Puts someone on a stretch of pavement near a point, or in open ground in the Under City. */
    place: function (p, cx, cz, y, near) {
      var ang = Math.random() * 6.283, r = near ? 25 + Math.random() * 90 : 85 + Math.random() * 40, x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
      p.y = y; p.off = false; p.pause = 0; p.sp = 1.3 + Math.random() * 1.2; p.ph = Math.random() * 6.28;
      p.seg = null;
      if (y < -20) { p.x = x; p.z = z; p.h = p.th = Math.random() * 6.283; p.wander = Math.random() * 4; }
      else {
        if (TR.world.isWater(x, z)) { p.off = true; return; }
        var best = null, bd = 900 * 900, bu = 0, bs = 1;
        for (var i = 0; i < cr.segs.length; i++) {
          var S = cr.segs[i], t = Math.max(0, Math.min(S.l, (x - S.ax) * S.ux + (z - S.az) * S.uz)), px = S.ax + S.ux * t, pz = S.az + S.uz * t, d = (x - px) * (x - px) + (z - pz) * (z - pz);
          if (d < bd) { bd = d; best = S; bu = t; bs = ((x - px) * -S.uz + (z - pz) * S.ux) >= 0 ? 1 : -1; }
        }
        if (!best || bd > 3600) { p.off = true; return; }
        p.seg = best; p.u = bu; p.side = bs; p.dir = Math.random() < 0.5 ? 1 : -1;
        p.lane = best.w / 2 + 1.2 + Math.random() * 1.6;
        p.x = best.ax + best.ux * p.u - best.uz * p.lane * p.side; p.z = best.az + best.uz * p.u + best.ux * p.lane * p.side;
        if (TR.world.isWater(p.x, p.z)) { p.off = true; return; }
        p.h = p.th = Math.atan2(-best.ux * p.dir, -best.uz * p.dir);
      }
    },
    blockedAt: function (x, y, z) {
      var list = TR.world.collide.near(x, z, 0.8, cr.tmp || (cr.tmp = []));
      for (var i = 0; i < list.length; i++) { var b = list[i]; if (b.y1 - y > 0.5 && b.y0 - y < 2 && x > b.x0 - 0.5 && x < b.x1 + 0.5 && z > b.z0 - 0.5 && z < b.z1 + 0.5) return true; }
      return false;
    },
    scare: function (pos, secs) { cr.scareAt = { x: pos.x, z: pos.z }; cr.scareT = secs || 3; },
    lure: function (pos, secs) { cr.lureAt = { x: pos.x, z: pos.z }; cr.lureT = secs || 2; },
    cheer: function (secs) { cr.cheerT = secs || 2; },
    update: function (dt, pos, t, hidden) {
      if (hidden) { cr.mesh.count = 0; return; }
      cr.scareT = Math.max(0, cr.scareT - dt); cr.lureT = Math.max(0, cr.lureT - dt); cr.cheerT = Math.max(0, cr.cheerT - dt);
      var y = pos.y < -20 ? D.UNDER_Y : 0, n = cr.max, count = 0, W = cr.walk.array, world = TR.world;
      for (var i = 0; i < n; i++) {
        var p = cr.people[i], dx = p.x - pos.x, dz = p.z - pos.z, d2 = dx * dx + dz * dz;
        if (p.off || d2 > 19000 || Math.abs(p.y - y) > 5) {
          if (Math.random() < 0.1) cr.place(p, pos.x, pos.z, y, p.off && t < 3);
          if (p.off) continue;
          dx = p.x - pos.x; dz = p.z - pos.z; d2 = dx * dx + dz * dz;
        }
        var sp = p.sp, mode = 0, amp = 1, cheering = false;
        if (cr.scareT > 0 && cr.scareAt) { var ax = p.x - cr.scareAt.x, az = p.z - cr.scareAt.z; if (ax * ax + az * az < 900) { p.th = Math.atan2(-ax, -az); sp = 6.5 + p.sp; mode = 1; } }
        else if (cr.lureT > 0 && cr.lureAt) { var bx = cr.lureAt.x - p.x, bz = cr.lureAt.z - p.z, b2 = bx * bx + bz * bz; if (b2 < 1600 && b2 > 9) { p.th = Math.atan2(-bx, -bz); sp = 4.5; mode = 1; } }
        else if (cr.cheerT > 0 && d2 < 2500) { sp = 0; mode = 2; cheering = true; p.th = Math.atan2(dx, dz); }
        if (mode === 0) {
          if (p.pause > 0) { p.pause -= dt; sp = 0; }
          else if (Math.random() < dt * 0.05) p.pause = 1 + Math.random() * 3.5;     // people stop and look at things
          if (p.seg && sp > 0) {
            var S = p.seg;
            p.u += p.dir * sp * dt;
            if (p.u < 2 || p.u > S.l - 2) { p.dir = -p.dir; p.u = Math.max(2, Math.min(S.l - 2, p.u)); p.pause = 0.4; }
            var tx = S.ax + S.ux * p.u - S.uz * p.lane * p.side, tz = S.az + S.uz * p.u + S.ux * p.lane * p.side;
            // something on the pavement ahead: drift outward round it, or turn back
            if (cr.tickBlock(p, i, t, S, world)) { tx = S.ax + S.ux * p.u - S.uz * p.lane * p.side; tz = S.az + S.uz * p.u + S.ux * p.lane * p.side; }
            var mx = tx - p.x, mz = tz - p.z, ml = Math.hypot(mx, mz);
            if (ml > 0.0001) { p.th = Math.atan2(-mx, -mz); p.x += mx / ml * Math.min(ml, sp * dt * 1.4); p.z += mz / ml * Math.min(ml, sp * dt * 1.4); }
          } else if (!p.seg && sp > 0) {
            p.wander -= dt;
            if (p.wander <= 0) { p.wander = 2 + Math.random() * 5; p.th += (Math.random() - 0.5) * 2.2; }
            var fx = -Math.sin(p.th), fz = -Math.cos(p.th);
            if (i % 6 === Math.floor(t * 20) % 6 && cr.blockedAt(p.x + fx * 2, y, p.z + fz * 2)) p.th += 1.2 + Math.random();
            p.x += fx * sp * dt; p.z += fz * sp * dt;
          }
        } else if (sp > 0) { p.x += -Math.sin(p.th) * sp * dt; p.z += -Math.cos(p.th) * sp * dt; p.seg = null; p.wander = 3; }
        // nobody walks through anything: the same collision the player has
        if (d2 < 14000) {
          scratch.x = p.x; scratch.y = p.y; scratch.z = p.z;
          var hit = world.collide.resolve(scratch, 0.5, 2.4, 0.4, p.y);
          if (hit) { p.x = scratch.x; p.z = scratch.z; if (!p.seg) p.th += 0.6; }
          if (y === 0 && world.isWater(p.x, p.z)) { p.off = true; continue; }
        }
        // keep clear of the hero
        if (d2 < 1.8) { var dl = Math.sqrt(d2) || 1; p.x = pos.x + dx / dl * 1.34; p.z = pos.z + dz / dl * 1.34; }
        // turn smoothly, not on the spot
        var dh = ((p.th - p.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        p.h += dh * Math.min(1, dt * 6);
        p.ph += sp * dt * 2.9 + (cheering ? dt * 7 : 0);
        p.amp = (p.amp || 0) + ((sp > 0.1 ? Math.min(1.15, 0.5 + sp * 0.2) : 0) - (p.amp || 0)) * Math.min(1, dt * 7);
        amp = p.amp;
        dummy.position.set(p.x, p.y + (cheering ? Math.abs(Math.sin(t * 8 + i)) * 0.5 : 0), p.z); dummy.rotation.set(0, p.h, 0); dummy.scale.set(p.s, p.s * (0.97 + (i % 5) * 0.02), p.s); dummy.updateMatrix();
        cr.mesh.setMatrixAt(count, dummy.matrix);
        cr.mesh.setColorAt(count, col.setHex(p.c));
        W[count * 3] = p.ph; W[count * 3 + 1] = amp; W[count * 3 + 2] = cheering ? 1 : 0;
        count++;
      }
      cr.mesh.count = count;
      cr.mesh.instanceMatrix.needsUpdate = true;
      cr.walk.needsUpdate = true;
      if (cr.mesh.instanceColor) cr.mesh.instanceColor.needsUpdate = true;
    },
    // Each person looks ahead a few times a second, not every frame.
    tickBlock: function (p, i, t, S, world) {
      if (i % 5 !== Math.floor(t * 15) % 5) return false;
      var ax = S.ax + S.ux * (p.u + p.dir * 1.8) - S.uz * p.lane * p.side, az = S.az + S.uz * (p.u + p.dir * 1.8) + S.ux * p.lane * p.side;
      if (!cr.blockedAt(ax, p.y, az)) return false;
      if (p.lane < S.w / 2 + 3.2) p.lane += 0.8; else if (p.lane > S.w / 2 + 1) { p.dir = -p.dir; p.lane = S.w / 2 + 1.2; }
      return true;
    }
  };
})();
