/* Putt Club — aiming and camera input. Drag back from your ball to aim (the shot goes the opposite way),
 * drag farther for more power, release to putt. Dragging empty space orbits the camera; wheel or pinch zooms.
 * Keyboard: ←/→ aim, ↑/↓ power, Space putts, Esc cancels, Q/E orbit, Z zoom.
 * Pointer gestures never scroll or select text (touch-action: none on the canvas). */
(function (global) {
  'use strict';
  var PC = global.PC, THREE = global.THREE;

  function AimInput(canvas, h) {
    this.canvas = canvas; this.h = h;
    this.aim = null;          // { dir: [dx, dz], power, screen: {x, y} }
    this.mode = null;         // 'aim' | 'orbit'
    this.pointers = new Map();
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.kbAngle = null; this.kbPower = 0.5;
    var self = this;
    canvas.addEventListener('pointerdown', function (e) { self.down(e); });
    canvas.addEventListener('pointermove', function (e) { self.move(e); });
    canvas.addEventListener('pointerup', function (e) { self.up(e); });
    canvas.addEventListener('pointercancel', function (e) { self.cancel(e); });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); h.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    global.addEventListener('keydown', function (e) { self.key(e); });
  }

  AimInput.prototype.screenOf = function (v) {
    var r = this.canvas.getBoundingClientRect(), p = v.clone().project(this.h.camera());
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
  };

  AimInput.prototype.groundPoint = function (cx, cy, y) {
    var r = this.canvas.getBoundingClientRect();
    var ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.h.camera());
    this.plane.constant = -y;
    var out = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.plane, out) ? out : null;
  };

  AimInput.prototype.down = function (e) {
    e.preventDefault();
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
    if (this.pointers.size === 2) { this.cancelAim(); this.mode = 'pinch'; this.pinch = dist2(this.pointers); this.mid = midpoint(this.pointers); return; }
    if (e.button === 2) { this.cancelAim(); this.mode = 'orbit'; this.last = { x: e.clientX, y: e.clientY }; return; }
    var ball = this.h.ball();
    if (ball && this.h.canAim()) {
      // Your shot: a drag anywhere aims. Everything is measured from where the drag started, with the
      // camera held still, so the same pull always gives the same shot.
      this.anchor = { x: e.clientX, y: e.clientY };
      this.basis = this.h.cameraBasis();
      this.mode = 'aim';
      this.h.aimStart();
      this.updateAim(e.clientX, e.clientY);
      return;
    }
    this.mode = 'orbit'; this.last = { x: e.clientX, y: e.clientY };
  };

  AimInput.prototype.move = function (e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.mode === 'pinch' && this.pointers.size === 2) {
      var d = dist2(this.pointers), mid = midpoint(this.pointers);
      if (this.pinch) this.h.zoom(this.pinch / d);
      if (this.mid) this.h.rotate(-(mid.x - this.mid.x) * 0.006, (mid.y - this.mid.y) * 0.003);
      this.pinch = d; this.mid = mid;
    } else if (this.mode === 'aim') {
      e.preventDefault();
      this.updateAim(e.clientX, e.clientY);
    } else if (this.mode === 'orbit') {
      var dx = e.clientX - this.last.x, dy = e.clientY - this.last.y;
      this.last = { x: e.clientX, y: e.clientY };
      var sens = PC.store.get('camSens', 1);
      this.h.rotate(-dx * 0.006 * sens, dy * 0.003 * sens);
    }
  };

  AimInput.prototype.updateAim = function (cx, cy) {
    var ball = this.h.ball();
    if (!ball || !this.h.canAim()) { this.cancelAim(); return; }
    var r = this.canvas.getBoundingClientRect();
    var a = this.anchor, sx = cx - a.x, sy = cy - a.y, sd = Math.hypot(sx, sy);
    // A pull of ~30% of the screen's short side is full power; a small dead zone avoids accidental taps.
    var reach = Math.min(r.width, r.height) * 0.3, dead = 12;
    var power = PC.clamp((sd - dead) / reach, 0, 1);
    if (sd < dead) { this.aim = { dir: this.aim ? this.aim.dir : this.h.defaultAim(), power: 0 }; this.h.onAim(this.aim); return; }
    // Screen drag -> ground direction using the camera's (frozen) orientation. Pull back = shoot forward.
    var b = this.basis, wx = -(sx * b.rx + -sy * b.fx), wz = -(sx * b.rz + -sy * b.fz), l = Math.hypot(wx, wz) || 1;
    this.aim = { dir: [wx / l, wz / l], power: power };
    this.h.onAim(this.aim);
  };

  AimInput.prototype.up = function (e) {
    this.pointers.delete(e.pointerId);
    if (this.mode === 'aim' && this.aim) {
      var a = this.aim;
      this.aim = null; this.mode = null;
      if (a.power >= 0.03 && this.h.canAim()) this.h.onShoot(a); else this.h.onAim(null);
      this.h.aimEnd();
      return;
    }
    if (this.pointers.size === 0) this.mode = null;
  };

  AimInput.prototype.cancel = function (e) { this.pointers.delete(e.pointerId); this.cancelAim(); this.mode = null; };
  AimInput.prototype.cancelAim = function () { if (this.aim || this.mode === 'aim') { this.aim = null; this.mode = null; this.h.onAim(null); this.h.aimEnd(); } };

  AimInput.prototype.key = function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    var k = e.key;
    if (k === 'Escape') { if (this.aim || this.kbAngle != null) { this.cancelAim(); this.kbAngle = null; e.preventDefault(); } return; }
    if (k === 'q' || k === 'Q') { this.h.rotate(0.25, 0); return; }
    if (k === 'e' || k === 'E') { this.h.rotate(-0.25, 0); return; }
    if (k === 'z' || k === 'Z') { this.h.zoom(e.shiftKey ? 1.2 : 0.85); return; }
    if (!this.h.canAim()) return;
    var ball = this.h.ball();
    if (!ball) return;
    var arrows = { ArrowLeft: 1, ArrowRight: -1 };
    if (k in arrows || k === 'ArrowUp' || k === 'ArrowDown') {
      e.preventDefault();
      if (this.kbAngle == null) { var d = this.h.defaultAim(); this.kbAngle = Math.atan2(d[0], d[1]); }
      if (k in arrows) this.kbAngle += arrows[k] * (e.shiftKey ? 0.01 : 0.04);
      if (k === 'ArrowUp') this.kbPower = PC.clamp(this.kbPower + (e.shiftKey ? 0.01 : 0.04), 0.02, 1);
      if (k === 'ArrowDown') this.kbPower = PC.clamp(this.kbPower - (e.shiftKey ? 0.01 : 0.04), 0.02, 1);
      this.aim = { dir: [Math.sin(this.kbAngle), Math.cos(this.kbAngle)], power: this.kbPower, keyboard: true };
      this.h.onAim(this.aim);
    } else if ((k === ' ' || k === 'Enter') && this.aim && this.aim.keyboard) {
      e.preventDefault();
      var a = this.aim; this.aim = null; this.kbAngle = null;
      this.h.onShoot(a);
    }
  };

  function midpoint(map) { var a = Array.from(map.values()); return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 }; }
  function dist2(map) { var a = Array.from(map.values()); return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1; }

  PC.AimInput = AimInput;
})(window);
