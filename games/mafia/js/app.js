/* Mafia — React UI (React 18 UMD + htm, no build step).
   Renders only what the transport's view says this player may know. Game rules live in engine/mafia-engine.js. */
(function () {
  'use strict';
  var R = React, useState = R.useState, useEffect = R.useEffect, useRef = R.useRef, useMemo = R.useMemo, useCallback = R.useCallback;
  var html = htm.bind(R.createElement);
  var E = window.MafiaEngine, A = window.MafiaAudio, V = window.MafiaVoice, FX = window.MafiaFX, Net = window.MafiaNet;

  var VERSION = '1.1.0';
  var hub = window.Hub ? window.Hub.init({ id: 'mafia', version: VERSION, title: 'Mafia' }) : null;
  var store = hub ? hub.storage('mafia') : {
    get: function (k, d) { try { var v = localStorage.getItem('hub.mafia.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('hub.mafia.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  };

  var PHASE = {
    lobby: { title: 'Lobby', scene: 'lobby' },
    roles: { title: 'The Deal', scene: 'lobby' },
    night: { title: 'Nightfall', scene: 'night' },
    dawn: { title: 'Daybreak', scene: 'dawn' },
    discussion: { title: 'Town Meeting', scene: 'day' },
    voting: { title: 'The Vote', scene: 'day' },
    defense: { title: 'The Defense', scene: 'trial' },
    judgment: { title: 'Judgment', scene: 'trial' },
    verdict: { title: 'The Verdict', scene: 'trial' },
    gameover: { title: 'The End', scene: 'end' }
  };
  var SCENE_MUSIC = { lobby: 'lobby', night: 'night', dawn: 'day', day: 'day', trial: 'trial', end: 'end' };
  var SCENE_FX = { lobby: null, night: 'motes', dawn: 'motes', day: 'motes', trial: null, end: null };
  var TICKING = { night: 1, discussion: 1, voting: 1, defense: 1, judgment: 1 };
  var NARRATED = { roles: 1, night: 1, voting: 1, defense: 1, judgment: 1 };
  var CHANNELS = { lobby: 'Lobby', day: 'Town', mafia: 'Family', dead: 'Graveyard' };
  var UI_THEME = {
    radar: { accent: '#86d3a2', fx: 'fx-radar', word: 'Investigating' },
    scope: { accent: '#e0505e', fx: 'fx-scope', word: 'In the crosshairs' },
    blade: { accent: '#e0505e', fx: 'fx-blade', word: 'Stalking' },
    syringe: { accent: '#86d3a2', fx: 'fx-syringe', word: 'Treating' },
    shield: { accent: '#8cc3e6', fx: 'fx-shield', word: 'Guarding' },
    crystal: { accent: '#c39be6', fx: 'fx-crystal', word: 'Summoning' },
    mask: { accent: '#c9a45c', fx: 'fx-mask', word: 'Framing' },
    mute: { accent: '#e0505e', fx: 'fx-mute', word: 'Silencing' },
    dossier: { accent: '#c9a45c', fx: 'fx-dossier', word: 'Researching' },
    dream: { accent: '#9fb0ff', fx: 'fx-dream', word: 'Dreaming of' }
  };
  var TEAM_COLOR = { town: '#8cc3e6', mafia: '#e0505e', neutral: '#c39be6', serial_killer: '#e0505e', none: '#c9a45c' };
  var COATS = ['#2c3343', '#43301f', '#24383f', '#422636', '#30402c', '#433a25', '#202c45', '#4a2c1e', '#333333', '#3a2848', '#203a33', '#472a2a', '#3d3f48', '#4b3a2a', '#28304a', '#3f2a38'];
  var TIES = ['#7d1622', '#1f3d6b', '#c9a45c', '#2f5a3a', '#5a2f6b', '#8a5a1a'];
  var NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function byId(view, id) { for (var i = 0; i < view.players.length; i++) if (view.players[i].id === id) return view.players[i]; return null; }
  function teamClass(t) { return 'team-' + (t || 'town'); }
  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function hash(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

  // ───────────────────────── hooks & small pieces ─────────────────────────
  function useRemaining(view) {
    var offset = useRef(0);
    var s = useState(Date.now()), now = s[0], setNow = s[1];
    useEffect(function () { if (view) offset.current = view.serverNow - Date.now(); }, [view && view.serverNow]);
    useEffect(function () { var t = setInterval(function () { setNow(Date.now()); }, 250); return function () { clearInterval(t); }; }, []);
    if (!view || !view.phaseEndsAt) return null;
    return Math.max(0, (view.phaseEndsAt - (now + offset.current)) / 1000);
  }

  function Timer(props) {
    var left = props.left, total = props.total || 1;
    if (left == null) return null;
    var r = 20, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, left / total));
    return html`<div className=${cx('timer', left <= 10 && left > 0 && 'urgent')} title="Time left">
      <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
        <circle cx="23" cy="23" r=${r} fill="rgba(0,0,0,.5)" stroke="rgba(201,164,92,.25)" strokeWidth="3" />
        <circle className="fg" cx="23" cy="23" r=${r} fill="none" stroke="var(--brass-hi)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray=${c} strokeDashoffset=${c * (1 - p)} style=${{ transition: 'stroke-dashoffset .25s linear' }} />
      </svg>
      <span className="num">${Math.ceil(left)}</span>
    </div>`;
  }

  function Typewriter(props) {
    var s = useState(''), shown = s[0], setShown = s[1];
    useEffect(function () {
      var text = props.text || '', i = 0;
      setShown('');
      var t = setInterval(function () { i += 2; setShown(text.slice(0, i)); if (i >= text.length) clearInterval(t); }, 22);
      return function () { clearInterval(t); };
    }, [props.text]);
    return html`<span className=${shown.length < (props.text || '').length ? 'caret' : ''}>${shown}</span>`;
  }

  function SpeakerIcon(props) {
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" />
      ${props.off ? html`<path d="m17 9 5 5m0-5-5 5" />` : html`<path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />`}
    </svg>`;
  }

  function RoleFront(props) {
    var role = props.role;
    if (!role) return null;
    var team = E.TEAMS[role.team];
    return html`<div className=${'face front ' + teamClass(role.team)}>
      <div className="team">${team.name}</div>
      <div className="big">${role.icon}</div>
      <h2>${role.name}</h2>
      <p><em>${role.summary}</em></p>
      <p>${role.abilityText}</p>
      ${props.extra}
      <div className="goal">Goal — ${role.goal}</div>
    </div>`;
  }

  function RoleExtras(props) {
    var view = props.view, me = view.me;
    var mates = view.players.filter(function (p) { return p.mafiaMate; });
    return html`<div className="extras">
      ${mates.length ? html`<div>Your family: ${mates.map(function (m, i) { return html`<span key=${m.id}>${i ? ', ' : ' '}${m.avatar} <b>${m.name}</b>${m.role ? ' (' + m.role.name + ')' : ''}</span>`; })}</div>` : null}
      ${me.target ? html`<div>Your target: <b>${me.target.name}</b></div>` : null}
    </div>`;
  }

  /** Floating role card shown on hover / focus / long-press. */
  function RoleTip(props) {
    var t = props.tip;
    if (!t) return null;
    var r = E.ROLES[t.id], d = E.describeRole(t.id);
    var w = 270, left = Math.max(8, Math.min(innerWidth - w - 8, t.x - w / 2));
    var below = t.top < 250;
    var style = { left: left + 'px', '--ax': Math.max(18, Math.min(w - 18, t.x - left)) + 'px' };
    if (below) style.top = (t.bottom + 12) + 'px'; else style.bottom = (innerHeight - t.top + 12) + 'px';
    return html`<div className=${cx('tip', below ? 'below' : 'above')} key=${t.id} style=${style} role="tooltip">
      <div className="t-head"><span className="ic">${r.icon}</span><div><b>${r.name}</b><span className=${'team ' + teamClass(r.team)}>${E.TEAMS[r.team].name}</span></div></div>
      <p>${r.abilityText}</p>
      <p className="goal">Goal: ${d.goal}<br />The Detective sees them as ${r.appearsEvil ? 'Suspicious' : 'Innocent'}.</p>
    </div>`;
  }

  function useRoleTip() {
    var s = useState(null), tip = s[0], setTip = s[1];
    var press = useRef(null), longPressed = useRef(false), hideT = useRef(null);
    function show(id, el) { clearTimeout(hideT.current); var r = el.getBoundingClientRect(); setTip({ id: id, x: r.left + r.width / 2, top: r.top, bottom: r.bottom }); }
    function hide() { clearTimeout(hideT.current); hideT.current = setTimeout(function () { setTip(null); }, 90); }
    function bind(id) {
      return {
        onMouseEnter: function (e) { show(id, e.currentTarget); },
        onMouseLeave: hide,
        onFocus: function (e) { show(id, e.currentTarget); },
        onBlur: hide,
        onTouchStart: function (e) {
          var el = e.currentTarget; longPressed.current = false;
          press.current = setTimeout(function () { longPressed.current = true; show(id, el); }, 420);
        },
        onTouchEnd: function () { clearTimeout(press.current); if (longPressed.current) setTimeout(function () { setTip(null); }, 1800); },
        onContextMenu: function (e) { e.preventDefault(); }
      };
    }
    return { tip: tip, bind: bind, wasLongPress: function () { var v = longPressed.current; longPressed.current = false; return v; } };
  }

  function Toast(props) {
    if (!props.text) return null;
    return html`<div className="toast" key=${props.k} role="status">${props.text}</div>`;
  }

  // ───────────────────────── Home ─────────────────────────
  function RolesGuide() {
    var groups = [['town', 'The Town'], ['mafia', 'The Mafia'], ['neutral', 'Neutrals']];
    return html`<div className="stack">
      ${groups.map(function (g) {
        var ids = Object.keys(E.ROLES).filter(function (id) { return E.ROLES[id].team === g[0]; });
        return html`<div key=${g[0]} className="guide-group">
          <h4 className=${teamClass(g[0])} style=${{ margin: '0 0 8px', font: '500 13px var(--f-label)', letterSpacing: '.24em', textTransform: 'uppercase' }}>${g[1]}</h4>
          <div className="guide">${ids.map(function (id) {
            var r = E.ROLES[id];
            return html`<div className="guide-card" key=${id}><div className="ic">${r.icon}</div><div><b className=${teamClass(r.team)}>${r.name}</b><p>${r.abilityText}</p></div></div>`;
          })}</div>
        </div>`;
      })}
      <p className="muted small" style=${{ margin: 0, fontFamily: 'var(--f-type)' }}>Night order: Silencer and Framer, then Doctor and Bodyguard, then the killers, then the investigators.</p>
    </div>`;
  }

  function Home(props) {
    var p = props.profile, setP = props.setProfile;
    var qs = new URLSearchParams(location.search);
    var s1 = useState(qs.get('room') || ''), code = s1[0], setCode = s1[1];
    var s2 = useState(5), bots = s2[0], setBots = s2[1];
    var s3 = useState(false), guide = s3[0], setGuide = s3[1];
    var online = Net.onlineAvailable();
    var nameOk = p.name.trim().length > 0;
    return html`<div className="home">
      <div className="hero">
        <div className="kicker">A game of lies, for 4 to 16</div>
        <h1>Maf<span>i</span>a</h1>
        <p>The town sleeps. Someone at this table is lying.</p>
      </div>
      ${props.error ? html`<div className="notice error">${props.error}</div>` : null}
      <div className="home-grid">
        <section className="panel">
          <div className="panel-head"><h3>Who are you?</h3></div>
          <div className="panel-body stack">
            <label className="field">Name
              <input className="input" maxLength="18" value=${p.name} placeholder="Your alias"
                onInput=${function (e) { setP({ name: e.target.value, avatar: p.avatar }); }} />
            </label>
            <div className="field">Face<div className="avatars">
              ${E.AVATARS.map(function (a) {
                return html`<button key=${a} className=${cx('avatar-opt', p.avatar === a && 'on')} aria-label=${'Avatar ' + a}
                  onClick=${function () { A.unlock(); A.play('click'); setP({ name: p.name, avatar: a }); }}>${a}</button>`;
              })}
            </div></div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h3>Take a seat</h3></div>
          <div className="panel-body stack">
            ${!online ? html`<div className="notice">Online rooms need the hub server (<code>npm start</code>). You can still play solo against bots.</div>` : null}
            <button className="btn gold big" disabled=${!online || !nameOk || props.busy} onClick=${function () { props.onCreate(); }}>Host a new room</button>
            <div className="divider">or join one</div>
            <div className="row" style=${{ flexWrap: 'nowrap' }}>
              <input className="input code-input" inputMode="numeric" maxLength="6" placeholder="000000" aria-label="Room code" value=${code}
                onInput=${function (e) { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
                onKeyDown=${function (e) { if (e.key === 'Enter' && code.length === 6) props.onJoin(code); }} />
              <button className="btn" disabled=${!online || !nameOk || code.length !== 6 || props.busy} onClick=${function () { props.onJoin(code); }}>Join</button>
            </div>
            <div className="divider">or practise</div>
            <div className="row">
              <button className="btn blood" style=${{ flex: 1 }} disabled=${!nameOk} onClick=${function () { props.onOffline(bots); }}>Play offline vs bots</button>
              <select className="select" value=${bots} aria-label="Number of bots" onChange=${function (e) { setBots(Number(e.target.value)); }}>
                ${[3, 4, 5, 6, 7, 8, 9, 11, 13, 15].map(function (n) { return html`<option key=${n} value=${n}>${n} bots</option>`; })}
              </select>
            </div>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-head"><h3>How it works</h3><button className="btn small ghost" onClick=${function () { setGuide(!guide); }}>${guide ? 'Hide roles' : 'Show all roles'}</button></div>
        <div className="panel-body stack">
          <p style=${{ margin: 0, font: '15px/1.55 var(--f-news)' }}>Nobody has to moderate. An automated storyteller deals the secret roles, wakes each role at night, settles every action in strict order, reads the morning news aloud and runs the trials. The Town wins by hanging every killer. The Mafia wins by matching the Town's numbers. Neutrals play their own game.</p>
          ${guide ? html`<${RolesGuide} />` : null}
        </div>
      </section>
    </div>`;
  }

  // ───────────────────────── Lobby ─────────────────────────
  function Lobby(props) {
    var view = props.view, send = props.send, isHost = view.me.isHost, st = view.settings;
    var offline = props.kind === 'offline';
    var count = view.players.length;
    var inviteUrl = location.origin + location.pathname + '?room=' + view.code;
    var tips = useRoleTip();
    function toggleRole(id) {
      if (tips.wasLongPress() || !isHost) return;
      A.play('click'); var roles = {}; roles[id] = !st.roles[id]; send({ type: 'settings', settings: { roles: roles } });
    }
    function setTimer(k, v) { var timers = {}; timers[k] = v; send({ type: 'settings', settings: { timers: timers } }); }
    function copy() {
      A.play('click');
      var done = function () { props.toast('Invite link copied.'); };
      if (navigator.share && /Mobi/i.test(navigator.userAgent)) { navigator.share({ title: 'Join my Mafia game', url: inviteUrl }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(inviteUrl).then(done, function () { props.toast(inviteUrl); });
      else props.toast(inviteUrl);
    }
    var groups = [['town', 'The Town', ['villager'].concat(E.ROLE_GROUPS.town)], ['mafia', 'The Mafia', ['mafioso'].concat(E.ROLE_GROUPS.mafia)], ['neutral', 'Neutrals', E.ROLE_GROUPS.neutral]];
    return html`<div className="lobby">
      <div className="stack">
        <section className="panel room-code">
          ${offline
            ? html`<div className="label">Private table</div><div className="digits" style=${{ fontSize: '40px' }}>SOLO</div><p className="muted small" style=${{ margin: '6px 0 0' }}>You and ${count - 1} bots. Everything runs in this browser.</p>`
            : html`<div className="label">Room code</div>
              <div className="digits">${view.code}</div>
              <div className="row" style=${{ justifyContent: 'center', marginTop: '8px' }}>
                <button className="btn small" onClick=${copy}>Copy invite link</button>
              </div>
              <p className="muted small" style=${{ margin: '8px 0 0' }}>Friends join from any phone or computer with this code.</p>`}
        </section>
        <section className="panel">
          <div className="panel-head"><h3>At the table · ${count} of ${view.limits.max}</h3>
            ${isHost ? html`<button className="btn small" disabled=${count >= view.limits.max} onClick=${function () { A.play('click'); send({ type: 'addBot' }); }}>Add a bot</button>` : null}
          </div>
          <div className="panel-body">
            <div className="seat-list">
              ${view.players.map(function (p) {
                return html`<div className="seat" key=${p.id} style=${p.id === view.me.id ? { borderColor: 'var(--line-strong)' } : null}>
                  <span className="av">${p.avatar}</span>
                  <div style=${{ minWidth: 0 }}><div className="nm">${p.name}</div>
                    <div className="tag">${p.isHost ? 'Host' : p.isBot ? 'Bot' : p.connected ? 'Seated' : 'Reconnecting…'}${p.id === view.me.id ? ' · you' : ''}</div></div>
                  ${isHost && p.id !== view.me.id ? html`<button className="kick" title="Remove" aria-label=${'Remove ' + p.name} onClick=${function () { send({ type: 'kick', playerId: p.id }); }}>✕</button>` : null}
                </div>`;
              })}
              ${count < view.limits.min ? html`<div className="seat empty">${view.limits.min - count} more needed…</div>` : null}
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h3>Roles in play</h3><span className="muted small" style=${{ fontFamily: 'var(--f-type)' }}>${isHost ? 'Tap to toggle · hover or hold for details' : 'Hover or hold for details'}</span></div>
          <div className="panel-body role-toggles">
            ${groups.map(function (g) {
              return html`<div key=${g[0]}><h4 className=${teamClass(g[0])}>${g[1]}</h4><div className="chips">
                ${g[2].map(function (id) {
                  var r = E.ROLES[id], fixed = !r.toggle, on = fixed || st.roles[id];
                  return html`<button key=${id} ...${tips.bind(id)} className=${cx('chip-toggle', on && 'on', fixed && 'fixed', teamClass(r.team))}
                    aria-pressed=${on} aria-label=${r.name + (fixed ? ' (always in play)' : on ? ' (on)' : ' (off)') + '. ' + r.abilityText}
                    onClick=${function () { if (!fixed) toggleRole(id); }}><span className="ic">${r.icon}</span>${r.name}</button>`;
                })}
              </div></div>`;
            })}
            <p className="muted small" style=${{ margin: 0, fontFamily: 'var(--f-type)' }}>The storyteller deals to fit the table: Detective and Doctor first, about one Mafia member per four players, neutrals from 6 players (the Serial Killer from 7).</p>
          </div>
        </section>
      </div>
      <div className="stack">
        <section className="panel">
          <div className="panel-head"><h3>House rules</h3></div>
          <div className="panel-body stack">
            <div className="setting-row"><span>Mafia size</span>
              <select className="select" disabled=${!isHost} value=${String(st.mafiaCount)} onChange=${function (e) { send({ type: 'settings', settings: { mafiaCount: e.target.value === 'auto' ? 'auto' : Number(e.target.value) } }); }}>
                <option value="auto">Auto</option>${[1, 2, 3, 4, 5].map(function (n) { return html`<option key=${n} value=${n}>${n}</option>`; })}
              </select><span></span></div>
            <label className="switch"><input type="checkbox" disabled=${!isHost} checked=${st.revealRoles} onChange=${function (e) { send({ type: 'settings', settings: { revealRoles: e.target.checked } }); }} /> Reveal roles on death</label>
            ${Object.keys(view.limits.timers).map(function (k) {
              var lim = view.limits.timers[k];
              return html`<div className="setting-row" key=${k}><span>${k}</span>
                <input type="range" min=${lim[0]} max=${lim[1]} step="5" value=${st.timers[k]} disabled=${!isHost} aria-label=${k + ' seconds'}
                  onChange=${function (e) { setTimer(k, Number(e.target.value)); }} />
                <span className="muted">${st.timers[k]}s</span></div>`;
            })}
            ${isHost
              ? html`<button className="btn gold big" disabled=${count < view.limits.min} onClick=${function () { A.unlock(); send({ type: 'start' }); }}>
                  ${count < view.limits.min ? 'Need ' + view.limits.min + ' players' : 'Deal the cards'}</button>`
              : html`<div className="notice">Waiting for the host to deal the cards…</div>`}
          </div>
        </section>
        <${SidePanel} view=${view} chat=${props.chat} send=${send} only="lobby" />
      </div>
      <${RoleTip} tip=${tips.tip} />
    </div>`;
  }

  // ───────────────────────── The town hall table ─────────────────────────
  function Person(props) {
    var p = props.p, view = props.view, me = view.me, ph = view.phase;
    var voters = view.vote ? view.players.filter(function (x) { return x.vote === p.id; }) : [];
    var votes = view.vote && view.vote.tally[p.id];
    var accused = view.trial && view.trial.accusedId === p.id;
    var h = hash(p.id);
    var tag = !p.alive ? (p.role ? p.role.name : p.deathCause === 'lynch' ? 'Hanged' : 'Dead')
      : p.mafiaMate && p.role ? p.role.name
      : p.id === me.id ? (me.role ? 'You · ' + me.role.name : 'You')
      : (ph === 'discussion' || ph === 'roles') && p.ready ? 'Ready' : '';
    var asleep = ph === 'night' && p.alive && p.id !== me.id && !p.mafiaMate;
    return html`<div className=${cx('person', props.clickable && 'clickable', p.id === me.id && 'me', p.mafiaMate && 'mate', !p.alive && 'dead',
        !p.connected && !p.isBot && 'dc', props.selected && 'selected', me.vote === p.id && 'voted', accused && 'accused', asleep && 'asleep')}
      style=${{ '--s': props.s, '--coat': COATS[h % COATS.length], '--tie': TIES[(h >> 3) % TIES.length], '--d': ((h % 40) / 10) + 's' }}
      role=${props.clickable ? 'button' : null} tabIndex=${props.clickable ? 0 : null} aria-label=${p.name + (tag ? ', ' + tag : '')}
      onClick=${props.onClick} onKeyDown=${function (e) { if (e.key === 'Enter' && props.onClick) props.onClick(); }}
      onMouseEnter=${props.clickable ? function () { A.play('hover'); } : null}>
      ${accused ? html`<div className="spot"></div>` : null}
      <div className="ring"></div>
      ${votes ? html`<div className="vote-count" key=${'v' + votes}>${votes}<small>vote${votes === 1 ? '' : 's'}</small></div>` : null}
      <span className="badge l">${p.isHost ? '👑' : p.isBot ? '🤖' : ''}</span>
      <span className="badge r">${p.silenced ? '🤐' : !p.connected && !p.isBot ? '📵' : p.mafiaMate ? '🌹' : ''}</span>
      <div className="chair"></div>
      <div className="head">${p.alive ? p.avatar : '👻'}</div>
      <div className="body"></div>
      <div className="plate">${p.name}</div>
      <div className=${cx('tag', p.role && teamClass(p.role.team))}>${tag}</div>
      ${voters.length ? html`<div className="voters" title=${'Votes: ' + voters.map(function (v) { return v.name; }).join(', ')}>${voters.map(function (v) { return html`<span key=${v.id}>${v.avatar}</span>`; })}</div>` : null}
      ${props.floats.map(function (f) { return html`<div className="reaction-float" key=${f.key}>${f.emoji}<small>${f.fromName}</small></div>`; })}
    </div>`;
  }

  function Centerpiece(props) {
    var view = props.view, ph = view.phase;
    var prop = null;
    if (ph === 'voting') prop = html`<div className="ballot-box">BALLOTS<br />skip ${view.vote ? view.vote.skip : 0}</div>`;
    else if (ph === 'defense' || ph === 'judgment' || ph === 'verdict') prop = html`<span className="prop">⚖️</span>`;
    else if (ph === 'dawn' || ph === 'discussion') prop = html`<span className="prop">📰</span>`;
    else if (ph === 'roles') prop = html`<span className="prop">🃏</span>`;
    else if (ph === 'gameover') prop = html`<span className="prop">🏆</span>`;
    return html`<div className="centerpiece"><span className="candle3d"></span><span className="candle3d short"></span>${prop}<span className="candle3d"></span></div>`;
  }

  function TownHall(props) {
    var view = props.view, me = view.me;
    var players = view.players;
    var mine = Math.max(0, players.findIndex(function (p) { return p.id === me.id; }));
    var ordered = players.slice(mine).concat(players.slice(0, mine)); // you sit nearest the camera
    var n = ordered.length;
    return html`<div className="hall">
      <div className="floor-shadow"></div>
      <div className="table"></div>
      <${Centerpiece} view=${view} />
      ${ordered.map(function (p, i) {
        var ang = Math.PI / 2 + (i * 2 * Math.PI) / n;
        var sin = Math.sin(ang);
        var x = 50 + 41 * Math.cos(ang);
        var y = 52 + (sin > 0 ? 30 : 17) * sin;
        var depth = (sin + 1) / 2;
        var z = depth < 0.5 ? 10 + Math.round(depth * 60) : 60 + Math.round(depth * 30);
        var floats = props.floats.filter(function (f) { return (f.target || f.from) === p.id; });
        var clickable = props.canClick(p);
        return html`<div className="seat3d" key=${p.id} style=${{ left: x + '%', top: y + '%', zIndex: z }}>
          <${Person} p=${p} view=${view} s=${0.72 + 0.36 * depth} floats=${floats} clickable=${clickable}
            selected=${props.selectedId === p.id} onClick=${clickable ? function () { props.onCard(p); } : null} />
        </div>`;
      })}
    </div>`;
  }

  // ───────────────────────── Side panel: chat + notebook ─────────────────────────
  function lockReason(view, ch) {
    var me = view.me, ph = view.phase;
    if (ch === 'day') {
      if (!me.alive) return 'Ghosts cannot speak to the living. Haunt the Graveyard instead.';
      if (me.silenced) return 'You have been silenced. You can still vote.';
      if (ph === 'night') return 'The town sleeps. Talk resumes at daybreak.';
      if (ph === 'defense') return 'Only the accused may speak during their defense.';
    }
    if (ch === 'mafia') return me.alive ? 'The family only meets at night.' : 'The dead keep no secrets — you can only listen.';
    if (ch === 'dead') return 'The spirits only answer at night.';
    return 'You cannot speak here right now.';
  }

  function SidePanel(props) {
    var view = props.view, chat = props.chat, me = view.me;
    var channels = props.only ? [props.only] : Object.keys(CHANNELS).filter(function (c) { return me.canRead[c] && c !== 'lobby'; });
    if (view.phase === 'gameover' && !props.only) channels.unshift('lobby');
    var primary = props.only || (view.phase === 'gameover' ? 'lobby'
      : !me.alive && channels.indexOf('dead') >= 0 ? 'dead'
      : view.phase === 'night' && channels.indexOf('mafia') >= 0 ? 'mafia'
      : view.phase === 'night' && me.canWrite.dead ? 'dead' : 'day');
    var s1 = useState(primary), tab = s1[0], setTab = s1[1];
    var s2 = useState({}), seen = s2[0], setSeen = s2[1];
    var s3 = useState(''), text = s3[0], setText = s3[1];
    var logRef = useRef(null);
    useEffect(function () { setTab(primary); }, [primary, view.phase]);
    var active = tab === 'notes' || channels.indexOf(tab) >= 0 ? tab : primary;
    var msgs = chat[active] || [];
    useEffect(function () {
      if (active === 'notes') return;
      var last = msgs.length ? msgs[msgs.length - 1].id : 0;
      if (seen[active] !== last) { var nx = Object.assign({}, seen); nx[active] = last; setSeen(nx); }
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [active, msgs.length]);
    function unread(ch) { var lastSeen = seen[ch] || 0; return (chat[ch] || []).filter(function (m) { return m.id > lastSeen && !m.system; }).length; }
    function submit(e) {
      e.preventDefault();
      var t = text.trim();
      if (!t) return;
      props.send({ type: 'chat', channel: active, text: t });
      setText('');
    }
    var canWrite = active !== 'notes' && me.canWrite[active];
    return html`<section className="panel side" style=${props.only ? { height: '420px', position: 'static' } : null}>
      <div className="tabs" role="tablist">
        ${channels.map(function (ch) {
          var u = ch !== active ? unread(ch) : 0;
          return html`<button key=${ch} role="tab" aria-selected=${ch === active} className=${cx('tab', ch, ch === active && 'on')} onClick=${function () { A.play('click'); setTab(ch); }}>
            ${CHANNELS[ch]}${u ? html`<span className="dot">${u > 9 ? '9+' : u}</span>` : null}</button>`;
        })}
        ${props.only ? null : html`<button role="tab" aria-selected=${active === 'notes'} className=${cx('tab', active === 'notes' && 'on')} onClick=${function () { A.play('click'); setTab('notes'); }}>Notebook${me.log.length ? html`<span className="dot" style=${{ background: 'var(--brass)', color: '#2a1a0c' }}>${me.log.length}</span>` : null}</button>`}
      </div>
      ${active === 'notes' ? html`<${Notebook} view=${view} onRole=${props.onRole} />` : html`
        <div className="chat-log" ref=${logRef} aria-live="polite">
          ${msgs.length ? null : html`<p className="muted small" style=${{ textAlign: 'center', fontFamily: 'var(--f-type)' }}>${active === 'mafia' ? 'Only the family can read this.' : active === 'dead' ? 'Only the dead (and the Medium) can read this.' : 'No messages yet.'}</p>`}
          ${msgs.map(function (m) {
            if (m.system) return html`<div key=${m.id} className=${cx('msg', m.kind === 'story' ? 'story' : 'system')}>${m.text}</div>`;
            return html`<div key=${m.id} className=${cx('msg', m.from === me.id && 'mine')}><span className="av">${m.avatar}</span><div><div className="who">${m.name}</div><div className="txt">${m.text}</div></div></div>`;
          })}
        </div>
        ${canWrite
          ? html`<form className="chat-input" onSubmit=${submit}>
              <input className="input" maxLength="280" value=${text} placeholder=${active === 'mafia' ? 'Whisper to the family…' : active === 'dead' ? 'Speak from beyond…' : 'Say something…'}
                onInput=${function (e) { setText(e.target.value); }} aria-label="Message" />
              <button className="btn small gold" type="submit">Send</button></form>`
          : html`<div className="chat-locked">${lockReason(view, active)}</div>`}
        ${!props.only && props.reactions ? props.reactions : null}`}
    </section>`;
  }

  function Notebook(props) {
    var view = props.view, me = view.me;
    var key = 'notes.' + view.code;
    var s = useState(function () { return store.get(key, ''); }), notes = s[0], setNotes = s[1];
    var dead = view.players.filter(function (p) { return !p.alive; });
    return html`<div className="notebook">
      ${me.role ? html`<div className="log-entry my-role" onClick=${props.onRole} title="Show my card">
        <span className="ic">${me.role.icon}</span><div><b className=${teamClass(me.role.team)}>${me.role.name}</b><div className="small">${me.role.goal}</div></div></div>` : null}
      ${me.log.length ? me.log.slice().reverse().map(function (l, i) {
        return html`<div key=${i} className=${cx('log-entry', l.kind)}><span className="when">${l.phase === 'roles' ? 'Before night one' : 'Day ' + l.day}</span>${l.text}</div>`;
      }) : html`<p className="muted small" style=${{ fontFamily: 'var(--f-type)' }}>Your private results and secrets will be written here.</p>`}
      ${dead.length ? html`<div className="graveyard"><div className="when">The graveyard</div>
        ${dead.map(function (p) { return html`<div key=${p.id}>✝ ${p.name} — ${p.role ? p.role.name : 'role unknown'} <span className="muted">(${p.deathCause === 'lynch' ? 'hanged' : 'killed'}, day ${p.deathDay})</span></div>`; })}
      </div>` : null}
      <label className="field">Private notes (this device only)
        <textarea className="notes" value=${notes} placeholder="Who claimed what? Who voted whom?" onInput=${function (e) { setNotes(e.target.value); store.set(key, e.target.value); }}></textarea>
      </label>
    </div>`;
  }

  function Reactions(props) {
    var view = props.view, me = view.me;
    var can = view.phase === 'gameover' || view.phase === 'roles' || (me.alive && !me.silenced);
    var target = props.selectedId ? byId(view, props.selectedId) : null;
    return html`<div className="reactions" title=${target ? 'Reacting at ' + target.name : 'Tap a seat first to aim your reaction'}>
      ${view.reactions.map(function (e) {
        return html`<button key=${e} disabled=${!can} aria-label=${'React ' + e} onClick=${function () { A.play('click'); props.send({ type: 'react', emoji: e, target: props.selectedId || null }); }}>${e}</button>`;
      })}
    </div>`;
  }

  // ───────────────────────── Overlays ─────────────────────────
  function RoleReveal(props) {
    var view = props.view, me = view.me;
    var s = useState(false), flipped = s[0], setFlipped = s[1];
    var ready = view.players.filter(function (p) { return p.ready; }).length;
    function flip() {
      if (flipped) return;
      A.unlock(); A.play('flip');
      setFlipped(true);
      setTimeout(function () {
        A.play('reveal', me.role.team);
        FX.burst(me.role.team === 'mafia' ? 'blood' : 'gold', innerWidth / 2, innerHeight / 2, 50);
      }, 450);
    }
    return html`<div className="overlay">
      <div className="stack" style=${{ justifyItems: 'center', textAlign: 'center' }}>
        <div style=${{ font: '500 13px var(--f-label)', letterSpacing: '.45em', textTransform: 'uppercase', color: 'var(--brass)' }}>Your secret role</div>
        <div className=${cx('flip', flipped && 'flipped')} onClick=${flip} role="button" tabIndex="0" aria-label="Flip your role card"
          onKeyDown=${function (e) { if (e.key === 'Enter' || e.key === ' ') flip(); }}>
          <div className="flip-inner">
            <div className="face back"><div className="seal">M</div><div className="hint">Tap to reveal</div></div>
            <${RoleFront} role=${me.role} extra=${html`<${RoleExtras} view=${view} />`} />
          </div>
        </div>
        ${flipped ? html`<div className="stack" style=${{ justifyItems: 'center' }}>
          ${me.ready
            ? html`<div className="muted" style=${{ fontFamily: 'var(--f-type)' }}>Waiting for the others… ${ready} of ${view.players.length} ready</div>`
            : html`<button className="btn gold big" onClick=${function () { A.play('select'); props.send({ type: 'ready' }); }}>I'm ready — let night fall</button>`}
          <p className="muted small" style=${{ margin: 0, fontFamily: 'var(--f-type)' }}>Keep your screen to yourself. Your card is in the Notebook if you forget.</p>
        </div>` : null}
      </div>
    </div>`;
  }

  function RoleSheet(props) {
    return html`<div className="overlay" onClick=${props.onClose}>
      <button className="icon-btn close" aria-label="Close" onClick=${props.onClose}>✕</button>
      <div className="flip flipped" onClick=${function (e) { e.stopPropagation(); }}><div className="flip-inner">
        <div className="face back"></div>
        <${RoleFront} role=${props.view.me.role} extra=${html`<${RoleExtras} view=${props.view} />`} />
      </div></div>
    </div>`;
  }

  function Wheel(props) {
    var view = props.view, theme = UI_THEME[props.ui] || UI_THEME.scope;
    var s = useState(null), hover = s[0], setHover = s[1];
    var targets = props.targets.map(function (id) { return byId(view, id); }).filter(Boolean);
    var focus = byId(view, hover || props.selected);
    var n = targets.length, radius = n > 10 ? 44 : 41;
    return html`<div className="wheel" style=${{ '--accent': theme.accent }}>
      <div className="ring"></div>
      <div className=${cx('core', theme.fx)} style=${{ borderColor: theme.accent }}>
        <span className="core-icon">${focus ? focus.avatar : props.icon}</span>
        <span className="core-label">${focus ? html`${theme.word}<b>${focus.name}</b>` : props.verb}</span>
      </div>
      ${targets.map(function (p, i) {
        var ang = (-90 + (360 / n) * i) * Math.PI / 180;
        var mates = props.mateVotes ? props.mateVotes.filter(function (v) { return v.target === p.id; }) : [];
        return html`<button key=${p.id} className=${cx('wheel-target', props.selected === p.id && 'on')}
          style=${{ left: (50 + radius * Math.cos(ang)) + '%', top: (50 + radius * Math.sin(ang)) + '%' }}
          onMouseEnter=${function () { setHover(p.id); A.play('hover'); }} onMouseLeave=${function () { setHover(null); }}
          onClick=${function () { A.play('select'); props.onPick(props.selected === p.id ? null : p.id); }}
          title=${mates.length ? 'Family votes: ' + mates.map(function (m) { return m.name; }).join(', ') : p.name}>
          ${mates.length ? html`<span className="mates">${mates.length}</span>` : null}
          <span className="av">${p.avatar}</span><span className="nm">${p.name}</span>
        </button>`;
      })}
    </div>`;
  }

  function NightModal(props) {
    var view = props.view, me = view.me, actions = me.actions || [];
    var s1 = useState(0), tab = s1[0], setTab = s1[1];
    var action = actions[Math.min(tab, actions.length - 1)];
    var chosen = action ? me.choices[action.key] : undefined;
    var s2 = useState(chosen || null), sel = s2[0], setSel = s2[1];
    useEffect(function () { setSel(chosen || null); }, [tab, action && action.key]);
    if (!action) return null;
    var mateVotes = action.key === 'kill' && me.mafiaVotes ? Object.keys(me.mafiaVotes).filter(function (id) { return id !== me.id && me.mafiaVotes[id]; })
      .map(function (id) { var p = byId(view, id); return { name: p ? p.name : '?', target: me.mafiaVotes[id] }; }) : null;
    var locked = action.key in me.choices;
    function confirm(target) {
      A.play(target ? 'confirm' : 'click');
      props.send({ type: 'night', key: action.key, target: target }).then(function (r) {
        if (r && r.ok && actions.length > 1 && tab < actions.length - 1) setTab(tab + 1);
      });
    }
    var kill = action.key === 'kill';
    var icon = kill ? '🔫' : me.role.icon;
    var target = byId(view, sel);
    return html`<div className="overlay clear">
      <button className="icon-btn close" aria-label="Minimize" onClick=${props.onClose}>▾</button>
      <div className="night-modal">
        <div className=${'kicker ' + teamClass(kill ? 'mafia' : me.role.team)}>${me.role.name} · Night ${view.day}</div>
        <h2>${kill ? 'The family hit' : action.verb}</h2>
        ${actions.length > 1 ? html`<div className="night-tabs">${actions.map(function (a, i) {
          return html`<button key=${a.key} className=${cx('btn small', i === tab ? 'gold' : 'ghost')} onClick=${function () { setTab(i); }}>${a.key in me.choices ? '✓ ' : ''}${a.key === 'kill' ? 'The hit' : a.verb}</button>`;
        })}</div>` : null}
        <p className="muted small" style=${{ margin: 0, maxWidth: '440px' }}>${action.prompt}${action.uses != null ? ' (' + action.uses + ' use' + (action.uses === 1 ? '' : 's') + ' left)' : ''}</p>
        <${Wheel} view=${view} targets=${action.targets} ui=${action.ui} icon=${icon} verb=${action.verb} selected=${sel} onPick=${setSel} mateVotes=${mateVotes} />
        <div className="row" style=${{ justifyContent: 'center' }}>
          <button className=${cx('btn big', kill || action.ui === 'scope' || action.ui === 'blade' ? 'blood' : 'gold')} disabled=${!sel} onClick=${function () { confirm(sel); }}>
            ${target ? action.verb + ' ' + target.name : 'Choose a target'}</button>
          <button className="btn ghost" onClick=${function () { confirm(null); }}>${kill ? 'Hold fire' : 'Do nothing'}</button>
        </div>
        ${locked ? html`<div className="notice good">Locked in: ${me.choices[action.key] ? (byId(view, me.choices[action.key]) || {}).name : 'no action'}. You can change it until dawn.</div>` : null}
      </div>
    </div>`;
  }

  function DreamModal(props) {
    var view = props.view;
    var s = useState(null), sel = s[0], setSel = s[1];
    var targets = view.players.filter(function (p) { return p.alive && p.id !== view.me.id; }).map(function (p) { return p.id; });
    return html`<div className="overlay clear">
      <button className="icon-btn close" aria-label="Close" onClick=${props.onClose}>▾</button>
      <div className="night-modal">
        <div className="kicker muted">Night ${view.day}</div>
        <h2>You are asleep</h2>
        <p className="muted small" style=${{ margin: 0, maxWidth: '440px' }}>You have no night action. Tap around anyway — in the same room, it keeps people from guessing who has a role. Nothing you pick here has any effect.</p>
        <${Wheel} view=${view} targets=${targets} ui="dream" icon="💤" verb="Dream" selected=${sel} onPick=${setSel} />
        <button className="btn gold" onClick=${function () { A.play('confirm'); props.onClose(); }}>${sel ? 'Sweet dreams' : 'Back to sleep'}</button>
      </div>
    </div>`;
  }

  /** The morning report, delivered as a newspaper and read aloud by the narrator. */
  function Newspaper(props) {
    var dawn = props.dawn, lines = dawn.lines;
    var s = useState(0), shown = s[0], setShown = s[1];
    var s2 = useState(false), narrated = s2[0], setNarrated = s2[1];
    useEffect(function () {
      A.play('paper');
      var start = setTimeout(function () {
        var speaking = V.sequence(lines.map(function (t, i) { return { text: t, clip: dawn.clips && dawn.clips[i] }; }), function (i) { setShown(function (v) { return Math.max(v, i + 1); }); }, function () { setShown(lines.length); });
        setNarrated(speaking);
        if (!speaking) setShown(1);
      }, 1100);
      return function () { clearTimeout(start); V.cancel(); };
    }, []);
    // Without narration, reveal a line every couple of seconds.
    useEffect(function () {
      if (narrated || !shown || shown >= lines.length) return;
      var t = setTimeout(function () { setShown(shown + 1); }, 2300);
      return function () { clearTimeout(t); };
    }, [shown, narrated]);
    useEffect(function () {
      var line = lines[shown - 1] || '';
      var death = dawn.deaths.filter(function (d) { return line.indexOf(d.name + ' was found dead') === 0; })[0];
      if (death) {
        A.play(death.cause === 'serial_killer' ? 'stab' : 'gunshot');
        setTimeout(function () { A.play('death'); FX.shake(true); FX.flash('rgba(140,10,20,.45)'); FX.burst('blood', innerWidth / 2, innerHeight * 0.55, 60); }, 250);
      } else if (/wakes up unable/.test(line)) A.play('silence');
      else if (/saved|stopped the bleeding/.test(line)) { A.play('heal'); FX.burst('sparkle', innerWidth / 2, innerHeight / 2, 40); }
    }, [shown]);
    var revealed = dawn.deaths.filter(function (d) { return lines.slice(0, shown).some(function (l) { return l.indexOf(d.name + ' was found dead') === 0; }); });
    var count = dawn.deaths.length;
    var headline = !count ? 'A Quiet Night' : count === 1 ? dawn.deaths[0].name + ' Found Dead' : (NUMBER_WORDS[count] || count) + ' Found Dead';
    var sub = !count ? (dawn.saves ? 'A narrow escape — doctors credited' : 'Residents dare to breathe again') : dawn.day === 1 ? 'Town in shock as the killing begins' : 'The killer strikes again — who is next?';
    function tap() { if (shown < lines.length) { V.cancel(); setShown(lines.length); } else props.onClose(); }
    return html`<div className="overlay" onClick=${tap}>
      <article className="paper" aria-live="polite">
        <header className="masthead"><h1>The Ravenport Ledger</h1></header>
        <div className="dateline"><span>Vol. XIII · No. ${dawn.day}</span><span>Morning edition</span><span>Two cents</span></div>
        <h2 className="headline">${headline}</h2>
        <div className="subhead">${sub}</div>
        <div className=${cx('news', !revealed.length && 'nophoto')}>
          ${revealed.length ? html`<div className="photos">${revealed.map(function (d) {
            return html`<figure className="photo" key=${d.id}><div className="pic">${d.avatar}</div>
              <figcaption><b>${d.name}</b>${d.role ? ', ' + d.role.name : ''}</figcaption></figure>`;
          })}</div>` : null}
          <div className="story">${lines.slice(0, shown).map(function (l, i) { return html`<p key=${i}>${l}</p>`; })}</div>
        </div>
        <div className="foot">${shown < lines.length ? 'Tap to read it all' : 'Tap to put the paper down'}</div>
      </article>
    </div>`;
  }

  function VerdictOverlay(props) {
    var v = props.verdict, view = props.view;
    useEffect(function () {
      var timers = [setTimeout(function () { V.sequence((v.clips || []).map(function (c) { return { clip: c, text: E.SCRIPT[c] }; })); }, v.noTrial ? 200 : 900)];
      if (v.noTrial) { A.play('bell'); return function () { timers.forEach(clearTimeout); }; }
      timers.push(setTimeout(function () { A.play('gavel'); FX.shake(); }, 550));
      if (v.executed) {
        timers.push(setTimeout(function () { A.play('death'); FX.shake(true); FX.flash('rgba(140,10,20,.45)'); FX.burst('blood', innerWidth / 2, innerHeight * 0.4, 60); }, 1700));
        if (v.jester) timers.push(setTimeout(function () { A.play('jester'); FX.burst('confetti', innerWidth / 2, innerHeight * 0.5, 120); }, 2800));
      } else timers.push(setTimeout(function () { A.play('heal'); FX.burst('sparkle', innerWidth / 2, innerHeight * 0.4, 50); }, 1300));
      return function () { timers.forEach(clearTimeout); };
    }, []);
    if (v.noTrial) {
      return html`<div className="overlay clear" onClick=${props.onClose}><div className="verdict">
        <div className="dove">🍂</div><h2>No trial today</h2><p className="muted">${v.text}</p></div></div>`;
    }
    function names(ids) { return ids.map(function (id) { var p = byId(view, id); return p ? p.name : '?'; }).join(', ') || 'nobody'; }
    return html`<div className="overlay" onClick=${props.onClose}><div className="verdict">
      <div className="gavel">🔨</div>
      <div className="tally"><span style=${{ color: 'var(--mafia)' }}>Guilty ${v.guilty.length}</span><span style=${{ color: 'var(--ok)' }}>Innocent ${v.innocent.length}</span></div>
      <div className=${v.executed ? 'hanged' : 'dove'}>${v.executed ? v.avatar : '🕊️'}</div>
      <h2>${v.executed ? v.name + ' is hanged' : v.name + ' walks free'}</h2>
      ${v.executed ? (v.role
        ? html`<div className=${cx('pill', teamClass(v.role.team))} style=${{ fontSize: '15px', padding: '8px 16px', animation: 'pop .6s 2s both' }}>${v.role.icon} ${v.role.name}</div>`
        : html`<div className="muted">Their role goes with them to the grave.</div>`) : null}
      ${v.jester ? html`<div className="notice" style=${{ animation: 'pop .6s 2.8s both' }}>The Jester wanted this. They win!</div>` : null}
      <p className="muted small">${v.text}</p>
      <div className="small muted">Guilty: ${names(v.guilty)}<br />Innocent: ${names(v.innocent)}</div>
    </div></div>`;
  }

  function GameOver(props) {
    var view = props.view, w = view.winner, me = view.me;
    var color = TEAM_COLOR[w.team] || 'var(--brass)';
    useEffect(function () {
      var cheers = me.won ? [0, 700, 1500] : [0];
      A.play(me.won ? 'victory' : 'defeat');
      var t = cheers.map(function (d) { return setTimeout(function () { FX.burst(me.won ? 'confetti' : 'gold', innerWidth * (0.25 + Math.random() * 0.5), innerHeight * 0.35, me.won ? 120 : 40); }, d); });
      t.push(setTimeout(function () { V.say({ clip: w.clip, text: w.title + '. ' + w.text }); }, 900));
      return function () { t.forEach(clearTimeout); };
    }, []);
    var stats = {}; (view.stats || []).forEach(function (s) { stats[s.id] = s; });
    var a = w.awards || {};
    var awards = [['🏆', 'Most valuable', a.mvp, 'points'], ['👉', 'Most accused', a.mostAccused, 'votes'], ['🔪', 'Deadliest', a.deadliest, 'kills'], ['🛡️', 'Guardian angel', a.guardian, 'saves']]
      .filter(function (x) { return x[2]; });
    var sorted = view.players.slice().sort(function (x, y) { return (stats[y.id] ? stats[y.id].score : 0) - (stats[x.id] ? stats[x.id].score : 0); });
    return html`<div className="overlay">
      <button className="icon-btn close" aria-label="Close" onClick=${props.onClose}>✕</button>
      <div className="gameover">
        <div className="you" style=${{ color: me.won ? 'var(--brass-hi)' : 'var(--muted)' }}>${me.won ? 'Victory' : 'Defeat'}</div>
        <h1 style=${{ color: color }}>${w.title}</h1>
        <p>${w.text}</p>
        ${w.neutralWins.length ? html`<div className="notice">${w.neutralWins.map(function (nw) { var p = byId(view, nw.id); return html`<div key=${nw.id}>${p ? p.name : '?'} ${nw.reason}</div>`; })}</div>` : null}
        <div className="awards">${awards.map(function (x, i) {
          var p = byId(view, x[2].id);
          return html`<div className="award" key=${x[1]} style=${{ animationDelay: (0.2 + i * 0.15) + 's' }}><div className="ic">${x[0]}</div><div className="t">${x[1]}</div><div className="n">${p ? p.avatar + ' ' + p.name : '?'}</div><div className="small">${x[2].value} ${x[3]}</div></div>`;
        })}</div>
        <div className="panel table-wrap">
          <table className="results">
            <thead><tr><th>Player</th><th>Role</th><th>Fate</th><th>Kills</th><th>Votes on them</th><th>Score</th></tr></thead>
            <tbody>${sorted.map(function (p) {
              var st = stats[p.id] || {};
              var won = w.winners.indexOf(p.id) >= 0;
              return html`<tr key=${p.id} className=${won ? 'win' : ''}>
                <td>${p.avatar} ${p.name}${won ? ' ★' : ''}</td>
                <td className=${p.role && teamClass(p.role.team)}>${st.originalRole ? st.originalRole.name + ' → ' : ''}${p.role ? p.role.icon + ' ' + p.role.name : '?'}</td>
                <td>${p.alive ? 'Survived' : (p.deathCause === 'lynch' ? 'Hanged' : 'Killed') + ', day ' + p.deathDay}</td>
                <td>${st.kills || 0}</td><td>${st.votesReceived || 0}</td><td><b>${st.score || 0}</b></td></tr>`;
            })}</tbody>
          </table>
        </div>
        <div className="row" style=${{ justifyContent: 'center' }}>
          ${me.isHost ? html`<button className="btn gold big" onClick=${function () { A.play('click'); props.send({ type: 'lobby' }); }}>Play again</button>` : html`<span className="muted" style=${{ fontFamily: 'var(--f-type)' }}>Waiting for the host to start another round…</span>`}
          <button className="btn" onClick=${props.onClose}>View the table</button>
          <button className="btn ghost" onClick=${props.onLeave}>Leave</button>
        </div>
        ${view.timeline && view.timeline.length ? html`<details className="panel" style=${{ width: '100%', textAlign: 'left' }}><summary className="panel-head" style=${{ cursor: 'pointer' }}><h3>How it happened</h3></summary>
          <div className="panel-body small" style=${{ fontFamily: 'var(--f-type)' }}>${view.timeline.map(function (t, i) { return html`<div key=${i}><span className="muted">Day ${t.day}</span> — ${t.text}</div>`; })}</div></details>` : null}
      </div>
    </div>`;
  }

  // ───────────────────────── Game screen ─────────────────────────
  function ActionStrip(props) {
    var view = props.view, me = view.me, send = props.send, ph = view.phase;
    var alive = view.players.filter(function (p) { return p.alive; });
    switch (ph) {
      case 'roles':
        return html`<div className="actions"><button className="btn gold" onClick=${props.openRole}>Look at my card</button></div>`;
      case 'night':
        if (!me.alive) return html`<div className="actions"><span className="muted">You are a ghost now. Whisper with the dead in the Graveyard.</span></div>`;
        if (me.actions && me.actions.length) {
          return html`<div className="actions">
            <button className=${cx('btn big', me.nightDone ? '' : 'gold')} onClick=${props.openNight}>${me.nightDone ? '✓ Locked in — change your choice' : me.role.icon + ' Choose your night action'}</button></div>`;
        }
        return html`<div className="actions"><span className="muted">You sleep through the night.</span><button className="btn small ghost" onClick=${props.openNight}>Dream…</button></div>`;
      case 'dawn':
        return html`<div className="actions"><button className="btn small ghost" onClick=${props.openDawn}>Read the morning paper again</button></div>`;
      case 'discussion': {
        var ready = alive.filter(function (p) { return p.ready; }).length;
        return html`<div className="actions">
          ${me.alive ? html`<button className=${cx('btn', me.ready ? '' : 'gold')} onClick=${function () { A.play('click'); send({ type: 'ready' }); }}>
            ${me.ready ? '✓ Ready to vote (tap to undo)' : 'Ready to vote'}</button>` : null}
          <span className="muted small">${ready} of ${alive.length} ready · tap someone at the table, then an emoji, to point at them</span></div>`;
      }
      case 'voting': {
        if (!me.alive) return html`<div className="actions"><span className="muted">The living are voting.</span></div>`;
        var mine = me.vote;
        return html`<div className="actions">
          <span className="muted small">${mine && mine !== 'skip' ? 'You voted for ' + (byId(view, mine) || {}).name + '. Tap them again to take it back.' : 'Tap someone at the table to put them on trial.'}</span>
          <button className=${cx('btn small', mine === 'skip' ? 'gold' : 'ghost')} onClick=${function () { A.play('vote'); send({ type: 'vote', target: mine === 'skip' ? null : 'skip' }); }}>
            ${mine === 'skip' ? '✓ Skipping' : 'Skip the vote'} (${view.vote ? view.vote.skip : 0})</button></div>`;
      }
      case 'defense':
        return html`<div className="actions"><span className="muted">${view.trial && view.trial.accusedId === me.id ? 'Plead your case in the Town chat — only you may speak.' : 'The accused has the floor. Listen carefully.'}</span></div>`;
      case 'judgment': {
        if (view.trial.accusedId === me.id) return html`<div className="actions"><span className="muted">Your fate is in their hands… (${view.trial.judgedCount} of ${view.trial.voterCount} have decided)</span></div>`;
        if (!me.alive) return html`<div className="actions"><span className="muted">The living decide.</span></div>`;
        var j = me.judgment;
        var judge = function (v) { A.play(v === 'guilty' ? 'tock' : 'select'); send({ type: 'judge', verdict: j === v ? null : v }); };
        return html`<div className="actions"><div className="verdict-btns">
          <button className=${cx('btn blood', j === 'guilty' && 'on')} onClick=${function () { judge('guilty'); }}>Guilty</button>
          <button className=${cx('btn innocent', j === 'innocent' && 'on')} onClick=${function () { judge('innocent'); }}>Innocent</button>
        </div><span className="muted small" style=${{ width: '100%', textAlign: 'center' }}>${view.trial.judgedCount} of ${view.trial.voterCount} have decided · votes stay secret until the verdict</span></div>`;
      }
      case 'verdict':
        return html`<div className="actions"><button className="btn small ghost" onClick=${props.openVerdict}>Show the verdict</button></div>`;
      case 'gameover':
        return html`<div className="actions">
          <button className="btn gold" onClick=${props.openEnd}>Results</button>
          ${me.isHost ? html`<button className="btn" onClick=${function () { send({ type: 'lobby' }); }}>Play again</button>` : null}</div>`;
      default: return null;
    }
  }

  function Game(props) {
    var view = props.view, me = view.me, send = props.send, ph = view.phase;
    var s1 = useState(null), selected = s1[0], setSelected = s1[1];
    var s2 = useState({}), closed = s2[0], setClosed = s2[1]; // overlays the player dismissed this phase
    var s3 = useState(false), roleOpen = s3[0], setRoleOpen = s3[1];
    var phaseKey = ph + ':' + view.day;
    useEffect(function () { setClosed({}); setSelected(null); }, [phaseKey]);
    function close(k) { var c = Object.assign({}, closed); c[k] = true; setClosed(c); }
    function open(k) { var c = Object.assign({}, closed); c[k] = false; setClosed(c); }

    function canClick(p) {
      if (ph === 'voting') return me.alive && p.alive && p.id !== me.id;
      return ph !== 'night' && ph !== 'lobby';
    }
    function onCard(p) {
      if (ph === 'voting') { A.play('vote'); send({ type: 'vote', target: me.vote === p.id ? null : p.id }); return; }
      A.play('click');
      setSelected(selected === p.id ? null : p.id);
    }
    var meta = PHASE[ph] || PHASE.lobby;
    var kicker = ph === 'roles' ? 'Before the first night' : ph === 'gameover' ? 'Curtain' : ph === 'night' ? 'Night ' + view.day : 'Day ' + view.day;
    var hasActions = me.actions && me.actions.length;
    return html`<div className="game">
      <div className="stage">
        <section className="panel announce">
          <span className="phase-title" key=${phaseKey}><small>${kicker}</small>${meta.title}</span>
          <${Typewriter} text=${view.announcement} />
        </section>
        <${TownHall} view=${view} floats=${props.floats} selectedId=${selected} canClick=${canClick} onCard=${onCard} />
        <section className="panel"><${ActionStrip} view=${view} send=${send}
          openNight=${function () { open('night'); }} openDawn=${function () { open('dawn'); }} openVerdict=${function () { open('verdict'); }}
          openEnd=${function () { open('end'); }} openRole=${function () { open('roles'); }} /></section>
      </div>
      <${SidePanel} view=${view} chat=${props.chat} send=${send} onRole=${function () { setRoleOpen(true); }}
        reactions=${html`<${Reactions} view=${view} send=${send} selectedId=${selected} />`} />

      ${ph === 'roles' && !closed.roles ? html`<${RoleReveal} view=${view} send=${send} />` : null}
      ${ph === 'night' && me.alive && !closed.night && hasActions ? html`<${NightModal} view=${view} send=${send} onClose=${function () { close('night'); }} />` : null}
      ${ph === 'night' && me.alive && closed.night === false && !hasActions ? html`<${DreamModal} view=${view} onClose=${function () { close('night'); }} />` : null}
      ${ph === 'dawn' && view.dawn && !closed.dawn ? html`<${Newspaper} dawn=${view.dawn} onClose=${function () { close('dawn'); }} />` : null}
      ${ph === 'verdict' && view.verdict && !closed.verdict ? html`<${VerdictOverlay} verdict=${view.verdict} view=${view} onClose=${function () { close('verdict'); }} />` : null}
      ${ph === 'gameover' && view.winner && !closed.end ? html`<${GameOver} view=${view} send=${send} onClose=${function () { close('end'); }} onLeave=${props.onLeave} />` : null}
      ${roleOpen && me.role ? html`<${RoleSheet} view=${view} onClose=${function () { setRoleOpen(false); }} />` : null}
    </div>`;
  }

  // ───────────────────────── Top bar ─────────────────────────
  function SoundMenu() {
    var s = useState(false), open = s[0], setOpen = s[1];
    var s2 = useState({ music: A.settings.music, sfx: A.settings.sfx, voice: V.enabled }), st = s2[0], setSt = s2[1];
    var s3 = useState(0), setVoicesTick = s3[1];
    useEffect(function () { V.onChange(function () { setVoicesTick(function (x) { return x + 1; }); }); }, []);
    var voices = V.voices().slice(0, 18);
    var allOff = !st.music && !st.sfx && !st.voice;
    function set(k, on) {
      A.unlock();
      if (k === 'music') A.setMusic(on);
      if (k === 'sfx') A.setSfx(on);
      if (k === 'voice') { V.setEnabled(on); if (on) V.say({ clip: 'preview', text: E.SCRIPT.preview }); }
      var nx = Object.assign({}, st); nx[k] = on; setSt(nx);
    }
    useEffect(function () {
      if (!open) return;
      var away = function (e) { if (!e.target.closest('.sound-menu')) setOpen(false); };
      document.addEventListener('pointerdown', away);
      return function () { document.removeEventListener('pointerdown', away); };
    }, [open]);
    return html`<div className="sound-menu" style=${{ position: 'relative' }}>
      <button className="icon-btn" aria-label="Sound settings" aria-expanded=${open} title="Sound" onClick=${function () { A.unlock(); setOpen(!open); }}><${SpeakerIcon} off=${allOff} /></button>
      ${open ? html`<div className="panel menu">
        <label className="switch"><span>Music</span><input type="checkbox" checked=${st.music} onChange=${function (e) { set('music', e.target.checked); }} /></label>
        <label className="switch"><span>Sound effects</span><input type="checkbox" checked=${st.sfx} onChange=${function (e) { set('sfx', e.target.checked); }} /></label>
        <label className="switch"><span>Narrator voice</span><input type="checkbox" disabled=${!V.available} checked=${st.voice} onChange=${function (e) { set('voice', e.target.checked); }} /></label>
        ${V.pack.count
          ? html`<div className="hint">Recorded narrator: ${V.pack.count} of ${V.pack.total} lines.</div>`
          : V.available && st.voice && voices.length ? html`<label className="field">Stand-in voice
          <select className="select" value=${V.voiceId} onChange=${function (e) { V.setVoice(e.target.value); V.say({ clip: 'preview', text: E.SCRIPT.preview }); setVoicesTick(function (x) { return x + 1; }); }}>
            ${voices.map(function (v) { return html`<option key=${v.id} value=${v.id}>${v.label}</option>`; })}
          </select></label>` : null}
        <div className="hint">${V.pack.count ? '' : 'No narration recorded yet, so the browser reads the story. '}<a href="record.html" target="_blank" rel="noopener" style=${{ color: 'var(--brass-hi)' }}>Open the recording studio →</a></div>
      </div>` : null}
    </div>`;
  }

  function Topbar(props) {
    var view = props.view;
    var s2 = useState(false), guide = s2[0], setGuide = s2[1];
    var meta = view ? PHASE[view.phase] : null;
    function back() {
      if (view && view.phase !== 'lobby' && view.phase !== 'gameover' && !confirm('Leave this game? Your seat will be left empty.')) return;
      props.onLeave(true);
    }
    return html`<header className=${cx('topbar', view && view.phase !== 'lobby' && 'in-game')}>
      <button className="icon-btn" onClick=${back} aria-label=${view ? 'Leave room' : 'All games'} title=${view ? 'Leave room' : 'All games'}>←</button>
      <span className="brand">Mafia<small>Town hall</small></span>
      ${view ? (props.kind === 'offline' ? html`<span className="pill offline">Solo</span>` : html`<span className="pill code" title="Room code">${view.code}</span>`) : null}
      ${meta && view.phase !== 'lobby' ? html`<span className="pill">${meta.title}${view.day && view.phase !== 'gameover' ? ' · ' + view.day : ''}</span>` : null}
      <span className="spacer"></span>
      ${view && props.kind === 'online' ? html`<span className=${cx('conn-dot', !props.online && 'bad')} title=${props.online ? 'Connected' : 'Reconnecting…'}></span>` : null}
      ${view && TICKING[view.phase] ? html`<${Timer} left=${props.left} total=${view.phaseDuration} />` : null}
      <button className="icon-btn" aria-label="Roles guide" title="Roles guide" onClick=${function () { setGuide(true); }}>Roles</button>
      <${SoundMenu} />
      ${guide ? html`<div className="overlay" onClick=${function () { setGuide(false); }}>
        <button className="icon-btn close" aria-label="Close" onClick=${function () { setGuide(false); }}>✕</button>
        <div className="panel" style=${{ width: 'min(900px,100%)' }} onClick=${function (e) { e.stopPropagation(); }}>
          <div className="panel-head"><h3>The roles</h3></div><div className="panel-body"><${RolesGuide} /></div></div></div>` : null}
    </header>`;
  }

  // ───────────────────────── Root ─────────────────────────
  function App() {
    var s1 = useState(function () {
      var hp = hub ? window.Hub.player() : null;
      return { name: store.get('name', hp && hp.name && hp.name !== 'Player' ? hp.name : ''), avatar: store.get('avatar', rand(E.AVATARS)) };
    }), profile = s1[0], setProfileRaw = s1[1];
    var s2 = useState(null), conn = s2[0], setConn = s2[1];
    var s3 = useState(null), view = s3[0], setView = s3[1];
    var s4 = useState({}), chat = s4[0], setChat = s4[1];
    var s5 = useState(true), online = s5[0], setOnline = s5[1];
    var s6 = useState({ text: '', k: 0 }), toast = s6[0], setToastState = s6[1];
    var s7 = useState([]), floats = s7[0], setFloats = s7[1];
    var s8 = useState(false), busy = s8[0], setBusy = s8[1];
    var s9 = useState(''), error = s9[0], setError = s9[1];
    var connRef = useRef(null), viewRef = useRef(null);
    connRef.current = conn; viewRef.current = view;

    function setProfile(p) { setProfileRaw(p); store.set('name', p.name); store.set('avatar', p.avatar); }
    var setToast = useCallback(function (text) { setToastState(function (t) { return { text: text, k: t.k + 1 }; }); }, []);

    var handlers = useMemo(function () {
      return {
        onState: function (v) { setView(v); },
        onChat: function (m) {
          setChat(function (c) { var nx = Object.assign({}, c); nx[m.channel] = (c[m.channel] || []).concat([m]).slice(-150); return nx; });
          var v = viewRef.current;
          if (!m.system && v && v.me && m.from !== v.me.id) A.play('chat');
        },
        onChatHistory: function (h) { setChat(h || {}); },
        onFx: function (d) {
          if (d.type !== 'reaction') return;
          var v = viewRef.current, from = v && byId(v, d.from);
          var f = { key: Math.random().toString(36).slice(2), emoji: d.emoji, from: d.from, target: d.target, fromName: from ? from.name : '' };
          setFloats(function (fl) { return fl.concat([f]).slice(-30); });
          setTimeout(function () { setFloats(function (fl) { return fl.filter(function (x) { return x.key !== f.key; }); }); }, 1900);
        },
        onClosed: function (reason) { setConn(null); setView(null); setChat({}); setError(reason || 'Disconnected.'); },
        onStatus: function (ok) { setOnline(ok); }
      };
    }, []);

    // Rejoin our seat after a refresh.
    useEffect(function () {
      var seat = Net.savedSeat();
      if (!seat || !Net.onlineAvailable()) return;
      var c = Net.createOnline(handlers);
      setBusy(true);
      c.resume(seat).then(function (res) {
        setBusy(false);
        if (res.error) { c.leave(); return; }
        setConn(c);
      });
    }, []);

    function cleanProfile() { return { name: profile.name.trim().slice(0, 18), avatar: profile.avatar }; }
    function goOnline(kind, code) {
      A.unlock(); A.play('click');
      setError(''); setBusy(true);
      var c = Net.createOnline(handlers);
      var p = cleanProfile();
      (kind === 'create' ? c.create(p) : c.join(code, p)).then(function (res) {
        setBusy(false);
        if (res.error) { setError(res.error); c.leave(); return; }
        setConn(c);
      });
    }
    function goOffline(bots) {
      A.unlock(); A.play('click'); setError('');
      setConn(Net.createOffline(handlers, cleanProfile(), bots));
    }
    var send = useCallback(function (cmd) {
      var c = connRef.current;
      if (!c) return Promise.resolve({ error: 'Not connected.' });
      return c.send(cmd).then(function (r) { if (r && r.error) { setToast(r.error); A.play('error'); } return r; });
    }, []);
    function leave(toHub) {
      if (connRef.current) connRef.current.leave();
      setConn(null); setView(null); setChat({});
      A.heartbeat(0); V.cancel();
      if (toHub === true && !view) { if (hub) hub.exit(); else location.href = '../../index.html'; }
    }

    // Lighting, music and ghost mode follow the phase.
    var scene = view ? PHASE[view.phase].scene : 'lobby';
    var ghost = !!(view && view.me && view.phase !== 'lobby' && view.phase !== 'gameover' && !view.me.alive);
    useEffect(function () {
      document.body.className = 'phase-' + scene + (ghost ? ' ghost' : '');
      FX.ambient(SCENE_FX[scene]);
    }, [scene, ghost]);
    // After a killing (or while you haunt the table, or during the vote) the day turns suspenseful.
    var nightDeaths = !!(view && view.players.some(function (p) { return !p.alive && p.deathCause === 'night' && p.deathDay === view.day; }));
    var mood = SCENE_MUSIC[scene];
    if ((scene === 'day' || scene === 'dawn') && (nightDeaths || ghost || view.phase === 'voting')) mood = 'suspense';
    useEffect(function () { A.music(mood); }, [mood]);

    // Phase transitions: stingers, narration, hub reporting.
    var prev = useRef('');
    useEffect(function () {
      if (!view) { prev.current = ''; return; }
      var key = view.phase + ':' + view.day;
      if (prev.current === key) return;
      var was = prev.current; prev.current = key;
      if (!was) return; // just (re)joined: stay quiet
      if (NARRATED[view.phase] && view.narration && view.narration.length) {
        V.sequence(view.narration.map(function (c) { return { clip: c, text: E.SCRIPT[c] }; }));
      }
      switch (view.phase) {
        case 'roles': A.play('whoosh'); if (hub) hub.report('session-start', { mode: conn && conn.kind, players: view.players.length }); break;
        case 'night': A.play('gong'); break;
        case 'dawn': A.play('bell'); break;
        case 'voting': A.play('bell'); break;
        case 'defense': A.play('gavel'); break;
        case 'judgment': A.play('bell'); break;
        case 'gameover':
          if (hub && view.me && view.me.role) hub.report('session-end', { result: view.me.won ? 'win' : 'lose', role: view.me.role.id, team: view.me.role.team, winner: view.winner && view.winner.team, mode: conn && conn.kind });
          break;
      }
    }, [view && view.phase, view && view.day]);

    // Clock ticks and heartbeat.
    var left = useRemaining(view);
    var sec = left == null ? null : Math.ceil(left);
    useEffect(function () {
      if (!view || sec == null || !TICKING[view.phase] || sec > 10 || sec <= 0) return;
      A.play(sec <= 5 ? 'tock' : 'tick');
    }, [sec]);
    // The storyteller warns the table when time is nearly up.
    useEffect(function () {
      if (!view || view.phaseDuration < 30) return;
      if (view.phase === 'discussion' && sec === 16) V.say({ clip: 'discussion.late', text: E.SCRIPT['discussion.late'] });
      if (view.phase === 'voting' && sec === 11) V.say({ clip: 'voting.late', text: E.SCRIPT['voting.late'] });
    }, [sec]);
    useEffect(function () {
      var level = 0;
      if (view && view.me && view.me.alive) {
        var ph = view.phase, id = view.me.id;
        if ((ph === 'defense' || ph === 'judgment') && view.trial) level = view.trial.accusedId === id ? 2 : 1;
        else if (ph === 'voting' && view.vote) {
          var against = view.vote.tally[id] || 0;
          level = against >= 2 ? 2 : against ? 1 : (sec != null && sec <= 6 ? 1 : 0);
        }
      }
      A.heartbeat(level);
    }, [view, sec != null && sec <= 6]);

    useEffect(function () {
      var unlock = function () { A.unlock(); };
      addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
      return function () { removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
    }, []);

    var body;
    if (!view) {
      body = html`<${Home} profile=${profile} setProfile=${setProfile} busy=${busy} error=${error}
        onCreate=${function () { goOnline('create'); }} onJoin=${function (code) { goOnline('join', code); }} onOffline=${goOffline} />`;
    } else if (view.phase === 'lobby') {
      body = html`<${Lobby} view=${view} chat=${chat} send=${send} kind=${conn && conn.kind} toast=${setToast} />`;
    } else {
      body = html`<${Game} view=${view} chat=${chat} send=${send} floats=${floats} onLeave=${function () { leave(false); }} />`;
    }
    return html`<div className="app">
      <${Topbar} view=${view} kind=${conn && conn.kind} online=${online} left=${left} onLeave=${leave} />
      ${view && conn && conn.kind === 'online' && !online ? html`<div className="notice error" style=${{ margin: '10px 16px 0', textAlign: 'center' }}>Connection lost — reconnecting to the room…</div>` : null}
      ${body}
      <${Toast} text=${toast.text} k=${toast.k} />
    </div>`;
  }

  ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
})();
