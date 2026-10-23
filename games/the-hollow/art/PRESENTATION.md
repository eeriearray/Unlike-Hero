# Step 2 — inventory, interface and D20

All optional art is registered in `manifest.json`. `presentation.json` maps game IDs
to those logical IDs and sets only cosmetic rarity. No engine rules or data changed.
The five engine relics and Moonbound Relic provide the six relic visuals requested.
Public distribution remains subject to the existing `CREDITS.md` licensing audit.

## Icon mapping

| Game ID | Icon | Pack |
|---|---|---|
| lantern | jar-candle, 32px | ShaderLoom |
| lamp_oil | pyre-fluid, 32px | ShaderLoom |
| tonic | charm-elixir, 32px | ShaderLoom |
| thread | writhing_ring | Cursed Relics / M-Xing Studio |
| salt | talismans-seals, 32px | ShaderLoom |
| blade | moonsteal-dagger, 32px | ShaderLoom |
| moonrelic | goat_skull_amulet | Cursed Relics / M-Xing Studio |
| spirit_key | shackled_soul | Cursed Relics / M-Xing Studio |
| clapper | abyssal_bell | Cursed Relics / M-Xing Studio |
| herb | moonwort-sprig, 32px | ShaderLoom |
| snare | thorn_choker | Cursed Relics / M-Xing Studio |
| chalk | ritual-chalk, 32px | ShaderLoom |
| candle | black_candle | Cursed Relics / M-Xing Studio |
| mirror_shard | twisted_mirror | Cursed Relics / M-Xing Studio |
| moonwater | charm-elixir, 32px | ShaderLoom |
| wardens_key | shackled_soul | Cursed Relics / M-Xing Studio |
| star_lens | forbidden_monocle | Cursed Relics / M-Xing Studio |
| weeping_eye | demon_eye_brooch | Cursed Relics / M-Xing Studio |
| saint_finger | severed_finger | Cursed Relics / M-Xing Studio |
| gilded_psalter | fractured_phylactery | Cursed Relics / M-Xing Studio |
| bone_chalice | corrupted_chalice | Cursed Relics / M-Xing Studio |
| ember_locket | soulstone-pendant, 32px | ShaderLoom |

Several are thematic substitutes rather than literal illustrations. Text labels,
counts, equipment state and descriptions continue to identify the actual item.
Pixel icons always use `image-rendering: pixelated`. Rarity glow is on the enclosing
span, so it does not blur the image itself. Rare/relic tiers follow existing metadata.

## Integration

`js/presentation.js` decorates the central `HollowArt.itemArt` helper. Pack slots,
item modals, dropped items and reward flights all use the same helper. SVG remains
inside the wrapper until the imported image has loaded. A failed load keeps SVG;
unlisted logical IDs cause no media request. The mutation observer only reacts to
new icon/dice containers and does no frame-by-frame work.

The journal has a current-inventory section based only on the player's view.
Interaction cards and action cards show item badges when the visible choice names
a purchase or its disclosed cost includes an item. Unknown search rewards are not
shown in advance. Only `cards.js` needs a small integration change; the large UI and
event files retain their existing implementations.

The UI skin uses two lossless crops from `UIBundleFree/FreeHorrorUi.png`, installed
with CSS `border-image`. The crop rectangles and border slices live in
`tools/hollow-asset-slices.json`; `tools/build-assets.mjs` reproduces them. VHS panel
and focus artwork supplies HUD details. Gravewire is loaded from the manifest via
FontFace, with the original title fonts as fallback. Body copy remains readable.
The journal paper uses dark text and CSS grain over a warm parchment surface.
DieJars decorates both existing dice-tray implementations.

`js/physical-dice.js` replaces only the die illustration. It builds a CSS
icosahedron with twenty triangular faces and all twenty numbers, keeping the
engine result on the front face. Existing roll pacing, skipping, captions, sound
names and reward timing remain authoritative. CSS supplies tumble, bounce, settle,
gold critical-success and red fumble effects. Browsers without 3D/clip-path support
retain the original SVG. Reduced-motion preferences stop the new animations,
including landing rings. Nothing here changes the roll or its consequences.

The stage also checks `:focus-visible` before moving the camera for an offscreen
focused hotspot, preserving keyboard access without moving targets during taps.

## Run and review

```sh
cd "/Users/akshat/Desktop/unlike hero"
node tools/build-assets.mjs --source "$HOME/Desktop/horror game assets"
node --test test/the-hollow-*.test.mjs
npm start
```

The server is already running for this handoff. Rebuilding is needed on a fresh
checkout or to reproduce the two new UI crops; no browser build step is needed.

- Game: http://localhost:8080/games/the-hollow/
- Art review: http://localhost:8080/games/the-hollow/art/preview.html

The art review page presents all 22 mapped items and a repeatable 12/20/1 roll.
It loads the existing static item catalogue and does not read/write expedition
state, local saves, room state or gameplay commands. Its reduced-motion checkbox
is local to the review page and does not change saved game preferences.

The payload is still below 40 MB. Full scene-specific feedback, sound replacement,
character work and title/ending screens belong to the later requested steps.
