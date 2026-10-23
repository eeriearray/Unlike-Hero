# Step 1 — photo scenes and editable hotspots

This directory contains one JSON file per place, plus a small index and the exact
background mapping. The runtime fetches the current region's metadata and images,
then at most two neighbouring places. No runtime build step is required.

## Editing a place

Open, for example, `square.json`. Coordinates use a 1600 × 900 canvas:

- `background`: an existing logical ID from `art/manifest.json`.
- `moods`: optional `dusk`, `night`, `otherworld` logical IDs. These follow Haunting
  phases I, II and III. An omitted mood uses `background`. No Hollow Hours files
  are included: those still require the user's public-use approval.
- `hotspots`: each entry has `id`, `x`, `y`, `w`, `h`, `optionId` and `label`.
  `x`/`y` are the upper-left corner of the hit area, not percentages.
- `optionId` must match the place's engine encounter option exactly. Do not change
  it to rename the displayed text: edit `label` instead.
- `hidden: true` conceals the hotspot until that option appears in the real view.
- Non-encounter hotspots use `optionId: null` plus `action: "investigate"`,
  `action: "travel"`, or an existing adjacent place in `move`.

Reload the browser after saving JSON. When changing the background, also update
that place's `background` in `index.json`, which documents the preload inventory.
The runtime uses the per-place file as the authority for the image to render.
Run the scene test below to catch mismatches before playing.

Default positions are deliberately easy to edit. They are logical action markers,
not a claim that a well, cradle or relic is visibly painted into every supplied
background. The original square/chapel/nursery object IDs and their action bindings
are retained. Extra Investigate/Travel markers are also present throughout the map.
The Warden has no location options in the rules: its scene offers Investigate and
Travel while the existing combat interface continues to handle the boss.

## Rendering and fallback

`js/photo-scenes.js` supplies the optional scene definition; small hooks in
`js/stage.js` preserve its camera, action resolution and consequence timing.
Metadata upgrades wait until there is no focused interaction or held event.
If metadata is absent, the original scene runs. If an image fails, procedural art
remains under the markers. The registry never requests unlisted media IDs.

The image has a slow Ken Burns drift, a blurred foreground duplicate, gradient
fog, sparse dust, static film grain and region tint. The clock cools/darkens the
image and introduces a red edge vignette with a mild slow pulse in phase III.
This is depth approximation, not extracted parallax layers. The blurred duplicate
is omitted on narrow screens to reduce graphics memory. No extra animation loop
runs in JavaScript. Reduced motion stops all new animations and transitions.

Cards use the same photo with a procedural fallback. Keyboard Enter/Space uses
the existing action handler. Offscreen keyboard-focused photo hotspots bring the
camera to them. Phone users can drag the wide scene horizontally; the existing
Adventure / Map / You / Journal tabs remain intact.

The title screen is intentionally unchanged: its redesign belongs to Step 6.
To see Step 1, enter or resume an expedition.

## Verify

From the repository root:

```sh
node --test test/the-hollow-assets.test.mjs test/the-hollow-scenes.test.mjs test/the-hollow-engine.test.mjs test/the-hollow-server.test.mjs
```

If the server isn't already running, use `npm start`, then visit
http://localhost:8080/games/the-hollow/ and enter an expedition. No new assets need
building if Step 0's generated files are already present. All 42 backgrounds and
all encounter options are checked against the existing engine data by the tests.

Public asset distribution remains subject to `../CREDITS.md`; this work neither
changes license status nor includes the excluded packs.
