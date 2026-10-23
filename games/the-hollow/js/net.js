/* THE HOLLOW — transports. Both expose the same interface to the UI:
     send(cmd) -> Promise<{ok}|{error}>, leave(), kind ('online' | 'offline'), playerId
   and call handlers.onState(view), onCatalog(cat), onClosed(reason), onStatus('connected'|'reconnecting'|'offline').
   Online:  Socket.io to games/the-hollow/server (authoritative; secrets never reach this browser). Reconnects by seat token.
   Offline: the very same engine runs in this tab (solo, with optional AI ghost companions). Saved to this browser
            after every change, so a refresh does not lose the expedition. */
(function (g) {
  'use strict';
  var SEAT = 'hollow.seat', LAST = 'hollow.lastseat', SAVE = 'hollow.solo.v1';

  function basePath() { return location.pathname.replace(/[^/]*$/, ''); }
  function onlineAvailable() { return typeof g.io === 'function' && location.protocol !== 'file:'; }
  function put(store, k, v) { try { if (v) store.setItem(k, JSON.stringify(v)); else store.removeItem(k); } catch (e) { /* storage blocked */ } }
  function get(store, k) { try { return JSON.parse(store.getItem(k) || 'null'); } catch (e) { return null; } }

  function createOnline(h) {
    var socket = g.io({ path: basePath() + 'socket.io', transports: ['websocket', 'polling'], tryAllTransports: true, reconnectionDelayMax: 4000, timeout: 12000 });
    // ready: connected AND this socket holds our seat on the server. Commands wait for it, so a command made during
    // a drop is sent after the seat is back instead of failing (and a retry carries the same id, so it never applies twice).
    var seat = null, closedByUs = false, ready = false, waiters = [], resuming = null, retryT = 0;
    var CMD_PATIENCE = 60000;
    function emit(ev, data, ms) {
      return new Promise(function (resolve) {
        var done = false;
        var timer = setTimeout(function () { if (!done) { done = true; resolve({ error: 'The server did not answer. Check your connection.', offline: true }); } }, ms || 9000);
        socket.emit(ev, data, function (res) { if (done) return; done = true; clearTimeout(timer); resolve(res || { error: 'No response.' }); });
      });
    }
    function setReady(on) {
      ready = on;
      if (!on) return;
      var w = waiters; waiters = [];
      w.forEach(function (f) { f(); });
    }
    function whenReady(until) {
      if (ready || closedByUs) return Promise.resolve();
      return new Promise(function (resolve) {
        var t = setTimeout(function () { waiters = waiters.filter(function (f) { return f !== go; }); resolve(); }, Math.max(0, until - Date.now()));
        function go() { clearTimeout(t); resolve(); }
        waiters.push(go);
      });
    }
    function forget() { seat = null; setReady(false); put(sessionStorage, SEAT, null); put(localStorage, LAST, null); }
    function take(res) {
      if (res && res.ok && res.token) {
        seat = { code: res.code, playerId: res.playerId, token: res.token };
        put(sessionStorage, SEAT, seat); put(localStorage, LAST, Object.assign({ at: Date.now() }, seat));
        if (res.catalog) h.onCatalog(res.catalog);
        if (socket.connected) setReady(true);
      }
      return res;
    }
    // Ask the server for our seat on this socket. notify: tell the UI if the seat is gone (an automatic resume).
    function resumeSeat(notify) {
      if (!seat) return Promise.resolve({ error: 'No seat.' });
      if (resuming) return resuming;
      var mine = seat;
      resuming = emit('room:resume', mine, 8000).then(function (res) {
        resuming = null;
        if (closedByUs || seat !== mine) return res;
        if (res.ok) { take(res); h.onStatus('connected'); }
        else if (!res.offline) { forget(); if (notify) h.onClosed(res.error); }
        else if (socket.connected) { clearTimeout(retryT); retryT = setTimeout(function () { if (!ready) resumeSeat(notify); }, 1500); }
        return res;
      });
      return resuming;
    }
    socket.on('connect', function () {
      if (seat) resumeSeat(true);
      else h.onStatus('connected');
    });
    socket.on('disconnect', function () { setReady(false); if (!closedByUs) h.onStatus('reconnecting'); });
    socket.on('connect_error', function () { if (!closedByUs) h.onStatus('reconnecting'); });
    socket.on('state', function (v) { h.onState(v); });
    socket.on('closed', function (d) {
      var r = d && d.reason;
      if (r === 'shutdown') { setReady(false); return; }   // the server is restarting; our seat comes back with it
      if (r === 'replaced') { seat = null; setReady(false); put(sessionStorage, SEAT, null); h.onClosed('This seat was opened in another tab or device.'); return; }
      forget();
      h.onClosed(r === 'idle' ? 'The expedition closed after being idle.' : r === 'ended' ? 'The expedition has ended.' : 'The expedition was closed.');
    });

    // Phones drop or freeze the connection while the screen is off or the tab is in the background, and Wi-Fi can come
    // back before the socket notices. When the page is back, reconnect at once, or check the link is alive and refresh.
    var lastWake = 0;
    function wake() {
      if (closedByUs || document.visibilityState === 'hidden') return;
      if (Date.now() - lastWake < 2000) return;
      lastWake = Date.now();
      if (!socket.connected) { if (!socket.active) socket.connect(); return; }
      if (!seat || resuming) return;
      emit('room:resume', seat, 5000).then(function (res) {
        if (closedByUs) return;
        if (res.ok) take(res);
        else if (res.offline) { setReady(false); h.onStatus('reconnecting'); socket.disconnect(); socket.connect(); }   // a dead link that still looked open
        else { forget(); h.onClosed(res.error); }
      });
    }
    document.addEventListener('visibilitychange', wake);
    g.addEventListener('online', wake);
    g.addEventListener('pageshow', wake);
    g.addEventListener('focus', wake);
    g.addEventListener('offline', function () { if (!closedByUs) h.onStatus('reconnecting'); });

    return {
      kind: 'online',
      create: function (profile) { return emit('room:create', profile, 15000).then(take); },
      join: function (code, profile) { return emit('room:join', { code: code, name: profile.name }, 15000).then(take); },
      resume: function (s) { seat = s; return resumeSeat(false); },
      send: function (cmd) {
        cmd.cid = cmd.cid || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
        var until = Date.now() + CMD_PATIENCE;
        function attempt() {
          return whenReady(until).then(function () {
            if (closedByUs) return { error: 'You have left the expedition.' };
            if (!ready) return { error: 'Could not reach the Hollow. Your seat is kept: try again when you are back online.', offline: true };
            return emit('cmd', cmd).then(function (res) { return res.offline && !closedByUs && Date.now() < until ? attempt() : res; });
          });
        }
        return attempt();
      },
      // keepSeat: leaving a game under way keeps the seat on the server, so the title screen can offer the way back
      leave: function (keepSeat) {
        closedByUs = true; clearTimeout(retryT);
        document.removeEventListener('visibilitychange', wake);
        g.removeEventListener('online', wake); g.removeEventListener('pageshow', wake); g.removeEventListener('focus', wake);
        put(sessionStorage, SEAT, null);
        put(localStorage, LAST, keepSeat && seat ? Object.assign({ at: Date.now() }, seat) : null);   // ours, not another tab's
        seat = null; setReady(true);   // let any waiting command finish (with an error)
        if (socket.connected) emit('room:leave', {}, 2000).then(function () { socket.close(); });
        else socket.close();
      },
      get playerId() { return seat && seat.playerId; }
    };
  }

  var ENGINE_FILES = ['engine/data/core.js', 'engine/data/story.js', 'engine/data/loc-village.js', 'engine/data/loc-estate.js', 'engine/data/loc-woods.js', 'engine/data/loc-abbey.js', 'engine/data/loc-deep.js', 'engine/data/map.js', 'engine/data/events.js', 'engine/core.js', 'engine/rules.js', 'engine/world.js', 'engine/finale.js', 'engine/view.js'];
  function loadEngine() {
    if (g.HollowEngine && g.HollowEngine.HollowGame && g.HollowEngine.catalog) return Promise.resolve();
    return ENGINE_FILES.reduce(function (p, src) {
      return p.then(function () { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Could not load ' + src)); }; document.head.appendChild(s); }); });
    }, Promise.resolve());
  }

  function createOffline(h, profile, opts) {
    opts = opts || {};
    var E = g.HollowEngine, myId = 'me', queued = false, game, timer, saveT;
    function push() { if (game) h.onState(game.viewFor(myId)); }
    function persist() {
      clearTimeout(saveT);
      saveT = setTimeout(function () { if (game && game.phase !== 'ended') put(localStorage, SAVE, { at: Date.now(), snap: game.snapshot() }); else put(localStorage, SAVE, null); }, 400);
    }
    var hooks = { sync: function () { if (queued) return; queued = true; setTimeout(function () { queued = false; push(); persist(); }, 0); } };
    if (opts.snap) {
      game = E.HollowGame.restore(opts.snap, { hooks: hooks });
      game.setConnected(myId, true);
    } else {
      game = new E.HollowGame({ code: 'SOLO', hooks: hooks });
      game.addPlayer({ id: myId, name: profile.name });
    }
    // Development aid: open the game with ?dev=1 to get the live engine object in the console (solo mode only).
    if (/[?&]dev=1/.test(location.search)) g.HollowDev = { game: function () { return game; }, push: push };
    timer = setInterval(function () { if (game) { game.tick(); } }, 1000);
    setTimeout(function () { if (!game) return; h.onCatalog(E.catalog()); h.onStatus('offline'); push(); }, 0);   // after the caller has stored this transport
    return {
      kind: 'offline', playerId: myId,
      send: function (cmd) { return Promise.resolve(game ? game.command(myId, cmd) : { error: 'Game closed.' }); },
      leave: function () { clearInterval(timer); if (game) game.destroy(); game = null; },
      abandon: function () { put(localStorage, SAVE, null); }
    };
  }

  g.HollowNet = {
    createOnline: createOnline, createOffline: createOffline, loadEngine: loadEngine, onlineAvailable: onlineAvailable,
    savedSeat: function () { return get(sessionStorage, SEAT); }, lastSeat: function () { var s = get(localStorage, LAST); return s && Date.now() - s.at < 6 * 3600e3 ? s : null; },
    clearSeat: function () { put(sessionStorage, SEAT, null); put(localStorage, LAST, null); },
    savedSolo: function () { var s = get(localStorage, SAVE); return s && Date.now() - s.at < 7 * 86400e3 ? s : null; }, clearSolo: function () { put(localStorage, SAVE, null); }
  };
})(window);
