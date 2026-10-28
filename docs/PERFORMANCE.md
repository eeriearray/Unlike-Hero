# Game rendering budgets

The eleven games other than ChronoLink opt into `shared/sdk/performance.js`.
ChronoLink is intentionally excluded so its ongoing development stays independent.
The helper does not replace browser APIs or change physics, room networking, or
gameplay timers.

Automatic defaults use available CPU, memory, pointer and data-saving signals:

| Profile | Maximum drawing-buffer pixels | Maximum DPR | Decorative FPS |
| --- | ---: | ---: | ---: |
| Low | 1,000,000 | 1 | 30 |
| Balanced | 1,800,000 | 1.5 | 45 |
| High | 3,000,000 | 2 | 60 |

Canvas dimensions determine the actual pixel ratio. Small drawing canvases retain
sharpness; large and Retina displays avoid unnecessarily large framebuffers.
Weaker devices get lighter default graphics in the 3D games. Existing saved quality
choices remain in use, subject to the rendering budget. Racing, golf, sailing,
Short Fuse and Casino can reduce rendering resolution further under sustained load.

Hidden-tab painting and unnecessary DOM updates are skipped. Decorative scenes,
dust and replay rendering use bounded frame rates. Voice recording, live simulation,
network traffic and elapsed-time replay progression retain their existing timing.

## Verification

- Budget tests cover hardware profiles, large displays, small canvases, hidden-tab
  resume and sustained-load resolution reduction.
- All eleven game menus were smoke-tested in the local browser without console
  errors; racing was also started. Narrow mobile layouts were checked for overflow.
- The initial full non-ChronoLink run passed 682 of 684 tests. The Hollow's dust
  test exposed an unnecessary browser-API assumption, which was corrected and
  passed on rerun. Golf's bot timing test exceeded its threshold under concurrent
  suite load and passed when rerun alone; no bot or physics code was changed.

These are rendering safeguards and regression checks, not FPS measurements on
physical low-end devices. Large screens may render more softly to reduce GPU load.
