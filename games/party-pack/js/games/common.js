/* Helpers shared by the six games. */
(function () {
  'use strict';
  const PP = window.PP; const { esc } = PP;
  PP.G = {
    /** Title card + the host's intro line. */
    async intro(ctx, g, sub) {
      ctx.setPhase('INTRO');
      ctx.stage(`<div class="intro" style="--a:${g.accent}"><div class="host-big">${PP.Art.host(ctx.key)}</div><h1>${esc(g.title)}</h1>
        <p class="host-name">Hosted by ${esc(PP.HOSTS[ctx.key].name)}</p>
        ${g.rules ? `<ul class="rules card-box">${g.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</div>`, 'intro');
      ctx.waitAll(g.title, 'Starting… look at the big screen.');
      await ctx.wait(800);
      await ctx.say('intro', null, 12000);
      await ctx.wait(1200);
    },
    /** A round banner. */
    async banner(ctx, title, sub, ms) {
      ctx.stage(`<div class="banner"><h1>${esc(title)}</h1>${sub ? `<p class="big">${esc(sub)}</p>` : ''}</div>`, 'banner');
      PP.Audio.sfx('whoosh');
      await ctx.wait(ms || 2200);
    },
    chip(ctx, p) { return p ? `<span class="who" style="--c:${ctx.color(p)}"><span class="av">${PP.Art.player(p, ctx.color(p))}</span><span class="shape">${ctx.shape(p)}</span>${esc(p.name)}</span>` : ''; },
    dots(ctx, ps) { return ps.map(p => `<span class="dot" title="${esc(p.name)}">${PP.Art.player(p, ctx.color(p))}</span>`).join(''); },
    /** Take a random unused item from a list (falls back to reuse when the list runs out). */
    take(list, used) {
      const free = list.filter(x => !used.has(x)); const item = PP.pick(free.length ? free : list); used.add(item); return item;
    },
    /** answers: Map(id → index) → { counts, voters: [[ids]] } */
    tally(answers, n) {
      const counts = Array.from({ length: n }, () => 0), voters = Array.from({ length: n }, () => []);
      for (const [id, v] of answers) { const i = typeof v === 'object' && v ? v.choice : v; if (i >= 0 && i < n) { counts[i]++; voters[i].push(id); } }
      return { counts, voters };
    },
    /** Write the progress strip for a phase in which players are busy on their phones. */
    busyStage(ctx, title, sub, cls) {
      ctx.stage(`<div class="busy"><h1>${esc(title)}</h1>${sub ? `<p class="big">${sub}</p>` : ''}<div class="busy-phones" aria-hidden="true"><i></i><i></i><i></i></div><p class="muted">Check your phones. Players who are done get a tick below.</p></div>`, cls || 'busy-stage');
    }
  };
})();
