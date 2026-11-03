# Trillioner: design

The source of truth is the build brief ("Trillioner build brief", PDF). Its full text is copied below, after the
decisions. Table cells come out one per line because they were extracted from the PDF.

## Decisions where the brief is silent or contradicts itself

Each one is a call made while building. "Changed" means it departs from a literal reading of the brief.

1. **Frenzy (changed).** Part 3 says each qualifying purchase raises Frenzy from x1 to x5, but also that the next
   purchase pays the multiplier and "then Frenzy resets to x1". Taken literally, Frenzy could never pass x2. Built as
   a chain: every qualifying purchase pays the current multiplier, and if it landed inside the 5-second window it climbs one
   step. The chain resets to x1 when the window lapses. The $2B cap and "highest affordable multiplier" apply as written.
2. **Frenzy and small change.** Purchases under $100M neither build nor pay Frenzy, so the exact finish stays exact.
3. **Visible budgets (changed).** Part 4's rows give Luxury $60B + Suburbs $150B + Industrial $90B = $300B before counting the
   visible parts of Downtown, Harbour, Airport and Old Town, so its "about $300B fully visible" and "at least $1.1T
   hidden" cannot both hold. Part 6 allows $300B to $450B from visible shops. Built: **$440B is visible and $960B needs
   discovery or a key purchase** (Downtown $57B, Luxury $59B, Suburbs $147B, Industrial $88B, Harbour $12B, Airport $60B,
   Old Town $17B, Under City $0). The Bank and Mint open with Exchange hours, because the Airport and Old Town deals the
   chains depend on had to stay visible.
4. **Win and closing deals.** Income only starts at closing, so "below $1M, income $0 or less" could fire while a
   profitable deal is still closing. The win waits until no deal is closing.
5. **"End immediately" and the Perfect Zero window.** The win shows at once and clock and economy freeze for the 60-second
   window (with a button to take the plain win). A win that is already Perfect Zero ends the run straight away. Battle Spend
   has no window.
6. **Loose change (changed).** Vending starts at $0.25, but interest and income can leave a balance that is not a multiple
   of 25 cents, which would make exact $0.00 impossible. Fountains also take "loose change": up to 24 cents, whatever the balance
   holds beyond a whole quarter, once the balance is under $1M.
7. **Demolition fee base.** 40% of the purchase price before Frenzy and fire sale extras. The wrecking truck's 20% discount
   means fee x 0.8, or 32% of the price.
8. **Close time.** Linear from 10 seconds at $10B to 30 seconds at $100B and above.
9. **Interest.** Exactly balance/120000 per 100 ms step with the remainder carried, so it compounds smoothly: 0.5% simple
   per 60 seconds at a constant balance, 0.5012% compounded. All arithmetic stays in safe integers without BigInt.
10. **Fixed time step.** The engine consumes tick(dt) in 100 ms steps, so frame rate cannot change a result.
11. **Map layout.** Taken from the figure in Part 4: Suburbs fills the west of the north and middle rows; Old Town and
    Airport + Spaceport are north; Downtown and Luxury Row in the middle; Industrial Zone across the south-west; Harbour
    south-east. Under City has the same footprint below ground.

12. **Interior rooms** sit far outside the city and are generated when someone walks in, with the city hidden. There is no loading screen.
13. **Fog and timed lots.** Fog comes in three times a day, 2.5 in-game hours each, so Harbour deals are always possible. Fog is weather, separate from the five random events.
14. **Rooftop routes** are spiral fire escapes with a bridge to the roof. Every district has at least one.
15. **Price shuffling** touches only filler items, not the items the brief names, so its income table and required prices stay true on every seed.
16. **Surprise auction deals** sit outside the district budgets; they exist only while their event runs.
17. **Own usable things:** pogo stick, golf cart, hot air balloon, sofa kart, megaphone, golden umbrella. Total 21.
18. **Moon before breakfast** means bought between midnight and the 6AM end of the day, because Spaceport deals need a night-time discovery first.
19. **Battle Spend bots** buy about once every 5 seconds and never buy earners, leaving roughly $120B to $180B at the end, so a good shopper can beat them. Two bots never target the same pad.
20. **Forced Gift** gives the rival 10 seconds to refuse. Gifts count as spending for the giver.
21. **Solver scope.** Bots move with a travel model (distance x 1.25 / vehicle speed, 1.5 s per room, 0.4 s per purchase). They do not steer through the 3D city. Browser flood fills and drives cover that side.

---

Part 1: Instructions for the building session
Your job
Build Trillioner, a complete, fun, polished 3D game, as a new game in this hub. The player explores a bright,
blocky city and tries to spend $1 trillion in one in-game day. Quality of feel matters as much as correct rules:
running, driving and buying must feel great within the first 30 seconds.
Working rules
-
Read README.md and docs/ARCHITECTURE.md first, then the examples named below.
-
Make sensible decisions yourself when the brief is silent. Record them in docs/DESIGN.md. Ask the user only
about a choice that changes the game's direction.
-
All numbers here are starting values. Tune them when the simulator says so, but keep these fixed: $1T start,
one day, 24 real minutes, one city, exactly 8 districts, win below $1M.
-
Never claim something works unless you ran it. Verify with tests and by playing in the browser preview. Report
failures and unfinished work plainly.
-
Do not touch other games or the hub, except the generated registry and a new row in the README games
table.
-
Run the hub only from your own worktree with the hub-8090 preview config. The main checkout may be
running its own hub with someone else's uncommitted work; leave it alone.
-
Never use Roblox names, logos, characters or assets. The look is inspired, not copied.
Repo conventions
Topic
What to do
Look at
Create the game
Run node tools/new-game.mjs trillioner "Trillioner",
then replace the starter. Run npm run registry after editing
game.json.
tools/new-game.mjs
Folder rule
Everything lives in games/trillioner/, with relative paths and no
imports from other games.
docs/ARCHITECTURE.md
Hub SDK
Use guarded Hub.init, Hub.player, Hub.storage, Hub.report
(session-start, session-end) and Hub.exit. The game must run when
the SDK is absent.
shared/sdk/hub-sdk.js
Direct opening
Solo must work when opened directly, including from file://, so load
browser code with classic scripts, not ES module imports.
games/casino/index.html
Shared engine
One file, two homes: Node for online rooms, classic script for solo. Use
the same wrapper pattern as Mafia's engine.
games/mafia/engine/mafia-engi
ne.js
3D library
Copy the vendored three.js and its licence file into your folder. Do not
depend on a CDN.
games/casino/vendor/
Game server
Name server/index.mjs in game.json. Use plain WebSockets at
/games/trillioner/ws, with a server-run engine and per-player
views.
games/riftbreak/server/index.mj
s
Tests
Name them test/trillioner-*.test.mjs. They run with node
--test.
test/putt-club-*.test.mjs
Solver
A tool proves every generated city can be finished, as Putt Club does
for its holes.
games/putt-club/tools/solver.js
Rules as data
Keep rules and content in data tables.
docs/ARCHITECTURE.md

Suggested structure
games/trillioner/
  game.json  index.html  thumbnail.svg
  vendor/three.min.js  vendor/LICENSE-three
  engine/        no three.js or DOM here; runs in Node and the browser
    engine.js      Ledger, clock, Frenzy, income, purchases, win rules, viewFor(id)
    rng.js         seeded random numbers; never use Math.random in engine code
    shuffle.js     builds one run's city from a seed
    data/          districts.js items.js businesses.js secrets.js trophies.js events.js
  js/            browser only
    app.js  input.js  camera.js  player.js  vehicles.js  world.js  buildings.js
    interiors.js  crowds.js  traffic.js  pads.js  hud.js  map.js  notebook.js
    fx.js  audio.js  net.js  bots.js  menus.js
  server/index.mjs
  tools/solver.mjs  tools/balance.mjs
  docs/DESIGN.md  docs/PROGRESS.md
Engine rules
-
The engine is pure and deterministic: same seed plus same commands gives the same result. Time advances
only through tick(dt).
-
Store money as integer cents. $1T in cents is 1e14, safely below JavaScript's integer limit. Never store money
as a float.
-
Separate purchase rules from rendering, so bots, the solver, tests and the server all use the same engine.
-
Add ?debug=1 for testing: jump to a district, set the clock, add or remove cash, show secrets, show an FPS
counter. It is unavailable in online rooms.

Part 2: The game
Vision: a fun game where you explore a big toy city and spend like a trillioner. You buy things, use them, and
watch the city become yours. Every run gives rewards, and spending it all wins.
Pillars
-
Exploration comes first. Curiosity should pay: look on a roof, follow a rumour, open an odd door.
-
Buying feels amazing. Every purchase has a big visual and sound response.
-
Things you buy are real. Buy a car dealership and a car arrives that you can drive right away.
-
Your money fights back. Cash grows, and useful businesses pay you more.
-
Always progress. Partial runs earn trophies and rewards, like an .io game.
-
Hard to solve. Winning is always possible, but the obvious spending is nowhere near enough.
A run
Stage
Details
Start
6AM. The player leaves the hotel in Downtown on foot with $1,000,000,000,000. A short tutorial is shown
once and can be skipped.
Clock
1 in-game hour = 60 real seconds. The day ends at the next 6AM, after exactly 24:00 real minutes. Pausing
in solo stops the clock.
Win
Balance is below $1,000,000 and total income is $0 or less per second. Show a huge victory sequence and
end the run immediately.
Perfect Zero
Balance is exactly $0.00 and income is exactly $0. If the player wins first, give a 60-second window to finish
this, with the clock frozen.
Day ends
The run stops. Show amount spent, money left, trophies, Clout earned, secrets found, a balance-over-time
chart and the best purchase. Never show the number of secrets still undiscovered.
Restart
One button starts a new run. The notebook, trophies and Clout carry over.
Pacing targets
In-game time
Real minutes
Spend by then
What the player does
6AM to noon
0 to 6
$100B
Explores, buys vehicles, chooses powers
Noon to 6PM
6 to 12
$350B total
Takeovers open, starts following clues
6PM to midnight
12 to 18
$700B total
City projects, land abroad, hidden deals
Midnight to 6AM
18 to 24
$1.2T total
Night market, Under City, Spaceport, demolitions
In the final in-game hour, the music and city become more frantic. The clock itself keeps its normal speed.

Part 3: Money rules
Rule
Exact behaviour
Interest
While the balance is $1B or more, it grows by 0.5% per in-game hour, applied smoothly. At the start,
that is about $83M per real second. Below $1B, interest is zero.
Business income
Each owned business adds or removes a fixed amount per real second. Losses can drain the balance,
but it can never go below $0.
Buying
If the balance covers the price, the money leaves at once and the purchase takes effect. If not, show
"Too expensive" with a clear sound. No debt, loans or item resale.
Big deals
Purchases of $10B or more close in 10 to 30 real seconds, scaling with price. The money leaves at the
start, and the player can walk away during closing. Income and rewards begin at closing. Owning the
Bank makes closing instant.
Frenzy combo
Each purchase of $100M or more within 5 real seconds of the previous one raises Frenzy by 1, from x1
to x5. The next purchase costs base price x Frenzy, then Frenzy resets to x1. Extra cost is capped at
$2B per purchase. If the multiplied price is unaffordable, use the highest affordable multiplier.
Demolition
Any owned building can be demolished for 40% of its purchase price. Its income and power end;
vehicles and items stay. Play a big explosion and leave a rubble lot.
Spent total
Counts every dollar that leaves the balance: purchases, Frenzy extra, demolition fees, hints and the
money cannon. Income adds to the balance, so $1T spent does not guarantee a win.
Stock
Every item has a limit. Most are one of a kind; goods have small stock. Sold-out pads go dark.
Small change
Vending machines and fountains in every district sell fixed amounts from $0.25 to $100,000, for an
exact finish.
Random events (2 to 4 per in-game day, shuffled by seed)
Event
Effect
Lasts
Market boom
All business income x3
60 seconds
Tax refund
Adds 1% of the amount spent so far, up to $30B
Instant
Fire sale
A marked shop's prices are halved, which is bad for the player
45 seconds
Spending spree
Frenzy lasts 8 seconds instead of 5
60 seconds
Surprise auction
A one-of-a-kind deal appears on the map
90 seconds
Check made for this brief: a rough model shows interest adds about $75B over a day, and the typical
business set about $110B, so a normal winning run spends about $1.19T of the $1.4T available. Buying every
profitable business early pushes the required spending past $1.3T unless the player demolishes some. Treat
these as estimates and confirm them with the balance tool.

Part 4: The city
The whole game happens in one city, and the player can never leave. World purchases, such as land abroad and
the Moon, are made inside the city. There are exactly 8 districts, seven on the surface and one underground,
and all are fully explorable.
Suburbs
hills, homes, zoo
Old Town
clock tower, press
Airport + Spaceport
jets, rockets
Downtown
towers, exchange
Luxury Row
shops, embassies
Industrial Zone
Motor Mile, factories, scrapyard
Harbour
ships, pier, sea
Under City (below ground, same footprint)
Entrances hidden in Old Town, Harbour and Industrial Zone
North is up. Surface is about 720 x 720 world units.
Rules every district must meet
-
No loading screens between districts. The player can walk, drive or fly from one to the next. The Under City
may use a brief elevator or tunnel transition.
-
Each has its own colours, building shapes, street props, music layer and a landmark visible from far away.
-
Each has at least 4 enterable buildings, a real side path or rooftop route, a crowd, and at least 3 secrets.
-
Roads connect everything. Sprint speed is 18 units per second, so crossing the city takes about 40 seconds on
foot and about 16 by car.
-
Nothing is blocked by a fake wall without a reason. Locked places show a visible clue about what opens them.

Budgets
District
Total
Visible from start
Rest opens through
Downtown
$360B
Towers and shops
Broker's Licence, Lobby Firm, stock exchange hours
Luxury Row
$260B
$60B luxury goods
Diplomatic Pass for Embassy Row and Global Trade
Tower ($200B)
Suburbs
$200B
$150B homes and businesses
Lobby Firm for stadiums and parks ($50B)
Industrial Zone
$160B
$90B Motor Mile
Lobby Firm for power, bridges and metro lines ($70B)
Harbour
$120B
Some ships and pier deals
Fog events, timed auctions, submarine
Airport + Spaceport
$120B
Airport deals
Observatory discovery opens Spaceport deals
Under City
$120B
Nothing
Hidden entrances
Old Town
$60B
Some shops
Clues, night hours, private clubs
Total
$1.4T
About $300B fully visible
At least $1.1T needs discovery or a key purchase
Catalog size: build 400 to 600 purchases in total, with at least 40 in each district. Items named below are
required. Add your own funny items until each district reaches its budget exactly, and have a test confirm that.
Keep the tone playful.
1. Downtown ($360B)
Look
Golden skyscrapers, huge screens, wide plazas, a grid of busy streets.
Landmark
Trillion Tower, with an elevator to a rooftop helipad. The four Corner Towers mark the district edges.
Enterable
Hotel, Bank lobby, Stock Exchange floor (open noon to 6PM), City Hall, Trillion Tower.
Required
purchases
Bank $20B, Mint $40B, Phone Company $30B, four Corner Towers $12B each, Broker's Licence $1B,
Lobby Firm $3B. Takeovers: Soda Giant $30B, Burger Empire $15B, Streaming Service $18B (loses
money), Social App $24B (loses money), Bankrupt Crypto Exchange $8B (loses money). City Hall
projects: Golden Metro Station $10B, Free City Wi-Fi $8B, Skyline Light Show $6B.
Secrets
Unmarked alley shop sells the Broker's Licence. Own all four Corner Towers to reveal a private island
on the globe. A sewer grate behind the exchange holds a clue.
2. Luxury Row ($260B)
Look
Pink marble, palm trees, fountains, red carpets, valet stands.
Landmark
The Global Trade Tower, with a giant walkable world globe in its lobby.
Enterable
Department store, Art Gallery, Grand Hotel, Embassy, Global Trade Tower.
Required
purchases
Jewellery, fashion and art with "buy the whole store" pads, Grand Hotel $6B, Fashion House $5B,
Diamond Fountain $1B. Embassy Row and globe: Scottish Castle $1B, Alpine Ski Region $12B, Pacific
Island Chain $18B, Saharan Solar Field $25B, foreign mines and farmland.
Secrets
The 6PM embassy party sells the Diplomatic Pass ($2B) to anyone wearing a tuxedo from the tailor. A
painting in the art gallery hides a door.

3. Suburbs ($200B)
Look
Green hills, curving streets, pastel houses, parks, a hill at the far side.
Landmark
The Hilltop Observatory, plus Wonderland Park's broken Ferris wheel.
Enterable
Mansion, School, Zoo, Observatory, Pizza HQ, Wonderland Park.
Required
purchases
Mansions $0.2B to $1B, whole neighbourhoods $3B to $8B, Skate Shop $1B, Pizza Chain $3B, Zoo
$5B, Wonderland Park $25B (loses money), School $1B, Observatory $2B. With Lobby Firm: Stadium
$15B, Public Parks $4B each.
Secrets
The Observatory reveals the asteroid and a map of odd lights in the city. A garage sale at dawn hides a
rare deal. A hedge maze leads to a buried safe.
4. Industrial Zone ($160B)
Look
Grey and orange blocks, chimneys, cranes, freight tracks, neon Motor Mile signs.
Landmark
A giant chimney and the Motor Mile sign.
Enterable
Dealership, Factory, Steel Mill, Scrapyard office, Race Track pit.
Required
purchases
Motor Mile: Car Dealership $4B, Race Track $6B, Car Factory $18B. Fireworks Factory $2B, Demolition
Company $10B, Scrapyard $1B, Failing Steel Mill $9B (loses money). With Lobby Firm: Power Station
$20B, Harbour Bridge $12B, New Metro Line $15B.
Secrets
A locked factory door leads to an Under City entrance. A rusted crane has a rooftop-only deal. Night
race at the track pays out a clue.
5. Harbour ($120B)
Look
Blue water, docks, shipping containers, gulls, foghorns, a long pier.
Landmark
A red lighthouse and a giant container crane.
Enterable
Boatyard, Aquarium, Lighthouse, Auction Hall, Cruise Terminal.
Required
purchases
Boatyard $8B, Yacht Fleet $4B, Cruise Line $14B, Container Port $25B, Lighthouse $0.5B, Aquarium
$3B, pier stalls, and treasure lots at $2B to $8B.
Secrets
The sunken vault can be reached only by submarine. Harbour auctions appear only during fog. A
lighthouse logbook has a clue.
6. Old Town ($60B)
Look
Warm brick, crooked streets, lanterns, arches, cobblestones.
Landmark
The Clock Tower, which always shows the current in-game time.
Enterable
Newspaper office, Museum, Theatre, Fire Station, Laundromat, Collectors' Club.
Required
purchases
Fire Department $6B, Newspaper $5B, Museum $4B, Theatre $1B, antique shops, Laundromat $10M.
Secrets
The rooftop Collectors' Club can be reached with the ladder truck. The laundromat back room opens
after 2AM with Mr. Grey's clue. Night Market opens from 2AM to 4AM.

7. Airport + Spaceport ($120B)
Look
White and blue runways, hangars, control tower, then giant launch pads to the east.
Landmark
A control tower and a huge rocket that is visible across the city.
Enterable
Terminal, Hangar 13, Control Tower, Mission Control.
Required
purchases
Airline $35B, Helicopter Company $15B, Jet Fleet $8B, Hangar City $3B. After the Observatory
discovery: Rocket $12B, Moon Land $10B, Asteroid Mining $20B (earns a lot), Mars Hotel $5B.
Secrets
Hangar 13 can be reached only by helicopter. The rocket launches at midnight if bought. A radar room
holds a clue.
8. Under City ($120B)
Look
Purple caverns, glowing mushrooms, old subway platforms, an underground lake.
Landmark
The Gold Train, and a huge cavern market lit like a festival.
Enterable
Station, Bazaar, Secret Casino, Vault of Oddities, Lake Resort.
Required
purchases
Bazaar Stalls in bulk, Gold Train $10B, Mole Machine $8B, Secret Casino $15B (loses money), Vault of
Oddities $6B, Underground Lake Resort $9B.
Secrets
Three entrances: Old Town laundromat, Harbour tunnel and the Industrial factory. A deeper level
requires the Mole Machine. Mr. Grey sells expensive hints.
Part 5: Businesses, items and powers
Every significant business has a price, an income or loss, and a reward. The player chooses between useful
things that make them richer and useless things that help them spend. A physical reward appears immediately
next to the building, with a clear prompt to use it.
Usable things
Buy
Price
Income
/ sec
Usable reward
What it does
Skate Shop
$1B
+$1M
Hoverboard
Fast, can grind rails and jump. Speed 28.
Car Dealership
$4B
+$4M
Sports car
Drift handling, horn, radio. Speed 45.
Pizza Chain
$3B
+$3M
Scooter
Squeezes through alleys. Pizza pickups give speed
boosts. Speed 32.
Scrapyard
$1B
+$1M
Monster truck
Drives over small obstacles and smashes street props.
Speed 38.
Fire Department
$6B
None
Ladder truck
Extends a ladder to reach specific rooftops. Speed 30.
Zoo
$5B
-$2M
Elephant
Rideable. Slow, funny, and its trumpet scares crowds.
Speed 20.
Boatyard
$8B
+$6M
Speedboat,
submarine
Boat crosses the water. Submarine reaches underwater
areas.
Helicopter Company
$15B
+$15M
Helicopter
Free flight, lands on roofs and pads. Speed 60.
Fireworks Factory
$2B
+$2M
Launcher
Fires fireworks. Cheering crowds raise fame visuals.
Demolition Company
$10B
+$8M
Wrecking truck
Demolishes owned buildings by driving into them, with a
20% fee discount.
Mint
$40B
+$50M
Money cannon
Sprays money at $200M per second, up to $30B per run.
Bills land and crowds chase them.
Mole Machine
$8B
None
Tunnel vehicle
Digs through marked walls to the deepest Under City
level.

Also add a personal jetpack (sold in a hidden Airport shop for $3B, limited fuel, speed 40), a private train across
districts, and at least 6 other fun items of your own. Add at least 18 usable things in total. Vehicles are called with
a key from the vehicle wheel and arrive quickly.
Powers
Buy
Price
Income /
sec
Power
Bank
$20B
+$25M
Big deals close instantly.
Airline
$35B
+$40M
Fast travel to any visited district, with a 15-second cooldown.
Newspaper
$5B
+$5M
Morning, noon and evening editions give real clues.
Phone Company
$30B
+$35M
Hidden shops the player has passed close to appear on the map.
Observatory
$2B
None
Reveals odd lights on the map and opens Spaceport deals.
Broker's Licence
$1B
None
Allows takeovers on the Stock Exchange floor.
Lobby Firm
$3B
+$2M
Allows City Hall projects across the city.
Asteroid Mining
$20B
+$120M
None. A trap: it looks amazing and pays heavily until demolished.
Your city changes
-
Owned buildings get the player's flag and a gold trim. Statues appear in plazas as the amount spent rises.
-
Owned vehicles appear in traffic. Bought stadiums, bridges and metro lines physically appear or light up.
-
Demolished buildings become rubble lots, and they stay that way for the run.
-
Businesses show their nature: busy, neon-lit places make money; boarded-up, quiet ones lose it.
Part 6: Hidden routes
The game never lists all ways to spend or says how much is still undiscovered. A player who only uses visible
shops can reach about $300B to $450B spent, and the rest takes discovery.
Required chains
Chain
Steps
Opens
Clock tower
Spot the light on the roof. Buy the Fire Department. Use the ladder truck.
Collectors' Club
Mr. Grey
Buy the Newspaper. Read "Ask for Mr. Grey after 2AM." Find the laundromat
at night.
Under City
Sunken vault
Find the lighthouse logbook. Buy the Boatyard. Dive with the submarine.
Treasure auction
Asteroid
Buy the Observatory. See the asteroid at night.
Spaceport deals
Corner towers
Notice the matching towers. Buy all four.
Private island on the globe
The tuxedo
Overhear a guest. Buy a tuxedo. Attend the 6PM embassy party.
Diplomatic Pass, Embassy
Row
Broker
Follow a loud trader from the exchange to the alley.
Broker's Licence,
takeovers
Lobbyist
Read a City Hall notice saying projects need "friends". Find the Lobby Firm.
City projects
Add at least 12 further chains of your own, making at least 20 in total, with at least 3 secrets in each district.

Clue types
-
Odd graffiti, overheard conversations from NPCs, posters, unmarked doors and repeated symbols.
-
Newspaper editions, a phone call after certain purchases, and rooftop lights visible only at night.
-
Time windows, such as night markets, and weather, such as harbour fog.
-
Informants who sell a hint for $1B to $10B. Hints count as spending and never give the whole answer.
Shuffling
Each run comes from one seed. Stays fixed: the district layout, landmarks, rules and core chains. Changes:
which clue points to which secret, secret door locations from a set of candidates, event times, auction windows,
20% of prices within plus or minus 25%, and some shop contents. Rebalance after shuffling so each district still
hits its budget.
Notebook
The notebook keeps general knowledge between runs, such as "The Under City exists" or "Night markets sell rare
lots", in a player's own journal style. It does not store exact locations from shuffled runs. Solo players can pin a
clue to the map during a run.
Part 7: Trophies, rewards and modes
Trophies by amount spent in one run
Trophy
Spent
Trophy
Spent or condition
Big Spender
$1B
Diamond Half-Trillion
$500B
Bronze Shopaholic
$10B
Cosmic Whale
$750B
Silver Tycoon
$50B
The Trillioner
$1T
Gold Mogul
$100B
Flat Broke (the win)
Balance below $1M, income $0 or less
Platinum Oligarch
$250B
Perfect Zero
Exactly $0.00, income exactly $0
Show a big popup when a trophy is earned during a run. Add at least 20 fun bonus trophies, such as "Bought a
Moon Before Breakfast" or "Owned Every Zoo Animal". Display all earned trophies in a walkable personal Trophy
Room, which is part of the Trillion Tower penthouse.
.io-style progress
-
Rank titles while playing: Intern, Shopper, Big Shot, Tycoon, Mogul, Oligarch, Whale, Trillioner.
-
Visible growth: the character gets a crown, gold outfit, carpet trail, bodyguards, then a cheering crowd. Keep
the character's collision the same size.
-
Clout: after each run, award 1 Clout for each $1B spent, rounded down, with at least 1. A win adds 200, and
Perfect Zero adds 500.
-
Clout unlocks only looks: outfits, hats, vehicle skins, trails and victory dances. Nothing changes the game's
balance.
-
Save with Hub.storage: trophies, Clout, unlocks, notebook, best spent and fastest win.

Modes
Mode
Rules
The Day
Main solo mode, as described above. Random seed each run.
Daily City
Same seed for everyone each UTC day. Leaderboards for most spent and fastest win are stored on the
game server when one is running, and locally otherwise.
Free Roam
Unlocks after the first completed run. No clock or trophies; explore and play with vehicles. The time of day
can be changed. It uses a separate seed.
Battle Spend
Online multiplayer, described below.
Battle Spend
Topic
Rules
Format
2 to 8 players, with bots able to fill seats. $300B each. One day in 8 real minutes (1 in-game hour = 20
seconds). Same city, one shared seed. Interest stays 0.5% per 60 real seconds.
Win
First player below $1M with income $0 or less. If nobody does it, the lowest balance at the end wins.
Shared stock
Stock is shared. If a rival buys the only stadium, nobody else can. Goods with small stock keep their solo
amounts; tune them in playtests.
Auctions
Timed and open to all. Highest bid pays. Since all players want to spend, the player with the most cash can
always outbid the rest, which gives them a way to catch up.
Attacks
Up to 3 cards per match, found around the city: Boost makes a rival's losing company profitable for 60
seconds, Ban closes a shop to a rival for 45 seconds, Refund adds a rival $3B, and Forced Gift sends $5B
of yours to a rival (once per match; they can refuse by paying $1B).
Secrets
Clues still work. A secret deal found by one player stays hidden from others until bought.
Live display
Leaderboard of balance and spent total, purchase feed, rival markers on the map.
Networking
Host a room, share a 4-letter code or link. The server runs the engine and decides every purchase. Clients
send position 10 times a second, and the server rejects purchases when the player is not near the pad.
Reconnects use a seat token in sessionStorage, as RIFTBREAK does; a bot plays a dropped seat until the
player returns.
Part 8: Art, sound, controls and performance
Art direction
-
Look: chunky, blocky toy city. Bright flat colours, simple boxes and cylinders, rounded-looking blocks, soft sun
and clear shadows. It should look great from simple shapes.
-
Characters: blocky body parts with simple faces, swappable hats and outfits. Original designs only.
-
Readable from far away: huge signs, colourful roofs, floating prices. Each district is recognizable at a glance.
-
Day cycle: smooth sunrise, noon, sunset, night with lit windows and neon. Weather includes fog and rain.
-
Life: instanced crowds walk and react, traffic drives on roads, birds, balloons and fountains move.
Buying feedback
Price
Response
Under $100M
Small coin pop and short register sound
$100M to $1B
Coin burst, price flies into the balance, camera nudge
$1B to $10B
Larger burst, flag raised on the building, crowd cheers
$10B to $100B
Confetti cannons, slow-motion moment, headline on city screens
$100B and up
Full-city event: fireworks, helicopters and a news banner

Screen display
-
Top centre: a huge balance with animated digits, and in-game clock beside it.
-
Top left: rank title, next trophy and progress bar.
-
Top right: minimap showing only visited areas until the map is explored.
-
Left side: income per second, in green when it's rising, with interest and businesses shown separately on
hover.
-
Bottom centre: Frenzy meter and timer; active deal closings; current vehicle or item.
-
Pads: floating price, item name and icon. Prices show the Frenzy multiplier when active.
Controls
Action
Keyboard and mouse
Move, sprint, jump (double)
WASD, Shift, Space
Camera
Mouse; the camera follows behind and avoids walls
Buy or enter
Walk over small pads. Hold E on big deals, or hold it on a door.
Vehicle wheel, use item
Q, left mouse
Map, notebook, pause
M, N, Esc
Also support gamepads. Touch controls with on-screen sticks and buttons are the last milestone: useful, not
critical to launch.
Sound
Use synthesised WebAudio, as Neon Casino does, unless assets are added. Register sounds rise in pitch with
Frenzy. Music changes with time of day and district and gets more intense in the last in-game hour. Each vehicle
gets a distinct sound. Include volume sliders and a mute button.
Performance
-
Target 60 FPS on a typical laptop with integrated graphics, with a floor of 40 FPS while driving across the
city.
-
Use InstancedMesh and merged geometry per chunk. Keep under about 200 draw calls. Use distance fog
and simplified far buildings.
-
Load interiors only when near. Use one shadow-casting light with a limited area. Add Low, Medium and High
quality settings, plus an automatic drop when FPS is low.
-
Use arcade movement with simple grid-based collision. Do not add heavy physics to the city.
-
First playable moment should arrive within about 5 seconds on a normal connection. All geometry is generated,
so downloads stay small.
Part 9: Milestones and definition of done
Build in this order. Each milestone must be playable and committed before moving on. Update
docs/PROGRESS.md after each. If the session runs out of room, finish the current milestone cleanly and record
exactly what remains.
#
Milestone
Done when
M0
Setup. Scaffold, game.json, three.js, engine shell, tests, debug
mode.
Game opens from the hub and directly. Tests
pass.
M1
Feel. Player movement, camera, toy-style Industrial Zone with
Motor Mile, about 30 purchases, Frenzy, feedback, balance display,
the dealership car.
Buying and driving feel fun in the first 30
seconds. Verify by playing.

#
Milestone
Done when
M2
Economy. Clock, day cycle, interest, income, closings, demolition,
trophies, win and results, Clout, balance tool.
A full 24-minute simulated run completes, and a
real short run reaches the results screen.
M3
All 8 districts. Build all surface districts with roads, landmarks and
interiors, plus the Under City. Add crowds and traffic.
A test confirms 8 districts and each district's
exact budget. Walk and drive all of them in the
preview.
M4
Usable things. All vehicles, items, powers, city changes.
Each one can be bought and used in the
browser.
M5
Secrets. Chains, clues, shuffling, notebook, solver.
Solver passes 100 seeds; visible-only bot fails
to finish.
M6
Meta and polish. Trophy Room, Clout shop, Daily City, Free Roam,
menus, tutorial, sound, quality settings.
A new player can start and understand a run
without help.
M7
Battle Spend. Server, rooms, bots, shared stock, auctions, attack
cards, reconnects.
Server tests pass. Two browser windows
complete a real match.
M8
Finish. Performance, gamepad, touch controls, README row,
thumbnail, final balancing.
All items in the list below are true.
Required tests
-
Ledger: integer cents, no negative balance, exact interest, income and demolition results, spent total.
-
Win rules: below $1M with positive income does not win; Perfect Zero requires exactly $0.00 and zero income.
-
Content: exactly 8 districts, budgets match exactly, totals $1.4T, every district has its minimums, every
required item exists.
-
Determinism: the same seed and commands produce identical results.
-
Solver: for 100 seeds, a bot that knows the secrets reaches a win inside 24:00, using realistic travel and
closing times.
-
Difficulty: for 100 seeds, a bot using only visible deals ends with at least $400B left. An all-earners bot that
never demolishes does not win.
-
Reachability: every secret can be reached with vehicles and items obtainable in that run.
-
Abuse limits: Frenzy extra stays capped, and the money cannon stops at its limit.
-
Server: real socket tests cover rooms, shared stock, rejected purchases, reconnects and win detection.
Definition of done
-
All 8 districts can be explored by foot and vehicle without a loading screen, apart from the Under City transition.
-
The dealership gives a drivable car, and at least 18 usable things work.
-
A full run can be won by a skilled player, and the solver agrees. A first-time player cannot easily finish it.
-
Any partial run earns trophies and Clout, and they persist after a reload.
-
Battle Spend runs a real match across two browser windows.
-
No console errors in a complete run. Performance targets are measured and reported.
-
The game appears in the hub with a thumbnail and README row, and node --test passes.
Final report to the user: what is playable, how to start it, measured FPS, test results, simulator results and
any item that is unfinished or was changed from this brief.
