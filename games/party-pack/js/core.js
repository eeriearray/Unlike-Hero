/* Shared by the Main Stage, the phone controllers and the audience: helpers, the profanity
   filter, player palettes (including colour-blind safe ones), settings and the network wrapper. */
(function () {
  'use strict';
  const PP = window.PP = window.PP || {};

  // ---------- small helpers ----------
  PP.$ = (sel, root) => (root || document).querySelector(sel);
  PP.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  PP.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  PP.uid = (n = 8) => Math.random().toString(36).slice(2, 2 + n);
  PP.pick = a => a[Math.floor(Math.random() * a.length)];
  PP.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  PP.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  PP.sleep = ms => new Promise(r => setTimeout(r, ms));
  PP.fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars && vars[k] != null ? vars[k] : '');
  PP.listNames = names => names.length <= 1 ? (names[0] || '') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  PP.norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/^(a|an|the)\s+/, '').replace(/[^a-z0-9]+/g, '');
  PP.lev = (a, b) => {
    if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  };
  /** True when a typed answer is effectively the truth (used to reject "lies" that are the real answer). */
  PP.isTruth = (text, answer, alts) => {
    const t = PP.norm(text); if (!t) return false;
    return [answer].concat(alts || []).some(a => { const n = PP.norm(a); return t === n || (n.length > 4 && PP.lev(t, n) <= 1) || (t.length > 3 && t.replace(/s$/, '') === n.replace(/s$/, '')); });
  };

  // ---------- profanity filter ----------
  // Layer 1 runs everywhere: normalises leetspeak, separators and stretched letters, then masks.
  // Layer 2 (an ML toxicity classifier) and Layer 3 (the VIP Moderator) are described in docs/GDD.md;
  // the host calls PP.filter.remote(text) when a classifier endpoint is configured.
  const STRONG = ['fuck', 'shit', 'cunt', 'bitch', 'nigger', 'nigga', 'faggot', 'fag', 'retard', 'whore', 'slut', 'dick', 'cock', 'pussy', 'asshole', 'bastard', 'motherfucker', 'twat', 'wank', 'prick', 'spic', 'chink', 'kike', 'dyke', 'tranny', 'rape', 'nazi', 'porn', 'penis', 'vagina', 'boobs', 'tits', 'cum', 'jizz', 'dildo', 'anal'];
  const SAFE = ['scunthorpe', 'cocktail', 'cockpit', 'peacock', 'hancock', 'dickens', 'assassin', 'class', 'pass', 'grass', 'bass', 'glass', 'shitake', 'shiitake', 'cumin', 'cucumber', 'document', 'circumstance', 'analysis', 'analog', 'canal', 'banal', 'therapist', 'grape', 'drape', 'scrape', 'cockatoo', 'titan', 'title', 'tittle', 'button', 'shittim', 'arsenal', 'spice', 'spicy', 'pricked', 'hitch', 'sextant', 'essex', 'sussex', 'middlesex', 'bitcoin', 'dickinson', 'fagin', 'snigger', 'suspicion', 'suspicious', 'auspicious', 'conspicuous', 'despicable', 'prickly', 'swanky', 'trapeze', 'analyst', 'analytics', 'hancock'];
  const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '(': 'c', '¢': 'c' };
  const squash = w => w.toLowerCase().split('').map(c => LEET[c] || c).join('').replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
  const STRONG_SQ = STRONG.map(squash);
  const SAFE_SQ = SAFE.map(squash).sort((a, b) => b.length - a.length);
  function hit(word) {
    const sq = squash(word); if (!sq) return false;
    const exact = b => sq === b || sq === b + 's' || sq === b + 'er' || sq === b + 'ing' || sq === b + 'ed';
    if (STRONG_SQ.some(exact)) return true;
    // Cut innocent words out first ("suspiciously", "cocktail"), then look for embedded slurs in what is left.
    let rest = sq; SAFE_SQ.forEach(w => { rest = rest.split(w).join('|'); });
    return rest.split('|').some(part => STRONG_SQ.some(b => b.length >= 4 && part.includes(b)));
  }
  PP.filter = {
    /** Does the text contain a blocked word (including spaced-out and l33t spellings)? */
    test(text) {
      const s = String(text || '');
      if (s.split(/\s+/).some(hit)) return true;
      // "f u c k" or "f.u.c.k": collapse runs of single characters
      const collapsed = s.replace(/(?:^|\s)((?:\S[\s._*-]){2,}\S)(?=\s|$)/g, m => ' ' + m.replace(/[\s._*-]/g, ''));
      return collapsed.split(/\s+/).some(hit);
    },
    /** Replace blocked words with grawlix. */
    clean(text) {
      const g = ['#', '$', '%', '!', '@', '&', '*'];
      let s = String(text || '').replace(/\S+/g, w => hit(w) ? w.replace(/[^\s]/g, (_, i) => g[i % g.length]) : w);
      if (PP.filter.test(s)) s = s.replace(/(^|\s)((?:\S[\s._*-]){2,}\S)(?=\s|$)/g, (m, pre, w) => hit(w.replace(/[\s._*-]/g, '')) ? pre + '#$%!' : m);
      return s;
    },
    remote: null // async (text) => ({ flagged, score }) — set by the host when a classifier URL is configured
  };

  // ---------- player palettes ----------
  // Default palette plus a colour-blind safe palette (Okabe–Ito). Every player also gets a shape,
  // so nothing is ever communicated by colour alone.
  PP.PALETTES = {
    default: ['#ff4f6d', '#3fa7ff', '#ffc531', '#3ee08f', '#b26bff', '#ff8a3d', '#34e0e0', '#ff6fd2'],
    safe: ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#FFFFFF'],
    contrast: ['#ffff00', '#00ffff', '#ff00ff', '#00ff00', '#ffffff', '#ff8800', '#88aaff', '#ff4444']
  };
  PP.SHAPES = ['●', '▲', '■', '◆', '★', '⬟', '✚', '⬢'];
  PP.playerColor = (i, mode) => (PP.PALETTES[mode] || PP.PALETTES.default)[i % 8];

  // ---------- settings (per device) ----------
  const store = (() => { try { return window.Hub ? Hub.storage('party-pack') : null; } catch (e) { return null; } })();
  PP.prefs = {
    get(k, d) { try { if (store) return store.get(k, d); const v = localStorage.getItem('party-pack.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { if (store) store.set(k, v); else localStorage.setItem('party-pack.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  /** Apply accessibility preferences to <html>: text scale, high contrast, colour-blind filter, reduced motion. */
  PP.applyA11y = a => {
    const r = document.documentElement;
    r.style.setProperty('--scale', a.textScale || 1);
    r.classList.toggle('hc', !!a.highContrast);
    r.classList.toggle('reduce-motion', !!a.reduceMotion);
    r.dataset.cb = a.colorBlind || 'none';
  };

  // ---------- identity ----------
  // One token per browser tab (sessionStorage), so several tabs on one computer can be different
  // players and a refresh rejoins the same seat.
  PP.tabToken = () => {
    try { let t = sessionStorage.getItem('pp.token'); if (!t) { t = 't_' + PP.uid(10); sessionStorage.setItem('pp.token', t); } return t; }
    catch (e) { return 't_' + PP.uid(10); }
  };

  // ---------- network ----------
  // Thin wrapper over Hub.room(). Topics:
  //   host → all : 'stage' (public summary), 'view' {to, v} (one player's screen), 'asset' {to, id, data}, 'aud' (audience screen), 'bye' {to}
  //   phone → host : 'join', 'in' (input), 'hb' (heartbeat), 'react'
  PP.connect = (code, onStatus) => {
    if (!window.Hub) return null;
    const hub = Hub.init({ id: 'party-pack', version: '1.0.0', title: 'Party Pack' });
    const room = hub.room('party-pack:' + code.toUpperCase());
    if (onStatus) room.on('status', onStatus);
    return room;
  };
  PP.makeCode = () => { const A = 'BCDFGHJKLMNPQRSTVWXZ2346789'; let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
})();
