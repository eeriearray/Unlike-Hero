# Armor and weapons as "dressed" animation packs

## Why the rigid overlay pieces failed

The 61 customization files were drawn once, on one generic pose, as separate rigid pieces. On the five real dragons they float: shin and forearm guards sit off the limbs, the helmet is a visor blob, weapons hover beside the hands, and the tail mace is in empty space. Moving rigid pieces through 25 animations would only carry the misfit along. Dragons also differ too much (slim Frostwing, hunched Ironmaw, finned Tidefang) for one shared shape.

## The approach that fits: bake the gear into the animation sheets

The dragon packs already work well. So generate each armor set **as a full pack on that dragon**, using the bare pack as the pose reference. The game then swaps sheets 1:1 (no tracking, no fitting) and the gear is drawn by the same generator that drew the dragon, so it fits by construction.

- **Armor:** 5 dragons x 3 sets (Scale Mail, Iron Plate, Dragonbone) = **15 packs**, each with the same 25 animations as the bare pack.
- **Weapons:** do not make 4 more packs per dragon (that multiplies out). Treat them as one of:
  - stat items + a tinted version of the existing attack effects (slash arcs, impact flashes), no new body art; or
  - only the two weapons that change the silhouette (**Tail Mace** and **Steel Talons**), baked into an extra "armed" variant per set later, if the armor packs look good.
- **Icons and ability effects** from `dragon_customization_assets` are fine as they are and stay.

## Rules that make a dressed pack swappable

1. **Same frames, same poses, same timing** as the bare pack for that dragon: same frame count per animation, same grid (4 columns), same 384x384 cell, same feet row (y=350), same body centre. The only change is the armor.
2. The dragon's body, face, colours and silhouette are unchanged under the armor. Armor follows the body; it must not widen the silhouette by more than ~15 px anywhere.
3. Armor on the tail follows the tail's curve and never changes the tail's length or shape between frames.
4. The effects layer stays as it is in the bare pack. Deliver the dressed **character only** layer (`character_only/`) and the game reuses the bare pack's effects layer.
5. Keep each set's look identical across all five dragons so a set reads as one set.

## Prompt (per dragon, per set; attach the dragon's bare pack as the pose reference)

> Image-to-image edit. The attached sprite sheet is the reference: **keep every frame's pose, framing, scale, cell layout and timing exactly the same**. Dress this exact dragon in **{SET}** armor (look below) on the head (helmet), chest, shoulders, forearms, shins and the first third of the tail. The armor must wrap the real body shape in every frame, follow the limbs and tail as they move, and never float away from the body. Do not change the dragon's face, colours, horns, fins or silhouette beyond the armor. Transparent background, no ground, no text, painted 2D sprite style identical to the reference. Output the same sheet layout: {FRAMES} frames, 4 columns, 384x384 cells.

Set looks:

| Set | Look |
| --- | --- |
| Scale Mail | Overlapping small dark steel scales on leather straps, bronze rivets, light and mobile. |
| Iron Plate | Heavy riveted grey iron plates with dark trim, battle-scarred, blocky. |
| Dragonbone | Ivory-white carved bone plates with gold inlay and spiked edges. |

## Delivery

```
dressed/<dragon>/<set>/character_only/01_Idle.png ... 25_Defeat.png
```

`<dragon>` = emberfang, frostwing, ironmaw, voltscale, tidefang; `<set>` = scale_mail, iron_plate, dragonbone.

## Acceptance test (I run it on each delivered sheet)

1. Same frame count per animation as the bare pack, same cell size.
2. Overlay on the bare frame: the body outline (excluding armor) matches within ~4 px in every frame.
3. Feet stay on row 350 +/- 3 px, same as the bare pack.
4. Armor does not detach from the body in any frame (no gap between armor and body larger than ~4 px).
5. Tail length and tip position change smoothly (no snapping, <= 25 px per frame).

## Try one first

Before doing all 15: generate **one** dressed pack (suggested: Ironmaw in Iron Plate) and send it. I will run the acceptance test and drop it into the arena so you can judge the look, then we do the other 14.
