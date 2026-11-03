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

| Own It pass | Done, needs a human verdict | Requested by the user after "looks AI made, not fun". Run-through buying, combo up to x10, inventory (I), Style Counter in every shop, 54 wearables and pets, mystery boxes, throwing cash (hold G), pink GPS route (J toggles). Viewed in the browser; online rooms carry purchases and outfits between tabs. Full online match not played to the 8:00 end this pass |
| Refund Office and gold city | Done, needs a human verdict | Requested with "keep going". Agents chase you from $25B spent (up to 5), hand back up to $3B a catch and $30B a day; shops are safe, sprinting outruns them early, fast cars flatten them. Pace line, gold coat on owned and cleared buildings, fewer HUD boxes. Agents never stood inside a wall across a 40 second chase; a bot still wins all 25 tested seeds carrying the full $30B back |
| Street-level pass | Done, needs a human verdict | User set the vision: "GTA like game where the goal is to spend as much money as possible", and asked for less AI look and correct arrows. Arrows fixed and checked on 26 routes (1,956 of 1,960 point along the route, the rest sit on corners; no route doubles back). Tilt-shift removed, film grade, muted real-material palette, sharper buildings, shop-sized signs, taller skyline, traffic lights, parked cars, street furniture, rooftop clutter, satirical billboards, adult proportions, lower camera, rotating rectangular minimap, heat stars, no pill HUD |
| Phone and jobs | Done, needs a human verdict | User chose missions next. 14 scripted jobs from 5 contacts, timed, with rewards (combo, Refund Office stands down, a vehicle, 4 gift items). Y takes a call, U hangs up. Guide follows the active job. Solo modes only. Played start to finish in the browser by a scripted player |

## Measured

- After the art pass, driving across the city at High, Apple M4, 946x492 at 2x: 60 FPS median, 60 minimum, worst frame 19 ms, about 100 draw calls and 117k triangles on that drive. Wide aerial views reached 161 draw calls and 136k triangles.
- Heaviest case after the Own It and Refund Office passes (5 agents, 3 pets, driving, High, 1892x984, Apple M4, GPU forced to finish each frame): 13.3 ms median, 18.4 ms at the 95th percentile, 52.7 ms single worst frame, 231 draw calls, 543k triangles. Triangles are well above earlier passes, which is a risk on integrated graphics.
- Street-level pass, driving on foot at High (1.6x render scale, 1513x787 buffer, Apple M4, GPU forced to finish): 13 to 17 ms median, 19 to 25 ms at the 95th percentile, about 30 ms worst, 130 draw calls, about 500k triangles. At the old 2x scale the same view took 22 ms, so render scale was reduced. Boot is now about 1.2 s, up from under 0.1 s, because the street is laid out at load.
- Boot to first playable: under 0.1 s from localhost (`window.__trBootMs`).
- Solver, 100 seeds: 100 wins, average 16.1 minutes, worst 17.1, average spent $999B.
- Visible-only bot, 100 seeds: no wins, at least $529B left, average spent $585B. All-earners bot: no wins, at least $293B left. All extras together cap at about $101B, so visible deals plus every extra still leave over $400B.
- Complete solo run through the real client (solver decisions, seed 2026): won at 12:35, $1.038T spent, 27 secrets, no page errors. This predates the art pass; only the layout tests, solver and scripted views were rerun after it.
- Battle Spend, 8 real minutes, two tabs and a bot: reached 8:00, Host won on lowest balance ($159B against $164B and $258B), attack cards and auction bids landed, no page errors. Also before the art pass.

## Known limits

- Whether it is actually fun has not been judged by a person since the fun pass. Scripts prove the systems fire, not that they feel good.
- Jobs have not been played by a person. Deadlines and how often the phone rings are guesses, and the story order may feel wrong in play.
- Refund Office chases were checked with scripted frames, not played by hand. How often a catch feels fair is a guess until someone plays it. Day length is still 24 minutes: a human has not yet proved 24 is even winnable, so it was not shortened.
- FPS has **not** been measured on integrated graphics, which is what the brief's target names. Quality levels and the automatic drop exist; they were switched by hand, and the automatic drop never fired because FPS never fell.
- Nobody has played a full day by hand. The feel checks were scripted input through the real controls, and the win came from a bot. "A first-time player cannot easily finish it" rests on the bots, not on people.
- Real gamepads and real touch screens are untested.
- The visible-only bot spends about $600B, above Part 6's $300B to $450B, because Frenzy adds about $160B on top of $440B of visible deals. It still leaves well over the required $400B.
- Battle Spend clients build the city from the seed, so a determined cheater could read secret spots from their own browser. The server still refuses a purchase or discovery whose conditions are not met.
- Attack card targets are picked automatically (the richest or poorest rival), and Ban targets the rival's current shop or district, rather than a choice on screen.
- The base of this branch is 114 commits behind `main`. Expect `README.md` and the generated registry to conflict on merge: keep both sides, then run `npm run registry`.
- Two Putt Club tests fail on this branch (`sand grabs the ball`, `tees, cups and power-up crates`). They fail the same way at the branch's base commit and pass on current `main`.

## Audit against the brief: known gaps

Closed and viewed in the browser (seed 3): giant walkable globe in the Global Trade Tower lobby (height follows the sphere up to 13, camera stays outside it); Race Track oval with kerbs, chequered line, grandstand and four race cars; Fire sale and Surprise auction shown by a beam of light, a minimap dot and a labelled marker on the full map, cleared when the event ends; owned ground vehicles driving in traffic as themselves; earning buildings get neon and lit doors, money-losing ones get planks and dark doors; graffiti walls with the real clue sprayed on them; a repeating chalk eye near hidden doors, which writes a notebook entry on the second sighting; big queued trophy popup; helicopters at the $100B+ deal and each $100B milestone.

Still open:

- Part 9: FPS not measured on integrated graphics, real gamepad and touch untested, no human has won a run.
- Changed at the user's request: no interest, all sales indoors, rounded rather than blocky, walk-in doors.
