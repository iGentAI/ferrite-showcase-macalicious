# Feature inventory: Home

**On the Ferrite desktop again**, by the owner's order: real macOS has it. It left `not-deployed.json`, and the server's catalogue lists it, preinstalled. The first read of this inventory (main `e62c2ac9`) called it a non-app; that no longer holds.

Proven by `e2e/home-network-batch13-journey.mjs` and `e2e/rows-batch17-journey.mjs` (rows 38, 53, 58, 63 and 64, steps named `home.<n>`) against `ferrite dev` in Chromium, with a real browser and the real server. Each `home.<n>` step of a journey is the row of that number here. `e2e/home-network-batch13-journey.mjs` also passes in Firefox and WebKit. Other notes say when a row was only read in the code or held by a unit test.

Status: **missing**, **partial** (the note says what is absent), or **built-unchecked** (built, with no check on a real Mac). The real app's list comes from knowledge of macOS 10.15 Home, not from a Mac. "Call" marks a decision made here.

Calls:
- No real accessories exist here: a page has no HomeKit. A new home is empty, Add Accessory says none was found, and what is added is a simulated record. The window goes on saying so.
- Automation runs only while the Home window is open, on simulated accessories: there is no hub to run it otherwise. Location triggers are left out.
- Sharing a home with another account is dimmed with a reason.

## Menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 1 | Home > About Home | built-unchecked | Shell |
| 2 | Home > Preferences… | built-unchecked | Dimmed, saying Home has no preferences: Home on a Mac keeps its settings in Home Settings, as here (from knowledge of macOS, not checked on a Mac). `rows-batch25-journey` |
| 3 | Home > Services | built-unchecked | "No Services Apply": the shell's Services lists a service for text selected, and Home's window has none to select outside a sheet, which holds the menu bar back. `rows-batch25-journey` read "No Services Apply" |
| 4 | Home > Hide Home | built-unchecked | Shell |
| 5 | Home > Hide Others | built-unchecked | Shell |
| 6 | Home > Show All | built-unchecked | Shell |
| 7 | Home > Quit Home | built-unchecked | Shell |
| 8 | File > Close Window ⌘W | built-unchecked | Shell |
| 9 | File > New Home | built-unchecked | Journey: adds it and shows it, read back |
| 10 | File > New Room | built-unchecked | Journey: read back |
| 11 | File > Add Accessory… | built-unchecked | Journey: says Home found none, adds a simulated one |
| 12 | File > Add Scene… | built-unchecked | Journey; dimmed with its reason when no room has a light |
| 13 | Edit > Undo | built-unchecked | Shared `EditRows`, on a sheet's text field; not driven in Home |
| 14 | Edit > Redo | built-unchecked | As row 13 |
| 15 | Edit > Cut | built-unchecked | As row 13 |
| 16 | Edit > Copy | built-unchecked | As row 13 |
| 17 | Edit > Paste | built-unchecked | As row 13 |
| 18 | Edit > Select All | built-unchecked | As row 13 |
| 19 | Edit > Home Settings… | built-unchecked | Journey |
| 20 | View > Home | built-unchecked | Journey |
| 21 | View > Rooms | built-unchecked | Journey |
| 22 | View > Automation | built-unchecked | Journey |
| 23 | View > Enter Full Screen | built-unchecked | Shell |
| 24 | Window > Minimize | built-unchecked | Shell |
| 25 | Window > Zoom | built-unchecked | Shell |
| 26 | Window > Bring All to Front | built-unchecked | Shell |
| 27 | Window > window list | built-unchecked | Shell |
| 28 | Help > Home Help | built-unchecked | Journey: opens Home's guide in Help Viewer |

Menus: 28 rows; 26 built-unchecked, 1 partial, 1 missing.

## Views, sidebar, toolbar

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 29 | Home tab: tiles | built-unchecked | Empty home: heading, offer and button inside the window, seen in a screenshot |
| 30 | Status summary, and N More | built-unchecked | Journey: the status line follows a switch |
| 31 | Favorite Scenes, run a scene | built-unchecked | Journey |
| 32 | Favorite Accessories, switch on and off | built-unchecked | Journey |
| 33 | Rooms tab and sidebar | built-unchecked | Journey |
| 34 | Automation tab | built-unchecked | Journey: the list, Last ran, Edit |
| 35 | Homes pull-down: choose a home | built-unchecked | Journey opens it for Home Settings; choosing is a unit test |
| 36 | Home Settings… | built-unchecked | Journey: name, wallpaper |
| 37 | Room Settings… | built-unchecked | Journey: rename, and Remove moves what was in the room to the first room left |
| 38 | Accessory detail: brightness, colour, position | built-unchecked | Journey: a light's colour, read back and tinting its tile while on; blinds' position, read back and said on the tile. In the settings sheet, from a secondary click, not a long press: a colour well, not Home's wheel |
| 39 | Accessory settings: rename, room, favourite, remove | built-unchecked | Journey: rename, favourite, brightness |
| 40 | Add Accessory sheet | built-unchecked | Journey: name, room, kind |
| 41 | Add Scene sheet | built-unchecked | A room's lights, on or off, or No Room; and each accessory that switches, left, on or off. A scene with one outlet and no room was read back from the server: `rows-batch25-journey` |
| 42 | Edit and delete a scene | built-unchecked | Journey |
| 43 | Automation builder: time, accessory | built-unchecked | Journey: both ran. While the window is open only |
| 44 | Add Room, Add Home | built-unchecked | Journey, and Remove Home |
| 45 | Wallpaper choice | built-unchecked | Journey: saved and drawn. Drawn stand-ins, not Apple's pictures |
| 46 | People and invitations | built-unchecked | Call: dimmed, with the reason shown. Journey |
| 47 | "Accessories Are Simulated" | built-unchecked | Journey: the window's own words |

Views: 19 rows; 18 built-unchecked, 1 partial.

## Context menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 48 | Accessory tile menu | built-unchecked | Journey |
| 49 | Room row menu | built-unchecked | Journey |
| 50 | Scene tile menu | built-unchecked | Journey |

Context menus: 3 rows; 3 built-unchecked.

## Keyboard shortcuts

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 51 | Arrow keys between tiles | built-unchecked | Journey |
| 52 | Return or Space switches a tile | built-unchecked | Journey drives Space; Return is the same native button |
| 53 | ⌘1 to ⌘3 change tab | built-unchecked | Journey. A run once reported ⌘1 not switching after the time automation; it did not recur in 3 passes pressed just after a time automation ran, nor in the two later batch 13 runs, and that run's own diagnostic line shows the Home tab selected. No cause found, and no change made for it |
| 54 | Delete removes the selected tile | built-unchecked | Journey: asks, then removes it from scenes too |

Keys: 4 rows; 4 built-unchecked.

## Drag and drop

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 55 | Reorder tiles | built-unchecked | Journey, read back |
| 56 | Drag an accessory to another room | built-unchecked | Journey, read back |
| 57 | Reorder rooms | built-unchecked | Journey, read back |

Drag: 3 rows; 3 built-unchecked.

## Multi-selection

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 58 | Several accessories: switch, move, remove | built-unchecked | Journey: Command-click and Shift-click choose tiles (Shift-click by a unit test) and switch none; the tile menu turns them on or off and moves them; a drag to a room takes them all; Delete asks once. A plain click ends the selection and switches its tile. Decided here as the row asks, from knowledge of macOS, not a Mac |

Multi-selection: 1 row; 1 built-unchecked.

## Saved state

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 59 | Homes, rooms, accessories, scenes on the server | built-unchecked | Journey: nothing until a change, then each change read back |
| 60 | Last home and tab | built-unchecked | Journey: back after a reload |
| 61 | Per person | built-unchecked | Journey: a second account in its own browser context has its own empty home |

Saved state: 3 rows; 3 built-unchecked.

## Cross-app

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 62 | Got from the App Store | built-unchecked | Preinstalled in the catalogue, as in macOS; journey reads the catalogue |
| 63 | Siri runs a scene | built-unchecked | Journey: “set the Evening scene” with Home's window open, which then shows it, and the scene's name alone with the window closed, on the stored document. Typed: the same requests arrive this way when spoken. Scenes only: Siri does not switch one accessory by name |
| 64 | Spotlight finds a scene | built-unchecked | Journey: listed under Home Scenes by its name or its home's; Return opens Home with its tile having the keyboard, and does not run it. A Spotlight source on the server |
| 65 | Notification Center: automation ran | built-unchecked | Journey: the inbox holds it, and the banner shows in a screenshot |
| 66 | Dock menu | built-unchecked | Journey: runs a scene |

Cross-app: 5 rows; 5 built-unchecked.

## Build items, most-used first

1. **Scenes that start from several rooms.** Row 41.

## Counts (by hand)

66 rows: 63 built-unchecked, 2 partial, 1 missing. None done.
