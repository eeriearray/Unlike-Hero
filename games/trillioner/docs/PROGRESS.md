# Trillioner: progress

Resume here. Work happens on branch `claude/trillioner-game-build-0e4dcf`. Run the hub from this worktree with the `hub-8090` preview
config, and restart it after changing `engine/` or `server/`, because the server keeps the engine it loaded. Debug: `games/trillioner/?debug=1`.
`TR.app.advance(seconds)` steps the game synchronously, for testing a hidden preview.

Tests: `node --test --test-force-exit test/trillioner-*.test.mjs`. Simulators: `node games/trillioner/tools/solver.mjs 100` and
`node games/trillioner/tools/balance.mjs 100`.

| Milestone | State | Evidence |
| --- | --- | --- |
| M0 Setup | Done | Opens from the hub and from file:// (headless Chrome: HUD live, $1T balance); ledger tests pass |
| M1 Feel | Done | Played in preview: walk to pad, hold E, car arrives, boards, reaches speed 45, drifts |
| M2 Economy | Done | Balance tool runs whole days; browser run: broke, frozen window, results, Clout saved, persisted after reload |
| M3 All 8 districts | Done | Content test: 8 districts, exact budgets. Preview: every district rendered, flood fill connects doors and pads on foot and by car, 40/40 rooms enter and exit |
| M4 Usable things | Done | 21 usable things. Preview: all 17 vehicles driven at spec speed; every ability and gear item exercised |
| M5 Secrets | Done | Solver 100/100. Preview: Mr. Grey, sunken vault, clock tower, asteroid, broker, corner towers and mole chains played |
| M6 Meta and polish | Done | Preview: menus, tutorial, Clout shop, settings, quality levels, Daily City, Free Roam, Trophy Room |
| M7 Battle Spend | Done | Socket tests pass. Two browser tabs completed matches, including a mid-match reload that reclaimed the seat |
| Art pass | Done | Requested after M8: sRGB lighting, sky dome, clouds, tiled ground, road markings and zebra crossings, new building shapes, characters, cars, pads, rooms, HUD. Viewed in every district, at dawn, day, sunset and night, and in a room |
| Fun pass | Done, needs a human verdict | Requested after playtest. Goods on display, haul line, building moments, rampage and fines, dares, receipts, filled lots, birds, balloons, blimp, smoke. Exercised by scripted input in the preview; 60 FPS with a full haul while wrecking cars, 113 draw calls, 122k triangles |
| Second art pass and walk-in doors | Done | Post-processing, surface detail, glass, round trees and clouds. 60 FPS at 1892x984 on High (M4), up to 142 draw calls and 214k triangles. Camera checked at 1,040 door and pad positions: never inside a collision box |
| M8 Finish | Done, with limits below | FPS measured on one machine; gamepad checked with a stubbed pad; touch checked with synthetic touch events |

## Measured

- After the art pass, driving across the city at High, Apple M4, 946x492 at 2x: 60 FPS median, 60 minimum, worst frame 19 ms, about 100 draw calls and 117k triangles on that drive. Wide aerial views reached 161 draw calls and 136k triangles.
- Boot to first playable: under 0.1 s from localhost (`window.__trBootMs`).
- Solver, 100 seeds: 100 wins, average 14.3 minutes, worst 15.2, average spent $1,054B.
- Visible-only bot, 100 seeds: no wins, at least $583B left, average spent $602B. All-earners bot: no wins, at least $318B left.
- Complete solo run through the real client (solver decisions, seed 2026): won at 12:35, $1.038T spent, 27 secrets, no page errors. This predates the art pass; only the layout tests, solver and scripted views were rerun after it.
- Battle Spend, 8 real minutes, two tabs and a bot: reached 8:00, Host won on lowest balance ($159B against $164B and $258B), attack cards and auction bids landed, no page errors. Also before the art pass.

## Known limits

- Whether it is actually fun has not been judged by a person since the fun pass. Scripts prove the systems fire, not that they feel good.
- FPS has **not** been measured on integrated graphics, which is what the brief's target names. Quality levels and the automatic drop exist; they were switched by hand, and the automatic drop never fired because FPS never fell.
- Nobody has played a full day by hand. The feel checks were scripted input through the real controls, and the win came from a bot. "A first-time player cannot easily finish it" rests on the bots, not on people.
- Real gamepads and real touch screens are untested.
- The visible-only bot spends about $600B, above Part 6's $300B to $450B, because Frenzy adds about $160B on top of $440B of visible deals. It still leaves well over the required $400B.
- Battle Spend clients build the city from the seed, so a determined cheater could read secret spots from their own browser. The server still refuses a purchase or discovery whose conditions are not met.
- Attack card targets are picked automatically (the richest or poorest rival), and Ban targets the rival's current shop or district, rather than a choice on screen.
- The base of this branch is 114 commits behind `main`. Expect `README.md` and the generated registry to conflict on merge: keep both sides, then run `npm run registry`.
- Two Putt Club tests fail on this branch (`sand grabs the ball`, `tees, cups and power-up crates`). They fail the same way at the branch's base commit and pass on current `main`.
