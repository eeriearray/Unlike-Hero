# Step 0 — asset preparation

Run from the repository root (Node 18+, Python 3, FFmpeg/ffprobe, cwebp):

```sh
brew install ffmpeg webp
node tools/build-assets.mjs --source "$HOME/Desktop/horror game assets"
node --test test/the-hollow-assets.test.mjs test/the-hollow-engine.test.mjs test/the-hollow-server.test.mjs
npm start
```

Open http://localhost:8080/games/the-hollow/ (or the port printed by the server).
The game should look and play exactly as before. Scene selection is Step 1.

`tools/hollow-asset-packs.json` is the editable pack inventory and licensing gate.
Every ZIP is extracted in a temporary directory after path/symlink/size validation.
Excluded packs are not extracted. Raw originals never enter the served game directory.
The temporary directory is removed even when a build fails. 7z is explicitly excluded.

The deterministic starter selection takes eight backgrounds per pack, up to 100
other images per pack, and up to 18 sounds per pack unless the pack declares an exact
`audioSelection` list. Step 4 curates audio by source path, avoiding duplicate WAV/OGG
exports and the unused full music mix. Missing selected sources fail the build. Preview files, duplicate large
overlay sizes, hidden metadata and unsupported types are skipped. This is an initial
library, not the final artistic mapping. Review `manifest.json` for included source
paths, excluded packs and selection/budget omissions. No final place or item mapping
is asserted in Step 0. Adjust selection in the script when choosing art in later steps.

Pictures become WebP at quality 80, max 1920 pixels wide, retaining aspect ratio and
alpha. Pixel packs use lossless WebP. WAV/OGG/MP3 become MP3 through FFmpeg's libmp3lame.
Fonts are copied unchanged. IDs include a source-path hash to avoid filename collisions.
The build enforces a 39 MB media cap and a 40 MB media-plus-manifest cap. It preserves
old output if conversion fails, and replaces only its own generated directory after
successful conversion. Stop the local server during rebuilds to avoid transient requests.

Generated binaries are ignored by Git because public distribution is not cleared.
A fresh checkout must run the script before the asset smoke test. The committed
manifest documents this local build; the browser catches missing-file errors and keeps
procedural art. Do not publish it with stale/missing binaries: rebuild for deployment
only after resolving the CREDITS.md licensing gates. No public build mode is supplied.

`HollowAssets.ready` loads metadata only. `get(id)`/`url(id)` return null for unknown
IDs. `load(id)` returns a loaded Image or audio/font ArrayBuffer, or null on failure.
Keep the SVG/synth fallback until the promise succeeds; catch audio decoding failures.
`preloadRegion('village')` loads only that region's images, sequentially;
`releaseRegion('village')` releases registry references. Shared media is on demand.
Future stage/audio consumers use this API; the existing renderer uses its whitelist
through the small `js/scenes/assets.js` compatibility bridge. No audio replacement,
region transition hook or scene redesign is activated in Step 0.

A missing listed file necessarily makes one unsuccessful request before the browser
can know it is missing; it then falls back. Unlisted IDs never make a media request.
The smoke test catches stale listed files before deployment. The manifest request
itself is optional and safely falls back if absent or malformed.

Place background/hotspot coverage tests belong to Step 1, when those mappings exist.
The Step 0 test checks payload, file existence, licensing exclusions and registry failure
behavior without changing any deterministic engine data.
