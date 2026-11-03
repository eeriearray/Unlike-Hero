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
    /** Sitting in a vehicle: hide the walking rig. */
    setVisible: function (v) { pl.group.visible = v; },
    radius: RADIUS, height: HEIGHT
  };
})();
