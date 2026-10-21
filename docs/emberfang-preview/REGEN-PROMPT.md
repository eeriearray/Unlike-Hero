# Regeneration brief: dragon fighter animations

Why: the Emberfang and Frostwing sheets look great as single frames but the *motion* is weak. Measured problems:

- Run / Run 2: legs barely cycle; the whole body just lifts ~35 px mid-cycle (a hop), so it reads as gliding.
- Jump: the dragon never leaves the ground inside the cell (in-place crouch/stand), so air time has to be faked in code.
- Dodge: mostly the idle pose plus baked-in ghost trails.
- Attacks: torso and limbs barely move; a fire/ice effect is pasted over a standing pose.
- Guard: the arm sweeps across the torso and tears when frames are interpolated.
- Only 10-16 frames per move, so motion steps.

## Prompt (paste with the character reference image, once per animation)

> Same character, same proportions, same scale and same art style as the reference. Side view, facing RIGHT, full body visible, transparent background.
> Animate **<MOVE>** as a fighting-game sprite animation. The limbs, torso, head and tail must visibly move; do not hold the idle pose and add an effect on top. Keep the body strictly in place (no camera or whole-body drift) except where noted. Do not bake motion-blur ghosts or afterimages into the dragon. Keep every effect fully inside the frame.

Per move, append:

| Move | Add to the prompt |
| --- | --- |
| Idle | 12 frame seamless loop, slow breathing, tail sway, weight shift; first and last frame identical pose. |
| Run | 8 frame seamless run cycle with real leg motion: contact, down, passing, up for each leg. Torso leans forward ~15 degrees, arms pump opposite to legs, tail trails behind. **A foot must stay on the ground line in every contact frame; the body must not hop more than ~8 px.** |
| Run 2 (sprint) | Same, lower and faster: torso ~30 degrees forward, longer strides. |
| Crawl | 8 frame low prowl loop, alternating front/back limbs, belly near ground. |
| Jump | 12 frames: crouch (3), launch (2), rise with legs tucking up and **feet clearly leaving the ground**, ending in the apex pose. Dragon rises well above its standing height. |
| Fall | 6 frame loop: arms up, legs dangling, tail whipping. |
| Landing | 8 frames: impact crouch, squash, recover to idle. Dust only at feet. |
| Dodge / dodge 2 | 10 frames: lean back or dash forward in one clear motion, body low, then recover. Dragon itself is sharp; no ghost trails. |
| Guard | 8 frames: raise **both forearms in front of the face/chest**, hold the final pose on 2-3 identical frames, then lower. Arms stay in front of the body, never crossing through the torso. |
| Light attack x3 | 10 frames: **anticipation** (3 frames, pull back and coil), **strike** (3 frames, fast, body lunges forward with the arm), **recovery** (4 frames). Different limb each time (jab, hook, tail whip). The body must clearly move. |
| Heavy attack x2 | 14 frames: longer coil (5), explosive strike with full-body rotation (3), follow-through (3), recovery (3). |
| Elemental x2 | 14-16 frames: charge pose (crouch, gather energy), release (rear up / breathe), effect, settle. Effect stays inside the frame; mark the release frame. |
| Hit reaction x2 | 8 frames: head snaps back, torso recoils, then returns to guard stance. |
| Knockback | 14 frames: launched backward, tumbling, lands, slides. |
| Recovery | 12 frames: get up from the ground to idle stance. |
| Victory | 12 frames: roar / pose, then settle. |
| Defeat | 14 frames: stagger, fall, lie still. |

## Technical spec for the sheets

- Cell 384x384 px, transparent PNG, one sheet per move, 4 columns, frames in reading order.
- Character height ~255 px in every sheet. Feet rest on cell row **y = 350**. Body centre at **x = 172**, facing right.
- Same scale in every move; no cropping at cell edges. Leave ~60 px of free room on the right for effects.
- Frame count per the table above (8-16). Looping moves (idle, run, crawl, fall): last frame must flow into the first.
- If possible, export the effects (fire, ice, slash arcs, ground rings) as a **separate transparent layer** per move, so the engine can place and scale them and so effects never get cropped.

## Quick acceptance test on a new sheet

1. Run: do the legs alternate, with a foot planted on the ground each step? Lowest foot pixel stays within ~8 px of y=350.
2. Jump: lowest foot pixel rises at least 60 px above y=350 at the apex.
3. Light attack: compare frame 0 and the strike frame with the effect hidden; the torso position should differ clearly.
4. Idle/run loop: last frame to first frame difference is no bigger than any other consecutive pair.
5. No sprite pixel touches the cell edge.

## Added after the Tidefang review: tail continuity

Tidefang's tail changes shape abruptly between frames (in the idle loop it curls forward for several frames and then flicks upright; in Light Attack 1-3 it jumps from stretched to curled in one frame), which shows up as the tail "snapping".

Add to every prompt:

> The tail is one continuous object: keep the same tail length, thickness and fin shape in every frame, and move it along a smooth arc. The tail tip must move no more than ~25 px between consecutive frames (~12 px in the idle loop). Never redraw the tail in a different pose from one frame to the next.

Acceptance test: measure the tail-tip position per frame; flag any consecutive pair that moves more than 25 px (12 px for idle).
