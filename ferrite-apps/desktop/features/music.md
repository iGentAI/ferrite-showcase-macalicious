# Feature inventory: Music

Main commit read: `e62c2ac9`, from GitHub only. Nothing was run, so no row is done. Files read: `demos/music/app.ts`, `music.mdx`, `music-desktop.tsx` (key handling, chrome, menu registration), `music-library-views.tsx`, `demos/desktop/desktop-menus.tsx`, the README's Music section, and the census journey's row names.

Status: **missing**, **partial** (the note says what is absent), or **built-unchecked** (in main's code, not yet seen running). The real app's list comes from knowledge of macOS 10.15 Music, not from a Mac, so check item names and shortcuts against `reference/` when building. "Call" marks a decision made here.

Finding that drives this inventory: `music-desktop.tsx` registered no menu items at `e62c2ac9`, so File, Song, Controls and Account each showed one dimmed row. Build item 1 and 2 fixed that; `e2e/music-depth-journey.mjs` checks the rows marked done, in Chromium against `ferrite dev`, with the page served from the tree's source.

Calls:
- Apple Music, iTunes Store, cloud, disc and purchase commands have no service here. They stay in the menus, dimmed, with a reason. Internet Archive stands in for Browse.
- Shared drag between apps, opening files, clipboard and share sheet come from the Finder and desktop integration worker. This app adopts what that worker lands.

## Menus

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 1 | Music > About Music | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/68) |
| 2 | Music > Preferences… ⌘, | built-unchecked | List Size, song-change notification, MiniPlayer on top, Star ratings and Songs list checkboxes act (`music-batch-journey`), and now the Playback pane: Crossfade songs with its 1 to 12 seconds, Sound Enhancer with Low to High, and Sound Check act, kept on the server, across a reload (`music-quicktime-batch3-journey`). Each is measured there: two media elements sound together, each fading; a song at a tenth of the level leaves the graph as loud as the first; a 10 kHz tone is louder with the Enhancer on. How they sound to a person has not been judged. Sound Enhancer starts off here, not as the reference's window shows it, so that no song's sound changes until it is asked for. A file over 64 MB is not measured by Sound Check and plays at its own level. The store, sharing and file settings stay dimmed because this desktop has none of them |
| 3 | Music > Services | built-unchecked | The desktop's Services submenu (`desktop-menus.tsx`): with text selected it lists what applies, otherwise "No Services Apply" with the reason. Read from the code, not run in Music |
| 4 | Music > Hide Music ⌘H | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/68), [Window menu](#project-artifact/art_3f7380b0451dc3ac/65) |
| 5 | Music > Hide Others ⌥⌘H | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/68), [Window menu](#project-artifact/art_3f7380b0451dc3ac/65) |
| 6 | Music > Show All | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/68), [Window menu](#project-artifact/art_3f7380b0451dc3ac/65) |
| 7 | Music > Quit Music ⌘Q | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/68), [Window menu](#project-artifact/art_3f7380b0451dc3ac/65) |
| 8 | File > New > Playlist ⌘N | done | Makes an empty playlist. `music-rows-journey`. [File menu](#project-artifact/art_3f7380b0451dc3ac/227) |
| 9 | File > New > Playlist from Selection ⇧⌘N | done | [Song menu and selection](#project-artifact/art_c9443d16a033da1b/2) |
| 10 | File > New > Smart Playlist… ⌥⌘N | done | [Rules](#project-artifact/art_c9443d16a033da1b/15) |
| 11 | File > New > Playlist Folder | done | [A folder in the sidebar](#project-artifact/art_c9443d16a033da1b/14) |
| 12 | File > Edit Smart Playlist… | done | [Rules](#project-artifact/art_c9443d16a033da1b/15) |
| 13 | File > Close Window ⌘W | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/68), [Window menu](#project-artifact/art_3f7380b0451dc3ac/65) |
| 14 | File > Import… ⌘O | done | Adds the files chosen; the file panel itself is checked through its input. `music-rows-journey`. [Songs](#project-artifact/art_3f7380b0451dc3ac/235) |
| 15 | File > Add to Library / Open Stream… ⌘U | built-unchecked | A sheet takes an http or https address; it goes in the library as a song of its own (the server keeps source `stream`) and plays. A stream that sends no CORS header cannot reach Web Audio and says so. `preview-books-batch4-journey`, against a local server |
| 16 | File > Library > Organize Library… | built-unchecked | A sheet with Consolidate and Reorganize. Reorganize was run in `music-batch-journey`: files move to Music/Artist/Album/Track Title, the library follows, the song still plays, and a second run moves nothing. Consolidate's copy has not been run in a browser |
| 17 | File > Library > Export Library… | done | `Library.xml` in Downloads, with songs and playlists, smart ones with the songs they hold now; the file is read back from the drive in `music-files-journey.mjs` |
| 18 | File > Library > Import Playlist… | done | An M3U from the drive, matched by title and artist; says what it left out. [Panel](#project-artifact/art_3f7380b0451dc3ac/56) |
| 19 | File > Library > Export Playlist… | done | M3U in Downloads, read back by Import Playlist. [Panel](#project-artifact/art_3f7380b0451dc3ac/56) |
| 20 | File > Library > Show Duplicate Items | done | Same title and artist; Show All Items goes back. [Duplicates](#project-artifact/art_3f7380b0451dc3ac/57) |
| 21 | File > Library > Get Album Artwork | partial | Reads the picture in each song's own file (ID3 APIC, MP4 covr, FLAC PICTURE) in the page, asking nothing of another site, and keeps it with the song on the server, for the drive's songs that have none; a song added from a file keeps its picture the same way, and the Albums view draws it across a reload (`media-small-batch8-journey`, `music-drive.test.ts`). A song still with none then takes the picture of another song of its album and artist, naming the same stored picture; deleting the song that first held it leaves the others theirs, and the picture goes only with the last song that names it, read back from the server (`media-rows-batch11-journey`, Chromium). The M4A in the batch 8 journey carries tags and no sound. Dimmed, saying so, while every song on the drive has a picture. Absent, by the owner's decision: the online lookup. Song Info's Artwork pane adds a picture by file |
| 22 | File > Library > Update Cloud Library | partial | Dimmed, saying why, read in `rows-batch22-journey`. A true limit: no cloud library exists, every song is on the drive or at the Internet Archive |
| 23 | File > Home Sharing | done | Between this desktop's accounts. Off by default for each account, kept on the server. Turn On Home Sharing… asks in a sheet that says any account on this desktop can then hear the library; the other accounts then find the person's name in the sidebar, list the songs and play them through the player. Every read asks the server whether the library is lent at that moment: off, a listener's next read is refused at once, and within 5 seconds (the page's check while it holds someone's songs) their window stops the song, drops its sound and says so. A listener sees no plays, stars, Loved, comments, file names or file ids, and no smart playlist or playlist marked private (Hide from Home Sharing, in the sidebar's playlist menu, a call: real Music chooses in Preferences). A drive song comes through a route naming the song; a stream or Internet Archive song stays a link. Nothing of it is kept in the listener's playback. `tests/music_sharing.rs`, `music-home-sharing-journey` in Chromium, two accounts in two browsers. Limits: a shared library is one list of songs and its playlists, with no Albums or Artists views, sort, search or artwork; a song saved over during a read joins two versions; the 30-second sidebar check is how a new sharer appears; a Guest User neither shares nor listens (a call: a guest has no password). In the browser only a drive song was played; that a stream song stays a link is read from the server's listing in `tests/music_sharing.rs`, and an Internet Archive song's listing was not run |
| 24 | File > Burn Playlist to Disc… | partial | Dimmed, saying why, read in `rows-batch22-journey`. A true limit: a page has no disc drive |
| 25 | File > Convert | built-unchecked | Create WAV Version writes each chosen song of the drive as WAV beside it, its details kept (`preview-books-batch4-journey` decoded the new file; unit test of the bytes). Create AAC Version (an M4A) and Create MP3 Version use the browser's `AudioEncoder`, and each stays dimmed, saying why, where the browser has no such encoder: Chromium and Firefox here (Chromium run, Firefox by a scratch probe). Run in Playwright's WebKit on Linux, the one browser here that has them (`media-rows-batch11-journey`): ffprobe reads the stored M4A as AAC LC, stereo, 44.1 kHz, ffmpeg decodes each file whole and finds the tone, and the browser decodes both. Limits: Safari itself was not run. WebKit's encoder ignored the 192 kbit/s asked for MP3 (about 55 kbit/s came out), and its audio element reports a length of 0 for the MP3, which has no header frame, so the song keeps the first's length and seeking in it in WebKit was not run. Playing a version through Music's player was not run. An Archive song is not converted: the row dims |
| 26 | File > Show in Finder ⇧⌘R | done | Selects the song's file in a Finder window. `music-rows-journey`. [Finder](#project-artifact/art_3f7380b0451dc3ac/232) |
| 27 | File > Page Setup… | built-unchecked | TextEdit's sheet: paper, orientation and scale, kept for the person, which Print's page takes (`preview-books-batch4-journey` read `@page` in the frame) |
| 28 | File > Print… ⌘P | built-unchecked | The list on a page of its own, seen in the frame it prints from; the browser's dialog was not driven, and no screenshot of paper |
| 29 | Edit > Undo ⌘Z | done | Takes back the change it names and nothing else; a deleted song is not brought back (its cover is gone). [Menu](#project-artifact/art_c9443d16a033da1b/2) |
| 30 | Edit > Redo ⇧⌘Z | done | [Menu](#project-artifact/art_c9443d16a033da1b/2) |
| 31 | Edit > Cut ⌘X | done | In a playlist. [Menu](#project-artifact/art_c9443d16a033da1b/2) |
| 32 | Edit > Copy ⌘C | done | Songs for Paste, and text for other apps. [Menu](#project-artifact/art_c9443d16a033da1b/2) |
| 33 | Edit > Paste ⌘V | done | Into a playlist. [Menu](#project-artifact/art_c9443d16a033da1b/2) |
| 34 | Edit > Delete | done | A playlist gives the song up without asking; elsewhere it asks. [Alert](#project-artifact/art_c9443d16a033da1b/4) |
| 35 | Edit > Select All ⌘A | done | [Selection](#project-artifact/art_c9443d16a033da1b/2) |
| 36 | Edit > Deselect All ⇧⌘A | done | Empties the selection. `music-rows-journey`. [Edit menu](#project-artifact/art_3f7380b0451dc3ac/224) |
| 37 | Edit > Find ⌘F | done | Puts the keyboard in the search field. `music-rows-journey`. [Search](#project-artifact/art_3f7380b0451dc3ac/231) |
| 38 | Edit > Emoji & Symbols | done | The desktop's character viewer. [Viewer](#project-artifact/art_3f7380b0451dc3ac/83) |
| 39 | Edit > Start Dictation | built-unchecked | Works in Music's text fields through the desktop's Edit footer; dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in TextEdit, Notes and Finder with a stub recognizer, not driven in Music |
| 40 | Song > Song Info ⌘I | done | [Song Info](#project-artifact/art_c9443d16a033da1b/12) |
| 41 | Song > Rating | done | Also in a song's menu and the Now Playing menu; Undo takes it back. No screenshot of the submenu; the rated value is read back from the server. [Now Playing menu](#project-artifact/art_c9443d16a033da1b/19) |
| 42 | Song > Love | done | Acts on the selection. [Menu](#project-artifact/art_c9443d16a033da1b/2) |
| 43 | Song > Dislike | done | Dislike unloves; Undo Dislike takes it back. Read back from the server. [Now Playing menu](#project-artifact/art_c9443d16a033da1b/19) |
| 44 | Song > Show in Playlist | done | Lists the hand-made playlists holding the song, and goes there with it chosen. Run in `music-files-journey.mjs` |
| 45 | Song > Show in Apple Music / iTunes Store | built-unchecked | Show in iTunes Store, dimmed with its reason (`NO_STORE` in `music-menus.tsx`), read in `rows-batch22-journey`, Chromium |
| 46 | Song > Share Song | done | The desktop's Share rows for an Internet Archive song; Copy Link read back from the clipboard. A song on the drive has its rows dimmed, saying why. [Share](#project-artifact/art_3f7380b0451dc3ac/85) |
| 47 | Song > Add to Playlist | done | Makes a playlist of the song. `music-rows-journey`. [Playlist](#project-artifact/art_3f7380b0451dc3ac/239) |
| 48 | Song > Delete from Library | done | [Alert](#project-artifact/art_c9443d16a033da1b/4) |
| 49 | View > Show/Hide Sidebar ⌥⌘S | done | Kept across a reload. [Hidden](#project-artifact/art_c9443d16a033da1b/5) |
| 50 | View > Show/Hide Status Bar ⌘/ | done | Counts the songs listed and their minutes; kept across a reload. [View Options](#project-artifact/art_c9443d16a033da1b/22) |
| 51 | View > Column Browser ⌘B | done | Genres, Artists and Albums narrow Songs; the setting is kept, the choice starts from All. [Column Browser](#project-artifact/art_3f7380b0451dc3ac/59) |
| 52 | View > Only Downloaded Music | built-unchecked | A kept check box that hides Internet Archive songs from the library's views. The menu row was run in `music-batch-journey`, on a library of drive songs only, so hiding an Archive song has not been seen |
| 53 | View > Show Up Next ⌃⌘U | done | Opens the panel. `music-rows-journey`. [Up Next](#project-artifact/art_3f7380b0451dc3ac/238) |
| 54 | View > Show Lyrics | done | Opens the panel. `music-rows-journey`. [Lyrics](#project-artifact/art_3f7380b0451dc3ac/245) |
| 55 | View > Show Visualizer ⌘T | done | [Visualizer](#project-artifact/art_c9443d16a033da1b/21) |
| 56 | View > Visualizer submenu | done | Music Visualizer and Classic Visualizer, two original drawings; the choice is kept in the person's settings. [Classic](#project-artifact/art_3f7380b0451dc3ac/88) |
| 57 | View > Show View Options ⌘J | done | [View Options](#project-artifact/art_c9443d16a033da1b/22) |
| 58 | View > Sort By | done | Dimmed where the list keeps its own order, a playlist. [View Options](#project-artifact/art_c9443d16a033da1b/22) |
| 59 | View > Enter Full Screen ⌃⌘F | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/68), [Window menu](#project-artifact/art_3f7380b0451dc3ac/65) |
| 60 | Controls > Play/Pause Space | done | Space pauses and plays again. `music-rows-journey`. [Now playing](#project-artifact/art_3f7380b0451dc3ac/228) |
| 61 | Controls > Stop ⌘. | done | [Menu](#project-artifact/art_c9443d16a033da1b/1) |
| 62 | Controls > Next ⌘→ | done | [Menu](#project-artifact/art_c9443d16a033da1b/1) |
| 63 | Controls > Previous ⌘← | done | Goes back to the song before. `music-rows-journey`. [Controls](#project-artifact/art_3f7380b0451dc3ac/222) |
| 64 | Controls > Go to Current Song ⌘L | done | [Menu](#project-artifact/art_c9443d16a033da1b/1) |
| 65 | Controls > Increase Volume ⌘↑ | done | [Menu](#project-artifact/art_c9443d16a033da1b/1) |
| 66 | Controls > Decrease Volume ⌘↓ | done | [Menu](#project-artifact/art_c9443d16a033da1b/1) |
| 67 | Controls > Shuffle submenu | done | Off and On ([menu](#project-artifact/art_c9443d16a033da1b/1)); Songs, Albums and Groupings, kept with the playback and read back from the server in `music-batch-journey`. The order each one gives is checked in `music-player.test.ts` |
| 68 | Controls > Repeat submenu | done | [Menu](#project-artifact/art_c9443d16a033da1b/1) |
| 69 | Controls > Eject Disc ⌘E | partial | Dimmed, saying why. `music-rows-journey`. [Controls](#project-artifact/art_3f7380b0451dc3ac/222) |
| 70 | Account > Sign In… | partial | Dimmed, saying Music uses the desktop's account |
| 71 | Account > Check for Available Downloads | partial | Dimmed, saying why. `music-rows-journey`. [Account](#project-artifact/art_3f7380b0451dc3ac/220) |
| 72 | Account > Authorizations | partial | Dimmed, saying why. `music-rows-journey`. [Account](#project-artifact/art_3f7380b0451dc3ac/220) |
| 73 | Account > Wish List, Purchased, Redeem | partial | Dimmed, saying why. `music-rows-journey`. [Account](#project-artifact/art_3f7380b0451dc3ac/220) |
| 74 | Window > Minimize ⌘M | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/68), [Window menu](#project-artifact/art_3f7380b0451dc3ac/65) |
| 75 | Window > Zoom | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/68), [Window menu](#project-artifact/art_3f7380b0451dc3ac/65) |
| 76 | Window > Music ⌥⌘1 | built-unchecked | The key, in the Music window and in its MiniPlayer, asks the desktop to bring Music forward; the menus' other keys reach Music from the MiniPlayer too (unit test in `music-desktop.test.tsx`). Not run in the browser: the run is on Linux, where Command is Control and the desktop takes Control-Option-1 for Spaces; on a Mac the key is Meta-Option-1, which Spaces does not use. With the window minimized the key does not reach Music, as the desktop then takes keys elsewhere; the Dock's tile brings it back. The Window menu's row is the desktop's window list, in `desktop-menus.tsx`, which does not show the key |
| 77 | Window > Switch to MiniPlayer ⇧⌘M | done | Opens it. `music-rows-journey`. [MiniPlayer](#project-artifact/art_3f7380b0451dc3ac/229) |
| 78 | Window > Equalizer ⌥⌘E | done | [Equalizer](#project-artifact/art_c9443d16a033da1b/20) |
| 79 | Window > Visualizer | done | The same command. [Visualizer](#project-artifact/art_c9443d16a033da1b/21) |
| 80 | Window > Bring All to Front | done | `media-shell-journey`. [App menu](#project-artifact/art_3f7380b0451dc3ac/68), [Window menu](#project-artifact/art_3f7380b0451dc3ac/65) |
| 81 | Help > Music Help | done | Opens Help Viewer on a search for Music. [Help Viewer](#project-artifact/art_3f7380b0451dc3ac/87) |
| 82 | Help > Keyboard Shortcuts | done | A sheet of the menus' key equivalents, read from the commands they run. [Sheet](#project-artifact/art_3f7380b0451dc3ac/86) |

Menus: 82 rows; 63 done, 5 built-unchecked, 14 partial.

## Views, sidebar, toolbar and windows

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 83 | Sidebar: Recently Added | done | `music-rows-journey`. [Recently Added](#project-artifact/art_3f7380b0451dc3ac/230) |
| 84 | Sidebar: Artists | done | `music-rows-journey`. [Artists](#project-artifact/art_3f7380b0451dc3ac/223) |
| 85 | Sidebar: Albums | done | `music-rows-journey`. [Albums](#project-artifact/art_3f7380b0451dc3ac/221) |
| 86 | Sidebar: Songs | done | `music-rows-journey`. [Songs](#project-artifact/art_3f7380b0451dc3ac/235) |
| 87 | Sidebar: Genres | done | Albums grouped under each genre. [Genres](#project-artifact/art_3f7380b0451dc3ac/60) |
| 88 | Sidebar: Composers | done | Albums grouped under each composer. Song Info edits the composer; tags are read from ID3, MP4 and Vorbis, and only the ID3 reader has a test. [Composers](#project-artifact/art_3f7380b0451dc3ac/84) |
| 89 | Sidebar: Music Videos | built-unchecked | Lists the video files in the Music folder of the drive and plays one in the pane, pausing the song. The empty state was seen in `music-batch-journey`; the list is checked in `music-song-options.test.ts`; a video playing has not been run |
| 90 | Sidebar: Downloaded | done | The songs on the drive, not those at the Internet Archive. `music-batch-journey`, with a unit test holding both kinds |
| 91 | Sidebar: Apple Music (For You, Browse, Radio) | partial | No such service here. Radio lists internet stations from the free Radio Browser directory, most listened first, by name or genre, MP3 at https addresses only; a station plays straight from its own server and can be kept in the library as a stream; one that sends no CORS header says it can't play (`music-radio.test.tsx`, `music-radio-journey`). Its row sits under Internet Radio, as these are not Apple's stations. For You is dimmed, saying why (`music-batch-journey`): it is Apple's recommendations, which nothing here can stand in for. Internet Archive Browse stands in for Browse |
| 92 | Sidebar: iTunes Store | partial | No such service here: the row is dimmed, saying why (`music-batch-journey`) |
| 93 | Sidebar: Loved Songs | built-unchecked | |
| 94 | Sidebar: Recently Played | built-unchecked | |
| 95 | Sidebar: Top 25 Most Played | built-unchecked | |
| 96 | Sidebar: user playlists, rename, delete | built-unchecked | Rename and delete are in the heading |
| 97 | Playlist folders | done | Nest, drag in, Move to Folder, rename, delete with their playlists, Undo. [A folder in the sidebar](#project-artifact/art_c9443d16a033da1b/14) |
| 98 | User smart playlists and rules editor | done | Song, Artist, Album, Genre, Year, Plays, Loved, Date Added; all or any; limit. No nested rule groups. [Result](#project-artifact/art_c9443d16a033da1b/16) |
| 99 | Genius | built-unchecked | File > New > Genius Playlist, from the selected or playing song: that song, then those of the person's own library that share its artist or genre, artist first, then loved, rated and played; disliked and unchecked songs stay out. Dimmed with why when no song is chosen; says why when nothing shares either. Over the playlist: a note that it was made on this desktop and is not Apple's service, a limit of 25 to 100 songs and Refresh; kept across a reload. The server's list and the limit chosen read in `rows-batch28-journey`. **Limit:** similarity is artist and genre only, with no listening data from anyone else |
| 100 | Album grid and album detail | done | An album opens on its songs. `music-rows-journey`. [Detail](#project-artifact/art_3f7380b0451dc3ac/225) |
| 101 | Artist view | done | `music-rows-journey`. [Artists](#project-artifact/art_3f7380b0451dc3ac/223) |
| 102 | Song table, sort by heading | done | A heading click turns the sort over. `music-rows-journey`. [Sorted](#project-artifact/art_3f7380b0451dc3ac/236) |
| 103 | Column chooser and View Options | done | Adds Year, Rating and Date Added; the columns and sort are kept across a reload. [View Options](#project-artifact/art_c9443d16a033da1b/22) |
| 104 | Library search | done | Finds the song. `music-rows-journey`. [Search](#project-artifact/art_3f7380b0451dc3ac/231) |
| 105 | Search scope | done | A scope bar over the results, Library or Internet Archive; the second turns the search there. `music-batch-journey` |
| 106 | Internet Archive browse, search, item, add | done | Browse lists the Archive's openly licensed music; Add to Library adds an item's tracks with its licence. `music-rows-journey`. [Item](#project-artifact/art_3f7380b0451dc3ac/226) |
| 107 | Internet Archive failed item load | done | Try Again reads the item again. [Failed item](#project-artifact/art_c9443d16a033da1b/10) |
| 108 | Song Info window: Details, Artwork, Lyrics, Options, Sorting, File | built-unchecked | All six panes save (`music-batch-journey`, read back from the server), with Grouping and Comments in Details, Start, Stop, Volume, Equalizer, Skip when shuffling and Remember playback position in Options, and Sort Name, Artist, Album, Album Artist and Composer in Sorting (`music-quicktime-batch3-journey`: a song set to remember starts where it was left, across a reload; the place is in the playback on the server). Lyrics for several songs at once and Media Kind stay dimmed, saying why. Volume above the song's level stops at the media element's full volume. A preset chosen in Equalizer is checked by a unit test; how it sounds has not been judged. [Song Info](#project-artifact/art_c9443d16a033da1b/12) |
| 109 | Multiple Item Info | done | [Several songs](#project-artifact/art_c9443d16a033da1b/13) |
| 110 | Up Next panel | done | Play Next, Play Later, double click, remove (row 126), reorder (row 138), and History, with Clear. `music-batch-journey` |
| 111 | Lyrics panel | done | Shows the lyrics typed in Song Info, kept on the server, else those in the song file's tags. The typed route is `music-batch-journey`; reading tags is checked for ID3 in `music-tags.test.ts`, not run in a browser. Undo does not take typed lyrics back |
| 112 | MiniPlayer, keep on top | done | Opens ([MiniPlayer](#project-artifact/art_3f7380b0451dc3ac/229)); with the setting on it stands above every window, and Calculator brought forward does not cover it. `music-batch-journey` |
| 113 | Equalizer window and presets | done | Preamp, ten bands, fourteen presets, kept across a reload. The filters' gains and sound reaching the end were read from Web Audio; how it sounds has not been judged. [Equalizer](#project-artifact/art_c9443d16a033da1b/20) |
| 114 | Visualizer | done | An original drawing from the sound's frequencies. [Visualizer](#project-artifact/art_c9443d16a033da1b/21) |
| 115 | Preferences panes | built-unchecked | As row 2: General and Playback act, Advanced's MiniPlayer setting acts, and each of the others is dimmed with its reason |
| 116 | Now Playing display and seek | built-unchecked | |
| 117 | Audio output button | built-unchecked | A menu of the outputs the browser names, by `setSinkId`, kept by name with the person's settings, since an id can change, and the sound goes there again across a reload (`music-quicktime-batch3-journey`, with Chromium's fake outputs). The browser names them only once the desktop may use the microphone, and the menu says so. Dimmed with the reason in a browser without `setSinkId`. Sound on a real second device was not heard |
| 118 | Playback bar transport, Shuffle, Repeat | done | The Shuffle and Repeat buttons are kept. `music-rows-journey`. [Transport](#project-artifact/art_3f7380b0451dc3ac/237) |
| 119 | Volume slider | done | Kept. `music-rows-journey`. [Transport](#project-artifact/art_3f7380b0451dc3ac/237) |
| 120 | Song-change notification banner | built-unchecked | |

Views: 38 rows; 25 done, 8 built-unchecked, 5 partial.

## Context menus and keyboard shortcuts

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 121 | Song row menu: Play, Play Next, Play Later, Love, Add to Playlist, Remove, Delete | done | [Row menu](#project-artifact/art_c9443d16a033da1b/3) |
| 122 | Song row menu: Song Info, Rating, Show in Finder, Share, Copy, Show in Album | done | Share is partial (row 46). Show in Album opens the album. [Song Info](#project-artifact/art_c9443d16a033da1b/12) |
| 123 | Album cell menu | done | Play has been run; Play Next, Play Later, Love, Add to Playlist, Album Info, Copy and Delete share the song menu's commands. [Album menu](#project-artifact/art_c9443d16a033da1b/17) |
| 124 | Artist cell menu | done | The Artists view has no artist cell, so the artist's heading has the menu, acting on all the artist's songs. Love read back from the server in `music-batch-journey` |
| 125 | Sidebar playlist menu: Rename, Delete, Duplicate, Play Next, Export | done | Export writes a file on the drive naming its songs. `music-rows-journey`. [Export](#project-artifact/art_3f7380b0451dc3ac/233), [a folder in the sidebar](#project-artifact/art_c9443d16a033da1b/14) |
| 126 | Up Next row menu | done | Play, Remove from Up Next. [Up Next menu](#project-artifact/art_c9443d16a033da1b/18) |
| 127 | Now Playing display menu | done | [Now Playing menu](#project-artifact/art_c9443d16a033da1b/19) |
| 128 | ⌥⌘F search focus | done | Run in `music-browser-journey.mjs`, as Alt and Control in Chromium. [Column Browser](#project-artifact/art_3f7380b0451dc3ac/59) |
| 129 | Return plays the selected song | done | `music-rows-journey`. [Now playing](#project-artifact/art_3f7380b0451dc3ac/228) |
| 130 | Delete removes the selection | done | A playlist gives the song up; elsewhere it asks. [Alert](#project-artifact/art_c9443d16a033da1b/4) |
| 131 | Type to select | done | The row was stale: the song table has it through `TableView`'s `getRowLabel`. Typing "ke" selected Kelp in `music-batch-journey` |
| 132 | Media keys through Media Session | built-unchecked | Media Session names the song, and its pause and play handlers drive the player (`music-quicktime-batch3-journey`, calling the handlers the page gave the browser). A hardware key cannot be pressed from a browser run, so the key itself was not pressed. [Now playing](#project-artifact/art_3f7380b0451dc3ac/228) |

Context and keys: 12 rows; 11 done, 1 partial.

## Drag and drop

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 133 | Drop audio files from the computer on the window | built-unchecked | |
| 134 | Drop a song from a Finder window | built-unchecked | Takes a drive drag anywhere in the window; only the Dock tile's route is run so far |
| 135 | Drag songs to a sidebar playlist | done | One or several. [Drag](#project-artifact/art_c9443d16a033da1b/6) |
| 136 | Drag songs to Up Next | done | [Fir joined Up Next](#project-artifact/art_c9443d16a033da1b/9) |
| 137 | Reorder a playlist by drag | done | [Reordered](#project-artifact/art_c9443d16a033da1b/7) |
| 138 | Reorder Up Next by drag | done | A line shows where it lands; kept on the server and over a reload. [Reorder](#project-artifact/art_3f7380b0451dc3ac/62) |
| 139 | Drag albums and artists | built-unchecked | An album, or several chosen, into a playlist ([chosen](#project-artifact/art_3f7380b0451dc3ac/61)). An artist's heading now starts a drag of the artist's songs; that part has not been run |
| 140 | Drag a song out to Finder | built-unchecked | Copies the drive file; an Internet Archive song has none, and Finder passes it by |
| 141 | Drop a folder of music | built-unchecked | The folder's sound files are added |

Drag: 9 rows; 4 done, 5 built-unchecked.

## Multi-selection

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 142 | Shift and ⌘ selection in the song table | done | [Selection](#project-artifact/art_c9443d16a033da1b/2) |
| 143 | Multi-selection in the album grid | done | Command- and Shift-click; the album menu and the Song menu act on them all. [Chosen](#project-artifact/art_3f7380b0451dc3ac/61) |
| 144 | Commands on several songs | done | Menus and row menu. [Row menu](#project-artifact/art_c9443d16a033da1b/3) |

Multi-selection: 3 rows; 3 done.

## Saved state

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 145 | Library on the server | done | Limits: 500 songs, 100 playlists. Read back after a reload. `music-rows-journey`. [Kept](#project-artifact/art_3f7380b0451dc3ac/240) |
| 146 | Playback: Up Next, place, Shuffle, Repeat, volume, plays | done | Read back from the server after a reload. `music-rows-journey`. [Kept](#project-artifact/art_3f7380b0451dc3ac/240) |
| 147 | Five Preferences settings | done | Read back from the server in `music-batch-journey`. `tests/music.rs` covers the three older ones for each person. Star ratings and Songs list checkboxes are absent from settings saved earlier, and read as on and off |
| 148 | View state: last view, column widths, sort, sidebar | done | The place left open comes back after a reload, read from the settings; a list since deleted turns to Songs. Column widths are not kept. [Kept](#project-artifact/art_3f7380b0451dc3ac/89) |
| 149 | Deleting a song | built-unchecked | Asks: Keep File, or Move to Trash ([alert](#project-artifact/art_c9443d16a033da1b/4)). A second window that names the file again between the read-back and the trash request no longer leaves a song whose file is in the Trash: Music reads the library once more after the request and brings the file back out (`media-small-batch8-journey`, the second window stood in for by a PUT through the library's route; the file is in the Trash only for that moment, and the two stores cannot change as one). |

Saved state: 5 rows; 4 done, 1 partial.

## Cross-app

| # | Item | Status | Note |
| --- | --- | --- | --- |
| 150 | Open an audio file from Finder in Music | done | Double-click and the Dock tile: added once, and played. [Opened](#project-artifact/art_c9443d16a033da1b/8) |
| 151 | Dock menu: Play, Next, Previous, song | done | While the window is open: the song loaded, Play or Pause, Next, Previous. Play and Pause read from the button. [Dock menu](#project-artifact/art_3f7380b0451dc3ac/90) |
| 152 | Siri playback commands | done | "play music" plays, its button read. `music-rows-journey`. [Siri](#project-artifact/art_3f7380b0451dc3ac/234) |
| 153 | Spotlight finds songs, and shows the song found selected in Songs, in an open window or one it opens | done | `e2e/music-depth-journey.mjs` |
| 154 | Share a song | done | As row 46. [Share](#project-artifact/art_3f7380b0451dc3ac/85) |
| 155 | Copy and paste songs between playlists | done | Copied in one playlist, pasted in another, read back from the server. [Pasted](#project-artifact/art_3f7380b0451dc3ac/91) |

Cross-app: 6 rows; 6 done.

## Build items, most-used first

1. **Menus carry the commands.** Register Controls, File, Song, View, Edit and Window rows for what already works, with key equivalents and dimmed reasons. Rows 8, 13-14, 42, 47-48, 53-54, 58, 60-68, 70-73, 76-77, 81.
2. **Multi-selection in the song table** with commands on the selection and Select All, Deselect All, Delete. Rows 34-37, 130, 142, 144.
3. **Drag songs:** to playlists and Up Next, reorder both, drop from Finder. Rows 134-138.
4. **Song Info:** edit tags, artwork, lyrics, Multiple Item Info. Rows 21, 40, 108-109, 111.
5. **Playlists:** New from Selection, folders, duplicate, sidebar menu, export and import. Rows 9, 11, 18-19, 97, 125.
6. **Smart playlists** and rules editor. Rows 10, 12, 98.
7. **Row menus:** the absent song rows, album, artist, Up Next and display menus; Show in Finder; Rating; Dislike. Rows 26, 41, 43-44, 122-124, 126-127.
8. **View and sidebar:** sidebar toggle, status bar, Column Browser, View Options, Genres, Composers, keep the view. Rows 49-51, 57, 87-88, 103, 148.
9. **Up Next completion and player keys:** remove, History, Stop, Go to Current Song, volume keys. Rows 61, 64-66, 110.
10. **Equalizer and Visualizer.** Rows 55-56, 78-79, 113-114.
11. **Library file commands:** Export Library, duplicates, delete the file too, print. Rows 17, 20, 27-28, 149.
12. **Cross-app:** Dock menu, Siri, share, copy and paste, open from Finder. Rows 150-152, 154-155.
13. **Ledger:** Try Again on a failed Internet Archive item. Row 107.
14. **Service rows** dimmed with reasons. Rows 15-16, 22-25, 39, 45, 52, 69, 89-92, 99.

## Counts (by hand)

155 rows: 116 done, 20 built-unchecked, 19 partial, 0 missing. Rows change as items land.
