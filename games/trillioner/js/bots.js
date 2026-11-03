/* Battle Spend on screen: rivals in the world, leaderboard, feed, attack cards, auctions, gift offers. */
(function () {
  var TR = window.TR = window.TR || {};
  var COLORS = [0xff5a5a, 0x4dabf7, 0x51cf66, 0xcc5de8, 0xff922b, 0x20c997, 0xf06595, 0xffd43b];
  var HAIRS = [0x2a1d16, 0xc98a2e, 0x111111, 0x7a3b1d, 0xe2d3b0, 0x3c2a60, 0x5b3a22, 0xb5462b], SKINS = [0xf7cfa6, 0xc98d5e, 0x8d5a3a, 0xf2c79a, 0xe0ac7e, 0x6f4429, 0xfad9b8, 0xd19a6a];
  var CARD_NAMES = { boost: 'Boost', ban: 'Ban', refund: 'Refund', gift: 'Forced Gift' };
  var CARD_TIPS = { boost: "Make a rival's losing company profitable for 60s", ban: 'Close a shop to a rival for 45s', refund: 'Add a rival $3B', gift: 'Send $5B of yours to a rival; they can refuse for $1B' };
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var bt = TR.battle = {
    session: null, rigs: {}, ui: null, cardMesh: null,
    start: function (sess) {
      bt.session = sess;
      bt.stop();
      var root = bt.ui = document.createElement('div');
      root.innerHTML = '<div class="board" id="bb"></div><div class="feed" id="bf"></div><div class="cards" id="bc"></div><div id="ba"></div><div id="bg"></div>';
      TR.hud.root.appendChild(root);
      var box = new THREE.OctahedronGeometry(1.1);
      bt.cardMesh = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xc77dff }), 12);
      bt.cardMesh.frustumCulled = false; bt.cardMesh.count = 0;
      TR.app.scene.add(bt.cardMesh);
    },
    stop: function () {
      if (bt.ui) bt.ui.remove();
      bt.ui = null;
      Object.keys(bt.rigs).forEach(function (k) { TR.app.scene.remove(bt.rigs[k].group); });
      bt.rigs = {};
      if (bt.cardMesh) { TR.app.scene.remove(bt.cardMesh); bt.cardMesh = null; }
    },
    rig: function (b, i) {
      var r = bt.rigs[b.id];
      if (r) return r;
      var fig = TR.player.figure(COLORS[i % COLORS.length], HAIRS[i % HAIRS.length], SKINS[i % SKINS.length]), g = fig.group;
      var c = document.createElement('canvas'); c.width = 256; c.height = 48;
      var x = c.getContext('2d'); x.fillStyle = 'rgba(16,18,40,.8)'; x.fillRect(0, 0, 256, 48); x.fillStyle = '#fff'; x.font = '800 26px Arial'; x.textAlign = 'center'; x.fillText(b.name, 128, 33);
      var nameTex = new THREE.CanvasTexture(c); nameTex.encoding = THREE.sRGBEncoding;
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTex, fog: false }));
      sp.scale.set(5, 0.95, 1); sp.position.y = 3.7; g.add(sp);
      TR.app.scene.add(g);
      return (bt.rigs[b.id] = { group: g, parts: fig.parts, x: b.x, y: b.y, z: b.z, h: b.h, sp: 0, walk: 0, last: performance.now() });
    },
    /** 10 times a second, from the main loop. */
    tick: function (view, pos) {
      if (!view.board || !bt.ui) return;
      var room = TR.interiors.current ? TR.interiors.current.id : null, under = pos.y < -20;
      view.board.forEach(function (b, i) {
        if (b.id === view.me.id) return;
        var r = bt.rig(b, i), g = r.group;
        g.visible = (b.inv || null) === room && (b.y < -20) === under;
        var nx = r.x + (b.x - r.x) * 0.4, nz = r.z + (b.z - r.z) * 0.4, now = performance.now(), dt = Math.max(0.005, (now - r.last) / 1000);
        var sp = Math.min(20, Math.hypot(nx - r.x, nz - r.z) / dt);
        r.last = now; r.sp += (sp - r.sp) * Math.min(1, dt * 6); r.walk += r.sp * dt * 1.2;
        r.x = nx; r.z = nz; r.y += (b.y - r.y) * 0.4;
        g.position.set(r.x, r.y, r.z); g.rotation.y = b.h || 0;
        if (b.styleV !== r.styleV) { r.styleV = b.styleV; TR.wardrobe.dress(r.parts, b.style); }
        TR.player.stride(r.parts, Math.sin(r.walk), Math.cos(r.walk), Math.min(1, r.sp / 18), Math.min(1, r.sp / 7));
      });
      bt.drawBoard(view);
      bt.drawFeed(view);
      bt.drawCards(view);
      bt.drawAuction(view);
      bt.drawGift(view);
      bt.pickups(view, pos);
    },
    drawBoard: function (v) {
      var list = v.board.slice().sort(function (a, b) { return a.balance - b.balance; }), html = '<b>Lowest balance leads</b>';
      list.forEach(function (b) { html += '<div class="row2 ' + (b.id === v.me.id ? 'me' : '') + (b.connected ? '' : ' off') + '"><span>' + esc(b.name) + (b.bot ? ' *' : '') + '</span><span>' + TR.fmt(b.balance) + '</span></div><div class="row2" style="opacity:.7;font-size:11px"><span></span><span>spent ' + TR.fmt(b.spent) + '</span></div>'; });
      bt.set('bb', html);
    },
    drawFeed: function (v) { bt.set('bf', v.feed.slice(-4).map(function (f) { return '<div>' + esc(f.text) + '</div>'; }).join('')); },
    drawCards: function (v) {
      var cards = v.me.cards || [], rivals = v.board.filter(function (b) { return b.id !== v.me.id; }), html = '';
      cards.forEach(function (c) { html += '<button data-card="' + c + '" title="' + CARD_TIPS[c] + '">' + CARD_NAMES[c] + '</button>'; });
      var key = cards.join() + '|' + rivals.length;
      if (bt.cardKey === key) return;
      bt.cardKey = key;
      var el = bt.ui.querySelector('#bc');
      el.innerHTML = html;
      el.querySelectorAll('[data-card]').forEach(function (b) {
        b.onclick = function () {
          var k = b.getAttribute('data-card'), richest = rivals.slice().sort(function (x, y) { return y.balance - x.balance; }), target = k === 'gift' || k === 'refund' ? rivals.slice().sort(function (x, y) { return x.balance - y.balance; })[0] : richest[0];
          bt.session.send({ t: 'play', kind: k, target: target.id }, function (r) { if (r.error) TR.hud.toast(r.error, 'bad'); else TR.hud.toast(CARD_NAMES[k] + ' played on ' + target.name + '!', 'gold'); });
        };
      });
    },
    drawAuction: function (v) {
      var a = (v.auctions || [])[0], el = bt.ui.querySelector('#ba');
      if (!a) { if (el.innerHTML) el.innerHTML = ''; bt.auc = null; return; }
      var need = Math.max(a.min, a.bestBid + 1 * TRD.rules.B), text = esc(a.name) + ' - ' + Math.ceil(a.left / 1000) + 's - ' + (a.best ? 'top bid ' + TR.fmt(a.bestBid) + ' by ' + esc(a.best) : 'from ' + TR.fmt(a.min));
      if (bt.auc !== a.id) {
        bt.auc = a.id;
        el.innerHTML = '<div class="auction"><span id="bat"></span><button id="bab"></button></div>';
        el.querySelector('#bab').onclick = function () {
          var cur = (bt.session.view.auctions || [])[0]; if (!cur) return;
          bt.session.send({ t: 'bid', id: cur.id, amount: Math.max(cur.min, cur.bestBid + 1 * TRD.rules.B) });
        };
      }
      el.querySelector('#bat').innerHTML = text;
      el.querySelector('#bab').textContent = 'Bid ' + TR.fmt(need);
    },
    drawGift: function (v) {
      var el = bt.ui.querySelector('#bg');
      if (!v.giftFrom) { if (el.innerHTML) el.innerHTML = ''; return; }
      if (!el.innerHTML) {
        el.innerHTML = '<div class="gift">A rival is forcing ' + TR.fmt(v.giftFrom.amount) + ' on you! <span id="bgt"></span><button id="bgr">Refuse for $1B</button></div>';
        el.querySelector('#bgr').onclick = function () { bt.session.send({ t: 'refuse' }); };
      }
      el.querySelector('#bgt').textContent = Math.ceil(v.giftFrom.left / 1000) + 's';
    },
    pickups: function (v, pos) {
      if (!bt.cardMesh) return;
      var d = new THREE.Object3D(), spots = v.cardSpots || [], t = TR.app.t;
      spots.forEach(function (c, i) {
        d.position.set(c.x, c.y + 1.6 + Math.sin(t * 2 + i) * 0.3, c.z); d.rotation.y = t * 2; d.updateMatrix();
        bt.cardMesh.setMatrixAt(i, d.matrix);
        if (!TR.interiors.current && Math.hypot(c.x - pos.x, c.z - pos.z) < 3 && Math.abs(c.y - pos.y) < 4 && !c.asked) {
          c.asked = true;
          if ((v.me.cards.length + (v.me.cardsUsed || 0)) < 3) bt.session.send({ t: 'pickup', id: c.id }, function (r) { if (r.ok) { TR.hud.toast('Attack card: ' + CARD_NAMES[r.kind] + '!', 'gold'); TR.audio.buy(1, 3); } });
        }
      });
      bt.cardMesh.count = spots.length;
      bt.cardMesh.instanceMatrix.needsUpdate = true;
    },
    set: function (id, html) { var el = bt.ui.querySelector('#' + id); if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; } },
    /** Battle-only engine events. Returns true when it handled one. */
    onEvent: function (ev) {
      if (!TR.app.session.online) return false;
      switch (ev.type) {
        case 'auction': TR.hud.banner('AUCTION: ' + ev.name); TR.audio.cheer(0.5); return true;
        case 'auctionEnd': TR.hud.toast(ev.winner ? ev.name + ' sold for ' + TR.fmt(ev.price) : 'No sale: ' + ev.name, 'gold'); return true;
        case 'bid': return true;
        case 'attacked': TR.hud.clue('Attack!', ev.text); TR.audio.denied(); return true;
        case 'giftOffer': TR.audio.denied(); return true;
        case 'gifted': TR.hud.toast(ev.from + ' forced ' + TR.fmt(ev.amount) + ' on you!', 'bad'); return true;
        case 'cardTaken': return true;
      }
      return false;
    }
  };
})();
