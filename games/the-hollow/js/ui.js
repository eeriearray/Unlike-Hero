/* THE HOLLOW — interface components. Pure functions from the view the server sent (UI.S.view) to HTML strings.
 * Nothing here decides a rule: every number shown comes from the server's view. */
(function (g) {
  'use strict';
  var A = g.HollowArt, esc = A.esc;
  var UI = g.HollowUI = { S: { view: null, cat: null, ui: { tab: 'act', jtab: 'exp', sel: null, name: '', code: '', err: '', busy: false, status: 'connected', moveMode: null } } };
  var S = UI.S;

  // ───────────────────────────── helpers ─────────────────────────────
  var view = function () { return S.view; }, cat = function () { return S.cat; };
  var me = function () { return S.view.players.find(function (p) { return p.id === S.view.you; }); };
  var pl = function (id) { return S.view.players.find(function (p) { return p.id === id; }); };
  var cls = function (id) { return S.cat.classes[id]; };
  var loc = function (id) { return S.cat.locations[id]; };
  var item = function (id) { return S.cat.items[id]; };
  var color = function (p) { return p && p.cls ? cls(p.cls).color : '#888'; };
  var pct = function (a, b) { return Math.max(0, Math.min(100, Math.round(a / b * 100))); };
  var sgn = function (n) { return (n >= 0 ? '+' : '−') + Math.abs(n); };
  var STAT = { might: 'Might', wit: 'Wit', fate: 'Fate' };
  var REGION = function (id) { return S.cat.regions[loc(id).region]; };
  UI.esc = esc; UI.color = color; UI.pl = pl; UI.me = me; UI.loc = loc; UI.item = item; UI.cls = cls;

  function bar(kind, v, max) { return '<div class="bar ' + kind + '" role="progressbar" aria-valuenow="' + v + '" aria-valuemax="' + max + '"><i style="width:' + pct(v, max) + '%"></i></div>'; }
  function statusChips(list) {
    return (list || []).map(function (s) { var d = S.cat.statuses[s]; return d ? '<span class="chip ' + (d.good ? 'good' : 'bad') + '" title="' + esc(d.text) + '">' + esc(d.name) + '</span>' : ''; }).join('');
  }
  function stBadge(stat) { return '<span class="stat-b ' + stat + '">' + STAT[stat] + '</span>'; }
  function costChips(c) {
    if (!c) return '';
    var o = [];
    if (c.silver) o.push('<span class="chip gold">' + c.silver + ' Silver</span>');
    if (c.san) o.push('<span class="chip viol">−' + c.san + ' Sanity</span>');
    if (c.vit) o.push('<span class="chip bad">−' + c.vit + ' Vitality</span>');
    if (c.maxvit) o.push('<span class="chip bad">−' + c.maxvit + ' max Vitality</span>');
    if (c.item) o.push('<span class="chip">' + esc(item(c.item).name) + '</span>');
    return o.join('');
  }
  function itemIcon(id, size) { return A.itemArt(id, size || 28); }
  UI.itemIcon = itemIcon;

  // ───────────────────────────── title ─────────────────────────────
  UI.title = function (o) {
    var online = o.online, solo = o.solo, last = o.last;
    return '<div class="title"><div class="title-art">' + A.scene(['dusk', 'tower', 'dead_trees', 'fog', 'moon'], 'title', '#c9a35b') + '</div>' +
      '<h1 class="logo">THE HOLLOW</h1><div class="logo-sub">Chapter One · The Missing Bell</div>' +
      '<p class="tagline">Thornwick has vanished from every map. Its bell rings every night anyway. Each toll remembers a new name.</p>' +
      '<div class="menu">' +
      '<div class="panel"><div class="field"><label for="f-name">Your name</label><input id="f-name" type="text" maxlength="20" autocomplete="nickname" placeholder="What do the dead call you?" value="' + esc(S.ui.name) + '" data-bind="name"></div></div>' +
      (last ? '<button class="btn primary" data-act="rejoin">Return to expedition ' + esc(last.code) + '</button>' : '') +
      (solo ? '<button class="btn primary" data-act="solo-continue">Continue your solo expedition</button>' : '') +
      (online ? '<button class="btn primary" data-act="host">Host an expedition</button>' : '<div class="note bad small">Online expeditions need the hub server (<code>npm start</code>). Solo play below works anywhere.</div>') +
      (online ? '<div class="panel"><div class="field"><label for="f-code">Join with a code</label><div class="row"><input id="f-code" class="codebox" type="text" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="ABCD" value="' + esc(S.ui.code) + '" data-bind="code"><button class="btn" data-act="join">Join</button></div></div></div>' : '') +
      '<button class="btn" data-act="solo">Play solo' + (online ? '' : ' (offline)') + '<span class="why">1–6 characters; ghost companions can join you</span></button>' +
      '<div class="err" role="alert">' + esc(S.ui.err) + '</div>' +
      '<div class="row wrap"><button class="btn ghost small" data-act="howto">How to play</button><button class="btn ghost small" data-act="settings">Sound &amp; accessibility</button><button class="btn ghost small right" data-act="hub">Back to the hub</button></div>' +
      '</div></div>';
  };

  // ───────────────────────────── lobby ─────────────────────────────
  UI.lobby = function () {
    var v = view(), meP = me(), host = v.hostId === v.you, byCls = {};
    v.players.forEach(function (p) { if (p.cls) byCls[p.cls] = p; });
    var roster = v.players.map(function (p) {
      return '<div class="seat' + (p.id === v.you ? ' me' : '') + '"><div>' + (p.cls ? A.portrait(p.cls, cls(p.cls).color) : '<div class="portrait" style="width:54px;height:58px"></div>') + '</div><div class="grow"><b>' + esc(p.name) + '</b>' + (p.host ? ' <span class="chip gold">Host</span>' : '') + (p.id === v.you ? ' <span class="chip teal">You</span>' : '') + '<div class="small muted">' + (p.cls ? esc(cls(p.cls).name) : 'Choosing…') + (p.connected ? '' : ' · reconnecting…') + '</div></div><div class="col-r" style="text-align:right">' +
        (p.ready || p.host ? '<span class="chip good">Ready</span>' : '<span class="chip">Not ready</span>') + (host && p.id !== v.you && v.players.find(function (x) { return x.id === p.id; }).connected === true && p.id.indexOf('bot') === 0 ? '<br><button class="btn tiny" data-act="kickbot" data-id="' + esc(p.id) + '">Dismiss</button>' : '') + '</div></div>';
    }).join('');
    for (var i = v.players.length; i < 6 && i < 3; i++) roster += '<div class="seat empty small muted">Waiting for another adventurer…</div>';
    var cards = Object.keys(cls ? S.cat.classes : {}).map(function (k) {
      var c = cls(k), taken = byCls[k] && byCls[k].id !== v.you, mine = meP && meP.cls === k;
      return '<button class="cls" data-act="pick" data-cls="' + k + '" aria-pressed="' + !!mine + '"' + (taken ? ' disabled' : '') + '><div>' + A.portrait(k, c.color) + '</div><div><h4>' + esc(c.name) + '</h4><div class="small muted">' + esc(c.title) + '</div><div class="stats"><span class="stat-b might">Might ' + c.stats.might + '</span><span class="stat-b wit">Wit ' + c.stats.wit + '</span><span class="stat-b fate">Fate ' + c.stats.fate + '</span><span class="chip bad">♥ ' + c.vit + '</span><span class="chip viol">✦ ' + c.san + '</span></div>' +
        '<p class="ab"><b>' + esc(c.passive.name) + '.</b> ' + esc(c.passive.text) + '</p><p class="ab"><b>' + esc(c.active.name) + '.</b> ' + esc(c.active.text) + '</p><p class="small muted">' + esc(c.weakness) + '</p><p class="story">' + esc(c.backstory) + ' ' + esc(c.reason) + '</p>' + (taken ? '<p class="small"><span class="chip">Taken by ' + esc(byCls[k].name) + '</span></p>' : '') + '</div></button>';
    }).join('');
    var st = v.settings;
    var canStart = meP && meP.cls && v.players.every(function (p) { return p.cls && (p.ready || p.host || p.id.indexOf('bot') === 0 || !p.connected); });
    return '<div class="lobby"><div class="lobby-head">' + (S.net && S.net.kind === 'online' ? '<div><div class="tag">Expedition code</div><div class="roomcode" aria-label="Room code ' + esc(v.code.split('').join(' ')) + '">' + esc(v.code) + '</div></div><button class="btn small" data-act="copylink">Copy invite link</button>' : '<div><div class="tag">Chapter One</div><div class="roomcode" style="letter-spacing:.12em;font-size:1.5rem">The Missing Bell</div></div><span class="chip">Solo expedition</span>') +
      '<div class="grow"></div><button class="btn ghost small" data-act="howto">How to play</button><button class="btn ghost small" data-act="settings">Settings</button><button class="btn small danger" data-act="leave">Leave</button></div>' +
      '<div class="col"><div class="panel"><h3>The party (' + v.players.length + '/6)</h3><div class="roster">' + roster + '</div>' +
      '<hr class="div"><div class="row wrap">' + (host ? '<button class="btn small" data-act="addbot"' + (v.players.length >= 6 ? ' disabled' : '') + '>+ Ghost companion</button>' : '') + '<span class="small muted">Companions are AI-played ghosts, for solo play or testing.</span></div></div>' +
      '<div class="panel"><h3>Table rules</h3>' +
      (host ? '<div class="field"><label for="f-afk">If a player goes quiet</label><select id="f-afk" data-act="setafk"><option value="skip"' + (st.afk === 'skip' ? ' selected' : '') + '>Skip their turns</option><option value="ai"' + (st.afk === 'ai' ? ' selected' : '') + '>A ghost-hand plays for them</option><option value="wait"' + (st.afk === 'wait' ? ' selected' : '') + '>Wait up to 5 minutes</option></select></div><div class="field" style="margin-top:8px"><label for="f-turn">Turn timer</label><select id="f-turn" data-act="setturn">' + [60, 90, 150, 240, 420].map(function (s) { return '<option value="' + s + '"' + (st.turnSec === s ? ' selected' : '') + '>' + (s < 120 ? s + ' seconds' : s / 60 + ' minutes') + '</option>'; }).join('') + '</select></div>' :
        '<p class="small">' + esc(v.policy) + ' Turns last ' + Math.round(st.turnSec / 60 * 10) / 10 + ' minutes.</p>') +
      '<p class="small muted">A player who disconnects keeps their seat and can rejoin at any time. After 40 seconds away the table\'s rule applies.</p></div>' +
      '<div class="panel"><button class="btn primary" style="width:100%" data-act="start"' + (host && canStart ? '' : ' disabled') + '>' + (host ? 'Set out' : 'Waiting for the host') + '</button>' +
      (host ? '<div class="why">' + (canStart ? (v.players.length === 1 ? 'Solo expedition (add companions for company).' : 'Everyone is ready.') : (meP && meP.cls ? 'Waiting for everyone to choose a character and be ready.' : 'Choose your character first.')) + '</div>' : '') +
      (!host ? '<button class="btn" style="width:100%;margin-top:8px" data-act="ready">' + (meP && meP.ready ? 'Not ready' : 'Ready') + '</button>' : '') + '</div></div>' +
      '<div class="picker"><div class="panel"><h3>Choose your character</h3><div class="classes">' + cards + '</div></div></div></div>';
  };

  // ───────────────────────────── header ─────────────────────────────
  UI.header = function () {
    var v = view(), G = v.game, cc = S.cat.cfg, ph = G.haunt, names = S.cat.phaseName;
    var warnings = ['The dark is quiet. For now.', 'The Hollow has learned your names.', 'The Hollow is awake. The Gate stands open.'];
    var left = cc.clockMax - G.clock, ticks = '';
    for (var i = 0; i < cc.clockMax; i++) { var pp = i >= cc.phaseAt[1] ? 3 : i >= cc.phaseAt[0] ? 2 : 1; ticks += '<i class="tk p' + pp + (i < G.clock ? ' on' : '') + (i === G.clock - 1 ? ' cur' : '') + (i === cc.phaseAt[0] || i === cc.phaseAt[1] ? ' gap' : '') + '"></i>'; }
    var a = AUDIO ? AUDIO.settings() : { muted: false }, act = pl(G.active), m = v.me;
    var turn = act ? (act.id === v.you ? '<b class="mine">Your turn</b>' : '<b>' + esc(act.name) + '\'s turn</b>') : '';
    var res = m && m.status === 'alive' ? '<div class="resbar"><span class="rp">' + A.portrait(m.cls, cls(m.cls).color) + '</span><span class="rb"><i class="vit" style="width:' + pct(m.vit, m.maxVit) + '%"></i></span><span class="rn">' + m.vit + '</span><span class="rb"><i class="san" style="width:' + pct(m.san, m.maxSan) + '%"></i></span><span class="rn">' + m.san + '</span><span class="grow"></span><span class="rturn">' + (act ? (act.id === v.you ? 'Your turn' : esc(act.name) + '\'s turn') : '') + '</span>' + (G.active === v.you ? UI.apPips() : '') + '</div>' : '';
    return '<header class="top" data-phase="' + ph + '"><div class="brand"><span class="mark">The Hollow</span><span class="chap">Chapter One · The Missing Bell</span></div>' +
      '<div class="clockbox" role="img" aria-label="Haunting Clock ' + G.clock + ' of ' + cc.clockMax + '. Phase ' + ph + ': ' + esc(names[ph - 1]) + '"><div class="clocktop"><span class="phase">Phase ' + ['I', 'II', 'III'][ph - 1] + ' · ' + esc(names[ph - 1]) + '</span><span class="muted">' + esc(warnings[ph - 1]) + (left <= 6 ? ' <b class="hot">' + left + ' tolls left</b>' : '') + '</span></div><div class="ticks">' + ticks + '</div></div>' +
      '<div class="hmeta"><span class="rd">Round ' + G.round + '</span>' + turn + '<span class="muted noise" title="Noise: at ' + cc.noiseMax + ' the Haunting advances">Noise ' + G.noise + '/' + cc.noiseMax + '</span></div>' +
      '<div class="hbtns"><button class="btn ghost icon-btn" data-act="mute" aria-label="' + (a.muted ? 'Unmute' : 'Mute') + '" title="' + (a.muted ? 'Unmute' : 'Mute') + '">' + A.glyph(a.muted ? 'moon' : 'bell', 22) + '</button><button class="btn ghost icon-btn" data-act="settings" aria-label="Sound and accessibility settings" title="Settings">' + A.glyph('circle', 22) + '</button><button class="btn ghost icon-btn" data-act="menu" aria-label="Menu" title="Menu">' + A.glyph('door', 22) + '</button></div></header>' + res;
  };
  var AUDIO = null; UI.setAudio = function (a) { AUDIO = a; };

  // ───────────────────────────── left column ─────────────────────────────
  var CLS_ART = { occultist: ['eye', 'Reads the margins of the world'], hunter: ['snare', 'Walks the wolf-roads'], apothecary: ['herb', 'Mends with what grows'], medium: ['moon', 'Listens at the thin place'], vagabond: ['key', 'No door stays shut'], exorcist: ['chain', 'Seals what should not walk'] };
  var STAT_ICON = { might: 'sword', wit: 'book', fate: 'moon' };
  UI.left = function () {
    var v = view(), m = v.me, p = me(), c = cls(m.cls), art = CLS_ART[m.cls] || ['eye', ''];
    var lvlPct = m.xpNext ? pct(m.xp - m.xpPrev, m.xpNext - m.xpPrev) : 100;
    var out = '<section class="sheet cls-' + m.cls + '" style="--ac:' + c.color + '"><div class="sh-head"><div class="frame">' + A.portrait(m.cls, c.color) + '</div><div class="grow"><h2>' + esc(p.name) + '</h2><div class="clsline"><span class="emb">' + A.glyph(art[0], 20) + '</span>' + esc(c.name) + '</div><div class="small muted">' + esc(art[1]) + '</div><div class="lvl-line">Level ' + m.level + ' <span class="muted">' + (m.xpNext ? m.xp + '/' + m.xpNext + ' xp' : 'max') + ' · Glory ' + m.glory + '</span></div><div class="bar xp thin"><i style="width:' + lvlPct + '%"></i></div></div></div>' +
      '<div class="vitals"><div class="vrow" title="Vitality: physical survival"><span class="vi">' + A.glyph('heart', 20) + '</span><span class="vn">Vitality</span>' + bar('vit', m.vit, m.maxVit) + '<b>' + m.vit + '<small>/' + m.maxVit + '</small></b></div>' +
      '<div class="vrow" title="Sanity: the mind\'s hold on the world"><span class="vi">' + A.glyph('eye', 20) + '</span><span class="vn">Sanity</span>' + bar('san', m.san, m.maxSan) + '<b>' + m.san + '<small>/' + m.maxSan + '</small></b></div></div>' +
      '<div class="atts">' + ['might', 'wit', 'fate'].map(function (s) { var d = m.eff[s] - m.stats[s]; return '<div class="att" title="' + STAT[s] + ' modifier added to the d20' + (d ? ' (' + sgn(d) + ' from items)' : '') + '"><span class="ai">' + A.glyph(STAT_ICON[s], 18) + '</span><b>' + sgn(m.eff[s]) + '</b><span>' + STAT[s] + '</span></div>'; }).join('') + '<div class="att coin" title="Silver buys supplies and passage"><span class="ai">' + A.glyph('chest', 18) + '</span><b>' + m.silver + '</b><span>Silver</span></div></div>' +
      '<div class="chips-row conds">' + statusChips(m.sts) + (m.ward ? '<span class="chip teal" title="The next Sanity loss is blocked">Warded</span>' : '') + (m.thread ? '<span class="chip teal" title="Your next move is safe">Thread laid</span>' : '') + (m.pact ? '<span class="chip viol">Pact sealed</span>' : '') + (m.unnoticed ? '<span class="chip teal">Unnoticed</span>' : '') +
      m.skills.map(function (s) { var u = S.cat.upgrades.find(function (x) { return x.id === s; }); return '<span class="chip" title="' + esc(u.text) + '">' + esc(u.name) + '</span>'; }).join('') + '</div>';
    if (m.hallu) out += '<p class="note small">Your nerves are ' + (m.hallu > 1 ? 'in tatters' : 'fraying') + '. Descriptions may lie to you. Numbers never do.</p>';
    if (m.offer) out += '<div class="lvlup"><h3>Level up' + (m.pendingLevels > 1 ? ' (' + m.pendingLevels + ' waiting)' : '') + '</h3>' + m.offer.map(function (o) { return '<button class="btn small" data-act="levelup" data-pick="' + o.id + '"><span><b>' + esc(o.name) + '</b><span class="why">' + esc(o.text) + '</span></span></button>'; }).join('') + '</div>';
    if (m.ability) { var ab = m.ability; out += '<div class="gift"><h3>' + A.glyph(art[0], 18) + ' ' + esc(ab.name) + '</h3><p class="small">' + esc(c.active.text) + (m.abilityLvl ? ' <b>Deepened: ' + esc(S.cat.abilityUp[m.cls]) + '</b>' : '') + '</p>' + UI.abilityButtons(ab, m) + '</div>'; }
    out += '</section>';
    out += '<section class="pack"><h3>Pack <span class="muted">' + m.pack + '/' + m.packMax + '</span></h3><div class="inv">' + UI.slots(m) + '</div></section>';
    return out + UI.partyPanel();
  };

  UI.abilityButtons = function (ab, m) {
    var why = ab.ok ? '' : '<span class="why">' + esc(ab.why) + '</span>';
    var k = ab.kind;
    if (ab.passiveOnly) return '<div class="small muted">' + esc(ab.why) + '</div>';
    if (k === 'hunter') return '<button class="btn small" data-act="ability"' + (ab.ok ? '' : ' disabled') + '>Set a snare here (1 action)</button>' + why;
    if (k === 'medium') return '<button class="btn small" data-act="ability-medium"' + (ab.ok ? '' : ' disabled') + '>Calm the Dead (1 action)</button>' + why;
    if (k === 'vagabond') return '<div class="small">Uses left this phase: <b>' + ab.left + '</b></div>' + why + '<div class="small muted">Use it from a confrontation (choose an exit there).</div>';
    if (k === 'apothecary') return '<div class="chips-row"><button class="btn small" data-act="brew" data-make="tonic"' + (ab.ok ? '' : ' disabled') + '>Brew a Tonic</button><button class="btn small" data-act="brew" data-make="salt"' + (ab.ok ? '' : ' disabled') + '>Brew Salt Charm</button><button class="btn small" data-act="brew" data-make="clarity"' + (ab.ok ? '' : ' disabled') + '>Clarity (+3 San)</button></div>' + why + '<div class="small muted">Costs ' + ab.need + ' Gravemoss.</div>';
    if (k === 'exorcist') {
      return '<div class="small">Rites left: <b>' + ab.left + '</b></div><div class="chips-row" style="margin-top:6px"><button class="btn small" data-act="rite" data-mode="purify"' + (ab.ok && ab.corrupt ? '' : ' disabled') + ' title="Cleanse this corrupted place">Purify here</button><button class="btn small" data-act="rite" data-mode="seal"' + (ab.ok ? '' : ' disabled') + ' title="Enemies cannot enter for 3 rounds">Seal here</button><button class="btn small" data-act="rite" data-mode="banish"' + (ab.ok && ab.spirits ? '' : ' disabled') + ' title="Banish a weak spirit in this place">Banish a spirit</button></div>' +
        (ab.curses && ab.curses.length ? '<div class="chips-row" style="margin-top:6px">' + ab.curses.map(function (cu) { return '<button class="btn small" data-act="rite" data-mode="cleanse" data-curse="' + cu.id + '"' + (ab.ok ? '' : ' disabled') + '>Cleanse: ' + esc(cu.name) + '</button>'; }).join('') + '</div>' : '') + why;
    }
    return '';
  };

  UI.slots = function (m) {
    var out = [], used = 0;
    m.inv.forEach(function (e) {
      var d = item(e.id), sz = d.size || 1;
      var uses = e.uses != null ? '<span class="q" title="charges">' + e.uses + '</span>' : (e.n > 1 ? '<span class="q">×' + e.n + '</span>' : '');
      out.push('<button class="slot ' + (d.kind === 'relic' ? 'relic ' : d.kind === 'key' ? 'key ' : '') + (e.eq ? 'is-eq ' : '') + '" data-act="item" data-item="' + e.id + '" data-slot="' + e.id + '" aria-label="' + esc(d.name) + (e.n > 1 ? ', ' + e.n : '') + (e.eq ? ', equipped' : '') + '">' + A.itemArt(e.id, 42) + '<span class="nm">' + esc(d.name) + '</span>' + (e.eq ? '<span class="eq">equipped</span>' : '') + uses + '</button>');
      used += sz;
      if (sz > 1) out.push('<div class="slot empty" aria-hidden="true">heavy</div>');
    });
    for (var i = used; i < m.packMax; i++) out.push('<div class="slot empty" aria-hidden="true"></div>');
    return out.join('');
  };

  UI.partyPanel = function () {
    var v = view(), meP = me();
    var rows = v.players.filter(function (p) { return p.id !== v.you; }).map(function (p) {
      var c = cls(p.cls), here = p.loc === meP.loc && p.status === 'alive' && meP.status === 'alive', ld = p.loc ? loc(p.loc) : null;
      return '<div class="party-row' + (p.status === 'fallen' ? ' fallen' : '') + (!p.connected && !(p.id.indexOf('bot') === 0) ? ' off' : '') + '">' + A.portrait(p.cls, c.color) + '<div><div class="row"><b>' + esc(p.name) + '</b><span class="small muted" style="color:' + c.color + '">' + esc(c.name.replace('The ', '')) + '</span>' + (!p.connected && p.id.indexOf('bot') !== 0 ? '<span class="chip bad">away</span>' : '') + (p.status === 'fallen' ? '<span class="chip viol">fallen</span>' : p.status === 'escaped' ? '<span class="chip teal">escaped</span>' : p.status === 'lost' ? '<span class="chip bad">lost</span>' : '') + '</div>' +
        (p.status === 'alive' ? '<div class="barrow" style="margin:2px 0;grid-template-columns:1fr auto"><div>' + bar('vit thin', p.vit, p.maxVit) + '<div style="height:3px"></div>' + bar('san thin', p.san, p.maxSan) + '</div><span class="small muted num">' + p.vit + '·' + p.san + '</span></div>' : '') +
        '<div class="small muted">' + (ld ? esc(ld.name) : '') + (p.status === 'alive' ? ' · ' + p.inv.length + ' items' : '') + '</div><div class="chips-row">' + statusChips(p.sts) + (p.revealed ? '<span class="chip gold">' + esc(p.revealed.name) + '</span>' : '') + '</div>' +
        (here ? '<div class="chips-row" style="margin-top:4px"><button class="btn tiny" data-act="giveui" data-to="' + p.id + '">Give…</button></div>' : (p.status === 'alive' ? '<button class="btn tiny" data-act="follow" data-to="' + p.id + '" style="margin-top:4px">Follow</button>' : '')) + '</div></div>';
    }).join('');
    return '<section class="panel"><h3>The party</h3>' + (rows || '<div class="small muted">You walk alone.</div>') + '</section>';
  };

  // ───────────────────────────── right column ─────────────────────────────
  UI.right = function () {
    var j = S.ui.jtab, v = view();
    var tabs = [['exp', 'Expedition'], ['journal', 'Journal'], ['log', 'Chronicle'], ['allies', 'Allies'], ['curses', 'Curses']];
    var bar = '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button class="tab" role="tab" aria-selected="' + (j === t[0]) + '" data-act="jtab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    var body = j === 'exp' ? UI.expedition() : j === 'journal' ? UI.journal() : j === 'log' ? UI.logPanel() : j === 'allies' ? UI.alliesPanel() : UI.cursesPanel();
    return '<section class="book">' + bar + '<div class="pages">' + body + '</div></section>';
  };

  UI.expedition = function () {
    var v = view(), W = v.world, m = v.me, o = m.objective, f = W.flags;
    var out = '<h3>The Missing Bell</h3><p class="goal">' + esc(S.cat.chapter.goal) + '</p>';
    var goals = [[f.gate_open, 'The Escape Gate is open'], [f.bellkeeper_down, 'The Bellkeeper is silent'], [f.warden_down || f.warden_bypassed, 'The Abbey Warden is passed'], [f.bell_named, 'The bell\'s true name is spoken'], [f.stars_aligned, 'The stars are aligned'], [f.spirit_freed, 'A lost spirit is freed']];
    out += '<h3>Objectives</h3><ul class="objs">' + W.pillars.map(function (p) { return '<li class="' + (p.done ? 'done' : '') + '"><span class="ck">' + (p.done ? '✓' : '○') + '</span>Understand: ' + esc(p.name.charAt(0).toLowerCase() + p.name.slice(1)) + ' <span class="muted">' + p.have + '/' + p.need + '</span></li>'; }).join('') + goals.map(function (x) { return '<li class="' + (x[0] ? 'done' : 'todo') + '"><span class="ck">' + (x[0] ? '✓' : '○') + '</span>' + esc(x[1]) + '</li>'; }).join('') + '</ul>';
    out += '<h3>Your secret purpose</h3><div class="secret' + (o.done ? ' done' : '') + '"><b>' + esc(o.name) + '</b>' + (o.done ? ' <span class="chip good">on track</span>' : '') + '<p>' + esc(o.text) + '</p><div class="small muted">Progress: ' + esc(o.progress) + '</div>' + (o.revealed ? '<div class="small" style="color:var(--gold2)">Revealed to the party</div>' : '<div class="small muted">Only you can see this. <button class="btn tiny" data-act="revealobj">Reveal to the party</button></div>') + '</div>';
    var rev = v.players.filter(function (p) { return p.revealed && p.id !== v.you; });
    if (rev.length) out += '<h3>Others\' purposes</h3><ul class="objs">' + rev.map(function (p) { return '<li><span class="ck">·</span>' + esc(p.name) + ': ' + esc(p.revealed.name) + '</li>'; }).join('') + '</ul>';
    if (W.revivals) out += '<p class="small muted">Returns granted: ' + W.revivals + '/2</p>';
    return out;
  };

  UI.journal = function () {
    var v = view(), W = v.world, m = v.me, byP = {};
    W.clues.forEach(function (c) { (byP[c.pillar] = byP[c.pillar] || []).push(c); });
    var out = '<h3>Confirmed discoveries</h3>';
    if (m.cluesPrivate.length) out += m.cluesPrivate.map(function (c) { return '<div class="entry priv"><h5>' + esc(c.title) + ' <span class="chip viol">only you know</span></h5><p>' + esc(c.text) + '</p><button class="btn tiny" data-act="share" data-clue="' + c.id + '">Share with the party</button></div>'; }).join('');
    out += W.clues.length ? W.pillars.filter(function (p) { return byP[p.id]; }).map(function (p) { return '<div class="grp"><div class="gl">' + esc(p.name) + '</div>' + byP[p.id].slice().reverse().map(function (c) { return '<div class="entry' + (c.round >= v.game.round - 1 ? ' fresh' : '') + '"><h5>' + esc(c.title) + '</h5><p>' + esc(c.text) + '</p><div class="tiny muted">Found by ' + esc(c.by || '?') + ', round ' + c.round + '</div></div>'; }).join('') + '</div>'; }).join('') : '<p class="small muted">Nothing found yet. Look closely at the places around you.</p>';
    var open = W.pillars.filter(function (p) { return !p.done; });
    out += '<h3>Unresolved questions</h3>' + (open.length ? '<ul class="qs">' + open.map(function (p) { return '<li>' + esc(p.name) + '? <span class="muted">' + p.have + ' of ' + p.need + ' clues</span></li>'; }).join('') + '</ul>' : '<p class="small muted">Every question has an answer. What you do with it is another matter.</p>');
    if (W.hints.length) out += W.hints.map(function (h) { return '<div class="small" style="margin:4px 0"><span class="muted">' + esc(h.label) + (h.left === 1 && !h.solved ? ' — <b style="color:var(--teal2)">one answer left</b>' : '') + ':</span> ' + h.out.map(function (x) { return '<s class="ruled">' + esc(x) + '</s>'; }).join(' ') + '</div>'; }).join('');
    out += '<h3>Rumors</h3>' + (v.map.rumors.length ? '<ul class="qs">' + v.map.rumors.map(function (r) { return '<li>Something waits at ' + esc(loc(r.loc).name) + '. <span class="' + (r.confirmed ? '' : 'muted') + '">' + (r.confirmed ? 'Confirmed true.' : 'Unverified: investigate there.') + '</span></li>'; }).join('') + '</ul>' : '<p class="small muted">No rumors are spreading.</p>');
    var ev = v.log.filter(function (e) { return ['omen', 'phase', 'world', 'ally'].indexOf(e.k) >= 0; }).slice(-6).reverse();
    out += '<h3>Recent world events</h3>' + (ev.length ? '<ul class="qs">' + ev.map(function (e) { return '<li>' + esc(e.t) + '</li>'; }).join('') + '</ul>' : '<p class="small muted">The world is quiet.</p>');
    return out;
  };

  UI.logPanel = function () {
    var v = view();
    return '<div class="loglist" role="log" aria-label="Recent events">' + v.log.slice(-80).reverse().map(function (e) { return '<div class="logrow k-' + e.k + '"><span class="r">R' + e.r + '</span>' + esc(e.t) + '</div>'; }).join('') + '</div>';
  };

  UI.alliesPanel = function () {
    var v = view(), W = v.world;
    var out = '<h3>Allies</h3>' + (W.allies.length ? W.allies.map(function (a) { return '<div class="entry"><h5>' + esc(a.name) + '</h5><p>' + esc(a.boon) + '</p><div class="tiny muted">Freed by ' + esc(a.by || '?') + '</div></div>'; }).join('') : '<p class="small muted">No one has been rescued yet. Three people in the Hollow still need finding.</p>');
    out += '<h3>The party</h3>' + v.players.map(function (p) { var c = cls(p.cls), ld = p.loc ? loc(p.loc) : null; return '<div class="mrow"><span class="dot" style="background:' + c.color + '"></span><b>' + esc(p.name) + '</b> <span class="muted">' + esc(c.name) + (ld ? ' · ' + esc(ld.name) : '') + (p.status !== 'alive' ? ' · ' + p.status : '') + '</span>' + (p.revealed ? ' <span class="chip gold">' + esc(p.revealed.name) + '</span>' : '') + '</div>'; }).join('');
    return out;
  };

  UI.cursesPanel = function () {
    var W = view().world;
    return '<h3>Curses</h3><p class="small muted">Unresolved curses feed the Haunting at every phase change and weigh on the final roll.</p>' + W.curses.map(function (c) { return '<div class="entry' + (c.active ? '' : ' lifted') + '"><h5>' + esc(c.name) + ' <span class="chip ' + (c.active ? 'bad' : 'good') + '">' + (c.active ? 'Spreading' : 'Lifted') + '</span></h5><p>' + esc(c.text) + '</p></div>'; }).join('');
  };


  // The slim character strip over the map, with the drawers that hold everything else.
  UI.hud = function () {
    var v = view(), m = v.me, c = cls(m.cls), G = v.game, mine = G.active === v.you, d = S.ui.drawer;
    var dot = function (on) { return on ? '<i class="dotnote"></i>' : ''; };
    return '<div class="hud" style="--ac:' + c.color + '"><button class="hud-who" data-act="drawer" data-d="left" aria-label="Open character sheet" aria-expanded="' + (d === 'left') + '"><span class="hp">' + A.portrait(m.cls, c.color) + '</span><span class="hv"><b>' + esc(UI.pl(v.you).name) + '</b><span class="hb"><i class="vit" style="width:' + pct(m.vit, m.maxVit) + '%"></i></span><span class="hb"><i class="san" style="width:' + pct(m.san, m.maxSan) + '%"></i></span></span><span class="hn">' + m.vit + '<small> vit</small> ' + m.san + '<small> san</small></span>' + dot(!!m.offer) + '</button>' +
      '<button class="btn small hud-b" data-act="drawer" data-d="left" aria-expanded="' + (d === 'left') + '">' + A.glyph('chest', 18) + ' Pack &amp; party</button>' +
      '<button class="btn small hud-b" data-act="drawer" data-d="right" aria-expanded="' + (d === 'right') + '">' + A.glyph('book', 18) + ' Journal' + dot(!!S.ui.newClue) + '</button>' + (mine ? '<span class="hud-ap">' + UI.apPips() + '</span>' : '') + '</div>';
  };

  // ───────────────────────────── the stage ─────────────────────────────
  function sceneFor(locId, extra) {
    var l = loc(locId); return A.scene(l.scene, locId, REGION(locId).color, l.region, l.glyph);
  }
  UI.locBanner = function (locId, title, tag, enemyId) {
    var l = loc(locId), r = REGION(locId);
    return '<div class="banner">' + sceneFor(locId) + (enemyId ? '<div class="enemy-p">' + A.enemy(enemyId) + '</div>' : '') + '<div class="titlebar"><div class="grow"><div class="tag" style="color:' + r.color + '">' + esc(r.name) + (tag ? ' · ' + esc(tag) : '') + '</div><h2>' + esc(title || l.name) + '</h2></div>' + (l.occult ? '<span class="chip viol" title="An occult place">Occult</span>' : '') + (l.safe ? '<span class="chip teal" title="You can rest here">Refuge</span>' : '') + '</div></div>';
  };

  UI.stage = function () {
    var v = view(), m = v.me, out = '';
    if (v.phase === 'ended') return '';
    var active = v.game.active, mine = active === v.you;
    if (v.vote) out += UI.votePanel();
    if (m.status === 'fallen') out += UI.spiritPanel();
    if (v.enc) out += UI.encPanel();
    else if (m.status === 'alive') out += mine ? UI.turnPanel() : UI.waitPanel();
    else if (m.status === 'escaped') out += '<div class="card"><div class="cbody"><h3>You have left the Hollow</h3><p class="narr">You are out, and the road is dry. The others are still in there. You can watch, and your legacy is sealed.</p></div></div>';
    if (m.status === 'alive' && v.finale && m.loc === 'heart_chamber') out += UI.finalePanel();
    if (S.ui.sel && v.map.locs[S.ui.sel]) out += UI.selPanel(S.ui.sel);
    return out;
  };

  UI.timerLine = function () {
    var G = view().game, a = pl(G.active), s = G.secLeft;
    var txt = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
    return '<span class="timer' + (s < 20 ? ' low' : '') + '" data-end="' + (Date.now() + s * 1000) + '" title="Turn timer">⏱ ' + txt + '</span>';
  };
  UI.apPips = function () {
    var G = view().game, max = view().players.filter(function (p) { return p.status === 'alive'; }).length <= 2 ? 3 : 2, o = '';
    for (var i = 0; i < Math.max(max, G.ap); i++) o += '<span class="pip' + (i < G.ap ? ' on' : '') + '"></span>';
    return '<span class="apbar" title="Actions left this turn" aria-label="' + G.ap + ' actions left">' + o + '</span>';
  };

  UI.waitPanel = function () {
    var v = view(), G = v.game, a = pl(G.active), m = v.me, l = loc(m.loc);
    var away = a && !a.connected && a.id.indexOf('bot') !== 0;
    var enc = '';
    var out = '<div class="card"><div class="cbody"><div class="row"><h3 style="font-size:1rem">' + (a ? esc(a.name) + '\'s turn' : 'Waiting…') + '</h3>' + UI.timerLine() + UI.apPips() + '</div>' +
      (away ? '<div class="note bad">' + esc(a.name) + ' has lost the thread. ' + esc(v.policy) + (G.awayLeft != null && v.settings.afk !== 'wait' ? ' (' + G.awayLeft + 's until the table\'s rule applies)' : '') + '</div>' : '<p class="small muted" style="margin:0">Watch the map. If they are in your place, you can lend them a hand during their encounter.</p>') + '</div></div>';
    out += '<div class="card">' + UI.locBanner(m.loc, null, 'You are here') + '<div class="cbody"><p class="narr">' + esc(l.desc) + '</p>' + UI.groundHtml() + UI.enemiesHere() + '</div></div>';
    return out;
  };

  UI.groundHtml = function () {
    var g2 = view().map.ground; if (!g2 || !g2.length) return '';
    return '<div><div class="tag">On the ground here</div><div class="chips-row">' + g2.map(function (s) { return '<button class="btn small" data-act="pickup" data-item="' + s.id + '">' + itemIcon(s.id, 18) + ' Pick up ' + esc(item(s.id).name) + (s.n > 1 ? ' ×' + s.n : '') + '</button>'; }).join('') + '</div></div>';
  };
  UI.enemiesHere = function () {
    var v = view(), m = v.me;
    var en = v.map.enemies.filter(function (e) { return e.loc === m.loc; });
    if (!en.length) return '';
    return '<div class="chips-row">' + en.map(function (e) { var d = S.cat.enemies[e.id]; return '<span class="chip bad" title="' + esc(d.blurb) + '">' + esc(d.name) + ' · ' + e.hp + '/' + e.max + '</span>'; }).join('') + '</div>';
  };

  UI.turnPanel = function () {
    var v = view(), a = v.act, m = v.me, l = loc(m.loc), G = v.game;
    var hl = m.hallu ? '<div class="ghostline">' + esc(m.ghost) + '</div>' : '';
    var out = '<div class="card' + (m.hallu ? ' hallu' + m.hallu : '') + '">' + UI.locBanner(m.loc, null, 'Your turn') + '<div class="cbody"><div class="row wrap"><b style="color:var(--gold2)">Your turn</b>' + UI.apPips() + UI.timerLine() + '<span class="small muted">' + (G.ap > 0 ? G.ap + ' action' + (G.ap > 1 ? 's' : '') + ' left' : 'no actions left') + '</span></div><p class="narr">' + esc(UI.descNow()) + '</p>' + hl + UI.groundHtml() + UI.enemiesHere() +
      '<div class="actgrid">' +
      '<button class="btn act primary" data-act="interact"' + (a.interact.ok ? '' : ' disabled') + '><b>' + esc(a.interact.label) + '</b><span class="why">' + (a.interact.ok ? 'Open this place\'s encounter' : esc(a.interact.why)) + '</span></button>' +
      '<button class="btn act" data-act="investigate"' + (a.investigate.ok ? '' : ' disabled') + '><b>Investigate</b><span class="why">' + (a.investigate.ok ? '1 action · find hidden ways and secrets' : esc(a.investigate.why)) + '</span></button>' +
      '<button class="btn act" data-act="explore"' + (a.explore.ok ? '' : ' disabled') + '><b>Explore around</b><span class="why">' + (a.explore.ok ? '1 action · ' + a.explore.left + ' event' + (a.explore.left > 1 ? 's' : '') + ' left in this region' : esc(a.explore.why)) + '</span></button>' +
      '<button class="btn act" data-act="rest-ui"' + (a.rest.ok ? '' : ' disabled') + '><b>Rest</b><span class="why">' + (a.rest.ok ? '1 action · heal 2 · the Haunting +1' : esc(a.rest.why)) + '</span></button>' +
      '<button class="btn act" data-act="echo"' + (a.echo.ok ? '' : ' disabled') + '><b>Follow an echo</b><span class="why">' + (a.echo.ok ? '1 action · ' + (a.echo.cost ? '−1 Sanity · ' : '') + 'a shortcut, maybe a dangerous one' : esc(a.echo.why)) + '</span></button>' +
      '<button class="btn act' + (G.ap < 1 ? ' primary' : '') + '" data-act="endturn"><b>End turn</b><span class="why">Pass to the next player</span></button></div></div></div>';
    out += UI.travelPanel();
    return out;
  };
  UI.descNow = function () { return loc(view().me.loc).desc; };

  UI.travelPanel = function () {
    var v = view(), a = v.act, m = v.me, G = v.game;
    var rows = a.moves.map(function (r) {
      var l = loc(r.to), reg = REGION(r.to), known = v.map.locs[r.to];
      var vis = known && known.v;
      var btns = '';
      if (r.ok) {
        btns += '<button class="btn small teal" data-act="move" data-mode="step" data-to="' + r.to + '"' + (G.ap < 1 ? ' disabled' : '') + '>Step carefully</button>';
        if (r.enemy && r.sneak) btns += '<button class="btn small" data-act="move" data-mode="sneak" data-to="' + r.to + '"' + (G.ap < 1 ? ' disabled' : '') + ' title="Wit against DC ' + r.sneak.dc + '">Sneak past <span class="odds ' + (r.sneak.chance >= 65 ? 'high' : r.sneak.chance >= 40 ? 'mid' : 'low') + '">~' + r.sneak.chance + '%</span></button>';
      } else if (r.state === 'locked' && r.ways) {
        btns += r.ways.map(function (w) {
          if (w.flag) return '<span class="chip">' + esc(w.label) + ' — ' + (w.ok ? 'done' : 'not yet') + '</span>';
          return '<button class="btn small" data-act="unlock" data-edge="' + r.key + '" data-way="' + w.id + '"' + (w.ok && (G.ap >= w.ap) ? '' : ' disabled') + ' title="' + esc(w.why) + '">' + esc(w.label) + (w.stat ? ' <span class="odds ' + (w.chance >= 65 ? 'high' : w.chance >= 40 ? 'mid' : 'low') + '">' + STAT[w.stat] + ' ~' + w.chance + '%</span>' : '') + (w.ap ? ' · 1 action' : '') + (!w.ok ? '<span class="why">' + esc(w.why) + '</span>' : '') + '</button>';
        }).join('');
      } else btns = '<span class="chip bad">' + esc(r.why) + '</span>';
      return '<div class="road' + (S.ui.sel === r.to ? ' sel' : '') + '"><div class="g" style="color:' + reg.color + '">' + A.glyph(vis ? l.glyph : 'keyhole', 22) + '</div><div><div><b>' + esc(l.name) + '</b> ' + (vis ? '' : '<span class="chip">unexplored</span> ') + (r.label ? '<span class="small muted">· ' + esc(r.label) + '</span>' : '') + (r.type === 'hidden' ? ' <span class="chip viol">hidden way</span>' : '') + (r.oneway ? ' <span class="chip bad">one-way</span>' : '') + (r.enemy ? ' <span class="chip bad">' + esc(S.cat.enemies[r.enemy].name) + '</span>' : '') + '</div><div class="btns">' + btns + '</div></div></div>';
    }).join('');
    var spr = a.sprint.map(function (s) {
      var l = loc(s.to), via = loc(s.via);
      return '<div class="road"><div class="g" style="color:' + REGION(s.to).color + '">' + A.glyph('bridge', 20) + '</div><div><div><b>' + esc(l.name) + '</b> <span class="small muted">via ' + esc(via.name) + '</span></div><div class="btns"><button class="btn small" data-act="move" data-mode="sprint" data-to="' + s.to + '"' + (G.ap < 1 ? ' disabled' : '') + ' title="Two roads for one action. Noisy, and hazards at the far end are not avoided.">Sprint here <span class="why" style="display:inline;margin-left:4px">+1 noise · hazards bite</span></button></div></div></div>';
    }).join('');
    var fol = a.follow.map(function (f) { return '<button class="btn small" data-act="follow" data-to="' + f.id + '"' + (G.ap < 1 ? ' disabled' : '') + '>Follow ' + esc(f.name) + ' (' + f.dist + ' road' + (f.dist > 1 ? 's' : '') + ')</button>'; }).join(' ');
    return '<div class="card"><div class="cbody"><h3 style="font-size:.85rem;color:var(--gold)">Roads from here</h3>' + (a.parting ? '<div class="note bad small">Something has you. Leaving costs a parting blow.</div>' : '') + '<div class="roads">' + (rows || '<div class="small muted">No roads are open from here. Investigate for hidden ways.</div>') + '</div>' +
      (spr ? '<h3 style="font-size:.8rem;color:var(--gold);margin-top:6px">Further afield (sprint)</h3><div class="roads">' + spr + '</div>' : '') + (fol ? '<div class="chips-row" style="margin-top:6px">' + fol + '</div>' : '') + '</div></div>';
  };

  // The encounter panel: the heart of every turn.
  UI.encPanel = function () {
    var v = view(), enc = v.enc, m = v.me, active = enc.pid === v.you, who = pl(enc.pid);
    var l = loc(enc.loc), tagTxt = enc.kind === 'event' ? 'An encounter' : enc.kind === 'enemy' ? 'A confrontation' : enc.kind === 'boss' ? 'A boss' : 'At ' + l.name;
    var en = enc.enemy, enemyId = en ? en.id : enc.kind === 'boss' ? 'abbey_warden' : null;
    var cardCls = 'card' + (m.hallu ? ' hallu' + m.hallu : '');
    var out = '<div class="' + cardCls + '">' + UI.locBanner(enc.loc, enc.title, tagTxt, enemyId) + '<div class="cbody">';
    if (!active) out += '<div class="note teal small">' + esc(who ? who.name : 'Someone') + ' is acting here. ' + (enc.allies && enc.allies.some(function (x) { return x.id === v.you; }) ? 'You are in the same place, so you can help.' : 'You are watching.') + '</div>';
    out += '<p class="narr">' + esc(enc.text) + '</p>';
    if (enc.ghost && active) out += '<div class="ghostline">' + esc(enc.ghost) + '</div>';
    if (en) {
      out += '<div class="bossbox"><div class="row wrap"><b>' + esc(en.name) + '</b><span class="chip bad">' + esc(en.type) + '</span><span class="hp" aria-label="Enemy health ' + en.hp + ' of ' + en.max + '">' + hpPips(en.hp, en.max) + '</span><span class="small muted">' + (en.known ? 'Weakness known' : 'Failing against it will reveal its weakness') + '</span></div></div>';
    }
    if (enc.boss) {
      var b = enc.boss;
      out += '<div class="bossbox"><div class="row wrap"><b>' + esc(S.cat.boss.name) + '</b><span class="chip bad">' + esc(b.phase) + '</span><span class="hp" aria-label="Warden health">' + hpPips(b.hp, b.max) + '</span></div><div class="row wrap small"><span>Chains</span><span class="hp chain">' + hpPips(b.chains, 3) + '</span><span class="muted">Next blow: ' + (b.attack.vit ? '−' + (-b.attack.vit) + ' Vitality ' : '') + (b.attack.san ? '−' + (-b.attack.san) + ' Sanity' : '') + '</span></div><div class="small muted">' + esc(b.text) + ' Try the chains, the bell\'s name, the rite from the Ritual Chamber, the cracked vault, his oath, or slipping past.</div></div>';
    }
    if (enc.guard && !m.unnoticed) out += '<div class="note bad">' + esc(enc.guardText) + '</div>';
    // result of the last choice
    if (enc.result) out += UI.resultHtml(enc.result);
    // held roll
    if (enc.hold && active) out += UI.holdPanel(enc.hold);
    // aid
    if (enc.aid) out += UI.aidHtml(enc, active);
    // options
    if (active && !enc.hold) {
      if (enc.options && enc.options.length) {
        var opts = enc.options.slice().sort(function (a, b) { return (a.state === 'ok' ? 0 : a.state === 'locked' ? 1 : 2) - (b.state === 'ok' ? 0 : b.state === 'locked' ? 1 : 2); });
        out += '<div class="opts">' + opts.map(function (o) { return UI.optHtml(o, enc); }).join('') + '</div>';
        if (enc.kind === 'enemy' || enc.kind === 'boss') {
          var wd = v.act ? v.act.moves.filter(function (r) { return r.ok; }) : [];
          out += '<div class="row wrap"><span class="small muted">Or get out:</span>' + wd.map(function (r) { return '<button class="btn small" data-act="move" data-mode="step" data-to="' + r.to + '">Retreat to ' + esc(loc(r.to).name) + ' <span class="why" style="display:inline">(parting blow)</span></button>'; }).join('') + (m.ability && m.ability.kind === 'vagabond' && m.ability.ok ? wd.map(function (r) { return '<button class="btn small teal" data-act="slip" data-to="' + r.to + '">Slip Away to ' + esc(loc(r.to).name) + '</button>'; }).join('') : '') + '</div>';
          out += UI.snareBtn();
        }
        out += '<div class="row">' + ((enc.kind === 'enemy' || enc.kind === 'boss') ? '' : '<button class="btn small ghost" data-act="leaveenc">' + (enc.kind === 'loc' ? 'Step back' : 'Continue') + '</button>') + '<span class="grow"></span>' + UI.apPips() + UI.timerLine() + '</div>';
      } else out += '<div class="row"><button class="btn primary" data-act="leaveenc">Continue</button></div>';
    }
    return out + '</div></div>';
  };
  function hpPips(a, b) { var o = ''; for (var i = 0; i < b; i++) o += '<i class="' + (i < a ? '' : 'off') + '"></i>'; return o; }
  UI.snareBtn = function () {
    var m = view().me; var has = m.inv.some(function (e) { return e.id === 'snare'; });
    return has ? '<div class="row"><button class="btn small" data-act="use" data-item="snare">Spring a Snare (wounds 2, free)</button></div>' : '';
  };

  UI.resultHtml = function (r) {
    var tier = r.tier, lab = { crit: 'Critical success', ok: 'Success', fail: 'Failure', fumble: 'Critical failure', auto: 'Done' }[tier];
    var roll = r.roll ? '<div class="small">' + (r.roll.rerolled ? 'Rerolled: ' : '') + '<b>d20 ' + r.roll.d + '</b> ' + sgn(r.roll.mod) + ' = <b>' + r.roll.total + '</b> vs DC ' + r.roll.dc + '</div>' : '';
    var chips = (r.chips || []).map(function (c) { return '<span class="chip ' + (c.tone === 'bad' ? 'bad' : 'good') + '">' + esc(c.label) + '</span>'; }).join('');
    return '<div class="result t-' + tier + '" role="status"><div class="rl" style="color:' + (tier === 'ok' || tier === 'crit' ? 'var(--good)' : tier === 'auto' ? 'var(--gold2)' : 'var(--crim2)') + '">' + esc(r.opt) + ' — ' + lab + '</div>' + roll +
      (r.lines || []).map(function (ln) { return '<div class="line ' + ln.k + ' ' + (ln.k === 'story' ? 'narr' : '') + '">' + esc(ln.t) + '</div>'; }).join('') + '<div class="chipbox">' + chips + '</div></div>';
  };

  UI.holdPanel = function (h) {
    var r = h.roll, srcs = h.sources;
    return '<div class="votebox"><b>Fate hangs in the balance.</b><div>You rolled <b>' + r.d + '</b> ' + sgn(r.mod) + ' = <b>' + r.total + '</b> against DC ' + r.dc + '. It is not enough.</div><div class="row wrap">' +
      (srcs.indexOf('twist') >= 0 ? '<button class="btn small" data-act="reroll" data-src="twist">Twist Fate · reroll · −1 Sanity</button>' : '') + (srcs.indexOf('moon') >= 0 ? '<button class="btn small" data-act="reroll" data-src="moon">Moonbound Relic · reroll · the Haunting +1</button>' : '') + '<button class="btn small primary" data-act="accept">Accept the result</button><span class="timer" data-end="' + (Date.now() + h.secLeft * 1000) + '">⏱ ' + h.secLeft + 's</span></div></div>';
  };

  UI.aidHtml = function (enc, active) {
    var v = view(), a = enc.aid, out = '';
    var iHelp = enc.allies && enc.allies.find(function (x) { return x.id === v.you; });
    if (a.bonus) out += '<div class="chips-row"><span class="chip good">Allies lend +' + a.bonus + ' to the next roll (' + esc(a.helpers.join(', ')) + ')</span></div>';
    if (active && enc.allies && enc.allies.length && !a.asked && enc.canAsk && enc.options && enc.options.some(function (o) { return o.kind === 'check'; })) out += '<div class="row"><button class="btn small teal" data-act="askaid">Call for help (' + enc.allies.map(function (x) { return esc(x.name); }).join(', ') + ' are here)</button></div>';
    if (active && a.asked && !a.bonus) out += '<div class="small muted">You have called for help. Allies here can answer.</div>';
    if (!active && iHelp && a.asked && v.me.status === 'alive') out += '<div class="votebox"><b>' + esc(pl(enc.pid).name) + ' needs help with this roll.</b><div class="small">Aiding adds +2 and costs you 1 Sanity. Once per round.</div><button class="btn small teal" data-act="aid"' + (v.me.aided || v.me.san < 2 || a.bonus >= 4 ? ' disabled' : '') + '>Lend a hand (+2, −1 Sanity)</button>' + (v.me.aided ? '<div class="why">You have already helped this round.</div>' : '') + '</div>';
    return out;
  };

  UI.optHtml = function (o, enc) {
    var cl = ['opt', o.kind === 'check' ? 'check' : '', o.state === 'ok' ? 'can' : o.state];
    var head = '<div class="head"><span class="lab">' + esc(o.label) + '</span>';
    if (o.kind === 'check') {
      var cc = o.chance >= 65 ? 'high' : o.chance >= 40 ? 'mid' : 'low';
      head += stBadge(o.stat) + '<span class="chip" title="Difficulty class">DC ' + o.dc + ' · ' + esc(o.dcName) + '</span><span class="odds ' + cc + '" title="Your chance of success. A natural 20 is exceptional; a natural 1 brings a complication.">~<b>' + o.chance + '%</b></span>';
    } else if (o.kind === 'puzzle') head += '<span class="chip teal">No roll · reasoning</span>';
    if (o.weak) head += '<span class="chip gold">Its weakness +3</span>';
    head += '</div>';
    var mods = '';
    if (o.kind === 'check') {
      mods = '<div class="mods">' + o.mods.map(function (mm) { return '<span class="dm ' + (mm.v < 0 ? 'neg' : 'pos') + '">' + esc(mm.l) + ' ' + sgn(mm.v) + '</span>'; }).join('') + o.dcMods.map(function (mm) { return '<span class="dm ' + (mm.v > 0 ? 'neg' : 'pos') + '" title="Difficulty">' + esc(mm.l) + ' (DC ' + sgn(mm.v) + ')</span>'; }).join('') + '</div>';
    }
    var cost = (o.cost || o.ap) ? '<div class="chips-row">' + (o.ap ? '<span class="chip">' + o.ap + ' action' + (o.ap > 1 ? 's' : '') + '</span>' : '') + costChips(o.cost) + (o.stockLeft != null ? '<span class="chip">' + o.stockLeft + ' left</span>' : '') + (o.note ? '<span class="chip">' + esc(o.note) + '</span>' : '') + '</div>' : '';
    var action = '';
    if (o.state === 'ok') {
      if (o.puzzle) {
        action = '<div class="small muted">' + esc(o.puzzle.title) + '</div><div class="puz">' + o.puzzle.chips.map(function (c) { return '<button class="btn' + (c.out ? ' out' : '') + (o.puzzle.deduced === c.v ? ' deduced' : '') + '" data-act="choose" data-opt="' + o.id + '" data-val="' + esc(c.v) + '"' + (c.out || c.can === false ? ' disabled' : '') + ' title="' + (c.out ? 'Ruled out' : (c.price ? 'Offer: ' + esc(c.price) : 'Choose this')) + '">' + esc(c.label) + (c.price ? '<span class="why" style="display:inline;margin-left:4px">(' + esc(c.price) + ')</span>' : '') + '</button>'; }).join('') + '</div>' + (o.puzzle.deduced ? '<div class="small" style="color:var(--teal2)">Everything else has been ruled out.</div>' : '');
      } else if (o.needsTarget) {
        action = '<div class="puz">' + (o.targets || []).map(function (t) { return '<button class="btn small" data-act="choose" data-opt="' + o.id + '" data-target="' + t.id + '" data-confirm="' + esc(o.confirm || '') + '">Return ' + esc(t.name) + '</button>'; }).join('') + '</div>';
      } else action = '<div><button class="btn small ' + (o.kind === 'check' ? 'primary' : '') + '" data-act="choose" data-opt="' + o.id + '"' + (o.confirm ? ' data-confirm="' + esc(o.confirm) + '"' : '') + '>' + (o.kind === 'check' ? 'Roll the die' : 'Do this') + '</button></div>';
    } else if (o.why) action = '<div class="why">' + esc(o.why) + '</div>';
    return '<div class="' + cl.join(' ') + '" data-opt-card="' + o.id + '">' + head + (o.stakes ? '<div class="stk">' + esc(o.stakes) + '</div>' : '') + mods + cost + action + '</div>';
  };

  UI.votePanel = function () {
    var v = view(), vt = v.vote, meP = me(), yes = vt.yes.indexOf(v.you) >= 0, no = vt.no.indexOf(v.you) >= 0, by = pl(vt.by);
    var eligible = vt.eligible.indexOf(v.you) >= 0;
    return '<div class="votebox" role="alert"><div class="row wrap"><h3 style="font-size:.95rem;color:var(--gold2)">The final decision</h3><span class="timer" data-end="' + (Date.now() + vt.secLeft * 1000) + '">⏱ ' + vt.secLeft + 's</span></div><div><b>' + esc(by ? by.name : 'Someone') + '</b> proposes: <b>' + esc(vt.name) + '</b>.</div>' +
      '<div class="small muted">Agreed: ' + vt.yes.map(function (id) { var p = pl(id); return p ? esc(p.name) : ''; }).join(', ') + (vt.no.length ? ' · Against: ' + vt.no.map(function (id) { var p = pl(id); return p ? esc(p.name) : ''; }).join(', ') : '') + ' · ' + vt.eligible.length + ' vote' + (vt.eligible.length > 1 ? 's' : '') + ' (the fallen vote too)</div>' +
      (eligible ? '<div class="row wrap"><button class="btn primary small" data-act="vote" data-yes="1"' + (yes ? ' disabled' : '') + '>Agree</button><button class="btn danger small" data-act="vote" data-yes="0"' + (no ? ' disabled' : '') + '>Refuse</button>' + (vt.by === v.you ? '<button class="btn ghost small" data-act="cancelvote">Withdraw</button>' : '') + '</div>' : '<div class="small muted">You have left the Hollow; you cannot vote.</div>') + '</div>';
  };

  UI.finalePanel = function () {
    var v = view(), f = v.finale, canPropose = !v.vote;
    var rows = f.endings.map(function (e) {
      var def = S.cat.endings[e.id];
      var roll = e.stat ? '<div class="mods">' + e.mods.map(function (mm) { return '<span class="dm ' + (mm.v < 0 ? 'neg' : 'pos') + '">' + esc(mm.l) + (mm.v ? ' ' + sgn(mm.v) : '') + '</span>'; }).join('') + '</div><div class="small">' + stBadge(e.stat) + ' roll: total modifier <b>' + sgn(e.mod) + '</b> vs DC <b>' + e.dc + '</b> — success ~<b>' + e.chanceOk + '%</b>, a flawed result ~' + e.chanceFlawed + '%</div>' : (e.pitch2 ? '<div class="small">' + esc(e.pitch2) + '</div>' : '');
      return '<div class="endopt"><h4>' + esc(e.name) + '</h4><div class="small">' + esc(e.pitch) + '</div>' + roll + '<div><button class="btn small primary" data-act="propose" data-ending="' + e.id + '" data-confirm="Propose this ending to the party? If the table agrees, the expedition ends."' + (e.available && canPropose ? '' : ' disabled') + '>Propose this ending</button>' + (!e.available ? '<div class="why">' + esc(e.why) + '</div>' : '') + '</div></div>';
    }).join('');
    return '<div class="card"><div class="cbody"><h3 style="font-size:.95rem;color:var(--gold2)">The Final Toll</h3><p class="narr">The bell waits. Whatever you decide, the others must agree. Many things you did on the way will bear on the roll.</p><div class="opts">' + rows + '</div></div></div>';
  };

  UI.spiritPanel = function () {
    var v = view(), s = v.me.spirit, used = s.used;
    return '<div class="card"><div class="cbody"><h3 style="font-size:.95rem;color:var(--viol2)">You are a voice in the Hollow</h3><p class="narr">You have fallen, but not gone. Once a round you can reach across. You still vote at the end.</p><div class="opts">' +
      '<div class="opt can"><div class="head"><span class="lab">Whisper a truth</span><span class="chip">' + s.whispers + ' whispers left (shared by all spirits)</span></div><div class="stk">Rule out one wrong answer to a puzzle for the living.</div><button class="btn small" data-act="spirit" data-kind="whisper"' + (used || s.whispers < 1 ? ' disabled' : '') + '>Whisper</button></div>' +
      '<div class="opt can"><div class="head"><span class="lab">Lend strength</span></div><div class="stk">The next check anyone makes gets +2.</div><button class="btn small" data-act="spirit" data-kind="lend"' + (used || s.lending ? ' disabled' : '') + '>Lend strength' + (s.lending ? ' (already lent)' : '') + '</button></div>' +
      '<div class="opt can"><div class="head"><span class="lab">Chill an enemy</span></div><div class="stk">Wound a creature anywhere by 1 (never to death).</div><div class="puz">' + (s.enemies.length ? s.enemies.map(function (e) { return '<button class="btn small" data-act="spirit" data-kind="chill" data-target="' + e.uid + '"' + (used ? ' disabled' : '') + '>' + esc(e.name) + ' · ' + esc(e.loc) + '</button>'; }).join('') : '<span class="small muted">No creature can be weakened.</span>') + '</div></div>' +
      '<div class="opt can"><div class="head"><span class="lab">Try to return</span>' + stBadge('fate') + '<span class="chip">DC 14</span><span class="chip">' + s.returns + ' return' + (s.returns === 1 ? '' : 's') + ' left</span></div><div class="stk">You wake scarred: lower maximums and a curse. Allies at the place you fell add to the roll.</div><button class="btn small primary" data-act="spirit" data-kind="return"' + (used || s.returns < 1 ? ' disabled' : '') + '>Reach for the light</button>' + (s.returns < 1 ? '<div class="why">You cannot return again.</div>' : '') + '</div></div>' + (used ? '<div class="small muted">You have reached across this round. Rest until the next.</div>' : '') + '</div></div>';
  };

  UI.selPanel = function (id) {
    var v = view(), l = loc(id), r = REGION(id), st = v.map.locs[id], meP = me();
    var people = v.players.filter(function (p) { return p.loc === id && p.status === 'alive'; });
    var en = v.map.enemies.filter(function (e) { return e.loc === id; });
    var rumor = v.map.rumors.find(function (x) { return x.loc === id; });
    return '<div class="card"><div class="cbody"><div class="row"><div class="road" style="border:0;padding:0;grid-template-columns:34px 1fr"><div class="g" style="color:' + r.color + '">' + A.glyph(st.v ? l.glyph : 'keyhole', 22) + '</div><div><b>' + esc(l.name) + '</b><div class="small muted" style="color:' + r.color + '">' + esc(r.name) + '</div></div></div><button class="btn tiny ghost right" data-act="desel">Close</button></div>' +
      (st.v ? '<p class="narr" style="font-size:1rem">' + esc(l.desc) + '</p>' : '<p class="small muted">You have not been here. Only its name is known.</p>') +
      '<div class="chips-row">' + (st.v ? '<span class="chip teal">Visited</span>' : '<span class="chip">Unexplored</span>') + (st.corrupt ? '<span class="chip bad">Corrupted</span>' : '') + (st.sealed ? '<span class="chip teal">Sealed</span>' : '') + (st.chalk ? '<span class="chip teal">Ward-circle</span>' : '') + (l.safe && st.v ? '<span class="chip teal">Refuge</span>' : '') + (l.occult && st.v ? '<span class="chip viol">Occult</span>' : '') + (rumor ? '<span class="chip gold">' + (rumor.confirmed ? 'Rumor confirmed' : 'Rumored discovery') + '</span>' : '') + (st.ground ? '<span class="chip gold">Items on the ground</span>' : '') + (st.snare ? '<span class="chip teal">Your snare</span>' : '') + '</div>' +
      (people.length ? '<div class="small">Here: ' + people.map(function (p) { return '<span style="color:' + color(p) + '">' + esc(p.name) + '</span>'; }).join(', ') + '</div>' : '') +
      (en.length ? '<div class="chips-row">' + en.map(function (e) { return '<span class="chip bad" title="' + esc(S.cat.enemies[e.id].blurb) + '">' + esc(S.cat.enemies[e.id].name) + ' ' + e.hp + '/' + e.max + (e.known && e.weak ? ' · weak to: ' + esc(e.weak) : '') + '</span>'; }).join('') + '</div>' : '') + '</div></div>';
  };

  // ───────────────────────────── ending ─────────────────────────────
  UI.ending = function () {
    var v = view(), e = v.ended, W = v.world, cc = S.cat;
    var rollHtml = e.roll ? '<div class="panel" style="text-align:center"><div class="tag">The Final Toll</div><div style="font-size:1.4rem">d20 <b>' + e.roll.d + '</b> ' + sgn(e.roll.mod) + ' = <b>' + e.roll.total + '</b> vs DC ' + e.roll.dc + '</div><div class="mods" style="justify-content:center">' + e.roll.mods.map(function (mm) { return '<span class="dm ' + (mm.v < 0 ? 'neg' : 'pos') + '">' + esc(mm.l) + ' ' + sgn(mm.v) + '</span>'; }).join('') + '</div></div>' : '';
    var pillars = W.pillars.map(function (p) { return '<span class="chip ' + (p.done ? 'good' : '') + '">' + (p.done ? '✓ ' : '· ') + esc(p.name) + '</span>'; }).join(' ');
    var lead = e.results.slice().sort(function (a, b) { return b.glory.total - a.glory.total; });
    var cards = e.results.map(function (r) {
      var c = cls(r.cls), dead = r.fate === 'fallen' || r.fate === 'lost';
      return '<div class="panel legacy' + (dead ? ' dead' : '') + '"><div class="head">' + A.portrait(r.cls, c.color) + '<div><h3 style="font-size:1rem;color:var(--ink);letter-spacing:.04em;text-transform:none">' + esc(r.name) + (r.id === v.you ? ' <span class="chip teal">You</span>' : '') + '</h3><div class="small" style="color:' + c.color + '">' + esc(c.name) + ' · level ' + r.level + '</div><div class="chips-row"><span class="chip gold">' + esc(r.title) + '</span><span class="chip ' + (dead ? 'bad' : 'good') + '">' + esc({ survived: 'Walked out', escaped: 'Escaped early', fallen: 'Fell in the Hollow', lost: 'Taken by the bell', bound: 'Bound to the ledger' }[r.fate] || r.fate) + '</span></div></div></div>' +
        '<div class="epi">' + esc(r.epilogue) + '</div>' +
        '<div class="note ' + (r.objective.done ? 'teal' : 'bad') + ' small"><b>' + esc(r.objective.name) + ':</b> ' + esc(r.objective.text) + ' — <b>' + (r.objective.done ? 'fulfilled' : 'unfulfilled') + '</b></div>' +
        '<div class="small"><b style="color:var(--gold2)">Glory ' + r.glory.total + '</b> <span class="muted">(' + r.glory.earned + ' earned' + r.glory.bonus.map(function (b) { return ' · ' + b.l + ' +' + b.v; }).join('') + ')</span></div>' +
        (r.relics.length || r.allies.length ? '<div class="chips-row">' + r.relics.map(function (x) { return '<span class="chip gold">' + esc(x) + '</span>'; }).join('') + r.allies.map(function (x) { return '<span class="chip teal">Saved ' + esc(x) + '</span>'; }).join('') + '</div>' : '') + '</div>';
    }).join('');
    return '<div class="ending"><div class="in"><div style="text-align:center"><span class="badge ' + e.outcome + '">' + esc({ success: 'The expedition succeeded', partial: 'A partial victory', failure: 'The expedition failed', unresolved: 'The mystery is unresolved' }[e.outcome]) + '</span></div><h1>' + esc(e.title) + '</h1>' +
      '<p class="endtext">' + esc(e.text) + '</p>' + rollHtml +
      '<div class="panel"><h3>The mystery</h3><div class="chips-row">' + pillars + '</div><p class="small muted" style="margin:6px 0 0">' + W.clues.length + ' of ' + Object.keys(cc.clues).length + ' truths uncovered · ' + W.allies.length + ' of 3 allies saved · ' + W.curses.filter(function (c) { return !c.active; }).length + ' of 3 curses lifted · ended in round ' + e.round + ' with the Haunting at ' + e.clock + '/' + cc.cfg.clockMax + '.</p></div>' +
      '<div><h3 style="margin-bottom:8px">Personal legacies</h3><div class="legacies">' + cards + '</div></div>' +
      '<div class="row wrap" style="justify-content:center"><button class="btn primary" data-act="again">' + (S.net && S.net.kind === 'offline' ? 'Begin a new expedition' : 'Leave the expedition') + '</button><button class="btn" data-act="hub">Back to the hub</button></div></div></div>';
  };

  // ───────────────────────────── modals ─────────────────────────────
  UI.settingsModal = function () {
    var a = g.HollowAudio.settings(), P = g.HollowFx.prefs;
    var sl = function (k, lab) { return '<div class="slider"><label for="s-' + k + '">' + lab + '</label><input id="s-' + k + '" type="range" min="0" max="100" value="' + Math.round(a[k] * 100) + '" data-act="vol" data-bus="' + k + '"><span class="small muted">' + Math.round(a[k] * 100) + '</span></div>'; };
    return '<div class="modal" role="dialog" aria-modal="true" aria-label="Settings"><div class="box"><h2>SOUND &amp; ACCESSIBILITY</h2>' +
      '<div class="switch"><input id="s-mute" type="checkbox" data-act="mutebox"' + (a.muted ? ' checked' : '') + '><label for="s-mute">Mute everything</label></div>' + sl('master', 'Master') + sl('music', 'Music') + sl('ambient', 'Ambience') + sl('sfx', 'Effects') +
      '<div class="switch"><input id="s-cap" type="checkbox" data-act="capbox"' + (a.captions ? ' checked' : '') + '><label for="s-cap">Show sound captions</label></div>' +
      (g.HollowAudio.supported ? '' : '<div class="note bad small">Your browser cannot play synthesised audio. The game is fully playable without it.</div>') +
      '<hr class="div"><div class="field"><label for="s-motion">Motion</label><select id="s-motion" data-act="motion"><option value="auto"' + (P.motion === 'auto' ? ' selected' : '') + '>Follow my device setting</option><option value="on"' + (P.motion === 'on' ? ' selected' : '') + '>Reduce motion</option><option value="off"' + (P.motion === 'off' ? ' selected' : '') + '>Full animation</option></select></div>' +
      '<div class="switch"><input id="s-cine" type="checkbox" data-act="cinebox"' + (P.cine !== false ? ' checked' : '') + '><label for="s-cine">Cinematic moments (arrivals, discoveries, the Haunting)</label></div>' +
      '<div class="switch"><input id="s-large" type="checkbox" data-act="largebox"' + (P.large ? ' checked' : '') + '><label for="s-large">Larger text</label></div>' +
      '<div class="switch"><input id="s-con" type="checkbox" data-act="conbox"' + (P.contrast ? ' checked' : '') + '><label for="s-con">High contrast</label></div>' +
      '<div class="switch"><input id="s-dis" type="checkbox" data-act="disbox"' + (P.distort ? ' checked' : '') + '><label for="s-dis">Low Sanity distorts descriptions (numbers and rules never lie)</label></div>' +
      '<div class="row" style="margin-top:12px"><button class="btn primary" data-act="closemodal">Done</button></div></div></div>';
  };

  UI.howtoModal = function () {
    return '<div class="modal" role="dialog" aria-modal="true" aria-label="How to play"><div class="box"><h2>HOW TO PLAY</h2>' +
      '<p class="serif" style="font-size:1.1rem">You are an expedition into the Hollow. Find out what happened to Thornwick, then decide the bell\'s fate, before the Haunting Clock reaches its end.</p>' +
      '<ul class="small" style="padding-left:18px;line-height:1.55">' +
      '<li><b>Each turn you have 2 actions</b> (3 in a party of one or two). Moving, investigating, exploring, resting and acting at a place each cost 1.</li>' +
      '<li><b>Travel is a choice.</b> <i>Step carefully</i> avoids traps. <i>Sprint</i> crosses two roads, but is noisy and the dangers bite. <i>Sneak</i> past a monster with Wit. Locked roads have several ways open.</li>' +
      '<li><b>Roll d20 + a stat</b> against a difficulty (DC 8 easy · 11 standard · 14 hard · 17 very hard). A 20 is exceptional; a 1 is a complication. The odds are always shown first. Failure is never nothing: it costs, reveals or changes something.</li>' +
      '<li><b>Might</b> forces and fights. <b>Wit</b> investigates and tricks. <b>Fate</b> deals with the unseen.</li>' +
      '<li><b>Vitality and Sanity</b> both matter. At zero you fall, and become a spirit who can still whisper, lend strength, and try to return once.</li>' +
      '<li><b>The Haunting Clock</b> advances every round, and from noise, resting and some failures. At Phase II and III the world grows worse. If it fills, the thirteenth toll comes.</li>' +
      '<li><b>Clues and puzzles:</b> clues are shared with the party (private ones you can share). Wrong guesses are ruled out for everyone, so every puzzle can be solved.</li>' +
      '<li><b>Your secret purpose</b> is yours alone. Keep it, reveal it, or ignore it: the shared mystery can always be finished.</li>' +
      '<li><b>The finale:</b> in the Heart Chamber, one player proposes how to end the bell\'s ringing; the table votes. Silence it, ring it backward, bargain, or break it. What you learned and saved changes the odds.</li></ul>' +
      '<div class="row" style="margin-top:12px"><button class="btn primary" data-act="closemodal">Understood</button></div></div></div>';
  };

  UI.itemModal = function (id) {
    var v = view(), m = v.me, d = item(id), e = m.inv.find(function (x) { return x.id === id; });
    if (!e) return '';
    var here = v.players.filter(function (p) { return p.id !== v.you && p.loc === m.loc && p.status === 'alive'; });
    var fallenHere = v.players.filter(function (p) { return p.status === 'fallen' && p.fellLoc === m.loc; });
    var usable = ['tonic', 'herb', 'salt', 'thread', 'chalk', 'lamp_oil', 'moonwater', 'snare'].indexOf(id) >= 0;
    var out = '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(d.name) + '"><div class="box"><div class="row"><div class="bigitem">' + A.itemArt(id, 84) + '</div><div><h2 style="margin:0">' + esc(d.name.toUpperCase()) + '</h2><div class="tag">' + esc(d.kind) + (d.size > 1 ? ' · heavy' : '') + (d.rare ? ' · rare' : '') + '</div></div></div><p class="serif" style="font-size:1.1rem">' + esc(d.desc) + '</p>' + (e.uses != null ? '<div class="chip">Charges: ' + e.uses + '</div>' : '') + '<div class="chips-row" style="margin-top:8px">';
    if (usable && id !== 'snare' && id !== 'moonwater') {
      if (id === 'tonic') out += '<button class="btn small" data-act="use" data-item="tonic">Drink it</button>' + here.map(function (p) { return '<button class="btn small" data-act="use" data-item="tonic" data-target="' + p.id + '">Give to ' + esc(p.name) + '</button>'; }).join('');
      else out += '<button class="btn small" data-act="use" data-item="' + id + '">Use</button>';
    }
    if (id === 'moonwater') {
      out += v.world.curses.filter(function (c) { return c.active; }).map(function (c) { return '<button class="btn small" data-act="use" data-item="moonwater" data-curse="' + c.id + '">Cleanse ' + esc(c.name) + '</button>'; }).join('') + fallenHere.map(function (p) { return '<button class="btn small" data-act="use" data-item="moonwater" data-target="' + p.id + '">Wake ' + esc(p.name) + ' (fell here)</button>'; }).join('');
    }
    if (d.equip) out += '<button class="btn small" data-act="equip" data-item="' + id + '" data-off="' + (e.eq ? 1 : 0) + '">' + (e.eq ? 'Unequip' : 'Equip') + '</button>';
    out += here.map(function (p) { return '<button class="btn small" data-act="give" data-item="' + id + '" data-to="' + p.id + '">Give to ' + esc(p.name) + '</button>'; }).join('');
    out += '<button class="btn small danger" data-act="drop" data-item="' + id + '">Leave it here</button></div><div class="row" style="margin-top:12px"><button class="btn primary" data-act="closemodal">Close</button></div></div></div>';
    return out;
  };

  UI.giveModal = function (toId) {
    var v = view(), m = v.me, to = pl(toId);
    var out = '<div class="modal" role="dialog" aria-modal="true" aria-label="Give"><div class="box"><h2>GIVE TO ' + esc(to.name.toUpperCase()) + '</h2><div class="chips-row">';
    out += m.inv.map(function (e) { return '<button class="btn small" data-act="give" data-item="' + e.id + '" data-to="' + toId + '">' + itemIcon(e.id, 18) + ' ' + esc(item(e.id).name) + '</button>'; }).join('');
    if (m.silver) out += '<button class="btn small" data-act="givesilver" data-to="' + toId + '">1 Silver</button>';
    out += '</div><div class="row" style="margin-top:12px"><button class="btn primary" data-act="closemodal">Close</button></div></div></div>';
    return out;
  };

  UI.confirmModal = function (text, payload) {
    return '<div class="modal" role="dialog" aria-modal="true" aria-label="Confirm"><div class="box"><h2>ARE YOU SURE?</h2><p class="serif" style="font-size:1.15rem">' + esc(text) + '</p><div class="row"><button class="btn danger" data-act="confirm-yes">Yes, do it</button><button class="btn" data-act="closemodal">Not yet</button></div></div></div>';
  };

  UI.restModal = function () {
    var m = view().me;
    return '<div class="modal" role="dialog" aria-modal="true" aria-label="Rest"><div class="box"><h2>REST</h2><p class="serif" style="font-size:1.1rem">You rest and recover 2 (more with some skills). While you do, the Hollow draws closer: the Haunting Clock advances by 1. You may rest ' + m.rests + ' more time' + (m.rests === 1 ? '' : 's') + ' this phase.</p><div class="row wrap"><button class="btn" data-act="rest" data-stat="vit">Recover Vitality</button><button class="btn" data-act="rest" data-stat="san">Recover Sanity</button><button class="btn ghost" data-act="closemodal">Cancel</button></div></div></div>';
  };

  UI.menuModal = function () {
    var solo = S.net && S.net.kind === 'offline';
    return '<div class="modal" role="dialog" aria-modal="true" aria-label="Menu"><div class="box"><h2>MENU</h2><div class="opts"><button class="btn" data-act="howto">How to play</button><button class="btn" data-act="settings">Sound &amp; accessibility</button>' + (S.net && S.net.kind === 'online' ? '<button class="btn" data-act="copylink">Copy invite link</button>' : '') + '<button class="btn danger" data-act="leave">' + (solo ? 'Abandon this expedition' : 'Leave the expedition (your seat is kept for rejoining until it ends)') + '</button><button class="btn ghost" data-act="closemodal">Close</button></div></div></div>';
  };
})(window);
