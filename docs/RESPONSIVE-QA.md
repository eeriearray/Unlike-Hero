# Phone and tablet layout checks

Run the canonical hub on port 8081 (`npm run play`). With Playwright available in
Node's module path, run:

```sh
node tools/verify-responsive.cjs
BROWSER=webkit node tools/verify-responsive.cjs
LIVE_RENDER=1 GAMES=mafia,dragon-clash,riftbreak,short-fuse,the-hollow node tools/verify-responsive.cjs
```

`GAMES` optionally limits the comma-separated game IDs. Chrome is used by default;
WebKit must be installed through Playwright for the Safari-engine pass. No server
restart is required for these client changes.

The audit covers 320×568 and 390×844 phones, 844×320 landscape phones (also a proxy
for reduced height from browser chrome/keyboard), and 768×1024 and 1024×680 tablets.
It opens every registered game's menu, representative lobby/game/dialog screens,
all 13 RECESS mini-games (including a second client for NPAT), every Party Pack
mode, the Party Pack phone join screen, both Short Fuse roles, and the hub iframe.
Assertions catch controls outside the viewport, clipping by non-scrollable parents,
runtime errors, and hub toolbars covering or shrinking game frames. Card and
character rails are allowed to scroll horizontally.

Screenshots and JSON results go to the ignored `output/responsive/`,
`output/responsive-webkit/`, or `output/responsive-live/` directories. Review the
screenshots as well: geometry assertions cannot identify every visual overlap.
By default, continuous canvas animation is frozen after startup to make layout
checks practical with software WebGL. Use `LIVE_RENDER=1` for moving scenes.

These checks emulate browser viewport sizes. They supplement real-device testing;
they do not certify every physical phone, keyboard, browser version, or game phase.
