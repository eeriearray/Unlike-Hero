# Dragon Clash

A 2D dragon platform fighter. Build a dragon in the Dragon Forge on a 100-point budget, then knock rivals off the
arena in 1v1, 2v2, 3v3, free-for-all, a tournament, or online. No levels, no unlocks: every dragon plays by the same rules.

Open `index.html` (or the hub). Everything except online play works from `file://`.

## Controls

| Action | Keyboard 1 | Keyboard 2 | Gamepad |
| --- | --- | --- | --- |
| Move | A / D (arrows too when playing alone) | ← / → | stick or d-pad |
| Jump | Space (W also jumps: tap jump) | ↑ or Enter | A |
| Down / drop / fast fall | S | ↓ | down |
| Dash / dodge | Left Shift | Num 0 or Right Shift | bumpers / triggers |
| Light / Heavy / Signature | J / K / L | Num 1 / 2 / 3 or , . / | X / Y / B |
| Elemental ability | O (or S + L) | Num 7 or ] (or ↓ + Num 3) | RT (or down + B) |
| Gear ability | I | Num 4 or ; | LB |
| Pause | Esc | Esc | Start |

Hold a direction with an attack for its variants (up, down, side, in the air). Up + Heavy in the air is the
Wing Burst recovery (once per jump). Keys are remappable in **Controls & settings**, which also flags keys shared
between the two layouts.

### Phones and tablets

On touch devices the game picks **Touch screen** controls by default (also selectable as a device anywhere you choose
controls): a floating stick under the left thumb (flick up to jump, down to crouch), Light / Heavy / Special / Jump /
Guard / Dodge plus Gear and Taunt under the right thumb, and a pause button. Hold Guard and tap Light, Special or Heavy
for grabs, EX specials and Dragon Fury, as on a keyboard. `js/touch.js` tracks every finger by pointer id, so
combinations work. Touch devices also start on Low effects (70% sprite resolution, half the particles) to stay inside
mobile memory limits, the HUD moves to the top, menus compact on short screens, and phones held upright during a fight
are asked to turn sideways.

## Appearance of the HD dragons

The painted dragons can't change horns or wings, so the Forge's Appearance tab offers what the art supports: any of the
five paintings regardless of element (`look.sprite`), a **scale colour** that re-hues the frames while keeping their
painted shading (`look.tint`, `D.TINTS`), a **finish** (`look.shade`: Shadow, Gilded, Bone, Spectral) and the element
aura. Recolouring happens per frame on a scratch canvas in `js/sprite.js`. Mirror matches on the select screen use the
same recolours to tell identical dragons apart.

## Asset audit

What exists locally (verified, not assumed):

| Asset | Where | Status |
| --- | --- | --- |
| Dragon Warrior **idle** sheet: 4800×4800, 10×10 grid of 480 px cells, 97 frames, transparent PNG, facing right | `tools/source/dragon-warrior-idle.png` (copied from `~/Downloads/idle.png`) | **Used.** All 97 frames are unique (no duplicates); motion is breathing plus a ~28 px tail sway. 24 evenly spaced frames are used. |
| Run, walk, defense, hurt, death, entrance, attacks 01–04 | Not available | The pack's store pages list them, but those files were not provided. The store preview images are not used: they are low-resolution marketing images with labels and checkerboards, and the frames are paid content. |
| Backgrounds, sounds from the pack | Not available | Arenas are drawn in code; all audio is synthesised at runtime (no files, nothing to license). |

So the only real animation is idle. Nothing in the game pretends otherwise: every other state is built from that art
as described next, and no idle frame is duplicated to fake a different animation.

### Adding the rest of the pack (walk, run, defense, hurt, attacks…)

The pack's other sheets are supported but were not on this machine (searched the whole home folder, iCloud Drive,
archives and every large PNG). To use them:

1. Copy the pack's PNGs into `games/dragon-clash/tools/source/` with their original names
   (e.g. `walk.png`, `run.png`, `run02.png`, `defense.png`, `hurt.png`, `death.png`, `attack01.png` … `attack04.png`).
2. Run `python3 tools/process_pack.py`. It prints which animations it found, the grid it detected
   (480 px cells, empty cells skipped), frame counts, each attack's detected impact frame, and which are still missing.
3. Reload the game. No code changes are needed.

| Pack sheet | Used for |
| --- | --- |
| walk / run | running (walk under ~3.5 speed); frames advance with distance travelled, so feet don't slide |
| run02 | dash dodge travel |
| defense / defense02 | spot dodge / air dodge guard |
| hurt | hit reaction (tumbling knockback stays on the rig) |
| attack01 | up attacks (Horn Flick, Horn Uppercut) |
| attack02 | jab, ledge attack |
| attack03 | heavy claw (Rending Claw) |
| attack04 | signatures and abilities |
| death, entrance | processed; not yet shown in a match (death would suit the defeat screen) |

Attack sheets are time-stretched onto the move's real frame data with the painted impact frame landing on the first
active frame. Air attacks, jumps, falls, landings, ledge and tumbles stay on the rig because the pack has no frames for
them. On pack frames the painted horns and tail are shown (they cannot be cut out reliably per frame); colours, wings,
head pieces, eyes and blinks still apply, attached to the eye the tool tracks in every frame. Markings and armour
are not drawn on pack frames yet.

## Art and animation pipeline

`tools/process_pack.py` (Python + Pillow) turns the idle sheet into everything the game draws:

1. **Recolourable layers.** Each pixel is classified (green scales → `main`, yellow-green chest → `belly`, gold →
   `accent`, outlines/claws/eyes → `fixed`) and stored as grey shading, so any palette can be applied with canvas
   `multiply` compositing while keeping the painted shading. No pixel reads at runtime, so `file://` works.
2. **Separate horns and tail.** Cut out of the body: the original horns and tail become two part options among many,
   and the tail swings independently.
3. **Cutout rig from frame 0.** The body is cut along its anatomy into head, torso, upper and lower arms, thighs and
   shins, with measured joints (neck, shoulders, elbows, hips, knees). Limb overlap areas are copied into the parent
   part (interior pixels only, so no stray outlines), and torso areas the painting hid behind limbs are inpainted
   and shaded. Output: `assets/warrior/rig-*.png` atlases and joint data in `rig.js`.
4. **Per-frame anchors** (snout, eye, head) on the idle frames, so parts stay attached while the dragon breathes.
5. Art is stored at 0.7× source resolution (`res` 1.4 pixels per world unit) so it stays sharp when the camera zooms in.

Re-run after changing the source or the cuts: `python3 tools/process_pack.py`. `gallery.html` is a dev page:
`#poses=<archetype>` shows every animation state (add `&page=0..3` for a closer look, `&live` to animate),
`#thumb` renders the hub thumbnail scene.

### Animation state machine (`js/anim.js`)

Each gameplay state has a clip: a function from the fighter's state and timers to joint angles. A per-dragon
`Animator` blends between clips so nothing pops, and the real idle frames crossfade in whenever the dragon stands
still and out on any action.

| State | How it is animated |
| --- | --- |
| Idle | **Real pack frames** (24-frame breathing loop) + blinking + independent tail and wing motion |
| Run | Rig: alternating thigh/shin stride, counter-swinging arms, forward lean, head bob, footfall dust, tail streaming |
| Jump / fall / land | Rig: tucked ascent with a wing beat, open-armed fall, crouching landing; air jumps do a tucked somersault |
| Dash / spot dodge / air dodge | Rig: low dash with arms swept back; a crouched guard with forearms over the face; tucked air dodge |
| Light / heavy claws, uppercut, tail sweep, spins, stomps, Wing Burst | Rig key poses for **windup → strike → follow-through → recovery**, timed by the move's own frame data: the strike pose is on screen exactly while the hitbox exists |
| Signatures and abilities | Families (breath, throw, slam, burst, push, flex, dash) with mouth or claw energy gathering during startup |
| Hit / knockback / knockdown | Directional recoil, limb-flailing tumble spin, flat-on-the-back knockdown then rise |
| Ledge hang / climb | Arms up holding the ledge, legs dangling; a pull-up climb |
| Victory / defeat | Arms-raised roar with mouth glow; kneeling slump |

Attacks cannot restart while a button is held (the simulation starts moves only on presses; a test checks it),
and idle can never override an attack because clips follow the simulation's state, not input.

### Effects (`js/fx.js`)

- **Swing trails** follow the attacking hand's real path, computed with forward kinematics through the rig, so the
  trail lines up with the animation and the hitbox. Light attacks leave a white streak; heavies and specials carry
  the element's style.
- **Element-specific impacts**: Fire (flame blobs, embers, heat glow), Ice (frost star, shards), Lightning
  (branching arcs, brief flash), Earth (tumbling rock chunks, dust cloud), Water (droplets, ripples, mist). Every hit
  also throws a short streak burst along the launch direction.
- Hit-stop comes from the simulation (both fighters freeze for 3–13 frames). The victim flashes only for the first
  4 frames of it, so it stays readable. Camera shake is capped and adjustable (Settings).
- Effects are visual only: hits come from simulation hitboxes, never from particles.

## Sound

Recorded effects and announcer lines come from the local sound folder (`~/Desktop/DRAGON SOUND EFFECT`: announcer
WAVs and *Helton Yan's Pixel Combat*). `tools/build_sfx.py` picks the sounds for each game event (up to 3–4 variants
each), trims silence, downmixes to mono, normalises loudness by category so effects sit together, and encodes AAC:
124 sounds for 43 events, about 2 MB, in `assets/sfx/` with the manifest `assets/sfx/sfx.js`. Re-run it after
changing the event table:

```bash
python3 games/dragon-clash/tools/build_sfx.py "/Users/akshat/Desktop/DRAGON SOUND EFFECT"
```

In game, sounds rotate variants, vary pitch slightly, pan with their position on screen, and the announcer has its
own volume (Settings). Hits layer an element sound on the impact; specials charge during startup and release on the
first active frame. The announcer says Fight, KO, Knockout (final KO), Killing Frenzy (two KOs within 10 s), Death
Match (everyone on their last stock), Victor / Game Over, and Select Your Champion on the versus screen, never over
itself. Pages opened from `file://` cannot fetch audio, so they fall back to the original synthesised sounds.
Both sound packs are licensed by the project owner for use in this game (no license file ships in the source folder).

## Fighting systems (`engine/dc-sim.js`, numbers in `engine/dc-data.js`)

- **Frame data**: every move has startup/active/recovery; `D.frameData(def)` gives advantage on hit and on block. The pause menu, How to play and Training show the full table.
- **Guard** (U / Num 5 / LT-RT): blocks hits from the front, with blockstun, pushback and a guard bar; an empty bar is a **guard break** (dizzy). Hold Down to crouch-guard. **Perfect parry**: Guard pressed within 5 frames of the hit (re-pressing within 24 frames gives no window). **Guard Counter**: Heavy in blockstun for half a bar.
- **Throws**: Guard + Light grabs (beats guard); hold back for a back throw; any attack/Guard/Dodge press in the first 12 frames breaks it.
- **Cancels** on hit or block (light → heavy/special/EX/super, heavy → special/EX/super, special → super; Up-Light jump-cancels). **Input buffer** 6 frames; simultaneous presses resolve by `INPUT_PRIORITY`.
- **Combos**: scaling by step (100, 100, 90 … 40%), hitstun decay, stale-move hitstun, and a burst escape at 12 steps. **Counter hits** (hit during startup) and **punishes** are flagged and called out.
- **Knockdown** after an untechable tumble landing; invulnerable wake-up: stand, roll or get-up attack. **Walls** (Dragon Colosseum): wall splat once per combo, wall tech, wall jump, corner pushback onto the attacker.
- **Meter** (3 bars): EX specials (Guard + Signature, 1 bar, armoured), **Dragon Fury** super (Guard + Heavy, 3 bars) with a world-freeze cinematic. **Taunt** (Y) gives a little meter.
- Tests: `test/dragon-clash-mechanics.test.mjs`.

Only the five sprite dragons are offered in menus; Forge builds are drawn with the painted dragon of their element (the rig stays as the `file://` fallback).

## Arenas (`js/scenery.js`)

Eight arenas (`D.ARENA_ORDER`): Skyforge Spire, Frostfall Rift, **Ember Caldera** (volcano, eruptions, lava lake), **Stormcrown Peaks** (three summits, rain, lightning), **Jade Terrace** (pagoda, blossom petals), **Dragon Colosseum** (walls, crowd that cheers KOs), **Crystal Hollow** (geode cave), **Sunken Shrine** (underwater ruins, kelp, fish). Preview any with `gallery.html#scene=<id>&live`.


Painted procedurally, pixel by pixel, once per arena and screen size, then drawn with parallax: dithered sky, sun or
moon with halo, Milky Way, clouds from fractal noise lit toward the light, mountain ranges with ridge and facet
lighting, rock strata, patchy snow and haze, a citadel of varied towers with lit windows and a forge, textured
floating islands, a pine forest with rim light and pooled fog, and textured stone platforms (moss and grass or snow and
icicles, cracks, roots). Live motion: drifting clouds, a bird flock, forge smoke and embers, god rays, waterfalls,
aurora, mist, snow, shooting stars, fireflies, and blurred foreground framing. `gallery.html#scene=skyforge` (or
`frostfall`, add `&live` to animate) shows an arena at 1280×720 for art review.

## Rules (all in `engine/dc-data.js`)

- **Ring-out**: damage % raises knockback; leave the blast zone to lose a stock.
- **Elements**: Fire > Ice > Earth > Lightning > Water > Fire. ±10% on the **elemental part** of a hit only.
  Physical damage, knockback, hitstun, speed and recovery never change. Explicit interaction rules: melt, extinguish,
  grounded (Stone Skin halves lightning hitstun), conduct (+2% once on soaked targets), absorb, clash.
- **Builds**: 100 points across body, mobility, signature, ability and one upgrade. Validated by `engine/dc-build.js`
  in the Forge, at match start and on the server. Stats are derived from catalog ids only, so a modified client
  cannot send itself stats. Cosmetics never change stats.

## Dragon Select and gear

Before every Versus match each player picks a dragon and a loadout with their own controls (↑↓ row, ←→ change,
light to ready, heavy back). Gear has its own **30-point budget** on top of the dragon's 100-point build; options
you can't afford are skipped. All numbers live in `engine/dc-data.js` (`SIZES`, `ARMOR`, `WEAPONS`,
`GEAR_ABILITIES`) and are checked by `Build.validateBuild`, locally and on the server.

| Slot | Options | Effect |
| --- | --- | --- |
| Size | Small · Medium · Large · Huge | Swaps the body frame (hitbox, weight, power, speed). Growing past the dragon's own size costs the difference in body points; shrinking is free. |
| Instinct (free, pick one) | Fury · Bastion · Tempest · Vengeance | Fury: +50% meter from hits, combos keep full damage a hit longer, guard bar −35%. Bastion: guard bar +50%, 8-frame parry, Guard Counter for a quarter bar, −25% meter from hits. Tempest: +1 air jump, dodges recover 30% sooner, Dodge cancels a connected move into a dash (half a bar), +8% knockback taken. Vengeance: up to +30% damage as its own damage climbs to 120%, double meter from taking hits. |
| Ability | Fade 10 · Aegis 12 · Phase Dash 8 · Decoy 10 · Rage 10 · Gust 8 | Fade: ~20% visible for 1.5 s, broken by attacking or being hit. Aegis: absorbs one hit within 3 s. Phase Dash: invulnerable boosted dash. Decoy: a copy that bursts when struck. Rage: +15% damage dealt and taken knockback for 5 s. Gust: shoves enemies ahead, no damage. |

Armour and weapons were removed; the gear art pipeline below still describes them but nothing loads those pieces.

CPUs pick a random affordable loadout and use their ability. **Art:** every piece has a drawn-in-code placeholder
until the real one exists. Export pieces as `docs/GEAR-ASSETS.md` describes into `assets/gear/src/`, then run
`python3 tools/build_gear.py`; it downscales them and writes `assets/gear/gear.js`, and the game uses each file
it finds (body pieces ride their rig bone, the tail mace follows the tail tip, `fx-aegis-*` and `fx-rage-*`
frames replace the painted shield and aura).

## Sprite-pack dragons (Emberfang, Frostwing, Ironmaw, Voltscale, Tidefang)

Five painted 25-animation dragons live in `assets/dragons/<id>/` (`emberfang frostwing ironmaw voltscale tidefang`):
`manifest.json` plus 25 sheets (384 px cells, 4 columns, 3x frames with optical-flow in-betweens). They are extra
archetypes in the roster (`<id>-hd`): the same stats, moves and AI as the rig archetype of that name, with
`look.sprite = '<id>'` choosing the art. The sprite is cosmetic; the simulation never reads it (a test checks a sprite
dragon and its rig twin play identical matches). `look.sprite` is whitelisted by `Build.validateBuild/sanitize`, so it
travels in the build that online players send. Forge-built rig dragons are unchanged.

**Swapping a pack:** replace the folder's sheets and `manifest.json`. The renderer (`js/sprite.js`) reads frame counts
`n`, `cols`, `loop`, per-frame foot row `bot`, attack `active` frames, guard `hold` and body centre `cx` from the manifest.

| Sim state | Sheet |
| --- | --- |
| idle / run (sprint) / squat | Idle / Running (Running 2 after half a second flat out, or above speed 5.6; frames advance with distance) / start of Jumping |
| crouch / crawl (Down + direction) | Crawl, held near its first frames / Crawl, advancing with distance |
| guard held / blocked hit, parry | Defence 1 raised to its peak and swaying / Defence 2 (the shield arc) through the blockstun |
| ascent (air jump) / fall / land | Jumping (Jumping 2) driven by vertical speed / Falling / Landing |
| spot dodge, air dodge | Defence 1 (raise, hold, release) / Defence 2 |
| dash dodge (back, forward) | Dodging / Dodging 2 |
| jab, fair, nair (repeated within 0.8 s) | Light Attack 1, 2, 3 in turn; utilt / dtilt use Light 2 / 3 |
| smashes, aerial heavies | Heavy 1 (fsmash, fheavyAir), Heavy 2 (usmash, dsmash, meteor) |
| signature / elemental ability, Wing Burst | Elemental 1 / Elemental 2 |
| hitstun / tumble / knockdown | Hit 1 and 2 alternating / Knockback / Recovery |
| ledge hang, climb | Falling frame, Recovery |
| match end | Victory for the winning team, Defeat for the rest |

Attack sheets are time-stretched onto the move's own frame data: startup frames play up to the manifest's first `active`
frame, active frames cover its `active` window, recovery plays the rest. Every frame is drawn with its `bot` row on
the fighter's feet, so feet stay on the floor in every state; facing flips about the manifest `cx`. Gear pieces are not
drawn on sprite dragons (gear stats still apply; size scales the sprite).

**Loading:** sheets are trimmed to the opaque area of their frames by `tools/trim_sprites.py` (manifest `cw/ch/ox/oy`) and
decoded at full resolution (~230–300 MB a dragon; 70% on the Low effects setting), and only the dragons in a match are kept: the match shows "Summoning dragons…" while it decodes and touches every sheet, and
frees the rest (`DCSprites.unloadExcept`). Menus and the select screen load only the idle sheet. Online rooms start
decoding when a sprite dragon joins the room. From `file://` the manifest cannot be fetched, so sprite dragons fall back
to their rig look.

## Online

```bash
npm install
npm start
```

Open the printed address in two browser windows (or on two devices), choose **Online**, create a room in one and
join with its 4-letter code in the other. The server (`server/index.mjs`, loaded by the hub server) runs every match
at 60 Hz with the same engine files, validates builds, fills empty seats with CPUs, and advances tournaments only
from finished server matches. A dropped player has 20 seconds to reconnect (refresh is fine) before forfeiting.
There is no client-side prediction yet, so play feels best on the same network.

## Tests

`npm test` (from the repo root) runs `test/dragon-clash-*.test.mjs`: every elemental pairing, element-only modifiers,
build validation and tampering, hitboxes vs hurtboxes, one hit per attack, dodges, knockback growth, ring-outs, teams,
time-outs, interaction rules, gear budget and every gear effect, ledges, determinism, held buttons, tournament byes and progression from real fights,
and an end-to-end online test where separate WebSocket clients play a server-run match and a CPU cup.

## Gameplay inspection (Emberfang first, then the roster)

Checked in the running game by stepping the real match frame by frame and filming the dragon (see
`gallery.html#poses=<id>` for a static sheet). Sequences: idle → run → stop (brake pose while momentum slides,
then a clean hand-over to the painted idle; no crossfade ghosting); run → reverse (skid pose) → run; run → jump
(squat, takeoff, ascent, apex, fall, pre-landing reach, landing compression); jump → air claw → land; dash dodge
(startup, travel, recovery); heavy claw (windup with energy at the claw, strike, follow-through, recovery); Fireball
(gather at the mouth, release, recovery); taking a hit at 95% (hit-stop, recoil, tumble, knockdown, rise); attacks
facing left; walking off the edge, ledge grab, hang, climb. The core run/jump/heavy/special/dodge set was repeated
for Frostwing, Voltscale, Ironmaw and Tidefang. `test/dragon-clash-animation.test.mjs` checks every active frame of
every melee move, for every body type and both facings: the striking claw, foot or horn is inside the hitbox.

## Known issues and what remains

- **Balance is tuned against CPUs, not people.** `node tools/balance-matrix.cjs` (level-3 CPUs, 60 games per
  pairing, all arenas): Ironmaw 56%, Emberfang 55%, Tidefang 48%, Voltscale 47%, Frostwing 45%, and no matchup worse
  than 57–43. Changes that got there: Fireball recharges and casts slower, Cinder Trail's flames are shorter and
  cooler, a fireball melting an ice shard is spent too, Ice Shard recharges faster and hits a little harder, Blink
  Strike stops in front of a rival (and won't carry you off a ledge from the ground), Water Jet and Tidal Wave
  recharge sooner, and Tidefang's ability is Riptide (Tide Pool does no damage). With normal (level-2) CPUs the light
  Frostwing and Voltscale sit near 40% and the heavy dragons near 60%: sloppier play punishes light bodies. People
  exploit speed and air mobility more than CPUs do.
- **Missing pack animations.** Until the pack's other sheets are added (see above), run, attacks, hurt and the rest
  are rig animations made from the idle art, not hand-drawn frames. Jump, fall, landing, air attacks, ledge and
  tumble have no pack frames at all and would need new artwork (or stay on the rig).
- The claw hitboxes are shorter than the painted arm, so claw strikes are bent-elbow rakes that keep the claw inside
  the hitbox. Fuller extensions would need slightly longer hitboxes (a balance change).
- The pack-frame import is verified with a stand-in sheet, not with the real files.
- The rig is cut from a single painted pose, so extreme bends show some stretching at the joints and the far side
  of the body is never visible. The five archetypes share one body silhouette, differentiated by body scale and parts.
- Online has no client prediction or rollback; it renders the server's snapshots with 70 ms interpolation.
