/* Neon Casino — React UI (React 18 UMD + htm, no build step).
   Renders only the view the server sends this player. Every button sends an intent; the server decides. */
(function () {
  'use strict';
  var R = React, useState = R.useState, useEffect = R.useEffect, useRef = R.useRef, useMemo = R.useMemo;
  var html = htm.bind(R.createElement);
  var Net = window.CasinoNet;

  var VERSION = '1.0.0';
  var hub = window.Hub ? window.Hub.init({ id: 'casino', version: VERSION, title: 'Neon Casino' }) : null;
  var store = hub ? hub.storage('casino') : {
    get: function (k, d) { try { var v = localStorage.getItem('hub.casino.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('hub.casino.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  };

  var AVATARS = { fox: '🦊', tiger: '🐯', panda: '🐼', owl: '🦉', frog: '🐸', octopus: '🐙', unicorn: '🦄', dragon: '🐲', cat: '🐱', wolf: '🐺', koala: '🐨', shark: '🦈', monkey: '🐵', penguin: '🐧', lion: '🦁', robot: '🤖' };
  var EMOTES = { clap: '👏', fire: '🔥', laugh: '😂', shock: '😱', cry: '😭', money: '🤑', pray: '🙏', cool: '😎' };
  var GAME_INFO = {
    blackjack: { blurb: 'Beat the dealer to 21. Blackjack pays 3:2.', icon: '♠' },
    roulette: { blurb: 'European wheel, one zero. Straight up pays 35:1.', icon: '◎' },
    poker: { blurb: 'No-limit Texas Hold\'em against your friends.', icon: '♦' },
    teenpatti: { blurb: 'Three cards, blind or seen. Trail beats all.', icon: '♥' }
  };
  var ENTRY_LABEL = { stake: 'Starting cash', bet: 'Bet placed', refund: 'Bet refunded', settle: 'Round result', loan: 'Casino loan', repay: 'Loan repayment', interest: 'Interest', 'p2p-lend': 'Lent to a player', 'p2p-borrow': 'Borrowed from a player', 'p2p-repay': 'You repaid a player', 'p2p-repaid': 'A player repaid you', fee: 'Fee' };
  var PHASE_LABEL = { lobby: 'Lobby', live: 'Live', paused: 'Paused', ended: 'Session over' };

  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function money(n) { var v = Math.round(n || 0); return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US'); }
  function signed(n) { return n > 0 ? '+' + money(n) : money(n); }
  function clockText(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0');
  }
  function timeAgo(at, now) {
    var s = Math.max(0, Math.round((now - at) / 1000));
    if (s < 45) return 'now';
    if (s < 3600) return Math.round(s / 60) + 'm';
    return Math.round(s / 3600) + 'h';
  }
  function byId(view, id) { for (var i = 0; i < view.players.length; i++) if (view.players[i].id === id) return view.players[i]; return null; }

  /** Server-clock aware "now", ticking every `ms`. */
  function useNow(view, ms) {
    var offset = useRef(0);
    var s = useState(Date.now()), now = s[0], setNow = s[1];
    useEffect(function () { if (view) offset.current = view.serverNow - Date.now(); }, [view && view.serverNow]);
    useEffect(function () { var t = setInterval(function () { setNow(Date.now()); }, ms || 1000); return function () { clearInterval(t); }; }, [ms]);
    return now + offset.current;
  }

  function Avatar(props) {
    return html`<span className=${cx('avatar', props.size && 'avatar-' + props.size)} aria-hidden="true">${AVATARS[props.id] || '🙂'}</span>`;
  }

  function Button(props) {
    // Shows a busy state while the server answers, so double clicks can't send twice.
    var s = useState(false), busy = s[0], setBusy = s[1];
    function click(e) {
      if (busy || !props.onClick) return;
      var r = props.onClick(e);
      if (r && typeof r.then === 'function') { setBusy(true); r.then(function () { setBusy(false); }, function () { setBusy(false); }); }
    }
    return html`<button type=${props.type || 'button'} className=${cx('btn', props.kind && 'btn-' + props.kind, props.className)} disabled=${props.disabled || busy} onClick=${click} title=${props.title} aria-busy=${busy}>
      ${busy ? html`<span className="spinner" aria-hidden="true"></span>` : null}${props.children}</button>`;
  }

  window.CasinoUI = { AVATARS: AVATARS, EMOTES: EMOTES, html: html, cx: cx, money: money, signed: signed, clockText: clockText, byId: byId, useNow: useNow, Avatar: Avatar, Button: Button, store: store };

  // ───────────────────────── entrance ─────────────────────────
  function Entrance(props) {
    var hp = hub ? window.Hub.player() : null;
    var n = useState(store.get('name', (hp && hp.name) || '')), name = n[0], setName = n[1];
    var a = useState(store.get('avatar', 'fox')), avatar = a[0], setAvatar = a[1];
    var c = useState(props.initialCode || ''), code = c[0], setCode = c[1];
    var e = useState(''), err = e[0], setErr = e[1];
    var last = Net.available() ? Net.lastRoom() : null;

    function profile() {
      var nm = name.trim();
      if (!nm) { setErr('Pick a name first.'); return null; }
      store.set('name', nm); store.set('avatar', avatar);
      return { name: nm, avatar: avatar };
    }
    function run(p) { setErr(''); return p.then(function (res) { if (res && res.error) setErr(res.error); }); }
    function host() { var p = profile(); return p ? run(props.net.create(p)) : null; }
    function join(c2) {
      var p = profile(); if (!p) return null;
      var k = String(c2 || code).trim().toUpperCase();
      if (!/^[A-Z2-9]{5}$/.test(k)) { setErr('Room codes are 5 letters and numbers.'); return null; }
      return run(props.net.join(k, p));
    }

    return html`<main className="entrance">
      <div className="entrance-hero">
        <div className="logo-mark" aria-hidden="true"><span>♠</span><span>♥</span><span>♣</span><span>♦</span></div>
        <h1 className="logo">Neon <em>Casino</em></h1>
        <p className="lede">A private casino night for your friends. One shared wallet across every table — win it at blackjack, lose it at roulette. Play money only.</p>
      </div>
      ${!Net.available() ? html`<div className="panel notice-panel" role="alert">
        <b>The casino runs on the hub server.</b>
        <p>Balances and cards live on the server so nobody can edit their own wallet. Start it with <code>npm start</code> and open <code>http://localhost:8080</code>.</p>
      </div>` : html`<form className="panel entrance-card" onSubmit=${function (ev) { ev.preventDefault(); }}>
        <label className="field"><span>Your name</span>
          <input value=${name} maxLength="20" autoComplete="nickname" placeholder="e.g. Lucky Lou" onInput=${function (ev) { setName(ev.target.value); }} /></label>
        <fieldset className="field">
          <legend>Avatar</legend>
          <div className="avatar-grid" role="radiogroup">
            ${Object.keys(AVATARS).map(function (id) {
              return html`<button key=${id} type="button" role="radio" aria-checked=${avatar === id} aria-label=${id} className=${cx('avatar-pick', avatar === id && 'on')} onClick=${function () { setAvatar(id); }}>${AVATARS[id]}</button>`;
            })}
          </div>
        </fieldset>
        <div className="entrance-actions">
          <div className="entrance-col">
            <span className="eyebrow">Start a room</span>
            <${Button} kind="primary" onClick=${host} disabled=${props.status !== 'online'}>Host a casino night</${Button}>
            <small className="muted">You set the stakes, loans and session rules.</small>
          </div>
          <div className="entrance-or" aria-hidden="true">or</div>
          <div className="entrance-col">
            <span className="eyebrow">Join friends</span>
            <div className="join-row">
              <input className="code-input" value=${code} maxLength="5" placeholder="CODE" aria-label="Room code" autoCapitalize="characters" spellCheck="false"
                onInput=${function (ev) { setCode(ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); }}
                onKeyDown=${function (ev) { if (ev.key === 'Enter') join(); }} />
              <${Button} onClick=${function () { return join(); }} disabled=${props.status !== 'online' || code.length !== 5}>Join</${Button}>
            </div>
            ${last ? html`<button type="button" className="link" onClick=${function () { join(last); }}>Rejoin room ${last}</button>` : null}
          </div>
        </div>
        ${err ? html`<p className="form-error" role="alert">${err}</p>` : null}
        ${props.status !== 'online' ? html`<p className="muted small"><span className="spinner" aria-hidden="true"></span> Connecting to the casino…</p>` : null}
        ${props.closed ? html`<p className="form-error" role="alert">${props.closed}</p>` : null}
      </form>`}
      <p className="fineprint">Chips have no cash value. No deposits, no purchases, no cash-outs.</p>
    </main>`;
  }

  // ───────────────────────── top bar ─────────────────────────
  function TopBar(props) {
    var v = props.view, acc = v.me && v.me.account, s = v.session;
    var now = useNow(v, 1000);
    var copied = useState(false);
    function copy() {
      var url = location.href.split('#')[0] + '#join=' + v.code;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { copied[1](true); setTimeout(function () { copied[1](false); }, 1500); }, function () { });
    }
    var left = s.endsAt ? s.endsAt - now : s.remainingMs;
    var waiting = v.me && v.me.bank ? v.me.bank.offers.filter(function (o) { return o.awaiting === v.you; }).length : 0;
    return html`<header className="topbar">
      <div className="topbar-left">
        <span className="logo small">Neon <em>Casino</em></span>
        <button type="button" className="room-code" onClick=${copy} title="Copy a join link">
          <span className="eyebrow">Room</span><b>${v.code}</b><span className="copy-hint">${copied[0] ? 'Link copied' : 'Copy link'}</span>
        </button>
        <span className=${cx('phase-pill', 'phase-' + s.phase)}>
          ${PHASE_LABEL[s.phase]}${s.phase !== 'lobby' && s.phase !== 'ended' && left != null ? html` · <b className="num">${clockText(left)}</b>` : null}
          ${s.phase !== 'lobby' && s.phase !== 'ended' && s.mode === 'rounds' ? html` · <b className="num">${s.rounds}/${s.roundLimit}</b> rounds` : null}
        </span>
      </div>
      <div className="wallet" aria-label="Your wallet">
        ${acc && acc.staked ? html`
          <div className="wallet-item cash"><span>Cash</span><b className="num">${money(acc.cash)}</b></div>
          <div className="wallet-item"><span>In play</span><b className="num">${money(acc.reserved)}</b></div>
          <div className=${cx('wallet-item', (acc.debt + acc.interest + acc.owes) > 0 && 'debt')}><span>Debt</span><b className="num">${money(acc.debt + acc.interest + acc.owes)}</b></div>
          <div className="wallet-item worth"><span>Net worth</span><b className="num">${money(acc.netWorth)}</b></div>`
        : html`<div className="wallet-item"><span>Wallet</span><b>${s.phase === 'lobby' ? money(v.settings.startingCash) + ' at the start' : 'Spectating'}</b></div>`}
        <button type="button" className="btn btn-ghost" onClick=${props.onLedger}>History</button>
        ${acc && acc.staked ? html`<button type="button" className="btn btn-ghost bank-btn" onClick=${props.onBank}>Bank${waiting ? html`<span className="badge num" aria-label=${waiting + ' offers waiting for you'}>${waiting}</span>` : null}</button>` : null}
      </div>
      <div className="topbar-right">
        <span className=${cx('conn', 'conn-' + props.status)} title=${props.status === 'online' ? 'Connected' : 'Reconnecting…'}>${props.status === 'online' ? 'Online' : 'Reconnecting…'}</span>
        <button type="button" className="btn btn-ghost" onClick=${props.onLeave}>Leave</button>
      </div>
    </header>`;
  }

  // ───────────────────────── host controls & settings ─────────────────────────
  var FIELDS = [
    { group: 'Stakes', items: [
      { path: 'startingCash', label: 'Starting cash', money: true, lockedLive: true },
      { path: 'minBet', label: 'Minimum bet', money: true },
      { path: 'maxBet', label: 'Maximum bet', money: true },
      { path: 'highRollerMin', label: 'High-roller minimum', money: true }
    ] },
    { group: 'Session', items: [
      { path: 'session.mode', label: 'Ends', options: [['manual', 'When the host ends it'], ['time', 'After a set time'], ['rounds', 'After a number of rounds']], lockedLive: true },
      { path: 'session.minutes', label: 'Length (minutes)', when: function (s) { return s.session.mode === 'time'; }, lockedLive: true },
      { path: 'session.rounds', label: 'Round limit', when: function (s) { return s.session.mode === 'rounds'; }, lockedLive: true },
      { path: 'lateJoin', label: 'Late joiners get the starting cash', bool: true }
    ] },
    { group: 'Loans', note: 'Players borrow from the Bank in the top bar. Interest and deadlines count minutes of play, not paused time.', items: [
      { path: 'loans.casino', label: 'Casino loans', bool: true },
      { path: 'loans.creditLimit', label: 'Credit limit', money: true },
      { path: 'loans.maxDebt', label: 'Maximum debt', money: true },
      { path: 'loans.interestPct', label: 'Interest %', suffix: '%' },
      { path: 'loans.interestEveryMin', label: 'Charged every (min)' },
      { path: 'loans.termMin', label: 'Repay within (min)' },
      { path: 'loans.p2p', label: 'Player-to-player loans', bool: true },
      { path: 'loans.p2pMaxPct', label: 'Player loan rate cap %', suffix: '%' }
    ] },
    { group: 'Bankruptcy', items: [
      { path: 'bankruptcy.mode', label: 'A player is bankrupt when', options: [['standard', 'They can\'t cover the minimum bet, even with credit'], ['floor', '…or their net worth falls below a floor']] },
      { path: 'bankruptcy.netWorthFloor', label: 'Floor (negative net worth)', money: true, when: function (s) { return s.bankruptcy.mode === 'floor'; } }
    ] }
  ];
  function getPath(o, p) { return p.split('.').reduce(function (v, k) { return v == null ? v : v[k]; }, o); }
  function setPath(o, p, val) { var ks = p.split('.'), cur = o; for (var i = 0; i < ks.length - 1; i++) { cur[ks[i]] = cur[ks[i]] || {}; cur = cur[ks[i]]; } cur[ks[ks.length - 1]] = val; }

  function SettingsPanel(props) {
    var v = props.view, canEdit = v.isHost;
    var live = v.session.phase === 'live' || v.session.phase === 'paused';
    var d = useState(null), draft = d[0], setDraft = d[1];
    var e = useState(''), err = e[0], setErr = e[1];
    var shown = draft || v.settings;
    function change(path, val) { var next = JSON.parse(JSON.stringify(shown)); setPath(next, path, val); setDraft(next); setErr(''); }
    function save() {
      var patch = {};
      FIELDS.forEach(function (g) { g.items.forEach(function (f) { var a = getPath(draft, f.path); if (a !== getPath(v.settings, f.path)) setPath(patch, f.path, a); }); });
      return props.send({ type: 'settings', settings: patch }).then(function (res) { if (res.error) setErr(res.error); else setDraft(null); });
    }
    return html`<section className="panel settings" aria-labelledby="settings-h">
      <div className="panel-head"><h2 id="settings-h">House rules</h2>${!canEdit ? html`<span className="muted small">Set by the host</span>` : null}</div>
      <div className="settings-grid">
        ${FIELDS.map(function (g) {
          return html`<fieldset key=${g.group} className="settings-group">
            <legend>${g.group}</legend>
            ${g.note ? html`<p className="muted small">${g.note}</p>` : null}
            ${g.items.filter(function (f) { return !f.when || f.when(shown); }).map(function (f) {
              var val = getPath(shown, f.path), locked = !canEdit || (live && f.lockedLive);
              var id = 'set-' + f.path.replace('.', '-');
              if (f.bool) return html`<label key=${f.path} className="toggle"><input type="checkbox" checked=${!!val} disabled=${locked} onChange=${function (ev) { change(f.path, ev.target.checked); }} /><span>${f.label}</span></label>`;
              if (f.options) return html`<label key=${f.path} className="field" htmlFor=${id}><span>${f.label}</span>
                <select id=${id} value=${val} disabled=${locked} onChange=${function (ev) { change(f.path, ev.target.value); }}>
                  ${f.options.map(function (o) { return html`<option key=${o[0]} value=${o[0]}>${o[1]}</option>`; })}
                </select></label>`;
              return html`<label key=${f.path} className="field" htmlFor=${id}><span>${f.label}</span>
                <div className=${cx('num-input', f.money && 'is-money')}>
                  <input id=${id} type="number" inputMode="numeric" step="1" min="0" value=${val} disabled=${locked}
                    onInput=${function (ev) { var n = ev.target.value === '' ? '' : Number(ev.target.value); change(f.path, n === '' ? '' : Math.round(n)); }} />
                </div></label>`;
            })}
          </fieldset>`;
        })}
      </div>
      ${canEdit && live ? html`<p className="muted small">Starting cash and session length are fixed until this session ends.</p>` : null}
      ${err ? html`<p className="form-error" role="alert">${err}</p>` : null}
      ${canEdit && draft ? html`<div className="row end"><${Button} kind="ghost" onClick=${function () { setDraft(null); setErr(''); }}>Discard</${Button}><${Button} kind="primary" onClick=${save}>Save rules</${Button}></div>` : null}
    </section>`;
  }

  function SessionPanel(props) {
    var v = props.view, s = v.session, me = byId(v, v.you);
    var present = v.players.filter(function (p) { return p.connected && p.status !== 'spectator'; });
    var ready = present.filter(function (p) { return p.ready || p.isHost; });
    var confirm = useState(null), ask = confirm[0], setAsk = confirm[1];
    var e = useState(''), err = e[0], setErr = e[1];
    function act(cmd) { setErr(''); return props.send(cmd).then(function (res) { if (res.error) setErr(res.error); else setAsk(null); }); }

    var body;
    if (s.phase === 'lobby') {
      body = html`<div className="session-lobby">
        <div>
          <h2>Everyone starts with <span className="gold">${money(v.settings.startingCash)}</span></h2>
          <p className="muted">One wallet follows you to every table. When the host deals in, the casino opens and betting starts.</p>
        </div>
        <div className="ready-meter" aria-label=${ready.length + ' of ' + present.length + ' ready'}>
          ${present.map(function (p) { return html`<span key=${p.id} className=${cx('ready-dot', (p.ready || p.isHost) && 'on')} title=${p.name}>${AVATARS[p.avatar]}</span>`; })}
          <span className="muted small">${ready.length}/${present.length} ready</span>
        </div>
        <div className="row">
          ${v.isHost
            ? html`<${Button} kind="primary" className="big" onClick=${function () { return act({ type: 'start' }); }} disabled=${ready.length < present.length}>${ready.length < present.length ? 'Waiting for players…' : 'Deal everyone in'}</${Button}>`
            : html`<${Button} kind=${me && me.ready ? 'ghost' : 'primary'} className="big" onClick=${function () { return act({ type: 'ready', ready: !(me && me.ready) }); }}>${me && me.ready ? 'Not ready' : 'I\'m ready'}</${Button}>`}
        </div>
      </div>`;
    } else if (s.phase === 'ended') {
      body = null;
    } else {
      body = html`<div className="session-live">
        <div>
          <h2>${s.phase === 'paused' ? 'Paused — betting is closed' : 'The casino is open'}</h2>
          <p className="muted">${s.mode === 'manual' ? 'The session runs until the host ends it.' : s.mode === 'time' ? 'The session ends when the clock runs out.' : 'The session ends after ' + s.roundLimit + ' rounds.'}</p>
        </div>
        ${v.isHost ? html`<div className="row">
          ${s.phase === 'live'
            ? html`<${Button} onClick=${function () { return act({ type: 'pause' }); }}>Pause</${Button}>`
            : html`<${Button} kind="primary" onClick=${function () { return act({ type: 'resume' }); }}>Resume</${Button}>`}
          <${Button} onClick=${function () { setAsk('end'); }}>End session</${Button}>
          <${Button} kind="danger" onClick=${function () { setAsk('restart'); }}>Restart…</${Button}>
        </div>` : null}
      </div>`;
    }
    return html`<section className="panel session" aria-label="Session">
      ${body}
      ${ask ? html`<div className="confirm" role="alertdialog" aria-label="Confirm">
        ${ask === 'end'
          ? html`<p><b>End the session for everyone?</b> Betting stops, any unfinished hands are refunded and the final standings are shown.</p>`
          : html`<p><b>Restart with fresh wallets?</b> This session is archived and every player — including anyone in debt — goes back to ${money(v.settings.startingCash)}. Everyone will be told.</p>`}
        <div className="row end">
          <${Button} kind="ghost" onClick=${function () { setAsk(null); }}>Cancel</${Button}>
          <${Button} kind="danger" onClick=${function () { return act(ask === 'end' ? { type: 'end' } : { type: 'restart', confirm: true }); }}>${ask === 'end' ? 'End session' : 'Reset everyone'}</${Button}>
        </div>
      </div>` : null}
      ${err ? html`<p className="form-error" role="alert">${err}</p>` : null}
    </section>`;
  }

  // ───────────────────────── casino floor ─────────────────────────
  function Floor(props) {
    var v = props.view;
    return html`<section className="floor" aria-labelledby="floor-h">
      <div className="section-head"><h2 id="floor-h">Casino floor</h2><span className="muted small">Every table plays from the same wallet</span></div>
      <div className="tables">
        ${v.tables.map(function (t) {
          var info = GAME_INFO[t.game] || {};
          var canOpen = t.open && (v.session.phase === 'live' || v.session.phase === 'paused');
          return html`<article key=${t.id} className=${cx('table-card', 'game-' + t.game, t.highRoller && 'high-roller', !t.open && 'closed', canOpen && 'openable', t.hot && 'is-hot')}>
            <div className="table-felt" aria-hidden="true"><span className="table-icon">${info.icon}</span></div>
            <div className="table-body">
              <div className="table-title"><h3>${t.name}</h3>${t.highRoller ? html`<span className="tag gold">VIP</span>` : null}</div>
              ${t.hot || (t.watchers && t.watchers.length) ? html`<div className="row">${t.hot ? html`<span className="tag hot">🔥 ${t.hot.label}</span>` : null}${t.watchers && t.watchers.length ? html`<span className="tag">👀 ${t.watchers.length} watching</span>` : null}</div>` : null}
              <p className="muted small">${info.blurb}</p>
              <div className="table-meta">
                <span className="num">${money(t.minBet)} – ${money(t.maxBet)}</span>
                ${!t.open ? html`<span className="tag">Opening soon</span>`
                  : html`<span className="seated-avatars" title=${t.seated.length + ' seated'}>${t.seated.length ? t.seated.map(function (id) { var p = byId(v, id); return p ? html`<span key=${id}>${AVATARS[p.avatar]}</span>` : null; }) : html`<span className="muted">Empty</span>`}</span>`}
              </div>
              ${t.open ? html`<button type="button" className="btn table-open" disabled=${!canOpen} onClick=${function () { props.onOpen(t.id); }}>${canOpen ? (byId(v, v.you) && byId(v, v.you).tableId === t.id ? 'Back to your seat' : 'Open table') : 'Opens when the session starts'}</button>` : null}
            </div>
          </article>`;
        })}
      </div>
    </section>`;
  }

  // ───────────────────────── players & leaderboard ─────────────────────────
  /** Remembers each player's last rank and shows ▲/▼ for a little while after it changes. */
  function useRankMoves(order) {
    var prev = useRef({}), moves = useRef({});
    var now = Date.now();
    order.forEach(function (id, i) {
      var before = prev.current[id];
      if (before != null && before !== i) moves.current[id] = { by: before - i, at: now };
      prev.current[id] = i;
    });
    var out = {};
    Object.keys(moves.current).forEach(function (id) { if (now - moves.current[id].at < 20000) out[id] = moves.current[id].by; });
    return out;
  }

  function Players(props) {
    var v = props.view;
    var ranked = v.leaderboard.map(function (id) { return byId(v, id); }).filter(Boolean);
    var moves = useRankMoves(v.leaderboard);
    var ach = (v.social && v.social.achievements) || {};
    var rest = v.players.filter(function (p) { return v.leaderboard.indexOf(p.id) < 0; });
    function row(p, rank) {
      var tags = [];
      if (p.isHost) tags.push(html`<span key="h" className="tag gold">Host</span>`);
      if (p.status === 'bankrupt') tags.push(html`<span key="b" className="tag red">Bankrupt</span>`);
      if (p.insolvent) tags.push(html`<${BrokeTag} key="i" view=${v} insolvent=${p.insolvent} />`);
      if (p.status === 'spectator') tags.push(html`<span key="s" className="tag">Spectating</span>`);
      if (v.session.phase === 'lobby' && !p.isHost) tags.push(p.ready ? html`<span key="r" className="tag green">Ready</span>` : html`<span key="r" className="tag">Not ready</span>`);
      if (p.left) tags.push(html`<span key="l" className="tag">Left</span>`);
      if (p.tableId) { var tb = v.tables.filter(function (t) { return t.id === p.tableId; })[0]; if (tb) tags.push(html`<span key="t" className=${'tag at-table game-' + tb.game}>${tb.name}</span>`); }
      var mv = moves[p.id], count = (ach[p.id] || []).length;
      return html`<li key=${p.id} className=${cx('player', p.id === v.you && 'me', !p.connected && 'offline')}>
        <button type="button" className="player-hit" onClick=${function () { props.onProfile(p.id); }} aria-label=${'Open ' + p.name + '\u2019s profile'}></button>
        <span className="rank num">${rank || ''}${mv ? html`<i className=${cx('rank-move', mv > 0 ? 'up' : 'down')} aria-label=${mv > 0 ? 'up ' + mv : 'down ' + -mv}>${mv > 0 ? '▲' : '▼'}</i>` : null}</span>
        <span className="player-avatar"><${Avatar} id=${p.avatar} /><i className=${cx('dot', p.connected ? 'on' : 'off')} title=${p.connected ? 'Online' : 'Offline'}></i></span>
        <span className="player-main">
          <span className="player-name">${p.name}${p.id === v.you ? html` <span className="muted">(you)</span>` : null}</span>
          <span className="player-tags">${tags}</span>
          ${p.hasWallet ? html`<span className="player-money small">
            <span title="Cash">${money(p.cash)}</span>${p.debt + p.owes > 0 ? html` · <span className="red" title="Debt">debt ${money(p.debt + p.owes)}</span>` : null}
            ${p.streak >= 3 ? html` · <span title=${p.streak + ' wins in a row'}>🔥${p.streak}</span>` : p.streak <= -3 ? html` · <span title=${-p.streak + ' losses in a row'}>🧊${-p.streak}</span>` : null}
            ${count ? html` · <span title=${count + ' achievements'}>🏅${count}</span>` : null}
          </span>` : null}
        </span>
        ${p.hasWallet ? html`<span className="player-worth num" title="Net worth">${money(p.netWorth)}<small className=${cx('profit', p.profit > 0 ? 'green' : p.profit < 0 ? 'red' : 'muted')}>${signed(p.profit)}</small></span>` : null}
      </li>`;
    }
    return html`<section className="panel players" aria-labelledby="players-h">
      <div className="panel-head"><h2 id="players-h">${v.session.phase === 'lobby' ? 'Players' : 'Leaderboard'}</h2>
        <span className="row"><span className="muted small">${v.players.filter(function (p) { return p.connected; }).length}/${v.players.length} online</span>
        ${v.session.startedAt ? html`<button type="button" className="btn btn-ghost" onClick=${props.onHistory}>History</button>` : null}</span></div>
      ${ranked.length ? html`<div className="lb-head small muted"><span>Player</span><span>Net worth</span></div>` : null}
      <ol className="player-list">${ranked.map(function (p, i) { return row(p, i + 1); })}${rest.map(function (p) { return row(p, null); })}</ol>
      ${window.CasinoBank ? html`<${window.CasinoBank.DebtBoard} view=${v} />` : null}
    </section>`;
  }

  function BrokeTag(props) {
    var now = useNow(props.view, 1000), ins = props.insolvent;
    var left = ins.until ? Math.max(0, ins.until - now) : ins.leftMs;
    return html`<span className="tag red" title="Out of chips: bankrupt unless someone lends them money">Broke · ${clockText(left)}</span>`;
  }

  // ───────────────────────── feed & chat ─────────────────────────
  function Feed(props) {
    var v = props.view, now = useNow(v, 15000);
    var items = v.feed.slice().reverse();
    return html`<section className="panel feed" aria-labelledby="feed-h">
      <div className="panel-head"><h2 id="feed-h">Activity</h2></div>
      <ul className="feed-list" aria-live="polite">
        ${items.length ? items.map(function (f) {
          return html`<li key=${f.id} className=${'feed-' + f.kind}><span className="feed-text">${f.text}</span><time className="muted small">${timeAgo(f.at, now)}</time></li>`;
        }) : html`<li className="muted small">Nothing yet.</li>`}
      </ul>
    </section>`;
  }

  function Chat(props) {
    var v = props.view;
    var t = useState(''), text = t[0], setText = t[1];
    var listRef = useRef(null);
    useEffect(function () { var el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [v.chat.length]);
    function send(ev) {
      ev.preventDefault();
      var msg = text.trim();
      if (!msg) return;
      setText('');
      props.send({ type: 'chat', text: msg }).then(function (res) { if (res.error) { setText(msg); props.toast(res.error); } });
    }
    return html`<section className="panel chat" aria-labelledby="chat-h">
      <div className="panel-head"><h2 id="chat-h">Table talk</h2></div>
      <ul className="chat-list" ref=${listRef}>
        ${v.chat.length ? v.chat.map(function (m) {
          var p = byId(v, m.from);
          return html`<li key=${m.id}><b>${p ? p.name : 'Someone'}</b> ${m.text}</li>`;
        }) : html`<li className="muted small">Say hi. Trash talk is encouraged.</li>`}
      </ul>
      <div className="emotes" role="group" aria-label="Reactions">
        ${Object.keys(EMOTES).map(function (k) { return html`<button key=${k} type="button" className="emote" aria-label=${k} onClick=${function () { props.send({ type: 'emote', emote: k }); }}>${EMOTES[k]}</button>`; })}
      </div>
      <form className="chat-form" onSubmit=${send}>
        <input value=${text} maxLength="240" placeholder="Message the room" aria-label="Message" onInput=${function (ev) { setText(ev.target.value); }} />
        <button type="submit" className="btn" disabled=${!text.trim()}>Send</button>
      </form>
    </section>`;
  }

  // ───────────────────────── ledger drawer ─────────────────────────
  function Ledger(props) {
    var v = props.view, acc = v.me && v.me.account;
    var s = useState(null), entries = s[0], setEntries = s[1];
    var l = useState(false), more = l[0], setMore = l[1];
    useEffect(function () {
      props.send({ type: 'history' }).then(function (res) { if (res.entries) { setEntries(res.entries); setMore(res.entries.length === 100); } });
    }, [v.me && v.me.history[0] && v.me.history[0].seq, v.session.no]);
    function loadMore() {
      var last = entries[entries.length - 1];
      return props.send({ type: 'history', before: last.seq }).then(function (res) { if (res.entries) { setEntries(entries.concat(res.entries)); setMore(res.entries.length === 100); } });
    }
    useEffect(function () { function k(e) { if (e.key === 'Escape') props.onClose(); } addEventListener('keydown', k); return function () { removeEventListener('keydown', k); }; }, []);
    return html`<div className="drawer-scrim" onClick=${function (e) { if (e.target === e.currentTarget) props.onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="ledger-h">
        <div className="panel-head"><h2 id="ledger-h">Your wallet</h2><button type="button" className="btn btn-ghost" onClick=${props.onClose} aria-label="Close">Close</button></div>
        ${acc && acc.staked ? html`<div className="ledger-summary">
          <div><span className="muted small">Cash</span><b className="num">${money(acc.cash)}</b></div>
          <div><span className="muted small">In play</span><b className="num">${money(acc.reserved)}</b></div>
          <div><span className="muted small">Casino debt</span><b className="num">${money(acc.debt)}</b></div>
          <div><span className="muted small">Interest owed</span><b className="num">${money(acc.interest)}</b></div>
          <div><span className="muted small">Owed to players</span><b className="num">${money(acc.owes)}</b></div>
          <div><span className="muted small">Owed to you</span><b className="num">${money(acc.owed)}</b></div>
          <div><span className="muted small">Won</span><b className="num green">${money(acc.won)}</b></div>
          <div><span className="muted small">Lost</span><b className="num red">${money(acc.lost)}</b></div>
          <div className="span2"><span className="muted small">Net worth</span><b className="num gold big-num">${money(acc.netWorth)}</b></div>
        </div>` : html`<p className="muted">Your wallet opens when the session starts.</p>`}
        <h3 className="eyebrow">Transactions · session ${v.session.no}</h3>
        ${entries == null ? html`<p className="muted small"><span className="spinner"></span> Loading…</p>`
          : !entries.length ? html`<p className="muted small">No transactions yet.</p>`
          : html`<ol className="ledger-list">
            ${entries.map(function (x) {
              var delta = x.type === 'settle' ? x.net : x.type === 'bet' ? -(x.reserved) : x.cash;
              return html`<li key=${x.seq}>
                <div><b>${ENTRY_LABEL[x.type] || x.type}</b><span className="muted small">${x.memo || ''} · ${new Date(x.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                <div className="ledger-amt"><b className=${cx('num', delta > 0 && 'green', delta < 0 && 'red')}>${x.type === 'bet' ? money(x.reserved) + ' held' : signed(delta)}</b><span className="muted small num">cash ${money(x.balance.cash)}</span></div>
              </li>`;
            })}
          </ol>`}
        ${more ? html`<${Button} kind="ghost" onClick=${loadMore}>Older transactions</${Button}>` : null}
      </aside>
    </div>`;
  }

  // ───────────────────────── final standings ─────────────────────────
  function Results(props) {
    var v = props.view, s = v.session.summary;
    var a = useState(false), asking = a[0], setAsking = a[1];
    if (!s) return null;
    function name(id) { var p = byId(v, id); return p ? p.name : 'Someone'; }
    var winners = s.winners.map(name);
    var GAME_NAMES = { blackjack: 'Blackjack', roulette: 'Roulette', poker: 'Texas Hold\'em', teenpatti: 'Teen Patti', duel: 'Challenges' };
    return html`<section className="panel results" aria-labelledby="results-h">
      <div className="results-head">
        <span className="eyebrow">${v.session.endReason || 'Session over'}</span>
        <h2 id="results-h">${winners.length ? html`<span className="gold">${winners.join(' & ')}</span> ${winners.length > 1 ? 'share the win' : 'wins the night'}` : 'No winner this time'}</h2>
      </div>
      <div className="highlights">
        ${s.biggestWinner ? html`<div className="highlight"><span className="eyebrow">Biggest winner</span><b>${name(s.biggestWinner.id)}</b><span className="green num">${signed(s.biggestWinner.profit)}</span></div>` : null}
        ${s.biggestLoser ? html`<div className="highlight"><span className="eyebrow">Biggest loser</span><b>${name(s.biggestLoser.id)}</b><span className="red num">${signed(s.biggestLoser.profit)}</span></div>` : null}
        ${s.bestGame ? html`<div className="highlight"><span className="eyebrow">Luckiest table</span><b>${GAME_NAMES[s.bestGame.game] || s.bestGame.game}</b><span className="num">${signed(s.bestGame.net)} for players</span></div>` : null}
        ${s.comeback ? html`<div className="highlight"><span className="eyebrow">Comeback of the night</span><b>${name(s.comeback.id)}</b><span className="num">${money(s.comeback.from)} → ${money(s.comeback.to)}</span></div>` : null}
      </div>
      ${s.debts && s.debts.length ? html`<div className="debts-final">
        <span className="eyebrow">Unpaid debts — counted in every net worth above</span>
        <ul>${s.debts.map(function (d, i) {
          return html`<li key=${i}><span>${name(d.borrower)} owes ${d.lender ? name(d.lender) : 'the casino'}</span><b className="num red">${money(d.due)}</b></li>`;
        })}</ul>
      </div>` : null}
      <div className="table-scroll">
        <table className="standings">
          <thead><tr><th>#</th><th>Player</th><th>Started</th><th>Cash</th><th>Debt</th><th>Won</th><th>Lost</th><th>Net worth</th></tr></thead>
          <tbody>${s.rows.map(function (r) {
            return html`<tr key=${r.id} className=${cx(r.id === v.you && 'me', s.winners.indexOf(r.id) >= 0 && 'winner')}>
              <td className="num">${r.rank}</td><td><${Avatar} id=${r.avatar} /> ${r.name}${r.status === 'bankrupt' ? html` <span className="tag red">Bankrupt</span>` : null}</td>
              <td className="num">${money(r.startingCash)}</td><td className="num">${money(r.cash)}</td><td className="num red">${r.debt + r.owes ? money(r.debt + r.owes) : '—'}</td>
              <td className="num green">${money(r.won)}</td><td className="num red">${money(r.lost)}</td><td className="num"><b>${money(r.netWorth)}</b></td>
            </tr>`;
          })}</tbody>
        </table>
      </div>
      <div className="row"><${Button} kind="ghost" onClick=${props.onHistory}>See the session story</${Button}></div>
      ${v.isHost ? html`<div className="row end">
        ${asking ? html`<span className="muted small">Every wallet goes back to ${money(v.settings.startingCash)}.</span>
          <${Button} kind="ghost" onClick=${function () { setAsking(false); }}>Cancel</${Button}>
          <${Button} kind="primary" onClick=${function () { return props.send({ type: 'restart', confirm: true }); }}>Start a new session</${Button}>`
        : html`<${Button} kind="primary" onClick=${function () { setAsking(true); }}>Play again with fresh wallets</${Button}>`}
      </div>` : html`<p className="muted small">Waiting for the host to start a new session.</p>`}
    </section>`;
  }

  // ───────────────────────── room ─────────────────────────
  function Room(props) {
    var v = props.view, s = v.session;
    var d = useState(store.get('noticeSeen', null)), seen = d[0], setSeen = d[1];
    var showNotice = s.notice && s.notice.id !== seen;
    var o = useState(function () { try { return sessionStorage.getItem('casino.table'); } catch (e) { return null; } }), openId = o[0], setOpenId = o[1];
    function open(id) { setOpenId(id); try { if (id) sessionStorage.setItem('casino.table', id); else sessionStorage.removeItem('casino.table'); } catch (e) { /* storage blocked */ } scrollTo(0, 0); }
    var table = openId && (s.phase === 'live' || s.phase === 'paused') ? v.tables.filter(function (t) { return t.id === openId && t.open; })[0] : null;
    var TableView = table && window.CasinoTables && window.CasinoTables[table.game];
    function sit() { return props.send({ type: 'sit', tableId: table.id }); }
    var watched = table ? table.id : null;
    useEffect(function () { props.send({ type: 'watch', tableId: watched }); }, [watched]);
    var S = window.CasinoSocial;
    function standUp() { return props.send({ type: 'stand-up' }); }
    return html`<div className=${cx('room', 'phase-' + s.phase)}>
      <${TopBar} view=${v} status=${props.status} onLedger=${props.onLedger} onBank=${props.onBank} onLeave=${props.onLeave} />
      <div className="room-grid">
        <main className="room-main">
          ${window.CasinoBank && (s.phase === 'live' || s.phase === 'paused') ? html`<${window.CasinoBank.MoneyBanner} view=${v} onBank=${props.onBank} />` : null}
          ${S ? html`<${S.ChallengeBanner} view=${v} send=${props.send} />` : null}
          ${showNotice ? html`<div className="banner" role="status"><span>${s.notice.text}</span><button type="button" className="btn btn-ghost" onClick=${function () { store.set('noticeSeen', s.notice.id); setSeen(s.notice.id); }}>Got it</button></div>` : null}
          ${TableView ? html`<${R.Fragment}><${TableView} view=${v} table=${table} send=${props.send} onBack=${function () { open(null); }} onSit=${sit} onStand=${standUp} />
              ${S ? html`<${S.ReactionBar} table=${table} send=${props.send} />` : null}</${R.Fragment}>`
            : html`<${R.Fragment}>
              ${s.phase === 'ended' ? html`<${Results} view=${v} send=${props.send} onHistory=${props.onHistory} />` : html`<${SessionPanel} view=${v} send=${props.send} />`}
              <${Floor} view=${v} onOpen=${open} />
              <${SettingsPanel} view=${v} send=${props.send} />
            </${R.Fragment}>`}
        </main>
        <aside className="room-rail">
          <${Players} view=${v} onProfile=${props.onProfile} onHistory=${props.onHistory} />
          <${Feed} view=${v} />
          <${Chat} view=${v} send=${props.send} toast=${props.toast} />
        </aside>
      </div>
    </div>`;
  }

  function Floaters(props) {
    return html`<div className="floaters" aria-hidden="true">${props.items.map(function (f) {
      return html`<span key=${f.key} className="floater" style=${{ left: f.x + '%' }}>${EMOTES[f.emote]}<small>${f.name}</small></span>`;
    })}</div>`;
  }

  // ───────────────────────── app ─────────────────────────
  function App() {
    var vs = useState(null), view = vs[0], setView = vs[1];
    var st = useState('connecting'), status = st[0], setStatus = st[1];
    var cl = useState(null), closed = cl[0], setClosed = cl[1];
    var tl = useState(null), toastMsg = tl[0], setToast = tl[1];
    var lg = useState(false), ledgerOpen = lg[0], setLedger = lg[1];
    var bk = useState(false), bankOpen = bk[0], setBank = bk[1];
    var pf = useState(null), profileId = pf[0], setProfile = pf[1];
    var hs = useState(false), historyOpen = hs[0], setHistory = hs[1];
    var du = useState(null), duel = du[0], setDuel = du[1];
    var ac = useState([]), achQueue = ac[0], setAchQueue = ac[1];
    var fl = useState([]), floaters = fl[0], setFloaters = fl[1];
    var mo = useState(null), moment = mo[0], setMoment = mo[1];
    useEffect(function () { if (!moment) return; var t = setTimeout(function () { setMoment(null); }, 2200); return function () { clearTimeout(t); }; }, [moment]);
    var viewRef = useRef(null);
    viewRef.current = view;
    var initialCode = useMemo(function () { var m = location.hash.match(/join=([A-Za-z0-9]{5})/); return m ? m[1].toUpperCase() : ''; }, []);

    var net = useMemo(function () {
      if (!Net.available()) return null;
      return Net.create({
        onState: function (v) { setClosed(null); setView(v); },
        onStatus: setStatus,
        onClosed: function (msg) { setView(null); setLedger(false); setClosed(msg); },
        onFx: function (d) {
          if (d.kind === 'emote') {
            var v = viewRef.current, p = v && byId(v, d.from);
            var item = { key: Math.random().toString(36).slice(2), emote: d.emote, name: p ? p.name : '', x: 8 + Math.random() * 84 };
            setFloaters(function (list) { return list.concat(item).slice(-12); });
            setTimeout(function () { setFloaters(function (list) { return list.filter(function (f) { return f !== item; }); }); }, 2600);
          }
          if (d.kind === 'session-start' && hub) window.Hub.report('session-start', {});
          if (d.kind === 'big-win' && viewRef.current && d.playerId === viewRef.current.you) setMoment({ key: Date.now(), amount: d.amount, blackjack: d.blackjack });
          var cur = viewRef.current, who = cur && byId(cur, d.from || d.playerId);
          if (d.kind === 'loan-offer' && who) setToast(who.name + ' sent you a loan offer. Open the bank to answer.');
          if (d.kind === 'bankrupt' && who && cur && d.playerId !== cur.you) setToast(who.name + ' went bankrupt.');
          if (d.kind === 'big-loss' && cur && d.playerId === cur.you) setMoment({ key: Date.now(), amount: d.amount, loss: true });
          if (d.kind === 'achievement' && cur && d.playerId === cur.you) setAchQueue(function (q) { return q.concat(d.id); });
          if (d.kind === 'challenge' && who) setToast(who.name + ' challenged you!');
          if (d.kind === 'duel' && cur) {
            if (d.from === cur.you || d.to === cur.you) setDuel(d);
            else { var w = byId(cur, d.winner), l = byId(cur, d.winner === d.from ? d.to : d.from); if (w && l) setToast(w.name + ' beat ' + l.name + ' in a challenge for ' + money(d.amount) + '.'); }
          }
        }
      });
    }, []);

    var lastPhase = useRef(null);
    useEffect(function () {
      if (!view) return;
      var ph = view.session.phase;
      if (lastPhase.current && lastPhase.current !== 'ended' && ph === 'ended' && hub) {
        var s = view.session.summary, mine = s && s.rows.filter(function (r) { return r.id === view.you; })[0];
        window.Hub.report('session-end', { result: s && s.winners.indexOf(view.you) >= 0 ? 'win' : 'lose', netWorth: mine ? mine.netWorth : null });
      }
      lastPhase.current = ph;
    }, [view && view.session.phase]);

    useEffect(function () { if (!toastMsg) return; var t = setTimeout(function () { setToast(null); }, 3200); return function () { clearTimeout(t); }; }, [toastMsg]);

    function send(cmd) {
      return net.send(cmd).then(function (res) { if (res && res.error && cmd.type !== 'settings') setToast(res.error); return res || {}; });
    }
    function leave() {
      var msg = view && view.session.phase !== 'lobby' ? 'Leave the room? Your wallet and debts stay on the books, and you can rejoin with the same code.' : 'Leave the room?';
      if (!confirm(msg)) return;
      net.leave();
    }

    // A seat saved in this tab is resumed on connect; show a loader rather than the entrance meanwhile.
    var resuming = net && net.hasSeat() && !view && !closed;
    return html`<${R.Fragment}>
      ${view ? html`<${Room} view=${view} status=${status} send=${send} toast=${setToast} onLedger=${function () { setLedger(true); }} onBank=${function () { setBank(true); }} onProfile=${setProfile} onHistory=${function () { setHistory(true); }} onLeave=${leave} />`
        : resuming ? html`<div className="loading-screen"><span className="spinner big"></span><p>Finding your seat…</p></div>`
        : html`<${Entrance} net=${net} status=${net ? status : 'offline'} closed=${closed} initialCode=${initialCode} />`}
      ${view && ledgerOpen ? html`<${Ledger} view=${view} send=${send} onClose=${function () { setLedger(false); }} />` : null}
      ${view && bankOpen && window.CasinoBank ? html`<${window.CasinoBank.BankDrawer} view=${view} send=${send} onClose=${function () { setBank(false); }} />` : null}
      ${view && profileId && window.CasinoSocial ? html`<${window.CasinoSocial.ProfileDrawer} view=${view} send=${send} playerId=${profileId} onClose=${function () { setProfile(null); }} />` : null}
      ${view && historyOpen && window.CasinoSocial ? html`<${window.CasinoSocial.HistoryDrawer} view=${view} send=${send} onClose=${function () { setHistory(false); }} />` : null}
      ${view && duel && window.CasinoSocial ? html`<${window.CasinoSocial.DuelMoment} view=${view} duel=${duel} onDone=${function () { setDuel(null); }} />` : null}
      ${view && achQueue.length && window.CasinoSocial ? html`<${window.CasinoSocial.AchievementToast} key=${achQueue[0]} id=${achQueue[0]} onDone=${function () { setAchQueue(function (q) { return q.slice(1); }); }} />` : null}
      ${view && status !== 'online' ? html`<div className="reconnect" role="status"><span className="spinner"></span> Connection lost — reconnecting. Your seat and wallet are safe.</div>` : null}
      <${Floaters} items=${floaters} />
      ${moment ? html`<button type="button" className=${cx('moment', moment.loss && 'loss-moment')} onClick=${function () { setMoment(null); }} aria-label="Dismiss">
        <span className="moment-card">
          <span className="eyebrow">${moment.loss ? 'Ouch' : moment.blackjack ? 'Blackjack' : 'Big win'}</span>
          <b className=${cx('num', moment.loss && 'loss')}>${moment.amount > 0 ? '+' + money(moment.amount) : money(moment.amount)}</b>
          <small className="muted">Tap to continue</small>
        </span>
      </button>` : null}
      ${toastMsg ? html`<div className="toast" role="alert">${toastMsg}</div>` : null}
    </${R.Fragment}>`;
  }

  // Table modules (js/blackjack.js, …) load after this file and register in window.CasinoTables; render once they have.
  function mount() { ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
