# Feature inventory: Force Quit

Read from GitHub at main `e62c2ac9` (29 October 2026). Nothing was run, so no row says done. The real window has no menus or saved data of its own, and no drag or context menu, so those have no rows.

**Status:** done (seen working in the running app, with a screenshot), missing (not in code), partial (note says what is absent), built-unchecked (in code, not seen running). **Browser limit** marks what a page cannot know: the app must say so. Real-app rows are from knowledge of macOS 10.15, not checked on a Mac. Row counts are by hand.

**Counts:** 26 done, 1 built-unchecked, 0 partial, 27 rows.

## Menu bar

| Item | Status | Note |
| --- | --- | --- |
| Menus while it is in front | done | The window behind it keeps the menu bar, and Finder's with nothing else open; `force-quit-level-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/4) |

## Window

| Item | Status | Note |
| --- | --- | --- |
| Title and instruction text | done | `force-quit-rows-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/13) |
| One fixed size | done | A drag from the corner leaves 338 by 307; `force-quit-rows-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/13) |
| Minimize disabled | done | The button is dimmed and Command-M leaves it open; the desktop's own `minimizeDisabled` had been switching it on; `force-quit-rows-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/13) |
| Close ⌘W | done | Both the key and the button; `force-quit-rows-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/13) |
| Stays above other windows | done | A panel of the desktop's; a click on another window leaves it on top; `force-quit-level-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/4) |

## Application list

| Item | Status | Note |
| --- | --- | --- |
| Applications with a window, then Finder | done | `runningApplications`; `force-quit-rows-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/13) |
| Finder last and always listed | done | `force-quit-rows-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/13) |
| List follows apps opening and quitting | done | `force-quit-rows-journey.mjs`, [Notes joined the list](#project-artifact/art_a7e016210b9b9bc1/31) |
| Application icons | done | The Dock's; `force-quit-depth-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/2) |
| "(not responding)" | done | Never marked on the desktop, and the window's first line says a page cannot tell; `force-quit-level-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/4) |

## Keyboard

| Item | Status | Note |
| --- | --- | --- |
| Arrow keys | done | `force-quit-rows-journey.mjs`, [selection moved down](#project-artifact/art_a7e016210b9b9bc1/38) |
| Return asks | done | `force-quit-rows-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/15) |
| Type to select | done | `force-quit-rows-journey.mjs`, ["fin" typed, Finder selected](#project-artifact/art_a7e016210b9b9bc1/37) |

## Force Quit button

| Item | Status | Note |
| --- | --- | --- |
| Force Quit | done | `force-quit-rows-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/15) |
| Relaunch for Finder | done | The button and sheet read Relaunch and Finder stays listed; `force-quit-rows-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/14) |
| Double-click a row asks | done | `force-quit-rows-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/15) |
| Confirmation sheet | done | Cancel keeps the app; `force-quit-rows-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/15) |
| Hint about Command-Option-Escape | done | `force-quit-rows-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/13) |
| Quitting closes every window of the app | done | TextEdit with unsaved text ends after the sheet's warning, with no question of its own; `force-quit-depth-journey.mjs` |
| A window with a send in flight | built-unchecked | Run with a Mail send held on its way by a route stub: Force Quit takes the composer and Mail off the desktop at once, without asking them (`quitApplication` in `desktop.tsx`). The request already sent still reaches the server when let go: HTTP 201, the message in Sent and in the Inbox. The window's save on its way out does not leave a draft of it: the send forgets a draft saved with the same text within a minute, and a draft saved after it is not kept (`{"message": null}`). `e2e/calls-batch10-journey.mjs` reads Drafts from the server, in both orders; `small-rows-batch9-journey.mjs` for the rest |

## How it opens

| Item | Status | Note |
| --- | --- | --- |
| Command-Option-Escape | done | `force-quit-rows-journey.mjs`, [opened by the key](#project-artifact/art_a7e016210b9b9bc1/36) |
| Apple menu Force Quit… | done | `force-quit-rows-journey.mjs`, [the menu row](#project-artifact/art_a7e016210b9b9bc1/34) |
| Option-held Dock menu "Force Quit" | done | Ends the app; `force-quit-rows-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/10) |

## Multi-selection

| Item | Status | Note |
| --- | --- | --- |
| Select several and force quit them | done | `force-quit-depth-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/2) |

## Selection

| Item | Status | Note |
| --- | --- | --- |
| A row stays selected when the app goes | done | The next row took the selection; `force-quit-rows-journey.mjs`, [Maps gone](#project-artifact/art_a7e016210b9b9bc1/35) |

## Cross-app

| Item | Status | Note |
| --- | --- | --- |
| Activity Monitor's Quit Process uses the same route | done | `activity-monitor-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/208) |

## Build items, most-used first

1. **Force really ends the app.** Check unsaved documents and a composer with a send in flight; make the outcome true and say what was lost.
2. **Multi-selection.** ⌘ and Shift, with the sheet naming the count.
3. **Icons.** The Dock's icons in the list.
4. **Window level.** Stays above other windows while open.
5. **Not responding.** Measure or state plainly why it cannot be known.
6. **Dock's Option menu and menu bar correction,** with the integration worker.
