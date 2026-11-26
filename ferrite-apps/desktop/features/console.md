# Feature inventory: Console

Read from GitHub at main `e62c2ac9` (29 October 2026). Nothing was run, so no row says done. Later commits update rows as they land. Status describes the desktop served by Ferrite, whose device is the application's own log.

**Status:** done (seen working in the running app, with a screenshot), missing (not in code), partial (note says what is absent), built-unchecked (in code, not seen running). **Browser limit** marks what a page cannot see: the app must say so. Real-app rows are from knowledge of macOS 10.15, not checked on a Mac; the exact File and Action items need checking against the reference. Row counts are by hand.

**Counts:** 67 done, 0 built-unchecked, 0 partial, 1 missing, 68 rows.

## Console menu

| Item | Status | Note |
| --- | --- | --- |
| About Console | done | Shows the whole name; `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/48) |
| Preferences… | done | Dimmed with a reason row: Console keeps its choices in its windows |
| Services | done | "No Services Apply", dimmed: this desktop has none to offer it |
| Hide Console ⌘H | done | Goes at once, with no tile of its own; its tile brings it back; `desktop-hide-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/467) |
| Hide Others ⌥⌘H | done | `desktop-hide-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/467) |
| Show All | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/185) |
| Quit ⌘Q | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/185) |

## File menu

| Item | Status | Note |
| --- | --- | --- |
| Close Window ⌘W | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/188) |
| Open… a log file | done | ⌘O, from the drive: a row under Log Files with the file's lines; a line in the system log's form gives its time, process and id, and no year is added; 8 MB at most, as it is read whole in the page; `console-files-journey.mjs`, [the panel](#project-artifact/art_a7e016210b9b9bc1/71), [its rows](#project-artifact/art_a7e016210b9b9bc1/72) |
| Save a Copy As… | done | To the drive: the selected messages, or every listed one; read back; `console-tools-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/3) |
| Reveal in Finder | done | `console-files-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/68) |
| Move to Trash | done | The row leaves the sidebar and the device is shown; `console-files-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/70) |

## Edit menu

| Item | Status | Note |
| --- | --- | --- |
| Undo, Redo | done | Dimmed, saying nothing in Console can be undone; `console-tools-journey.mjs` |
| Cut, Copy, Paste | done | Copy copies the selected messages, one line each ([shot](#project-artifact/art_4534e22d1233cad7/1)); Cut and Paste are dimmed, saying the log is read-only; the search field keeps the browser's own keys; `console-tools-journey.mjs` |
| Select All | done | [shot](#project-artifact/art_4534e22d1233cad7/1) |
| Find ⌘F | done | Takes the search field; [shot](#project-artifact/art_4534e22d1233cad7/1) |
| Find Next, Use Selection | done | A search filters the list, so Find Next and Find Previous step through its rows; Use Selection searches for the selected text or the row's process; `console-tools-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/5) |

## Action menu

| Item | Status | Note |
| --- | --- | --- |
| Clear | done | ⌘K; `console-depth-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/1) |
| Reload | done | ⌘R; `console-depth-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/1) |
| Get Info | done | ⌘I; `console-depth-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/1) |
| Include Info Messages | done | On at first, unlike a Mac's, as the application logs every successful request at Info and the window would otherwise look empty; turning it off leaves them out; kept; `console-layout-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/2) |
| Include Debug Messages | done | Off at first; kept; `console-layout-journey.mjs` |

## View menu

| Item | Status | Note |
| --- | --- | --- |
| Enter Full Screen | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/54) |
| Show or Hide Sidebar | done | `console-depth-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/1) |
| Hide Toolbar | done | Kept for the account; Find brings it back; `console-tools-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/4) |

## Window menu

| Item | Status | Note |
| --- | --- | --- |
| Minimize ⌘M | done | Goes to the Dock, and comes back; `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/52) |
| Zoom | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/53) |
| Bring All to Front | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/47) |
| Window list | done | `system-apps-shell-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/47) |

## Help menu

| Item | Status | Note |
| --- | --- | --- |
| Console Help | done | Opens Help Viewer; `console-depth-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/1) |
| Search field | done | The shared Help menu's; Return opens Help Viewer on the words; `system-apps-help-journey.mjs`, [shot of the same menu](#project-artifact/art_7026fbcdd84f1550/23) |

## Toolbar

| Item | Status | Note |
| --- | --- | --- |
| Now | done | Follows the newest message; `console-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/176) |
| Activities | done | The log records no activities, and the table says so; `console-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/178) |
| Clear | done | Hides what was shown until Reload; `console-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/182) |
| Reload | done | `console-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/183) |
| Info | done | `console-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/180) |
| Share | done | Mail attaches the selected messages as a text file, Notes makes a note of them, Copy Message copies; AirDrop says why not. Messages takes files the same way; `console-search-journey.mjs` for Mail and Notes, [shot](#project-artifact/art_a7e016210b9b9bc1/458) |
| Search field | done | Pop-ups beside a search say where its words are looked for (Any, Process, Message, Subsystem, Category) and how they compare (Contains, Is, Begins With, Ends With, Doesn't Contain), kept across a reload; `process:`, `category:` and `message:` tokens with `-` to exclude; `console-search-journey.mjs`, `console-tools-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/459) |
| Save search | done | Save beside the scope bar keeps the search as a button; `console-columns-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/75) |

## Scope bar

| Item | Status | Note |
| --- | --- | --- |
| All Messages | done | `console-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/174) |
| Errors and Faults | done | `console-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/175) |

## Sidebar

| Item | Status | Note |
| --- | --- | --- |
| Device `macalicious-desktop` | done | `console-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/174) |
| Crash, Spin, Log, Diagnostic, Mac Analytics, system.log | done | Empty, and the table says why; `console-depth-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/1) |
| This page's own errors as a source | done | Under the device as process This Page, `error` and `unhandledrejection` since Console's code loaded, the newest 200, listed after the server's messages and shown also while the log cannot be read; `console-outage-journey.mjs`, `console-tools-journey.mjs`, [in the log](#project-artifact/art_a7e016210b9b9bc1/10), [with the log out](#project-artifact/art_a7e016210b9b9bc1/6) |
| Log files of the drive | done | Kept for the account with the choice of one, and dropped when the file goes; `console-files-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/72) |

## Message table and detail

| Item | Status | Note |
| --- | --- | --- |
| Column sort | done | `console-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/181) |
| Now lets go on scroll | done | `console-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/177) |
| Detail pane with Details | done | [shot](#project-artifact/art_4534e22d1233cad7/1) |
| PID, Thread and Activity | done | The log records none, and Details says so; `console-depth-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/1) |
| Choose columns (Subsystem, Category, PID…) | done | Type, Time, Process, Subsystem and Category, kept for the account; PID, Thread and Activity have no column, as the log records none; `console-columns-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/73) |

## Context menus

| Item | Status | Note |
| --- | --- | --- |
| Message row (Copy, Show or Hide Process, Category) | done | Copy, Show Process, Hide Process and Show Category; `console-tools-journey.mjs`, `console-columns-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/74) |
| Column header | done | The table's menu, its header included, has Columns; `console-columns-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/74) |
| Report in the sidebar | done | A log file's row: Reveal in Finder, Move to Trash, Remove from Sidebar; `console-files-journey.mjs`, [Reveal's result](#project-artifact/art_a7e016210b9b9bc1/68) |

## Keyboard

| Item | Status | Note |
| --- | --- | --- |
| Arrow keys in the table | done | `console-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/179) |
| ⌘W ⌘M ⌘H ⌥⌘H ⌘Q | done | From the desktop; ⌥⌘H only through its row; `system-apps-shell-journey.mjs`, [after ⌘Q](#project-artifact/art_a7e016210b9b9bc1/192) |
| ⌘F | done | Off Apple platforms Control stands for Command; `console-depth-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/1) |
| ⌘K Clear | done | `console-depth-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/1) |
| ⌘R Reload | done | `console-depth-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/1) |
| ⌘I Get Info | done | `console-depth-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/1) |
| ⌘C Copy | done | Selected text keeps it first; `console-depth-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/1) |

## Multi-selection

| Item | Status | Note |
| --- | --- | --- |
| Select several messages and copy | done | The detail pane counts them; Share still takes the first; [shot](#project-artifact/art_4534e22d1233cad7/1) |

## Drag and drop

| Item | Status | Note |
| --- | --- | --- |
| Drop a log file on the window | done | From Finder; `console-files-journey.mjs`, [the drag](#project-artifact/art_a7e016210b9b9bc1/69) |

## Saved state

| Item | Status | Note |
| --- | --- | --- |
| Log kept 24 hours on the server | done | Read back for 23 hours and gone after a day, on a clock the test moves; `tests/console_log_ttl.rs` |
| Source, scope, Info and sidebar width across a reload | done | `console-layout-journey.mjs`, [shot](#project-artifact/art_4534e22d1233cad7/2) |
| Search and Now across a reload | done | Kept for the account, up to 200 characters of search; `console-rows-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/184) |
| Saved searches | done | Kept for the account; a press searches again, and its menu removes it; `console-columns-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/75) |

## Cross-app

| Item | Status | Note |
| --- | --- | --- |
| Open a `.log` file from Finder in Console | done | A double click opens a `.log`, `.crash`, `.ips`, `.diag` or `.spin` here; TextEdit stays under Open With; `console-files-journey.mjs` |
| Open from Activity Monitor | done | Show in Console, in its View and row menus: Console comes forward searching for that process, also when it was already open; `activity-monitor-columns-journey.mjs`, [shot](#project-artifact/art_a7e016210b9b9bc1/269) |

## Build items, most-used first

1. **Keys and menus.** ⌘F, ⌘K, ⌘R, ⌘I, ⌘C; Edit items; Help to Help Viewer; sidebar in View.
2. **Selection and row menu.** Multi-select, Copy, contextual menu, Show or Hide Process.
3. **Search.** Tokens, Any or Contains, saved searches, Include Info and Debug.
4. **Saved state.** Source, scope, search, layout per account.
5. **Sources.** This page's errors, drive log files, statements for empty reports and the unrecorded PID, Thread and Activity.
6. **Share.** Through the shared share sheet once the integration worker lands it.
7. **Files.** Open, Save a Copy, Reveal, Trash, drop, and opening from Finder.
8. **Columns.** Chooser and header menu.
