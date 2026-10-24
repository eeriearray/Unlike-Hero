# Integrated local playtest checkout

The active checkout is `/Users/akshat/Desktop/unlike hero` on `hollow-chatgpt-work`, served at `http://localhost:8081/games/the-hollow/`.

The earlier character cleanup was delivered separately under `output/character-alpha-cleanup-2026-10-24` and had not been applied to live media. All 16 reviewed full-body WebP files are now installed byte-for-byte. `character-alpha-cleanup.json` preserves their source provenance and expected hashes. The manifest includes those hashes so an ordinary reload fetches the corrected images instead of an old cached copy. The character importer preserves these reviewed derivatives when processing the original archive.

This checkout also includes the opening mystery and progression, supplied scene paintings, audio and opening video, scene interaction and camera polish, the warning-from-tomorrow prologue, discovery effects and jumpscares. Runtime files referenced by the manifest are committed locally with the code so a checkout retains the same presentation. The licensed asset inventory in CREDITS.md still applies; nothing has been pushed or published.

The dedicated multiplayer reconnect/restart recovery commit is also integrated before final validation. Changes to other games in the workspace are kept outside the Hollow commits.

Validation includes runtime hashes for every reviewed cutout, manifest byte counts and media budget, Hollow behavior tests, and Wren viewed against the actual game background. Screenshot: `validation/medium-alpha-live.png`.
