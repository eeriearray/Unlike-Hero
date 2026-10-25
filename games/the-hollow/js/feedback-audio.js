/* Optional scare impact uses the shared mixer. The standalone feedback review
 * retains its legacy bus when recorded-audio.js is not loaded. */
(function (g) {
  'use strict';
  function sound(variant) {
    var profiles = g.HollowScareFace && g.HollowScareFace.profiles;
    return profiles && profiles[variant] || { rate: 1, pan: 0 };
  }
  if (g.HollowAudio.prepareAsset) {
    var sharedCue = null;
    function allowed() { var p = g.HollowFx.prefs; return p.jumpScares && !p.reducedScares && !g.HollowFx.reduced(); }
    g.HollowFeedbackAudio = {
      prepare: function (id) { if (id) sharedCue = id; return g.HollowAudio.prepareAsset(sharedCue); },
      play: function (variant) { g.HollowAudio.stopGroup('scare'); return allowed() && g.HollowAudio.playImpact(sharedCue, sound(variant)); },
      stop: function () { g.HollowAudio.stopGroup('scare'); }
    };
    return;
  }
  var ctx = null, buffer = null, cue = null, pending = null, gain = null, limiter = null, playing = [];
  function settings() { return g.HollowAudio.settings(); }
  function volume() { var s = settings(); return s.muted ? 0 : Math.max(0, Math.min(1, s.master * s.sfx)) * .6; }
  function stop() {
    playing.splice(0).forEach(function (source) { try { source.stop(); } catch (e) {} });
    if (ctx && gain) gain.gain.setValueAtTime(0, ctx.currentTime);
  }
  function unlock() {
    if (!g.HollowFx.prefs.jumpScares || g.HollowFx.prefs.reducedScares || g.HollowFx.reduced() || !volume()) return;
    var Context = g.AudioContext || g.webkitAudioContext;
    if (!Context) return;
    try {
      if (!ctx) {
        ctx = new Context(); gain = ctx.createGain(); limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 16;
        gain.connect(limiter); limiter.connect(ctx.destination); gain.gain.value = 0;
      }
      if (ctx.state === 'suspended') ctx.resume().catch(function () {});
      prepare(cue);
    } catch (e) { /* Audio is optional. */ }
  }
  function prepare(id) {
    if (id) cue = id;
    if (!ctx || !cue || pending) return pending;
    pending = g.HollowAssets.load(cue).then(function (bytes) {
      return bytes ? ctx.decodeAudioData(bytes.slice(0)) : null;
    }).then(function (b) { buffer = b; }).catch(function () { buffer = null; });
    return pending;
  }
  function play(variant) {
    stop();
    if (!ctx || ctx.state !== 'running' || !volume()) return false;
    var now = ctx.currentTime, amount = volume();
    gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(amount, now + .012);
    gain.gain.setValueAtTime(amount, now + .38); gain.gain.linearRampToValueAtTime(0, now + .54);
    try {
      if (buffer) {
        var source = ctx.createBufferSource(); source.buffer = buffer; if (source.playbackRate) source.playbackRate.value = sound(variant).rate; source.connect(gain);
        source.start(now, 0, Math.min(.54, buffer.duration)); playing.push(source);
      } else {
        // Synthesised impact fallback; no misleading damage/result caption.
        var osc = ctx.createOscillator(); osc.type = 'triangle';
        osc.frequency.setValueAtTime(115 * sound(variant).rate, now); osc.frequency.exponentialRampToValueAtTime(35, now + .22);
        osc.connect(gain); osc.start(now); osc.stop(now + .24); playing.push(osc);
      }
      return true;
    } catch (e) { stop(); return false; }
  }
  function adjust() {
    if (!ctx || !gain) return;
    if (!volume()) stop(); else if (playing.length) gain.gain.setTargetAtTime(volume(), ctx.currentTime, .015);
  }
  ['setVolume', 'setMuted'].forEach(function (key) {
    var original = g.HollowAudio[key];
    g.HollowAudio[key] = function () { var result = original.apply(this, arguments); adjust(); return result; };
  });
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', unlock, { passive: true });
  g.HollowFeedbackAudio = { prepare: prepare, play: play, stop: stop };
})(window);
