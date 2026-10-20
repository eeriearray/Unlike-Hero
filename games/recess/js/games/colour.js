// Colour Colour, Which Colour? A messy desk and a fast caller.
import { h, burstAt } from '../ui.js';
import { sfx } from '../audio.js';
import { strip, nameOf, board, s } from './common.js';

const INK = '#1d2b4f';
const HEX = { red: '#e53935', blue: '#1e6fe0', green: '#2e9e48', yellow: '#fbc02d', orange: '#f57c00', purple: '#8e24aa', pink: '#f06292', brown: '#795548', black: '#263238', white: '#f5f5f5' };

// Objects drawn around (0,0), roughly 12 units across.
function objectMarkup(kind, c) {
  const st = `stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"`;
  switch (kind) {
    case 'crayon': return `<rect x="-2.4" y="-6" width="4.8" height="11" rx=".6" fill="${c}" ${st}/><path d="M-2.4 -6L0 -9.5 2.4 -6z" fill="${c}" ${st}/><rect x="-2.4" y="-2.5" width="4.8" height="3" fill="rgba(255,255,255,.4)"/>`;
    case 'eraser': return `<rect x="-6" y="-3.2" width="12" height="6.4" rx="1.2" fill="${c}" ${st}/><rect x="1" y="-3.2" width="5" height="6.4" fill="rgba(255,255,255,.45)"/>`;
    case 'ball': return `<circle r="5.2" fill="${c}" ${st}/><path d="M-5 0c3 -2 7 -2 10 0" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1"/><circle cx="-1.8" cy="-2" r="1.1" fill="rgba(255,255,255,.7)"/>`;
    case 'book': return `<rect x="-5.5" y="-6.5" width="11" height="13" rx=".8" fill="${c}" ${st}/><rect x="-5.5" y="-6.5" width="2" height="13" fill="rgba(0,0,0,.18)"/><rect x="-1.5" y="-3.5" width="5" height="2.5" fill="#fff" opacity=".8"/>`;
    case 'scrap': return `<path d="M-6 -4l5 -2 7 1 -1 6 2 4 -8 2 -5 -3z" fill="${c}" ${st}/>`;
    case 'sharpener': return `<rect x="-4" y="-4" width="8" height="8" rx="1" fill="${c}" ${st}/><circle r="1.8" fill="#cfd8dc" ${st}/>`;
    case 'bottle': return `<rect x="-3.5" y="-4" width="7" height="10" rx="2" fill="${c}" ${st}/><rect x="-2" y="-7" width="4" height="3.2" rx=".6" fill="${c}" ${st}/><rect x="-3.5" y="-1" width="7" height="3" fill="rgba(255,255,255,.4)"/>`;
    default: return `<path d="M0 -6l1.8 3.8 4.2.6 -3 2.9.7 4.1L0 3.4 -3.7 5.4l.7-4.1-3-2.9 4.2-.6z" fill="${c}" ${st}/>`;
  }
}

export default {
  mount(root, api) {
    const bubble = h('div.colour-bubble', { 'aria-live': 'assertive' });
    const timer = h('div.colour-timer', {}, h('i'));
    const deskWrap = h('div.colour-desk');
    const svg = s('svg', { viewBox: '0 0 100 80', class: 'colour-svg', 'aria-label': 'Desk with coloured objects' });
    deskWrap.append(svg);
    const callPanel = h('div.colour-call', { hidden: true });
    root.append(bubble, timer, deskWrap, callPanel);

    let view = null;
    let layoutKey = '';
    let phaseKey = '';
    let objEls = new Map();
    let raf = null;
    let resultShown = false;

    function drawDesk(v) {
      svg.replaceChildren();
      objEls.clear();
      s('rect', { x: 0, y: 0, width: 100, height: 80, fill: 'transparent' }, svg);
      for (const o of v.objects) {
        const g = s('g', { class: 'colour-obj', transform: `translate(${o.x} ${o.y * 0.8}) rotate(${o.rot}) scale(${o.scale * 0.95})`, tabindex: 0, role: 'button', 'aria-label': `${o.colour} ${o.kind}` }, svg);
        g.innerHTML = `<g class="inner"><circle r="8" fill="transparent"/>${objectMarkup(o.kind, HEX[o.colour])}</g>`;
        g.style.setProperty('--d', `${(o.id % 9) * 25}ms`);
        const go = async () => {
          if (!view || view.phase !== 'hunt' || view.caller === api.me || view.tapped.includes(api.me)) return;
          const res = await api.act({ type: 'tap', objectId: o.id }, { quiet: true });
          if (res.ok) {
            g.classList.add(res.correct ? 'right' : 'wrong');
            sfx(res.correct ? 'good' : 'bad');
            if (res.correct) burstAt(g);
          }
        };
        g.addEventListener('click', go);
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        objEls.set(o.id, g);
      }
    }

    function runTimer(v) {
      cancelAnimationFrame(raf);
      const bar = timer.firstChild;
      const total = v.phase === 'hunt' ? v.huntMs : 8000;
      const tick = () => {
        const left = Math.max(0, (view.deadline || 0) - api.now());
        bar.style.width = `${Math.min(100, (left / total) * 100)}%`;
        timer.classList.toggle('low', left < 1500 && view.phase === 'hunt');
        if (left > 0 && (view.phase === 'hunt' || view.phase === 'call')) raf = requestAnimationFrame(tick);
      };
      tick();
    }

    function update(v) {
      const prev = view;
      view = v;
      const lk = `${v.round}`;
      if (lk !== layoutKey) { layoutKey = lk; drawDesk(v); if (prev) sfx('paper'); }
      const pk = `${v.round}-${v.phase}`;
      const changed = pk !== phaseKey;
      phaseKey = pk;
      const callerName = v.caller === api.me ? 'You' : nameOf(v, v.caller);
      const iCall = v.caller === api.me;

      svg.classList.toggle('hunting', v.phase === 'hunt' && !iCall && !v.tapped.includes(api.me));
      callPanel.hidden = !(v.phase === 'call' && iCall);
      if (v.phase === 'call' && iCall && changed) {
        callPanel.replaceChildren(
          h('div.note', {}, 'You\'re the caller! Shout a colour:'),
          h('div.colour-swatches', {}, ...v.palette.map(c => h('button.colour-swatch', { style: { '--c': c.hex }, on: { click: () => { sfx('drum'); api.act({ type: 'call', colour: c.id }); } } }, c.name)),
            h('button.colour-swatch.random', { on: { click: () => { sfx('drum'); api.act({ type: 'call', colour: 'random' }); } } }, 'Surprise me')));
      }

      if (v.phase === 'call') {
        bubble.className = 'colour-bubble';
        bubble.replaceChildren(h('span.hand', {}, iCall ? '"Colour colour…"' : `${callerName}: "Colour colour…"`), h('small.note', {}, 'Everyone: "WHICH COLOUR?"'));
        api.setStatus(iCall ? 'Pick a colour that\'s hard to spot!' : `${callerName} is choosing a colour…`, iCall ? 'hot' : '');
        if (changed) sfx('drum');
      } else if (v.phase === 'hunt') {
        const col = v.palette.find(c => c.id === v.colour);
        bubble.className = 'colour-bubble big';
        bubble.replaceChildren(h('span.hand.colour-name', {}, `${col?.name.toUpperCase()}!`));
        const done = v.tapped.includes(api.me);
        api.setStatus(iCall ? 'Watch them scramble…' : done ? 'Tapped! Waiting for the rest…' : `Find something ${col?.name.toLowerCase()} — fast!`, iCall || done ? '' : 'hot');
        if (changed) sfx('go');
      } else if (v.phase === 'result' || v.phase === 'finished') {
        if (changed) {
          for (const [id, g] of objEls) {
            const o = v.objects.find(x => x.id === id);
            g.classList.toggle('answer', o?.colour === v.colour);
            g.classList.toggle('dim', o?.colour !== v.colour);
          }
        }
        const col = v.palette.find(c => c.id === v.colour);
        const found = v.found.map(id => nameOf(v, id));
        bubble.className = 'colour-bubble';
        bubble.replaceChildren(h('span.hand', {}, found.length ? `${found.join(', ')} found ${col?.name}!` : `Nobody found ${col?.name}!`), v.callerPoints ? h('small.note', {}, `Caller ${callerName} +${v.callerPoints}`) : null);
        const mine = v.taps[api.me];
        api.setStatus(iCall ? `You caught ${v.callerPoints} player${v.callerPoints === 1 ? '' : 's'}!` : mine?.correct ? `+${mine.points}!` : 'Missed this one!', iCall ? '' : mine?.correct ? 'good' : 'bad');
      }
      runTimer(v);

      api.setPlayers(strip(v, p => ({
        score: v.scores[p.id],
        sub: p.id === v.caller ? 'caller' : v.found.includes(p.id) ? `#${v.found.indexOf(p.id) + 1} found` : v.tapped.includes(p.id) ? 'tapped' : '',
        active: p.id === v.caller
      })));

      if (v.phase === 'finished' && !resultShown) {
        resultShown = true;
        const won = v.winner === api.me || (!v.winner && Math.max(...v.players.map(p => v.scores[p.id])) === v.scores[api.me]);
        setTimeout(() => api.results({
          title: won ? 'Sharpest eyes in class!' : `${v.winner ? nameOf(v, v.winner) : 'A tie'} wins`,
          sub: `${v.totalRounds} rounds of Colour Colour`,
          tone: won ? 'win' : 'lose',
          board: board(v, v.scores),
          actions: [{ label: 'Play again', cls: 'green', fn: () => api.act({ type: 'rematch' }) }]
        }), 1500);
      }
      if (v.phase !== 'finished') resultShown = false;
    }

    return { update, destroy() { cancelAnimationFrame(raf); } };
  }
};
