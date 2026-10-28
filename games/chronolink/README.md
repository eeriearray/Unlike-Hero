# ChronoLink: Anchor & Echo

Two-player asymmetric co-op. The **Anchor** works a pristine 1924 laboratory; the **Echo** picks through the same
facility's flooded 2026 ruins. Both must reach their blast doors, and every door between them depends on the other era.

Everything is one file, `index.html`: no images or audio files. The two eras are real-time 3D scenes rendered with
three.js r128 (loaded from cdnjs, so the first load needs internet) using PBR materials, soft shadows, fog, point lights
and the Echo's shadow-casting flashlight. Every texture is painted on a canvas in code; music and effects are
synthesised with the Web Audio API. Drag a view to orbit its camera, scroll to zoom, double-click to reset.
Movement is continuous and camera-relative; the 1924 Anchor walks at 2.3 tiles/s, the 2026 Echo at 3.6.

## Play

- **One keyboard (default):** split screen. Anchor: `WASD`, `E`, `Q` ping. Echo: arrows, `Enter`, `F` LIDAR, `Right Shift` ping.
- **Two windows:** open the page again in a second window and press Begin in both. Visible, started windows link over
  `BroadcastChannel('chronolink-sync')`: the first becomes the Anchor, the second the Echo, and a `LINKED` tag shows each
  window's role. A window that is closed or hidden for 3 seconds hands both players back, and **Play both here** in the
  menu unlinks on purpose. A background tab never links, so a forgotten copy can't take the Echo away.
- **Two devices:** from the hub, press **Online** in both and enter the same 4-letter code (uses the hub relay).
- `Tab` switches split and solo view. `?level=N` or `#N` opens a chamber (1-40); the jump box also accepts any text as a custom seed.

## One building, two moments

Both eras share a single floor plan: the same walls and doorways, and every object stands on the same tile as its
102-year twin (a marble pillar becomes a broken pillar, the boiler becomes the burned-out hulk holding the black box,
the 1924 levers are the rusted 2026 levers). The 1924 floor already shows the hairline cracks where 2026's chasm will
open, and a dry stone channel where the flood will run. Players see the link in play:

- **Ghosts**: each view shows a faint figure where your partner stands in the same building.
- **Link rings**: when your partner is next to something, a ring marks that tile (and the doorway it affects) in your era.
- **Time-lapse**: when a 1924 action rewrites 2026, the 2026 camera pans to the spot and a year counter rolls
  1924 → 2026 while the change happens (the tree grows, the bars rust, the flood drains).

## Causal links

| Link | 1924 (Anchor) | 2026 (Echo) |
| --- | --- | --- |
| Seed | Plant an ironwood acorn (from chamber 14, fetch it from the seed cabinet first) | A century-old trunk bridges the chasm |
| Acid | Open the acid valve | Kick the rusted bars apart |
| Sluice | Turn the sluice wheel | The flooded channel drains |
| Stash | Take a key blank or wet clay (from 6 both benches stand side by side, and the wrong one is rejected), lock it in the Chronal Stash Box | Open the box: an aged key or a ceramic insulator opens the vault door or live cable. Only the Echo can see which one is needed |
| Code | Work out the override from the radioed fragment and the boiler ledger, then enter it (a wrong code jams the safe for 6 s) | LIDAR-rebuild a charred black box: some digits are burned out. Radio what survives |
| Lever | Read the lever card, combine it with the Echo's scan, pull the right lever or sequence (wrong pulls vent steam) | LIDAR-scan the rusted lever bank: its wear rules out part of the answer |
| Push | Shove the wardrobe blocking the doorway along its floor groove | The collapsed wardrobe is found where it was pushed, clearing the door |
| Resonance plate | Stand on the plate... | ...while the Echo stands on the same tile in 2026: the double doors open in both eras |
| Crates (from 7) | Push wooden crates around a small room (a brass rewinder resets them) | Each crate's ruin moves with it; the shutter lifts once ruins rest on weight plates that only exist in 2026 |
| Floods (from 9) | One sluice decides which of two channels gets the water | Wade into the strip between the channels, then have the Anchor switch the water back |

### Deduction puzzles

Codes and levers are logic puzzles split across the two eras. Neither chrononaut can solve one alone.

- **Codes**: the black box keeps the override with 1 digit burned out (chambers 1-4), then 2 (5-14), then 3 (15+). The
  1924 boiler ledger, shown beside the safe and in the Anchor's notebook, holds arithmetic about the digits ("the second
  digit is 7 more than the third", "the four digits add up to 20"). From 12 the surviving digits are glyphs, and only the
  safe's brass plate translates them.
- **Levers**: one lever (2-9), an ordered pair (10-17), then all three in order (18+). The 2026 wear rules something out
  ("soot on lever I: the first pull was never this one"), and the 1924 lever card adds rules ("never finish on lever II").
  Each correct pull stays down; a wrong one vents steam and resets the bank.
- **Notebooks**: each era keeps what it has found in a panel in the corner of its view. A radio call copies the 2026
  fragment into the 1924 notebook. The speech bubble carries only the short fragment.
- `deduce` builds every puzzle: it adds 1924 clues until exactly one answer survives, drops any clue that isn't needed,
  and rejects a puzzle that either era could solve on its own.

### Pacing

- **40 chambers.** Every mechanic is in play by chamber 9. Steps per chamber: 4 at the start, 7 by 13, 12 from 33.
- **Crate puzzles** are generated backwards from the solved state, so each is solvable, and a breadth-first solver measures
  the true minimum number of pushes: 5-10 for one crate early on, rising to 13-22 for two crates late in the game.
- **Decoys (from 3)**: extra valves whose pipes run into walls; turning one vents steam, stuns the Anchor and costs a star.
- **Hidden pipes**: from 11 the 1924 pipes are under the floor and only show once something lights them, so the Echo has to
  trace the old 2026 pipes to say which valve is real. From 24 the 2026 pipes are buried too, until a LIDAR wave passes.
- **Hints** (a glow on the next object) only appear after 150 seconds without progress.
- **Rhythm**: each mechanic is guaranteed on its introduction level and the next; within every 10 chambers, 8-9 are a
  longer climax and 10 is a shorter breather. From chamber 7 every level except breathers has a crate room or a flood.
- **Stars**: one for clearing, one for no steam surges (wrong codes, levers, valves and deposits all count), one for
  beating par. Best stars per level show in the pause menu.

## Level generator

`<script id="chrono-core">` holds the deterministic core (no DOM):

- `Mulberry32` PRNG; each level number maps to a 16-character seed (`seedForLevel`).
- `chainLinks` builds the dependency chain backward from the exit, alternating eras on every link. New mechanics arrive
  on chambers 1, 2, 3, 4, 5, 6, 7, 8 and 9.
- `buildFacility` lays out one shared plan: a section per link, each ending in the doorway (or chasm or channel) that
  link opens, with every object placed on the same tile in both eras and furniture kept only where both rooms stay reachable.
- `validateLevel` replays the chain with A* in both rooms and rejects any chamber either player can't finish.

`npm test` runs `test/chronolink-levels.test.mjs`, which builds all 40 chambers and checks solvability, determinism,
scaling, era alternation, that no exit is reachable before the chain is done, and (by brute force over every possible
answer) that each code and lever puzzle has one answer that needs both eras.
