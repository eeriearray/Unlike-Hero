/* Opt-in presentation budgets. Never changes physics, network timers, or global browser APIs. */
(function (root) {
  'use strict';
  function detect(nav, coarse) {
    nav = nav || {};
    var cores = Number(nav.hardwareConcurrency) || 0, memory = Number(nav.deviceMemory) || 0;
    if ((cores && cores <= 2) || (memory && memory <= 2) || nav.connection?.saveData) return 'low';
    if (coarse || (cores && cores <= 4) || (memory && memory <= 4)) return 'balanced';
    return 'high';
  }
  var tier = detect(root.navigator, !!root.matchMedia?.('(pointer: coarse)').matches);
  var budgets = { low: { pixels: 1000000, ratio: 1, effects: 0.5, fps: 30 }, balanced: { pixels: 1800000, ratio: 1.5, effects: 0.75, fps: 45 }, high: { pixels: 3000000, ratio: 2, effects: 1, fps: 60 } };
  var budget = budgets[tier];
  function pixelRatio(width, height, cap) {
    width = Math.max(1, Number(width) || root.innerWidth || 1);
    height = Math.max(1, Number(height) || root.innerHeight || 1);
    return Math.min(Number(root.devicePixelRatio) || 1, cap || 2, budget.ratio, Math.sqrt(budget.pixels / (width * height)));
  }
  function frameGate(fps) {
    var last = null, interval = 1000 / (fps || budget.fps);
    return function (now) {
      if (root.document?.hidden) { last = null; return false; }
      now = Number.isFinite(now) ? now : root.performance.now();
      if (last == null || now < last || now - last >= interval - 0.5) { last = now; return true; }
      return false;
    };
  }
  function createResolutionBudget(cap) {
    var scale = 1, slow = 0;
    return {
      ratio: function (width, height) { return pixelRatio(width, height, cap) * scale; },
      sample: function (dt) {
        // Ignore background pauses, debugger stops and isolated loading spikes.
        if (root.document?.hidden || !Number.isFinite(dt) || dt <= 0 || dt > 0.15) { slow = 0; return false; }
        slow = dt > 1 / 45 ? slow + dt : Math.max(0, slow - dt * 2);
        if (slow < 1.8 || scale <= 0.55) return false;
        scale = Math.max(0.55, scale - 0.15); slow = 0; return true;
      }
    };
  }
  root.HubPerformance = Object.freeze({ tier: tier, low: tier === 'low', effects: budget.effects, decorativeFps: budget.fps,
    maxPixels: budget.pixels, detect: detect, pixelRatio: pixelRatio, frameGate: frameGate, createResolutionBudget: createResolutionBudget });
})(typeof window !== 'undefined' ? window : globalThis);
