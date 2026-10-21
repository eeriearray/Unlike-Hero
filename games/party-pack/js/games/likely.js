/* 9. Most Likely To — "Who's most likely to…?" Everyone votes for a friend. Vote with the majority to score;
   whoever gets the most votes is crowned with that title for the rest of the night. */
(function () {
  'use strict';
  const PP = window.PP; const { esc, pick } = PP; const G = PP.G;
  const ROUNDS = 8;

  const game = PP.GAMES.likely = {
    title: 'Most Likely To', icon: '🏆', accent: '#5b8cff', font: "'Bowlby One SC', sans-serif", min: 3,
    blurb: 'Who\'s most likely to…? Vote for your friends. Agree with the room to score.',
    rules: ['Read the question. Vote for a friend (yourself counts).', 'Vote with the majority: +300.', 'The winner of each vote gets the title, and +100.', 'Collect titles for the end-of-night yearbook.'],
    async run(ctx) {
      const C = ctx.content();
      await G.intro(ctx, game);
      const titles = new Map();
      const qs = G.deal(ctx, 'likely', C.likely, ROUNDS);
      for (let k = 0; k < qs.length; k++) await round(ctx, qs[k], k, titles);
      const ps = ctx.players();
      const yearbook = ps.filter(p => titles.get(p.id)).map(p => `<div class="yb"><span class="av">${PP.Art.player(p, ctx.color(p))}</span><b>${esc(p.name)}</b><small>${titles.get(p.id).map(t => esc(t)).join('<br>')}</small></div>`).join('');
      await ctx.finale({ html: yearbook ? `<div class="yearbook">${yearbook}</div>` : '', hold: 9000 });
    }
  };

  const short = q => q.replace(/^Who'?s most likely to\s*/i, '').replace(/\?$/, '');

  async function round(ctx, q, k, titles) {
    const ps = ctx.players();
    ctx.setPhase('VOTING');
    ctx.stage(`<div class="fact"><p class="step">${k + 1} of ${ROUNDS}</p><h1>${esc(q)}</h1><div class="suspects">${ps.map(p => `<div class="suspect"><span class="av">${PP.Art.player(p, ctx.color(p))}</span><b>${esc(p.name)}</b></div>`).join('')}</div></div>`, 'fact-stage');
    if (k === 0) ctx.say('vote');
    const res = await ctx.ask({
      to: ps, secs: 15,
      view: () => ({ type: 'choice', prompt: q, sub: 'Vote for a friend', options: ps.map(o => ({ label: o.name, face: { id: o.avatar, color: ctx.color(o) } })) }),
      audience: { prompt: q, options: ps.map(o => o.name) },
      bot: () => Math.floor(Math.random() * ps.length)
    });
    const { counts, voters } = G.tally(res.answers, ps.length);
    // the audience's favourite breaks ties between players
    const score = counts.map((c, i) => c + (res.audienceTotal ? res.audience[i] / (res.audienceTotal + 1) : 0));
    const top = Math.max(...score);
    const winners = top > 0 ? ps.filter((p, i) => score[i] === top) : [];
    const deltas = new Map(); const add = (p, n) => { ctx.score(p, n); deltas.set(p.id, (deltas.get(p.id) || 0) + n); };
    winners.forEach(w => { add(w, 100); titles.set(w.id, (titles.get(w.id) || []).concat('Most likely to ' + short(q))); });
    winners.forEach(w => voters[ps.indexOf(w)].map(ctx.byId).filter(Boolean).forEach(v => add(v, 300)));
    ctx.setPhase('CROWNED');
    ctx.stage(`<div class="fact"><h2>${esc(q)}</h2>${winners.length ? `<div class="winners">${winners.map(w => `<div><div>${PP.Art.crown}</div><div class="winner-face">${PP.Art.player(w, ctx.color(w))}</div><p class="big">${esc(w.name)}</p></div>`).join('')}</div>` : '<p class="big">Nobody voted. Cowards.</p>'}
      <div class="vote-res">${ps.map((p, i) => counts[i] ? `<span>${G.chip(ctx, p)} ← ${G.dots(ctx, voters[i].map(ctx.byId).filter(Boolean))}</span>` : '').join('')}</div></div>`, 'fact-stage');
    PP.Audio.sfx('win');
    await ctx.say(winners.length > 1 ? 'tie' : 'crowned');
    await ctx.wait(3200);
    if (k === 3 || k === ROUNDS - 1) await ctx.scoreboard('Scores', deltas, 3000);
  }
})();
