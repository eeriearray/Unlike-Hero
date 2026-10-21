/* 10. Guesstimate — a number question; everyone types a guess; closest wins. Exact guesses pay double. */
(function () {
  'use strict';
  const PP = window.PP; const { esc } = PP; const G = PP.G;
  const ROUNDS = 7;
  const fmt = n => (Math.round(n * 1000) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 });

  const game = PP.GAMES.guess = {
    title: 'Guesstimate', icon: '🔢', accent: '#ffb347', font: "'Archivo Black', sans-serif", min: 2,
    blurb: 'Real questions with number answers. Nobody knows. Closest guess wins.',
    rules: ['Type a number. Any number.', 'Closest guess: 1,000. Second: 500. Third: 250.', 'Exactly right: 2,000.', 'Last question counts double.'],
    async run(ctx) {
      const C = ctx.content();
      await G.intro(ctx, game);
      const qs = G.deal(ctx, 'guess', C.guess, ROUNDS);
      for (let k = 0; k < qs.length; k++) await question(ctx, qs[k], k, k === qs.length - 1 ? 2 : 1);
      await ctx.finale();
    }
  };

  const parse = t => { const m = String(t || '').replace(/[, _]/g, '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; };

  async function question(ctx, q, k, mult) {
    const ps = ctx.players();
    ctx.setPhase('GUESSING');
    ctx.stage(`<div class="fact"><p class="step">Question ${k + 1} of ${ROUNDS}${mult > 1 ? ' · double points' : ''}</p><h1>${esc(q.q)}</h1>${q.unit ? `<p class="big">Answer in ${esc(q.unit)}</p>` : ''}</div>`, 'fact-stage');
    if (k === 0) ctx.say('ask');
    const res = await ctx.ask({
      to: ps, secs: 30,
      view: () => ({ type: 'text', prompt: q.q, sub: q.unit ? 'Your guess, in ' + q.unit : 'Your guess', max: 14, numeric: true, placeholder: '0', button: 'Guess' }),
      validate: (p, d) => (Number.isFinite(parse(d && d.text)) ? null : 'Type a number.'),
      bot: () => ({ text: String(Math.round(q.a * (0.55 + Math.random() * 0.9) * 100) / 100) })
    });
    const guesses = [...res.answers].map(([id, d]) => ({ p: ctx.byId(id), n: parse(d.text) })).filter(g => g.p && Number.isFinite(g.n))
      .map(g => Object.assign(g, { off: Math.abs(g.n - q.a) })).sort((a, b) => a.off - b.off);
    const deltas = new Map(); const prizes = [1000, 500, 250];
    let rank = 0;
    guesses.forEach((g, i) => {
      if (i > 0 && g.off > guesses[i - 1].off) rank = i;           // ties share a place
      g.pts = g.off === 0 ? 2000 * mult : rank < prizes.length ? prizes[rank] * mult : 0;
      if (g.pts) { ctx.score(g.p, g.pts); deltas.set(g.p.id, g.pts); }
    });
    // number line from the lowest to the highest of (guesses + answer)
    const all = guesses.map(g => g.n).concat(q.a); const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1;
    const x = n => 4 + (n - lo) / span * 92;
    ctx.setPhase('REVEAL');
    ctx.stage(`<div class="fact"><h2>${esc(q.q)}</h2><div class="card truth">${fmt(q.a)}${q.unit ? ' ' + esc(q.unit) : ''}</div>${q.note ? `<p class="big">${esc(q.note)}</p>` : ''}
      <div class="numline"><i class="answer-mark" style="left:${x(q.a)}%"></i>${guesses.map(g => `<span class="guess-mark" style="left:${x(g.n)}%">${PP.Art.player(g.p, ctx.color(g.p))}<small>${fmt(g.n)}</small></span>`).join('')}</div>
      <div class="vote-res">${guesses.slice(0, 3).map((g, i) => `<span>${['🥇', '🥈', '🥉'][i]} ${G.chip(ctx, g.p)} ${fmt(g.n)} · +${g.pts.toLocaleString()}</span>`).join('')}</div></div>`, 'fact-stage');
    PP.Audio.sfx('reveal');
    const best = guesses[0];
    await ctx.say(!best ? 'nobody' : best.off === 0 ? 'exact' : best.off / Math.max(1, Math.abs(q.a)) < 0.05 ? 'close' : 'wild');
    await ctx.wait(3800);
    if (k === 3 || k === ROUNDS - 1) await ctx.scoreboard('Scores', deltas, 3500);
  }
})();
