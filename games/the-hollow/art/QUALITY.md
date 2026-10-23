# Step 7 quality and accessibility review

This review covers the current browser game and the local [accessibility-review skill](/Users/akshat/.codex/plugins/cache/claude-cowork/design/1.2.0/skills/accessibility-review/SKILL.md). It is an implementation audit, not a claim of WCAG certification or a measured 60 fps result on every device.

## Changes and findings

| Area | Before | Now | Relevant WCAG 2.1 AA check |
| --- | --- | --- | --- |
| Keyboard focus | The phone tab controls had no tablist behavior or reliable focus after a render; the ending had no modal semantics. | Map, Act, You and Journal have a stable order, selected tab, panel relationship and arrow/Home/End keys. Dialogs contain Tab focus, restore focus after closing, and hide background controls. The ending has a focused title and dialog semantics. | 2.1.1 Keyboard; 2.4.3 Focus Order; 2.4.7 Focus Visible; 4.1.2 Name, Role, Value |
| Text size | A binary larger-text switch changed only a small subset of text. | Settings offers 100/115/130/150% with persistent root and body scaling. At a 375 px browser viewport, 150% settings width remained 375 px with no page overflow; sliders were widened for their labels. | 1.4.4 Resize Text; 1.4.10 Reflow |
| Contrast and states | Narrow tab labels were dim and the focused photo marker was hard to see. | Phone tab text, selected state and photo marker focus have stronger contrast. Map roads and status chips retain labels, symbols or patterns in addition to colors. | 1.4.1 Use of Color; 1.4.3 Contrast (Minimum); 1.4.11 Non-text Contrast |
| Motion and power | Dust rendered a fresh path for every mote on every frame, including hidden/reduced states; all regional scenes could remain cached. | One offscreen mote sprite is reused; dust stops its animation frame loop when hidden or reduced. Mobile hides the depth blur copy. At most two discovered, legal neighbors are prefetched after the current scene. The image registry evicts older decoded backgrounds and protects the active one. | 2.3.3 Animation from Interactions (AAA guidance); 2.2.2 Pause, Stop, Hide |
| Captions and controls | Audio and effects controls existed but needed review with the new layout. | Sound captions, four volume channels, mute, reduced motion, reduced scares and high contrast remain available in Settings. The audio live region and text labels remain in the DOM. | 1.2.2 Captions (where applicable); 1.4.2 Audio Control |

## Contrast samples

These are computed sRGB ratios for opaque foreground/background pairs used in the updated interface. Transparent image overlays require visual inspection at each scene.

| Pair | Ratio | Target |
| --- | ---: | ---: |
| Phone tab text `#c8c4b9` on `#0a0c12` | 11.22:1 | 4.5:1 |
| Selected tab `#ffe0a0` on `#262a31` | 11.26:1 | 4.5:1 |
| Ending body `#e2daca` on `#0a1119` | 13.65:1 | 4.5:1 |
| Map focus border `#2d6558` on parchment `#c8b381` | 3.28:1 | 3:1 |
| Settings heading `#e3c680` on `#171d2e` | 10.11:1 | 4.5:1 |

## Verification

- `node --test test/the-hollow-*.test.mjs`: 104 passing, 0 failing. This includes all 42 place backgrounds and their exact authoritative hotspot/option coverage, engine state and socket reconnect tests, scene cache bounds, legal-neighbor preloading, font-size validation and reduced-motion frame cancellation.
- Browser keyboard inspection: Settings Tab wraps to its first control; Done returns focus to Menu; ArrowLeft from Act selects Map and leaves focus on Map; map buttons and stage hotspots have names in the accessibility tree. The mobile nav order is Map / Act / You / Journal.
- At a 375 px browser viewport, the game and 150% Settings each had a 375 px document scroll width. Four phone tabs rendered around 94 px wide and 60 px high each.
- Verified color contrast for the five pairs above by relative-luminance calculation. The photo backdrop remains behind the labeled controls while loading and if optional media fails.

## Limits and follow-up checks

- A physical mid-range laptop and phone frame-rate measurement is still needed to establish the 60 fps target. The bounded frame work and image cache reduce load but cannot guarantee a particular device result.
- VoiceOver, TalkBack and browser zoom at 200% were not exercised in this pass; perform those checks before an accessibility conformance claim.
- Image-background contrast varies by artwork. The controls use dark backplates and focus outlines, but a manual review of every phase and high-contrast mode is appropriate before release.

## Run locally

From the repository root:

```sh
npm start
node --test test/the-hollow-*.test.mjs
```

Open `http://localhost:8080/games/the-hollow/`, then use Menu → Sound & accessibility to change text size, motion, captions and volume.
