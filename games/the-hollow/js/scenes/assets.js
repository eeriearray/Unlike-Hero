/* THE HOLLOW — raster artwork that exists on disk. A scene layer with `src` uses the file only if it is listed here,
 * so a missing picture never causes a failed request or a blank layer: the vector drawing is used instead.
 * Add a line per file you drop into art/ (see art/README.md). */
(function (g) {
  'use strict';
  var SC = g.HollowScenes = g.HollowScenes || { defs: {} };
  SC.assets = Object.assign(SC.assets || {}, {
    // 'art/square/sky.webp': true,
    // 'art/square/far.webp': true,
    // 'art/square/mid.webp': true,
    // 'art/square/ground.webp': true,
    // 'art/square/fore.webp': true
  });
})(window);
