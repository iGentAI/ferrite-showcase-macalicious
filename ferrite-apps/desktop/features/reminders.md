# Feature inventory: Reminders

Read from GitHub, main commit `e62c2ac9`. Nothing was built or run for this inventory, and the shared tree was not read.

**Status.** `missing`: main has nothing for it. `partial`: main has some of it, and the note says what is absent. `built-unchecked`: main's code has it, and nobody has checked it in a browser for this inventory. No row says done. A row becomes done only with a screenshot of it working in the running app.

**Source of the real app's list.** The menu items and shortcuts are written from knowledge of Reminders on macOS 10.15. They were not checked on a Mac, or against the reference screenshots, because the tree is stale. Fix a wrong row when it is found.

**Files read.** `demos/reminders/`: `app.ts`, `reminders.mdx` (without its token table), and `reminders.tsx` for its menus, keys and context menus. `demos/desktop/desktop-menus.tsx`. Also the desktop README and the open work ledger. `reminders-info.tsx`, `reminders-list-info.tsx` and `reminders-share.tsx` were not read; their rows rest on `reminders.mdx`.

**How the menu bar works.** `app.ts` names six menus. Reminders registers File (New Reminder, New List) and View (Show Completed, Show Info); the rest are the desktop's.

## Counts

| Section | Rows | done | built-unchecked | partial | not-in-10.15 |
| --- | --- | --- | --- | --- | --- |
| Reminders menu | 8 | 5 | 3 | 0 | 0 |
| File menu | 8 | 7 | 1 | 0 | 0 |
| Edit menu | 19 | 14 | 5 | 0 | 0 |
| View menu | 6 | 6 | 0 | 0 | 0 |
| Window menu | 6 | 5 | 1 | 0 | 0 |
| Help menu | 2 | 0 | 2 | 0 | 0 |
| Windows | 3 | 2 | 1 | 0 | 0 |
| Sidebar | 12 | 12 | 0 | 0 | 0 |
| List pane | 14 | 11 | 3 | 0 | 0 |
| Info popover | 12 | 9 | 3 | 0 | 0 |
| Alerts | 4 | 3 | 1 | 0 | 0 |
| Context menus | 3 | 3 | 0 | 0 | 0 |
| Keyboard | 7 | 7 | 0 | 0 | 0 |
| Drag and drop | 9 | 5 | 4 | 0 | 0 |
| Multi-selection | 3 | 3 | 0 | 0 | 0 |
| Saved state | 5 | 4 | 1 | 0 | 0 |
| Ledger and docs | 2 | 0 | 2 | 0 | 0 |
| Cross-app | 12 | 2 | 9 | 0 | 1 |
| **Total** | **135** | **98** | **36** | **0** | **1** |

## Menus

### Reminders menu

| Item | Status | Note |
| --- | --- | --- |
| About Reminders | done | [The window](#project-artifact/art_0ec4ebf78af349f9/160). Desktop's item. `reminders-rows-journey`. |
| Hide Reminders ⌘H | done | Item and key, read from the window's state; [same run](#project-artifact/art_0ec4ebf78af349f9/165). `reminders-rows-journey`. |
| Hide Others ⌥⌘H | done | [Other windows gone](#project-artifact/art_0ec4ebf78af349f9/165). The item driven here; the key on the same menu in `calendar-rows-journey`. `reminders-rows-journey`. |
| Show All | done | [Same run](#project-artifact/art_0ec4ebf78af349f9/165). `reminders-rows-journey`. |
| Quit Reminders ⌘Q | done | Item and key close its windows; [same run](#project-artifact/art_0ec4ebf78af349f9/165). `reminders-rows-journey`. |
| Services | built-unchecked | Not a fixed dimmed row any more: the desktop's `ServicesItems`, with "No Services Apply" dimmed and its reason until text is selected (`desktop-menus.tsx`, `desktop-menu-reasons.test.tsx`). Not driven in a browser for Reminders. |
| Preferences… ⌘, | built-unchecked | [The window](#project-artifact/art_0ec4ebf78af349f9/53). Default List as before. Today Notification now works: a checkbox and a minute, kept with the person's settings; while a window is open, from that minute on a banner says the reminder due today or how many, with Close and Show, once a day (`reminders-rows.test.tsx`, `reminders-kept.test.ts`). It starts off, where a Mac starts it on at 9:00, so no banner comes unasked. |
| Accounts… | built-unchecked | Opens System Preferences on Internet Accounts (`reminders-rows.test.tsx`). |

### File menu

| Item | Status | Note |
| --- | --- | --- |
| Close Window ⌘W | done | Item and key, read from the page; [the window](#project-artifact/art_0ec4ebf78af349f9/172). `reminders-rows-journey`. |
| New Reminder ⌘N | done | [Screenshot](#project-artifact/art_193e88d1bee786c4/10), key checked in `reminders-commands-journey`. A browser may keep Ctrl-N for itself. |
| New List ⇧⌘N | done | Item and key, read from the server. [After them](#project-artifact/art_0ec4ebf78af349f9/167). `reminders-rows-journey`. |
| Share List… | built-unchecked | In File as well as the list's context menu, for the list shown; Show People… for someone else's list. Dimmed, with why, for a person who cannot share (`reminders-rows.test.tsx`). |
| New Group | done | [A group with its list](#project-artifact/art_0ec4ebf78af349f9/14). Item, with the name ready to type; `reminders-groups-journey`. No key, as the real app has none. |
| Import… | done | [File menu](#project-artifact/art_0ec4ebf78af349f9/53). An `.ics` file's VTODOs go in the list shown: title, notes, address, due day and minute, whether done, priority. A repeat, alert and flag stay behind. `reminders-file-menu-journey`. |
| Export | done | The list shown, or the view from a smart list, as an `.ics` of VTODOs Import reads back. Same journey. |
| Print… ⌘P | done | The view shown, with its reminders; the page handed to the browser read. The dialog itself is unchecked. [The view](#project-artifact/art_0ec4ebf78af349f9/164). `reminders-rows-journey`. |

### Edit menu

Dimmed desktop rows, "Reminders adds no Edit commands".

| Item | Status | Note |
| --- | --- | --- |
| Delete | done | Item checked in the journey. |
| Complete | done | Item, Mark as Completed, checked in the journey. |
| Flag ⇧⌘F | done | Key checked in the journey. |
| Priority submenu | done | Checked after a reload in the journey. |
| Add Date | done | Today and Tomorrow; Tomorrow checked after a reload in the journey. |
| Find ⌘F | done | Key checked in the journey. |
| Undo ⌘Z | done | Key driven, read from the server. Every change of the window is a step; typing in the info popover is one step for that reminder. In a text field the keys stay the field's. Only this window's history, gone on a reload. [Same run](#project-artifact/art_0ec4ebf78af349f9/164). `reminders-rows-journey`. |
| Redo ⇧⌘Z | done | Item driven. [Same run](#project-artifact/art_0ec4ebf78af349f9/164). `reminders-rows-journey`. |
| Cut ⌘X | done | Item and key driven, read from the server. [Same run](#project-artifact/art_0ec4ebf78af349f9/164). `reminders-rows-journey`. |
| Copy ⌘C | done | Key driven; the titles read from the system clipboard. A parent is copied with its sub-reminders (not driven here). [Same run](#project-artifact/art_0ec4ebf78af349f9/164). `reminders-rows-journey`. |
| Paste ⌘V | done | Key driven, read from the server. Text from elsewhere becomes a reminder per line (unit logic only, not driven: the browser asks permission to read it, and without it the page's own copy is used). [Same run](#project-artifact/art_0ec4ebf78af349f9/164). `reminders-rows-journey`. |
| Select All ⌘A | done | [Every row selected](#project-artifact/art_0ec4ebf78af349f9/164). `reminders-rows-journey`. |
| Indent ⌘] | done | [Three under Ant](#project-artifact/art_0ec4ebf78af349f9/16). Item and key driven in `reminders-subtasks-journey`, read from the server. Not in Scheduled or a search. |
| Outdent ⌘[ | done | Same run. Item and key driven in the journey. |
| Spelling and Grammar | built-unchecked | Show Spelling goes through the selected reminder's title and notes in the desktop's panel, and Change saves. Check Document Now opens the panel, because a press on the menu bar ends a field's edit, so no word can be selected in view. Check Spelling While Typing is kept and sets the browser's checker on the title and notes fields. Dimmed without a selection. Grammar and Correct Automatically are the shared menu's dimmed rows, with reasons (`reminders-rows.test.tsx`). |
| Substitutions | built-unchecked | Show Substitutions and Replace All on the selected reminder's title and notes; Smart Quotes and Smart Dashes as they are typed in those fields (`reminders-rows.test.tsx`). The menu's other checks act in rich text only, and Reminders' fields have none. |
| Speech | built-unchecked | Start Speaking says the titles of the selected reminders with the browser's voice; Stop Speaking. Dimmed with why where the browser has none (`reminders-rows.test.tsx`). |
| Start Dictation | built-unchecked | The desktop's Edit footer: types what the browser's recognizer hears at the insertion point, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer. |
| Emoji & Symbols | built-unchecked | The desktop's Edit footer (`desktop-menus.tsx`). |

### View menu

| Item | Status | Note |
| --- | --- | --- |
| Show Completed | done | [Shown again](#project-artifact/art_0ec4ebf78af349f9/178), and hidden. Key not bound. `reminders-rows-journey`. |
| Show Info ⌘I | done | [The popover](#project-artifact/art_0ec4ebf78af349f9/166). Item and key. `reminders-rows-journey`. |
| Enter Full Screen ⌃⌘F | done | The item fills the screen, and Exit brings back its size, read from the window's frame. The key names Control and Command, which match only on Apple platforms, so it was not pressed. [The window](#project-artifact/art_0ec4ebf78af349f9/176). `reminders-rows-journey`. |
| Today, Scheduled, All, Flagged with keys | done | [View with Sort By](#project-artifact/art_193e88d1bee786c4/25). Items and ⌘1 to ⌘4; ⌘3 and ⌘4 driven in `reminders-view-journey`. |
| Show or Hide Sidebar | done | Item and ⌃⌘S; the list fills the window, kept with the person's settings, after a reload in `reminders-file-menu-journey`. |
| Sort By submenu (Manual, Due Date, Creation Date, Priority, Title) | done | [The submenu](#project-artifact/art_0ec4ebf78af349f9/91). Each orders the list. Creation Date is oldest first: a reminder keeps when it was made, and one made before it kept that counts as oldest. Manual is the order they were made in, unless dragged. `reminders-rows-journey`. |

### Window menu

| Item | Status | Note |
| --- | --- | --- |
| Minimize ⌘M | done | [In the Dock](#project-artifact/art_0ec4ebf78af349f9/171). Item and key. `reminders-rows-journey`. |
| Zoom | done | [Zoomed](#project-artifact/art_0ec4ebf78af349f9/176), and again brings back its frame. `reminders-rows-journey`. |
| Bring All to Front | done | The main window and Preferences come back above Calculator, read from their stacking order, after a press on the main window makes Reminders the active app. `reminders-rows-journey`. No screenshot of its own: the order is the result. |
| Open windows list | done | [Both windows](#project-artifact/art_0ec4ebf78af349f9/177); a row brings its window forward. `reminders-rows-journey`. |
| Tile Window | built-unchecked | Shared desktop menu, Tile Window to Left and Right of Screen (`desktop-menus.tsx`). |
| Reminders ⌘0 | done | [The menu](#project-artifact/art_0ec4ebf78af349f9/177). Item and key bring it forward from Preferences. `reminders-rows-journey`. |

### Help menu

| Item | Status | Note |
| --- | --- | --- |
| Reminders Help | built-unchecked | Stale row: with Help Viewer on the desktop the menu has Help Viewer's commands (`desktop-menus.tsx`, `help-menu-search.tsx`). The dimmed row is only for a desktop without it. Not driven for Reminders. |
| Search field | built-unchecked | Stale row: `HelpMenuSearch`, which finds the rows of the app's own menus. Not driven for Reminders. |

## Windows and views

### Windows

| Item | Status | Note |
| --- | --- | --- |
| Main window | built-unchecked | [After a reload](#project-artifact/art_0ec4ebf78af349f9/172) it comes back by itself and a row can be selected. The defect of New Reminder with All sorted by Title showing no field: a reminder with no title sorted first while the window scrolled to the end, so its row was not rendered. It now stays last in every sort (`reminders-sort.test.ts`). |
| Info popover | done | [The popover](#project-artifact/art_0ec4ebf78af349f9/166). `reminders-rows-journey`. |
| A list in its own window | done | [iMac Colors over the main window](#project-artifact/art_0ec4ebf78af349f9/76). File > Open List in New Window, the list's menu or a double click on its row. Add, complete and retitle there, saved as any other. Own lists only: a shared list stays in the main window. Windows do not come back after a reload. `reminders-window-journey`. |

### Sidebar

| Item | Status | Note |
| --- | --- | --- |
| Search field | done | [By its title](#project-artifact/art_0ec4ebf78af349f9/174). Title and notes in every list; other words find none. `reminders-rows-journey`. |
| Today tile | done | Lists what is due today and not tomorrow's. [The tiles](#project-artifact/art_0ec4ebf78af349f9/173). `reminders-rows-journey`. |
| Scheduled tile | done | [Scheduled](#project-artifact/art_0ec4ebf78af349f9/173). `reminders-rows-journey`. |
| All tile | done | Every reminder to do. [The tiles](#project-artifact/art_0ec4ebf78af349f9/173). `reminders-rows-journey`. |
| Flagged tile | done | The flagged ones. [The tiles](#project-artifact/art_0ec4ebf78af349f9/173). `reminders-rows-journey`. |
| My Lists rows | done | [The list](#project-artifact/art_0ec4ebf78af349f9/172). `reminders-rows-journey`. |
| Count badges | done | Adding a reminder in a list raises that list's number and the All tile's, read from the window; [the list in the sidebar](#project-artifact/art_0ec4ebf78af349f9/170). `reminders-rows-journey`. |
| Add List | done | A new list, read from the server. [The list's menu](#project-artifact/art_0ec4ebf78af349f9/169). `reminders-rows-journey`. |
| List info: name, colour | done | [The sheet](#project-artifact/art_0ec4ebf78af349f9/168), read from the server. `reminders-rows-journey`. |
| Shared section | done | [Anna's window](#project-artifact/art_0ec4ebf78af349f9/175). Served desktop. `reminders-rows-journey`. |
| Groups of lists | done | [A group with its list](#project-artifact/art_0ec4ebf78af349f9/14). Rows with a triangle, collapse kept with the person's settings, a group's reminders shown when it is chosen. On the server as `groups` and a list's `groupId`. `reminders-groups-journey`, reloaded. A group with no lists can be dragged among the rows and stands before the list it names (`before`), driven in the journey and after a reload. |
| Reordering lists | done | Drag to a row's edge, read from the server. [The list's run](#project-artifact/art_0ec4ebf78af349f9/163). `reminders-rows-journey`. |

### List pane

| Item | Status | Note |
| --- | --- | --- |
| Title and count | done | [The list](#project-artifact/art_0ec4ebf78af349f9/170). `reminders-rows-journey`. |
| Plus | done | [The list](#project-artifact/art_0ec4ebf78af349f9/170), read from the server. `reminders-rows-journey`. |
| Rows with separators | built-unchecked | [The list](#project-artifact/art_0ec4ebf78af349f9/170): one row a reminder, read by the journey. The line is measured from the screenshot's pixels: one point under a row, from the text on, none in the gutter. `calendar-reminders-batch4-journey`. |
| Circle completes | done | Read from the server. [Same run](#project-artifact/art_0ec4ebf78af349f9/178). `reminders-rows-journey`. |
| A completed row stays until another list is shown | done | Read from the page. [Same run](#project-artifact/art_0ec4ebf78af349f9/178). `reminders-rows-journey`. |
| Priority marks | done | [!!!](#project-artifact/art_0ec4ebf78af349f9/170), read from the server. `reminders-rows-journey`. |
| Due line | done | [The row](#project-artifact/art_0ec4ebf78af349f9/170). Red once past, [seen](#project-artifact/art_0ec4ebf78af349f9/161). `reminders-rows-journey`. |
| Search results name their list | done | [The row](#project-artifact/art_0ec4ebf78af349f9/174). `reminders-rows-journey`. |
| Editing a title in place | done | A double click, read from the server. [The list](#project-artifact/art_0ec4ebf78af349f9/170). `reminders-rows-journey`. |
| Dates and times read from typed words | done | "tomorrow 3pm", read from the server. [The row](#project-artifact/art_0ec4ebf78af349f9/170). `reminders-rows-journey`. |
| Picture thumbnail | built-unchecked | The real picture in a 70 pt row, kept with the person's settings (`reminders-rows.test.tsx`). A sample's picture stays a stand-in. |
| Sub-reminders | done | [Three under Ant](#project-artifact/art_0ec4ebf78af349f9/16). One level, `parentId` on the server, which refuses a parent elsewhere or a second level. Triangle in the gutter, collapse kept across a reload, a count on the parent. Completing or deleting a parent does the same to what is under it; moving it takes them along. `reminders-subtasks-journey`. |
| Dragging to reorder | done | [Moved above](#project-artifact/art_193e88d1bee786c4/51): in a list shown in Manual order; `reminders-reorder-journey` reads the order from the server and after a reload. A selection of several uses the same drop, not driven. |
| Scheduled grouped by date | built-unchecked | [Headed by day](#project-artifact/art_0ec4ebf78af349f9/12). Past Due, Today, Tomorrow, then each day by name, No Date last. A day is a heading, not an option: left out of the options' count, the keys pass it in one press and a press on it selects nothing (`ListView`'s `isRowHeading`). `e2e/list-reminders-batch6-journey.mjs`, reloaded; the screenshot linked predates the heading's role. |

### Info popover

| Item | Status | Note |
| --- | --- | --- |
| Title | done | [The popover](#project-artifact/art_0ec4ebf78af349f9/166). `reminders-rows-journey`. |
| Flag | done | [Pressed](#project-artifact/art_0ec4ebf78af349f9/166), read from the server. `reminders-rows-journey`. |
| Notes | done | [The popover](#project-artifact/art_0ec4ebf78af349f9/166), read from the server. `reminders-rows-journey`. |
| On a Day | done | [The popover](#project-artifact/art_0ec4ebf78af349f9/166), read from the server. `reminders-rows-journey`. |
| At a Time | done | [The popover](#project-artifact/art_0ec4ebf78af349f9/166), read from the server. `reminders-rows-journey`. |
| End Repeat | done | [On Date](#project-artifact/art_0ec4ebf78af349f9/166), and Never, read from the server. `reminders-rows-journey`. |
| Priority | done | [The popover](#project-artifact/art_0ec4ebf78af349f9/166), read from the server. `reminders-rows-journey`. |
| URL | done | Kept, read from the server. [The popover](#project-artifact/art_0ec4ebf78af349f9/166). `reminders-rows-journey`. |
| Repeat | done | [Custom](#project-artifact/art_0ec4ebf78af349f9/50) as well as Every Day, Weekday, Week, 2 Weeks, Month, Year: every so many days, weeks, months or years, weeks on chosen days; read from the server and after a reload in `reminders-custom-repeat-journey`. Absent: "on the first Monday" for months, and several months in a year. |
| At a Location | built-unchecked | Asks for the place and Arriving or Leaving, kept with the person's settings, and Show in Maps searches for it in Maps; dimmed with why outside a desktop. Maps' geocoder finds the place and the browser's position is held against it within 200 m while the window is open: crossing raises the alert, closing keeps it closed, Complete finishes the reminder, and a reload loses none of it. A first position raises nothing. Driven with Playwright's emulated position and a stand-in for `/api/maps/search`, so the real geocoder and a device's real position were not used. No alert comes with the window closed, since a page does not run then. `reminders-rows.test.tsx`, `calendar-reminders-batch4-journey`. |
| When Messaging a Person | built-unchecked | Chooses someone from Contacts who has an account on the desktop, kept with the person's settings; opening a conversation with them in Messages raises the alert, once (`reminders-messaging.test.ts`). Not driven in a browser. |
| Images | built-unchecked | Add Image… takes a real picture from the browser's chooser, made small and kept with the person's settings; the pop-up lists them with Remove Image; a file that is no picture is refused with why (`reminders-rows.test.tsx`). At most about 64 KB of pictures a reminder, which says so when full. |

### Alerts

| Item | Status | Note |
| --- | --- | --- |
| Alert at the due minute | done | [The alert](#project-artifact/art_0ec4ebf78af349f9/161), about two seconds after the minute, by the real clock. `reminders-rows-journey`. |
| Close and Complete on the alert | done | [The alert](#project-artifact/art_0ec4ebf78af349f9/161). Close read from the server's dismissal, Complete from the reminder. `reminders-rows-journey`. |
| Reminders of a shared list | built-unchecked | The window raises them itself while it is open, from the due instant for a day, with Close and Complete; one closed stays closed, kept with the person's settings (`reminders-rows.test.tsx`, `reminders-kept.test.ts`). With no window open none comes, as the server arms only a person's own. |
| Early reminder | done | [In the info popover of a reminder with a time](#project-artifact/art_0ec4ebf78af349f9/60): 5 minutes to a day before. The alert the server arms moves that much, read from the request; the choice is kept across a reload. A fired alert at that instant was not waited for. `reminders-early-journey`. |

## Context menus

| Item | Status | Note |
| --- | --- | --- |
| List row | done | [Its menu](#project-artifact/art_0ec4ebf78af349f9/169): Show Info, Delete, Share List… or Show People…. Delete asks, then the list is gone from the server. `reminders-rows-journey`. |
| Reminder row (Complete, Flag, Priority, Date, Move to List, Show Info, Delete) | done | [Menu over two reminders](#project-artifact/art_193e88d1bee786c4/19), `reminders-many-journey`. Cut, Copy, Paste, Indent and Outdent added since, by the same items as the Edit menu; their rows are in that menu. |
| Sidebar blank (New List, New Group) | done | [The menu](#project-artifact/art_0ec4ebf78af349f9/27). Driven in `reminders-groups-journey`; offers no list's commands any more. A group's row offers Rename, Ungroup and Delete; Ungroup driven, Rename and Delete not. |

## Keyboard

| Item | Status | Note |
| --- | --- | --- |
| Space completes | done | And again takes it back, read from the server. [Same run](#project-artifact/art_0ec4ebf78af349f9/167). `reminders-rows-journey`. |
| Return edits | done | [Same run](#project-artifact/art_0ec4ebf78af349f9/170). `reminders-rows-journey`. |
| Delete and Backspace remove | done | Each read from the server. [Same run](#project-artifact/art_0ec4ebf78af349f9/167). `reminders-rows-journey`. |
| ⌘I Show Info | done | [The popover](#project-artifact/art_0ec4ebf78af349f9/166). `reminders-rows-journey`. |
| Arrow keys in the list | done | [Same run](#project-artifact/art_0ec4ebf78af349f9/167). `reminders-rows-journey`. |
| Return and Escape while editing | done | Read from the server. [Same run](#project-artifact/art_0ec4ebf78af349f9/170). `reminders-rows-journey`. |
| The menu items' keys above (⌘N, ⇧⌘N, ⌘F, ⇧⌘F, ⌘A) | done | [After them](#project-artifact/art_0ec4ebf78af349f9/167), each read back. `reminders-rows-journey`. |

## Drag and drop

Nothing in Reminders takes or starts a drag. The shared drag between apps belongs to the Finder and desktop integration worker.

| Item | Status | Note |
| --- | --- | --- |
| Reminder onto another list | done | [Three moved](#project-artifact/art_193e88d1bee786c4/47): onto one of the person's own lists, with a selection of several; a shared list's stay. `reminders-drag-journey` reads the list from the server and after a reload. |
| Reordering reminders | done | As Dragging to reorder. |
| Reminder onto another to make a sub-reminder | done | [Under its parent](#project-artifact/art_0ec4ebf78af349f9/163), read from the server. `reminders-rows-journey`. |
| Reordering lists | done | As in the sidebar. `reminders-rows-journey`. [Same run](#project-artifact/art_0ec4ebf78af349f9/163). |
| List into a group | done | Read from the server. [The list's run](#project-artifact/art_0ec4ebf78af349f9/163). `reminders-rows-journey`. |
| Picture onto a reminder | built-unchecked | A picture dropped on a row is attached to that reminder; another kind of file is left (`reminders-rows.test.tsx`). |
| File from Finder onto a reminder | built-unchecked | A picture file from the operating system goes as above, and one from Finder or the desktop through the desktop's drag: `e2e/desktop-into-apps-journey.mjs`. Another kind of file is refused, saying why. |
| Link from Safari onto a list | built-unchecked | A reminder in that list, titled by the link, with its address (`reminders-rows.test.tsx`). |
| Message from Mail onto a list | built-unchecked | A reminder per message in that list, titled by its subject, with who sent it in the notes (`reminders-rows.test.tsx`). No link back to the message. |

## Multi-selection

| Item | Status | Note |
| --- | --- | --- |
| Several reminders | done | Command-click and Shift-click; `reminders-many-journey`. |
| Select All | done | Key checked in the journey. |
| Complete, delete or move several | done | Checked after a reload in the journey. Moving is offered between the person's own lists only. |

## Saved state

| Item | Status | Note |
| --- | --- | --- |
| Lists and reminders | done | [After a reload](#project-artifact/art_0ec4ebf78af349f9/172), read from `/api/reminders/data`. `reminders-rows-journey`. The ids of recent writes rest on `tests/document_writes.rs`. |
| Dismissed alerts | done | After a reload and the next poll they do not come back, read from the server. [The window after it](#project-artifact/art_0ec4ebf78af349f9/172). `reminders-rows-journey`. |
| Shared lists | done | [Anna's window](#project-artifact/art_0ec4ebf78af349f9/175). Read from the server by both, after a reload. The merge per reminder has `reminders-sharing-journey`. `reminders-rows-journey`. |
| Unsaved dot when the application refuses | built-unchecked | |
| List shown, Show Completed, sort | done | [After a reload](#project-artifact/art_0ec4ebf78af349f9/172), read from the server. A list that arrives late, as a shared one does, has only code behind it. `reminders-rows-journey`. |

## Ledger and docs

| Item | Status | Note |
| --- | --- | --- |
| Reminders due-time journey | built-unchecked | Ledger: done, `c115f5dd` and `0d0e0d22`. Not rerun here. |
| `reminders.mdx` says lists cannot be renamed, removed or shared | built-unchecked | Fidelity lines corrected. |

## Cross-app

| Item | Status | Note |
| --- | --- | --- |
| Siri creates a reminder | built-unchecked | Project decision records it. |
| Spotlight finds to-dos | done | Not completed ones. Choosing one shows its list with it selected: `spotlight-items-journey`, [screenshot](#project-artifact/art_193e88d1bee786c4/37). |
| Alerts in Notification Center | built-unchecked | With no Reminders window open a fired alert comes through Notification Center, within about ten seconds: Close and Complete kept on the server, Show in place of Complete on a reminder that repeats, none raised twice. With a window open the window alone shows it, though a notification can show for up to five seconds before the window's next read takes it back. `e2e/list-reminders-batch6-journey.mjs`, with Close and Complete read from the server after a reload. A shared list's alerts, the Today notification and At a Location stay the window's: the server arms none of them. Clear Reminders dismisses with Reminders' own route. |
| Links shared into Reminders | built-unchecked | `reminders-share-link.test.tsx` and `reminders-share-journey`; neither read. |
| When Messaging a Person in Messages | built-unchecked | As When Messaging a Person. |
| Message from Mail becomes a reminder | built-unchecked | As Message from Mail onto a list. |
| At a Location with Maps | built-unchecked | Show in Maps searches for the place (`reminders-rows.test.tsx`). Maps shows no reminder's place by itself. |
| Scheduled reminders in Calendar | not-in-10.15 | Calendar on 10.15 lists no reminders; they came back in a later macOS. Nothing is built, so Calendar here stays as Catalina's is. Written from knowledge of the app, not checked on a Mac. |
| Dock badge of overdue reminders | built-unchecked | The tile counts reminders due before today, or the app's notifications if those are more; read when the desktop opens, each minute, and when they change in another browser. `desktop-dock-life.test.ts`. |
| Dock icon menu | done | [After it](#project-artifact/art_0ec4ebf78af349f9/162). New Reminder, while the window is open, read from the server. `reminders-rows-journey`. |
| Today widget | built-unchecked | Stale row: Notification Center's Today tab has a Reminders widget, due today or overdue (`desktop-notifications.tsx`, `dueRemindersFromServer`). Not driven here. |
| Choosing a person from Contacts | built-unchecked | As When Messaging a Person. Only cards that name a desktop account are offered, as only those can be messaged here. |

## Calls made

- **The rows closed in the latest batch say `built-unchecked`** because no screenshot of them is published. A scratch journey drove these in Chromium against the served desktop: New Reminder in All by Title, smart quotes in a title, Change in the Spelling panel read from the server, Start Speaking, Add Image… and a dropped picture drawn and back after a reload, a place kept and Show in Maps, a link and a message dropped on a list read from the server, Accounts…, File > Share List…, and Today Notification after a reload. The drops were real `DataTransfer` events sent from the page, not a pointer drag. Not driven in a browser: the Today banner and a shared list's alert, which rest on the unit tests.
- **Location alerts use the browser's position.** The browser asks the person once a reminder has a place, and the alert comes only while the window is open: see At a Location.
- **A place, a person and pictures live in the person's desktop values**, not on the reminder: the server's reminder has no field for them and refuses unknown ones, and that module is outside this app's files. So they follow the account, not a shared list's members.
- **A parent's triangle goes before its circle.** Written from knowledge of the app, not checked on a Mac or a capture; tokens tagged provisional.
- **Changes of two windows that would nest deeper than one level** are settled when merged, saved and drawn: the reminder deepest down stands on its own, and none is lost.
- **Reminders in Calendar.** Calendar on 10.15 no longer lists reminders, so the row says not-in-10.15 and nothing is built.

## Build items, most-used first

Each lands as small reviewed commits. Each row changes to done only with a browser screenshot.

1. **Reminder commands with keys.** ⌘N, ⇧⌘N, ⌘F, and Edit's Delete, Complete, Flag, Priority, Add Date.
2. **Multi-selection.** Several reminders; complete, delete and move them together; Select All.
3. **Context menus.** Reminder row and sidebar blank.
4. **Drag.** Reminder onto a list, reorder reminders, reorder lists. Needs a stored order.
5. **Sub-reminders.** Indent, Outdent, drag onto another, collapse.
6. **Groups of lists.** New Group, drag into a group.
7. **Sorting and Scheduled.** Sort By, Scheduled grouped by date, saved list and sort.
8. **Cut, Copy, Paste, Undo and Redo.**
9. **Repeat and alerts.** Custom repeat, early reminder, alerts for shared lists.
10. **Preferences and pictures.** The Preferences window; real images, stored; variable row height, which `ListView` now takes.
11. **Cross-app.** People from Contacts, When Messaging in Messages, Mail onto a list, Safari links, Finder files, Dock badge, Maps.
12. **Remaining items.** Print, Import, Export, a list in its own window, the stale `mdx` lines, Spelling and the other Edit submenus. Items a browser cannot do are shown dimmed with a reason.
