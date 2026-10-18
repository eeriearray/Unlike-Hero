/* THE HOLLOW — data: regions, the central mystery, secrets, objectives, endings.
 * Chapter One: The Missing Bell.
 */
(function (g) {
  'use strict';
  var D = g.HollowData = g.HollowData || {};

  D.chapter = {
    id: 'missing_bell', title: 'Chapter One: The Missing Bell',
    premise: 'Thornwick has vanished from every map. Its bell rings every night anyway, though the tower has stood empty for forty years. Each time it tolls, something in the Hollow remembers a new name. You came to find out whose.',
    goal: 'Learn what happened to Thornwick, why the bell rings, and what lies beneath the Abbey. Then silence the bell, ring it backward, bargain with what holds it, or break it, before the thirteenth toll.'
  };

  D.regions = {
    village: { id: 'village', name: 'The Dying Village', color: '#6f9a95', ambience: 'village', hazard: 'Collapse and crows', blurb: 'Thornwick, or what is left of it: shutters hung open, wells that drip upward, a bell that will not stop.' },
    estate:  { id: 'estate',  name: 'The Black Estate', color: '#8a78c9', ambience: 'estate',  hazard: 'Traps and shifting rooms', blurb: 'The magistrate\'s house of black brick. Its rooms rearrange themselves at night so nobody finds the same door twice.' },
    woods:   { id: 'woods',   name: 'The Whispering Woods', color: '#5f9a6f', ambience: 'woods',   hazard: 'Beasts and getting lost', blurb: 'Pines that lean toward travellers. The wind in them says half-sentences.' },
    abbey:   { id: 'abbey',   name: 'The Forsaken Abbey', color: '#c4a867', ambience: 'abbey',   hazard: 'Curses and sanity loss', blurb: 'Father Venn\'s abbey, windowless since the Silencing. The stones remember being prayed at.' },
    crypt:   { id: 'crypt',   name: 'The Sunken Crypt', color: '#5d86ad', ambience: 'crypt',   hazard: 'Drowning and the restless dead', blurb: 'Knee-deep black water, candles floating in it. The dead here do not want to be found, only to be counted.' },
    heart:   { id: 'heart',   name: 'The Heart of the Hollow', color: '#c0556f', ambience: 'heart',   hazard: 'Overwhelming dread', blurb: 'The place Thornwick went. A cavern the size of a village, lit by a single enormous, silent bell.' }
  };

  // ───────────────────────────────────────────── The mystery ─────────────────────────────────────────────
  // Four pillars of truth. A pillar is "understood" once the party holds 2 of its clues. Every pillar has 4+ clues
  // in different regions, so no single missed clue can block the ending.
  D.pillars = {
    fate:   { id: 'fate',   name: 'What became of Thornwick', need: 2 },
    bell:   { id: 'bell',   name: 'Why the bell rings',       need: 2 },
    entity: { id: 'entity', name: 'What waits beneath',       need: 2 },
    end:    { id: 'end',    name: 'How it might end',         need: 2 }
  };

  D.clues = {
    ledger:        { pillar: 'fate',   title: 'The Parish Ledger', text: '212 names, each struck through in the same hand on the same night. The last line says only: "All paid in full."' },
    diary:         { pillar: 'fate',   title: 'The Magistrate\'s Diary', text: '"We voted. Eighty to seventy. The bell was to be the price, and the village the receipt. God forgive a quorum."' },
    hunter_tale:   { pillar: 'fate',   title: 'The Hunter\'s Account', text: 'He watched the village sink at dusk like a stone into milk. Nobody screamed. They were counting, together, under their breath.' },
    abbey_record:  { pillar: 'fate',   title: 'The Burial Register', text: 'A burial each night for a month, and no body in any grave. Father Venn was burying names.' },
    ossuary_names: { pillar: 'fate',   title: 'The Singing Bones', text: 'The bones hum the village names in order of the vote. The last name hummed is Venn\'s own.' },

    bell_cast:     { pillar: 'bell',   title: 'Cast in Grave-Iron', text: 'Thornwick\'s Great Bell was poured from melted grave-markers, so that every toll would remember someone.' },
    forge_marks:   { pillar: 'bell',   title: 'The Struck-off Tongue', text: 'The clapper was removed with a sledge, by hand, and hidden. The bell cannot ring itself. Something else is pulling the rope.' },
    choir_notes:   { pillar: 'bell',   title: 'The Remembering Toll', text: 'A hymnal score marked "to remember". Written beneath in a tremulous hand: "A bell rung backward unspeaks what it spoke."' },
    shrine_hum:    { pillar: 'bell',   title: 'The Shrine\'s Hum', text: 'The shrine hums the bell\'s note, one octave down. It is not a shrine. It is an ear, and the Hollow is listening through it.' },
    clapper_lore:  { pillar: 'bell',   title: 'Where the Tongue Sleeps', text: 'The clapper was hidden where the entity could not hear it: under running water, in the oldest part of the crypt.' },

    entity_name:   { pillar: 'entity', title: 'The Remembrancer', text: 'It is not a devil. It is a keeper of lists, and it wants the list to be complete.' },
    memory_hunger: { pillar: 'entity', title: 'It Eats the Forgotten', text: 'The Remembrancer stays whole by remembering names. Each toll takes one more. When it runs out of names, it will take yours.' },
    venn_confession:{pillar: 'entity', title: 'Venn\'s Confession', text: '"I did not bargain for them. I bargained them. I was only the clerk. Oh, but I signed so beautifully."' },
    mirror_truth:  { pillar: 'entity', title: 'The Faces in the Glass', text: 'The mirrors show the faces the Remembrancer has memorised. The faces are still alive in there, and still waiting.' },

    silence_rite:  { pillar: 'end',    title: 'The Rite of Silence', text: 'To silence a bell: speak the name it was cast for, then each name it has taken, with a salt-white hand upon the rim.' },
    reverse_rite:  { pillar: 'end',    title: 'Under the Hollow Stars', text: 'Ring it backward beneath the stars of its birth and every name it holds is spoken out and unmade. It needs the clapper.' },
    pact_terms:    { pillar: 'end',    title: 'The Terms of the Hush', text: 'The Remembrancer will bargain. It takes one name from the living and lets the rest walk. It is always careful to be fair.' },
    unmaking:      { pillar: 'end',    title: 'A Cracked Bell', text: 'Break the heart-bell and the Hollow ends. But it has been holding something back, and it will not hold it any more.' },

    warden_oath:   { pillar: 'fate',   title: 'The Warden\'s Oath', text: 'The Abbey Warden swore to guard the stair until the bell was silent. If someone silences it, his oath is kept, and he can rest.' }
  };

  // Puzzle secrets are drawn at the start of every game. Wrong guesses are eliminated for everyone, so a puzzle can
  // always be solved by elimination. Clues can eliminate options early ("hint").
  D.secrets = {
    bellName: { label: 'the bell\'s true name', vals: ['Marrow', 'Vesper', 'Lament', 'Tallow', 'Hollis', 'Mercy'] },
    sigil:    { label: 'the sigil on the crypt door', vals: ['crown', 'hand', 'eye'], names: { crown: 'The Crowned Skull', hand: 'The Open Hand', eye: 'The Weeping Eye' } },
    star:     { label: 'the constellation of the bell\'s birth', vals: ['stag', 'bell', 'crow'], names: { stag: 'The Stag', bell: 'The Bell', crow: 'The Crow' } },
    shelf:    { label: 'the shelf that holds the choir book', vals: ['burnt', 'chained', 'bare'], names: { burnt: 'the shelf of burnt spines', chained: 'the chained shelf', bare: 'the bare shelf' } },
    mirror:   { label: 'the lying reflection', vals: ['left', 'middle', 'right'], names: { left: 'the left reflection', middle: 'the middle reflection', right: 'the right reflection' } },
    fountain: { label: 'what the fountain wants', vals: ['salt', 'candle', 'silver'], names: { salt: 'salt', candle: 'a candle flame', silver: 'silver' } },
    grave:    { label: 'the grave with no bones', vals: ['a', 'b', 'c'], names: { a: 'the leaning grave', b: 'the flooded grave', c: 'the grave with the iron cross' } },
    herb:     { label: 'the true herb', vals: ['red', 'pale', 'blue'], names: { red: 'the red-veined herb', pale: 'the pale herb', blue: 'the blue herb' } },
    heartName:{ label: 'the name the bell rings last', vals: ['Tamsin Greaves', 'Aldous Venn', 'Old Ketterick', 'Hob Marl'] },
    keyLoc:   { label: 'where the Spirit Key lies', vals: ['battlefield', 'prison', 'sunken_archive', 'hunter_cabin'] },
    curse:    { label: 'the curse the Unmaker hunts', vals: ['rot', 'cradle', 'shrine'] },
    relic:    { label: 'the Opportunist\'s prize', vals: ['saint_finger', 'weeping_eye', 'gilded_psalter', 'ember_locket'] }
  };

  D.curses = {
    rot:    { id: 'rot',    name: 'The Orchard Rot', where: 'woods', text: 'A grey blight spreads from the Bone Orchard. Where it takes hold, the Woods cannot be rested in.' },
    cradle: { id: 'cradle', name: 'The Cradle\'s Lullaby', where: 'village', text: 'A lullaby with no singer drifts through the village at night. It makes the sleeper sing along.' },
    shrine: { id: 'shrine', name: 'The Shrine\'s Listening', where: 'woods', text: 'The Whispering Shrine carries every word spoken in the Hollow to something that writes them down.' }
  };

  D.allies = {
    tamsin:    { id: 'tamsin',    name: 'Tamsin Greaves', text: 'The last living child of Thornwick, found alive in the Abbey cells. She hears the bell as a voice.', boon: 'At every phase change she whispers one wrong name for the bell, which is then eliminated.', finale: 1 },
    hob:       { id: 'hob',       name: 'Hob Marl', text: 'A trapper who stayed in the woods because the village would not have him. He knows paths that do not move.', boon: 'At every phase change he mends the party, restoring 2 Vitality to everyone.', finale: 1 },
    ketterick: { id: 'ketterick', name: 'Old Ketterick', text: 'The herbwife of Thornwick, still tending a garden for customers who are gone.', boon: 'At every phase change she gives each of you a draught: -1 to all your statuses, and one herb.', finale: 1 }
  };

  // ───────────────────────────────────────────── Personal objectives (private) ─────────────────────────────────────────────
  // check(ctx): ctx = { p, w (world), helpers }. Evaluated at the end of the expedition; progress(ctx) gives a live hint.
  D.objectives = {
    collector:   { name: 'The Collector', text: 'End the expedition holding at least 3 relics.',
      progress: function (c) { return c.relicsHeld + ' / 3 relics'; }, check: function (c) { return c.relicsHeld >= 3; } },
    truthseeker: { name: 'The Truthseeker', text: 'Personally uncover 6 clues, from at least 3 different regions.',
      progress: function (c) { return c.cluesFound + ' clues, ' + c.cluesRegions + ' regions'; }, check: function (c) { return c.cluesFound >= 6 && c.cluesRegions >= 3; } },
    survivor:    { name: 'The Survivor', text: 'Leave the Hollow never having fallen, with 6+ Vitality and 5+ Sanity.',
      progress: function (c) { return c.p.vit + ' Vit / ' + c.p.san + ' San' + (c.p.fallenCount ? ' (fallen once: failed)' : ''); },
      check: function (c) { return c.p.fallenCount === 0 && c.alive && c.p.vit >= 6 && c.p.san >= 5; } },
    pactbound:   { name: 'The Pactbound', text: 'Seal a secret pact at the Cursed Altar and stand before the Remembrancer in the Heart Chamber.',
      progress: function (c) { return (c.p.flags.pact ? 'pact sealed' : 'no pact yet') + (c.p.visited.heart_chamber ? ', Heart reached' : ''); },
      check: function (c) { return !!c.p.flags.pact && !!c.p.visited.heart_chamber; } },
    redeemer:    { name: 'The Redeemer', text: 'Free the lost spirit trapped in the Prison of Echoes.',
      progress: function (c) { return c.w.flags.spirit_freed ? 'freed' : 'still bound'; }, check: function (c) { return !!c.w.flags.spirit_freed; } },
    unmaker:     { name: 'The Unmaker', text: 'Remove a specific curse from the world. The curse is: {curse}.',
      progress: function (c) { return c.w.cleansed[c.p.objParam] ? 'cleansed' : 'still spreading'; }, check: function (c) { return !!c.w.cleansed[c.p.objParam]; } },
    opportunist: { name: 'The Opportunist', text: 'Obtain {relic} and leave the Hollow alive.',
      progress: function (c) { return c.has(c.p.objParam) ? 'in your pack' : 'not yet'; }, check: function (c) { return c.has(c.p.objParam) && c.alive; } },
    wanderer:    { name: 'The Wanderer', text: 'Set foot in 20 different places yourself.',
      progress: function (c) { return c.visitedCount + ' / 20 places'; }, check: function (c) { return c.visitedCount >= 20; } }
  };

  // ───────────────────────────────────────────── Endings ─────────────────────────────────────────────
  // The finale: a living player at the Heart Chamber proposes an ending, the party votes, then the engine rolls
  // d20 + the best matching stat + preparation against the DC (see engine finale()). `grade` decides which text plays.
  D.endings = {
    silence: { id: 'silence', name: 'Silence the Bell', stat: 'fate', dc: 14,
      pitch: 'Speak the bell\'s name and every name it has taken. Free the trapped souls.',
      needs: { any: [{ clue: 'silence_rite' }, { minClues: 7 }] }, needsText: 'Needs the Rite of Silence, or at least 7 clues shared.',
      mods: [{ if: { flag: 'bell_named' }, d: 2, why: 'The bell\'s true name is spoken' }, { if: { flag: 'bellkeeper_down' }, d: 1, why: 'The Bellkeeper is silenced' }, { if: { flag: 'warden_down' }, d: 1, why: 'The Warden\'s oath is kept' }, { if: { flag: 'spirit_freed' }, d: 1, why: 'The lost spirit stands with you' }],
      results: {
        true:    { id: 'silence_true', title: 'The Last Toll', outcome: 'success', text: 'You lay a salt-white hand on the rim and say the names, all two hundred and twelve. As each is spoken, something in the dark lets go. The bell does not ring. For the first time in forty years, the Hollow is quiet, and Thornwick walks home through it, in the rain.' },
        flawed:  { id: 'silence_flawed', title: 'A Hush With Cracks', outcome: 'partial', text: 'The names come, but not all of them, and not in order. The bell goes quiet, with a long crack down its side. Most of Thornwick walks out. A few names are left in it, humming faintly. One of them will be yours.' },
        failed:  { id: 'silence_fail', title: 'The Toll That Took', outcome: 'failure', text: 'You speak the wrong name first. The bell answers, once, and the sound takes the one standing closest.' } } },
    reverse: { id: 'reverse', name: 'Ring It Backward', stat: 'wit', dc: 15,
      pitch: 'Fit the clapper, reverse the swing, and unmake what the bell has spoken. Exposes the entity.',
      needs: { all: [{ item: 'clapper' }, { any: [{ clue: 'reverse_rite' }, { pillar: 'entity' }] }] }, needsText: 'Needs the Broken Clapper, and either the Reverse Rite or an understanding of the entity.',
      mods: [{ if: { flag: 'stars_aligned' }, d: 3, why: 'The stars are aligned' }, { if: { flag: 'bell_named' }, d: 2, why: 'The bell\'s true name is spoken' }, { if: { pillar: 'entity' }, d: 1, why: 'You understand what waits beneath' }, { if: { flag: 'bellkeeper_down' }, d: 1, why: 'The Bellkeeper is silenced' }],
      results: {
        true:   { id: 'reverse_true', title: 'The Truth Rung', outcome: 'success', text: 'The clapper sings the wrong way. Every name the bell has swallowed comes out of it as a note, and the Remembrancer, stripped of its list, shows you its face: a clerk, hunched, apologetic, immensely old. It asks to be forgotten. You oblige.' },
        flawed: { id: 'reverse_flawed', title: 'An Echo Without End', outcome: 'partial', text: 'The bell rings backward, and the Hollow answers with every sound it has ever swallowed. You get out. Thornwick does not, quite: it is still there, just out of reach, and sometimes you hear it laugh.' },
        failed: { id: 'reverse_fail', title: 'The Wrong Swing', outcome: 'failure', text: 'You swing too early. The bell rings forward, and a great many things that were sleeping rise to answer it.' } } },
    bargain: { id: 'bargain', name: 'Make a Bargain', stat: null, dc: 0,
      pitch: 'Speak to the Remembrancer on its own terms. It lets you all walk. It takes one name.',
      needs: null, needsText: 'Always open. The more you know of its terms, the fairer the price.',
      mods: [],
      results: {
        true:   { id: 'bargain_fair', title: 'The Quiet Peace', outcome: 'partial', text: 'You know the terms, and haggle. The Remembrancer takes one name, a willing one, and writes it on the first clean line in a long time. The bell falls quiet. Thornwick stays where it is, safe, and gone.' },
        flawed: { id: 'bargain_harsh', title: 'A Careful Fairness', outcome: 'partial', text: 'You do not know what you are agreeing to, and it is very careful to be fair. The price is taken from the last person who spoke. The bell falls quiet. You do not remember who that was.' },
        failed: { id: 'bargain_harsh', title: 'A Careful Fairness', outcome: 'partial', text: 'You do not know what you are agreeing to.' } } },
    destroy: { id: 'destroy', name: 'Break the Bell', stat: 'might', dc: 13,
      pitch: 'Smash the heart-bell. The ringing ends, and the Hollow with it. But it was holding something back.',
      needs: null, needsText: 'Always open. Strong arms help, and so does grave-iron.',
      mods: [{ if: { item: 'blade' }, d: 2, why: 'Grave-iron on grave-iron' }, { if: { flag: 'warden_down' }, d: 1, why: 'No Warden to stop you' }, { if: { flag: 'abbey_pillars_cracked' }, d: 1, why: 'The Abbey is already breaking' }],
      results: {
        true:   { id: 'destroy_true', title: 'Something Worse', outcome: 'partial', text: 'The bell breaks, and the sound it makes while breaking is every name at once. The Hollow comes down around you. You run. You do not look at what comes out of the dust. Whatever it is, it is not hungry for lists. It is hungry.' },
        flawed: { id: 'destroy_true', title: 'Something Worse', outcome: 'partial', text: 'The bell breaks.' },
        failed: { id: 'destroy_fail', title: 'The Bell Breaks Wrong', outcome: 'failure', text: 'The bell cracks and keeps ringing, cracked, from inside the break. It is worse. It is so much worse.' } } },
    escape: { id: 'escape', name: 'Leave Through the Gate', stat: null, dc: 0,
      pitch: 'Walk out of the Hollow, with the mystery unsolved.', needs: null, needsText: 'Needs the Escape Gate open.', mods: [],
      results: {
        true:   { id: 'escape_wise', title: 'The Witnesses', outcome: 'partial', text: 'You carry out enough of the truth to warn the next fools. It is not enough to end it.' },
        flawed: { id: 'escape_blind', title: 'Unresolved', outcome: 'unresolved', text: 'You walk out into rain. The bell still rings in the village behind you. You will hear it at night, for the rest of your life.' },
        failed: { id: 'escape_blind', title: 'Unresolved', outcome: 'unresolved', text: 'You walk out into rain.' } } },
    doom: { id: 'doom', name: 'The Thirteenth Toll', stat: null, dc: 0, pitch: '', needs: null, mods: [],
      results: { true: { id: 'doom', title: 'The Thirteenth Toll', outcome: 'failure', text: 'The bell rings its thirteenth stroke. Everything left in the Hollow stops and turns, as one, to look at you. The list is finally complete.' },
        flawed: { id: 'doom', title: 'The Thirteenth Toll', outcome: 'failure', text: '' }, failed: { id: 'doom', title: 'The Thirteenth Toll', outcome: 'failure', text: '' } } },
    wipe: { id: 'wipe', name: 'The Silence of Graves', stat: null, dc: 0, pitch: '', needs: null, mods: [],
      results: { true: { id: 'wipe', title: 'The Silence of Graves', outcome: 'failure', text: 'The last of you lies down in the water. The bell rings, and it has your names, all of them, in order.' },
        flawed: { id: 'wipe', title: 'The Silence of Graves', outcome: 'failure', text: '' }, failed: { id: 'wipe', title: 'The Silence of Graves', outcome: 'failure', text: '' } } }
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
