/* THE HOLLOW — visual effects: drifting dust, screen flashes, floating numbers, the rolling D20.
 * Every effect is tied to a real game event (see app.js → handleLog) and respects reduced-motion preferences. */
(function (g) {
  'use strict';
  var KEY = 'hollow.a11y.v1';
  var P = { motion: 'auto', large: false, contrast: false, distort: true, captions: false, cine: true };
  try { Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage blocked */ }
  var mq = g.matchMedia ? g.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function reduced() { return P.motion === 'on' ? true : P.motion === 'off' ? false : !!mq.matches; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* ignore */ } }
  function apply() {
    var b = document.body;
    b.classList.toggle('reduce-motion', reduced());
    b.classList.toggle('large-text', !!P.large);
    b.classList.toggle('high-contrast', !!P.contrast);
    b.classList.toggle('no-distort', !P.distort);
  }
  if (mq.addEventListener) mq.addEventListener('change', apply);

  // ───────────────────────────── dust ─────────────────────────────
  var dust = { c: null, x: null, parts: [], raf: 0, on: false };
  function startDust() {
    dust.c = document.getElementById('dust'); if (!dust.c) return;
    dust.x = dust.c.getContext('2d');
    var resize = function () { dust.c.width = innerWidth; dust.c.height = innerHeight; };
    resize(); addEventListener('resize', resize);
    for (var i = 0; i < 46; i++) dust.parts.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * 1.6 + 0.3, vx: (Math.random() - 0.5) * 0.12, vy: -Math.random() * 0.12 - 0.02, a: Math.random() * 0.35 + 0.05, p: Math.random() * 6 });
    var tick = function () {
      dust.raf = requestAnimationFrame(tick);
      if (document.hidden || reduced()) { if (dust.on) { dust.x.clearRect(0, 0, dust.c.width, dust.c.height); dust.on = false; } return; }
      dust.on = true;
      var x = dust.x, w = dust.c.width, h = dust.c.height; x.clearRect(0, 0, w, h);
      dust.parts.forEach(function (q) {
        q.x += q.vx + Math.sin(q.p += 0.004) * 0.08; q.y += q.vy;
        if (q.y < -4) { q.y = h + 4; q.x = Math.random() * w; } if (q.x < -4) q.x = w + 4; if (q.x > w + 4) q.x = -4;
        x.beginPath(); x.fillStyle = 'rgba(214,205,180,' + q.a + ')'; x.arc(q.x, q.y, q.r, 0, 6.283); x.fill();
      });
    };
    tick();
  }

  // ───────────────────────────── small effects ─────────────────────────────
  function flash(kind) {
    if (reduced()) return;
    var d = document.createElement('div'); d.className = 'flash flash-' + kind; document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 900);
  }
  function shake(el) { if (!el || reduced()) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); setTimeout(function () { el.classList.remove('shake'); }, 600); }
  function floatText(el, text, tone) {
    if (!el) return;
    var r = el.getBoundingClientRect(), f = document.createElement('div');
    f.className = 'floaty ' + (tone || ''); f.textContent = text;
    f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top + r.height / 2) + 'px';
    document.body.appendChild(f); setTimeout(function () { f.remove(); }, 1600);
  }

  // a brief burst of motes around an element: used when something is discovered
  function sparkle(el, tone) {
    if (!el || reduced()) return;
    var r = el.getBoundingClientRect();
    for (var i = 0; i < 9; i++) {
      var d = document.createElement('i'); d.className = 'spark ' + (tone || 'gold');
      d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = (r.top + r.height / 2) + 'px';
      d.style.setProperty('--dx', (Math.cos(i * 0.7) * (20 + Math.random() * 30)).toFixed(0) + 'px'); d.style.setProperty('--dy', (Math.sin(i * 0.7) * (16 + Math.random() * 26) - 14).toFixed(0) + 'px');
      document.body.appendChild(d); setTimeout(function (x) { return function () { x.remove(); }; }(d), 1100);
    }
  }

  // ───────────────────────────── the D20 ─────────────────────────────
  // The server has already rolled. This only *reveals* that real result: the tumbling numbers are decoration and the
  // final face, modifier, total, DC and consequences are exactly what the rules produced.
  var q = [], busy = false;
  var TIER = { crit: ['Critical success', 'crit'], ok: ['Success', 'ok'], fail: ['Failure', 'fail'], fumble: ['Critical failure', 'fumble'], auto: ['', 'ok'] };
  var STATN = { might: 'Might', wit: 'Wit', fate: 'Fate' };
  function dice(res, audio) { return new Promise(function (resolve) { q.push({ res: res, resolve: resolve, audio: audio }); if (!busy) next(); }); }
  function rolling() { return busy || q.length > 0; }
  function next() {
    var job = q.shift(); if (!job) { busy = false; return; }
    busy = true;
    var r = job.res, roll = r.roll, A = g.HollowArt, layer = document.getElementById('dice-layer'), done = false;
    var tier = roll.tier, t = TIER[tier] || TIER.ok;
    var mods = (roll.mods || []).map(function (m) { return '<span class="dm ' + (m.v < 0 ? 'neg' : 'pos') + '">' + A.esc(m.l) + ' ' + (m.v > 0 ? '+' : '−') + Math.abs(m.v) + '</span>'; }).join('');
    var dcm = (roll.dcMods || []).map(function (m) { return '<span class="dm ' + (m.v > 0 ? 'neg' : 'pos') + '">' + A.esc(m.l) + ' (DC ' + (m.v > 0 ? '+' : '−') + Math.abs(m.v) + ')</span>'; }).join('');
    layer.innerHTML = '<div class="dice-table tier-' + t[1] + '" role="dialog" aria-label="Dice roll"><div class="d-head"><div class="d-who">' + A.esc(r.who || '') + ' attempts</div><div class="d-act">' + A.esc(r.label || '') + '</div>' +
      '<div class="d-meta">' + (roll.stat ? '<span class="stat-b ' + roll.stat + '">' + (STATN[roll.stat] || roll.stat) + '</span>' : '') + '<span>Difficulty <b>' + roll.dc + '</b></span><span>Modifier <b>' + (roll.mod >= 0 ? '+' : '−') + Math.abs(roll.mod) + '</b></span></div>' + (r.stakes ? '<div class="d-stakes">' + A.esc(r.stakes) + '</div>' : '') + '</div>' +
      '<div class="d-stage"><div class="d-shadow"></div><div class="die3d">' + A.die('?', 'ok') + '</div><div class="burst"></div></div>' +
      '<div class="d-sum" aria-live="polite">&nbsp;</div><div class="d-out"></div><div class="dice-mods">' + mods + (dcm ? '<br>' + dcm : '') + '</div><div class="d-cons"></div><div class="dice-hint">Click or press a key to continue</div></div>';
    layer.classList.add('on');
    var card = layer.firstChild, die = card.querySelector('.die3d'), sum = card.querySelector('.d-sum'), out = card.querySelector('.d-out'), cons = card.querySelector('.d-cons');
    var quick = reduced(), flick;
    if (job.audio) job.audio('dice');
    var finish = function () {
      die.innerHTML = A.die(roll.d, tier); die.classList.remove('tumble'); die.classList.add('settled'); card.querySelector('.d-shadow').classList.add('rest');
      sum.innerHTML = '<b>' + roll.d + '</b> ' + (roll.mod >= 0 ? '+' : '−') + ' ' + Math.abs(roll.mod) + ' = <b>' + roll.total + '</b> <span class="vs">against ' + roll.dc + '</span>';
      out.textContent = t[0];
      var chips = (r.chips || []).map(function (c) { return '<span class="chip ' + (c.tone === 'bad' ? 'bad' : 'good') + '">' + A.esc(c.label) + '</span>'; }).join('');
      var story = (r.lines || []).filter(function (l) { return l.k === 'story'; })[0];
      cons.innerHTML = (story ? '<p class="narr">' + A.esc(story.t) + '</p>' : '') + (chips ? '<div class="chipbox">' + chips + '</div>' : '');
      card.classList.add('shown');
      if (tier === 'crit') flash('gold'); else if (tier === 'fumble') { flash('dmg'); shake(card); }
      if (job.audio) job.audio(tier === 'crit' ? 'crit' : tier === 'fumble' ? 'fumble' : tier === 'ok' ? 'success' : 'fail');
      setTimeout(close, quick ? 2200 : (tier === 'crit' || tier === 'fumble' ? 4200 : 3000));
    };
    var close = function () {
      if (done) return; done = true; removeEventListener('keydown', close); layer.removeEventListener('click', close); clearInterval(flick);
      layer.classList.remove('on'); setTimeout(function () { layer.innerHTML = ''; job.resolve(); next(); }, quick ? 0 : 200);
    };
    layer.addEventListener('click', close); setTimeout(function () { addEventListener('keydown', close); }, 900);
    if (quick) { finish(); return; }
    die.classList.add('tumble');
    var n = 0;
    flick = setInterval(function () { n++; var tx = die.querySelector('text'); if (tx) tx.textContent = 1 + Math.floor(Math.random() * 20); if (n > 14) { clearInterval(flick); finish(); } }, 80);
  }

  g.HollowFx = { prefs: P, reduced: reduced, apply: apply, save: save, startDust: startDust, flash: flash, shake: shake, floatText: floatText, dice: dice, rolling: rolling, sparkle: sparkle };
})(window);
