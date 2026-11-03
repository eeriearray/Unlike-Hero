/* The catalog as data. Each district bucket has an exact target; "fill" rows share what the fixed rows leave. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules.js'), require('./districts.js'), require('./businesses.js'));
  else (root.TRD = root.TRD || {}).items = factory(root.TRD.rules, root.TRD.districts, root.TRD.businesses);
})(typeof self !== 'undefined' ? self : this, function (R, D, Biz) {
  'use strict';
  var B = R.B, M = R.M;
  var LOBBY = { own: 'lobby_firm', why: 'City projects need friends: a Lobby Firm.' };
  var BROKER = { own: 'brokers_licence', why: "Takeovers need a Broker's Licence." };
  var EXCH = { hours: [12, 18], why: 'The Stock Exchange floor opens noon to 6PM.' };
  var PASS = { own: 'diplomatic_pass', why: 'Embassy Row needs a Diplomatic Pass.' };
  var SPACE = { flag: 'spaceport', why: 'Mission Control is waiting for a discovery from the Observatory.' };
  var FOG = { weather: 'fog', why: 'Harbour auctions only run in the fog.' };
  var TIMED = { window: 'dock_auction', why: 'The next timed dock auction has not started.' };
  var NIGHT = { hours: [2, 4], why: 'The Night Market opens 2AM to 4AM.' };
  var CLUB = { hours: [20, 2], why: 'Members only, 8PM to 2AM.' };
  var UNDER = 'under', RARE = 'rare';

  function b(id, name, price, site, icon, o) { return [id, name, price, Object.assign({ site: site, outside: 1, building: 1, required: 1, icon: icon }, o || {})]; }
  function room(id, name, price, site, icon, o) { return [id, name, price, Object.assign({ site: site, building: 1, required: 1, icon: icon }, o || {})]; }

  var CATALOG = {
    downtown: { prefix: 'dt', buckets: [
      { key: 'visible', target: 57 * B, site: 'plaza_shops',
        fixed: [
          b('corner_nw', 'Corner Tower NW', 12 * B, 'corner_nw', 'tower'), b('corner_ne', 'Corner Tower NE', 12 * B, 'corner_ne', 'tower'),
          b('corner_sw', 'Corner Tower SW', 12 * B, 'corner_sw', 'tower'), b('corner_se', 'Corner Tower SE', 12 * B, 'corner_se', 'tower')
        ],
        fill: [
          ['Gold-Plated Hot Dog Cart', 0.3], ['Bottomless Latte Subscription', 0.2], ['A Very Tall Hat', 0.1], ['Limited Edition Sneakers, All of Them', 0.5], ['Self-Tying Tie', 0.15], ['Executive Stapler', 0.1], ['Yacht-Shaped Paperweight', 0.15],
          ['Billboard of Your Own Face', 0.8, { site: 'tower_shops' }], ['Second Billboard, Bigger', 1, { site: 'tower_shops' }], ['Personal Rain Cloud', 0.3, { site: 'tower_shops' }], ['Monogrammed Pigeons', 0.2, { site: 'tower_shops' }],
          ['A Solid Gold Parking Meter', 0.5, { site: 'tower_shops' }], ['Lifetime Taxi Honking Rights', 0.3, { site: 'tower_shops' }], ['Lobby Waterfall', 0.5, { site: 'hotel' }], ['Room Service, Forever', 0.8, { site: 'hotel' }],
          ['The Good Towels', 0.2, { site: 'hotel' }], ['Minibar, Whole Warehouse', 0.6, { site: 'hotel' }], ['Bellhop Named After You', 0.2, { site: 'hotel' }], ['Vault Viewing Pass', 0.3, { site: 'bank' }], ['A Cheque Bigger Than a Bus', 0.4, { site: 'bank' }],
          ['Velvet Rope, Very Long', 0.2, { site: 'trillion_tower' }], ['An Elevator Just for Your Hat', 0.4, { site: 'trillion_tower' }]
        ] },
      { key: 'hours', target: 70 * B, site: 'exchange',
        fixed: [b('bank', 'Bank', 20 * B, 'bank', 'bank', { gate: [EXCH] }), b('mint', 'Mint', 40 * B, 'mint', 'coin', { gate: [EXCH] })],
        fill: [['Odd Lot of Railway Bonds', 3, { gate: [EXCH] }], ['Futures in Tomorrow', 2, { gate: [EXCH] }], ['Options on Soup', 2, { gate: [EXCH] }], ['Pork Belly Portrait', 1, { gate: [EXCH] }], ['Bell They Ring at the End', 2, { gate: [EXCH] }]] },
      { key: 'takeover', target: 135 * B, site: 'exchange',
        fixed: [
          room('soda_giant', 'Takeover: Soda Giant', 30 * B, 'exchange', 'can', { gate: [BROKER, EXCH] }), room('burger_empire', 'Takeover: Burger Empire', 15 * B, 'exchange', 'can', { gate: [BROKER, EXCH] }),
          room('streaming_service', 'Takeover: Streaming Service', 18 * B, 'exchange', 'can', { gate: [BROKER, EXCH] }), room('social_app', 'Takeover: Social App', 24 * B, 'exchange', 'can', { gate: [BROKER, EXCH] }),
          room('crypto_exchange', 'Takeover: Bankrupt Crypto Exchange', 8 * B, 'exchange', 'can', { gate: [BROKER, EXCH] })
        ],
        fill: [
          ['Takeover: Sock Monopoly', 6, { gate: [BROKER, EXCH] }], ['Takeover: Regional Mustard', 5, { gate: [BROKER, EXCH] }], ['Takeover: Office Plant Rental', 4, { gate: [BROKER, EXCH] }], ['Takeover: Bouncy Castle Holdings', 5, { gate: [BROKER, EXCH] }],
          ['Takeover: Beige Paint Inc.', 7, { gate: [BROKER, EXCH] }], ['Takeover: Umbrella Cartel', 6, { gate: [BROKER, EXCH] }], ['Takeover: Toaster Futures', 7, { gate: [BROKER, EXCH] }]
        ] },
      { key: 'projects', target: 58 * B, site: 'city_hall',
        fixed: [
          room('golden_metro', 'Golden Metro Station', 10 * B, 'city_hall', 'train', { gate: [LOBBY], project: 1 }), room('free_wifi', 'Free City Wi-Fi', 8 * B, 'city_hall', 'bolt', { gate: [LOBBY], project: 1 }),
          room('skyline_show', 'Skyline Light Show', 6 * B, 'city_hall', 'spark', { gate: [LOBBY], project: 1 })
        ],
        fill: [['Statue of a Better You', 4, { gate: [LOBBY] }], ['Street Named After Your Dog', 2, { gate: [LOBBY] }], ['Pedestrian Bridge to Nowhere', 5, { gate: [LOBBY] }], ['Heated Sidewalks', 8, { gate: [LOBBY] }], ['Plaza Big Enough to Echo', 7, { gate: [LOBBY] }], ['A Sixth Traffic Light Colour', 3, { gate: [LOBBY] }], ['Mayor for a Long Weekend', 5, { gate: [LOBBY] }]] },
      { key: 'secret', target: 40 * B, site: 'alley_shop',
        fixed: [
          room('phone_company', 'Phone Company', 30 * B, 'phone_co', 'phone', { outside: 1, secret: 'phone_shop' }),
          room('brokers_licence', "Broker's Licence", 1 * B, 'alley_shop', 'scroll', { secret: 'broker_shop', building: 0 }),
          room('lobby_firm', 'Lobby Firm', 3 * B, 'alley_shop', 'scroll', { secret: 'lobby_shop', building: 0 })
        ],
        fill: [['Counterfeit Pinstripes', 3, { secret: 'broker_shop' }], ['Insider Tip (It Is Soup)', 3, { secret: 'broker_shop' }]] }
    ] },
    luxury: { prefix: 'lx', buckets: [
      { key: 'visible', target: 59 * B, site: 'jewel_row',
        fixed: [
          b('grand_hotel_biz', 'Grand Hotel', 6 * B, 'grand_hotel', 'tower'), b('fashion_house_biz', 'Fashion House', 5 * B, 'fashion_house', 'hat'),
          ['diamond_fountain', 'Diamond Fountain', 1 * B, { site: 'tailor_row', required: 1, icon: 'gem' }],
          ['tuxedo', 'A Proper Tuxedo', 50 * M, { site: 'tailor_row', required: 1, wearable: 'tuxedo', icon: 'hat' }]
        ],
        fill: [
          ['Necklace That Needs Its Own Lift', 2.2], ['Ring You Cannot Lift Your Hand With', 1.6], ['Tiara for the Dog', 0.4], ['Watch That Tells You How Rich You Are', 1.4], ['Bracelet of Regret', 0.6], ['Earrings, Left Only', 0.3],
          ['Moonlight in a Jar', 0.8, { site: 'tailor_row' }], ['Silk Pyjamas for Business', 0.3, { site: 'tailor_row' }], ['A Monocle for Each Eye', 0.2, { site: 'tailor_row' }], ['Cashmere Shoelaces', 0.15, { site: 'tailor_row' }],
          ['Handbag With Its Own Handbag', 1.2, { site: 'dept_store' }], ['Every Perfume Ever', 1.3, { site: 'dept_store' }], ['The Whole Shoe Floor', 2.4, { site: 'dept_store' }], ['Coat Made of Other Coats', 0.8, { site: 'dept_store' }],
          ['Gloves for Gloves', 0.3, { site: 'dept_store' }], ['Sunglasses for Night', 0.4, { site: 'dept_store' }], ['Scarf, One Mile', 0.5, { site: 'dept_store' }], ['Hat Stand Staff', 0.3, { site: 'dept_store' }], ['Mannequin Who Listens', 0.5, { site: 'dept_store' }],
          ['Blank Canvas, Very Serious', 3.4, { site: 'art_gallery' }], ['Banana on a Wall, Original', 2.2, { site: 'art_gallery' }], ['Portrait of a Lobby', 2.8, { site: 'art_gallery' }], ['Small Sad Clown', 1.6, { site: 'art_gallery' }], ['Large Happy Clown', 3, { site: 'art_gallery' }], ['Sculpture of a Tax Form', 2, { site: 'art_gallery' }],
          ['Marble Bath the Size of a Pool', 1.2, { site: 'grand_hotel' }], ['Pillow Menu, All Options', 0.3, { site: 'grand_hotel' }], ['Chandelier, Spare', 0.6, { site: 'grand_hotel' }], ['Valet Who Knows Your Name', 0.3, { site: 'grand_hotel' }]
        ] },
      { key: 'secret', target: 3 * B, site: 'art_gallery',
        fixed: [],
        fill: [['The Painting Behind the Painting', 2, { secret: 'gallery_door' }], ['Door Hidden in a Portrait', 1, { secret: 'gallery_door' }]] },
      { key: 'embassy', target: 198 * B, site: 'global_trade',
        fixed: [
          ['diplomatic_pass', 'Diplomatic Pass', 2 * B, { site: 'embassy', required: 1, power: 'diplomat', gate: [{ wear: 'tuxedo', why: 'The party is black tie. Find a tuxedo.' }, { hours: [18, 20], why: 'The embassy party starts at 6PM.' }], icon: 'scroll' }],
          ['scottish_castle', 'Scottish Castle', 1 * B, { site: 'embassy', required: 1, gate: [PASS], icon: 'tower' }],
          ['alpine_ski', 'Alpine Ski Region', 12 * B, { site: 'embassy', required: 1, gate: [PASS], icon: 'land' }],
          ['pacific_islands', 'Pacific Island Chain', 18 * B, { required: 1, gate: [PASS], icon: 'land' }],
          ['saharan_solar', 'Saharan Solar Field', 25 * B, { required: 1, gate: [PASS], icon: 'land' }],
          ['private_island', 'Private Island', 7 * B, { secret: 'globe_island', gate: [PASS], icon: 'land' }]
        ],
        fill: [
          ['Andean Copper Mine', 11, { gate: [PASS] }], ['Baltic Amber Mine', 5, { gate: [PASS] }], ['Canadian Wheat Province', 12, { gate: [PASS] }], ['Argentine Cattle Plains', 10, { gate: [PASS] }], ['Icelandic Geysers (Hot)', 7, { gate: [PASS] }],
          ['Greenland, the Nice Bit', 13, { gate: [PASS] }], ['Tuscan Hill, With Sunset', 6, { gate: [PASS] }], ['Norwegian Fjord, Echo Included', 9, { gate: [PASS] }], ['Bavarian Forest', 5, { gate: [PASS] }], ['Patagonian Wind Farm', 8, { gate: [PASS] }],
          ['Kenyan Tea Estate', 4, { gate: [PASS], site: 'embassy' }], ['Mediterranean Cove', 8, { gate: [PASS], site: 'embassy' }], ['Polar Bear Hotel (Bears Not Consulted)', 5, { gate: [PASS], site: 'embassy' }], ['Danish Bridge Rights', 4, { gate: [PASS], site: 'embassy' }], ['Vineyard That Only Makes Vinegar', 3, { gate: [PASS], site: 'embassy' }]
        ] }
    ] },
    suburbs: { prefix: 'sb', buckets: [
      { key: 'visible', target: 147 * B, site: 'estate_agents',
        fixed: [
          b('wonderland_park', 'Wonderland Park', 25 * B, 'wonderland', 'flag'), b('zoo_biz', 'Zoo', 5 * B, 'zoo', 'paw'), b('pizza_chain', 'Pizza Chain', 3 * B, 'pizza_hq', 'can'),
          b('skate_shop_biz', 'Skate Shop', 1 * B, 'skate_shop', 'board'), b('school_biz', 'School', 1 * B, 'school', 'tower'), b('observatory_biz', 'Observatory', 2 * B, 'observatory', 'star'),
          ['mansion_a', 'Mansion: Modest', 0.2 * B, { required: 1, icon: 'house' }], ['mansion_b', 'Mansion: Less Modest', 0.4 * B, { required: 1, icon: 'house' }], ['mansion_c', 'Mansion: Two Pools', 0.6 * B, { required: 1, icon: 'house' }], ['mansion_d', 'Mansion: Own Weather', 1 * B, { required: 1, icon: 'house' }],
          ['hood_maple', 'Whole Neighbourhood: Maple Close', 3 * B, { site: 'block_sales', required: 1, icon: 'house' }], ['hood_oak', 'Whole Neighbourhood: Oak Drive', 5 * B, { site: 'block_sales', required: 1, icon: 'house' }], ['hood_pine', 'Whole Neighbourhood: Pine Court', 8 * B, { site: 'block_sales', required: 1, icon: 'house' }],
          ['zoo_lion', 'Zoo Animal: The Lion', 0.3 * B, { site: 'zoo', icon: 'paw' }], ['zoo_penguin', 'Zoo Animal: All the Penguins', 0.25 * B, { site: 'zoo', icon: 'paw' }], ['zoo_giraffe', 'Zoo Animal: Tall Gerald', 0.25 * B, { site: 'zoo', icon: 'paw' }], ['zoo_otter', 'Zoo Animal: An Otter Just for You', 0.2 * B, { site: 'zoo', icon: 'paw' }]
        ],
        fill: [
          ['Whole Neighbourhood: Elm Crescent', 6, { site: 'block_sales' }], ['Whole Neighbourhood: Birch Lane', 4, { site: 'block_sales' }], ['Whole Neighbourhood: Willow Way', 7, { site: 'block_sales' }], ['Whole Neighbourhood: Cherry Hill', 5, { site: 'block_sales' }],
          ['Mansion: Second Moat', 2], ['Mansion: Indoor Beach', 3], ['Mansion: The Wing for Guests You Dislike', 2], ['Mansion: Bowling Alley Basement', 2],
          ['Every Lawn Gnome', 0.5, { site: 'mansion' }], ['Swimming Pool Shaped Like You', 1, { site: 'mansion' }], ['Butler Who Judges', 0.5, { site: 'mansion' }], ['Garden Maze, Medium', 1, { site: 'mansion' }], ['Ride-On Mower, Gold', 0.5, { site: 'mansion' }], ['Doorbell With an Orchestra', 0.6, { site: 'mansion' }],
          ['School Library, All Books', 1.2, { site: 'school' }], ['Permanent Snow Day', 2, { site: 'school' }], ['Cafeteria Chef Upgrade', 1, { site: 'school' }], ['New Mascot (It Is You)', 0.5, { site: 'school' }],
          ['Pizza the Size of a Roundabout', 2, { site: 'pizza_hq' }], ['Secret Sauce Recipe', 3, { site: 'pizza_hq' }], ['Pepperoni Silo', 2.4, { site: 'pizza_hq' }], ['Delivery Drone Flock', 3, { site: 'pizza_hq' }],
          ['Candyfloss Pipeline', 3, { site: 'wonderland' }], ['New Teacups, Less Sick', 3, { site: 'wonderland' }], ['Ferris Wheel Repair Fund', 5, { site: 'wonderland' }], ['Mascot Suit That Fits', 1, { site: 'wonderland' }], ['Haunted House, Actually Haunted', 4, { site: 'wonderland' }]
        ] },
      { key: 'secret', target: 3 * B, site: 'garage_sale',
        fixed: [],
        fill: [['Rare Comic in a Shoebox', 1, { gate: [{ hours: [6, 8], why: 'Garage sale: dawn only.' }] }], ["Grandpa's Mystery Key", 0.5, { gate: [{ hours: [6, 8], why: 'Garage sale: dawn only.' }] }], ['Gold Bars, Slightly Muddy', 1, { site: 'buried_safe', secret: 'buried_safe' }], ['A Map to Another Map', 0.5, { site: 'buried_safe', secret: 'buried_safe' }]] },
      { key: 'lobby', target: 50 * B, site: 'park_lots',
        fixed: [
          b('stadium_biz', 'Stadium', 15 * B, 'stadium', 'flag', { gate: [LOBBY], project: 1 }),
          ['park_a', 'Public Park: Duck Pond', 4 * B, { required: 1, gate: [LOBBY], building: 1, icon: 'land' }], ['park_b', 'Public Park: Kite Hill', 4 * B, { required: 1, gate: [LOBBY], building: 1, icon: 'land' }], ['park_c', 'Public Park: Good Bench Green', 4 * B, { required: 1, gate: [LOBBY], building: 1, icon: 'land' }]
        ],
        fill: [['Public Park: Enormous Sandpit', 6, { gate: [LOBBY] }], ['Bike Lane to the Moon (Phase One)', 5, { gate: [LOBBY] }], ['Free Ice Cream Tuesdays', 7, { gate: [LOBBY] }], ['Suburban Monorail', 5, { gate: [LOBBY] }]] }
    ] },
    industrial: { prefix: 'ind', buckets: [
      { key: 'visible', target: 88 * B, site: 'parts_row',
        fixed: [
          b('car_dealership', 'Car Dealership', 4 * B, 'dealership', 'car'), b('race_track', 'Race Track', 6 * B, 'race_pit', 'flag'), b('car_factory_biz', 'Car Factory', 18 * B, 'car_factory', 'gear'),
          b('fireworks_factory', 'Fireworks Factory', 2 * B, 'fireworks', 'spark'), b('demolition_company', 'Demolition Company', 10 * B, 'demolition_co', 'bomb'), b('scrapyard_biz', 'Scrapyard', 1 * B, 'scrapyard', 'wrench'),
          b('steel_mill_biz', 'Failing Steel Mill', 9 * B, 'steel_mill', 'gear')
        ],
        fill: [
          ['A Parking Lot Full of Convertibles', 6, { site: 'dealership' }], ['Every Colour of Hatchback', 4, { site: 'dealership' }], ['Car with Eleven Cupholders', 1, { site: 'dealership' }], ['Limo Long Enough to Need a Bus Stop', 3, { site: 'dealership' }],
          ['A Thousand Pine Tree Air Fresheners', 0.15], ['Fuzzy Dice, Bulk Pallet', 0.1], ['Solid Gold Spark Plugs', 0.5], ['Racing Stripes for a Building', 0.4],
          ['Tyre Mountain', 0.8, { site: 'tyre_yard' }], ['The Good Jack', 0.12, { site: 'tyre_yard' }], ['Inflatable Tube Man Army', 0.6, { site: 'tyre_yard' }], ['Chrome-Plated Forklift', 0.3, { site: 'tyre_yard' }], ['A Very Long Extension Cord', 0.2, { site: 'tyre_yard' }],
          ['Freight Train, No Questions Asked', 5, { site: 'freight_row' }], ['Warehouse of Unopened Boxes', 3, { site: 'freight_row' }], ['Warehouse of Slightly Opened Boxes', 2, { site: 'freight_row' }], ['A Crane for Your Other Crane', 3, { site: 'freight_row' }], ['Container of Left Shoes', 0.5, { site: 'freight_row' }], ['Pallet of Bubble Wrap (Unpopped)', 0.25, { site: 'freight_row' }],
          ['Assembly Line That Only Makes Horns', 2, { site: 'car_factory' }], ['Robot Arm with Good Manners', 1, { site: 'car_factory' }], ['Spare Chassis Collection', 2, { site: 'car_factory' }], ['Paint Shop Stuck on Teal', 1, { site: 'car_factory' }],
          ['Crushed-Car Cube Sculpture', 0.3, { site: 'scrapyard' }], ['Magnet the Size of a Bus', 0.8, { site: 'scrapyard' }], ['Guard Dog (Very Friendly)', 0.1, { site: 'scrapyard' }],
          ['Pit Crew for Your Shopping Cart', 0.4, { site: 'race_pit' }], ['Grandstand Naming Rights', 1.2, { site: 'race_pit' }], ['Chequered Flag Factory Outlet', 0.5, { site: 'race_pit' }],
          ['Rust by the Tonne', 0.5, { site: 'steel_mill' }], ['Ingots Shaped Like Your Face', 1, { site: 'steel_mill' }]
        ] },
      { key: 'secret', target: 2 * B, site: 'crane_deal',
        fixed: [],
        fill: [['Crane Operator Lunchbox (Full of Bonds)', 1, { secret: 'crane_deal' }], ['A Very Rusty Bolt, Priceless', 1, { secret: 'crane_deal' }]] },
      { key: 'lobby', target: 70 * B, site: 'lobby_lots_ind',
        fixed: [
          b('power_station_biz', 'Power Station', 20 * B, 'power_station', 'bolt', { gate: [LOBBY], project: 1 }),
          ['harbour_bridge', 'Harbour Bridge', 12 * B, { building: 1, required: 1, gate: [LOBBY], icon: 'bridge', project: 1 }],
          ['metro_line', 'New Metro Line', 15 * B, { building: 1, required: 1, gate: [LOBBY], icon: 'train', project: 1 }]
        ],
        fill: [['Freight Rail Expansion', 6, { gate: [LOBBY] }], ['An Unnecessary Overpass', 5, { gate: [LOBBY] }], ['Industrial Park with an Actual Park', 4, { gate: [LOBBY] }], ['Rezoned Puddle', 1, { gate: [LOBBY] }], ['Second Giant Chimney, for Symmetry', 4, { gate: [LOBBY] }], ['Road Cones, All of Them', 3, { gate: [LOBBY] }]] }
    ] },
    harbour: { prefix: 'hb', buckets: [
      { key: 'visible', target: 12 * B, site: 'pier_stalls',
        fixed: [b('boatyard_biz', 'Boatyard', 8 * B, 'boatyard', 'boat'), b('lighthouse_biz', 'Lighthouse', 0.5 * B, 'lighthouse', 'tower'), b('aquarium_biz', 'Aquarium', 3 * B, 'aquarium', 'fish')],
        fill: [['Bucket of Prawns', 0.04], ['Fish and Chips, All Of It', 0.08], ['Pet Seagull', 0.03], ['Sailor Hat, Authentic Smell', 0.05], ['Message in a Bottle (Blank)', 0.06], ['Tide Timetable, Signed', 0.03], ['Octopus With a Name', 0.1, { site: 'aquarium' }], ['Shark Tank Tour', 0.1, { site: 'aquarium' }], ['Glass-Bottom Bath', 0.01, { site: 'aquarium' }]] },
      { key: 'fog', target: 60 * B, site: 'auction_hall',
        fixed: [
          room('cruise_line', 'Cruise Line', 14 * B, 'auction_hall', 'boat', { gate: [FOG] }), room('container_port', 'Container Port', 25 * B, 'auction_hall', 'boat', { gate: [FOG] }), room('yacht_fleet', 'Yacht Fleet', 4 * B, 'auction_hall', 'boat', { gate: [FOG] })
        ],
        fill: [['Ghost Ship, Mostly Empty', 3, { gate: [FOG] }], ['Foghorn That Plays Jazz', 1, { gate: [FOG] }], ['Salvage Rights to Atlantis', 5, { gate: [FOG] }], ['Pirate Flag Collection', 1, { gate: [FOG] }], ['A Lost Ferry', 2, { gate: [FOG] }], ['Anchor Made of Rubies', 2, { gate: [FOG] }], ['Fog Machine, Industrial', 3, { gate: [FOG], site: 'cruise_terminal' }]] },
      { key: 'timed', target: 20 * B, site: 'dock_lots',
        fixed: [],
        fill: [['Timed Lot: Ship in a Very Large Bottle', 4, { gate: [TIMED] }], ['Timed Lot: Lifeboat Fleet', 3, { gate: [TIMED] }], ['Timed Lot: The Pier Next Door', 4, { gate: [TIMED] }], ['Timed Lot: A Tugboat with Ambition', 2, { gate: [TIMED] }], ['Timed Lot: Harbour Master Hat', 2, { gate: [TIMED] }], ['Timed Lot: Rights to the Tide', 5, { gate: [TIMED] }]] },
      { key: 'treasure', target: 28 * B, site: 'vault_lots',
        fixed: [
          ['treasure_a', 'Treasure Lot: Admiral Chest', 2 * B, { required: 1, secret: 'treasure_auction', icon: 'gem' }], ['treasure_b', 'Treasure Lot: Crown of Barnacles', 3 * B, { required: 1, secret: 'treasure_auction', icon: 'gem' }],
          ['treasure_c', 'Treasure Lot: Sunken Mint', 5 * B, { required: 1, secret: 'treasure_auction', icon: 'gem' }], ['treasure_d', 'Treasure Lot: Pearl Mountain', 8 * B, { required: 1, secret: 'treasure_auction', icon: 'gem' }]
        ],
        fill: [['Treasure Lot: Doubloon Lake', 6, { secret: 'treasure_auction' }], ['Treasure Lot: Mermaid IOU', 4, { secret: 'treasure_auction' }]] }
    ] },
    airport: { prefix: 'ap', buckets: [
      { key: 'visible', target: 60 * B, site: 'airport_deals',
        fixed: [
          ['airline', 'Airline', 35 * B, { site: 'terminal', outside: 1, building: 1, required: 1, icon: 'plane' }], ['helicopter_company', 'Helicopter Company', 15 * B, { site: 'airport_deals', required: 1, building: 1, icon: 'plane' }],
          ['jet_fleet', 'Jet Fleet', 8 * B, { site: 'airport_deals', required: 1, building: 1, icon: 'plane' }]
        ],
        fill: [['First Class Seat, Just the Seat', 0.2, { site: 'terminal' }], ['Duty Free, The Whole Aisle', 0.5, { site: 'terminal' }], ['Neck Pillow Dynasty', 0.1, { site: 'terminal' }], ['Baggage Carousel Ride Pass', 0.12, { site: 'terminal' }], ['Boarding Group Zero', 0.2, { site: 'terminal' }], ['Airport Sandwich, Reasonable Price', 0.3, { site: 'terminal' }], ['Runway Red Carpet', 0.1], ['Windsock Monogrammed', 0.04], ['Control Tower Coffee Mug', 0.04, { site: 'control_tower' }], ['Air Traffic Controller Friendship', 0.1, { site: 'control_tower' }], ['Lost Luggage, Every Bag', 0.1, { site: 'terminal' }], ['Tiny Pretzel Bag Monopoly', 0.05, { site: 'terminal' }], ['Radar Screen for the Lounge', 0.05, { site: 'control_tower' }], ['Paper Plane, Signed', 0.03]] },
      { key: 'hidden', target: 10 * B, site: 'hangar_13',
        fixed: [
          ['hangar_city', 'Hangar City', 3 * B, { required: 1, secret: 'hangar13', building: 1, icon: 'plane' }], ['jetpack', 'Personal Jetpack', 3 * B, { site: 'jetpack_shop', required: 1, secret: 'jetpack_shop', reward: { vehicles: ['jetpack'] }, icon: 'plane' }]
        ],
        fill: [['Crate Marked Do Not Open', 1.5, { secret: 'hangar13' }], ['Crate Marked Definitely Open', 1, { secret: 'hangar13' }], ['Alien Autopsy Outtakes', 1.5, { secret: 'hangar13' }], ['Weather Balloon, Definitely', 0.5, { secret: 'hangar13' }]] },
      { key: 'space', target: 50 * B, site: 'mission_control',
        fixed: [
          room('rocket', 'Rocket', 12 * B, 'mission_control', 'rocket', { gate: [SPACE], building: 1 }), ['moon_land', 'Moon Land', 10 * B, { required: 1, gate: [SPACE], icon: 'land' }],
          room('asteroid_mining', 'Asteroid Mining', 20 * B, 'mission_control', 'rocket', { gate: [SPACE] }), room('mars_hotel', 'Mars Hotel', 5 * B, 'mission_control', 'rocket', { gate: [SPACE] })
        ],
        fill: [['Orbit Slot, Slightly Wobbly', 0.8, { gate: [SPACE] }], ['Astronaut Ice Cream Plant', 0.8, { gate: [SPACE] }], ['Spare Satellite', 0.7, { gate: [SPACE] }], ['Launch Countdown Voice', 0.3, { gate: [SPACE] }], ['Space Suit, Formal', 0.4, { gate: [SPACE] }]] }
    ] },
    oldtown: { prefix: 'ot', buckets: [
      { key: 'visible', target: 17 * B, site: 'antique_row',
        fixed: [
          b('fire_department', 'Fire Department', 6 * B, 'fire_station', 'fire'), b('newspaper_biz', 'Newspaper', 5 * B, 'newspaper', 'scroll'), b('museum_biz', 'Museum', 4 * B, 'museum', 'tower'),
          b('theatre_biz', 'Theatre', 1 * B, 'theatre', 'hat'), b('laundromat', 'Laundromat', 10 * M, 'laundromat', 'house')
        ],
        fill: [['Slightly Haunted Armchair', 0.2], ['Mirror That Compliments You', 0.2], ['Grandfather Clock, Plus Grandfather', 0.15], ['Printing Press Ink Bath', 0.1, { site: 'newspaper' }], ['Front Page Forever', 0.15, { site: 'newspaper' }], ['Dinosaur, Assorted Bones', 0.12, { site: 'museum' }], ['Dalmatian Pension Fund', 0.03, { site: 'fire_station' }], ['Velvet Seats, Front Row', 0.02, { site: 'theatre' }]] },
      { key: 'club', target: 20 * B, site: 'collectors_club',
        fixed: [],
        fill: [['Stamp Nobody Has Seen', 3, { secret: 'collectors' }], ['Coin From a Country You Made Up', 3, { secret: 'collectors' }], ['First Edition of a Phone Book', 2, { secret: 'collectors' }], ['The Original Rubber Band', 2, { secret: 'collectors' }], ['Teapot, Once Owned by a Duke', 3, { secret: 'collectors' }], ['Very Old Sandwich', 2, { secret: 'collectors' }], ['Portrait of a Stranger Who Looks Like You', 5, { secret: 'collectors' }]] },
      { key: 'market', target: 15 * B, site: 'night_market',
        fixed: [],
        fill: [['Bottled Midnight', 1, { gate: [NIGHT] }], ['Second-Hand Comet Tail', 3, { gate: [NIGHT] }], ['A Dragon Egg, They Swear', 2, { gate: [NIGHT] }], ['Lantern That Knows Things', 1, { gate: [NIGHT] }], ['Bag of Lucky Teeth', 0.5, { gate: [NIGHT] }], ['Map of Yesterday', 1.5, { gate: [NIGHT] }], ['Moon Dust, Probably Flour', 2, { gate: [NIGHT] }], ['Ghost Pepper Ghost', 1, { gate: [NIGHT] }], ['Stolen Bell from the Clock Tower', 3, { gate: [NIGHT] }]] },
      { key: 'private', target: 8 * B, site: 'private_club',
        fixed: [],
        fill: [['Lifetime Membership, Backdated', 3, { gate: [CLUB] }], ['Leather Chair With Opinions', 1, { gate: [CLUB] }], ['Secret Handshake, Patented', 2, { gate: [CLUB] }], ['A Very Old Cigar', 1, { gate: [CLUB] }], ['The Good Corner Table', 1, { gate: [CLUB] }]] }
    ] },
    under: { prefix: 'uc', buckets: [
      { key: 'visible', target: 100 * B, site: 'bazaar',
        fixed: [
          ['gold_train', 'Gold Train', 10 * B, { site: 'under_station', outside: 1, building: 1, required: 1, gate: [{ flag: UNDER, why: 'Find a way down.' }], secret: UNDER, icon: 'train' }],
          ['secret_casino_biz', 'Secret Casino', 15 * B, { site: 'secret_casino', outside: 1, building: 1, required: 1, secret: UNDER, icon: 'coin' }],
          ['vault_oddities_biz', 'Vault of Oddities', 6 * B, { site: 'vault_oddities', outside: 1, building: 1, required: 1, secret: UNDER, icon: 'gem' }],
          ['lake_resort_biz', 'Underground Lake Resort', 9 * B, { site: 'lake_resort', outside: 1, building: 1, required: 1, secret: UNDER, icon: 'fish' }],
          ['mole_machine', 'Mole Machine', 8 * B, { site: 'under_station', required: 1, secret: UNDER, icon: 'wrench' }],
          ['hint_grey_a', "Mr. Grey's Hint: Fog", 2 * B, { site: 'grey_corner', secret: UNDER, hint: 'Grey taps the window. "Some doors in the harbour only open when you cannot see them."', kind: 'hint' }],
          ['hint_grey_b', "Mr. Grey's Hint: Towers", 4 * B, { site: 'grey_corner', secret: UNDER, hint: 'Grey counts on his fingers. "Four of a kind makes the world bigger. Ask the globe."', kind: 'hint' }],
          ['hint_grey_c', "Mr. Grey's Hint: Sky", 6 * B, { site: 'grey_corner', secret: UNDER, hint: 'Grey looks up. "They built one hangar nobody can walk to. Odd, that."', kind: 'hint' }],
          ['hint_grey_d', "Mr. Grey's Hint: Deep", 10 * B, { site: 'grey_corner', secret: UNDER, hint: 'Grey whispers. "Those marked walls down here? A machine could do something about those."', kind: 'hint' }]
        ],
        fill: [
          ['Bazaar Stall: Glow Mushrooms, Sack', 1, { secret: UNDER }], ['Bazaar Stall: Bat Saddle', 0.5, { secret: UNDER }], ['Bazaar Stall: Mole Rat Sweater', 0.4, { secret: UNDER }], ['Bazaar Stall: Echo in a Box', 0.6, { secret: UNDER }], ['Bazaar Stall: Stolen Street Sign', 0.3, { secret: UNDER }], ['Bazaar Stall: Purple Soup', 0.2, { secret: UNDER }], ['Bazaar Stall: Crystal Doorknob', 0.5, { secret: UNDER }],
          ['Bulk Lot: 900 Cave Lanterns', 2, { site: 'bulk_stalls', secret: UNDER }], ['Bulk Lot: Subway Tokens, All', 3, { site: 'bulk_stalls', secret: UNDER }], ['Bulk Lot: Forgotten Umbrellas', 1, { site: 'bulk_stalls', secret: UNDER }], ['Bulk Lot: Rat King Regalia', 2, { site: 'bulk_stalls', secret: UNDER }], ['Bulk Lot: Stalactite Assortment', 1.5, { site: 'bulk_stalls', secret: UNDER }], ['Bulk Lot: Hard Hats With Feathers', 1, { site: 'bulk_stalls', secret: UNDER }],
          ['Loaded Dice, Very Loaded', 1, { site: 'secret_casino', secret: UNDER }], ['Chandelier Made of Chips', 1.5, { site: 'secret_casino', secret: UNDER }], ['The Table Where You Always Lose', 1, { site: 'secret_casino', secret: UNDER }],
          ['Cursed Spoon', 0.5, { site: 'vault_oddities', secret: UNDER }], ['Two-Headed Coin', 0.5, { site: 'vault_oddities', secret: UNDER }], ['Jar of Other Jars', 0.5, { site: 'vault_oddities', secret: UNDER }], ['Lake Monster Lease', 1.5, { site: 'lake_resort', secret: UNDER }], ['Pedal Boat, Gold', 0.8, { site: 'lake_resort', secret: UNDER }], ['Sauna in a Geode', 1, { site: 'lake_resort', secret: UNDER }]
        ] },
      { key: 'deep', target: 20 * B, site: 'deep_level',
        fixed: [],
        fill: [['Deep Lot: Core Sample of the Planet', 6, { secret: 'deep' }], ['Deep Lot: Fossil of a Bad Idea', 3, { secret: 'deep' }], ['Deep Lot: Lost City Parking Rights', 5, { secret: 'deep' }], ['Deep Lot: Warm Rock', 1, { secret: 'deep' }], ['Deep Lot: Gold Vein, Sliced', 5, { secret: 'deep' }]] }
    ] }
  };

  var CHANGE_STOCK = [4, 4, 3, 4, 9, 9, 9, 10];
  var CHANGE_NAMES = ['Gumball', 'Pretzel', 'Lucky Wish', 'Hot Lunch', 'Vending Feast', 'Fountain Wish', 'Golden Wish', 'Wish of the Century'];

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 44); }

  /** Expands the tables into a flat item list with exact prices. Pure; shuffle.js works on a copy. */
  function build() {
    var out = [];
    Object.keys(CATALOG).forEach(function (did) {
      var cat = CATALOG[did];
      cat.buckets.forEach(function (bk, bi) {
        var used = 0, rows = [];
        bk.fixed.forEach(function (r) {
          var it = mk(r[0], r[1], r[2], r[3] || {}, did, bk);
          rows.push(it); used += it.price * it.stock;
        });
        if (bi === 0) {
          R.CHANGE_FEES.forEach(function (fee, i) {
            var it = mk(cat.prefix + '_change_' + i, CHANGE_NAMES[i], fee, { site: did + '_change', stock: CHANGE_STOCK[i], kind: 'change', icon: 'coin', secret: did === 'under' ? UNDER : null }, did, bk);
            rows.push(it); used += it.price * it.stock;
          });
        }
        var pool = bk.target - used, left = pool, wsum = 0;
        bk.fill.forEach(function (f) { wsum += f[1]; });
        var fills = [];
        bk.fill.forEach(function (f, i) {
          var price = i === bk.fill.length - 1 ? left : Math.max(1 * M, Math.round((pool * f[1] / wsum) / (5 * M)) * (5 * M));
          if (i !== bk.fill.length - 1) left -= price;
          fills.push(mk(cat.prefix + '_' + slug(f[0]), f[0], price, Object.assign({ flex: 1 }, f[2] || {}), did, bk));
        });
        if (bk.fill.length && left <= 0) throw new Error('Bucket overflow: ' + did + '/' + bk.key + ' left ' + left);
        if (!bk.fill.length && pool !== 0) throw new Error('Bucket misses target: ' + did + '/' + bk.key);
        out.push.apply(out, rows); out.push.apply(out, fills);
      });
    });
    return out;
  }

  function mk(id, name, price, o, did, bk) {
    var biz = Biz[id] || {};
    return {
      id: id, name: name, price: Math.round(price), district: did, bucket: bk.key, site: o.site || bk.site,
      stock: o.stock || 1, kind: o.kind || (o.building ? 'biz' : 'good'), icon: o.icon || null, building: !!o.building, outside: !!o.outside,
      required: !!o.required, flex: !!o.flex, gate: o.gate || null, secret: o.secret || null, grants: o.grants || null, wearable: o.wearable || null,
      income: biz.income || 0, reward: biz.reward || o.reward || null, power: biz.power || o.power || null, nature: biz.nature || null,
      project: !!o.project, hint: o.hint || null, pos: o.pos || null
    };
  }

  return { CATALOG: CATALOG, build: build };
});
