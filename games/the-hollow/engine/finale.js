/*! THE HOLLOW — finale: the Abbey Warden, the final vote and endings, objectives, legacies, spirits, and the ghost-hand that plays for absent players. */
(function (g) {
  'use strict';
  var H = g.HollowEngine, D = g.HollowData, util = H.util, C = H.CFG;
  var M = {};
  var STAT_NAME = { might: 'Might', wit: 'Wit', fate: 'Fate' };

  // ───────────────────────────── the Abbey Warden ─────────────────────────────
  M.bossPhase = function () {
    var ch = this.w.boss.chains;
    return D.boss.phases.find(function (ph) { return ph.chains === ch; }) || D.boss.phases[3];
  };

  // Several ways to take him down: break the chains, strike, speak the bell's name, perform the library rite,
  // bring down the cracked vault, remind him of his oath, or slip past. Earlier chapters feed these options.
  M.bossOptions = function (p) {
    var w = this.w, ch = w.boss.chains;
    return [
      { id: 'chain', label: 'Break a chain', stat: 'might', dc: 14, hide: ch <= 0 ? {} : null, stakes: 'Each chain you break weakens his blows and armour. Fail: the chain lashes back.',
        ok: { t: 'You put your whole weight into a link. It parts with a note like a dropped church bell, and he sags.', chain: 1, hurt: 1 },
        crit: { t: 'The chain whips free and the stone it was anchored in comes with it.', hurt: 1, xp: 1 },
        fail: { t: 'The chain whips back across your ribs. He did not even look down.', vit: -2 } },
      { id: 'strike', label: ch > 0 ? 'Strike the bound Warden' : 'Strike the freed Warden', stat: 'might', dc: ch > 0 ? 17 : 13, stakes: ch > 0 ? 'Very hard while he is chained. Break a chain first.' : 'With the chains gone, he is open.',
        ok: { t: ch > 0 ? 'The iron barely marks. But it marks.' : 'You find a seam in the armour and slide the whole of your weapon into it.', hurt: ch > 0 ? 1 : 2 },
        fail: { t: 'You strike iron with flesh. The result is predictable.', vit: -2 } },
      { id: 'name', label: 'Speak the bell\'s true name', req: { flag: 'bell_named' }, stat: 'fate', dc: 11, spirit: true, stakes: 'You know the bell\'s true name. Fail: he hears you and the name stings.',
        ok: { t: 'You say it. Every chain in the room rings the same note, and one of them gives. "That is the bell," he says, wonderingly, "that is my bell."', hurt: 4, chain: 1, xp: 1 },
        fail: { t: 'You say it too softly. The room does not appreciate being addressed by its secret.', san: -2 } },
      { id: 'rite', label: 'Complete the banishing rite', req: { all: [{ flag: 'rite_ready' }, { clue: 'silence_rite' }] }, once: 'party', stat: 'wit', dc: 12, stakes: 'You prepared the Ritual Chamber and learned the Rite of Silence. Fail: the words fight back.',
        ok: { t: 'You read the rite aloud, in the right order, over the right candles. Chains, one by one, stop being chains.', hurt: 5, chain: 2, xp: 2 },
        fail: { t: 'You lose your place. The Warden does not.', san: -2, vit: -1 } },
      { id: 'pillars', label: 'Bring down the cracked vault', req: { flag: 'abbey_pillars_cracked' }, once: 'party', stat: 'wit', dc: 11, stakes: 'You cracked the keystone. Everyone in the lair takes some of the fall.',
        ok: { t: 'You ping a pillar with the pommel of a knife and the whole vault sighs. Masonry in a slow and terrible rain.', hurt: 4, vit: -2, xp: 1 },
        fail: { t: 'You time it badly. The vault lands where you were standing.', vit: -3 } },
      { id: 'oath', label: 'Remind him of his oath', req: { clue: 'warden_oath' }, stat: 'fate', dc: 15, spirit: true, mods: [{ if: { flag: 'spirit_freed' }, d: -2, why: 'The lost spirit stands with you' }, { if: { ally: 'tamsin' }, d: -1, why: 'Tamsin\'s voice carries' }],
        stakes: 'The echoes told you what he swore. Success ends the fight without bloodshed. Fail: he hears the shame in it.',
        ok: { t: '"You swore to guard the stair until the bell was silent," you say. "Is it silent?" He is quiet for a very long time. "No," he says. "Then," you say, "we have the same work." He kneels. The chains fall slack. He gives you the key.', kill: true, flag: 'warden_oathkept', glory: 3, xp: 2 },
        fail: { t: 'The words do not reach him; the shame does. He strikes the floor with the flat of his hand.', san: -2, vit: -1 } },
      { id: 'blade', label: 'Cut with the Grave-Iron Blade', req: { equipped: 'blade' }, stat: 'might', dc: 15, stakes: 'Grave-iron on grave-iron. Fail: it rings in your teeth.',
        ok: { t: 'The blade bites. He roars as old iron comes loose from him in curls.', hurt: 3 },
        fail: { t: 'The blade skips off his pauldron and into the floor. The shock climbs your arm.', vit: -2 } },
      { id: 'slip', label: 'Slip past him while he is bound', stat: 'wit', dc: 16, hide: ch <= 0 ? {} : null, stakes: 'He is not defeated, but the stair opens for the party. Fail: he notices.',
        ok: { t: 'He is bound, not blind. You pick the one moment in his breathing when the chain-song goes quiet, and walk. When you glance back, he is looking at you with the exhausted eyes of a man who did not see anything.', flag: 'warden_bypassed', xp: 2, glory: 1 },
        fail: { t: 'He turns his head to follow you, and the chain-song swells into a roar.', vit: -3 } }
    ].filter(function (o) { return !(o.hide && Object.keys(o.hide).length === 0); });
  };

  M.bossRetaliate = function (p, enc, ctx) {
    var w = this.w;
    if (w.boss.hp <= 0 && !w.boss.dead) { this.defeatBoss(p, ctx); enc.over = true; return; }
    if (w.boss.dead) { enc.over = true; return; }
    if (w.flags.warden_bypassed && ctx.opt && ctx.opt.id === 'slip') return;
    var ph = this.bossPhase(), a = ph.attack;
    this.addLog('boss', 'The Warden answers (' + ph.name + '): ' + ph.text, { p: p.id, d: { k: 'boss', phase: ph.name } });
    if (a.vit) this.hurt(p, 'vit', -a.vit, { src: 'boss' });
    if (a.san && p.status === 'alive') this.hurt(p, 'san', -a.san, { src: 'boss', spirit: true });
  };

  M.defeatBoss = function (p, ctx) {
    var w = this.w, peaceful = !!w.flags.warden_oathkept;
    w.boss.dead = true; w.boss.hp = 0; w.flags.warden_down = true;
    this.addLog('boss', peaceful ? 'The Abbey Warden lays down his oath. The stair below is open.' : 'The Abbey Warden falls, and the Abbey exhales.', { p: p.id, d: { k: 'bossdown' } });
    this.here(p.loc).forEach(function (x) { this.gainXp(x, peaceful ? 5 : D.xpValues.boss, x === p ? ctx : null); }, this);
    p.glory += peaceful ? 3 : 4; p.tally.glory += peaceful ? 3 : 4;
    this.addItem(p, 'wardens_key', 1);
    this.chip(ctx, 'item', 1, '+ Warden\'s Key', 'good');
    this.say(ctx, peaceful ? 'He presses the Warden\'s Key into your hand and sits down against the wall like a man at last off duty.' : 'The key to the Nameless Door lies in the wreck of his gauntlet.', 'story');
  };

  // ───────────────────────────── the finale ─────────────────────────────
  // Who is at the Heart, and with what strength?
  M.finaleCrew = function () {
    return this.players.filter(function (p) { return p.status === 'alive' && p.loc === 'heart_chamber'; });
  };

  M.finaleInfo = function (eid) {
    var w = this.w, e = D.endings[eid], crew = this.finaleCrew(), self = this;
    var out = { id: eid, name: e.name, pitch: e.pitch, stat: e.stat, dc: e.dc, needsText: e.needsText || '', available: true, why: '', mods: [], mod: 0, chance: null, roller: null };
    if (e.needs && !this.test(e.needs, null)) { out.available = false; out.why = e.needsText; }
    if (!crew.length) { out.available = false; out.why = 'Someone must be standing in the Heart Chamber.'; }
    if (e.stat) {
      var best = null;
      crew.forEach(function (p) { var v = self.baseStat(p, e.stat) + (p.sts.cursed ? -1 : 0) + (p.sts.blessed ? 2 : 0); if (!best || v > best.v) best = { p: p, v: v }; });
      var add = function (l, v) { if (v) { out.mods.push({ l: l, v: v }); out.mod += v; } };
      if (best) { add(best.p.name + ' leads (' + STAT_NAME[e.stat] + ')', best.v); out.roller = best.p.id; }
      e.mods.forEach(function (m) { if (self.test(m.if, null)) add(m.why, m.d); });
      var allies = Object.keys(w.allies).filter(function (k) { return w.allies[k]; }).length;
      add('Allies at your side', Math.min(3, allies));
      add('Pillars of truth understood', Math.min(2, Object.keys(D.pillars).filter(function (k) { return self.pillarDone(k); }).length));
      add('Others in the circle', Math.min(2, Math.max(0, crew.length - 1)));
      if (w.flags.lake_seen) add('The Lake showed you how it ends', 1);
      add('Unresolved curses', -Math.min(3, Object.keys(w.curses).length));
      var dc = e.dc;
      if (w.haunt === 3) out.mods.push({ l: 'The Hollow is awake (+1 DC)', v: 0 }), dc += 1;
      out.dc = dc;
      var wins = 0; for (var d = 1; d <= 20; d++) if (d === 20 || (d !== 1 && d + out.mod >= dc)) wins++;
      out.chance = Math.round(wins / 20 * 100);
      var wf = 0; for (var d2 = 2; d2 <= 20; d2++) if (d2 + out.mod >= dc - 4) wf++;
      out.chanceOk = Math.round(wins / 20 * 100); out.chanceFlawed = Math.round(Math.max(0, wf - wins) / 20 * 100);
    } else if (eid === 'bargain') {
      out.fair = this.sharedClues().indexOf('pact_terms') >= 0 || this.players.some(function (p) { return p.flags.pact && p.status === 'alive'; });
      out.pitch2 = out.fair ? 'You know its terms. The price will be fair.' : 'You do not know its terms. It will be careful to be fair, which is worse.';
    }
    return out;
  };

  M.cmd_propose = function (p, c) {
    var w = this.w;
    if (this.phase !== 'playing') return { error: 'The expedition is not under way.' };
    if (p.status !== 'alive' || p.loc !== 'heart_chamber') return { error: 'You must be standing in the Heart Chamber.' };
    if (w.vote) return { error: 'The table is already deciding.' };
    var e = D.endings[c.ending];
    if (!e || ['silence', 'reverse', 'bargain', 'destroy'].indexOf(c.ending) < 0) return { error: 'Choose an ending.' };
    var info = this.finaleInfo(c.ending);
    if (!info.available) return { error: info.why || 'That ending is not open to you.' };
    w.vote = { ending: c.ending, by: p.id, yes: [p.id], no: [], deadline: this.now() + C.voteSec * 1000 };
    this.players.forEach(function (b) { if (b.bot && b.id !== p.id && (b.status === 'alive' || b.status === 'fallen')) w.vote.yes.push(b.id); });
    this.addLog('vote', p.name + ' proposes: ' + e.name + '. The party must agree.', { p: p.id, d: { k: 'vote' } });
    this.checkVote();
    return { ok: true };
  };

  M.voters = function () {
    return this.players.filter(function (x) { return (x.status === 'alive' || x.status === 'fallen') && (x.connected || x.bot); });
  };
  M.cmd_vote = function (p, c) {
    var w = this.w, v = w.vote;
    if (!v) return { error: 'There is nothing to vote on.' };
    if (p.status !== 'alive' && p.status !== 'fallen') return { error: 'You have left the Hollow.' };
    v.yes = v.yes.filter(function (x) { return x !== p.id; }); v.no = v.no.filter(function (x) { return x !== p.id; });
    (c.yes ? v.yes : v.no).push(p.id);
    this.addLog('vote', p.name + (c.yes ? ' agrees.' : ' refuses.'), { p: p.id });
    this.checkVote();
    return { ok: true };
  };
  M.cmd_cancelvote = function (p) {
    var v = this.w.vote;
    if (!v || v.by !== p.id) return { error: 'Only the proposer can withdraw it.' };
    this.w.vote = null; this.addLog('vote', p.name + ' withdraws the proposal.', { p: p.id });
    return { ok: true };
  };
  M.checkVote = function () {
    var v = this.w.vote; if (!v) return;
    var el = this.voters(), n = el.length, half = n / 2;
    var yes = v.yes.filter(function (id) { return el.some(function (x) { return x.id === id; }); }).length;
    var no = v.no.filter(function (id) { return el.some(function (x) { return x.id === id; }); }).length;
    if (yes > half) this.settleVote(false, true);
    else if (no >= half && no > 0) this.settleVote(false, false);
    else if (yes + no >= n) this.settleVote(false, yes > no);
  };
  M.settleVote = function (timeout, pass) {
    var v = this.w.vote; if (!v) return;
    if (timeout) {
      var el = this.voters(); var yes = v.yes.filter(function (id) { return el.some(function (x) { return x.id === id; }); }).length;
      var no = v.no.filter(function (id) { return el.some(function (x) { return x.id === id; }); }).length;
      pass = yes > no;
    }
    this.w.vote = null;
    if (!pass) { this.addLog('vote', 'The table does not agree. The bell goes on ringing.', {}); return; }
    this.runFinale(v.ending, this.get(v.by));
  };

  M.runFinale = function (eid, proposer) {
    var w = this.w, e = D.endings[eid], info = this.finaleInfo(eid), crew = this.finaleCrew();
    if (!crew.length) { this.addLog('vote', 'No one is left standing in the Heart.', {}); return; }
    var grade, roll = null, self = this;
    if (e.stat) {
      var d = this.d20(), total = d + info.mod;
      grade = d === 20 || (d !== 1 && total >= info.dc) ? 'true' : (d !== 1 && total >= info.dc - 4 ? 'flawed' : 'failed');
      roll = { d: d, mod: info.mod, total: total, dc: info.dc, tier: grade === 'true' ? (d === 20 ? 'crit' : 'ok') : (d === 1 ? 'fumble' : 'fail'), stat: e.stat, mods: info.mods };
      this.addLog('result', 'THE FINAL TOLL — ' + e.name + ': rolled ' + d + ' (' + total + ' vs ' + info.dc + ') — ' + ({ true: 'it holds.', flawed: 'it cracks, but holds.', failed: 'it breaks wrong.' })[grade], { d: { result: { opt: e.name, tier: roll.tier, roll: roll, lines: [], chips: [], n: this.n + 1, by: 'party', finale: true } } });
    } else {
      grade = eid === 'bargain' ? (info.fair ? 'true' : 'flawed') : 'true';
    }
    var res = e.results[grade];
    // the price of the ending
    var bound = [], lost = [];
    if (eid === 'bargain') {
      var pb = crew.filter(function (p) { return p.flags.pact; })[0];
      bound.push(pb || (grade === 'true' ? proposer : this.pick(crew)));
    } else if (eid === 'silence' && grade === 'flawed') bound.push(this.pick(crew));
    else if (eid === 'silence' && grade === 'failed') lost.push(this.pick(crew));
    else if (eid === 'reverse' && grade === 'failed') crew.forEach(function (p) { self.hurt(p, 'vit', 3, { raw: true }); self.hurt(p, 'san', 2, { raw: true }); });
    else if (eid === 'destroy' && grade === 'failed') crew.forEach(function (p) { self.hurt(p, 'vit', 4, { raw: true }); });
    bound.forEach(function (p) { if (p) p.fate = 'bound'; });
    lost.forEach(function (p) { if (p) { p.status = 'lost'; p.fate = 'lost'; } });
    this.finish(res, eid, grade, roll, proposer);
  };

  M.finish = function (res, eid, grade, roll, proposer) {
    var w = this.w;
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    w.vote = null;
    var out = this.expeditionOutcome(res.outcome);
    this.ended = { id: res.id, endingKey: eid, grade: grade, title: res.title, outcome: out, text: res.text, roll: roll, by: proposer ? proposer.id : null, round: w.round, clock: w.clock };
    this.ended.results = this.buildResults();
    this.addLog('ending', res.title + ' — ' + ({ success: 'The expedition succeeds.', partial: 'A partial victory.', failure: 'The expedition fails.', unresolved: 'The mystery is unresolved.' })[out], { d: { k: 'ending', id: res.id, outcome: out } });
    this.turn = null;
  };
  M.expeditionOutcome = function (o) { return o; };

  M.checkEnd = function () {
    var w = this.w;
    if (this.phase !== 'playing') return;
    if (w.clock >= C.clockMax) { this.finish(D.endings.doom.results.true, 'doom', 'true', null, null); return; }
    var alive = this.living();
    if (alive.length) return;
    var fallen = this.players.filter(function (p) { return p.status === 'fallen'; });
    var escaped = this.players.filter(function (p) { return p.status === 'escaped'; });
    var canReturn = fallen.some(function (p) { return p.returns > 0; }) || (fallen.length && w.revivals < 2 && this.players.some(function (p) { return p.status === 'alive'; }));
    if (!fallen.length || (!canReturn) || w.allFallen >= 3) {
      if (escaped.length) {
        var wise = this.sharedClues().length >= 6;
        this.finish(D.endings.escape.results[wise ? 'true' : 'flawed'], 'escape', wise ? 'true' : 'flawed', null, escaped[0]);
      } else this.finish(D.endings.wipe.results.true, 'wipe', 'true', null, null);
    }
  };

  // ───────────────────────────── objectives and legacies ─────────────────────────────
  M.objectiveCtx = function (p) {
    var w = this.w, self = this;
    var regions = {};
    p.found.forEach(function (id) { var c = w.clues[id]; if (c && c.loc) regions[D.locations[c.loc].region] = true; });
    return {
      p: p, w: w, alive: p.status === 'alive' || p.status === 'escaped',
      relicsHeld: this.relicsHeld(p), cluesFound: p.found.length, cluesRegions: Object.keys(regions).length,
      visitedCount: Object.keys(p.visited).length, has: function (id) { return self.hasItem(p, id); }
    };
  };
  M.objectiveText = function (p) {
    var o = D.objectives[p.objective], t = o.text;
    if (p.objective === 'unmaker') t = t.replace('{curse}', D.curses[p.objParam].name);
    if (p.objective === 'opportunist') t = t.replace('{relic}', D.items[p.objParam].name);
    return t;
  };
  M.objectiveDone = function (p) { return !!D.objectives[p.objective].check(this.objectiveCtx(p)); };

  var TITLES = { collector: 'Hoarder of Holy Things', truthseeker: 'Keeper of the True Account', survivor: 'The One Who Walked Out', pactbound: 'The Clerk\'s Favourite', redeemer: 'Friend of the Lost', unmaker: 'Curse-Breaker', opportunist: 'The Lucky Thief', wanderer: 'Cartographer of the Dead' };
  var FATE_LINE = {
    survived: { success: 'walks out of the Hollow into a morning that has no bell in it.', partial: 'walks out of the Hollow carrying something that will not be put down.', failure: 'is carried out of the Hollow by the others, and does not speak for a long time.', unresolved: 'walks out into rain and does not look back.' },
    escaped: { success: 'left early through the Gate, and heard the bell stop from the road.', partial: 'left early through the Gate, and heard the Hollow settle behind them.', failure: 'left early through the Gate, and heard it all end badly, a long way off.', unresolved: 'left through the Gate and kept the road.' },
    fallen: { success: 'did not leave, but the bell is silent, and that is some kind of company.', partial: 'did not leave. They are in the Hollow still, and not unhappy with the arrangement.', failure: 'did not leave. The Hollow keeps what it takes.', unresolved: 'did not leave. The road was a long way and they were tired.' },
    lost: { success: 'was taken at the last toll, and the bell\'s silence has their name in it.', partial: 'was taken at the last toll.', failure: 'was taken at the last toll.', unresolved: 'was taken.' },
    bound: { success: 'stayed to keep the list, and is not unhappy to be remembered.', partial: 'stayed, bound to the Remembrancer\'s ledger. The terms were fair. The terms were fair.', failure: 'is bound to the ledger now, a clean line in a long column.', unresolved: 'is bound.' }
  };
  var CLASS_LINE = {
    occultist: { good: 'The eighth page was a mirror. Isolde keeps it in the margin of every book she opens.', bad: 'The eighth page was blank. Isolde keeps looking for it in the margins of everything.' },
    hunter: { good: 'Corvin found two of the hounds. The third he will not describe, but he leaves the porch light on.', bad: 'Corvin whistles every night at the edge of the woods. Something whistles back, once, and sounds almost like a dog.' },
    apothecary: { good: 'Maelis writes her own name at the top of the ledger and, under it, nothing owed.', bad: 'Maelis sells her tinctures from a cart now. Some customers come at night, and pay in names.' },
    medium: { good: 'The bell stopped asking Wren to say something. She said it. It has not asked again.', bad: 'The bell asks Wren a question every night. She has stopped answering. It has not stopped asking.' },
    vagabond: { good: 'Jory kept the grave-silver, and a story, and something worth more than either: nobody knows where he lives.', bad: 'Jory kept moving. The Hollow is the first place that did not let him leave quite as he arrived.' },
    exorcist: { good: 'Anselm\'s breviary stopped writing itself. The last page it wrote says only: "Well sealed."', bad: 'Anselm\'s breviary has begun a new page. The first line is his name. The second line is a date, not far off.' }
  };
  var DEED_LINES = [
    [function (c) { return c.p.tally.aids >= 3; }, 'The others will remember who stayed when it counted.'],
    [function (c) { return c.p.tally.clues >= 5; }, 'They found the truth in pieces, and carried every one.'],
    [function (c) { return c.p.tally.kills >= 3; }, 'The things they put down stay down, mostly.'],
    [function (c) { return c.w.flags.chapel_robbed && c.p.tally.glory <= 0; }, 'The Chapel\'s plate was never put back. Some debts keep.'],
    [function (c) { return c.w.flags.merchant_robbed; }, 'Pell, the merchant, sells lamps to the dead and keeps a ledger of thieves. Yours is the second page.'],
    [function (c) { return c.w.flags.garden_burned; }, 'The Witch\'s Garden is ash. The wind carries its smell down every road they take.'],
    [function (c) { return c.w.flags.shrine_destroyed; }, 'Something listened through that shrine for forty years. It is quieter now, and angrier.'],
    [function (c) { return c.w.flags.spirit_freed; }, 'Somewhere under the Abbey, a woman called Thea stopped apologising.'],
    [function (c) { return c.w.allies.tamsin; }, 'Tamsin Greaves is eleven and sleeps with the window open, so she can hear the bell is not ringing.'],
    [function (c) { return c.w.allies.hob; }, 'Hob Marl got his hatchet back. He keeps it by the door and has stopped being on any list.']
  ];
  M.epilogue = function (p, fate, outcome, done) {
    var w = this.w, ctx = this.objectiveCtx(p), good = outcome === 'success' || (outcome === 'partial' && done);
    var parts = [];
    parts.push(p.name + ' ' + FATE_LINE[fate][outcome] );
    parts.push(CLASS_LINE[p.cls][good ? 'good' : 'bad']);
    if (done) parts.push('They finished what they came for: ' + D.objectives[p.objective].name.replace('The ', 'the ') + ' kept the vow.');
    else parts.push('What they came for, ' + D.objectives[p.objective].name.replace('The ', 'the ') + ', went unfinished.');
    var deeds = DEED_LINES.filter(function (d) { return d[0](ctx); }).slice(0, 2).map(function (d) { return d[1]; });
    return parts.concat(deeds).join(' ');
  };

  M.buildResults = function () {
    var w = this.w, self = this, o = this.ended ? this.ended.outcome : null;
    var outcome = o || 'unresolved';
    return this.players.map(function (p) {
      var fate = p.fate || (p.status === 'alive' ? 'survived' : p.status === 'escaped' ? 'escaped' : p.status === 'lost' ? 'lost' : 'fallen');
      var done = self.objectiveDone(p);
      var bonus = [];
      if (p.status === 'alive' || p.status === 'escaped') bonus.push({ l: 'Left the Hollow alive', v: 3 });
      if (done) bonus.push({ l: 'Personal objective', v: 8 });
      var allies = Object.keys(w.allyBy).filter(function (k) { return w.allyBy[k] === p.id && w.allies[k]; });
      if (allies.length) bonus.push({ l: 'Allies rescued (' + allies.length + ')', v: allies.length * 2 });
      var relics = p.inv.filter(function (e) { return D.items[e.id].kind === 'relic' || e.id === 'moonrelic'; }).map(function (e) { return D.items[e.id].name; });
      if (relics.length && (p.status === 'alive' || p.status === 'escaped')) bonus.push({ l: 'Relics carried out (' + relics.length + ')', v: relics.length });
      var ob = { success: 6, partial: 3, unresolved: 1, failure: 0 }[outcome];
      if (ob && p.status !== 'lost') bonus.push({ l: 'Expedition ' + outcome, v: ob });
      var total = p.glory + util.sum(bonus.map(function (b) { return b.v; }));
      var title = done ? TITLES[p.objective] : (fate === 'bound' ? 'The Name in the Ledger' : fate === 'fallen' ? 'A Voice in the Hollow' : fate === 'escaped' ? 'Wise Enough to Leave' : D.classes[p.cls].title);
      return {
        id: p.id, name: p.name, cls: p.cls, fate: fate, level: p.level, vit: p.vit, san: p.san,
        objective: { id: p.objective, name: D.objectives[p.objective].name, text: self.objectiveText(p), done: done },
        glory: { earned: p.glory, bonus: bonus, total: total }, relics: relics, allies: allies.map(function (k) { return D.allies[k].name; }),
        clues: p.found.map(function (id) { return D.clues[id].title; }), title: title, epilogue: self.epilogue(p, fate, outcome, done), tally: p.tally
      };
    });
  };

  // ───────────────────────────── spirits: the fallen still matter ─────────────────────────────
  M.cmd_spirit = function (p, c) {
    var w = this.w;
    if (this.phase !== 'playing') return { error: 'The expedition is not under way.' };
    if (p.status !== 'fallen') return { error: 'Only the fallen can do this.' };
    if (p.spiritRound === w.round) return { error: 'You have already reached across this round.' };
    var kind = c.kind;
    if (kind === 'whisper') {
      if (w.whispers >= 6) return { error: 'The veil is worn thin. The spirits have whispered all they can.' };
      var keys = Object.keys(D.secrets).filter(function (k) { return ['bellName', 'heartName', 'sigil', 'star', 'shelf', 'mirror', 'fountain', 'grave', 'herb'].indexOf(k) >= 0 && !w.solved[k]; });
      if (!keys.length) return { error: 'There is nothing left to whisper about.' };
      w.whispers++; this.hint(this.pick(keys), null);
      this.addLog('story', p.name + ' whispers across the veil. It helps.', { p: p.id, d: { k: 'spirit' } });
    } else if (kind === 'chill') {
      var en = w.enemies.find(function (e) { return e.uid === c.target && !e.dead; });
      if (!en || en.hp <= 1) return { error: 'You cannot weaken that.' };
      en.hp -= 1; this.addLog('story', p.name + ' chills the ' + D.enemies[en.id].name + ' from the other side.', { p: p.id, d: { k: 'spirit' } });
    } else if (kind === 'lend') {
      if (w.spiritAid) return { error: 'Another spirit is already lending strength.' };
      w.spiritAid = { by: p.id };
      this.addLog('story', p.name + ' lends their strength to the next roll.', { p: p.id, d: { k: 'spirit' } });
    } else if (kind === 'return') {
      if (p.returns <= 0) return { error: 'You cannot return again. You may still help from beyond.' };
      var pals = this.here(p.fellLoc || p.loc).length;
      var info = this.rollInfo(p, { id: 'return', stat: 'fate', dc: 14, noScale: true, bonus: [{ if: {}, b: Math.min(2, pals), why: 'Allies at the place you fell' }] }, {});
      var roll = this.roll(p, info);
      var ok = roll.tier === 'ok' || roll.tier === 'crit';
      this.addLog('result', p.name + ' attempts to return — rolled ' + roll.d + ' (' + roll.total + ' vs ' + roll.dc + ') — ' + (ok ? 'it works.' : 'the veil holds.'), { p: p.id, d: { result: { opt: 'Return from the Fallen', tier: roll.tier, roll: roll, lines: [], chips: [], n: this.n + 1, by: p.id } } });
      p.spiritRound = w.round;
      if (ok) {
        p.returns--; p.status = 'alive'; p.maxVit = Math.max(4, p.maxVit - 1); p.maxSan = Math.max(4, p.maxSan - 1); p.vit = 2; p.san = 2; p.loc = p.fellLoc || p.loc; p.sts = { cursed: 1 };
        this.addLog('story', p.name + ' opens their eyes. They are alive, and scarred in a way that does not show.', { p: p.id, d: { k: 'revive' } });
        if (this.turn && this.turn.order.indexOf(p.id) < 0) this.turn.order.push(p.id);
      } else this.advanceClock(1, 'The failed return stirs the Hollow.');
      return { ok: true, roll: roll };
    } else return { error: 'Choose a spirit action.' };
    p.spiritRound = w.round;
    return { ok: true };
  };

  // ───────────────────────────── the ghost-hand: plays for absent players ─────────────────────────────
  M.autoEncStep = function (p) {
    var t = this.turn, enc = t.enc, self = this;
    if (enc.hold) { this.cmd_accept(p); return true; }
    var opts = this.encOptions(p, enc).filter(function (x) { return x.ev.state === 'ok' && x.ev.ap <= t.ap && !x.ev.confirm && !x.raw.needsTarget; });
    // never spend the last of our resources
    opts = opts.filter(function (x) { var c = x.ev.cost; return !c || (!c.san && !c.vit && !c.maxvit && (!c.silver || p.silver > c.silver + 1)); });
    var safe = enc.kind === 'enemy' || enc.kind === 'boss';
    var best = null, bs = -1;
    opts.forEach(function (x) {
      var s;
      if (x.ev.kind === 'puzzle') { s = 55; }
      else if (x.ev.kind === 'check') s = x.ev.chance + (x.ev.weak ? 20 : 0);
      else s = x.raw.shop ? 10 : 60;
      if (x.raw.shop) s = 5;
      if (safe && x.ev.kind === 'auto') s += 40;
      if (s > bs) { bs = s; best = x; }
    });
    if (!best || (safe && bs < 25 && enc.kind === 'enemy')) {
      if (enc.kind === 'enemy' || enc.kind === 'boss') {
        // retreat along any open road
        var mv = this.moveOptions(p).filter(function (m) { return m.ok; }).sort(function (a, b) { return (a.to === p.prevLoc ? -1 : 0) - (b.to === p.prevLoc ? -1 : 0); })[0];
        if (mv && t.ap > 0) { this.cmd_move(p, { mode: 'step', to: mv.to }); return true; }
      }
      this.closeEnc(p, true); enc.over = true; return false;
    }
    var cmd = { t: 'choose', enc: enc.id, opt: best.raw.id };
    if (best.ev.puzzle) {
      var chips = best.ev.puzzle.chips.filter(function (c2) { return !c2.out && (c2.can !== false); });
      if (!chips.length) { this.closeEnc(p, true); return false; }
      cmd.val = this.pick(chips).v;
    }
    var r = this.cmd_choose(p, cmd);
    if (r.error) { this.closeEnc(p, true); return false; }
    return true;
  };

  M.autoTurn = function (p) {
    var guard = 0, self = this, w = this.w;
    while (this.phase === 'playing' && this.turn && this.turn.active === p.id && p.status === 'alive' && guard++ < 40) {
      var t = this.turn;
      if (p.pendingLevels && p.offer) { this.cmd_levelup(p, { pick: p.offer[0] }); continue; }
      if (t.enc) {
        if (t.enc.over || t.enc.closeAfter) { this.closeEnc(p, true); continue; }
        if (this.autoEncStep(p)) continue;
        if (this.turn.enc) this.closeEnc(p, true);
        continue;
      }
      if (p.vit <= p.maxVit * 0.4 && this.hasItem(p, 'tonic')) { this.cmd_use(p, { item: 'tonic' }); continue; }
      if (p.san <= 3 && this.hasItem(p, 'salt') && !p.ward) { this.cmd_use(p, { item: 'salt' }); continue; }
      if (t.ap <= 0) break;
      if (!this.autoAct(p)) break;
    }
    if (this.phase === 'playing' && this.turn && this.turn.active === p.id && p.status === 'alive') this.endTurnFor(p);
    else this.settleTurn();
  };

  M.autoAct = function (p) {
    var t = this.turn, w = this.w, self = this, loc = p.loc;
    p.auto = p.auto || {};
    // the final act
    if (loc === 'heart_chamber' && !w.vote) {
      var pick = ['silence', 'reverse', 'bargain', 'destroy'].map(function (e) { return self.finaleInfo(e); }).filter(function (i) { return i.available; })[0];
      if (pick && (w.haunt === 3 || pick.id !== 'destroy')) { this.cmd_propose(p, { ending: pick.id }); if (this.w.vote) this.cmd_vote(p, { yes: true }); return false; }
    }
    // 1. try what is here
    if (!p.auto[loc + ':' + w.round]) {
      p.auto[loc + ':' + w.round] = true;
      var enc = this.openLocEnc(p);
      if (D.locations[loc].boss && !w.boss.dead) { this.closeEnc(p, true); this.openBossEnc(p); return true; }
      var any = this.encOptions(p, enc).some(function (x) { return x.ev.state === 'ok' && x.ev.ap <= t.ap && !x.ev.confirm && !x.raw.needsTarget && !x.raw.shop; });
      if (any) return true;
      this.closeEnc(p, true);
    }
    // 2. move on: nearest unfinished place, preferring deeper regions
    var order = ['village', 'woods', 'estate', 'abbey', 'crypt', 'heart'];
    var goals = Object.keys(D.locations).filter(function (id) {
      if (id === 'gate') return false;
      var L = w.locs[id]; if (!L.seen) return false;
      if (!L.visited) return true;
      if (id === 'heart_chamber' && w.haunt >= 2) return true;
      return false;
    });
    var best = null, bd = 1e9;
    goals.forEach(function (id) {
      var pth = self.path(loc, id, false);
      if (!pth) return;
      var score = pth.length * 2 - order.indexOf(D.locations[id].region) * 1.5 + self.rint(3);
      if (score < bd) { bd = score; best = pth; }
    });
    if (best && best.length) {
      var mv = this.moveOptions(p).find(function (m) { return m.to === best[0]; });
      if (mv && mv.ok) {
        var mode = best.length >= 2 && p.vit > p.maxVit * 0.5 && !w.enemies.some(function (e) { return e.loc === best[0] && !e.dead; }) ? 'sprint' : 'step';
        var r = mode === 'sprint' ? this.cmd_move(p, { mode: 'sprint', to: best[Math.min(1, best.length - 1)] }) : this.cmd_move(p, { mode: 'step', to: best[0] });
        if (!r.error) return true;
      }
    }
    // 3. open a road
    var lockedEdge = null, self2 = this;
    this.moveOptions(p).forEach(function (m) { if (!lockedEdge && m.state === 'locked') { var wy = (m.ways || []).find(function (x) { return x.ok && !x.flag; }); if (wy) lockedEdge = { key: m.key, way: wy.id }; } });
    if (lockedEdge) { var u = this.cmd_unlock(p, { edge: lockedEdge.key, way: lockedEdge.way }); if (!u.error) return true; }
    // 4. look around, wander, rest
    if (!p.auto['inv:' + loc]) { p.auto['inv:' + loc] = true; var iv = this.cmd_investigate(p); if (!iv.error) return true; }
    if (!this.restBlock(p) && (p.vit < p.maxVit - 2 || p.san < p.maxSan - 2)) { var rs = this.cmd_rest(p, { stat: p.vit / p.maxVit < p.san / p.maxSan ? 'vit' : 'san' }); if (!rs.error) return true; }
    var ex = this.cmd_explore(p); if (!ex.error) return true;
    var ec = this.cmd_echo(p); if (!ec.error) return true;
    // 5. wander to any open road
    var any2 = this.moveOptions(p).filter(function (m) { return m.ok && !m.enemy; });
    if (any2.length) { var rr = this.cmd_move(p, { mode: 'step', to: this.pick(any2).to }); if (!rr.error) return true; }
    return false;
  };

  H.mixin(M);
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
