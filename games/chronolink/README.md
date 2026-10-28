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
  Web Worker so play never stalls. The first press says whose move it is and lights the tile in violet; a second
  press says exactly what to do and how many moves are left. From a dead end it says to rewind. After 75 seconds
  without a change a "Stuck? Press H" nudge appears, and after 150 seconds the first hint shows by itself.

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

| # | Chamber | Idea |
| --- | --- | --- |
| 1 | Still Standing | a plank across the cracks is a bridge; lift it and it vanishes |
| 2 | Damp | wet rots wood; rot the crate blocking the Echo's corridor on purpose |
| 3 | Ironwood | an acorn in a sunlit planter; one tree bridges, the other blocks the door |
| 4 | Sluice | one wheel, two channels, wait between them |
| 5 | Rust | the water that rusts the bars also rots the plank: cross first |
| 6 | Erosion | water opens a hole in plaster and rots the bridge beside it |
| 7 | Hold Still | stand on the bridge while the water opens the wall |
| 8 | Time Capsule | seal the plank in the Stash Box; the Echo lays it over a wet chasm |
| 9 | Pinned | pin the bridge so the Anchor can reuse the plank |
| 10 | Leapfrog | stand on the bridge while the plank moves ahead |
| 11 | Root and Rot | the water that opens the way drowns the tree |
| 12 | Two Pins | there and back with one plank and two pins |
| 13 | Long Way Round | while the Echo holds the bridge, the plank crosses a 1924 trench |
| 14 | The Divergence | tree, flood, erosion, holding and the Stash Box in order |
| 15 | Pit Stop | two crates, two gaps; crates cannot cross the stone channel between them |
| 16 | Compost | a three-way wheel soaks one old crate at a time; wait between them |
| 17 | Orchard | two acorns, four sunlit planters; only two lean the right way |
| 18 | Rust Belt | kick each door while it is rusty: what the Echo breaks stays broken |
| 19 | Overgrown | no planks: grow the tree, soak the crate, kick the bars, then dry the channel |

## Code

`<script id="chrono-core">` holds the deterministic core (no DOM): the chamber maps, `deriveRaw` (1924 → 2026),
`deriveFuture` (with holds and pins), the actions both the game and the solver use (`actPick`, `actDrop`, `actShove`,
`actWheel`, `echoAct`, `echoPin`), and `solve`, a breadth-first search over macro actions.

`npm test` runs `test/chronolink-levels.test.mjs`. It proves every chamber solvable, proves that each chamber which
teaches standing, pins or the Stash Box cannot be solved without it, checks that no chamber can be walked straight
out of, and unit-tests every aging rule, holding, pins and both kinds of paradox. It also wanders randomly into
mid-chamber states and checks that the hint solver always either finds the way out or proves a dead end (which
rewind leaves).
