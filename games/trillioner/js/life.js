/* The city moving on its own: birds, balloons, a blimp, chimney smoke, fountain spray. Decoration only. */
(function () {
  var TR = window.TR = window.TR || {};
  var dummy = new THREE.Object3D(), col = new THREE.Color();
  var life = TR.life = {
    init: function (scene) {
      var bg = new TR.Geo(); bg.box(0, 0, 0, 0.26, 0.22, 0.8, 0xf4f4f4).box(-0.6, 0.06, 0, 1, 0.05, 0.42, 0xdedede).box(0.6, 0.06, 0, 1, 0.05, 0.42, 0xdedede);
      life.birds = new THREE.InstancedMesh(bg.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), 36);
      life.birds.frustumCulled = false;
      var bl = new TR.Geo(); bl.cyl(0, 0, 0, 0.14, 1, 0xffffff, 8, 0.86).cyl(0, 1, 0, 0.86, 0.9, 0xffffff, 8, 0.2).box(0, -2, 0, 0.03, 2, 0.03, 0xdddddd);
      life.balloons = new THREE.InstancedMesh(bl.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x222222 }), 26);
      life.balloons.frustumCulled = false; life.balloons.setColorAt(0, col.setHex(0xffffff));
      scene.add(life.birds, life.balloons);
      var r = new TrillionerRng.Rng('life'), C = [0xff4d6d, 0xffc53d, 0x3ddc6e, 0x3da8ff, 0xc77dff, 0xff8a1f];
      life.bl = [];
      for (var i = 0; i < 26; i++) { life.bl.push({ x: r.range(-300, 300), z: r.range(-300, 300), base: r.range(14, 60), ph: r.range(0, 6), c: C[i % C.length], s: r.range(0.9, 1.7) }); life.balloons.setColorAt(i, col.setHex(C[i % C.length])); }
      // blimp with a moving advert
      var g = new TR.Geo();
      g.box(0, 0, 0, 16, 11, 44, 0xffc53d).box(0, 0, 0, 12, 14, 34, 0xffc53d).box(0, 0, 0, 20, 7, 30, 0xffc53d).box(0, -2, 0, 7, 3, 12, 0x333844).box(0, 11, 19, 1, 8, 8, 0xd9352c).box(0, 0, 19, 16, 1, 8, 0xd9352c);
      var m = g.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }), false, false); m.matrixAutoUpdate = true;
      life.blimp = new THREE.Group(); life.blimp.add(m);
      var cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
      var x = cv.getContext('2d'); x.fillStyle = '#d9352c'; x.fillRect(0, 0, 512, 128); x.fillStyle = '#fff'; x.font = '900 72px Arial Black, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SPEND MORE', 256, 68);
      var tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
      [[10.2, Math.PI / 2], [-10.2, -Math.PI / 2]].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(30, 7), new THREE.MeshBasicMaterial({ map: tex })); p.position.set(s[0], 3.5, 0); p.rotation.y = s[1]; life.blimp.add(p); });
      TR.world.surface.add(life.blimp);
    },
    update: function (dt, pos, t, hidden) {
      life.birds.visible = life.balloons.visible = !hidden;
      if (hidden) return;
      var i, n = 36;
      for (i = 0; i < n; i++) {
        var fl = Math.floor(i / 12), a = t * (0.5 + fl * 0.1) + i * 0.17 + fl * 2, R2 = 34 + fl * 22, cx = pos.x + Math.sin(fl * 3) * 60, cz = pos.z + Math.cos(fl * 3) * 60;
        dummy.position.set(cx + Math.cos(a) * R2 + Math.sin(i) * 3, 34 + fl * 9 + Math.sin(i * 1.7) * 3, cz + Math.sin(a) * R2 + Math.cos(i) * 3);
        dummy.rotation.set(0, -a, Math.sin(t * 11 + i) * 0.55); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        life.birds.setMatrixAt(i, dummy.matrix);
      }
      life.birds.instanceMatrix.needsUpdate = true;
      for (i = 0; i < life.bl.length; i++) {
        var b = life.bl[i];
        dummy.position.set(b.x + Math.sin(t * 0.3 + b.ph) * 3, b.base + ((t * 1.6 + b.ph * 12) % 90), b.z + Math.cos(t * 0.25 + b.ph) * 3);
        dummy.rotation.set(0, 0, 0); dummy.scale.set(b.s, b.s, b.s); dummy.updateMatrix();
        life.balloons.setMatrixAt(i, dummy.matrix);
      }
      life.balloons.instanceMatrix.needsUpdate = true;
      var ba = t * 0.035;
      life.blimp.position.set(Math.cos(ba) * 300, 118 + Math.sin(t * 0.3) * 3, Math.sin(ba) * 300);
      life.blimp.rotation.y = -ba;
      // smoke and spray, only where you can see them
      life.emit = (life.emit || 0) + dt;
      if (life.emit > 0.08) {
        life.emit = 0;
        (TR.world.smokers || []).forEach(function (s) { if (Math.hypot(s.x - pos.x, s.z - pos.z) < 260) TR.fx.spawn(s.x + (Math.random() - 0.5) * 2, s.y, s.z + (Math.random() - 0.5) * 2, 1.5 + Math.random(), 3 + Math.random(), Math.random(), s.c || 0xc9ced6, 3.4, s.s || 4, -0.6); });
        (TR.world.fountains || []).forEach(function (f) { if (Math.abs(f.y - pos.y) < 20 && Math.hypot(f.x - pos.x, f.z - pos.z) < 90) for (var k = 0; k < 3; k++) { var a2 = Math.random() * 6.283; TR.fx.spawn(f.x, f.y + 3.3, f.z, Math.cos(a2) * 1.5, 5.5 + Math.random() * 2, Math.sin(a2) * 1.5, 0xa8e4ff, 1, 0.6, 12); } });
      }
    }
  };
})();
