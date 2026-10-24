/* THE HOLLOW — The Dying Village (8 places). See engine docs in ../hollow-engine.js for the option/outcome format. */
(function (g) {
  'use strict';
  var D = g.HollowData = g.HollowData || {};
  D.locations = D.locations || {};
  var L = D.locations;

  L.square = {
    id: 'square', name: 'The Silent Square', region: 'village', kind: 'hub', x: 235, y: 625, glyph: 'well', scene: ['dusk', 'fog', 'well', 'houses'],
    desc: 'Thornwick\'s square, exactly as the postcards had it, minus the postcards. The well in the middle drips upward.',
    forage: true, safe: true,
    options: [
      { id: 'board', label: 'Read the notice board', stat: 'wit', dc: 8, once: 'party', retry: 1, stakes: '1 action. Failure costs 1 Sanity. A critical failure also advances the Clock.',
        ok: { t: 'Every notice is dated the same day and signed by the same hand. One of them lists, in order, who voted to sell what.', clue: 'ledger', xp: 1 },
        fail: { t: 'The paper crumbles to names. For a moment yours is on it, in small, careful letters.', san: -1, rumor: true } },
      { id: 'well', label: 'Lean over the well', stat: 'fate', dc: 11, spirit: true, once: 'player', stakes: 'Fail: it says a name and expects you to answer.',
        ok: { t: 'You hear the bell\'s count from below, a hundred feet down: the toll arrives before the bell does. Someone down there is practising its name.', hint: 'bellName', xp: 1 },
        crit: { t: 'And the well, helpfully, exhales an old coin.', silver: 2 },
        fail: { t: 'The well says a name. It is not yours, but you answer to it.', san: -1, clock: 1 } },
      { id: 'rally', label: 'Make camp and share a drink', once: 'party', stakes: 'Free. Everyone here steadies.',
        auto: { t: 'No rations, but you pass a flask. The stars are wrong, but they are the same wrong for everyone.', status: 'blessed', party: { status: 'blessed' }, xp: 1 } }
    ]
  };

  L.chapel = {
    id: 'chapel', name: 'Abandoned Chapel', region: 'village', kind: 'sanctuary', x: 105, y: 570, glyph: 'chapel', scene: ['dusk', 'chapel', 'candles'],
    desc: 'The pews have been stacked into a wall facing the door. Whatever was kept out, it was kept out in a hurry.',
    safe: true,
    options: [
      { id: 'pray', label: 'Pray at the broken altar', once: 'player', hide: { flag: 'chapel_robbed' }, stakes: 'Free. Restores Sanity and lifts a curse. Once each.',
        auto: { t: 'The altar is broken, but the silence around it is whole. You kneel in it for a while.', san: 2, status: '-cursed' } },
      { id: 'vestry', label: 'Search the vestry', stat: 'wit', dc: 10, once: 'party', retry: 1, stakes: '1 action. Failure costs 1 Health and adds 1 noise. Critical failure also advances the Clock.',
        ok: { t: 'Under a chasuble the moths have been unraveling for decades: a salt charm and a beeswax candle stamped with a bell.', item: ['salt', 'candle'], xp: 1 },
        fail: { t: 'A shelf comes down in a long wooden sigh. Everything that falls is dust.', vit: -1, noise: 1 } },
      { id: 'plate', label: 'Take the collection (3 Silver)', once: 'party', stakes: 'Free. The chapel will not forgive it.',
        auto: { t: 'Someone left a plate of old coin on the font as if for a wake. You take it. It is lighter in your hand than in your conscience.', silver: 3, san: -1, flag: 'chapel_robbed' } },
      { id: 'hatch', label: 'Open the tithe-hatch under the font', hidden: true, stat: 'wit', dc: 12, once: 'party', retry: 1, stakes: 'Reveals a shortcut; fail jams the hatch and hurts.',
        ok: { t: 'The hatch gives onto a crawlway smelling of ink. A wet footprint leads to the Black Estate\'s library.', reveal: ['edge:chapel|library'], item: 'thread', xp: 1 },
        fail: { t: 'The hatch bites your fingers closed.', vit: -1, bleed: true } }
    ]
  };

  L.nursery = {
    id: 'nursery', name: 'Bloodstained Nursery', region: 'village', kind: 'haunt', x: 95, y: 705, glyph: 'cradle', scene: ['night', 'cradles', 'candles'], occult: true,
    desc: 'The nursery door swings inward. Six wooden cradles face the wall. Only one rocks. From inside it, a voice asks whether you have come to collect your child.',
    options: [
      { id: 'answer', label: 'Answer the voice in the cradle', stat: 'fate', dc: 12, spirit: true, once: 'party', retry: 1, stakes: 'Fail: you remember something that never happened.',
        ok: { t: 'You say no. The voice sighs with relief and tells you the thing it was trying to remember: that it eats the forgotten. It asks that you remember it kindly.', clue: 'memory_hunger', xp: 2 },
        fail: { t: 'You say yes. The cradle stops rocking. Something small and cold climbs into your arms and is gone before you can scream.', san: -2, flag: 'cradle_attached' },
        fumble: { t: 'And all six cradles begin to rock.', status: 'cursed' } },
      { id: 'inspect', label: 'Inspect the six cradles', stat: 'wit', dc: 11, once: 'party', stakes: 'Fail: you disturb what is resting.',
        ok: { t: 'Under the mattresses, six names in a child\'s hand. The last is circled twice and marked "Abbey, cell 7". A drawing of a key hangs above it.', reveal: ['loc:prison'], silver: 1, xp: 1 },
        fail: { t: 'Dust rises. All six cradles turn to face you.', san: -1 } },
      { id: 'burn', label: 'Burn the rocking cradle', req: { item: 'lantern' }, stat: 'might', dc: 10, once: 'party', stakes: 'Cleanses a curse. Fail: the fire spreads.',
        ok: { t: 'It burns blue, then white, then it is only wood. The lullaby cuts off mid-word.', cleanse: 'cradle', xp: 2, glory: 2 },
        fail: { t: 'The fire climbs the walls with unholy appetite.', vit: -2, clock: 1 } },
      { id: 'gift', label: 'Leave a coin in the cradle', cost: { silver: 1 }, once: 'player', stakes: 'Costs 1 Silver.',
        auto: { t: 'The coin makes the sound a coin makes in a very deep well. Something in the room stops waiting.', san: 1, status: 'blessed', flag: 'nursery_gifted' } }
    ]
  };

  L.wagon = {
    id: 'wagon', name: 'Merchant\'s Wagon', region: 'village', kind: 'market', x: 345, y: 735, glyph: 'wagon', scene: ['dusk', 'wagon', 'candles', 'fog'],
    desc: 'A wagon hung with lamps, parked as if the market were still open. The merchant is called Pell, he sells to the dead, and he is very glad to see the living.',
    descAlt: [{ if: { flag: 'merchant_robbed' }, text: 'Pell\'s lamps are all turned toward you. He is still smiling. He is keeping count.' }],
    safe: true,
    options: [
      { id: 'tonic', label: 'Buy a Minor Tonic', shop: true, price: 3, stock: 3, item: 'tonic', stakes: '3 Silver. The wagon has 3.' },
      { id: 'salt', label: 'Buy a Salt Charm', shop: true, price: 2, stock: 3, item: 'salt', stakes: '2 Silver. Stock: 3.' },
      { id: 'oil', label: 'Buy Lamp Oil', shop: true, price: 2, stock: 2, item: 'lamp_oil', stakes: '2 Silver. Stock: 2.' },
      { id: 'thread', label: 'Buy Silver Thread', shop: true, price: 4, stock: 2, item: 'thread', stakes: '4 Silver. Stock: 2.' },
      { id: 'chalk', label: 'Buy Ward Chalk', shop: true, price: 2, stock: 2, item: 'chalk', stakes: '2 Silver. Stock: 2.' },
      { id: 'snare', label: 'Buy a Hunter\'s Snare', shop: true, price: 3, stock: 2, item: 'snare', stakes: '3 Silver. Stock: 2.' },
      { id: 'haggle', label: 'Haggle, and ask about the road', stat: 'wit', dc: 11, once: 'player', hide: { flag: 'merchant_robbed' }, stakes: 'Fail: he charges a fee for the advice.',
        ok: { t: 'Pell tells you, with relish, which of his customers came back and in what condition. Two of them still owe him money.', reveal: ['loc:cabin', 'loc:orchard'], flag: 'pell_friend', xp: 1 },
        fail: { t: 'The advice is free. The listening costs.', silver: -1, rumor: true } },
      { id: 'steal', label: 'Lift something from the cart', stat: 'wit', dc: 13, once: 'party', stakes: 'Fail: Pell never forgets. Prices rise for the whole party.',
        ok: { t: 'A tonic, a salt, a coil of silver thread: quick as breath. Pell blinks and, for a moment, looks relieved to be robbed.', item: ['tonic', 'salt', 'thread'], flag: 'merchant_robbed', glory: 1 },
        fail: { t: 'A hand like wet leather closes on your wrist. "Customers pay." He lets you go. It will cost more now.', silver: -2, vit: -1, flag: 'merchant_robbed' } }
    ]
  };

  L.belltower = {
    id: 'belltower', name: 'Drowned Bell Tower', region: 'village', kind: 'lair', x: 380, y: 520, glyph: 'bell', scene: ['dusk', 'tower', 'water', 'fog'], occult: true,
    desc: 'The tower leans on its own reflection. There is no bell, only a rope that swings by itself, in time with something below the ground.',
    interiorDesc: 'Inside the belfry, an empty iron yoke hangs above a rope that moves without wind. A lantern lights the rotten beams. Something below keeps time.',
    enemy: 'bellkeeper', guard: 'bellkeeper', safe: false,
    options: [
      { id: 'maintenance', label: 'Use the maintenance entrance', show: { flag: 'opening_route' }, hide: { flag: 'opening_entered' }, once: 'party', stakes: '1 action. No roll. Follow the marked dry passage.',
        auto: { t: 'The maintenance passage leads safely beneath the flooded threshold.' } },
      { id: 'force_entry', label: 'Force the tower entrance', show: { flag: 'opening_active' }, hide: { flag: 'opening_entered' }, stat: 'might', dc: 11, once: 'party', stakes: '1 action. Failure costs 2 Health, but the door opens either way. A critical failure also advances the Clock.',
        ok: { t: 'The swollen door gives under your shoulder.' }, fail: { t: 'The rotten hinge tears free. You stumble inside over the broken wood.', vit: -2 } },
      { id: 'frame', label: 'Study the empty bell-frame', stat: 'wit', dc: 11, once: 'party', retry: 1, stakes: '1 action. Failure costs 1 Sanity and advances the Clock by 1. Critical failure adds another Clock tick.',
        ok: { t: 'The yoke is cast with a founder\'s mark and a dozen smaller marks: grave-markers, melted down. Every toll remembers someone.', clue: 'bell_cast', xp: 2 },
        fail: { t: 'The frame sings one low note. Far below, something turns over in its sleep.', san: -1, clock: 1 } },
      { id: 'climb', label: 'Climb to the belfry', stat: 'might', dc: 13, once: 'party', stakes: 'Fail: a rotten rung. Success reveals the surrounding land.',
        ok: { t: 'From the top you see the Hollow laid out like a plate of broken things: the Estate\'s black chimneys, the Woods\' dark collar, and far off, a single window that is lit.', reveal: ['loc:foyer', 'loc:forest', 'loc:nave', 'loc:warden'], xp: 1 },
        fail: { t: 'A rung gives way. You hang by one hand until the rope offers you a better idea.', vit: -3, noise: 1 } },
      { id: 'listen', label: 'Put your ear to the bell-mouth', stat: 'fate', dc: 12, spirit: true, once: 'player', stakes: 'Fail: it takes a word from you.',
        ok: { t: 'The bell-mouth is full of voices, saying the same thing at slightly different speeds. You catch one, and keep it.', hint: 'bellName', xp: 1 },
        fail: { t: 'You lose a word you have always known. You will notice in the morning.', san: -2, clock: 1 } }
    ]
  };

  L.graveyard = {
    id: 'graveyard', name: 'Graveyard', region: 'village', kind: 'grave', x: 215, y: 485, glyph: 'grave', scene: ['dusk', 'graves', 'fog', 'dead_trees'], enemy: 'carrion_swarm',
    desc: 'The headstones lean outward as though something pushed up from beneath. Every grave is empty and carefully tended.',
    options: [
      { id: 'headstones', label: 'Read the headstones', stat: 'wit', dc: 9, once: 'player', stakes: '1 action. Failure advances the Clock by 1. Critical failure adds another tick.',
        ok: { t: 'Names, birth years, and below each in a different hand: "voted yes", "voted no", "abstained". The last stone is blank except for a bell.', hint: 'heartName', xp: 1 },
        fail: { t: 'You lose your place among the dead. By the time you find it again, the light has gone.', clock: 1 } },
      { id: 'dig', label: 'Dig the oldest grave', stat: 'might', dc: 11, once: 'party', stakes: 'Fail: you wake what was put there, and it is wet.',
        ok: { t: 'A pilgrim\'s skull, carved as a cup and left in the soil like a seed.', item: 'bone_chalice', xp: 2 },
        crit: { t: 'And, under it, a leather purse of grave-silver.', silver: 4 },
        fail: { t: 'The soil heaves. A Drowned Pilgrim sits up, and has opinions about trespassing.', vit: -1, spawn: 'drowned_pilgrim' } },
      { id: 'commune', label: 'Commune with the dead', stat: 'fate', dc: 12, spirit: true, once: 'player', stakes: 'Fail: they remember you.',
        ok: { t: 'A voice from under the lawn gives its name, "Thea", and asks you to tell the Abbey she is sorry. It is the first time in the Hollow anyone has asked you for a kindness.', flag: 'thea_named', hint: 'heartName', xp: 2 },
        fail: { t: 'They all answer at once. You remember their names and nothing else for a while.', san: -2, clock: 1 } }
    ]
  };

  L.bridge = {
    id: 'bridge', name: 'Collapsing Bridge', region: 'village', kind: 'hazard', x: 500, y: 640, glyph: 'bridge', scene: ['dusk', 'bridge', 'water', 'fog'],
    desc: 'The span over the black river has been collapsing for forty years and has not finished. Each plank you cross is a decision made by the plank.',
    trap: { stat: 'might', dc: 12, vit: -2, t: 'Running, you put your weight on the wrong plank. The river takes your pace and some of your skin.' },
    options: [
      { id: 'reinforce', label: 'Reinforce the span', stat: 'wit', dc: 11, once: 'party', retry: 1, stakes: 'Success makes the bridge safe to sprint.',
        ok: { t: 'You wedge, lash and lie to the bridge until it holds. It sighs, and keeps holding.', flag: 'bridge_safe', xp: 1, glory: 1 },
        fail: { t: 'The planks groan at the lashing. Something below groans in response.', vit: -1, noise: 1 } },
      { id: 'under', label: 'Look under the bridge', stat: 'wit', dc: 12, once: 'party', stakes: 'Fail: the bank is slick.',
        ok: { t: 'A drowned lantern box wedged in the pilings. Dry inside: oil and a few coins left for the next ferryman.', item: 'lamp_oil', silver: 2, xp: 1 },
        fail: { t: 'You slip, and the river gets a good look at you.', vit: -2 } },
      { id: 'tollbox', label: 'Fish out the toll box', stat: 'might', dc: 10, once: 'party', stakes: 'Fail: the bridge protests.',
        ok: { t: 'Four silver coins and the smell of a hundred crossings.', silver: 4 },
        fail: { t: 'The bridge shivers. A plank you needed is gone.', vit: -1, flag: 'bridge_weak' } }
    ]
  };

  L.gate = {
    id: 'gate', name: 'The Escape Gate', region: 'village', kind: 'exit', x: 200, y: 770, glyph: 'gate', scene: ['dusk', 'gate', 'fog'],
    desc: 'Two stone posts, no wall. Beyond them the road is dry and lit by a moon this place does not have. The air between the posts is as thick as glass.',
    safe: false,
    options: [
      { id: 'leave', label: 'Walk through the Gate and leave the Hollow', show: { flag: 'gate_open' }, escape: true, confirm: 'You will leave the expedition for good. Your legacy is sealed; the others carry on without you.',
        stakes: 'Irreversible. Your expedition ends here.', auto: { t: 'You step between the posts. The air tears like wet silk, and you are standing on a road in the rain.' } },
      { id: 'study', label: 'Study the seal', stat: 'wit', dc: 14, once: 'party', retry: 1, hide: { flag: 'gate_open' }, stakes: 'Fail: the seal knows you looked.',
        ok: { t: 'A lattice of tiny lines, a lock cut in the air. You find where it is tired, and lean on it. The Gate opens. It does not look glad.', flag: 'gate_open', xp: 2, clue: 'pact_terms' },
        fail: { t: 'The seal turns to face you. The air tightens, and takes something.', san: -2, clock: 1 } },
      { id: 'force', label: 'Force the Gate', stat: 'might', dc: 17, once: 'party', retry: 1, hide: { flag: 'gate_open' }, stakes: 'Very hard. Fail: you are thrown back.',
        ok: { t: 'The air gives with a sound like a bone setting. The road beyond is yours.', flag: 'gate_open', xp: 2, glory: 1 },
        fail: { t: 'It throws you back as if you had insulted it.', vit: -3, noise: 1 } },
      { id: 'key', label: 'Turn the Spirit Key in the air', req: { item: 'spirit_key' }, once: 'party', hide: { flag: 'gate_open' }, stakes: 'Certain. Costs 1 Sanity.',
        auto: { t: 'The key finds a lock that was not there and the air parts around it.', san: -1, flag: 'gate_open', xp: 1 } }
    ]
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
