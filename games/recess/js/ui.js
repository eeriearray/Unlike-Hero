// Small DOM helpers and shared UI pieces (modals, toasts, results, effects) for RECESS.
import { sfx } from './audio.js';
import { avatarSVG, trophySVG, ICONS } from './art.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** h('div.class#id', { attrs, on: { click } }, ...children) */
export function h(tag, props = {}, ...kids) {
  const [, name = 'div', rest = ''] = tag.match(/^([a-z0-9-]*)(.*)$/i);
  const el = document.createElement(name || 'div');
  for (const part of rest.match(/[.#][^.#]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
  }
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { kids.unshift(props); props = {}; }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'class') el.className += ' ' + v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function svgEl(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

// ─── toasts ───
export function toast(text, { tone = '', action, actionLabel, ms = 3800 } = {}) {
  let wrap = $('.toasts');
  if (!wrap) { wrap = h('div.toasts', { role: 'status', 'aria-live': 'polite' }); document.body.append(wrap); }
  const t = h('div.toast.sticky' + (tone ? '.' + tone : ''), {}, h('span', {}, text));
  if (action) t.append(h('button.btn.small', { on: { click: () => { action(); t.remove(); } } }, actionLabel || 'OK'));
  wrap.append(t);
  setTimeout(() => t.remove(), ms);
  return t;
}

// ─── modals ───
export function modal(build, { onClose, className = '' } = {}) {
  const back = h('div.modal-back');
  const box = h('div.modal.paper' + (className ? '.' + className : ''), { role: 'dialog', 'aria-modal': 'true' });
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  box.append(h('button.icon-btn.close', { 'aria-label': 'Close', html: ICONS.x, on: { click: () => { sfx('click'); close(); } } }));
  build(box, close);
  back.append(box);
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(back);
  box.querySelector('button:not(.close), input')?.focus({ preventScroll: true });
  return { close, box };
}

export function howTo(game) {
  sfx('page');
  modal((box) => {
    box.append(h('h2', {}, `How to play ${game.name}`));
    box.append(h('ol', {}, game.rules.map(r => h('li', {}, r))));
    box.append(h('p.note', { style: { font: '600 18px var(--f-note)', color: 'var(--ink-soft)' } },
      game.solo ? 'A desk toy for one — share your result with the room if you dare.' : `${game.min === game.max ? game.min : `${game.min}–${game.max}`} players.`));
  });
}

// ─── results ───
/**
 * opts: { title, sub, tone: 'win'|'lose'|'draw', board: [{ id, name, avatar, pts, win }], actions: [{ label, cls, fn }] }
 */
export function results(opts) {
  const { title, sub, tone = 'win', board = [], actions = [] } = opts;
  sfx(tone === 'win' ? 'win' : tone === 'draw' ? 'draw' : 'lose');
  if (tone === 'win') confetti();
  return modal((box, close) => {
    box.classList.add('result-card');
    if (tone === 'win') box.append(svgEl(trophySVG()));
    box.append(h('h2', {}, title));
    if (sub) box.append(h('p.sub', {}, sub));
    if (board.length) {
      box.append(h('ol.result-board', {}, board.map(b => h('li' + (b.win ? '.win' : ''), {},
        h('div.ava', { html: avatarSVG(b.avatar) }), h('span', {}, b.name), h('span.pts', {}, b.pts)))));
    }
    box.append(h('div.result-actions', {}, actions.map(a => h('button.btn' + (a.cls ? '.' + a.cls : ''), { on: { click: () => { sfx('click'); close(); a.fn(); } } }, a.label))));
  }, { className: 'result' });
}

// ─── effects ───
export function confetti(n = 70) {
  if (document.body.classList.contains('calm')) return;
  const box = h('div.confetti');
  const colors = ['#e0453a', '#2463d6', '#ffe15a', '#4cc9a0', '#ff9a3c', '#8a5be6', '#ef6aa8'];
  for (let i = 0; i < n; i++) {
    const p = h('i');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
    p.style.setProperty('--rot', (Math.random() * 900) + 'deg');
    p.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
    p.style.animationDelay = Math.random() * 0.5 + 's';
    if (i % 3 === 0) p.style.borderRadius = '50%';
    box.append(p);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 4200);
}

export function starBurst(x, y, n = 9) {
  if (document.body.classList.contains('calm')) return;
  const box = h('div.stars-burst', { style: { left: x + 'px', top: y + 'px' } });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const s = h('i');
    s.style.setProperty('--dx', Math.cos(a) * (40 + Math.random() * 30) + 'px');
    s.style.setProperty('--dy', Math.sin(a) * (40 + Math.random() * 30) + 'px');
    s.style.left = '-7px'; s.style.top = '-7px';
    box.append(s);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 800);
}

export function burstAt(el) {
  const r = el.getBoundingClientRect();
  starBurst(r.left + r.width / 2, r.top + r.height / 2);
}

export const REACTION_EMOJI = { laugh: '😂', wow: '😮', cry: '😭', party: '🥳', angry: '😤', cool: '😎' };

export function floatReaction(kind, anchor) {
  const r = anchor?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
  const f = h('div.floaty', {}, REACTION_EMOJI[kind] || '✨');
  f.style.left = r.left + r.width / 2 + 'px';
  f.style.top = r.top + 'px';
  document.body.append(f);
  setTimeout(() => f.remove(), 1700);
}

/** Countdown text for a server deadline. */
export function secondsLeft(deadline, now) { return Math.max(0, Math.ceil((deadline - now) / 1000)); }

/** Animate a numeric value between frames (used by replay players). */
export function lerp(a, b, t) { return a + (b - a) * t; }

export function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

export function nameList(names) {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : (names[0] || '');
}
