// RECESS app shell: welcome cover, lobby, waiting room and the frame every mini-game plays inside.
import { net } from './net.js';
import { sound, sfx } from './audio.js';
import { h, $, toast, modal, howTo, results, floatReaction, REACTION_EMOJI, nameList } from './ui.js';
import { avatarSVG, avatarEl, cardArt, ICONS, paperclip, coverDoodles } from './art.js';
import { CATALOG, CATALOG_BY_ID, CATEGORIES } from '../shared/catalog.js';
import { AVATARS, AVATAR_IDS, REACTIONS, MOODS } from '../shared/avatars.js';

const state = {
  lobby: null,
  me: null,
  filter: 'all',
  search: '',
  match: null,     // { matchId, gameType, instance, view }
  sheet: null,
  profile: loadProfile(),
  lastFeedTime: 0,
  cards: new Map()
};

function loadProfile() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem('recess_profile') || '{}'); } catch {}
  const names = ['Aarav', 'Diya', 'Kabir', 'Ananya', 'Rohan', 'Ishaan', 'Meera', 'Vihaan', 'Aditi', 'Zoya'];
  return {
    name: p.name || names[Math.floor(Math.random() * names.length)],
    avatar: AVATAR_IDS.includes(p.avatar) ? p.avatar : AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)]
  };
}
function saveProfile() { try { localStorage.setItem('recess_profile', JSON.stringify(state.profile)); } catch {} }

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === id);
  window.scrollTo(0, 0);
}

const calmKey = 'recess_calm';
function applyCalm() { document.body.classList.toggle('calm', localStorage.getItem(calmKey) === '1'); }
applyCalm();

// ═════════════════════════ WELCOME ═════════════════════════
function renderWelcome(note) {
  const root = $('#welcome');
  root.replaceChildren();
  if (note) root.append(h('div.restart-note.toast.sticky', {}, note));
  const params = new URLSearchParams(location.search);
  const presetCode = (params.get('room') || '').toUpperCase().slice(0, 4);

  const nameInput = h('input.field#name', { maxlength: 16, value: state.profile.name, autocomplete: 'nickname', 'aria-label': 'Your nickname' });
  const pick = h('div.avatar-pick', { role: 'group', 'aria-label': 'Choose an avatar' });
  for (const a of AVATARS) {
    const b = h('button', { type: 'button', title: a.name, 'aria-label': a.name, 'aria-pressed': String(a.id === state.profile.avatar), html: avatarSVG(a.id) });
    b.addEventListener('click', () => {
      state.profile.avatar = a.id; saveProfile(); sfx('pop');
      for (const x of pick.children) x.setAttribute('aria-pressed', String(x === b));
    });
    pick.append(b);
  }
  const err = h('div.form-error', { role: 'alert' });
  const codeInput = h('input.field.code-input', { maxlength: 4, placeholder: 'CODE', value: presetCode, autocapitalize: 'characters', 'aria-label': 'Room code', inputmode: 'text' });
  codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, ''); });

  const busy = (on) => root.querySelectorAll('button.btn').forEach(b => { b.disabled = on; });
  const readName = () => {
    const n = nameInput.value.trim();
    if (!n) { err.textContent = 'Write your name on the cover first!'; nameInput.focus(); return null; }
    state.profile.name = n.slice(0, 16); saveProfile();
    return state.profile.name;
  };
  const createBtn = h('button.btn.big.red', { type: 'button' }, 'Start a new room');
  createBtn.addEventListener('click', async () => {
    const name = readName(); if (!name) return;
    busy(true); err.textContent = '';
    const res = await net.create(name, state.profile.avatar);
    busy(false);
    if (!res.ok) { err.textContent = res.error; return; }
    sfx('bell');
    enterLobby(res);
  });
  const joinBtn = h('button.btn.big', { type: 'submit' }, 'Join');
  const joinForm = h('form.code-row', {}, codeInput, joinBtn);
  joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = readName(); if (!name) return;
    const code = codeInput.value.trim();
    if (!/^[A-Z]{4}$/.test(code)) { err.textContent = 'Room codes are 4 letters, like KPQR.'; codeInput.focus(); return; }
    busy(true); err.textContent = '';
    const res = await net.join(code, name, state.profile.avatar);
    busy(false);
    if (!res.ok) { err.textContent = res.error; sfx('bad'); return; }
    sfx('join');
    enterLobby(res);
  });

  const logo = h('div.logo', { 'aria-label': 'RECESS' }, ...'RECESS'.split('').map((ch, i) => h('span', { style: { '--r': `${[-6, 4, -3, 5, -4, 3][i]}deg` } }, ch)));
  const offline = location.protocol === 'file:';
  root.append(h('div.cover', {},
    h('div.cover-left', { html: coverDoodles() },
    ),
    h('div.cover-right.paper', {},
      h('h2', {}, 'Who\'s playing?'),
      h('label.lbl', { for: 'name' }, 'Name'), nameInput,
      h('div.lbl', { style: { marginTop: '14px' } }, 'Pick your face'), pick,
      offline
        ? h('p.form-error', {}, 'RECESS needs its little server for multiplayer. Run "npm start" in the project folder and open http://localhost:8080/games/recess/.')
        : h('div.welcome-actions', {},
          createBtn,
          h('div.or-line', {}, 'or join friends'),
          joinForm,
          err)
    )
  ));
  const left = root.querySelector('.cover-left');
  left.append(
    h('div.cover-label', {}, h('small', {}, 'Subject: Fun · Class: Everyone'), logo, h('div.tagline', {}, 'The Schoolyard Game Hub')),
    h('p.cover-blurb', { html: 'Thirteen desk-and-playground classics — <b>Tic-Tac-Toe, Raja Mantri Chor Sipahi, Ludo, Carrom, Pen Fight</b> and more. One person starts a room, everyone joins on their own phone, and each pair or gang picks a game.' })
  );
  show('welcome');
}

// ═════════════════════════ LOBBY ═════════════════════════
function enterLobby(res) {
  state.me = res.playerId;
  if (res.name && res.name !== state.profile.name) toast(`Someone already had that name, so you're "${res.name}".`);
  buildLobby();
  show('lobby');
  const u = new URL(location.href);
  u.searchParams.set('room', res.code);
  history.replaceState(null, '', u);
}

function buildLobby() {
  const root = $('#lobby');
  root.replaceChildren();
  state.cards.clear();

  const logo = h('div.logo', { 'aria-label': 'RECESS' }, ...'RECESS'.split('').map((ch, i) => h('span', { style: { '--r': `${[-6, 4, -3, 5, -4, 3][i]}deg` } }, ch)));
  logo.addEventListener('click', () => sfx('bell'));
  const codeEl = h('span.code', {}, '····');
  const copyBtn = h('button.icon-btn', { title: 'Copy room code', 'aria-label': 'Copy room code', html: ICONS.copy });
  copyBtn.addEventListener('click', async () => {
    sfx('click');
    try { await navigator.clipboard.writeText(state.lobby.code); toast(`Copied ${state.lobby.code}`); } catch { toast(`The code is ${state.lobby.code}`); }
  });
  const shareBtn = h('button.icon-btn', { title: 'Share the room link', 'aria-label': 'Share room link', html: ICONS.link });
  shareBtn.addEventListener('click', async () => {
    sfx('click');
    const url = `${location.origin}${location.pathname}?room=${state.lobby.code}`;
    if (navigator.share) { try { await navigator.share({ title: 'Join my RECESS room', text: `Room ${state.lobby.code}`, url }); return; } catch {} }
    try { await navigator.clipboard.writeText(url); toast('Room link copied — paste it to your friends'); } catch { toast(url, { ms: 8000 }); }
  });
  const conn = h('span.conn', {}, h('i'), h('span', {}, 'Connected'));
  const settingsBtn = h('button.icon-btn', { title: 'Settings', 'aria-label': 'Settings', html: ICONS.gear, on: { click: openSettings } });
  const leaveBtn = h('button.icon-btn', { title: 'Leave room', 'aria-label': 'Leave room', html: ICONS.door, on: { click: leaveRoom } });

  root.append(h('header.topbar', {},
    logo,
    h('div.room-tag.sticky', {}, h('div', {}, h('div.lbl2', {}, 'Room code'), codeEl), copyBtn, shareBtn),
    h('div.spacer'),
    conn, settingsBtn, leaveBtn
  ));

  // side column
  const roster = h('ul.roster');
  const reactBar = h('div.react-bar', { role: 'group', 'aria-label': 'Quick reactions' }, REACTIONS.map(k =>
    h('button', { title: k, 'aria-label': `React ${k}`, on: { click: () => react(k) } }, REACTION_EMOJI[k])));
  const moodSel = h('select.mood-select', { 'aria-label': 'Your status' }, MOODS.map(m => h('option', { value: m }, m)));
  moodSel.addEventListener('change', () => net.req('profile', { mood: moodSel.value }));
  const feed = h('ul.feed', { 'aria-live': 'polite' });
  const chatInput = h('input.field', { maxlength: 120, placeholder: 'Pass a note…', 'aria-label': 'Message the room' });
  const chatForm = h('form.chat-form', {}, chatInput, h('button.btn.small', { type: 'submit' }, 'Pass'));
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = chatInput.value.trim();
    if (!t) return;
    net.req('chat', { text: t }); chatInput.value = ''; sfx('paper');
  });
  const classTitle = h('h2', {}, 'Classmates');
  const side = h('aside.side', {},
    h('section.panel.paper', {}, classTitle, roster, reactBar, moodSel),
    h('section.panel.paper', {}, h('h2', {}, 'Notice board'), feed, chatForm)
  );

  // games column
  const tabs = h('div.tabs', { role: 'tablist' }, CATEGORIES.map(c => {
    const b = h('button', { role: 'tab', 'aria-selected': String(state.filter === c.id) }, c.name);
    b.addEventListener('click', () => { state.filter = c.id; sfx('page'); for (const x of tabs.children) x.setAttribute('aria-selected', String(x === b)); filterCards(); });
    return b;
  }));
  const search = h('input.field', { type: 'search', placeholder: 'Find a game…', 'aria-label': 'Search games', value: state.search });
  search.addEventListener('input', () => { state.search = search.value.trim().toLowerCase(); filterCards(); });
  const grid = h('div.game-grid');
  CATALOG.forEach((g, i) => {
    const card = buildCard(g, i);
    state.cards.set(g.id, card);
    grid.append(card.el);
  });
  const empty = h('div.empty-state', { hidden: true }, 'No game by that name in this notebook. Try "ludo" or "pen".');
  grid.append(empty);
  const main = h('main.main-col', {}, h('div.games-head', {}, tabs, h('label.search', {}, h('span', { html: ICONS.search }), search)), grid);
  root.append(h('div.lobby-grid', {}, side, main));

  state.lobbyEls = { codeEl, roster, feed, classTitle, conn, empty, moodSel };
  if (state.lobby) renderLobby();
}

function filterCards() {
  let shown = 0;
  for (const [id, c] of state.cards) {
    const g = CATALOG_BY_ID[id];
    const ok = (state.filter === 'all' || g.category === state.filter) &&
      (!state.search || (g.name + ' ' + g.blurb).toLowerCase().includes(state.search));
    c.el.hidden = !ok;
    if (ok) shown++;
  }
  state.lobbyEls.empty.hidden = shown > 0;
}

function buildCard(g, i) {
  const el = h('article.game-card', { style: { '--accent': g.color, '--tilt': `${[-1.2, .8, -.5, 1.1, -.9, .6][i % 6]}deg` } });
  const art = h('div.art', { html: cardArt(g.id) });
  const players = g.min === g.max ? `${g.min} player${g.min > 1 ? 's' : ''}` : `${g.min}–${g.max} players`;
  const badge = h('div.waiting-badge', { hidden: true });
  const live = h('span.live');
  const play = h('button.btn.small');
  const bots = h('button.btn.small.ghost', { title: 'Practice against schoolyard bots', 'aria-label': `Play ${g.name} with bots`, html: `${ICONS.bot}<span>Bots</span>` });
  const help = h('button.btn.small.ghost', { title: 'How to play', 'aria-label': `How to play ${g.name}`, html: ICONS.help, on: { click: () => howTo(g) } });
  bots.querySelector('svg').style.cssText = 'width:18px;height:18px';
  help.querySelector('svg').style.cssText = 'width:18px;height:18px';
  bots.hidden = !g.bots;
  el.append(
    h('span', { html: paperclip() }),
    badge, art,
    h('div.body', {},
      h('h3', {}, g.name),
      h('p.blurb', {}, g.blurb),
      h('div.meta', {}, h('span.pc', { html: ICONS.people + players }), live),
      h('div.actions', {}, play, bots, help))
  );
  const press = () => { el.classList.remove('pressed'); void el.offsetWidth; el.classList.add('pressed'); };
  play.addEventListener('click', async () => {
    press(); sfx('tap');
    const L = state.lobby;
    if (L?.myQueue === g.id) { await net.req('leave-queue'); return; }
    const res = await net.req('queue', { gameType: g.id });
    if (!res.ok) toast(res.error, { tone: 'bad' });
  });
  bots.addEventListener('click', () => { press(); sfx('tap'); pickBots(g); });
  return { el, badge, play, bots, live };
}

function pickBots(g) {
  if (g.min === g.max) return startWithBots(g, g.min);
  modal((box, close) => {
    box.append(h('h2', {}, `${g.name} with bots`));
    box.append(h('p.note', { style: { font: '600 20px var(--f-note)' } }, 'How many seats at the table (you included)?'));
    const row = h('div.result-actions');
    for (let n = g.min; n <= g.max; n++) row.append(h('button.btn', { on: { click: () => { close(); startWithBots(g, n); } } }, `${n} players`));
    box.append(row);
  });
}

async function startWithBots(g, seats) {
  const res = await net.req('queue', { gameType: g.id, withBots: true, seats });
  if (!res.ok) toast(res.error, { tone: 'bad' });
}

function renderLobby() {
  const L = state.lobby;
  const E = state.lobbyEls;
  if (!L || !E) return;
  E.codeEl.textContent = L.code;
  E.classTitle.replaceChildren('Classmates', h('span.count', {}, L.players.length));

  // roster
  E.roster.replaceChildren(...L.players.map(p => {
    const ava = avatarEl(p.avatar, { online: p.online });
    ava.append(h('span.dot'));
    const statusText = !p.online ? 'stepped out…'
      : p.status === 'in-game' ? `playing ${CATALOG_BY_ID[p.currentGame]?.name || ''}`
      : p.status === 'queued' ? `waiting for ${CATALOG_BY_ID[p.currentGame]?.name || ''}`
      : p.mood;
    const li = h('li', { 'data-pid': p.id },
      ava,
      h('div.who', {},
        h('div.nm', {}, p.name, p.id === L.me ? h('span.you', {}, '(you)') : null, p.id === L.hostId ? h('span.host', {}, ' ★ host') : null),
        h('div.mood' + (p.status === 'in-game' ? '.ingame' : p.status === 'queued' ? '.queued' : ''), {}, statusText)));
    if (p.id !== L.me && p.online) {
      li.append(h('button.btn.small.ghost.poke', { title: `Challenge ${p.name}`, 'aria-label': `Challenge ${p.name}`, html: ICONS.swords, on: { click: () => challenge(p) } }));
      li.lastChild.querySelector('svg').style.cssText = 'width:18px;height:18px';
    }
    return li;
  }));
  const me = L.players.find(p => p.id === L.me);
  if (me && E.moodSel.value !== me.mood) E.moodSel.value = me.mood;

  // feed
  const items = (L.feed || []).slice().reverse();
  E.feed.replaceChildren(...items.map(f => h('li.' + (f.kind || 'info'), {},
    f.kind === 'chat' ? [h('b', {}, f.from + ': '), f.text] : f.text)));
  const newest = items[0]?.time || 0;
  if (newest > state.lastFeedTime && state.lastFeedTime) {
    const f = items[0];
    if (f.kind === 'join') sfx('join');
    else if (f.kind === 'chat') sfx('paper');
  }
  state.lastFeedTime = newest;

  // cards
  const byPlayer = Object.fromEntries(L.players.map(p => [p.id, p]));
  for (const [id, c] of state.cards) {
    const g = CATALOG_BY_ID[id];
    const waiting = (L.queueMembers?.[id] || []).filter(pid => byPlayer[pid]);
    const mine = L.myQueue === id;
    const others = waiting.filter(pid => pid !== L.me);
    c.el.classList.toggle('mine', mine);
    c.el.classList.toggle('has-waiting', others.length > 0 && !mine);
    c.badge.hidden = waiting.length === 0;
    if (waiting.length) {
      c.badge.replaceChildren(
        h('span.faces', { html: waiting.slice(0, 4).map(pid => avatarSVG(byPlayer[pid].avatar)).join('') }),
        h('span', {}, `${waiting.length} waiting`));
    }
    const liveCount = (L.matches || []).filter(m => m.gameType === id).length;
    c.live.textContent = liveCount ? `· ${liveCount} game${liveCount > 1 ? 's' : ''} on now` : '';
    const full = !mine && waiting.length >= g.max;
    c.play.disabled = full || (!!L.myQueue && !mine && false);
    c.play.textContent = g.solo ? 'Open' : mine ? 'Leave queue' : full ? 'Full' : others.length ? `Join ${byPlayer[others[0]].name}` : 'Play';
    c.play.classList.toggle('red', mine);
  }
  if (state.lobbyEls) filterCards();
  renderSheet();
}

function renderSheet() {
  const L = state.lobby;
  const gid = L?.myQueue;
  if (!gid || state.match) { state.sheet?.remove(); state.sheet = null; return; }
  const g = CATALOG_BY_ID[gid];
  const byPlayer = Object.fromEntries(L.players.map(p => [p.id, p]));
  const waiting = (L.queueMembers[gid] || []).filter(pid => byPlayer[pid]);
  if (!state.sheet) { state.sheet = h('div.sheet-wrap'); document.body.append(state.sheet); sfx('paper'); }
  const seats = h('div.seats');
  for (let i = 0; i < g.max; i++) {
    const pid = waiting[i];
    seats.append(pid
      ? h('div.seat', {}, avatarEl(byPlayer[pid].avatar), byPlayer[pid].name)
      : h('div.seat.empty', {}, h('div.ring', {}, '?'), i < g.min ? 'needed' : 'open'));
  }
  const enough = waiting.length >= g.min;
  const need = enough
    ? (g.manual ? `${waiting.length} here — start whenever you're ready${waiting.length < g.max ? `, or wait for up to ${g.max}` : ''}.` : 'Starting…')
    : `Waiting for ${g.min - waiting.length} more classmate${g.min - waiting.length > 1 ? 's' : ''}. ${g.auto ? 'It starts by itself when the seats fill.' : ''}`;
  const row = h('div.row');
  if (g.manual && enough) row.append(h('button.btn.green', { on: { click: () => startQueue(gid, false) } }, 'Start game'));
  if (g.bots && !enough) row.append(h('button.btn.orange', { on: { click: () => startQueue(gid, true) } }, 'Fill empty seats with bots'));
  row.append(h('button.btn.ghost', { on: { click: () => { sfx('eraser'); net.req('leave-queue'); } } }, 'Leave'));
  row.append(h('button.btn.ghost.small', { on: { click: () => howTo(g) }, html: ICONS.help, 'aria-label': 'How to play' }));
  row.lastChild.querySelector('svg').style.cssText = 'width:18px;height:18px';
  state.sheet.replaceChildren(h('div.sheet.paper', { role: 'dialog', 'aria-label': `Waiting for ${g.name}` },
    h('h2', {}, `Waiting room: ${g.name}`),
    h('div.need' + (enough ? '.ok' : ''), {}, need),
    seats,
    h('div.note', { style: { font: '600 17px var(--f-note)', color: 'var(--ink-soft)' } }, `${g.min === g.max ? g.min : `${g.min}–${g.max}`} players. You can still browse and chat while you wait.`),
    row));
}

async function startQueue(gameType, fillBots) {
  sfx('tap');
  const res = await net.req('start-queue', { gameType, fillBots });
  if (!res.ok) toast(res.error, { tone: 'bad' });
}

function challenge(p) {
  modal((box, close) => {
    box.append(h('h2', {}, `Challenge ${p.name}`));
    box.append(h('p.note', { style: { font: '600 20px var(--f-note)' } }, 'Pick a game. You\'ll wait in its queue and they get a note.'));
    const list = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '8px' } });
    for (const g of CATALOG.filter(x => !x.solo)) {
      list.append(h('button.btn.small', { style: { '--c': g.color }, on: { click: async () => {
        close();
        const res = await net.req('challenge', { targetId: p.id, gameType: g.id });
        if (!res.ok) toast(res.error, { tone: 'bad' }); else { sfx('drum'); toast(`Challenge sent to ${p.name}!`); }
      } } }, g.name));
    }
    box.append(list);
  });
}

function react(kind) {
  sfx('react');
  net.req('react', { kind });
}

function openSettings() {
  sfx('page');
  modal((box) => {
    box.append(h('h2', {}, 'Settings'));
    const s = sound.s;
    const sw = (key, label, onChange) => {
      const input = h('input.switch', { type: 'checkbox', 'aria-label': label });
      input.checked = !!(key === 'calm' ? localStorage.getItem(calmKey) === '1' : s[key]);
      input.addEventListener('change', () => { onChange(input.checked); sfx('click'); });
      return h('label.setting-row', {}, h('span', {}, label), input);
    };
    const slider = (key, label) => {
      const input = h('input', { type: 'range', min: 0, max: 1, step: 0.05, 'aria-label': label });
      input.value = s[key];
      input.addEventListener('input', () => sound.set(key, Number(input.value)));
      input.addEventListener('change', () => sfx('tap'));
      return h('label.setting-row', {}, h('span', {}, label), input);
    };
    box.append(
      sw('on', 'Sound', v => sound.set('on', v)),
      slider('master', 'Master volume'),
      slider('sfx', 'Sound effects'),
      sw('musicOn', 'Background music (soft)', v => sound.set('musicOn', v)),
      slider('music', 'Music volume'),
      sw('calm', 'Calm mode (less motion, no confetti)', v => { localStorage.setItem(calmKey, v ? '1' : '0'); applyCalm(); })
    );
    // profile
    box.append(h('h2', { style: { fontSize: '30px', marginTop: '14px' } }, 'You'));
    const nameIn = h('input.field', { maxlength: 16, value: state.profile.name, 'aria-label': 'Nickname' });
    const pick = h('div.avatar-pick');
    let chosen = state.profile.avatar;
    for (const a of AVATARS) {
      const b = h('button', { type: 'button', title: a.name, 'aria-label': a.name, 'aria-pressed': String(a.id === chosen), html: avatarSVG(a.id) });
      b.addEventListener('click', () => { chosen = a.id; sfx('pop'); for (const x of pick.children) x.setAttribute('aria-pressed', String(x === b)); });
      pick.append(b);
    }
    const save = h('button.btn.green', {}, 'Save me');
    save.addEventListener('click', async () => {
      const res = await net.req('profile', { name: nameIn.value, avatar: chosen });
      if (res.ok) { state.profile = { name: res.name, avatar: chosen }; saveProfile(); toast('Updated!'); sfx('good'); }
      else toast(res.error, { tone: 'bad' });
    });
    box.append(nameIn, pick, save);
  });
}

async function leaveRoom() {
  if (!confirm('Leave this room? You can rejoin with the code.')) return;
  await net.leave();
  state.lobby = null;
  closeMatch();
  const u = new URL(location.href); u.searchParams.delete('room'); history.replaceState(null, '', u);
  renderWelcome();
}

// ═════════════════════════ MATCH SHELL ═════════════════════════
const modules = {};
async function loadModule(id) {
  if (!modules[id]) modules[id] = (await import(`./games/${id}.js`)).default;
  return modules[id];
}

async function openMatch(matchId, view) {
  const g = CATALOG_BY_ID[view.gameType];
  if (!g) return;
  closeMatch(true);
  state.match = { matchId, gameType: g.id, instance: null, view: null, loading: true };
  renderSheet();
  const root = $('#match');
  const title = h('div.title', {}, g.name);
  const back = h('button.btn.small.ghost', { html: `${ICONS.back}<span>Lobby</span>` });
  back.querySelector('svg').style.cssText = 'width:18px;height:18px';
  back.addEventListener('click', () => leaveMatch());
  const help = h('button.icon-btn', { title: 'How to play', 'aria-label': 'How to play', html: ICONS.help, on: { click: () => howTo(g) } });
  const soundBtn = h('button.icon-btn', { title: 'Sound on/off', 'aria-label': 'Toggle sound' });
  const paintSound = () => { soundBtn.innerHTML = sound.s.on ? ICONS.sound : ICONS.mute; };
  paintSound();
  soundBtn.addEventListener('click', () => { sound.set('on', !sound.s.on); paintSound(); sfx('click'); });
  const reacts = h('div.match-react', {}, REACTIONS.slice(0, 4).map(k => h('button', { 'aria-label': `React ${k}`, on: { click: () => react(k) } }, REACTION_EMOJI[k])));
  const strip = h('div.strip');
  const status = h('div.status-line', { role: 'status', 'aria-live': 'polite' }, 'Getting the desk ready…');
  const area = h('div.game-root');
  root.replaceChildren(h('div.match-bar', {}, back, title, reacts, help, soundBtn), strip, h('div.board-area', {}, status, area));
  show('match');
  sfx('start');

  const api = {
    me: state.me,
    game: g,
    now: () => net.now(),
    act: async (action, { quiet } = {}) => {
      const res = await net.req('game-action', { matchId, action });
      if (!res.ok && !quiet && res.error) { toast(res.error, { tone: 'bad', ms: 2200 }); sfx('bad'); }
      return res;
    },
    setStatus: (text, tone = '') => { status.textContent = text; status.className = 'status-line' + (tone ? ' ' + tone : ''); },
    setPlayers: (list) => renderStrip(strip, list),
    lobby: () => leaveMatch(),
    results: (opts) => results({ ...opts, actions: [...(opts.actions || []), { label: 'Back to lobby', cls: 'ghost', fn: () => leaveMatch() }] }),
    player: (id) => state.match?.view?.players?.find(p => p.id === id)
  };
  const mod = await loadModule(g.id);
  if (state.match?.matchId !== matchId) return;
  area.classList.add(`game-${g.id}`);
  state.match.instance = mod.mount(area, api);
  state.match.loading = false;
  if (!localStorage.getItem(`recess_seen_${g.id}`)) { localStorage.setItem(`recess_seen_${g.id}`, '1'); howTo(g); }
  if (view) updateMatch(matchId, view);
}

function renderStrip(strip, list) {
  strip.replaceChildren(...list.map(p => {
    const ava = avatarEl(p.avatar);
    const el = h('div.pcard' + (p.active ? '.active' : '') + (p.left ? '.left' : ''), { 'data-pid': p.id, style: p.color ? { '--pc': p.color } : {} },
      ava,
      h('div', {}, h('div.nm', {}, p.name, p.isBot ? h('span.bot', {}, 'BOT') : null), p.sub ? h('div.sub', {}, p.sub) : null),
      p.score !== undefined && p.score !== null ? h('div.score', {}, p.score) : null);
    return el;
  }));
}

function updateMatch(matchId, view) {
  const m = state.match;
  if (!m || m.matchId !== matchId) return;
  const prev = m.view;
  m.view = view;
  if (!m.instance) return;
  m.instance.update(view, prev);
  if (view.abandoned && !prev?.abandoned) {
    results({ title: 'Game over', sub: `${view.abandoned.by} left, so this game can't carry on.`, tone: 'draw', actions: [{ label: 'Back to lobby', fn: () => leaveMatch() }] });
  }
}

async function leaveMatch() {
  const m = state.match;
  sfx('page');
  closeMatch();
  show('lobby');
  if (m) await net.req('leave-match', { matchId: m.matchId });
}

function closeMatch(keepScreen) {
  const m = state.match;
  if (m?.instance) { try { m.instance.destroy?.(); } catch {} }
  state.match = null;
  document.querySelectorAll('.modal-back.result, .modal-back').forEach(b => { if (b.querySelector('.result-card')) b.remove(); });
  if (!keepScreen) $('#match').replaceChildren();
}

// ═════════════════════════ NETWORK EVENTS ═════════════════════════
net.addEventListener('lobby-state', (e) => {
  const prevQueue = state.lobby?.myQueue;
  state.lobby = e.detail.view;
  if (!state.me) state.me = state.lobby.me;
  if ($('#welcome').classList.contains('active') || $('#boot').classList.contains('active')) { buildLobby(); show(state.match ? 'match' : 'lobby'); }
  renderLobby();
  if (state.lobby.myQueue && !prevQueue) sfx('paper');
});

net.addEventListener('game-state', (e) => {
  const { matchId, view } = e.detail;
  if (!state.match || state.match.matchId !== matchId) {
    if (state.match?.loading) return;
    openMatch(matchId, view);
    return;
  }
  if (state.match.loading) { state.match.pendingView = view; return; }
  updateMatch(matchId, view);
});

net.addEventListener('reaction', (e) => {
  const { playerId, kind } = e.detail;
  const anchor = document.querySelector(`#match.active .pcard[data-pid="${playerId}"] .ava`) ||
    document.querySelector(`#lobby.active .roster li[data-pid="${playerId}"] .ava`);
  if (!anchor) return;
  floatReaction(kind, anchor);
  sfx('react');
});

net.addEventListener('challenge', (e) => {
  const { from, gameType } = e.detail;
  const g = CATALOG_BY_ID[gameType];
  sfx('drum');
  toast(`${from.name} challenged you to ${g.name}!`, {
    ms: 15000, actionLabel: 'Accept',
    action: async () => {
      if (state.match) { toast('Finish your game first!'); return; }
      const res = await net.req('accept-challenge', { fromId: from.id, gameType });
      if (!res.ok) toast(res.error, { tone: 'bad' });
    }
  });
});

net.addEventListener('kicked', (e) => { toast(e.detail.reason, { tone: 'bad', ms: 8000 }); net.stopped = true; });

net.addEventListener('status', (e) => {
  const { state: s } = e.detail;
  const c = state.lobbyEls?.conn;
  if (c) {
    c.classList.toggle('bad', s !== 'online');
    c.lastChild.textContent = s === 'online' ? 'Connected' : 'Reconnecting…';
  }
  if (s === 'offline' && e.detail.was) toast('Lost the connection — trying to reconnect…', { tone: 'bad', ms: 3000 });
  if (s === 'offline' && e.detail.reason === 'file') renderWelcome();
});

net.addEventListener('ready', () => { if ($('#boot').classList.contains('active')) renderWelcome(); });
net.addEventListener('resumed', (e) => {
  state.me = e.detail.playerId;
  if (!$('#lobby').classList.contains('active') && !$('#match').classList.contains('active')) { buildLobby(); show('lobby'); }
});
net.addEventListener('session-lost', (e) => {
  state.lobby = null;
  closeMatch();
  renderWelcome(e.detail.error || 'That room has closed.');
});

// Pending view while a module loads
setInterval(() => {
  const m = state.match;
  if (m && !m.loading && m.pendingView) { const v = m.pendingView; m.pendingView = null; updateMatch(m.matchId, v); }
}, 100);

net.connect();
if (location.protocol === 'file:') renderWelcome();
