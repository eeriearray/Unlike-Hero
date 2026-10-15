/* Mafia — the narrator's voice, using the browser's built-in speech synthesis.
   Picks the most natural deep voice the device offers (neural "Natural"/"Enhanced"/"Premium" voices first,
   novelty and eSpeak voices last), speaks at an unhurried pace and pauses like a storyteller.
   window.MafiaVoice: available, enabled, setEnabled(bool), voices(), voiceName, setVoice(name),
                      say(text), sequence(lines, onLine, onDone), cancel(). */
(function (global) {
  'use strict';
  var synth = global.speechSynthesis;
  var available = !!(synth && global.SpeechSynthesisUtterance);
  var enabled = true, wanted = '';
  try { enabled = localStorage.getItem('hub.mafia.narrator') !== '0'; wanted = localStorage.getItem('hub.mafia.voice') || ''; } catch (e) { /* storage blocked */ }
  var chosen = null, token = 0, listeners = [];

  // Deep, warm narrators that ship with common systems (Edge/Windows neural, macOS/iOS, Chrome).
  var DEEP = /\b(Guy|Andrew|Christopher|Brian|Eric|Roger|Steffan|Davis|Tony|Jason|Ryan|Thomas|George|Daniel|Arthur|Oliver|Evan|Nathan|Aaron|Tom|Alfie|Elliot|Ethan|Liam|Noah|William|Connor|Duncan|Mitchell|Prabhat|Lee|James|UK English Male)\b/i;
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
  function ranked() {
    if (!available) return [];
    return synth.getVoices().filter(function (v) { return score(v) > -1000; })
      .sort(function (a, b) { return score(b) - score(a); });
  }
  function pick() {
    var list = ranked();
    chosen = (wanted && list.filter(function (v) { return v.name === wanted; })[0]) || list[0] || null;
    listeners.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
  }
  if (available) {
    pick();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', pick);
    else synth.onvoiceschanged = pick;
  }
  function natural() { return chosen && /natural|neural|enhanced|premium|studio|wavenet|journey|online|^Google/i.test(chosen.name); }

  /** Text as a storyteller would read it: no emoji, no "(bot)" tags, dashes become pauses. */
  function clean(text) {
    return String(text || '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️‍]/gu, '')
      .replace(/\s*\(bot\)/gi, '')
      .replace(/\s*[—–]\s*/g, ', ')
      .replace(/\s+/g, ' ').trim();
  }
  /** Split into breaths: sentences and trailing ellipses each get their own pause. */
  function phrases(text) {
    var out = [], re = /[^.!?…]+(?:\.\.\.|…|[.!?]+)?/g, m;
    while ((m = re.exec(text))) {
      var p = m[0].trim();
      if (!p) continue;
      var pause = /(\.\.\.|…)$/.test(p) ? 650 : /[!?]$/.test(p) ? 420 : 330;
      out.push({ text: p.replace(/…$/, '...'), pause: pause });
    }
    return out;
  }
  function duck(on) { if (global.MafiaAudio) global.MafiaAudio.duck(on); }

  function utter(text, onEnd) {
    var u = new SpeechSynthesisUtterance(text);
    if (chosen) { u.voice = chosen; u.lang = chosen.lang; }
    // Neural voices sound best untouched; pitch-shifting is what makes voices robotic.
    u.rate = natural() ? 0.9 : 0.88;
    u.pitch = natural() ? 0.95 : 0.88;
    u.volume = 1;
    var done = false;
    var finish = function () { if (done) return; done = true; onEnd(); };
    u.onend = finish; u.onerror = finish;
    setTimeout(finish, 2500 + text.split(' ').length * 650); // some browsers never fire onend
    synth.speak(u);
  }

  var API = {
    available: available,
    get enabled() { return available && enabled; },
    get voiceName() { return chosen ? chosen.name : ''; },
    voices: function () { return ranked().map(function (v) { return v.name; }); },
    onVoices: function (fn) { listeners.push(fn); },
    setVoice: function (name) {
      wanted = name || '';
      try { localStorage.setItem('hub.mafia.voice', wanted); } catch (e) { /* storage blocked */ }
      pick();
    },
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
      var my = token;
      if (!API.enabled || !lines.length) { if (onDone) onDone(false); return false; }
      duck(true);
      var li = 0;
      (function nextLine() {
        if (my !== token) return;
        if (li >= lines.length) { duck(false); if (onDone) onDone(true); return; }
        if (onLine) onLine(li);
        var parts = phrases(clean(lines[li++]));
        var pi = 0;
        (function nextPhrase() {
          if (my !== token) return;
          if (pi >= parts.length) { setTimeout(nextLine, 380); return; }
          var part = parts[pi++];
          utter(part.text, function () { if (my === token) setTimeout(nextPhrase, part.pause); });
        })();
      })();
      return true;
    }
  };
  global.MafiaVoice = API;
})(window);
