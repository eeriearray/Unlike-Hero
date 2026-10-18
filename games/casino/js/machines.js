/* Neon Casino — the machine hall: Lucky Sevens slots and Jacks-or-Better video poker. Each seat is its own machine, so
   nobody waits for anybody. The server picks every reel stop and every card (games/casino/server/games/slots.mjs,
   videopoker.mjs); this page sends bets and holds and draws the 3D machines (js/gl-hall.js), with the same readout as plain HUD. */
(function () {
  'use strict';
  var R = React, useState = R.useState, useEffect = R.useEffect, useRef = R.useRef;
  var UI = window.CasinoUI, html = UI.html, cx = UI.cx, money = UI.money, signed = UI.signed, Button = UI.Button;
  var K = window.CasinoKit;
  var GLYPH = { S7: '7', BAR: 'BAR', BELL: '🔔', GEM: '💎', LEM: '🍋', CHR: '🍒' };

  function step(n, dir) { return dir > 0 ? Math.ceil(n / 5) * 5 : Math.floor(n / 5) * 5; }
  /** Preset bets: the minimum, a few multiples, and the most you can afford, in whole fives (slots) or ones. */
  function presets(table, cash, fives) {
    var q = fives ? function (n) { return step(n, 1); } : function (n) { return Math.round(n); };
    var min = q(table.minBet), max = Math.min(table.maxBet, cash); max = fives ? step(max, -1) : max;
    var out = [];
    [1, 2, 5, 10].forEach(function (m) { var v = q(table.minBet * m); if (v >= min && v <= max && out.indexOf(v) < 0) out.push(v); });
    if (max >= min && out.indexOf(max) < 0) out.push(max);
    return out.length ? out : [min];
  }

  function seatsModel(v, st, extra) {
    return st.seats.map(function (pid, i) {
      var p = pid && UI.byId(v, pid);
      return p ? Object.assign({ pid: pid, name: p.name, avatar: p.avatar, cash: p.cash, me: pid === v.you, offline: !p.connected }, extra ? extra(pid, i) : {}) : { pid: null };
    });
  }

  function Chrome(props) {
    var table = props.table, v = props.view, st = table.state, you = st.you;
    var rl = useState(false), showRules = rl[0], setRules = rl[1];
    return html`<div className="table-bar">
        <button type="button" className="btn btn-ghost" onClick=${props.onBack}>← Casino floor</button>
        <div className="table-bar-title"><h2>${table.name}</h2><span className="muted small num">${money(table.minBet)} – ${money(table.maxBet)}</span></div>
        <div className="row">
          <button type="button" className="btn btn-ghost" aria-expanded=${showRules} onClick=${function () { setRules(!showRules); }}>Pay table</button>
          ${you.seated ? html`<button type="button" className="btn btn-ghost" onClick=${props.onStand}>Stand up</button>` : null}
        </div>
      </div>
      ${showRules ? props.rules : null}`;
  }

  function Watching(props) {
    var v = props.view, st = props.table.state, me = UI.byId(v, v.you), blocked = me && me.status !== 'active', full = st.seats.indexOf(null) < 0;
    return html`<div className="dock-row"><span className="muted">${blocked ? 'You’re watching this table.' : 'You’re watching. Take a machine to play.'}</span>
      ${!blocked ? html`<${Button} kind="primary" onClick=${props.onSit} disabled=${full}>${full ? 'Every machine is taken' : 'Take a machine'}</${Button}>` : null}</div>`;
  }

  function BetPicker(props) {
    return html`<div className="chip-tray bet-presets" role="radiogroup" aria-label="Bet size">
      ${props.options.map(function (c) { return html`<button key=${c} type="button" role="radio" aria-checked=${c === props.value} className=${cx('btn bet-pill', c === props.value && 'on')} disabled=${props.disabled} onClick=${function () { props.onPick(c); }}>${money(c)}</button>`; })}
    </div>`;
  }

  /** The celebration: a big number that counts up, and a label that grows with the win (WIN, BIG WIN, MEGA WIN, JACKPOT). */
  var TIER_LABEL = ['', 'WIN', 'BIG WIN', 'MEGA WIN', 'JACKPOT'];
  function WinBanner(props) {
    var w = props.win, seen = useRef(w ? w.no : 0), sv = useState(null), show = sv[0], setShow = sv[1], vs = useState(0), val = vs[0], setVal = vs[1];
    useEffect(function () {
      if (!w || seen.current === w.no) return;
      seen.current = w.no;
      var tier = window.CasinoGL && CasinoGL.winTier ? CasinoGL.winTier(w.amount, w.bet) : 1, dur = [0, 900, 1500, 2300, 3400][tier], t0 = performance.now(), raf = 0, lastTick = 0;
      setShow({ tier: tier, amount: w.amount, no: w.no });
      (function frame(now) {
        var u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3);
        setVal(Math.round(w.amount * e));
        if (now - lastTick > 70 && u < 1 && window.CasinoGL && CasinoGL.audio) { lastTick = now; CasinoGL.audio.countTick(u); }
        if (u < 1) raf = requestAnimationFrame(frame);
      })(t0);
      var hide = setTimeout(function () { setShow(null); }, dur + 1800);
      return function () { cancelAnimationFrame(raf); clearTimeout(hide); };
    }, [w && w.no]);
    if (!show) return null;
    return html`<div className=${'win-banner tier-' + show.tier} role="status"><span className="win-rays" aria-hidden="true"></span><b className="win-label">${TIER_LABEL[show.tier]}</b><b className="win-amount num">+${money(val)}</b></div>`;
  }

  // ───────────── slots ─────────────
  function SlotsRules(props) {
    var pays = props.rules.pays;
    return html`<div className="rules-card"><h3>Lucky Sevens</h3>
      <table className="payout-table"><tbody>
        ${[['S7', 'Three sevens'], ['GEM', 'Three diamonds'], ['BELL', 'Three bells'], ['BAR', 'Three BARs'], ['LEM', 'Three lemons'], ['CHR', 'Three cherries']].map(function (r) { return html`<tr key=${r[0]}><td>${GLYPH[r[0]]} ${r[1]}</td><td className="num"><b>${pays[r[0]]}×</b></td></tr>`; })}
        <tr><td>🍒🍒 on the left of a line</td><td className="num"><b>${pays.CHR2}×</b></td></tr>
      </tbody></table>
      <ul><li>Five lines: the three rows and both diagonals. Your bet is split across them, so each line pays its multiple of one fifth of the bet.</li>
        <li>Bets are in multiples of 5. The wallet moves when the reels stop. Standing up never cancels a spin.</li></ul></div>`;
  }

  function SlotsTable(props) {
    var v = props.view, table = props.table, st = table.state, you = st.you, acc = v.me && v.me.account, cash = acc ? acc.cash : 0;
    var opts = presets(table, cash, true);
    var b = useState(UI.store.get('sl.bet', 0)), want = b[0], setBet = b[1];
    var bet = opts.indexOf(want) >= 0 ? want : opts[0];
    var mySeat = st.seats.indexOf(v.you), my = st.spins[v.you] || null;
    var GL = window.CasinoGL, glOn = !!(GL && GL.Stage && GL.supported());
    function spin() { return props.send({ type: 'play', tableId: table.id, action: 'spin', amount: bet }).then(function (r) { if (r.ok) UI.store.set('sl.bet', bet); }); }
    useEffect(function () { function k(e) { if (e.code === 'Space' && you.canSpin && !/INPUT|TEXTAREA|SELECT|BUTTON/.test((e.target && e.target.tagName) || '')) { e.preventDefault(); spin(); } } addEventListener('keydown', k); return function () { removeEventListener('keydown', k); }; });

    var spins = {};
    st.seats.forEach(function (pid, i) { if (pid && st.spins[pid]) spins[i] = st.spins[pid]; });
    var model = glOn ? { n: st.seats.length, mySeat: mySeat, strips: st.rules.strips, spins: spins, onSit: props.onSit,
      seats: seatsModel(v, st, function (pid, i) { var s = st.spins[pid]; return { canSit: false, status: s && s.state === 'done' && s.payout ? '+' + money(s.payout) : '', statusCls: 'green', result: s && s.state === 'done' ? (s.net > 0 ? 'win' : 'lose') : null }; }).map(function (s) { return s.pid ? s : { pid: null, canSit: !you.seated && !!UI.byId(v, v.you) && UI.byId(v, v.you).status === 'active' }; }) } : null;

    var grid = !glOn && my && my.grid && my.state === 'done' ? my.grid : null;
    var win = my && my.state === 'done' && my.payout > 0 ? { no: my.no, amount: my.payout, bet: my.bet } : null;
    var msg = !you.seated ? '' : !my ? 'Pick a bet and pull the lever' : my.state === 'spinning' ? 'Spinning…' : my.payout ? 'You won ' + money(my.payout) + '!' : 'No win. Spin again.';
    var hud = html`<div className="mach-hud">
      <div className=${cx('mach-readout', my && my.state === 'done' && my.payout && 'won')} aria-live="polite">
        ${grid ? html`<div className="mach-grid">${[0, 1, 2].map(function (row) { return grid.map(function (reel, ri) { var win = my.wins && my.wins.some(function (w) { return st.rules.lines[w.line][ri] === row && w.pay; }); return html`<span key=${row + '-' + ri} className=${cx('mach-sym', win && 'hit', reel[row] === 'BAR' && 'bar')}>${GLYPH[reel[row]]}</span>`; }); })}</div>` : null}
        <div className="mach-msg">${msg}</div>
      </div><${WinBanner} win=${win} /></div>`;
    var flat = html`<div className="mach-flat">${hud}</div>`;

    var dock;
    if (!you.seated) dock = html`<${Watching} ...${props} />`;
    else dock = html`<div className="dock-machine">
      <${BetPicker} options=${opts} value=${bet} onPick=${function (c) { setBet(c); }} disabled=${!you.canSpin} />
      <${Button} kind="primary" className="act spin-btn" onClick=${spin} disabled=${!you.canSpin || cash < bet}>${my && my.state === 'spinning' ? 'Spinning…' : 'Spin ' + money(bet)}</${Button}>
      ${cash < table.minBet ? html`<p className="muted small">You need ${money(table.minBet)} to play.</p>` : null}
    </div>`;
    var net = my && my.state === 'done' ? my.net : null;
    return html`<section className="mach game-slots" aria-label=${table.name}>
      <${Chrome} ...${props} rules=${html`<${SlotsRules} rules=${st.rules} />`} />
      ${glOn ? html`<${GL.Stage} kind="slots" model=${model} fallback=${flat}>${hud}</${GL.Stage}>` : flat}
      ${net != null && !(my && my.state === 'spinning') ? html`<div className=${cx('round-summary', net > 0 && 'up', net < 0 && 'down')} role="status"><span className="eyebrow">Last spin</span><span>Bet <b className="num">${money(my.bet)}</b></span><b className="num">${net ? signed(net) : 'Even'}</b></div>` : null}
      <div className="dock">${dock}</div>
    </section>`;
  }

  // ───────────── video poker ─────────────
  function VPRules(props) {
    return html`<div className="rules-card"><h3>Jacks or Better</h3>
      <table className="payout-table"><tbody>${props.rules.paytable.map(function (r) { return html`<tr key=${r[0]}><td>${r[1]}</td><td className="num"><b>${r[2]}×</b></td></tr>`; })}</tbody></table>
      <ul><li>You're dealt five cards. Tap the ones to hold, then draw once to replace the rest. The best hand is paid by the table.</li>
        <li>A hand left alone for ${props.rules.idleSec}s draws on its own, keeping all five cards.</li></ul></div>`;
  }

  function VideoPokerTable(props) {
    var v = props.view, table = props.table, st = table.state, you = st.you, acc = v.me && v.me.account, cash = acc ? acc.cash : 0;
    var opts = presets(table, cash, false);
    var b = useState(UI.store.get('vp.bet', 0)), want = b[0], setBet = b[1];
    var bet = opts.indexOf(want) >= 0 ? want : opts[0];
    var mySeat = st.seats.indexOf(v.you), hand = st.hands[v.you] || null, holding = you.holding;
    var GL = window.CasinoGL, glOn = !!(GL && GL.Stage && GL.supported());
    function act(action, extra) { return props.send(Object.assign({ type: 'play', tableId: table.id, action: action }, extra || {})); }
    function deal() { return act('deal', { amount: bet }).then(function (r) { if (r.ok) UI.store.set('vp.bet', bet); }); }
    useEffect(function () { function k(e) { if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return; if (holding && e.key >= '1' && e.key <= '5') act('hold', { index: +e.key - 1 }); else if (e.code === 'Space' && !/BUTTON/.test((e.target && e.target.tagName) || '')) { e.preventDefault(); if (holding) act('draw'); else if (you.canDeal) deal(); } } addEventListener('keydown', k); return function () { removeEventListener('keydown', k); }; });

    var hands = {};
    st.seats.forEach(function (pid, i) { if (pid && st.hands[pid]) hands[i] = Object.assign({}, st.hands[pid]); });
    var model = glOn ? { n: st.seats.length, mySeat: mySeat, hands: hands, onSit: props.onSit,
      seats: seatsModel(v, st, function (pid) { var h = st.hands[pid]; return { bet: h ? h.bet : 0, status: h && h.phase === 'done' && h.payout ? h.name : '', statusCls: 'green', result: h && h.phase === 'done' ? (h.net > 0 ? 'win' : 'lose') : null }; }).map(function (s) { return s.pid ? s : { pid: null, canSit: !you.seated && !!UI.byId(v, v.you) && UI.byId(v, v.you).status === 'active' }; }) } : null;

    var msg = !you.seated ? '' : !hand ? 'Place your bet and deal' : hand.phase === 'hold' ? 'Tap the cards to hold, then draw' : hand.payout ? hand.name + ' — you won ' + money(hand.payout) : 'No win';
    var vwin = hand && hand.phase === 'done' && hand.payout > 0 ? { no: hand.no, amount: hand.payout, bet: hand.bet } : null;
    var hud = html`<div className="mach-hud">
      <${WinBanner} win=${vwin} />
      <div className="vp-hand" aria-label="Your hand">
        ${hand ? hand.cards.map(function (c, i) {
          return html`<button key=${i + ':' + (c || 'x')} type="button" className=${cx('vp-card', hand.held && hand.held[i] && hand.phase === 'hold' && 'held')} disabled=${hand.phase !== 'hold'} onClick=${function () { act('hold', { index: i }); }} aria-pressed=${!!(hand.held && hand.held[i])} aria-label=${'Card ' + (i + 1) + (hand.held && hand.held[i] ? ', held' : '')}>
            <${K.Card} card=${c} i=${i} />${hand.held && hand.held[i] && hand.phase === 'hold' ? html`<b className="held-tag">HELD</b>` : null}</button>`;
        }) : null}
      </div>
      <div className=${cx('mach-msg', hand && hand.phase === 'done' && hand.payout && 'won')} aria-live="polite">${msg}</div>
    </div>`;
    var flat = html`<div className="mach-flat">${hud}</div>`;
    var dock;
    if (!you.seated) dock = html`<${Watching} ...${props} />`;
    else if (holding) dock = html`<div className="dock-machine"><span className="muted small">${hand.held.filter(Boolean).length} held</span><${Button} kind="primary" className="act spin-btn" onClick=${function () { return act('draw'); }}>Draw</${Button}></div>`;
    else dock = html`<div className="dock-machine">
      <${BetPicker} options=${opts} value=${bet} onPick=${setBet} />
      <${Button} kind="primary" className="act spin-btn" onClick=${deal} disabled=${!you.canDeal || cash < bet}>Deal ${money(bet)}</${Button}>
      ${cash < table.minBet ? html`<p className="muted small">You need ${money(table.minBet)} to play.</p>` : null}
    </div>`;
    var net = hand && hand.phase === 'done' ? hand.net : null;
    return html`<section className="mach game-videopoker" aria-label=${table.name}>
      <${Chrome} ...${props} rules=${html`<${VPRules} rules=${st.rules} />`} />
      ${glOn ? html`<${GL.Stage} kind="vpoker" model=${model} fallback=${flat}>${hud}</${GL.Stage}>` : flat}
      ${net != null ? html`<div className=${cx('round-summary', net > 0 && 'up', net < 0 && 'down')} role="status"><span className="eyebrow">Last hand</span><span>Bet <b className="num">${money(hand.bet)}</b></span><span>${hand.name}</span><b className="num">${net ? signed(net) : 'Even'}</b></div>` : null}
      <div className="dock">${dock}</div>
    </section>`;
  }

  window.CasinoTables = window.CasinoTables || {};
  window.CasinoTables.slots = SlotsTable;
  window.CasinoTables.videopoker = VideoPokerTable;
})();
