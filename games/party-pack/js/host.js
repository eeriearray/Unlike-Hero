/* The Main Stage: the authoritative host. It owns the room, the players, the audience, the
   timers and the scores, runs one game at a time, and pushes a "view" to every phone.
   Phones never compute game state; they render the view they were sent and send inputs back.
   Games are async functions that use the ctx API below (see js/games/*.js). */
(function () {
  'use strict';
  const PP = window.PP; const { $, esc, uid, pick, shuffle, clamp } = PP;
  const ABORT = PP.ABORT = { abort: true };
  const MAX_PLAYERS = 8;
  PP.GAMES = PP.GAMES || {};

  const H = PP.Host = {
    code: null, room: null, players: [], audience: new Map(), vip: null, moderator: null,
    views: {}, audView: null, conns: new Map(), ask: null, game: null, runToken: 0, hype: 0, phase: 'LOBBY_WAITING',
    settings: Object.assign({ family: true, moderation: false, timerMult: 1, audience: true, voice: true, captions: true, music: 0.32, textScale: 1, highContrast: false, colorBlind: 'none', reduceMotion: false, ugc: '' }, PP.prefs.get('host', {}))
  };
  const saveSettings = () => PP.prefs.set('host', H.settings);

  // ---------------------------------------------------------------- players
  const paletteMode = () => H.settings.colorBlind !== 'none' ? 'safe' : H.settings.highContrast ? 'contrast' : 'default';
  H.colorOf = p => PP.playerColor(p.seat, paletteMode());
  H.shapeOf = p => PP.SHAPES[p.seat % 8];
  const seated = () => H.players;
  const humans = () => H.players.filter(p => !p.bot);
  const byId = id => H.players.find(p => p.id === id);
  function freeSeat() { for (let i = 0; i < MAX_PLAYERS; i++) if (!H.players.some(p => p.seat === i)) return i; return -1; }

  function cleanName(raw, p) {
    let name = String(raw || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12) || 'Player';
    if (PP.filter.test(name)) {
      const silly = pick(PP.CONTENT.sillyNames);
      setTimeout(() => speak(curKey(), 'profaneName'), 600);
      name = silly; if (p) p.renamed = true;
    }
    if (H.players.some(o => o !== p && o.name.toLowerCase() === name.toLowerCase())) name = name.slice(0, 10) + ' ' + (H.players.length + 1);
    return name;
  }

  function addPlayer(token, name, avatar, bot) {
    const seat = freeSeat(); if (seat < 0) return null;
    const p = { id: token, seat, name: '', avatar: /^\d{1,2}$/.test(String(avatar)) ? String(avatar) : String(seat), score: 0, connected: true, lastSeen: Date.now(), bot: !!bot, afkMisses: 0, afk: false };
    p.name = bot ? name : cleanName(name, p);
    H.players.push(p); H.players.sort((a, b) => a.seat - b.seat);
    if (!bot && !H.vip) H.vip = p.id;
    PP.Audio.sfx('join');
    if (!bot && !H.game) speak('lobby', 'join');
    return p;
  }
  H.addBot = () => {
    const used = new Set(H.players.map(p => p.name));
    const name = PP.CONTENT.botNames.find(n => !used.has(n)) || 'Bot ' + (H.players.length + 1);
    const p = addPlayer('bot_' + uid(6), name, String(Math.floor(Math.random() * 12)), true); if (p) refresh(); return p;
  };
  H.kick = id => {
    const p = byId(id); if (!p) return;
    H.players = H.players.filter(x => x !== p);
    if (!p.bot) sendTo(id, 'bye', { to: id, reason: 'The host removed you from the game.' });
    if (H.vip === id) passVip(); if (H.moderator === id) H.moderator = null;
    refresh();
  };
  function passVip() {
    const next = humans().find(p => p.connected && p.id !== H.vip);
    H.vip = next ? next.id : null;
    if (next) speak(curKey(), 'vipLeft');
  }

  // ---------------------------------------------------------------- network
  H.start = () => {
    let code = null; try { code = sessionStorage.getItem('pp.hostCode'); } catch (e) { /* none */ }
    H.code = code || PP.makeCode(); try { sessionStorage.setItem('pp.hostCode', H.code); } catch (e) { /* none */ }
    restoreState();
    H.room = PP.connect(H.code, s => { H.relay = s; renderTop(); if (s === 'connected') H.room.emit('host-up', {}); });
    if (!H.room) { $('#stage').innerHTML = '<div class="center"><h1>Hub SDK missing</h1><p>Open this game from the Unlike Hero folder.</p></div>'; return; }
    // Remember which connection each phone (tab token) speaks from, so its private screen goes to it alone.
    const via = fn => (d, from) => { if (d && d.token && from && from.id) H.conns.set(String(d.token).slice(0, 40), from.id); fn(d); };
    H.room.on('join', via(onJoin));
    H.room.on('in', via(onInput));
    H.room.on('hb', via(onHeartbeat));
    H.room.on('react', via(onReact));
    setTimeout(() => H.room.emit('host-up', {}), 50);
    setInterval(housekeeping, 1000);
    findLanAddress(); setInterval(() => { if (!H.game) findLanAddress(); }, 10000);   // picks up Wi-Fi joining later
    setInterval(() => { H.hype = Math.max(0, H.hype - 1.5); renderHype(); }, 400);
    // The host character: mouth flaps and the speech bubble (captions) shows while a line plays.
    PP.Voice.onSpeak((hostKey, text) => {
      const el = $('#host'), b = el.querySelector('.bubble');
      const who = hostKey === 'edge' ? 'lobby' : hostKey;     // shared lines belong to the Announcer
      const setArt = k => { if (el.dataset.who !== k) { el.querySelector('.host-art').innerHTML = PP.Art.host(k); el.dataset.who = k; } };
      if (text) {
        setArt(who);
        b.innerHTML = `<b>${esc((PP.HOSTS[who] || PP.HOSTS.lobby).name)}</b>${esc(text)}`;
        b.classList.toggle('on', !!H.settings.captions); el.classList.add('talking');
      } else {
        el.classList.remove('talking');
        setTimeout(() => { if (!el.classList.contains('talking')) { b.classList.remove('on'); setArt(curKey()); } }, 900);   // the game's host steps back in
      }
    });
    applySettings();
    if (PP.UGC) PP.UGC.applyCode(H.settings.ugc);
    PP.Audio.startMusic('lobby');
    speak('lobby', 'intro');
    lobby();
  };

  function onJoin(d) {
    if (!d || !d.token) return;
    const token = String(d.token).slice(0, 40);
    let p = byId(token);
    if (p) { p.connected = true; p.lastSeen = Date.now(); if (d.name && !H.game && d.name !== p.name) p.name = cleanName(d.name, p); sendView(p); refresh(); return; }
    const wantsSeat = d.role !== 'audience';
    if (wantsSeat && !H.game && freeSeat() >= 0) { p = addPlayer(token, d.name, d.avatar); sendView(p); refresh(); return; }
    // full, or a game is already running: join the audience (the Megaphone)
    if (!H.settings.audience) { sendTo(token, 'bye', { to: token, reason: H.game ? 'A game is in progress and the audience is off.' : 'The room is full.' }); return; }
    const isNew = !H.audience.has(token);
    H.audience.set(token, { name: cleanName(d.name || 'Audience', null), lastSeen: Date.now(), wantSeat: wantsSeat, avatar: d.avatar, note: d.role === 'audience' ? '' : (H.game ? 'A game is in progress, so you\'re in the audience. You\'ll get a seat in the next game.' : 'The room is full (8 players), so you\'re in the audience.') });
    if (isNew && H.audience.size === 1) speak('lobby', 'audience');
    sendAudienceTo(token); renderTop();
  }
  function onHeartbeat(d) {
    if (!d || !d.token) return; const p = byId(d.token);
    if (p) { const was = p.connected; p.connected = true; p.lastSeen = Date.now(); sendTo(p.id, 'ack', { to: p.id }); if (!was) { sendView(p); refresh(); } return; }
    const a = H.audience.get(d.token); if (a) { a.lastSeen = Date.now(); sendTo(d.token, 'ack', { to: d.token }); return; }
    sendTo(d.token, 'who', { to: d.token });                                      // host restarted: ask the phone to join again
  }
  function housekeeping() {
    const now = Date.now(); let changed = false;
    H.players.forEach(p => { if (!p.bot && p.connected && now - p.lastSeen > 15000) { p.connected = false; changed = true; if (H.vip === p.id) passVip(); } });
    for (const [t, a] of H.audience) if (now - a.lastSeen > 30000) { H.audience.delete(t); changed = true; }
    if (changed) refresh();
    if (H.ask) tickAsk();
  }

  // ---------------------------------------------------------------- addressed sends
  // Private: with the relay, a message with a connection id reaches only that phone (room.emitTo). The `to`
  // token stays in the payload so phones still ignore anything not meant for them on the same-browser transport.
  function sendTo(token, topic, data) {
    const conn = H.conns.get(token);
    if (conn && H.room.emitTo) H.room.emitTo(conn, topic, data); else H.room.emit(topic, data);
  }

  // ---------------------------------------------------------------- views
  function me(p) {
    return { theme: H.game ? H.game.key : 'lobby', name: p.name, avatar: p.avatar, color: H.colorOf(p), shape: H.shapeOf(p), score: p.score, vip: H.vip === p.id, mod: H.moderator === p.id, code: H.code, game: H.game ? PP.GAMES[H.game.key].title : null, renamed: p.renamed || false };
  }
  function sendView(p) {
    if (!p || p.bot) return;
    const v = H.views[p.id] || lobbyView(p);
    const out = Object.assign({}, v, { me: me(p) });
    if (v.endAt) out.endsIn = Math.max(0, v.endAt - Date.now());
    sendTo(p.id, 'view', { to: p.id, v: out });
  }
  H.setView = (p, v) => { H.views[p.id] = v; sendView(p); };
  H.sendAsset = (p, id, data) => { if (!p.bot) sendTo(p.id, 'asset', { to: p.id, id, data }); };
  function sendAudienceTo(token) {
    const a = H.audience.get(token); const v = Object.assign({ type: 'aud-wait' }, H.audView || {});
    if (v.endAt) v.endsIn = Math.max(0, v.endAt - Date.now());
    v.note = a && a.note; v.game = H.game ? PP.GAMES[H.game.key].title : null; v.code = H.code; v.theme = H.game ? H.game.key : 'lobby';
    sendTo(token, 'aud', { to: token, v });
  }
  function setAudience(v) { H.audView = v; for (const t of H.audience.keys()) sendAudienceTo(t); }

  function lobbyView(p) {
    const isVip = H.vip === p.id;
    return {
      type: 'lobby', isVip,
      games: isVip ? Object.entries(PP.GAMES).map(([k, g]) => ({ key: k, title: g.title, blurb: g.blurb, min: g.min, accent: g.accent, font: g.font })) : null,
      count: H.players.length, players: H.players.map(o => ({ id: o.id, name: o.name, bot: o.bot })),
      moderator: H.moderator, moderation: H.settings.moderation
    };
  }
  const waitView = (title, msg) => ({ type: 'wait', title, msg, react: true });

  // ---------------------------------------------------------------- inputs
  function onInput(d) {
    if (!d || !d.token) return;
    const p = byId(d.token);
    if (!p) { const a = H.audience.get(d.token); if (a) audienceInput(d.token, d); return; }
    p.lastSeen = Date.now();
    // lobby / VIP controls
    if (d.kind === 'pick-game' && H.vip === p.id && !H.game) { H.startGame(d.game, { fillBots: !!d.bots }); return; }
    if (d.kind === 'moderator' && H.vip === p.id) { H.moderator = d.id && byId(d.id) && !byId(d.id).bot ? d.id : null; H.settings.moderation = !!H.moderator; refresh(); return; }
    if (d.kind === 'rename' && !H.game) { p.name = cleanName(d.name, p); refresh(); return; }
    if (d.kind === 'skip' && H.vip === p.id) { H.skip(); return; }
    if (d.kind === 'end' && H.vip === p.id) { H.endGame(); return; }
    if (d.kind === 'mute' && H.vip === p.id) { toggleSetting('voice'); return; }
    const a = H.ask;
    if (!a || d.req !== a.req || !a.to.has(p.id)) return;
    handleAnswer(a, p, d.data);
  }
  function handleAnswer(a, p, data) {
    const spec = a.spec;
    if (spec.clean !== false) data = deepClean(data);
    if (spec.validate) {
      const err = spec.validate(p, data, a.answers);
      if (err) { const v = Object.assign({}, H.views[p.id], { error: err, errorAt: Date.now() }); H.setView(p, v); return; }
    }
    if (spec.live) { spec.live(p, data, a.answers); if (!spec.liveFinal || !spec.liveFinal(p, data, a.answers)) { checkAsk(); return; } }
    if (spec.partial) {
      const done = spec.partial(p, data, a.answers);
      if (!done) { if (spec.partialView) H.setView(p, Object.assign({}, H.views[p.id], spec.partialView(p, a.answers))); return; }
    } else a.answers.set(p.id, data);
    if (!spec.keepOpen && !(spec.keepView && spec.keepView(p))) H.setView(p, waitView(spec.doneTitle || 'Locked in', spec.doneMsg || 'Look at the big screen.'));
    renderStrip();
    if (spec.onAnswer) spec.onAnswer(p, data, a.answers);
    checkAsk();
  }
  function deepClean(data) {
    if (!H.settings.family) return data;
    if (typeof data === 'string') return PP.filter.clean(data);
    if (Array.isArray(data)) return data.map(deepClean);
    if (data && typeof data === 'object') { const o = {}; for (const k in data) o[k] = k === 'drawing' || k === 'd' ? data[k] : deepClean(data[k]); return o; }
    return data;
  }
  function audienceInput(token, d) {
    const a = H.ask; const aud = H.audience.get(token); aud.lastSeen = Date.now();
    if (d.kind === 'hype') { bumpHype(2); return; }
    if (!a || !a.spec.audience || d.req !== a.req) return;
    const i = Number(d.data); if (!(i >= 0 && i < a.spec.audience.options.length)) return;
    a.audVotes.set(token, i); renderAudienceBar();
  }
  function onReact(d) {
    if (!d || !d.token) return;
    const p = byId(d.token); const who = p || H.audience.get(d.token); if (!who) return;
    const now = Date.now(); if (who.lastReact && now - who.lastReact < 600) return; who.lastReact = now;
    if (d.sound && PP.CONTENT.sounds.some(s => s.id === d.sound)) { PP.Audio.sfx(d.sound); floatReact(PP.CONTENT.sounds.find(s => s.id === d.sound).label.split(' ')[0], p); }
    else if (PP.CONTENT.reactions.includes(d.e)) floatReact(d.e, p);
    bumpHype(p ? 3 : 2);
  }

  // ---------------------------------------------------------------- the ask cycle
  /**
   * Collect input from players (and optionally the audience) with a timer.
   * spec: { to: [players], view: p => view, secs, others?: p => view, audience?: { prompt, options },
   *         bot?: p => data, validate?: (p, data) => error|null, partial?: (p, data, answers) => done,
   *         stage?: () => void, keepOpen? }
   * Resolves { answers: Map(id → data), audience: [counts], audienceTotal }.
   */
  H.runAsk = (token, spec) => new Promise(resolve => {
    const req = uid(6), to = new Set(spec.to.map(p => p.id));
    const ms = Math.round((spec.secs || 30) * 1000 * (spec.noExtend ? 1 : H.settings.timerMult));
    const endAt = Date.now() + ms;
    const a = H.ask = { req, spec, to, answers: new Map(), audVotes: new Map(), resolve, endAt, ms, token };
    seated().forEach(p => {
      if (to.has(p.id)) H.setView(p, Object.assign({}, spec.view(p), { req, endAt }));
      else H.setView(p, spec.others ? spec.others(p) : waitView('Sit tight', 'Look at the big screen.'));
    });
    if (spec.audience) setAudience({ type: 'aud-vote', req, endAt, prompt: spec.audience.prompt, options: spec.audience.options });
    else setAudience({ type: 'aud-wait', msg: spec.audienceMsg || 'Players are busy. Hype them up.' });
    startTimer(ms);
    renderStrip(); renderAudienceBar();
    // bots answer after a believable delay
    spec.to.filter(p => p.bot && (spec.bot || spec.botMulti)).forEach(p => {
      const delay = 900 + Math.random() * Math.min(ms * 0.45, 9000);
      setTimeout(() => { if (H.ask === a) { if (spec.botMulti) spec.botMulti(p).forEach(d => H.ask === a && handleAnswer(a, p, d)); else handleAnswer(a, p, spec.bot(p)); } }, delay);
    });
    checkAsk();
  });
  function checkAsk() {
    const a = H.ask; if (!a) return;
    if (a.spec.until) { if (a.spec.until(a.answers)) finishAsk(); return; }
    const allIn = [...a.to].every(id => a.answers.has(id) || !byId(id));
    const nobodyToWaitFor = !a.to.size && !(a.spec.audience && H.audience.size);
    if ((allIn && a.to.size && !a.spec.keepOpen) || nobodyToWaitFor) finishAsk();
  }
  function tickAsk() { const a = H.ask; if (a && Date.now() >= a.endAt) finishAsk(); }
  function finishAsk() {
    const a = H.ask; if (!a) return; H.ask = null; stopTimer();
    // AFK detection: two missed prompts in a row triggers a call-out
    if (!a.spec.noAfk) a.to.forEach(id => {
      const p = byId(id); if (!p || p.bot) return;
      if (a.answers.has(id)) { if (p.afk) { p.afk = false; speak(curKey(), 'back'); } p.afkMisses = 0; }
      else if (++p.afkMisses === 2) { p.afk = true; speak(curKey(), 'afk'); }
    });
    const counts = a.spec.audience ? a.spec.audience.options.map(() => 0) : [];
    for (const v of a.audVotes.values()) counts[v]++;
    renderStrip(); renderAudienceBar(true);
    a.resolve({ answers: a.answers, audience: counts, audienceTotal: counts.reduce((s, n) => s + n, 0) });
  }
  H.skip = () => { if (H.ask) finishAsk(); };
  const curKey = () => H.game ? H.game.key : 'lobby';

  // ---------------------------------------------------------------- timer + music tension
  let timerInt = 0, timerEnd = 0, timerMs = 0, lastTick = 0;
  function startTimer(ms) {
    timerEnd = Date.now() + ms; timerMs = ms; $('#timer').classList.add('on'); clearInterval(timerInt);
    const tick = () => {
      const left = Math.max(0, timerEnd - Date.now()); const s = Math.ceil(left / 1000);
      const ring = $('#timer'); ring.style.setProperty('--p', (left / timerMs).toFixed(3)); ring.querySelector('b').textContent = s;
      ring.classList.toggle('low', s <= 5);
      PP.Audio.setTension(left / timerMs < 0.6 ? 1 - left / timerMs / 0.6 : 0);
      if (s <= 5 && s !== lastTick && s > 0) { PP.Audio.sfx('tick'); lastTick = s; }
    };
    tick(); timerInt = setInterval(tick, 200);
  }
  function stopTimer() { clearInterval(timerInt); $('#timer').classList.remove('on'); PP.Audio.setTension(0); lastTick = 0; }

  // ---------------------------------------------------------------- hype meter (Megaphone)
  function bumpHype(n) { H.hype = Math.min(100, H.hype + n); if (H.hype >= 100) { H.hypeBurst('HYPE TRAIN!'); H.hype = 45; } renderHype(); }
  H.hypeBurst = label => {
    PP.Audio.sfx('hype'); const fx = $('#fx');
    const b = document.createElement('div'); b.className = 'hype-burst'; b.textContent = label || 'HYPE!'; fx.appendChild(b); setTimeout(() => b.remove(), 2600);
    if (!document.documentElement.classList.contains('reduce-motion')) for (let i = 0; i < 40; i++) {
      const c = document.createElement('i'); c.className = 'confetti'; c.style.left = Math.random() * 100 + 'vw'; c.style.background = PP.playerColor(i, paletteMode());
      c.style.animationDelay = Math.random() * 0.6 + 's'; c.style.animationDuration = 1.6 + Math.random() * 1.4 + 's'; fx.appendChild(c); setTimeout(() => c.remove(), 3600);
    }
  };
  function renderHype() { const m = $('#hype'); if (!m) return; m.style.setProperty('--h', (H.hype / 100).toFixed(3)); m.classList.toggle('hot', H.hype > 70); m.hidden = !H.settings.audience; }
  function floatReact(emoji, p) {
    if (document.documentElement.classList.contains('reduce-motion') && $('#fx').childElementCount > 6) return;
    const e = document.createElement('div'); e.className = 'react';
    e.innerHTML = `<span>${esc(emoji)}</span>${p ? `<small>${esc(p.name)}</small>` : ''}`;
    e.style.left = (8 + Math.random() * 80) + 'vw';
    if (p) e.style.setProperty('--c', H.colorOf(p));
    $('#fx').appendChild(e); setTimeout(() => e.remove(), 2600);
  }

  // ---------------------------------------------------------------- rendering: chrome
  function renderTop() {
    const g = H.game ? PP.GAMES[H.game.key] : null;
    const url = joinUrl();
    $('#top').innerHTML = `
      <div class="brand" style="${g ? `font-family:${g.font}` : ''}">${g ? esc(g.title) : 'Party Pack'}</div>
      <div class="join">
        <span class="muted">Join at <b>${esc(url.replace(/^https?:\/\//, '').replace(/\?.*$/, ''))}</b></span>
        <span class="code" aria-label="Room code">${esc(H.code)}</span>
      </div>
      <div class="meta">
        ${H.relay === 'disconnected' ? '<span class="warn">Reconnecting…</span>' : ''}
        ${H.settings.audience && H.audience.size ? `<span class="aud-count" title="Audience">${H.audience.size} watching</span>` : ''}
        ${H.game ? '<button class="chip-btn" data-act="skip" title="Skip the timer">Skip ⏭</button><button class="chip-btn" data-act="end">End game</button>' : ''}
        <button class="chip-btn" data-act="settings" aria-label="Settings">⚙ Settings</button>
      </div>`;
    $('#top').querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const act = b.dataset.act;
      if (act === 'settings') openSettings();
      if (act === 'skip') H.skip();
      if (act === 'end') H.endGame();
    });
  }
  // Phones can't open "localhost", so when the Main Stage runs on localhost the join link and QR code use this
  // computer's Wi-Fi address from the game server (server/index.mjs net-info). No address = show a warning.
  function joinUrl() { const u = H.lanBase || location.href.split('#')[0].split('?')[0]; return u + '?code=' + H.code + '#play'; }
  const onLocalhost = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  async function findLanAddress() {
    if (!onLocalhost() || location.protocol === 'file:') { H.lanState = 'ok'; return; }
    const before = H.lanBase;
    try {
      const j = await fetch('net-info', { cache: 'no-store' }).then(r => r.ok ? r.json() : null);
      const ip = j && j.addresses && j.addresses[0];
      H.lanBase = ip ? `${location.protocol}//${ip}:${j.port || location.port}${location.pathname}` : null;
      H.lanState = ip ? 'ok' : 'none';
    } catch (e) { H.lanState = 'unknown'; }
    if (H.lanBase !== before && !H.game) refresh(); else renderTop();
  }
  H.findLanAddress = findLanAddress;
  function renderStrip() {
    const a = H.ask;
    $('#strip').innerHTML = H.players.map(p => {
      const state = a && a.to.has(p.id) ? (a.answers.has(p.id) ? 'is-done' : 'is-busy') : '';
      return `<div class="pchip ${state} ${p.connected ? '' : 'off'} ${p.ghost ? 'ghost' : ''}" style="--c:${H.colorOf(p)}">
        ${H.vip === p.id ? PP.Art.crown : ''}<span class="av">${PP.Art.player(p, H.colorOf(p))}</span><span class="nm"><span class="shape">${H.shapeOf(p)}</span>${esc(p.name)}${H.moderator === p.id ? ' ' + PP.Art.shield : ''}</span>
        <span class="sc">${p.score.toLocaleString()}</span>${p.afk ? '<span class="badge">AFK</span>' : ''}${p.bot ? '<span class="badge">BOT</span>' : ''}${state === 'is-done' ? '<span class="tick">✓</span>' : ''}</div>`;
    }).join('');
    PP.Audio.setStandings(H.players.map(p => ({ seat: p.seat, score: p.score })));
    saveState();
  }
  function renderAudienceBar(final) {
    const a = H.ask, el = $('#audbar');
    if (!a || !a.spec.audience || !H.audience.size) { if (!final || !H.audience.size) el.classList.remove('on'); return; }
    const counts = a.spec.audience.options.map(() => 0);
    for (const v of a.audVotes.values()) counts[v]++;
    const total = counts.reduce((s, n) => s + n, 0);
    el.classList.add('on');
    el.innerHTML = `<b>Audience</b> ${total ? counts.map((n, i) => `<span>${i + 1}: ${Math.round(n / total * 100)}%</span>`).join('') : '<span class="muted">vote on your phone</span>'}`;
  }
  // The VIP is always a connected human: whoever held it may have dropped while nobody else was here.
  function ensureVip() { const v = byId(H.vip); if (!v || !v.connected) { const next = humans().find(p => p.connected); H.vip = next ? next.id : null; } }
  // ---------------------------------------------------------------- surviving a reload
  // The whole game lives in this tab, so a refresh would wipe it. After every change the seats, scores, VIP and
  // moderator are saved for this tab (sessionStorage, with the room code); on reload they come back, phones rejoin
  // their own seats by token, and the lobby says so. A round in progress can't resume mid-prompt: pick it again.
  function saveState() {
    try {
      sessionStorage.setItem('pp.hostState', JSON.stringify({ code: H.code, at: Date.now(), vip: H.vip, moderator: H.moderator, game: H.game ? H.game.key : null,
        players: H.players.map(p => ({ id: p.id, seat: p.seat, name: p.name, avatar: p.avatar, score: p.score, bot: p.bot })) }));
    } catch (e) { /* storage unavailable */ }
  }
  function restoreState() {
    let st = null; try { st = JSON.parse(sessionStorage.getItem('pp.hostState') || 'null'); } catch (e) { st = null; }
    if (!st || st.code !== H.code || Date.now() - st.at > 6 * 3600e3 || !Array.isArray(st.players) || !st.players.length) return;
    const now = Date.now();
    H.players = st.players.filter(p => p && p.id).slice(0, MAX_PLAYERS).map(p => ({ id: String(p.id), seat: p.seat | 0, name: String(p.name || 'Player').slice(0, 12), avatar: String(p.avatar || '0'),
      score: Math.max(0, p.score | 0), bot: !!p.bot, connected: true, lastSeen: now, afkMisses: 0, afk: false }));
    H.vip = st.vip; H.moderator = st.moderator;
    H.resumed = { game: st.game, players: H.players.length };
  }
  H.saveState = saveState;

  function refresh() { ensureVip(); renderTop(); renderStrip(); if (!H.game) lobby(); H.players.forEach(p => { if (!H.game) H.views[p.id] = null; sendView(p); }); }
  H.refresh = refresh;

  // ---------------------------------------------------------------- lobby
  function lobby() {
    H.phase = 'LOBBY_WAITING';
    setTheme('lobby');
    const url = joinUrl();
    const slots = Array.from({ length: MAX_PLAYERS }, (_, i) => H.players.find(p => p.seat === i));
    $('#stage').className = 'stage lobby';
    $('#stage').innerHTML = `
      <section class="lobby-hero">
        <div class="howto">
          <div class="join-row"><h1 class="logo">PARTY<br>PACK</h1><div class="bigcode" aria-label="Room code">${esc(H.code)}</div></div>
          <div class="join-card"><div id="qr" class="qr" aria-label="QR code to join"></div><div><small>Grab your phone and go to</small><b class="url">${esc(url.replace(/^https?:\/\//, '').split('?')[0])}</b><small>then enter the room code</small></div></div>
          ${H.lanState === 'none' ? '<p class="note-line warn-line"><b>Phones can\'t reach this computer yet.</b> Connect it to the same Wi-Fi or phone hotspot as the players, over Wi-Fi rather than a USB cable. The join link updates by itself.</p>' : ''}
          ${H.resumed ? `<p class="note-line">The Main Stage was reloaded${H.resumed.game ? ` during ${esc((PP.GAMES[H.resumed.game] || {}).title || 'a game')}` : ''}: players and scores are kept. Pick a game to carry on.</p>` : ''}
          <p class="note-line">First phone in is the VIP and picks the game. <button class="chip-btn" id="addbot">+ Add a bot</button></p>
        </div>
        <div class="slots">${slots.map((p, i) => p ? `
          <div class="slot full" style="--c:${H.colorOf(p)}">${H.vip === p.id ? PP.Art.crown : ''}<span class="av">${PP.Art.player(p, H.colorOf(p))}</span><b>${esc(p.name)}</b><small>${H.vip === p.id ? 'VIP' : p.bot ? 'Bot' : H.moderator === p.id ? 'Moderator' : p.connected ? 'Ready!' : 'Disconnected'}</small><button class="x" data-kick="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">✕</button></div>`
          : `<div class="slot empty"><span class="shape">${PP.SHAPES[i]}</span><small>Join on your phone</small></div>`).join('')}
        </div>
      </section>
      ${H.lastShirt ? '<button class="btn print-last" id="print-last">🖨 Print the champion shirt</button>' : ''}
      <section class="picker">
        ${Object.entries(PP.GAMES).map(([k, g]) => `
          <button class="game-card" data-game="${k}" style="--a:${g.accent};--gfont:${g.font}" title="${esc(g.blurb)}">
            <span class="gc-art">${PP.Art.host(k)}</span><b>${esc(g.title)}</b><small class="sr-only">${esc(g.blurb)}</small>
            <span class="req">${g.min}–8 players${H.players.length < g.min ? ` · bots fill ${g.min - H.players.length}` : ''}</span>
          </button>`).join('')}
      </section>`;
    $('#stage').querySelectorAll('[data-kick]').forEach(b => b.onclick = () => H.kick(b.dataset.kick));
    $('#addbot').onclick = () => H.addBot();
    if (H.lastShirt) $('#print-last').onclick = () => PP.Merch.open(H.lastShirt);
    $('#stage').querySelectorAll('[data-game]').forEach(b => b.onclick = () => H.startGame(b.dataset.game, { fillBots: true }));
    if (window.qrcode) try { const q = qrcode(0, 'M'); q.addData(url); q.make(); $('#qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (e) { /* QR optional */ }
    setAudience({ type: 'aud-wait', msg: 'Waiting for the VIP to pick a game.' });
  }

  // ---------------------------------------------------------------- game runner
  H.startGame = async (key, opts) => {
    const G = PP.GAMES[key]; if (!G || H.game) return;
    if (!humans().length && !(opts && opts.fillBots)) return;
    if (opts && opts.fillBots) while (H.players.length < G.min && H.addBot());
    if (H.players.length < G.min) return;
    // a fresh game: reset scores, promote audience members who want a seat
    H.players.forEach(p => { p.score = 0; p.afk = false; p.afkMisses = 0; p.ghost = false; });
    H.resumed = null;
    const token = ++H.runToken; H.game = { key, token };
    PP.Voice.stop(); PP.Audio.setStyle(key); H.views = {}; setTheme(key);
    renderTop(); renderStrip();
    const ctx = makeCtx(key, token);
    try { await G.run(ctx); }
    catch (e) { if (e !== ABORT) { console.error(e); $('#stage').innerHTML = `<div class="center"><h1>Something broke</h1><p>${esc(e.message)}</p></div>`; await PP.sleep(3000); } }
    if (H.runToken !== token) return;
    const results = H.players.slice().sort((a, b) => b.score - a.score);
    if (window.Hub && Hub.report) Hub.report('session-end', { result: 'win', game: key, winner: results[0] && results[0].name, score: results[0] && results[0].score });
    H.game = null; H.ask = null; stopTimer(); H.views = {}; PP.Audio.setStyle('lobby');
    promoteAudience(); refresh();
  };
  // Phones that wanted to play but arrived mid-game get the free seats once the game ends.
  function promoteAudience() {
    for (const [t, a] of H.audience) {
      if (!a.wantSeat || freeSeat() < 0) continue;
      H.audience.delete(t); addPlayer(t, a.name, a.avatar);
    }
  }
  H.endGame = () => {
    if (!H.game) return; H.runToken++; PP.Voice.stop();
    if (H.ask) { const a = H.ask; H.ask = null; a.resolve({ answers: new Map(), audience: [], audienceTotal: 0, aborted: true }); }
    H.game = null; stopTimer(); H.views = {}; H.players.forEach(p => { p.ghost = false; }); PP.Audio.setStyle('lobby'); promoteAudience(); refresh();
  };

  function speak(hostKey, lineKey) { return PP.Voice.speak(hostKey, lineKey); }
  /** Each game has its own art direction: palette, pattern and display font (css/party.css [data-theme]). */
  function setTheme(key) {
    document.documentElement.dataset.theme = key;
    const el = $('#host'); if (el && el.dataset.who !== key) { el.querySelector('.host-art').innerHTML = PP.Art.host(key); el.dataset.who = key; }
  }

  function makeCtx(key, token) {
    const live = () => { if (H.runToken !== token) throw ABORT; };
    const ctx = {
      key, H,
      players: () => seated().slice(),
      humans: () => humans(),
      byId,
      color: p => H.colorOf(p), shape: p => H.shapeOf(p),
      content: () => (PP.UGC ? PP.UGC.content() : PP.CONTENT),
      live,
      async wait(ms) { await PP.sleep(ms); live(); },
      stage(html, cls) { live(); const s = $('#stage'); s.className = 'stage ' + (cls || ''); s.innerHTML = html; return s; },
      setPhase(name) { H.phase = name; const d = $('#phase'); if (d) d.textContent = name; },
      /** Speak a host line (names and answers stay on screen). await it to wait for the line, capped so a stuck voice never stalls the game. */
      say(lineKey, vars, maxMs) {
        const p = (async () => { live(); await Promise.race([speak(key, lineKey), PP.sleep(maxMs || 12000)]); live(); })();
        p.catch(() => {});   // games often fire a line without awaiting it; ending the game mustn't leave an unhandled rejection
        return p;
      },
      async ask(spec) { live(); const r = await H.runAsk(token, spec); live(); return r; },
      waitAll(title, msg) { seated().forEach(p => H.setView(p, waitView(title, msg))); setAudience({ type: 'aud-wait', msg: msg || title }); },
      view: (p, v) => H.setView(p, v),
      asset: (p, id, data) => H.sendAsset(p, id, data),
      score(p, d) { if (!p) return; p.score = Math.max(0, Math.round(p.score + d)); renderStrip(); },
      refreshStrip: renderStrip,
      hype: label => H.hypeBurst(label),
      /** Unanimous audience vote (at least two voters) — the Megaphone's double-points trigger. */
      unanimous(res) { return res.audienceTotal >= 2 && res.audience.some(n => n === res.audienceTotal); },
      audienceCount: () => H.audience.size,
      /** Let the VIP Moderator screen user-generated text before it reaches the big screen. */
      async moderate(items) {
        live();
        const mod = H.settings.moderation && H.moderator && byId(H.moderator);
        if (!mod || !mod.connected || !items.length) return items;
        ctx.stage(`<div class="center"><h2>🛡 The moderator is reviewing ${items.length} answers…</h2><p class="muted">${esc(mod.name)} is checking everything before it hits the big screen.</p></div>`);
        const r = await ctx.ask({
          to: [mod], secs: 40, noExtend: true, noAfk: true, clean: false,
          view: () => ({ type: 'review', title: 'Moderator review', items: items.map(it => ({ id: it.id, text: it.text })) }),
          others: () => waitView('Moderation', 'The moderator is reviewing answers.')
        });
        const rejected = new Set((r.answers.get(mod.id) || {}).rejected || []);
        let removed = 0;
        items.forEach(it => { if (rejected.has(it.id)) { it.text = it.fallback || '[removed by the moderator]'; it.removed = true; removed++; } });
        if (removed) await ctx.say('moderated');
        return items;
      },
      /** Animated scoreboard. deltas: Map(id → points this round). */
      async scoreboard(title, deltas, ms) {
        live();
        const list = seated().slice().sort((a, b) => b.score - a.score);
        const top = list[0] ? list[0].score : 1;
        ctx.stage(`<div class="board"><h2>${esc(title || 'Scores')}</h2>${list.map((p, i) => `
          <div class="row" style="--c:${H.colorOf(p)};--w:${top ? Math.max(4, p.score / top * 100) : 4}%;--i:${i}">
            <span class="rk">${i + 1}</span><span class="av">${PP.Art.player(p, H.colorOf(p))}</span><b>${H.shapeOf(p)} ${esc(p.name)}</b>
            <span class="bar"><i></i></span><span class="pts">${p.score.toLocaleString()}</span>${deltas && deltas.get(p.id) ? `<span class="delta">+${deltas.get(p.id).toLocaleString()}</span>` : ''}
          </div>`).join('')}</div>`, 'scores');
        ctx.waitAll('Scores', 'Check the big screen.');
        await ctx.wait(ms || 4500);
      },
      /** Final results with tie handling and the host's sign-off. */
      async finale(extra) {
        live();
        const list = seated().slice().sort((a, b) => b.score - a.score);
        const best = list.length ? list[0].score : 0;
        const winners = extra && extra.winners ? extra.winners : list.filter(p => p.score === best);
        PP.Audio.sfx('win'); H.hypeBurst(winners.length > 1 ? 'TIE!' : 'WINNER!');
        ctx.stage(`<div class="finale"><div class="winners">${winners.slice(0, 4).map(w => `<div><div>${PP.Art.crown}</div><div class="winner-face">${PP.Art.player(w, H.colorOf(w))}</div></div>`).join('')}</div><h1>${winners.map(w => esc(w.name)).join(' &amp; ')}</h1>
          <p class="big">${extra && extra.subtitle ? esc(extra.subtitle) : winners.length > 1 ? 'Shared the win.' : 'wins ' + esc(PP.GAMES[key].title) + '!'}</p>
          ${extra && extra.html ? extra.html : ''}
          <div class="mini">${list.map((p, i) => `<span>${i + 1}. ${esc(p.name)} · ${p.score.toLocaleString()}</span>`).join('')}</div></div>`, 'final');
        seated().forEach(p => H.setView(p, { type: 'wait', title: winners.includes(p) ? 'You won!' : 'Game over', msg: `Final score: ${p.score.toLocaleString()}`, react: true }));
        if (winners.length > 1) {
          const names = PP.listNames(winners.map(w => w.name));
          await ctx.say(winners.length === 2 ? 'tie2' : winners.length === 3 ? 'tie3' : winners.length === 4 ? 'tie4' : 'tieMany', { names });
        } else if (winners[0]) await ctx.say('end', { name: winners[0].name });
        await ctx.wait(extra && extra.hold ? extra.hold : 7000);
      }
    };
    return ctx;
  }

  // ---------------------------------------------------------------- settings
  function applySettings() {
    PP.applyA11y(H.settings);
    PP.Voice.on = H.settings.voice;
    PP.Audio.setVolume(H.settings.music);
    renderTop(); renderStrip(); renderHype();
  }
  function toggleSetting(k) { H.settings[k] = !H.settings[k]; saveSettings(); applySettings(); }
  function openSettings() {
    const s = H.settings; const dlg = $('#settings');
    const mods = humans();
    dlg.innerHTML = `<form method="dialog" class="settings">
      <h2>Settings</h2>
      <fieldset><legend>Safety</legend>
        <label><input type="checkbox" name="family" ${s.family ? 'checked' : ''}> Family-friendly filter (masks profanity in names and answers)</label>
        <label>VIP Moderator <select name="moderator"><option value="">Nobody</option>${mods.map(p => `<option value="${esc(p.id)}" ${H.moderator === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <small class="muted">The moderator approves or removes every typed answer before it reaches the big screen.</small>
      </fieldset>
      <fieldset><legend>Audience</legend>
        <label><input type="checkbox" name="audience" ${s.audience ? 'checked' : ''}> Let extra phones join as the audience (they vote and fill the Hype Meter)</label>
      </fieldset>
      <fieldset><legend>Accessibility</legend>
        <label>Timers <select name="timerMult">${[[1, 'Normal'], [1.5, 'Extended (×1.5)'], [2, 'Extra long (×2)'], [3, 'Relaxed (×3)']].map(([v, l]) => `<option value="${v}" ${s.timerMult == v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Text size <select name="textScale">${[[1, '100%'], [1.2, '120%'], [1.4, '140%'], [1.7, '170%']].map(([v, l]) => `<option value="${v}" ${s.textScale == v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label><input type="checkbox" name="highContrast" ${s.highContrast ? 'checked' : ''}> High contrast</label>
        <label>Colour-blind mode <select name="colorBlind">${[['none', 'Off'], ['protan', 'Protanopia'], ['deutan', 'Deuteranopia'], ['tritan', 'Tritanopia'], ['mono', 'Monochrome']].map(([v, l]) => `<option value="${v}" ${s.colorBlind === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label><input type="checkbox" name="reduceMotion" ${s.reduceMotion ? 'checked' : ''}> Reduce motion</label>
        <label><input type="checkbox" name="captions" ${s.captions ? 'checked' : ''}> Captions for the host's voice</label>
      </fieldset>
      <fieldset><legend>Sound</legend>
        <label><input type="checkbox" name="voice" ${s.voice ? 'checked' : ''}> Host voice</label>
        <small class="muted">${PP.Voice.clips.size ? `${PP.Voice.clips.size} recorded lines.` : 'No recorded lines yet: the hosts use this computer\'s built-in voice.'} Record them in the <a href="#booth" target="_blank">Voice Booth</a> to make the hosts sound human.</small>
        <label>Music volume <input type="range" name="music" min="0" max="0.8" step="0.02" value="${s.music}"></label>
      </fieldset>
      <fieldset><legend>Content</legend>
        <label>Custom prompt pack (7-character share code) <input name="ugc" value="${esc(s.ugc)}" placeholder="e.g. Q7K2M9X" maxlength="7" autocomplete="off"></label>
        <small class="muted">${PP.UGC ? PP.UGC.status() : ''} Make a pack in the <a href="#studio" target="_blank">Prompt Studio</a>.</small>
      </fieldset>
      <div class="row"><button value="ok" class="btn primary">Done</button></div></form>`;
    dlg.showModal();
    dlg.querySelector('form').onsubmit = () => {
      const f = new FormData(dlg.querySelector('form'));
      ['family', 'audience', 'highContrast', 'reduceMotion', 'captions', 'voice'].forEach(k => { s[k] = f.has(k); });
      s.timerMult = Number(f.get('timerMult')); s.textScale = Number(f.get('textScale')); s.colorBlind = f.get('colorBlind'); s.music = Number(f.get('music'));
      const ugc = String(f.get('ugc') || '').trim().toUpperCase(); if (ugc !== s.ugc) { s.ugc = ugc; if (PP.UGC) PP.UGC.applyCode(ugc); }
      const mod = f.get('moderator'); H.moderator = mod || null; s.moderation = !!H.moderator;
      saveSettings(); applySettings(); refresh();
    };
  }
  H.waitView = waitView;
})();
