# The Hollow — scene artwork

Every scene is drawn in code (`js/scenes/*.js`, layered SVG), so the game never depends on an image file. Painted
artwork can replace any **backdrop layer** without touching gameplay: the interactive objects (the well, the notice
board, the lantern, the postcards) stay vector on top, so their states, hit areas and animations keep working.

## Dropping in a painted layer

1. Paint the layer at **3200 × 1800** (16:9, the scene's 1600 × 900 coordinate space at 2×), transparent where the
   layers behind should show through. Export as `.webp` (or `.png`).
2. Save it at the path the scene names, for example `art/square/mid.webp`.
3. List it in `js/scenes/assets.js` (`'art/square/mid.webp': true`). Unlisted files are never requested.

If a listed file fails to load, the layer falls back to its vector drawing.

## The Silent Square (`js/scenes/square.js`)

| Layer | File | What it holds | Parallax |
| --- | --- | --- | --- |
| sky | `art/square/sky.webp` | night sky, moon (upper left, the scene's light source), clouds | 0.06 |
| far | `art/square/far.webp` | distant roofline, the empty bell tower (centre right, x≈1010) | 0.18 |
| mid | `art/square/mid.webp` | back row of houses, the two leaning timber houses, the lane mouth (x≈1300), lantern string | 0.42 |
| ground | `art/square/ground.webp` | cobbles, puddle, worn path | 0.62 |
| fore | `art/square/fore.webp` | cart wheel, grass, barrel and fence silhouettes, hanging branch | 1.15 |

Keep the objects' footprints clear (they are drawn above the ground layer): notice board x 350–560 / y 456–736,
well x 650–950 / y 320–710, camp and lantern x 1020–1290 / y 594–794, postcards x 520–730 / y 720–810.

Things the code animates and that a painted layer should therefore **not** bake in: the lantern string's flames and
light pools (they go out as the Haunting Clock advances), lit windows (they go dark one by one), fog, the crows and
the watcher in the far window (phase-driven), smoke and clouds.

Style: dusk-blue night, moonlight from the upper left, warm lantern pools, muted plaster and slate, soft painterly
edges, no outlines heavier than the vector art's.

## The Abandoned Chapel (`js/scenes/chapel.js`)

| Layer | File | What it holds | Parallax |
| --- | --- | --- | --- |
| sky | `art/chapel/sky.webp` | dusk sky (low sun lower right), clouds, seen through the roof hole and broken glass | 0.05 |
| far | `art/chapel/far.webp` | back wall with three lancets (cut out), apse arch, side walls, ceiling and roof hole (x 930–1300) | 0.2 |
| mid | `art/chapel/mid.webp` | pillars, banner, remaining pews, the cold chandelier | 0.42 |
| ground | `art/chapel/ground.webp` | flagstones, aisle runner, rain puddle under the hole | 0.62 |
| fore | `art/chapel/fore.webp` | the pew barricade at both bottom corners | 1.15 |

Objects: vestry door x 228–364 / y 352–676, altar and dais x 600–1000 / y 440–610, font and plate x 1090–1280 /
y 540–736, tithe-hatch x 1160–1320 / y 738–818. Animated, so not to be baked in: the stained-glass light shafts and
the four candles (the Haunting dims and snuffs them), the dust in the roof light, the crows and the word on the wall.

## The Bloodstained Nursery (`js/scenes/nursery.js`)

| Layer | File | What it holds | Parallax |
| --- | --- | --- | --- |
| sky | `art/nursery/sky.webp` | the night through the window (x 480–630 / y 150–370), moon, branch | 0.1 |
| far | `art/nursery/far.webp` | rose wallpaper, wainscot, side walls, window frame and curtain, toy shelf | 0.2 |
| mid | `art/nursery/mid.webp` | the mobile, dresser, night-stool, mantel candles | 0.42 |
| ground | `art/nursery/ground.webp` | floorboards, rag rug, the old stain | 0.62 |
| fore | `art/nursery/fore.webp` | the door ajar at the left edge, the rocking horse | 1.15 |

Objects: the row of cradles x 310–1170 / y 480–630, hearth x 1100–1300 / y 340–610, rocking cradle x 740–970 /
y 480–730, coin saucer x 950–1070 / y 750–820. Animated: the moonlight, the candles, the stains and handprints
(they spread with each phase), the scrawl, the child at the window, the mobile and the cradle's rocking.

## Still to paint (procedural art in use)

Every other place (all but the square, the chapel and the nursery) uses the procedural scenes from `js/art.js` inside the same stage, cards and event system. To give
a place a hand-made scene, copy `js/scenes/square.js`: draw its layers, list its objects with the option ids from
`engine/data/loc-*.js`, and add a `<script>` for it in `index.html`.

## Sound

All sound is synthesised in `js/audio.js` (Web Audio): there are no audio files and so no broken paths. Event sounds
used by the scene: `zoom paper water creak bell ignite snuff whisper coin stash dice success fail crit fumble clue
pickup toll sanity damage heal`. Place ambience for the square (`PLACES.square`): water trickling upward, the lantern
string creaking, the empty tower's bell. Recorded replacements would most improve: the dice on wood, paper, the
well's rising water and the village wind.
