/* Compatibility bridge for the existing layered renderer. The central registry
 * is the only whitelist; keep this script for existing scene load order. */
(function (g) {
  'use strict';
  var scenes = g.HollowScenes = g.HollowScenes || { defs: {} };
  scenes.assets = g.HollowAssets ? g.HollowAssets.allowedPaths : Object.create(null);
})(window);
