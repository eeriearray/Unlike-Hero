/*! THE HOLLOW — world: setup, turns and rounds, the map and movement, enemies, clues and puzzles, omens, the Haunting Clock. */
(function (g) {
  'use strict';
  var H = g.HollowEngine, D = g.HollowData, util = H.util, C = H.CFG;
  var M = {};
  var PHASE_NAME = ['Something Is Wrong', 'It Knows Your Name', 'The Hollow Awakens'];
  H.PHASE_NAME = PHASE_NAME;
  var PHASE_TEXT = [
    'Strange sounds, small omens. There is time to gather supplies and look around.',
    'The Hollow has learned your names. Enemies grow bolder, safe places sour, roads shift.',
    'The Hollow is awake. Greater threats walk. The Escape Gate stands open. There is not much time.'
  ];
  H.PHASE_TEXT = PHASE_TEXT;

  // ───────────────────────────── setup ─────────────────────────────
  M.initPlayer = function (p) {
    var cls = D.classes[p.cls];
    Object.assign(p, {
      stats: Object.assign({}, cls.stats), vit: cls.vit, maxVit: cls.vit, san: cls.san, maxSan: cls.san, xp: 0, level: 1, glory: 0, silver: cls.silver,
      loc: D.start, prevLoc: null, inv: [], sts: {}, flags: {}, cd: { ability: 0 }, uses: {}, skills: [], abilityLvl: 0, pendingLevels: 0, offer: null, picks: [],
      visited: {}, found: [], ward: false, thread: false, unnoticed: null, sprinted: 0, silentRound: 0, fallenCount: 0, returns: 0, rests: {}, aidedRound: 0, steelRound: 0,
      forageDone: {}, objective: null, objParam: null, objRevealed: false, spiritRound: 0, status: 'alive',
      tally: { glory: 0, xp: 0, vitLost: 0, sanLost: 0, aids: 0, kills: 0, clues: 0, steps: 0 }
    });
    cls.start.forEach(function (id) { this.addItem(p, id, 1); }, this);
    p.visited[D.start] = 0;
  };

  M.begin = function () {
    var w = this.w = {
      round: 0, clock: 0, frac: 0, noise: 0, haunt: 1, flags: {}, claims: {}, allies: {}, allyBy: {}, curses: { rot: true, cradle: true, shrine: true }, cleansed: {},
      revivals: 0, clues: {}, elim: {}, solved: {}, secrets: {}, locs: {}, edges: {}, enemies: [], rumors: [], usedOmens: [], usedEvents: [],
      boss: { hp: D.boss.hp, chains: D.boss.chains, dead: false }, corridor: 'observatory', vote: null, spiritAid: null, whispers: 0, uid: 0,
      allFallen: 0, jam: 0, bossLog: []
    };
    if (this.settings.opening) { w.opening = { version: 2, board: false, record: false, route: false, entered: false, complete: false }; w.flags.opening_active = true; }
    var self = this;
    Object.keys(D.secrets).forEach(function (k) { w.secrets[k] = self.pick(D.secrets[k].vals); });
    Object.keys(D.locations).forEach(function (id) { w.locs[id] = { seen: false, visited: false, inv: false, corrupt: 0, seal: 0, chalk: 0, ground: [], snare: null }; });
    Object.keys(this.graph.edges).forEach(function (k) { w.edges[k] = { rev: self.graph.edges[k].type !== 'hidden', open: false, closedUntil: 0 }; });
    Object.keys(D.locations).forEach(function (id) { var l = D.locations[id]; if (l.enemy && !(w.opening && ['belltower', 'graveyard'].indexOf(id) >= 0)) self.spawnEnemy(l.enemy, id, null, false); });
    w.corridor = this.pick(D.corridorTargets);
    this.phase = 'playing';
    // characters, objectives
    var objs = this.shuffle(Object.keys(D.objectives));
    this.players.forEach(function (p, i) {
      self.initPlayer(p);
      p.inv.forEach(function (e) { if (D.items[e.id].equip) self.autoEquip(p, e); });
      p.objective = objs[i % objs.length];
      if (p.objective === 'unmaker') p.objParam = w.secrets.curse;
      if (p.objective === 'opportunist') p.objParam = w.secrets.relic;
    });
    w.locs[D.start].visited = true; w.locs[D.start].seen = true;
    this.markSeen(D.start);
    this.turn = { order: [], idx: -1, active: null, ap: 0, enc: null, deadline: 0 };
    this.addLog('story', D.chapter.title + '. ' + D.chapter.premise, { d: { k: 'prologue' } });
    this.startRound();
  };

  M.openingPlace = function (id) { return ['square', 'chapel', 'graveyard', 'belltower'].indexOf(id) >= 0; };
  // The same expertise definition supplies observations, optional approaches and aid.
  M.openingExpertise = function (p) {
    return {
      occultist: { loc: 'chapel', opt: 'vestry', label: 'Isolde: read the erased maintenance entry', observation: 'The erased lines use the same cipher as your forbidden footnotes. You can recover the record without disturbing the shelves.', outcome: { t: 'Margin Notes: you read the erased instructions without touching the unstable shelves. You leave the supplies undisturbed.' } },
      hunter: { loc: 'graveyard', opt: 'headstones', label: 'Corvin: follow the keeper’s bootprints', observation: 'Bootprints stop at the bell-marked stone, not at a burial. Tracking them avoids losing time among the names.', outcome: { t: 'Tracker: a keeper walked this path carrying tools. You follow the dry prints straight to the passage.' } },
      apothecary: { loc: 'chapel', opt: 'vestry', label: 'Maelis: lift the ink with a herbal wash', observation: 'The vestry ink is stained with burial salts. One herb will lift it without bringing the shelf down.', cost: { item: 'herb' }, outcome: { t: 'Forager: your herbal wash lifts the maintenance entry intact. The shelves and their supplies stay untouched.' } },
      medium: { loc: 'belltower', opt: 'frame', label: 'Wren: hear the last keeper’s echo', observation: 'The frame carries a human echo beneath its note. Listening costs 1 Sanity, but avoids a dangerous check and Clock loss.', cost: { san: 1 }, outcome: { t: 'Veil-sighted: you hear the keeper say, “We lowered it. We did not silence it.” The echo guides your hand to the inscription.' } },
      vagabond: { loc: 'belltower', opt: 'force_entry', label: 'Jory: slip through the drainage gap', observation: 'A dry gap beneath the swollen door is wide enough. Your Light Step can open it from within without forcing the hinges.', outcome: { t: 'Light Step: you slip under the door and lift its latch. No injury, no broken hinge; the entrance is open for everyone.' } },
      exorcist: { loc: 'belltower', opt: 'frame', label: 'Anselm: trace a protective ward on the frame', observation: 'Your order’s ward fits the empty yoke. One Ward Chalk lets you read it safely without spending a limited Rite of Sealing.', cost: { item: 'chalk' }, outcome: { t: 'Sanctified: the chalk catches the frame’s note. You read the inscription safely; none of your three rites is spent.' } }
    }[p.cls];
  };
  M.openingOptions = function (p, enc, raws) {
    var o = this.w.opening; if (!o || o.complete || enc.kind !== 'loc') return raws;
    var x = this.openingExpertise(p), extra = [];
    if (x && x.loc === enc.loc) extra.push({ id: 'expertise', openingAs: x.opt, attach: x.opt, label: x.label, once: 'party', onceKey: x.opt,
      cost: x.cost, summary: 'No roll · avoids check consequences', stakes: '1 action. No roll. ' + x.observation, auto: x.outcome });
    if (enc.loc === 'belltower' && o.revealed) {
      extra.push({ id: 'muffle', summary: 'Clock −1 · no extra name', attach: 'frame', label: 'Bind the rope: buy time for the expedition', once: 'party', onceKey: 'opening_response', stakes: '1 action. No roll. Clock −1; no extra name recovered.', auto: { t: 'You bind the rope to the yoke. The next pull comes slowly. One toll bought back, not a cure.', clock: -1 } });
      extra.push({ id: 'answer_echo', summary: 'Clock +1 · bell-name hint', attach: 'frame', label: 'Answer the echo: recover a name', once: 'party', onceKey: 'opening_response', stakes: '1 action. No roll. Gain a bell-name hint; Clock +1. The sound carries below.', auto: { t: 'You answer with the names on the marker. The echo returns a fragment of the bell’s true name. Below, something hears you.', hint: 'bellName', clock: 1 } });
    }
    return raws.concat(extra);
  };
  M.openingObjective = function (p) {
    var o = this.w.opening; if (!o) return null;
    var goal;
    if (o.complete && p && p.loc === 'heart_chamber') goal = { id: 'decision', title: 'Decide the bell’s fate', context: 'You reached the Heart. Your discoveries will shape the final decision.', hint: 'Open the Heart encounter and propose an ending. Your party votes together.', target: 'heart_chamber', complete: true };
    else if (o.complete) goal = { id: 'complete', title: 'Find the magistrate’s account in the Black Estate', context: 'The bell was lowered beneath the Abbey, not destroyed. The tower inscription says the magistrate kept the transfer agreement. It may explain how to stop the taking of names.', hint: 'Return through the graveyard to the Black Estate foyer, then seek its library. The agreement is your lead toward the Abbey.', target: p && p.loc === 'foyer' ? 'library' : 'foyer', complete: true };
    else if (o.revealed) goal = { id: 'response', title: 'Choose how to leave the ringing frame', context: 'The rope pulls downward as a toll rises through the floor. The bell is below the Abbey; this tower is only its echo. Your name begins forming in the iron.', hint: 'Touch the frame: bind the rope to delay a toll, or answer the echo for a name at the cost of time.', target: 'belltower' };
    else if (o.entered) goal = { id: 'frame', title: 'Find what is ringing in an empty tower', context: 'The rope vanishes into the floor. The empty yoke bears the same missing names as the grave marker.', hint: 'Study the empty bell-frame for the destination of the missing bell.', target: 'belltower' };
    else if (o.route) goal = { id: 'enter', title: 'Trace the bell’s removal into the tower', context: 'The graves hold no bodies. Their iron nameplates were taken for the bell. A keeper’s diagram marks a dry entrance.', hint: 'Use the maintenance entrance at the tower to find where the bell went.', target: 'belltower' };
    else if (o.record) goal = { id: 'route', title: 'Find the keeper’s bell-marked grave', context: 'The record says the main entrance flooded when the bell was lowered. The keeper left a dry passage diagram on the bell-marked stone.', hint: 'Read the graveyard headstones to find the keeper’s diagram. Forcing the tower remains possible.', target: 'graveyard' };
    else if (o.board) goal = { id: 'record', title: 'Find who removed the bell', context: 'The notice certifies the bell was removed forty years ago, yet you heard it on arrival. The chapel kept the removal and maintenance records.', hint: 'Search the chapel vestry for the record of the bell’s removal.', target: 'chapel' };
    else goal = { id: 'arrival', title: 'Test the warning in your summons', context: 'A letter in your own handwriting warned: “Come to Thornwick before the bell learns your name.” You came to stop it. A toll just sounded from a tower with no bell.', hint: 'Read the square’s notice board: its tower notice may explain who still rings it.', target: 'square' };
    if (p) { var x = this.openingExpertise(p); if (x && p.loc === x.loc && !o.complete && !(x.opt === 'vestry' && o.record) && !(x.opt === 'headstones' && o.route) && !(x.opt === 'force_entry' && o.entered) && !(x.opt === 'frame' && o.revealed)) goal.observation = x.observation; }
    if (p && p.loc !== goal.target) {
      var route = this.path(p.loc, goal.target, false);
      if (route && route.length) { goal.nextTarget = route[0]; if (route.length > 1) goal.hint = 'Travel via ' + D.locations[route[0]].name + ' toward ' + D.locations[goal.target].name + '. ' + goal.hint; }
    }
    goal.complete = !!o.complete;
    goal.evidence = { board: !!o.board, record: !!o.record, route: !!o.route, entered: !!o.entered, revealed: !!o.revealed, response: o.response || null };
    return goal;
  };
  // Shared evidence survives failure, falling, snapshots and reconnects.
  M.recordOpening = function (p, enc, opt, ctx) {
    var o = this.w.opening; if (!o || o.complete || enc.kind !== 'loc') return;
    var before = this.openingObjective().id, key = enc.loc + ':' + (opt.openingAs || opt.id), text = '';
    if (key === 'square:board' && !o.board) { o.board = true; text = 'REMOVAL CERTIFICATE — forty years ago. The chapel vestry holds the keeper’s account. As you read, fresh ink writes your name beneath the date. Your summons was a warning, not an invitation.'; }
    if (key === 'chapel:vestry' && !o.record) { o.record = true; text = 'The keeper’s entry survives: “Bell lowered; front entrance flooded. Dry service passage marked on my bell-stone in the graveyard.” Someone meant a later keeper to get back inside. A single wooden knock comes from the direction of the graves.'; }
    if (key === 'graveyard:headstones' && !o.route) { o.route = true; this.w.flags.opening_route = true; text = 'Behind the bell-marked stone is the dry passage diagram. Its iron nameplate has been cut away, as on every other grave. No bodies were buried here: the bell was made from their names. Wet prints now lead toward the tower.'; }
    if ((key === 'belltower:maintenance' || key === 'belltower:force_entry') && !o.entered) { o.entered = true; this.w.flags.opening_entered = true; text = 'Inside, the rope pulls down into a shaft beneath an empty iron yoke. The floor trembles before you hear the toll. Look at the founder’s inscription on the frame.'; }
    if (key === 'belltower:frame' && o.entered && !o.revealed) {
      o.revealed = true; this.w.flags.opening_revealed = true;
      if (!this.w.clues.bell_cast) this.addClue('bell_cast', p, false, ctx);
      if (this.w.clues.bell_cast) this.w.clues.bell_cast.shared = true;
      text = 'The empty yoke shudders. Dust lifts from the floor in a perfect ring; the toll rises from BELOW. Beneath the grave-marks you read: “Lowered to the Abbey foundations. Transfer agreement: magistrate’s library.” There is no hidden bell here. The missing bell is still ringing underground. In the iron, the first letter of your name begins to glow. Bind the rope to buy time, or answer its echo to recover a name.';
    }
    if (o.revealed && (opt.id === 'muffle' || opt.id === 'answer_echo')) {
      o.response = opt.id; o.complete = true; this.w.flags.opening_active = false;
      this.w.flags.opening_muffled = opt.id === 'muffle';
      ['foyer', 'library', 'bridge', 'wagon', 'nursery'].forEach(function (id) { this.w.locs[id].seen = true; }, this);
      text = 'Opening complete: the wider roads are open. The magistrate’s library in the Black Estate holds the transfer agreement. Find who ordered the bell lowered before it finishes learning your name; then follow its trail beneath the Abbey.';
    }
    if (text) { this.say(ctx, text, 'story'); this.addLog('story', text, { p: p.id, loc: enc.loc }); }
    var next = this.openingObjective();
    if (before !== next.id) { this.say(ctx, 'New objective: ' + next.title, 'info'); this.addLog('story', 'New objective: ' + next.title, { loc: enc.loc }); }
  };

  M.autoEquip = function (p, e) {
    var d = D.items[e.id];
    if (!d.equip) return;
    if (!p.inv.some(function (x) { return x !== e && x.eq && D.items[x.id].kind === d.kind; })) e.eq = true;
  };

  // ───────────────────────────── rounds and turns ─────────────────────────────
  M.startRound = function () {
    var w = this.w;
    w.round++;
    this.players.forEach(function (p) { if (p.cd.ability > 0) p.cd.ability--; });
    this.addLog('round', 'Round ' + w.round + ' begins.', { d: { k: 'round', round: w.round } });
    this.players.forEach(function (b) { if (b.bot && b.status === 'fallen') { var r = this.cmd_spirit(b, { kind: b.returns > 0 ? 'return' : 'whisper' }); } }, this);
    if (w.round > 1 && !(w.opening && !w.opening.complete)) this.drawOmen();
    this.checkEnd();
    if (this.phase !== 'playing') return;
    this.turn.order = this.players.filter(function (p) { return p.status === 'alive'; }).map(function (p) { return p.id; });
    this.turn.idx = -1;
    this.advanceTurn();
  };

  M.advanceTurn = function () {
    var t = this.turn, w = this.w;
    if (this.phase !== 'playing') return;
    for (;;) {
      t.idx++;
      if (t.idx >= t.order.length) { this.endRound(); return; }
      var p = this.get(t.order[t.idx]);
      if (p && p.status === 'alive') { this.beginTurn(p); return; }
    }
  };

  M.beginTurn = function (p) {
    var t = this.turn, n = this.living().length;
    t.active = p.id; t.ap = C.apFor(n); t.enc = null; t.deadline = this.now() + this.settings.turnSec * 1000; t.botAt = this.now() + (p.bot ? 1800 : 0);
    this.addLog('turn', p.name + '\'s turn.', { p: p.id, d: { k: 'turn' } });
    // something that followed you here
    var en = this.engagedEnemy(p);
    if (en) { if (en.kind === 'boss') this.openBossEnc(p); else this.openEnemyEnc(p, en.obj, true); }
  };

  // If the active player fell or left during an action, the turn passes on at once.
  M.settleTurn = function () {
    var guard = 0;
    while (this.phase === 'playing' && this.turn && guard++ < 8) {
      var a = this.get(this.turn.active);
      if (a && a.status === 'alive') return;
      this.advanceTurn();
    }
  };
  M.endTurnFor = function (p) {
    if (this.turn && this.turn.active === p.id) this.closeEnc(p, true);
    this.advanceTurn();
  };
  M.cmd_endturn = function (p, c) {
    var e = this.requireTurn(p); if (e) return { error: e };
    if (this.turn.enc && this.turn.enc.hold) return { error: 'Decide about your roll first.' };
    if (c && c.auto && (!this.settings.solo || this.turn.ap > 0 || p.pendingLevels || this.w.vote || (this.turn.enc && !(this.turn.enc.kind === 'loc' && this.turn.enc.result)))) return { error: 'Finish the pending decision before advancing.' };
    if (c && c.auto) this.addLog('system', 'Your actions are spent. The next turn begins; the Haunting Clock advances between rounds.');
    this.endTurnFor(p);
    return { ok: true };
  };

  M.afterAction = function (p) {
    if (this.phase !== 'playing') return;
    this.checkEnd();
  };

  M.endRound = function () {
    var w = this.w, self = this;
    this.addLog('round', 'The round closes. The Hollow stirs.', { d: { k: 'haunt' } });
    this.players.forEach(function (p) {
      if (p.status === 'alive' && p.sts.bleeding) self.hurt(p, 'vit', 1, { raw: true, src: 'bleeding' });
    });
    if (this.phase !== 'playing') return;
    this.enemiesAct();
    if (this.phase !== 'playing') return;
    var n = Math.max(1, this.living().length);
    var step = C.clockStep[Math.min(6, Math.max(1, this.players.length)) - 1] * C.phaseMult[w.haunt - 1];
    w.frac += step;
    var whole = Math.floor(w.frac); w.frac -= whole;
    if (whole) this.advanceClock(whole, 'The Haunting Clock advances.', null, true);
    if (w.enemies.some(function (e) { return e.id === 'whisperling' && !e.dead; }) && this.rint(2) === 0) this.addRumor(null);
    if (!this.living().length) { w.allFallen++; } else w.allFallen = 0;
    this.checkEnd();
    if (this.phase === 'playing') this.startRound();
  };

  // ───────────────────────────── the Haunting Clock ─────────────────────────────
  M.advanceClock = function (n, msg, ctx, quiet) {
    var w = this.w;
    if (!n) return;
    var before = w.clock;
    w.clock = util.clamp(w.clock + n, 0, C.clockMax);
    if (n > 0 && msg) {
      this.addLog('clock', msg + ' (' + w.clock + '/' + C.clockMax + ')', { d: { k: 'clock', n: n } });
    } else if (n < 0 && msg) this.addLog('clock', msg + ' (' + w.clock + '/' + C.clockMax + ')', { d: { k: 'clock', n: n } });
    if (ctx) this.chip(ctx, 'clock', n, 'Haunting ' + (n > 0 ? '+' : '') + n, n > 0 ? 'bad' : 'good');
    var target = w.clock >= C.phaseAt[1] ? 3 : w.clock >= C.phaseAt[0] ? 2 : 1;
    while (w.haunt < target) this.phaseChange(w.haunt + 1);
    if (w.clock >= C.clockMax) this.checkEnd();
  };

  M.addNoise = function (n, p) {
    var w = this.w;
    w.noise += n;
    while (w.noise >= C.noiseMax) { w.noise -= C.noiseMax; this.advanceClock(1, 'The noise carries. The Hollow stirs.'); }
  };

  M.phaseChange = function (to) {
    var w = this.w, self = this;
    w.haunt = to;
    this.addLog('phase', 'PHASE ' + ['I', 'II', 'III'][to - 1] + ': ' + PHASE_NAME[to - 1] + '. ' + PHASE_TEXT[to - 1], { d: { k: 'phase', phase: to } });
    // the clapper hums
    this.living().forEach(function (p) { if (self.hasItem(p, 'clapper')) self.hurt(p, 'san', 1, { src: 'clapper', spirit: true }); });
    // unresolved curses grow
    var active = Object.keys(w.curses).filter(function (k) { return w.curses[k]; });
    if (active.length) { var feed = Math.ceil(active.length / 2); w.clock = Math.min(C.clockMax, w.clock + feed); this.addLog('clock', 'Unresolved curses feed the Haunting: ' + active.map(function (k) { return D.curses[k].name; }).join(', ') + '. (+' + feed + ')', { d: { k: 'clock', n: feed } }); }
    // allies lend their boons
    Object.keys(w.allies).forEach(function (a) {
      if (!w.allies[a]) return;
      if (a === 'tamsin') { self.hint('bellName', null); self.addLog('story', 'Tamsin hums the bell\'s name wrongly, on purpose, so you can hear what it is not.', {}); }
      if (a === 'hob') { self.living().forEach(function (p) { self.heal(p, 'vit', 2, null); }); self.addLog('story', 'Hob binds your wounds with the economy of a man who has done it for dogs.', {}); }
      if (a === 'ketterick') { self.living().forEach(function (p) { var k = Object.keys(p.sts).filter(function (s) { return !D.statuses[s].good; })[0]; if (k) delete p.sts[k]; self.addItem(p, 'herb', 1); }); self.addLog('story', 'Ketterick hands round warm tea. Everyone looks a little less haunted.', {}); }
    });
    if (to === 2) {
      this.corruptRandom(); this.corruptRandom();
      // the world remembers what you destroyed
      if (w.flags.shrine_destroyed) { this.spawnEnemy('hollow_hound', 'orchard', null, true); this.addLog('story', 'With the Whispering Shrine broken, nothing is listening to the Woods, and nothing is keeping the Woods\' hunters quiet.', {}); }
      if (w.flags.garden_burned) this.addLog('story', 'The ashes of the Witch\'s Garden drift down every road. The herbs do not grow back.', {});
      this.closeRandomEdge();
      this.living().forEach(function (p) { if (p.flags.pact) { p.sts.marked = 1; } });
      this.addLog('story', 'Somewhere below, the Remembrancer turns a page. It has begun to take an interest in the ones who have been marked.', {});
    }
    if (to === 3) {
      if (!w.flags.gate_open) { w.flags.gate_open = true; this.addLog('world', 'The Escape Gate stands open. The Hollow lets you leave, if you still can.', { d: { k: 'gate' } }); }
      this.spawnEnemy('hollow_hound', this.randomLocIn('woods'), null, false);
      this.spawnEnemy('hollow_hound', this.randomLocIn('abbey'), null, false);
    }
    // the second the clock reaches phase III the final act is open: say so
    if (to === 3) this.addLog('story', 'The bell tolls the hour of the finale. The Heart Chamber is waiting.', {});
  };

  M.randomLocIn = function (region) {
    var ids = Object.keys(D.locations).filter(function (id) { return D.locations[id].region === region && !D.locations[id].boss; });
    return this.pick(ids);
  };

  // ───────────────────────────── omens ─────────────────────────────
  M.drawOmen = function () {
    var w = this.w;
    var pool = D.omens.filter(function (o) { return o.phases.indexOf(w.haunt) >= 0 && w.usedOmens.indexOf(o.id) < 0; });
    if (!pool.length) return;
    var o = this.pick(pool);
    w.usedOmens.push(o.id);
    this.addLog('omen', o.title + '. ' + o.text, { d: { k: 'omen', id: o.id } });
    this.worldFx(o.fx);
  };

  M.worldFx = function (fx) {
    var self = this, w = this.w;
    if (fx.clock) this.advanceClock(fx.clock, 'The omen feeds the Haunting.');
    if (fx.noise) this.addNoise(fx.noise);
    if (fx.each) this.living().forEach(function (p) { var cx = { lines: [], chips: [] }; self.applyOutcome(p, Object.assign({}, fx.each, { t: undefined }), cx); });
    if (fx.lonely) this.living().forEach(function (p) { if (self.here(p.loc).length === 1) { var cx = { lines: [], chips: [] }; self.applyOutcome(p, Object.assign({}, fx.lonely, { t: undefined }), cx); self.addLog('world', p.name + ': ' + (fx.lonely.t || 'It finds you alone.'), { p: p.id }); } });
    if (fx.marked) this.living().forEach(function (p) { if (p.sts.marked) { var cx = { lines: [], chips: [] }; self.applyOutcome(p, Object.assign({}, fx.marked, { t: undefined }), cx); self.addLog('world', p.name + ': ' + (fx.marked.t || 'It knows your name.'), { p: p.id }); } });
    if (fx.spawn) {
      var at = fx.spawn.at, loc = at.indexOf('region:') === 0 ? this.randomLocIn(at.slice(7)) : at.slice(4);
      this.spawnEnemy(fx.spawn.enemy, loc, null, false, true);
    }
    if (fx.closeEdge) this.closeRandomEdge();
    if (fx.openEdge) this.openRandomEdge();
    if (fx.corruptRandom) this.corruptRandom();
    if (fx.rumor) this.addRumor(null);
    if (fx.hint) this.hint(fx.hint, null);
    if (fx.revealRandom) this.revealRandom(fx.revealRandom, null);
    if (fx.reveal) fx.reveal.forEach(function (r) { self.reveal(r, null); });
    if (fx.lanternDrain) this.living().forEach(function (p) { if (self.hasItem(p, 'lantern')) { self.drainLantern(p, 1, null); } });
  };

  M.corruptRandom = function () {
    var w = this.w;
    var c = Object.keys(D.locations).filter(function (id) {
      var l = D.locations[id], L = w.locs[id];
      return (l.safe || l.kind === 'sanctuary') && !L.corrupt && L.chalk <= w.round && L.seal <= w.round && id !== 'gate';
    });
    if (!c.length) return;
    var id = this.pick(c);
    w.locs[id].corrupt = 1;
    this.addLog('world', D.locations[id].name + ' turns sour. It can no longer be rested in, and standing there frays the nerves.', { loc: id, d: { k: 'corrupt' } });
  };

  // Close a road for a few rounds, but never in a way that strands anyone from the Heart.
  M.closeRandomEdge = function () {
    var w = this.w, self = this;
    var cand = Object.keys(this.graph.edges).filter(function (k) {
      var e = self.graph.edges[k], s = w.edges[k];
      return e.type === 'path' && !e.oneway && s.closedUntil <= w.round && e.a !== 'gate' && e.b !== 'gate' && e.a !== 'square' && e.b !== 'square';
    });
    cand = this.shuffle(cand);
    for (var i = 0; i < cand.length; i++) {
      var k = cand[i];
      w.edges[k].closedUntil = w.round + 3;
      if (this.heartReachable()) {
        var e = this.graph.edges[k];
        this.addLog('world', 'The road between ' + D.locations[e.a].name + ' and ' + D.locations[e.b].name + ' collapses, for a while.', { d: { k: 'route' } });
        return;
      }
      w.edges[k].closedUntil = 0;
    }
  };

  M.openRandomEdge = function () {
    var w = this.w, self = this;
    var cand = Object.keys(this.graph.edges).filter(function (k) { var e = self.graph.edges[k]; return e.type === 'locked' && !w.edges[k].open && !self.waysFlagOpen(e); });
    if (cand.length) {
      var k = this.pick(cand), e = this.graph.edges[k];
      w.edges[k].open = true;
      this.addLog('world', 'Somewhere, a lock gives way: ' + (e.label || 'a door') + ' between ' + D.locations[e.a].name + ' and ' + D.locations[e.b].name + ' stands open.', { d: { k: 'route' } });
      return;
    }
    var hid = Object.keys(this.graph.edges).filter(function (k) { return self.graph.edges[k].type === 'hidden' && !w.edges[k].rev; });
    if (hid.length) this.reveal('edge:' + this.pick(hid), null);
  };

  // ───────────────────────────── the map ─────────────────────────────
  M.waysFlagOpen = function (e) {
    var w = this.w;
    return !!(e.ways && e.ways.some(function (x) { return x.flag && w.flags[x.flag]; }));
  };

  M.neighbors = function (loc) {
    var out = (this.graph.adj[loc] || []).slice(), w = this.w;
    if (loc === 'corridor') out.push({ to: w.corridor, e: this.virtualEdge('corridor', w.corridor) });
    else if (loc === w.corridor) out.push({ to: 'corridor', e: this.virtualEdge('corridor', w.corridor) });
    return out;
  };
  M.virtualEdge = function (a, b) { return { key: 'corridor~' + b, a: a, b: b, type: 'path', oneway: false, virtual: true, label: 'The corridor is open here', trap: null }; };

  // Can this road be walked from `from`? (players: p given; monsters: monster = true)
  M.edgeState = function (e, from, monster) {
    var w = this.w, s = w.edges[e.key] || { rev: true, open: true, closedUntil: 0 };
    if (monster && w.opening && !w.opening.complete && this.openingPlace(e.a) !== this.openingPlace(e.b)) return { ok: false, state: 'closed', why: 'The village is still.' };
    if (!monster && w.opening && !w.opening.complete && (!this.openingPlace(e.a) || !this.openingPlace(e.b))) return { ok: false, state: 'closed', why: 'Follow the missing bell first. The wider expedition opens after you examine the tower frame.' };
    if (e.virtual) return { ok: true, state: 'open' };
    if (e.type === 'hidden' && !s.rev) return { ok: false, state: 'hidden', why: 'Hidden' };
    if (e.oneway && e.a !== from) return { ok: false, state: 'oneway', why: 'A one-way drop' };
    if (s.closedUntil > w.round) return { ok: false, state: 'closed', why: 'Collapsed for ' + (s.closedUntil - w.round) + ' more round' + (s.closedUntil - w.round > 1 ? 's' : '') };
    if (e.type === 'locked' && !(s.open || this.waysFlagOpen(e))) return { ok: false, state: 'locked', why: 'Locked' };
    if (e.type === 'guarded' && !e.until.some(function (f) { return w.flags[f]; })) return { ok: false, state: 'guarded', why: 'The Warden bars the stair' };
    return { ok: true, state: 'open' };
  };
  M.edgeVisible = function (e) { var s = this.w.edges[e.key]; return e.virtual || e.type !== 'hidden' || (s && s.rev); };

  // BFS over walkable roads. Returns the list of locations from `from` (exclusive) to `to` (inclusive), or null.
  M.path = function (from, to, monster, maxLen) {
    if (from === to) return [];
    var prev = {}, q = [from], seen = {}; seen[from] = true;
    while (q.length) {
      var cur = q.shift();
      var nbs = this.neighbors(cur);
      for (var i = 0; i < nbs.length; i++) {
        var nb = nbs[i];
        if (seen[nb.to]) continue;
        if (!this.edgeVisible(nb.e) && !monster) continue;
        if (monster && nb.e.type === 'hidden' && !this.w.edges[nb.e.key].rev) continue;
        if (!this.edgeState(nb.e, cur, monster).ok) continue;
        seen[nb.to] = true; prev[nb.to] = { from: cur, e: nb.e };
        if (nb.to === to) {
          var out = [], c = to;
          while (c !== from) { out.unshift(c); c = prev[c].from; }
          return maxLen && out.length > maxLen ? null : out;
        }
        q.push(nb.to);
      }
    }
    return null;
  };
  M.edgeOnPath = function (from, to) {
    var nbs = this.neighbors(from);
    for (var i = 0; i < nbs.length; i++) if (nbs[i].to === to) return nbs[i].e;
    return null;
  };

  // Used to keep the world beatable: could every living player still reach the Heart if all the locks were opened?
  M.heartReachable = function () {
    var self = this, w = this.w;
    var ok = function (start) {
      var seen = {}, q = [start]; seen[start] = true;
      while (q.length) {
        var cur = q.shift(); if (cur === 'heart_chamber') return true;
        self.neighbors(cur).forEach(function (nb) {
          if (seen[nb.to]) return;
          var s = w.edges[nb.e.key]; if (s && s.closedUntil > w.round) return;
          if (nb.e.oneway && nb.e.a !== cur) return;
          seen[nb.to] = true; q.push(nb.to);
        });
      }
      return false;
    };
    return this.living().every(function (p) { return ok(p.loc); });
  };

  M.markSeen = function (loc) {
    var w = this.w, self = this;
    this.neighbors(loc).forEach(function (nb) { if (self.edgeVisible(nb.e)) w.locs[nb.to].seen = true; });
  };

  M.reveal = function (r, ctx) {
    var w = this.w;
    if (r.indexOf('loc:') === 0) {
      var id = r.slice(4); if (w.locs[id] && !w.locs[id].seen) { w.locs[id].seen = true; this.addLog('world', 'You mark ' + D.locations[id].name + ' on the map.', { d: { k: 'reveal' } }); this.say(ctx, 'You mark ' + D.locations[id].name + ' on the map.', 'info'); }
    } else if (r.indexOf('edge:') === 0) {
      var k = r.slice(5), e = this.graph.edges[k];
      if (e && !w.edges[k].rev) { w.edges[k].rev = true; w.locs[e.a].seen = true; w.locs[e.b].seen = e.oneway ? w.locs[e.b].seen : true; this.addLog('world', 'A hidden way is revealed: ' + (e.label ? e.label + ', ' : '') + D.locations[e.a].name + (e.oneway ? ' → ' : ' ↔ ') + D.locations[e.b].name + '.', { d: { k: 'reveal' } }); this.say(ctx, 'A hidden way is revealed.', 'info'); }
    }
  };
  M.revealRandom = function (n, ctx) {
    var w = this.w;
    for (var i = 0; i < n; i++) {
      var c = Object.keys(w.locs).filter(function (id) { return !w.locs[id].seen; });
      if (c.length) this.reveal('loc:' + this.pick(c), ctx);
    }
  };

  // ───────────────────────────── movement ─────────────────────────────
  M.engagedEnemy = function (p) {
    if (p.unnoticed === p.loc) return null;
    var w = this.w;
    var en = w.enemies.find(function (e) { return e.loc === p.loc && !e.dead; });
    if (en) return { kind: 'enemy', obj: en };
    if (D.locations[p.loc].boss && !w.boss.dead && w.boss.hp > 0 && !w.flags.warden_bypassed) return { kind: 'boss' };
    return null;
  };

  // Every road out of p's place, with what it costs and why it might be shut.
  M.moveOptions = function (p) {
    var self = this, out = [];
    this.neighbors(p.loc).forEach(function (nb) {
      if (!self.edgeVisible(nb.e)) return;
      if (self.w.opening && !self.w.opening.complete && !self.openingPlace(nb.to)) return;
      var st = self.edgeState(nb.e, p.loc, false);
      var o = { to: nb.to, key: nb.e.key, label: nb.e.label || '', state: st.state, ok: st.ok, why: st.why || '', type: nb.e.type, oneway: nb.e.oneway };
      if (st.state === 'oneway') return;      // the far end of a drop is not a road
      var en = self.w.enemies.find(function (e) { return e.loc === nb.to && !e.dead; });
      o.enemy = en ? en.id : null;
      if (nb.e.type === 'locked' && !st.ok) o.ways = (nb.e.ways || []).map(function (x) { return self.wayInfo(p, nb.e, x); });
      out.push(o);
    });
    return out;
  };

  M.wayInfo = function (p, e, x) {
    var ok = true, why = '';
    if (x.flag) { ok = !!this.w.flags[x.flag]; why = ok ? '' : 'Not yet'; }
    if (x.item && !this.hasItem(p, x.item)) { ok = false; why = 'Needs ' + D.items[x.item].name; }
    if (x.cost && x.cost.silver && p.silver < x.cost.silver) { ok = false; why = 'Needs ' + x.cost.silver + ' Silver'; }
    if (x.cost && x.cost.san && p.san <= x.cost.san) { ok = false; why = 'You cannot spare the Sanity'; }
    var o = { id: x.id, label: x.label, ok: ok, why: why, ap: x.stat ? 1 : 0, cost: x.cost || null };
    if (x.stat) { var ri = this.rollInfo(p, { stat: x.stat, dc: x.dc, id: 'unlock', noScale: true }, {}); o.stat = x.stat; o.dc = ri.dc; o.chance = ri.chance; o.mod = ri.mod; o.mods = ri.mods; }
    return o;
  };

  M.cmd_move = function (p, c) {
    var e = this.requireTurn(p); if (e) return { error: e };
    var t = this.turn, enc = t.enc;
    if (enc && enc.hold) return { error: 'Decide about your roll first.' };
    if (t.ap < 1) return { error: 'No actions left this turn.' };
    var mode = c.mode || 'step', to = c.to, w = this.w;
    var opts = this.moveOptions(p);
    var self = this;
    var fromEnemy = this.engagedEnemy(p);
    var finish = function (dest, md, edge, extra) {
      t.ap -= 1;
      if (enc) self.closeEnc(p, true);
      if (fromEnemy) self.partingStrike(p, fromEnemy);
      if (p.status !== 'alive') return { ok: true };
      self.moveTo(p, dest, md, edge);
      return Object.assign({ ok: true }, extra || {});
    };
    if (mode === 'step') {
      var o = opts.find(function (x) { return x.to === to; });
      if (!o) return { error: 'There is no road there.' };
      if (!o.ok) return { error: o.why + '.' };
      return finish(to, 'step', this.edgeOnPath(p.loc, to));
    }
    if (mode === 'sprint') {
      var pth = this.path(p.loc, to, false, 2);
      if (!pth || pth.length < 1 || pth.length > 2) return { error: 'You cannot sprint there.' };
      // an enemy on the way stops you
      var dest = to;
      for (var i = 0; i < pth.length - 1; i++) if (w.enemies.some(function (en) { return en.loc === pth[i] && !en.dead; })) { dest = pth[i]; break; }
      p.sprinted = w.round;
      var silent = (p.cls === 'vagabond' && p.silentRound !== w.round) || p.skills.indexOf('ghost_step') >= 0 || p.thread;
      if (p.cls === 'vagabond' && p.silentRound !== w.round) p.silentRound = w.round;
      if (!silent) this.addNoise(1, p);
      var last = pth.length > 1 && dest === to ? this.edgeOnPath(pth[pth.length - 2], to) : this.edgeOnPath(p.loc, dest);
      return finish(dest, 'sprint', last, { sprint: true });
    }
    if (mode === 'follow') {
      var target = this.get(c.target);
      if (!target || target.status !== 'alive' || target.id === p.id) return { error: 'You cannot follow them.' };
      var pt = this.path(p.loc, target.loc, false);
      if (!pt || !pt.length) return { error: pt ? 'They are already here.' : 'You can see no way to reach them.' };
      var stepTo = pt.slice(0, 2), d2 = stepTo[stepTo.length - 1];
      for (var j = 0; j < stepTo.length - 1; j++) if (w.enemies.some(function (en) { return en.loc === stepTo[j] && !en.dead; })) { d2 = stepTo[j]; break; }
      var ed = d2 === stepTo[0] ? this.edgeOnPath(p.loc, d2) : this.edgeOnPath(stepTo[0], d2);
      return finish(d2, 'follow', ed);
    }
    if (mode === 'sneak') {
      var so = opts.find(function (x) { return x.to === to; });
      if (!so || !so.ok) return { error: 'There is no road there.' };
      var en = w.enemies.find(function (x) { return x.loc === to && !x.dead; });
      if (!en) return { error: 'There is nothing there to sneak past.' };
      var def = D.enemies[en.id];
      if (def.alert >= 50) return { error: 'The ' + def.name + ' cannot be fooled. It does not sleep, and it does not look.' };
      var info = this.rollInfo(p, { id: 'sneak', stat: 'wit', dc: def.alert, noScale: true, bonus: [{ if: { cls: 'vagabond' }, b: 1, why: 'Light Step' }] }, { enemy: en });
      var roll = this.roll(p, info);
      var ok = roll.tier === 'ok' || roll.tier === 'crit';
      this.addLog('result', p.name + ' tries to slip past the ' + def.name + ' — rolled ' + roll.d + ' (' + roll.total + ' vs ' + roll.dc + ') — ' + (ok ? 'unnoticed.' : 'noticed.'), { p: p.id, d: { result: { opt: 'Sneak past', tier: roll.tier, roll: roll, lines: [], chips: [], n: this.n + 1, by: p.id } } });
      var edge2 = this.edgeOnPath(p.loc, to);
      t.ap -= 1;
      if (enc) this.closeEnc(p, true);
      if (fromEnemy) this.partingStrike(p, fromEnemy);
      if (p.status !== 'alive') return { ok: true };
      this.moveTo(p, to, ok ? 'sneak' : 'step', edge2);
      if (ok && roll.tier === 'crit') this.gainXp(p, 1, null);
      return { ok: true, roll: roll };
    }
    return { error: 'Unknown way to travel.' };
  };

  M.partingStrike = function (p, eng) {
    if (eng.kind === 'boss') { this.addLog('boss', 'The Warden\'s chains lash as you go.', { p: p.id }); this.hurt(p, 'vit', 1, { src: 'boss' }); return; }
    var en = eng.obj, def = D.enemies[en.id];
    if (p.thread || def.behavior === 'toll') return;
    this.addLog('enemy', 'The ' + def.name + ' strikes at your back as you leave.', { p: p.id });
    this.hurt(p, def.type === 'spirit' ? 'san' : 'vit', 1, { src: en.id, spirit: def.type === 'spirit' });
  };

  M.moveTo = function (p, to, mode, edge) {
    var w = this.w, from = p.loc, L = w.locs[to], loc = D.locations[to];
    var thread = p.thread; p.thread = false;
    p.prevLoc = from; p.loc = to; p.unnoticed = mode === 'sneak' ? to : null; p.tally.steps++;
    if (!p.visited[to]) { p.visited[to] = w.round; this.gainXp(p, D.xpValues.firstVisit, null); }
    L.visited = true; L.seen = true;
    this.markSeen(to);
    var verb = { step: 'steps', sprint: 'sprints', sneak: 'creeps', follow: 'follows the trail', echo: 'follows an echo', slip: 'slips', forced: 'is carried', unlock: 'steps' }[mode] || 'moves';
    this.addLog('move', p.name + ' ' + verb + ' to ' + loc.name + '.', { p: p.id, loc: to, d: { k: 'move', mode: mode, region: loc.region, from: from } });
    if (p.skills.indexOf('cartographer') >= 0) {
      var self = this;
      this.neighbors(to).forEach(function (nb) { if (nb.e.type === 'hidden' && !w.edges[nb.e.key].rev) self.reveal('edge:' + nb.e.key, null); });
    }
    // traps: roads that bite, and places that bite those who run
    if (edge && edge.trap && !thread) this.trapCheck(p, edge.trap, mode === 'step' || mode === 'sneak' ? 3 : 0, loc.name);
    if (p.status !== 'alive') return;
    var lt = loc.trap;
    var safeNow = (to === 'bridge' && w.flags.bridge_safe) || (to === 'hidden_passage' && w.flags.passage_marked);
    if (lt && (mode === 'sprint' || mode === 'echo' || mode === 'forced' || mode === 'slip') && !thread && !safeNow) this.trapCheck(p, lt, 0, loc.name);
    if (p.status !== 'alive') return;
    if (L.corrupt && L.chalk <= w.round) this.hurt(p, 'san', 1, { src: 'corrupt', spirit: true });
    if (p.status !== 'alive') return;
    if (loc.forage && p.cls === 'apothecary' && !p.forageDone[to] && !L.corrupt && (loc.region === 'village' || loc.region === 'woods')) {
      p.forageDone[to] = true; if (this.addItem(p, 'herb', 1)) this.addLog('item', p.name + ' gathers some Gravemoss.', { p: p.id });
    }
    // whoever is waiting here
    var eng = this.engagedEnemy(p);
    if (eng) this.confront(p, eng, mode, thread);
    var ground = L.ground && L.ground.length;
    if (ground) this.addLog('item', 'Items lie on the ground here.', { p: p.id, loc: to });
  };

  M.trapCheck = function (p, trap, bonus, where) {
    var d = this.d20(), mod = p.stats[trap.stat] + bonus + (p.sts.blessed ? 2 : 0);
    if (p.sts.blessed) delete p.sts.blessed;
    var ok = d === 20 || (d !== 1 && d + mod >= trap.dc);
    this.addLog('trap', ok ? p.name + ' avoids a hazard (rolled ' + d + ').' : trap.t, { p: p.id, d: { k: 'trap', roll: { d: d, mod: mod, total: d + mod, dc: trap.dc, tier: ok ? 'ok' : 'fail', stat: trap.stat } } });
    if (ok) return;
    if (trap.vit) this.hurt(p, 'vit', -trap.vit, { src: 'trap' });
    if (trap.san && p.status === 'alive') this.hurt(p, 'san', -trap.san, { src: 'trap', spirit: true });
  };

  M.confront = function (p, eng, mode, thread) {
    var w = this.w;
    if (eng.kind === 'boss') {
      this.addLog('boss', 'The Abbey Warden looks up from the chains, and the chains look up with him.', { p: p.id, d: { k: 'boss' } });
      if (this.turn && this.turn.active === p.id) this.openBossEnc(p);
      return;
    }
    var en = eng.obj, def = D.enemies[en.id], L = w.locs[p.loc];
    // a snare laid here goes off first
    if (L.snare) {
      L.snare = null; en.hp -= 1;
      this.addLog('enemy', 'A snare snaps shut on the ' + def.name + '. It is hurt, and has lost the surprise.', { p: p.id, loc: p.loc });
      if (en.hp <= 0) { var cx = { lines: [], chips: [], enemy: en, p: p }; this.defeatEnemy(en, p, cx); return; }
    } else if (!thread && !(p.cls === 'hunter' && def.type === 'beast' && (mode === 'step' || mode === 'follow')) && L.chalk <= w.round) {
      this.ambush(p, en);
    } else if (thread) this.addLog('enemy', 'The thread leads you around the ' + def.name + '\'s first lunge.', { p: p.id });
    else if (L.chalk > w.round) this.addLog('enemy', 'The ward-circle holds the ' + def.name + ' at bay.', { p: p.id });
    else this.addLog('enemy', 'Your tracker\'s instinct keeps the ' + def.name + ' from ambushing you.', { p: p.id });
    if (p.status === 'alive' && this.turn && this.turn.active === p.id && !this.turn.enc) this.openEnemyEnc(p, en, true);
  };

  M.ambush = function (p, en) {
    var def = D.enemies[en.id], a = def.ambush;
    this.addLog('enemy', def.name + ': ' + a.t, { p: p.id, loc: p.loc, d: { k: 'enemy', id: en.id } });
    var spirit = def.type === 'spirit';
    if (a.vit) this.hurt(p, 'vit', -a.vit, { src: en.id, spirit: spirit });
    if (a.san && p.status === 'alive') this.hurt(p, 'san', -a.san, { src: en.id, spirit: true });
  };

  M.cmd_unlock = function (p, c) {
    var e = this.requireTurn(p); if (e) return { error: e };
    var t = this.turn, w = this.w;
    if (t.enc) return { error: 'Close the encounter first.' };
    var nb = this.neighbors(p.loc).find(function (x) { return x.e.key === c.edge; });
    if (!nb || nb.e.type !== 'locked') return { error: 'That is not a locked road beside you.' };
    var st = this.edgeState(nb.e, p.loc);
    if (st.ok) return { error: 'It is already open.' };
    var way = (nb.e.ways || []).find(function (x) { return x.id === c.way; });
    if (!way || way.flag) return { error: 'Choose a way to open it.' };
    var wi = this.wayInfo(p, nb.e, way);
    if (!wi.ok) return { error: wi.why + '.' };
    if (way.stat && t.ap < 1) return { error: 'No actions left this turn.' };
    var name = (nb.e.label || 'the way') + ' (' + D.locations[nb.e.a].name + ' ↔ ' + D.locations[nb.e.b].name + ')';
    if (way.cost) this.payCost(p, way.cost);
    if (way.stat) {
      t.ap -= 1;
      var roll = this.roll(p, this.rollInfo(p, { id: 'unlock', stat: way.stat, dc: way.dc, noScale: true }, {}));
      var ok = roll.tier === 'ok' || roll.tier === 'crit';
      this.addLog('result', p.name + ' works at ' + name + ' — rolled ' + roll.d + ' (' + roll.total + ' vs ' + roll.dc + ') — ' + (ok ? 'it gives.' : 'it holds.'), { p: p.id, d: { result: { opt: way.label, tier: roll.tier, roll: roll, lines: [], chips: [], n: this.n + 1, by: p.id } } });
      if (!ok) { this.hurt(p, 'vit', 1, { src: 'unlock', raw: true }); this.addNoise(roll.tier === 'fumble' ? 2 : 1, p); return { ok: true, roll: roll }; }
    } else this.addLog('world', p.name + ' opens ' + name + '.', { p: p.id });
    w.edges[nb.e.key].open = true;
    this.gainXp(p, 1, null);
    return { ok: true };
  };

  M.cmd_investigate = function (p) {
    var e = this.requireTurn(p); if (e) return { error: e };
    var t = this.turn, w = this.w;
    if (t.enc) return { error: 'Close the encounter first.' };
    if (t.ap < 1) return { error: 'No actions left this turn.' };
    if (this.engagedEnemy(p)) return { error: 'You cannot study a place with something hunting you in it.' };
    var self = this, L = w.locs[p.loc];
    t.ap -= 1;
    L.inv = true;
    var lines = [];
    var hid = this.neighbors(p.loc).filter(function (nb) { return nb.e.type === 'hidden' && !w.edges[nb.e.key].rev && !nb.e.virtual; });
    var lan = p.inv.find(function (x) { return x.id === 'lantern' && x.eq && x.uses > 0; });
    var rolled = null;
    if (hid.length) {
      if (lan) { lan.uses--; hid.forEach(function (nb) { self.reveal('edge:' + nb.e.key, null); }); lines.push('The lantern flushes out every secret way.'); }
      else if (p.cls === 'vagabond' || p.skills.indexOf('cartographer') >= 0) { hid.forEach(function (nb) { self.reveal('edge:' + nb.e.key, null); }); lines.push('Your trained eye finds the hidden way at once.'); }
      else {
        var info = this.rollInfo(p, { id: 'investigate', stat: 'wit', dc: 10, noScale: true, bonus: p.skills.indexOf('lore_keeper') >= 0 ? [{ if: {}, b: 1, why: 'Lore-Keeper' }] : [] }, {});
        rolled = this.roll(p, info);
        var found = hid.filter(function (nb) { return rolled.total >= nb.e.dc || rolled.tier === 'crit'; });
        found.forEach(function (nb) { self.reveal('edge:' + nb.e.key, null); });
        if (!found.length) { lines.push('You find nothing, but the search is noisy.'); this.addNoise(rolled.tier === 'fumble' ? 2 : 1, p); }
        this.addLog('result', p.name + ' investigates ' + D.locations[p.loc].name + ' — rolled ' + rolled.d + ' (' + rolled.total + ' vs hidden ways) — ' + (found.length ? 'finds ' + found.length + '.' : 'nothing.'), { p: p.id, loc: p.loc, d: { result: { opt: 'Investigate', oid: 'investigate', loc: p.loc, tier: rolled.tier, roll: rolled, lines: [], chips: [], n: this.n + 1, by: p.id } } });
      }
    } else lines.push('No hidden ways here.');
    var loc = D.locations[p.loc];
    var secret = (loc.options || []).some(function (o) { return o.hidden; });
    if (secret) lines.push('You find something others would walk past.');
    // rumors
    var ru = w.rumors.find(function (r) { return r.loc === p.loc; });
    if (ru) {
      if (ru.truth) { ru.confirmed = true; lines.push('The rumor is true: something here is worth finding.'); }
      else { w.rumors = w.rumors.filter(function (r) { return r !== ru; }); lines.push('The rumor was false. Only dust.'); }
    }
    if (p.cls === 'medium') lines.push(this.cluesLeftAt(p.loc) ? 'The veil is thin here: a clue remains.' : 'The veil is quiet. Nothing more to learn here.');
    this.addLog('world', p.name + ' investigates ' + loc.name + '. ' + lines.join(' '), { p: p.id, loc: p.loc, d: { k: 'investigate' } });
    return { ok: true, lines: lines };
  };

  // Is there an unfound clue behind any option here?
  M.cluesLeftAt = function (locId) {
    var w = this.w, loc = D.locations[locId];
    return (loc.options || []).some(function (o) {
      var oks = [o.ok, o.crit, o.auto].filter(Boolean);
      return oks.some(function (x) { var cl = x.clue ? [].concat(x.clue) : []; return cl.some(function (c) { return !w.clues[c]; }); });
    });
  };
  M.clueLocs = function () {
    var self = this;
    return Object.keys(D.locations).filter(function (id) { return self.cluesLeftAt(id); });
  };

  M.cmd_echo = function (p) {
    var e = this.requireTurn(p); if (e) return { error: e };
    var t = this.turn, w = this.w;
    if (t.enc) return { error: 'Close the encounter first.' };
    if (t.ap < 1) return { error: 'No actions left this turn.' };
    if (this.engagedEnemy(p)) return { error: 'Something is on you. You cannot listen for echoes.' };
    var cost = p.cls === 'medium' ? 0 : 1;
    if (cost && p.san <= cost) return { error: 'You cannot spare the Sanity.' };
    var self = this;
    var cand = this.neighbors(p.loc).filter(function (nb) { return nb.e.type === 'hidden' && !nb.e.virtual && self.edgeState(Object.assign({}, nb.e), p.loc).state !== 'oneway' && (!nb.e.oneway || nb.e.a === p.loc); });
    t.ap -= 1;
    if (cost) this.hurt(p, 'san', cost, { src: 'echo', raw: true });
    if (p.status !== 'alive') return { ok: true };
    if (cand.length) {
      var nb = this.pick(cand);
      w.edges[nb.e.key].rev = true;
      this.addLog('story', p.name + ' follows an echo that nobody else can hear, into a way nobody else has found.', { p: p.id });
      this.moveTo(p, nb.to, 'echo', nb.e);
      return { ok: true, moved: nb.to };
    }
    var keys = ['bellName', 'heartName', 'sigil', 'star', 'shelf', 'mirror', 'fountain', 'grave', 'herb'].filter(function (k) { return !w.solved[k]; });
    var got = [];
    if (keys.length) { this.hint(this.pick(keys), null); got.push('hint'); }
    this.addRumor(null);
    this.addLog('story', p.name + ' listens to the echoes here. There are no hidden ways, but the echoes hand over what they can.', { p: p.id });
    return { ok: true };
  };

  M.cmd_rest = function (p, c) {
    var e = this.requireTurn(p); if (e) return { error: e };
    var t = this.turn, w = this.w, L = w.locs[p.loc], loc = D.locations[p.loc];
    if (t.enc) return { error: 'Close the encounter first.' };
    if (t.ap < 1) return { error: 'No actions left this turn.' };
    var why = this.restBlock(p);
    if (why) return { error: why };
    var kind = c.stat === 'san' ? 'san' : 'vit';
    t.ap -= 1;
    p.rests[w.haunt] = (p.rests[w.haunt] || 0) + 1;
    var n = 2 + (p.skills.indexOf('second_wind') >= 0 ? 1 : 0);
    this.heal(p, kind, n, null);
    if (p.sts.bleeding) delete p.sts.bleeding;
    this.addLog('story', p.name + ' rests at ' + loc.name + '. The Hollow gets a little closer while they do.', { p: p.id, d: { k: 'rest' } });
    this.advanceClock(1, null);
    return { ok: true };
  };
  M.restBlock = function (p) {
    var w = this.w, L = w.locs[p.loc], loc = D.locations[p.loc];
    if (this.engagedEnemy(p)) return 'Something is hunting you here.';
    var chalked = L.chalk > w.round;
    if (!(loc.safe || loc.kind === 'sanctuary' || chalked)) return 'This place is not safe to rest in. Find a refuge, or use Ward Chalk.';
    if (L.corrupt && !chalked) return 'This place has turned sour.';
    if (w.curses.rot && loc.region === 'woods' && !chalked) return 'The Orchard Rot has fouled the Woods.';
    if (p.sts.hunted) return 'You are being hunted.';
    if ((p.rests[w.haunt] || 0) >= C.restsPerPhase) return 'You have rested as much as the Hollow allows in this phase.';
    return null;
  };

  // ───────────────────────────── encounters ─────────────────────────────
  M.encId = function () { return 'e' + (++this.w.uid); };

  M.closeEnc = function (p, force) {
    if (this.turn) this.turn.enc = null;
  };
  M.cmd_leave = function (p) {
    var e = this.requireTurn(p); if (e) return { error: e };
    var enc = this.turn.enc; if (!enc) return { ok: true };
    if (enc.hold) return { error: 'Decide about your roll first.' };
    if ((enc.kind === 'enemy' || enc.kind === 'boss') && !enc.over) return { error: 'You cannot just walk away. Fight, use an item, or retreat along a road.' };
    this.closeEnc(p, true);
    return { ok: true };
  };

  M.descFor = function (loc) {
    var l = D.locations[loc], txt = l.desc;
    if (loc === 'belltower' && (!this.w.opening || this.w.opening.entered)) return l.interiorDesc;
    (l.descAlt || []).forEach(function (a) { if (this.test(a.if, null)) txt = a.text; }, this);
    return txt;
  };

  M.cmd_interact = function (p) {
    var e = this.requireTurn(p); if (e) return { error: e };
    var t = this.turn, w = this.w;
    if (t.enc) return { ok: true };
    var loc = D.locations[p.loc];
    var eng = this.engagedEnemy(p);
    if (eng) { if (eng.kind === 'boss') this.openBossEnc(p); else this.openEnemyEnc(p, eng.obj, true); return { ok: true }; }
    if (loc.boss) { if (!w.boss.dead) this.openBossEnc(p); else this.openLocEnc(p); return { ok: true }; }
    this.openLocEnc(p);
    return { ok: true };
  };

  M.openLocEnc = function (p) {
    var w = this.w, loc = D.locations[p.loc];
    var enc = { id: this.encId(), kind: 'loc', pid: p.id, loc: p.loc, title: loc.name, text: this.descFor(p.loc), aid: { asked: false, bonus: 0, helpers: [] }, result: null };
    if (loc.guard) {
      var g2 = w.enemies.find(function (e) { return e.loc === p.loc && e.id === loc.guard && !e.dead; });
      if (g2) { enc.guard = true; enc.guardText = 'The ' + D.enemies[loc.guard].name + ' bars the way. Deal with it first.'; }
    }
    this.turn.enc = enc;
    return enc;
  };

  M.openEnemyEnc = function (p, en, silent) {
    var def = D.enemies[en.id];
    this.turn.enc = { id: this.encId(), kind: 'enemy', pid: p.id, loc: p.loc, enemy: en.uid, enemyObj: true, title: def.name, text: def.blurb, aid: { asked: false, bonus: 0, helpers: [] }, result: null };
  };

  M.openBossEnc = function (p) {
    this.turn.enc = { id: this.encId(), kind: 'boss', pid: p.id, loc: p.loc, title: D.boss.name, text: D.boss.blurb, aid: { asked: false, bonus: 0, helpers: [] }, result: null };
  };

  M.cmd_explore = function (p) {
    var e = this.requireTurn(p); if (e) return { error: e };
    var t = this.turn, w = this.w, loc = D.locations[p.loc];
    if (t.enc) return { error: 'Close the encounter first.' };
    if (t.ap < 1) return { error: 'No actions left this turn.' };
    if (this.engagedEnemy(p)) return { error: 'You cannot wander with something hunting you.' };
    var pool = D.regionEvents.filter(function (ev) { return ev.region === loc.region && w.usedEvents.indexOf(ev.id) < 0; });
    if (!pool.length) return { error: 'You have seen everything this region has to show on foot.' };
    var ev = this.pick(pool);
    w.usedEvents.push(ev.id);
    t.ap -= 1;
    t.enc = { id: this.encId(), kind: 'event', pid: p.id, loc: p.loc, event: ev.id, title: ev.title, text: ev.text, aid: { asked: false, bonus: 0, helpers: [] }, result: null };
    this.addLog('story', p.name + ' strikes out from ' + loc.name + ' and meets: ' + ev.title + '.', { p: p.id, d: { k: 'event' } });
    return { ok: true };
  };

  // The raw options an encounter offers, each with its evaluated form for this player.
  M.encOptions = function (p, enc) {
    if (enc.over) return [];
    var raws, base = { aid: enc.aid && enc.aid.bonus, spiritAid: this.w.spiritAid ? 2 : 0 };
    if (enc.kind === 'loc') raws = this.openingOptions(p, enc, D.locations[enc.loc].options || []);
    else if (enc.kind === 'event') raws = D.regionEvents.find(function (e) { return e.id === enc.event; }).options;
    else if (enc.kind === 'enemy') {
      var en = this.enemyByUid(enc.enemy);
      raws = en ? D.enemies[en.id].options : [];
      base.enemy = en;
    } else if (enc.kind === 'boss') { raws = this.bossOptions(p); }
    else raws = [];
    var out = [];
    raws.forEach(function (o) {
      var ev = this.evalOption(p, enc, o, base);
      if (ev) out.push({ raw: o, ev: ev });
    }, this);
    return out;
  };

  // ───────────────────────────── enemies ─────────────────────────────
  M.enemyByUid = function (uid) { return this.w.enemies.find(function (e) { return e.uid === uid; }); };

  M.spawnEnemy = function (id, loc, ctx, announce, quiet) {
    var w = this.w, def = D.enemies[id];
    if (!def || !loc) return null;
    if (w.enemies.some(function (e) { return e.loc === loc && e.id === id && !e.dead; })) return null;
    if (D.locations[loc].boss) loc = 'nave';
    var en = { uid: 'n' + (++w.uid), id: id, loc: loc, hp: def.hp, max: def.hp, known: false, last: null, dead: false, weak: def.weak };
    w.enemies.push(en);
    if (announce || quiet) this.addLog('enemy', 'A ' + def.name + ' appears at ' + D.locations[loc].name + '.', { loc: loc, d: { k: 'spawn', id: id } });
    if (ctx) this.say(ctx, 'A ' + def.name + ' appears.', 'info');
    return en;
  };

  M.defeatEnemy = function (en, p, ctx) {
    if (en.dead) return;
    en.dead = true; en.hp = 0;
    var def = D.enemies[en.id], w = this.w;
    w.enemies = w.enemies.filter(function (e) { return e !== en; });
    p.tally.kills++;
    this.addLog('enemy', p.name + ' defeats the ' + def.name + '.', { p: p.id, loc: en.loc, d: { k: 'defeat', id: en.id } });
    var loot = Object.assign({}, def.loot);
    if (ctx) this.say(ctx, 'The ' + def.name + ' is gone.', 'info');
    this.applyOutcome(p, loot, ctx || { lines: [], chips: [] });
    if (ctx && ctx.enc) ctx.enc.over = true;
    if (en.id === 'bellkeeper') w.flags.bellkeeper_down = true;
    if (en.id === 'grave_warden' && en.loc === 'treasury') w.flags.treasury_warden_down = true;
  };

  M.enemiesAct = function () {
    var w = this.w, self = this;
    w.enemies.slice().forEach(function (en) {
      if (en.dead) return;
      var def = D.enemies[en.id], living = self.living();
      if (!living.length) return;
      if (def.behavior === 'toll') {
        if (w.jam > 0) { w.jam--; return; }
        if (w.flags.bell_jammed) { delete w.flags.bell_jammed; w.jam = 1; self.addLog('enemy', 'The jammed bell strains, and does not toll.', {}); return; }
        self.addLog('enemy', 'The bell tolls. Somewhere, a name is remembered.', { d: { k: 'toll' } });
        if (w.haunt >= 2 || w.round % 2 === 0) self.advanceClock(1, null);
        if (w.haunt >= 2) self.closeRandomEdge();
        return;
      }
      var steps = 0, target = null;
      if (def.behavior === 'follow') { target = self.nearest(en.loc, living); steps = 1; }
      else if (def.behavior === 'stalk') { target = living.slice().sort(function (a, b) { return a.vit / a.maxVit - b.vit / b.maxVit; })[0]; steps = w.haunt === 3 ? 2 : 1; }
      else if (def.behavior === 'weep') { var lone = living.filter(function (p) { return self.here(p.loc).length === 1; }); target = lone.length ? self.nearest(en.loc, lone) : null; steps = 1; }
      else if (def.behavior === 'roam') {
        var nbs = self.neighbors(en.loc).filter(function (nb) { return self.edgeState(nb.e, en.loc, true).ok && D.locations[nb.to].region === D.locations[en.loc].region; });
        if (nbs.length && self.rint(2) === 0) { en.loc = self.pick(nbs).to; self.enemyArrive(en); }
        return;
      } else return;
      if (!target) return;
      for (var i = 0; i < steps; i++) {
        if (target.loc === en.loc) break;
        var pth = self.path(en.loc, target.loc, true);
        if (!pth || !pth.length) break;
        var next = pth[0];
        if (w.locs[next].seal > w.round) break;
        en.loc = next;
        self.enemyArrive(en);
      }
    });
  };

  M.nearest = function (from, players) {
    var self = this, best = null, bd = 1e9;
    players.forEach(function (p) { var pth = self.path(from, p.loc, true); var d = pth ? pth.length : 1e8; if (d < bd) { bd = d; best = p; } });
    return best;
  };

  M.enemyArrive = function (en) {
    var w = this.w, def = D.enemies[en.id], L = w.locs[en.loc], self = this;
    if (L.snare) {
      var setter = this.get(L.snare) || this.players[0];
      L.snare = null; en.hp -= 1;
      this.addLog('enemy', 'A snare takes the ' + def.name + ' as it arrives at ' + D.locations[en.loc].name + '.', { loc: en.loc });
      if (en.hp <= 0) { this.defeatEnemy(en, setter, null); }
      return;
    }
    this.here(en.loc).forEach(function (p) {
      if (L.chalk > w.round) { self.addLog('enemy', 'The ward-circle turns the ' + def.name + ' aside.', { p: p.id }); return; }
      if (p.unnoticed === p.loc) return;
      self.ambush(p, en);
    });
  };

  // ───────────────────────────── clues, hints, rumors, curses, allies ─────────────────────────────
  M.clueKnown = function (id, p) {
    var c = this.w.clues[id];
    return !!c && (c.shared || (p && c.by === p.id));
  };
  M.sharedClues = function () { var w = this.w; return Object.keys(w.clues).filter(function (k) { return w.clues[k].shared; }); };
  M.pillarProgress = function (pid) { var w = this.w; return this.sharedClues().filter(function (k) { return D.clues[k].pillar === pid; }).length; };
  M.pillarDone = function (pid) { return this.pillarProgress(pid) >= D.pillars[pid].need; };

  M.addClue = function (id, p, priv, ctx) {
    var w = this.w, c = D.clues[id];
    if (!c) throw new Error('Unknown clue ' + id);
    if (w.clues[id]) { this.say(ctx, 'You already knew this: "' + c.title + '".', 'info'); return false; }
    w.clues[id] = { by: p.id, round: w.round, shared: !priv, loc: p.loc };
    p.found.push(id); p.tally.clues++;
    this.gainXp(p, D.xpValues.clue, ctx);
    this.chip(ctx, 'clue', 1, 'Clue: ' + c.title, 'good');
    w.rumors = w.rumors.filter(function (r) { return !(r.loc === p.loc); });
    if (priv) this.addLog('clue', 'A private discovery: ' + c.title + ' — ' + c.text, { p: p.id, to: [p.id], d: { k: 'clue', id: id, priv: true } });
    else this.shareLog(id, p);
    return true;
  };
  M.shareLog = function (id, p) {
    var c = D.clues[id], before = this.pillarProgress(c.pillar);
    this.addLog('clue', p.name + ' uncovers "' + c.title + '". ' + c.text, { p: p.id, d: { k: 'clue', id: id } });
    if (this.pillarDone(c.pillar) && before < D.pillars[c.pillar].need) this.addLog('story', 'The party now understands: ' + D.pillars[c.pillar].name + '.', { d: { k: 'pillar' } });
  };
  M.cmd_share = function (p, c) {
    var w = this.w, cl = w.clues[c.clue];
    if (!cl || cl.by !== p.id) return { error: 'That is not yours to share.' };
    if (cl.shared) return { error: 'Everyone already knows.' };
    cl.shared = true; this.shareLog(c.clue, p);
    return { ok: true };
  };
  M.cmd_revealobj = function (p) {
    if (p.objRevealed) return { error: 'Already revealed.' };
    p.objRevealed = true;
    this.addLog('story', p.name + ' reveals their secret purpose: ' + D.objectives[p.objective].name + '.', { p: p.id });
    return { ok: true };
  };

  M.hint = function (key, ctx) {
    var w = this.w, sec = D.secrets[key];
    if (!sec || w.solved[key]) return;
    var el = (w.elim[key] = w.elim[key] || []), right = w.secrets[key];
    var cand = sec.vals.filter(function (v) { return v !== right && el.indexOf(v) < 0; });
    if (!cand.length) return;
    var v = this.pick(cand); el.push(v);
    var nm = (sec.names && sec.names[v]) || v;
    this.addLog('hint', 'It is not ' + (key === 'bellName' || key === 'heartName' ? '"' + nm + '"' : nm) + '. (' + util.cap(sec.label) + ')', { d: { k: 'hint', key: key } });
    this.chip(ctx, 'hint', 1, 'Ruled out: ' + nm, 'good');
  };

  M.addRumor = function (ctx) {
    var w = this.w;
    if (w.rumors.length >= 4) w.rumors.shift();
    var truth = this.rint(2) === 0, cands;
    if (truth) cands = this.clueLocs(); else cands = Object.keys(D.locations).filter(function (id) { return !D.locations[id].boss; });
    cands = cands.filter(function (id) { return !w.rumors.some(function (r) { return r.loc === id; }); });
    if (!cands.length) return;
    var loc = this.pick(cands);
    if (truth && !this.cluesLeftAt(loc)) truth = false;
    w.rumors.push({ loc: loc, truth: truth, confirmed: false });
    this.addLog('hint', 'A rumor spreads: something is waiting at ' + D.locations[loc].name + '. (Investigate there to learn if it is true.)', { d: { k: 'rumor' } });
    this.say(ctx, 'A rumor spreads.', 'info');
  };

  M.cleanseCurse = function (id, p, ctx) {
    var w = this.w;
    if (!w.curses[id]) return;
    delete w.curses[id]; w.cleansed[id] = true;
    this.addLog('story', D.curses[id].name + ' is lifted.', { p: p && p.id, d: { k: 'cleanse' } });
    this.say(ctx, D.curses[id].name + ' is lifted.', 'info');
    this.chip(ctx, 'cleanse', 1, 'Curse lifted', 'good');
  };

  M.rescueAlly = function (id, p, ctx) {
    var w = this.w;
    if (w.allies[id]) return;
    w.allies[id] = true; w.allyBy[id] = p.id;
    var a = D.allies[id];
    this.addLog('story', p.name + ' brings ' + a.name + ' to safety. ' + a.text + ' Boon: ' + a.boon, { p: p.id, d: { k: 'ally' } });
    this.chip(ctx, 'ally', 1, 'Ally: ' + a.name, 'good');
  };

  M.revive = function (target, by, ctx) {
    var w = this.w;
    if (target.status !== 'fallen' || w.revivals >= 2) return;
    w.revivals++;
    target.status = 'alive'; target.vit = Math.min(target.maxVit, 3); target.san = Math.min(target.maxSan, 3); target.loc = target.fellLoc || by.loc;
    target.sts = { marked: 1 };
    this.addLog('story', target.name + ' returns to the living, furious and cold.', { p: target.id, d: { k: 'revive' } });
    if (this.turn && this.phase === 'playing' && this.turn.order.indexOf(target.id) < 0) this.turn.order.push(target.id);
    this.chip(ctx, 'revive', 1, 'Returned: ' + target.name, 'good');
  };

  M.forcedMove = function (p, to, ctx) {
    var w = this.w, dest = to;
    if (to.indexOf('random:') === 0) {
      var region = to.slice(7);
      var c = Object.keys(D.locations).filter(function (id) { return D.locations[id].region === region && id !== p.loc && w.locs[id].seen && !D.locations[id].boss && !w.enemies.some(function (e) { return e.loc === id && !e.dead; }); });
      if (!c.length) return;
      dest = this.pick(c);
    }
    this.say(ctx, 'You are carried to ' + D.locations[dest].name + '.', 'info');
    if (this.turn && this.turn.enc && this.turn.enc.pid === p.id) this.turn.enc.moved = true;
    this.moveTo(p, dest, 'forced', null);
  };

  M.escapeHollow = function (p, ctx) {
    p.status = 'escaped'; p.escapedRound = this.w.round;
    this.addLog('story', p.name + ' walks through the Escape Gate and does not look back.', { p: p.id, d: { k: 'escape' } });
  };
  M.afterEscape = function (p) {
    if (this.turn && this.turn.active === p.id) { this.closeEnc(p, true); this.checkEnd(); if (this.phase === 'playing') this.advanceTurn(); }
  };

  H.mixin(M);
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
