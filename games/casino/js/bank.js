/* Neon Casino — the bank: casino loans, repayments, player-to-player loan offers, and the "out of chips" and
   bankruptcy banners. Every number shown before a decision is computed the same way the server computes it
   (games/casino/server/bank.mjs); the server re-checks everything when the button is pressed. */
(function () {
  'use strict';
  var R = React, useState = R.useState, useEffect = R.useEffect;
  var UI = window.CasinoUI, html = UI.html, cx = UI.cx, money = UI.money, Button = UI.Button, Avatar = UI.Avatar, useNow = UI.useNow;

  function total(amount, rate) { return amount + Math.ceil((amount * rate) / 100); }
  function name(v, id) { var p = UI.byId(v, id); return p ? p.name : 'Someone'; }
  function until(at, now) {
    if (at == null) return '';
    var ms = at - now;
    if (ms <= 0) return 'now';
    return UI.clockText(ms);
  }
  function int(v) { var n = Number(v); return v === '' || !isFinite(n) ? '' : Math.max(0, Math.round(n)); }

  function MoneyInput(props) {
    return html`<label className="field"><span>${props.label}</span>
      <div className=${cx('num-input', !props.plain && 'is-money')}>
        <input type="number" inputMode="numeric" min="0" step="1" value=${props.value} disabled=${props.disabled}
          onInput=${function (e) { props.onChange(int(e.target.value)); }} />
      </div></label>`;
  }

  // ───────────── casino loan desk ─────────────
  function LoanDesk(props) {
    var v = props.view, b = v.me.bank, acc = v.me.account, rules = b.rules, now = props.now;
    var a = useState(''), amount = a[0], setAmount = a[1];
    var r = useState(''), repayAmt = r[0], setRepay = r[1];
    var e = useState(''), err = e[0], setErr = e[1];
    var owedCasino = acc.debt + acc.interest;
    var me = UI.byId(v, v.you);
    var blocked = !rules.casino ? 'The host has turned off casino loans.' : me.status === 'bankrupt' ? 'Bankrupt players can’t borrow.' : !b.creditAvailable ? 'You’ve used all your credit.' : null;
    var amt = amount === '' ? 0 : amount;
    var perPeriod = Math.ceil(((acc.debt + amt) * rules.interestPct) / 100);
    function act(cmd, reset) { setErr(''); return props.send(cmd).then(function (res) { if (res.error) setErr(res.error); else reset(''); }); }
    return html`<section className="bank-section">
      <div className="bank-head"><h3>Casino loan desk</h3><span className="muted small">Credit left <b className="num">${money(b.creditAvailable)}</b> of ${money(rules.creditLimit)}</span></div>
      ${blocked ? html`<p className="muted small">${blocked}</p>` : html`<div className="bank-form">
        <${MoneyInput} label="Borrow" value=${amount} onChange=${setAmount} />
        <div className="quick">${[1000, 2500, 5000].filter(function (q) { return q <= b.creditAvailable; }).map(function (q) {
          return html`<button key=${q} type="button" className="btn btn-ghost" onClick=${function () { setAmount(q); }}>${money(q)}</button>`; })}
          <button type="button" className="btn btn-ghost" onClick=${function () { setAmount(b.creditAvailable); }}>Max</button></div>
        ${amt > 0 ? html`<div className="consequence">
          <p>You get <b className="gold">${money(amt)}</b> now. Your casino debt becomes <b>${money(acc.debt + amt)}</b>.</p>
          <p>${rules.interestPct ? html`Interest: <b>${rules.interestPct}%</b> every ${rules.interestEveryMin} min of play — about <b className="red">${money(perPeriod)}</b> each time, which comes off your net worth.` : 'No interest is charged.'}</p>
          <p>Repay within <b>${rules.termMin} min</b> of play. After that the casino takes what it’s owed from your cash, including future winnings.</p>
        </div>` : null}
        <${Button} kind="primary" disabled=${!amt || amt > b.creditAvailable} onClick=${function () { return act({ type: 'borrow', amount: amt }, setAmount); }}>${amt > b.creditAvailable ? 'Over your credit' : 'Borrow ' + (amt ? money(amt) : '')}</${Button}>
      </div>`}
      ${owedCasino ? html`<div className="bank-form">
        <div className="owed-line"><span>You owe the casino <b className="red num">${money(owedCasino)}</b>${acc.interest ? html` <span className="muted small">(${money(acc.interest)} interest)</span>` : null}</span>
          ${b.nextInterest && b.nextInterestAt ? html`<span className="muted small">Next interest ${money(b.nextInterest)} in ${b.clockRunning ? until(b.nextInterestAt, now) : 'paused'}</span>` : null}</div>
        <div className="row">
          <div className="grow"><${MoneyInput} label="Repay" value=${repayAmt} onChange=${setRepay} /></div>
          <${Button} onClick=${function () { return act({ type: 'repay', amount: repayAmt }, setRepay); }} disabled=${!repayAmt}>Repay</${Button}>
          <${Button} kind="ghost" disabled=${acc.cash < 1} onClick=${function () { return act({ type: 'repay', amount: Math.min(acc.cash, owedCasino) }, setRepay); }}>${acc.cash >= owedCasino ? 'Repay all' : 'Repay ' + money(acc.cash)}</${Button}>
        </div>
        <p className="muted small">Repayments clear interest first, then your oldest loan.</p>
      </div>` : null}
      ${b.loans.filter(function (l) { return l.kind === 'casino'; }).length ? html`<ul className="loan-list">
        ${b.loans.filter(function (l) { return l.kind === 'casino'; }).map(function (l) {
          return html`<li key=${l.id} className=${cx(l.overdue && 'overdue')}><span>Loan of ${money(l.principal)}</span><b className="num">${money(l.due)} left</b>
            <span className=${cx('small', l.overdue ? 'red' : 'muted')}>${l.overdue ? 'Overdue — being collected' : 'Due in ' + (b.clockRunning ? until(l.dueAt, now) : 'paused')}</span></li>`;
        })}
      </ul>` : null}
      ${err ? html`<p className="form-error" role="alert">${err}</p>` : null}
    </section>`;
  }

  // ───────────── player loans ─────────────
  function Terms(props) {
    var t = props.terms, cap = props.cap;
    function set(k, val) { var n = Object.assign({}, t); n[k] = val; props.onChange(n); }
    return html`<div className="terms-grid">
      <${MoneyInput} label="Amount" value=${t.amount} onChange=${function (x) { set('amount', x); }} />
      <label className="field"><span>Interest % (max ${cap})</span><div className="num-input"><input type="number" min="0" max=${cap} step="1" value=${t.ratePct} onInput=${function (e) { set('ratePct', int(e.target.value)); }} /></div></label>
      <label className="field"><span>Repay within (min)</span><div className="num-input"><input type="number" min="5" max="600" step="5" value=${t.termMin} onInput=${function (e) { set('termMin', int(e.target.value)); }} /></div></label>
    </div>`;
  }

  /** What accepting means for *you*, in plain words. */
  function OfferText(props) {
    var v = props.view, o = props.offer, me = v.you, tot = total(o.amount || 0, o.ratePct || 0);
    if (o.borrower === me) return html`<p>You get <b className="gold">${money(o.amount)}</b> from ${name(v, o.lender)} now and owe <b className="red">${money(tot)}</b> within ${o.termMin} min of play. If it isn’t repaid by then, ${name(v, o.lender)} collects from your cash.</p>`;
    return html`<p>You give ${name(v, o.borrower)} <b>${money(o.amount)}</b> now and are owed <b className="green">${money(tot)}</b> back within ${o.termMin} min of play (${o.ratePct}% interest). Unpaid debt still counts for you at the end of the night.</p>`;
  }

  function OfferCard(props) {
    var v = props.view, o = props.offer, mine = o.awaiting === v.you;
    var c = useState(null), counter = c[0], setCounter = c[1];
    var e = useState(''), err = e[0], setErr = e[1];
    var other = o.lender === v.you ? o.borrower : o.lender;
    function act(cmd) { setErr(''); return props.send(cmd).then(function (res) { if (res.error) setErr(res.error); else setCounter(null); }); }
    return html`<li className=${cx('offer', mine && 'needs-me')}>
      <div className="offer-head"><${Avatar} id=${(UI.byId(v, other) || {}).avatar} /><b>${o.lender === v.you ? 'You lend ' + name(v, other) : name(v, other) + ' lends you'}</b>
        <span className="tag">${o.version > 1 ? 'Countered' : 'Offer'}</span></div>
      <${OfferText} view=${v} offer=${counter ? Object.assign({}, o, counter) : o} />
      ${counter ? html`<${Terms} terms=${counter} cap=${v.me.bank.rules.p2pMaxPct} onChange=${setCounter} />` : null}
      ${err ? html`<p className="form-error" role="alert">${err}</p>` : null}
      <div className="row end">
        ${mine && !counter ? html`<${Button} kind="ghost" onClick=${function () { return act({ type: 'loan-decline', offerId: o.id }); }}>Decline</${Button}>
          <${Button} onClick=${function () { setCounter({ amount: o.amount, ratePct: o.ratePct, termMin: o.termMin }); }}>Counter</${Button}>
          <${Button} kind="primary" onClick=${function () { return act({ type: 'loan-accept', offerId: o.id, version: o.version }); }}>Accept</${Button}>` : null}
        ${mine && counter ? html`<${Button} kind="ghost" onClick=${function () { setCounter(null); }}>Back</${Button}>
          <${Button} kind="primary" onClick=${function () { return act({ type: 'loan-counter', offerId: o.id, amount: counter.amount, ratePct: counter.ratePct, termMin: counter.termMin }); }}>Send counter-offer</${Button}>` : null}
        ${!mine ? html`<span className="muted small">Waiting for ${name(v, other)}…</span><${Button} kind="ghost" onClick=${function () { return act({ type: 'loan-decline', offerId: o.id }); }}>Withdraw</${Button}>` : null}
      </div>
    </li>`;
  }

  function PlayerLoans(props) {
    var v = props.view, b = v.me.bank, now = props.now;
    var others = v.players.filter(function (p) { return p.id !== v.you && p.hasWallet && p.status === 'active'; });
    var w = useState(others[0] ? others[0].id : ''), who = w[0], setWho = w[1];
    var rl = useState('lend'), role = rl[0], setRole = rl[1];
    var t = useState({ amount: 1000, ratePct: Math.min(10, b.rules.p2pMaxPct), termMin: b.rules.termMin }), terms = t[0], setTerms = t[1];
    var e = useState(''), err = e[0], setErr = e[1];
    var rp = useState({}), repay = rp[0], setRepay = rp[1];
    useEffect(function () { if (!others.some(function (p) { return p.id === who; }) && others[0]) setWho(others[0].id); }, [others.length]);
    if (!b.rules.p2p) return html`<section className="bank-section"><h3>Player loans</h3><p className="muted small">The host has turned off player loans.</p></section>`;
    var draft = { lender: role === 'lend' ? v.you : who, borrower: role === 'lend' ? who : v.you, amount: terms.amount || 0, ratePct: terms.ratePct || 0, termMin: terms.termMin || 0 };
    function send() {
      setErr('');
      return props.send({ type: 'loan-offer', to: who, role: role, amount: terms.amount, ratePct: terms.ratePct, termMin: terms.termMin }).then(function (res) { if (res.error) setErr(res.error); });
    }
    var owe = b.loans.filter(function (l) { return l.kind === 'p2p' && l.borrower === v.you; });
    var owedMe = b.loans.filter(function (l) { return l.kind === 'p2p' && l.lender === v.you; });
    return html`<section className="bank-section">
      <div className="bank-head"><h3>Player loans</h3><span className="muted small">Both sides must accept. Interest is charged once, up to ${b.rules.p2pMaxPct}%.</span></div>
      ${b.offers.length ? html`<ul className="offer-list">${b.offers.map(function (o) { return html`<${OfferCard} key=${o.id + ':' + o.version} view=${v} offer=${o} send=${props.send} />`; })}</ul>` : null}
      ${owe.length || owedMe.length ? html`<ul className="loan-list">
        ${owe.map(function (l) {
          return html`<li key=${l.id} className=${cx(l.overdue && 'overdue')}>
            <span>You owe ${name(v, l.lender)}</span><b className="num red">${money(l.due)}</b>
            <span className=${cx('small', l.overdue ? 'red' : 'muted')}>${l.overdue ? 'Overdue — being collected' : 'Due in ' + (b.clockRunning ? until(l.dueAt, now) : 'paused')}</span>
            <div className="row repay-row">
              <input type="number" min="1" step="1" aria-label="Amount to repay" placeholder=${String(Math.min(l.due, v.me.account.cash))} value=${repay[l.id] || ''} onInput=${function (ev) { var n = Object.assign({}, repay); n[l.id] = int(ev.target.value); setRepay(n); }} />
              <${Button} onClick=${function () { var amt = repay[l.id] || Math.min(l.due, v.me.account.cash); return props.send({ type: 'loan-repay', loanId: l.id, amount: amt }).then(function () { var n = Object.assign({}, repay); delete n[l.id]; setRepay(n); }); }} disabled=${v.me.account.cash < 1}>Repay</${Button}>
            </div>
          </li>`;
        })}
        ${owedMe.map(function (l) {
          return html`<li key=${l.id} className=${cx(l.overdue && 'overdue')}><span>${name(v, l.borrower)} owes you</span><b className="num green">${money(l.due)}</b>
            <span className=${cx('small', l.overdue ? 'red' : 'muted')}>${l.overdue ? 'Overdue — collecting from their winnings' : 'Due in ' + (b.clockRunning ? until(l.dueAt, now) : 'paused')}</span></li>`;
        })}
      </ul>` : null}
      ${others.length ? html`<div className="bank-form new-offer">
        <div className="row">
          <div className="seg" role="radiogroup" aria-label="Lend or borrow">
            <button type="button" role="radio" aria-checked=${role === 'lend'} className=${cx(role === 'lend' && 'on')} onClick=${function () { setRole('lend'); }}>Lend</button>
            <button type="button" role="radio" aria-checked=${role === 'borrow'} className=${cx(role === 'borrow' && 'on')} onClick=${function () { setRole('borrow'); }}>Borrow</button>
          </div>
          <label className="field grow"><span>${role === 'lend' ? 'To' : 'From'}</span>
            <select value=${who} onChange=${function (ev) { setWho(ev.target.value); }}>${others.map(function (p) { return html`<option key=${p.id} value=${p.id}>${p.name} · ${money(p.cash)}</option>`; })}</select></label>
        </div>
        <${Terms} terms=${terms} cap=${b.rules.p2pMaxPct} onChange=${setTerms} />
        ${draft.amount > 0 ? html`<div className="consequence"><${OfferText} view=${v} offer=${draft} /></div>` : null}
        ${err ? html`<p className="form-error" role="alert">${err}</p>` : null}
        <div className="row end"><${Button} kind="primary" onClick=${send} disabled=${!who || !(terms.amount > 0)}>Send offer</${Button}></div>
      </div>` : html`<p className="muted small">No one else can take a loan right now.</p>`}
    </section>`;
  }

  function BankDrawer(props) {
    var v = props.view, b = v.me && v.me.bank, acc = v.me && v.me.account;
    var now = useNow(v, 1000);
    useEffect(function () { function k(e) { if (e.key === 'Escape') props.onClose(); } addEventListener('keydown', k); return function () { removeEventListener('keydown', k); }; }, []);
    return html`<div className="drawer-scrim" onClick=${function (e) { if (e.target === e.currentTarget) props.onClose(); }}>
      <aside className="drawer bank" role="dialog" aria-modal="true" aria-labelledby="bank-h">
        <div className="panel-head"><h2 id="bank-h">Bank</h2><button type="button" className="btn btn-ghost" onClick=${props.onClose}>Close</button></div>
        ${!b ? html`<p className="muted">The bank opens when the session starts and you have a wallet.</p>` : html`<${R.Fragment}>
          <div className="ledger-summary">
            <div><span className="muted small">Cash</span><b className="num gold">${money(acc.cash)}</b></div>
            <div><span className="muted small">Net worth</span><b className="num">${money(acc.netWorth)}</b></div>
            <div><span className="muted small">Owed to the casino</span><b className="num red">${money(acc.debt + acc.interest)}</b></div>
            <div><span className="muted small">Owed to players</span><b className="num red">${money(acc.owes)}</b></div>
            <div className="span2"><span className="muted small">Players owe you</span><b className="num green">${money(acc.owed)}</b></div>
          </div>
          <${LoanDesk} view=${v} send=${props.send} now=${now} />
          <${PlayerLoans} view=${v} send=${props.send} now=${now} />
        </${R.Fragment}>`}
      </aside>
    </div>`;
  }

  /** The one banner a broke or bankrupt player always sees. */
  function MoneyBanner(props) {
    var v = props.view, me = UI.byId(v, v.you), now = useNow(v, 500);
    if (!me) return null;
    if (me.status === 'bankrupt') {
      return html`<div className="banner bankrupt" role="status"><span><b>You’re bankrupt.</b> You can watch every table, chat and react until the host starts a new session. Your debts stay on the books.</span></div>`;
    }
    if (me.insolvent) {
      var left = me.insolvent.until ? Math.max(0, me.insolvent.until - now) : me.insolvent.leftMs;
      return html`<div className="banner broke" role="alert"><span><b>You’re out of chips.</b> Ask another player for a loan — you’ll be declared bankrupt in <b className="num">${UI.clockText(left)}</b>${me.insolvent.until ? '' : ' (paused)'}.</span>
        <button type="button" className="btn" onClick=${props.onBank}>Open bank</button></div>`;
    }
    return null;
  }

  /** Who owes whom, for everyone to see. */
  function DebtBoard(props) {
    var v = props.view, now = useNow(v, 5000);
    var debts = (v.bank && v.bank.debts) || [];
    if (!debts.length) return null;
    return html`<div className="debt-board">
      <span className="eyebrow">Debts between players</span>
      <ul>${debts.map(function (d) {
        return html`<li key=${d.id} className=${cx(d.overdue && 'overdue')}><span>${name(v, d.borrower)} owes ${name(v, d.lender)}</span><b className="num">${money(d.due)}</b>
          <span className=${cx('small', d.overdue ? 'red' : 'muted')}>${d.overdue ? 'overdue' : v.session.phase === 'live' ? until(d.dueAt, now) : ''}</span></li>`;
      })}</ul>
    </div>`;
  }

  window.CasinoBank = { BankDrawer: BankDrawer, MoneyBanner: MoneyBanner, DebtBoard: DebtBoard };
})();
