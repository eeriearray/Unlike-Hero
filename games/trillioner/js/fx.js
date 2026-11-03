/* Particles and purchase responses. One instanced pool for coins, confetti, sparks, smoke. */
(function () {
  var TR = window.TR = window.TR || {};
  var R = window.TRD.rules, MAX = 1400, dummy = new THREE.Object3D(), col = new THREE.Color(), parts = [];
  var CONFETTI = [0xff4d6d, 0xffc53d, 0x3ddc6e, 0x3da8ff, 0xc77dff, 0xffffff];

  var fx = TR.fx = {
    mesh: null, slow: 0, flags: [], skidT: 0, floor: 0.1,
    init: function (scene) {
      fx.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.42, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
      fx.mesh.frustumCulled = false;
      fx.mesh.setColorAt(0, col.setHex(0xffffff));
      fx.mesh.count = 0;
      scene.add(fx.mesh);
      fx.scene = scene;
    },
    spawn: function (x, y, z, vx, vy, vz, color, life, size, grav) {
      if (parts.length >= MAX) parts.shift();
      parts.push({ x: x, y: y, z: z, vx: vx, vy: vy, vz: vz, c: color, life: life, max: life, s: size || 1, g: grav == null ? 22 : grav, r: Math.random() * 6, rv: (Math.random() - 0.5) * 16 });
    },
    coins: function (p, n, power) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.283, s = (0.3 + Math.random()) * power;
        fx.spawn(p.x, p.y + 1, p.z, Math.cos(a) * s, 5 + Math.random() * power * 1.1, Math.sin(a) * s, 0xffc53d, 0.8 + Math.random() * 0.8, 1.15);
      }
    },
    confetti: function (p, n, power) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.283, s = Math.random() * power;
        fx.spawn(p.x, p.y + 1.5, p.z, Math.cos(a) * s, 8 + Math.random() * power, Math.sin(a) * s, CONFETTI[i % CONFETTI.length], 1.6 + Math.random() * 1.4, 0.6, 9);
      }
    },
    firework: function (x, y, z) {
      var c = CONFETTI[Math.floor(Math.random() * CONFETTI.length)];
      for (var i = 0; i < 60; i++) {
        var a = Math.random() * 6.283, e = Math.random() * 3.14 - 1.57, s = 16 + Math.random() * 12;
        fx.spawn(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s, Math.sin(a) * Math.cos(e) * s, c, 1 + Math.random() * 0.7, 1.7, 8);
      }
    },
    explosion: function (p, scale) {
      for (var i = 0; i < 90 * scale; i++) {
        var a = Math.random() * 6.283, s = (6 + Math.random() * 22) * scale, c = [0xff6a00, 0xffc53d, 0x444444, 0x777777][i % 4];
        fx.spawn(p.x + (Math.random() - 0.5) * 8 * scale, p.y + Math.random() * 6 * scale, p.z + (Math.random() - 0.5) * 8 * scale, Math.cos(a) * s, 6 + Math.random() * 24 * scale, Math.sin(a) * s, c, 1.2 + Math.random() * 1.2, 3.5 * Math.min(scale, 2));
      }
    },
    /** Banknotes thrown off the buyer. */
    bills: function (p, n, power) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.283, sp = 2 + Math.random() * power;
        fx.spawn(p.x, p.y + 1.6, p.z, Math.cos(a) * sp, 4 + Math.random() * power, Math.sin(a) * sp, i % 3 ? 0x5fc565 : 0x3fa84e, 1.6 + Math.random(), 1.05, 7);
      }
    },
    /** Bits of whatever just got wrecked. */
    debris: function (p, n, color, power) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.283, sp = 3 + Math.random() * power;
        fx.spawn(p.x, p.y + 0.8, p.z, Math.cos(a) * sp, 4 + Math.random() * power, Math.sin(a) * sp, i % 2 ? color : 0xb9a57e, 1 + Math.random() * 0.7, 1.7, 26);
      }
    },
    dust: function (p) {
      for (var i = 0; i < 5; i++) fx.spawn(p.x + (Math.random() - 0.5), p.y + 0.15, p.z + (Math.random() - 0.5), (Math.random() - 0.5) * 3, 0.8, (Math.random() - 0.5) * 3, 0xe4dccb, 0.4, 1.1, 0);
    },
    skid: function (p) {
      fx.spawn(p.x + (Math.random() - 0.5) * 2, p.y + 0.2, p.z + (Math.random() - 0.5) * 2, 0, 1.6, 0, 0x9a9a9a, 0.4, 1.1, 0);
    },
    /** The buying response, by price tier from the brief. */
    purchase: function (ev, pos, itemName) {
      var base = ev.base, p = pos, a = TR.audio;
      TR.hud.spree(ev.mult);
      if (base < 100 * R.M) { fx.coins(p, 12, 6); fx.bills(p, 6, 3); a && a.buy(0, ev.mult); TR.cam.kick = 0.2; return; }
      if (base < 1 * R.B) { fx.coins(p, 34, 9); fx.bills(p, 22, 6); TR.cam.kick = 0.6; TR.cam.shake = Math.max(TR.cam.shake, 0.3); a && a.buy(1, ev.mult); return; }
      if (base < 10 * R.B) { fx.coins(p, 80, 12); fx.bills(p, 60, 9); TR.cam.kick = 0.9; TR.cam.shake = Math.max(TR.cam.shake, 0.45); a && a.buy(2, ev.mult); a && a.cheer(0.7); TR.crowds.cheer(2); TR.hud.flash(0.35); return; }
      if (base < 100 * R.B) {
        fx.coins(p, 100, 15); fx.bills(p, 110, 13); fx.confetti({ x: p.x - 5, y: p.y, z: p.z }, 110, 15); fx.confetti({ x: p.x + 5, y: p.y, z: p.z }, 110, 15);
        fx.slow = 0.75; TR.cam.kick = 1.1; TR.cam.shake = Math.max(TR.cam.shake, 0.6);
        a && a.buy(3, ev.mult); a && a.cheer(1); TR.crowds.cheer(3); TR.hud.flash(0.55);
        TR.hud.banner('BREAKING: ' + itemName + ' sold!');
        TR.world.headline('BREAKING: ' + itemName);
        return;
      }
      fx.coins(p, 140, 18); fx.bills(p, 200, 18);
      a && a.buy(4, ev.mult);
      fx.cityEvent(itemName + ' bought!', p);
    },
    /** Full-city event: fireworks, helicopters overhead, a news banner. Fires for a $100B+ deal and each $100B milestone. */
    cityEvent: function (text, p) {
      var a = TR.audio;
      fx.confetti(p, 300, 22); fx.slow = Math.max(fx.slow, 1.1); TR.cam.kick = 1.3; TR.cam.shake = 0.8;
      a && a.cheer(1.2); TR.crowds.cheer(5); TR.hud.flash(0.8);
      for (var i = 0; i < 8; i++) setTimeout(function () { fx.firework(p.x + (Math.random() - 0.5) * 120, 50 + Math.random() * 40, p.z + (Math.random() - 0.5) * 120); a && a.boom(0.4); }, i * 260);
      TR.hud.banner('CITY-WIDE NEWS: ' + text);
      TR.world.headline(text);
      fx.flyover(p);
    },
    /** News helicopters cross the sky and leave. */
    flyover: function (p) {
      fx.choppers = fx.choppers || [];
      if (p.y < -5 || TR.interiors.current || fx.choppers.length) return;
      for (var i = 0; i < 3; i++) {
        var g = new THREE.Group(), m = TR.vehicles.SPECS.helicopter.build().mesh(new THREE.MeshLambertMaterial({ vertexColors: true }), false, false);
        m.matrixAutoUpdate = true; g.add(m);
        var rot = new THREE.Mesh(new THREE.BoxGeometry(11, 0.14, 0.7), new THREE.MeshLambertMaterial({ color: 0x222222 })); rot.position.y = 4.3; g.add(rot);
        g.position.set(p.x - 150 - i * 34, 38 + i * 7, p.z - 34 + i * 34);
        g.rotation.y = -Math.PI / 2;
        fx.scene.add(g);
        fx.choppers.push({ g: g, rot: rot, t: 0 });
      }
    },
    /** A flag rises on a building when its deal goes through. */
    raiseFlag: function (x, y, z) {
      var g = new THREE.Group();
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 7, 6), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
      pole.position.y = 3.5; g.add(pole);
      var flag = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 0.1), new THREE.MeshBasicMaterial({ color: 0xffc53d }));
      flag.position.set(1.5, 0.5, 0); g.add(flag);
      g.position.set(x, y, z);
      fx.flags.push({ flag: flag, t: 0 });
      return g;
    },
    update: function (dt) {
      var n = 0;
      for (var i = parts.length - 1; i >= 0; i--) {
        var q = parts[i];
        q.life -= dt;
        if (q.life <= 0) { parts.splice(i, 1); continue; }
        q.vy -= q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.r += q.rv * dt;
        var fl = q.fl != null ? q.fl : fx.floor;
        if (q.y < fl && q.vy < 0) { q.y = fl; q.vy *= -0.4; q.vx *= 0.6; q.vz *= 0.6; }
        var s = q.s * Math.min(1, q.life / q.max * 2.5);
        dummy.position.set(q.x, q.y, q.z); dummy.rotation.set(q.r, q.r * 0.7, 0); dummy.scale.set(s, s, s); dummy.updateMatrix();
        fx.mesh.setMatrixAt(n, dummy.matrix);
        fx.mesh.setColorAt(n, col.setHex(q.c));
        n++;
      }
      fx.mesh.count = n;
      fx.mesh.instanceMatrix.needsUpdate = true;
      if (fx.mesh.instanceColor) fx.mesh.instanceColor.needsUpdate = true;
      for (i = 0; i < fx.flags.length; i++) {
        var f = fx.flags[i];
        f.t = Math.min(1, f.t + dt * 0.8);
        f.flag.position.y = 0.5 + f.t * 5.4;
        f.flag.rotation.y = Math.sin(performance.now() * 0.005 + i) * 0.25;
      }
      (fx.choppers || []).forEach(function (c) { c.t += dt; c.g.position.x += 46 * dt; c.rot.rotation.y += dt * 30; if (c.t > 9) { fx.scene.remove(c.g); c.g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); } });
      if (fx.choppers) fx.choppers = fx.choppers.filter(function (c) { return c.t <= 9; });
      fx.slow = Math.max(0, fx.slow - dt);
    },
    timeScale: function () { return fx.slow > 0 ? 0.35 : 1; }
  };
})();
