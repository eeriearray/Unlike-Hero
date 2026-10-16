/* The Voice Booth (index.html#booth): give the hosts real voices.
   Upload text-to-speech files or record lines with a microphone. With the hub server running (npm start) and
   the page opened from localhost, every clip is saved into games/party-pack/voice/ so it can be committed and
   every Main Stage gets the same cast. Without the server, clips are kept in this browser only.
   The full script with filenames is in voice/SCRIPT.md (and voice/script.csv).
   Keyboard: Space = record/stop the selected line, Enter = play it, ↑/↓ = move. */
(function () {
  'use strict';
  const PP = window.PP; const { esc } = PP;
  const B = { root: null, sel: 0, rec: null, stream: null, lines: [], server: false, msg: '' };
  const AUDIO_EXT = ['mp3', 'm4a', 'wav', 'ogg', 'webm'];
  const HOST_LABEL = k => k === 'edge' ? 'The Announcer: shared lines' : (PP.HOSTS[k] || {}).name;
  const GAME_LABEL = k => k === 'edge' ? 'Ties, AFK, hype and other surprises, in every game.' : k === 'lobby' ? 'The lobby, between games' : (PP.GAMES[k] || {}).title;
  const has = id => PP.Voice.clips.has(id);
  const inFolder = id => typeof PP.Voice.clips.get(id) === 'string';

  // ---------- saving ----------
  async function save(id, blob, ext) {
    if (B.server) {
      const r = await fetch('voice-pack/clip?id=' + encodeURIComponent(id) + '&ext=' + ext, { method: 'PUT', body: blob });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
      if (PP.Voice.clips.get(id) instanceof Blob) await PP.Voice.deleteClip(id);   // the folder copy wins from now on
      return;
    }
    await PP.Voice.saveClip(id, blob);
  }
  async function remove(id) {
    if (inFolder(id) && B.server) { const r = await fetch('voice-pack/clip?id=' + encodeURIComponent(id), { method: 'DELETE' }); if (!r.ok) throw new Error('HTTP ' + r.status); }
    else await PP.Voice.deleteClip(id);
  }
  async function uploadMany(files) {
    const known = new Map(B.lines.map(l => [l.id, l])); let ok = 0; const skipped = [], failed = [];
    B.msg = `Uploading ${files.length} file${files.length === 1 ? '' : 's'}…`; render();
    for (const f of files) {
      const m = /^(.+)\.([a-z0-9]+)$/i.exec(f.name.trim()); const id = m && m[1].trim(); const ext = m && m[2].toLowerCase();
      if (!id || !known.has(id) || !AUDIO_EXT.includes(ext)) { skipped.push(f.name); continue; }
      try { await save(id, f, ext); ok++; } catch (e) { failed.push(`${f.name} (${e.message})`); }
    }
    await PP.Voice.reload();
    B.msg = `Saved ${ok} line${ok === 1 ? '' : 's'}${B.server ? ' into games/party-pack/voice/' : ' in this browser'}.`
      + (skipped.length ? ` Skipped ${skipped.length} file${skipped.length === 1 ? '' : 's'} whose name isn't a line id: ${skipped.slice(0, 6).join(', ')}${skipped.length > 6 ? '…' : ''}.` : '')
      + (failed.length ? ` Failed: ${failed.join(', ')}.` : '');
    render();
  }

  // ---------- page ----------
  function render() {
    const lines = B.lines = PP.scriptLines();
    const done = lines.filter(l => has(l.id)).length;
    const groups = [];
    lines.forEach((l, i) => { let g = groups.find(x => x.host === l.host); if (!g) groups.push(g = { host: l.host, items: [] }); g.items.push(Object.assign({ i }, l)); });
    B.root.innerHTML = `<div class="booth">
      <h1 class="logo small">VOICE BOOTH</h1>
      <p>Give the hosts real voices. Make each line with a text-to-speech service (or record it), name the file after the line
        (for example <code>quip.intro.0.mp3</code>) and upload them all at once. The full script with filenames and casting notes is in
        <a href="voice/SCRIPT.md" target="_blank">voice/SCRIPT.md</a> (spreadsheet: <a href="voice/script.csv" download>script.csv</a>).</p>
      <div class="card-box">
        <div class="row" style="justify-content:space-between"><span class="progress">${done} / ${lines.length} lines voiced</span>
          <span class="row"><label class="btn primary">Upload files<input type="file" id="many" accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm" multiple hidden></label>
          <button class="btn" id="exp">Export pack</button><label class="btn">Import pack<input type="file" id="imp" accept="application/json" hidden></label></span></div>
        <p class="tiny" style="color:var(--card-muted);margin:10px 0 0">${B.server
          ? '<b style="color:#1a8f4c">Saving into the game folder</b> (games/party-pack/voice/). When you\'re done: <code>git add games/party-pack/voice</code>, commit and push, and every computer gets these voices.'
          : '<b style="color:#c0392b">Saving in this browser only.</b> To save into the game folder, run <code>npm start</code> and open this page at <code>http://localhost:8080/games/party-pack/#booth</code> on the same computer.'}</p>
        ${B.msg ? `<p class="ok-msg" style="margin-top:10px">${esc(B.msg)}</p>` : ''}
        <p class="tiny" style="color:var(--card-muted);margin:10px 0 6px">Microphone level (for recording yourself)</p><div class="meter"><i id="lvl"></i></div>
        <p class="tiny" style="color:var(--card-muted)">Keys: <b>Space</b> record / stop · <b>Enter</b> play · <b>↑ ↓</b> move.</p>
      </div>
      ${groups.map(g => `<section class="card-box">
        <div class="booth-host">${PP.Art.host(g.host === 'edge' ? 'lobby' : g.host)}<div><h2>${esc(HOST_LABEL(g.host))}</h2><small>${esc(GAME_LABEL(g.host) || '')}</small><br><small><b>Voice:</b> ${esc((PP.HOSTS[g.host === 'edge' ? 'lobby' : g.host] || {}).cast || '')}</small></div>
          ${g.host === 'edge' ? '' : `<label class="tiny">Character (your own recordings)<br><input type="range" min="0.8" max="1.2" step="0.02" value="${PP.Voice.character[g.host] || 1}" data-char="${g.host}" aria-label="Voice character for ${esc(HOST_LABEL(g.host))}"><br><span style="color:var(--card-muted)">deeper ← → brighter</span></label>`}</div>
        ${g.items.map(l => `<div class="booth-line ${has(l.id) ? 'has' : ''}" data-i="${l.i}" id="line-${l.i}" style="${B.sel === l.i ? 'outline:4px solid var(--accent);border-radius:10px' : ''}">
          <div><p><span class="rec-dot"></span>${esc(l.text)}</p><small><code>${esc(l.id)}.mp3</code>${has(l.id) ? (inFolder(l.id) ? ' · in the game folder' : ' · in this browser') : ''}</small></div>
          <div class="row"><button class="btn rec-btn" data-rec="${l.i}">${B.rec && B.rec.i === l.i ? '■ Stop' : '● Rec'}</button><label class="btn" title="Upload a file for this line">⤒<input type="file" accept="audio/*" data-up="${l.i}" hidden></label><button class="btn" data-play="${l.i}" aria-label="Play">▶</button><button class="btn" data-del="${l.i}" ${has(l.id) ? '' : 'disabled'} aria-label="Delete">✕</button></div>
        </div>`).join('')}
      </section>`).join('')}
    </div>`;
    B.root.querySelectorAll('[data-rec]').forEach(b => b.onclick = () => { B.sel = Number(b.dataset.rec); toggleRec(); });
    B.root.querySelectorAll('[data-play]').forEach(b => b.onclick = () => { B.sel = Number(b.dataset.play); play(); });
    B.root.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { const l = B.lines[Number(b.dataset.del)]; try { await remove(l.id); await PP.Voice.reload(); } catch (e) { B.msg = 'Could not delete: ' + e.message; render(); } });
    B.root.querySelectorAll('[data-up]').forEach(inp => inp.onchange = async () => {
      const l = B.lines[Number(inp.dataset.up)]; const f = inp.files[0]; if (!f) return;
      const ext = (/\.([a-z0-9]+)$/i.exec(f.name) || [])[1]; const e2 = ext && AUDIO_EXT.includes(ext.toLowerCase()) ? ext.toLowerCase() : 'mp3';
      try { await save(l.id, f, e2); await PP.Voice.reload(); B.msg = `Saved ${l.id}.`; } catch (e) { B.msg = 'Upload failed: ' + e.message; } render();
    });
    B.root.querySelectorAll('.booth-line').forEach(el => el.onclick = e => { if (e.target.closest('button,label,input')) return; B.sel = Number(el.dataset.i); render(); });
    B.root.querySelectorAll('[data-char]').forEach(r => r.onchange = () => {
      PP.Voice.setCharacter(r.dataset.char, Number(r.value));
      const sample = B.lines.find(l => l.host === r.dataset.char && PP.Voice.clips.get(l.id) instanceof Blob);
      if (sample) PP.Voice.playClip(sample.id, r.dataset.char);
    });
    B.root.querySelector('#many').onchange = e => uploadMany([...e.target.files]);
    B.root.querySelector('#exp').onclick = exportPack;
    B.root.querySelector('#imp').onchange = e => importPack(e.target.files[0]);
  }

  // ---------- recording ----------
  async function mic() {
    if (B.stream) return B.stream;
    B.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
    const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC();
    const an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(B.stream).connect(an);
    const data = new Uint8Array(an.fftSize);
    const tick = () => { an.getByteTimeDomainData(data); let peak = 0; for (const v of data) peak = Math.max(peak, Math.abs(v - 128)); const el = document.getElementById('lvl'); if (el) el.style.width = Math.min(100, peak / 1.1) + '%'; requestAnimationFrame(tick); };
    tick();
    return B.stream;
  }
  async function toggleRec() {
    if (B.rec) { B.rec.mr.stop(); return; }
    let stream; try { stream = await mic(); } catch (e) { alert('The microphone is blocked. Allow microphone access for this page and try again.'); return; }
    const line = B.lines[B.sel]; const chunks = [];
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = async () => {
      B.rec = null;
      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
      if (blob.size > 2000) {
        try { await save(line.id, blob, /mp4/.test(blob.type) ? 'm4a' : 'webm'); await PP.Voice.reload(); await PP.Voice.playClip(line.id, line.host); }
        catch (e) { B.msg = 'Could not save: ' + e.message; }
      }
      const next = B.lines.findIndex((l, i) => i > B.sel && !has(l.id)); if (next >= 0) B.sel = next;
      render(); const el = document.getElementById('line-' + B.sel); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    B.rec = { mr, i: B.sel }; mr.start(); render();
    const el = document.getElementById('line-' + B.sel); if (el) el.classList.add('recording');
  }
  function play() { const l = B.lines[B.sel]; if (l && has(l.id)) PP.Voice.playClip(l.id, l.host); else if (l) PP.Voice.preview(l.text, l.host); }

  // ---------- moving a browser-only pack between computers ----------
  async function exportPack() {
    const out = { v: 1, character: PP.Voice.character, clips: {} };
    for (const [id, src] of PP.Voice.clips) {
      const blob = src instanceof Blob ? src : await fetch(src).then(r => r.ok ? r.blob() : null).catch(() => null);
      if (blob) out.clips[id] = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' })); a.download = 'party-pack-voice.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function importPack(file) {
    if (!file) return;
    try {
      const j = JSON.parse(await file.text()); const known = new Set(PP.scriptLines().map(l => l.id)); let n = 0;
      for (const [id, url] of Object.entries(j.clips || {})) {
        if (!known.has(id) || !/^data:audio\//.test(url)) continue;
        const blob = await fetch(url).then(r => r.blob()); const ext = (/audio\/(mpeg|mp4|wav|ogg|webm)/.exec(blob.type) || [])[1];
        await save(id, blob, { mpeg: 'mp3', mp4: 'm4a' }[ext] || ext || 'webm'); n++;
      }
      Object.entries(j.character || {}).forEach(([k, v]) => { if (PP.HOSTS[k] && v >= 0.8 && v <= 1.2) PP.Voice.setCharacter(k, Number(v)); });
      await PP.Voice.reload(); B.msg = `Imported ${n} lines.`; render();
    } catch (e) { alert('That file isn\'t a Party Pack voice pack.'); }
  }

  PP.Booth = {
    async start(root) {
      B.root = root; document.documentElement.dataset.theme = 'lobby';
      try { const r = await fetch('voice-pack/status', { cache: 'no-store' }); B.server = r.ok && (await r.json()).ok === true; } catch (e) { B.server = false; }
      PP.Voice.onChange(render); render();
      document.addEventListener('keydown', e => {
        if (e.target.closest('input,textarea,select')) return;
        if (e.code === 'Space') { e.preventDefault(); toggleRec(); }
        else if (e.key === 'Enter') { e.preventDefault(); play(); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (B.rec) return; B.sel = PP.clamp(B.sel + (e.key === 'ArrowDown' ? 1 : -1), 0, B.lines.length - 1); render(); const el = document.getElementById('line-' + B.sel); if (el) el.scrollIntoView({ block: 'center' }); }
      });
    }
  };
})();
