/* 11. Emoji Charades — one player gets a secret (a movie, saying, place…) and describes it with emoji only.
   Everyone else races to type the answer; wrong guesses can try again. */
(function () {
  'use strict';
  const PP = window.PP; const { esc, shuffle, pick } = PP; const G = PP.G;
  const MAX_TURNS = 6;

  const game = PP.GAMES.emoji = {
    title: 'Emoji Charades', icon: '😜', accent: '#ffd23f', font: "'Luckiest Guy', sans-serif", min: 3,
    blurb: 'Describe a secret movie, saying or place using only emoji. Everyone races to guess it.',
    rules: ['One player gets a secret thing. Emoji only, no letters.', 'Everyone else races to type the answer. Keep guessing!', 'First right: 1,000, then 800, 600…', 'The describer scores 300 for every correct guess.'],
    async run(ctx) {
      const C = ctx.content();
      await G.intro(ctx, game);
      const turns = shuffle(ctx.players()).slice(0, MAX_TURNS);
      const items = G.deal(ctx, 'emoji', C.emoji, turns.length);
      for (let k = 0; k < turns.length; k++) await turn(ctx, turns[k], items[k], k, turns.length);
      await ctx.finale();
    }
  };

  async function turn(ctx, describer, item, k, n) {
    const ps = ctx.players();
    await G.banner(ctx, `${describer.name}'s turn`, `${k + 1} of ${n} · Category: ${item.cat}`, 2000);
    // 1. the describer writes the clue
    ctx.setPhase('DESCRIBING');
    ctx.stage(`<div class="busy"><h1>${esc(describer.name)} is thinking in emoji…</h1><p class="big">Category: ${esc(item.cat)}</p><div class="busy-phones" aria-hidden="true"><i></i><i></i><i></i></div></div>`, 'busy-stage');
    if (k === 0) ctx.say('describe');
    const d = await ctx.ask({
      to: [describer], secs: 35,
      view: () => ({ type: 'text', prompt: `Describe "${item.t}" using only emoji`, sub: 'Secret! Category: ' + item.cat, max: 60, emojiOnly: true, placeholder: '🤔', button: 'Send clue' }),
      others: () => PP.Host.waitView('Get ready to guess', describer.name + ' is writing an emoji clue.'),
      validate: (p, v) => (PP.emojiOnly(v && v.text) ? null : 'Emoji only! Use your emoji keyboard.'),
      bot: () => ({ text: item.e })
    });
    const clue = PP.emojiOnly(d.answers.get(describer.id) && d.answers.get(describer.id).text);
    if (!clue) {
      ctx.stage(`<div class="fact"><h2>${esc(describer.name)} ran out of time.</h2><div class="card truth">${esc(item.t)}</div></div>`, 'fact-stage');
      await ctx.say('nobody'); await ctx.wait(2500); return;
    }
    // 2. everyone else races to guess (wrong guesses can try again)
    ctx.setPhase('GUESSING');
    const guessers = ps.filter(p => p !== describer);
    const order = [];
    const show = () => ctx.stage(`<div class="fact"><p class="step">${esc(item.cat)} · clue by ${esc(describer.name)}</p><div class="emoji-clue">${esc(clue)}</div>
      <p class="big">${order.length ? 'Got it: ' + G.dots(ctx, order) : 'Type your guesses on your phone!'}</p></div>`, 'fact-stage');
    show();
    if (k === 0) ctx.say('guess');
    await ctx.ask({
      to: guessers, secs: 45,
      view: () => ({ type: 'text', prompt: clue, sub: 'Guess the ' + item.cat.toLowerCase(), max: 40, placeholder: 'Your guess', button: 'Guess' }),
      others: () => PP.Host.waitView('Your clue is up', 'Watch them squirm.'),
      validate: (p, v) => { const t = v && String(v.text || '').trim(); if (!t) return 'Type a guess.'; return PP.isTruth(t, item.t, item.alts) ? null : 'Nope! Try again.'; },
      onAnswer: p => { order.push(p); PP.Audio.sfx('point'); show(); },
      bot: () => ({ text: Math.random() < 0.55 ? item.t : 'no idea' })
    });
    const deltas = new Map(); const add = (p, v) => { ctx.score(p, v); deltas.set(p.id, (deltas.get(p.id) || 0) + v); };
    order.forEach((p, i) => add(p, Math.max(200, 1000 - i * 200)));
    if (order.length) add(describer, 300 * order.length);
    ctx.setPhase('REVEAL');
    ctx.stage(`<div class="fact"><div class="emoji-clue small">${esc(clue)}</div><div class="card truth">${esc(item.t)}</div>
      <p class="big">${order.length ? order.map((p, i) => `${i ? '' : '🥇 '}${G.chip(ctx, p)}`).join(' ') : 'Nobody got it!'}</p>
      ${order.length ? `<p class="big">${G.chip(ctx, describer)} +${(300 * order.length).toLocaleString()}</p>` : ''}</div>`, 'fact-stage');
    PP.Audio.sfx(order.length ? 'ding' : 'buzz');
    await ctx.say(order.length === guessers.length ? 'allgot' : order.length ? 'gotit' : 'nobody');
    await ctx.wait(3000);
    if (k === n - 1 || k === 2) await ctx.scoreboard('Scores', deltas, 3000);
  }
})();
