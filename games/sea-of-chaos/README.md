# Sea of Chaos: Dock Wars · 5.0.0

Competitive pirate raids for **1v1, 2v2 and 3v3**, with AI filling empty berths. First crew to win two rounds wins the best-of-three match. Shipyard paint, sails, hull parts and special cannon choices persist; purchases and all match resources reset each round.

## Your first voyage

Follow the route arrow to **Tideglass Mine** or **Verdant Grotto** for pearls, or risk the exposed center at **Crownfall Temple** for ancient relics. Sail over the floating shapes to collect them. Return within 24m of your home dock to bank automatically, then buy equipment and choose another route. Shields protect both home forts for the first 25 seconds, so every round opens with a quick treasure grab. Your ship upgrades itself whenever you reach your dock (switch to manual in the Dock shop).

| Resource | Source | Bank and use |
|---|---|---|
| Gold · brass coin | Home generator every 3s; ordinary salvage | Personal dock wallet: ship equipment and basic supplies |
| Pearls · pale sphere | Both side outposts: 4 every 10s | Shared crew treasury: surviving defenses, dock healing, production and rebuilding |
| Ancient relics · purple crystal | Crownfall: 2 every 16s, first reveal at 6s | Shared crew treasury: limited smoke and decoy tools |

At 2:30, outposts and temple spawn 35% faster. Countdown signs and the minimap show the next reveal. Holds carry 16 resource units; expanded holds add 12 per level. Heavily loaded ships have a 12m/s base speed and visible deck cargo. Race home or risk staying for the next reveal.

Sinking drops unbanked cargo for either crew to recover for 50 seconds. Banked currency and purchased round upgrades survive rebuilding. Unused active tools are lost; respawning gives no treasure and kills pay no gold. Home water repairs hulls and extinguishes burning. The home generator can be raided, so defenders have something valuable to protect.

## Break a fortress

1. After 25 seconds, shoot the enemy shield until it breaks.
2. Sink both turrets. They fire back until destroyed and stay down for the round.
3. Sail slowly (under 6 m/s) into the glowing ring around the exposed core for **three seconds**. Each hit you take knocks a second off; racing through or leaving the ring drains progress. Cannonballs cannot destroy cores.
4. A lost core stops that crew's respawns. Sink the remaining fleet to win the round.

Firing is automatic: Fire shoots from whichever beam has a rival or structure in reach, and if nothing is beside you the bow gun takes whatever you are pointing at. Hold Fire to keep shooting. Practice raids soften the enemy bots slightly (85% damage, slower reload); rooms are always even.

## Overtime: the Crownfall beacon

At **3:00** the central beacon ring opens. Hold it with no enemy ships inside for **12 seconds** to win the round. Contested occupation pauses progress; sole enemy occupation drains yours at 2 seconds per second. At **3:45** rebuilding stops and the safe sea closes toward the beacon (8 hull/s outside). Eliminating the other crew also wins.

Eight seconds between rounds reset defenses, banks, cargo, ship purchases, supplies, temporary effects and ships. Cosmetics and series score persist. The match ends immediately at 2–0 or 2–1. A simultaneous final fleet wipe replays the same round without awarding either crew a point.

## Dock outfitter: 24 implemented purchases

**Ship (13):** cannon power, racing canvas, reinforced hull, armor plates, precision rudder, quick loader, boost engine, siege barrels, ram bracing, ammo racks, fireproof coating, expanded hold and repair crew. Racing canvas trades protection for speed; reinforced hull trades speed for durability; siege barrels trade reload time for structure damage. Prices and exact per-level effects appear in the shop. Permanent purchases have caps and escalating prices.

**Crew & Fortress (7):** shield reinforcement, turret armor, turret cannons, sentry repair, dock medics, rebuild workshop and gold refinery. These spend pooled pearls. Repairs and reinforcements only affect surviving defenses.

**Supplies (4):** special ammunition, repair kit, smoke barrel and decoy buoy. Tools share **one equipped slot with at most two charges**. Use existing charges before changing tool type. Repair restores 40 hull after 3 seconds without damage. Smoke conceals an 11m circle for 5 seconds and disables aim assistance and sentry targeting through smoke, but cannonballs still pass through it. A decoy distracts nearby automated defenses for 6 seconds; one cannonball can destroy it. Active tools have an 8-second cooldown. No displayed effect is cosmetic-only.

The total is **24**: 13 ship purchases, 7 crew purchases and 4 supplies. The category tabs show affordable recommendations, exact currencies, caps, current levels, tradeoffs and purchase failures. The world continues while shopping.

## Controls

W/S or arrows sail and brake; A/D or arrows steer. **Click or F fires** at the nearest rival on either side (or ahead); hold to keep firing. Q and E force the port or starboard battery. 1/2/3 select ammunition. Shift boosts and clears sticky/chain slows; R activates the equipped tool; Space commits to a ram burst.

Touch uses a left movement stick, one big Fire button, boost and one tool. Ammunition selection and the crew-signal selector remain reachable. Crew commands are Attack, Defend, Need help and Returning with treasure. Help/defend signals influence allied bot interception. Opponents never receive team signals.

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
