/* The bag and the Style Counter: everything you own, what you wear, and mystery boxes. The clock keeps running. */
(function () {
  var TR = window.TR = window.TR || {};
  var X = window.TRD.extras, R = window.TRD.rules;
  var CATS = [['all', 'All'], ['top', 'Tops'], ['legs', 'Trousers'], ['shoes', 'Shoes'], ['hat', 'Hats'], ['hair', 'Hair'], ['glasses', 'Glasses'], ['neck', 'Jewellery'], ['wrist', 'Watches'], ['fx', 'Effects'], ['pet', 'Pets']];
  var RCLASS = { c: 'common', r: 'rare', e: 'epic', l: 'legendary' };

  function el(tag, cls, parent, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function goodsRarity(price) { return price >= 10 * R.B ? 'l' : price >= 1 * R.B ? 'e' : price >= 100 * R.M ? 'r' : 'c'; }

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
      own.camDist = TR.cam.dist; TR.cam.dist = 6.5;
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
      TR.cam.dist = own.camDist; TR.input.pitch = own.pitch;
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
        '<img data-thumb="x:' + x.id + '" alt=""><i class="rar">' + X.RARITY[x.rarity] + '</i><b>' + esc(x.name) + '</b><span>' + (mine ? (on ? 'Wearing' : 'Wear') : TR.fmt(x.price)) + '</span>');
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
      var run = TR.app.session.run, any = false, kinds = Object.keys(me.goods).concat(Object.keys(me.owned)).filter(function (id) { return run.items[id]; }), usable = kinds.filter(function (id) { return TR.pads.useText(run.items[id]); }).length;
      if (kinds.length) el('div', 'own-sum', body, '<b>' + usable + '</b> of your <b>' + kinds.length + '</b> purchases do something. The rest are just for show, and they follow you around.');
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
          var it = run.items[id], n = me.goods[id];
          el('div', 'own-card ' + RCLASS[goodsRarity(it.price)], g4, '<img data-thumb="g:' + TR.goods.kindFor(it) + '" alt="">' + (n > 1 ? '<em>x' + n + '</em>' : '') + '<i class="rar">' + X.RARITY[goodsRarity(it.price)] + '</i><b>' + esc(it.name) + '</b><span>' + TR.fmt(it.price) + '</span>' + own.useLine(it));
        });
      }
      if (!any) el('div', 'own-note', body, 'Nothing yet. That is a lot of money to still be holding.');
    },

    useLine: function (it) {
      var u = TR.pads.useText(it);
      return u ? '<u class="use">' + esc(u) + '</u>' : '<u class="use none">Just for show</u>';
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
