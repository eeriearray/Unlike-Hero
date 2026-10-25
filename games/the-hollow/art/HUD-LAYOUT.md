# Consolidated top HUD

The player is represented once by the avatar at the left, beside Vitality and Sanity. The party roster excludes the local player; other players remain visible as compact portraits beside the right-hand controls.

The current location title, actions left, numeric Haunting Clock progress and “How this works” are now in the center of the header. The previous heading over the painting and bottom help/status strip are no longer rendered. Help opens below the title, includes the expedition letter and full instructions, and pauses automatic solo turn advancement while open.

The narrow layout places the title and status on a second header row. Desktop and 390-pixel mobile layouts were checked, including opening help and navigating to the full instructions. The HUD regression test checks that the self portrait is not duplicated and that companions remain available. The complete Hollow suite passes (190 tests at verification).

Previews: `validation/hud-clean-desktop.png`, `validation/hud-clean-mobile.png`.
