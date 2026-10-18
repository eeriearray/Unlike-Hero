/*! THE HOLLOW — rules: checks, options, outcomes, inventory, damage, levels, abilities. See core.js for the overview. */
(function (g) {
  'use strict';
  var H = g.HollowEngine, D = g.HollowData, util = H.util, C = H.CFG;

  var STATS = ['might', 'wit', 'fate'];
  var STAT_NAME = { might: 'Might', wit: 'Wit', fate: 'Fate' };
  var DC_NAME = [[8, 'Easy'], [11, 'Standard'], [14, 'Difficult'], [17, 'Very difficult'], [99, 'Extreme']];
  H.dcName = function (dc) { for (var i = 0; i < DC_NAME.length; i++) if (dc <= DC_NAME[i][0]) return DC_NAME[i][1]; return 'Extreme'; };
  H.ABILITY_UP = {
    occultist: 'Twist Fate can be used twice per phase.', hunter: 'Set Snare has a cooldown of 1 round.', apothecary: 'Brew needs only 1 herb.',
    medium: 'Calm the Dead restores 3 Sanity and no longer advances the Clock.', vagabond: 'Slip Away can be used twice per phase.', exorcist: 'You gain 2 more rites of sealing.'
  };

  var M = {};

  // ───────────────────────────── conditions ─────────────────────────────
  // Used by req / show / hide / mods / bonus and by ending requirements. p may be null for party-level tests.
  M.test = function (c, p) {
    if (!c) return true;
    if (Array.isArray(c)) return c.every(function (x) { return this.test(x, p); }, this);
    var w = this.w, self = this;
    if (c.any) return c.any.some(function (x) { return self.test(x, p); });
    if (c.all) return c.all.every(function (x) { return self.test(x, p); });
    if (c.not) return !this.test(c.not, p);
    if (c.item && !(p ? this.hasItem(p, c.item) : this.partyHas(c.item))) return false;
    if (c.equipped && !(p && this.isEquipped(p, c.equipped))) return false;
    if (c.flag && !w.flags[c.flag]) return false;
    if (c.noflag && w.flags[c.noflag]) return false;
    if (c.pflag && !(p && p.flags[c.pflag])) return false;
    if (c.clue && !this.clueKnown(c.clue, p)) return false;
    if (c.cls && !(p && p.cls === c.cls)) return false;
    if (c.minPhase && w.haunt < c.minPhase) return false;
    if (c.maxPhase && w.haunt > c.maxPhase) return false;
    if (c.minSan != null && !(p && p.san >= c.minSan)) return false;
    if (c.maxSan != null && !(p && p.san <= c.maxSan)) return false;
    if (c.minVit != null && !(p && p.vit >= c.minVit)) return false;
    if (c.silver != null && !(p && p.silver >= c.silver)) return false;
    if (c.ally && !w.allies[c.ally]) return false;
    if (c.allyHere && !(p && this.here(p.loc).some(function (x) { return x.id !== p.id; }))) return false;
    if (c.secret && w.secrets[c.secret[0]] !== c.secret[1]) return false;
    if (c.pillar && !this.pillarDone(c.pillar)) return false;
    if (c.minClues != null && this.sharedClues().length < c.minClues) return false;
    if (c.status && !(p && p.sts[c.status])) return false;
    if (c.visited && !(w.locs[c.visited] && w.locs[c.visited].visited)) return false;
    if (c.curse && !w.curses[c.curse]) return false;
    return true;
  };

  M.describeReq = function (c) {
    if (!c) return '';
    if (c.item) return 'Needs ' + (D.items[c.item] ? D.items[c.item].name : c.item);
    if (c.equipped) return 'Needs ' + D.items[c.equipped].name + ' equipped';
    if (c.clue) return 'Needs a clue you have not found';
    if (c.allyHere) return 'Needs another living player here';
    if (c.flag || c.pflag) return 'Not yet possible';
    return 'Not available';
  };

  // ───────────────────────────── stats, items, packs ─────────────────────────────
  M.itemDef = function (id) { return D.items[id]; };
  M.hasItem = function (p, id) { return p.inv.some(function (e) { return e.id === id; }); };
  M.itemCount = function (p, id) { return p.inv.reduce(function (n, e) { return n + (e.id === id ? e.n : 0); }, 0); };
  M.partyHas = function (id) { return this.players.some(function (p) { return p.status === 'alive' && this.hasItem(p, id); }, this); };
  M.isEquipped = function (p, id) { return p.inv.some(function (e) { return e.id === id && e.eq; }); };
  M.packUsed = function (p) { return p.inv.reduce(function (n, e) { return n + (D.items[e.id].size || 1); }, 0); };
  M.relicsHeld = function (p) { return p.inv.filter(function (e) { var d = D.items[e.id]; return d.kind === 'relic' || e.id === 'moonrelic'; }).length; };

  M.addItem = function (p, id, n) {
    var d = D.items[id]; n = n || 1;
    if (!d) throw new Error('Unknown item ' + id);
    var added = 0;
    for (var k = 0; k < n; k++) {
      var stackMax = d.stack || 1, stackE = null;
      if (stackMax > 1) stackE = p.inv.find(function (e) { return e.id === id && e.n < stackMax; });
      if (stackE) { stackE.n++; added++; continue; }
      if (this.packUsed(p) + (d.size || 1) > C.packSize) { this.dropGround(p.loc, id, 1); continue; }
      var e = { id: id, n: 1 };
      if (d.uses) e.uses = d.uses;
      p.inv.push(e); added++;
      if (d.equip && !p.inv.some(function (x) { return x !== e && x.eq && D.items[x.id].kind === d.kind; })) e.eq = true;
    }
    if (added < n) this.addLog('item', p.name + '\'s pack is full. ' + (n - added) + '× ' + d.name + ' left on the ground here.', { p: p.id, loc: p.loc });
    return added;
  };
  M.removeItem = function (p, id, n) {
    n = n || 1;
    for (var i = p.inv.length - 1; i >= 0 && n > 0; i--) {
      var e = p.inv[i]; if (e.id !== id) continue;
      var take = Math.min(e.n, n); e.n -= take; n -= take;
      if (e.n <= 0) p.inv.splice(i, 1);
    }
    return n === 0;
  };
  M.dropGround = function (loc, id, n) {
    var L = this.w.locs[loc]; L.ground = L.ground || [];
    var s = L.ground.find(function (x) { return x.id === id; });
    if (s) s.n += n; else L.ground.push({ id: id, n: n });
  };

  M.baseStat = function (p, s) {
    var v = p.stats[s];
    p.inv.forEach(function (e) { var d = D.items[e.id]; if (d.mods && d.mods[s] && (d.kind === 'relic' || e.eq)) v += d.mods[s]; });
    return v;
  };

  // ───────────────────────────── the check ─────────────────────────────
  // Returns everything a player needs to see before committing, and everything the resolver needs.
  M.rollInfo = function (p, o, ctx) {
    ctx = ctx || {};
    var w = this.w, loc = D.locations[p.loc], enemy = ctx.enemy ? D.enemies[ctx.enemy.id] : null;
    var mods = [], s = o.stat;
    var add = function (l, v) { if (v) mods.push({ l: l, v: v }); };
    add(STAT_NAME[s], p.stats[s]);
    p.inv.forEach(function (e) { var d = D.items[e.id]; if (d.mods && d.mods[s] && (d.kind === 'relic' || e.eq)) add(d.name, d.mods[s]); });
    var occult = !!(loc && loc.occult);
    if (p.cls === 'occultist' && occult) add('Margin Notes', 2);
    if (p.cls === 'hunter' && occult && (s === 'wit' || s === 'fate')) add('Poor at the occult', -1);
    if (p.cls === 'hunter' && s === 'might' && ((enemy && (enemy.type === 'beast' || enemy.type === 'undead')) || o.beast || o.undead)) add('Tracker', 2);
    if (p.cls === 'medium' && s === 'fate' && ((enemy && enemy.type === 'spirit') || o.spirit)) add('Veil-sighted', 2);
    if (p.cls === 'exorcist' && s === 'fate' && loc && loc.kind === 'sanctuary') add('Sanctified', 1);
    if (p.cls === 'vagabond' && o.id === 'strike' && ctx.enemy) add('Poor in a fight', -1);
    if (s === 'might' && ctx.enemy && p.skills.indexOf('duelist') >= 0) add('Duelist\'s Poise', 1);
    if (s === 'might' && enemy && enemy.type === 'undead' && this.isEquipped(p, 'blade')) add('Grave-iron on the dead', 3);
    if (p.sts.blessed) add('Blessed', 2);
    if (p.sts.cursed) add('Cursed', -1);
    var frail = p.san <= p.maxSan * 0.25 ? 2 : (p.san <= p.maxSan * 0.5 ? 1 : 0);
    if (frail && (s === 'fate' || s === 'wit') && (o.spirit || occult)) add('Frayed nerves', -frail);
    if (ctx.aid) add('Allies lend a hand', ctx.aid);
    if (ctx.spiritAid) add('A spirit lends strength', ctx.spiritAid);
    if (enemy && ctx.enemy.known && ctx.enemy.weak === o.id) add('You know its weakness', 3);
    (o.bonus || []).forEach(function (b) { if (this.test(b.if, p)) add(b.why || 'Bonus', b.b); }, this);
    var extra = ctx.extraMods || [];
    extra.forEach(function (m) { add(m.l, m.v); });
    var total = util.sum(mods.map(function (m) { return m.v; }));
    // difficulty
    var dcm = [], dc = o.dc || 11;
    var dadd = function (l, v) { if (v) { dcm.push({ l: l, v: v }); dc += v; } };
    (o.mods || []).forEach(function (m) { if (this.test(m.if, p)) dadd(m.why || 'Circumstance', m.d); }, this);
    if (enemy && enemy.noisy && (p.sprinted === w.round || w.noise >= 2 || this.isEquipped(p, 'lantern'))) dadd('The noise has alerted it', 2);
    if (enemy && enemy.behavior === 'copy' && ctx.enemy.last === o.id) dadd('It copies your last move', 4);
    var n = this.living().length;
    if (!o.noScale) {
      if (w.haunt === 3 && dc >= 11) dadd('The Hollow is awake', 1);
      if (n >= 5 && dc >= 11) dadd('A large party draws attention', 1);
      if (n <= 2 && dc >= 11) dadd('A small party, a lighter touch', -1);
    }
    var wins = 0;
    for (var d = 1; d <= 20; d++) if (d === 20 || (d !== 1 && d + total >= dc)) wins++;
    return { stat: s, mods: mods, mod: total, dc: dc, dcMods: dcm, dcName: H.dcName(dc), chance: Math.round(wins / 20 * 100) };
  };

  M.roll = function (p, info) {
    var d = this.d20(), total = d + info.mod;
    var tier = d === 20 ? 'crit' : d === 1 ? 'fumble' : total >= info.dc ? 'ok' : 'fail';
    return { d: d, mod: info.mod, total: total, dc: info.dc, tier: tier, stat: info.stat, mods: info.mods, dcMods: info.dcMods };
  };

  // ───────────────────────────── options ─────────────────────────────
  M.claimKey = function (loc, o, p) {
    var k = loc + ':' + (o.onceKey || o.id);
    return o.once === 'player' ? k + ':' + p.id : k;
  };
  M.claim = function (loc, o, p) { return this.w.claims[this.claimKey(loc, o, p)] || { n: 0, done: false }; };

  M.shopPrice = function (p, o) {
    var price = o.price || 1;
    var f = this.w.flags;
    if (o.shop) {
      if (f.merchant_robbed && o.price && this.curLocId(p) === 'wagon') price += 1;
      if (f.pell_friend && this.curLocId(p) === 'wagon') price -= 1;
      if (p.skills.indexOf('bargainer') >= 0) price -= 1;
    }
    return Math.max(1, price);
  };
  M.curLocId = function (p) { return p.loc; };

  // Evaluate an option for a player into the plain object the client sees (and the resolver trusts after re-evaluating).
  M.evalOption = function (p, enc, o, base) {
    var w = this.w, loc = enc.loc, out = { id: o.id, label: o.label, stakes: o.stakes || '', ap: 0, state: 'ok', why: '' };
    var ap = o.ap != null ? o.ap : (enc.kind === 'event' ? 0 : (o.shop || o.escape ? 0 : 1));
    out.ap = ap;
    if (o.confirm) out.confirm = o.confirm;
    if (o.needsTarget) out.needsTarget = o.needsTarget;
    // visibility
    if (o.hidden && !(w.locs[loc] && w.locs[loc].inv)) return null;
    if (o.show && !this.test(o.show, p)) return null;
    if (o.hide && this.test(o.hide, p)) return null;
    var cost = o.cost ? Object.assign({}, o.cost) : null;
    if (o.shop) cost = { silver: this.shopPrice(p, o) };
    if (cost) out.cost = cost;
    // one-time claims
    if (o.once || o.stock) {
      var cl = this.claim(loc, o, p);
      if (o.stock) { if (cl.n >= o.stock) { out.state = 'done'; out.why = 'Sold out'; } else out.stockLeft = o.stock - cl.n; }
      else if (cl.done) { out.state = 'done'; out.why = o.puzzle ? 'Solved' : 'Done'; }
      else if (cl.n > 0 && o.retry) out.note = 'Attempt ' + (cl.n + 1) + ' of ' + (1 + o.retry);
    }
    if (out.state === 'ok' && o.req && !this.test(o.req, p)) { out.state = 'locked'; out.why = this.describeReq(o.req); }
    if (out.state === 'ok' && cost) {
      if (cost.silver && p.silver < cost.silver) { out.state = 'locked'; out.why = 'Needs ' + cost.silver + ' Silver'; }
      else if (cost.san && p.san <= cost.san) { out.state = 'locked'; out.why = 'You cannot spare the Sanity'; }
      else if (cost.vit && p.vit <= cost.vit) { out.state = 'locked'; out.why = 'You cannot spare the Vitality'; }
      else if (cost.item && !this.hasItem(p, cost.item)) { out.state = 'locked'; out.why = 'Needs ' + D.items[cost.item].name; }
      else if (cost.maxvit && p.maxVit <= cost.maxvit + 2) { out.state = 'locked'; out.why = 'You cannot spare the Vitality'; }
    }
    if (out.state === 'ok' && o.needsTarget === 'fallen') {
      var fallen = this.players.filter(function (x) { return x.status === 'fallen' && x.returns >= 0; });
      if (!fallen.length) { out.state = 'locked'; out.why = 'No one has fallen'; }
      else if (w.revivals >= 2) { out.state = 'locked'; out.why = 'The party has already been given two returns'; }
      else out.targets = fallen.map(function (x) { return { id: x.id, name: x.name }; });
    }
    if (out.state === 'ok' && ap > 0 && this.turn.ap < ap) { out.state = 'locked'; out.why = 'No actions left this turn'; }
    // guarded locations
    if (out.state === 'ok' && enc.kind === 'loc' && enc.guard && !p.unnoticed) { out.state = 'locked'; out.why = enc.guardText; }
    // a puzzle shows its chips; a check shows its odds
    if (o.puzzle) {
      var sec = D.secrets[o.puzzle.key], elim = w.elim[o.puzzle.key] || [];
      out.puzzle = { key: o.puzzle.key, title: o.puzzle.title, chips: sec.vals.map(function (v) { return { v: v, label: (sec.names && sec.names[v]) || v, out: elim.indexOf(v) >= 0 }; }) };
      var live = out.puzzle.chips.filter(function (c) { return !c.out; });
      if (live.length === 1) out.puzzle.deduced = live[0].v;
      if (o.puzzle.cost) { // the offering is the cost (fountain)
        out.puzzle.chips.forEach(function (c) { c.price = c.v === 'silver' ? 'Silver' : c.v === 'salt' ? 'Salt Charm' : 'Candle'; });
        out.puzzle.chips.forEach(function (c) { var have = c.v === 'silver' ? p.silver > 0 : this.hasItem(p, c.v === 'candle' ? 'candle' : 'salt'); c.can = have; }, this);
      }
      out.kind = 'puzzle';
    } else if (o.stat) {
      var ri = this.rollInfo(p, o, base || {});
      out.kind = 'check'; out.stat = o.stat; out.mods = ri.mods; out.mod = ri.mod; out.dc = ri.dc; out.dcName = ri.dcName; out.dcMods = ri.dcMods; out.chance = ri.chance;
      out.weak = !!(base && base.enemy && base.enemy.known && base.enemy.weak === o.id);
    } else out.kind = 'auto';
    out.stockLeft = out.stockLeft;
    return out;
  };

  // ───────────────────────────── choosing an option ─────────────────────────────
  M.requireTurn = function (p, opt) {
    opt = opt || {};
    if (this.phase !== 'playing') return 'The expedition is not under way.';
    if (p.status !== 'alive') return 'You have fallen. Use a spirit action.';
    if (!this.turn || this.turn.active !== p.id) return 'It is not your turn.';
    return null;
  };

  M.cmd_choose = function (p, c) {
    var e = this.requireTurn(p); if (e) return { error: e };
    var enc = this.turn.enc;
    if (!enc) return { error: 'There is nothing to act on.' };
    if (c.enc !== enc.id) return { error: 'That moment has passed.' };
    if (enc.hold) return { error: 'Decide about your roll first.' };
    var src = this.encOptions(p, enc).find(function (x) { return x.raw.id === c.opt; });
    if (!src) return { error: 'That option is not available.' };
    var ev = src.ev, o = src.raw;
    if (ev.state !== 'ok') return { error: ev.why || 'That option is not available.' };
    var target = null, val = null;
    if (o.puzzle) {
      val = String(c.val);
      var ch = ev.puzzle.chips.find(function (x) { return x.v === val; });
      if (!ch || ch.out) return { error: 'That answer has already been ruled out.' };
      if (o.puzzle.cost && !ch.can) return { error: 'You have nothing to offer.' };
    }
    if (o.needsTarget === 'fallen') {
      target = this.get(c.target);
      if (!target || target.status !== 'fallen') return { error: 'Choose a fallen ally.' };
    }
    if (o.id === 'leave' && o.escape && !this.w.flags.gate_open) return { error: 'The Gate is sealed.' };
    // pay
    var cost = ev.cost;
    if (o.puzzle && o.puzzle.cost) cost = val === 'silver' ? { silver: 1 } : { item: val === 'candle' ? 'candle' : 'salt' };
    this.payCost(p, cost);
    if (ev.ap) this.turn.ap -= ev.ap;
    var chips = [];
    var res = this.resolveOption(p, enc, o, ev, { val: val, target: target, chips: chips });
    return res;
  };

  M.payCost = function (p, cost) {
    if (!cost) return;
    if (cost.silver) p.silver -= cost.silver;
    if (cost.san) this.hurt(p, 'san', cost.san, { src: 'cost', raw: true });
    if (cost.vit) this.hurt(p, 'vit', cost.vit, { src: 'cost', raw: true });
    if (cost.maxvit) { p.maxVit -= cost.maxvit; p.vit = Math.min(p.vit, p.maxVit); }
    if (cost.item) this.removeItem(p, cost.item, 1);
  };

  M.resolveOption = function (p, enc, o, ev, x) {
    var w = this.w, enemy = enc.enemyObj ? this.enemyByUid(enc.enemy) : null;
    var roll = null, tier = 'auto', out;
    if (o.puzzle) {
      var right = w.secrets[o.puzzle.key] === x.val;
      tier = right ? 'ok' : 'fail';
      out = right ? o.ok : o.fail;
      if (right) w.solved[o.puzzle.key] = true; else { (w.elim[o.puzzle.key] = w.elim[o.puzzle.key] || []).push(x.val); }
    } else if (o.stat) {
      var base = { enemy: enemy, aid: enc.aid && enc.aid.bonus, spiritAid: w.spiritAid ? 2 : 0 };
      var info = this.rollInfo(p, o, base);
      roll = this.roll(p, info);
      if (w.spiritAid) w.spiritAid = null;
      if (enc.aid) { enc.aid.bonus = 0; enc.aid.helpers = []; }
      if (p.sts.blessed) delete p.sts.blessed;
      tier = roll.tier;
      // an outcome that can still be changed: hold it for a reroll
      if (tier === 'fail' || tier === 'fumble') {
        var src = this.rerollSources(p);
        if (src.length) {
          enc.hold = { optId: o.id, roll: roll, sources: src, x: { val: x.val, target: x.target && x.target.id }, deadline: this.now() + C.holdSec * 1000, ap: ev.ap };
          this.addLog('roll', p.name + ' rolled ' + roll.d + ' (' + roll.total + ' vs ' + roll.dc + '). Fate hangs in the balance.', { p: p.id, d: { roll: roll, hold: true } });
          return { ok: true, hold: true };
        }
      }
      out = this.pickOutcome(o, tier);
    } else {
      out = o.auto || (o.shop ? { t: 'Sold.' } : { t: '' });
      if (o.shop) out = Object.assign({}, out, { item: o.item, t: 'You hand over the silver and take the ' + D.items[o.item].name + '.' });
    }
    return this.finishOption(p, enc, o, tier, roll, out, x);
  };

  M.pickOutcome = function (o, tier) {
    var base = o.ok, extra;
    if (tier === 'crit') { extra = o.crit || { xp: 1, glory: 1 }; return { parts: [o.ok, extra] }; }
    if (tier === 'ok') return o.ok;
    if (tier === 'fumble') { extra = o.fumble || { clock: 1, t: 'A serious complication: the Hollow notices.' }; return { parts: [o.fail, extra] }; }
    return o.fail || { t: 'Nothing comes of it.', clock: 1 };
  };

  M.finishOption = function (p, enc, o, tier, roll, out, x) {
    var w = this.w, loc = enc.loc;
    var ctx = { enc: enc, p: p, opt: o, tier: tier, lines: [], chips: [], loc: loc, boss: enc.kind === 'boss', enemy: enc.enemy ? this.enemyByUid(enc.enemy) : null, val: x.val, target: x.target, rollEff: roll };
    var parts = out && out.parts ? out.parts : [out];
    parts.forEach(function (pt) { if (pt) this.applyOutcome(p, pt, ctx); }, this);
    if (o.escape && p.status === 'alive') this.escapeHollow(p, ctx);
    // claims
    if (o.once || o.stock) {
      var k = this.claimKey(loc, o, p), cl = w.claims[k] = w.claims[k] || { n: 0, done: false };
      var win = tier === 'ok' || tier === 'crit' || tier === 'auto';
      if (o.stock) cl.n++;
      else if (win) { cl.done = true; cl.n++; }
      else if (o.puzzle) { /* wrong answers are ruled out instead of counted */ }
      else { cl.n++; if (cl.n >= 1 + (o.retry || 0)) cl.done = true; }
    }
    // enemy upkeep: failing against it teaches you its weakness
    if (ctx.enemy && ctx.enemy.hp > 0) {
      ctx.enemy.last = o.id;
      if ((tier === 'fail' || tier === 'fumble') && !ctx.enemy.known) { ctx.enemy.known = true; ctx.lines.push({ t: 'You learn its weakness.', k: 'info' }); }
    }
    if (ctx.enemy && ctx.enemy.hp <= 0 && !ctx.enemy.dead) this.defeatEnemy(ctx.enemy, p, ctx);
    var result = { opt: o.label, tier: tier, roll: roll, lines: ctx.lines, chips: ctx.chips, n: this.n + 1, by: p.id, stakes: o.stakes || '' };
    enc.result = result;
    var summary = p.name + ': ' + o.label + (roll ? ' — rolled ' + roll.d + ' (' + roll.total + ' vs ' + roll.dc + ') — ' + ({ crit: 'critical success', ok: 'success', fail: 'failure', fumble: 'critical failure' })[tier] : '');
    this.addLog('result', summary, { p: p.id, loc: loc, d: { result: result } });
    if (p.status === 'escaped') { this.afterEscape(p); return { ok: true, result: result }; }
    if (p.status !== 'alive') { this.closeEnc(p, true); return { ok: true, result: result }; }
    if (enc.kind === 'event') enc.over = true;     // an event is a single choice
    if (enc.kind === 'boss') this.bossRetaliate(p, enc, ctx);
    if (enc.kind === 'enemy' && (!ctx.enemy || ctx.enemy.dead)) { enc.over = true; }
    this.afterAction(p);
    return { ok: true, result: result };
  };

  // ───────────────────────────── rerolls: Twist Fate and the Moonbound Relic ─────────────────────────────
  M.rerollSources = function (p) {
    var s = [], w = this.w;
    if (p.cls === 'occultist') {
      var lim = p.abilityLvl >= 1 ? 2 : 1;
      if ((p.uses['twist' + w.haunt] || 0) < lim && p.san > 1) s.push('twist');
    }
    if (this.isEquipped(p, 'moonrelic') && !p.uses['moon' + w.haunt]) s.push('moon');
    return s;
  };

  M.cmd_accept = function (p) {
    var e = this.requireTurn(p); if (e) return { error: e };
    var enc = this.turn.enc; if (!enc || !enc.hold) return { error: 'Nothing is waiting on you.' };
    this.releaseHold(p); return { ok: true };
  };
  M.cmd_reroll = function (p, c) {
    var e = this.requireTurn(p); if (e) return { error: e };
    var enc = this.turn.enc; if (!enc || !enc.hold) return { error: 'There is no roll to change.' };
    var h = enc.hold;
    if (h.sources.indexOf(c.src) < 0) return { error: 'You cannot change this roll that way.' };
    var o = this.encOptions(p, enc).find(function (x) { return x.raw.id === h.optId; });
    if (!o) { enc.hold = null; return { error: 'That moment has passed.' }; }
    if (c.src === 'twist') { p.uses['twist' + this.w.haunt] = (p.uses['twist' + this.w.haunt] || 0) + 1; this.hurt(p, 'san', 1, { src: 'cost', raw: true }); this.addLog('world', p.name + ' twists Fate, and pays for it.', { p: p.id }); }
    else { p.uses['moon' + this.w.haunt] = 1; this.w.clock += 0; this.advanceClock(1, 'The Moonbound Relic hums, and the Hollow notices.'); }
    var info = this.rollInfo(p, o.raw, { enemy: enc.enemy ? this.enemyByUid(enc.enemy) : null });
    var roll = this.roll(p, info);
    roll.rerolled = true;
    enc.hold = null;
    this.addLog('roll', p.name + ' rerolls: ' + roll.d + ' (' + roll.total + ' vs ' + roll.dc + ').', { p: p.id, d: { roll: roll } });
    var tier = roll.tier;
    var out = this.pickOutcome(o.raw, tier);
    var target = h.x.target ? this.get(h.x.target) : null;
    this.finishOption(p, enc, o.raw, tier, roll, out, { val: h.x.val, target: target });
    return { ok: true };
  };
  M.releaseHold = function (p) {
    var enc = this.turn.enc; if (!enc || !enc.hold) return;
    var h = enc.hold, o = this.encOptions(p, enc).find(function (x) { return x.raw.id === h.optId; });
    enc.hold = null;
    if (!o) return;
    var out = this.pickOutcome(o.raw, h.roll.tier);
    this.finishOption(p, enc, o.raw, h.roll.tier, h.roll, out, { val: h.x.val, target: h.x.target ? this.get(h.x.target) : null });
  };

  // ───────────────────────────── outcomes ─────────────────────────────
  var arr = function (v) { return v == null ? [] : Array.isArray(v) ? v : [v]; };

  M.chip = function (ctx, kind, n, label, tone) { if (ctx && ctx.chips) ctx.chips.push({ k: kind, n: n, label: label, tone: tone || (n < 0 ? 'bad' : 'good') }); };
  M.say = function (ctx, t, k) { if (ctx && t) ctx.lines.push({ t: t, k: k || 'story' }); };

  M.applyOutcome = function (p, o, ctx) {
    var w = this.w, self = this;
    if (!o) return;
    if (o.t) this.say(ctx, o.t, 'story');
    if (o.vit) { if (o.vit < 0) this.hurt(p, 'vit', -o.vit, { ctx: ctx, src: ctx && ctx.enemy ? ctx.enemy.id : 'outcome', spirit: ctx && ctx.enemy && D.enemies[ctx.enemy.id].type === 'spirit' }); else this.heal(p, 'vit', o.vit, ctx); }
    if (o.san) { if (o.san < 0) this.hurt(p, 'san', -o.san, { ctx: ctx, src: 'outcome', spirit: true }); else this.heal(p, 'san', o.san, ctx); }
    if (p.status !== 'alive') return;
    if (o.silver) { var s = o.silver; if (s > 0 && p.skills.indexOf('bargainer') >= 0) s++; p.silver = Math.max(0, p.silver + s); this.chip(ctx, 'silver', s, (s > 0 ? '+' : '') + s + ' Silver'); }
    if (o.xp) { this.gainXp(p, o.xp, ctx); }
    if (o.glory) { p.glory += o.glory; p.tally.glory += o.glory; this.chip(ctx, 'glory', o.glory, (o.glory > 0 ? '+' : '') + o.glory + ' Glory'); }
    arr(o.item).forEach(function (id) { var n = self.addItem(p, id, 1); if (n) self.chip(ctx, 'item', 1, '+ ' + D.items[id].name, 'good'); });
    arr(o.lose).forEach(function (id) { if (self.removeItem(p, id, 1)) self.chip(ctx, 'item', -1, '− ' + D.items[id].name, 'bad'); });
    if (o.loseRandom) {
      var pool = p.inv.filter(function (e) { return D.items[e.id].kind !== 'key'; });
      if (pool.length) { var e = this.pick(pool); this.removeItem(p, e.id, 1); this.chip(ctx, 'item', -1, '− ' + D.items[e.id].name, 'bad'); this.say(ctx, 'The ' + D.items[e.id].name + ' is gone.', 'info'); }
    }
    if (o.loot) { var id = this.lootFrom(o.loot); if (id) { this.addItem(p, id, 1); this.chip(ctx, 'item', 1, '+ ' + D.items[id].name, 'good'); } }
    arr(o.clue).forEach(function (id) { self.addClue(id, p, !!o.priv, ctx); });
    ['hint', 'hint2', 'hint3'].forEach(function (k) { if (o[k]) self.hint(o[k], ctx); });
    if (o.hint && p.skills.indexOf('lore_keeper') >= 0 && arr(o.clue).length) this.hint(o.hint, ctx);
    arr(o.flag).forEach(function (f) { w.flags[f] = true; self.onFlag(f, p, ctx); });
    arr(o.unflag).forEach(function (f) { delete w.flags[f]; });
    if (o.pflag) p.flags[o.pflag] = true;
    if (o.pactSave) p.flags.pactSave = true;
    if (o.clock) this.advanceClock(o.clock, o.clock > 0 ? null : 'The Haunting loosens its grip.', ctx);
    if (o.noise) this.addNoise(o.noise, p);
    if (o.reveal) o.reveal.forEach(function (r) { self.reveal(r, ctx); });
    if (o.revealRandom) this.revealRandom(o.revealRandom, ctx);
    if (o.open) o.open.forEach(function (k) { var e = w.edges[k]; if (e) { e.open = true; self.say(ctx, 'A way opens.', 'info'); } });
    if (o.status) this.applyStatus(p, o.status, ctx);
    if (o.cleanse) this.cleanseCurse(o.cleanse, p, ctx);
    if (o.ally) this.rescueAlly(o.ally, p, ctx);
    if (o.stat) this.gainStat(p, o.stat, ctx);
    if (o.rumor) this.addRumor(ctx);
    if (o.bleed) this.applyStatus(p, 'bleeding', ctx);
    if (o.useLantern) this.drainLantern(p, 1, ctx);
    if (o.spawn) this.spawnEnemy(o.spawn, p.loc, ctx, true);
    if (o.spawnAt) this.spawnEnemy(o.spawnAt[0], o.spawnAt[1], ctx, false);
    if (o.fn) this.customFn(o.fn, p, ctx);
    if (o.revive && ctx && ctx.target) this.revive(ctx.target, p, ctx);
    if (o.party) {
      this.here(p.loc).filter(function (x) { return x.id !== p.id; }).forEach(function (x) { self.applyOutcome(x, Object.assign({}, o.party, { t: undefined }), { lines: [], chips: [], loc: ctx && ctx.loc, enemy: null, enc: ctx && ctx.enc }); });
      if (o.party.status || o.party.vit) this.say(ctx, 'Those beside you share in it.', 'info');
    }
    if (ctx && ctx.enemy) {
      if (o.hurt) { ctx.enemy.hp -= o.hurt; this.chip(ctx, 'enemy', -o.hurt, 'Enemy −' + o.hurt, 'good'); }
      if (o.kill) { if (o.kill !== 'water' || (D.locations[ctx.enemy.loc] && D.locations[ctx.enemy.loc].water)) ctx.enemy.hp = 0; }
    }
    if (ctx && ctx.boss) {
      if (o.hurt) { w.boss.hp -= o.hurt; this.chip(ctx, 'enemy', -o.hurt, 'Warden −' + o.hurt, 'good'); }
      if (o.chain) { var before = w.boss.chains; w.boss.chains = Math.max(0, w.boss.chains - o.chain); if (w.boss.chains < before) this.chip(ctx, 'chain', -o.chain, 'A chain breaks', 'good'); }
      if (o.kill) w.boss.hp = 0;
    }
    if (o.move) this.forcedMove(p, o.move, ctx);
    if (o.escape) this.escapeHollow(p, ctx);
  };

  M.lootFrom = function (table) {
    var pool = table === 'relic' ? ['weeping_eye', 'saint_finger', 'gilded_psalter', 'bone_chalice', 'ember_locket'] : ['tonic', 'thread', 'salt', 'blade', 'moonwater', 'mirror_shard', 'chalk', 'snare'];
    var held = {};
    this.players.forEach(function (x) { x.inv.forEach(function (e) { held[e.id] = true; }); });
    var fresh = pool.filter(function (i) { return !held[i] || D.items[i].stack; });
    return this.pick(fresh.length ? fresh : pool);
  };

  M.onFlag = function (f, p, ctx) {
    if (f === 'gate_open') this.addLog('world', 'The Escape Gate stands open.', {});
    if (f === 'bellkeeper_down') this.addLog('world', 'The tower falls silent. The bell has lost its Keeper.', {});
  };

  M.applyStatus = function (p, st, ctx) {
    if (st.charAt(0) === '-') { delete p.sts[st.slice(1)]; this.chip(ctx, 'status', 0, 'No longer ' + st.slice(1), 'good'); return; }
    if (!D.statuses[st]) return;
    if (p.sts[st] && st !== 'bleeding') return;
    p.sts[st] = 1;
    this.chip(ctx, 'status', 0, D.statuses[st].name, D.statuses[st].good ? 'good' : 'bad');
  };

  M.gainStat = function (p, st, ctx) {
    Object.keys(st).forEach(function (k) {
      var key = k, n = st[k];
      if (k === 'random') key = this.pick(STATS);
      if (p.stats[key] >= 6) return;
      p.stats[key] += n;
      this.chip(ctx, 'stat', n, '+' + n + ' ' + STAT_NAME[key], 'good');
      this.say(ctx, 'Your ' + STAT_NAME[key] + ' is permanently higher.', 'info');
    }, this);
  };

  M.drainLantern = function (p, n, ctx) {
    var e = p.inv.find(function (x) { return x.id === 'lantern'; });
    if (!e) return;
    e.uses = Math.max(0, (e.uses || 0) - n);
    this.chip(ctx, 'item', -n, 'Lantern −' + n, 'bad');
  };

  M.customFn = function (name, p, ctx) {
    if (name === 'corridor_peek') {
      var t = this.w.corridor;
      this.say(ctx, 'Next, the corridor will open onto ' + D.locations[t].name + '.', 'info');
      this.addLog('world', p.name + ' charts the Shifting Corridor: it now opens onto ' + D.locations[t].name + '.', { p: p.id });
    }
  };

  // ───────────────────────────── damage, healing, falling ─────────────────────────────
  M.hurt = function (p, kind, n, o) {
    o = o || {};
    if (p.status !== 'alive' || n <= 0) return 0;
    var w = this.w, ctx = o.ctx;
    if (!o.raw) {
      if (kind === 'san') {
        if (p.ward) { p.ward = false; this.say(ctx, 'The Salt Charm burns out, and the loss is not taken.', 'info'); this.chip(ctx, 'ward', 0, 'Warded', 'good'); return 0; }
        var cut = 0;
        if (p.cls === 'exorcist') cut++;
        else if (this.here(p.loc).some(function (x) { return x.cls === 'exorcist' && x.id !== p.id; })) cut++;
        if (p.skills.indexOf('steel_nerves') >= 0 && p.steelRound !== w.round) { cut++; p.steelRound = w.round; }
        n = Math.max(0, n - cut);
        if (!n) { this.say(ctx, 'You hold steady.', 'info'); return 0; }
      }
      if (kind === 'vit' && p.cls === 'medium' && o.spirit) n++;
      if (kind === 'san' && p.cls === 'medium' && o.spirit) n++;
    }
    var field = kind === 'vit' ? 'vit' : 'san';
    n = Math.min(n, p[field]);           // report what was actually lost, not the overkill
    p[field] = Math.max(0, p[field] - n);
    p.tally[field === 'vit' ? 'vitLost' : 'sanLost'] += n;
    this.chip(ctx, kind, -n, '−' + n + (kind === 'vit' ? ' Vitality' : ' Sanity'), 'bad');
    this.addLog('dmg', p.name + ' loses ' + n + (kind === 'vit' ? ' Vitality.' : ' Sanity.'), { p: p.id, d: { k: kind, n: -n } });
    if (p[field] <= 0) this.fall(p, kind);
    return n;
  };

  M.heal = function (p, kind, n, ctx) {
    if (p.status !== 'alive' || n <= 0) return 0;
    if (p.cls === 'apothecary') n++;
    var field = kind === 'vit' ? 'vit' : 'san', max = kind === 'vit' ? p.maxVit : p.maxSan;
    var got = Math.max(0, Math.min(n, max - p[field]));
    p[field] += got;
    if (got) { this.chip(ctx, kind, got, '+' + got + (kind === 'vit' ? ' Vitality' : ' Sanity'), 'good'); this.addLog('heal', p.name + ' recovers ' + got + (kind === 'vit' ? ' Vitality.' : ' Sanity.'), { p: p.id, d: { k: kind, n: got } }); }
    if (kind === 'vit' && got && p.sts.bleeding) delete p.sts.bleeding;
    return got;
  };

  M.fall = function (p, cause) {
    var w = this.w;
    if (p.status !== 'alive') return;
    if (p.flags.pactSave) {
      delete p.flags.pactSave;
      p.vit = Math.max(p.vit, 3); p.san = Math.max(p.san, 3);
      this.addLog('story', 'The Remembrancer keeps its promise. ' + p.name + ' stands up, remembered, and a little less theirs.', { p: p.id, d: { k: 'pact' } });
      return;
    }
    p.status = 'fallen'; p.fallenCount++; p.fellAt = w.round; p.fellLoc = p.loc; p.fellBy = cause;
    p.returns = p.fallenCount <= 1 ? 1 : 0;
    p.sts = {}; p.ward = false; p.thread = false; p.unnoticed = null; p.engaged = null;
    p.inv.forEach(function (e) { this.dropGround(p.loc, e.id, e.n); }, this);
    p.inv = [];
    this.addLog('fall', cause === 'san' ? p.name + '\'s mind gives way. They drift out of their body, a wandering voice.' : p.name + ' falls. A pale shape stands up from the body and does not look back.', { p: p.id, d: { k: 'fall', cause: cause } });
    // a fallen player's enemies and aids vanish
    if (this.turn && this.turn.enc && this.turn.enc.pid === p.id) this.closeEnc(p, true);
    if (this.turn && this.turn.active === p.id) { this.turn.ap = 0; }
    this.checkEnd();
  };

  // ───────────────────────────── experience and levels ─────────────────────────────
  M.gainXp = function (p, n, ctx) {
    if (n <= 0 || p.status !== 'alive') return;
    p.xp += n; p.tally.xp += n;
    this.chip(ctx, 'xp', n, '+' + n + ' XP', 'good');
    var lvl = 1;
    D.levels.forEach(function (t, i) { if (p.xp >= t) lvl = i + 1; });
    while (p.level < lvl) {
      p.level++; p.pendingLevels++;
      this.addLog('level', p.name + ' reaches level ' + p.level + '.', { p: p.id, d: { k: 'level' } });
      if (!p.offer) p.offer = this.makeOffer(p);
    }
  };
  M.makeOffer = function (p) {
    var pool = D.upgrades.filter(function (u) {
      if (['might', 'wit', 'fate'].indexOf(u.id) >= 0) return p.stats[u.id] < 5;
      if (u.skill) return p.skills.indexOf(u.id) < 0;
      if (u.ability) return p.abilityLvl < 1;
      return true;
    });
    var picks = this.shuffle(pool).slice(0, 3).map(function (u) { return u.id; });
    // keep it interesting: if no ability pick and the player has none yet, swap one in half the time
    if (!p.abilityLvl && picks.indexOf('ability') < 0 && this.rint(2) === 0) picks[2] = 'ability';
    return picks;
  };
  M.cmd_levelup = function (p, c) {
    if (p.status !== 'alive') return { error: 'Only the living can grow.' };
    if (!p.pendingLevels || !p.offer) return { error: 'No upgrade is waiting.' };
    if (p.offer.indexOf(c.pick) < 0) return { error: 'Not one of your choices.' };
    var u = D.upgrades.find(function (x) { return x.id === c.pick; });
    if (['might', 'wit', 'fate'].indexOf(u.id) >= 0) p.stats[u.id]++;
    else if (u.id === 'vit') { p.maxVit += 3; p.vit = Math.min(p.maxVit, p.vit + 3); }
    else if (u.id === 'san') { p.maxSan += 3; p.san = Math.min(p.maxSan, p.san + 3); }
    else if (u.id === 'ability') { p.abilityLvl++; if (p.cls === 'exorcist') p.uses.ritesLeft = (p.uses.ritesLeft || 0) + 2; }
    else if (u.skill) p.skills.push(u.id);
    p.pendingLevels--;
    p.picks.push(u.id);
    this.addLog('level', p.name + ' grows: ' + u.name + '.', { p: p.id, d: { k: 'level' } });
    p.offer = p.pendingLevels ? this.makeOffer(p) : null;
    return { ok: true };
  };

  // ───────────────────────────── items in play ─────────────────────────────
  M.cmd_use = function (p, c) {
    if (this.phase !== 'playing') return { error: 'The expedition is not under way.' };
    if (p.status !== 'alive') return { error: 'You have no hands.' };
    var id = c.item, d = D.items[id];
    if (!d || !this.hasItem(p, id)) return { error: 'You do not have that.' };
    var turnOnly = ['lamp_oil', 'tonic', 'herb', 'moonwater', 'salt', 'thread', 'chalk', 'snare'];
    if (turnOnly.indexOf(id) < 0) return { error: d.name + ' cannot be used that way.' };
    var active = this.turn && this.turn.active === p.id;
    var target = c.target ? this.get(c.target) : p;
    var ctx = { lines: [], chips: [] };
    if (id === 'tonic') {
      if (!target || target.status !== 'alive' || target.loc !== p.loc) return { error: 'They are not here to drink it.' };
      if (target.vit >= target.maxVit && !target.sts.bleeding) return { error: 'No need.' };
      this.removeItem(p, id, 1); this.heal(target, 'vit', 3, ctx);
      this.addLog('item', p.name + ' gives ' + (target === p ? 'themselves' : target.name) + ' a Minor Tonic.', { p: p.id });
    } else if (id === 'herb') {
      this.removeItem(p, id, 1); this.heal(p, 'vit', 1, ctx); this.hurt(p, 'san', 1, { ctx: ctx, raw: true });
      this.addLog('item', p.name + ' chews Gravemoss. The world swims.', { p: p.id });
    } else if (id === 'salt') {
      if (p.ward) return { error: 'You are already warded.' };
      this.removeItem(p, id, 1); p.ward = true;
      this.addLog('item', p.name + ' presses a Salt Charm to their chest. The next shock will not land.', { p: p.id });
    } else if (id === 'thread') {
      if (p.thread) return { error: 'The thread is already laid.' };
      this.removeItem(p, id, 1); p.thread = true;
      this.addLog('item', p.name + ' unspools a Silver Thread. The next road will be safe.', { p: p.id });
    } else if (id === 'chalk') {
      var L = this.w.locs[p.loc]; L.chalk = this.w.round + 2;
      this.removeItem(p, id, 1);
      this.addLog('item', p.name + ' draws a ward-circle. For two rounds this place is held.', { p: p.id, loc: p.loc });
    } else if (id === 'lamp_oil') {
      var lan = p.inv.find(function (x) { return x.id === 'lantern'; });
      if (!lan) return { error: 'You have no lantern to fill.' };
      if (lan.uses >= D.items.lantern.uses) return { error: 'The lantern is full.' };
      this.removeItem(p, id, 1); lan.uses = Math.min(D.items.lantern.uses, lan.uses + 3);
      this.addLog('item', p.name + ' refills the lantern.', { p: p.id });
    } else if (id === 'snare') {
      var enc = this.turn && this.turn.enc;
      if (!active || !enc || (enc.kind !== 'enemy')) return { error: 'There is nothing here to snare.' };
      var en = this.enemyByUid(enc.enemy); if (!en) return { error: 'Nothing to snare.' };
      this.removeItem(p, id, 1); en.hp -= 2;
      this.addLog('item', p.name + ' springs a snare on the ' + D.enemies[en.id].name + '.', { p: p.id });
      if (en.hp <= 0) { var cx = { lines: [], chips: [], enemy: en, enc: enc, p: p }; this.defeatEnemy(en, p, cx); enc.result = { opt: 'Hunter\'s Snare', tier: 'auto', lines: cx.lines, chips: cx.chips, n: this.n + 1, by: p.id }; enc.over = true; }
    } else if (id === 'moonwater') {
      if (c.curse && this.w.curses[c.curse]) { this.removeItem(p, id, 1); this.cleanseCurse(c.curse, p, ctx); }
      else if (target && target.status === 'fallen' && target.loc !== undefined) {
        if (target.fellLoc !== p.loc) return { error: 'They fell elsewhere. You must be where they fell.' };
        if (this.w.revivals >= 2) return { error: 'The party has already been given two returns.' };
        this.removeItem(p, id, 1); this.revive(target, p, ctx);
      } else return { error: 'Choose a curse to cleanse, or a fallen ally who fell here.' };
    }
    return { ok: true, lines: ctx.lines };
  };

  M.cmd_equip = function (p, c) {
    if (p.status !== 'alive') return { error: 'You have no hands.' };
    var e = p.inv.find(function (x) { return x.id === c.item; });
    var d = e && D.items[e.id];
    if (!e || !d.equip) return { error: 'That cannot be equipped.' };
    if (c.off) { e.eq = false; return { ok: true }; }
    var slot = d.kind; // one tool, one weapon, one charm
    p.inv.forEach(function (x) { if (x !== e && D.items[x.id].kind === slot) x.eq = false; });
    e.eq = true;
    return { ok: true };
  };

  M.cmd_drop = function (p, c) {
    if (p.status !== 'alive') return { error: 'You have no hands.' };
    var e = p.inv.find(function (x) { return x.id === c.item; });
    if (!e) return { error: 'You do not have that.' };
    if (D.items[e.id].kind === 'key' && e.id !== 'clapper') { /* keys may be dropped */ }
    this.removeItem(p, e.id, 1); this.dropGround(p.loc, e.id, 1);
    this.addLog('item', p.name + ' leaves a ' + D.items[e.id].name + ' on the ground.', { p: p.id, loc: p.loc });
    return { ok: true };
  };
  M.cmd_pickup = function (p, c) {
    if (p.status !== 'alive') return { error: 'You have no hands.' };
    var L = this.w.locs[p.loc], s = (L.ground || []).find(function (x) { return x.id === c.item; });
    if (!s) return { error: 'There is nothing like that here.' };
    var d = D.items[s.id];
    var stackE = d.stack > 1 && p.inv.find(function (e) { return e.id === s.id && e.n < d.stack; });
    if (!stackE && this.packUsed(p) + (d.size || 1) > C.packSize) return { error: 'Your pack is full. Drop something first.' };
    s.n--; if (s.n <= 0) L.ground = L.ground.filter(function (x) { return x !== s; });
    if (stackE) stackE.n++; else p.inv.push(d.uses ? { id: s.id, n: 1, uses: d.uses } : { id: s.id, n: 1 });
    this.addLog('item', p.name + ' picks up a ' + d.name + '.', { p: p.id, loc: p.loc });
    return { ok: true };
  };
  M.cmd_give = function (p, c) {
    var to = this.get(c.to);
    if (!to || to.id === p.id || to.status !== 'alive' || p.status !== 'alive' || to.loc !== p.loc) return { error: 'They must be alive and here with you.' };
    if (c.silver) {
      var n = Math.min(p.silver, Math.max(1, Math.round(+c.silver) || 1));
      if (n <= 0) return { error: 'You have no silver.' };
      p.silver -= n; to.silver += n;
      this.addLog('item', p.name + ' hands ' + n + ' Silver to ' + to.name + '.', { p: p.id });
      return { ok: true };
    }
    var e = p.inv.find(function (x) { return x.id === c.item; });
    if (!e) return { error: 'You do not have that.' };
    var d = D.items[e.id];
    var stackE = d.stack > 1 && to.inv.find(function (x) { return x.id === e.id && x.n < d.stack; });
    if (!stackE && this.packUsed(to) + (d.size || 1) > C.packSize) return { error: to.name + '\'s pack is full.' };
    var uses = e.uses;
    this.removeItem(p, e.id, 1);
    if (stackE) stackE.n++; else to.inv.push(d.uses ? { id: e.id, n: 1, uses: uses } : { id: e.id, n: 1 });
    this.addLog('item', p.name + ' gives ' + to.name + ' a ' + d.name + '.', { p: p.id });
    return { ok: true };
  };

  // ───────────────────────────── cooperation: asking for and giving aid ─────────────────────────────
  M.cmd_askaid = function (p) {
    var e = this.requireTurn(p); if (e) return { error: e };
    var enc = this.turn.enc; if (!enc) return { error: 'Open an encounter first.' };
    var helpers = this.here(p.loc).filter(function (x) { return x.id !== p.id && x.connected && x.san >= 2 && x.aidedRound !== this.w.round; }, this);
    if (!helpers.length) return { error: 'No one here can help right now.' };
    enc.aid = enc.aid || { asked: false, bonus: 0, helpers: [] };
    enc.aid.asked = true;
    this.addLog('world', p.name + ' calls for help.', { p: p.id, loc: p.loc });
    return { ok: true };
  };
  M.cmd_aid = function (p) {
    if (this.phase !== 'playing' || p.status !== 'alive') return { error: 'You cannot help right now.' };
    var enc = this.turn && this.turn.enc;
    var a = enc && this.get(enc.pid);
    if (!enc || !enc.aid || !enc.aid.asked || !a || a.loc !== p.loc || a.id === p.id) return { error: 'No one is asking for your help.' };
    if (p.aidedRound === this.w.round) return { error: 'You have already helped this round.' };
    if (p.san < 2) return { error: 'You are too shaken to help.' };
    if (enc.aid.bonus >= 4) return { error: 'They have all the help they can use.' };
    this.hurt(p, 'san', 1, { raw: true, src: 'aid' });
    p.aidedRound = this.w.round; p.tally.aids++;
    enc.aid.bonus += 2; enc.aid.helpers.push(p.id);
    this.addLog('world', p.name + ' lends a hand to ' + a.name + ', at the cost of their own composure.', { p: p.id, loc: p.loc, d: { k: 'aid' } });
    return { ok: true };
  };

  // ───────────────────────────── class abilities ─────────────────────────────
  M.cmd_ability = function (p, c) {
    if (this.phase !== 'playing') return { error: 'The expedition is not under way.' };
    if (p.status !== 'alive') return { error: 'The living wield these gifts.' };
    var w = this.w, cls = p.cls, lvl = p.abilityLvl, active = this.turn && this.turn.active === p.id;
    var ctx = { lines: [], chips: [] };
    if (cls === 'occultist') return { error: 'Twist Fate triggers on its own after a failed check. Watch for the offer.' };
    if (cls === 'vagabond') {
      var enc = this.turn && this.turn.enc;
      if (!active || !enc || enc.kind !== 'enemy' && enc.kind !== 'boss') return { error: 'Slip Away only works to escape a confrontation.' };
      var lim = lvl >= 1 ? 2 : 1;
      if ((p.uses['slip' + w.haunt] || 0) >= lim) return { error: 'You have used Slip Away this phase.' };
      var to = c.to, nb = this.moveOptions(p).filter(function (x) { return x.ok && x.to === to; })[0];
      if (!nb) return { error: 'Choose an open place beside you.' };
      p.uses['slip' + w.haunt] = (p.uses['slip' + w.haunt] || 0) + 1;
      this.closeEnc(p, true);
      this.addLog('story', p.name + ' slips away like smoke. Whatever it was, it is holding an empty coat.', { p: p.id });
      this.moveTo(p, to, 'slip');
      return { ok: true };
    }
    if (!active) return { error: 'Use your gift on your own turn.' };
    var inEnc = this.turn.enc && this.turn.enc.kind !== 'loc' && this.turn.enc.kind !== 'event';
    if (cls === 'hunter') {
      if (p.cd.ability > 0) return { error: 'Your snares are not ready (' + p.cd.ability + ' round' + (p.cd.ability > 1 ? 's' : '') + ').' };
      if (this.turn.ap < 1) return { error: 'No actions left this turn.' };
      this.turn.ap -= 1; p.cd.ability = lvl >= 1 ? 1 : 2;
      w.locs[p.loc].snare = p.id;
      this.addLog('story', p.name + ' lays a snare. The next thing to come here will learn about it.', { p: p.id, loc: p.loc });
    } else if (cls === 'apothecary') {
      if (p.cd.ability > 0) return { error: 'Your kettle is still hot (' + p.cd.ability + ' round).' };
      var need = lvl >= 1 ? 1 : 2;
      if (this.itemCount(p, 'herb') < need) return { error: 'You need ' + need + ' Gravemoss.' };
      var mk = c.make;
      if (['tonic', 'salt', 'clarity'].indexOf(mk) < 0) return { error: 'Choose what to brew.' };
      var tgt = c.target ? this.get(c.target) : p;
      if (mk === 'clarity' && (!tgt || tgt.status !== 'alive' || tgt.loc !== p.loc)) return { error: 'They are not here.' };
      this.removeItem(p, 'herb', need); p.cd.ability = 1;
      if (mk === 'tonic') this.addItem(p, 'tonic', 1);
      else if (mk === 'salt') this.addItem(p, 'salt', 1);
      else this.heal(tgt, 'san', 3, ctx);
      this.addLog('story', p.name + ' brews a ' + (mk === 'clarity' ? 'Clarity Draught' : mk === 'tonic' ? 'Minor Tonic' : 'Salt Charm') + '.', { p: p.id });
    } else if (cls === 'medium') {
      if (p.cd.ability > 0) return { error: 'The veil is thick today (' + p.cd.ability + ' rounds).' };
      if (this.turn.ap < 1) return { error: 'No actions left this turn.' };
      var tg = c.target ? this.get(c.target) : p;
      if (!tg || tg.status !== 'alive' || tg.loc !== p.loc) return { error: 'They are not here.' };
      this.turn.ap -= 1; p.cd.ability = 2;
      this.heal(tg, 'san', tg === p ? 1 : (lvl >= 1 ? 3 : 2), ctx);
      if (lvl < 1) this.advanceClock(1, 'The dead noticed the calling.');
      this.addLog('story', p.name + ' speaks softly to the other side. ' + (tg === p ? 'They' : tg.name) + ' breathe easier.', { p: p.id });
    } else if (cls === 'exorcist') {
      var left = p.uses.ritesLeft == null ? 3 : p.uses.ritesLeft;
      if (left <= 0) return { error: 'You have no rites left.' };
      if (this.turn.ap < 1) return { error: 'No actions left this turn.' };
      var mode = c.mode, L = w.locs[p.loc];
      if (mode === 'purify') { if (!L.corrupt) return { error: 'This place is not corrupted.' }; L.corrupt = 0; this.addLog('story', p.name + ' purifies ' + D.locations[p.loc].name + '.', { p: p.id }); }
      else if (mode === 'cleanse') { if (!w.curses[c.curse]) return { error: 'Choose an active curse.' }; this.cleanseCurse(c.curse, p, ctx); }
      else if (mode === 'seal') { L.seal = w.round + 3; this.addLog('story', p.name + ' seals ' + D.locations[p.loc].name + ' against the Hollow.', { p: p.id }); }
      else if (mode === 'banish') {
        var en = w.enemies.find(function (x) { return x.loc === p.loc && !x.dead && D.enemies[x.id].type === 'spirit' && x.hp <= 2; });
        if (!en) return { error: 'There is no weak spirit here to banish.' };
        en.hp = 0; var cx = { lines: [], chips: [], enemy: en, enc: this.turn.enc, p: p }; this.defeatEnemy(en, p, cx);
        if (this.turn.enc && this.turn.enc.enemy === en.uid) { this.turn.enc.result = { opt: 'Rite of Sealing', tier: 'auto', lines: cx.lines, chips: cx.chips, n: this.n + 1, by: p.id }; this.turn.enc.over = true; }
      } else return { error: 'Choose a rite.' };
      p.uses.ritesLeft = left - 1; this.turn.ap -= 1;
    }
    this.afterAction(p);
    return { ok: true };
  };

  H.mixin(M);
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
