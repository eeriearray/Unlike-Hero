/* Mafia — Narrator Studio (record.html): record, review and save one clip per line of the engine's SCRIPT.
   Takes are saved through the game server's localhost-only voice-pack endpoint into games/mafia/voice/. */
(function () {
  'use strict';
  var E = window.MafiaEngine, A = window.MafiaAudio;
  var base = location.pathname.replace(/[^/]*$/, '');
  var $ = function (id) { return document.getElementById(id); };
  var pack = { clips: {}, deepen: 0.95 };
  var ids = [];
  E.SCRIPT_GROUPS.forEach(function (g) { ids = ids.concat(g.ids); });
  var selected = null, recorder = null, recording = null, stream = null, meterRaf = 0;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function notice(text, bad) { var n = $('notice'); n.hidden = !text; n.textContent = text || ''; n.className = 'notice' + (bad ? ' error' : ''); }

  function loadPack() {
    return fetch(base + 'voice/index.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : { clips: {} }; })
      .catch(function () { return { clips: {} }; })
      .then(function (j) { pack = { clips: j.clips || {}, deepen: Number(j.deepen) || 1 }; render(); });
  }

  function render() {
    var done = ids.filter(function (id) { return pack.clips[id]; }).length;
    $('total').textContent = ids.length;
    $('progress').textContent = done + ' of ' + ids.length + ' lines recorded';
    $('bar').style.width = (100 * done / ids.length) + '%';
    $('deepen').value = pack.deepen; $('deepenv').textContent = Math.round((1 - pack.deepen) * 100) + '%';
    $('lines').innerHTML = E.SCRIPT_GROUPS.map(function (g) {
      return '<div class="group"><h2>' + esc(g.name) + '</h2><div class="stack">' + g.ids.map(function (id) {
        var has = !!pack.clips[id];
        return '<div class="line' + (id === selected ? ' sel' : '') + (id === recording ? ' rec' : '') + '" id="line-' + id + '" data-id="' + id + '">' +
          '<div><div class="words">' + esc(E.SCRIPT[id]) + '</div><div class="id">' + id + (has ? ' · <b>recorded</b>' : ' · not yet') + '</div>' +
          (id === recording ? '<div class="meter"><i id="meter"></i></div>' : '') + '</div>' +
          '<div class="tools">' +
            '<button class="btn small ' + (id === recording ? 'blood' : 'gold') + '" data-act="rec">' + (id === recording ? '<span class="rec-dot"></span>Stop' : has ? 'Re-record' : 'Record') + '</button>' +
            (has ? '<button class="btn small" data-act="play">Play</button><button class="btn small ghost" data-act="del" aria-label="Delete take">✕</button>' : '') +
            '<label class="btn small ghost">Upload<input type="file" accept="audio/*" data-act="upload" hidden></label>' +
          '</div></div>';
      }).join('') + '</div></div>';
    }).join('');
  }

  function select(id, scroll) {
    selected = id; render();
    if (scroll) { var el = $('line-' + id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }

  function clipUrl(id) { return base + 'voice/' + pack.clips[id] + '?v=' + Date.now(); }
  function play(id) { A.unlock(); A.stopVoice(); return A.playVoice(clipUrl(id), pack.deepen).catch(function () { notice('Could not play that take.', true); }); }

  function upload(id, blob, ext) {
    notice('Saving…');
    return fetch(base + 'voice-pack/clip?id=' + encodeURIComponent(id) + '&ext=' + ext, { method: 'PUT', body: blob })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Could not save (' + r.status + ').'); return j; }); })
      .then(function () { notice(''); return loadPack(); })
      .then(function () { play(id); })
      .catch(function (e) { notice(e.message + ' Run "npm start" and open http://localhost:8080/games/mafia/record.html on this computer.', true); });
  }

  function pickType() {
    var types = [['audio/webm;codecs=opus', 'webm'], ['audio/ogg;codecs=opus', 'ogg'], ['audio/mp4', 'm4a'], ['audio/webm', 'webm']];
    for (var i = 0; i < types.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i][0])) return types[i];
    return ['', 'webm'];
  }

  function startRecording(id) {
    if (!navigator.mediaDevices || !window.MediaRecorder) { notice('This browser cannot record audio. Try Chrome, Edge or Firefox.', true); return; }
    A.unlock(); A.stopVoice();
    var got = stream ? Promise.resolve(stream) : navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false, channelCount: 1 } });
    got.then(function (s) {
      stream = s;
      A.play('tick'); // the click: start speaking after it
      var type = pickType(), chunks = [];
      recorder = new MediaRecorder(s, type[0] ? { mimeType: type[0], audioBitsPerSecond: 96000 } : undefined);
      recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop = function () {
        cancelAnimationFrame(meterRaf);
        var blob = new Blob(chunks, { type: recorder.mimeType || type[0] || 'audio/webm' });
        recording = null; render();
        upload(id, blob, type[1]);
      };
      setTimeout(function () { recorder.start(); recording = id; selected = id; render(); meter(s); }, 180);
    }).catch(function () { notice('Microphone access was blocked. Allow it in the address bar and try again.', true); });
  }
  function stopRecording() { if (recorder && recorder.state === 'recording') recorder.stop(); }

  function meter(s) {
    try {
      var ac = new (window.AudioContext || window.webkitAudioContext)();
      var an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(s).connect(an);
      var data = new Uint8Array(an.fftSize);
      (function tick() {
        an.getByteTimeDomainData(data);
        var peak = 0; for (var i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
        var el = $('meter'); if (el) el.style.width = Math.min(100, peak * 140) + '%';
        if (recording) meterRaf = requestAnimationFrame(tick); else ac.close();
      })();
    } catch (e) { /* the meter is a nicety */ }
  }

  $('lines').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]'), line = e.target.closest('.line');
    if (!line) return;
    var id = line.getAttribute('data-id');
    if (!btn) { if (selected !== id) select(id); return; }
    var act = btn.getAttribute('data-act');
    if (act === 'rec') { if (recording === id) stopRecording(); else if (!recording) startRecording(id); }
    if (act === 'play') play(id);
    if (act === 'del' && confirm('Delete this take?')) {
      fetch(base + 'voice-pack/clip?id=' + encodeURIComponent(id), { method: 'DELETE' }).then(function (r) { if (!r.ok) throw new Error(); return loadPack(); })
        .catch(function () { notice('Could not delete — is the hub running on this computer?', true); });
    }
  });
  $('lines').addEventListener('change', function (e) {
    if (e.target.getAttribute('data-act') !== 'upload' || !e.target.files[0]) return;
    var f = e.target.files[0], id = e.target.closest('.line').getAttribute('data-id');
    var ext = (f.name.split('.').pop() || '').toLowerCase();
    if (['webm', 'ogg', 'mp3', 'm4a', 'wav'].indexOf(ext) < 0) { notice('Use an mp3, m4a, ogg, webm or wav file.', true); return; }
    upload(id, f, ext);
  });
  $('deepen').addEventListener('change', function (e) {
    var v = Number(e.target.value);
    fetch(base + 'voice-pack/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deepen: v }) })
      .then(function (r) { if (!r.ok) throw new Error(); return loadPack(); })
      .then(function () { var first = ids.filter(function (id) { return pack.clips[id]; })[0]; if (first) play(first); })
      .catch(function () { notice('Could not save the setting — is the hub running on this computer?', true); });
  });
  $('deepen').addEventListener('input', function (e) { $('deepenv').textContent = Math.round((1 - Number(e.target.value)) * 100) + '%'; });
  $('next').addEventListener('click', function () {
    var start = Math.max(0, ids.indexOf(selected));
    var next = ids.slice(start + 1).concat(ids.slice(0, start + 1)).filter(function (id) { return !pack.clips[id]; })[0];
    if (next) select(next, true); else notice('Every line is recorded. Commit the games/mafia/voice folder to share it.');
  });
  // A sample morning, played the way the game does.
  $('demo').addEventListener('click', function () {
    var lines = ['weather.1', 'found.1', 'mafia.2', 'role.doctor', 'gather.again'].filter(function (id) { return pack.clips[id]; });
    if (!lines.length) { notice('Record a weather line, a "body was found" line and a cause first.', true); return; }
    A.unlock();
    (function next(i) { if (i < lines.length) play(lines[i]).then(function () { setTimeout(function () { next(i + 1); }, 450); }); })(0);
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT') return;
    var i = ids.indexOf(selected);
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); if (recording) stopRecording(); else if (selected) startRecording(selected); }
    if (e.key === 'ArrowDown' && !recording) { e.preventDefault(); select(ids[Math.min(ids.length - 1, i + 1)], true); }
    if (e.key === 'ArrowUp' && !recording) { e.preventDefault(); select(ids[Math.max(0, i - 1)], true); }
    if ((e.key === 'p' || e.key === ' ') && selected && pack.clips[selected] && !recording) { e.preventDefault(); play(selected); }
  });

  if (location.protocol === 'file:' || !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
    notice('To save recordings, run "npm start" and open http://localhost:8080/games/mafia/record.html on the computer running the hub.', true);
  }
  selected = ids[0];
  loadPack();
})();
