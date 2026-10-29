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

Goal chips identify obstacles. Only the exit receives an automatic navigation beacon; solver hint markers remain on request. Chamber cards name the subject without prescribing the tactic. After eight minutes without a change the game offers the existing “Press H” nudge.

## Campaign

The first 19 chambers retain a gradual teaching curve. The rebalance makes the initial receivers in **Damp Foundations** and **Seed and Stone** depend on a crossing, moves late receivers behind the garden/erosion work, requires both rusting branches in **Compost Heap**, and makes **Pins and Needles** require one pin for the return to its wet receiver. Fewer mandatory code steps or crate detours can make a shorter route a better cooperative puzzle.

Chambers 20–25 pair established courtyards with authored structural galleries. Their dependencies differ: permanent damage after temporary wetting; deposits that bury sockets; a bridge used only long enough to reach a refuge; and sediment that must be abandoned while the shore is reused. They introduce no extra controls or timed reflex requirements.

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

The suite checks all 25 chambers within the 400,000-state solving budget, the new scored-action bounds, declared mechanic necessities, aging and paradox rules, immutable snapshots, rendering records, plan replay, live-state hint recovery, random mid-chamber solvability/dead ends, signal secrecy, controls, rewind synchronisation, victory, flashlight clipping, and wall passages.

`<script id="chrono-core">` is deterministic and DOM-free. The client and solver use the same `actPick`, `actDrop`, `actShove`, `actWheel`, `echoAct`, and `echoPin` functions. The new mechanics fit existing object, wheel, tile-record, pin, and witness state; the online/relay message protocol and hint UI are unchanged.
