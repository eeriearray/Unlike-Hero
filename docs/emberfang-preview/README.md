# Dragon animation preview arena

A playable test arena for the five dragon sprite packs (Emberfang, Frostwing, Ironmaw, Voltscale, Tidefang).

Run the hub (`npm start`, or the `hub` launch config) and open `/docs/emberfang-preview/index.html`.

- **Controls:** A/D run (Shift sprint), W jump, S crawl, Space dodge, I guard (I+S braced), J/K/L attacks (S+L second elemental), 1-6 abilities, V victory, R reset.
- **Customize:** size, colour swatches, particle auras, perks, elemental imbue, 3-of-6 ability loadout. Armor/weapon art is in `customization/` but is not wired up (it does not fit the dragons; see `DRESSED-PACKS-PROMPT.md`).
- **Animation viewer:** the buttons under the arena loop any of the 25 animations.

## Assets

`ember3x/ frost3x/ iron3x/ volt3x/ tide3x/` hold each dragon's 25 sheets with two optical-flow in-between frames per source frame (3x), plus `manifest.json` (frame counts, foot heights, hit/guard frames). They are generated from the packs by the scripts in `build/`:

- `build_layered.py` - pack with `body_layers/` + `effects_layers/` + `<name>_animations_metadata.json` (Voltscale, Tidefang)
- `build_layered2.py` - pack with `character_only/` + `vfx_layers/` + `animation_metadata.json`
- `build_layered3.py` - pack with `sprites_only/` + `effects_only/` + `animation_manifest.json`
- `accept.py`, `acc2.py` - acceptance checks (feet row, jump rise, cropping, loop seam)

Set `MAXFLOW=45` when building so big pose jumps fall back to a plain blend. Briefs for new art: `REGEN-PROMPT.md`, `CUSTOMIZATION-ASSETS-PROMPT.md`, `DRESSED-PACKS-PROMPT.md`.

The sheets are large (~320 MB total); convert to WebP and trim empty space before shipping in a real game.
