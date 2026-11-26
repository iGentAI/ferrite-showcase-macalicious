# Feature inventory: News

Main commit read: `e62c2ac9`, from GitHub only. A row is done only where `e2e/news-depth-journey.mjs` ran it in the running desktop and a screenshot is linked from it.

Status: **done** (ran in the desktop, screenshot linked), **missing**, **partial** (the note says what is absent), or **built-unchecked** (in main's code, not yet seen running). The real app's list comes from knowledge of macOS 10.15 News, not from a Mac. "Call" marks a decision made here. News registers File, Edit, View and Story items (`demos/news/news-menus.tsx`) above the shell's rows.

Calls:
- The server's News module keeps publishers' feeds, never an article. A story's article is read through Safari's route for the sites Safari lists, kept nowhere and left out of Safari's History; on any other host the reader shows the feed summary and says why. Read Full Story still opens it in Safari.
- Apple's Suggest More and Suggest Less steer ranking the feeds do not have. Here they raise or lower a channel's share of Today, kept in the library.
- Follow Channel and Block Channel act on the open story's channel, else the channel page's; elsewhere they are dimmed with the reason.

## Menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 1 | News > About News | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/71), [Window menu](#project-artifact/art_3f7380b0451dc3ac/72) |
| 2 | News > Preferences… | done | Dimmed, saying "News has no preferences". `news-rows-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/133) |
| 3 | News > Services | built-unchecked | With no text selected "No Services Apply", as on a Mac; text selected in the window gets the desktop's services (`ServicesItems`) |
| 4 | News > Hide News | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/71), [Window menu](#project-artifact/art_3f7380b0451dc3ac/72) |
| 5 | News > Hide Others | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/71), [Window menu](#project-artifact/art_3f7380b0451dc3ac/72) |
| 6 | News > Show All | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/71), [Window menu](#project-artifact/art_3f7380b0451dc3ac/72) |
| 7 | News > Quit News | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/71), [Window menu](#project-artifact/art_3f7380b0451dc3ac/72) |
| 8 | File > Follow Channel | done | Unfollow while followed; follow and unfollow read back from the server. [File menu](#project-artifact/art_f377c8a61a104f0d/4) |
| 9 | File > Share Story | done | Submenu of the share rows; Copy Link read back by pasting. [File menu](#project-artifact/art_f377c8a61a104f0d/4) |
| 10 | File > Close Window ⌘W | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/71), [Window menu](#project-artifact/art_3f7380b0451dc3ac/72) |
| 11 | File > Print | done | Call: dimmed, as Safari prints a story: Read Full Story opens it there. Read by the journey. [Menu run](#project-artifact/art_3f7380b0451dc3ac/13) |
| 12 | Edit > Undo | done | Takes a paste back in the search field. `news-rows-journey`. [Field](#project-artifact/art_3f7380b0451dc3ac/143) |
| 13 | Edit > Redo | done | Makes the paste again. `news-rows-journey`. [Field](#project-artifact/art_3f7380b0451dc3ac/143) |
| 14 | Edit > Cut | done | Takes the selected text out of the field. `news-rows-journey`. [Field](#project-artifact/art_3f7380b0451dc3ac/143) |
| 15 | Edit > Copy | done | Copies the text selected on the page, or the field's. `news-rows-journey`. [Field](#project-artifact/art_3f7380b0451dc3ac/143) |
| 16 | Edit > Paste | done | Puts text in the field; dimmed with its reason when no field has the keyboard. `news-rows-journey`. [Field](#project-artifact/art_3f7380b0451dc3ac/143) |
| 17 | Edit > Select All | done | Chooses the whole list in Saved Stories or History, ⌘A too; dimmed, saying why, elsewhere. [Chosen](#project-artifact/art_3f7380b0451dc3ac/48) |
| 18 | Edit > Find in Story | done | A find bar with the keyboard in it says where the word stands, or Not Found; Escape closes it. Dimmed with its reason when no story is open. `news-rows-journey`. [Find](#project-artifact/art_3f7380b0451dc3ac/136) |
| 19 | View > Show/Hide Sidebar | done | ⌥⌘S too. [View menu](#project-artifact/art_f377c8a61a104f0d/2) |
| 20 | View > Go Back ⌘[ | done | [View menu](#project-artifact/art_f377c8a61a104f0d/2) |
| 21 | View > Go to Today | done | [View menu](#project-artifact/art_f377c8a61a104f0d/2) |
| 22 | View > Reload ⌘R | built-unchecked | Asks the server for the shown feeds now, dimmed where a view reads none. A reload asks with `?fresh=1`: the server reads the publisher again unless its copy is under a minute old, so one person's key held down does not reach a publisher. `e2e/media-batch4-journey.mjs` read the request and a repeat within the minute answering the kept copy. The publisher's own read was not told apart from a cached answer in the browser. [View menu](#project-artifact/art_f377c8a61a104f0d/2) |
| 23 | View > Actual Size, Bigger, Smaller | done | ⌘0, ⌘= and ⌘-. A story's text in five sizes, kept for the person across a reload, each row dimmed at its end with the reason. Call: applies to the open story; lists keep their size. [Story at its size](#project-artifact/art_3f7380b0451dc3ac/13) |
| 24 | View > Enter Full Screen | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/71), [Window menu](#project-artifact/art_3f7380b0451dc3ac/72) |
| 25 | Story > Save Story ⌘S | done | Remove from Saved Stories while saved; read back from the server. [Story menu](#project-artifact/art_f377c8a61a104f0d/3) |
| 26 | Story > Suggest More | done | Call: dimmed, as stories are listed newest first and nothing learns from a suggestion. Read by the journey. [Story menu](#project-artifact/art_3f7380b0451dc3ac/13) |
| 27 | Story > Suggest Less | done | Call: dimmed for the same reason. [Story menu](#project-artifact/art_3f7380b0451dc3ac/13) |
| 28 | Story > Block Channel | done | Unblock while blocked; read back from the server. [Story menu](#project-artifact/art_f377c8a61a104f0d/3) |
| 29 | Story > Report a Concern | done | Call: dimmed, as public feeds have no one to send a report to. Read by the journey. [Story menu](#project-artifact/art_3f7380b0451dc3ac/13) |
| 30 | Story > Open in Safari | done | Safari opens at the story's link. [Story menu](#project-artifact/art_f377c8a61a104f0d/3) |
| 31 | Window > Minimize | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/71), [Window menu](#project-artifact/art_3f7380b0451dc3ac/72) |
| 32 | Window > Zoom | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/71), [Window menu](#project-artifact/art_3f7380b0451dc3ac/72) |
| 33 | Window > Bring All to Front | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/71), [Window menu](#project-artifact/art_3f7380b0451dc3ac/72) |
| 34 | Window > window list | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/71), [Window menu](#project-artifact/art_3f7380b0451dc3ac/72) |
| 35 | Help > News Help | built-unchecked | Opens News' guide in Help Viewer: `e2e/help-guides-journey.mjs` |

Menus: 35 rows; 32 done, 1 built-unchecked, 2 partial.

## Views, sidebar, toolbar

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 36 | Today | done | The masthead and the leads of the channels followed. `news-rows-journey`. [Today](#project-artifact/art_3f7380b0451dc3ac/151) |
| 37 | Top Stories | done | More Top Stories lists all the stories of the channels followed. `news-rows-journey`. [Top Stories](#project-artifact/art_3f7380b0451dc3ac/152) |
| 38 | Saved Stories | done | The reader's Save keeps a story on the server and the view lists it. `news-rows-journey`. [Saved](#project-artifact/art_3f7380b0451dc3ac/142) |
| 39 | History, Clear History | done | Opening a story keeps it; Clear History empties it on the server and in the window. `news-rows-journey`. [History](#project-artifact/art_3f7380b0451dc3ac/134) |
| 40 | Discover Channels | done | 22 channels with Follow and Block. `news-rows-journey`. [Discover](#project-artifact/art_3f7380b0451dc3ac/131) |
| 41 | Channel page: Follow, Block | done | Follow joins the sidebar, on the server; Block ends the following, empties the page and dims Follow. `news-rows-journey`. [Channel](#project-artifact/art_3f7380b0451dc3ac/135), [blocked](#project-artifact/art_3f7380b0451dc3ac/138) |
| 42 | Topic page | done | Ten topics in the sidebar; a page merges its channels' stories. `news-rows-journey`. [Topic](#project-artifact/art_3f7380b0451dc3ac/153) |
| 43 | Story reader | built-unchecked | The article, from `/api/safari/page`, on Safari's listed sites: an Ars Technica story read 18 paragraphs, each equal to Safari's reader, and nothing in Safari's History. A host not listed (The Guardian) says so and shows the feed summary. `small-rows-batch9-journey.mjs`, `news-live.test.ts`. Limit: the hosts in `safari/policy.rs`; feeds on other hosts need declaring there. [Reader](#project-artifact/art_3f7380b0451dc3ac/139) |
| 44 | Search | done | Only feeds already read; a search that finds nothing says so. `news-rows-journey`. [Search](#project-artifact/art_3f7380b0451dc3ac/143) |
| 45 | Sidebar toggle | done | The toolbar's button hides and shows it. `news-rows-journey`. [Hidden](#project-artifact/art_3f7380b0451dc3ac/149) |
| 46 | Toolbar Back | done | Dimmed with no story open, enabled with one, and goes back to the list. `news-rows-journey`. [Reader](#project-artifact/art_3f7380b0451dc3ac/139) |
| 47 | Toolbar Share | done | Open in Safari, Mail, Messages, Notes, Reminders, Copy Link and Save; dimmed with its reason until a story is open. `news-rows-journey`. [Share menu](#project-artifact/art_3f7380b0451dc3ac/145) |
| 48 | Feed failure status | done | A feed that cannot be read says so and the others' stories stay; the next good read clears it. `news-rows-journey`. [Status](#project-artifact/art_3f7380b0451dc3ac/132) |
| 49 | Today widget in Notification Center | built-unchecked | |
| 50 | Sidebar editing, reorder channels | done | A real drag with a line where it lands, and Move Up and Move Down in a channel's menu. Kept on the server, over a reload. Call: topics stay in their order, as the library keeps channels only. [Drag](#project-artifact/art_3f7380b0451dc3ac/47) |
| 51 | Suggested For You section | done | Stories of channels neither followed nor blocked. `news-rows-journey`. [Section](#project-artifact/art_3f7380b0451dc3ac/150) |

Views: 16 rows; 14 done, 1 built-unchecked, 1 partial.

## Context menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 52 | Story card menu: Open, Save, Share, Copy Link | done | Open in Safari too; the save and the History entry read back from the server, Copy Link by pasting. [Card menu](#project-artifact/art_f377c8a61a104f0d/6) |
| 53 | Channel row menu: Unfollow, Block | done | Sidebar and Discover rows; read back from the server. [Channel menu](#project-artifact/art_f377c8a61a104f0d/8) |
| 54 | Topic row menu | built-unchecked | Unfollow Topic takes it out of the sidebar, kept in the desktop's settings; Discover lists Topics and follows it again (`media-batch-journey`, `news-topics.test.tsx`). Block Topic stays dimmed with the reason: Today reads channels, not topics, so a topic has no stories to block |
| 55 | Saved and History row: Remove | done | One row, the others stay; read back from the server. [History menu](#project-artifact/art_f377c8a61a104f0d/7) |

Context menus: 4 rows; 3 done, 1 built-unchecked.

## Keyboard shortcuts

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 56 | ⌘[ back | done | Heard wherever the focus is while the window is key. [View menu](#project-artifact/art_f377c8a61a104f0d/2) |
| 57 | ⌘R reload | done | Reads the feeds, does not reload the desktop, with the focus outside the window too; what it reads is row 22's. [View menu](#project-artifact/art_f377c8a61a104f0d/2) |
| 58 | Search focus | done | ⌘F, Edit > Search. [Edit menu](#project-artifact/art_f377c8a61a104f0d/5) |
| 59 | Arrow keys between stories | done | With the keyboard in a list, the four arrows go to the nearest story that way; Return opens it. Run in Saved Stories by `e2e/news-sidebar-journey.mjs`. Today uses the same code, not run. [Drag](#project-artifact/art_3f7380b0451dc3ac/47) has the window, not the keys |
| 60 | ⌘S save | done | Read back from the server. [Story menu](#project-artifact/art_f377c8a61a104f0d/3) |

Keys: 5 rows; 5 done.

## Drag and drop

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 61 | Drag a story's link to Safari, Notes or Mail | built-unchecked | A story drags as its address. Dropped on a note, a Mail message and Safari's address field, in `e2e/media-batch4-journey.mjs`, which read the address back from each. Screenshot not yet published |
| 62 | Reorder channels in the sidebar | done | Row 50. [Drag](#project-artifact/art_3f7380b0451dc3ac/47) |
| 63 | Drop a web address to find its channel | built-unchecked | Opens the channel that publishes from that host; otherwise says none does. Call: only listed feeds can match. A story dragged from this window does not count. `media-batch-journey` with a dispatched drop event, no real drag from Safari; `news-topics.test.tsx` |

Drag: 3 rows; 1 done, 2 built-unchecked.

## Multi-selection

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 64 | Several Saved Stories: remove | done | Command-click and Shift-click choose them; a chosen story's menu, Delete, Escape and Edit > Select All act on them. Read back from the server. [Chosen](#project-artifact/art_3f7380b0451dc3ac/48) |
| 65 | Several History rows: remove | done | The same, run with Delete. [Chosen](#project-artifact/art_3f7380b0451dc3ac/48) |

Multi-selection: 2 rows; 2 done.

## Saved state

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 66 | Followed, blocked, Saved (150), History (60) | done | Read back from the server after a reload; a full Saved Stories refuses one more and says so, History takes the newest. `news-rows-journey`. [Kept](#project-artifact/art_3f7380b0451dc3ac/137), [full](#project-artifact/art_3f7380b0451dc3ac/141) |
| 67 | Feeds cached 15 minutes on the server | done | Two reads of a feed answer the server's copy, read back by `news-rows-journey`; the picture shows the status line beside it. [Status](#project-artifact/art_3f7380b0451dc3ac/132) |
| 68 | Last view and sidebar | done | Both kept in the desktop's settings, read back from the server and over a reload; a channel or topic no longer listed falls back to Today (that fallback is not driven by a journey). [Kept](#project-artifact/art_3f7380b0451dc3ac/33) |

Saved state: 3 rows; 3 done.

## Cross-app and checks

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 69 | Read Full Story opens Safari | done | At the story's address. `news-rows-journey`. [Safari](#project-artifact/art_3f7380b0451dc3ac/140) |
| 70 | Share to Mail, Messages, Notes, Reminders | done | Each carries the story's link. `news-rows-journey`. [Mail](#project-artifact/art_3f7380b0451dc3ac/144), [Messages](#project-artifact/art_3f7380b0451dc3ac/146), [Notes](#project-artifact/art_3f7380b0451dc3ac/147), [Reminders](#project-artifact/art_3f7380b0451dc3ac/148) |
| 71 | Copy Link | done | The story's address, read back from the clipboard. `news-rows-journey`. [Share menu](#project-artifact/art_3f7380b0451dc3ac/145) |
| 72 | Dock menu | done | `media-dock-journey`. [Dock menu](#project-artifact/art_3f7380b0451dc3ac/154) |
| 73 | Spotlight finds saved stories | done | Lists one under Saved Stories and opens it in the reader. `media-spotlight-journey`. [Spotlight](#project-artifact/art_3f7380b0451dc3ac/155) |
| 74 | WebKit journey | built-unchecked | Playwright's WebKit 27.2 on Linux: `news-journey` passed all 19 steps on an earlier build, and `news-rows-journey` passes all 50. Edit > Copy of text selected on the page works there now: a press on a menu row takes the page's selection away in WebKit, so the shared rows in `demos/desktop/desktop-edit-rows.tsx` hold what was selected as the menu opens and select it again to copy it, and it stays selected after. WebKit refuses a script's clipboard read, so Edit > Paste says to press the key, and the journey pastes with the key and reads Copy Link and Copy back by pasting. No first-party read was cancelled in these runs; `watch` is unchanged. A real Safari was not run |
| 75 | Firefox journey | built-unchecked | Firefox 157: `news-journey` 19 steps and `news-rows-journey` 49 steps pass, two passes each on 6 November, the first on an earlier build of that day |
| 76 | Visual results | built-unchecked | `npm run visual -- news` on `853c7fd9`: 8 of 8 comparisons of the News window, in both appearances at 1x and 2x, inside their budgets (Chromium), and 8 of 8 of the shared `catalyst-chrome` it asks for |

Cross-app: 8 rows; 5 done, 2 built-unchecked, 1 partial.

## Build items, most-used first

1. **Menus carry the commands:** Back, Sidebar, Today, Reload, Save, Open in Safari, Block, Follow, Share; their keys. Rows 8-9, 19-22, 25, 28, 30, 56-58, 60.
2. **Story card and row menus,** remove one saved or history row. Rows 52-55.
3. **Multi-select** in Saved and History. Rows 64-65.
4. **Text size and arrow keys through the stories.** Rows 23, 59.
5. **Sidebar editing and reorder.** Rows 50, 62, 68.
6. **Suggest More, Suggest Less and For You.** Rows 26-27, 51.
7. **Drag a story's link out.** Rows 61, 63.
8. **Preferences, print, Find, Spotlight, Dock.** Rows 2, 11, 18, 72-73.
9. **Ledger:** visual results. Row 76.
10. **Dimmed rows with reasons.** Rows 12-17, 29, 35.

## Counts (by hand)

76 rows: 65 done, 7 built-unchecked, 4 partial.
