/* Seeded random numbers (mulberry32). Engine code never calls Math.random. Node + classic script. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TrillionerRng = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function hash(s) {
    s = String(s);
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function Rng(seed) { this.s = (typeof seed === 'number' ? seed : hash(seed)) >>> 0; }
  Rng.prototype.next = function () {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    var t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.int = function (n) { return Math.floor(this.next() * n); };
  Rng.prototype.range = function (a, b) { return a + this.next() * (b - a); };
  Rng.prototype.pick = function (arr) { return arr[this.int(arr.length)]; };
  Rng.prototype.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = this.int(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  /** An independent stream, so adding a draw in one system doesn't reshuffle another. */
  Rng.prototype.fork = function (label) { return new Rng((this.s ^ hash(label)) >>> 0); };
  return { Rng: Rng, hash: hash };
});
