# Feature inventory: Help Viewer

Main commit read: `e62c2ac9`, from GitHub only; the rows of the batch below were read again and built on `2698563b`. A row that names `help-viewer.*` was driven in the census journey (`e2e/help-viewer-census-journey.mjs`), and one that names a unit test ran in vitest; neither makes a row done without its screenshot.

Status: **missing**; **partial** (the note says what is absent); **built-unchecked** (in main's code, not yet seen running). No row is done: done needs a screenshot in a browser. Every status rests on main's source; a menu row's status includes its key equivalent. Scope is the hosted Ferrite desktop. Real-app wording and keys come from knowledge of macOS 10.15 (no Mac, no capture of these menus) and are provisional. Services and the window list are generated lists, so each is one row.

Read: `demos/help-viewer/help-viewer.tsx` whole, `app.ts`, `help-viewer.mdx`, the desktop README, `demos/desktop/desktop-apps.ts`, `demos/desktop/desktop-menus.tsx`, `demos/desktop/desktop-share-link.tsx` by reference, `demos/spotlight/spotlight-desktop.tsx`. The desktop registers **Go** with Back and Forward; "Shell" means the desktop's own row. Every app's Help menu has the search field and "<App> Help", which opens Help Viewer on the app's guide where it has one; Console, System Preferences, Keychain Access, Activity Monitor, Storage Management and System Information register a Help row of their own, and Terminal one for man pages alone.

## Menus

| Menu | Item | Key | Status | Notes |
| --- | --- | --- | --- | --- |
| Help Viewer | About Help Viewer | | built-unchecked | Shell |
| Help Viewer | Services | | built-unchecked | The shell's generated submenu (`ServicesItems`): the services for the selected text, or dimmed "No Services Apply". The map's "every service absent" was stale |
| Help Viewer | Hide Help Viewer | ⌘H | built-unchecked | Shell |
| Help Viewer | Hide Others | ⌥⌘H | built-unchecked | Shell |
| Help Viewer | Show All | | built-unchecked | Shell |
| Help Viewer | Quit Help Viewer | ⌘Q | built-unchecked | Shell |
| File | New Tab | ⌘T | built-unchecked | Dimmed with its reason, the desktop has tabs for Finder and Safari alone: `help-viewer-depth.test.tsx` |
| File | New Window | ⌘N | built-unchecked | The descriptor's `newWindowTitle`; help-viewer.file.new-window |
| File | Close | ⌘W | built-unchecked | Shell |
| File | Page Setup… | ⇧⌘P | built-unchecked | Dimmed with its reason, the browser's print dialog sets the page: `help-viewer-depth.test.tsx` |
| File | Print… | ⌘P | built-unchecked | Prints a copy of the page from its own frame. The dialog is the browser's, which a journey cannot drive: a spy on the frame's `print` stood for it, in `help-viewer-page-journey` |
| Edit | Undo | ⌘Z | done | The shared row, on the search or find field with the keyboard (help-viewer.edit.field) |
| Edit | Redo | ⇧⌘Z | done | Same |
| Edit | Cut | ⌘X | done | Same |
| Edit | Copy | ⌘C | done | On the field, or the page's selection; the census reads the clipboard back (help-viewer.edit.page) |
| Edit | Paste | ⌘V | done | Same, through the browser's clipboard, which may refuse and says so in a banner |
| Edit | Select All | ⌘A | done | The field with the keyboard, else the page (help-viewer.edit.page); dimmed with its reason on search results |
| Edit | Find ▸ Find… | ⌘F | done: [help-viewer-find.png](#project-artifact/art_a7e016210b9b9bc1/370) | A bar over the page |
| Edit | Find ▸ Find Next | ⌘G | done: [help-viewer-find.png](#project-artifact/art_a7e016210b9b9bc1/370) | |
| Edit | Find ▸ Find Previous | ⇧⌘G | done: [help-viewer-find.png](#project-artifact/art_a7e016210b9b9bc1/370) | |
| Edit | Find ▸ Use Selection for Find | ⌘E | built-unchecked | The shared hook; not driven here |
| Edit | Speech ▸ Start Speaking | | built-unchecked | The browser's voice, which no journey can hear; a spy stood for it in `help-viewer-page-journey`. It reads the text held as the menu opened, as Dictionary's does. Chromium 16 of 16; WebKit 27.2 16 of 16 with the journey's `readText` of Edit > Copy taken out, as WebKit refuses it |
| Edit | Speech ▸ Stop Speaking | | built-unchecked | |
| View | Show/Hide Table of Contents | ⌥⌘1 | built-unchecked | Row driven in the journey |
| View | Actual Size | ⌘0 | built-unchecked | Same |
| View | Make Text Bigger | ⌘+ | built-unchecked | Same |
| View | Make Text Smaller | ⌘- | built-unchecked | Same |
| View | Show Toolbar | | built-unchecked | Hide Toolbar when shown; kept (`helpViewer.toolbarShown`); ⌥⌘F shows it again; help-viewer.view.toolbar |
| View | Customize Toolbar… | | built-unchecked | A sheet of the items to show, as Automator's, kept (`helpViewer.toolbarHidden`); no drag palette; help-viewer.view.customize |
| View | Enter Full Screen | ⌃⌘F | built-unchecked | Shell |
| Go | Back | ⌘[ | built-unchecked | Row driven in the journey |
| Go | Forward | ⌘] | built-unchecked | |
| Go | Home | | built-unchecked | Row driven in the journey |
| Window | Minimize | ⌘M | built-unchecked | Shell |
| Window | Zoom | | built-unchecked | Shell |
| Window | Bring All to Front | | built-unchecked | Shell |
| Window | Window list | | built-unchecked | Shell; one window |
| Help | Search field | ⇧⌘? | done: [help-viewer-menu-topics.png](#project-artifact/art_6a3da0a5b88d531a/38) | Lists topics as you type; Return lists them all in Help Viewer |
| Help | Arrow pointing at a found menu item | | done: [help-viewer-menu-arrow.png](#project-artifact/art_6a3da0a5b88d531a/39) | Shows on choosing the result, not on hovering it |
| Help | Help Viewer Help | | done: [help-viewer-help-viewer-help.png](#project-artifact/art_6a3da0a5b88d531a/41) | Opens a search for "Help Viewer" |
| Every app | Help > <App> Help opens its guide | | built-unchecked | Every deployed app has a guide but About This Mac, Force Quit and Help Viewer itself, each with its reason in `help-viewer-guides.test.tsx`. The desktop's row and the rows of Finder, Safari, Music, Messages and Script Editor ask for it: `e2e/help-guides-journey.mjs`. The own rows of Console, Keychain Access, Activity Monitor, System Information, System Preferences and Storage Management open Help Viewer without asking, so the guide is one choice of the Book pop-up away until those six call `requestHelp`; Terminal has no such row |

The shell also adds Go > Applications, which the real app does not have.

## Toolbar

| Item | Status | Notes |
| --- | --- | --- |
| Back | built-unchecked | |
| Forward | built-unchecked | |
| Sidebar toggle | built-unchecked | Dimmed on results |
| Share: Copy Link | built-unchecked | The page's address, `#help=<page>` on the desktop's |
| Share: Mail | built-unchecked | The page's address, through `LinkShareItems`; help-viewer.share.mail. Off the desktop: dimmed, "no web address" |
| Share: Messages | built-unchecked | Same; help-viewer.share.messages |
| Share: Notes | built-unchecked | Same; help-viewer.share.notes |
| Share: AirDrop | built-unchecked | Dimmed: a web page cannot reach nearby devices, which the row's help tag says; help-viewer.share.airdrop |
| Search | built-unchecked | Server results first |
| Book switcher | done: [help-viewer-book-switcher.png](#project-artifact/art_a7e016210b9b9bc1/571) | The Book pop-up goes to a book's page, opens its row and titles the window; shown when the server has books. Provisional: no capture shows such a control |

## Window and contents

| Item | Status | Notes |
| --- | --- | --- |
| Panel look with small controls | built-unchecked | `variant="panel"` |
| Floats above other windows | built-unchecked | The descriptor's `floats` gives its windows a panel's level, and it keeps the menu bar while it is key. `e2e/desktop-overlay-journey.mjs` reads the levels |
| Several windows | built-unchecked | Each keeps its own history from when it opens; a reload with two windows was not driven; help-viewer.link.window |
| Tabs | built-unchecked | No tabs: File > New Tab is dimmed with the reason, the desktop has tabs for Finder and Safari alone |
| Welcome row | built-unchecked | |
| Section rows | built-unchecked | |
| Topic rows | built-unchecked | |
| Server's book "Macalicious Desktop Help" | built-unchecked | Fourteen topics |
| Divider drag | built-unchecked | 140 to 320 pt |
| Divider double click collapses | built-unchecked | |

## Pages

| Item | Status | Notes |
| --- | --- | --- |
| Welcome page | built-unchecked | |
| Section page | built-unchecked | |
| Topic page | built-unchecked | Short generic text |
| Desktop help topics | built-unchecked | One server book |
| macOS guide topics | built-unchecked | 27 topics of the demo's |
| A guide for each other app | built-unchecked | Short original guides, books on the served desktop, in `help-viewer-guides.ts`, written from each app's menus and feature rows. `e2e/help-guides-journey.mjs` reads each guide in Help Viewer and finds every menu row and key its pages name in the app's own menu bar. A server's book of the same title (Photos, TV, Podcasts, Safari) is one book with it |
| macOS Help, See What's New, Tips for Your Mac | built-unchecked | Books of their own, opened by Finder's three Help rows, and on the Book pop-up: `e2e/help-guides-journey.mjs` |
| Links between topics | built-unchecked | |
| Links that open another app | built-unchecked | "Open Notes" on a guide's topic; help-viewer.link.app |
| Links that open a Preferences pane | built-unchecked | Use the Dock, Find things with Spotlight, Safari's Share menu topic; help-viewer.link.pane |
| Real pictures | built-unchecked | The welcome page and nine guides' own pages and first topics, plus one macOS topic (`Organize your work in folders`), show pictures of this desktop, captured with Playwright by `demos/help-viewer/pictures/capture.mjs` from a served build: 13 WebP, 95 KB in all. Result rows show the desktop's Finder icon, and the Share menu's rows the applications' icons. Read loaded in `rows-batch28-journey`. **Limit:** other guides' pages have no picture, and a picture shows the window as it looked at capture, so it needs taking again when the window changes |
| Feedback: was this page helpful? | built-unchecked | Yes or No under a topic. The real app sends it to Apple; here it is kept in `helpViewer.feedback` and the reply says it is not sent; help-viewer.feedback |

## Results

| Item | Status | Notes |
| --- | --- | --- |
| "All Help" with a count | built-unchecked | |
| First six results | built-unchecked | |
| Show all | built-unchecked | |
| Open a result as a step | built-unchecked | |
| "No Results" | built-unchecked | |
| See more results on the web | built-unchecked | Opens Safari on a web search of the words; driven in the journey |
| Filter by book | done: [help-viewer-results-book.png](#project-artifact/art_a7e016210b9b9bc1/568) | A pop-up over the results when they come from several books; not kept |
| Menu item results | built-unchecked | Dimmed rows, rows of a submenu named in the app's menu elements or drawn by a shared component (Speech, Spelling and Grammar, Substitutions), and the Help menu's own rows are found and pointed at: `help-menu-search.test.tsx`, `e2e/cross-batch7-journey.mjs`. A submenu drawn by an app's own component that is not in that shared list is found by its trigger alone. The desktop's New Window row is found: `e2e/desktop-batch3-journey.mjs` |

## Context menus

| Where | Item | Status |
| --- | --- | --- |
| Page text | Copy | done: [help-viewer-page-menu.png](#project-artifact/art_a7e016210b9b9bc1/371) |
| Page text | Look Up | done: [help-viewer-page-menu.png](#project-artifact/art_a7e016210b9b9bc1/371) |
| Page text | Search with Google | done: [help-viewer-page-menu.png](#project-artifact/art_a7e016210b9b9bc1/371) |
| Page text | Speech ▸ Start Speaking | built-unchecked |
| Page text | Speech ▸ Stop Speaking | built-unchecked |
| Link | Open in New Window | built-unchecked: help-viewer.link.window |
| Link | Copy Link | built-unchecked: help-viewer.link.copy |
| Contents row | Expand | done: [help-viewer-contents-menu.png](#project-artifact/art_a7e016210b9b9bc1/569) |
| Contents row | Collapse | built-unchecked |
| Contents row | Expand All | built-unchecked |
| Contents row | Collapse All | done: [help-viewer-contents-menu.png](#project-artifact/art_a7e016210b9b9bc1/569) |

## Keys outside the menus

| Key | Status |
| --- | --- |
| Arrows in the outline | built-unchecked |
| Type-select in the outline | built-unchecked |
| Right Arrow opens an entry | built-unchecked |
| Left Arrow closes an entry | built-unchecked |
| Arrows on the divider | built-unchecked |
| Return on the divider | built-unchecked |
| Escape clears the search | built-unchecked |
| ⌥⌘F focuses the search | built-unchecked |

## Drag and drop

| Item | Status | Notes |
| --- | --- | --- |
| Drag text out of a page | built-unchecked | Browser's own, no app code |
| Drag a topic link to Notes | built-unchecked | The note gets a link to the topic's address: help-viewer.drag.notes |

The real app has no multi-selection, so nothing is listed for it.

## Saved state

| Item | Status | Notes |
| --- | --- | --- |
| Page last read reopens | done: [help-viewer-after-reload.png](#project-artifact/art_6a3da0a5b88d531a/42) | `/api/help-viewer/place` |
| Its book opens expanded | done: [help-viewer-after-reload.png](#project-artifact/art_6a3da0a5b88d531a/42) | |
| Sidebar shown | built-unchecked | After a reload, journey |
| Sidebar width | built-unchecked | Kept with the sidebar |
| Text size | built-unchecked | After a reload, journey |
| History across a reload | done: [help-viewer-history-after-reload.png](#project-artifact/art_a7e016210b9b9bc1/570) | `helpViewer.history`; Back and Forward walk it, search steps too. A page read in another browser is added as a step. The most recent part that fits one desktop value |
| Expanded rows | done: [help-viewer-history-after-reload.png](#project-artifact/art_a7e016210b9b9bc1/570) | `helpViewer.expanded` |

## Cross-app

| Item | Status | Notes |
| --- | --- | --- |
| An app's Help menu opens its guide | built-unchecked | As "Every app" in Menus, with the same six own rows that ask for nothing: `e2e/help-guides-journey.mjs`, help-viewer.guide.help-row |
| Help menu finds menu items | built-unchecked | New Window is found (`e2e/desktop-batch3-journey.mjs`), and Speech's rows, which a shared component draws (`e2e/cross-batch7-journey.mjs`). Tests in `help-menu-search.test.tsx` |
| Spotlight finds help | built-unchecked | Help's topics by title, up to five, in a Help group; opens Help Viewer on a search for the title. `e2e/spotlight-people-journey.mjs` |
| Look Up by key from a page | built-unchecked | `startLookUp` |
| Share a page | built-unchecked | A real address, `#help=<page>`, which opens Help Viewer on the page when the desktop loads or the address changes: help-viewer.link.follow, help-viewer.share.notes |

## Open work ledger

No open item for Help Viewer alone. `help-viewer-journey` passes all 9 steps in Chromium, Firefox 157 and Playwright's WebKit 27.2 on Linux, under `ferrite dev`; no other `help-viewer-*` journey was run in those two, and no live run is recorded.

## Calls made

- Apple's guide text is not copied. Each app gets a short original guide written for this desktop.
- On the served desktop only real topics should be listed; the invented search topics stay in the docs demo.
- The Help menu's search field is a shell feature; the arrow is built where the menu bar can do it.

## Build items, most used first

1. **Help menu field.** Search in every app's Help menu, results for menu items with the arrow, and topics, ⇧⌘?. Touches `desktop-menus.tsx`: coordinate with the Finder worker.
2. **Every app's Help opens its guide.** The shell launches Help Viewer on the app's book.
3. **Guides.** Server books per app; start with Notes, TextEdit, Terminal, Calculator, Finder.
4. **View and Go menus with keys.** Back, Forward, Home, Table of Contents, text sizes saved; Find in a page; Print.
5. **Book switcher and result filter.**
6. **Links that act.** Preferences panes through `requestPane`; launch apps.
7. **Share and web.** Real link for a topic, Copy Link, Mail, Messages; web results open Safari.
8. **Windows and saved state.** New Window, history, expanded rows.
9. **Floating behaviour.** A panel level for a main window, in the window manager's terms.
10. **Context menu.** Look Up, Copy, Speech, Open in New Window. Spotlight kind with the Spotlight worker.
11. **Docs.** `.mdx` "Not built" corrected.
