# Trillioner: progress

Resume here. Work happens on branch `claude/trillioner-game-build-0e4dcf`. Run the hub from this worktree with the `hub-8090` preview
config. Debug: `games/trillioner/?debug=1`. `TR.app.advance(seconds)` steps the game synchronously, for testing a hidden preview.

| Milestone | State | Evidence |
| --- | --- | --- |
| M0 Setup | Done | Opens from hub and directly; ledger tests pass |
| M1 Feel | Done | Played in preview: walk to pad, hold E, car arrives, boards, reaches speed 45, drifts |
| M2 Economy | Done | 22 ledger tests pass; balance tool runs whole days; real run in preview: went broke, froze, results screen, Clout saved |
| M3 All 8 districts | Done | Content test: 8 districts, exact budgets, 421 items. Preview: all districts rendered, flood fill connects every door and pad on foot and by car (Hangar 13 walled by design), drove all 7 surface districts, 40/40 rooms enter and exit, pier walkable. Under City reached via debug only until M5 entrances |
| M4 Usable things | Done | 21 usable things (test). Preview: all 17 vehicles driven at spec speed; ladder, trumpet, wreck, smash, grind, launcher, cannon ($200M/s, stops), megaphone, umbrella, fast travel, rocket launch all exercised |
| M5 Secrets | Done | `tools/solver.mjs 100`: 100/100 wins, avg 14.3 min, worst 15.4. Visible-only left at least $400B on 100 seeds, all-earners never wins. Preview: Mr. Grey, sunken vault, clock tower, asteroid, broker, corner towers, mole chains played; notebook and map |
