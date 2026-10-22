/*
 * Dragon Clash — online connection to the game server (games/dragon-clash/server/index.mjs).
 * Reconnects by itself and rejoins the room with its token, so a refresh or a network blip doesn't lose your seat.
 */
(function () {
  'use strict';
  var SESSION = 'dragon-clash.session';

  function Net() { this.handlers = {}; this.ws = null; this.want = false; this.code = null; this.token = null; this.queue = []; }

  Net.available = function () { return location.protocol === 'http:' || location.protocol === 'https:'; };
  Net.url = function () {
    var u = new URL('ws', location.href);
    u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    u.hash = ''; u.search = '';
    return u.href;
  };
  Net.saved = function () { try { return JSON.parse(sessionStorage.getItem(SESSION) || 'null'); } catch (e) { return null; } };

  var N = Net.prototype;
  N.on = function (t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); };
  N.fire = function (t, m) { (this.handlers[t] || []).forEach(function (fn) { try { fn(m); } catch (e) { console.error(e); } }); };

  N.connect = function () {
    var self = this;
    this.want = true;
    return new Promise(function (resolve, reject) {
      var ws;
      try { ws = new WebSocket(Net.url()); } catch (e) { reject(e); return; }
      self.ws = ws;
      var opened = false;
      ws.onopen = function () {
        opened = true;
        self.fire('status', 'connected');
        if (self.code && self.token) ws.send(JSON.stringify({ t: 'join', code: self.code, token: self.token }));
        self.queue.splice(0).forEach(function (m) { ws.send(m); });
        resolve();
      };
      ws.onmessage = function (e) {
        var m; try { m = JSON.parse(e.data); } catch (x) { return; }
        if (m.t === 'joined') { self.code = m.code; self.token = m.token; try { sessionStorage.setItem(SESSION, JSON.stringify({ code: m.code, token: m.token })); } catch (x) { /* ignore */ } }
        if (m.t === 'closed') { self.forget(); }
        self.fire(m.t, m);
      };
      ws.onclose = function () {
        self.fire('status', 'disconnected');
        if (!opened) { reject(new Error('Could not reach the game server.')); return; }
        if (self.want) setTimeout(function () { if (self.want) self.connect().catch(function () {}); }, 1200);
      };
      ws.onerror = function () {};
    });
  };

  N.send = function (obj) {
    var s = JSON.stringify(obj);
    if (this.ws && this.ws.readyState === 1) this.ws.send(s);
    else if (obj.t !== 'input') this.queue.push(s);
  };

  N.forget = function () { this.code = null; this.token = null; try { sessionStorage.removeItem(SESSION); } catch (e) { /* ignore */ } };

  N.close = function () { this.want = false; this.forget(); if (this.ws) this.ws.close(); };

  window.DCNet = Net;
})();
