# THE HOLLOW — Task 4 Supporting Production Assets Manifest & Technical Specifications

## Scope & Reference Audit Note

- **Missing Reference & Existing Pack Attachments**: No external reference files (approved environments, characters, or style guide from Tasks 1–3) or existing item/UI/audio asset packs were attached to the prompt or present in the workspace.
- **Baseline Production Execution**: To avoid blocking delivery, this package provides the complete baseline suite across all five parts (**Part A** through **Part E**) built strictly around the prompt's material and atmospheric direction (*restrained brass, worn paper, soot ink, and dark stained bog-oak/iron*). If you attach the Tasks 1–3 references or existing packs in a follow-up turn, we can immediately audit them for direct reuse and calibrate any replacement assets to match.

## Folder Hierarchy

- `items/` — 22 `1024×1024` RGBA PNG masters (plus `items/256px/` and `items/128px/` downscaled copies).
- `ui/panels/` — 7 panel, card, and slot components in both `.png` and `.svg`.
- `ui/buttons/` — 6 button and focus state components in both `.png` and `.svg`.
- `ui/states/` — 5 divider, corner, and state accent components in both `.png` and `.svg`.
- `icons/navigation/` — Shared `marker_base` + 10 map navigation symbols in `.svg` and `128×128` `.png`.
- `icons/player/` — 10 player status symbols in `.svg` and `128×128` `.png`.
- `icons/actions/` — 8 action type symbols in `.svg` and `128×128` `.png`.
- `effects/` — 10 transparent RGBA effect overlays + 2 `8-frame` animated sprite sheets.
- `audio/` — 12 procedural/modal `48kHz` 16-bit PCM `.wav` masters + full production briefs for all 13 audio requirements.

## Part A — Item Illustrations (22 Items)

All 22 item masters are `1024×1024` RGBA PNGs (`Straight Alpha`, `alpha = 0` background), centered within `12.5%` (`128px`) padding, with zero baked-in frames, borders, text labels, or drop shadows. Downscaled copies are provided in `items/256px/` (`256×256`) and `items/128px/` (`128×128`).

| # | Filename | Item Name | Visual & Silhouette Specification | Dimensions | Formats & Copies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `items/lantern.png` | Wick Lantern | Period pierced-tin & tarnished brass cage lantern with bail handle, 4-pane glass guard, and small ordinary flame (reads as a structural lantern, not a candle jar) | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 2 | `items/lamp_oil.png` | Lamp Oil | Rectangular-shouldered pewter/tin period oil flask with conical soldered breast, side handle, and chained brass screw cap | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 3 | `items/tonic.png` | Minor Tonic | Squat octagonal amber apothecary bottle with cork stopper, dark herbal tincture, and blank worn paper band | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 4 | `items/thread.png` | Silver Thread | Turned dark-wood hourglass spool wound with fine metallic silver thread and loose trailing strand (spool/coil, not a ring) | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 5 | `items/salt.png` | Salt Charm | Coarse linen drawstring pouch tied with hemp twine and red-brown wax ward seal, parted at neck showing coarse white salt crystals | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 6 | `items/blade.png` | Grave-Iron Blade | Practical pitted wrought-iron trench/grave utility blade with fuller, cemetery-finial crossguard, and riveted bog-oak grip | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 7 | `items/moonrelic.png` | Moonbound Relic | Carved dark slate & tarnished silver crescent-and-disc lunar astrolabe amulet with bronze phase bosses (matte, zero excessive glow) | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 8 | `items/spirit_key.png` | Spirit Key | Slender oxidized silver mortise skeleton key with hollow trefoil/weeping bow and labyrinthine ward bit | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 9 | `items/clapper.png` | Broken Bell Clapper | Fractured internal forged-iron striking shaft with snapped top suspension clevis, tapered rod, hammered striking ball, and flight tail | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 10 | `items/herb.png` | Gravemoss | Gathered bundle of pale lichenous sage/grey gravemoss fronds and spore capsules tied at the stems with twine | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 11 | `items/snare.png` | Hunter's Snare | Coiled twisted-wire noose with brass mechanical locking slide ferrule, leader cable, and notched wooden anchor stake | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 12 | `items/chalk.png` | Ward Chalk | Three worn hand-cut sticks of pale bone-white ritual chalk with incised ward notches and chalk dust crumbs | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 13 | `items/candle.png` | Offering Candle | Unevenly melted tallow taper candle with heavy wax drips, two iron ritual pins pressed into the shaft, and small warm flame | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 14 | `items/mirror_shard.png` | Mirror Shard | Jagged dagger-like fragment of aged mercury-backed glass with beveled thickness rim, diagonal reflection band, and dark foxing spots | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 15 | `items/moonwater.png` | Vial of Moonwater | Slender long-necked florentine clear glass vial with faceted diamond crystal stopper and pale opalescent water | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 16 | `items/wardens_key.png` | Warden's Key | Heavy brutalist blackened cast-iron institutional prison key with thick octagonal bow and double-sided square ward teeth | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 17 | `items/star_lens.png` | Star Lens | Antique tarnished-brass optical objective lens housing with three mounting tabs, vernier arm, degree ticks, and convex teal glass | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 18 | `items/weeping_eye.png` | Weeping Eye | Vesica-shaped dark bronze & bone reliquary cameo with obsidian pupil and three dark oxblood tear drops hanging below | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 19 | `items/saint_finger.png` | Saint's Finger | Preserved osteological finger relic housed inside an arched brass-and-glass reliquary dome with burgundy silk base wrapping | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 20 | `items/gilded_psalter.png` | Gilded Psalter | Small cracked dark-walnut leather devotional book with raised spine bands, tarnished gold corner bosses, fore-edge clasp, and geometric emblem | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 21 | `items/bone_chalice.png` | Bone Chalice | Ritual goblet crafted from a polished bone bowl, stacked vertebra stem, flared bone foot, and riveted brass binding bands | `1024×1024` | RGBA PNG + `256px`, `128px` |
| 22 | `items/ember_locket.png` | Ember Locket | Oval hinged darkened-bronze pendant with pierced filigree grate revealing a restrained smoldering ember core | `1024×1024` | RGBA PNG + `256px`, `128px` |

## Part B — Interface Asset Kit (18 Components, Nine-Slice & Padding Specs)

All UI components are delivered in both high-resolution transparent `.png` and scalable `.svg` formats with zero baked-in text or icons.

| # | Folder & Filename (`.png` & `.svg`) | Component Role | Dimensions | Nine-Slice Margins `[L, T, R, B]` | Safe Text / Content Padding `[L, T, R, B]` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `ui/panels/main_dark_panel` | Main dark panel background | `512×512` | `[24, 24, 24, 24] px` | `[24, 24, 24, 24] px` |
| 2 | `ui/panels/tooltip_panel` | Smaller tooltip panel | `320×192` | `[16, 16, 16, 16] px` | `[18, 16, 18, 16] px` |
| 3 | `ui/panels/journal_parchment` | Journal parchment background | `512×640` | `[24, 24, 24, 24] px` | `[28, 28, 28, 28] px` |
| 4 | `ui/panels/inventory_slot` | Inventory slot background | `128×128` | `[14, 14, 14, 14] px` | `[16, 16, 16, 16] px` (`96×96` icon area) |
| 5 | `ui/panels/inventory_slot_selected` | Selected inventory slot | `128×128` | `[14, 14, 14, 14] px` | `[16, 16, 16, 16] px` (`96×96` icon area) |
| 6 | `ui/panels/action_card` | Action card background | `384×128` | `[22, 16, 16, 16] px` | `[26, 16, 18, 16] px` |
| 7 | `ui/panels/action_card_selected` | Selected action card background | `384×128` | `[22, 16, 16, 16] px` | `[26, 16, 18, 16] px` |
| 8 | `ui/buttons/primary_button` | Primary button background | `256×64` | `[14, 14, 14, 14] px` | `[20, 12, 20, 12] px` |
| 9 | `ui/buttons/secondary_button` | Secondary button background | `256×64` | `[14, 14, 14, 14] px` | `[20, 12, 20, 12] px` |
| 10 | `ui/buttons/hover_treatment` | Button hover state | `256×64` | `[14, 14, 14, 14] px` | `[20, 12, 20, 12] px` |
| 11 | `ui/buttons/pressed_treatment` | Button pressed state | `256×64` | `[14, 14, 14, 14] px` | `[20, 13, 20, 11] px` (`1px` press offset) |
| 12 | `ui/buttons/disabled_treatment` | Button disabled state | `256×64` | `[14, 14, 14, 14] px` | `[20, 12, 20, 12] px` |
| 13 | `ui/buttons/keyboard_focus_treatment` | Outer keyboard focus ring (`6px` outset) | `268×76` | `[18, 18, 18, 18] px` | Overlay ring (`6px` outside `256×64` button) |
| 14 | `ui/states/thin_divider` | Horizontal section divider rule | `512×24` | `[220, 0, 220, 0] px` (H-stretch) | `8px` vertical margin above/below |
| 15 | `ui/states/ornamental_corner` | Small mitered brass corner bracket | `64×64` | Fixed `64×64` corner pin | Mirror/rotate `90°/180°/270°` for 4 corners |
| 16 | `ui/states/objective_complete_accent` | Objective-complete wax/brass banner | `384×64` | `[160, 14, 160, 14] px` | `[24, 12, 24, 12] px` |
| 17 | `ui/states/locked_state_accent` | Wrought-iron ward & keyhole overlay | `128×128` | `[16, 16, 16, 16] px` | Centered overlay on `128×128` slots |
| 18 | `ui/states/dangerous_choice_accent` | Oxblood warning border & thorn bar | `384×128` | `[28, 16, 16, 16] px` | `[30, 16, 18, 16] px` (matches `action_card`) |

## Part C — Map and Status Symbols (28 Icons + Shared Marker Base)

All 28 symbols (plus `icons/navigation/marker_base`) are provided as both `.svg` vector files and `128×128` RGBA `.png` files with `16px` padding, a `5.5px` warm ivory-brass foreground stroke (`#E2CEA4`), and a `10px` dark soot-ink halo (`#14110F`) so every icon remains readable at `20–24px` on both dark panels and light parchment without relying on color alone.

- **Navigation (`icons/navigation/`)**: All 10 navigation markers use the shared gothic lozenge-shield pin (`marker_base.svg`/`.png`) with state-specific interior/rim geometry: `current_location` (double outer beacon ring + solid center reticle), `visited_location` (interior checkmark), `available_destination` (open inner diamond), `locked_route` (padlock shackle & keyhole), `hidden_route_discovered` (dashed veil pin + waking eye), `one_way_route` (gate bar + directional arrow), `objective_destination` (4-point compass star crest), `exit` (arched portal + outward arrow), `enemy_presence` (3 crown spikes + vertical slit pupil), and `safe_resting_place` (sheltered hearth flame).
- **Player Information (`icons/player/`)**: `health`, `sanity`, `remaining_action`, `haunting_clock`, `inventory`, `journal`, `clue`, `key_item`, `ally`, `help`.
- **Action Types (`icons/actions/`)**: `examine`, `search`, `travel`, `rest`, `use_item`, `speak`, `force`, `flee`.

## Part D — Restrained Effect Assets (10 Static Overlays + 2 Animated Sprite Sheets)

All effect files in `effects/` use straight 8-bit/channel RGBA transparency with zero opaque backgrounds or baked checkerboards, leaving the central reading area unobstructed.

| # | Filename | Type | Dimensions | Animation / Blending & Usage Specification |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `effects/thin_ground_mist.png` | Static Overlay | `1024×512` | Straight RGBA (`max alpha 115/255`); anchor to bottom of viewport (`Normal` or `Screen` blend at `40–70%` opacity). |
| 2 | `effects/light_rain.png` | Static Tileable | `1024×1024` | Straight RGBA (`max alpha 78/255`); diagonal `-14°` rain streaks attenuated in center reading zone. |
| 3 | `effects/sparse_drifting_dust.png` | Static Overlay | `1024×1024` | Straight RGBA (`max alpha 105/255`); peripheral warm dust motes, clear central reading area. |
| 3b | `effects/sparse_drifting_dust_sheet.png` | Animated Sprite Sheet | `2048×256` | **8 frames** (`256×256` per frame, horizontal strip), **12 fps**, **Seamless Loop**, **Straight RGBA** alpha. |
| 4 | `effects/gentle_lantern_glow.png` | Static Overlay | `1024×1024` | Straight RGBA (`max alpha 125/255`); warm inverse-square radial candlelight falloff (`Screen`/`Additive` `35–65%`). |
| 4b | `effects/gentle_lantern_glow_sheet.png` | Animated Sprite Sheet | `2048×256` | **8 frames** (`256×256` per frame, horizontal strip), **10 fps**, **Seamless Loop**, **Straight RGBA** alpha. |
| 5 | `effects/injury_edge_stain.png` | Screen Vignette | `1280×720` | Straight RGBA (`max alpha 165/255`); dried oxblood stain restricted to outer 15% border (`central 70% alpha = 0`). |
| 6 | `effects/sanity_distortion_texture.png` | Screen Vignette | `1280×720` | Straight RGBA (`max alpha 165/255`); etched soot & bone-ash cross-hatch filaments restricted to outer perimeter (`central 65% alpha = 0`). |
| 7 | `effects/faint_presence_shadow.png` | Static Overlay | `1024×1024` | Straight RGBA (`max alpha 138/255`); ambiguous cloaked soot-smoke silhouette with faint ash rim. |
| 8 | `effects/mirror_crack_texture.png` | Static Overlay | `1024×1024` | Straight RGBA (`max alpha 210/255`); asymmetric fracture network with dark stress lines and silver bevel highlights. |
| 9 | `effects/discovery_light_accent.png` | UI/Map Accent | `512×512` | Straight RGBA (`max alpha 165/255`); restrained 4-point warm ivory optical glint for newly revealed clues/routes. |
| 10 | `effects/objective_completion_accent.png` | UI Banner Glow | `1024×256` | Straight RGBA (`max alpha 145/255`); quiet horizontal warm brass shimmer behind objective completion banners. |

## Part E — Audio Gap Review, 48kHz WAV Masters & Sound-Production Briefs

Because no existing audio packs were attached to the prompt, all 13 audio requirements are currently **uncovered by external packs**. We synthesized **12 procedural/modal acoustic masters** (`48kHz`, `16-bit PCM WAV`, `-3 dBFS` ceiling, zero clipping, clean fade envelopes) in `audio/` for the resonant, mechanical, ambient, and UI cue categories, and left `distant_crows` (organic wildlife vocalization) ungenerated rather than faking a bird call with synthesis. Below is the complete gap review, generated file inventory, and production brief for all 13 sounds:

| # | Sound Requirement | Status / Generated File | Channels & Sample Rate | Duration & Loop Spec | Texture & Sound-Production Brief (for Field/Foley Recording or Replacement) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Memorable village bell | `audio/village_bell.wav` (Modal synthesis master) | Mono, `48kHz` 16-bit WAV | `4.50s` One-Shot (Non-looping) | Heavy cast-bronze parish bell (`F#3 / 185 Hz` nominal with minor-third tierce partial at `1.183×` and slow doublet warble), distinct iron clapper transient, 4.5s natural tower decay. |
| 2 | Distant bell variation | `audio/distant_bell_variation.wav` (Modal + valley filter) | Stereo, `48kHz` 16-bit WAV | `5.50s` One-Shot (Non-looping) | Muffled (`LPF 1050 Hz`), lower-pitched (`D#3`) bell across a damp valley with wide stereo early reflections and subtle cold air bed. |
| 3 | Rope strain | `audio/rope_strain.wav` (Stick-slip physical model; live foley recommended) | Mono, `48kHz` 16-bit WAV | `1.80s` One-Shot (Non-looping) | Dry, close-miked thick twisted hemp rope pulling taut over an oak beam; irregular stick-slip fiber creaks (`250–1800 Hz`) without metallic ring. |
| 4 | Rusted bell-frame movement | `audio/rusted_bell_frame_movement.wav` (Waveguide + timber groan) | Mono, `48kHz` 16-bit WAV | `2.20s` One-Shot (Non-looping) | Heavy oxidized wrought-iron pivot bearing groan coupled with a low oak structural beam shift (`180–1400 Hz` friction partials). |
| 5 | Dark well ambience | `audio/dark_well_ambience.wav` (Subterranean cavity + droplets) | Stereo, `48kHz` 16-bit WAV | `8.00s` **Seamless Loop** (1.0s equal-power crossfade) | Deep cylindrical stone-shaft air resonance (`55–290 Hz` hollow drone) with sparse, resonant water droplets echoing off wet masonry walls. |
| 6 | Period wooden door | `audio/period_wooden_door.wav` (Modal creak + oak thud; live foley optional) | Mono, `48kHz` 16-bit WAV | `1.60s` One-Shot (Non-looping) | Slow iron strap-hinge & heavy weathered oak plank creak (`1.0s`) resolving into a solid, damped timber latch-frame closure thud (`78 Hz` body). |
| 7 | Lock or latch | `audio/lock_or_latch.wav` (3-stage mechanical iron transient) | Mono, `48kHz` 16-bit WAV | `0.75s` One-Shot (Non-looping) | Three-part antique iron ward lock mechanism: key ward engagement click (`50ms`), heavy bolt slide scrape (`180ms`), and solid iron keeper clunk (`420ms`). |
| 8 | Footsteps on stone | `audio/footsteps_on_stone.wav` (4-step cadence; live foley optional) | Mono, `48kHz` 16-bit WAV | `2.40s` One-Shot (4 steps @ `0.56s` interval) | Four deliberate leather-soled heel-toe steps on damp flagstone (`115 Hz` stone thud + `600–3800 Hz` fine grit crunch, minimal crypt slap-back). |
| 9 | Paper handling | `audio/paper_handling.wav` (Filtered micro-envelope burst; live foley optional) | Mono, `48kHz` 16-bit WAV | `1.10s` One-Shot (Non-looping) | Crisp, dry turn of thick 19th-century rag-cotton journal parchment (`1.1–7.5 kHz` fibrous rustle, no modern glossy paper snap). |
| 10 | Distant crows | **Not Generated** (Requires organic wildlife field recording) | Stereo (Target `48kHz` WAV) | Target `3.5–5.0s` One-Shot (Non-looping) | **Production Brief**: Record or source 2–3 sparse, weathered *Corvus corax* / *Corvus corone* calls at `60–100m` distance in open damp air; roll off highs above `3.2 kHz`, add subtle misty valley diffuse tail, avoid close/harsh screeching or background traffic/wind rumble. |
| 11 | Restrained discovery cue | `audio/restrained_discovery_cue.wav` (Harmonic glass/bronze dyad) | Stereo, `48kHz` 16-bit WAV | `2.80s` One-Shot (Non-looping) | Non-melodic bowed glass/tuning-fork open fifth (`D3 + A3`) with soft `220ms` attack and warm resonant decay; subtle and contemplative. |
| 12 | Restrained danger cue | `audio/restrained_danger_cue.wav` (Bowed low cluster + rosin friction) | Stereo, `48kHz` 16-bit WAV | `3.20s` One-Shot (Non-looping) | Low bowed double-bass/waterphone tension cluster (`C2 + C#2` minor-second beating + `F#2` tritone + dry rosin bow friction); unsettling dread without jump-scare transients. |
| 13 | Objective completion | `audio/objective_completion.wav` (Low brass/chime fifth resolution) | Stereo, `48kHz` 16-bit WAV | `3.50s` One-Shot (Non-looping) | Solemn, grounded low bronze/chime fifth-and-octave resonance (`D2 + A2 + D3`) with gentle decay. |

## Explicit List of What Could Not Be Generated

1. **Direct Reuse Audit of Existing Game Packs & Task 1–3 Visual References**: The prompt noted *"I will attach approved environments, characters, and the style guide from the previous tasks"* and *"If I provide those existing assets, inspect them first and reuse suitable ones."* Because no files were attached to this conversation, we could not inspect existing item, UI, or audio packs for reuse.
2. **`distant_crows.wav` (Organic Wildlife Vocalization)**: Per the prompt's instruction not to fabricate placeholders or unnatural voices/sounds where organic recording is required, `distant_crows` was intentionally omitted from procedural synthesis and documented with a complete field-recording/sourcing brief above.
3. **Live Microphone Foley Recordings**: While `rope_strain.wav`, `period_wooden_door.wav`, `footsteps_on_stone.wav`, and `paper_handling.wav` have clean 48kHz physical-modeling procedural WAV masters included in `audio/` for immediate engine integration, acoustic foley recorded with real hemp rope, oak doors, leather boots on flagstone, and rag paper is recommended for final shipping mix polish.
