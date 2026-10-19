/* THE HOLLOW — the story-first interface. One question at a time: where am I, what is happening, what can I do,
 * what will it cost. Everything shown comes from the server's view; every button sends the same real commands. */
(function (g) {
  'use strict';
  var A = g.HollowArt, UI = g.HollowUI, S = UI.S, esc = A.esc;
  var Story = g.HollowStory = {};
  var STAT = { might: 'Might', wit: 'Wit', fate: 'Fate' };
  var v = function () { return S.view; }, cat = function () { return S.cat; };
  var loc = function (id) { return S.cat.locations[id]; }, region = function (id) { return S.cat.regions[loc(id).region]; };
  var pct = function (a, b) { return Math.max(0, Math.min(100, Math.round(a / b * 100))); };

  var QUESTIONS = {
    square: 'Why is the well dripping upward?', chapel: 'Who sealed the pews against the door?', nursery: 'Whose voice is in the cradle?', wagon: 'What does the merchant know about the road?',
    belltower: 'The bell rings, but the tower is empty. Find out why.', graveyard: 'Why is every grave empty, and so carefully tended?', bridge: 'Can you cross before the river takes you?', gate: 'Is there a way out of the Hollow?',
    foyer: 'Why are the portraits turned to the wall?', library: 'Which book remembers the vote?', mirror: 'Which of the reflections is lying?', observatory: 'Under which stars was the bell born?', treasury: 'Is the treasure worth what guards it?', corridor: 'Where does the corridor lead when you look away?', blackmarket: 'What would the Broker take from you?',
    forest: 'How do you find a path that will not move?', cabin: 'Who is breathing in the loft?', garden: 'Which of these herbs heals?', orchard: 'What grows from the bones?', moonwell: 'What does the second moon remember?', battlefield: 'Who is still drilling the dead?', shrine: 'What is listening through the shrine?',
    nave: 'Who has been sitting in every pew?', fountain: 'What does the spirit want?', altar: 'What will you pay for power?', reliquary: 'Whose bones are these, really?', ritual: 'What was the twelfth sigil for?', prison: 'Who is still locked in the cells?', warden: 'How do you pass a guardian who will not rest?',
    sealed_crypt: 'Which sigil opens the vault?', ossuary: 'What are the bones singing?', sunken_archive: 'What do the drowned records say?', flooded_hall: 'Where does the water run, and why?', tomb: 'What did Father Venn confess?', hidden_passage: 'What is waiting at the end of the tunnel?', nameless_door: 'What is the bell\'s true name?',
    stair: 'Whose names are cut into these steps?', hall_of_names: 'Whose name does the bell ring last?', still_lake: 'What does the lake show you?', pit: 'What will the pit give back?', forge: 'Why was the bell\'s tongue struck off?', heart_chamber: 'How will the bell stop ringing?'
  };
  var GENERIC_Q = { loc: 'What will you investigate?', event: 'How will you respond?', enemy: 'How will you face it?', boss: 'How will you bring him down?' };

  function sentences(t, n) { var p = String(t || '').match(/[^.!?]+[.!?]+(\s|$)/g); return p ? p.slice(0, n).join('').trim() : String(t || ''); }
  function hook(id) { return sentences(loc(id).desc, 1); }
  function plain(c) {
    var L = c.label || '', n = Math.abs(c.n || 0);
    if (c.k === 'vit' || c.k === 'san') return (c.n < 0 ? 'You lose ' : 'You recover ') + n + (c.k === 'vit' ? ' Vitality.' : ' Sanity.');
    if (c.k === 'clue') return 'New clue added to your journal: ' + L.replace(/^Clue: /, '') + '.';
    if (c.k === 'item') return (c.n < 0 ? 'You lose: ' : 'You gain: ') + L.replace(/^[+−] /, '') + '.';
    if (c.k === 'clock') return c.n > 0 ? 'The Haunting advances.' : 'The Haunting loosens its grip.';
    if (c.k === 'silver') return (c.n < 0 ? 'You pay ' : 'You find ') + n + ' Silver.';
    if (c.k === 'xp') return L + '.';
    if (c.k === 'hint') return L + '.';
    if (c.k === 'ally') return L.replace('Ally: ', 'A new ally: ') + '.';
    return L + '.';
  }

  // ───────────── top bar ─────────────
  Story.bar = function () {
    var V = v(), G = V.game, cc = cat().cfg, ph = G.haunt, act = UI.pl(G.active), m = V.me;
    var mine = G.active === V.you, a = g.HollowAudio.settings();
    var turn = mine ? '<b class="mine">Your turn</b> · ' + G.ap + ' action' + (G.ap === 1 ? '' : 's') : (act ? esc(act.name) + '\'s turn' : '');
    var tone = ['Quiet', 'Uneasy', 'Awake'][ph - 1], f = Math.round(G.clock / cc.clockMax * 100);
    return '<header class="topbar" data-phase="' + ph + '"><div class="mk"><span class="mark">The Hollow</span><span class="chap">Chapter One · The Missing Bell</span></div>' +
      '<div class="hz" role="img" aria-label="The Haunting: phase ' + ph + ', ' + G.clock + ' of ' + cc.clockMax + '"><span class="hzl">The Haunting · ' + tone + '</span><span class="hzb"><i style="width:' + f + '%"></i><u style="left:' + Math.round(cc.phaseAt[0] / cc.clockMax * 100) + '%"></u><u style="left:' + Math.round(cc.phaseAt[1] / cc.clockMax * 100) + '%"></u></span></div>' +
      '<div class="tn">' + turn + '</div>' +
      '<div class="bt"><button class="btn ghost icon-btn" data-act="mute" aria-label="' + (a.muted ? 'Unmute' : 'Mute') + '">' + A.glyph(a.muted ? 'moon' : 'bell', 22) + '</button><button class="btn ghost icon-btn" data-act="settings" aria-label="Settings">' + A.glyph('circle', 22) + '</button><button class="btn ghost icon-btn" data-act="menu" aria-label="Menu">' + A.glyph('door', 22) + '</button></div></header>' +
      (m && m.status === 'alive' ? '<div class="resbar"><span class="rp">' + A.portrait(m.cls, UI.cls(m.cls).color) + '</span><span class="rb"><i class="vit" style="width:' + pct(m.vit, m.maxVit) + '%"></i></span><span class="rn">' + m.vit + '</span><span class="rb"><i class="san" style="width:' + pct(m.san, m.maxSan) + '%"></i></span><span class="rn">' + m.san + '</span><span class="grow"></span><span class="rturn">' + (mine ? G.ap + ' actions' : '') + '</span></div>' : '');
  };

  // ───────────── party strip ─────────────
  Story.party = function () {
    var V = v();
    return '<div class="party" aria-label="The party">' + V.players.map(function (p) {
      var c = UI.cls(p.cls), here = UI.me() && p.loc === UI.me().loc, act = V.game.active === p.id;
      return '<div class="pm' + (act ? ' act' : '') + (p.status !== 'alive' ? ' down' : '') + (!p.connected && p.id.indexOf('bot') !== 0 ? ' away' : '') + '" title="' + esc(p.name + ' — ' + c.name + (p.loc ? ', ' + loc(p.loc).name : '')) + '"><span class="pp" style="--ac:' + c.color + '">' + A.portrait(p.cls, c.color) + '</span><span class="pi"><b>' + esc(p.name.replace(' (ghost)', '')) + '</b>' + (p.status === 'alive' ? '<span class="pb"><i style="width:' + pct(p.vit, p.maxVit) + '%"></i></span>' : '<small>' + p.status + '</small>') + '<small>' + (act ? 'taking a turn' : here && p.id !== V.you ? 'here with you' : (p.loc ? esc(loc(p.loc).name) : '')) + '</small></span></div>';
    }).join('') + '</div>';
  };

  // ───────────── the adventure ─────────────
  Story.adventure = function () {
    var V = v(), m = V.me, G = V.game, mine = G.active === V.you, enc = V.enc, lid = m.loc, l = loc(lid), r = region(lid);
    var out = '';
    if (V.vote) out += '<div class="inset">' + UI.votePanel() + '</div>';
    if (m.status === 'fallen') return Story.scene(lid, null) + '<div class="inset">' + UI.spiritPanel() + '</div>';
    if (m.status === 'escaped') return Story.scene(lid, null) + '<div class="inset"><p class="story">You have left the Hollow. The road is dry and the others are still in there. Watch their fate unfold.</p></div>';
    var eEnemy = enc && enc.enemy ? enc.enemy.id : (enc && enc.kind === 'boss' ? 'abbey_warden' : null);
    var active = enc && enc.pid === V.you;
    var title = enc && enc.kind === 'event' ? enc.title : (active && enc.kind !== 'loc' ? enc.title : l.name);
    var html = Story.scene(lid, eEnemy, title, Story.party()) + '<div class="inset">' + out;
    html += Story.guide();
    // story text: short, atmospheric
    var text = enc && (active || enc.loc === lid) ? enc.text : l.desc;
    if (enc && enc.kind === 'loc' && !mine) text = l.desc;
    html += '<p class="story' + (m.hallu ? ' hallu' + m.hallu : '') + '">' + esc(sentences(text, 2)) + '</p>';
    if (m.hallu && m.ghost) html += '<p class="ghostline">' + esc(m.ghost) + '</p>';
    // enemy / boss state, plainly
    if (enc && enc.enemy) html += '<div class="foe"><b>' + esc(enc.enemy.name) + '</b> <span class="hp">' + hpPips(enc.enemy.hp, enc.enemy.max) + '</span> ' + (enc.enemy.known ? '<span class="muted">You know its weakness.</span>' : '<span class="muted">Failing against it will reveal its weakness.</span>') + '</div>';
    if (enc && enc.boss) html += '<div class="foe"><b>' + esc(cat().boss.name) + '</b> <span class="hp">' + hpPips(enc.boss.hp, enc.boss.max) + '</span> <span class="muted">Chains left: ' + enc.boss.chains + '. Next blow: ' + (enc.boss.attack.vit ? (-enc.boss.attack.vit) + ' Vitality ' : '') + (enc.boss.attack.san ? (-enc.boss.attack.san) + ' Sanity' : '') + '</span></div>';
    if (enc && enc.guard && !m.unnoticed) html += '<p class="warnline">' + esc(enc.guardText) + '</p>';
    if (enc && enc.result && (enc.result.by === V.you || enc.loc === lid)) html += Story.outcome(enc.result);
    html += Story.actions();
    return html + '</div>';
  };
  function hpPips(a, b) { var o = ''; for (var i = 0; i < b; i++) o += '<i class="' + (i < a ? '' : 'off') + '"></i>'; return o; }

  // ───────────── things in the scene you can touch ─────────────
  // Each hotspot is just another way to pick an existing option of the location's encounter (same ids as the engine data),
  // so costs, checks, once-rules and multiplayer all stay exactly as the rules define them. x/y are in the 640×260 art.
  var HOT = {
    square: { board: [198, 190, 'Notice board'], well: [320, 196, 'The well'], rally: [448, 218, 'Camp fire'] },
    chapel: { pray: [320, 190, 'Broken altar'], vestry: [200, 200, 'Vestry'], plate: [440, 215, 'Collection plate'], hatch: [400, 232, 'Tithe-hatch'] },
    nursery: { answer: [320, 205, 'The rocking cradle'], inspect: [210, 215, 'Six cradles'], burn: [430, 205, 'Fire'], gift: [390, 232, 'Offering'] }
  };
  Story.hot = function () {
    var V = v(), enc = V.enc, lid = V.me.loc, map = HOT[lid], out = [];
    if (!map || !enc || enc.kind !== 'loc' || enc.over || !enc.options || V.game.active !== V.you || S.ui.prep || S.ui.travel || enc.hold) return out;
    enc.options.forEach(function (o) { var h = map[o.id]; if (h) out.push({ o: o, x: h[0], y: h[1], name: h[2] }); });
    return out;
  };
  function hotSvg(list) {
    return '<g class="hotlayer">' + list.map(function (h) {
      var st = h.o.state === 'ok' ? 'ok' : h.o.state === 'done' ? 'done' : 'off', foc = S.ui.focus === h.o.id ? ' sel' : '';
      var label = esc(h.name) + (st === 'done' ? ' · done' : st === 'off' ? ' · ' + esc(h.o.why || 'not now') : '');
      var w = Math.max(70, label.length * 5.6);
      return '<g class="hs ' + st + foc + '" ' + (st === 'ok' ? 'data-act="hot" data-opt="' + h.o.id + '" data-x="' + h.x + '" data-y="' + h.y + '" tabindex="0" role="button"' : 'role="img"') + ' aria-label="' + esc(h.o.label) + (st === 'ok' ? '' : ' (unavailable)') + '" transform="translate(' + h.x + ' ' + h.y + ')">' +
        '<circle class="hz" r="34" fill="transparent"/><circle class="hr" r="17"/><circle class="hr2" r="17"/><circle class="hd" r="3.6"/>' +
        '<g class="tip" transform="translate(0 -30)"><rect x="' + (-w / 2) + '" y="-15" width="' + w + '" height="19" rx="3"/><text text-anchor="middle" y="-2">' + label + '</text></g></g>';
    }).join('') + '</g>';
  }
  // compact prompt shown after you tap an object: what it is, what it risks, one button
  function hotPrompt(list) {
    var f = list.find(function (h) { return h.o.id === S.ui.focus && h.o.state === 'ok'; }); if (!f) return '';
    var o = f.o, chips = '';
    if (o.kind === 'check') chips += '<i class="sk ' + o.stat + '">' + STAT[o.stat] + '</i><i>Difficulty ' + o.dc + '</i>' + risk(o);
    chips += '<i>1 action</i>' + (o.cost ? '<em>' + costWords(o.cost) + '</em>' : '');
    return '<div class="hsprompt" role="group" aria-label="' + esc(o.label) + '"><b>' + esc(o.label) + '</b><span class="chips">' + chips + '</span><span class="hsb"><button class="btn primary" data-act="choice" data-opt="' + o.id + '">' + (o.kind === 'check' ? 'Try it' : 'Do it') + '</button><button class="btn ghost" data-act="hotoff">Back</button></span></div>';
  }

  Story.scene = function (lid, enemyId, title, party) {
    var l = loc(lid), r = region(lid), hs = Story.hot(), foc = S.ui.focus && hs.some(function (h) { return h.o.id === S.ui.focus && h.o.state === 'ok'; }) ? S.ui.focus : null;
    var svg = A.scene(l.scene, lid, r.color, l.region, l.glyph);
    if (hs.length) svg = svg.replace(/<\/svg>$/, hotSvg(hs) + '</svg>');
    var fs = '';
    if (foc && S.ui.focusAt) fs = ' style="--fx:' + S.ui.focusAt.fx + '%;--fy:' + S.ui.focusAt.fy + '%"';
    return '<div class="scene' + (hs.length ? ' playable' : '') + (foc ? ' focus' : '') + '"' + fs + '>' + (party || '') + '<div class="art">' + svg + '</div><div class="fogx f1"></div><div class="fogx f2"></div>' + (enemyId ? '<div class="foeart">' + A.enemy(enemyId) + '</div>' : '') + '<div class="st"><div class="rg" style="color:' + r.color + '">' + esc(r.name) + '</div><h1>' + esc(title || l.name) + '</h1></div>' + (hs.length && !foc ? '<div class="hshint">Touch something glowing</div>' : '') + hotPrompt(hs) + '</div>';
  };

  // "YOUR TURN — 2 actions remaining" and what to do next
  Story.guide = function () {
    var V = v(), G = V.game, m = V.me, mine = G.active === V.you, enc = V.enc, act = UI.pl(G.active);
    var head, hint = '';
    if (mine) {
      head = 'YOUR TURN — ' + (G.ap > 0 ? G.ap + ' action' + (G.ap === 1 ? '' : 's') + ' remaining' : 'no actions left');
      if (S.ui.prep) hint = 'Check the odds, then roll the die.';
      else if (Story.hot().length && !enc.result) hint = 'Touch something glowing in the scene, or travel on.';
      else if (enc && enc.hold) hint = 'The roll fell short. You may change fate, or accept it.';
      else if (enc && (enc.kind === 'enemy' || enc.kind === 'boss')) hint = 'Something has you. Fight, trick it, use an item, or flee.';
      else if (enc && enc.result) hint = G.ap > 0 ? 'Choose another action, or travel on.' : 'End your turn to pass to the next player.';
      else if (G.ap > 0) hint = 'Investigate here, or travel to another place.';
      else hint = 'End your turn to pass to the next player.';
    } else {
      head = act ? 'WAITING — ' + esc(act.name.toUpperCase()) + '\'S TURN' : 'WAITING';
      hint = act && !act.connected && act.id.indexOf('bot') !== 0 ? esc(act.name) + ' has lost the thread. ' + esc(V.policy) : 'Watch what happens. If you are in the same place, you may be able to help.';
    }
    return '<div class="guide"><b>' + head + '</b><span>' + hint + '</span></div>';
  };

  Story.outcome = function (r) {
    var tier = r.tier, head = { crit: 'CRITICAL SUCCESS', ok: 'SUCCESS', fail: 'FAILURE', fumble: 'CRITICAL FAILURE', auto: 'DONE' }[tier];
    var story = (r.lines || []).filter(function (x) { return x.k === 'story'; }).map(function (x) { return '<p class="story">' + esc(x.t) + '</p>'; }).join('');
    var info = (r.lines || []).filter(function (x) { return x.k === 'info'; }).map(function (x) { return '<li>' + esc(x.t) + '</li>'; }).join('');
    var ch = (r.chips || []).filter(function (c) { return c.k !== 'enemy'; }).map(function (c) { return '<li class="' + (c.tone === 'bad' ? 'bad' : 'good') + '">' + esc(plain(c)) + '</li>'; }).join('');
    var die = r.roll ? '<div class="mdie t-' + tier + '" data-n="' + r.n + '" data-d="' + r.roll.d + '" aria-hidden="true">' + r.roll.d + '</div>' : '';
    return '<div class="outcome t-' + tier + '" role="status"><div class="oh">' + die + '<div><b>' + head + (r.roll ? ' — ' + r.roll.total + ' vs ' + r.roll.dc : '') + '</b><small>' + esc(r.opt) + (r.roll ? ' · d20 ' + r.roll.d + (r.roll.mod >= 0 ? ' + ' : ' − ') + Math.abs(r.roll.mod) : '') + '</small></div></div>' + story + ((ch || info) ? '<div class="changed"><span>What changed</span><ul>' + ch + info + '</ul></div>' : '') + '</div>';
  };

  // ───────────── choices ─────────────
  function risk(o) { return o.kind !== 'check' ? '' : (o.chance >= 65 ? '<i class="rk safe">Good odds</i>' : o.chance >= 40 ? '<i class="rk mid">Risky</i>' : '<i class="rk bad">Dangerous</i>'); }
  function choice(o, primary) {
    var skill = o.kind === 'check' ? '<i class="sk ' + o.stat + '">' + STAT[o.stat] + '</i>' : (o.kind === 'puzzle' ? '<i class="sk puz">Reasoning</i>' : '');
    var cost = o.cost ? ' <em>' + costWords(o.cost) + '</em>' : '';
    var dis = o.state !== 'ok';
    var ico = o.kind === 'check' ? { might: 'sword', wit: 'book', fate: 'moon' }[o.stat] : o.kind === 'puzzle' ? 'keyhole' : (o.cost && o.cost.silver ? 'chest' : 'door');
    return '<button class="choice' + (primary ? ' primary' : '') + (dis ? ' off' : '') + '" data-act="choice" data-opt="' + o.id + '"' + (dis ? ' disabled' : '') + '><span class="ci">' + A.glyph(ico, 24) + '</span><span class="cn">' + esc(o.label) + '</span><span class="cl">' + esc(dis ? o.why : (o.stakes || '')) + cost + '</span><span class="ct">' + skill + risk(o) + '</span></button>';
  }
  function costWords(c) { var o = []; if (c.silver) o.push(c.silver + ' Silver'); if (c.san) o.push(c.san + ' Sanity'); if (c.vit) o.push(c.vit + ' Vitality'); if (c.maxvit) o.push(c.maxvit + ' max Vitality'); if (c.item) o.push('uses ' + UI.item(c.item).name); return o.length ? '(costs ' + o.join(', ') + ')' : ''; }

  Story.actions = function () {
    var V = v(), G = V.game, m = V.me, mine = G.active === V.you, enc = V.enc, a = V.act;
    var q = enc && enc.kind === 'loc' ? (QUESTIONS[enc.loc] || GENERIC_Q.loc) : (enc ? GENERIC_Q[enc.kind] : (QUESTIONS[m.loc] || GENERIC_Q.loc));
    var out = '', extraTop = '';
    if (!mine) return Story.helpPrompt() + '<div class="tools">' + (UI.groundHtml() || '') + '</div>';
    if (S.ui.travel && a) return Story.travelPanel();
    if (S.ui.prep && enc) { var po = (enc.options || []).find(function (o) { return o.id === S.ui.prep.id; }); if (po) return out + Story.prep(po, enc); S.ui.prep = null; }
    if (enc && enc.hold) return UI.holdPanel(enc.hold);
    out += '<h2 class="question">' + esc(q) + '</h2>';
    var opts = enc && enc.options ? enc.options : [];
    var okOpts = opts.filter(function (o) { return o.state === 'ok'; }), rest = opts.filter(function (o) { return o.state !== 'ok' && o.state !== 'done'; });
    var inEnemy = enc && (enc.kind === 'enemy' || enc.kind === 'boss');
    var cap = inEnemy ? 4 : 3, shown = okOpts.slice(0, cap), more = okOpts.slice(cap).concat(rest);
    out += Story.coach();
    var hasHot = Story.hot().length > 0, list = '<div class="choices' + (S.ui.coach === 1 ? ' coach' : '') + '">';
    if (hasHot) { var hl = ''; shown.forEach(function (o) { hl += choice(o, false); }); extraTop = hl; } else shown.forEach(function (o) { list += choice(o, false); });
    // the standing choices
    if (enc && enc.over && !shown.length) list += '<button class="choice primary" data-act="leaveenc"><span class="ci">' + A.glyph('door', 24) + '</span><span class="cn">Continue</span><span class="cl">Move on to what comes next.</span></button>';
    else if (!enc && a.interact.ok) list += '<button class="choice primary" data-act="interact"><span class="ci">' + A.glyph('door', 24) + '</span><span class="cn">' + esc(a.interact.label) + '</span><span class="cl">See what this place offers.</span></button>';
    if (a && !(enc && enc.kind === 'event' && !enc.over)) list += '<button class="choice go" data-act="travel"><span class="ci">' + A.glyph('bridge', 24) + '</span><span class="cn">' + (inEnemy ? 'Flee somewhere else' : 'Travel somewhere else') + '</span><span class="cl">' + (inEnemy ? 'Retreat along an open road (it will strike as you leave).' : 'Choose where to go next. ' + (G.ap < 1 ? 'You have no actions left.' : 'Costs 1 action.')) + '</span></button>';
    list += '</div>';
    out += list;
    // everything else, tucked away
    var extra = extraTop;
    more.forEach(function (o) { extra += choice(o, false); });
    if (a) {
      if (a.investigate.ok) extra += '<button class="choice" data-act="investigate"><span class="cn">Search for hidden things</span><span class="cl">Investigate this place for secrets and hidden routes (1 action).</span></button>';
      if (a.explore.ok) extra += '<button class="choice" data-act="explore"><span class="cn">Wander the surroundings</span><span class="cl">Meet something new in this region (1 action).</span></button>';
      if (a.rest.ok) extra += '<button class="choice" data-act="rest-ui"><span class="cn">Rest</span><span class="cl">Recover a little, while the Haunting creeps closer (1 action).</span></button>';
      if (a.echo.ok) extra += '<button class="choice" data-act="echo"><span class="cn">Follow an echo</span><span class="cl">A shortcut, maybe a dangerous one' + (a.echo.cost ? ' (costs 1 Sanity)' : '') + '.</span></button>';
      if (enc && !enc.over && enc.kind === 'loc') extra += '<button class="choice" data-act="leaveenc"><span class="cn">Step back</span><span class="cl">Close this encounter without acting.</span></button>';
    }
    if (extra) out += '<details class="more"' + (S.ui.more ? ' open' : '') + '><summary data-act="more">' + (hasHot ? 'Or choose from a list' : 'More options') + '</summary><div class="choices">' + extra + '</div></details>';
    if (G.ap < 1) out += '<button class="btn primary big" data-act="endturn">End turn</button>';
    else out += '<div class="endrow"><button class="btn ghost" data-act="endturn">End turn early</button></div>';
    return out + UI.groundHtml();
  };

  // shown while someone else acts: can I help?
  Story.helpPrompt = function () {
    var V = v(), enc = V.enc, out = '';
    if (!enc || !enc.aid || enc.pid === V.you) return '';
    var who = UI.pl(enc.pid), mine = enc.allies && enc.allies.find(function (x) { return x.id === V.you; });
    if (mine && enc.aid.asked && V.me.status === 'alive') out += '<div class="aid"><b>' + esc(who.name) + ' needs help with this roll.</b><span>Lending a hand adds +2 and costs you 1 Sanity (once a round).</span><button class="btn primary" data-act="aid"' + (V.me.aided || V.me.san < 2 || enc.aid.bonus >= 4 ? ' disabled' : '') + '>Help ' + esc(who.name.replace(' (ghost)', '')) + '</button></div>';
    return out;
  };

  // before a roll: what am I attempting, how hard, what is at stake
  Story.prep = function (o, enc) {
    var V = v(), out = '<div class="prep"><h2>' + esc(o.label) + '</h2>';
    if (o.kind === 'check') {
      var odds = o.chance >= 75 ? 'You are likely to manage this.' : o.chance >= 50 ? 'It could go either way.' : o.chance >= 30 ? 'The odds are against you.' : 'This is a long shot.';
      out += '<div class="pcheck"><span class="sk ' + o.stat + '">' + STAT[o.stat] + ' check</span> <b>Difficulty ' + o.dc + '</b> <span class="muted">(' + esc(o.dcName) + ')</span></div><p class="odds">' + odds + '</p>';
      if (o.stakes) out += '<p class="stakes">' + esc(o.stakes) + '</p>';
      out += '<details class="why"><summary>Why these odds?</summary><div class="mods">' + o.mods.map(function (mm) { return '<span class="dm ' + (mm.v < 0 ? 'neg' : 'pos') + '">' + esc(mm.l) + ' ' + (mm.v > 0 ? '+' : '−') + Math.abs(mm.v) + '</span>'; }).join('') + o.dcMods.map(function (mm) { return '<span class="dm ' + (mm.v > 0 ? 'neg' : 'pos') + '">' + esc(mm.l) + ' (difficulty ' + (mm.v > 0 ? '+' : '−') + Math.abs(mm.v) + ')</span>'; }).join('') + '</div></details>';
      // can a companion help?
      if (enc.allies && enc.allies.length && enc.canAsk) {
        var names = enc.allies.map(function (x) { return esc(x.name.replace(' (ghost)', '')); }).join(' and ');
        if (!enc.aid.asked) out += '<div class="aidask"><span>' + names + ' can help with this. Helping adds +2 to your roll and costs them 1 Sanity.</span><button class="btn" data-act="askaid">Ask ' + names + ' for help</button></div>';
        else out += '<p class="muted">' + (enc.aid.bonus ? esc(enc.aid.helpers.join(', ')) + ' lend a hand: +' + enc.aid.bonus + ' to your roll.' : 'Waiting to see if they will help…') + '</p>';
      }
      out += '<div class="prow"><button class="btn primary big" data-act="choose" data-opt="' + o.id + '"' + (o.confirm ? ' data-confirm="' + esc(o.confirm) + '"' : '') + '>Roll the D20</button><button class="btn ghost" data-act="unprep">Back</button></div>';
    } else if (o.kind === 'puzzle') {
      out += '<p class="stakes">' + esc(o.puzzle.title) + ' Wrong answers are ruled out for everyone.</p><div class="puz">' + o.puzzle.chips.map(function (c) { return '<button class="btn' + (c.out ? ' out' : '') + '" data-act="choose" data-opt="' + o.id + '" data-val="' + esc(c.v) + '"' + (c.out || c.can === false ? ' disabled' : '') + '>' + esc(c.label) + (c.price ? ' <small>(' + esc(c.price) + ')</small>' : '') + '</button>'; }).join('') + '</div>' + (o.puzzle.deduced ? '<p class="muted">Everything else has been ruled out.</p>' : '') + '<div class="prow"><button class="btn ghost" data-act="unprep">Back</button></div>';
    } else if (o.needsTarget) {
      out += '<p class="stakes">' + esc(o.stakes) + '</p><div class="puz">' + (o.targets || []).map(function (t) { return '<button class="btn" data-act="choose" data-opt="' + o.id + '" data-target="' + t.id + '">Return ' + esc(t.name) + '</button>'; }).join('') + '</div><div class="prow"><button class="btn ghost" data-act="unprep">Back</button></div>';
    }
    return out + '</div>';
  };

  Story.coach = function () {
    if (S.ui.coach == null || S.ui.coach === 'done') return '';
    var V = v();
    if (S.ui.coach === 0) return '<div class="coachcard"><b>Your expedition begins at the Silent Square.</b><p>The village is missing from every map. A well drips upward. A bell rings from an empty tower.</p><p>Pick a first investigation. Each choice costs one action; risky ones show their difficulty before you roll.</p><div class="prow"><button class="btn primary" data-act="coach" data-s="1">Begin</button><button class="btn ghost" data-act="coach" data-s="done">Skip the guide</button></div></div>';
    if (S.ui.coach === 2) return '<div class="coachcard"><b>That is the whole loop.</b><p>Investigate, travel, roll when it matters. When actions run out, end your turn.</p><div class="prow"><button class="btn primary" data-act="coach" data-s="done">Got it</button></div></div>';
    return '';
  };

  // ───────────── destination chooser ─────────────
  Story.travelPanel = function () {
    var V = v(), a = V.act, G = V.game, enemy = !!a.parting, mv = a.moves;
    var vis = function (id) { return V.map.locs[id] && V.map.locs[id].v; };
    var ok = mv.filter(function (r) { return r.ok; }).sort(function (x, y) { return (vis(x.to) ? 1 : 0) - (vis(y.to) ? 1 : 0) || (x.enemy ? 1 : 0) - (y.enemy ? 1 : 0); });
    var top = ok.slice(0, 3);
    var row = function (r) {
      var l = loc(r.to), reg = region(r.to);
      return '<div class="dest"><div class="dg" style="color:' + reg.color + '">' + A.glyph(vis(r.to) ? l.glyph : 'keyhole', 26) + '</div><div class="di"><b>' + esc(l.name) + '</b><span>' + esc(hook(r.to)) + '</span><small>' + (vis(r.to) ? 'Visited' : 'Unexplored') + (r.enemy ? ' · <u>' + esc(S.cat.enemies[r.enemy].name) + ' lurks there</u>' : '') + (r.oneway ? ' · one-way' : '') + (r.type === 'hidden' ? ' · hidden way' : '') + '</small></div><div class="db"><button class="btn primary" data-act="move" data-mode="step" data-to="' + r.to + '"' + (G.ap < 1 ? ' disabled' : '') + '>Go carefully</button>' + (r.enemy && r.sneak ? '<button class="btn small" data-act="move" data-mode="sneak" data-to="' + r.to + '"' + (G.ap < 1 ? ' disabled' : '') + '>Sneak past (' + (r.sneak.chance >= 60 ? 'likely' : r.sneak.chance >= 35 ? 'risky' : 'unlikely') + ')</button>' : '') + '</div></div>';
    };
    var out = '<div class="travelp"><h2>' + (enemy ? 'Where do you flee?' : 'Where do you want to go?') + '</h2>' + (G.ap < 1 ? '<p class="note bad">You have no actions left this turn.</p>' : '<p class="muted">Travelling costs 1 action.' + (enemy ? ' Something has you: leaving costs a parting blow.' : '') + '</p>') + (top.length ? top.map(row).join('') : '<p class="note">No road is open from here. Search for hidden ways, or unlock a road below.</p>');
    var rest = ok.slice(3), locked = mv.filter(function (r) { return !r.ok; }), spr = a.sprint, fol = a.follow;
    if (rest.length || locked.length || spr.length || fol.length) out += '<details class="more"><summary>More ways to travel</summary>' + rest.map(row).join('') + (spr.length ? '<h3>Further afield (sprint: two roads for one action, noisy, hazards bite)</h3>' + spr.map(function (s) { return '<div class="dest"><div class="dg">' + A.glyph('bridge', 24) + '</div><div class="di"><b>' + esc(loc(s.to).name) + '</b><span>Past ' + esc(loc(s.via).name) + '.</span></div><div class="db"><button class="btn" data-act="move" data-mode="sprint" data-to="' + s.to + '"' + (G.ap < 1 ? ' disabled' : '') + '>Sprint</button></div></div>'; }).join('') : '') + (fol.length ? '<h3>Follow a companion</h3><div class="chips-row">' + fol.map(function (f) { return '<button class="btn small" data-act="follow" data-to="' + f.id + '"' + (G.ap < 1 ? ' disabled' : '') + '>Follow ' + esc(f.name) + '</button>'; }).join('') + '</div>' : '') + (locked.length ? '<h3>Blocked roads</h3>' + locked.map(function (r) { return '<div class="dest off"><div class="dg">' + A.glyph(r.state === 'locked' ? 'keyhole' : 'chain', 24) + '</div><div class="di"><b>' + esc(loc(r.to).name) + '</b><span>' + esc(r.label || '') + ' ' + esc(r.why) + '</span><div class="chips-row">' + (r.ways || []).map(function (w) { return w.flag ? '' : '<button class="btn small" data-act="unlock" data-edge="' + r.key + '" data-way="' + w.id + '"' + (w.ok && G.ap >= w.ap ? '' : ' disabled') + ' title="' + esc(w.why) + '">' + esc(w.label) + (w.stat ? ' (' + (w.chance >= 60 ? 'likely' : w.chance >= 35 ? 'risky' : 'unlikely') + ')' : '') + '</button>'; }).join('') + '</div></div></div>'; }).join('') : '') + '</details>';
    out += '<div class="prow"><button class="btn" data-act="map">Open the full map</button><button class="btn ghost" data-act="untravel">Stay here</button></div></div>';
    return out;
  };

  // ───────────── supporting column ─────────────
  Story.side = function () {
    var V = v(), m = V.me, c = UI.cls(m.cls), G = V.game, mine = G.active === V.you, lid = m.loc;
    var items = m.inv.map(function (e) { var d = UI.item(e.id); return '<button class="it" data-act="item" data-item="' + e.id + '" title="' + esc(d.name + ' — ' + d.desc.split('. ')[0] + '.') + '" aria-label="' + esc(d.name) + '">' + A.itemArt(e.id, 34) + (e.n > 1 ? '<i>' + e.n + '</i>' : '') + (e.eq ? '<u></u>' : '') + '</button>'; }).join('') || '<span class="muted small">Your pack is empty.</span>';
    return '<section class="me" style="--ac:' + c.color + '"><div class="mh"><span class="mp">' + A.portrait(m.cls, c.color) + '</span><div><b>' + esc(UI.pl(V.you).name) + '</b><span>' + esc(c.name) + ' · level ' + m.level + '</span></div></div>' +
      '<div class="mv"><span>Vitality</span><i class="bar vit"><b style="width:' + pct(m.vit, m.maxVit) + '%"></b></i><em>' + m.vit + '/' + m.maxVit + '</em></div><div class="mv"><span>Sanity</span><i class="bar san"><b style="width:' + pct(m.san, m.maxSan) + '%"></b></i><em>' + m.san + '/' + m.maxSan + '</em></div>' +
      (mine ? '<div class="mv"><span>Actions</span><span class="pips">' + UI.apPips() + '</span></div>' : '') +
      (m.sts.length ? '<div class="chips-row">' + m.sts.map(function (s) { var d = S.cat.statuses[s]; return '<span class="chip ' + (d.good ? 'good' : 'bad') + '" title="' + esc(d.text) + '">' + esc(d.name) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="pk"><span class="tl">Pack ' + m.pack + '/' + m.packMax + '</span><div class="its">' + items + '</div></div><button class="btn small" data-act="drawer" data-d="left">Character sheet' + (m.offer ? ' ●' : '') + '</button></section>' +
      '<section class="mm"><button class="mini" data-act="map" aria-label="Open the full map"><div class="mmap">' + g.HollowMap.render({ mini: true }) + '</div><span class="tl">Map · you are at ' + esc(loc(lid).name) + '</span></button></section>' +
      '<section class="jr"><button class="btn" data-act="drawer" data-d="right">' + A.glyph('book', 18) + ' Journal' + (S.ui.newClue ? ' <i class="dotnote"></i>' : '') + '</button><div class="obj"><b>Find out:</b> why the bell rings, and how it can end.<br><span class="muted small">' + V.world.pillars.filter(function (p) { return p.done; }).length + ' of 4 mysteries understood</span></div></section>';
  };
})(window);
