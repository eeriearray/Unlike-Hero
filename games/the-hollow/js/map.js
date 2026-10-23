/* THE HOLLOW — the world map: an illustrated, pannable, zoomable SVG map with painted regions, fog of war, medallion
 * markers, legal-route highlighting and hover tooltips. Every marker comes from the server's view; the graph, legal moves
 * and discovery state are the engine's, never decorative. */
(function (g) {
  'use strict';
  var A = g.HollowArt, UI = g.HollowUI, S = UI.S, esc = A.esc;
  var VB = { x: 0, y: 0, w: 1200, h: 840 }, MIN_W = 320, MAX_W = 1400, fitted = false, dragging = false, host = null, tween = null;

  function rng(seed) { var h = 2166136261; for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h += 0x6D2B79F5; var t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hashOf(key) { var h = 0; for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0; return h; }
  function curve(a, b, key) {
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1, off = len * 0.14 * (hashOf(key) & 1 ? 1 : -1);
    return 'M' + a.x + ' ' + a.y + ' Q' + (mx - dy / len * off).toFixed(0) + ' ' + (my + dx / len * off).toFixed(0) + ' ' + b.x + ' ' + b.y;
  }
  function mid(a, b, key) {
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1, off = len * 0.07 * (hashOf(key) & 1 ? 1 : -1);
    return { x: mx - dy / len * off, y: my + dx / len * off };
  }

  // small painted doodads per region (drawn very quietly beneath the markers)
  var DOODAD = {
    village: function (x, y, r) { var s = .8 + r() * .6; return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M-9 0v-11l9-8 9 8v11z" fill="#10161a"/><path d="M-3 0v-6h6v6z" fill="#05070a"/><path d="M12 0v-22" stroke="#10161a" stroke-width="2"/><circle cx="12" cy="-20" r="2" fill="#c9a35b" opacity=".25"/></g>'; },
    estate: function (x, y, r) { var s = .8 + r() * .7; return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M-8 0v-26l8-14 8 14v26z" fill="#120f1c"/><path d="M-2 -16h4v8h-4z" fill="#e5c273" opacity=".18"/><path d="M-14 0v-12l6-6" stroke="#120f1c" stroke-width="3"/></g>'; },
    woods: function (x, y, r) { var s = .7 + r() * .8; return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M0 0v-6M0 -6l-10 0 6-10-5 0 9-14 9 14-5 0 6 10z" fill="#0b1a12"/></g>'; },
    abbey: function (x, y, r) { var s = .8 + r() * .5; return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M-10 0v-22a10 10 0 0 1 20 0v22z" fill="#17160f"/><path d="M-5 -6v-14a5 5 0 0 1 10 0v14z" fill="#c9a35b" opacity=".12"/><path d="M0 -36v-8M-3 -41h6" stroke="#17160f" stroke-width="2"/></g>'; },
    crypt: function (x, y, r) { var s = .8 + r() * .5; return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M-7 0v-14a7 7 0 0 1 14 0v14z" fill="#0a151e"/><path d="M-16 6q8 -5 16 0t16 0" stroke="#4aa5b0" stroke-width="1.5" fill="none" opacity=".35"/></g>'; },
    heart: function (x, y, r) { var s = .7 + r() * 1; return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ') rotate(' + ((r() - .5) * 60).toFixed(0) + ')"><path d="M0 -18l8 14-8 14-8-14z" fill="#1d0f18" stroke="#c0556f" stroke-width="1" opacity=".8"/></g>'; }
  };
  var STATE_COL = { visited: '#c9bfa0', seen: '#6b7590' };

  function terrain(cat, v) {
    var out = '', byReg = {};
    Object.keys(cat.locations).forEach(function (id) { var l = cat.locations[id]; (byReg[l.region] = byReg[l.region] || []).push(l); });
    var seenReg = {}; Object.keys(v.map.locs).forEach(function (id) { seenReg[cat.locations[id].region] = true; });
    out += '<g filter="url(#rough)">';
    Object.keys(byReg).forEach(function (r) {
      var col = cat.regions[r].color;
      byReg[r].forEach(function (l) { out += '<circle cx="' + l.x + '" cy="' + l.y + '" r="140" fill="url(#rg-' + r + ')"/>'; });
    });
    out += '</g>';
    Object.keys(byReg).forEach(function (r) {
      var R = rng('doodad' + r), list = byReg[r];
      for (var i = 0; i < 22; i++) { var l = list[Math.floor(R() * list.length)], a = R() * 6.28, d = 50 + R() * 110; out += '<g opacity=".75">' + DOODAD[r](Math.round(l.x + Math.cos(a) * d), Math.round(l.y + Math.sin(a) * d * .8), R) + '</g>'; }
    });
    return out;
  }

  var ROAD = {
    path: 'M-6 0H6M2-4 6 0 2 4',
    hidden: 'M-7 0Q0-8 7 0Q0 8-7 0ZM0-2V2',
    locked: 'M-4-1V-4A4 4 0 0 1 4-4V-1M-5-1H5V6H-5Z',
    guarded: 'M0-7 6-4V1Q5 5 0 7Q-5 5-6 1V-4Z'
  };
  function roadKind(e) { return e.state === 'locked' ? 'locked' : e.state === 'guarded' || e.state === 'closed' ? 'guarded' : e.type === 'hidden' ? 'hidden' : 'path'; }
  function legend() { return '<div class="chapter-road-key">' + Object.keys(ROAD).map(function (k) { return '<span><svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="' + ROAD[k] + '"/></svg>' + { path: 'Path', hidden: 'Hidden route', locked: 'Locked', guarded: 'Guarded / blocked' }[k] + '</span>'; }).join('') + '</div>'; }

  function render(opts) {
    opts = opts || {};
    var v = S.view, cat = S.cat, locs = v.map.locs, me = UI.me(), act = v.act, mine = v.game.active === v.you;
    var legal = {};
    if (act && mine) {
      act.moves.forEach(function (m) { if (m.ok) legal[m.to] = m.enemy && m.sneak ? 'sneak' : 'step'; });
      act.sprint.forEach(function (s) { if (!legal[s.to]) legal[s.to] = 'sprint'; });
    }
    var sel = S.ui.sel;
    var vbs = VB.x.toFixed(0) + ' ' + VB.y.toFixed(0) + ' ' + VB.w.toFixed(0) + ' ' + VB.h.toFixed(0);
    if (opts.mini) { var b = seenBox(), pad = 90, mw = Math.max(420, b.maxX - b.minX + pad * 2), mh = Math.max(300, b.maxY - b.minY + pad * 2); vbs = ((b.minX + b.maxX) / 2 - mw / 2).toFixed(0) + ' ' + ((b.minY + b.maxY) / 2 - mh / 2).toFixed(0) + ' ' + mw.toFixed(0) + ' ' + mh.toFixed(0); }
    var out = '<svg class="map chapter-map' + (opts.mini ? ' mini' : '') + '" viewBox="' + vbs + '" role="' + (opts.mini ? 'img' : 'group') + '" aria-label="Map of the Hollow">';
    out += '<defs>' + Object.keys(cat.regions).map(function (r) { return '<radialGradient id="rg-' + r + '"><stop offset="0" stop-color="' + cat.regions[r].color + '" stop-opacity=".34"/><stop offset=".6" stop-color="' + cat.regions[r].color + '" stop-opacity=".14"/><stop offset="1" stop-color="' + cat.regions[r].color + '" stop-opacity="0"/></radialGradient>'; }).join('') +
      '<radialGradient id="disc"><stop offset="0" stop-color="#eee1b7"/><stop offset="1" stop-color="#b39b6a"/></radialGradient>' +
      '<filter id="rough" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="3" seed="4"/><feDisplacementMap in="SourceGraphic" scale="60"/></filter>' +
      '<filter id="fogblur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="38"/></filter>' +
      '<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="9"/><feColorMatrix values="0 0 0 0 .8  0 0 0 0 .75  0 0 0 0 .6  0 0 0 .55 0"/></filter>' +
      '<marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#b24a52"/></marker>' +
      '<mask id="fogmask"><rect x="-500" y="-400" width="2300" height="1700" fill="#fff"/>' + Object.keys(locs).map(function (id) { var l = cat.locations[id]; return '<circle cx="' + l.x + '" cy="' + l.y + '" r="' + (locs[id].v ? 230 : 150) + '" fill="#000" filter="url(#fogblur)"/>'; }).join('') + '</mask></defs>';
    out += '<rect x="-500" y="-400" width="2300" height="1700" fill="#d6c394" data-bg="1"/>';
    out += terrain(cat, v);
    // region names, painted into the land
    var seenReg = {}; Object.keys(locs).forEach(function (id) { seenReg[cat.locations[id].region] = true; });
    Object.keys(cat.regionLabels).forEach(function (r) { if (!seenReg[r]) return; var lb = cat.regionLabels[r]; out += '<text class="region-label" x="' + lb[0] + '" y="' + lb[1] + '" text-anchor="middle" font-size="26" letter-spacing="3" fill="' + cat.regions[r].color + '" opacity=".6" style="font-style:italic;font-family:var(--display)">' + esc(cat.regions[r].name) + '</text>'; });
    // fog of war: the unexplored is dim, drifting and mysterious, but not blank
    out += '<rect x="-500" y="-400" width="2300" height="1700" fill="#403e31" opacity=".82" mask="url(#fogmask)"/>';
    out += '<g mask="url(#fogmask)">' + [0, 1, 2, 3, 4, 5].map(function (i) { return '<ellipse class="mfog" cx="' + (100 + i * 220) + '" cy="' + (120 + (i % 3) * 270) + '" rx="260" ry="48" fill="#ded8be" opacity=".12" style="animation-delay:' + (-i * 4) + 's"/>'; }).join('') + '</g>';
    // routes: quiet lines; only the roads you can take now are bright
    v.map.edges.forEach(function (e) {
      var a = cat.locations[e.a], b = cat.locations[e.b], here = me && (e.a === me.loc || e.b === me.loc);
      var isLegal = mine && here && e.state === 'open' && ((e.a === me.loc && legal[e.b]) || (e.b === me.loc && legal[e.a]));
      var blocked = e.state === 'closed' || e.state === 'guarded', locked = e.state === 'locked';
      var col = isLegal ? '#235c49' : blocked ? '#873c35' : locked ? '#825d24' : e.type === 'hidden' ? '#60496e' : '#6c6248';
      var d = curve(a, b, e.k);
      out += '<path class="map-road road-' + roadKind(e) + '" data-route="' + roadKind(e) + '" d="' + d + '" stroke="' + col + '" stroke-width="' + (isLegal ? 4 : 2.4) + '" fill="none" stroke-linecap="round"' + (roadKind(e) === 'hidden' ? ' stroke-dasharray="6 6"' : blocked || locked ? ' stroke-dasharray="2 7"' : '') + (e.oneway ? ' marker-end="url(#arr)"' : '') + ' opacity="' + (isLegal ? 1 : .75) + '"><title>' + esc((e.label ? e.label + ': ' : '') + a.name + (e.oneway ? ' → ' : ' ↔ ') + b.name + (e.why ? ' (' + e.why + ')' : '')) + '</title></path>';
      if (!opts.mini) { var m = mid(a, b, e.k), kind = roadKind(e); out += '<g class="road-symbol" data-route="' + kind + '" aria-hidden="true" transform="translate(' + m.x.toFixed(0) + ' ' + m.y.toFixed(0) + ')"><circle r="11" fill="#eadbb3" stroke="' + col + '" stroke-width="1.5"/><path d="' + ROAD[kind] + '" fill="none" stroke="' + col + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g>'; }
    });
    // places: five clear states: you are here, you can go, dangerous, visited, unexplored
    Object.keys(locs).sort(function (a, b) { return cat.locations[a].y - cat.locations[b].y; }).forEach(function (id) {
      var l = cat.locations[id], st = locs[id], isMe = me && me.loc === id, isSel = sel === id, lg = legal[id];
      var players = v.players.filter(function (p) { return p.loc === id && p.status !== 'escaped' && p.status !== 'lost'; });
      var enemies = v.map.enemies.filter(function (e) { return e.loc === id; });
      var danger = enemies.length > 0 || st.corrupt, big = l.boss || l.finale || l.kind === 'exit', r = opts.mini ? 30 : (big ? 30 : 26);
      var state = isMe ? 'here' : danger ? 'danger' : lg ? 'go' : st.v ? 'seen' : 'new';
      var ring = { here: '#805818', danger: '#8e3538', go: '#286454', seen: '#695c43', new: '#897d65' }[state];
      out += '<g class="node st-' + state + (isSel ? ' sel' : '') + '" tabindex="0" role="button" data-act="selnode" data-loc="' + id + '" transform="translate(' + l.x + ' ' + l.y + ')" aria-label="' + esc(l.name + ', ' + ({ here: 'you are here', danger: 'dangerous', go: 'you can go there', seen: 'visited', new: 'unexplored' })[state]) + '"><circle r="' + (r + 16) + '" fill="transparent"/>';
      if (v.opening && !v.opening.complete && v.opening.target === id) out += '<circle r="' + (r + 12) + '" fill="none" stroke="#f2d798" stroke-width="3" stroke-dasharray="5 5"/><text y="' + (-r - 23) + '" text-anchor="middle" fill="#f2d798">Objective</text>';
      if (isMe) out += '<circle r="' + (r + 7) + '" fill="none" stroke="#e3c680" stroke-width="2" opacity=".5"/>';
      out += '<circle class="ring" r="' + r + '" fill="url(#disc)" stroke="' + ring + '" stroke-width="' + (state === 'new' ? 2 : 3.5) + '"/>';
      var marker = isMe ? 'current_location' : legal[id] ? 'available_destination' : st.v ? 'visited_location' : 'marker_base';
      out += g.HollowGlyphs ? A.glyph('navigation/' + marker, 38).replace('<svg ', '<svg x="-19" y="-19" ') : '<svg x="-16" y="-16" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#352e20" stroke-width="1.7"><path d="' + A.path(st.v ? l.glyph : 'keyhole') + '"/></svg>';
      if (enemies.length) out += '<g transform="translate(' + (r - 4) + ' ' + (-r + 4) + ')"><circle r="10" fill="#3a1218" stroke="#e07a82" stroke-width="2"/><svg x="-7" y="-7" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e07a82" stroke-width="2.6" stroke-linecap="round"><path d="' + A.path('skull') + '"/></svg></g>';
      if (!opts.mini) out += '<text class="lbl" y="' + (r + 18) + '" text-anchor="middle">' + esc(l.name) + '</text>';
      players.forEach(function (p, i) { var n = players.length; out += '<g class="tok" transform="translate(' + ((i - (n - 1) / 2) * 22) + ' ' + (-r - 14) + ')"><circle r="10" fill="' + UI.color(p) + '" stroke="' + (p.id === v.game.active ? '#fff' : '#05070b') + '" stroke-width="2"' + (p.status === 'fallen' ? ' opacity=".4"' : '') + '/><text y="4" text-anchor="middle">' + esc(p.name.charAt(0).toUpperCase()) + '</text></g>'; });
      out += '</g>';
    });
    out += '<rect x="-500" y="-400" width="2300" height="1700" filter="url(#grain)" opacity=".09" style="mix-blend-mode:overlay;pointer-events:none"/>';
    return out + '</svg>';
  }

  function seenBox() {
    var ids = S.view ? Object.keys(S.view.map.locs) : [], minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    ids.forEach(function (id) { var l = S.cat.locations[id]; minX = Math.min(minX, l.x); minY = Math.min(minY, l.y); maxX = Math.max(maxX, l.x); maxY = Math.max(maxY, l.y); });
    if (!ids.length) { minX = 0; minY = 0; maxX = 1200; maxY = 840; }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }
  function aspect() { return host ? Math.max(0.4, host.clientHeight / Math.max(1, host.clientWidth)) : 0.7; }
  function fitAll() {
    var b = seenBox(), pad = 150, bw = Math.max(760, b.maxX - b.minX + pad * 2), bh = Math.max(520, b.maxY - b.minY + pad * 2), asp = aspect(), w = bw, h = w * asp;
    if (h < bh) { h = bh; w = h / asp; }
    VB = { x: (b.minX + b.maxX) / 2 - w / 2, y: (b.minY + b.maxY) / 2 - h / 2, w: w, h: h }; fitted = true;
  }
  function target(locId, wide) {
    var l = S.cat.locations[locId], w = wide || (host && host.clientWidth < 700 ? 560 : 820), h = w * aspect();
    return { x: l.x - w / 2, y: l.y - h / 2, w: w, h: h };
  }
  function apply() { var svg = host && host.querySelector('svg.map'); if (svg) svg.setAttribute('viewBox', VB.x.toFixed(0) + ' ' + VB.y.toFixed(0) + ' ' + VB.w.toFixed(0) + ' ' + VB.h.toFixed(0)); }
  // smooth, deliberate camera moves (instant when reduced motion is on)
  function glideTo(t) {
    cancelAnimationFrame(tween);
    if (g.HollowFx.reduced()) { VB = t; apply(); return; }
    var from = { x: VB.x, y: VB.y, w: VB.w, h: VB.h }, t0 = performance.now(), D = 750;
    (function step(now) { var k = Math.min(1, (now - t0) / D), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; VB = { x: from.x + (t.x - from.x) * e, y: from.y + (t.y - from.y) * e, w: from.w + (t.w - from.w) * e, h: from.h + (t.h - from.h) * e }; apply(); if (k < 1) tween = requestAnimationFrame(step); })(t0);
  }
  function zoom(f, cx, cy) {
    var nw = Math.max(MIN_W, Math.min(MAX_W, VB.w * f)), r = nw / VB.w, px = cx == null ? VB.x + VB.w / 2 : cx, py = cy == null ? VB.y + VB.h / 2 : cy;
    VB = { x: px - (px - VB.x) * r, y: py - (py - VB.y) * r, w: nw, h: VB.h * r }; apply();
  }
  function ensureVisible(locId) {
    var l = S.cat.locations[locId]; if (!l || !host) return;
    var m = 110;
    if (l.x < VB.x + m || l.x > VB.x + VB.w - m || l.y < VB.y + m || l.y > VB.y + VB.h - m) glideTo({ x: l.x - VB.w / 2, y: l.y - VB.h / 2, w: VB.w, h: VB.h });
  }

  // hover tooltip (an HTML element, so it never triggers a re-render)
  function tipHtml(id) {
    var v = S.view, l = S.cat.locations[id], st = v.map.locs[id], reg = S.cat.regions[l.region], me = UI.me();
    if (!st) return '';
    var en = v.map.enemies.filter(function (e) { return e.loc === id; });
    var people = v.players.filter(function (p) { return p.loc === id && p.status === 'alive'; });
    var rumor = v.map.rumors.find(function (r) { return r.loc === id; });
    var mv = v.act && v.game.active === v.you ? v.act.moves.find(function (m) { return m.to === id; }) : null;
    return '<b>' + esc(l.name) + '</b><span class="rg" style="color:' + reg.color + '">' + esc(reg.name) + '</span>' +
      '<div class="tc">' + (st.v ? '<i class="g">visited</i>' : '<i>unexplored</i>') + (me && me.loc === id ? '<i class="y">you are here</i>' : '') + (st.corrupt ? '<i class="r">corrupted</i>' : '') + (st.sealed ? '<i class="g">sealed</i>' : '') + (l.safe && st.v ? '<i class="g">refuge</i>' : '') + (rumor ? '<i class="y">rumored discovery</i>' : '') + (st.ground ? '<i class="y">items here</i>' : '') + '</div>' +
      (en.length ? '<div class="tr">' + en.map(function (e) { return esc(S.cat.enemies[e.id].name); }).join(', ') + '</div>' : '') +
      (people.length ? '<div>' + people.map(function (p) { return esc(p.name); }).join(', ') + '</div>' : '') +
      (mv ? '<div class="' + (mv.ok ? 'tg' : 'tr') + '">' + (mv.ok ? 'Open road' : esc(mv.why)) + '</div>' : '');
  }

  function attach(el) {
    host = el;
    var pts = {}, start = null, moved = false, pinch = null, tip = null;
    var toWorld = function (e) { var svg = host.querySelector('svg.map'), r = svg.getBoundingClientRect(); return { x: VB.x + (e.clientX - r.left) / r.width * VB.w, y: VB.y + (e.clientY - r.top) / r.height * VB.h }; };
    el.addEventListener('wheel', function (e) { if (!e.target.closest('svg.map')) return; e.preventDefault(); cancelAnimationFrame(tween); var w = toWorld(e); zoom(e.deltaY > 0 ? 1.15 : 0.87, w.x, w.y); }, { passive: false });
    el.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('svg.map')) return;
      cancelAnimationFrame(tween); pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 1) { start = { x: e.clientX, y: e.clientY, vx: VB.x, vy: VB.y }; moved = false; }
      if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: VB.w }; }
    });
    el.addEventListener('pointermove', function (e) {
      var node = e.target.closest && e.target.closest('.node[data-loc]'), t = el.querySelector('#maptip');
      if (t) { if (node && !dragging && e.pointerType !== 'touch') { var html = tipHtml(node.dataset.loc); if (html) { t.innerHTML = html; t.classList.add('on'); var r = el.getBoundingClientRect(), x = e.clientX - r.left + 18, y = e.clientY - r.top + 14; t.style.left = Math.min(x, r.width - 250) + 'px'; t.style.top = Math.min(y, r.height - 120) + 'px'; } } else t.classList.remove('on'); }
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts), svg = host.querySelector('svg.map'); if (!svg) return;
      var r2 = svg.getBoundingClientRect();
      if (ids.length === 2 && pinch) { var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y), nw = Math.max(MIN_W, Math.min(MAX_W, pinch.w * pinch.d / Math.max(10, d))), k = nw / VB.w, cx = VB.x + VB.w / 2, cy = VB.y + VB.h / 2; VB = { x: cx - (cx - VB.x) * k, y: cy - (cy - VB.y) * k, w: nw, h: VB.h * k }; moved = true; dragging = true; apply(); return; }
      if (ids.length === 1 && start) {
        var dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) { moved = true; dragging = true; }
        if (moved) { VB.x = start.vx - dx / r2.width * VB.w; VB.y = start.vy - dy / r2.height * VB.h; apply(); }
      }
    });
    el.addEventListener('pointerleave', function () { var t = el.querySelector('#maptip'); if (t) t.classList.remove('on'); });
    var up = function (e) { delete pts[e.pointerId]; if (!Object.keys(pts).length) { start = null; pinch = null; setTimeout(function () { dragging = false; moved = false; }, 30); } };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('click', function (e) { if (moved || dragging) { e.stopPropagation(); e.preventDefault(); } }, true);
  }

  g.HollowMap = {
    attach: attach, render: render, apply: apply, legend: legend, roadKind: roadKind,
    zoomIn: function () { zoom(0.8); }, zoomOut: function () { zoom(1.25); },
    center: function (id) { glideTo(target(id)); }, ensureVisible: ensureVisible,
    fitAll: function () { var keep = VB; fitAll(); var t = VB; VB = keep; glideTo(t); },
    ensureFit: function (locId) { if (!fitted) { fitted = true; if (host && host.clientWidth < 700) VB = target(locId); else fitAll(); } },
    isDragging: function () { return dragging; }, reset: function () { fitted = false; }
  };
})(window);
