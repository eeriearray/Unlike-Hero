/* Mafia — the narrator's voice.
   1. Recorded clips (games/mafia/voice/, made in record.html) — a real human voice, played through a
      narrator effects chain in js/audio.js.
   2. The browser's speech synthesis, only while no clips have been recorded yet (so a half-finished pack
      never switches voices mid-story). Deep "Natural/Enhanced" voices are preferred.
   A line is { clip: 'weather.3', text: 'The town awakens…' } — the clip id from the engine's SCRIPT.
   window.MafiaVoice: available, enabled, setEnabled(bool), pack {count, total}, onChange(fn),
                      say(line), sequence(lines, onLine, onDone), cancel(), voices(), voiceId, setVoice(id). */
(function (global) {
  'use strict';
  var A = global.MafiaAudio, E = global.MafiaEngine;
  var synth = global.speechSynthesis;
  var deviceOk = !!(synth && global.SpeechSynthesisUtterance);
  var enabled = true, wanted = '', allowed = true;
  try { enabled = localStorage.getItem('hub.mafia.narrator') !== '0'; wanted = localStorage.getItem('hub.mafia.voice') || ''; } catch (e) { /* storage blocked */ }
  var pack = { clips: {}, deepen: 1, count: 0, total: E ? Object.keys(E.SCRIPT).length : 0 };
  var base = location.pathname.replace(/[^/]*$/, '') + 'voice/';
  var token = 0, listeners = [], deviceVoice = null;
  function changed() { listeners.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } }); }

  function loadPack() {
    if (!global.fetch || location.protocol === 'file:') return;
    fetch(base + 'index.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j) return;
      pack.clips = j.clips || {}; pack.deepen = Number(j.deepen) || 1; pack.count = Object.keys(pack.clips).length;
      changed();
    }).catch(function () { /* no pack: device voice */ });
  }
  loadPack();

  // ── device voices (fallback) ──
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
  function ranked() { return deviceOk ? synth.getVoices().filter(function (v) { return score(v) > -1000; }).sort(function (a, b) { return score(b) - score(a); }) : []; }
  function pickDevice() { var l = ranked(); deviceVoice = (wanted && l.filter(function (v) { return v.name === wanted; })[0]) || l[0] || null; changed(); }
  if (deviceOk) { pickDevice(); if (synth.addEventListener) synth.addEventListener('voiceschanged', pickDevice); }
  function natural() { return deviceVoice && /natural|neural|enhanced|premium|studio|wavenet|journey|online|^Google/i.test(deviceVoice.name); }

  function phrases(text) {
    var out = [], re = /[^.!?…]+(?:\.\.\.|…|[.!?]+)?/g, m;
    while ((m = re.exec(text))) { var p = m[0].trim(); if (p) out.push({ text: p, pause: /(\.\.\.|…)$/.test(p) ? 650 : /[!?]$/.test(p) ? 420 : 330 }); }
    return out;
  }
  function speakDevice(text, my) {
    return new Promise(function (resolve) {
      if (!deviceOk || !text) return resolve();
      var parts = phrases(E ? E.speechText(text) : text), i = 0;
      (function next() {
        if (my !== token || i >= parts.length) return resolve();
        var part = parts[i++], done = false;
        var u = new SpeechSynthesisUtterance(part.text);
        if (deviceVoice) { u.voice = deviceVoice; u.lang = deviceVoice.lang; }
        u.rate = natural() ? 0.9 : 0.88; u.pitch = natural() ? 0.95 : 0.88;
        var finish = function () { if (done) return; done = true; setTimeout(next, part.pause); };
        u.onend = finish; u.onerror = finish;
        setTimeout(finish, 2500 + part.text.split(' ').length * 650);
        synth.speak(u);
      })();
    });
  }

  function clipUrl(id) { return id && pack.clips[id] ? base + pack.clips[id] : null; }
  /** Speak one line: its recording if there is one; the device voice only while nothing is recorded. */
  function speakLine(line, my) {
    var url = clipUrl(line.clip);
    if (url) return A.playVoice(url, pack.deepen).catch(function () { return pack.count ? null : speakDevice(line.text, my); });
    if (pack.count) return wait(900 + (line.text || '').split(' ').length * 300, my); // a pack exists: stay silent rather than switch voices
    return speakDevice(line.text || (E && E.SCRIPT[line.clip]) || '', my);
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function norm(l) { return typeof l === 'string' ? { text: l } : (l || {}); }

  var API = {
    get available() { return pack.count > 0 || deviceOk; },
    get enabled() { return API.available && enabled && allowed; },
    /** The room decides who narrates (settings.narrator): in a shared room only the host's device speaks,
        so several phones in one room don't read the same line a split second apart. */
    setAllowed: function (on) { on = !!on; if (on === allowed) return; allowed = on; if (!on) API.cancel(); },
    pack: pack,
    onChange: function (fn) { listeners.push(fn); },
    reload: loadPack,
    setEnabled: function (on) {
      enabled = !!on;
      try { localStorage.setItem('hub.mafia.narrator', enabled ? '1' : '0'); } catch (e) { /* storage blocked */ }
      if (!enabled) API.cancel();
    },
    voices: function () { return ranked().slice(0, 12).map(function (v) { return { id: v.name, label: v.name }; }); },
    get voiceId() { return deviceVoice ? deviceVoice.name : ''; },
    setVoice: function (id) { wanted = id || ''; try { localStorage.setItem('hub.mafia.voice', wanted); } catch (e) { /* storage blocked */ } pickDevice(); },
    cancel: function () { token++; if (deviceOk) synth.cancel(); if (A.stopVoice) A.stopVoice(); A.duck(false); },
    say: function (line) { return API.sequence([line]); },
    /** Speak lines in order; onLine(i) fires as line i starts. Returns false if nothing will be spoken. */
    sequence: function (lines, onLine, onDone) {
      API.cancel();
      var my = token, items = lines.map(norm);
      if (!API.enabled || !items.length) { if (onDone) onDone(false); return false; }
      items.forEach(function (l) { var u = clipUrl(l.clip); if (u) A.preloadVoice(u); });
      A.duck(true);
      var i = 0;
      (function next() {
        if (my !== token) return;
        if (i >= items.length) { A.duck(false); if (onDone) onDone(true); return; }
        var idx = i++;
        if (onLine) onLine(idx);
        speakLine(items[idx], my).then(function () { if (my === token) setTimeout(next, 450); });
      })();
      return true;
    }
  };
  global.MafiaVoice = API;
})(window);
