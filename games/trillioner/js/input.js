/* Keyboard, mouse look. Keys are read by code; TR.input.keys can also be set by tests. */
(function () {
  var TR = window.TR = window.TR || {};
  var input = TR.input = {
    keys: {}, pressed: {}, yaw: Math.PI, pitch: 0.32, mouseDown: false, mouseClicked: false, locked: false, enabled: true, moveX: 0, moveZ: 0,
    down: function (code) { return !!input.keys[code]; },
    hit: function (code) { return !!input.pressed[code]; },
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
    /** Movement intent relative to the camera, from keyboard (gamepad and touch feed moveX/moveZ later). */
    axes: function () {
      var x = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
      var z = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
      x += input.moveX; z += input.moveZ;
      var l = Math.hypot(x, z);
      if (l > 1) { x /= l; z /= l; }
      return { x: x, z: z };
    }
  };
})();
