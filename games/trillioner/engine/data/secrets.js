/*
 * Hidden routes. A secret is a place or a condition. Finding it sets flags that reveal pads or open gates.
 *   look: how it appears in the world. overheard fires by walking near; auto fires when its gate passes; others need Hold E.
 *   spots: candidate places; the seed picks one. {room: siteId, dx, dz} is inside that site's room.
 *   clue: fixed text shown when found. shuffled secrets say something chosen by the seed instead.
 *   note: general knowledge for the notebook. It never records a place.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.TRD = root.TRD || {}).secrets = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NIGHT = { hours: [20, 5], why: 'You can only see this at night.' };
  var S = [
    // ── required chains ──
    { id: 'rooftop_light', chain: 'clock_tower', district: 'oldtown', name: 'A light on the roof', look: 'light', spots: [{ x: 8, y: 0, z: -186 }, { x: 36, y: 0, z: -186 }], gate: [NIGHT], clue: 'A lamp burns on the Tall Brick House roof. Nobody can climb that. A ladder truck could.', note: 'Some rooftops only show themselves after dark.' },
    { id: 'collectors_roof', chain: 'clock_tower', district: 'oldtown', name: "Collectors' Club", look: 'ladder', spots: [{ x: 22, y: 24.8, z: -200 }], gate: [{ vehicle: 'ladder_truck', why: 'You would need a very long ladder.' }], opens: ['collectors'], clue: 'A club on the roof, full of people who own one of everything.', note: 'The fire brigade can get you into places.' },
    { id: 'edition_grey', chain: 'mr_grey', district: 'oldtown', name: 'The Daily Receipt, late edition', look: 'auto', gate: [{ own: 'newspaper_biz' }], clue: 'Small ad, page 9: "Ask for Mr. Grey after 2AM."', note: 'Read the papers. Somebody is advertising.' },
    { id: 'laundromat_back', chain: 'mr_grey', district: 'oldtown', name: 'Back room of the laundromat', look: 'door', spots: [{ room: 'laundromat', dx: 12, dz: -3 }], gate: [{ flag: 's:edition_grey', why: 'A plain door. You have no reason to knock yet.' }, { hours: [2, 6], why: 'Locked. A note says: not before 2AM.' }], opens: ['under'], enter: 'under', clue: 'Mr. Grey opens the door. Behind him, stairs go down a long way.', note: 'The Under City exists.' },
    { id: 'lighthouse_logbook', chain: 'sunken_vault', district: 'harbour', name: "The keeper's logbook", look: 'book', spots: [{ room: 'lighthouse', dx: -6, dz: -2 }, { room: 'lighthouse', dx: 7, dz: -6 }], clue: 'Last entry: "Vault went down off the south-east point. Only a submarine will find it."', note: 'Keepers write things down.' },
    { id: 'sunken_vault', chain: 'sunken_vault', district: 'harbour', name: 'The sunken vault', look: 'vault', spots: [{ x: 342, y: -22, z: 340 }, { x: 330, y: -22, z: 318 }, { x: 345, y: -22, z: 300 }], gate: [{ vehicle: 'submarine', why: 'Too deep to reach.' }], opens: ['treasure_auction'], clue: 'Inside: auction papers. The treasure lots are now on sale by the aquarium.', note: 'There is treasure under the harbour.' },
    { id: 'asteroid', chain: 'asteroid', district: 'suburbs', name: 'The asteroid', look: 'telescope', spots: [{ room: 'observatory', dx: 0, dz: -6 }], gate: [{ own: 'observatory_biz', why: 'The telescope is coin-operated. The coin is the Observatory.' }, NIGHT], opens: ['spaceport'], clue: 'A bright rock crosses the sky. Mission Control would like a word.', note: 'Look up at night. Space is for sale.' },
    { id: 'corner_towers', chain: 'corner_towers', district: 'luxury', name: 'The four towers', look: 'auto', gate: [{ own: 'corner_nw' }, { own: 'corner_ne' }, { own: 'corner_sw' }, { own: 'corner_se' }], opens: ['globe_island'], clue: 'The deeds came with a map. A new island has appeared on the globe.', note: 'Matching things like to be owned together.' },
    { id: 'guest_gossip', chain: 'tuxedo', district: 'luxury', name: 'An overheard guest', look: 'overheard', spots: [{ x: 166, y: 0, z: -40 }, { x: 150, y: 0, z: -32 }], clue: '"Black tie at the Embassy, six sharp. The Pass changes hands at the party."', note: 'The rich talk loudly near embassies.' },
    { id: 'loud_trader', chain: 'broker', district: 'downtown', name: 'A loud trader', look: 'overheard', spots: [{ x: 60, y: 0, z: 24 }, { x: 88, y: 0, z: 24 }], clue: '"Licence? My guy works out of the alley behind the Exchange. No sign. Just go."', note: 'Traders are terrible at secrets.' },
    { id: 'broker_alley', chain: 'broker', district: 'downtown', name: 'The unmarked door', look: 'door', spots: [{ x: 96, y: 0, z: 66 }, { x: 110, y: 0, z: 66 }], opens: ['broker_shop'], clue: "Someone sells Broker's Licences here. Takeovers open on the Exchange floor, noon to 6PM.", note: 'Unmarked doors are worth a knock.' },
    { id: 'cityhall_notice', chain: 'lobbyist', district: 'downtown', name: 'A notice at City Hall', look: 'poster', spots: [{ room: 'city_hall', dx: -10, dz: -4 }, { room: 'city_hall', dx: 10, dz: -4 }], clue: 'NOTICE: All city projects require "friends". Friends keep an office out behind this building.', note: 'City Hall runs on friends.' },
    { id: 'lobby_door', chain: 'lobbyist', district: 'downtown', name: 'The Lobby Firm', look: 'door', spots: [{ x: -96, y: 0, z: 74 }, { x: -96, y: 0, z: 100 }], opens: ['lobby_shop'], clue: 'Thick carpet, no windows, many friends. The Lobby Firm is for sale.', note: 'Everything in this city is for sale, including the people who decide what is for sale.' },
    // ── more chains ──
    { id: 'ringing_booth', chain: 'phone', district: 'downtown', name: 'A ringing phone booth', look: 'phone', spots: [{ x: -14, y: 0, z: -40 }, { x: 14, y: 0, z: 40 }, { x: -40, y: 0, z: -14 }], opens: ['phone_shop'], clue: 'A voice says: "We own the wires. We are for sale. Top of Bank Street." It hangs up.', note: 'If a phone rings, answer it.' },
    { id: 'sewer_grate', chain: 'grate', district: 'downtown', name: 'A sewer grate', look: 'grate', spots: [{ x: 60, y: 0, z: 68 }, { x: 40, y: 0, z: 68 }], shuffled: 1, note: 'Sewers hold more than you would think.' },
    { id: 'gallery_door', chain: 'gallery', district: 'luxury', name: 'The painting that opens', look: 'painting', spots: [{ room: 'art_gallery', dx: 0, dz: -10 }, { room: 'art_gallery', dx: -14, dz: -8 }], opens: ['gallery_door'], clue: 'Behind the canvas, a smaller and far more expensive gallery.', note: 'Look behind the art.' },
    { id: 'valet_tip', chain: 'valet', district: 'luxury', name: 'A chatty valet', look: 'overheard', spots: [{ x: 310, y: 0, z: -40 }, { x: 290, y: 0, z: -40 }], shuffled: 1, note: 'Valets hear everything.' },
    { id: 'hedge_maze', chain: 'hedge', district: 'suburbs', name: 'The middle of the hedge maze', look: 'hedge', spots: [{ x: -330, y: 0, z: 88 }, { x: -300, y: 0, z: 100 }], opens: ['buried_safe'], clue: 'X marks a patch of dug-up lawn. A safe, buried badly.', note: 'Gardens hide things.' },
    { id: 'dawn_flyer', chain: 'garage', district: 'suburbs', name: 'A flyer on a lamp post', look: 'poster', spots: [{ x: -130, y: 0, z: 30 }, { x: -150, y: 0, z: 24 }], clue: 'GARAGE SALE. Dawn only. Everything must go, including the suspicious stuff.', note: 'Some deals are gone by breakfast.' },
    { id: 'odd_lights', chain: 'lights', district: 'suburbs', name: 'Odd lights in the city', look: 'auto', gate: [{ own: 'observatory_biz' }], clue: 'From up here, you can see lights where no lights should be. They are on your map now.', note: 'The Observatory sees more than stars.' },
    { id: 'factory_door', chain: 'factory', district: 'industrial', name: 'A locked factory door', look: 'door', spots: [{ x: 96, y: 0, z: 268 }], gate: [{ own: 'car_factory_biz', why: 'STAFF ONLY. The sign says the owner has the key.' }], opens: ['under'], enter: 'under', clue: 'A freight lift, going down much further than a factory should.', note: 'Factories have basements. Big ones.' },
    { id: 'rusted_crane', chain: 'crane', district: 'industrial', name: 'Top of the rusted crane', look: 'crate', spots: [{ x: -274, y: 28.6, z: 219 }], opens: ['crane_deal'], clue: 'A lunchbox full of bonds and a note: FOR SALE, IF YOU CAN GET UP HERE.', note: 'If it is hard to reach, go and reach it.' },
    { id: 'night_race', chain: 'race', district: 'industrial', name: 'The night race', look: 'door', spots: [{ room: 'race_pit', dx: 8, dz: -4 }], gate: [{ own: 'race_track', why: 'Owners only.' }, { hours: [21, 3], why: 'Racing starts at 9PM.' }], shuffled: 1, note: 'The track pays out in more than cash.' },
    { id: 'harbour_tunnel', chain: 'tunnel', district: 'harbour', name: 'A tunnel in the fog', look: 'door', spots: [{ x: 134, y: 0, z: 230 }], gate: [{ weather: 'fog', why: 'Rusty bars. When the fog comes in, the watchman leaves.' }], opens: ['under'], enter: 'under', clue: 'With the watchman gone, the old tunnel is open. It slopes down.', note: 'Fog changes the harbour.' },
    { id: 'fog_bell', chain: 'fog', district: 'harbour', name: 'The fog bell', look: 'poster', spots: [{ x: 200, y: 0, z: 136 }, { x: 240, y: 0, z: 136 }], clue: 'AUCTION HALL NOTICE: Bidding opens only when the fog bell rings.', note: 'Harbour auctions only run in fog.' },
    { id: 'hangar13_pad', chain: 'hangar', district: 'airport', name: 'Inside Hangar 13', look: 'crate', spots: [{ x: 322, y: 0, z: -304 }], gate: [{ vehicle: 'helicopter', why: 'The walls are 26 feet tall. No gate.' }], opens: ['hangar13'], clue: 'Crates, crates, crates, and a lot of paperwork marked HANGAR CITY.', note: 'Some places can only be reached from above.' },
    { id: 'radar_room', chain: 'radar', district: 'airport', name: 'The radar room', look: 'radar', spots: [{ room: 'control_tower', dx: 0, dz: -4 }], shuffled: 1, note: 'Control towers notice everything.' },
    { id: 'odd_locker', chain: 'jetpack', district: 'airport', name: 'A locker behind the fence', look: 'door', spots: [{ x: 134, y: 0, z: -330 }, { x: 150, y: 0, z: -326 }], opens: ['jetpack_shop'], clue: 'Marked TEST PILOTS. Inside, something with straps and nozzles.', note: 'Airports lose interesting things.' },
    { id: 'night_market_sign', chain: 'market', district: 'oldtown', name: 'Lanterns in the side street', look: 'poster', spots: [{ x: 60, y: 0, z: -228 }, { x: 40, y: 0, z: -228 }], clue: 'Chalked on the bricks: MARKET. 2 TO 4. BRING CASH.', note: 'Night markets sell rare lots.' },
    { id: 'club_knock', chain: 'club', district: 'oldtown', name: 'A door with a slot', look: 'door', spots: [{ x: -38, y: 0, z: -228 }, { x: -86, y: 0, z: -228 }], shuffled: 1, note: 'Private clubs keep private hours.' },
    { id: 'marked_wall', chain: 'deep', district: 'under', name: 'The marked wall', look: 'wall', spots: [{ x: 0, y: -60, z: -123 }], gate: [{ vehicle: 'mole_machine', why: 'A wall with red marks. You would need to dig.' }], opens: ['deep'], clue: 'The Mole Machine chews straight through. Beyond it, the deepest level.', note: 'The Under City has a basement.' },
    { id: 'grey_note', chain: 'greynote', district: 'under', name: 'A note on the platform', look: 'poster', spots: [{ x: -8, y: -60, z: 20 }, { x: 8, y: -60, z: 20 }], shuffled: 1, note: 'Mr. Grey sells hints. They are never the whole answer.' },
    { id: 'station_poster', chain: 'station', district: 'under', name: 'An old station poster', look: 'poster', spots: [{ x: -30, y: -60, z: 16 }, { x: 34, y: -60, z: 16 }], clue: 'NEXT TRAIN: NEVER. Gold-plated services by appointment.', note: 'The old subway still has one train left.' }
  ];

  // What a shuffled clue can say. The seed decides which spot says which.
  var HINTS = {
    sewer_grate: 'Scratched in the bricks: "Vault. South-east. Under the waves."',
    valet_tip: '"Gentleman tipped me to say: the four towers are a set. Set means something on the globe."',
    night_race: 'The prize envelope reads: "A wall with red marks, down below. Bring a machine."',
    radar_room: 'A blip keeps circling a walled hangar at the far corner. No road goes to it.',
    club_knock: 'A voice through the slot: "Try the lamp on the Tall Brick House, some dark night."',
    grey_note: 'The note says: "Everyone looks at the sky. Pay for the telescope first."',
    night_market: 'Someone wrote: "2AM, follow the lanterns."',
    phone: 'Someone wrote: "If a phone rings Downtown, pick it up."'
  };
  var HINT_POOL = ['Scratched in the bricks: "Vault. South-east. Under the waves."', '"The four towers are a set. Set means something on the globe."', '"A wall with red marks, down below. Bring a machine."', '"A blip keeps circling a walled hangar at the far corner."', '"Try the lamp on the Tall Brick House, some dark night."', '"Everyone looks at the sky. Pay for the telescope first."', '"2AM. Follow the lanterns in Old Town."', '"If a phone rings Downtown, pick it up."', '"When the fog comes, the watchman at the harbour tunnel goes home."'];

  var EDITIONS = [
    'Small ad, page 9: "Ask for Mr. Grey after 2AM."',
    'NOON EDITION: Exchange floor open. Rumour says the Lobby Firm is hiring friends behind City Hall.',
    'EVENING EDITION: Embassy party tonight at six. Tailors report a run on tuxedos.',
    'MORNING EDITION: Lighthouse keeper retires. Logbook "full of nonsense about a vault".',
    'NOON EDITION: Fog expected at the harbour. Auction Hall staff told to stay near the bell.',
    'EVENING EDITION: Astronomers at the Hilltop Observatory see "something big" after dark.'
  ];
  var CALLS = {
    bank: 'Your phone rings. "Congratulations on the bank. Have you tried the private train?" Click.',
    mint: 'Your phone rings. "The Mint. Bold. Some very rich people are never seen above ground." Click.',
    observatory_biz: 'Your phone rings. "Wait until dark before you look through that thing." Click.',
    newspaper_biz: 'Your phone rings. "Read page nine." Click.',
    fire_department: 'Your phone rings. "That ladder reaches a roof in Old Town. Just saying." Click.',
    boatyard_biz: 'Your phone rings. "Keepers keep logs. Try the lighthouse." Click.'
  };
  return { SECRETS: S, HINT_POOL: HINT_POOL, EDITIONS: EDITIONS, CALLS: CALLS };
});
