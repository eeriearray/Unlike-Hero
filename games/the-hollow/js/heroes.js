/* THE HOLLOW — the six heroes: full-length illustrations (one distinct silhouette each), short identity copy, and the
 * character-select showcase. Art is original SVG behind one function, Heroes.art(id), so a painted PNG/WebP per hero can
 * replace it later (see ASSET below) without touching the screens. */
(function (g) {
  'use strict';
  var A = g.HollowArt, esc = A.esc, H = g.HollowHeroes = {};
  // Drop-in real artwork: put transparent images at games/the-hollow/art/heroes/<id>.png and list the ids here.
  var ASSET = { occultist: false, hunter: false, apothecary: false, medium: false, exorcist: false, vagabond: false };
  H.order = ['occultist', 'hunter', 'apothecary', 'medium', 'exorcist', 'vagabond'];

  H.copy = {
    occultist: { line: 'Isolde reads what the world hides in its margins.', sig: ['Twist Fate', 'Reroll a failed check. Costs 1 Sanity.', 'eye'], alt: ['Margin Notes', '+2 to every check at occult places.'], mood: 'Scholar of forbidden things' },
    hunter: { line: 'Corvin tracks whatever walked out of the woods.', sig: ['Set Snare', 'Trap a place. The next enemy there is wounded.', 'snare'], alt: ['Tracker', '+2 Might against beasts and the dead.'], mood: 'Practical. Dangerous.' },
    apothecary: { line: 'Maelis mends with whatever still grows.', sig: ['Brew', 'Turn herbs into tonics, charms or calm.', 'herb'], alt: ['Forager', 'Gathers herbs as she travels.'], mood: 'A travelling healer' },
    medium: { line: 'Wren hears the dead, and they hear her.', sig: ['Calm the Dead', 'Restore an ally\'s Sanity. The dead notice.', 'moon'], alt: ['Veil-sighted', '+2 Fate against spirits.'], mood: 'Half in the spirit world' },
    exorcist: { line: 'Anselm seals what should not walk.', sig: ['Rite of Sealing', 'Purify, seal, cleanse or banish. Three rites only.', 'chain'], alt: ['Sanctified', 'Allies beside you lose less Sanity.'], mood: 'Faith, worn thin' },
    vagabond: { line: 'Jory has never met a door that stayed shut.', sig: ['Slip Away', 'Escape any fight, no roll.', 'key'], alt: ['Light Step', 'Your first sprint each round is silent.'], mood: 'Thief of back roads' }
  };

  // ───────────── the illustrations (300 × 440) ─────────────
  var D = '<defs><linearGradient id="hcl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>';
  var SH = '<ellipse cx="150" cy="424" rx="92" ry="9" fill="#000" opacity=".55"/>';
  var ART = {
    occultist: function () { return SH +
      '<ellipse cx="150" cy="420" rx="110" ry="14" fill="none" stroke="#8b6fd1" stroke-width="2" stroke-dasharray="6 5" opacity=".7"/><ellipse cx="150" cy="420" rx="78" ry="9" fill="none" stroke="#b7a2f0" stroke-width="1.5" opacity=".5"/>' +
      '<path d="M104 126Q150 108 196 126L232 420H68Z" fill="#2a2147"/><path d="M150 126V420M124 150L96 420M176 150L204 420M104 200L84 420M196 200L216 420" stroke="#120d24" stroke-width="3" opacity=".55"/><path d="M104 126Q150 108 196 126L232 420H68Z" fill="url(#hcl)"/>' +
      '<path d="M96 118Q150 58 204 118Q190 150 150 150Q110 150 96 118Z" fill="#1c1533"/><ellipse cx="150" cy="104" rx="26" ry="32" fill="#0a0814"/><circle cx="140" cy="102" r="3.4" fill="#d9c8ff"/><circle cx="160" cy="102" r="3.4" fill="#d9c8ff"/><circle cx="140" cy="102" r="9" fill="#b7a2f0" opacity=".18"/><circle cx="160" cy="102" r="9" fill="#b7a2f0" opacity=".18"/>' +
      '<path d="M196 140Q230 150 238 196" stroke="#2a2147" stroke-width="22" fill="none" stroke-linecap="round"/><circle cx="240" cy="204" r="10" fill="#c9b8a0"/>' +
      '<g class="hfloat"><path d="M214 96l40-12 40 12v56l-40-12-40 12z" fill="#e8dcc0" stroke="#6a5a3a" stroke-width="2"/><path d="M254 84v56" stroke="#6a5a3a" stroke-width="2"/><path d="M224 106h22M224 118h18M262 106h22M262 118h18" stroke="#6b4fb8" stroke-width="2.4"/><circle cx="254" cy="112" r="38" fill="#8b6fd1" opacity=".14"/></g>' +
      '<path d="M104 160Q70 190 72 236" stroke="#2a2147" stroke-width="20" fill="none" stroke-linecap="round"/><circle cx="72" cy="246" r="10" fill="#c9b8a0"/><path d="M72 256v34" stroke="#c9a35b" stroke-width="2"/><circle cx="72" cy="298" r="11" fill="none" stroke="#c9a35b" stroke-width="3"/><path d="M72 290v16M64 298h16" stroke="#c9a35b" stroke-width="2"/>' +
      '<g fill="#b7a2f0" opacity=".7"><circle class="hfloat" cx="40" cy="170" r="2.5"/><circle class="hfloat" cx="262" cy="64" r="2"/><circle class="hfloat" cx="52" cy="110" r="1.8"/></g>'; },
    hunter: function () { return SH +
      '<path d="M86 126Q150 104 214 126L226 296L190 420H110L74 296Z" fill="#4a3322"/><path d="M86 126Q150 104 214 126L226 296L190 420H110L74 296Z" fill="url(#hcl)"/><path d="M150 126V300M118 140L104 310M182 140L196 310" stroke="#2a1c12" stroke-width="3" opacity=".6"/>' +
      '<path d="M92 130Q150 160 208 130L214 156Q150 190 86 156Z" fill="#7a6a58"/><path d="M96 134l-10 10M206 134l10 10M110 148l-6 12M190 148l6 12" stroke="#a89880" stroke-width="3"/>' +
      '<path d="M100 220L204 160" stroke="#2a1c12" stroke-width="9"/><circle cx="196" cy="196" r="5" fill="#c9a35b"/><circle cx="168" cy="178" r="5" fill="#c9a35b"/><circle cx="140" cy="198" r="5" fill="#c9a35b"/><circle cx="112" cy="214" r="5" fill="#c9a35b"/>' +
      '<rect x="112" y="292" width="76" height="14" fill="#2a1c12"/><rect x="144" y="290" width="12" height="18" fill="#c9a35b"/>' +
      '<ellipse cx="150" cy="84" rx="70" ry="12" fill="#2a1c12"/><path d="M112 82Q114 40 150 38Q186 40 188 82Z" fill="#33231a"/><path d="M112 78h76" stroke="#6a4a2a" stroke-width="5"/>' +
      '<ellipse cx="150" cy="104" rx="26" ry="24" fill="#c6a07c"/><path d="M124 100Q150 84 176 100L176 92Q150 76 124 92Z" fill="#0f0a07" opacity=".85"/><path d="M134 100h8M158 100h8" stroke="#0e0b08" stroke-width="3"/><path d="M130 118Q150 136 170 118L170 128Q150 144 130 128Z" fill="#3a2a1d"/>' +
      '<path d="M86 160Q56 200 66 256" stroke="#4a3322" stroke-width="26" fill="none" stroke-linecap="round"/><circle cx="68" cy="266" r="11" fill="#b8926e"/><path d="M68 276v14" stroke="#8c8f9a" stroke-width="2"/><path d="M52 290h32l-4 38h-24z" fill="#2a2118" stroke="#b9925a" stroke-width="2.4"/><path class="hflame" d="M68 300c-7 9-2 12-2 17 6 0 10-5 4-17z" fill="#ffcf6b"/><circle cx="68" cy="306" r="28" fill="#ffb347" opacity=".13"/>' +
      '<path d="M214 160Q236 190 232 236" stroke="#4a3322" stroke-width="24" fill="none" stroke-linecap="round"/><circle cx="231" cy="246" r="10" fill="#b8926e"/>' +
      '<path d="M246 120l36 8M248 140l36 6M250 160l30 6" stroke="#c9a35b" stroke-width="3" stroke-linecap="round" opacity=".45"/>' +
      '<path d="M96 420l-6 -34h36l-2 34zM174 420l2 -34h36l-6 34z" fill="#1b130d"/>'; },
    apothecary: function () { return SH +
      '<path d="M112 124Q150 112 188 124L252 420H48Z" fill="#1f4a38"/><path d="M112 124Q150 112 188 124L252 420H48Z" fill="url(#hcl)"/><path d="M112 124L48 420M188 124L252 420" stroke="#143226" stroke-width="3" opacity=".5"/>' +
      '<path d="M118 150Q150 140 182 150L198 330Q150 346 102 330Z" fill="#d8cdb0"/><path d="M118 150Q150 140 182 150L198 330Q150 346 102 330Z" fill="url(#hcl)"/><path d="M130 168h40M130 184h40" stroke="#b6a888" stroke-width="2"/>' +
      '<path d="M96 132L206 232" stroke="#6a4a2a" stroke-width="10"/><path d="M196 220l32 4 -6 44h-30z" fill="#7a5a34" stroke="#3a2a14" stroke-width="2.4"/><path d="M200 224h22" stroke="#3a2a14" stroke-width="3"/>' +
      '<rect x="106" y="296" width="90" height="12" fill="#6a4a2a"/><g><rect x="112" y="296" width="10" height="22" rx="3" fill="#8fd0a8" opacity=".85"/><rect x="128" y="296" width="10" height="26" rx="3" fill="#d0a8e0" opacity=".85"/><rect x="164" y="296" width="10" height="24" rx="3" fill="#e0b070" opacity=".85"/><rect x="180" y="296" width="10" height="20" rx="3" fill="#8fd0a8" opacity=".85"/></g>' +
      '<ellipse cx="150" cy="96" rx="50" ry="12" fill="#244a3c"/><path d="M114 94Q116 56 150 54Q184 56 186 94Z" fill="#2d5a46"/><circle cx="150" cy="52" r="10" fill="#244a3c"/><path d="M114 90q36 10 72 0" stroke="#d9b45a" stroke-width="4" fill="none"/>' +
      '<ellipse cx="150" cy="108" rx="25" ry="24" fill="#d6b594"/><circle cx="138" cy="106" r="8" fill="none" stroke="#c9a35b" stroke-width="2.4"/><circle cx="162" cy="106" r="8" fill="none" stroke="#c9a35b" stroke-width="2.4"/><path d="M146 106h8" stroke="#c9a35b" stroke-width="2.4"/><path d="M140 122q10 8 20 0" stroke="#7a4a3a" stroke-width="2.6" fill="none"/>' +
      '<path d="M108 146Q70 180 82 232" stroke="#1f4a38" stroke-width="24" fill="none" stroke-linecap="round"/><circle cx="84" cy="242" r="10" fill="#d6b594"/><g class="hfloat"><path d="M74 192h22v26a11 11 0 0 1-22 0z" fill="#7fe0a8" opacity=".85" stroke="#cfe8d8" stroke-width="2"/><rect x="78" y="184" width="14" height="10" fill="#8a6a3a"/><circle cx="85" cy="212" r="20" fill="#7fe0a8" opacity=".14"/></g>' +
      '<path d="M258 150v70M268 160v56M248 160v50" stroke="#2f6a47" stroke-width="2.4"/><path d="M246 150l10 24 10-24M262 160l8 22 8-22" fill="#4aa070"/>'; },
    medium: function () { return SH +
      '<g opacity=".8"><path class="hfloat" d="M52 150q-22 34 6 70q-26 -26 -2 -68z" fill="#9fd0f0" opacity=".35"/><path class="hfloat" d="M248 120q26 40 -8 80q32 -34 4 -82z" fill="#9fd0f0" opacity=".3"/><path class="hfloat" d="M236 280q18 24 -2 50q22 -22 4 -50z" fill="#cfe8ff" opacity=".28"/></g>' +
      '<path d="M104 130Q150 112 196 130L222 420H78Z" fill="#1b3350"/><path d="M104 130Q150 112 196 130L222 420H78Z" fill="url(#hcl)"/><path d="M150 140V420M122 150L100 420M178 150L200 420" stroke="#0e1d30" stroke-width="3" opacity=".5"/>' +
      '<path d="M84 150Q150 96 216 150L206 214Q150 190 94 214Z" fill="#33567c" opacity=".92"/><path d="M96 150Q150 100 204 150" stroke="#9fd0f0" stroke-width="2" fill="none" opacity=".5"/>' +
      '<path d="M96 100Q150 50 204 100L198 160Q150 138 102 160Z" fill="#2a4a6a"/><ellipse cx="150" cy="106" rx="24" ry="28" fill="#d9c8bd"/><path d="M136 106q6 4 12 0M152 106q6 4 12 0" stroke="#4a3a40" stroke-width="2.4" fill="none"/><path d="M142 124q8 4 16 0" stroke="#a8686c" stroke-width="2.4" fill="none"/>' +
      '<path d="M200 170Q236 186 232 236" stroke="#1b3350" stroke-width="22" fill="none" stroke-linecap="round"/><circle cx="232" cy="246" r="9" fill="#d9c8bd"/><rect x="224" y="252" width="14" height="40" rx="3" fill="#e8e2c9"/><path class="hflame" d="M231 232c-7 10-2 13-2 18 7 0 11-6 4-18z" fill="#bfe4ff"/><circle cx="231" cy="244" r="30" fill="#9fd0f0" opacity=".18"/>' +
      '<path d="M100 170Q70 200 82 250" stroke="#1b3350" stroke-width="22" fill="none" stroke-linecap="round"/><circle cx="84" cy="258" r="9" fill="#d9c8bd"/><g transform="rotate(-10 70 286)"><rect x="50" y="262" width="40" height="52" fill="#d8d0bc" stroke="#7a7160" stroke-width="2"/><rect x="56" y="268" width="28" height="36" fill="#8a8678"/><path d="M64 290q6 -14 12 0" fill="#bdb8a8"/></g>'; },
    exorcist: function () { return SH +
      '<path d="M104 126Q150 108 196 126L214 420H86Z" fill="#d8d0bc"/><path d="M104 126Q150 108 196 126L214 420H86Z" fill="url(#hcl)"/><path d="M150 126V420M122 146L108 420M178 146L192 420" stroke="#a89c80" stroke-width="3" opacity=".55"/>' +
      '<path d="M130 126L150 330L170 126Z" fill="#2a2a30"/><path d="M130 126L150 330L170 126" stroke="#c9a35b" stroke-width="3" fill="none"/><path d="M150 176v50M134 194h32" stroke="#c9a35b" stroke-width="4.4"/>' +
      '<path d="M92 124Q150 40 208 124Q190 156 150 156Q110 156 92 124Z" fill="#d8d0bc"/><path d="M92 124Q150 40 208 124" stroke="#c9a35b" stroke-width="4" fill="none"/><ellipse cx="150" cy="104" rx="24" ry="30" fill="#0f0f13"/><ellipse cx="150" cy="106" rx="19" ry="24" fill="#d2bba4"/><path d="M140 104h6M156 104h6" stroke="#1a1a20" stroke-width="3"/><path d="M142 118h16" stroke="#8a5a4a" stroke-width="2.4"/>' +
      '<path d="M204 150Q238 160 240 214" stroke="#d8d0bc" stroke-width="22" fill="none" stroke-linecap="round"/><circle cx="240" cy="224" r="10" fill="#d2bba4"/><path d="M240 60v330" stroke="#6a5a3a" stroke-width="6"/><path d="M240 30v24M228 42h24" stroke="#c9a35b" stroke-width="5"/><path d="M226 66h28l-4 24h-20z" fill="#c9a35b" stroke="#7a5a1c" stroke-width="2"/><circle cx="240" cy="94" r="5" fill="#8a6a2c"/>' +
      '<path d="M96 160Q70 200 86 250" stroke="#d8d0bc" stroke-width="22" fill="none" stroke-linecap="round"/><circle cx="88" cy="258" r="9" fill="#d2bba4"/><path d="M88 266q-10 40 -2 70" stroke="#c9a35b" stroke-width="2.4" fill="none"/><circle cx="84" cy="344" r="13" fill="none" stroke="#c9a35b" stroke-width="3"/><path class="hfloat" d="M84 330q-12 -20 4 -36q-6 20 6 30z" fill="#e8e2c9" opacity=".4"/>'; },
    vagabond: function () { return SH + '<g transform="rotate(-4 150 420)">' +
      '<path d="M100 126Q150 108 200 126L218 300L194 420H106L82 300Z" fill="#7a5a2a"/><path d="M100 126Q150 108 200 126L218 300L194 420H106L82 300Z" fill="url(#hcl)"/><rect x="108" y="190" width="30" height="28" fill="#4a6a5a" stroke="#2a3a30" stroke-width="2" stroke-dasharray="4 3"/><rect x="170" y="250" width="30" height="26" fill="#8a3a3a" stroke="#4a1a1a" stroke-width="2" stroke-dasharray="4 3"/><path d="M150 126V300" stroke="#4a3a1a" stroke-width="3"/>' +
      '<g transform="rotate(14 224 150)"><ellipse cx="226" cy="170" rx="38" ry="48" fill="#8a7a56"/><path d="M200 150q26 -10 52 0" stroke="#4a3a1a" stroke-width="3" fill="none"/><path d="M196 190q30 8 60 0" stroke="#4a3a1a" stroke-width="3" fill="none"/></g>' +
      '<path d="M100 150L206 214" stroke="#3a2a14" stroke-width="8"/>' +
      '<path d="M104 300Q150 316 196 300L192 316Q150 332 108 316Z" fill="#3a2a14"/><g stroke="#c9a35b" stroke-width="3" fill="none"><circle cx="124" cy="330" r="7"/><path d="M124 337v20M118 348h12M118 354h8"/><circle cx="146" cy="332" r="7"/><path d="M146 339v18M140 350h12"/></g>' +
      '<path d="M104 136Q80 124 52 140Q80 148 106 154Z" fill="#c9a35b" opacity=".9"/><path d="M96 128q-4 -20 20 -26" stroke="#c9a35b" stroke-width="8" fill="none"/>' +
      '<path d="M114 78Q150 56 186 78L196 88H104Z" fill="#6a4a22"/><path d="M104 88Q150 100 196 88" stroke="#3a2a14" stroke-width="5" fill="none"/><ellipse cx="150" cy="106" rx="26" ry="24" fill="#c8a47e"/><path d="M134 102h9M158 102h9" stroke="#0e0b08" stroke-width="3"/><path d="M134 118q16 14 32 0" stroke="#3a2a14" stroke-width="3" fill="none"/><path d="M142 114l-4 -4" stroke="#7a4a3a" stroke-width="2"/>' +
      '<path d="M202 150Q232 190 226 238" stroke="#7a5a2a" stroke-width="22" fill="none" stroke-linecap="round"/><circle cx="226" cy="248" r="10" fill="#b8926e"/><g transform="rotate(-18 76 270)"><rect x="62" y="236" width="18" height="72" rx="3" fill="#d8c69a" stroke="#8a7a56" stroke-width="2"/><path d="M62 252h18M62 270h18" stroke="#8a7a56" stroke-width="2"/></g>' +
      '<path d="M112 420l-8 -40h38l-4 40zM160 420l4 -40h38l-8 40z" fill="#2a1a10"/></g>'; }
  };
  H.art = function (id, cls) {
    return '<svg class="hero-art ' + (cls || '') + '" viewBox="0 0 300 440" role="img" aria-label="' + esc(id) + '">' + D + ART[id]() + '</svg>';
  };
  H.portrait = function (id, color) { return A.portrait(id, color); };

  // ───────────── the showcase ─────────────
  var bar = function (n, label) { var o = ''; for (var i = 0; i < 5; i++) o += '<i class="' + (i < n ? 'on' : '') + '"></i>'; return '<div class="stat"><span>' + label + '</span><span class="seg">' + o + '</span><b>' + (n >= 0 ? '+' : '') + n + '</b></div>'; };
  H.showcase = function (cat, id, ui) {
    var c = cat.classes[id], cp = H.copy[id];
    return '<div class="hero-stage" style="--ac:' + c.color + '" data-hero="' + id + '"><div class="glow"></div><div class="ground"></div>' + H.art(id, '') +
      '<div class="hero-info"><div class="mood">' + esc(cp.mood) + '</div><h2>' + esc(c.name.replace('The ', '')) + '</h2><p class="line">' + esc(cp.line) + '</p>' +
      '<div class="stats">' + bar(c.stats.might, 'Might') + bar(c.stats.wit, 'Wit') + bar(c.stats.fate, 'Fate') + '<div class="vs"><span><b>' + c.vit + '</b> Vitality</span><span><b>' + c.san + '</b> Sanity</span></div></div>' +
      '<div class="sig"><span class="sico">' + A.glyph(cp.sig[2], 30) + '</span><div><small>Signature ability</small><b>' + esc(cp.sig[0]) + '</b><span>' + esc(cp.sig[1]) + '</span></div></div>' +
      '<button class="alt" data-act="heroalt" aria-expanded="' + !!ui.heroAlt + '"><span>' + A.glyph('book', 16) + ' ' + esc(cp.alt[0]) + '</span>' + (ui.heroAlt ? '<em>' + esc(cp.alt[1]) + '</em>' : '<em class="muted">tap to see</em>') + '</button></div></div>';
  };
  H.rail = function (cat, ui, players, you) {
    return H.order.map(function (id) {
      var c = cat.classes[id], owner = players.find(function (p) { return p.cls === id; }), mine = owner && owner.id === you, taken = owner && !mine;
      return '<button class="rb' + (ui.hero === id ? ' sel' : '') + (taken ? ' taken' : '') + (mine ? ' mine' : '') + '" data-act="hero" data-cls="' + id + '" style="--ac:' + c.color + '" aria-pressed="' + (ui.hero === id) + '" aria-label="' + esc(c.name + (taken ? ', taken by ' + owner.name : mine ? ', your hero' : '')) + '"><span class="rp">' + A.portrait(id, c.color) + '</span><span class="rn">' + esc(c.name.replace('The ', '')) + '</span>' + (taken ? '<small>' + esc(owner.name) + '</small>' : mine ? '<small>You</small>' : '') + '</button>';
    }).join('');
  };
})(window);
