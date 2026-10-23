> Current supplied-art integration: see [TASK3-INTEGRATION.md](TASK3-INTEGRATION.md). Occultist and Bellkeeper now use Task 3 images; the original rendering work described below remains fallback.

# Step 5 — characters and combat

The six original SVG heroes and nine regular foes plus the Abbey Warden keep their silhouettes. `js/characters.js` wraps the existing art functions with static turbulence/displacement, a cool directional rim light, and additional hand-drawn detail for each foe. Every SVG instance owns its filter/gradient IDs. Battle figures use stable IDs so ordinary view updates do not restart their idle animation. Tiny repeated HUD/card illustrations skip the expensive paint filter.

The Weird Horror portraits and pixel battle backgrounds are not included. The current place photo becomes the battle backdrop through a blur and darker grade; procedural scenes provide the same fallback. No new image or audio files are required, and no license exclusions change.

Combat now presents a full hero and a larger foe above the existing choices, with the real enemy health. At a shared encounter, the displayed hero belongs to the active participant. The Warden's next-blow values come directly from the authoritative view; normal enemies do not expose hidden weaknesses or predict a random attack. The caption sits above the measured action-card height, including taller phone cards.

The attack anticipation and lunge are presentation of an already resolved result, not a new dodge window or a change to turn timing. Hits run on the existing dice/result beat. Confirmed defeat logs retain the defeated figure briefly at zero health and dissolve it; retreat never plays a defeat. A newly fallen hero dissolves to a faint portrait. Loading existing history does not replay these effects. Location changes cancel delayed reactions, and another player's damage does not flash your HUD. Existing Step 3 damage/Sanity screen reactions remain in place.

Reduced motion and reduced scares stop idle movement and internal book/flame animations, replace lunges with gentle feedback, and shorten defeat fades. Background tabs pause character motion. Animations do not delay game commands or alter the engine's random stream, rules or data.

## Review

Open http://localhost:8080/games/the-hollow/art/characters-preview.html to inspect all 16 figures. Try Hit foe, Foe attack, Defeat foe, Reset scene and the two temporary accessibility toggles. This page uses sample health and never loads or saves an expedition. Its preferences are not persisted.

Refresh http://localhost:8080/games/the-hollow/ to load the new module and stylesheet. The new combat composition appears during an actual enemy or Warden encounter; character styling also appears in hero selection and portraits. Normal exploration continues to use the existing stage.

## Validation

90/90 Hollow tests pass, including the existing engine and socket/server suites. Eight added tests cover all figures and scoped SVG IDs, stable combat markup, actual actor/health data, initial-history suppression, hit/death timing, retreat and location cancellation, multiplayer HUD reactions, reduced scares, the Warden telegraph and fallen/revived heroes.

Browser checks confirmed all 16 gallery figures, the isolated hit/defeat controls, reduced-motion and reduced-scare behavior, and live saved-game combat without console errors. At a 390-pixel phone viewport, the page had no horizontal overflow (375 CSS pixels including the browser's scrollbar allowance), and the caption ended above the action cards. The existing card tray itself remains horizontally scrollable.

## Exact commands

Run from `/Users/akshat/Desktop/unlike hero`:

```sh
node --test test/the-hollow-*.test.mjs
npm start
```

Keep the existing server if it is already running on port 8080, then refresh the page. There is no asset rebuild or browser build step for this update.

## Files added or changed

- `games/the-hollow/index.html` — load the character module and stylesheet.
- `games/the-hollow/js/stage.js` — one optional character-view sync hook.
- `games/the-hollow/js/events.js` — one optional hook on the existing outcome beat.
- `games/the-hollow/js/characters.js` — original-art enhancement and combat presentation.
- `games/the-hollow/css/characters.css` — composition, animation and gentle variants.
- `games/the-hollow/art/characters-preview.html` — isolated review page.
- `games/the-hollow/art/characters-preview.css` — review layout.
- `games/the-hollow/art/characters-preview.js` — sample controls and gallery.
- `games/the-hollow/art/CHARACTERS.md` — this guide and exact commands.
- `test/the-hollow-characters.test.mjs` — eight presentation regression tests.

Step 6 (title, onboarding, map and endings) is not included in this update.
