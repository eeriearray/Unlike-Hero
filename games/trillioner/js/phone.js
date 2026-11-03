/* Your phone: people call with jobs. Y takes the call, U hangs up. Shows the job you are on and what they said about it after. */
(function () {
  var TR = window.TR = window.TR || {};
  var M = window.TRD.missions, X = window.TRD.extras;

  function el(cls, parent, html) { var e = document.createElement('div'); e.className = cls; if (html != null) e.innerHTML = html; parent.appendChild(e); return e; }
  function clock(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  var ph = TR.phone = {
    faces: {}, ringT: 0,
    init: function () {
      ph.card = el('div', TR.hud.root); ph.card.className = 'phone'; ph.card.style.display = 'none';
      ph.obj = el('job-obj', TR.hud.root); ph.obj.style.display = 'none';
      ph.card.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    },
    reset: function () { ph.showing = null; ph.lastLine = null; if (ph.card) ph.card.style.display = 'none'; if (ph.obj) ph.obj.style.display = 'none'; clearTimeout(ph.lineT); },
    /** Contacts are drawn with the same figures as everyone else. */
    face: function (who) {
      if (ph.faces[who]) return ph.faces[who];
      var c = M.CONTACTS[who], fig = TR.player.figure(c.shirt, c.hair, c.skin);
      TR.wardrobe.dress(fig.parts, c.wear);
      fig.group.updateMatrixWorld(true);
      return (ph.faces[who] = TR.wardrobe.snap(fig.group, 0, 2.5, 0, 1.75));
    },
    draw: function (who, title, text, foot) {
      var c = M.CONTACTS[who], k = ph.card;
      k.style.display = '';
      k.innerHTML = '<div class="ph-top"><img alt="" src="' + ph.face(who) + '"><div><b></b><small></small></div></div><p></p>' + (foot || '');
      k.querySelector('b').textContent = c.name; k.querySelector('small').textContent = title || c.role; k.querySelector('p').textContent = text;
    },
    answer: function (yes) {
      TR.app.session.extra({ t: 'answer', yes: yes });
      ph.showing = null; ph.card.style.display = 'none';
      if (yes) TR.audio.door();
    },
    /** What the caller says when it is over: stays up long enough to read. */
    say: function (who, text, title) {
      ph.draw(who, title, text);
      clearTimeout(ph.lineT);
      ph.lineT = setTimeout(function () { if (!ph.showing) ph.card.style.display = 'none'; }, 6500);
    },
    rewardText: function (r) {
      if (!r) return '';
      if (r.gift) return 'Got ' + X.BY_ID[r.gift].name;
      if (r.heatOff) return 'The Refund Office backs off for ' + r.heatOff + ' seconds';
      if (r.vehicle) return 'Got a ' + TR.vehicles.SPECS[r.vehicle].name;
      if (r.combo) return 'Combo x' + r.combo;
      return '';
    },
    onEvent: function (ev) {
      if (ev.type === 'ring') { ph.ringT = 0; TR.audio.ring(); }
      else if (ev.type === 'jobStart') { TR.audio.buy(1, 1); TR.gps.scan = 0; }
      else if (ev.type === 'jobEnd') {
        TR.gps.scan = 0;
        TR.hud.bigText(ev.won ? 'JOB DONE' : 'JOB BLOWN', ev.won ? ph.rewardText(ev.reward) : '');
        if (ev.won) { TR.audio.cheer(0.6); TR.fx.coins(TR.player.pos, 50, 9); } else TR.audio.denied();
        ph.say(ev.from, ev.line);
      }
    },
    update: function (dt, sess) {
      var me = sess.view.me, r = me.ringing, j = me.job;
      if (r) {
        ph.ringT += dt;
        if (ph.ringT > 2.4) { ph.ringT = 0; TR.audio.ring(); }
        if (ph.showing !== r.id) {
          ph.showing = r.id;
          clearTimeout(ph.lineT);
          ph.draw(r.from, 'Calling...', r.text, '<div class="ph-keys"><span class="y"><kbd>Y</kbd> Take the job</span><span class="n"><kbd>U</kbd> Hang up</span></div><i class="ph-ring"></i>');
          ph.card.querySelector('.y').onclick = function () { ph.answer(true); };
          ph.card.querySelector('.n').onclick = function () { ph.answer(false); };
        }
        var bar = ph.card.querySelector('.ph-ring');
        if (bar) bar.style.width = (r.ringLeft / M.RING_MS * 100) + '%';
        if (TR.input.hit('KeyY')) ph.answer(true);
        else if (TR.input.hit('KeyU')) ph.answer(false);
      } else if (ph.showing) { ph.showing = null; ph.card.style.display = 'none'; }
      ph.obj.style.display = j ? '' : 'none';
      TR.hud.root.classList.toggle('on-job', !!j);
      if (j) {
        var sub = j.type === 'spend' ? TR.fmt(j.count) + ' of ' + TR.fmt(j.amount) : j.need && j.type !== 'combo' ? j.count + ' of ' + j.need : j.type === 'style' ? 'Wearing ' + TR.fmt(ph.worn(me)) + ' of ' + TR.fmt(j.worth) : '';
        var html = '<b></b><em>' + clock(j.leftMs) + '</em>' + (sub ? '<small></small>' : '');
        if (ph.objKey !== j.id) { ph.objKey = j.id; ph.obj.innerHTML = html; ph.obj.querySelector('b').textContent = j.goal; }
        else { ph.obj.querySelector('em').textContent = clock(j.leftMs); }
        var sm = ph.obj.querySelector('small');
        if (sub) { if (!sm) sm = el('small', ph.obj); sm.textContent = sub; } else if (sm) sm.remove();
        ph.obj.classList.toggle('late', j.type !== 'survive' && j.leftMs < 15000);
      } else ph.objKey = null;
    },
    worn: function (me) {
      var sum = 0;
      X.SLOTS.forEach(function (s) { [].concat(me.style[s] || []).forEach(function (id) { sum += X.BY_ID[id].worth || X.BY_ID[id].price; }); });
      return sum;
    }
  };
})();
