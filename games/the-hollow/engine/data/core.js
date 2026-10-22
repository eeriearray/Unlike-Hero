/* THE HOLLOW — data: classes, items, enemies, statuses, skills.
 * Pure data. The engine (../hollow-engine.js) interprets it; add entries here to extend the game.
 * Loaded as a classic <script> in browsers and with require() in Node; both fill globalThis.HollowData.
 */
(function (g) {
  'use strict';
  var D = g.HollowData = g.HollowData || {};

  // ───────────────────────────────────────────── Characters ─────────────────────────────────────────────
  D.classes = {
    occultist: {
      id: 'occultist', name: 'The Occultist', person: 'Isolde Marrowe', title: 'Reader of Forbidden Margins', color: '#8b6fd1',
      stats: { might: 0, wit: 3, fate: 3 }, vit: 9, san: 7,
      passive: { name: 'Margin Notes', text: '+2 to every check made at an occult place (marked with a violet star). Sees the exact odds of every puzzle choice.' },
      active: { name: 'Twist Fate', text: 'After a failed check, reroll it and keep the new result. Costs 1 Sanity. Once per Haunting phase.', limit: 'once per phase' },
      weakness: 'Frail mind: only 7 Sanity.',
      backstory: 'Isolde catalogued banned books for a university that burned them. She kept the footnotes.',
      reason: 'The bell tolls in the margins of seven forbidden texts. She wants the eighth page.',
      start: ['lantern', 'salt'], silver: 2
    },
    hunter: {
      id: 'hunter', name: 'The Hunter', person: 'Corvin Ash', title: 'Warden of the Wolf-Roads', color: '#b9733d',
      stats: { might: 3, wit: 1, fate: 1 }, vit: 12, san: 8,
      passive: { name: 'Tracker', text: '+2 Might against beasts and the undead. Beasts never ambush you when you step carefully. -1 to every check at an occult place.' },
      active: { name: 'Set Snare', text: 'Lay a snare here. The next enemy to arrive or ambush at this place is wounded and cannot ambush. Cooldown: 2 rounds.', limit: 'cooldown 2 rounds' },
      weakness: 'Poor at the occult.',
      backstory: 'Corvin tracked wolves for the crown until the wolves started walking on two legs.',
      reason: 'Something took his hounds into the Hollow. He wants them back, or what is left of them.',
      start: ['snare', 'tonic'], silver: 3
    },
    apothecary: {
      id: 'apothecary', name: 'The Apothecary', person: 'Maelis Thorne', title: 'Mixer of Small Mercies', color: '#4fa38a',
      stats: { might: 1, wit: 3, fate: 2 }, vit: 10, san: 9,
      passive: { name: 'Forager', text: 'Gathers a herb the first time they enter a village or woodland place. All healing you give or receive restores +1.' },
      active: { name: 'Brew', text: 'Turn 2 herbs into a Tonic, a Salt Charm or a Clarity Draught (+3 Sanity). Needs herbs. Cooldown: 1 round.', limit: 'needs herbs' },
      weakness: 'Everything runs on a thin supply of herbs.',
      backstory: 'Maelis sold tinctures in a village that no longer appears on maps. She is the only customer it has not collected.',
      reason: 'Her ledger lists every debt of the missing village. One name is hers.',
      start: ['herb', 'herb', 'tonic'], silver: 3
    },
    medium: {
      id: 'medium', name: 'The Medium', person: 'Wren Calloway', title: 'Listener at the Thin Place', color: '#6aa3c9',
      stats: { might: 0, wit: 2, fate: 4 }, vit: 8, san: 10,
      passive: { name: 'Veil-sighted', text: '+2 to Fate checks against spirits. Investigating always reveals whether a clue remains in that place. Spirits strike you one point harder.' },
      active: { name: 'Calm the Dead', text: 'Restore 2 Sanity to an ally in your place (or to yourself, 1). The dead notice: the Haunting Clock advances by 1. Cooldown: 2 rounds.', limit: 'cooldown 2 rounds' },
      weakness: 'Attracts attention from the other side.',
      backstory: 'Wren held seances for grieving widows until one of the voices answered with her mother\'s name.',
      reason: 'The bell rings in her sleep. It keeps asking her to say something back.',
      start: ['candle', 'salt'], silver: 2
    },
    vagabond: {
      id: 'vagabond', name: 'The Vagabond', person: 'Jory Quill', title: 'Thief of Back Roads', color: '#c9a35b',
      stats: { might: 1, wit: 3, fate: 2 }, vit: 10, san: 8,
      passive: { name: 'Light Step', text: 'Your first Sprint each round is silent. Investigating always finds hidden routes, no roll. -1 to Strike (Might) checks against enemies.' },
      active: { name: 'Slip Away', text: 'Escape any confrontation with no roll and step to any adjacent open place. Once per Haunting phase.', limit: 'once per phase' },
      weakness: 'Weak in a straight fight.',
      backstory: 'Jory has never met a lock, wall or debt that stayed put. The Hollow is the first place that moved back.',
      reason: 'A fence promised a fortune in grave-silver, paid on delivery. The fence did not say where.',
      start: ['thread', 'lamp_oil'], silver: 5
    },
    exorcist: {
      id: 'exorcist', name: 'The Exorcist', person: 'Brother Anselm Vey', title: 'Sealer of Doors', color: '#d9d2bd',
      stats: { might: 2, wit: 1, fate: 3 }, vit: 11, san: 9,
      passive: { name: 'Sanctified', text: 'You and allies in your place take 1 less Sanity damage (never below 0). +1 to Fate checks at sanctuaries.' },
      active: { name: 'Rite of Sealing', text: 'Choose a rite: purify this place, cleanse one curse, seal this place against enemies for the phase, or banish a weak spirit here. Only 3 rites per expedition.', limit: '3 rites per expedition' },
      weakness: 'Powerful rites are strictly limited.',
      backstory: 'Anselm sealed ninety-one hauntings. The ninety-second sealed him inside it for a month.',
      reason: 'His order is silent. A page in his breviary has begun writing itself, and it is addressed to him.',
      start: ['salt', 'chalk'], silver: 2
    }
  };

  // ───────────────────────────────────────────── Items ─────────────────────────────────────────────
  // kind: tool | consumable | weapon | charm | relic | key | material
  // size: pack slots a single stack uses. stack: max quantity per stack. uses: charges (non-stackable).
  D.items = {
    lantern:   { id: 'lantern', name: 'Wick Lantern', kind: 'tool', size: 1, uses: 5, equip: true, glyph: 'lantern',
      desc: 'Equipped: Investigating shows every hidden route and secret next to you, no roll. Burns one charge per use. A lit lantern is loud to beasts: the Hollow Stag and Hounds grow harder to slip past.' },
    lamp_oil:  { id: 'lamp_oil', name: 'Lamp Oil', kind: 'material', size: 1, stack: 2, glyph: 'flask', desc: 'Refills three charges of the Wick Lantern. Use it when the lantern is in your pack.' },
    tonic:     { id: 'tonic', name: 'Minor Tonic', kind: 'consumable', size: 1, stack: 3, glyph: 'flask',
      desc: 'Restores 3 Vitality and stops bleeding. Tastes of pennies and rain.' },
    thread:    { id: 'thread', name: 'Silver Thread', kind: 'consumable', size: 1, stack: 2, glyph: 'thread',
      desc: 'Use before moving. Your next move is walked along the thread: it cancels traps and ambushes at the destination, and costs no noise.' },
    salt:      { id: 'salt', name: 'Salt Charm', kind: 'consumable', size: 1, stack: 3, glyph: 'salt',
      desc: 'Ward against the unseen. Cancels the next Sanity loss you would take from any source, and kills a Whisperling outright.' },
    blade:     { id: 'blade', name: 'Grave-Iron Blade', kind: 'weapon', size: 1, equip: true, glyph: 'blade', mods: { might: 1, fate: -1 },
      desc: 'Equipped: +1 Might, and +3 more against the undead. The iron dislikes the unseen: -1 Fate while it is drawn.' },
    moonrelic: { id: 'moonrelic', name: 'Moonbound Relic', kind: 'charm', size: 1, equip: true, glyph: 'moon', rare: true,
      desc: 'Equipped: once per Haunting phase, reroll a failed check and keep the new result. Each use makes the Hollow notice: the Haunting Clock advances by 1.' },
    spirit_key:{ id: 'spirit_key', name: 'Spirit Key', kind: 'key', size: 1, glyph: 'key', rare: true,
      desc: 'Opens any sealed passage without a roll. Each use costs 1 Sanity: the door remembers who it was keeping out.' },
    clapper:   { id: 'clapper', name: 'Broken Bell Clapper', kind: 'key', size: 2, glyph: 'clapper', rare: true,
      desc: 'Heavy (2 slots). Silences the Bellkeeper, and lets the party ring the bell backward at the Heart. It hums: you lose 1 Sanity at each Haunting phase change while you carry it.' },
    herb:      { id: 'herb', name: 'Gravemoss', kind: 'material', size: 1, stack: 4, glyph: 'herb',
      desc: 'A bitter herb. Chew: +1 Vitality, but the world swims (1 Sanity). Better as an ingredient: an Apothecary can brew two into something useful.' },
    snare:     { id: 'snare', name: 'Hunter\'s Snare', kind: 'consumable', size: 1, stack: 2, glyph: 'snare',
      desc: 'Use during a confrontation: the enemy is wounded for 2 and cannot act this round.' },
    chalk:     { id: 'chalk', name: 'Ward Chalk', kind: 'consumable', size: 1, stack: 2, glyph: 'chalk',
      desc: 'Draw a circle. For two rounds this place cannot be corrupted, enemies will not ambush it, and you may Rest here even if it is unsafe.' },
    candle:    { id: 'candle', name: 'Offering Candle', kind: 'material', size: 1, stack: 2, glyph: 'candle',
      desc: 'Beeswax stamped with a bell. Needed for the library rite against the Abbey Warden and for certain offerings.' },
    mirror_shard: { id: 'mirror_shard', name: 'Mirror Shard', kind: 'consumable', size: 1, glyph: 'shard',
      desc: 'Hold it up to a Mirror Twin or Whisperling and it sees itself. Destroys one such enemy outright. Cracks after use.' },
    moonwater: { id: 'moonwater', name: 'Vial of Moonwater', kind: 'consumable', size: 1, glyph: 'flask', rare: true,
      desc: 'Cleanses a curse, or wakes a fallen ally at your feet (counts against the party\'s limit of two revivals).' },
    wardens_key:{ id: 'wardens_key', name: 'Warden\'s Key', kind: 'key', size: 1, glyph: 'key', rare: true,
      desc: 'Iron, cold, shaped like a bell\'s tongue. Opens the Nameless Door below the Abbey.' },
    star_lens: { id: 'star_lens', name: 'Star Lens', kind: 'key', size: 1, glyph: 'lens', rare: true,
      desc: 'A ground crystal lens from the observatory. Opens the star-door between the Estate and the Abbey.' },
    // Relics: carry them for passive power. They count toward the Collector\'s hoard.
    weeping_eye:   { id: 'weeping_eye', name: 'Weeping Eye', kind: 'relic', size: 1, glyph: 'eye', mods: { wit: 2, fate: -1 }, rare: true,
      desc: 'A glass eye that sheds slow tears. +2 Wit, -1 Fate.' },
    saint_finger:  { id: 'saint_finger', name: 'Saint\'s Finger', kind: 'relic', size: 1, glyph: 'bone', mods: { fate: 2, might: -1 }, rare: true,
      desc: 'A blackened knuckle in a silver sleeve. +2 Fate, -1 Might.' },
    gilded_psalter:{ id: 'gilded_psalter', name: 'Gilded Psalter', kind: 'relic', size: 1, glyph: 'book', mods: { wit: 1, fate: 1 }, rare: true,
      desc: 'Pages of beaten gold, hymns of drowned parishes. +1 Wit, +1 Fate. Worth a fortune to the right buyer.' },
    bone_chalice:  { id: 'bone_chalice', name: 'Bone Chalice', kind: 'relic', size: 1, glyph: 'cup', mods: { might: 1, wit: -1 }, rare: true,
      desc: 'Carved from a pilgrim\'s skull. +1 Might, -1 Wit.' },
    ember_locket:  { id: 'ember_locket', name: 'Ember Locket', kind: 'relic', size: 1, glyph: 'locket', mods: { fate: 1, wit: 1 }, rare: true,
      desc: 'Warm as a held hand. Inside, a portrait that changes. +1 Fate, +1 Wit.' }
  };
  D.relics = ['weeping_eye', 'saint_finger', 'gilded_psalter', 'bone_chalice', 'ember_locket', 'moonrelic'];

  // ───────────────────────────────────────────── Statuses ─────────────────────────────────────────────
  D.statuses = {
    blessed:  { name: 'Blessed',  good: true,  text: '+2 to your next check.' },
    cursed:   { name: 'Cursed',   good: false, text: '-1 to every check until cleansed.' },
    marked:   { name: 'Marked',   good: false, text: 'The entity knows your name. Enemies strike you harder and the Remembrancer speaks to you.' },
    bleeding: { name: 'Bleeding', good: false, text: 'Lose 1 Vitality at the end of each round until healed, tonic or Rest.' },
    hunted:   { name: 'Hunted',   good: false, text: 'Something follows. Resting is not safe until you lose it.' }
  };

  // ───────────────────────────────────────────── Level-up pool ─────────────────────────────────────────────
  // Each level-up offers three random picks from this pool plus the class ability upgrade.
  D.upgrades = [
    { id: 'might',  name: '+1 Might', text: 'Permanent.' },
    { id: 'wit',    name: '+1 Wit', text: 'Permanent.' },
    { id: 'fate',   name: '+1 Fate', text: 'Permanent.' },
    { id: 'vit',    name: '+3 Max Vitality', text: 'And heal 3.' },
    { id: 'san',    name: '+3 Max Sanity', text: 'And restore 3.' },
    { id: 'steel_nerves', name: 'Steel Nerves', text: 'The first Sanity loss you take each round is reduced by 1.', skill: true },
    { id: 'second_wind', name: 'Second Wind', text: 'Resting restores 1 more.', skill: true },
    { id: 'cartographer', name: 'Cartographer\'s Eye', text: 'Hidden routes next to you are always visible to you.', skill: true },
    { id: 'lore_keeper', name: 'Lore-Keeper', text: '+1 to Investigate and an extra puzzle hint whenever you find a clue.', skill: true },
    { id: 'ghost_step', name: 'Ghost Step', text: 'Your Sprints are silent, always.', skill: true },
    { id: 'bargainer', name: 'Silver Tongue', text: 'Shops charge you 1 less (minimum 1). You earn 1 more Silver from finds.', skill: true },
    { id: 'duelist', name: 'Duelist\'s Poise', text: '+1 to Strike (Might) checks in confrontations.', skill: true },
    { id: 'ability', name: 'Deepen your gift', text: 'Upgrade your class ability.', ability: true }
  ];
  D.levels = [0, 5, 12, 21, 32, 46];      // XP needed for level 1..6
  D.xpValues = { firstVisit: 1, clue: 2, enemy: 3, boss: 8, objective: 5 };

  // ───────────────────────────────────────────── Enemies ─────────────────────────────────────────────
  // type: spirit | undead | beast | construct. Options use the same shape as location options; `hurt` wounds the enemy.
  // `weak` names the option id that gets +3 once the weakness is known (revealed by failing against it).
  D.enemies = {
    whisperling: {
      id: 'whisperling', name: 'Whisperling', type: 'spirit', hp: 2, behavior: 'hold', alert: 12,
      blurb: 'A mouthless child-shape that speaks in your own voice. It feeds on Sanity and plants false rumors on the map.',
      ambush: { san: -1, t: 'It says your name, in your mother\'s voice, from inside your own head.' },
      weak: 'ward',
      options: [
        { id: 'ward', label: 'Ward it with a hymn', stat: 'fate', dc: 12, spirit: true, stakes: 'Fail: it lodges a thought in you (Sanity).',
          ok: { t: 'The hymn finds its edges. The thing unspools into a string of half-words, then silence.', hurt: 2 },
          fail: { t: 'It repeats the hymn back, slightly wrong. The wrongness stays with you.', san: -1 } },
        { id: 'outwit', label: 'Ask it a question it cannot answer', stat: 'wit', dc: 13, stakes: 'Fail: it answers anyway, and lies.',
          ok: { t: 'You ask what it was called before. It has no answer and no more shape.', hurt: 2, xp: 1 },
          fail: { t: 'It answers. You believe the answer for a while.', san: -1, rumor: true } },
        { id: 'strike', label: 'Strike through it', stat: 'might', dc: 15, stakes: 'Fail: your blow passes through; it bites back.',
          ok: { t: 'Cold meat and smoke part around the blade. It flinches.', hurt: 1 },
          fail: { t: 'You swing at a voice. The voice laughs from your elbow.', san: -1, vit: -1 } },
        { id: 'salt', label: 'Throw a Salt Charm', req: { item: 'salt' }, cost: { item: 'salt' }, stakes: 'Certain. Uses the charm.',
          auto: { t: 'Salt hisses where it touches. The Whisperling sighs, almost grateful.', kill: true } },
        { id: 'shard', label: 'Show it the Mirror Shard', req: { item: 'mirror_shard' }, cost: { item: 'mirror_shard' }, stakes: 'Certain. Uses the shard.',
          auto: { t: 'It sees itself. It does not like what it sees, and ceases to see.', kill: true } }
      ],
      loot: { xp: 3, glory: 1, t: 'The air in the room loosens.' }
    },
    drowned_pilgrim: {
      id: 'drowned_pilgrim', name: 'Drowned Pilgrim', type: 'undead', hp: 3, behavior: 'follow', alert: 11,
      blurb: 'It walked to the Abbey in the old floods and never stopped. It follows the nearest living thing along any connected route.',
      ambush: { vit: -2, t: 'Water-heavy hands find your throat before you hear it.' },
      weak: 'pray',
      options: [
        { id: 'strike', label: 'Break its stride', stat: 'might', dc: 13, undead: true, stakes: 'Fail: it clasps you. Vitality loss.',
          ok: { t: 'Bone cracks under the swing. It keeps coming, but slower.', hurt: 1 },
          fail: { t: 'It takes the blow and clasps your arm. The grip is cold and total.', vit: -2 } },
        { id: 'pray', label: 'Speak the pilgrim\'s psalm', stat: 'fate', dc: 12, spirit: true, stakes: 'Fail: you remember drowning. Sanity loss.',
          ok: { t: 'It kneels. Water runs out of it in a long, thankful sigh.', hurt: 2 },
          fail: { t: 'You get the second verse wrong. It remembers the right one, loudly.', san: -1 } },
        { id: 'lure', label: 'Lure it into deep water', stat: 'wit', dc: 13, stakes: 'Fail: it cuts you off and you lose the lead.',
          ok: { t: 'It follows your lantern off the ledge. A long time later, a splash.', hurt: 2, kill: 'water' },
          fail: { t: 'It does not follow. It waits where you must go.', vit: -1, noise: 1 } },
        { id: 'blade', label: 'Draw the Grave-Iron Blade', req: { item: 'blade' }, stat: 'might', dc: 10, undead: true, stakes: 'Iron hurts the dead.',
          ok: { t: 'Grave-iron on drowned bone. It goes down like a collapsing net.', hurt: 3 },
          fail: { t: 'It catches the blade in its ribs and holds on.', vit: -2 } }
      ],
      loot: { xp: 3, glory: 1, silver: 2, t: 'It leaves behind a handful of waterlogged coins.' }
    },
    hollow_stag: {
      id: 'hollow_stag', name: 'Hollow Stag', type: 'beast', hp: 3, behavior: 'guard', alert: 14, noisy: true,
      blurb: 'An antlered thing with a lantern for a ribcage. It punishes noise: after a Sprint, a lit Lantern or a loud world, every approach is harder.',
      ambush: { vit: -2, t: 'The antlers come out of the dark like a thrown fence.' },
      weak: 'calm',
      options: [
        { id: 'calm', label: 'Stand still and let it smell you', stat: 'fate', dc: 12, spirit: true, stakes: 'Fail: it charges.',
          ok: { t: 'It breathes on your face, thinks about it, and walks away into the trees.', kill: true, xp: 2 },
          fail: { t: 'It decides you are loud. It lowers its head.', vit: -2 } },
        { id: 'strike', label: 'Meet the charge', stat: 'might', dc: 14, beast: true, stakes: 'Fail: gored.',
          ok: { t: 'You turn the antlers aside and drive in. It screams like a church door.', hurt: 1 },
          fail: { t: 'You are tossed like a sack of grain.', vit: -3 } },
        { id: 'slip', label: 'Slip beneath the antlers', stat: 'wit', dc: 13, stakes: 'Fail: you stumble and it hears.',
          ok: { t: 'You let it overrun you and find its blind side.', hurt: 1, xp: 1 },
          fail: { t: 'A twig breaks. The whole forest turns.', vit: -2, noise: 1 } },
        { id: 'snare', label: 'Spring a Snare', req: { item: 'snare' }, cost: { item: 'snare' }, stakes: 'Certain wound. Uses the snare.',
          auto: { t: 'The snare takes a leg and half the antlers. It lowers itself, offended.', hurt: 2 } }
      ],
      loot: { xp: 3, glory: 2, item: 'lamp_oil', t: 'Its ribs still burn. You scoop what you can into a flask.' }
    },
    grave_warden: {
      id: 'grave_warden', name: 'Grave Warden', type: 'construct', hp: 4, behavior: 'guard', alert: 15,
      blurb: 'A knight of tomb-iron, bound to protect whatever lies behind it. While it stands, the rewards here stay locked.',
      ambush: { vit: -2, t: 'It turns its head all the way around, and the rest of it follows.' },
      weak: 'rune',
      options: [
        { id: 'strike', label: 'Break it open', stat: 'might', dc: 15, stakes: 'Fail: the iron hits back.',
          ok: { t: 'A seam gives. A hush like a held breath comes out of it.', hurt: 1 },
          fail: { t: 'Your blow rings. Its answer breaks something.', vit: -3 } },
        { id: 'rune', label: 'Scratch out the binding rune', stat: 'wit', dc: 14, stakes: 'Fail: the rune flares.',
          ok: { t: 'You find the ward-line and cut it. The Warden sags by a third.', hurt: 2, xp: 1 },
          fail: { t: 'The rune flares and burns your fingers.', vit: -1, san: -1 } },
        { id: 'pay', label: 'Pay its toll (3 Silver)', cost: { silver: 3 }, stakes: 'Certain. It lets you take one thing.',
          auto: { t: 'It accepts, weighs, and stands aside. Not defeated, but paid.', kill: true, flag: 'warden_paid' } },
        { id: 'blade', label: 'Draw the Grave-Iron Blade', req: { item: 'blade' }, stat: 'might', dc: 12, undead: true, stakes: 'Iron cuts iron.',
          ok: { t: 'Grave-iron finds grave-iron. It begins to unmake itself.', hurt: 3 },
          fail: { t: 'You are repelled.', vit: -2 } }
      ],
      loot: { xp: 3, glory: 2, t: 'The knight folds in on itself, politely, like a closed book.' }
    },
    mirror_twin: {
      id: 'mirror_twin', name: 'Mirror Twin', type: 'spirit', hp: 3, behavior: 'copy', alert: 13,
      blurb: 'It wears your face and does what you did last. Repeat yourself and it counters: using the same approach twice in a row makes it +4 harder.',
      ambush: { san: -1, t: 'You wave. It waves a half-second before you do.' },
      weak: 'outwit',
      options: [
        { id: 'strike', label: 'Strike it', stat: 'might', dc: 13, stakes: 'Fail: it hits you back with your own technique.',
          ok: { t: 'Glass cracks across its chest, and across yours.', hurt: 1, vit: -1 },
          fail: { t: 'It dodges exactly as you would have.', vit: -2 } },
        { id: 'outwit', label: 'Do something you would never do', stat: 'wit', dc: 12, stakes: 'Fail: it does it better.',
          ok: { t: 'You sing. It can only mouth the words, and the lie shows.', hurt: 2, xp: 1 },
          fail: { t: 'It sings, and is better at it.', san: -1 } },
        { id: 'ward', label: 'Name it', stat: 'fate', dc: 13, spirit: true, stakes: 'Fail: it names you back.',
          ok: { t: 'You give it a name. It becomes a person with an address and no mirror.', hurt: 2 },
          fail: { t: 'It names you first. The name is not yours but it fits.', san: -2 } },
        { id: 'shard', label: 'Hold up the Mirror Shard', req: { item: 'mirror_shard' }, cost: { item: 'mirror_shard' }, stakes: 'Certain. Uses the shard.',
          auto: { t: 'Two mirrors face to face. There is a moment when it thinks it is the original. Then there is a lot of glass.', kill: true } }
      ],
      loot: { xp: 3, glory: 1, item: 'mirror_shard', t: 'It leaves a single bright splinter that shows no face.' }
    },
    bellkeeper: {
      id: 'bellkeeper', name: 'The Bellkeeper', type: 'construct', hp: 5, behavior: 'toll', alert: 99,
      blurb: 'Rope, rust and a sexton\'s cassock stitched around an empty frame. Every round it lives, it tolls: the Clock advances and a path closes.',
      ambush: { san: -2, t: 'The rope pulls itself taut around your wrist. Somewhere above, one stroke of the bell.' },
      weak: 'clapper',
      options: [
        { id: 'climb', label: 'Climb the frame and cut the rope', stat: 'might', dc: 15, stakes: 'Fail: fall from the frame.',
          ok: { t: 'The rope parts with a note like a snapped cello string. The Keeper sags.', hurt: 2 },
          fail: { t: 'You fall eight feet onto a floor that is not there anymore.', vit: -3 } },
        { id: 'jam', label: 'Jam the mechanism', stat: 'wit', dc: 13, stakes: 'Fail: the gears take a finger.',
          ok: { t: 'You wedge a timber in the wheel. The Keeper stills, mid-gesture, for two rounds.', hurt: 1, flag: 'bell_jammed' },
          fail: { t: 'The gears take a bite out of your hand.', vit: -2, bleed: true } },
        { id: 'name', label: 'Speak the bell\'s true cast-name', req: { clue: 'bell_cast' }, stat: 'fate', dc: 10, spirit: true, stakes: 'You know its history. Fail: Sanity.',
          ok: { t: 'You say who cast it and from whose graves. The Keeper bows its whole length.', hurt: 3, xp: 1 },
          fail: { t: 'The Keeper tolls over your voice, and keeps tolling inside it.', san: -2 } },
        { id: 'clapper', label: 'Offer the Broken Bell Clapper', req: { item: 'clapper' }, stakes: 'Certain. The clapper stays with you.',
          auto: { t: 'It leans down to look at the thing it lost. It does not take it back. It simply stops, as one who has been told the war is over.', kill: true, glory: 2 } }
      ],
      loot: { xp: 4, glory: 2, flag: 'bellkeeper_down', clue: 'bell_cast', t: 'The rope falls slack. For the first time in forty years, the tower is quiet.' }
    },
    carrion_swarm: {
      id: 'carrion_swarm', name: 'Carrion Swarm', type: 'beast', hp: 2, behavior: 'roam', alert: 10,
      blurb: 'Crows that have eaten too many names. They wander the Dying Village in a cloud and scatter from fire and light.',
      ambush: { vit: -1, t: 'Black wings, a hundred beaks. The cloud is gone before you finish bleeding.' },
      weak: 'torch',
      options: [
        { id: 'torch', label: 'Burn them off with lantern light', req: { equipped: 'lantern' }, stat: 'wit', dc: 8, stakes: 'Uses a lantern charge.',
          ok: { t: 'Light is the one thing they cannot eat. They go up in a ragged scream.', kill: true, useLantern: true },
          fail: { t: 'They go for the flame. And for you.', vit: -1, useLantern: true } },
        { id: 'strike', label: 'Swing at the cloud', stat: 'might', dc: 10, beast: true, stakes: 'Fail: pecked raw.',
          ok: { t: 'Feathers and sorrow. The cloud thins.', hurt: 1 },
          fail: { t: 'You hit nothing but dark air.', vit: -1 } },
        { id: 'hide', label: 'Go still under a cart', stat: 'wit', dc: 11, stakes: 'Fail: they find you.',
          ok: { t: 'The cloud flows over, loses interest, and drifts on.', kill: true },
          fail: { t: 'The cart is not as dark as you thought.', vit: -1 } }
      ],
      loot: { xp: 2, glory: 0, t: 'Black feathers drift down on the empty street.' }
    },
    hollow_hound: {
      id: 'hollow_hound', name: 'Hollow Hound', type: 'beast', hp: 3, behavior: 'stalk', alert: 13,
      blurb: 'A lean dog-shape stuffed with fog. In the later hours it hunts whoever is weakest. It strikes first.',
      ambush: { vit: -2, t: 'Teeth, and then the memory of teeth.' },
      weak: 'snare',
      options: [
        { id: 'strike', label: 'Fight it off', stat: 'might', dc: 13, beast: true, stakes: 'Fail: mauled.',
          ok: { t: 'A yelp that sounds like someone recognising you.', hurt: 1 },
          fail: { t: 'It has your leg and does not care for argument.', vit: -2, bleed: true } },
        { id: 'calm', label: 'Call it by its old name', stat: 'fate', dc: 14, spirit: true, stakes: 'Fail: the name is wrong.',
          ok: { t: 'It was someone\'s dog. It sits. It remembers sitting.', kill: true, xp: 1, glory: 1 },
          fail: { t: 'Wrong name. It takes it personally.', vit: -1, san: -1 } },
        { id: 'outwit', label: 'Lead it onto the bad ground', stat: 'wit', dc: 13, stakes: 'Fail: you run out of ground.',
          ok: { t: 'Its legs go through a rotten floor. You do not look down.', hurt: 2 },
          fail: { t: 'You are the one who runs out of room.', vit: -2 } },
        { id: 'snare', label: 'Spring a Snare', req: { item: 'snare' }, cost: { item: 'snare' }, stakes: 'Certain wound.',
          auto: { t: 'The snare takes it clean. It stops being a dog and becomes a stain.', hurt: 3 } }
      ],
      loot: { xp: 3, glory: 1, t: 'The fog slides out of it and goes looking for another.' }
    },
    weeping_statue: {
      id: 'weeping_statue', name: 'Weeping Statue', type: 'construct', hp: 3, behavior: 'weep', alert: 12,
      blurb: 'It moves only when unseen. A lone traveller is its only prey: it never advances toward a place where two or more people stand together.',
      ambush: { san: -2, t: 'You blinked. It is touching your face.' },
      weak: 'smash',
      options: [
        { id: 'smash', label: 'Shatter it at the knee', stat: 'might', dc: 15, stakes: 'Fail: the stone weeps on you.',
          ok: { t: 'Plaster and dust. Inside, a curled shape the size of a cat.', hurt: 2 },
          fail: { t: 'Cold tears hit your hands. They are not water.', san: -1, vit: -1 } },
        { id: 'stare', label: 'Hold its gaze until it stops', stat: 'wit', dc: 13, stakes: 'Fail: you blink.',
          ok: { t: 'Neither of you blinks for a long time. It gives first.', hurt: 1, xp: 1 },
          fail: { t: 'Your eyes water. You blink. It has moved.', san: -2 } },
        { id: 'blindfold', label: 'Blindfold it and walk away', stat: 'fate', dc: 12, stakes: 'Fail: it takes the cloth.',
          ok: { t: 'It stands in blind sorrow and you leave it behind.', kill: true },
          fail: { t: 'The cloth falls. It looks at you, grateful.', san: -1 } }
      ],
      loot: { xp: 3, glory: 1, t: 'A small, cold peace.' }
    }
  };

  // The Abbey Warden: a boss with chains, phases and alternative strategies. Resolved by the engine's boss logic.
  D.boss = {
    id: 'abbey_warden', name: 'The Abbey Warden', hp: 10, chains: 3,
    blurb: 'Bound to the Abbey by three chains and to the Hollow by an oath. He guards the stair to the crypts.',
    phases: [
      { chains: 3, name: 'Bound', attack: { vit: -2 }, text: 'Three chains hold him upright. He strikes slowly, with the weight of a collapsing roof.' },
      { chains: 2, name: 'Straining', attack: { vit: -2, san: -1 }, text: 'Two chains left. His voice begins to carry words. They are your name.' },
      { chains: 1, name: 'Unleashed', attack: { vit: -3, san: -1 }, text: 'One chain. The whole Abbey rings with his anger.' },
      { chains: 0, name: 'Free', attack: { vit: -3, san: -2 }, text: 'No chains. He is faster, but nothing protects him now.' }
    ]
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
