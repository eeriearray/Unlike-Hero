/* 1. The Comedy Writer — head-to-head punchlines, then The Gauntlet (10-second fill-in-the-blanks). */
(function () {
  'use strict';
  const PP = window.PP; const { esc, shuffle, pick } = PP; const G = PP.G;

  const game = PP.GAMES.quip = {
    title: 'The Comedy Writer', icon: '🎤', accent: '#ff4f6d', font: "'Luckiest Guy', 'Lilita One', sans-serif", min: 3,
    blurb: 'Write punchlines. Two answers fight; the room votes. Then survive The Gauntlet.',
    rules: ['Everyone answers two prompts on their phone.', 'Each prompt goes head-to-head; everyone else votes.', 'Sweep every vote for a Quip Lash bonus.', 'Final round: The Gauntlet. 10 seconds per joke.'],
    async run(ctx) {
      const C = ctx.content(); const used = new Set();
      await G.intro(ctx, game);
      for (const round of [1, 2]) await headToHead(ctx, C, used, round);
      await gauntlet(ctx, C);
      await ctx.finale();
    }
  };

  async function headToHead(ctx, C, used, round) {
    await G.banner(ctx, `Round ${round}`, round === 2 ? 'Double points' : 'Two prompts each. Make them count.');
    const ps = shuffle(ctx.players()); const n = ps.length;
    const prompts = G.deal(ctx, 'quip', C.quip, ps.length);
    // Prompt i is answered by player i and player i+1, so everyone gets two prompts and two opponents.
    const assign = new Map(ps.map(p => [p.id, []]));
    prompts.forEach((_, i) => { assign.get(ps[i].id).push(i); assign.get(ps[(i + 1) % n].id).push(i); });
    const progress = new Map();
    ctx.setPhase('WRITING');
    G.busyStage(ctx, 'Write your answers', `Round ${round}: two prompts each`);
    ctx.say('write');
    await ctx.ask({
      to: ps, secs: 75,
      view: p => ({ type: 'multitext', prompts: assign.get(p.id).map(i => prompts[i]), max: 60, safety: C.safetyQuips, sub: `Round ${round}`, placeholder: 'Your punchline' }),
      partial: (p, d, answers) => {
        const list = assign.get(p.id); if (!d || !(d.i >= 0 && d.i < list.length) || !d.text) return false;
        const m = progress.get(p.id) || {}; m[d.i] = { text: String(d.text).slice(0, 60), safety: !!d.safety }; progress.set(p.id, m);
        if (Object.keys(m).length >= list.length) { answers.set(p.id, m); return true; }
        return false;
      },
      botMulti: p => assign.get(p.id).map((_, i) => ({ i, text: pick(C.botWords) })),
      audienceMsg: 'The comedians are writing. Brace yourself.'
    });
    // Collect answers per prompt and send them through moderation.
    const items = [];
    const matchups = prompts.map((prompt, i) => {
      const sides = [ps[i], ps[(i + 1) % n]].map(p => {
        const a = (progress.get(p.id) || {})[assign.get(p.id).indexOf(i)];
        const it = a ? { id: i + ':' + p.id, text: a.text, safety: a.safety, p } : null; if (it) items.push(it); return it || { p, text: null };
      });
      return { prompt, sides };
    });
    await ctx.moderate(items);
    const deltas = new Map();
    for (const m of shuffle(matchups)) await battle(ctx, m, round, ps, deltas);
    await ctx.scoreboard(`After round ${round}`, deltas);
  }

  async function battle(ctx, m, round, ps, deltas) {
    const [A, B] = m.sides; const base = 1000 * round;
    const add = (p, pts) => { ctx.score(p, pts); deltas.set(p.id, (deltas.get(p.id) || 0) + pts); };
    ctx.setPhase('VOTING');
    if (!A.text && !B.text) { ctx.stage(`<div class="center"><h2>${esc(m.prompt)}</h2><p class="big">Nobody answered.</p></div>`); await ctx.say('nobody'); await ctx.wait(1200); return; }
    if (!A.text || !B.text) {
      const w = A.text ? A : B;
      ctx.stage(`<div class="center"><h2>${esc(m.prompt)}</h2><div class="answer solo">${esc(w.text)}</div><p class="big">Wins by forfeit: ${G.chip(ctx, w.p)}</p></div>`);
      add(w.p, Math.round(base / 2)); await ctx.say('oneAnswer'); await ctx.wait(2500); return;
    }
    const voters = ps.filter(p => p !== A.p && p !== B.p);
    const show = (reveal) => ctx.stage(`<div class="versus"><h2 class="prompt">${esc(m.prompt)}</h2><div class="vs-row">
      ${[A, B].map((s, i) => `<div class="answer ${reveal ? (reveal.win === i ? 'win' : 'lose') : ''}" style="--c:${reveal ? ctx.color(s.p) : 'var(--line)'}"><span class="num">${i + 1}</span><p>${esc(s.text)}</p>${s.removed ? '<small>removed by the moderator</small>' : ''}
        ${reveal ? `<div class="by">${G.chip(ctx, s.p)}${s.safety ? ' <small>(safety quip)</small>' : ''}</div><div class="votes">${G.dots(ctx, reveal.voters[i].map(ctx.byId).filter(Boolean))}<b>${reveal.pct[i]}%</b></div><div class="pts">+${reveal.pts[i].toLocaleString()}</div>${reveal.sweep === i ? '<div class="stamp">QUIP LASH!</div>' : ''}` : ''}</div>${i === 0 ? '<div class="vs">VS</div>' : ''}`).join('')}
      </div></div>`, 'versus-stage');
    show(null);
    ctx.say('vote');
    const res = await ctx.ask({
      to: voters, secs: 15,
      view: () => ({ type: 'choice', prompt: m.prompt, sub: 'Which is funnier?', options: [{ label: A.text, badge: '1' }, { label: B.text, badge: '2' }] }),
      others: p => H.waitView('Your joke is up!', 'Look at the big screen and pray.'),
      audience: { prompt: m.prompt, options: [A.text, B.text] },
      bot: () => Math.random() < 0.5 ? 0 : 1
    });
    const { counts, voters: vlist } = G.tally(res.answers, 2);
    const audW = res.audienceTotal ? 2 : 0;                                       // the whole audience counts as two votes
    const share = i => counts[i] + (res.audienceTotal ? audW * res.audience[i] / res.audienceTotal : 0);
    const total = share(0) + share(1);
    const pct = total ? [Math.round(share(0) / total * 100), 100 - Math.round(share(0) / total * 100)] : [50, 50];
    let pts = pct.map((x, i) => Math.round(base * x / 100 * ([A, B][i].safety ? 0.5 : 1)));
    const winIdx = pct[0] === pct[1] ? -1 : pct[0] > pct[1] ? 0 : 1;
    let sweep = -1;
    if (counts[0] + counts[1] > 0 && (counts[0] === 0 || counts[1] === 0)) { sweep = counts[0] ? 0 : 1; pts[sweep] += 250 * round; }
    const hyped = ctx.unanimous(res);
    if (hyped) { const hi = res.audience[0] ? 0 : 1; pts[hi] *= 2; }
    PP.Audio.sfx('reveal');
    show({ win: winIdx, voters: vlist, pct, pts, sweep });
    [A, B].forEach((s, i) => add(s.p, pts[i]));
    if (hyped) { ctx.hype('AUDIENCE HYPE ×2'); await ctx.say('hype'); }
    if (sweep >= 0) await ctx.say('sweep', { name: [A, B][sweep].p.name });
    await ctx.wait(3800);
  }

  async function gauntlet(ctx, C) {
    await G.banner(ctx, 'THE GAUNTLET', '10 seconds per joke. No thinking allowed.', 1800);
    await ctx.say('gauntlet');
    const blanks = G.deal(ctx, 'gauntlet', C.gauntlet, 3); const deltas = new Map();
    for (let k = 0; k < blanks.length; k++) {
      const b = blanks[k]; const ps = ctx.players();
      ctx.setPhase('GAUNTLET');
      ctx.stage(`<div class="gauntlet"><p class="step">Joke ${k + 1} of ${blanks.length}</p><h1>${esc(b).replace('____', '<span class="blank">____</span>')}</h1></div>`, 'gauntlet-stage');
      const res = await ctx.ask({
        to: ps, secs: 10,
        view: () => ({ type: 'text', prompt: b, sub: 'THE GAUNTLET — 10 seconds!', max: 40, placeholder: 'Fill the blank' }),
        bot: () => ({ text: pick(C.botWords) })
      });
      const items = [...res.answers].map(([id, d]) => ({ id, text: String((d && d.text) || '').slice(0, 40), p: ctx.byId(id) })).filter(x => x.text && x.p);
      if (!items.length) { await ctx.say('nobody'); continue; }
      await ctx.moderate(items);
      const opts = shuffle(items);
      const grid = reveal => ctx.stage(`<div class="gauntlet"><h2>${esc(b)}</h2><div class="grid-answers">${opts.map((it, i) => `<div class="answer small ${reveal && reveal.best === i ? 'win' : ''}" style="--c:${reveal ? ctx.color(it.p) : 'var(--line)'}"><span class="num">${i + 1}</span><p>${esc(b.split('____')[0])}<b>${esc(it.text)}</b>${esc(b.split('____')[1] || '')}</p>${reveal ? `<div class="by">${G.chip(ctx, it.p)} · ${reveal.counts[i]} vote${reveal.counts[i] === 1 ? '' : 's'} · +${reveal.pts[i]}</div>` : ''}</div>`).join('')}</div></div>`, 'gauntlet-stage');
      grid(null);
      const vr = await ctx.ask({
        to: ps.filter(p => opts.length > 1 || !opts.some(o => o.p === p)), secs: 12,
        view: p => ({ type: 'choice', prompt: b, sub: 'Vote for the best', options: opts.map((it, i) => ({ label: it.text, badge: String(i + 1), disabled: it.p === p, note: it.p === p ? 'yours' : '' })) }),
        validate: (p, d) => opts[d] && opts[d].p === p ? 'You can\'t vote for yourself.' : null,
        audience: { prompt: b, options: opts.map(it => it.text) },
        bot: p => { const ok = opts.map((o, i) => i).filter(i => opts[i].p !== p); return pick(ok.length ? ok : [0]); }
      });
      const { counts } = G.tally(vr.answers, opts.length);
      const pts = counts.map(c => c * 300);
      if (vr.audienceTotal) { const top = vr.audience.indexOf(Math.max(...vr.audience)); pts[top] += 500; }
      const hyped = ctx.unanimous(vr); if (hyped) { const i = vr.audience.findIndex(x => x === vr.audienceTotal); pts[i] *= 2; }
      const best = counts.indexOf(Math.max(...counts));
      PP.Audio.sfx('reveal'); grid({ counts, pts, best });
      opts.forEach((it, i) => { if (pts[i]) { ctx.score(it.p, pts[i]); deltas.set(it.p.id, (deltas.get(it.p.id) || 0) + pts[i]); } });
      if (hyped) { ctx.hype('AUDIENCE HYPE ×2'); await ctx.say('hype'); }
      await ctx.wait(3500);
    }
    await ctx.scoreboard('After The Gauntlet', deltas);
  }
  const H = PP.Host;
})();
