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
      hud.mapBox = el('div', 'hud-map', r);
      var bot = el('div', 'hud-bottom', r);
      hud.frenzy = el('div', 'frenzy', bot, '<b>x1</b> COMBO<div class="bar"><i></i></div>');
      r.appendChild(hud.frenzy);
      hud.closings = el('div', 'closings', bot);
      hud.carryEl = el('div', 'carry', bot); hud.carryEl.style.display = 'none';
      hud.promptEl = el('div', 'prompt', r, '<div class="p1"></div><div class="p2"></div><div class="bar"><i></i></div><div class="p3"></div>');
      hud.toasts = el('div', 'toasts', r);
      hud.musicEl = el('button', 'musicbtn', r);
      hud.musicEl.title = 'Music on or off (K)';
      hud.musicEl.onclick = function () { TR.audio.setMusicMuted(!TR.audio.musicMuted); hud.musicEl.blur(); };
      hud.musicBtn();
    },
    musicBtn: function () {
      if (!hud.musicEl) return;
      hud.musicEl.textContent = TR.audio.musicMuted ? 'Music off' : 'Music on';
      hud.musicEl.classList.toggle('off', TR.audio.musicMuted);
    },
    show: function (v) { hud.root.style.display = v ? '' : 'none'; if (v) { hud.shown = null; } },
    update: function (view, dt) {
      var me = view.me;
      if (me.won) TR.menus.updatePerfect(me);
      // the balance rolls toward the real number
      if (hud.shown == null) hud.shown = me.balance;
      var diff = me.balance - hud.shown;
      hud.shown = Math.abs(diff) < 100 ? me.balance : hud.shown + diff * Math.min(1, dt * 7);
      hud.bal.textContent = TR.fmtFull(Math.round(hud.shown));
      hud.clock.textContent = view.mode === 'free' ? TR.fmtClock(view.hour) + ' · Free Roam' : TR.fmtClock(view.hour);
      hud.clock.classList.toggle('urgent', view.mode !== 'free' && view.dayMs - view.t < view.dayMs / 24);
      hud.rankName.textContent = me.rank;
      var next = TR.app.nextTrophy(me);
      if (next) { hud.nextT.textContent = 'Next: ' + next.name + ' (' + TR.fmt(next.spent) + ')'; hud.rankBar.style.width = Math.min(100, me.spent / next.spent * 100) + '%'; }
      else { hud.nextT.textContent = 'Every spending trophy earned'; hud.rankBar.style.width = '100%'; }
      var cls = me.income > 0 ? 'up' : me.income < 0 ? 'down' : 'flat', inc = me.income === 0 ? 'No income' : (me.income > 0 ? '+' : '') + TR.fmt(me.income) + '/s';
      if (hud.incText !== inc) { hud.incText = inc; hud.incomeV.innerHTML = '<span class="' + cls + '">' + inc + '</span>'; }
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
    /** Vehicle wheel: Q opens it, a number key or a click picks. */
    toggleWheel: function (me) { if (hud.wheel) hud.closeWheel(); else hud.openWheel(me); },
    closeWheel: function () { if (hud.wheel) { hud.wheel.remove(); hud.wheel = null; hud.wheelPick = null; } },
    openWheel: function (me) {
      var opts = [], SP = TR.vehicles.SPECS, GR = TR.vehicles.GEAR;
      Object.keys(me.vehicles).forEach(function (k) { if (SP[k]) opts.push({ kind: 'v', id: k, name: SP[k].name }); });
      Object.keys(me.gear).forEach(function (k) { if (GR[k]) opts.push({ kind: 'g', id: k, name: GR[k].name }); });
      if (!opts.length) { hud.toast('Nothing to call yet. Buy a business that comes with one!', 'bad'); return; }
      var w = hud.wheel = el('div', 'wheel', hud.root);
      opts.forEach(function (o, i) {
        var a = i / opts.length * Math.PI * 2 - Math.PI / 2, r = Math.min(170, innerHeight * 0.33), b = el('button', 'wheel-btn', w, '<b>' + (i + 1 < 10 ? i + 1 : '') + '</b> ' + o.name);
        b.style.left = 'calc(50% + ' + Math.cos(a) * r * 1.5 + 'px)'; b.style.top = 'calc(50% + ' + Math.sin(a) * r + 'px)';
        b.onclick = function () { hud.pick(o); };
      });
      hud.wheelPick = function (i) { if (opts[i]) hud.pick(opts[i]); };
      if (document.pointerLockElement) document.exitPointerLock();
    },
    pick: function (o) {
      hud.closeWheel();
      if (o.kind === 'g') { TR.vehicles.setGear(TR.vehicles.gear === o.id ? null : o.id); return; }
      var err = TR.vehicles.summon(o.id);
      if (err) { hud.toast(err, 'bad'); TR.audio.denied(); }
    },
    /** A trophy gets its own moment; several in a row wait their turn. */
    trophy: function (name, sub) {
      hud.tq = hud.tq || [];
      hud.tq.push([name, sub]);
      if (!hud.tBusy) hud.nextTrophy();
    },
    nextTrophy: function () {
      var n = hud.tq.shift();
      if (!n) { hud.tBusy = false; return; }
      hud.tBusy = true;
      var e = el('div', 'trophypop', hud.root, '<div class="cup"></div><div><small>TROPHY EARNED</small><b></b><span></span></div>');
      e.querySelector('b').textContent = n[0]; e.querySelector('span').textContent = n[1] || '';
      TR.audio.buy(3, 4); TR.audio.cheer(0.7);
      TR.fx.confetti(TR.player.pos, 60, 10);
      setTimeout(function () { e.remove(); hud.nextTrophy(); }, 2300);
    },
    /** Big centre-screen moment. */
    bigText: function (a, b) {
      var e = el('div', 'bigtext', hud.root, '<b>' + a + '</b>' + (b ? '<span>' + b + '</span>' : ''));
      setTimeout(function () { e.remove(); }, 1500);
    },
    /** The rubber stamp for a big deal. */
    stamp: function (text) {
      var e = el('div', 'stamp', hud.root, text);
      setTimeout(function () { e.remove(); }, 1400);
    },
    flash: function (k) {
      var e = el('div', 'flash', hud.root); e.style.opacity = k;
      requestAnimationFrame(function () { requestAnimationFrame(function () { e.style.opacity = 0; }); });
      setTimeout(function () { e.remove(); }, 500);
    },
    /** Spree counter: grows with the Frenzy multiplier. */
    spree: function (mult) {
      if (mult < 2) return;
      if (hud.spreeEl) hud.spreeEl.remove();
      var e = hud.spreeEl = el('div', 'spree', hud.root, 'x' + mult + (mult >= 5 ? ' MAX SPREE!' : ' SPREE!'));
      e.style.fontSize = (28 + mult * 12) + 'px';
      setTimeout(function () { e.remove(); }, 900);
    },
    /** A fine ticking up as you wreck the city. */
    damage: function (paid, count) {
      if (!paid) return;
      hud.dmgT = paid + (hud.dmgShow && performance.now() - hud.dmgAt < 2000 ? hud.dmgT : 0);
      hud.dmgAt = performance.now();
      if (!hud.dmgShow) hud.dmgShow = el('div', 'dmg', hud.root);
      hud.dmgShow.textContent = 'PROPERTY DAMAGE ' + TR.fmt(hud.dmgT);
      hud.dmgShow.classList.remove('pop'); void hud.dmgShow.offsetWidth; hud.dmgShow.classList.add('pop');
      clearTimeout(hud.dmgTo);
      hud.dmgTo = setTimeout(function () { if (hud.dmgShow) { hud.dmgShow.remove(); hud.dmgShow = null; hud.dmgT = 0; } }, 1800);
    },
    /** A clue, up long enough to read. */
    clue: function (title, text) {
      var c = el('div', 'cluebox', hud.root, '<b>' + title + '</b><br>' + text);
      setTimeout(function () { c.classList.add('out'); setTimeout(function () { c.remove(); }, 600); }, 8000);
    },
    carry: function (text) { hud.carryEl.style.display = text ? '' : 'none'; hud.carryEl.textContent = text || ''; },
    prompt: function (title, sub, hold, bad, deal) {
      var p = hud.promptEl;
      if (!title) { if (hud.pOn) { p.classList.remove('on'); hud.pOn = false; } return; }
      if (!hud.pOn) { p.classList.add('on'); hud.pOn = true; }
      p.children[0].textContent = title;
      p.children[1].textContent = sub || '';
      p.children[1].style.color = bad ? '#ff8a8a' : '#ffc53d';
      p.children[3].textContent = deal || '';
      p.children[3].style.display = deal ? '' : 'none';
      var b = p.children[2]; b.style.display = hold ? '' : 'none';
      if (hold) b.firstChild.style.width = Math.min(100, hold * 100) + '%';
    },
    toast: function (text, kind) {
      var kids = hud.toasts.children;
      for (var i = 0; i < kids.length; i++) if (kids[i].textContent === text) return;   // never the same line twice
      var t = el('div', 'toast ' + (kind || ''), hud.toasts);
      t.textContent = text;
      setTimeout(function () { t.remove(); }, 2800);
      while (hud.toasts.children.length > 3) hud.toasts.firstChild.remove();
    },
    /** Where you are, in its own spot under the clock. */
    area: function (name) {
      if (!hud.areaEl) hud.areaEl = el('div', 'area', hud.root);
      hud.areaEl.textContent = name;
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
