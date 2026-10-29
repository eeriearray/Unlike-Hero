# ChronoLink redesign: "Leave it to time"

## What playing showed (chambers 1, 5, 12, 25)

- **1:** five presses and one subtraction (`▯599`, "first is 4 more than second"). Clear time with bot-perfect routing: 1:25.
  The 2026 tree beat exists (year counter rolls up), but the camera frames a dark corner and the Anchor is hidden
  behind a near wall the whole time.
- **5:** the same lever riddle twice in a row. The decoy sluice right by the start costs a star with a small white
  puff and nothing else: no 2026 change, no reason. The wardrobe "push" is one press and the piece snaps a tile.
- **12:** the flood strip is the only spatial idea in the game, but the Anchor can open the sluice while the Echo is
  still across the map. Wet and dry channels look alike, and the 2026 camera never shows the water moving. The
  cipher is a lookup table plus two sums, done alone inside a modal.
- **25:** the 13-push crate room is plain Sokoban in an empty box. The camera shows a 4×4 patch, the Anchor can't
  see the weight plates, and crates teleport one tile per press.
- **Everywhere:** no objective on screen. The event log is turned off in code (`log()` drops all but system
  messages), and notebooks are empty until a radio call. Movement reaches full speed in about 50 ms, and hints
  only appear after 150 s.

## The pillar

**1924 is live and 2026 is its result.** The 2026 room is recomputed from the 1924 room whenever the Anchor changes
something. Nothing is a scripted 1:1 trigger. The Anchor experiments by moving things; the Echo lives with the
outcome and decides what to hold fixed. Every puzzle is about *where and how things spend 102 years*, so it stays
a real puzzle in solo split screen. Hidden-information puzzles (codes, lever cards, notebooks, radio) are cut.

## Four mechanics

**1. Leave it to time (the Anchor places, the century ages).** The Anchor carries and shoves a few objects. Each
tile has an environment, shown diegetically in both eras. What an object becomes depends on where it is left:

| | Dry floor | Wet (leak, channel edge) | Soil + skylight | Sealed in the Stash Box |
| --- | --- | --- | --- | --- |
| Wooden plank / crate | old but solid: bridges a chasm, blocks a door | rots to mulch: gone | rots | pristine |
| Iron beam / bars | intact | rusts: a kick breaks it | rusts | pristine |
| Acorn | nothing | nothing | ironwood tree: falls across a gap, or blocks one | stays a seed |

*Choice:* which spot, and which object. *Consequence:* 2026 changes on the drop. *Fail and recover:* pick it up
again and 2026 changes back. Seed, acid, stash, push and crates all fold into this one system.

**2. A century of water (the Anchor routes, the century floods and erodes).** Sluice wheels with two or three
positions route one water source through stone channels. Water wets the tiles beside it (driving mechanic 1),
floods 2026 basins, and after 102 years erodes a hole through any plaster wall it runs into, opening a new 2026
passage. One wheel touches several things at once. That's where the "I want this rotted but that intact" conflicts
come from.

**3. Observed things are fixed (the Echo's verbs).** Anything the Echo stands on, carries or has **pinned** (F; 1-2
chronal pins per chamber, which can be moved) cannot be rewritten from 1924. This is how you exploit the gap: build
a bridge, have the Echo pin it, then take the plank back to use in 1924. Or drain a basin, pin the dry floor, and
re-flood the rest. The Echo also carries 2026 items (a preserved plank, an aged key) and kicks rusted or rotted
barriers.

**4. Paradox (readable failure).** If a 1924 action would put something solid where the Echo stands (shove a
crate onto it, grow a fallen tree across it), or take back an object the Echo has already taken out of the Stash Box,
the timeline refuses. Both screens fracture, the change is undone and the stamp says what was observed. **Hold R**
in either era rewinds the last change (as many as you like), so no softlock survives.

*Built as:* the Echo's own tile works like a free, temporary pin. A bridge holds under the Echo while the Anchor
lifts its plank, then collapses behind them when they step off. The approved draft had standing both refuse changes
and hold them; holding won because it is what chambers 7, 10, 11 and 13 are built on. The solver also turned up
"leapfrog" (stand on the bridge while the plank moves ahead), which became chamber 10.

Cut: codes, lever riddles, LIDAR reading, decoys, resonance plates, the 40-level generator and custom seeds, and
stars for "no mistakes". Experimenting is never punished.

## Clarity

- **Door status:** each era has an objective chip. It names the first thing on that player's shortest route to the
  exit and which era can fix it, e.g. "Chasm · 1924 CAN FIX" or "Rusted bars · YOU CAN FIX". A ring and beam mark the
  blocker in the world. When the Anchor's own way is clear, its chip shows what 2026 needs ("2026 · Chasm"), never how to fix it.
- **Causal thread:** when the Anchor holds or stands by an object whose twin matters, a thread runs from it across
  the split divider to the twin in 2026. In solo view it runs to an edge arrow instead.
- **Before/after beat:** on every 2026 change there is a 70 ms hit-stop and the 2026 camera frames the tile. The old
  state dissolves while the year counter rolls, then an icon stamps the result (BRIDGE, ROT, RUST, FLOOD, HOLE, TREE).
- **Hints:** `H` asks the solver for the next move from the live state: first press names who and lights where,
  second press says what. A nudge appears after 75 s without a change, and the first hint after 150 s.
- No paragraphs in play. Words appear only on the chamber card, at most one line.

## Feel

Movement eases in over about 0.12 s and out over 0.08 s, with lean and dust. Pickups and drops get a crouch
anticipation and a thud with a small shake. Shoves wind up, then the crate slides with ease-out and scrape audio.
The near walls are cut away low and interior walls stand at half height, so nothing hides a player. The camera widens to keep the player and their current blocker in
frame. On a solve, both exit gates flare, the divider dissolves, and a "Chamber NN sealed" stamp plays across both eras.

## Harder campaign (after playtesting)

The 19 chambers below were too easy (5-12 moves each). The current campaign joins two of them per chamber in
teaching order and tunes each with the solver (moving objects, receivers and leaks; extra tiles survive only if
they make the puzzle harder), for 14-34 puzzle moves per chamber. README.md lists the current chambers. The
originals below are still the building blocks.

## Original chambers (19, hand-built; each teaches, then twists)

| # | Idea taught | Twist |
| --- | --- | --- |
| 1 Still Standing | lay a plank over the cracks to make a 2026 bridge | two gaps, one plank: lift it and the bridge vanishes |
| 2 Damp | wet rots wood: the obvious crossing is under a leak | the Echo's corridor is blocked by a crate: shove it *into* the leak |
| 3 Ironwood | an acorn in a sunlit planter becomes a tree | the nearest planter is dark, and one sunlit tree falls across the Echo's door |
| 4 Sluice | a wheel moves the water, and 2026 floods or drains | both channels matter; wait between them |
| 5 Rust | wet iron rusts and can be kicked apart | the water that rusts the bars also rots the bridge: cross first |
| 6 Erosion | water into plaster carves a 2026 hole | the same water rots the plank beside it |
| 7 Hold Still | what the Echo stands on cannot change | stand on the bridge while the water opens the wall ahead |
| 8 Time Capsule | the Stash Box preserves anything | the chasm is under a leak, so the Echo lays the plank itself |
| 9 Pinned | pins hold a tile after the Echo leaves | pin the bridge so the Anchor can put the plank in the box |
| 10 Leapfrog | standing plus a moving plank crosses any width | a breather: a crate can fill one of the gaps instead |
| 11 Root and Rot | trees drown too | erode the hole, stand in it, then dry the planter |
| 12 Two Pins | a round trip needs two held bridges | one plank, a box at the far end, a wet chasm at home |
| 13 Long Way Round | the Echo holding a bridge frees the plank | the plank has to bridge a 1924 trench to reach the wheel |
| 14 The Divergence | tree, flood, erosion, holding and the Stash Box | all in one order |
| 15 Pit Stop | crates fill pits | a dry stone channel between the gaps stops one crate doing both |
| 16 Compost | soaked crates rot to mulch | a three-way wheel soaks one at a time, so wait between them |
| 17 Orchard | trees lean | four sunlit planters, two acorns, only two lean usefully |
| 18 Rust Belt | rusted bars can be kicked | kicked bars stay broken, so kick each one while the water is on it |
| 19 Overgrown | no planks at all | tree, crate, rust and a channel, in one order |

Mid-campaign target is 3-8 minutes for two players. Chambers are authored as data (ASCII grid plus object list)
in `chrono-core`. Tests replace the generator checks with a BFS over each chamber's state (object positions, wheel
positions, pins, Echo position). That proves every chamber solvable, and proves each chamber that teaches standing,
pins or the Stash Box is unsolvable with that mechanic disabled.

## Build slices

1. Live aging engine, environments, carry/shove, pins, paradox, rewind, door status, thread and before/after beat.
   Rebuild chambers 1-4 on it. Play-verify.
2. Water and erosion. Chambers 5-14. BFS tests.
3. Feel pass (movement, anticipation, hit-stop, audio, camera cutaways, solve sequence). Then README, game.json and
   network sync of the new state.
