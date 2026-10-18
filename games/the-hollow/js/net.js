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
    var socket = g.io({ path: basePath() + 'socket.io', transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 });
    var seat = null, closedByUs = false;
    function emit(ev, data) {
      return new Promise(function (resolve) {
        var done = false;
        var timer = setTimeout(function () { if (!done) { done = true; resolve({ error: 'The server did not answer. Check your connection.', offline: true }); } }, 9000);
        socket.emit(ev, data, function (res) { if (done) return; done = true; clearTimeout(timer); resolve(res || { error: 'No response.' }); });
      });
    }
    function take(res) {
      if (res && res.ok && res.token) {
        seat = { code: res.code, playerId: res.playerId, token: res.token };
        put(sessionStorage, SEAT, seat); put(localStorage, LAST, Object.assign({ at: Date.now() }, seat));
        if (res.catalog) h.onCatalog(res.catalog);
      }
      return res;
    }
    socket.on('connect', function () {
      h.onStatus('connected');
      if (seat) emit('room:resume', seat).then(function (res) { if (res.error && !res.offline) { put(sessionStorage, SEAT, null); put(localStorage, LAST, null); seat = null; h.onClosed(res.error); } else if (res.ok) take(res); });
    });
    socket.on('disconnect', function () { if (!closedByUs) h.onStatus('reconnecting'); });
    socket.on('connect_error', function () { if (!closedByUs) h.onStatus('reconnecting'); });
    socket.on('state', function (v) { h.onState(v); });
    socket.on('closed', function (d) {
      var r = d && d.reason;
      if (r === 'replaced') { seat = null; put(sessionStorage, SEAT, null); h.onClosed('This seat was opened in another tab or device.'); return; }
      put(sessionStorage, SEAT, null); put(localStorage, LAST, null); seat = null;
      h.onClosed(r === 'idle' ? 'The expedition closed after being idle.' : r === 'ended' ? 'The expedition has ended.' : 'The expedition was closed.');
    });
    return {
      kind: 'online',
      create: function (profile) { return emit('room:create', profile).then(take); },
      join: function (code, profile) { return emit('room:join', { code: code, name: profile.name }).then(take); },
      resume: function (s) { seat = s; return emit('room:resume', s).then(function (res) { if (res.error && !res.offline) { seat = null; put(sessionStorage, SEAT, null); } return take(res); }); },
      send: function (cmd) { cmd.cid = cmd.cid || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)); return emit('cmd', cmd); },
      leave: function () { closedByUs = true; put(sessionStorage, SEAT, null); put(localStorage, LAST, null); seat = null; emit('room:leave', {}); setTimeout(function () { socket.close(); }, 200); },
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
