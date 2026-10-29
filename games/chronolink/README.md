# ChronoLink: Anchor & Echo

Two explorers share a building across 102 years. The **Anchor** changes 1924; the **Echo** explores its 2026 result, preserves selected tiles, and reads the frequencies that unlock the Anchor's routes. Play together on one keyboard, in two windows, or online. Solo role switching works without simultaneous input.

The game remains one `index.html`, using three.js r128 from cdnjs. Textures are painted on canvases and audio is synthesised with Web Audio. There are no new dependencies or game asset files. [DESIGN.md](DESIGN.md) records the rules, campaign audit, solver model, and difficulty limits.

## Play

- Launch the primary checkout with `npm run play`, then open **http://localhost:8081**.
- Anchor: `WASD`, `E` use, `Q` ping. Echo: arrows, `Enter` use, `.` / `F` pin, `Right Shift` ping.
- `Tab` switches split and solo views. Either movement set and use key operate the visible role in solo view.
- `H` requests a hint. Hold `R` / `Backspace` to rewind a change. `Esc` opens the menu.
- Two windows link with `BroadcastChannel('chronolink-sync')`. Online play uses the existing hub relay and four-letter room code.
- `?level=N` or `#N` opens chamber 1–25.
- Drag to orbit, scroll to zoom, double-click to reset. Facing chooses among legal placements; clicking another adjacent legal tile explicitly aims the placement.

Only Echo sees receiver frequencies. Anchor must enter the number manually at the matching signal barrier. Hints and shared objectives never reveal or automatically enter it.

## A century of consequences

| Cause in 1924 | Result in 2026 |
| --- | --- |
| Dry plank on cracks | A wooden crossing |
| Wet plank | Rotten timber; the crossing disappears |
| Dry crate | A solid obstruction, or a filled pit on cracks |
| Wet crate | Walkable mulch |
| Acorn in a dry sunlit planter | Ironwood, leaning along the planter's marked direction |
| Wet or unlit acorn | No tree |
| Wet iron bars | Rusted bars that Echo can kick permanently apart |
| An item sealed in the Stash Box | A pristine item Echo can take out; Anchor cannot reclaim it afterward |
| Water beside plaster | A worn-through future passage |
| Water touching a sunken basin | The connected basin floods |
| Water touching a connected porous strip | Capillary damp along the strip: wood rots, iron rusts, and seeds fail |
| Flow into a marked settling trough | Sediment makes a crossing and buries another low passage |
| Dry iron shore in its marked socket | The linked slab remains a usable stone crossing |
| Missing or damp shore | The slab collapses; a rusted grille falls into its side passage |

Capillary damp is **not running water**: it does not flood basins or erode plaster. Sediment and supports are explicit architectural features, not effects of every stream or every piece of floor. Brass sockets, connected porous strips, trough rails, and their aged counterparts identify them in the scene. `E` places a carried shore with the **Brace slab** verb.

All aging is recomputed immediately from the current past. There is no real-time waiting. Echo's occupied tile holds its previous record; pins keep records after Echo leaves. Echo's manual changes, including kicked grilles and laid pristine planks, persist through subsequent water changes. Newly solid interventions on Echo's tile are refused by the existing paradox check. A pinned box cannot duplicate cargo: its real source must still be sealed when Echo extracts it. Rewind restores the whole prior state.

Goal chips identify obstacles. In the teaching chambers (1–11) they also say which era can fix each one, and after eight minutes without a change the game offers a “Press H” nudge. From chamber 12 on, chips only name the obstacle and there is no nudge: working out who acts, and when, is the puzzle. Only the exit receives an automatic navigation beacon; solver hint markers remain on request. Chamber cards name the subject without prescribing the tactic.

## Campaign

Chambers 1–11 are the teaching chapter. They introduce timber, crates, acorns, water, rust, erosion, the Stash Box, standing, pins and signal locks, with a gradual curve.

Chambers 12–19 are **the Undercroft**, the hard chapter. It is a two-century warehouse. In 1924 the Anchor can walk over cracked floor, but crates can only be shoved, never pulled. By 2026 the cracks are chasms, and a dry crate is the Echo's only floor across one. A crate left on dry stone becomes a wall in its way. A crate in a leak becomes mulch, which the Echo can walk on but which bridges nothing. The Echo must stand on a filled pit to keep it while the crate moves on. Many opening moves are traps, so expect to rewind a lot.

| # | Chamber | Shortest plan (real actions) |
| --- | --- | ---: |
| 12 | The Undercroft | 30 |
| 13 | Cold Storage | 35 |
| 14 | Settling Dust | 38 |
| 15 | The Packing Room | 47 |
| 16 | The Sunken Hall | 49 |
| 17 | Long Shadows | 52 |
| 18 | Quiet Weight | 57 |
| 19 | The Deep Archive | 77 |

For comparison, the longest teaching chamber needs 31, and the chambers that previously occupied slots 12–19 needed 8–25. The Undercroft maps were evolved by a search over layouts. A map was kept only when the solver's shortest plan was long, standing was required, and random wandering from the start often reached a dead end. Every crack, leak, trench and rubble tile that remains was checked: turning it into plain floor or wall makes the chamber easier or unsolvable. The hint (`H`) still works from any state, but it takes a few seconds to answer here.

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

## Verification

Run `node --test test/chronolink-*.test.mjs`.

The suite checks all 25 chambers within the 400,000-state solving budget, the Undercroft's 30–77 action ramp and its trap density, the gallery scored-action bounds, declared mechanic necessities, aging and paradox rules, immutable snapshots, rendering records, plan replay, live-state hint recovery, random mid-chamber solvability/dead ends, signal secrecy, controls, rewind synchronisation, victory, flashlight clipping, and wall passages.

`<script id="chrono-core">` is deterministic and DOM-free. The client and solver use the same `actPick`, `actDrop`, `actShove`, `actWheel`, `echoAct`, and `echoPin` functions. The new mechanics fit existing object, wheel, tile-record, pin, and witness state; the online/relay message protocol and hint UI are unchanged.
