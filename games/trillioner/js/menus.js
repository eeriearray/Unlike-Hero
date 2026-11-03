/* Title, pause and result screens. */
(function () {
  var TR = window.TR = window.TR || {};
  var Tr = window.TRD.trophies;
  function screen(html, cls) {
    menus.close();
    var s = document.createElement('div'); s.className = 'screen ' + (cls || '');
    s.innerHTML = html;
    menus.ui.appendChild(s); menus.cur = s;
    return s;
  }
  var menus = TR.menus = {
    ui: null, cur: null,
    init: function (ui) { menus.ui = ui; },
    close: function () { if (menus.cur) menus.cur.remove(); menus.cur = null; },
    title: function () {
      var s = screen('<h1 class="outlined">TRILLIONER</h1><p class="outlined">One city. One day. One trillion dollars. Spend it all.</p><button class="btn" id="tr-play">Start The Day</button><button class="btn alt" id="tr-exit">Back to hub</button>');
      s.querySelector('#tr-play').onclick = function () { TR.audio.unlock(); menus.close(); TR.app.startRun({ mode: 'day' }); };
      s.querySelector('#tr-exit').onclick = menus.exit;
    },
    exit: function () { if (window.Hub) Hub.exit(); else location.href = '../../index.html'; },
    pause: function () {
      var s = screen('<h1 class="outlined" style="font-size:64px">Paused</h1><p class="outlined">The clock has stopped.</p><button class="btn" id="m-go">Keep spending</button><button class="btn alt" id="m-end">End this run</button>');
      s.querySelector('#m-go').onclick = function () { menus.close(); TR.app.setPaused(false); };
      s.querySelector('#m-end').onclick = function () { menus.close(); TR.app.paused = false; TR.app.quitRun(); };
    },
    perfectWindow: function () {
      if (menus.pw) menus.pw.remove();
      var p = menus.pw = document.createElement('div'); p.className = 'perfect';
      p.innerHTML = '<b class="outlined">FLAT BROKE!</b><div id="pw-t"></div><div>For Perfect Zero, reach exactly $0.00 with income exactly $0. The clock is frozen.</div><div class="row"><button class="btn" id="pw-end">Take the win</button><button class="btn alt" id="pw-toss">Toss loose change</button></div>';
      menus.ui.appendChild(p);
      p.querySelector('#pw-end').onclick = function () { TR.app.session.finish(); };
      p.querySelector('#pw-toss').onclick = function () { var r = TR.app.session.toss(); TR.hud.toast(r.error || 'Tossed ' + TR.fmtFull(r.paid), r.error ? 'bad' : 'gold'); };
    },
    updatePerfect: function (me) { if (menus.pw) { menus.pw.querySelector('#pw-t').textContent = Math.ceil(me.perfectLeft / 1000) + ' seconds. Balance ' + TR.fmtFull(me.balance); } },
    closePerfect: function () { if (menus.pw) menus.pw.remove(); menus.pw = null; },
    results: function (res, earned) {
      var title = res.perfect ? 'PERFECT ZERO!' : res.won ? 'FLAT BROKE!' : res.result === 'quit' ? 'Run over' : 'The day is over', names = {};
      Tr.TROPHIES.forEach(function (t) { names[t.id] = t.name; });
      var chips = res.trophies.map(function (t) { return '<span class="chip">' + (earned.newTrophies.indexOf(t) >= 0 ? 'NEW: ' : '') + (names[t] || t) + '</span>'; }).join('') || '<span>No trophies this time.</span>';
      var s = screen('<div class="panel"><h2 class="outlined">' + title + '</h2>' +
        '<div class="stats"><div class="stat"><b>' + TR.fmt(res.spent) + '</b>Spent</div><div class="stat"><b>' + TR.fmtFull(res.left) + '</b>Money left</div>' +
        '<div class="stat"><b>+' + earned.clout + '</b>Clout earned</div><div class="stat"><b>' + res.secrets + '</b>Secrets found</div>' +
        '<div class="stat"><b>' + (res.best ? TR.fmt(res.best.base) : '-') + '</b>Best purchase: ' + (res.best ? res.best.name : 'nothing') + '</div></div>' +
        '<canvas class="chart" id="r-chart" width="700" height="120"></canvas><div class="chips">' + chips + '</div>' +
        '<div class="row"><button class="btn" id="r-again">New run</button><button class="btn alt" id="r-menu">Menu</button></div></div>');
      menus.chart(s.querySelector('#r-chart'), res.history);
      s.querySelector('#r-again').onclick = function () { menus.close(); TR.app.startRun({ mode: TR.app.mode || 'day' }); };
      s.querySelector('#r-menu').onclick = function () { TR.menus.title(); };
    },
    chart: function (c, h) {
      var g = c.getContext('2d'), W = c.width, H = c.height, max = Math.max.apply(null, h) || 1;
      g.clearRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, H - 12); g.lineTo(W, H - 12); g.stroke();
      g.strokeStyle = '#ffc53d'; g.lineWidth = 3; g.beginPath();
      h.forEach(function (v, i) { var x = i / Math.max(1, h.length - 1) * (W - 8) + 4, y = H - 12 - v / max * (H - 26); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
      g.fillStyle = '#fff'; g.font = '12px Arial'; g.fillText('Balance over the day (peak ' + TR.fmt(max) + ')', 8, 14);
    }
  };
})();
