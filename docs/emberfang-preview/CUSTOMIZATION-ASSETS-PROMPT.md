# Dragon customization assets: generation brief

Armor, weapons, ability effects and icons that appear on the **dragon select / customize screen** and on the dragon in the match.

## Read first: how these pieces get onto the animated dragon

The five dragons (Emberfang, Frostwing, Ironmaw, Voltscale, Tidefang) were generated from one animation skeleton, so they hit **the same poses on the same frames** and share the same cell (384x384, feet on row y=350, body centre x~165, facing right).

That means one set of gear can fit all five dragons:

1. Each piece is drawn **once**, in position on a neutral reference dragon in the **idle pose**, on a 384x384 transparent canvas (so the piece already sits where it belongs; no manual placement).
2. The engine tracks where each body part goes on every frame of every animation (head, chest, shoulders, forearms, shins, tail) and moves/rotates/scales the piece to follow. I (Claude) write that tracker afterwards, once the pieces exist.
3. Pieces are **rigid**: they do not deform. So draw them as solid plates that tolerate a few degrees of rotation. Avoid long flowing cloth that would have to bend.

Because the engine only moves rigid pieces, the quality of the result depends on the pieces being clean, separate, and the right shape for the part. The rules below are written for that.

## Open questions (fix before generating)

- The table says **10 pieces per armor set**, but the list gives 9 (helmet, chest, 2 shoulders, 2 forearms, 2 shins, tail guard). I added a 10th, **waist plate**. Drop it if the list is right, or tell me what the 10th should be.
- Icons: "19 = one for each size, armor, weapon and ability". I count 3 armor + 4 weapon items (Steel Talons, Great Claws, Tail Mace, Horn Spikes) + 6 abilities (Aegis, Phase Dash, Decoy, Rage, Gust, Fade) = 13, so **6 are size icons**. Send me your size names and I'll fill them in below (placeholder `SIZE_1..6`).
- Weapons: "one file per arm" for Steel Talons and Great Claws, so Steel Talons L/R + Great Claws L/R + Tail Mace + Horn Spikes = 6 files.

## Master style block (paste at the top of EVERY prompt)

> Style: painted 2D game sprite, same art style, line weight and shading as the reference dragon (clean dark outline, soft cel shading, rim light from upper left, slightly stylised heroic proportions). Same pixel scale as the reference: **the dragon is ~255 px tall on a 384x384 canvas**. Side view, facing RIGHT. Transparent background, no ground, no shadow, no text, no watermark, no frame. Colours must read on a dark arena background. Do not change the reference dragon; draw ONLY the item requested.

Reference image to attach every time: **the idle frame 0 of the neutral reference dragon** (use Emberfang `01_Idle.png`, frame 0, character only, converted to a flat grey "mannequin" so colours don't leak into the armor), plus a second image of the same frame with the target body part circled.

## Piece rules (apply to every armor and weapon piece)

- Output: **one PNG per piece, 384x384, transparent**, the piece in the exact position and size it would have on the reference idle pose. Nothing else in the image (no mannequin, no other pieces).
- Piece must be a **separate closed shape**. Nothing that crosses into a neighbouring piece's area (shoulder plate must not cover the helmet, etc.).
- Hard silhouette, readable at 100 px tall. No loose chains, capes, or thin dangling parts.
- Draw the piece **fully**, including the part that would be hidden behind the body (the engine masks it). Do not crop.
- Near-side and far-side pieces are different art because of lighting and angle: **left = far side (darker), right = near side (lighter)**. Draw them as two separate images.
- Neutral metal/bone/leather colours (no elemental tint). The game tints per dragon.

## Armor: 3 sets x 10 pieces = 30 files

Files: `armor/<set>/<piece>.png`, with `<set>` = `scale_mail`, `iron_plate`, `dragonbone`.

Set looks:

| Set | Look |
| --- | --- |
| `scale_mail` | Overlapping small dark steel scales on leather straps, bronze rivets, light and mobile. |
| `iron_plate` | Heavy riveted grey iron plates with dark trim, battle-scarred, blocky and strong. |
| `dragonbone` | Ivory-white carved bone plates with gold inlay and spiked edges, ceremonial but fierce. |

Pieces (same list for all three sets):

| File | What it covers | Layer order | Extra notes |
| --- | --- | --- | --- |
| `helmet.png` | Head and jaw, with openings for the horns/crest and the eyes | front | Leave the horns/crest visible or poking through. |
| `chest.png` | Torso from collarbone to waist | front | Must not cover the shoulders. |
| `shoulder_far.png` | Far-side shoulder pauldron | behind body | Darker. |
| `shoulder_near.png` | Near-side shoulder pauldron | front | |
| `forearm_far.png` | Far-side forearm guard (wrist to elbow) | behind body | Leave the claw hand free. |
| `forearm_near.png` | Near-side forearm guard | front | Leave the claw hand free. |
| `shin_far.png` | Far-side shin guard (ankle to knee) | behind body | Leave the foot and claws free. |
| `shin_near.png` | Near-side shin guard | front | Leave the foot and claws free. |
| `tail_guard.png` | Armor segment on the first third of the tail | behind body | Short, solid segment, not the whole tail. |
| `waist.png` (10th, assumed) | Belt / hip plate | front | Sits between chest and thighs. |

Per-piece prompt template:

> [MASTER STYLE BLOCK] Reference: grey mannequin dragon idle pose. Draw ONLY the **{PIECE}** of a **{SET LOOK}** armor set, fitted exactly to the circled body part on the reference, in the exact position and size on a 384x384 transparent canvas. Single separate rigid piece, hard silhouette, nothing else in the image.

Generate the whole set in one go so the three sets keep one style: ask for all 10 pieces of one set, then split. If the generator can't keep alignment, generate each piece individually with the circled reference.

## Weapons: 6 files

Files: `weapons/<name>.png`. Same piece rules.

| File | What | Notes |
| --- | --- | --- |
| `steel_talons_far.png`, `steel_talons_near.png` | Polished steel talon blades fitted over the claws of each hand | Follow the claw direction on the reference; extend ~20% past the claw tips. |
| `great_claws_far.png`, `great_claws_near.png` | Oversized curved heavy claws, dark iron with a faint edge glow | Extend ~50% past the claw tips; must still read as part of the hand. |
| `tail_mace.png` | Spiked iron mace head fitted on the tail tip | Draw at the tail tip position on the idle pose; head ~70 px across. |
| `horn_spikes.png` | Long steel spikes capping/extending the horns | Fit to the horns on the reference. |

Prompt template:

> [MASTER STYLE BLOCK] Reference: grey mannequin dragon idle pose, with the {BODY PART} circled. Draw ONLY a **{WEAPON}** fitted to that body part, exact position and size on a 384x384 transparent canvas, one rigid piece.

## Ability effects: ~46 frames

Effects are **animation sheets on a larger cell: 512x512**, 4 columns, reading order, transparent. The dragon is **not** in them. Anchor: the dragon's feet centre sits at **(256, 440)** of each cell and its body centre x is 256, so the effect lines up when the engine drops the sheet on the dragon.

| File | Frames | Loop | Cell | What |
| --- | --- | --- | --- | --- |
| `fx/aegis_bubble.png` | 8 | loop | 512x512 | Translucent hex-pattern energy sphere around the dragon, slow shimmer and pulse, edge brighter than centre; sphere ~340 px across, centred at the chest (256, 300). |
| `fx/aegis_shatter.png` | 8 | one-shot | 512x512 | The same sphere cracking and bursting into hex shards that fly outward and fade. Frame 0 must match `aegis_bubble` frame 0. |
| `fx/phase_dash.png` | 8 | one-shot | 512x512 | Quick teleport-dash burst: a compressed ring + streaking afterimage lines that expand and dissipate, horizontal emphasis. Centre at the chest. |
| `fx/decoy_pop.png` | 6 | one-shot | 512x512 | A small puff-of-smoke and spark pop (a decoy vanishing): bright flash on frame 0-1, smoke cloud expanding then fading. |
| `fx/rage_aura.png` | 8 | loop | 512x512 | Red-orange flame aura rising off the whole body, flickering, wider at the feet; no dragon inside. |
| `fx/gust_wind.png` | 8 | one-shot | **512x256** | A horizontal wind-wave projectile: curved white-blue crescent with streaking air lines, travelling left to right across the cell, leaving a short trail. |

Total: 8+8+8+6+8+8 = **46 frames**. *Fade* needs no art (engine fades the sprite).

Per-effect prompt template:

> [MASTER STYLE BLOCK, but ignore the dragon-size line] Draw a **{FRAMES}-frame animation sheet**, 4 columns, each cell {W}x{H} px, transparent background, reading order left-to-right top-to-bottom, of **{EFFECT DESCRIPTION}**. No character in the image. Effect fully inside each cell (nothing touching the cell edges). Consistent scale and centre in every frame. Bright core, soft outer glow, readable on a dark background. {LOOP: last frame must flow into the first | ONE-SHOT: first frame is nearly empty and last frame is nearly empty}.

## Icons: 19 files at 128x128

Files: `icons/<group>_<name>.png`, transparent, **128x128**, centred object filling ~80% of the canvas, bold silhouette, readable at 48 px, one consistent style (painted, dark outline, rim light), no text. Give each group a coloured edge accent so groups are recognisable: sizes = grey, armor = blue, weapons = orange, abilities = teal.

| Group | Files | Icon shows |
| --- | --- | --- |
| Size (6) | `size_1.png` ... `size_6.png` (rename to your size names) | A dragon silhouette at increasing scale next to a fixed reference mark, or a scale bar. |
| Armor (3) | `armor_scale_mail.png`, `armor_iron_plate.png`, `armor_dragonbone.png` | The chest plate of each set, front-on. |
| Weapons (4) | `weapon_steel_talons.png`, `weapon_great_claws.png`, `weapon_tail_mace.png`, `weapon_horn_spikes.png` | The weapon on its own. |
| Abilities (6) | `ability_aegis.png`, `ability_phase_dash.png`, `ability_decoy.png`, `ability_rage.png`, `ability_gust.png`, `ability_fade.png` | Aegis = glowing hex shield; Phase Dash = streak lines through a ring; Decoy = two overlapping dragon silhouettes, one faded; Rage = flame aura; Gust = wind crescent; Fade = a dragon silhouette dissolving into particles. |

Prompt template:

> Painted 2D game UI icon, 128x128, transparent background, one centred {OBJECT}, bold silhouette, dark outline, rim light from upper left, {GROUP COLOUR} edge accent, no text. Same style across the set.

## Delivery and naming

```
customization/
  armor/{scale_mail,iron_plate,dragonbone}/{helmet,chest,shoulder_far,shoulder_near,forearm_far,forearm_near,shin_far,shin_near,tail_guard,waist}.png   (384x384)
  weapons/{steel_talons_far,steel_talons_near,great_claws_far,great_claws_near,tail_mace,horn_spikes}.png   (384x384)
  fx/{aegis_bubble,aegis_shatter,phase_dash,decoy_pop,rage_aura}.png (512x512 cells), fx/gust_wind.png (512x256 cells)
  icons/*.png   (128x128)
```

## Acceptance check on a delivered piece

1. Drop it over the reference idle frame: it must line up with the body part to within ~3 px, with no gaps or overhang beyond what the brief allows.
2. The piece is a single connected shape and nothing in the PNG is cropped by the canvas edge.
3. The 3 armor sets share one level of detail and one piece boundary; a piece from one set can be swapped for another without a visible gap.
4. Effects: no sprite pixel touches a cell edge; loop effects close seamlessly; one-shot effects start and end nearly empty.
5. Icons readable at 48 px.

## What I build once the art exists

- A tracker that records, per frame of all 25 animations, where each body part is, so every piece follows the dragon (reused for all five dragons).
- The customize screen on dragon select: pick size, armor set, weapon, with a live preview that plays the animations.
- Ability effects wired to the abilities, drawn at the dragon's anchor.
