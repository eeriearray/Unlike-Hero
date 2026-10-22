/*!
 * Hub SDK v1 — the contract between a game and the game hub.
 *
 * A game works three ways with no code changes:
 *   1. opened directly as a file or page (standalone),
 *   2. inside the hub launcher (index.html at the repo root, in an iframe),
 *   3. on a future hosted platform that speaks the same postMessage protocol.
 *
 * Load order in a game:
 *   <script src="../../shared/sdk/hub-config.js"></script>   (optional, server may generate it)
 *   <script src="../../shared/sdk/hub-sdk.js"></script>
 *   const hub = window.Hub ? Hub.init({ id: 'my-game', version: '1.0.0' }) : null;
 *
 * Every call is safe when the hub is absent; always guard with `window.Hub`.
 * Full API notes live in docs/ARCHITECTURE.md.
 */
(function (global) {
  'use strict';
  var SDK_VERSION = '1.0.0';
  // iPhone/iPad sound: play through Silent mode and unlock on the right gesture (see ios-audio.js next to this file)
  (function () {
    var me = document.currentScript && document.currentScript.src;
    if (!me || global.__hubIosAudio) return;
    var s = document.createElement('script'); s.src = me.replace(/hub-sdk\.js(\?.*)?$/, 'ios-audio.js'); (document.head || document.documentElement).appendChild(s);
  })();
  var qs = new URLSearchParams(location.search);
  var inFrame = (function () { try { return global.parent !== global; } catch (e) { return true; } })();
  // One id per open page, so two tabs of the same browser (same player) still hear each other.
  var CONN = 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  var safe = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };

  // Config precedence: ?relay= query  >  hub-config.js (server-generated)  >  saved hub setting
  var cfg = global.HUB_CONFIG || {};
  var config = {
    relayUrl: qs.get('relay') || cfg.relayUrl || safe.get('hub.relayUrl', '') || '',
    hubUrl: qs.get('hub') || cfg.hubUrl || null
  };

  function player() {
    var p = safe.get('hub.player', null);
    if (!p || !p.id) { p = { id: 'p_' + Math.random().toString(36).slice(2, 10), name: 'Player' }; safe.set('hub.player', p); }
    return p;
  }

  function post(type, payload) {
    if (!inFrame) return;
    var msg = { source: 'hub-game', sdk: SDK_VERSION, type: type, gameId: Hub.gameId };
    for (var k in payload) msg[k] = payload[k];
    try { global.parent.postMessage(msg, '*'); } catch (e) { /* parent gone */ }
  }

  var Hub = {
    sdkVersion: SDK_VERSION,
    gameId: null,
    meta: null,
    inHub: inFrame || qs.has('hub'),
    config: config,

    /** Register the game. meta: { id, version, title? } */
    init: function (meta) { this.gameId = meta.id; this.meta = meta; post('ready', { meta: meta }); return this; },

    /** The local player: { id, name }. Name is set from the hub launcher. */
    player: player,

    /** Namespaced storage so games never collide: storage().get(key, default) / .set(key, value) */
    storage: function (ns) {
      var p = 'hub.' + (ns || this.gameId) + '.';
      return { get: function (k, d) { return safe.get(p + k, d); }, set: function (k, v) { safe.set(p + k, v); } };
    },

    /**
     * Report a game event to the hub. Standard events:
     *   'session-start' { mode, level }
     *   'session-end'   { result: 'win'|'lose'|'quit', score?, durationMs?, ...anything }
     */
    report: function (event, data) {
      post('event', { event: event, data: data || {} });
      if (event === 'session-end') {
        var log = safe.get('hub.sessions', []);
        log.unshift({ gameId: this.gameId, title: this.meta && this.meta.title, at: Date.now(), data: data || {} });
        safe.set('hub.sessions', log.slice(0, 50));
      }
    },

    /** Leave the game and return to the hub (or the hub page when standalone). */
    exit: function () {
      if (inFrame) { post('exit', {}); return; }
      location.href = config.hubUrl || '../../index.html';
    },

    /**
     * Join a multiplayer room. Everyone who joins the same name hears each other.
     * Transport is picked automatically:
     *   'relay' — WebSocket relay (server/relay.mjs) when relayUrl is configured: works across devices
     *   'local' — BroadcastChannel: tabs and windows of the same browser (served over http)
     * Returns: { on(topic, fn), emit(topic, data), presence(state), peers(), leave(), transport }
     * Built-in topics: 'peers' (list changed), 'status' ('connected'|'disconnected', relay only).
     */
    room: function (name, opts) { return createRoom(name, opts || {}); }
  };

  function createRoom(name, opts) {
    var me = player(), handlers = {}, peers = {}, transport = null, presenceState = null;
    function fire(topic) {
      var args = Array.prototype.slice.call(arguments, 1);
      (handlers[topic] || []).forEach(function (fn) { try { fn.apply(null, args); } catch (e) { console.error(e); } });
    }
    function send(m) { m.from = CONN; m.player = me.id; m.name = me.name; m.room = name; if (transport) transport.send(m); }
    function deliver(m) {
      if (!m || m.from === CONN || m.room !== name) return;
      if (m.t === 'hello' || m.t === 'presence') {
        var isNew = !peers[m.from];
        peers[m.from] = { id: m.from, player: m.player, name: m.name, state: m.state, seen: Date.now() };
        fire('peers', room.peers());
        if (m.t === 'hello' || isNew) send({ t: 'presence', state: presenceState });
      } else if (m.t === 'leave') { delete peers[m.from]; fire('peers', room.peers()); }
      else if (m.t === 'msg') { if (m.to && m.to !== CONN) return; fire(m.topic, m.data, { id: m.from, player: m.player, name: m.name }); }
    }
    var room = {
      name: name, me: me, transport: 'none',
      on: function (topic, fn) { (handlers[topic] = handlers[topic] || []).push(fn); return function () { handlers[topic] = handlers[topic].filter(function (f) { return f !== fn; }); }; },
      emit: function (topic, data) { send({ t: 'msg', topic: topic, data: data }); },
      /** Send to one member only (its connection id: the `id` a handler receives as the sender). The relay
          delivers it to that socket alone, so other players never receive it. */
      emitTo: function (connId, topic, data) { send({ t: 'msg', topic: topic, data: data, to: connId }); },
      presence: function (state) { presenceState = state; send({ t: 'presence', state: state }); },
      peers: function () { return Object.keys(peers).map(function (k) { return peers[k]; }); },
      leave: function () { send({ t: 'leave' }); if (transport) transport.close(); transport = null; }
    };
    var want = opts.transport || (config.relayUrl ? 'relay' : 'local');
    transport = want === 'relay' && config.relayUrl ? relayTransport(name, deliver, fire) : localTransport(name, deliver);
    room.transport = transport.kind;
    setTimeout(function () { send({ t: 'hello' }); }, 0);
    return room;
  }

  function localTransport(name, deliver) {
    if (!('BroadcastChannel' in global)) return { kind: 'none', send: function () {}, close: function () {} };
    var ch = new BroadcastChannel('hub-room:' + name);
    ch.onmessage = function (e) { deliver(e.data); };
    return { kind: 'local', send: function (m) { ch.postMessage(m); }, close: function () { ch.close(); } };
  }

  function relayTransport(name, deliver, fire) {
    var ws = null, queue = [], closed = false, tries = 0;
    function open() {
      var url = config.relayUrl + (config.relayUrl.indexOf('?') < 0 ? '?' : '&') + 'room=' + encodeURIComponent(name);
      ws = new WebSocket(url);
      ws.onopen = function () { tries = 0; fire('status', 'connected'); queue.splice(0).forEach(function (s) { ws.send(s); }); };
      ws.onmessage = function (e) { try { deliver(JSON.parse(e.data)); } catch (err) { /* ignore malformed */ } };
      ws.onclose = function () { fire('status', 'disconnected'); if (!closed) setTimeout(open, Math.min(8000, 500 * Math.pow(2, tries++))); };
    }
    open();
    return {
      kind: 'relay',
      send: function (m) { var s = JSON.stringify(m); if (ws && ws.readyState === 1) ws.send(s); else queue.push(s); },
      close: function () { closed = true; if (ws) ws.close(); }
    };
  }

  global.Hub = Hub;
})(window);
