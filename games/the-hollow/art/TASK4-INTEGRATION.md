# Task 4 delivery — inspected and integrated

## Current update: audited production pack v2

Installed `the_hollow_task4_production_assets (1).zip` using the separately supplied `manifest.json`, retained as `task4-delivery-manifest.json`. All 188 archive members match their SHA-256 hashes. Compared with the original archive, 77 runtime sources changed: all 66 item variants (22 items × three sizes), nine WAV cues, and two effect textures. Three contact sheets also changed. Existing IDs and mappings connect these replacements to inventory, merchants, journal, rewards, ambient sound, and action feedback. No engine or save changes are required.

The 137 prepared media files and 29 sanitized vector symbols are installed. Painted 1024px detail masters use quality-92 WebP with lossless alpha; smaller variants, UI, and effects remain lossless. Source masters remain in the user ZIP. The combined runtime payload is 35,866,261 bytes, below the 40 MB budget. Import preparation is staged and validated before runtime files are replaced. The importer accepts the delivery manifest as its second argument and records source/prepared hashes. Content-versioned media URLs prevent browsers from retaining older replacements.

All 126 Hollow tests pass, including delivery provenance, prepared-file integrity, cache invalidation, alpha/dimensions, sound mappings, and opening progression. The source WAV peaks are now all below -3 dBFS (village bell: -3.5 dBFS); the existing 0.85 preparation gain remains. No waveform was clipped.

The manifest’s “Task 3 pending” note is stale: the installed character cast remains complete. The new pack supplies no belfry interior, maintenance-passage illustration, or distant-crow recording, so those gaps are not marked resolved. The updated painted items supersede the flat-item observations below.

Rebuild this delivery with:

```sh
python3 tools/import-hollow-task4.py "/path/to/the_hollow_task4_production_assets (1).zip" "/path/to/manifest.json"
```

## Original delivery record (historical)

Tasks 1, 2 and 4 are installed. Task 3 now supplies the full six-hero/ten-enemy cast plus four NPC portraits. See FINAL-ASSET-GAPS.md for the combined review.

## Evidence and scope

Source: `the_hollow_task4_production_assets.zip`, supplied by the user with a separate Markdown specification. `task4-import-report.json` records its SHA-256, actual runtime media entries, and measured WAV properties. `task4-delivery-specs.md` preserves the supplied specification as reference data; its claims were checked against files rather than treated as instructions.

The archive contains 188 files: four contact sheets, 66 item PNGs (22 at each of 1024/256/128px), 36 UI files (18 PNG/SVG pairs), 58 icon files (29 PNG/SVG pairs), 12 effect images/sheets, and 12 WAV files. It does not contain an additional machine-readable manifest; the importer supplies one.

Prepared 137 lossless WebP / Ogg Opus media files, plus 29 sanitized inline vector symbols. The central manifest remains the only media allowlist. New prepared files add approximately 5.1 MB; the combined media payload stays below the existing 40 MB budget. Archive extraction checks paths, symlinks and expansion size. No supplied source code is executed.

## In-game integration

- All 22 items use matching Task 4 illustrations. Normal icons use 128px images, larger icons 256px; 1024px detail masters remain registered. Existing inventory, merchant, reward and journal rendering share these mappings. SVG fallbacks remain on failed image loads.
- Panels, action cards, selected cards, inventory slots, buttons and journal paper use the supplied textures with nine-slice geometry. Keyboard focus retains a clear CSS outline; borders do not replace readable labels.
- Validated vector symbols replace matching HUD, navigation and action glyphs. Map node states use current/available/visited/base symbols. Hidden locations are not revealed. Unsupported legacy symbols retain their existing drawing.
- Audio uses the shared gesture-unlocked context and user volume buses. Bell, paper, footsteps, doors, locks, discovery, danger, rope and bell-frame sounds are mapped to matching events. The well loop follows the square/moonwell rather than replacing every region's ambience. Full cue lengths are preserved. Personal-objective completion sounds once on a fresh completion, not on resume.
- Injury, low-Sanity edges, appropriate ambient mist/dust, a carried-lantern glow, and a broken-mirror overlay use supplied static layers. Full Sanity leaves the background clear. Discovery/completion accents are restrained and respect reduced settings. Rain, presence shadow and animated sheets are registered and available for appropriate future narrative integration; they are not applied indiscriminately.
- A browser check exposed a pre-existing narrow-screen Pack button bug: it toggled a hidden desktop drawer. It now opens the matching character/journal tab on narrow layouts.

## Quality observations for the later combined review

The item set is coherent, recognizable, and largely flat/stylized rather than detailed painted illustration. Confirm its stylistic fit when Tasks 1–3 arrive. Some silhouettes differ from the verbose descriptions in the supplied specification; use the actual images as the reference.

All WAV files are non-silent 48kHz 16-bit mono/stereo. Source peaks do not clip; the village bell slightly exceeds the stated -3 dBFS ceiling (measured -2.85 dBFS), so preparation applies 0.85 gain before Opus encoding. These are supplied procedural/modal cues, not microphone-recorded foley. The well loop has nonzero endpoints and is played with gain fades; subjective loop/sound quality still needs listening in the final mix.

Distant crows were explicitly omitted by the supplier. Existing audio packs and later deliveries must be checked before concluding that new generation is needed. Source-reference/style comparison was not possible for the supplier because Tasks 1–3 were not supplied to that task.

## Review and rebuild

Open `art/task4-preview.html` to inspect every item, component, symbol and effect and audition all 12 prepared sounds. Original WAV/PNG masters remain in the user's source ZIP.

Reimport with:

```sh
python3 tools/import-hollow-task4.py /path/to/the_hollow_task4_production_assets.zip
```

Run this after rebuilding the original base-media manifest; the base importer otherwise replaces that manifest. The importer is idempotent and preserves unrelated manifest entries. Configuration lives in `art/presentation.json`, `art/feedback.json`, and `js/audio-map.js`.

## Delivery tracking

| Task | Status | Final gap review |
| --- | --- | --- |
| 1 — Village, estate, opening close-ups | Delivered and integrated | Combined review complete |
| 2 — Remaining regions and endings | Delivered and integrated | Combined review complete |
| 3 — Characters and enemies | Full cast integrated | See FINAL-ASSET-GAPS.md |
| 4 — Supporting assets | Imported, integrated, regression checked | Provisional observations recorded above |

All four deliveries have now been inspected. The consolidated generation list is in FINAL-ASSET-GAPS.md; the Task 3 replacement completes cast coverage.
