/* Putt Club — transports and snapshot interpolation.
 *
 * Online: Socket.io to games/putt-club/server (authoritative). Offline: the very same PuttMatch runs in this
 * tab (solo practice with bots). Both expose send(cmd) -> Promise<{ok}|{error}>, leave(), kind, playerId and
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

  function createOffline(h, profile, bots) {
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
