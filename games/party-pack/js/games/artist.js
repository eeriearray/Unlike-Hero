/* 3. The Terrible Artist — draw a weird prompt with no eraser; everyone else writes decoy titles;
   then the room hunts for the real one. Round 2 is Blind Contour: your ink vanishes from your
   own phone as you draw, while the big screen shows every line. */
(function () {
  'use strict';
  const PP = window.PP; const { esc, shuffle, pick } = PP; const G = PP.G;
  const INKS = [['#1b1b22', '#e8403a'], ['#1b1b22', '#2f6fdf'], ['#1b1b22', '#3bb273'], ['#1b1b22', '#b06ad9'], ['#1b1b22', '#f29d30'], ['#1b1b22', '#e04fa8']];

  const game = PP.GAMES.draw = {
    title: 'The Terrible Artist', icon: '🎨', accent: '#ffc531', font: "'Permanent Marker', 'Lilita One', sans-serif", min: 3,
    blurb: 'Draw weird prompts with no eraser. Write fake titles for everyone else\'s art. Find the real one.',
    rules: ['Draw your secret prompt. No eraser, no undo.', 'Write a fake title for each drawing.', 'Find the real title: +1000 to you and the artist.', 'Fool someone with your fake: +500.', 'Round 2: Blind Contour. Your ink disappears as you draw.'],
    async run(ctx) {
      const C = ctx.content(); const used = new Set();
      await G.intro(ctx, game);
      for (const blind of [false, true]) await round(ctx, C, used, blind);
      await ctx.finale();
    }
  };

  async function round(ctx, C, used, blind) {
    const mult = blind ? 2 : 1;
    await G.banner(ctx, blind ? 'BLIND CONTOUR' : 'Round 1', blind ? 'Your drawing vanishes from your phone as you draw it. Points ×2.' : 'Draw what your phone tells you.', 2600);
    if (blind) await ctx.say('blind'); else ctx.say('draw');
    const ps = ctx.players();
    const dealt = G.deal(ctx, 'draw', C.draw, ps.length); const prompts = new Map(ps.map((p, i) => [p.id, dealt[i]]));
    const inks = new Map(ps.map((p, i) => [p.id, INKS[(i + (blind ? 3 : 0)) % INKS.length]]));
    ctx.setPhase('DRAWING');
    G.busyStage(ctx, blind ? 'Draw… blind' : 'Draw!', 'Your secret prompt is on your phone.');
    const res = await ctx.ask({
      to: ps, secs: 75,
      view: p => ({ type: 'draw', prompt: prompts.get(p.id), palette: inks.get(p.id), blind, sub: 'Your secret prompt' }),
      partial: (p, d, answers) => { if (!d || !d.drawing || typeof d.drawing.d !== 'string' || d.drawing.d.length > 15000) return false; answers.set(p.id, d.drawing); return true; },
      bot: p => ({ i: 0, drawing: PP.Draw.botDrawing(inks.get(p.id)) }),
      clean: false,
      audienceMsg: 'Art is happening. Please be patient with the artists.'
    });
    const art = shuffle(ps.filter(p => res.answers.has(p.id)).map(p => ({ p, drawing: Object.assign(res.answers.get(p.id), { p: inks.get(p.id) }), prompt: prompts.get(p.id) })));
    if (!art.length) { await ctx.say('nobody'); return; }
    const deltas = new Map(); const add = (p, n) => { ctx.score(p, n); deltas.set(p.id, (deltas.get(p.id) || 0) + n); };
    for (let k = 0; k < art.length; k++) await judge(ctx, C, art[k], k, art.length, mult, add);
    await ctx.scoreboard(blind ? 'After Blind Contour' : 'After round 1', deltas);
  }

  function drawingHtml(ctx, a, size) { return `<div class="frame" data-art="1" style="--size:${size}px"></div>`; }
  function mountDrawing(a, size) { const f = document.querySelector('[data-art]'); if (f) f.appendChild(PP.Draw.canvasFor(a.drawing, size)); }

  async function judge(ctx, C, a, k, n, mult, add) {
    const ps = ctx.players(); const guessers = ps.filter(p => p !== a.p);
    ctx.setPhase('DECOYS');
    ctx.stage(`<div class="gallery"><p class="step">Masterpiece ${k + 1} of ${n}</p>${drawingHtml(ctx, a, 420)}<p class="big">What is this? Write a fake title on your phone.</p></div>`, 'gallery-stage');
    mountDrawing(a, 420);
    if (k === 0) ctx.say('decoy');
    const decoyRes = await ctx.ask({
      to: guessers, secs: 40,
      view: () => ({ type: 'text', prompt: 'Write a fake title for this drawing', sub: 'Make it believable', max: 40, placeholder: 'a lonely…', button: 'Send', helper: { label: 'Write one for me', options: C.draw.filter(x => x !== a.prompt) } }),
      others: () => H.waitView('That\'s yours!', 'Keep a straight face while they guess.'),
      validate: (p, d) => { const t = d && String(d.text || '').trim(); if (!t) return 'Type a title.'; if (PP.isTruth(t, a.prompt)) return 'Too close to the real prompt! Try another.'; return null; },
      bot: () => ({ text: pick(C.draw.filter(x => x !== a.prompt)) })
    });
    const titles = new Map();
    for (const [id, d] of decoyRes.answers) { const p = ctx.byId(id); if (!p || !d) continue; const t = String(d.text).trim().slice(0, 40); const key = PP.norm(t); if (!titles.has(key)) titles.set(key, { id: 'd' + titles.size, text: t, authors: [] }); titles.get(key).authors.push(p); }
    const items = [...titles.values()].map(t => Object.assign(t, { fallback: pick(C.draw.filter(x => x !== a.prompt)) }));
    await ctx.moderate(items);
    const truth = { id: 'truth', text: a.prompt, authors: [], truth: true };
    const opts = [...items];
    shuffle(C.draw).forEach(x => { if (opts.length < 3 && x !== a.prompt && !opts.some(o => PP.norm(o.text) === PP.norm(x))) opts.push({ id: 'h' + opts.length, text: x, authors: [], house: true }); });
    opts.push(truth);
    const options = shuffle(opts);
    ctx.setPhase('GUESSING');
    ctx.stage(`<div class="gallery two"><div>${drawingHtml(ctx, a, 380)}</div><div class="opt-list">${options.map((o, i) => `<div class="opt"><span class="num">${i + 1}</span>${esc(o.text)}</div>`).join('')}</div></div>`, 'gallery-stage');
    mountDrawing(a, 380);
    if (k === 0) ctx.say('pick');
    const pickRes = await ctx.ask({
      to: guessers, secs: 20,
      view: p => ({ type: 'choice', prompt: 'Which is the real title?', options: options.map((o, i) => ({ label: o.text, badge: String(i + 1), disabled: o.authors.includes(p), note: o.authors.includes(p) ? 'yours' : '' })) }),
      others: () => H.waitView('Hush', 'They\'re guessing your drawing.'),
      validate: (p, i) => options[i] && options[i].authors.includes(p) ? 'That\'s your own fake!' : null,
      audience: { prompt: 'Which is the real title?', options: options.map(o => o.text) },
      bot: p => Math.random() < 0.4 ? options.indexOf(truth) : pick(options.map((o, i) => i).filter(i => !options[i].authors.includes(p)))
    });
    const { voters } = G.tally(pickRes.answers, options.length);
    // reveal decoys that fooled anyone, then the truth
    for (let i = 0; i < options.length; i++) {
      const o = options[i]; if (o.truth) continue; const who = voters[i].map(ctx.byId).filter(Boolean); if (!who.length) continue;
      if (!o.house) o.authors.forEach(au => add(au, 500 * mult * who.length));
      ctx.stage(`<div class="gallery two"><div>${drawingHtml(ctx, a, 320)}</div><div class="reveal"><div class="card lie">${esc(o.text)}</div><p class="big">${G.dots(ctx, who)} fell for it</p><p>${o.house ? 'Our decoy!' : 'Fake by ' + o.authors.map(x => G.chip(ctx, x)).join(' ') + ` · +${(500 * mult * who.length).toLocaleString()}`}</p></div></div>`, 'gallery-stage');
      mountDrawing(a, 320); PP.Audio.sfx('buzz'); await ctx.wait(2600);
    }
    const ti = options.indexOf(truth); const right = voters[ti].map(ctx.byId).filter(Boolean);
    const hyped = pickRes.audienceTotal >= 2 && pickRes.audience[ti] === pickRes.audienceTotal;
    right.forEach(p => add(p, 1000 * mult));
    if (right.length) add(a.p, 1000 * mult * right.length * (hyped ? 2 : 1));
    ctx.stage(`<div class="gallery two"><div>${drawingHtml(ctx, a, 320)}</div><div class="reveal"><div class="card truth">${esc(a.prompt)}</div><p class="big">by ${G.chip(ctx, a.p)}</p><p>${right.length ? G.dots(ctx, right) + ' got it' : 'Nobody got it. Tragic.'}</p></div></div>`, 'gallery-stage');
    mountDrawing(a, 320); PP.Audio.sfx('ding');
    await ctx.say('reveal', { answer: a.prompt });
    if (hyped) { ctx.hype('THE CROWD SAW IT ×2'); await ctx.say('hype'); }
    await ctx.wait(2200);
  }
  const H = PP.Host;
})();
