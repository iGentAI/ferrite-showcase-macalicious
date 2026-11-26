# Feature inventory: Stocks

Main commit read: `e62c2ac9`, from GitHub only. A row marked done was seen working in the running app by `e2e/stocks-depth-journey.mjs`; the rest were not run. Files read: `demos/stocks/app.ts`, `stocks-desktop.tsx`, part of `stocks.tsx` (alerts), `stocks.mdx` (window and Ferrite sections), `demos/desktop/desktop-menus.tsx`.

Status: **done** (seen working, with a screenshot), **missing**, **partial** (the note says what is absent), or **built-unchecked** (in main's code, not yet seen running). The real app's list comes from knowledge of macOS 10.15 Stocks, not from a Mac. "Call" marks a decision made here.

Calls:
- Price alerts are not in the real app. They stay, since they work and the owner asked for depth, not removal.
- Stories come from CNBC's feeds, not Apple News, so a story opens at its publisher.
- Ledger: Stocks' journey and lease items are done (`bf2da9da`, `84305a70`, `625f794a`, `3bdae0fb`) and carry no open item.

## Menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 1 | Stocks > About Stocks | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/74), [Window menu](#project-artifact/art_3f7380b0451dc3ac/76) |
| 2 | Stocks > Preferences… | done | Dimmed, saying why. `stocks-rows-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/176) |
| 3 | Stocks > Services | built-unchecked | With no text selected "No Services Apply", as on a Mac; text selected in the window gets the desktop's services (`ServicesItems`) |
| 4 | Stocks > Hide Stocks | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/74), [Window menu](#project-artifact/art_3f7380b0451dc3ac/76) |
| 5 | Stocks > Hide Others | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/74), [Window menu](#project-artifact/art_3f7380b0451dc3ac/76) |
| 6 | Stocks > Show All | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/74), [Window menu](#project-artifact/art_3f7380b0451dc3ac/76) |
| 7 | Stocks > Quit Stocks | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/74), [Window menu](#project-artifact/art_3f7380b0451dc3ac/76) |
| 8 | File > Close Window ⌘W | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/74), [Window menu](#project-artifact/art_3f7380b0451dc3ac/76) |
| 9 | File > New Window | done | Call: unavailable, one window; dimmed, saying why. `stocks-rows-journey`. [File menu](#project-artifact/art_3f7380b0451dc3ac/180) |
| 10 | Edit > Undo | built-unchecked | Acts on the search field; dimmed elsewhere, saying why. `media-batch-journey` read each step back from the field; screenshot not yet published |
| 11 | Edit > Redo | built-unchecked | As Undo, read back from the field by `media-batch-journey` |
| 12 | Edit > Cut | built-unchecked | As Undo, read back from the field by `media-batch-journey` |
| 13 | Edit > Copy | built-unchecked | As Undo, read back by pasting in `media-batch-journey` |
| 14 | Edit > Paste | built-unchecked | As Undo, read back from the field by `media-batch-journey`; where the browser refuses, the sidebar's footer says so |
| 15 | Edit > Select All | done | The menu and ⌘A select every row listed; in the search field the key selects its text. [Several symbols](#project-artifact/art_9dc5782fe74c1b2e/5) |
| 16 | Edit > Find ⌘F | done | `stocks-depth-journey`: the menu and the key give the search field the keyboard. [View menu](#project-artifact/art_9dc5782fe74c1b2e/2) |
| 17 | View > Show/Hide Sidebar | done | The row and ⌥⌘S; Find shows it again; Delete removes nothing from a hidden list. [Hidden](#project-artifact/art_3f7380b0451dc3ac/23) |
| 18 | View > Refresh ⌘R | done | The menu and the key each ask the server for the quotes. [View menu](#project-artifact/art_9dc5782fe74c1b2e/2) |
| 19 | View > Back ⌘[ | done | The menu and the key go back to the news; dimmed there, saying why. [View menu](#project-artifact/art_9dc5782fe74c1b2e/2) |
| 20 | View > Chart ranges by key | done | ⌘1 to ⌘7 and the menu's radio rows; dimmed on the news, saying why. [View menu](#project-artifact/art_9dc5782fe74c1b2e/2) |
| 21 | View > Enter Full Screen | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/74), [Window menu](#project-artifact/art_3f7380b0451dc3ac/76) |
| 22 | Window > Minimize | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/74), [Window menu](#project-artifact/art_3f7380b0451dc3ac/76) |
| 23 | Window > Zoom | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/74), [Window menu](#project-artifact/art_3f7380b0451dc3ac/76) |
| 24 | Window > Bring All to Front | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/74), [Window menu](#project-artifact/art_3f7380b0451dc3ac/76) |
| 25 | Window > window list | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/74), [Window menu](#project-artifact/art_3f7380b0451dc3ac/76) |
| 26 | Help > Stocks Help | built-unchecked | Opens Stocks' guide in Help Viewer: `e2e/help-guides-journey.mjs` |

Menus: 26 rows; 19 done, 5 built-unchecked, 2 partial.

## Views, sidebar, toolbar

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 27 | Watchlist | done | A new one lists the three indexes and Apple. `stocks-rows-journey`. [Watchlist](#project-artifact/art_3f7380b0451dc3ac/183) |
| 28 | Sparklines | done | Each row has the day's. `stocks-rows-journey`. [Watchlist](#project-artifact/art_3f7380b0451dc3ac/183) |
| 29 | Badge: change, percent, market cap | done | Cycles through them and comes back. `stocks-rows-journey`. [Watchlist](#project-artifact/art_3f7380b0451dc3ac/183) |
| 30 | Business News | done | Lists its stories. `stocks-rows-journey`. [Watchlist](#project-artifact/art_3f7380b0451dc3ac/183) |
| 31 | Symbol view: chart, seven ranges | done | `stocks-rows-journey`. [Symbol](#project-artifact/art_3f7380b0451dc3ac/182) |
| 32 | Figures | done | `stocks-rows-journey`. A price figure the provider has no value for yet (0 or nothing) shows a dash: `stocks-desktop.test.tsx`. [Symbol](#project-artifact/art_3f7380b0451dc3ac/182) |
| 33 | Stories about the symbol | built-unchecked | A symbol's view leads with the feed's stories that name the symbol or its company, in the feed's order, then the rest of the feed, four in all. The feed is general business news and says nothing of symbols, so the choice is by whole-word match on the headline and summary. `stocks-stories.test.ts` holds the order; `e2e/media-batch4-journey.mjs` checks it against the real feed on a day it names a listed symbol. Screenshot not yet published |
| 34 | Search, add a symbol | done | Search narrows the list; Add puts the symbol on the watchlist, on the server. `stocks-rows-journey`. [Search](#project-artifact/art_3f7380b0451dc3ac/174) |
| 35 | Remove a symbol from Share | done | Share > Remove from Watchlist removes it on the server. `stocks-rows-journey`. [Share menu](#project-artifact/art_3f7380b0451dc3ac/173) |
| 36 | Price alerts | done | Kept on the server and fired by it against the real quote, in `stocks-rows-journey`. [Fired alert](#project-artifact/art_3f7380b0451dc3ac/96) |
| 37 | Reading a story | built-unchecked | A headline, or Read Story in its menu, opens the story in the window with what the publisher's feed says of it; Back returns; Read the Whole Story at the publisher opens it in Safari. Call: a feed carries a summary, not the article, and the window says nothing it cannot read. `stocks-desktop.test.tsx`; `e2e/media-batch4-journey.mjs` against CNBC's real feed. Screenshot not yet published |
| 38 | Toolbar Back | done | Goes back to Business News, and is then dimmed. `stocks-rows-journey`. [Symbol](#project-artifact/art_3f7380b0451dc3ac/182) |
| 39 | Toolbar Share | done | The shared link rows and Remove from Watchlist; dimmed on News. `stocks-rows-journey`. [Share menu](#project-artifact/art_3f7380b0451dc3ac/173) |
| 40 | Quotes source and time, footer | done | Every part ran against an answer from CNBC. `stocks-rows-journey`. [Watchlist](#project-artifact/art_3f7380b0451dc3ac/183) |
| 41 | Watchlist Edit mode | done | The footer's Edit and Edit > Edit Watchlist show a remove button and a drag grip on each row; both save on the server; Done ends it. Call: the button removes at once, without iOS's second press. Sizes are provisional. [Edit mode](#project-artifact/art_9dc5782fe74c1b2e/6) |
| 42 | Stocks widget in Notification Center | done | Lists the watchlist, read from the server. [Today](#project-artifact/art_3f7380b0451dc3ac/97) |

Views: 16 rows; 14 done, 2 built-unchecked.

## Context menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 43 | Watchlist row menu: Remove, Share, Alert | done | Add Price Alert… shows the symbol with the keyboard in the price and the alert is kept on the server; Share's Copy Symbol and Copy Link reach the clipboard (its Mail, Messages, Notes and Reminders rows were not chosen); Remove saves the list. [Row menu](#project-artifact/art_9dc5782fe74c1b2e/4) |
| 44 | Story menu: Open, Copy Link, Share | done | Open Story loads the address in Safari; Copy Link reaches the clipboard; Share lists the targets (none chosen). [Story menu](#project-artifact/art_9dc5782fe74c1b2e/3) |

Context menus: 2 rows; 2 done.

## Keyboard shortcuts

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 45 | Up and Down in the watchlist | done | Each shows the row reached, which keeps the keyboard. [View menu](#project-artifact/art_9dc5782fe74c1b2e/2) |
| 46 | Delete removes the symbol | done | The key and Edit > Delete save the list on the server, then show the next row; in the search field the key edits text. [View menu](#project-artifact/art_9dc5782fe74c1b2e/2) |
| 47 | Escape empties the search | done | And shows the whole list again. `stocks-rows-journey`. [Search](#project-artifact/art_3f7380b0451dc3ac/174) |
| 48 | ⌘F focuses the search | done | See row 16. [View menu](#project-artifact/art_9dc5782fe74c1b2e/2) |

Keys: 4 rows; 4 done.

## Drag and drop

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 49 | Reorder the watchlist | done | A row dragged to the top takes that place, on the server. `stocks-rows-journey`. [Reordered](#project-artifact/art_3f7380b0451dc3ac/177) |
| 50 | Drag a story's link out | done | A story's headline is a link: dragged into a text field it drops its address, read back by `e2e/stocks-view-journey.mjs` (Chromium). |
| 51 | Drop a symbol as text | done | A watchlist row dragged into a text field drops its symbol; the row still reorders. [Dropped](#project-artifact/art_3f7380b0451dc3ac/27) |

Drag: 3 rows; 3 done.

## Multi-selection

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 52 | Several symbols: remove | done | ⌘-click, Shift-click, Shift-arrows; the row menu and Delete remove them all, saved on the server; the footer counts them. [Several symbols](#project-artifact/art_9dc5782fe74c1b2e/5) |

Multi-selection: 1 row; 1 done.

## Saved state

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 53 | Watchlist and order | done | Kept in their order over a reload, with the alert. `stocks-rows-journey`. [After a reload](#project-artifact/art_3f7380b0451dc3ac/179) |
| 54 | Alerts | done | Still listed after a reload, in `stocks-rows-journey`. [Fired alert](#project-artifact/art_3f7380b0451dc3ac/96) |
| 55 | Last symbol, range, badge | done | All three, and the hidden sidebar, survive a reload. [After a reload](#project-artifact/art_3f7380b0451dc3ac/24) |

Saved state: 3 rows; 3 done.

## Cross-app

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 56 | Share links through the shared helper | done | Share > Notes puts the symbol's page in a new note. `stocks-rows-journey`. [Note](#project-artifact/art_3f7380b0451dc3ac/181) |
| 57 | Alert notifications | done | The server notifies when it fires an alert, so it reaches Notification Center whether or not Stocks is open. [Fired alert](#project-artifact/art_3f7380b0451dc3ac/96) |
| 58 | Stories open in Safari | built-unchecked | `stocks-rows-journey` opens a headline at its publisher in Safari; its picture was not kept |
| 59 | Spotlight finds a symbol | done | Lists it under Watchlist and opens it in Stocks. `media-spotlight-journey`. [Spotlight](#project-artifact/art_3f7380b0451dc3ac/186) |
| 60 | Dock menu | done | `media-dock-journey`. [Dock menu](#project-artifact/art_3f7380b0451dc3ac/185) |

Cross-app: 5 rows; 4 done, 1 built-unchecked.

## Build items, most-used first

1. **Menus and keys:** Back, Refresh, ranges, Find, list arrows, Delete. Rows 16, 18-20, 45-46, 48.
2. **Row and story menus.** Rows 43-44.
3. **Multi-selection and Edit mode.** Rows 41, 52.
4. **Sidebar toggle and keeping the view.** Rows 17, 55.
5. **Story reading and symbol's stories.** Rows 33, 37.
6. **Stocks widget.** Row 42.
7. **Drag, Spotlight, Dock.** Rows 50-51, 59-60.
8. **Dimmed rows with reasons, New Window, Preferences, Help.** Rows 2, 9-15, 26.

## Counts (by hand)

60 rows: 50 done, 6 built-unchecked, 4 partial.
