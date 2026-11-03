/* Purchase pads: rings on the floor, floating labels near the player, walk-over and hold-E buying. */
(function () {
  var TR = window.TR = window.TR || {};
  var MAX = 260, HOLD_S = 0.45, REACH_SMALL = 3, REACH_BIG = 3.8, LABELS = 8, BIG_AT = window.TRD.rules.B;
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
        var s = run.sites[k], def = s.b;
        if (!def || !def.wholeStore || !s.items.length) return;
        var x = s.room.ox, y = 0, z = s.room.oz + s.room.d / 2 - 11;
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
    useText: useText,
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
        if (e) e.rank = k;
        if (e && e.d2 < 900 && e.d2 > 22 && e.st !== 'sold' && e.st !== 'rubble') lab.show(e, sess);   // right beside it, the prompt says the same thing
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
        var outdoorDeal = it.building;
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
      var q = sess.quote(it.id), serious = it.building || it.income || it.reward || it.power || it.grants;
      // run through a shop and things are yours. Only businesses and deals that change the game wait for E, so you can read them first.
      if (!big2 || !serious) {
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
      TR.hud.prompt(it.name, 'Hold E: ' + TR.fmt(q.total) + (q.mult > 1 ? ' (Combo x' + q.mult + ')' : ''), pads.hold / HOLD_S, !q.ok, dealText(it));
    },
    demolishHold: function (dt, sess, it) {
      if (TR.input.down('KeyX')) {
        pads.demoHold = (pads.demoHold || 0) + dt;
        if (pads.demoHold >= 1) { pads.demoHold = 0; TR.app.tryDemolish(it.id); return 0; }
      } else pads.demoHold = 0;
      return (pads.demoHold || 0);
    }
  };

  /** What a purchase will do to your income and what comes with it, for the label and prompt. */
  var POWERS = { instantClose: 'Your big deals close instantly', phoneMap: 'Your map marks clues you pass, and your phone gets tips', broker: 'Opens the broker\'s secret deals', lobby: 'Opens deals only lobbyists can buy', diplomat: 'Opens doors with a Diplomatic Pass', observatory: 'Your map shows hidden doors and crates', fastTravel: 'Fly between districts from the map', editions: 'Newspapers bring you tips on hidden deals' };
  /** What you can actually do with something, or null if it is only for show. */
  function useText(it) {
    var v = TR.vehicles, r = it.reward || {}, out = [];
    (r.vehicles || []).forEach(function (k) { if (v.SPECS[k]) out.push('Ride the ' + v.SPECS[k].name + ' (Q to call)'); });
    (r.gear || []).forEach(function (k) { if (v.GEAR[k]) out.push('Use the ' + v.GEAR[k].name + ' (Q)'); });
    if (it.power && POWERS[it.power]) out.push(POWERS[it.power]);
    if (it.wearable) out.push('You wear it');
    if (it.hint) out.push('Gives you a clue');
    if (it.income > 0) out.push('Earns +' + TR.fmt(it.income) + '/s');
    else if (it.income < 0) out.push('Loses ' + TR.fmt(-it.income) + '/s');
    if (out.length) return out.join(' · ');
    var g = window.TRD.uses.GROUP[it.id];
    return g ? window.TRD.uses.VERBS[g] : null;
  }
  function dealText(it) {
    var u = useText(it);
    if (u) return u;
    var v = TR.vehicles, out = [];
    if (it.income > 0) out.push('Earns +' + TR.fmt(it.income) + '/s');
    else if (it.income < 0) out.push('Loses ' + TR.fmt(-it.income) + '/s');
    else if (it.building) out.push('No income');
    if (it.reward) (it.reward.vehicles || []).concat(it.reward.gear || []).forEach(function (k) { var n = v.SPECS[k] || v.GEAR[k]; if (n) out.push('Comes with ' + n.name); });
    return out.join(' · ');
  }
  TR.pads.dealText = dealText;
  function stateColor(st, item) {
    if (st === 'open') return item.kind === 'change' ? 0x45c6ff : item.kind === 'store' ? 0xff5ad1 : item.price >= BIG_AT ? 0xffb820 : 0x2fe877;
    if (st === 'locked') return 0xa55bff;
    if (st === 'owned') return 0xffe08a;
    return 0x4a4a52;
  }

  function wrapLines(g, text, maxW) {
    var words = text.split(' '), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    lines.push(cur);
    return lines;
  }
  var FONT = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  function makeLabel(scene) {
    var W = 640, H = 300, c = document.createElement('canvas'); c.width = W; c.height = H;
    var tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true, fog: false, toneMapped: false }));
    s.visible = false;
    scene.add(s);
    var key = '';
    return {
      sprite: s,
      show: function (e, sess) {
        var it = e.pad.item, q = e.st === 'open' ? (e.pad.store ? { total: TR.pads.storeSum(e.pad.store, sess), mult: 1 } : sess.quote(it.id)) : null;
        var price = e.st === 'open' ? TR.fmt(q.total) + (q.mult > 1 ? ' x' + q.mult : '') : e.st === 'locked' ? 'LOCKED' : e.st === 'owned' ? 'YOURS' : 'SOLD';
        var close = e.d2 < 324 && e.rank < 3, deal = close && e.st === 'open' && it.kind !== 'store' ? (TR.pads.dealText(it).split(' · ')[0] || 'Just for show') : '';
        var cp = TR.app.camera.position, sw = Math.max(4.2, Math.min(9, Math.hypot(cp.x - e.pad.x, cp.y - e.pad.y, cp.z - e.pad.z) * 0.34));   // the same size on screen, near or far
        s.visible = true;
        s.scale.set(sw, sw * H / W, 1);
        s.position.set(e.pad.x, e.pad.y + (it.building ? 6.2 : 3.4) + sw * H / W * 0.2, e.pad.z);
        var kk = it.id + price + close + deal;
        if (kk === key) return;
        key = kk;
        var g = c.getContext('2d');
        g.clearRect(0, 0, W, H);
        g.font = '700 42px ' + FONT;
        var lines = close ? wrapLines(g, it.name, W - 56).slice(0, 2) : [];
        var bh = 104 + lines.length * 50 + (deal ? 54 : 0) + 8, top = H - bh - 2;
        g.fillStyle = 'rgba(10,12,30,.96)'; roundRect(g, 4, top, W - 8, bh, 30); g.fill();
        g.strokeStyle = e.st === 'open' ? '#ffd24a' : e.st === 'locked' ? '#c78bff' : '#8a8f9c'; g.lineWidth = 6; roundRect(g, 7, top + 3, W - 14, bh - 6, 28); g.stroke();
        g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.fillStyle = e.st === 'open' ? '#ffd24a' : e.st === 'locked' ? '#dcbcff' : '#d4d8e2';
        g.font = '800 80px ' + FONT;
        g.fillText(price, W / 2, top + 84);
        g.fillStyle = '#ffffff'; g.font = '700 42px ' + FONT;
        lines.forEach(function (l, i) { g.fillText(l, W / 2, top + 134 + i * 50); });
        if (deal) { g.fillStyle = it.income > 0 ? '#6dffa0' : it.income < 0 ? '#ff9a9a' : '#d4d8e2'; g.font = '800 42px ' + FONT; g.fillText(deal, W / 2, top + 134 + lines.length * 50 + 2); }
        tex.needsUpdate = true;
      }
    };
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
})();
