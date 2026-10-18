/* Neon Casino — the Texas Hold'em table. Draws the hand the server sends (only your own hole cards until showdown)
   and sends fold / check / call / raise / all in. Pots, side pots and the winner are decided on the server. */
(function () {
  'use strict';
  var R = React, useState = R.useState, useEffect = R.useEffect;
  var UI = window.CasinoUI, html = UI.html, cx = UI.cx, money = UI.money, signed = UI.signed, Button = UI.Button, useNow = UI.useNow;
  var K = window.CasinoKit, Cards = K.Cards, Stack = K.Stack, TimerBar = K.TimerBar;
  var OvalScene = window.CasinoCardroom.OvalScene;

  var STREET = { preflop: 'Pre-flop', flop: 'Flop', turn: 'Turn', river: 'River' };
  var ACT = { fold: 'Fold', check: 'Check', call: 'Call', raise: 'Raise', allin: 'All in' };

  function Rules(props) {
    var r = props.rules;
    return html`<div className="rules-card">
      <h3>How this table plays</h3>
      <ul>
        <li>No-limit Texas Hold'em. Blinds ${money(r.sb)} / ${money(r.bb)}. You can risk up to ${money(r.maxIn)} of your wallet in one hand.</li>
        <li>Two hole cards each, five shared cards (flop, turn, river). Best five of your seven cards wins.</li>
        <li>Hands, high to low: straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, pair, high card.</li>
        <li>A raise must be at least the last bet or raise. An all-in for less doesn't reopen raising for players who already acted.</li>
        <li>Short all-ins make side pots: you can only win what you matched from each player. Ties split the pot.</li>
        <li>You get ${r.turnSec}s per move; if time runs out you check, or fold if you face a bet. Standing up folds your hand.</li>
      </ul>
    </div>`;
  }

  function PokerTable(props) {
    var v = props.view, table = props.table, st = table.state, you = st.you, me = UI.byId(v, v.you);
    var h = st.phase === 'playing' ? st.hand : null;      // a finished hand stays on the server during results; show the results instead
    var now = useNow(v, 250);
    var rl = useState(false), showRules = rl[0], setRules = rl[1];
    var rs = useState(0), raiseTo = rs[0], setRaiseTo = rs[1];
    useEffect(function () { if (you.moves && you.moves.indexOf('raise') >= 0) setRaiseTo(you.minRaiseTo); }, [h && h.currentBet, h && h.street, h && h.turn]);
    var mySeat = st.seats.indexOf(v.you);
    var last = st.last;
    function play(action, extra) { return props.send(Object.assign({ type: 'play', tableId: table.id, action: action }, extra || {})); }

    function seatBody(pid) {
      var p = h && h.players.filter(function (x) { return x.pid === pid; })[0];
      if (p) {
        var cards = p.hole || (p.folded ? [] : [null, null]);
        return html`<div className=${cx('cr-hand', p.folded && 'folded', h.turn === pid && 'active')}>
          ${cards.length ? html`<${Cards} cards=${cards} />` : null}
          ${p.street ? html`<${Stack} amount=${p.street} />` : null}
        </div>`;
      }
      if (last && last.shown && last.hands[pid] && st.phase === 'results') {
        var won = last.pots.some(function (pt) { return pt.winners.indexOf(pid) >= 0; });
        return html`<div className=${cx('cr-hand', won && 'winner')}><${Cards} cards=${last.hands[pid].hole} /><span className=${cx('tag result', won ? 'result-win' : '')}>${last.hands[pid].name}</span></div>`;
      }
      return null;
    }
    function plaqueExtra(pid) {
      var p = h && h.players.filter(function (x) { return x.pid === pid; })[0];
      if (st.phase === 'results' && last && last.players[pid]) { var n = last.players[pid].net; return html`<span className=${cx('plaque-status num', n > 0 ? 'green' : n < 0 ? 'red' : '')}>${n ? signed(n) : 'Even'}</span>`; }
      if (!p) return null;
      if (p.folded) return html`<span className="plaque-status muted">Folded</span>`;
      if (p.allIn) return html`<span className="plaque-status gold">All in</span>`;
      var act = h.log.slice().reverse().filter(function (l) { return l.pid === pid && l.street === h.street; })[0];
      return act ? html`<span className="plaque-status">${ACT[act.action]}${act.action === 'raise' || act.action === 'call' ? ' ' + money(act.to) : ''}</span>` : null;
    }

    function glHand(pid) {
      var p = h && h.players.filter(function (x) { return x.pid === pid; })[0];
      if (p) return { cards: p.hole && p.hole.length ? p.hole : (p.folded ? [] : [null, null]), bet: p.street || 0 };
      if (last && last.shown && last.hands[pid] && st.phase === 'results') { var won = last.pots.some(function (pt) { return pt.winners.indexOf(pid) >= 0; }); return { cards: last.hands[pid].hole, bet: 0, note: last.hands[pid].name, noteCls: won ? 'win' : '' }; }
      return null;
    }
    function glStatus(pid) {
      var p = h && h.players.filter(function (x) { return x.pid === pid; })[0];
      if (st.phase === 'results' && last && last.players[pid]) { var n = last.players[pid].net; return { text: n ? signed(n) : 'Even', cls: n > 0 ? 'green' : n < 0 ? 'red' : '' }; }
      if (!p) return null;
      if (p.folded) return { text: 'Folded', cls: 'muted' };
      if (p.allIn) return { text: 'All in', cls: 'gold' };
      var act = h.log.slice().reverse().filter(function (l) { return l.pid === pid && l.street === h.street; })[0];
      return act ? { text: ACT[act.action] + (act.action === 'raise' || act.action === 'call' ? ' ' + money(act.to) : ''), cls: '' } : null;
    }
    var board = h ? h.board : last ? last.board : [];
    var centerText = h ? 'Pot ' + money(h.pot) + ' · ' + STREET[h.street]
      : last ? last.pots.map(function (pt) { var names = pt.winners.map(function (id) { var q = UI.byId(v, id); return q ? q.name : '?'; }).join(' & '); return pt.uncalled ? money(pt.amount) + ' back to ' + names : money(pt.amount) + ' to ' + names + (pt.hand ? ' (' + pt.hand.toLowerCase() + ')' : ''); }).join(' · ')
      : st.seats.filter(Boolean).length < 2 ? 'Waiting for a second player' : 'Next hand starting…';
    var myP = h && h.players.filter(function (x) { return x.pid === v.you; })[0];
    var center = html`<div className="cr-middle">
      <div className="board">${[0, 1, 2, 3, 4].map(function (i) { return board[i] ? html`<${K.Card} key=${i + board[i]} card=${board[i]} i=${i} />` : html`<span key=${'e' + i} className="card-slot"></span>`; })}</div>
      ${h ? html`<span className="pot-tag">Pot <b className="num">${money(h.pot)}</b> · ${STREET[h.street]}</span>`
        : last ? html`<span className="pot-tag">${last.pots.map(function (pt, i) {
            var names = pt.winners.map(function (id) { var p = UI.byId(v, id); return p ? p.name : '?'; }).join(' & ');
            if (pt.uncalled) return html`<span key=${i}>${i ? ' · ' : ''}${money(pt.amount)} uncalled, back to ${names}</span>`;
            return html`<span key=${i}>${i ? ' · ' : ''}${pots(last) > 1 ? (i ? 'Side pot ' : 'Main pot ') : ''}${money(pt.amount)} to <b>${names}</b>${pt.hand ? ' (' + pt.hand.toLowerCase() + ')' : ''}</span>`;
          })}</span>`
        : html`<span className="pot-tag">${st.seats.filter(Boolean).length < 2 ? 'Waiting for a second player' : 'Next hand starting…'}</span>`}
    </div>`;
    function pots(l) { return l.pots.filter(function (pt) { return !pt.uncalled; }).length; }

    var dock;
    if (!st.seated) {
      var blocked = me && me.status !== 'active';
      dock = html`<div className="dock-row"><span className="muted">${blocked ? 'You’re watching this table.' : 'You’re watching. Take a seat to play.'}</span>
        ${!blocked ? html`<${Button} kind="primary" onClick=${props.onSit} disabled=${st.seats.indexOf(null) < 0}>${st.seats.indexOf(null) < 0 ? 'Table full' : 'Take a seat'}</${Button}>` : null}</div>`;
    } else if (you.moves.length) {
      var pot = h.pot, toCall = you.toCall;
      var quick = [['½ pot', Math.round(h.currentBet + toCall + pot / 2)], ['Pot', h.currentBet + toCall + pot]].map(function (q) { return [q[0], Math.max(you.minRaiseTo, Math.min(you.maxRaiseTo, q[1]))]; });
      dock = html`<div className="dock-poker">
        <div className="dock-actions">
          <${Button} className="act" onClick=${function () { return play('fold'); }}>Fold</${Button}>
          ${toCall ? html`<${Button} className="act" kind="primary" onClick=${function () { return play('call'); }}>Call <small>${money(Math.min(toCall, you.stack))}</small></${Button}>`
            : html`<${Button} className="act" kind="primary" onClick=${function () { return play('check'); }}>Check</${Button}>`}
          ${you.moves.indexOf('raise') >= 0 ? html`<${Button} className="act" onClick=${function () { return play('raise', { to: raiseTo }); }}>${h.currentBet ? 'Raise to' : 'Bet'} <small>${money(raiseTo)}</small></${Button}>` : null}
          <${Button} className="act danger-soft" onClick=${function () { return play('allin'); }}>All in <small>${money(you.stack)}</small></${Button}>
        </div>
        ${you.moves.indexOf('raise') >= 0 ? html`<div className="raise-row">
          <input type="range" min=${you.minRaiseTo} max=${you.maxRaiseTo} step=${Math.max(1, Math.round(h.bb / 2))} value=${raiseTo} aria-label="Raise amount" onInput=${function (e) { setRaiseTo(Number(e.target.value)); }} />
          ${quick.map(function (q) { return html`<button key=${q[0]} type="button" className="btn btn-ghost" onClick=${function () { setRaiseTo(q[1]); }}>${q[0]}</button>`; })}
        </div>` : null}
        <${TimerBar} timer=${st.timer} now=${now} />
      </div>`;
    } else {
      var msg = v.session.phase === 'paused' ? 'The host paused the session.'
        : h && you.inHand ? (you.folded ? 'You folded. Next hand soon.' : 'Waiting for your turn…')
        : st.phase === 'results' ? 'Next hand in a moment.'
        : h ? 'You’re in the next hand.'
        : st.seats.filter(Boolean).length < 2 ? 'Waiting for another player to sit down.' : 'Dealing shortly…';
      dock = html`<div className="dock-row"><span className="muted">${msg}${h && you.best ? html` · You have <b className="gold">${you.best.toLowerCase()}</b>` : null}</span></div>`;
    }

    var mine = last && last.players[v.you];
    return html`<section className="cr game-poker" aria-label=${table.name}>
      <div className="table-bar">
        <button type="button" className="btn btn-ghost" onClick=${props.onBack}>← Casino floor</button>
        <div className="table-bar-title"><h2>${table.name}</h2><span className="muted small num">Blinds ${money(st.rules.sb)} / ${money(st.rules.bb)}</span></div>
        <div className="row">
          <button type="button" className="btn btn-ghost" aria-expanded=${showRules} onClick=${function () { setRules(!showRules); }}>Rules & hands</button>
          ${st.seated ? html`<button type="button" className="btn btn-ghost" onClick=${props.onStand}>Stand up</button>` : null}
        </div>
      </div>
      ${showRules ? html`<${Rules} rules=${st.rules} />` : null}
      <${OvalScene} view=${v} state=${st} n=${st.seats.length} mySeat=${mySeat} turnPid=${h ? h.turn : null} buttonSeat=${st.button} now=${now}
        canSit=${!st.seated && me && me.status === 'active'} onSit=${props.onSit} seatBody=${seatBody} plaqueExtra=${plaqueExtra} center=${center}
        print="TEXAS HOLD'EM · NO LIMIT"
        glHand=${glHand} glStatus=${glStatus} glKey=${h ? h.id : last ? last.handId : ''} board=${board.slice(0, h ? board.length : 5)} pot=${h ? h.pot : 0} centerText=${centerText}
        myHand=${myP && myP.hole && myP.hole.length && !myP.folded ? myP.hole : null} theme=${{ felt: '#123f2f', ink: '#d6e8dc', print: "TEXAS HOLD'EM", print2: 'NO LIMIT' }} dim=${function (pid) { return h && h.players.some(function (x) { return x.pid === pid && x.folded; }); }} />
      ${mine && st.phase !== 'playing' ? html`<div className=${cx('round-summary', mine.net > 0 && 'up', mine.net < 0 && 'down')} role="status">
        <span className="eyebrow">Last hand</span>
        <span>Put in <b className="num">${money(mine.staked)}</b></span>
        <b className="num">${mine.net ? signed(mine.net) : 'Even'}</b>
        <span className="muted">Cash now <b className="num">${money(mine.cash)}</b></span>
      </div>` : null}
      <div className="dock">${dock}</div>
    </section>`;
  }

  window.CasinoTables = window.CasinoTables || {};
  window.CasinoTables.poker = PokerTable;
})();
