/* Neon Casino — the Teen Patti table. Your three cards stay face down (even to you) until you choose to see them;
   seeing doubles what each bet costs you. The server prices every move and decides every show. */
(function () {
  'use strict';
  var R = React, useState = R.useState;
  var UI = window.CasinoUI, html = UI.html, cx = UI.cx, money = UI.money, signed = UI.signed, Button = UI.Button, useNow = UI.useNow;
  var K = window.CasinoKit, Cards = K.Cards, Stack = K.Stack, TimerBar = K.TimerBar;
  var OvalScene = window.CasinoCardroom.OvalScene;

  var ACT = { chaal: 'Chaal', raise: 'Raise', pack: 'Packed', see: 'Seen', show: 'Show', allin: 'All in' };

  function Rules(props) {
    var r = props.rules;
    return html`<div className="rules-card">
      <h3>How this table plays</h3>
      <ul>
        <li>Everyone puts in the boot (${money(r.boot)}) and gets three cards face down.</li>
        <li><b>Blind</b> (cards unseen): chaal costs the current stake, a raise costs twice the stake. <b>Seen</b>: everything costs double.</li>
        <li>A raise doubles the stake for everyone. Pack to fold. With two players left, either can ask for a <b>show</b>.</li>
        <li>When the pot reaches ${money(r.potLimit)}, everyone still in shows. If you can't afford the next bet you can go all in, which shows every hand (side pots keep it fair).</li>
        <li>Hands, high to low: trail (three of a kind), pure sequence, sequence, color, pair, high card. A-K-Q is the top sequence, then A-2-3. Ties split the pot.</li>
        <li>You get ${r.turnSec}s per move; if time runs out you pack. Standing up packs your hand.</li>
      </ul>
    </div>`;
  }

  function TeenPattiTable(props) {
    var v = props.view, table = props.table, st = table.state, you = st.you, me = UI.byId(v, v.you);
    var h = st.phase === 'playing' ? st.hand : null;      // a finished hand stays on the server during results; show the results instead
    var now = useNow(v, 250);
    var rl = useState(false), showRules = rl[0], setRules = rl[1];
    var mySeat = st.seats.indexOf(v.you);
    var last = st.last;
    function play(action) { return props.send({ type: 'play', tableId: table.id, action: action }); }

    function seatBody(pid) {
      var p = h && h.players.filter(function (x) { return x.pid === pid; })[0];
      if (p) {
        return html`<div className=${cx('cr-hand', p.folded && 'folded', h.turn === pid && 'active')}>
          ${p.folded ? null : html`<${Cards} cards=${p.cards || [null, null, null]} />`}
          ${p.contrib ? html`<${Stack} amount=${p.contrib} />` : null}
        </div>`;
      }
      if (last && last.shown && last.hands[pid] && st.phase === 'results') {
        var won = last.pots.some(function (pt) { return pt.winners.indexOf(pid) >= 0; });
        return html`<div className=${cx('cr-hand', won && 'winner')}><${Cards} cards=${last.hands[pid].cards} /><span className=${cx('tag result', won ? 'result-win' : '')}>${last.hands[pid].name}</span></div>`;
      }
      return null;
    }
    function plaqueExtra(pid) {
      var p = h && h.players.filter(function (x) { return x.pid === pid; })[0];
      if (st.phase === 'results' && last && last.players[pid]) { var n = last.players[pid].net; return html`<span className=${cx('plaque-status num', n > 0 ? 'green' : n < 0 ? 'red' : '')}>${n ? signed(n) : 'Even'}</span>`; }
      if (!p) return null;
      if (p.folded) return html`<span className="plaque-status muted">Packed</span>`;
      if (p.allIn) return html`<span className="plaque-status gold">All in</span>`;
      return html`<span className=${cx('plaque-status', p.seen ? 'seen' : 'blind')}>${p.seen ? 'Seen' : 'Blind'}</span>`;
    }

    var center = html`<div className="cr-middle">
      ${h ? html`<span className="pot-tag big">Pot <b className="num">${money(h.pot)}</b></span>
        <span className="pot-tag">Stake ${money(h.stake)} · limit ${money(h.potLimit)}</span>`
      : last ? html`<span className="pot-tag">${last.pots.map(function (pt, i) {
          var names = pt.winners.map(function (id) { var p = UI.byId(v, id); return p ? p.name : '?'; }).join(' & ');
          return html`<span key=${i}>${i ? ' · ' : ''}${money(pt.amount)} to <b>${names}</b>${pt.hand ? ' (' + pt.hand.toLowerCase() + ')' : ''}</span>`;
        })}</span>`
      : html`<span className="pot-tag">${st.seats.filter(Boolean).length < 2 ? 'Waiting for a second player' : 'Next hand starting…'}</span>`}
    </div>`;

    var dock;
    if (!st.seated) {
      var blocked = me && me.status !== 'active';
      dock = html`<div className="dock-row"><span className="muted">${blocked ? 'You’re watching this table.' : 'You’re watching. Take a seat to play.'}</span>
        ${!blocked ? html`<${Button} kind="primary" onClick=${props.onSit} disabled=${st.seats.indexOf(null) < 0}>${st.seats.indexOf(null) < 0 ? 'Table full' : 'Take a seat'}</${Button}>` : null}</div>`;
    } else if (h && you.inHand && !you.folded) {
      var c = you.costs, m = you.moves, myTurn = m.indexOf('pack') >= 0;
      dock = html`<div className="dock-poker">
        <div className="dock-row tp-status">
          <span>${you.seen ? html`You have <b className="gold">${you.hand.toLowerCase()}</b>. You’re playing seen — bets cost double.` : 'You’re playing blind. Seeing your cards doubles what each bet costs.'}</span>
          ${m.indexOf('see') >= 0 ? html`<${Button} onClick=${function () { return play('see'); }}>See cards</${Button}>` : null}
        </div>
        ${myTurn ? html`<div className="dock-actions">
          <${Button} className="act" onClick=${function () { return play('pack'); }}>Pack</${Button}>
          ${m.indexOf('chaal') >= 0 ? html`<${Button} className="act" kind="primary" onClick=${function () { return play('chaal'); }}>Chaal <small>${money(c.chaal)}</small></${Button}>` : null}
          ${m.indexOf('raise') >= 0 ? html`<${Button} className="act" onClick=${function () { return play('raise'); }}>Raise <small>${money(c.raise)}</small></${Button}>` : null}
          ${m.indexOf('show') >= 0 ? html`<${Button} className="act" onClick=${function () { return play('show'); }}>Show <small>${money(Math.min(c.show, you.stack))}</small></${Button}>` : null}
          ${m.indexOf('allin') >= 0 ? html`<${Button} className="act danger-soft" onClick=${function () { return play('allin'); }}>All in <small>${money(you.stack)}</small></${Button}>` : null}
        </div>
        <${TimerBar} timer=${st.timer} now=${now} />` : html`<p className="muted small">Waiting for your turn…</p>`}
      </div>`;
    } else {
      var msg = v.session.phase === 'paused' ? 'The host paused the session.'
        : st.phase === 'results' ? 'Next hand in a moment.'
        : h && you.inHand ? 'You packed. Next hand soon.'
        : st.seats.filter(Boolean).length < 2 ? 'Waiting for another player to sit down.' : 'You’re in the next hand.';
      dock = html`<div className="dock-row"><span className="muted">${msg}</span></div>`;
    }

    var mine = last && last.players[v.you];
    return html`<section className="cr game-teenpatti" aria-label=${table.name}>
      <div className="table-bar">
        <button type="button" className="btn btn-ghost" onClick=${props.onBack}>← Casino floor</button>
        <div className="table-bar-title"><h2>${table.name}</h2><span className="muted small num">Boot ${money(st.rules.boot)}</span></div>
        <div className="row">
          <button type="button" className="btn btn-ghost" aria-expanded=${showRules} onClick=${function () { setRules(!showRules); }}>Rules & hands</button>
          ${st.seated ? html`<button type="button" className="btn btn-ghost" onClick=${props.onStand}>Stand up</button>` : null}
        </div>
      </div>
      ${showRules ? html`<${Rules} rules=${st.rules} />` : null}
      <${OvalScene} view=${v} state=${st} n=${st.seats.length} mySeat=${mySeat} turnPid=${h ? h.turn : null} buttonSeat=${st.dealer} now=${now}
        canSit=${!st.seated && me && me.status === 'active'} onSit=${props.onSit} seatBody=${seatBody} plaqueExtra=${plaqueExtra} center=${center}
        print="TEEN PATTI · 3 PATTI" dim=${function (pid) { return h && h.players.some(function (x) { return x.pid === pid && x.folded; }); }} />
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
  window.CasinoTables.teenpatti = TeenPattiTable;
})();
