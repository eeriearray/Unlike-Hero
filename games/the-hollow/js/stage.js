/* THE HOLLOW — the stage: the place you are in, drawn large and touchable.
 *
 * It renders a scene from js/scenes/*.js (or, for places without a hand-made scene, the procedural art from js/art.js)
 * as parallax layers, puts a camera on it, and turns objects in the picture into ways of choosing REAL actions.
 * Everything it shows comes from the server's view: which objects can be used, which are spent, how many lanterns
 * still burn (the Haunting Clock), which windows have gone dark. It never decides anything.
 *
 * The DOM here is persistent (built once per place, then only classes and CSS variables change), so the camera and
 * the event animations in js/events.js are never cut off by a re-render. */
(function (g) {
  'use strict';
  var A = g.HollowArt, FX = g.HollowFx, SC = g.HollowScenes = g.HollowScenes || { defs: {} };
  var St = g.HollowStage = {};
  var host = null, world = null, tip = null, lid = null, def = null, built = '', view = null;
  var cam = { tx: 0, ty: 0, z: 1 }, focusId = null, holdN = 0, pendingSt = null, lastSt = null;
  var memo = {};          // per place: options we have seen spent (the view only lists options while an encounter is open)
  SC.assets = SC.assets || {};   // raster files known to exist (see art/README.md); only these are requested

  // ───────────── places without a hand-made scene: procedural art and the old hotspot positions ─────────────
  // (chapel and nursery now have hand-made scenes in js/scenes/; add a place here only while it has none)
  var HOT = {};
  function genericDef(id) {
    var cat = St.cat(), l = cat.locations[id], r = cat.regions[l.region];
    var objs = {};
    Object.keys(HOT[id] || {}).forEach(function (k) { var h = HOT[id][k]; objs[k] = { name: h[2], box: [h[0] - 42, h[1] - 42, 84, 84], at: [h[0], h[1]], crop: [h[0] - 110, h[1] - 80, 220, 120], z: 1.8, actions: [{ opt: k }], halo: true }; });
    return {
      id: id, vb: [640, 260], generic: true, defs: '',
      layers: function () { return [{ id: 'art', depth: 0.4, svg: A.scene(l.scene, id, r.color, l.region, l.glyph), raw: true }, { id: 'objects', depth: 0.4, objects: true }]; },
      objects: objs, state: function () {}, fx: {}
    };
  }
  St.cat = function () { return g.HollowUI.S.cat; };
  St.def = function (id) { return SC.defs[id] || (St.cat() && St.cat().locations[id] ? genericDef(id) : null); };
  St.defFor = function () { return def; };
  St.place = function () { return lid; };

  // ───────────── building ─────────────
  function svgOpen(d, extra) { return '<svg viewBox="0 0 ' + d.vb[0] + ' ' + d.vb[1] + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true"' + (extra || '') + '>'; }
  function objectsSvg(d) {
    var s = svgOpen(d, ' class="objsvg"').replace(' aria-hidden="true"', '') + (d.defs || '') + '<defs><radialGradient id="stg-halo"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset=".5" stop-color="#ffc861" stop-opacity=".16"/><stop offset="1" stop-color="#ffc861" stop-opacity="0"/></radialGradient></defs>';
    Object.keys(d.objects).forEach(function (id) {
      var o = d.objects[id], b = o.box;
      s += '<g class="obj obj-' + id + '" data-obj="' + id + '" data-act="obj" tabindex="0" role="button" aria-label="' + A.esc(o.name) + '">';
      s += '<ellipse class="halo" cx="' + o.at[0] + '" cy="' + o.at[1] + '" rx="' + (b[2] * 0.55) + '" ry="' + (b[3] * 0.5) + '"/>';
      // effects and soft glows sit outside .oart: the hover glow is a CSS filter on .oart, and blurred or very large
      // shapes inside a filtered group make the browser repaint a huge surface on every parallax step (flicker)
      if (o.under) s += '<g class="ofx">' + o.under() + '</g>';
      if (o.art) s += '<g class="oart">' + o.art({}) + '</g>';
      if (o.over) s += '<g class="ofx">' + o.over() + '</g>';
      s += '<rect class="hit" x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" rx="18"/></g>';
    });
    return s + '</svg>';
  }
  function build(id) {
    def = St.def(id); lid = id; focusId = null; lastSt = null;
    if (!def) { world.innerHTML = ''; return; }
    var html = '';
    def.layers({}).forEach(function (L) {
      var src = L.src && SC.assets[L.src] ? '<img class="raster" src="' + L.src + '" alt="" onerror="this.remove()" onload="this.parentNode.classList.add(\'has-raster\')">' : '';
      html += '<div class="lyr lyr-' + L.id + (L.cls ? ' ' + L.cls : '') + '" data-d="' + L.depth + '">' + src +
        (L.objects ? objectsSvg(def) : (L.raw ? L.svg.replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" ') : svgOpen(def) + (def.defs || '') + L.svg + '</svg>')) + '</div>';
    });
    world.innerHTML = html;
    host.setAttribute('data-place', id);
    host.classList.toggle('generic', !!def.generic);
    panX = null; resetCam(true);
    host.classList.add('settle');     // the first state of a new place is shown as it is, not animated into
    setTimeout(function () { if (host) host.classList.remove('settle'); }, 120);
    host.classList.remove('arrive'); void host.offsetWidth; host.classList.add('arrive');
    setTimeout(function () { if (host) host.classList.remove('arrive'); }, 1400);
  }

  St.mount = function (el) {
    if (host === el && host.isConnected) return;
    host = el; built = '';
    host.innerHTML = '<div class="stg-world"></div><div class="stg-dim"></div><div class="stg-cold"></div><div class="stg-vig"></div><div class="stg-fx"></div><div class="stg-tip" role="tooltip"></div>';
    world = host.querySelector('.stg-world'); tip = host.querySelector('.stg-tip');
    host.addEventListener('pointerover', onOver); host.addEventListener('pointerout', onOut);
    host.addEventListener('focusin', onOver); host.addEventListener('focusout', onOut);
    host.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove, { passive: true }); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
  };
  St.el = function () { return host; };

  // ───────────── what each object can do right now, from the real view ─────────────
  // returns { state: 'ok' | 'done' | 'off' | 'wait', why, acts: [{ k, id, o?, ok, why }] }
  St.avail = function (objId, v) {
    v = v || view; var o = def && def.objects[objId]; if (!o || !v) return { state: 'off', acts: [] };
    var G = v.game, mine = G && G.active === v.you && v.me.status === 'alive', enc = v.enc, a = v.act;
    var who = g.HollowUI.pl(G && G.active);
    var acts = o.actions.map(function (x) {
      if (x.opt) {
        var op = enc && enc.kind === 'loc' && enc.loc === lid && enc.options ? enc.options.find(function (q) { return q.id === x.opt; }) : null;
        if (!mine) return { k: 'opt', id: x.opt, o: op, ok: false, done: !!memo[lid + '|' + x.opt], why: who ? who.name.replace(' (ghost)', '') + ' is taking a turn.' : 'Not your turn.' };
        if (!op) {
          // the place's encounter is not open: opening it is free, then the option can be chosen
          var canOpen = !enc && a && a.interact && a.interact.ok;
          return { k: 'opt', id: x.opt, ok: !!canOpen && !memo[lid + '|' + x.opt], open: true, done: !!memo[lid + '|' + x.opt], why: memo[lid + '|' + x.opt] ? 'Already done.' : enc ? 'Finish what is in front of you first.' : 'Nothing to do here now.' };
        }
        return { k: 'opt', id: x.opt, o: op, ok: op.state === 'ok', done: op.state === 'done', why: op.why || '' };
      }
      if (!mine || !a) return { k: x.act ? 'act' : 'move', id: x.act || x.move, ok: false, why: mine ? 'Not now.' : (who ? who.name.replace(' (ghost)', '') + ' is taking a turn.' : 'Not your turn.') };
      var busy = enc && (enc.kind !== 'loc' || enc.hold) && !enc.over;
      if (x.act === 'investigate') {
        var ok = G.ap >= 1 && !busy && (a.investigate.ok || /encounter/.test(a.investigate.why || ''));
        return { k: 'act', id: 'investigate', ok: ok, done: v.map.locs[lid] && v.map.locs[lid].inv, why: G.ap < 1 ? 'No actions left this turn.' : busy ? 'Not while something has you.' : (a.investigate.why || '') };
      }
      if (x.act === 'travel') return { k: 'act', id: 'travel', ok: !(enc && enc.kind === 'event' && !enc.over), why: 'Answer what is in front of you first.' };
      if (x.move) {
        var mv = (a.moves || []).find(function (r) { return r.to === x.move; });
        if (!mv) return { k: 'move', id: x.move, ok: false, why: 'No road from here.' };
        return { k: 'move', id: x.move, ok: mv.ok && G.ap >= 1, why: G.ap < 1 ? 'No actions left this turn.' : (mv.why || ''), mv: mv, done: v.map.locs[x.move] && v.map.locs[x.move].v };
      }
      return { k: 'act', id: x.act, ok: false };
    });
    var any = acts.some(function (x) { return x.ok; }), allDone = acts.length && acts.every(function (x) { return x.done; });
    return { state: any ? 'ok' : allDone ? 'done' : mine ? 'off' : 'wait', why: (acts.find(function (x) { return !x.ok; }) || {}).why || '', acts: acts };
  };
  function remember(opt) { memo[lid + '|' + opt] = true; }
  St.objectFor = function (key) {           // which object stands for an option id or action
    if (!def) return null;
    var ids = Object.keys(def.objects);
    for (var i = 0; i < ids.length; i++) if (def.objects[ids[i]].actions.some(function (x) { return x.opt === key || x.act === key || x.move === key; })) return ids[i];
    return null;
  };

  // ───────────── syncing with the server's view ─────────────
  St.sync = function (v) {
    if (!host) return;
    view = v;
    var place = v.me && (v.me.loc || v.me.fellLoc); if (!place) return;
    if (place !== lid || built !== place) { built = place; build(place); }
    if (!def) return;
    var st = stateOf(v);
    if (holdN > 0) { pendingSt = st; return; }
    apply(st);
  };
  function stateOf(v) {
    var G = v.game, cc = St.cat().cfg, k = G ? Math.min(1, G.clock / cc.clockMax) : 0, done = {};
    // options are listed for the player whose turn it is, so only my own encounter tells me what I have spent
    if (v.enc && v.enc.kind === 'loc' && v.enc.loc === lid && v.enc.options && v.enc.pid === v.you) v.enc.options.forEach(function (o) { if (o.state === 'done') remember(o.id); else if (o.state === 'ok') delete memo[lid + '|' + o.id]; });
    Object.keys(memo).forEach(function (key) { var p = key.split('|'); if (p[0] === lid) done[p[1]] = true; });
    var clues = {}; (v.world.clues || []).forEach(function (c) { clues[c.id] = true; }); (v.me.cluesPrivate || []).forEach(function (c) { clues[c.id] = true; });
    var curses = {}; (v.world.curses || []).forEach(function (c) { curses[c.id] = !!c.active; });
    var avail = {};
    Object.keys(def.objects).forEach(function (id) { avail[id] = St.avail(id, v); });
    return { k: k, phase: G ? G.haunt : 1, done: done, flags: { ledger: !!clues.ledger }, wflags: v.world.flags || {}, curses: curses, inv: !!(v.map.locs[lid] && v.map.locs[lid].inv), avail: avail, mine: G && G.active === v.you };
  }
  function apply(st) {
    var root = world, prev = lastSt; lastSt = st;
    host.style.setProperty('--k', st.k.toFixed(3));
    host.setAttribute('data-phase', st.phase);
    // objects: usable, spent, unavailable
    Object.keys(st.avail).forEach(function (id) {
      var el = root.querySelector('.obj-' + id); if (!el) return;
      var a = st.avail[id];
      el.classList.toggle('can', a.state === 'ok'); el.classList.toggle('spent', a.state === 'done'); el.classList.toggle('off', a.state === 'off' || a.state === 'wait');
      el.setAttribute('aria-label', def.objects[id].name + (a.state === 'ok' ? '' : a.state === 'done' ? ' (already examined)' : ' (' + (a.why || 'not now') + ')'));
    });
    try { def.state(root, st); } catch (e) { /* a scene's decoration must never break the game */ }
    // the Haunting in the picture: windows go dark (far ones first), the lantern string gutters out
    var wins = root.querySelectorAll('.win.lit'), n = wins.length, dark = Math.round(st.k * 1.25 * n);
    wins.forEach(function (w) { var i = +w.getAttribute('data-w'); w.classList.toggle('dark', i < dark); });
    var ls = root.querySelectorAll('.slant'), lit = Math.max(0, ls.length - Math.floor(st.k * (ls.length + 1.2)));
    root.querySelectorAll('.lpool').forEach(function (p) { p.classList.toggle('out', +p.getAttribute('data-lp') >= lit); });
    ls.forEach(function (l, i) {
      var out = i >= lit, was = l.classList.contains('out');
      l.classList.toggle('out', out);
      if (out && !was && prev) { l.classList.add('gutter'); if (g.HollowAudio) g.HollowAudio.sfx('snuff'); setTimeout(function () { l.classList.remove('gutter'); }, 2200); }
    });
  }
  // hold back visual state changes while an event is being shown, so the picture changes at the right beat
  St.hold = function () { holdN++; };
  St.release = function (all) { if (all) holdN = 0; else holdN = Math.max(0, holdN - 1); if (pendingSt && (all || holdN === 0)) { var s = pendingSt; pendingSt = null; apply(s); } };
  St.flush = function () { if (pendingSt) { var s = pendingSt; pendingSt = null; apply(s); } };

  // ───────────── camera ─────────────
  // On tall, narrow screens the world is drawn wider than the screen and can be dragged sideways, so nothing in the
  // picture is out of reach. Elsewhere it fills the stage exactly.
  function sizeWorld() {
    if (!host || !world) return;
    var hw = host.clientWidth || 1, hh = host.clientHeight || 1, vb = def ? def.vb : [1600, 900];
    var ww = hw / hh < 1.3 ? Math.round(Math.min(hh * vb[0] / vb[1], hw * 2.6)) : hw;
    world.style.width = ww > hw ? ww + 'px' : '';
    host.classList.toggle('pannable', ww > hw);
  }
  function metrics() {
    var hw = host.clientWidth || 1, W = world.offsetWidth || hw, H = world.offsetHeight || 1, vb = def ? def.vb : [1600, 900], k = Math.max(W / vb[0], H / vb[1]);
    return { W: W, H: H, hw: hw, k: k, ox: (W - vb[0] * k) / 2, oy: (H - vb[1] * k) / 2 };
  }
  function clampX(tx, z, m) { return Math.min(0, Math.max(m.hw - z * m.W, tx)); }
  function setCam(tx, ty, z, instant) {
    cam = { tx: tx, ty: ty, z: z };
    world.classList.toggle('instant', !!instant || FX.reduced());
    world.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + z.toFixed(3) + ')';
  }
  var panX = null;
  function resetCam(instant) {
    sizeWorld(); var m = metrics();
    setCam(m.W > m.hw ? clampX(panX == null ? (m.hw - m.W) / 2 : panX, 1, m) : 0, 0, 1, instant);
    host.classList.remove('focused'); focusId = null; markFocus();
  }
  St.focus = function (id, opt) {
    if (!def || !def.objects[id]) return;
    opt = opt || {};
    var o = def.objects[id], m = metrics(), small = m.hw < 760;
    var z = Math.min(2.4, (o.z || 1.8) * (small ? 0.75 : 1) * (opt.zoom || 1));
    var sx = m.ox + o.at[0] * m.k, sy = m.oy + o.at[1] * m.k;
    var side = sx < m.W / 2 ? 0.34 : 0.66, T = small ? { x: m.hw / 2, y: m.H * 0.38 } : { x: m.hw * (opt.center ? 0.5 : side), y: m.H * 0.5 };
    var tx = T.x - z * sx, ty = T.y - z * sy;
    tx = clampX(tx, z, m); ty = Math.min(0, Math.max(m.H - z * m.H, ty));
    focusId = id; host.classList.add('focused'); markFocus();
    host.style.setProperty('--fx', (T.x / m.W * 100).toFixed(1) + '%'); host.style.setProperty('--fy', (T.y / m.H * 100).toFixed(1) + '%');
    setCam(tx, ty, z, opt.instant);
  };
  St.unfocus = function () { if (!host) return; resetCam(false); };
  St.focused = function () { return focusId; };
  function markFocus() { if (!world) return; world.querySelectorAll('.obj').forEach(function (e) { e.classList.toggle('foc', e.getAttribute('data-obj') === focusId); }); }
  // where an object is on screen, after the camera (for anchoring cards and launching particles)
  St.pointOf = function (id) {
    var o = def && def.objects[id]; if (!o) return null;
    var m = metrics(), r = host.getBoundingClientRect();
    return { x: r.left + cam.tx + cam.z * (m.ox + o.at[0] * m.k), y: r.top + cam.ty + cam.z * (m.oy + o.at[1] * m.k), side: (cam.tx + cam.z * (m.ox + o.at[0] * m.k)) < m.hw / 2 ? 'r' : 'l' };
  };
  St.rectOf = function (id) {
    var o = def && def.objects[id]; if (!o) return null;
    var m = metrics(), r = host.getBoundingClientRect(), b = o.box;
    var x = r.left + cam.tx + cam.z * (m.ox + b[0] * m.k), y = r.top + cam.ty + cam.z * (m.oy + b[1] * m.k);
    return { left: x, top: y, width: cam.z * b[2] * m.k, height: cam.z * b[3] * m.k };
  };
  addEventListener('resize', function () { if (!host || !world) return; if (focusId) { sizeWorld(); St.focus(focusId, { instant: true }); } else resetCam(true); });
  // drag the wide world sideways (phones); a short tap still touches an object
  var drag = null;
  function onDown(e) { if (!host.classList.contains('pannable') || focusId || e.button > 0) return; drag = { x: e.clientX, tx: cam.tx, moved: false }; }
  function onMove(e) {
    if (!drag) return; var dx = e.clientX - drag.x; if (!drag.moved && Math.abs(dx) < 8) return;
    drag.moved = true; if (tip) tip.classList.remove('on'); var m = metrics(); panX = clampX(drag.tx + dx, 1, m); setCam(panX, 0, 1, true);
  }
  function onUp(e) { if (drag && drag.moved) { var stop = function (ev) { ev.stopPropagation(); ev.preventDefault(); removeEventListener('click', stop, true); }; addEventListener('click', stop, true); setTimeout(function () { removeEventListener('click', stop, true); }, 50); } drag = null; }

  // ───────────── effects hooks used by js/events.js ─────────────
  St.flash = function (cls, ms) { if (!host) return; host.classList.remove(cls); void host.offsetWidth; host.classList.add(cls); setTimeout(function () { if (host) host.classList.remove(cls); }, ms || 1200); };
  St.objFx = function (id, name, ms) {
    var el = world && world.querySelector('.obj-' + id); if (!el) return;
    el.classList.remove('fx-' + name); void el.getBoundingClientRect(); el.classList.add('fx-' + name);
    setTimeout(function () { el.classList.remove('fx-' + name); }, ms || 1800);
  };
  St.fxLayer = function () { return host && host.querySelector('.stg-fx'); };

  // ───────────── hover labels and parallax ─────────────
  function onOver(e) {
    var el = e.target.closest && e.target.closest('.obj'); if (!el || !def) return;
    var id = el.getAttribute('data-obj'), o = def.objects[id], a = lastSt && lastSt.avail[id];
    var r = St.rectOf(id), hr = host.getBoundingClientRect(); if (!r) return;
    tip.innerHTML = '<b>' + A.esc(o.name) + '</b>' + (a && a.state === 'done' ? '<small>examined</small>' : a && a.state !== 'ok' && a.why ? '<small>' + A.esc(a.why) + '</small>' : '');
    tip.style.left = (r.left - hr.left + r.width / 2) + 'px'; tip.style.top = Math.max(8, r.top - hr.top - 8) + 'px';
    tip.classList.add('on'); el.classList.add('hov');
    if (e.type === 'pointerover' && a && a.state === 'ok' && g.HollowAudio) g.HollowAudio.sfx('hover');
  }
  function onOut(e) { var el = e.target.closest && e.target.closest('.obj'); if (el) el.classList.remove('hov'); if (tip) tip.classList.remove('on'); }
  var pxT = 0;
  addEventListener('pointermove', function (e) {
    if (!host || pxT || FX.reduced() || e.pointerType === 'touch') return;
    // each layer's transform is written directly: a CSS variable on the stage would be inherited by every SVG node in
    // the scene, so every mouse move restyled and repainted all of them and parts of the picture blinked in Chrome
    pxT = requestAnimationFrame(function () {
      pxT = 0; if (!host || !world) return;
      var r = host.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * 2 - 1, py = (e.clientY - r.top) / r.height * 2 - 1;
      world.querySelectorAll('.lyr').forEach(function (l) { var d = +l.getAttribute('data-d') || 0; l.style.transform = 'translate3d(' + (px * d * -22).toFixed(1) + 'px,' + (py * d * -11).toFixed(1) + 'px,0)'; });
    });
  }, { passive: true });

  // ───────────── small framed views of objects (interaction cards, action cards) ─────────────
  St.closeup = function (id, cls) {
    var d = def; if (!d || !d.objects[id]) return '';
    var o = d.objects[id], c = o.crop, body = '';
    if (d.generic) body = d.layers({})[0].svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    else {
      var want = [].concat(o.layer || 'mid'), layers = d.layers({}), back = layers.filter(function (L) { return L.id === 'sky' || want.indexOf(L.id) >= 0 || (!o.art && L.id === 'far'); });
      if (!o.art) back = layers.filter(function (L) { return L.id === 'sky' || L.id === 'far' || L.id === 'mid'; });
      body = back.map(function (L) { return L.svg; }).join('') + (o.art ? '<g class="obj obj-' + id + ' ' + St.stateClasses(id) + '">' + (o.under ? o.under() : '') + o.art({}) + (o.over ? o.over() : '') + ((d.extra && d.extra[id]) ? d.extra[id]() : '') + '</g>' : '');
    }
    var vb = d.generic ? ' viewBox="' + c.join(' ') + '"' : ' viewBox="' + c.join(' ') + '"';
    return '<svg class="closeup ' + (cls || '') + '"' + vb + ' preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + (d.defs || '') + body + '</svg>';
  };
  // the same object states the stage shows, for a detached copy of an object (cards)
  St.stateClasses = function (id) {
    var cls = []; if (!lastSt || !def) return '';
    var root = world.querySelector('.obj-' + id); if (!root) return '';
    // every state class a scene's state() set on the object, minus the stage's own bookkeeping
    Array.prototype.forEach.call(root.classList, function (c) { if (!/^(obj|obj-.*|can|spent|off|hov|foc|fx-.*)$/.test(c)) cls.push(c); });
    return cls.join(' ');
  };
})(window);
