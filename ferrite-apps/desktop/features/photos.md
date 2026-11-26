# Feature inventory: Photos

First read from main at commit `e62c2ac9` (29 October 2026). The three journeys `e2e/photos-journey.mjs`, `e2e/photos-depth-journey.mjs` and `e2e/photos-keys-journey.mjs` passed in Chromium on 3 November 2026 on the running desktop at site build `5d4bd527a45f`, the tree of this change. The screenshots linked from done rows were taken on 2 November from earlier builds of the same work, so a later fix to a row may not show in its picture. Firefox 157 and Playwright's WebKit 27.2 on Linux pass `photos-journey` (69 steps) and `photos-movie-journey` (9). Firefox also passes the whole `photos-census-journey`, 150 rows with no page problem; WebKit passed the first 77 rows of it before the sandbox stopped, so its run is not finished.

**Status words.** `missing`: not in main's code. `partial`: part is in main's code, and the note says what is absent. `built-unchecked`: main's code has it, but nobody has seen it running for this inventory. `dimmed`: a web page can't do it, so the control shows dimmed with a reason a person can read. `not-applicable`: a row a Mac hides while it is empty and that a browser can never fill, so it never shows, and the note gives why. A row becomes done only with a screenshot from the running desktop in a browser.

**What was read:**

- `demos/photos/photos-desktop.tsx` (the window the Ferrite desktop opens), `photos-library.ts`, `photos-editor.tsx`, `photos-served-data.ts`, `photos.mdx`, `app.ts`
- the head of `ferrite-apps/desktop/src/apps/photos/mod.rs`
- `demos/desktop/desktop-menus.tsx`, `desktop-app-menus.ts`
- `demos/finder/finder-open.ts`, `finder-drag.ts`

**How reliable the "real app" column is.** Keyboard shortcuts come from Apple's Catalina page, "Keyboard shortcuts and gestures in Photos on Mac" (support.apple.com/guide/photos/pht9b4411b24/5.0/mac/10.15). Which menu holds each item comes from knowledge of Photos 5, not from a capture. Check placement against `reference/` when building each row.

**Ledger.** The "Macalicious open work ledger" (version 3) has no open item for Photos.

**Other journeys.** `e2e/photos-journey.mjs` passed 69 of 69 on the Sort, toolbar, search and slideshow batch. `e2e/photos-census-journey.mjs` as a whole is longer than a run's 10 minutes, so it runs in slices with `--only a,b,c`; its import rows always run, as the others build on them. Rows passed in slices on a reset server: import, About, Preferences, the toolbar's Info and Favorite and their keys and menu rows, the Showing filter, and the viewer's open, next, previous, back and edit. Corrected and not yet seen passing: the Return key to the editor, the editor's filter rows, and both Export rows. Not run in a slice: crop, albums, context menus, Recently Deleted, persistence and the second account. No row here rests on the census. The whole census, with its new `people.faces` row, passed 150 of 150 rows in Chromium on 7 November 2026 in about four and a half minutes, in the People batch's build.

## Application menu (Photos)

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| About Photos | Version panel | built-unchecked | Desktop's shared row |
| Preferences… (Command-comma) | General, iCloud, Shared Albums panes | done | A floating panel with the three panes as tabs, not a separate window. Autoplay Videos works and survives a reload, Show in Finder goes to the library's files, and every row a browser can't do is dimmed with its reason beside it: System Photo Library, referencing files, Summarize Photos, Holiday Events, iCloud Photos, Shared Albums [shot](#project-artifact/art_a7e016210b9b9bc1/329). On the docs desktop the demo opens the same panel from the menu and from the key, without Autoplay, since it has no movies [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/1) |
| Services | System services | dimmed | The desktop's shared menu shows a dimmed "No Services Apply": no system services reach a web page |
| Hide Photos (Command-H) | Window visibility | built-unchecked | Desktop's shared rows |
| Hide Others | Window visibility | built-unchecked | Desktop's shared rows |
| Show All | Window visibility | built-unchecked | Desktop's shared rows |
| Quit Photos (Command-Q) | Quits | built-unchecked | Desktop's shared row |

## File menu

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Import… (Shift-Command-I) | Chooses files, then an import review | done | Review sheet with a tile per file, Import N Selected, Import All New Items and Cancel; a file the library holds starts unchosen [shot](#project-artifact/art_3e7ee16bed9df50f/45) |
| New Album (Command-N) | Makes an album | done | Key and row; names it in a sheet [shot](#project-artifact/art_3e7ee16bed9df50f/16) |
| New Album with Selection | Album holding the selection | done | [shot](#project-artifact/art_3e7ee16bed9df50f/23) |
| New Smart Album… (Option-Command-N) | Rule sheet | done | [shot](#project-artifact/art_3e7ee16bed9df50f/2) |
| New Folder (Shift-Command-N) | Folder in the sidebar | done | [shot](#project-artifact/art_3e7ee16bed9df50f/5) |
| Create ▸ Slideshow | Projects | built-unchecked | Saves a slideshow project; not walked |
| Book | Projects | dimmed | Dimmed with its reason: these are made by Apple's print services, which this desktop can't reach [shot](#project-artifact/art_a7e016210b9b9bc1/331) |
| Card | Projects | dimmed | Dimmed with the same reason [shot](#project-artifact/art_a7e016210b9b9bc1/331) |
| Calendar | Projects | dimmed | Dimmed with the same reason [shot](#project-artifact/art_a7e016210b9b9bc1/331) |
| others | Projects | dimmed | Prints is dimmed with the same reason; third-party project extensions don't exist here [shot](#project-artifact/art_a7e016210b9b9bc1/331) |
| Export ▸ Export N Photos… (Shift-Command-E) | Sheet of format, quality and name, then a folder; several photos | built-unchecked | One photo walked to Documents; several not [shot](#project-artifact/art_3e7ee16bed9df50f/17) |
| Export ▸ Export Unmodified Original… | Original files; several photos | built-unchecked |  |
| Share ▸ | System sharing services | done | Hands over the edit: an edited picture goes as a rendered copy in Pictures/Shared from Photos; an unedited one as its original [shot](#project-artifact/art_3e7ee16bed9df50f/51) |
| Print… (Command-P) | Print sheet with layouts | built-unchecked | Row shown; the browser's print was not walked [shot](#project-artifact/art_3e7ee16bed9df50f/23) |
| Close Window (Command-W) | Closes | built-unchecked | Desktop's shared row |

## Edit menu

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Undo (Command-Z) (Shift-Command-Z) | Library and edit actions | done | Names the action [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| Redo (Shift-Command-Z) | Library and edit actions | done | [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| Cut (Command-X) | Photos through the clipboard | built-unchecked | Within Photos only [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| Copy (Command-C) | Photos through the clipboard | done | Within Photos only [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| Paste (Command-V) | Photos through the clipboard | done | Into the album shown; elsewhere duplicates [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| Duplicate N Photos (Command-D) | Independent copy | done | [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| Select All (Command-A) | Selects what is listed | done | [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| Deselect All (Shift-Command-A) | Clears | done | [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| Find (Command-F) | Focuses search | done | [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| Delete N Photos (Command-Delete) | Confirms, then Recently Deleted | built-unchecked | The key, Delete outside an album, and the Edit, Image and photo menus ask first, naming how many and how long Recently Deleted keeps them; Cancel leaves them. A drag onto Recently Deleted moves without asking. Unit-tested in photos-desktop.test; the dialog and Cancel walked in Chromium at site build `6585858d80dd`, in a one-off journey with no linked screenshot |
| Recover (in Recently Deleted) | Recovers or erases, with a confirmation for erasing | done | [shot](#project-artifact/art_3e7ee16bed9df50f/21) |
| Delete Immediately (in Recently Deleted) | Recovers or erases, with a confirmation for erasing | done | Confirms first [shot](#project-artifact/art_3e7ee16bed9df50f/15) |
| Start Dictation | System rows | built-unchecked | The desktop's Edit footer: types what the browser's recognizer hears at the insertion point, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer |
| Emoji & Symbols | System rows | built-unchecked | The desktop's shared row opens the Character Viewer |

## Image menu

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Show Edit Tools (Return) | Opens the editor on the selection | done | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Rotate Counterclockwise (Command-R) | Quarter turn left | done | Labelled Rotate Left [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Rotate Clockwise (Option-Command-R) | Quarter turn right | done | Labelled Rotate Right [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Enhance (Command-E) | Auto Enhance on the selection | built-unchecked | Key pressed in a journey, result not asserted [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Favorite / Unfavorite (period) | Toggles | done | [shot](#project-artifact/art_3e7ee16bed9df50f/23) |
| Revert to Original | Forgets edits, in several photos | built-unchecked | One photo walked; several not [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Hide N Photos (Command-L) | Moves to Hidden | done | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Make Key Photo (Shift-Command-K) | Album's cover | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Adjust Date and Time… | Changes the taken date, one or many | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| Adjust Location ▸ Assign | Location of the selection | done | Typed in Info, as coordinates and a name [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| Remove | Location of the selection | built-unchecked |  |
| Copy | Location of the selection | built-unchecked |  |
| Paste | Location of the selection | built-unchecked |  |
| Revert | Location of the selection | built-unchecked | The file's own place is kept at import, and Revert to Original Location puts it back, read in photos-names-journey; no screenshot |
| Open With ▸ / Edit With ▸ | Hands the photo to another app | built-unchecked | Image and the photo's menu have Edit With > Preview, also from inside the editor. It opens a copy, in Pictures/Photos Edits, of the photo as it shows, and what Preview saves comes back as the photo's edit, whichever windows are open; the original stays as it was, and Revert takes the edit and the copies away. What Preview saved is named in the photo's edit on the server (`Edit.external`), so any number of photos can hold such an edit; a setting of at most 4,096 bytes records which file Preview has open for the latest 16, and a Preview window left open on an older one saves without its save coming back. `e2e/cross-batch7-journey.mjs`, `e2e/preview-photos-batch9-journey.mjs`, which reloads with the record gone, `photos-edit-return.test.ts`. Preview is the only editor this desktop has [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/5) |
| Set Desktop Picture | Desktop picture | built-unchecked | In Share and the contextual menu, not in Image; photo is drawn with its edit |
| Get Info (Command-I) | Info window | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |

## View menu

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Years (Command-1 to 4) | Library views | done | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Months (Command-1 to 4) | Library views | done | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Days (Command-1 to 4) | Library views | done | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| All Photos (Command-1 to 4) | Library views | done | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Show or Hide Sidebar (Option-Command-S) | Toggles the sidebar | done | [shot](#project-artifact/art_3e7ee16bed9df50f/22) |
| Metadata ▸ Titles (Shift-Command-T) | Text under thumbnails | done | [shot](#project-artifact/art_3e7ee16bed9df50f/18) |
| Keywords | Text under thumbnails | built-unchecked |  |
| Sort ▸ Oldest First | Album order | done | View > Sort > Keep Sorted By Oldest First, on an album; the submenu is dimmed with no album. Stored, and the album leads with the older photo, in photos-names-journey [shot](#project-artifact/art_a7e016210b9b9bc1/533) |
| Newest First | Album order | done | Keep Sorted By Newest First, as Oldest First [shot](#project-artifact/art_a7e016210b9b9bc1/533) |
| Title | Album order | done | Keep Sorted By Title: the server keeps it, the album lists Apple before Pear though Pear was added first, and it holds after a reload, in photos-names-journey [shot](#project-artifact/art_a7e016210b9b9bc1/533) |
| Keep Sorted | Album order | done | The choice is stored on the album and survives a reload; a photo joining a title-sorted album takes its place, and Order Added lets it go and gives the added order back, in photos-names-journey [shot](#project-artifact/art_a7e016210b9b9bc1/533) |
| Filter ▸ All Items | Filters the pane | built-unchecked | In the menu bar and the header [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Favorites | Filters the pane | built-unchecked | In the menu bar and the header |
| Edited | Filters the pane | built-unchecked | In the menu bar and the header |
| Photos | Filters the pane | built-unchecked |  |
| Videos | Filters the pane | built-unchecked | A movie can be imported now; this filter was not walked |
| Keywords | Filters the pane | built-unchecked |  |
| Show Hidden Photo Album | Shows the Hidden row | done | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Zoom In (Command-plus) | Thumbnail size, or photo zoom in the viewer | built-unchecked | Thumbnails checked; the viewer's zoom not [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Zoom Out (Command-minus) | Thumbnail size, or photo zoom in the viewer | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Show Thumbnails (Option-S) | Strip under an open photo | done | [shot](#project-artifact/art_3e7ee16bed9df50f/9) |
| Enter Full Screen (Control-Command-F) | Full screen window | built-unchecked | Desktop's shared row |

## Window and Help menus

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Minimize (Command-M) | Window commands | built-unchecked | Desktop's shared rows |
| Zoom | Window commands | built-unchecked | Desktop's shared rows |
| Bring All to Front | Window commands | built-unchecked | Desktop's shared rows |
| window list | Window commands | built-unchecked | Desktop's shared rows |
| Info | Toggles the floating Info window | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| Keyword Manager (Command-K) | Floating window of keywords | done | [shot](#project-artifact/art_3e7ee16bed9df50f/8) |
| Photos Help | Help Viewer | done | Opens Help Viewer on a search for Photos, which lists Photos' own help book first: importing, albums, Memories, editing, sharing [shot](#project-artifact/art_a7e016210b9b9bc1/330) |
| menu search | Help Viewer | built-unchecked | The Help menu's search field is the desktop's shared one; not walked here |

## Sidebar

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Photos (Control-1) | Library views | done | [shot](#project-artifact/art_3e7ee16bed9df50f/23) |
| Memories (Control-2) | Generated collections | partial | Runs of photos taken within two days and a Best of per year, from dates and places, with Slideshow. Favorite Memories and Delete Memory from a tile's menu or the memory's heading, kept on the server by memory id across a reload [shot](#project-artifact/art_a7e016210b9b9bc1/316). A memory leaves out near-duplicates by each thumbnail's hash and counts what it holds. Play Memory Movie runs it with Ken Burns motion, and Export Memory Movie… records it to the drive at three seconds a picture; the stored WebM was decoded in `photos-rows-batch11-journey` (12.0 s, four pictures, no sound). The heading names the soundtrack, the song of the person's Music library that its Mood names (real Photos picks from Apple's tracks, which cannot ship), or None when there is none; Play Memory Movie sounds it and the exported movie holds it, decoded at the song's 440 Hz over 14.3 s for five pictures, in `photos-slideshow-journey`. Mood offers Photos' nine names, kept by memory among the desktop's values (`photos-mood.test.ts`): each sets the pace and how pictures lead on, Gentle being the default, and names another song when Music has several. Scenes: a model on the site's own assets reads each thumbnail in the page, about a second a picture in a worker, and a scene that six photos of more than one day show makes a memory of its own (`photos-scenes.test.ts`). It names sixteen scenes from ImageNet's classes, far fewer than a Mac's |
| Favorites (Control-3) | Favourites | built-unchecked | Passes in photos-keys-journey; no screenshot of it |
| People (Control-4) | Faces | built-unchecked | Faces are found while the page is idle, one picture at a time, by the bundled BlazeFace short-range model in a worker, from each photo's stored thumbnail (480 pixels on its long side), read whole and in overlapping tiles. Only the boxes go to the desktop's own server (`POST /api/photos/faces`), and a photo is looked at once. The pane shows a round tile per person cropped to the face, then Unnamed Faces with a name field that reuses names already given, and Not a Face; a tile opens its photo. `e2e/photos-people-batch20-journey.mjs` with the fixture picture. Limits: faces are not grouped, because no cheap comparison held up (over 240 Labeled Faces in the Wild pictures of 60 people, a landmark ratio, a dHash and a crop correlation reached ROC areas of 0.54, 0.56 and 0.63, and the best was right 6% of the time at 10% recall), so a person is only the faces and photos given their name, and the pane says so. A face under about a thirtieth of a thumbnail's long side is missed, and a small face's tile is blurred because it is cut from the thumbnail. A face turned far from the camera may be missed. Scores under 0.75 are dropped, which removed all 36 false faces on 24 pictures of nobody; a false face above that can still appear, and Not a Face removes it. Movies are not looked at. An edit that changes the frame (turn, crop, straighten, perspective, Preview's file) clears a photo's boxes and looks again: one face with one person takes the name back, otherwise the names stay on the photo and the faces are offered again. A duplicate is looked at anew in the same way. Chromium only. Screenshots in `.out/peo20`, not published. A click on the People row while a person's photos or one of them shows returns to People, as Back does (`rows-batch25-journey`, `photos.people`); the Memories row does the same from a memory, not driven by a journey |
| Places (Control-5) | Map of photos | done | OpenStreetMap tiles with a pin per place; pins merge as the map zooms out; a pin of several lists them, a pin of one opens it; Map or Grid survives a reload [shot](#project-artifact/art_3e7ee16bed9df50f/41) |
| Recents (Control-6) | Recently added | built-unchecked | Passes in photos-keys-journey; no screenshot of it |
| Imports (Control-7) | Import batches by date | done | Photos added with under two minutes between them show as one batch, newest first, headed with its day and time; a click on the heading selects the batch. No record names an import, so the pause decides [shot](#project-artifact/art_a7e016210b9b9bc1/324) |
| Photo Booth row | Not in real Photos | built-unchecked | Kept as a deliberate extra |
| Shared: Activity | iCloud sharing | dimmed | The row shows dimmed in a Shared section, its reason on the pointer: iCloud can't be reached from here. Unit-tested |
| Shared Albums | iCloud sharing | dimmed | As Activity; Preferences dims it too and says why. Unit-tested |
| Media Types: Videos | Automatic albums | done | The row appears once a movie exists, and lists it [shot](#project-artifact/art_3e7ee16bed9df50f/27). The section's title goes with its last row, as on a Mac |
| Selfies | Automatic albums | built-unchecked | Shows when its kind exists |
| Live Photos | Automatic albums | not-applicable | Catalina hides an empty Media Types row, and this one stays empty: a browser can't read a Live Photo's paired movie. Unit test: the row is absent |
| Portrait | Automatic albums | not-applicable | Never shows: a browser reads no depth data from a picture. Unit test: the row is absent |
| Panoramas | Automatic albums | built-unchecked | Shows when its kind exists |
| Time-lapse | Automatic albums | not-applicable | Never shows: a movie's file doesn't tell a browser it was a time-lapse. Unit test: the row is absent |
| Slo-mo | Automatic albums | not-applicable | Never shows, for the same reason. Unit test: the row is absent |
| Bursts | Automatic albums | not-applicable | Never shows: a picture's file doesn't tell a browser it was part of a burst. Unit test: the row is absent |
| Screenshots | Automatic albums | built-unchecked | Shows when its kind exists |
| Animated | Automatic albums | built-unchecked | Shows when its kind exists |
| My Albums | Disclosure and albums overview | done | Outline with disclosure; the heading opens the pane of tiles [shot](#project-artifact/art_a7e016210b9b9bc1/349) |
| as an outline row with a pane of tiles | Disclosure and albums overview | done | A tile per album and smart album, with its key photo and count; a tile opens it; the pane comes back after a reload [shot](#project-artifact/art_a7e016210b9b9bc1/349) |
| Album row | Key photo as icon, count | done | [shot](#project-artifact/art_3e7ee16bed9df50f/5) |
| Folders in My Albums | Nested outline | done | [shot](#project-artifact/art_3e7ee16bed9df50f/5) |
| Smart album rows | Gear icon, live contents | done | Live contents with a gear glyph; ours is a drawn stand-in [shot](#project-artifact/art_a7e016210b9b9bc1/331) |
| My Projects | Project list | built-unchecked |  |
| Hidden | Appears when shown | done | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Recently Deleted | Days left, recover, erase | built-unchecked | Days left and Recover walked; Delete All not [shot](#project-artifact/art_3e7ee16bed9df50f/21) |
| Drag an album row to reorder or into a folder | Reorders | built-unchecked | Into a folder checked [shot](#project-artifact/art_3e7ee16bed9df50f/5). A row dropped on another row is placed before it with `changeAlbum(id, { before, folder })`, read in the code; reorder not walked |
| Contextual menu on a sidebar row | Rename, Delete, New Album, Duplicate | done | New Album, New Smart Album, New Folder, Rename, Delete, and Duplicate Album on an album [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/6) |
| Rename inline by a click on a selected row | Editable label | done | A press on the name of the selected album edits it in place: Return or leaving the field keeps it and Escape does not, and a double press does not begin it; a smart album's row Rename opens the same field, read in photos-names-journey. A slideshow's row has the same code, not driven [shot](#project-artifact/art_a7e016210b9b9bc1/529) |
| + button on My Albums | Album, Smart Album, Folder | done | [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/7). The "New Album" button in the sidebar's footer stays too |

## Toolbar and header

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Years | Views | done | [shot](#project-artifact/art_3e7ee16bed9df50f/3) |
| Months | Views | built-unchecked | Passes in photos-keys-journey; no screenshot of it |
| Days | Views | built-unchecked | Passes in photos-keys-journey; no screenshot of it |
| All Photos segments | Views | done | [shot](#project-artifact/art_3e7ee16bed9df50f/23) |
| Back | Leaves the open photo | done | [shot](#project-artifact/art_3e7ee16bed9df50f/9) |
| Previous (viewer) | Steps | built-unchecked | |
| Next segments (viewer) | Steps | built-unchecked | |
| Zoom slider | Thumbnail size | built-unchecked | Not offered with a photo open |
| + Import | Not in the real toolbar | built-unchecked | Kept as a deliberate extra |
| Info button | Info | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| Share button | Mail, Messages, AirDrop, Notes, Add to Photos, Set Desktop Picture | done | The shared rows, with the edit rather than the original; AirDrop dimmed with its reason [shot](#project-artifact/art_3e7ee16bed9df50f/51) |
| Favorite | Toggles | built-unchecked | |
| Rotate (Option-click turns the other way) | Turns | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/23) |
| Edit button | Opens the editor from a selection too | built-unchecked | Shown with a selection too [shot](#project-artifact/art_3e7ee16bed9df50f/18) |
| Search field | Results grouped with suggestions | done | See Search [shot](#project-artifact/art_a7e016210b9b9bc1/532) |
| Toolbar customising | Customize Toolbar… | done | From View and the toolbar's own menu: a click adds, Remove takes out, drag and arrow keys reorder, Use Default Set; kept on the server and after a reload, in photos-toolbar-journey. Dragging from the palette and the Delete key were not driven [shot](#project-artifact/art_a7e016210b9b9bc1/530) |
| Album header: date range | Header | done | [shot](#project-artifact/art_3e7ee16bed9df50f/2) |
| count | Header | done | [shot](#project-artifact/art_3e7ee16bed9df50f/2) |
| Showing | Header | done | [shot](#project-artifact/art_3e7ee16bed9df50f/2) |
| Album header: Rename… | Not in the real header | done | [shot](#project-artifact/art_3e7ee16bed9df50f/5) |
| Delete Album | Not in the real header | done | [shot](#project-artifact/art_3e7ee16bed9df50f/5) |
| Album header: Slideshow | Plays or makes a memory | done | [shot](#project-artifact/art_3e7ee16bed9df50f/11) |
| Show as Memory | Plays or makes a memory | done | An album's heading makes a memory of it, listed in Memories until deleted, and the album stays [shot](#project-artifact/art_a7e016210b9b9bc1/315) |
| Double-click a day | Zooms in | built-unchecked | A single click on a day's title goes on to All Photos with that day's first photo selected and the listbox focused, which brings it into view: walked in Chromium with 48 days of photos, the last day's photo inside the pane, at build `6585858d80dd`; no linked screenshot |
| month or year title | Zooms in | built-unchecked | A single click, as a day's; not run in a journey |

## Library views

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Years | Mosaic per year | built-unchecked | First 12 photos of each year; the detail line names its places, commonest first, and the count (unit-tested) [shot](#project-artifact/art_3e7ee16bed9df50f/3) |
| Months | Collections per month | built-unchecked | First 8 photos; the detail line names its places and the count (unit-tested) |
| Days | Curated days | built-unchecked | Each day leaves out near-duplicates of a picture kept before it, with the day's places and whole count in the detail line and a per-day Show All N Photos / Show Fewer Photos. The page hashes each thumbnail (64 bits of brightness differences and the mean colour) and keeps it through `POST /api/photos/hashes`; `photos-rows-batch11-journey` reads the hashes back from `GET /api/photos/library` across a reload. Favourites, movies and photos not yet hashed always stay. Limits: a picture is judged by its look alone, with no ranking of the best shot; Show All is not kept across a reload; the viewer's arrows still step through the day's left-out photos |
| All Photos | Flat grid | done | [shot](#project-artifact/art_3e7ee16bed9df50f/23) |
| Square thumbnails | View ▸ square | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Aspect thumbnails | View ▸ aspect | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Selection held across views | Keeps selection | built-unchecked | Years, Months, Days and All Photos keep it from the toolbar, the View menu and Command-1 to 4 (the key unit-tested); changing source clears it, as on a Mac |
| Scroll place kept after leaving a photo | Returns to place | built-unchecked | The pane goes back to where it was scrolled: unit-tested in Days, and walked in All Photos in Chromium, scrollTop 2261 before and after, at build `6585858d80dd`; no linked screenshot. In All Photos the photo last shown is also brought into view |
| Drag a rubber band to select | Selection rectangle | built-unchecked |  |
| Empty states | Words per source | built-unchecked | |
| Videos Photos in the grid | Duration badge, playback | built-unchecked | A WebM recorded in Chromium imports, with a poster frame and badge [shot](#project-artifact/art_3e7ee16bed9df50f/26), and plays [shot](#project-artifact/art_3e7ee16bed9df50f/28). The player reads 0:00 / 0:00 on a recording under a second, because Chromium's controls round 0.96 s down; a 2.4 s recording reads 0:02 [shot](#project-artifact/art_3e7ee16bed9df50f/50), so nothing needed fixing. A WebM of sound alone is refused by name, and so is an MP4 of sound alone. An H.264 MP4 and MOV import, keep their type, size and length, and a MOV plays, in Google Chrome [shot](#project-artifact/art_3e7ee16bed9df50f/60); not run in Firefox or WebKit. A WebM imports, shows its poster and length and plays in Firefox 157 and Playwright's WebKit 27.2 on Linux (`photos-movie-journey`); WebKit on Linux has no MediaRecorder and headless Firefox here never finished a sound recording, so Chromium recorded those files for them and they imported them. Slideshows play movies for their own length, with the show's song waiting and Space pausing them, and go on after one ends or when one cannot play (`photos-stage.test.tsx`, `photos-movie-journey`), and Export records them between the pictures, with their sound, the song silent while one runs (`photos-slideshow-journey`). The show's movies in Firefox and WebKit not run |
| Live Photos in the grid | Duration badge, playback | dimmed | A browser can't read the paired movie, so a Live Photo imports as its still; the Media Types row stays hidden |

## Selection

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Click | Standard | done | [shot](#project-artifact/art_3e7ee16bed9df50f/18) |
| Command-click | Standard | done | [shot](#project-artifact/art_3e7ee16bed9df50f/25) |
| Shift-click | Standard | built-unchecked | Passes in photos-journey; the shot shows Command-click [shot](#project-artifact/art_3e7ee16bed9df50f/25) |
| Arrow keys in the grid | Move selection | built-unchecked | From the icon view; Days, Months and Years tiles are plain buttons with no arrow handling |
| Escape deselects | Clears | built-unchecked | Passes in photos-journey; no screenshot |
| Click outside deselects | Clears | built-unchecked |  |
| Selection count in the title or header | "3 Photos Selected" | done | In the header, in place of the count [shot](#project-artifact/art_a7e016210b9b9bc1/303) |
| Contextual menu acts on the selection | Multi-photo | built-unchecked | One photo walked; several not [shot](#project-artifact/art_3e7ee16bed9df50f/14) |

## Open photo and full-screen viewer

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Open by double click | Fills the pane | done | [shot](#project-artifact/art_3e7ee16bed9df50f/9) |
| Open with Space | Toggles | done | [shot](#project-artifact/art_3e7ee16bed9df50f/9) |
| Close with Space | Toggles | done | [shot](#project-artifact/art_3e7ee16bed9df50f/9) |
| Close with Escape | Back to grid | done | [shot](#project-artifact/art_3e7ee16bed9df50f/9) |
| double click | Back to grid | built-unchecked |  |
| Stop viewing with Command-Up | Back to grid | built-unchecked | Passes in photos-depth-journey with the Command key itself, also after leaving the full-screen viewer; no screenshot |
| Left | Steps | done | [shot](#project-artifact/art_3e7ee16bed9df50f/9) |
| Right | Steps | done | [shot](#project-artifact/art_3e7ee16bed9df50f/9) |
| Zoom with Z (current level and 100%) | Zooms | done | [shot](#project-artifact/art_3e7ee16bed9df50f/9) |
| Command-plus | Zooms | built-unchecked |  |
| Command-minus | Zooms | built-unchecked |  |
| pinch | Zooms | built-unchecked | A trackpad pinch, which a browser reports as a wheel with Control: unit-tested and walked in Chromium at build `6585858d80dd`, no linked screenshot. Safari's gesture events are handled, not run. A touch screen's two fingers are not handled |
| Drag to pan when zoomed | Pans | built-unchecked |  |
| Thumbnail strip with Option-S | Filmstrip | done | [shot](#project-artifact/art_3e7ee16bed9df50f/9) |
| Full-screen viewer | Photo fills the screen, chrome hides, arrows step | done | Arrows and Escape walked [shot](#project-artifact/art_3e7ee16bed9df50f/10) |
| Unreadable original | Not in the real app | built-unchecked | Thumbnail with a note |

## Info panel and metadata

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Floating Info window that follows the selection | Stays open | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| Title | Editable | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| Description or caption | Editable | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| Keywords | Token field | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| Date | Shown, click to adjust | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| Time | Shown, click to adjust | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| Location | Map, assign, remove | built-unchecked | Small map with the pin; Control-click places the photo, typed coordinates and a name work, clearing the field removes it. A typed place name asks the geocoder Maps uses and lists what it finds to choose, unit-tested against a stand-in for the geocoder; it needs the app run with `--egress allow`, and not run in a browser [shot](#project-artifact/art_3e7ee16bed9df50f/42) |
| Camera | Lines | built-unchecked | Passes in photos-journey; no screenshot |
| lens | Lines | built-unchecked | Read from EXIF |
| ISO | Lines | built-unchecked | Read from EXIF |
| aperture | Lines | built-unchecked | Read from EXIF |
| shutter | Lines | built-unchecked | Read from EXIF |
| exposure compensation | Lines | built-unchecked | Read from EXIF |
| File name | Lines | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| dimensions | Lines | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| size | Lines | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| format | Lines | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| People (faces) | Tokens | built-unchecked | Names as tokens in Info, for one photo or several. With one photo, each face found shows as a round crop with a name field that completes from the names given, and Not a Face; a name goes on the photo's tokens, and taking the token off takes it off the face. Undo and Redo take a name back and forth. Absent: marking a face by hand, Show Face Names on the picture, and matching a face to another (see People in the sidebar). `e2e/photos-people-batch20-journey.mjs`; Chromium only |
| Favourite heart in the panel | Toggle | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| Several photos selected | Edit title, caption and keywords together | built-unchecked | Edits all of them; not walked |
| In albums | Not in the real app | built-unchecked | Kept as a deliberate extra |

## Keywords and tags

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Add keywords on photos | Info token field | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| Remove keywords on photos | Info token field | built-unchecked |  |
| Keyword Manager: list | Window | done | [shot](#project-artifact/art_3e7ee16bed9df50f/8) |
| edit list | Window | built-unchecked | Adding walked; renaming and removing not [shot](#project-artifact/art_3e7ee16bed9df50f/8) |
| quick groups | Window | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/8) |
| Keyboard shortcuts assigned to keywords | Single letter while selected | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/8) |
| Show keywords on thumbnails | View ▸ Metadata | built-unchecked |  |
| Filter by keyword | Showing ▸ Keywords | built-unchecked |  |
| Search by keyword | Search | built-unchecked | Passes in photos-depth-journey; no screenshot of a keyword search |

## Favourites, hidden, Recently Deleted

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Favourite: toolbar | Toggles | built-unchecked | |
| period | Toggles | done | [shot](#project-artifact/art_3e7ee16bed9df50f/23) |
| menus | Toggles | built-unchecked | |
| badge | Toggles | done | [shot](#project-artifact/art_3e7ee16bed9df50f/23) |
| Hide | Leaves every view but Hidden | done | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Unhide | Leaves every view but Hidden | built-unchecked | Undo of Hide walked; the menu's Unhide not |
| Hidden album shown or hidden | View row | done | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Delete moves to Recently Deleted for 30 days | Moves | done | [shot](#project-artifact/art_3e7ee16bed9df50f/21) |
| Delete in an album removes it from the album only | Delete key, while Command-Delete leaves the library | done | [shot](#project-artifact/art_3e7ee16bed9df50f/16) |
| Days left on each thumbnail | Shown | done | [shot](#project-artifact/art_3e7ee16bed9df50f/21) |
| Recover | Restores | done | [shot](#project-artifact/art_3e7ee16bed9df50f/21) |
| one or many | Restores | built-unchecked | |
| Delete Immediately | Confirms, then erases, original too | done | [shot](#project-artifact/art_3e7ee16bed9df50f/15) |
| Delete All | Confirms, then erases, original too | built-unchecked | Confirms in code; not walked |
| Library limit | Disk only | built-unchecked | Room for at least 5,000 photos in 64 shards of 160; a full shard refuses; proved by the server's tests, not filled in a browser |

## Albums, folders and smart albums

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Make | Manage | done | [shot](#project-artifact/art_3e7ee16bed9df50f/5) |
| rename | Manage | done | [shot](#project-artifact/art_3e7ee16bed9df50f/5) |
| delete an album | Manage | done | [shot](#project-artifact/art_3e7ee16bed9df50f/5) |
| Add to Album ▸ from the contextual menu | Submenu | done | A submenu with New Album first [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/3) |
| Move to another album (menu) | Not in the real app | built-unchecked | Kept, as a submenu; one write. Passes in photos-rows-journey; no screenshot |
| Remove from Album | Removes | built-unchecked | |
| Sort an album | Oldest, Newest, Title, custom | built-unchecked | Saved |
| Reorder by dragging within an album | Custom order | built-unchecked | The code is on main; not walked in this round |
| Key photo | Sets the row's icon | built-unchecked | The row shows the first photo; Make Key Photo not walked [shot](#project-artifact/art_3e7ee16bed9df50f/5) |
| Folders: make | Outline | done | [shot](#project-artifact/art_3e7ee16bed9df50f/5) |
| nest | Outline | built-unchecked |  |
| drag albums in | Outline | done | [shot](#project-artifact/art_3e7ee16bed9df50f/5) |
| Smart albums: rules (date, favourite, keyword, title, photo or video, edited, camera, album) with any or all | Rule sheet, live contents, editable | built-unchecked | The keyword rule is checked in a browser; the other fields are not [shot](#project-artifact/art_3e7ee16bed9df50f/2) |
| Duplicate an album | Row menu | done | A copy with the same photos, order and folder, named “copy” [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/6) |

## Drag and drop

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Drop files from this computer on the pane | Imports | built-unchecked | Passes in photos-journey; no screenshot |
| Drag from a Finder window to Photos | Imports | done | Four files at once [shot](#project-artifact/art_3e7ee16bed9df50f/1) |
| Drag from the desktop to Photos | Imports | built-unchecked | Same shared drag; not walked |
| Drag onto the Dock's Photos tile | Imports | done | Pictures [shot](#project-artifact/art_a7e016210b9b9bc1/125) and movies, a WebM read back with its length [shot](#project-artifact/art_a7e016210b9b9bc1/221); a double-click in Finder still opens them in their own app |
| Drop on an album row imports into that album | Imports and adds | built-unchecked |  |
| Drag photos onto an album row | Adds | done | [shot](#project-artifact/art_3e7ee16bed9df50f/24) |
| one or many | Adds | done | [shot](#project-artifact/art_3e7ee16bed9df50f/24) |
| Drag photos between albums moves them | Owner's list asks for a move; see the calls below | done | Moving walked; Option-drag to add is a separate behaviour, not walked [shot](#project-artifact/art_3e7ee16bed9df50f/5) |
| Drag photos onto a folder | Refused or opens it | built-unchecked |  |
| Drag out to Finder or the desktop | Exports a copy | built-unchecked |  |
| Drag out to Mail | Attaches | built-unchecked | Through the shared drag; not walked |
| Notes | Attaches | built-unchecked | Through the shared drag; not walked |
| Messages | Attaches | built-unchecked | Through the shared drag; not walked |

## Search and filters

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Search names | Search | built-unchecked | |
| months | Search | built-unchecked | |
| camera | Search | built-unchecked | |
| albums | Search | built-unchecked | |
| "favorite" | Search | built-unchecked | |
| "edited" | Search | built-unchecked | |
| Search titles | Search | built-unchecked |  |
| captions | Search | built-unchecked |  |
| keywords | Search | built-unchecked | Passes in photos-depth-journey; no screenshot of a keyword search |
| places | Search | done | [shot](#project-artifact/art_3e7ee16bed9df50f/7) |
| people | Search | built-unchecked | Names typed in Info are searched; no journey step yet |
| Results grouped with suggestions | Group rows | done | Under the field, by kind, each with the count its search finds; the arrow keys and Return choose one. The journey drives the Keywords kind; People, Places, Dates, Albums, Cameras and Photos run the same code, unit-tested in photos-served-data. Read in photos-names-journey [shot](#project-artifact/art_a7e016210b9b9bc1/532) |
| Command-F | Focuses | done | [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| Showing menu | Filter | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/2) |
| Search kept separate per source | Library-wide search | done | A search begun in an album looks through the library, and emptying it goes back [shot](#project-artifact/art_a7e016210b9b9bc1/103) |

## Slideshow

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Play slideshow from a selection | Full-screen slideshow with theme and music | built-unchecked |  |
| album | Full-screen slideshow with theme and music | done | Fades, moves on by itself; the shot is mid-fade [shot](#project-artifact/art_3e7ee16bed9df50f/11) |
| or day | Full-screen slideshow with theme and music | built-unchecked |  |
| Space pauses | Keys | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/11) |
| arrows step | Keys | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/11) |
| Escape stops | Keys | done | [shot](#project-artifact/art_3e7ee16bed9df50f/11) |
| Pointer shows controls with close | Controls | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/11) |
| Theme choice | Themes | built-unchecked | Fades and pans only, by the call below |
| Music choice | Themes | done | The slideshow's Music menu lists the person's Music library, and the choice is kept on the server; Play sounds it, its 440 Hz decoded from what played, in photos-slideshow-journey [shot](#project-artifact/art_a7e016210b9b9bc1/531) |
| Slideshow project saved (File ▸ Create) | Project | built-unchecked |  |
| Export a slideshow | Movie | done | Export… records the show on the drive through the browser's recorder, in real time: WebM where the browser has it, with no size options. Read back from the drive: its length, the pictures in order and the song at 440 Hz, in photos-slideshow-journey [shot](#project-artifact/art_a7e016210b9b9bc1/531) |

## Editing

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Open with Return | Opens | done | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Edit button | Opens | built-unchecked | Edit button and row, photo open only |
| Show Edit Tools | Opens | built-unchecked | The same action as Return |
| Tabs Adjust (A, F, C, or Command-1, 2, 3) | Switches | built-unchecked | Letters walked; Command-1 to 3 not [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Filters (A, F, C, or Command-1, 2, 3) | Switches | built-unchecked | Letters walked; Command-1 to 3 not [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Crop (A, F, C, or Command-1, 2, 3) | Switches | built-unchecked | Letters walked; Command-1 to 3 not [shot](#project-artifact/art_3e7ee16bed9df50f/13) |
| Done | Saves or leaves | done | Passes in both journeys [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Cancel | Saves or leaves | done | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Revert to Original | Saves or leaves | done | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Hold M: unadjusted | Compare | built-unchecked | Key pressed; the picture was not compared |
| Control-M: without crop | Compare | built-unchecked |  |
| Next in the editor | Steps | built-unchecked | The toolbar's arrows keep this edit and open the next photo to edit; Previous is the one shown |
| Previous in the editor | Steps | done | Keeps this photo's edit and opens the one before [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/9) |
| Zoom in the editor | Slider, Z | built-unchecked | A Zoom slider in the editor's toolbar goes from fitted to four times, Z goes to twice and back, a pinch zooms, and a drag pans within the picture's edges. Unit-tested for the slider; Z and the pan walked in Chromium at build `6585858d80dd`, no linked screenshot; a pinch in the editor not run [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/8) |
| Undo of edits | Command-Z | built-unchecked | Key pressed; result not asserted |
| Redo of edits | Command-Z | built-unchecked |  |
| Keys in the editor | Command-R, Command-E, Return | built-unchecked |  |
| Auto Enhance | One press | built-unchecked | Adjust pane |
| Light: Exposure | Sliders | done | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Brightness | Sliders | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Contrast | Sliders | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Highlights | Sliders | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Shadows | Sliders | built-unchecked | Brilliance and Black Point also shown [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Color: Saturation | Sliders | built-unchecked | Vibrance and Cast also shown; White Balance absent [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Warmth | Sliders | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Tint | Sliders | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Black & White | Tools | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Retouch | Tools | done | A click fills a circle from its rim, with a size slider and Reset; kept on the original, so turning afterwards keeps it in place [shot](#project-artifact/art_3e7ee16bed9df50f/52) |
| Red-eye | Tools | done | A click takes the red out of what is mainly red inside the circle; not automatic detection [shot](#project-artifact/art_3e7ee16bed9df50f/52) |
| White Balance | Tools | built-unchecked | The real pop-up of Neutral Gray, Skin Tone and Temperature/Tint. The first two have Auto, from the whole picture, and an eyedropper, from a clicked pixel; Temperature/Tint has two sliders on Warmth and Tint. It has a tick, and all of it is kept with the edit through a reload and cleared by Revert. The pop-up, sliders and tick unit-tested; strong casts stop at the sliders' ends [shot](#project-artifact/art_a7e016210b9b9bc1/453) |
| Curves | Tools | done | RGB, Red, Green and Blue each hold their own points under a Channel pop-up. Black, Gray and White eyedroppers set points from a clicked pixel, on each colour's curve under RGB or on the chosen colour alone, kept through a reload. Points are drawn straight between [shot](#project-artifact/art_a7e016210b9b9bc1/455) |
| Levels | Tools | done | Black, Midtones and White sliders for RGB, Red, Green and Blue, with the histogram of the colour shown behind them [shot](#project-artifact/art_a7e016210b9b9bc1/309) |
| Definition | Tools | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Selective Color | Tools | done | A swatch per range of hues with Hue, Saturation and Luminance, and an eyedropper that picks the swatch from a clicked pixel's hue (a gray pixel says so and keeps the swatch), kept through a reload and read back from the canvas [shot](#project-artifact/art_a7e016210b9b9bc1/456) |
| Noise Reduction | Tools | built-unchecked |  |
| Sharpen | Tools | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Vignette | Tools | built-unchecked |  |
| Each adjustment switched off with its blue tick | Toggle | built-unchecked | A tick on each slider section takes its values off and puts them back; Done keeps a section off as nothing; Retouch, Red-eye, Levels, Curves and Selective Color have one too [shot](#project-artifact/art_a7e016210b9b9bc1/309), and now White Balance and Markup, whose ticks are not yet run in a browser |
| Reset Adjustments | One button | built-unchecked | |
| Filters | Nine and Original with live previews | built-unchecked | Mono walked; the others and the previews not [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| Filter intensity | Not in 10.15 | built-unchecked | No slider, as on Catalina (from memory: check) |
| Crop by corners | Handles | done | Corners, and a handle at the middle of each edge; the real app takes the whole edge line [shot](#project-artifact/art_a7e016210b9b9bc1/105) |
| move | Handles | built-unchecked | Dragged by the area inside; no screenshot of a move |
| arrow keys | Handles | built-unchecked | Passes in photos-search-tools-journey for the right edge; no screenshot of the result |
| Aspect menu | Freeform, Original, Square, 16:9, 4:3, 3:2 and others | built-unchecked | More aspects than before; not walked [shot](#project-artifact/art_3e7ee16bed9df50f/13) |
| Straighten | Dial, plus Vertical and Horizontal | done | Angle, Vertical and Horizontal sliders, drawn on the pixels with no empty corner, kept through a reload and cleared by Revert; the angle is a slider, not a dial [shot](#project-artifact/art_a7e016210b9b9bc1/454) |
| Rotate | Rotate, Flip Horizontal | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/13) |
| Flip | Rotate, Flip Horizontal | done | [shot](#project-artifact/art_3e7ee16bed9df50f/13) |
| Auto crop | Auto, Reset | built-unchecked | Auto reads the picture's pixels for the long, nearly level edge most of them share, up to 15 degrees, and sets Straighten against it; with none it says so and changes nothing. The finding is unit-tested on drawn horizons; the button walked in Chromium on a picture tilted 4 degrees, which saved Straighten at -4, at build `6585858d80dd`, no linked screenshot. It levels and does not choose a tighter crop |
| Reset | Auto, Reset | built-unchecked | Reset only |
| Markup extension | Draws on the photo | built-unchecked | A Markup section of the Adjust pane rather than the Extensions menu: a pen with colour and thickness, Remove Last and a tick. Lines are kept with the edit on the original, up to 12 of 32 points, and turn and crop with it. A line drawn is unit-tested through to the saved edit, the server's limits by its own test, and in Chromium at build `6585858d80dd` the line showed red on the canvas and the server kept it, no linked screenshot. No shapes or text |
| Edit With another app | Hands off | built-unchecked | Edit With > Preview opens a copy, also from inside the editor [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/5), and what Preview saves comes back as the photo's edit, undone by Revert: `e2e/cross-batch7-journey.mjs` |
| Revert from the Image menu | Revert | done | [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| several photos | Revert | built-unchecked | |

## Contextual menu on photos

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Open | Opens | built-unchecked | Shown [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Favorite | Same | built-unchecked | Shown [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Rotate Left | Same | built-unchecked | Shown, with Rotate Right [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Delete | Same | built-unchecked | Shown [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Get Info | Info window | built-unchecked | Shown [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Copy | Rows | built-unchecked | Shown [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Duplicate | Rows | built-unchecked | Shown [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Hide | Rows | built-unchecked | Shown [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Add to ▸ | Album submenu with New Album | done | [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/3) |
| Remove from Album | Row | built-unchecked | |
| Make Key Photo | Row | built-unchecked | In an album's photo menu; no screenshot |
| Share ▸ | Services | built-unchecked | Shown [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Export ▸ | Export and Unmodified | built-unchecked | Shown [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Set Desktop Picture | Row | built-unchecked | Shown [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Edit With ▸ | Rows | done | Preview [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/4) |
| Revert to Original | Rows | built-unchecked | Shown [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Adjust Date | Rows | done | [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/4) |
| Adjust Location | Rows | done | Assign a Location… opens Info's place field [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/4) |

## Keyboard shortcuts (Apple's Catalina table)

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Control-1 | Sidebar rows | done | [shot](#project-artifact/art_3e7ee16bed9df50f/23) |
| Control-2 | Sidebar rows | done | Shows Memories [shot](#project-artifact/art_3e7ee16bed9df50f/43) |
| Control-3 | Sidebar rows | built-unchecked | Passes in photos-keys-journey; no screenshot of it |
| Control-4 | Sidebar rows | done | Shows People [shot](#project-artifact/art_3e7ee16bed9df50f/53) |
| Control-5 | Sidebar rows | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/7) |
| Control-6 | Sidebar rows | built-unchecked | Passes in photos-keys-journey; no screenshot of it |
| Control-7 | Sidebar rows | built-unchecked | Passes in photos-keys-journey; no screenshot of it |
| Command-1 | Library views | done | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Command-2 | Library views | done | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Command-3 | Library views | done | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Command-4 | Library views | done | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Space | Viewer | done | [shot](#project-artifact/art_3e7ee16bed9df50f/9) |
| Escape | Viewer | done | [shot](#project-artifact/art_3e7ee16bed9df50f/9) |
| Command-Up | Viewer | built-unchecked | Passes in photos-depth-journey; no screenshot |
| Option-S | Viewer | done | [shot](#project-artifact/art_3e7ee16bed9df50f/9) |
| Return | Editor | done | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| A | Editor | done | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| F | Editor | done | [shot](#project-artifact/art_3e7ee16bed9df50f/12) |
| C | Editor | done | [shot](#project-artifact/art_3e7ee16bed9df50f/13) |
| Command-1 to 3 | Editor | built-unchecked |  |
| Command-E | Editor | built-unchecked |  |
| M | Editor | built-unchecked |  |
| Control-M | Editor | built-unchecked |  |
| Z | Editor | done | [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/8) |
| Command-R | Rotate | done | Also in the editor [shot](#project-artifact/art_3e7ee16bed9df50f/14) |
| Option-Command-R | Rotate | built-unchecked | Passes on a key Chromium reports as the letter; a Mac's Option letter is covered by a unit test only |
| Period | Favourite | done | [shot](#project-artifact/art_3e7ee16bed9df50f/23) |
| Command-L | Hide | done | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Command-N | Organise | done | [shot](#project-artifact/art_3e7ee16bed9df50f/16) |
| Option-Command-N | Organise | built-unchecked | Passes on a key Chromium reports as the letter; a Mac's Option letter is covered by a unit test only |
| Shift-Command-N | Organise | done | [shot](#project-artifact/art_3e7ee16bed9df50f/5) |
| Shift-Command-K | Organise | built-unchecked |  |
| Shift-Command-T | Titles | done | [shot](#project-artifact/art_3e7ee16bed9df50f/18) |
| Command-I | Info, Keyword Manager | done | [shot](#project-artifact/art_3e7ee16bed9df50f/4) |
| Command-K | Info, Keyword Manager | done | [shot](#project-artifact/art_3e7ee16bed9df50f/8) |
| Command-D | Duplicate and clipboard | done | [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| X | Duplicate and clipboard | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| C | Duplicate and clipboard | done | [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| V | Duplicate and clipboard | done | [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| Command-Delete | Leave the library, leave the album | done | [shot](#project-artifact/art_3e7ee16bed9df50f/21) |
| Delete | Leave the library, leave the album | done | In an album, it leaves the album [shot](#project-artifact/art_3e7ee16bed9df50f/16) |
| Command-Z | Undo, Redo | done | [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| Shift-Command-Z | Undo, Redo | done | [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| Command-A | Select, deselect | done | [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| Shift-Command-A | Select, deselect | done | [shot](#project-artifact/art_3e7ee16bed9df50f/19) |
| Command-plus | Thumbnails, photo | built-unchecked | Thumbnails checked; the open photo's zoom not [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Command-minus | Thumbnails, photo | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/6) |
| Control-Command-F | Full screen, sidebar | built-unchecked | First from the desktop's row (not checked); sidebar none |
| Option-Command-S | Full screen, sidebar | done | [shot](#project-artifact/art_3e7ee16bed9df50f/22) |
| Shift-Command-I | Import, Export, Print | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/23) |
| Shift-Command-E | Import, Export, Print | done | [shot](#project-artifact/art_3e7ee16bed9df50f/17) |
| Command-P | Import, Export, Print | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/23) |

## Sharing and export

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Share to Mail | Attaches | built-unchecked | Through the shared sheet, with the rendered edit; not walked, because a guest account gets 403 from Mail's attachments |
| Messages | Attaches | built-unchecked | Through the shared sheet, with the rendered edit; not walked |
| Notes | Attaches | done | An edited picture goes into a note as its rendered copy; the copy's pixels were read and differ from the original's, which stays as it was [shot](#project-artifact/art_a7e016210b9b9bc1/338) |
| AirDrop | Nearby | dimmed | The shared Share rows dim it with the desktop's standard reason [shot](#project-artifact/art_3e7ee16bed9df50f/51) |
| Add to Photos from elsewhere (Safari, Mail) | Imports | built-unchecked | Finder and Quick Look's Share > Add to Photos imports, with Photos closed or open [shot](#project-artifact/art_3e7ee16bed9df50f/44), and `importShared` reads an item's own `bytes`, so a file not on the drive imports too. Mail's attachment menu offers it: `e2e/mail-notes-batch4-journey.mjs`. Safari's image menu offers Add Image to Photos: `photos-rows-batch11-journey` right-clicks a picture of Wikipedia's macOS Catalina article and reads the original back from the drive, byte for byte. Each picture imports as `image`, since a page's inlined picture has no file name |
| Export sheet: format | Sheet | done | [shot](#project-artifact/art_3e7ee16bed9df50f/17) |
| quality | Sheet | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/17) |
| size | Sheet | done | [shot](#project-artifact/art_3e7ee16bed9df50f/17) |
| name | Sheet | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/17) |
| metadata | Sheet | built-unchecked | [shot](#project-artifact/art_3e7ee16bed9df50f/17) |
| Export to the drive through the Save dialog | Folder choice | done | Save To > Other… opens the drive's Save dialog; each file was read back and its picture decoded [shot](#project-artifact/art_a7e016210b9b9bc1/337) |
| Export several photos | One each | done | Through the Save dialog they go into a folder of the typed name, one file each, read back and decoded [shot](#project-artifact/art_a7e016210b9b9bc1/337) |
| Download to the computer | Not in the real app | built-unchecked | Kept; a browser needs it |
| Print | Sheet | built-unchecked |  |

## Saved state

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Library | Kept | done | Shards with compare-and-set; survives a reload [shot](#project-artifact/art_3e7ee16bed9df50f/20) |
| albums | Kept | done | [shot](#project-artifact/art_3e7ee16bed9df50f/20) |
| edits | Kept | built-unchecked | Passes in photos-journey; no screenshot |
| Recently Deleted | Kept | done | [shot](#project-artifact/art_3e7ee16bed9df50f/21) |
| per person on the server | Kept | built-unchecked | Passes in photos-journey with a second account; no screenshot |
| Originals on the person's drive (Pictures) | Kept | built-unchecked | |
| Other windows and browsers update | Updates | built-unchecked | Passes in photos-journey; no screenshot |
| Sidebar source | Restored | done | Also when the row was chosen just before the reload: leaving sends the latest settings once more, outliving the page, and the server's revision refuses any older save held from before it [shot](#project-artifact/art_3e7ee16bed9df50f/20) |
| library view | Restored | done | [shot](#project-artifact/art_3e7ee16bed9df50f/20) |
| zoom | Restored | done | [shot](#project-artifact/art_3e7ee16bed9df50f/20) |
| sidebar width after a reload | Restored | built-unchecked |  |
| Open photo after a reload | Restored | done | [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/2) |
| Purge retried on next load | Not visible | built-unchecked | |

## Cross-app

| Item | Real app | Status | Now |
| --- | --- | --- | --- |
| Photo Booth pictures appear in Photos | Imported by hand on a Mac; automatic here | built-unchecked | Deliberate |
| Finder shows originals in Pictures | Shows | built-unchecked | |
| A file trashed or renamed in Finder | Library unaffected on a Mac | built-unchecked | Read in the code: a photo names its original by the file's id on the drive, so a rename changes nothing; an original that can no longer be read shows the thumbnail with "The original could not be read". Not run |
| Open With ▸ Photos from Finder | Imports | built-unchecked | Listed by the same descriptor as the Dock drop; the row itself not pressed in a journey |
| Set Desktop Picture | Applies | built-unchecked | |
| Spotlight finds photos | Results | built-unchecked | Finds titles, captions, keywords and places by the server's tests; by name in photos-journey. Choosing a result opens that photo in the viewer (unit test; not run in a browser) |
| Dock: Open | Standard | built-unchecked | Shared |
| Show All Windows | Standard | built-unchecked | Shared |
| Quit | Standard | built-unchecked | Shared |
| Mission Control | Shows the window | built-unchecked | Shared |
| Clipboard with other apps | Copy, paste a picture | built-unchecked | Read in the code: Copy and Cut also put the photos on the desktop's clipboard for its other apps, and a paste into the window imports drive items copied on the desktop or a picture on the computer's clipboard. Copy does not write to the computer's clipboard. Not run in this round |
| Storage Management counts photos | Counts | built-unchecked | README |

## Calls made (the owner asked for calls, not questions)

- **Move or add.** The owner's list says dragging moves photos between albums. On a real Mac a drag only adds. Call: a drag from an album to another album moves; Option-drag adds; a drag from any library view adds, because a library view has nothing to leave.
- **Faces.** Photos finds faces in the page with the bundled BlazeFace short-range model, from its own stored thumbnails; only the boxes reach the desktop's server. Call: People groups faces only by the names the person gives them, since a cheap comparison of faces did not hold up, and the pane says so.
- **Places.** From location assigned by EXIF or by hand, shown on the OpenStreetMap maps the Maps demo already uses.
- **Memories.** Generated from days and trips by date and place, and from the sixteen scenes the page's model can name, and labelled as such.
- **Shared Albums.** Not built between accounts: the server keeps each person apart. The Shared rows show dimmed with iCloud as their reason.
- **Live Photos, bursts, Portrait, Slo-mo, Time-lapse.** No source for them in a browser, so these Media Types rows stay empty and, as a Mac hides an empty row, never show (`not-applicable` above). Videos, Selfies, Panoramas, Screenshots and Animated are detected from file data and show when their kind exists.
- **Projects (books, cards, calendars).** They need Apple's print services, which ended. The call is rows dimmed with a reason.
- **Rows kept that the real app lacks:** Photo Booth row, Import button, Move to album, Download, Rename and Delete in the header. They already work and removing them gains nothing.

## Build items, most used first

Each item lands as small reviewed commits on main, with its rows moved to done only with a screenshot from the running desktop.

1. **Check what is built.** Walk every built-unchecked row in Chromium, with screenshots, and fix or downgrade what fails. No new features.
2. **Library storage for metadata.** The one 190,000-byte document cannot hold titles, captions and keywords for 250 photos. Move photo records to per-photo keys or shards, with a compare-and-set design that keeps the album and purge guarantees and an upgrade of existing libraries. Raise the 250-photo limit. Test on the server's in-process tests.
3. **Metadata and Info window.** Floating Info window following the selection: title, caption, keywords, date with Adjust Date and Time, full EXIF, location. Several photos at once. Search covers them.
4. **Keys and menus pass.** Every row and key in Apple's table that has a working action, every label matching, Return, Space, Command-Up, Command-Delete, Delete, Control-1 to 7, Command-1 to 4, Command-N family, Shift-Command-A, Command-F, Option-Command-S.
5. **Delete semantics and confirmations.** Delete in an album, Command-Delete, confirming before erasing; Delete Album confirms.
6. **Hidden.** Hide, Unhide, Hidden row, Show Hidden Photo Album, Command-L.
7. **Keywords.** Token field, Keyword Manager, shortcuts, thumbnails, filters.
8. **Folders and sidebar.** Outline rows, folders, inline rename, sidebar contextual menu, row reordering, key photo icons, My Albums overview pane.
9. **Smart albums.** Rule sheet, evaluation, edit.
10. **Dragging.** Album move with Option to add, reorder within an album, drop on album imports, rubber band, drag from Finder and desktop once the shared drag lands, drag out to Finder and desktop.
11. **Viewer.** Zoom, pan, filmstrip, full-screen viewer with hidden chrome.
12. **Slideshow.** Plays from selection, album or day; keys, controls, fades; saved project; Export.
13. **Export and share.** Export sheet, several photos, Save dialog to the drive, Share to Mail, Messages and Notes through the shared sheet, Print.
14. **Editor depth, first pass.** Keys, Undo and Redo, compare, next and previous, zoom, crop edges and aspects, rotate right, Vibrance, Brilliance, Black Point, section toggles.
15. **Editor depth, second pass.** Black & White, Retouch, Red-eye, White Balance, Curves, Levels, Definition, Selective Color, Noise Reduction, Sharpen, Vignette, Markup.
16. **Undo in the library and clipboard.** Undo and Redo of organising actions, Cut, Copy, Paste, Duplicate, Paste from another app.
17. **Saved view state.** Source, view, zoom, sidebar width and open photo survive a reload.
18. **Videos.** Import, duration badge, playback, Media Types, video in slideshow and export.
19. **Places.** Map, assign, copy and paste location.
20. **People and Memories.** As called above.
21. **Preferences, Help and Shared Albums.** Preferences window, Help pages, sharing between accounts.
