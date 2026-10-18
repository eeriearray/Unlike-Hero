/* Neon Casino — the roulette table: a European wheel and the betting layout. The server picks the number when betting
   closes; this page only animates the wheel to it. Every chip is one bet the server validates and can take back. */
(function () {
  'use strict';
  var R = React, useState = R.useState, useEffect = R.useEffect, useRef = R.useRef;
  var UI = window.CasinoUI, html = UI.html, cx = UI.cx, money = UI.money, signed = UI.signed, Button = UI.Button, useNow = UI.useNow;
  var K = window.CasinoKit, Chip = K.Chip, TimerBar = K.TimerBar;

  var WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  var RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  var STEP = 360 / 37;
  function color(n) { return n === 0 ? 'green' : RED.indexOf(n) >= 0 ? 'red' : 'black'; }
  function spotKey(s) { return s.type + ':' + (s.key || (s.numbers || []).join('-')); }
  var NAMES = { straight: 'Straight up', split: 'Split', street: 'Street', trio: 'Trio (0-1-2 / 0-2-3)', corner: 'Corner', sixline: 'Six line', dozen: 'Dozen', column: 'Column', red: 'Red / Black', odd: 'Odd / Even', low: '1–18 / 19–36' };

  // ───────────── the wheel ─────────────
  // The rotor (numbers ring, frets and pockets) spins clockwise; the ball is launched the other way round the track
  // on the bowl. Rolling friction bleeds its speed off exponentially until it can't hold the track, it drops, rattles
  // across the deflectors and the pocket frets, then sits in the winning pocket and rides the rotor as that slows too.
  // The server has already picked the number; the physics only decides how the ball gets there.
  var TRACK_R = 94.5, POCKET_R = 73, BALL_R = 3.4;
  var DROP = .6, LOCK = .86;                                  // fractions of the spin: ball leaves the track / sits in the pocket
  function smooth(x) { return x * x * (3 - 2 * x); }

  function Wheel(props) {
    var r = props.round, spinning = props.phase === 'spinning';
    var rotorEl = useRef(null), ballEl = useRef(null), raf = useRef(0);
    var wheelAt = useRef(0), seen = useRef(null);
    var st = useState(true), settled = st[0], setSettled = st[1];

    function place(w, angle, rad, show) {
      if (rotorEl.current) rotorEl.current.style.transform = 'rotate(' + w.toFixed(2) + 'deg)';
      var b = ballEl.current; if (!b) return;
      var a = angle * Math.PI / 180;
      b.setAttribute('transform', 'translate(' + (100 + rad * Math.sin(a)).toFixed(2) + ' ' + (100 - rad * Math.cos(a)).toFixed(2) + ')');
      b.style.opacity = show ? 1 : 0;
    }

    useEffect(function () {
      if (!r) { place(wheelAt.current, 0, TRACK_R, false); return; }
      if (r.result == null || seen.current === r.id) return;
      seen.current = r.id;
      var pocket = WHEEL.indexOf(r.result) * STEP;                // the pocket's angle on the rotor
      var w0 = wheelAt.current;
      var land = ((-pocket - w0) % 360 + 360) % 360;              // extra turn that brings that pocket to the top
      var wf = w0 + 360 * 3 + land;
      wheelAt.current = wf;
      var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!spinning || reduce) { place(wf, wf + pocket, POCKET_R, true); setSettled(true); return; }   // arrived mid-results: show where it landed

      setSettled(false);
      var D = Math.max(2.5, (props.spinSec || 7) - 0.4) * 1000, t0 = performance.now();
      var b0 = Math.random() * 360, turns = 7 + Math.random() * 2;
      var K = 3.4, norm = 1 - Math.exp(-K), A = 360 * turns;
      // rotor: launched by the croupier, then a long, slow coast down
      function wheel(u) { return w0 + (wf - w0) * (1 - Math.pow(1 - u, 2.2)); }
      // ball on the track: v(t) = v0·e^(−Kt), so angle = v0/K·(1 − e^(−Kt)); it travels anticlockwise
      function free(u) { return b0 - A * (1 - Math.exp(-K * u)) / norm; }
      // the winning pocket, counted to the turn nearest the ball when it drops so it never whips round to get there
      var wrap = Math.round((free(DROP) - (wheel(DROP) + pocket)) / 360) * 360;
      function inPocket(u) { return wheel(u) + pocket + wrap; }

      function frame(now) {
        var u = Math.min(1, (now - t0) / D), ang, rad;
        if (u < DROP) { ang = free(u); rad = TRACK_R; }
        else if (u < LOCK) {
          var p = (u - DROP) / (LOCK - DROP), e = smooth(p), damp = (1 - p) * (1 - p);
          ang = free(u) * (1 - e) + inPocket(u) * e + Math.sin(p * Math.PI * 4) * 7 * damp;      // knocked sideways by deflectors and frets
          rad = Math.min(TRACK_R, POCKET_R + (TRACK_R - POCKET_R) * (1 - e) + Math.abs(Math.sin(p * Math.PI * 4.5)) * 7 * damp);   // hops that die away
        } else { ang = inPocket(u); rad = POCKET_R + Math.abs(Math.sin((u - LOCK) * 40)) * .6 * (1 - u); }
        place(wheel(u), ang, rad, true);
        if (u < 1) raf.current = requestAnimationFrame(frame); else setSettled(true);
      }
      place(w0, b0, TRACK_R, true);
      raf.current = requestAnimationFrame(frame);
      return function () { cancelAnimationFrame(raf.current); };
    }, [r && r.id, r && r.result]);

    var pockets = WHEEL.map(function (n, i) {
      var a0 = (i - 0.5) * STEP, a1 = (i + 0.5) * STEP;
      var p = function (a, rad) { var t = (a - 90) * Math.PI / 180; return (100 + rad * Math.cos(t)).toFixed(2) + ' ' + (100 + rad * Math.sin(t)).toFixed(2); };
      var fill = n === 0 ? '#1f8a55' : color(n) === 'red' ? '#b3243a' : '#16130f';
      var tp = (i * STEP - 90) * Math.PI / 180, tx = 100 + 85 * Math.cos(tp), ty = 100 + 85 * Math.sin(tp);
      return html`<g key=${n}>
        <path d=${'M' + p(a0, 90) + ' A90 90 0 0 1 ' + p(a1, 90) + ' L' + p(a1, 80) + ' A80 80 0 0 0 ' + p(a0, 80) + ' Z'} fill=${fill} stroke="#d8b46a" strokeWidth=".5" />
        <path d=${'M' + p(a0, 80) + ' A80 80 0 0 1 ' + p(a1, 80) + ' L' + p(a1, 66) + ' A66 66 0 0 0 ' + p(a0, 66) + ' Z'} fill=${fill} />
        <path d=${'M' + p(a0, 80) + ' L' + p(a0, 66)} stroke="#e6c47a" strokeWidth="1.1" />
        <text x=${tx} y=${ty} transform=${'rotate(' + i * STEP + ' ' + tx + ' ' + ty + ')'} className="wheel-num">${n}</text>
      </g>`;
    });
    var landed = r && r.result != null && (props.phase === 'results' || settled);
    // A sunken bowl seen from the player's chair: the wooden rim on top, the bowl wall stepping down to the spinning
    // rotor, and the turret rising out of its centre. The rotor SVG still does all the spinning.
    return html`<div className="wheel-wrap">
      <div className="wheel-3d">
        <div className="wheel-shadow" aria-hidden="true"></div>
        <div className="wheel-wall w3" aria-hidden="true"></div>
        <div className="wheel-wall w2" aria-hidden="true"></div>
        <div className="wheel-wall w1" aria-hidden="true"></div>
        <div className="wheel-rim" aria-hidden="true"></div>
        <div className="wheel-pointer" aria-hidden="true"></div>
      <svg className="wheel" viewBox="0 0 200 200" role="img" aria-label=${landed ? 'The ball landed on ' + r.result : 'Roulette wheel'}>
        <defs>
          <radialGradient id="rw-bowl" cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="#5a3a22" /><stop offset=".8" stopColor="#3a2414" /><stop offset="1" stopColor="#1c0f08" /></radialGradient>
          <radialGradient id="rw-track" cx="50%" cy="50%" r="50%"><stop offset=".88" stopColor="#2a1910" /><stop offset=".95" stopColor="#6e4a2c" /><stop offset="1" stopColor="#2a1910" /></radialGradient>
          <radialGradient id="rw-cone" cx="45%" cy="35%" r="70%"><stop offset="0" stopColor="#f3d27a" /><stop offset=".5" stopColor="#a87a2a" /><stop offset="1" stopColor="#3a2610" /></radialGradient>
          <radialGradient id="rw-ball" cx="35%" cy="30%" r="70%"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#e9e6ee" /><stop offset="1" stopColor="#8d899a" /></radialGradient>
        </defs>
        <circle cx="100" cy="100" r="99" fill="url(#rw-track)" />
        <circle cx="100" cy="100" r="98" fill="none" stroke="#000" strokeOpacity=".5" strokeWidth="3" />
        <circle cx="100" cy="100" r="91" fill="#1a0f08" />
        ${[0, 1, 2, 3, 4, 5, 6, 7].map(function (k) { return html`<rect key=${'d' + k} x="97.2" y="7.5" width="5.6" height="2.6" rx="1" fill="#e6c47a" opacity=".85" transform=${'rotate(' + (k * 45 + 22.5) + ' 100 100)'} />`; })}
        <g className="wheel-rotor" ref=${rotorEl}>
          ${pockets}
          <circle cx="100" cy="100" r="66" fill="#2a1a10" stroke="#d8b46a" strokeWidth="1" />
          <circle cx="100" cy="100" r="44" fill="url(#rw-cone)" />
          ${[0, 1, 2, 3].map(function (k) { return html`<rect key=${k} x="97" y="58" width="6" height="84" rx="3" fill="#e9c66e" transform=${'rotate(' + k * 45 + ' 100 100)'} />`; })}
          <circle cx="100" cy="100" r="9" fill="#f6dc8e" stroke="#7a5420" />
        </g>
        <g className="wheel-ball" ref=${ballEl} style=${{ opacity: 0 }}>
          <ellipse cx="1" cy="1.6" rx=${BALL_R} ry=${BALL_R * .8} fill="#000" opacity=".45" />
          <circle r=${BALL_R} fill="url(#rw-ball)" />
        </g>
      </svg>
        <div className="wheel-turret" aria-hidden="true"><span className="turret-dome"></span><span className="turret-post"></span><span className="turret-knob"></span></div>
      </div>
      ${landed ? html`<div className=${'wheel-result ' + color(r.result)}><b className="num">${r.result}</b><span>${color(r.result)}</span></div>` : null}
    </div>`;
  }

  // ───────────── the betting layout ─────────────
  function Spot(props) {
    var mine = props.chips[spotKey(props.spot)];
    var win = props.winning != null && props.spot.type === 'straight' && props.spot.numbers[0] === props.winning;
    return html`<button type="button" className=${cx('spot-hit', props.kind, props.className, mine && mine.mine && 'has-mine', mine && mine.others && !mine.mine && 'has-others', props.resultPhase && mine && (mine.won ? 'won' : 'lost'))}
      style=${props.style} disabled=${!props.canBet} onClick=${function () { props.onBet(props.spot); }} aria-label=${props.label}
      title=${props.label + (mine ? ' — ' + money(mine.mine || mine.others) : '')}>
      ${props.children}
      ${mine && mine.mine ? html`<span className="spot-chip" style=${{ '--n': spotStack(mine.mine).length }}>${spotStack(mine.mine).map(function (c, i) { return html`<${Chip} key=${i} value=${c} z=${i} />`; })}<b className="num">${short(mine.mine)}</b></span>`
        : mine && mine.others ? html`<span className="spot-others" aria-hidden="true"></span>` : null}
      ${win ? html`<span className="spot-win" aria-hidden="true"></span>` : null}
    </button>`;
  }
  function short(n) { return n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'K' : String(n); }
  function spotStack(n) { var s = K.chipStack(n); return s.length ? s : [chipFace(n)]; }
  function chipFace(n) { var v = K.CHIP_VALUES.filter(function (c) { return c <= n; }); return v.length ? v[v.length - 1] : K.CHIP_VALUES[0]; }

  function Layout(props) {
    var cells = [], hot = [];
    var common = { chips: props.chips, canBet: props.canBet, onBet: props.onBet, winning: props.winning, resultPhase: props.resultPhase };
    for (var col = 0; col < 12; col++) {
      for (var row = 0; row < 3; row++) {
        var n = col * 3 + (3 - row);                       // top row 3, 6, 9…; bottom row 1, 4, 7…
        var gr = { gridColumn: col + 2, gridRow: row + 1 };
        cells.push(html`<${Spot} key=${'n' + n} ...${common} kind=${'num ' + color(n)} style=${gr} spot=${{ type: 'straight', numbers: [n] }} label=${'Straight up ' + n}><span className="num-label">${n}</span></${Spot}>`);
        // Hotspots on the cell's edges and corners for inside bets that cover several numbers.
        var edges = [];
        if (col < 11) edges.push({ cls: 'e-right', spot: { type: 'split', numbers: [n, n + 3] } });
        if (row > 0) edges.push({ cls: 'e-top', spot: { type: 'split', numbers: [n, n + 1] } });
        if (row > 0 && col < 11) edges.push({ cls: 'c-top-right', spot: { type: 'corner', numbers: [n, n + 1, n + 3, n + 4] } });
        if (row === 2) edges.push({ cls: 'e-bottom', spot: { type: 'street', numbers: [n, n + 1, n + 2] } });
        if (row === 2 && col < 11) edges.push({ cls: 'c-bottom-right', spot: { type: 'sixline', numbers: [n, n + 1, n + 2, n + 3, n + 4, n + 5] } });
        if (col === 0) edges.push({ cls: 'e-left', spot: { type: 'split', numbers: [0, n] } });
        if (col === 0 && row > 0) edges.push({ cls: 'c-top-left', spot: { type: 'trio', numbers: n === 2 ? [0, 1, 2] : [0, 2, 3] } });
        hot.push(html`<div key=${'h' + n} className="hot-cell" style=${gr}>${edges.map(function (e) {
          return html`<${Spot} key=${e.cls} ...${common} kind="edge" className=${e.cls} spot=${e.spot} label=${NAMES[e.spot.type] + ' ' + e.spot.numbers.join('-')} />`;
        })}</div>`);
      }
    }
    var outside = [
      [{ type: 'low' }, '1–18'], [{ type: 'even' }, 'Even'], [{ type: 'red' }, html`<span className="diamond red"></span>`], [{ type: 'black' }, html`<span className="diamond black"></span>`], [{ type: 'odd' }, 'Odd'], [{ type: 'high' }, '19–36'],
    ];
    return html`<div className="layout" role="group" aria-label="Betting layout">
      <${Spot} ...${common} kind="num green zero" style=${{ gridColumn: 1, gridRow: '1 / span 3' }} spot=${{ type: 'straight', numbers: [0] }} label="Straight up 0"><span className="num-label">0</span></${Spot}>
      ${cells}
      ${[3, 2, 1].map(function (k, i) { return html`<${Spot} key=${'c' + k} ...${common} kind="outside col" style=${{ gridColumn: 14, gridRow: i + 1 }} spot=${{ type: 'column', key: k, numbers: colNums(k) }} label=${'Column ' + k}>2:1</${Spot}>`; })}
      ${[1, 2, 3].map(function (k) { return html`<${Spot} key=${'d' + k} ...${common} kind="outside" style=${{ gridColumn: (2 + (k - 1) * 4) + ' / span 4', gridRow: 4 }} spot=${{ type: 'dozen', key: k, numbers: range(12 * (k - 1) + 1, 12 * k) }} label=${['1st', '2nd', '3rd'][k - 1] + ' dozen'}>${['1st 12', '2nd 12', '3rd 12'][k - 1]}</${Spot}>`; })}
      ${outside.map(function (o, i) { return html`<${Spot} key=${o[0].type} ...${common} kind="outside" style=${{ gridColumn: (2 + i * 2) + ' / span 2', gridRow: 5 }} spot=${Object.assign({ numbers: outNums(o[0].type) }, o[0])} label=${o[0].type}>${o[1]}</${Spot}>`; })}
      ${hot}
    </div>`;
  }
  function range(a, b) { var out = []; for (var i = a; i <= b; i++) out.push(i); return out; }
  function colNums(k) { return range(1, 36).filter(function (n) { return n % 3 === k % 3; }); }
  function outNums(t) {
    var all = range(1, 36);
    return { red: all.filter(function (n) { return RED.indexOf(n) >= 0; }), black: all.filter(function (n) { return RED.indexOf(n) < 0; }), odd: all.filter(function (n) { return n % 2; }), even: all.filter(function (n) { return !(n % 2); }), low: range(1, 18), high: range(19, 36) }[t];
  }

  function Rules(props) {
    var p = props.rules.payouts, t = props.table;
    var rows = [['straight', '1 number'], ['split', '2 numbers'], ['street', '3 in a row'], ['trio', '0 with 1-2 or 2-3'], ['corner', '4 numbers'], ['sixline', '6 numbers'], ['dozen', '12 numbers'], ['column', '12 numbers'], ['red', '18 numbers'], ['odd', '18 numbers'], ['low', '18 numbers']];
    return html`<div className="rules-card">
      <h3>Payouts</h3>
      <table className="payout-table"><tbody>${rows.map(function (r) { return html`<tr key=${r[0]}><td>${NAMES[r[0]]}</td><td className="muted">${r[1]}</td><td className="num"><b>${p[r[0]]} to 1</b></td></tr>`; })}</tbody></table>
      <ul>
        <li>European wheel with one zero. Zero loses every outside bet (red/black, odd/even, 1–18/19–36, dozens, columns).</li>
        <li>Each chip is at least ${money(t.minBet)}; all your chips on one spin are capped at ${money(t.maxBet)}.</li>
        <li>Betting closes ${props.rules.bettingSec}s after the first chip, or when everyone who bet presses Spin. Chips can be taken back until then.</li>
        <li>Inside bets: tap a number for straight up, a line between numbers for a split, a corner for four, the bottom edge for a street or six line.</li>
      </ul>
    </div>`;
  }


  /** What's on the table, as plain data for the 3D room (js/gl-scene.js). The betting layout itself stays HTML. */
  function rlModel(v, table, st, r, now, you, me, chipsBySpot) {
    var last = st.last, seats = st.seats.map(function (pid, i) {
      var p = pid && UI.byId(v, pid);
      if (!p) return { pid: null, canSit: !you.seated && !!me && me.status === 'active' };
      var total = r ? r.bets.filter(function (b) { return b.owner === pid; }).reduce(function (a, b) { return a + b.amount; }, 0) : 0;
      var res = last && st.phase === 'results' ? last.players[pid] : null;
      return { pid: pid, name: p.name, avatar: p.avatar, cash: p.cash, me: pid === v.you, offline: !p.connected, result: res ? (res.net > 0 ? 'win' : res.net < 0 ? 'lose' : null) : null,
        status: res ? (res.net ? signed(res.net) : 'Even') : total ? money(total) + ' bet' : r && r.done && r.done[pid] ? 'Ready' : '', statusCls: res ? (res.net > 0 ? 'green' : res.net < 0 ? 'red' : '') : 'gold' };
    });
    var agg = {};
    if (r) r.bets.forEach(function (b) {
      var k = spotKey(b), e = agg[k] || (agg[k] = { id: k, type: b.type, key: b.key, numbers: b.numbers, amount: 0, from: st.seats.indexOf(b.owner) });
      e.amount += b.amount;
    });
    return { n: st.seats.length, mySeat: st.seats.indexOf(v.you), seats: seats, turnSeat: -1, wheel: { round: r, phase: st.phase, spinSec: st.rules.spinSec }, bets: Object.keys(agg).map(function (k) { return agg[k]; }), onSit: function () {} };
  }

  function RouletteTable(props) {
    var v = props.view, table = props.table, st = table.state, r = st.round, you = st.you, me = UI.byId(v, v.you);
    var acc = v.me && v.me.account;
    var now = useNow(v, 250);
    var chipSel = useState(null), chip = chipSel[0], setChip = chipSel[1];
    var rl = useState(false), showRules = rl[0], setRules = rl[1];
    var lastSpin = useRef(UI.store.get('rl.last', []));
    var denoms = K.CHIP_VALUES.filter(function (c) { return c >= table.minBet && c <= table.maxBet; }).slice(0, 5);
    var value = chip && denoms.indexOf(chip) >= 0 ? chip : denoms[0];
    var mine = r ? r.bets.filter(function (b) { return b.owner === v.you; }) : [];
    useEffect(function () {
      if (st.phase === 'spinning' && mine.length) { lastSpin.current = mine.map(function (b) { return { spot: { type: b.type, key: b.key, numbers: b.numbers }, amount: b.amount }; }); UI.store.set('rl.last', lastSpin.current); }
    }, [st.phase]);

    var chipsBySpot = {};
    if (r) r.bets.forEach(function (b) {
      var k = spotKey(b), e = chipsBySpot[k] || (chipsBySpot[k] = { mine: 0, others: 0, won: false });
      if (b.owner === v.you) e.mine += b.amount; else e.others += b.amount;
      if (b.won) e.won = true;
    });
    function bet(spot) {
      var s = { type: spot.type };
      if (spot.type === 'dozen' || spot.type === 'column') s.key = spot.key; else if (spot.numbers && ['straight', 'split', 'street', 'trio', 'corner', 'sixline'].indexOf(spot.type) >= 0) s.numbers = spot.numbers;
      return props.send({ type: 'play', tableId: table.id, action: 'bet', spot: s, amount: value });
    }
    function rebet() {
      var list = lastSpin.current.slice();
      var go = function () { if (!list.length) return Promise.resolve(); var b = list.shift(); return props.send({ type: 'play', tableId: table.id, action: 'bet', spot: b.spot, amount: b.amount }).then(function (res) { if (!res.error) return go(); }); };
      return go();
    }
    function act(a) { return props.send({ type: 'play', tableId: table.id, action: a }); }
    var lastMine = st.last && st.last.players[v.you];
    var seated = st.seats.filter(Boolean);
    var lastTotal = lastSpin.current.reduce(function (s, b) { return s + b.amount; }, 0);
    var status = v.session.phase === 'paused' ? 'Paused by the host'
      : st.phase === 'idle' ? 'Place your bets'
      : st.phase === 'betting' ? 'Bets close in ' + Math.ceil(((st.timer && (st.timer.endsAt ? st.timer.endsAt - now : st.timer.remainingMs)) || 0) / 1000) + 's'
      : st.phase === 'spinning' ? 'No more bets — the ball is rolling'
      : st.last ? st.last.result + ' ' + st.last.color : '';

    var dock;
    if (!you.seated) {
      var blocked = me && me.status !== 'active';
      dock = html`<div className="dock-row"><span className="muted">${blocked ? 'You’re watching this table.' : 'You’re watching. Take a seat to bet.'}</span>
        ${!blocked ? html`<${Button} kind="primary" onClick=${props.onSit} disabled=${st.seats.indexOf(null) < 0}>${st.seats.indexOf(null) < 0 ? 'Table full' : 'Take a seat'}</${Button}>` : null}</div>`;
    } else if (st.phase === 'spinning' || st.phase === 'results') {
      dock = html`<div className="dock-row"><span className="muted">${st.phase === 'spinning' ? 'No more bets — the ball is rolling.' : 'Next spin in a moment.'}</span></div>`;
    } else {
      dock = html`<div className="dock-roulette">
        <div className="chip-tray" role="radiogroup" aria-label="Chip value">
          ${denoms.map(function (c) { return html`<button key=${c} type="button" role="radio" aria-checked=${c === value} className=${cx('chip-btn', c === value && 'on')} onClick=${function () { setChip(c); }} aria-label=${money(c)}><${Chip} value=${c} /></button>`; })}
        </div>
        <div className="bet-amount"><span className="eyebrow">On the layout</span><b className="num">${money(you.total)}</b><span className="muted small">of ${money(table.maxBet)} max</span></div>
        <div className="row">
          <${Button} kind="ghost" onClick=${function () { return act('undo'); }} disabled=${!you.canBet || !mine.length}>Undo</${Button}>
          <${Button} kind="ghost" onClick=${function () { return act('clear'); }} disabled=${!you.canBet || !mine.length}>Clear</${Button}>
          ${lastSpin.current.length && !mine.length ? html`<${Button} kind="ghost" onClick=${rebet} disabled=${!you.canBet || !acc || acc.cash < lastTotal}>Rebet ${money(lastTotal)}</${Button}>` : null}
          <${Button} kind="primary" onClick=${function () { return act('done'); }} disabled=${!you.canBet || !mine.length || you.done}>${you.done ? 'Waiting for others…' : 'Spin'}</${Button}>
        </div>
        ${st.phase === 'betting' ? html`<${TimerBar} timer=${st.timer} now=${now} />` : null}
      </div>`;
    }

    var GL = window.CasinoGL, glOn = !!(GL && GL.Stage && GL.supported());
    var scene2d = html`<div className="rl-scene">
        <div className="spotlight" aria-hidden="true"></div>
        <div className="rl-wheel-col">
          <${Wheel} round=${r} phase=${st.phase} spinSec=${st.rules.spinSec} />
          <p className="felt-status rl-status" aria-live="polite">${status}</p>
          <div className="history" aria-label="Recent numbers">${st.history.map(function (n, i) { return html`<span key=${i} className=${'hist ' + color(n) + (i === 0 ? ' latest' : '')}>${n}</span>`; })}</div>
        </div>
        <div className="rl-board-col">
          <div className="rl-table"><div className="rl-felt">
            <${Layout} chips=${chipsBySpot} canBet=${you.canBet} onBet=${bet} winning=${st.phase === 'results' && r ? r.result : null} resultPhase=${st.phase === 'results'} />
          </div></div>
          <div className="rl-players">
            ${seated.map(function (pid, i) {
              var p = UI.byId(v, pid); if (!p) return null;
              var total = r ? r.bets.filter(function (b) { return b.owner === pid; }).reduce(function (s, b) { return s + b.amount; }, 0) : 0;
              var res = st.last && st.phase === 'results' ? st.last.players[pid] : null;
              return html`<div key=${pid} className=${cx('rl-player', pid === v.you && 'me', r && r.done[pid] && 'done')}>
                <${UI.Avatar} id=${p.avatar} className="rl-face" tag=${'r' + i} />
                <span className="plaque-name">${p.name}</span>
                <span className="num small">${res ? html`<b className=${res.net > 0 ? 'green' : res.net < 0 ? 'red' : ''}>${signed(res.net)}</b>` : total ? money(total) + ' bet' : html`<span className="muted">${money(p.cash)}</span>`}</span>
              </div>`;
            })}
          </div>
        </div>
      </div>`;
    var sh = useState(true), sheetOpen = sh[0], setSheet = sh[1];
    useEffect(function () { setSheet(st.phase !== 'spinning' && st.phase !== 'results'); }, [st.phase]);
    var glModel = glOn ? rlModel(v, table, st, r, now, you, me, chipsBySpot) : null;
    return html`<section className="rl game-roulette" aria-label=${table.name}>
      <div className="table-bar">
        <button type="button" className="btn btn-ghost" onClick=${props.onBack}>← Casino floor</button>
        <div className="table-bar-title"><h2>${table.name}</h2><span className="muted small num">${money(table.minBet)} – ${money(table.maxBet)}</span></div>
        <div className="row">
          <button type="button" className="btn btn-ghost" aria-expanded=${showRules} onClick=${function () { setRules(!showRules); }}>Rules & payouts</button>
          ${you.seated ? html`<button type="button" className="btn btn-ghost" onClick=${props.onStand}>Stand up</button>` : null}
        </div>
      </div>
      ${showRules ? html`<${Rules} rules=${st.rules} table=${table} />` : null}
      ${glOn ? html`<div className="rl-gl">
        <${GL.Stage} kind="roulette" model=${glModel} fallback=${scene2d}>
          <div className="gl-status-hud" aria-live="polite">${status}</div>
          <div className="gl-history" aria-label="Recent numbers">${st.history.slice(0, 8).map(function (n, i) { return html`<span key=${i} className=${'hist ' + color(n) + (i === 0 ? ' latest' : '')}>${n}</span>`; })}</div>
          ${st.phase === 'results' && st.last ? html`<div className=${'gl-result ' + st.last.color}><b className="num">${st.last.result}</b><span>${st.last.color}</span></div>` : null}
        </${GL.Stage}>
        ${you.seated ? html`<div className=${cx('rl-sheet', !sheetOpen && 'closed')}>
          <button type="button" className="btn btn-ghost rl-sheet-toggle" aria-expanded=${sheetOpen} onClick=${function () { setSheet(!sheetOpen); }}>${sheetOpen ? 'Hide the layout' : 'Show the betting layout'}</button>
          ${sheetOpen ? html`<div className="rl-table"><div className="rl-felt">
            <${Layout} chips=${chipsBySpot} canBet=${you.canBet} onBet=${bet} winning=${st.phase === 'results' && r ? r.result : null} resultPhase=${st.phase === 'results'} />
          </div></div>` : null}
        </div>` : null}
      </div>` : scene2d}
      ${lastMine && st.phase !== 'spinning' ? html`<div className=${cx('round-summary', lastMine.net > 0 && 'up', lastMine.net < 0 && 'down')} role="status">
        <span className="eyebrow">Last spin</span>
        <span>Landed <b className=${'num ' + (st.last.color === 'red' ? 'red' : st.last.color === 'green' ? 'green' : '')}>${st.last.result} ${st.last.color}</b></span>
        <span>Bet <b className="num">${money(lastMine.staked)}</b></span>
        <b className="num">${lastMine.net ? signed(lastMine.net) : 'Even'}</b>
        <span className="muted">Cash now <b className="num">${money(lastMine.cash)}</b></span>
      </div>` : null}
      <div className="dock">${dock}</div>
    </section>`;
  }

  window.CasinoTables = window.CasinoTables || {};
  window.CasinoTables.roulette = RouletteTable;
})();
