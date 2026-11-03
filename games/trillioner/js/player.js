/* The blocky hero: arcade movement, double jump, visible growth. Collision size never changes. */
(function () {
  var TR = window.TR = window.TR || {};
  var RADIUS = 0.7, HEIGHT = 2.6, WALK = 10, SPRINT = 18, ACCEL = 70, JUMP = 10.5, GRAVITY = 28;

  function part(w, h, d, color, x, y, z, parent) {
    var r = Math.min(w, h, d) * 0.46, g = new TR.Geo().rbox(0, -h / 2, 0, w, h, d, 0xffffff, r, r, 3).geometry();
    var m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: color, vertexColors: true }));
    m.position.set(x, y, z); m.castShadow = true;
    parent.add(m);
    return m;
  }
  function ball(rx, ry, rz, color, x, y, z, parent) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), new THREE.MeshLambertMaterial({ color: color }));
    m.scale.set(rx, ry, rz); m.position.set(x, y, z); m.castShadow = true;
    parent.add(m);
    return m;
  }
  /** A joint: a group at the pivot, the part hanging below it. */
  function limb(w, h, d, color, x, y, z, parent) {
    var j = new THREE.Group(); j.position.set(x, y, z); parent.add(j);
    j.userData.mesh = part(w, h, d, color, 0, -h / 2 + 0.04, 0, j);
    return j;
  }

  function run01(sp) { return Math.min(1, Math.max(0, (sp - 8) / 10)); }   // cadence: quick steps walking, longer strides running
  function guard() {
    var g = new THREE.Group();
    part(1.2, 1.3, 0.7, 0x111118, 0, 1.3, 0, g); part(0.9, 0.9, 0.9, 0xd8b48c, 0, 2.4, 0, g); part(0.92, 0.2, 0.2, 0x000000, 0, 2.5, -0.42, g);
    part(0.5, 0.9, 0.55, 0x111118, -0.3, 0.45, 0, g); part(0.5, 0.9, 0.55, 0x111118, 0.3, 0.45, 0, g);
    g.visible = false;
    TR.player.group.parent.add(g);
    return g;
  }
  var pl = TR.player = {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), heading: 0, grounded: true, jumps: 0, floor: 0, walkT: 0, group: null, parts: {}, squash: 0, hidden: false,
    init: function (scene) {
      var g = pl.group = new THREE.Group(), p = pl.parts, SKIN = 0xf7cfa6, HAIR = 0x3b2a20, SHOE = 0xf4f4f4, SHIRT = 0x2f80ed, TROUSER = 0x2e3a59;
      g.rotation.order = 'YXZ';
      // upper body hangs off the hips, so it can lean and twist on its own
      var hips = p.hips = new THREE.Group(); hips.position.y = 1.02; g.add(hips);
      p.pelvis = part(0.68, 0.34, 0.42, TROUSER, 0, 0.02, 0, hips);
      var chest = p.chest = new THREE.Group(); chest.position.y = 0.14; hips.add(chest);
      p.body = part(0.78, 0.82, 0.46, SHIRT, 0, 0.38, 0, chest);
      part(0.44, 0.1, 0.05, 0xffffff, 0, 0.74, -0.22, chest);                  // collar
      part(0.26, 0.2, 0.26, SKIN, 0, 0.86, 0, chest);                          // neck
      var head = p.headJ = new THREE.Group(); head.position.y = 0.96; chest.add(head);
      p.head = ball(0.41, 0.44, 0.41, SKIN, 0, 0.34, 0, head);
      ball(0.43, 0.32, 0.43, HAIR, 0, 0.52, 0.04, head);                       // hair
      ball(0.09, 0.11, 0.05, 0x1d1d24, -0.15, 0.36, -0.39, head);              // eyes
      ball(0.09, 0.11, 0.05, 0x1d1d24, 0.15, 0.36, -0.39, head);
      ball(0.06, 0.06, 0.05, 0xf2b98c, 0, 0.26, -0.42, head);                  // nose
      part(0.24, 0.05, 0.04, 0xb5503c, 0, 0.13, -0.39, head);                  // smile
      p.armL = limb(0.24, 0.5, 0.26, SHIRT, -0.53, 0.68, 0, chest);
      p.armR = limb(0.24, 0.5, 0.26, SHIRT, 0.53, 0.68, 0, chest);
      p.foreL = limb(0.2, 0.46, 0.22, SKIN, 0, -0.44, 0, p.armL);
      p.foreR = limb(0.2, 0.46, 0.22, SKIN, 0, -0.44, 0, p.armR);
      ball(0.13, 0.14, 0.14, SKIN, 0, -0.46, 0, p.foreL); ball(0.13, 0.14, 0.14, SKIN, 0, -0.46, 0, p.foreR);
      p.legL = limb(0.3, 0.52, 0.34, TROUSER, -0.2, -0.04, 0, hips);
      p.legR = limb(0.3, 0.52, 0.34, TROUSER, 0.2, -0.04, 0, hips);
      p.shinL = limb(0.26, 0.46, 0.3, TROUSER, 0, -0.46, 0, p.legL);
      p.shinR = limb(0.26, 0.46, 0.3, TROUSER, 0, -0.46, 0, p.legR);
      part(0.3, 0.17, 0.52, SHOE, 0, -0.48, -0.08, p.shinL); part(0.3, 0.17, 0.52, SHOE, 0, -0.48, -0.08, p.shinR);
      scene.add(g);
      pl.shadow = null;
    },
    teleport: function (x, y, z, h) { pl.pos.set(x, y, z); pl.vel.set(0, 0, 0); if (h != null) pl.heading = h; TR.cam.snap(pl.pos); pl.floor = y; },
    update: function (dt, moving) {
      var input = TR.input, a = input.axes(), yaw = input.yaw;
      var fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      var wx = rx * a.x + fx * a.z, wz = rz * a.x + fz * a.z, wl = Math.hypot(wx, wz);
      var sprint = input.down('ShiftLeft') || input.down('ShiftRight') || input.sprintHeld;
      var speed = (sprint ? SPRINT : WALK);
      var tx = wl ? wx / wl * speed * Math.min(1, wl) : 0, tz = wl ? wz / wl * speed * Math.min(1, wl) : 0;
      var accel = pl.grounded ? ACCEL : ACCEL * 0.55;
      pl.vel.x += Math.max(-accel * dt, Math.min(accel * dt, tx - pl.vel.x));
      pl.vel.z += Math.max(-accel * dt, Math.min(accel * dt, tz - pl.vel.z));
      // golden umbrella: hold Space while falling
      if (TR.vehicles.gear === 'parachute' && !pl.grounded && pl.vel.y < -2 && input.down('Space')) pl.vel.y = Math.max(pl.vel.y, -3.5);
      if (input.hit('Space') || input.jumpTap) {
        if (pl.grounded || pl.jumps < 2) {
          pl.vel.y = pl.jumps === 1 ? JUMP * 0.92 : JUMP;
          pl.jumps++;
          pl.grounded = false;
          pl.squash = -0.3;
          TR.fx.dust(pl.pos);
          if (TR.audio) TR.audio.jump(pl.jumps);
        }
      }
      pl.vel.y -= GRAVITY * dt;
      pl.pos.x += pl.vel.x * dt; pl.pos.y += pl.vel.y * dt; pl.pos.z += pl.vel.z * dt;
      var base = TR.app.floorAt(pl.pos);
      TR.world.collide.resolve(pl.pos, RADIUS, HEIGHT, 0.75, base);
      // parked vehicles are solid too
      for (var vk in TR.vehicles.placed) {
        var pv = TR.vehicles.placed[vk];
        if (!pv.group.visible || pv.spec.mode === 'jet' || Math.abs(pv.pos.y - pl.pos.y) > 3) continue;
        var vx = pl.pos.x - pv.pos.x, vz = pl.pos.z - pv.pos.z, vd = Math.hypot(vx, vz), vr = pv.spec.radius + RADIUS;
        if (vd < vr && vd > 0.001) { pl.pos.x = pv.pos.x + vx / vd * vr; pl.pos.z = pv.pos.z + vz / vd * vr; }
      }
      var ground = pl.pos.ground;
      if (pl.pos.y <= ground) {
        if (!pl.grounded && pl.vel.y < -9) { pl.squash = 0.32; TR.fx.dust(pl.pos); TR.fx.dust(pl.pos); }
        pl.pos.y = ground; pl.vel.y = 0; pl.grounded = true; pl.jumps = 0;
      } else if (pl.grounded && pl.vel.y <= 0 && pl.pos.y - ground < 0.6) { pl.pos.y = ground; pl.vel.y = 0; }   // stay on the ground going downhill
      else if (pl.pos.y - ground > 0.05) pl.grounded = false;
      if (wl > 0.1) {
        var want = Math.atan2(-pl.vel.x, -pl.vel.z), d = ((want - pl.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        pl.turnRate = d;
        pl.heading += d * Math.min(1, dt * 11);
      }
      var sp = Math.hypot(pl.vel.x, pl.vel.z);
      pl.dustT = (pl.dustT || 0) - dt;
      if (sp > 14 && pl.grounded && pl.dustT <= 0) { pl.dustT = 0.09; TR.fx.dust(pl.pos); }
      pl.walkT += sp * dt * (1.42 - run01(sp) * 0.42);
      pl.animate(dt, sp);
      pl.updateGrowth(dt);
    },
    animate: function (dt, sp) {
      var p = pl.parts, t = pl.walkT, run = Math.min(1, sp / 18), go = Math.min(1, sp / 7);
      var s = Math.sin(t), c = Math.cos(t), k = 1 - Math.pow(0.0005, dt);
      function to(obj, ax, v) { obj.rotation[ax] += (v - obj.rotation[ax]) * k; }
      if (!pl.grounded) {            // airborne: knees up, arms out
        var up = pl.vel.y > 0 ? 1 : 0.5;
        to(p.legL, 'x', 1.1 * up); to(p.shinL, 'x', -1.3 * up); to(p.legR, 'x', -0.3); to(p.shinR, 'x', -0.5);
        to(p.armL, 'x', -0.7); to(p.armR, 'x', 0.8); to(p.armL, 'z', -0.5); to(p.armR, 'z', 0.5); to(p.foreL, 'x', 0.4); to(p.foreR, 'x', 0.4);
        to(p.chest, 'x', -0.08); to(p.hips, 'y', 0);
      } else {
        // A walk cycle, set directly so the limbs stay in step. Forward swing is +x on the hip; a knee only folds backward (-x).
        var hip = (0.62 + run * 0.42) * go, knee = (0.6 + run * 0.95) * go, arm = (0.5 + run * 0.55) * go;
        p.legL.rotation.x = s * hip; p.legR.rotation.x = -s * hip;
        // each knee folds while that leg swings forward, and the planted leg stays nearly straight
        p.shinL.rotation.x = -Math.max(0, c) * knee - 0.04 * go; p.shinR.rotation.x = -Math.max(0, -c) * knee - 0.04 * go;
        // opposite arm to opposite leg, with a bent elbow that bends more at a run
        p.armL.rotation.x = -s * arm; p.armR.rotation.x = s * arm; p.armL.rotation.z = -0.08; p.armR.rotation.z = 0.08;
        p.foreL.rotation.x = 0.28 + run * 0.95 * go + Math.max(0, s) * 0.3 * go; p.foreR.rotation.x = 0.28 + run * 0.95 * go + Math.max(0, -s) * 0.3 * go;
        // the body is highest with the planted leg straight, the hips turn with the forward leg and the shoulders against it
        to(p.chest, 'x', 0.04 * go + run * 0.16);
        p.chest.rotation.y = s * 0.12 * go; p.hips.rotation.y = -s * 0.1 * go; p.hips.rotation.z = c * 0.025 * go;
        p.hips.position.y = 1.0 + Math.abs(s) * -0.05 * go + 0.03 * go;
        // standing still: a slow breath
        if (go < 0.1) { p.chest.scale.y = 1 + Math.sin(performance.now() * 0.002) * 0.012; p.headJ.rotation.y = Math.sin(performance.now() * 0.0007) * 0.18; } else { p.chest.scale.y = 1; p.headJ.rotation.y *= 0.9; }
      }
      pl.squash *= Math.pow(0.002, dt);
      var g = pl.group;
      g.position.copy(pl.pos);
      g.rotation.y = pl.heading;
      g.rotation.z += (-(pl.turnRate || 0) * 0.05 * go - g.rotation.z) * k;      // bank into turns
      g.scale.set(1 + pl.squash * 0.6, 1 - pl.squash, 1 + pl.squash * 0.6);
    },
    /** Clout looks: hat, outfit, trail colour. */
    applyLooks: function () {
      var e = TR.save.get('equipped', {}), p = pl.parts, M = TR.menus;
      if (pl.hat) { pl.hat.parent.remove(pl.hat); pl.hat = null; }
      var hat = new THREE.Group(), id = e.Hats;
      function hp(w, h, d, c, y) { var m = part(w, h, d, c, 0, y, 0, hat); m.castShadow = false; return m; }
      if (id === 'hat_top') { hp(1.3, 0.1, 1.3, 0x18181c, 2.92); hp(0.8, 0.8, 0.8, 0x18181c, 3.3); }
      else if (id === 'hat_cowboy') { hp(1.8, 0.1, 1.2, 0x8d5a2b, 2.92); hp(0.9, 0.5, 0.8, 0x8d5a2b, 3.15); }
      else if (id === 'hat_party') { hp(0.8, 0.3, 0.8, 0xff5ad1, 3); hp(0.5, 0.3, 0.5, 0x7dffea, 3.3); hp(0.2, 0.3, 0.2, 0xffc53d, 3.6); }
      else if (id === 'hat_chef') { hp(1, 0.3, 1, 0xffffff, 3); hp(1.2, 0.4, 1.2, 0xffffff, 3.35); }
      else if (id === 'hat_halo') { hp(1.3, 0.1, 0.2, 0xffd24a, 3.6); hp(0.2, 0.1, 1.3, 0xffd24a, 3.6); }
      if (id) { hat.position.y = -2.1; pl.parts.headJ.add(hat); pl.hat = hat; }
      pl.look = { outfit: null, trail: null, skin: null };
      var o = e.Outfits && M.item('Outfits', e.Outfits); if (o) pl.look.outfit = o[3];
      var tr = e.Trails && M.item('Trails', e.Trails); if (tr) pl.look.trail = tr[3];
      var sk = e.Skins && M.item('Skins', e.Skins); if (sk) pl.look.skin = sk[3];
      pl.stage = -1;
      pl.setGrowth(pl.spentNow || 0);
      Object.keys(TR.vehicles.placed).forEach(function (k) { TR.vehicles.applySkin(TR.vehicles.placed[k]); });
    },
    /** Crown, gold outfit, carpet trail, bodyguards. Looks only; the collision stays the same size. */
    setGrowth: function (spent) {
      var R = window.TRD.rules, p = pl.parts;
      pl.spentNow = spent;
      var stage = 0; R.GROWTH.forEach(function (g, i) { if (spent >= g.at) stage = i + 1; });
      if (stage === pl.stage) return;
      pl.stage = stage;
      if (!p.crown) {
        p.crown = part(0.7, 0.3, 0.7, 0xffc53d, 0, 0.92, 0, p.headJ); p.crown.castShadow = false;
        p.g1 = guard(); p.g2 = guard();
        pl.carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ color: 0xd9352c }));
        pl.carpetMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.05, 2.4), new THREE.MeshBasicMaterial({ color: 0xd9352c }), 40);
        pl.carpetMesh.frustumCulled = false; pl.carpetMesh.count = 0;
        pl.group.parent.add(pl.carpetMesh);
        pl.trail = [];
      }
      p.crown.visible = stage >= 1;
      var fit = pl.look && pl.look.outfit;
      p.body.material.color.setHex(fit || (stage >= 2 ? 0xffc53d : 0x2f80ed));
      if (pl.look && pl.look.trail) pl.carpetMesh.material.color.setHex(pl.look.trail);
      var sleeve = fit || (stage >= 2 ? 0xffc53d : 0x2f80ed), leg = stage >= 2 ? 0xd59a14 : 0x2e3a59;
      p.armL.userData.mesh.material.color.setHex(sleeve); p.armR.userData.mesh.material.color.setHex(sleeve);
      [p.legL, p.legR, p.shinL, p.shinR].forEach(function (j) { j.userData.mesh.material.color.setHex(leg); });
      p.pelvis.material.color.setHex(leg);
      pl.showCarpet = stage >= 3;
      p.g1.visible = p.g2.visible = stage >= 4;
      pl.fans = stage >= 5;
      if (!pl.showCarpet) { pl.trail = []; pl.carpetMesh.count = 0; }
    },
    updateGrowth: function (dt) {
      var p = pl.parts, m = pl.group;
      if (pl.showCarpet && pl.grounded && !TR.vehicles.current) {
        var last = pl.trail[pl.trail.length - 1];
        if (!last || Math.hypot(last.x - pl.pos.x, last.z - pl.pos.z) > 2.2) { pl.trail.push({ x: pl.pos.x, y: pl.pos.y, z: pl.pos.z, h: pl.heading }); if (pl.trail.length > 40) pl.trail.shift(); }
        var d = new THREE.Object3D();
        pl.trail.forEach(function (t, i) { d.position.set(t.x, t.y + 0.07, t.z); d.rotation.set(0, t.h, 0); d.updateMatrix(); pl.carpetMesh.setMatrixAt(i, d.matrix); });
        pl.carpetMesh.count = pl.trail.length;
        pl.carpetMesh.instanceMatrix.needsUpdate = true;
      }
      if (p.g1 && p.g1.visible) {
        var h = pl.heading;
        [p.g1, p.g2].forEach(function (gd, i) {
          var side = i ? 2.8 : -2.8, tx = pl.pos.x + Math.cos(h) * side + Math.sin(h) * 2.6, tz = pl.pos.z - Math.sin(h) * side + Math.cos(h) * 2.6;
          gd.position.x += (tx - gd.position.x) * Math.min(1, dt * 5); gd.position.z += (tz - gd.position.z) * Math.min(1, dt * 5); gd.position.y = pl.pos.y; gd.rotation.y = h;
        });
      }
      if (pl.fans && Math.random() < dt * 0.4) TR.crowds.lure(pl.pos, 2.5);
    },
    /** Sitting in a vehicle: hide the walking rig. */
    setVisible: function (v) { pl.group.visible = v; },
    radius: RADIUS, height: HEIGHT
  };
})();
