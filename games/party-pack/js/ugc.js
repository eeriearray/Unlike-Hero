/* User-generated prompt packs and their 7-digit share codes (6 random digits + a Luhn check
   digit, so a mistyped code is caught before any lookup). This browser keeps a local pack
   library; a share link carries the whole pack in the URL so it opens on any device. The hosted
   pack service that resolves codes between devices is specified in docs/GDD.md §3. */
(function () {
  'use strict';
  const PP = window.PP; const { esc } = PP;
  const KINDS = {
    quip: { label: 'The Comedy Writer: prompts', key: 'quip', hint: 'One prompt per line.\nThe worst thing to say at a funeral', parse: l => l },
    gauntlet: { label: 'The Comedy Writer: Gauntlet blanks', key: 'gauntlet', hint: 'Use ____ for the blank.\nMy boss caught me ____.', parse: l => l.includes('____') ? l : null },
    fib: { label: 'The Bluffing Game: true facts', key: 'fib', hint: 'fact with ____ | true answer | lie, lie, lie\nThe first webcam watched a ____. | coffee pot | fish tank, door, cat', parse: l => { const [q, a, lies] = l.split('|').map(s => (s || '').trim()); if (!q || !q.includes('____') || !a) return null; const house = (lies || '').split(',').map(s => s.trim()).filter(Boolean); return { q, a, alts: [], house: house.length ? house : ['a sandwich', 'Belgium', 'a goat'] }; } },
    draw: { label: 'The Terrible Artist: drawing prompts', key: 'draw', hint: 'One prompt per line.\na sad lighthouse', parse: l => l },
    quiz: { label: 'The Cutthroat Quiz: questions', key: 'quiz', hint: 'question | right answer | wrong, wrong, wrong\nLargest planet? | Jupiter | Mars, Venus, Pluto', parse: l => { const [q, a, w] = l.split('|').map(s => (s || '').trim()); const wrong = (w || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3); if (!q || !a || wrong.length < 3) return null; const o = PP.shuffle([a].concat(wrong)); return { q, o, a: o.indexOf(a) }; } },
    pitch: { label: 'The Imposter\'s Pitch: products', key: 'pitch', hint: 'name | one-line pitch | three emoji\nCloud Socks | Socks that live in the cloud | ☁️ 🧦 💻', parse: l => { const [name, line, em] = l.split('|').map(s => (s || '').trim()); if (!name || !line) return null; const hints = Array.from((em || '').matchAll(/\p{Extended_Pictographic}/gu)).map(m => m[0]).slice(0, 3); while (hints.length < 3) hints.push(['✨', '📈', '🚀'][hints.length]); return { name, line, hints, words: line.toLowerCase().split(/\W+/).filter(w => w.length > 4).slice(0, 3).concat(['innovation']).slice(0, 3) }; } }
  };

  const luhn = digits => { let sum = 0; digits.split('').reverse().forEach((d, i) => { let n = Number(d); if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; } sum += n; }); return String((10 - (sum % 10)) % 10); };
  const newCode = () => { let s = ''; for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10); return s + luhn(s); };
  const validCode = c => /^\d{7}$/.test(c) && luhn(c.slice(0, 6)) === c[6];
  const lib = () => PP.prefs.get('packs', {});
  const b64 = { enc: o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), dec: s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))) };

  let active = null;
  PP.UGC = {
    KINDS, validCode, newCode,
    applyCode(code) {
      code = String(code || '').replace(/\D/g, '');
      if (!code) { active = null; return; }
      active = validCode(code) ? lib()[code] || null : null;
    },
    status() { return active ? `Active pack: "${esc(active.title)}" (${active.items.length} ${KINDS[active.kind].label}).` : 'No custom pack active.'; },
    /** Content with the active pack swapped in for its category. */
    content() { if (!active) return PP.CONTENT; const c = Object.assign({}, PP.CONTENT); const k = KINDS[active.kind].key; c[k] = active.items.length >= 3 ? active.items : PP.CONTENT[k].concat(active.items); return c; },
    save(pack) { const code = newCode(); const all = lib(); all[code] = pack; PP.prefs.set('packs', all); return code; },
    importFromUrl() { const q = new URLSearchParams(location.search).get('pack'); if (!q) return null; try { const { code, pack } = b64.dec(q); if (!validCode(code) || !KINDS[pack.kind]) return null; const all = lib(); all[code] = pack; PP.prefs.set('packs', all); return code; } catch (e) { return null; } },
    shareLink(code) { const pack = lib()[code]; return location.href.split('#')[0].split('?')[0] + '?pack=' + b64.enc({ code, pack }) + '#studio'; },

    /** The Prompt Studio page (index.html#studio). */
    studio(root) {
      const imported = PP.UGC.importFromUrl();
      const render = (msg) => {
        const all = lib();
        root.innerHTML = `<div class="studio"><h1 class="logo small">PROMPT STUDIO</h1>
          <p class="muted">Write your own prompts, save them as a pack, and play them by entering the 7-digit code in the Main Stage's Settings.</p>
          ${msg || ''}
          <form class="settings" id="pack-form">
            <label>Pack title <input name="title" maxlength="40" required placeholder="Office Party Roasts"></label>
            <label>Author <input name="author" maxlength="24" placeholder="Your name"></label>
            <label>Game <select name="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></label>
            <label>Items, one per line <textarea name="items" rows="10" required></textarea></label>
            <p class="muted tiny" id="hint"></p>
            <button class="btn primary">Save pack and get a code</button>
          </form>
          <h2>Your packs</h2>
          <div class="packs">${Object.keys(all).length ? Object.entries(all).map(([code, p]) => `<div class="pack"><b>${esc(p.title)}</b><small>${esc(KINDS[p.kind].label)} · ${p.items.length} items${p.author ? ' · by ' + esc(p.author) : ''}</small><span class="pcode">${code.slice(0, 3)}-${code.slice(3)}</span><button class="btn" data-share="${code}">Copy share link</button></div>`).join('') : '<p class="muted">No packs yet.</p>'}</div></div>`;
        const f = root.querySelector('#pack-form'); const hint = root.querySelector('#hint');
        const setHint = () => { hint.textContent = KINDS[f.kind.value].hint; f.items.placeholder = KINDS[f.kind.value].hint.split('\n')[1] || ''; };
        f.kind.onchange = setHint; setHint();
        f.onsubmit = e => {
          e.preventDefault();
          const K = KINDS[f.kind.value]; const lines = f.items.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 200);
          const bad = lines.filter(l => PP.filter.test(l));
          if (bad.length) { render(`<p class="error">${bad.length} line${bad.length === 1 ? '' : 's'} tripped the profanity filter. Public packs have to be family-friendly.</p>`); return; }
          const items = lines.map(K.parse).filter(Boolean);
          if (!items.length) { render('<p class="error">None of those lines matched the format for that game.</p>'); return; }
          const code = PP.UGC.save({ v: 1, title: f.title.value.trim(), author: f.author.value.trim(), kind: f.kind.value, items, created: Date.now() });
          render(`<p class="ok-msg">Saved ${items.length} item${items.length === 1 ? '' : 's'} (${lines.length - items.length} skipped). Share code: <b class="pcode">${code.slice(0, 3)}-${code.slice(3)}</b></p>`);
        };
        root.querySelectorAll('[data-share]').forEach(b => b.onclick = async () => { const link = PP.UGC.shareLink(b.dataset.share); try { await navigator.clipboard.writeText(link); b.textContent = 'Copied!'; } catch (e) { prompt('Copy this link', link); } });
      };
      render(imported ? `<p class="ok-msg">Imported pack <b class="pcode">${imported.slice(0, 3)}-${imported.slice(3)}</b>. Enter that code in the Main Stage's Settings to play it.</p>` : '');
    }
  };
})();
