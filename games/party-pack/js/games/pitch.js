/* 6. The Imposter's Pitch — social deduction + improv. Everyone is an executive pitching a
   bizarre product; one Imposter has a blank screen and has to bluff from the slides alone.
   State machine (docs/GDD.md §2):
     LOBBY_WAITING → ROLES_ASSIGNED → SLIDE_DRAFTING → PITCH_PHASE → VOTING_PHASE
       → (IMPOSTER_GUESS if caught) → REVEAL → ROUND_END → ROLES_ASSIGNED … → GAME_OVER */
(function () {
  'use strict';
  const PP = window.PP; const { esc, shuffle, pick } = PP; const G = PP.G;

  const game = PP.GAMES.pitch = {
    title: 'The Imposter\'s Pitch', icon: '💼', accent: '#ff8a3d', min: 4,
    blurb: 'Pitch a ridiculous product to the board. One of you has no idea what it is.',
    rules: ['Everyone but the Imposter sees the product.', 'Everyone writes a slide headline.', 'Take turns pitching a colleague\'s slide out loud.', 'Vote out the Imposter. Caught? They can still guess the product.', 'Investments from the room score too.'],
    async run(ctx) {
      const C = ctx.content(); const used = new Set(); const pastImposters = new Set();
      await G.intro(ctx, game);
      const rounds = Math.min(3, Math.max(2, Math.floor(ctx.players().length / 2)));
      for (let r = 0; r < rounds; r++) await round(ctx, C, used, pastImposters, r, rounds);
      ctx.setPhase('GAME_OVER');
      await ctx.finale();
    }
  };

  async function round(ctx, C, used, pastImposters, r, rounds) {
    const ps = ctx.players();
    const product = G.take(C.pitch, used);
    const pool = ps.filter(p => !pastImposters.has(p.id)); const imposter = pick(pool.length ? pool : ps); pastImposters.add(imposter.id);
    await G.banner(ctx, `Pitch meeting ${r + 1} of ${rounds}`, 'Check your phone. Secretly.', 2000);

    // ---- ROLES_ASSIGNED: private role cards (the Imposter's is blank)
    ctx.setPhase('ROLES_ASSIGNED');
    ctx.stage(`<div class="boardroom"><h1>💼 Venture Venture Capital</h1><p class="big">Today's pitch: <b class="redacted">██████████</b></p><p class="muted">One of you is an Imposter with a blank screen.</p></div>`, 'pitch-stage');
    ctx.say('roles');
    await ctx.ask({
      to: ps, secs: 20, noAfk: true,
      view: p => ({ type: 'role', imposter: p === imposter, product: p === imposter ? null : product.name, line: p === imposter ? null : product.line }),
      bot: () => ({ ok: true })
    });

    // ---- SLIDE_DRAFTING: everyone writes one headline (the Imposter writes blind)
    ctx.setPhase('SLIDE_DRAFTING');
    G.busyStage(ctx, 'Draft the deck', 'Everyone writes one slide headline.');
    ctx.say('slides');
    const res = await ctx.ask({
      to: ps, secs: 40,
      view: p => ({ type: 'text', prompt: p === imposter ? 'Write a slide headline for… whatever this is. Stay vague.' : `Write a slide headline for ${product.name}. Don't say the name.`, sub: p === imposter ? 'You are the Imposter' : 'Slide headline', max: 50, placeholder: 'Now with 40% more…', helper: { label: 'Suggest one', options: C.botHeadlines } }),
      validate: (p, d) => { const t = d && String(d.text || '').trim(); if (!t) return 'Write a headline.'; if (p !== imposter && PP.norm(t).includes(PP.norm(product.name))) return 'Don\'t put the product name on the slide. Make the Imposter work for it.'; return null; },
      bot: p => ({ text: p === imposter ? pick(C.botHeadlines) : pick([...C.botHeadlines, `${cap(pick(product.words))} like never before`, `The future of ${pick(product.words)}`]) })
    });
    const items = ps.map(p => ({ id: p.id, p, text: res.answers.get(p.id) ? String(res.answers.get(p.id).text).slice(0, 50) : pick(C.botHeadlines), fallback: pick(C.botHeadlines) }));
    await ctx.moderate(items);
    // Presentation order: the Imposter never goes first, so they get to watch a pitch or two.
    let order = shuffle(ps); if (order[0] === imposter && order.length > 1) order = order.slice(1, 2).concat([imposter], order.slice(2).filter(p => p !== imposter));
    // Each presenter pitches a colleague's slide (rotation, so nobody presents their own).
    const slides = order.map((p, i) => ({ presenter: p, headline: items.find(x => x.p === order[(i + 1) % order.length]).text, writer: order[(i + 1) % order.length], kind: C.slideKinds[i % C.slideKinds.length] }));

    // ---- PITCH_PHASE
    const invest = new Map(ps.map(p => [p.id, new Map()]));   // presenter → (investor → taps)
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      ctx.setPhase('PITCH_PHASE');
      ctx.stage(slideHtml(ctx, product, s, i, slides.length), 'pitch-stage slide-stage');
      ctx.say('present', { name: s.presenter.name });
      await ctx.ask({
        to: ps, secs: 35, noAfk: true,
        view: p => p === s.presenter ? { type: 'present', imposter: p === imposter, product: p === imposter ? null : product.name, headline: s.headline } : { type: 'invest', presenter: s.presenter.name },
        live: (p, d) => { if (d && d.invest && p !== s.presenter) { const m = invest.get(s.presenter.id); m.set(p.id, Math.min(3, (m.get(p.id) || 0) + 1)); const el = document.querySelector('#inv-count'); if (el) el.textContent = [...m.values()].reduce((a, b) => a + b, 0); PP.Audio.sfx('point'); } },
        liveFinal: (p, d) => p === s.presenter && d && d.done,
        until: answers => answers.has(s.presenter.id),
        botMulti: p => p === s.presenter ? [{ done: true }] : (Math.random() < 0.5 ? [{ invest: true }] : []),
        audienceMsg: `${s.presenter.name} is pitching. Is it the Imposter?`
      });
    }

    // ---- VOTING_PHASE: who is the Imposter? (and the audience weighs in)
    ctx.setPhase('VOTING_PHASE');
    ctx.stage(`<div class="boardroom"><h1>Who is the Imposter?</h1><div class="suspects">${ps.map(p => `<div class="suspect" style="--c:${ctx.color(p)}"><span class="av">${esc(p.avatar)}</span><b>${esc(p.name)}</b><small>💰 ${[...invest.get(p.id).values()].reduce((a, b) => a + b, 0)}</small></div>`).join('')}</div></div>`, 'pitch-stage');
    ctx.say('vote');
    const vote = await ctx.ask({
      to: ps, secs: 30,
      view: p => ({ type: 'choice', prompt: 'Who is the Imposter?', options: ps.map(o => ({ label: o.name, badge: o.avatar, disabled: o === p, note: o === p ? 'you' : '' })) }),
      validate: (p, i) => ps[i] === p ? 'You can\'t vote for yourself.' : null,
      audience: { prompt: 'Who is the Imposter?', options: ps.map(o => o.name) },
      bot: p => { const others = ps.map((o, i) => i).filter(i => ps[i] !== p); return Math.random() < 0.45 && p !== imposter ? ps.indexOf(imposter) : pick(others); }
    });
    const { counts, voters } = G.tally(vote.answers, ps.length);
    const top = Math.max(...counts); const leaders = counts.map((c, i) => c === top ? i : -1).filter(i => i >= 0);
    let caught = top > 0 && leaders.length === 1 && ps[leaders[0]] === imposter;
    // a tied player vote is broken by the audience
    if (top > 0 && leaders.length > 1 && vote.audienceTotal) { const aBest = leaders.slice().sort((a, b) => vote.audience[b] - vote.audience[a])[0]; caught = ps[aBest] === imposter && vote.audience[aBest] > 0; }
    const deltas = new Map(); const add = (p, n) => { ctx.score(p, n); deltas.set(p.id, (deltas.get(p.id) || 0) + n); };

    // ---- IMPOSTER_GUESS: caught Imposters get one shot at naming the product
    let guessedRight = false;
    if (caught) {
      ctx.setPhase('IMPOSTER_GUESS');
      ctx.stage(`<div class="boardroom"><h1>Caught!</h1><p class="big">${G.chip(ctx, imposter)} was the Imposter.</p><p>One last chance: they must guess the product.</p></div>`, 'pitch-stage');
      await ctx.say('caught', { name: imposter.name });
      const choices = shuffle([product].concat(shuffle(C.pitch.filter(x => x !== product)).slice(0, 3)));
      const g = await ctx.ask({
        to: [imposter], secs: 20,
        view: () => ({ type: 'choice', prompt: 'What were we pitching?', sub: 'Guess right to steal the round', options: choices.map(c => ({ label: c.name, note: c.line })) }),
        others: () => PP.Host.waitView('The Imposter is guessing', 'Did they figure it out?'),
        bot: () => Math.random() < 0.4 ? choices.indexOf(product) : Math.floor(Math.random() * choices.length)
      });
      guessedRight = choices[g.answers.get(imposter.id)] === product;
    }

    // ---- REVEAL + scoring
    ctx.setPhase('REVEAL');
    if (!caught) add(imposter, 2000);
    else if (guessedRight) add(imposter, 1500);
    voters[ps.indexOf(imposter)].forEach(id => { const p = ctx.byId(id); if (p && p !== imposter) add(p, 750); });
    ps.forEach(p => { const inv = [...invest.get(p.id).values()]; if (inv.length) add(p, inv.length * 250); });
    const hyped = vote.audienceTotal >= 2 && vote.audience[ps.indexOf(imposter)] === vote.audienceTotal;
    if (hyped) voters[ps.indexOf(imposter)].forEach(id => { const p = ctx.byId(id); if (p) add(p, 750); });
    ctx.stage(`<div class="boardroom reveal"><p class="muted">The product was</p><h1>${product.hints.join(' ')} ${esc(product.name)}</h1><p class="big">${esc(product.line)}</p>
      <p class="big">The Imposter: ${G.chip(ctx, imposter)} ${caught ? (guessedRight ? '— caught, but guessed the product!' : '— caught and bankrupt.') : '— got away with it!'}</p>
      <div class="vote-res">${ps.map((p, i) => counts[i] ? `<span>${G.chip(ctx, p)} ${G.dots(ctx, voters[i].map(ctx.byId).filter(Boolean))}</span>` : '').join('')}</div></div>`, 'pitch-stage');
    PP.Audio.sfx(caught && !guessedRight ? 'ding' : 'buzz');
    if (!caught) await ctx.say('free', { name: imposter.name });
    else await ctx.say(guessedRight ? 'guessRight' : 'guessWrong', { name: imposter.name });
    if (hyped) { ctx.hype('THE CROWD SAW THROUGH IT'); await ctx.say('hype'); }
    await ctx.wait(2500);
    ctx.setPhase('ROUND_END');
    await ctx.scoreboard('The cap table', deltas);
  }

  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  // Game-generated slide art. It only uses the product's hint emoji and words, so the Imposter
  // has something to improvise from without the main screen giving away the name.
  function slideHtml(ctx, product, s, i, n) {
    const C = ctx.content(); const h = product.hints; const buzz = shuffle(C.buzz);
    const visual = {
      chart: `<div class="chart">${[30, 55, 42, 88, 140].map((v, k) => `<div class="bar" style="--v:${Math.min(100, v / 1.4)}%"><span>${k === 4 ? h[0] : ''}</span><small>Q${k + 1}</small></div>`).join('')}</div><p class="muted">Projected ${pick(product.words)} growth (made up)</p>`,
      quote: `<blockquote>"I can't believe I lived without it. ${h[1]}"</blockquote><p class="muted">— a real customer, probably</p>`,
      roadmap: `<div class="roadmap">${['Prototype', 'Beta', 'Launch', 'World domination'].map((m, k) => `<div><b>${h[k % h.length]}</b><small>${m}</small></div>`).join('')}</div>`,
      stat: `<div class="stat">${pick(['9,000%', '42×', '1 billion', '∞'])}</div><p class="muted">more ${pick(product.words)} than the competition</p>`,
      team: `<div class="team">${h.map(e => `<span>${e}</span>`).join('')}</div><p class="muted">Our ${buzz[0]} leadership team</p>`
    }[s.kind];
    return `<div class="slide"><div class="slide-top"><span>Slide ${i + 1} / ${n}</span><span>${esc(buzz[1])} · ${esc(buzz[2])}</span></div>
      <h1>${esc(s.headline)}</h1><div class="slide-body">${visual}</div>
      <div class="slide-foot"><span>Presenting: ${G.chip(ctx, s.presenter)}</span><span>💰 <b id="inv-count">0</b> investments</span></div></div>`;
  }
})();
