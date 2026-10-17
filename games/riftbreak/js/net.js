/* RIFTBREAK — transports. Both expose the same interface to the UI:
     kind ('online' | 'offline'), send(cmd) -> Promise<{ok}|{error}>, leave()
   and call handlers.onState(view), onClosed(reason), onStatus(connected).
   Online: a WebSocket to games/riftbreak/server (authoritative; other hands never reach this browser).
           Reconnects automatically and resumes the seat with its token, also after a page reload.
   Offline: the same engine runs here with bots — no server or network needed. */
(function (global) {
  'use strict';
  var SEAT_KEY = 'riftbreak.seat';

  function wsUrl() {
    var base = location.pathname.replace(/[^/]*$/, '');
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + base + 'ws';
  }
  function onlinePossible() { return location.protocol === 'http:' || location.protocol === 'https:'; }

  function saveSeat(seat) { try { if (seat) sessionStorage.setItem(SEAT_KEY, JSON.stringify(seat)); else sessionStorage.removeItem(SEAT_KEY); } catch (e) { /* storage blocked */ } }
  function savedSeat() { try { return JSON.parse(sessionStorage.getItem(SEAT_KEY) || 'null'); } catch (e) { return null; } }

  /** Checks whether this hub is running the RIFTBREAK server (resolves true/false within ~2.5 s). */
  function probe() {
    return new Promise(function (resolve) {
      if (!onlinePossible() || typeof WebSocket !== 'function') return resolve(false);
      var done = false, ws;
      var finish = function (v) { if (done) return; done = true; try { ws.close(); } catch (e) { /* closed */ } resolve(v); };
      try { ws = new WebSocket(wsUrl()); } catch (e) { return resolve(false); }
      ws.onopen = function () { finish(true); };
      ws.onerror = function () { finish(false); };
      setTimeout(function () { finish(false); }, 2500);
    });
  }

  function createOnline(h) {
    var ws = null, rid = 0, pending = {}, seat = null, closedByUs = false, retry = 0, retryTimer = null, queue = [];
    function connect() {
      try { ws = new WebSocket(wsUrl()); } catch (e) { schedule(); return; }
      ws.onopen = function () {
        retry = 0;
        h.onStatus(true);
        var flush = queue; queue = [];
        if (seat) {
          // Re-attach to our seat after a dropped connection, then send anything that queued meanwhile.
          raw('resume', seat).then(function (res) {
            if (res.error) { seat = null; saveSeat(null); h.onClosed(res.error); return; }
            flush.forEach(function (f) { f(); });
          });
        } else flush.forEach(function (f) { f(); });
      };
      ws.onmessage = function (ev) {
        var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'reply' && pending[m.rid]) { var p = pending[m.rid]; delete pending[m.rid]; p(m.res || { error: 'No response.' }); }
        else if (m.t === 'state') h.onState(m.view);
        else if (m.t === 'closed') {
          if (m.reason === 'replaced') { seat = null; closedByUs = true; h.onClosed('This seat was opened in another tab.'); return; }
          seat = null; saveSeat(null); h.onClosed(m.reason === 'idle' ? 'The room closed after being idle.' : 'The room was closed.');
        }
      };
      ws.onclose = function () {
        h.onStatus(false);
        for (var k in pending) { pending[k]({ error: 'Connection lost. Reconnecting…' }); }
        pending = {};
        if (!closedByUs) schedule();
      };
      ws.onerror = function () { /* onclose follows */ };
    }
    function schedule() {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(connect, Math.min(8000, 400 * Math.pow(1.7, retry++)));
    }
    function raw(t, data) {
      return new Promise(function (resolve) {
        var id = ++rid, done = false;
        var timer = setTimeout(function () { if (done) return; done = true; delete pending[id]; resolve({ error: 'The server did not answer. Check your connection.' }); }, 8000);
        pending[id] = function (res) { if (done) return; done = true; clearTimeout(timer); resolve(res); };
        var msg = { t: t, rid: id };
        for (var k in data) msg[k] = data[k];
        ws.send(JSON.stringify(msg));
      });
    }
    function req(t, data) {
      if (ws && ws.readyState === 1) return raw(t, data || {});
      return new Promise(function (resolve) { queue.push(function () { raw(t, data || {}).then(resolve); }); });
    }
    function take(res) {
      if (res && res.ok && res.token) { seat = { code: res.code, playerId: res.playerId, token: res.token }; saveSeat(seat); }
      return res;
    }
    connect();
    return {
      kind: 'online',
      create: function (profile, settings) { return req('create', { name: profile.name, avatar: profile.avatar, settings: settings }).then(take); },
      join: function (code, profile) { return req('join', { code: code, name: profile.name, avatar: profile.avatar }).then(take); },
      resume: function (s) { return req('resume', s).then(function (res) { if (res.error) saveSeat(null); return take(res); }); },
      send: function (cmd) { return req('cmd', { cmd: cmd }); },
      leave: function () { var s = seat; seat = null; saveSeat(null); closedByUs = true; clearTimeout(retryTimer); if (s && ws && ws.readyState === 1) raw('leave', {}).then(function () { ws.close(); }); else if (ws) ws.close(); },
      get playerId() { return seat && seat.playerId; },
      get code() { return seat && seat.code; }
    };
  }

  function createOffline(h, profile, settings) {
    var E = global.RiftEngine, myId = 'me', queued = false, game, seen = 0, round = -1;
    game = new E.RiftGame({
      code: 'SOLO',
      settings: settings,
      hooks: {
        sync: function () {
          if (queued) return; queued = true;
          setTimeout(function () {
            queued = false;
            if (!game) return;
            var view = game.viewFor(myId, round === game.round ? seen : null);
            if (view.match && view.match.events.length) seen = view.match.events[view.match.events.length - 1].seq;
            round = game.round;
            h.onState(view);
          }, 0);
        }
      }
    });
    game.addPlayer({ id: myId, name: profile.name, avatar: profile.avatar });
    h.onStatus(true);
    return {
      kind: 'offline',
      playerId: myId,
      code: null,
      game: game,
      send: function (cmd) { return Promise.resolve(game ? game.command(myId, cmd) : { error: 'Game closed.' }); },
      leave: function () { if (game) game.destroy(); game = null; }
    };
  }

  global.RiftNet = { createOnline: createOnline, createOffline: createOffline, probe: probe, savedSeat: savedSeat, saveSeat: saveSeat, onlinePossible: onlinePossible };
})(window);
