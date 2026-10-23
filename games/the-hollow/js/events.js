/* THE HOLLOW — event presentation. When the server has resolved something, every client at that place watches it
 * happen in the scene: the camera finds the object, the object reacts, a physical D20 tumbles and lands on the REAL
 * number, success or failure plays out, and each real consequence (from the result's chips, nothing else) travels to
 * where it belongs: clues to the journal, items to the pack, coin to the purse, the Haunting into the lanterns.
 *
 * Reusable: a scene only names its objects and, optionally, an animation per outcome (scene.fx). Places without a
 * hand-made scene get the same sequence centred on the picture. A click, a key, or Esc fast-forwards; reduced motion
 * shortens everything to fades; a watchdog guarantees the table is never blocked for more than a few seconds. */
(function (g) {
  'use strict';
  var A = g.HollowArt, FX = g.HollowFx, St = g.HollowStage, esc = A.esc;
  var E = g.HollowEvents = {};
  var q = [], running = false, skip = false, afterQ = [];
  var AU = function () { return g.HollowAudio; };
  var $ = function (s) { return document.querySelector(s); };

  function wait(ms) {
    return new Promise(function (res) {
      if (skip) return res();
      var t = setTimeout(done, FX.reduced() ? Math.min(ms, 260) : ms), iv = setInterval(function () { if (skip) done(); }, 50);
      function done() { clearTimeout(t); clearInterval(iv); res(); }
    });
  }
  function sfx(n) { if (AU()) AU().sfx(n); }

  E.busy = function () { return running || q.length > 0; };
  E.after = function (fn) { if (E.busy()) afterQ.push(fn); else fn(); };
  E.skip = function () { if (running) skip = true; };

  // ───────────── the queue ─────────────
  function push(job) { q.push(job); if (!running) next(); }
  function next() {
    var job = q.shift();
    if (!job) {
      running = false; document.body.classList.remove('evt-on');
      var fns = afterQ.splice(0); fns.forEach(function (f) { try { f(); } catch (e) { /* keep going */ } });
      if (E.onIdle) E.onIdle();
      return;
    }
    running = true; skip = false; document.body.classList.add('evt-on');
    var finished = false;
    var end = function () { if (finished) return; finished = true; clearTimeout(dog); try { St.release(true); } catch (e) { /* ignore */ } cleanup(); setTimeout(next, 30); };
    var dog = setTimeout(function () { skip = true; setTimeout(end, 400); }, job.max || 11000);
    Promise.resolve().then(job.run).then(end, function (e) { if (g.console) console.warn('event', e); end(); });
  }
  function cleanup() { var L = St.fxLayer(); if (L) L.querySelectorAll('.ev-tmp').forEach(function (e) { e.remove(); }); }
  document.addEventListener('pointerdown', function (e) { if (running && e.target.closest && (e.target.closest('#stagehost') || e.target.closest('.ev-tmp'))) skip = true; }, true);
  document.addEventListener('keydown', function (e) { if (running && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter')) skip = true; }, true);

  // ───────────── pieces ─────────────
  function layer() { return St.fxLayer() || document.body; }
  function add(html, cls) { var d = document.createElement('div'); d.className = 'ev-tmp ' + cls; d.innerHTML = html; layer().appendChild(d); return d; }
  function hostRect() { var h = St.el(); return h ? h.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight }; }
  function centre() { var r = hostRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.45 }; }
  function pointFor(obj) { return (obj && St.pointOf(obj)) || centre(); }
  function local(p) { var r = hostRect(); return { x: p.x - r.left, y: p.y - r.top }; }

  // something flies from a point in the scene to a part of the HUD (the pack, the journal, the purse)
  function fly(html, from, target, cls, ms) {
    var to = typeof target === 'string' ? $(target) : target;
    var el = document.createElement('div'); el.className = 'ev-fly ' + (cls || ''); el.innerHTML = html; document.body.appendChild(el);
    var tr = to ? to.getBoundingClientRect() : { left: innerWidth - 60, top: 20, width: 40, height: 40 };
    var tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
    ms = FX.reduced() || skip ? 300 : (ms || 900);
    var midX = (from.x + tx) / 2, midY = Math.min(from.y, ty) - 90;
    var kf = [{ transform: 'translate(' + from.x + 'px,' + from.y + 'px) translate(-50%,-50%) scale(.6)', opacity: 0 },
      { transform: 'translate(' + from.x + 'px,' + (from.y - 24) + 'px) translate(-50%,-50%) scale(1.15)', opacity: 1, offset: 0.18 },
      { transform: 'translate(' + midX + 'px,' + midY + 'px) translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.55 },
      { transform: 'translate(' + tx + 'px,' + ty + 'px) translate(-50%,-50%) scale(.35)', opacity: 0.2 }];
    return new Promise(function (res) {
      var anim = el.animate ? el.animate(kf, { duration: ms, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' }) : null;
      var fin = function () { el.remove(); if (to) { to.classList.remove('got'); void to.offsetWidth; to.classList.add('got'); setTimeout(function () { to.classList.remove('got'); }, 900); } res(); };
      if (anim) anim.onfinish = fin; else setTimeout(fin, ms);
    });
  }
  function floatAt(p, text, tone) {
    var lp = local(p), d = add('<span>' + esc(text) + '</span>', 'ev-float ' + (tone || ''));
    d.style.left = lp.x + 'px'; d.style.top = lp.y + 'px';
    setTimeout(function () { d.remove(); }, 1800);
  }
  function burst(p, tone, n) {
    if (FX.reduced()) return;
    var lp = local(p);
    for (var i = 0; i < (n || 14); i++) {
      var s = document.createElement('i'); s.className = 'ev-tmp ev-mote ' + (tone || 'gold');
      s.style.left = lp.x + 'px'; s.style.top = lp.y + 'px';
      var a = i / (n || 14) * Math.PI * 2 + Math.random() * 0.3, d = 40 + Math.random() * 70;
      s.style.setProperty('--dx', (Math.cos(a) * d).toFixed(0) + 'px'); s.style.setProperty('--dy', (Math.sin(a) * d * 0.7 - 30).toFixed(0) + 'px');
      layer().appendChild(s); setTimeout(function (x) { return function () { x.remove(); }; }(s), 1300);
    }
  }

  // ───────────── the D20 ─────────────
  // The server has rolled. The die tumbles through a fixed sequence of faces (not random numbers) and lands on roll.d.
  var TIERW = { crit: 'Critical success', ok: 'Success', fail: 'Failure', fumble: 'Critical failure' };
  var STATN = { might: 'Might', wit: 'Wit', fate: 'Fate' };
  function dice(roll, who, label) {
    var tier = roll.tier, el = add('<div class="ev-tray"><svg viewBox="0 0 400 90" aria-hidden="true"><defs><linearGradient id="evfelt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a14"/><stop offset="1" stop-color="#140c08"/></linearGradient></defs><path d="M20 20h360l18 60H2z" fill="url(#evfelt)" stroke="#5a3f27" stroke-width="5" stroke-linejoin="round"/><path d="M30 28h340l12 44H18z" fill="#3a1f1a" opacity=".7"/></svg></div>' +
      '<div class="ev-die"><div class="ev-spin">' + A.die('20', 'ok') + '</div><div class="ev-shadow"></div></div>' +
      '<div class="ev-dlabel"><small>' + esc(who || '') + '</small><b>' + esc(label || '') + '</b><span>' + (roll.stat ? '<i class="sk ' + roll.stat + '">' + (STATN[roll.stat] || roll.stat) + '</i>' : '') + 'Difficulty ' + roll.dc + '</span></div>' +
      '<div class="ev-sum" aria-live="polite"></div><div class="ev-tier t-' + tier + '"></div>', 'ev-dice t-' + tier);
    var spin = el.querySelector('.ev-spin'), sum = el.querySelector('.ev-sum'), tl = el.querySelector('.ev-tier');
    sfx('dice');
    requestAnimationFrame(function () { el.classList.add('roll'); });
    var faces = [], i;
    for (i = 0; i < 12; i++) faces.push(((roll.d * 7 + i * 13) % 20) + 1);
    var n = 0, flick = FX.reduced() ? null : setInterval(function () { var t = spin.querySelector('text'); if (t && !skip) t.textContent = faces[n++ % faces.length]; }, 90);
    return wait(1250).then(function () {
      clearInterval(flick);
      spin.innerHTML = A.die(roll.d, tier); el.classList.add('landed');
      sum.innerHTML = '<b>' + roll.d + '</b> ' + (roll.mod >= 0 ? '+' : '−') + ' ' + Math.abs(roll.mod) + ' = <b>' + roll.total + '</b> <em>vs ' + roll.dc + '</em>' + (roll.rerolled ? ' <small>(rerolled)</small>' : '');
      return wait(520);
    }).then(function () {
      tl.textContent = TIERW[tier] || ''; el.classList.add('told');
      sfx(tier === 'crit' ? 'crit' : tier === 'fumble' ? 'fumble' : tier === 'ok' ? 'success' : 'fail');
      return wait(900);
    }).then(function () { el.classList.add('away'); setTimeout(function () { el.remove(); }, 400); });
  }

  // ───────────── outcome lighting ─────────────
  function tierFx(tier, p) {
    if (tier === 'ok' || tier === 'crit' || tier === 'auto') {
      St.flash(tier === 'crit' ? 'fx-crit' : 'fx-ok', 1500);
      var gl = add('', 'ev-glow'), lp = local(p); gl.style.left = lp.x + 'px'; gl.style.top = lp.y + 'px';
      setTimeout(function () { gl.remove(); }, 1600);
      burst(p, 'gold', tier === 'crit' ? 24 : 12);
    } else {
      St.flash(tier === 'fumble' ? 'fx-fumble' : 'fx-fail', 1700);
    }
  }

  // ───────────── consequences, from the result's chips only ─────────────
  function clueCard(c, from, opts) {
    var cat = St.cat(), id = Object.keys(cat.clues).find(function (k) { return cat.clues[k].title === c.label.replace(/^Clue: /, ''); });
    var meta = id ? cat.clues[id] : { title: c.label.replace(/^Clue: /, '') };
    var ICON = { fate: 'grave', bell: 'bell', entity: 'eye', end: 'book' };
    sfx('clue'); St.flash('fx-discovery', 1200); if (AU()) AU().hush(800);
    var paper = opts && opts.paper;
    var html = paper
      ? '<div class="ev-paperbig"><svg viewBox="0 0 200 240" aria-hidden="true"><defs><linearGradient id="evpp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#efe5c6"/><stop offset="1" stop-color="#bfae86"/></linearGradient></defs><path d="M8 6h184v222l-10 8H8z" fill="url(#evpp)"/><path d="M182 228l10-10v10z" fill="#9a8a68"/>' +
        '<path d="M24 34h120" stroke="#3a2a16" stroke-width="3"/>' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (i) { return '<path class="ink" style="animation-delay:' + (i * 0.06) + 's" d="M24 ' + (56 + i * 13) + 'h' + (70 + ((i * 47) % 80)) + '" stroke="#4a3820" stroke-width="2"/>'; }).join('') +
        '<path d="M24 82h150" stroke="#8a1f2a" stroke-width="2" opacity=".7"/><circle cx="160" cy="206" r="13" fill="#8a1f2a"/><circle cx="158" cy="204" r="5" fill="#b4404c"/></svg><div class="ev-cluetitle"><small>Clue found</small><b>' + esc(meta.title) + '</b></div></div>'
      : '<div class="ev-cluecard"><div class="ic">' + A.glyph(ICON[meta.pillar] || 'book', 46) + '</div><small>Clue found</small><b>' + esc(meta.title) + '</b></div>';
    var el = add(html, 'ev-clue');
    var lp = local(from); el.style.setProperty('--fx', lp.x + 'px'); el.style.setProperty('--fy', lp.y + 'px');
    requestAnimationFrame(function () { el.classList.add('in'); });
    return wait(paper ? 2100 : 1500).then(function () {
      var r = el.firstChild.getBoundingClientRect(); el.remove();
      return fly('<div class="ev-cluechip">' + A.glyph(ICON[meta.pillar] || 'book', 22) + '</div>', { x: r.left + r.width / 2, y: r.top + r.height / 2 }, '#hud-journal', 'clue', 800);
    });
  }

  function consequences(R, obj, mine) {
    var chips = (R.chips || []).filter(function (c) { return c.k !== 'enemy'; }), from = pointFor(obj), seq = Promise.resolve();
    var who = mine ? null : '.hp-p[data-pid="' + R.by + '"]';
    // the Haunting first (it is the world's reaction), then what you gained, then what it cost you
    var order = { clock: 0, clue: 1, item: 2, silver: 3, hint: 4, status: 5, ally: 6, vit: 7, san: 8, xp: 9, glory: 10, stat: 11, ward: 12, chain: 13 };
    chips.sort(function (a, b) { return (order[a.k] == null ? 20 : order[a.k]) - (order[b.k] == null ? 20 : order[b.k]); });
    var released = false, beat = function () { if (E.onBeat) E.onBeat(); };
    chips.forEach(function (c) {
      seq = seq.then(beatAfter(function () {
        if (c.k === 'clock') {
          released = true; St.release(true);
          if (c.n > 0) { sfx('toll'); St.flash('fx-toll', 1600); var hc = $('#hud-clock'); if (hc) { hc.classList.remove('toll'); void hc.offsetWidth; hc.classList.add('toll'); } return wait(1300); }
          return wait(400);
        }
        if (c.k === 'clue') { if (!released) { released = true; St.release(true); } return clueCard(c, from, { paper: obj === 'board' }); }
        if (c.k === 'item' && c.n > 0) {
          var nm = c.label.replace(/^\+ /, ''), cat = St.cat(), iid = Object.keys(cat.items).find(function (k) { return cat.items[k].name === nm; });
          sfx('pickup');
          return fly('<div class="ev-item">' + (iid ? A.itemArt(iid, 54) : A.glyph('chest', 40)) + '<span>' + esc(nm) + '</span></div>', from, who || '#hud-pack', 'item', 1000).then(function () { sfx('stash'); });
        }
        if (c.k === 'item' && c.n < 0) { floatAt(from, c.label, 'bad'); return wait(600); }
        if (c.k === 'silver') {
          if (c.n > 0) { sfx('coin'); var coins = []; for (var i = 0; i < Math.min(4, c.n + 1); i++) coins.push(fly('<div class="ev-coin"></div>', { x: from.x + (i - 1) * 10, y: from.y }, who || '#hud-silver', 'coin', 800 + i * 120)); return Promise.all(coins); }
          floatAt(from, c.label, 'bad'); return wait(600);
        }
        if (c.k === 'hint') {
          var w = add('<span>' + esc(c.label) + '</span>', 'ev-words'), lp = local(from); w.style.left = lp.x + 'px'; w.style.top = lp.y + 'px';
          sfx('whisper'); setTimeout(function () { w.remove(); }, 2600); return wait(1500);
        }
        if (c.k === 'status') {
          var good = c.tone !== 'bad';
          document.querySelectorAll('.hp-p, #hud-me').forEach(function (p) { p.classList.remove(good ? 'bless' : 'curse'); void p.offsetWidth; p.classList.add(good ? 'bless' : 'curse'); setTimeout(function () { p.classList.remove('bless', 'curse'); }, 1800); });
          floatAt(from, c.label, good ? 'good' : 'bad'); if (good) sfx('heal'); return wait(900);
        }
        if (c.k === 'san') {
          if (c.n < 0) { if (mine) { St.flash('fx-san', 1500); sfx('sanity'); } floatAt(mine ? meP() : from, c.label, 'viol'); return wait(1100); }
          floatAt(mine ? meP() : from, c.label, 'good'); sfx('heal'); return wait(700);
        }
        if (c.k === 'vit') {
          if (c.n < 0) { if (mine) { St.flash('fx-hurt', 900); sfx('damage'); } floatAt(mine ? meP() : from, c.label, 'bad'); return wait(800); }
          floatAt(mine ? meP() : from, c.label, 'good'); sfx('heal'); return wait(700);
        }
        if (c.k === 'ally') { sfx('ally'); floatAt(from, c.label, 'good'); return wait(1000); }
        floatAt(mine && (c.k === 'xp' || c.k === 'glory' || c.k === 'stat') ? meP() : from, c.label, c.tone === 'bad' ? 'bad' : 'good');
        return wait(450);
      }, beat));
    });
    return seq.then(beat);
  }
  // the HUD's numbers change when each consequence lands, not before the die has stopped
  function beatAfter(fn, beat) { return function () { var r = fn(); return Promise.resolve(r).then(function () { beat(); }); }; }
  function meP() { var e = $('#hud-me'); if (!e) return centre(); var r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom + 14 }; }

  // ───────────── public: a resolved result at this place ─────────────
  // R is the server's result (opt, oid, tier, roll, chips, lines, by). opts: { mine, who }
  E.play = function (R, opts) {
    opts = opts || {};
    St.hold();          // now, before the next render, so the picture changes on the right beat and not before
    push({ max: 12000, run: function () {
      var obj = St.objectFor(R.oid), d = St.defFor(), focused = St.focused();
      if (obj && focused !== obj) St.focus(obj);
      var p0;
      return wait(obj && focused !== obj ? 650 : 200).then(function () {
        p0 = pointFor(obj);
        if (obj) { St.objFx(obj, 'act', 1400); var o = d.objects[obj]; if (o && o.sfx) sfx(o.sfx); }
        return wait(450);
      }).then(function () {
        if (R.roll) return dice(R.roll, opts.mine ? 'You' : opts.who, R.opt);
      }).then(function () {
        var tier = R.tier, fxn = obj && d.fx && d.fx[obj] ? d.fx[obj](null, tier, R) : null;
        if (obj && fxn) { St.objFx(obj, fxn, 2600); objSound(fxn, d); }
        if (g.HollowCharacters) g.HollowCharacters.result(R);
        tierFx(tier, pointFor(obj));
        return wait(fxn ? 1100 : 700);
      }).then(function () { return consequences(R, obj, opts.mine); })
        .then(function () { St.release(true); return wait(500); })
        .then(function () { if (E.keepFocus !== obj) St.unfocus(); });
    } });
  };
  function objSound(n, d) { if (d && d.fxSfx && d.fxSfx[n]) return sfx(d.fxSfx[n]); var m = { pull: 'paper', crumble: 'whisper', answer: 'water', whisper: 'whisper', ignite: 'ignite', gather: 'paper' }; if (m[n]) sfx(m[n]); }

  // a roll that is being held for a reroll decision: show the die, leave the decision to the panel
  E.holdRoll = function (roll, oid, label, opts) {
    push({ max: 6000, run: function () {
      var obj = St.objectFor(oid);
      if (obj && St.focused() !== obj) St.focus(obj);
      return wait(obj ? 500 : 100).then(function () { return dice(roll, opts && opts.mine ? 'You' : opts && opts.who, label); });
    } });
  };

  // an action with no die (searching, travelling): just the object coming alive while the server answers
  E.intent = function (obj, name) {
    if (!obj) return;
    St.focus(obj); St.objFx(obj, name || 'act', 1600);
    var o = St.defFor() && St.defFor().objects[obj]; if (o && o.sfx) sfx(o.sfx);
  };

  // the table passes to the next player
  E.turn = function (p, cls, mine) {
    var el = document.createElement('div'); el.className = 'ev-turn' + (mine ? ' mine' : '');
    var c = cls ? St.cat().classes[cls] : null;
    el.innerHTML = '<span class="tp" style="--ac:' + (c ? c.color : '#888') + '">' + (cls ? A.portrait(cls, c.color) : '') + '</span><b>' + (mine ? 'Your turn' : esc(p.name.replace(' (ghost)', '')) + '\'s turn') + '</b>';
    var go = function () {
      document.body.appendChild(el); requestAnimationFrame(function () { el.classList.add('in'); });
      document.querySelectorAll('.hp-p').forEach(function (x) { x.classList.toggle('turnflash', x.getAttribute('data-pid') === p.id); });
      setTimeout(function () { el.classList.remove('in'); setTimeout(function () { el.remove(); document.querySelectorAll('.hp-p.turnflash').forEach(function (x) { x.classList.remove('turnflash'); }); }, 400); }, FX.reduced() ? 1200 : 1700);
    };
    E.after(go);
  };

  // items picked up from the ground or gained outside a result (forage, trade): still fly into the pack
  E.gain = function (itemId, from) {
    E.after(function () { sfx('pickup'); fly('<div class="ev-item">' + A.itemArt(itemId, 54) + '</div>', from || centre(), '#hud-pack', 'item', 900).then(function () { sfx('stash'); }); });
  };
})(window);
