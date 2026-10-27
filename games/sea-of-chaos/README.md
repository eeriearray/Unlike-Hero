# Sea of Chaos: Dock Wars · 5.0.0

Competitive pirate raids for **1v1, 2v2 and 3v3**, with AI filling empty berths. First crew to win two rounds wins the best-of-three match. Shipyard paint, sails, hull parts and special cannon choices persist; purchases and all match resources reset each round.

## Your first voyage

Follow the route arrow to **Tideglass Mine** or **Verdant Grotto** for pearls, or risk the exposed center at **Crownfall Temple** for ancient relics. Sail over the floating shapes to collect them. Return within 24m of your home dock to bank automatically, then buy equipment and choose another route. Shields protect both home forts during the first 60 seconds, making this an active resource contest.

| Resource | Source | Bank and use |
|---|---|---|
| Gold · brass coin | Home generator every 3s; ordinary salvage | Personal dock wallet: ship equipment and basic supplies |
| Pearls · pale sphere | Both side outposts: 4 every 10s | Shared crew treasury: surviving defenses, dock healing, production and rebuilding |
| Ancient relics · purple crystal | Crownfall: 2 every 16s, first reveal at 6s | Shared crew treasury: limited smoke and decoy tools |

At 2:30, outposts and temple spawn 35% faster. Countdown signs and the minimap show the next reveal. Holds carry 16 resource units; expanded holds add 12 per level. Heavily loaded ships have a 12m/s base speed and visible deck cargo. Race home or risk staying for the next reveal.

Sinking drops unbanked cargo for either crew to recover for 50 seconds. Banked currency and purchased round upgrades survive rebuilding. Unused active tools are lost; respawning gives no treasure and kills pay no gold. Home water repairs hulls and extinguishes burning. The home generator can be raided, so defenders have something valuable to protect.

## Break a fortress

1. After 60 seconds, damage the shield until it breaks. The timer only unlocks damage; it never removes a healthy shield.
2. Destroy both independently tracked turrets. They continue shooting until individually destroyed. Destroyed defenses cannot be bought back during the round.
3. Enter a harbor gate and stop in the exposed core ring for **five uninterrupted stationary seconds**. Movement input, turning, boosting, burning or damage resets progress. A growing capture ring and crew warnings announce the boarding ship. Protect it or hit it to interrupt. Cannonballs cannot destroy cores.
4. Core loss prevents rebuilding. Sink the remaining fleet to win.

Shield and turret durability scale with crew size. Ships spawn inside guarded, sea-level harbors with two wide exits. Tall masonry and reef cliffs provide physical cover; open gates provide clear cannon lanes. Side channels offer a longer route around the exposed temple. Boats never sail uphill.

## Overtime: the Crownfall beacon

The game warns both crews at 3:30. At **4:00**, the central 20m beacon ring opens. Hold it without enemy ships for **20 seconds** to win the round. Contested occupation pauses progress; sole enemy occupation drains your progress at 2 seconds per second. Empty water does not advance capture. Fortress health never decides the result.

At **5:00**, rebuilding stops for both crews and the visible safe-water ring contracts from 100m toward 22m over 60 seconds. The outer sea deals a gradual 8 hull/s. Eliminating the other crew also wins. This deterministic escalation is explained in the help screen and objective before activation. Normal core assaults remain available throughout overtime.

Eight seconds between rounds reset defenses, banks, cargo, ship purchases, supplies, temporary effects and ships. Cosmetics and series score persist. The match ends immediately at 2–0 or 2–1. A simultaneous final fleet wipe replays the same round without awarding either crew a point.

## Dock outfitter: 24 implemented purchases

**Ship (13):** cannon power, racing canvas, reinforced hull, armor plates, precision rudder, quick loader, boost engine, siege barrels, ram bracing, ammo racks, fireproof coating, expanded hold and repair crew. Racing canvas trades protection for speed; reinforced hull trades speed for durability; siege barrels trade reload time for structure damage. Prices and exact per-level effects appear in the shop. Permanent purchases have caps and escalating prices.

**Crew & Fortress (7):** shield reinforcement, turret armor, turret cannons, sentry repair, dock medics, rebuild workshop and gold refinery. These spend pooled pearls. Repairs and reinforcements only affect surviving defenses.

**Supplies (4):** special ammunition, repair kit, smoke barrel and decoy buoy. Tools share **one equipped slot with at most two charges**. Use existing charges before changing tool type. Repair restores 40 hull after 3 seconds without damage. Smoke conceals an 11m circle for 5 seconds and disables aim assistance and sentry targeting through smoke, but cannonballs still pass through it. A decoy distracts nearby automated defenses for 6 seconds; one cannonball can destroy it. Active tools have an 8-second cooldown. No displayed effect is cosmetic-only.

The total is **24**: 13 ship purchases, 7 crew purchases and 4 supplies. The category tabs show affordable recommendations, exact currencies, caps, current levels, tradeoffs and purchase failures. The world continues while shopping.

## Controls

W/S or arrows sail and brake; A/D or arrows steer; Q fires port, E starboard. **One press fires one cannonball**, cycling the actual three cannon positions. 1/2/3 select ammunition. Shift boosts and clears sticky/chain slows; R activates the equipped tool; Space commits to a ram burst. Ordinary bumps do little damage. Brief immunity between mobility effects prevents permanent slowing.

Touch uses a left movement stick, two broadside buttons, boost and one tool. Ammunition selection and the crew-signal selector remain reachable. Crew commands are Attack, Defend, Need help and Returning with treasure. Help/defend signals influence allied bot interception. Opponents never receive team signals.

## Bots, networking and performance

Bots use the same movement, terrain, visibility, aim, ammunition, cooldown, damage, cargo and purchase rules. They collect and bank treasure, buy valid upgrades, retreat, intercept harbor attacks, protect boarding allies, break defenses in order, board and hunt final lives. Cached grid navigation avoids cliffs, masonry, outpost rocks and moving whirlpools. Roles emerge from loadouts and resource/defense choices.

The host runs at 30Hz, snapshots at 10Hz and client controls at 20Hz. Client actions are tied to connection IDs. Purchases are validated by the host, and each network fire/tool/purchase press is consumed once. Columnar snapshot tables preserve full ship and economy state with headroom below the 16KiB relay cap. Disconnects transfer ships to AI.

Original procedural art and synthesized music are local. Preparation, resource voyages, assaults and final lives use distinct arrangements. Music/effects have separate persistent switches. Static scenery is batched; loot is capped at 36 piles, tactical fields at 12, and transient effects are pooled. Rendering uses one device pixel per CSS pixel, no shadows or postprocessing, and respects reduced motion for camera shake, ship roll, sails, water, treasure and capture effects.

## Run and verify

From the repository root:

```sh
npm start
# Open http://localhost:8080/games/sea-of-chaos/
node --test test/sea-of-chaos*.test.mjs
# With Playwright installed / available in NODE_PATH:
node tools/verify-sea-of-chaos-browser.cjs
```

The browser test accepts `SOC_URL` and optional `CHROME_PATH`. It verifies a real relay host + touch client, host-authorized purchases, team-scoped signals, customization persistence, solo startup and essential HUD bounds/overlaps at phone, small phone, tablet and landscape sizes. Screenshots and a report are saved in `output/sea-of-chaos-redesign/`.

Automated simulations verify complete series in every crew format and a bot raid from collection through core destruction. These are repeatable engineering playtests, not a substitute for human balance sessions. Real phone GPU performance, internet latency and long-session balance still need device/human testing. Symmetrical bots may reach overtime; the beacon and closing safe sea provide a clear finish.
