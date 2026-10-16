/* 2. The Bluffing Game — obscure true facts with a missing word. Write a lie, then find the truth.
   Double Bluff: once per game, bet all your points that your lie fools 3+ players. Win and you
   steal points straight from each victim; lose and you drop to zero. */
(function () {
  'use strict';
  const PP = window.PP; const { esc, shuffle, pick } = PP; const G = PP.G;
  const ROUNDS = [1, 1, 2, 3];

  const game = PP.GAMES.fib = {
    title: 'The Bluffing Game', icon: '🃏', accent: '#3fa7ff', font: "'Righteous', 'Lilita One', sans-serif", min: 2,
    blurb: 'Obscure true facts. Write lies that fool your friends, then sniff out the truth.',
    rules: ['Fill the blank with a believable lie.', 'Then pick what you think is the truth.', 'Truth: +1000. Each player you fool: +500.', 'Once per game: the DOUBLE BLUFF.'],
    async run(ctx) {
      const C = ctx.content(); const facts = shuffle(C.fib).slice(0, ROUNDS.length);
      const dbUsed = new Set();
      await G.intro(ctx, game);
      for (let r = 0; r < facts.length; r++) await question(ctx, facts[r], ROUNDS[r], r, dbUsed);
      await ctx.finale();
    }
  };

  async function question(ctx, f, mult, r, dbUsed) {
    const ps = ctx.players();
    await G.banner(ctx, `Question ${r + 1} of ${ROUNDS.length}`, mult > 1 ? `Points ×${mult}` : null, 1800);
    const sentence = h => esc(f.q).replace('____', `<span class="blank">${h || '_____'}</span>`);
    ctx.setPhase('LYING');
    ctx.stage(`<div class="fact"><h1>${sentence()}</h1><p class="muted">Write a lie on your phone. If you type the truth, we'll make you try again.</p></div>`, 'fact-stage');
    ctx.say('lie');
    const others = ps.length - 1; const need = Math.min(3, others);
    const res = await ctx.ask({
      to: ps, secs: 45,
      view: p => ({
        type: 'text', prompt: f.q, sub: mult > 1 ? `Write a lie · ×${mult}` : 'Write a lie', max: 40, placeholder: 'Your lie', button: 'Lie',
        helper: { label: 'Lie for me', options: f.house },
        doubleBluff: !dbUsed.has(p.id) && others >= 1 ? { points: p.score, need } : null
      }),
      validate: (p, d) => {
        const t = d && String(d.text || '').trim(); if (!t) return 'Type something.';
        if (PP.isTruth(t, f.a, f.alts)) return 'That\'s the truth! Write a lie instead.';
        return null;
      },
      bot: () => ({ text: pick(f.house.concat(ctx.content().botWords.slice(0, 4))) }),
      audienceMsg: 'The players are lying. Guess along when it\'s time.'
    });
    // Merge identical lies so their authors share the credit.
    const lies = new Map(); const bluffers = [];
    for (const [id, d] of res.answers) {
      const p = ctx.byId(id); if (!p || !d) continue;
      const text = String(d.text).trim().slice(0, 40); const key = PP.norm(text);
      if (!lies.has(key)) lies.set(key, { id: 'l' + lies.size, text, authors: [], house: false });
      lies.get(key).authors.push(p);
      if (d.db && !dbUsed.has(p.id)) { dbUsed.add(p.id); bluffers.push({ p, lie: lies.get(key), bet: p.score }); }
    }
    const items = [...lies.values()].map(l => Object.assign(l, { fallback: pick(f.house) }));
    await ctx.moderate(items);
    if (bluffers.length) {
      ctx.stage(`<div class="center"><h1 class="db-title">DOUBLE BLUFF</h1><p class="big">${bluffers.map(b => G.chip(ctx, b.p)).join(' ')} bet${bluffers.length === 1 ? 's' : ''} everything on fooling ${need}+ players.</p></div>`, 'db-stage');
      PP.Audio.sfx('airhorn');
      await ctx.say('doubleBluff', { name: PP.listNames(bluffers.map(b => b.p.name)) });
    }
    // Options: every lie, the truth, and house lies to pad small games.
    const options = [...items];
    const truth = { id: 'truth', text: f.a, authors: [], truth: true };
    shuffle(f.house).forEach(h => { if (options.length < Math.max(4, ps.length) && !options.some(o => PP.norm(o.text) === PP.norm(h))) options.push({ id: 'h' + options.length, text: h, authors: [], house: true }); });
    options.push(truth);
    const opts = shuffle(options);
    ctx.setPhase('GUESSING');
    ctx.stage(`<div class="fact"><h2>${sentence()}</h2><div class="opt-grid">${opts.map((o, i) => `<div class="opt"><span class="num">${i + 1}</span>${esc(o.text)}</div>`).join('')}</div></div>`, 'fact-stage');
    ctx.say('pick');
    const pickRes = await ctx.ask({
      to: ps, secs: 25,
      view: p => ({ type: 'choice', prompt: f.q, sub: 'Find the truth', options: opts.map((o, i) => ({ label: o.text, badge: String(i + 1), disabled: o.authors.includes(p), note: o.authors.includes(p) ? 'your lie' : '' })) }),
      validate: (p, i) => opts[i] && opts[i].authors.includes(p) ? 'That\'s your own lie!' : null,
      audience: { prompt: f.q, options: opts.map(o => o.text) },
      bot: p => { const ok = opts.map((o, i) => i).filter(i => !opts[i].authors.includes(p)); return Math.random() < 0.35 ? opts.indexOf(truth) : pick(ok); }
    });
    const { voters } = G.tally(pickRes.answers, opts.length);
    const deltas = new Map(); const add = (p, n) => { ctx.score(p, n); deltas.set(p.id, (deltas.get(p.id) || 0) + n); };
    // Reveal: each lie that fooled someone, then the truth.
    const fooled = opts.map((o, i) => ({ o, i, who: voters[i].map(ctx.byId).filter(Boolean), aud: pickRes.audience[i] || 0 })).filter(x => !x.o.truth && (x.who.length || x.aud));
    for (const x of fooled) {
      ctx.stage(`<div class="reveal"><h2>${sentence()}</h2><div class="card lie">${esc(x.o.text)}</div>
        <p class="big">${x.who.length ? G.dots(ctx, x.who) + ' fell for it' : ''}${x.aud ? ` · ${x.aud} audience` : ''}</p>
        <p class="big">${x.o.house ? '<b>Our lie</b> (the house always wins)' : `Lie by ${x.o.authors.map(a => G.chip(ctx, a)).join(' ')} · +${(500 * mult * x.who.length).toLocaleString()}`}</p></div>`, 'reveal-stage');
      PP.Audio.sfx('buzz');
      if (!x.o.house) { x.o.authors.forEach(a => add(a, 500 * mult * x.who.length + (x.aud > pickRes.audienceTotal / 2 ? 250 * mult : 0))); if (x.who.length >= 2) ctx.say('fooled', { name: x.o.authors[0].name, n: x.who.length }); }
      await ctx.wait(3000);
    }
    const ti = opts.indexOf(truth); const truthers = voters[ti].map(ctx.byId).filter(Boolean);
    const hyped = pickRes.audienceTotal >= 2 && pickRes.audience[ti] === pickRes.audienceTotal;
    truthers.forEach(p => add(p, 1000 * mult * (hyped ? 2 : 1)));
    ctx.stage(`<div class="reveal"><h2>${sentence(esc(f.a))}</h2><div class="card truth">THE TRUTH: ${esc(f.a)}</div>
      <p class="big">${truthers.length ? G.dots(ctx, truthers) + ` found it · +${(1000 * mult * (hyped ? 2 : 1)).toLocaleString()}` : 'Nobody found the truth.'}</p>${pickRes.audienceTotal ? `<p class="muted">Audience: ${Math.round((pickRes.audience[ti] || 0) / pickRes.audienceTotal * 100)}% found it</p>` : ''}</div>`, 'reveal-stage truth');
    PP.Audio.sfx('ding');
    await ctx.say('truth', { answer: f.a });
    if (hyped) { ctx.hype('AUDIENCE KNEW IT ×2'); await ctx.say('hype'); }
    // Settle Double Bluffs.
    for (const b of bluffers) {
      const victims = voters[opts.indexOf(b.lie)].map(ctx.byId).filter(v => v && v !== b.p);
      if (victims.length >= need) {
        const steal = 500 * mult; let total = 0;
        victims.forEach(v => { const take = Math.min(v.score, steal); ctx.score(v, -take); total += take; deltas.set(v.id, (deltas.get(v.id) || 0) - take); });
        add(b.p, total);
        ctx.stage(`<div class="center"><h1 class="db-title win">DOUBLE BLUFF WINS</h1><p class="big">${G.chip(ctx, b.p)} fooled ${victims.length} and steals ${total.toLocaleString()} points from ${G.dots(ctx, victims)}</p></div>`, 'db-stage');
        PP.Audio.sfx('hype'); ctx.hype('DOUBLE BLUFF!');
        await ctx.say('dbWin', { name: b.p.name });
      } else {
        const lost = b.p.score; ctx.score(b.p, -lost); deltas.set(b.p.id, (deltas.get(b.p.id) || 0) - lost);
        ctx.stage(`<div class="center"><h1 class="db-title lose">DOUBLE BLUFF FAILS</h1><p class="big">${G.chip(ctx, b.p)} only fooled ${victims.length} of ${need} and loses ${lost.toLocaleString()} points.</p></div>`, 'db-stage');
        PP.Audio.sfx('kill');
        await ctx.say('dbFail', { name: b.p.name });
      }
      await ctx.wait(2500);
    }
    // the scoreboard shows only gains; losses are already visible in the strip
    const gains = new Map([...deltas].filter(([, v]) => v > 0));
    await ctx.scoreboard('Scores', gains, 3500);
  }
})();
