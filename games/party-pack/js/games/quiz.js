/* 4. The Cutthroat Quiz — trivia in a murder hotel. Wrong answers go to the Killing Floor
   (a deadly minigame). The dead become ghosts who keep playing for points and can haunt the
   living: fog their phone (wipe it off with a finger) or scramble their answer buttons.
   Final: The Exit, a race to the door where ghosts can win back their lives. */
(function () {
  'use strict';
  const PP = window.PP; const { esc, shuffle, pick } = PP; const G = PP.G;
  const LETTERS = 'ABCD';
  const QUESTIONS = 7, EXIT_GOAL = 9;

  const game = PP.GAMES.quiz = {
    title: 'The Cutthroat Quiz', icon: '🔪', accent: '#b26bff', font: "'Creepster', 'Lilita One', sans-serif", min: 1,
    blurb: 'Trivia hosted by a murderer. Wrong answers face deadly minigames. Ghosts haunt the living.',
    rules: ['Answer correctly to stay alive (+1000).', 'Wrong? Survive the Killing Floor or become a ghost.', 'Ghosts still score and can fog or scramble the living.', 'The Exit: first one out the door wins.'],
    async run(ctx) {
      const C = ctx.content();
      ctx.players().forEach(p => { p.ghost = false; }); ctx.refreshStrip();
      await G.intro(ctx, game);
      const qs = shuffle(C.quiz).slice(0, QUESTIONS);
      for (let k = 0; k < qs.length; k++) {
        await question(ctx, qs[k], k);
        if (!ctx.players().some(p => !p.ghost)) { await ctx.say('allDead'); break; }
      }
      const winners = await exitRace(ctx, C);
      await ctx.finale({ winners, subtitle: winners.length ? 'escaped the hotel!' : 'Nobody escaped.' });
      ctx.players().forEach(p => { p.ghost = false; });
    }
  };

  // A question that ghosts can haunt. Returns the ask result.
  async function hauntedAsk(ctx, q, secs, sub, stageFn) {
    const H = PP.Host; const ps = ctx.players();
    const living = () => ps.filter(p => !p.ghost);
    const haunts = new Map(), used = new Set();
    const viewFor = p => ({
      type: 'choice', prompt: q.q, sub: p.ghost ? 'You\'re a ghost: answer for +500, and haunt someone' : sub,
      options: q.o.map((o, i) => ({ label: o, badge: LETTERS[i] })), effects: haunts.get(p.id) || null,
      haunt: p.ghost ? { targets: living().map(t => ({ id: t.id, name: t.name })), used: used.has(p.id) } : null
    });
    let answeredIds = new Set();
    const res = await ctx.ask({
      to: ps, secs, view: viewFor,
      live: (p, d) => {
        if (!d || !d.haunt || !p.ghost || used.has(p.id)) return;
        const t = ctx.byId(d.haunt); if (!t || t.ghost || answeredIds.has(t.id)) return;
        used.add(p.id);
        const e = Object.assign({}, haunts.get(t.id)); e[d.mode === 'scramble' ? 'scramble' : 'fog'] = true; haunts.set(t.id, e);
        if (H.views[t.id]) ctx.view(t, Object.assign({}, H.views[t.id], { effects: e }));
        if (H.views[p.id]) ctx.view(p, Object.assign({}, H.views[p.id], { haunt: { targets: [], used: true } }));
        const n = document.querySelector('#haunts'); if (n) n.insertAdjacentHTML('beforeend', `<p class="haunt-note">👻 ${esc(p.name)} ${d.mode === 'scramble' ? 'scrambled' : 'fogged'} ${esc(t.name)}'s phone</p>`);
        PP.Audio.sfx('whoosh'); PP.Voice.speak('quiz', 'haunt');
      },
      liveFinal: (p, d) => { if (d && d.choice != null && d.choice >= 0 && d.choice < q.o.length) { answeredIds.add(p.id); return true; } return false; },
      keepView: p => p.ghost && !used.has(p.id),
      bot: null,
      botMulti: p => {
        const out = [];
        if (p.ghost && Math.random() < 0.6) { const t = pick(living()); if (t) out.push({ haunt: t.id, mode: Math.random() < 0.5 ? 'fog' : 'scramble' }); }
        out.push({ choice: Math.random() < 0.62 ? q.a : Math.floor(Math.random() * q.o.length) });
        return out;
      },
      audience: { prompt: q.q, options: q.o }
    });
    return res;
  }

  async function question(ctx, q, k) {
    const ps = ctx.players();
    ctx.setPhase('QUESTION');
    const show = reveal => ctx.stage(`<div class="quiz"><p class="step">Question ${k + 1} of ${QUESTIONS}</p><h1>${esc(q.q)}</h1>
      <div class="opt-grid">${q.o.map((o, i) => `<div class="opt ${reveal ? (i === q.a ? 'right' : 'wrong') : ''}"><span class="num">${LETTERS[i]}</span>${esc(o)}${reveal ? `<span class="pickers">${G.dots(ctx, reveal[i])}</span>` : ''}</div>`).join('')}</div>
      <div id="haunts"></div>
      <div class="souls"><span>Alive: ${G.dots(ctx, ps.filter(p => !p.ghost))}</span>${ps.some(p => p.ghost) ? `<span>Ghosts: ${G.dots(ctx, ps.filter(p => p.ghost))}</span>` : ''}</div></div>`, 'quiz-stage');
    show(null);
    ctx.say('question');
    const res = await hauntedAsk(ctx, q, 20, 'Answer correctly to survive');
    const by = q.o.map(() => []);
    for (const [id, d] of res.answers) { const p = ctx.byId(id); if (p && d && d.choice != null) by[d.choice].push(p); }
    PP.Audio.sfx('reveal'); show(by);
    const right = new Set(by[q.a].map(p => p.id));
    ps.forEach(p => { if (right.has(p.id)) ctx.score(p, p.ghost ? 500 : 1000); });
    await ctx.wait(3000);
    const victims = ps.filter(p => !p.ghost && !right.has(p.id));
    if (!victims.length) { if (k % 3 === 0) await ctx.say('allRight'); return; }
    await killingFloor(ctx, victims);
  }

  async function killingFloor(ctx, victims) {
    const kind = pick(['math', 'cups', 'tap']);
    ctx.setPhase('KILLING_FLOOR');
    PP.Audio.sfx('kill');
    const names = G.dots(ctx, victims) + ' ' + victims.map(v => esc(v.name)).join(', ');
    const title = { math: 'MATH OR DEATH', cups: 'THE POISONED CUPS', tap: 'TAP FOR YOUR LIFE' }[kind];
    const how = { math: 'Solve three sums. One mistake and you die.', cups: 'Some of these cups are poisoned. Pick one and drink.', tap: 'Tap as fast as you can. The slowest dies.' }[kind];
    ctx.stage(`<div class="floor"><h1>THE KILLING FLOOR</h1><h2>${title}</h2><p class="big">${names}</p><p>${how}</p></div>`, 'floor-stage');
    await ctx.say('floor');
    const dead = [];
    if (kind === 'math') {
      const probs = victims.map(() => Array.from({ length: 3 }, () => { const op = pick(['+', '−', '×']); const a = 2 + Math.floor(Math.random() * (op === '×' ? 11 : 40)), b = 2 + Math.floor(Math.random() * (op === '×' ? 9 : 30)); return { t: `${a} ${op} ${b}`, v: op === '+' ? a + b : op === '−' ? a - b : a * b }; }));
      const pm = new Map(victims.map((v, i) => [v.id, probs[i]]));
      const r = await ctx.ask({ to: victims, secs: 20, view: p => ({ type: 'math', problems: pm.get(p.id).map(x => x.t) }), bot: p => ({ answers: pm.get(p.id).map(x => Math.random() < 0.85 ? x.v : x.v + 1) }), others: () => PP.Host.waitView('Watch them sweat', 'Someone is doing maths for their life.') });
      victims.forEach(v => { const a = r.answers.get(v.id); const ok = a && Array.isArray(a.answers) && pm.get(v.id).every((x, i) => Number(a.answers[i]) === x.v); if (!ok) dead.push(v); });
    } else if (kind === 'cups') {
      const n = Math.max(3, victims.length + 1); const poison = new Set(shuffle([...Array(n).keys()]).slice(0, Math.max(1, Math.floor(n / 2))));
      ctx.stage(`<div class="floor"><h2>THE POISONED CUPS</h2><div class="cups">${Array.from({ length: n }, (_, i) => `<div class="cup">🍷<b>${i + 1}</b></div>`).join('')}</div><p class="big">${poison.size} of ${n} are poisoned.</p></div>`, 'floor-stage');
      const r = await ctx.ask({ to: victims, secs: 12, view: () => ({ type: 'choice', prompt: 'Pick a cup. Drink.', options: Array.from({ length: n }, (_, i) => ({ label: `Cup ${i + 1}`, badge: '🍷' })) }), bot: () => Math.floor(Math.random() * n) });
      victims.forEach(v => { const c = r.answers.get(v.id); if (c == null || poison.has(c)) dead.push(v); });
      ctx.stage(`<div class="floor"><h2>THE POISONED CUPS</h2><div class="cups">${Array.from({ length: n }, (_, i) => `<div class="cup ${poison.has(i) ? 'bad' : 'ok'}">${poison.has(i) ? '☠️' : '🍷'}<b>${i + 1}</b><span>${G.dots(ctx, victims.filter(v => r.answers.get(v.id) === i))}</span></div>`).join('')}</div></div>`, 'floor-stage');
      await ctx.wait(2600);
    } else {
      const secs = 7; const need = 30;
      const r = await ctx.ask({ to: victims, secs: secs + 6, noExtend: true, view: () => ({ type: 'tap', prompt: 'Tap as fast as you can!', secs, goal: victims.length === 1 ? `Reach ${need} taps in ${secs} seconds to live.` : 'The slowest tapper dies.' }), bot: () => ({ taps: 18 + Math.floor(Math.random() * 30) }) });
      const taps = victims.map(v => ({ v, n: Math.min(200, Number((r.answers.get(v.id) || {}).taps) || 0) }));
      if (victims.length === 1) { if (taps[0].n < need) dead.push(taps[0].v); }
      else { const low = Math.min(...taps.map(t => t.n)); taps.forEach(t => { if (t.n === low || t.n < 15) dead.push(t.v); }); }
      ctx.stage(`<div class="floor"><h2>TAP FOR YOUR LIFE</h2><div class="taps">${taps.sort((a, b) => b.n - a.n).map(t => `<p>${G.chip(ctx, t.v)} <b>${t.n}</b> taps ${dead.includes(t.v) ? '☠️' : '✅'}</p>`).join('')}</div></div>`, 'floor-stage');
      await ctx.wait(2600);
    }
    if (dead.length) {
      dead.forEach(p => { p.ghost = true; }); ctx.refreshStrip();
      PP.Audio.sfx('kill');
      ctx.stage(`<div class="floor"><h1>☠️</h1><p class="big">${dead.map(p => G.chip(ctx, p)).join(' ')} ${dead.length === 1 ? 'is' : 'are'} dead.</p><p>Ghosts keep answering for points, and can haunt the living.</p></div>`, 'floor-stage');
      await ctx.say('died', { names: PP.listNames(dead.map(p => p.name)) });
    } else {
      ctx.stage(`<div class="floor"><h1>😮‍💨</h1><p class="big">Everyone survived the Killing Floor.</p></div>`, 'floor-stage');
      await ctx.say('survived');
    }
    await ctx.wait(1500);
  }

  async function exitRace(ctx, C) {
    const ps = ctx.players(); const pos = new Map(ps.map(p => [p.id, p.ghost ? 0 : 3]));
    await G.banner(ctx, 'THE EXIT', `First to the door (${EXIT_GOAL} steps) escapes. The living start 3 steps ahead.`, 2600);
    await ctx.say('exit');
    const qs = shuffle(C.exit);
    const track = () => `<div class="track">${ps.map(p => `<div class="lane ${p.ghost ? 'ghost' : ''}" style="--c:${ctx.color(p)}"><span class="lname">${esc(p.name)}</span><div class="road">${Array.from({ length: EXIT_GOAL }, (_, i) => `<i class="${i < pos.get(p.id) ? 'on' : ''}"></i>`).join('')}<span class="runner" style="--x:${Math.min(EXIT_GOAL, pos.get(p.id)) / EXIT_GOAL}">${PP.Art.player(p, ctx.color(p))}</span></div><span class="door">🚪</span></div>`).join('')}</div>`;
    for (let k = 0; k < Math.min(qs.length, 14); k++) {
      const q = qs[k];
      ctx.setPhase('EXIT_RACE');
      ctx.stage(`<div class="quiz exit"><h2>${esc(q.q)}</h2><div class="opt-grid three">${q.o.map((o, i) => `<div class="opt"><span class="num">${LETTERS[i]}</span>${esc(o)}</div>`).join('')}</div><div id="haunts"></div>${track()}</div>`, 'quiz-stage');
      const res = await hauntedAsk(ctx, q, 9, 'Answer right to take a step');
      for (const [id, d] of res.answers) if (d && d.choice === q.a) pos.set(id, pos.get(id) + 1);
      ctx.stage(`<div class="quiz exit"><h2>${esc(q.q)}</h2><p class="big">Answer: <b>${esc(q.o[q.a])}</b></p>${track()}</div>`, 'quiz-stage');
      PP.Audio.sfx('point');
      await ctx.wait(1800);
      const out = ps.filter(p => pos.get(p.id) >= EXIT_GOAL);
      if (out.length) {
        out.forEach(p => { ctx.score(p, 3000); p.ghost = false; }); ctx.refreshStrip();
        await ctx.say('escaped', { name: PP.listNames(out.map(p => p.name)) });
        return out;
      }
    }
    const best = Math.max(...ps.map(p => pos.get(p.id)));
    const out = ps.filter(p => pos.get(p.id) === best); out.forEach(p => ctx.score(p, 3000));
    return out;
  }
})();
