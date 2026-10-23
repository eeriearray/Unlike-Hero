# The Missing Bell — opening redesign

New browser expeditions default to the guided opening. The host can select **Experienced players: start with the full expedition** in the character lobby. Existing saves and engine callers that omit `opening: true` retain the full game.

## Playable flow

1. Arrive at the Silent Square after following a summons. Read the notice board: a chapel maintenance lead survives even a failed check. Your name appears on the notice in the action result and journal.
2. Search the existing chapel vestry. Whether the roll succeeds or fails, a record points to a bell-marked grave. Normal item rewards still require success.
3. Read the existing graveyard headstones. Even on failure, discover a maintenance passage. Travel to the tower and take its certain, one-action entrance.
4. Alternatively, go straight to the tower and force its entrance. Success opens the door; failure also opens it, costing 2 Health. Critical failure adds the engine's normal Clock complication.
5. Examine the empty frame. Success or failure reveals the shared grave-iron clue, completes the opening, and opens the wider expedition. The unsettling sound is communicated in text, so audio and effects are optional.

Four existing locations replace the proposed five-location structure: the chapel contains the maintenance records, avoiding an invented caretaker or unnecessary new house. Discoveries can happen in any order, and the force entrance permits a short route. Duration has not been calibrated with new-player sessions; the direct route can be much shorter than 10–15 minutes.

## Authority and persistence

`w.opening` holds versioned, party-shared booleans. `recordOpening` runs inside normal authoritative option resolution, even if a failed action makes the finder fall. `openingObjective()` derives current context and hints from that state; clients do not infer clues from animation history. Existing claims, command IDs, snapshots, and reconnect views retain exactly-once rewards. Private objectives and unrelated clues retain their original privacy rules.

All normal travel modes use the engine's restricted graph during the opening; the view limits map nodes, moves, and sprint destinations to the four locations. The map marks the known objective. Completion widens the available graph; the rest of its fog of war remains intact.

Village starting enemies at the graveyard and tower are omitted in guided mode, cross-boundary enemy movement is blocked, and round omens wait until the milestone. The Clock still advances between rounds and from explicit costs. Experienced mode retains the original encounters. This is a deliberate quieter tutorial, not a combat tutorial.

Solo idle and held-roll deadlines are disabled. The client requests automatic advancement only after animations settle and the player leaves decisions, maps, drawers, upgrades, and modal choices. A resolved location result may close automatically. Other encounters require Continue. The engine independently validates automatic requests: solo only, zero actions, no pending upgrade/vote/held roll/unresolved encounter. Manual turn ending remains available. One human with ghost companions also uses this reading-time policy; multiplayer keeps timed turns.

## Presentation

Supplied environment paintings, closeups, item assets, cast, and registry are retained. New entrance actions use labelled controls; no invented hotspot is placed over an absent prop. The persistent objective shows arrival context, concrete next steps, action count, Clock, and optional mechanics help. A roll confirmation includes cost, numeric chance, and authored failure stakes. Result text retains story and information lines; the journal preserves the record. The prologue and HUD tips remain replayable but no longer interrupt a new game. Upgrade choices appear beside the mission when earned. Phone choices use two columns and normal vertical scrolling.

## Validation

- 124 Hollow tests pass, including eight added opening/turn tests: failed-roll completion, alternate entry, gated tower interior, shared out-of-order discoveries, snapshot/reconnect, duplicate reward prevention, fallen finder, old-save compatibility, solo/multiplayer deadlines, and automatic-turn guards.
- Browser: start without forced prologue; opening actions and numeric risk confirmation; force entrance; frame milestone; expanded roads; refresh and resume; upgrade selection; automatic turn reset from 0 to 3 actions and Clock 1 to 2; 390 × 844 iframe inspection.
- Existing feedback tests exercise reduced motion/scares. No new jump-scare animation is introduced.
- Full repository suite: 531/533 pass. Two failures are outside this game: `putt-club-courses` (cove-1 resting token) and `putt-club-physics` (sand versus metal).
- Screenshots are in `art/validation/`. Browser testing used port 8081 to preserve the pre-existing game/save on port 8080.

## Remaining limitations and genuine asset priorities

1. **P1: wide belfry interior.** The supplied tower exterior and frame closeup exist, but the location backdrop remains an exterior after entry. Request a 2560 × 1440 (16:9) painted interior matching the supplied slate/amber village: empty iron yoke, rope descending out of frame, grave-iron marks, no hanging bell. Opaque WebP/PNG, no transparency; keep upper left quiet for location/result copy and lower third calm for controls. This is a continuity improvement; do not replace the supplied art with a procedural scene.
2. **P2: maintenance-passage closeup.** Optional 1024 × 1024 opaque WebP/PNG, same painterly slate/amber lighting. A dry, narrow stone passage beside a grave with a bell mark; no key, character, readable text, or UI. Center the threshold with uncluttered edges. Current labelled controls fully support this route without it.

The supplied cast is complete; no generic request for new hero or enemy art is needed. Identity/portrait continuity concerns and optional audio improvements remain documented in FINAL-ASSET-GAPS.md. A timed human playtest and fresh two-browser party walkthrough remain useful; party authority, turn order, persistence, and reconnect have automated coverage.
