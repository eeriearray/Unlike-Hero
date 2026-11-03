/* Title and result screens. Grows at M2 and M6. */
(function () {
  var TR = window.TR = window.TR || {};
  var menus = TR.menus = {
    ui: null, cur: null,
    init: function (ui) { menus.ui = ui; },
    close: function () { if (menus.cur) menus.cur.remove(); menus.cur = null; },
    title: function () {
      menus.close();
      var s = document.createElement('div'); s.className = 'screen';
      s.innerHTML = '<h1 class="outlined">TRILLIONER</h1><p class="outlined">One city. One day. One trillion dollars. Spend it all.</p><button class="btn" id="tr-play">Start The Day</button><button class="btn alt" id="tr-exit">Back to hub</button>';
      menus.ui.appendChild(s); menus.cur = s;
      s.querySelector('#tr-play').onclick = function () { TR.audio.unlock(); menus.close(); TR.app.startRun({ mode: 'day' }); };
      s.querySelector('#tr-exit').onclick = function () { if (window.Hub) Hub.exit(); else location.href = '../../index.html'; };
    }
  };
})();
