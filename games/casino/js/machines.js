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

  // ── video poker helpers: what five cards make, and which of them make it ──
  var RV = '23456789TJQKA';
  function vpRank(c) {
    if (!c || c.length < 5 || c.some(function (x) { return !x; })) return null;
    var vals = c.map(function (x) { return RV.indexOf(x[0]) + 2; }).sort(function (a, b) { return b - a; });
    var flush = c.every(function (x) { return x[1] === c[0][1]; }), uniq = vals.filter(function (v, i) { return vals.indexOf(v) === i; }), straight = false, high = vals[0];
    if (uniq.length === 5) { if (vals[0] - vals[4] === 4) straight = true; else if (vals[0] === 14 && vals[1] === 5) { straight = true; high = 5; } }
    var counts = {}; vals.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    var g = Object.keys(counts).map(function (v) { return [counts[v], +v]; }).sort(function (a, b) { return b[0] - a[0] || b[1] - a[1]; });
    if (straight && flush) return high === 14 && vals[1] === 13 ? 'royal' : 'sflush';
    if (g[0][0] === 4) return 'four';
    if (g[0][0] === 3 && g[1][0] === 2) return 'full';
    if (flush) return 'flush';
    if (straight) return 'straight';
    if (g[0][0] === 3) return 'three';
    if (g[0][0] === 2 && g[1][0] === 2) return 'twopair';
    if (g[0][0] === 2 && g[0][1] >= 11) return 'jacks';
    return null;
  }
  /** Indices of the cards that make the hand (so they can glow). */
  function vpScoring(c, rank) {
    if (!rank) return [];
    if (rank === 'royal' || rank === 'sflush' || rank === 'flush' || rank === 'straight' || rank === 'full') return [0, 1, 2, 3, 4];
    var counts = {}; c.forEach(function (x) { counts[x[0]] = (counts[x[0]] || 0) + 1; });
    var need = rank === 'four' ? 4 : rank === 'three' ? 3 : 2;
    return c.map(function (x, i) { return counts[x[0]] >= need ? i : -1; }).filter(function (i) { return i >= 0; });
  }
  var VP_TIER = { jacks: 1, twopair: 1, three: 2, straight: 2, flush: 3, full: 3, four: 3, sflush: 4, royal: 4 };

  /** The celebration: a big number that counts up, and a label that grows with the win (WIN, BIG WIN, MEGA WIN, JACKPOT). */
  var TIER_LABEL = ['', 'WIN', 'BIG WIN', 'MEGA WIN', 'JACKPOT'];
  function WinBanner(props) {
    var w = props.win, seen = useRef(w ? w.no : 0), sv = useState(null), show = sv[0], setShow = sv[1], vs = useState(0), val = vs[0], setVal = vs[1], hideT = useRef(0);
    useEffect(function () { return function () { clearTimeout(hideT.current); }; }, []);
    useEffect(function () {
      if (!w) { clearTimeout(hideT.current); setShow(null); return; }          // a new spin (or a loss) takes the old banner away at once
      if (seen.current === w.no) return;
      seen.current = w.no;
      var tier = w.tier || (window.CasinoGL && CasinoGL.winTier ? CasinoGL.winTier(w.amount, w.bet) : 1), dur = [0, 900, 1500, 2300, 3400][tier], raf = 0, lastTick = 0, t0 = 0, startT = 0;
      function go() { t0 = performance.now(); setShow({ tier: tier, amount: w.amount, no: w.no, label: w.label }); frame(t0); clearTimeout(hideT.current); hideT.current = setTimeout(function () { setShow(null); }, dur + 1800); }
      function frame(now) {
        var u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3);
        setVal(Math.round(w.amount * e));
        if (now - lastTick > 70 && u < 1 && window.CasinoGL && CasinoGL.audio) { lastTick = now; CasinoGL.audio.countTick(u); }
        if (u < 1) raf = requestAnimationFrame(frame);
      }
      startT = setTimeout(go, w.delay || 0);
      return function () { cancelAnimationFrame(raf); clearTimeout(startT); };
    }, [w && w.no]);
    if (!show) return null;
    return html`<div className=${'win-banner tier-' + show.tier} role="status"><span className="win-rays" aria-hidden="true"></span><b className="win-label">${show.label || TIER_LABEL[show.tier]}</b><b className="win-amount num">+${money(val)}</b></div>`;
  }

  /** A line drawn through the winning cells of the result grid (rows = the row each reel contributes to the line). */
  function PayLine(props) {
    var C = [15.8, 50, 84.2], pts = props.rows.map(function (row, reel) { return [C[reel], C[row]]; });
    var dx = pts[2][0] - pts[0][0], dy = pts[2][1] - pts[0][1], len = Math.hypot(dx, dy), ex = dx / len * 10, ey = dy / len * 10;
    var x1 = pts[0][0] - ex, y1 = pts[0][1] - ey, x2 = pts[2][0] + ex, y2 = pts[2][1] + ey;
    return html`<svg className="payline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1=${x1} y1=${y1} x2=${x2} y2=${y2} pathLength="100" style=${{ animationDelay: props.delay + 's' }} /></svg>`;
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

    // the result grid pops up in the middle of the screen when the reels stop, then fades (it stays in the flat fallback)
    var gs = useState(0), gridShownNo = gs[0], setGridShown = gs[1];
    useEffect(function () {
      if (!my || my.state !== 'done' || !my.grid) return;
      setGridShown(my.no);
      var t = setTimeout(function () { setGridShown(0); }, my.payout > 0 ? 4200 : 2400);
      return function () { clearTimeout(t); };
    }, [my && my.state === 'done' ? my.no : 0]);
    var grid = my && my.grid && my.state === 'done' && (!glOn || gridShownNo === my.no) ? my.grid : null;
    var win = my && my.state === 'done' && my.payout > 0 ? { no: my.no, amount: my.payout, bet: my.bet } : null;
    var msg = !you.seated ? '' : !my ? 'Pick a bet and pull the lever' : my.state === 'spinning' ? 'Spinning…' : my.payout ? 'You won ' + money(my.payout) + '!' : 'No win. Spin again.';
    var hud = html`<div className="mach-hud">
      <div className=${cx('mach-readout', my && my.state === 'done' && my.payout && 'won')} aria-live="polite">
        ${grid ? html`<div className="mach-grid">${[0, 1, 2].map(function (row) { return grid.map(function (reel, ri) { var win = my.wins && my.wins.some(function (w) { return st.rules.lines[w.line][ri] === row && w.pay; }); return html`<span key=${row + '-' + ri} className=${cx('mach-sym', win && 'hit', reel[row] === 'BAR' && 'bar')}>${GLYPH[reel[row]]}</span>`; }); })}${(my.wins || []).map(function (w, k) { return html`<${PayLine} key=${k} rows=${st.rules.lines[w.line]} delay=${k * 0.25} />`; })}</div>` : null}
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
    // deal and draw choreography: cards flip in one after another, with a sound each; the result lands after the last flip
    var prev = useRef({ no: hand ? hand.no : 0, cards: hand ? hand.cards.join() : '', arr: hand ? hand.cards.slice() : [], anim: [0, 0, 0, 0, 0], pending: null, resultDelay: 0 }), P = prev.current;
    if (hand) {
      var cs = hand.cards.join();
      if (hand.no !== P.no) { P.no = hand.no; P.cards = cs; P.arr = hand.cards.slice(); P.anim = [0, 1, 2, 3, 4].map(function (i) { return 0.1 + i * 0.13; }); P.pending = 'deal'; }
      else if (cs !== P.cards) { var kk = 0; P.anim = hand.cards.map(function (c, i) { return c !== P.arr[i] ? 0.15 + (kk++) * 0.22 : 0; }); P.resultDelay = (0.15 + kk * 0.22 + 0.5) * 1000; P.cards = cs; P.arr = hand.cards.slice(); P.pending = 'draw'; P.changed = kk; }
    }
    useEffect(function () {
      var A = window.CasinoGL && CasinoGL.audio, pend = P.pending; if (!pend || !A) { P.pending = null; return; }
      P.pending = null;
      var timers = [];
      if (pend === 'deal') { A.shuffle(); P.anim.forEach(function (d) { timers.push(setTimeout(function () { A.flip(); }, 120 + d * 1000)); }); }
      else { P.anim.forEach(function (d) { if (d) timers.push(setTimeout(function () { A.flip(); }, d * 1000)); });
        if (hand && hand.phase === 'done') timers.push(setTimeout(function () { if (hand.payout > 0) A.fanfare(VP_TIER[hand.rank] || 1); else A.lose(); }, P.resultDelay)); }
      return function () { timers.forEach(clearTimeout); };
    });
    function act(action, extra) { return props.send(Object.assign({ type: 'play', tableId: table.id, action: action }, extra || {})); }
    function deal() { return act('deal', { amount: bet }).then(function (r) { if (r.ok) UI.store.set('vp.bet', bet); }); }
    useEffect(function () { function k(e) { if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return; if (holding && e.key >= '1' && e.key <= '5') act('hold', { index: +e.key - 1 }); else if (e.code === 'Space' && !/BUTTON/.test((e.target && e.target.tagName) || '')) { e.preventDefault(); if (holding) act('draw'); else if (you.canDeal) deal(); } } addEventListener('keydown', k); return function () { removeEventListener('keydown', k); }; });

    var hands = {};
    st.seats.forEach(function (pid, i) { if (pid && st.hands[pid]) hands[i] = Object.assign({}, st.hands[pid]); });
    var model = glOn ? { n: st.seats.length, mySeat: mySeat, hands: hands, onSit: props.onSit,
      seats: seatsModel(v, st, function (pid) { var h = st.hands[pid]; return { bet: h ? h.bet : 0, status: h && h.phase === 'done' && h.payout ? h.name : '', statusCls: 'green', result: h && h.phase === 'done' ? (h.net > 0 ? 'win' : 'lose') : null }; }).map(function (s) { return s.pid ? s : { pid: null, canSit: !you.seated && !!UI.byId(v, v.you) && UI.byId(v, v.you).status === 'active' }; }) } : null;

    var rules = st.rules.paytable, live = hand ? (hand.phase === 'done' ? hand.rank : vpRank(hand.cards)) : null;
    function rankName(k) { var r = rules.filter(function (x) { return x[0] === k; })[0]; return r ? r[1] : ''; }
    var scoring = hand && hand.phase === 'done' && hand.rank ? vpScoring(hand.cards, hand.rank) : [];
    var msg = !you.seated ? '' : !hand ? 'Place your bet and deal' : hand.phase === 'hold' ? (live ? 'You have ' + rankName(live) + ' · tap cards to hold, then draw' : 'Tap the cards to hold, then draw') : hand.payout ? hand.name + ' — you won ' + money(hand.payout) : 'No win';
    var vwin = hand && hand.phase === 'done' && hand.payout > 0 ? { no: hand.no, amount: hand.payout, bet: hand.bet, tier: VP_TIER[hand.rank] || 1, label: hand.name.toUpperCase(), delay: P.resultDelay || 0 } : null;
    var hud = html`<div className="mach-hud">
      <${WinBanner} win=${vwin} />
      ${hand ? html`<div className="vp-pay" aria-label="Pay table">${rules.map(function (r) { return html`<div key=${r[0]} className=${cx('vp-pay-row', live === r[0] && 'live', live === r[0] && hand.phase === 'done' && 'won')}><span>${r[1]}</span><b className="num">${r[2]}×</b></div>`; })}</div>` : null}
      <div className="vp-hand" aria-label="Your hand">
        ${hand ? hand.cards.map(function (c, i) {
          return html`<button key=${hand.no + ':' + i + ':' + (c || 'x')} type="button" style=${{ '--d': (P.anim[i] || 0) + 's' }} className=${cx('vp-card', hand.held && hand.held[i] && hand.phase === 'hold' && 'held', scoring.indexOf(i) >= 0 && 'scoring')} disabled=${hand.phase !== 'hold'} onClick=${function () { var A = window.CasinoGL && CasinoGL.audio; if (A) { if (hand.held && hand.held[i]) A.unhold(); else A.hold(hand.held ? hand.held.filter(Boolean).length : 0); } act('hold', { index: i }); }} aria-pressed=${!!(hand.held && hand.held[i])} aria-label=${'Card ' + (i + 1) + (hand.held && hand.held[i] ? ', held' : '')}>
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
