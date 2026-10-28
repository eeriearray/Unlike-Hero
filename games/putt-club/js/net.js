/* Putt Club — transports and snapshot interpolation.
 *
 * Online: Socket.io to games/putt-club/server (authoritative). Offline: the very same PuttMatch runs in a
 * Web Worker (js/offline-worker.js; in this tab if workers are unavailable) for solo practice with bots. Both expose send(cmd) -> Promise<{ok}|{error}>, leave(), kind, playerId and
 * call handlers.onState(view), onSnap(snap), onFx(events), onClosed(reason), onStatus(connected).
 *
 * Interp keeps a short buffer of ball snapshots and renders other balls ~100 ms in the past, so they glide
 * smoothly instead of jumping on every packet. */
(function (global) {
  'use strict';
  var PC = global.PC;

  function basePath() { return location.pathname.replace(/[^/]*$/, ''); }
  function onlineAvailable() { return typeof global.io === 'function' && location.protocol !== 'file:'; }

  function createOnline(h) {
    var socket = global.io({ path: basePath() + 'socket.io', transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 });
    var seat = null, closed = false;
    function emit(ev, data) {
      return new Promise(function (resolve) {
        var done = false;
        var timer = setTimeout(function () { if (!done) { done = true; resolve({ error: 'The server did not answer. Check your connection.' }); } }, 8000);
        socket.emit(ev, data, function (res) { if (done) return; done = true; clearTimeout(timer); resolve(res || { error: 'No response.' }); });
      });
    }
    function take(res) {
      if (res && res.ok && res.token) { seat = { code: res.code, playerId: res.playerId, token: res.token }; PC.session.set('seat', seat); }
      return res;
    }
    socket.on('connect', function () {
      h.onStatus(true);
      if (seat) emit('room:resume', seat).then(function (res) { if (res.error) { PC.session.set('seat', null); seat = null; h.onClosed(res.error); } });
    });
    socket.on('disconnect', function () { if (!closed) h.onStatus(false); });
    socket.on('connect_error', function () { h.onStatus(false); });
    socket.on('state', function (v) { h.onState(v); });
    socket.on('snap', function (s) { h.onSnap(s); });
    socket.on('fx', function (list) { h.onFx(list); });
    socket.on('closed', function (d) {
      var reason = d && d.reason;
      seat = null; PC.session.set('seat', null);
      h.onClosed(reason === 'replaced' ? 'This seat was opened in another tab.' : reason === 'kicked' ? 'The host removed you from the room.' : reason === 'idle' ? 'The room closed after being idle.' : 'The room was closed.');
    });
    return {
      kind: 'online',
      create: function (profile) { return emit('room:create', profile).then(take); },
      join: function (code, profile) { return emit('room:join', { code: code, name: profile.name, color: profile.color }).then(take); },
      resume: function (s) { seat = s; return emit('room:resume', s).then(function (res) { if (res.error) { seat = null; PC.session.set('seat', null); } return take(res); }); },
      send: function (cmd) { return emit('cmd', cmd); },
      leave: function () { closed = true; PC.session.set('seat', null); seat = null; emit('room:leave', {}); setTimeout(function () { socket.close(); }, 250); },
      get playerId() { return seat && seat.playerId; },
      get code() { return seat && seat.code; }
    };
  }

  /**
   * Solo practice. The match (physics and bots) runs in a Web Worker so the bots' planning never steals
   * frames from drawing; if workers are unavailable (e.g. opened from file://) it runs on this page.
   */
  function createOffline(h, profile, bots) {
    var worker = null;
    try { if (global.Worker && location.protocol !== 'file:') worker = new Worker('js/offline-worker.js'); } catch (e) { worker = null; }
    if (!worker) return createInPage(h, profile, bots);
    var replies = {}, nextId = 1, closed = false, fallback = null, ready = false;
    function toPage() {
      // The worker failed to start: fall back to running the match here.
      if (closed || fallback || ready) return;
      worker.terminate();
      fallback = createInPage(h, profile, bots);
      Object.keys(replies).forEach(function (id) { replies[id]({ error: 'Try again.' }); });
      replies = {};
    }
    worker.onmessage = function (e) {
      var msg = e.data;
      if (msg.type === 'ready') { ready = true; h.onStatus(true); }
      else if (msg.type === 'state') h.onState(msg.view);
      else if (msg.type === 'snap') h.onSnap(msg.snap);
      else if (msg.type === 'fx') h.onFx(msg.list);
      else if (msg.type === 'reply') { var f = replies[msg.id]; delete replies[msg.id]; if (f) f(msg.res); }
      else if (msg.type === 'error') toPage();
    };
    worker.onerror = function (e) { if (!ready) { e.preventDefault(); toPage(); } };
    worker.postMessage({ type: 'start', profile: { name: profile.name, color: profile.color }, bots: bots });
    return {
      kind: 'offline', playerId: 'me', code: 'SOLO', worker: worker,
      send: function (cmd) {
        if (fallback) return fallback.send(cmd);
        if (closed) return Promise.resolve({ error: 'Game closed.' });
        var id = nextId++;
        return new Promise(function (resolve) { replies[id] = resolve; worker.postMessage({ type: 'cmd', id: id, cmd: cmd }); });
      },
      leave: function () {
        if (fallback) return fallback.leave();
        closed = true; worker.postMessage({ type: 'stop' });
        Object.keys(replies).forEach(function (id) { replies[id]({ error: 'Game closed.' }); });
        replies = {};
      }
    };
  }

  function createInPage(h, profile, bots) {
    var Match = global.PuttMatch, myId = 'me', queued = false, fxq = [], tickN = 0;
    var m = new Match({
      code: 'SOLO',
      hooks: {
        state: function () { if (queued) return; queued = true; setTimeout(function () { queued = false; if (m) h.onState(m.view(myId)); }, 0); },
        fx: function (ev, to) { if (!to || to.indexOf(myId) >= 0) fxq.push(ev); }
      }
    });
    m.botBudget = 2.5; // ms per tick for bot planning, shared with drawing the game on this thread
    m.addPlayer({ id: myId, name: profile.name, color: profile.color });
    for (var i = 0; i < bots; i++) m.addBot(myId);
    var last = performance.now(), acc = 0;
    var timer = setInterval(function () {
      var now = performance.now();
      acc = Math.min(acc + (now - last) / 1000, 0.1); last = now;
      while (acc >= 1 / 60) {
        acc -= 1 / 60; m.tick(1 / 60); tickN++;
        if (m.phase === 'intro' || m.phase === 'play') h.onSnap(m.snapshot());
      }
      if (fxq.length) { var list = fxq; fxq = []; h.onFx(list); }
      if (tickN % 30 === 0 && (m.phase === 'intro' || m.phase === 'play')) h.onState(m.view(myId));
    }, 1000 / 60);
    setTimeout(function () { h.onStatus(true); h.onState(m.view(myId)); }, 0);
    return {
      kind: 'offline', playerId: myId, code: 'SOLO', match: m,
      send: function (cmd) { return Promise.resolve(m ? m.command(myId, cmd) : { error: 'Game closed.' }); },
      leave: function () { clearInterval(timer); m = null; }
    };
  }

  // ---------------------------------------------------------------- interpolation

  function Interp() { this.reset(); }
  Interp.prototype.reset = function () { this.buf = {}; this.offset = null; this.lastT = -1; this.delay = 0.1; };
  Interp.prototype.now = function () { return performance.now() / 1000; };
  Interp.prototype.push = function (snap) {
    if (snap.t < this.lastT - 0.5) this.reset(); // new hole: the hole clock restarted
    this.lastT = snap.t;
    // For the performance readout: the longest real-time gap between snapshots lately.
    var nowS = this.now(); if (this.lastArrive) this.gapMax = Math.max((this.gapMax || 0) * 0.995, nowS - this.lastArrive); this.lastArrive = nowS;
    // Keep the render clock steady: nudge it gently toward each estimate (a little faster toward fresher
    // packets), and only jump when it is far off. A clock that lurches makes balls stall and surge on screen.
    var est = snap.t - this.now();
    if (this.offset == null || Math.abs(est - this.offset) > 0.3) this.offset = est;
    else this.offset += (est - this.offset) * (est > this.offset ? 0.06 : 0.015);
    for (var i = 0; i < snap.b.length; i++) {
      var b = snap.b[i], arr = this.buf[b[0]] || (this.buf[b[0]] = []);
      arr.push({ t: snap.t, x: b[1], y: b[2], z: b[3], r: b[4], flags: b[5], vx: b[6], vz: b[7] });
      if (arr.length > 40) arr.shift();
    }
  };
  /** Estimated current hole time on the server. */
  Interp.prototype.serverNow = function () { return this.offset == null ? 0 : this.now() + this.offset; };
  Interp.prototype.latest = function (id) { var a = this.buf[id]; return a && a.length ? a[a.length - 1] : null; };
  /** Interpolated state of ball id at hole time t. */
  Interp.prototype.sample = function (id, t) {
    var a = this.buf[id];
    if (!a || !a.length) return null;
    if (t <= a[0].t) return a[0];
    for (var i = a.length - 1; i > 0; i--) {
      var p = a[i - 1], q = a[i];
      if (t >= p.t && t <= q.t) {
        var k = q.t > p.t ? (t - p.t) / (q.t - p.t) : 1;
        // A big jump (reset, swap, hazard return) snaps instead of sliding across the course.
        if (Math.hypot(q.x - p.x, q.z - p.z) > 3) return k < 0.5 ? p : q;
        return { t: t, x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, z: p.z + (q.z - p.z) * k, r: p.r + (q.r - p.r) * k, flags: k < 0.5 ? p.flags : q.flags, vx: q.vx, vz: q.vz };
      }
    }
    // Past the newest snapshot: extrapolate a touch, then hold.
    var last = a[a.length - 1], dt = Math.min(0.1, t - last.t);
    if (!(last.flags & 1) || dt <= 0) return last;
    return { t: t, x: last.x + last.vx * dt, y: last.y, z: last.z + last.vz * dt, r: last.r, flags: last.flags, vx: last.vx, vz: last.vz };
  };

  PC.net = { createOnline: createOnline, createOffline: createOffline, onlineAvailable: onlineAvailable, Interp: Interp };
})(window);
