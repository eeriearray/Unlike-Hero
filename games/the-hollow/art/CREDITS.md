# The Hollow — asset credits and license audit

Source: user-provided local archives. This is an inventory of bundled evidence, not a declaration that publication is cleared. Unknown authors/licenses are explicitly unresolved. Generated media is local-only and ignored by Git. No packs have been published.

**Approval required:** Hollow Hours (AI-generated) and Survival Horror Items (no redistribution, even modified) are excluded. Before any public inclusion, ask the user and resolve applicable browser-distribution permissions. Weird Horror and Haunted School are excluded because their bundled licenses allow only noncommercial use.

| Pack | Author / credit | Bundled license evidence | Pipeline |
|---|---|---|---|
| 1-mimic-garden-icons.zip | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| 64x64 weapons final.png | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| CursedRelics_EldritchSeals_Vol11.zip | M-Xing Studio | Bundled standard commercial game asset license; no raw asset redistribution | Local preview only; publication not cleared |
| DieJars[1.0].zip | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| Free Pack #3.zip | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| Free_Survival_Horror_Items_Pack.zip | Unknown: not identified in bundled read_me.txt | Commercial/noncommercial use allowed; redistribution/resale prohibited even if modified | No-redistribution clause. Ask user before public inclusion; excluded until approval and browser distribution rights clarified. |
| Graveyard.zip | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| Haunted Henhouse Pack.zip | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| Haunted_School_Tiles.zip | Thurraya | Personal/noncommercial only; no raw redistribution | Noncommercial-only; excluded from commercial-target pipeline. |
| He6Y4PkfM0tj2vw4Kd_moody_pixel_occult_icons_SHADERLOOM.zip | ShaderLoom | Bundled commercial license; prohibits extractable/raw redistribution | Local preview only; publication not cleared |
| Horror SFX Free.zip | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| Indie_Game_Feel_Psychological_Vignette_Overlays.zip | Indie Game Feel (pack branding) | Bundled royalty-free personal/commercial license; no standalone redistribution | Local preview only; publication not cleared |
| LESED_Gravewire_Free.zip | LESED | Bundled commercial embedding license; no standalone sharing | Local preview only; publication not cleared |
| LESED_Lens_Screen_Damage_Free.zip | LESED | Bundled personal/commercial license; no standalone sharing | Local preview only; publication not cleared |
| Lenore-Sheet.png | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| Mind's Eye Loops v1.zip | Crow Shade / @CrowSilencer | Unverified: readme identifies author but contains no license grant | Local preview only; publication not cleared |
| Skulls[FreeSample].zip | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| UIBundleFree.zip | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| VoidSprite.zip.7z | Unknown: no author evidence in archive | Unverified: no bundled license found | 7z archive unsupported by ZIP pipeline; license unverified. No extraction attempted. |
| WeirdHorroAssets.zip | @pixelpata | Noncommercial only; attribution required; no AI artwork transformation | Noncommercial-only; excluded from commercial-target pipeline. |
| ZombieParts[FreeSample].zip | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| cemetery.zip | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| creepy_face_sourcecode.zip | isaac daniel cotera | Unverified: readme contains no license grant | Original ZIP excluded by the media pipeline. Step 3 includes a local static adaptation of its visual motifs; public distribution is not cleared. |
| cursed_church.zip | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| dark_street.zip | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| hollow-hours-free-sample-v1.0.zip | Jean Swiegers | Bundled commercial packaged-project license; AI-generated; no standalone redistribution | AI-generated. Ask user before public inclusion; excluded until approval. |
| horror-ui-sfx-lite.zip | Willosuna | Bundled royalty-free commercial license; no sound-pack redistribution or Content ID registration | Local preview only; publication not cleared |
| horror_attic_visual_novel_backgrounds.zip | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| horror_hallways_visual_novel_backgrounds.zip | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| living_room_visual_novel_backgrounds.zip | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| spritesheet.png | Unknown: no author evidence in archive | Unverified: no bundled license found | Local preview only; publication not cleared |
| vhs-ui-free-assets.zip | heyheythere | CC BY 4.0; attribution required | Local preview only; publication not cleared |

## Required credit carried forward

VHS UI Free by heyheythere — https://heyheythere.itch.io/vhs-ui-free — CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Prepared assets are converted from PNG to WebP; naming is normalized. Original license remains in the source archive.

If Weird Horror is later approved for an eligible project: “Original pixel art by @pixelpata (Instagram).” Modifications require the corresponding modified-artwork credit.

## Audit limitations

The eight photographic background archives contain no bundled author/license evidence. Horror SFX Free and Mind’s Eye also lack a bundled license grant. Obtain their download-page terms or purchase records before public distribution. ShaderLoom’s extractability restriction needs particular review for a browser game. Do not upload source archives or the generated folder to a public repository.

VoidSprite is a .7z archive and is excluded, not silently treated as ZIP. The creepy-face pack is HTML/JavaScript source, not a raster face image. No source-pack code was executed. This Step 0 inventory does not choose final scene or item art.

## Step 2 transformations

The horror panel and blank button are cropped from `UIBundleFree/FreeHorrorUi.png`
using `tools/hollow-asset-slices.json`, then converted losslessly to WebP. VHS panel
and focus images are used as UI borders. Gravewire is embedded from its original
TTF. Item icons and DieJars are displayed using the Step 0 conversions; pixel art
uses nearest-neighbour display. No excluded pack was added in Step 2.

## Step 3 effects and local adaptation

Psychological vignettes use the bundled Indie Game Feel subtle, asymmetric and panic
images. Injury reactions use LESED cracked-lens, damage-pulse and blood-splatter
frames. The short impact is converted from Horror SFX Free’s `Stinger.wav`; that
pack’s license grant remains unverified.

`js/scare-face.js` is a self-contained local canvas adaptation of the ringed-eye
and jagged-grin motifs in the supplied Creepy_Face widget, credited to Isaac Daniel
Cotera (2026), https://cotera.itch.io and https://github.com/cotera2024. The source
archive contains no license grant. The original widget and its external simplex-noise
CDN code are not executed or bundled. Public distribution of the adaptation remains
uncleared; obtain the applicable permission before publishing it. This is not an
assertion that the pack is freely licensed.

## User-supplied Task 4 delivery

`the_hollow_task4_production_assets.zip` and `the_hollow_task4_asset_manifest_and_specs.md` were supplied directly by the user as Gemini/Argon output. Prepared assets are identified by the `task4_` prefix and `the_hollow_task4` pack entry. PNGs are converted losslessly to WebP; WAVs are attenuated by 0.85 and encoded as Ogg Opus. Icon SVG drawing primitives are validated before inclusion in a generated local glyph catalogue. Original source files remain in the user's delivery ZIP. See `TASK4-INTEGRATION.md` and `task4-import-report.json` for provenance, measurements, and delivery tracking.

## User-supplied Tasks 1 and 2 deliveries

`the_hollow_task1_production_artwork.zip` and `the_hollow_task2_environments_2560x1440.zip` were supplied by the user as generated artwork. Runtime assets retain the delivered WebP bytes and use `task1_` / `task2_` prefixes. Supplier native-size and upscaling disclosures are preserved in the registry and `environment-import-report.json`; source hashes and mapping details are recorded there. Source archives remain in the user's Desktop folder. See `TASK1-2-INTEGRATION.md` for integration scope and reserved opening artwork.

## User-supplied Task 3 character delivery

`the_hollow_task3_full_cast_55files.zip` replaces the earlier six-file sample. It supplies 52 individual PNG assets, two comparison sheets and a Markdown specification. Runtime derivatives preserve alpha and aspect ratio and use the `task3_` prefix. `task3-import-report.json` records source hashes and original/runtime sizes. Original PNG masters remain in the user-supplied ZIP. Supplier attribution/license evidence is limited to the delivery itself. See `TASK3-INTEGRATION.md` for mappings and preparation.
