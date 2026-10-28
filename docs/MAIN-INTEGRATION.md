# Main integration audit — 28 October 2026

The playable product is the repository root on `main`, served at http://localhost:8081.
All local branch tips were reviewed and are ancestors of the consolidated main commit. Original branches and historical worktrees remain available.

## Integration decisions

- Committed the previously uncommitted main game changes, banners, input fixes, difficulty settings, and canonical hub startup behavior.
- Merged Putt Club collision, course pickup placement, and sand-friction fixes (`621aa9c`). Imported seven additional uncommitted Putt Club files from its worktree: worker-based solo matches, incremental bot predictions, planner cleanup, and associated regression tests.
- RIFTBREAK lobby fix (`050d9a3`) was already present in the main working files. Merged its branch history.
- The Hollow reconnect fix (`fa28b3b`) is patch-equivalent to main's `0c33390`. Merged the multiplayer branch history while retaining newer main gameplay and UI.
- Sea of Chaos uses Plunder v6. Its current README, HTML, main script, simulation, renderer, and regression tests match the newer Sea branch. Merged that branch and regenerated the registry, retaining the new hub banner.
- Reviewed archived Dragon maps/mechanics: its game tree matches the later imported `5781c13` tree. Archived RECESS game files match the later imported `aa9f96d` tree. Archived Dragon gear/touch work has been replaced by subsequent gear, sprite, input, arena, and touch implementations in main. Recorded these historical parents without reverting current games.
- Archived Dock Wars and the older Flag Raiders branch are predecessors of Plunder. Their implementations remain in Git history; combining their incompatible rules into Plunder would restore obsolete gameplay.
- Old launch-file edits specify competing ports and worktree previews. Their history is preserved, and the active launch configuration now uses `npm run play` on 8081.
- The local multiplayer worktree's game changes are already in main or have newer settings/results implementations. Remaining worktree-only changes outside Putt Club are historical launch settings.

## Branch inventory

Every branch below is included in main's ancestry at the time of this audit.

| Branch | Reviewed tip |
| --- | --- |
| `all-games` | `0306a75` |
| `archive/dock-wars-wip-2026-10-28` | `dfb1848` |
| `archive/dragon-clash-game-dev-bb76d9-wip` | `91e88fb` |
| `archive/dragon-clash-maps-mechanics-95c689-wip` | `9a2d7c1` |
| `archive/practical-sinoussi-d81f69-wip` | `c4049d8` |
| `archive/recess-multiplayer-hub-408a46-wip` | `0a76fab` |
| `claude/blissful-mahavira-89a964` | `b08f911` |
| `claude/chatgpt-link-request-454b4f` | `050d9a3` |
| `claude/crownfall-cart-polish-06d728` | `5f364c4` |
| `claude/crownfall-cockpit-mine-visuals-4c4a40` | `908f695` |
| `claude/crownfall-kart-audio-camera-e565b7` | `e7895ca` |
| `claude/crownfall-visual-quality-e62a2f` | `f1f6092` |
| `claude/dragon-cpu-stuck-ai-02f0f7` | `44578a2` |
| `claude/hollow-game-assets-21edb3` | `0306a75` |
| `claude/hollow-game-multiplayer-f0b8a5` | `ff90ade` |
| `claude/hollow-game-testing-6832b2` | `348b4b4` |
| `claude/hollow-gameplay-simplify-76f805` | `ec8a787` |
| `claude/hub-add-dragon-clash` | `28768df` |
| `claude/local-multiplayer-server-ca8cdd` | `44578a2` |
| `claude/mafia-game-premium-5c1ba1` | `f0688f7` |
| `claude/putt-party-ball-physics-c906bf` | `621aa9c` |
| `claude/same-sea-chaos-gameplay-7a4da3` | `03c5ae9` |
| `claude/sea-of-chaos-gameplay-f94cc6` | `6e490bc` |
| `hollow-chatgpt-work` | `ffb394c` |
| `main` | `98100c2` |

## Verification

- `npm test`: 694 passed, zero failures, zero skipped.
- Targeted Putt Club suite: 51 passed, including regression coverage for retired balls, course pickups, friction, resumable predictions and bounded bot planning.
- Headless Chrome checked the hub and all 11 registered game entry pages on localhost:8081: HTTP 200, no JavaScript runtime errors, and no failed local HTTP requests.
- Putt Club solo Web Worker started a four-player match, accepted the start command and streamed 102 snapshots with no worker or page errors.
- Checked 370 local HTML/module references. All file references exist; four Socket.IO URLs are served dynamically and loaded successfully in the browser checks.
- `git diff --check`: clean.
- No local or fetched remote branch tips remain outside main's ancestry.
- Confirmed the listening process on port 8081 uses the primary repository root.

Local generated playtest output and Python caches are ignored, rather than included as game source. Browser entry checks and automated tests do not exhaustively cover every multiplayer gameplay path. This consolidation is committed locally; no remote push was performed.
