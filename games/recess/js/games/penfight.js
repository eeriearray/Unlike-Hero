// Pen Fight: flick your pen, knock theirs off the desk.
import { h, starBurst } from '../ui.js';
import { sfx } from '../audio.js';
import { strip, nameOf, board, s, replay, pullAim } from './common.js';

const INK = '#1d2b4f';
const STYLE = {
  'gel-blue': { body: '#2463d6', cap: '#1a3f8f', tip: '#cfd8dc', name: 'blue gel pen' },
  'ink-red': { body: '#e0453a', cap: '#9c2a22', tip: '#ffe0b2', name: 'red ink pen' },
  'pencil': { body: '#ffc83d', cap: '#ff8fab', tip: '#f2d2a9', name: 'pencil' },
  'marker-green': { body: '#2e9e48', cap: '#1b5e20', tip: '#e8f5e9', name: 'green marker' }
};

function drawPen(g, style, len, r) {
  const st = STYLE[style] || STYLE['gel-blue'];
  const L = len / 2;
  g.innerHTML = `
    <ellipse cx="1.2" cy="1.6" rx="${L}" ry="${r * 1.1}" fill="rgba(0,0,0,.18)"/>
    <rect x="${-L + 3}" y="${-r}" width="${len - 7}" height="${r * 2}" rx="${r}" fill="${st.body}" stroke="${INK}" stroke-width=".7"/>
    <path d="M${L - 4} ${-r}L${L} 0L${L - 4} ${r}z" fill="${st.tip}" stroke="${INK}" stroke-width=".7" stroke-linejoin="round"/>
    <rect x="${-L}" y="${-r * 1.08}" width="${len * .32}" height="${r * 2.16}" rx="${r * .6}" fill="${st.cap}" stroke="${INK}" stroke-width=".7"/>
    <rect x="${-L + 2}" y="${-r * 1.6}" width="${len * .26}" height="${r * .55}" rx=".3" fill="#b0bec5" stroke="${INK}" stroke-width=".5"/>
    <rect x="${-L + 4}" y="${-r * .55}" width="${len - 12}" height="${r * .45}" rx=".3" fill="rgba(255,255,255,.35)"/>`;
}

export default {
  mount(root, api) {
    const desk = h('div.pf-desk');
    const svg = s('svg', { viewBox: '-10 -10 120 160', class: 'pf-svg', 'aria-label': 'Desk with two pens' });
    desk.append(svg);
    const power = h('div.pf-power', { hidden: true }, h('i'));
    const controls = h('div.pf-controls');
    root.append(desk, power, controls);

    s('rect', { x: -10, y: -10, width: 120, height: 160, class: 'pf-wood' }, svg);
    s('rect', { x: 0, y: 0, width: 100, height: 140, class: 'pf-paper' }, svg);
    const lines = s('g', { class: 'pf-lines' }, svg);
    for (let y = 10; y < 140; y += 7) s('line', { x1: 0, y1: y, x2: 100, y2: y }, lines);
    s('line', { x1: 12, y1: 0, x2: 12, y2: 140, class: 'pf-margin' }, svg);
    const doodle = s('text', { x: 60, y: 132, class: 'pf-doodle' }, svg);
    doodle.textContent = 'last bench rules';
    const pensG = s('g', {}, svg);
    const aimG = s('g', { class: 'pf-aim' }, svg);
    const fx = s('g', {}, svg);

    let view = null;
    const penEls = new Map(); // id -> { outer, inner }
    let lastShot = 0;
    let replaying = null;
    let roundKey = '';
    let resultKey = '';

    function ensurePens(v) {
      for (const p of v.pens) {
        if (penEls.has(p.id)) continue;
        const outer = s('g', {}, pensG);
        const inner = s('g', { class: 'pf-pen' }, outer);
        drawPen(inner, v.players.find(x => x.id === p.id)?.style, p.len, p.r);
        penEls.set(p.id, { outer, inner });
      }
    }

    function placePen(id, x, y, a, gone) {
      const el = penEls.get(id);
      if (!el) return;
      el.outer.setAttribute('transform', `translate(${x} ${y}) rotate(${a * 180 / Math.PI})`);
      el.inner.classList.toggle('fallen', !!gone);
    }

    function showStatic(v) {
      for (const p of v.pens) placePen(p.id, p.x, p.y, p.a, p.gone);
    }

    // aiming
    const myPen = () => view?.pens.find(p => p.id === api.me);
    let grab = 0;
    pullAim(svg, {
      grabRadius: 6,
      maxPull: 34,
      origin: (e) => {
        if (!view || view.phase !== 'aim' || view.turn !== api.me || replaying) return null;
        const p = myPen();
        if (!p) return null;
        const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
        const q = pt.matrixTransform(svg.getScreenCTM().inverse());
        const ax = Math.cos(p.a), ay = Math.sin(p.a);
        const t = Math.max(-p.len / 2, Math.min(p.len / 2, (q.x - p.x) * ax + (q.y - p.y) * ay));
        grab = t / (p.len / 2);
        return { x: p.x + ax * t, y: p.y + ay * t };
      },
      onAim: ({ dx, dy, power: pw }) => {
        aimG.replaceChildren();
        const p = myPen();
        const ox = p.x + Math.cos(p.a) * grab * p.len / 2, oy = p.y + Math.sin(p.a) * grab * p.len / 2;
        s('line', { x1: ox - dx * .6, y1: oy - dy * .6, x2: ox, y2: oy, class: 'pf-pull' }, aimG);
        s('line', { x1: ox, y1: oy, x2: ox + dx * 1.4, y2: oy + dy * 1.4, class: 'pf-arrow', 'marker-end': 'url(#pfhead)' }, aimG);
        s('circle', { cx: ox, cy: oy, r: 1.6, class: 'pf-grab' }, aimG);
        power.hidden = false;
        power.firstChild.style.width = `${Math.round(pw * 100)}%`;
        power.classList.toggle('max', pw > .95);
      },
      onCancel: () => { aimG.replaceChildren(); power.hidden = true; },
      onShoot: async ({ dx, dy, power: pw }) => {
        aimG.replaceChildren(); power.hidden = true;
        const len = Math.hypot(dx, dy) || 1;
        const J = pw * view.maxImpulse;
        sfx('flick');
        await api.act({ type: 'flick', grab, jx: dx / len * J, jy: dy / len * J });
      }
    });
    const defs = s('defs', {}, svg);
    defs.innerHTML = `<marker id="pfhead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${'#e0453a'}"/></marker>`;

    function playShot(v) {
      const shot = v.shot;
      const ids = v.pens.map(p => p.id);
      const events = [...shot.events];
      let fallen = new Set();
      replaying = replay(shot.frames, (fa, fb, t, i) => {
        while (events.length && events[0].f <= i) {
          const ev = events.shift();
          if (ev.type === 'hit') {
            sfx('clack', { v: ev.v });
            const pa = fa[0], pb = fa[1];
            const r = svg.getBoundingClientRect();
            const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
            if (ev.v > 25) starBurst(r.left + (mx + 10) / 120 * r.width, r.top + (my + 10) / 160 * r.height, 6);
          }
        }
        ids.forEach((id, k) => {
          const A = fa[k], B = fb[k];
          if (!A) return;
          let da = B[2] - A[2];
          const x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t, a = A[2] + da * t;
          placePen(id, x, y, a, A[3]);
          if (A[3] && !fallen.has(id)) { fallen.add(id); sfx('fall'); }
        });
      }, () => {
        replaying = null;
        api.act({ type: 'shot-done', seq: shot.seq }, { quiet: true });
        showStatic(view);
        render(view);
      });
    }

    function render(v) {
      const mine = v.turn === api.me;
      svg.classList.toggle('can-aim', v.phase === 'aim' && mine && !replaying);
      const rw = v.roundWins;
      api.setPlayers(strip(v, p => ({ score: rw[p.id], sub: STYLE[p.style]?.name, active: v.phase === 'aim' && v.turn === p.id })));
      controls.replaceChildren();
      if (replaying) { api.setStatus('Whoosh…'); return; }
      if (v.phase === 'aim') {
        api.setStatus(mine ? 'Your flick! Drag back from your pen and let go.' : `${nameOf(v, v.turn)} is lining up a flick…`, mine ? 'hot' : '');
      } else if (v.phase === 'round-over') {
        const rr = v.roundResult;
        const won = rr.winner === api.me;
        const why = rr.reason === 'self' ? `${nameOf(v, v.players.find(p => p.id !== rr.winner).id)} flicked their own pen off!` : rr.reason === 'both' ? 'Both pens fell — the flicker loses!' : `${nameOf(v, rr.winner)} knocked the other pen off!`;
        api.setStatus(`${why} Round to ${won ? 'you' : nameOf(v, rr.winner)}.`, won ? 'good' : 'bad');
        if (roundKey !== `${v.round}`) { roundKey = `${v.round}`; sfx(won ? 'good' : 'bad'); }
        controls.append(h('button.btn.big.green', { on: { click: () => { sfx('click'); api.act({ type: 'next-round' }); } } }, `Next round (first to ${v.roundsToWin})`));
      } else if (v.phase === 'finished') {
        const won = v.winner === api.me;
        api.setStatus(won ? 'Desk champion!' : `${nameOf(v, v.winner)} rules the desk.`, won ? 'good' : 'bad');
        const key = JSON.stringify(v.wins);
        if (key !== resultKey) {
          resultKey = key;
          setTimeout(() => api.results({
            title: won ? 'Pen Fight champion!' : `${nameOf(v, v.winner)} wins`,
            sub: `First to ${v.roundsToWin} rounds`,
            tone: won ? 'win' : 'lose',
            board: board(v, rw),
            actions: [{ label: 'Rematch', cls: 'green', fn: () => api.act({ type: 'rematch' }) }]
          }), 600);
        }
      }
    }

    function update(v) {
      const prev = view;
      view = v;
      ensurePens(v);
      if (v.shot && v.shot.seq !== lastShot) {
        lastShot = v.shot.seq;
        if (prev) { // a fresh shot: replay it (on first load we just show where things ended up)
          if (replaying) replaying();
          playShot(v);
          render(v);
          return;
        }
      }
      if (!replaying) showStatic(v);
      render(v);
    }

    return { update, destroy() { if (replaying) replaying(); } };
  }
};
