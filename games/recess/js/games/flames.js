// FLAMES: two names, a pencil, and a very scientific elimination.
import { h, wait, burstAt } from '../ui.js';
import { sfx } from '../audio.js';
import { strip } from './common.js';

const WORDS = { F: 'Friends', L: 'Love', A: 'Affection', M: 'Marriage', E: 'Enemies', S: 'Siblings' };
const COLORS = { F: '#2e9e48', L: '#e84393', A: '#ff9a3c', M: '#8a5be6', E: '#e0453a', S: '#2463d6' };

export default {
  mount(root, api) {
    const page = h('div.flames-page.paper');
    const a = h('input.flames-name', { maxlength: 24, placeholder: 'First name', 'aria-label': 'First name' });
    const b = h('input.flames-name', { maxlength: 24, placeholder: 'Second name', 'aria-label': 'Second name' });
    const go = h('button.btn.big.red', { type: 'submit' }, 'Do the FLAMES!');
    const form = h('form.flames-form', {}, a, h('span.flames-plus.hand', {}, '+'), b, go);
    const work = h('div.flames-work', { 'aria-live': 'polite' });
    const after = h('div.flames-after', { hidden: true });
    const disclaimer = h('p.flames-disclaimer.note', {}, 'Official notice: FLAMES has a 0% success rate in predicting anything. Results may cause giggling, blushing and denial. Not valid for real decisions.');
    page.append(h('h2.flames-title', {}, 'F · L · A · M · E · S'), form, work, after, disclaimer);
    root.append(page);
    api.setStatus('Write two names and let the pencil decide.', 'hot');

    let view = null;
    let shownCount = 0;
    let running = false;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (running) return;
      if (!/[a-z]/i.test(a.value) || !/[a-z]/i.test(b.value)) { a.focus(); api.setStatus('Both names need some letters!', 'bad'); sfx('bad'); return; }
      sfx('scribble');
      go.disabled = true;
      const res = await api.act({ type: 'compute', a: a.value, b: b.value });
      if (!res.ok) go.disabled = false;
    });

    async function animate(r) {
      running = true;
      after.hidden = true;
      const fast = document.body.classList.contains('calm');
      const pause = (ms) => wait(fast ? 20 : ms);
      const row = (letters) => h('div.flames-letters', {}, letters.split('').map(ch => h('span.fl', {}, ch.toUpperCase())));
      const rowA = row(r.a), rowB = row(r.b);
      const count = h('div.flames-count.hand');
      const stripEl = h('div.flames-strip', {}, 'FLAMES'.split('').map(k => h('span.fs', { 'data-k': k, style: { '--c': COLORS[k] } }, k)));
      const reveal = h('div.flames-reveal');
      work.replaceChildren(
        h('div.flames-names', {}, h('div.flames-label.note', {}, r.names[0]), rowA, h('div.flames-label.note', {}, r.names[1]), rowB),
        count, stripEl, reveal);
      api.setStatus('Crossing out the letters you share…');
      const sa = r.struckA.map((x, i) => (x ? i : -1)).filter(i => i >= 0);
      const sb = r.struckB.map((x, i) => (x ? i : -1)).filter(i => i >= 0);
      await pause(400);
      for (let k = 0; k < sa.length; k++) {
        rowA.children[sa[k]].classList.add('struck');
        rowB.children[sb[k]].classList.add('struck');
        sfx('pencil');
        await pause(260);
      }
      count.textContent = `${r.count} letter${r.count === 1 ? '' : 's'} left`;
      count.classList.add('show');
      sfx('pop');
      await pause(700);
      api.setStatus(`Counting ${r.count} around F-L-A-M-E-S…`);
      const live = 'FLAMES'.split('');
      let idx = 0;
      for (const out of r.eliminated) {
        if (r.count > 0) {
          for (let step = 0; step < r.count; step++) {
            const k = live[(idx + step) % live.length];
            const el = stripEl.querySelector(`[data-k="${k}"]`);
            el.classList.add('tick'); sfx('tick');
            await pause(Math.max(45, 110 - r.count * 4));
            el.classList.remove('tick');
          }
        }
        idx = live.indexOf(out);
        live.splice(idx, 1);
        if (idx === live.length) idx = 0;
        stripEl.querySelector(`[data-k="${out}"]`).classList.add('out');
        sfx('eraser');
        await pause(380);
      }
      const k = r.result.key;
      const winner = stripEl.querySelector(`[data-k="${k}"]`);
      winner.classList.add('win');
      await pause(300);
      sfx('reveal');
      reveal.replaceChildren(
        h('div.flames-word.hand', { style: { color: COLORS[k] } }, WORDS[k] + '!'),
        h('div.flames-line.note', {}, r.result.line));
      reveal.classList.add('show');
      burstAt(reveal);
      api.setStatus(`${r.names[0]} + ${r.names[1]} = ${WORDS[k]}`, 'good');
      running = false;
      renderAfter();
    }

    function renderAfter() {
      if (!view?.reading) return;
      after.hidden = false;
      const share = h('button.btn.purple', { disabled: view.shared }, view.shared ? 'Pinned to the notice board' : 'Pin to the room\'s notice board');
      share.addEventListener('click', () => { sfx('paper'); api.act({ type: 'share' }); });
      const again = h('button.btn.ghost', {}, 'Try other names');
      again.addEventListener('click', () => { sfx('eraser'); api.act({ type: 'reset' }); });
      after.replaceChildren(h('p.note.flames-private', {}, view.shared ? 'Everyone in the room can see this now. No take-backs!' : 'Only you can see this result unless you pin it.'), share, again);
    }

    function update(v) {
      view = v;
      api.setPlayers(strip(v, () => ({ sub: 'calculating destiny' })));
      if (!v.reading) {
        work.replaceChildren();
        after.hidden = true;
        go.disabled = false;
        if (!running) api.setStatus('Write two names and let the pencil decide.', 'hot');
        return;
      }
      go.disabled = false;
      if (v.count !== shownCount) { shownCount = v.count; animate(v.reading); }
      else if (!running) renderAfter();
    }

    return { update, destroy() {} };
  }
};
