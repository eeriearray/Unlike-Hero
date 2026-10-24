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

  // ───────────── the HUD: compact, secondary to the scene ─────────────
  function clockDial(G, cc) {
    var n = cc.clockMax, f = G.clock / n, s = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="#0b0e15" stroke="#2a3347" stroke-width="2"/>';
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 - Math.PI / 2, r1 = 22, r2 = 27, on = i < G.clock, ph = i >= cc.phaseAt[1] ? 3 : i >= cc.phaseAt[0] ? 2 : 1;
      s += '<path d="M' + (32 + Math.cos(a) * r1).toFixed(1) + ' ' + (32 + Math.sin(a) * r1).toFixed(1) + 'L' + (32 + Math.cos(a) * r2).toFixed(1) + ' ' + (32 + Math.sin(a) * r2).toFixed(1) + '" stroke="' + (on ? ['', '#5fb3a6', '#d2a85a', '#d0545e'][ph] : '#262d3d') + '" stroke-width="' + (cc.phaseAt.indexOf(i) >= 0 ? 3.4 : 2.2) + '" stroke-linecap="round"/>';
    }
    var ha = f * Math.PI * 2 - Math.PI / 2;
    s += '<path class="hand" d="M32 32L' + (32 + Math.cos(ha) * 17).toFixed(1) + ' ' + (32 + Math.sin(ha) * 17).toFixed(1) + '" stroke="#e3c680" stroke-width="2.4" stroke-linecap="round"/><circle cx="32" cy="32" r="4" fill="#e3c680"/>';
    s += '<path d="M26 44h12M27 40q5-10 10 0" stroke="#8a93ab" stroke-width="1.6" fill="none" opacity=".6"/></svg>';
    return s;
  }
  Story.bar = function () {
    var V = v(), G = V.game, cc = cat().cfg, ph = G.haunt, m = V.me, mine = G.active === V.you, a = g.HollowAudio.settings(), act = UI.pl(G.active);
    var c = UI.cls(m.cls), tone = ['Quiet', 'Uneasy', 'Awake'][ph - 1], d = S.ui.drawer, slv = m.silver;
    var me = '<div class="h-me" style="--ac:' + c.color + '"><button id="hud-me" class="hme" data-act="drawer" data-d="left" aria-label="Character sheet">' + A.portrait(m.cls, c.color) + (m.offer ? '<i class="dotnote"></i>' : '') + '</button>' +
      '<div class="hbars"><span class="hb" title="Vitality"><i class="vit" style="width:' + pct(m.vit, m.maxVit) + '%"></i><em>' + 'Vitality ' + m.vit + '</em></span><span class="hb" title="Sanity"><i class="san" style="width:' + pct(m.san, m.maxSan) + '%"></i><em>' + 'Sanity ' + m.san + '</em></span></div>' +
      '<div class="hturn' + (mine ? ' mine' : '') + '">' + (mine ? '<b>Your turn</b>' + UI.apPips() : '<span>' + (act ? esc(act.name.replace(' (ghost)', '')) + '\'s turn' : '') + '</span>') + '</div></div>';
    var clock = '<div id="hud-clock" class="h-clock" data-phase="' + ph + '" role="img" aria-label="The Haunting Clock: ' + G.clock + ' of ' + cc.clockMax + ', phase ' + ph + '">' + clockDial(G, cc) + '<span><small>The Haunting</small><b>' + tone + '</b></span></div>';
    var party = '<div class="h-party" aria-label="The party">' + V.players.map(function (p) {
      var pc = UI.cls(p.cls), on = G.active === p.id;
      return '<span class="hp-p' + (on ? ' on' : '') + (p.status !== 'alive' ? ' down' : '') + (p.id === V.you ? ' you' : '') + (!p.connected && p.id.indexOf('bot') !== 0 ? ' away' : '') + '" data-pid="' + esc(p.id) + '" style="--ac:' + pc.color + '" title="' + esc(p.name + ' — ' + pc.name + (p.loc ? ', ' + loc(p.loc).name : '') + (p.status === 'alive' ? ', ' + p.vit + ' Vitality, ' + p.san + ' Sanity' : ', ' + p.status)) + '">' + A.portrait(p.cls, pc.color) + (p.status === 'alive' ? '<i class="pv" style="width:' + pct(p.vit, p.maxVit) + '%"></i>' : '') + '</span>';
    }).join('') + '</div>';
    var btn = function (id, act2, glyph, label, extra, attrs) { return '<button' + (id ? ' id="' + id + '"' : '') + ' class="hbtn" data-act="' + act2 + '"' + (attrs || '') + ' aria-label="' + label + '" title="' + label + '">' + A.glyph(glyph, 20) + (extra || '') + '</button>'; };
    var btns = '<div class="h-btns">' +
      btn('hud-pack', 'drawer', 'chest', 'Pack and character', '<i class="cnt">' + m.pack + '/' + m.packMax + '</i>', ' data-d="left" aria-expanded="' + (d === 'left') + '"') +
      '<span id="hud-silver" class="hsil" title="Silver"><i class="coin"></i>' + (slv || 0) + '</span>' +
      btn('hud-journal', 'drawer', 'book', 'Journal', S.ui.newClue ? '<i class="dotnote"></i>' : '', ' data-d="right" aria-expanded="' + (d === 'right') + '"') +
      btn('', 'map', 'maze', 'Map') +
      btn('', 'soundpop', a.muted ? 'moon' : 'bell', 'Sound', '', ' aria-expanded="' + !!S.ui.soundpop + '"') +
      btn('', 'menu', 'door', 'Menu') + '</div>';
    var pop = '';
    if (S.ui.soundpop) {
      var sl = function (k, lab) { return '<label class="sl"><span>' + lab + '</span><input type="range" min="0" max="100" value="' + Math.round(a[k] * 100) + '" data-act="vol" data-bus="' + k + '" aria-label="' + lab + ' volume"></label>'; };
      pop = '<div class="soundpop" role="dialog" aria-label="Sound"><button class="btn small' + (a.muted ? ' primary' : '') + '" data-act="mute">' + (a.muted ? 'Unmute' : 'Mute all') + '</button>' + sl('master', 'Master') + sl('ambient', 'Ambience') + sl('sfx', 'Effects') + sl('music', 'Music') + '<button class="btn ghost small" data-act="settings">More settings…</button></div>';
    }
    return '<header class="hud2" data-phase="' + ph + '">' + me + clock + party + btns + pop + '</header>';
  };
  Story.party = function () { return ''; };

  // ───────────── the adventure: everything that floats over the scene ─────────────
  Story.adventure = function () {
    var V = v(), m = V.me, G = V.game, mine = G.active === V.you, enc = V.enc, lid = m.loc;
    var out = '';
    if (V.vote) out += '<div class="ovp">' + UI.votePanel() + '</div>';
    if (m.status === 'fallen') return out + Story.caption() + '<div class="ovp">' + UI.spiritPanel() + '</div>';
    if (m.status === 'escaped') return out + '<div class="ovp"><p class="story">You have left the Hollow. The road is dry and the others are still in there. Watch their fate unfold.</p></div>';
    // something has you
    if (enc && enc.enemy && enc.loc === lid) out += '<div class="foebox"><div class="fa">' + A.enemy(enc.enemy.id) + '</div><b>' + esc(enc.enemy.name) + '</b><span class="hp">' + hpPips(enc.enemy.hp, enc.enemy.max) + '</span><small>' + (enc.enemy.known ? 'You know its weakness.' : 'Failing against it reveals its weakness.') + '</small></div>';
    if (enc && enc.boss) out += '<div class="foebox boss"><div class="fa">' + A.enemy('abbey_warden') + '</div><b>' + esc(cat().boss.name) + '</b><span class="hp">' + hpPips(enc.boss.hp, enc.boss.max) + '</span><small>Chains: ' + enc.boss.chains + ' · next blow ' + (enc.boss.attack.vit ? '−' + enc.boss.attack.vit + ' Vit ' : '') + (enc.boss.attack.san ? '−' + enc.boss.attack.san + ' San' : '') + '</small></div>';
    out += Story.caption();
    if (mine) {
      if (S.ui.travel && V.act) return out + '<div class="ovp travel">' + Story.travelPanel() + '</div>';
      if (enc && enc.hold) return out + '<div class="ovp hold">' + UI.holdPanel(enc.hold) + '</div>';
      out += g.HollowCards.icard(V);
      out += Story.coach();
      out += '<div class="trayhost">' + g.HollowCards.tray(V) + '</div>';
    } else {
      var act = UI.pl(G.active), c = act ? UI.cls(act.cls) : null, away = act && !act.connected && act.id.indexOf('bot') !== 0;
      out += '<div class="trayhost"><div class="waiting"><span class="wp" style="--ac:' + (c ? c.color : '#888') + '">' + (act ? A.portrait(act.cls, c.color) : '') + '</span><div><b>' + (act ? esc(act.name.replace(' (ghost)', '')) + ' is taking a turn' : 'Waiting') + '</b><small>' + (away ? esc(act.name) + ' has lost the thread. ' + esc(V.policy) : act && act.loc === lid ? 'Here with you. Watch, and help if they ask.' : act && act.loc ? 'At ' + esc(loc(act.loc).name) + '.' : '') + '</small></div></div>' + Story.helpPrompt() + groundCards() + '</div>';
    }
    return out;
  };
  function hpPips(a, b) { var o = ''; for (var i = 0; i < b; i++) o += '<i class="' + (i < a ? '' : 'off') + '"></i>'; return o; }
  function groundCards() {
    var g2 = v().map.ground; if (!g2 || !g2.length) return '';
    return '<div class="ground">' + g2.map(function (s) { return '<button class="gitem" data-act="pickup" data-item="' + s.id + '" title="Pick up ' + esc(UI.item(s.id).name) + '">' + A.itemArt(s.id, 40) + '<span>' + esc(UI.item(s.id).name) + (s.n > 1 ? ' ×' + s.n : '') + '</span></button>'; }).join('') + '</div>';
  }

  // one or two short sentences: where you are, or what just happened
  Story.caption = function () {
    var V = v(), m = V.me, enc = V.enc, lid = m.loc, l = loc(lid), r = region(lid), mine = V.game.active === V.you;
    var head = '', text = '', q = '', chips = '';
    if (enc && enc.result && (enc.result.by === V.you || enc.loc === lid) && !enc.hold) {
      var R = enc.result, who = R.by === V.you ? '' : (UI.pl(R.by) || {}).name;
      var st = (R.lines || []).filter(function (x) { return x.k === 'story'; })[0];
      head = (who ? esc(who) + ' · ' : '') + esc(R.opt);
      text = (R.lines || []).filter(function (line) { return (line.k === 'story' || line.k === 'info') && line.t.indexOf('You already knew this:') !== 0; }).map(function (line) { return line.t; }).join(' ');
      chips = (R.chips || []).filter(function (c) { return c.k !== 'enemy'; }).map(function (c) { return '<i class="cc ' + (c.tone === 'bad' ? 'bad' : 'good') + '">' + esc(c.label) + '</i>'; }).join('');
      var tw = { crit: 'Critical success', ok: 'Success', fail: 'Failure', fumble: 'Critical failure', auto: '' }[R.tier];
      if (tw) head += ' <em class="t-' + R.tier + '">' + tw + (R.roll ? ' · ' + R.roll.total + ' vs ' + R.roll.dc : '') + '</em>';
    } else if (enc && enc.kind !== 'loc' && (enc.pid === V.you || enc.loc === lid)) {
      head = esc(enc.title); text = sentences(enc.text, 2);
    } else {
      if (g.HollowGuidance && m.status === 'alive') return '<div class="cap mission-caption" aria-live="polite">' + g.HollowGuidance.mission(V) + '</div>';
      head = '<span style="color:' + r.color + '">' + esc(r.name) + '</span> · ' + esc(l.name);
      text = sentences(m.description || l.desc, 1);
      if (mine && QUESTIONS[lid]) q = QUESTIONS[lid];
    }
    var hal = m.hallu ? ' hallu' + m.hallu : '';
    return '<div class="cap' + hal + '" aria-live="polite"><div class="ch">' + head + '</div>' + (text ? '<p>' + esc(text) + '</p>' : '') + (q ? '<p class="cq">' + esc(q) + '</p>' : '') + (chips ? '<div class="cchips">' + chips + '</div>' : '') + (m.hallu && m.ghost ? '<p class="ghostline">' + esc(m.ghost) + '</p>' : '') + '</div>';
  };
  Story.outcome = function () { return ''; };
  Story.hot = function () { return []; };

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
    var V = v(), out = '<div class="prep"><h2>' + esc(o.label) + '</h2><p class="choice-cost">Costs ' + (o.ap || 0) + ' action' + (o.ap === 1 ? '' : 's') + (o.cost ? ' · ' + esc(g.HollowCards.costWords(o.cost)) : '') + '</p>';
    if (o.kind === 'check') {
      var odds = o.chance >= 75 ? 'You are likely to manage this.' : o.chance >= 50 ? 'It could go either way.' : o.chance >= 30 ? 'The odds are against you.' : 'This is a long shot.';
      out += '<div class="pcheck"><span class="sk ' + o.stat + '">' + STAT[o.stat] + ' check</span> <b>Difficulty ' + o.dc + '</b> <span class="muted">(' + esc(o.dcName) + ')</span></div><p class="odds">' + o.chance + '% success · ' + odds + '</p>';
      if (o.stakes) out += '<p class="stakes">' + esc(o.stakes) + '</p>';
      out += '<details class="why"><summary>Why these odds?</summary><div class="mods">' + o.mods.map(function (mm) { return '<span class="dm ' + (mm.v < 0 ? 'neg' : 'pos') + '">' + esc(mm.l) + ' ' + (mm.v > 0 ? '+' : '−') + Math.abs(mm.v) + '</span>'; }).join('') + o.dcMods.map(function (mm) { return '<span class="dm ' + (mm.v > 0 ? 'neg' : 'pos') + '">' + esc(mm.l) + ' (difficulty ' + (mm.v > 0 ? '+' : '−') + Math.abs(mm.v) + ')</span>'; }).join('') + '</div></details>';
      // can a companion help?
      if (enc.allies && enc.allies.length && enc.canAsk) {
        var names = enc.allies.map(function (x) { return esc(x.name.replace(' (ghost)', '')) + ' (+' + (x.aidBonus || 2) + ')'; }).join(' and ');
        if (!enc.aid.asked) out += '<div class="aidask"><span>' + names + ' can help with this. Helping costs 1 Sanity, once per round. +2 to your next roll; a relevant specialist gives +3 (total help capped at +4). You can roll immediately without waiting.</span><button class="btn" data-act="askaid">Ask ' + names + ' for help</button></div>';
        else out += '<p class="muted">' + (enc.aid.bonus ? esc(enc.aid.helpers.join(', ')) + ' lend a hand: +' + enc.aid.bonus + ' to your roll.' : 'Help is optional. Roll whenever you are ready; no need to wait.') + '</p>';
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
    if (v().opening && !v().opening.complete) return '';
    if (S.ui.coach == null || S.ui.coach === 'done') return '';
    var V = v();
    if (S.ui.coach === 0) return '<div class="coachcard"><b>Thornwick is missing from every map.</b><p>Touch what glows in the square, or pick a card below. Risky things show their odds before you roll.</p><div class="prow"><button class="btn primary" data-act="coach" data-s="1">Begin</button><button class="btn ghost" data-act="coach" data-s="done">Skip</button></div></div>';
    if (S.ui.coach === 2) return '<div class="coachcard"><b>That is the whole loop.</b><p>Touch, roll when it matters, travel on. When your lanterns run out, end your turn.</p><div class="prow"><button class="btn primary" data-act="coach" data-s="done">Got it</button></div></div>';
    return '';
  };

  // ───────────── destination chooser ─────────────
  Story.travelPanel = function () {
    var V = v(), a = V.act, G = V.game, enemy = !!a.parting, mv = a.moves;
    var vis = function (id) { return V.map.locs[id] && V.map.locs[id].v; };
    var ok = mv.filter(function (r) { return r.ok; }).sort(function (x, y) { return (vis(x.to) ? 1 : 0) - (vis(y.to) ? 1 : 0) || (x.enemy ? 1 : 0) - (y.enemy ? 1 : 0); });
    // Every open road stays visible, including the fifth road to the Bell Tower.
    var destination = V.opening && (V.opening.nextTarget || V.opening.target);
    var top = ok.sort(function (x, y) { return (y.to === destination ? 1 : 0) - (x.to === destination ? 1 : 0); });
    var row = function (r) {
      var l = loc(r.to), reg = region(r.to), seen = vis(r.to), dis = G.ap < 1 ? ' disabled' : '';
      return '<div class="dest' + (seen ? ' seen' : ' unknown') + (r.enemy ? ' danger' : '') + (r.to === destination ? ' recommended-road' : '') + '"><button class="dart" data-act="move" data-mode="step" data-to="' + r.to + '"' + dis + ' aria-label="Go to ' + esc(l.name) + '">' + A.scene(l.scene, r.to, reg.color, l.region, l.glyph) + '<span class="dname"><small style="color:' + reg.color + '">' + esc(reg.name) + '</small><b>' + esc(l.name) + '</b></span>' + (r.enemy ? '<span class="dwarn">' + esc(S.cat.enemies[r.enemy].name) + '</span>' : '') + '</button>' +
        '<div class="dmeta">' + (r.to === destination ? '<b>Next objective</b> · ' : '') + (seen ? 'Visited' : 'Unexplored') + (r.oneway ? ' · one-way' : '') + (r.type === 'hidden' ? ' · hidden way' : '') + (r.enemy && r.sneak ? ' <button class="btn tiny" data-act="move" data-mode="sneak" data-to="' + r.to + '"' + dis + '>Sneak (' + (r.sneak.chance >= 60 ? 'likely' : r.sneak.chance >= 35 ? 'risky' : 'unlikely') + ')</button>' : '') + '</div></div>';
    };
    var out = '<div class="travelp"><div class="tph"><h2>' + (enemy ? 'Where do you flee?' : 'Where to?') + '</h2><span class="muted small">' + (G.ap < 1 ? 'No actions left this turn.' : '1 action' + (enemy ? ' · it strikes as you leave' : '')) + '</span><button class="btn ghost small" data-act="untravel">Stay</button></div><div class="dests">' + (top.length ? top.map(row).join('') : '<p class="note">No road is open from here. Search for hidden ways, or unlock a road below.</p>') + '</div>';
    var rest = [], locked = mv.filter(function (r) { return !r.ok; }), spr = a.sprint, fol = a.follow;
    if (rest.length || locked.length || spr.length || fol.length) out += '<details class="more"><summary>More ways to travel</summary>' + rest.map(row).join('') + (spr.length ? '<h3>Further afield (sprint: two roads for one action, noisy, hazards bite)</h3>' + spr.map(function (s) { return '<div class="dline"><div class="dg">' + A.glyph('bridge', 24) + '</div><div class="di"><b>' + esc(loc(s.to).name) + '</b><span>Past ' + esc(loc(s.via).name) + '.</span></div><div class="db"><button class="btn" data-act="move" data-mode="sprint" data-to="' + s.to + '"' + (G.ap < 1 ? ' disabled' : '') + '>Sprint</button></div></div>'; }).join('') : '') + (fol.length ? '<h3>Follow a companion</h3><div class="chips-row">' + fol.map(function (f) { return '<button class="btn small" data-act="follow" data-to="' + f.id + '"' + (G.ap < 1 ? ' disabled' : '') + '>Follow ' + esc(f.name) + '</button>'; }).join('') + '</div>' : '') + (locked.length ? '<h3>Blocked roads</h3>' + locked.map(function (r) { return '<div class="dline off"><div class="dg">' + A.glyph(r.state === 'locked' ? 'keyhole' : 'chain', 24) + '</div><div class="di"><b>' + esc(loc(r.to).name) + '</b><span>' + esc(r.label || '') + ' ' + esc(r.why) + '</span><div class="chips-row">' + (r.ways || []).map(function (w) { return w.flag ? '' : '<button class="btn small" data-act="unlock" data-edge="' + r.key + '" data-way="' + w.id + '"' + (w.ok && G.ap >= w.ap ? '' : ' disabled') + ' title="' + esc(w.why) + '">' + esc(w.label) + (w.stat ? ' (' + (w.chance >= 60 ? 'likely' : w.chance >= 35 ? 'risky' : 'unlikely') + ')' : '') + '</button>'; }).join('') + '</div></div></div>'; }).join('') : '') + '</details>';
    out += '<div class="prow"><button class="btn small" data-act="map">Open the full map</button></div></div>';
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
