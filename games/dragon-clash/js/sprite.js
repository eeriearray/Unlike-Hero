/*
 * Dragon Clash — sprite-pack dragons (Emberfang, Frostwing, Ironmaw, Voltscale, Tidefang).
 *
 * A sprite dragon is a painted 25-animation pack under assets/dragons/<id>/ (manifest.json + 25 sheets, 384 px cells,
 * 4 columns, 3x frames incl. optical-flow in-betweens). Everything about a pack comes from its manifest (frame counts,
 * per-frame foot row `bot`, attack `active` window, guard `hold`, body centre `cx`), so a re-delivered pack drops in
 * with no code change. Sprites are cosmetic: the simulation never reads them. A Tracker per fighter turns the sim's
 * snapshot (state, state timer, move timer, velocity) into { a: sheet key, fr: fractional frame }; draw() paints it
 * with the frame's lowest opaque row on the fighter's feet.
 *
 * Memory: sheets are trimmed to the opaque area of their frames (tools/trim_sprites.py; manifest cw/ch/ox/oy), which
 * makes full resolution affordable (~230-300 MB a dragon decoded). The Low effects setting decodes at 70%. Only the
 * dragons in the match are kept (unloadExcept). Menus load just the idle sheet. If a manifest cannot be fetched (file://) the
 * dragon is drawn with its rig look instead.
 */
(function () {
  'use strict';

  var ROOT = 'assets/dragons/';
  var RES = 1;              // decoded size relative to the source cells (setRes: 0.7 on the Low effects setting)
  var K = 3;                // sheets hold each original frame plus two in-betweens
  var SCALE = 0.55;         // world units per source pixel (feet to horn tip ≈ 142, like the rig)
  var FPS = 30;             // source frames per second at 10 fps original: the sheets are 3x
  var NAMES = {
    idle: '01_Idle', run: '02_Running', run2: '03_Running_2', crawl: '04_Crawl', jump: '05_Jumping', jump2: '06_Jumping_2',
    fall: '07_Falling', land: '08_Landing', dodge: '09_Dodging', dodge2: '10_Dodging_2', guard: '11_Defence_1', guard2: '12_Defence_2',
    l1: '13_Light_Attack', h1: '14_Heavy_Attack', l2: '15_Light_Attack_2', l3: '16_Light_Attack_3', h2: '17_Heavy_Attack_2',
    e1: '18_Elemental_Attack', e2: '19_Elemental_Attack_2', hit: '20_Hit_Reaction', hit2: '21_Hit_Reaction_2', knock: '22_Knockback',
    recover: '23_Recovery', victory: '24_Victory', defeat: '25_Defeat',
  };
  var MOVE_ANIM = { jab: 'l1', utilt: 'l2', dtilt: 'l3', fsmash: 'h1', usmash: 'h2', dsmash: 'h2', nair: 'l3', fair: 'l1', uair: 'l2', dair: 'l3',
                    fheavyAir: 'h1', wingBurst: 'e2', meteor: 'h2', ledgeAttack: 'l1',
                    dashAttack: 'h1', getupAttack: 'l3', guardCounter: 'h2', grab: 'l1', ultimate: 'e2' };
  var COMBO = ['l1', 'l2', 'l3'];

  var packs = {};   // id → { man, cx, sheets: {key: {im, cols, n, bot, cw, ch}}, idle: Promise, all: Promise, failed }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pack(id) { return packs[id] || (packs[id] = { sheets: {}, cx: 165, hold: 4, active: {}, failed: false, man: null, manP: null, idleP: null, allP: null }); }

  function fetchImg(url) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error('image ' + url)); }; im.src = url; });
  }

  var warmCv = null;
  function warm(im) {
    try { if (!warmCv) { warmCv = document.createElement('canvas'); warmCv.width = warmCv.height = 1; } warmCv.getContext('2d').drawImage(im, 0, 0, 4, 4, 0, 0, 1, 1); } catch (e) { /* ignore */ }
  }

  function loadManifest(id) {
    var p = pack(id);
    if (p.manP) return p.manP;
    p.manP = fetch(ROOT + id + '/manifest.json').then(function (r) { if (!r.ok) throw new Error('manifest ' + r.status); return r.json(); }).then(function (raw) {
      p.man = raw.anims || raw;
      if (raw.cx) p.cx = raw.cx;
      var hd = p.man[NAMES.guard] && p.man[NAMES.guard].hold;
      if (hd && hd.length) p.hold = hd[Math.floor(hd.length / 2)];
      Object.keys(NAMES).forEach(function (k) { var m = p.man[NAMES[k]]; if (m && m.active) p.active[k] = [m.active[0] * K, Math.min(m.n, (m.active[m.active.length - 1] + 1) * K)]; });
      return true;
    }).catch(function () { p.failed = true; return false; });
    return p.manP;
  }

  function loadSheet(id, key) {
    var p = pack(id), nm = NAMES[key], hd = key === 'idleHD';
    if (hd) nm = NAMES.idle;
    if (p.sheets[key]) return Promise.resolve(true);
    var file = hd ? (p.man[nm].hd && p.man[nm].hd.file) : nm + '.png';
    if (!file) return Promise.resolve(false);
    return fetchImg(ROOT + id + '/' + file).then(function (im) {
      return (im.decode ? im.decode().catch(function () {}) : Promise.resolve()).then(function () {
        var w = Math.round(im.naturalWidth * (hd ? 1 : RES)), h = Math.round(im.naturalHeight * (hd ? 1 : RES));
        return (window.createImageBitmap ? createImageBitmap(im, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' }).catch(function () { return im; }) : Promise.resolve(im));
      });
    }).then(function (bm) {
      var m = p.man[nm], rows = Math.ceil(m.n / m.cols), w = bm.width || bm.naturalWidth, h = bm.height || bm.naturalHeight;
      warm(bm);
      if (!packs[id] || packs[id] !== p) { if (bm.close) bm.close(); return false; }   // evicted while loading
      p.sheets[key] = { im: bm, cols: m.cols, n: m.n, bot: m.bot, cw: w / m.cols, ch: h / rows, loop: !!m.loop, ox: m.ox || 0, oy: m.oy || 0, res: w / (m.cw ? m.cw * m.cols : w / RES) };
      return true;
    }).catch(function () { if (!hd) p.failed = true; return false; });
  }

  /** The sharpened 2x idle sheet (tools/upscale_idle.py) for big previews; loaded on first use. */
  function loadIdleHD(id) {
    var p = pack(id);
    return p.idleHDP || (p.idleHDP = loadIdle(id).then(function (ok) { return ok ? loadSheet(id, 'idleHD') : false; }));
  }

  /** The idle sheet only: enough for menus, select portraits and the rig-less decoy. */
  function loadIdle(id) {
    var p = pack(id);
    return p.idleP || (p.idleP = loadManifest(id).then(function (ok) { return ok ? loadSheet(id, 'idle') : false; }));
  }

  /** Every sheet of one dragon, a few at a time. cb(done, total) reports progress. */
  function load(id, cb) {
    var p = pack(id);
    if (p.allP) return p.allP;
    p.allP = loadManifest(id).then(function (ok) {
      if (!ok) return false;
      var keys = Object.keys(NAMES).filter(function (k) { return p.man[NAMES[k]]; }), done = 0, i = 0;
      return new Promise(function (resolve) {
        function next() {
          if (i >= keys.length) { if (done >= keys.length) resolve(!p.failed); return; }
          var k = keys[i++];
          loadSheet(id, k).then(function () { done++; if (cb) cb(done, keys.length); next(); });
        }
        for (var w = 0; w < 3; w++) next();
      });
    });
    return p.allP;
  }

  function loadAll(ids, cb) {
    var prog = {};
    return Promise.all(ids.map(function (id) { return load(id, function (d, t) { prog[id] = d / t; if (cb) cb(ids.reduce(function (s, k) { return s + (prog[k] || 0); }, 0) / ids.length); }); }));
  }

  /** Free every dragon not in `keep` (decoded sheets are the whole memory cost). */
  function unloadExcept(keep) {
    Object.keys(packs).forEach(function (id) {
      if (keep.indexOf(id) >= 0) return;
      var p = packs[id];
      Object.keys(p.sheets).forEach(function (k) { if (p.sheets[k].im.close) p.sheets[k].im.close(); });
      delete packs[id];
    });
  }

  function ready(id) { var p = packs[id]; return !!(p && p.allP && p.sheets.idle && Object.keys(p.sheets).length >= 20); }
  function usable(id) { var p = packs[id]; return !!(p && !p.failed && p.sheets.idle); }

  // ───────────────────────────── frame selection ─────────────────────────────
  function Tracker() {
    this.phase = 0; this.peak = 1; this.j2 = false; this.hitN = 0; this.combo = 0; this.comboT = -999;
    this.prev = null; this.mvN = 0; this.force = null; this.forceT = 0; this.time = 0;
  }

  function span(p, key, k) {
    var s = p.sheets[key];
    return { a: key, fr: clamp(k, 0, 1) * (s ? s.n - 0.001 : 0) };
  }

  /** f: fighter snapshot. env: { force: 'victory'|'defeat'|null }. Returns { a, fr, dy }. */
  Tracker.prototype.update = function (id, f, build, time, dt, env) {
    var p = packs[id];
    if (!p || !p.sheets.idle) return null;
    var pr = this.prev || {}, S = p.sheets, T = f.stT, vx = f.vx * f.fc;
    var force = env && env.force || null;
    if (force !== this.force) { this.force = force; this.forceT = 0; }
    if (force) this.forceT += dt;
    this.time = time;
    // Per-state bookkeeping
    if (f.st === 'run' || f.st === 'crawl') this.phase += 0.24 * Math.abs(f.vx) * dt * 60;
    // Running 2 is the sprint: it takes over after half a second of running flat out (or at any time above 5.6)
    this.runT = f.st === 'run' && Math.abs(f.vx) > 3.8 ? (this.runT || 0) + dt : 0;
    if (f.gr || f.st === 'ledge') { this.peak = 1; this.j2 = false; }
    else if (f.vy < 0) this.peak = Math.max(this.peak, -f.vy);
    if (pr.aj != null && f.aj < pr.aj && !f.gr) { this.j2 = true; this.peak = Math.max(1, -f.vy); }
    if (f.st === 'hitstun' && pr.st !== 'hitstun') this.hitN ^= 1;
    if (f.st === 'attack' && (pr.st !== 'attack' || pr.mv !== f.mv || f.mT < (pr.mT || 0))) {
      this.mvN++;
      this.combo = time - this.comboT < 0.8 && f.mv === pr.lastMv ? (this.combo + 1) % 3 : 0;
    }
    if (f.st === 'attack') { this.comboT = time; this.lastMv = f.mv; }
    if (f.st === 'recoil' && pr.st === 'throwing') this.afterThrow = true;
    if (f.st !== 'recoil') this.afterThrow = false;
    this.prev = { st: f.st, aj: f.aj, mv: f.mv, mT: f.mT, lastMv: this.lastMv };

    var out = { a: 'idle', fr: time * FPS, dy: 0 };
    if (force === 'victory') { out.a = 'victory'; out.fr = Math.min(S.victory.n - 1, this.forceT * 36); return out; }
    if (force === 'defeat') { out.a = 'defeat'; out.fr = Math.min(S.defeat.n - 1, this.forceT * 42); return out; }

    switch (f.st) {
      case 'run':
        out.a = (Math.abs(f.vx) > 5.6 || this.runT > 0.5) && S.run2 ? 'run2' : 'run';
        out.fr = this.phase * 3;
        break;
      case 'squat': out.a = 'jump'; out.fr = Math.min(6, T * 1.2); break;
      case 'air': {
        if (f.vy < 0) {
          out.a = this.j2 && S.jump2 ? 'jump2' : 'jump';
          var n = S[out.a].n, k = clamp(1 - (-f.vy) / this.peak, 0, 1);
          out.fr = 7 + k * (n - 9);
        } else { out.a = 'fall'; out.fr = time * 30; }
        break;
      }
      case 'land':
        if (env && env.knock) { out.a = 'recover'; out.fr = clamp(T / 26, 0, 1) * (S.recover.n - 1); }
        else { out.a = 'land'; out.fr = Math.min(S.land.n - 1, T * 2.2); }
        break;
      case 'dodge':
        if (Math.abs(f.vx) > 1.5 || (env && env.dashing)) { out.a = vx < 0 ? 'dodge' : 'dodge2'; out.fr = clamp(T / 26, 0, 1) * (S[out.a].n - 1); }
        else guard(this, p, out, 'guard', T, 26);
        break;
      case 'airdodge': guard(this, p, out, 'guard2', T, 30); break;
      // No hang frames in the packs: the falling pose, raised so the claws sit on the lip and pulled back off the rock face
      case 'ledge': out.a = 'fall'; out.fr = 6; out.dy = -16; out.dx = -30; break;
      case 'ledgeclimb': out.a = 'recover'; out.fr = clamp(T / 22, 0, 1) * (S.recover.n - 1); break;
      case 'hitstun':
        if (f.tb) { out.a = 'knock'; out.fr = Math.min(17, T * 0.9); }
        else { out.a = this.hitN ? 'hit' : 'hit2'; out.fr = clamp(T / 24, 0, 1) * (S[out.a].n - 1); }
        break;
      case 'attack': attack(this, p, f, build, out); break;
      case 'guard': case 'blockstun':
        if (f.st === 'blockstun' || f.hl > 0) {
          // A blocked (or parried) hit: Defence 2, whose frames carry the shield arc, played through the blockstun
          out.a = 'guard2'; out.fr = f.st === 'blockstun' ? Math.min(S.guard2.n - 4, 5 + T * 1.1) : S.guard2.n * 0.45;
        } else {
          // Raising the guard: Defence 1 up to its peak, then a slow sway around it while it is held
          var peak = Math.round(S.guard.n * 0.45);
          out.a = 'guard'; out.fr = T < peak ? T : peak + 3 + 3 * Math.sin((T - peak) * 0.12);
        }
        break;
      case 'crouch': if (S.crawl) { out.a = 'crawl'; out.fr = 1.5 + 1.5 * Math.sin(time * 2); } break;
      case 'crawl': if (S.crawl) { out.a = 'crawl'; out.fr = this.phase * 2.2; } break;
      case 'stagger': out.a = 'hit2'; out.fr = (0.5 + 0.5 * Math.sin(time * 4)) * (S.hit2.n * 0.5); break;
      case 'recoil':
        if (this.afterThrow && S.h1) { var hs = p.active.h1 || [S.h1.n * 0.4, S.h1.n * 0.6]; out.a = 'h1'; out.fr = hs[0] + clamp(T / 12, 0, 1) * (S.h1.n - 1 - hs[0]); }
        else { out.a = 'hit'; out.fr = clamp(T / 14, 0, 1) * (S.hit.n * 0.6); }
        break;
      case 'grabbed': out.a = 'hit'; out.fr = S.hit.n * (0.3 + 0.1 * Math.sin(time * 14)); out.dy = -8; break;
      case 'throwing': { var ha = p.active.h1 || [S.h1.n * 0.4]; out.a = 'h1'; out.fr = clamp(T / 18, 0, 1) * ha[0] * 0.9; break; }
      // Knocked down: the collapsed end of Defeat (Recovery starts mid-air, so it only plays the rise)
      case 'down': out.a = 'defeat'; out.fr = Math.min(S.defeat.n - 1, 22 + T * 0.6); break;
      case 'getup':
        if (f.gu === 'roll' && S.dodge) { out.a = 'dodge'; out.fr = clamp(T / 28, 0, 1) * (S.dodge.n - 1); }
        else { var r0 = Math.round(S.recover.n * 0.27); out.a = 'recover'; out.fr = r0 + clamp(T / 20, 0, 1) * (S.recover.n - 1 - r0); }
        break;
      case 'wallsplat': out.a = 'knock'; out.fr = 10; break;
      case 'taunt': out.a = 'victory'; out.fr = clamp(T / 50, 0, 1) * (S.victory.n - 1); break;
      default: break;
    }
    return out;
  };

  // Raise the guard, hold the peak while the dodge lasts, then play the rest out
  function guard(tr, p, out, key, T, total) {
    var s = p.sheets[key], hold = Math.min(s.n - 2, p.hold * K), up = 3, rel = total * 0.7;
    out.a = key;
    out.fr = T < up ? T / up * hold : T < rel ? hold + 1.6 * Math.sin((T - up) * 0.5) : hold + (T - rel) / (total - rel) * (s.n - 1 - hold);
  }

  function attack(tr, p, f, build, out) {
    var A = window.DCAnim.attackPhase(f, build);
    if (!A) return;
    var key = f.mv === 'sig' ? 'e1' : f.mv === 'ability' ? 'e2' : MOVE_ANIM[f.mv] || 'l1';
    if (COMBO.indexOf(key) >= 0 && (f.mv === 'jab' || f.mv === 'fair' || f.mv === 'nair')) key = COMBO[(COMBO.indexOf(key) + tr.combo) % 3];
    var s = p.sheets[key];
    if (!s) return;
    var act = p.active[key] || [s.n * 0.4, s.n * 0.6], a0 = act[0], a1 = Math.max(a0 + 1, act[1]);
    out.a = key;
    out.fr = A.phase === 'startup' ? A.p * a0 : A.phase === 'active' ? a0 + A.p * (a1 - a0) : a1 + A.p * (s.n - 1 - a1);
  }

  /** Looping demo for menus: kind is a DCAnim.showcase kind. */
  Tracker.showcase = function (kind, time) {
    var c = (time % 2) / 2;
    var map = { run: 'run', jump: 'jump', hit: 'hit', attack: 'h1', light: 'l1', spin: 'h2', up: 'l2', tail: 'l3', special: 'e1', victory: 'victory', defeat: 'defeat' };
    return { a: map[kind] || 'idle', fr: kind === 'victory' ? Math.min(33, time * 36) : kind === 'defeat' ? Math.min(39, time * 30) : c * 40, dy: 0, loop: true };
  };

  // ───────────────────────────── drawing ─────────────────────────────
  /**
   * Paint a sprite dragon with its feet at the current origin. Returns false (draw nothing) when the pack is not
   * usable, so the caller falls back to the rig. pose: { desc|spr, facing, alpha, flash, dx, dy, time }.
   */
  // Recolouring: the frame is copied to a scratch canvas, re-hued with the 'hue' blend (keeps the painted light and
  // shade, swaps the colour) and/or given a finish, then masked back to the frame's own alpha.
  var scratch = null;
  var SHADE_OPS = { shadow: [['multiply', '#5a5866', 1]], gilded: [['color', '#d9a441', 0.55], ['soft-light', '#ffe0a0', 0.35]],
                    bone: [['saturation', '#808080', 1], ['screen', '#2e2a26', 1]], spectral: [['saturation', '#808080', 0.8], ['screen', '#1e4a6a', 1]] };
  function recolor(s, sx, sy, look) {
    var D = window.DC.Data, T = look && look.tint && D.TINTS[look.tint], ops = look && look.shade ? SHADE_OPS[look.shade] : null;
    if (!(T && T.color) && !ops) return null;
    if (!scratch) scratch = document.createElement('canvas');
    if (scratch.width !== Math.ceil(s.cw) || scratch.height !== Math.ceil(s.ch)) { scratch.width = Math.ceil(s.cw); scratch.height = Math.ceil(s.ch); }
    var c = scratch.getContext('2d');
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, scratch.width, scratch.height);
    c.drawImage(s.im, sx, sy, s.cw, s.ch, 0, 0, s.cw, s.ch);
    if (T && T.color) { c.globalCompositeOperation = 'hue'; c.globalAlpha = 0.9; c.fillStyle = T.color; c.fillRect(0, 0, s.cw, s.ch); }
    (ops || []).forEach(function (o) { c.globalCompositeOperation = o[0]; c.globalAlpha = o[2]; c.fillStyle = o[1]; c.fillRect(0, 0, s.cw, s.ch); });
    c.globalCompositeOperation = 'destination-in'; c.globalAlpha = 1;
    c.drawImage(s.im, sx, sy, s.cw, s.ch, 0, 0, s.cw, s.ch);
    c.globalCompositeOperation = 'source-over';
    return scratch;
  }

  function draw(ctx, id, pose, body, look) {
    var p = packs[id];
    if (!p) { loadIdle(id); return false; }
    if (p.failed || !p.sheets.idle) return false;
    var d = pose.spr || { a: 'idle', fr: (pose.time || 0) * FPS, dy: 0 };
    var s = p.sheets[d.a] || p.sheets.idle;
    // Big previews ask for the sharpened 2x idle sheet (same frames, same offsets: only its resolution differs)
    if (pose.hd && (d.a === 'idle' || !p.sheets[d.a])) { if (p.sheets.idleHD) s = p.sheets.idleHD; else loadIdleHD(id); }
    if (!p.sheets[d.a]) d = { a: 'idle', fr: (pose.time || 0) * FPS, dy: 0 };
    var loop = s.loop || d.a === 'idle';
    var i = Math.floor(d.fr);
    i = loop ? ((i % s.n) + s.n) % s.n : clamp(i, 0, s.n - 1);
    var sx = (body && body.scale[0]) || 1, sy = (body && body.scale[1]) || 1;
    var k = SCALE, w = s.cw / s.res * k, h = s.ch / s.res * k;
    var botRow = (s.bot[i] != null ? s.bot[i] : 350) + 1;
    ctx.save();
    ctx.translate((pose.dx || 0) + (d.dx || 0) * (pose.facing || 1) * sx, (pose.dy || 0) + (d.dy || 0) * sy);
    ctx.scale((pose.facing || 1) * sx, sy);
    var a0 = ctx.globalAlpha;
    if (pose.alpha != null) ctx.globalAlpha = a0 * pose.alpha;
    var col = i % s.cols, row = (i / s.cols) | 0, ox = (s.ox - p.cx) * k, oy = (s.oy - botRow) * k;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    var rc = recolor(s, col * s.cw, row * s.ch, look);
    if (rc) ctx.drawImage(rc, 0, 0, s.cw, s.ch, ox, oy, w, h);
    else ctx.drawImage(s.im, col * s.cw, row * s.ch, s.cw, s.ch, ox, oy, w, h);
    if (pose.flash > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a0 * Math.min(1, pose.flash) * 0.9;
      ctx.drawImage(s.im, col * s.cw, row * s.ch, s.cw, s.ch, ox, oy, w, h);
    }
    ctx.restore();
    return true;
  }

  /** Decode resolution for sheets loaded from now on (1 = source pixels). */
  function setRes(r) { RES = r; }

  window.DCSprites = { ROOT: ROOT, setRes: setRes, NAMES: NAMES, Tracker: Tracker, load: load, loadAll: loadAll, loadIdle: loadIdle, unloadExcept: unloadExcept, ready: ready, usable: usable, draw: draw, packs: packs };
})();
