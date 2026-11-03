/* The route to the next best thing: arrows along the road, a line on the map, one line of advice on screen. */
(function () {
  var TR = window.TR = window.TR || {};
  var D = window.TRD.districts, MAX = 90, STEP = 5, dummy = new THREE.Object3D();

  /** Roads as a graph: every road corner and every crossing is a node. */
  function buildGraph() {
    var nodes = [], links = [], segs = [];
    function node(x, z) {
      for (var i = 0; i < nodes.length; i++) if (Math.abs(nodes[i].x - x) < 1 && Math.abs(nodes[i].z - z) < 1) return i;
      nodes.push({ x: x, z: z }); links.push([]);
      return nodes.length - 1;
    }
    D.ROADS.forEach(function (r) { for (var i = 1; i < r.pts.length; i++) segs.push({ a: r.pts[i - 1], b: r.pts[i], stops: [0, 1] }); });
    for (var i = 0; i < segs.length; i++) for (var j = i + 1; j < segs.length; j++) {
      var A = segs[i], B = segs[j], rx = A.b[0] - A.a[0], rz = A.b[1] - A.a[1], sx = B.b[0] - B.a[0], sz = B.b[1] - B.a[1], den = rx * sz - rz * sx;
      if (Math.abs(den) < 1e-6) continue;
      var qx = B.a[0] - A.a[0], qz = B.a[1] - A.a[1], t = (qx * sz - qz * sx) / den, u = (qx * rz - qz * rx) / den;
      if (t > -0.02 && t < 1.02 && u > -0.02 && u < 1.02) { A.stops.push(Math.max(0, Math.min(1, t))); B.stops.push(Math.max(0, Math.min(1, u))); }
    }
    segs.forEach(function (s) {
      s.stops.sort(function (a, b) { return a - b; });
      var prev = null;
      s.stops.forEach(function (t) {
        var n = node(s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t);
        if (prev != null && prev !== n) { var l = Math.hypot(nodes[n].x - nodes[prev].x, nodes[n].z - nodes[prev].z); links[n].push([prev, l]); links[prev].push([n, l]); }
        prev = n;
      });
    });
    return { nodes: nodes, links: links, segs: segs };
  }
  function closestNode(G, x, z) {
    var best = 0, bd = 1e12;
    G.nodes.forEach(function (n, i) { var d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  /** Where a point meets the nearest road, so the route joins it there, not at the nearest crossing. */
  function onRoad(G, x, z) {
    var best = null, bd = 1e12;
    G.segs.forEach(function (s) {
      var dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], t = Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / (dx * dx + dz * dz)));
      var px = s.a[0] + dx * t, pz = s.a[1] + dz * t, d = (px - x) * (px - x) + (pz - z) * (pz - z);
      if (d < bd) { bd = d; best = { x: px, z: pz }; }
    });
    return best;
  }
  function shortest(G, from, to) {
    var n = G.nodes.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    dist[from] = 0;
    for (var k = 0; k < n; k++) {
      var u = -1, m = Infinity;
      for (var i = 0; i < n; i++) if (!done[i] && dist[i] < m) { m = dist[i]; u = i; }
      if (u < 0 || u === to) break;
      done[u] = 1;
      G.links[u].forEach(function (e) { if (dist[u] + e[1] < dist[e[0]]) { dist[e[0]] = dist[u] + e[1]; prev[e[0]] = u; } });
    }
    if (dist[to] === Infinity) return null;
    var out = [];
    for (var c = to; c >= 0; c = prev[c]) out.unshift(G.nodes[c]);
    return out;
  }

  function doorX(s) { return s.front.x - s.front.nx * s.front.off; }
  function doorZ(s) { return s.front.z - s.front.nz * s.front.off; }

  var gps = TR.gps = {
    on: true, target: null, route: [], t: 0, scan: 0,
    init: function (scene) {
      var sh = new THREE.Shape();
      sh.moveTo(0, -1); sh.lineTo(1.25, 0.3); sh.lineTo(1.25, 1.05); sh.lineTo(0, -0.2); sh.lineTo(-1.25, 1.05); sh.lineTo(-1.25, 0.3); sh.closePath();
      var geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2);
      gps.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xff2fa8, transparent: true, opacity: 0.9, depthWrite: false, fog: false, toneMapped: false }), MAX);
      gps.mesh.frustumCulled = false; gps.mesh.count = 0; gps.mesh.renderOrder = 3;
      scene.add(gps.mesh);
      var pin = new THREE.Group();
      var mat = new THREE.MeshBasicMaterial({ color: 0xff2fa8, fog: false, toneMapped: false });
      var cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.8, 4), mat); cone.rotation.x = Math.PI; pin.add(cone);
      var stem = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), mat); stem.position.y = 2.5; pin.add(stem);
      pin.visible = false; pin.frustumCulled = false;
      scene.add(pin);
      gps.pin = pin;
      gps.G = buildGraph();
      gps.line = document.createElement('div'); gps.line.className = 'gpsline'; gps.line.style.display = 'none';
      TR.hud.root.appendChild(gps.line);
    },
    reset: function () { gps.target = null; gps.route = []; gps.scan = 0; gps.routeFor = null; if (gps.mesh) gps.mesh.count = 0; if (gps.pin) gps.pin.visible = false; if (TR.map) TR.map.route = null; },
    /** A road path between two points, for anyone who needs to get round a building. */
    pathBetween: function (ax, az, bx, bz) {
      var G = gps.G, a = onRoad(G, ax, az), b = onRoad(G, bx, bz), mid = shortest(G, closestNode(G, a.x, a.z), closestNode(G, b.x, b.z));
      return mid ? [a].concat(mid, [b, { x: bx, z: bz }]) : [{ x: bx, z: bz }];
    },
    toggle: function () { gps.on = !gps.on; TR.hud.toast(gps.on ? 'Guide on' : 'Guide off'); if (!gps.on) gps.reset(); },

    /** Picks the shop worth the most per step: lots of unspent money, not too far, and not a business that pays you back. */
    pick: function (sess, pos) {
      var me = sess.view.me, run = sess.run, sum = {}, tally = {}, room = TR.interiors.current;
      if (room) {
        var best = null, bp = -1;
        TR.pads.list.forEach(function (p) {
          if (p.item.site !== room.id || p.store || TR.pads.state(p, sess) !== 'open' || !sess.quote(p.item.id).ok) return;
          if (p.item.price > bp) { bp = p.item.price; best = p; }
        });
        if (best) return { room: true, x: best.x, y: best.y, z: best.z, name: best.item.name, sub: TR.fmt(best.item.price), item: best.item };
        var d = TR.interiors.doorPos();
        return { room: true, x: d.x, y: 0, z: d.z, name: 'Way out', sub: 'Nothing left here you can buy', exit: true };
      }
      var ev = TR.app.eventSite;
      if (ev) return { site: ev.site, x: doorX(ev.site), y: ev.site.y || 0, z: doorZ(ev.site), name: ev.site.name, sub: ev.id === 'firesale' ? 'FIRE SALE, half price' : 'Surprise auction', hot: true };
      var noRide = !Object.keys(me.vehicles).length && me.stats.purchases >= 5, rideSite = null, rideFar = Infinity;
      TR.pads.list.forEach(function (p) {
        var it = p.item, site = run.sites[it.site];
        if (!site || site.kind !== 'room' || p.store) return;
        if ((site.b.lock && !me.flags[site.b.lock]) || TR.pads.state(p, sess) !== 'open' || !sess.quote(it.id).ok) return;
        var w = it.price * (it.income > 0 ? 0.35 : 1);
        sum[it.site] = (sum[it.site] || 0) + w;
        tally[it.site] = (tally[it.site] || 0) + it.price;
        if (noRide && it.reward && it.reward.vehicles && it.reward.vehicles.length && !it.income) { var rf = Math.hypot(site.front.x - pos.x, site.front.z - pos.z); if (rf < rideFar) { rideFar = rf; rideSite = { site: site, it: it }; } }
      });
      if (rideSite) return { site: rideSite.site, x: doorX(rideSite.site), y: rideSite.site.y || 0, z: doorZ(rideSite.site), name: rideSite.site.name, sub: 'Get a ride: ' + rideSite.it.name };
      var top = null, score = 0;
      Object.keys(sum).forEach(function (id) {
        var s = run.sites[id], under = (s.y || 0) < -20, here = pos.y < -20, far = Math.hypot(s.front.x - pos.x, s.front.z - pos.z) + (under !== here ? 200 : 0), v = Math.sqrt(sum[id]) / ((TR.vehicles.current ? far * 0.3 : far) + 25);
        if (gps.target && gps.target.site === s) v *= 1.5;   // don't flip between two equal shops
        if (v > score) { score = v; top = s; }
      });
      if (!top) return null;
      return { site: top, x: doorX(top), y: top.y || 0, z: doorZ(top), name: top.name, sub: TR.fmt(tally[top.id]) + ' to spend inside' };
    },
    plan: function (pos) {
      var tg = gps.target, G = gps.G;
      if (!tg) { gps.route = []; return; }
      if (tg.room || pos.y < -20 || tg.y < -20) { gps.route = [{ x: pos.x, z: pos.z }, { x: tg.x, z: tg.z }]; return; }
      var a = onRoad(G, pos.x, pos.z), b = onRoad(G, tg.x, tg.z), mid = shortest(G, closestNode(G, a.x, a.z), closestNode(G, b.x, b.z));
      var direct = Math.hypot(tg.x - pos.x, tg.z - pos.z);
      gps.route = !mid || direct < 40 ? [{ x: pos.x, z: pos.z }, { x: tg.x, z: tg.z }] : [{ x: pos.x, z: pos.z }, a].concat(mid, [b, { x: tg.x, z: tg.z }]);
    },
    update: function (dt, sess, pos, t) {
      if (!gps.on || sess.view.over) return;
      gps.scan -= dt;
      if (gps.scan <= 0) {
        gps.scan = 0.8;
        var prev = gps.target, next = gps.pick(sess, pos);
        gps.target = next;
        gps.plan(pos);
        if (next && (!prev || prev.name !== next.name)) gps.flash = 1;
        TR.map.route = next && !next.room ? gps.route : null;
        gps.say(next, pos);
      }
      gps.draw(pos, t);
    },
    say: function (tg, pos) {
      var L = gps.line;
      if (!tg) {
        var left = TR.app.session.view.me.balance;
        L.style.display = left > 0 ? '' : 'none';
        L.className = 'gpsline';
        L.innerHTML = '<b>Nothing left in the open.</b> <span>Read the clues: hidden deals are out there.</span>';
        return;
      }
      L.style.display = '';
      L.className = 'gpsline' + (tg.hot ? ' hot' : '');
      var dist = tg.room ? '' : ' · ' + Math.round(Math.hypot(tg.x - pos.x, tg.z - pos.z)) + 'm';
      L.innerHTML = '<i>' + (tg.room ? (tg.exit ? 'NEXT' : 'BUY') : 'NEXT') + '</i><b></b><span></span>';
      L.querySelector('b').textContent = tg.name;
      L.querySelector('span').textContent = tg.sub + dist;
    },
    /** Arrows flow along the route from your feet. */
    draw: function (pos, t) {
      var r = gps.route, n = 0, tg = gps.target, m = gps.mesh;
      if (!r.length || !tg) { m.count = 0; gps.pin.visible = false; return; }
      var inVehicle = !!TR.vehicles.current, step = inVehicle ? STEP * 1.8 : STEP * (tg.room ? 0.65 : 1), sc = inVehicle ? 2.2 : tg.room ? 0.6 : 1.3, y = pos.y < -20 || tg.room ? pos.y + 0.09 : 0.09;
      var off = (t * (inVehicle ? 9 : 3.2)) % step, walked = 0, px = pos.x, pz = pos.z, first = true;
      for (var i = 1; i < r.length && n < MAX; i++) {
        var ax = i === 1 ? pos.x : r[i - 1].x, az = i === 1 ? pos.z : r[i - 1].z, bx = r[i].x, bz = r[i].z, l = Math.hypot(bx - ax, bz - az);
        if (l < 0.01) continue;
        var ux = (bx - ax) / l, uz = (bz - az) / l, h = Math.atan2(-ux, -uz);
        for (var s = (step - (walked % step)) % step + off % step; s < l && n < MAX; s += step) {
          var fx = ax + ux * s, fz = az + uz * s;
          if (Math.hypot(fx - pos.x, fz - pos.z) < 2.4) continue;
          dummy.position.set(fx, y, fz); dummy.rotation.set(0, h, 0); dummy.scale.setScalar(sc); dummy.updateMatrix();
          m.setMatrixAt(n++, dummy.matrix);
        }
        walked += l;
      }
      m.count = n; m.instanceMatrix.needsUpdate = true;
      gps.pin.visible = true;
      gps.pin.position.set(tg.x, (tg.y || 0) + (tg.room ? 3.6 : 8) + Math.sin(t * 3) * 0.5, tg.z);
      gps.pin.rotation.y = t * 1.6;
      gps.pin.scale.setScalar(tg.room ? 0.5 : 1.7);
    }
  };
})();
