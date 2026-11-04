/* Battle Spend: lobby, socket session, and reconnects. The session has the same shape as solo; the server decides everything. */
(function () {
  var TR = window.TR = window.TR || {};
  var Engine = window.TrillionerEngine, Shuffle = window.TrillionerShuffle, R = window.TRD.rules;
  var SEAT_KEY = 'trillioner.seat';

  function wsUrl() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return null;
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + location.pathname.replace(/[^/]*$/, '') + 'ws';
  }
  function getSeat() { try { return JSON.parse(sessionStorage.getItem(SEAT_KEY)); } catch (e) { return null; } }
  function setSeat(s) { try { if (s) sessionStorage.setItem(SEAT_KEY, JSON.stringify(s)); else sessionStorage.removeItem(SEAT_KEY); } catch (e) { /* private mode */ } }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /** One socket with request and reply. */
  function Link(url, onMsg, onClose) {
    var ws = new WebSocket(url), rid = 0, pending = {}, self = this, wait = [];
    ws.onopen = function () { wait.forEach(function (f) { f(); }); wait = []; };
    ws.onmessage = function (e) { var m = JSON.parse(e.data); if (m.t === 'reply') { if (pending[m.rid]) { pending[m.rid](m.res); delete pending[m.rid]; } } else onMsg(m); };
    ws.onclose = function () { Object.keys(pending).forEach(function (k) { pending[k]({ error: 'Connection lost.' }); }); pending = {}; onClose && onClose(); };
    this.ws = ws;
    this.req = function (t, data, cb) {
      var send = function () { var id = ++rid; pending[id] = cb || function () {}; ws.send(JSON.stringify(Object.assign({ t: t, rid: id }, data || {}))); };
      if (ws.readyState === 1) send(); else if (ws.readyState === 0) wait.push(send); else if (cb) cb({ error: 'Not connected.' });
    };
    this.raw = function (m) { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
    this.close = function () { ws.onclose = null; ws.close(); };
  }

  /** The online session. Reads come from the last view; writes go to the server and answer later. */
  function NetSession(link, start) {
    var run = Shuffle.buildRun(start.seed), stock = Object.assign({}, start.stock || {}), queue = [], shim;
    shim = {
      run: run, cfg: R.MODES.battle, t: 0, _hour: 6, _weather: 'clear',
      hourNow: function () { return this._hour; }, weather: function () { return this._weather; }, isOwned: Engine.Game.prototype.isOwned
    };
    var s = {
      online: true, run: run, seed: start.seed, stockMap: stock,
      view: { mode: 'battle', t: 0, hour: 6, dayMs: 480000, weather: 'clear', active: [], feed: [], me: blankMe(start.you), board: [], auctions: [], cardSpots: [] },
      tick: function () { var e = queue; queue = []; return e; },
      stock: function (id) { return stock[id] != null ? stock[id] : 0; },
      applyStock: function (id, n) { if (id != null && n != null) stock[id] = n; },
      quote: function (id) {
        var it = run.items[id], sale = s.view.active.some(function (a) { return a.id === 'firesale' && a.site === it.site; });
        return Engine.quote(sale ? Math.round(it.price / 2) : it.price, s.view.me.frenzy, s.view.me.balance);
      },
      gateFails: function (gate) { return Engine.Game.prototype.gateFails.call(shim, s.view.me, gate); },
      buy: function (id) {
        if (!s.quote(id).ok) return { code: 'broke', error: 'Too expensive' };
        link.req('cmd', { cmd: { t: 'buy', item: id } }, s.answer);
        stock[id] = Math.max(0, s.stock(id) - 1);   // the pad reacts at once; the server's answer corrects it
        return { pending: true };
      },
      demolish: function (id, truck) { link.req('cmd', { cmd: { t: 'demolish', item: id, truck: !!truck } }, s.answer); return { pending: true }; },
      discover: function (id) { link.req('cmd', { cmd: { t: 'discover', id: id } }, s.answer); return { pending: true }; },
      damage: function (kind) { link.req('cmd', { cmd: { t: 'damage', kind: kind } }); return { paid: R.DAMAGE[kind] }; },
      buyStore: function (site) { link.req('cmd', { cmd: { t: 'buyStore', site: site } }, s.answer); return { pending: true }; },
      cannon: function (on) { link.req('cmd', { cmd: { t: 'cannon', on: !!on } }); s.view.me.cannonOn = !!on; return { ok: true }; },
      fastTravel: function (d) { var v = s.view.me; if (v.travelCd > 0) return { error: 'The next flight is not ready.' }; if (!v.powers.fastTravel) return { error: 'You need the Airline.' }; link.req('cmd', { cmd: { t: 'fastTravel', district: d } }); return { ok: true, to: run.districtSpawn[d] }; },
      toss: function () { link.req('cmd', { cmd: { t: 'toss' } }, s.answer); return { error: 'Tossing...' }; },
      send: function (cmd, cb) { link.req('cmd', { cmd: cmd }, cb || s.answer); },
      extra: function (cmd, cb) { link.req('cmd', { cmd: cmd }, function (r) { if (cb) cb(r); }); },
      answer: function (r) { if (r && r.error && r.code !== 'sold') { TR.hud.toast(r.code === 'broke' ? 'Too expensive' : r.error, 'bad'); TR.audio.denied(); } },
      setPos: function (x, y, z, h, inv, d) { link.raw({ t: 'pos', x: x, y: y, z: z, h: h, inv: inv, d: d }); },
      setClock: function () {},
      finish: function () {},
      results: function () { return s.view.results || { result: 'quit', spent: s.view.me.spent, left: s.view.me.balance, trophies: [], clout: 0, secrets: 0, history: [s.view.me.balance], best: s.view.me.best, won: false, ms: s.view.t }; },
      leave: function () { setSeat(null); link.req('leave'); link.close(); TR.net.link = null; },
      onState: function (m) {
        s.view = m.view;
        shim.t = m.view.t; shim._hour = m.view.hour; shim._weather = m.view.weather;
        if (m.events) m.events.forEach(function (e) { queue.push(e); });
      }
    };
    return s;
  }
  function blankMe(id) { return { id: id, name: '', balance: 300 * R.B, spent: 0, biz: 0, income: 0, frenzy: 1, frenzyLeft: 0, home: {}, parts: {}, fitted: {}, homeV: 0, used: {}, extras: {}, style: { pet: [] }, styleV: 0, boxes: 0, rainUsed: 0, frenzyWindow: 5000, closings: [], owned: {}, goods: {}, vehicles: {}, gear: {}, powers: {}, flags: {}, wear: {}, trophies: {}, rank: 'Intern', visited: {}, stats: {}, cards: [], ban: {}, boost: {} }; }

  var net = TR.net = {
    link: null, session: null, room: null,
    connect: function (onMsg) {
      var url = wsUrl();
      if (!url) return null;
      if (net.link) net.link.close();
      net.link = new Link(url, function (m) { net.onMessage(m); }, function () { net.onDrop(); });
      return net.link;
    },
    onMessage: function (m) {
      if (m.t === 'lobby') { net.room = m.room; net.drawRoom(); }
      else if (m.t === 'start') net.begin(m);
      else if (m.t === 'state' && net.session) net.session.onState(m);
      else if (m.t === 'closed') {
        setSeat(null);
        if (m.reason !== 'finished' && !TR.app.ended) { TR.hud.toast('The room closed: ' + m.reason, 'bad'); if (net.session) TR.app.quitToMenu(); }
      }
    },
    onDrop: function () {
      if (!net.session || TR.app.ended) { if (TR.menus.cur && net.room) TR.menus.title(); return; }
      TR.hud.toast('Connection lost. Reconnecting...', 'bad');
      setTimeout(net.tryResume, 1500);
    },
    begin: function (m) {
      net.session = NetSession(net.link, m);
      TR.menus.close();
      TR.app.startRun({ mode: 'battle', seed: m.seed, session: net.session });
      // everyone starts side by side, not inside each other
      var seat = getSeat(), slot = net.room && seat ? net.room.seats.map(function (x) { return x.id; }).indexOf(seat.playerId) : 0, sp = net.session.run.spawn;
      if (slot >= 0) TR.player.teleport(sp.x + (slot % 4 - 1.5) * 3.2, sp.y, sp.z + Math.floor(slot / 4) * 3.2, 0);
      TR.battle.start(net.session);
    },
    tryResume: function () {
      var seat = getSeat();
      if (!seat) return false;
      if (!net.connect()) return false;
      net.link.req('resume', seat, function (r) {
        if (r.error) { setSeat(null); if (net.session) { TR.hud.toast('That seat is gone.', 'bad'); TR.app.quitToMenu(); } else TR.menus.title(); return; }
        if (r.phase === 'lobby') { net.drawRoom(); return; }
        if (net.session) { // same page: reattach the session to the new socket
          var keep = net.session; net.session = NetSession(net.link, { seed: r.seed, you: r.playerId, stock: r.stock });
          net.session.view = keep.view; TR.app.session = net.session; TR.hud.toast('Back in the match.', 'gold');
        } else net.begin({ seed: r.seed, you: r.playerId, stock: r.stock });
      });
      return true;
    },
    /** Host or join screen. */
    lobby: function () {
      if (!wsUrl()) { TR.hud.toast('Battle Spend needs the hub server: run npm start.', 'bad'); return; }
      var qsCode = new URLSearchParams(location.search).get('room') || '', name = (window.Hub ? Hub.player().name : TR.save.get('name', '')) || TR.save.get('name', '') || '';
      var s = document.createElement('div'); s.className = 'screen';
      s.innerHTML = '<div class="panel"><h2 class="outlined">Battle Spend</h2><p>$300B each, 8 real minutes, shared stock. First below $1M with no income wins. Otherwise the lowest balance does.</p>' +
        '<p><input class="field" id="n-name" maxlength="18" placeholder="Your name" value="' + esc(name) + '"></p>' +
        '<div class="row"><button class="btn" id="n-host">Host a room</button></div>' +
        '<p style="margin-top:12px"><input class="field" id="n-code" maxlength="4" placeholder="4-letter code" value="' + esc(qsCode) + '" style="text-transform:uppercase"></p>' +
        '<div class="row"><button class="btn alt" id="n-join">Join room</button><button class="btn alt" id="n-back">Back</button></div><p id="n-err" style="color:#ff8a8a"></p></div>';
      TR.menus.close(); TR.menus.ui.appendChild(s); TR.menus.cur = s;
      var err = function (t) { s.querySelector('#n-err').textContent = t; };
      var nm = function () { var v = s.querySelector('#n-name').value.trim() || 'Player'; TR.save.set('name', v); return v; };
      s.querySelector('#n-back').onclick = TR.menus.title;
      s.querySelector('#n-host').onclick = function () {
        if (!net.connect()) return;
        net.link.req('create', { name: nm() }, function (r) { if (r.error) return err(r.error); setSeat({ code: r.code, playerId: r.playerId, token: r.token }); net.me = r.playerId; });
      };
      s.querySelector('#n-join').onclick = function () {
        if (!net.connect()) return;
        net.link.req('join', { name: nm(), code: s.querySelector('#n-code').value }, function (r) { if (r.error) return err(r.error); setSeat({ code: r.code, playerId: r.playerId, token: r.token }); net.me = r.playerId; });
      };
    },
    drawRoom: function () {
      if (!net.room || net.session) return;
      var r = net.room, seat = getSeat(), host = seat && r.host === seat.playerId;
      var link = location.origin + location.pathname + '?room=' + r.code;
      var s = document.createElement('div'); s.className = 'screen';
      s.innerHTML = '<div class="panel"><h2 class="outlined">Room</h2><div class="codebig">' + r.code + '</div><p style="font-size:13px;word-break:break-all">' + esc(link) + '</p>' +
        '<div class="seats">' + r.seats.map(function (x) { return '<div class="seat"><span>' + esc(x.name) + (x.id === r.host ? ' (host)' : '') + (x.bot ? ' (bot)' : '') + '</span><span>' + (x.connected ? 'ready' : 'dropped') + '</span></div>'; }).join('') + '</div>' +
        (host ? '<div class="row"><button class="btn" id="r-start">Start match</button><button class="btn alt" id="r-add">Add bot</button><button class="btn alt" id="r-rem">Remove bot</button></div>' : '<p>Waiting for the host to start.</p>') +
        '<div class="row"><button class="btn alt" id="r-leave">Leave</button></div><p id="n-err" style="color:#ff8a8a"></p></div>';
      TR.menus.close(); TR.menus.ui.appendChild(s); TR.menus.cur = s;
      var a = function (id, fn) { var e = s.querySelector('#' + id); if (e) e.onclick = fn; };
      var res = function (x) { if (x && x.error) s.querySelector('#n-err').textContent = x.error; };
      a('r-start', function () { net.link.req('start', {}, res); });
      a('r-add', function () { net.link.req('addBot', {}, res); });
      a('r-rem', function () { net.link.req('removeBot', {}, res); });
      a('r-leave', function () { setSeat(null); net.link.req('leave'); net.link.close(); net.link = null; net.room = null; TR.menus.title(); });
    },
    /** Daily City board: uses the game server when one answers quickly. */
    dailySubmit: function (day, entry, cb) {
      var url = wsUrl();
      if (!url) return cb(null);
      var done = false, finish = function (r) { if (done) return; done = true; try { l.close(); } catch (e) { /* closing */ } cb(r); };
      var l = new Link(url, function () {}, function () { finish(null); });
      setTimeout(function () { finish(null); }, 1500);
      l.req('daily', { day: day, entry: entry }, finish);
    }
  };
  TR.net.getSeat = getSeat;
  TR.net.clearSeat = function () { setSeat(null); };
})();
