/* Vehicles: every one is a row in SPECS. Handling modes: ground, water, sub, air, jet, rail, mole. */
(function () {
  var TR = window.TR = window.TR || {};
  var RAIL = [[-130, -130], [300, -130], [300, 130], [-130, 130]], RAIL_Y = 11;

  // The models live in models.js. A spec's build() returns a fresh geometry builder.
  function BUILD_OF(k) { return function () { return TR.models[k](new TR.Geo()); }; }

  var SPECS = {
    sports_car: { name: 'Sports Car', mode: 'ground', speed: 45, accel: 34, brake: 60, turn: 2.5, grip: 3.4, driftGrip: 1.15, radius: 1.9, height: 2, step: 0.8, cam: 15, sound: 'car', horn: [392, 494], drift: true, use: 'Hold Space to drift. H for the horn.' },
    hoverboard: { name: 'Hoverboard', mode: 'ground', speed: 28, accel: 40, brake: 50, turn: 3.2, grip: 2.2, driftGrip: 1.2, radius: 0.9, height: 2.4, step: 0.9, cam: 11, sound: 'hover', rider: 1, jump: 13, grind: true, hover: 0.5, use: 'Space to jump. Land on a rail to grind.' },
    scooter: { name: 'Pizza Scooter', mode: 'ground', speed: 32, accel: 34, brake: 50, turn: 3.2, grip: 4, radius: 0.72, height: 2.4, step: 0.8, cam: 10, sound: 'scooter', rider: 1, pickups: true, horn: [880, 660], use: 'Fits through alleys. Pizza slices give a boost.' },
    monster_truck: { name: 'Monster Truck', mode: 'ground', speed: 38, accel: 28, brake: 50, turn: 2.1, grip: 3, radius: 2.6, height: 4, step: 2.4, cam: 17, sound: 'truck', smash: true, horn: [130, 165], use: 'Climbs low obstacles and smashes street props.' },
    ladder_truck: { name: 'Ladder Truck', mode: 'ground', speed: 30, accel: 22, brake: 44, turn: 1.9, grip: 3.2, radius: 1.9, height: 2.6, step: 0.8, cam: 16, sound: 'truck', ladder: true, horn: [660, 660], use: 'Click near a marked rooftop to raise the ladder.' },
    elephant: { name: 'Elephant', mode: 'ground', speed: 20, accel: 12, brake: 22, turn: 1.8, grip: 5, radius: 2.1, height: 4.6, step: 0.9, cam: 15, sound: 'elephant', trumpet: true, use: 'Click to trumpet and scatter the crowd.' },
    wrecking_truck: { name: 'Wrecking Truck', mode: 'ground', speed: 30, accel: 22, brake: 44, turn: 2, grip: 3.2, radius: 2, height: 4, step: 0.8, cam: 17, sound: 'truck', wreck: true, horn: [196, 247], use: 'Drive into a building you own to demolish it, 20% off the fee.' },
    golf_cart: { name: 'Golf Cart', mode: 'ground', speed: 20, accel: 16, brake: 30, turn: 2.8, grip: 4, radius: 1.4, height: 2.6, step: 0.7, cam: 11, sound: 'electric', horn: [1200, 1200], use: 'Slow, smug, and silent. H to toot.' },
    sofa_kart: { name: 'Sofa Kart', mode: 'ground', speed: 30, accel: 26, brake: 40, turn: 3.4, grip: 2, driftGrip: 0.9, radius: 1.7, height: 2.4, step: 0.8, cam: 12, sound: 'scooter', drift: true, rider: 1, use: 'A sofa. With wheels. Hold Space to slide.' },
    pogo_stick: { name: 'Pogo Stick', mode: 'ground', speed: 15, accel: 40, brake: 60, turn: 3.6, grip: 6, radius: 0.7, height: 2.6, step: 0.7, cam: 11, sound: 'pogo', rider: 1, bounce: 13, use: 'You cannot stop bouncing. Reaches low rooftops.' },
    speedboat: { name: 'Speedboat', mode: 'water', speed: 40, accel: 22, brake: 26, turn: 1.9, grip: 1.6, radius: 2.2, height: 2, cam: 16, sound: 'boat', horn: [110, 138], use: 'Crosses the water.' },
    submarine: { name: 'Submarine', mode: 'sub', speed: 22, accel: 12, brake: 18, turn: 1.6, grip: 2, radius: 2.1, height: 3, cam: 14, sound: 'sub', use: 'Space to rise, Shift to dive. Reaches underwater places.' },
    helicopter: { name: 'Helicopter', mode: 'air', speed: 60, accel: 34, climb: 22, turn: 2.2, radius: 3, height: 3.6, cam: 22, sound: 'heli', rotor: 1, use: 'Space up, Shift down. Lands on roofs and pads.' },
    jetpack: { name: 'Personal Jetpack', mode: 'jet', speed: 40, accel: 30, climb: 18, radius: 0.8, height: 2.6, cam: 12, sound: 'jet', rider: 1, fuel: 14, use: 'Hold Space to fly. Fuel refills on the ground.' },
    hot_air_balloon: { name: 'Hot Air Balloon', mode: 'air', speed: 14, accel: 6, climb: 6, turn: 0.8, radius: 2, height: 12, cam: 26, sound: 'burner', use: 'Space to burn, Shift to sink. Very dignified.' },
    private_train: { name: 'Private Train', mode: 'rail', speed: 42, accel: 12, brake: 24, radius: 2, height: 4, cam: 22, sound: 'train', horn: [233, 294], use: 'Your own line around the middle of the city.' },
    mole_machine: { name: 'Mole Machine', mode: 'mole', speed: 16, accel: 10, brake: 20, turn: 1.6, grip: 5, radius: 2.3, height: 3.4, step: 0.9, cam: 14, sound: 'mole', underOnly: true, use: 'Under City only. Drive into a marked wall to dig through.' }
  };
  var GEAR = {
    launcher: { name: 'Firework Launcher', use: 'Click to fire. The crowd loves it.' },
    money_cannon: { name: 'Money Cannon', use: 'Hold click: $200M a second, up to $30B a run.' },
    megaphone: { name: 'Megaphone', use: 'Click to draw a crowd.' },
    parachute: { name: 'Golden Umbrella', use: 'Hold Space while falling to float.' }
  };
  Object.keys(SPECS).forEach(function (k) { SPECS[k].build = BUILD_OF(k); });

  var vs = TR.vehicles = {
    SPECS: SPECS, GEAR: GEAR, placed: {}, current: null, scene: null, gear: null, boostT: 0, RAIL: RAIL, RAIL_Y: RAIL_Y, grindT: 0,
    init: function (scene) { vs.scene = scene; vs.buildPickups(scene); },
    buildRail: function () {
      for (var i = 0; i < RAIL.length; i++) {
        var a = RAIL[i], b = RAIL[(i + 1) % RAIL.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(l / 24), ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
        for (var k = 0; k < n; k++) {
          var x = a[0] + ux * (k + 0.5) * l / n, z = a[1] + uz * (k + 0.5) * l / n, g = TR.world.geo(x, z, 'solid');
          if (TR.world.roadDist(x, z) > 1.5) { // pylons never stand in a lane; the deck spans the road
            g.box(x, 0, z, 1, RAIL_Y, 1, 0x888c92);
            TR.world.collide.addBox(x, 0, z, 1, RAIL_Y, 1);
          }
          g.box(x, RAIL_Y, z, Math.abs(ux) * l / n + Math.abs(uz) * 5, 0.5, Math.abs(uz) * l / n + Math.abs(ux) * 5, 0x6d7278);
        }
      }
    },
    buildPickups: function (scene) {
      // pizza slices scattered along the streets, for the scooter
      var rng = new TrillionerRng.Rng('pizza'), rd = window.TRD.districts.ROADS;
      vs.pizzas = [];
      for (var i = 0; i < 46; i++) {
        var R = rng.pick(rd), a = rng.int(R.pts.length - 1), p = R.pts[a], q = R.pts[a + 1], t = rng.next();
        vs.pizzas.push({ x: p[0] + (q[0] - p[0]) * t, z: p[1] + (q[1] - p[1]) * t, off: 0 });
      }
      vs.pizzaMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.9, 0.3, 3), new THREE.MeshBasicMaterial({ color: 0xffb347 }), vs.pizzas.length);
      vs.pizzaMesh.frustumCulled = false; vs.pizzaMesh.visible = false;
      scene.add(vs.pizzaMesh);
    },
    /** Puts a vehicle in the world beside a point. Each kind has one body. */
    spawn: function (kind, x, y, z, heading) {
      var spec = SPECS[kind]; if (!spec) return null;
      var v = vs.placed[kind];
      if (!v) {
        var mesh = spec.build().mesh(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: 0x444444 }), true, false);
        mesh.matrixAutoUpdate = true;
        var group = new THREE.Group(); group.add(mesh);
        if (spec.rotor) {
          var rot = new THREE.Mesh(TR.models.rotorGeo(), new THREE.MeshLambertMaterial({ color: 0x1b1c20 }));
          rot.position.set(0, 4.3, 0.1); group.add(rot);
          group.userData.rotor = rot;
        }
        v = vs.placed[kind] = { kind: kind, spec: spec, group: group, pos: new THREE.Vector3(), vel: new THREE.Vector3(), speed: 0, heading: 0, slip: 0, vy: 0, fuel: spec.fuel || 0, railS: 0 };
        vs.scene.add(group);
        vs.applySkin(v);
      }
      v.pos.set(x, y, z); v.heading = heading || 0; v.speed = 0; v.vel.set(0, 0, 0); v.vy = 0;
      if (spec.fuel) v.fuel = spec.fuel;
      if (spec.mode === 'rail') vs.snapRail(v, x, z);
      v.group.visible = true;
      vs.sync(v);
      return v;
    },
    /** Clout skin: tints the whole vehicle. */
    applySkin: function (v) {
      var look = TR.player.look, mesh = v.group.children[0];
      if (mesh && mesh.material && mesh.material.color) mesh.material.color.setHex(look && look.skin ? look.skin : 0xffffff);
    },
    hideAll: function () { Object.keys(vs.placed).forEach(function (k) { vs.placed[k].group.visible = false; }); },
    /** Q wheel: bring a vehicle to the player. Returns an error string, or null. */
    summon: function (kind) {
      var p = TR.player.pos, h = TR.player.heading, spec = SPECS[kind];
      if (TR.interiors.current) return 'Step outside first.';
      if (vs.current) vs.leave();
      var under = p.y < -20;
      if (spec.underOnly && !under) return 'That only works in the Under City.';
      if (spec.mode === 'water' || spec.mode === 'sub') {
        var spot = vs.findWater(p);
        if (under || !spot) return 'No water near enough.';
        return vs.board(vs.spawn(kind, spot.x, spec.mode === 'sub' ? -1.5 : -1.2, spot.z, h)), null;
      }
      if (spec.mode === 'rail' && under) return 'The line runs up on the surface.';
      var off = spec.radius + 2.2, sx = p.x - Math.sin(h) * off, sz = p.z - Math.cos(h) * off;
      vs.board(vs.spawn(kind, sx, p.y + 0.2, sz, h));
      TR.fx.coins({ x: sx, y: p.y, z: sz }, 10, 6);
      return null;
    },
    findWater: function (p) {
      for (var r = 0; r <= 60; r += 6) for (var a = 0; a < 12; a++) {
        var x = p.x + Math.cos(a / 12 * 6.283) * r, z = p.z + Math.sin(a / 12 * 6.283) * r;
        if (TR.world.isWater(x, z) && TR.world.isWater(x + 4, z) && TR.world.isWater(x - 4, z) && TR.world.isWater(x, z + 4) && TR.world.isWater(x, z - 4)) return { x: x, z: z };
      }
      return null;
    },
    nearest: function (p, reach) {
      var best = null, bd = reach * reach;
      for (var k in vs.placed) { var v = vs.placed[k]; if (!v.group.visible) continue; var d = (v.pos.x - p.x) * (v.pos.x - p.x) + (v.pos.z - p.z) * (v.pos.z - p.z); if (d < bd && Math.abs(v.pos.y - p.y) < 6) { bd = d; best = v; } }
      return best;
    },
    board: function (v) {
      if (TR.interiors.current) return;
      vs.current = v;
      TR.player.setVisible(!!v.spec.rider);
      if (TR.audio) TR.audio.engine(v.spec.sound);
      TR.hud.carry(v.spec.name + ' - ' + v.spec.use);
      if (v.spec.mode === 'jet') v.fuel = v.spec.fuel;
      TR.player.pos.copy(v.pos);
    },
    leave: function () {
      var v = vs.current; if (!v) return;
      vs.current = null;
      var side = v.heading + Math.PI / 2, ox = Math.cos(side) * (v.spec.radius + 1.6), oz = -Math.sin(side) * (v.spec.radius + 1.6), px = v.pos.x + ox, pz = v.pos.z + oz;
      if (v.spec.mode === 'water' || v.spec.mode === 'sub') { var safe = TR.app.lastSafe || TR.app.session.run.spawn; px = safe.x; pz = safe.z; TR.player.teleport(px, safe.y + 0.1, pz, v.heading); }
      else if (v.spec.mode === 'rail') { TR.player.teleport(v.pos.x + ox * 2, 0.2, v.pos.z + oz * 2, v.heading); }
      else TR.player.teleport(px, v.pos.y + 0.2, pz, v.heading);
      TR.player.vel.set(0, 0, 0);
      TR.player.setVisible(true);
      if (v.spec.mode === 'jet' || v.spec.mode === 'water' || v.spec.mode === 'sub') v.group.visible = v.spec.mode !== 'jet';
      if (TR.audio) TR.audio.engine(null);
      TR.hud.carry(vs.gear ? GEAR[vs.gear].name + ' - ' + GEAR[vs.gear].use : null);
    },
    setGear: function (id) {
      vs.gear = id;
      if (!vs.current) TR.hud.carry(id ? GEAR[id].name + ' - ' + GEAR[id].use : null);
    },
    drive: function (dt) {
      var v = vs.current, s = v.spec;
      if (s.mode === 'ground' || s.mode === 'mole') vs.driveGround(v, s, dt);
      else if (s.mode === 'water') vs.driveWater(v, s, dt, false);
      else if (s.mode === 'sub') vs.driveWater(v, s, dt, true);
      else if (s.mode === 'air') vs.driveAir(v, s, dt);
      else if (s.mode === 'jet') vs.driveJet(v, s, dt);
      else if (s.mode === 'rail') vs.driveRail(v, s, dt);
      if (!vs.current) return;
      if (TR.input.hit('KeyH') && TR.audio && (s.horn || TR.models.mods.horn)) TR.audio.horn(TR.models.mods.horn && s.mode === 'ground' ? TR.models.mods.horn : s.horn);
      if (TR.audio) TR.audio.engineLevel(Math.abs(v.speed) / s.speed, v.slip);
      TR.player.pos.copy(v.pos);
      if (s.rider) { TR.player.group.position.set(v.pos.x, v.pos.y + (s.hover || 0) + (s.mode === 'jet' ? 0 : 0.6), v.pos.z); TR.player.group.rotation.y = v.heading; TR.player.parts.legL.rotation.x = TR.player.parts.legR.rotation.x = 0; TR.player.parts.shinL.rotation.x = TR.player.parts.shinR.rotation.x = 0; }
      vs.sync(v);
    },
    driveGround: function (v, s, dt) {
      var input = TR.input, a = input.axes(), speedCap = s.speed * (vs.boostT > 0 ? 1.5 : 1);
      vs.boostT = Math.max(0, vs.boostT - dt);
      var drifting = s.drift && (input.down('Space') || input.down('ShiftLeft'));
      var target = a.z > 0 ? speedCap * a.z : (a.z < 0 ? -s.speed * 0.4 : 0);
      var rate = a.z === 0 ? 12 : (Math.sign(target) !== Math.sign(v.speed) && Math.abs(v.speed) > 1 ? s.brake : s.accel);
      v.speed += Math.max(-rate * dt, Math.min(rate * dt, target - v.speed));
      if (drifting) v.speed *= Math.pow(0.82, dt);
      var turnScale = Math.min(1, Math.abs(v.speed) / 10) * (v.speed >= 0 ? 1 : -1);
      v.heading -= a.x * s.turn * (drifting ? 1.35 : 1) * turnScale * dt;
      var fx = -Math.sin(v.heading), fz = -Math.cos(v.heading), grip = drifting ? s.driftGrip : s.grip, k = 1 - Math.exp(-grip * dt * 2.4);
      v.vel.x += (fx * v.speed - v.vel.x) * k;
      v.vel.z += (fz * v.speed - v.vel.z) * k;
      v.slip = Math.abs(v.vel.x * -fz + v.vel.z * fx);
      // hoverboard grind: a rail under you carries you along it
      vs.grindNow = false;
      if (s.grind && vs.grind(v, dt)) { /* moved by the rail */ }
      else { v.pos.x += v.vel.x * dt; v.pos.z += v.vel.z * dt; }
      v.vy -= 30 * dt; v.pos.y += v.vy * dt;
      var floor = TR.app.floorAt(v.pos);
      var hit = TR.world.collide.resolve(v.pos, s.radius, s.height, s.step, floor);
      var grounded = v.pos.y <= v.pos.ground + 0.02;
      if (grounded) { v.pos.y = v.pos.ground; if (s.bounce) { v.vy = s.bounce; if (TR.audio) TR.audio.jump(1); } else v.vy = 0; }
      if (s.jump && grounded && input.hit('Space')) { v.vy = s.jump; if (TR.audio) TR.audio.jump(1); }
      if (hit) vs.onHit(v, s, hit);
      if (s.pickups) vs.pizzaCheck(v);
      if (Math.abs(v.speed) > 22) { vs.scareT = (vs.scareT || 0) - dt; if (vs.scareT <= 0) { vs.scareT = 0.5; TR.crowds.scare(v.pos, 0.8); } }
      if (v.slip > 9 && TR.fx) TR.fx.skid(v.pos);
      if (input.mouseClicked) vs.ability(v, s);
      // drowned: back to dry land
      if (v.pos.y < -1.2 && TR.world.isWater(v.pos.x, v.pos.z) && v.pos.y > -20) {
        var safe = TR.app.lastSafe || TR.app.session.run.spawn;
        v.pos.set(safe.x, safe.y + 0.1, safe.z); v.speed = 0; v.vel.set(0, 0, 0); v.vy = 0;
        TR.hud.toast('Splash! Wrong vehicle for that.', 'bad');
      } else if (grounded && !TR.world.isWater(v.pos.x, v.pos.z)) TR.app.lastSafe = { x: v.pos.x, y: v.pos.y, z: v.pos.z };
    },
    onHit: function (v, s, hit) {
      var tag = hit.tag, fast = Math.abs(v.speed) > 14;
      if (tag && tag.prop && Math.abs(v.speed) > (s.smash ? 4 : 10)) { TR.app.smashProp(tag.prop, v); return; }
      if (s.wreck && tag && tag.building && Math.abs(v.speed) > 8) {
        var id = TR.app.itemForBuilding(tag.building);
        if (id && TR.app.session.view.me.owned[id] && !TR.app.session.view.me.owned[id].demolished) { TR.app.tryDemolish(id, true); return; }
      }
      if (fast) { TR.cam.shake = Math.min(0.8, TR.cam.shake + 0.45); if (TR.audio) TR.audio.thud(); }
      v.speed *= 0.97;
      v.vel.multiplyScalar(0.97);
    },
    pizzaCheck: function (v) {
      var t = TR.app.t;
      for (var i = 0; i < vs.pizzas.length; i++) {
        var z = vs.pizzas[i];
        if (z.off > t) continue;
        if (Math.abs(z.x - v.pos.x) < 2.4 && Math.abs(z.z - v.pos.z) < 2.4 && v.pos.y < 3) {
          z.off = t + 45; vs.boostT = 3; TR.hud.toast('Pizza boost!', 'gold'); if (TR.audio) TR.audio.buy(0, 3);
        }
      }
    },
    drawPizzas: function (t) {
      var show = vs.current && vs.current.spec.pickups, m = vs.pizzaMesh;
      m.visible = !!show;
      if (!show) return;
      var d = new THREE.Object3D();
      for (var i = 0; i < vs.pizzas.length; i++) {
        var z = vs.pizzas[i];
        d.position.set(z.x, z.off > t ? -50 : 1.2 + Math.sin(t * 3 + i) * 0.2, z.z); d.rotation.set(0, t * 2 + i, 0); d.updateMatrix();
        m.setMatrixAt(i, d.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    },
    grind: function (v, dt) {
      var rails = TR.world.rails || [];
      for (var i = 0; i < rails.length; i++) {
        var r = rails[i], ax = r.a[0], az = r.a[1], bx = r.b[0], bz = r.b[1], ux = bx - ax, uz = bz - az, l = Math.hypot(ux, uz);
        ux /= l; uz /= l;
        var dot = (v.pos.x - ax) * ux + (v.pos.z - az) * uz;
        if (dot < 0 || dot > l) continue;
        var px = ax + ux * dot, pz = az + uz * dot;
        if (Math.hypot(v.pos.x - px, v.pos.z - pz) > 1.6 || v.pos.y < r.y - 0.6 || v.pos.y > r.y + 1.8) continue;
        if (v.vy > 0) continue;
        var dir = (v.vel.x * ux + v.vel.z * uz) >= 0 ? 1 : -1;
        var sp = Math.max(34, Math.abs(v.speed));
        vs.grindNow = true;
        v.pos.x = px + ux * dir * sp * dt; v.pos.z = pz + uz * dir * sp * dt; v.pos.y = r.y + 0.1; v.vy = 0; v.speed = sp;
        v.heading = Math.atan2(-ux * dir, -uz * dir);
        vs.grindT += dt;
        if (Math.random() < 0.6) TR.fx.spawn(v.pos.x, v.pos.y, v.pos.z, Math.random() * 6 - 3, 4, Math.random() * 6 - 3, 0xffd24a, 0.3, 0.5);
        return true;
      }
      return false;
    },
    driveWater: function (v, s, dt, sub) {
      var input = TR.input, a = input.axes();
      var target = a.z > 0 ? s.speed * a.z : (a.z < 0 ? -s.speed * 0.4 : 0);
      v.speed += Math.max(-s.accel * dt, Math.min(s.accel * dt, target - v.speed));
      v.heading -= a.x * s.turn * Math.min(1, Math.abs(v.speed) / 6) * dt;
      var fx = -Math.sin(v.heading), fz = -Math.cos(v.heading), k = 1 - Math.exp(-s.grip * dt * 2.4);
      v.vel.x += (fx * v.speed - v.vel.x) * k; v.vel.z += (fz * v.speed - v.vel.z) * k;
      var nx = v.pos.x + v.vel.x * dt, nz = v.pos.z + v.vel.z * dt;
      if (TR.world.isWater(nx, nz) && Math.hypot(nx, nz) < 620) { v.pos.x = nx; v.pos.z = nz; }
      else { v.speed *= 0.6; v.vel.multiplyScalar(0.4); }
      if (sub) {
        var up = (input.down('Space') ? 1 : 0) - (input.down('ShiftLeft') || input.down('ShiftRight') ? 1 : 0);
        v.pos.y = Math.max(TR.world.SEABED + 1.5, Math.min(-1.5, v.pos.y + up * 7 * dt));
      } else {
        v.pos.y = -1.25 + Math.sin(TR.app.t * 2.2) * 0.12;
        if (Math.abs(v.speed) > 20 && Math.random() < 0.5) TR.fx.spawn(v.pos.x - fx * 4, -1, v.pos.z - fz * 4, Math.random() * 4 - 2, 3, Math.random() * 4 - 2, 0xffffff, 0.5, 1, 8);
      }
      TR.world.collide.resolve(v.pos, s.radius, s.height, 0, -60);
      v.slip = 0;
    },
    driveAir: function (v, s, dt) {
      var input = TR.input, a = input.axes(), yaw = input.yaw;
      var fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      var wx = rx * a.x + fx * a.z, wz = rz * a.x + fz * a.z;
      var k = Math.min(1, s.accel * dt / s.speed);
      v.vel.x += (wx * s.speed - v.vel.x) * k; v.vel.z += (wz * s.speed - v.vel.z) * k;
      var up = (input.down('Space') ? 1 : 0) - (input.down('ShiftLeft') || input.down('ShiftRight') ? 1 : 0);
      v.vy += (up * s.climb - v.vy) * Math.min(1, dt * 3);
      if (!up && s.mode === 'air' && s.climb < 10) v.vy -= 1.2 * dt;
      v.pos.x += v.vel.x * dt; v.pos.y += v.vy * dt; v.pos.z += v.vel.z * dt;
      var r = Math.hypot(v.pos.x, v.pos.z);
      if (r > 560) { v.pos.x *= 560 / r; v.pos.z *= 560 / r; TR.hud.toast('The city ends here. You can never leave.', 'bad'); }
      v.pos.y = Math.min(v.pos.y, 220);
      var fl = TR.app.floorAt(v.pos), water = fl < -30;
      if (water) fl = -0.8;
      TR.world.collide.resolve(v.pos, s.radius, s.height, 0.8, fl);
      if (v.pos.y <= v.pos.ground) { v.pos.y = v.pos.ground; if (v.vy < 0) v.vy = 0; }
      var sp = Math.hypot(v.vel.x, v.vel.z);
      v.speed = sp;
      if (sp > 1) v.heading = Math.atan2(-v.vel.x, -v.vel.z) ;
      v.slip = 0;
      var rot = v.group.userData.rotor;
      if (rot) rot.rotation.y += dt * 30;
      if (input.mouseClicked && s.rotor && TR.fx) TR.fx.confetti({ x: v.pos.x, y: v.pos.y, z: v.pos.z }, 10, 4);
    },
    driveJet: function (v, s, dt) {
      var input = TR.input, a = input.axes(), yaw = input.yaw;
      var fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      var wx = rx * a.x + fx * a.z, wz = rz * a.x + fz * a.z, k = Math.min(1, s.accel * dt / s.speed);
      v.vel.x += (wx * s.speed - v.vel.x) * k; v.vel.z += (wz * s.speed - v.vel.z) * k;
      var thrust = input.down('Space') && v.fuel > 0;
      if (thrust) { v.vy += (s.climb - v.vy) * Math.min(1, dt * 4); v.fuel = Math.max(0, v.fuel - dt); TR.fx.spawn(v.pos.x, v.pos.y + 0.6, v.pos.z, 0, -8, 0, 0xff7a1a, 0.3, 0.8, 0); }
      else v.vy -= 22 * dt;
      v.pos.x += v.vel.x * dt; v.pos.y += v.vy * dt; v.pos.z += v.vel.z * dt;
      var fl = TR.app.floorAt(v.pos);
      TR.world.collide.resolve(v.pos, s.radius, s.height, 0.8, fl);
      if (v.pos.y <= v.pos.ground) { v.pos.y = v.pos.ground; if (v.vy < 0) v.vy = 0; v.fuel = Math.min(s.fuel, v.fuel + dt * 3); }
      v.speed = Math.hypot(v.vel.x, v.vel.z);
      if (v.speed > 1) v.heading = Math.atan2(-v.vel.x, -v.vel.z);
      TR.hud.carry(s.name + ' - fuel ' + Math.round(v.fuel / s.fuel * 100) + '%');
      if (v.pos.y < -1.2 && TR.world.isWater(v.pos.x, v.pos.z) && v.pos.y > -20) { var safe = TR.app.lastSafe || TR.app.session.run.spawn; v.pos.set(safe.x, safe.y + 0.1, safe.z); v.vel.set(0, 0, 0); v.vy = 0; v.fuel = s.fuel; TR.hud.toast('Splash!', 'bad'); }
      else if (v.pos.y <= v.pos.ground + 0.1 && !TR.world.isWater(v.pos.x, v.pos.z)) TR.app.lastSafe = { x: v.pos.x, y: v.pos.y, z: v.pos.z };
    },
    railLen: function () { var t = 0; for (var i = 0; i < RAIL.length; i++) { var a = RAIL[i], b = RAIL[(i + 1) % RAIL.length]; t += Math.hypot(b[0] - a[0], b[1] - a[1]); } return t; },
    railAt: function (s) {
      var L = vs.railLen(); s = ((s % L) + L) % L;
      for (var i = 0; i < RAIL.length; i++) {
        var a = RAIL[i], b = RAIL[(i + 1) % RAIL.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (s <= l) return { x: a[0] + (b[0] - a[0]) * s / l, z: a[1] + (b[1] - a[1]) * s / l, h: Math.atan2(-(b[0] - a[0]), -(b[1] - a[1])) };
        s -= l;
      }
      return { x: RAIL[0][0], z: RAIL[0][1], h: 0 };
    },
    snapRail: function (v, x, z) {
      var L = vs.railLen(), best = 0, bd = 1e12;
      for (var s = 0; s < L; s += 6) { var p = vs.railAt(s), d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z); if (d < bd) { bd = d; best = s; } }
      v.railS = best;
      var q = vs.railAt(best); v.pos.set(q.x, RAIL_Y + 0.5, q.z); v.heading = q.h;
    },
    driveRail: function (v, s, dt) {
      var a = TR.input.axes(), target = a.z * s.speed;
      v.speed += Math.max(-s.accel * dt, Math.min(s.accel * dt, target - v.speed));
      v.railS += v.speed * dt;
      var q = vs.railAt(v.railS);
      v.pos.set(q.x, RAIL_Y + 0.5, q.z); v.heading = v.speed >= 0 ? q.h : q.h + Math.PI;
      v.slip = 0;
    },
    /** Left mouse while riding. */
    ability: function (v, s) {
      var p = v.pos;
      if (s.trumpet) { TR.crowds.scare(p, 3); TR.audio.trumpet(); TR.cam.shake = 0.3; return; }
      if (s.ladder) return vs.raiseLadder(v);
      if (s.mode === 'mole') return TR.app.tryMoleDig(v);
    },
    raiseLadder: function (v) {
      var spots = TR.app.ladderSpots(), best = null, bd = 22 * 22;
      spots.forEach(function (l) { var d = (l.x - v.pos.x) * (l.x - v.pos.x) + (l.z - v.pos.z) * (l.z - v.pos.z); if (d < bd) { bd = d; best = l; } });
      if (!best) { TR.hud.toast('Nothing to climb here. Look for a rooftop light.', 'bad'); return; }
      TR.hud.toast('The ladder goes up!', 'gold');
      TR.audio.door();
      vs.leave();
      TR.player.teleport(best.x, best.y + 0.5, best.z, TR.player.heading);
      TR.app.onLadderUsed(best);
    },
    sync: function (v) {
      v.group.position.copy(v.pos);
      v.group.rotation.set(0, v.heading, 0);
      if (v.spec.drift) v.group.rotation.z = Math.max(-0.14, Math.min(0.14, (v.slip || 0) * 0.012 * Math.sign(TR.input.axes().x || 0)));
      if (v.spec.mode === 'jet') { v.group.visible = !!vs.current; }
    },
    /** Left mouse on foot uses the current gear. */
    updateGear: function (dt, sess) {
      var input = TR.input, g = vs.gear, me = sess.view.me;
      if (!g || vs.current || TR.interiors.current) { if (me.cannonOn) sess.cannon(false); return; }
      if (g === 'money_cannon') {
        var want = input.mouseDown;
        if (want !== me.cannonOn) { var r = sess.cannon(want); if (want && r.error) { TR.hud.toast(r.error, 'bad'); input.mouseDown = false; } }
        if (me.cannonOn) {
          var p = TR.player.pos, h = TR.input.yaw;
          for (var i = 0; i < 8; i++) TR.fx.spawn(p.x, p.y + 1.6, p.z, -Math.sin(h) * 22 + Math.random() * 8 - 4, 6 + Math.random() * 6, -Math.cos(h) * 22 + Math.random() * 8 - 4, 0x4fbf5f, 1.8, 1.4, 12);
          TR.crowds.lure({ x: p.x - Math.sin(h) * 24, z: p.z - Math.cos(h) * 24 }, 1);
          if (Math.random() < 0.3) TR.audio.buy(0, 1);
          TR.hud.carry('Money Cannon - ' + TR.fmt(me.cannonUsed) + ' of $30B fired');
        }
        return;
      }
      if (!input.mouseClicked) return;
      var q = TR.player.pos;
      if (g === 'launcher') {
        var yaw = TR.input.yaw, tx = q.x - Math.sin(yaw) * 30, tz = q.z - Math.cos(yaw) * 30;
        TR.fx.firework(tx, q.y + 34, tz); TR.audio.boom(0.5); TR.crowds.cheer(2);
      } else if (g === 'megaphone') {
        TR.crowds.lure(q, 5); TR.audio.trumpet(); TR.hud.toast('"BUY MORE THINGS!" The crowd gathers.', 'gold');
      }
    }
  };
})();
