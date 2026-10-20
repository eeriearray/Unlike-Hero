// Hand-drawn style SVG art for RECESS: avatars, game card illustrations, icons.
import { AVATARS } from '../shared/avatars.js';

const INK = '#1d2b4f';
let uid = 0;

/** A schoolkid face. */
export function avatarSVG(id) {
  const a = AVATARS.find(x => x.id === id) || AVATARS[0];
  const { skin, hair, shirt, extra } = a;
  const k = `av${uid++}`;
  const hairShapes = {
    specs: `<path d="M18 40c-2-16 10-26 22-26s25 8 23 26c-6-8-14-11-23-11s-16 3-22 11z" fill="${hair}"/>`,
    plaits: `<path d="M17 42c-2-17 10-28 23-28s25 11 23 28c-4-9-12-14-23-14S21 33 17 42z" fill="${hair}"/>
      <path d="M17 40c-6 8-6 20-2 28M63 40c6 8 6 20 2 28" stroke="${hair}" stroke-width="7" stroke-linecap="round" fill="none"/>
      <circle cx="15" cy="69" r="4" fill="#e84393"/><circle cx="65" cy="69" r="4" fill="#e84393"/>`,
    cap: `<path d="M16 38c0-14 11-23 24-23s24 9 24 23z" fill="${shirt}" stroke="${INK}" stroke-width="2.5"/><path d="M40 37h30c2 0 2 4 0 4H40z" fill="${shirt}" stroke="${INK}" stroke-width="2.5"/><circle cx="40" cy="16" r="3" fill="#fff" stroke="${INK}" stroke-width="2"/>`,
    bow: `<path d="M17 44c-3-18 10-30 23-30s27 12 23 30c-3-12-12-17-23-17S20 32 17 44z" fill="${hair}"/><path d="M52 16l10-7v14zM52 16l-6-8-2 13z" fill="#ff5a8a" stroke="${INK}" stroke-width="2"/><circle cx="52" cy="16" r="3" fill="#ff5a8a" stroke="${INK}" stroke-width="2"/>`,
    spiky: `<path d="M17 40l2-12-4-4 9-1 1-8 8 5 7-8 6 8 8-5 1 8 9 1-4 4 2 12c-6-7-14-10-23-10s-16 3-22 10z" fill="${hair}"/>`,
    bun: `<circle cx="40" cy="12" r="8" fill="${hair}"/><path d="M17 42c-2-17 10-27 23-27s25 10 23 27c-5-9-13-13-23-13S22 33 17 42z" fill="${hair}"/>`,
    band: `<path d="M17 40c-2-16 10-26 23-26s25 10 23 26c-6-8-14-12-23-12S23 32 17 40z" fill="${hair}"/><path d="M17 33c14-6 32-6 46 0" stroke="#e53935" stroke-width="5" fill="none"/>`,
    curly: `<g fill="${hair}"><circle cx="22" cy="30" r="8"/><circle cx="31" cy="21" r="9"/><circle cx="44" cy="19" r="9"/><circle cx="56" cy="25" r="8"/><circle cx="60" cy="35" r="6"/><circle cx="19" cy="40" r="5"/></g>`,
    pencil: `<path d="M17 41c-2-17 10-27 23-27s25 10 23 27c-6-8-14-12-23-12S23 33 17 41z" fill="${hair}"/><g transform="rotate(-35 62 22)"><rect x="56" y="14" width="24" height="7" fill="#ffc83d" stroke="${INK}" stroke-width="2"/><path d="M80 14l7 3.5-7 3.5z" fill="#f2d2a9" stroke="${INK}" stroke-width="2"/><rect x="52" y="14" width="5" height="7" fill="#ff8fab" stroke="${INK}" stroke-width="2"/></g>`,
    headphones: `<path d="M17 41c-2-17 10-27 23-27s25 10 23 27c-6-8-14-12-23-12S23 33 17 41z" fill="${hair}"/><path d="M15 44c0-22 12-32 25-32s25 10 25 32" stroke="${INK}" stroke-width="4" fill="none"/><rect x="10" y="40" width="9" height="14" rx="4" fill="#ff7043" stroke="${INK}" stroke-width="2"/><rect x="61" y="40" width="9" height="14" rx="4" fill="#ff7043" stroke="${INK}" stroke-width="2"/>`
  };
  const specs = extra === 'specs'
    ? `<g fill="rgba(255,255,255,.4)" stroke="${INK}" stroke-width="2.5"><circle cx="31" cy="45" r="7"/><circle cx="49" cy="45" r="7"/></g><path d="M38 45h4" stroke="${INK}" stroke-width="2.5"/>`
    : '';
  return `<svg viewBox="0 0 80 80" aria-hidden="true">
    <defs><clipPath id="${k}"><circle cx="40" cy="40" r="38"/></clipPath></defs>
    <circle cx="40" cy="40" r="38" fill="#fff8e8"/>
    <g clip-path="url(#${k})">
      <path d="M8 84c2-14 15-20 32-20s30 6 32 20z" fill="${shirt}" stroke="${INK}" stroke-width="2.5"/>
      <path d="M33 64l7 7 7-7" fill="#fff" stroke="${INK}" stroke-width="2"/>
      <rect x="35" y="56" width="10" height="10" fill="${skin}"/>
      <ellipse cx="40" cy="44" rx="21" ry="22" fill="${skin}" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="19" cy="46" r="4" fill="${skin}" stroke="${INK}" stroke-width="2"/>
      <circle cx="61" cy="46" r="4" fill="${skin}" stroke="${INK}" stroke-width="2"/>
      ${hairShapes[extra] || hairShapes.specs}
      <circle cx="31" cy="45" r="2.6" fill="${INK}"/><circle cx="49" cy="45" r="2.6" fill="${INK}"/>
      <circle cx="26" cy="52" r="3.2" fill="#ff8a80" opacity=".45"/><circle cx="54" cy="52" r="3.2" fill="#ff8a80" opacity=".45"/>
      <path d="M33 54c4 4 10 4 14 0" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      ${specs}
    </g>
    <circle cx="40" cy="40" r="38" fill="none" stroke="${INK}" stroke-width="3"/>
  </svg>`;
}

export function avatarEl(id, { online = true, size } = {}) {
  const d = document.createElement('div');
  d.className = 'ava' + (online ? '' : ' offline');
  if (size) { d.style.width = d.style.height = size + 'px'; }
  d.innerHTML = avatarSVG(id);
  return d;
}

// ─── icons (stroke style) ───
const ic = (p, vb = 24) => `<svg viewBox="0 0 ${vb} ${vb}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const ICONS = {
  copy: ic('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  link: ic('<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>'),
  gear: ic('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  sound: ic('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 8a5 5 0 0 1 0 8M19.5 5.5a9 9 0 0 1 0 13"/>'),
  mute: ic('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  back: ic('<path d="M15 5l-7 7 7 7"/>'),
  door: ic('<path d="M14 4H6v16h8"/><path d="M10 12h10M17 9l3 3-3 3"/>'),
  help: ic('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>'),
  search: ic('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
  people: ic('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>'),
  bot: ic('<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6"/>'),
  swords: ic('<path d="M4 4l9 9M4 4h4M4 4v4M20 4l-9 9M20 4h-4M20 4v4M7 17l-3 3M17 17l3 3M9 15l-2 2M15 15l2 2"/>'),
  x: ic('<path d="M6 6l12 12M18 6L6 18"/>'),
  music: ic('<path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>')
};

export function paperclip() {
  return `<svg class="clip" viewBox="0 0 18 46" aria-hidden="true"><path d="M5 30V8a4 4 0 0 1 8 0v26a6 6 0 0 1-12 0V12" fill="none" stroke="#8a95a8" stroke-width="2.6" stroke-linecap="round"/></svg>`;
}

export function trophySVG() {
  return `<svg viewBox="0 0 120 120" class="trophy" aria-hidden="true">
    <g stroke="${INK}" stroke-width="3.5" stroke-linejoin="round">
      <path d="M38 18h44v22c0 16-10 28-22 28S38 56 38 40z" fill="#ffd34d"/>
      <path d="M38 26H24c0 14 6 22 16 24M82 26h14c0 14-6 22-16 24" fill="none"/>
      <path d="M54 68h12v14H54z" fill="#ffd34d"/>
      <path d="M40 82h40l4 14H36z" fill="#e0453a"/>
      <path d="M48 32l5 4 7-9 7 9 5-4-3 14H51z" fill="#fff" stroke-width="2.5"/>
    </g>
    <g fill="#ffe15a" stroke="${INK}" stroke-width="2"><path d="M14 64l3 6 6 1-5 4 1 7-5-3-6 3 1-7-5-4 7-1z"/><path d="M104 58l2 5 5 1-4 3 1 5-4-2-5 2 1-5-4-3 5-1z"/></g>
  </svg>`;
}

// ─── game card illustrations (viewBox 200x120) ───
const S = (s) => `<svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${s}</svg>`;
const grid = (gap = 12, col = 'rgba(36,99,214,.18)') => `<pattern id="g${gap}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse"><path d="M${gap} 0H0V${gap}" fill="none" stroke="${col}" stroke-width="1"/></pattern>`;

export const CARD_ART = {
  ttt: () => S(`<defs>${grid(12)}</defs><rect width="200" height="120" fill="url(#g12)"/>
    <g stroke="${INK}" stroke-width="4" stroke-linecap="round" fill="none">
      <path d="M78 16c1 30 0 60 2 90M120 14c-1 32 1 62 0 92M48 46c34-2 70 1 106-1M46 78c36 1 72-1 108 1"/></g>
    <g stroke="#e0453a" stroke-width="5" stroke-linecap="round"><path d="M56 22l14 16M70 22L56 38M92 56l16 16M108 56L92 72M134 88l14 14M148 88l-14 14"/></g>
    <g stroke="#2463d6" stroke-width="5" fill="none"><circle cx="100" cy="30" r="10"/><circle cx="140" cy="62" r="10"/></g>
    <path d="M52 26l100 82" stroke="#ffd34d" stroke-width="9" stroke-linecap="round" opacity=".55"/>`),
  sps: () => S(`<rect width="200" height="120" fill="#fff4e0"/>
    <path d="M22 86c-6-18 6-36 22-36 14 0 30 8 30 26 0 14-12 20-28 20-12 0-22-2-24-10z" fill="#9ea7b5" stroke="${INK}" stroke-width="3.5"/>
    <path d="M36 70c4-2 10-2 14 2M46 82c4 0 8-2 10-4" stroke="${INK}" stroke-width="2" fill="none" opacity=".5"/>
    <g transform="rotate(-6 100 60)"><rect x="80" y="26" width="42" height="56" fill="#fff" stroke="${INK}" stroke-width="3.5"/>
      <path d="M86 40h30M86 50h30M86 60h24M86 70h28" stroke="#9cc3ee" stroke-width="2"/><path d="M80 34h4" stroke="#ec6f72" stroke-width="2"/></g>
    <g stroke="${INK}" stroke-width="3.5"><path d="M150 30l26 46M178 30l-26 46" stroke-linecap="round"/>
      <circle cx="150" cy="86" r="9" fill="#e0453a"/><circle cx="178" cy="86" r="9" fill="#e0453a"/><circle cx="164" cy="54" r="2.5" fill="${INK}"/></g>
    <text x="100" y="112" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="20" fill="${INK}">stone · paper · scissors</text>`),
  dots: () => {
    let s = `<rect width="200" height="120" fill="#fffaf0"/>`;
    const xs = [40, 70, 100, 130, 160], ys = [20, 50, 80, 110];
    s += `<rect x="40" y="20" width="30" height="30" fill="#2463d6" opacity=".25"/><rect x="70" y="20" width="30" height="30" fill="#2463d6" opacity=".25"/><rect x="100" y="50" width="30" height="30" fill="#e0453a" opacity=".25"/>`;
    s += `<text x="55" y="42" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="22" fill="#2463d6">A</text><text x="85" y="42" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="22" fill="#2463d6">A</text><text x="115" y="72" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="22" fill="#e0453a">R</text>`;
    s += `<g stroke-width="3.5" stroke-linecap="round" fill="none"><path d="M40 20h60M40 50h60M40 20v30M70 20v30M100 20v30" stroke="#2463d6"/><path d="M100 50h30v30h-30M130 80h30M160 50v30" stroke="#e0453a"/><path d="M40 80h30M70 80v30" stroke="${INK}" stroke-dasharray="4 5"/></g>`;
    for (const x of xs) for (const y of ys) s += `<circle cx="${x}" cy="${y}" r="4" fill="${INK}"/>`;
    return S(s);
  },
  rmcs: () => S(`<rect width="200" height="120" fill="#fff0ec"/>
    ${[['राजा', '#ffd34d', -10, 10], ['मंत्री', '#cfe3ff', 6, 58], ['चोर', '#e7e7e7', -4, 106], ['सिपाही', '#d3f5e6', 9, 154]].map(([t, c, r, x]) =>
      `<g transform="translate(${x} 28) rotate(${r} 18 30)"><path d="M0 4l36-4 4 56-36 4z" fill="${c}" stroke="${INK}" stroke-width="3"/><path d="M2 30l36-2" stroke="${INK}" stroke-width="1.5" stroke-dasharray="3 3" opacity=".5"/><text x="20" y="48" text-anchor="middle" font-size="12" font-weight="700" fill="${INK}">${t}</text></g>`).join('')}
    <path d="M18 22l6-12 8 8 8-10 8 10 8-8 6 12z" fill="#ffd34d" stroke="${INK}" stroke-width="3" transform="translate(-4 -2) scale(.7)"/>
    <text x="100" y="114" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="20" fill="${INK}">who is the Chor?</text>`),
  flames: () => S(`<rect width="200" height="120" fill="#fff0f6"/>
    ${'FLAMES'.split('').map((ch, i) => `<text x="${24 + i * 30}" y="66" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="40" fill="${['#e0453a', '#e84393', '#ff9a3c', '#8a5be6', '#2463d6', '#2e9e48'][i]}">${ch}</text>`).join('')}
    <g stroke="${INK}" stroke-width="3" stroke-linecap="round"><path d="M10 50l26 8M66 46l28 14M128 48l26 10M158 54l26-8"/></g>
    <path d="M54 86c0-7 10-10 14-2 4-8 14-5 14 2 0 9-14 16-14 16s-14-7-14-16z" fill="#ff5a8a" stroke="${INK}" stroke-width="3"/>
    <text x="104" y="102" font-family="Caveat" font-weight="700" font-size="20" fill="${INK}">= L for Love?!</text>`),
  npat: () => S(`<rect width="200" height="120" fill="#fffaf0"/>
    <g stroke="#9cc3ee" stroke-width="1.5">${[30, 48, 66, 84, 102].map(y => `<path d="M0 ${y}H200"/>`).join('')}</g>
    <g stroke="${INK}" stroke-width="2"><path d="M54 14v100M102 14v100M150 14v100"/></g>
    <g font-family="Caveat" font-weight="700" font-size="17" fill="#e0453a"><text x="8" y="26">Name</text><text x="58" y="26">Place</text><text x="106" y="26">Animal</text><text x="154" y="26">Thing</text></g>
    <g font-family="Caveat" font-size="18" fill="#2463d6"><text x="8" y="45">Kabir</text><text x="58" y="45">Kerala</text><text x="106" y="45">Koala</text><text x="154" y="45">Kite</text></g>
    <circle cx="170" cy="84" r="22" fill="#ffe15a" stroke="${INK}" stroke-width="3"/><text x="170" y="96" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="36" fill="${INK}">K</text>`),
  bluff: () => S(`<rect width="200" height="120" fill="#e6f2ea"/>
    ${[-24, -8, 8, 24].map((r, i) => `<g transform="rotate(${r} 100 150)"><rect x="80" y="24" width="40" height="60" rx="5" fill="#2463d6" stroke="${INK}" stroke-width="3"/><rect x="85" y="29" width="30" height="50" rx="3" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 3"/></g>`).join('')}
    <g transform="rotate(14 160 60)"><rect x="140" y="32" width="40" height="58" rx="5" fill="#fff" stroke="${INK}" stroke-width="3"/><text x="160" y="70" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="30" fill="#e0453a">A♥</text></g>
    <path d="M20 22h52v26H40l-8 8v-8H20z" fill="#fff" stroke="${INK}" stroke-width="3"/><text x="46" y="42" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="20" fill="#e0453a">Bluff!</text>`),
  colour: () => S(`<rect width="200" height="120" fill="#fff8ec"/>
    ${['#e53935', '#1e6fe0', '#2e9e48', '#fbc02d', '#8e24aa', '#f57c00'].map((c, i) => `<g transform="translate(${18 + i * 30} ${30 + (i % 2) * 10}) rotate(${(i - 2.5) * 6})"><rect x="0" y="12" width="16" height="56" rx="2" fill="${c}" stroke="${INK}" stroke-width="2.5"/><path d="M0 12l8-12 8 12z" fill="${c}" stroke="${INK}" stroke-width="2.5"/><rect x="0" y="26" width="16" height="22" fill="rgba(255,255,255,.35)"/></g>`).join('')}
    <path d="M114 8h78v24h-58l-8 8v-8h-12z" fill="#fff" stroke="${INK}" stroke-width="2.5"/><text x="153" y="25" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="17" fill="${INK}">which colour?!</text>`),
  snakes: () => {
    let s = `<rect width="200" height="120" fill="#fffaf0"/>`;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) if ((r + c) % 2) s += `<rect x="${c * 30 - 5}" y="${r * 30}" width="30" height="30" fill="#e3f4ea"/>`;
    s += `<g stroke="#a0622d" stroke-width="5" stroke-linecap="round"><path d="M40 108L72 14M60 112L92 18"/></g><g stroke="#a0622d" stroke-width="4">${[0, 1, 2, 3, 4].map(i => `<path d="M${44 + i * 6.4} ${96 - i * 18}l20 4"/>`).join('')}</g>`;
    s += `<path d="M120 20c30 0 30 24 10 30s-24 26 4 32 26 22 6 26" fill="none" stroke="#2e9e48" stroke-width="11" stroke-linecap="round"/><path d="M120 20c30 0 30 24 10 30s-24 26 4 32 26 22 6 26" fill="none" stroke="#9be07a" stroke-width="4" stroke-dasharray="3 7" stroke-linecap="round"/><circle cx="118" cy="20" r="9" fill="#2e9e48" stroke="${INK}" stroke-width="2.5"/><circle cx="115" cy="17" r="2" fill="#fff"/><path d="M109 22l-6 2" stroke="#e0453a" stroke-width="2"/>`;
    return S(s);
  },
  ludo: () => S(`<rect width="200" height="120" fill="#fff"/>
    <g stroke="${INK}" stroke-width="2.5"><rect x="50" y="0" width="50" height="50" fill="#e53935"/><rect x="100" y="0" width="50" height="50" fill="#2e9e48"/><rect x="50" y="70" width="50" height="50" fill="#1e6fe0"/><rect x="100" y="70" width="50" height="50" fill="#fbc02d"/></g>
    <g fill="#fff" stroke="${INK}" stroke-width="2"><circle cx="75" cy="25" r="12"/><circle cx="125" cy="25" r="12"/><circle cx="75" cy="95" r="12"/><circle cx="125" cy="95" r="12"/></g>
    <rect x="0" y="50" width="200" height="20" fill="#f6f6f6" stroke="${INK}" stroke-width="2"/>
    <g stroke="${INK}" stroke-width="2.5"><circle cx="20" cy="60" r="7" fill="#e53935"/><circle cx="180" cy="60" r="7" fill="#fbc02d"/><circle cx="75" cy="25" r="6" fill="#e53935"/><circle cx="125" cy="95" r="6" fill="#fbc02d"/></g>
    <g transform="translate(150 72) rotate(15)"><rect width="28" height="28" rx="6" fill="#fff" stroke="${INK}" stroke-width="2.5"/><g fill="${INK}"><circle cx="8" cy="8" r="2.5"/><circle cx="20" cy="8" r="2.5"/><circle cx="8" cy="14" r="2.5"/><circle cx="20" cy="14" r="2.5"/><circle cx="8" cy="20" r="2.5"/><circle cx="20" cy="20" r="2.5"/></g></g>`),
  penfight: () => S(`<rect width="200" height="120" fill="#d7a26d"/><rect x="14" y="8" width="172" height="104" fill="#fffaf0"/>
    <path d="M14 8h172v104H14z" fill="none" stroke="${INK}" stroke-width="3"/>
    <g transform="rotate(-28 90 64)"><rect x="40" y="58" width="92" height="12" rx="6" fill="#2463d6" stroke="${INK}" stroke-width="3"/><path d="M132 58l18 6-18 6z" fill="#cfd8dc" stroke="${INK}" stroke-width="3"/><rect x="52" y="54" width="34" height="4" rx="2" fill="#90a4ae" stroke="${INK}" stroke-width="2"/></g>
    <g transform="rotate(22 120 60)"><rect x="96" y="54" width="88" height="11" rx="5.5" fill="#e0453a" stroke="${INK}" stroke-width="3"/><path d="M96 54l-16 5.5 16 5.5z" fill="#fff3e0" stroke="${INK}" stroke-width="3"/></g>
    <path d="M112 40l5 9 10-3-6 8 8 6-10 1 1 10-6-8-7 7 1-10-10-2 9-5z" fill="#ffe15a" stroke="${INK}" stroke-width="2.5"/>`),
  marbles: () => S(`<rect width="200" height="120" fill="#c8a27a"/>
    <ellipse cx="100" cy="62" rx="84" ry="50" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="10 5"/>
    ${[[100, 62, '#2463d6'], [116, 62, '#e53935'], [84, 62, '#2e9e48'], [100, 50, '#fbc02d'], [100, 74, '#8a5be6']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="6" fill="${c}" stroke="${INK}" stroke-width="2"/><circle cx="${x - 2}" cy="${y - 2}" r="2" fill="#fff" opacity=".8"/>`).join('')}
    <circle cx="40" cy="92" r="10" fill="#4dd0e1" stroke="${INK}" stroke-width="2.5"/><path d="M34 88c4 4 8 8 12 6" stroke="#fff" stroke-width="2.5" fill="none"/>
    <path d="M52 86l26-14" stroke="${INK}" stroke-width="2.5" stroke-dasharray="4 4"/><path d="M78 72l-8 0 4 6z" fill="${INK}"/>`),
  carrom: () => S(`<rect width="200" height="120" fill="#6d3f1f"/><rect x="40" y="4" width="120" height="112" fill="#f2d6a2" stroke="${INK}" stroke-width="3"/>
    <g fill="#2b1a10">${[[46, 10], [154, 10], [46, 110], [154, 110]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7"/>`).join('')}</g>
    <circle cx="100" cy="60" r="24" fill="none" stroke="#b03a2e" stroke-width="2"/><circle cx="100" cy="60" r="5" fill="#e53935" stroke="${INK}" stroke-width="2"/>
    ${[[0, -11], [10, -5], [10, 6], [0, 11], [-10, 6], [-10, -5]].map(([dx, dy], i) => `<circle cx="${100 + dx}" cy="${60 + dy}" r="5" fill="${i % 2 ? '#2b2b2b' : '#fff7e6'}" stroke="${INK}" stroke-width="1.6"/>`).join('')}
    <path d="M62 98h76M62 22h76" stroke="${INK}" stroke-width="1.5"/><circle cx="112" cy="98" r="7" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="112" cy="98" r="3" fill="none" stroke="#e53935" stroke-width="1.5"/>`)
};

export function cardArt(id) { return (CARD_ART[id] || CARD_ART.ttt)(); }

/** Doodles for the welcome cover. */
export function coverDoodles() {
  return `<svg class="cover-doodles" viewBox="0 0 400 520" preserveAspectRatio="none" aria-hidden="true">
    <g fill="none" stroke="rgba(255,255,255,.35)" stroke-width="3" stroke-linecap="round">
      <path d="M300 60l8 16 18 3-13 12 3 18-16-9-16 9 3-18-13-12 18-3z"/>
      <circle cx="340" cy="430" r="26"/><path d="M328 424h.01M352 424h.01M328 440c8 6 16 6 24 0"/>
      <path d="M40 470c30-30 60 30 90 0s60 30 90 0"/>
      <path d="M330 180c-20 20 10 40-10 60"/><path d="M322 236l-2 8 8-2"/>
      <path d="M250 330l60-20M250 330l8 10M250 330l12-4"/>
    </g>
  </svg>`;
}
