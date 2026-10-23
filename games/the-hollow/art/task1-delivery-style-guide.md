# THE HOLLOW — Task 1 Production Artwork Manifest & Style Guide

## 1. Approved Visual Style Guide (Candidate C — Chiaroscuro Tenebrism)

### Core Aesthetic & Direction
- **Approved Anchor**: Style Candidate C (`style/candidate_c_silent_square_approved.png`, which also serves as the master for `environments/village/square.png`).
- **Lighting Philosophy**: High-contrast chiaroscuro tenebrism. Scenes are anchored in deep charcoal shadows (`#121417`) and cool midnight slate ambient fill (`#1E2936`), punctuated by small, purposeful amber light sources (`#D9822B`) such as oil lanterns, shaded desk lamps, and dying altar candles. Warm burnt-umber midtones (`#3B312B`) bridge the transition between focal highlights and shadow recesses.
- **Brushwork & Surface Treatment**: Smooth, controlled tonal blending within shadow masses so architectural silhouettes remain readable without murky fog, paired with tactile, directional oil bristle strokes on illuminated focal surfaces (chipped limestone edges, split oak grain, pitted iron hardware, and flaking damp plaster).
- **Camera & UI Framing Rules**:
  - **Camera Height**: Human eye level across all 17 environment illustrations; investigative angled/orthographic framing across all 6 close-ups.
  - **Upper-Left Location Text Safe Zone**: Kept low-contrast and uncluttered (dark sky, shadowed vaulting, or plain wall plaster) across all 17 environments.
  - **Lower 20–25% Action Control Safe Zone**: Kept clear of essential narrative landmarks (open cobblestones, worn floorboards, shallow water, or dirt paths) so bottom HUD controls never obscure critical props.
  - **Central Landmark Placement**: All primary investigative objects and exits occupy the central 50–60% of the frame to survive narrower aspect crops.

### Approved Color Palette & Material Specifications

| Swatch / Material | Hex Code | Role & Material Treatment |
| :--- | :--- | :--- |
| **Midnight Slate** | `#1E2936` | Nocturnal sky, distant silhouettes, cold moonlight window shafts, and upper-left UI safe zones |
| **Charcoal Abyss** | `#121417` | Deep shadow recesses, well interior, empty belfry arch, and lower foreground framing |
| **Desaturated Moss** | `#3D4A3A` | Damp lichen on north-facing limestone, floodwater staining on `belltower.png`, and churchyard growth |
| **Muted Raw Umber** | `#3B312B` | Aged oak beams, water-warped floorboards, mud tracks, and warm shadow transition zones |
| **Tarnished Ochre** | `#7A6236` | Oxidized brass lamps, aged rag parchment midtones, and reflected bounce light |
| **Purposeful Amber** | `#D9822B` | Focused oil lantern flames, candle stubs, and warm rim highlights on key interactive objects |
| **Weathered Stone** | Surface Spec | Chipped grey fieldstone and limestone with recessed dark mortar, damp basal sheen, and moss creep |
| **Aged Timber** | Surface Spec | Split-grain dark oak and pine with silvered weathering, rot at ground contact, and iron nail heads |
| **Tarnished Iron** | Surface Spec | Matte charcoal-black wrought iron with pitted surfaces and subtle dark-brown oxidation |
| **Damp Plaster** | Surface Spec | Peeling bone-grey limewash (`#8C8980`) exposing raw brown lath and stone masonry beneath |
| **Worn Paper** | Surface Spec | Water-stained rag parchment kept 100% free of generated text for clean in-engine typography |

## 2. Complete Asset Manifest (27 Exported Masters + 27 WebP Copies)

Every file listed below has been exported in both lossless/master `.png` and `.webp` formats inside its designated folder (`style/`, `environments/village/`, `environments/estate/`, `environments/opening/`, and `closeups/`).

| # | Folder & Filename (`.png` & `.webp`) | Exported Dimensions | Native Gen Size | Subject & Required Landmarks | Intended Game Location |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **S1** | `style/candidate_a_silent_square.png` | 2560×1440 (16:9) | 1376×768 | Style Candidate A: Cold moonlight contrast & structured glazing | Style Exploration Archive |
| **S2** | `style/candidate_b_silent_square.png` | 2560×1440 (16:9) | 1376×768 | Style Candidate B: Damp overcast dusk & tactile impasto (empty belfry) | Style Exploration Archive |
| **S3** | `style/candidate_c_silent_square_approved.png` | 2560×1440 (16:9) | 1376×768 | Style Candidate C (Approved Master): Chiaroscuro tenebrism & warm umber | Master Style Reference |
| **S4** | `style/palette_and_materials_reference.png` | 2560×1440 (16:9) | 1376×768 | 5 painted material studies (stone, timber, iron, plaster, paper) + 6 color swatches | Art Direction Reference |
| **01** | `environments/village/square.png` | 2560×1440 (16:9) | 1376×768 | The Silent Square: central stone well, left blank notice board, right lantern camp, exit paths, leaning bell tower with empty belfry | Thornwick Village — Central Hub |
| **02** | `environments/village/chapel.png` | 2560×1440 (16:9) | 1376×768 | Abandoned Chapel: small parish chapel interior, cracked stone altar, simple oak pews, dying candles, broken lancet stained glass | Thornwick Village — Parish Chapel |
| **03** | `environments/village/nursery.png` | 2560×1440 (16:9) | 1376×768 | Bloodstained Nursery: carved wooden cradle, subtly stained linen bedding, plain wooden blocks, porcelain cup, child's shoes on rug | Thornwick Village — Abandoned Dwelling |
| **04** | `environments/village/wagon.png` | 2560×1440 (16:9) | 1376×768 | Merchant's Wagon: weathered road wagon with fold-down counter, hanging amber lamps, drawers, unlabeled bottles, bundles, and scales (no character) | Thornwick Village — Outskirts Road |
| **05** | `environments/village/belltower.png` | 2560×1440 (16:9) | 1376×768 | Drowned Bell Tower: leaning stone tower in shallow dark water, stone causeway to arched door, waterline moss, iron ties, empty belfry (no bell) | Thornwick Village — Flooded Lowlands |
| **06** | `environments/village/graveyard.png` | 2560×1440 (16:9) | 1376×768 | Graveyard: leaning weathered headstones (text-free), wrought-iron fencing, flagstone walking path, freshly disturbed grave soil, spade, lantern | Thornwick Village — Churchyard |
| **07** | `environments/village/bridge.png` | 2560×1440 (16:9) | 1376×768 | Collapsing Bridge: stone-and-timber ravine crossing with coherently collapsed middle span, near post lantern, and estate gatehouse across gap | Thornwick — Ravine Crossing to Estate |
| **08** | `environments/village/gate.png` | 2560×1440 (16:9) | 1376×768 | The Escape Gate: chained wrought-iron boundary gates between stone pillars, amber lantern, and dirt road disappearing into hills beyond | Thornwick Village — Boundary Exit |
| **09** | `environments/estate/foyer.png` | 2560×1440 (16:9) | 1376×768 | Estate Foyer: decaying manor hall with broad dark oak staircase, worn checkered floor, draped trunks, amber lamp, and readable arched doorways | Thornwick Estate — Main Entrance Hall |
| **10** | `environments/estate/library.png` | 2560×1440 (16:9) | 1376×768 | Forgotten Library: tall oak shelves, rolling ladders, central reading desk with blank open folio, magnifying glass, shaded lamp, lancet window | Thornwick Estate — West Wing Library |
| **11** | `environments/estate/mirror.png` | 2560×1440 (16:9) | 1376×768 | Haunted Mirror: parlor centered on tall antique gilt mirror; real room has sheet-covered chair & closed door, reflection shows uncovered chair & ajar door | Thornwick Estate — Upper Parlor |
| **12** | `environments/estate/observatory.png` | 2560×1440 (16:9) | 1376×768 | Abandoned Observatory: brass refracting telescope on tripod under damaged timber dome, text-free geometric star charts, armillary spheres, gearwork | Thornwick Estate — Observatory Dome |
| **13** | `environments/estate/treasury.png` | 2560×1440 (16:9) | 1376×768 | Trapped Treasury: stone vault with iron-bound coffers and silver vessels, featuring a recessed octagonal pressure plate wired to pillar dart slots | Thornwick Estate — Sub-Vault |
| **14** | `environments/estate/corridor.png` | 2560×1440 (16:9) | 1376×768 | Shifting Corridor: level oak-paneled corridor lit by wall sconce, ending in a tilted stone archway with sideways doors and inverted stairs | Thornwick Estate — East Wing Hallway |
| **15** | `environments/estate/blackmarket.png` | 2560×1440 (16:9) | 1376×768 | The Black Market: subterranean vaulted room with makeshift stalls, apothecary drawers, shaded lamps, specimen jars, relic boxes, and scales (no characters) | Thornwick Estate — Concealed Undercroft |
| **16** | `environments/opening/belfry_interior.png` | 2560×1440 (16:9) | 1376×768 | Inside the Drowned Bell Tower: timber frame, empty iron yoke and broken shackles (no bell), hanging frayed rope, rotten wooden ladder, water traces | Drowned Bell Tower — Upper Belfry |
| **17** | `environments/opening/caretaker_room.png` | 2560×1440 (16:9) | 1376×768 | Caretaker's Room: cramped tower room with wooden desk, brass oil lamp, blank papers, wrenches/oil can, hanging iron keys, and narrow cot | Drowned Bell Tower — Caretaker Quarters |
| **18** | `closeups/notice_board_closeup.png` | 1600×1200 (4:3) | 1152×896 | Notice Board Close-Up: weathered oak board from `square.png` with blank water-stained parchment notices pinned by iron tacks | Opening Investigation — Square Notice Board |
| **19** | `closeups/well_closeup.png` | 1600×1200 (4:3) | 1152×896 | Well Close-Up: mossy limestone rim and rusted inner brackets of the central well from `square.png` dropping into pitch darkness | Opening Investigation — Square Well |
| **20** | `closeups/bell_frame_closeup.png` | 1600×1200 (4:3) | 1152×896 | Bell Frame Close-Up: empty tarnished iron yoke, sheared bolts, and tool gouges on the oak crossbeam from `belfry_interior.png` | Opening Investigation — Belfry Yoke |
| **21** | `closeups/hanging_rope_closeup.png` | 1600×1200 (4:3) | 1152×896 | Hanging Rope Close-Up: frayed twisted hemp rope tied to the iron wheel shackle and draped over the beam from `belfry_interior.png` | Opening Investigation — Belfry Rope |
| **22** | `closeups/caretaker_note_blank.png` | 1600×1200 (4:3) | 1152×896 | Caretaker's Blank Note: blank weathered parchment sheet on the desk from `caretaker_room.png` beside the oil lamp, inkwell, wrench, and key | Opening Investigation — Caretaker Desk |
| **23** | `closeups/tower_entrance_closeup.png` | 1600×1200 (4:3) | 1152×896 | Tower Entrance Close-Up: arched damp oak door from `belltower.png` with heavy tarnished iron lockbox, bolt latch, padlock, keyhole, and ring handle | Opening Investigation — Tower Door |

## 3. Resolution, Upscaling & Compositional QA Notes

1. **Resolution & Upscaling Disclosure**:
   - The underlying image generation model renders 16:9 assets natively at **1376×768** (`1.7917:1`) and 4:3 close-ups natively at **1152×896** (`1.2857:1`).
   - To meet the exact production target of **2560×1440** (`16:9`) for environments and **1600×1200** (`4:3`) for close-ups without any aspect distortion or letterboxing, each image was center-cropped by `<0.8%` (for 16:9) or `<3.6%` (for 4:3) and resampled using **Lanczos interpolation** with a subtle unsharp mask (`radius=1.1, percent=55, threshold=3`), then exported as both `.png` masters and `.webp` copies (`quality=90`).
2. **Iterative QA Fixes Applied**:
   - **Candidate B (`style/candidate_b_silent_square.png`)**: Initial pass included a small bell silhouette inside the distant belfry arch; edited prior to presentation so the belfry is completely empty.
   - **Bloodstained Nursery (`environments/village/nursery.png`)**: Initial pass had faint alphabet letters on the wooden toy blocks near the lower-center foreground; refined to make the wooden blocks completely plain and grouped on a rug beside the cradle above the lower 25% UI zone.
   - **Graveyard (`environments/village/graveyard.png`)**: Initial pass had faint illegible scribble marks on the foreground headstones; refined so all headstones feature only natural stone cracks, moss, and carved borders with zero text.
   - **Belfry Interior (`environments/opening/belfry_interior.png`) & Bell Frame Close-Up (`closeups/bell_frame_closeup.png`)**: Initial passes included a sheared bolt suspended in mid-air below the empty iron yoke; both were edited to remove the floating bolt so all hardware is physically grounded.
3. **Minor Compositional Notes**:
   - **`environments/estate/library.png` (Forgotten Library)**: A secondary decorative stack of books rests in the bottom-right foreground corner (within the lower 20% UI zone), while all primary investigative landmarks (the central reading desk, open blank folio, magnifying glass, lamp, and rolling ladders) sit squarely in the central safe zone.
   - **`environments/estate/blackmarket.png` & `environments/estate/treasury.png`**: Edge framing barrels sit at the far lower-right border as vignette framing; central stalls, relic cases, and the octagonal floor trap mechanism remain completely clear of the lower 25% action bar area.
