/* Purchase pads: rings on the floor, floating labels near the player, walk-over and hold-E buying. */
(function () {
  var TR = window.TR = window.TR || {};
  var MAX = 260, HOLD_S = 0.45, REACH_SMALL = 2.2, REACH_BIG = 3.8, LABELS = 9, BIG_AT = window.TRD.rules.B;
  var dummy = new THREE.Object3D(), col = new THREE.Color();

  var pads = TR.pads = {
    list: [], rings: null, tops: null, labels: [], hold: 0, holding: null, stepOff: {}, cool: 0, scanT: 0, active: [],
    init: function (scene) {
      // a soft glow on the floor, so goods read from afar without a column of light
      var cv = document.createElement('canvas'); cv.width = cv.height = 64;
      var gx = cv.getContext('2d'), gr = gx.createRadialGradient(32, 32, 4, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(0.7, 'rgba(255,255,255,.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      gx.fillStyle = gr; gx.fillRect(0, 0, 64, 64);
      var disc = new THREE.PlaneGeometry(1, 1); disc.rotateX(-Math.PI / 2);
      pads.rings = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), MAX);
      pads.rings.frustumCulled = false;
      pads.rings.setColorAt(0, col.setHex(0xffffff));
      scene.add(pads.rings);
      for (var i = 0; i < LABELS; i++) pads.labels.push(makeLabel(scene));
    },
    /** Called once per run with the run's items. */
    setRun: function (run) {
      pads.list = run.list.map(function (it) { var p = run.padPos[it.id]; return { item: it, x: p.x, y: p.y, z: p.z }; });
      // "Buy the whole store" pads: one purchase for everything left and unlocked there
      Object.keys(run.sites).forEach(function (k) {
        var s = run.sites[k], def = s.b || s.s;
        if (!def || !def.wholeStore || !s.items.length) return;
        var x, y, z;
        if (s.room) { x = s.room.ox; y = 0; z = s.room.oz + s.room.d / 2 - 11; }
        else { x = def.x; y = s.y; z = def.z + 7.5; }
        pads.list.push({ x: x, y: y, z: z, store: k, item: { id: 'store:' + k, name: 'Buy the Whole Store', price: 1e12, kind: 'store', gate: null, secret: null, site: k } });
      });
      pads.scanT = 0;
    },
    /** Total for a whole-store pad, from what is left and unlocked. */
    storeSum: function (site, sess) {
      var sum = 0, s = sess.run.sites[site];
      s.items.forEach(function (id) {
        var it = sess.run.items[id], n = sess.stock(id);
        if (it.kind !== 'good' || n <= 0 || (it.secret && !sess.view.me.flags[it.secret]) || sess.gateFails(it.gate)) return;
        sum += it.price * n;
      });
      return sum;
    },
    state: function (pad, sess) { // 'open' | 'sold' | 'locked' | 'hidden' | 'owned'
      var it = pad.item, me = sess.view.me;
      if (pad.store) return pads.storeSum(pad.store, sess) > 0 ? 'open' : 'sold';
      if (it.secret && !me.flags[it.secret]) return 'hidden';
      if (it.surprise && sess.stock(it.id) <= 0) return 'hidden';
      var o = me.owned[it.id];
      if (o && !o.demolished) return 'owned';
      if (o && o.demolished) return 'rubble';
      if (sess.stock(it.id) <= 0) return 'sold';
      if (sess.gateFails(it.gate)) return 'locked';
      return 'open';
    },
    update: function (dt, sess, pos, t) {
      pads.scanT -= dt;
      if (pads.scanT <= 0) { pads.scanT = 0.2; pads.scan(sess, pos); }
      pads.draw(t);
      pads.interact(dt, sess, pos);
    },
    scan: function (sess, pos) {
      var out = [], px = pos.x, pz = pos.z, py = pos.y;
      for (var i = 0; i < pads.list.length; i++) {
        var p = pads.list[i], dx = p.x - px, dz = p.z - pz, d2 = dx * dx + dz * dz;
        if (d2 > 24000 || Math.abs(p.y - py) > 40) continue;
        var st = pads.state(p, sess);
        if (st === 'hidden') continue;
        out.push({ pad: p, d2: d2, st: st });
      }
      out.sort(function (a, b) { return a.d2 - b.d2; });
      pads.active = out.slice(0, MAX);
      // floating labels on the nearest pads
      for (var k = 0; k < LABELS; k++) {
        var lab = pads.labels[k], e = pads.active[k];
        if (e && e.d2 < 900 && e.st !== 'sold' && e.st !== 'rubble') lab.show(e, sess);
        else lab.sprite.visible = false;
      }
    },
    draw: function (t) {
      var n = 0, G = TR.goods, shown = 0;
      for (var i = 0; i < pads.active.length; i++) {
        var e = pads.active[i], p = e.pad, it = p.item, big = it.price >= BIG_AT, live = e.st === 'open';
        if (e.d2 > 12100) break;            // past 110 units the shop is just a shop
        if (!p.kind) p.kind = G.kindFor(it);
        var size = Math.min(1.5, 0.82 + Math.max(0, Math.log10(Math.max(1, it.price / 1e9))) * 0.2) * (p.store ? 1.4 : 1);
        var outdoorDeal = it.outside && it.building;
        if (outdoorDeal) {
          if (live) G.put('forsale', p.x, p.y, p.z, 0, 1.05);
          else if (e.st === 'locked') G.put('lock', p.x, p.y + 0.6, p.z, t * 0.8, 1.5);
          else if (e.st === 'owned') G.put('soldsign', p.x, p.y, p.z, 0, 1);
        } else if (it.kind === 'change') {
          if (live) G.put('gumball', p.x, p.y, p.z, 0, 0.9);
        } else if (live) {
          G.put('plinth', p.x, p.y, p.z, 0, 1);
          G.put(p.kind, p.x, p.y + 0.98 + Math.sin(t * 2 + i) * 0.07, p.z, t * 0.9 + i, size);
        } else if (e.st === 'locked') {
          G.put('plinthDark', p.x, p.y, p.z, 0, 1);
          G.put('lock', p.x, p.y + 1, p.z, t * 0.5 + i, 0.9);
        } else {
          G.put('plinthDark', p.x, p.y, p.z, 0, 0.8);
        }
        if (live && n < MAX) {
          dummy.position.set(p.x, p.y + 0.06, p.z); dummy.rotation.set(0, 0, 0);
          var gs = (outdoorDeal ? 8 : 4.6) * (0.92 + Math.sin(t * 3 + i) * 0.08); dummy.scale.set(gs, 1, gs); dummy.updateMatrix();
          pads.rings.setMatrixAt(n, dummy.matrix);
          pads.rings.setColorAt(n, col.setHex(stateColor(e.st, it)));
          n++;
        }
      }
      pads.rings.count = n;
      pads.rings.instanceMatrix.needsUpdate = true;
      if (pads.rings.instanceColor) pads.rings.instanceColor.needsUpdate = true;
    },
    interact: function (dt, sess, pos) {
      pads.cool = Math.max(0, pads.cool - dt);
      var near = null, input = TR.input;
      for (var i = 0; i < pads.active.length && i < 24; i++) {
        var e = pads.active[i], big = e.pad.item.price >= BIG_AT, reach = (big ? REACH_BIG : REACH_SMALL) + (TR.vehicles.current ? 2.2 : 0);
        if (e.d2 < reach * reach && Math.abs(e.pad.y - pos.y) < 4) { near = e; break; }
      }
      // pads you are no longer standing on can trigger again
      for (var id in pads.stepOff) if (!near || near.pad.item.id !== id) delete pads.stepOff[id];
      if (!near) { pads.hold = 0; pads.holding = null; return; }
      var it = near.pad.item, big2 = it.price >= BIG_AT;
      var bal = sess.view.me.balance;
      if (near.st === 'locked') { var g = sess.gateFails(it.gate); TR.hud.prompt(it.name, (g && g.why) || 'Locked'); return; }
      if (near.st === 'sold') return;
      if (near.st === 'rubble') { TR.hud.prompt(it.name, 'Rubble lot'); return; }
      if (near.st === 'owned') {
        if (!it.building) return;
        if (sess.view.me.owned[it.id].closing) { TR.hud.prompt(it.name, 'Deal closing...'); return; }
        var fee = Math.round(sess.view.me.owned[it.id].paid * 0.4);
        TR.hud.prompt(it.name, 'Hold X: demolish for ' + TR.fmt(fee), pads.demolishHold(dt, sess, it));
        return;
      }
      if (near.pad.store) {
        var sum = pads.storeSum(near.pad.store, sess), qs = TrillionerEngine.quote(sum, sess.view.me.frenzy, bal);
        if (input.down('KeyE')) {
          if (pads.holding !== it.id) { pads.holding = it.id; pads.hold = 0; }
          pads.hold += dt;
          if (pads.hold >= HOLD_S) { pads.hold = 0; pads.holding = null; TR.app.tryStore(near.pad.store); return; }
        } else { pads.hold = 0; pads.holding = null; }
        TR.hud.prompt(it.name, 'Hold E: ' + TR.fmt(qs.total), pads.hold / HOLD_S, !qs.ok);
        return;
      }
      var q = sess.quote(it.id);
      if (!big2) {
        if (!pads.stepOff[it.id] && pads.cool <= 0) {
          pads.cool = 0.14;
          var left = sess.stock(it.id);
          if (left <= 1) pads.stepOff[it.id] = true;
          TR.app.tryBuy(it.id);
        }
        return;
      }
      if (input.down('KeyE')) {
        if (pads.holding !== it.id) { pads.holding = it.id; pads.hold = 0; }
        pads.hold += dt;
        if (pads.hold >= HOLD_S) { pads.hold = 0; pads.holding = null; TR.app.tryBuy(it.id); return; }
      } else { pads.hold = 0; pads.holding = null; }
      TR.hud.prompt(it.name, 'Hold E: ' + TR.fmt(q.total) + (q.mult > 1 ? ' (Frenzy x' + q.mult + ')' : ''), pads.hold / HOLD_S, !q.ok);
    },
    demolishHold: function (dt, sess, it) {
      if (TR.input.down('KeyX')) {
        pads.demoHold = (pads.demoHold || 0) + dt;
        if (pads.demoHold >= 1) { pads.demoHold = 0; TR.app.tryDemolish(it.id); return 0; }
      } else pads.demoHold = 0;
      return (pads.demoHold || 0);
    }
  };

  function stateColor(st, item) {
    if (st === 'open') return item.kind === 'change' ? 0x45c6ff : item.kind === 'store' ? 0xff5ad1 : item.price >= BIG_AT ? 0xffb820 : 0x2fe877;
    if (st === 'locked') return 0xa55bff;
    if (st === 'owned') return 0xffe08a;
    return 0x4a4a52;
  }

  function makeLabel(scene) {
    var c = document.createElement('canvas'); c.width = 384; c.height = 128;
    var tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true, fog: false }));
    s.visible = false; s.scale.set(3.6, 1.2, 1);
    scene.add(s);
    var key = '';
    return {
      sprite: s,
      show: function (e, sess) {
        var it = e.pad.item, q = e.st === 'open' ? (e.pad.store ? { total: TR.pads.storeSum(e.pad.store, sess), mult: 1 } : sess.quote(it.id)) : null;
        var price = e.st === 'open' ? TR.fmt(q.total) + (q.mult > 1 ? ' x' + q.mult : '') : e.st === 'locked' ? 'LOCKED' : e.st === 'sold' ? 'SOLD' : e.st === 'owned' ? 'OWNED' : 'RUBBLE';
        var k = it.id + price;
        s.visible = true;
        s.position.set(e.pad.x, e.pad.y + (e.pad.item.outside && e.pad.item.building ? 7 : 3.4), e.pad.z);
        if (k === key) return;
        key = k;
        var g = c.getContext('2d');
        g.clearRect(0, 0, 384, 128);
        g.fillStyle = 'rgba(18,20,44,.9)'; roundRect(g, 4, 6, 376, 116, 26); g.fill();
        g.strokeStyle = e.st === 'open' ? 'rgba(255,197,61,.9)' : 'rgba(255,255,255,.25)'; g.lineWidth = 4; roundRect(g, 6, 8, 372, 112, 24); g.stroke();
        g.textAlign = 'center';
        g.fillStyle = e.st === 'open' ? '#ffc53d' : e.st === 'locked' ? '#d7a6ff' : '#aaa';
        g.font = '900 46px Arial Black, Arial, sans-serif';
        g.fillText(price, 192, 58);
        g.fillStyle = '#fff';
        var fs = 26; g.font = '700 ' + fs + 'px Arial, sans-serif';
        while (g.measureText(it.name).width > 356 && fs > 13) { fs--; g.font = '700 ' + fs + 'px Arial, sans-serif'; }
        g.fillText(it.name, 192, 98);
        tex.needsUpdate = true;
      }
    };
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
})();
