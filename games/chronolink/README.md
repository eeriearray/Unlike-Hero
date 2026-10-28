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
- `Tab` switches split and solo view. `?level=N` or `#N` opens a level; the jump box also accepts any text as a custom seed.

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
| Seed | Plant an ironwood acorn (from level 40, fetch it from the seed cabinet first) | A century-old trunk bridges the chasm |
| Acid | Open the acid valve | Kick the rusted bars apart |
| Sluice | Turn the sluice wheel | The flooded channel drains |
| Stash | Take a key blank or wet clay, lock it in the Chronal Stash Box | Open the box: an aged key or a ceramic insulator opens the vault door or live cable |
| Code | Enter the override on the boiler safe to stop the steam trap | LIDAR-rebuild and read a charred black box, then radio the code |
| Lever | Pull the right one of three levers to raise the gate (wrong ones vent steam) | LIDAR-scan the rusted lever bank for wear marks |
| Push | Shove the wardrobe blocking the doorway along its floor groove | The collapsed wardrobe is found where it was pushed, clearing the door |
| Resonance plate | Stand on the plate... | ...while the Echo stands on the same tile in 2026: the double doors open in both eras |
| Crates (from 9) | Push wooden crates around a small room (a brass rewinder resets them) | Each crate's ruin moves with it; the shutter lifts once ruins rest on weight plates that only exist in 2026 |
| Floods (from 16) | One sluice decides which of two channels gets the water | Wade into the strip between the channels, then have the Anchor switch the water back |

### Variants and pacing

- **Cipher codes (from 14)**: the black box shows glyphs, not digits. Only the 1924 safe's brass plate maps glyphs to digits.
- **Lever sequences (from 24, three levers from 150)**: wear depth shows the order (deepest wear was pulled first).
  Each correct pull stays down; a wrong one vents steam and resets the bank.
- **Crate puzzles** are generated backwards from the solved state, so each is solvable, and a breadth-first solver measures
  the true minimum number of pushes: 4-9 for one crate early on, rising to 12-22 for two crates late in the game.
- **Decoys (from 30)**: extra valves whose pipes run into walls; turning one vents steam and costs a star.
- **Hidden pipes**: from 30 the 1924 pipes are under the floor and only show once something lights them, so the Echo has to
  trace the old 2026 pipes to say which valve is real. From 101 the 2026 pipes are buried too, until a LIDAR wave passes.
- **Hints** (a glow on the next object) only appear after 40 seconds without progress.
- **Rhythm**: each mechanic is guaranteed on its introduction level and the next; within every 20 levels, 17-19 are a
  longer climax and 20 is a short breather. Each level prefers mechanics it hasn't used yet, so most mix 4-7 kinds. From level 9 every level except breathers has a crate
  room or a flood.
- **Stars**: one for clearing, one for no steam surges, one for beating par (shortest route plus a few seconds a step).
  Best stars per level show in the pause menu.

## Level generator

`<script id="chrono-core">` holds the deterministic core (no DOM):

- `Mulberry32` PRNG; each level number maps to a 16-character seed (`seedForLevel`).
- `chainLinks` builds the dependency chain backward from the exit, alternating eras on every link. Step counts: 3 at level 1,
  rising to 5 by level 100, 6–8 from 101, 12–16 from 500. New mechanics arrive on levels 1, 2, 3, 4, 6, 8, 9, 11 and 16.
- `buildFacility` lays out one shared plan: a section per link, each ending in the doorway (or chasm or channel) that
  link opens, with every object placed on the same tile in both eras and furniture kept only where both rooms stay reachable.
- `validateLevel` replays the chain with A* in both rooms and rejects any chamber either player can't finish.

`npm test` runs `test/chronolink-levels.test.mjs`, which builds all 1,000 levels and checks solvability, determinism,
scaling, era alternation and that no exit is reachable before the chain is done.
