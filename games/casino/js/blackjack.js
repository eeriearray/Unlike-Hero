/* Neon Casino — the blackjack table. Draws the table state the server sends (games/casino/server/games/blackjack.mjs)
   and sends intents: sit, bet, hit, stand, double, split. It never decides a card, a total that matters, or a payout. */
(function () {
  'use strict';
  var R = React, useState = R.useState, useEffect = R.useEffect, useRef = R.useRef;
  var UI = window.CasinoUI, html = UI.html, cx = UI.cx, money = UI.money, signed = UI.signed, Button = UI.Button, Avatar = UI.Avatar, useNow = UI.useNow;

  var SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
  var RANK = { T: '10' };
  var CHIP_VALUES = [25, 100, 500, 1000, 5000, 25000, 100000];
  var RESULT = { blackjack: 'Blackjack', win: 'Win', push: 'Push', lose: 'Lose', bust: 'Bust' };

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

  function Chip(props) {
    return html`<span className=${'chip chip-' + props.value} aria-hidden="true">${props.value >= 1000 ? props.value / 1000 + 'K' : props.value}</span>`;
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
      <span className="stack-chips">${chipStack(props.amount).map(function (v, i) { return html`<${Chip} key=${i} value=${v} />`; })}</span>
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

  function Hand(props) {
    var h = props.hand;
    return html`<div className=${cx('hand', props.active && 'active', h.result && 'res-' + h.result)}>
      <${Cards} cards=${h.cards} />
      <div className="hand-meta">
        <span className=${cx('total', h.total > 21 && 'bust')}>${h.soft && h.total < 21 && !h.result ? h.total - 10 + '/' + h.total : h.total}</span>
        ${h.doubled ? html`<span className="tag">Doubled</span>` : null}
        ${h.result ? html`<span className=${'tag result result-' + h.result}>${RESULT[h.result]}</span>` : null}
      </div>
      <${Stack} amount=${h.bet} />
    </div>`;
  }

  // ───────────── the table scene ─────────────
  // One 1000×700 coordinate space shared by the SVG table and the HTML layered on it (cards, chips, plaques), so
  // everything lines up at any width. The table is a classic half-moon: dealer along the straight edge at the top,
  // five spots around the curve. Seat 0 is first base — the dealer's left, the right-hand end from where we sit.
  var W = 1000, H = 700, CX = 500, CY = 118, RIM = 440;
  var SEAT_DEG = [32, 61, 90, 119, 148];
  var SPOT_R = 292, CHAR_R = RIM + 36;
  function polar(r, deg) { var a = deg * Math.PI / 180; return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }; }
  function at(pt) { return { left: (pt.x / W) * 100 + '%', top: (pt.y / H) * 100 + '%' }; }
  function arcPath(r, from, to) { var a = polar(r, from), b = polar(r, to); return 'M' + a.x + ' ' + a.y + ' A' + r + ' ' + r + ' 0 0 0 ' + b.x + ' ' + b.y; }
  function dShape(r, top) { return 'M' + (CX - r) + ' ' + (CY - top) + ' L' + (CX + r) + ' ' + (CY - top) + ' L' + (CX + r) + ' ' + CY + ' A' + r + ' ' + r + ' 0 0 1 ' + (CX - r) + ' ' + CY + ' Z'; }

  // Each avatar gets a rim-light colour and a silhouette (hair or hat), so players are easy to tell apart from behind.
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
      <path d="M28 160 C28 138 42 128 70 128 C98 128 112 138 112 160 Z" fill="#6a3a22" />
      <path d="M28 160 C28 138 42 128 70 128 C98 128 112 138 112 160" fill="none" stroke="#e0b866" strokeOpacity=".8" strokeWidth="2" />
      <path d="M40 140 C48 134 58 132 70 132" fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="3" strokeLinecap="round" />
    </svg>`;
  }

  function EmptyStool() {
    return html`<svg className="character-svg empty" viewBox="0 0 140 160" aria-hidden="true">
      <ellipse cx="70" cy="154" rx="50" ry="6" fill="#000" opacity=".5" />
      <rect x="66" y="128" width="8" height="30" fill="#3a2a1a" />
      <ellipse cx="70" cy="128" rx="40" ry="12" fill="#6a3a22" stroke="#e0b866" strokeOpacity=".7" strokeWidth="2" />
      <ellipse cx="64" cy="124" rx="22" ry="4" fill="#fff" opacity=".12" />
    </svg>`;
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
  function TableSvg(props) {
    var spots = SEAT_DEG.map(function (d) { return polar(SPOT_R, d); });
    var tray = [];
    var trayColors = ['#2c2a36', '#8b3fd1', '#c9971c', '#d6323f', '#23a35d', '#2f6fe0'];
    for (var i = 0; i < 6; i++) tray.push(html`<g key=${i}><rect x=${404 + i * 32} y="126" width="26" height="18" rx="3" fill=${trayColors[i]} /><rect x=${404 + i * 32} y="126" width="26" height="4" rx="2" fill="#fff" opacity=".35" /></g>`);
    return html`<svg className="bj-svg" viewBox=${'0 0 ' + W + ' ' + H} aria-hidden="true">
      <defs>
        <radialGradient id="bj-felt" cx="50%" cy="10%" r="95%"><stop offset="0" style=${{ stopColor: 'var(--felt-hi)' }} /><stop offset=".55" style=${{ stopColor: 'var(--felt)' }} /><stop offset="1" style=${{ stopColor: 'var(--felt-lo)' }} /></radialGradient>
        <linearGradient id="bj-rail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a2a19" /><stop offset=".5" stopColor="#2b170d" /><stop offset="1" stopColor="#140a05" /></linearGradient>
        <radialGradient id="bj-lamp" cx="50%" cy="0%" r="75%"><stop offset="0" stopColor="#fff3d6" stopOpacity=".16" /><stop offset="1" stopColor="#fff3d6" stopOpacity="0" /></radialGradient>
        <filter id="bj-shadow" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#000" floodOpacity=".7" /></filter>
      </defs>
      <ellipse cx=${CX} cy="40" rx="560" ry="420" fill="url(#bj-lamp)" />
      <path d=${dShape(RIM + 34, 18)} fill="url(#bj-rail)" filter="url(#bj-shadow)" />
      <path d=${dShape(RIM + 34, 18)} fill="none" stroke="#6b4128" strokeWidth="2" strokeOpacity=".7" />
      <path d=${dShape(RIM + 20, 12)} fill="none" stroke="#000" strokeOpacity=".35" strokeWidth="6" />
      <path d=${dShape(RIM, 6)} fill="#c9a45c" />
      <path d=${dShape(RIM - 4, 3)} fill="url(#bj-felt)" />
      <path d=${dShape(RIM - 4, 3)} fill="url(#bj-lamp)" />
      <path id="bj-arc1" d=${arcPath(205, 152, 28)} fill="none" />
      <path id="bj-arc2" d=${arcPath(172, 146, 34)} fill="none" />
      <path d=${arcPath(232, 150, 30)} fill="none" stroke="var(--felt-ink)" strokeOpacity=".5" strokeWidth="1.5" />
      <text className="felt-print big"><textPath href="#bj-arc1" startOffset="50%" textAnchor="middle">BLACKJACK PAYS 3 TO 2</textPath></text>
      <text className="felt-print"><textPath href="#bj-arc2" startOffset="50%" textAnchor="middle">DEALER MUST STAND ON ALL 17s</textPath></text>
      <rect x="396" y="120" width="208" height="30" rx="6" fill="#0d0a08" stroke="#c9a45c" strokeOpacity=".5" />
      ${tray}
      <g transform="translate(812 138) rotate(-8)"><rect width="78" height="52" rx="7" fill="#1a1410" stroke="#c9a45c" strokeOpacity=".55" /><rect x="8" y="8" width="62" height="36" rx="4" fill="#2b1f52" /><rect x="10" y="10" width="58" height="10" rx="2" fill="#f4f0ff" opacity=".85" /></g>
      <g transform="translate(150 150) rotate(8)"><rect width="70" height="44" rx="7" fill="#1a1410" stroke="#c9a45c" strokeOpacity=".4" /><rect x="8" y="8" width="54" height="28" rx="3" fill="#0e0c12" /></g>
      ${spots.map(function (pt, i) {
        var mine = props.seats[i] === props.you, turn = props.turnSeat === i;
        return html`<g key=${i}>
          <circle cx=${pt.x} cy=${pt.y} r="50" fill="var(--felt-lo)" fillOpacity=".35" stroke=${turn ? '#f5c451' : mine ? '#f5c451' : 'var(--felt-ink)'} strokeOpacity=${turn ? 1 : mine ? .7 : .55} strokeWidth=${turn ? 3.5 : 2} />
          <circle cx=${pt.x} cy=${pt.y} r="42" fill="none" stroke="var(--felt-ink)" strokeOpacity=".25" strokeDasharray="4 6" />
        </g>`;
      })}
    </svg>`;
  }

  function SpotHands(props) {
    var st = props.state, r = st.round, pid = props.playerId;
    if (!pid) return null;
    var hands = r ? r.hands.map(function (h, i) { return { h: h, i: i }; }).filter(function (x) { return x.h.owner === pid; }) : [];
    var lastHands = !r && st.last ? st.last.hands.filter(function (h) { return h.owner === pid; }).map(function (h, i) { return { h: h, i: 'l' + i }; }) : [];
    var list = hands.length ? hands : lastHands;
    var bet = r && r.bets[pid];
    return html`<div className=${cx('spot', list.length > 1 && 'multi')} style=${at(polar(SPOT_R, SEAT_DEG[props.seat]))}>
      ${list.length ? list.map(function (x) { return html`<${Hand} key=${x.i} hand=${x.h} active=${r && r.turn === x.i} />`; })
        : bet ? html`<${Stack} amount=${bet} />` : null}
    </div>`;
  }

  function SeatFigure(props) {
    var v = props.view, st = props.state, pid = props.playerId, r = st.round, i = props.seat;
    var p = pid && UI.byId(v, pid);
    var deg = SEAT_DEG[i];
    var tilt = (deg - 90) * 0.4;
    var pos = at(polar(CHAR_R, deg));
    var onTurn = p && r && r.turn != null && r.hands[r.turn] && r.hands[r.turn].owner === pid;
    if (!p) {
      return html`<div className="figure empty" style=${pos}>
        <div className="figure-body" style=${{ transform: 'rotate(' + tilt + 'deg)' }}><${EmptyStool} /></div>
        ${props.canSit ? html`<button type="button" className="seat-sit" onClick=${props.onSit}>Sit here</button>` : null}
      </div>`;
    }
    return html`<div className=${cx('figure', pid === v.you && 'me', onTurn && 'on-turn', !p.connected && 'offline')} style=${pos}>
      <div className="figure-body" style=${{ transform: 'rotate(' + tilt + 'deg)' }}><${Character} avatar=${p.avatar} seat=${i} /></div>
      <div className="plaque">
        <span className="plaque-name"><span aria-hidden="true">${UI.AVATARS[p.avatar]}</span> ${p.name}${pid === v.you ? html` <em>you</em>` : null}</span>
        <span className="plaque-cash num">${money(p.cash)}</span>
        ${onTurn ? html`<${TimerBar} timer=${st.timer} now=${props.now} />` : null}
      </div>
    </div>`;
  }

  function statusLine(v, st, now) {
    var r = st.round, t = st.timer;
    var secs = t ? Math.ceil((t.endsAt ? Math.max(0, t.endsAt - now) : t.remainingMs || 0) / 1000) : null;
    if (v.session.phase === 'paused') return 'Paused by the host';
    if (st.phase === 'idle') return 'Place your bets';
    if (st.phase === 'betting') return 'Dealing in ' + secs + 's — get your bets down';
    if (st.phase === 'playing' && r && r.turn != null) {
      var p = UI.byId(v, r.hands[r.turn].owner);
      return (r.hands[r.turn].owner === v.you ? 'Your move' : (p ? p.name : 'Someone') + '’s move') + ' · ' + secs + 's';
    }
    if (st.phase === 'results' && st.last) {
      if (r && r.dealerPeek) return 'Dealer has blackjack';
      return st.last.dealerTotal > 21 ? 'Dealer busts with ' + st.last.dealerTotal : 'Dealer stands on ' + st.last.dealerTotal;
    }
    return '';
  }

  function Rules(props) {
    var r = props.rules, t = props.table;
    return html`<div className="rules-card">
      <h3>How this table plays</h3>
      <ul>
        <li>Bets ${money(t.minBet)} to ${money(t.maxBet)}. ${r.decks} decks, reshuffled when three quarters are dealt.</li>
        <li>Blackjack pays ${r.blackjackPays}. Other wins pay 1:1; a tie is a push and your bet comes back.</li>
        <li>The dealer checks for blackjack with an ace or ten showing, then draws to 17 and stands on ${r.dealerStandsOn}.</li>
        <li>Double on any first two cards (one more card). Split pairs up to ${r.maxHands} hands; split aces get one card each, and 21 after a split pays 1:1.</li>
        <li>Betting closes ${r.bettingSec}s after the first bet. You get ${r.turnSec}s per move; if time runs out, your hand stands.</li>
        <li>Leaving the table or losing connection never takes a bet back: open hands stand.</li>
      </ul>
    </div>`;
  }

  function BlackjackTable(props) {
    var v = props.view, table = props.table, st = table.state, r = st.round, me = UI.byId(v, v.you), you = st.you;
    var acc = v.me && v.me.account;
    var now = useNow(v, 250);
    var lastBet = useRef(UI.store.get('bj.lastBet', 0));
    var p = useState(0), pending = p[0], setPending = p[1];
    var rl = useState(false), showRules = rl[0], setRules = rl[1];

    useEffect(function () { if (!you.canBet) setPending(0); }, [you.canBet]);
    var chips = CHIP_VALUES.filter(function (c) { return c <= table.maxBet && c >= table.minBet / 10; }).slice(-5);
    var cap = Math.min(table.maxBet, acc ? acc.cash : 0);
    function add(c) { setPending(function (x) { return Math.min(cap, x + c); }); }
    function placeBet(amount) {
      return props.send({ type: 'play', tableId: table.id, action: 'bet', amount: amount }).then(function (res) {
        if (res.ok) { lastBet.current = amount; UI.store.set('bj.lastBet', amount); setPending(0); }
      });
    }
    function move(action) { return props.send({ type: 'play', tableId: table.id, action: action }); }
    var current = r && r.turn != null ? r.hands[r.turn] : null;
    var mySummary = st.last && st.last.players[v.you];
    var myLastHands = st.last ? st.last.hands.filter(function (h) { return h.owner === v.you; }) : [];

    var dock;
    if (!you.seated) {
      var blocked = me && me.status !== 'active';
      dock = html`<div className="dock-row">
        <span className="muted">${blocked ? (me.status === 'bankrupt' ? 'Bankrupt players can watch the table.' : 'You’re watching this session.') : 'You’re watching. Take a seat to play.'}</span>
        ${!blocked ? html`<${Button} kind="primary" onClick=${props.onSit} disabled=${st.seats.indexOf(null) < 0}>${st.seats.indexOf(null) < 0 ? 'Table full' : 'Take a seat'}</${Button}>` : null}
      </div>`;
    } else if (you.moves.length) {
      dock = html`<div className="dock-actions">
        <${Button} kind="primary" className="act" onClick=${function () { return move('hit'); }}>Hit</${Button}>
        <${Button} className="act" onClick=${function () { return move('stand'); }}>Stand</${Button}>
        ${you.moves.indexOf('double') >= 0 ? html`<${Button} className="act" onClick=${function () { return move('double'); }}>Double <small>+${money(current.bet)}</small></${Button}>` : null}
        ${you.moves.indexOf('split') >= 0 ? html`<${Button} className="act" onClick=${function () { return move('split'); }}>Split <small>+${money(current.bet)}</small></${Button}>` : null}
      </div>`;
    } else if (you.canBet) {
      dock = html`<div className="dock-bet">
        <div className="chip-tray" role="group" aria-label="Add chips">
          ${chips.map(function (c) { return html`<button key=${c} type="button" className="chip-btn" disabled=${pending + c > cap && pending >= cap} onClick=${function () { add(c); }} aria-label=${'Add ' + money(c)}><${Chip} value=${c} /></button>`; })}
        </div>
        <div className="bet-amount"><span className="eyebrow">Your bet</span><b className="num">${money(pending)}</b></div>
        <div className="row">
          <${Button} kind="ghost" onClick=${function () { setPending(0); }} disabled=${!pending}>Clear</${Button}>
          ${lastBet.current >= table.minBet && lastBet.current <= cap ? html`<${Button} kind="ghost" onClick=${function () { return placeBet(lastBet.current); }}>Rebet ${money(lastBet.current)}</${Button}>` : null}
          <${Button} kind="primary" onClick=${function () { return placeBet(pending); }} disabled=${pending < table.minBet}>${pending < table.minBet ? 'Min ' + money(table.minBet) : 'Bet ' + money(pending)}</${Button}>
        </div>
        ${acc && acc.cash < table.minBet ? html`<p className="muted small">You need ${money(table.minBet)} to bet here.</p>` : null}
      </div>`;
    } else {
      dock = html`<div className="dock-row"><span className="muted">${v.session.phase === 'paused' ? 'The host paused the session.' : st.phase === 'results' ? 'Next round in a moment.' : r && r.bets[v.you] ? (st.phase === 'betting' ? 'Bet placed. Waiting for the deal…' : 'Waiting for your turn…') : 'Sitting out this round.'}</span></div>`;
    }

    var turnSeat = r && r.turn != null && r.hands[r.turn] ? st.seats.indexOf(r.hands[r.turn].owner) : -1;
    var dealerCards = r ? r.dealer : st.last ? st.last.dealer : [];
    var dealerTotal = r ? r.dealerTotal : st.last ? st.last.dealerTotal : null;
    return html`<section className=${cx('bj', 'game-blackjack', table.highRoller && 'high-roller')} aria-label=${table.name}>
      <div className="table-bar">
        <button type="button" className="btn btn-ghost" onClick=${props.onBack}>← Casino floor</button>
        <div className="table-bar-title"><h2>${table.name}</h2>${table.highRoller ? html`<span className="tag gold">VIP</span>` : null}<span className="muted small num">${money(table.minBet)} – ${money(table.maxBet)}</span></div>
        <div className="row">
          <button type="button" className="btn btn-ghost" aria-expanded=${showRules} onClick=${function () { setRules(!showRules); }}>Rules & payouts</button>
          ${you.seated && !you.moves.length ? html`<button type="button" className="btn btn-ghost" onClick=${props.onStand}>Stand up</button>` : null}
        </div>
      </div>
      ${showRules ? html`<${Rules} rules=${st.rules} table=${table} />` : null}
      <div className="bj-scene">
        <div className="bj-dealer" style=${at({ x: CX, y: 60 })}><${Dealer} /></div>
        <${TableSvg} seats=${st.seats} you=${v.you} turnSeat=${turnSeat} />
        <div className="dealer-hand" style=${at({ x: CX, y: 200 })}>
          <${Cards} cards=${dealerCards} />
          ${dealerTotal != null ? html`<span className=${cx('total', dealerTotal > 21 && 'bust')}>${dealerTotal}</span>` : null}
        </div>
        <div className="shoe-tag" style=${at({ x: 851, y: 214 })} title="Cards left in the shoe">Shoe ${Math.round((st.shoe.remaining / st.shoe.size) * 100) || 100}%</div>
        <p className="felt-status" style=${at({ x: CX, y: 342 })} aria-live="polite">${statusLine(v, st, now)}</p>
        ${st.seats.map(function (pid, i) { return html`<${SpotHands} key=${'h' + i} seat=${i} state=${st} playerId=${pid} />`; })}
        ${st.seats.map(function (pid, i) {
          return html`<${SeatFigure} key=${'f' + i} seat=${i} view=${v} state=${st} playerId=${pid} now=${now} canSit=${!you.seated && me && me.status === 'active'} onSit=${props.onSit} />`;
        })}
      </div>
      ${mySummary && st.phase !== 'playing' ? html`<div className=${cx('round-summary', mySummary.net > 0 && 'up', mySummary.net < 0 && 'down')} role="status">
        <span className="eyebrow">Last round</span>
        <span>Bet <b className="num">${money(mySummary.staked)}</b>${myLastHands.some(function (h) { return h.doubled; }) ? ' · doubled' : ''}${myLastHands.length > 1 ? ' · ' + myLastHands.length + ' hands' : ''}</span>
        <span>${myLastHands.map(function (h) { return RESULT[h.result]; }).join(' / ')}</span>
        <b className="num">${mySummary.net ? signed(mySummary.net) : 'Even'}</b>
        <span className="muted">Cash now <b className="num">${money(mySummary.cash)}</b></span>
      </div>` : null}
      <div className="dock">
        ${dock}
        ${you.moves.length ? html`<${TimerBar} timer=${st.timer} now=${now} />` : null}
      </div>
    </section>`;
  }

  window.CasinoTables = window.CasinoTables || {};
  window.CasinoTables.blackjack = BlackjackTable;
})();
