/* Hidden routes. Filled in at M5. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.TRD = root.TRD || {}).secrets = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return { SECRETS: [] };
});
