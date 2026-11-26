# Feature inventory: Desktop and Dock

Main commit read: `e62c2ac9` (29 October 2026), from GitHub only. Nothing was run.

Hosted check on the live site, built from main `849cf255`: `e2e/desktop-icons-journey.mjs` 27 of 27. `e2e/recent-documents-journey.mjs` failed its Clear Menu step there, since fixed on main and passing locally; not yet rerun on the hosted site.

Sources read: `demos/desktop/desktop.tsx`, `desktop-menus.tsx`, `desktop-dock.tsx`, `desktop.mdx`, `desktop-app-menus.ts`; `ferrite-apps/desktop/e2e/desktop-census-journey.mjs`, `windows-census-journey.mjs`; the desktop README's status menu section. The real app's list comes from knowledge of macOS 10.15.

Status key: **missing**, **partial** (the note says what is absent), **built-unchecked** (in main's code, not seen running for this inventory). Nothing is done until it is checked in a browser with a screenshot.

**Counts: 82 rows: 53 done, 21 built-unchecked, 8 partial, grouped below by what still works how.**

The desktop surface shows the person's Desktop folder on the served desktop. The docs desktop has no drive and keeps its stand-in stacks.

## Desktop surface (18: 13 done, 3 built-unchecked, 2 partial)

| Item | Status | Main |
| --- | --- | --- |
| Desktop picture in both appearances, dynamic by the clock | built-unchecked | `useDesktopPicture` |
| Picture chosen in Preferences or Photos | built-unchecked | `desktop-personal.ts` |
| Files of the Desktop folder shown as icons | done | [The band over them](#project-artifact/art_819e645e9197a100/25). `e2e/desktop-items-journey.mjs`, read back from the server. Positions are kept: see Move icons |
| Macintosh SSD icon | done | [The disk in Finder](#project-artifact/art_a7e016210b9b9bc1/431), `e2e/desktop-more-journey.mjs` |
| Time Machine icon | done | [Opens its pane](#project-artifact/art_a7e016210b9b9bc1/433), which says the desktop has no backup disk, same journey |
| Stacks | done | [Gathered from the person's files by kind](#project-artifact/art_819e645e9197a100/21); the invented stacks are only on the docs desktop |
| Use Stacks ⌃⌘0, Group Stacks By | done | [Grouped by Date Created](#project-artifact/art_819e645e9197a100/66), kept across a reload: `e2e/desktop-keys-menu-journey.mjs`. The key is Control-Option-0 where Command is Control. Date Added comes from when the desktop first saw the item, kept for the account, because the drive does not record a move: [a file moved onto the desktop is under Today](#project-artifact/art_819e645e9197a100/68) while Date Created says Earlier. Date Last Opened goes by what the drive records, which is often nothing, so those items gather under Earlier |
| Selecting icons, marquee | done | [Rubber band, click, Command-click](#project-artifact/art_819e645e9197a100/25) |
| Rename on the desktop | done | Return, read back from the server, same journey |
| Move icons, Snap to Grid, Clean Up, Sort By | built-unchecked | [Icons moved, and in cells under Snap to Grid](#project-artifact/art_a7e016210b9b9bc1/77); [a file from Finder where it was dropped](#project-artifact/art_a7e016210b9b9bc1/76). `e2e/desktop-icons-journey.mjs`: an icon stays where it is let go, kept per account across a reload and read back from the server; Snap to Grid, Clean Up and Clean Up By put icons in cells; a sort by a column keeps icons in that order and dims Clean Up. Sort By has None and Snap to Grid. Sort By Date Added puts the last to arrive first, by when the desktop first saw each item in the folder, kept on the server and across a reload: `e2e/desktop-batch3-journey.mjs`. An icon past the window shows in a free cell, its place kept for a larger window. With more icons than cells the columns pack closer, each icon keeping a strip to press, narrower the more there are, over a part of the one before: [20 icons in a small window](#project-artifact/art_a7e016210b9b9bc1/126), no scrolling desktop. Icons can overlap in part when the desktop has more icons than cells; on a desktop too narrow even for that, the last columns stand past its left edge |
| Desktop context menu: New Folder, Get Info, Change Desktop Background, Use Stacks, Sort By, Clean Up, View Options | done | [The rows shown](#project-artifact/art_819e645e9197a100/67), Use Stacks and Group Stacks By driven; Sort By, Clean Up and Clean Up By driven in `e2e/desktop-icons-journey.mjs`. Show View Options driven in `e2e/desktop-view-options-journey.mjs`. [New Folder](#project-artifact/art_a7e016210b9b9bc1/442), read back from the server, [Change Desktop Background, on its pane](#project-artifact/art_a7e016210b9b9bc1/441), and Get Info on the Desktop folder driven in `e2e/desktop-more-journey.mjs` |
| Keys with no window: Select All, Paste; on an icon: Copy, Duplicate, Get Info, Open, Quick Look | done | ⌘A, ⌘V, ⌘C, ⌘D and ⌘I driven and read back from the server: `e2e/desktop-keys-menu-journey.mjs`. ⌘O, ⌘↓ and Space driven in `e2e/desktop-more-journey.mjs`. Where Command is Control, Control-Down stays Application Windows, so ⌘↓ takes the Command key itself |
| Drop from Finder or the computer onto the desktop | done | From Finder, read back from the server: `e2e/desktop-keys-menu-journey.mjs`. [A name the desktop has asks first](#project-artifact/art_a7e016210b9b9bc1/604): Stop, Replace with Undo, and Keep Both, read back from the server: `e2e/desktop-drop-replace-journey.mjs`. A paste on the desktop still takes the next name unasked. [A file from the computer, with words and a link](#project-artifact/art_a7e016210b9b9bc1/91), `e2e/cross-app-text-journey.mjs`: a synthetic browser drop, since Playwright cannot drag from outside the browser. Let go on a folder's icon it goes in the folder, and on another icon on the Desktop: `e2e/desktop-view-options-journey.mjs`, the same way |
| Drag icons to the Dock or the Trash | done | To the Trash and onto a folder icon, both read back from the server, same journey |
| Double click opens a file in the right app | done | TextEdit, same journey |
| Click on the desktop makes Finder front | done | [With Chess showing, inactive](#project-artifact/art_a7e016210b9b9bc1/238): a click or secondary click on the desktop, and a press on the window, its Dock tile or a new window ends it. `e2e/desktop-front-journey.mjs`. A Finder window that is open keeps answering Finder's menu rows, where a Mac's act on the desktop |
| Desktop view options: size, spacing, text, item info | built-unchecked | [The window, with larger icons, more space, names to the right and item info](#project-artifact/art_a7e016210b9b9bc1/159): Stack By, Sort By, Icon size, Grid spacing, Text size, Label position, Show item info and Show icon preview, kept per account, read back from the server and across a reload. Opens from the desktop's menu, the View menu with no Finder window, and ⌘J; icons keep their place as the grid changes. `e2e/desktop-view-options-journey.mjs`. Whether the window is open and where it stands are kept too, and a stack's tile follows the icon size: `e2e/desktop-overlay-journey.mjs`. A picture over 8 MB keeps the drawn icon |
| Get Info and Quick Look on desktop icons | built-unchecked | [Rows in an icon's menu](#project-artifact/art_819e645e9197a100/22); Get Info driven, opening in Finder. Quick Look driven with Space, which also closes it: `e2e/desktop-more-journey.mjs`. With no Finder window open the panel shows alone, and its Finder window is kept out of sight until the panel closes: `e2e/desktop-overlay-journey.mjs` |

## Menu bar (25: 16 done, 7 built-unchecked, 2 partial)

| Item | Status | Main |
| --- | --- | --- |
| Apple > About This Mac | done | [Its window](#project-artifact/art_a7e016210b9b9bc1/593): `e2e/desktop-rows-journey.mjs` |
| Apple > System Preferences… | done | [Its window](#project-artifact/art_a7e016210b9b9bc1/590), same journey |
| Apple > App Store… | done | [Its window](#project-artifact/art_a7e016210b9b9bc1/589), same journey |
| Apple > Recent Items ▸ | done | [Applications, Documents and Servers](#project-artifact/art_a7e016210b9b9bc1/127): a file opened is listed, its row opens it, and Clear Menu forgets it, each across a reload: `e2e/recent-documents-journey.mjs`. Servers is always empty: the drive has none to connect to |
| Apple > Force Quit… ⌥⌘⎋ | done | [The window, from the row](#project-artifact/art_a7e016210b9b9bc1/591), same journey |
| Apple > Sleep | done | [The display out](#project-artifact/art_a7e016210b9b9bc1/588), and a key wakes it, same journey. As the guest: the lock screen after it was not seen here |
| Apple > Restart… | done | Asks, and Cancel leaves the desktop, same journey. Restarting: `e2e/apple-menu-option-journey.mjs` |
| Apple > Shut Down… | done | [Asks](#project-artifact/art_a7e016210b9b9bc1/594), and Cancel leaves the desktop, same journey. Shutting down itself was not driven |
| Apple > Lock Screen ⌃⌘Q | built-unchecked | Key not typable off Apple platforms |
| Apple > Log Out ⇧⌘Q | built-unchecked | |
| Time Machine extra | partial | True statements, commands dimmed; Time Machine pane opens. Back Up Now and Enter Time Machine stay dimmed: this desktop has no backup disk and keeps no history of its drive to enter, only each document's versions (File > Revert To) |
| Wi-Fi extra | built-unchecked | Online state, and where the browser has `navigator.connection` its speed, round trip and quality, kept current; compared with Chromium's own values in `rows-batch19-journey`. Elsewhere it says the browser reports only the online state. Dimmed with reasons: a page can neither switch nor list Wi-Fi networks |
| AirPlay extra | built-unchecked | "AirPlay: Off" and Displays pane, and where the browser has the Presentation API it looks for a display, offers Show Desktop on a Display… and Turn AirPlay Off. `rows-batch19-journey`, against a stand-in `PresentationRequest`: no display answers in a headless browser, so a real second display was not driven |
| Battery extra | done | [Its menu](#project-artifact/art_a7e016210b9b9bc1/595), same journey. Chromium only reports a battery |
| Clock extra | done | [The date, View as Analog and Digital, and the pane's row](#project-artifact/art_a7e016210b9b9bc1/434), kept on the server: `e2e/desktop-more-journey.mjs` |
| User extra, fast switching | built-unchecked | [Its menu with Login Window…](#project-artifact/art_a7e016210b9b9bc1/592), same journey. Switching to another account from it, with the other tab following: `e2e/accounts-journey.mjs` |
| Spotlight extra | done | [Opens it](#project-artifact/art_a7e016210b9b9bc1/596), same journey |
| Siri extra | done | [Opens it](#project-artifact/art_a7e016210b9b9bc1/597), same journey |
| Notification Center extra | done | [Opens it](#project-artifact/art_a7e016210b9b9bc1/599), same journey |
| Bluetooth and Volume extras | partial | [Bluetooth, once its pane asks for it, says why its rows are dimmed](#project-artifact/art_a7e016210b9b9bc1/435), and opens its pane, same journey: a page cannot reach Bluetooth. Volume comes from the Sound pane: `e2e/sp-sound-rows-journey.mjs` |
| Automatically hide the menu bar | done | [Off the screen but for its last 2 pt](#project-artifact/art_a7e016210b9b9bc1/440); the pointer at the top brings it back, same journey |
| ⌘-drag to reorder extras | done | [The clock moved before AirPlay](#project-artifact/art_a7e016210b9b9bc1/436), kept per account and across a reload, with no menu opened by the press or the release, same journey. Spotlight, Siri and Notification Center stay at the end. Where Command is Control the key is Control. Arrow keys along the bar still follow the original order |
| Front app's menus by descriptor and `useDesktopAppMenu` | built-unchecked | |
| Menu bar at the top edge over a full-screen window | built-unchecked | `desktop.full-screen.menu-bar` |
| Look Up in menus | done | [Services offers Look Up on the selected word](#project-artifact/art_a8d16e1712d88efa/1); `e2e/shell-journey.mjs` |

## Dock (24: 17 done, 5 built-unchecked, 2 partial)

| Item | Status | Main |
| --- | --- | --- |
| Finder tile | done | Opens a window: `e2e/desktop-rows-journey.mjs` |
| Launchpad tile | done | [Opens it](#project-artifact/art_a7e016210b9b9bc1/600), same journey |
| App tiles and running dots | done | [A dot while Calculator runs](#project-artifact/art_a7e016210b9b9bc1/598), gone when it quits, same journey |
| Minimized window tiles | done | [A tile of its own](#project-artifact/art_a7e016210b9b9bc1/601), which brings the window back, same journey |
| Keep in Dock, Remove from Dock | built-unchecked | [Remove from Dock](#project-artifact/art_a7e016210b9b9bc1/602), kept after a reload, same journey. Keep in Dock on a running application: the tile stays when it quits and after a reload, `e2e/dock-rows-journey.mjs`; screenshot not yet published |
| Drag to reorder | done | Kept after a reload, same journey |
| Drag out to remove | done | [The tile gone](#project-artifact/art_a7e016210b9b9bc1/602), kept after a reload, same journey. No puff animation |
| Size, magnification, position, auto-hide from Preferences | built-unchecked | [Position from the Dock pane](#project-artifact/art_a7e016210b9b9bc1/603), same journey. Size makes the tiles smaller, Magnification swells the tile under the pointer, and Automatically hide takes the Dock off the screen, each kept across a reload: `e2e/dock-rows-journey.mjs`; screenshot not yet published. A Dock full to the screen's width keeps its fitted size when Size is made larger, as a Mac's does |
| Tile menu | done | [Windows, Options, Hide, Quit](#project-artifact/art_819e645e9197a100/26): the window row, Quit, Hide and Open at Login were driven, with Force Quit shown while Option is held; `e2e/desktop-dock-menus-journey.mjs`. Show in Finder opens Applications, driven in `e2e/desktop-more-journey.mjs`. Show All Windows [driven](#project-artifact/art_819e645e9197a100/30) in `e2e/mission-control-journey.mjs` |
| Finder tile menu: New Finder Window, New Smart Folder, Find, Go to Folder, Recent Folders, Hide | done | [Recent Folders](#project-artifact/art_819e645e9197a100/28), New Finder Window and Go to Folder driven in `e2e/desktop-dock-menus-journey.mjs`. [New Smart Folder](#project-artifact/art_a7e016210b9b9bc1/430), as a tab of Finder's window, and Find driven in `e2e/desktop-more-journey.mjs` |
| Trash tile | done | Click opens the Trash in Finder, its menu empties it after the alert, full and empty artwork; read back from the server. `e2e/desktop-items-journey.mjs` |
| Downloads stack | done | [The real folder as a fan](#project-artifact/art_819e645e9197a100/23), with Open in Finder and a count of what is left out |
| Stack: Fan, Grid, List, Sort By, Open in Finder, view options | built-unchecked | [Grid driven](#project-artifact/art_819e645e9197a100/24); Fan shown. [List](#project-artifact/art_a7e016210b9b9bc1/438), Sort by and Open in Finder driven, kept on the server: `e2e/desktop-more-journey.mjs`. Automatic, the view a stack starts with: a fan of up to nine items along the bottom of the screen, otherwise a grid: `e2e/desktop-batch3-journey.mjs`. Files dropped on the tile go in the folder, not driven |
| Folders and files in the Dock | done | [A file's tile and a folder's fan](#project-artifact/art_819e645e9197a100/46): from Finder's Add to Dock, or a drop on the divider; a file opens in its app, a folder fans out, Remove from Dock takes the tile away, kept per account. `e2e/dock-kept-journey.mjs`. A drop elsewhere right of the divider does not count, as it would on a Mac |
| Drop a file on an app tile to open it | done | [Dropped on TextEdit's tile](#project-artifact/art_feed73a04b7ab5a0/3); a tile that cannot open the file refuses it |
| Drag an app from Launchpad or Applications to keep it | built-unchecked | From Launchpad: `e2e/launchpad-reach-journey.mjs`. From Applications in Finder: `e2e/desktop-batch3-journey.mjs --finder-app-drag` read the tile back after a reload. Dropped on a Finder folder it is refused with a sentence, on the Dock's Trash too; dropped on the desktop or on an app's window, those targets (`desktop-drive-items.tsx`, `useDesktopDrop`) do not know the drag yet |
| Recent applications section | done | [Applications opened lately that the Dock does not keep](#project-artifact/art_819e645e9197a100/59), running or not, after their own separator, up to three; Show recent applications turns it off. `e2e/dock-life-journey.mjs` |
| Dock context menu and divider drag: Hiding, Magnification, Position, Minimize Using, Dock Preferences | done | [The divider's menu](#project-artifact/art_a7e016210b9b9bc1/437): Position and Hiding driven, read back from the server, in `e2e/dock-kept-journey.mjs`; Magnification, Minimize Using and Dock Preferences in `e2e/desktop-more-journey.mjs`, where [dragging the divider resizes the tiles](#project-artifact/art_a7e016210b9b9bc1/432) and a full Dock under magnification stays on the screen. A Dock full to the screen's width keeps its fitted size, as a Mac's does |
| ⌥⌘D toggles hiding | built-unchecked | On and off, on the server, with the page told it is on a Mac: `e2e/desktop-batch3-journey.mjs`. Off Apple platforms Command is Control, and Control-Option-D is Show Desktop, which takes the key |
| Genie or Scale, minimize into the app's icon | built-unchecked | Scale and Genie's effect come from the System lane's setting. Minimize into the icon: no tile of its own, and the application's tile restores it, same journey. The tile carries the drawn small window of a minimized window's tile while one is minimized into it (a page cannot capture a window's pixels): `e2e/desktop-overlay-journey.mjs` |
| Bouncing tile, badge counts | done | A tile bounces as its application opens, unless Animate opening applications is off, and for a notification while the application is not in front. [Its count of notifications](#project-artifact/art_819e645e9197a100/60); an application's own unread count, such as Mail's, is not this. Same journey |
| Tile labels | built-unchecked | [The name over the tile on hover](#project-artifact/art_a7e016210b9b9bc1/598): its place above the tile is asserted in `e2e/dock-rows-journey.mjs`; screenshot not yet published |
| Dock from the keyboard | done | [⌃F3 moves the focus to the Dock](#project-artifact/art_a7e016210b9b9bc1/439) and arrows walk its tiles: `e2e/desktop-more-journey.mjs`. The key is Control-Shift-F3 off a Mac, where Control is Command |
| Dock order, removals and settings saved per account | done | Order and removals after a reload, same journey; settings, read back from the server: `e2e/dock-kept-journey.mjs` |

## Windows and apps (9: 5 done, 2 built-unchecked, 2 partial)

| Item | Status | Main |
| --- | --- | --- |
| Move, resize by eight edges, zoom, full screen, stacking | done | Moved, all eight edges measured, and a press brings a window forward: `e2e/desktop-rows-journey.mjs`. Zoom and Full Screen: `e2e/finder-rows-drive-journey.mjs` |
| Hide, Show All | built-unchecked | Hide takes the windows at once with no tile of their own, a reload keeps them hidden, the application's tile brings them all back, and Show All leaves what the person minimized: `e2e/desktop-hide-journey.mjs`, 10 of 10; screenshot not yet published. The row's old note was stale |
| Quit | done | ⌘Q quits the front application and its dot goes: `e2e/desktop-rows-journey.mjs` |
| Force Quit | done | Opened by ⌥⌘⎋ with no window open, [same screenshot](#project-artifact/art_819e645e9197a100/39). The Apple menu's row and the panel's Force Quit button were not driven here |
| ⌘H, ⌥⌘H, ⌘M, ⌘W, ⌘Q | built-unchecked | Each pressed in turn, where Command is Control, and each acts on the application in front: `e2e/dock-rows-journey.mjs`; screenshot not yet published |
| Key equivalents with no window open | done | [Force Quit opened after the last window closed](#project-artifact/art_819e645e9197a100/39), and on a fresh desktop with the focus on the body. `e2e/desktop-keys-journey.mjs`. A desktop that does not fill the page leaves such a key to the page |
| Open windows return after a reload | done | [Finder where it was moved to](#project-artifact/art_819e645e9197a100/27); another app's hidden window stays hidden, with no tile of its own, as Hide on a Mac leaves it. `e2e/desktop-dock-menus-journey.mjs`, kept per account. Each app brings back its own contents. Open at Login runs in a new tab and not on a reload; logging out and back in within one tab does not count as a new login |
| An app's further windows stay when its main window closes | built-unchecked | The main window stays mounted out of sight until the last further window that is no panel closes (`desktop-hidden.ts`): `e2e/desktop-overlay-journey.mjs` and `desktop.test.tsx`. A reload while only further windows are open does not bring them back |
| Several main windows | built-unchecked | Every application whose descriptor names `newWindowTitle`: Finder, Safari, Maps, Dictionary, Script Editor and Help Viewer. Test `desktop-new-window.test.tsx` |

## System links (6: 2 done, 4 built-unchecked)

| Item | Status | Main |
| --- | --- | --- |
| Dock pane takes effect | built-unchecked | [Position moves the Dock](#project-artifact/art_a7e016210b9b9bc1/603): `e2e/desktop-rows-journey.mjs`. Size, Magnification and Automatically hide: `e2e/dock-rows-journey.mjs`. Minimize Using, Double-click and Prefer tabs act elsewhere and were not driven here |
| Desktop picture pane takes effect | built-unchecked | |
| Screen saver starts | done | [From the Screen Saver tab and after the idle time](#project-artifact/art_7026fbcdd84f1550/4): `screen-saver-journey.mjs`, in the System Preferences inventory |
| Hot Corners take effect | done | Each action of the sheet: `e2e/mission-control-more-journey.mjs` drives Mission Control, Application Windows and Desktop; the rest in `hot-corners.test.ts`. These are the page's corners |
| Login window and lock screen | built-unchecked | `accounts-census-journey.mjs` |
| Recent items count takes effect | built-unchecked | |

## Ledger

No open row touches this shell's menus. The Storage Management note about a Notification Center document is in the Notification Center inventory.

## Build items, most used first

1. **D1 Desktop icons are the drive.** Show the Desktop folder as icons, keeping positions; select, marquee, open, Get Info, Quick Look, rename; drag out and in through C1.
2. **D2 Trash and Downloads tiles.** Trash click opens it, its menu has Open and Empty Trash, full and empty artwork. Downloads shows the real folder, with Fan, Grid, List, Sort By and Open in Finder.
3. **D3 Tile menus.** Full tile menu, Finder's tile menu, Options ▸, window list, Quit, Force Quit with Option.
4. **D4 Desktop context menu and stacks.** Context menu, real Use Stacks with Group By, Sort By, Clean Up, Snap to Grid, view options. Remove the invented stack names.
5. **D5 Windows return after a reload.** Save each open app and frame per account, reopen them. Each app restores its own contents.
6. **D6 Dock targets.** File on an app tile opens it (C1, C2); keep folders and files in the Dock; drag apps to keep; Dock context menu; ⌥⌘D.
7. **D7 Dock life.** Minimize effect and into-icon, bounce, badges, recent apps section.
8. **D8 Menu rows.** Recent Items documents, Clock date and analog, Look Up command, true Hide, menu bar hiding, honest Bluetooth and Volume.
9. **D9 Saver and corners.** Screen saver and Hot Corners take effect (with M6 in Mission Control).
10. **D10 Docs.** Correct `desktop.mdx`: its "Not built" paragraph on key equivalents is stale.
