/* THE HOLLOW — optional inventory art and UI skin. All paths come from the central
 * whitelist; SVG stays present until decoded raster art has loaded successfully. */
(function (g) {
  'use strict';
  var A = g.HollowArt, UI = g.HollowUI, assets = g.HollowAssets;
  var originalItem = A.itemArt, originalJournal = UI.journal;
  var config = { items: {}, ui: {} }, scheduled = false;
  var base = new URL('../', document.currentScript.src);
  var ready = fetch(new URL('art/presentation.json', base)).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
    if (data && data.version === 1 && data.items && data.ui) config = data;
    return assets.ready;
  }).catch(function () {});

  A.itemArt = function (id, size) {
    var svg = originalItem(id, size);
    if (!/^[a-z0-9_]+$/.test(id)) return svg;
    var px = Math.max(16, Math.min(120, Number(size) || 40));
    // Empty shells can be rendered before metadata arrives without blocking play.
    return '<span class="imported-item" data-hollow-item="' + id + '" data-item-size="' + px + '" aria-hidden="true" style="width:' + px + 'px;height:' + px + 'px">' + svg + '</span>';
  };
  function hydrate(el) {
    if (el.dataset.assetStatus) return;
    var m = config.items[el.dataset.hollowItem];
    if (!m) return;
    el.dataset.assetStatus = 'loading';
    if (['common', 'rare', 'relic'].includes(m.rarity)) el.classList.add('rarity-' + m.rarity);
    var id = Number(el.dataset.itemSize) <= 64 && m.thumb ? m.thumb : m.asset;
    var entry = assets.get(id);
    if (!entry || entry.type !== 'image') { el.dataset.assetStatus = 'fallback'; return; }
    if (entry.pixel) el.classList.add('pixel');
    assets.load(id).then(function (image) {
      if (!image || !el.isConnected) { el.dataset.assetStatus = 'fallback'; return; }
      var img = image.cloneNode(); img.alt = ''; img.className = 'imported-item-image';
      // The loaded clone should share its decoded image, but keep a final fallback.
      img.onerror = function () { img.remove(); el.classList.remove('raster-ready'); el.dataset.assetStatus = 'fallback'; };
      el.appendChild(img); el.classList.add('raster-ready'); el.dataset.assetStatus = 'ready';
    }).catch(function () { el.dataset.assetStatus = 'fallback'; });
  }
  function decorateDice(el) {
    if (el.dataset.jarReady) return;
    el.dataset.jarReady = 'true';
    assets.load(config.ui.jar).then(function (image) {
      if (!image || !el.isConnected) return;
      var jar = image.cloneNode(); jar.className = 'dice-jar'; jar.alt = ''; jar.setAttribute('aria-hidden', 'true'); el.appendChild(jar);
    });
  }
  function scan() {
    document.querySelectorAll('.imported-item').forEach(hydrate);
    document.querySelectorAll('.ev-tray, .d-stage').forEach(decorateDice);
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () { scheduled = false; scan(); });
  }
  UI.journal = function () {
    var original = originalJournal(), v = UI.S.view;
    if (!v || !v.me || !v.me.inv.length) return original;
    // Current, authoritative inventory only. No undiscovered rewards or future items.
    var records = v.me.inv.map(function (e) {
      var d = UI.S.cat.items[e.id];
      return '<div class="journal-specimen">' + A.itemArt(e.id, 38) + '<span>' + A.esc(d.name) + (e.n > 1 ? ' ×' + e.n : '') + '</span></div>';
    }).join('');
    return '<section class="field-collection"><h3>In your keeping</h3><p class="small">Supplies carried on this expedition.</p><div class="specimen-grid">' + records + '</div></section>' + original;
  };
  function itemForOption(option, label) {
    var items = UI.S.cat && UI.S.cat.items;
    if (!items) return null;
    if (option && option.cost && items[option.cost.item]) return option.cost.item;
    var text = String(label || (option && option.label) || '').toLowerCase();
    if (!/^buy\b/.test(text)) return null;
    return Object.keys(items).find(function (id) { return text.includes(items[id].name.toLowerCase()); }) || null;
  }
  ready.then(async function () {
    document.body.classList.add('hollow-skin');
    // Static interface details only; scene regions still load independently.
    for (var key of ['panel', 'button', 'hud', 'focus']) {
      var image = await assets.load(config.ui[key]);
      if (image) document.documentElement.style.setProperty('--skin-' + key, 'url("' + image.src + '")');
    }
    if (config.components) {
      for (var component of Object.keys(config.components)) {
        var texture = await assets.load(config.components[component]);
        if (texture) document.documentElement.style.setProperty('--task4-' + component.replace(/_/g, '-'), 'url("' + texture.src + '")');
      }
      document.body.classList.add('task4-ready');
    }
    if (g.FontFace && document.fonts && config.ui.font) {
      try {
        var bytes = await assets.load(config.ui.font);
        if (bytes) { var font = await new FontFace('Gravewire', bytes).load(); document.fonts.add(font); document.body.classList.add('gravewire-ready'); }
      } catch (e) { /* Readable existing headings remain available. */ }
    }
    scan();
    var observer = new MutationObserver(function (records) {
      if (records.some(function (r) { return Array.from(r.addedNodes).some(function (n) {
        return n.nodeType === 1 && (n.matches('.imported-item, .ev-tray, .d-stage') || n.querySelector('.imported-item, .ev-tray, .d-stage'));
      }); })) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  g.HollowPresentation = { ready: ready, itemForOption: itemForOption };
})(window);
