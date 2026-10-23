# THE HOLLOW — Task 3 Character Cast Production Manifest & QA Report

## 1. Visual Style & Continuity Alignment (Task 1 Integration)

All 20 character designs (6 Playable Classes, 10 Enemies, and 4 Supporting NPCs) are painted in the approved **Task 1 Candidate C — Chiaroscuro Tenebrism** oil-painting direction:

* **Lighting Direction & Color Temperature**:

  * **Primary Key Light**: Focused lower-left **Purposeful Amber** (`#D9822B`) oil-lantern/candle key light, bridged by **Muted Raw Umber** (`#3B312B`) and **Tarnished Ochre** (`#7A6236`) midtones.

  * **Secondary Rim & Ambient Fill**: Upper-right **Midnight Slate** (`#1E2936`) cold nocturnal rim light over **Charcoal Abyss** (`#121417`) shadow recesses.

  * **Portrait Backgrounds**: Quiet, low-contrast dark charcoal-slate tonal vignette (`#121417` to `#1E2936`) with smooth brushwork blending so portraits sit naturally in UI frames without competing detail.

* **Task 1 Environment & Prop Cross-References**:

  * **Bellkeeper (`characters/enemies/bellkeeper/`)**: Directly matches the pitted wrought-iron yoke, sheared bolts, iron wheel shackle, and frayed twisted hemp rope from `environments/opening/belfry_interior.png`, `closeups/bell_frame_closeup.png`, and `closeups/hanging_rope_closeup.png`.

  * **Abbey Warden (`characters/enemies/abbey_warden/`)**: Features **three prominent forged wrought-iron chains** anchored to three explicit ring-shackle attachment points (one central iron neck-collar shackle ring and two riveted shoulder-plate shackle rings) with broken wall-anchor shackles at the ends to connect cleanly to the **Warden's Lair** environment.

  * **Merchant Pell (`characters/npcs/npc_merchant_pell.png`)**: Matches the weathered canvas, aged oak, tarnished brass balance scale, and amber lantern lighting of `environments/village/wagon.png`.

  * **Tower Caretaker (`characters/npcs/npc_tower_caretaker.png`)**: Matches the iron wrenches, brass oil can, and hanging iron keys from `environments/opening/caretaker_room.png` and `closeups/caretaker_note_blank.png` (flagged as conditional on the redesigned opening using a caretaker).

## 2. Technical Specifications, Baseline & Alpha Transparency

* **Head-and-Shoulders Portraits (20 files)**:

  * **Dimensions**: `1024×1280` (`4:5` aspect ratio), lossless `.png` (`RGB`).

  * **Framing**: Consistent eye-level head-and-shoulders framing across all playable characters, enemies, and supporting NPCs.

* **Full-Body Neutral Figures (16 files)**:

  * **Standard Vertical Canvas (14 figures)**: `1600×2400` (`2:3` aspect ratio), lossless `.png` (`RGBA` 32-bit with true alpha channel).

  * **Consistent Ground Baseline (`y = 2280 px`)**: All 14 vertical full-body figures have their lowest ground-contact point (boot soles, cloven hooves, iron cage base, shroud tips, or carved limestone plinth) aligned to **`y = 2280 px`** (`120 px` bottom margin below baseline; `80–180 px` top headroom for adult/large figures, and `520 px` top margin for the small crouched **Whisperling** to preserve its smaller scale relative to adult characters).

  * **Documented Wide Transparent Canvases (2 figures)**:

    * **Carrion Swarm (`carrion_swarm_fullbody.png`)**: `2400×1800` (`4:3` wide `RGBA` canvas), bounding box `(383, 120) → (2016, 1680)`, lowest feather aligned to `y = 1680 px`. Zero rectangular fog or smoke texture around the birds; individual crows are crisply cut out with true alpha transparency (`71.1%` transparent pixels).

    * **Hollow Hound (`hollow_hound_fullbody.png`)**: `2400×1800` (`4:3` wide `RGBA` canvas) to accommodate its horizontal four-legged stalking stance without cramping head-to-tail proportions. Bounding box `(127, 220) → (2272, 1680)`, all four paws aligned to the horizontal baseline at `y = 1680 px` (`65.8%` transparent pixels, including internal negative space between the hollow ribs).

* **Silhouette Previews (16 files)**:

  * **Dimensions**: `400×600` (`2:3`) for standard vertical figures and `600×450` (`4:3`) for wide figures (`Carrion Swarm` and `Hollow Hound`), rendered in Charcoal Abyss (`#121417`) against neutral Damp Plaster (`#8C8980`) for immediate thumbnail readability verification.

## 3. Complete Asset Manifest (52 Individual Production Files + 2 Comparison Sheets)

### A. Playable Characters (`characters/playable/<class>/` — 18 Files)

| \# | Class | Folder Path | Portrait (`1024×1280` RGB) | Full Body (`RGBA` Transparent) | Silhouette Preview | Full-Body BBox `(x1, y1, x2, y2)` & Baseline | Transparency (`alpha=0`) | Visual & Equipment Continuity Notes | 
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | 
| **P1** | **Occultist** | `characters/playable/occultist/` | `occultist_portrait.png` | `occultist_fullbody.png` (`1600×2400`) | `occultist_silhouette.png` (`400×600`) | `(389, 120, 1211, 2280)` • Base `y=2280` | `70.9%` | Gaunt late-40s scholar; frayed charcoal greatcoat, raw umber waistcoat, brass wheel-astrolabe throat clasp, text-free brass-clasped folio, belt plumb-bob & ink vial. | 
| **P2** | **Hunter** | `characters/playable/hunter/` | `hunter_portrait.png` | `hunter_fullbody.png` (`1600×2400`) | `hunter_silhouette.png` (`400×600`) | `(407, 120, 1192, 2280)` • Base `y=2280` | `70.7%` | Early-40s wilderness tracker; oiled-leather tricorn hat, stitched waxed-canvas shoulder cape, wooden powder horn, coiled snare rope, iron jaw-trap, slung period flintlock rifle. | 
| **P3** | **Apothecary** | `characters/playable/apothecary/` | `apothecary_portrait.png` | `apothecary_fullbody.png` (`1600×2400`) | `apothecary_silhouette.png` (`400×600`) | `(387, 120, 1212, 2280)` • Base `y=2280` | `70.8%` | Early-50s practical healer; round wire-rimmed brass spectacles, herb-stained linen shirt, knee-length leather apron, 3 chest vials, feverfew sprig, organized vial satchel & brass mortar. | 
| **P4** | **Medium** | `characters/playable/medium/` | `medium_portrait.png` | `medium_fullbody.png` (`1600×2400`) | `medium_silhouette.png` (`400×600`) | `(441, 120, 1159, 2280)` • Base `y=2280` | `72.6%` | Late-30s woman sensitive to the dead; bone hairpin, silver hair streak, frayed wool shawl, silver mourning locket & woven hair-work rings, handbell & rosemary; natural un-glowing eyes. | 
| **P5** | **Vagabond** | `characters/playable/vagabond/` | `vagabond_portrait.png` | `vagabond_fullbody.png` (`1600×2400`) | `vagabond_silhouette.png` (`400×600`) | `(322, 120, 1278, 2280)` • Base `y=2280` | `70.0%` | Late-20s resourceful traveler; rain-stained flat wool cap, linen-patched coat, brass pocket compass, bone-handled folding knife, canvas bedroll rucksack, iron-shod walking/pry stick. | 
| **P6** | **Exorcist** | `characters/playable/exorcist/` | `exorcist_portrait.png` | `exorcist_fullbody.png` (`1600×2400`) | `exorcist_silhouette.png` (`400×600`) | `(314, 120, 1286, 2280)` • Base `y=2280` | `68.3%` | Mid-50s rite practitioner; dark linen coif/veil, frayed black cassock, worn burgundy-ochre stole (text-free), pitted iron cross, belt holy-water flask & rite book, aspergillum & censer. | 

### B. Enemies (`characters/enemies/<enemy>/` — 30 Files)

| \# | Enemy | Folder Path | Portrait (`1024×1280` RGB) | Full Body (`RGBA` Transparent) | Silhouette Preview | Full-Body BBox `(x1, y1, x2, y2)` & Baseline | Transparency (`alpha=0`) | Visual, Structural & Environment Continuity Notes | 
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | 
| **E1** | **Bellkeeper** | `characters/enemies/bellkeeper/` | `bellkeeper_portrait.png` | `bellkeeper_fullbody.png` (`1600×2400`) | `bellkeeper_silhouette.png` (`400×600`) | `(199, 120, 1400, 2280)` • Base `y=2280` | `60.1%` | Matches Task 1 belfry iron yoke & wheel shackle; moss-stained sexton cassock stitched around an **empty** rusted iron frame (no body or smiling bell face); frayed rope limb. | 
| **E2** | **Abbey Warden** | `characters/enemies/abbey_warden/` | `abbey_warden_portrait.png` | `abbey_warden_fullbody.png` (`1600×2400`) | `abbey_warden_silhouette.png` (`400×600`) | `(178, 90, 1422, 2280)` • Base `y=2280` | `64.3%` | Massive penitent mitre-helm guardian bound by **3 prominent chains** with explicit ring-shackle attachment points (neck collar + left/right shoulder plates) for Warden's Lair. | 
| **E3** | **Whisperling** | `characters/enemies/whisperling/` | `whisperling_portrait.png` | `whisperling_fullbody.png` (`1600×2400`) | `whisperling_silhouette.png` (`400×600`) | `(280, 520, 1320, 2280)` • Base `y=2280` | `70.3%` | Small crouched presence (`1760 px` tall on canvas for true small scale); frayed burial shroud, peeling limewash plaster, concave mouthless hollow, hush gesture, root-like lower fray. | 
| **E4** | **Drowned Pilgrim** | `characters/enemies/drowned_pilgrim/` | `drowned_pilgrim_portrait.png` | `drowned_pilgrim_fullbody.png` (`1600×2400`) | `drowned_pilgrim_silhouette.png` (`400×600`) | `(277, 110, 1322, 2280)` • Base `y=2280` | `65.2%` | Waterlogged traveler in sodden wide-brimmed hat and clinging wool cape; pondweed, cracked pewter scallop badge, swollen reliquary pouch, snapped rosary, gourd-hook pilgrim staff. | 
| **E5** | **Hollow Stag** | `characters/enemies/hollow_stag/` | `hollow_stag_portrait.png` | `hollow_stag_fullbody.png` (`1600×2400`) | `hollow_stag_silhouette.png` (`400×600`) | `(181, 80, 1419, 2280)` • Base `y=2280` | `71.6%` | Anatomically credible cervine legs, head, and moss/briar-entangled antlers; intentional dry hollow neck and ribcage cavities with true alpha cutouts between ribs; hooves on baseline. | 
| **E6** | **Grave Warden** | `characters/enemies/grave_warden/` | `grave_warden_portrait.png` | `grave_warden_fullbody.png` (`1600×2400`) | `grave_warden_silhouette.png` (`400×600`) | `(263, 180, 1336, 2280)` • Base `y=2280` | `60.6%` | Clearly distinguished from Abbey Warden: stooped elderly gravedigger in oiled-wool hood with strapped headstone slabs & iron fence spikes across shoulders, crypt keys, spade & lantern. | 
| **E7** | **Mirror Twin** | `characters/enemies/mirror_twin/` | `mirror_twin_portrait.png` | `mirror_twin_fullbody.png` (`1600×2400`) | `mirror_twin_silhouette.png` (`400×600`) | `(325, 100, 1274, 2280)` • Base `y=2280` | `71.8%` | Formal 19th-century estate attire with one coherent reflection wrongness: vertical antique mercury-glass fracture seam splitting and inverting the reflected face/collar; holds mirror shard. | 
| **E8** | **Carrion Swarm** | `characters/enemies/carrion_swarm/` | `carrion_swarm_portrait.png` | `carrion_swarm_fullbody.png` (`2400×1800`) | `carrion_swarm_silhouette.png` (`600×450`) | `(383, 120, 2016, 1680)` • Base `y=1680` | `71.1%` | **Wide Canvas (`2400×1800` RGBA)**: dynamic crescent vortex of 11 distinct crows near focal center plus loose feathers; zero rectangular fog texture; crisp alpha silhouette. | 
| **E9** | **Hollow Hound** | `characters/enemies/hollow_hound/` | `hollow_hound_portrait.png` | `hollow_hound_fullbody.png` (`2400×1800`) | `hollow_hound_silhouette.png` (`600×450`) | `(127, 220, 2272, 1680)` • Base `y=1680` | `65.8%` | **Wide Canvas (`2400×1800` RGBA)**: gaunt brindle mastiff/sighthound in stalking stance; spiked iron kennel collar with snapped ring, hollow neck/ribcage cavities, natural dark eyes. | 
| **E10** | **Weeping Statue** | `characters/enemies/weeping_statue/` | `weeping_statue_portrait.png` | `weeping_statue_fullbody.png` (`1600×2400`) | `weeping_statue_silhouette.png` (`400×600`) | `(388, 120, 1212, 2280)` • Base `y=2280` | `66.9%` | Rough-hewn chipped limestone throughout (not gray skin); dark mineral tear streaks, moss in drapery recesses, stiffly wrenched neck posture, chipped stone rosary, octagonal plinth base. | 

### C. Supporting Characters (`characters/npcs/` — 4 Role-Based Portraits)

| \# | Role Filename | Folder Path | Dimensions & Format | Visual Role & Task 1 Continuity Notes | 
| ----- | ----- | ----- | ----- | ----- | 
| **N1** | `npc_merchant_pell.png` | `characters/npcs/` | `1024×1280` (`RGB` PNG) | Older traveling merchant matching `wagon.png`; worn felt bowler/trade hat, patched brown wool/canvas coat, brass scale weight & bone tally-key on lapel, practiced smile with calculating eyes. | 
| **N2** | `npc_tower_caretaker.png` | `characters/npcs/` | `1024×1280` (`RGB` PNG) | Conditional on redesigned opening using a caretaker; matches `caretaker_room.png`; grease-smudged working-class face, oil-stained canvas vest, iron wrench & brass oil can in strap, twin iron tower keys. | 
| **N3** | `npc_village_survivor.png` | `characters/npcs/` | `1024×1280` (`RGB` PNG) | Ordinary adult inhabitant/stranded traveler suitable for recurring rescued ally; expressive tired eyes with quiet dignity, knotted 19th-century linen forehead bandage under damp kerchief, russet-umber cloak. | 
| **N4** | `npc_abbey_spirit.png` | `characters/npcs/` | `1024×1280` (`RGB` PNG) | Older tonsured monastic spirit associated with the abbey; emotionally readable sorrowful face, archaic frayed cowl, and understated painterly translucency where the dark ground bleeds through robe edges. | 

### D. Summary & Comparison Sheets (`characters/` — 2 Overview Files)

| \# | Filename | Path | Dimensions & Format | Purpose | 
| ----- | ----- | ----- | ----- | ----- | 
| **C1** | `cast_contact_sheet.png` | `characters/cast_contact_sheet.png` | `3600×2480` (`RGB` PNG) | Side-by-side contact sheet of all 6 Playable Characters, 10 Enemies, and 4 Supporting NPCs showing portrait-to-fullbody identity matching and baseline alignment ticks. | 
| **C2** | `silhouette_comparison_sheet.png` | `characters/silhouette_comparison_sheet.png` | `3400×1900` (`RGB` PNG) | Full-cast silhouette lineup on shared ground baselines plus a 16-character small thumbnail strip verifying instant silhouette distinction at small sizes. | 

## 4. Consistency & QA Audit Log

1. **Hands & Anatomy Verification**: All human hands across portraits and full-body figures were inspected for 5-finger anatomy and natural grip mechanics on props (folios, rifle stocks, satchels, handbells, pry-sticks, aspergillums, spades, and mirror shards).

2. **Identity & Clothing Construction Match**: Each full-body figure was generated directly from its approved portrait reference to preserve exact facial structure, headgear, collar geometry, straps, and personal tokens.

3. **Iterative QA Refinements Applied During Production**:

   * **Vagabond (`vagabond_portrait.png`)**: Initial pass shared facial similarities with the Occultist; refined prior to full-body generation to give the Vagabond a broader square jaw, crooked nose bridge, ruddy wind-burned cheeks, and lighter sandy-brown hair.

   * **Village Survivor (`npc_village_survivor.png`)**: Initial pass had a small forehead strip that read too close to a modern adhesive bandage; refined to a period-authentic knotted 19th-century linen cloth bandage tucked under her kerchief.

   * **Abbey Spirit (`npc_abbey_spirit.png`)**: Initial pass reused facial structure from the reference anchor; refined to a distinct older clean-shaven monastic brother with a traditional tonsure, sunken cheeks, and aquiline nose.

   * **Mirror Twin (`mirror_twin_fullbody.png`)**: Initial full-body pass had the top tip of the vertical mirror fracture touching the upper canvas edge; regenerated with generous top headroom so the entire `1600×2400` figure sits cleanly with `100 px` top padding and `120 px` bottom padding (`baseline y = 2280`).

4. **Alpha Channel & Edge Decontamination**: Every `*_fullbody.png` asset was extracted with connected-component interior hole detection (preserving true alpha transparency between the Bellkeeper's iron cage bars, inside the Hollow Stag and Hollow Hound rib cavities, and between the Carrion Swarm's individual birds) and color-decontaminated along semi-transparent boundary pixels so zero white fringe or checkerboard artifacts appear against dark in-game environments.