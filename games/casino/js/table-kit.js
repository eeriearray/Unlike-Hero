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

  // ───────────── portraits: the same sixteen regulars, seen from the front ─────────────
  // Each keeps the colour and hair of their seated figure. Flat shapes, two tones of shading, one accent each.
  var SKIN = ['#f0c8a6', '#d9a07a', '#b07650', '#7e4e32'];
  var FACE = {
    fox: { skin: 0, extra: 'freckles' }, tiger: { skin: 2 }, panda: { skin: 0, extra: 'glasses' }, owl: { skin: 1, extra: 'monocle' },
    frog: { skin: 1 }, octopus: { skin: 3, extra: 'earring' }, unicorn: { skin: 0, extra: 'earring' }, dragon: { skin: 2, extra: 'shades' },
    cat: { skin: 1, extra: 'earring' }, wolf: { skin: 0, extra: 'stubble' }, koala: { skin: 3 }, shark: { skin: 2, extra: 'shades' },
    monkey: { skin: 3, extra: 'stubble' }, penguin: { skin: 0, extra: 'moustache' }, lion: { skin: 2, extra: 'stubble' }, robot: { robot: true }
  };
  var FRONT_HAIR = {
    short: 'M19 27 C18 15 25 10 32 10 C39 10 46 15 45 27 C43 21 39 18.5 32 18.5 C25 18.5 21 21 19 27 Z',
    quiff: 'M19 27 C17 14 25 7 34 7.5 C41 8 47 13 45 27 C43 20 40 17 35 16 C31 15.5 27 17 24 19 C21 21 20 24 19 27 Z',
    bun: 'M19 27 C18 15 25 11 32 11 C39 11 46 15 45 27 C43 21 39 19 32 19 C25 19 21 21 19 27 Z M27 8 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0',
    curly: 'M18 29 C15 24 17 18 21 16 C21 11 26 8 30 10 C33 7 38 8 40 11 C44 11 47 15 46 19 C49 22 48 27 46 29 C44 23 40 19.5 32 19.5 C24 19.5 20 23 18 29 Z',
    pony: 'M19 27 C18 15 25 11 32 11 C39 11 46 15 45 27 C43 21 39 19 32 19 C25 19 21 21 19 27 Z M44 20 C51 25 51 38 47 46 C46 38 45 31 43 26 Z',
    mohawk: 'M29 19 C28.5 11 30.5 5 32 3 C33.5 5 35.5 11 35 19 Z',
    bob: 'M18 37 C15 20 22 10 32 10 C42 10 49 20 46 37 C44.5 30 44 23 39 20 C35 18.5 29 18.5 25 20 C20 23 19.5 30 18 37 Z',
    cap: 'M19 22 C19 13 25 9 32 9 C39 9 45 13 45 22 Z',
    beanie: 'M19 23 C19 11 25 7 32 7 C39 7 45 11 45 23 Z',
    tophat: '',
    antenna: ''
  };

  function Portrait(props) {
    var id = props.id, look = LOOKS[id] || ['#c9c3dc', 'short'], color = look[0], hairKey = look[1], face = FACE[id] || { skin: 1 };
    var skin = SKIN[face.skin || 0], uid = 'pt-' + id + (props.tag || '');
    var hair = '#1d1714';
    var eyes = html`<g fill="#24180f"><ellipse cx="27.6" cy="29.5" rx="1.25" ry="1.45" /><ellipse cx="36.4" cy="29.5" rx="1.25" ry="1.45" /></g>
      <path d="M25.6 26.4 Q27.6 25.4 29.6 26.2 M34.4 26.2 Q36.4 25.4 38.4 26.4" stroke="#24180f" strokeWidth=".9" strokeLinecap="round" fill="none" opacity=".75" />
      <path d="M29.8 35.4 Q32 36.8 34.2 35.4" stroke="#7a3b2c" strokeWidth="1" strokeLinecap="round" fill="none" />`;
    var extra = null;
    if (face.extra === 'shades') extra = html`<g><rect x="23.6" y="27.2" width="7.4" height="4.4" rx="1.6" fill="#0d0d10" /><rect x="33" y="27.2" width="7.4" height="4.4" rx="1.6" fill="#0d0d10" /><path d="M31 28.6 H33" stroke="#0d0d10" strokeWidth="1.2" /><path d="M25 28.2 L27.5 28.2" stroke="#fff" strokeOpacity=".35" strokeWidth=".7" /></g>`;
    if (face.extra === 'glasses') extra = html`<g fill="none" stroke="#2a2420" strokeWidth=".9"><circle cx="27.6" cy="29.5" r="3.2" /><circle cx="36.4" cy="29.5" r="3.2" /><path d="M30.8 29.3 H33.2" /></g>`;
    if (face.extra === 'monocle') extra = html`<g fill="none" stroke=${color} strokeWidth=".9"><circle cx="36.4" cy="29.5" r="3.3" /><path d="M39.6 30.5 C41 35 40 40 38 44" strokeWidth=".5" /></g>`;
    if (face.extra === 'earring') extra = html`<circle cx="44.2" cy="33.6" r="1.3" fill=${color} stroke="#fff" strokeOpacity=".4" strokeWidth=".3" />`;
    if (face.extra === 'stubble') extra = html`<path d="M23.5 33 C24.5 39 28 41.5 32 41.5 C36 41.5 39.5 39 40.5 33 C38 37 35 38.4 32 38.4 C29 38.4 26 37 23.5 33 Z" fill=${hair} opacity=".28" />`;
    if (face.extra === 'moustache') extra = html`<path d="M27.6 34.4 C29.4 33 31 33.4 32 34.2 C33 33.4 34.6 33 36.4 34.4 C34.8 35.2 33.2 35 32 34.6 C30.8 35 29.2 35.2 27.6 34.4 Z" fill=${hair} />`;
    if (face.extra === 'freckles') extra = html`<g fill="#b8673f" opacity=".45"><circle cx="25.8" cy="33" r=".5" /><circle cx="27.4" cy="33.8" r=".5" /><circle cx="36.6" cy="33.8" r=".5" /><circle cx="38.2" cy="33" r=".5" /></g>`;

    var head = face.robot
      ? html`<g><rect x="21" y="15" width="22" height="25" rx="6" fill=${'url(#' + uid + 'm)'} /><rect x="24" y="24" width="16" height="7" rx="3.5" fill="#0e1414" />
          <rect x="26" y="26.2" width="4.4" height="2.6" rx="1.3" fill=${color} /><rect x="33.6" y="26.2" width="4.4" height="2.6" rx="1.3" fill=${color} />
          <path d="M28 35.5 H36" stroke="#0e1414" strokeWidth="1.2" strokeLinecap="round" /><path d="M32 15 V8" stroke="#9aa4a6" strokeWidth="1.4" /><circle cx="32" cy="7" r="2.2" fill=${color} />
          <rect x="18.6" y="24" width="2.6" height="7" rx="1" fill="#6c7678" /><rect x="42.8" y="24" width="2.6" height="7" rx="1" fill="#6c7678" /></g>`
      : html`<g>
          <ellipse cx="20.6" cy="30.5" rx="2.2" ry="3" fill=${skin} /><ellipse cx="43.4" cy="30.5" rx="2.2" ry="3" fill=${skin} />
          <path d="M20.5 27 C20.5 16 25.5 11.5 32 11.5 C38.5 11.5 43.5 16 43.5 27 C43.5 36 38.5 42 32 42 C25.5 42 20.5 36 20.5 27 Z" fill=${skin} />
          <path d="M32 11.5 C38.5 11.5 43.5 16 43.5 27 C43.5 36 38.5 42 32 42 C36 39 38.5 34 38.5 27 C38.5 19 36 14 32 11.5 Z" fill="#000" opacity=".08" />
          ${eyes}${extra}
          ${hairKey === 'tophat' ? html`<g><rect x="23" y="2.5" width="18" height="13.5" rx="1.2" fill="#121014" /><rect x="23" y="12" width="18" height="2.6" fill=${color} /><ellipse cx="32" cy="16.2" rx="14" ry="2.6" fill="#121014" /></g>`
            : hairKey === 'cap' ? html`<g><path d=${FRONT_HAIR.cap} fill=${color} /><path d="M17 22.5 Q32 19.5 47 22.5 L46 25 Q32 22.6 18 25 Z" fill=${color} /><path d="M17 22.5 Q32 19.5 47 22.5 L46 25 Q32 22.6 18 25 Z" fill="#000" opacity=".25" /><circle cx="32" cy="9.3" r="1.2" fill="#000" opacity=".3" /></g>`
            : hairKey === 'beanie' ? html`<g><path d=${FRONT_HAIR.beanie} fill=${color} /><rect x="18.6" y="19" width="26.8" height="5.4" rx="2" fill=${color} /><rect x="18.6" y="19" width="26.8" height="5.4" rx="2" fill="#000" opacity=".22" /><circle cx="32" cy="6" r="2.8" fill=${color} /></g>`
            : html`<path d=${FRONT_HAIR[hairKey] || FRONT_HAIR.short} fill=${hair} />`}
        </g>`;
    return html`<svg className="portrait" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id=${uid + 'bg'} cx="50%" cy="30%" r="80%"><stop offset="0" stopColor=${color} stopOpacity=".42" /><stop offset="1" stopColor="#0d0b09" stopOpacity="1" /></radialGradient>
        <linearGradient id=${uid + 'm'} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e6ecee" /><stop offset="1" stopColor="#7d878a" /></linearGradient>
      </defs>
      <rect width="64" height="64" fill=${'url(#' + uid + 'bg)'} />
      <path d="M27.5 38 H36.5 V46 H27.5 Z" fill=${face.robot ? '#5b6567' : skin} />
      <path d="M27.5 41 Q32 44 36.5 41 V43 Q32 46 27.5 43 Z" fill="#000" opacity=".15" />
      <path d="M5 64 C6 52 14 45.5 27 44.5 L32 53 L37 44.5 C50 45.5 58 52 59 64 Z" fill="#17130f" />
      <path d="M27 44.5 L32 53 L37 44.5 L35 44 L32 49 L29 44 Z" fill="#efe9de" />
      <path d="M27 44.5 L24 47 L29.5 64 L32 53 Z M37 44.5 L40 47 L34.5 64 L32 53 Z" fill="#241d17" />
      <path d="M28.6 45.6 L32 47.6 L35.4 45.6 L35.4 49 L32 47.6 L28.6 49 Z" fill=${color} />
      ${head}
    </svg>`;
  }

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
    LOOKS: LOOKS, Portrait: Portrait, Character: Character, SeatOrb: SeatOrb, TextureDefs: TextureDefs, lightFrom: lightFrom, Dealer: Dealer };
})();
