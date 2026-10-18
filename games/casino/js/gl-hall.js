/* Neon Casino — the machine hall in 3D: a row of six cabinets in the same back room, a stool and an animal in front of
   each. TABLES.slots has real spinning reel drums; TABLES.vpoker has a lit screen that deals cards. The server decides every
   stop and every card; this only draws them (see js/gl-scene.js for the engine and the model format).

   slots model:   spins[seat] = { state: 'spinning'|'done', no, grid (3×3, grid[reel][row]) | null, payout, wins }, strips
   vpoker model:  hands[seat] = { phase: 'hold'|'done', cards[5] (null = back), held[5] | null, name, payout }                    */
(function (global) {
  'use strict';
  var T = global.THREE, GL = global.CasinoGL, K = GL && GL.kit;
  if (!T || !K || !GL.TABLES) return;
  var H = GL.helpers, TAU = H.TAU, lerp = H.lerp, clamp = H.clamp, esc = GL.esc;

  var N = 6, SP = 1.55, MZ = -1.25, STOOL_Z = -0.4;
  function mx(i) { return (i - (N - 1) / 2) * SP; }

  // ───────────── textures ─────────────
  var SYM = {
    S7: function (g, cx, cy, s) { g.font = '900 ' + s * 0.95 + 'px Georgia, serif'; g.lineWidth = s * 0.07; g.strokeStyle = '#3a0508'; g.fillStyle = '#e02a2a'; g.strokeText('7', cx, cy + s * 0.04); g.fillText('7', cx, cy + s * 0.04); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(cx - s * 0.26, cy - s * 0.3, s * 0.34, s * 0.06); },
    BAR: function (g, cx, cy, s) { g.fillStyle = '#0c0c10'; g.fillRect(cx - s * 0.48, cy - s * 0.2, s * 0.96, s * 0.4); g.strokeStyle = '#d8b25a'; g.lineWidth = s * 0.035; g.strokeRect(cx - s * 0.46, cy - s * 0.18, s * 0.92, s * 0.36); g.fillStyle = '#f3e2a2'; g.font = '900 ' + s * 0.3 + 'px Georgia, serif'; g.fillText('BAR', cx, cy + s * 0.02); },
    BELL: function (g, cx, cy, s) { g.font = s * 0.8 + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; g.fillText('🔔', cx, cy + s * 0.04); },
    GEM: function (g, cx, cy, s) { g.font = s * 0.8 + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; g.fillText('💎', cx, cy + s * 0.04); },
    LEM: function (g, cx, cy, s) { g.font = s * 0.8 + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; g.fillText('🍋', cx, cy + s * 0.04); },
    CHR: function (g, cx, cy, s) { g.font = s * 0.8 + 'px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; g.fillText('🍒', cx, cy + s * 0.04); }
  };
  GL.drawSymbol = function (g, sym, cx, cy, s) { g.textAlign = 'center'; g.textBaseline = 'middle'; (SYM[sym] || SYM.CHR)(g, cx, cy, s); };
  /** One drum's skin: the strip's stops stacked top to bottom (row j = stop j), wrapped around the drum. Cell = 280 × 126. */
  function reelTexture(strip) {
    var n = strip.length, CW = 280, CH = 126;
    var tex = K.canvasTex(CW, CH * n, function (g, w, h) {
      for (var i = 0; i < n; i++) {
        var y = i * CH, gr = g.createLinearGradient(0, y, 0, y + CH);
        gr.addColorStop(0, '#cfc6b0'); gr.addColorStop(0.5, '#f6efdc'); gr.addColorStop(1, '#cfc6b0'); g.fillStyle = gr; g.fillRect(0, y, w, CH);
        g.strokeStyle = 'rgba(60,40,20,.4)'; g.lineWidth = 3; g.strokeRect(1, y + 1, w - 2, CH - 2);
        GL.drawSymbol(g, strip[i], w / 2, y + CH / 2, 112);
      }
      var r = K.rnd(8); for (var s = 0; s < 600; s++) { g.fillStyle = 'rgba(80,60,30,' + r() * 0.08 + ')'; g.fillRect(r() * w, r() * h, 2, 2); }
    }, [1, 1]);
    tex.offset.y = -0.5 / n;                     // stop j sits centred at angle -j·step from the front
    return tex;
  }
  /** A drum lying along x: u runs across its width, v once around it (v = angle ÷ 2π, measured upward from the front). */
  function drumGeometry() {
    var c = new T.CylinderGeometry(0.4, 0.4, 0.28, 40, 1, true); c.rotateZ(Math.PI / 2);
    var uv = c.attributes.uv;
    for (var i = 0; i < uv.count; i++) { var uo = uv.getX(i), vo = uv.getY(i); uv.setXY(i, 1 - vo, uo); }
    uv.needsUpdate = true;
    return c;
  }
  function signTexture(text, c1, c2) {
    return K.canvasTex(512, 128, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#f0d68a'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
      for (var i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#fff3c0' : '#d8a040'; g.beginPath(); g.arc(24 + i * 31, 20, 5, 0, TAU); g.fill(); g.beginPath(); g.arc(24 + i * 31, h - 20, 5, 0, TAU); g.fill(); }
      g.fillStyle = '#fff1c8'; g.shadowColor = '#ffb040'; g.shadowBlur = 18; g.textAlign = 'center'; g.textBaseline = 'middle';
      var size = 64; g.font = '900 ' + size + 'px "Cormorant Garamond", Georgia, serif';
      while (g.measureText(text).width > w - 70 && size > 24) { size -= 2; g.font = '900 ' + size + 'px "Cormorant Garamond", Georgia, serif'; }       // shrink long titles to fit inside the bulbs
      g.fillText(text, w / 2, h / 2 + 4);
    });
  }

  /** 1 win, 2 big win, 3 mega win, 4 jackpot, by payout against the bet. */
  GL.winTier = function (payout, bet) { var r = payout / Math.max(1, bet); return r >= 50 ? 4 : r >= 20 ? 3 : r >= 5 ? 2 : 1; };
  var coinTex = null;
  function coinTexture() {
    if (coinTex) return coinTex;
    return (coinTex = K.canvasTex(64, 64, function (g) {
      var gr = g.createRadialGradient(24, 22, 4, 32, 32, 30); gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.5, '#f0b830'); gr.addColorStop(1, '#8a5a10');
      g.beginPath(); g.arc(32, 32, 28, 0, TAU); g.fillStyle = gr; g.fill(); g.lineWidth = 4; g.strokeStyle = '#7a4a08'; g.stroke(); g.beginPath(); g.arc(32, 32, 19, 0, TAU); g.strokeStyle = 'rgba(120,70,8,.7)'; g.lineWidth = 2; g.stroke();
    }));
  }
  var LINE_Y = [1.533, 1.4, 1.267], LINE_DEF = [[0, 0], [1, 0], [2, 0], [0, -0.307], [0, 0.307]];

  // ───────────── cabinets ─────────────
  function cabinetGeo(forSlots) {
    var b = new K.Builder(23), s = K.Shapes(b), lacquer = '#4a1812', dark = '#1a0c08', brass = '#c9a24a';
    s.box(lacquer, -0.54, 1.02, 0, 0.1, 2.04, 0.76); s.box(lacquer, 0.54, 1.02, 0, 0.1, 2.04, 0.76);            // sides
    s.box(dark, 0, 1.0, -0.33, 1.0, 2.0, 0.1);                                                                   // back wall of the window
    s.box(lacquer, 0, 0.5, 0.0, 1.0, 1.0, 0.76);                                                                  // lower body
    s.box(lacquer, 0, 1.9, 0.0, 1.0, 0.28, 0.76);                                                                 // head, under the sign
    s.box('#241008', 0, 0.97, 0.3, 0.98, 0.1, 0.34, -0.3);                                                       // slanted control deck
    for (var i = 0; i < 5; i++) s.cyl(i === 2 ? '#d8302a' : '#2a6aa0', -0.36 + i * 0.18, 1.0, 0.36, 0, 0, 0, 0.055, 0.04, 0.055);   // buttons
    s.box(dark, 0, 0.18, 0.4, 0.62, 0.18, 0.1);                                                                   // coin tray
    s.box(brass, 0, 1.0, 0.382, 1.0, 0.025, 0.02); s.box(brass, 0, 1.78, 0.382, 1.0, 0.025, 0.02);                 // brass edges of the window
    s.box(brass, -0.5, 1.4, 0.382, 0.025, 0.78, 0.02); s.box(brass, 0.5, 1.4, 0.382, 0.025, 0.78, 0.02);
    s.box(brass, 0, 0.04, 0.0, 1.06, 0.08, 0.8);                                                                  // kick plate
    if (forSlots) {                                                                                               // masks: the window shows exactly three rows
      s.box('#1a0c08', 0, 1.1, 0.43, 1.0, 0.2, 0.06); s.box('#1a0c08', 0, 1.69, 0.43, 1.0, 0.18, 0.06);
      s.box(brass, 0, 1.2, 0.465, 0.96, 0.02, 0.01); s.box(brass, 0, 1.6, 0.465, 0.96, 0.02, 0.01);
      s.box('#d8302a', -0.47, 1.4, 0.47, 0.03, 0.05, 0.01); s.box('#d8302a', 0.47, 1.4, 0.47, 0.03, 0.05, 0.01);        // payline markers
    }
    return b.build();
  }

  function buildHall(E, forSlots) {
    var M = E.m, geo = cabinetGeo(forSlots), machines = [];
    var signMat = new T.MeshBasicMaterial({ map: signTexture(forSlots ? 'LUCKY SEVENS' : 'JACKS OR BETTER', forSlots ? '#7a1018' : '#10305a', forSlots ? '#2a0408' : '#06142a') });
    var strips = null, reelMats = null;
    for (var i = 0; i < N; i++) {
      var g = new T.Group(); g.position.set(mx(i), 0, MZ); E.scene.add(g);
      var body = new T.Mesh(geo, M.vcSmooth); body.castShadow = !E.noShadow; g.add(body);
      var sign = new T.Mesh(new T.PlaneGeometry(1.0, 0.25), signMat.clone()); sign.position.set(0, 2.17, 0.385); g.add(sign);
      var mach = { g: g, sign: sign, glow: 0.6, fx: null };
      // winning payline highlights and a coin shower, both dormant until a win
      mach.lines = [0, 1, 2, 3, 4].map(function (li) {
        var d = LINE_DEF[li], diag = li >= 3, len = diag ? 0.9 : 0.92;
        var mesh = new T.Mesh(new T.PlaneGeometry(len, 0.03), new T.MeshBasicMaterial({ color: 0xffe070, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
        mesh.position.set(0, diag ? 1.4 : LINE_Y[li], 0.48); mesh.rotation.z = d[1]; mesh.visible = false; g.add(mesh); return mesh;
      });
      var cn = 70, cpos = new Float32Array(cn * 3); for (var q = 0; q < cn; q++) cpos[q * 3 + 1] = -10;
      var cgeo = new T.BufferGeometry(); cgeo.setAttribute('position', new T.BufferAttribute(cpos, 3));
      mach.coinPts = new T.Points(cgeo, new T.PointsMaterial({ map: coinTexture(), size: 0.075, transparent: true, depthWrite: false, alphaTest: 0.1, fog: false }));
      mach.coinPts.frustumCulled = false; g.add(mach.coinPts);
      mach.coins = { n: cn, vel: new Float32Array(cn * 3), start: new Float32Array(cn), live: new Float32Array(cn) };
      if (forSlots) {
        mach.reels = []; mach.drums = [];
      } else {
        var canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
        var tex = new T.CanvasTexture(canvas); tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
        var scr = new T.Mesh(new T.PlaneGeometry(0.92, 0.69), new T.MeshBasicMaterial({ map: tex })); scr.position.set(0, 1.4, 0.37); g.add(scr);
        mach.canvas = canvas; mach.tex = tex; mach.sig = '';
      }
      var lever = new T.Group(); lever.position.set(0.6, 1.05, 0.0);
      var arm = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.5, 8), M.brass); arm.position.y = 0.25; lever.add(arm);
      var knob = new T.Mesh(new T.SphereGeometry(0.055, 12, 10), new T.MeshStandardMaterial({ color: 0xd8302a, roughness: 0.3 })); knob.position.y = 0.52; lever.add(knob);
      g.add(lever); mach.lever = lever;
      machines.push(mach);
    }
    return machines;
  }

  function reelsFor(E, mach, strips) {
    if (mach.reels.length || !strips) return;
    if (!E.reelMats) E.reelMats = strips.map(function (s) { return new T.MeshStandardMaterial({ map: reelTexture(s), roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.28, emissiveMap: null }); });
    E.reelMats.forEach(function (mat, r) {
      if (!mat.emissiveMap) mat.emissiveMap = mat.map;
      var geo = E.reelGeo || (E.reelGeo = drumGeometry());
      var d = new T.Mesh(geo, mat); d.position.set((r - 1) * 0.31, 1.4, 0.0); mach.g.add(d);
      mach.reels.push({ mesh: d, ang: 0, vel: 0, target: 0, mode: 'idle', stopAt: 0, no: 0 });
    });
    // curved glass look: a dark vignette plane in front of the drums
    var shade = new T.Mesh(new T.PlaneGeometry(0.92, 0.4), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0 }));
    shade.visible = false; mach.g.add(shade);
  }

  // ───────────── the video poker screen ─────────────
  var CELL_W = 128, CELL_H = 180, RANKS = 'A23456789TJQK', SUITS = 'SHDC';
  function drawScreen(E, mach, hand, bet, tableRules) {
    var c = mach.canvas, g = c.getContext('2d'), W = c.width, Hh = c.height;
    var gr = g.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, '#0a1c46'); gr.addColorStop(1, '#040a1e'); g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
    g.strokeStyle = '#6fa0ff'; g.lineWidth = 4; g.strokeRect(6, 6, W - 12, Hh - 12);
    g.font = '700 26px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'left'; g.fillStyle = '#ffe28a';
    var left = [['royal', 'ROYAL FLUSH', '800'], ['sflush', 'STRAIGHT FLUSH', '50'], ['four', 'FOUR OF A KIND', '25'], ['full', 'FULL HOUSE', '9'], ['flush', 'FLUSH', '6']];
    var right = [['straight', 'STRAIGHT', '4'], ['three', 'THREE OF A KIND', '3'], ['twopair', 'TWO PAIR', '2'], ['jacks', 'JACKS OR BETTER', '1']];
    var live = hand && (hand.phase === 'done' ? hand.rank : null);
    function row(list, x0, x1, i) { var r = list[i], y = 38 + i * 24; if (live && r[0] === live) { g.fillStyle = 'rgba(255,226,138,.28)'; g.fillRect(x0 - 8, y - 20, x1 - x0 + 24, 25); g.fillStyle = '#fff6c0'; } else g.fillStyle = '#ffe28a'; g.textAlign = 'left'; g.fillText(r[1], x0, y); g.textAlign = 'right'; g.fillText(r[2], x1, y); }
    left.forEach(function (r, i) { row(left, 20, 250, i); }); right.forEach(function (r, i) { row(right, 300, 620, i); }); g.textAlign = 'left';
    var atlas = E.atlas && E.atlas.image;
    var cards = hand ? hand.cards : [null, null, null, null, null], x0 = (W - (5 * 112 + 4 * 10)) / 2;
    for (var i = 0; i < 5; i++) {
      var cardV = cards[i], dx = x0 + i * 122, dy = 200, dw = 112, dh = 157;
      if (hand && atlas) {
        var sx, sy;
        if (cardV) { var ri = 'A23456789TJQK'.indexOf(cardV[0]); sx = ri * (atlas.width / 13); sy = SUITS.indexOf(cardV[1]) * (atlas.height / 5); } else { sx = 0; sy = 4 * (atlas.height / 5); }
        g.drawImage(atlas, sx, sy, atlas.width / 13, atlas.height / 5, dx, dy, dw, dh);
        if (hand.held && hand.held[i] && hand.phase === 'hold') { g.fillStyle = '#ffe28a'; g.font = '800 26px Manrope, sans-serif'; g.textAlign = 'center'; g.fillText('HELD', dx + dw / 2, dy - 8); g.strokeStyle = '#ffe28a'; g.lineWidth = 4; g.strokeRect(dx - 3, dy - 3, dw + 6, dh + 6); }
      } else { g.fillStyle = '#10265a'; g.fillRect(dx, dy, dw, dh); g.strokeStyle = '#2a4a9a'; g.lineWidth = 2; g.strokeRect(dx, dy, dw, dh); }
    }
    g.textAlign = 'center'; g.font = '800 30px "Cormorant Garamond", Georgia, serif';
    var msg = !hand ? 'PLACE YOUR BET' : hand.phase === 'hold' ? 'HOLD, THEN DRAW' : hand.payout ? hand.name.toUpperCase() + '  +' + hand.payout : 'NO WIN';
    g.fillStyle = hand && hand.phase === 'done' && hand.payout ? '#7dff9a' : '#ffe28a'; g.fillText(msg, W / 2, 410);
    g.fillStyle = '#9fb8ff'; g.font = '600 22px Manrope, sans-serif'; g.fillText(bet ? 'BET ' + bet : '', W / 2, 450);
    mach.tex.needsUpdate = true;
  }

  /** A win: coins out of the tray, winning lines flash, the marquee goes wild, the camera shakes a little (and the sound, if it's yours). */
  function startWin(E, mach, s, no, payout, bet, lines, silent) {
    var tier = GL.winTier(payout, bet);
    mach.paidNo = no;
    mach.fx = { t: 0, dur: 2.2 + tier * 0.9, tier: tier, lines: lines };
    var c = mach.coins, count = Math.min(c.n, 14 + tier * 14);
    for (var i = 0; i < c.n; i++) {
      c.live[i] = i < count ? 1 : 0; c.start[i] = Math.random() * mach.fx.dur * 0.55;
      c.vel[i * 3] = (Math.random() - 0.5) * 0.9; c.vel[i * 3 + 1] = 1.7 + Math.random() * 1.8; c.vel[i * 3 + 2] = 0.5 + Math.random() * 1.0;
    }
    if (s.me) { E.shake = Math.max(E.shake, tier >= 2 ? 0.7 + tier * 0.45 : 0); if (!silent && GL.audio) GL.audio.fanfare(tier); }
  }
  function stepFx(E, mach, dt, t, mine) {
    var fx = mach.fx;
    if (!fx) { mach.lines.forEach(function (l) { l.visible = false; }); return; }
    fx.t += dt;
    var on = fx.t < fx.dur + 0.8 && Math.floor(fx.t * 6) % 2 === 0;
    mach.lines.forEach(function (l, i) { l.visible = on && fx.lines.indexOf(i) >= 0; });
    var c = mach.coins, pos = mach.coinPts.geometry.attributes.position.array, any = false;
    for (var i = 0; i < c.n; i++) {
      if (!c.live[i]) { pos[i * 3 + 1] = -10; continue; }
      var age = fx.t - c.start[i];
      if (age < 0) { pos[i * 3 + 1] = -10; any = true; continue; }
      var x = (c.vel[i * 3]) * age + (i % 7 - 3) * 0.02, y = 0.4 + c.vel[i * 3 + 1] * age - 3.4 * age * age, z = 0.5 + c.vel[i * 3 + 2] * age;
      if (y < 0.02) { c.live[i] = 0; pos[i * 3 + 1] = -10; continue; }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; any = true;
    }
    mach.coinPts.geometry.attributes.position.needsUpdate = true;
    if (mine && E.hallGlow) E.hallGlow.intensity = 1.8 + (fx.t < fx.dur ? 2.2 * (0.5 + 0.5 * Math.sin(t * 18)) : 0);
    if (fx.t > fx.dur + 1.2 && !any) { mach.fx = null; if (mine && E.hallGlow) E.hallGlow.intensity = 1.8; }
  }

  // ───────────── the tables ─────────────
  function hallDef(forSlots) {
    return {
      hideSelf: function () { return false; },
      build: function (E) {
        E.machines = buildHall(E, forSlots);
        E.atlas = E.m.card.map;
        E.lampG.position.set(0, E.lampG.position.y, -0.55);
        var glow = new T.PointLight(forSlots ? 0xff8a50 : 0x7a9aff, 1.8, 5.5, 1.4); glow.position.set(0, 1.9, 0.2); E.scene.add(glow); E.hallGlow = glow;
        return {};
      },
      seatPose: function (E, i) { return { x: mx(i), z: STOOL_Z, ry: Math.PI }; },
      layout: function (E, m) {
        var out = { cards: [], chips: [], labels: [] };
        (m.seats || []).forEach(function (s, i) {
          var pose = E.seatPose(i);
          if (s.pid && !(s.me && !E.portrait)) out.labels.push(GL.helpers.seatTag(E, i, s, pose, {}));
          else if (s.pid && s.me) { /* first person: your wallet is in the HUD */ }
          else if (s.canSit) out.labels.push({ id: 'seat' + i, x: pose.x, y: 1.1, z: pose.z, html: '<button type="button" class="gl-sit" data-seat="' + i + '">Play here</button>', cls: 'gl-sitwrap', prio: 900 });
          var sp = forSlots ? (m.spins || {})[i] : (m.hands || {})[i];
          if (sp && !s.me && (sp.payout || sp.name) && (forSlots ? sp.state === 'done' : sp.phase === 'done') && sp.payout) {
            out.labels.push({ id: 'win' + i, x: mx(i), y: 2.5, z: MZ + 0.4, html: '<b>+' + esc(sp.payout) + '</b>' + (sp.name ? '<small>' + esc(sp.name) + '</small>' : ''), cls: 'gl-total active', prio: 10 });
          }
        });
        return out;
      },
      sync: function (E, m) {
        var self = this;
        (m.seats || []).forEach(function (s, i) {
          var mach = E.machines[i]; if (!mach) return;
          if (forSlots) {
            reelsFor(E, mach, m.strips);
            var sp = (m.spins || {})[i]; if (!sp) return;
            if (sp.state === 'spinning' && mach.fx) { mach.fx = null; mach.lines.forEach(function (l) { l.visible = false; }); for (var q = 0; q < mach.coins.n; q++) mach.coins.live[q] = 0; if (E.hallGlow) E.hallGlow.intensity = 1.8; }     // a new spin wipes the last win's lines and coins
            if (sp.state === 'done' && sp.payout > 0 && mach.paidNo !== sp.no) startWin(E, mach, s, sp.no, sp.payout, sp.bet, (sp.wins || []).map(function (w) { return w.line; }));
            mach.reels.forEach(function (r, ri) {
              if (sp.no !== r.no && sp.state === 'spinning') { r.no = sp.no; r.mode = 'spin'; r.vel = 13 + ri * 1.5; r.stopAt = performance.now() + 1500 + ri * 520; r.target = null; mach.leverT = 1; mach.tease = false; r.teased = null; if (GL.audio && s.me && ri === 0) { GL.audio.lever(); GL.audio.spin(); } }
              var grid = sp.grid;
              if (grid && m.strips && (r.target == null || r.targetNo !== sp.no)) {
                var strip = m.strips[ri], mid = grid[ri][1], idx = -1;
                for (var k = 0; k < strip.length; k++) if (strip[k] === mid && strip[(k + strip.length - 1) % strip.length] === grid[ri][0] && strip[(k + 1) % strip.length] === grid[ri][2]) { idx = k; break; }
                if (idx < 0) idx = strip.indexOf(mid);
                r.stopIdx = idx; r.targetNo = sp.no; r.target = -idx * (TAU / strip.length);
                if (r.mode === 'idle') { r.ang = r.target; }                      // a result we only just heard of: show it, no spin
                if (ri === 2 && r.mode === 'spin' && s.me && sp.state === 'spinning') {                   // anticipation: reels 1 and 2 agree on a line, so the last one takes its time
                  var VAL = { S7: 1, GEM: 1, BELL: 1, BAR: 1 }, g2 = sp.grid;
                  mach.tease = m.lines.some(function (l) { var a1 = g2[0][l[0]], b1 = g2[1][l[1]]; return a1 === b1 && VAL[a1]; });
                  if (mach.tease && r.teased !== sp.no) { r.teased = sp.no; r.stopAt += 900; }
                }
              }
              if (sp.state === 'done' && r.mode === 'spin' && r.target != null && r.stopAt > performance.now() + 700) r.stopAt = performance.now() + 150 + ri * 260;
            });
          } else {
            var h = (m.hands || {})[i], bet = h ? h.bet : (s.bet || 0);
            if (h && h.phase === 'done' && h.payout > 0 && mach.paidNo !== h.no) { mach.paidNo = h.no; setTimeout(function () { if (E.alive) startWin(E, mach, s, h.no, h.payout, h.bet, [], true); }, 1100); }      // after the new cards have flipped in
            var sig = JSON.stringify([h && h.cards, h && h.held, h && h.phase, h && h.payout, bet]);
            if (sig !== mach.sig) { mach.sig = sig; drawScreen(E, mach, h, bet); }
          }
        });
        var me = m.mySeat;
        if (me >= 0 && E.hallGlow) E.hallGlow.position.x = mx(me);
      },
      tick: function (E, dt, t) {
        var now = performance.now(), m = E.model; if (!m) return;
        E.machines.forEach(function (mach, i) {
          var spinning = false;
          if (forSlots && mach.reels) mach.reels.forEach(function (r, ri) {
            if (r.mode === 'spin') {
              spinning = true;
              if (r.target != null && now >= r.stopAt) { r.mode = 'stop'; r.stopT = 0; r.from = r.ang; var nn = Math.floor((r.from - r.target) / TAU); r.to = r.target + nn * TAU; if (r.from - r.to < 1.2) r.to -= TAU; if (GL.audio && m.seats[i] && m.seats[i].me) { GL.audio.reelStop(ri); if (ri === 1 && mach.tease) GL.audio.tease(); } }
              else r.ang -= r.vel * dt;
            } else if (r.mode === 'stop') {
              spinning = true; r.stopT += dt / 0.55; var u = Math.min(1, r.stopT), e = 1 - Math.pow(1 - u, 3);
              r.ang = lerp(r.from, r.to, e);
              if (u >= 1) { r.mode = 'idle'; r.ang = r.to; }
            }
            r.mesh.rotation.x = r.ang;
          });
          // lever pull and the marquee
          if (mach.leverT > 0) { mach.leverT = Math.max(0, mach.leverT - dt * 1.6); mach.lever.rotation.x = Math.sin(mach.leverT * Math.PI) * 0.9; }
          var sp = forSlots ? (m.spins || {})[i] : (m.hands || {})[i], won = sp && sp.payout > 0 && (forSlots ? sp.state === 'done' : sp.phase === 'done');
          stepFx(E, mach, dt, t, !!(m.seats[i] && m.seats[i].me));
          var flash = mach.fx ? 0.55 + 0.45 * Math.sin(t * 16 + i) : won ? 0.7 + Math.sin(t * 14) * 0.3 : spinning ? 0.8 : 0.6;
          mach.sign.material.color.setScalar(lerp(mach.sign.material.color.r, flash, 0.2));
        });
      },
      camera: function (E, m) {
        var me = m.mySeat >= 0 ? m.mySeat : -1, x = me >= 0 ? mx(me) : 0;
        if (me < 0) return GL.rig(E, [0, 1.3, MZ], E.portrait ? 4.2 : 9, 3.6, 0.2, 0, 56);
        if (E.portrait) return { pos: [x * 0.9, 2.75, 2.1], look: [x, 1.25, MZ], fov: 60 };
        return { pos: [x * 0.88, 2.65, 2.3], look: [x, 1.2, MZ], fov: 50 };
      }
    };
  }
  GL.TABLES.slots = hallDef(true);
  GL.TABLES.vpoker = hallDef(false);
})(window);
