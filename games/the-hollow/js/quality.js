/* Final presentation pass. The game action handlers and authoritative state stay in app.js. */
(function (g) {
  'use strict';
  var KEY = 'hollow.quality.v1', sizes = [100, 115, 130, 150];
  var UI = g.HollowUI, scale = g.HollowFx.prefs.large ? 130 : 100;
  var pending = false, active = null, returnTo = null, navTarget = null;
  function storage() { return g.HollowQualityStorage || g.localStorage; }
  try { var saved = Number(storage().getItem(KEY)); if (sizes.includes(saved)) scale = saved; }
  catch (e) { /* Private browsing can deny storage. */ }
  function setScale(value) {
    value = Number(value);
    if (!sizes.includes(value)) return false;
    scale = value;
    document.body.style.setProperty('--fs', 16 * value / 100 + 'px');
    document.documentElement.style.fontSize = 16 * value / 100 + 'px';
    document.body.dataset.textScale = String(value);
    try { storage().setItem(KEY, String(value)); } catch (e) {}
    return true;
  }
  setScale(scale);

  // Replace the old two-state size switch with a persistent, graded control.
  var settings = UI.settingsModal;
  UI.settingsModal = function () {
    var html = settings.apply(this, arguments);
    var old = /<div class="switch"><input id="s-large"[^>]*><label for="s-large">Larger text<\/label><\/div>/;
    return html.replace(old, '<div class="field quality-size"><label for="s-text-size">Text size</label><select id="s-text-size" aria-label="Text size">' +
      sizes.map(function (n) { return '<option value="' + n + '"' + (n === scale ? ' selected' : '') + '>' + n + '%</option>'; }).join('') + '</select></div>');
  };
  document.addEventListener('change', function (event) {
    if (event.target && event.target.id === 's-text-size') setScale(event.target.value);
  });

  function nav() {
    var el = document.getElementById('nav'); if (!el) return;
    var ids = ['map', 'act', 'you', 'log'];
    var panels = { map: 'mapview', act: 'adv', you: 'left', log: 'right' };
    var order = Array.from(el.querySelectorAll('[data-act="tab"]')).map(function (tab) { return tab.dataset.t; }).join(',');
    el.setAttribute('role', 'tablist');
    ids.forEach(function (id) {
      var tab = el.querySelector('[data-act="tab"][data-t="' + id + '"]');
      if (!tab) return;
      if (id === 'act') { var label = tab.querySelector('span'); if (label) label.textContent = 'Act'; }
      tab.setAttribute('aria-controls', panels[id]);
      tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
    });
    if (order !== ids.join(',')) ids.forEach(function (id) {
      var tab = el.querySelector('[data-act="tab"][data-t="' + id + '"]');
      if (tab) el.appendChild(tab);
    });
  }
  function visible(el) { return !!(el && el.isConnected && !el.closest('[inert]') && el.getClientRects().length); }
  function focusables(root) {
    return Array.from(root.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return visible(el) && el.getAttribute('aria-hidden') !== 'true'; });
  }
  function chosenDialog() {
    return document.querySelector('.chapter-intro[open]') || document.querySelector('#modal-root .modal[aria-modal="true"]') || document.querySelector('#endlayer .chapter-ending');
  }
  function inertOutside(dialog) {
    Array.from(document.body.children).forEach(function (child) {
      if (child.tagName === 'SCRIPT' || child.tagName === 'LINK' || child === dialog || child.contains(dialog) ||
          ['sr', 'captions', 'toasts'].includes(child.id)) {
        if (child.dataset.qualityInert === '1') { child.inert = false; delete child.dataset.qualityInert; }
        return;
      }
      if (dialog && !child.inert) { child.inert = true; child.dataset.qualityInert = '1'; }
      else if (!dialog && child.dataset.qualityInert === '1') { child.inert = false; delete child.dataset.qualityInert; }
    });
  }
  function sync() {
    pending = false; nav();
    if (navTarget) {
      var selected = document.querySelector('#nav [data-t="' + navTarget + '"][aria-selected="true"]');
      if (selected) selected.focus({ preventScroll: true });
      navTarget = null;
    }
    var dialog = chosenDialog();
    if (dialog && dialog.classList.contains('chapter-ending')) {
      if (dialog.getAttribute('role') !== 'dialog') dialog.setAttribute('role', 'dialog');
      if (dialog.getAttribute('aria-modal') !== 'true') dialog.setAttribute('aria-modal', 'true');
      if (dialog.tabIndex !== -1) dialog.tabIndex = -1;
    }
    inertOutside(dialog);
    if (dialog !== active) {
      var previous = active; active = dialog;
      if (dialog) {
        var first = dialog.classList.contains('chapter-ending') ? dialog.querySelector('h1') : focusables(dialog)[0];
        if (first && (!visible(document.activeElement) || !dialog.contains(document.activeElement))) first.focus({ preventScroll: true });
      } else if (previous && returnTo && returnTo.isConnected) returnTo.focus({ preventScroll: true });
    }
  }
  function schedule() { if (!pending) { pending = true; requestAnimationFrame(sync); } }
  document.addEventListener('focusin', function (event) {
    if (!chosenDialog() && event.target !== document.body) returnTo = event.target;
  }, true);
  document.addEventListener('pointerdown', function (event) {
    if (!chosenDialog()) {
      var target = event.target.closest && event.target.closest('button, a, [tabindex]');
      if (target) returnTo = target;
      var tab = event.target.closest && event.target.closest('#nav [role="tab"]');
      if (tab) { navTarget = tab.dataset.t; schedule(); }
    }
  }, true);
  document.addEventListener('keydown', function (event) {
    var tab = event.target.closest && event.target.closest('#nav [role="tab"]');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      var ids = ['map', 'act', 'you', 'log'], at = ids.indexOf(tab.dataset.t);
      var index = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (at + (event.key === 'ArrowRight' ? 1 : 3)) % 4;
      var next = document.querySelector('#nav [data-t="' + ids[index] + '"]');
      if (next) {
        event.preventDefault();
        next.click();
        nav(); // app.js replaces the tab buttons during render; finish ordering first.
        var fresh = document.querySelector('#nav [data-t="' + ids[index] + '"]');
        if (fresh) fresh.focus({ preventScroll: true });
        navTarget = null;
      }
      return;
    }
    var dialog = chosenDialog();
    if (!dialog || event.key !== 'Tab' || dialog.classList.contains('chapter-intro')) return;
    var list = focusables(dialog), first = list[0], last = list[list.length - 1];
    if (!first) { event.preventDefault(); dialog.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }, true);
  if (g.MutationObserver) new g.MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  g.addEventListener('visibilitychange', function () { document.body.classList.toggle('quality-hidden', document.hidden); });
  schedule();
  g.HollowQuality = Object.freeze({ setScale: setScale, getScale: function () { return scale; }, sync: sync });
})(window);
