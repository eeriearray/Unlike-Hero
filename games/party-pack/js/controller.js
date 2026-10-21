/* The phone controller (players) and the Megaphone (audience). It renders whatever view the
   Main Stage sends, keeps drafts when a view is re-sent, buzzes when time runs low, and offers a
   reaction wheel during downtime. It never decides anything about the game. */
(function () {
  'use strict';
  const PP = window.PP; const { $, esc } = PP;
  const C = { token: PP.tabToken(), room: null, code: '', role: 'player', view: null, assets: {}, drafts: {}, timers: [], mounted: null, lastMsg: 0 };
  const prefs = Object.assign({ textScale: 1, highContrast: false, haptics: true, reduceMotion: false, colorBlind: 'none' }, PP.prefs.get('phone', {}));
  PP.applyA11y(prefs);
  const root = () => $('#phone');

  // ------------------------------------------------------------ join
  function joinScreen(msg) {
    const qs = new URLSearchParams(location.search);
    const code = (qs.get('code') || PP.prefs.get('lastCode', '') || '').toUpperCase();
    const name = PP.prefs.get('name', '');
    let avatar = PP.prefs.get('avatar', PP.pick(PP.CONTENT.avatars)); if (!PP.CONTENT.avatars.includes(avatar)) avatar = PP.pick(PP.CONTENT.avatars);
    const wantAud = C.role === 'audience';
    root().innerHTML = `<form class="join-form" autocomplete="off">
      <h1 class="logo small">PARTY PACK</h1>
      ${msg ? `<p class="error">${esc(msg)}</p>` : ''}
      <label>Room code<input name="code" maxlength="4" value="${esc(code)}" placeholder="ABCD" required inputmode="latin" autocapitalize="characters" spellcheck="false"></label>
      <label>Your name<input name="name" maxlength="12" value="${esc(name)}" placeholder="Name" ${wantAud ? '' : 'required'}></label>
      <label>Pick your character</label>
      <div class="avatars" role="radiogroup" aria-label="Pick a character">${PP.CONTENT.avatars.map(a => `<button type="button" class="${a === avatar ? 'on' : ''}" data-av="${a}" aria-label="Character ${Number(a) + 1}">${PP.Art.face(a, PP.playerColor(Number(a), 'default'))}</button>`).join('')}</div>
      <button class="btn primary big" name="as" value="${wantAud ? 'audience' : 'player'}">${wantAud ? 'Join the audience' : 'Play'}</button>
      <button class="btn ghost" type="button" id="switch-role">${wantAud ? 'I want to play instead' : 'Just watch (audience)'}</button>
      <p class="muted tiny">Up to 8 players per room; anyone after that joins the audience and votes.</p>
    </form>`;
    let av = avatar;
    root().querySelectorAll('[data-av]').forEach(b => b.onclick = () => { av = b.dataset.av; root().querySelectorAll('[data-av]').forEach(x => x.classList.toggle('on', x === b)); });
    $('#switch-role').onclick = () => { C.role = wantAud ? 'player' : 'audience'; joinScreen(); };
    root().querySelector('form').onsubmit = e => {
      e.preventDefault(); const f = new FormData(e.target);
      const c = String(f.get('code')).trim().toUpperCase(); if (!/^[A-Z0-9]{4}$/.test(c)) return;
      C.name = String(f.get('name') || '').trim().slice(0, 12) || (C.role === 'audience' ? 'Audience' : 'Player');
      PP.prefs.set('name', C.name); PP.prefs.set('lastCode', c); PP.prefs.set('avatar', av); C.avatar = av;
      connect(c);
    };
  }
  function connect(code) {
    if (C.room) C.room.leave();
    C.code = code; C.room = PP.connect(code, s => { C.status = s; if (s === 'connected') sendJoin(); renderStatus(); });
    if (!C.room) { joinScreen('Multiplayer needs the hub SDK. Open this from the Party Pack folder.'); return; }
    C.room.on('view', d => { if (d && d.to === C.token) { C.lastMsg = Date.now(); C.role = 'player'; show(d.v); } });
    C.room.on('aud', d => { if (d && d.to === C.token) { C.lastMsg = Date.now(); C.role = 'audience'; show(d.v); } });
    C.room.on('asset', d => { if (d && d.to === C.token) { C.assets[d.id] = d.data; PP.$$('[data-asset="' + d.id + '"]').forEach(paintAsset); } });
    C.room.on('bye', d => { if (d && d.to === C.token) { C.room.leave(); C.room = null; joinScreen(d.reason || 'You left the room.'); } });
    C.room.on('ack', d => { if (d && d.to === C.token) C.lastMsg = Date.now(); });
    C.room.on('who', d => { if (d && d.to === C.token) sendJoin(); });
    C.room.on('host-up', sendJoin);
    sendJoin();
    root().innerHTML = '<div class="center pad"><div class="spinner"></div><p>Looking for room ' + esc(code) + '…</p><p class="muted tiny">The Main Stage has to be open on the TV or computer.</p></div>';
    clearInterval(C.hb); C.hb = setInterval(() => { C.room && C.room.emit('hb', { token: C.token }); if (Date.now() - C.lastMsg > 6000) sendJoin(); }, 3000);
    setTimeout(() => { if (!C.lastMsg && C.room) joinScreen(`No room ${code} answered. Check the code on the big screen.`); }, 9000);
  }
  function sendJoin() { if (C.room) C.room.emit('join', { token: C.token, name: C.name, avatar: C.avatar, role: C.role }); }
  function send(data, kind) { if (!C.room || !C.view) return; C.room.emit('in', { token: C.token, req: C.view.req, kind, data }); }
  function sendKind(kind, extra) { if (C.room) C.room.emit('in', Object.assign({ token: C.token, kind }, extra || {})); }
  function renderStatus() { const s = $('#net'); if (s) s.textContent = C.status === 'disconnected' ? 'Reconnecting…' : ''; }

  // ------------------------------------------------------------ view switching
  function show(v) {
    const sig = JSON.stringify(v);
    if (sig === C.lastSig && C.mounted) return;                 // identical re-send: keep the screen (and focus) as is
    C.lastSig = sig;
    const same = C.view && v.req && C.view.req === v.req && C.view.type === v.type;
    C.view = v;
    if (v.me) applyHeader(v.me);
    applyTheme((v.me && v.me.theme) || v.theme || 'lobby');
    armTimer(v);
    if (same && C.mounted && C.mounted.update) { C.mounted.update(v); return; }
    const R = RENDER[v.type] || RENDER.wait;
    const body = document.createElement('div'); body.className = 'view v-' + v.type;
    root().innerHTML = ''; root().appendChild(header(v)); root().appendChild(body);
    C.mounted = R(body, v) || {};
    if (v.error) showError(body, v.error);
    if (v.react && C.role) body.appendChild(reactionWheel());
  }
  function header(v) {
    const h = document.createElement('header'); h.className = 'phone-top';
    const m = v.me || {};
    h.innerHTML = C.role === 'audience'
      ? `<span class="av">${PP.Art.face(C.avatar || '0', '#cfd6ff')}</span><b>Audience · ${esc(v.code || C.code)}</b><span id="net" class="warn"></span><button class="gear" aria-label="Settings">⚙</button>`
      : `<span class="av">${PP.Art.face(m.avatar || '0', m.color || '#ccc')}</span><b>${esc(m.name || '')}${m.vip ? PP.Art.crown : ''}${m.mod ? PP.Art.shield : ''}</b><span class="score">${(m.score || 0).toLocaleString()}</span><span id="net" class="warn"></span><button class="gear" aria-label="Settings">⚙</button>`;
    h.querySelector('.gear').onclick = openPrefs;
    const bar = document.createElement('div'); bar.className = 'tbar'; bar.innerHTML = '<i></i>'; h.appendChild(bar);
    return h;
  }
  function applyHeader(m) { if (m.color) document.documentElement.style.setProperty('--me', m.color); }
  function applyTheme(theme) { if (theme && document.documentElement.dataset.theme !== theme) document.documentElement.dataset.theme = theme; }
  function showError(body, err) { let e = body.querySelector('.error'); if (!e) { e = document.createElement('p'); e.className = 'error'; body.prepend(e); } e.textContent = err; if (prefs.haptics && navigator.vibrate) navigator.vibrate(60); }

  // ------------------------------------------------------------ timer + haptics
  function armTimer(v) {
    C.timers.forEach(clearTimeout); C.timers = []; cancelAnimationFrame(C.raf);
    const bar = () => $('.tbar i');
    if (!v.endsIn) { const b = bar(); if (b) b.parentElement.hidden = true; return; }
    const end = Date.now() + v.endsIn, total = v.endsIn;
    const buzz = p => { if (prefs.haptics && navigator.vibrate) try { navigator.vibrate(p); } catch (e) { /* not allowed yet */ } };
    // Haptic countdown: a nudge at 10 s, a tap every second from 5, a long buzz at zero.
    if (v.endsIn > 10500) C.timers.push(setTimeout(() => buzz([70, 60, 70]), v.endsIn - 10000));
    for (let s = 5; s >= 1; s--) if (v.endsIn > s * 1000) C.timers.push(setTimeout(() => buzz(35), v.endsIn - s * 1000));
    C.timers.push(setTimeout(() => buzz([220, 80, 220]), v.endsIn));
    const frame = () => {
      const b = bar(); if (!b) return; const left = Math.max(0, end - Date.now());
      b.parentElement.hidden = false; b.style.transform = `scaleX(${left / total})`; b.parentElement.classList.toggle('low', left < 5000);
      if (left > 0) C.raf = requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ reaction wheel
  function reactionWheel() {
    const w = document.createElement('div'); w.className = 'wheel';
    w.innerHTML = `<button class="wheel-btn" aria-label="Reactions" aria-expanded="false">😂</button><div class="wheel-ring">
      ${PP.CONTENT.reactions.map((e, i) => `<button data-e="${e}" style="--i:${i}" aria-label="React ${e}">${e}</button>`).join('')}
      </div><div class="sounds">${PP.CONTENT.sounds.map(s => `<button data-s="${s.id}">${esc(s.label)}</button>`).join('')}${C.role === 'audience' ? '<button data-hype="1" class="hype-btn">🔥 HYPE</button>' : ''}</div>`;
    const btn = w.querySelector('.wheel-btn');
    btn.onclick = () => { const open = w.classList.toggle('open'); btn.setAttribute('aria-expanded', open); };
    let last = 0;
    const fire = (payload, el) => { const now = Date.now(); if (now - last < 650) return; last = now; C.room && C.room.emit('react', Object.assign({ token: C.token }, payload)); el.classList.add('fired'); setTimeout(() => el.classList.remove('fired'), 300); if (prefs.haptics && navigator.vibrate) navigator.vibrate(12); };
    w.querySelectorAll('[data-e]').forEach(b => b.onclick = () => fire({ e: b.dataset.e }, b));
    w.querySelectorAll('[data-s]').forEach(b => b.onclick = () => fire({ sound: b.dataset.s }, b));
    w.querySelectorAll('[data-hype]').forEach(b => b.onclick = () => { fire({ e: '🔥' }, b); sendKind('hype'); });
    return w;
  }

  // ------------------------------------------------------------ preferences (per phone)
  function openPrefs() {
    const d = $('#prefs');
    d.innerHTML = `<form method="dialog" class="settings"><h2>Phone settings</h2>
      <label>Text size <select name="textScale">${[[1, '100%'], [1.2, '120%'], [1.4, '140%'], [1.7, '170%']].map(([v, l]) => `<option value="${v}" ${prefs.textScale == v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label><input type="checkbox" name="highContrast" ${prefs.highContrast ? 'checked' : ''}> High contrast</label>
      <label>Colour-blind mode <select name="colorBlind">${[['none', 'Off'], ['protan', 'Protanopia'], ['deutan', 'Deuteranopia'], ['tritan', 'Tritanopia'], ['mono', 'Monochrome']].map(([v, l]) => `<option value="${v}" ${prefs.colorBlind === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label><input type="checkbox" name="haptics" ${prefs.haptics ? 'checked' : ''}> Vibrate when time is running out</label>
      <label><input type="checkbox" name="reduceMotion" ${prefs.reduceMotion ? 'checked' : ''}> Reduce motion</label>
      <div class="row"><button class="btn primary" value="ok">Done</button><button class="btn ghost" value="leave" id="leave">Leave room</button></div></form>`;
    d.showModal();
    d.querySelector('form').onsubmit = e => {
      const f = new FormData(d.querySelector('form'));
      prefs.textScale = Number(f.get('textScale')); prefs.colorBlind = f.get('colorBlind');
      ['highContrast', 'haptics', 'reduceMotion'].forEach(k => { prefs[k] = f.has(k); });
      PP.prefs.set('phone', prefs); PP.applyA11y(prefs);
      if (e.submitter && e.submitter.value === 'leave') { if (C.room) C.room.leave(); C.room = null; clearInterval(C.hb); joinScreen(); }
    };
  }

  // ------------------------------------------------------------ helpers for renderers
  const draftKey = (v, i) => v.req + ':' + (i || 0);
  function textBox(v, i, opts) {
    opts = opts || {};
    const wrap = document.createElement('div'); wrap.className = 'textbox';
    const max = v.max || 80;
    wrap.innerHTML = `<textarea maxlength="${max}" rows="${opts.rows || 2}" placeholder="${esc(v.placeholder || 'Type your answer')}" enterkeyhint="send" aria-label="${esc(opts.label || 'Your answer')}"></textarea><span class="count"></span>`;
    const ta = wrap.querySelector('textarea'), count = wrap.querySelector('.count');
    // Guesstimate wants a number pad; Emoji Charades lets through emoji only (letters are stripped as you type).
    if (v.numeric) { ta.setAttribute('inputmode', 'decimal'); ta.rows = 1; }
    if (v.emojiOnly) { ta.classList.add('emoji-input'); ta.addEventListener('input', () => { const kept = PP.emojiOnly(ta.value); if (kept !== ta.value) ta.value = kept; }); }
    ta.value = C.drafts[draftKey(v, i)] || '';
    const upd = () => { C.drafts[draftKey(v, i)] = ta.value; count.textContent = max - ta.value.length; };
    ta.oninput = upd; upd();
    ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); opts.onEnter && opts.onEnter(); } };
    setTimeout(() => { if (!opts.noFocus) ta.focus(); }, 60);
    return { el: wrap, value: () => ta.value.trim(), set: t => { ta.value = t; upd(); } };
  }
  function promptCard(text, sub) { return `<div class="prompt-card">${sub ? `<small>${esc(sub)}</small>` : ''}<p>${esc(text)}</p></div>`; }
  function paintAsset(el) { const d = C.assets[el.dataset.asset]; if (!d) return; const px = Number(el.dataset.px) || 120; el.innerHTML = ''; el.appendChild(PP.Draw.canvasFor(d, px)); }
  function locked(body, title, msg) { body.innerHTML = `<div class="center pad"><div class="big-emoji">✅</div><h2>${esc(title || 'Sent')}</h2><p class="muted">${esc(msg || 'Look at the big screen.')}</p></div>`; }

  // ------------------------------------------------------------ renderers (one per view type)
  const RENDER = {
    wait(body, v) {
      body.innerHTML = `<div class="center pad"><h2>${esc(v.title || 'Look up')}</h2><p class="muted">${esc(v.msg || 'Watch the big screen.')}</p>${v.big ? `<div class="big-emoji">${esc(v.big)}</div>` : ''}</div>`;
    },
    lobby(body, v) {
      const m = v.me || {};
      body.innerHTML = `<div class="pad">
        <h2>You're in${m.renamed ? `, ${esc(m.name)}` : ''}!</h2>
        ${m.renamed ? '<p class="error">Your name was replaced by the profanity filter.</p>' : ''}
        <p class="muted">${v.count} player${v.count === 1 ? '' : 's'} in room ${esc(m.code || '')}.</p>
        ${v.isVip ? `<h3>You're the VIP! Pick a game:</h3>
          <div class="game-list">${v.games.map(g => `<button class="btn game" data-g="${g.key}" style="--a:${g.accent};--gfont:${g.font}"><span class="gl-art">${PP.Art.host(g.key)}</span><span><b>${esc(g.title)}</b><small>${g.min}+ players${v.count < g.min ? ' · bots fill in' : ''}</small></span></button>`).join('')}</div>
          <label class="mod">VIP Moderator <select id="mod"><option value="">Nobody</option>${v.players.filter(p => !p.bot).map(p => `<option value="${esc(p.id)}" ${v.moderator === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
          <p class="muted tiny">The moderator approves every typed answer before it hits the big screen.</p>`
          : '<p>Waiting for the VIP to pick a game. Spam the big screen with reactions while you wait.</p>'}
        </div>`;
      body.querySelectorAll('[data-g]').forEach(b => b.onclick = () => sendKind('pick-game', { game: b.dataset.g, bots: true }));
      const mod = body.querySelector('#mod'); if (mod) mod.onchange = () => sendKind('moderator', { id: mod.value });
      body.appendChild(reactionWheel());
    },
    text(body, v) {
      body.innerHTML = promptCard(v.prompt, v.sub);
      const box = textBox(v, 0, { onEnter: submit, rows: v.rows });
      body.appendChild(box.el);
      const row = document.createElement('div'); row.className = 'row stack';
      row.innerHTML = `<button class="btn primary big" id="send">${esc(v.button || 'Send')}</button>
        ${v.helper ? `<button class="btn ghost" id="helper">${esc(v.helper.label)}</button>` : ''}
        ${v.doubleBluff ? `<label class="db"><input type="checkbox" id="db"> <b>DOUBLE BLUFF</b> — bet all ${v.doubleBluff.points.toLocaleString()} points that this lie fools ${v.doubleBluff.need}+ players. Win: steal points from every victim. Lose: lose everything.</label>` : ''}`;
      body.appendChild(row);
      if (v.helper) row.querySelector('#helper').onclick = () => { box.set(PP.pick(v.helper.options)); C.usedHelper = true; };
      function submit() { const t = box.value(); if (!t) return; const db = row.querySelector('#db'); send({ text: t, helper: !!C.usedHelper, db: db ? db.checked : false }); C.usedHelper = false; }
      row.querySelector('#send').onclick = submit;
      return { update(nv) { if (nv.error) showError(body, nv.error); } };
    },
    // several text prompts answered one after another (Comedy Writer, Chaos Mashup slogans)
    multitext(body, v) {
      const done = new Set(v.done || []);
      const idx = v.prompts.findIndex((_, i) => !done.has(i));
      if (idx < 0) { locked(body, 'All done', 'Waiting for everyone else.'); return; }
      body.innerHTML = `<p class="step">${idx + 1} of ${v.prompts.length}</p>` + promptCard(v.prompts[idx], v.sub);
      const box = textBox(v, idx, { onEnter: submit });
      body.appendChild(box.el);
      const row = document.createElement('div'); row.className = 'row stack';
      row.innerHTML = `<button class="btn primary big" id="send">Send</button>${v.safety ? '<button class="btn ghost" id="safety">Use a safety quip (half points)</button>' : ''}`;
      body.appendChild(row);
      function submit(safety) { const t = safety ? PP.pick(v.safety) : box.value(); if (!t) return; send({ i: idx, text: t, safety: !!safety }); done.add(idx); C.view.done = [...done]; RENDER.multitext(body, C.view); }
      row.querySelector('#send').onclick = () => submit(false);
      if (v.safety) row.querySelector('#safety').onclick = () => submit(true);
      return { update(nv) { nv.done = [...done, ...(nv.done || [])]; } };
    },
    choice(body, v) {
      body.innerHTML = (v.prompt ? promptCard(v.prompt, v.sub) : '') + `<div class="choices ${v.options.length > 4 ? 'many' : ''}"></div>${v.haunt ? '<div class="haunt-panel"></div>' : ''}`;
      const list = body.querySelector('.choices');
      let order = v.options.map((_, i) => i), chosen = null;
      const paint = () => {
        list.innerHTML = order.map(i => { const o = v.options[i]; return `<button class="btn choice ${chosen === i ? 'on' : ''}" data-i="${i}" ${o.disabled ? 'disabled' : ''}>${o.face ? `<span class="av">${PP.Art.face(o.face.id, o.face.color)}</span>` : ''}${o.badge ? `<span class="badge">${esc(o.badge)}</span>` : ''}${o.asset ? `<span class="asset" data-asset="${esc(o.asset)}" data-px="120"></span>` : ''}<span>${esc(o.label)}</span>${o.note ? `<small>${esc(o.note)}</small>` : ''}</button>`; }).join('');
        list.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
          chosen = Number(b.dataset.i); send('haunt' in v ? { choice: chosen } : chosen);   // quiz views always take { choice }
          if (v.haunt) { list.innerHTML = '<p class="locked-note">✅ Answer locked in</p>'; return; }
          if (!v.changeable) locked(body, 'Locked in', v.lockedMsg);
          else paint();
        });
        list.querySelectorAll('[data-asset]').forEach(paintAsset);
      };
      paint();
      if (v.haunt) hauntPanel(body.querySelector('.haunt-panel'), v.haunt);
      const effects = { fog: null, scramble: 0 };
      const apply = fx => {
        if (!fx) return;
        if (fx.fog && !effects.fog) effects.fog = fogLayer(body);
        if (fx.scramble && !effects.scramble) {
          list.classList.add('scrambled');
          effects.scramble = setInterval(() => { if (!document.body.contains(list)) { clearInterval(effects.scramble); return; } order = PP.shuffle(order); paint(); }, 1300);
          setTimeout(() => { clearInterval(effects.scramble); list.classList.remove('scrambled'); }, 9000);
        }
      };
      apply(v.effects);
      return { update(nv) { apply(nv.effects); if (nv.haunt) hauntPanel(body.querySelector('.haunt-panel'), nv.haunt); if (nv.error) showError(body, nv.error); } };
    },
    draw(body, v) {
      const done = new Set(v.done || []); const count = v.count || 1;
      const idx = Array.from({ length: count }, (_, i) => i).find(i => !done.has(i));
      if (idx == null) { locked(body, 'Masterpiece sent', 'Waiting for the other artists.'); return; }
      const prompt = Array.isArray(v.prompt) ? v.prompt[idx] : v.prompt;
      body.innerHTML = `${count > 1 ? `<p class="step">Drawing ${idx + 1} of ${count}</p>` : ''}${promptCard(prompt, v.blind ? 'BLIND CONTOUR: your ink vanishes as you draw' : v.sub || 'Draw')}
        <div class="pad-wrap"><canvas class="pad"></canvas><div class="ink"><i></i></div></div>
        <div class="tools">${v.palette.map((c, i) => `<button class="sw ${i ? '' : 'on'}" data-c="${i}" style="background:${c}" aria-label="Colour ${i + 1}"></button>`).join('')}
        <span class="sep"></span>${PP.Draw.WIDTHS.map((w, i) => `<button class="wd ${i === 1 ? 'on' : ''}" data-w="${i}" aria-label="Brush ${i + 1}"><i style="width:${w + 2}px;height:${w + 2}px"></i></button>`).join('')}</div>
        <p class="muted tiny">No eraser. No undo. Commit.</p>
        <button class="btn primary big" id="send">Submit drawing</button>`;
      const cv = body.querySelector('canvas');
      const pad = PP.Draw.pad(cv, { palette: v.palette, blind: v.blind, onInk: f => { body.querySelector('.ink i').style.width = (f * 100).toFixed(1) + '%'; }, onFull: () => showError(body, 'Out of ink! Submit it.') });
      body.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { pad.setColor(Number(b.dataset.c)); body.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); });
      body.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { pad.setWidth(Number(b.dataset.w)); body.querySelectorAll('[data-w]').forEach(x => x.classList.toggle('on', x === b)); });
      body.querySelector('#send').onclick = () => {
        if (pad.isEmpty()) { showError(body, 'Draw something first. Anything.'); return; }
        send({ i: idx, drawing: pad.data() }); done.add(idx); C.view.done = [...done];
        RENDER.draw(body, C.view);
      };
      // Time's up on the phone: send whatever is on the canvas so the work isn't lost.
      if (v.endsIn) C.timers.push(setTimeout(() => { if (document.body.contains(cv) && !pad.isEmpty()) send({ i: idx, drawing: pad.data(), late: true }); }, Math.max(0, v.endsIn - 400)));
      return { update(nv) { nv.done = [...done]; if (nv.error) showError(body, nv.error); } };
    },
    review(body, v) {
      const rejected = new Set();
      body.innerHTML = `<div class="pad"><h2>🛡 ${esc(v.title)}</h2><p class="muted">Tap anything that shouldn't go on the big screen.</p><div class="review"></div><button class="btn primary big" id="send">Approve the rest</button></div>`;
      const list = body.querySelector('.review');
      list.innerHTML = v.items.map(it => `<button class="btn rv" data-id="${esc(it.id)}"><span>${esc(it.text)}</span><b>OK</b></button>`).join('');
      list.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { const id = b.dataset.id; if (rejected.has(id)) rejected.delete(id); else rejected.add(id); b.classList.toggle('rej', rejected.has(id)); b.querySelector('b').textContent = rejected.has(id) ? 'REMOVE' : 'OK'; });
      body.querySelector('#send').onclick = () => send({ rejected: [...rejected] });
    },
    tap(body, v) {
      let n = 0, started = false, over = false;
      body.innerHTML = `${promptCard(v.prompt, 'Killing Floor')}<button class="btn tapper" id="tap">TAP!<b>0</b></button><p class="muted center">${esc(v.goal || '')}</p>`;
      const btn = body.querySelector('#tap');
      btn.onpointerdown = e => {
        e.preventDefault(); if (over) return;
        if (!started) { started = true; setTimeout(() => { over = true; btn.disabled = true; send({ taps: n }); locked(body, `${n} taps`, 'Pray it was enough.'); }, (v.secs || 8) * 1000); }
        n++; btn.querySelector('b').textContent = n; if (prefs.haptics && navigator.vibrate) navigator.vibrate(8);
      };
      if (v.endsIn) C.timers.push(setTimeout(() => { if (!over) { over = true; send({ taps: n }); } }, v.endsIn - 300));
    },
    math(body, v) {
      const answers = [];
      const step = i => {
        if (i >= v.problems.length) { send({ answers }); locked(body, 'Answers in', 'Fingers crossed.'); return; }
        body.innerHTML = `<p class="step">${i + 1} of ${v.problems.length}</p>${promptCard(v.problems[i], 'Solve it to live')}<div class="numpad"><output>&nbsp;</output>${[1, 2, 3, 4, 5, 6, 7, 8, 9, '−', 0, '⏎'].map(k => `<button class="btn" data-k="${k}">${k}</button>`).join('')}</div>`;
        let val = '';
        const out = body.querySelector('output');
        body.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
          const k = b.dataset.k;
          if (k === '⏎') { if (val === '' || val === '-') return; answers.push(Number(val)); step(i + 1); return; }
          if (k === '−') val = val.startsWith('-') ? val.slice(1) : '-' + val; else if (val.length < 5) val += k;
          out.textContent = val || ' ';
        });
      };
      step(0);
    },
    shirt(body, v) {
      let d = null, s = null, color = v.colors[0], pos = 'below';
      body.innerHTML = `<h2 class="pad-x">Build your shirt</h2>
        <div class="shirt-preview"><div class="tee" style="--tee:${color}"><div class="art"></div><p class="slogan"></p></div></div>
        <h3 class="pad-x">Pick a drawing</h3><div class="pick-row draws">${v.drawings.map(id => `<button class="opt" data-d="${esc(id)}"><span data-asset="${esc(id)}" data-px="90"></span></button>`).join('')}</div>
        <h3 class="pad-x">Pick a slogan</h3><div class="pick-col slogans">${v.slogans.map(sl => `<button class="btn opt" data-s="${esc(sl.id)}">${esc(sl.text)}</button>`).join('')}</div>
        <h3 class="pad-x">Shirt colour</h3><div class="pick-row colors">${v.colors.map(c => `<button class="sw" data-col="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}</div>
        <div class="row pad-x"><label><input type="radio" name="pos" value="above"> Slogan on top</label><label><input type="radio" name="pos" value="below" checked> Slogan below</label></div>
        <button class="btn primary big" id="send" disabled>Print it</button>`;
      body.querySelectorAll('[data-asset]').forEach(paintAsset);
      const prev = body.querySelector('.tee');
      const upd = () => {
        prev.style.setProperty('--tee', color); prev.classList.toggle('above', pos === 'above');
        const art = prev.querySelector('.art'); art.innerHTML = ''; if (d && C.assets[d]) art.appendChild(PP.Draw.canvasFor(C.assets[d], 120, { transparent: true }));
        const sl = v.slogans.find(x => x.id === s); prev.querySelector('.slogan').textContent = sl ? sl.text : '';
        body.querySelector('#send').disabled = !(d && s);
      };
      body.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { d = b.dataset.d; body.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === b)); upd(); });
      body.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { s = b.dataset.s; body.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); upd(); });
      body.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { color = b.dataset.col; upd(); });
      body.querySelectorAll('[name=pos]').forEach(r => r.onchange = () => { pos = r.value; upd(); });
      body.querySelector('#send').onclick = () => send({ d, s, color, pos });
    },
    role(body, v) {
      body.innerHTML = `<div class="pad role-card ${v.imposter ? 'imp' : ''}">
        <p class="muted">Tap and hold to peek. Don't let anyone see.</p>
        <div class="cover" tabindex="0" role="button" aria-label="Hold to reveal your role">
          <div class="hidden-side">🔒 Hold to reveal</div>
          <div class="reveal-side">${v.imposter
            ? '<h2>You are the IMPOSTER</h2><p>Your screen is blank. You have no idea what the product is. Watch the big screen, bluff, and blend in.</p><div class="blank-q">?</div>'
            : `<h2>You are an Executive</h2><p class="muted">The product:</p><h1>${esc(v.product)}</h1><p>${esc(v.line)}</p><p class="muted">One of you is an Imposter who doesn't know this. Find them.</p>`}</div></div>
        <button class="btn primary big" id="ok">Got it</button></div>`;
      const cover = body.querySelector('.cover');
      const on = e => { e.preventDefault(); cover.classList.add('show'); }, off = () => cover.classList.remove('show');
      cover.onpointerdown = on; cover.onpointerup = off; cover.onpointerleave = off; cover.onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') on(e); }; cover.onkeyup = off;
      body.querySelector('#ok').onclick = () => send({ ok: true });
    },
    present(body, v) {
      body.innerHTML = `<div class="pad present ${v.imposter ? 'imp' : ''}">
        <h2>🎤 You're presenting</h2>
        ${v.imposter ? '<p>You are the Imposter. You still don\'t know the product. Read the slide on the big screen and sell it with total confidence.</p><div class="blank-q">?</div>'
          : `<p class="muted">Product</p><h3>${esc(v.product)}</h3><p class="muted">Your slide's headline (written by a colleague):</p><p class="quote">"${esc(v.headline)}"</p><p class="muted tiny">Pitch it out loud. Don't say the product's name: make the Imposter work for it.</p>`}
        <button class="btn primary big" id="done">Done pitching</button></div>`;
      body.querySelector('#done').onclick = () => { send({ done: true }); locked(body, 'Pitch delivered', 'Wait for the board to vote.'); };
    },
    invest(body, v) {
      let n = 0;
      body.innerHTML = `<div class="pad center"><h2>${esc(v.presenter)} is pitching</h2><p class="muted">Like what you hear? Invest. Smell a fraud? Heckle.</p>
        <button class="btn primary big" id="inv">💰 Invest</button><p id="n" class="muted">You've invested 0 times</p>
        <div class="row"><button class="btn" data-h="🤨">🤨 Hmm</button><button class="btn" data-h="🔥">🔥 Love it</button><button class="btn" data-h="🍅">🍅 Boo</button></div></div>`;
      body.querySelector('#inv').onclick = () => { if (n >= 3) return; n++; send({ invest: true }); body.querySelector('#n').textContent = `You've invested ${n} time${n === 1 ? '' : 's'}${n >= 3 ? ' (max)' : ''}`; if (prefs.haptics && navigator.vibrate) navigator.vibrate(15); };
      body.querySelectorAll('[data-h]').forEach(b => b.onclick = () => C.room && C.room.emit('react', { token: C.token, e: b.dataset.h }));
    },
    // ---- audience (Megaphone) ----
    'aud-wait'(body, v) {
      body.innerHTML = `<div class="center pad"><h2>${v.game ? esc(v.game) : 'Audience'}</h2>${v.note ? `<p class="note">${esc(v.note)}</p>` : ''}<p class="muted">${esc(v.msg || 'Sit back. You\'ll vote soon.')}</p><p class="muted tiny">Unanimous audience votes double the points. Mash 🔥 to fill the Hype Meter.</p></div>`;
      body.appendChild(reactionWheel());
    },
    'aud-vote'(body, v) {
      let chosen = null;
      body.innerHTML = `${promptCard(v.prompt || 'Vote!', 'Audience vote')}<div class="choices"></div><p class="muted tiny center">You can change your vote until time runs out.</p>`;
      const list = body.querySelector('.choices');
      const paint = () => { list.innerHTML = v.options.map((o, i) => `<button class="btn choice ${chosen === i ? 'on' : ''}" data-i="${i}"><span class="badge">${i + 1}</span><span>${esc(o)}</span></button>`).join(''); list.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { chosen = Number(b.dataset.i); send(chosen); paint(); }); };
      paint();
      body.appendChild(reactionWheel());
    }
  };

  // Ghosts in The Cutthroat Quiz: pick a living player to fog or scramble, once per question.
  function hauntPanel(el, h) {
    if (!el) return;
    if (h.used) { el.innerHTML = '<p class="muted">👻 Haunt used. Watch them squirm.</p>'; return; }
    el.innerHTML = `<h3>👻 Haunt the living</h3><div class="row wrap">${h.targets.map(t => `<span class="haunt-t"><b>${esc(t.name)}</b><button class="btn" data-t="${esc(t.id)}" data-m="fog">🌫 Fog</button><button class="btn" data-t="${esc(t.id)}" data-m="scramble">🌀 Scramble</button></span>`).join('')}</div>`;
    el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { send({ haunt: b.dataset.t, mode: b.dataset.m }); el.innerHTML = '<p class="muted">👻 Haunt sent.</p>'; });
  }
  // Fog that the living player has to wipe away with a finger.
  function fogLayer(body) {
    const c = document.createElement('canvas'); c.className = 'fog'; body.appendChild(c);
    const r = body.getBoundingClientRect(); c.width = r.width; c.height = Math.max(r.height, 400);
    const g = c.getContext('2d');
    for (let i = 0; i < 260; i++) { const x = Math.random() * c.width, y = Math.random() * c.height, rr = 30 + Math.random() * 70; const grd = g.createRadialGradient(x, y, 0, x, y, rr); grd.addColorStop(0, 'rgba(210,215,225,0.55)'); grd.addColorStop(1, 'rgba(210,215,225,0)'); g.fillStyle = grd; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    g.fillStyle = 'rgba(190,195,205,0.82)'; g.globalCompositeOperation = 'destination-over'; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#556'; g.font = 'bold 20px system-ui'; g.textAlign = 'center'; g.fillText('👻 A ghost fogged your screen. Wipe it!', c.width / 2, 40);
    g.globalCompositeOperation = 'destination-out';
    const wipe = e => { const b = c.getBoundingClientRect(); g.beginPath(); g.arc(e.clientX - b.left, e.clientY - b.top, 34, 0, 6.283); g.fill(); };
    let down = false;
    c.onpointerdown = e => { down = true; c.setPointerCapture(e.pointerId); wipe(e); };
    c.onpointermove = e => { if (down) wipe(e); };
    c.onpointerup = () => { down = false; };
    c.style.touchAction = 'none';
    if (prefs.haptics && navigator.vibrate) navigator.vibrate([30, 40, 30]);
    return c;
  }

  // ------------------------------------------------------------ boot
  PP.Controller = {
    start(role) { C.role = role || 'player'; const qs = new URLSearchParams(location.search); const code = (qs.get('code') || '').toUpperCase(); const name = PP.prefs.get('name', ''); if (code && (name || C.role === 'audience') && qs.has('auto')) { C.name = name || 'Audience'; C.avatar = PP.prefs.get('avatar', '🦊'); connect(code); } else joinScreen(); }
  };
})();
