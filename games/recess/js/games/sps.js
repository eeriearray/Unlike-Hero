// Stone Paper Scissors: both lock in secret, then "Stone… Paper… Scissors… SHOOT!"
import { h, wait } from '../ui.js';
import { sfx } from '../audio.js';
import { strip, nameOf, board } from './common.js';

const INK = '#1d2b4f';
export const ART = {
  stone: `<svg viewBox="0 0 100 100"><path d="M14 66c-6-22 8-44 30-46 20-2 40 8 42 30 2 18-12 30-36 30-16 0-32-3-36-14z" fill="#9ea7b5" stroke="${INK}" stroke-width="4.5"/><path d="M30 48c6-4 14-4 20 1M56 66c6 0 12-3 15-7M36 66l4 4" stroke="${INK}" stroke-width="3" fill="none" opacity=".45" stroke-linecap="round"/><circle cx="62" cy="38" r="4" fill="#fff" opacity=".5"/></svg>`,
  paper: `<svg viewBox="0 0 100 100"><g transform="rotate(-7 50 50)"><path d="M24 12h44l10 10v66H24z" fill="#fff" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/><path d="M68 12v10h10" fill="#eee" stroke="${INK}" stroke-width="4"/><path d="M32 36h38M32 48h38M32 60h30M32 72h34" stroke="#9cc3ee" stroke-width="3"/><path d="M30 14v74" stroke="#ec6f72" stroke-width="2.5"/></g></svg>`,
  scissors: `<svg viewBox="0 0 100 100"><g stroke="${INK}" stroke-width="4.5" stroke-linecap="round"><path d="M30 18l36 52M70 18L34 70" stroke-width="7"/><path d="M30 18l36 52M70 18L34 70" stroke="#cfd8dc" stroke-width="3"/><circle cx="30" cy="80" r="11" fill="#e0453a"/><circle cx="70" cy="80" r="11" fill="#e0453a"/><circle cx="30" cy="80" r="4.5" fill="#fff8e8"/><circle cx="70" cy="80" r="4.5" fill="#fff8e8"/><circle cx="50" cy="44" r="3.5" fill="${INK}"/></g></svg>`,
  hidden: `<svg viewBox="0 0 100 100"><g transform="rotate(4 50 50)"><path d="M20 22h60v56H20z" fill="#ffe15a" stroke="${INK}" stroke-width="4.5"/><path d="M20 22l30 26 30-26" fill="none" stroke="${INK}" stroke-width="4"/></g><text x="50" y="72" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="24" fill="${INK}">locked</text></svg>`,
  thinking: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="34" fill="#fff" stroke="${INK}" stroke-width="4" stroke-dasharray="8 7"/><text x="50" y="62" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="40" fill="${INK}">?</text></svg>`
};
const NAMES = { stone: 'Stone', paper: 'Paper', scissors: 'Scissors' };

export default {
  mount(root, api) {
    const arena = h('div.sps-arena');
    const left = h('div.sps-side'), right = h('div.sps-side');
    const leftHand = h('div.sps-hand'), rightHand = h('div.sps-hand');
    const leftName = h('div.sps-name'), rightName = h('div.sps-name');
    left.append(leftHand, leftName); right.append(rightHand, rightName);
    const vs = h('div.sps-vs.hand', {}, 'vs');
    arena.append(left, vs, right);
    const shout = h('div.sps-shout.hand', { 'aria-live': 'assertive' });
    const choices = h('div.sps-choices', { role: 'group', 'aria-label': 'Choose' });
    for (const c of ['stone', 'paper', 'scissors']) {
      const b = h('button.sps-choice', { 'aria-label': NAMES[c], html: ART[c] + `<span>${NAMES[c]}</span>` });
      b.addEventListener('click', async () => {
        if (!view || view.status !== 'choosing' || view.myChoice) return;
        sfx('tap');
        await api.act({ type: 'choose', choice: c });
      });
      choices.append(b);
    }
    const bestOf = h('div.sps-bestof', {}, h('span.note', {}, 'Match length:'),
      ...[3, 5].map(n => h('button.btn.small.ghost', { 'data-n': n, on: { click: () => { sfx('click'); api.act({ type: 'best-of', bestOf: n }); } } }, `Best of ${n}`)));
    const next = h('button.btn.big.green', { hidden: true }, 'Next round');
    next.addEventListener('click', () => { sfx('click'); api.act({ type: 'next-round' }); });
    const history = h('div.sps-history');
    root.append(arena, shout, choices, bestOf, next, history);

    let view = null;
    let revealedRound = 0;
    let animating = false;
    let resultShownFor = 0;

    const opp = () => view.players.find(p => p.id !== api.me);

    async function revealAnim(v) {
      animating = true;
      choices.hidden = true;
      leftHand.innerHTML = rightHand.innerHTML = ART.stone;
      leftHand.className = rightHand.className = 'sps-hand shake';
      for (const w of ['Stone…', 'Paper…', 'Scissors…']) {
        shout.textContent = w; sfx('countdown');
        await wait(document.body.classList.contains('calm') ? 50 : 620);
      }
      shout.textContent = 'SHOOT!'; sfx('go');
      leftHand.className = rightHand.className = 'sps-hand pop';
      const mine = v.choices[api.me], theirs = v.choices[opp().id];
      leftHand.innerHTML = ART[mine]; rightHand.innerHTML = ART[theirs];
      const w = v.lastResult.winnerId;
      if (w) {
        (w === api.me ? leftHand : rightHand).classList.add('won');
        (w === api.me ? rightHand : leftHand).classList.add('lost');
      }
      await wait(350);
      sfx(w === api.me ? 'good' : w ? 'bad' : 'draw');
      animating = false;
      render(view);
    }

    function render(v) {
      const o = opp();
      leftName.textContent = 'You';
      rightName.textContent = o.name;
      api.setPlayers(strip(v, p => ({ score: v.scores[p.id], sub: p.id === api.me ? (v.myChoice ? 'locked in' : 'choosing') : (p.hasChosen ? 'locked in' : 'choosing'), active: v.status === 'choosing' && !p.hasChosen })));
      bestOf.hidden = !(v.status === 'choosing' && v.history.length === 0 && !v.myChoice);
      bestOf.querySelectorAll('button').forEach(b => b.classList.toggle('yellow', Number(b.dataset.n) === v.bestOf));
      history.replaceChildren(...v.history.map(r => h('span.chip', { title: `Round ${r.round}` },
        r.winnerId ? (r.winnerId === api.me ? 'W' : 'L') : '=')));
      if (animating) return;

      if (v.status === 'choosing') {
        shout.textContent = '';
        choices.hidden = !!v.myChoice;
        choices.querySelectorAll('button').forEach(b => { b.disabled = !!v.myChoice; });
        leftHand.className = 'sps-hand';
        rightHand.className = 'sps-hand';
        leftHand.innerHTML = v.myChoice ? ART.hidden : ART.thinking;
        rightHand.innerHTML = o.hasChosen ? ART.hidden : ART.thinking;
        next.hidden = true;
        api.setStatus(v.myChoice ? (o.hasChosen ? 'Both locked…' : `Locked in. Waiting for ${o.name}…`) : `Round ${v.round} · first to ${v.toWin}. Pick in secret!`, v.myChoice ? '' : 'hot');
      } else {
        choices.hidden = true;
        const r = v.lastResult;
        const w = r.winnerId;
        shout.textContent = w ? `${NAMES[r.choices[w]]} beats ${NAMES[r.choices[v.players.find(p => p.id !== w).id]]}!` : 'Same hands — a tie!';
        api.setStatus(w ? (w === api.me ? 'You take the round!' : `${nameOf(v, w)} takes the round.`) : 'Tie! Go again.', w === api.me ? 'good' : w ? 'bad' : '');
        next.hidden = v.status !== 'revealed';
        if (v.status === 'finished' && resultShownFor !== v.matchNo) {
          resultShownFor = v.matchNo;
          const won = v.matchWinner === api.me;
          setTimeout(() => api.results({
            title: won ? 'You win the match!' : `${nameOf(v, v.matchWinner)} wins`,
            sub: `Best of ${v.bestOf}`,
            tone: won ? 'win' : 'lose',
            board: board(v, v.scores),
            actions: [3, 5].map(n => ({ label: `Rematch (best of ${n})`, cls: n === 3 ? 'green' : '', fn: () => api.act({ type: 'rematch', bestOf: n }) }))
          }), 900);
        }
      }
    }

    function update(v) {
      const prev = view;
      view = v;
      const roundsDone = v.history.length;
      if (v.status !== 'choosing' && roundsDone > revealedRound && (prev || roundsDone > 0)) {
        revealedRound = roundsDone;
        if (prev) { animating = true; render(v); revealAnim(v); return; }
      }
      if (v.status === 'choosing') revealedRound = roundsDone;
      render(v);
    }

    return { update, destroy() {} };
  }
};
