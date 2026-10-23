/* Guidance reads only the player's public view; it never selects or resolves a move. */
(function (g) {
  'use strict';
  var UI = g.HollowUI, esc = g.HollowArt.esc;
  function next(v) {
    var enc = v.enc, options = enc && enc.options || [];
    if (v.me.pendingLevels) return 'Choose an improvement below. It costs no actions; solo turns wait for your choice.';
    if (v.vote) return 'Choose an ending in the vote panel. Your party decides the bell’s fate together.';
    if (enc && enc.hold) return 'Resolve the open choice before continuing.';
    if (v.game.ap < 1 && v.game.readingTime) return 'No actions left. The next turn begins after results and choices finish; the Haunting Clock advances between rounds.';
    if (v.game.ap < 1) return 'No actions left. End your turn to begin the next round; the Haunting Clock will advance.';
    if (enc && enc.hold) return 'Resolve the open choice before continuing.';
    if (enc && (enc.kind === 'enemy' || enc.kind === 'boss') && !enc.over) return 'Danger blocks your way. Pick a response below, review its risk, then confirm. Choose Flee to attempt an escape.';
    if (enc && enc.over) return 'Choose Continue to close this encounter, then explore or travel.';
    if (v.opening) return v.opening.hint;
    if (v.me.loc === 'heart_chamber') return 'You have reached the Heart. Open its encounter and propose the bell’s fate.';
    if (v.me.loc === 'square') {
      var board = options.find(function (o) { return o.id === 'board' && o.state === 'ok'; });
      if (board) return 'Start with “Read the notice board” below. Review the odds, then roll to look for your first clue.';
      if (!enc) return 'Open this place’s encounter using the first card below to examine the notice board and well.';
      return 'Follow the bell: choose Travel and inspect the road to the Drowned Bell Tower. You can also explore other roads.';
    }
    if (v.me.loc === 'belltower') return 'Examine the empty bell-frame for a clue, or climb to reveal more of the map. Travel when you are ready.';
    return 'Examine this place for clues, then use Travel to follow a known road. The map and journal help you find your way toward the Abbey and the Heart.';
  }
  function panel(v) {
    var upgrades = v.me.offer ? '<section class="opening-upgrade" aria-label="Choose an improvement"><b>You learned something. Choose one improvement · free</b>' + v.me.offer.map(function (u) { return '<button class="btn small" data-act="levelup" data-pick="' + esc(u.id) + '" title="' + esc(u.text) + '">' + esc(u.name) + '</button>'; }).join('') + '</section>' : '';
    var o = v.opening, title = o ? o.title : 'Reach the Heart. Decide the bell’s fate.';
    var context = o ? o.context : 'Gather clues and allies before the Haunting Clock fills.';
    return upgrades + '<section class="expedition-guide" aria-label="Your objective"><div><span class="guide-label">' + (o && !o.complete ? 'Chapter one · The missing bell' : 'The expedition') + '</span><strong>' + esc(title) + '</strong><p>' + esc(context) + '</p></div><div class="guide-next"><span class="guide-label">Next · ' + v.game.ap + ' actions left · Clock ' + v.game.clock + '/' + v.game.clockMax + '</span><p>' + esc(next(v)) + '</p><details><summary>Why these numbers matter</summary><p>Health keeps you standing. Sanity keeps you grounded. Both can be restored. Each turn gives you actions; the Haunting Clock advances between rounds, making the Hollow more dangerous.</p><p>' + (v.game.readingTime ? 'Solo has no reading deadline. Spent turns advance after you close results and choices.' : 'Together, the active player has a timed turn. Discoveries in this opening belong to the whole party.') + '</p></details></div><details class="guide-help"><summary>Help</summary><button class="btn ghost small" data-act="howto">How to play</button><p>Your larger goal: reach the Heart and decide the bell’s fate.</p></details></section>';

  }
  var tray = g.HollowCards.tray;
  g.HollowCards.tray = function (v) { return panel(v) + tray.apply(this, arguments); };
  var howto = UI.howtoModal;
  UI.howtoModal = function () {
    return howto.apply(this, arguments).replace('<h2>', '<div class="guide-primer"><b>Your first expedition</b><ol><li>Read the notice board in the square. Select its card, review the odds and costs, then confirm the roll.</li><li>Choose Travel to see connected roads. Explore for clues and allies; follow the mystery toward the Abbey and the Heart.</li><li>Each turn has a limited number of actions. End your turn when they run out. The shared Haunting Clock advances between rounds.</li><li>At the Heart, propose an ending and vote with your party. Clues, allies and your choices affect the final roll.</li></ol><p>Vitality is your health; Sanity is your mental strength. Your private character objective is a bonus goal, separate from the expedition.</p></div><h2>');
  };
  function canAdvance(v, blocked) {
    return !!(v && v.phase === 'playing' && v.game && v.game.readingTime && v.game.active === v.you && v.game.ap === 0 && v.me && v.me.status === 'alive' && !v.me.pendingLevels && (!v.enc || (v.enc.kind === 'loc' && v.enc.result && !v.enc.hold)) && !v.vote && !blocked);
  }
  g.HollowGuidance = { next: next, canAdvance: canAdvance };
})(window);
