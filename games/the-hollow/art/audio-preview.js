/* Local listening controls; no engine or saved expedition is loaded. */
(function () {
  'use strict';
  var audio = window.HollowAudio, $ = function (id) { return document.getElementById(id); }, started = false;
  ['master', 'music', 'ambient', 'sfx'].forEach(function (key) {
    var label = document.createElement('label'), input = document.createElement('input');
    label.textContent = key === 'ambient' ? 'Ambience' : key === 'sfx' ? 'SFX' : key[0].toUpperCase() + key.slice(1);
    input.type = 'range'; input.min = 0; input.max = 100; input.value = audio.settings()[key] * 100;
    input.addEventListener('input', function () { audio.setVolume(key, +input.value / 100); }); label.appendChild(input); $('volumes').appendChild(label);
  });
  function update() {
    audio.setState({ phase: 'playing', game: { haunt: +$('phase').value }, me: { status: 'alive', san: +$('sanity').value * 8, maxSan: 8 } });
    audio.setLevel((+$('phase').value - 1) / 2);
  }
  audio.onCaption(function (text) { $('caption').textContent = text; });
  // Preserve the user's caption preference; the preview only displays captions if enabled.
  $('start').onclick = function () { audio.unlock(); started = true; update(); $('start').textContent = 'Audio started'; };
  $('pause').onclick = function () { var b = audio.backend(); if (b) b.ctx.suspend().catch(function () {}); $('start').textContent = 'Resume audio'; };
  $('region').onchange = function () { audio.setRegion(this.value); update(); };
  $('place').onchange = function () { $('region').value = 'village'; audio.setRegion('village'); audio.setPlace(this.value || null); update(); };
  $('mood').onchange = function () { audio.setMood(this.value); };
  $('phase').onchange = $('sanity').onchange = update;
  $('play').onclick = async function () { if (!started) return; await audio.prepareAsset(window.HollowAudioMap.sfx[$('cue').value]); audio.sfx($('cue').value); };
  $('duck').onclick = function () { $('dialog').showModal(); };
  $('close').onclick = function () { $('dialog').close(); };
  $('mute').onclick = function () { audio.setMuted(!audio.settings().muted); this.textContent = audio.settings().muted ? 'Unmute' : 'Mute'; };
  $('mute').textContent = audio.settings().muted ? 'Unmute' : 'Mute';
  setInterval(function () {
    var d = audio.diagnostics(), m = window.HollowAudioMap;
    var describe = function (id) { var e = window.HollowAssets.get(id); return e ? e.source : 'synthesis fallback'; };
    $('status').textContent = d.state + ' · ' + d.region + ' · ' + d.mood + '\nMusic: ' + (d.music.map(describe).join(' → ') || 'synthesis fallback') + '\nBed: ' + (d.ambience.map(describe).join(', ') || 'synthesis fallback') + '\nDecoded cache: ' + d.decoded + ' cues / ' + (d.decodedBytes / 1048576).toFixed(1) + ' MiB\nCrossfade: ' + d.transitionSeconds + ' s · Sanity: ' + Math.round(d.sanity * 100) + '% · Phase: ' + d.phase + ' · Ducking: ' + (d.ducked ? 'on' : 'off');
  }, 500);
})();
