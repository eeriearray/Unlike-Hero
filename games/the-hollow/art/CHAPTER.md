# Step 6 — title, onboarding, map and endings

The title now uses the existing street photograph, a slow drift and fog, the Gravewire logo, and the existing title music/mixer. The original Play solo, Host, Join, resume, name and room-code controls retain their handlers. If the photograph fails, the original procedural title illustration remains available.

The first new solo game or hosted expedition offers a 60-second, four-part prologue before the original start action. Skip intro or Escape continues immediately, and the choice is remembered locally. Joining and resuming are immediate. Watch the prologue on the title replays it without starting a table. Hidden-tab time does not consume the prologue, and reduced motion/scares stop its visual drift.

Five nonblocking first-run HUD tips explain character resources, actions, the shared Haunting Clock, the pack and the journal/map. They replace the previous two coaching cards. Next, Back, Done and Skip tips work with keyboard focus; completion/skip is remembered. In-game Settings includes Show the five HUD tips. The guide does not pause or modify a turn timer.

The map is now ink on aged parchment. It keeps the authoritative discovered places, region labels, fog mask, graph, legal-move highlighting, zoom, drag and selection. Path, hidden, locked and guarded/blocked routes have distinct vector symbols and line patterns. Road symbols opens a compact key. No undiscovered node or road is added by the presentation layer.

All seven ending families have a different existing photograph and grade. Variant results use their ending family (for example silence_flawed still uses silence's image). The opening card keeps the exact engine title/text and shows rounds survived, clues uncovered, relics carried and who lived. Bound survivors retain their bound fate label. The engine tracks rounds rather than days, so no calendar conversion is invented. The full original final roll, mystery report, objectives and personal legacies remain under Complete expedition record. Play again uses the existing action and returns to the game's normal new-expedition flow.

## Isolated review

Open http://localhost:8080/games/the-hollow/art/chapter-preview.html. Use Title, Prologue, HUD tips, Map and the seven-ending selector. This review uses deterministic sample engine snapshots and memory-only onboarding preferences. It does not connect to, save, or change a live expedition. Its map explicitly demonstrates all four route states; it is a visual sample rather than a playable table.

Refresh http://localhost:8080/games/the-hollow/ for the updated client. Existing saved/online expeditions use the same handlers as before. The prologue does not intercept Join, Return to expedition or Continue solo.

## Verification

99/99 Hollow tests pass, including the existing engine/socket suites and nine new tests for asset mappings, preserved controls/legacies, ending-family selection, source-based summaries, prologue duration/hidden-time/skip, deferred start actions, five-tip persistence and denied storage, authoritative map/fog preservation and Settings replay.

Browser checks covered title artwork/Gravewire, all five tips, prologue skip, all seven loaded ending images, the map and expanded road key, and the live saved-game ending without console errors. At the phone breakpoint, the ending had no horizontal overflow (375 CSS pixels in the 390-pixel viewport) and its controls remained available. Temporary viewport overrides were reset.

Existing media is reused and lazy-loaded through HollowAssets. No generated image/audio binaries, manifest entries, engine files or licensing gates were changed. The preview JSON is approximately 172 KB and is loaded only by the review page.

## Exact commands

From `/Users/akshat/Desktop/unlike hero`:

```sh
node tools/build-chapter-preview.mjs
node --test test/the-hollow-*.test.mjs
npm start
```

The preview JSON is included; regenerate it if the engine content changes. If the server is already running on port 8080, keep it running and refresh the page. No asset conversion or browser build is needed for this update. Fresh checkouts still need the generated asset preparation described in PIPELINE.md.

## Files added or changed

- `games/the-hollow/index.html` — load chapter styling, art IDs and presentation module.
- `games/the-hollow/js/map.js` — parchment palette and four route symbols; existing map behavior retained.
- `games/the-hollow/js/chapter-art.js` — title and seven ending image IDs.
- `games/the-hollow/js/chapter.js` — presentation wrappers, prologue and five-tip guide.
- `games/the-hollow/css/chapter.css` — atmosphere, layouts, map treatment and gentle variants.
- `games/the-hollow/art/chapter-preview.html` — isolated review entry point.
- `games/the-hollow/art/chapter-preview.css` — review layout.
- `games/the-hollow/art/chapter-preview.js` — review controls and in-memory preferences.
- `games/the-hollow/art/chapter-preview.json` — sample catalog, map and seven ending views.
- `tools/build-chapter-preview.mjs` — deterministic fixture generator.
- `test/the-hollow-chapter.test.mjs` — nine presentation tests.
- `games/the-hollow/art/CHAPTER.md` — this guide, mappings and commands.

Step 7 (quality, performance and accessibility) is not included in this update.

## Image mapping

| Screen | Source photograph |
|---|---|
| Title / prologue | dark_street/dark_street (8).jpg |
| silence | cursed_church/cursed_church (1).jpg |
| reverse | horror_hallways (1).jpg |
| bargain | cursed_church/cursed_church (5).jpg |
| destroy | cursed_church/cursed_church (2).jpg |
| escape | Graveyard/Graveyard_4.jpg |
| doom | cursed_church/cursed_church (3).jpg |
| wipe | Graveyard/Graveyard_6.jpg |
