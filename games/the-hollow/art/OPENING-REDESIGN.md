# The Missing Bell — playable opening

The opening follows a personal warning into a concrete investigation. Existing paintings, closeups, belfry interior, recorded cues, trailer, private goals and the wider game remain in use. New guided expeditions use opening state version 2. Existing complete saves remain complete; incomplete saves tolerate the new optional fields and acquire the response beat after inspecting the frame. Full expedition mode does not use these rules.

## Beat sheet

| Place | Motivation and action | Discovery / consequence | Next lead |
| --- | --- | --- | --- |
| Silent Square | A summons in your own handwriting warns that the bell is learning your name. Read the removal notice to test the contradiction. | The bell was removed forty years ago. Fresh ink adds your name to the notice; the well answers. Failed checks retain the lead. | The chapel kept the removal records. |
| Chapel | Recover the keeper’s maintenance entry from the vestry. | The bell was lowered, flooding the front entrance. A dry entrance was marked on the keeper’s grave. A knock points toward the graves. | Find the bell-marked stone. |
| Graveyard | Read the marked stone or follow the keeper’s tracks. | The graves hold no bodies; their nameplates were cut away for the bell. The diagram supplies a safe passage. | Enter the tower to trace the missing bell. |
| Tower entrance | Use the passage, force the door, or use Jory’s drainage gap. | A rope pulls down into the floor beneath an empty yoke. Force failure still opens the door and costs Health. | Read the founder’s inscription. |
| Empty frame | Inspect the grave-iron or use Wren’s / Anselm’s approach. | The empty frame reacts; the toll comes from below. The inscription identifies the Abbey foundations and the magistrate’s transfer record. The bell was lowered, not destroyed. | Respond before following the transfer record. |
| Tower response | Bind the rope or answer the echo. Both choices are shown together on the frame and in action cards. | Binding reduces the Clock by 1; answering advances it by 1 and recovers a bell-name hint. Choices are mutually exclusive. | Return through the graveyard to the Black Estate foyer and seek the library record, then follow the trail toward the Abbey. |

The direct forced-entry route is still available; discoveries may occur out of order. The opening is not artificially timed. A fresh-player study is still needed to establish a 10–15-minute duration.

## Character approaches

Every roster member has a relevant observation and an optional certain approach, offered on the same scene object as its normal check. Normal checks remain available to everyone.

- **Isolde / Margin Notes:** read the chapel entry without disturbing the shelves. Avoid injury/noise; leave normal supply rewards untouched.
- **Corvin / Tracker:** follow the keeper’s prints instead of rolling among the headstones. Avoid losing time.
- **Maelis / Forager:** spend one herb to lift the chapel ink safely. Avoid injury/noise; forgo the normal supply search.
- **Wren / Veil-sighted:** spend one Sanity to hear the keeper’s echo and inspect the frame without a check or Clock complication.
- **Jory / Light Step:** slip through the drainage gap and open the tower for everyone, without the maintenance clue or a force check.
- **Anselm / Sanctified:** spend one Ward Chalk to read the frame safely. This does not consume a limited Rite of Sealing.

Approaches use the normal authoritative option resolver, cost checks and one-time claims. Their contribution is named in the result. They grant no extra XP/item rewards to farm. The shared expedition goal remains separate from private objectives.

## Companions

The existing optional aid system now previews each companion’s contribution: +2 normally, +3 for a relevant opening specialist, total help capped at +4. Aid costs the helper 1 Sanity, zero actions, once a round. Checks consume it. The active investigator can proceed immediately; no minor vote or waiting state is required. Held rolls and disconnected helpers cannot receive late contributions. Existing ghosts and solo turn pacing remain in place.

## Presentation and persistence

The HUD shows the current objective, why it matters / current evidence, and a separate suggested action. The production skin now displays the explanation it previously hid. Character observations use an optional disclosure. The parchment letter remains dismissible with its button or Escape and can be reopened under How this works.

Scene objects expose the same new approaches as cards, including their costs before committing. Discoveries leave persistent scene captions, marks beneath inspected objects, and an illuminated empty-frame / floor ring at the tower. Binding dims that ring. Location-specific existing water, wood, footsteps and bell cues accompany authoritative discoveries. Text and persistent static marks retain all essential information without sound or motion. Phone layouts reserve space for the painting before placing the objective and cards in the scrolling flow. Engine-derived next-road guidance handles multi-road trips (including Graveyard → Square → Tower) instead of highlighting an unreachable final destination.

`w.opening` owns discoveries, reveal and response. Public views project that state into environmental memory for all players. Snapshots / reconnects reconstruct it rather than replaying client history. All existing normal reward, claim and command deduplication rules are retained.

## Validation — 24 October 2026

- **165 / 165 Hollow tests pass.** Includes 15 new rules tests: actual-road solo journeys for every character with all required checks failing; safe approaches and exact costs; duplicate prevention; specialist aid; disconnected companions; held-roll guards; restore during reveal; exclusive responses and understandable onward objective.
- **Full suite: 573 / 575 pass.** Existing failures are `putt-club-courses` (cove-1 resting token) and `putt-club-physics` (sand versus metal), already documented before this change.
- Browser checked on isolated port 8082: production-skin parchment contrast, Escape/close, notice-board closeup and roll, discovery narrative, travel to chapel, Isolde’s alternative through the scene object, automatic solo turn advance, refresh/resume, a 390 × 844 phone viewport, phone scene travel into the graveyard, its marker check, restored next-road guidance, tower entry/interior, the empty-frame reveal, mid-reveal refresh/resume, both response previews, and binding the rope to open the wider roads. The phone objective initially covered objects; its layout now follows a dedicated scene area.
- The entire opening and both tower responses are verified by engine tests. The browser journey used Isolde and the binding response; the answer response is engine-tested. A fresh human playtest of all characters, timing calibration and sound-mix review remain outstanding.

No new media assets are required. Optional passage closeup and distant-crow recording remain documented in `FINAL-ASSET-GAPS.md`; labelled entrance controls and the existing sound system are the playable fallbacks.
