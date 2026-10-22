/* THE HOLLOW — Node entry: loads content and the engine files in order and exports HollowEngine.
 * (Browsers load the same files with <script> tags, in the same order: see index.html.) */
'use strict';
require('./data/core.js');
require('./data/story.js');
require('./data/loc-village.js');
require('./data/loc-estate.js');
require('./data/loc-woods.js');
require('./data/loc-abbey.js');
require('./data/loc-deep.js');
require('./data/map.js');
require('./data/events.js');
require('./core.js');
require('./rules.js');
require('./world.js');
require('./finale.js');
require('./view.js');
module.exports = globalThis.HollowEngine;
module.exports.data = globalThis.HollowData;
