/* THE HOLLOW — world omens (drawn at the start of a round) and region events (drawn by "Explore the surroundings"). */
(function (g) {
  'use strict';
  var D = g.HollowData = g.HollowData || {};

  // ───────────────────────────────────────────── Omens ─────────────────────────────────────────────
  // fx keys: clock, noise, each:{outcome}, lonely:{outcome} (players alone), marked:{outcome}, spawn:{enemy, at}, closeEdge:'random',
  //          openEdge:'random', corruptRandom:'safe', rumor, hint:'bellName', revealRandom:n, reveal:[...], lanternDrain
  D.omens = [
    { id: 'crows', phases: [1], title: 'Crows Face Inward', text: 'Crows settle on every rooftop in the village, all facing the square. Not one of them blinks.', fx: { spawn: { enemy: 'carrion_swarm', at: 'region:village' } } },
    { id: 'far_toll', phases: [1, 2], title: 'A Far Toll', text: 'One stroke of the bell, far off. Dust shivers on every sill, and for a moment the toll has the shape of a word.', fx: { hint: 'bellName' } },
    { id: 'cold_patrol', phases: [1, 2], title: 'A Cold Patrol', text: 'A draught moves through the Hollow in a straight line, like a sentry on its rounds. Whoever is alone feels it pass.', fx: { lonely: { san: -1, t: 'The cold passes through you.' } } },
    { id: 'procession', phases: [1], title: 'Lights on the Ridge', text: 'A line of small lights on a far ridge. A procession, or a map. They move like people holding something precious.', fx: { revealRandom: 1 } },
    { id: 'iron_rain', phases: [1, 2], title: 'Iron Rain', text: 'It begins to rain, upward, smelling of iron. Old hurts ease in the cold.', fx: { each: { vit: 1, t: 'The rain eases an old wound.' } } },
    { id: 'wet_footprints', phases: [1], title: 'Wet Footprints', text: 'A trail of wet footprints crosses the Hollow and ends, politely, at the foot of a locked door.', fx: { openEdge: 'random' } },
    { id: 'toll_two', phases: [2], title: 'Two Tolls', text: 'Two strokes this time. Two names. The second sounds like it was a surprise to the bell.', fx: { clock: 1, marked: { san: -2, t: 'The second toll was yours.' } } },
    { id: 'sour_ground', phases: [2, 3], title: 'Sour Ground', text: 'The Abbey\'s cold spreads. Somewhere that was safe has begun to smell of wet stone.', fx: { corruptRandom: 'safe' } },
    { id: 'howl', phases: [2], title: 'The Howl', text: 'A howl, from a long way down. Another answers, from behind you. The Woods have stopped pretending to be asleep.', fx: { spawn: { enemy: 'hollow_hound', at: 'region:woods' } } },
    { id: 'mist', phases: [2, 3], title: 'Thickening Mist', text: 'White mist thickens along every road. Voices carry strangely; your own footsteps sound like someone catching up.', fx: { noise: 2 } },
    { id: 'abbey_lamp', phases: [2], title: 'A Lamp in the Abbey', text: 'A light in the Abbey\'s one unbricked window. Someone, or something, is awake and has been waiting for visitors.', fx: { reveal: ['loc:warden'] } },
    { id: 'routes_shift', phases: [2, 3], title: 'The Roads Shift', text: 'The Hollow rearranges itself in its sleep. One road is gone. Another has appeared, as if it had been there all along.', fx: { closeEdge: 'random', openEdge: 'random' } },
    { id: 'toll_thirteen', phases: [3], title: 'The Bell Tolls Loud', text: 'The bell rings so loud the ground ripples. Every living thing in the Hollow stops and turns toward the Heart.', fx: { each: { vit: -1, t: 'The sound goes through you.' }, clock: 1 } },
    { id: 'statue_stirs', phases: [3], title: 'Stone Stirs', text: 'Something very large, in the deep, stands up from where it was kneeling. The Weeping Stair begins to drip.', fx: { spawn: { enemy: 'weeping_statue', at: 'loc:stair' } } },
    { id: 'names_fall', phases: [3], title: 'Names Fall', text: 'Names rain from the ceiling like ash. Where they land, they stay.', fx: { each: { san: -1, t: 'Names fall on you like ash.' }, marked: { san: -2, t: 'Yours is among them.' } } },
    { id: 'walls_close', phases: [3], title: 'The Walls Close In', text: 'The walls of the Hollow lean in to listen. Doors you counted on are now merely wall.', fx: { closeEdge: 'random', corruptRandom: 'safe' } },
    { id: 'last_light', phases: [3], title: 'Last Light', text: 'Every lantern in the Hollow gutters, all at once. Some flames go out entirely.', fx: { lanternDrain: true } },
    { id: 'hound_pack', phases: [3], title: 'The Pack', text: 'The Hollow Hounds have your scent. Their breath arrives in the corridors first.', fx: { spawn: { enemy: 'hollow_hound', at: 'region:abbey' } } }
  ];

  // ───────────────────────────────────────────── Region events ─────────────────────────────────────────────
  // Explore the surroundings (1 AP) draws one unused event for the region. Each event is used once per expedition.
  D.regionEvents = [
    // Village
    { id: 'v_market', region: 'village', title: 'The Phantom Market', text: 'A market flickers into being around you: stalls of fruit the colour of your memories, a till that rings by itself.',
      options: [
        { id: 'buy', label: 'Buy a memory-fruit (1 Silver)', cost: { silver: 1 }, stakes: 'Costs 1 Silver.', auto: { t: 'It tastes of a summer you almost had. You feel mended.', san: 2, vit: 1 } },
        { id: 'haggle', label: 'Haggle with a stallholder', stat: 'wit', dc: 11, stakes: 'Fail: they take a memory in payment.', ok: { t: 'The stallholder has no idea what anything costs, only what it is owed. You leave with silver and a cheerful lie.', silver: 3, xp: 1 }, fail: { t: 'They take a memory in payment. You remember saying it was fine.', san: -1 } },
        { id: 'leave', label: 'Walk through it', stakes: 'Free.', auto: { t: 'You walk through stalls like fog. Everything is as it was before.' } }] },
    { id: 'v_door', region: 'village', title: 'The Crying Door', text: 'A door stands in the street, hinged to nothing. Someone on the other side is crying quietly, as if trying not to be heard.',
      options: [
        { id: 'open', label: 'Open it', stat: 'fate', dc: 11, spirit: true, stakes: 'Fail: they do not stop crying, and they are now in your head.', ok: { t: 'A woman sits on a stairwell, a letter in her lap. She gives it to you without looking up. Inside: a cure for two ailments, and a request.', item: 'tonic', clue: 'ledger', xp: 1 }, fail: { t: 'The crying doesn\'t stop. It follows you out, in your own voice.', san: -1 } },
        { id: 'knock', label: 'Knock back, gently', stat: 'wit', dc: 10, stakes: 'Fail: it knocks harder.', ok: { t: 'The crying stops. Someone whispers thanks, and tells you where they hid something.', silver: 2, xp: 1 }, fail: { t: 'The crying grows louder, then angry.', san: -1 } },
        { id: 'coin', label: 'Slip a coin under the door', cost: { silver: 1 }, stakes: 'Costs 1 Silver.', auto: { t: 'A small hand takes it. The crying lightens.', status: 'blessed' } }] },
    { id: 'v_dog', region: 'village', title: 'The Thin Dog', text: 'A thin dog has been following you. It keeps a respectful distance and its shadow has a human hand.',
      options: [
        { id: 'feed', label: 'Share your rations', stakes: 'Free.', auto: { t: 'It eats like it has never eaten. It looks at you as if it recognises someone, and leads you three steps to a loose stone.', silver: 2, san: 1, xp: 1 } },
        { id: 'follow', label: 'Follow where it leads', stat: 'wit', dc: 10, stakes: 'Fail: it leads you astray.', ok: { t: 'It leads you to a cache: a Silver Thread, a flask, a dead man\'s joke.', item: 'thread', xp: 1 }, fail: { t: 'It leads you in circles, and the circles close.', vit: -1 } },
        { id: 'chase', label: 'Chase it off', stat: 'might', dc: 8, stakes: 'Fail: it bites.', ok: { t: 'It scampers into a doorway and is gone. The air feels slightly less watched.', xp: 0 }, fail: { t: 'It bites. Its teeth are very ordinary, and that is worse.', vit: -1 } }] },

    // Estate
    { id: 'e_dinner', region: 'estate', title: 'A Table for Twelve', text: 'A banquet table, steaming, laid for twelve. Eleven chairs are drawn out. Eleven plates are empty. Someone has been very particular about the twelfth.',
      options: [
        { id: 'eat', label: 'Take the twelfth seat and eat', stakes: 'Free. Heals the body, taxes the mind.', auto: { t: 'The meal is wonderful. The eleven empty plates all clean themselves at once.', vit: 3, san: -2 } },
        { id: 'search', label: 'Search under the table', stat: 'wit', dc: 11, stakes: 'Fail: the tablecloth takes an interest.', ok: { t: 'Taped under the table: a purse the host forgot to hide.', silver: 3, xp: 1 }, fail: { t: 'The cloth catches your wrist.', vit: -1 } },
        { id: 'toast', label: 'Toast the empty chairs', stat: 'fate', dc: 11, spirit: true, stakes: 'Fail: they toast you back.', ok: { t: 'Eleven glasses rise. The air tastes of cut wood and being forgiven.', status: 'blessed', san: 1 }, fail: { t: 'Eleven glasses rise. A twelfth appears in your hand.', san: -1 } }] },
    { id: 'e_portrait', region: 'estate', title: 'The Portrait of You', text: 'A portrait hangs here. It is you, in clothes you do not own, painted by someone who has been watching for a long time.',
      options: [
        { id: 'study', label: 'Study the portrait', stat: 'wit', dc: 12, stakes: 'Fail: it studies you.', ok: { t: 'In the painted background: a bell, a clerk, a ledger, and your name in a column of others. You commit the column to memory.', clue: 'mirror_truth', xp: 1 }, fail: { t: 'You see what the painter saw. It stays.', san: -1 } },
        { id: 'speak', label: 'Speak to it', stat: 'fate', dc: 12, spirit: true, stakes: 'Fail: it answers.', ok: { t: 'It answers: not words, but a choice of two corridors. One is longer. You take the other.', reveal: ['edge:chapel|library'], xp: 1 }, fail: { t: 'It answers. You wish it hadn\'t.', san: -2 } },
        { id: 'cover', label: 'Cover it with your coat', stakes: 'Free.', auto: { t: 'You cover the portrait. It keeps watching, through the cloth.', san: 1 } }] },
    { id: 'e_dumbwaiter', region: 'estate', title: 'The Dumbwaiter', text: 'A dumbwaiter comes up the shaft with a folded note on a silver tray. It stops in front of you.',
      options: [
        { id: 'read', label: 'Read the note', stat: 'wit', dc: 9, stakes: 'Low risk.', ok: { t: 'It lists, in a neat hand, which shelf is wrong, which reflection lies, and which star the astronomer feared.', hint: 'shelf', hint2: 'mirror', xp: 1 }, fail: { t: 'The note is addressed to you, and so is the next.', san: -1 } },
        { id: 'tray', label: 'Take the tray', stakes: 'Free.', auto: { t: 'Real silver, solid and cold.', silver: 2 } },
        { id: 'reply', label: 'Send a reply down the shaft', stat: 'wit', dc: 11, stakes: 'Fail: they write back.', ok: { t: 'A moment later the shaft sends up a tonic and an apology.', item: 'tonic' }, fail: { t: 'The dumbwaiter returns with your own handwriting.', san: -1 } }] },

    // Woods
    { id: 'w_lanterns', region: 'woods', title: 'The Lantern Tree', text: 'An old oak hung with small lanterns, each marked with a name on a tag. They all burn, though none has a wick.',
      options: [
        { id: 'read', label: 'Read the name-tags', stat: 'wit', dc: 10, stakes: 'Low risk.', ok: { t: 'The lanterns are in the order of the vote. One at the very end has no tag at all, and is yours, if you want it.', hint: 'heartName', xp: 1 }, fail: { t: 'You read a tag. It reads you.', san: -1 } },
        { id: 'take', label: 'Take a lantern', stakes: 'Free. The light goes out in your hand.', auto: { t: 'The light dies. The name does not. You carry it a while and put it back.', san: -1, item: 'lamp_oil' } },
        { id: 'cut', label: 'Cut one down', stat: 'might', dc: 9, stakes: 'Fail: the tree objects.', ok: { t: 'The lantern comes free with a sob. A flask of bright oil is inside.', item: 'lamp_oil', xp: 1 }, fail: { t: 'The tree drops a branch. It does not drop it kindly.', vit: -2 } }] },
    { id: 'w_cairn', region: 'woods', title: 'The Snare Cairn', text: 'At a crossing, a cairn of snares and iron traps, stacked with care by someone who did not intend to come back.',
      options: [
        { id: 'search', label: 'Search the cairn', stat: 'wit', dc: 10, stakes: 'Fail: a spring snaps.', ok: { t: 'Under the traps, two clean snares and an iron whistle.', item: ['snare', 'snare'], xp: 1 }, fail: { t: 'A snare snaps shut on your sleeve.', vit: -1 } },
        { id: 'stone', label: 'Add a stone', stakes: 'Free.', auto: { t: 'You add a stone, as a custom. The wind lifts slightly.', status: 'blessed' } },
        { id: 'dismantle', label: 'Dismantle it for scrap', stat: 'might', dc: 8, stakes: 'Fail: it falls on you.', ok: { t: 'Six traps, a little silver, no regrets.', silver: 3 }, fail: { t: 'The stack comes down in a long iron sigh.', vit: -2 } }] },
    { id: 'w_wolves', region: 'woods', title: 'The Wolf-Song', text: 'Wolves sing something that is almost your name. It takes them three notes to get to your first name and four to your last.',
      options: [
        { id: 'sing', label: 'Sing back', stat: 'fate', dc: 12, spirit: true, stakes: 'Fail: they sing it louder.', ok: { t: 'The chorus breaks and re-forms around you. They are not hunting. They are keeping watch, and they know the way back.', status: 'blessed', san: 1 }, fail: { t: 'They sing it louder. Every one of them is out of tune.', san: -1, noise: 1 } },
        { id: 'hide', label: 'Hide in a hollow log', stat: 'wit', dc: 10, stakes: 'Fail: the log is occupied.', ok: { t: 'The song passes overhead. You hold your breath through all of it.', xp: 1 }, fail: { t: 'The log is not empty.', vit: -1 } },
        { id: 'stone', label: 'Throw a stone', stat: 'might', dc: 8, stakes: 'Fail: it draws a hound.', ok: { t: 'The song cuts off. A long silence follows, impressed.', xp: 0 }, fail: { t: 'The song changes key. Something with teeth comes to look.', spawn: 'hollow_hound' } }] },

    // Abbey
    { id: 'a_choirboy', region: 'abbey', title: 'The Choirboy', text: 'A choirboy\'s ghost offers you a hymnal. The cover is blank and warm, like something recently held.',
      options: [
        { id: 'take', label: 'Take the hymnal', stat: 'fate', dc: 11, spirit: true, stakes: 'Fail: he sings.', ok: { t: 'Inside, one hymn has been underlined by a small hand, a hymn with a tune that is the bell\'s name.', hint: 'bellName', hint2: 'bellName', xp: 1 }, fail: { t: 'He sings, thin and sweet. By the second verse you have lost your place in your own mind.', san: -2 } },
        { id: 'name', label: 'Ask for his name', stat: 'wit', dc: 12, stakes: 'Fail: he forgets it.', ok: { t: '"Callum," he says, then "the register says Callum," then, quieter, "did they ever write down who I was?"', clue: 'abbey_record', xp: 1 }, fail: { t: 'He forgets, mid-word. You hear him forgetting.', san: -1 } },
        { id: 'decline', label: 'Decline kindly', stakes: 'Free.', auto: { t: 'He nods, and sings a hymn for you anyway.', san: 1 } }] },
    { id: 'a_roof', region: 'abbey', title: 'Rain Through the Roof', text: 'Rain falls up through a hole in the vault, in a clean silver column. It smells of the first rain of the year.',
      options: [
        { id: 'stand', label: 'Stand in the rain', stakes: 'Free. Cleanses a curse or a status.', auto: { t: 'The rain moves through you like cold fingers through hair, taking things with it.', status: '-cursed', san: 1 } },
        { id: 'vial', label: 'Catch it in a vial', stat: 'wit', dc: 10, stakes: 'Fail: it spills.', ok: { t: 'A clean, ordinary tonic, brewed by weather.', item: 'tonic', xp: 1 }, fail: { t: 'The vial overflows and cuts your palm.', vit: -1 } },
        { id: 'look', label: 'Look up where it comes from', stat: 'fate', dc: 11, stakes: 'Fail: something looks back.', ok: { t: 'Above the vault, a window that shows the Hollow\'s roof. A bell hangs in it, and someone is pulling.', clue: 'bell_cast', xp: 1 }, fail: { t: 'Something above looks back, and keeps looking after you stop.', san: -1 } }] },
    { id: 'a_confessional', region: 'abbey', title: 'The Confessional', text: 'A confessional with the little light on. Inside, a priest\'s sleeve rests on the sill, ready to listen, stuffed with straw.',
      options: [
        { id: 'confess', label: 'Confess something small', stakes: 'Free. Costs a little Sanity, buys a little time.', auto: { t: 'You confess to something minor, a lie, a missed funeral. The sleeve nods. You feel lighter, and the Haunting loosens.', san: -1, clock: -1, xp: 1 } },
        { id: 'listen', label: 'Listen at the grille', stat: 'fate', dc: 12, spirit: true, stakes: 'Fail: the sleeve moves.', ok: { t: 'Someone is on the other side confessing. They sign off with: "I did not bargain for them. I bargained them."', clue: 'venn_confession', xp: 1 }, fail: { t: 'The sleeve moves, and a straw-dry hand pats yours.', san: -2 } },
        { id: 'break', label: 'Break the grille', stat: 'might', dc: 9, stakes: 'Fail: splinters.', ok: { t: 'Behind the grille: silver, a candle and a flask of oil that someone had been saving.', silver: 2, item: 'candle' }, fail: { t: 'Splinters, and an oath.', vit: -1 } }] },

    // Crypt
    { id: 'c_candles', region: 'crypt', title: 'Floating Candles', text: 'Candles float on the black water, drifting your way in a loose, polite column. Each flame is a different colour.',
      options: [
        { id: 'follow', label: 'Follow them', stat: 'wit', dc: 11, stakes: 'Fail: the water is deep.', ok: { t: 'The candles lead to a dry ledge with a note and a cache. They have done this before for others.', item: 'candle', silver: 2, xp: 1 }, fail: { t: 'The candles are where the water is deepest.', vit: -2 } },
        { id: 'blow', label: 'Blow them out', stat: 'fate', dc: 10, stakes: 'Fail: they remember.', ok: { t: 'The flames go out in a long breath. The water is only water.', san: 1 }, fail: { t: 'The flames come back, angrier.', san: -1 } },
        { id: 'collect', label: 'Gather them up', stat: 'might', dc: 9, stakes: 'Fail: they scald.', ok: { t: 'They burn clean in your hands. You pocket the wax.', item: ['candle', 'candle'], vit: -1 }, fail: { t: 'They scald as you reach.', vit: -2 } }] },
    { id: 'c_bride', region: 'crypt', title: 'The Drowned Bride', text: 'A drowned bride sits in a pew, patient as furniture, her veil full of water. She looks up very slowly.',
      options: [
        { id: 'sit', label: 'Sit beside her', stat: 'fate', dc: 12, spirit: true, stakes: 'Fail: she holds your hand.', ok: { t: 'She tells you in a voice of water: the groom sold her name for a bell. She asks only that you remember it kindly. You promise.', hint: 'bellName', clue: 'diary', xp: 2 }, fail: { t: 'She takes your hand, and does not let it go for a long time.', san: -2 } },
        { id: 'ring', label: 'Take her ring', stat: 'wit', dc: 12, stakes: 'Fail: she remembers.', ok: { t: 'It comes off with a sigh. Good silver, and a little guilt.', silver: 4, san: -1 }, fail: { t: 'The ring does not want to leave. Neither does she.', status: 'cursed' } },
        { id: 'leave', label: 'Leave her in peace', stakes: 'Free.', auto: { t: 'You leave her to her wait. Behind you, the pew creaks, as if someone had stood up.', san: 1 } }] },
    { id: 'c_rats', region: 'crypt', title: 'The Rat Procession', text: 'Rats march past in a column, carrying between them a tiny bell on a tiny litter. They do not look at you. They are in mourning.',
      options: [
        { id: 'follow', label: 'Follow them', stat: 'wit', dc: 11, stakes: 'Fail: you lose them, and your footing.', ok: { t: 'They bury the bell in a hole in the wall. In the hole: a pouch of grave-silver, and a note in tiny letters.', silver: 3, hint: 'sigil', xp: 1 }, fail: { t: 'You trip over a very small pew.', vit: -1 } },
        { id: 'bell', label: 'Take the little bell', stat: 'might', dc: 8, stakes: 'Fail: the rats turn.', ok: { t: 'It rings in your pocket in a very small voice.', item: 'lamp_oil' }, fail: { t: 'The rats turn all at once. Their eyes are a little too human.', vit: -1, san: -1 } },
        { id: 'pass', label: 'Let them pass', stakes: 'Free.', auto: { t: 'You stand aside. One of them nods.', status: 'blessed' } }] },

    // Heart
    { id: 'h_dark', region: 'heart', title: 'The Listening Dark', text: 'The dark here is not empty; it is listening. When you stop breathing, it keeps breathing for you.',
      options: [
        { id: 'speak', label: 'Speak into the dark', stat: 'fate', dc: 12, spirit: true, stakes: 'Fail: it takes down what you say.', ok: { t: 'Your voice comes back from three sides, and in the echo is a word that does not belong to you. You catch it.', hint: 'bellName', hint2: 'heartName', xp: 1 }, fail: { t: 'It takes down everything you said, and recites it back later, in your voice.', san: -2 } },
        { id: 'silent', label: 'Stay silent and still', stat: 'wit', dc: 10, stakes: 'Fail: you cannot.', ok: { t: 'Three long minutes. The dark finds nothing to write down, and withdraws, almost apologetic.', san: 1, xp: 1 }, fail: { t: 'Your stomach rumbles. The dark writes that down too.', san: -1 } },
        { id: 'light', label: 'Strike a light', req: { item: 'lantern' }, stakes: 'Free. Uses a lantern charge.', auto: { t: 'The dark flinches, and you see the shape of its listening: a crowd, standing perfectly still.', useLantern: true, reveal: ['loc:hall_of_names', 'loc:forge'], xp: 1 } }] },
    { id: 'h_clerks', region: 'heart', title: 'The Clerks', text: 'A queue of translucent clerks crosses the cavern floor with ledgers, in single file, not looking at you. Their pens scratch.',
      options: [
        { id: 'read', label: 'Read over a clerk\'s shoulder', stat: 'wit', dc: 12, stakes: 'Fail: they write your name.', ok: { t: 'A column of names, in a hundred hands. The last is marked "pending" and ends in a bell.', hint: 'heartName', clue: 'memory_hunger', xp: 1 }, fail: { t: 'The clerk turns and writes your name, in the margin.', status: 'marked' } },
        { id: 'block', label: 'Block one\'s path', stat: 'might', dc: 11, stakes: 'Fail: they walk through you.', ok: { t: 'The clerk stops, bows, and lets you search the satchel it carries.', item: 'candle', silver: 2 }, fail: { t: 'They walk through you, one by one, and each takes a small bite.', vit: -1, san: -1 } },
        { id: 'offer', label: 'Offer a forgotten name', cost: { san: 1 }, stakes: 'Costs 1 Sanity.', auto: { t: 'You offer the name of a school friend you have not thought of in years. The clerk is deeply moved, and writes it neatly.', hint: 'bellName', xp: 1 }, },] },
    { id: 'h_candle', region: 'heart', title: 'The Last Candle', text: 'A single lit candle sits on the floor in a bowl of water. It has been burning for forty years, and no one has noticed it going out.',
      options: [
        { id: 'take', label: 'Take the candle', stat: 'fate', dc: 10, stakes: 'Fail: the dark gets closer.', ok: { t: 'The flame bows to you and stays lit as you pocket it.', item: 'candle', san: 1 }, fail: { t: 'The flame gutters. The dark remembers where you were.', san: -1 } },
        { id: 'drink', label: 'Drink the water', stat: 'wit', dc: 11, stakes: 'Fail: you swallow ash.', ok: { t: 'Cold, clean, true. It tastes of the first morning.', vit: 2, san: 2 }, fail: { t: 'Ash, in the throat. The candle burns a little brighter.', vit: -1 } },
        { id: 'snuff', label: 'Snuff it out', stakes: 'Free. The dark will notice.', auto: { t: 'The candle goes out. For a moment the whole Hollow holds its breath. Then the bell, a very long way down, tolls once, relieved.', clock: -2, san: -1, glory: 1 } }] }
  ];
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
