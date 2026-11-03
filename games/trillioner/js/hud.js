/* The heads-up display. Plain DOM, updated from the engine's view. */
(function () {
  var TR = window.TR = window.TR || {};
  var R = window.TRD.rules;

  TR.fmt = function (c) {
    var d = c / 100, a = Math.abs(d), s;
    if (a >= 1e12) s = (d / 1e12).toFixed(a >= 1e13 ? 1 : 3) + 'T';
    else if (a >= 1e9) s = (d / 1e9).toFixed(a >= 1e11 ? 0 : a >= 1e10 ? 1 : 2) + 'B';
    else if (a >= 1e6) s = (d / 1e6).toFixed(a >= 1e8 ? 0 : 1) + 'M';
    else if (a >= 1e4) s = (d / 1e3).toFixed(0) + 'K';
    else s = a % 1 ? d.toFixed(2) : d.toLocaleString('en-US');
    return '$' + s;
  };
  TR.fmtFull = function (c) {
    var dollars = Math.floor(c / 100), cents = c % 100;
    return '$' + dollars.toLocaleString('en-US') + (dollars < 1e6 ? '.' + String(cents).padStart(2, '0') : '');
  };
  TR.fmtClock = function (h) {
    var hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ap = hh >= 12 ? 'PM' : 'AM', h12 = hh % 12 || 12;
    return h12 + ':' + String(mm).padStart(2, '0') + ' ' + ap;
  };

  function el(tag, cls, parent, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; (parent || document.body).appendChild(e); return e; }

  var hud = TR.hud = {
    ui: null, shown: 0, root: null,
    init: function (ui) {
      hud.ui = ui;
      var r = hud.root = el('div', 'hud', ui); r.style.display = 'none';
      var top = el('div', 'hud-top', r);
      hud.bal = el('div', 'hud-bal outlined', top);
      hud.clock = el('div', 'hud-clock', top);
      var rank = el('div', 'hud-rank', r);
      hud.rankName = el('b', '', rank);
      hud.nextT = el('span', '', rank);
      var bar = el('div', 'bar', rank); hud.rankBar = el('i', '', bar);
      var inc = el('div', 'hud-income', r);
      hud.incomeV = el('div', '', inc);
      hud.incomeD = el('small', '', inc);
      hud.mapBox = el('div', 'hud-map', r);
      var bot = el('div', 'hud-bottom', r);
      hud.frenzy = el('div', 'frenzy', bot, '<b>x1</b> FRENZY<div class="bar"><i></i></div>');
      hud.closings = el('div', 'closings', bot);
      hud.carryEl = el('div', 'carry', bot); hud.carryEl.style.display = 'none';
      hud.promptEl = el('div', 'prompt', r, '<div class="p1"></div><div class="p2"></div><div class="bar"><i></i></div>');
      hud.toasts = el('div', 'toasts', r);
    },
    show: function (v) { hud.root.style.display = v ? '' : 'none'; if (v) { hud.shown = 0; } },
    update: function (view, dt) {
      var me = view.me;
      if (me.won) TR.menus.updatePerfect(me);
      // the balance rolls toward the real number
      var diff = me.balance - hud.shown;
      hud.shown = Math.abs(diff) < 100 ? me.balance : hud.shown + diff * Math.min(1, dt * 7);
      hud.bal.textContent = TR.fmtFull(Math.round(hud.shown));
      hud.clock.textContent = view.mode === 'free' ? TR.fmtClock(view.hour) + ' · Free Roam' : TR.fmtClock(view.hour);
      hud.clock.classList.toggle('urgent', view.mode !== 'free' && view.dayMs - view.t < view.dayMs / 24);
      hud.rankName.textContent = me.rank;
      var next = TR.app.nextTrophy(me);
      if (next) { hud.nextT.textContent = 'Next: ' + next.name + ' (' + TR.fmt(next.spent) + ')'; hud.rankBar.style.width = Math.min(100, me.spent / next.spent * 100) + '%'; }
      else { hud.nextT.textContent = 'Every spending trophy earned'; hud.rankBar.style.width = '100%'; }
      var cls = me.income > 0 ? (me.income >= hud.lastInc ? 'up' : 'flat') : me.income < 0 ? 'down' : 'flat';
      hud.lastInc = me.income;
      hud.incomeV.innerHTML = '<span class="' + cls + '">' + (me.income >= 0 ? '+' : '') + TR.fmt(me.income) + '/s</span>';
      hud.incomeD.innerHTML = 'Interest ' + TR.fmt(me.interest) + '/s<br>Businesses ' + (me.biz >= 0 ? '+' : '') + TR.fmt(me.biz) + '/s';
      // frenzy
      var fOn = me.frenzyLeft > 0;
      hud.frenzy.classList.toggle('on', fOn);
      if (fOn) { hud.frenzy.querySelector('b').textContent = 'x' + me.frenzy; hud.frenzy.querySelector('i').style.width = (me.frenzyLeft / me.frenzyWindow * 100) + '%'; }
      // closings
      var html = '';
      me.closings.forEach(function (c) {
        html += '<div class="closing">' + TR.app.itemName(c.item) + ' closing<div class="bar"><i style="width:' + (100 - c.leftMs / c.total * 100) + '%"></i></div></div>';
      });
      if (hud.closHtml !== html) { hud.closings.innerHTML = html; hud.closHtml = html; }
    },
    carry: function (text) { hud.carryEl.style.display = text ? '' : 'none'; hud.carryEl.textContent = text || ''; },
    prompt: function (title, sub, hold, bad) {
      var p = hud.promptEl;
      if (!title) { if (hud.pOn) { p.classList.remove('on'); hud.pOn = false; } return; }
      if (!hud.pOn) { p.classList.add('on'); hud.pOn = true; }
      p.children[0].textContent = title;
      p.children[1].textContent = sub || '';
      p.children[1].style.color = bad ? '#ff8a8a' : '#ffc53d';
      var b = p.children[2]; b.style.display = hold ? '' : 'none';
      if (hold) b.firstChild.style.width = Math.min(100, hold * 100) + '%';
    },
    toast: function (text, kind) {
      var t = el('div', 'toast outlined ' + (kind || ''), hud.toasts, text);
      setTimeout(function () { t.remove(); }, 2800);
      while (hud.toasts.children.length > 4) hud.toasts.firstChild.remove();
    },
    banner: function (text) { var b = el('div', 'banner outlined', hud.root, text); setTimeout(function () { b.remove(); }, 4000); },
    /** The price flies from the pad into the balance. */
    flyPrice: function (text) {
      var f = el('div', 'fly outlined', hud.root, text), W = innerWidth, H = innerHeight;
      f.style.left = (W / 2 - 40) + 'px'; f.style.top = (H * 0.62) + 'px';
      requestAnimationFrame(function () { requestAnimationFrame(function () { f.style.left = (W / 2 - 30) + 'px'; f.style.top = '30px'; f.style.opacity = '0.2'; f.style.transform = 'scale(.6)'; }); });
      setTimeout(function () { f.remove(); hud.bal.classList.remove('bump'); void hud.bal.offsetWidth; hud.bal.classList.add('bump'); }, 700);
    }
  };
})();
