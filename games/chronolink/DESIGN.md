# ChronoLink design: cause, consequence, and borrowed routes

## Design decision

The fun comes from negotiating what a shared resource must do next. Preserve the short teaching curve, improve the cooperation of existing rooms, and make 20–25 advanced combinations. Do not force every opening chamber to thirty actions. A receiver reached through a prepared crossing is more useful than extra digits or another crate pushed down a corridor.

The implementation is authoritative. This document replaces older drafts describing automatic hints, removed cipher puzzles, or a campaign without signal locks.

## The Undercroft (chambers 12–19)

Playtest feedback, 29 October 2026: chamber 11 was beaten in eight minutes "with very little or no thinking". Long solver depth came from forced sequences, such as leapfrogging one plank or cycling a wheel, rather than from decisions, and mistakes were cheap. Almost every state a player could wander into was still solvable.

The Undercroft replaces chambers 12–19 with puzzles built around irreversible decisions that both players make:

- **The rules.** Crates are shoved and never pulled. Cracks are floor in 1924 and chasms by 2026. A dry crate on a crack is a pit the Echo can cross, and on dry stone it is a wall. A crate in a leak is mulch, which the Echo can walk on but which bridges nothing. Trenches stop the Anchor but are floor by 2026. Rubble is a 1924 doorway and is blocked by 2026. Every chamber has a signal lock.
- **Echo topple (new verb, available in every chamber).** Playtest feedback after the first Undercroft: as the Echo, "the only role is telling the code". The Echo can now walk into an old crate beside an open chasm and topple it in, where it lands as a pit. Both tiles become the Echo's own record, like a kicked grille. The crate's 1924 counterpart is then fixed: shoving it is a paradox ("THE ECHO TOPPLED IT"), and nothing can be set down on the two tiles. A crate on open floor cannot be slid. An earlier draft let the Echo slide crates anywhere, but that multiplied the 2026 layouts. Chamber 20's hint search then exceeded its 400k budget, while toppling keeps it at 139k.
- **Where the difficulty comes from.** Each Anchor push serves 1924 and 2026 at once: it must not wall in the Anchor, and it must leave the Echo a floor or a crate to topple. Each topple trades a 1924 resource for a 2026 bridge. Standing on a pit holds it while its crate moves on. Both standing and toppling are proven necessary in every chamber (`needs: ['stand', 'topple']`).
- **How they were made.** A dedicated fast search over this subset of the rules evolved candidate layouts. It agreed with `solve` on every one of 920 random rooms across its versions, 120 of them under the final topple rule. Layouts were scored on the shortest plan's real actions, distinct push lines in each era, Echo/Anchor handoffs, and search size. A layout was rejected when the Echo toppled crates in fewer than two places. Each survivor was then simplified: every crack, leak, trench and rubble tile was turned into plain floor or wall wherever that kept the plan just as long and just as varied. The shipped maps are verified with the game's own `solve`.
- **What the numbers say.** Shortest plans need 30, 49, 55, 57, 59, 60, 60 and 69 real actions; the longest teaching chamber needs 31. Search sizes (13k–134k states) stay within the in-game hint's 400k budget from every random state tested, and no plan exceeds the solver's 80-move depth limit.
- **Less hand-holding.** From chamber 12 on, objective chips name the obstacle without saying which era can fix it. The automatic “Press H” nudge only appears in the teaching chapter.

Topple makes chambers 1, 2 and 25 two or three actions shorter; no other chamber changes. In 25, the Echo can topple a Compost Heap crate into the crack the Anchor used to fill, so the gallery bound below is now 28 rather than 30.

Limits: these figures come from the solver, not from a human playtest. Solver depth and trap density are the standard proxies for Sokoban-style difficulty, but they cannot show whether a given chamber takes one player one hour or five. Because no crate puzzle uses water, wheels, trees or the Stash Box, the Undercroft is one sustained style rather than a tour of every mechanic. The galleries (20–25) still combine the full rule set.

## Audit method and limits

*This audit describes the first campaign. In it, chambers 12–19 were Overgrown Vault through The Last Divergence. The Long Hold, Compost Heap and Pit and Pin now survive only as the courtyards of galleries 23, 25 and 20.*


Before editing, all 19 chambers were solved with the shipped pruned macro BFS and a 400,000-state budget. The depth below is the shortest route in that graph, **not a count of reasoning decisions**. Inspection covered map bottlenecks, returned action traces, cards, `needs` declarations, signal placement, goals, and hint code. Player waiting/obviousness assessments are design risks inferred from those traces, not results of a new human playtest.

The existing minimum-depth assertion included receiver reads, unlocks, zone movement, and wheel cycling. The older documentation's 14–34 “real moves” figures therefore were not established by that test. No chamber declared pins necessary. Improved tile keys exposed an unintended box-pin duplication shortcut in Holding Pattern. That shortcut is now refused: a frozen box record cannot transfer cargo after its real source has been removed. Legal standing/box solutions remain valid.

### Compact before-and-after audit

“Card” means the original chamber card revealed a tactic. All cards are now topic descriptions. All rooms lose the automatic blocker beacon; exit beacons and requested hint markers remain. Ordinary chips still name an obstacle and responsible era, which intentionally assists orientation. Signal frequencies remain Echo-only.

| # / chamber | Before → after macro depth | Reasoning in the shortest trace / obviousness risk | Bypass and cooperation assessment | Delivered pass |
| --- | --- | --- | --- | --- |
| 1 Damp Foundations | 24 → 23 | Shared plank, holds, then two destinations; card names the resource conflict | Initial receiver was free; Anchor could start most work alone | Bring the first plank into reach and put the receiver beyond the crossing; shorter, stronger handoff |
| 2 Seed and Stone | 28 → 17 | Useful planter and crate filling; considerable shove repetition | Initial receiver was free; Anchor-heavy detours inflated length | Seed before the first lock; first receiver beyond growth, second beyond the crate crossing; remove the forced detour |
| 3 Floodgates | 20 → 20 | Initial observation matters; later crate hauling is conspicuous | Later phase remains Anchor-heavy; receivers are gated by changing space | Neutral card and reduced navigation guidance; retain the teaching room |
| 4 Iron and Water | 24 → 24 | Rust versus rot, then persistent kicks; card states conflict | Four locks add bookkeeping; several genuine exchanges remain | Preserve environmental sequence; no extra locks or longer codes |
| 5 Worn Through | 32 → 32 | Erosion and holding; repeated transfers provide length | Holding required in reduced search; card says to stand | Remove tactical card text and blocker beacon |
| 6 Sealed Away | 18 → 18 | Prepare a bridge, recover timber, transfer through box | Box required; most preparation belongs to Anchor | Preserve transfer lesson, remove tactical card text |
| 7 Holding Pattern | 36 → 36 | Pin relocation, box transfer, return crossings | A frozen-box cargo duplication shortcut was exposed during the solver audit | Refuse extraction of an unsealed source; retain standing and box necessity |
| 8 Trench and Timber | 20 → 20 | Shared plank and tree direction | One of two acorns is unused in the shortest trace; that remains an optional resource | Keep the forgiving resource; topic-only card rather than adding transport chores |
| 9 Rust and Rot | 34 → 34 | Return trip, temporary erosion, permanent kicks | Good alternating responsibility; card nearly lists the plan | Remove tactical sequencing from card |
| 10 Capsule Garden | 18 → 17 | Seed, held tree, box, rust and drainage | Late lock's receiver was available at the start | Move it past the rusted bars/channel; communication follows the environmental work |
| 11 Long Erosion | 24 → 24 | Shared plank between two water dependencies | Some wheel reversals and transfers provide length | Preserve teaching combination; neutral card |
| 12 Overgrown Vault | 24 → 24 | Return journey connects growth, rust, and transfer | Many repeats of one wheel; these no longer qualify as scored difficulty | Keep reversible/persistent contrast; neutral card |
| 13 Leaning Ground | 20 → 20 | Resource sharing plus useful planter | End receiver was initially readable; useful planter is fairly evident | Move receiver beyond the eroded passage, requiring a later exchange |
| 14 Root Rot | 19 → 19 | Hold an eroded opening while draining for growth | Strong backwards use of preservation; two-way interaction | Keep the puzzle and remove card's explicit tradeoff |
| 15 The Long Hold | 27 → 27 | Shared timber, double observation, erosion | Repeats the holding motif; card gives the tactic | Keep as a holding exercise with topic-only card |
| 16 Compost Heap | 22 → 26 | Formerly mostly crate transport | First wheel could be skipped completely; Anchor dominated | Two bottleneck grilles require its different water branches and Echo's permanent kicks |
| 17 Pins and Needles | 24 → 16 | Round trip and preserved transfer | Two pins were available; the return receiver could be read before leaving | One pin, one initial gap, wet return receiver; both pin and box are proven necessary |
| 18 Pit and Pin | 33 → 33 | Crates, holding, pinning, and box preparation | Several real exchanges, but repeated leapfrogging contributes length | Retain combination; neutral card |
| 19 Last Divergence | 18 → 18 | Holding plus preserved transfer | Short for a finale; final lock is mostly a completion step | Keep as the old campaign capstone; six advanced chambers now follow |

This is a targeted layout/dependency pass rather than a claim that every original room is now thirty decisions deep. The untouched transport-heavy sections are known opportunities for future human playtesting.

## New mechanics

### Capillary damp

**Rule:** A connected strip of marked porous masonry becomes damp if any tile in the strip is wet in the raw future.

Water and leaks seed dampness; flooded basins can also seed it. Connectivity is cardinal, never diagonal. Non-porous tiles stop it. Damp uses existing wood, seed and rust aging. It does not become a water source: no basin flooding, hydraulic flow, or plaster erosion follows from damp alone. This keeps the derivation finite and avoids feedback loops.

Example: the stream is four tiles from a grille, but their connected porous strip rusts it and wets a shore socket. Drying the socket after the kick restores a useful slab without restoring the kicked grille.

1924 shows pale porous courses; 2026 adds dark wet surfaces, salt-coloured stone and moss. The existing before/after beat can stamp DAMP, ROT or RUST. There is no new input.

Paradox: a drying strip can regrow a solid tree or restore a solid crate under Echo; the existing raw-solid refusal applies. Holding/pins preserve local tile records, not the moisture source or the rest of the strip.

### Sediment deposits

**Rule:** Flow through an authored feed deposits a walkable bank over its settling trough and buries its authored low passage or socket.

The feed must actually flow; being merely damp does not deposit sediment. Closing it reverses the century's result. A held/pinned deposit can remain after drainage. A sediment record provides a firm surface over the settling trough's rubble. Timber cannot substitute for a deposit over a blocked rubble passage.

Example: flooding makes the middle crossing but buries the last socket. Echo reaches a refuge or preserves the crossing, Anchor drains it, and the shore can be installed. Later water creates a final deposit while destroying the supported route behind it.

1924 shows trough rails and a feed marker. 2026 shows layered banks at crossings and a taller mound at buried passages. DEPOSIT and BURIED identify actual changes, not a recommended action.

Paradox: creating a blocking bank on Echo is refused. Removing a bank beneath Echo holds it until departure. A pin captures one tile, not the whole deposit group.

### Rusting supports

**Rule:** A dry iron shore in an authored socket supports its linked stone slab; a missing or damp shore lets the slab collapse and drops a rusted frame into the linked side passage.

The shore is a carried past object, using the same pickup/drop controls and state fields as other carried items. Only a marked socket supports a slab. A shore left loose ages cosmetically and cannot substitute for timber over an ordinary crack. Multiple sockets compete for the same shore. Wetting a socket destroys support even when the shore remains installed.

Echo may stand on or pin the supported slab, freeing the shore for another socket. A fallen side grille is kickable with the existing verb; its broken witness survives subsequent shore/water changes. The solid-occupancy check remains against the raw result, as for crates/trees: move Echo off a fall location before causing a collapse there, even if that location has a retained record.

1924 shows riveted sockets, a metal shore and links to slab edges. In 2026, supported slabs have a stone deck; collapsed upper slabs have visible rubble, and their side alcoves contain rusted frames. The placement verb is **Brace slab**; Echo uses **Kick**. SUPPORTED and COLLAPSE use existing synthesised bridge/shatter sounds.

## Pure derivation and state

`deriveRaw` computes hydraulic flow, ordinary wetness and basin flooding, extends dampness with `capillaryWet`, ages the existing objects, then applies `ageArchitecture` for sediment and supports. `deriveFuture` overlays Echo witnesses, pins, and the occupied record in the existing order. No function measures real time or mutates its input.

The only new mutable object kind is `shore`, inside the existing object array. Everything else is static chamber metadata (`porous`, `deposits`, `supports`, `gallery`, and a compiled volatility mask). State snapshots, rewind and network messages retain the same schema.

A pin freezes a complete record. A loose shore cannot bridge an ordinary crack. A preserved pristine plank cannot be laid onto blocked rubble. Deposits do not seed hydraulic flow. Failed past actions leave the state unchanged. Taking any object after Echo has emptied its box remains a paradox, protected by source identity even after a stale snapshot relocates it. Opening a pinned box whose source is no longer sealed is also a refused paradox; resealing that source recovers the timeline.

## Solver

- Raw derivations are cached by past object positions, held object, boxes, wheel settings and unlocked barriers.
- Frozen records are keyed by terrain, object, box identity/content/source, and empty status. Box cargo identity controls extraction and paradox protection. Other source labels and cosmetic rot/wetness do not affect legal actions on a frozen record and do not multiply search states.
- Every porous tile, affected slab, socket, fall location and deposit is included in the compiled volatility mask. Supported/deposited crossings can require standing even though their terrain is not an ordinary chasm.
- Existing actions remain the macros. Shore sockets are useful placement candidates; the normal spare-floor candidate still frees full hands. Pinning a fixed box cannot improve a legal route once cargo duplication is forbidden, so the normal solver omits those pins while retaining unpin actions for live experiments. Gallery necessity fixtures also run with placement pruning disabled.
- `realMoves` uses a 0/1 search. Walking zones, receiver reads and unlocks cost zero. Only the first use of a wheel costs a point; a search-local wheel-use mask is part of that mode's key. Later reversals and intermediate settings cost zero. This metadata never enters game or network state.
- Normal hints enumerate the actual wheel presses; scored search can enumerate a multi-position setting with its physical turn count.
- Independent courtyard/gallery boundaries prevent the solver from rearranging a completed courtyard. Prefix and suffix share a single state budget, object state, witnesses and pins. The shore can be recovered from a reachable old floor/box. Live states that invalidate the normal chapter boundary fall back to the general search rather than being labelled dead ends solely because of that boundary.

A segmented shortest route is not necessarily a global shortest route. Difficulty tests therefore separately add the courtyard score to a **relaxed gallery** score with all pins available. The new gallery cannot aid the preceding courtyard: its water is isolated, its shore does not bridge courtyard cracks, and it adds no pins. Conversely, courtyard timber cannot traverse gallery rubble. This checks a conservative 30-action threshold in the existing reduced placement model without pretending that greedy segmentation proves global optimality.

## Chambers 20–25

| # | Name / card | Main reversal | Responsibility exchanges | Scored bound |
| --- | --- | --- | --- | ---: |
| 20 | The Thirsty Wall / Water finds a way through stone. Two routes inherit the cost. | Rust the obstruction, then remove the damp that made it vulnerable | Crate/box preparation → Echo preservation → shore reuse → kick/read → dry support → held slab and final deposit | 34 |
| 21 | What the River Leaves / A new bank and a buried passage share the same source. | The first crossing must exist only long enough to reach a refuge | Erosion/holding → flood → Echo crosses/kicks → drain → receiver exchange → reused shore → held slab | 30 |
| 22 | Borrowed Ceiling / Every safe crossing rests on something needed elsewhere. | Walk on a deposit, then remove its cause to make the last support useful | Rust/rot return trip → shared shore → deposited middle crossing → dry socket → held slab → held sediment → final shore reuse | 32 |
| 23 | Dry Passage / The way forward and the way back disagree about the water. | Preserve the intermediate result while restoring the dry route | Double timber holds → middle deposit → receiver exchange → dry shore → flood → preserve final sediment → drain and reuse | 33 |
| 24 | The Last Delivery / The cargo has work to do before its final journey. | A supposedly useful bank buries its own next landing | Pin/box round trip → temporary bank → hold while draining → side refuge → permanent kick → dry support → final flood | 39 |
| 25 | A Building on Loan / The building remembers what you choose to keep. | Permanently broken grilles permit several later reversals of temporary changes | Selective rusting → Echo kicks → tree/route handoff → four uses of one shore → final held deposit | 31 |

These rooms deliberately reuse established courtyards as the first part of longer authored buildings. They are not six entirely new standalone teaching maps. Their galleries add different dependencies to familiar skills, preserving compatibility with the original campaign.

## Verification and remaining limits

Tests cover the new environmental rules, disconnected/diagonal damp strips, absence of hydraulic feedback, wet/dry supports, deposit filling/burial, pins and standing, collapse/deposit paradoxes, permanent kicks, immutable snapshots, new render records, action-plan replay and live mid-gallery hints. Campaign tests keep the 400,000-state solving budget, mechanic ablations and random live states; old control, secrecy, rewind, victory and geometry checks remain.

The browser smoke test opens the primary localhost game, starts a new chamber, checks the 25-chamber HUD and scene, and checks console errors. This is not a substitute for a two-person human playtest of every new solution. General search after unusual cross-chapter resource transport may be slower than the normal forward hint path; a budget limit is distinct from a proven dead end in the existing hint UI.

Validation snapshot, 29 October 2026: all 25 start states solved within 400,000 states. The broad run passed 58 of 59 checks and exposed a live-hint chapter-boundary limit; that condition was fixed, its dedicated regression passed, and all 100 seeded random cases were rerun successfully (99 solvable, one proven dead end). The affected six-chamber sweep never exceeded 125,729 explored states. Cargo-identity and rendering checks were rerun after the final snapshot-key refinement. The entire broad suite was not rerun after these targeted fixes.


## Echo environment interventions — 30 October 2026

The Echo can now make three additional permanent changes. The shared DOM-free action functions return a fresh state and action kind, or null. Neither a manual witness nor a jam writes objects, wheel settings or hydraulic flow back into 1924.

- **Fell tree (`echoFell`)**: walk into a grown tree or trunk, or face it and press Enter. The push follows the Echo's facing direction from the contacted tile. Clear that tree's old silhouette, then use `growTree` with the source planter's length to lay its trunk: consecutive chasms receive roots; dry tiles receive solid trunk, stopping at walls. The changed footprint becomes fixed witness records carrying the acorn's identity and trunk axis. Picking that acorn in 1924 causes “THE ECHO FELLED IT”. Another object's footprint and pinned tiles cannot be overwritten. A push with no changed landing is refused.
- **Drain basin (`echoDrain`)**: chambers author `drains: [{x, y}]`. A dry grate is solid; damp rusts it. A kick drains the adjacent, cardinally connected flooded basin and fixes its dry records permanently, plus the broken grate. Disconnected basins are unaffected. Occupied or pinned flooded tiles prevent the action, so it never silently consumes another 1924 object. Fixed tiles refuse later placement; there is no movable past drain to paradox-lock.
- **Jam wheel (`echoJam`)**: a wheel with `echo: true` exposes a future sluice-wheel record. Jamming writes a fixed wheel witness and `s.echo.jams[wheelIndex]`. Future derivation closes every gate assigned to that wheel, including when another wheel shares the gate. `flowing(L,s)` and `walkPast` remain unchanged; the Anchor may still turn its own wheel. Clone, rewind and network snapshots carry jams; the raw derivation cache and both solver keys distinguish them. Culvert flow indicators also use their own era's flow.

Witnesses apply before pins and the standing-tile overlay, as before. Felling source identities and fixed-footprint flags participate in `recKey`. Each new verb costs one scored action. `noFell`, `noDrain` and `noJam` disable only the respective solver expansion for ablation. Actions use reachable neighbours; acting from the current standing tile preserves it. Client targeting, walk-into actions, hint text, sounds, effects and poses use the same verbs.

### New chambers and proof

| # | Name | Topic / necessity | Scored depth | Plain depth | Plain states | Ablation states |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 26 | The Drowned Court | Drain the flooded court | 31 | 46 | 3,510 | 3,650 |
| 27 | The Ironwood Reach | Fell ironwood over wet fractures | 33 | 54 | 8,841 | 22,067 |
| 28 | The Last Sluice | Separate past and future water | 40 | 54 | 48,958 | 49,127 |

The wings extend the Worn Through, Rust and Rot, and Holding Pattern courtyard/gallery combinations. Each has a topic-only card, a relay beyond its environmental obstacle, declared `needs`, and an east-facing exit. No definition for chambers 1–25 changes. The existing chapter boundary is retained, so the depths have the same segmented-search limitation as chambers 20–25. These are solver difficulty measures, not claims of human playtest difficulty.

Tests replay both scored and ordinary plans through shared actions, validate both exit regions, solve and replay hints from halfway through, and include the new verbs in seeded random mid-chamber walks. Unit fixtures freeze inputs and check aging, object locks, placement reservations, pins, persistence and future-only hydraulics. Rendering checks cover both grate states and both wheel states. The campaign count assertion changes from 25 to 28 and necessity dispatch gains the three flags; existing difficulty and necessity assertions are retained.

### Existing campaign remeasurement

Scored depths before → after (no decreases):

| Chamber | Before | After |
| --- | ---: | ---: |
| 1 | 13 | 13 |
| 2 | 11 | 11 |
| 3 | 14 | 14 |
| 4 | 11 | 11 |
| 5 | 23 | 23 |
| 6 | 15 | 15 |
| 7 | 31 | 31 |
| 8 | 14 | 14 |
| 9 | 21 | 21 |
| 10 | 10 | 10 |
| 11 | 15 | 15 |
| 12 | 30 | 30 |
| 13 | 49 | 49 |
| 14 | 55 | 55 |
| 15 | 57 | 57 |
| 16 | 59 | 59 |
| 17 | 60 | 60 |
| 18 | 60 | 60 |
| 19 | 69 | 69 |
| 20 | 34 | 34 |
| 21 | 30 | 30 |
| 22 | 32 | 32 |
| 23 | 33 | 33 |
| 24 | 39 | 39 |
| 25 | 28 | 28 |

Browser verification used the isolated checkout at port 8082 with `?level=26`, `?level=27` and `?level=28`. A temporary test-server button replayed each ordinary solver plan through the live game's `commit()` and checked reachable movement before each action. All three reached the victory overlay, with no console errors. The user's port 8081 and main checkout were left untouched.

Validation: `node --test test/chronolink-*.test.mjs` completed with 80 passing tests and zero failures. The final focused environment suite also passes all eight tests, including the additional wind-up regression: an Echo animation commits against current state without overwriting an intervening Anchor pickup. Registry generation and inline-script parsing pass; no existing difficulty or necessity assertion was weakened.
