/* THE HOLLOW — The Forsaken Abbey (7 places). The Warden's Lair is a boss encounter handled by the engine. */
(function (g) {
  'use strict';
  var D = g.HollowData = g.HollowData || {};
  D.locations = D.locations || {};
  var L = D.locations;

  L.nave = {
    id: 'nave', name: 'Ruined Nave', region: 'abbey', kind: 'hub', x: 650, y: 385, glyph: 'nave', scene: ['night', 'nave', 'pews', 'candles'], occult: true,
    desc: 'Pews in rows, facing a wall where the altar was. Someone has been sitting here recently, in every pew.',
    options: [
      { id: 'register', label: 'Read the burial register', stat: 'wit', dc: 10, once: 'party', retry: 1, stakes: 'Fail: the names move.',
        ok: { t: 'A burial each night for a month, and no body in any grave. Father Venn was burying names.', clue: 'abbey_record', xp: 1 },
        fail: { t: 'The names crawl off the page like ink in water. You lose your place, and some of yourself.', san: -1 } },
      { id: 'pew', label: 'Sit among the congregation and listen', stat: 'fate', dc: 12, spirit: true, once: 'player', stakes: 'Fail: you join the hymn.',
        ok: { t: 'The sermon is a list, read slowly. One name, near the end, is spoken more tenderly than the rest. You write it down.', hint: 'bellName', hint2: 'heartName', xp: 1, san: -1 },
        fail: { t: 'You join the hymn. You do not remember the verse you sing.', san: -2 } },
      { id: 'candles', label: 'Light the nave candles', req: { item: 'candle' }, cost: { item: 'candle' }, once: 'party', stakes: 'Uses a candle. Slows the Haunting.',
        auto: { t: 'One flame, then another, down the nave. Every pew-sitter turns to look, and turns away, shy.', clock: -2, flag: 'nave_lit', xp: 1, glory: 1 } },
      { id: 'pray', label: 'Pray for the dead', stat: 'fate', dc: 10, once: 'player', stakes: 'Fail: the Haunting leans in.',
        ok: { t: 'You pray for everyone named here and everyone not. The congregation breathes out.', san: 2 },
        fail: { t: 'Your prayer is received by someone who does not wish you well.', clock: 1 } }
    ]
  };

  L.fountain = {
    id: 'fountain', name: 'Spirit Fountain', region: 'abbey', kind: 'spirit', x: 540, y: 300, glyph: 'fountain', scene: ['night', 'fountain', 'fog', 'columns'], occult: true,
    desc: 'A cloister fountain with no basin, only a stone figure pouring water into the air. The water arrives in the cloister a moment later than it should, from a different direction.',
    options: [
      { id: 'offer', label: 'Make the offering the spirit wants', puzzle: { key: 'fountain', title: 'What does the fountain want?', cost: true }, once: 'party', stakes: 'Costs the offering. Wrong guesses are ruled out.',
        ok: { t: 'The pouring figure stops and holds the water still. It was waiting to be asked politely. It gives you a vial and a long, tired thanks.', item: 'moonwater', flag: 'fountain_calm', xp: 2, glory: 1 },
        fail: { t: 'The water turns dark and surges. It takes the offering anyway.', san: -1 } },
      { id: 'drink', label: 'Drink from the fountain', stat: 'fate', dc: 12, once: 'player', hide: { flag: 'fountain_calm' }, stakes: 'Fail: a drowned voice answers.',
        ok: { t: 'Cold, clear, sorry. Your mind settles like silt.', san: 3, vit: 1 },
        fail: { t: 'The drowned voice has a lot to say. It says it all.', san: -2 } },
      { id: 'drink2', label: 'Drink the calmed water', show: { flag: 'fountain_calm' }, once: 'player', stakes: 'Free. Restores you.',
        auto: { t: 'The water holds nothing back now. It is only water, which is a mercy.', san: 3, vit: 2 } },
      { id: 'water', label: 'Listen to the water', stat: 'wit', dc: 11, once: 'party', stakes: 'Fail: it listens back.',
        ok: { t: 'The water repeats a single word at increasing pitch: Remembrancer. Not a devil. A keeper of lists that wants the list to be complete.', clue: 'entity_name', xp: 1 },
        fail: { t: 'The water repeats your last sentence, much too fast.', san: -1 } }
    ]
  };

  L.altar = {
    id: 'altar', name: 'Cursed Altar', region: 'abbey', kind: 'bargain', x: 690, y: 285, glyph: 'altar', scene: ['night', 'altar', 'candles', 'eyes'], occult: true,
    desc: 'A black altar with a hollow at its centre, the exact size of a palm. Offerings have been left here for forty years, and every one has been refused: refused things pile up.',
    options: [
      { id: 'refuse', label: 'Refuse the bargain', once: 'player', stakes: 'Free. You keep your name.',
        auto: { t: 'You say no. The altar says nothing, but the silence has respect in it.', san: 1, status: 'blessed', xp: 1 } },
      { id: 'sacmight', label: 'Pay 3 Vitality for lasting Might', cost: { vit: 3 }, once: 'player', onceKey: 'sacrifice', stakes: 'Costs 3 Vitality. Permanent +1 Might. One sacrifice per person.',
        auto: { t: 'The altar takes it like a coin. Your knuckles ache pleasantly afterward.', stat: { might: 1 }, xp: 1 } },
      { id: 'sacwit', label: 'Pay 3 Vitality for lasting Wit', cost: { vit: 3 }, once: 'player', onceKey: 'sacrifice', stakes: 'Costs 3 Vitality. Permanent +1 Wit. One sacrifice per person.',
        auto: { t: 'You bleed into the hollow. Cold, bright thoughts arrive in a neat row.', stat: { wit: 1 }, xp: 1 } },
      { id: 'sacfate', label: 'Pay 3 Vitality for lasting Fate', cost: { vit: 3 }, once: 'player', onceKey: 'sacrifice', stakes: 'Costs 3 Vitality. Permanent +1 Fate. One sacrifice per person.',
        auto: { t: 'The blood runs in the hollow like a compass needle and then stops. You know which way is luck.', stat: { fate: 1 }, xp: 1 } },
      { id: 'deceive', label: 'Deceive the altar', stat: 'wit', dc: 14, once: 'player', onceKey: 'sacrifice', stakes: 'Hard. Success: a free +1 to a random stat. Fail: it marks you.',
        ok: { t: 'You leave a counterfeit offering in the hollow, with great ceremony. The altar accepts it. It will find out, later, at its leisure.', stat: { random: 1 }, glory: 2 },
        fail: { t: 'The altar sees through it, reluctantly, like a parent. Your name is written somewhere new.', status: 'marked', san: -2 } },
      { id: 'together', label: 'Make the offering together', req: { allyHere: true }, cost: { vit: 1 }, once: 'party', stakes: 'Costs each of you 1 Vitality. Everyone present is blessed and learns the Hush\'s terms.',
        auto: { t: 'Two hands in the hollow instead of one. The altar considers, and finds it was not expecting company.', status: 'blessed', party: { vit: -1, status: 'blessed' }, clue: 'pact_terms', xp: 2, glory: 1 } },
      { id: 'pact', label: 'Take the Remembrancer\'s hand', pflag: 'pact', hide: { pflag: 'pact' }, confirm: 'You will be Marked. The Remembrancer will know your name and hunt your secrets, but it will save you once.', once: 'player', stakes: 'Irreversible. Marked for good; one free rescue from death.',
        auto: { t: 'A palm out of the dark, dry as a ledger. A voice says, "Fair." It remembers you, entirely, and now you are not allowed to be forgotten.', pflag: 'pact', pactSave: true, status: 'marked', silver: 5, glory: 2, xp: 2 } },
      { id: 'revive', label: 'Bargain for a fallen ally', needsTarget: 'fallen', cost: { maxvit: 2 }, once: 'party', stakes: 'Costs 2 Max Vitality from you. The party can revive only twice.',
        auto: { t: 'You offer part of yourself. The altar writes the name back into the list. They are warm again, and furious about it.', revive: true, status: 'marked' } }
    ]
  };

  L.reliquary = {
    id: 'reliquary', name: 'Cursed Reliquary', region: 'abbey', kind: 'relic', x: 800, y: 330, glyph: 'reliquary', scene: ['night', 'reliquary', 'candles', 'bones'], occult: true,
    desc: 'Gilt cases along a stone aisle, each holding a piece of someone who was holy. The labels are in a cramped hand and have been corrected, and corrected back.',
    options: [
      { id: 'open', label: 'Open the saint\'s reliquary', stat: 'fate', dc: 13, spirit: true, once: 'party', retry: 1, stakes: 'Fail: the relic marks you.',
        ok: { t: 'The case opens like a gentle hand. A blackened knuckle in a silver sleeve. It does not mind being carried.', item: 'saint_finger', xp: 2, glory: 1 },
        fail: { t: 'The relic pulses. The case snaps shut on your sleeve, and some of its cursedness stays with you.', status: 'cursed', san: -1 } },
      { id: 'labels', label: 'Study the corrected labels', stat: 'wit', dc: 11, once: 'party', stakes: 'Fail: they correct you.',
        ok: { t: 'Not "Saint". "Clerk". The bones are all one man\'s, labelled with the names of those he wronged. A note at the end: "The bell may be broken. I do not advise it."', clue: 'unmaking', xp: 1 },
        fail: { t: 'A label changes while you read it. You are now, officially, a saint.', san: -1 } },
      { id: 'smash', label: 'Smash the case', stat: 'might', dc: 12, once: 'party', stakes: 'Fail: glass and consequences.',
        ok: { t: 'Glass sings. The knuckle is yours, and the Abbey will remember how you got it.', item: 'saint_finger', clock: 1, xp: 1 },
        fail: { t: 'The glass wins. The case is untouched.', vit: -2, san: -1 } }
    ]
  };

  L.ritual = {
    id: 'ritual', name: 'Ritual Chamber', region: 'abbey', kind: 'rite', x: 570, y: 175, glyph: 'circle', scene: ['night', 'circle', 'candles', 'chains'], occult: true,
    desc: 'A circular room with a brass ring set in the floor and eleven chalk sigils around it, one for every bell-stroke the village has rung. The twelfth has been started and not finished.',
    options: [
      { id: 'circle', label: 'Study the chalk circle', stat: 'wit', dc: 12, once: 'party', retry: 1, stakes: 'Fail: the sigils smudge.',
        ok: { t: 'The Rite of Silence, in Father Venn\'s own hand: speak the name it was cast for, then each name it has taken.', clue: 'silence_rite', xp: 2 },
        fail: { t: 'A sigil smears under your hand and goes warm.', san: -1 } },
      { id: 'prepare', label: 'Prepare the banishing rite', req: { item: 'candle' }, cost: { item: 'candle' }, once: 'party', stakes: 'Uses a candle. The rite is ready for the Abbey Warden.',
        auto: { t: 'You set a candle on each sigil and walk the circle, counting. The room takes it very seriously.', flag: 'rite_ready', xp: 1, glory: 1 } },
      { id: 'read', label: 'Read the unfinished invocation aloud', stat: 'fate', dc: 14, spirit: true, once: 'party', stakes: 'Very hard. Fail: the words bite.',
        ok: { t: 'The syllables are heavy and fit your mouth too well. When you finish, the bell\'s name comes out of you like a coin out of a purse.', hint: 'bellName', hint2: 'bellName', xp: 2 },
        fail: { t: 'The words stick in your throat and then, one at a time, in your thoughts.', san: -3 } },
      { id: 'keystone', label: 'Pull the keystone', stat: 'might', dc: 14, once: 'party', stakes: 'Cracks the Abbey. Hurts the Warden, but the Abbey ceilings get worse.',
        ok: { t: 'The keystone slides out like a bad tooth. Somewhere above, the vault begins a slow descent that will take hours.', flag: 'abbey_pillars_cracked', vit: -2, xp: 2 },
        fail: { t: 'The keystone does not move. Your shoulder does, in a way it should not.', vit: -3 } }
    ]
  };

  L.prison = {
    id: 'prison', name: 'Prison of Echoes', region: 'abbey', kind: 'rescue', x: 715, y: 165, glyph: 'cell', scene: ['night', 'cells', 'chains', 'fog'], occult: true,
    desc: 'Cells in a ring, each with a door that opens inward and a voice that answers whatever you say a moment before you finish saying it.',
    options: [
      { id: 'tamsin', label: 'Free the child in cell 7', stat: 'wit', dc: 12, once: 'party', retry: 1, stakes: 'Success wins an ally. Fail: the cell calls out.',
        ok: { t: 'Tamsin Greaves is eleven, thin as a hymn-sheet, and unexpectedly alive. "The bell is saying my name," she tells you. "It sounds so sad."', ally: 'tamsin', xp: 3, glory: 2 },
        fail: { t: 'The lock catches. The echo of your failure carries the length of the Abbey.', noise: 2, spawn: 'whisperling' } },
      { id: 'tamsinforce', label: 'Break the cell door', stat: 'might', dc: 13, once: 'party', retry: 1, hide: { ally: 'tamsin' }, stakes: 'Success wins an ally. Fail: noise.',
        ok: { t: 'The door gives with a shriek. "Thank you," says a very small voice. "I didn\'t know anyone still knocked."', ally: 'tamsin', xp: 3, glory: 2, noise: 1 },
        fail: { t: 'The door holds. Down the corridor, something stirs.', vit: -1, noise: 2 } },
      { id: 'echo', label: 'Comfort the echo in the empty cell', stat: 'fate', dc: 12, spirit: true, once: 'party', retry: 1, mods: [{ if: { flag: 'thea_named' }, d: -3, why: 'You learned her name in the Graveyard' }], stakes: 'Fail: it clings to you.',
        ok: { t: 'A woman\'s voice, with no one in it, asks you to tell the Abbey that Thea is sorry. You say you will. Her voice lifts, and the cell is only a cell.', flag: 'spirit_freed', clue: 'venn_confession', xp: 3, glory: 3 },
        fail: { t: 'The echo clings to you, wet and desperate. It takes a long moment to let go.', san: -2 } },
      { id: 'listen', label: 'Listen to the echoes', stat: 'wit', dc: 9, once: 'player', stakes: 'Low risk.',
        ok: { t: 'The echoes agree on one thing: the Warden swore an oath to keep the stair until the bell is silent. He is not cruel. He is only still waiting.', clue: 'warden_oath', xp: 1 },
        fail: { t: 'The echoes answer questions you haven\'t asked yet.', san: -1 } },
      { id: 'cot', label: 'Check under the guard\'s cot', hidden: true, show: { secret: ['keyLoc', 'prison'] }, stat: 'wit', dc: 11, once: 'party', stakes: 'Fail: dust and splinters.',
        ok: { t: 'Under the cot, in a cutlery roll, an iron key with a ghost-bell on its bow.', item: 'spirit_key', xp: 2, glory: 1 },
        fail: { t: 'Splinters. The cot was not designed to be looked under.', vit: -1 } }
    ]
  };

  // The Warden's Lair is resolved by the engine's boss logic (D.boss). `boss: true` marks it.
  L.warden = {
    id: 'warden', name: 'The Warden\'s Lair', region: 'abbey', kind: 'boss', x: 850, y: 215, glyph: 'chain', scene: ['blood', 'lair', 'chains', 'eyes'], occult: true, boss: true,
    desc: 'A hall of black iron with a staircase going down behind a seated knight. Three chains run from his armour to the floor, the walls, the ceiling. They sing when he breathes.',
    options: []
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
