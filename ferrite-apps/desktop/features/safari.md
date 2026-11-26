# Feature inventory: Safari

Main commit read: `032e9894` for the rows this batch touched (`e62c2ac9` for the others), from GitHub and the clean clone. No row is done from this reading. Files read: `demos/safari/app.ts`, `safari.mdx`, `safari.tsx` (commands, menus, share menu, sidebar), `safari-web.tsx`, `demos/desktop/desktop-menus.tsx`, the README's Safari section, and the census journey's row ids. "Chromium check" below means a throwaway Playwright script drove the row with a real mouse and keyboard against `ferrite dev`; it is not a committed journey, and no screenshot is published for it.

Status: **missing**, **partial** (the note says what is absent), or **built-unchecked** (in main's code, not yet seen running). The real app's list comes from knowledge of Safari 13, not from a Mac, so check item names and shortcuts against `reference/` when building. "Call" marks a decision made here.

Calls:
- Ferrite egress limits pages to listed sites, sanitised on the server. Other pages stay in a real browser tab. That is a platform limit, so the rows it blocks stay partial and say so, and work inside the sanitised frame comes first.
- Extensions, AutoFill passwords and Develop have no meaningful stand-in: dimmed with a reason.
- Shared drag between apps, opening files, clipboard and share sheet come from the Finder and desktop integration worker.

## Menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 1 | Safari > About Safari | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/64), [Window menu](#project-artifact/art_3f7380b0451dc3ac/63) |
| 2 | Safari > Safari Extensions… | done | Call: dimmed, saying a browser runs no extensions. Read by the journey. [Safari menu](#project-artifact/art_9cacf31771edbcbc/26) |
| 3 | Safari > Preferences… ⌘, | built-unchecked | Ten panes, kept with the person's settings (`safari-settings.ts`) and read by every window. What acts, and what is dimmed with its reason shown in the pane, is in rows 115 to 117. `safari.preferences.*` in the census |
| 4 | Safari > Clear History… | done | Asks how far back. [Clear History](#project-artifact/art_9cacf31771edbcbc/11) |
| 5 | Safari > Services | built-unchecked | Text selected in the address field or in a page gets the desktop's services (`ServicesItems`): the frame reports its selection, as a frame of another origin cannot be read. `desktop-services.test.tsx`, `e2e/safari-page-menu-journey.mjs` |
| 6 | Safari > Hide Safari ⌘H | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/64), [Window menu](#project-artifact/art_3f7380b0451dc3ac/63) |
| 7 | Safari > Hide Others ⌥⌘H | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/64), [Window menu](#project-artifact/art_3f7380b0451dc3ac/63) |
| 8 | Safari > Show All | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/64), [Window menu](#project-artifact/art_3f7380b0451dc3ac/63) |
| 9 | Safari > Quit Safari ⌘Q | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/64), [Window menu](#project-artifact/art_3f7380b0451dc3ac/63) |
| 10 | File > New Window ⌘N | done | [Two windows](#project-artifact/art_9cacf31771edbcbc/8) |
| 11 | File > New Private Window ⇧⌘N | done | [Private window](#project-artifact/art_9cacf31771edbcbc/9) |
| 12 | File > New Tab ⌘T | done | The menu row was run; the key was not pressed. `safari-tabs-rows-journey`. [Three tabs](#project-artifact/art_3f7380b0451dc3ac/272) |
| 13 | File > Open File… ⌘O | built-unchecked | A sheet with the drive's Open dialog (`DriveOpenPanel`) lists HTML files and saved links, with From This Computer… for the browser's picker. A saved link opens in a new tab; an HTML file opens in a new tab made safe by the server like any page (`POST /api/safari/file-page`), with none of its pictures or stylesheets fetched and its relative links inert, as nothing else of the file can be reached. Such a tab is the start page after a reload: only web addresses are kept. Unit tests; sheet and page in the Chromium check |
| 14 | File > Open Location… ⌘L | built-unchecked | |
| 15 | File > Close Tab ⌘W | built-unchecked | With one tab the row is dimmed and ⌘W closes the window, in `media-shell-journey`; closing one of several tabs with the key has not been run |
| 16 | File > Close Window ⇧⌘W | done | Also while the page has the keyboard; a browser may keep the key |
| 17 | File > Reopen Last Closed Tab ⇧⌘T | done | Brings the tab back on its page. The menu row was run; the key was not pressed. `safari-tabs-rows-journey`. [Reopened](#project-artifact/art_3f7380b0451dc3ac/274) |
| 18 | File > Save As… ⌘S | built-unchecked | The drive's Save dialog (`DriveSavePanel`), opening on Downloads, with any home folder as Where, asking before it replaces a file. Format: Page Source; Web Archive is dimmed with its reason, as Safari holds only the page the server made safe. A file saved to Downloads joins its list. Unit test, and saved through the sheet in the Chromium check (census `safari.file.save-as-sheet` asks for a textbox named "Save As", which "Save As:" matches; that census row was not run) |
| 19 | File > Share | done | Copy Link read from the clipboard; the other rows are the desktop's shared ones and were not chosen here. [Submenu](#project-artifact/art_9cacf31771edbcbc/24) |
| 20 | File > Export as PDF… | partial | Opens the browser's print dialog, which saves a PDF: a page cannot write a PDF itself, so the web can never finish this row |
| 21 | File > Import From | built-unchecked | Submenu: Bookmarks HTML File… imports; Google Chrome… and Firefox… are dimmed, as a web page cannot read another browser's data, saying to export an HTML file instead |
| 22 | File > Export Bookmarks… | done | To Downloads. [Saved](#project-artifact/art_9cacf31771edbcbc/16) |
| 23 | File > Print… ⌘P | partial | The browser's print dialog, for the page's frame: a page cannot show a Mac's print sheet, so the web can never finish this row. Its call was seen; the dialog itself was not |
| 24 | Edit > Undo ⌘Z | built-unchecked | `EditRows`: acts on the text field that had the keyboard; dimmed, with its reason, while the page is in front. Census `safari.edit.page-in-front` |
| 25 | Edit > Redo ⇧⌘Z | built-unchecked | As Undo |
| 26 | Edit > Cut ⌘X | built-unchecked | Cuts the field's selection. Census `safari.edit.cut-in-the-field` |
| 27 | Edit > Copy ⌘C | built-unchecked | The page's selection; the clipboard itself was not read back |
| 28 | Edit > Paste ⌘V | built-unchecked | `EditRows`: into the field that had the keyboard; says so if the browser refuses the clipboard. Not run in a browser. In `EditRows` Select All comes straight after Paste, so Paste and Match Style and Delete now stand after it |
| 29 | Edit > Paste and Match Style | done | Call: dimmed with its reason; pages are read-only. The journey reads the reason. [Edit menu](#project-artifact/art_9cacf31771edbcbc/27) |
| 30 | Edit > Delete | done | Call: dimmed with its reason. The journey reads the reason. [Edit menu](#project-artifact/art_9cacf31771edbcbc/27) |
| 31 | Edit > Select All ⌘A | done | Selects the page. [Find](#project-artifact/art_9cacf31771edbcbc/1) |
| 32 | Edit > AutoFill Form ⇧⌘A | done | Call: dimmed with its reason. The journey reads the reason. [Edit menu](#project-artifact/art_9cacf31771edbcbc/27) |
| 33 | Edit > Find > Find ⌘F | done | Also from inside the page. [Find](#project-artifact/art_9cacf31771edbcbc/1) |
| 34 | Edit > Find > Find Next and Previous ⌘G, ⇧⌘G | done | [Find](#project-artifact/art_9cacf31771edbcbc/1) |
| 35 | Edit > Find > Use Selection, Jump to Selection | built-unchecked | Use Selection is run. Jump to Selection reaches the page by unit test, and scrolls this document's selection in Reader and on Safari's own pages by code; neither scroll was seen |
| 36 | Edit > Spelling and Grammar | done | Call: dimmed with its reason, as a browser's text menu does this. The journey reads the reason. [Edit menu](#project-artifact/art_9cacf31771edbcbc/27) |
| 37 | Edit > Substitutions, Transformations, Speech | done | Call: dimmed with the same reason, each read by the journey. [Edit menu](#project-artifact/art_9cacf31771edbcbc/27) |
| 38 | Edit > Emoji & Symbols, Start Dictation | done | Emoji & Symbols opens the Character Viewer; dictation types what the browser's recognizer hears, dimmed with a reason with no field or no recognizer. Both are the desktop's own rows, as AppKit adds them. [Edit menu](#project-artifact/art_9cacf31771edbcbc/27), [viewer](#project-artifact/art_9cacf31771edbcbc/25) |
| 39 | View > Always Show Tab Bar | done | Show and Hide Tab Bar, kept across a reload. [Tab menu](#project-artifact/art_9cacf31771edbcbc/4) |
| 40 | View > Show Status Bar ⌘/ | done | Shows and hides a bar along the window's foot; over a link in the page it names the address, away from one it is empty; kept across a reload. Its size is an estimate: no capture has one. [Status bar](#project-artifact/art_3f7380b0451dc3ac/2) |
| 41 | View > Show/Hide Favorites Bar ⇧⌘B | done | Both rows were run; the key was not pressed. `safari-tabs-rows-journey`. [Hidden](#project-artifact/art_3f7380b0451dc3ac/273) |
| 42 | View > Show/Hide Sidebar ⇧⌘L | done | Hide Sidebar was run from the menu and the button opened it; the key was not pressed. `safari-tabs-rows-journey`. [Sidebar](#project-artifact/art_3f7380b0451dc3ac/275) |
| 43 | View > Show Tab Overview ⇧⌘\ | done | The menu row was run; the key was not pressed. `safari-tabs-rows-journey`. [Overview](#project-artifact/art_3f7380b0451dc3ac/266) |
| 44 | View > Customize Toolbar… | done | Call: dimmed, saying the toolbar here has its one arrangement. The journey reads the reason. [View menu](#project-artifact/art_3f7380b0451dc3ac/3) |
| 45 | View > Stop ⌘. | built-unchecked | |
| 46 | View > Reload Page ⌘R | built-unchecked | |
| 47 | View > Show/Hide Reader ⇧⌘R | done | Hide Reader was run from the menu and the button showed it; the key was not pressed. `safari-tabs-rows-journey`. [Reader](#project-artifact/art_3f7380b0451dc3ac/271) |
| 48 | View > Actual Size ⌘0 | done | Kept across a reload, one zoom for every site. [Zoomed](#project-artifact/art_9cacf31771edbcbc/3) |
| 49 | View > Zoom In ⌘+ | done | [Zoomed](#project-artifact/art_9cacf31771edbcbc/3) |
| 50 | View > Zoom Out ⌘- | done | [Zoomed](#project-artifact/art_9cacf31771edbcbc/3) |
| 51 | View > Text Encoding | done | Call: dimmed, saying the server reads each page in the encoding the page names. The journey reads the reason. [View menu](#project-artifact/art_3f7380b0451dc3ac/3) |
| 52 | View > Enter Full Screen ⌃⌘F | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/64), [Window menu](#project-artifact/art_3f7380b0451dc3ac/63) |
| 53 | History > Show All History ⌘Y | done | The menu row was run; the key was not pressed. `safari-tabs-rows-journey`. [History](#project-artifact/art_3f7380b0451dc3ac/268) |
| 54 | History > Back ⌘[ | done | Menu row and key were run. The key was pressed with the address field holding the keyboard; pressed straight after a menu command, it did not go back. `safari-tabs-rows-journey`. [After Back and Forward](#project-artifact/art_3f7380b0451dc3ac/270) |
| 55 | History > Forward ⌘] | done | Menu row and key were run. `safari-tabs-rows-journey`. [After Back and Forward](#project-artifact/art_3f7380b0451dc3ac/270) |
| 56 | History > Home ⇧⌘H | built-unchecked | |
| 57 | History > Search Results SnapBack ⌥⌘S | done | Back to the latest search behind the page shown; a browser may keep the key |
| 58 | History > Reopen Last Closed Window | done | Not a private window. Read back in the journey |
| 59 | History > Reopen All Windows from Last Session | done | After Quit, brings back the windows that went with it; the window keeping the tabs comes back by itself when Safari opens. Dimmed when none are left. Held in the page: a reload forgets it, as the desktop then reopens the windows itself. [Reopened](#project-artifact/art_3f7380b0451dc3ac/5) |
| 60 | History > recent visits | built-unchecked | |
| 61 | History > Earlier Today and day submenus | done | After the ten latest, seven days at most |
| 62 | History > Clear History… | done | [Clear History](#project-artifact/art_9cacf31771edbcbc/11) |
| 63 | Bookmarks > Show Bookmarks | done | `safari-tabs-rows-journey`. [The list](#project-artifact/art_3f7380b0451dc3ac/275) |
| 64 | Bookmarks > Edit Bookmarks ⌥⌘B | done | A page of every list and folder, with search. Show Bookmarks takes ⌃⌘ 1, as on a Mac. [Page](#project-artifact/art_9cacf31771edbcbc/21) |
| 65 | Bookmarks > Add Bookmark… ⌘D | done | A sheet: Favorites, Bookmarks or a folder, and a name. Also from Share. No description: the document has none. [Sheet](#project-artifact/art_9cacf31771edbcbc/19) |
| 66 | Bookmarks > Add Bookmarks for These Tabs… | done | A sheet names a folder of the tabs' web pages. Read back from the server. [Folder](#project-artifact/art_9cacf31771edbcbc/29) |
| 67 | Bookmarks > Add to Reading List ⇧⌘D | built-unchecked | |
| 68 | Bookmarks > Add Bookmark Folder | done | Call: no key, as ⇧⌘N is New Private Window outside the editor. A sheet names it, and a name already taken gets a number. Kept on the server. [Folder](#project-artifact/art_9cacf31771edbcbc/20) |
| 69 | Bookmarks > Show Reading List ⌃⌘2 | done | The menu row was run; the key was not pressed. `safari-tabs-rows-journey`. [Reading List](#project-artifact/art_3f7380b0451dc3ac/276) |
| 70 | Bookmarks > Favorites | built-unchecked | |
| 71 | Window > Minimize ⌘M | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/64), [Window menu](#project-artifact/art_3f7380b0451dc3ac/63) |
| 72 | Window > Zoom | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/64), [Window menu](#project-artifact/art_3f7380b0451dc3ac/63) |
| 73 | Window > Show Previous Tab ⌃⇧⇥ | done | From the menu; a browser may keep the key. [Menu](#project-artifact/art_9cacf31771edbcbc/2) |
| 74 | Window > Show Next Tab ⌃⇥ | done | From the menu; a browser may keep the key. [Menu](#project-artifact/art_9cacf31771edbcbc/2) |
| 75 | Window > Move Tab to New Window | done | [Two windows](#project-artifact/art_9cacf31771edbcbc/8) |
| 76 | Window > Merge All Windows | done | Private windows merge only with private windows |
| 77 | Window > Downloads ⌥⌘L | done | [Downloads](#project-artifact/art_9cacf31771edbcbc/10) |
| 78 | Window > Bring All to Front | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/64), [Window menu](#project-artifact/art_3f7380b0451dc3ac/63) |
| 79 | Window > window list | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/64), [Window menu](#project-artifact/art_3f7380b0451dc3ac/63) |
| 80 | Help > Safari Help | built-unchecked | The row was stale: Help Viewer now has a Safari guide (`help-viewer-guides.ts`), which its search for "Safari" finds. It has two topics, and growing them is Help Viewer's. Traced, not run. [Help](#project-artifact/art_9cacf31771edbcbc/25) |
| 81 | Help > Installed Plug-ins | done | Dimmed with its reason. The journey reads the reason. [Help menu](#project-artifact/art_9cacf31771edbcbc/28) |

Menus: 81 rows; 59 done, 19 built-unchecked, 3 partial.

## Toolbar and tabs

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 82 | Back and Forward buttons | done | `safari-tabs-rows-journey`. [After Back and Forward](#project-artifact/art_3f7380b0451dc3ac/270) |
| 83 | Press and hold Back or Forward for the list | done | Held, or right-clicked. [Held Back](#project-artifact/art_9cacf31771edbcbc/15) |
| 84 | Sidebar button | done | `safari-tabs-rows-journey`. [Sidebar](#project-artifact/art_3f7380b0451dc3ac/275) |
| 85 | Smart Search field | built-unchecked | |
| 86 | Search suggestions and Top Hit | built-unchecked | Top Hit and matches from the person's own history, Favorites, bookmarks and Reading List, then the search, then what Wikipedia suggests (`GET /api/safari/suggest`, Wikipedia being the one search here). Typed words only, never an address; none in a private window; Preferences > Search turns them off. Listed in the Chromium check against the real Wikipedia. [Suggestions](#project-artifact/art_9cacf31771edbcbc/14) |
| 87 | Search engine choice | built-unchecked | Preferences > Search shows the pop-up on Wikipedia, dimmed, saying it is the one search the server may fetch. Unit test |
| 88 | Reader button | done | `safari-tabs-rows-journey`. [Reader](#project-artifact/art_3f7380b0451dc3ac/271) |
| 89 | Reload and Stop in the field | built-unchecked | |
| 90 | Share menu | built-unchecked | AirDrop and More… dimmed, each saying why, in the toolbar's menu and File > Share. Unit test on the toolbar's |
| 91 | Tab Overview button | done | `safari-tabs-rows-journey`. [Overview](#project-artifact/art_3f7380b0451dc3ac/266) |
| 92 | New Tab button | done | `safari-tabs-rows-journey`. [Three tabs](#project-artifact/art_3f7380b0451dc3ac/272) |
| 93 | Downloads toolbar button and popover | done | Appears after the first download. [Downloads](#project-artifact/art_9cacf31771edbcbc/10) |
| 94 | Tab bar: select, close | built-unchecked | |
| 95 | Tab bar: reorder by drag | built-unchecked | Census `safari.tabs.reorder-drag` |
| 96 | Pin Tab | built-unchecked | From the tab's menu and Window; small and first in the bar, no close button, stays through Close Other Tabs and ⌘W, kept across a reload. A link to another site opens a new tab, by unit test. A pinned tab now shows in every window that is not private, follows its page between them and leaves them all when unpinned (unit tests; two windows seen in the Chromium check). It cannot move to a new window, with its reason. A tab pinned in another window shows its host until it is first brought forward, as a kept tab does. [Pinned](#project-artifact/art_9cacf31771edbcbc/33) |
| 97 | Tab audio indicator and mute | built-unchecked | Mute Tab in View and the tab's menu, dimmed: pages here make no sound, since the server drops their scripts and their audio and video addresses (`rewrite.rs`). No speaker in the field for the same reason. Unit test |

Toolbar and tabs: 16 rows; 7 done, 9 built-unchecked.

## Views and windows

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 98 | Start page: Favorites, Frequently Visited | done | `safari-tabs-rows-journey`. [Both shelves](#project-artifact/art_3f7380b0451dc3ac/277) |
| 99 | Listed sites as real sanitised pages | done | Also a site whose stylesheet uses escaped class names: Ars Technica has its own layout. The blank band above its header is its ad slot, whose script does not run. [Ars Technica](#project-artifact/art_3f7380b0451dc3ac/1), [Hacker News](#project-artifact/art_3f7380b0451dc3ac/2) |
| 100 | Any other site | partial | Call: Open in New Browser Tab. A platform limit the web can never finish: a Ferrite application reaches only the destinations it names, and a site's framing headers cannot be read |
| 101 | Error pages | built-unchecked | |
| 102 | Reader | done | Size, typeface and four backgrounds, kept with the person's settings; colours are estimates. [Reader](#project-artifact/art_9cacf31771edbcbc/17) |
| 103 | Tab Overview | done | Miniatures are schematic on purpose. `safari-tabs-rows-journey`. [Overview](#project-artifact/art_3f7380b0451dc3ac/266) |
| 104 | Picture in Picture | partial | The demo page's placeholder floats. A fetched page has no video to float: the frame's Content-Security-Policy is `default-src 'none'` and the rewrite drops every media address, so that the frame makes no request of its own (`rewrite.rs`); the server cannot carry one in its place, since an egress reply stops at 1 MiB and Safari's own reply at 3 MiB (`MAX_PAGE_BYTES`, `MAX_REPLY_BYTES`). The sandbox has no `allow-same-origin` either, so the window cannot reach an element inside the frame. Keeping these is the security model, not a gap to close |
| 105 | Bookmarks sidebar and folders | done | A folder opens to its bookmarks, which rename and delete; kept across a reload. One level of folders. [Folder](#project-artifact/art_9cacf31771edbcbc/20) |
| 106 | Reading List sidebar, read state | done | Command- and Shift-click choose rows; the menu marks the chosen ones read and removes them, and only them. `safari-reading-list-journey`. [Several chosen](#project-artifact/art_3f7380b0451dc3ac/264) |
| 107 | Sidebar resize | built-unchecked | |
| 108 | History page: search, Clear History | built-unchecked | Clear History for the last hour empties a history made just now, a row's menu deletes the page, and Delete forgets the rows chosen (`safari-history-journey`): [cleared](#project-artifact/art_3f7380b0451dc3ac/263). Its search field reads the server's search by unit test, and has not been run in a browser |
| 109 | Bookmarks editor page | done | Rows select, open, rename, move and delete; a folder renames, opens in tabs and deletes after asking. No new-folder button: the Bookmarks menu has it. [Page](#project-artifact/art_9cacf31771edbcbc/21), [menu](#project-artifact/art_9cacf31771edbcbc/22) |
| 110 | Find banner | built-unchecked | On a fetched page ([banner](#project-artifact/art_9cacf31771edbcbc/1)) every match is lit by the frame's script (CSS Highlight API; a browser without it lights only the selected one), and Done clears them: Chromium check, 7 lit. In Reader and on the History and Bookmarks pages Find counts and steps through this document's text, by unit test. The start page and Tab Overview have none, and Find says so. Safari dims the rest of the page around a match; this lights the matches instead |
| 111 | Downloads list | done | Show in Finder, Remove, Clear; kept across a reload; a private window's goes with it. No progress bar: a file up to 1 MB arrives whole. [Downloads](#project-artifact/art_9cacf31771edbcbc/10) |
| 112 | Download a listed site's file to Downloads | built-unchecked | 1 MB limit |
| 113 | Private window | done | Dark address field, a note on the start page, no history (read back from the server), tabs not kept. The field's colour is an estimate: no capture has one. [Private window](#project-artifact/art_9cacf31771edbcbc/9) |
| 114 | Second Safari window | done | Its tabs are its own; the first window's are the ones kept. [Two windows](#project-artifact/art_9cacf31771edbcbc/8) |
| 115 | Preferences: General | built-unchecked | Acting: Safari opens with (a private window; last session's windows, held in the page; "A new window" still brings the kept tabs back, as this desktop keeps them), New windows and New tabs open with (Favorites, Homepage, an empty page, the same page), Homepage (History > Home; census `safari.preferences.homepage-acts`), Set to Current Page, Remove history items (forgotten on the server), Favorites shows (the start page's shelf), Top Sites shows (Frequently Visited), Remove download list items, Open "safe" files (Download Linked File only; starts off here so a download does not bring up another app unasked). Dimmed: File download location, as every download goes to Downloads. Each by unit test; only Homepage in a browser |
| 116 | Preferences: other nine panes | built-unchecked | Acting: Tabs (Command-click, make it active, ⌘1 to ⌘9), Search's Include search engine suggestions and Show Favorites (the field's suggestions), Websites (automatic Reader), Advanced's full address. Dimmed with the reason in the pane: website icons, AutoFill, Passwords, the other Search rows, Security, Privacy, Extensions, and Advanced's font size, Tab and Develop. A dimmed checkbox shows what is true here (JavaScript off, pop-ups blocked), not a Mac's default. Make it active governs Command-click, a pinned tab's link and the page menu's Open Link in New Tab; bookmark and history rows' Open in New Tab still come to the front |
| 117 | Cookies and website data | built-unchecked | Privacy has Manage Website Data… dimmed and Block all cookies dimmed and on: the server keeps no cookie and a page's frame can store nothing (no `allow-same-origin`). Census `safari.preferences.dimmed-says-why` |

Views: 20 rows; 10 done, 8 built-unchecked, 2 partial.

## Context menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 118 | Page menu | done | Back, Forward, Reload Page, Show Reader, Add Page to Bookmarks. No View Source or Inspect. [Page menu](#project-artifact/art_9cacf31771edbcbc/12) |
| 119 | Link menu | done | Open, New Tab, New Window, Download Linked File, Add to Bookmarks and Reading List, Copy Link. [Link menu](#project-artifact/art_9cacf31771edbcbc/13) |
| 120 | Image menu | built-unchecked | Save Image to Downloads, Copy Image (as PNG, says so if the browser refuses; the clipboard not read back), Open Image dimmed: a picture is written into the page, with no address left to open. Unit test on the rows |
| 121 | Selected text menu: Copy, Look Up, Search | built-unchecked | Copy, Look Up (opens Dictionary on the word, dimmed for text it cannot look up), Search. Unit test |
| 122 | Tab menu: Close, Close Other, Reload, Move, Pin, Bookmark | built-unchecked | Reload, Duplicate, Add Bookmarks for These Tabs, Mute (dimmed), Pin, Move, Close, Close Other, Close to the Right ([menu](#project-artifact/art_9cacf31771edbcbc/34), before the new rows). Pin and Close Other were run; Reload, Move from this menu and Close alone were not |
| 123 | Bookmark row menu | done | Open, New Tab, Copy Link, Rename, Move, Delete, in the sidebar too. [Menu](#project-artifact/art_9cacf31771edbcbc/31) |
| 124 | Reading List row menu | done | Open, New Tab, Copy Link, Mark Read or Unread, Remove; for several rows, with their count. Mark as Read on one row read from the server; the picture shows the several-row form. [Menu](#project-artifact/art_9cacf31771edbcbc/30) |
| 125 | Favorites bar menu | done | Rename, Move to Bookmarks, Delete, on the server. [Menu](#project-artifact/art_9cacf31771edbcbc/5) |
| 126 | Favorites tile menu | done | Open, New Tab, Copy Link, Rename, Move, Delete on a start page tile; Rename read from the server. Reading List tiles share the code and were not run. [Menu](#project-artifact/art_9cacf31771edbcbc/23) |
| 127 | History row menu | done | Open, Open in New Tab, Copy Link, Delete. Read back from the server |

Context menus: 10 rows; 7 done, 3 built-unchecked.

## Keyboard shortcuts

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 128 | Keys of the registered commands | built-unchecked | Handled while the window has the keyboard |
| 129 | ⌘1 to ⌘9 and tab switching | built-unchecked | ⌘1-9 open Favorites, as Safari's default, or show the tabs with Preferences > Tabs' box on (unit test); a browser may keep some of these keys |
| 130 | Page scrolling keys through the frame | built-unchecked | With the page's frame holding the keyboard the browser scrolls it; with the window or nothing holding it (after Return or Escape in the field) Space, Shift-Space, the arrows, Page Up, Page Down, Home and End go to the frame, and ⌘↑ and ⌘↓ go to its ends from either. The keyboard now comes back to the window after Return or Escape in the field. Unit test; PageDown and ⌘↑ moved the page in the Chromium check |
| 131 | ⌘+, ⌘-, ⌘0 | built-unchecked | ⌘= rather than ⌘+; the menu rows are run, the keys are not |
| 132 | ⌘F, ⌘G | built-unchecked | ⌘G and ⇧⌘G stepped through the matches in the Chromium check, with the window holding the keyboard and by unit test; from inside the page they go through the frame's key relay, which was not pressed |

Keys: 5 rows; 5 built-unchecked.

## Drag and drop

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 133 | Drag a link to the tab bar | done | Opens a new tab, with a real mouse. The bar must be showing: with one tab it is hidden unless Always Show Tab Bar is on. [New tab](#project-artifact/art_9cacf31771edbcbc/36) |
| 134 | Drag a URL or text to the search field | built-unchecked | A link goes there in this tab, with a real mouse. Dragged text searches by unit test on the drop itself; a person's text drag in a browser was not run |
| 135 | Drag a page to the Favorites bar | built-unchecked | A link from the start page or out of a page joins the bar, and the page itself drags from the address field at rest: it stands before the favourite it is let go on, read from the server in the Chromium check. A press that does not drag still selects the whole address. An address already in the Favorites does not move. Dragging from the field relies on a `draggable` input, and only Chromium ran that. A link dragged to the bar, the tab bar and the address field passed in Firefox 157 and Playwright's WebKit 27.2 on Linux (`safari-drag-journey`, 5 steps each). The whole census ran there on 7 November: Firefox 157 179 of 181 rows, and the two failures (the Edit menu with the page in front, a stale News row) pass after their fixes when run alone; WebKit 165 of 180, its Edit > Paste rows stopping at the app's "Safari could not paste" sheet. The shared census row now closes that sheet and reports the refusal, and `safari-census-journey --browser webkit --only safari.menu-edit` passes 7 of 7. WebKit still refuses the page the clipboard's text, so Edit > Paste from the menu does not paste there: it says so and points to Command-V. The whole WebKit census has not been run again since. [Rust on the bar](#project-artifact/art_9cacf31771edbcbc/35) |
| 136 | Reorder Favorites bar and bookmarks | built-unchecked | The Favorites bar ([edited](#project-artifact/art_9cacf31771edbcbc/6)), and now the sidebar's rows: a row dragged stands before the row it is let go on, joins Favorites or a folder let go on it, and a press opens a row when it ends rather than as it begins. Reading List rows do not reorder. Unit tests; a Favorites row moved in the Chromium check |
| 137 | Drag a bookmark into a folder | done | On the Edit Bookmarks page, to any list or folder, several at once. Read back from the server. In the sidebar one row at a time, by unit test (row 136). [Moved](#project-artifact/art_9cacf31771edbcbc/22) |
| 138 | Drag a tab out to a new window | done | Let go more than 24 points above or below the bar, with a real mouse; the new window comes to the front with the tab's history. It opens where new windows open, not under the pointer. Move Tab to New Window now brings its window forward too. [New window](#project-artifact/art_3f7380b0451dc3ac/6) |
| 139 | Drop an HTML file from Finder | built-unchecked | The window's content takes an HTML file or saved link in the desktop's drag (`useDesktopDrop`), and refuses other files saying why; a frame lets the pointer through during such a drag. A file from the computer's own Finder drops too. By unit test on the landing; the drag itself was not run |
| 140 | Drag a download to Finder | done | A row of the Downloads list drags the file; Finder takes a copy, read back from the drive and over a reload, and the row's buttons stay buttons. `safari-download-drag-journey`. [In Finder](#project-artifact/art_3f7380b0451dc3ac/262) |
| 141 | Drag an image or link out of a page | built-unchecked | A browser lets no drag leave a frame of another origin: Chromium's window saw no `dragenter`. So the frame's script reports a dragged link, and the window draws it and takes the drop on its tab bar (new tab), address field (this tab) or Favorites bar (at that place). Unit test for all three; the tab bar with a real mouse in the Chromium check. A picture drags only as the browser's own drag: it can leave for another program on the computer, and this window cannot take it, for that same reason |

Drag: 9 rows; 4 done, 5 built-unchecked.

## Multi-selection

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 142 | Several bookmarks | done | Command-click and Shift-click on the Edit Bookmarks page, then drag, Move To, Delete or Open in New Tabs. [Selected](#project-artifact/art_9cacf31771edbcbc/21) |
| 143 | Several history rows, delete | done | Command-click, Shift-click, Delete. Read back from the server |
| 144 | Several Reading List rows | done | Command-click and Shift-click choose without opening; Mark as Read, Remove and the Delete key act on them all, read from the server. Open in New Tabs was not run. [Chosen](#project-artifact/art_9cacf31771edbcbc/30) |

Multi-selection: 3 rows; 3 done.

## Saved state

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 145 | Tabs and their order | built-unchecked | |
| 146 | Bookmarks, Reading List, History | built-unchecked | |
| 147 | Preferences | built-unchecked | One document under `safari.preferences` in the person's settings. Census `safari.persist.restart.preference` |
| 148 | Back and Forward after a reload | built-unchecked | The kept tabs document holds each tab's pages too, the twenty nearest and none past 512 characters. Safari's own pages come back as the start page. Clear History forgets them. Unit tests and the server's check; Back returned from a page after a reload in the Chromium check |
| 149 | Sidebar, Favorites bar, window state | built-unchecked | The row was stale. The Favorites bar and the sidebar are kept across a reload, the sidebar by unit-tested code and as one setting for every window; the window's own frame comes back with the desktop's windows (`desktop-restore.ts`, traced, not run for Safari) |

Saved state: 5 rows; 5 built-unchecked.

## Cross-app and checks

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 150 | Links from other apps through `openUrl` | built-unchecked | |
| 151 | Spotlight web search hand-off | built-unchecked | The row was stale: Spotlight now calls `openUrl` (`spotlight-desktop.tsx:655`), so an open window takes the address as a new tab and drops none. Traced, not run |
| 152 | Spotlight finds bookmarks and history | built-unchecked | |
| 153 | Share to Mail, Messages, Notes, Reminders | built-unchecked | |
| 154 | AirDrop | partial | Call: always dimmed, saying why: a web page cannot reach another device, so the web can never finish this row |
| 155 | Open an HTML or webloc file from Finder | built-unchecked | A `.webloc` or `.url` opens in Safari. An HTML file opens in Safari by double-click and under Open With (`opens` in `app.ts`), and shows as row 13; TextEdit still takes it through Open With. By unit test on the request |
| 156 | Show a download in Finder | built-unchecked | |
| 157 | Copy Link | built-unchecked | |
| 158 | Hand-offs from News and Stocks | built-unchecked | |
| 159 | Dock menu: New Tab, tabs | done | New Tab opens a second tab, and a tab's row shows that tab. `media-dock-journey`. [Dock menu](#project-artifact/art_3f7380b0451dc3ac/211) |
| 160 | Siri opening a page | built-unchecked | The row was stale: "search the web for ..." opens Safari through `openUrl` (`desktop-siri-answers.ts:411`). Traced, not run; opening a named website by voice is Siri's to add |
| 161 | Visual results and floating-video pixel checks | built-unchecked | `npm run visual -- safari` on `853c7fd9`: 52 of 52 Safari comparisons, floating video among them, and 40 of 40 of the tab bar, in both appearances at 1x and 2x, inside their budgets (Chromium) |

Cross-app: 12 rows; 1 done, 9 built-unchecked, 2 partial.

## Build items, most-used first

1. **Find in page and text edit commands:** Find banner, Find Next, Edit menu. Rows 24-31, 33-35, 110, 132.
2. **Zoom and tab keys:** Actual Size, Zoom In and Out, ⌘1-9, next and previous tab. Rows 48-50, 73-74, 129, 131.
3. **Tab bar depth:** tab menu, Pin, Always Show Tab Bar, Close Other. Rows 39, 96, 122.
4. **Bookmarks editing:** Add sheet, folders, editor page, row menus, reorder, drag, multi-select. Rows 64-66, 68, 109, 123, 125-126, 135-137, 142.
5. **Multiple windows and private browsing:** New Window, Move Tab, Merge, private. Rows 10-11, 16, 75-76, 113-114, 138.
6. **Downloads:** Window > Downloads, toolbar popover, list, drag out. Rows 77, 93, 111, 140.
7. **History depth:** day submenus, Clear History ranges, row menu, multi-select, reopen window and session. Rows 4, 58-59, 61-62, 127, 143.
8. **Page context menus through the frame's relay.** Rows 118-121.
9. **Reading List:** row menu, multi-select. Rows 124, 144.
10. **Search suggestions, SnapBack, hold Back for the list.** Rows 57, 83, 86-87.
11. **File commands:** Open File, Save As, PDF, print, import and export bookmarks, Share menu row. Rows 13, 18-23, 155.
12. **Reader depth and Preferences carried out.** Rows 3, 102, 115-116.
13. **View rows:** Status Bar, Customize Toolbar, Text Encoding, plus saved view state. Rows 40, 44, 51, 148-149.
14. **Drag in:** links and URLs to the tab bar and field, HTML from Finder. Rows 133-134, 139, 141.
15. **Cross-app:** Dock menu, Siri, confirm the Spotlight hand-off once its owner lands it. Rows 151, 159-160.
16. **Visual results on main.** Row 161.
17. **Dimmed rows with reasons:** Extensions, AutoFill, spelling rows, Help, data. Rows 2, 29-30, 32, 36-38, 80-81, 97, 104, 117, 130.

## Counts (by hand)

161 rows: 91 done, 63 built-unchecked, 7 partial. The 7 partial are rows 5, 20, 23, 100, 104, 154 and 161: row 5 waits on the desktop's Services module and row 161 on a visual run; the other five are what a web page cannot finish, each with its reason.
