/* Mafia — the narrator's voice, using the browser's built-in speech synthesis.
   window.MafiaVoice: available, enabled, setEnabled(bool), say(text), sequence(lines, onLine, onDone), cancel().
   Music ducks while the narrator speaks. Emoji are stripped before speaking. */
(function (global) {
  'use strict';
  var synth = global.speechSynthesis;
  var available = !!(synth && global.SpeechSynthesisUtterance);
  var enabled = true;
  try { enabled = localStorage.getItem('hub.mafia.narrator') !== '0'; } catch (e) { /* storage blocked */ }
  var chosen = null, token = 0;

  // A low, unhurried storyteller voice if the device has one.
  var PREFERRED = ['Daniel', 'Google UK English Male', 'Microsoft Ryan', 'Microsoft Guy', 'Microsoft George', 'Arthur', 'Aaron', 'Fred', 'Alex', 'Microsoft David', 'Google US English'];
  function pickVoice() {
    if (!available) return null;
    var voices = synth.getVoices();
    if (!voices.length) return null;
    for (var i = 0; i < PREFERRED.length; i++) {
      for (var j = 0; j < voices.length; j++) if (voices[j].name.indexOf(PREFERRED[i]) === 0) return voices[j];
    }
    return voices.filter(function (v) { return /^en(-|_)GB/i.test(v.lang); })[0] || voices.filter(function (v) { return /^en/i.test(v.lang); })[0] || voices[0];
  }
  if (available) {
    chosen = pickVoice();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', function () { chosen = pickVoice(); });
  }

  function clean(text) {
    return String(text || '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️‍]/gu, '')
      .replace(/\s+/g, ' ').trim();
  }
  function duck(on) { if (global.MafiaAudio) global.MafiaAudio.duck(on); }

  function utter(text, onEnd) {
    var u = new SpeechSynthesisUtterance(clean(text));
    if (chosen) u.voice = chosen;
    u.rate = 0.94; u.pitch = 0.82; u.volume = 1;
    var done = false;
    var finish = function () { if (done) return; done = true; onEnd(); };
    u.onend = finish; u.onerror = finish;
    // Some browsers never fire onend; fall back to a reading-speed estimate.
    setTimeout(finish, 1200 + clean(text).split(' ').length * 520);
    synth.speak(u);
  }

  var API = {
    available: available,
    get enabled() { return available && enabled; },
    setEnabled: function (on) {
      enabled = !!on;
      try { localStorage.setItem('hub.mafia.narrator', enabled ? '1' : '0'); } catch (e) { /* storage blocked */ }
      if (!enabled) API.cancel();
    },
    cancel: function () { token++; if (available) synth.cancel(); duck(false); },
    say: function (text) { API.sequence([text]); },
    /** Speak lines one after another. onLine(i) fires just before line i is spoken. */
    sequence: function (lines, onLine, onDone) {
      API.cancel();
      var my = token, i = 0;
      if (!API.enabled || !lines.length) { if (onDone) onDone(false); return false; }
      duck(true);
      (function next() {
        if (my !== token) return;
        if (i >= lines.length) { duck(false); if (onDone) onDone(true); return; }
        if (onLine) onLine(i);
        var line = lines[i++];
        if (!clean(line)) { next(); return; }
        utter(line, function () { if (my === token) setTimeout(next, 260); });
      })();
      return true;
    }
  };
  global.MafiaVoice = API;
})(window);
