/* THE HOLLOW — The Sunken Crypt (7 places) and the Heart of the Hollow (6 places). */
(function (g) {
  'use strict';
  var D = g.HollowData = g.HollowData || {};
  D.locations = D.locations || {};
  var L = D.locations;

  // ───────────────────────────────────────────── The Sunken Crypt ─────────────────────────────────────────────
  L.sealed_crypt = {
    id: 'sealed_crypt', name: 'Sealed Crypt', region: 'crypt', kind: 'puzzle', x: 940, y: 440, glyph: 'crypt', scene: ['night', 'crypt', 'water', 'candles'], occult: true,
    desc: 'The stair from the Warden ends at three stone faces, each carved with a different sigil. Black water laps at the lowest step. A fourth door waits behind them.',
    options: [
      { id: 'sigil', label: 'Press the correct sigil', puzzle: { key: 'sigil', title: 'Which sigil opens the inner vault?' }, once: 'party', stakes: 'No roll. A wrong sigil is ruled out, and the crypt wakes a little.',
        ok: { t: 'The face sinks into the stone with a sound like a swallowed word. The inner vault opens, and in it, on a bed of black salt, a pale crescent.', item: 'moonrelic', xp: 3, glory: 2 },
        fail: { t: 'The wrong sigil weeps. Somewhere in the water below, a pilgrim begins to walk.', vit: -2, clock: 1, spawnAt: ['drowned_pilgrim', 'ossuary'] } },
      { id: 'epitaphs', label: 'Read the epitaphs', stat: 'wit', dc: 10, once: 'party', stakes: 'Low risk.',
        ok: { t: 'Epitaphs in a small hand, each a single line. Nothing about piety; every one is about being counted.', hint: 'sigil', clue: 'ossuary_names', xp: 1 },
        fail: { t: 'The epitaphs read themselves aloud in the voices of the dead.', san: -1 } },
      { id: 'force', label: 'Force the inner vault', stat: 'might', dc: 15, once: 'party', stakes: 'Hard. Fail: the vault answers with a rockfall.',
        ok: { t: 'The vault door grinds and folds. You do not ask what was holding it shut.', item: 'moonrelic', xp: 2, vit: -1 },
        fail: { t: 'The vault door does not move. The ceiling does.', vit: -3 } }
    ]
  };

  L.ossuary = {
    id: 'ossuary', name: 'Ossuary Choir', region: 'crypt', kind: 'sound', x: 1060, y: 505, glyph: 'skull', scene: ['night', 'bones', 'arches', 'fog'], occult: true,
    desc: 'Skulls on shelves, in rows by size. Each skull faces the middle, mouth open. Not singing yet; they are drawing breath.',
    options: [
      { id: 'listen', label: 'Listen to the song', stat: 'fate', dc: 11, spirit: true, once: 'party', retry: 1, stakes: 'Fail: it gets in your head.',
        ok: { t: 'A hundred skulls hum a roll-call in order of the vote. The last name hummed is Father Venn\'s own.', clue: 'ossuary_names', xp: 2 },
        fail: { t: 'The tune lodges behind your eyes. It will take days to get out.', san: -2 } },
      { id: 'conduct', label: 'Conduct the choir', stat: 'wit', dc: 13, once: 'party', stakes: 'Fail: they take the baton.',
        ok: { t: 'You raise a hand. The choir sings the bell\'s true name in eleven harmonies, and you catch two of them.', hint: 'bellName', hint2: 'bellName', xp: 2 },
        fail: { t: 'The choir ignores you and sings louder. Bones fall from the shelves like applause.', vit: -2, noise: 1 } },
      { id: 'salt', label: 'Salt the shelves and sit awhile', req: { item: 'salt' }, cost: { item: 'salt' }, once: 'party', stakes: 'Uses a Salt Charm. A moment of rest.',
        auto: { t: 'The skulls settle into a polite silence. You count slowly to a hundred, and your hands stop shaking.', san: 3, clock: -1 } }
    ]
  };

  L.sunken_archive = {
    id: 'sunken_archive', name: 'Sunken Archive', region: 'crypt', kind: 'research', x: 1005, y: 610, glyph: 'archive', scene: ['night', 'water', 'books', 'columns'], occult: true,
    desc: 'The abbey\'s records, drowned to the shelf-lip. The ink has gone up into the water and hangs there in curtains. Names are suspended at eye height.',
    options: [
      { id: 'ledger', label: 'Read the waterlogged ledger', stat: 'wit', dc: 11, once: 'party', retry: 1, stakes: 'Fail: the ink gets in your eyes.',
        ok: { t: 'A ledger kept dry in a bell-jar: "Ring it backward under the stars of its birth and every name it holds is spoken out and unmade. It needs the clapper."', clue: 'reverse_rite', xp: 2 },
        fail: { t: 'Ink in your eyes, ink in your throat. For a moment you remember someone else\'s life.', san: -1 } },
      { id: 'dive', label: 'Dive for the drowned shelves', stat: 'might', dc: 13, once: 'party', stakes: 'Fail: the cold takes breath.',
        ok: { t: 'Three shelves down, a waterproof case: the Remembrancer\'s own name, written by a man who was afraid of it.', clue: 'entity_name', xp: 2 },
        fail: { t: 'The cold clamps your lungs. You come up with nothing, and less.', vit: -2 } },
      { id: 'desk', label: 'Search the drowned desk', hidden: true, show: { secret: ['keyLoc', 'sunken_archive'] }, stat: 'wit', dc: 12, once: 'party', stakes: 'Fail: a stuck drawer.',
        ok: { t: 'In the bottom drawer, in a waxed sleeve, an iron key and a bell-shaped hole in the wood.', item: 'spirit_key', xp: 2, glory: 1 },
        fail: { t: 'The drawer slams shut. A finger does not make it out.', vit: -2 } }
    ]
  };

  L.flooded_hall = {
    id: 'flooded_hall', name: 'Flooded Hall', region: 'crypt', kind: 'water', x: 915, y: 705, glyph: 'wave', scene: ['night', 'water', 'arches', 'pews'], water: true, enemy: 'drowned_pilgrim',
    desc: 'The crypt\'s oldest nave, black water to the waist. At the far end, a stone font in which the water, alone in this hall, runs.',
    options: [
      { id: 'font', label: 'Dive for the sunken font', stat: 'might', dc: 13, once: 'party', retry: 1, stakes: 'Fail: the current takes your lantern.',
        ok: { t: 'In the running font, under a century of silt: a bell\'s clapper of grave-iron, heavy as a small child, cold as a rule.', item: 'clapper', clue: 'clapper_lore', xp: 3, glory: 2 },
        fail: { t: 'The current drags at you, and takes one of your lantern\'s charges on the way.', vit: -2, useLantern: true } },
      { id: 'coax', label: 'Coax the current to give it up', stat: 'fate', dc: 13, spirit: true, once: 'party', retry: 1, stakes: 'Fail: it takes a memory instead.',
        ok: { t: 'The water runs backward for the length of a held breath. The clapper rolls up the stone to your feet like a patient dog.', item: 'clapper', clue: 'clapper_lore', xp: 3, glory: 2 },
        fail: { t: 'The current takes something from your head, and does not tell you what.', san: -2 } },
      { id: 'pews', label: 'Search the drowned pews', stat: 'wit', dc: 12, once: 'party', stakes: 'Fail: the cold.',
        ok: { t: 'Under the water, where the hymnals are, a pouch of waterproofed silver coins and a tonic still sealed.', silver: 4, item: 'tonic', xp: 1 },
        fail: { t: 'The cold is a hand, and it does not let go quickly.', vit: -2 } }
    ]
  };

  L.tomb = {
    id: 'tomb', name: 'Father Venn\'s Tomb', region: 'crypt', kind: 'story', x: 1100, y: 710, glyph: 'tomb', scene: ['night', 'tomb', 'candles', 'chains'], occult: true,
    desc: 'A clean white sarcophagus, the only clean thing in the Hollow. On the lid, the carved figure of a priest, hands folded over a bell-rope.',
    options: [
      { id: 'epitaph', label: 'Read the epitaph', stat: 'wit', dc: 9, once: 'party', stakes: 'Low risk.',
        ok: { t: '"Here lies Aldous Venn, who did what a quorum asked." Under it, scratched from the inside: "I was only the clerk."', clue: 'venn_confession', xp: 1 },
        fail: { t: 'You read it twice. The second time it is not what it said the first.', san: -1 } },
      { id: 'open', label: 'Open the sarcophagus', stat: 'might', dc: 14, once: 'party', stakes: 'Hard. Fail: the lid objects.',
        ok: { t: 'There is no body, only a confession written inside the lid: "I did not bargain for them. I bargained them. Oh, but I signed so beautifully."', clue: 'venn_confession', item: 'tonic', xp: 2, glory: 1 },
        fail: { t: 'The lid drops on your hand. Something inside sighs with disappointment.', vit: -3 } },
      { id: 'wake', label: 'Wake Venn\'s ghost', stat: 'fate', dc: 14, spirit: true, once: 'party', stakes: 'Very hard. Fail: Venn\'s rage.',
        ok: { t: 'Venn rises as a long grey stretch of apology. He gives you the bell\'s name in three pieces and asks only that you say it right.', hint: 'bellName', hint2: 'bellName', hint3: 'bellName', clue: 'venn_confession', xp: 3, glory: 2 },
        fail: { t: 'Venn rises, and he is not sorry yet. The room agrees with him.', vit: -3, san: -1, spawn: 'mirror_twin' } }
    ]
  };

  L.hidden_passage = {
    id: 'hidden_passage', name: 'Hidden Passage', region: 'crypt', kind: 'secret', x: 1130, y: 590, glyph: 'tunnel', scene: ['night', 'tunnel', 'fog'],
    desc: 'A crawlspace behind the tomb wall, deep and straight. You can feel the Heart pulling at you like a tide.',
    trap: { stat: 'wit', dc: 12, vit: -2, t: 'The tunnel ceiling was never rated for running. A slab of the old roof comes down across your shoulders.' },
    options: [
      { id: 'carvings', label: 'Study the carvings', stat: 'wit', dc: 10, once: 'party', stakes: 'Low risk.',
        ok: { t: 'Names, each cut a little deeper than the one before it, and the last cut right through the stone. The Remembrancer eats the forgotten to stay whole.', clue: 'memory_hunger', xp: 1 },
        fail: { t: 'You cut your hand on a name. You are almost sure it was already wet.', vit: -1 } },
      { id: 'chalk', label: 'Mark the way with chalk', req: { item: 'chalk' }, cost: { item: 'chalk' }, once: 'party', stakes: 'Uses Ward Chalk. Makes the passage safe to Sprint.',
        auto: { t: 'You chalk a bright, plain line along the wall. The tunnel seems relieved to be told where it is.', flag: 'passage_marked', xp: 1 } },
      { id: 'whisper', label: 'Whisper to the walls', stat: 'fate', dc: 12, once: 'player', stakes: 'Fail: the walls whisper back.',
        ok: { t: 'The walls answer in the voice of the last person who came through. They tell you a name, and the way it ends.', hint: 'heartName', xp: 1 },
        fail: { t: 'The walls tell you how it ended for the last person who came through.', san: -2 } }
    ]
  };

  L.nameless_door = {
    id: 'nameless_door', name: 'The Nameless Door', region: 'crypt', kind: 'door', x: 1020, y: 760, glyph: 'keyhole', scene: ['night', 'door', 'fog', 'chains'], occult: true,
    desc: 'A door with no handle and no hinge, set in the crypt wall, with a keyhole shaped like a bell. Below the keyhole, in worn letters: SPEAK IT.',
    options: [
      { id: 'speak', label: 'Speak the bell\'s name', puzzle: { key: 'bellName', title: 'What is the bell\'s true name?' }, once: 'party', stakes: 'No roll. A wrong name is ruled out and costs you Sanity.',
        ok: { t: 'The name comes out of you like a coin out of a throat. The door sighs, as if a thing it has held in forty years is let go, and it is open.', flag: 'bell_named', open: ['nameless_door|stair'], xp: 3, glory: 3 },
        fail: { t: 'It is not the name. The door takes the wrong one and keeps it, and a little of you.', san: -2, clock: 1 } },
      { id: 'key', label: 'Turn the Warden\'s Key in the lock', req: { item: 'wardens_key' }, once: 'party', stakes: 'Certain.',
        auto: { t: 'The key was cast for this keyhole. The door opens without comment, as to an old colleague.', open: ['nameless_door|stair'], xp: 2 } },
      { id: 'skeleton', label: 'Turn the Spirit Key in the lock', req: { item: 'spirit_key' }, once: 'party', stakes: 'Certain. Costs 1 Sanity.',
        auto: { t: 'The Spirit Key finds the keyhole as if it had always been there.', san: -1, open: ['nameless_door|stair'], xp: 2 } }
    ]
  };

  // ───────────────────────────────────────────── The Heart of the Hollow ─────────────────────────────────────────────
  L.stair = {
    id: 'stair', name: 'The Weeping Stair', region: 'heart', kind: 'hub', x: 955, y: 335, glyph: 'stairs', scene: ['blood', 'stairs', 'fog', 'eyes'], occult: true,
    desc: 'A stair wide enough for a village, descending. Every step is wet, and every step has a name cut into it. You are walking on people.',
    options: [
      { id: 'read', label: 'Read the steps', stat: 'wit', dc: 10, once: 'player', stakes: 'Fail: your own name appears.',
        ok: { t: 'The steps run in order of the vote, top to bottom. The name at the bottom of the stair has been rubbed smooth by a hundred hands.', hint: 'heartName', xp: 1 },
        fail: { t: 'Your name is on the step you are standing on. It has been there for some time.', san: -2 } },
      { id: 'touch', label: 'Touch the wet stone', stat: 'fate', dc: 12, spirit: true, once: 'party', stakes: 'Fail: it touches back.',
        ok: { t: 'The stone is warm. For a breath you see what the Remembrancer sees: a long ledger, and your party is in it, in small neat letters.', clue: 'entity_name', xp: 2 },
        fail: { t: 'The stone warms under your hand to the exact temperature of your skin.', san: -2 } },
      { id: 'salt', label: 'Scatter salt down the stair', req: { item: 'salt' }, cost: { item: 'salt' }, once: 'party', stakes: 'Uses a Salt Charm. Slows the Haunting.',
        auto: { t: 'A white line down the middle of the stair. The names around it hush and lie down.', clock: -1, xp: 1 } }
    ]
  };

  L.hall_of_names = {
    id: 'hall_of_names', name: 'Hall of Names', region: 'heart', kind: 'puzzle', x: 1055, y: 250, glyph: 'names', scene: ['blood', 'wall', 'candles', 'columns'], occult: true,
    desc: 'A hall whose walls are all names, floor to ceiling, in a thousand hands. They are not carved; they are growing, like frost. A door at the far end has no keyhole, only a space for one name.',
    options: [
      { id: 'read', label: 'Read the wall', stat: 'wit', dc: 12, once: 'party', retry: 1, stakes: 'Fail: a name reads you.',
        ok: { t: 'The names are ordered by when they were last spoken, ending with the one the bell is ringing now. You read that one last.', hint: 'heartName', hint2: 'heartName', clue: 'memory_hunger', xp: 2 },
        fail: { t: 'One of the names turns, and reads you.', san: -2 } },
      { id: 'speak', label: 'Speak the name the bell rings last', puzzle: { key: 'heartName', title: 'Whose name does the bell ring last?' }, once: 'party', stakes: 'No roll. A wrong name is ruled out and takes a little of you.',
        ok: { t: 'You say it, and the wall exhales: a little crowd of names is released into the air and fades. The door at the end of the hall is open.', flag: 'names_spoken', open: ['hall_of_names|heart_chamber'], xp: 3, glory: 2 },
        fail: { t: 'The wrong name sticks in your mouth and comes out as someone else\'s voice.', san: -2 } },
      { id: 'add', label: 'Add your own name to the wall', stakes: 'Free. Irreversible, and the entity will notice.', confirm: 'Your name will be on the wall. You will be Marked.', once: 'player', onceKey: 'addname',
        auto: { t: 'You write your own name at eye height, in your best hand. The wall accepts it with a small shiver of recognition.', status: 'marked', glory: 3, xp: 1 } }
    ]
  };

  L.still_lake = {
    id: 'still_lake', name: 'The Still Lake', region: 'heart', kind: 'reflection', x: 945, y: 205, glyph: 'lake', scene: ['blood', 'lake', 'fog', 'stars'], occult: true,
    desc: 'A black lake with no wind. The reflection of the cavern roof shows a sky that has never been over this place, and the reflection of you shows a person a little braver than you are.',
    options: [
      { id: 'look', label: 'Look into the lake', stat: 'fate', dc: 12, spirit: true, once: 'party', stakes: 'Fail: your reflection stays.',
        ok: { t: 'The lake shows the Heart as it will be: a bell, a clerk, a pen. You see which of you lifts the rope. It could be you.', flag: 'lake_seen', clue: 'mirror_truth', xp: 2 },
        fail: { t: 'The lake keeps your reflection and gives back one that looks like a draft.', san: -2 } },
      { id: 'ask', label: 'Ask your reflection what it wants', stat: 'wit', dc: 13, once: 'party', stakes: 'Fail: it asks you back.',
        ok: { t: 'It wants what you want: to be remembered. It lets you hold that thought, and trusts you with a name.', hint: 'heartName', hint2: 'bellName', xp: 2 },
        fail: { t: 'It asks what you want. You answer too honestly.', san: -1, spawn: 'mirror_twin' } },
      { id: 'wade', label: 'Wade out to the island', stat: 'might', dc: 12, once: 'party', stakes: 'Fail: the lake does not like being walked on.',
        ok: { t: 'The lake is deeper than it looks and holds still for you. On the island, a vial of moonlight someone left for a rainy day.', item: 'moonwater', xp: 2 },
        fail: { t: 'The lake is deeper than it looks. You are not as buoyant as you hoped.', vit: -3 } }
    ]
  };

  L.pit = {
    id: 'pit', name: 'Pit of Remembered Things', region: 'heart', kind: 'treasure', x: 1105, y: 135, glyph: 'pit', scene: ['blood', 'pit', 'fog', 'coins'], occult: true,
    desc: 'A round hole the size of a square, full of things people have lost: keys, locks of hair, a child\'s shoe, a wedding ring, a knife. They glitter faintly. They want to be remembered.',
    options: [
      { id: 'reach', label: 'Reach in for something', stat: 'fate', dc: 13, once: 'player', stakes: 'Once each. Fail: it takes something of yours.',
        ok: { t: 'Your hand comes up around something heavy and willing.', loot: 'pit', xp: 2 },
        crit: { t: 'It is warm, and it is yours to keep.', loot: 'relic' },
        fail: { t: 'The pit takes something from your pack instead, and thanks you.', loseRandom: true, san: -1 } },
      { id: 'climb', label: 'Climb down for the glint', stat: 'might', dc: 14, once: 'party', stakes: 'Hard. Fail: a long fall.',
        ok: { t: 'Fifty feet down, wedged in the rubble: a crescent of pale metal that is warm and wrong and wonderful.', item: 'moonrelic', xp: 2, glory: 1 },
        fail: { t: 'The wall comes away in your hands and the floor comes up to meet you.', vit: -4 } }
    ]
  };

  L.forge = {
    id: 'forge', name: 'The Cold Forge', region: 'heart', kind: 'craft', x: 995, y: 105, glyph: 'forge', scene: ['blood', 'forge', 'chains', 'candles'],
    desc: 'The forge where the bell was cast, cold for forty years but still faintly orange at the edges. A great mold of sand stands in the middle, with a bell-shaped hole in it.',
    options: [
      { id: 'mold', label: 'Examine the mold', stat: 'wit', dc: 11, once: 'party', retry: 1, stakes: 'Fail: scorched palms.',
        ok: { t: 'The mold has a ridge where the clapper hung, and a gouge where it was struck off by a hammer swung by someone who wept. The bell cannot ring itself.', clue: 'forge_marks', xp: 2 },
        fail: { t: 'The mold is still hot where it matters.', vit: -1 } },
      { id: 'cast', label: 'Cast a grave-iron blade', req: { item: 'lamp_oil' }, cost: { item: 'lamp_oil' }, stat: 'might', dc: 12, once: 'party', stakes: 'Uses Lamp Oil. Fail: the metal spits.',
        ok: { t: 'You light the forge with oil and grief and pour. What comes out is not a pretty blade, but it is a fact.', item: 'blade', xp: 2, glory: 1 },
        fail: { t: 'The metal spits, and cools in a shape that will not be a blade.', vit: -2 } },
      { id: 'hammer', label: 'Strike the anvil', once: 'party', stakes: 'Free. Loud.',
        auto: { t: 'One blow, a bell-note, a long way off. Something very far down hears it and smiles.', noise: 3, glory: 1 } }
    ]
  };

  L.heart_chamber = {
    id: 'heart_chamber', name: 'The Heart Chamber', region: 'heart', kind: 'finale', x: 1100, y: 60, glyph: 'heart', scene: ['blood', 'bell', 'chains', 'eyes'], occult: true, finale: true,
    desc: 'A cavern the size of a village, and in it a single enormous bell, silent, with a clerk in a long grey coat standing beside it holding a ledger. The Remembrancer looks up and smiles with immense, tired courtesy. "Ah. You\'ve come to complete the list."',
    options: [
      { id: 'look', label: 'Study the bell', stat: 'wit', dc: 10, once: 'player', stakes: 'Reveals what each ending needs.',
        ok: { t: 'The bell is not silent; it is ringing at a pitch below hearing. Near the lip, a place where a clapper once hung. You understand what you could do here, and what it would cost.', xp: 2 },
        fail: { t: 'The bell is so large that looking at it is like falling. You come back with nothing but a headache.', san: -1 } },
      { id: 'talk', label: 'Speak to the Remembrancer', stat: 'fate', dc: 13, spirit: true, once: 'player', stakes: 'Fail: it writes you down.',
        ok: { t: '"I do not want to hurt anyone," it says, and means it. "I only want to be complete." It tells you one true thing about how it might be stopped.', hint: 'bellName', clue: 'pact_terms', xp: 2 },
        fail: { t: '"Thank you," it says warmly. A new line appears in the ledger, and you feel your name become slightly less your own.', san: -2, status: 'marked' } }
    ]
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
