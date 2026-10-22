/*
 * Game sound on iPhone and iPad.
 *
 * iOS Safari mutes Web Audio while the device is in Silent mode, and only lets a page start sound from a gesture that
 * ends a touch (touchend, pointerup, click), not from the touch going down. Games that unlock audio on pointerdown
 * therefore stay silent on a tablet. This file, loaded by hub-sdk.js (and directly by games that don't use the SDK):
 *   - asks for the "playback" audio session, so game sound plays through Silent mode like video does
 *     (Safari 16.4+; older iOS gets the same effect from a looping silent <audio> element started on the first tap);
 *   - remembers every AudioContext the page creates and resumes any suspended one on each gesture that ends a touch.
 * Desktop browsers are unaffected.
 */
(function () {
  'use strict';
  if (window.__hubIosAudio) return;
  window.__hubIosAudio = true;

  if (navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch (e) { /* not allowed here */ } }

  var contexts = [];
  ['AudioContext', 'webkitAudioContext'].forEach(function (name) {
    var Native = window[name];
    if (!Native || Native.__hubTracked) return;
    var Tracked = function (opts) { var c = opts === undefined ? new Native() : new Native(opts); contexts.push(c); return c; };
    Tracked.prototype = Native.prototype;
    Tracked.__hubTracked = true;
    try { Object.setPrototypeOf(Tracked, Native); } catch (e) { /* static members stay reachable through Native */ }
    window[name] = Tracked;
  });

  // A tenth of a second of silence as a WAV blob: playing it on a loop puts older iOS into its media audio session
  var silent = null, IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function silentLoop() {
    if (silent || !IOS || navigator.audioSession) return;
    var rate = 8000, n = rate / 10, buf = new ArrayBuffer(44 + n), v = new DataView(buf), w = function (o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    for (var i = 0; i < n; i++) v.setUint8(44 + i, 128);
    silent = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
    silent.loop = true; silent.setAttribute('playsinline', '');
    var p = silent.play(); if (p && p.catch) p.catch(function () { silent = null; });
  }

  function wake() {
    silentLoop();
    for (var i = 0; i < contexts.length; i++) { var c = contexts[i]; if (c.state === 'suspended' || c.state === 'interrupted') { try { c.resume(); } catch (e) { /* closed */ } } }
  }
  ['touchend', 'pointerup', 'click', 'keydown'].forEach(function (ev) { window.addEventListener(ev, wake, true); });
  // Coming back to the tab or unlocking the iPad can leave contexts interrupted until the next tap
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(wake, 0); });
})();
