/* The bag and the Style Counter: everything you own, what you wear, and mystery boxes. The clock keeps running. */
(function () {
  var TR = window.TR = window.TR || {};
  var X = window.TRD.extras, R = window.TRD.rules;
  var CATS = [['all', 'All'], ['top', 'Tops'], ['legs', 'Trousers'], ['shoes', 'Shoes'], ['hat', 'Hats'], ['hair', 'Hair'], ['glasses', 'Glasses'], ['neck', 'Jewellery'], ['wrist', 'Watches'], ['fx', 'Effects'], ['pet', 'Pets']];
  var RCLASS = { c: 'common', r: 'rare', e: 'epic', l: 'legendary' };

  function el(tag, cls, parent, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function goodsRarity(price) { return price >= 10 * R.B ? 'l' : price >= 1 * R.B ? 'e' : price >= 100 * R.M ? 'r' : 'c'; }

  var U = window.TRD.uses;
  var own = TR.own = {
    el: null, tab: 'shop', cat: 'all', sv: -1,
    isOpen: function () { return !!own.el; },
    atCounter: function () { return !!TR.interiors.current; },
    open: function (tab) {
      if (own.el) return;
      own.tab = tab || 'stuff';
      own.el = el('div', 'own', TR.hud.root);
      own.el.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      TR.input.frozen = true;
      if (document.pointerLockElement) document.exitPointerLock();
      own.camDist = TR.cam.dist; own.camZoom = TR.cam.zoom; TR.cam.dist = 6.5; TR.cam.zoom = 1;
      own.pitch = TR.input.pitch; TR.input.pitch = 0.1;
      TR.hud.root.classList.add('own-open');
      if (innerWidth > 620) TR.app.camera.setViewOffset(innerWidth, innerHeight, own.el.offsetWidth / 2, 0, innerWidth, innerHeight);
      own.draw();
    },
    close: function () {
      if (!own.el) return;
      own.el.remove(); own.el = null;
      TR.hud.root.classList.remove('own-open');
      TR.input.frozen = false;
      TR.cam.dist = own.camDist; TR.cam.zoom = own.camZoom; TR.input.pitch = own.pitch;
      TR.app.camera.clearViewOffset();
      if (own.reveal) { own.reveal.remove(); own.reveal = null; }
    },
    toggle: function (tab) { if (own.el) own.close(); else own.open(tab); },
    /** While the screen is open you turn to face the camera, so you can see what you are wearing. */
    update: function () {
      if (!own.el) return;
      TR.player.heading = TR.input.yaw + Math.PI;
      var me = TR.app.session.view.me;
      if (me.styleV !== own.sv || me.balance !== own.bal) own.draw();
    },
    draw: function () {
      var me = TR.app.session.view.me, s = own.el;
      own.sv = me.styleV; own.bal = me.balance;
      var scroll = s.querySelector('.own-body') ? s.querySelector('.own-body').scrollTop : 0;
      s.innerHTML = '';
      var head = el('div', 'own-head', s);
      [['shop', 'Style Shop'], ['box', 'Mystery Box'], ['stuff', 'My Stuff']].forEach(function (t) {
        var b = el('button', 'own-tab' + (own.tab === t[0] ? ' on' : ''), head, t[1]);
        b.onclick = function () { own.tab = t[0]; own.draw(); };
      });
      el('button', 'own-x', head, '×').onclick = own.close;
      el('div', 'own-bal', s, TR.fmtFull(me.balance) + '<small>left to spend</small>');
      var body = el('div', 'own-body', s);
      if (own.tab === 'shop') own.drawShop(body, me);
      else if (own.tab === 'box') own.drawBox(body, me);
      else own.drawStuff(body, me);
      body.scrollTop = scroll;
      TR.wardrobe.fill(s);
    },
    send: function (cmd, done) {
      TR.app.session.extra(cmd, function (r) {
        if (r && r.error) { TR.hud.toast(r.code === 'broke' ? 'Too expensive' : r.error, 'bad'); TR.audio.denied(); }
        if (done) done(r || {});
        if (own.el) own.draw();
      });
    },
    drawShop: function (body, me) {
      if (!own.atCounter()) el('div', 'own-note', body, 'You can look here, but everything is sold in shops. Walk into any shop and use its Style Counter.');
      var cats = el('div', 'own-cats', body);
      CATS.forEach(function (c) {
        var b = el('button', 'own-cat' + (own.cat === c[0] ? ' on' : ''), cats, c[1]);
        b.onclick = function () { own.cat = c[0]; own.draw(); };
      });
      var grid = el('div', 'own-grid', body);
      X.CATALOG.filter(function (x) { return !x.gift && (own.cat === 'all' || x.slot === own.cat); }).forEach(function (x) { own.card(grid, x, me); });
    },
    worn: function (x, me) { return x.slot === 'pet' ? me.style.pet.indexOf(x.id) >= 0 : me.style[x.slot] === x.id; },
    card: function (grid, x, me) {
      var mine = me.extras[x.id], on = mine && own.worn(x, me), poor = !mine && me.balance < x.price, shut = !mine && !own.atCounter();
      var c = el('button', 'own-card ' + RCLASS[x.rarity] + (on ? ' worn' : '') + (poor || shut ? ' dim' : ''), grid,
        '<img data-thumb="x:' + x.id + '" alt=""><i class="rar">' + X.RARITY[x.rarity] + '</i><b>' + esc(x.name) + '</b><span>' + (mine ? (on ? (x.slot === 'pet' ? 'With you' : 'Wearing') : (x.slot === 'pet' ? 'Bring along' : 'Wear')) : TR.fmt(x.price)) + '</span>');
      c.onclick = function () {
        c.blur();
        if (mine) { own.send({ t: 'wear', slot: x.slot, id: on && x.slot !== 'pet' ? null : x.id }); TR.audio.jump(1); return; }
        if (shut) { TR.hud.toast('Walk into a shop to buy this', 'bad'); TR.audio.denied(); return; }
        own.send({ t: 'extra', id: x.id }, function (r) { if (r.ok) own.bought(x); });
      };
    },
    bought: function (x) {
      var tier = { c: 1, r: 2, e: 3, l: 4 }[x.rarity];
      TR.audio.buy(tier, tier);
      if (x.rarity === 'l') { TR.audio.cheer(0.8); TR.fx.confetti(TR.player.pos, 120, 12); } else TR.fx.coins(TR.player.pos, 14 * tier, 7);
    },
    drawBox: function (body, me) {
      var left = X.BOX_LIMIT - me.boxes;
      var w = el('div', 'own-box', body, '<div class="boxart"><i></i><u>?</u></div><h3>Mystery Box</h3><p>Always something you do not own yet.<br>Legendary 3% · Epic 9% · Rare 28% · Common 60%</p>');
      var b = el('button', 'btn own-open', w, left > 0 ? 'Open for ' + TR.fmt(X.BOX_PRICE) + ' (' + left + ' left today)' : 'Sold out for today');
      b.disabled = left <= 0;
      b.onclick = function () {
        b.blur();
        if (!own.atCounter()) { TR.hud.toast('Boxes are sold in shops. Walk into one.', 'bad'); TR.audio.denied(); return; }
        own.send({ t: 'box' }, function (r) { if (r.ok) own.showReveal(X.BY_ID[r.id]); });
      };
    },
    showReveal: function (x) {
      if (own.reveal) own.reveal.remove();
      var r = own.reveal = el('div', 'own-reveal ' + RCLASS[x.rarity], own.el, '<div class="glow"></div><img data-thumb="x:' + x.id + '" alt=""><i>' + X.RARITY[x.rarity] + '</i><b>' + esc(x.name) + '</b><span>You are wearing it now. Worth ' + TR.fmt(x.price) + '</span>');
      TR.wardrobe.fill(r);
      var tier = { c: 1, r: 2, e: 4, l: 6 }[x.rarity];
      TR.audio.buy(Math.min(4, tier), tier);
      if (tier >= 4) { TR.audio.cheer(tier / 6); TR.fx.confetti(TR.player.pos, 40 * tier, 14); }
      r.onclick = function () { r.remove(); own.reveal = null; };
      setTimeout(function () { if (own.reveal === r) { r.remove(); own.reveal = null; } }, 2600);
    },
    drawStuff: function (body, me) {
      var run = TR.app.session.run, any = false, kinds = Object.keys(me.goods).concat(Object.keys(me.owned)).filter(function (id) { return run.items[id]; });
      if (kinds.length) el('div', 'own-sum', body, '<b>T</b> uses the last thing you bought. Or click anything here to use it.');
      function section(title, n) { el('h4', 'own-h', body, title + ' <small>' + n + '</small>'); return el('div', 'own-grid', body); }
      var mine = X.CATALOG.filter(function (x) { return me.extras[x.id]; });
      if (mine.length) { any = true; var g1 = section('Wardrobe and pets', mine.length); mine.forEach(function (x) { own.card(g1, x, me); }); }
      var rides = Object.keys(me.vehicles).filter(function (k) { return TR.vehicles.SPECS[k]; });
      if (rides.length) {
        any = true;
        var g2 = section('Vehicles', rides.length);
        rides.forEach(function (k) {
          var c = el('button', 'own-card rare', g2, '<img data-thumb="v:' + k + '" alt=""><b>' + esc(TR.vehicles.SPECS[k].name) + '</b><span>Call it</span>');
          c.onclick = function () { own.close(); TR.hud.pick({ kind: 'v', id: k, name: TR.vehicles.SPECS[k].name }); };
        });
      }
      var biz = Object.keys(me.owned).filter(function (id) { var it = run.items[id]; return it && (it.building || it.income) && !me.owned[id].demolished; });
      if (biz.length) {
        any = true;
        var g3 = section('Businesses', biz.length);
        biz.forEach(function (id) {
          var it = run.items[id];
          el('div', 'own-card ' + RCLASS[goodsRarity(it.price)], g3, '<img data-thumb="g:' + TR.goods.kindFor(it) + '" alt=""><b>' + esc(it.name) + '</b><span>' + (it.income ? (it.income > 0 ? '+' : '') + TR.fmt(it.income) + '/s' : 'No income') + '</span>' + own.useLine(it));
        });
      }
      var things = Object.keys(me.goods).filter(function (id) { return run.items[id]; }).sort(function (a, b) { return run.items[b].price - run.items[a].price; });
      if (things.length) {
        any = true;
        var g4 = section('Things you bought', things.length);
        things.slice(0, 80).forEach(function (id) {
          var it = run.items[id], n = own.usable(id) ? own.left(me, id) : me.goods[id], can = own.usable(id), kept = window.TRD.extras.BY_ID['w_' + id];
          if (kept && me.extras[kept.id]) return;   // it is in the wardrobe above
          var card = el(can ? 'button' : 'div', 'own-card ' + RCLASS[goodsRarity(it.price)] + (can && n <= 0 ? ' dim' : ''), g4, '<img data-thumb="g:' + TR.goods.kindFor(it) + '" alt="">' + (n > 1 ? '<em>x' + n + '</em>' : '') + '<i class="rar">' + X.RARITY[goodsRarity(it.price)] + '</i><b>' + esc(it.name) + '</b><span>' + TR.fmt(it.price) + '</span>' + own.useLine(it) + (can ? '<i class="act">' + (n > 0 ? U.ACTION[can] : 'Used up') + '</i>' : ''));
          if (can && n > 0) card.onclick = function () { card.blur(); own.use(id); };
        });
      }
      if (!any) el('div', 'own-note', body, 'Nothing yet. That is a lot of money to still be holding.');
    },

    useLine: function (it) {
      var u = TR.pads.useText(it);
      return u ? '<u class="use">' + esc(u) + '</u>' : '<u class="use none">Just for show</u>';
    },

    // ── using what you bought ──
    placed: [], recent: [],
    left: function (me, id) { return (me.goods[id] || 0) - (me.used[id] || 0); },
    usable: function (id) { var g = U.GROUP[id]; return g && g !== 'wear' && g !== 'pet' ? g : null; },
    /** What T would use right now: the last thing you bought that still has a use in it. */
    quickItem: function (me) {
      for (var i = own.recent.length - 1; i >= 0; i--) if (own.left(me, own.recent[i]) > 0 && own.usable(own.recent[i])) return own.recent[i];
      return null;
    },
    bought: function (id) { own.recent = own.recent.filter(function (x) { return x !== id; }); own.recent.push(id); },
    use: function (id) {
      var sess = TR.app.session, group = own.usable(id), it = sess.run.items[id], pos = TR.player.pos, indoors = !!TR.interiors.current;
      if (group === 'drive' && (indoors || TR.vehicles.current)) { TR.hud.toast(indoors ? 'Take it outside first.' : 'You are already driving.', 'bad'); TR.audio.denied(); return; }
      sess.extra({ t: 'use', item: id }, function (r) {
        if (!r || r.code === 'wait') return;
        if (r.error) { TR.hud.toast(r.error, 'bad'); TR.audio.denied(); return; }
        own.effect(r.group, it, pos);
        if (own.el) own.draw();
      });
    },
    effect: function (group, it, pos) {
      var at = { x: pos.x, y: pos.y + 1.6, z: pos.z };
      if (group === 'eat') { TR.player.boostT = 12; TR.fx.coins(at, 16, 5); TR.audio.buy(1, 2); TR.hud.toast('You ate ' + it.name + '. You feel fast.', 'gold'); }
      else if (group === 'throw') { TR.fx.bills(at, 70, 11); TR.agents.distract(pos, 90, 9); TR.crowds.lure(pos, 3); TR.audio.buy(0, 2); TR.hud.toast('You threw ' + it.name + '. Agents are going after it.', 'gold'); }
      else if (group === 'hide') { TR.audio.door(); TR.hud.toast('You are lying low at ' + it.name + '. The Refund Office has lost you.', 'gold'); }
      else if (group === 'party') { TR.fx.confetti(at, 110, 11); TR.fx.firework(pos.x, pos.y + 22, pos.z); TR.audio.boom(0.4); TR.audio.cheer(0.5); TR.crowds.cheer(3); }
      else if (group === 'read') own.read(it);
      else if (group === 'drive') {
        var h = TR.player.heading, v = TR.vehicles.spawn('sports_car', pos.x + Math.cos(h) * 4, pos.y + 0.2, pos.z - Math.sin(h) * 4, h);
        TR.vehicles.board(v); TR.audio.door();
        TR.hud.toast('You take ' + it.name + ' for a spin.', 'gold');
      } else {
        own.placed.push({ kind: TR.goods.kindFor(it), x: pos.x + Math.sin(TR.player.heading) * -3, y: pos.y, z: pos.z + Math.cos(TR.player.heading) * -3, s: 2.2, r: TR.player.heading });
        TR.crowds.lure(pos, 5); TR.agents.distract(pos, 45, 7); TR.audio.thud();
        TR.hud.toast('You put down ' + it.name + '. Everyone stops to look.', 'gold');
      }
    },
    /** Reading gives you a real clue to something hidden you have not found. */
    read: function (it) {
      var sess = TR.app.session, me = sess.view.me, best = null, bd = Infinity, pos = TR.player.pos;
      Object.keys(sess.run.secrets).forEach(function (k) {
        var s = sess.run.secrets[k];
        if (me.flags['s:' + k] || !s.pos || !s.clueText || own.readSeen[k]) return;
        var d = Math.hypot(s.pos.x - pos.x, s.pos.z - pos.z);
        if (d < bd) { bd = d; best = s; }
      });
      if (!best) { TR.hud.toast('You read ' + it.name + '. You learn nothing new.'); return; }
      own.readSeen[best.id] = true;
      TR.hud.clue(it.name, best.clueText + ' (Try ' + window.TRD.districts.DISTRICTS[best.district].name + ')');
      TR.notebook.addClue(it.name, best.clueText, pos);
      TR.audio.buy(1, 1);
    },
    readSeen: {},
    resetRun: function () { own.placed = []; own.recent = []; own.readSeen = {}; own.close(); },
    drawPlaced: function (pos) {
      own.placed.forEach(function (q) { if (Math.hypot(q.x - pos.x, q.z - pos.z) < 140 && Math.abs(q.y - pos.y) < 30) TR.goods.put(q.kind, q.x, q.y, q.z, q.r, q.s); });
    },
    /** The little prompt for the T key. */
    updateQuick: function (dt, sess) {
      var me = sess.view.me, id = own.quickItem(me);
      if (!own.chip) { own.chip = el('div', 'quickuse', TR.hud.root); }
      if (!id) { if (own.quickId) { own.chip.style.display = 'none'; own.quickId = null; } return; }
      var key = id + ':' + own.left(me, id);
      if (key !== own.quickId) {
        own.quickId = key;
        own.chip.style.display = '';
        own.chip.innerHTML = '<kbd>T</kbd><b></b>' + (own.left(me, id) > 1 ? '<em>x' + own.left(me, id) + '</em>' : '');
        own.chip.querySelector('b').textContent = U.ACTION[own.usable(id)] + ': ' + sess.run.items[id].name;
      }
      if (TR.input.hit('KeyT')) own.use(id);
    },

    // ── throwing cash ──
    rainT: 0,
    rain: function (dt, sess, pos) {
      own.rainT -= dt;
      if (!TR.input.down('KeyG') || own.rainT > 0) return;
      own.rainT = 0.22;
      sess.extra({ t: 'rain' }, function (r) {
        if (r.error) { if (!own.rainWarned) { own.rainWarned = true; TR.hud.toast(r.error, 'bad'); setTimeout(function () { own.rainWarned = false; }, 3000); } return; }
        if (!r.ok) return;
        TR.fx.bills({ x: pos.x, y: pos.y + 2.8, z: pos.z }, 10, 9);
        TR.audio.buy(0, 1);
        TR.crowds.lureAt = { x: pos.x, y: pos.y, z: pos.z }; TR.crowds.lureT = 3;
        TR.agents.distract(pos);
      });
    }
  };
})();
