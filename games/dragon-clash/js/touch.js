/*
 * Dragon Clash — on-screen controls for phones and tablets.
 *
 * A floating stick on the left half (it appears under your thumb), action buttons on the right, a pause button.
 * Multi-touch through pointer events: every finger is tracked by its pointerId, so you can hold Guard and press
 * Light, or run and jump, at the same time. The device is read like any other: DCInput.read('touch').
 *
 *   DCTouch.show({ onPause })   while a match with a touch player is running
 *   DCTouch.hide()
 *   DCTouch.isTouchDevice()     true on phones and tablets (coarse pointer, no hover)
 */
(function () {
  'use strict';
  var B = window.DC.Sim.BTN;
  var root = null, held = 0, stick = null, buttons = {}, opts = {};
  // Combat cluster layout: ergonomic radial arc centered around the primary thumb rest
  var BTNS = [
    { a: 'light', cls: 't-btn-light', lbl: 'LIGHT', icon: '<path d="M6 3c2.5 6 2.5 12 0 18M12 3c2.5 6 2.5 12 0 18M18 3c2.5 6 2.5 12 0 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' },
    { a: 'heavy', cls: 't-btn-heavy', lbl: 'HEAVY', icon: '<path d="M4 4l10 10M4 4h4M4 4v4M20 4L10 14M20 4h-4M20 4v4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' },
    { a: 'sig', cls: 't-btn-sig', lbl: 'SKILL', icon: '<path d="M12 2l1.8 6.2L20 6l-3.6 5.4L22 14l-6.4.6L16 21l-4-4.6L8 21l.4-6.4L2 14l5.6-2.6L4 6l6.2 2.2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' },
    { a: 'jump', cls: 't-btn-jump', lbl: 'JUMP', icon: '<path d="M5 16l7-7 7 7M5 11l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' },
    { a: 'guard', cls: 't-btn-guard', lbl: 'GUARD', icon: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' },
    { a: 'dodge', cls: 't-btn-dodge', lbl: 'DODGE', icon: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' },
    { a: 'gear', cls: 't-btn-gear', lbl: 'GEAR', icon: '<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9zM12 8v8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' }
  ];

  var isShown = false;
  var pointers = {}; // pointerId -> { btn, a, startX, startY }

  function isTouchDevice() {
    var hasCoarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var hasFine = !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
    var hasHover = !!(window.matchMedia && window.matchMedia('(hover: hover)').matches);
    var isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent || '');
    var isIPad = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent || '') && !hasHover;
    if (isMobileUA || isIPad) return true;
    if (hasFine && hasHover) return false;
    return hasCoarse && !hasHover;
  }

  function capture(el, e) { try { el.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ } }
  function vibrate() { if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) { /* not allowed */ } }

  function build() {
    root = document.createElement('div');
    root.className = 'touch-ui';
    root.innerHTML =
      '<div class="t-stick-zone"><div class="t-stick"><i></i></div></div>' +
      '<div class="t-buttons">' +
        BTNS.map(function (b) {
          return '<button class="t-btn ' + b.cls + '" data-a="' + b.a + '" aria-label="' + b.lbl + '">' +
            '<svg class="t-icon" viewBox="0 0 24 24">' + b.icon + '</svg>' +
            '<span class="t-lbl">' + b.lbl + '</span>' +
          '</button>';
        }).join('') +
      '</div>' +
      '<button class="t-btn t-taunt" data-a="taunt" aria-label="Taunt">' +
        '<svg class="t-icon" viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<span class="t-lbl">TAUNT</span>' +
      '</button>' +
      '<button class="t-pause" aria-label="Pause">' +
        '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>' +
      '</button>';

    var zone = root.querySelector('.t-stick-zone'), knob = root.querySelector('.t-stick'), dot = knob.querySelector('i');
    var R = 56;
    zone.addEventListener('pointerdown', function (e) {
      if (stick) return;
      e.preventDefault(); capture(zone, e);
      stick = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
      knob.style.left = e.clientX + 'px'; knob.style.top = e.clientY + 'px'; knob.classList.add('on');
      dot.style.transform = 'translate(-50%,-50%)';
    });
    zone.addEventListener('pointermove', function (e) {
      if (!stick || e.pointerId !== stick.id) return;
      var dx = e.clientX - stick.x, dy = e.clientY - stick.y, l = Math.sqrt(dx * dx + dy * dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      stick.dx = dx / R; stick.dy = dy / R;
      dot.style.transform = 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px))';
      update();
    });
    function endStick(e) { if (!stick || e.pointerId !== stick.id) return; stick = null; knob.classList.remove('on'); update(); }
    zone.addEventListener('pointerup', endStick); zone.addEventListener('pointercancel', endStick);

    // Multi-touch button handling with slide-across & flick-gesture support
    function onBtnDown(el, e) {
      e.preventDefault();
      var a = el.dataset.a;
      pointers[e.pointerId] = { btn: el, a: a, startX: e.clientX, startY: e.clientY, originalA: a };
      el.classList.add('on');
      vibrate();
      update();
    }

    function onPointerMove(e) {
      var p = pointers[e.pointerId];
      if (!p) return;

      // 1. Check if thumb slid directly over another button
      var elem = document.elementFromPoint(e.clientX, e.clientY);
      var btn = elem && elem.closest('.t-btn');
      if (btn && btn.dataset.a) {
        var newA = btn.dataset.a;
        if (newA !== p.a) {
          if (p.btn) p.btn.classList.remove('on');
          p.btn = btn;
          p.a = newA;
          btn.classList.add('on');
          vibrate();
          update();
          return;
        }
      }

      // 2. Gesture flick: swiping from the main Light Attack button triggers Heavy / Skill / Jump / Dodge
      if (p.originalA === 'light') {
        var dx = e.clientX - p.startX, dy = e.clientY - p.startY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 34) {
          var flickA = p.a;
          if (dy < -20) {
            flickA = dx > 15 ? 'sig' : 'heavy';
          } else if (dx < -32) {
            flickA = 'guard';
          } else if (dx > 32) {
            flickA = 'jump';
          } else if (dy > 32) {
            flickA = 'dodge';
          }
          if (flickA !== p.a) {
            if (p.btn) p.btn.classList.remove('on');
            p.a = flickA;
            var targetEl = root.querySelector('.t-btn[data-a="' + flickA + '"]');
            if (targetEl) { p.btn = targetEl; targetEl.classList.add('on'); }
            vibrate();
            update();
          }
        }
      }
    }

    function onBtnUp(e) {
      var p = pointers[e.pointerId];
      if (!p) return;
      if (p.btn) p.btn.classList.remove('on');
      delete pointers[e.pointerId];
      update();
    }

    root.querySelectorAll('.t-btn').forEach(function (el) {
      el.addEventListener('pointerdown', function (e) { onBtnDown(el, e); });
    });

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onBtnUp);
    window.addEventListener('pointercancel', onBtnUp);

    root.querySelector('.t-pause').addEventListener('pointerdown', function (e) { e.preventDefault(); if (opts.onPause) opts.onPause(); });
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.body.appendChild(root);
  }

  function update() {
    var h = 0;
    if (stick) {
      if (stick.dx > 0.38) h |= B.right; else if (stick.dx < -0.38) h |= B.left;
      if (stick.dy < -0.6) h |= B.up; else if (stick.dy > 0.55) h |= B.down;
    }
    for (var id in pointers) {
      var a = pointers[id].a;
      if (a && B[a]) h |= B[a];
    }
    held = h;
  }

  function show(o) {
    opts = o || {};
    if (!root) build();
    root.style.display = '';
    isShown = true;
    held = 0; pointers = {}; stick = null;
    root.querySelectorAll('.on').forEach(function (el) { el.classList.remove('on'); });
  }
  function hide() { if (root) root.style.display = 'none'; isShown = false; held = 0; pointers = {}; stick = null; }

  window.DCTouch = { show: show, hide: hide, held: function () { return held; }, isTouchDevice: isTouchDevice, isShown: function () { return isShown; } };
})();
