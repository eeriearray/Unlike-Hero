/* THE HOLLOW — visual action cards and the interaction card.
 *
 * Every card is one real choice from the server's view (an option of the open encounter, or a standing action such as
 * travelling or searching). Its picture is the object itself, framed from the scene, so the card and the world agree;
 * choices with no object get a small painted vignette instead. Two or three primary cards are shown; the rest wait
 * behind "More". Spent, locked and risky choices look different, and a locked card says why. */
(function (g) {
  'use strict';
  var A = g.HollowArt, UI = g.HollowUI, S = UI.S, St = g.HollowStage, esc = A.esc;
  var C = g.HollowCards = {};
  var STAT = { might: 'Might', wit: 'Wit', fate: 'Fate' };

  // ───────────── painted vignettes for choices with no object in the scene ─────────────
  var VG = '<defs><radialGradient id="cvw"><stop offset="0" stop-color="#ffcf73" stop-opacity=".8"/><stop offset="1" stop-color="#ff9d2e" stop-opacity="0"/></radialGradient><linearGradient id="cvn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1120"/><stop offset="1" stop-color="#1e2433"/></linearGradient><radialGradient id="cvc"><stop offset="0" stop-color="#bfeaf2" stop-opacity=".8"/><stop offset="1" stop-color="#7cc7d6" stop-opacity="0"/></radialGradient><radialGradient id="cvv"><stop offset="0" stop-color="#c9b4ff" stop-opacity=".7"/><stop offset="1" stop-color="#8b6fd1" stop-opacity="0"/></radialGradient></defs>';
  var BG = '<rect width="200" height="140" fill="url(#cvn)"/>';
  var ART = {
    road: BG + '<path d="M0 90q50-30 100-26t100 20v56H0z" fill="#151a24"/><path d="M70 140q20-50 34-76h6q10 30 30 76z" fill="#2b2f3a"/><path d="M104 64h6" stroke="#5a6070"/><g class="cv-fog"><ellipse cx="100" cy="70" rx="80" ry="10" fill="#9aa7b8" opacity=".35"/></g><path d="M30 140V60l10-6 2 86zM166 140V56l10 4v80z" fill="#07080b"/><circle cx="160" cy="30" r="10" fill="#e9ecf5" opacity=".75"/>',
    search: BG + '<circle class="cv-pulse" cx="100" cy="76" r="44" fill="url(#cvw)" opacity=".5"/><path d="M60 118h80l8 22H52z" fill="#2a1d12"/><g transform="translate(100 74)"><circle r="26" fill="none" stroke="#c9a35b" stroke-width="6"/><circle r="22" fill="#c9e4ee" opacity=".18"/><path d="M18 18l22 22" stroke="#5a3f27" stroke-width="9" stroke-linecap="round"/></g>',
    explore: BG + '<path d="M0 140V80l20-10 10 70zM180 140V70l20 8v62z" fill="#07080b"/><path d="M40 140q30-40 60-60t60 60z" fill="#131822"/><g class="cv-fog"><ellipse cx="100" cy="96" rx="90" ry="12" fill="#9aa7b8" opacity=".3"/></g><g transform="translate(118 84)"><path d="M0 0v10" stroke="#3a3c45" stroke-width="2"/><rect x="-5" y="10" width="10" height="14" fill="#1d1610"/><rect class="cv-flame" x="-2.5" y="13" width="5" height="8" fill="#ffc861"/><circle cy="17" r="22" fill="url(#cvw)" opacity=".5"/></g>',
    rest: BG + '<circle class="cv-pulse" cx="100" cy="96" r="60" fill="url(#cvw)" opacity=".6"/><path d="M70 120l60-14M74 106l58 16" stroke="#2a1d12" stroke-width="8" stroke-linecap="round"/><path class="cv-flame" d="M100 116c-16-14-6-28 0-48 6 18 18 30 0 48z" fill="#ff9d3a"/><path class="cv-flame" d="M100 116c-8-8-2-18 0-28 3 10 9 18 0 28z" fill="#ffe08a"/>',
    echo: BG + '<g fill="none" stroke="#b7a2f0"><circle class="cv-ring" cx="100" cy="72" r="16" opacity=".8"/><circle class="cv-ring" cx="100" cy="72" r="16" opacity=".8" style="animation-delay:-1s"/><circle class="cv-ring" cx="100" cy="72" r="16" opacity=".8" style="animation-delay:-2s"/></g><path d="M100 40c-14 0-20 12-20 26 0 16-6 30-12 44 8-2 12 2 16 8 4-6 10-6 16 0 6-6 12-6 16 0 4-6 8-10 16-8-6-14-12-28-12-44 0-14-6-26-20-26z" fill="#cfe0ff" opacity=".35"/>',
    door: BG + '<path d="M70 140V60a30 30 0 0 1 60 0v80z" fill="#1b130c" stroke="#5a3f27" stroke-width="4"/><path d="M100 140V48a30 30 0 0 1 30 12v80z" fill="#0a0705"/><path class="cv-pulse" d="M100 140V52l-24 88z" fill="#ffcf73" opacity=".25"/>',
    might: BG + '<circle class="cv-pulse" cx="100" cy="70" r="50" fill="url(#cvw)" opacity=".25"/><path d="M60 118L136 30l8 8-86 76z" fill="#c8ccd8" stroke="#3a3f52" stroke-width="2"/><path d="M58 104l20 18M50 122l12-12" stroke="#5a3f27" stroke-width="8" stroke-linecap="round"/><path d="M70 106L134 36" stroke="#fff" stroke-width="1.5" opacity=".6"/>',
    wit: BG + '<circle class="cv-pulse" cx="140" cy="54" r="40" fill="url(#cvw)" opacity=".5"/><path d="M40 110q30-14 60 0 30-14 60 0V60q-30-14-60 0-30-14-60 0z" fill="#d9ceaa" stroke="#7a6a48" stroke-width="2"/><path d="M100 60v50" stroke="#7a6a48" stroke-width="2"/><path d="M52 70h36M52 80h30M52 90h36M112 70h36M112 80h30M112 90h34" stroke="#5c4a30" stroke-width="1.6"/><rect x="134" y="40" width="10" height="20" fill="#e8dcc0"/><rect class="cv-flame" x="136" y="30" width="6" height="10" rx="3" fill="#ffc861"/>',
    fate: BG + '<circle cx="100" cy="62" r="34" fill="#e9ecf5" opacity=".85"/><circle cx="114" cy="56" r="32" fill="#0c1120"/><circle class="cv-pulse" cx="100" cy="62" r="60" fill="url(#cvv)" opacity=".35"/><path d="M50 112q50-26 100 0-50 26-100 0z" fill="none" stroke="#b7a2f0" stroke-width="3"/><circle cx="100" cy="112" r="9" fill="#b7a2f0"/><circle cx="100" cy="112" r="4" fill="#0c1120"/>',
    puzzle: BG + '<circle class="cv-pulse" cx="100" cy="70" r="50" fill="url(#cvw)" opacity=".3"/><path d="M100 36a18 18 0 0 0-10 33l-6 40h32l-6-40a18 18 0 0 0-10-33z" fill="#06070a" stroke="#c9a35b" stroke-width="3"/>',
    shop: BG + '<circle class="cv-pulse" cx="100" cy="76" r="54" fill="url(#cvw)" opacity=".4"/><path d="M70 60h14v8l8 10v30H62V78l8-10z" fill="#a8363f" stroke="#2a1b1b" stroke-width="2"/><path d="M112 56h14v8l8 10v34h-30V74l8-10z" fill="#9fd8f0" stroke="#12212e" stroke-width="2" opacity=".9"/><g fill="#d9b25a" stroke="#6a4a1c"><ellipse cx="96" cy="120" rx="12" ry="5"/><ellipse cx="100" cy="114" rx="12" ry="5"/><ellipse cx="94" cy="108" rx="12" ry="5"/></g>',
    flee: BG + '<path d="M0 140V100l200-20v60z" fill="#151a24"/><path d="M60 140l30-60h20l30 60z" fill="#232733"/><g class="cv-fog"><ellipse cx="100" cy="80" rx="80" ry="10" fill="#9aa7b8" opacity=".35"/></g><path d="M150 40l20 10-20 10" stroke="#e07a82" stroke-width="4" fill="none"/>',
    end: BG + '<circle cx="100" cy="64" r="26" fill="none" stroke="#c9a35b" stroke-width="3"/><path d="M100 64V46M100 64l12 8" stroke="#c9a35b" stroke-width="3" stroke-linecap="round"/><path d="M60 120h80" stroke="#3a4560" stroke-width="2"/>'
  };
  C.vignette = function (key, extra) { return '<svg class="closeup vg" viewBox="0 0 200 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + VG + (ART[key] || ART.door) + (extra || '') + '</svg>'; };

  function baseArtFor(c, v) {
    if (c.obj) return St.closeup(c.obj, 'thumb');
    var enc = v.enc;
    if (c.o) {
      if (c.o.kind === 'puzzle') return C.vignette('puzzle');
      if (c.o.kind === 'check') return C.vignette(c.o.stat);
      if (c.o.cost && c.o.cost.silver || /^Buy /.test(c.o.label)) return C.vignette('shop');
      if (c.enemy) return '<span class="foeart2">' + A.enemy(c.enemy) + '</span>';
      return C.vignette('door');
    }
    return C.vignette(c.vg || 'door');
  }
  function itemBadge(option, label) {
    var id = g.HollowPresentation && g.HollowPresentation.itemForOption(option, label);
    return id ? '<span class="ac-item-badge">' + A.itemArt(id, 44) + '</span>' : '';
  }
  function artFor(c, v) { return baseArtFor(c, v) + itemBadge(c.o, c.label); }
  function risk(o) { return !o || o.kind !== 'check' ? '' : o.chance >= 65 ? 'safe' : o.chance >= 40 ? 'mid' : 'bad'; }
  var RW = { safe: 'Good odds', mid: 'Risky', bad: 'Dangerous' };
  function costWords(c) { if (!c) return ''; var o = []; if (c.silver) o.push(c.silver + ' Silver'); if (c.san) o.push(c.san + ' Sanity'); if (c.vit) o.push(c.vit + ' Vitality'); if (c.maxvit) o.push(c.maxvit + ' max Vit'); if (c.item) o.push(UI.item(c.item).name); return o.join(', '); }
  C.costWords = costWords;
  function subFor(o) {
    var bits = [];
    if (o.kind === 'check') bits.push('<i class="sk ' + o.stat + '">' + STAT[o.stat] + '</i>', RW[risk(o)]);
    else if (o.kind === 'puzzle') bits.push('<i class="sk puz">Reasoning</i>');
    if (o.cost) bits.push('<em>' + esc(costWords(o.cost)) + '</em>');
    bits.push(o.ap ? o.ap + ' action' + (o.ap === 1 ? '' : 's') : 'Free');
    if (o.kind === 'check') bits.push(o.chance + '% success');
    if (o.summary) bits.push(esc(o.summary));
    return bits.join(' · ');
  }

  // ───────────── all choices available now, as card descriptors ─────────────
  C.list = function (v) {
    var G = v.game, mine = G.active === v.you, enc = v.enc, a = v.act, out = [];
    if (!mine || !v.me || v.me.status !== 'alive') return out;
    var inEnemy = enc && (enc.kind === 'enemy' || enc.kind === 'boss');
    if (enc && enc.options && !enc.over) enc.options.forEach(function (o) {
      var obj = enc.kind === 'loc' ? St.objectFor(o.id) : null;
      out.push({ k: 'opt', id: o.id, o: o, obj: obj, label: o.label, sub: o.state === 'ok' ? subFor(o) : '', state: o.state === 'ok' ? 'ok' : o.state === 'done' ? 'done' : 'off', why: o.why || '', risk: risk(o), enemy: inEnemy && enc.enemy ? enc.enemy.id : null, pri: o.state === 'ok' ? (obj ? 0 : 1) : 9 });
    });
    if (enc && enc.over) out.push({ k: 'act', id: 'leaveenc', label: 'Continue', sub: 'Move on', vg: 'door', state: 'ok', pri: -1 });
    if (!enc && a && a.interact.ok) out.push({ k: 'act', id: 'interact', label: a.interact.label, sub: 'Free', vg: 'door', state: 'ok', pri: -1 });
    if (a) {
      var objS = St.objectFor('investigate'), busy = enc && (enc.kind !== 'loc' || enc.hold) && !enc.over;
      var invOk = G.ap >= 1 && !busy && (a.investigate.ok || /encounter/.test(a.investigate.why || ''));
      out.push({ k: 'act', id: 'investigate', obj: objS, vg: 'search', label: 'Search for hidden things', sub: '<i class="sk wit">Wit</i> · 1 action', state: invOk ? 'ok' : 'off', why: G.ap < 1 ? 'No actions left this turn.' : a.investigate.why, pri: invOk ? 3 : 9 });
      var expOk = G.ap >= 1 && !busy && (a.explore.ok || /encounter/.test(a.explore.why || ''));
      out.push({ k: 'act', id: 'explore', vg: 'explore', label: 'Wander the surroundings', sub: 'Explore · 1 action', state: expOk ? 'ok' : 'off', why: G.ap < 1 ? 'No actions left this turn.' : a.explore.why, pri: expOk ? 4 : 9 });
      var restOk = G.ap >= 1 && !busy && (a.rest.ok || /encounter/.test(a.rest.why || ''));
      out.push({ k: 'act', id: 'rest-ui', vg: 'rest', label: 'Rest', sub: 'Heal · the Hollow draws closer', state: restOk ? 'ok' : 'off', why: G.ap < 1 ? 'No actions left this turn.' : a.rest.why, pri: 8 });
      if (a.echo.ok) out.push({ k: 'act', id: 'echo', vg: 'echo', label: 'Follow an echo', sub: a.echo.cost ? '−1 Sanity · 1 action' : '1 action', state: 'ok', pri: 7 });
      if (!(enc && enc.kind === 'event' && !enc.over)) out.push({ k: 'act', id: 'travel', obj: inEnemy ? null : St.objectFor('travel'), vg: inEnemy ? 'flee' : 'road', label: inEnemy ? 'Flee' : 'Travel', sub: inEnemy ? 'It strikes as you go' : '1 action', state: G.ap < 1 ? 'off' : 'ok', why: 'No actions left this turn.', travel: true, pri: 50 });
    }
    return out;
  };

  function cardHtml(c, v, small) {
    var cls = 'acard st-' + c.state + (c.recommended ? ' recommended' : '') + (c.risk ? ' rk-' + c.risk : '') + (c.travel ? ' travel' : '') + (small ? ' small' : '') + (S.ui.icard && ((c.k === 'opt' && S.ui.icard.opt === c.id) || (c.obj && S.ui.icard.obj === c.obj)) ? ' sel' : '');
    var badge = c.state === 'done' ? '<span class="ac-badge done">' + A.glyph('eye', 14) + ' Examined</span>' : c.state === 'off' && !/actions left/.test(c.why || '') ? '<span class="ac-badge lock">' + A.glyph('keyhole', 14) + ' Locked</span>' : c.risk === 'bad' ? '<span class="ac-badge bad">Dangerous</span>' : '';
    return '<button class="' + cls + '" data-act="card" data-k="' + c.k + '" data-v="' + esc(c.id) + '"' + (c.state === 'off' ? ' aria-disabled="true"' : '') + ' title="' + esc(c.state === 'off' ? c.why || 'Not now' : c.label) + '">' +
      '<span class="ac-art">' + artFor(c, v) + '</span>' + badge +
      '<span class="ac-txt"><span class="ac-name">' + (c.recommended ? '<small class="ac-recommend">' + (v.opening && v.opening.id === 'response' ? 'Choose a response' : 'Next step') + '</small>' : '') + esc(c.label) + '</span><span class="ac-sub">' + (c.state === 'off' ? esc(c.why || 'Not now') : c.state === 'done' ? 'Already done' : c.sub) + '</span></span></button>';
  }

  // ───────────── the tray ─────────────
  C.tray = function (v) {
    var G = v.game, enc = v.enc, list = C.list(v);
    var inEnemy = enc && (enc.kind === 'enemy' || enc.kind === 'boss');
    var cap = inEnemy ? 4 : 3;
    var guided = v.opening && !v.opening.complete && !inEnemy && !(enc && enc.hold);
    var rec = g.HollowGuidance && g.HollowGuidance.recommend(v);
    var recommended = rec && list.find(function (c) { return c.k === rec.k && c.id === rec.id && c.state === 'ok'; });
    if (recommended) { recommended.recommended = true; recommended.pri = -2; }
    var travel = list.filter(function (c) { return c.travel; })[0];
    var rest = list.filter(function (c) { return !c.travel; });
    var prim = rest.filter(function (c) { return c.state === 'ok' && c.pri < 9; }).sort(function (x, y) { return x.pri - y.pri; }).slice(0, cap);
    // The opening offers a single next step; every alternative stays available.
    if (guided && recommended) { prim = recommended.travel ? [] : [recommended]; travel = recommended.travel ? recommended : null;
      if (v.opening.id === 'response') list.forEach(function (c) { if (c.id === 'muffle' || c.id === 'answer_echo') c.recommended = true; });
      if (!recommended.travel) rest.forEach(function (c) { if (c.state === 'ok' && ['expertise', 'muffle', 'answer_echo'].indexOf(c.id) >= 0 && prim.indexOf(c) < 0) prim.push(c); });
    }
    var more = list.filter(function (c) { return prim.indexOf(c) < 0 && c !== travel; }).sort(function (x, y) { return (x.state === 'ok' ? 0 : x.state === 'done' ? 1 : 2) - (y.state === 'ok' ? 0 : y.state === 'done' ? 1 : 2); });
    var out = '<div class="tray" role="group" aria-label="Your choices">' + prim.map(function (c) { return cardHtml(c, v); }).join('') + (travel ? cardHtml(travel, v) : '');
    if (more.length) out += '<button class="acard morec' + (S.ui.more ? ' sel' : '') + '" data-act="morecards" aria-expanded="' + !!S.ui.more + '"><span class="mstack"><i></i><i></i><i></i></span><span class="ac-txt"><span class="ac-name">Other actions</span><span class="ac-sub">' + more.length + ' other choice' + (more.length === 1 ? '' : 's') + '</span></span></button>';
    out += '<div class="trayend">' + (G.ap < 1 ? '<button class="btn primary endbtn" data-act="endturn">End turn</button>' : '<button class="btn ghost small endbtn" data-act="endturn">End turn early</button>') + '</div></div>';
    if (S.ui.more && more.length) out += '<div class="moresheet" role="dialog" aria-label="More choices"><div class="ms-h"><b>More choices</b><button class="btn ghost small" data-act="morecards">Close</button></div><div class="ms-grid">' + more.map(function (c) { return cardHtml(c, v, true); }).join('') + '</div></div>';
    return out;
  };
  C.find = function (v, k, id) { return C.list(v).find(function (c) { return c.k === k && c.id === id; }); };

  // ───────────── the interaction card, anchored to the object in focus ─────────────
  C.icard = function (v) {
    var ic = S.ui.icard; if (!ic) return '';
    var d = St.defFor(), enc = v.enc, obj = ic.obj, o = obj && d ? d.objects[obj] : null;
    var opt = ic.opt && enc && enc.options ? enc.options.find(function (x) { return x.id === ic.opt; }) : null;
    if (ic.opt && !opt && !ic.waiting) { S.ui.icard = null; return ''; }
    var art = obj ? St.closeup(obj, 'big') : opt && opt.kind === 'check' ? C.vignette(opt.stat) : opt && opt.kind === 'puzzle' ? C.vignette('puzzle') : C.vignette('door');
    art += itemBadge(opt, opt ? opt.label : o ? o.name : '');
    var name = o ? o.name : opt ? opt.label : '';
    var observation = obj && g.HollowPhotoScenes && g.HollowPhotoScenes.describe(v.me.loc, obj, v) || o && o.blurb || '';
    var body = '';
    if (opt && (opt.kind === 'check' || opt.kind === 'puzzle' || opt.needsTarget)) {
      body = '<div class="ic-commit">' + g.HollowStory.prep(opt, enc) + '</div>';
    } else if (ic.waiting) {
      body = '<p class="ic-wait">…</p>';
    } else if (obj) {
      var av = St.avail(obj, v);
      body = '<div class="ic-choices">' + av.acts.map(function (x) {
        var label, sub = '', big = true;
        if (x.k === 'opt') { var oo = x.o; label = oo ? oo.label : labelFor(x.id); sub = oo && oo.state === 'ok' ? subFor(oo) + (oo.kind === 'auto' && oo.stakes ? ' · ' + esc(oo.stakes) : '') : ''; }
        else if (x.id === 'investigate') { label = 'Search for hidden things'; sub = '<i class="sk wit">Wit</i> · 1 action'; }
        else if (x.id === 'travel') { label = 'Choose a road'; sub = '1 action'; }
        else if (x.k === 'move') { label = 'Go to ' + St.cat().locations[x.id].name; sub = '1 action' + (x.mv && x.mv.enemy ? ' · <u>something lurks there</u>' : ''); }
        var state = x.ok ? 'ok' : x.done ? 'done' : 'off';
        return '<button class="icbtn st-' + state + '" data-act="icopt" data-k="' + x.k + '" data-v="' + esc(x.id) + '"' + (x.ok ? '' : ' aria-disabled="true"') + '><b>' + esc(label) + '</b><span>' + (state === 'ok' ? sub : state === 'done' ? 'Already done' : esc(x.why || 'Not now')) + '</span></button>';
      }).join('') + '</div>';
    }
    var pos = '', side = 'c';
    var p = obj ? St.pointOf(obj) : null, host = St.el();
    if (p && host && host.clientWidth >= 760) {
      var hr = host.getBoundingClientRect(), rr = St.rectOf(obj), y = p.y - hr.top, W = 360;
      side = p.side;
      // beside the object, never on top of it (unless the screen is too narrow to avoid it)
      var left = side === 'r' ? Math.min(hr.width - W - 16, rr.left - hr.left + rr.width + 18) : Math.max(16, rr.left - hr.left - 18 - W);
      var top = Math.max(76, Math.min(hr.height - 400, y - 180));
      pos = ' style="left:' + Math.round(left) + 'px;top:' + Math.round(top) + 'px"';
    }
    return '<div class="icard side-' + side + (opt ? ' commit' : '') + (o && (o.closeup || d.photo) ? ' has-detail' : '') + (ic.magnify ? ' detail-magnified' : '') + '" role="dialog" aria-label="' + esc(name) + '"' + pos + '><button class="ic-x" data-act="icclose" aria-label="Close">✕</button>' +
      '<div class="ic-art">' + art + (obj ? '<button class="detail-lens" data-act="detailzoom" aria-pressed="' + !!ic.magnify + '">' + (ic.magnify ? 'Full detail' : 'Magnify') + '</button>' : '') + '</div><div class="ic-body"><h3>' + esc(name) + '</h3>' + (observation && !opt ? '<small class="inspection-free">Inspection · no action spent</small><p class="ic-blurb">' + esc(observation) + '</p>' : '') + body + '</div></div>';
  };
  function labelFor() { return 'Look closer'; }
})(window);
