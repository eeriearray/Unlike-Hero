// Name, Place, Animal, Thing: one letter, one timer, everybody's notebook.
import { h, secondsLeft, burstAt } from '../ui.js';
import { sfx } from '../audio.js';
import { strip, board } from './common.js';

const ALPHA = 'ABCDEFGHIJKLMNOPRSTUVW';

export default {
  mount(root, api) {
    const top = h('div.npat-top');
    const letterBox = h('div.npat-letter.hand', { 'aria-live': 'polite' });
    const clock = h('div.npat-clock.hand', { role: 'timer' });
    top.append(letterBox, clock);
    const body = h('div.npat-body.paper');
    root.append(top, body);

    let view = null;
    let phaseKey = '';
    let draft = {};
    let draftTimer = null;
    let clockTimer = null;
    let spinTimer = null;
    let lastTick = -1;
    let resultShown = false;

    const sendDraft = (type = 'draft') => {
      clearTimeout(draftTimer);
      return api.act({ type, answers: draft }, { quiet: type === 'draft' });
    };

    function tickClock() {
      if (!view?.deadline) { clock.textContent = ''; return; }
      const left = secondsLeft(view.deadline, api.now());
      clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      clock.classList.toggle('urgent', left <= 10 && view.phase === 'writing');
      if (view.phase === 'writing' && left <= 5 && left !== lastTick && left > 0) sfx('tick');
      if (view.phase === 'writing' && left === 0 && lastTick !== 0 && !view.players.find(p => p.id === api.me)?.penDown) sendDraft('draft');
      lastTick = left;
    }

    function spin(letter) {
      clearInterval(spinTimer);
      let i = 0;
      const calm = document.body.classList.contains('calm');
      letterBox.classList.add('spinning');
      spinTimer = setInterval(() => {
        letterBox.textContent = ALPHA[(i++ * 7) % ALPHA.length];
        if (i % 2) sfx('tick');
        if (i > (calm ? 1 : 22)) {
          clearInterval(spinTimer);
          letterBox.textContent = letter;
          letterBox.classList.remove('spinning');
          letterBox.classList.add('landed');
          sfx('bell');
          setTimeout(() => letterBox.classList.remove('landed'), 600);
        }
      }, 95);
    }

    function settings(v) {
      const s = v.settings;
      const opt = (label, key, values, fmt) => h('div.npat-opt', {}, h('span.note', {}, label),
        ...values.map(n => h('button.btn.small' + (s[key] === n ? '.yellow' : '.ghost'), { on: { click: () => { sfx('click'); api.act({ type: 'settings', [key]: n }); } } }, fmt(n))));
      const custom = h('input.field', { maxlength: 14, placeholder: 'e.g. Cricketer', value: s.custom, 'aria-label': 'Custom column' });
      custom.addEventListener('change', () => api.act({ type: 'settings', custom: custom.value }));
      return h('div.npat-settings', {},
        opt('Timer', 'seconds', [45, 60, 90, 120], n => `${n}s`),
        opt('Rounds', 'rounds', [3, 5, 8], n => String(n)),
        h('div.npat-opt', {}, h('span.note', {}, 'Extra column'), custom));
    }

    function render(v, changed) {
      const me = v.players.find(p => p.id === api.me);
      api.setPlayers(strip(v, p => ({
        score: v.totals[p.id],
        sub: v.phase === 'writing' ? (p.penDown ? 'pen down ✓' : 'writing…') : v.phase === 'review' ? (p.doneReviewing ? 'done ✓' : 'checking…') : (v.roundPoints[p.id] !== undefined ? `+${v.roundPoints[p.id]}` : ''),
        active: (v.phase === 'writing' && !p.penDown) || (v.phase === 'review' && !p.doneReviewing)
      })));

      if (v.phase === 'setup') {
        letterBox.textContent = '?';
        api.setStatus('Set the rules, then ring the bell to start.', 'hot');
        if (changed || !body.querySelector('.npat-settings')) {
          body.replaceChildren(
            h('h2', {}, 'Name · Place · Animal · Thing'),
            h('p.note.npat-help', {}, `Columns: ${v.categories.join(', ')}.`),
            settings(v),
            h('button.btn.big.green', { on: { click: () => { sfx('bell'); api.act({ type: 'start' }); } } }, 'Ring the bell!'));
        } else {
          body.querySelector('.npat-settings').replaceWith(settings(v));
          body.querySelector('.npat-help').textContent = `Columns: ${v.categories.join(', ')}.`;
        }
        return;
      }

      if (v.phase === 'spin') {
        if (changed) { spin(v.letter); body.replaceChildren(h('h2.npat-wait', {}, `Round ${v.round} of ${v.settings.rounds}`), h('p.note', {}, 'Pick up your pencils…')); }
        api.setStatus('Spinning for a letter…');
        return;
      }
      letterBox.textContent = v.letter;

      if (v.phase === 'writing') {
        const done = !!me?.penDown;
        api.setStatus(done ? 'Pen down! Waiting for the others…' : `Everything starts with "${v.letter}". Go go go!`, done ? '' : 'hot');
        if (changed) {
          draft = { ...(v.sheets[api.me] || {}) };
          const form = h('form.npat-sheet');
          v.categories.forEach((cat, i) => {
            const input = h('input.npat-input', { maxlength: 30, autocomplete: 'off', autocapitalize: 'words', spellcheck: false, value: draft[cat] || '', placeholder: `${v.letter}…`, 'aria-label': cat, enterkeyhint: i === v.categories.length - 1 ? 'done' : 'next' });
            input.addEventListener('input', () => {
              draft[cat] = input.value;
              if (input.value.length === 1) sfx('pencil');
              clearTimeout(draftTimer);
              draftTimer = setTimeout(() => sendDraft(), 700);
            });
            input.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') { e.preventDefault(); form.querySelectorAll('input')[i + 1]?.focus(); }
            });
            form.append(h('label.npat-row', {}, h('span.npat-cat.hand', {}, cat), input));
          });
          const pens = h('button.btn.big.red', { type: 'submit' }, 'Pens down!');
          form.append(pens);
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            sfx('drum');
            const res = await sendDraft('submit');
            if (res.ok) form.querySelectorAll('input,button').forEach(x => { x.disabled = true; });
          });
          body.replaceChildren(form);
          setTimeout(() => form.querySelector('input')?.focus({ preventScroll: true }), 50);
        }
        if (done) body.querySelectorAll('input,button').forEach(x => { x.disabled = true; });
        return;
      }

      // review / scores / finished: the class's notebook
      const reviewing = v.phase === 'review';
      const myDone = !!me?.doneReviewing;
      if (reviewing) api.setStatus(myDone ? 'Waiting for the others to finish checking…' : 'Check the answers. Tap ✗ on anything fishy.', myDone ? '' : 'hot');
      else if (v.phase === 'scores') api.setStatus(`Round ${v.round} marked!`, 'good');
      else api.setStatus('Final marks are in!', 'good');

      const table = h('table.npat-table');
      table.append(h('thead', {}, h('tr', {}, h('th', {}, v.letter), ...v.players.map(p => h('th', {}, p.id === api.me ? 'You' : p.name)))));
      const tb = h('tbody');
      for (const cat of v.categories) {
        const tr = h('tr', {}, h('th.hand', {}, cat));
        for (const p of v.players) {
          const ans = v.sheets[p.id]?.[cat] || '';
          const td = h('td');
          const valid = v.validity[p.id]?.[cat];
          const mark = v.marks[p.id]?.[cat];
          const vote = v.votes[`${cat}|${p.id}`];
          td.append(h('span.npat-ans' + (!ans ? '.blank' : ''), {}, ans || '—'));
          if (reviewing) {
            if (valid && !valid.ok && valid.reason !== 'rejected by the class') td.classList.add('bad');
            if (valid && valid.reason === 'rejected by the class') td.classList.add('rejected');
            if (ans && p.id !== api.me) {
              const x = h('button.npat-x' + (vote?.mine ? '.on' : ''), { title: vote?.mine ? 'Undo reject' : 'Reject this answer', 'aria-pressed': String(!!vote?.mine), 'aria-label': `Reject ${ans}` }, '✗', vote?.count ? h('small', {}, vote.count) : null);
              x.addEventListener('click', () => { sfx('eraser'); api.act({ type: 'vote', cat, target: p.id, reject: !vote?.mine }); });
              td.append(x);
            } else if (vote?.count) td.append(h('small.npat-votes', {}, `✗${vote.count}`));
          } else if (mark) {
            td.classList.add(mark.points === 10 ? 'p10' : mark.points === 5 ? 'p5' : 'p0');
            td.append(h('span.npat-mark.hand', { title: mark.reason }, mark.points));
          }
          tr.append(td);
        }
        tb.append(tr);
      }
      if (!reviewing) {
        tb.append(h('tr.npat-total', {}, h('th.hand', {}, 'Round'), ...v.players.map(p => h('td.hand', {}, `+${v.roundPoints[p.id] ?? 0}`))));
      }
      table.append(tb);
      const actions = h('div.npat-actions');
      if (reviewing && !myDone) actions.append(h('button.btn.big.green', { on: { click: () => { sfx('good'); api.act({ type: 'done-review' }); } } }, 'Done checking'));
      if (v.phase === 'scores') actions.append(h('button.btn.big.green', { on: { click: () => { sfx('bell'); api.act({ type: 'start' }); } } }, `Next round (${v.round + 1} of ${v.settings.rounds})`));
      if (v.phase === 'finished') actions.append(h('button.btn.big', { on: { click: () => { sfx('bell'); api.act({ type: 'start' }); } } }, 'Play again'));
      body.replaceChildren(h('div.npat-scroll', {}, table), h('p.note.npat-key', {}, reviewing ? 'Red = blank or wrong letter. If most others ✗ an answer, it scores 0.' : '10 = unique · 5 = someone wrote the same · 0 = blank, wrong letter or rejected'), actions);
      if (changed && !reviewing) { sfx('fill'); burstAt(table); }
      if (v.phase === 'finished' && !resultShown) {
        resultShown = true;
        const best = Math.max(...v.players.map(p => v.totals[p.id]));
        const won = v.totals[api.me] === best;
        setTimeout(() => api.results({
          title: won ? 'Top of the class!' : `${v.players.filter(p => v.totals[p.id] === best).map(p => p.name).join(' & ')} wins`,
          sub: `${v.settings.rounds} rounds · letters ${v.history.map(r => r.letter).join(' ')}`,
          tone: won ? 'win' : 'lose',
          board: board(v, v.totals),
          actions: [{ label: 'Play again', cls: 'green', fn: () => api.act({ type: 'start' }) }]
        }), 1200);
      }
      if (v.phase !== 'finished') resultShown = false;
    }

    function update(v) {
      const key = `${v.round}-${v.phase}`;
      const changed = key !== phaseKey;
      phaseKey = key;
      view = v;
      if (changed && v.phase === 'writing') sfx('go');
      if (changed && v.phase === 'review') sfx('page');
      render(v, changed);
      clearInterval(clockTimer);
      tickClock();
      if (v.deadline) clockTimer = setInterval(tickClock, 250);
    }

    return {
      update,
      destroy() { clearInterval(clockTimer); clearInterval(spinTimer); clearTimeout(draftTimer); }
    };
  }
};
