// Bluff: cards face down, poker face up.
import { h, burstAt } from '../ui.js';
import { sfx } from '../audio.js';
import { avatarSVG } from '../art.js';
import { strip, nameOf, board } from './common.js';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };

function face(c, extra = '') {
  const red = c.suit === 'H' || c.suit === 'D';
  return h('div.pcardface' + (red ? '.red' : '') + extra, { 'aria-label': `${c.rank} of ${{ S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }[c.suit]}` },
    h('span.cr', {}, c.rank), h('span.cs', {}, SUIT[c.suit]), h('span.cbig', {}, SUIT[c.suit]));
}
const back = (extra = '') => h('div.pcardback' + extra);

export default {
  mount(root, api) {
    const table = h('div.bluff-table');
    const opps = h('div.bluff-opps');
    const pile = h('div.bluff-pile');
    const claim = h('div.bluff-claim.hand', { 'aria-live': 'polite' });
    const callBtn = h('button.bluff-call.hand', { hidden: true }, 'BLUFF!');
    const reveal = h('div.bluff-reveal', { hidden: true });
    table.append(opps, h('div.bluff-center', {}, pile, claim, callBtn, reveal));
    const ranks = h('div.bluff-ranks', { hidden: true, role: 'group', 'aria-label': 'Choose the rank you claim' });
    const hand = h('div.bluff-hand', { role: 'group', 'aria-label': 'Your hand' });
    const controls = h('div.bluff-controls');
    const log = h('ul.bluff-log.note');
    root.append(table, ranks, controls, hand, log);

    let view = null;
    let selected = new Set();
    let chosenRank = null;
    let lastSeq = 0;
    let revealKey = '';
    let resultShown = 0;

    callBtn.addEventListener('click', async () => {
      if (!view?.lastPlay) return;
      sfx('bluff');
      await api.act({ type: 'call', seq: view.lastPlay.seq });
    });

    const myTurn = () => view && view.phase === 'playing' && view.turn === api.me;

    function renderControls() {
      const v = view;
      controls.replaceChildren();
      ranks.hidden = true;
      if (!myTurn()) return;
      const starting = v.claimRank === null;
      if (starting) {
        ranks.hidden = false;
        ranks.replaceChildren(h('span.note', {}, 'Claim:'), ...RANKS.map(r => {
          const b = h('button.bluff-rank' + (chosenRank === r ? '.on' : ''), { 'aria-pressed': String(chosenRank === r) }, r);
          b.addEventListener('click', () => { chosenRank = r; sfx('click'); renderControls(); });
          return b;
        }));
      }
      const rank = starting ? chosenRank : v.claimRank;
      const n = selected.size;
      const play = h('button.btn.big.green', { disabled: !n || !rank }, n ? `Play ${n} as ${rank || '?'}${n > 1 ? 's' : ''}` : 'Pick 1–4 cards');
      play.addEventListener('click', async () => {
        sfx('card');
        const res = await api.act({ type: 'play', cards: [...selected], rank });
        if (res.ok) { selected.clear(); chosenRank = null; }
      });
      controls.append(play);
      if (!starting) controls.append(h('button.btn.big.ghost', { on: { click: () => { sfx('click'); api.act({ type: 'pass' }); } } }, 'Pass'));
    }

    function renderHand() {
      const v = view;
      const cards = v.hand;
      for (const id of [...selected]) if (!cards.some(c => c.id === id)) selected.delete(id);
      const spread = Math.min(34, Math.max(16, 520 / Math.max(1, cards.length)));
      hand.style.setProperty('--spread', spread + 'px');
      hand.replaceChildren(...cards.map((c, i) => {
        const el = h('button.bluff-card' + (selected.has(c.id) ? '.up' : ''), { style: { '--i': i, '--n': cards.length }, 'aria-pressed': String(selected.has(c.id)) }, face(c));
        el.addEventListener('click', () => {
          if (!myTurn()) { api.setStatus('Wait for your turn to play cards.', ''); return; }
          if (selected.has(c.id)) selected.delete(c.id);
          else if (selected.size < 4) selected.add(c.id);
          else { sfx('bad'); return; }
          sfx('card');
          renderHand(); renderControls();
        });
        return el;
      }));
    }

    function update(v) {
      const prev = view;
      view = v;
      if (prev && prev.game !== v.game) { selected.clear(); chosenRank = null; sfx('shuffle'); }
      if (!prev) sfx('shuffle');

      // opponents
      opps.replaceChildren(...v.players.filter(p => p.id !== api.me).map(p => {
        const fan = h('div.bluff-fan', {}, ...Array.from({ length: Math.min(p.cards, 8) }, (_, i) => back(`.mini`)));
        fan.style.setProperty('--n', Math.min(p.cards, 8));
        return h('div.bluff-opp' + (v.turn === p.id ? '.turn' : '') + (p.left ? '.left' : ''), { 'data-pid': p.id },
          h('div.ava', { html: avatarSVG(p.avatar) }), h('b', {}, p.name), fan, h('span.chip', {}, `${p.cards} card${p.cards === 1 ? '' : 's'}`));
      }));

      // pile
      const shown = Math.min(v.pileCount, 14);
      pile.replaceChildren(...Array.from({ length: shown }, (_, i) => back(`.pile`)));
      [...pile.children].forEach((c, i) => c.style.setProperty('--r', `${((i * 47) % 30) - 15}deg`));
      if (!v.pileCount) pile.append(h('div.bluff-empty.note', {}, v.discarded ? `${v.discarded} cards thrown away` : 'empty pile'));
      claim.textContent = v.claimRank ? `${v.pileCount} card${v.pileCount === 1 ? '' : 's'} · all "${v.claimRank}"s (supposedly)` : '';
      if (v.lastPlay && v.lastPlay.seq !== lastSeq) {
        lastSeq = v.lastPlay.seq;
        if (prev) { sfx('card'); pile.lastElementChild?.classList.add('land'); }
      }

      const canCall = v.phase === 'playing' && v.lastPlay && v.lastPlay.by !== api.me && v.players.some(p => p.id === api.me && !p.left);
      callBtn.hidden = !canCall;
      callBtn.classList.toggle('urgent', !!canCall && v.pendingWinner === v.lastPlay?.by);

      // reveal
      if (v.reveal) {
        const k = `${v.reveal.caller}-${v.reveal.accused}-${v.reveal.pileSize}-${v.log.length}`;
        reveal.hidden = false;
        if (k !== revealKey) {
          revealKey = k;
          sfx('reveal');
          reveal.replaceChildren(
            h('div.bluff-flip', {}, ...v.reveal.cards.map((c, i) => { const f = face(c, '.flip'); f.style.animationDelay = `${i * 120}ms`; return f; })),
            h('div.bluff-stamp.hand' + (v.reveal.truthful ? '.truth' : '.lie'), {}, v.reveal.truthful ? 'TRUTH' : 'LIE!'));
          setTimeout(() => { sfx(v.reveal?.truthful ? 'bad' : 'good'); burstAt(reveal); }, 500);
        }
      } else { reveal.hidden = true; revealKey = ''; }

      renderHand();
      renderControls();
      log.replaceChildren(...v.log.slice(-5).reverse().map(l => h('li', {}, l.text)));

      api.setPlayers(strip(v, p => ({ score: p.cards, sub: `${v.wins[p.id]} win${v.wins[p.id] === 1 ? '' : 's'} · cards`, active: v.turn === p.id })));

      if (v.phase === 'finished') {
        api.setStatus(v.winner === api.me ? 'You emptied your hand. Bluff master!' : `${nameOf(v, v.winner)} got rid of every card!`, v.winner === api.me ? 'good' : 'bad');
        if (resultShown !== v.game) {
          resultShown = v.game;
          const counts = Object.fromEntries(v.players.map(p => [p.id, -p.cards]));
          setTimeout(() => api.results({
            title: v.winner === api.me ? 'Bluff master!' : `${nameOf(v, v.winner)} wins`,
            sub: 'Fewest cards left = best poker face',
            tone: v.winner === api.me ? 'win' : 'lose',
            board: board(v, counts, (x) => `${-x} left`),
            actions: [{ label: 'Deal again', cls: 'green', fn: () => api.act({ type: 'rematch' }) }]
          }), 1200);
        }
      } else if (v.phase === 'reveal') {
        api.setStatus(`${nameOf(v, v.reveal.caller)} called Bluff on ${nameOf(v, v.reveal.accused)}!`, 'hot');
      } else if (myTurn()) {
        api.setStatus(v.claimRank ? `Your turn: play more "${v.claimRank}"s… or pass.` : 'Your turn: start a pile — pick a rank and cards.', 'hot');
      } else if (canCall && v.pendingWinner === v.lastPlay.by) {
        api.setStatus(`${nameOf(v, v.lastPlay.by)} played their LAST card! Call Bluff now?`, 'hot');
      } else {
        api.setStatus(`${nameOf(v, v.turn)}'s turn${v.lastPlay ? ` — ${nameOf(v, v.lastPlay.by)} claimed ${v.lastPlay.count} × ${v.lastPlay.rank}` : ''}`);
      }
    }

    return { update, destroy() {} };
  }
};
