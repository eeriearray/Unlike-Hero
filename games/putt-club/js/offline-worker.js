/* Putt Club — solo practice match in a Web Worker.
 *
 * The authoritative simulation and the bots' shot planning (which runs hundreds of physics predictions per
 * shot) live here, off the page's main thread, so drawing stays smooth however many bots play. The page
 * talks to it through PC.net.createOffline, with the same messages an online room sends.
 *
 * page -> worker: { type: 'start', profile, bots } | { type: 'cmd', id, cmd } | { type: 'stop' }
 * worker -> page: { type: 'ready' } | { type: 'state', view } | { type: 'snap', snap } | { type: 'fx', list }
 *                 | { type: 'reply', id, res } | { type: 'error', message }
 */
'use strict';
self.window = self; // vendor/rapier.js publishes itself as window.RAPIER
importScripts('../vendor/rapier.js', '../engine/physics.js', '../engine/courses.js', '../engine/powerups.js', '../engine/ai.js', '../engine/match.js');

var m = null, myId = 'me', timer = 0, pending = [];

function post(msg) { self.postMessage(msg); }

function start(profile, bots) {
  var queued = false, fxq = [], tickN = 0;
  m = new self.PuttMatch({
    code: 'SOLO',
    hooks: {
      state: function () { if (queued) return; queued = true; setTimeout(function () { queued = false; if (m) post({ type: 'state', view: m.view(myId) }); }, 0); },
      fx: function (ev, to) { if (!to || to.indexOf(myId) >= 0) fxq.push(ev); }
    }
  });
  // This thread draws nothing, so the bots may think for half of every tick.
  m.botBudget = 8;
  m.addPlayer({ id: myId, name: profile.name, color: profile.color });
  for (var i = 0; i < bots; i++) m.addBot(myId);
  var last = performance.now(), acc = 0;
  timer = setInterval(function () {
    var now = performance.now();
    acc = Math.min(acc + (now - last) / 1000, 0.1); last = now;
    while (acc >= 1 / 60) {
      acc -= 1 / 60; m.tick(1 / 60); tickN++;
      if (m.phase === 'intro' || m.phase === 'play') post({ type: 'snap', snap: m.snapshot() });
    }
    if (fxq.length) { var list = fxq; fxq = []; post({ type: 'fx', list: list }); }
    if (tickN % 30 === 0 && (m.phase === 'intro' || m.phase === 'play')) post({ type: 'state', view: m.view(myId) });
  }, 1000 / 60);
  post({ type: 'ready' });
  post({ type: 'state', view: m.view(myId) });
  pending.forEach(handle); pending = [];
}

function handle(msg) {
  if (msg.type === 'cmd') {
    if (!m) { pending.push(msg); return; }
    var res;
    try { res = m.command(myId, msg.cmd); } catch (e) { res = { error: 'Something went wrong.' }; }
    post({ type: 'reply', id: msg.id, res: res });
  } else if (msg.type === 'stop') {
    clearInterval(timer);
    if (m) { m.destroy(); m = null; }
    self.close();
  }
}

self.onmessage = function (e) {
  var msg = e.data;
  if (msg.type === 'start') {
    self.PuttPhysics.init().then(function () { start(msg.profile, msg.bots); }, function (err) { post({ type: 'error', message: String(err && err.message || err) }); });
  } else handle(msg);
};
