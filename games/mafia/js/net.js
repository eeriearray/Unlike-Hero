/* Mafia — transports. Both expose the same interface to the UI:
     send(cmd) -> Promise<{ok}|{error}>, leave(), kind ('online' | 'offline')
   and call handlers.onState(view), onChat(msg), onChatHistory(map), onFx(data), onClosed(reason), onStatus(connected).
   Online: Socket.io to games/mafia/server (authoritative; secrets never reach this browser).
   Offline: the same engine runs here with bots — single player, no server needed. */
(function (global) {
  'use strict';
  var SEAT_KEY = 'mafia.seat';

  function basePath() { return location.pathname.replace(/[^/]*$/, ''); }
  function onlineAvailable() { return typeof global.io === 'function' && location.protocol !== 'file:'; }

  function saveSeat(seat) { try { if (seat) sessionStorage.setItem(SEAT_KEY, JSON.stringify(seat)); else sessionStorage.removeItem(SEAT_KEY); } catch (e) { /* storage blocked */ } }
  function savedSeat() { try { return JSON.parse(sessionStorage.getItem(SEAT_KEY) || 'null'); } catch (e) { return null; } }

  function createOnline(h) {
    var socket = global.io({ path: basePath() + 'socket.io', transports: ['websocket', 'polling'] });
    var seat = null;
    function emit(ev, data) {
      return new Promise(function (resolve) {
        var done = false;
        var timer = setTimeout(function () { if (!done) { done = true; resolve({ error: 'The server did not answer. Check your connection.' }); } }, 8000);
        socket.emit(ev, data, function (res) { if (done) return; done = true; clearTimeout(timer); resolve(res || { error: 'No response.' }); });
      });
    }
    function take(res) {
      if (res && res.ok && res.token) { seat = { code: res.code, playerId: res.playerId, token: res.token }; saveSeat(seat); }
      return res;
    }
    socket.on('connect', function () {
      h.onStatus(true);
      // Re-attach to our seat after a dropped connection.
      if (seat) emit('room:resume', seat).then(function (res) { if (res.error) { saveSeat(null); seat = null; h.onClosed(res.error); } });
    });
    socket.on('disconnect', function () { h.onStatus(false); });
    socket.on('state', function (v) { h.onState(v); });
    socket.on('chat', function (m) { h.onChat(m); });
    socket.on('chat:history', function (m) { h.onChatHistory(m); });
    socket.on('fx', function (d) { h.onFx(d); });
    socket.on('closed', function (d) {
      if (d && d.reason === 'replaced') { seat = null; h.onClosed('This seat was opened in another tab.'); return; }
      saveSeat(null); seat = null; h.onClosed(d && d.reason === 'idle' ? 'The room closed after being idle.' : 'The room was closed.');
    });
    return {
      kind: 'online',
      create: function (profile) { return emit('room:create', profile).then(take); },
      join: function (code, profile) { return emit('room:join', { code: code, name: profile.name, avatar: profile.avatar }).then(take); },
      resume: function (s) { seat = s; return emit('room:resume', s).then(function (res) { if (res.error) { seat = null; saveSeat(null); } return take(res); }); },
      send: function (cmd) { return emit('cmd', cmd); },
      leave: function () { saveSeat(null); seat = null; emit('room:leave', {}); setTimeout(function () { socket.close(); }, 200); },
      get playerId() { return seat && seat.playerId; }
    };
  }

  function createOffline(h, profile, bots) {
    var E = global.MafiaEngine, myId = 'me', queued = false, game;
    game = new E.MafiaGame({
      code: 'OFFLINE',
      hooks: {
        sync: function () {
          if (queued) return; queued = true;
          setTimeout(function () { queued = false; if (game) h.onState(game.viewFor(myId)); }, 0);
        },
        chat: function (msg, recipients) { if (recipients.indexOf(myId) >= 0) h.onChat(msg); },
        fx: function (_r, d) { h.onFx(d); },
        chatReset: function () { if (game) h.onChatHistory(game.chatHistoryFor(myId)); }
      }
    });
    game.addPlayer({ id: myId, name: profile.name, avatar: profile.avatar });
    for (var i = 0; i < bots; i++) game.addBot(myId);
    h.onStatus(true);
    h.onChatHistory(game.chatHistoryFor(myId));
    return {
      kind: 'offline',
      playerId: myId,
      send: function (cmd) { return Promise.resolve(game ? game.command(myId, cmd) : { error: 'Game closed.' }); },
      leave: function () { if (game) game.destroy(); game = null; }
    };
  }

  global.MafiaNet = { createOnline: createOnline, createOffline: createOffline, onlineAvailable: onlineAvailable, savedSeat: savedSeat, saveSeat: saveSeat };
})(window);
