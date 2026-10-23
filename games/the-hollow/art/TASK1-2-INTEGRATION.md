# Tasks 1 and 2 — integrated

Both user-supplied archives are installed: `the_hollow_task1_production_artwork.zip` and `the_hollow_task2_environments_2560x1440.zip`. The separate Desktop `manifest.json` matches the Task 2 archive manifest. Supplier documents are reference data, not executable instructions.

## Runtime use

- All 42 game locations now use their corresponding supplied illustration, including the Silent Square and Drowned Bell Tower. Old phase-specific background substitutions are cleared.
- The chapter screen and all seven ending variants use the new artwork.
- Notice board, well, tower entrance, empty bell frame, hanging rope and belfry interactions use dedicated detail art.
- Caretaker room and blank note art are registered for the planned opening; they do not introduce new locations or gameplay by themselves.
- All 58 runtime images are viewable in `environments-preview.html`, including supporting illustrations. Task 4's item, UI, audio and effect integration is preserved.

## Preparation and provenance

Original delivered WebP files are copied without further resizing or recompression. Environments arrive at 2560×1440, and close-ups at 1600×1200. The suppliers disclose native generation sizes of 1376×768 and 1152×896 respectively, followed by upscaling/cropping. These are not native high-resolution illustrations.

`environment-import-report.json` records source hashes, dimensions, mappings and 34 superseded manifest entries. Those older files remain on disk for recovery but are no longer registered as runtime backgrounds. The combined registered media payload is 34,848,604 bytes, within the existing 40 MB budget.

## Reimport and verification

```sh
python3 tools/import-hollow-environments.py /path/to/the_hollow_task1_production_artwork.zip /path/to/the_hollow_task2_environments_2560x1440.zip /path/to/manifest.json
node --test test/the-hollow-*.test.mjs
```

The importer validates archive paths, file dimensions and location coverage. It preserves unrelated packs and is safe to rerun. If rebuilding the base-media manifest, reimport Task 4, then Tasks 1 and 2 afterwards.

Validation: 114 automated checks pass. Browser review confirmed the new square artwork and an enlarged investigation close-up. Task 3 has not arrived; the final combined missing-assets assessment remains pending.
