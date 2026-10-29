# ChronoLink: Anchor & Echo

Two-player asymmetric co-op. The **Anchor** works a pristine 1924 building; the **Echo** walks the same building's
2026 ruins. 1924 is live and 2026 is its result: whatever the Anchor leaves somewhere spends 102 years there, and
the Echo walks through what is left. Move it again and the future changes again. See [DESIGN.md](DESIGN.md) for
the reasoning behind the mechanics.

Every chamber now also blocks the Anchor with a signal lock. Only the Echo can stand on the matching lettered
receiver in 2026 and read its three-digit frequency. The Echo must tell the Anchor the number; the Anchor enters
it at the barrier. The code is never filled in or displayed on the Anchor's screen, including in hints. Wrong
frequencies leave the barrier closed. In single-device play, switch to the Echo to read it and back to the Anchor
to enter it.

Chambers 3–6, 10, 13, 18 and 19 chain two locks with the existing water, rust, bridge and observation puzzles.
For example, in Rust the Anchor first bridges the Echo's gap; the Echo reads receiver A; the Anchor unlocks A
and sends water to rust the iron; the Echo kicks the bars and reads receiver B; the Anchor unlocks the final route.
In Pit Stop the Anchor must fill the first gap before the Echo can unlock access to the second crate.
The solver models both receiver reads and lock tuning, and verifies that all 19 chambers remain solvable.

Everything is one file, `index.html`: no images or audio files. Both eras are real-time 3D scenes rendered with
three.js r128 (loaded from cdnjs, so the first load needs internet). Every texture is painted on a canvas in code,
and music and effects are synthesised with the Web Audio API. Drag a view to orbit its camera, scroll to zoom,
double-click to reset.

The explorers use tapered clothing, rounded boots and gloves, and articulated elbows and knees. The Anchor
wears a fitted tweed coat and brass goggles; the Echo wears an exploration suit with a harness, radio pack and
visor. Cutaway walls retain invisible full-height shadow casters, and the Echo's visible beam is clipped against
the current 2026 wall records, including plaster that opens or closes when water changes.

## Play

- **One keyboard (default):** split screen. Anchor: `WASD`, `E` use, `Q` ping. Echo: arrows, `Enter` use, `.` pin,
  `Right Shift` ping. Either player: `H` for a hint, hold `R` (or `Backspace`) to rewind one change.
- **Two windows:** open the page again in a second window and press Begin in both. Visible, started windows link over
  `BroadcastChannel('chronolink-sync')`: the first becomes the Anchor, the second the Echo, and each then uses `WASD`,
  `E` and `F`. A window that is closed or hidden for 3 seconds hands both players back, and **Play both here** in the
  menu unlinks on purpose.
- **Two devices:** choose **Play online**, create a room, and give its four-letter room code to your partner to join.
  The room code connects the devices; the three-digit signal frequencies are separate clues found inside chambers.
- `Tab` switches split and solo view. `?level=N` or `#N` opens a chamber (1-19).
- **Placing items:** a translucent plank previews the selected adjacent tile. `E` / `Enter` snaps to a nearby
  gap rather than requiring exact facing. Point at another legal adjacent tile to aim, or click it to place.
  Dragging still orbits the camera. The Echo visibly carries the pristine plank taken from the Stash Box.

## How time works

| Left in 1924 | Dry | Wet (a roof leak, or beside running water) | Sunlit planter | Stash Box |
| --- | --- | --- | --- | --- |
| Plank | lies there; across cracks it bridges the 2026 chasm | rots away | | comes out new |
| Crate | an old crate that blocks; on cracks it fills the pit | rots to walkable mulch | | |
| Acorn | nothing | nothing | an ironwood that leans one way: bridges a chasm, or blocks tiles | stays a seed |
| Iron bars (fixed) | solid | rusted: the Echo kicks them apart | | |

- **Water:** sluice wheels open gate groups. Running water blocks the Anchor in 1924 (lay a plank across it), is a
  deep cut in 2026, wets every tile beside it, floods any sunken basin it touches and erodes a hole through any
  plaster wall it runs beside.
- **Holding:** whatever the Echo stands on cannot be rewritten. If the Anchor lifts the plank the Echo is standing
  on, the bridge holds until the Echo steps off, then collapses behind them. **Pins** (from chamber 9) do the same for
  a tile the Echo walks away from.
- **Paradox:** 1924 cannot put something solid where the Echo stands, or take back an object the Echo has taken out
  of the Stash Box. Both screens crack, the change is refused and the stamp says why.
- **Rewind:** hold `R` to undo the last change, as many times as you like, all the way back to the start. The menu
  also has **Restart chamber**. There are no penalties.
- **Hints:** press `H` (or **Hint** in the menu). The solver plans from where both chrononauts are right now, in a
  Web Worker. A manual hint immediately shows the next instruction and whose move it is, even when that era
  is off-screen; its marker appears in the relevant era. If the worker fails, the game falls back to local search.
  From a dead end it says to rewind. After 8 minutes
  without a change a "Stuck? Press H" nudge appears; hints never show by themselves.

## Clarity

- Each era has a goal chip at the top: the first thing between that chrononaut and the exit, and which era can fix
  it. When the Anchor's own way is open, its chip shows what 2026 needs from 1924 instead ("2026 · Chasm → bridge
  it"). A ring and a light beam mark the same tile in the world.
- Whatever `E` or `Enter` would act on gets a key badge with a one-word verb (Pick up, Lay across, Turn wheel, Kick).
- Every change to 2026 plays a beat: a short hit-stop, the 2026 camera frames the tile, the year counter rolls, the
  old state crumbles or falls as the new one grows in, a causal thread runs from the 1924 cause across the split, and
  a stamp names the result (BRIDGE, ROT · WET, RUST, FLOOD, DRY, HOLE, TREE, GONE, HELD).
- A sealed chamber dissolves the split, stamps "CHAMBER NN SEALED" across both eras and shows time and rewinds.

## Chambers

Each chamber is a long puzzle: two of the original teaching rooms joined into one building, then tuned so the
shortest possible solution is long. "Moves" counts the puzzle moves a perfect pair makes (picking up, setting
down, shoving, turning, standing, pinning, kicking, opening, laying), not walking, relay readings or repeated
wheel turns. The original chambers needed about 3-9.

| # | Chamber | Built from | Moves |
| --- | --- | --- | --- |
| 1 | Damp Foundations | Still Standing + Damp | 20 |
| 2 | Seed and Stone | Ironwood + Pit Stop | 24 |
| 3 | Floodgates | Sluice + Compost | 15 |
| 4 | Iron and Water | Rust + Rust Belt | 15 |
| 5 | Worn Through | Erosion + Hold Still | 28 |
| 6 | Sealed Away | Time Capsule + Damp | 16 |
| 7 | Holding Pattern | Pinned + Still Standing | 34 |
| 8 | Trench and Timber | Long Way Round + Orchard | 16 |
| 9 | Rust and Rot | Erosion + Rust Belt | 27 |
| 10 | Capsule Garden | Time Capsule + Overgrown | 14 |
| 11 | Long Erosion | Long Way Round + Erosion | 18 |
| 12 | Overgrown Vault | Overgrown + Time Capsule | 20 |
| 13 | Leaning Ground | Ironwood + Hold Still | 16 |
| 14 | Root Rot | Root and Rot + Rust | 15 |
| 15 | The Long Hold | Hold Still + Long Way Round | 23 |
| 16 | Compost Heap | Compost + Overgrown | 18 |
| 17 | Pins and Needles | Two Pins + Rust Belt | 19 |
| 18 | Pit and Pin | Pit Stop + Pinned | 29 |
| 19 | The Last Divergence | Hold Still + The Divergence | 16 |

The goal chip names what blocks the way but not how to fix it. Hints only come when asked for (`H`), and the
"Stuck?" nudge waits 8 minutes. Rules that keep the solver and the game in step: a locked signal barrier seals
whatever stands on its tiles, the Anchor sets things down before shoving a crate, a faced tile wins over side
tiles when setting something down, and standing on a tile that can change pins that tile.

## Code

`<script id="chrono-core">` holds the deterministic core (no DOM): the chamber maps, `deriveRaw` (1924 → 2026),
`deriveFuture` (with holds and pins), the actions both the game and the solver use (`actPick`, `actDrop`, `actShove`,
`actWheel`, `echoAct`, `echoPin`), and `solve`, a breadth-first search over macro actions.

`npm test` runs `test/chronolink-levels.test.mjs`. It proves every chamber solvable, proves that each chamber which
teaches standing, pins or the Stash Box cannot be solved without it, checks that no chamber can be walked straight
out of, and unit-tests every aging rule, holding, pins and both kinds of paradox. It also wanders randomly into
mid-chamber states and checks that the hint solver always either finds the way out or proves a dead end (which
rewind leaves).
