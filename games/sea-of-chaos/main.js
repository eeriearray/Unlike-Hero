import { createMatch, step, aimBroadside, botControl, RULES, POWERS } from './plunder.js';
import { TEAMS, ISLANDS, SEA, BANK_RADIUS, forward, starboard } from './sea-map.js';
import { makeView } from './view.js';
import { unlockAudio, sound, pauseAudio, toggleMute, toggleMusic, isMusicOn, isEffectsOn, musicScene, seaAudio } from './audio.js';
import { connect, roomCode, snapshot, readSnapshot } from './network.js';
import { createInput } from './input.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const hub = window.Hub?.init({ id: 'sea-of-chaos', version: '6.0.0' });
const uid = `captain-${Math.random().toString(36).slice(2, 10)}`;
const BOT_NAMES = ['Salty Meg', 'One-Eyed Jo', 'Barnacle Bill', 'Red Ruth', 'Cap\'n Pike'];

let view;
try { view = makeView($('sea')); } catch (e) { $('menu-note').textContent = 'This device could not start WebGL. Enable hardware acceleration and reload.'; document.querySelectorAll('#solo,#host,#join').forEach(b => b.disabled = true); throw e; }
const input = createInput($('sea'), unlockAudio);

let mode = 'menu', role = 'solo', room = null, code = '', world = null, size = Number(store.get('soc-size', '2')) || 2;
let roster = [], members = new Map(), hostId = null, myId = uid, controls = {}, eventSeen = 0, paused = false;
let lastFrame = performance.now(), acc = 0, lastSend = 0, lastHud = 0, bannerUntil = 0, hintLock = 0, startedAt = 0;
let name = store.get('soc-name', 'Captain');
$('name').value = name; $('format').value = String(size);
$('format').onchange = () => { size = Number($('format').value); store.set('soc-size', String(size)); };

function setMode(m) {
 mode = m; paused = false; acc = 0;
 if (m === 'menu') demo = null;
 for (const id of ['menu', 'lobby', 'end']) $(id).classList.toggle('hidden', m !== id);
 $('hud').classList.toggle('hidden', m !== 'game');
 $('pause-screen').classList.add('hidden'); $('help-screen').classList.add('hidden');
 input.setMode(m === 'game' ? 'game' : m);
 musicScene(m === 'game', 0.25, 'opening');
}
function readName() { name = $('name').value.trim().slice(0, 16) || 'Captain'; store.set('soc-name', name); unlockAudio(); }
function crew(humans) {
 const list = humans.slice(0, size * 2).map(p => ({ id: p.id, name: p.name, ai: false }));
 let k = 0; while (list.length < size * 2) list.push({ id: `bot-${list.length}`, name: BOT_NAMES[k++ % BOT_NAMES.length], ai: true });
 return list;
}

// ---------- Match start ----------
function startMatch(captains, seed) {
 world = createMatch(captains, { seed });
 controls = {}; eventSeen = 0; startedAt = performance.now();
 view.reset(); $('feed').innerHTML = ''; $('floaters').innerHTML = '';
 setMode('game');
 const me = world.ships.find(s => s.id === myId);
 if (me) banner(`You sail for <span style="color:${TEAMS[me.team].color}">${TEAMS[me.team].name}</span>`, 'Grab treasure · bank it at your harbor', 3);
 hub?.report('session-start', { mode: role, players: captains.filter(c => !c.ai).length });
}
$('solo').onclick = () => { leave(); readName(); role = 'solo'; myId = uid; startMatch(crew([{ id: uid, name }]), Date.now()); world.t = Math.min(START_AT, world.duration - 5); };

// ---------- Rooms ----------
function renderLobby() {
 $('room-code').textContent = code;
 $('roster').innerHTML = crew(roster).map((p, i) => `<div class="t${i % 2}">${esc(p.name)}${p.id === myId ? ' · you' : ''}${p.ai ? ' · bot' : ''}</div>`).join('');
 $('lobby-note').textContent = role === 'host' ? `${roster.length} captain${roster.length > 1 ? 's' : ''} aboard · ${size}v${size}` : 'Waiting for the host to start…';
 $('start').classList.toggle('hidden', role !== 'host');
}
function publishLobby() { room?.emit('lobby', { players: roster, code, size }); renderLobby(); }
$('host').onclick = () => {
 leave(); readName(); role = 'host'; myId = uid; code = roomCode(); roster = [{ id: uid, name }];
 room = connect(code, {
  hello: (d, meta) => {
   if (!meta?.id || typeof d?.name !== 'string') return;
   if (!members.has(meta.id)) { if (members.size >= size * 2 - 1) { room.emitTo(meta.id, 'full', {}); return; } members.set(meta.id, { id: meta.id, name: d.name.slice(0, 16) || 'Captain' }); }
   room.emitTo(meta.id, 'identity', { id: meta.id });
   if (mode === 'game') { room.emitTo(meta.id, 'inprogress', {}); return; }
   if (!roster.some(p => p.id === meta.id)) roster.push(members.get(meta.id));
   publishLobby();
  },
  input: (d, meta) => { if (members.has(meta.id) && d && typeof d === 'object') controls[meta.id] = d; },
  peers: peers => {
   const ids = new Set(peers.map(p => p.id));
   for (const id of [...members.keys()]) if (!ids.has(id)) {
    members.delete(id); roster = roster.filter(p => p.id !== id);
    const ship = world?.ships.find(s => s.id === id); if (ship && mode === 'game') { ship.ai = true; ship.name += ' (bot)'; }
   }
   if (mode === 'lobby') publishLobby();
  },
 });
 if (!room) { $('menu-note').textContent = 'Online play is unavailable here. Bots are ready though!'; return; }
 setMode('lobby'); renderLobby();
};
$('join').onclick = () => {
 const entered = $('code').value.trim().toUpperCase();
 if (!/^[A-Z]{4}$/.test(entered)) { $('menu-note').textContent = 'Enter the four-letter room code.'; return; }
 leave(); readName(); role = 'client'; code = entered; hostId = null; myId = uid; roster = [{ id: uid, name }];
 room = connect(code, {
  identity: (d, m) => { if (!hostId || m.id === hostId) { hostId = m.id; myId = d.id; } },
  lobby: (d, m) => { if (hostId && hostId !== m.id) return; hostId = m.id; roster = d.players || []; size = d.size || size; renderLobby(); },
  start: (d, m) => { if (m.id !== hostId || !d?.captains) return; size = d.size || size; startMatch(d.captains, d.seed); },
  snap: (packet, m) => { if (role !== 'client' || m.id !== hostId || mode !== 'game') return; const d = readSnapshot(packet); if (!d) return; world = d; handleEvents(d.events); },
  inprogress: () => { $('lobby-note').textContent = 'A match is under way. You will join the next one.'; },
  full: () => { $('lobby-note').textContent = 'This room is full.'; },
  closing: (_, m) => { if (m.id === hostId) { leave(); setMode('menu'); $('menu-note').textContent = 'The host left. Create or join another room.'; } },
 });
 if (!room) { $('menu-note').textContent = 'Online play is unavailable here.'; return; }
 setMode('lobby'); renderLobby(); $('lobby-note').textContent = 'Looking for the host…';
 hello();
};
function hello() { room?.emit('hello', { name }); }
function hostStart() { const captains = crew(roster), seed = Date.now(); room.emit('start', { captains, seed, size }); startMatch(captains, seed); }
$('start').onclick = hostStart;
function leave() { if (role === 'host') room?.emit('closing', {}); room?.leave(); room = null; members.clear(); hostId = null; controls = {}; }
function port() { leave(); setMode('menu'); }
$('back').onclick = port; $('menu-btn').onclick = port; $('quit').onclick = port;
$('again').onclick = () => { unlockAudio(); if (role === 'host') hostStart(); else if (role === 'solo') startMatch(crew([{ id: uid, name }]), Date.now()); else $('winner').textContent = 'Waiting for the host…'; };

// ---------- Pause & help ----------
function togglePause() {
 if (mode !== 'game') return;
 if (!$('help-screen').classList.contains('hidden')) { closeHelp(); return; }
 paused = !paused; input.setMode(paused ? 'paused' : 'game');
 $('pause-screen').classList.toggle('hidden', !paused);
 $('pause-note').textContent = role === 'solo' ? 'The sea waits for you.' : 'The match keeps going while you are anchored.';
 pauseAudio(paused && role === 'solo');
}
input.onEscape(togglePause); $('pause').onclick = togglePause; $('resume').onclick = togglePause;
function openHelp() { $('help-screen').classList.remove('hidden'); $('help-close').focus(); }
function closeHelp() { $('help-screen').classList.add('hidden'); store.set('soc-help-v6', '1'); }
$('how-to').onclick = openHelp; $('help').onclick = openHelp; $('help-close').onclick = closeHelp;
function audioButtons() { document.querySelectorAll('[data-audio]').forEach(b => { const music = b.dataset.audio === 'music', on = music ? isMusicOn() : isEffectsOn(); b.textContent = `${music ? 'Music' : 'Sound'} ${on ? 'on' : 'off'}`; b.setAttribute('aria-pressed', String(on)); }); }
document.querySelectorAll('[data-audio]').forEach(b => b.onclick = () => { unlockAudio(); if (b.dataset.audio === 'music') toggleMusic(); else toggleMute(); audioButtons(); });
audioButtons();

// ---------- Feedback ----------
function banner(html, sub = '', seconds = 2.2) { $('banner').innerHTML = html + (sub ? `<small>${sub}</small>` : ''); $('banner').classList.remove('on'); void $('banner').offsetWidth; $('banner').classList.add('on'); bannerUntil = performance.now() + seconds * 1000; }
function feed(html) { const d = document.createElement('div'); d.innerHTML = html; $('feed').prepend(d); while ($('feed').children.length > 4) $('feed').lastChild.remove(); setTimeout(() => d.remove(), 6000); }
function floater(text, x, y, z, cls = '') {
 const p = view.project(x, y, z); if (!p.visible) return;
 const d = document.createElement('div'); d.className = cls; d.textContent = text; d.style.left = `${p.x}px`; d.style.top = `${p.y}px`;
 $('floaters').append(d); setTimeout(() => d.remove(), 1200);
}
const who = id => { if (id === 'whirlpool') return '<b style="color:#7fe3ff">a whirlpool</b>'; if (id === 'galleon') return '<b style="color:#ffd34d">the galleon</b>'; if (String(id).startsWith('tower')) return '<b>harbor tower</b>'; const s = world.ships.find(s => s.id === id); return s ? `<b style="color:${TEAMS[s.team].color}">${s.id === myId ? 'You' : esc(s.name)}</b>` : 'someone'; };
function panFor(x, z) { const me = world.ships.find(s => s.id === myId); if (!me) return { pan: 0, vol: 1 }; const sb = starboard(me.a), dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz); return { pan: Math.max(-1, Math.min(1, (dx * sb.x + dz * sb.z) / 50)), vol: Math.max(0, 1 - d / 120), d }; }

function handleEvents(events = []) {
 for (const e of events) {
  if (e.n <= eventSeen) continue;
  eventSeen = e.n;
  view.event(e, world, myId);
  const me = world.ships.find(s => s.id === myId), mine = e.id === myId;
  const at = e.x !== undefined ? panFor(e.x, e.z) : { pan: 0, vol: 1 };
  switch (e.type) {
   case 'fire': if (at.vol > 0) sound('shot-ball', at.pan, mine ? 1 : at.vol * 0.7); break;
   case 'hit': if (at.vol > 0) sound('hit', at.pan, mine || e.by === myId ? 1 : at.vol * 0.6); if (e.by === myId) floater(e.id === 'galleon' ? '-11' : 'HIT!', e.x, 6, e.z, 'bad'); break;
   case 'splash': if (at.vol > 0.4) sound('splash', at.pan, at.vol * 0.4); break;
   case 'sink': {
    sound('sink', at.pan, Math.max(0.4, at.vol));
    const victim = world.ships.find(s => s.id === e.id);
    feed(e.by === 'whirlpool' ? `${who(e.id)} ${mine ? 'were' : 'was'} swallowed by ${who('whirlpool')}${e.gold ? ` · <span style="color:#ffd34d">◉ ${e.gold} swirling in it</span>` : ''}` : `${who(e.by)} sank ${who(e.id)}${e.gold ? ` · <span style="color:#ffd34d">◉ ${e.gold} spilled</span>` : ''}`);
    if (mine) { banner(e.by === 'whirlpool' ? 'SWALLOWED!' : 'SUNK!', e.by === 'whirlpool' ? 'The whirlpool dragged you under' : e.gold ? `Your ${e.gold} gold spilled into the sea` : 'Back afloat in a moment', 2.4); sound(e.by === 'whirlpool' ? 'whirlpool' : 'defeat'); }
    else if (e.by === myId) banner(`You sank ${esc(victim?.name || 'them')}!`, 'Scoop up the gold they dropped', 2.2);
    break;
   }
   case 'respawn': if (mine) { sound('respawn'); banner('Back afloat', 'Your harbor protects you for a few seconds', 1.6); } break;
   case 'loot': if (mine) { sound('gold', 0, 0.8); floater(`+${e.gold}`, e.x, 4, e.z); } break;
   case 'power': if (mine) { sound('purchase'); banner(POWERS[e.kind].name, POWERS[e.kind].note, 1.6); } break;
   case 'bank': {
    if (mine) { sound('goal'); const s = world.ships.find(s => s.id === myId); if (s) floater(`+${e.gold} BANKED${e.double ? ' ×2' : ''}`, s.x, 8, s.z, 'big'); }
    else if (me && e.team === me.team) sound('gold', 0, 0.5);
    if (e.gold >= 20 && !mine) feed(`${who(e.id)} banked <span style="color:#ffd34d">◉ ${e.gold}</span>`);
    break;
   }
   case 'galleon': sound('sudden'); banner('⚓ TREASURE GALLEON!', 'Sink it for a hoard of chests · follow ☠ on the chart', 3.2); break;
   case 'galleonsunk': sound('corebroken'); banner(`${e.team >= 0 ? TEAMS[e.team].name : 'Someone'} sank the galleon!`, 'Treasure everywhere. Grab it!', 2.6); feed(`${who(e.by)} sank ${who('galleon')}`); break;
   case 'galleonescaped': feed('The galleon escaped with its gold'); break;
   case 'final': sound('sudden'); banner('FINAL 30 SECONDS', 'Banked gold now counts DOUBLE', 3); break;
   case 'tower': if (me && e.team !== me.team && at.vol > 0) sound('sentry', 0, 0.7); break;
   case 'whirlpool': if (mine) { sound('whirlpool'); banner('WHIRLPOOL!', TOUCH ? 'Tap Boost and steer out, or it will sink you' : 'Shift to boost out, or it will sink you', 1.8); sound('warning'); } else if (at.vol > 0.3) sound('whirlpool', at.pan, at.vol * 0.5); break;
   case 'boost': if (mine) sound('boost'); break;
   case 'bump': if (mine) sound('collision'); break;
   case 'end': endMatch(); break;
  }
 }
}

function endMatch() {
 if (mode !== 'game') return;
 if (role === 'host') room?.emit('snap', snapshot(world));
 const me = world.ships.find(s => s.id === myId), won = me && world.winner === me.team;
 sound(world.winner === -1 ? 'warning' : won ? 'victory' : 'defeat');
 setMode('end');
 $('winner').textContent = world.winner === -1 ? 'A dead heat!' : `${TEAMS[world.winner].name} wins!${me ? (won ? ' Yo ho ho!' : ' Better luck next tide.') : ''}`;
 $('final-score').innerHTML = world.teams.map(t => `<span class="t${t.id}">${t.score}</span>`).join('<span>–</span>');
 const rows = [...world.ships].sort((a, b) => b.banked - a.banked);
 $('captains').innerHTML = '<tr><th>Captain</th><th>Gold banked</th><th>Ships sunk</th></tr>' + rows.map(s => `<tr class="${s.id === myId ? 'me' : ''}"><td><span class="dot" style="background:${TEAMS[s.team].color}"></span>${esc(s.name)}${s.id === myId ? ' (you)' : ''}</td><td>${s.banked}</td><td>${s.sinks}</td></tr>`).join('');
 $('again').textContent = role === 'client' ? 'Waiting for host…' : 'Play again';
 hub?.report('session-end', { won: !!won });
}

// ---------- HUD ----------
const chart = $('map').getContext('2d');
function drawChart(w, me) {
 const c = chart, R = 160, k = R / (SEA + 20);
 c.clearRect(0, 0, 320, 320); c.save(); c.beginPath(); c.arc(R, R, R, 0, Math.PI * 2); c.clip();
 c.fillStyle = '#0f5a6e'; c.fillRect(0, 0, 320, 320);
 // Heading-up chart centered on the sea; your ship's heading points up.
 const a = me ? me.a : Math.PI / 2, f = forward(a), sb = starboard(a);
 const P = (x, z) => [R + (x * sb.x + z * sb.z) * k, R - (x * f.x + z * f.z) * k];
 const dot = (x, z, r, color, stroke) => { const [px, py] = P(x, z); c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fillStyle = color; c.fill(); if (stroke) { c.lineWidth = 2; c.strokeStyle = stroke; c.stroke(); } };
 c.beginPath(); const [ox, oy] = P(0, 0); c.arc(ox, oy, 140 * k, 0, Math.PI * 2); c.strokeStyle = '#ffffff30'; c.lineWidth = 2; c.stroke();
 for (const t of TEAMS) { dot(t.x, t.z, BANK_RADIUS * k, t.color + '55', t.color); }
 for (const i of ISLANDS) dot(i.x, i.z, i.r * k, i.kind === 'wreck' ? '#6b5a44' : '#e8d39a');
 for (const l of w.loot) dot(l.x, l.z, l.kind === 'chest' ? 4 : 3, '#ffd34d');
 for (const p of w.powers) dot(p.x, p.z, 4, '#ffffff');
 for (const h of w.whirls || []) { const [hx, hy] = P(h.x, h.z); c.beginPath(); c.arc(hx, hy, h.r * k, 0, Math.PI * 2); c.strokeStyle = '#9fe9ff'; c.lineWidth = 2; c.setLineDash([4, 4]); c.stroke(); c.setLineDash([]); c.beginPath(); c.arc(hx, hy, 3, 0, Math.PI * 2); c.fillStyle = '#063040'; c.fill(); }
 if (w.galleon && !w.galleon.dead) { const [gx, gy] = P(w.galleon.x, w.galleon.z); c.font = '900 22px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffd34d'; c.strokeStyle = '#000'; c.lineWidth = 4; c.strokeText('☠', gx, gy); c.fillText('☠', gx, gy); }
 for (const s of w.ships) if (!s.dead && s.id !== myId) dot(s.x, s.z, 6, TEAMS[s.team].color, s.gold > 15 ? '#ffd34d' : '#0008');
 if (me && !me.dead) { const [mx, my] = P(me.x, me.z); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(mx, my - 11); c.lineTo(mx + 7, my + 7); c.lineTo(mx - 7, my + 7); c.closePath(); c.fill(); c.strokeStyle = TEAMS[me.team].color; c.lineWidth = 2; c.stroke(); }
 c.restore();
}
const clock = t => { const s = Math.max(0, Math.ceil(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const TOUCH = matchMedia('(pointer:coarse)').matches;
const KEYS = TOUCH ? { steer: 'Steer with the stick', fire: 'tap FIRE', boost: 'tap Boost' } : { steer: 'Steer with <kbd>A</kbd> <kbd>D</kbd>', fire: '<kbd>Space</kbd> / click to FIRE', boost: '<kbd>Shift</kbd> boost' };
function hint(w, me) {
 if (!me) return '';
 if (me.dead) return `Sunk! Back afloat in ${Math.max(1, Math.ceil(me.respawnIn))}…`;
 const home = TEAMS[me.team], homeD = Math.hypot(me.x - home.x, me.z - home.z);
 if ((w.whirls || []).some(h => Math.hypot(h.x - me.x, h.z - me.z) < h.r)) return `Being dragged under! ${KEYS.boost} and steer away from the eye`;
 if (performance.now() - startedAt < 9000) return `${KEYS.steer} · sail through the glowing treasure`;
 const aim = aimBroadside(w, me);
 if (aim && aim.d < RULES.range) return me.reload <= 0 ? `Target alongside! ${KEYS.fire}` : 'Reloading…';
 if (me.gold > 0 && homeD > BANK_RADIUS) return `Carrying ◉ ${me.gold}. Follow the gold arrow home to bank it${w.final ? ' (×2!)' : ''}`;
 if (w.galleon && !w.galleon.dead) return 'Treasure galleon! Get alongside it and fire (☠ on the chart)';
 const enemy = w.ships.find(s => !s.dead && s.team !== me.team && Math.hypot(s.x - me.x, s.z - me.z) < 90);
 if (enemy) return 'Turn so the rival is beside you, then fire';
 return 'Find treasure: gold dots on the chart';
}
function updateHud(w) {
 const me = w.ships.find(s => s.id === myId);
 $('timer').textContent = clock(w.duration - w.t);
 $('clock-note').textContent = w.final ? 'BANKED GOLD ×2' : w.galleon && !w.galleon.dead ? '☠ GALLEON AT SEA' : 'Most banked gold wins';
 $('hud').classList.toggle('final', !!w.final);
 for (const t of w.teams) {
  $(`score${t.id}`).textContent = t.score;
  const el = document.querySelector(`.team.t${t.id}`); el.classList.toggle('mine', me?.team === t.id); el.classList.toggle('lead', t.score > w.teams[1 - t.id].score);
 }
 if (me) {
  const hp = Math.max(0, me.hp); $('hull-bar').style.width = `${hp}%`; $('hull-bar').classList.toggle('low', hp < 35);
  $('gold').textContent = me.gold; $('me').classList.toggle('rich', me.gold >= 20);
  $('cargo-note').textContent = me.gold ? 'lost if you sink!' : 'bank it at home';
  const tags = [];
  if (me.power) tags.push(`<span>${POWERS[me.power].name} ${Math.ceil(me.powerFor)}s</span>`);
  tags.push(me.boostCd <= 0 ? '<span class="ready">Boost ready</span>' : `<span>Boost ${Math.ceil(me.boostCd)}s</span>`);
  if (me.shield > 0 && !me.dead) tags.push('<span>Protected</span>');
  $('status').innerHTML = tags.join('');
 }
 $('hint').innerHTML = hint(w, me);
 drawChart(w, me);
 if (performance.now() > bannerUntil) $('banner').classList.remove('on');
 // Music follows the action: calm while sailing, battle near cannon fire.
 const busy = me && !me.dead && w.ships.some(s => !s.dead && s.team !== me.team && Math.hypot(s.x - me.x, s.z - me.z) < 60);
 seaAudio(me?.v || 0, busy ? 0.75 : 0.3, false, w.final ? 'finale' : busy ? 'raid' : 'voyage');
}

// ---------- Loop ----------
// Play-testing switches: ?autopilot lets the bot brain steer you, ?at=SECONDS starts a solo match later.
const params = new URLSearchParams(location.search), AUTOPILOT = params.has('autopilot'), START_AT = Number(params.get('at')) || 0;
const DT = 1 / 30, IDLE = { ships: [], shots: [], loot: [], powers: [], teams: [] };
if (AUTOPILOT) window.socWorld = () => world; // console access while play-testing
let demo = null, demoAcc = 0, demoSeen = 0, demoSwitch = 0, demoFollow = '';
function frame(now) {
 const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
 if (mode === 'game' && world) {
  if (role === 'client') {
   if (now - lastSend > 50) { room?.emit('input', input.read()); lastSend = now; }
  } else if (!(paused && role === 'solo')) {
   acc += dt;
   while (acc >= DT) {
    const me = world.ships.find(s => s.id === myId);
    const c = { ...controls, [myId]: AUTOPILOT && me ? botControl(world, me) : input.read() };
    step(world, c, DT); acc -= DT;
   }
   handleEvents(world.events);
   if (role === 'host' && now - lastSend > 100) { room?.emit('snap', snapshot(world)); lastSend = now; }
  }
  if (now - lastHud > 90) { updateHud(world); lastHud = now; }
 }
 if (mode === 'menu' && !document.hidden) {
  // Behind the menu a bot crew plays a match, so new captains see the game first.
  if (!demo || demo.phase !== 'play') { demo = createMatch(crew([]), { seed: Date.now() }); view.reset(); demoSeen = demoSwitch = 0; }
  demoAcc += dt; while (demoAcc >= DT) { step(demo, {}, DT); demoAcc -= DT; }
  for (const e of demo.events) if (e.n > demoSeen) { demoSeen = e.n; view.event(e, demo, ''); }
  if (demo.t > demoSwitch) { demoSwitch = demo.t + 12; demoFollow = demo.ships[Math.floor(Math.random() * demo.ships.length)].id; }
  view.draw(demo, '', dt, demo.galleon && !demo.galleon.dead ? 'galleon' : demoFollow);
 } else view.draw(world || IDLE, myId, dt);
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setMode('menu');
addEventListener('beforeunload', () => leave());
