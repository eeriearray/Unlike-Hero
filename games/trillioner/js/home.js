/* Your place: a house in the Suburbs that fills up with what you buy. A garage with your cars in it, a gallery of the
 * things you could not think of a use for, and upgrades that really appear. The rules are in the engine. */
(function () {
  var TR = window.TR = window.TR || {};
  var H = window.TRD.home, U = window.TRD.uses;
  var QUIPS = ['He looks at your shoes.', 'He has seen richer.', '"Will sir be spending all of it today?"', 'He sighs, very quietly.', '"Your balance is showing, sir."'];

  function sign(text, x, y, z, ry, w) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 96;
    var g = c.getContext('2d');
    g.fillStyle = '#17181c'; g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#e8dfc8'; g.font = '900 56px Impact, "Arial Narrow", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 52);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w || 7, (w || 7) * 96 / 512), new THREE.MeshBasicMaterial({ map: t }));
    m.position.set(x, y, z); m.rotation.y = ry;
    return m;
  }
  function person(shirt, hair, skin, style, x, y, z, ry, scale) {
    var fig = TR.player.figure(shirt, hair, skin);
    if (style) TR.wardrobe.dress(fig.parts, style);
    fig.group.position.set(x, y, z); fig.group.rotation.y = ry; fig.group.scale.setScalar(scale || 1);
    return fig.group;
  }

  /** One upgrade's shape, at a spot. Also how its picture in the shop gets drawn. */
  var PIECES = {
    marble: function (g, x, z) { for (var i = -2; i < 2; i++) for (var j = -2; j < 2; j++) g.box(x + i * 2 + 1, 0, z + j * 2 + 1, 2, 0.1, 2, (i + j) % 2 ? 0xe9e6dd : 0x8d8f92); },
    chandelier: function (g, x, z, y) {
      y = y == null ? 2 : y;
      g.cyl(x, y + 1.6, z, 0.05, 1.6, 0xc9a22a, 6);
      g.lathe([[0.001, y + 0.3], [1.6, y + 0.65], [2.1, y + 1.1], [0.4, y + 1.65], [0.001, y + 1.7]], x, 0, z, 0xd9b23a, 14);
      for (var i = 0; i < 12; i++) { var a = i / 12 * 6.283; g.blob(x + Math.cos(a) * 2.1, y + 0.75, z + Math.sin(a) * 2.1, 0.13, 0.3, 0.13, 0xfff2c4); }
      g.blob(x, y + 0.1, z, 0.28, 0.4, 0.28, 0xfff2c4);
    },
    pool: function (g, x, z) {
      g.box(x, 0, z, 18, 0.32, 11, 0xd9a412);
      g.box(x, 0.32, z, 16.4, 0.03, 9.4, 0x1f8fb8);
      g.box(x, 0.35, z - 2, 12, 0.012, 0.5, 0x4cc4e4).box(x + 2, 0.35, z + 2, 9, 0.012, 0.5, 0x4cc4e4);
      g.box(x + 7, 0.32, z - 4, 0.5, 1.5, 0.1, 0xc4c8cc);
    },
    helipad: function (g, x, z, y) {
      y = y || 0;
      g.cyl(x, y, z, 6.4, 0.3, 0x3a3c40, 24);
      g.box(x - 1.7, y + 0.3, z, 0.7, 0.03, 4.4, 0xf2efe6).box(x + 1.7, y + 0.3, z, 0.7, 0.03, 4.4, 0xf2efe6).box(x, y + 0.3, z, 3, 0.03, 0.7, 0xf2efe6);
    },
    goldhouse: function (g, x, z) {
      g.box(x, 0, z, 6, 3, 5, 0xe0ad24); g.gable(x, 3, z, 7, 2, 6, 0xc8921a, false);
      g.box(x, 0, z + 2.52, 1.2, 2, 0.05, 0x8a6412);
    }
  };

  var home = TR.home = {
    site: null, group: null, boxes: [], cars: [], gallery: [], V: null, told: false,
    /** Fresh day, empty house. */
    reset: function () { home.V = null; home.outside = {}; home.told = false; TR.models.mods = {}; },
    at: function () { return !!TR.interiors.current && TR.interiors.current.id === H.SITE; },

    // ── everything that follows from what you own ──
    sync: function (me, t) {
      var key = me.homeV + ':' + me.styleV + ':' + Object.keys(me.goods).length + ':' + Object.keys(me.vehicles).length;
      if (!home.told && t > 25000) {
        home.told = true;
        TR.hud.toast('Your Place is on the map: the green dot. It is empty. For now.', 'gold');
      }
      if (key === home.V) return;
      var first = home.V == null;
      home.V = key;
      home.fitCars(me);
      home.exterior(me, first);
      if (home.at()) home.build();
    },
    /** Puts your paint, wheels and spoiler on every car you have out. */
    fitCars: function (me) {
      var m = {}, f = me.fitted, get = function (s) { return f[s] ? H.BY[f[s]].look : null; };
      if (get('paint')) m.paint = get('paint').color;
      if (get('rim')) m.rim = get('rim').color;
      if (get('neon')) m.neon = get('neon').color;
      if (get('wing')) m.wing = 1;
      if (get('horn')) m.horn = get('horn').notes;
      var sig = JSON.stringify(m);
      if (sig === home.modSig) return;
      home.modSig = sig;
      TR.models.mods = m;
      var V = TR.vehicles;
      Object.keys(V.placed).forEach(function (k) {
        var mesh = V.placed[k].group.children[0], old = mesh.geometry;
        mesh.geometry = V.SPECS[k].build().geometry(); old.dispose();
      });
      Object.keys(TR.traffic.drivers || {}).forEach(function (k) {
        var mesh = TR.traffic.drivers[k].mesh, old = mesh.geometry;
        mesh.geometry = V.SPECS[k].build().geometry(); old.dispose();
      });
    },
    exterior: function (me) {
      var site = TR.app.session.run.sites[H.SITE], b = site.b, done = home.outside = home.outside || {};
      if (me.home.helipad && !done.helipad) {
        done.helipad = true;
        var g = new TR.Geo(); PIECES.helipad(g, b.x, b.z, b.h + 1.65);   // on top of the villa's raised middle
        TR.world.runMesh(g, TR.world.solid, true);
        TR.world.projectBoxes.push(TR.world.collide.addBox(b.x, b.h + 1.6, b.z, 12, 0.35, 12, { project: 'pad' }));
      }
      if (me.home.goldhouse && !done.gold) {
        done.gold = true;
        TR.world.goldSweep(b, 0);
        TR.world.runLayer.add(TR.fx.raiseFlag(b.x, b.h + 0.8, b.z));
      }
    },

    // ── inside ──
    enter: function (site) { home.site = site; home.build(); },
    leave: function () {
      home.clear();
      home.site = null; home.cars = []; home.gallery = [];
      TR.agents.rest = Math.max(TR.agents.rest || 0, 10);   // nobody gets refunded on their own doorstep
    },
    clear: function () {
      if (home.group) {
        home.group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); if (o.material && o.material !== TR.world.neonMat) o.material.dispose(); });
        home.group.parent.remove(home.group);
        home.group = null;
      }
      home.boxes.forEach(function (b) { b.off = true; });
      home.boxes = [];
    },
    build: function () {
      home.clear();
      var site = home.site, me = TR.app.session.view.me, r = site.room, x = r.ox, z = r.oz, hw = r.w / 2, hd = r.d / 2, C = TR.world.collide;
      var grp = home.group = new THREE.Group(), g = new TR.Geo();
      TR.interiors.group.add(grp);
      function box(px, pz, w, h, d) { home.boxes.push(C.addBox(px, 0, pz, w, h, d, { room: 1 })); }

      if (me.home.marble) for (var i = 0; i < Math.ceil(r.w / 5); i++) for (var j = 0; j < Math.ceil(r.d / 5); j++) g.tile(x - hw + i * 5, z - hd + j * 5, x - hw + (i + 1) * 5, z - hd + (j + 1) * 5, 0.02, (i + j) % 2 ? 0xe9e6dd : 0x8d8f92);

      // garage, along the left wall
      g.tile(x - hw + 1, z - hd + 4, x - 12, z + hd - 15, 0.04, 0x3a3c40);
      grp.add(sign('GARAGE', x - hw + 0.75, 7, z - 4, Math.PI / 2, 9));
      var V = TR.vehicles, kinds = Object.keys(me.vehicles).filter(function (k) { var s = V.SPECS[k]; return s && s.height <= 6 && !s.underOnly && s.mode !== 'rail' && s.mode !== 'water' && s.mode !== 'sub' && s.mode !== 'jet'; }).slice(0, 6);
      home.cars = kinds.map(function (k, n) {
        var cz = z + hd - 21 - n * 9, cx = x - hw + 8.5, mesh = V.SPECS[k].build().mesh(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: 0x444444 }), true, false);
        mesh.matrixAutoUpdate = true; mesh.position.set(cx, 0, cz); mesh.rotation.y = -Math.PI / 2;
        grp.add(mesh);
        var sp = V.SPECS[k];
        box(cx, cz, Math.max(5.4, sp.radius * 3.2), 2.4, Math.max(2.5, sp.radius * 1.6));
        return { kind: k, x: cx, z: cz };
      });

      // gallery, along the right: everything with no better use, on a plinth
      g.tile(x + 11, z - hd + 4, x + hw - 1, z + hd - 15, 0.04, 0x6e4a2e);
      grp.add(sign('GALLERY', x + hw - 0.75, 7, z - 4, -Math.PI / 2, 9));
      var run = TR.app.session.run;
      var shown = Object.keys(me.goods).filter(function (id) { return U.GROUP[id] === 'place' && run.items[id]; }).reverse().slice(0, 36);
      home.gallery = shown.map(function (id, n) {
        var q = { item: run.items[id], kind: TR.goods.kindFor(run.items[id]), x: x + 13.5 + (n % 4) * 4.4, z: z + hd - 20 - Math.floor(n / 4) * 4.8 };
        box(q.x, q.z, 1.5, 1.2, 1.5);
        return q;
      });

      // the board by the door
      var bx = x + hw - 2.2, bz = z + hd - 8;
      g.box(bx + 0.6, 0, bz, 0.4, 4.6, 4, 0x2a2c30);
      g.box(bx + 0.37, 0.8, bz, 0.08, 3, 3.5, 0x4a3524);
      for (var q = 0; q < 3; q++) g.box(bx + 0.32, 1.2 + q, bz, 0.04, 0.5, 2.8, 0xe8dfc8);
      grp.add(sign('HOME AND CARS', bx + 0.3, 5.3, bz, -Math.PI / 2, 6));
      box(bx + 0.6, bz, 0.8, 4.6, 4);
      home.board = { x: bx - 1.2, z: bz };

      // what you paid for
      if (me.home.pool) { PIECES.pool(g, x, z - hd + 13); }
      if (me.home.chandelier) PIECES.chandelier(g, x, z + hd - 22, r.h - 3.2);
      if (me.home.statue) {
        var sz = z - 3;
        g.box(x, 0, sz, 4, 1, 4, 0xd8d4c8); box(x, sz, 4, 1, 4);
        grp.add(person(0xdedad0, 0x2a1d16, 0xdcae8a, me.style, x, 1, sz, Math.PI, 2.9));
      }
      home.butler = null;
      if (me.home.butler) {
        var bux = x + 6.5, buz = z + hd - 13;
        grp.add(person(0x15161d, 0x8d8d8d, 0xe2b48c, { top: 'top_suit', legs: 'legs_black', shoes: 'shoes_black' }, bux, 0, buz, -0.5, 1));
        box(bux, buz, 1, 2.6, 1);
        home.butler = { x: bux, z: buz, q: QUIPS[Math.floor(Math.random() * QUIPS.length)] };
      }
      grp.add(g.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }), false, true));
    },
    /** Goods are drawn by the shared pool, so this runs inside its frame. */
    drawGoods: function (t) {
      if (!home.at()) return;
      home.gallery.forEach(function (q, i) {
        TR.goods.put('plinth', q.x, 0, q.z, 0, 1);
        TR.goods.put(q.kind, q.x, 0.98 + Math.sin(t * 1.4 + i) * 0.05, q.z, t * 0.35 + i, 1.15);
      });
    },
    /** What the E key does in here. True if it took the frame. */
    actions: function (input, pos) {
      if (!home.at()) return false;
      function near(q, r) { return Math.hypot(q.x - pos.x, q.z - pos.z) < r; }
      if (near(home.board, 3)) {
        TR.hud.prompt('Home and cars', 'Press E: upgrades, paint, wheels, horns');
        if (input.hit('KeyE')) { TR.own.open('home'); return true; }
        return false;
      }
      for (var i = 0; i < home.cars.length; i++) {
        var c = home.cars[i];
        if (near(c, 5.2)) {
          var sp = TR.vehicles.SPECS[c.kind];
          TR.hud.prompt(sp.name, 'Press E: drive it');
          if (input.hit('KeyE')) {
            TR.interiors.exit(TR.player);
            var err = TR.vehicles.summon(c.kind);
            if (err) TR.hud.toast(err, 'bad');
            return true;
          }
          return false;
        }
      }
      if (home.butler && near(home.butler, 3)) { TR.hud.prompt('Your butler', home.butler.q); return false; }
      for (i = 0; i < home.gallery.length; i++) if (near(home.gallery[i], 2.6)) { TR.hud.prompt(home.gallery[i].item.name, 'Yours. Worth ' + TR.fmt(home.gallery[i].item.price)); return false; }
      return false;
    },
    /** Pictures for the shop: the real thing, small. */
    icon: function (id) {
      var W = TR.wardrobe;
      if (id === 'statue') { var st = person(0xdedad0, 0x2a1d16, 0xdcae8a, TR.app.session.view.me.style, 0, 0, 0, Math.PI, 1); return W.snap(st, 0, 1.5, 0, 6); }
      if (id === 'butler') { var bu = person(0x15161d, 0x8d8d8d, 0xe2b48c, { top: 'top_suit', legs: 'legs_black', shoes: 'shoes_black' }, 0, 0, 0, Math.PI, 1); return W.snap(bu, 0, 1.5, 0, 6); }
      var g = new TR.Geo();
      (PIECES[id] || PIECES.goldhouse)(g, 0, 0);
      return W.snapFit(g.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }), false, false));
    },
    /** A picture of a part: the sports car, wearing it. */
    partIcon: function (id) {
      var keep = TR.models.mods, x = H.BY[id], m = {};
      if (x.slot === 'paint') m.paint = x.look.color;
      if (x.slot === 'rim') m.rim = x.look.color;
      if (x.slot === 'neon') m.neon = x.look.color;
      if (x.slot === 'wing') m.wing = 1;
      TR.models.mods = m;
      var mesh = TR.vehicles.SPECS.sports_car.build().mesh(new THREE.MeshLambertMaterial({ vertexColors: true }), false, false);
      TR.models.mods = keep;
      return TR.wardrobe.snapFit(mesh);
    }
  };
  home.outside = {};
})();
