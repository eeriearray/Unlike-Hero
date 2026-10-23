# Task 3 — full cast integrated

Current source: `the_hollow_task3_full_cast_55files.zip`. It replaces the earlier two-character sample pack. The 55 members comprise 52 individual PNG assets, two comparison sheets and one Markdown manifest. Supplied claims were treated as reference data and checked against actual image files.

Coverage: six playable classes, ten enemies, four NPC portraits. Every playable/enemy has a portrait, full figure and opaque silhouette preview. Full figures have alpha; portraits and silhouettes have solid backgrounds. Swarm and Hound use wide 2400×1800 figures and 600×450 silhouettes, and retain their aspect ratio. Other figures are 1600×2400. Portraits are 1024×1280. Native generation size is not disclosed. Source hashes, actual sizes, alpha bounds and runtime sizes are recorded in `task3-import-report.json`.

## Runtime use

- All six classes use supplied portraits in HUD/character views and full figures in selection.
- All ten enemies use supplied portraits in the compact live threat panel; full figures appear in the combat audition/gallery. Existing combat rules and reaction timing are preserved.
- Four NPC portraits are registered and viewable in the gallery; narrative encounters/dialogue still need explicit role mapping. No new NPCs or events were invented merely because portraits were supplied.
- Unknown characters or failed image loads retain the earlier art/insignia fallback. Full figures hidden by the live compact skin are not unnecessarily loaded.

To remain within the 40 MB media budget, full figures are resized to 800×1200 (wide figures 1200×900); portraits to 384×480. WebP quality is 88 with alpha retained. Opaque reference silhouettes use lossless WebP. Original PNG masters stay in the source archive. All 52 runtime derivatives total 2,309,004 bytes; registered game media totals 37,157,608 bytes, including earlier packs. The registry also fits within the budget.

## Review

Open `characters-preview.html` to review every figure and NPC, switch hero/foe, and audition reactions without loading or changing a save. Automated verification: 116 checks pass, including full coverage, real file sizes, wide-image dimensions, transparency, registry budget and unknown-ID fallback. Browser checks confirm the new cast loads and the wide Swarm displays without distortion.

The apothecary illustration is male-presenting while existing Maelis copy uses “she”; the Occultist still depicts a man under the existing Isolde identity. These are continuity decisions, not technical incompatibilities; story identity has not been rewritten automatically. Exorcist/Anselm's intended appearance should also be confirmed if strict named-character continuity is desired. Silhouettes are deliberately opaque comparison art; transparent silhouette exports are optional rather than blockers.

Reimport after base-media rebuilds:

```sh
python3 tools/import-hollow-characters.py /path/to/the_hollow_task3_full_cast_55files.zip
node --test test/the-hollow-*.test.mjs
```

The importer validates archive safety, known role IDs, complete character variants, sizes, alpha and total budget before committing. It preserves other packs. `FINAL-ASSET-GAPS.md` is updated to reflect the completed cast.
