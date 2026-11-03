/* Purchase pads: rings on the floor, floating labels near the player, walk-over and hold-E buying. */
(function () {
  var TR = window.TR = window.TR || {};
  var MAX = 260, HOLD_S = 0.55, REACH_SMALL = 1.9, REACH_BIG = 3.4, LABELS = 14, BIG_AT = window.TRD.rules.B;
  var dummy = new THREE.Object3D(), col = new THREE.Color();

  var pads = TR.pads = {
    list: [], rings: null, tops: null, labels: [], hold: 0, holding: null, stepOff: {}, cool: 0, scanT: 0, active: [],
    init: function (scene) {
      pads.rings = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.5, 1.7, 0.18, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
      pads.tops = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.55), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x444444 }), MAX);
      pads.rings.frustumCulled = pads.tops.frustumCulled = false;
      pads.rings.setColorAt(0, col.setHex(0xffffff)); pads.tops.setColorAt(0, col.setHex(0xffffff));
      scene.add(pads.rings, pads.tops);
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
        if (e && e.d2 < 3600) lab.show(e, sess);
        else lab.sprite.visible = false;
      }
    },
    draw: function (t) {
      var n = pads.active.length;
      for (var i = 0; i < n; i++) {
        var e = pads.active[i], p = e.pad, big = p.item.price >= BIG_AT, s = big ? 1.5 : 0.95;
        if (p.item.kind === 'change') s = 0.62;
        dummy.position.set(p.x, p.y + 0.1, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(s, 1, s); dummy.updateMatrix();
        pads.rings.setMatrixAt(i, dummy.matrix);
        pads.rings.setColorAt(i, col.setHex(stateColor(e.st, p.item)));
        var live = e.st === 'open';
        dummy.position.y = p.y + (live ? 1.5 + Math.sin(t * 2.2 + i) * 0.16 : 0.5);
        dummy.rotation.y = t * 1.4 + i;
        var ts = live ? (big ? 1.2 : 0.8) : 0.4; if (p.item.kind === 'change') ts *= 0.6;
        dummy.scale.set(ts, ts, ts); dummy.updateMatrix();
        pads.tops.setMatrixAt(i, dummy.matrix);
        pads.tops.setColorAt(i, col.setHex(stateColor(e.st, p.item)));
      }
      pads.rings.count = pads.tops.count = n;
      pads.rings.instanceMatrix.needsUpdate = pads.tops.instanceMatrix.needsUpdate = true;
      if (pads.rings.instanceColor) pads.rings.instanceColor.needsUpdate = true;
      if (pads.tops.instanceColor) pads.tops.instanceColor.needsUpdate = true;
    },
    interact: function (dt, sess, pos) {
      pads.cool = Math.max(0, pads.cool - dt);
      var near = null, input = TR.input;
      for (var i = 0; i < pads.active.length && i < 24; i++) {
        var e = pads.active[i], big = e.pad.item.price >= BIG_AT, reach = big ? REACH_BIG : REACH_SMALL;
        if (e.d2 < reach * reach && Math.abs(e.pad.y - pos.y) < 4) { near = e; break; }
      }
      // pads you are no longer standing on can trigger again
      for (var id in pads.stepOff) if (!near || near.pad.item.id !== id) delete pads.stepOff[id];
      if (!near) { pads.hold = 0; pads.holding = null; TR.hud.prompt(null); return; }
      var it = near.pad.item, big2 = it.price >= BIG_AT;
      var bal = sess.view.me.balance;
      if (near.st === 'locked') { var g = sess.gateFails(it.gate); TR.hud.prompt(it.name, (g && g.why) || 'Locked'); return; }
      if (near.st === 'sold') { TR.hud.prompt(it.name, 'Sold out'); return; }
      if (near.st === 'rubble') { TR.hud.prompt(it.name, 'Rubble lot'); return; }
      if (near.st === 'owned') {
        if (!it.building) { TR.hud.prompt(it.name, 'Yours'); return; }
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
        TR.hud.prompt(it.name, TR.fmt(q.total) + (q.mult > 1 ? ' (Frenzy x' + q.mult + ')' : ''));
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
    if (st === 'open') return item.kind === 'change' ? 0x7dd8ff : item.price >= BIG_AT ? 0xffc53d : 0x5dff8f;
    if (st === 'locked') return 0xb36bff;
    if (st === 'owned') return 0xffe9a0;
    return 0x333338;
  }

  function makeLabel(scene) {
    var c = document.createElement('canvas'); c.width = 384; c.height = 128;
    var tex = new THREE.CanvasTexture(c);
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true, fog: false }));
    s.visible = false; s.scale.set(5.4, 1.8, 1);
    scene.add(s);
    var key = '';
    return {
      sprite: s,
      show: function (e, sess) {
        var it = e.pad.item, q = e.st === 'open' ? (e.pad.store ? { total: TR.pads.storeSum(e.pad.store, sess), mult: 1 } : sess.quote(it.id)) : null;
        var price = e.st === 'open' ? TR.fmt(q.total) + (q.mult > 1 ? ' x' + q.mult : '') : e.st === 'locked' ? 'LOCKED' : e.st === 'sold' ? 'SOLD' : e.st === 'owned' ? 'OWNED' : 'RUBBLE';
        var k = it.id + price;
        s.visible = true;
        s.position.set(e.pad.x, e.pad.y + 4, e.pad.z);
        if (k === key) return;
        key = k;
        var g = c.getContext('2d');
        g.clearRect(0, 0, 384, 128);
        g.fillStyle = 'rgba(16,18,40,.82)'; roundRect(g, 4, 6, 376, 116, 22); g.fill();
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
