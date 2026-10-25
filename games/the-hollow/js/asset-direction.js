/* Art direction uses only the supplied, manifest-listed media. Class seals are
 * insignia, not character portraits. The rules and encounter handlers are unchanged. */
(function (g) {
  'use strict';
  var A = g.HollowArt, UI = g.HollowUI, assets = g.HollowAssets, esc = A.esc;
  var base = new URL('../', document.currentScript.src), seals = {}, places = {}, scheduled = false;
  document.body.classList.add('asset-direction');
  function seal(id, showcase) {
    var name = UI.S.cat && UI.S.cat.classes[id] ? UI.S.cat.classes[id].name : id;
    return '<span class="class-seal' + (showcase ? ' hero-art class-showcase' : '') + '" data-class-seal="' + esc(id) + '" role="img" aria-label="' + esc(name) + ' insignia"><span class="seal-letter">' + esc(name.slice(0, 1)) + '</span></span>';
  }
  A.portrait = function (id) { return seal(id, false); };
  g.HollowHeroes.art = function (id) { return seal(id, true); };
  var scene = A.scene;
  A.scene = function (spec, key) {
    var svg = scene.apply(this, arguments);
    if (!/^[a-z_]+$/.test(key || '')) return svg;
    return svg.replace('<svg ', '<svg data-asset-place="' + esc(key) + '" ');
  };
  function scan() {
    scheduled = false;
    document.querySelectorAll('svg[data-asset-place]').forEach(function (el) {
      var entry = places[el.dataset.assetPlace];
      if (!entry || el.dataset.photoLoading) return;
      el.dataset.photoLoading = '1';
      assets.load(entry.background).then(function (image) {
        if (!image || !el.isConnected) return;
        var frame = el.viewBox.baseVal;
        var img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('class', 'asset-photo'); img.setAttribute('href', image.src);
        img.setAttribute('x', frame.x); img.setAttribute('y', frame.y);
        img.setAttribute('width', frame.width); img.setAttribute('height', frame.height);
        img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        el.appendChild(img); el.classList.add('asset-photo-ready');
      });
    });
    document.querySelectorAll('[data-class-seal]').forEach(function (el) {
      var id = seals[el.dataset.classSeal];
      if (!id || el.dataset.sealLoading) return;
      el.dataset.sealLoading = '1';
      assets.load(id).then(function (image) {
        if (!image || !el.isConnected) return;
        var img = image.cloneNode(); img.alt = ''; img.setAttribute('aria-hidden', 'true');
        el.appendChild(img); el.classList.add('seal-ready');
      });
    });

  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(scan); } }
  fetch(new URL('art/class-insignia.json', base)).then(function (r) { return r.ok ? r.json() : {}; }).then(function (data) { seals = data; return assets.ready; }).then(schedule).catch(function () {});
  fetch(new URL('art/scenes/index.json', base)).then(function (r) { return r.ok ? r.json() : {}; }).then(function (data) { places = data.places || {}; return assets.ready; }).then(schedule).catch(function () {});
  if (g.MutationObserver) new MutationObserver(schedule).observe(document.getElementById('app'), { childList: true, subtree: true });
  var caption = g.HollowStory.caption;
  g.HollowStory.caption = function () {
    var v = UI.S.view, html = caption.apply(this, arguments);
    if (v && (!v.enc || v.enc.kind === 'loc') && !(v.enc && v.enc.result)) html = html.replace('class="cap', 'class="cap place-copy');
    return html;
  };
  // Existing renderer keeps combat names, HP, attacks and controls. Figures are
  // suppressed by the skin until matching character artwork is supplied.
  schedule();
})(window);
