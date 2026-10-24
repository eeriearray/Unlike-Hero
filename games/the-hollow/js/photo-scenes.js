/* Optional single-image stage mode. No game rules, mutations or guessed asset paths.
 * Metadata is loaded per place; SVG remains available throughout every async load. */
(function (g) {
  'use strict';
  var A = g.HollowArt, assets = g.HollowAssets;
  var base = new URL('../', document.currentScript.src);
  var index = {}, configs = {}, pending = {}, definitions = {}, active = null, serial = 0;
  function json(file) {
    return fetch(new URL(file, base)).then(function (r) {
      if (!r.ok) throw new Error('Optional scene metadata unavailable');
      return r.json();
    });
  }
  var ready = json('art/scenes/index.json').then(function (data) {
    if (data.version === 1 && data.places) index = data.places;
  }).catch(function () {});
  function validHotspots(list) {
    return Array.isArray(list) && list.every(function (h) {
      return /^[a-z0-9_]+$/.test(h.id) && typeof h.label === 'string' &&
        [h.x,h.y,h.w,h.h].every(Number.isFinite) && h.w > 0 && h.h > 0 &&
        h.x >= 0 && h.y >= 0 && h.x + h.w <= 1600 && h.y + h.h <= 900 &&
        (h.closeup === undefined || /^[a-z0-9_]+$/.test(h.closeup)) &&
        (typeof h.optionId === 'string' || ['investigate','travel'].includes(h.action) || typeof h.move === 'string');
    });
  }
  function valid(c, id) {
    return c && c.id === id && /^[a-z_]+$/.test(c.region) && c.viewBox &&
      c.viewBox[0] === 1600 && c.viewBox[1] === 900 && typeof c.background === 'string' &&
      validHotspots(c.hotspots) && (!c.interiorHotspots || validHotspots(c.interiorHotspots));
  }
  function ensure(id) {
    if (pending[id]) return pending[id];
    pending[id] = ready.then(function () {
      if (!Object.prototype.hasOwnProperty.call(index, id)) return null;
      var file = index[id].file;
      if (file !== 'art/scenes/' + id + '.json') return null;
      return json(file).then(function (c) {
        if (!valid(c, id)) return null;
        configs[id] = c;
        return c;
      });
    }).catch(function () { return null; });
    return pending[id];
  }
  function marker(h, i) {
    var x = h.x + h.w / 2, y = h.y + h.h / 2;
    var label = h.action === 'travel' ? 'TRAVEL' : h.action === 'investigate' ? 'INVESTIGATE' : h.move ? 'BELL TOWER' : h.label.replace(/^(the|a) /i, '');
    if (label.length > 27) label = label.slice(0, 25) + '…';
    return '<g class="photo-marker"><circle class="marker-ring" cx="' + x + '" cy="' + (y - 15) + '" r="23"/>' +
      '<text class="marker-number" x="' + x + '" y="' + (y - 8) + '">' + (h.action === 'travel' ? '↗' : h.action === 'investigate' ? '⌕' : i + 1) + '</text>' +
      '<rect class="marker-label" x="' + (x - 146) + '" y="' + (y + 21) + '" width="292" height="38" rx="19"/>' +
      '<text class="marker-name" x="' + x + '" y="' + (y + 46) + '">' + A.esc(label) + '</text></g>';
  }
  function layout(c, v) {
    var inside = c.id === 'belltower' && v && (!v.opening || v.opening.complete || v.opening.evidence && v.opening.evidence.entered || v.world && v.world.flags && v.world.flags.opening_entered);
    return inside && c.interiorHotspots ? Object.assign({}, c, { hotspots: c.interiorHotspots }) : c;
  }
  function make(c, fallback) {
    var objects = {};
    c.hotspots.forEach(function (h, i) {
      var old = fallback.objects[h.id] || {};
      objects[h.id] = { name: h.label, box: [h.x, h.y, h.w, h.h], at: [h.x + h.w / 2, h.y + h.h / 2],
        crop: [Math.max(0, h.x - 100), Math.max(0, h.y - 80), h.w + 200, h.h + 160], z: 1.7, closeup: h.closeup || null,
        actions: h.optionId ? [{ opt: h.optionId }] : h.action ? [{ act: h.action }] : [{ move: h.move }],
        sfx: h.sfx || (c.id === 'belltower' ? (h.id === 'frame' ? 'bellframe' : h.id === 'listen' || h.id === 'climb' ? 'rope' : old.sfx) : old.sfx), blurb: old.blurb, art: function () { return marker(h, i); } };
    });
    return { id: c.id, vb: c.viewBox, photo: true, defs: '', objects: objects, fx: fallback.fx || {},
      layers: function () {
        var cat = g.HollowStage.cat(), l = cat.locations[c.id], r = cat.regions[l.region];
        return [{ id: 'photo-base', depth: 0.4, raw: true, svg: A.scene(l.scene, l.id, r.color, l.region, l.glyph) },
          { id: 'objects', depth: 0.62, objects: true }];
      },
      state: function (world, st) {
        // Never reveal hidden encounter choices until the authoritative view does.
        var v = g.HollowUI.S.view, options = v && v.enc && v.enc.loc === c.id ? v.enc.options || [] : [];
        c.hotspots.forEach(function (h) {
          var el = world.querySelector('.obj-' + h.id);
          if (!el) return;
          var conceal = h.hidden && !options.some(function (o) { return o.id === h.optionId; });
          el.style.display = conceal ? 'none' : '';
          el.setAttribute('tabindex', conceal ? '-1' : '0');
          el.setAttribute('aria-hidden', conceal ? 'true' : 'false');
        });
        update(world, c, st);
      } };
  }
  function background(c, phase, v) {
    var entered = v && (!v.opening || v.opening.id === 'frame' || v.opening.complete || v.world && v.world.flags && v.world.flags.opening_entered);
    if (c.id === 'belltower' && c.interiorBackground && entered) return c.interiorBackground;
    return (c.moods || {})[phase >= 3 ? 'otherworld' : phase >= 2 ? 'night' : 'dusk'] || c.background;
  }
  function update(world, c, st) {
    var layer = world.querySelector('.lyr-photo-base');
    if (!layer) return;
    var host = world.parentNode;
    host.classList.add('photo-scene'); host.setAttribute('data-region', c.region);
    host.setAttribute('data-art-source', c.artDirection || 'legacy');
    host.classList.toggle('photo-still', g.HollowFx.reduced());
    if (!layer.querySelector('.photo-atmosphere')) {
      var air = document.createElement('div'); air.className = 'photo-atmosphere'; air.setAttribute('aria-hidden', 'true');
      air.innerHTML = '<i class="photo-fog fog-back"></i><i class="photo-fog fog-front"></i><i class="photo-dust"></i><i class="photo-grain"></i>';
      layer.appendChild(air);
    }
    var id = background(c, st.phase, g.HollowUI.S.view);
    if (layer.dataset.asset === id) return;
    layer.dataset.asset = id;
    if (assets.keep) assets.keep(id);
    host.classList.add('photo-loading');
    var note = host.querySelector('.photo-loading-note');
    if (!note) { note = document.createElement('span'); note.className = 'photo-loading-note'; note.setAttribute('role', 'status'); host.appendChild(note); }
    note.textContent = 'The mist is lifting…';
    assets.load(id).then(function (image) {
      if (!layer.isConnected || layer.dataset.asset !== id) return;
      host.classList.remove('photo-loading'); note.textContent = '';
      if (!image || image.tagName !== 'IMG') return; // Procedural artwork remains behind the image.
      var picture = image.cloneNode(); picture.className = 'photo-backdrop'; picture.alt = ''; picture.setAttribute('aria-hidden', 'true');
      var old = layer.querySelector('.photo-backdrop');
      layer.insertBefore(picture, layer.firstChild);
      if (old) old.remove();
      var depth = layer.querySelector('.photo-depth');
      if (!depth) { depth = document.createElement('div'); depth.className = 'photo-depth'; depth.setAttribute('aria-hidden', 'true'); layer.appendChild(depth); }
      depth.style.backgroundImage = 'url("' + image.src + '")';
      layer.classList.add('photo-loaded');
    });
  }
  // Inspections are free observations; acquired evidence comes only from the engine view.
  function describe(place, object, v) {
    var e = v && v.opening && v.opening.evidence || {};
    var descriptions = {
      'square:board': e.board ? 'Your name is still wet beneath the forty-year-old removal certificate. The chapel keeps the record that explains it.' : 'Old paper, a fresh seal. The tower’s removal certificate looks newer than every notice around it.',
      'square:well': e.board ? 'Each drop rises as if pulled by the toll. The notice has changed; the well seems to be listening.' : 'Water climbs the stone instead of falling. Below the rim, the square’s sounds arrive a moment late.',
      'chapel:vestry': e.record ? 'The recovered entry stays legible: bell lowered, doorway flooded, a dry route marked on the keeper’s grave.' : 'A narrow recess beside the altar. Paper and burial salts survive beneath the dust. The keeper stored the tower records here.',
      'chapel:altar': 'Candlelight gathers around the broken altar. For a moment, the woodwork stops creaking.',
      'graveyard:headstones': e.route ? 'The bell-marked stone has no iron nameplate. Behind it, the keeper’s diagram shows the dry passage. You can reread it without spending an action.' : 'Tool marks run around the edges of the stones. Their iron plates were removed carefully; this was work, not weather.',
      'belltower:entrance': 'Water laps over the threshold. The door is swollen in its frame. You can inspect the entrance freely before choosing a way inside.',
      'belltower:frame': e.response === 'muffle' ? 'The rope is bound to the yoke. The next pull strains against your knot; the note below is slower.' : e.revealed ? 'The frame has no bell. Its inscription names the Abbey foundations and the magistrate’s library. The vibration rises through your feet.' : 'Grave-marks are cast into the empty yoke. The bell is gone, but the iron still trembles.',
      'belltower:listen': e.entered ? 'The rope disappears into the floor. It tightens before each sound, as though pulled from beneath the tower.' : 'The sound comes through the closed door. You will need to enter before you can examine the rope.'
    };
    return descriptions[place + ':' + object] || '';
  }
  function preloadPlan(id, view) {
    if (!index[id]) return [];
    var seen = view && view.map && view.map.locs || {}, moves = view && view.act && view.act.moves;
    var next = moves ? moves.filter(function (m) { return m.ok; }).map(function (m) { return m.to; }) : (index[id].neighbours || []);
    next = next.filter(function (key) { return key !== id && index[key] && seen[key] && (index[id].neighbours || []).includes(key); });
    next.sort(function (a, b) { return Number(index[a].region !== index[id].region) - Number(index[b].region !== index[id].region); });
    return [id].concat(next.slice(0, 2));
  }
  function preload(id) {
    var token = ++serial;
    ready.then(async function () {
      // Current scene plus two known, legal neighbours. No global or hidden-route sweep.
      var ids = preloadPlan(id, g.HollowUI.S.view);
      for (var i = 0; i < ids.length; i++) {
        if (token !== serial) return;
        var c = await ensure(ids[i]);
        if (c) await assets.load(background(c, g.HollowUI.S.view && g.HollowUI.S.view.game && g.HollowUI.S.view.game.haunt || 1, g.HollowUI.S.view));
      }
    });
  }
  g.HollowPhotoScenes = {
    ready: ready, layout: layout, describe: describe, background: background, ensure: ensure, preloadPlan: preloadPlan,
    closeup: function (d, id, cls) {
      var c = layout(configs[d.id], g.HollowUI.S.view), crop = d.objects[id].crop;
      var host = g.HollowStage.el(), phase = host ? Number(host.getAttribute('data-phase')) : 1;
      var hotspot = c.hotspots.find(function (h) { return h.id === id; });
      var selected = hotspot && hotspot.closeup || background(c, phase, g.HollowUI.S.view);
      var entry = assets.get(selected);
      var cat = g.HollowStage.cat(), l = cat.locations[d.id], r = cat.regions[l.region];
      var procedural = A.scene(l.scene, l.id, r.color, l.region, l.glyph);
      // The fallback stays visible if this detached card image ever fails.
      return '<div class="photo-closeup region-' + c.region + ' ' + (cls || '') + '">' + procedural +
        (entry && assets.allowedPaths[entry.file] ? (hotspot && hotspot.closeup ? '<img src="' + assets.url(selected) + '" alt="" onerror="this.remove()">' : '<svg class="inspection-crop" viewBox="' + crop.join(' ') + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><image href="' + assets.url(selected) + '" width="1600" height="900" preserveAspectRatio="xMidYMid slice" onerror="this.parentNode.remove()"/></svg>') : '') + '</div>';
    },
    resolve: function (id, fallback) {
      if (!fallback) return fallback;
      var c = configs[id];
      if (c) { var selected = layout(c, g.HollowUI.S.view), key = id + (selected === c ? ':outer' : ':inner'); return definitions[key] || (definitions[key] = make(selected, fallback)); }
      ensure(id).then(function (cfg) { if (cfg && g.HollowStage.place() === id) g.HollowStage.refresh(); });
      return fallback;
    },
    entered: function (id, host) {
      host.classList.remove('photo-scene', 'photo-loading');
      var note = host.querySelector('.photo-loading-note'); if (note) note.remove();
      if (active !== id) {
        var old = active; active = id;
        if (index[old] && index[id] && index[old].region !== index[id].region) {
          var keep = new Set(Object.keys(index).filter(function (k) { return index[k].region === index[id].region; }).map(function (k) { return index[k].background; }));
          Object.keys(index).filter(function (k) { return index[k].region === index[old].region; }).forEach(function (k) {
            if (!keep.has(index[k].background)) assets.release(index[k].background);
          });
        }
        preload(id);
      }
    }
  };
})(window);
