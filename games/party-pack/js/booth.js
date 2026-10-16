/* The Voice Booth (index.html#booth): record every host line in a real voice.
   Open it on the computer that runs the Main Stage: clips are kept in this browser (IndexedDB) and
   the Main Stage plays them instead of text-to-speech. Export/Import moves a recorded pack to
   another computer. Keyboard: Space = record/stop the selected line, Enter = play it, ↑/↓ = move. */
(function () {
  'use strict';
  const PP = window.PP; const { esc } = PP;
  const B = { root: null, sel: 0, rec: null, stream: null, analyser: null, lines: [] };
  const HOST_LABEL = k => k === 'edge' ? 'Every host (shared lines)' : (PP.HOSTS[k] || {}).name;
  const GAME_LABEL = k => k === 'edge' ? 'Ties, AFK, hype and other surprises. Played in whichever host is on stage.' : k === 'lobby' ? 'The lobby' : (PP.GAMES[k] || {}).title;

  function render() {
    const lines = B.lines = PP.scriptLines();
    const done = lines.filter(l => PP.Voice.clips.has(l.id)).length;
    const groups = [];
    lines.forEach((l, i) => { let g = groups.find(x => x.host === l.host); if (!g) groups.push(g = { host: l.host, items: [] }); g.items.push(Object.assign({ i }, l)); });
    B.root.innerHTML = `<div class="booth">
      <h1 class="logo small">VOICE BOOTH</h1>
      <p>Record each line in your best host voice. Do accents. Over-act. The Main Stage on this computer plays your recordings instead of the computer voice.
        Unrecorded lines still use the computer voice, so you can record a few at a time.</p>
      <div class="card-box">
        <div class="row" style="justify-content:space-between"><span class="progress">${done} / ${lines.length} recorded</span>
          <span class="row"><button class="btn" id="exp">Export pack</button><label class="btn">Import pack<input type="file" id="imp" accept="application/json" hidden></label></span></div>
        <p class="tiny" style="color:var(--card-muted);margin:8px 0 6px">Microphone level</p><div class="meter"><i id="lvl"></i></div>
        <p class="tiny" style="color:var(--card-muted)">Keys: <b>Space</b> record / stop · <b>Enter</b> play · <b>↑ ↓</b> move. After you stop, the next unrecorded line is selected.</p>
        <p class="tiny" id="tts-note" style="color:var(--card-muted)"></p>
      </div>
      ${groups.map(g => `<section class="card-box">
        <div class="booth-host">${PP.Art.host(g.host === 'edge' ? 'lobby' : g.host)}<div><h2>${esc(HOST_LABEL(g.host))}</h2><small>${esc(GAME_LABEL(g.host) || '')}</small></div>
          ${g.host === 'edge' ? '' : `<label class="tiny">Voice character<br><input type="range" min="0.8" max="1.2" step="0.02" value="${PP.Voice.character[g.host] || 1}" data-char="${g.host}" aria-label="Voice character for ${esc(HOST_LABEL(g.host))}"><br><span style="color:var(--card-muted)">deeper ← → brighter</span></label>`}</div>
        ${g.items.map(l => `<div class="booth-line ${PP.Voice.clips.has(l.id) ? 'has' : ''} ${B.sel === l.i ? 'sel' : ''}" data-i="${l.i}" id="line-${l.i}" style="${B.sel === l.i ? 'outline:4px solid var(--accent);border-radius:10px' : ''}">
          <div><p><span class="rec-dot"></span>${esc(l.text)}</p><small>${esc(l.key)}</small></div>
          <div class="row"><button class="btn rec-btn" data-rec="${l.i}">${B.rec && B.rec.i === l.i ? '■ Stop' : '● Rec'}</button><button class="btn" data-play="${l.i}" ${PP.Voice.clips.has(l.id) ? '' : 'disabled'}>▶</button><button class="btn" data-del="${l.i}" ${PP.Voice.clips.has(l.id) ? '' : 'disabled'} aria-label="Delete recording">✕</button></div>
        </div>`).join('')}
      </section>`).join('')}
    </div>`;
    const tn = B.root.querySelector('#tts-note');
    tn.textContent = PP.Voice.hasNaturalVoice && !PP.Voice.hasNaturalVoice()
      ? 'Tip: this computer has no high-quality voices installed, so unrecorded lines sound robotic. On a Mac: System Settings → Accessibility → Spoken Content → System voice → Manage Voices, and download a "Premium" English voice.'
      : '';
    B.root.querySelectorAll('[data-rec]').forEach(b => b.onclick = () => { B.sel = Number(b.dataset.rec); toggleRec(); });
    B.root.querySelectorAll('[data-play]').forEach(b => b.onclick = () => { B.sel = Number(b.dataset.play); play(); });
    B.root.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { const l = B.lines[Number(b.dataset.del)]; await PP.Voice.deleteClip(l.id); render(); });
    B.root.querySelectorAll('.booth-line').forEach(el => el.onclick = e => { if (e.target.closest('button')) return; B.sel = Number(el.dataset.i); render(); });
    B.root.querySelectorAll('[data-char]').forEach(r => r.onchange = () => {
      PP.Voice.setCharacter(r.dataset.char, Number(r.value));
      const sample = B.lines.find(l => l.host === r.dataset.char && PP.Voice.clips.has(l.id));
      if (sample) PP.Voice.playClip(sample.id, r.dataset.char);
    });
    B.root.querySelector('#exp').onclick = exportPack;
    B.root.querySelector('#imp').onchange = e => importPack(e.target.files[0]);
  }

  async function mic() {
    if (B.stream) return B.stream;
    B.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
    const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC();
    const src = ac.createMediaStreamSource(B.stream); B.analyser = ac.createAnalyser(); B.analyser.fftSize = 512; src.connect(B.analyser);
    const data = new Uint8Array(B.analyser.fftSize);
    const tick = () => { B.analyser.getByteTimeDomainData(data); let peak = 0; for (const v of data) peak = Math.max(peak, Math.abs(v - 128)); const el = document.getElementById('lvl'); if (el) el.style.width = Math.min(100, peak / 1.1) + '%'; requestAnimationFrame(tick); };
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
      if (blob.size > 2000) { await PP.Voice.saveClip(line.id, blob); await PP.Voice.playClip(line.id, line.host === 'edge' ? 'lobby' : line.host); }
      const next = B.lines.findIndex((l, i) => i > B.sel && !PP.Voice.clips.has(l.id)); if (next >= 0) B.sel = next;
      render(); const el = document.getElementById('line-' + B.sel); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    B.rec = { mr, i: B.sel }; mr.start(); render();
    const el = document.getElementById('line-' + B.sel); if (el) el.classList.add('recording');
  }
  function play() { const l = B.lines[B.sel]; if (l && PP.Voice.clips.has(l.id)) PP.Voice.playClip(l.id, l.host === 'edge' ? 'lobby' : l.host); else if (l) PP.Voice.preview(l.text, l.host); }

  async function exportPack() {
    const out = { v: 1, character: PP.Voice.character, clips: {} };
    for (const [id, blob] of PP.Voice.clips) if (blob instanceof Blob) out.clips[id] = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' })); a.download = 'party-pack-voice.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function importPack(file) {
    if (!file) return;
    try {
      const j = JSON.parse(await file.text()); const known = new Set(PP.scriptLines().map(l => l.id)); let n = 0;
      for (const [id, url] of Object.entries(j.clips || {})) { if (!known.has(id) || !/^data:audio\//.test(url)) continue; await PP.Voice.saveClip(id, await fetch(url).then(r => r.blob())); n++; }
      Object.entries(j.character || {}).forEach(([k, v]) => { if (PP.HOSTS[k] && v >= 0.8 && v <= 1.2) PP.Voice.setCharacter(k, Number(v)); });
      render(); alert(`Imported ${n} recordings.`);
    } catch (e) { alert('That file isn\'t a Party Pack voice pack.'); }
  }

  PP.Booth = {
    start(root) {
      B.root = root; document.documentElement.dataset.theme = 'lobby';
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
