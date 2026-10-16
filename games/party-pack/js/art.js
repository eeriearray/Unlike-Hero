/* Hand-built SVG art: player characters, the six host characters, and the decorative bits.
   Everything uses the same cartoon rules: flat fills, a 4-unit ink outline, simple faces. */
(function () {
  'use strict';
  const PP = window.PP;
  const INK = '#15121c';
  const ol = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;

  // ---------- player characters: 12 = 6 body shapes × 2 faces, coloured by seat ----------
  const BODIES = [
    c => `<path d="M50 8c24 0 40 18 40 44S74 94 50 94 10 78 10 52 26 8 50 8z" fill="${c}" ${ol}/>`,                                   // egg
    c => `<rect x="10" y="14" width="80" height="78" rx="22" fill="${c}" ${ol}/>`,                                                      // block
    c => `<path d="M50 6l12 14 18-4 2 18 14 10-10 16 6 18-18 4-8 16-16-10-16 10-8-16-18-4 6-18-10-16 14-10 2-18 18 4z" fill="${c}" ${ol}/>`, // spiky
    c => `<path d="M14 92V44C14 22 30 8 50 8s36 14 36 36v48l-12-10-12 10-12-10-12 10-12-10z" fill="${c}" ${ol}/>`,                         // ghosty
    c => `<path d="M50 10L92 88H8z" fill="${c}" ${ol}/><circle cx="50" cy="10" r="5" fill="${c}" ${ol}/>`,                            // pyramid
    c => `<ellipse cx="50" cy="56" rx="42" ry="36" fill="${c}" ${ol}/><path d="M30 26c-6-14 4-20 10-12M70 26c6-14-4-20-10-12" fill="none" ${ol}/>` // bean with antennae
  ];
  const FACES = [
    `<circle cx="38" cy="50" r="7" fill="#fff" ${ol}/><circle cx="62" cy="50" r="7" fill="#fff" ${ol}/><circle cx="39" cy="51" r="3" fill="${INK}"/><circle cx="63" cy="51" r="3" fill="${INK}"/><path d="M38 68q12 10 24 0" fill="none" ${ol}/>`,
    `<path d="M31 50q7-7 14 0M55 50q7-7 14 0" fill="none" ${ol}/><path d="M40 64h20q-2 12-10 12t-10-12z" fill="#fff" ${ol}/>`
  ];
  PP.Art = {
    INK,
    count: BODIES.length * FACES.length,
    /** A player character. id: 0–11 (or a legacy emoji, which falls back to a seat-based id). */
    face(id, color, cls) {
      let n = Number(String(id).replace(/\D/g, '')); if (!Number.isFinite(n) || String(id).length > 3) n = 0;
      n = ((n % 12) + 12) % 12;
      return `<svg class="face ${cls || ''}" viewBox="0 0 100 100" aria-hidden="true">${BODIES[n % 6](color)}<g transform="translate(0 ${n % 6 === 4 ? 14 : 0})">${FACES[Math.floor(n / 6)]}</g></svg>`;
    },
    /** A player's character, ghost-tinted when they're dead in the Cutthroat Quiz. */
    player(p, color) { return PP.Art.face(p.avatar, p.ghost ? '#cfd6ff' : color, p.ghost ? 'is-ghost' : ''); },

    // ---------- hosts: each a cartoon with a mouth that flaps while the voice plays ----------
    host(key) {
      const mouth = (x, y, w) => `<g class="mouth"><ellipse class="m-open" cx="${x}" cy="${y}" rx="${w}" ry="${w * 0.6}" fill="#5a1222" ${ol}/><path class="m-shut" d="M${x - w} ${y}q${w} ${w * 0.5} ${w * 2} 0" fill="none" ${ol}/></g>`;
      const eyes = (y, sleepy) => `<g class="eyes"><circle cx="40" cy="${y}" r="8" fill="#fff" ${ol}/><circle cx="64" cy="${y}" r="8" fill="#fff" ${ol}/><circle cx="41" cy="${y + 1}" r="3.5" fill="${INK}"/><circle cx="65" cy="${y + 1}" r="3.5" fill="${INK}"/>${sleepy ? `<path d="M31 ${y - 1}h18M55 ${y - 1}h18" ${ol}/><path d="M32 ${y - 2}a8 8 0 0 1 16 0zM56 ${y - 2}a8 8 0 0 1 16 0z" fill="${sleepy}" ${ol}/>` : ''}</g>`;
      const H = {
        // The Announcer: a megaphone with a face
        lobby: `<g transform="translate(-8 -2) scale(1.22)"><path d="M18 46l52-26v80L18 74z" fill="#ffd23f" ${ol}/><rect x="6" y="44" width="16" height="32" rx="5" fill="#ff5d8f" ${ol}/><path d="M70 20q14 40 0 80" fill="none" ${ol}/>${eyes(50)}${mouth(52, 72, 9)}</g><path d="M50 112l-10 14h20z" fill="#ff5d8f" ${ol}/>`,
        // Margo Quill: a weary vintage microphone with heavy eyelids
        quip: `<rect x="44" y="96" width="16" height="22" fill="#9aa0ad" ${ol}/><rect x="28" y="114" width="48" height="10" rx="5" fill="#6b7180" ${ol}/><rect x="20" y="10" width="64" height="92" rx="32" fill="#c9ced8" ${ol}/><path d="M24 40h56M24 52h56" stroke="#9aa0ad" stroke-width="3"/>${eyes(66, '#ff5d8f')}${mouth(52, 86, 8)}<path d="M70 18l12-8" ${ol}/>`,
        // Dex Fibbington: game-show head, huge hair, huge grin
        fib: `<path d="M14 44c-6-30 26-40 38-34 12-10 46 0 38 34" fill="#ffb14a" ${ol}/><ellipse cx="52" cy="62" rx="34" ry="38" fill="#ffcfa6" ${ol}/>${eyes(54)}<path d="M30 76q22 24 44 0z" fill="#fff" ${ol}/><g class="mouth"><path class="m-open" d="M30 76q22 30 44 0z" fill="#5a1222" ${ol}/><path class="m-shut" d="M32 78q20 14 40 0" fill="none" ${ol}/></g><path d="M36 102l16 10 16-10" fill="#3ddcff" ${ol}/>`,
        // Professor Pallette: a paintbrush with a beret and a moustache
        draw: `<rect x="36" y="64" width="32" height="60" rx="8" fill="#c98a4b" ${ol}/><rect x="32" y="56" width="40" height="14" fill="#b9bfcc" ${ol}/><path d="M30 58c-4-30 10-50 22-50s26 20 22 50z" fill="#2c2c36" ${ol}/><ellipse cx="52" cy="14" rx="26" ry="8" fill="#e8403a" ${ol}/><circle cx="52" cy="6" r="4" fill="#e8403a" ${ol}/>${eyes(84)}<path d="M38 98q7-6 14 0q7-6 14 0" fill="#2c2c36" ${ol}/>${mouth(52, 108, 6)}`,
        // The Proprietor: a gaunt hotelier in a top hat (cartoon-spooky, not gory)
        quiz: `<rect x="30" y="2" width="44" height="30" fill="#2a1f3d" ${ol}/><rect x="20" y="30" width="64" height="8" rx="3" fill="#2a1f3d" ${ol}/><rect x="30" y="20" width="44" height="6" fill="#7bff6a"/><path d="M28 40h48l-4 52q-20 14-40 0z" fill="#d9e4d0" ${ol}/><g class="eyes"><ellipse cx="42" cy="56" rx="7" ry="9" fill="${INK}"/><ellipse cx="64" cy="56" rx="7" ry="9" fill="${INK}"/><circle cx="44" cy="54" r="2.5" fill="#7bff6a"/><circle cx="66" cy="54" r="2.5" fill="#7bff6a"/></g>${mouth(53, 80, 8)}<path d="M36 100l17 12 17-12" fill="#7a1530" ${ol}/>`,
        // Ripley Thread: a T-shirt in a backwards cap
        tee: `<path d="M24 34l22-10q6 8 12 0l22 10 16 20-14 10-6-6v58H30V58l-6 6-14-10z" fill="#ffe14d" ${ol}/><path d="M28 26c0-18 48-18 48 0z" fill="#6c2bd9" ${ol}/><path d="M28 26h-14" ${ol}/>${eyes(60)}${mouth(52, 84, 9)}`,
        // Chad Venture: a briefcase with sunglasses and a tie
        pitch: `<rect x="40" y="10" width="24" height="14" rx="5" fill="none" ${ol}/><rect x="10" y="22" width="84" height="84" rx="12" fill="#8a5a2b" ${ol}/><path d="M10 50h84" ${ol}/><path d="M24 52h22v10q-11 6-22 0zM58 52h22v10q-11 6-22 0z" fill="${INK}"/><path d="M46 56h12" ${ol}/>${mouth(52, 80, 9)}<path d="M52 92l-6 8 6 12 6-12z" fill="#ff6b4a" ${ol}/>`
      };
      return `<svg class="host-svg" viewBox="0 0 104 128" aria-hidden="true">${H[key] || H.lobby}</svg>`;
    },

    // ---------- small pieces ----------
    crown: `<svg class="crown-svg" viewBox="0 0 40 28" aria-hidden="true"><path d="M4 24L2 6l10 8 8-12 8 12 10-8-2 18z" fill="#ffd23f" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></svg>`,
    shield: `<svg class="shield-svg" viewBox="0 0 28 32" aria-hidden="true"><path d="M14 2l11 4v9c0 8-5 13-11 15C8 28 3 23 3 15V6z" fill="#3ddcff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></svg>`,
    /** Splats for backgrounds, deterministic per seed. */
    splat(seed, color) {
      let s = seed * 9301 + 49297; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      const pts = []; const n = 9 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rad = 30 + r() * 18; pts.push([50 + Math.cos(a) * rad, 50 + Math.sin(a) * rad]); }
      const d = pts.map((p, i) => { const q = pts[(i + 1) % n]; return `${i ? '' : `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`}Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`; }).join('') + 'Z';
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${d}" fill="${color}"/></svg>`;
    }
  };
})();
