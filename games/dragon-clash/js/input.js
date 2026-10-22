/*
 * Dragon Clash — local input devices.
 *
 * Devices: 'kb1' (left keyboard layout), 'kb2' (right keyboard layout), 'pad0'..'pad3' (gamepads).
 * Each device reads to the simulation's button bits. Keyboard layouts are remappable and saved.
 * When only Keyboard 1 is in use, the arrow keys also move it (A/D or arrows, as the default controls promise).
 */
(function () {
  'use strict';
  var B = window.DC.Sim.BTN;
  var ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'light', 'heavy', 'sig', 'guard', 'dodge', 'gear', 'taunt'];
  var LABELS = { left: 'Move left', right: 'Move right', up: 'Up / aim up (tap to jump)', down: 'Down / crouch / drop / fast fall', jump: 'Jump',
                 light: 'Light attack', heavy: 'Heavy attack', sig: 'Signature (Down + it: elemental ability)', guard: 'Guard (+ Light grab, + Signature EX, + Heavy super)',
                 dodge: 'Dash / dodge / roll', gear: 'Gear ability', taunt: 'Taunt' };
  var DEFAULTS = {
    kb1: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], jump: ['Space'], light: ['KeyJ'], heavy: ['KeyK'], sig: ['KeyL'], guard: ['KeyU'], dodge: ['ShiftLeft'], gear: ['KeyI'], taunt: ['KeyY'] },
    kb2: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], jump: ['Enter'], light: ['Numpad1', 'Comma'], heavy: ['Numpad2', 'Period'], sig: ['Numpad3', 'Slash'], guard: ['Numpad5', 'Quote'], dodge: ['Numpad0', 'ShiftRight'], gear: ['Numpad4', 'Semicolon'], taunt: ['Numpad6', 'Backslash'] },
  };
  // Gamepad buttons (standard mapping). Movement is always the left stick and d-pad; every button is remappable.
  var PAD_ACTIONS = ['jump', 'light', 'heavy', 'sig', 'guard', 'dodge', 'gear', 'taunt'];
  var PAD_DEFAULTS = { jump: [0], light: [2], heavy: [3], sig: [1], guard: [6, 7], dodge: [5], gear: [4], taunt: [8] };
  var PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L-stick', 'R-stick', 'D-up', 'D-down', 'D-left', 'D-right'];
  var padBinds = JSON.parse(JSON.stringify(PAD_DEFAULTS));
  var DEVICE_NAMES = { kb1: 'Keyboard 1', kb2: 'Keyboard 2', pad0: 'Gamepad 1', pad1: 'Gamepad 2', pad2: 'Gamepad 3', pad3: 'Gamepad 4', touch: 'Touch screen' };

  var down = {};
  var binds = JSON.parse(JSON.stringify(DEFAULTS));
  var listeners = [];
  var inUse = {};

  window.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    down[e.code] = true;
    for (var i = 0; i < listeners.length; i++) listeners[i](e);
    if (isGameKey(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { down[e.code] = false; });
  window.addEventListener('blur', function () { down = {}; });

  function isGameKey(code) {
    if (!document.body.classList.contains('in-match')) return false;
    for (var d in binds) for (var a in binds[d]) if (binds[d][a].indexOf(code) >= 0) return true;
    return code === 'Space' || code.indexOf('Arrow') === 0;
  }

  function onKey(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }

  function keyHeld(dev, action) {
    var list = binds[dev][action];
    for (var i = 0; i < list.length; i++) if (down[list[i]]) return true;
    if (dev === 'kb1' && !inUse.kb2) {
      var alt = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' }[action];
      if (alt && down[alt]) return true;
    }
    return false;
  }

  function readPad(i) {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var p = pads && pads[i];
    if (!p) return 0;
    var bt = function (k) { return p.buttons[k] && p.buttons[k].pressed; };
    var ax = p.axes[0] || 0, ay = p.axes[1] || 0, h = 0;
    if (ax < -0.4 || bt(14)) h |= B.left;
    if (ax > 0.4 || bt(15)) h |= B.right;
    if (ay < -0.55 || bt(12)) h |= B.up;
    if (ay > 0.55 || bt(13)) h |= B.down;
    for (var a = 0; a < PAD_ACTIONS.length; a++) {
      var list = padBinds[PAD_ACTIONS[a]];
      for (var q = 0; q < list.length; q++) if (bt(list[q])) { h |= B[PAD_ACTIONS[a]]; break; }
    }
    return h;
  }

  function padStart(i) {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var p = pads && pads[i];
    return !!(p && p.buttons[9] && p.buttons[9].pressed);
  }

  /** Held bits for a device. */
  function read(dev) {
    if (dev && dev.indexOf('pad') === 0) return readPad(+dev.slice(3));
    if (dev === 'touch') {
      var th = window.DCTouch ? window.DCTouch.held() : 0;
      var kh = 0;
      if (binds.kb1) for (var i = 0; i < ACTIONS.length; i++) if (keyHeld('kb1', ACTIONS[i])) kh |= B[ACTIONS[i]];
      return th | kh;
    }
    if (!binds[dev]) return 0;
    var h = 0;
    for (var i = 0; i < ACTIONS.length; i++) if (keyHeld(dev, ACTIONS[i])) h |= B[ACTIONS[i]];
    if (dev === 'kb1' && window.DCTouch && window.DCTouch.isShown && window.DCTouch.isShown()) {
      h |= window.DCTouch.held();
    }
    return h;
  }

  function connectedPads() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [], out = [];
    for (var i = 0; i < 4; i++) if (pads && pads[i]) out.push('pad' + i);
    return out;
  }

  function setInUse(devs) { inUse = {}; (devs || []).forEach(function (d) { inUse[d] = true; }); }

  function load(saved) {
    binds = JSON.parse(JSON.stringify(DEFAULTS));
    if (saved) for (var d in saved) if (binds[d]) for (var a in saved[d]) if (binds[d][a] && Array.isArray(saved[d][a])) binds[d][a] = saved[d][a].slice(0, 3).map(String);
  }
  function loadPad(saved) {
    padBinds = JSON.parse(JSON.stringify(PAD_DEFAULTS));
    if (saved) for (var a in saved) if (padBinds[a] && Array.isArray(saved[a])) padBinds[a] = saved[a].slice(0, 2).map(Number).filter(function (n) { return n >= 0 && n < 17; });
  }
  function setPadBinding(action, buttons) { padBinds[action] = buttons.slice(0, 2); }
  function resetPad() { padBinds = JSON.parse(JSON.stringify(PAD_DEFAULTS)); }
  /** The first button newly pressed on any pad since the last call (for remapping), or -1. */
  var padPrev = {};
  function padPressed() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [], hit = -1;
    for (var i = 0; i < 4; i++) {
      var p = pads && pads[i]; if (!p) continue;
      for (var k = 0; k < p.buttons.length && k < 17; k++) {
        var on = p.buttons[k] && p.buttons[k].pressed, key = i + ':' + k;
        if (on && !padPrev[key] && hit < 0) hit = k;
        padPrev[key] = on;
      }
    }
    return hit;
  }

  function setBinding(dev, action, codes) { binds[dev][action] = codes.slice(0, 3); }
  function reset(dev) { binds[dev] = JSON.parse(JSON.stringify(DEFAULTS[dev])); }

  /** Pretty key label. */
  function keyName(code) {
    if (code === 'Backslash') return '\\';
    return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ').replace('ShiftLeft', 'L-Shift').replace('ShiftRight', 'R-Shift')
      .replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('ArrowUp', '↑').replace('ArrowDown', '↓')
      .replace('Comma', ',').replace('Period', '.').replace('Slash', '/').replace('Space', 'Space').replace('ControlLeft', 'L-Ctrl').replace('ControlRight', 'R-Ctrl').replace('Quote', "'").replace('Semicolon', ';');
  }

  /** Every key bound in more than one place across the layouts in use. */
  function conflicts(devs) {
    var seen = {}, out = [];
    devs.forEach(function (d) {
      if (!binds[d]) return;
      for (var a in binds[d]) binds[d][a].forEach(function (c) {
        var k = c;
        if (seen[k] && seen[k] !== d + '.' + a) out.push(keyName(c));
        seen[k] = d + '.' + a;
      });
    });
    return out;
  }

  window.DCInput = { read: read, onKey: onKey, padStart: padStart, connectedPads: connectedPads, setInUse: setInUse, load: load,
                     binds: function () { return binds; }, setBinding: setBinding, reset: reset, keyName: keyName, conflicts: conflicts,
                     loadPad: loadPad, padBinds: function () { return padBinds; }, setPadBinding: setPadBinding, resetPad: resetPad, padPressed: padPressed,
                     padName: function (k) { return PAD_NAMES[k] || 'Button ' + k; }, PAD_ACTIONS: PAD_ACTIONS,
                     ACTIONS: ACTIONS, LABELS: LABELS, DEVICE_NAMES: DEVICE_NAMES, isDown: function (c) { return !!down[c]; } };
})();
