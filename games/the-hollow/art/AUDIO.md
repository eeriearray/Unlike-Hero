# Step 4 — recorded audio

Recorded music and effects use the shared Web Audio context and the existing persisted Master / Music / Ambience / Effects controls. The rules engine is unchanged in this step. Audio starts only after a click or key press. Missing IDs, failed requests and rejected decodes retain synthesis; a first-use effect uses synthesis while its sample decodes, without replaying it late.

## Listening

Open http://localhost:8080/games/the-hollow/art/audio-preview.html and click Start audio. Switch regions, select low Sanity and phase III, compare combat/boss, and open the dialog. Pause audio stops the audition without changing saved volume preferences. The preview volume/mute controls intentionally share the game settings.

Refresh http://localhost:8080/games/the-hollow/ to load the new scripts. Click Sound in the HUD for the mixer. Your existing solo save restores without spending an action.

## Mapping

| Region | Music loop | Ambient bed |
|---|---|---|
| title | Mind's Eye Loops v1/1 Mind's Eye/2 Mind's Eye Loop1.wav | Horror SFX Free/Ambient/Creepy_ambience_3.wav |
| village | Mind's Eye Loops v1/1 Mind's Eye/2 Mind's Eye Loop1.wav | Horror SFX Free/Ambient/Vent_airflow.wav |
| estate | Mind's Eye Loops v1/3 Something's wrong/2 Something's wrong Loop 1.wav | Horror SFX Free/Ambient/Old House_creeky metal and wood_ambiance_7.wav |
| woods | Mind's Eye Loops v1/5 Fredelig Sinn/1 Fredelig Sinn Loop 1.wav | Horror SFX Free/Ambient/Frogs.wav |
| abbey | Mind's Eye Loops v1/6 The Veil of Night/2 The Veil of Night Loop 1 Start .wav | Horror SFX Free/Ambient/Drone_doom.wav |
| crypt | Mind's Eye Loops v1/3 Something's wrong/2 Something's wrong Loop 1.wav | Horror SFX Free/Ambient/Tap_reverb.wav |
| heart | Mind's Eye Loops v1/2 Mental Vortex/Mental Vortex Loop 1.wav | Horror SFX Free/Stingers and Spooky Triggers/Piano_drone_low_sustained_2.wav |

The Mind’s Eye intro leads into its loop on first playback; victory/defeat plays its outro once. Region and mood transitions fade old and new recordings over 2 seconds. Dedicated combat, boss and ending slots are commented in `js/recorded-audio.js`; combat/boss currently use a quieter exploration loop at 0.92× / 0.82× speed with a low-pass filter.

The library has no dedicated wind, cricket, drip or whispered-dialogue take. Village wind uses filtered Vent_airflow; woods use Frogs; crypt drips use Tap_reverb, with existing synthetic drips underneath; the whisper event uses a quiet panned Ghost_moan. The heartbeat remains synthesised and grows stronger/faster below 60% Sanity. Music loses high frequencies as Sanity falls or the Clock advances. Additional bells recur at 15–24 seconds in phase III versus 48–57 seconds earlier, and stop outside active play.

| Event | Recording |
|---|---|
| water | Horror SFX Free/Liquids/Liquid_slosh.wav |
| creak | Horror SFX Free/House & Office/Door_squeeky_2.wav |
| bell | Horror SFX Free/Ambient/Bell_low.wav |
| ignite | Horror SFX Free/Character/Match_striking.wav |
| snuff | Horror SFX Free/Character/Flashlight off.wav |
| whisper | Horror SFX Free/Monsters & Ghosts/Ghost_moan_2.wav |
| coin | Horror SFX Free/Character/Coin_Drop on Table_3.wav |
| stash | Horror SFX Free/Character/Bag_searching.wav |
| dice | Horror SFX Free/House & Office/Shaker_3.wav |
| damage | Horror SFX Free/Monsters & Ghosts/Injured.wav |
| sanity | Horror SFX Free/Stingers and Spooky Triggers/Piano_stinger_dissonent.wav |
| enemy | Horror SFX Free/Monsters & Ghosts/Monster_growl_1.wav |
| step | Horror SFX Free/Character/Footsteps_walking.wav |
| sprint | Horror SFX Free/Character/Footsteps_ running.wav |
| impact | Horror SFX Free/Stingers and Spooky Triggers/Stinger.wav |
| click | wav/click_01.wav |
| hover | wav/hover_01.wav |
| hero | wav/select_01.wav |
| confirm | wav/confirm_01.wav |
| zoom | wav/transition_01.wav |
| paper | wav/page_01.wav |
| success | wav/reward_01.wav |
| fail | wav/deny_01.wav |
| crit | wav/levelup_01.wav |
| fumble | wav/error_01.wav |
| clue | wav/notify_01.wav |
| pickup | wav/equip_01.wav |
| heal | wav/charge_01.wav |
| lock | wav/deny_01.wav |
| door | wav/open_01.wav |
| trap | wav/alert_01.wav |
| level | wav/levelup_01.wav |
| phase | wav/alert_01.wav |
| turn | wav/notify_01.wav |
| vote | wav/dialogue_01.wav |
| ally | wav/unlock_01.wav |
| revive | wav/charge_01.wav |
| arrive | wav/transition_01.wav |
| toll | Horror SFX Free/Ambient/Bell_low.wav |

All existing sound names and captions remain available, including unlisted synthesized ending cues. Dialogs and voice-like Sanity/whisper effects duck music and ambience with a smooth release. Wet synthesis tails obey their category slider. The optional scare impact now uses the shared mixer with its original 540 ms limit and reduced-scare restrictions.

## Loading and size

395 generated assets; 15,528,735 bytes including the manifest (15.53 MB). The pipeline now selects exact audio source paths, excluding duplicate exports and the unused full music mix. It still validates archives, enforces the payload cap, and preserves licensing exclusions. The decoded cache is capped at 32 MiB/36 entries, except a single larger clip; active sources retain their buffers until they finish. Region music/beds load on demand. A small set of common effects warms after the first gesture.

## Verification

82/82 Hollow tests pass, including the existing engine and real socket/server tests and seven new audio tests. Browser verification confirmed actual MP3 decoding, title intro/loop, woods/crypt/heart beds, boss playback, dialog ducking and the unchanged game controls with no console errors. The live solo save restored at Clock 6/36, 8 Vitality, 6 Sanity and 3 actions. This checks playback state and scheduling; final subjective loudness/music judgment remains a listening review.

A broader `npm test` run passed 482/484 tests. Two failures are outside the changed Hollow code: `test/putt-club-courses.test.mjs:23` (cove-1 token drift 0.044) and `test/putt-club-physics.test.mjs:79` (sand versus metal distance). No Putt Club files were changed.

## Exact commands

Run from `/Users/akshat/Desktop/unlike hero`:

```sh
node tools/build-assets.mjs --source "$HOME/Desktop/horror game assets"
node --test test/the-hollow-*.test.mjs
npm start
```

If the server is already running on port 8080, keep it running and refresh the game after rebuilding. No client build step is required. Public distribution remains gated by `art/CREDITS.md`; this step is a local preview only.
