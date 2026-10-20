// Marble Knockout (kancha) in a chalk ring on the playground dirt.
import { h, starBurst } from '../ui.js';
import { sfx } from '../audio.js';
import { strip, nameOf, board, s, replay, pullAim } from './common.js';

const INK = '#1d2b4f';
const DESIGN = {
  tiger: ['#ffb74d', '#e65100'],
  galaxy: ['#b39ddb', '#4527a0'],
  ocean: ['#80deea', '#00838f'],
  cherry: ['#ef9a9a', '#c62828']
};
const TARGET = [['#fff59d', '#f9a825'], ['#a5d6a7', '#2e7d32'], ['#90caf9', '#1565c0'], ['#f48fb1', '#ad1457']];

export default {
  mount(root, api) {
    const yard = h('div.mb-yard');
    const svg = s('svg', { viewBox: '0 0 100 100', class: 'mb-svg', 'aria-label': 'Chalk ring with marbles' });
    yard.append(svg);
    const power = h('div.pf-power', { hidden: true }, h('i'));
    root.append(yard, power);

    const defs = s('defs', {}, svg);
    let gradHTML = '';
    for (const [k, [a, b]] of Object.entries(DESIGN)) gradHTML += `<radialGradient id="mb-${k}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
    TARGET.forEach(([a, b], i) => { gradHTML += `<radialGradient id="mb-t${i}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`; });
    gradHTML += `<filter id="mb-grain"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .22  0 0 0 0 .1  0 0 0 .35 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>`;
    defs.innerHTML = gradHTML;
    s('rect', { x: 0, y: 0, width: 100, height: 100, fill: '#c9a07a' }, svg);
    s('rect', { x: 0, y: 0, width: 100, height: 100, fill: '#000', filter: 'url(#mb-grain)', opacity: .9 }, svg);
    s('circle', { cx: 50, cy: 50, r: 40, class: 'mb-ring' }, svg);
    s('circle', { cx: 50, cy: 50, r: 2.5, class: 'mb-mid' }, svg);
    const bodyG = s('g', {}, svg);
    const aimG = s('g', {}, svg);

    let view = null;
    const els = new Map();
    let lastShot = 0;
    let replaying = null;
    let resultKey = '';

    function marble(b, v) {
      const g = s('g', { class: 'mb-marble' + (b.kind === 'shooter' ? ' shooter' : '') });
      s('circle', { cx: .5, cy: .7, r: b.r, fill: 'rgba(0,0,0,.28)' }, g);
      const fill = b.kind === 'shooter' ? `url(#mb-${v.players.find(p => p.id === b.id)?.design || 'tiger'})` : `url(#mb-t${b.colour ?? 0})`;
      s('circle', { r: b.r, fill, stroke: INK, 'stroke-width': .35 }, g);
      s('path', { d: `M${-b.r * .55} ${b.r * .1}q${b.r * .5} ${-b.r * .7} ${b.r * 1.1} ${-b.r * .2}`, stroke: 'rgba(255,255,255,.55)', 'stroke-width': .35, fill: 'none' }, g);
      if (b.kind === 'shooter') {
        const isMe = b.id === api.me;
        const t = s('text', { y: -b.r - 1.2, class: 'mb-tag' + (isMe ? ' me' : '') }, g);
        t.textContent = isMe ? 'you' : (v.players.find(p => p.id === b.id)?.name || '');
      }
      bodyG.append(g);
      return g;
    }

    function syncStatic(v) {
      const live = new Set(v.bodies.map(b => b.id));
      for (const [id, g] of els) if (!live.has(id)) { g.remove(); els.delete(id); }
      for (const b of v.bodies) {
        if (!els.has(b.id)) els.set(b.id, marble(b, v));
        const g = els.get(b.id);
        g.setAttribute('transform', `translate(${b.x} ${b.y})`);
        g.classList.remove('gone');
      }
    }

    const me = () => view?.bodies.find(b => b.id === api.me);
    pullAim(svg, {
      grabRadius: 9,
      maxPull: 26,
      origin: () => (view && view.phase === 'aim' && view.turn === api.me && !replaying ? me() : null),
      onAim: ({ dx, dy, power: pw }) => {
        const m = me();
        aimG.replaceChildren();
        const len = Math.hypot(dx, dy) || 1;
        const reach = 5 + pw * pw * 40; // roll distance grows with the square of the speed
        s('line', { x1: m.x, y1: m.y, x2: m.x - dx * .8, y2: m.y - dy * .8, class: 'mb-pull' }, aimG);
        s('line', { x1: m.x, y1: m.y, x2: m.x + dx / len * reach, y2: m.y + dy / len * reach, class: 'mb-traj' }, aimG);
        power.hidden = false;
        power.firstChild.style.width = `${Math.round(pw * 100)}%`;
      },
      onCancel: () => { aimG.replaceChildren(); power.hidden = true; },
      onShoot: async ({ dx, dy, power: pw }) => {
        aimG.replaceChildren(); power.hidden = true;
        const len = Math.hypot(dx, dy) || 1;
        sfx('flick');
        await api.act({ type: 'shoot', vx: dx / len * pw * view.maxSpeed, vy: dy / len * pw * view.maxSpeed });
      }
    });

    function playShot(v) {
      const shot = v.shot;
      for (const [i, id] of shot.ids.entries()) {
        if (!els.has(id)) {
          const start = shot.frames[0][i];
          if (start) els.set(id, marble({ id, kind: id.startsWith('t') ? 'target' : 'shooter', r: id.startsWith('t') ? 1.9 : 2.6, colour: Number(id.slice(1)) % 4 }, v));
        }
      }
      const events = [...shot.events];
      const rect = () => svg.getBoundingClientRect();
      replaying = replay(shot.frames, (fa, fb, t, i) => {
        while (events.length && events[0].f <= i) {
          const ev = events.shift();
          if (ev.type === 'hit') sfx('clack', { v: ev.v });
          if (ev.type === 'out') {
            sfx('whoosh');
            const k = shot.ids.indexOf(ev.a);
            const p = fa[k] || fb[k];
            if (p) { const r = rect(); starBurst(r.left + p[0] / 100 * r.width, r.top + p[1] / 100 * r.height, 7); }
          }
        }
        shot.ids.forEach((id, k) => {
          const g = els.get(id);
          if (!g) return;
          const A = fa[k], B = fb[k];
          if (!A) { g.classList.add('gone'); return; }
          const x = A[0] + ((B || A)[0] - A[0]) * t, y = A[1] + ((B || A)[1] - A[1]) * t;
          g.setAttribute('transform', `translate(${x} ${y})`);
        });
      }, () => {
        replaying = null;
        api.act({ type: 'shot-done', seq: shot.seq }, { quiet: true });
        syncStatic(view);
        render(view, shot);
      });
    }

    function render(v, justShot) {
      const mine = v.turn === api.me;
      svg.classList.toggle('can-aim', v.phase === 'aim' && mine && !replaying);
      els.forEach((g, id) => g.classList.toggle('ready', id === api.me && v.phase === 'aim' && mine && !replaying));
      api.setPlayers(strip(v, p => ({ score: v.scores[p.id], sub: `${p.design} shooter`, active: v.phase === 'aim' && v.turn === p.id })));
      if (replaying) { api.setStatus('Rolling…'); return; }
      if (justShot?.notes?.length) {
        const n = justShot.notes.map(x => x.points > 0 ? `+${x.points}` : `${x.points}`).join(' ');
        sfx(justShot.notes.some(x => x.points > 0) ? 'good' : 'bad');
        api.setStatus(`${nameOf(v, justShot.by)}: ${n}${v.phase === 'aim' && v.turn === justShot.by ? ' — shoots again!' : ''}`, justShot.notes.some(x => x.points > 0) ? 'good' : 'bad');
        if (v.phase !== 'finished') return;
      }
      if (v.phase === 'aim') {
        api.setStatus(mine ? `Your shot${v.shotsLeft < 3 ? ` (${v.shotsLeft} left this turn)` : ''}! Drag back from your marble. ${v.targetsLeft} targets left.` : `${nameOf(v, v.turn)} is aiming… ${v.targetsLeft} targets left.`, mine ? 'hot' : '');
      } else if (v.phase === 'finished') {
        const best = Math.max(...v.players.map(p => v.scores[p.id]));
        const won = v.scores[api.me] === best;
        const key = JSON.stringify(v.wins);
        if (key !== resultKey) {
          resultKey = key;
          setTimeout(() => api.results({
            title: won ? 'Kancha king!' : `${v.players.filter(p => v.scores[p.id] === best).map(p => p.name).join(' & ')} wins`,
            tone: won ? 'win' : 'lose',
            board: board(v, v.scores),
            actions: [{ label: 'New ring', cls: 'green', fn: () => api.act({ type: 'rematch' }) }]
          }), 900);
        }
      }
    }

    function update(v) {
      const prev = view;
      view = v;
      if (v.shot && v.shot.seq !== lastShot) {
        lastShot = v.shot.seq;
        if (prev) { if (replaying) replaying(); playShot(v); render(v); return; }
      }
      if (!replaying) syncStatic(v);
      render(v);
    }

    return { update, destroy() { if (replaying) replaying(); } };
  }
};
