// Ludo on a 15×15 board. Geometry here; the rules live on the server.
import { h, wait, burstAt } from '../ui.js';
import { sfx } from '../audio.js';
import { strip, nameOf, s, dieFace } from './common.js';

const INK = '#1d2b4f';
const COL = { red: '#e53935', green: '#2e9e48', yellow: '#fbc02d', blue: '#1e6fe0' };
const START = { red: 0, green: 13, yellow: 26, blue: 39 };
const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];

// The 52 squares of the shared track, clockwise from red's start square (col, row).
const TRACK = [];
(() => {
  const seg = (pts) => TRACK.push(...pts);
  const range = (a, b) => { const out = []; const d = a <= b ? 1 : -1; for (let i = a; i !== b + d; i += d) out.push(i); return out; };
  seg(range(1, 5).map(c => [c, 6]));
  seg(range(5, 0).map(r => [6, r]));
  seg([[7, 0], [8, 0]]);
  seg(range(1, 5).map(r => [8, r]));
  seg(range(9, 14).map(c => [c, 6]));
  seg([[14, 7], [14, 8]]);
  seg(range(13, 9).map(c => [c, 8]));
  seg(range(9, 14).map(r => [8, r]));
  seg([[7, 14], [6, 14]]);
  seg(range(13, 9).map(r => [6, r]));
  seg(range(5, 0).map(c => [c, 8]));
  seg([[0, 7], [0, 6]]);
})();
const LANE = {
  red: [1, 2, 3, 4, 5].map(c => [c, 7]),
  green: [1, 2, 3, 4, 5].map(r => [7, r]),
  yellow: [13, 12, 11, 10, 9].map(c => [c, 7]),
  blue: [13, 12, 11, 10, 9].map(r => [7, r])
};
const BASE = { red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9] };
const HOME_SPOT = { red: [6.3, 7.5], green: [7.5, 6.3], yellow: [8.7, 7.5], blue: [7.5, 8.7] };

function spot(color, prog, i) {
  if (prog === -1) { const [bx, by] = BASE[color]; return [bx + 2 + (i % 2) * 2, by + 2 + Math.floor(i / 2) * 2]; }
  if (prog === 56) { const [x, y] = HOME_SPOT[color]; return [x + ((i % 2) - .5) * .7, y + (Math.floor(i / 2) - .5) * .7]; }
  if (prog >= 51) { const [c, r] = LANE[color][prog - 51]; return [c + .5, r + .5]; }
  const [c, r] = TRACK[(START[color] + prog) % 52];
  return [c + .5, r + .5];
}

export default {
  mount(root, api) {
    const wrap = h('div.ludo-wrap');
    const svg = s('svg', { viewBox: '-.3 -.3 15.6 15.6', class: 'ludo-board', 'aria-label': 'Ludo board' });
    const dieBtn = h('button.ludo-die', { 'aria-label': 'Roll the die' });
    const hint = h('div.note.ludo-hint');
    wrap.append(h('div.ludo-frame', {}, svg), h('div.ludo-side', {}, dieBtn, hint));
    root.append(wrap);

    let view = null;
    let built = false;
    const pawns = new Map();   // `${pid}:${i}` -> { outer, inner }
    let shown = {};            // pid -> [prog x4]
    let lastSeq = 0;
    let busy = Promise.resolve();
    let resultKey = '';

    function buildBoard(v) {
      built = true;
      const g = s('g', {}, svg);
      s('rect', { x: 0, y: 0, width: 15, height: 15, fill: '#fffdf7', stroke: INK, 'stroke-width': .12, rx: .2 }, g);
      for (const [color, [bx, by]] of Object.entries(BASE)) {
        s('rect', { x: bx, y: by, width: 6, height: 6, fill: COL[color], stroke: INK, 'stroke-width': .1 }, g);
        s('rect', { x: bx + 1, y: by + 1, width: 4, height: 4, fill: '#fff', stroke: INK, 'stroke-width': .08, rx: .3 }, g);
        for (let i = 0; i < 4; i++) {
          const [x, y] = spot(color, -1, i);
          s('circle', { cx: x, cy: y, r: .62, fill: COL[color], opacity: .35, stroke: INK, 'stroke-width': .05 }, g);
        }
      }
      TRACK.forEach(([c, r], i) => {
        const startOf = Object.entries(START).find(([, idx]) => idx === i)?.[0];
        s('rect', { x: c, y: r, width: 1, height: 1, fill: startOf ? COL[startOf] : '#fff', stroke: INK, 'stroke-width': .05 }, g);
        if (SAFE.includes(i) && !startOf) {
          s('path', { d: `M${c + .5} ${r + .17}l.1 .22.24.03-.18.16.05.24-.21-.12-.21.12.05-.24-.18-.16.24-.03z`, fill: '#ffd34d', stroke: INK, 'stroke-width': .04, transform: `translate(${-(c + .5) * .6} ${-(r + .5) * .6}) scale(1.6)` }, g);
        }
      });
      for (const [color, cells] of Object.entries(LANE)) {
        for (const [c, r] of cells) s('rect', { x: c, y: r, width: 1, height: 1, fill: COL[color], opacity: .85, stroke: INK, 'stroke-width': .05 }, g);
      }
      // centre home triangles
      s('path', { d: 'M6 6L7.5 7.5L6 9z', fill: COL.red, stroke: INK, 'stroke-width': .06 }, g);
      s('path', { d: 'M6 6L7.5 7.5L9 6z', fill: COL.green, stroke: INK, 'stroke-width': .06 }, g);
      s('path', { d: 'M9 6L7.5 7.5L9 9z', fill: COL.yellow, stroke: INK, 'stroke-width': .06 }, g);
      s('path', { d: 'M6 9L7.5 7.5L9 9z', fill: COL.blue, stroke: INK, 'stroke-width': .06 }, g);
      // pawns
      const pg = s('g', {}, svg);
      for (const p of v.players) {
        shown[p.id] = [...v.tokens[p.id]];
        for (let i = 0; i < 4; i++) {
          const outer = s('g', { class: 'ludo-pawn-pos' }, pg);
          const inner = s('g', { class: 'ludo-pawn', tabindex: -1, role: 'button', 'aria-label': `${p.color} token ${i + 1}` }, outer);
          s('ellipse', { cx: 0, cy: .32, rx: .34, ry: .12, fill: 'rgba(0,0,0,.3)' }, inner);
          s('path', { d: 'M-.3 .3C-.3-.05-.18-.15 0-.15S.3-.05.3 .3z', fill: COL[p.color], stroke: INK, 'stroke-width': .06 }, inner);
          s('circle', { cx: 0, cy: -.26, r: .2, fill: COL[p.color], stroke: INK, 'stroke-width': .06 }, inner);
          s('circle', { cx: -.07, cy: -.32, r: .06, fill: '#fff', opacity: .8 }, inner);
          inner.addEventListener('click', () => choose(p.id, i));
          inner.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(p.id, i); } });
          pawns.set(`${p.id}:${i}`, { outer, inner, color: p.color, pid: p.id, i });
        }
      }
      layout();
    }

    function layout() {
      // group pawns by square to fan them out
      const groups = new Map();
      for (const pw of pawns.values()) {
        const prog = shown[pw.pid][pw.i];
        const [x, y] = spot(pw.color, prog, pw.i);
        const key = prog === -1 || prog === 56 ? `${pw.pid}:${pw.i}` : `${x},${y}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ pw, x, y });
      }
      for (const list of groups.values()) {
        list.forEach(({ pw, x, y }, k) => {
          const n = list.length;
          const off = n > 1 ? [(k % 2 - .5) * .42, (Math.floor(k / 2) - (n > 2 ? .5 : 0)) * .42] : [0, 0];
          const sc = n > 1 ? .75 : 1;
          pw.outer.setAttribute('transform', `translate(${x + off[0]} ${y + off[1]}) scale(${sc})`);
        });
      }
    }

    async function choose(pid, i) {
      if (pid !== api.me || !view || view.phase !== 'move' || view.turn !== api.me || !view.movable.includes(i)) return;
      sfx('wood');
      await api.act({ type: 'move', token: i });
    }

    dieBtn.addEventListener('click', async () => {
      if (!view || view.phase !== 'roll' || view.turn !== api.me || dieBtn.disabled) return;
      dieBtn.disabled = true;
      const res = await api.act({ type: 'roll' });
      if (!res.ok) dieBtn.disabled = false;
    });

    async function rollAnim(value) {
      const fast = document.body.classList.contains('calm');
      dieBtn.classList.add('rolling');
      sfx('dice');
      for (let k = 0; k < (fast ? 1 : 7); k++) { dieBtn.innerHTML = dieFace(1 + Math.floor(Math.random() * 6), 64, '#fff'); await wait(55); }
      dieBtn.innerHTML = dieFace(value, 64, '#fff');
      dieBtn.classList.remove('rolling');
    }

    async function moveAnim(last) {
      const fast = document.body.classList.contains('calm');
      const arr = shown[last.by];
      if (last.from === -1) { arr[last.token] = 0; layout(); sfx('pop'); await wait(fast ? 0 : 200); }
      else {
        for (let p = last.from + 1; p <= last.to; p++) { arr[last.token] = p; layout(); sfx('step'); await wait(fast ? 0 : 160); }
      }
      if (last.captured?.length) {
        sfx('thud');
        const pw = pawns.get(`${last.by}:${last.token}`);
        if (pw) burstAt(pw.inner);
        await wait(fast ? 0 : 250);
        for (const c of last.captured) { shown[c.pid][c.token] = -1; }
        layout();
        sfx('whoosh');
      }
      if (last.to === 56) { sfx('climb'); const pw = pawns.get(`${last.by}:${last.token}`); if (pw) burstAt(pw.inner); }
    }

    function render(v) {
      for (const p of v.players) shown[p.id] = shown[p.id] || [...v.tokens[p.id]];
      // snap to truth (animations above already walked there)
      for (const p of v.players) shown[p.id] = [...v.tokens[p.id]];
      layout();
      const mine = v.turn === api.me;
      for (const pw of pawns.values()) {
        const can = mine && v.phase === 'move' && pw.pid === api.me && v.movable.includes(pw.i);
        pw.inner.classList.toggle('movable', can);
        pw.inner.setAttribute('tabindex', can ? '0' : '-1');
      }
      const me = v.players.find(p => p.id === api.me);
      dieBtn.disabled = !(mine && v.phase === 'roll');
      dieBtn.classList.toggle('ready', mine && v.phase === 'roll');
      dieBtn.style.setProperty('--dc', COL[v.players.find(p => p.id === v.turn)?.color] || '#fff');
      hint.textContent = me ? `You are ${me.color}` : '';
      const home = (pid) => v.tokens[pid].filter(t => t === 56).length;
      api.setPlayers(strip(v, p => ({ score: `${home(p.id)}/4`, sub: `${p.color}${v.wins[p.id] ? ` · ${v.wins[p.id]} win${v.wins[p.id] > 1 ? 's' : ''}` : ''}`, active: v.turn === p.id, color: COL[p.color] })));
      const l = v.last;
      if (v.phase === 'finished') {
        const won = v.winner === api.me;
        api.setStatus(won ? 'All four home — you win!' : `${nameOf(v, v.winner)} got all four home!`, won ? 'good' : 'bad');
        const key = JSON.stringify(v.wins);
        if (key !== resultKey) {
          resultKey = key;
          setTimeout(() => api.results({
            title: won ? 'Ludo champion!' : `${nameOf(v, v.winner)} wins`,
            tone: won ? 'win' : 'lose',
            board: v.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, pts: `${home(p.id)}/4 home`, raw: home(p.id), win: p.id === v.winner })).sort((a, b) => b.raw - a.raw),
            actions: [{ label: 'Play again', cls: 'green', fn: () => api.act({ type: 'rematch' }) }]
          }), 700);
        }
        return;
      }
      if (mine && v.phase === 'roll') api.setStatus(l?.by === api.me && (l.roll === 6 || l.note === 'capture' || l.note === 'home') && l.note !== 'three-sixes' ? 'Bonus roll! Roll again.' : 'Your turn — roll the die!', 'hot');
      else if (mine && v.phase === 'move') api.setStatus(`You rolled ${v.dice.value}. Tap a glowing token.`, 'hot');
      else {
        const note = l && l.by !== v.turn ? (l.note === 'three-sixes' ? `${nameOf(v, l.by)} rolled three 6s — turn over! ` : l.note === 'no-move' ? `${nameOf(v, l.by)} rolled ${l.roll}, no move. ` : l.note === 'capture' ? `${nameOf(v, l.by)} captured a token! ` : '') : '';
        api.setStatus(`${note}${nameOf(v, v.turn)}'s turn.`, l?.note === 'capture' ? 'bad' : '');
      }
    }

    function update(v) {
      const prev = view;
      view = v;
      if (!built) { buildBoard(v); dieBtn.innerHTML = dieFace(v.dice?.value || 6, 64, '#fff'); lastSeq = Math.max(v.dice?.seq || 0, v.last?.seq || 0); render(v); return; }
      if (prev?.phase === 'finished' && v.phase !== 'finished') { lastSeq = 0; }
      const steps = [];
      if (v.dice && v.dice.seq > lastSeq) steps.push(() => rollAnim(v.dice.value));
      if (v.last && v.last.seq > lastSeq && v.last.token !== undefined) steps.push(() => moveAnim(v.last));
      lastSeq = Math.max(lastSeq, v.dice?.seq || 0, v.last?.seq || 0);
      if (steps.length) dieBtn.disabled = true;
      const snapshot = v;
      busy = busy.then(async () => { for (const st of steps) await st(); }).then(() => { if (view === snapshot) render(view); });
    }

    return { update, destroy() {} };
  }
};
