/* Putt Club — interface (React 18 + htm, no build step). The UI re-renders only when the room view or
 * local UI state changes (a few times a second at most); per-frame things like the power meter are written
 * straight to the DOM by the scene loop. */
(function (global) {
  'use strict';
  var PC = global.PC, React = global.React, html = global.htm.bind(React.createElement);
  var Match = global.PuttMatch, Courses = global.PuttCourses, Powerups = global.PuttPowerups;
  var useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;

  function Icon(p) { return html`<span class=${'ic ' + (p.cls || '')} dangerouslySetInnerHTML=${{ __html: p.power ? PC.icons.power(p.power) : p.symbol ? PC.icons.symbol(p.symbol) : PC.icons.ui(p.name) }}></span>`; }
  function Avatar(p) {
    var c = p.color;
    return html`<span class=${'avatar ' + (p.size || '')} style=${{ '--pc': Match.COLORS[c] }} title=${Match.COLOR_NAMES[c] + ' ' + Match.SYMBOLS[c]}><${Icon} symbol=${Match.SYMBOLS[c]} /></span>`;
  }
  function Btn(p) {
    return html`<button type="button" class=${'btn ' + (p.kind || '') + (p.small ? ' small' : '')} disabled=${p.disabled} title=${p.title} aria-label=${p.label || p.title}
      onClick=${function (e) { PC.audio.unlock(); PC.audio.play('click'); p.onClick && p.onClick(e); }} onMouseEnter=${function () { PC.audio.play('hover'); }}>
      ${p.icon ? html`<${Icon} name=${p.icon} />` : null}${p.children}</button>`;
  }
  function relClass(rel) { return rel < 0 ? 'under' : rel > 0 ? 'over' : 'even'; }

  // ------------------------------------------------------------------ menu

  function Logo(p) {
    return html`<h1 class=${'logo ' + (p.small ? 'small' : '')} aria-label="Putt Club">
      <span class="logo-word">PUTT</span>
      <span class="logo-flag" aria-hidden="true"><svg viewBox="0 0 40 64"><path d="M8 62V4" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M10 5h24l-6 8 6 8H10z" fill="var(--coral)"/><ellipse cx="8" cy="62" rx="8" ry="2.5" fill="currentColor" opacity=".35"/></svg></span>
      <span class="logo-word">CLUB</span>
    </h1>`;
  }

  function ProfileCard(p) {
    var prof = p.profile;
    return html`<div class="card profile">
      <label class="field"><span>Your name</span>
        <input value=${prof.name} maxLength="16" placeholder="Name" autoComplete="nickname"
          onInput=${function (e) { p.setProfile({ name: e.target.value, color: prof.color }); }} />
      </label>
      <div class="field"><span>Your ball</span>
        <div class="swatches" role="radiogroup" aria-label="Ball colour">
          ${Match.COLORS.map(function (c, i) {
            return html`<button type="button" role="radio" aria-checked=${prof.color === i} class=${'swatch' + (prof.color === i ? ' on' : '')} style=${{ '--pc': c }}
              aria-label=${Match.COLOR_NAMES[i] + ' ' + Match.SYMBOLS[i]} onClick=${function () { PC.audio.unlock(); PC.audio.play('click'); p.setProfile({ name: prof.name, color: i }); }}>
              <${Icon} symbol=${Match.SYMBOLS[i]} /></button>`;
          })}
        </div>
      </div>
    </div>`;
  }

  function Menu(p) {
    var s = p.state, A = p.actions;
    var _c = useState(s.joinCode || ''), code = _c[0], setCode = _c[1];
    var _b = useState(2), bots = _b[0], setBots = _b[1];
    var online = PC.net.onlineAvailable();
    useEffect(function () { if (s.joinCode) setCode(s.joinCode); }, [s.joinCode]);
    return html`<div class="screen menu">
      <div class="menu-col">
        <${Logo} />
        <p class="tag">Mini-golf with friends, power-ups and a little chaos.</p>
        <${ProfileCard} profile=${s.profile} setProfile=${A.setProfile} />
        <div class="card actions">
          <${Btn} kind="primary big" icon="flag" disabled=${!online || s.busy} onClick=${A.create}>Create room</${Btn}>
          <form class="join-row" onSubmit=${function (e) { e.preventDefault(); A.join(code); }}>
            <input class="code-input" value=${code} maxLength="4" placeholder="CODE" aria-label="Room code" autoCapitalize="characters" autoComplete="off" spellCheck="false"
              onInput=${function (e) { setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '')); }} />
            <${Btn} kind="secondary" disabled=${!online || code.length !== 4 || s.busy} onClick=${function () { A.join(code); }}>Join</${Btn}>
          </form>
          ${!online ? html`<p class="note">Online rooms need the hub server: run <code>npm start</code> and open this page from it. Solo practice works anywhere.</p>` : null}
          <div class="solo-row">
            <${Btn} kind="ghost" icon="bot" disabled=${s.busy} onClick=${function () { A.solo(bots); }}>Practice solo</${Btn}>
            <label class="mini-select">with
              <select value=${bots} onChange=${function (e) { setBots(Number(e.target.value)); }} aria-label="Number of bots">
                ${[0, 1, 2, 3].map(function (n) { return html`<option value=${n}>${n === 0 ? 'no bots' : n + (n === 1 ? ' bot' : ' bots')}</option>`; })}
              </select>
            </label>
          </div>
        </div>
        <div class="menu-foot">
          <${Btn} kind="link" icon="help" onClick=${function () { A.ui({ modal: 'help' }); }}>How to play</${Btn}>
          <${Btn} kind="link" icon="gear" onClick=${function () { A.ui({ modal: 'settings' }); }}>Settings</${Btn}>
          <${SoundToggle} />
          ${global.Hub && global.Hub.inHub ? html`<${Btn} kind="link" icon="back" onClick=${function () { global.Hub.exit(); }}>Game hub</${Btn}>` : null}
        </div>
      </div>
    </div>`;
  }

  function SoundToggle() {
    var _m = useState(PC.audio.settings.mute), mute = _m[0], setMute = _m[1];
    return html`<${Btn} kind="link" icon=${mute ? 'mute' : 'sound'} label=${mute ? 'Unmute' : 'Mute'} onClick=${function () { PC.audio.set('mute', !mute); setMute(!mute); }}>${mute ? 'Sound off' : 'Sound on'}</${Btn}>`;
  }

  // ------------------------------------------------------------------ lobby

  function Lobby(p) {
    var v = p.view, A = p.actions, me = v.players.find(function (q) { return q.id === v.you; }) || {};
    var host = !!me.isHost, st = v.settings;
    var qrRef = useRef(null);
    var link = p.state.inviteUrl;
    useEffect(function () {
      if (qrRef.current && global.qrcode && link) {
        try { var q = global.qrcode(0, 'M'); q.addData(link); q.make(); qrRef.current.innerHTML = q.createSvgTag({ cellSize: 4, margin: 1, scalable: true }); } catch (e) { /* QR is optional */ }
      }
    }, [link]);
    var waiting = v.players.filter(function (q) { return !q.isHost && !q.bot && q.connected && !q.ready; });
    var set = function (patch) { A.send({ type: 'settings', settings: patch }); };
    return html`<div class="screen lobby">
      <header class="lobby-head">
        <${Logo} small=${true} />
        ${v.code === 'SOLO' ? html`<div class="room-code solo"><span class="label">Offline</span><span class="solo-title">Solo practice</span></div>` : html`<div class="room-code" aria-label=${'Room code ' + v.code.split('').join(' ')}>
          <span class="label">Room code</span>
          <span class="code">${v.code.split('').map(function (ch, i) { return html`<b key=${i}>${ch}</b>`; })}</span>
        </div>
        <div class="invite">
          <div class="qr" ref=${qrRef} aria-hidden="true"></div>
          <div class="invite-text">
            <${Btn} kind="secondary small" icon="link" onClick=${A.copyInvite}>${p.state.copied ? 'Link copied' : 'Copy invite link'}</${Btn}>
            <span class="hint">${p.state.lanWarning || 'Friends on the same Wi-Fi can scan or open the link.'}</span>
          </div>
        </div>`}
      </header>
      <div class="lobby-grid">
        <section class="card players" aria-label="Players">
          <h2>Players <span class="count">${v.players.length} / ${Match.MAX_PLAYERS}</span></h2>
          <ul>
            ${v.players.map(function (q) {
              return html`<li key=${q.id} class=${'player' + (q.connected || q.bot ? '' : ' off') + (q.id === v.you ? ' me' : '')}>
                <${Avatar} color=${q.color} />
                <span class="pname">${q.name}${q.id === v.you ? html` <em>(you)</em>` : null}</span>
                ${q.isHost ? html`<span class="pill host" title="Host"><${Icon} name="crown" />Host</span>` : null}
                ${q.bot ? html`<span class="pill bot"><${Icon} name="bot" />Bot</span>` : null}
                ${!q.connected && !q.bot ? html`<span class="pill off"><${Icon} name="offline" />Reconnecting</span>` : null}
                ${!q.isHost && !q.bot && q.connected ? html`<span class=${'pill ' + (q.ready ? 'ready' : 'wait')}><${Icon} name=${q.ready ? 'check' : 'wait'} />${q.ready ? 'Ready' : 'Not ready'}</span>` : null}
                ${host && q.id !== v.you ? html`<button class="x" title=${'Remove ' + q.name} aria-label=${'Remove ' + q.name} onClick=${function () { A.send({ type: 'kick', id: q.id }); }}><${Icon} name="close" /></button>` : null}
              </li>`;
            })}
          </ul>
          ${host && v.players.length < Match.MAX_PLAYERS ? html`<${Btn} kind="ghost small" icon="bot" onClick=${function () { A.send({ type: 'addBot' }); }}>Add a bot</${Btn}>` : null}
        </section>
        <section class="card settings" aria-label="Match settings">
          <h2>Match ${host ? null : html`<span class="count">set by the host</span>`}</h2>
          <fieldset disabled=${!host}>
            <div class="seg" role="radiogroup" aria-label="Mode">
              ${[['casual', 'Casual', 'One course, then vote'], ['tournament', 'Tournament', 'Several courses, one leaderboard']].map(function (m) {
                return html`<button type="button" role="radio" aria-checked=${st.mode === m[0]} class=${st.mode === m[0] ? 'on' : ''} onClick=${function () { set({ mode: m[0] }); }}><b>${m[1]}</b><small>${m[2]}</small></button>`;
              })}
            </div>
            ${st.mode === 'casual' ? html`<div class="courses">
              ${Courses.COURSES.map(function (c) {
                return html`<button type="button" class=${'course-card theme-' + c.theme + (st.course === c.id ? ' on' : '')} aria-pressed=${st.course === c.id} onClick=${function () { set({ course: c.id }); }}>
                  <span class="course-art" aria-hidden="true"></span><b>${c.name}</b><small>${c.blurb}</small></button>`;
              })}
            </div>` : html`<label class="row">Courses
              <select value=${st.courses} onChange=${function (e) { set({ courses: Number(e.target.value) }); }}>
                <option value="3">3 courses (18 holes)</option><option value="6">6 courses (36, second lap mirrored)</option><option value="9">9 courses (54 holes)</option>
              </select></label>`}
            <div class="opts">
              <label class="row toggle"><input type="checkbox" checked=${st.powerups} onChange=${function (e) { set({ powerups: e.target.checked }); }} /> Power-ups</label>
              <label class="row">Crates
                <select value=${st.powerupFreq} disabled=${!st.powerups} onChange=${function (e) { set({ powerupFreq: e.target.value }); }}><option value="low">Few</option><option value="normal">Normal</option><option value="high">Lots</option></select></label>
              ${st.mode === 'tournament' ? html`<label class="row toggle"><input type="checkbox" checked=${st.keepPowerups} onChange=${function (e) { set({ keepPowerups: e.target.checked }); }} /> Keep items between courses</label>` : null}
              <label class="row toggle"><input type="checkbox" checked=${st.collisions} onChange=${function (e) { set({ collisions: e.target.checked }); }} /> Balls bump each other</label>
              <label class="row">Shot strength
                <select value=${st.strength} onChange=${function (e) { set({ strength: e.target.value }); }}><option value="soft">Gentle</option><option value="normal">Normal</option><option value="strong">Strong</option></select></label>
              <label class="row">Stroke limit
                <select value=${st.maxStrokes} onChange=${function (e) { set({ maxStrokes: Number(e.target.value) }); }}>${[5, 6, 7, 8, 10, 12].map(function (n) { return html`<option value=${n}>${n} strokes</option>`; })}</select></label>
              <label class="row">Shot timer
                <select value=${st.shotTimer} onChange=${function (e) { set({ shotTimer: Number(e.target.value) }); }}><option value="0">Off</option><option value="20">20 s</option><option value="30">30 s</option><option value="45">45 s</option></select></label>
              <label class="row">Hole time
                <select value=${st.holeTime} onChange=${function (e) { set({ holeTime: Number(e.target.value) }); }}><option value="90">1:30</option><option value="150">2:30</option><option value="240">4:00</option></select></label>
              <label class="row">Reset penalty
                <select value=${st.resetPenalty} onChange=${function (e) { set({ resetPenalty: Number(e.target.value) }); }}><option value="0">None</option><option value="1">+1 stroke</option><option value="2">+2 strokes</option></select></label>
            </div>
          </fieldset>
        </section>
      </div>
      <footer class="lobby-foot">
        <${Btn} kind="link" icon="back" onClick=${A.leave}>Leave</${Btn}>
        <${Btn} kind="link" icon="help" onClick=${function () { A.ui({ modal: 'help' }); }}>How to play</${Btn}>
        <span class="spacer"></span>
        ${host
          ? html`<div class="start-wrap">${waiting.length ? html`<span class="hint">Waiting for ${waiting.map(function (q) { return q.name; }).join(', ')}</span>` : null}
              <${Btn} kind="primary big" icon="play" disabled=${waiting.length > 0} onClick=${function () { A.send({ type: 'start' }); }}>${v.players.length === 1 ? 'Start solo' : 'Start game'}</${Btn}></div>`
          : html`<${Btn} kind=${me.ready ? 'secondary big' : 'primary big'} icon=${me.ready ? 'check' : 'play'} onClick=${function () { A.send({ type: 'ready', ready: !me.ready }); }}>${me.ready ? 'Ready! (tap to undo)' : 'I\'m ready'}</${Btn}>`}
      </footer>
    </div>`;
  }

  // ------------------------------------------------------------------ game HUD

  function holeInfo(v) {
    if (!v.course || !v.hole) return null;
    var c = Courses.byId(v.course.id), h = c.holes[v.hole.index];
    return { course: c, hole: h, name: c.name + (v.course.mirror ? ' (Mirrored)' : '') };
  }

  function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  function Timer(p) {
    // Counts down locally between server updates.
    var _t = useState(p.left), left = _t[0], setLeft = _t[1];
    useEffect(function () {
      var start = performance.now(), base = p.left;
      setLeft(base);
      if (base == null) return;
      var id = setInterval(function () { setLeft(Math.max(0, base - (performance.now() - start) / 1000)); }, 250);
      return function () { clearInterval(id); };
    }, [p.left]);
    if (left == null) return null;
    return html`<span class=${'timer' + (left < 20 ? ' low' : '')} aria-label=${'Time left ' + fmtTime(left)}><${Icon} name="wait" />${fmtTime(left)}</span>`;
  }

  function PlayerStrip(p) {
    var v = p.view, info = holeInfo(v);
    var rows = v.standings.length ? v.standings : v.players;
    var byId = {}; v.players.forEach(function (q) { byId[q.id] = q; });
    return html`<ol class=${'strip' + (p.open ? ' open' : '')} aria-label="Standings">
      ${rows.map(function (r) {
        var q = byId[r.id]; if (!q) return null;
        var status = q.finished ? (q.status === 'holed' ? 'holed' : 'out') : !q.connected && !q.bot ? 'off' : q.status === 'moving' ? 'moving' : '';
        return html`<li key=${q.id} class=${'srow ' + status + (q.id === v.you ? ' me' : '')}>
          <span class="rank">${r.rank || ''}</span><${Avatar} color=${q.color} size="sm" />
          <span class="sname">${q.name}</span>
          <span class="sstat" title="Strokes this hole">${q.finished ? html`<${Icon} name=${q.status === 'holed' ? 'flag' : 'close'} cls="tiny" />` : !q.connected && !q.bot ? html`<${Icon} name="offline" cls="tiny" />` : null}${q.strokes}</span>
          <span class=${'srel ' + relClass(r.rel || 0)} title="Total vs par">${r.total != null && r.played ? PC.relText(r.rel) : '–'}</span>
        </li>`;
      })}
      ${info ? null : null}
    </ol>`;
  }

  function Inventory(p) {
    var me = p.me, A = p.actions;
    if (!p.view.settings.powerups) return null;
    var slots = [0, 1];
    return html`<div class="inventory" aria-label="Power-ups">
      ${slots.map(function (i) {
        var id = me.inventory[i], def = id && Powerups.BY_ID[id];
        var isNew = def && p.state.reveal && p.state.reveal.slot === i;
        // The tip lives on a wrapper, so it still shows over a slot that is disabled (e.g. once you've holed out).
        return html`<div key=${i + (id || '')} class="slot-wrap">
          <button type="button" class=${'slot' + (def ? ' full' : '') + (isNew ? ' reveal' : '')} style=${def ? { '--pw': PC.POWER_COLORS[id] } : null}
            disabled=${!def || me.finished} aria-label=${def ? 'Use ' + def.name + ' (key ' + (i + 1) + '): ' + def.desc : 'Empty power-up slot'}
            onClick=${function () { PC.audio.unlock(); A.usePower(i); }}>
            ${def ? html`<${Icon} power=${id} cls="pwi" /><span class="sl-name">${def.name}</span><span class="sl-kind">${def.kind}</span>` : html`<span class="sl-empty">Empty</span>`}
            <kbd>${i + 1}</kbd>
          </button>
          <${PowerTip} def=${def} empty="Empty slot. Roll through a glowing crate to pick up a power-up." />
        </div>`;
      })}
    </div>`;
  }

  /** Hover / focus card explaining a power-up. */
  function PowerTip(p) {
    var def = p.def;
    if (!def) return p.empty ? html`<div class="power-tip" role="tooltip"><p>${p.empty}</p></div>` : null;
    var who = def.target === 'opponent' ? 'Targets an opponent' : 'Helps you';
    return html`<div class="power-tip" role="tooltip" style=${{ '--pw': PC.POWER_COLORS[def.id] }}>
      <b>${def.name}</b><span class="pt-meta">${def.kind} · ${who}</span><p>${def.desc}</p>
    </div>`;
  }

  function Effects(p) {
    var me = p.me;
    if (!me.effects.length) return null;
    return html`<div class="effects" aria-live="polite">
      ${me.effects.map(function (e) {
        var def = Powerups.BY_ID[e.kind], hostile = def.hostile;
        var detail = e.left != null && !(def.effect && def.effect.shots) ? Math.ceil(e.left) + 's' : e.shots ? e.shots + (e.shots === 1 ? ' shot' : ' shots') : e.live ? 'active' : e.left == null ? 'until blocked' : Math.ceil(e.left) + 's';
        var label = e.kind === 'reverse' ? 'Aim reversed!' : e.kind === 'freeze' ? 'Frozen!' : e.kind === 'confetti' ? 'Confetti!' : def.name;
        return html`<div key=${e.kind} class=${'effect' + (hostile ? ' hostile' : '')} style=${{ '--pw': PC.POWER_COLORS[e.kind] }} tabindex="0">
          <${Icon} power=${e.kind} cls="pwi" /><span><b>${label}</b><small>${detail}</small></span>
          <${PowerTip} def=${def} /></div>`;
      })}
    </div>`;
  }

  function TargetPicker(p) {
    var v = p.view, A = p.actions, pick = p.pick, def = Powerups.BY_ID[pick.power];
    var opts = v.players.filter(function (q) { return q.id !== v.you && !q.finished && (q.connected || q.bot); });
    return html`<div class="modal-back" onClick=${function (e) { if (e.target === e.currentTarget) A.ui({ pick: null }); }}>
      <div class="modal picker" role="dialog" aria-label=${'Choose a target for ' + def.name}>
        <h2><${Icon} power=${def.id} cls="pwi big" style=${{ color: PC.POWER_COLORS[def.id] }} />${def.name}</h2>
        <p>${def.desc}</p>
        <div class="targets">
          ${opts.length ? opts.map(function (q) {
            var shield = q.effects.some(function (e) { return e.kind === 'shield'; });
            return html`<${Btn} key=${q.id} kind="secondary" onClick=${function () { A.usePower(pick.slot, q.id); }}>
              <${Avatar} color=${q.color} size="sm" /> ${q.name} ${shield ? html`<span class="pill">Bubble Guard</span>` : null}</${Btn}>`;
          }) : html`<p class="note">Nobody to target right now.</p>`}
        </div>
        <${Btn} kind="link" onClick=${function () { A.ui({ pick: null }); }}>Cancel</${Btn}>
      </div>
    </div>`;
  }

  function HoleBanner(p) {
    var info = holeInfo(p.view); if (!info) return null;
    return html`<div class=${'hole-banner theme-' + info.course.theme}>
      <span class="hb-course">${info.name} · Hole ${p.view.hole.index + 1} of 6</span>
      <span class="hb-name">${info.hole.name}</span>
      <span class="hb-par">Par ${info.hole.par}</span>
      <span class="hb-tip">${info.hole.tip}</span>
    </div>`;
  }

  function Hud(p) {
    var v = p.view, s = p.state, A = p.actions, me = v.players.find(function (q) { return q.id === v.you; });
    var info = holeInfo(v);
    if (!me || !info) return null;
    var par = info.hole.par, rel = me.strokes - par;
    return html`<div class="hud">
      <div class="hud-top">
        <div class="hole-chip" aria-label=${'Hole ' + (v.hole.index + 1) + ', ' + info.hole.name + ', par ' + par}>
          <span class="hc-num">${v.hole.index + 1}</span>
          <span class="hc-text"><b>${info.hole.name}</b><small>${info.name} · Par ${par}</small></span>
          <span class="dots" aria-hidden="true">${info.course.holes.map(function (_h, i) { return html`<i key=${i} class=${i < v.hole.index ? 'done' : i === v.hole.index ? 'now' : ''}></i>`; })}</span>
        </div>
        <div class="hud-mid">
          ${v.phase === 'play' ? html`<${Timer} left=${v.timeLeft} />` : null}
          ${v.hurry ? html`<span class="hurry">Last ball!</span>` : null}
          ${v.course.count > 1 ? html`<span class="course-n">Course ${v.course.index + 1}/${v.course.count}</span>` : null}
        </div>
        <div class="hud-btns">
          <${Btn} kind="icon" icon="camera" title="Overview (O)" label="Toggle overview camera" onClick=${A.toggleOverview} />
          <${Btn} kind="icon" icon="list" title="Scorecard (Tab)" label="Scorecard" onClick=${function () { A.ui({ modal: s.modal === 'scores' ? null : 'scores' }); }} />
          <${Btn} kind="icon" icon="help" title="How to play (H)" label="How to play" onClick=${function () { A.ui({ modal: 'help' }); }} />
          <${Btn} kind="icon" icon="gear" title="Settings" label="Settings" onClick=${function () { A.ui({ modal: 'settings' }); }} />
        </div>
      </div>
      <button type="button" class="strip-toggle" aria-expanded=${!!s.stripOpen} onClick=${function () { A.ui({ stripOpen: !s.stripOpen }); }}><${Icon} name="users" /></button>
      <${PlayerStrip} view=${v} open=${s.stripOpen} />
      <div class="feed" aria-live="polite">${s.feed.map(function (f) { return html`<div key=${f.id} class=${'feed-item ' + (f.kind || '')}>${f.html ? html`<span dangerouslySetInnerHTML=${{ __html: f.html }}></span>` : f.text}</div>`; })}</div>
      ${s.celebrate ? html`<div key=${s.celebrate.id} class=${'celebrate ' + s.celebrate.kind}><span>${s.celebrate.text}</span>${s.celebrate.sub ? html`<small>${s.celebrate.sub}</small>` : null}</div>` : null}
      ${me.effects.some(function (e) { return e.kind === 'reverse'; }) ? html`<div class="warn-banner"><${Icon} power="reverse" />Controls reversed: your shot goes the way you pull</div>` : null}
      <div class="hud-bottom">
        <${Effects} me=${me} />
        <div class="stroke-box" aria-live="polite">
          ${me.finished
            ? html`<span class="stroke-main">${me.status === 'holed' ? PC.relName(me.strokes, par) : 'Out'}</span><small>${me.strokes} ${me.strokes === 1 ? 'stroke' : 'strokes'} · ${v.players.some(function (q) { return !q.finished; }) ? 'watching the others' : 'hole complete'}</small>`
            : html`<span class="stroke-main">Stroke ${me.strokes + 1}</span><small>${me.strokes} taken · par ${par} · limit ${v.settings.maxStrokes}</small>`}
          ${!me.finished && v.phase === 'play' && me.shotOnce ? html`<button type="button" class="reset-btn" onClick=${A.resetBall} title=${'Back to the tee (+' + v.settings.resetPenalty + ')'}><${Icon} name="reset" />Reset${v.settings.resetPenalty ? ' +' + v.settings.resetPenalty : ''}</button>` : null}
        </div>
        <${Inventory} me=${me} view=${v} state=${s} actions=${A} />
      </div>
      ${s.aiming && PC.isTouch() ? html`<button type="button" class="cancel-aim" onClick=${A.cancelAim}>Cancel shot</button>` : null}
      ${v.phase === 'intro' ? html`<${HoleBanner} view=${v} />` : null}
      ${s.showTutorial && v.phase === 'play' && !me.finished ? html`<${Tutorial} actions=${A} touch=${PC.isTouch()} />` : null}
    </div>`;
  }

  function Tutorial(p) {
    var _s = useState(0), step = _s[0], setStep = _s[1];
    var steps = [
      ['Aim', (p.touch ? 'Put your finger on your ball' : 'Click on your ball') + ' and pull back, like a slingshot. The arrow shows the direction and strength.'],
      ['Putt', 'Drag farther for more power, then let go. Drag back onto the ball (or press Esc) to cancel.'],
      ['Power-ups', 'Roll through a glowing crate to grab a power-up, then tap its slot (or press 1 or 2) to use it.'],
      ['Camera', p.touch ? 'Drag away from your ball (or use two fingers) to turn the camera, pinch to zoom. Everyone plays at the same time!' : 'Drag away from your ball, right-drag or Q/E to turn the camera, scroll to zoom. Everyone plays at the same time!']
    ];
    var cur = steps[step];
    return html`<div class="tutorial" role="dialog" aria-label="Quick tutorial">
      <span class="tut-step">${step + 1} / ${steps.length}</span><b>${cur[0]}</b><p>${cur[1]}</p>
      <div class="tut-btns"><${Btn} kind="link small" onClick=${p.actions.endTutorial}>Skip</${Btn}>
      <${Btn} kind="primary small" onClick=${function () { if (step + 1 < steps.length) setStep(step + 1); else p.actions.endTutorial(); }}>${step + 1 < steps.length ? 'Next' : 'Got it'}</${Btn}></div>
    </div>`;
  }

  // ------------------------------------------------------------------ scorecard and results

  function Scorecard(p) {
    var v = p.view, info = holeInfo(v);
    if (!info) return null;
    var holes = info.course.holes;
    var byId = {}; v.players.forEach(function (q) { byId[q.id] = q; });
    return html`<div class="scorecard-wrap"><table class="scorecard">
      <thead><tr><th scope="col">Player</th>${holes.map(function (h, i) { return html`<th key=${i} scope="col" class=${i === v.hole.index ? 'now' : ''}>${i + 1}</th>`; })}<th scope="col">Course</th>${v.course.count > 1 ? html`<th scope="col">Total</th>` : null}</tr>
      <tr class="par"><th scope="row">Par</th>${holes.map(function (h, i) { return html`<td key=${i}>${h.par}</td>`; })}<td>${holes.reduce(function (s, h) { return s + h.par; }, 0)}</td>${v.course.count > 1 ? html`<td></td>` : null}</tr></thead>
      <tbody>${v.standings.map(function (r) {
        var q = byId[r.id]; if (!q) return null;
        return html`<tr key=${r.id} class=${r.id === v.you ? 'me' : ''}><th scope="row"><span class="rank">${r.rank}</span><${Avatar} color=${q.color} size="sm" /> ${q.name}</th>
          ${holes.map(function (h, i) { var c = r.holes[i]; return html`<td key=${i} class=${c ? 'sc ' + scoreClass(c) : ''} title=${c ? PC.relName(c.score, c.par) + (c.status !== 'holed' ? ' (' + c.status + ')' : '') : ''}>${c ? c.score : i === v.hole.index && !q.finished && v.phase === 'play' ? html`<small>${q.strokes}</small>` : ''}</td>`; })}
          <td class="tot">${r.course}<small class=${relClass(r.courseRel)}>${PC.relText(r.courseRel)}</small></td>
          ${v.course.count > 1 ? html`<td class="tot">${r.total}<small class=${relClass(r.rel)}>${PC.relText(r.rel)}</small></td>` : null}</tr>`;
      })}</tbody>
    </table></div>`;
  }
  function scoreClass(c) {
    if (c.status !== 'holed') return 'bad';
    var d = c.score - c.par;
    return c.score === 1 ? 'ace' : d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : d === 1 ? 'bogey' : 'bad';
  }

  function HoleResults(p) {
    var v = p.view, info = holeInfo(v), A = p.actions;
    var me = v.players.find(function (q) { return q.id === v.you; }) || {};
    var idx = v.hole.index;
    var rows = v.standings.map(function (r) { return { r: r, c: r.holes[idx], p: v.players.find(function (q) { return q.id === r.id; }) }; }).filter(function (x) { return x.p; });
    rows.sort(function (a, b) { return (a.c ? a.c.score : 99) - (b.c ? b.c.score : 99); });
    return html`<div class="results-panel" role="dialog" aria-label="Hole results">
      <h2>Hole ${idx + 1} · ${info.hole.name}</h2>
      <ul class="hole-results">${rows.map(function (x, i) {
        var c = x.c;
        return html`<li key=${x.r.id} class=${(x.r.id === v.you ? 'me ' : '') + (c ? scoreClass(c) : '')} style=${{ animationDelay: (i * 0.08) + 's' }}>
          <${Avatar} color=${x.p.color} size="sm" /><span class="hr-name">${x.p.name}</span>
          <span class="hr-label">${c ? (c.status === 'holed' ? PC.relName(c.score, c.par) : c.status === 'maxed' ? 'Stroke limit' : c.status === 'timeout' ? 'Out of time' : 'Did not finish') : ''}</span>
          <span class="hr-score">${c ? c.score : '–'}</span>
          <span class=${'hr-total ' + relClass(x.r.rel)}>${PC.relText(x.r.rel)}</span>
        </li>`;
      })}</ul>
      <div class="rp-foot"><${Timer} left=${v.timeLeft} />${me.isHost ? html`<${Btn} kind="primary small" icon="play" onClick=${function () { A.send({ type: 'next' }); }}>Next hole</${Btn}>` : html`<span class="hint">Next hole soon…</span>`}</div>
    </div>`;
  }

  function CourseResults(p) {
    var v = p.view, A = p.actions, me = v.players.find(function (q) { return q.id === v.you; }) || {};
    var c = Courses.byId(v.course.id);
    var next = v.course.order[v.course.index + 1];
    return html`<div class="results-panel wide" role="dialog" aria-label="Course results">
      <h2>${c.name}${v.course.mirror ? ' (Mirrored)' : ''} complete</h2>
      <p class="sub">Tournament standings after ${v.course.index + 1} of ${v.course.count} courses</p>
      <${Standings} view=${v} />
      <div class="rp-foot"><span class="hint">Next: ${Courses.byId(next.id).name}${next.mirror ? ' (Mirrored)' : ''}</span><${Timer} left=${v.timeLeft} />
        ${me.isHost ? html`<${Btn} kind="primary small" icon="play" onClick=${function () { A.send({ type: 'next' }); }}>Continue</${Btn}>` : null}</div>
    </div>`;
  }

  function Standings(p) {
    var v = p.view;
    return html`<ol class="standings">${v.standings.map(function (r, i) {
      var q = v.players.find(function (x) { return x.id === r.id; }); if (!q) return null;
      return html`<li key=${r.id} class=${(r.id === v.you ? 'me ' : '') + 'rank-' + r.rank} style=${{ animationDelay: (i * 0.07) + 's' }}>
        <span class="rank">${r.rank}</span><${Avatar} color=${q.color} size="sm" /><span class="st-name">${q.name}</span>
        <span class="st-total">${r.total}</span><span class=${'st-rel ' + relClass(r.rel)}>${PC.relText(r.rel)}</span></li>`;
    })}</ol>`;
  }

  function Final(p) {
    var v = p.view, A = p.actions, me = v.players.find(function (q) { return q.id === v.you; }) || {};
    var byId = {}; v.players.forEach(function (q) { byId[q.id] = q; });
    var podium = v.standings.slice(0, 3);
    var votes = {}; Object.keys(v.votes || {}).forEach(function (id) { var c = v.votes[id]; votes[c] = (votes[c] || 0) + 1; });
    var mine = v.votes && v.votes[v.you];
    var winner = podium[0] && byId[podium[0].id];
    return html`<div class="screen final">
      <div class="final-inner">
        <h2 class="final-title">${v.settings.mode === 'tournament' ? 'Tournament results' : Courses.byId(v.course.id).name + ' results'}</h2>
        ${winner ? html`<p class="final-winner">${winner.id === v.you ? 'You win!' : winner.name + ' wins!'}</p>` : null}
        <div class="podium">${[1, 0, 2].map(function (i) {
          var r = podium[i]; if (!r) return html`<div key=${i} class="step empty"></div>`;
          var q = byId[r.id];
          return html`<div key=${i} class=${'step place-' + r.rank}><${Avatar} color=${q.color} size="lg" /><b>${q.name}</b><span>${r.total} · ${PC.relText(r.rel)}</span><div class="block">${r.rank}</div></div>`;
        })}</div>
        <div class="final-grid">
          <section class="card"><h3>Final rankings</h3><${Standings} view=${v} /></section>
          <section class="card awards"><h3>Awards</h3>
            <ul>${(v.awards || []).map(function (a) { var q = byId[a.player]; return q ? html`<li key=${a.id}><${Icon} name=${a.id === 'winner' ? 'trophy' : 'star'} /><span><b>${a.title}</b><small>${q.name} · ${a.desc}</small></span></li>` : null; })}</ul>
          </section>
        </div>
        ${v.settings.mode === 'casual' ? html`<section class="card vote"><h3>Vote for the next course</h3>
          <div class="courses">${Courses.COURSES.map(function (c) {
            return html`<button type="button" key=${c.id} class=${'course-card theme-' + c.theme + (mine === c.id ? ' on' : '')} aria-pressed=${mine === c.id} onClick=${function () { A.send({ type: 'vote', course: c.id }); }}>
              <span class="course-art" aria-hidden="true"></span><b>${c.name}</b><small>${votes[c.id] ? votes[c.id] + (votes[c.id] === 1 ? ' vote' : ' votes') : 'No votes yet'}</small></button>`;
          })}</div></section>` : null}
        <div class="final-foot">
          <${Btn} kind="link" icon="back" onClick=${A.leave}>Leave room</${Btn}>
          ${me.isHost ? html`<${Btn} kind="secondary" onClick=${function () { A.send({ type: 'lobby' }); }}>Back to lobby</${Btn}>
            <${Btn} kind="primary big" icon="play" onClick=${function () { A.send({ type: 'next' }); }}>${v.settings.mode === 'casual' ? 'Play the winning course' : 'Rematch'}</${Btn}>` : html`<span class="hint">The host picks what happens next.</span>`}
        </div>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------------ modals

  function Help(p) {
    var touch = PC.isTouch();
    return html`<div class="help">
      <h3>How to play</h3>
      <ol class="steps">
        <li><b>Aim:</b> when it's your shot, ${touch ? 'press on (or near) your ball' : 'click on (or near) your ball'} and pull back. The ball goes the opposite way, like a slingshot.</li>
        <li><b>Power:</b> the farther you pull, the harder the putt (half a pull is half power). The arrow grows and warms from teal to coral as you pull harder.</li>
        <li><b>Putt:</b> let go. Drag back onto the ball${touch ? ', tap Cancel shot' : ' or press Esc'} to cancel.</li>
        <li><b>Everyone plays at once.</b> Fewest strokes wins. Water or falling off costs a stroke and puts you back where you were.</li>
        <li><b>Stroke limit:</b> after the limit you score limit + 1. Out of time scores your strokes + 2. <b>Reset</b> sends you to the tee for a penalty.</li>
        <li><b>Camera:</b> ${touch ? 'two fingers turn it, pinch zooms' : 'right-drag or Q/E turns it, scroll or Z zooms'}; the camera button shows the whole hole. A drag that starts away from your ball always turns the camera.</li>
        ${touch ? null : html`<li><b>Keyboard:</b> ←/→ aim, ↑/↓ power, Space putts; O overview; Tab scorecard; 1/2 use power-ups.</li>`}
      </ol>
      <h3>Power-ups</h3>
      <p class="note">Roll through a crate to grab one (you can hold two). Hostile ones target an opponent; Bubble Guard blocks the next one aimed at you.</p>
      <ul class="pw-list">${Powerups.catalog().map(function (d) {
        return html`<li key=${d.id} style=${{ '--pw': PC.POWER_COLORS[d.id] }}><${Icon} power=${d.id} cls="pwi" /><span><b>${d.name}</b> <small class=${'rar ' + d.rarity}>${d.kind} · ${d.rarity}${d.hostile ? ' · hostile' : ''}</small><br />${d.desc}</span></li>`;
      })}</ul>
    </div>`;
  }

  function SettingsPanel(p) {
    var a = PC.audio.settings;
    var _r = useState(0), rerender = _r[1];
    function setVol(k, v) { PC.audio.set(k, v); rerender(Math.random()); }
    function setPref(k, v) { PC.store.set(k, v); rerender(Math.random()); p.actions.prefsChanged(); }
    return html`<div class="settings-panel">
      <h3>Sound</h3>
      <label class="row">Music <input type="range" min="0" max="1" step="0.05" value=${a.music} onInput=${function (e) { setVol('music', Number(e.target.value)); }} /></label>
      <label class="row">Effects <input type="range" min="0" max="1" step="0.05" value=${a.sfx} onInput=${function (e) { setVol('sfx', Number(e.target.value)); PC.audio.play('click'); }} /></label>
      <label class="row toggle"><input type="checkbox" checked=${a.mute} onChange=${function (e) { setVol('mute', e.target.checked); }} /> Mute everything</label>
      <h3>Display</h3>
      <label class="row">Graphics
        <select value=${PC.store.get('quality', 'auto')} onChange=${function (e) { setPref('quality', e.target.value); }}><option value="auto">Auto</option><option value="high">High</option><option value="low">Battery saver</option></select></label>
      <label class="row toggle"><input type="checkbox" checked=${PC.reducedMotion()} onChange=${function (e) { setPref('reducedMotion', e.target.checked); }} /> Reduce motion</label>
      <label class="row">Camera speed <input type="range" min="0.4" max="2" step="0.1" value=${PC.store.get('camSens', 1)} onInput=${function (e) { setPref('camSens', Number(e.target.value)); }} /></label>
      <p class="note">Graphics changes apply the next time the page loads.</p>
      ${p.inGame ? html`<div class="row"><${Btn} kind="danger small" icon="back" onClick=${p.actions.leave}>Leave room</${Btn}></div>` : null}
    </div>`;
  }

  function Modal(p) {
    useEffect(function () {
      function onKey(e) { if (e.key === 'Escape') p.onClose(); }
      global.addEventListener('keydown', onKey);
      return function () { global.removeEventListener('keydown', onKey); };
    }, []);
    return html`<div class="modal-back" onClick=${function (e) { if (e.target === e.currentTarget) p.onClose(); }}>
      <div class=${'modal ' + (p.cls || '')} role="dialog" aria-modal="true" aria-label=${p.title}>
        <button type="button" class="modal-x" aria-label="Close" onClick=${p.onClose}><${Icon} name="close" /></button>
        ${p.children}
      </div></div>`;
  }

  // ------------------------------------------------------------------ app

  function App(p) {
    var store = p.store, A = p.actions;
    var _s = useState(store.get()), s = _s[0], setS = _s[1];
    useEffect(function () { return store.subscribe(function () { setS(store.get()); }); }, []);
    var v = s.view, inRoom = !!v;
    var screen;
    if (!inRoom) screen = html`<${Menu} state=${s} actions=${A} />`;
    else if (v.phase === 'lobby') screen = html`<${Lobby} view=${v} state=${s} actions=${A} />`;
    else if (v.phase === 'final') screen = html`<${Final} view=${v} actions=${A} />`;
    else screen = html`<${React.Fragment}>
      <${Hud} view=${v} state=${s} actions=${A} />
      ${v.phase === 'holeResults' ? html`<${HoleResults} view=${v} actions=${A} />` : null}
      ${v.phase === 'courseResults' ? html`<${CourseResults} view=${v} actions=${A} />` : null}
    </${React.Fragment}>`;
    return html`<${React.Fragment}>
      ${screen}
      ${s.pick && v ? html`<${TargetPicker} view=${v} pick=${s.pick} actions=${A} />` : null}
      ${s.modal === 'help' ? html`<${Modal} title="How to play" cls="wide" onClose=${function () { A.ui({ modal: null }); }}><${Help} /></${Modal}>` : null}
      ${s.modal === 'settings' ? html`<${Modal} title="Settings" onClose=${function () { A.ui({ modal: null }); }}><${SettingsPanel} actions=${A} inGame=${inRoom} /></${Modal}>` : null}
      ${s.modal === 'scores' && v && v.course ? html`<${Modal} title="Scorecard" cls="wide" onClose=${function () { A.ui({ modal: null }); }}><h3>Scorecard</h3><${Scorecard} view=${v} /></${Modal}>` : null}
      ${s.conn === 'down' && inRoom ? html`<div class="conn-banner" role="status"><${Icon} name="offline" /> Connection lost. Reconnecting… your seat and score are kept.</div>` : null}
      <div class="toasts" aria-live="assertive">${s.toasts.map(function (t) { return html`<div key=${t.id} class=${'toast ' + (t.kind || '')}>${t.text}</div>`; })}</div>
      ${s.busy ? html`<div class="busy" role="status"><span class="spinner"></span>${s.busy}</div>` : null}
    </${React.Fragment}>`;
  }

  PC.ui = {
    mount: function (el, store, actions) { ReactDOM.createRoot(el).render(html`<${App} store=${store} actions=${actions} />`); }
  };
})(window);
