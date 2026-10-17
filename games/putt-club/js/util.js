/* Putt Club — shared browser helpers. Everything client-side hangs off window.PC. */
(function (global) {
  'use strict';
  var PC = global.PC = global.PC || {};

  PC.GAME = { id: 'putt-club', title: 'Putt Club', version: '1.0.0' };

  PC.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  PC.lerp = function (a, b, t) { return a + (b - a) * t; };
  PC.damp = function (a, b, lambda, dt) { return PC.lerp(a, b, 1 - Math.exp(-lambda * dt)); };
  PC.easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  PC.easeInOutCubic = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  PC.easeOutBack = function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  PC.angleLerp = function (a, b, t) { var d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * t; };

  /** Deterministic RNG (mulberry32) so procedural decoration is the same on every device. */
  PC.rng = function (seed) {
    var a = typeof seed === 'string' ? hash(seed) : seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  PC.hash = hash;

  PC.store = {
    get: function (k, d) { try { var v = localStorage.getItem('puttclub.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('puttclub.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  };
  PC.session = {
    get: function (k, d) { try { var v = sessionStorage.getItem('puttclub.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { if (v == null) sessionStorage.removeItem('puttclub.' + k); else sessionStorage.setItem('puttclub.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  };

  PC.reducedMotion = function () {
    var pref = PC.store.get('reducedMotion', null);
    if (pref != null) return pref;
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  PC.isTouch = function () { return !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches); };

  PC.relName = function (strokes, par) {
    if (strokes === 1) return 'Hole in One';
    var d = strokes - par;
    return { '-3': 'Albatross', '-2': 'Eagle', '-1': 'Birdie', '0': 'Par', '1': 'Bogey', '2': 'Double Bogey', '3': 'Triple Bogey' }[d] || (d < -3 ? 'Condor' : '+' + d);
  };
  PC.relText = function (rel) { return rel === 0 ? 'E' : rel > 0 ? '+' + rel : String(rel); };

  // Tiny event bus between modules (net -> scene/ui/audio).
  var handlers = {};
  PC.on = function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return function () { handlers[ev] = handlers[ev].filter(function (f) { return f !== fn; }); }; };
  PC.emit = function (ev, data) { (handlers[ev] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { if (global.console) console.error(e); } }); };
})(window);
