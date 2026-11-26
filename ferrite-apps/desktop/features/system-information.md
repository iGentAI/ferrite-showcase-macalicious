# Feature inventory: System Information

Read from GitHub at main `e62c2ac9` (29 October 2026). Nothing was run, so no row says done. Status describes the desktop served by Ferrite, whose report holds the browser's and the application's own facts.

**Status:** done (seen working in the running app, with a screenshot), missing (not in code), partial (note says what is absent), built-unchecked (in code, not seen running). **Browser limit** marks what a page cannot see: the app must say so. Real-app rows are from knowledge of macOS 10.15, not checked on a Mac. Row counts are by hand.

**Counts:** 48 done, 0 built-unchecked, 0 partial, 0 missing, 48 rows.

## System Information menu

| Item | Status | Note |
| --- | --- | --- |
| About System Information | done | Shows the whole name; `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/64) |
| Preferences… | done | Dimmed with a reason row, as this application has no preferences; the desktop's shared menu, `desktop-menu-reasons.test.tsx`, not driven for this application |
| Services | done | Not on this desktop: "No Services Apply", dimmed; the same test |
| Hide System Information ⌘H | done | Goes at once, with no tile of its own; its tile brings it back; `desktop-hide-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/467) |
| Hide Others ⌥⌘H | done | `desktop-hide-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/467) |
| Show All | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/197) |
| Quit ⌘Q | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/197) |

## File menu

| Item | Status | Note |
| --- | --- | --- |
| Close Window ⌘W | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/198) |
| Save… ⌘S | done | To the drive; read back; `system-information-depth-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/1) |
| Print… ⌘P | done | The report alone, through the browser's print dialog; `system-information-depth-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/1) |
| Refresh Information ⌘R | done | `system-information-depth-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/1) |
| Send to Apple… | done | Dimmed, with the reason under it: a web page cannot send a report to Apple; `system-information-tools-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/4) |

## Edit menu

| Item | Status | Note |
| --- | --- | --- |
| Undo, Redo | done | Listed and dimmed; a report has nothing to undo, and the find field keeps the browser's own keys; `system-information-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/215) |
| Cut, Copy, Paste | done | Cut and Paste act on the find field and are dimmed elsewhere; Copy copies the chosen rows, the selected text or the report; `system-information-tools-journey.mjs`, `system-information-depth-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/3) |
| Select All | done | Every row of a table report, the text of any other report, the field while typing; `system-information-tools-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/4) |
| Find ⌘F | done | A bar under the report: Return or Next goes to the next category whose name or report holds the words, opening what is around it; says when nothing does; `system-information-depth-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/2) |

## View menu

| Item | Status | Note |
| --- | --- | --- |
| View menu | done | Not a menu of this app: the 10.15 menu bar is System Information, File, Edit, Window, Help, as `app.ts` has it, and the old profile choices of a View menu are gone. From knowledge of macOS, not checked on a Mac, and no reference screenshot shows the menu bar |

## Window menu

| Item | Status | Note |
| --- | --- | --- |
| Minimize ⌘M | done | Goes to the Dock, and comes back; `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/67) |
| Zoom | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/65) |
| Bring All to Front | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/66) |
| Window list | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/66) |
| About This Mac | done | Opens the window; `system-information-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/219) |

## Help menu

| Item | Status | Note |
| --- | --- | --- |
| System Information Help | done | Opens Help Viewer; `system-information-depth-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/1) |
| Search field | done | The shared Help menu's; Return opens Help Viewer on the words; `system-apps-help-journey.mjs`, [shot of the same menu](#project-artifact/art_7026fbcdd84f1550/23) |

## Outline

| Item | Status | Note |
| --- | --- | --- |
| Expand and collapse | done | With the arrow keys; `system-information-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/212) |
| Browser | done | `system-information-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/209) |
| Browser > Display | done | `system-information-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/210) |
| Browser > Storage | done | `system-information-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/211) |
| Ferrite Application | done | `system-information-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/214) |
| Ferrite Application > App Modules | done | `system-information-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/216) |
| Ferrite Application > Session Storage | done | `system-information-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/218) |
| Hardware | done | The browser's figures, and what a page cannot read; `system-information-depth-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/1) |
| Network | done | `navigator.connection`, `onLine`; says what a page cannot read; `system-information-depth-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/1) |
| Software | done | Overview, the desktop's Applications, the Fonts this page loaded (**browser limit:** a page cannot list the computer's, and the report says so) and the server's Logs; `system-information-depth-journey.mjs`, [Fonts](#project-artifact/art_a7e016210b9b9bc1/619), [Logs](#project-artifact/art_a7e016210b9b9bc1/620) |

## Report

| Item | Status | Note |
| --- | --- | --- |
| Sortable tables | done | `system-information-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/216) |
| Details of the selected row | done | `system-information-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/217) |
| Path bar | done | `system-information-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/217) |
| Refresh while open | done | `system-information-depth-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/1) |

## Context menu

| Item | Status | Note |
| --- | --- | --- |
| Copy from a row or report | done | Copy and Select All; a secondary click on a row outside the selection chooses it first; `system-information-tools-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/5) |

## Keyboard

| Item | Status | Note |
| --- | --- | --- |
| Arrow keys in the outline and table | done | `system-information-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/213) |
| ⌘W ⌘M ⌘H ⌥⌘H ⌘Q | done | From the desktop; ⌥⌘H only through its row; `system-apps-shell-journey.mjs`, [after ⌘Q](#project-artifact/art_a7e016210b9b9bc1/199) |
| ⌘R ⌘S ⌘P ⌘F | done | `system-information-depth-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/2) |

## Drag

| Item | Status | Note |
| --- | --- | --- |
| Divider resizes the outline | done | Kept across a reload; `system-information-depth-journey.mjs` |

## Multi-selection

| Item | Status | Note |
| --- | --- | --- |
| Select several rows and copy | done | Command-click, Shift-click, Select All; Copy writes the rows as tab-separated lines under the column titles; the details show the first chosen row; `system-information-tools-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/3) |

## Saved state

| Item | Status | Note |
| --- | --- | --- |
| Selected category, expanded rows and divider across a reload | done | `system-information-depth-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/2) |

## Cross-app

| Item | Status | Note |
| --- | --- | --- |
| About This Mac's System Report… opens it | done | `system-information-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/220) |
| Option-held Apple menu shows System Information… | done | [About This Mac gives way to it while Option is held](#project-artifact/art_a7e016210b9b9bc1/300), and it opens System Information; `apple-menu-option-journey.mjs` |
| Save the report as a file on the drive | done | `system-information-depth-journey.mjs`, [shot](#project-artifact/art_2ea83e878e36b0c0/1) |

## Build items, most-used first

1. **Refresh, Copy and Find.** ⌘R, Edit items, ⌘F, Help to Help Viewer.
2. **Save and Print.** Report as text, on the drive or a download; `window.print`.
3. **Network and Software sections.** Connection facts, installed desktop apps, fonts and Console's logs.
4. **Hardware statement.** A plain row of what a page cannot read, with the browser's estimates labelled.
5. **Saved state.** Category, expanded rows, divider.
6. **Window > About This Mac and the Option-held Apple menu.**
