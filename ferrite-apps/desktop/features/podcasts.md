# Feature inventory: Podcasts

Main commit read: `e62c2ac9`, from GitHub only. Nothing was run, so no row is done. Files read: `demos/podcasts/app.ts`, parts of `podcasts-desktop.tsx` (Controls menu, sections, keys), `demos/desktop/desktop-menus.tsx`, the README's Podcasts section. `podcasts-preferences.tsx` and `podcasts-views.tsx` were not read, so rows on them say "not traced".

Status: **missing**, **partial** (the note says what is absent), or **built-unchecked** (in main's code, not yet seen running). The real app's list comes from knowledge of macOS 10.15 Podcasts, not from a Mac. "Call" marks a decision made here.

Calls:
- Episodes stream from publishers and no audio passes the server. Downloaded stays dimmed with that reason.
- Shared drag, opening files, clipboard and share sheet come from the Finder and desktop integration worker.

## Menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 1 | Podcasts > About | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/66), [Window menu](#project-artifact/art_3f7380b0451dc3ac/67) |
| 2 | Podcasts > Preferences… | built-unchecked | Traced: Refresh sets how often feeds are read, Skip Forward and Back set the Controls rows and keys, Continuous Playback decides what plays when an episode ends. Download and Sync are dimmed, each with its reason shown: audio streams from its publisher, and the server keeps the shows for every browser of the account. `podcasts-stations.test.tsx` holds Sync; no browser walked the panes |
| 3 | Podcasts > Services | built-unchecked | With no text selected "No Services Apply", as on a Mac; text selected in the window gets the desktop's services (`ServicesItems`) |
| 4 | Podcasts > Hide | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/66), [Window menu](#project-artifact/art_3f7380b0451dc3ac/67) |
| 5 | Podcasts > Hide Others | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/66), [Window menu](#project-artifact/art_3f7380b0451dc3ac/67) |
| 6 | Podcasts > Show All | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/66), [Window menu](#project-artifact/art_3f7380b0451dc3ac/67) |
| 7 | Podcasts > Quit | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/66), [Window menu](#project-artifact/art_3f7380b0451dc3ac/67) |
| 8 | File > Add a Show by URL… | done | A sheet reads the feed first. Planet Money's real feed was added, opened with its episodes and listed under Shows after a reload; the same feed again changes nothing. An address the server may not read stays in the sheet with the reason: only hosts declared in the app's egress can be read. Call: no key, none was confirmed. [Added](#project-artifact/art_3f7380b0451dc3ac/8), [refused](#project-artifact/art_3f7380b0451dc3ac/9) |
| 9 | File > New Station | built-unchecked | A sheet names the station and chooses from the followed shows; dimmed, saying why, with none followed. The row's old call, dimmed for want of an Apple ID, was not needed: the desktop's settings keep it. `media-batch-journey` created one on a real NPR feed |
| 10 | File > Import and Export OPML | done | Call: added; the real app has no export, but a feed list needs it. Import follows the feeds it can read, on real NPR feeds, and says how many it could not; a file that is not OPML is refused. Export writes `Podcasts Subscriptions.opml` to Downloads. Only hosts in the app's egress can be read. [Imported](#project-artifact/art_3f7380b0451dc3ac/11) |
| 11 | File > Close Window ⌘W | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/66), [Window menu](#project-artifact/art_3f7380b0451dc3ac/67) |
| 12 | Edit > Undo | done | Dimmed with its reason, read by the journey. [Run](#project-artifact/art_3f7380b0451dc3ac/9) |
| 13 | Edit > Redo | done | Dimmed with its reason. [Run](#project-artifact/art_3f7380b0451dc3ac/9) |
| 14 | Edit > Cut | done | Dimmed with its reason; the search field's own key works there. [Run](#project-artifact/art_3f7380b0451dc3ac/9) |
| 15 | Edit > Copy | done | Dimmed with its reason. [Run](#project-artifact/art_3f7380b0451dc3ac/9) |
| 16 | Edit > Paste | done | Dimmed with its reason, read by the journey. [Run](#project-artifact/art_3f7380b0451dc3ac/9) |
| 17 | Edit > Select All | done | Dimmed with its reason. [Run](#project-artifact/art_3f7380b0451dc3ac/9) |
| 18 | Edit > Find ⌘F | done | From the menu, gives the search field the keyboard. The key itself was not pressed. [Run](#project-artifact/art_3f7380b0451dc3ac/9) |
| 19 | View > Show/Hide Sidebar | done | Hides the places and the search field, leaving the window's controls; kept in the desktop's settings, so it stays hidden over a reload; ⌥⌘S too; the row says Show Sidebar while hidden. `podcasts-rows-journey`. [Hidden](#project-artifact/art_3f7380b0451dc3ac/124) |
| 20 | View > Go to Current Episode | done | Opens the loaded episode's show; dimmed with its reason when nothing is loaded. [View menu](#project-artifact/art_fb3ddc721097edfd/6) |
| 21 | View > Sort and list options | done | Newest First and Oldest First for the Episodes list, kept on the server. Shows and Recently Updated are the two orders of the show list, as sidebar places. [Oldest first](#project-artifact/art_3f7380b0451dc3ac/32) |
| 22 | View > Refresh ⌘R | done | Reads every followed feed again, seen as `max_age=0` on the feed request. [View menu](#project-artifact/art_fb3ddc721097edfd/6) |
| 23 | View > Enter Full Screen | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/66), [Window menu](#project-artifact/art_3f7380b0451dc3ac/67) |
| 24 | Controls > Play/Pause | done | Pauses the audio and plays it on. `podcasts-rows-journey`. [Controls](#project-artifact/art_3f7380b0451dc3ac/252) |
| 25 | Controls > Stop | done | Pauses at the start, read from the audio element; ⌘. is the key. [Controls menu](#project-artifact/art_fb3ddc721097edfd/5) |
| 26 | Controls > Skip Forward | done | Moves the audio on 30 seconds, read from the audio. `podcasts-rows-journey`. [Controls](#project-artifact/art_3f7380b0451dc3ac/252) |
| 27 | Controls > Skip Back | done | Moves it back 15 seconds, read from the audio. `podcasts-rows-journey`. [Controls](#project-artifact/art_3f7380b0451dc3ac/252) |
| 28 | Controls > Play Next in Up Next | done | Dimmed with nothing queued; loads the first queued, which leaves Up Next, and it plays. `podcasts-rows-journey`. [Controls](#project-artifact/art_3f7380b0451dc3ac/252) |
| 29 | Controls > Previous | done | Call: goes to the episode's start and plays on, as Podcasts has no previous-episode list; read from the audio element. [Controls menu](#project-artifact/art_fb3ddc721097edfd/5) |
| 30 | Controls > Playback Speed | done | Submenu of the seven speeds with the current checked; 1.5× read from the audio element and from the library on the server. [Controls menu](#project-artifact/art_fb3ddc721097edfd/5) |
| 31 | Controls > Volume Up and Down | done | ⌘↑ and ⌘↓, a tenth each, dimmed with a reason at the ends; read from the audio element. The volume is not kept across a reload. [Controls menu](#project-artifact/art_fb3ddc721097edfd/5) |
| 32 | Account menu | done | Call: a dimmed Sign In row saying the desktop's account is the one signed in. The journey reads the reason. [Run](#project-artifact/art_3f7380b0451dc3ac/11) |
| 33 | Window > Minimize | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/66), [Window menu](#project-artifact/art_3f7380b0451dc3ac/67) |
| 34 | Window > Zoom | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/66), [Window menu](#project-artifact/art_3f7380b0451dc3ac/67) |
| 35 | Window > Bring All to Front | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/66), [Window menu](#project-artifact/art_3f7380b0451dc3ac/67) |
| 36 | Window > window list | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/66), [Window menu](#project-artifact/art_3f7380b0451dc3ac/67) |
| 37 | Help > Podcasts Help | built-unchecked | Opens Podcasts' guide in Help Viewer: `e2e/help-guides-journey.mjs` |

Menus: 37 rows; 33 done, 2 built-unchecked, 2 partial.

## Views, sidebar, toolbar

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 38 | Search | done | Finds a show in Apple's directory. `podcasts-rows-journey`. [Search](#project-artifact/art_3f7380b0451dc3ac/121) |
| 39 | Listen Now: Up Next, New Episodes, Continue Listening | done | Up Next and the episode started earlier in Continue Listening; Delete there forgets the place. `podcasts-rows-journey`. [Listen Now](#project-artifact/art_3f7380b0451dc3ac/250) |
| 40 | Browse | done | Apple's chart: Featured over Popular Shows. `podcasts-rows-journey`. [Browse](#project-artifact/art_3f7380b0451dc3ac/116) |
| 41 | Top Charts | done | Ranks the chart's shows. `podcasts-rows-journey`. [Top Charts](#project-artifact/art_3f7380b0451dc3ac/126) |
| 42 | Recently Updated | done | The followed shows, newest episode first. `podcasts-rows-journey`. [Recently Updated](#project-artifact/art_3f7380b0451dc3ac/120) |
| 43 | Shows | done | The followed shows by name. `podcasts-rows-journey`. [Shows](#project-artifact/art_3f7380b0451dc3ac/123) |
| 44 | Episodes | done | The episodes of every followed show. `podcasts-rows-journey`. [Episodes](#project-artifact/art_3f7380b0451dc3ac/118) |
| 45 | Downloaded | done | Call: episodes stream and none are kept, so it holds nothing and says why. `podcasts-rows-journey`. [Downloaded](#project-artifact/art_3f7380b0451dc3ac/117) |
| 46 | Stations | built-unchecked | A Stations section lists them under the places; a station's page lists its shows' episodes, newest first, with Play Station, which plays the newest and queues nine more. Call: kept per account in the desktop's settings. `media-batch-journey` listed one, reloaded and played it; screenshot not yet published |
| 47 | Show page, Follow, episode list | done | The episodes come from its feed; Subscribe follows it on the server. `podcasts-rows-journey`. [Show](#project-artifact/art_3f7380b0451dc3ac/122) |
| 48 | Episode page | built-unchecked | An episode's menu has Go to Episode: its page shows the show, day, length and the feed's notes, with Play or Pause, Queue, Go to Show and Back. Download is dimmed with the reason: episodes stream from their publisher. Call: no rating, as the real page rates shows and not episodes. `podcasts-views.test.tsx`, `e2e/media-batch4-journey.mjs`. Screenshot not yet published |
| 49 | Up Next panel with Edit: move, remove | done | Move Down and Remove, on the server. `podcasts-rows-journey`. [Panel](#project-artifact/art_3f7380b0451dc3ac/246) |
| 50 | Info panel, show notes | built-unchecked | Traced: `SidePanel` shows the loaded episode's title, show, date and the feed's notes in paragraphs, or Not Playing. Not walked in a browser |
| 51 | Playback bar, speed, volume | done | Speed is read from the audio and kept on the server; the slider sets the volume; the display names the episode. `podcasts-rows-journey`. [Bar](#project-artifact/art_3f7380b0451dc3ac/248) |
| 52 | Banners: new episodes, Mark as Seen | done | The banner counts them and Listen Now lists them; Mark as Seen takes it away and keeps the newest on the server. `podcasts-rows-journey`. [Banner](#project-artifact/art_3f7380b0451dc3ac/119) |
| 53 | Unreachable feed notice | done | The show's page says the feed's host answered HTTP 404. `podcasts-rows-journey`. [Notice](#project-artifact/art_3f7380b0451dc3ac/127) |

Views: 16 rows; 13 done, 3 built-unchecked.

## Context menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 54 | Episode menu: Play, Up Next, Mark Played, Share, Copy Link, Go to Show | built-unchecked | Up Next, Mark as Played and Unplayed, Copy Link, Share and Go to Show ran in `e2e/podcasts-depth-journey.mjs`, read back from the server and clipboard: [menu](#project-artifact/art_fb3ddc721097edfd/2). Play Episode in the menu loaded the episode, read back from the server, in `e2e/media-batch4-journey.mjs`. Screenshot of that click not yet published |
| 55 | Show menu: Unfollow, Refresh, Settings, Share | built-unchecked | Subscribe, Refresh Show, Copy Link and Go to Show ran: [menu](#project-artifact/art_fb3ddc721097edfd/4). Settings dimmed with its reason: shows have no settings of their own. Unsubscribe in the menu unfollowed the show, read back from the server, in `e2e/media-batch4-journey.mjs`. Screenshot of that click not yet published |
| 56 | Station menu | built-unchecked | Play Station, Edit Station…, Delete Station on the row. Delete ran in `podcasts-stations.test.tsx`; the menu was not opened in a browser |
| 57 | Sidebar menu | done | Refresh All Shows reads the feeds again; Hide Sidebar hides the places. `podcasts-rows-journey`. [Menu](#project-artifact/art_3f7380b0451dc3ac/125) |

Context menus: 4 rows; 1 done, 3 built-unchecked.

## Keyboard shortcuts

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 58 | Space plays and pauses | built-unchecked | Added: heard while the window is key, except where a field or a control keeps the space bar. `media-batch-journey` paused and resumed real audio; screenshot not yet published |
| 59 | ⌘→ and ⌘← skip | done | Read from the audio element. Heard on the page while the window is key, because a press on Play leaves the focus outside the window. [Controls menu](#project-artifact/art_fb3ddc721097edfd/5) |
| 60 | ⌘R refresh | done | Reads the feeds again, read back from the requests; the picture shows the window it ran in. `podcasts-rows-journey`. [Window](#project-artifact/art_3f7380b0451dc3ac/248) |
| 61 | ⌘, Preferences | done | The key opens them. `podcasts-rows-journey`. [Preferences](#project-artifact/art_3f7380b0451dc3ac/253) |
| 62 | Delete removes the selection | done | From Up Next, and from Continue Listening, where it forgets the place. `podcasts-rows-journey`. [Chosen](#project-artifact/art_3f7380b0451dc3ac/249) |

Keys: 5 rows; 4 done, 1 built-unchecked.

## Drag and drop

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 63 | Drag an episode to Up Next | done | Onto the button, the open panel or an entry, where it goes before that entry; on the server. `podcasts-rows-journey`. [Dragged](#project-artifact/art_3f7380b0451dc3ac/251) |
| 64 | Reorder Up Next by drag | done | On the server. `podcasts-rows-journey`. [Dragged](#project-artifact/art_3f7380b0451dc3ac/251) |
| 65 | Drop a feed URL or OPML file | done | A feed's address follows the show; text that is no address is refused, saying why; an OPML file dragged from Finder follows its shows. `podcasts-rows-journey`. [Feed](#project-artifact/art_3f7380b0451dc3ac/260), [OPML](#project-artifact/art_3f7380b0451dc3ac/261) |
| 66 | Drag an episode out | built-unchecked | An episode drags as its link, and TextEdit takes it: `e2e/media-batch4-journey.mjs` read the link from the document. Traced: the app did not fail. With TextEdit moved clear of Podcasts, the events run dragstart, a drop on TextEdit's text view, dragend, and the link is in the document. `podcasts-rows-journey` moves TextEdit by the middle of its title bar, so part of it stays under Podcasts, which comes to the front when a drag starts; that the old step's drop landed there is inferred, as that journey was not rerun. Screenshot not yet published |

Drag: 4 rows; 3 done, 1 built-unchecked.

## Multi-selection

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 67 | Shift and ⌘ selection of episodes | done | In any episode list. [Chosen](#project-artifact/art_fb3ddc721097edfd/7) |
| 68 | Mark several as played, or add to Up Next | done | Add, Mark as Played and Unplayed with the count; Add and Played read from the server, Unplayed not clicked. [Menu](#project-artifact/art_fb3ddc721097edfd/7) |

Multi-selection: 2 rows; 2 done.

## Saved state

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 69 | Library: follows, queue, played, speed | done | Over a reload the server holds the follow, Up Next, the speed and the settings; Played is kept. `podcasts-rows-journey`. [After a reload](#project-artifact/art_3f7380b0451dc3ac/247) |
| 70 | Place in each episode, resume | done | Kept on the server; Controls > Play goes on from it. `podcasts-rows-journey`. [After a reload](#project-artifact/art_3f7380b0451dc3ac/247) |
| 71 | Settings | done | Skip Forward and Continuous Playback are kept on the server, and the new seconds are the bar's and Controls'. `podcasts-rows-journey`. [Preferences](#project-artifact/art_3f7380b0451dc3ac/253) |
| 72 | View state: last view, sort | done | Last place and Episodes order kept in the desktop's settings, read back from the server and over a reload. [Oldest first](#project-artifact/art_3f7380b0451dc3ac/32) |

Saved state: 4 rows; 4 done.

## Cross-app and checks

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 73 | Spotlight finds shows and episodes | done | `media-spotlight-journey`. [Spotlight](#project-artifact/art_3f7380b0451dc3ac/129) |
| 74 | Share an episode or show | done | Copy Link read from the clipboard; Share Episode > Notes opened Notes; AirDrop dimmed with its reason: [submenu](#project-artifact/art_fb3ddc721097edfd/3). The note made in Notes not read back |
| 75 | Open an OPML or audio file from Finder | built-unchecked | `.opml` is registered with Finder and followed as Import does, whether the window was open or not; `podcasts-stations.test.tsx`, with the drive's read stood in for, did not go through Finder. Call: audio stays Music's and QuickTime Player's, as the real Podcasts does not open audio files |
| 76 | Dock menu | done | `media-dock-journey`. [Dock menu](#project-artifact/art_3f7380b0451dc3ac/128) |
| 77 | New-episode notification | built-unchecked | `GET /api/podcasts/watch` looks for episodes newer than the person's last look at each followed show and delivers each to Notification Center once, read from the inbox over a reload in `e2e/media-batch4-journey.mjs`; `podcasts::tests` holds its rules. The window asks when it opens and at the Refresh interval, and Manually watches nothing. The desktop also asks after sign-in and hourly while the session lasts, with Podcasts shut: `desktop-menu-tracking.test.tsx` and `e2e/desktop-overlay-journey.mjs`, which reads a 200 from the route. A delivered banner with Podcasts shut was not driven |
| 78 | Engine checks | built-unchecked | Firefox 157: `podcasts-journey` 25 and `podcasts-rows-journey` 25 pass, not live. Playwright's WebKit 27.2 on Linux: rows pass 25 on an earlier build, and `podcasts-journey` passes all 25 in 4 of 4 runs on a publisher's audio, its kept place in 8 of 8 counting 4 runs of the journey before its Up Next step was brought up to date. The kept place used to take in 2 of 4: WebKit can first report a redirected episode's length as 0 with `loadedmetadata`, and a seek then leaves the element stuck at the start for good (scratch probe, 5 of 5 such seeks; at a real length, 4 of 4). The place now waits for a length that reaches it, or for the time to move, and the speed waits with it. A real Safari was not run |
| 79 | Got from App Store | done | The App Store lists Podcasts as got, and Open opens it. `podcasts-rows-journey`. [App Store](#project-artifact/art_3f7380b0451dc3ac/115) |

Cross-app: 7 rows; 4 done, 2 built-unchecked, 1 partial.

## Build items, most-used first

1. **Episode and show context menus** with Mark Played, Share, Copy Link, Go to Show. Rows 54-55, 74.
2. **Menus carry the commands:** Refresh, Speed, Previous, Stop, volume, Go to Current Episode, sidebar toggle. Rows 19-22, 25, 29-31, 59.
3. **Multi-selection and Delete** in episode lists. Rows 62, 67-68.
4. **Drag:** to Up Next, reorder. Rows 63-64.
5. **Add by URL, drop feed, OPML.** Rows 8, 10, 65, 75.
6. **Stations.** Rows 9, 46, 56.
7. **Episode page, notes and search.** Rows 18, 48, 50, 58.
8. **Notifications, Spotlight and Dock.** Rows 73, 76-77.
9. **View state and sidebar menu.** Rows 57, 66, 72.
10. **Dimmed rows with reasons, Preferences carried out.** Rows 2, 12-17, 32, 37, 45.

## Counts (by hand)

79 rows: 64 done, 8 built-unchecked, 7 partial.
