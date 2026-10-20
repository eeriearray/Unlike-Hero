// Dots & Boxes on squared paper.
import { h } from '../ui.js';
import { sfx } from '../audio.js';
import { strip, nameOf, board, s, wobble } from './common.js';

const GAP = 60, PAD = 20;

export default {
  mount(root, api) {
    const sheet = h('div.dots-sheet.graph');
    root.append(sheet);
    let svg, linesG, boxesG, hits = [];
    let view = null;
    let size = 0;
    let drawnH = [], drawnV = [], filled = [];
    let resultShown = 0;

    function build(n) {
      size = n;
      const W = PAD * 2 + GAP * n;
      svg = s('svg', { viewBox: `0 0 ${W} ${W}`, class: 'dots-svg', 'aria-label': `${n} by ${n} dots and boxes board` });
      boxesG = s('g', {}, svg);
      linesG = s('g', {}, svg);
      const hitG = s('g', {}, svg);
      const dotG = s('g', {}, svg);
      hits = [];
      const addHit = (t, r, c, x1, y1, x2, y2) => {
        const ghost = s('line', { x1, y1, x2, y2, class: 'dots-ghost' }, hitG);
        const hit = s('line', { x1, y1, x2, y2, class: 'dots-hit', tabindex: 0, 'aria-label': `${t === 'h' ? 'Horizontal' : 'Vertical'} line row ${r + 1} column ${c + 1}` }, hitG);
        const go = () => {
          if (!view || view.status !== 'playing' || view.turn !== api.me) return;
          if ((t === 'h' ? view.hLines : view.vLines)[r][c]) return;
          sfx('pencil');
          api.act({ type: 'move', lineType: t, r, c });
        };
        hit.addEventListener('click', go);
        hit.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        hit.addEventListener('pointerenter', () => ghost.classList.add('show'));
        hit.addEventListener('pointerleave', () => ghost.classList.remove('show'));
        hits.push({ t, r, c, hit, ghost });
      };
      for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) addHit('h', r, c, PAD + c * GAP, PAD + r * GAP, PAD + (c + 1) * GAP, PAD + r * GAP);
      for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) addHit('v', r, c, PAD + c * GAP, PAD + r * GAP, PAD + c * GAP, PAD + (r + 1) * GAP);
      for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) s('circle', { cx: PAD + c * GAP, cy: PAD + r * GAP, r: 5.5, class: 'dot' }, dotG);
      sheet.replaceChildren(svg);
      drawnH = Array.from({ length: n + 1 }, () => Array(n).fill(null));
      drawnV = Array.from({ length: n }, () => Array(n + 1).fill(null));
      filled = Array.from({ length: n }, () => Array(n).fill(false));
    }

    const colorOf = (id) => view.players.find(p => p.id === id)?.color || '#1d2b4f';

    function update(v) {
      const prev = view;
      view = v;
      if (!svg || v.size !== size || (prev && prev.round !== v.round)) { build(v.size); if (prev) sfx('eraser'); }
      let fresh = false;
      v.hLines.forEach((row, r) => row.forEach((owner, c) => {
        if (owner && !drawnH[r][c]) {
          drawnH[r][c] = owner;
          const x = PAD + c * GAP, y = PAD + r * GAP;
          s('path', { d: wobble(x + 3, y, x + GAP - 3, y, 2, r * 7 + c), stroke: colorOf(owner), class: 'dots-line' + (prev ? ' new' : ''), pathLength: 1 }, linesG);
          fresh = true;
        }
      }));
      v.vLines.forEach((row, r) => row.forEach((owner, c) => {
        if (owner && !drawnV[r][c]) {
          drawnV[r][c] = owner;
          const x = PAD + c * GAP, y = PAD + r * GAP;
          s('path', { d: wobble(x, y + 3, x, y + GAP - 3, 2, r * 5 + c * 3), stroke: colorOf(owner), class: 'dots-line' + (prev ? ' new' : ''), pathLength: 1 }, linesG);
          fresh = true;
        }
      }));
      let boxed = false;
      v.boxes.forEach((row, r) => row.forEach((b, c) => {
        if (b && !filled[r][c]) {
          filled[r][c] = true;
          const g = s('g', { class: 'dots-box' + (prev ? ' new' : '') }, boxesG);
          const x = PAD + c * GAP, y = PAD + r * GAP;
          s('rect', { x: x + 4, y: y + 4, width: GAP - 8, height: GAP - 8, fill: b.color, opacity: .22, rx: 3 }, g);
          s('path', { d: `M${x + 10} ${y + GAP - 12}l${GAP - 22} ${-(GAP - 22)}M${x + 10} ${y + GAP / 2}l${GAP / 2 - 10} ${-(GAP / 2 - 10)}M${x + GAP / 2} ${y + GAP - 12}l${GAP / 2 - 12} ${-(GAP / 2 - 12)}`, stroke: b.color, 'stroke-width': 2, opacity: .35 }, g);
          const t = s('text', { x: x + GAP / 2, y: y + GAP / 2 + 11, 'text-anchor': 'middle', class: 'dots-initial', fill: b.color }, g);
          t.textContent = b.initial;
          boxed = true;
        }
      }));
      if (prev && boxed) sfx('fill');
      else if (prev && fresh && v.lastLine?.by !== api.me) sfx('pencil');

      const myTurn = v.status === 'playing' && v.turn === api.me;
      svg.classList.toggle('my-turn', myTurn);
      for (const x of hits) {
        const taken = (x.t === 'h' ? v.hLines : v.vLines)[x.r][x.c];
        x.hit.style.display = taken ? 'none' : '';
        x.ghost.setAttribute('stroke', v.myColor || '#1d2b4f');
      }
      api.setPlayers(strip(v, p => ({ score: v.scores[p.id], sub: `${v.wins[p.id]} win${v.wins[p.id] === 1 ? '' : 's'}`, active: v.status === 'playing' && v.turn === p.id, color: p.color })));

      if (v.status === 'playing') {
        const extra = v.lastClaimedBoxes?.length && v.lastLine?.by === v.turn;
        api.setStatus(myTurn ? (extra ? 'Box! Draw again.' : 'Your turn — join two dots') : `${nameOf(v, v.turn)}'s turn${extra ? ' (bonus line)' : ''}`, myTurn ? 'hot' : '');
      } else if (resultShown !== v.round) {
        resultShown = v.round;
        const won = v.winner === api.me;
        api.setStatus(v.status === 'draw' ? 'All boxes taken — a draw!' : won ? 'You took the most boxes!' : `${nameOf(v, v.winner)} took the most boxes.`, won ? 'good' : '');
        setTimeout(() => api.results({
          title: v.status === 'draw' ? 'It\'s a draw!' : won ? 'Box champion!' : `${nameOf(v, v.winner)} wins`,
          tone: v.status === 'draw' ? 'draw' : won ? 'win' : 'lose',
          board: board(v, v.scores),
          actions: [3, 4, 5].map(n => ({ label: `Rematch ${n}×${n}`, cls: n === v.size ? 'green' : '', fn: () => api.act({ type: 'rematch', size: n }) }))
        }), 700);
      }
    }

    return { update, destroy() {} };
  }
};
