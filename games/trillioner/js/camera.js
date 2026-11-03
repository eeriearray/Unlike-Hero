/* Third-person chase camera: follows behind, avoids walls, carries the purchase nudge. */
(function () {
  var TR = window.TR = window.TR || {};
  var cam = TR.cam = {
    follow: new THREE.Vector3(), dist: 9.5, fx: new THREE.Vector3(), shake: 0, kick: 0, cur: new THREE.Vector3(0, 8, 10), look: new THREE.Vector3(),
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
      var yaw = TR.input.yaw, pitch = TR.input.pitch, want = opts.dist || cam.dist;
      var dx = Math.sin(yaw) * Math.cos(pitch), dy = Math.sin(pitch), dz = Math.cos(yaw) * Math.cos(pitch);
      var fy = target.y + (opts.lift || 2.6);
      var d = want;
      if (TR.world && TR.world.collide) d = Math.max(1.6, TR.world.collide.rayClip(target.x, fy, target.z, dx, dy, dz, want) - 0.8);
      // the camera turns exactly with the mouse. Only following the body, and pulling back out from a wall, are eased.
      var k = 1 - Math.pow(0.00002, dt), far = cam.follow.distanceTo(target) > 30;
      if (far) cam.follow.copy(target); else cam.follow.lerp(target, k);
      cam.d = d < (cam.d || d) ? d : (cam.d || d) + (d - (cam.d || d)) * (1 - Math.pow(0.02, dt));
      var floor = (opts.floor != null ? opts.floor : target.y - 40) + 0.5, fly = cam.follow.y + (opts.lift || 2.6);
      cam.cur.set(cam.follow.x + dx * cam.d, Math.max(floor, fly + dy * cam.d), cam.follow.z + dz * cam.d);
      cam.shake = Math.max(0, cam.shake - dt * 2.6);
      cam.kick = Math.max(0, cam.kick - dt * 3);
      var s = cam.shake * cam.shake;
      camera.position.set(cam.cur.x + (Math.random() - 0.5) * s, cam.cur.y + (Math.random() - 0.5) * s, cam.cur.z + (Math.random() - 0.5) * s);
      camera.lookAt(cam.follow.x, fly - 0.5 + cam.kick * 0.4, cam.follow.z);
      camera.fov += ((opts.fov || 58) + cam.kick * 6 - camera.fov) * Math.min(1, dt * 6);
      camera.updateProjectionMatrix();
    },
    snap: function (target) { cam.cur.set(target.x + 8, target.y + 6, target.z + 8); cam.follow.copy(target); cam.d = null; }
  };
})();
