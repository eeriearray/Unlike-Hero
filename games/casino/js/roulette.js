/* Neon Casino — the roulette table: a European wheel and the betting layout. The server picks the number when betting
   closes; this page only animates the wheel to it. Every chip is one bet the server validates and can take back. */
(function () {
  'use strict';
  var R = React, useState = R.useState, useEffect = R.useEffect, useRef = R.useRef;
  var UI = window.CasinoUI, html = UI.html, cx = UI.cx, money = UI.money, signed = UI.signed, Button = UI.Button, useNow = UI.useNow;
  var K = window.CasinoKit, Chip = K.Chip, TimerBar = K.TimerBar, Character = K.Character;

  var WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  var RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  var STEP = 360 / 37;
  function color(n) { return n === 0 ? 'green' : RED.indexOf(n) >= 0 ? 'red' : 'black'; }
  function spotKey(s) { return s.type + ':' + (s.key || (s.numbers || []).join('-')); }
  var NAMES = { straight: 'Straight up', split: 'Split', street: 'Street', trio: 'Trio (0-1-2 / 0-2-3)', corner: 'Corner', sixline: 'Six line', dozen: 'Dozen', column: 'Column', red: 'Red / Black', odd: 'Odd / Even', low: '1–18 / 19–36' };

  // ───────────── the wheel ─────────────
  function Wheel(props) {
    var r = props.round, spinning = props.phase === 'spinning';
    var rot = useRef(0), seen = useRef(null);
    var s = useState({ wheel: 0, ball: 0, animate: false }), pose = s[0], setPose = s[1];
    useEffect(function () {
      if (!r || r.result == null) return;
      var id = r.id;
      if (seen.current === id) return;
      seen.current = id;
      var i = WHEEL.indexOf(r.result);
      var land = ((-i * STEP) % 360 + 360) % 360;                    // wheel angle that puts the result under the pointer
      var base = rot.current - (rot.current % 360);
      var target = base + 360 * 5 + land;
      rot.current = target;
      setPose({ wheel: target, ball: -360 * 7, animate: spinning });   // a ball arriving mid-results just shows where it landed
    }, [r && r.id, r && r.result]);
    useEffect(function () { if (!r) setPose(function (p) { return { wheel: p.wheel, ball: 0, animate: false }; }); }, [!!r]);
    var dur = (props.spinSec || 7) - 0.4;
    var pockets = WHEEL.map(function (n, i) {
      var a0 = (i - 0.5) * STEP, a1 = (i + 0.5) * STEP;
      var p = function (a, rad) { var t = (a - 90) * Math.PI / 180; return (100 + rad * Math.cos(t)).toFixed(2) + ' ' + (100 + rad * Math.sin(t)).toFixed(2); };
      var fill = n === 0 ? '#1f9a5e' : color(n) === 'red' ? '#c8283c' : '#15131c';
      var tp = (i * STEP - 90) * Math.PI / 180;
      return html`<g key=${n}>
        <path d=${'M' + p(a0, 96) + ' A96 96 0 0 1 ' + p(a1, 96) + ' L' + p(a1, 70) + ' A70 70 0 0 0 ' + p(a0, 70) + ' Z'} fill=${fill} stroke="#c9a45c" strokeWidth=".6" />
        <text x=${100 + 84 * Math.cos(tp)} y=${100 + 84 * Math.sin(tp)} transform=${'rotate(' + i * STEP + ' ' + (100 + 84 * Math.cos(tp)) + ' ' + (100 + 84 * Math.sin(tp)) + ')'} className="wheel-num">${n}</text>
      </g>`;
    });
    var landed = r && r.result != null && (props.phase === 'results' || !pose.animate);
    return html`<div className="wheel-wrap">
      <div className="wheel-pointer" aria-hidden="true"></div>
      <svg className="wheel" viewBox="0 0 200 200" role="img" aria-label=${landed ? 'The ball landed on ' + r.result : 'Roulette wheel'}>
        <defs>
          <radialGradient id="rw-bowl" cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="#5a3a22" /><stop offset="1" stopColor="#1c0f08" /></radialGradient>
          <radialGradient id="rw-cone" cx="45%" cy="35%" r="70%"><stop offset="0" stopColor="#f3d27a" /><stop offset=".5" stopColor="#a87a2a" /><stop offset="1" stopColor="#3a2610" /></radialGradient>
        </defs>
        <circle cx="100" cy="100" r="99" fill="url(#rw-bowl)" />
        <g className="wheel-rotor" style=${{ transform: 'rotate(' + pose.wheel + 'deg)', transition: pose.animate ? 'transform ' + dur + 's cubic-bezier(.12,.62,.08,1)' : 'none' }}>
          ${pockets}
          <circle cx="100" cy="100" r="70" fill="#2a1a10" stroke="#c9a45c" strokeWidth="1" />
          <circle cx="100" cy="100" r="44" fill="url(#rw-cone)" />
          ${[0, 1, 2, 3].map(function (k) { return html`<rect key=${k} x="97" y="58" width="6" height="84" rx="3" fill="#e9c66e" transform=${'rotate(' + k * 45 + ' 100 100)'} />`; })}
          <circle cx="100" cy="100" r="9" fill="#f6dc8e" stroke="#7a5420" />
        </g>
        <g className="wheel-ball" style=${{ transform: 'rotate(' + pose.ball + 'deg)', transition: pose.animate ? 'transform ' + dur + 's cubic-bezier(.2,.7,.25,1)' : 'none' }}>
          <circle cx="100" cy="21" r="4.2" fill="#fbfbff" stroke="#b9b6c8" strokeWidth=".6" style=${{ opacity: r && r.result != null ? 1 : 0 }} />
        </g>
      </svg>
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
      ${mine && mine.mine ? html`<span className="spot-chip"><${Chip} value=${chipFace(mine.mine)} /><b className="num">${short(mine.mine)}</b></span>`
        : mine && mine.others ? html`<span className="spot-others" aria-hidden="true"></span>` : null}
      ${win ? html`<span className="spot-win" aria-hidden="true"></span>` : null}
    </button>`;
  }
  function short(n) { return n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'K' : String(n); }
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
      <div className="rl-scene">
        <div className="rl-wheel-col">
          <${Wheel} round=${r} phase=${st.phase} spinSec=${st.rules.spinSec} />
          <p className="felt-status rl-status" aria-live="polite">${status}</p>
          <div className="history" aria-label="Recent numbers">${st.history.map(function (n, i) { return html`<span key=${i} className=${'hist ' + color(n) + (i === 0 ? ' latest' : '')}>${n}</span>`; })}</div>
        </div>
        <div className="rl-board-col">
          <${Layout} chips=${chipsBySpot} canBet=${you.canBet} onBet=${bet} winning=${st.phase === 'results' && r ? r.result : null} resultPhase=${st.phase === 'results'} />
          <div className="rl-players">
            ${seated.map(function (pid, i) {
              var p = UI.byId(v, pid); if (!p) return null;
              var total = r ? r.bets.filter(function (b) { return b.owner === pid; }).reduce(function (s, b) { return s + b.amount; }, 0) : 0;
              var res = st.last && st.phase === 'results' ? st.last.players[pid] : null;
              return html`<div key=${pid} className=${cx('rl-player', pid === v.you && 'me', r && r.done[pid] && 'done')}>
                <div className="rl-figure"><${Character} avatar=${p.avatar} seat=${'r' + i} /></div>
                <span className="plaque-name">${UI.AVATARS[p.avatar]} ${p.name}</span>
                <span className="num small">${res ? html`<b className=${res.net > 0 ? 'green' : res.net < 0 ? 'red' : ''}>${signed(res.net)}</b>` : total ? money(total) + ' bet' : html`<span className="muted">${money(p.cash)}</span>`}</span>
              </div>`;
            })}
          </div>
        </div>
      </div>
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
