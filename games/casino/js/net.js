/* Neon Casino — connection to the casino server (games/casino/server). The server is the bank: this file only
   sends intents and receives this player's view. There is no offline mode, because a browser can't be trusted
   with its own balance.
     create(profile) / join(code, profile) / resume() -> Promise<{ok}|{error}>
     send(cmd) -> Promise<{ok, ...}|{error}>, leave()
   Handlers: onState(view), onFx(data), onStatus('connecting'|'online'|'offline'), onClosed(message). */
(function (global) {
  'use strict';
  var SEAT_KEY = 'casino.seat';        // sessionStorage: this tab's seat (survives refresh)
  var DEVICE_KEY = 'casino.device';    // localStorage: this browser's key, so rejoining finds the same seat
  var LAST_KEY = 'casino.lastRoom';    // localStorage: offer "rejoin" on the entrance

  function basePath() { return location.pathname.replace(/[^/]*$/, ''); }
  function available() { return typeof global.io === 'function' && location.protocol !== 'file:'; }
  function read(store, key) { try { return JSON.parse(store.getItem(key) || 'null'); } catch (e) { return null; } }
  function write(store, key, v) { try { if (v == null) store.removeItem(key); else store.setItem(key, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }

  function deviceKey() {
    var k = read(localStorage, DEVICE_KEY);
    if (typeof k === 'string' && k.length >= 16) return k;
    var bytes = new Uint8Array(18);
    (global.crypto || global.msCrypto).getRandomValues(bytes);
    k = Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    write(localStorage, DEVICE_KEY, k);
    return k;
  }

  function create(h) {
    var socket = global.io({ path: basePath() + 'socket.io', transports: ['websocket', 'polling'], tryAllTransports: true, reconnectionDelayMax: 4000 });
    var seat = read(sessionStorage, SEAT_KEY);
    h.onStatus('connecting');

    function emit(ev, data) {
      return new Promise(function (resolve) {
        var done = false;
        var timer = setTimeout(function () { if (!done) { done = true; resolve({ error: 'The casino server did not answer. Check your connection and try again.' }); } }, 8000);
        socket.emit(ev, data, function (res) { if (done) return; done = true; clearTimeout(timer); resolve(res || { error: 'No response from the server.' }); });
      });
    }
    function take(res) {
      if (res && res.ok && res.token) {
        seat = { code: res.code, playerId: res.playerId, token: res.token };
        write(sessionStorage, SEAT_KEY, seat);
        write(localStorage, LAST_KEY, res.code);
      }
      return res;
    }
    function drop(message) { seat = null; write(sessionStorage, SEAT_KEY, null); h.onClosed(message); }

    socket.on('connect', function () {
      h.onStatus('online');
      if (seat) emit('room:resume', seat).then(function (res) { if (res.error) drop(res.error); });
    });
    socket.on('disconnect', function () { h.onStatus('offline'); });
    socket.on('connect_error', function (err) { if (err && /Too many/.test(err.message)) h.onClosed(err.message); });
    socket.io.on('reconnect_attempt', function () { h.onStatus('connecting'); });
    socket.on('state', function (v) { h.onState(v); });
    socket.on('fx', function (d) { h.onFx(d); });
    socket.on('closed', function (d) {
      var r = d && d.reason;
      if (r === 'left') return drop(null);
      drop(r === 'idle' ? 'The room closed after a day without visitors.' : 'The room was closed.');
    });

    var profile = function (p) { return { name: p.name, avatar: p.avatar, deviceKey: deviceKey() }; };
    return {
      hasSeat: function () { return !!seat; },
      create: function (p) { return emit('room:create', profile(p)).then(take); },
      join: function (code, p) { var d = profile(p); d.code = code; return emit('room:join', d).then(take); },
      send: function (cmd) { return emit('cmd', cmd); },
      leave: function () { return emit('room:leave', {}).then(function () { write(localStorage, LAST_KEY, null); drop(null); }); }
    };
  }

  global.CasinoNet = {
    available: available,
    create: create,
    lastRoom: function () { return read(localStorage, LAST_KEY); }
  };
})(window);
