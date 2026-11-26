# Feature inventory: About This Mac

Read from GitHub at main `e62c2ac9` (29 October 2026). Nothing was run, so no row says done. Status describes the desktop served by Ferrite, whose window shows the deployment, the browser and the person's drive. The real window has no menus or context menus of its own, no drag and no multi-selection, so those have no rows.

**Status:** done (seen working in the running app, with a screenshot), missing (not in code), partial (note says what is absent), built-unchecked (in code, not seen running). **Browser limit** marks what a page cannot see: the app must say so. Real-app rows are from knowledge of macOS 10.15, not checked on a Mac. Row counts are by hand.

**Counts:** 26 done, 2 built-unchecked, 1 partial, 0 missing, 29 rows.

## Menu bar while in front

| Item | Status | Note |
| --- | --- | --- |
| Application menu | built-unchecked | Titled Finder, as the capture shows: its About row reads About This Mac (`about-this-mac-depth-journey.mjs`), Hide reads Hide Finder, and there is no Quit row, as Finder has none |
| Edit, Go and Help | built-unchecked | Finder's own rows: Edit dimmed with nothing selected; Go opens a Finder window at the place asked for, with its keys; Help's four. `rows-batch25-journey`. Applications in Go is the desktop's submenu |
| Close Window ⌘W | done | The row and the key; `about-this-mac-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/287) |
| Minimize ⌘M; Window list | done | The row and the key go to the Dock, and the Dock brings it back; the list names it while it is in front; `about-this-mac-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/288) |

## Window

| Item | Status | Note |
| --- | --- | --- |
| Fixed size, zoom disabled | done | `about-this-mac-rows-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/4) |
| Five tabs in the title bar | done | `about-this-mac-rows-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/4) |

## Overview

| Item | Status | Note |
| --- | --- | --- |
| Name and build line | done | "Macalicious Desktop, build …"; `about-this-mac-rows-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/4) |
| Click the version for build and serial | done | Cycles the full build and the deployment; no serial exists here; `about-this-mac-depth-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/1) |
| Deployment, Instance, App Modules, Session Data, Browser, Processors | done | Instance has no row when the server reports none, as on a local desktop; `about-this-mac-rows-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/4) |
| Model, processor, memory, graphics, serial | done | Says a web page cannot read them; `about-this-mac-depth-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/1) |
| System Report… | done | Opens System Information; `about-this-mac-rows-journey.mjs`, [it opened](#project-artifact/art_a7e016210b9b9bc1/43) |
| Software Update… | done | Opens the pane; `about-this-mac-census-journey.mjs`. The pane checked for invented facts: it shows this desktop's deployment, site build and the time it was read, says macOS updates are not offered here, and invents none; [the pane](#project-artifact/art_a7e016210b9b9bc1/1) |
| License Agreement | done | Opens Safari on Apple's page; `about-this-mac-census-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/4) |

## Displays

| Item | Status | Note |
| --- | --- | --- |
| This browser's screen | done | `about-this-mac-rows-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/6) |
| Every screen (`getScreenDetails`) | built-unchecked | Show Every Screen… asks the browser, and a browser already allowed is read unasked; other browsers and a refusal say so. Two screens read in a real Chromium started with two (`--screen-info`), each size shown as the browser reports it: `small-rows-batch9-journey.mjs`; the asking: `about-this-mac-rows-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/6). No physical second monitor |
| Displays Preferences… | done | Opens the pane; `about-this-mac-rows-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/6) |

## Storage

| Item | Status | Note |
| --- | --- | --- |
| Ferrite Drive against its quota | done | Plus what the apps keep beyond the quota; `about-this-mac-rows-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/5) |
| Manage… | done | Opens Storage Management; `about-this-mac-rows-journey.mjs`, [it opened](#project-artifact/art_a7e016210b9b9bc1/41) |
| Legend by kind | done | One swatch per segment; `about-this-mac-depth-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/1) |
| Coloured bar segments per kind | done | `about-this-mac-depth-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/1) |
| Figures reread when the window returns to the front | done | `about-this-mac-depth-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/1) |

## Support and Service

| Item | Status | Note |
| --- | --- | --- |
| Support links | done | Safari; macOS Help opens Help Viewer; `about-this-mac-census-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/3) |
| Service links | done | Safari; `about-this-mac-census-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/2) |

## Keyboard

| Item | Status | Note |
| --- | --- | --- |
| ⌘W ⌘M | done | `about-this-mac-rows-journey.mjs`, [⌘M took it to the Dock](#project-artifact/art_a7e016210b9b9bc1/42) |
| Arrow keys across tabs | done | `about-this-mac-rows-journey.mjs`, [the arrow moved to Displays](#project-artifact/art_a7e016210b9b9bc1/40) |

## Saved state

| Item | Status | Note |
| --- | --- | --- |
| Tab last shown | done | `about-this-mac-depth-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/1) |

## Cross-app

| Item | Status | Note |
| --- | --- | --- |
| Apple menu opens it | done | `about-this-mac-rows-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/4) |
| One window: choosing it again brings it forward | done | `about-this-mac-rows-journey.mjs`, [shot](#project-artifact/art_a8b031ea6e98ace7/4) |
| Option-held Apple menu opens System Information | done | [About This Mac gives way to it while Option is held](#project-artifact/art_a7e016210b9b9bc1/300), and it opens System Information; `apple-menu-option-journey.mjs` |

## Build items, most-used first

1. **Menu bar.** Check and correct the front-application menus.
2. **Overview.** Click the version; a plain statement of the hardware facts a page cannot read.
3. **Storage.** Coloured segments and a legend; reread on return.
4. **Displays.** Every screen where the browser allows it.
5. **Saved tab.** Per account.
