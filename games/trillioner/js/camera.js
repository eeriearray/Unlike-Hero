/* Third-person chase camera: follows behind, avoids walls, carries the purchase nudge. */
(function () {
  var TR = window.TR = window.TR || {};
  var cam = TR.cam = {
    follow: new THREE.Vector3(), dist: 9.5, fx: new THREE.Vector3(), shake: 0, kick: 0, cur: new THREE.Vector3(0, 8, 10), look: new THREE.Vector3(),
    roll: 0, aheadX: 0, aheadZ: 0, bob: 0, pull: 0, on: true,
    /** How fast you are going, and which way, whatever you are in. */
    motion: function () {
      var v = TR.vehicles.current, P = TR.player;
      if (v) return { speed: Math.abs(v.speed || 0), signed: v.speed || 0, heading: v.heading, top: v.spec.speed || 45, vehicle: true };
      var s = Math.hypot(P.vel.x, P.vel.z);
      return { speed: s, signed: s, heading: P.heading, top: 18, vehicle: false };
    },
    /**
     * The camera drives itself: once you stop touching the mouse it swings round behind the way you are going.
     * Any mouse movement takes over straight away, and it hands back gently a moment after you stop.
     */
    auto: function (target, dt, opts) {
      var input = TR.input, m = cam.motion();
      input.lookAge += dt;
      var go = Math.min(1, m.speed / m.top), hx = -Math.sin(m.heading), hz = -Math.cos(m.heading), reach = m.vehicle ? 5 : 1.6, e = 1 - Math.pow(0.03, dt);
      cam.aheadX += (hx * go * reach - cam.aheadX) * e; cam.aheadZ += (hz * go * reach - cam.aheadZ) * e;
      cam.bob = m.vehicle ? 0 : Math.sin((TR.player.walkT || 0) * 2) * 0.05 * go;
      if (!cam.on || input.frozen) return;
      var hand = Math.max(0, Math.min(1, (input.lookAge - 0.9) / 0.9));   // eases back in after you let go of the mouse
      if (hand <= 0 || m.speed < 1.5 || m.signed < -0.5) return;
      var diff = ((m.heading - input.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI, a = input.axes();
      // running straight at the camera: leave it, or walking back towards something would spin the world
      if (!m.vehicle && Math.abs(diff) > 2.5) return;
      var rate = m.vehicle ? 2 + go * 2.2 : 0.7 + go * 1.5;
      if (!m.vehicle && Math.abs(a.z) < 0.2) rate *= 0.55;   // sidestepping: a wide gentle arc, not a spin
      if (TR.interiors.current) rate *= 0.6;
      input.yaw += diff * (1 - Math.exp(-rate * hand * dt));
      // and it settles back to a good height
      var wantPitch = m.vehicle ? 0.13 : 0.17;
      input.pitch += (wantPitch - input.pitch) * (1 - Math.exp(-1.1 * hand * dt));
    },
    /** A little further back the faster you go. */
    pullBack: function (dt) {
      var m = cam.motion(), go = Math.min(1, m.speed / m.top), want = go * (m.vehicle ? 3.2 : 1.5);
      cam.pull += (want - cam.pull) * (1 - Math.pow(0.08, dt));
      return cam.pull;
    },
    toggleAuto: function () {
      cam.on = !cam.on;
      TR.save.set('autoCam', cam.on);
      TR.hud.toast(cam.on ? 'Camera follows you' : 'Camera stays where you point it');
    },
    /** Swing round a building you just bought. Moving cuts it short. */
    showOff: function (x, y, z, r, h) { cam.cine = { x: x, y: y, z: z, r: r, h: h, t: 0, dur: 2.2 }; },
    update: function (camera, target, dt, opts) {
      opts = opts || {};
      if (cam.cine) {
        var c = cam.cine, ax = TR.input.axes();
        c.t += dt;
        if (c.t > c.dur || (c.t > 0.5 && (ax.x || ax.z))) { cam.cine = null; cam.snap(target); }
        else {
          var a = c.t * 0.55 + Math.atan2(target.x - c.x, target.z - c.z), R = c.r * 1.25 + 14;
          camera.position.set(c.x + Math.sin(a) * R, c.y + c.h * 0.55 + 6, c.z + Math.cos(a) * R);
          camera.lookAt(c.x, c.y + c.h * 0.62, c.z);
          camera.fov += (50 - camera.fov) * Math.min(1, dt * 4);
          camera.updateProjectionMatrix();
          return;
        }
      }
      var yawBefore = TR.input.yaw;
      cam.auto(target, dt, opts);
      var yaw = TR.input.yaw, pitch = TR.input.pitch, want = (opts.dist || cam.dist) + cam.pullBack(dt);
      var dx = Math.sin(yaw) * Math.cos(pitch), dy = Math.sin(pitch), dz = Math.cos(yaw) * Math.cos(pitch);
      var fy = target.y + (opts.lift || 2.6);
      var d = want;
      if (TR.world && TR.world.collide) d = Math.max(1.6, TR.world.collide.rayClip(target.x, fy, target.z, dx, dy, dz, want) - 0.8);
      // the camera turns exactly with the mouse. Only following the body, and pulling back out from a wall, are eased.
      var k = 1 - Math.pow(TR.vehicles.current ? 0.002 : 0.00002, dt), far = cam.follow.distanceTo(target) > 30;   // a car pulls ahead of the camera a little under power
      if (far) cam.follow.copy(target); else cam.follow.lerp(target, k);
      cam.d = d < (cam.d || d) ? d : (cam.d || d) + (d - (cam.d || d)) * (1 - Math.pow(0.02, dt));
      var floor = (opts.floor != null ? opts.floor : target.y - 40) + 0.5, fly = cam.follow.y + (opts.lift || 2.6);
      cam.cur.set(cam.follow.x + dx * cam.d, Math.max(floor, fly + dy * cam.d), cam.follow.z + dz * cam.d);
      cam.shake = Math.max(0, cam.shake - dt * 2.6);
      cam.kick = Math.max(0, cam.kick - dt * 3);
      var s = cam.shake * cam.shake;
      camera.position.set(cam.cur.x + (Math.random() - 0.5) * s, cam.cur.y + (Math.random() - 0.5) * s, cam.cur.z + (Math.random() - 0.5) * s);
      // look a little ahead of where you are going, and lean into turns
      var turn = (((yaw - yawBefore + Math.PI * 3) % (Math.PI * 2)) - Math.PI) / Math.max(dt, 0.001);
      cam.roll += ((Math.max(-1.2, Math.min(1.2, turn)) * 0.035) - cam.roll) * (1 - Math.pow(0.02, dt));
      camera.lookAt(cam.follow.x + cam.aheadX, fly - 0.5 + cam.kick * 0.4 + cam.bob, cam.follow.z + cam.aheadZ);
      camera.rotateZ(cam.roll);
      camera.fov += ((opts.fov || 58) + cam.kick * 6 - camera.fov) * Math.min(1, dt * 6);
      camera.updateProjectionMatrix();
    },
    snap: function (target) { cam.cur.set(target.x + 8, target.y + 6, target.z + 8); cam.follow.copy(target); cam.d = null; cam.pull = 0; cam.aheadX = cam.aheadZ = 0; cam.roll = 0; }
  };
})();
