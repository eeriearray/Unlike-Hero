# Step 3 — feedback, sanity and scare preferences

## What changes

- Sanity above 65% uses the subtle vignette. At 31–65%, it uses the asymmetric
  vignette. At 30% or below, it uses the panic vignette. These are presentation
  thresholds only and do not alter any engine thresholds or stat calculations.
- The edge overlay slowly pulses. At low Sanity, a subpixel channel separation and
  subpixel displacement affect the background only. Cards, HUD text and dice remain
  readable. The SVG filter is omitted below 960px to avoid an extra phone filter pass.
- Vitality reactions choose a LESED crack, damage pulse or blood-splatter frame for
  300–600 ms. The existing hurt reaction provides the shake. Missing images retain a
  CSS edge reaction. Sanity-loss reactions use a brief violet edge emphasis.
- Blessed, cursed, marked, bleeding and hunted have distinct HUD symbols, labels
  and descriptions. A faint edge tint uses the highest-priority active condition
  so multiple statuses do not produce an overpowering colour wash.

## Timing and once-per-run behavior

The stage calls the feedback layer at its existing consequence beat, after held
visual state is released. The existing `St.flash` hook times the injury reaction;
no new damage-log reader replays the same injury or changes a gameplay command.

Natural jump scares are rare: only a small, deterministic subset of fresh danger
log events can qualify, after round 2 and at least 20 seconds of visible session
age, while Sanity is at 30% or below. The player must be alive. No scare appears
while the page is hidden, a card/dialog/hold is open, another section is selected,
or the relevant accessibility preferences disable it. Held events finish first.

The client writes a local claim **before** revealing a face, and permits at most one
natural scare per expedition in that browser profile. Claims survive reloads and
new tabs. If local persistence is blocked, natural jump scares are suppressed.
Historical events on initial load/reconnect never qualify.

`engine/view.js` adds only the optional `cosmetics.runId` field, derived from room
code and the already-persisted creation timestamp. No seed, RNG state, rules,
outcomes or balance are changed. It survives snapshot restore. Older running
servers without that field use a conservative per-room-code claim until the server
is next restarted. Solo clients load the updated view code on browser refresh.

The face lasts 560 ms. It is a self-contained local adaptation of the supplied
Creepy_Face canvas widget; the original code and CDN are not loaded. See
`CREDITS.md` for the author and unverified license status. It remains local-only.

## Preferences and audio

Sound & accessibility includes:

- **Rare jump scares:** enabled by default; turn off to suppress the optional face.
- **Reduced scares:** disables jump scares, distortion and shaking, lowers overlay
  strength, and stops the vignette pulse. Status information remains visible.
- **Motion:** the existing setting also disables jump scares and the new animated
  effects. Changes, including device preference changes, stop an active effect.
- **Low Sanity distortion:** disabling the existing setting also disables the new
  background distortion.

The two new preferences persist through the existing `hollow.a11y.v1` preference
store. No new settings are saved by the isolated review page.

The impact needs a prior user gesture, follows the existing Master/Effects/mute
settings, has a limiter and short fade envelope, and plays at most the first
540 ms of the selected cue. Muting or lowering volume to zero stops it immediately.
If loading/decoding fails, a short synthesized impact is used. Captions describe
the impact/face when enabled. The temporary impact bus can join the shared mixer
in Step 4; region music and ambience are not replaced in this step.

## Assets and pipeline

`feedback.json` references existing logical IDs in the central manifest. The SFX
pack inventory now prioritizes `Stinger.wav` before the starter audio limit, so
rebuilding reproduces the cue. No excluded image pack was enabled. Source-pack
licenses and public-use gates remain documented in `CREDITS.md`.

## Run and review

```sh
cd "/Users/akshat/Desktop/unlike hero"
node tools/build-assets.mjs --source "$HOME/Desktop/horror game assets"
node --test test/the-hollow-*.test.mjs
npm start
```

The local server is already running; skip `npm start` if it still owns port 8080.
Refresh the game page to load Step 3. An online server picks up the cosmetic field
on its next normal restart; the conservative fallback works before then.

- Game: http://localhost:8080/games/the-hollow/
- Isolated review: http://localhost:8080/games/the-hollow/art/feedback-preview.html

The review page uses a demonstration view, starts with audio muted and only shows
its face when its explicit preview button is pressed. It never reads or writes an
expedition or its saved preferences. This review button is exempt from the natural
once-per-run claim so you can compare settings repeatedly.

Tests cover all assets, thresholds, reduced modes, the rare-event gate, persistent
claims, reload/history suppression, run identity restoration, reaction duration,
settings cancellation, and the gesture/mute/volume behavior of the impact bus.
Browser checks cover effect appearance, readable HUD/status labels, preference
suppression and reduced-motion styles. Frame rate has not been benchmarked on
physical phones. Only Step 3 is included; audio expansion remains Step 4.
