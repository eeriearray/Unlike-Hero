/* THE HOLLOW — The Black Estate (7 places). */
(function (g) {
  'use strict';
  var D = g.HollowData = g.HollowData || {};
  D.locations = D.locations || {};
  var L = D.locations;

  L.foyer = {
    id: 'foyer', name: 'Estate Foyer', region: 'estate', kind: 'hub', x: 240, y: 405, glyph: 'door', scene: ['night', 'stairs', 'portraits', 'candles'],
    desc: 'A staircase that climbs into itself. Portraits hang with their faces to the wall; the frames are warm.',
    safe: true,
    options: [
      { id: 'portrait', label: 'Turn a portrait around', stat: 'fate', dc: 11, once: 'party', retry: 1, stakes: 'Fail: it looks back.',
        ok: { t: 'The magistrate, painted in the act of raising a hand. A plaque: "Aye, eighty. Naye, seventy." Someone has scratched out "naye" and written "later".', clue: 'diary', xp: 1 },
        fail: { t: 'The painted eyes follow you out of the room and back in again.', san: -1 } },
      { id: 'book', label: 'Read the visitors\' book', stat: 'wit', dc: 9, once: 'player', stakes: 'Low risk.',
        ok: { t: 'Hundreds of signatures, all the same date. The astronomer, new that week, wrote the star he was going to visit. The ink has smudged: not the Stag.', hint: 'star', xp: 1 },
        fail: { t: 'You sign it, out of habit. Your name sits on the page like a dropped coin.', clock: 1, rumor: true } },
      { id: 'coatroom', label: 'Search the coat-room', stat: 'wit', dc: 10, once: 'party', stakes: 'Fail: moths in your mouth.',
        ok: { t: 'In a fur-lined pocket, an old candle and enough silver to buy a very small apology.', item: 'candle', silver: 2 },
        fail: { t: 'A cloud of moths. They are not moths. They leave something under your tongue.', san: -1 } }
    ]
  };

  L.library = {
    id: 'library', name: 'Forgotten Library', region: 'estate', kind: 'research', x: 105, y: 305, glyph: 'book', scene: ['night', 'books', 'candles', 'columns'], occult: true,
    desc: 'The shelves go up past where the ceiling should be. Dust has been disturbed in the pattern of a person reading, very recently, in a chair that is not there.',
    options: [
      { id: 'shelf', label: 'Find the choir book', puzzle: { key: 'shelf', title: 'Which shelf holds the choir book?' }, stakes: 'No roll. Each wrong shelf is ruled out for everyone.',
        ok: { t: 'Behind the burnt spines of the shelf, a hymnal bound in grey cloth. Someone has underlined a single line: "A bell rung backward unspeaks what it spoke."', clue: 'choir_notes', item: 'candle', xp: 2 },
        fail: { t: 'The books on this shelf are blank, and they would rather you hadn\'t checked.', san: -1 } },
      { id: 'desk', label: 'Search the reading desk', stat: 'wit', dc: 11, once: 'party', retry: 1, stakes: 'Fail: the diary writes back.',
        ok: { t: 'A diary in a steady hand. "We voted. Eighty to seventy. The bell was to be the price, and the village the receipt."', clue: 'diary', xp: 1 },
        fail: { t: 'The pen on the desk writes your name in the diary. It is a good hand. Better than yours.', san: -1, flag: 'name_written' } },
      { id: 'falsebottom', label: 'Work the false bottom of the desk', hidden: true, stat: 'wit', dc: 13, once: 'party', retry: 1, stakes: 'Fail: a spring needle.',
        ok: { t: 'A sheet of salt-white vellum. The Rite of Silence, in the founder\'s own hand: speak the name it was cast for, and each name it has taken.', clue: 'silence_rite', xp: 2 },
        fail: { t: 'A needle takes a bead of blood, and the page that should be here is not.', vit: -1, bleed: true } },
      { id: 'weepingeye', label: 'Take the glass eye from the librarian\'s skull', stat: 'wit', dc: 12, once: 'party', retry: 1, hidden: true, stakes: 'Fail: the librarian objects.',
        ok: { t: 'The eye sheds one slow tear into your palm. You decide not to ask what it has seen.', item: 'weeping_eye', glory: 1 },
        fail: { t: 'The skull whispers a very quiet "no", and you flinch from the quiet.', san: -1 } }
    ]
  };

  L.mirror = {
    id: 'mirror', name: 'Haunted Mirror', region: 'estate', kind: 'haunt', x: 270, y: 290, glyph: 'mirror', scene: ['night', 'mirror', 'candles'], occult: true,
    desc: 'A mirror the height of the room, in a frame of black silver. Your reflection arrives a moment after you do. Behind you, two more people stand quietly, and you are alone.',
    options: [
      { id: 'inspect', label: 'Inspect the reflection', stat: 'wit', dc: 11, once: 'party', retry: 1, stakes: 'Fail: it studies you back.',
        ok: { t: 'The faces in the glass are not yours. They are the faces of people it has memorised, and they are still alive in there.', clue: 'mirror_truth', xp: 1 },
        fail: { t: 'Your reflection smiles first. Then you do.', san: -1 } },
      { id: 'speak', label: 'Speak to the reflection', stat: 'fate', dc: 12, spirit: true, once: 'party', hide: { flag: 'mirror_broken' }, stakes: 'Fail: something steps out.',
        ok: { t: 'It answers in your voice, with the sound of your lungs. It tells you which of the three reflections behind you is lying.', hint: 'mirror', xp: 1 },
        fail: { t: 'It nods, politely, and comes out through the glass wearing your coat.', san: -1, spawn: 'mirror_twin' } },
      { id: 'break', label: 'Break the mirror', stat: 'might', dc: 12, once: 'party', stakes: 'Fail: seven years, in a minute.',
        ok: { t: 'Glass like falling teeth. In the frame, a hand-shaped hole where nothing should be, and in your palm, a shard that shows no face.', item: 'mirror_shard', flag: 'mirror_broken', xp: 1 },
        fail: { t: 'The mirror shatters outward. A shard finds your hand, and every other shard finds your eyes.', vit: -2, san: -1 } },
      { id: 'through', label: 'Step through the true reflection', puzzle: { key: 'mirror', title: 'Which reflection tells the truth?' }, once: 'party', hide: { flag: 'mirror_broken' }, stakes: 'No roll. A wrong step is ruled out for the party.',
        ok: { t: 'The glass is cold, then warm, then a cloister floor under your boots. Behind you, the mirror shows nothing at all.', reveal: ['edge:fountain|mirror'], xp: 2, glory: 1 },
        fail: { t: 'You step into the lie. It lets you out the same way, rearranged.', san: -2 } },
      { id: 'salt', label: 'Salt the glass and read the dust', req: { item: 'salt' }, cost: { item: 'salt' }, once: 'party', stakes: 'Certain. Uses a Salt Charm.',
        auto: { t: 'Salt settles on the glass and shows you where the surface is wrong.', hint: 'mirror', xp: 1 } }
    ]
  };

  L.observatory = {
    id: 'observatory', name: 'Abandoned Observatory', region: 'estate', kind: 'puzzle', x: 125, y: 175, glyph: 'telescope', scene: ['stars', 'dome', 'telescope'], occult: true,
    desc: 'A dome with the roof off. The stars overhead are arranged correctly for a night forty years ago. A brass telescope points at one of them and has worn a groove in the floor.',
    options: [
      { id: 'align', label: 'Align the lens to the bell\'s birth-star', puzzle: { key: 'star', title: 'Which constellation did the bell rise under?' }, once: 'party', stakes: 'No roll. A wrong star is ruled out, and the dome sulks.',
        ok: { t: 'The lens locks. For a moment the sky stands still, and one star lights, and the dome opens a door in the wall that was not there.', flag: 'stars_aligned', item: 'star_lens', xp: 3, glory: 2 },
        fail: { t: 'The telescope screams in a voice that has never been a telescope\'s.', san: -1, clock: 1 } },
      { id: 'charts', label: 'Study the star-charts', stat: 'wit', dc: 12, once: 'party', retry: 1, stakes: 'Fail: eye-strain, and a wrong turn.',
        ok: { t: 'The charts include one that does not belong: stars in a pattern only the Hollow has. A note: "Ring it under these, and backward."', clue: 'reverse_rite', xp: 2 },
        fail: { t: 'You stare too long at a chart that was staring back.', san: -1 } },
      { id: 'desk', label: 'Search the astronomer\'s desk', stat: 'wit', dc: 12, once: 'party', retry: 1, stakes: 'Fail: the astronomer is still at it.',
        ok: { t: 'In a drawer, wrapped in a handkerchief, a locket warm as a held hand. Inside, a portrait that changes.', item: 'ember_locket', xp: 1 },
        fail: { t: 'A skeletal hand shuts the drawer on yours.', vit: -2 } }
    ]
  };

  L.treasury = {
    id: 'treasury', name: 'Trapped Treasury', region: 'estate', kind: 'vault', x: 365, y: 190, glyph: 'chest', scene: ['night', 'vault', 'coins', 'columns'], enemy: 'grave_warden', guard: 'grave_warden',
    desc: 'A vault with the door left open as bait. Three chests, a stack of ledgers, and a suit of grave-iron armour standing at attention beside them.',
    options: [
      { id: 'scout', label: 'Study the floor tiles', stat: 'wit', dc: 10, once: 'party', stakes: 'Low risk. Makes the vault easier.',
        ok: { t: 'Two tiles are slightly too clean. You mark them with the soles of your boots.', flag: 'treasury_scouted', xp: 1 },
        fail: { t: 'The tile you test sinks by a hair, and something clicks far away.', clock: 1 } },
      { id: 'vault', label: 'Pick the vault lock', stat: 'wit', dc: 14, once: 'party', retry: 1, mods: [{ if: { flag: 'treasury_scouted' }, d: -3, why: 'You know the safe tiles' }], stakes: 'Fail: a needle trap.',
        ok: { t: 'Tumblers fall like polite applause. Inside, a gilded psalter and a purse of silver.', item: 'gilded_psalter', silver: 5, xp: 2, glory: 1 },
        fail: { t: 'A needle takes your finger and the vault takes the next five minutes.', vit: -2, bleed: true } },
      { id: 'chest', label: 'Open the obvious chest', once: 'party', stakes: 'Free. Too good to be true.',
        auto: { t: 'Six silver, laid on velvet. The chest also contains a brisk puff of green gas.', silver: 6, vit: -3, glory: 0 } }
    ]
  };

  L.corridor = {
    id: 'corridor', name: 'Shifting Corridor', region: 'estate', kind: 'shifting', x: 255, y: 160, glyph: 'maze', scene: ['night', 'corridor', 'doors'], occult: true, shifting: true,
    desc: 'A hallway of identical doors. Each time you look away, there are more of them, and the last door is the one you came through.',
    options: [
      { id: 'map', label: 'Map the shifts', stat: 'wit', dc: 12, once: 'player', stakes: 'Fail: you are lost, and moved.',
        ok: { t: 'You chalk a mark on every third door and watch which ones rearrange. The pattern is a kind of breathing.', fn: 'corridor_peek', xp: 1 },
        fail: { t: 'You lose count. When you look up, it is a different corridor, and you are not at the end of it.', san: -1, move: 'random:estate' } },
      { id: 'doors', label: 'Open the doors one by one', stat: 'fate', dc: 11, once: 'party', stakes: 'Fail: someone is home.',
        ok: { t: 'Behind door seven, a table laid for one. A warm tonic and a note: "For whoever is brave enough to be hungry."', item: 'tonic', san: 1, xp: 1 },
        fail: { t: 'Behind door seven, a woman who has been waiting a very long time.', spawn: 'whisperling', san: -1 } },
      { id: 'ceiling', label: 'Follow the footprints on the ceiling', stat: 'wit', dc: 13, once: 'party', stakes: 'Fail: the floor is down, mostly.',
        ok: { t: 'The footprints on the ceiling are bare, small and countless. They are not going anywhere; they are all lined up, waiting to be called. You understand what the bell is for.', clue: 'memory_hunger', xp: 2 },
        fail: { t: 'You walk the ceiling for a moment too long. Gravity files a complaint.', vit: -2 } }
    ]
  };

  L.blackmarket = {
    id: 'blackmarket', name: 'The Black Market', region: 'estate', kind: 'market', x: 410, y: 345, glyph: 'market', scene: ['night', 'market', 'candles', 'mask'],
    desc: 'The wine cellar, kept by a masked Broker who sells things that were lost: keys, kisses, afternoons. The lamps burn blue. Silver is accepted. Memories are preferred.',
    descAlt: [{ if: { flag: 'broker_trusted' }, text: 'The Broker inclines its mask a degree toward you. It has a ledger open, and it is showing you the page.' }],
    options: [
      { id: 'lantern', label: 'Buy a Wick Lantern', shop: true, price: 4, stock: 1, item: 'lantern', stakes: '4 Silver. One in stock.' },
      { id: 'tonic', label: 'Buy a Minor Tonic', shop: true, price: 3, stock: 2, item: 'tonic', stakes: '3 Silver. Stock: 2.' },
      { id: 'shard', label: 'Buy a Mirror Shard', shop: true, price: 5, stock: 1, item: 'mirror_shard', stakes: '5 Silver. One in stock.' },
      { id: 'key', label: 'Buy the Spirit Key', shop: true, price: 9, stock: 1, item: 'spirit_key', stakes: '9 Silver. The only one the Broker has.' },
      { id: 'memory', label: 'Sell a memory (+6 Silver)', once: 'player', stakes: 'Free. Costs 2 Sanity. Once each.',
        auto: { t: 'You hand over the afternoon you learned to whistle. The Broker is delighted, and you cannot remember why that mattered.', san: -2, silver: 6 } },
      { id: 'clapper', label: 'Ask where the bell\'s tongue sleeps (2 Silver)', cost: { silver: 2 }, once: 'party', stakes: 'Costs 2 Silver.',
        auto: { t: 'The Broker writes it in the air with one long finger: "Under running water, in the crypt\'s oldest room. Where the dead do not hear."', clue: 'clapper_lore', xp: 1 } },
      { id: 'terms', label: 'Ask for the terms of the Hush', cost: { san: 1 }, once: 'player', stakes: 'Costs 1 Sanity. A private whisper: only you learn it, until you share it.',
        auto: { t: 'The Broker leans close. What it whispers is brief, courteous and the worst thing you have ever heard. You will remember it perfectly.', clue: 'pact_terms', priv: true, xp: 1 } },
      { id: 'rob', label: 'Rob the Broker', stat: 'wit', dc: 15, once: 'party', stakes: 'Very risky. Fail: the Broker keeps what it takes.',
        ok: { t: 'You are fast. The Broker is a mask on a stick. You get a Spirit Key, a Salt Charm and a pocketful of silver before the lamps go out.', item: ['spirit_key', 'salt'], silver: 4, glory: 2, flag: 'broker_robbed' },
        fail: { t: 'The Broker lets you take it, then takes something else: an afternoon you were saving.', san: -3, silver: -2, flag: 'broker_robbed' } }
    ]
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
