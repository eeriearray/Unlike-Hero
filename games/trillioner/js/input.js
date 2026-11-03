/* Keyboard, mouse look. Keys are read by code; TR.input.keys can also be set by tests. */
(function () {
  var TR = window.TR = window.TR || {};
  var input = TR.input = {
    keys: {}, pressed: {}, yaw: Math.PI, pitch: 0.17, mouseDown: false, mouseClicked: false, locked: false, enabled: true, moveX: 0, moveZ: 0,
    down: function (code) { return !input.frozen && !!input.keys[code]; },
    hit: function (code) { return !input.frozen && !!input.pressed[code]; },
    endFrame: function () { input.pressed = {}; input.mouseClicked = false; },
    init: function (canvas) {
      addEventListener('keydown', function (e) {
        if (e.target && e.target.tagName === 'INPUT') return;
        if (!e.repeat) input.pressed[e.code] = true;
        input.keys[e.code] = true;
        if (/^(Space|Arrow|Tab)/.test(e.code)) e.preventDefault();
      });
      addEventListener('keyup', function (e) { input.keys[e.code] = false; });
      addEventListener('blur', function () { input.keys = {}; input.mouseDown = false; });
      canvas.addEventListener('mousedown', function (e) {
        if (!input.enabled) return;
        if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
          try { var pr = canvas.requestPointerLock(); if (pr && pr.catch) pr.catch(function () {}); } catch (err) { /* drag look still works */ }
        }
        input.mouseDown = true;
        input.mouseClicked = true;
        input.drag = true;
      });
      addEventListener('mouseup', function () { input.mouseDown = false; input.drag = false; });
      addEventListener('mousemove', function (e) {
        var locked = document.pointerLockElement === canvas;
        input.locked = locked;
        if (!locked && !input.drag) return;
        input.yaw -= e.movementX * 0.0026;
        input.pitch = Math.max(-0.55, Math.min(1.25, input.pitch + e.movementY * 0.0022));
      });
    },
    /** Gamepad: left stick moves, right stick looks, face buttons act like their keys. */
    pollGamepad: function () {
      if (!navigator.getGamepads) return;
      var pads = navigator.getGamepads(), gp = null;
      for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
      if (!gp) { if (input.padOn) { input.padOn = false; input.moveX = input.moveZ = 0; input.sprintHeld = false; } return; }
      input.padOn = true;
      var dz = function (v) { return Math.abs(v) < 0.16 ? 0 : v; };
      input.moveX = dz(gp.axes[0]); input.moveZ = -dz(gp.axes[1]);
      input.yaw -= dz(gp.axes[2] || 0) * 0.05;
      input.pitch = Math.max(-0.55, Math.min(1.25, input.pitch + dz(gp.axes[3] || 0) * 0.035));
      var map = { 0: 'Space', 1: 'KeyF', 2: 'KeyE', 3: 'KeyQ', 4: 'ShiftLeft', 5: 'KeyH', 8: 'KeyM', 9: 'Escape', 12: 'KeyN', 13: 'KeyX' };
      input.padPrev = input.padPrev || {};
      Object.keys(map).forEach(function (b) {
        var d = gp.buttons[b] && gp.buttons[b].pressed, code = map[b];
        if (d && !input.padPrev[b]) input.pressed[code] = true;
        if (d !== !!input.padPrev[b]) input.keys[code] = !!d;
        input.padPrev[b] = d;
      });
      var fire = gp.buttons[7] && gp.buttons[7].value > 0.3;
      if (fire && !input.padFire) input.mouseClicked = true;
      if (fire !== !!input.padFire) input.mouseDown = !!fire;
      input.padFire = fire;
    },
    /** On-screen sticks and buttons for touch screens. Built only when a finger first touches the page. */
    initTouch: function (ui) {
      var built = false;
      var build = function () {
        if (built) return; built = true;
        document.body.classList.add('touch');
        var box = document.createElement('div'); box.className = 'touchui';
        box.innerHTML = '<div class="stick" id="t-stick"><i></i></div><div class="tbtns">' +
          [['Space', 'Jump'], ['KeyE', 'Buy'], ['KeyF', 'Ride'], ['KeyQ', 'Call'], ['Mouse', 'Use'], ['KeyX', 'Wreck'], ['KeyY', 'Take call'], ['KeyG', 'Cash'], ['KeyI', 'Bag'], ['KeyM', 'Map'], ['KeyN', 'Note'], ['Escape', 'Menu']].map(function (b) { return '<button data-k="' + b[0] + '">' + b[1] + '</button>'; }).join('') + '</div>';
        ui.appendChild(box);
        box.querySelectorAll('[data-k]').forEach(function (b) {
          var k = b.getAttribute('data-k');
          b.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); if (k === 'Mouse') { input.mouseDown = true; input.mouseClicked = true; } else { input.keys[k] = true; input.pressed[k] = true; } }, { passive: false });
          b.addEventListener('touchend', function (e) { e.preventDefault(); e.stopPropagation(); if (k === 'Mouse') input.mouseDown = false; else input.keys[k] = false; }, { passive: false });
        });
        var stick = box.querySelector('#t-stick'), knob = stick.firstChild, sid = null, R = 56;
        stick.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); sid = e.changedTouches[0].identifier; }, { passive: false });
        var move = function (e) {
          for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            if (t.identifier === sid) {
              var r = stick.getBoundingClientRect(), x = t.clientX - (r.left + r.width / 2), y = t.clientY - (r.top + r.height / 2), l = Math.hypot(x, y), c = Math.min(1, l / R);
              if (l > 0) { x = x / l * c; y = y / l * c; }
              input.moveX = x; input.moveZ = -y;
              input.sprintHeld = c > 0.92;
              knob.style.transform = 'translate(' + x * R + 'px,' + y * R + 'px)';
            }
          }
        };
        var end = function (e) { for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === sid) { sid = null; input.moveX = input.moveZ = 0; input.sprintHeld = false; knob.style.transform = ''; } };
        addEventListener('touchmove', move, { passive: false });
        addEventListener('touchend', end); addEventListener('touchcancel', end);
      };
      // drag anywhere else to look
      var lid = null, lx = 0, ly = 0;
      addEventListener('touchstart', function (e) {
        build();
        if (lid == null && e.target && e.target.tagName === 'CANVAS') { var t = e.changedTouches[0]; lid = t.identifier; lx = t.clientX; ly = t.clientY; }
      }, { passive: true });
      addEventListener('touchmove', function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (t.identifier !== lid) continue;
          input.yaw -= (t.clientX - lx) * 0.006; input.pitch = Math.max(-0.55, Math.min(1.25, input.pitch + (t.clientY - ly) * 0.005));
          lx = t.clientX; ly = t.clientY;
        }
      }, { passive: true });
      var lend = function (e) { for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === lid) lid = null; };
      addEventListener('touchend', lend); addEventListener('touchcancel', lend);
      input.buildTouch = build;
    },
    /** Movement intent relative to the camera, from keyboard (gamepad and touch feed moveX/moveZ later). */
    axes: function () {
      if (input.frozen) return { x: 0, z: 0 };
      var x = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
      var z = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
      x += input.moveX; z += input.moveZ;
      var l = Math.hypot(x, z);
      if (l > 1) { x /= l; z /= l; }
      return { x: x, z: z };
    }
  };
})();
