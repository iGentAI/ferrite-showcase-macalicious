# Feature inventory: Activity Monitor

Read from GitHub at main `e62c2ac9` (29 October 2026). Nothing was run, so no row says done. Status describes the desktop served by Ferrite (`activity-monitor-desktop.tsx`), whose window is "Activity Monitor (This Desktop)".

**Status:** missing (not in code), partial (note says what is absent), built-unchecked (in code, not seen running). **Browser limit** marks what a page cannot know: the app must say so rather than invent a figure. Real-app rows are from knowledge of macOS 10.15, not checked on a Mac. Row counts are by hand.

**Counts:** 68 done, 0 built-unchecked, 1 partial, 1 missing, 72 rows.

## Activity Monitor menu

| Item | Status | Note |
| --- | --- | --- |
| About Activity Monitor | done | Shows the whole name; `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/49) |
| Preferences… | done | Dimmed with a reason row, as the real app has none to offer |
| Services | done | "No Services Apply", dimmed: this desktop has none to offer it |
| Hide Activity Monitor ⌘H | done | Goes at once, with no tile of its own; its tile brings it back; `desktop-hide-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/467) |
| Hide Others ⌥⌘H | done | `desktop-hide-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/467) |
| Show All | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/186) |
| Quit ⌘Q | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/186) |

## File menu

| Item | Status | Note |
| --- | --- | --- |
| Close Window ⌘W | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/189) |

## Edit menu

| Item | Status | Note |
| --- | --- | --- |
| Undo, Redo | done | Dimmed, saying nothing here can be undone; the search field keeps the browser's own keys; `activity-monitor-depth-journey.mjs` |
| Cut, Copy, Paste | done | Copy works; Cut and Paste are dimmed, saying the lists can only be copied from; the search field keeps the browser's own keys; `activity-monitor-depth-journey.mjs` |
| Select All | done | ⌘A or the menu selects every listed row; `activity-monitor-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/206) |
| Find ⌥⌘F | done | Edit > Find works. Browser limit: off Apple platforms Control-Alt-F is the desktop's full screen; `activity-monitor-depth-journey.mjs` |
| Copy the selected row | done | Edit > Copy, ⌘C, the Action menu and the row's menu: the columns' titles, then each selected row, tab-separated; `activity-monitor-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/206) |

## View menu

| Item | Status | Note |
| --- | --- | --- |
| Dock Icon submenu | done | Show Application Icon, Show CPU Usage and Show CPU History work; network and disk are dimmed, and View says why; `activity-dock-journey.mjs` |
| Update Frequency | done | 1, 2 or 5 seconds, kept; `activity-monitor-depth-journey.mjs` |
| Columns submenu | done | Takes columns away and back, per view, kept for the account; `activity-monitor-views-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/3) |
| Process filters (All, Windowed, Selected, Active…) | done | All and Windowed, kept for the account, and Selected for this visit, on Applications, the one view that lists applications; `activity-monitor-tools-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/7), [Selected](#project-artifact/art_f78ff2f58b1abff3/9). The Mac's other filters (My, System, Other User, Active, Inactive, GPU, Last 12 Hours, Hierarchically) need processes, which a page does not have, and a dimmed row in View says so |
| Inspect Process ⌘I | done | A window per selected application: its windows, the requests counted for it, what it keeps, and what a page cannot see; `activity-monitor-depth-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/6) |
| Sample Process | done | View says a page cannot; `activity-monitor-depth-journey.mjs` |
| Run Spindump | done | Dimmed, and View says a page cannot; `activity-monitor-tools-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/7) |
| Run System Diagnostics | done | Dimmed, and View says a page cannot; `activity-monitor-tools-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/7) |
| Quit Process ⌥⌘Q | done | [Screenshot](#project-artifact/art_f78ff2f58b1abff3/1) |
| Send Signal to Process… | done | View says a page cannot |
| Show Deltas for Process | done | Dimmed, and View says a page cannot; `activity-monitor-save-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/94) |
| Clear CPU History ⌘K | done | Clear History, of the server-time graph and round trips; `activity-monitor-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/201) |
| Enter Full Screen | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/45) |

## Window menu

| Item | Status | Note |
| --- | --- | --- |
| Minimize ⌘M | done | Goes to the Dock, and comes back; `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/51) |
| Zoom | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/46) |
| Bring All to Front | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/50) |
| Window list | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/50) |
| Activity Monitor ⌘1 | done | Makes the main window key; an open inspector still floats above it, as a panel does; `activity-monitor-tools-journey.mjs` |
| CPU Usage ⌘2 | done | The page's main thread, measured; `activity-monitor-depth-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/6) |
| CPU History ⌘3 | done | The page's main thread over time; `activity-monitor-depth-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/6) |
| GPU History ⌘4 | done | Browser limit: a dimmed row says a web page is shown nothing of the GPU |

## Help menu

| Item | Status | Note |
| --- | --- | --- |
| Activity Monitor Help | done | Opens Help Viewer; `activity-monitor-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/202) |
| Search field | done | The shared Help menu's; Return opens Help Viewer on the words; `system-apps-help-journey.mjs`, [shot of the same menu](#project-artifact/art_7026fbcdd84f1550/23) |

## Toolbar

| Item | Status | Note |
| --- | --- | --- |
| Quit Process | done | Quittable rows only; `activity-monitor-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/208) |
| Search field | done | By name; `activity-monitor-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/203) |
| View control | done | Applications, Ferrite, CPU, Memory, Energy, Disk and Network: the Mac's five and the desktop's own two, each title clear of the search field; `activity-monitor-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/44) |
| Inspect button | done | Opens the selected rows' inspectors; `activity-monitor-tools-journey.mjs` |
| Action (gear) menu | done | Quit, Inspect, Copy and the frequency; `activity-monitor-tools-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/8) |

## Views

| Item | Status | Note |
| --- | --- | --- |
| Applications | done | Windows and minimized, read from the window manager; `activity-monitor-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/205) |
| Ferrite | done | Per-module requests, times, store calls, failures, and no processor, memory or energy column; `activity-monitor-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/44) |
| Column sort, by view | done | Applications driven; `activity-monitor-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/200) |
| Footer summary and SERVER TIME graph | done | `activity-monitor-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/207) |
| Network | done | Round trips. Browser limit: the view says a page gets no bytes or packets per process |
| CPU | done | This page's main thread (how late its timers run), frames, long tasks, reported cores, and a MAIN THREAD graph; says a page is shown no processor figures; `activity-monitor-views-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/3) |
| Memory | done | `performance.memory` and `deviceMemory`, and "Not reported by this browser" elsewhere, as `activity-monitor-views-journey.mjs` read in Firefox 157 and Playwright's WebKit 27.2 on Linux, where every memory figure says so |
| Energy | done | Battery API where present, and says so elsewhere; the battery itself is unit-tested, as the test browser reports whatever it reports; `activity-monitor-views-journey.mjs` |
| Disk | done | The drive, each app's data, and the browser's storage estimate; `activity-monitor-views-journey.mjs` |

## Windows and sheets

| Item | Status | Note |
| --- | --- | --- |
| Quit sheet | done | Cancel, Force Quit and Quit; both close the windows, as a page has no process to kill; [Screenshot](#project-artifact/art_f78ff2f58b1abff3/1) |
| Inspector window (Memory, Statistics, Open Files) | done | Browser limit: the desktop's counts in place of those three, and it says why; `activity-monitor-depth-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/6) |
| Sample window | done | Sample Process is dimmed, and View says a page cannot sample a process; [shot](#project-artifact/art_a7e016210b9b9bc1/94) |
| CPU Usage floating window | done | `activity-monitor-depth-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/6) |
| CPU History window | done | `activity-monitor-depth-journey.mjs`, [shot](#project-artifact/art_f78ff2f58b1abff3/6) |

## Context menus

| Item | Status | Note |
| --- | --- | --- |
| Process row | done | Quit Process and Inspect Process, the row's two that apply to an application here; `activity-monitor-depth-journey.mjs` |
| Column header (choose columns) | done | The menu of the table, its header included, has Columns; `activity-monitor-views-journey.mjs` |

## Keyboard

| Item | Status | Note |
| --- | --- | --- |
| Arrow keys in the table | done | `activity-monitor-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/204) |
| ⌘W ⌘M ⌘H ⌥⌘H ⌘Q | done | From the desktop; ⌥⌘H only through its row; `system-apps-shell-journey.mjs`, [after ⌘Q](#project-artifact/art_a7e016210b9b9bc1/191) |
| ⌥⌘Q | done | [Screenshot](#project-artifact/art_f78ff2f58b1abff3/1) |
| ⌘I | done | `activity-monitor-depth-journey.mjs` |
| ⌘2 ⌘3 | done | And ⌘1; also with a CPU window in front; off a Mac they are Control-1 to -3, as a page cannot take Command-digit in most browsers; `activity-monitor-depth-journey.mjs` |
| ⌥⌘F | done | Browser limit: not reachable off Apple platforms, where the row in Edit works |

## Drag and drop

| Item | Status | Note |
| --- | --- | --- |
| Reorder columns | done | Drag a heading, or Option-Shift-Left and -Right on it; the order is kept for the account per view and the rows follow; `activity-monitor-columns-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/270) |
| Resize columns | done | A heading's edge, kept for the account per view; `activity-monitor-save-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/95) |

## Multi-selection

| Item | Status | Note |
| --- | --- | --- |
| Select several and quit them | done | [Screenshot](#project-artifact/art_f78ff2f58b1abff3/1) |

## Saved state

| Item | Status | Note |
| --- | --- | --- |
| View, sort, columns, frequency and filter across a reload | done | The search field's text is not kept, as on a Mac; `activity-monitor-views-journey.mjs` |

## Cross-app and ledger

| Item | Status | Note |
| --- | --- | --- |
| Quit Process goes through the desktop as Force Quit does | done | `activity-monitor-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/208) |
| Full instance name in the footer | done | It ran across the graph on the hosted site. The cell now shows the part that differs between instances, node, process and id, cut inside the cell, and hovering shows the whole name. The journey lengthens the name in the reply, as a local server has none; `activity-monitor-columns-journey.mjs`, [shot of an earlier cut](#project-artifact/art_a7e016210b9b9bc1/271) |
| Journey asserts that the request count grows | done | Ledger: done at `1af6d21b`, run in `activity-monitor-journey.mjs`, [the counts](#project-artifact/art_a7e016210b9b9bc1/44) |
| Live graph in the Dock icon | partial | View > Dock Icon draws [CPU History or a CPU Usage meter on the tile while it runs](#project-artifact/art_a7e016210b9b9bc1/301), a reading a second of this page's main thread, the one load a page can read; kept per account across a reload; the icon returns on quit or when chosen: `e2e/activity-dock-journey.mjs`. Show Network Usage and Show Disk Activity are dimmed: a page has no API for the computer's network or disk, only for its own requests, and a graph of those would not be what the row says. **Limit:** the CPU reading is this page's main thread, never the computer's, since no browser gives a page the computer's load |
| Save a report as a file for Finder | done | File > Save… writes the view's table to the drive, read back; `activity-monitor-save-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/96) |

## Build items, most-used first

1. **Menus and keys.** Register View, Edit and Window items; ⌥⌘Q, ⌘I, ⌥⌘F, ⌘1 to ⌘3; Help to Help Viewer; check the instance name's fit.
2. **Saved state.** View, sort, columns and frequency per account; Update Frequency; process filters.
3. **Multi-selection and row menu.** Quit several, contextual menu, Copy; Quit sheet with Force Quit.
4. **Honest tabs.** CPU, Memory, Energy and Disk, each with the page's real figures and a plain statement of what a page cannot see.
5. **Inspector window.** Per-application windows, requests and stored data; Sample and Spindump state why not.
6. **Columns.** Chooser, resize, reorder, header menu.
7. **CPU Usage and CPU History windows; Dock icon graph,** the last with the integration worker.
