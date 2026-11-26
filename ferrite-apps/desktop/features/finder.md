# Feature inventory: Finder

Main commit read: `e62c2ac9` (29 October 2026), from GitHub only. Nothing was run. The tree and the sandbox were not touched.

Hosted check on the live site, built from main `849cf255`: `e2e/finder-files-journey.mjs` 20 of 20, `e2e/finder-slideshow-journey.mjs` 16 of 16.

Sources read: `demos/finder/app.ts`, `finder.tsx`, `finder-views.tsx`, `finder-drag.ts`, `finder-open.ts`, `finder.mdx`; `demos/desktop/desktop-menus.tsx`, `desktop.tsx`; `ferrite-apps/desktop/e2e/finder-census-journey.mjs`; `src/components/icon-view/icon-view.tsx`. The list of what the real app has comes from knowledge of macOS 10.15, not checked against Apple's documents in this pass.

Status key:

- **missing**: main has nothing that does it. A note "dim with reason" means a browser cannot do it, so the deliverable is a dimmed row that says why.
- **partial**: main has part of it. The note says what is absent.
- **built-unchecked**: main's code has it, and often a census journey row. Not seen running for this inventory. Nothing is done until it is checked in a browser with a screenshot.

⌘ means Command on Apple platforms and Control elsewhere (`macalicious/lib/menu-key-commands`). The served desktop's Finder shows the person's drive. The in-memory tree is the docs demo only.

**Counts: 221 rows: 202 done, 15 built-unchecked, 3 partial, 1 missing.**

Finder's commands are in its menu bar through `useDesktopAppMenu` (`finder-menus.tsx`) as well as its toolbar's Action menu. The Action menu's rows stay as they were while it fades after closing, so a command that changes the selection does not resize the closing menu (`e2e/finder-census-journey.mjs` in WebKit: 177 of 177 ids, no ResizeObserver page error, 0 page problems, `finder.action.move-here` and `finder.kb.move-here` pass).

## Finder menu (8: 8 done)

| Item | Status | Main |
| --- | --- | --- |
| About Finder | done | [The About window](#project-artifact/art_a7e016210b9b9bc1/380): `e2e/finder-drive-journey.mjs` |
| Preferences… ⌘, | done | [The window](#project-artifact/art_819e645e9197a100/20), from the row. `e2e/finder-preferences-journey.mjs` |
| Empty Trash… ⇧⌘⌫ | done | [The key asks](#project-artifact/art_a7e016210b9b9bc1/389), and Cancel empties nothing, read back: `e2e/finder-drive-journey.mjs`. Dimmed with "No Finder window is open" without one |
| Empty Trash without asking ⌥⇧⌘⌫ | done | [With Option held the row is Empty Trash](#project-artifact/art_a7e016210b9b9bc1/374): `e2e/finder-more-journey.mjs`. Its key empties with no question: `finder.test.tsx`, on a tree of its own, since it cannot be undone on an account. Preferences also turns the warning off |
| Services ▸ | done | [Look Up, Search the Web, Open URL on selected text](#project-artifact/art_a8d16e1712d88efa/1); No Services Apply with nothing selected. Notes, Mail and Stickies rows appear when they say `takesSharedText` |
| Hide Finder ⌘H | done | Minimizes to the Dock. `e2e/finder-rows-journey.mjs` |
| Hide Others ⌥⌘H | done | Calculator goes to the Dock, same journey |
| Show All | done | Calculator comes back, same journey |

## File menu (26: 26 done)

| Item | Status | Main |
| --- | --- | --- |
| New Finder Window ⌘N | done | [The File menu](#project-artifact/art_a7e016210b9b9bc1/328); a second window opens. `e2e/finder-rows-journey.mjs`. The key is not driven |
| New Folder ⇧⌘N | done | `e2e/finder-menus-journey.mjs`: the row makes a folder, read back from the server. A browser may keep the key for itself |
| New Folder with Selection ⌃⌘N | done | `e2e/finder-context-menu-journey.mjs` from the context menu; the File row and key share its command |
| New Smart Folder ⌥⌘N | done | Opens in a new tab with one row, on the whole disk; [the window](#project-artifact/art_819e645e9197a100/42), `e2e/finder-smart-journey.mjs`. The key was not driven. A Mac opens a new window |
| New Tab ⌘T | done | Two tabs show, same journey. ⌘T is the browser's, so it has no key; the plus button also works |
| Open ⌘O | done | [The key opens a text file in TextEdit](#project-artifact/art_a7e016210b9b9bc1/382) (the picture is of its selection): `e2e/finder-drive-journey.mjs`. All selected items by the row |
| Open With ▸ | done | [The list with its default](#project-artifact/art_a7e016210b9b9bc1/396), and Always Open With kept on the server, which opens the file there and makes it the default: `e2e/finder-rows-more-journey.mjs` |
| Print ⌘P | done | The file in a frame the browser prints from: pictures, PDFs and text, dimmed for others. The journey saw the frame; a printer's dialog cannot be driven |
| Close Window ⌘W | done | From the row, same journey |
| Close All ⌥⌘W | done | [The row while Option is held](#project-artifact/art_819e645e9197a100/34), and it closes every Finder window. `e2e/finder-tabs-journey.mjs`. Every application's File menu has it |
| Get Info ⌘I | done | [The key opens the window](#project-artifact/art_a7e016210b9b9bc1/383): `e2e/finder-drive-journey.mjs` |
| Show Inspector ⌥⌘I | done | Floats over the window and follows the selection; [with several selected it tells of them all](#project-artifact/art_819e645e9197a100/35), and Locked there locks them all, read back from the server. Same journey |
| Compress "item" | done | [A zip beside the file](#project-artifact/art_819e645e9197a100/17); its bytes read back from the server and unpacked, a folder with what it holds, Undo takes it back. `e2e/finder-files-journey.mjs`. At most 512 MB at a time, said in an alert: the browser packs it in memory |
| Duplicate ⌘D | done | From the row, read back from the server, same journey |
| Make Alias ⌃⌘A | done | [A file with an arrow that names its original](#project-artifact/art_819e645e9197a100/18). Opens the original; says so when it has gone. `e2e/finder-files-journey.mjs` |
| Quick Look ⌘Y | done | The key was not answered in the window until now. Row and key, same journey |
| Slideshow ⌥⌘Y | done | [The items selected, over the whole desktop](#project-artifact/art_819e645e9197a100/57), stepping every 3 seconds, with Pause, the arrow keys and Escape. A picture shows its own bytes. `e2e/finder-slideshow-journey.mjs` |
| Show Original ⌘R | done | Selects the original in its folder, same journey |
| Add to Sidebar ⌃⌘T | done | [Kept per account, there after a reload](#project-artifact/art_819e645e9197a100/19), and Remove from Sidebar takes it away. Same journey |
| Add to Dock ⌃⇧⌘T | done | [In File, for what is selected](#project-artifact/art_819e645e9197a100/46), `e2e/dock-kept-journey.mjs`. The key was not driven |
| Move to Trash ⌘⌫ | done | From the row, read back from the server, same journey |
| Put Back ⌘⌫ in the Trash | done | From the row, read back from the server, same journey |
| Eject ⌘E | done | Dimmed with its reason: the drive has no disks. Same journey |
| Burn to Disc | done | Dimmed with its reason, same journey |
| Find ⌘F | done | The row puts the keyboard in the search field once its menu has closed, same journey |
| Tags row and Tags… | done | [A row for each tag in File](#project-artifact/art_a7e016210b9b9bc1/328), which tags and untags what is selected, read back from the server; Tags… opens Get Info with its Tags field. `e2e/finder-rows-journey.mjs`. A coloured dot row, not the circles of a Mac |

## Edit menu (11: 11 done)

| Item | Status | Main |
| --- | --- | --- |
| Undo ⌘Z | done | [The row names the step](#project-artifact/art_819e645e9197a100/11): move, trash, put back, rename, new folder, duplicate, copy and tag, read back from the server. `e2e/finder-undo-journey.mjs`. [A step whose item has gone is refused](#project-artifact/art_819e645e9197a100/12). In a field the key is the text's. Not kept across a reload, as a Mac does not across a relaunch |
| Redo ⇧⌘Z | done | Same journey |
| Cut ⌘X | done | Dimmed with its reason for a file, same journey. Real Finder uses it for text only |
| Copy ⌘C | done | `e2e/finder-menus-journey.mjs`, with Paste, read back from the server |
| Paste ⌘V | done | Same |
| Move Item Here ⌥⌘V | done | With Option held, read back from the server, same journey. The key is not driven |
| Select All ⌘A | done | Same journey |
| Deselect All ⌥⌘A | done | Same journey |
| Show Clipboard | done | [The file copied](#project-artifact/art_819e645e9197a100/55), or text where the browser lets a page read it. `e2e/edit-footer-journey.mjs` |
| Start Dictation | built-unchecked | On every application's Edit menu: types what the browser's recognizer hears, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in a Finder search field, with a stub recognizer |
| Emoji & Symbols ⌃⌘Space | done | [The viewer, on every application's Edit menu](#project-artifact/art_819e645e9197a100/56); a character goes where the person was typing, driven in TextEdit, same journey. The key names Control and Command, so it can be typed only on a Mac; not driven. The list holds a selection of characters, not all of them |

## View menu (17: 16 done, 1 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| as Icons ⌘1 | done | `e2e/finder-menus-journey.mjs` |
| as List ⌘2 | done | Same |
| as Columns ⌘3 | done | From the row, same journey |
| as Gallery ⌘4 | done | From the row, same journey |
| Sort By ▸ | built-unchecked | [Every order the drive can answer](#project-artifact/art_819e645e9197a100/14): Name, Kind, Date Last Opened, Date Modified, Date Created, Size, Tags, the newest and largest first. Size and Name were driven; `e2e/finder-view-journey.mjs`. Date Added is dimmed with its reason: the drive keeps no arrival date, and the picture shows an earlier build's row. None and Snap to Grid are dimmed, each with its reason: this grid always keeps its order. Seen in a browser, with no picture of those two published. |
| Use Groups, Group By ▸ | done | [Sections by kind with Show All](#project-artifact/art_819e645e9197a100/54), [in the list under heading rows](#project-artifact/art_819e645e9197a100/53), kept for the folder over a reload, read back after one. `e2e/finder-groups-journey.mjs`. Selection adds across sections with Command; a marquee and the arrow keys stay inside one section |
| Clean Up, Clean Up By ▸ | done | [Clean Up By Size](#project-artifact/art_a7e016210b9b9bc1/392) puts the icons in order of size: `e2e/finder-drive-journey.mjs`. Clean Up is dimmed with its reason: icons here always keep to the grid |
| Show/Hide Sidebar ⌥⌘S | done | Row hides it and the key brings it back, `e2e/finder-menus-journey.mjs` |
| Show/Hide Preview ⇧⌘P | done | [Gallery's pane](#project-artifact/art_a7e016210b9b9bc1/384) goes and comes back by the row, kept per account: `e2e/finder-drive-journey.mjs`. Dimmed in the other views |
| Show/Hide Tab Bar ⇧⌘T | done | Shows the bar with one tab, dimmed with several. `e2e/finder-view-journey.mjs` |
| Show All Tabs ⇧⌘\ | done | [Each tab as a card](#project-artifact/art_819e645e9197a100/36), its folder's icon and name, not a picture of it; choosing one goes to it. Same journey |
| Show/Hide Path Bar ⌥⌘P | done | From the row, both ways, same journey |
| Show/Hide Status Bar ⌘/ | done | From the row, both ways, same journey |
| Show/Hide Toolbar ⌥⌘T | done | [The window without it](#project-artifact/art_819e645e9197a100/13); the row hides it and the key brings it back. Same journey |
| Customize Toolbar… | done | [The sheet, with items added, moved and labelled](#project-artifact/art_a7e016210b9b9bc1/294): an item added by a click, moved along the sheet's row by drag or the arrow keys, taken out, Icon and Text or Text Only, Use Default Set, kept per account across a reload. `e2e/finder-toolbar-journey.mjs`. [The toolbar's own context menu](#project-artifact/art_a7e016210b9b9bc1/325) sets how its items show and opens the sheet, same journey. While it is open an item dragged from the sheet straight onto the toolbar stands in the gap it was let go in, and one dragged along the toolbar moves, each read back from the server: real drags by a scratch journey in a browser, not committed. Controls in the toolbar do not press meanwhile, and the window's body is inert. An item comes off by the sheet's row, not by a drag off the toolbar. The search field stays only if kept in the row, as an item |
| Show View Options ⌘J | done | [The window](#project-artifact/art_819e645e9197a100/15), from the row; see View Options below |
| Enter Full Screen ⌃⌘F | done | [The window fills the screen](#project-artifact/art_a7e016210b9b9bc1/538), from the row, and Exit Full Screen puts it back: `e2e/finder-rows-drive-journey.mjs`. The key names Control and Command, so it can be typed only on a Mac; not driven |

## Go menu (19: 19 done)

| Item | Status | Main |
| --- | --- | --- |
| Back ⌘[ | done | [Go menu](#project-artifact/art_819e645e9197a100/1); `e2e/finder-menus-journey.mjs` |
| Forward ⌘] | done | [The Go menu](#project-artifact/art_a7e016210b9b9bc1/327). From the row, `e2e/finder-rows-journey.mjs` |
| Enclosing Folder ⌘↑ | done | From the row, same journey |
| Select Startup Disk ⇧⌘↑ | done | The computer with its disk selected, same journey |
| Recents ⇧⌘F | done | From the row, same journey |
| Documents ⇧⌘O | done | Row, `e2e/finder-menus-journey.mjs` |
| Desktop ⇧⌘D | done | Key, same journey |
| Downloads ⌥⌘L | done | Row, same journey |
| Home ⇧⌘H | done | From the row, same journey |
| Computer ⇧⌘C | done | From the row, shows the disk, same journey |
| AirDrop ⇧⌘R | done | From the row, same journey; the place itself is still the empty state |
| Network ⇧⌘K | done | [Dimmed with its reason on the drive](#project-artifact/art_819e645e9197a100/1) |
| iCloud Drive ⇧⌘I | done | Same |
| Applications ⇧⌘A | done | From the row, same journey. With no window the menu keeps its submenu of apps |
| Utilities ⇧⌘U | done | From the row, same journey |
| Library (with Option) | done | There only while Option is held; dimmed with its reason, since the drive has no Library folder. Same journey |
| Recent Folders ▸ | done | [Lists where the window has been](#project-artifact/art_a7e016210b9b9bc1/327), kept per account. Shares its list with Finder's Dock menu, [driven there](#project-artifact/art_819e645e9197a100/28) |
| Go to Folder… ⇧⌘G | done | A typed `~/Documents`, same journey |
| Connect to Server… ⌘K | done | Row and key. On the drive the window says a web page cannot reach file servers (`CONNECT_REASON`): `finder-host.test.tsx`. A browser cannot open such a connection, so that sentence is the row. Only the docs demo's in-memory network connects, and Favorite Servers are kept per account |

## Window menu (9: 9 done)

| Item | Status | Main |
| --- | --- | --- |
| Minimize ⌘M | done | [The Window menu](#project-artifact/art_a7e016210b9b9bc1/326). From the row, back from the Dock, `e2e/finder-rows-journey.mjs` |
| Zoom | done | The size changes, same journey |
| Cycle Through Windows ⌘` | done | The Window menu's row goes to the application's next window, `e2e/mission-control-journey.mjs`; ⌘` shares its command |
| Show Progress Window | done | Dimmed with its reason, same journey: progress shows in the window while it runs |
| Move Tab to New Window | done | Same journey; the new window shows the tab's folder and view |
| Merge All Windows | done | Every other window's tabs come over and those windows close. Same journey |
| Select Next/Previous Tab ⌃⇥ | done | From the rows. ⌃⇥ is the browser's, so the keys are ⇧⌘[ and ⇧⌘], which a Mac also has. Same journey |
| Bring All to Front | done | A Finder window behind Calculator comes in front of it, read from the stacking order: `e2e/finder-rows-drive-journey.mjs` |
| Window list | done | Lists the window, same journey |

## Help menu (3: 1 done, 2 partial)

| Item | Status | Main |
| --- | --- | --- |
| Help search field | done | Search field in every app's Help menu; `e2e/shell-journey.mjs` opens Help Viewer on the words |
| macOS Help | built-unchecked | Opens its own pages in Help Viewer: `e2e/help-guides-journey.mjs`. Written for this desktop, not Apple's |
| See What's New, Tips for Your Mac | built-unchecked | Open their own pages in Help Viewer: `e2e/help-guides-journey.mjs`. Written for this desktop, not Apple's |

## Toolbar (10: 10 done)

| Item | Status | Main |
| --- | --- | --- |
| Back and Forward | done | Both driven, by the window's title, the [toolbar in this picture](#project-artifact/art_a7e016210b9b9bc1/387): `e2e/finder-drive-journey.mjs` |
| View switcher | done | [List](#project-artifact/art_a7e016210b9b9bc1/381), [Gallery](#project-artifact/art_a7e016210b9b9bc1/384) and Icons: `e2e/finder-drive-journey.mjs` |
| Group pull-down | done | Sets the sections, with None; dimmed in Column and Gallery views. `e2e/finder-groups-journey.mjs` |
| Action pull-down | done | [With Open With, Compress, Make Alias, Quick Actions and Services](#project-artifact/art_a7e016210b9b9bc1/378) beside the menu bar's commands; Make Alias driven, read back from the server: `e2e/finder-more-journey.mjs` |
| Share | done | [Lists its rows](#project-artifact/art_feed73a04b7ab5a0/2): Mail and Messages share the files; AirDrop and any app that takes no file are dimmed with their reasons (`FileShareItems`). Run end to end: `e2e/mail-share-journey.mjs`, `e2e/messages-share-files-journey.mjs` |
| Tags (Edit Tags) | done | [A tag put on several from the toolbar](#project-artifact/art_a7e016210b9b9bc1/386), read back: `e2e/finder-drive-journey.mjs` |
| Search field | done | [Finds by name](#project-artifact/art_a7e016210b9b9bc1/566), and cleared it comes back to the folder: `e2e/finder-rows-keys-journey.mjs` |
| Title bar double click zooms | done | And again it comes back: `e2e/finder-rows-drive-journey.mjs` |
| Proxy icon, ⌘-click title path menu | done | [⌘-click, or a secondary click, on the title lists the folders it is in](#project-artifact/art_a7e016210b9b9bc1/373), and goes to the one chosen; the title's icon drags the folder, not the window: `e2e/finder-more-journey.mjs` |
| Optional items: Path, Eject, Burn, New Folder, Delete, Connect, Get Info, Quick Look | done | In the sheet, each doing what its menu row does; New Folder and Connect by `e2e/finder-toolbar-journey.mjs`. Path lists the folders, Get Info opens its window, Quick Look its panel, and Delete moves the item to the Trash, read back from the server: a scratch journey in a browser, not committed. Eject and Burn are dimmed with their reasons. The glyphs are original drawings, since no reference shows them |

## Sidebar (14: 13 done, 1 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| Recents | done | `e2e/finder-rows-drive-journey.mjs` |
| AirDrop | done | [Empty, saying why it finds nobody](#project-artifact/art_a7e016210b9b9bc1/398): `e2e/finder-rows-more-journey.mjs` |
| Applications | done | [Lists the applications](#project-artifact/art_a7e016210b9b9bc1/540), same journey |
| Desktop, Documents, Downloads, Movies, Music, Pictures, Home | built-unchecked | Desktop, Documents and Downloads from the sidebar: `e2e/finder-rows-drive-journey.mjs`. Movies, Music, Pictures and Home are off at first, as on a Mac, and Preferences' Sidebar pane adds them, kept per account (`finder.shownPlaces`). Pictures was added and followed in a browser by a scratch journey, not committed, with no picture published; the other three share its code |
| iCloud Drive | done | No row, as on a Mac not signed in to iCloud; [Go > iCloud Drive is dimmed with its reason](#project-artifact/art_a7e016210b9b9bc1/391): `e2e/finder-rows-journey.mjs` |
| Locations: disks and Computer | done | The startup disk and Computer on the drive, and no others: a web page has no other disks, and Preferences' External disks, CDs and Bonjour rows are dimmed with their reasons. [Sidebar pane](#project-artifact/art_a7e016210b9b9bc1/375) |
| Network | done | No row on the drive, as a web page finds no computers; [Go > Network is dimmed with its reason](#project-artifact/art_819e645e9197a100/1). The docs demo's in-memory tree has the row |
| Tags and All Tags | done | [A tag lists what has it](#project-artifact/art_a7e016210b9b9bc1/386), All Tags the tags: `e2e/finder-drive-journey.mjs` |
| Saved searches | done | In the sidebar after a reload, and the search runs again. `e2e/finder-saved-journey.mjs` |
| Drag to reorder, or add a folder to Favorites | done | A folder or a file let go on the Favorites heading or between its rows is added, and on a row goes into that place, as on a Mac. Those the person added come off when dragged out: `e2e/finder-more-journey.mjs`. Kept per account across a reload: `e2e/finder-sidebar-journey.mjs`. File > Add to Sidebar takes a file and its row opens it, there after a reload, by a scratch journey, not committed; the drop of a file shares the code, not driven. Every row of the section now moves, the built-in ones too: Downloads dragged to the top stands there, in `finder.sidebarOrder` on the server and after a reload, by a scratch journey in a browser, not committed. A built-in row goes by Preferences' Sidebar pane, not by a drag out |
| Remove from Sidebar, Open in New Tab | done | Both from a row's context menu; `e2e/finder-files-journey.mjs`, `e2e/finder-context-menu-journey.mjs` |
| Drop files on a place | done | Moved there, read back from the server: `e2e/finder-rows-keys-journey.mjs` |
| Resize by the divider | done | [Dragged wider](#project-artifact/art_a7e016210b9b9bc1/397), the width kept per account: `e2e/finder-rows-more-journey.mjs` |
| Hide or show a section | done | [Hide and Show on a section's heading](#project-artifact/art_a7e016210b9b9bc1/379), kept on the server and across a reload: `e2e/finder-more-journey.mjs` |

## Views (13: 12 done, 1 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| Icon view with size slider | done | [The icons grow with the slider](#project-artifact/art_a7e016210b9b9bc1/563): `e2e/finder-rows-keys-journey.mjs` |
| List view: sort, expand in place | done | [A heading sorts, Right Arrow expands](#project-artifact/art_a7e016210b9b9bc1/381): `e2e/finder-drive-journey.mjs` |
| List columns | built-unchecked | [Date Created and Tags added from View Options](#project-artifact/art_819e645e9197a100/16). Also Date Last Opened, and now Comments, from what Get Info keeps: `finder-rows.test.tsx`, and the column seen in a browser by a scratch journey, not committed. Date Added and Version are dimmed, each with its own reason. `e2e/finder-view-journey.mjs` |
| Column view with preview column | done | [Select All selects the whole column](#project-artifact/art_a7e016210b9b9bc1/369), ⌘ and ⇧ click pick several of a column, and a plain click goes back to one: `e2e/finder-rows-journey.mjs`, `finder.test.tsx`. With several selected no column or preview opens from them; a Mac's preview column says how many |
| Gallery view with Preview pane | done | [The picture, the strip and the pane](#project-artifact/art_a7e016210b9b9bc1/384): `e2e/finder-drive-journey.mjs` |
| Preview pane Quick Actions | done | [Rotate Left saves the turned picture over the file, and the pane shows the file's own pixels](#project-artifact/art_a7e016210b9b9bc1/524); Markup opens Quick Look, More… opens System Preferences' Extensions. `e2e/finder-picture-journey.mjs`, read back in pixels after a reload. PNG, JPEG and WebP are saved; another kind turns in the window only. The strip's thumbnails and the pane's icon are still stand-ins |
| Group sections with Show All | done | [One row that scrolls sideways, then the whole section](#project-artifact/art_819e645e9197a100/54). `e2e/finder-groups-journey.mjs` |
| Tabs with own folder, history, view, selection | done | [A tab keeps its own folder](#project-artifact/art_a7e016210b9b9bc1/388): `e2e/finder-drive-journey.mjs` |
| Drag a tab to reorder or out | done | Along the bar it takes a new place; 40 pt away from the bar it becomes a window. Same journey |
| Trash banner with Empty; shared folder banner | done | [The Trash's banner](#project-artifact/art_a7e016210b9b9bc1/390): `e2e/finder-drive-journey.mjs`. The drive shares no folder, so only the in-memory tree shows the other |
| Per-folder view, sort and size | done | Downloads stays a list sorted by Kind while Documents shows icons, read back from the server. Icon size shares the code; not driven. `e2e/finder-saved-journey.mjs` |
| Status bar: count, space left, slider | done | [The count of those selected](#project-artifact/art_a7e016210b9b9bc1/382) and the slider: `e2e/finder-drive-journey.mjs` |
| Path bar: click and double click | done | [A double click goes there](#project-artifact/art_a7e016210b9b9bc1/387): `e2e/finder-drive-journey.mjs` |

## Selection and rename (9: 9 done)

| Item | Status | Main |
| --- | --- | --- |
| Click, Shift-click, ⌘-click | done | [In the list, counted by the status bar](#project-artifact/art_a7e016210b9b9bc1/382); in the columns too: `e2e/finder-drive-journey.mjs`, `finder.test.tsx` |
| Marquee (rubber band) selection | done | [The band over four items](#project-artifact/art_819e645e9197a100/9), in icon view; Escape puts the selection back. `e2e/finder-drag-journey.mjs` |
| Type to select | done | `e2e/finder-rows-drive-journey.mjs` |
| Arrow keys, Home, End | done | Same journey |
| Background click deselects | done | Same journey |
| Return renames in place | done | [The name selected before its extension](#project-artifact/art_819e645e9197a100/5); Return keeps, Escape does not, read back from the server. `e2e/finder-rename-journey.mjs`. Command-O and Command-Down open |
| Slow double click renames | done | A click on the selected item's name after 600 ms; a double click opens instead. Same journey |
| Rename N Items… batch | done | [Replace Text with its example](#project-artifact/art_819e645e9197a100/6), read back from the server. Add Text and Format are built, covered by unit tests, not driven in a browser |
| Multi-selection: tag, trash, duplicate, copy, move | done | [Two selected](#project-artifact/art_a7e016210b9b9bc1/543): a tag on both, Duplicate of both and a drag of both, each read back from the server, same journey. Trash and copy of several share these commands |

## Context menus (9: 6 done, 2 built-unchecked, 1 partial)

`e2e/finder-context-menu-journey.mjs` drives these with real secondary clicks.

| Item | Status | Main |
| --- | --- | --- |
| File: Open, Open With, Trash, Get Info, Rename, Compress, Duplicate, Alias, Quick Look, Copy, Share, Tags, Quick Actions | done | [All show](#project-artifact/art_a7e016210b9b9bc1/394). Compress and Get Info driven from this menu: `e2e/finder-rows-more-journey.mjs`; Duplicate and Move to Trash earlier; the others share the menu bar's commands |
| Folder: adds Open in New Tab | done | [A tab on it](#project-artifact/art_a7e016210b9b9bc1/565): `e2e/finder-rows-keys-journey.mjs` |
| Several items: New Folder with Selection, Rename N Items | done | Both driven with real clicks: `e2e/finder-context-menu-journey.mjs`, `e2e/finder-rename-journey.mjs` |
| Background: New Folder, Get Info, Sort By, Clean Up, View Options, Paste | built-unchecked | [The rows](#project-artifact/art_a7e016210b9b9bc1/401). New Folder, Sort By and View driven, read back: `e2e/finder-rows-more-journey.mjs`. Get Info and Paste share the menu bar's commands, not driven from here. Clean Up (dimmed with its reason), Clean Up By and Show View Options are now in this menu: `finder-rows.test.tsx`, and Show View Options chosen in a browser by a scratch journey, not committed |
| Sidebar row: Open in New Tab, Eject, Remove, Get Info | built-unchecked | Open in New Tab is done. Open, Get Info and Remove (saved searches) are built, not driven. The startup disk's row now has Eject, dimmed with its reason: the drive has no disks |
| Tab bar: Close Tab, Move to New Window | done | Close Tab and Close Other Tabs: `e2e/finder-drive-journey.mjs`. [Move Tab to New Window](#project-artifact/art_a7e016210b9b9bc1/405): `e2e/finder-rows-more-journey.mjs` |
| Path bar item: Open, Get Info | done | [Its menu](#project-artifact/art_a7e016210b9b9bc1/567), and Open goes there: `e2e/finder-rows-keys-journey.mjs`. Get Info shares the menu bar's command, not driven from here |
| Trash item: Put Back, Delete Immediately | done | Delete asks first, and erases only after Delete, read back from the server. Put Back was seen, not run |
| Quick Actions ▸ and Services ▸ | built-unchecked | Offered only for what they can do. Quick Actions on pictures: Rotate Left, saved over the file, Markup, which goes to Quick Look's, and Customize…, which opens System Preferences' Extensions like the pane's More…; Customize… is built, not driven. Services: Set Desktop Picture, kept on the server by its file, and Open Selected File in TextEdit. `e2e/finder-services-journey.mjs`. New Terminal at Folder and New Terminal Tab at Folder on a folder: the first driven by the same journey, the second not. Automator's saved Quick Actions that receive files are listed under Quick Actions for what is selected on the drive: `e2e/automator-types-batch6-journey.mjs` |

## Keyboard, beyond the menu rows (3: 2 done, 1 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| ⌘1–4, ⌘[ ], ⌘↑, ⌘↓, ⌘F, ⌘I, ⌘Y, ⌘C, ⌘V, ⌘K, ⇧⌘G, ⇧⌘⌫, ⌘D, ⌘⌫, ⌥⌘V, Space | done | Each pressed, what the server keeps read back: `e2e/finder-rows-keys-journey.mjs`, `e2e/finder-rows-drive-journey.mjs`, `e2e/finder-drive-journey.mjs`. ⌘↓ was missing and now opens what is selected. Off a Mac, with nothing selected ⌘↓ is still App Exposé |
| The other menu keys: ⇧⌘N, ⌘O, ⌘R, ⌘E, ⌥⌘S, ⌥⌘P, ⌘/, ⌘J, and Go's letters | built-unchecked | ⇧⌘N, ⌥⌘S, ⌥⌘P, ⌘/, ⌘J, and Go's keys for Desktop, Documents, Downloads, Applications and Home: `e2e/finder-rows-keys-journey.mjs`. ⌘O: `e2e/finder-drive-journey.mjs`. ⌘R is taken by the window, not the browser, in `finder-rows.test.tsx`; ⌘E has no command on the drive, whose row is dimmed. Neither pressed in a browser |
| ⇧⌘. shows hidden files | done | [A name with a dot, listed](#project-artifact/art_819e645e9197a100/38), and hidden again. Kept per account. Same journey |

## Drag and drop (15: 13 done, 1 built-unchecked, 1 missing)

| Item | Status | Main |
| --- | --- | --- |
| Onto a folder in a view | done | [Two files onto a folder](#project-artifact/art_feed73a04b7ab5a0/1) |
| Onto a sidebar place | done | `e2e/cross-app-journey.mjs`: Option-drag onto Documents, read back from the server |
| Between Finder windows | done | [Moved to the other window's folder](#project-artifact/art_a7e016210b9b9bc1/564), read back from the server: `e2e/finder-rows-keys-journey.mjs` |
| Onto the Dock's Trash | done | `e2e/cross-app-journey.mjs`: in the Trash on the server |
| Files from the computer into a folder | built-unchecked | Playwright cannot do this; only code read |
| Refusal notice (into itself, onto a file) | done | Onto a file: marked refused, and it stays: `e2e/finder-rows-drive-journey.mjs`. Into itself is unit-tested (`refusalFor`), not driven in this journey |
| Drag image following the pointer with a count | done | [Image with its count](#project-artifact/art_feed73a04b7ab5a0/1) |
| Option-drag copies | done | `e2e/cross-app-journey.mjs`: the original stays and a copy is on the server |
| ⌘-drag moves; copy across volumes | done | A plain drag and a ⌘-drag both move and only ⌥ copies: `finder-rows.test.tsx`. The drive is one volume and no drive here has a second, so a drag never crosses volumes |
| Spring-loaded folders | done | [Rest on a folder and it opens with the drag going](#project-artifact/art_819e645e9197a100/8), after 700 ms, then drop on the folder inside, read back from the server. `e2e/finder-drag-journey.mjs`. Sidebar rows, path bar items and tabs spring too; those were not driven |
| Drop on the path bar or a tab | done | Both read back from the server, same journey |
| Onto a Dock app tile to open it | done | [Dropped on TextEdit's tile](#project-artifact/art_feed73a04b7ab5a0/3) |
| Into another app | done | Finder's drag follows the pointer, and an app takes it through `useDesktopDrop` or `registerDropTarget`: Calendar, Chess, Console, Font Book, Keychain Access, Mail, Messages, Music, Notes, Photos, Podcasts, Preview, QuickTime Player, Script Editor, Stickies, System Preferences, Terminal, TextEdit and TV have such a target, read in their code, and `e2e/desktop-into-apps-journey.mjs` drives Mail, Messages, Notes and Photos. A browser's own drag could not carry the file's bytes, which are read after the drop, so Finder starts none. Reminders takes only that kind of drop today, so a Finder drag does not land there: the change is on Reminders' side |
| Onto the desktop | done | From Finder onto the picture and back into a window, read back from the server. `e2e/desktop-items-journey.mjs` |
| Out to the computer's file manager | missing | Finder's drags follow the pointer (`demos/desktop/desktop-drag.ts`). A browser starts its `DownloadURL` drag only from a native drag, only in Chromium, and only with an address that answers with the whole file, where the drive's reads are in pieces. So this needs the desktop's drag and a server route changed, and no browser test can see a drop outside the page. File > Download saves a file to the computer meanwhile |

## Search (6: 6 done)

| Item | Status | Main |
| --- | --- | --- |
| Name search with scope bar | done | [This Mac and the folder](#project-artifact/art_819e645e9197a100/40), `e2e/finder-search-journey.mjs` |
| Criteria row (+) | done | [Contents and a date, each row must hold](#project-artifact/art_819e645e9197a100/42): Kind, the three dates, Name, Contents, File extension, Tags and File size were built, of which Kind, Name, File size, Contents and Last modified date were driven in `e2e/finder-smart-journey.mjs`; the rest in unit tests. Contents holds only the words inside a file, in one row of a search, whose words must all be there. Other… and the many further attributes of a Mac are absent |
| Search file contents | done | [Found by the words inside, and past Spotlight's ten](#project-artifact/art_819e645e9197a100/40), through the server's text index, `e2e/finder-search-journey.mjs`. Limits as Spotlight's: the first 100 text files and 4,000 characters of each, which a banner says when it applies |
| Save search | done | Kept per account, `e2e/finder-saved-journey.mjs` |
| Smart Folder | done | [Saved under its name, in the sidebar after a reload, and run with its rows](#project-artifact/art_819e645e9197a100/41), read back from the server. [The sheet asks whether to Add To Sidebar](#project-artifact/art_a7e016210b9b9bc1/608); left out, Go's Saved Searches runs it and [File's Add to Sidebar adds it](#project-artifact/art_a7e016210b9b9bc1/609). Save on one that was run updates it with no question. `e2e/finder-smart-journey.mjs`. A setting, not a file in a Saved Searches folder, so the sidebar's Remove forgets it where a Mac's keeps the file |
| Suggested tokens | done | [Words in the field suggest a name, a kind or a tag](#project-artifact/art_a7e016210b9b9bc1/376); the arrow keys and Return pick one, which becomes a criterion row and searches by it: `e2e/finder-more-journey.mjs` |

## Get Info (10: 9 done, 1 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| Window for an item or folder | done | [Real on the drive](#project-artifact/art_819e645e9197a100/33). `e2e/finder-info-journey.mjs` |
| Tags field, saved | done | [Read back from the server](#project-artifact/art_a7e016210b9b9bc1/542): `e2e/finder-rows-drive-journey.mjs` |
| General facts | done | Same picture and journey |
| Name & Extension | done | Return renames, read back from the server, and the window follows the new name. Hide extension is kept on the server and Finder shows the name without it |
| Stationery, Locked, Hide extension | done | Kept on the server. A locked item shows a padlock and the server refuses to rename, move, trash, delete or save over it. Opening a stationery pad opens a copy and the pad stays |
| Comments | done | Kept on the server, there after a reload. Spotlight does not search them |
| Open with, Change All | done | [A file's application chosen and Change All](#project-artifact/art_a7e016210b9b9bc1/400), kept per extension on the server: `e2e/finder-rows-more-journey.mjs` |
| Sharing & Permissions | done | A list, its add, remove and action rows dimmed with their reason: the drive is the person's alone, so there is nobody to share with: `finder-rows.test.tsx` |
| Several items (⌃⌘I, ⌥⌘I) | built-unchecked | [One window for all of them](#project-artifact/art_a7e016210b9b9bc1/395), by ⌥⌘I: count, size, kind, where, and Locked: `e2e/finder-rows-more-journey.mjs`. Tags they share, where a change keeps each item's others, and one comment for them all: `finder-rows.test.tsx`, and a tag from File's Show Summary Info read back from the server on both in a browser by a scratch journey, not committed. ⌃⌘I needs both Control and Command, so only a Mac has its key |
| Paste a custom icon | done | Click the header of Get Info, which rings the icon, and paste: a picture from the computer's clipboard, or a picture copied in Finder. The row, the panel and the desktop show it, and it comes back after a reload, in a hidden `.icon-<item id>` file in Documents, read back from the server. Delete on the header gives the item its own icon back, read back from the server. A locked item refuses, as a Mac's does. By a scratch journey in a browser, not committed, sending the paste through the browser's own command since headless Chromium has no menu key for it. `finder-rows.test.tsx`, `finder-custom-icon.test.tsx`. Copying an icon out of Get Info is absent |

## Quick Look (8: 4 done, 4 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| The file's own bytes: picture, movie, sound, PDF, text | done | [Picture](#project-artifact/art_a7e016210b9b9bc1/544) and text driven: `e2e/finder-rows-drive-journey.mjs`. A movie, a sound and a PDF each show in their element from the bytes read from the drive, by a scratch journey in a browser, not committed, and `finder-rows.test.tsx`. Those files were stand-in bytes of the right type, so playback itself was not seen |
| Follows the selection | done | Same picture and journey |
| Open in the right app | built-unchecked | Dimmed when no app takes it |
| Share | built-unchecked | The drive's rows in Quick Look too (`lookedShareItems`), the same as the toolbar's: Mail and Messages share, AirDrop dimmed with its reason. The rows' code is what `e2e/mail-share-journey.mjs` runs; not driven from Quick Look |
| Markup | built-unchecked | Done draws the marks into the file's pixels and saves over it, read back in pixels from the server, and Crop keeps the part dragged over, read back by size: a scratch journey in a browser, not committed. Text Style sets the size of the next text: `finder-rows.test.tsx`. PNG, JPEG and WebP are saved; another kind keeps its marks in the window, and an alert says so. Sign is dimmed with its reason. Not undoable |
| Rotate | done | Saved over the file, the same command as the pane's: [`e2e/finder-picture-journey.mjs`](#project-artifact/art_a7e016210b9b9bc1/524). From Quick Look's own button it shares the code, not driven |
| Full screen, index sheet, slideshow | done | Quick Look's button goes full screen; [the index sheet](#project-artifact/art_819e645e9197a100/58). Same journey. No 2-up view or Add to Photos, unlike a Mac's |
| Trim of movie and sound | built-unchecked | A Trim button on a drive movie or sound, dimmed with its reason, since a browser cannot write a shorter copy in the file's format: `finder-rows.test.tsx` |

## Preferences window (4: 4 done)

| Item | Status | Main |
| --- | --- | --- |
| General: desktop items, new windows show, open folders in tabs | done | Hard disks leaves and returns to the desktop; a new window shows the folder asked for. External disks shares the code, not driven. CDs, servers and tabs are dimmed with reasons |
| Tags: sidebar and favourites | done | A tag left out goes from the sidebar. [Favorite Tags choose what File and the context menu list](#project-artifact/art_a7e016210b9b9bc1/525), kept on the server: `e2e/finder-picture-journey.mjs`. Checkboxes, not a Mac's drag into a tray |
| Sidebar: checklist | done | [Favorites, Locations and Tags](#project-artifact/art_a7e016210b9b9bc1/375): a row left out goes from the sidebar, Recent Tags the whole section, and those the drive has nothing for are dimmed with reasons: `e2e/finder-more-journey.mjs` |
| Advanced: extensions, warnings, Trash after 30 days, folders on top, search scope | done | Each driven: the extension warning, Empty Trash with no alert, items over 30 days old erased (by moving the browser's clock), folders first, Search This Mac. Keep folders on desktop is absent: the desktop keeps its sort order, folders among the rest. All read back from the server |

## View Options window ⌘J (5: 5 done)

| Item | Status | Main |
| --- | --- | --- |
| Icons: size, grid, text, label position, item info, preview, background | done | [The window](#project-artifact/art_a7e016210b9b9bc1/402). Size and Background Color driven, and Grid spacing read back from the server: `e2e/finder-rows-more-journey.mjs`. [Show item info puts a line under each name](#project-artifact/art_a7e016210b9b9bc1/519), the items a folder holds, a picture's size or a file's, and Show icon preview is kept for the folder, same journey; a picture without it shows the document icon: `finder-view-options.test.tsx`. Label position Right and Picture are dimmed with reasons |
| List: icons, text, columns, relative dates, all sizes | done | [Large icons make the rows taller, Calculate all sizes kept](#project-artifact/art_a7e016210b9b9bc1/403): `e2e/finder-rows-more-journey.mjs`. [Columns and relative dates](#project-artifact/art_819e645e9197a100/16) in `e2e/finder-view-journey.mjs`. Text size shares the window's path, driven in none |
| Columns: icons, preview column | done | [Show preview column](#project-artifact/art_a7e016210b9b9bc1/399) and Show icons each take theirs away: `e2e/finder-rows-more-journey.mjs` |
| Gallery: thumbnail size, preview column | done | [Show preview takes the pane away](#project-artifact/art_a7e016210b9b9bc1/404), and [Thumbnail size changes the strip](#project-artifact/art_a7e016210b9b9bc1/520), kept for the folder: `e2e/finder-rows-more-journey.mjs` |
| Always open in, Use as Defaults | done | Use as Defaults is read back from the server, and a folder with nothing of its own shows it. `e2e/finder-view-journey.mjs` |

## Dialogs and progress (8: 6 done, 2 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| Empty Trash alert | done | [Asks, and Cancel empties nothing](#project-artifact/art_a7e016210b9b9bc1/389): `e2e/finder-drive-journey.mjs` |
| Replace alert | done | [Asks for a move too, in its own words](#project-artifact/art_a7e016210b9b9bc1/541): a drag and Move Item Here now ask where they used to rename without a word. Stop leaves it, Replace takes the other's place and Undo gives back both, Keep Both takes the next name, all read back from the server: `e2e/finder-rows-drive-journey.mjs`. A name that reached the folder since this window last read the drive still gets the next name, unasked. A drop on the desktop asks the same way: `e2e/desktop-drop-replace-journey.mjs` |
| Go to Folder with typed paths | done | `e2e/finder-rows-drive-journey.mjs` |
| Connect to Server | built-unchecked | Only the in-memory network connects; the drive's window says why. Favorite Servers are kept per account (`finder.servers`), read back from the server by a scratch journey in a browser, not committed |
| Copy progress window | done | The drive copies at once, on the server, so there is nothing to wait for; Compress, Upload and Download show progress in the window, and Window > Show Progress Window is dimmed with that reason ([Window menu](#project-artifact/art_a7e016210b9b9bc1/326)). The docs demo's in-memory tree plays the window for 2 s |
| Upload and Download windows | built-unchecked | |
| Eject warning | done | The drive has no disks, and Eject is dimmed with its reason ([File menu row](#project-artifact/art_a7e016210b9b9bc1/328)). The docs demo's in-memory disks show the warning |
| Rename in place | done | Replaced the dialog. A name the drive refuses is [told in an alert](#project-artifact/art_819e645e9197a100/3) and the item keeps its name |

## Saved state (5: 5 done)

| Item | Status | Main |
| --- | --- | --- |
| Drive contents, names, folders, tags; other accounts see none; survive restart | done | Kept over a reload and another account sees none: `e2e/finder-rows-keys-journey.mjs`. A real same-root restart of `ferrite dev`, then a new browser signing in: the file with its tag, and a pasted icon's file, are still on the drive, by a scratch journey in a browser, not committed. `finder.persist.restart` in `e2e/finder-census-journey.mjs` covers it too and was not re-run |
| Recents from `opened_ms` | done | Opening a file through `openFile` now notes it on the server, which it did not before: read back in `e2e/recent-documents-journey.mjs`, and listed in [Apple > Recent Items](#project-artifact/art_a7e016210b9b9bc1/127) |
| Windows, tabs, folder, view and bars after a reload | done | [Tabs, their folders and views, the bars and the sidebar come back](#project-artifact/art_819e645e9197a100/10), and [the window itself, where it was](#project-artifact/art_819e645e9197a100/27). `e2e/finder-saved-journey.mjs`, `e2e/desktop-dock-menus-journey.mjs`. A folder that has gone opens the home folder. Only the last key window's tabs are kept; a second Finder window comes back with its frame on the folder Preferences asks for |
| Per-folder view, sort, icon size | done | See Views |
| Saved searches and sidebar favourites | done | [Searches](#project-artifact/art_819e645e9197a100/41) and [favourites](#project-artifact/art_819e645e9197a100/19) come back after a reload: `e2e/finder-saved-journey.mjs`, `e2e/finder-sidebar-journey.mjs` |

## Cross-app, from Finder's side (9: 8 done, 1 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| Text to TextEdit; picture and PDF to Preview | done | [Text and a picture](#project-artifact/art_a7e016210b9b9bc1/539), each in its application: `e2e/finder-rows-drive-journey.mjs`. A PDF takes the same route and was not driven |
| Sound to Music, movie to QuickTime, `.ics` to Calendar, `.vcf` to Contacts | done | Each app's row, and `.vcf`: `e2e/open-in-apps-journey.mjs` |
| Open With: choose an app, keep a default | done | [Choose, and keep as the default](#project-artifact/art_a7e016210b9b9bc1/396): `e2e/finder-rows-more-journey.mjs` |
| Reveal from Spotlight | done | [The file selected in its folder](#project-artifact/art_819e645e9197a100/44): `e2e/spotlight-journey.mjs` |
| Copy in one Finder window, paste in another | done | [Pasted in a second window](#project-artifact/art_feed73a04b7ab5a0/4) |
| Copy a file, paste into another app | done | Into Mail, Messages and Photos, from a desktop icon: `e2e/desktop-into-apps-journey.mjs`. From a Finder window into Mail, attached, by a scratch journey in a browser, not committed |
| Share to Mail, Messages, Notes | done | Mail and Messages run end to end: `e2e/mail-share-journey.mjs`, `e2e/messages-share-files-journey.mjs`. Share > Notes on a text file puts its lines in a note, by a scratch journey in a browser, not committed |
| A card or words dragged out of an app into a folder | built-unchecked | A drag holding `text/vcard` leaves a `.vcf` named after the person, or for how many cards it holds, which Contacts opens; a link leaves a `.webloc` and words a text file: `finder-clipping.test.ts`, unit tests only. Contacts' name drag was not driven into a window |
| Add a folder to the Dock | done | [A folder and a file](#project-artifact/art_819e645e9197a100/46), `e2e/dock-kept-journey.mjs` |

## Ledger

The open work ledger (version 3) has no open Finder rows. Spotlight's file reveal is in its inventory.

## Build items, most used first

The cross-app items (C1 to C4 in "Feature inventory: Cross-app pieces") land first. F4, F6, F9 and F10 depend on them where noted.

1. **F1 Menu bar.** Register File, Edit, View and Go rows through `useDesktopAppMenu`, with key equivalents, over the functions the Action menu already calls. Enable Empty Trash…, fix Back and Forward, add Go's places. Keep the Action menu to what Finder's own has.
2. **F2 Context menus.** File, folder, several items, background, sidebar, path bar, tab and Trash menus, using the same commands as F1.
3. **F3 In-place rename.** Return and slow click rename in the view, with Rename N Items…. Remove the dialog.
4. **F4 Drag depth.** Drag image with a count, Option-drag copies, spring-loaded folders, path bar and tab drops, marquee selection. Built on C1.
5. **F5 Undo and Redo.** A stack for move, rename, trash, new folder, duplicate and tag.
6. **F6 Saved state.** Windows, tabs, folders, views and bars, saved searches and favourites survive a reload. A small server document (`/api/finder/state`). Shared clipboard from C3.
7. **F7 View depth.** View Options ⌘J, full Sort By, group sections, list columns, Clean Up, show and hide sidebar, toolbar and tab bar, Customize Toolbar, per-folder settings.
8. **F8 Preferences window.** General, Tags, Sidebar, Advanced, each changing behaviour.
9. **F9 Get Info real.** Edit name, comments, Locked and Hide extension kept on the drive; Open With from C2; several items.
10. **F10 File commands.** Compress (zip in the browser), Make Alias and Show Original, New Folder with Selection, Add to Sidebar, Add to Dock, Print, Share through C4.
11. **F11 Search.** File contents through the server's text index, criteria rows by attribute, Smart Folders saved in the sidebar.
12. **F12 Quick Look depth.** Saved markup and rotation, full screen, index sheet, slideshow, trim.
13. **F13 Tabs.** Reorder, Move to New Window, Merge All Windows, next and previous tab, Show All Tabs.
14. **F14 Honest dims and Help.** Eject, Burn, AirDrop, iCloud Drive, Network and Dictation dim with reasons. Help opens Help Viewer, with a working search field.
