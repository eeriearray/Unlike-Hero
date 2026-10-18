/* Neon Casino — the social layer: player profiles, the session history, achievements, head-to-head challenges, duel
   reveals and spectator reactions. Profiles and history are fetched on demand; everything else comes in the view. */
(function () {
  'use strict';
  var R = React, useState = R.useState, useEffect = R.useEffect;
  var UI = window.CasinoUI, html = UI.html, cx = UI.cx, money = UI.money, signed = UI.signed, Button = UI.Button, Avatar = UI.Avatar, useNow = UI.useNow;
  var K = window.CasinoKit;

  var ACH = {
    'first-win': ['🎯', 'First blood', 'Win your first round.'], jackpot: ['💰', 'Jackpot', 'Win half your starting cash or more in one round.'],
    natural: ['🂡', 'Natural', 'Hit a blackjack.'], 'straight-up': ['🎡', 'Bullseye', 'Hit a straight-up number at roulette.'],
    monster: ['🃏', 'Monster hand', 'Win a poker pot with four of a kind or better.'], trail: ['🔥', 'Trail blazer', 'Win a Teen Patti pot with a trail.'],
    'on-fire': ['⚡', 'On fire', 'Win five rounds in a row.'], whale: ['🐋', 'Whale', 'Put the table maximum into one round.'],
    'high-roller': ['👑', 'High roller', 'Win at the high-roller table.'], 'grand-tour': ['🧭', 'Grand tour', 'Play every casino game.'],
    comeback: ['🚀', 'Comeback kid', 'Climb back above your starting cash after falling below half of it.'], bailout: ['🛟', 'Lifeline', 'Get bailed out by another player.'],
    'clean-slate': ['🧾', 'Clean slate', 'Pay off the casino in full.'], 'loan-shark': ['🦈', 'Loan shark', 'Get a player loan paid back with interest.'],
    duelist: ['⚔️', 'Duelist', 'Win a private challenge.'], survivor: ['🛡️', 'Survivor', 'Finish solvent after dropping below a quarter of your stake.'],
    champion: ['🏆', 'Champion', 'Win the session.']
  };
  var DUELS = { highcard: ['High card', 'Each draws a card; higher wins.'], dice: ['Dice', 'Each rolls two dice; higher total wins.'], coin: ['Coin flip', 'Heads, the challenger wins.'] };
  var GAME_NAMES = { blackjack: 'Blackjack', roulette: 'Roulette', poker: 'Hold\'em', teenpatti: 'Teen Patti', duel: 'Challenges' };
  var COLORS = ['#f5c451', '#3de0d0', '#ff4d8d', '#8fb3ff', '#5fd068', '#ff8a3d', '#d38cff', '#ff5d6c', '#9be7ff', '#e2a46a', '#c9c3dc', '#ffd36e'];
  function name(v, id) { var p = UI.byId(v, id); return p ? p.name : 'Someone'; }
  function useEsc(fn) { useEffect(function () { function k(e) { if (e.key === 'Escape') fn(); } addEventListener('keydown', k); return function () { removeEventListener('keydown', k); }; }, []); }

  /** A small line chart: series = [{ id, color, points: [[t, value]…] }]. */
  function Chart(props) {
    var W = 480, H = props.height || 160, P = 8;
    var all = []; props.series.forEach(function (s) { all = all.concat(s.points); });
    if (all.length < 2) return html`<p className="muted small">Not enough play yet to draw a chart.</p>`;
    var t0 = Math.min.apply(null, all.map(function (p) { return p[0]; })), t1 = Math.max.apply(null, all.map(function (p) { return p[0]; }));
    var vs = all.map(function (p) { return p[1]; }).concat(props.baseline != null ? [props.baseline] : []);
    var v0 = Math.min.apply(null, vs), v1 = Math.max.apply(null, vs);
    if (v1 === v0) { v1 += 1; v0 -= 1; }
    var x = function (t) { return P + ((t - t0) / Math.max(1, t1 - t0)) * (W - 2 * P); };
    var y = function (val) { return H - P - ((val - v0) / (v1 - v0)) * (H - 2 * P); };
    return html`<svg className="chart" viewBox=${'0 0 ' + W + ' ' + H} role="img" aria-label=${props.label}>
      ${props.baseline != null ? html`<line x1=${P} x2=${W - P} y1=${y(props.baseline)} y2=${y(props.baseline)} className="chart-base" />` : null}
      ${props.series.map(function (s) {
        var d = s.points.map(function (p, i) { return (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1); }).join(' ');
        var lastP = s.points[s.points.length - 1];
        return html`<g key=${s.id}><path d=${d} fill="none" stroke=${s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          ${lastP ? html`<circle cx=${x(lastP[0])} cy=${y(lastP[1])} r="3.5" fill=${s.color} />` : null}</g>`;
      })}
    </svg>`;
  }

  function Drawer(props) {
    useEsc(props.onClose);
    return html`<div className="drawer-scrim" onClick=${function (e) { if (e.target === e.currentTarget) props.onClose(); }}>
      <aside className=${cx('drawer', props.className)} role="dialog" aria-modal="true" aria-labelledby=${props.id}>
        <div className="panel-head"><h2 id=${props.id}>${props.title}</h2><button type="button" className="btn btn-ghost" onClick=${props.onClose}>Close</button></div>
        ${props.children}
      </aside>
    </div>`;
  }

  function ChallengeForm(props) {
    var v = props.view, s = v.settings;
    var g = useState('highcard'), game = g[0], setGame = g[1];
    var a = useState(s.minBet), amount = a[0], setAmount = a[1];
    var e = useState(''), err = e[0], setErr = e[1];
    function send() { setErr(''); return props.send({ type: 'challenge', to: props.to, game: game, amount: amount }).then(function (res) { if (res.error) setErr(res.error); else props.onSent(); }); }
    return html`<div className="bank-section">
      <h3>Challenge ${name(v, props.to)}</h3>
      <div className="seg" role="radiogroup" aria-label="Game">${Object.keys(DUELS).map(function (k) {
        return html`<button key=${k} type="button" role="radio" aria-checked=${game === k} className=${cx(game === k && 'on')} onClick=${function () { setGame(k); }}>${DUELS[k][0]}</button>`;
      })}</div>
      <p className="muted small">${DUELS[game][1]} Winner takes both stakes; the casino takes nothing.</p>
      <label className="field"><span>Stake (${money(s.minBet)}–${money(s.maxBet)})</span>
        <div className="num-input is-money"><input type="number" min=${s.minBet} max=${s.maxBet} step="1" value=${amount} onInput=${function (ev) { setAmount(Math.round(Number(ev.target.value) || 0)); }} /></div></label>
      <div className="consequence"><p>Win and you get <b className="green">+${money(amount)}</b>; lose and you pay <b className="red">${money(amount)}</b>. ${name(v, props.to)} has 60 seconds to accept.</p></div>
      ${err ? html`<p className="form-error" role="alert">${err}</p>` : null}
      <div className="row end"><${Button} kind="ghost" onClick=${props.onCancel}>Cancel</${Button}><${Button} kind="primary" onClick=${send}>Send challenge</${Button}></div>
    </div>`;
  }

  function ProfileDrawer(props) {
    var v = props.view;
    var s = useState(null), data = s[0], setData = s[1];
    var c = useState(false), challenging = c[0], setChallenging = c[1];
    var refreshKey = (v.leaderboard || []).join() + ':' + (v.players.filter(function (p) { return p.id === props.playerId; })[0] || {}).netWorth;
    useEffect(function () { props.send({ type: 'stats', playerId: props.playerId }).then(function (res) { if (res.profile) setData(res.profile); }); }, [props.playerId, refreshKey]);
    var p = UI.byId(v, props.playerId), me = UI.byId(v, v.you);
    var st = data && data.stats;
    var canChallenge = p && me && p.id !== v.you && p.status === 'active' && me.status === 'active' && v.session.phase === 'live';
    var rank = v.leaderboard.indexOf(props.playerId);
    return html`<${Drawer} id="profile-h" className="profile" title=${p ? p.name : 'Player'} onClose=${props.onClose}>
      ${!data ? html`<p className="muted small"><span className="spinner"></span> Loading…</p>` : html`<${R.Fragment}>
        <div className="profile-head">
          <${Avatar} id=${data.avatar} size="lg" />
          <div>
            <div className="row">${rank >= 0 ? html`<span className="tag gold">#${rank + 1}</span>` : null}
              ${data.status === 'bankrupt' ? html`<span className="tag red">Bankrupt</span>` : null}
              ${st && st.streak >= 3 ? html`<span className="tag">🔥 ${st.streak} wins in a row</span>` : st && st.streak <= -3 ? html`<span className="tag">🧊 ${-st.streak} losses in a row</span>` : null}</div>
            ${st ? html`<b className="profile-worth num">${money(st.netWorth)}</b><span className=${cx('num', st.profit > 0 ? 'green' : st.profit < 0 ? 'red' : 'muted')}> ${signed(st.profit)} this session</span>` : html`<span className="muted">No wallet this session.</span>`}
          </div>
        </div>
        ${canChallenge && !challenging ? html`<${Button} kind="primary" onClick=${function () { setChallenging(true); }}>⚔️ Challenge ${p.name}</${Button}>` : null}
        ${challenging ? html`<${ChallengeForm} view=${v} send=${props.send} to=${props.playerId} onCancel=${function () { setChallenging(false); }} onSent=${function () { setChallenging(false); props.onClose(); }} />` : null}
        ${st ? html`<${R.Fragment}>
          <${Chart} series=${[{ id: data.id, color: '#f5c451', points: data.trail }]} baseline=${st.startingCash} label="Net worth over the session" />
          <div className="ledger-summary">
            <div><span className="muted small">Rounds</span><b className="num">${st.rounds}</b></div>
            <div><span className="muted small">Won / lost / even</span><b className="num">${st.wins} / ${st.losses} / ${st.pushes}</b></div>
            <div><span className="muted small">Total won</span><b className="num green">${money(st.won)}</b></div>
            <div><span className="muted small">Total lost</span><b className="num red">${money(st.lost)}</b></div>
            <div><span className="muted small">Biggest win</span><b className="num">${money(st.biggestWin)}</b></div>
            <div><span className="muted small">Biggest loss</span><b className="num">${money(st.biggestLoss)}</b></div>
            <div><span className="muted small">Best streak</span><b className="num">${st.bestStreak}</b></div>
            <div><span className="muted small">Peak / low</span><b className="num">${money(st.peak)} / ${money(st.low)}</b></div>
            ${st.debt + st.owes ? html`<div className="span2"><span className="muted small">Debts</span><b className="num red">${money(st.debt + st.owes)}</b></div>` : null}
          </div>
          ${Object.keys(st.byGame).length ? html`<table className="payout-table by-game"><thead><tr><th>Game</th><th>Rounds</th><th>Net</th></tr></thead><tbody>
            ${Object.keys(st.byGame).map(function (g) { var x = st.byGame[g]; return html`<tr key=${g}><td>${GAME_NAMES[g] || g}</td><td className="num">${x.rounds}</td><td className=${cx('num', x.net > 0 ? 'green' : x.net < 0 ? 'red' : '')}>${signed(x.net)}</td></tr>`; })}
          </tbody></table>` : null}
        </${R.Fragment}>` : null}
        <h3 className="eyebrow">Achievements · ${data.achievements.length} of ${Object.keys(ACH).length}</h3>
        <ul className="ach-grid">${Object.keys(ACH).map(function (id) {
          var got = data.achievements.some(function (a) { return a.id === id; });
          return html`<li key=${id} className=${cx('ach', got && 'got')} title=${ACH[id][2]}><span className="ach-icon" aria-hidden="true">${ACH[id][0]}</span><b>${ACH[id][1]}</b><small className="muted">${ACH[id][2]}</small></li>`;
        })}</ul>
        ${data.duels.length ? html`<h3 className="eyebrow">Recent challenges</h3><ul className="loan-list">${data.duels.map(function (d) {
          var won = d.winner === data.id, other = d.from === data.id ? d.to : d.from;
          return html`<li key=${d.id}><span>${DUELS[d.game][0]} vs ${name(v, other)}</span><b className=${cx('num', won ? 'green' : 'red')}>${won ? '+' : '−'}${money(d.amount)}</b></li>`;
        })}</ul>` : null}
      </${R.Fragment}>`}
    </${Drawer}>`;
  }

  var KIND_ICON = { session: '🎲', win: '💰', achievement: '🏅', duel: '⚔️', loan: '🏦', repay: '🧾', broke: '⚠️', rescued: '🛟', bankrupt: '💀', overdue: '⏰', host: '👑', join: '👋', leave: '🚪' };
  var FILTERS = [['all', 'Everything'], ['money', 'Wins & losses'], ['debt', 'Loans & debt'], ['fun', 'Achievements & duels']];
  var FILTER_KINDS = { money: ['win', 'session'], debt: ['loan', 'repay', 'broke', 'rescued', 'bankrupt', 'overdue'], fun: ['achievement', 'duel'] };

  function HistoryDrawer(props) {
    var v = props.view;
    var s = useState(null), data = s[0], setData = s[1];
    var f = useState('all'), filter = f[0], setFilter = f[1];
    useEffect(function () { props.send({ type: 'session-history' }).then(function (res) { if (res.history) setData(res.history); }); }, [v.feed.length]);
    var ids = data ? Object.keys(data.trails) : [];
    var series = ids.map(function (id, i) { return { id: id, color: COLORS[i % COLORS.length], points: data.trails[id] }; });
    var events = data ? data.events.filter(function (e) { return filter === 'all' || FILTER_KINDS[filter].indexOf(e.kind) >= 0; }).slice().reverse() : [];
    return html`<${Drawer} id="history-h" className="history-drawer" title=${'Session ' + v.session.no + ' story'} onClose=${props.onClose}>
      ${!data ? html`<p className="muted small"><span className="spinner"></span> Loading…</p>` : html`<${R.Fragment}>
        <${Chart} series=${series} baseline=${data.startingCash} height=${190} label="Everyone's net worth over the session" />
        <ul className="chart-legend">${series.map(function (s) { return html`<li key=${s.id}><i style=${{ background: s.color }}></i>${name(v, s.id)}</li>`; })}</ul>
        <div className="seg small-seg" role="radiogroup" aria-label="Filter">${FILTERS.map(function (x) {
          return html`<button key=${x[0]} type="button" role="radio" aria-checked=${filter === x[0]} className=${cx(filter === x[0] && 'on')} onClick=${function () { setFilter(x[0]); }}>${x[1]}</button>`;
        })}</div>
        <ol className="timeline">${events.length ? events.map(function (e) {
          return html`<li key=${e.id} className=${'tl-' + e.kind}><span className="tl-icon" aria-hidden="true">${KIND_ICON[e.kind] || '•'}</span>
            <span className="tl-text">${e.text}</span><time className="muted small">${new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></li>`;
        }) : html`<li className="muted small">Nothing here yet.</li>`}</ol>
      </${R.Fragment}>`}
    </${Drawer}>`;
  }

  /** Challenges waiting on you (or that you sent), pinned at the top of the room. */
  function ChallengeBanner(props) {
    var v = props.view, now = useNow(v, 500);
    var list = (v.social && v.social.challenges || []).filter(function (c) { return c.to === v.you || c.from === v.you; });
    if (!list.length) return null;
    return html`<div className="challenge-stack">${list.map(function (c) {
      var left = Math.max(0, Math.ceil((c.expiresAt - now) / 1000));
      if (c.to === v.you) return html`<div key=${c.id} className="banner challenge" role="alert">
        <span>⚔️ <b>${name(v, c.from)}</b> challenges you to <b>${DUELS[c.game][0].toLowerCase()}</b> for <b className="gold">${money(c.amount)}</b> · ${left}s</span>
        <span className="row"><${Button} kind="ghost" onClick=${function () { return props.send({ type: 'challenge-decline', challengeId: c.id }); }}>Decline</${Button}>
          <${Button} kind="primary" onClick=${function () { return props.send({ type: 'challenge-accept', challengeId: c.id }); }}>Accept</${Button}></span>
      </div>`;
      return html`<div key=${c.id} className="banner challenge mine" role="status"><span>⚔️ Waiting for ${name(v, c.to)} to take your ${DUELS[c.game][0].toLowerCase()} challenge (${money(c.amount)}) · ${left}s</span>
        <${Button} kind="ghost" onClick=${function () { return props.send({ type: 'challenge-decline', challengeId: c.id }); }}>Withdraw</${Button}></div>`;
    })}</div>`;
  }

  function DuelDraw(props) {
    var d = props.duel, pid = props.pid;
    if (d.game === 'coin') return null;
    var x = d.draws[pid];
    if (d.game === 'dice') return html`<span className="dice">${(x || []).map(function (n, i) { return html`<span key=${i} className="die">${n}</span>`; })}</span>`;
    return x ? html`<${K.Card} card=${x} />` : null;
  }

  /** The reveal for the two duellists: skippable, a couple of seconds. */
  function DuelMoment(props) {
    var v = props.view, d = props.duel;
    useEffect(function () { var t = setTimeout(props.onDone, 3600); return function () { clearTimeout(t); }; }, [d.id]);
    var won = d.winner === v.you;
    return html`<button type="button" className="moment duel-moment" onClick=${props.onDone} aria-label="Dismiss">
      <span className="moment-card">
        <span className="eyebrow">${DUELS[d.game][0]} · ${money(d.amount)}</span>
        ${d.game === 'coin' ? html`<span className="coin" aria-label=${d.draws.coin}>${d.draws.coin === 'heads' ? 'H' : 'T'}</span>` : null}
        <span className="duel-sides">
          ${[d.from, d.to].map(function (pid) { return html`<span key=${pid} className=${cx('duel-side', d.winner === pid && 'win')}><${DuelDraw} duel=${d} pid=${pid} /><b>${name(v, pid)}</b></span>`; })}
        </span>
        <b className=${cx('num', won ? '' : 'loss')}>${won ? '+' + money(d.amount) : '−' + money(d.amount)}</b>
        <small className="muted">Tap to continue</small>
      </span>
    </button>`;
  }

  function AchievementToast(props) {
    var a = ACH[props.id];
    useEffect(function () { var t = setTimeout(props.onDone, 3200); return function () { clearTimeout(t); }; }, [props.id]);
    if (!a) return null;
    return html`<button type="button" className="ach-toast" onClick=${props.onDone} role="status">
      <span className="ach-icon" aria-hidden="true">${a[0]}</span><span><span className="eyebrow">Achievement unlocked</span><b>${a[1]}</b><small className="muted">${a[2]}</small></span>
    </button>`;
  }

  /** Reactions for everyone at or watching a table; it lights up when the table is hot. */
  function ReactionBar(props) {
    var t = props.table;
    var emotes = UI.EMOTES;
    return html`<div className=${cx('reaction-bar', t.hot && 'hot')} role="group" aria-label="React">
      ${t.hot ? html`<span className="hot-label">${t.hot.label}</span>` : null}
      ${t.watchers && t.watchers.length ? html`<span className="watching" title="Watching">👀 ${t.watchers.length}</span>` : null}
      ${Object.keys(emotes).map(function (k) { return html`<button key=${k} type="button" className="emote" aria-label=${k} onClick=${function () { props.send({ type: 'emote', emote: k, tableId: t.id }); }}>${emotes[k]}</button>`; })}
    </div>`;
  }

  window.CasinoSocial = { ProfileDrawer: ProfileDrawer, HistoryDrawer: HistoryDrawer, ChallengeBanner: ChallengeBanner, DuelMoment: DuelMoment, AchievementToast: AchievementToast, ReactionBar: ReactionBar, ACH: ACH, DUELS: DUELS };
})();
