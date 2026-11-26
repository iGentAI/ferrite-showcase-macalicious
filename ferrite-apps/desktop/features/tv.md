# Feature inventory: TV

Main commit read: `e62c2ac9`, from GitHub only. A row marked done was run in the desktop by `e2e/tv-depth-journey.mjs`, against YouTube's real player; every other row was only read. Files read: `demos/tv/app.ts`, `tv-youtube.tsx`, `demos/desktop/desktop-menus.tsx`, the README's TV section. `tv-youtube-player.tsx` was not read at first, so older rows on the player say "not traced".

Status: **done** (worked in the running app, picture linked), **missing**, **partial** (the note says what is absent), or **built-unchecked** (in main's code, not yet seen running). The real app's list comes from knowledge of macOS 10.15 TV, not from a Mac. "Call" marks a decision made here.

Calls:
- The YouTube catalogue is out of scope: it needs a key only the owner holds. It stays shown as unavailable, and pasted links and the open films go on working.
- The iTunes Store, purchases and subscriptions have no service here: dimmed with a reason.
- Home Videos are added from the person's drive, as the feasible stand-in for the real Library. QuickTime Player keeps the same files; a video opened from Finder still goes to QuickTime Player by default.

## Menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 1 | TV > About TV | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/69), [Window menu](#project-artifact/art_3f7380b0451dc3ac/70) |
| 2 | TV > Preferences… ⌘, | partial | List Size acts. The window is the modal kind: while it is open the main window is inert, so a press there leaves Preferences key, and from another application it brings TV forward with Preferences key (`rows-batch23-journey`). Checkboxes in library now acts: each title and home video of the Library has a box, a cleared one is kept on the server and Up Next passes over it. Use the screen saver while paused now acts: the desktop's screen saver starts after a minute paused with no input (`media-small-batch8-journey`, with a home video; `tv-settings.test.tsx` for Up Next). Call: one minute, since the desktop's Start after is Never by default. Still dimmed, each saying why: downloads (no store), the media folder (home videos stay where they are, links stream), restrictions (no rating to read), warnings (TV has none to reset) |
| 3 | TV > Services | built-unchecked | With no text selected "No Services Apply", as on a Mac; text selected in the window gets the desktop's services (`ServicesItems`) |
| 4 | TV > Hide TV | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/69), [Window menu](#project-artifact/art_3f7380b0451dc3ac/70) |
| 5 | TV > Hide Others | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/69), [Window menu](#project-artifact/art_3f7380b0451dc3ac/70) |
| 6 | TV > Show All | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/69), [Window menu](#project-artifact/art_3f7380b0451dc3ac/70) |
| 7 | TV > Quit TV | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/69), [Window menu](#project-artifact/art_3f7380b0451dc3ac/70) |
| 8 | File > New Playlist | done | ⌘N and the menu; a sheet names it, and the Library shows it. Kept on the server. [Playlists](#project-artifact/art_3f7380b0451dc3ac/37) |
| 9 | File > Import… ⌘O | done | The Open panel on the drive, at Movies, taking movies only; the file joins Home Videos and stays where it is. [Panel](#project-artifact/art_3f7380b0451dc3ac/44). Call: nothing is copied. The menu was run; the key was not pressed |
| 10 | File > Library submenu | done | Organize Library is dimmed, saying why. Export Library writes TV Library.xml in Downloads, Export Playlist writes the playlist's links there (dimmed with its reason while there is none), and Import Playlist makes a playlist of a file's links. `tv-rows-journey`. [Menu](#project-artifact/art_3f7380b0451dc3ac/98) |
| 11 | File > Close Window ⌘W | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/69), [Window menu](#project-artifact/art_3f7380b0451dc3ac/70) |
| 12 | File > Show in Finder | done | While a home video plays: Finder selects the file in its folder. A YouTube video has no file, so it is dimmed saying why. A card's menu has it too. The menu was run; ⇧⌘R was not pressed. [Playing](#project-artifact/art_3f7380b0451dc3ac/42) |
| 13 | Edit > Undo | done | Dimmed with its reason, read by the journey. [Menu](#project-artifact/art_3f7380b0451dc3ac/12) |
| 14 | Edit > Redo | done | Dimmed with its reason. [Menu](#project-artifact/art_3f7380b0451dc3ac/12) |
| 15 | Edit > Cut | done | Dimmed with its reason; the search field's own key works there. [Menu](#project-artifact/art_3f7380b0451dc3ac/12) |
| 16 | Edit > Copy | done | Dimmed with its reason, read by the journey. [Menu](#project-artifact/art_3f7380b0451dc3ac/12) |
| 17 | Edit > Paste | done | Dimmed with its reason. [Menu](#project-artifact/art_3f7380b0451dc3ac/12) |
| 18 | Edit > Select All | done | Chooses every card of the list a card was chosen in; dimmed, saying why, before that. The search field's own key works there. [Menu](#project-artifact/art_3f7380b0451dc3ac/45) |
| 19 | Edit > Find ⌘F | done | From the menu, gives the search field the keyboard. The key was not pressed. [Menu](#project-artifact/art_3f7380b0451dc3ac/12) |
| 20 | View > View Options | done | Call: dimmed, as List Size in Preferences is the one option here. Read by the journey. [Menu](#project-artifact/art_3f7380b0451dc3ac/12) |
| 21 | View > Watch Now, Movies and other sections by key | done | ⌘1 to ⌘5 and the menu's rows. One row and one key were run. [Menu](#project-artifact/art_3f7380b0451dc3ac/12) |
| 22 | View > Enter Full Screen | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/69), [Window menu](#project-artifact/art_3f7380b0451dc3ac/70) |
| 23 | Controls > Play/Pause | done | Pauses and plays the movie on. `tv-rows-journey`. [Controls](#project-artifact/art_3f7380b0451dc3ac/105) |
| 24 | Controls > Skip Back | done | Back ten seconds, read from the movie. `tv-rows-journey`. [Controls](#project-artifact/art_3f7380b0451dc3ac/105) |
| 25 | Controls > Skip Forward | done | On ten seconds, read from the movie. `tv-rows-journey`. [Controls](#project-artifact/art_3f7380b0451dc3ac/105) |
| 26 | Controls > Add to or Remove from Up Next | done | Not on the real menu; kept. Read back from the server. `tv-rows-journey`. [Shelf](#project-artifact/art_3f7380b0451dc3ac/109) |
| 27 | Controls > Add to or Remove from Watch Later | done | Not on the real menu; kept. Read back from the server. `tv-rows-journey`. [Library](#project-artifact/art_3f7380b0451dc3ac/101) |
| 28 | Controls > Stop | done | ⌘. Ends playback, keeps the place. [Controls menu](#project-artifact/art_d7d6c202491dc81c/2) |
| 29 | Controls > Next and Previous | done | ⌘→ ⌘←. Next: first of Up Next, else along History; Previous: back along History. [Controls menu](#project-artifact/art_d7d6c202491dc81c/2) |
| 30 | Controls > Volume | done | Increase, Decrease, Mute; kept for the person across videos. Read on YouTube's video element. [Controls menu](#project-artifact/art_d7d6c202491dc81c/2) |
| 31 | Controls > Subtitles and Audio | done | Subtitles: Off and what the video offers. A home video's are a .vtt or .srt of its name beside it, run in the journey with the words shown; YouTube's real player listed Sintel's languages in the menu, choosing one was not run. The choice is kept by language across a reload. Audio is dimmed with its reason: there is no other track to choose. [Subtitles](#project-artifact/art_3f7380b0451dc3ac/46) |
| 32 | Controls > Go to Current | done | "Go to Current Video" ⌘L: the page of the video last opened; dimmed in the player, saying why. [Controls menu](#project-artifact/art_d7d6c202491dc81c/2) |
| 33 | Account menu | done | Call: a dimmed Sign In row saying the desktop's account is the one signed in. Read by the journey. [Menu](#project-artifact/art_3f7380b0451dc3ac/12) |
| 34 | Window > Minimize | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/69), [Window menu](#project-artifact/art_3f7380b0451dc3ac/70) |
| 35 | Window > Zoom | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/69), [Window menu](#project-artifact/art_3f7380b0451dc3ac/70) |
| 36 | Window > Bring All to Front | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/69), [Window menu](#project-artifact/art_3f7380b0451dc3ac/70) |
| 37 | Window > window list | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/69), [Window menu](#project-artifact/art_3f7380b0451dc3ac/70) |
| 38 | Help > TV Help | done | Opens Help Viewer on a search that lists TV's own topics, from the TV Help book. `tv-help-resize-journey`. [Help](#project-artifact/art_3f7380b0451dc3ac/269) |

Menus: 38 rows; 36 done, 2 partial.

## Views, toolbar, player

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 39 | Watch Now | done | The open films and the shelf for everyone. `tv-rows-journey`. [Watch Now](#project-artifact/art_3f7380b0451dc3ac/111) |
| 40 | Movies | done | The open films. `tv-rows-journey`. [Movies](#project-artifact/art_3f7380b0451dc3ac/106) |
| 41 | TV Shows | built-unchecked | Three open series their makers publish on YouTube, on shelves in episode order: Caminandes (2, 3), Pepper & Carrot (3 to 6) and Morevna (3, 4), each id read back from YouTube's oEmbed; then what the person added. Next Episode on an episode's page, and Controls' Next and the end of an episode go on to the next. `rows-batch19-journey` (shelves, Next Episode), `tv-library-shelves.test.tsx`. Absent: earlier episodes, which the makers' channels were not found to hold; seasons; an episode actually played to its end here, since YouTube refuses this sandbox's network (error 150) |
| 42 | Kids | done | Its films. `tv-rows-journey`. [Kids](#project-artifact/art_3f7380b0451dc3ac/104) |
| 43 | Library | partial | Up Next, Watch Later, History, Home Videos and playlists, read back over a reload ([Library](#project-artifact/art_3f7380b0451dc3ac/101)); Recently Added now lists the videos the person added, newest first (`tv-library-shelves.test.tsx`, `media-batch-journey`). Genres now acts: a card's Get Info (and Edit > Get Info ⌘I on a video shown) sets a Genre on a title or home video, typed or from the iTunes Store's list, kept on the server; the Library's sidebar then lists Genres by name and a row shows that genre's videos; a reload keeps them, and clearing the field or removing the home video takes the row (`tv-genres-journey`, `tv-info.test.tsx`). Partial because: real TV's sidebar is always there with Recently Added, Movies and TV Shows; here it shows only once a video has a genre, with All Videos and Genres. Call: nothing arrives with a genre, as a YouTube link carries none, and Get Info holds the Genre alone. Edit > Get Info's place in the menu and the ⌘I key are from knowledge of iTunes, not checked on a Mac; the key was not pressed in the journey, and Edit > Get Info was opened and cancelled, not saved |
| 44 | Video page | done | Play, Up Next, Watch Later and Share. `tv-rows-journey`. [Page](#project-artifact/art_3f7380b0451dc3ac/110) |
| 45 | Player | done | YouTube's official embed for a link; a home video in the page's own player. `tv-rows-journey`. [Player](#project-artifact/art_3f7380b0451dc3ac/100) |
| 46 | Player: full screen and Picture in Picture | built-unchecked | Full screen works ([player](#project-artifact/art_d7d6c202491dc81c/2)). A home video's Picture in Picture floats and comes back: `e2e/media-batch4-journey.mjs` (`--part tv`) read `document.pictureInPictureElement` in Chromium. It stays dimmed with the reason for a YouTube video: its picture is in a frame the page does not hold. Screenshot of the float not possible: the browser draws it outside the page |
| 47 | Up Next shelf | done | What is queued, above the films, and back over a reload. `tv-rows-journey`. [Shelf](#project-artifact/art_3f7380b0451dc3ac/109) |
| 48 | Continue Watching | done | With a seeded place, after a reload it holds the video and the card offers to resume. `tv-rows-journey`. [Shelf](#project-artifact/art_3f7380b0451dc3ac/99) |
| 49 | Search in the library | done | Finds a video in the library and a home video by the file's name. `tv-rows-journey`. [Search](#project-artifact/art_3f7380b0451dc3ac/108) |
| 50 | YouTube catalogue search | partial | Unavailable without a key, and says so |
| 51 | Pasted YouTube link | done | Shows YouTube's own title through the server; Return plays it in the embed and puts it first in History. `tv-rows-journey`. [Pasted link](#project-artifact/art_3f7380b0451dc3ac/103) |
| 52 | Clear History | done | Empties it on the server and takes its shelf away. `tv-rows-journey`. [Cleared](#project-artifact/art_3f7380b0451dc3ac/102) |
| 53 | YouTube's refusal shown, Watch on YouTube | done | Error 150 from this sandbox's network: TV says so in its own words, dims Controls' Play and skips, and Watch on YouTube opens a browser tab. `tv-rows-journey`. [Refusal](#project-artifact/art_3f7380b0451dc3ac/100) |
| 54 | Home Videos from the drive | done | A shelf in the Library: the file's name, where it stopped, Play or Resume, Play from Beginning, Show in Finder, Remove from Library (the file stays in the drive). A trashed file leaves the shelf. It plays in the page under the same controller; the place is kept on the server over a reload. Up Next and Watch Later stay YouTube's. Call: the card has a drawn picture, since the file is only read to play it. Trashing was not run in the journey. [Shelf](#project-artifact/art_3f7380b0451dc3ac/41), [playing](#project-artifact/art_3f7380b0451dc3ac/42) |
| 55 | User playlists | done | Up to 50, in the Library: Add to Playlist and New Playlist in a card's menu, reorder and move by drag, Remove, Rename, Delete, Play, Add All to Up Next. Read back from the server and over a reload. Play and Add All in a playlist's menu are the shared shelf rows and were not clicked there. [Playlists](#project-artifact/art_3f7380b0451dc3ac/37) |

Views: 17 rows; 13 done, 2 built-unchecked, 2 partial.

## Context menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 56 | Video card menu | done | Play or Resume, Go to Video, Play Next, Up Next, Watch Later, on every card; Get Info last (`tv-genres-journey`). [Card menu](#project-artifact/art_d7d6c202491dc81c/3) |
| 57 | Shelf menu | done | Play, Add All to Up Next, and Clear on Up Next, Continue Watching, Watch Later and History. [Shelf menu](#project-artifact/art_d7d6c202491dc81c/4) |
| 58 | Remove one History or Watch Later entry | done | Also one place from Continue Watching. Read back from the server. [Card menu](#project-artifact/art_d7d6c202491dc81c/3) |

Context menus: 3 rows; 3 done.

## Keyboard shortcuts

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 59 | Space plays and pauses | done | Also after a click in YouTube's frame or a menu's command; on a video's page it plays. Read on YouTube's video element. [Player](#project-artifact/art_d7d6c202491dc81c/2) |
| 60 | ⌘, Preferences | done | The key opens them. `tv-rows-journey`. [Preferences](#project-artifact/art_3f7380b0451dc3ac/107) |
| 61 | Arrow keys skip | done | ← → skip ten seconds, ↑ ↓ change the volume. Read on YouTube's video element. [Player](#project-artifact/art_d7d6c202491dc81c/2) |
| 62 | ⌘F search focus | done | The key itself did nothing until this pass; it now gives the field the keyboard. `tv-rows-journey`. [Search](#project-artifact/art_3f7380b0451dc3ac/108) |

Keys: 4 rows; 4 done.

## Drag and drop

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 63 | Drop a video from Finder | done | The real pointer drag from a Finder window: it joins Home Videos and does not start playing. Run by `e2e/tv-home-videos-journey.mjs` |
| 64 | Drop a YouTube link on the window | done | Opens as a pasted link does; other dropped text is refused, saying why. The drop itself is a dispatched event in the journey: a browser test cannot drag from another app. [Dropped](#project-artifact/art_3f7380b0451dc3ac/36) |
| 65 | Reorder Up Next | done | Real mouse drags; the new order is read back from the server and kept over a reload. A card from another shelf joins where it is dropped. [Reordered](#project-artifact/art_3f7380b0451dc3ac/35) |
| 66 | Drag to Watch Later or a playlist | done | Both read back from the server. Watch Later's grid shows only while it holds something. [Playlists](#project-artifact/art_3f7380b0451dc3ac/37) |

Drag: 4 rows; 4 done.

## Multi-selection

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 67 | Several cards: remove, add to playlist | done | Command-click and Shift-click choose cards in one list (Up Next, Watch Later, History, a playlist, Home Videos); Select All, Escape and Delete work; a chosen card's menu has Play Next, Add to Up Next, Add to Watch Later, Add to Playlist and Remove. Call: in Home Videos it has Remove alone, as Up Next, Watch Later and playlists hold YouTube videos. Dragging several at once is not built. Watch Later was the list run. [Menu](#project-artifact/art_3f7380b0451dc3ac/45) |

Multi-selection: 1 row; 1 done.

## Saved state

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 68 | Library: videos, History, Up Next, Watch Later | done | Read from the server and back over a reload. `tv-rows-journey`. [Library](#project-artifact/art_3f7380b0451dc3ac/101) |
| 69 | Place in each video | done | Kept on the server; a home video says where it stopped. `tv-rows-journey`. [Library](#project-artifact/art_3f7380b0451dc3ac/101) |
| 70 | List Size | done | Large is kept on the server and holds over a reload: the cards measure 288px. `tv-rows-journey`. [Preferences](#project-artifact/art_3f7380b0451dc3ac/107), [Library](#project-artifact/art_3f7380b0451dc3ac/101) |
| 71 | Last section | done | A window opens on the section last chosen; each open window then keeps its own. Read after a reload. [Menu](#project-artifact/art_3f7380b0451dc3ac/12) |

Saved state: 4 rows; 4 done.

## Cross-app

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 72 | Open With TV from Finder | done | Listed after QuickTime Player, which stays the default; adds the file and plays it. [Open With](#project-artifact/art_3f7380b0451dc3ac/43) |
| 73 | Spotlight finds library videos | done | Finds the account's videos and opens the one chosen. `media-spotlight-journey`. [Spotlight](#project-artifact/art_3f7380b0451dc3ac/113) |
| 74 | Share a video | done | Share submenu on every card and a Share button on a video's page. Notes run to the server; Mail, Messages and Reminders use the same shared rows and were not driven here; AirDrop dimmed with its reason. [Share menu](#project-artifact/art_d7d6c202491dc81c/5) |
| 75 | Copy Link | done | First row of Share; read back from the clipboard, from a card and from a video's page. [Share menu](#project-artifact/art_d7d6c202491dc81c/5) |
| 76 | Dock menu | done | `media-dock-journey`. [Dock menu](#project-artifact/art_3f7380b0451dc3ac/112) |
| 77 | Watch on YouTube opens the browser | done | Opens `youtube.com/watch` in a tab of the browser, read back by `tv-rows-journey`. [Refusal](#project-artifact/art_3f7380b0451dc3ac/100) |

Cross-app: 6 rows; 6 done.

## Build items, most-used first

1. **Player controls:** Stop, Next, Previous, Volume, arrows, Space, Go to Current. Rows 28-30, 32, 46, 59, 61.
2. **Video card menu and removing entries.** Rows 56-58.
3. **Share and Copy Link.** Rows 74-75.
4. **Up Next reorder and drop a link.** Rows 64-66.
5. **User playlists** with File > New Playlist. Rows 8, 55, 67.
6. **Home Videos from the drive** with Import, Show in Finder, Open With. Rows 9-10, 12, 54, 63, 72.
7. **Library sections:** Recently Added, Genres, sections by key, last section kept, View Options. Rows 20-21, 41, 43, 71.
8. **Search focus, Spotlight, Dock.** Rows 19, 62, 73, 76.
9. **Dimmed rows with reasons:** Subtitles, Account, Help, Edit. Rows 13-18, 31, 33, 38.

## Counts (by hand)

77 rows: 71 done, 6 partial.
