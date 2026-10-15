/* Mafia — the narrator's voice.
   Two sources, best first:
     studio — a neural voice rendered by the hub server (games/mafia/server/narrator.mjs), when it is running
     device — the browser's own speech synthesis, ranked so neural "Natural/Enhanced" deep voices win
   Any line the studio voice cannot deliver in time is read by the device voice instead.
   window.MafiaVoice: available, enabled, setEnabled(bool), voices() -> [{id,label}], voiceId, setVoice(id),
                      onVoices(fn), say(text), sequence(lines, onLine, onDone), cancel(). */
(function (global) {
  'use strict';
  var synth = global.speechSynthesis;
  var deviceOk = !!(synth && global.SpeechSynthesisUtterance);
  var enabled = true, wanted = '';
  try { enabled = localStorage.getItem('hub.mafia.narrator') !== '0'; wanted = localStorage.getItem('hub.mafia.voice') || ''; } catch (e) { /* storage blocked */ }
  var deviceVoice = null, token = 0, listeners = [], current = null;
  var studio = { ready: false, voices: {}, def: '', allowedHere: true };
  var base = location.protocol === 'file:' ? null : location.pathname.replace(/[^/]*$/, '') + 'tts';

  // ── device voices ──
  var DEEP = /\b(Guy|Andrew|Christopher|Brian|Eric|Roger|Steffan|Davis|Tony|Jason|Ryan|Thomas|George|Daniel|Arthur|Oliver|Evan|Nathan|Aaron|Tom|Alfie|Elliot|Ethan|Liam|Noah|William|Connor|Duncan|Mitchell|Lee|James|UK English Male)\b/i;
  var ROBOTIC = /espeak|zarvox|trinoids|bahh|bells|boing|bubbles|cellos|deranged|hysterical|organ|whisper|good news|bad news|jester|superstar|wobble|albert|junior|ralph|fred|grandpa|grandma|rocko|eddy|flo|reed|sandy|shelley|kathy|princess/i;
  var FEMALE = /\b(female|Aria|Jenny|Sonia|Libby|Natasha|Clara|Emma|Ava|Michelle|Samantha|Karen|Moira|Tessa|Victoria|Zira|Hazel|Susan|Serena|Kate|Fiona|Allison|Joanna|Salli|Kimberly|Ivy|Nicky|Martha|Stephanie|Catherine|Sara|Amy|Emily|Olivia|Isabella|Ana|Jane|Nancy)\b/i;
  function score(v) {
    if (!/^en([-_]|$)/i.test(v.lang)) return -1000;
    var s = 0, n = v.name;
    if (/natural|neural|enhanced|premium|studio|wavenet|journey/i.test(n)) s += 120;
    if (/online/i.test(n)) s += 30;
    if (/^Google/i.test(n)) s += 25;
    if (DEEP.test(n)) s += 50;
    if (FEMALE.test(n)) s -= 40;
    if (ROBOTIC.test(n)) s -= 300;
    if (/desktop|compact/i.test(n)) s -= 40;
    if (/en[-_]GB/i.test(v.lang)) s += 12; else if (/en[-_]US/i.test(v.lang)) s += 8;
    return s;
  }
  function rankedDevice() {
    if (!deviceOk) return [];
    return synth.getVoices().filter(function (v) { return score(v) > -1000; }).sort(function (a, b) { return score(b) - score(a); });
  }
  function changed() {
    var list = rankedDevice();
    deviceVoice = (wanted && list.filter(function (v) { return v.name === wanted; })[0]) || list[0] || null;
    listeners.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
  }
  if (deviceOk) {
    changed();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', changed); else synth.onvoiceschanged = changed;
  }
  function naturalDevice() { return deviceVoice && /natural|neural|enhanced|premium|studio|wavenet|journey|online|^Google/i.test(deviceVoice.name); }

  // ── studio voice (server) ──
  function pollStudio(delay) {
    if (!base || !global.fetch) return;
    setTimeout(function () {
      fetch(base + '/status', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (s) {
        if (!s) return; // no game server here (static hosting or offline)
        studio.voices = s.voices || {}; studio.def = s.defaultVoice || '';
        var was = studio.ready;
        studio.ready = s.state === 'ready';
        if (studio.ready !== was) changed();
        if (s.state === 'loading' || s.state === 'off') pollStudio(8000); // the model is still downloading
        else if (s.state === 'unavailable' && !/not installed/.test(s.error || '')) pollStudio(60000);
      }).catch(function () { /* offline: device voice only */ });
    }, delay || 0);
  }
  pollStudio(0);
  function studioVoice() {
    if (!studio.ready || !studio.allowedHere) return null;
    if (wanted.indexOf('studio:') === 0 && studio.voices[wanted.slice(7)]) return wanted.slice(7);
    if (wanted && wanted.indexOf('studio:') !== 0) return null; // the player chose a device voice
    return studio.def || Object.keys(studio.voices)[0] || null;
  }

  function clean(text) { return global.MafiaEngine ? global.MafiaEngine.speechText(text) : String(text || '').trim(); }
  function duck(on) { if (global.MafiaAudio) global.MafiaAudio.duck(on); }

  /** Fetch one rendered line; resolves to an object URL or rejects. */
  function fetchStudio(text, voice) {
    var ctrl = global.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    return fetch(base + '?v=' + encodeURIComponent(voice) + '&t=' + encodeURIComponent(text), ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error('tts ' + r.status); return r.blob(); })
      .then(function (b) { return URL.createObjectURL(b); });
  }
  function playUrl(url, my) {
    return new Promise(function (resolve, reject) {
      if (my !== token) return resolve();
      var a = new Audio(url);
      current = a;
      a.onended = function () { URL.revokeObjectURL(url); resolve(); };
      a.onerror = function () { URL.revokeObjectURL(url); reject(new Error('playback')); };
      var p = a.play();
      if (p && p.catch) p.catch(reject);
    });
  }

  // Device speech, sentence by sentence with storyteller pauses.
  function phrases(text) {
    var out = [], re = /[^.!?…]+(?:\.\.\.|…|[.!?]+)?/g, m;
    while ((m = re.exec(text))) {
      var p = m[0].trim();
      if (p) out.push({ text: p, pause: /(\.\.\.|…)$/.test(p) ? 650 : /[!?]$/.test(p) ? 420 : 330 });
    }
    return out;
  }
  function utter(text, onEnd) {
    var u = new SpeechSynthesisUtterance(text);
    if (deviceVoice) { u.voice = deviceVoice; u.lang = deviceVoice.lang; }
    u.rate = naturalDevice() ? 0.9 : 0.88;
    u.pitch = naturalDevice() ? 0.95 : 0.88; // pitch-shifting is what makes voices sound robotic
    var done = false;
    var finish = function () { if (done) return; done = true; onEnd(); };
    u.onend = finish; u.onerror = finish;
    setTimeout(finish, 2500 + text.split(' ').length * 650);
    synth.speak(u);
  }
  function speakDevice(text, my) {
    return new Promise(function (resolve) {
      if (!deviceOk) return resolve();
      var parts = phrases(text), i = 0;
      (function next() {
        if (my !== token || i >= parts.length) return resolve();
        var part = parts[i++];
        utter(part.text, function () { setTimeout(next, part.pause); });
      })();
    });
  }

  var API = {
    get available() { return deviceOk || studio.ready; },
    get enabled() { return API.available && enabled; },
    get studioReady() { return studio.ready; },
    get voiceId() { var sv = studioVoice(); return sv ? 'studio:' + sv : deviceVoice ? deviceVoice.name : ''; },
    /** Voices for the picker, best first: studio voices, then the device's ranked voices. */
    voices: function () {
      var out = [];
      if (studio.ready) Object.keys(studio.voices).forEach(function (k) { out.push({ id: 'studio:' + k, label: '★ ' + studio.voices[k] }); });
      rankedDevice().slice(0, 12).forEach(function (v) { out.push({ id: v.name, label: v.name }); });
      return out;
    },
    onVoices: function (fn) { listeners.push(fn); },
    /** Offline games never reach the server, so the studio cannot read their story. */
    useStudio: function (on) { studio.allowedHere = !!on; },
    setVoice: function (id) {
      wanted = id || '';
      try { localStorage.setItem('hub.mafia.voice', wanted); } catch (e) { /* storage blocked */ }
      changed();
    },
    setEnabled: function (on) {
      enabled = !!on;
      try { localStorage.setItem('hub.mafia.narrator', enabled ? '1' : '0'); } catch (e) { /* storage blocked */ }
      if (!enabled) API.cancel();
    },
    cancel: function () {
      token++;
      if (deviceOk) synth.cancel();
      if (current) { try { current.pause(); } catch (e) { /* gone */ } current = null; }
      duck(false);
    },
    say: function (text) { API.sequence([text]); },
    /** Speak lines in order. onLine(i) fires as line i starts. The next studio line is fetched while one plays. */
    sequence: function (lines, onLine, onDone) {
      API.cancel();
      var my = token;
      var texts = lines.map(clean);
      if (!API.enabled || !texts.length) { if (onDone) onDone(false); return false; }
      duck(true);
      var voice = studioVoice();
      var pending = {};
      function get(i) {
        if (!voice || i >= texts.length || !texts[i]) return null;
        if (!pending[i]) { pending[i] = fetchStudio(texts[i], voice); pending[i].catch(function () {}); }
        return pending[i];
      }
      get(0);
      var i = 0;
      (function next() {
        if (my !== token) return;
        if (i >= texts.length) { duck(false); if (onDone) onDone(true); return; }
        var idx = i++;
        if (onLine) onLine(idx);
        var text = texts[idx];
        var after = function () { if (my === token) setTimeout(next, 420); };
        if (!text) return after();
        var clip = get(idx);
        get(idx + 1);
        if (!clip) { speakDevice(text, my).then(after); return; }
        clip.then(function (url) { return playUrl(url, my); })
          .catch(function () { return speakDevice(text, my); })
          .then(after);
      })();
      return true;
    }
  };
  global.MafiaVoice = API;
})(window);
