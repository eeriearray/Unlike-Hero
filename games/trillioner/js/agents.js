/* The Refund Office: agents who chase you and give your money back. The chase lives here, where the walls are;
 * the engine decides what a catch is worth and caps it. Shops are safe, boats lose them, and fast cars flatten them. */
(function () {
  var TR = window.TR = window.TR || {};
  var R = window.TRD.rules, B = R.B;
  var TIERS = [[25, 1], [100, 2], [250, 3], [500, 4], [800, 5]], VEST = 0xff6a13, RADIUS = 0.7;

  function nameTag() {
    var c = document.createElement('canvas'); c.width = 256; c.height = 56;
    var g = c.getContext('2d');
    g.fillStyle = '#ff6a13'; g.fillRect(0, 0, 256, 56);
    g.fillStyle = '#fff'; g.font = '900 36px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('REFUND', 128, 30);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false }));
    s.scale.set(2.8, 0.62, 1); s.position.y = 3.65;
    return s;
  }

  var ag = TR.agents = {
    list: [], noticed: false,
    init: function (scene) { ag.scene = scene; ag.tag = null; },
    reset: function () {
      ag.list.forEach(function (a) { ag.scene.remove(a.group); });
      ag.list = []; ag.noticed = false;
    },
    active: function (sess) { var m = R.MODES[sess.view.mode]; return !!(m && m.agents) && !sess.view.over && !sess.view.me.won; },
    spawn: function (pos) {
      var fig = TR.player.figure(VEST, 0x2a1d16, 0xf0c49a), p = fig.parts;
      p.base.leg = 0x23252e; TR.wardrobe.dress(p, {});
      TR.player.part(0.82, 0.08, 0.5, 0xfff36b, 0, 0.5, 0, p.chest).castShadow = false;   // reflective stripe
      TR.player.part(0.82, 0.08, 0.5, 0xfff36b, 0, 0.24, 0, p.chest).castShadow = false;
      TR.player.part(0.34, 0.44, 0.06, 0xf4f4f0, 0, -0.4, -0.16, p.foreR).castShadow = false; // clipboard
      fig.group.add(ag.tag ? ag.tag.clone() : (ag.tag = nameTag()));
      fig.group.traverse(function (o) { o.castShadow = false; });   // five full figures with shadows is what a laptop feels
      ag.scene.add(fig.group);
      var a = { group: fig.group, parts: p, x: 0, y: 0, z: 0, h: 0, walk: 0, sp: 0, stun: 0, spin: 0, stuck: 0, lastX: 0, lastZ: 0, checkT: 0, route: null, routeT: 0 };
      ag.place(a, pos);
      ag.list.push(a);
      return a;
    },
    /** Somewhere on a road out of sight, with a run-up to you. */
    place: function (a, pos) {
      var G = TR.gps.G, best = null, want = 95;
      for (var i = 0; i < 24; i++) {
        var n = G.nodes[Math.floor(Math.random() * G.nodes.length)], d = Math.hypot(n.x - pos.x, n.z - pos.z);
        if (!best || Math.abs(d - want) < best.err) best = { n: n, err: Math.abs(d - want) };
      }
      a.x = best.n.x; a.z = best.n.z; a.y = 0; a.route = null; a.routeT = 0; a.lastX = a.x; a.lastZ = a.z;
      a.group.rotation.set(0, 0, 0);
    },
    /** Where they head: at you, or to the door of the shop you are hiding in. */
    goal: function (pos, i) {
      var room = TR.interiors.current;
      if (!room) return { x: pos.x, z: pos.z, hunt: true };
      var f = room.front, a = (i + 0.5) / Math.max(1, ag.list.length) * Math.PI - Math.PI / 2, nx = f.nx, nz = f.nz;
      return { x: f.x + (nx * Math.cos(a) - nz * Math.sin(a)) * 16, z: f.z + (nz * Math.cos(a) + nx * Math.sin(a)) * 16, hunt: false };
    },
    update: function (dt, sess, pos, t) {
      if (!ag.active(sess)) { ag.list.forEach(function (a) { a.group.visible = false; }); return; }
      var me = sess.view.me, spentB = me.spent / B, want = 0;
      TIERS.forEach(function (x) { if (spentB >= x[0]) want = x[1]; });
      if (want && !ag.noticed) {
        ag.noticed = true;
        TR.hud.bigText('THE REFUND OFFICE', 'They want to give it all back. Run. Hide in a shop.');
        TR.audio.trumpet();
      }
      while (ag.list.length < want) ag.spawn(pos);
      var under = pos.y < -20 && !TR.interiors.current, skill = Math.min(1, spentB / 900), speed = 12.5 + skill * 6;
      ag.list.forEach(function (a, i) {
        // beyond this they are only a dot on the map: still chasing, not drawn
        a.group.visible = !under && Math.hypot(a.x - pos.x, a.z - pos.z) < 90;
        if (under) return;
        if (a.stun > 0) { ag.stunned(a, dt, pos); return; }
        var g = ag.goal(pos, i), dx = g.x - a.x, dz = g.z - a.z, d = Math.hypot(dx, dz);
        if (d > 230) { ag.place(a, pos); return; }
        var tx = g.x, tz = g.z;
        // blocked by a building: go round by road for a while
        a.checkT += dt;
        if (a.checkT > 0.5) {
          if (Math.hypot(a.x - a.lastX, a.z - a.lastZ) < speed * 0.5 * 0.35 && d > 3) { a.route = TR.gps.pathBetween(a.x, a.z, g.x, g.z); a.routeT = 4; }
          a.lastX = a.x; a.lastZ = a.z; a.checkT = 0;
        }
        if (a.route && a.routeT > 0) {
          a.routeT -= dt;
          while (a.route.length && Math.hypot(a.route[0].x - a.x, a.route[0].z - a.z) < 3) a.route.shift();
          if (a.route.length) { tx = a.route[0].x; tz = a.route[0].z; } else a.route = null;
        }
        dx = tx - a.x; dz = tz - a.z; var l = Math.hypot(dx, dz) || 1;
        var go = !g.hunt && d < 1.2 ? 0 : speed, nx = a.x + dx / l * go * dt, nz = a.z + dz / l * go * dt;
        if (!TR.world.isWater(nx, nz)) {
          var body = { x: nx, y: 0, z: nz };
          TR.world.collide.resolve(body, RADIUS, 2.6, 0.6, 0);
          a.x = body.x; a.z = body.z;
        }
        if (go) a.h = Math.atan2(-dx / l, -dz / l);
        a.sp += (go - a.sp) * Math.min(1, dt * 8);
        a.walk += a.sp * dt * 1.05;
        a.group.position.set(a.x, a.y, a.z);
        a.group.rotation.y = a.h;
        TR.player.stride(a.parts, Math.sin(a.walk), Math.cos(a.walk), Math.min(1, a.sp / 18), Math.min(1, a.sp / 7));
        ag.contact(a, sess, pos);
      });
    },
    contact: function (a, sess, pos) {
      if (TR.interiors.current || Math.abs(pos.y - a.y) > 2.6) return;
      var d = Math.hypot(pos.x - a.x, pos.z - a.z), v = TR.vehicles.current;
      if (v) {
        var fast = Math.abs(v.speed) > 12;
        if (d < v.spec.radius + 1.3 && fast) {
          a.stun = 7; a.vy = 12; a.spin = 8; a.vx = (a.x - pos.x) * 3; a.vz = (a.z - pos.z) * 3;
          TR.audio.thud(); TR.cam.shake = Math.max(TR.cam.shake, 0.4);
          TR.dares.bump('smash');
        } else if (d < v.spec.radius + 1) ag.catch(a, sess, pos);
        return;
      }
      if (d < 1.7) ag.catch(a, sess, pos);
    },
    catch: function (a, sess, pos) {
      sess.extra({ t: 'caught' }, function (r) {
        if (!r || !r.ok) return;
        TR.hud.bigText('REFUNDED!', '+' + TR.fmt(r.back) + ' back in your account');
        TR.hud.flash(0.5);
        TR.audio.denied();
        TR.cam.shake = Math.max(TR.cam.shake, 0.7);
        TR.fx.bills({ x: pos.x, y: pos.y + 2, z: pos.z }, 50, 7);
      });
      a.stun = 5; a.vy = 0; a.vx = 0; a.vz = 0; a.spin = 0; a.paid = true;
    },
    stunned: function (a, dt, pos) {
      a.stun -= dt;
      if (a.spin) {   // flattened by a car
        a.vy -= 28 * dt; a.y = Math.max(0, a.y + a.vy * dt); a.x += a.vx * dt; a.z += a.vz * dt;
        a.group.rotation.x += a.spin * dt;
        if (a.y <= 0) { a.vx *= 0.8; a.vz *= 0.8; a.spin = 0; a.group.rotation.x = 1.5; }
      } else if (a.group.rotation.x === 0) {   // pleased with themselves: walks off
        a.x += Math.sin(a.h) * 5 * dt; a.z += Math.cos(a.h) * 5 * dt;
        TR.player.stride(a.parts, Math.sin(a.walk += dt * 6), Math.cos(a.walk), 0, 0.6);
      }
      a.group.position.set(a.x, a.y, a.z);
      if (a.stun <= 0) { ag.place(a, pos); }
    },
    dots: function () {
      return ag.list.filter(function (a) { return a.stun <= 0; }).map(function (a) { return { x: a.x, z: a.z, c: '#ff6a13', r: 4 }; });
    }
  };
})();
