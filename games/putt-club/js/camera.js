/* Putt Club — camera rig. A three-quarter orbit around a focus point with critically damped motion:
 * a short fly-in when a hole starts, a stable aiming view behind your ball, a gentle follow while it rolls,
 * and an overview of the whole hole on request. Players can orbit (drag empty space, Q/E) and zoom. */
(function (global) {
  'use strict';
  var PC = global.PC, THREE = global.THREE;

  function CameraRig(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3(); this.goal = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0.92; this.dist = 12;
    this.goalYaw = 0; this.goalPitch = 0.92; this.goalDist = 12;
    this.userZoom = 1; this.userPitch = 0;
    this.mode = 'menu';
    this.introT = 0; this.introDur = 0;
    this.bounds = null; this.manualYawAt = -10;
  }

  CameraRig.prototype.fitDistance = function (w, h) {
    // Distance that frames a w×h area at the current FOV and aspect.
    var fov = this.camera.fov * Math.PI / 180, aspect = this.camera.aspect;
    var vert = h / 2 / Math.tan(fov / 2), horiz = w / 2 / Math.tan(fov / 2) / aspect;
    return Math.max(vert, horiz);
  };

  CameraRig.prototype.setHole = function (world, opts) {
    var b = world.bounds;
    this.bounds = b;
    this.center = new THREE.Vector3((b[0] + b[2]) / 2, world.cupH * 0.5, (b[1] + b[3]) / 2);
    this.teeYaw = Math.atan2(-world.teeDir[0], -world.teeDir[1]);
    this.cup = new THREE.Vector3(world.cup[0], world.cupH, world.cup[1]);
    this.tee = new THREE.Vector3(world.tee[0], world.teeH, world.tee[1]);
    this.goalYaw = this.teeYaw;
    if (opts && opts.intro) {
      this.mode = 'intro'; this.introT = 0; this.introDur = opts.intro;
      // Start high over the whole hole, already facing down the course.
      this.target.copy(this.center); this.yaw = this.teeYaw + 0.5; this.pitch = 1.25;
      this.dist = this.overviewDist() * 1.25;
    }
  };

  CameraRig.prototype.overviewDist = function () {
    var b = this.bounds; if (!b) return 20;
    var span = Math.max(b[2] - b[0], b[3] - b[1]) + 4;
    return Math.min(46, this.fitDistance(span, span * 0.85) * 0.92);
  };

  CameraRig.prototype.rotate = function (dYaw, dPitch) {
    this.goalYaw += dYaw; this.manualYawAt = performance.now();
    this.userPitch = PC.clamp(this.userPitch + dPitch, -0.35, 0.4);
  };
  CameraRig.prototype.zoom = function (f) { this.userZoom = PC.clamp(this.userZoom * f, 0.55, 2.2); };

  /**
   * focus: { pos: Vector3, moving, aiming, aimDir: [dx, dz] } for your ball (or the ball you watch).
   */
  CameraRig.prototype.update = function (dt, focus, t) {
    var aspect = this.camera.aspect;
    var portrait = aspect < 1 ? 1 + (1 - aspect) * 1.1 : 1;
    if (this.mode === 'menu') {
      // Slow orbit for the attract screen.
      this.goal.copy(this.center || this.goal);
      this.goalYaw = (this.teeYaw || 0) + Math.sin(t * 0.05) * 0.8 + t * 0.03;
      this.goalPitch = 0.82; this.goalDist = this.overviewDist() * 0.85 * portrait;
    } else if (this.mode === 'intro') {
      this.introT += dt;
      var k = PC.clamp(this.introT / this.introDur, 0, 1), e = PC.easeInOutCubic(k);
      var start = this.center, end = focus && focus.pos ? focus.pos : this.tee;
      this.goal.lerpVectors(start, end, e);
      this.goalYaw = this.teeYaw + 0.5 * (1 - e);
      this.goalPitch = PC.lerp(1.2, 0.92, e);
      this.goalDist = PC.lerp(this.overviewDist() * 1.05, 11 * portrait * this.userZoom, e);
      if (k >= 1) this.mode = 'play';
    } else if (this.mode === 'overview') {
      this.goal.copy(this.center);
      this.goalPitch = 1.2; this.goalDist = this.overviewDist() * portrait * 0.95;
    } else if (this.holdForAim) {
      // Aiming: keep the view perfectly still so the drag maps to the same shot every time.
    } else if (focus && focus.pos) {
      // Look a little past the ball toward the cup (or along the aim), but never lose the ball.
      var ahead = new THREE.Vector3();
      if (focus.aiming && focus.aimDir) ahead.set(focus.aimDir[0], 0, focus.aimDir[1]).multiplyScalar(1.6 + 2.2 * (focus.power || 0));
      else if (!focus.moving && this.cup) { ahead.subVectors(this.cup, focus.pos).setY(0); var l = ahead.length(); if (l > 0) ahead.multiplyScalar(Math.min(2.5, l * 0.3) / l); }
      this.goal.copy(focus.pos).add(ahead);
      this.goalPitch = 0.92 + this.userPitch;
      this.goalDist = (focus.moving ? 12.5 : 11) * portrait * this.userZoom;
      // The camera follows a rolling ball but never turns by itself: swinging round to look along the path
      // made straight rolls look curved on screen.
    }
    var lam = this.mode === 'intro' ? 6 : 4.5;
    this.target.x = PC.damp(this.target.x, this.goal.x, lam, dt);
    this.target.y = PC.damp(this.target.y, this.goal.y, lam, dt);
    this.target.z = PC.damp(this.target.z, this.goal.z, lam, dt);
    this.yaw = PC.angleLerp(this.yaw, this.goalYaw, 1 - Math.exp(-5 * dt));
    this.pitch = PC.damp(this.pitch, PC.clamp(this.goalPitch, 0.5, 1.35), 4, dt);
    this.dist = PC.damp(this.dist, this.goalDist, 3.5, dt);
    var cp = Math.cos(this.pitch), sp2 = Math.sin(this.pitch);
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist, this.target.y + sp2 * this.dist, this.target.z + Math.cos(this.yaw) * cp * this.dist);
    this.camera.lookAt(this.target);
  };

  PC.CameraRig = CameraRig;
})(window);
