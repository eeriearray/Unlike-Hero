/*! THE HOLLOW — views: the only way state leaves the engine. Each player is sent exactly what they are allowed to know. */
(function (g) {
  'use strict';
  var H = g.HollowEngine, D = g.HollowData, util = H.util, C = H.CFG;
  var M = {};

  // Static content for the client (no outcomes, no secrets, no hidden routes).
  H.catalog = function () {
    var cat = { chapter: D.chapter, regions: D.regions, regionLabels: D.regionLabels, pillars: D.pillars, statuses: D.statuses, levels: D.levels, upgrades: D.upgrades, phaseName: H.PHASE_NAME, phaseText: H.PHASE_TEXT,
      cfg: { clockMax: C.clockMax, phaseAt: C.phaseAt, noiseMax: C.noiseMax, packSize: C.packSize }, abilityUp: H.ABILITY_UP, boss: { name: D.boss.name, hp: D.boss.hp, chains: D.boss.chains, blurb: D.boss.blurb, phases: D.boss.phases } };
    cat.classes = {};
    Object.keys(D.classes).forEach(function (k) { var c = D.classes[k]; cat.classes[k] = { id: c.id, name: c.name, person: c.person, title: c.title, color: c.color, stats: c.stats, vit: c.vit, san: c.san, passive: c.passive, active: c.active, weakness: c.weakness, backstory: c.backstory, reason: c.reason, silver: c.silver, start: c.start }; });
    cat.items = D.items;
    cat.allies = {};
    Object.keys(D.allies).forEach(function (k) { cat.allies[k] = { id: k, name: D.allies[k].name, text: D.allies[k].text, boon: D.allies[k].boon }; });
    cat.curses = D.curses;
    cat.clues = {};
    Object.keys(D.clues).forEach(function (k) { cat.clues[k] = { pillar: D.clues[k].pillar, title: D.clues[k].title }; });
    cat.enemies = {};
    Object.keys(D.enemies).forEach(function (k) { var e = D.enemies[k]; cat.enemies[k] = { id: k, name: e.name, type: e.type, hp: e.hp, blurb: e.blurb, behavior: e.behavior }; });
    cat.locations = {};
    Object.keys(D.locations).forEach(function (k) {
      var l = D.locations[k];
      cat.locations[k] = { id: k, name: l.name, region: l.region, kind: l.kind, x: l.x, y: l.y, glyph: l.glyph, scene: l.scene, occult: !!l.occult, safe: !!l.safe, water: !!l.water, boss: !!l.boss, finale: !!l.finale, desc: l.desc };
    });
    cat.endings = {};
    Object.keys(D.endings).forEach(function (k) { var e = D.endings[k]; cat.endings[k] = { id: k, name: e.name, pitch: e.pitch, stat: e.stat, needsText: e.needsText || '' }; });
    cat.objectives = {};
    Object.keys(D.objectives).forEach(function (k) { cat.objectives[k] = { id: k, name: D.objectives[k].name }; });
    cat.counts = { locations: Object.keys(D.locations).length };
    return cat;
  };

  var HALLU = [
    'The room is warmer than it should be. Something here has your face.',
    'You are almost sure there were more of you when you came in.',
    'Every shadow has a small, patient hand.',
    'The walls are breathing. You count it: you are breathing with them.',
    'For a moment you cannot remember whose name you answer to.',
    'Someone has been standing behind you since the last room.',
    'The floor is a lid. The lid is thin.'
  ];

  var pubPlayer = function (self, p) {
    var o = { id: p.id, name: p.name, cls: p.cls, host: !!p.host, connected: p.connected, ready: p.ready };
    if (self.phase === 'lobby') return o;
    o.status = p.status; o.fate = p.fate || null;
    o.vit = p.vit; o.maxVit = p.maxVit; o.san = p.san; o.maxSan = p.maxSan; o.level = p.level; o.glory = p.glory; o.silver = p.silver; o.loc = p.loc;
    o.sts = Object.keys(p.sts); o.inv = p.inv.map(function (e) { return { id: e.id, n: e.n, eq: !!e.eq, uses: e.uses }; });
    o.revealed = p.objRevealed ? { id: p.objective, name: D.objectives[p.objective].name } : null;
    o.returns = p.returns; o.stats = { might: self.baseStat(p, 'might'), wit: self.baseStat(p, 'wit'), fate: self.baseStat(p, 'fate') };
    o.abilityLvl = p.abilityLvl; o.fellLoc = p.fellLoc || null;
    return o;
  };

  M.viewFor = function (pid) {
    var me = this.get(pid), w = this.w, self = this;
    var v = { v: this.ver, code: this.code, phase: this.phase, you: pid, hostId: (this.players.find(function (p) { return p.host; }) || {}).id, settings: this.settings, policy: this.policyText(), now: this.now() };
    v.players = this.players.map(function (p) { return pubPlayer(self, p); });
    v.log = this.logFor(pid);
    if (this.phase === 'lobby' || !w) return v;
    var D2 = D, t = this.turn;
    v.game = {
      round: w.round, clock: w.clock, clockMax: C.clockMax, haunt: w.haunt, noise: w.noise, noiseMax: C.noiseMax, revivals: w.revivals,
      active: t ? t.active : null, ap: t ? t.ap : 0, order: t ? t.order : [],
      secLeft: t ? Math.max(0, Math.round((t.deadline - this.now()) / 1000)) : 0
    };
    // the shared map
    var locs = {};
    Object.keys(w.locs).forEach(function (id) {
      var L = w.locs[id]; if (!L.seen) return;
      locs[id] = { v: L.visited, corrupt: !!L.corrupt, sealed: L.seal > w.round, chalk: L.chalk > w.round, inv: L.inv, ground: (L.ground || []).length, snare: L.snare === pid };
    });
    var edges = [];
    Object.keys(this.graph.edges).forEach(function (k) {
      var e = self.graph.edges[k];
      if (!self.edgeVisible(e)) return;
      if (!locs[e.a] || !locs[e.b]) return;
      var st = self.edgeState(e, e.a, false);
      if (st.state === 'oneway') st = self.edgeState(e, e.a, false);
      edges.push({ k: k, a: e.a, b: e.b, type: e.type, state: st.state === 'oneway' ? 'open' : st.state, why: st.why || '', oneway: e.oneway, label: e.label });
    });
    var ct = w.corridor;
    if (locs.corridor && locs[ct]) edges.push({ k: 'corridor~' + ct, a: 'corridor', b: ct, type: 'path', state: 'open', why: '', oneway: false, label: 'The corridor opens here', shifting: true });
    var enemies = w.enemies.filter(function (e) { return locs[e.loc] && !e.dead; }).map(function (e) { return { uid: e.uid, id: e.id, loc: e.loc, hp: e.hp, max: e.max, known: e.known, weak: e.known ? e.weak : null }; });
    v.map = { locs: locs, edges: edges, enemies: enemies, rumors: w.rumors.filter(function (r) { return locs[r.loc]; }).map(function (r) { return { loc: r.loc, confirmed: r.confirmed }; }) };
    if (locs.warden && !w.boss.dead) { var ph = this.bossPhase(); v.map.boss = { loc: 'warden', hp: w.boss.hp, max: D.boss.hp, chains: w.boss.chains, phase: ph.name, text: ph.text, attack: ph.attack, bypassed: !!w.flags.warden_bypassed }; }
    if (me && w.locs[me.loc].ground && w.locs[me.loc].ground.length) v.map.ground = w.locs[me.loc].ground;
    // shared mystery state
    var pillars = Object.keys(D.pillars).map(function (k) { return { id: k, name: D.pillars[k].name, need: D.pillars[k].need, have: self.pillarProgress(k), done: self.pillarDone(k) }; });
    var clues = this.sharedClues().map(function (id) { var c = w.clues[id]; return { id: id, title: D.clues[id].title, text: D.clues[id].text, pillar: D.clues[id].pillar, by: (self.get(c.by) || {}).name, round: c.round }; });
    var hints = Object.keys(w.elim).filter(function (k) { return w.elim[k].length; }).map(function (k) {
      var sec = D.secrets[k];
      return { key: k, label: sec.label, out: w.elim[k].map(function (x) { return (sec.names && sec.names[x]) || x; }), solved: !!w.solved[k], left: sec.vals.length - w.elim[k].length };
    });
    v.world = {
      pillars: pillars, clues: clues, hints: hints, flags: w.flags, revivals: w.revivals,
      allies: Object.keys(w.allies).filter(function (k) { return w.allies[k]; }).map(function (k) { return { id: k, name: D.allies[k].name, boon: D.allies[k].boon, by: (self.get(w.allyBy[k]) || {}).name }; }),
      curses: Object.keys(D.curses).map(function (k) { return { id: k, name: D.curses[k].name, text: D.curses[k].text, active: !!w.curses[k] }; }),
      corridor: locs.corridor ? w.corridor : null, solved: w.solved
    };
    if (this.finaleCrew().length || w.vote || (me && me.loc === 'heart_chamber')) {
      v.finale = { crew: this.finaleCrew().map(function (p) { return p.id; }), endings: ['silence', 'reverse', 'bargain', 'destroy'].map(function (e) { return self.finaleInfo(e); }) };
    }
    if (w.vote) {
      var el = this.voters();
      v.vote = { ending: w.vote.ending, name: D.endings[w.vote.ending].name, by: w.vote.by, yes: w.vote.yes, no: w.vote.no, eligible: el.map(function (x) { return x.id; }), secLeft: Math.max(0, Math.round((w.vote.deadline - this.now()) / 1000)) };
    }
    if (this.phase === 'ended') { v.ended = this.ended; }
    // you
    if (me) v.me = this.meView(me);
    // the encounter and the turn
    if (t && t.enc) v.enc = this.encView(t.enc, me);
    if (t && me && t.active === me.id && me.status === 'alive') v.act = this.actionsView(me);
    if (t && t.active) { var a = this.get(t.active); if (a && !a.connected) v.game.awayLeft = Math.max(0, Math.round((a.disconnectedAt + C.graceSec * 1000 - this.now()) / 1000)); }
    return v;
  };

  M.logFor = function (pid) {
    var out = [];
    for (var i = this.log.length - 1; i >= 0 && out.length < C.logKeep; i--) {
      var e = this.log[i];
      if (e.to && e.to.indexOf(pid) < 0) continue;
      out.unshift(e);
    }
    return out;
  };

  M.meView = function (p) {
    var self = this, w = this.w, cls = D.classes[p.cls];
    var effStat = {}; ['might', 'wit', 'fate'].forEach(function (s) { effStat[s] = self.baseStat(p, s); });
    var hallu = p.status === 'alive' ? (p.san <= p.maxSan * 0.25 ? 2 : (p.san <= p.maxSan * 0.5 ? 1 : 0)) : 0;
    var o = {
      cls: p.cls, status: p.status, stats: p.stats, eff: effStat, vit: p.vit, maxVit: p.maxVit, san: p.san, maxSan: p.maxSan, silver: p.silver, xp: p.xp, level: p.level,
      xpNext: D.levels[p.level] != null ? D.levels[p.level] : null, xpPrev: D.levels[p.level - 1] || 0, glory: p.glory,
      inv: p.inv.map(function (e) { return { id: e.id, n: e.n, eq: !!e.eq, uses: e.uses }; }), pack: this.packUsed(p), packMax: C.packSize,
      sts: Object.keys(p.sts), ward: p.ward, thread: p.thread, skills: p.skills, abilityLvl: p.abilityLvl, hallu: hallu, loc: p.loc, unnoticed: p.unnoticed === p.loc,
      rests: Math.max(0, C.restsPerPhase - (p.rests[w.haunt] || 0)), pact: !!p.flags.pact, pendingLevels: p.pendingLevels, returns: p.returns,
      objective: { id: p.objective, name: D.objectives[p.objective].name, text: this.objectiveText(p), progress: D.objectives[p.objective].progress(this.objectiveCtx(p)), revealed: p.objRevealed, done: this.objectiveDone(p) },
      cluesPrivate: Object.keys(w.clues).filter(function (k) { return !w.clues[k].shared && w.clues[k].by === p.id; }).map(function (k) { return { id: k, title: D.clues[k].title, text: D.clues[k].text, pillar: D.clues[k].pillar }; }),
      found: p.found.length, visitedCount: Object.keys(p.visited).length, aided: p.aidedRound === w.round
    };
    if (p.pendingLevels && p.offer) o.offer = p.offer.map(function (id) { var u = D.upgrades.find(function (x) { return x.id === id; }); return { id: id, name: u.name, text: id === 'ability' ? H.ABILITY_UP[p.cls] : u.text }; });
    if (hallu) o.ghost = HALLU[(w.round * 7 + p.san * 3 + p.loc.length) % HALLU.length];
    if (p.status === 'alive') o.ability = this.abilityView(p);
    if (p.status === 'fallen') {
      var enemies = w.enemies.filter(function (e) { return !e.dead && e.hp > 1; }).map(function (e) { return { uid: e.uid, name: D.enemies[e.id].name, loc: D.locations[e.loc].name }; });
      o.spirit = { used: p.spiritRound === w.round, returns: p.returns, whispers: Math.max(0, 6 - w.whispers), lending: !!w.spiritAid, enemies: enemies, fellLoc: p.fellLoc };
    }
    return o;
  };

  M.abilityView = function (p) {
    var cls = D.classes[p.cls], w = this.w, lvl = p.abilityLvl, active = this.turn && this.turn.active === p.id;
    var a = { name: cls.active.name, text: cls.active.text, ok: true, why: '', kind: p.cls, cd: p.cd.ability || 0 };
    if (p.cls === 'occultist') {
      var lim = lvl >= 1 ? 2 : 1, used = p.uses['twist' + w.haunt] || 0;
      a.left = lim - used; a.passiveOnly = true; a.ok = false; a.why = 'Triggers after a failed check (' + a.left + ' left this phase).';
    } else if (p.cls === 'vagabond') {
      var lim2 = lvl >= 1 ? 2 : 1, used2 = p.uses['slip' + w.haunt] || 0;
      a.left = lim2 - used2;
      var enc = this.turn && this.turn.enc;
      if (a.left <= 0) { a.ok = false; a.why = 'Used this phase.'; } else if (!active || !enc || (enc.kind !== 'enemy' && enc.kind !== 'boss')) { a.ok = false; a.why = 'Escapes a confrontation.'; }
    } else if (!active) { a.ok = false; a.why = 'Use it on your turn.'; }
    else if (this.turn.ap < 1 && p.cls !== 'apothecary') { a.ok = false; a.why = 'No actions left.'; }
    else if (p.cls === 'hunter') { if (a.cd > 0) { a.ok = false; a.why = 'Ready in ' + a.cd + ' round' + (a.cd > 1 ? 's' : '') + '.'; } }
    else if (p.cls === 'apothecary') {
      var need = lvl >= 1 ? 1 : 2;
      a.need = need;
      if (a.cd > 0) { a.ok = false; a.why = 'Ready in ' + a.cd + ' round.'; } else if (this.itemCount(p, 'herb') < need) { a.ok = false; a.why = 'Needs ' + need + ' Gravemoss.'; }
    } else if (p.cls === 'medium') { if (a.cd > 0) { a.ok = false; a.why = 'Ready in ' + a.cd + ' rounds.'; } }
    else if (p.cls === 'exorcist') {
      a.left = p.uses.ritesLeft == null ? 3 : p.uses.ritesLeft;
      if (a.left <= 0) { a.ok = false; a.why = 'No rites left.'; }
      a.curses = Object.keys(w.curses).filter(function (k) { return w.curses[k]; }).map(function (k) { return { id: k, name: D.curses[k].name }; });
      a.corrupt = !!w.locs[p.loc].corrupt;
      a.spirits = w.enemies.filter(function (e) { return e.loc === p.loc && !e.dead && D.enemies[e.id].type === 'spirit' && e.hp <= 2; }).length;
    }
    return a;
  };

  M.actionsView = function (p) {
    var t = this.turn, w = this.w, loc = D.locations[p.loc], ap = t.ap, self = this;
    var enc = !!t.enc, eng = this.engagedEnemy(p);
    var a = {};
    var gate = function (cost, extra) {
      if (enc) return { ok: false, why: 'Finish or leave the encounter first.' };
      if (ap < cost) return { ok: false, why: 'No actions left this turn.' };
      return extra || { ok: true };
    };
    a.interact = { ok: !enc, why: enc ? 'Already open.' : '', label: eng ? (eng.kind === 'boss' ? 'Face the Warden' : 'Face the ' + D.enemies[eng.obj.id].name) : 'Look for something to do here' };
    if (!loc.options.length && !loc.boss && !loc.finale) a.interact = { ok: false, why: 'Nothing here calls to you.', label: 'Nothing to do here' };
    a.investigate = gate(1, eng ? { ok: false, why: 'Something is hunting you here.' } : { ok: true });
    var pool = D.regionEvents.filter(function (ev) { return ev.region === loc.region && w.usedEvents.indexOf(ev.id) < 0; });
    a.explore = gate(1, eng ? { ok: false, why: 'Something is hunting you here.' } : (pool.length ? { ok: true, left: pool.length } : { ok: false, why: 'Nothing new to find on foot in this region.' }));
    var rb = this.restBlock(p);
    a.rest = gate(1, rb ? { ok: false, why: rb } : { ok: true });
    var cost = p.cls === 'medium' ? 0 : 1;
    a.echo = gate(1, eng ? { ok: false, why: 'Something is hunting you here.' } : (cost && p.san <= cost ? { ok: false, why: 'You cannot spare the Sanity.' } : { ok: true, cost: cost }));
    a.endturn = { ok: !(t.enc && t.enc.hold) };
    // roads
    var moves = this.moveOptions(p);
    a.moves = moves.map(function (m) {
      var o = { to: m.to, key: m.key, label: m.label, ok: m.ok, why: m.why, state: m.state, type: m.type, enemy: m.enemy, ways: m.ways || null };
      if (m.ok && m.enemy && D.enemies[m.enemy].alert < 50) {
        var def = D.enemies[m.enemy], en = w.enemies.find(function (e) { return e.loc === m.to && !e.dead; });
        var ri = self.rollInfo(p, { id: 'sneak', stat: 'wit', dc: def.alert, noScale: true, bonus: p.cls === 'vagabond' ? [{ if: {}, b: 1, why: 'Light Step' }] : [] }, { enemy: en });
        o.sneak = { dc: ri.dc, chance: ri.chance, mods: ri.mods };
      }
      return o;
    });
    // sprint targets: two roads away
    var sprint = [];
    moves.forEach(function (m) {
      if (!m.ok) return;
      self.neighbors(m.to).forEach(function (nb) {
        if (nb.to === p.loc || !self.edgeVisible(nb.e)) return;
        if (!self.edgeState(nb.e, m.to, false).ok) return;
        if (moves.some(function (x) { return x.to === nb.to; }) || sprint.some(function (x) { return x.to === nb.to; })) return;
        if (w.enemies.some(function (e) { return e.loc === m.to && !e.dead; })) return;
        sprint.push({ to: nb.to, via: m.to });
      });
    });
    a.sprint = sprint;
    a.follow = this.living().filter(function (x) { return x.id !== p.id && x.loc !== p.loc; }).map(function (x) { var pth = self.path(p.loc, x.loc, false); return pth ? { id: x.id, name: x.name, dist: pth.length } : null; }).filter(Boolean);
    a.parting = !!eng;
    a.ap = ap;
    return a;
  };

  M.encView = function (enc, me) {
    var self = this, w = this.w, active = this.get(enc.pid);
    var o = { id: enc.id, kind: enc.kind, pid: enc.pid, title: enc.title, text: enc.text, loc: enc.loc, guard: !!enc.guard, guardText: enc.guardText || '', over: !!enc.over, closeAfter: !!enc.closeAfter, result: enc.result || null };
    if (enc.aid) o.aid = { asked: enc.aid.asked, bonus: enc.aid.bonus, helpers: enc.aid.helpers.map(function (id) { return (self.get(id) || {}).name; }) };
    if (active) {
      var allies = this.here(enc.loc).filter(function (x) { return x.id !== active.id; });
      o.allies = allies.map(function (x) { return { id: x.id, name: x.name, canAid: x.connected && x.san >= 2 && x.aidedRound !== w.round && enc.aid && enc.aid.asked }; });
      o.canAsk = allies.some(function (x) { return x.connected && x.san >= 2 && x.aidedRound !== w.round; });
      o.options = this.encOptions(active, enc).map(function (x) { return x.ev; });
    }
    if (enc.hold && active) o.hold = { roll: enc.hold.roll, sources: enc.hold.sources, optId: enc.hold.optId, secLeft: Math.max(0, Math.round((enc.hold.deadline - this.now()) / 1000)) };
    if (enc.kind === 'enemy') {
      var en = this.enemyByUid(enc.enemy);
      if (en) { var def = D.enemies[en.id]; o.enemy = { id: en.id, name: def.name, type: def.type, hp: en.hp, max: en.max, known: en.known, weak: en.known ? en.weak : null, blurb: def.blurb }; }
    }
    if (enc.kind === 'boss') { var ph = this.bossPhase(); o.boss = { hp: w.boss.hp, max: D.boss.hp, chains: w.boss.chains, phase: ph.name, text: ph.text, attack: ph.attack }; }
    if (enc.kind === 'loc') { o.ground = (w.locs[enc.loc].ground || []); }
    if (me && me.status === 'alive' && me.san <= me.maxSan * 0.5) { o.ghost = HALLU[(w.round * 5 + me.san + enc.loc.length) % HALLU.length]; }
    return o;
  };

  H.mixin(M);
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
