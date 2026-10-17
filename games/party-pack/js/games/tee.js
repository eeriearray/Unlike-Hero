/* 5. The Chaos Mashup — draw random pictures, write random slogans, then build T-shirts from
   other people's work and battle them king-of-the-hill style. The champion shirt can be
   downloaded as a print-ready PNG from the lobby and taken to any print shop. */
(function () {
  'use strict';
  const PP = window.PP; const { esc, shuffle, pick, uid } = PP; const G = PP.G;
  const INK = ['#1b1b22', '#e8403a', '#2f6fdf', '#f2c230'];
  const TEE_PATH = 'M60 20 L100 6 Q128 28 156 6 L196 20 L246 62 L214 100 L192 86 L192 246 L64 246 L64 86 L42 100 L10 62 Z';

  const game = PP.GAMES.tee = {
    title: 'The Chaos Mashup', icon: '👕', accent: '#3ee08f', font: "'Bowlby One SC', 'Lilita One', sans-serif", min: 3,
    blurb: 'Draw anything. Write anything. Mash them into T-shirts that battle. Print the winner.',
    rules: ['Draw two pictures, write three slogans.', 'Build a shirt from your friends\' work.', 'Shirts battle king-of-the-hill. Every vote scores.', 'Print and ship the champion from the end screen.'],
    async run(ctx) {
      const C = ctx.content();
      await G.intro(ctx, game);
      const drawings = await drawPhase(ctx, C);
      const slogans = await sloganPhase(ctx, C);
      const shirts = await buildPhase(ctx, C, drawings, slogans);
      const champ = await battle(ctx, shirts, drawings);
      PP.Host.lastShirt = champ ? { shirt: champ, drawing: drawings.get(champ.d) } : null;
      await ctx.finale({ html: champ ? `<div class="champ-tee">${teeHtml(champ, 220)}<p>Print it from the lobby: <b>🖨 Print the champion shirt</b>.</p></div>` : '', hold: 9000 });
    }
  };

  // ---------- phases ----------
  async function drawPhase(ctx, C) {
    ctx.setPhase('DRAWING');
    G.busyStage(ctx, 'Draw two things', 'Anything goes. They\'ll end up on someone\'s chest.');
    ctx.say('draw');
    const ps = ctx.players(); const progress = new Map(); const out = new Map();
    const inspo = G.deal(ctx, 'teeInspo', C.teeInspo, ps.length * 2); const prompts = new Map(ps.map((p, i) => [p.id, inspo.slice(i * 2, i * 2 + 2).map(x => 'Draw ' + x)]));
    await ctx.ask({
      to: ps, secs: 70, clean: false,
      view: p => ({ type: 'draw', count: 2, prompt: prompts.get(p.id), palette: INK, sub: 'Draw anything' }),
      partial: (p, d, answers) => {
        if (!d || !(d.i === 0 || d.i === 1) || !d.drawing || typeof d.drawing.d !== 'string' || d.drawing.d.length > 15000) return false;
        const m = progress.get(p.id) || {}; m[d.i] = d.drawing; progress.set(p.id, m);
        if (m[0] && m[1]) { answers.set(p.id, m); return true; } return false;
      },
      botMulti: () => [{ i: 0, drawing: PP.Draw.botDrawing(INK) }, { i: 1, drawing: PP.Draw.botDrawing(INK.slice(1)) }]
    });
    for (const [id, m] of progress) Object.keys(m).forEach(k => out.set('dr_' + uid(6), { by: id, drawing: Object.assign(m[k], { p: m[k].p || INK }) }));
    return out;
  }
  async function sloganPhase(ctx, C) {
    ctx.setPhase('SLOGANS');
    G.busyStage(ctx, 'Write three slogans', 'Bumper stickers. Life advice. Threats.');
    ctx.say('slogan');
    const ps = ctx.players(); const progress = new Map();
    const starters = G.deal(ctx, 'teeSlogan', C.teeSlogan, ps.length * 3); const prompts = new Map(ps.map((p, i) => [p.id, starters.slice(i * 3, i * 3 + 3).map(x => 'Write ' + x)]));
    await ctx.ask({
      to: ps, secs: 60,
      view: p => ({ type: 'multitext', prompts: prompts.get(p.id), max: 45, placeholder: 'Your slogan' }),
      partial: (p, d, answers) => {
        if (!d || !(d.i >= 0 && d.i < 3) || !d.text) return false;
        const m = progress.get(p.id) || {}; m[d.i] = String(d.text).slice(0, 45); progress.set(p.id, m);
        if (Object.keys(m).length >= 3) { answers.set(p.id, m); return true; } return false;
      },
      botMulti: () => [0, 1, 2].map(i => ({ i, text: pick(ctx.content().botWords) }))
    });
    const items = [];
    for (const [id, m] of progress) Object.values(m).forEach(text => items.push({ id: 'sl_' + uid(6), by: id, text }));
    await ctx.moderate(items);
    return new Map(items.filter(i => !i.removed).map(i => [i.id, i]));
  }
  async function buildPhase(ctx, C, drawings, slogans) {
    ctx.setPhase('BUILDING');
    G.busyStage(ctx, 'Build your shirt', 'Pick a drawing, a slogan and a colour from your friends\' work.');
    ctx.say('build');
    const ps = ctx.players();
    if (!drawings.size) drawings.set('dr_house', { by: null, drawing: PP.Draw.botDrawing(INK) });
    if (!slogans.size) slogans.set('sl_house', { id: 'sl_house', by: null, text: 'I survived the Party Pack' });
    const dealt = new Map();
    ps.forEach(p => {
      const dIds = [...drawings.keys()], sIds = [...slogans.keys()];
      const pickSome = (ids, src) => { const others = shuffle(ids.filter(id => src.get(id).by !== p.id)); const own = shuffle(ids.filter(id => src.get(id).by === p.id)); return others.concat(own).slice(0, 3); };
      const hand = { d: pickSome(dIds, drawings), s: pickSome(sIds, slogans) };
      dealt.set(p.id, hand);
      hand.d.forEach(id => ctx.asset(p, id, drawings.get(id).drawing));
    });
    const res = await ctx.ask({
      to: ps, secs: 60,
      view: p => ({ type: 'shirt', drawings: dealt.get(p.id).d, slogans: dealt.get(p.id).s.map(id => ({ id, text: slogans.get(id).text })), colors: C.shirtColors }),
      validate: (p, d) => { const h = dealt.get(p.id); if (!d || !h.d.includes(d.d) || !h.s.includes(d.s)) return 'Pick a drawing and a slogan.'; return null; },
      bot: p => { const h = dealt.get(p.id); return { d: pick(h.d), s: pick(h.s), color: pick(C.shirtColors), pos: pick(['above', 'below']) }; }
    });
    return ps.map(p => {
      const h = dealt.get(p.id); const a = res.answers.get(p.id) || { d: pick(h.d), s: pick(h.s), color: C.shirtColors[0], pos: 'below', auto: true };
      const sl = slogans.get(a.s);
      return { id: 'sh_' + p.id, builder: p, d: a.d, slogan: sl.text, sloganBy: sl.by, artBy: drawings.get(a.d).by, color: C.shirtColors.includes(a.color) ? a.color : C.shirtColors[0], pos: a.pos === 'above' ? 'above' : 'below', drawing: drawings.get(a.d).drawing, auto: !!a.auto };
    });
  }
  async function battle(ctx, shirts, drawings) {
    if (!shirts.length) return null;
    await G.banner(ctx, 'SHIRT BATTLE', 'King of the hill. The winner stays on.', 2200);
    await ctx.say('battle');
    const order = shuffle(shirts); let champ = order[0]; const deltas = new Map();
    const add = (id, n) => { const p = ctx.byId(id); if (p) { ctx.score(p, n); deltas.set(id, (deltas.get(id) || 0) + n); } };
    for (let k = 1; k < order.length; k++) {
      const pair = [champ, order[k]];
      ctx.setPhase('BATTLE');
      const show = reveal => { ctx.stage(`<div class="tee-battle"><p class="step">Battle ${k} of ${order.length - 1}</p><div class="vs-row">${pair.map((s, i) => `<div class="tee-slot ${reveal ? (reveal.win === i ? 'win' : 'lose') : ''}">${i === 0 && k > 1 ? '<span class="crownlet">👑 champion</span>' : ''}<span class="num">${i + 1}</span>${teeHtml(s, 300)}${reveal ? `<p>${G.dots(ctx, reveal.voters[i].map(ctx.byId).filter(Boolean))} ${reveal.counts[i]} vote${reveal.counts[i] === 1 ? '' : 's'}</p><p class="muted">built by ${G.chip(ctx, s.builder)}</p>` : ''}</div>${i === 0 ? '<div class="vs">VS</div>' : ''}`).join('')}</div></div>`, 'tee-stage'); mountTees(pair); };
      show(null);
      const res = await ctx.ask({
        to: ctx.players(), secs: 15,
        view: p => ({ type: 'choice', prompt: 'Which shirt would you actually wear?', options: pair.map((s, i) => ({ label: `Shirt ${i + 1}: "${s.slogan}"`, badge: String(i + 1), disabled: s.builder === p, note: s.builder === p ? 'yours' : '' })) }),
        validate: (p, i) => pair[i] && pair[i].builder === p ? 'You can\'t vote for your own shirt.' : null,
        audience: { prompt: 'Which shirt would you wear?', options: pair.map((s, i) => `Shirt ${i + 1}: "${s.slogan}"`) },
        bot: p => pair[0].builder === p ? 1 : pair[1].builder === p ? 0 : (Math.random() < 0.5 ? 0 : 1)
      });
      const { counts, voters } = G.tally(res.answers, 2);
      const score = counts.map((c, i) => c + (res.audienceTotal ? 2 * res.audience[i] / res.audienceTotal : 0));
      const hyped = ctx.unanimous(res);
      const win = score[0] === score[1] ? 0 : score[0] > score[1] ? 0 : 1;   // ties go to the champion
      pair.forEach((s, i) => { const pts = Math.round(counts[i] * 100 * (hyped && res.audience[i] ? 2 : 1)); add(s.builder.id, pts); if (s.artBy && s.artBy !== s.builder.id) add(s.artBy, counts[i] * 50); if (s.sloganBy && s.sloganBy !== s.builder.id) add(s.sloganBy, counts[i] * 50); });
      PP.Audio.sfx('reveal'); show({ win, counts, voters });
      if (hyped) { ctx.hype('CROWD FAVOURITE ×2'); await ctx.say('hype'); }
      champ = pair[win];
      await ctx.wait(3200);
    }
    add(champ.builder.id, 1000);
    ctx.setPhase('CHAMPION');
    ctx.stage(`<div class="tee-champ"><h1>👑 Champion shirt</h1>${teeHtml(champ, 360)}<p class="big">Built by ${G.chip(ctx, champ.builder)}${champ.artBy ? ` · art by ${G.chip(ctx, ctx.byId(champ.artBy))}` : ''}${champ.sloganBy ? ` · slogan by ${G.chip(ctx, ctx.byId(champ.sloganBy))}` : ''}</p></div>`, 'tee-stage');
    mountTees([champ]);
    PP.Audio.sfx('win');
    await ctx.say('champ');
    await ctx.scoreboard('Shirt money', deltas, 4000);
    return champ;
  }

  // ---------- rendering ----------
  function teeHtml(s, size) {
    return `<div class="tee-big ${s.pos}" style="--tee:${s.color};--size:${size}px" data-tee="${esc(s.id)}">
      <svg viewBox="0 0 256 256" aria-hidden="true"><path d="${TEE_PATH}" fill="${s.color}" stroke="rgba(0,0,0,.35)" stroke-width="3"/></svg>
      <div class="print"><div class="art"></div><p class="slogan" style="color:${PP.Merch.inkFor(s.color)}">${esc(s.slogan)}</p></div></div>`;
  }
  function mountTees(list) {
    list.forEach(s => document.querySelectorAll(`[data-tee="${s.id}"] .art`).forEach(el => { el.innerHTML = ''; el.appendChild(PP.Draw.canvasFor(s.drawing, Math.round(parseInt(getComputedStyle(el.closest('.tee-big')).getPropertyValue('--size')) * 0.36), { transparent: true, lineScale: 1.4 })); }));
  }

  // ---------- print file ----------
  // The Main Stage renders a 3000×3600 px print file in the browser. Nothing is uploaded anywhere.
  PP.Merch = {
    inkFor(hex) { const n = parseInt(hex.slice(1), 16); const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)); return l > 150 ? '#16161c' : '#fbf8f1'; },
    printFile(s, drawing) {
      const W = 3000, Hh = 3600; const c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d');
      const art = document.createElement('canvas'); art.width = art.height = 2600; PP.Draw.render(art.getContext('2d'), drawing, 2600, { transparent: true, lineScale: 1.4 });
      const top = s.pos === 'above'; g.drawImage(art, 200, top ? 900 : 100, 2600, 2600);
      g.fillStyle = PP.Merch.inkFor(s.color); g.textAlign = 'center'; g.font = '900 220px system-ui, sans-serif';
      wrap(g, s.slogan.toUpperCase(), W / 2, top ? 380 : 3000, 2700, 240);
      return c.toDataURL('image/png');
      function wrap(ctx2, text, x, y, max, lh) { const words = text.split(' '); let line = '', yy = y; words.forEach(w => { const t = line ? line + ' ' + w : w; if (ctx2.measureText(t).width > max && line) { ctx2.fillText(line, x, yy); line = w; yy += lh; } else line = t; }); ctx2.fillText(line, x, yy); }
    },
    open(last) {
      const dlg = document.querySelector('#merch'); const s = last.shirt;
      const png = PP.Merch.printFile(s, last.drawing);
      dlg.innerHTML = `<form method="dialog" class="settings merch"><h2>🖨 Print the champion shirt</h2>
        <div class="row"><img src="${png}" alt="Print file preview" class="print-preview" style="background:${s.color}"><div>
        <p><b>"${esc(s.slogan)}"</b></p><p class="muted">Print file: 3000 × 3600 px PNG with a transparent background. Shirt colour ${esc(s.color)}.</p>
        <p class="muted">Download it and take it to any print shop or print-on-demand site.</p>
        <p><a class="btn primary" download="party-pack-champion.png" href="${png}">⬇ Download print file</a></p></div></div>
        <div class="row"><button class="btn" value="close">Close</button></div></form>`;
      dlg.showModal();
    }
  };
})();
