/* Title, modes, settings, Clout shop, trophies, pause, results, tutorial. */
(function () {
  var TR = window.TR = window.TR || {};
  var Tr = window.TRD.trophies, R = window.TRD.rules;

  // Clout only buys looks. Nothing here touches the engine.
  var SHOP = {
    Hats: [['hat_top', 'Top Hat', 20], ['hat_cowboy', 'Cowboy Hat', 40], ['hat_party', 'Party Cone', 60], ['hat_chef', 'Chef Hat', 80], ['hat_halo', 'Gold Halo', 400]],
    Outfits: [['fit_pink', 'Pink Suit', 30, 0xff7ab8], ['fit_mint', 'Mint Suit', 30, 0x5ee6b0], ['fit_black', 'Black Tie', 100, 0x20202a], ['fit_chrome', 'Chrome', 300, 0xcfd6de], ['fit_lava', 'Lava', 500, 0xff5a1a]],
    Skins: [['skin_gold', 'Gold Vehicles', 150, 0xffc53d], ['skin_pink', 'Pink Vehicles', 50, 0xff7ab8], ['skin_stealth', 'Stealth Vehicles', 90, 0x2a2a33]],
    Trails: [['trail_blue', 'Blue Carpet', 40, 0x2f80ed], ['trail_gold', 'Gold Carpet', 200, 0xffc53d], ['trail_green', 'Green Carpet', 40, 0x3ddc6e]],
    Dances: [['dance_spin', 'The Spin', 30], ['dance_jump', 'The Jump', 30], ['dance_flop', 'The Flop', 75]]
  };
  function el(html, cls) { var s = document.createElement('div'); s.className = 'screen ' + (cls || ''); s.innerHTML = html; return s; }
  function screen(html, cls) { menus.close(); var s = el(html, cls); menus.ui.appendChild(s); menus.cur = s; return s; }
  function on(s, id, fn) { var e = s.querySelector('#' + id); if (e) e.onclick = fn; }
  function escapeHtml(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var menus = TR.menus = {
    ui: null, cur: null, SHOP: SHOP,
    init: function (ui) { menus.ui = ui; },
    close: function () { if (menus.cur) menus.cur.remove(); menus.cur = null; },
    title: function () {
      var d = TR.save.data(), played = d.runs > 0;
      var s = screen('<h1 class="outlined">TRILLIONER</h1><p class="outlined">One city. One day. One trillion dollars. Spend it all before 6AM.</p>' +
        '<div class="row"><button class="btn" id="m-day">The Day</button><button class="btn" id="m-daily">Daily City</button>' +
        '<button class="btn" id="m-battle">Battle Spend</button><button class="btn alt" id="m-free"' + (played ? '' : ' disabled title="Finish a run first"') + '>Free Roam' + (played ? '' : ' (finish a run)') + '</button></div>' +
        '<div class="row"><button class="btn alt" id="m-how">How to play</button><button class="btn alt" id="m-trophies">Trophies</button><button class="btn alt" id="m-shop">Clout Shop (' + d.clout + ')</button><button class="btn alt" id="m-note">Notebook</button><button class="btn alt" id="m-set">Settings</button><button class="btn alt" id="m-exit">Back to hub</button></div>' +
        '<p class="outlined" style="opacity:.9">' + (d.bestSpent ? 'Best spent ' + TR.fmt(d.bestSpent) : 'You have never spent anything. Yet.') + (d.fastestWin ? ' · Fastest win ' + menus.mins(d.fastestWin) : '') + '</p>');
      var go = function (o) { return function () { TR.audio.unlock(); menus.close(); TR.app.startRun(o); }; };
      on(s, 'm-day', go({ mode: 'day' }));
      on(s, 'm-daily', go({ mode: 'daily', seed: menus.dailySeed() }));
      on(s, 'm-free', function () { if (played) go({ mode: 'free' })(); });
      on(s, 'm-battle', function () { TR.audio.unlock(); menus.battle(); });
      on(s, 'm-how', menus.how); on(s, 'm-trophies', menus.trophies); on(s, 'm-shop', menus.shop);
      on(s, 'm-note', menus.noteScreen); on(s, 'm-set', function () { menus.settings(menus.title); }); on(s, 'm-exit', menus.exit);
    },
    mins: function (ms) { var t = Math.round(ms / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); },
    dailyKey: function () { return new Date().toISOString().slice(0, 10); },
    dailySeed: function () { return TrillionerRng.hash('daily:' + menus.dailyKey()); },
    exit: function () { if (window.Hub) Hub.exit(); else location.href = '../../index.html'; },
    back: function (fn) { return '<div class="row"><button class="btn alt" id="m-back">Back</button></div>'; },
    how: function () {
      var s = screen('<div class="panel left"><h2 class="outlined">How to play</h2>' +
        '<p><b>The goal:</b> get your balance under $1M with income at $0 or less, before the next 6AM. A day is 24 real minutes.</p>' +
        '<p><b>Businesses earn.</b> Your money only grows from businesses you buy, and each one shows its income before you pay. Boarded-up ones lose money, which helps. You can demolish what you own for 40% of its price.</p>' +
        '<p><b>Shops in plain sight are nowhere near enough.</b> Look on roofs, follow rumours, open odd doors, read the paper, try things at night.</p>' +
        '<p><b>Frenzy:</b> buy $100M or more within 5 seconds of your last big buy and prices climb, up to x5.</p>' +
        '<table class="keys"><tr><td>WASD, Shift, Space</td><td>Move, sprint, double jump</td></tr><tr><td>Y, U</td><td>Take or hang up a call</td></tr><tr><td>I</td><td>Your bag and wardrobe</td></tr><tr><td>Hold G</td><td>Throw cash in the air</td></tr><tr><td>J</td><td>Guide on or off</td></tr><tr><td>Mouse</td><td>Camera (click the game to capture it)</td></tr><tr><td>Run into something on display</td><td>Buy it</td></tr><tr><td>Walk into a door</td><td>Go inside, or back out</td></tr><tr><td>Hold E</td><td>Buy a big deal</td></tr><tr><td>Hold X</td><td>Demolish what you own, at its pad</td></tr><tr><td>Q, then a number</td><td>Call a vehicle or pick an item</td></tr><tr><td>F</td><td>Get in or out</td></tr><tr><td>Left mouse, H</td><td>Use your item or ability, horn</td></tr><tr><td>M, N, Esc</td><td>Map, notebook, pause</td></tr><tr><td>K</td><td>Music on or off</td></tr></table>' +
        menus.back() + '</div>');
      on(s, 'm-back', menus.title);
    },
    noteScreen: function () {
      var n = TR.save.get('notebook', {}), k = Object.keys(n);
      var s = screen('<div class="panel left"><h2 class="outlined">Notebook</h2>' + (k.length ? k.map(function (i) { return '<p>' + escapeHtml(n[i]) + '</p>'; }).join('') : '<p>Blank so far.</p>') + menus.back() + '</div>');
      on(s, 'm-back', menus.title);
    },
    trophies: function () {
      var got = TR.save.get('trophies', {});
      var chips = Tr.TROPHIES.map(function (t) {
        var has = got[t.id], secret = !has && !t.spent && !t.manual;
        return '<div class="troph ' + (has ? 'has' : '') + '"><b>' + (secret ? '???' : t.name) + '</b><br><small>' + (secret ? 'Keep exploring' : t.spent ? 'Spend ' + TR.fmt(t.spent) + ' in one run' : (t.desc || '')) + '</small></div>';
      }).join('');
      var s = screen('<div class="panel"><h2 class="outlined">Trophies</h2><p>Walk among yours in the Trillion Tower penthouse.</p><div class="trophies">' + chips + '</div>' + menus.back() + '</div>');
      on(s, 'm-back', menus.title);
    },
    shop: function () {
      var d = TR.save.data(), html = '<div class="panel"><h2 class="outlined">Clout Shop</h2><p>You have <b>' + d.clout + ' Clout</b>. Looks only. Nothing here changes the game.</p>';
      Object.keys(SHOP).forEach(function (cat) {
        html += '<h3>' + cat + '</h3><div class="row small">';
        SHOP[cat].forEach(function (it) {
          var owned = d.unlocks[it[0]], worn = d.equipped[cat] === it[0];
          html += '<button class="btn ' + (worn ? '' : 'alt') + '" data-it="' + it[0] + '" data-cat="' + cat + '" data-cost="' + it[2] + '"' + (!owned && d.clout < it[2] ? ' disabled' : '') + '>' + it[1] + ' ' + (worn ? '(on)' : owned ? '' : '(' + it[2] + ')') + '</button>';
        });
        html += '</div>';
      });
      var s = screen(html + menus.back() + '</div>');
      on(s, 'm-back', menus.title);
      s.querySelectorAll('[data-it]').forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-it'), cat = b.getAttribute('data-cat'), cost = +b.getAttribute('data-cost'), u = TR.save.get('unlocks', {}), e = TR.save.get('equipped', {});
          if (!u[id]) { var c = TR.save.get('clout', 0); if (c < cost) return; TR.save.set('clout', c - cost); u[id] = true; TR.save.set('unlocks', u); TR.audio.buy(1, 2); }
          e[cat] = e[cat] === id ? null : id;
          TR.save.set('equipped', e);
          TR.player.applyLooks();
          menus.shop();
        };
      });
    },
    item: function (cat, id) { var r = null; (SHOP[cat] || []).forEach(function (i) { if (i[0] === id) r = i; }); return r; },
    settings: function (back) {
      var Q = TR.quality, a = TR.audio;
      var s = screen('<div class="panel"><h2 class="outlined">Settings</h2>' +
        '<label>Volume <input type="range" id="s-v" min="0" max="1" step="0.05" value="' + a.volume + '"></label>' +
        '<label>Effects <input type="range" id="s-fx" min="0" max="1" step="0.05" value="' + a.sfxVolume + '"></label>' +
        '<label>Music <input type="range" id="s-mu" min="0" max="1" step="0.05" value="' + a.musicVolume + '"></label>' +
        '<div class="row small"><button class="btn alt" id="s-music">' + (a.musicMuted ? 'Music: Off' : 'Music: On') + '</button><button class="btn alt" id="s-mute">' + (a.muted ? 'Unmute everything' : 'Mute everything') + '</button></div>' +
        '<h3>Quality</h3><div class="row small">' + ['low', 'medium', 'high', 'auto'].map(function (q) { return '<button class="btn ' + (Q.choice === q ? '' : 'alt') + '" data-q="' + q + '">' + q[0].toUpperCase() + q.slice(1) + '</button>'; }).join('') + '</div>' +
        menus.back() + '</div>');
      function sv(id, key) { s.querySelector('#' + id).oninput = function (e) { a.setVolume(key, +e.target.value); a.saveLevels(); }; }
      sv('s-v', 'volume'); sv('s-fx', 'sfxVolume'); sv('s-mu', 'musicVolume');
      on(s, 's-mute', function () { a.setMuted(!a.muted); a.saveLevels(); menus.settings(back); });
      on(s, 's-music', function () { a.setMusicMuted(!a.musicMuted); menus.settings(back); });
      s.querySelectorAll('[data-q]').forEach(function (b) { b.onclick = function () { Q.set(b.getAttribute('data-q')); menus.settings(back); }; });
      on(s, 'm-back', back);
    },
    pause: function () {
      var free = TR.app.mode === 'free', online = TR.app.session.online;
      var s = screen('<h1 class="outlined" style="font-size:64px">' + (online ? 'Menu' : 'Paused') + '</h1>' + (online ? '<p class="outlined">The match keeps running.</p>' : free ? '' : '<p class="outlined">The clock has stopped.</p>') +
        (free ? '<label class="outlined">Time of day <input type="range" id="p-time" min="0" max="23.9" step="0.1" value="' + TR.app.session.view.hour + '"></label>' : '') +
        '<div class="row"><button class="btn" id="p-go">Back to it</button><button class="btn alt" id="p-set">Settings</button><button class="btn alt" id="p-how">Controls</button><button class="btn alt" id="p-end">' + (free ? 'Leave Free Roam' : online ? 'Leave match' : 'End this run') + '</button></div>');
      var resume = function () { menus.close(); TR.app.setPaused(false); };
      on(s, 'p-go', resume);
      on(s, 'p-set', function () { menus.settings(menus.pause); });
      on(s, 'p-how', function () { var ss = screen('<div class="panel left"><h2 class="outlined">Controls</h2><table class="keys"><tr><td>WASD, Shift, Space</td><td>Move, sprint, double jump</td></tr><tr><td>Y, U</td><td>Take or hang up a call</td></tr><tr><td>I</td><td>Your bag and wardrobe</td></tr><tr><td>Hold G</td><td>Throw cash in the air</td></tr><tr><td>J</td><td>Guide on or off</td></tr><tr><td>Walk into a door</td><td>Go inside</td></tr><tr><td>Hold E</td><td>Big deals</td></tr><tr><td>Hold X</td><td>Demolish at the pad</td></tr><tr><td>Q, F</td><td>Vehicle wheel, get in or out</td></tr><tr><td>Left mouse, H</td><td>Use item, horn</td></tr><tr><td>M, N</td><td>Map, notebook</td></tr><tr><td>K</td><td>Music on or off</td></tr></table>' + menus.back() + '</div>'); on(ss, 'm-back', menus.pause); });
      on(s, 'p-end', function () { menus.close(); TR.app.paused = false; TR.app.quitRun(); });
      var tm = s.querySelector('#p-time');
      if (tm) tm.oninput = function (e) { TR.app.session.setClock(+e.target.value); TR.world.setTime(+e.target.value, 'clear', TR.player.pos); };
    },
    perfectWindow: function () {
      if (menus.pw) menus.pw.remove();
      var p = menus.pw = document.createElement('div'); p.className = 'perfect';
      p.innerHTML = '<b class="outlined">FLAT BROKE!</b><div id="pw-t"></div><div>For Perfect Zero, reach exactly $0.00 with income exactly $0. The clock is frozen. Fountains take small change.</div><div class="row"><button class="btn" id="pw-end">Take the win</button><button class="btn alt" id="pw-toss">Toss loose change</button></div>';
      menus.ui.appendChild(p);
      p.querySelector('#pw-end').onclick = function () { TR.app.session.finish(); };
      p.querySelector('#pw-toss').onclick = function () { var r = TR.app.session.toss(); TR.hud.toast(r.error || 'Tossed ' + TR.fmtFull(r.paid), r.error ? 'bad' : 'gold'); };
    },
    updatePerfect: function (me) { if (menus.pw) { menus.pw.querySelector('#pw-t').textContent = Math.ceil(me.perfectLeft / 1000) + ' seconds. Balance ' + TR.fmtFull(me.balance); } },
    closePerfect: function () { if (menus.pw) menus.pw.remove(); menus.pw = null; },
    results: function (res, earned) {
      var title = res.perfect ? 'PERFECT ZERO!' : res.won ? 'FLAT BROKE!' : res.result === 'quit' ? 'Run over' : 'The day is over', names = {};
      if (TR.app.mode === 'battle' && res.winnerName) title = res.winner === TR.app.session.view.me.id ? 'YOU WIN!' : res.winnerName + ' wins!';
      Tr.TROPHIES.forEach(function (t) { names[t.id] = t.name; });
      var chips = res.trophies.map(function (t) { return '<span class="chip">' + (earned.newTrophies.indexOf(t) >= 0 ? 'NEW: ' : '') + (names[t] || t) + '</span>'; }).join('') || '<span>No trophies this time.</span>';
      var free = TR.app.mode === 'free', daily = TR.app.mode === 'daily';
      var s = screen('<div class="panel"><h2 class="outlined">' + title + '</h2>' +
        '<div class="stats"><div class="stat"><b>' + TR.fmt(res.spent) + '</b>Spent</div><div class="stat"><b>' + TR.fmtFull(res.left) + '</b>Money left</div>' +
        '<div class="stat"><b>+' + earned.clout + '</b>Clout earned</div><div class="stat"><b>' + res.secrets + '</b>Secrets found</div>' +
        '<div class="stat"><b>' + (res.best ? TR.fmt(res.best.base) : '-') + '</b>Best purchase: ' + (res.best ? escapeHtml(res.best.name) : 'nothing') + '</div>' + (res.won ? '<div class="stat"><b>' + menus.mins(res.ms) + '</b>Win time</div>' : '') + '</div>' +
        '<canvas class="chart" id="r-chart" width="700" height="120"></canvas><div class="chips">' + chips + '</div>' +
        (daily ? '<div id="r-lb" class="lb">Loading today\'s board...</div>' : '') +
        (res.board ? '<div class="lb">' + res.board.map(function (b, i) { return '<div>' + (i + 1) + '. ' + escapeHtml(b.name) + ': ' + TR.fmtFull(b.balance) + ' left, ' + TR.fmt(b.spent) + ' spent</div>'; }).join('') + '</div>' : '') +
        '<div class="row"><button class="btn" id="r-again">New run</button><button class="btn alt" id="r-menu">Menu</button></div></div>');
      menus.chart(s.querySelector('#r-chart'), res.history);
      on(s, 'r-again', function () { if (TR.app.mode === 'battle') { menus.battle(); return; } menus.close(); TR.app.startRun({ mode: TR.app.mode, seed: daily ? menus.dailySeed() : undefined }); });
      on(s, 'r-menu', menus.title);
      if (daily) TR.leaderboard.submitAndShow(res, s.querySelector('#r-lb'));
      if (free) on(s, 'r-again', function () { menus.close(); TR.app.startRun({ mode: 'free' }); });
    },
    chart: function (c, h) {
      var g = c.getContext('2d'), W = c.width, H = c.height, max = Math.max.apply(null, h) || 1;
      g.clearRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, H - 12); g.lineTo(W, H - 12); g.stroke();
      g.strokeStyle = '#ffc53d'; g.lineWidth = 3; g.beginPath();
      h.forEach(function (v, i) { var x = i / Math.max(1, h.length - 1) * (W - 8) + 4, y = H - 12 - v / max * (H - 26); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
      g.fillStyle = '#fff'; g.font = '12px Arial'; g.fillText('Balance over the day (peak ' + TR.fmt(max) + ')', 8, 14);
    },
    battle: function () { TR.net ? TR.net.lobby() : TR.hud.toast('Battle Spend needs npm start.', 'bad'); }
  };

  // ───── first-run tutorial: one line at a time, shown once, skippable ─────
  var STEPS = [
    { text: 'WASD to move. Shift to sprint. Space to jump, twice. Click the game to steer with the mouse.', done: function (c) { return c.moved > 12; } },
    { text: 'You have $1 trillion and until 6AM to get rid of it. See the shops across the street? Walk into a door and run into anything on display to buy it.', done: function (c, me) { return me.stats.purchases >= 1; } },
    { text: 'Every building sells itself: find the For Sale board inside and hold E.', done: function (c, me) { return Object.keys(me.owned).length >= 1; } },
    { text: 'You win below $1M with income at $0 or less. Businesses you buy can earn: each For Sale board shows how much before you pay. Boarded-up ones lose money.', hold: 8 },
    { text: 'Press M for the map. Shops in plain sight will not be enough: look on roofs, follow rumours, try doors. N opens your notebook.', hold: 8 },
    { text: 'Buy a business that comes with a vehicle (try the Dealership on Motor Mile, south of here), then press Q to call it. Good luck spending.', hold: 8 }
  ];
  TR.tutorial = {
    el: null, i: 0, c: { moved: 0 }, t: 0, last: null,
    start: function () {
      if (TR.save.get('tutorialDone', false)) return;
      var e = this.el = document.createElement('div'); e.className = 'tutorial';
      e.innerHTML = '<span id="tu-t"></span> <button id="tu-skip">Skip</button>';
      TR.hud.root.appendChild(e);
      this.i = 0; this.t = 0; this.c.moved = 0; this.last = null;
      var self = this;
      e.querySelector('#tu-skip').onclick = function () { self.finish(); };
      this.show();
    },
    show: function () { if (this.el) this.el.querySelector('#tu-t').textContent = STEPS[this.i].text; },
    finish: function () { TR.save.set('tutorialDone', true); if (this.el) this.el.remove(); this.el = null; },
    update: function (dt, me, pos) {
      if (!this.el) return;
      if (this.last) this.c.moved += Math.hypot(pos.x - this.last.x, pos.z - this.last.z);
      this.last = { x: pos.x, z: pos.z };
      this.t += dt;
      var st = STEPS[this.i];
      if (st.done ? st.done(this.c, me) : this.t >= st.hold) {
        this.i++; this.t = 0;
        if (this.i >= STEPS.length) this.finish(); else this.show();
      }
    }
  };

  // ───── Daily City leaderboard: the game server when there is one, this browser otherwise ─────
  TR.leaderboard = {
    submitAndShow: function (res, box) {
      var day = menus.dailyKey(), entry = { name: (window.Hub ? Hub.player().name : 'You') || 'You', spent: res.spent, win: res.won ? res.ms : null };
      var showLocal = function () {
        var key = 'daily:' + day, list = TR.save.get(key, []);
        list.push(entry); TR.save.set(key, list);
        TR.leaderboard.render(box, list, 'Saved on this device');
      };
      if (TR.net && TR.net.dailySubmit) TR.net.dailySubmit(day, entry, function (r) { if (r && r.list) TR.leaderboard.render(box, r.list, 'City-wide board'); else showLocal(); });
      else showLocal();
    },
    render: function (box, list, note) {
      var spent = list.slice().sort(function (a, b) { return b.spent - a.spent; }).slice(0, 5), wins = list.filter(function (e) { return e.win; }).sort(function (a, b) { return a.win - b.win; }).slice(0, 5);
      var row = function (e, i, v) { return '<div>' + (i + 1) + '. ' + escapeHtml(e.name) + ' - ' + v + '</div>'; };
      box.innerHTML = '<div class="row"><div><b>Most spent</b>' + spent.map(function (e, i) { return row(e, i, TR.fmt(e.spent)); }).join('') + '</div><div><b>Fastest win</b>' + (wins.map(function (e, i) { return row(e, i, menus.mins(e.win)); }).join('') || '<div>Nobody yet</div>') + '</div></div><small>' + note + '</small>';
    }
  };

  // ───── Quality ─────
  var LEVELS = {
    low: { ratio: 1, shadows: false, map: 512, crowd: 36, cars: 18, draw: 0.62, windows: 150 },
    medium: { ratio: 1.25, shadows: true, map: 1024, crowd: 64, cars: 30, draw: 0.9, windows: 300 },
    high: { ratio: 1.6, shadows: true, map: 2048, crowd: 90, cars: 44, draw: 1, windows: 460 }
  };
  TR.quality = {
    choice: 'auto', level: 'high', lowT: 0,
    init: function () { var q = TR.save.get('quality', 'auto'); this.choice = q; this.apply(q === 'auto' ? 'high' : q); },
    set: function (q) { this.choice = q; TR.save.set('quality', q); this.apply(q === 'auto' ? 'high' : q); },
    apply: function (l) {
      var L = LEVELS[l], A = TR.app;
      this.level = l;
      A.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, L.ratio, Math.max(1, 1920 / innerWidth)));   // past about 1080p, more pixels only cost frames
      A.resize();
      var sun = TR.world.sun;
      A.renderer.shadowMap.enabled = L.shadows;
      sun.castShadow = L.shadows;
      if (L.shadows && sun.shadow.mapSize.x !== L.map) { sun.shadow.mapSize.set(L.map, L.map); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
      A.scene.traverse(function (o) { if (o.material) o.material.needsUpdate = true; });
      TR.settings = { drawDist: L.draw, windows: L.windows };
      TR.post.configure({ on: l !== 'low', ao: l === 'high', samples: l === 'high' ? 4 : 2, tilt: l === 'high' });
      TR.crowds.max = L.crowd;
      TR.traffic.count = L.cars;
    },
    /** Auto drops a level after a few seconds under 40 FPS. */
    watch: function (fps, dt) {
      if (this.choice !== 'auto') return;
      if (fps < 48) this.lowT += dt; else this.lowT = 0;
      if (this.lowT > 2 && this.level !== 'low') {
        this.lowT = 0;
        this.apply(this.level === 'high' ? 'medium' : 'low');
        TR.hud.toast('Quality lowered to keep things smooth.');
      }
    }
  };
})();
