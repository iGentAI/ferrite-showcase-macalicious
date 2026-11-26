# Feature inventory: Voice Memos

Read from main at commit `e62c2ac9` (29 October 2026), on GitHub only. Nothing was run for this inventory, so no row can say done. Rows later corrected say what ran; "batch" names a row of `e2e/voice-memos-census-journey.mjs`, run with the browser's fake microphone in Chromium.

**Status words.** `missing`: not in main's code. `partial`: part is in main's code, and the note says what is absent. `built-unchecked`: main's code has it, but nobody has seen it running for this inventory. `not-applicable`: the real app has no such thing. A row becomes done only with a screenshot from the running desktop in a browser.

**What was read:**

- the sections of `demos/voice-memos/voice-memos.mdx` on the Ferrite desktop and the controls, `app.ts`
- `demos/voice-memos/voice-memos-app.tsx`, by searching it for menus, keys, drag and toolbar rows rather than reading it whole
- `demos/desktop/desktop-menus.tsx`
- `demos/finder/finder-open.ts`

**How reliable the "real app" column is.** Menus and shortcuts come from knowledge of Voice Memos on Catalina. Apple's page was not loaded. Check each against the Help and `reference/` when building its row.

**Other journeys.** `e2e/voice-memos-journey.mjs` and `voice-memos-census-journey.mjs` exist on main. They were not read or run here.

**Scope note.** Folders, Favourites, Enhance Recording, Skip Silence and playback speed arrived in later macOS versions (from memory). They stay out because this is the 10.15 app.

## Open items from the ledger

| Item | Status | Note |
| --- | --- | --- |
| Keeping a recording whose save fails on close | partial | Each take is written to the browser's IndexedDB before its save and removed when the drive has it. What is left shows as "Not saved" and is tried again when Voice Memos next opens. Kept per signed-in account or guest session, in that browser only: **Limit:** bytes the server never received can only be in this browser's IndexedDB, so another browser cannot see them, and clearing the browser's data loses them. A take closed while its microphone is still starting appears on the following open, not in a window already open. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/38) |
| Microphone stops on early close | built-unchecked | Ledger marks it done in `daff1840` with tests; not seen running here |

## Application menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| About Voice Memos | Panel | built-unchecked | Shared row |
| Preferences… (Command-comma) | Audio Quality, Clear Deleted, Location-based Naming | done | A panel over the window, kept for the person on the server: Lossless writes WAV, Clear Deleted's Immediately read back from the drive; After 1, 7 and 30 Days from a unit test of the rule. Location-based Naming: see Title from the location. Command-comma itself not pressed [shot](#project-artifact/art_a7e016210b9b9bc1/302) |
| Services | System | built-unchecked | With no text selected "No Services Apply", as on a Mac; text selected in the window gets the desktop's services (`ServicesItems`) |
| Hide | Standard | built-unchecked | Shared rows |
| Hide Others | Standard | built-unchecked | Shared rows |
| Show All | Standard | built-unchecked | Shared rows |
| Quit | Standard | built-unchecked | Shared rows |

## File menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| New Recording (Command-N) | Starts a take | built-unchecked | File's row and the key; the journey starts a take from the row. Command-N itself not pressed |
| Duplicate | Copies a recording | done | In File and in the row's menu, a copy on the drive [shot](#project-artifact/art_a7e016210b9b9bc1/107) |
| Share ▸ | Services | built-unchecked | File, toolbar and a row's menu; File > Share > Mail and Messages each send a recording to another account, its bytes read back the same from what that person received: `e2e/small-rows-batch12-journey.mjs`. Toolbar and row menu use the same rows, not driven. AirDrop dimmed, with its reason [shot](#project-artifact/art_a7e016210b9b9bc1/293) |
| Close (Command-W) | Closes, asks about takes | built-unchecked | Shared row; asks when a take is unsaved |

## Edit menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Undo | Trim and delete | done | Steps back through Trim and Delete before a Save, by the row and Command-Z; Revert goes back to the recording as it was. Read in voice-memos-rows-journey [shot](#project-artifact/art_a7e016210b9b9bc1/581) |
| Redo | Trim and delete | done | By the row and Shift-Command-Z; dimmed with nothing to redo [shot](#project-artifact/art_a7e016210b9b9bc1/581) |
| Cut | Text or selection | done | On the search field with the keyboard (voice-memos.edit.field); dimmed with its reason elsewhere and while trimming |
| Copy | Text or selection | done | The same. A recording is not copied: the shared rows take text alone |
| Paste | Text or selection | done | The same, through the browser's clipboard, which may refuse and says so |
| Delete | Moves to Recently Deleted | done | Edit's row, toolbar and Delete key put it in the drive's Trash, which Recently Deleted lists [shot](#project-artifact/art_a7e016210b9b9bc1/291) |
| Select All | Text in a field | done | The search field's text with the keyboard there; else every recording the list shows, also by Command-A (voice-memos.edit.select-all); while trimming, the whole recording (voice-memos.edit.trim-select-all) |
| Rename | Editable title | done | Edit's row, the row's menu and the toolbar, in a sheet [shot](#project-artifact/art_a7e016210b9b9bc1/107) |
| Trim Recording (Command-T) | Trim | done | Edit's row and the key [shot](#project-artifact/art_a7e016210b9b9bc1/108) |
| Replace | Overwrite from the playhead | done | The pill says Replace away from the end, and Done saves one file; before the playhead the samples are the same and after it the sound is new, read back after a reload. The row was only seen dimmed in the trim view, not chosen [shot](#project-artifact/art_a7e016210b9b9bc1/580) |
| Start Dictation | System | built-unchecked | The desktop's Edit footer: types what the browser's recognizer hears at the insertion point, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer |
| Emoji & Symbols | System | built-unchecked | Stale: the shared Edit footer's row opens the desktop's character viewer, also by Control-Command-Space. Not opened from Voice Memos in a browser here |

## View and Window menus

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Show Sidebar | Toggles | built-unchecked | View's row names what it will do; no journey step |
| Hide Sidebar | Toggles | built-unchecked | View's row names what it will do; no journey step |
| Enter Full Screen (Control-Command-F) | Standard | built-unchecked | Shared row |
| Minimize | Standard | built-unchecked | Shared rows |
| Zoom | Standard | built-unchecked | Shared rows |
| Bring All to Front | Standard | built-unchecked | Shared rows |
| window list | Standard | built-unchecked | Shared rows |
| Voice Memos Help | Help Viewer | built-unchecked | Stale: where the desktop has Help Viewer the shared row asks it for "Voice Memos", which its data lists. Not opened in a browser here |

## Recording

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Round red button | Starts | built-unchecked | |
| microphone permission | Starts | built-unchecked | |
| Live waveform | Draws levels | built-unchecked | `AnalyserNode` |
| timer | Draws levels | built-unchecked | `AnalyserNode` |
| Pause | Pill | built-unchecked | |
| Resume | Pill | built-unchecked | |
| Done ends and saves | Saves | built-unchecked | Ogg, WebM, MP4, or WAV through Web Audio |
| Time limit | Disk only | built-unchecked | A take stops by itself at an hour and says so (unit test; `mail-notes-batch7-journey`, the clock moved on in Chromium: the window still drew at 60 frames a second at 59 minutes, and the take stopped at the hour and was saved). An hour held on the upload route: a real Chromium take through its fake microphone weighed 15,718 bytes a second (56.6 MB an hour), `MediaRecorder` is now asked for 128 kbit/s in every browser (57.6 MB an hour against the drive's 64 MiB a file), and 57,600,000 bytes went up in 293 pieces in 47 s and 72 s and read back at that size on the server. A one-hour Opus file (53.5 MB, made with ffmpeg, once by hand) uploaded in 64 s and decoded in Chromium in 9 s. No real hour of recording was made. A WAV take stops where a file of the drive is full, 11 minutes at 48 kHz (unit test). Replace and Resume write WAV, so they are dimmed with the reason on a recording over 12 minutes, and a trim keeping more than 12 minutes says so instead of saving. Other browsers' weight and decoding of an hour were not measured |
| Title from the location or a number | "New Recording 7" | built-unchecked | Numbered as on a Mac: New Recording, New Recording 2, skipping those listed and in Recently Deleted; a number taken meanwhile elsewhere moves to the next (unit test; batch.title read the name from the drive). Location-based Naming, kept by the server, asks the browser where the person is and Maps' reverse geocoder for the name: the place, then the place 2; without an answer it numbers and the panel says why. `preview-books-batch4-journey` read the name from the drive, with Chromium's set location and that one reply stood in for: OpenStreetMap was not asked |
| Refused microphone | Message | built-unchecked | Banner |
| Saves a take if the window closes | Saves | built-unchecked | Saved once |
| Space starts or stops | Key | built-unchecked | Plays and stops a recording, measured in voice-memos-menus-journey; pauses a take, not measured; no screenshot |

## Playback

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Play | Transport | built-unchecked | `<audio>` |
| Pause | Transport | built-unchecked | `<audio>` |
| Skip back 15 seconds | Transport | built-unchecked | |
| Skip forward 15 seconds | Transport | built-unchecked | |
| Waveform drag | Seek | built-unchecked | |
| overview handle | Seek | built-unchecked | |
| Timer | Follow | built-unchecked | |
| ruler | Follow | built-unchecked | |
| Space | Keys | done | Plays and stops, read in voice-memos-menus-journey; pauses a take, not read [shot](#project-artifact/art_a7e016210b9b9bc1/605) |
| arrow keys | Keys | done | Left and right move the playhead a second; not while a take runs or the keyboard is in a field, button or slider. Read in voice-memos-menus-journey. The step is this app's choice, not checked against Apple's [shot](#project-artifact/art_a7e016210b9b9bc1/605) |
| Waveform zoom | Pinch | built-unchecked | A pinch (a wheel with Control; Safari's gesture events) scales the waveform from 20 to 308 points a second. batch.zoom: scale 77 to 140 with the page's own zoom unchanged, in Chromium with Control and the wheel; a real trackpad and Safari's gesture not run |
| Now Playing keys | Media keys | built-unchecked | Media Session from the first play until the window closes; play, pause, stop and the seeks by unit test against a stand-in session; batch.now-playing read the title, artist and state in Chromium. A physical key not pressed. Music registers its handlers only when its player attaches, so Voice Memos' take over and Music's keys stay dead after Voice Memos closes, until Music's window opens again; the fix is one line in `music-player.ts` |

## Sidebar

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| List: title | Rows | built-unchecked | |
| date | Rows | built-unchecked | |
| length | Rows | built-unchecked | |
| newest first | Rows | built-unchecked | |
| Search | Filters | built-unchecked | |
| Rename with a double click | Inline on a Mac | built-unchecked | The title becomes a field in the row, Return or leaving it renames, Escape does not (unit test); batch.inline-rename: no sheet, focused, kept on the drive. Toolbar and menus keep their sheet, since a menu can ask with the list hidden |
| Return | Inline on a Mac | built-unchecked | The same field (unit test) |
| Delete with the Delete key | Moves to Recently Deleted | built-unchecked | The same as Edit's row; the key was not pressed in the journey |
| Recently Deleted row | Sidebar folder | done | A row under the list; the deleted recordings, last deleted first, still play. Its look is a call: no capture shows it [shot](#project-artifact/art_a7e016210b9b9bc1/291) |
| Recover | Sidebar folder | done | Toolbar and the row's menu; read back from the drive, out of the Trash |
| Delete | Sidebar folder | done | Asks, then removes it for good, read back from the drive [shot](#project-artifact/art_a7e016210b9b9bc1/292) |
| Contextual menu on a row | Share, Duplicate, Rename, Delete | done | Rename, Duplicate, Share, Show in Finder, Delete; Share in it not chosen in a journey [shot](#project-artifact/art_a7e016210b9b9bc1/107) |
| "Not saved" row with Retry and Discard | Web-only extra | built-unchecked | |
| Multi-selection | Shift and Command | done | Command-click adds a row and Shift-click takes those between; Rename dims for two; Duplicate, Delete and Recover act on both, read on the drive. Share with two was not driven [shot](#project-artifact/art_a7e016210b9b9bc1/579) |
| Toolbar: Edit | Toolbar | built-unchecked | |
| Rename | Toolbar | built-unchecked | |
| Delete | Toolbar | built-unchecked | |
| Retry | Toolbar | built-unchecked | |
| Discard | Toolbar | built-unchecked | |

## Editing

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Trim with yellow handles on the overview | Handles | done | Two yellow handles over the overview's strip, dragged; the stretch between is edged and the rest dimmed, read from the pixels. Trim keeps it in the window before any save [shot](#project-artifact/art_a7e016210b9b9bc1/577) |
| Trim Save writes a new file and trashes the old | Keeps name | done | A WAV of that length, its sound the stretch between the handles sample by sample after a reload; the old file in the Trash [shot](#project-artifact/art_a7e016210b9b9bc1/577) |
| Delete part (keep the outside of the selection) | Delete | done | Keeps what stands either side, sample by sample after a Save and a reload [shot](#project-artifact/art_a7e016210b9b9bc1/578) |
| Replace | Overwrite | done | As Edit's Replace [shot](#project-artifact/art_a7e016210b9b9bc1/580) |
| Add to the end by pressing Resume | Appends | done | At the end the pill says Resume; a two-second take adds about two seconds to the saved file, the sound before it the same sample by sample, one file of that title on the drive [shot](#project-artifact/art_a7e016210b9b9bc1/582) |
| Cancel | Reverts | built-unchecked | |

## Drag and drop

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Drag a recording to Finder or the desktop | Copies | built-unchecked | A row, or the chosen rows, drag through the desktop's drag. batch.drag-desktop: a second file of that name on the drive after a drop on the desktop. Finder takes the same drag; not dropped on a Finder window here. After a drag of several rows the selection narrows to the pressed row |
| Drag to Mail | Attaches | built-unchecked | Stale: a compose window takes any drive file (`mail-compose.tsx`); Mail's main window is no target. The drag's items by unit test; this drop not run |
| Messages | Attaches | built-unchecked | Stale: Messages' window takes any drive file (`messages.tsx`). This drop not run |
| Notes | Attaches | built-unchecked | Stale: Notes takes sound now (`takesFile` in `notes.tsx`: any file up to 10 MB). A row dragged onto Notes' window is attached, read back from `/api/notes/data` (music-quicktime-batch3-journey) |
| Drop an audio file in | Not in the real app | not-applicable | Call: left out, since the real app has no such thing |

## Saved state

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Recordings on the drive | Kept | built-unchecked | |
| Music/Voice Memos | Kept | built-unchecked | |
| Per person | Kept | built-unchecked | |
| Lengths | Stored on a Mac | built-unchecked | In this browser's IndexedDB by file, per person; forgotten once the file has left the drive. batch.decoded read the record and the length after a reload; that a kept file is not read again is a unit test. Another browser decodes for itself |
| Peaks | Stored on a Mac | built-unchecked | The same record: batch.decoded read 153 peaks |
| Selected recording | Remembered | built-unchecked | `voice-memos.place` in the person's desktop settings; batch.place across a reload; falls back to the newest when it left (unit test) |
| position | Remembered | built-unchecked | The same; batch.place: 00:01.25 before and after a reload |
| sidebar shown across a reload | Remembered | built-unchecked | The same; batch.place: list hidden after a reload. A reload within about a second of a change can miss it, while the settings session has not sent it |
| Preferences | Saved | done | On the server, read back and after a reload [shot](#project-artifact/art_a7e016210b9b9bc1/302) |

## Cross-app

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Rename or Trash in Finder changes the list | Same | built-unchecked | |
| Open from Finder | Quick Look on a Mac | built-unchecked | `appForFile` leaves it to Quick Look |
| Share to Mail | Attaches | built-unchecked | `FileShareItems` hands the files to Mail: a real recording sent to another account, the attachment's bytes read back: `e2e/small-rows-batch12-journey.mjs`. A guest gets 403 from `/api/mail/attachments` |
| Messages | Attaches | built-unchecked | Stale: the same; handed over in a journey, what Messages does with it not run |
| Notes | Attaches | built-unchecked | Stale: Notes takes sound now. File > Share > Notes puts the recording in a note, read back from `/api/notes/data`, and the note shows a player for it (music-quicktime-batch3-journey) |
| Open in QuickTime Player | Open With | built-unchecked | Stale: QuickTime Player opens sound (`opensInQuickTime`), so Finder's Open With lists it for a recording. Not run with a recording |
| Spotlight finds recordings | Results | built-unchecked | By file name: Spotlight lists a recording under Files (music-quicktime-batch3-journey) |

## Calls made

- **Recently Deleted** keeps files in the drive's Trash, as now, and lists them inside the app with Recover and Delete, so one Trash still exists.
- **Keep what fails on close.** Takes are written to a holding place in IndexedDB until the drive answers, and shown as "Not saved" when Voice Memos opens again. Web-only behaviour for the ledger's item.
- **Preferences.** Audio Quality maps to Opus versus WAV; Location-based Naming needs the Geolocation permission, asked when it is turned on; Clear Deleted controls when the app empties its own files from the Trash.
- **Time limit.** Ten minutes stays until uploads have been tried on longer takes.

## Build items, most used first

Each item lands as small reviewed commits on main, with its rows moved to done only with a screenshot from the running desktop (the browser's fake microphone stands in for hardware, and the report must say so).

1. **Check what is built.** Walk every built-unchecked row in Chromium with the fake microphone, with screenshots, and fix or downgrade what fails.
2. **Keep a recording whose save fails on close.** The ledger's item: reproduce, fix with the holding place, show "Not saved" on the next open.
3. **Menus and keys.** New Recording, Rename, Trim, Delete, Duplicate, Show Sidebar, Space and arrows.
4. **Recently Deleted.** Sidebar row, Recover, Delete, Clear Deleted preference.
5. **Trim handles and Delete part.** Yellow handles on the overview, Delete part, Undo.
6. **Resume and Replace.** Add to a saved recording, Replace from the playhead, merging on save.
7. **Contextual menu and multi-selection.** Share, Duplicate, Rename, Delete on rows, several rows together.
8. **Share and drag out.** Shared sheet, drag to Finder and the desktop, Open in QuickTime Player.
9. **Preferences and saved state.** Preferences window, selection and place across a reload, peaks stored beside each file, Media Session, Help pages.
