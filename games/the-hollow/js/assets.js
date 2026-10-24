/* Single optional-media registry. A null result means: retain procedural art/audio.
 * Startup loads only the manifest. Scene callers preload current and likely next
 * places; shared icons and audio remain on demand. Never invent an asset URL. */
(function (g) {
  'use strict';
  var entries = Object.create(null), groups = Object.create(null), cache = new Map(), resident = new Map(), pinned = null;
  var imageBudget = 48 * 1024 * 1024, backgroundLimit = 6;
  var allowed = Object.create(null);
  var base = new URL('../', document.currentScript.src);
  var ready = fetch(new URL('art/manifest.json', base)).then(function (r) {
    if (!r.ok) return null;
    return r.json();
  }).then(function (manifest) {
    if (!manifest || manifest.version !== 1 || !manifest.assets) return;
    Object.keys(manifest.assets).forEach(function (id) {
      var entry = manifest.assets[id];
      if (!entry || !/^art\/generated\/[a-z0-9_]+\.(webp|ogg|mp3|ttf|mp4)$/.test(entry.file)) return;
      if (!['image', 'audio', 'font', 'video'].includes(entry.type)) return;
      entries[id] = Object.freeze(Object.assign({}, entry));
      allowed[entry.file] = true;
      (entry.regions || []).forEach(function (region) { (groups[region] || (groups[region] = [])).push(id); });
    });
  }).catch(function () { /* Missing manifest/offline: procedural-only mode. */ });
  function get(id) { return Object.prototype.hasOwnProperty.call(entries, id) ? entries[id] : null; }
  function url(id) {
    var e = get(id); if (!e) return null;
    var path = new URL(e.file, base);
    // Replacements keep stable IDs; their content hash bypasses stale media caches.
    if (/^[a-f0-9]{64}$/.test(e.sha256 || '')) path.searchParams.set('v', e.sha256.slice(0, 16));
    return path.href;
  }
  function remove(id) { cache.delete(id); resident.delete(id); }
  function stats() {
    var backgrounds = 0, bytes = 0;
    resident.forEach(function (r) { if (r.background) { backgrounds++; bytes += r.bytes; } });
    return { entries: cache.size, backgrounds: backgrounds, backgroundBytes: bytes, backgroundLimit: backgroundLimit, imageBudget: imageBudget };
  }
  function trim() {
    var size = stats();
    for (var id of cache.keys()) {
      var r = resident.get(id);
      if (id === pinned || !r) continue;
      if (cache.size > 64 || r.background && (size.backgrounds > backgroundLimit || size.backgroundBytes > imageBudget)) { remove(id); size = stats(); }
    }
  }
  function load(id) {
    return ready.then(function () {
      var e = get(id);
      if (!e || e.type === 'video') return null;
      if (cache.has(id)) { var hit = cache.get(id); cache.delete(id); cache.set(id, hit); return hit; }
      var request;
      if (e.type === 'image') {
        request = new Promise(function (resolve) {
          var img = new Image();
          img.decoding = 'async';
          img.onload = function () {
            if (img.decode) img.decode().then(function () { resolve(img); }).catch(function () { resolve(null); });
            else resolve(img);
          };
          img.onerror = function () { delete allowed[e.file]; resolve(null); };
          img.src = url(id);
        });
      } else {
        request = fetch(url(id)).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).catch(function () { return null; });
      }
      request = request.then(function (value) {
        if (value && e.type === 'image' && cache.has(id)) {
          resident.set(id, { bytes: (value.naturalWidth || 0) * (value.naturalHeight || 0) * 4, background: (e.regions || []).some(function (r) { return r !== 'shared'; }) }); trim();
        }
        return value;
      });
      cache.set(id, request);
      return request;
    });
  }
  function preloadRegion(region) {
    // Sequential loading prevents large request bursts; no global preload.
    return ready.then(async function () {
      var ids = (groups[region] || []).filter(function (id) { return entries[id].type === 'image'; });
      for (var i = 0; i < ids.length; i++) await load(ids[i]);
    });
  }
  function releaseRegion(region) {
    (groups[region] || []).forEach(remove);
  }
  // Consumers must keep SVG/synthesis visible until load succeeds. decodeAudioData
  // can also reject: callers must catch that and use their synthesised fallback.
  g.HollowAssets = Object.freeze({ ready: ready, get: get, url: url, load: load,
    preloadRegion: preloadRegion, releaseRegion: releaseRegion, release: remove, keep: function (id) { pinned = get(id) ? id : null; trim(); }, stats: stats, allowedPaths: allowed });
})(window);
