// Raja Mantri Chor Sipahi: four folded chits, one thief.
import { h, burstAt } from '../ui.js';
import { sfx } from '../audio.js';
import { avatarSVG } from '../art.js';
import { strip, nameOf, board } from './common.js';

const INK = '#1d2b4f';
const ROLE = {
  raja: { en: 'Raja', hi: 'राजा', color: '#ffd34d', pts: 1000, icon: `<path d="M14 40l6-22 12 12 8-18 8 18 12-12 6 22z" fill="#ffd34d" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="40" cy="14" r="4" fill="#e0453a" stroke="${INK}" stroke-width="2.5"/><rect x="14" y="40" width="52" height="8" fill="#e0453a" stroke="${INK}" stroke-width="3"/>` },
  mantri: { en: 'Mantri', hi: 'मंत्री', color: '#cfe3ff', pts: 800, icon: `<rect x="18" y="14" width="44" height="36" rx="4" fill="#fff" stroke="${INK}" stroke-width="3.5"/><path d="M26 24h28M26 32h28M26 40h18" stroke="#2463d6" stroke-width="3"/><circle cx="18" cy="14" r="6" fill="#d7b98a" stroke="${INK}" stroke-width="3"/><circle cx="62" cy="50" r="6" fill="#d7b98a" stroke="${INK}" stroke-width="3"/>` },
  chor: { en: 'Chor', hi: 'चोर', color: '#e6e6e6', pts: 0, icon: `<path d="M12 28c8-8 48-8 56 0-2 12-12 16-28 16S14 40 12 28z" fill="${INK}"/><circle cx="28" cy="30" r="5" fill="#fff"/><circle cx="52" cy="30" r="5" fill="#fff"/><path d="M50 50c10 0 14 4 14 8H40" fill="#a1887f" stroke="${INK}" stroke-width="3"/>` },
  sipahi: { en: 'Sipahi', hi: 'सिपाही', color: '#d3f5e6', pts: 500, icon: `<path d="M40 8l6 30h-12z" fill="#cfd8dc" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><rect x="28" y="38" width="24" height="5" fill="#8d6e63" stroke="${INK}" stroke-width="3"/><rect x="36" y="43" width="8" height="12" fill="#8d6e63" stroke="${INK}" stroke-width="3"/><path d="M14 22c0 14 6 24 14 28M66 22c0 14-6 24-14 28" stroke="#2e9e48" stroke-width="3.5" fill="none"/>` }
};

function chit(roleId, { folded = false, label } = {}) {
  if (folded || !roleId) {
    return `<svg viewBox="0 0 80 100" class="chit-svg"><path d="M8 10l64-4 2 88-64 2z" fill="#fffaf0" stroke="${INK}" stroke-width="3.5"/><path d="M9 52l63-2" stroke="${INK}" stroke-width="2" stroke-dasharray="4 4" opacity=".4"/><path d="M40 6v90" stroke="${INK}" stroke-width="1.5" stroke-dasharray="3 5" opacity=".25"/><text x="40" y="60" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="30" fill="${INK}" opacity=".5">?</text>${label ? `<text x="40" y="88" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="14" fill="${INK}">${label}</text>` : ''}</svg>`;
  }
  const r = ROLE[roleId];
  return `<svg viewBox="0 0 80 100" class="chit-svg"><path d="M8 10l64-4 2 88-64 2z" fill="${r.color}" stroke="${INK}" stroke-width="3.5"/><g transform="translate(0 6)">${r.icon}</g><text x="40" y="76" text-anchor="middle" font-size="15" font-weight="700" fill="${INK}">${r.hi}</text><text x="40" y="92" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="17" fill="${INK}">${r.en} · ${r.pts}</text></svg>`;
}

export default {
  mount(root, api) {
    const table = h('div.rmcs-table');
    const center = h('div.rmcs-center');
    const mine = h('div.rmcs-mine');
    const verdict = h('div.rmcs-verdict.note', { 'aria-live': 'polite' });
    const controls = h('div.rmcs-controls');
    root.append(table, mine, verdict, controls);
    let view = null;
    let seats = new Map();
    let lastPhaseKey = '';
    let resultShown = false;

    function buildSeats(v) {
      table.replaceChildren();
      seats.clear();
      // Me at the bottom, others clockwise.
      const meIdx = Math.max(0, v.players.findIndex(p => p.id === api.me));
      const order = v.players.map((_, i) => v.players[(meIdx + i) % v.players.length]);
      const spots = ['bottom', 'left', 'top', 'right'];
      order.forEach((p, i) => {
        const card = h('button.rmcs-seat.' + spots[i], { 'aria-label': p.name });
        card.addEventListener('click', () => accuse(p.id));
        table.append(card);
        seats.set(p.id, card);
      });
      table.append(center);
    }

    async function accuse(pid) {
      const v = view;
      if (!v || v.phase !== 'guessing' || v.mantriId !== api.me) return;
      const p = v.players.find(x => x.id === pid);
      if (!p?.isSuspect || pid === api.me) return;
      sfx('drum');
      await api.act({ type: 'guess', suspectId: pid });
    }

    function update(v) {
      const prev = view;
      view = v;
      if (!prev || prev.players.length !== v.players.length) buildSeats(v);
      const key = `${v.round}-${v.phase}`;
      const phaseChanged = key !== lastPhaseKey;
      lastPhaseKey = key;
      if (phaseChanged) {
        if (v.phase === 'dealing') { sfx('shuffle'); resultShown = false; }
        if (v.phase === 'announcing') sfx('reveal');
        if (v.phase === 'guessing') sfx('drum');
        if (v.phase === 'verdict') {
          sfx(v.guess?.isCorrect ? 'good' : 'bad');
          const chor = v.players.find(p => p.role?.id === 'chor');
          if (chor && seats.get(chor.id)) setTimeout(() => burstAt(seats.get(chor.id)), 300);
        }
      }

      const iAmMantri = v.mantriId === api.me && v.phase === 'guessing';
      for (const p of v.players) {
        const el = seats.get(p.id);
        if (!el) continue;
        const role = p.role?.id || null; // the server only sends roles this player may see
        const suspectable = iAmMantri && p.isSuspect && p.id !== api.me;
        el.className = el.className.replace(/ (suspect|guessed|flip|me)\b/g, '');
        if (suspectable) el.classList.add('suspect');
        if (p.id === api.me) el.classList.add('me');
        if (v.guess?.suspectId === p.id) el.classList.add('guessed');
        if (phaseChanged && v.phase === 'verdict') el.classList.add('flip');
        const pts = v.phase === 'verdict' && p.roundPoints !== null ? `<div class="rmcs-pts ${p.roundPoints ? 'plus' : ''}">+${p.roundPoints}</div>` : '';
        el.innerHTML = `<div class="rmcs-who"><span class="ava">${avatarSVG(p.avatar)}</span><b>${p.id === api.me ? 'You' : p.name}</b></div>
          <div class="rmcs-chit">${chit(role)}</div>${pts}
          ${suspectable ? '<div class="rmcs-point hand">Point: Chor?</div>' : ''}`;
        el.disabled = !suspectable;
      }

      // my private chit, big
      if (v.myRole) {
        mine.innerHTML = `<div class="rmcs-mychit ${phaseChanged && v.phase === 'announcing' ? 'unfold' : ''}">${chit(v.myRole.id)}</div>
          <div class="rmcs-mytext note">Your chit says <b>${ROLE[v.myRole.id].en}</b>. ${{ raja: 'Announce yourself — "Raja!"', mantri: 'Find the Chor among the other two.', chor: 'Keep a straight face…', sipahi: 'Look innocent. You are.' }[v.myRole.id]}</div>`;
        mine.hidden = v.phase === 'verdict';
      } else mine.hidden = true;

      center.innerHTML = v.phase === 'dealing'
        ? `<div class="rmcs-pile">${[0, 1, 2, 3].map(i => `<div class="rmcs-fly" style="--i:${i}">${chit(null, { folded: true })}</div>`).join('')}</div>`
        : `<div class="rmcs-round hand">Round ${v.round}<small>of ${v.rules.rounds}</small></div>`;

      const statusFor = () => {
        if (v.phase === 'dealing') return ['The chits are shuffled and thrown…', ''];
        if (v.phase === 'announcing') return [`${nameOf(v, v.rajaId)} is the Raja! ${nameOf(v, v.mantriId)} is the Mantri!`, 'hot'];
        if (v.phase === 'guessing') return v.mantriId === api.me ? ['You are the Mantri — tap the Chor!', 'hot'] : [`${nameOf(v, v.mantriId)} the Mantri is hunting for the Chor…`, ''];
        return [v.guess?.isCorrect ? 'Caught!' : 'The Chor got away!', v.guess?.isCorrect ? 'good' : 'bad'];
      };
      const [st, tone] = statusFor();
      api.setStatus(st, tone);
      verdict.textContent = v.phase === 'verdict' ? v.verdictMessage : '';

      api.setPlayers(strip(v, p => ({ score: v.scores[p.id], sub: p.role && (v.phase === 'verdict' || p.id === api.me || p.id === v.rajaId || p.id === v.mantriId) ? ROLE[p.role.id]?.en : 'chit folded', active: v.phase === 'guessing' && p.id === v.mantriId })));

      controls.replaceChildren();
      if (v.phase === 'verdict') {
        if (!v.finished) controls.append(h('button.btn.big.green', { on: { click: () => { sfx('shuffle'); api.act({ type: 'next-round' }); } } }, 'Deal next round'));
        const rules = h('div.rmcs-rules.note', {},
          'House rules: wrong guess ',
          ...[['swap', 'gives Chor the 800'], ['zero', 'scores 0 for both']].map(([k, t]) =>
            h('button.btn.small' + (v.rules.wrongGuess === k ? '.yellow' : '.ghost'), { on: { click: () => api.act({ type: 'set-rules', wrongGuess: k }) } }, t)),
          ' · rounds ',
          ...[3, 5, 10].map(n => h('button.btn.small' + (v.rules.rounds === n ? '.yellow' : '.ghost'), { disabled: n < v.round, on: { click: () => api.act({ type: 'set-rules', rounds: n }) } }, String(n))));
        controls.append(rules);
        if (v.finished && !resultShown) {
          resultShown = true;
          const best = Math.max(...v.players.map(p => v.scores[p.id]));
          const won = v.scores[api.me] === best;
          setTimeout(() => api.results({
            title: won ? 'You rule the court!' : `${v.players.filter(p => v.scores[p.id] === best).map(p => p.name).join(' & ')} wins`,
            sub: `${v.rules.rounds} rounds of Raja Mantri Chor Sipahi`,
            tone: won ? 'win' : 'lose',
            board: board(v, v.scores),
            actions: [{ label: 'Play again', cls: 'green', fn: () => api.act({ type: 'rematch' }) }]
          }), 1600);
        }
      }
    }

    return { update, destroy() {} };
  }
};
