// Tic-Tac-Toe on the back page of a rough notebook.
import { h } from '../ui.js';
import { sfx } from '../audio.js';
import { strip, nameOf, s, wobble } from './common.js';

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const center = (i) => [50 + (i % 3) * 100, 50 + Math.floor(i / 3) * 100];

export default {
  mount(root, api) {
    const wrap = h('div.ttt-sheet.graph');
    const svg = s('svg', { viewBox: '-10 -10 320 320', class: 'ttt-svg', role: 'grid', 'aria-label': 'Tic-tac-toe board' });
    const gridG = s('g', { class: 'ttt-grid' }, svg);
    [[100, 4, 102, 296], [200, 6, 198, 294], [4, 100, 296, 103], [6, 200, 294, 198]].forEach(([a, b, c, d], i) =>
      s('path', { d: wobble(a, b, c, d, 3, i + 1), class: 'pencil-line', style: `animation-delay:${i * 90}ms` }, gridG));
    const marks = s('g', {}, svg);
    const winG = s('g', {}, svg);
    const cells = [];
    for (let i = 0; i < 9; i++) {
      const [x, y] = center(i);
      const r = s('rect', { x: x - 48, y: y - 48, width: 96, height: 96, class: 'ttt-cell', tabindex: 0, role: 'gridcell', 'aria-label': `Square ${i + 1}` }, svg);
      r.addEventListener('click', () => play(i));
      r.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(i); } });
      cells.push(r);
    }
    const tally = h('div.tally.note');
    const again = h('button.btn.big.green', { hidden: true }, 'Rematch');
    again.addEventListener('click', () => { sfx('eraser'); api.act({ type: 'rematch' }); });
    wrap.append(svg);
    root.append(wrap, tally, again);

    let view = null;
    let drawn = Array(9).fill(null);
    let shownResultRound = 0;

    function play(i) {
      if (!view || view.status !== 'playing' || view.turn !== api.me || view.board[i]) return;
      sfx('pencil');
      api.act({ type: 'move', cell: i });
    }

    function drawMark(i, sym) {
      const [x, y] = center(i);
      const g = s('g', { class: `mark ${sym === 'X' ? 'x' : 'o'}` }, marks);
      if (sym === 'X') {
        s('path', { d: `M${x - 28} ${y - 30}L${x + 27} ${y + 29}`, pathLength: 1 }, g);
        s('path', { d: `M${x + 29} ${y - 28}L${x - 27} ${y + 30}`, pathLength: 1, style: 'animation-delay:.14s' }, g);
      } else {
        s('path', { d: `M${x + 2} ${y - 31}C${x + 40} ${y - 30} ${x + 38} ${y + 32} ${x} ${y + 31}C${x - 36} ${y + 30} ${x - 37} ${y - 28} ${x + 6} ${y - 30}`, pathLength: 1 }, g);
      }
      sfx('pencil');
    }

    function update(v) {
      const prev = view;
      view = v;
      if (prev && prev.round !== v.round) { marks.replaceChildren(); winG.replaceChildren(); drawn = Array(9).fill(null); sfx('eraser'); }
      v.board.forEach((sym, i) => { if (sym && drawn[i] !== sym) { drawMark(i, sym); drawn[i] = sym; } });
      cells.forEach((c, i) => c.classList.toggle('open', v.status === 'playing' && v.turn === api.me && !v.board[i]));

      api.setPlayers(strip(v, p => ({ score: v.scores[p.id] ?? 0, sub: `plays ${p.symbol}`, active: v.status === 'playing' && v.turn === p.id, color: p.symbol === 'X' ? '#e0453a' : '#2463d6' })));
      tally.textContent = `Round ${v.round} · draws: ${v.scores.ties || 0}`;
      again.hidden = v.status === 'playing';

      if (v.status === 'playing') {
        api.setStatus(v.turn === api.me ? `Your turn — draw an ${v.mySymbol}` : `${nameOf(v, v.turn)} is thinking…`, v.turn === api.me ? 'hot' : '');
      } else if (shownResultRound !== v.round) {
        shownResultRound = v.round;
        if (v.status === 'won') {
          const [a, , c] = v.winningLine;
          const [x1, y1] = center(a), [x2, y2] = center(c);
          const dx = (x2 - x1) * 0.18, dy = (y2 - y1) * 0.18;
          s('path', { d: wobble(x1 - dx, y1 - dy, x2 + dx, y2 + dy, 4, v.round), class: 'win-line', pathLength: 1 }, winG);
          const mine = v.winner === api.me;
          api.setStatus(mine ? 'Three in a row! You win this round.' : `${nameOf(v, v.winner)} got three in a row.`, mine ? 'good' : 'bad');
          setTimeout(() => sfx(mine ? 'win' : 'lose'), 450);
        } else {
          api.setStatus('Cat\'s game — it\'s a draw.', '');
          sfx('draw');
        }
      }
    }

    return { update, destroy() {} };
  }
};
