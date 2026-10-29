# ChronoLink chamber forge

Offline tools that produced the Undercroft (chambers 12–19). They are not loaded by the game.

- `fast-solve.mjs` is a fast solver for the crate/plank/crack subset of the rules. It reports the same real-action costs as the game's `solve(…, { realMoves: true })`.
- `compare.mjs [count]` checks the fast solver against the game's solver on random rooms. Run it after changing either.
- `forge.mjs x <rng> <minutes> out.json` evolves a room from scratch. Pass a previous `out.json` in place of `x` to keep improving it.
- `simplify.mjs in.json out.json` turns every crack, leak, trench or rubble tile into floor or wall wherever that leaves the puzzle just as long.

Verify every pick with the game's solver and the ChronoLink tests before adding it to `CHAMBERS`.
