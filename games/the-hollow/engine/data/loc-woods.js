/* THE HOLLOW — The Whispering Woods (7 places). */
(function (g) {
  'use strict';
  var D = g.HollowData = g.HollowData || {};
  D.locations = D.locations || {};
  var L = D.locations;

  L.forest = {
    id: 'forest', name: 'Living Forest', region: 'woods', kind: 'maze', x: 600, y: 590, glyph: 'tree', scene: ['dusk', 'trees', 'fog', 'eyes'], enemy: 'hollow_stag', guard: 'hollow_stag', forage: true,
    desc: 'The trees move when you blink. The path you came by is now somewhere else, and a little embarrassed about it.',
    options: [
      { id: 'follow', label: 'Follow the whispering trees', stat: 'fate', dc: 11, spirit: true, once: 'party', retry: 1, stakes: 'Fail: lost, and moved.',
        ok: { t: 'The trees part in a long reluctant curtsey. A path you were not given leads straight to the Moonwell.', reveal: ['edge:forest|moonwell'], xp: 1 },
        fail: { t: 'The trees close ranks. When they open, you are somewhere else, with leaves in your pockets.', san: -1, move: 'random:woods' } },
      { id: 'forage', label: 'Forage the undergrowth', stat: 'wit', dc: 9, once: 'player', stakes: 'Fail: thorns.',
        ok: { t: 'Gravemoss, thick on the north side of every trunk. You fill your pockets.', item: ['herb', 'herb'], xp: 1 },
        fail: { t: 'The thorns remember their own.', vit: -1 } },
      { id: 'wind', label: 'Listen to what the wind says', stat: 'fate', dc: 10, spirit: true, once: 'party', stakes: 'Fail: it says it back to you.',
        ok: { t: 'Half-sentences, repeated: "...is an ear...", "...hums the bell\'s note...". The Whispering Shrine is where the wind goes to listen.', clue: 'shrine_hum', xp: 1 },
        fail: { t: 'The wind learns your name and leaves it on all the branches.', san: -1, clock: 1 } }
    ]
  };

  L.cabin = {
    id: 'cabin', name: 'Hunter\'s Cabin', region: 'woods', kind: 'refuge', x: 565, y: 725, glyph: 'cabin', scene: ['dusk', 'cabin', 'trees', 'candles'], safe: true, forage: true,
    desc: 'Smoke without a fire. Three hounds\' collars are nailed over the door, still wet. In the loft, something breathes shallowly, trying to be mistaken for a bag of grain.',
    options: [
      { id: 'hob', label: 'Coax the trapper out of the loft', stat: 'wit', dc: 10, once: 'party', retry: 1, mods: [{ if: { flag: 'hob_robbed' }, d: 3, why: 'You stripped his traps' }],
        stakes: 'Fail: a thrown bottle. Success wins an ally.',
        ok: { t: 'Hob Marl comes down the ladder with a hatchet he has forgotten to hold. He tells you, in one breath, how he watched the village sink "like a stone into milk".', ally: 'hob', clue: 'hunter_tale', xp: 3, glory: 2 },
        fail: { t: 'A bottle explodes against the wall beside your ear. "I\'m not on the list!"', vit: -1, rumor: true } },
      { id: 'map', label: 'Read the trapper\'s map', stat: 'wit', dc: 9, once: 'party', stakes: 'Low risk.',
        ok: { t: 'Hob\'s map: the Woods marked in snare-lines, and, in the margin, a route that does not move.', reveal: ['loc:garden', 'loc:moonwell', 'loc:battlefield', 'loc:shrine'], xp: 1 },
        fail: { t: 'The map is also a snare. It closes on your hand, politely.', vit: -1 } },
      { id: 'traps', label: 'Take the snares from the wall', once: 'party', stakes: 'Free. Hob will not forgive it.',
        auto: { t: 'A wall of snares, still oiled. You take them. In the loft, something notes it.', item: ['snare', 'snare'], flag: 'hob_robbed' } },
      { id: 'hearth', label: 'Pry up the hearthstone', hidden: true, show: { secret: ['keyLoc', 'hunter_cabin'] }, stat: 'wit', dc: 11, once: 'party', stakes: 'Fail: scorched fingers.',
        ok: { t: 'Under the hearthstone, wrapped in a sock: an iron key with a ghost\'s impression of a bell on its bow.', item: 'spirit_key', xp: 2, glory: 1 },
        fail: { t: 'The stone is hotter than it should be.', vit: -1 } }
    ]
  };

  L.garden = {
    id: 'garden', name: 'Witch\'s Garden', region: 'woods', kind: 'craft', x: 700, y: 700, glyph: 'herb', scene: ['dusk', 'garden', 'trees', 'fog'], forage: true, safe: true,
    desc: 'Rows of herbs in a hedge-maze that smells of rain on hot stone. An old woman is weeding, rows from where you are. She does not look up, but she knows.',
    options: [
      { id: 'speak', label: 'Speak with the herbwife', stat: 'fate', dc: 10, once: 'party', retry: 1, mods: [{ if: { flag: 'garden_burned' }, d: 99, why: 'The garden is ash' }], hide: { flag: 'garden_burned' }, stakes: 'Fail: she vanishes into the hedge.',
        ok: { t: 'Old Ketterick asks if you have come about the wedding. She has not been told which wedding. She gives you tea, a hint, and a duty: "Mind the bell."', ally: 'ketterick', clue: 'silence_rite', xp: 3, glory: 2 },
        fail: { t: 'She turns, and is a hedge. The hedge hums a tune you recognise from nowhere.', san: -1 } },
      { id: 'herb', label: 'Pick the herb that heals', puzzle: { key: 'herb', title: 'Which herb is the true one?' }, once: 'party', hide: { flag: 'garden_burned' }, stakes: 'No roll. A wrong herb is poison, and is ruled out.',
        ok: { t: 'You chew it. It tastes like someone forgiving you. The rest of the row, you take with permission.', item: ['tonic', 'tonic', 'herb'], xp: 2 },
        fail: { t: 'Bitter, then numb, then cold. You are sick in the lavender.', vit: -2, bleed: true } },
      { id: 'draught', label: 'Buy a calming draught (3 Silver)', cost: { silver: 3 }, once: 'player', hide: { flag: 'garden_burned' }, stakes: 'Costs 3 Silver.',
        auto: { t: 'It tastes of warm hands. For a minute you stop being afraid of anything with a face.', san: 4 } },
      { id: 'burn', label: 'Burn the garden', req: { item: 'lantern' }, stat: 'might', dc: 8, once: 'party', hide: { flag: 'garden_burned' }, stakes: 'Ally lost for good. Salt from the ashes.',
        ok: { t: 'It burns well. The old woman, whoever she was, is not there when the smoke clears. You scoop salt from the ashes.', item: ['salt', 'salt'], flag: 'garden_burned', glory: -1 },
        fail: { t: 'The hedge-maze burns back.', vit: -2, flag: 'garden_burned' } }
    ]
  };

  L.orchard = {
    id: 'orchard', name: 'Bone Orchard', region: 'woods', kind: 'blight', x: 725, y: 560, glyph: 'apple', scene: ['dusk', 'orchard', 'fog', 'bones'],
    desc: 'Apple trees hung with small bones that clink in a wind you cannot feel. Under each, a grave dug for one person and too small for any.',
    options: [
      { id: 'cleanse', label: 'Cleanse the Rot', stat: 'fate', dc: 14, spirit: true, once: 'party', retry: 1, stakes: 'Hard. Fail: the Rot learns your face.',
        ok: { t: 'You walk the rows singing the first hymn you knew. Grey leaves fall off the trees like a curtain of ash and the bones stop clinking.', cleanse: 'rot', xp: 3, glory: 3 },
        fail: { t: 'The Rot spreads up your arm for a moment before it lets go. It leaves a mark.', san: -2, status: 'cursed' } },
      { id: 'eat', label: 'Eat a bone-apple', once: 'player', stakes: 'Free. +3 Vitality, but you taste it for days.',
        auto: { t: 'Sweet, and cold, and it feels like winning an argument. Something remembers you have eaten it.', vit: 3, san: -2 } },
      { id: 'dig', label: 'Dig where the grave has no bones', puzzle: { key: 'grave', title: 'Which grave is empty of bones?' }, once: 'party', stakes: 'No roll. A wrong grave is ruled out.',
        ok: { t: 'Under the grave with no bones: a glass eye, wet with something that is not dew, still looking at you.', item: 'weeping_eye', xp: 2, glory: 1 },
        fail: { t: 'The earth caves in around your leg. You find what the grave was keeping.', vit: -2 } }
    ]
  };

  L.moonwell = {
    id: 'moonwell', name: 'Moonwell', region: 'woods', kind: 'fate', x: 835, y: 645, glyph: 'moon', scene: ['stars', 'well', 'fog', 'moon'], occult: true,
    desc: 'A stone well full of a second moon. The water does not reflect the sky; it remembers it.',
    options: [
      { id: 'drink', label: 'Drink from the second moon', once: 'player', stakes: 'Free. Restores you. The Hollow notices a sip like that.',
        auto: { t: 'Cold, pale, utterly clean. You feel mended in the places the dark has been using as handles.', vit: 3, san: 2, clock: 1 } },
      { id: 'wish', label: 'Cast a coin and wish', cost: { silver: 1 }, stat: 'fate', dc: 11, once: 'player', stakes: 'Costs 1 Silver. Fail: the Moon asks for more.',
        ok: { t: 'The coin sinks in a spiral. A pale hand returns something warm and wet to yours.', status: 'blessed', xp: 1 },
        crit: { t: 'And the moon, amused, lets you have something that should stay under it.', item: 'moonrelic' },
        fail: { t: 'The Moon takes the coin and your reflection for a moment.', san: -1 } },
      { id: 'vial', label: 'Fill a vial', stat: 'fate', dc: 10, once: 'party', stakes: 'Only two vials can ever be drawn. Fail: the moon looks back.',
        ok: { t: 'It fills slowly, reluctantly, as if the water were making up its mind.', item: 'moonwater', san: -1 },
        fail: { t: 'The vial comes up empty, and so do you for a moment.', san: -1 } },
      { id: 'dive', label: 'Look closer into the second moon', hidden: true, stat: 'fate', dc: 12, once: 'party', stakes: 'Reveals a one-way drop to the crypts.',
        ok: { t: 'The moon has a bottom, and the bottom has a door. It opens downward, into the crypt\'s flooded hall. You could only go one way.', reveal: ['edge:moonwell>flooded_hall'], xp: 2 },
        fail: { t: 'Your face comes up smiling, and not yours.', san: -2 } }
    ]
  };

  L.battlefield = {
    id: 'battlefield', name: 'Forgotten Battlefield', region: 'woods', kind: 'ghosts', x: 640, y: 465, glyph: 'sword', scene: ['dusk', 'pikes', 'fog', 'banners'],
    desc: 'Rusted pikes stand like iron wheat. Faint voices drill a regiment nobody mustered. Every standard is at half-mast for a different war.',
    options: [
      { id: 'scavenge', label: 'Scavenge the fallen', stat: 'wit', dc: 11, once: 'party', retry: 1, stakes: 'Fail: they notice.',
        ok: { t: 'Under a captain\'s ribs, still sharp, a blade of grave-iron stamped with a bell.', item: 'blade', silver: 2, xp: 2 },
        fail: { t: 'A hand closes on your ankle. Not a living one. A voice says, "Fall in."', vit: -1, san: -2 } },
      { id: 'salute', label: 'Salute the colours', stat: 'fate', dc: 10, spirit: true, once: 'player', stakes: 'Fail: they salute back.',
        ok: { t: 'A hundred dry hands rise, and lower. Whatever commanded this field has noted you as a friendly.', status: 'blessed', xp: 1 },
        fail: { t: 'They salute you back, all at once, and take a pace forward.', san: -1 } },
      { id: 'chest', label: 'Open the standard-bearer\'s chest', hidden: true, show: { secret: ['keyLoc', 'battlefield'] }, stat: 'wit', dc: 11, once: 'party', stakes: 'Fail: a dying fuse.',
        ok: { t: 'Wrapped in a regimental sash: an iron key, cold as a snake.', item: 'spirit_key', xp: 2, glory: 1 },
        fail: { t: 'A powder charge older than you pops in your face.', vit: -2 } },
      { id: 'watch', label: 'Dig in for the night', once: 'player', stakes: 'Free. +3 Vitality. Time does not wait for you.',
        auto: { t: 'You take a sentry\'s post. The old soldiers close ranks to keep you in the middle.', vit: 3, clock: 1 } }
    ]
  };

  L.shrine = {
    id: 'shrine', name: 'Whispering Shrine', region: 'woods', kind: 'ear', x: 850, y: 520, glyph: 'stone', scene: ['dusk', 'shrine', 'fog', 'eyes'], occult: true,
    desc: 'A waist-high shrine of black stone, set with a hundred small holes. The wind goes into them and does not come out.',
    options: [
      { id: 'listen', label: 'Listen at the shrine', stat: 'fate', dc: 11, spirit: true, once: 'party', retry: 1, stakes: 'Fail: it listens back.',
        ok: { t: 'The shrine hums the bell\'s note, an octave down. You realise the holes are not for offerings. They are for listening.', clue: 'shrine_hum', hint: 'bellName', xp: 2 },
        fail: { t: 'It listens to you for exactly as long as it needs.', san: -2, clock: 1 } },
      { id: 'smash', label: 'Smash the shrine', stat: 'might', dc: 13, once: 'party', stakes: 'Removes a curse, but changes the Woods.',
        ok: { t: 'The black stone shatters. The wind rushes out, relieved. A long way off, something that had been quiet stands up.', cleanse: 'shrine', flag: 'shrine_destroyed', xp: 2, glory: 1 },
        fail: { t: 'The shrine\'s holes whistle, and you hear every sentence you ever regretted.', san: -2, vit: -1 } },
      { id: 'offer', label: 'Make an offering (2 Silver)', cost: { silver: 2 }, once: 'player', stakes: 'Costs 2 Silver.',
        auto: { t: 'Silver drops into a hole. The humming skips a beat, then picks up, warmer.', status: 'blessed', xp: 1 } },
      { id: 'lie', label: 'Tell the shrine a lie', stat: 'wit', dc: 14, once: 'party', stakes: 'Hard. A good lie slows the Haunting. A bad one hastens it.',
        ok: { t: 'You tell the Hollow that you have given up and gone home. It writes it down, and for a while the writing slows.', clock: -2, xp: 2, glory: 1 },
        fail: { t: 'It knows. It writes down the lie anyway, and the truth next to it.', clock: 2, san: -1 } }
    ]
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
