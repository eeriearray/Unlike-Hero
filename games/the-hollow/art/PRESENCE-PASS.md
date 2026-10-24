# Scene interaction and audio pass — 24 October 2026

## Asset audit

Compared `/Users/akshat/Desktop/horror game assets/` with the active manifest, scene metadata, sound mappings and import scripts. The provided environment packs, item/UI art, Mind’s Eye music, Horror UI SFX, Horror SFX and overlays were already represented. Retained the newer supplied Hollow paintings and cast rather than replacing them with mismatched stock or pixel sprites. Source-pack documents were treated as reference data; no bundled source code was executed.

Three previously unused recordings from `Horror SFX Free.zip` are now prepared and registered:

| Recording | Use |
| --- | --- |
| House & Office/Writing.wav | Fresh writing on the square notice after discovery |
| House & Office/Door_knocking_quiet.wav | Chapel record discovery |
| House & Office/Metal scrape_scratch.wav | Inspecting the grave marker |

`tools/import-hollow-interaction-audio.py` reads those exact archive members, prepares mono MP3 at 64 kbps with high/low filtering, −23 LUFS normalization, −3 dB true-peak target and short fades, and updates their byte counts, source/content hashes and region index. It preserves all unrelated manifest entries. The new recordings total **29,053 bytes**; registered media totals **39,327,917 bytes**, within the existing 40 MB limit including the manifest. Original archives remain unchanged. Existing credit/provenance records in `CREDITS.md` still apply.

## Visuals and interaction

- More of the supplied paintings’ original color is retained, with existing legibility gradients and reduced-effects controls.
- Repositioned opening chapel and graveyard hotspots over relevant depicted areas; the tower now has separate exterior/interior layouts. The frame, rope and ladder markers follow the supplied belfry painting after authoritative entry, including reconnect.
- Added the pictured tower door as an inspection target. It offers the existing force-entry check and, once discovered, the maintenance entrance. Outcomes and costs remain engine-controlled.
- Photo scenes pan toward inspected / keyboard-focused objects without enlarging the entire painting. Explicit Look left / Look right controls complement drag panning and action cards.
- All photo inspections show a real cropped detail or the supplied dedicated closeup, rather than hiding the image or fitting the entire environment into the card. A Magnify toggle permits closer examination without spending actions.
- Free sensory observations become evidence-aware after shared discoveries. No clue, reward, or new game progression is awarded by cosmetic inspection.
- Deferred same-place scene-layout changes until presentation holds release; asset failures retain procedural fallbacks.

## Audio

The square retains its supplied well bed; chapel and tower use existing creaking recordings with distinct quieter gain/filter profiles. Location ambience crossfades without restarting the ongoing music or replaying its introduction. Inspecting an object uses its authored sound and restrained screen-relative stereo placement. Hover no longer fires repeatedly when the pointer moves between children of one hotspot. All sources continue through the existing Master / Music / Ambience / Effects controls, captions, autoplay unlock and synthesis fallback.

The local `art/audio-preview.html` now auditions the three new recordings, rope/frame effects and the village room profiles.

## Verification

- 170 / 170 Hollow tests pass. New tests verify room changes preserve the music source, recording durations/spatial placement/captions/mute, separate authoritative tower layouts, non-leaking evidence-aware inspections and malformed metadata fallback.
- Full repository run: 578 / 580 pass. The same two unrelated Putt Club failures remain (cove-1 token resting drift; sand vs metal travel).
- Browser checks use port 8083 with a separate origin/save, preserving the expedition on 8082. Verified free inspection keeps all actions, Magnify state, supplied closeup rendering, scene navigation, pictured tower-door action, successful entry and interior object layout. Verified 390 × 844 free inspection / Magnify; moved phone inspection panels into the viewport and hid pan controls while inspecting to keep Close and action buttons unobstructed. Browser audio diagnostics confirmed recorded music / room beds running, 23 decoded cues, and selection/playback of all three new recordings; the audition was paused afterward.
- A subjective headphone mix review remains useful; automated playback/mixer checks do not establish listener preference.
