/* Vehicles: arcade handling, one table per vehicle. M1 ships the sports car; M4 fills in the rest. */
(function () {
  var TR = window.TR = window.TR || {};

  var SPECS = {
    sports_car: { name: 'Sports Car', speed: 45, accel: 34, brake: 60, turn: 2.5, grip: 3.4, driftGrip: 1.15, radius: 1.9, height: 2, step: 0.8, cam: 15, sound: 'car', build: carModel }
  };

  function carModel(color) {
    var g = new THREE.Group(), mat = function (c) { return new THREE.MeshLambertMaterial({ color: c }); };
    var add = function (w, h, d, c, x, y, z) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    add(3, 0.8, 5.6, color || 0xff2d2d, 0, 0.85, 0);
    add(2.5, 0.7, 2.4, 0x1c2a3a, 0, 1.55, 0.1);
    add(2.6, 0.12, 2.5, color || 0xff2d2d, 0, 1.95, 0.1);
    add(0.5, 0.25, 0.1, 0xfff6c0, -1, 0.95, -2.82); add(0.5, 0.25, 0.1, 0xfff6c0, 1, 0.95, -2.82);
    add(0.5, 0.25, 0.1, 0xff3030, -1, 0.95, 2.82); add(0.5, 0.25, 0.1, 0xff3030, 1, 0.95, 2.82);
    add(2.8, 0.14, 0.5, 0x222222, 0, 1.5, 2.6);
    g.userData.wheels = [[-1.5, 0.45, -1.8], [1.5, 0.45, -1.8], [-1.5, 0.45, 1.8], [1.5, 0.45, 1.8]].map(function (p) { var w = add(0.5, 0.9, 0.9, 0x18181c, p[0], p[1], p[2]); return w; });
    return g;
  }

  var vs = TR.vehicles = {
    SPECS: SPECS, placed: {}, current: null, scene: null, cooldown: 0,
    init: function (scene) { vs.scene = scene; },
    /** Puts a vehicle in the world beside a point. Each kind has one body. */
    spawn: function (kind, x, y, z, heading) {
      var spec = SPECS[kind]; if (!spec) return null;
      var v = vs.placed[kind];
      if (!v) {
        v = vs.placed[kind] = { kind: kind, spec: spec, group: spec.build(), pos: new THREE.Vector3(), vel: new THREE.Vector3(), speed: 0, heading: 0, slip: 0, grounded: true, vy: 0 };
        vs.scene.add(v.group);
      }
      v.pos.set(x, y, z); v.heading = heading || 0; v.speed = 0; v.vel.set(0, 0, 0); v.vy = 0;
      v.group.visible = true;
      vs.sync(v);
      return v;
    },
    nearest: function (p, reach) {
      var best = null, bd = reach * reach;
      for (var k in vs.placed) { var v = vs.placed[k]; if (!v.group.visible) continue; var d = (v.pos.x - p.x) * (v.pos.x - p.x) + (v.pos.z - p.z) * (v.pos.z - p.z); if (d < bd && Math.abs(v.pos.y - p.y) < 6) { bd = d; best = v; } }
      return best;
    },
    board: function (v) { vs.current = v; TR.player.setVisible(false); if (TR.audio) TR.audio.engine(v.spec.sound); TR.hud && TR.hud.carry(v.spec.name); },
    leave: function () {
      var v = vs.current; if (!v) return;
      vs.current = null;
      var side = v.heading + Math.PI / 2;
      TR.player.teleport(v.pos.x + Math.cos(side) * (v.spec.radius + 1.6), v.pos.y + 0.2, v.pos.z - Math.sin(side) * (v.spec.radius + 1.6), v.heading);
      TR.world.collide.resolve(TR.player.pos, TR.player.radius, TR.player.height, 0.75, 0);
      TR.player.setVisible(true);
      if (TR.audio) TR.audio.engine(null);
      TR.hud && TR.hud.carry(null);
    },
    drive: function (dt) {
      var v = vs.current, s = v.spec, input = TR.input, a = input.axes();
      var drift = input.down('Space') || input.down('ShiftLeft');
      var target = a.z > 0 ? s.speed * a.z : (a.z < 0 ? -s.speed * 0.4 : 0);
      var rate = a.z === 0 ? 12 : (Math.sign(target) !== Math.sign(v.speed) && Math.abs(v.speed) > 1 ? s.brake : s.accel);
      v.speed += Math.max(-rate * dt, Math.min(rate * dt, target - v.speed));
      if (drift) v.speed *= Math.pow(0.8, dt);
      var turnScale = Math.min(1, Math.abs(v.speed) / 12) * (v.speed >= 0 ? 1 : -1);
      v.heading -= a.x * s.turn * (drift ? 1.3 : 1) * turnScale * dt;
      // velocity chases where the nose points; a low grip while drifting lets the tail slide out
      var fx = -Math.sin(v.heading), fz = -Math.cos(v.heading), grip = drift ? s.driftGrip : s.grip, k = 1 - Math.exp(-grip * dt * 2.4);
      v.vel.x += (fx * v.speed - v.vel.x) * k;
      v.vel.z += (fz * v.speed - v.vel.z) * k;
      var lat = Math.abs(v.vel.x * -fz + v.vel.z * fx);
      v.slip = lat;
      v.pos.x += v.vel.x * dt; v.pos.z += v.vel.z * dt;
      v.vy -= 30 * dt; v.pos.y += v.vy * dt;
      var hit = TR.world.collide.resolve(v.pos, s.radius, s.height, s.step, TR.app.floorAt(v.pos));
      if (v.pos.y <= v.pos.ground) { v.pos.y = v.pos.ground; v.vy = 0; }
      if (hit) {
        if (Math.abs(v.speed) > 14) { TR.cam.shake = Math.min(0.8, TR.cam.shake + 0.45); if (TR.audio) TR.audio.thud(); }
        v.speed *= Math.pow(0.05, dt);
        v.vel.multiplyScalar(Math.pow(0.02, dt));
      }
      if (input.hit('KeyH') && TR.audio) TR.audio.horn(v.kind);
      if (v.slip > 9 && TR.fx) TR.fx.skid(v.pos);
      if (TR.audio) TR.audio.engineLevel(Math.abs(v.speed) / s.speed, v.slip);
      TR.player.pos.copy(v.pos);
      vs.sync(v);
    },
    sync: function (v) {
      v.group.position.copy(v.pos);
      v.group.rotation.set(0, v.heading, 0);
      v.group.rotation.z = Math.max(-0.14, Math.min(0.14, (v.slip || 0) * 0.012 * Math.sign(TR.input.axes().x || 0)));
    }
  };
})();
