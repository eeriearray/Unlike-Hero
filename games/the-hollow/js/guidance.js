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
    if (v.me.loc === 'heart_chamber') return 'You have reached the Heart. Open its encounter and propose the bell’s fate.';
    if (v.opening && (!v.opening.complete || ['square', 'chapel', 'graveyard', 'belltower'].indexOf(v.me.loc) >= 0)) return v.opening.hint;
    if (v.me.loc === 'square') {
      var board = options.find(function (o) { return o.id === 'board' && o.state === 'ok'; });
      if (board) return 'Start with “Read the notice board” below. Review the odds, then roll to look for your first clue.';
      if (!enc) return 'Open this place’s encounter using the first card below to examine the notice board and well.';
      return 'Follow the bell: choose Travel and inspect the road to the Drowned Bell Tower. You can also explore other roads.';
    }
    if (v.me.loc === 'belltower') return 'Examine the empty bell-frame for a clue, or climb to reveal more of the map. Travel when you are ready.';
    return 'Examine this place for clues, then use Travel to follow a known road. The map and journal help you find your way toward the Abbey and the Heart.';
  }
  // Recommendations describe real, available commands; they never execute them.
  function recommend(v) {
    if (!v.me || v.me.status !== 'alive' || v.game.ap < 1 || v.me.pendingLevels || v.vote || (v.enc && (v.enc.hold || v.enc.kind !== 'loc'))) return null;
    var o = v.opening;
    if (!o || o.complete) return null;
    if (o.target !== v.me.loc) return { k: 'act', id: 'travel' };
    if (!v.enc) return { k: 'act', id: 'interact' };
    var ids = { arrival: ['board'], record: ['vestry'], route: ['headstones'], enter: ['maintenance', 'force_entry'], frame: ['expertise', 'frame'], response: ['muffle', 'answer_echo'] }[o.id] || [];
    var choice = ids.find(function (id) { return (v.enc.options || []).some(function (x) { return x.id === id && x.state === 'ok'; }); });
    return choice ? { k: 'opt', id: choice } : null;
  }
  function instruction(v) {
    var o = v.opening, guided = o && !o.complete;
    var hint = next(v);
    if (v.game.active !== v.you) hint = 'Your companion is acting. Watch their discoveries; your next step will appear on your turn.';
    else if (guided && v.game.ap > 0 && !v.me.pendingLevels && !v.vote && (!v.enc || (v.enc.kind === 'loc' && !v.enc.hold))) {
      var names = {square:'the Silent Square',chapel:'the Chapel',graveyard:'the Graveyard',belltower:'the Bell Tower'};
      if (o.target !== v.me.loc) hint = 'Choose Travel, then go to ' + (names[o.nextTarget || o.target] || o.nextTarget || o.target) + (o.nextTarget && o.nextTarget !== o.target ? ' on the way to ' + (names[o.target] || o.target) : '') + '.';
      else if (!v.enc) hint = 'Click a marked object in the scene to examine it. You can also use the cards below.';
      else if (o.id === 'arrival') hint = 'Click “Read the notice board” in the scene, then Roll the D20. Even a failed roll can reveal the way forward.';
    }
    return hint;
  }
  function mission(v) {
    var o = v.opening, guided = o && !o.complete;
    var steps = ['arrival', 'record', 'route', 'enter', 'frame', 'response'], step = guided ? steps.indexOf(o.id) + 1 : 0;
    var hint = instruction(v);
    return '<section class="mission-focus" aria-label="Expedition objective"><span class="guide-label">Shared expedition objective</span><h2>' + esc(o ? o.title : 'Reach the Heart and decide the bell’s fate') + '</h2><p class="mission-purpose"><b>Why now:</b> ' + esc(o ? o.context : 'The bell is taking names. Find how to stop it before the Clock fills.') + '</p><div class="mission-step"><span class="guide-label">Suggested action</span><p>' + esc(hint) + '</p></div>' + (o && o.observation ? '<details class="character-observation"><summary>Your character notices a way</summary><p>' + esc(o.observation) + '</p><p>This is an optional approach on the object; the normal check remains available.</p></details>' : '') + '</section>';

  }
  function panel(v) {
    var upgrades = v.me.offer ? '<section class="opening-upgrade" aria-label="Choose an improvement"><b>You learned something. Choose one improvement · free</b>' + v.me.offer.map(function (u) { return '<button class="btn small" data-act="levelup" data-pick="' + esc(u.id) + '" title="' + esc(u.text) + '">' + esc(u.name) + '</button>'; }).join('') + '</section>' : '';
    var followup = v.enc && v.enc.result ? '<p class="result-next"><b>Next:</b> ' + esc(instruction(v)) + '</p>' : '';
    return upgrades + followup + '<section class="expedition-guide guide-support" aria-label="Turn and help"><span>' + v.game.ap + ' actions left · Haunting Clock ' + v.game.clock + '/' + v.game.clockMax + '</span><details><summary>How this works</summary><button class="btn ghost small" data-act="fieldletter">Read the expedition letter</button><p>Choose a card, read what it costs, then confirm. Your lanterns are actions. Each normal action spends one.</p><p>' + (v.game.readingTime ? 'Take your time reading. When your actions run out, close any results or choices and the next turn starts automatically.' : 'The active player takes a timed turn. Discoveries belong to the whole party.') + '</p><p>Vitality is health. Sanity is mental strength. Both can be restored. The Haunting Clock advances between rounds and makes the Hollow more dangerous.</p><button class="btn ghost small" data-act="howto">Full instructions</button></details></section>';

  }
  UI.fieldLetterModal = function (v) {
    var solo = v.game.readingTime, guided = v.opening && !v.opening.complete;
    var first = guided && v.opening.id === 'arrival' ? 'Click the notice board in the square. Read its notice, then follow the lead it gives you.' : 'Examine a marked object where you stand, or choose Travel to follow a road. Your current objective points the way.';
    return '<div class="modal field-letter-modal" role="dialog" aria-modal="true" aria-labelledby="field-letter-title"><article class="box field-letter"><button class="letter-close" data-act="closemodal" aria-label="Close expedition letter">×</button><span class="letter-kicker">Delivered to your lantern · Thornwick</span><h2 id="field-letter-title">To whoever follows the bell,</h2><p>You came because a letter in your own handwriting warned: “Come to Thornwick before the bell learns your name.” Your personal reasons brought you to the road; this warning brought you into the square.</p><p>The village is empty. A toll just sounded from a tower whose bell was removed forty years ago.</p><p><b>Your first task:</b> find who removed the bell and what is ringing now. The notice board carries the removal certificate. If the warning is true, finding the bell is your chance to stop it taking you.</p><h3>Keep these few things in mind</h3><ol><li><b>Touch the world.</b> Click or tap the marked objects to look closer. Use Tab and Enter if you prefer a keyboard. The highlighted marker points toward your next clue.</li><li><b>Read, then commit.</b> Inspecting an object is free. Before an action, you can review its cost and odds. Confirm with Roll the D20 when a check is needed.</li><li><b>Your lanterns are actions.</b> Moving, searching and most choices spend one. ' + (solo ? 'There is no reading deadline. When actions run out, finish reading and close results or choices; the next turn starts automatically.' : 'Take turns with your companions. End your turn when ready; the active turn also has a timer.') + '</li><li><b>Protect body and mind.</b> Vitality is health; Sanity is mental strength. Rest and supplies can restore them. The clock advances between rounds, making the Hollow more dangerous.</li><li><b>Follow discoveries.</b> The objective changes as your party finds clues. In the village opening, even a failed roll can move the mystery forward. Your private character objective is a bonus.</li></ol><p class="letter-first"><b>Your next move:</b> ' + first + '</p><p class="letter-signature">Keep your lantern lit.<br>— A former expedition</p><button class="btn letter-begin" data-act="closemodal">Fold the letter · Begin exploring</button><small>You can reopen this letter under “How this works”.</small></article></div>';
  };
  var tray = g.HollowCards.tray;
  g.HollowCards.tray = function (v) { return panel(v) + tray.apply(this, arguments); };
  var howto = UI.howtoModal;
  UI.howtoModal = function () {
    return howto.apply(this, arguments).replace('<h2>', '<div class="guide-primer"><b>Your first expedition</b><ol><li>Read the notice board in the square. Select its card, review the odds and costs, then confirm the roll.</li><li>Choose Travel to see connected roads. Explore for clues and allies; follow the mystery toward the Abbey and the Heart.</li><li>Each turn has a limited number of actions. End your turn when they run out. The shared Haunting Clock advances between rounds.</li><li>At the Heart, propose an ending and vote with your party. Clues, allies and your choices affect the final roll.</li></ol><p>Vitality is your health; Sanity is your mental strength. Your private character objective is a bonus goal, separate from the expedition.</p></div><h2>');
  };
  function canAdvance(v, blocked) {
    return !!(v && v.phase === 'playing' && v.game && v.game.readingTime && v.game.active === v.you && v.game.ap === 0 && v.me && v.me.status === 'alive' && !v.me.pendingLevels && (!v.enc || (v.enc.kind === 'loc' && v.enc.result && !v.enc.hold)) && !v.vote && !blocked);
  }
  g.HollowGuidance = { next: next, mission: mission, recommend: recommend, canAdvance: canAdvance };
})(window);
