/* 8. Who Said That? — everyone answers a personal question; then each answer is shown and the room
   guesses who wrote it. Guess right to score; fool your friends to score more. */
(function () {
  'use strict';
  const PP = window.PP; const { esc, shuffle, pick } = PP; const G = PP.G;
  const ROUNDS = 3;

  const game = PP.GAMES.whosaid = {
    title: 'Who Said That?', icon: '🕵️', accent: '#ff6fb5', font: "'Permanent Marker', sans-serif", min: 3,
    blurb: 'Answer personal questions, then guess which friend wrote each answer.',
    rules: ['Everyone answers the same question about themselves.', 'Each answer appears. Guess who wrote it.', 'Right guess: +400. Each friend you fool: +200.', 'Be honest… or be sneaky.'],
    async run(ctx) {
      const C = ctx.content();
      await G.intro(ctx, game);
      const qs = G.deal(ctx, 'whosaid', C.whosaid, ROUNDS);
      for (let r = 0; r < qs.length; r++) await round(ctx, C, qs[r], r);
      await ctx.finale();
    }
  };

  async function round(ctx, C, prompt, r) {
    const ps = ctx.players();
    await G.banner(ctx, `Round ${r + 1} of ${ROUNDS}`, prompt, 2600);
    ctx.setPhase('WRITING');
    G.busyStage(ctx, prompt, 'Answer honestly. Or don\'t.');
    ctx.say('write');
    const res = await ctx.ask({
      to: ps, secs: 45,
      view: () => ({ type: 'text', prompt, sub: 'About you', max: 60, placeholder: 'Your answer' }),
      validate: (p, d) => (d && String(d.text || '').trim() ? null : 'Type something.'),
      bot: () => ({ text: pick(C.whosaidBots || ['no comment']) })
    });
    const items = shuffle([...res.answers].map(([id, d], i) => ({ id: 'w' + i, p: ctx.byId(id), text: String(d.text).trim().slice(0, 60) })).filter(a => a.p));
    await ctx.moderate(items);
    const deltas = new Map(); const add = (p, n) => { ctx.score(p, n); deltas.set(p.id, (deltas.get(p.id) || 0) + n); };
    for (let k = 0; k < items.length; k++) {
      const it = items[k];
      const guessers = ps.filter(p => p !== it.p);
      ctx.setPhase('GUESSING');
      ctx.stage(`<div class="fact"><p class="step">${esc(prompt)} · ${k + 1} of ${items.length}</p><div class="quote-card">“${esc(it.text)}”</div><p class="big">Who said that?</p></div>`, 'fact-stage');
      if (k === 0) ctx.say('guess');
      const g = await ctx.ask({
        to: guessers, secs: 15,
        view: p => ({ type: 'choice', prompt: '“' + it.text + '”', sub: 'Who said that?', options: ps.map(o => ({ label: o.name, face: { id: o.avatar, color: ctx.color(o) }, disabled: o === p, note: o === p ? 'you' : '' })) }),
        others: () => PP.Host.waitView('That one\'s yours', 'Keep a straight face.'),
        validate: (p, i) => (ps[i] === p ? 'Not you!' : null),
        audience: { prompt: '“' + it.text + '” — who said it?', options: ps.map(o => o.name) },
        bot: p => { const right = ps.indexOf(it.p); return Math.random() < 0.4 ? right : ps.indexOf(pick(ps.filter(o => o !== p))); }
      });
      const { voters } = G.tally(g.answers, ps.length);
      const ri = ps.indexOf(it.p);
      const right = voters[ri].map(ctx.byId).filter(Boolean);
      const fooled = guessers.length - right.length;
      right.forEach(p => add(p, 400));
      if (fooled > 0) add(it.p, 200 * fooled);
      ctx.stage(`<div class="fact"><div class="quote-card">“${esc(it.text)}”</div><p class="big">It was ${G.chip(ctx, it.p)}</p>
        <p class="big">${right.length ? G.dots(ctx, right) + ' got it' : 'Nobody guessed it!'}${fooled ? ` · ${esc(it.p.name)} fooled ${fooled} · +${(200 * fooled).toLocaleString()}` : ''}</p></div>`, 'fact-stage');
      PP.Audio.sfx(right.length ? 'ding' : 'buzz');
      if (k % 2 === 0) ctx.say(right.length >= guessers.length / 2 ? 'caught' : 'fooled');
      await ctx.wait(2800);
    }
    await ctx.scoreboard(`After round ${r + 1}`, deltas, 3500);
  }
})();
