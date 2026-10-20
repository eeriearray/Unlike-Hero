// Snakes & Ladders, drawn on a notebook page.
import { h, wait, burstAt } from '../ui.js';
import { sfx } from '../audio.js';
import { strip, nameOf, s, dieFace } from './common.js';

const INK = '#1d2b4f';
const TILE = ['#fff8e1', '#e3f2fd', '#fce4ec', '#e8f5e9', '#fff3e0'];

export function cell(n) {
  const row = Math.floor((n - 1) / 10);
  const col = row % 2 === 0 ? (n - 1) % 10 : 9 - ((n - 1) % 10);
  return { x: col * 10 + 5, y: (9 - row) * 10 + 5 };
}

function snakePath(head, tail) {
  const a = cell(head), b = cell(tail);
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  const w = Math.min(7, len / 4);
  return `M${a.x} ${a.y}C${a.x + dx * .25 + nx * w} ${a.y + dy * .25 + ny * w} ${a.x + dx * .5 - nx * w} ${a.y + dy * .5 - ny * w} ${a.x + dx * .62} ${a.y + dy * .62}S${b.x - nx * w * .6} ${b.y - ny * w * .6} ${b.x} ${b.y}`;
}

export default {
  mount(root, api) {
    const wrap = h('div.snl-wrap');
    const svg = s('svg', { viewBox: '-2 -2 104 113', class: 'snl-board', 'aria-label': 'Snakes and ladders board' });
    const dieBtn = h('button.snl-die', { 'aria-label': 'Roll the die' });
    const side = h('div.snl-side', {}, dieBtn, h('div.snl-hint.note'));
    wrap.append(h('div.snl-paper.paper-plain', {}, svg), side);
    root.append(wrap);

    let view = null;
    let built = false;
    let tokens = new Map();     // pid -> svg group
    let shown = {};             // pid -> square currently drawn
    let snakePaths = {};
    let lastSeq = 0;
    let busy = Promise.resolve();
    let resultShown = 0;

    function build(v) {
      built = true;
      const tiles = s('g', {}, svg);
      for (let n = 1; n <= 100; n++) {
        const { x, y } = cell(n);
        s('rect', { x: x - 5, y: y - 5, width: 10, height: 10, fill: TILE[(n * 7) % TILE.length], stroke: 'rgba(29,43,79,.25)', 'stroke-width': .25 }, tiles);
        const t = s('text', { x: x - 4, y: y - 1.6, class: 'snl-num' }, tiles);
        t.textContent = n;
      }
      const st = s('text', { x: 1, y: 108, class: 'snl-start' }, tiles);
      st.textContent = 'Start →';
      const home = cell(100);
      s('path', { d: `M${home.x} ${home.y - 3.4}l1 2.2 2.4.3-1.8 1.6.5 2.4-2.1-1.2-2.1 1.2.5-2.4-1.8-1.6 2.4-.3z`, fill: '#ffd34d', stroke: INK, 'stroke-width': .4 }, tiles);
      const ladders = s('g', { class: 'snl-ladders' }, svg);
      for (const [from, to] of Object.entries(v.ladders)) {
        const a = cell(Number(from)), b = cell(to);
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        const nx = -dy / len * 1.6, ny = dx / len * 1.6;
        s('path', { d: `M${a.x + nx} ${a.y + ny}L${b.x + nx} ${b.y + ny}M${a.x - nx} ${a.y - ny}L${b.x - nx} ${b.y - ny}`, class: 'snl-rail' }, ladders);
        const rungs = Math.max(2, Math.floor(len / 3.2));
        let d = '';
        for (let i = 1; i < rungs; i++) {
          const t = i / rungs;
          d += `M${a.x + dx * t + nx} ${a.y + dy * t + ny}L${a.x + dx * t - nx} ${a.y + dy * t - ny}`;
        }
        s('path', { d, class: 'snl-rung' }, ladders);
      }
      const snakes = s('g', { class: 'snl-snakes' }, svg);
      const greens = ['#2e9e48', '#8e24aa', '#e53935', '#f57c00', '#1e6fe0', '#00897b', '#c2185b', '#6d4c41'];
      Object.entries(v.snakes).forEach(([head, tail], i) => {
        const d = snakePath(Number(head), tail);
        const c = greens[i % greens.length];
        const body = s('path', { d, class: 'snl-snake', stroke: c }, snakes);
        s('path', { d, class: 'snl-snake-pattern' }, snakes);
        snakePaths[head] = body;
        const hd = cell(Number(head));
        s('ellipse', { cx: hd.x, cy: hd.y, rx: 2.6, ry: 2.1, fill: c, stroke: INK, 'stroke-width': .5 }, snakes);
        s('circle', { cx: hd.x - .9, cy: hd.y - .5, r: .55, fill: '#fff' }, snakes);
        s('circle', { cx: hd.x + .9, cy: hd.y - .5, r: .55, fill: '#fff' }, snakes);
        s('path', { d: `M${hd.x} ${hd.y + 1.8}l0 1.4m0 0l-.6 .7m.6-.7l.6 .7`, stroke: '#e53935', 'stroke-width': .35, fill: 'none' }, snakes);
      });
      const tokG = s('g', {}, svg);
      v.players.forEach((p, i) => {
        const outer = s('g', {}, tokG);
        const g = s('g', { class: 'snl-token' }, outer);
        s('ellipse', { cx: 0, cy: 2.6, rx: 2.3, ry: .8, fill: 'rgba(0,0,0,.25)' }, g);
        s('path', { d: 'M-2 2.2C-2 -.5-1.2-1.5 0-1.5S2-.5 2 2.2z', fill: p.color, stroke: INK, 'stroke-width': .45 }, g);
        s('circle', { cx: 0, cy: -2.3, r: 1.5, fill: p.color, stroke: INK, 'stroke-width': .45 }, g);
        s('circle', { cx: -.5, cy: -2.8, r: .45, fill: 'rgba(255,255,255,.7)' }, g);
        tokens.set(p.id, outer);
        shown[p.id] = v.pos[p.id];
        place(p.id, v.pos[p.id], i);
      });
    }

    function offsetFor(pid, n) {
      const same = view.players.filter(p => shown[p.id] === n);
      const k = same.findIndex(p => p.id === pid);
      if (same.length < 2) return [0, 0];
      return [[-2, -1.5], [2, -1.5], [-2, 1.8], [2, 1.8]][k % 4];
    }

    function place(pid, n, seat) {
      const g = tokens.get(pid);
      if (!g) return;
      let x, y;
      if (n === 0) { x = 14 + (seat ?? view.players.findIndex(p => p.id === pid)) * 7; y = 106.5; }
      else { ({ x, y } = cell(n)); const [ox, oy] = offsetFor(pid, n); x += ox; y += oy; }
      g.setAttribute('transform', `translate(${x} ${y})`);
    }

    function relayout() { view.players.forEach((p, i) => place(p.id, shown[p.id], i)); }

    async function animateMove(last) {
      const fast = document.body.classList.contains('calm');
      const pid = last.by;
      // roll animation
      dieBtn.classList.add('rolling');
      sfx('dice');
      for (let i = 0; i < (fast ? 1 : 7); i++) { dieBtn.innerHTML = dieFace(1 + Math.floor(Math.random() * 6), 64); await wait(60); }
      dieBtn.innerHTML = dieFace(last.roll, 64);
      dieBtn.classList.remove('rolling');
      await wait(fast ? 0 : 200);
      if (last.via === 'bounce') { api.setStatus(`${nameOf(view, pid)} needs exactly ${100 - last.from} — stays put.`); return; }
      for (let n = last.from + 1; n <= last.landed; n++) {
        shown[pid] = n; relayout(); sfx('step');
        tokens.get(pid)?.firstChild.classList.add('hop');
        await wait(fast ? 0 : 150);
        tokens.get(pid)?.firstChild.classList.remove('hop');
      }
      if (last.via === 'ladder') {
        sfx('climb');
        const a = cell(last.landed), b = cell(last.to);
        await glide(pid, (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }), 700);
        burstAt(tokens.get(pid));
      } else if (last.via === 'snake') {
        sfx('slide');
        const path = snakePaths[last.landed];
        const L = path.getTotalLength();
        tokens.get(pid)?.firstChild.classList.add('dizzy');
        await glide(pid, (t) => path.getPointAtLength(L * t), 1000);
        tokens.get(pid)?.firstChild.classList.remove('dizzy');
      }
      shown[pid] = last.to;
      relayout();
    }

    function glide(pid, at, ms) {
      if (document.body.classList.contains('calm') || document.hidden) return Promise.resolve();
      const g = tokens.get(pid);
      return new Promise(res => {
        const t0 = performance.now();
        const guard = setTimeout(res, ms + 300); // animation frames pause in background tabs
        const step = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const p = at(e);
          g.setAttribute('transform', `translate(${p.x} ${p.y})`);
          if (t < 1) requestAnimationFrame(step); else { clearTimeout(guard); res(); }
        };
        requestAnimationFrame(step);
      });
    }

    dieBtn.addEventListener('click', async () => {
      if (!view || view.status !== 'playing' || view.turn !== api.me || dieBtn.disabled) return;
      dieBtn.disabled = true;
      const res = await api.act({ type: 'roll' });
      if (!res.ok) dieBtn.disabled = false;
    });

    function renderStatus(v) {
      const mine = v.turn === api.me;
      dieBtn.disabled = !(v.status === 'playing' && mine);
      dieBtn.classList.toggle('ready', v.status === 'playing' && mine);
      side.querySelector('.snl-hint').textContent = v.status === 'playing' ? (mine ? 'Tap the die to roll' : `${nameOf(v, v.turn)} rolls next`) : '';
      api.setPlayers(strip(v, p => ({ score: v.pos[p.id] || '–', sub: `${v.wins[p.id]} win${v.wins[p.id] === 1 ? '' : 's'}`, active: v.status === 'playing' && v.turn === p.id, color: p.color })));
      if (v.status === 'playing') {
        const l = v.last;
        const what = l ? (l.via === 'ladder' ? `climbed a ladder to ${l.to}!` : l.via === 'snake' ? `got bitten and slid to ${l.to}!` : l.via === 'bounce' ? 'overshot and stays put.' : `rolled ${l.roll}.`) : '';
        api.setStatus(mine ? `${l && l.by === api.me && l.again ? 'Six! Roll again!' : 'Your turn — roll!'}` : `${l ? `${nameOf(v, l.by)} ${what} ` : ''}${nameOf(v, v.turn)}'s turn.`, mine ? 'hot' : l?.via === 'snake' ? 'bad' : l?.via === 'ladder' ? 'good' : '');
      } else if (resultShown !== JSON.stringify(v.wins)) {
        resultShown = JSON.stringify(v.wins);
        const won = v.winner === api.me;
        api.setStatus(won ? 'You reached 100!' : `${nameOf(v, v.winner)} reached 100!`, won ? 'good' : 'bad');
        setTimeout(() => api.results({
          title: won ? 'Top of the board!' : `${nameOf(v, v.winner)} wins`,
          tone: won ? 'win' : 'lose',
          board: v.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, pts: v.pos[p.id], raw: v.pos[p.id], win: p.id === v.winner })).sort((a, b) => b.raw - a.raw),
          actions: [{ label: 'Play again', cls: 'green', fn: () => api.act({ type: 'rematch' }) }]
        }), 600);
      }
    }

    function update(v) {
      const prev = view;
      view = v;
      if (!built) { build(v); dieBtn.innerHTML = dieFace(v.last?.roll || 1, 64); lastSeq = v.last?.seq || 0; renderStatus(v); return; }
      if (prev && prev.status === 'finished' && v.status === 'playing') {
        for (const p of v.players) shown[p.id] = v.pos[p.id];
        relayout(); lastSeq = v.last?.seq || 0;
      }
      const last = v.last;
      if (last && last.seq !== lastSeq) {
        lastSeq = last.seq;
        dieBtn.disabled = true;
        busy = busy.then(() => animateMove(last)).then(() => renderStatus(view));
      } else {
        busy = busy.then(() => renderStatus(view));
      }
    }

    return { update, destroy() {} };
  }
};
