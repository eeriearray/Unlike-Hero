// Carrom: slide the striker along your baseline, pull back, flick.
import { h } from '../ui.js';
import { sfx } from '../audio.js';
import { strip, nameOf, board, s, replay, pullAim } from './common.js';

const INK = '#1d2b4f';

export default {
  mount(root, api) {
    const frame = h('div.cr-frame');
    const svg = s('svg', { viewBox: '-9 -9 118 118', class: 'cr-svg', 'aria-label': 'Carrom board' });
    frame.append(svg);
    const slider = h('input.cr-slider', { type: 'range', min: 21, max: 79, step: .5, value: 50, 'aria-label': 'Slide the striker along your baseline' });
    const sliderRow = h('label.cr-slide-row.note', {}, 'Slide striker', slider);
    const power = h('div.pf-power', { hidden: true }, h('i'));
    const controls = h('div.cr-controls');
    root.append(frame, sliderRow, power, controls);

    const defs = s('defs', {}, svg);
    defs.innerHTML = `
      <radialGradient id="cr-white" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fffef8"/><stop offset="1" stop-color="#e9dcc0"/></radialGradient>
      <radialGradient id="cr-black" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#5d5d5d"/><stop offset="1" stop-color="#151515"/></radialGradient>
      <radialGradient id="cr-queen" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ff8a80"/><stop offset="1" stop-color="#b71c1c"/></radialGradient>
      <radialGradient id="cr-striker" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfd8dc"/></radialGradient>
      <pattern id="cr-grain" width="6" height="100" patternUnits="userSpaceOnUse"><path d="M1 0v100M4 0c0 30 1 60 0 100" stroke="rgba(120,70,20,.08)" stroke-width=".6" fill="none"/></pattern>
      <marker id="crhead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10z" fill="#e0453a"/></marker>`;
    const world = s('g', {}, svg);
    s('rect', { x: -9, y: -9, width: 118, height: 118, rx: 4, fill: '#5d3418' }, world);
    s('rect', { x: -9, y: -9, width: 118, height: 118, rx: 4, fill: 'url(#cr-grain)' }, world);
    s('rect', { x: 0, y: 0, width: 100, height: 100, fill: '#f3d9a6' }, world);
    s('rect', { x: 0, y: 0, width: 100, height: 100, fill: 'url(#cr-grain)' }, world);
    const deco = s('g', { class: 'cr-deco' }, world);
    s('circle', { cx: 50, cy: 50, r: 15, fill: 'none' }, deco);
    s('circle', { cx: 50, cy: 50, r: 3, fill: 'none' }, deco);
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      s('path', { d: `M${50 + Math.cos(a) * 4} ${50 + Math.sin(a) * 4}L${50 + Math.cos(a + .12) * 13} ${50 + Math.sin(a + .12) * 13}L${50 + Math.cos(a) * 15} ${50 + Math.sin(a) * 15}L${50 + Math.cos(a - .12) * 13} ${50 + Math.sin(a - .12) * 13}z`, fill: k % 2 ? '#b03a2e' : '#1d2b4f', opacity: .55 }, deco);
    }
    for (const y of [16.5, 83.5]) {
      s('path', { d: `M21 ${y - 2.6}H79M21 ${y + 2.6}H79`, fill: 'none' }, deco);
      s('circle', { cx: 21, cy: y, r: 2.6, fill: '#b03a2e', opacity: .7 }, deco);
      s('circle', { cx: 79, cy: y, r: 2.6, fill: '#b03a2e', opacity: .7 }, deco);
    }
    for (const x of [16.5, 83.5]) {
      s('path', { d: `M${x - 2.6} 21V79M${x + 2.6} 21V79`, fill: 'none' }, deco);
      s('circle', { cx: x, cy: 21, r: 2.6, fill: '#b03a2e', opacity: .7 }, deco);
      s('circle', { cx: x, cy: 79, r: 2.6, fill: '#b03a2e', opacity: .7 }, deco);
    }
    for (const [cx, cy, dx, dy] of [[12, 12, 1, 1], [88, 12, -1, 1], [12, 88, 1, -1], [88, 88, -1, -1]]) {
      s('path', { d: `M${cx} ${cy}l${dx * 20} ${dy * 20}`, 'marker-end': '', class: 'cr-diag' }, deco);
    }
    const pocketG = s('g', {}, world);
    const coinG = s('g', {}, world);
    const aimG = s('g', {}, world);
    const strikerEl = s('g', { class: 'cr-striker' }, world);

    let view = null;
    let built = false;
    const coins = new Map();
    let lastShot = 0;
    let replaying = null;
    let resultKey = '';
    let flip = false;

    function coin(c) {
      const g = s('g', {}, coinG);
      s('circle', { cx: .3, cy: .45, r: c.r, fill: 'rgba(0,0,0,.3)' }, g);
      s('circle', { r: c.r, fill: `url(#cr-${c.kind})`, stroke: INK, 'stroke-width': .25 }, g);
      s('circle', { r: c.r * .62, fill: 'none', stroke: c.kind === 'black' ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.18)', 'stroke-width': .25 }, g);
      return g;
    }

    function build(v) {
      built = true;
      for (const p of v.pockets) {
        s('circle', { cx: p.x, cy: p.y, r: p.r + .4, fill: '#2b1a10' }, pocketG);
        s('circle', { cx: p.x, cy: p.y, r: p.r + 1.2, fill: 'none', stroke: '#b03a2e', 'stroke-width': .4 }, pocketG);
      }
      s('circle', { cx: .3, cy: .5, r: v.strikerR, fill: 'rgba(0,0,0,.3)' }, strikerEl);
      s('circle', { r: v.strikerR, fill: 'url(#cr-striker)', stroke: INK, 'stroke-width': .35 }, strikerEl);
      s('circle', { r: v.strikerR * .55, fill: 'none', stroke: '#e0453a', 'stroke-width': .5 }, strikerEl);
      const seat = v.players.find(p => p.id === api.me)?.seat;
      flip = seat === 1; // seat 1 plays from the top: turn the board so their baseline is nearest them
      world.setAttribute('transform', flip ? 'rotate(180 50 50)' : '');
      if (flip) slider.style.direction = 'rtl'; // so dragging right moves the striker right on a turned board
    }

    function syncCoins(v) {
      const live = new Set(v.coins.map(c => c.id));
      for (const [id, g] of coins) if (!live.has(id)) { g.remove(); coins.delete(id); }
      for (const c of v.coins) {
        if (!coins.has(c.id)) coins.set(c.id, coin(c));
        coins.get(c.id).setAttribute('transform', `translate(${c.x} ${c.y})`);
      }
    }

    const myBaseY = () => (view.players.find(p => p.id === view.turn)?.seat === 0 ? 83.5 : 16.5);
    const strikerPos = () => ({ x: Number(slider.value), y: myBaseY() });
    function placeStriker() {
      if (!view) return;
      const turnSeat = view.players.find(p => p.id === view.turn)?.seat;
      const show = view.phase === 'aim';
      strikerEl.style.display = show ? '' : 'none';
      if (!show) return;
      const y = turnSeat === 0 ? 83.5 : 16.5;
      const x = view.turn === api.me ? Number(slider.value) : 50;
      strikerEl.setAttribute('transform', `translate(${x} ${y})`);
      const blocked = view.coins.some(c => Math.hypot(c.x - x, c.y - y) < c.r + view.strikerR);
      strikerEl.classList.toggle('blocked', blocked && view.turn === api.me);
    }
    slider.addEventListener('input', () => { placeStriker(); if (Number(slider.value) % 3 < .5) sfx('tick'); });

    pullAim(svg, {
      space: world,
      grabRadius: 8,
      maxPull: 30,
      origin: () => (view && view.phase === 'aim' && view.turn === api.me && !replaying ? strikerPos() : null),
      onAim: ({ dx, dy, power: pw }) => {
        const o = strikerPos();
        aimG.replaceChildren();
        const len = Math.hypot(dx, dy) || 1;
        s('line', { x1: o.x, y1: o.y, x2: o.x - dx * .7, y2: o.y - dy * .7, class: 'cr-pull' }, aimG);
        s('line', { x1: o.x, y1: o.y, x2: o.x + dx / len * (10 + pw * 40), y2: o.y + dy / len * (10 + pw * 40), class: 'cr-traj', 'marker-end': 'url(#crhead)' }, aimG);
        power.hidden = false;
        power.firstChild.style.width = `${Math.round(pw * 100)}%`;
      },
      onCancel: () => { aimG.replaceChildren(); power.hidden = true; },
      onShoot: async ({ dx, dy, power: pw }) => {
        aimG.replaceChildren(); power.hidden = true;
        const len = Math.hypot(dx, dy) || 1;
        sfx('flick');
        await api.act({ type: 'shoot', x: Number(slider.value), vx: dx / len * pw * view.maxSpeed, vy: dy / len * pw * view.maxSpeed });
      }
    });

    function playShot(v) {
      const shot = v.shot;
      const els = shot.ids.map(id => (id === 'striker' ? strikerEl : coins.get(id)));
      strikerEl.style.display = '';
      const events = [...shot.events];
      replaying = replay(shot.frames, (fa, fb, t, i) => {
        while (events.length && events[0].f <= i) {
          const ev = events.shift();
          if (ev.type === 'hit') sfx('clack', { v: ev.v });
          else if (ev.type === 'wall') sfx('thud');
          else if (ev.type === 'pocket') sfx('pocket');
        }
        els.forEach((g, k) => {
          if (!g) return;
          const A = fa[k], B = fb[k];
          if (!A) { g.style.opacity = '0'; return; }
          g.style.opacity = '';
          g.setAttribute('transform', `translate(${A[0] + ((B || A)[0] - A[0]) * t} ${A[1] + ((B || A)[1] - A[1]) * t})`);
        });
      }, () => {
        replaying = null;
        strikerEl.style.opacity = '';
        api.act({ type: 'shot-done', seq: shot.seq }, { quiet: true });
        for (const g of coins.values()) g.style.opacity = '';
        syncCoins(view);
        render(view, shot);
      });
    }

    function render(v, justShot) {
      const mine = v.turn === api.me;
      sliderRow.hidden = !(v.phase === 'aim' && mine);
      svg.classList.toggle('can-aim', v.phase === 'aim' && mine && !replaying);
      if (!replaying) placeStriker();
      api.setPlayers(strip(v, p => ({ score: v.scores[p.id], sub: `${p.color} · ${v.left[p.color]} left${v.queenOwner === p.id ? ' · ♛' : ''}`, active: v.turn === p.id, color: p.color === 'white' ? '#c9b48a' : '#1d2b4f' })));
      controls.replaceChildren();
      if (replaying) { api.setStatus('Clack!'); return; }
      const notes = justShot?.notes?.length ? `${justShot.notes.join(' · ')}. ` : '';
      const me = v.players.find(p => p.id === api.me);
      if (v.phase === 'aim') {
        const queen = v.queenPending === api.me ? ' Cover the queen now!' : '';
        api.setStatus(mine ? `${notes}Your shot (${me.color}). Slide, then pull back from the striker.${queen}` : `${notes}${nameOf(v, v.turn)} is lining up…`, v.foul && justShot ? 'bad' : mine ? 'hot' : '');
        if (justShot) sfx(justShot.notes.some(n => n.startsWith('Foul')) ? 'bad' : justShot.notes.some(n => n.startsWith('+') || n.startsWith('Queen covered')) ? 'good' : 'tick');
      } else if (v.phase === 'finished') {
        const won = v.winner === api.me;
        api.setStatus(won ? 'You cleared your coins!' : `${nameOf(v, v.winner)} cleared the board.`, won ? 'good' : 'bad');
        const key = JSON.stringify(v.wins);
        if (key !== resultKey) {
          resultKey = key;
          setTimeout(() => api.results({
            title: won ? 'Carrom champion!' : `${nameOf(v, v.winner)} wins the board`,
            sub: 'Points: 1 per coin, 3 for a covered queen',
            tone: won ? 'win' : 'lose',
            board: board(v, v.scores),
            actions: [{ label: 'New board', cls: 'green', fn: () => api.act({ type: 'rematch' }) }]
          }), 800);
        }
      }
    }

    function update(v) {
      const prev = view;
      view = v;
      if (!built) build(v);
      if (v.shot && v.shot.seq !== lastShot) {
        lastShot = v.shot.seq;
        if (prev) { if (replaying) replaying(); playShot(v); render(v); return; }
      }
      if (!replaying) syncCoins(v);
      render(v);
    }

    return { update, destroy() { if (replaying) replaying(); } };
  }
};
