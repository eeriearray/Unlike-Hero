/* Deliberately composed ink-and-stone belfry. The bell is missing in the story;
   its empty yoke and swinging rope are the landmarks, not an unrelated graveyard. */
(function (g) {
  'use strict';
  var SC = g.HollowScenes;
  var defs = '<defs><linearGradient id="bt-sky" x2="0" y2="1"><stop stop-color="#111820"/><stop offset="1" stop-color="#566363"/></linearGradient><linearGradient id="bt-stone" x2="1" y2="0"><stop stop-color="#242b2b"/><stop offset=".6" stop-color="#535951"/><stop offset="1" stop-color="#303933"/></linearGradient><linearGradient id="bt-water" x2="0" y2="1"><stop stop-color="#455653"/><stop offset="1" stop-color="#0c171c"/></linearGradient><pattern id="bt-course" width="110" height="48" patternUnits="userSpaceOnUse"><path d="M0 0h110M0 48h110M55 0v24M0 24h110M20 24v24M100 24v24" stroke="#0a1316" stroke-opacity=".4" fill="none"/></pattern></defs>';
  function landscape() {
    var s = '<rect width="1600" height="900" fill="url(#bt-sky)"/><circle cx="1140" cy="190" r="65" fill="#d5d0b4" opacity=".65"/>';
    s += '<path d="M0 520l100-95 85 35 110-120 90 80 150-60 130 90 130-130 130 120 130-40 150 75 110-130 90 95 100-20v380H0z" fill="#1a272c"/>';
    s += '<path d="M0 620l210-60 190 55 180-38 300 60 240-50 240 55 240-20v278H0z" fill="url(#bt-water)"/>';
    for (var i = 0; i < 27; i++) { var x = (i * 179) % 1500, y = 658 + (i * 37) % 230; s += '<path d="M' + x + ' ' + y + 'h' + (65 + i % 5 * 29) + '" stroke="#b7bda0" opacity=".12" fill="none"/>'; }
    s += '<path d="M540 697L580 235H920L970 697z" fill="url(#bt-stone)" stroke="#111a1b" stroke-width="9"/><path d="M540 697L580 235H920L970 697z" fill="url(#bt-course)"/>';
    s += '<path d="M550 250L750 72 950 250z" fill="#172023" stroke="#9b9a7e" stroke-width="4"/><path d="M750 72v-45m-24 15h48" stroke="#252c2b" stroke-width="8"/>';
    s += '<path d="M625 460V325Q750 210 875 325V460z" fill="#081419" stroke="#a2a28b" stroke-width="10"/>';
    s += '<path d="M688 695V565Q750 495 812 565V695z" fill="#0b1518" stroke="#8c8f7c" stroke-width="6"/><path d="M555 700h410l50 24H510z" fill="#8c8f7c"/>';
    s += '<path d="M0 830l480-108 85 20L220 900H0z" fill="#303a37"/><path d="M38 832l435-90M140 860l362-105" stroke="#858977" stroke-width="3" opacity=".5"/>';
    s += '<path d="M970 680l205-35 240 62 185-20v40l-230 15-260-38-140 10z" fill="#8b9c91" opacity=".13"/>';
    return s;
  }
  function object(name, box, actions, art, blurb) {
    return { name: name, box: box, at: [box[0] + box[2] / 2, box[1] + box[3] / 2], crop: box, z: 1.5, layer: 'belfry', actions: actions, art: art, blurb: blurb };
  }
  SC.register({ id: 'belltower', vb: [1600, 900], defs: defs,
    layers: function () { return [{ id: 'belfry', depth: .4, svg: landscape() }, { id: 'objects', depth: .4, objects: true }]; },
    objects: {
      frame: object('The empty bell-frame', [620, 300, 260, 155], [{ opt: 'frame' }], function () { return '<path d="M632 330h235M648 315v130M852 315v130" stroke="#79664d" stroke-width="16"/><path d="M660 335l80 65 98-65" stroke="#b2a383" stroke-width="4" fill="none"/><circle cx="748" cy="400" r="13" fill="none" stroke="#b2a383" stroke-width="5"/>'; }, 'A vacant iron yoke. The bell was taken; the tolling never stopped.'),
      climb: object('The belfry ladder', [885, 415, 135, 275], [{ opt: 'climb' }], function () { var s = '<path d="M910 690l-6-260M972 690l-20-260" stroke="#b6a07a" stroke-width="7"/>'; for (var y = 450; y < 680; y += 28) s += '<path d="M908 ' + y + 'h48" stroke="#95866b" stroke-width="6"/>'; return s; }, 'Rotten rungs lead above the flooded village. Review the risk before you climb.'),
      listen: object('The hanging rope', [700, 450, 115, 230], [{ opt: 'listen' }], function () { return '<path d="M748 417q-16 75 0 130t-8 103q-20 34-32 10t32-10" stroke="#c9b481" stroke-width="5" fill="none"/>'; }, 'The rope stirs without wind. Below it, the tower carries voices from the missing bell.'),
      search: object('Search the flooded steps', [515, 690, 470, 80], [{ act: 'investigate' }], function () { return '<path d="M545 735h400M570 751h350" stroke="#a6a18a" stroke-width="3" opacity=".6"/>'; }, 'Look for traces left in the stone and water.'),
      road: object('Road back to the village', [80, 760, 340, 125], [{ act: 'travel' }], function () { return '<path d="M320 790l-85 25 43 12m-43-12 25-32" stroke="#c8b78e" stroke-width="4" fill="none"/>'; }, 'Choose a known road on the travel panel.')
    }, state: function () {}, fx: {}
  });
})(window);
