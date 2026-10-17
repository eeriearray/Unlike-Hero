/* 7. Mind Meld — "Name a…" prompts where you score by thinking like everyone else. Answers that match
   (spelling slips and plurals forgiven) score for every other person who said the same thing. */
(function () {
  'use strict';
  const PP = window.PP; const { esc, pick } = PP; const G = PP.G;
  const ROUNDS = 6;

  const game = PP.GAMES.meld = {
    title: 'Mind Meld', icon: '🧠', accent: '#2fd3c4', font: "'Lilita One', sans-serif", min: 3,
    blurb: 'Answer "Name a…" prompts. You only score by thinking exactly like everyone else.',
    rules: ['Everyone answers the same "Name a…" prompt.', 'Each person who matches you earns you 200 points.', 'Everyone says the same thing? MIND MELD bonus.', 'Last round is worth double.'],
    async run(ctx) {
      const C = ctx.content();
      await G.intro(ctx, game);
      const prompts = G.deal(ctx, 'meld', C.meld, ROUNDS);
      for (let k = 0; k < prompts.length; k++) await round(ctx, prompts[k], k, k === prompts.length - 1 ? 2 : 1);
      await ctx.finale();
    }
  };

  // Same answer? Lower-case, no articles/punctuation, no trailing "s", and one-letter slips forgiven on longer words.
  const keyOf = t => PP.norm(t).replace(/(es|s)$/, '');
  function group(answers) {
    const groups = [];
    for (const a of answers) {
      const k = keyOf(a.text); if (!k) continue;
      const g = groups.find(x => x.key === k || (k.length > 4 && x.key.length > 4 && PP.lev(k, x.key) <= 1));
      if (g) g.items.push(a); else groups.push({ key: k, label: a.text, items: [a] });
    }
    return groups.sort((x, y) => y.items.length - x.items.length);
  }

  async function round(ctx, prompt, k, mult) {
    const ps = ctx.players();
    ctx.setPhase('ANSWERING');
    ctx.stage(`<div class="fact"><p class="step">Round ${k + 1} of ${ROUNDS}${mult > 1 ? ' · double points' : ''}</p><h1>${esc(prompt.q)}</h1><p class="muted">Think like everyone else. Clever loses.</p></div>`, 'fact-stage');
    if (k === 0) ctx.say('ask');
    const res = await ctx.ask({
      to: ps, secs: 25,
      view: () => ({ type: 'text', prompt: prompt.q, sub: 'What would everyone else say?', max: 30, placeholder: 'One answer', button: 'Lock it in' }),
      validate: (p, d) => (d && String(d.text || '').trim() ? null : 'Type an answer.'),
      bot: () => ({ text: Math.random() < 0.7 ? prompt.a[Math.floor(Math.random() * Math.min(2, prompt.a.length))] : pick(prompt.a) })
    });
    const answers = [...res.answers].map(([id, d]) => ({ p: ctx.byId(id), text: String(d.text).trim().slice(0, 30) })).filter(a => a.p);
    await ctx.moderate(answers.map((a, i) => Object.assign(a, { id: 'm' + i })));
    const groups = group(answers.filter(a => !a.removed));
    const deltas = new Map();
    groups.forEach(g => { const pts = (g.items.length - 1) * 200 * mult; g.pts = pts; g.items.forEach(a => { if (pts) { ctx.score(a.p, pts); deltas.set(a.p.id, pts); } }); });
    const meld = groups.length === 1 && groups[0].items.length === ps.length && ps.length > 1;
    if (meld) ps.forEach(p => { ctx.score(p, 500 * mult); deltas.set(p.id, (deltas.get(p.id) || 0) + 500 * mult); });
    ctx.setPhase('REVEAL');
    ctx.stage(`<div class="fact"><h2>${esc(prompt.q)}</h2><div class="meld-groups">${groups.map((g, i) => `
      <div class="meld-group ${g.items.length > 1 ? 'match' : 'lone'}" style="--i:${i}"><b>${esc(g.label)}</b><span class="pickers">${G.dots(ctx, g.items.map(a => a.p))}</span><small>${g.items.length > 1 ? `${g.items.length} minds · +${g.pts.toLocaleString()} each` : 'lone wolf'}</small></div>`).join('') || '<p class="big">Nobody answered.</p>'}</div>
      ${meld ? '<div class="card truth">MIND MELD!</div>' : ''}</div>`, 'fact-stage');
    PP.Audio.sfx(meld ? 'hype' : 'reveal');
    if (meld) { ctx.hype('MIND MELD!'); await ctx.say('meld'); }
    else if (groups.length && groups[0].items.length === 1) await ctx.say('lone');
    else await ctx.say('reveal');
    await ctx.wait(3500);
    if (k === 2 || k === ROUNDS - 1) await ctx.scoreboard('Scores', deltas, 3500);
  }
})();
