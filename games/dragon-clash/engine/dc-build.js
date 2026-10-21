/*!
 * Dragon Clash — build validation.
 *
 * A build is only ids (body, mobility, element, signature, ability, upgrade) plus cosmetics. Combat numbers are
 * always derived here from the catalog in dc-data.js, never read from the build, so a modified client cannot
 * send itself extra stats. validateBuild() is called by the Forge, by the local match setup and by the server.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dc-data.js'));
  else { root.DC = root.DC || {}; root.DC.Build = factory(root.DC.Data); }
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  var HEX = /^#[0-9a-fA-F]{6}$/;
  var COLOR_KEYS = ['primary', 'secondary', 'belly', 'eye'];

  function own(obj, key) { return typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key); }

  /** Itemised cost: [{ slot, id, name, cost }] (unknown ids cost 0 and are reported by validateBuild). */
  function costBreakdown(b) {
    b = b || {};
    var rows = [
      { slot: 'body', table: D.BODIES, id: b.body },
      { slot: 'mobility', table: D.MOBILITY, id: b.mobility },
      { slot: 'signature', table: D.SIGNATURES, id: b.signature },
      { slot: 'ability', table: D.ABILITIES, id: b.ability },
      { slot: 'upgrade', table: D.UPGRADES, id: b.upgrade },
    ];
    return rows.map(function (r) {
      var item = own(r.table, r.id) ? r.table[r.id] : null;
      return { slot: r.slot, id: r.id, name: item ? item.name : '?', cost: item ? item.cost : 0 };
    });
  }

  function totalCost(b) {
    return costBreakdown(b).reduce(function (s, r) { return s + r.cost; }, 0);
  }

  /** Returns { ok, errors[], cost, remaining }. */
  function validateBuild(b, opts) {
    var errors = [];
    var budget = (opts && opts.budget) || D.BUDGET;
    if (!b || typeof b !== 'object') return { ok: false, errors: ['No build.'], cost: 0, remaining: budget };
    if (!own(D.ELEMENTS, b.element)) errors.push('Unknown element.');
    if (!own(D.BODIES, b.body)) errors.push('Unknown body package.');
    if (!own(D.MOBILITY, b.mobility)) errors.push('Unknown mobility package.');
    if (!own(D.SIGNATURES, b.signature)) errors.push('Unknown signature move.');
    else if (D.SIGNATURES[b.signature].element !== b.element) errors.push('Signature move does not match the element.');
    if (!own(D.ABILITIES, b.ability)) errors.push('Unknown elemental ability.');
    else if (D.ABILITIES[b.ability].element !== b.element) errors.push('Elemental ability does not match the element.');
    if (!own(D.UPGRADES, b.upgrade)) errors.push('Unknown upgrade.');
    if (typeof b.name !== 'string' || !b.name.trim()) errors.push('Name your dragon.');
    else if (b.name.length > 18) errors.push('Name is too long (18 letters max).');
    var cost = totalCost(b);
    if (cost > budget) errors.push('Over budget: ' + cost + ' / ' + budget + ' points.');
    var lookErr = validateLook(b.look);
    if (lookErr) errors.push(lookErr);
    return { ok: errors.length === 0, errors: errors, cost: cost, remaining: budget - cost };
  }

  function validateLook(look) {
    if (!look || typeof look !== 'object') return 'Missing appearance.';
    for (var slot in D.PARTS) {
      if (!own(D.PARTS[slot], look[slot])) return 'Unknown ' + slot + ' part.';
    }
    for (var i = 0; i < COLOR_KEYS.length; i++) {
      if (typeof look[COLOR_KEYS[i]] !== 'string' || !HEX.test(look[COLOR_KEYS[i]])) return 'Bad colour: ' + COLOR_KEYS[i] + '.';
    }
    return null;
  }

  /** A clean copy holding only known fields (use before storing or sending a build). */
  function sanitize(b) {
    b = b || {};
    var look = {};
    var src = b.look || {};
    for (var slot in D.PARTS) look[slot] = src[slot];
    COLOR_KEYS.forEach(function (k) { look[k] = src[k]; });
    return {
      id: typeof b.id === 'string' ? b.id.slice(0, 40) : undefined,
      name: typeof b.name === 'string' ? b.name.slice(0, 40) : '',
      element: b.element, body: b.body, mobility: b.mobility, signature: b.signature, ability: b.ability, upgrade: b.upgrade,
      look: look,
    };
  }

  /** Combat stats the simulation uses. Only call on a validated build. */
  function deriveStats(b) {
    var body = D.BODIES[b.body], mob = D.MOBILITY[b.mobility], up = D.UPGRADES[b.upgrade];
    var cd = up.cooldown || 1;
    return {
      element: b.element,
      weight: body.weight,
      hurt: { w: body.hurt.w, h: body.hurt.h },
      scale: body.scale.slice(),
      physMult: body.physMult,
      lightPhys: up.lightPhys || 1,
      reach: up.reach || 1,
      kbTaken: up.kbTaken || 1,
      run: mob.run * body.speedMult,
      air: mob.air * body.speedMult,
      jump: mob.jump,
      airJumps: mob.airJumps + (up.airJumps || 0),
      dodgeCd: Math.round(mob.dodgeCd * (up.dodgeCd || 1)),
      dashMult: mob.dashMult,
      glide: !!mob.glide,
      signature: b.signature,
      ability: b.ability,
      sigCd: Math.round(D.SIGNATURES[b.signature].cooldown * cd),
      abilityCd: Math.round(D.ABILITIES[b.ability].cooldown * cd),
    };
  }

  /** 0–5 bars for the Forge's compact stat display. */
  function statBars(b) {
    var s = deriveStats(b);
    var sig = D.SIGNATURES[b.signature];
    var range = sig.spawn ? Math.min(5, 2 + Math.round(sig.spawn.speed * sig.spawn.life / 400)) : sig.boxes ? Math.min(5, 1 + Math.round((sig.boxes[0].x + sig.boxes[0].w) / 70)) : 2;
    return {
      power: clamp(Math.round((s.physMult - 0.9) * 20 + 1.5 + (sig.elem || (sig.spawn && sig.spawn.elem) || 0) / 4), 1, 5),
      durability: clamp(Math.round((s.weight - 70) / 13 * (s.kbTaken < 1 ? 1.15 : 1)), 1, 5),
      speed: clamp(Math.round((s.run - 3.6) * 1.6), 1, 5),
      air: clamp(s.airJumps + (s.glide ? 2 : 1) + (s.air > 4.4 ? 1 : 0), 1, 5),
      range: range,
    };
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function presetBuild(id) {
    var p = D.PRESETS.filter(function (x) { return x.id === id; })[0] || D.PRESETS[0];
    var b = JSON.parse(JSON.stringify(p));
    b.id = 'preset-' + p.id;
    b.preset = true;
    return b;
  }

  return { validateBuild: validateBuild, validateLook: validateLook, sanitize: sanitize, deriveStats: deriveStats,
           costBreakdown: costBreakdown, totalCost: totalCost, statBars: statBars, presetBuild: presetBuild };
});
