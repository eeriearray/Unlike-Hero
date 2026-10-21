/*!
 * Dragon Clash — single-elimination tournament.
 *
 * Plain JSON state, pure functions, so the same bracket runs in a local tournament and on the server.
 * Byes go to the top seeds when the field is not a power of two. A match only advances when
 * reportResult() names one of its two players as the winner, so nothing advances without a real result.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.DC = root.DC || {}; root.DC.Tournament = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN = 2, MAX = 16;

  /** Seed order for a bracket of `size` slots, e.g. 8 → [1, 8, 4, 5, 2, 7, 3, 6]. */
  function seedOrder(size) {
    var order = [1];
    while (order.length < size) {
      var n = order.length * 2 + 1, next = [];
      order.forEach(function (s) { next.push(s, n - s); });
      order = next;
    }
    return order;
  }

  function roundName(round, rounds) {
    var left = rounds - round;
    if (left === 1) return 'Final';
    if (left === 2) return 'Semifinals';
    if (left === 3) return 'Quarterfinals';
    return 'Round ' + (round + 1);
  }

  /** entrants: [{ id, name, ... }] in seed order (first = top seed). */
  function create(entrants, opts) {
    if (!Array.isArray(entrants) || entrants.length < MIN) throw new Error('A tournament needs at least ' + MIN + ' players.');
    if (entrants.length > MAX) throw new Error('At most ' + MAX + ' players.');
    var ids = {};
    entrants.forEach(function (e) {
      if (!e || !e.id) throw new Error('Every entrant needs an id.');
      if (ids[e.id]) throw new Error('Duplicate entrant ' + e.id + '.');
      ids[e.id] = true;
    });
    var size = 1;
    while (size < entrants.length) size *= 2;
    var rounds = Math.log2(size) | 0;
    var order = seedOrder(size);
    var t = {
      id: (opts && opts.id) || 'cup', size: size, rounds: [], status: 'running', champion: null,
      entrants: entrants.map(function (e, i) { var c = JSON.parse(JSON.stringify(e)); c.seed = i + 1; c.out = false; return c; }),
      log: [],
    };
    for (var r = 0; r < rounds; r++) {
      var n = size >> (r + 1), list = [];
      for (var m = 0; m < n; m++) list.push({ id: 'r' + r + 'm' + m, round: r, index: m, a: null, b: null, winner: null, status: 'waiting', bye: false, result: null });
      t.rounds.push(list);
    }
    // First round from the seed order; a missing seed is a bye.
    t.rounds[0].forEach(function (m, k) {
      var sa = order[k * 2], sb = order[k * 2 + 1];
      m.a = sa <= entrants.length ? entrants[sa - 1].id : null;
      m.b = sb <= entrants.length ? entrants[sb - 1].id : null;
    });
    t.rounds[0].forEach(function (m) {
      if (m.a && m.b) m.status = 'ready';
      else { m.bye = true; advance(t, m, m.a || m.b, { bye: true }); }
    });
    return t;
  }

  function find(t, id) {
    for (var r = 0; r < t.rounds.length; r++) for (var m = 0; m < t.rounds[r].length; m++) if (t.rounds[r][m].id === id) return t.rounds[r][m];
    return null;
  }

  function advance(t, m, winner, result) {
    m.winner = winner; m.status = 'done'; m.result = result || null;
    var loser = m.a === winner ? m.b : m.a;
    if (loser) entrant(t, loser).out = true;
    t.log.push({ match: m.id, winner: winner, loser: loser, bye: !!(result && result.bye) });
    if (m.round === t.rounds.length - 1) {
      t.champion = winner; t.status = 'done';
      return;
    }
    var next = t.rounds[m.round + 1][m.index >> 1];
    if (m.index % 2 === 0) next.a = winner; else next.b = winner;
    if (next.a && next.b) next.status = 'ready';
  }

  function entrant(t, id) {
    for (var i = 0; i < t.entrants.length; i++) if (t.entrants[i].id === id) return t.entrants[i];
    return null;
  }

  /** Mark a ready match as being played. */
  function start(t, matchId) {
    var m = find(t, matchId);
    if (!m) throw new Error('No such match.');
    if (m.status !== 'ready') throw new Error('Match ' + matchId + ' is not ready (' + m.status + ').');
    m.status = 'live';
    return m;
  }

  /** Record the winner of a live (or ready) match. Throws on anything that is not a real result. */
  function reportResult(t, matchId, winnerId, result) {
    if (t.status === 'done') throw new Error('The tournament is over.');
    var m = find(t, matchId);
    if (!m) throw new Error('No such match.');
    if (m.status !== 'live' && m.status !== 'ready') throw new Error('Match ' + matchId + ' cannot take a result (' + m.status + ').');
    if (winnerId !== m.a && winnerId !== m.b) throw new Error('The winner must be one of the two players in the match.');
    advance(t, m, winnerId, result || null);
    return m;
  }

  function readyMatches(t) {
    var out = [];
    t.rounds.forEach(function (list) { list.forEach(function (m) { if (m.status === 'ready') out.push(m); }); });
    return out;
  }

  function liveMatches(t) {
    var out = [];
    t.rounds.forEach(function (list) { list.forEach(function (m) { if (m.status === 'live') out.push(m); }); });
    return out;
  }

  /** The match a player is in right now (ready or live), if any. */
  function matchFor(t, id) {
    var found = null;
    t.rounds.forEach(function (list) { list.forEach(function (m) { if ((m.status === 'ready' || m.status === 'live') && (m.a === id || m.b === id)) found = m; }); });
    return found;
  }

  return { create: create, start: start, reportResult: reportResult, readyMatches: readyMatches, liveMatches: liveMatches,
           matchFor: matchFor, find: find, entrant: entrant, roundName: roundName, seedOrder: seedOrder, MIN: MIN, MAX: MAX };
});
