# Feature inventory: Mission Control

Main commit read: `e62c2ac9` (29 October 2026), from GitHub only. Nothing was run.

Sources read: `demos/desktop/desktop.tsx`, `desktop-overlays.tsx`, `desktop-menus.tsx`, `desktop.mdx`; `src/components/mission-control/mission-control.tsx` (first half), `src/components/app-switcher/app-switcher.tsx` (first half); the desktop README's preference note. The real app's list comes from knowledge of macOS 10.15. Catalina removed Dashboard, so it has no row. The Mission Control pane in System Preferences was not read; its rows rest on the README's statement that other settings are kept and change nothing.

Status key: **missing**, **partial** (the note says what is absent), **built-unchecked** (in main's code, not seen running for this inventory). Nothing is done until it is checked in a browser with a screenshot.

**Counts: 43 rows: 41 done, 2 partial.**

Mission Control is on the desktop: `demos/desktop/desktop-overview.tsx` feeds the library's `MissionControl` and `AppSwitcher` with the live windows, `desktop-spaces.ts` holds the Spaces and `desktop-split-view.tsx` Split View. `e2e/mission-control-journey.mjs` and `e2e/spaces-journey.mjs` drive what is marked done.

## Opening and closing (6: 5 done, 1 partial)

| Item | Status | Main |
| --- | --- | --- |
| Library component `MissionControl` | done | The served desktop's overview is built on it: [in the running desktop](#project-artifact/art_a7e016210b9b9bc1/614), `e2e/mission-control-rows-journey.mjs`, and on its own page in the component's tests |
| F3 or ⌃↑ | done | Both driven. On a Mac the operating system may take them; the Dock tile says the keys |
| Tile in the Dock and Launchpad | done | [The Dock's tile](#project-artifact/art_a7e016210b9b9bc1/506) and [Launchpad's](#project-artifact/art_a7e016210b9b9bc1/504) open it: `e2e/overview-more-journey.mjs` |
| Hot Corner | done | Mission Control, Application Windows and Desktop, each driven with the pointer in a corner of the page, same journey. A page sees only its own pointer, so these are the page's corners |
| Three-finger swipe up | partial | **Limit:** the operating system takes the gesture, and a browser reports no event for it to a page. The key and tile replace it |
| Escape or a click on the desktop closes | done | Both driven, same journey |

## Window overview (8: 8 done)

| Item | Status | Main |
| --- | --- | --- |
| A thumbnail of every window, none overlapping | done | [Three windows apart](#project-artifact/art_819e645e9197a100/29), their boxes compared |
| Thumbnails show the window's live contents | done | They are the live windows, scaled, so nothing in them restarts |
| Choosing a thumbnail brings it forward | done | Then the window is its own size again |
| Pointer highlights a thumbnail | done | [The ring on Chess](#project-artifact/art_819e645e9197a100/29) |
| Space bar: Quick Look of a thumbnail | done | [Over the others, whole, under the bar](#project-artifact/art_a7e016210b9b9bc1/243): Space on the thumbnail under the pointer or the focus, Space again puts it back, and Mission Control stays. `e2e/mission-control-more-journey.mjs` |
| Group windows by application | done | [Finder's two windows side by side](#project-artifact/art_a7e016210b9b9bc1/250), from the pane's setting, same journey |
| App names under groups | done | The application's name shows on the first window of each application, giving way to the window's own title under the pointer. No icon beside it. Same journey |
| Minimized windows left out | done | [Calculator minimized, the others staying](#project-artifact/art_a7e016210b9b9bc1/614): `e2e/mission-control-rows-journey.mjs` |

## Spaces (12: 11 done, 1 partial)

| Item | Status | Main |
| --- | --- | --- |
| Spaces bar | done | [Desktops in Mission Control's bar, with the desktop's picture](#project-artifact/art_a7e016210b9b9bc1/223); a Space named by where it stands. `e2e/spaces-journey.mjs`, read back from the server |
| Add Desktop | done | Same journey; up to 16 |
| Remove a Desktop | done | The button shows under the pointer or the focus; its windows go to the Space before it. Same journey |
| Reorder Spaces | done | Dragged along the bar, read back from the server. Same journey |
| ⌃← and ⌃→ switch | done | ⌃← driven. Where the system keeps them, ⌃⇧← and ⌃⇧→ do it, built, not driven. Not while typing in a field |
| ⌃1 to ⌃n | done | ⌃⌥2 driven, which works everywhere up to 9. ⌃1 alone is a Mac's only, since Control is Command elsewhere, built, not driven |
| Drag a window to another Space | done | [A thumbnail, its live window following, onto a Desktop](#project-artifact/art_a7e016210b9b9bc1/222), same journey. Let go on + it makes a Space for itself: `e2e/spaces-more-journey.mjs`. [The windows slide between Spaces](#project-artifact/art_a7e016210b9b9bc1/239), except from Mission Control and under Reduce Motion, same journey |
| Full-screen window as its own Space | done | [In the bar by its title, beside its Desktop](#project-artifact/art_a7e016210b9b9bc1/268): shown by the bar and Control-Left and Right, left by the bar's button or the menu, and gone with its window. `e2e/spaces-fullscreen-journey.mjs`. A further window of the application stays on its Space, and its panels go there and come back with it, as on a Mac; an unrelated window opens on the Desktop beside it. The bar's picture is the desktop's, not the window. It comes back after a reload in full screen on its own Space, same journey |
| Split View: hold the green button, tile two windows | built-unchecked | [Two windows on a Space of their own, with the divider](#project-artifact/art_a7e016210b9b9bc1/281). From the green button held down, on the side it is let go on, and Window > Tile Window to Left or Right of Screen; the other side shows the live windows that can share it, scaled as in Mission Control and pressed to choose, or No Available Windows (`e2e/calls-batch10-journey.mjs`). The divider drags and takes the arrow keys, kept with the Spaces; the menu bar and Dock go; the green button, the bar's button, closing or minimizing a window end it and each window goes back. `e2e/split-view-journey.mjs`. [A title bar let go past the divider changes sides](#project-artifact/art_a7e016210b9b9bc1/340), each keeping its width; [a reload comes back on the Split View](#project-artifact/art_a7e016210b9b9bc1/341), and ended after it each window goes back; [a window let go on a full-screen Space in Mission Control shares a Split View with it](#project-artifact/art_a7e016210b9b9bc1/342), on the side of the thumbnail it is let go on: `e2e/split-view-more-journey.mjs` |
| Dock: Options > Assign To | done | [All Desktops, This Desktop, None](#project-artifact/art_a7e016210b9b9bc1/251): a window on All Desktops stays through every switch, This Desktop brings the application's windows here and its new ones open here, taking the person there, and None lets go; kept on the server and across a reload. `e2e/spaces-more-journey.mjs`. A new window opens on its Desktop, driven from the Dock with the window closed |
| A picture per Space | done | [Each Desktop its own, in the bar too](#project-artifact/art_a7e016210b9b9bc1/252): chosen in System Preferences on one Space, shown there and not on another, kept across a reload on either. A new Desktop goes on showing what was showing. A picture of the drive is kept by its file and read again after a reload, the bar's too; a photo from Photos is kept once it is saved to the drive, which the hook's tests drive, not a browser. `e2e/spaces-picture-journey.mjs` |
| Spaces kept across a reload | done | The Spaces, the one showing and each window's: same journey, and a reload at once after changing Space comes back on it: `e2e/spaces-reload-journey.mjs`. A window brought forward from the Dock takes the person to its Space. An empty Space has no key window, so Finder is in front |

## App Exposé and Show Desktop (4: 4 done)

| Item | Status | Main |
| --- | --- | --- |
| App Exposé ⌃↓ | done | [The front application's window alone](#project-artifact/art_819e645e9197a100/30) |
| Recent documents shelf | done | [Under App Exposé](#project-artifact/art_a7e016210b9b9bc1/507): what the application opened lately, from the drive, up to 8, and its row brings the document back: `e2e/overview-more-journey.mjs`. None for an application with nothing to shelve |
| Dock tile: Show All Windows | done | From TextEdit's tile, leaving Chess out |
| Show Desktop: F11 or ⌘F3 | done | [The windows off the screen](#project-artifact/art_819e645e9197a100/32), and back, by Control-Option-D. ⌘F3 and F11 on a Mac share the path, not driven |

## Command-Tab (8: 8 done)

| Item | Status | Main |
| --- | --- | --- |
| Library component `AppSwitcher` | done | The served desktop's switcher is built on it: `e2e/mission-control-journey.mjs`, and on its own page in the component's tests |
| Opens from the keyboard | done | [Option-Tab](#project-artifact/art_819e645e9197a100/31), or Option-`: a page cannot have ⌘Tab, which the operating system takes |
| Order by most recent use | done | Chess, Finder, TextEdit, with Finder selected: the one used before |
| Shift steps back | done | |
| Q quits and H hides while it shows | done | Q driven, the tile's dot goes. [H hides the selected application](#project-artifact/art_a7e016210b9b9bc1/505), its windows minimized: `e2e/overview-more-journey.mjs` |
| Escape cancels | done | Without choosing |
| ⌘` next window of the app | done | The Window menu's Cycle Through Windows, driven from the row; ⌘` shares its command |
| Down Arrow goes to App Exposé | done | [The selected application's windows alone](#project-artifact/art_a7e016210b9b9bc1/615): `e2e/mission-control-rows-journey.mjs` |

## Preferences (2: 2 done)

| Item | Status | Main |
| --- | --- | --- |
| Mission Control pane: rearrange Spaces, switching, grouping, separate Spaces, keys | done | Group windows by application and the three shortcut menus take effect, and Hot Corners: `e2e/mission-control-more-journey.mjs`. Rearrange, switching and separate Spaces are dimmed at what the desktop does, each saying why, since it keeps Spaces where they are put and a page has one display. Without the served desktop the pane keeps the screenshots' state, and F11 takes effect only on a Mac, where a browser leaves it |
| Hot Corners sheet | done | The sheet's rows are kept per account and take effect, with Mission Control, Application Windows and Desktop among them: `hot-corners.ts`. Sheet opened by the System thread's journey; the corners driven here |

## What this builds on (3: 3 done)

| Item | Status | Main |
| --- | --- | --- |
| Window manager: frames, order, focus, minimize | done | Moved, all eight edges, a press to the front, a minimized tile: `e2e/desktop-rows-journey.mjs` |
| Full screen for a window | done | [Fills the screen](#project-artifact/art_a7e016210b9b9bc1/612), and Exit puts it back: `e2e/mission-control-rows-journey.mjs` |
| Window menu's list | done | [The front application's windows, Finder's by folder](#project-artifact/art_a7e016210b9b9bc1/621), and a row brings its window forward, same journey |

## Calls made

- **Keys.** A page cannot take ⌘Tab or a swipe, and browsers vary on F3 and ⌃↑. So each command gets a key that works in every engine, shown in its menu or tooltip, plus a Dock tile. The real key is also bound where the page can get it.
- **Thumbnails.** Scale the live windows with CSS transforms rather than cloning them, which keeps video and text live and costs little memory. Windows must not lose state when scaled.

## Build items, most used first

1. **M1 Mission Control on the desktop.** Add the overlay, feed it window frames, scale live windows, choose, Escape, Dock tile, stand-in key.
2. **M2 Command-Tab.** Add `AppSwitcher` with most recent use order, Shift back, Q and H, plus next window of an app and a Window menu row.
3. **M3 App Exposé and Show Desktop.** Key and Dock tile's Show All Windows, with the recent documents shelf; Show Desktop.
4. **M4 Spaces.** A per-account Spaces model in the window manager's host: add, remove, reorder, switch, drag a window across, per-Space picture, saved.
5. **M5 Full screen and Split View.** Full-screen window becomes a Space in the bar; hold the green button to tile two windows.
6. **M6 Preferences take effect.** Mission Control pane options and Hot Corners (with D9).
