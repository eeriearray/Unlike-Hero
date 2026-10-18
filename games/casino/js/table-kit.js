/* Neon Casino — shared table pieces: cards, chips, chip stacks, turn timers, and the seated character silhouettes and
   dealer used by every table. Loaded after js/app.js (which provides window.CasinoUI) and before the table modules. */
(function () {
  'use strict';
  var UI = window.CasinoUI, html = UI.html, cx = UI.cx, money = UI.money;

  var SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
  var RANK = { T: '10' };
  var CHIP_VALUES = [25, 100, 500, 1000, 5000, 25000, 100000];

  function Card(props) {
    var c = props.card;
    if (!c) return html`<span className="card card-back" style=${{ '--i': props.i || 0 }} aria-label="Face-down card"></span>`;
    var rank = RANK[c[0]] || c[0], suit = c[1], red = suit === 'H' || suit === 'D';
    return html`<span className=${cx('card', red && 'red')} style=${{ '--i': props.i || 0 }} aria-label=${rank + ' of ' + { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }[suit]}>
      <span className="card-corner"><b>${rank}</b><i>${SUIT[suit]}</i></span>
      <span className="card-pip" aria-hidden="true">${SUIT[suit]}</span>
    </span>`;
  }

  function Cards(props) {
    // Keyed by position + face, so new cards (and the hole card turning over) animate in and old ones stay put.
    return html`<div className="cards">${props.cards.map(function (c, i) { return html`<${Card} key=${i + ':' + (c || 'back')} card=${c} i=${i} />`; })}</div>`;
  }

  // --z is the chip's place in its stack; on a 3D table each chip sits that many chip-thicknesses above the felt.
  function Chip(props) {
    return html`<span className=${'chip chip-' + props.value} style=${props.z != null ? { '--z': props.z } : null} aria-hidden="true">${props.value >= 1000 ? props.value / 1000 + 'K' : props.value}</span>`;
  }

  /** The chips that make up an amount, biggest first (at most 6 drawn). */
  function chipStack(amount) {
    var out = [], left = amount;
    for (var i = CHIP_VALUES.length - 1; i >= 0 && out.length < 6; i--) while (left >= CHIP_VALUES[i] && out.length < 6) { out.push(CHIP_VALUES[i]); left -= CHIP_VALUES[i]; }
    return out;
  }
  function Stack(props) {
    if (!props.amount) return null;
    return html`<div className="stack" title=${money(props.amount)}>
      <span className="stack-chips" style=${{ '--n': chipStack(props.amount).length }}>${chipStack(props.amount).map(function (v, i) { return html`<${Chip} key=${i} value=${v} z=${i} />`; })}</span>
      <b className="num">${money(props.amount)}</b>
    </div>`;
  }

  function TimerBar(props) {
    var t = props.timer, now = props.now;
    if (!t) return null;
    var left = t.endsAt ? Math.max(0, t.endsAt - now) : (t.remainingMs || 0);
    var pct = Math.max(0, Math.min(100, (left / t.ms) * 100));
    return html`<div className=${cx('timerbar', left < 5000 && 'urgent', !t.endsAt && 'frozen')} role="timer" aria-label=${Math.ceil(left / 1000) + ' seconds left'}>
      <span style=${{ width: pct + '%' }}></span><b className="num">${Math.ceil(left / 1000)}s</b>
    </div>`;
  }


  var LOOKS = {
    fox: ['#ff8a3d', 'quiff'], tiger: ['#ffb02e', 'cap'], panda: ['#d8d4ea', 'bun'], owl: ['#c99a5b', 'tophat'],
    frog: ['#5fd068', 'short'], octopus: ['#ff6fa8', 'curly'], unicorn: ['#d38cff', 'pony'], dragon: ['#ff5d6c', 'mohawk'],
    cat: ['#ffd36e', 'bob'], wolf: ['#8fb3ff', 'quiff'], koala: ['#a9b4c8', 'beanie'], shark: ['#4dc3ff', 'short'],
    monkey: ['#e2a46a', 'cap'], penguin: ['#9be7ff', 'tophat'], lion: ['#ffc24a', 'curly'], robot: ['#3de0d0', 'antenna']
  };
  var HAIR = {
    short: 'M47 50 C47 30 60 24 70 24 C82 24 94 30 93 50 C88 40 80 37 70 37 C60 37 52 40 47 50 Z',
    quiff: 'M46 52 C44 30 58 20 74 18 C84 17 96 24 94 46 C86 34 78 34 70 34 C60 34 52 40 46 52 Z',
    bun: 'M47 50 C47 32 58 26 70 26 C82 26 93 32 93 50 C86 40 78 37 70 37 C62 37 54 40 47 50 Z M60 20 a10 9 0 1 0 20 0 a10 9 0 1 0 -20 0',
    curly: 'M44 54 C38 44 42 30 52 26 C54 18 66 14 74 19 C84 14 96 22 95 32 C102 38 100 50 96 56 C90 44 80 38 70 38 C60 38 50 44 44 54 Z',
    pony: 'M47 50 C47 32 58 26 70 26 C82 26 93 32 93 50 C86 40 78 37 70 37 C62 37 54 40 47 50 Z M66 76 C64 92 72 104 70 116 C80 104 80 90 76 76 Z',
    mohawk: 'M64 34 C62 20 66 10 70 6 C74 10 78 20 76 34 Z',
    bob: 'M42 62 C38 36 54 24 70 24 C86 24 102 36 98 62 C94 52 84 40 70 40 C56 40 46 52 42 62 Z',
    cap: 'M46 46 C46 30 58 24 70 24 C82 24 94 30 94 46 Z M44 46 L96 46 L96 50 L44 50 Z',
    beanie: 'M45 48 C45 28 58 20 70 20 C82 20 95 28 95 48 Z M44 44 L96 44 L96 52 L44 52 Z M66 16 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0',
    tophat: 'M54 36 L56 6 L84 6 L86 36 Z M42 36 L98 36 L98 42 L42 42 Z',
    antenna: 'M69 30 L69 14 L71 14 L71 30 Z M64 12 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0'
  };

  /** A seated player seen from behind: shaded bust, rim-lit by the table lamp in their colour, on a leather stool. */
  function Character(props) {
    var look = LOOKS[props.avatar] || ['#c9c3dc', 'short'], color = look[0], hair = HAIR[look[1]];
    var id = 'ch' + props.seat;
    var body = 'M14 150 C16 112 38 90 70 90 C102 90 124 112 126 150 Z';
    return html`<svg className="character-svg" viewBox="0 0 140 160" aria-hidden="true">
      <defs>
        <linearGradient id=${id + 'b'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#575075" /><stop offset=".45" stopColor="#262236" /><stop offset="1" stopColor="#0d0c14" /></linearGradient>
        <radialGradient id=${id + 'h'} cx="50%" cy="25%" r="75%"><stop offset="0" stopColor="#6a6390" /><stop offset=".6" stopColor="#2a2640" /><stop offset="1" stopColor="#100e18" /></radialGradient>
        <linearGradient id=${id + 'r'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor=${color} stopOpacity="1" /><stop offset=".5" stopColor=${color} stopOpacity=".15" /><stop offset="1" stopColor=${color} stopOpacity="0" /></linearGradient>
      </defs>
      <ellipse cx="70" cy="152" rx="58" ry="8" fill="#000" opacity=".55" />
      <path d=${body} fill=${'url(#' + id + 'b)'} />
      <path d=${body} fill=${color} opacity=".2" />
      <rect x="60" y="68" width="20" height="28" rx="8" fill="#14121c" />
      <ellipse cx="70" cy="52" rx="24" ry="27" fill=${'url(#' + id + 'h)'} />
      <ellipse cx="70" cy="52" rx="24" ry="27" fill=${color} opacity=".12" />
      ${hair ? html`<path d=${hair} fill="#1b1826" />` : null}
      <g fill="none" stroke=${'url(#' + id + 'r)'} strokeWidth="3.5" strokeLinejoin="round">
        <path d=${body} />
        <ellipse cx="70" cy="52" rx="24" ry="27" />
        ${hair ? html`<path d=${hair} />` : null}
      </g>
      <path d="M28 160 C28 138 42 128 70 128 C98 128 112 138 112 160 Z" fill="#14121d" />
      <path d="M28 160 C28 138 42 128 70 128 C98 128 112 138 112 160 Z" fill=${color} opacity=".22" />
      <path d="M28 160 C28 138 42 128 70 128 C98 128 112 138 112 160" fill="none" stroke=${color} strokeOpacity=".9" strokeWidth="2.5" />
      <path d="M40 140 C48 134 58 132 70 132" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="3" strokeLinecap="round" />
    </svg>`;
  }

  /**
   * Surface textures for a table SVG, as filters that grain whatever shape they're applied to: felt (a fine woven
   * nap), leather (the padded rail), wood (the apron and edges) and brass (the trim). Each is noise multiplied into
   * the shape's own fill and clipped to it, so the colours stay the theme's. `id` prefixes the ids (one per table).
   */
  function grain(id, freq, octaves, seed, a, b) {
    return html`<filter id=${id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=${freq} numOctaves=${octaves} seed=${seed} result="n" />
      <feColorMatrix in="n" type="matrix" values=${a + ' 0 0 0 ' + b + ' ' + a + ' 0 0 0 ' + b + ' ' + a + ' 0 0 0 ' + b + ' 0 0 0 0 1'} result="g" />
      <feBlend in="SourceGraphic" in2="g" mode="multiply" result="m" />
      <feComposite in="m" in2="SourceGraphic" operator="in" />
    </filter>`;
  }
  function TextureDefs(props) {
    var p = props.id;
    return html`<g>
      ${grain(p + '-tex-felt', '.75', 3, 4, 1.15, .42)}
      ${grain(p + '-tex-leather', '.22 .26', 4, 9, 1.1, .38)}
      ${grain(p + '-tex-wood', '.0035 .11', 4, 12, 1.5, .12)}
      <linearGradient id=${p + '-brass'} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f6e1a0" /><stop offset=".22" stopColor="#b8892f" /><stop offset=".45" stopColor="#fff1c2" />
        <stop offset=".62" stopColor="#a8792a" /><stop offset=".82" stopColor="#e8c873" /><stop offset="1" stopColor="#8a6220" />
      </linearGradient>
    </g>`;
  }

  /** An open seat: a beveled glass puck hovering over the floor. As a button it presses down when you take the seat. */
  function SeatOrb(props) {
    var inner = html`<span className="orb-glass"><span className="orb-label">${props.canSit ? 'Sit here' : 'Open seat'}</span></span>`;
    return props.canSit
      ? html`<button type="button" className="seat-orb" onClick=${props.onSit}>${inner}</button>`
      : html`<span className="seat-orb idle">${inner}</span>`;
  }

  /** Shadow direction for something on the felt: away from the lamp hanging over the table's centre (cx, cy). */
  function lightFrom(pt, cx, cy, reach) {
    var dx = (pt.x - cx) / reach, dy = (pt.y - cy) / reach;
    return { '--lx': Math.max(-1, Math.min(1, dx)).toFixed(2), '--ly': Math.max(-1, Math.min(1, dy)).toFixed(2) };
  }

  /** The dealer, facing us across the table: vest, white shirt, gold bow tie, lit warm from the lamp above. */
  function Dealer() {
    return html`<svg className="dealer-svg" viewBox="0 0 220 140" aria-hidden="true">
      <defs>
        <linearGradient id="dl-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a2433" /><stop offset="1" stopColor="#0b0a10" /></linearGradient>
        <radialGradient id="dl-h" cx="50%" cy="30%" r="70%"><stop offset="0" stopColor="#4b4256" /><stop offset="1" stopColor="#121018" /></radialGradient>
        <linearGradient id="dl-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd98a" /><stop offset=".55" stopColor="#ffd98a" stopOpacity="0" /></linearGradient>
      </defs>
      <path d="M20 140 C24 100 60 80 110 80 C160 80 196 100 200 140 Z" fill="url(#dl-b)" />
      <path d="M92 82 L110 128 L128 82 Z" fill="#e9e4f2" />
      <path d="M86 84 L110 140 L96 140 L78 88 Z M134 84 L110 140 L124 140 L142 88 Z" fill="#1a1622" />
      <path d="M100 88 L110 94 L120 88 L120 100 L110 94 L100 100 Z" fill="#f5c451" />
      <rect x="99" y="58" width="22" height="28" rx="9" fill="#17141f" />
      <ellipse cx="110" cy="44" rx="27" ry="31" fill="url(#dl-h)" />
      <path d="M83 42 C82 18 98 10 110 10 C124 10 139 18 137 42 C130 30 120 26 110 26 C100 26 90 30 83 42 Z" fill="#0e0c13" />
      <g fill="none" stroke="url(#dl-r)" strokeWidth="2.5"><ellipse cx="110" cy="44" rx="27" ry="31" /><path d="M20 140 C24 100 60 80 110 80 C160 80 196 100 200 140" /></g>
    </svg>`;
  }

  /** The table itself: shadow, padded leather rail, felt, printed arcs, betting spots, chip tray, shoe and discard. */

  window.CasinoKit = { SUIT: SUIT, RANK: RANK, CHIP_VALUES: CHIP_VALUES, Card: Card, Cards: Cards, Chip: Chip, chipStack: chipStack, Stack: Stack, TimerBar: TimerBar,
    LOOKS: LOOKS, Character: Character, SeatOrb: SeatOrb, TextureDefs: TextureDefs, lightFrom: lightFrom, Dealer: Dealer };
})();
