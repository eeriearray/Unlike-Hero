/* The blocky hero: arcade movement, double jump, visible growth. Collision size never changes. */
(function () {
  var TR = window.TR = window.TR || {};
  var RADIUS = 0.7, HEIGHT = 2.6, WALK = 10, SPRINT = 18, ACCEL = 70, JUMP = 10.5, GRAVITY = 28;

  function part(w, h, d, color, x, y, z, parent) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: color }));
    m.position.set(x, y, z); m.castShadow = true;
    parent.add(m);
    return m;
  }

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
      var g = pl.group = new THREE.Group(), p = pl.parts;
      p.body = part(1.2, 1.2, 0.7, 0x2f80ed, 0, 1.3, 0, g);
      p.head = part(0.95, 0.95, 0.95, 0xffd9a8, 0, 2.4, 0, g);
      part(0.14, 0.2, 0.05, 0x222222, -0.22, 2.48, -0.49, g);
      part(0.14, 0.2, 0.05, 0x222222, 0.22, 2.48, -0.49, g);
      part(0.36, 0.08, 0.05, 0x8b3a2b, 0, 2.2, -0.49, g);
      p.armL = part(0.36, 1.1, 0.42, 0xffd9a8, -0.82, 1.35, 0, g);
      p.armR = part(0.36, 1.1, 0.42, 0xffd9a8, 0.82, 1.35, 0, g);
      p.legL = part(0.5, 0.9, 0.55, 0x2e3a59, -0.32, 0.45, 0, g);
      p.legR = part(0.5, 0.9, 0.55, 0x2e3a59, 0.32, 0.45, 0, g);
      [p.armL, p.armR, p.legL, p.legR].forEach(function (m) { m.geometry.translate(0, -m.geometry.parameters.height / 2 + 0.05, 0); m.position.y += m.geometry.parameters.height / 2 - 0.05; });
      scene.add(g);
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
          if (TR.audio) TR.audio.jump(pl.jumps);
        }
      }
      pl.vel.y -= GRAVITY * dt;
      pl.pos.x += pl.vel.x * dt; pl.pos.y += pl.vel.y * dt; pl.pos.z += pl.vel.z * dt;
      var base = TR.app.floorAt(pl.pos);
      TR.world.collide.resolve(pl.pos, RADIUS, HEIGHT, 0.75, base);
      var ground = pl.pos.ground;
      if (pl.pos.y <= ground) {
        if (!pl.grounded && pl.vel.y < -14) { pl.squash = 0.3; }
        pl.pos.y = ground; pl.vel.y = 0; pl.grounded = true; pl.jumps = 0;
      } else if (pl.pos.y - ground > 0.05) pl.grounded = false;
      if (wl > 0.1) {
        var want = Math.atan2(-pl.vel.x, -pl.vel.z), d = ((want - pl.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        pl.heading += d * Math.min(1, dt * 14);
      }
      var sp = Math.hypot(pl.vel.x, pl.vel.z);
      pl.walkT += sp * dt * 0.9;
      pl.animate(dt, sp);
      pl.updateGrowth(dt);
    },
    animate: function (dt, sp) {
      var p = pl.parts, swing = Math.sin(pl.walkT) * Math.min(1, sp / 10) * 0.95;
      if (!pl.grounded) { swing = 0.5; }
      p.legL.rotation.x = swing; p.legR.rotation.x = -swing; p.armL.rotation.x = -swing; p.armR.rotation.x = swing;
      pl.squash *= Math.pow(0.002, dt);
      var g = pl.group;
      g.position.copy(pl.pos);
      g.rotation.y = pl.heading;
      g.scale.set(1 + pl.squash * 0.6, 1 - pl.squash, 1 + pl.squash * 0.6);
    },
    /** Crown, gold outfit, carpet trail, bodyguards. Looks only; the collision stays the same size. */
    setGrowth: function (spent) {
      var R = window.TRD.rules, p = pl.parts;
      var stage = 0; R.GROWTH.forEach(function (g, i) { if (spent >= g.at) stage = i + 1; });
      if (stage === pl.stage) return;
      pl.stage = stage;
      if (!p.crown) {
        p.crown = part(0.9, 0.35, 0.9, 0xffc53d, 0, 3.05, 0, pl.group); p.crown.castShadow = false;
        p.g1 = guard(); p.g2 = guard();
        pl.carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ color: 0xd9352c }));
        pl.carpetMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.05, 2.4), new THREE.MeshBasicMaterial({ color: 0xd9352c }), 40);
        pl.carpetMesh.frustumCulled = false; pl.carpetMesh.count = 0;
        pl.group.parent.add(pl.carpetMesh);
        pl.trail = [];
      }
      p.crown.visible = stage >= 1;
      p.body.material.color.setHex(stage >= 2 ? 0xffc53d : 0x2f80ed);
      p.legL.material.color.setHex(stage >= 2 ? 0xd59a14 : 0x2e3a59); p.legR.material.color.setHex(stage >= 2 ? 0xd59a14 : 0x2e3a59);
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
