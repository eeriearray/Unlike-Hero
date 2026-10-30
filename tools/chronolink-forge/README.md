# ChronoLink chamber forge

Offline tools that produced the Undercroft (chambers 12–19) and the sluice rooms (26–28). They are not loaded by the game.

- `fast-solve.mjs` is a fast solver for the crate/plank/crack subset of the rules. It reports the same real-action costs as the game's `solve(…, { realMoves: true })`.
- `compare.mjs [count]` checks the fast solver against the game's solver on random rooms. Run it after changing either.
- `forge.mjs x <rng> <minutes> out.json` evolves a room from scratch. Pass a previous `out.json` in place of `x` to keep improving it.
- `simplify.mjs in.json out.json` turns every crack, leak, trench or rubble tile into floor or wall wherever that leaves the puzzle just as long.

- `fast-solve-water.mjs`, `forge-water.mjs`, `simplify-water.mjs`, `compare-water.mjs` and `water-room.mjs` do the same for crate rooms with running water, one sluice the Echo can jam and an optional drain. They call the game's own derivation and Echo actions, so they need no separate rules. `forge-water.mjs` keeps a room only when the jam is required and jamming before anything else is a dead end.

Verify every pick with the game's solver and the ChronoLink tests before adding it to `CHAMBERS`.
