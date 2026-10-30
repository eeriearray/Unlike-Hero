# ChronoLink: Anchor & Echo

Two explorers share a building across 102 years. The **Anchor** changes 1924; the **Echo** reshapes its 2026 result, preserves selected tiles, and reads the frequencies that unlock the Anchor's routes. Play together on one keyboard, in two windows, or online. Solo role switching works without simultaneous input.

The game remains one `index.html`, using three.js r128 from cdnjs. Textures are painted on canvases and audio is synthesised with Web Audio. There are no new dependencies or game asset files. [DESIGN.md](DESIGN.md) records the rules, campaign audit, solver model, and difficulty limits.

## Play

- Launch the primary checkout with `npm run play`, then open **http://localhost:8081**.
- Anchor: `WASD`, `E` use, `Q` ping, walk into a crate to shove it. Echo: arrows, `Enter` use, `.` / `F` pin, `Right Shift` ping, walk into an old crate to topple it into the chasm beyond. Face a tree/trunk, rusted drain grate or future sluice wheel and press `Enter` (or walk into it) to **Fell tree**, **Drain basin** or **Jam wheel**.
- `Tab` switches split and solo views. Either movement set and use key operate the visible role in solo view.
- `H` requests a hint. Hold `R` / `Backspace` to rewind a change. `Esc` opens the menu.
- Two windows link with `BroadcastChannel('chronolink-sync')`. Online play uses the existing hub relay and four-letter room code.
- `?level=N` or `#N` opens chamber 1–28.
- Drag to orbit, scroll to zoom, double-click to reset. Facing chooses among legal placements; clicking another adjacent legal tile explicitly aims the placement.

Only Echo sees receiver frequencies. Anchor must enter the number manually at the matching signal barrier. Hints and shared objectives never reveal or automatically enter it.

## A century of consequences

| Cause in 1924 | Result in 2026 |
| --- | --- |
| Dry plank on cracks | A wooden crossing |
| Wet plank | Rotten timber; the crossing disappears |
| Dry crate | A solid obstruction, or a filled pit on cracks |
| Wet crate | Walkable mulch |
| Dry crate beside a chasm in 2026 | The Echo can topple it in as a pit; the 1924 crate is then fixed in place |
| Acorn in a dry sunlit planter | Ironwood, leaning along the planter's marked direction |
| Wet or unlit acorn | No tree |
| Grown ironwood in 2026 | Echo pushes the tree or trunk in its facing direction; roots span chasms, trunks block dry ground; its acorn becomes paradox-locked |
| Rusted authored drain beside a flooded basin | Echo kicks it open, permanently drying that connected basin |
| Authored future sluice wheel | Echo wedges it shut for future aging; the Anchor’s wheel and water keep working in 1924 |
| Wet iron bars | Rusted bars that Echo can kick permanently apart |
| An item sealed in the Stash Box | A pristine item Echo can take out; Anchor cannot reclaim it afterward |
| Water beside plaster | A worn-through future passage |
| Water touching a sunken basin | The connected basin floods |
| Water touching a connected porous strip | Capillary damp along the strip: wood rots, iron rusts, and seeds fail |
| Flow into a marked settling trough | Sediment makes a crossing and buries another low passage |
| Dry iron shore in its marked socket | The linked slab remains a usable stone crossing |
| Missing or damp shore | The slab collapses; a rusted grille falls into its side passage |

Capillary damp is **not running water**: it does not flood basins or erode plaster. Sediment and supports are explicit architectural features, not effects of every stream or every piece of floor. Brass sockets, connected porous strips, trough rails, and their aged counterparts identify them in the scene. `E` places a carried shore with the **Brace slab** verb.

All aging is recomputed immediately from the current past. There is no real-time waiting. Echo's occupied tile holds its previous record; pins keep records after Echo leaves. Echo's manual changes, including kicked grilles, laid pristine planks, toppled crates, felled trees and drained basins, persist through subsequent 1924 changes. A crate the Echo has toppled cannot be shoved in 1924 (a paradox), and nothing can be set down on the two tiles it fixed. Newly solid interventions on Echo's tile are refused by the existing paradox check. A pinned box cannot duplicate cargo: its real source must still be sealed when Echo extracts it. Rewind restores the whole prior state.

Goal chips identify obstacles. In the teaching chambers (1–11) they also say which era can fix each one, and after eight minutes without a change the game offers a “Press H” nudge. From chamber 12 on, chips only name the obstacle and there is no nudge: working out who acts, and when, is the puzzle. Only the exit receives an automatic navigation beacon; solver hint markers remain on request. Chamber cards name the subject without prescribing the tactic.

## Campaign

Chambers 1–11 are the teaching chapter. They introduce timber, crates, acorns, water, rust, erosion, the Stash Box, standing, pins and signal locks, with a gradual curve.

Chambers 12–19 are **the Undercroft**, the hard chapter. It is a two-century warehouse, and both players move the crates. In 1924 the Anchor can walk over cracked floor, but crates can only be shoved, never pulled. By 2026 the cracks are chasms, and a dry crate is the Echo's only floor across one. A crate left on dry stone becomes a wall in the Echo's way. A crate in a leak becomes mulch, which the Echo can walk on but which bridges nothing.

The Echo has two jobs of its own. It stands on a filled pit to keep it while the Anchor moves the crate on. And it topples old crates into the chasm beside them, which clears its path and bridges the gap at once. Toppling also fixes that crate in 1924 for good, so the Anchor loses it. Every Undercroft chamber needs both standing and toppling. Many opening moves are traps, so expect to rewind a lot.

| # | Chamber | Shortest plan (real actions) |
| --- | --- | ---: |
| 12 | The Undercroft | 30 |
| 13 | Cold Storage | 49 |
| 14 | Settling Dust | 55 |
| 15 | The Sunken Hall | 57 |
| 16 | The Packing Room | 59 |
| 17 | Long Shadows | 60 |
| 18 | Quiet Weight | 60 |
| 19 | The Deep Archive | 69 |

For comparison, the longest teaching chamber needs 31, and the chambers that previously occupied slots 12–19 needed 8–25. The Undercroft maps were evolved by a search over layouts. A map was kept only when the solver's shortest plan was long, needed the Echo to topple crates in at least two places, required standing, and random wandering from the start often reached a dead end. Every crack, leak, trench and rubble tile that remains was checked: turning it into plain floor or wall makes the chamber easier or unsolvable. The hint (`H`) still works from any state, but it takes a few seconds to answer here.

Chambers 20–25 pair courtyards from the first campaign (including The Long Hold, Compost Heap and Pit and Pin, which no longer appear on their own) with authored structural galleries. Their dependencies differ: permanent damage after temporary wetting; deposits that bury sockets; a bridge used only long enough to reach a refuge; and sediment that must be abandoned while the shore is reused. They introduce no extra controls or timed reflex requirements.

| # | Chamber | Scored route / conservative chapter bound |
| --- | --- | ---: |
| 20 | The Thirsty Wall | 34 |
| 21 | What the River Leaves | 30 |
| 22 | Borrowed Ceiling | 32 |
| 23 | Dry Passage | 33 |
| 24 | The Last Delivery | 39 |
| 25 | A Building on Loan | 31 |

Scored actions count pickups, placements, shoves, meaningful observation stands, pins, kicks, box transfers, and pristine plank placement. Walking, receiver reads, unlocking, and **all wheel uses after that wheel's first use** cost zero. Cycling a wheel cannot inflate these figures. The regular hint solver still returns the individual physical actions.

These figures use the solver's reduced placement graph, with a separately relaxed gallery supplying every pin for the lower-bound check. They are not a claim of a globally exhaustive minimum over every possible floor placement. Tests cover the target in the same macro-action model used by the existing campaign; selected necessity fixtures also search without placement pruning.

## The Echo wings (26–28)

These three extensions reuse established courtyards and structural galleries, then add a final route that requires the Echo's new intervention. Their cards name the subject without revealing the solution.

| # | Chamber | Required Echo action | Scored depth | Ordinary depth | States explored (ordinary) |
| --- | --- | --- | ---: | ---: | ---: |
| 26 | The Drowned Court | Drain basin | 31 | 46 | 3,510 |
| 27 | The Ironwood Reach | Fell tree | 33 | 54 | 8,841 |
| 28 | The Last Sluice | Jam wheel | 40 | 54 | 48,958 |

All three necessity ablations exhaust within 400,000 states. Depths use the existing pruned, segmented macro solver: they measure actions, not human reasoning or a globally exhaustive minimum over arbitrary placements. The first 25 layouts are unchanged, and none of their measured scored depths decreases.

## Verification

Run `node --test test/chronolink-*.test.mjs`.

The suite checks all 28 chambers within the 400,000-state solving budget, the Undercroft's 30–69 action ramp, its required topples and its trap density, the gallery scored-action bounds, declared mechanic necessities, aging and paradox rules, immutable snapshots, rendering records, plan replay, live-state hint recovery, random mid-chamber solvability/dead ends, signal secrecy, controls, rewind synchronisation, victory, flashlight clipping, and wall passages.

`<script id="chrono-core">` is deterministic and DOM-free. The client and solver use the same `actPick`, `actDrop`, `actShove`, `actWheel`, `echoAct`, `echoPin`, `echoTopple`, `echoFell`, `echoDrain`, and `echoJam` functions. The new mechanics fit existing object, wheel, tile-record, pin, and witness state; the online/relay message protocol and hint UI are unchanged.
