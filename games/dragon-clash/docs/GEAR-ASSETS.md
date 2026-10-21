# Dragon Clash — gear asset list

What to draw so dragons can be equipped with **armour, weapons, abilities and a size** that change how they fight.
Gear replaces colour/horn/wing customisation on the pre-fight screen: you pick a dragon, then its loadout.

Templates in `docs/asset-templates/`:
- `paint-over-template.png`: the dragon at 45% opacity on a transparent 960×960 canvas, red ground line. Paint over it.
- `body-guide.png`: the same pose with every rig part (box), joint (dot), attach point and the ground line labelled.

## 1. Decide the body first

Gear is drawn to fit one body. Everything below fits the **current upright Dragon Warrior body**. If you switch to the
four-legged dragon pack later, armour and weapons must be redrawn for that body (different shoulders, legs, neck).
Abilities, icons and effects carry over.

## 2. How gear plays (so the art matches the job)

Gear has its own 30-point budget on top of the dragon's 100-point build, so heavy armour or a big weapon means
giving up something else in the loadout. Size swaps the body frame and needs no art. All of this is in the game now
with placeholder art; each file below replaces its placeholder when added.

| Slot | Options (first version) | What it changes |
| --- | --- | --- |
| **Size** | Small · Medium · Large · Huge | Hitbox size, weight (knockback resistance), reach, speed. Uses the existing body frames. No new art. |
| **Armour** | None · Scale Mail · Iron Plate · Dragonbone | Takes less knockback (−6% / −12% / −18%); slower run and jump (−3% / −7% / −11%). |
| **Weapon** | Bare Claws · Steel Talons · Great Claws · Tail Mace · Horn Spikes | Talons: faster, +light damage. Great Claws: +heavy damage and reach, slower startup. Tail Mace: tail attacks hit harder. Horn Spikes: up attacks launch higher. |
| **Ability** (separate button, cooldown) | Fade · Aegis · Phase Dash · Decoy · Rage · Gust | See section 5. |

Invisibility in a shared-screen fighter: everyone sees the same screen, so **Fade** makes you a faint shimmer (about
20% visible) for 1.5 s, ends the moment you attack or get hit, and has a long cooldown. Fully invisible would be
unplayable for the other players.

## 3. File rules (every body piece)

- **PNG with transparency**, **960 × 960** canvas (2× the pack's 480 px cells, so Large and Huge stay sharp).
- **Same position as the template**: paint the piece exactly where it sits on the template dragon, then hide the
  dragon layer and export the piece alone. No re-centring, no trimming. The game finds the right joint from the
  position.
- **Facing right**, lit like the pack (light from the front and above), no cast shadows, no glow baked in.
- **One file per piece per body part**: pieces that sit on two parts (for example a pauldron that covers shoulder
  and upper arm) go on the part that moves with them; the guide boxes show the parts.
- Near-side and far-side pieces are separate files (`near` = the limb closer to the viewer, on the right of the
  template; `far` = behind the body). The far piece can be a little darker.
- Leave a 1–2 px overlap at joints so nothing gaps when a limb bends.
- Names: `armor-<set>-<piece>.png`, `weapon-<name>-<piece>.png`, `fx-<ability>-<n>.png`, `icon-<thing>.png`
  (lowercase, dashes).

## 4. Body pieces to draw

### Armour (per set: Scale Mail, Iron Plate, Dragonbone)

| File | Sits on (guide box) | Notes |
| --- | --- | --- |
| `armor-<set>-helm.png` | head | Around the skull, must not cover the eye. Horns pass through or over it. |
| `armor-<set>-chest.png` | torso | Breastplate over the chest and belly plates. |
| `armor-<set>-pauldron-near.png` | nearArmUp | Near shoulder. |
| `armor-<set>-pauldron-far.png` | farArmUp | Far shoulder (partly hidden behind the body). |
| `armor-<set>-bracer-near.png` | nearArmLo | Forearm; keep the claws free. |
| `armor-<set>-bracer-far.png` | farArmLo | |
| `armor-<set>-greave-near.png` | nearShin | Shin and knee. |
| `armor-<set>-greave-far.png` | farShin | |
| `armor-<set>-tailguard.png` | tail root | Plates on the first third of the tail. Mark the tail-root square from the guide. |

10 files per set, **30 for three sets**. Make Scale Mail light and flexible-looking, Iron Plate solid, Dragonbone
the heaviest silhouette, so the trade-off reads at a glance.

### Weapons

| File | Sits on | Notes |
| --- | --- | --- |
| `weapon-talons-near.png`, `-far.png` | nearArmLo / farArmLo | Metal claw caps over the fingers. |
| `weapon-greatclaws-near.png`, `-far.png` | nearArmLo / farArmLo | Long blades from the forearm past the claws; noticeably longer reach. |
| `weapon-tailmace.png` | tail tip | Draw it on a **separate 512×512 canvas**, tail pointing left, with the attach point at the canvas centre (the tail is animated separately from the body). |
| `weapon-hornspikes.png` | head | Metal caps or spikes on the horns. |

**6 files.**

## 5. Abilities (effects and icons, not body pieces)

| Ability | What it does | Art needed |
| --- | --- | --- |
| **Fade** | 1.5 s at ~20% visibility, broken by attacking or being hit, 14 s cooldown | Optional: `fx-fade-shimmer.png` (256×256 seamless noise). The game can generate one. |
| **Aegis** | A shield that absorbs one hit, 3 s, 12 s cooldown | `fx-aegis-1..8.png`: 8-frame bubble loop, 320×320, centred. `fx-aegis-break-1..6.png`: shatter. |
| **Phase Dash** | Short teleport-dash through attacks, 8 s cooldown | `fx-phase-1..6.png`: 6-frame burst, 256×256. |
| **Decoy** | Leaves a copy that draws CPU attacks and bursts when hit | `fx-decoy-pop-1..6.png`: 6-frame burst, 256×256. The copy itself uses the dragon art. |
| **Rage** | +15% damage dealt, +15% knockback taken, 5 s | `fx-rage-1..8.png`: 8-frame aura loop, 320×320, centred on the body. |
| **Gust** | Wing blast that pushes enemies away, no damage | `fx-gust-1..6.png`: 6-frame wind wave, 384×192, blowing to the right. |

Effects: transparent PNG, pure colours on transparent (the game adds glow and mirrors them for facing left).

## 6. Interface icons

128 × 128 transparent PNG, readable at 48 px, one per item:
- Sizes ×4: `icon-size-small/medium/large/huge.png`
- Armour ×4 (including None): `icon-armor-none/scale/iron/bone.png`
- Weapons ×5: `icon-weapon-claws/talons/greatclaws/tailmace/hornspikes.png`
- Abilities ×6: `icon-ability-fade/aegis/phase/decoy/rage/gust.png`

**19 icons.**

## 7. Totals and a first batch

Full set: 30 armour + 6 weapon + about 46 effect frames (+1 optional texture) + 19 icons ≈ **100 PNG files**.

To get gear into the game quickly, start with:
1. **One armour set** (Iron Plate): helm, chest, both pauldrons, both greaves (6 files).
2. **Two weapons**: Steel Talons (2 files) and Tail Mace (1 file).
3. **Three abilities**: Fade (no art needed), Aegis (14 frames), Gust (6 frames).
4. Icons for those.

Everything else uses placeholders until it is drawn, and each new file drops in without code changes:
put the PNGs in `assets/gear/src/` and run `python3 tools/build_gear.py`. It reports any file whose name it doesn't
recognise. Wired up so far: armour and weapon pieces, `fx-aegis-1..8`, `fx-rage-1..8`. The other effect frames and
the icons are listed so the set is complete; the game shows painted effects and emoji icons for those until they
are hooked up.

## 8. Sounds

From the licensed packs already in use: equip clank per armour weight, one cast and one end sound per ability
(Fade, Aegis absorb and break, Phase, Decoy pop, Rage, Gust). No new recordings needed.
