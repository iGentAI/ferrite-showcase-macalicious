# Feature inventory: App Store

Main commit read: `e62c2ac9`, from GitHub only. Nothing was run, so no row is done. Files read: `demos/app-store/app.ts`, parts of `app-store.tsx` (Store menu, sections, account), `demos/desktop/desktop-menus.tsx`, the README's Launchpad and App Store section.

Status: **missing**, **partial** (the note says what is absent), or **built-unchecked** (in main's code, not yet seen running). The real app's list comes from knowledge of macOS 10.15 App Store, not from a Mac. "Call" marks a decision made here.

Calls:
- The store sells the desktop's own catalogue; nothing costs money. Arcade, gift cards and Redeem are dimmed with a reason.
- Ratings and reviews are the person's own, kept on the server, with no invented reviewers.
- Icons and heroes stay abstract placeholders (owner decision).
- A version is the first twelve digits of the served build's digest (`GET /api/app-store/versions`): the desktop is built as one, so a new build is a new version of every app, and each person's server copy says which version of each app they last took. The page already runs the new build, so an update changes that record and not the code.

## Menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 1 | App Store > About | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/79), [Window menu](#project-artifact/art_3f7380b0451dc3ac/80) |
| 2 | App Store > Preferences… | done | And ⌘,. [Preferences](#project-artifact/art_3f7380b0451dc3ac/31) |
| 3 | App Store > Services | built-unchecked | With no text selected "No Services Apply", as on a Mac; text selected in the window gets the desktop's services (`ServicesItems`) |
| 4 | App Store > Hide | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/79), [Window menu](#project-artifact/art_3f7380b0451dc3ac/80) |
| 5 | App Store > Hide Others | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/79), [Window menu](#project-artifact/art_3f7380b0451dc3ac/80) |
| 6 | App Store > Show All | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/79), [Window menu](#project-artifact/art_3f7380b0451dc3ac/80) |
| 7 | App Store > Quit | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/79), [Window menu](#project-artifact/art_3f7380b0451dc3ac/80) |
| 8 | Edit > Undo | done | Dimmed: the store has nothing to edit but its search field, whose keys work by themselves; the row's `title` says so. [Edit menu](#project-artifact/art_0374ddab86dca643/2) |
| 9 | Edit > Redo | done | As Undo. [Edit menu](#project-artifact/art_0374ddab86dca643/2) |
| 10 | Edit > Cut | done | As Undo. [Edit menu](#project-artifact/art_0374ddab86dca643/2) |
| 11 | Edit > Copy | done | As Undo. [Edit menu](#project-artifact/art_0374ddab86dca643/2) |
| 12 | Edit > Paste | done | As Undo. [Edit menu](#project-artifact/art_0374ddab86dca643/2) |
| 13 | Edit > Select All | done | As Undo. [Edit menu](#project-artifact/art_0374ddab86dca643/2) |
| 14 | Edit > Find ⌘F | done | Puts the keyboard in the search field. [Edit menu](#project-artifact/art_0374ddab86dca643/2) |
| 15 | Store > Back ⌘[ | done | Sections, searches and the account page. A page comes back scrolled as it was left, after Back or clearing a search. [Store menu](#project-artifact/art_0374ddab86dca643/3) |
| 16 | Store > Forward ⌘] | done | [Store menu](#project-artifact/art_0374ddab86dca643/3) |
| 17 | Store > Reload Page ⌘R | done | Reads the library again and draws the page anew; on Updates ⌘R belongs to Check for Updates. Does not retry a catalogue that failed to load. [Store menu](#project-artifact/art_0374ddab86dca643/3) |
| 18 | Store > Search | done | Puts the keyboard in the search field; a typed search is one page of the history. [Store menu](#project-artifact/art_0374ddab86dca643/3) |
| 19 | Store > Sign In or View My Account | done | Sign In opens the account page, the row then says View My Account and opens it. `app-store-rows-journey`. [Menu](#project-artifact/art_3f7380b0451dc3ac/209), [account](#project-artifact/art_3f7380b0451dc3ac/200) |
| 20 | Store > Sign Out | done | Dimmed with its reason while signed out; leaves no way Back to the account page. [Store menu](#project-artifact/art_0374ddab86dca643/3) |
| 21 | Store > Show Updates | done | Opens Updates. `app-store-rows-journey`. [Updates](#project-artifact/art_3f7380b0451dc3ac/210) |
| 22 | Store > Check for Updates ⌘R | done | Shows Updates, reads the versions and the catalogue again and says when it looked, or how many updates wait. The failure line was not provoked in a journey. [Updates](#project-artifact/art_0374ddab86dca643/4) |
| 23 | Store > Redeem and Purchased | done | Redeem dimmed with its reason; Purchased opens the account page. [Store menu](#project-artifact/art_0374ddab86dca643/3) |
| 24 | Window > Minimize | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/79), [Window menu](#project-artifact/art_3f7380b0451dc3ac/80) |
| 25 | Window > Zoom | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/79), [Window menu](#project-artifact/art_3f7380b0451dc3ac/80) |
| 26 | Window > Bring All to Front | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/79), [Window menu](#project-artifact/art_3f7380b0451dc3ac/80) |
| 27 | Window > window list | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/79), [Window menu](#project-artifact/art_3f7380b0451dc3ac/80) |
| 28 | Help > App Store Help | done | Opens Help Viewer; the Help row of the desktop, seen working. |
| 29 | Close Window ⌘W | done | The key closes it; there is no File menu here. `media-shell-journey`. [Window menu](#project-artifact/art_3f7380b0451dc3ac/80) |

Menus: 29 rows; 28 done, 1 partial.

## Views, sidebar, windows

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 30 | Discover | done | Lists apps to get and apps installed. `app-store-rows-journey`. [Discover](#project-artifact/art_3f7380b0451dc3ac/203) |
| 31 | Create, Work, Play, Develop | done | Sections of the catalogue; each lists its apps. `app-store-rows-journey`. [Section](#project-artifact/art_3f7380b0451dc3ac/208) |
| 32 | Arcade | done | Dimmed in the served store, its `title` saying why. [Dimmed rows](#project-artifact/art_0374ddab86dca643/5) |
| 33 | Categories | done | A category lists its own apps. `app-store-rows-journey`. [Categories](#project-artifact/art_3f7380b0451dc3ac/201) |
| 34 | Updates, Update All | built-unchecked | Updates ran in `app-store-rows-journey` ([Updates](#project-artifact/art_3f7380b0451dc3ac/210)). With Automatic Updates off, apps behind the served build wait in Pending, with the version they would take; Update All runs them and the server holds the current version, across a reload (`media-small-batch8-journey`, `app-store-versions.test.ts`). The state a new deploy leaves was written through the server's own route: no second deploy was run. |
| 35 | Search and results | done | A name finds its app, and a word that finds nothing says so. `app-store-rows-journey`. [Search](#project-artifact/art_3f7380b0451dc3ac/207) |
| 36 | Product page | done | Pressing an app in a list opens its page, in the page history: offer, Share, rating, Information (only what the catalogue knows; nothing invented), other apps of the category. Links on this desktop's own address open it, on load or while open. [Page](#project-artifact/art_3f7380b0451dc3ac/29) |
| 37 | Account page, Purchased | done | Names the account and lists what it got; Store > Purchased opens the same list. `app-store-rows-journey`. [Account](#project-artifact/art_3f7380b0451dc3ac/200) |
| 38 | Uninstall | done | On the account page and in an app's menu, read back from the server. [Row menu](#project-artifact/art_3f7380b0451dc3ac/30) |
| 39 | Get, Install, Open | done | The menu's Get skips the confirmation the pill asks for, as a menu choice is the confirmation. [Row menu](#project-artifact/art_3f7380b0451dc3ac/30) |
| 40 | Install state follows the library | done | A refused save shows Retry; a second browser of the session installing the app turns it into Open without a press. The refused save is a Playwright route; the other browser and the server are real. [Retry](#project-artifact/art_0374ddab86dca643/7), [Open](#project-artifact/art_0374ddab86dca643/6) |
| 41 | Ratings and reviews | done | The person's own stars and review, in the desktop's settings; the page says nobody else's reach this desktop. [Page](#project-artifact/art_3f7380b0451dc3ac/29) |
| 42 | Editorial stories | built-unchecked | Each served section opens with two stories written from the catalogue, the apps not yet got first, and a story opens its app's page. Call: an app's own summary, no invented copy. `app-store-stories.test.tsx`, `media-batch-journey`; screenshot not yet published |
| 43 | Sidebar search | done | The sidebar's field; Edit > Cut and Paste work on it through the menu. `app-store-rows-journey`. [Search](#project-artifact/art_3f7380b0451dc3ac/207) |
| 44 | Hidden purchases, gift | done | Dimmed buttons on the account page, each `title` saying why. [Dimmed rows](#project-artifact/art_0374ddab86dca643/5) |
| 45 | Preferences window: automatic updates and downloads | done | Automatic Updates is kept and said on the Updates page; on, an app behind takes the served build's version by itself when the store opens, and off it waits for Update (`media-small-batch8-journey`). Downloads from other computers, Video Autoplay and feedback are dimmed, each saying why. [Preferences](#project-artifact/art_3f7380b0451dc3ac/31) |

Views: 16 rows; 14 done, 1 built-unchecked, 1 partial.

## Context menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 46 | App card menu: Open, Share, Copy Link | done | Open or Get, Show App Page, Copy Link, Share (Messages driven), Uninstall for an app the library holds. [Row menu](#project-artifact/art_3f7380b0451dc3ac/30) |
| 47 | Purchased row menu | done | Purchased is the same list with the same menu; not opened from that page in the journey. [Row menu](#project-artifact/art_3f7380b0451dc3ac/30) |

Context menus: 2 rows; 2 done.

## Keyboard shortcuts

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 48 | ⌘F search focus | done | From the field, the page or after a menu. [Edit menu](#project-artifact/art_0374ddab86dca643/2) |
| 49 | ⌘[ and ⌘] | done | [Store menu](#project-artifact/art_0374ddab86dca643/3) |
| 50 | ⌘R | done | Reload Page, or Check for Updates on Updates. [Updates](#project-artifact/art_0374ddab86dca643/4) |

Keys: 3 rows; 3 done.

## Drag and drop

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 51 | Drag an installed app to the Dock | built-unchecked | An installed app's row drags as its link and, once installed, as an application the Dock keeps, the way Launchpad's do; one still on offer drags as its link alone. `app-store-stories.test.tsx`; `e2e/media-batch4-journey.mjs` took Books out of the Dock, dragged its row back, and read `dock.order` from the server and the tile over a reload. Screenshot not yet published |
| 52 | Drag an app's link out | done | An app drags out as its link; dropped in a text field in the journey. [Row menu](#project-artifact/art_3f7380b0451dc3ac/30) |

Drag: 2 rows; 1 done, 1 built-unchecked.

## Multi-selection

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 53 | Several updates or purchases | built-unchecked | Update All only. Call: the real store has no row selection, so none is built; Update All is its way to act on several, and on the served store it now runs (`media-small-batch8-journey`). |

Multi-selection: 1 row; 1 partial.

## Saved state

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 54 | Library on the server | done | Install keeps the app, read back from the server, over a reload; Delete takes it out. `app-store-rows-journey`. [Got](#project-artifact/art_3f7380b0451dc3ac/204) |
| 55 | Last section | done | Kept in the desktop's settings; the store opens there after a reload. [Page](#project-artifact/art_3f7380b0451dc3ac/29) |

Saved state: 2 rows; 2 done.

## Cross-app and checks

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 56 | Got apps join the Dock and Launchpad | done | In the Dock without a reload, in Launchpad after one. `app-store-rows-journey`. [Got](#project-artifact/art_3f7380b0451dc3ac/204), [Launchpad](#project-artifact/art_3f7380b0451dc3ac/205) |
| 57 | Launchpad's delete badge | done | With Option held only the got app has it; Delete asks, then takes it out of the library and the Dock. `app-store-rows-journey`. [Badge](#project-artifact/art_3f7380b0451dc3ac/202) |
| 58 | Open an installed app | done | The store's Open opens Books. `app-store-rows-journey`. [Open](#project-artifact/art_3f7380b0451dc3ac/206) |
| 59 | Share an app | done | Share on the page and in the menu; the link reaches a new message in the real Messages. [Page](#project-artifact/art_3f7380b0451dc3ac/29) |
| 60 | Apple menu > App Store… | done | Opens the store. `app-store-rows-journey`. [The store](#project-artifact/art_3f7380b0451dc3ac/203) |
| 61 | Journey's persistence check | done | Checks the read's status and list; 19 steps pass. [App Store](#project-artifact/art_9cacf31771edbcbc/7), filed in the Screenshots: Safari document because the library is nearly full |
| 62 | Journey's screenshots | done | Taken with the kit's `shot()`, per the ruling. [App Store](#project-artifact/art_9cacf31771edbcbc/7) |

Cross-app: 7 rows; 7 done.

## Build items, most-used first

1. **Ledger: install state follows the library,** then the journey's status, schema and `shot()` fixes. Rows 40, 61-62.
2. **Page history and Store menu:** Back, Forward, Reload, Search, Check for Updates, keys. Rows 14-18, 20, 22, 48-50.
3. **Product page depth.** Row 36.
4. **Card and Purchased menus; Share.** Rows 46-47, 59.
5. **Preferences window.** Rows 2, 45.
6. **Ratings and reviews.** Row 41.
7. **Multi-select in Updates and Purchased; last section.** Rows 53, 55.
8. **Editorial stories over the catalogue.** Row 42.
9. **Drag to Dock.** Rows 51-52.
10. **Dimmed rows with reasons.** Rows 8-13, 23, 28, 32, 44.

## Counts (by hand)

62 rows: 57 done, 1 built-unchecked, 3 partial, 1 missing.
