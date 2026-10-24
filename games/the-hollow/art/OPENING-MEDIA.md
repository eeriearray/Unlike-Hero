# Belfry and trailer integration

Sources supplied by the user:
- `Gemini_Generated_Image_mbbecumbbecumbbe.png` — 2752 × 1536 belfry interior.
- `thornwick_cinematic_trailer.mp4` — 60 seconds, 1280 × 536, 24 fps, H.264 video and stereo AAC audio; source size 59,165,731 bytes.

The image was encoded as quality-90 WebP at its original dimensions. The trailer web copy preserves resolution, aspect ratio, frame rate, duration, and audio, using two-pass H.264 at 330 kbps and AAC at 64 kbps with fast-start metadata. The web copy is 3,012,829 bytes. Originals are unchanged. A 1-second frame supplies the static poster.

All three derivatives are in the central allowlist with source and prepared SHA-256 hashes. Combined media stays below 40 MB; videos cannot be prefetched through `HollowAssets.load` or region image preloading. The server now supplies `video/mp4` and supports byte-range requests for playback/seeking.

The title has **Watch trailer · 60 seconds**; the separate **Read the prologue** button has been removed. Standalone trailer viewing remains optional. Every **Host an expedition** click opens the trailer first and starts playback; **Skip trailer**, Escape, or reaching the end continues into hosting exactly once. The room is created only after that continuation. If the browser blocks playback, Play and Skip remain available. Reduced-effects preferences hold playback until the player chooses Play or Skip. Joining, resuming, and solo entry remain unchanged. The film fills a borderless viewport, with feathered edges and a blurred ambient backdrop sampled from the playing video. Native player chrome is removed. Small Play/Pause, sound, Close/Skip, and story-text controls remain accessible. K pauses/resumes; Space does the same outside buttons; M toggles sound. Escape, focus containment/return, a text version, and failure fallback are provided. Reduced effects use a static ambient poster. Watch trailer also begins playback on click. Closing removes the video source and releases playback. Backgrounding pauses it without autoresuming. Video starts with the user's master volume and mute setting; the game mix is temporarily silenced and restored without changing preferences. Reduced motion/scares exposes the text alternative and warns that the original video still contains motion and unsettling imagery.

The belfry backdrop follows authoritative shared entry. The guided opening keeps the exterior until `opening_entered`; then the new interior appears and persists after saving/resuming. Experienced mode already represents being inside the tower and uses the interior immediately. Narration now uses the engine's current location description rather than static exterior copy. The climb closeup uses the new interior too. Existing map/travel thumbnails retain the exterior as a location identifier. No invented hotspot is added to the picture.

Additional fixes: completed-opening guidance no longer sends players in the Estate or Heart back to the village; arriving at the Heart changes the objective to deciding the bell's fate. Existing unrelated work and source art are preserved.

## Validation

144 Hollow tests pass. New checks cover video registry behavior, source/prepared integrity, explicit autoplay, custom playback/sound and keyboard controls, ambient animation cleanup, muted/reduced settings, duplicate opening, close cleanup, delayed catalogue cancellation, load failure, background pause, keyboard focus, mixer restoration, entry-dependent scenery/narration, snapshot restoration, and Heart guidance. Full video/audio decoding completed without errors. Live HTTP Range request returned `206` with `video/mp4`.

The browser tool's security policy rejected local-preview access in this turn. No browser workaround was attempted; fresh visual playback and new UI screenshots remain unverified. An inspected frame from the actual web video is available at `art/validation/trailer-web-frame.png`.

## Rebuild

```sh
python3 tools/import-hollow-opening-media.py /path/to/thornwick_cinematic_trailer.mp4 /path/to/Gemini_Generated_Image_mbbecumbbecumbbe.png
```

Pillow and ffmpeg are required. Run after base asset imports; the Task 4 importer preserves this pack. See FINAL-ASSET-GAPS.md for the current, consolidated missing list.
