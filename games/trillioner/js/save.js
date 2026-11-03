/* Progress that survives a reload: trophies, Clout, unlocks, notebook, best spent, fastest win. */
(function () {
  var TR = window.TR = window.TR || {};
  var mem = {}, store = window.Hub ? (Hub.gameId ? Hub.storage() : Hub.storage('trillioner')) : {
    get: function (k, d) { try { var v = localStorage.getItem('hub.trillioner.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return k in mem ? mem[k] : d; } },
    set: function (k, v) { mem[k] = v; try { localStorage.setItem('hub.trillioner.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  var save = TR.save = {
    get: function (k, d) { return store.get(k, d); },
    set: function (k, v) { store.set(k, v); },
    data: function () {
      return {
        trophies: store.get('trophies', {}), clout: store.get('clout', 0), cloutTotal: store.get('cloutTotal', 0), unlocks: store.get('unlocks', {}), equipped: store.get('equipped', {}),
        notebook: store.get('notebook', {}), bestSpent: store.get('bestSpent', 0), fastestWin: store.get('fastestWin', null), runs: store.get('runs', 0)
      };
    },
    /** Banks a finished run. Returns what it earned. Free Roam earns nothing. */
    recordRun: function (res, mode) {
      if (mode === 'free' || mode === 'battle') { store.set('runs', store.get('runs', 0) + (mode === 'battle' ? 1 : 0)); return { clout: 0, newTrophies: [] }; }
      var d = save.data(), fresh = [];
      res.trophies.forEach(function (t) { if (!d.trophies[t]) { d.trophies[t] = Date.now(); fresh.push(t); } });
      store.set('trophies', d.trophies);
      store.set('clout', d.clout + res.clout);
      store.set('cloutTotal', d.cloutTotal + res.clout);
      store.set('runs', d.runs + 1);
      if (res.spent > d.bestSpent) store.set('bestSpent', res.spent);
      if (res.won && (d.fastestWin == null || res.ms < d.fastestWin)) store.set('fastestWin', res.ms);
      return { clout: res.clout, newTrophies: fresh };
    },
    note: function (id, text) {
      var n = store.get('notebook', {});
      if (n[id]) return false;
      n[id] = text;
      store.set('notebook', n);
      return true;
    }
  };
})();
