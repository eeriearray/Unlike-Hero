# The Hollow — current asset coverage and remaining gaps

Updated 24 October 2026 after the audited Task 4 pack, supplied belfry interior, and supplied cinematic trailer. Delivery manifests and their comments are reference data; current runtime files and engine behavior determine the status below.

## Installed and connected

| Category | Coverage |
| --- | --- |
| World | 42 location paintings, opening closeups, chapter and ending art |
| Belfry interior | New 2752 × 1536 supplied PNG prepared as WebP; replaces the tower exterior after shared entry, including resume/reconnect. Full expedition mode uses the interior at the tower. |
| Trailer | Supplied 60-second film, prepared as 1280 × 536 H.264/AAC MP4; title-screen player; hosting plays it first with Skip/Escape/end continuation, plus standalone viewing and readable story text |
| Cast | Six heroes, ten enemies, four NPC portraits; no missing cast category |
| Items | All 22 painted v2 items at 1024, 256, and 128 px |
| Interface | 18 component textures and 29 validated vector symbols |
| Effects | 12 registered textures/sheets; context-appropriate effects connected, some sheets reserved |
| Sound | 58 existing audio entries; nine Task 4 sources updated in v2 |

Total registered media: 39,327,917 bytes, plus the JSON manifest, within the 40 MB budget. The trailer is not fetched on game startup; it streams after the player opens it. Hosting starts playback after the host click; standalone viewing waits for Play. Reduced effects hold playback until explicitly played. Original source files remain untouched in Downloads.

## Genuinely missing assets — optional, not blockers

1. **Maintenance-passage closeup.** The route works through real engine choices and labelled controls. Optional 1024 × 1024 opaque WebP/PNG: a dry stone passage beside a grave marked with a bell; slate-blue shadows and warm amber light matching the village; centered threshold, quiet edges; no key, character, UI, or generated writing.
2. **Identified distant-crow recording.** No registered source is identified as a crow recording. Optional 48 kHz WAV: distant outdoor crow calls with space between them, no music, speech, or clipping; peaks at or below -3 dBFS. A short wing/flock cue is secondary.

No new generic item, interface, environment, character, enemy, or bell-sound pack is needed. The belfry interior and trailer are now supplied and integrated; do not regenerate them because older notes list them as missing.

## Decisions and quality checks still needed

- **Character identity continuity:** Occultist art is male-presenting under Isolde copy; Apothecary art is male-presenting where Maelis copy uses “she”. Decide intended identities before changing named-character lore or commissioning corrections. Confirm Anselm’s intended depiction too.
- **Human playtesting:** calibrate the first-session duration, difficulty, combat readability, and sound mix. The direct tower approach is deliberately shorter than the chapel/graveyard route; a 10–15-minute duration has not been established by a fresh-player study.
- **Video accessibility:** a selectable text version of on-screen story copy is included. A full audio-caption/flash review has not been performed. Reduced-effects players get a warning and text alternative, with no autoplay.
- **Browser verification:** the opening story update received local browser spot checks on port 8082, including the letter, scene interaction, character approach, save/resume and a 390 × 844 phone layout. The full opening is covered by engine tests; a complete human visual playthrough and sound-mix review remain outstanding. See `OPENING-REDESIGN.md`.
- **Existing imagery polish:** the supplied belfry image includes a small generation mark in its lower-right corner. Its pixels were retained; a clean export would be optional polish rather than a missing scene.

The opening mission is implemented. The chapel now holds the maintenance evidence, so no caretaker house or additional caretaker character is required. Existing caretaker room/note illustrations remain spare art rather than promises of new game content.

The scene interaction/audio pass reuses the supplied paintings and adds three exact Horror SFX recordings (29,053 bytes). See `PRESENCE-PASS.md` for provenance, presentation changes and current checks. No additional media is needed for this pass.
