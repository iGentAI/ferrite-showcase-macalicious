# Feature inventory: QuickTime Player

First read from main at commit `e62c2ac9` (29 October 2026), on GitHub only, with nothing run. A row marked done has since been run on the desktop, and says how; the other rows are as that reading left them or as their notes say.

**Status words.** `missing`: not in main's code. `partial`: part is in main's code, and the note says what is absent. `built-unchecked`: main's code has it, but nobody has seen it running for this inventory. A row becomes done only with a screenshot from the running desktop in a browser.

**What was read:**

- `demos/quicktime-player/quicktime-player-app.tsx` (the desktop's window)
- the first 36,000 of 40,130 bytes of `quicktime-player.tsx`
- the first third of `quicktime-player.mdx`, `app.ts`
- `demos/desktop/desktop-menus.tsx`
- `demos/finder/finder-open.ts`

**How reliable the "real app" column is.** Menus and shortcuts come from knowledge of QuickTime Player 10.5 on Catalina. Apple's page was not loaded. Check each against the Help and `reference/` when building its row.

**Ledger.** The "Macalicious open work ledger" (version 3) has no open item for QuickTime Player.

**Other journeys.** `e2e/quicktime-controls-journey.mjs` and `quicktime-open-history-journey.mjs` exist on main; they were not read or run here. `e2e/quicktime-player-census-journey.mjs` ran whole in Chromium (build swp66): 84 rows, 0 failed, 0 page problems, 4 of them reported unavailable with their reasons (Preferences, Services, Bring All to Front, AirPlay with no screen found); its restart phases, Firefox and WebKit were not run. An earlier run under heavier load (build swp59) logged one `net::ERR_FILE_NOT_FOUND` with no address; it did not come back in this run, so its source is unknown.

## Application menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| About QuickTime Player | Panel | built-unchecked | Shared row |
| Preferences… | The real app has none | built-unchecked | Row dimmed with "has no preferences" |
| Services | System | built-unchecked | With no text selected "No Services Apply", as on a Mac; text selected in the window gets the desktop's services (`ServicesItems`) |
| Hide | Standard | built-unchecked | Shared rows |
| Hide Others | Standard | built-unchecked | Shared rows |
| Show All | Standard | built-unchecked | Shared rows |
| Quit | Standard | built-unchecked | Shared rows |

## File menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| New Movie Recording (Option-Command-N) | Camera window | done | Opens the camera's window from the menu row; the key is run for audio only [shot](#project-artifact/art_a7e016210b9b9bc1/136) |
| New Audio Recording (Control-Option-Command-N) | Microphone window | done | From the key in the journey [shot](#project-artifact/art_a7e016210b9b9bc1/139) |
| New Screen Recording (Control-Command-N) | Screen capture | built-unchecked | The menu row and Record, then the browser's own picker; a take with a picture measured with Chromium's fake picker; no screenshot. The key was not pressed |
| Open File… (Command-O) | Open dialog | built-unchecked | Returns to the Open window, replacing the movie |
| Open Location… (Command-L) | Plays a URL | done | Plays what an http or https address gives, read by the browser; the address here was the drive's own, and a site that refuses other sites is not fetched another way. It cannot be edited, since the page holds no bytes of it [shot](#project-artifact/art_a7e016210b9b9bc1/275) |
| Open Recent ▸ | Recent movies | done | Lists and opens where left; Clear Menu empties it, also after a reload [shot](#project-artifact/art_a1a6fbbb7c9b8f7f/10) |
| Close (Command-W) | Closes | built-unchecked | Shared row |
| Duplicate (Shift-Command-S) | Document commands | built-unchecked | A copy in Movies, read back from the drive; no screenshot of it |
| Rename… | Document commands | done | A dialog; read back from the drive, keeping the extension. For a movie with no changes [shot](#project-artifact/art_a7e016210b9b9bc1/307) |
| Move To… | Document commands | done | A dialog lists the drive's folders; the file's new folder is read back from the drive, in quicktime-clip-edit-journey. For a movie with no changes; a folder holding that name refuses it, saying so [shot](#project-artifact/art_a7e016210b9b9bc1/416) |
| Revert To ▸ | Versions | built-unchecked | Last Saved goes back to the file as opened or last saved, with its clips, and Undo takes that back (quicktime-clips-kept-journey). Previous Save and Browse All Versions… use the versions the drive keeps of a file saved in place: a sheet by date, the chosen version playing beside the movie, with Restore and Done; a sheet, not the Time Machine star field. Both are dimmed with their reasons over unsaved changes or without a file. A version is bytes only: a restored movie comes back as one clip, its splits cleared. versions-rest-batch10-journey, read back from the drive across a reload; quicktime-player-versions.test.tsx |
| Export As ▸ 4K | Encodes | built-unchecked | By the browser's encoders where it has them, otherwise by replay in real time in its recording format (see Export); a size is dimmed when the movie is not that tall. Run on a 1216 by 2160 movie, before the encoders: the file read back is 2160 high (music-quicktime-batch3-journey) [shot](#project-artifact/art_a7e016210b9b9bc1/278) |
| 1080p | Encodes | built-unchecked | Run on a 720 by 1280 movie: the file read back is 608 by 1080 (quicktime-edit-journey). In the browser's recording format, not H.264 |
| 720p | Encodes | built-unchecked | Run on a 1216 by 2160 movie: the file read back is 406 by 720 (music-quicktime-batch3-journey). In the browser's recording format, not H.264 |
| 480p | Encodes | built-unchecked | Run on the same movie: the file read back is 270 by 480 (music-quicktime-batch3-journey). In the browser's recording format, not H.264 |
| Audio Only | Encodes | done | A sound file in Movies, read back from the drive [shot](#project-artifact/art_a7e016210b9b9bc1/278) |
| Share ▸ | Services | done | File's row and the controller's button give the file's rows; Add to Photos ran and is read back from the library. A movie with changes has no file to hand over until it is saved [shot](#project-artifact/art_a7e016210b9b9bc1/306) |
| Save (Command-S) | Saves an edited or recorded movie | built-unchecked | Writes into the movie's file, whose earlier bytes the drive keeps as a version; closing with changes asks first. The file must be named for the format edits are recorded in (WebM here, MP4 in Safari): an `.mov` or `.mp4` in Chromium stays as it is and the edits go in “name edited.webm”, and the window says so, since those bytes under that name would be a lie. A file saved over elsewhere refuses, and the window stays edited. versions-rest-batch10-journey, quicktime-player-versions.test.tsx |
| Save As… | Saves an edited movie as a new file | built-unchecked | Asks for a name, writes a new file in Movies, and leaves the first alone. No key equivalent. versions-rest-batch10-journey |

## Edit menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Undo | Edit history | done | Five edits back; each is a whole replayed movie held in the page [shot](#project-artifact/art_a7e016210b9b9bc1/277) |
| Redo | Edit history | done | [shot](#project-artifact/art_a7e016210b9b9bc1/277) |
| Cut | Clips | done | Takes the clip chosen in the strip out, from the row and the key, read from the movie's own pixels. A replay, in real time. Dimmed with its reason with no clip chosen, or for a movie's only clip [shot](#project-artifact/art_a7e016210b9b9bc1/419) |
| Copy | Clips | done | From the key; the row is the same code, not chosen in the journey. The clip stays in the page: a browser takes no movie onto the system's clipboard, so it pastes only in this page, and a reload loses it [shot](#project-artifact/art_a7e016210b9b9bc1/417) |
| Paste | Clips | done | After the chosen clip, or the one under the playhead, from the row and the key, read from the movie's own pixels; Play All Movies and an export read back from the drive have the order the edits left [shot](#project-artifact/art_a7e016210b9b9bc1/419) |
| Delete | Clips | done | From the row and the Delete key; Undo gives the clip back, read from the movie's own pixels [shot](#project-artifact/art_a7e016210b9b9bc1/421) |
| Select All (Command-A) | Clips | done | Chooses every clip and opens the strip; Copy then takes the whole movie, Paste puts it after the last clip, and Cut and Delete stay dimmed since a movie keeps one clip (quicktime-player.edit.select-all). In the Open panel the rows act on the search field (quicktime-player.edit.panel-field) |
| Trim (Command-T) | Yellow trim handles | done | Two handles, by drag or arrow keys (the journey used the keys); Return trims and Escape cancels [shot](#project-artifact/art_a7e016210b9b9bc1/279) |
| Split Clip (Command-Y) | Splits | done | At the playhead, from the row and the key, with Undo and Redo; the strip opens with the clips it leaves. A split marks the movie edited, rotate and flip keep the splits, and Trim keeps those inside it (Trim by unit test only). Save keeps them with the saved movie, once stored and not before, and opening it after a reload brings them back, read in quicktime-clips-kept-journey. A failed store is said, and the movie stays edited (unit test only) [shot](#project-artifact/art_a7e016210b9b9bc1/514) |
| Add Clip to End… | Adds | done | A dialog lists Movies, with From This Computer… beside it (that route not run); the clip plays after the rest, read from the movie's own pixels. A clip of another shape shows whole on black at the movie's size, read the same way. A replay, in real time [shot](#project-artifact/art_a7e016210b9b9bc1/423) |
| Insert Clip After Selection… | Adds | built-unchecked | After the last clip chosen, from a dialog of Movies; a replay. Dimmed with its reason with no clip chosen. quicktime-player.rows.clips ran it in Chromium and counted four clips; no published screenshot |
| Rotate Left (Shift-Command-L) | Turns | done | Read from the movie's own pixels; the journey chose the row, and the key was not pressed [shot](#project-artifact/art_a7e016210b9b9bc1/280) |
| Rotate Right (Shift-Command-R) | Turns | done | The left edge goes to the top, read from the movie's own pixels; the key was not pressed [shot](#project-artifact/art_a7e016210b9b9bc1/280) |
| Flip Horizontal (Option-Command-H) | Mirrors | done | Sides swap in the movie's own pixels; the key was not pressed [shot](#project-artifact/art_a7e016210b9b9bc1/274) |
| Flip Vertical (Option-Command-V) | Mirrors | built-unchecked | Top and bottom swap in the movie's own pixels, read by the journey; no screenshot |
| Remove Audio | Strips | built-unchecked | Sound decoded before, none after, read by the journey; no screenshot |
| Remove Video | Strips | built-unchecked | Row present, the same replay as Audio Only; not chosen in a journey |

## View menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Actual Size (Command-1) | Window size | done | The window takes the movie's own size, no narrower than the controller and no larger than the page [shot](#project-artifact/art_3e7ee16bed9df50f/61) |
| Fit to Screen (Command-3) | Scaling | done | In a window, the largest window of the movie's shape, measured in quicktime-view-journey. In full screen, the whole picture with black beside it, read from the page's pixels in quicktime-clips-view-journey [shot](#project-artifact/art_a7e016210b9b9bc1/356) |
| Fill Screen (Command-4) | Scaling | done | In full screen the picture covers the screen and the rest is cropped, read from the page's pixels, from the row and the key. Dimmed in a window, which has the movie's own shape, saying so [shot](#project-artifact/art_a7e016210b9b9bc1/357) |
| Panoramic (Command-5) | Scaling | done | In full screen the picture is drawn to the screen's edges, its centre in true shape and its ends stretched, bar widths read from the page's pixels, from the key. Dimmed in a window, saying so [shot](#project-artifact/art_a7e016210b9b9bc1/358) |
| Increase Size (Command-plus) | Window size | built-unchecked | Measured in quicktime-view-journey from the menu and from its key, Shift included; no screenshot |
| Decrease Size (Command-minus) | Window size | built-unchecked | Measured in quicktime-view-journey from the menu and from its key; no screenshot |
| Enter Full Screen (Control-Command-F) | Full screen | built-unchecked | Browser full screen; double click too |
| Show Clips (Command-E) | Clip strip | done | The row and the key show and hide the strip, with Done: each clip as wide as it is long, with its own still and the playhead; choosing a clip moves the playhead just inside it. It can be split, reordered and have clips cut, deleted and added; one clip is chosen at a time [shot](#project-artifact/art_a7e016210b9b9bc1/359) |
| Loop (Option-Command-L) | Repeats | built-unchecked | The journey presses the key, sees the row checked and a movie start again at its end; no screenshot |
| Show Subtitles | Text tracks | built-unchecked | `quicktime-player-tracks.ts` reads the file in the page: tx3g and wvtt samples of an MP4's `moov`, and S_TEXT/UTF8, S_TEXT/WEBVTT and D_WEBVTT/SUBTITLES blocks of a WebM, and gives them to the `<video>` as cues. The row reads Hide Subtitles while one shows; with none it is dimmed, saying so. `rows-batch25-journey`, on files ffmpeg muxed: German mov_text and English WebVTT read back from `activeCues` at their times. Limits: a fragmented MP4's `moof` samples and CEA-608 captions are not read; an edit list does not shift cues; a WebM's Tracks past its first 16 MiB are not found; an edited movie has none; Panoramic draws the picture on a canvas and shows no cues; tx3g styling is dropped. wvtt and S_TEXT/UTF8 are unit-tested on hand-built files, not run in a browser; Chromium only |
| Languages | Text tracks | built-unchecked | A submenu: Subtitles (Off and each text track, by its name or language) and, with two or more, Audio from `video.audioTracks`. The journey chose French subtitles and, in Chromium with `--enable-blink-features=AudioVideoTracks`, the second audio track, read back from `enabled`. Limit: browsers without `audioTracks` (Chromium and Firefox by default) offer only the subtitles, and a file with neither dims the row, saying so |
| Play All Movies | Plays open movies | built-unchecked | Plays the movie of every QuickTime Player window: two windows both playing, read from their elements in quicktime-player.rows.several-movies; no published screenshot |

## Window and Help menus

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Minimize | Standard | built-unchecked | Shared rows |
| Zoom | Standard | built-unchecked | Shared rows |
| Bring All to Front | Standard | built-unchecked | Shared rows |
| window list | Standard | built-unchecked | Shared rows |
| Float on Top | Stays above | done | In the View menu, as on a Mac, and the picture's menu: the window stays over Finder in front, read from what the page hits at a point both cover; under the menu bar's menus and the Dock. It is the window manager's floating layer, so while the floating window is key the ordinary window in front of the rest keeps its main look. Mission Control lays it out beside the other windows and gives it back floating, whether a window is chosen or Escape pressed; its own full screen covers the menu bar and the Dock, and gives it back floating at its frame; a full-screen Finder is a Space it is not on, and it comes back with the first Space, read in quicktime-float-journey. Not kept across a reload [shot](#project-artifact/art_a7e016210b9b9bc1/521) |
| Show Movie Inspector (Command-I) | Source, format, frame rate, data rate, size | built-unchecked | Source, Format, FPS, Data Size, Data Rate, Length, Size and Current Size. Format is the file's container: a browser does not name the codecs. FPS is measured from the frames while the movie plays (30.3 for a 30 fps movie in quicktime-player.rows.inspector), and Data Rate is the file's bytes over its length. Unit test and Chromium; no published screenshot. In a window as small as 480 by 270 the panel lies over the controller |
| Show Export Progress | Progress window | built-unchecked | The row shows and hides a panel listing each export with its progress and a Stop, then Stopped, Finished or Failed. Stopped and Finished read in quicktime-player.rows.export-progress, with the file read back from the drive; no published screenshot. A panel of the movie's window, not a window of its own; an export ends with its window, so the row is dimmed in the Open window |
| QuickTime Player Help | Help Viewer | built-unchecked | The desktop's row opens Help Viewer on a search for QuickTime Player (`desktop-menus.tsx`) |

## Open window

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Recents | Full Finder sidebar | built-unchecked | Recents with Desktop, Documents, Downloads, Movies, Music and Pictures; other folders are reached by going into them from the list, with Back and Forward. quicktime-player.rows.sidebar-folders; no published screenshot. iCloud, shared and device places are not on this drive |
| Movies in the sidebar | Full Finder sidebar | built-unchecked | As Recents: the list is named after the folder chosen |
| Location pop-up | History | built-unchecked | |
| Back | History | built-unchecked | |
| Forward | History | built-unchecked | |
| Search | Filters | built-unchecked | |
| List of movies | List, column and icon views | built-unchecked | List with Name, Date Modified and Size columns, icons, columns and a gallery from the View pop-up. As Columns goes into folders along a row of columns and previews the movie chosen, with its own picture, size and date; as Gallery shows the chosen movie's picture and facts over a strip. A preview reads the file without marking it opened; a movie over 256 MB shows its icon. quicktime-player.rows.list-columns; music-quicktime-batch3-journey read the preview's picture; going into a folder is a unit test |
| From This Computer… | Web-only extra | built-unchecked | Uploads to Movies, then opens |
| Open | Standard | built-unchecked | |
| Cancel | Standard | built-unchecked | |
| Escape | Standard | built-unchecked | |
| double click | Standard | built-unchecked | |
| Progress | Words | built-unchecked | |
| Refusals | Words | built-unchecked | |
| Several movies chosen | Opens one window each | built-unchecked | Command- and Shift-click choose; Open or a double click opens the first here and each other in a window of its own, read in quicktime-player.rows.several-movies; no published screenshot. Several files dropped or sent by Finder go the same way |

## Movie window and controller

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Plays a real file from the drive | Plays | built-unchecked | Read whole into a blob |
| Play | Plays | built-unchecked | |
| Pause | Plays | built-unchecked | |
| Rewind | Scans | built-unchecked | Rewind by moving back |
| Fast Forward at 2, 5, 10, 30, 60x | Scans | built-unchecked | Rewind by moving back |
| Timeline scrub | Scrubs | built-unchecked | |
| time codes | Scrubs | built-unchecked | |
| Volume | Audio | built-unchecked | |
| Mute | Audio | built-unchecked | |
| Full Volume | Audio | built-unchecked | |
| Title bar | Title | built-unchecked | A click on the title opens Rename…, Move To…, Duplicate and Browse All Versions…, which is dimmed with its reason over unsaved changes; a press on it still moves the window. A menu, not the Mac's popover. quicktime-player.rows.title-menu; no published screenshot |
| proxy icon | Title | built-unchecked | Drags the file: dropped on the desktop it moved to the Desktop folder, read from the drive, and the window stayed, in quicktime-player.rows.proxy-drag. A movie with changes has no file, and a press there moves the window; no published screenshot |
| Controller auto-hide on idle | Hides | built-unchecked | |
| on leaving | Hides | built-unchecked | |
| Drag the controller to move it | Floats | built-unchecked | A drag on its background moves it, held inside the window, measured in quicktime-player.rows.controller; not kept when another movie opens; no published screenshot |
| Picture in Picture | System window | built-unchecked | Browser's where available, else in-window copy |
| AirPlay | Device list | built-unchecked | Browser's picker; dims if there is no screen |
| Share button | Mail, Messages, AirDrop, Notes | built-unchecked | The same rows as File's; the button not pressed in a journey |
| Movie that cannot be decoded | Error | built-unchecked | |
| Window resizes with the movie's shape | Fits the movie | done | The window takes the movie's shape when it loads [shot](#project-artifact/art_3e7ee16bed9df50f/61), and sound a small window [shot](#project-artifact/art_3e7ee16bed9df50f/62) |
| Contextual menu on the picture | Rows | done | Play or Pause, Loop, Float on Top, the four size rows, Show Clips and Show Movie Inspector. Play, Pause, Increase Size, Float on Top and Show Movie Inspector were chosen in the journey; the others run the View menu's code. The rows come from knowledge of the app, not checked against Apple's [shot](#project-artifact/art_a7e016210b9b9bc1/418) |

## Keyboard

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Space | Play and pause | built-unchecked | |
| K | Pause | done | [Screenshot](#project-artifact/art_3e7ee16bed9df50f/37) |
| J | Reverse and forward speeds | done | 2x, then 5x, 10x, 30x, 60x, backwards. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/37) |
| L | Reverse and forward speeds | done | 2x, then up, forwards. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/37) |
| Left | Frame step | built-unchecked | With the focus on the window or a controller's button; quicktime-player.rows.controller presses Right twice and Left twice in Chromium and reads the time code hold 00:00:00:01, then 00:00:00:02, then come back. A slider or a field keeps the key; no published screenshot |
| Right | Frame step | built-unchecked | As Left |
| Option-Left | Start and end | done | With the window focused. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/37) |
| Option-Right | Start and end | done | With the window focused. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/37) |
| Up | Volume | done | Ten points, with the window focused. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/37) |
| Down | Volume | done | Ten points, with the window focused. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/37) |
| Option-Up | Full, mute | done | [Screenshot](#project-artifact/art_3e7ee16bed9df50f/37) |
| Option-Down | Full, mute | done | [Screenshot](#project-artifact/art_3e7ee16bed9df50f/37) |
| Command-O | Open | built-unchecked | |
| Trim keys | Marks | done | I and O below, while trimming [shot](#project-artifact/art_a7e016210b9b9bc1/610) |
| I | Marks | done | Sets the trim's start at the playhead, read in quicktime-clips-kept-journey [shot](#project-artifact/art_a7e016210b9b9bc1/610) |
| O | Marks | done | Sets the trim's end at the playhead, read in quicktime-clips-kept-journey [shot](#project-artifact/art_a7e016210b9b9bc1/610) |

## Recording

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Movie: camera preview | Records | done | The camera's picture in a 640 by 420 window; Chromium's fake camera [shot](#project-artifact/art_a7e016210b9b9bc1/136) |
| record | Records | done | The red button or Space; the time counts. A byte count is not shown: no timeslice, so the size is known only at the end [shot](#project-artifact/art_a7e016210b9b9bc1/136) |
| stop | Records | done | Saves to Movies and opens the movie with its real length [shot](#project-artifact/art_a7e016210b9b9bc1/138) |
| quality | Records | built-unchecked | High and Maximum ask the recorder for 2.5 and 8 Mbit/s. Measured on a camera of noise for four seconds, three runs of each: High 4.87 to 5.12 MB, Maximum 5.47 to 5.56 MB, 8% to 14% more (music-quicktime-batch3-journey). Chromium's encoder does not hold High to the rate asked: on the fake camera's easy picture the two come out the same size [shot](#project-artifact/art_a7e016210b9b9bc1/137) |
| Movie: camera and microphone choice | Menu | done | The Options menu; choosing another camera moves the preview to it (measured with two fake cameras). The microphone rows use the same path and were not chosen [shot](#project-artifact/art_a7e016210b9b9bc1/137) |
| Audio: level meter | Records | done | The meter moves with the fake microphone [shot](#project-artifact/art_a7e016210b9b9bc1/139) |
| record | Records | done | Audio take [shot](#project-artifact/art_a7e016210b9b9bc1/139) |
| stop | Records | done | Opens as sound with its length; listed in Movies [shot](#project-artifact/art_a7e016210b9b9bc1/140) |
| Screen: selection | Records | built-unchecked | The browser's picker chooses the screen, window or tab; Options > Selected Portion then shows it live to drag a box over, and records that part alone, drawn through a canvas. `preview-books-batch4-journey` recorded 720 of 1440 pixels' width with Chromium's fake picker. A drag over the real screen outside the page cannot be offered |
| Options | Records | built-unchecked | Microphone (None by default), Quality and, for the screen, Timer: None, 5 or 10 Seconds, a countdown after the picker that a press takes back: 5 Seconds counted, cancelled and left to run in `e2e/small-rows-batch12-journey.mjs`. Show Mouse Clicks puts a ring around each press on this page during a take, and the recording shows it (`quicktime-player-recording.test.tsx`, `small-rows-batch12-journey` reads the ring from the page in Chromium; a recorded movie not decoded for it). **Limit:** a web page sees only clicks made in it, and the row says so |
| Saved to the drive | Save | done | Named as a Mac names a screen recording, kept in Movies, also when the window is closed during a take [shot](#project-artifact/art_a7e016210b9b9bc1/140) |

## Editing

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Trim with handles | Cuts | done | [shot](#project-artifact/art_a7e016210b9b9bc1/279) |
| Clips strip: split | Edits | done | As Split Clip [shot](#project-artifact/art_a7e016210b9b9bc1/359) |
| reorder | Edits | done | Dragging a clip shows where it will go; dropping it replays the movie in the new order, read from its pixels, and Play All Movies plays that order. By pointer only: a keyboard reaches the same result by Cut and Paste. A replay records its picture 0.05 to 0.15 s behind its place, measured over three replays, so a clip's first moment can hold the frame before it; its still and the playhead when chosen are taken up to 0.3 s in [shot](#project-artifact/art_a7e016210b9b9bc1/420) |
| delete | Edits | done | As Edit > Delete [shot](#project-artifact/art_a7e016210b9b9bc1/421) |
| add | Edits | done | As Edit > Add Clip to End… [shot](#project-artifact/art_a7e016210b9b9bc1/423) |
| Rotate | Kept on save | built-unchecked | Rotate Left and File > Save: the file read back by ffprobe is turned, 480 by 854: `e2e/small-rows-batch12-journey.mjs` |
| Flip | Kept on save | built-unchecked | The journey saved a trimmed movie; flipped and saved after an Undo was not read back |
| Export | Encodes | built-unchecked | Where the browser has WebCodecs encoders for WebM, as Chromium has, each frame comes from its exact place and the sound from the decoded file, into a WebM that knows its length: `e2e/small-rows-batch12-journey.mjs` read a 6 s movie's 480p export by ffprobe and ffmpeg, VP9 and Opus, 6.000 s, red at 2.9 s and blue at 3.04 s, in 3 to 5 s over three runs. Elsewhere, and for sound it cannot decode apart from the picture or past 45 minutes, a replay through `MediaRecorder`: real time, the browser's format. Either way a generation of loss on every edit, and WebM or the recording format only, never a Mac's own formats. Firefox and WebKit were not run |

## Drag and drop

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Drop a movie on the window or Open window | Opens | done | From Finder or the desktop. A file from the computer goes through From This Computer…. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/36) |
| Drop on the Dock tile | Opens | done | A MOV, a WAV and an M4A dropped from Finder open and play, in Google Chrome [shot](#project-artifact/art_3e7ee16bed9df50f/59) |
| Drag a clip to Finder or the desktop | Exports | built-unchecked | A clip dragged out of the strip is replayed into a file when dropped, in real time and in the browser's recording format; on the desktop it was read back from the drive in quicktime-player.rows.clips. Finder takes it by the same route, not run; no published screenshot |
| Drag a clip into the Clips strip | Inserts | built-unchecked | A movie from Finder dropped on the strip joins at the gap under the pointer, and anything else is refused. Unit test only: `landingAt` with a stand-in file and replay |

## Multi-selection

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Several movies in the Open window | Opens all | built-unchecked | As Several movies chosen; quicktime-player.rows.several-movies |
| Several clips in the strip | Selects | built-unchecked | Command- and Shift-click; Cut, Copy, Delete and Paste act on them together. The pressed state read in quicktime-player.rows.clips; the commands by unit test |

## Saved state

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Recents | Recent items | built-unchecked | `/api/quicktime-player/recents` |
| held to 20 | Recent items | built-unchecked | `/api/quicktime-player/recents` |
| Place in each movie | Resumes | built-unchecked | |
| Open movie after a reload | Resumes | built-unchecked | The drive file each window shows is a desktop setting by window id (`quicktime-player.openMovies`); after a reload the window opens it again, read in quicktime-player.rows.reload. A movie's unsaved changes are not kept; it comes back as last saved; no published screenshot |
| Volume after a reload | Remembers | built-unchecked | A desktop setting (`quicktime-player.volume`); muted before the reload, volume 0 after it, in quicktime-player.rows.reload; no published screenshot |

## Cross-app

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Open a movie from Finder | Opens | done | A double-click in Finder. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/36) |
| Open an audio file from Finder | Opens | built-unchecked | Open With lists it for WAV and M4A (unit test), after Music; opening a sound file by a drop on the Dock is the row above. A double click goes to Music first, as on a Mac |
| Movies appear in Finder | Shows | built-unchecked | |
| Share to Mail | Attaches | built-unchecked | The shared rows of File > Share and the controller hand over the drive file; File > Share > Mail sent to another account, the attachment's bytes read back the same as the file: `e2e/small-rows-batch12-journey.mjs`. A movie with changes has no file until it is saved |
| Messages | Attaches | built-unchecked | As Mail |
| Notes | Attaches | built-unchecked | As Mail |
| Now Playing keys | Media keys | built-unchecked | Media Session: names the movie that last played, with play, pause, skip and seek. The session read in quicktime-player.rows.now-playing; the actions by unit test with a stand-in session, since a test browser has no media keys |
| Trimmed output in Photos | Add to Photos | built-unchecked | After Trim and Save, Add to Photos hands over the saved file, by unit test; Photos imports video by its type (`isMediaItem`). This trim into Photos not run in a browser |

## Calls made

- **Export and edits in a browser.** No encoder ships in the library's size budget. The call: the browser's own WebCodecs encoders where it has them for WebM, and otherwise a replay through `MediaRecorder`, giving WebM or MP4 at the source's size, or a named reduced size.
- **Rows without a browser route:** Move to Built-in Display and Save for iOS. They stay out of the menus.
- **From This Computer…** stays because it is how a file reaches the drive.
- **Save writes into the file.** As the real app does, with versions to go back to. A replayed movie is a generation worse than its source, which is why the source stays as a kept version. A file named for another format than the browser records stays as it is, and Save writes “name edited” beside it.
- **An edit takes as long as its encoding.** With WebCodecs, about as long as the frames take to seek and encode; as a replay, the movie's length. Its progress shows over the picture. Closing the window cancels one under way.
- **A take saves when it stops.** The real app holds it as an unsaved window until Command-S. Here it goes straight to Movies with a dated name, because a page can be closed at any time and a take held only in memory would be lost.

## Build items, most used first

Each item lands as small reviewed commits on main, with its rows moved to done only with a screenshot from the running desktop.

1. **Check what is built.** Walk every built-unchecked row in Chromium, with screenshots, and fix or downgrade what fails.
2. **Open from Finder and by dropping.** `appForFile` routes movies and audio to QuickTime Player (Finder worker's file, agreed with them), drop on the window, several movies in separate windows, Clear Menu.
3. **Playback keys and View menu.** J, K, L, Option and arrow keys, Up and Down, Loop, Actual Size, Fit, Fill, Panoramic, Increase, Decrease, a window that fits the movie's shape, draggable controller.
4. **Movie Inspector and Open Location.** Inspector, Float on Top, Open Location (URLs the browser can play, with a clear refusal otherwise).
5. **Trim.** Yellow handles, Command-T, saved through the replay export.
6. **Recording.** Movie and Audio with `MediaRecorder`, saved to Movies, then Screen with `getDisplayMedia`.
7. **Clips.** Show Clips, Split, delete, reorder, Add Clip, Rotate and Flip.
8. **Export As and document commands.** Export sizes, Duplicate, Rename, Move To, Save, Revert To, Show Export Progress.
9. **Share and saved state.** Share through the shared sheet, Media Session, volume and the open movie across a reload, contextual menu, subtitles if the file has them, Help pages.
