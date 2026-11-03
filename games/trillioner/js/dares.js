/* Dares and golden receipts: something to chase while you burn money. Rewards are Clout, so they never touch the balance rules. */
(function () {
  var TR = window.TR = window.TR || {};
  var D = window.TRD.districts, Rng = window.TrillionerRng.Rng;

  // Each dare watches one counter. `in` means the count must happen inside that many seconds.
  var DARES = [
    { id: 'spree3', text: 'Buy 3 things in 10 seconds', c: 'buys', need: 3, in: 10, clout: 5 },
    { id: 'spree6', text: 'Buy 6 things in 20 seconds', c: 'buys', need: 6, in: 20, clout: 10 },
    { id: 'smash5', text: 'Smash 5 things with a vehicle', c: 'smash', need: 5, clout: 5 },
    { id: 'smash25', text: 'Smash 25 things', c: 'smash', need: 25, clout: 15 },
    { id: 'wreck3', text: 'Send 3 cars flying', c: 'wreck', need: 3, clout: 10 },
    { id: 'drift', text: 'Drift for 4 seconds', c: 'drift', need: 4, clout: 5 },
    { id: 'air', text: 'Fall from 20 metres and live', c: 'fall', need: 20, clout: 5 },
    { id: 'grind', text: 'Grind rails for 3 seconds', c: 'grind', need: 3, clout: 10 },
    { id: 'receipt3', text: 'Find 3 golden receipts', c: 'receipts', need: 3, clout: 5 },
    { id: 'receipt10', text: 'Find 10 golden receipts', c: 'receipts', need: 10, clout: 20 },
    { id: 'secret1', text: 'Find a secret', c: 'secrets', need: 1, clout: 5 },
    { id: 'secret5', text: 'Find 5 secrets', c: 'secrets', need: 5, clout: 15 },
    { id: 'frenzy3', text: 'Reach Combo x3', c: 'frenzy', need: 3, clout: 5 },
    { id: 'frenzy5', text: 'Reach Combo x5', c: 'frenzy', need: 5, clout: 15 },
    { id: 'building2', text: 'Own 2 buildings', c: 'buildings', need: 2, clout: 5 },
    { id: 'building6', text: 'Own 6 buildings', c: 'buildings', need: 6, clout: 15 },
    { id: 'boom', text: 'Blow up something you own', c: 'demolish', need: 1, clout: 10 },
    { id: 'districts3', text: 'Visit 3 districts', c: 'districts', need: 3, clout: 5 },
    { id: 'districts7', text: 'Visit 7 districts', c: 'districts', need: 7, clout: 15 },
    { id: 'roof', text: 'Stand on a rooftop', c: 'roof', need: 1, clout: 5 },
    { id: 'whole', text: 'Buy a whole store', c: 'stores', need: 1, clout: 10 }
  ];
  var ACTIVE = 3;

  var dares = TR.dares = {
    list: [], queue: [], c: {}, times: {}, clout: 0, el: null, receipts: [], on: false,
    start: function (sess, seed) {
      var rng = new Rng('dares:' + seed);
      dares.on = !sess.online;
      dares.c = { buys: 0, smash: 0, wreck: 0, drift: 0, fall: 0, grind: 0, receipts: 0, secrets: 0, frenzy: 0, buildings: 0, demolish: 0, districts: 0, roof: 0, stores: 0 };
      dares.times = {}; dares.clout = 0; dares.done = 0;
      // the easy ones come first, so the first minute teaches the verbs
      var easy = ['spree3', 'smash5', 'receipt3'], rest = rng.shuffle(DARES.filter(function (d) { return easy.indexOf(d.id) < 0; }));
      dares.queue = easy.map(function (id) { return DARES.filter(function (d) { return d.id === id; })[0]; }).concat(rest);
      dares.list = dares.queue.splice(0, ACTIVE).map(function (d) { return { d: d, got: 0, flash: 0 }; });
      if (dares.el) dares.el.remove();
      dares.el = null;
      if (dares.on) {
        dares.el = document.createElement('div'); dares.el.className = 'dares';
        TR.hud.root.appendChild(dares.el);
      }
      dares.buildReceipts();
      dares.draw();
    },
    stop: function () { if (dares.el) dares.el.remove(); dares.el = null; dares.on = false; dares.receipts = []; },
    /** Fixed hiding places: rooftops, the far ends of things, behind buildings. */
    buildReceipts: function () {
      var spots = [
        [-60, 31.2, 40], [166, 19.2, -66], [-200, 15, 60], [-300, 9.2, 176], [168, 15.2, 170], [180, 15.2, -178], [-62, 17.2, -170], [60, 148.2, -56],
        [214, 1.2, 345], [-312, 28, -316], [-130, 1, 318], [22, 25.2, -196], [-265, 29.5, 219], [272, 1, 256], [330, 3.2, -250], [160, 12, -130],
        [300, 12, 0], [-130, 12, 0], [60, 12, 130], [-104, 79, -104], [104, 79, 104], [36, 74, -258], [240, 19, 26],
        [-330, 1, 340], [340, 1, -340], [-340, 1, -30], [110, 1, 350], [-90, 1, -350], [118, 1, 60], [-118, 1, -60], [300, 1, -112], [-20, 1, 116], [-200, 1, 112], [100, 1, -340], [-340, 1, 200], [28, 1, 352],
        [170, -59, -40], [-160, -59, -160], [200, -59, 200], [-200, -59, 160], [0, -91, -200], [260, -59, -200]
      ];
      dares.receipts = spots.map(function (s) { return { x: s[0], y: s[1], z: s[2], got: false }; });
    },
    bump: function (key, n) { if (!dares.on) return; dares.c[key] = (dares.c[key] || 0) + (n == null ? 1 : n); dares.times[key] = dares.times[key] || []; if (n == null) dares.times[key].push(TR.app.t); dares.check(); },
    setMax: function (key, v) { if (!dares.on) return; if (v > (dares.c[key] || 0)) { dares.c[key] = v; dares.check(); } },
    amount: function (d) {
      if (d.in) { var t = TR.app.t; return (dares.times[d.c] || []).filter(function (x) { return t - x <= d.in; }).length; }
      return dares.c[d.c] || 0;
    },
    check: function () {
      var changed = false;
      dares.list.forEach(function (e, i) {
        var got = dares.amount(e.d);
        if (got !== e.got) { e.got = got; changed = true; }
        if (got >= e.d.need && !e.won) {
          e.won = true; changed = true;
          dares.clout += e.d.clout; dares.done++;
          TR.hud.bigText('DARE DONE!', '+' + e.d.clout + ' Clout');
          TR.audio.buy(2, 4); TR.audio.cheer(0.8); TR.crowds.cheer(2);
          TR.fx.confetti(TR.player.pos, 80, 12);
          setTimeout(function () {
            var idx = dares.list.indexOf(e), nx = dares.queue.shift();
            if (idx >= 0) { if (nx) dares.list[idx] = { d: nx, got: 0 }; else dares.list.splice(idx, 1); dares.draw(); }
          }, 1400);
        }
      });
      if (changed) dares.draw();
    },
    draw: function () {
      if (!dares.el) return;
      var html = '<b>DARES</b>';
      dares.list.forEach(function (e) {
        var got = Math.min(e.d.need, Math.floor(e.got)), pct = Math.min(100, e.got / e.d.need * 100);
        html += '<div class="dare' + (e.won ? ' won' : '') + '"><span>' + e.d.text + '</span><i style="width:' + pct + '%"></i></div>';
      });
      if (dares.el.dataset.h !== html) { dares.el.dataset.h = html; dares.el.innerHTML = html; }
    },
    update: function (dt, pos, t, sess) {
      if (!dares.on) return;
      var v = TR.vehicles.current, me = sess.view.me;
      // receipts
      for (var i = 0; i < dares.receipts.length; i++) {
        var r = dares.receipts[i];
        if (r.got) continue;
        var dx = r.x - pos.x, dy = r.y - pos.y, dz = r.z - pos.z, d2 = dx * dx + dz * dz;
        if (d2 < 22000 && Math.abs(dy) < 70) TR.goods.put('receipt', r.x, r.y + 0.6 + Math.sin(t * 2.4 + i) * 0.2, r.z, t * 3 + i, 1.3, Math.PI / 2);
        if (d2 < 7 && Math.abs(dy) < 3.4) {
          r.got = true;
          dares.clout += 1;
          dares.bump('receipts', 1);
          TR.hud.bigText('GOLDEN RECEIPT', dares.c.receipts + ' found, +1 Clout');
          TR.audio.buy(1, 5);
          TR.fx.coins({ x: r.x, y: r.y, z: r.z }, 30, 8);
        }
      }
      // moves
      if (v && v.spec.drift && v.slip > 7) dares.bump('drift', dt);
      if (v && TR.vehicles.grindNow) dares.bump('grind', dt);
      dares.setMax('frenzy', me.frenzy);
      dares.setMax('districts', Object.keys(me.visited).length);
      var bl = 0; for (var k in me.owned) if (sess.run.items[k].building && !me.owned[k].closing && !me.owned[k].demolished) bl++;
      dares.setMax('buildings', bl);
      if (!TR.interiors.current && !v && TR.player.grounded && pos.y > 6 && pos.y < 200) dares.setMax('roof', 1);
      // fall height
      if (!v) {
        if (!TR.player.grounded) { dares.top = Math.max(dares.top == null ? pos.y : dares.top, pos.y); }
        else { if (dares.top != null && dares.top - pos.y > 0) dares.setMax('fall', dares.top - pos.y); dares.top = null; }
      } else dares.top = null;
      if (Math.floor(t * 2) !== dares.tick) { dares.tick = Math.floor(t * 2); dares.check(); }
    }
  };
})();
