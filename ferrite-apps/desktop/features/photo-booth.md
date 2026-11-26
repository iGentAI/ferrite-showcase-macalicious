# Feature inventory: Photo Booth

Read from main at commit `e62c2ac9` (29 October 2026), on GitHub only, for the rows not touched since. Rows naming a journey or unit test cite that run; other rows rest on reading the code. No row says done without a screenshot.

**Status words.** `missing`: not in main's code. `partial`: part is in main's code, and the note says what is absent. `built-unchecked`: main's code has it, but nobody has seen it running for this inventory. A row becomes done only with a screenshot from the running desktop in a browser.

**What was read:**

- `demos/photo-booth/photo-booth-desktop.tsx`, `photo-booth.tsx`, most of `photo-booth-data.ts` and `photo-booth.mdx`, `app.ts`
- `demos/desktop/desktop-menus.tsx`
- the README's Photo Booth section (see the note below)

**How reliable the "real app" column is.** Menus and shortcuts come from knowledge of Photo Booth 11 on Catalina. Apple's page was not loaded. Check each against the Help and `reference/` when building its row.

**Ledger.** The "Macalicious open work ledger" (version 3) has no open item for Photo Booth, only Storage Management's note that its photos are counted.

**Other journeys.** `e2e/photo-booth-journey.mjs` and `photo-booth-census-journey.mjs` exist on main. They were not read or run here.

**README looks stale.** Its Photo Booth paragraphs describe `/api/photo-booth/photos` and say the stored JPEG is the plain frame. `photo-booth-desktop.tsx` saves through the Photos library and bakes the effect in (`bakeEffect`). The first build item checks this and corrects the README.

## Application menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| About Photo Booth | Panel | built-unchecked | Shared row |
| Preferences… | The real app has none | built-unchecked | Row dimmed with a reason |
| Services | System | built-unchecked | With no text selected "No Services Apply", as on a Mac; text selected in the window gets the desktop's services (`ServicesItems`) |
| Hide | Standard | built-unchecked | Shared rows |
| Hide Others | Standard | built-unchecked | Shared rows |
| Show All | Standard | built-unchecked | Shared rows |
| Quit | Standard | built-unchecked | Shared rows |

## File menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Export… | Exports the selected picture | built-unchecked | File's row, pressed, and the contextual menu, as a download of the stored file: `e2e/media-small-batch8-journey.mjs` reads a JPEG of the stored size, from a canvas stream standing in for the camera. The browser chooses the folder [shot](#project-artifact/art_a7e016210b9b9bc1/110) |
| Print… (Command-P) | Prints the selection | built-unchecked | The picture shown goes to the browser's print dialog; a journey checks it laid out, no paper was printed, and the key not pressed [shot](#project-artifact/art_a7e016210b9b9bc1/110) |
| Reveal in Finder | Shows the file | built-unchecked | Finder opens with that picture's own file selected, read in photo-booth-file-journey; no screenshot of Finder |
| Close (Command-W) | Closes | built-unchecked | Shared row |

## Edit menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Undo | Delete and flip | done | Run in photo-booth-rows-journey, read back from the library and the camera's filter: Take Photo, Delete (several as one step), Delete All, Flip Photo, Cut, Paste and a change of effect, named in the row, by the row and Command-Z. Choosing an effect being undoable is this project's addition. The history ends with the window, as an app's does when it quits (read in code, not run). [shot](#project-artifact/art_a7e016210b9b9bc1/447) |
| Redo | Delete and flip | done | The same steps brought back, by the row and Shift-Command-Z. [shot](#project-artifact/art_a7e016210b9b9bc1/449) |
| Cut | Picture | done | Copies, then moves the picture to Photos' Recently Deleted; Undo Cut restores it. [shot](#project-artifact/art_a7e016210b9b9bc1/451) |
| Copy | Picture | done | The selection or the picture shown goes on the desktop's clipboard, and its first still on the browser's clipboard as a PNG, read back with its pixels in Chromium, with clipboard permission granted to the browser context. A browser's clipboard holds one picture and no movie, so other programs get only that first still. `photo-booth-rows-journey` also passes in Firefox 157 and Playwright's WebKit 27.2 on Linux, 66 of Chromium's 78 steps: there a stand-in in the page replaces the clipboard (a headless Firefox's holds only text, and WebKit refuses a script's read), so the real clipboard ran only in Chromium, and the 12 steps of a copied movie are left out (WebKit on Linux has no MediaRecorder, and a clip of the journey's canvas camera never ended in headless Firefox). Safari itself not run. [shot](#project-artifact/art_a7e016210b9b9bc1/450) |
| Paste | Picture | done | Adds a new picture with its own file, from the desktop's clipboard or the browser's; read back by its pixels, by the row and Command-V. A picture another program puts on the clipboard after Copy is told apart by its pixels, as a page is not told of the change, and is the one pasted, down to a small patch, as the two are compared pixel by pixel. A copied movie has no form on that clipboard, so Copy puts its name there. Words another program copies over what Copy left mean nothing is left to paste, and the window says so. A movie's copy yields to any picture found afterwards. A still the browser refused pastes as copied, the picture already there being noted when it refused, and yields only to a different picture or words found later (where that picture could not be read at the refusal, to any). A copy in Finder also yields to any picture, unless that picture is the one Photo Booth left there; two limits follow, as a page cannot tell one copied since from one copied before and Finder writes nothing to that clipboard: a picture copied elsewhere before the copy in Finder is the one pasted, and words copied elsewhere after it do not stop Finder's item pasting. Where a menu cannot read the clipboard the row dims with its reason in `title` and `data-reason`, and Command-V still works (unit test only; Chromium can read it). [shot](#project-artifact/art_a7e016210b9b9bc1/452) |
| Delete | Removes the selection | built-unchecked | Edit > Delete on the picture shown, besides the Delete key and contextual menu; the journey reads the library, with no screenshot of it |
| Select All | Selects the strip | done | Edit > Select All; Delete and Export… then act on them [shot](#project-artifact/art_a7e016210b9b9bc1/249) |
| Flip Photo | Mirrors a picture | done | On the picture shown, kept as a Photos edit that Revert takes back [shot](#project-artifact/art_3e7ee16bed9df50f/63) |
| Auto Flip New Items | Saved setting | built-unchecked | On by default: a new picture is saved the way the mirror showed it. Off, it is saved as the camera saw it, and off is kept across a reload. The journey reads the pixels, with no screenshot of the row |
| Delete All | Clears the strip, with a confirmation | done | Asks first; both go to Photos' Recently Deleted [shot](#project-artifact/art_a7e016210b9b9bc1/111) |
| Start Dictation | System | built-unchecked | Every app's Edit menu ends with it (`EditFooter`, desktop-menus.tsx): types what the browser's recognizer hears, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer |
| Emoji & Symbols | System | built-unchecked | The same footer: opens the desktop's character viewer, Control-Command-Space. The unit test desktop.test.tsx reads it enabled |

## View menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Show Effects / Hide Effects | Effects | done | The row follows the view, which is kept across a reload [shot](#project-artifact/art_a7e016210b9b9bc1/248) |
| Show Photo Preview | Camera view | done | Brings the camera back, also from a picture or clip shown large; dimmed when the camera already shows [shot](#project-artifact/art_a7e016210b9b9bc1/245) |
| Start Slideshow | Plays pictures | done | Over the whole page, three seconds each, with Previous, Pause, Next and Close, arrows, Space and Escape; a clip plays silently [shot](#project-artifact/art_a7e016210b9b9bc1/244) |
| Enter Full Screen (Control-Command-F) | Full screen, with the camera filling it | done | The desktop's row: the window fills the page, the camera fills the stage, a picture taken there has the stage's shape, the previews share the stage, and leaving restores 720 by 562 with 236 by 156 previews. The window now grows from its captured size, instead of having one size. Measured at 1440 by 900 in the page, not the browser's own full screen. Off Apple platforms the key cannot be typed, so the row and Control-Option-F were run; Control-Command-F itself was not. [shot](#project-artifact/art_a7e016210b9b9bc1/448) |

## Camera and Window menus

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Camera list | Chooses a camera | done | Lists the browser's cameras and moves the picture to the chosen one; kept across a reload by the camera's name; measured with two fake cameras [shot](#project-artifact/art_a7e016210b9b9bc1/248) |
| Microphone list | Chooses a microphone | built-unchecked | Choosing a row records the next clip from that microphone with `deviceId: { exact }` (photo-booth-rows.test.tsx, with a stub recorder); not run with real microphones |
| Enable Screen Flash | Toggles | done | Off shows no flash, also after a reload [shot](#project-artifact/art_a7e016210b9b9bc1/248) |
| Minimize | Standard | built-unchecked | Shared rows |
| Zoom | Standard | built-unchecked | Shared row, undimmed now that the window can grow; not pressed |
| Bring All to Front | Standard | built-unchecked | Shared rows |
| window list | Standard | built-unchecked | Shared rows |
| Photo Booth Help | Help Viewer | built-unchecked | The Help menu's row opens Help Viewer on a search for "Photo Booth", which it lists (`requestHelp`, desktop-menus.tsx; help-viewer-data.ts). Read in code, not pressed |

## Modes and camera view

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Live camera in the stage | Mirror preview | done | Live video, mirrored in the camera view and the previews [shot](#project-artifact/art_3e7ee16bed9df50f/64) |
| Take a Still | Single picture | built-unchecked | Countdown of three, then saved |
| Take Four Quick Pictures | Four-up | done | Four pictures 0.8 s apart, each flashing, kept as one two-by-two picture with its effect [shot](#project-artifact/art_a7e016210b9b9bc1/247) |
| Record a Movie Clip | Video | done | The effect drawn into the movie: by the canvas's filter, or computed per frame where a canvas has none (WebKit; that path is unit-tested only, since WebKit on Linux has no MediaRecorder to record with); sound from the microphone; kept in Photos as a movie; closing the window during a clip still saves it (read in code, not run) [shot](#project-artifact/art_a7e016210b9b9bc1/245) |
| Mode switch at the bar's left | Three buttons | done | Stand-in glyphs [shot](#project-artifact/art_a7e016210b9b9bc1/247) |
| Option-click the shutter skips the countdown | Immediate | done | [Screenshot](#project-artifact/art_3e7ee16bed9df50f/40) |
| Shift-click the shutter skips the flash | No flash | done | [Screenshot](#project-artifact/art_3e7ee16bed9df50f/40) |
| Countdown | Stops | built-unchecked | |
| Cancel | Stops | built-unchecked | |
| Escape | Stops | built-unchecked | |
| Screen flash | White flash | done | Over the stage rather than the whole screen; off under Reduce Motion. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/40) |
| Shutter sound | Sound | built-unchecked | Two clicks of filtered noise from Web Audio, made here as no recording of Apple's is in the project, for each still and each of Four Quick Pictures, under Output volume and Mute. Unit-tested with a stub Web Audio (two sounds begun per picture, none under Mute); not heard in a browser |
| Command-T | Takes a picture | done | Starts the countdown from the window. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/40) |
| Camera refusals in words | Message | built-unchecked | Unsupported, denied, missing, busy |

## Effects browser

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Pages with live previews | Nine effects per page | built-unchecked | Three pages; preview per effect |
| Page control dots | Chooses a page | built-unchecked | |
| Page control arrows | Steps a page | built-unchecked | |
| Sepia | Colour effects | built-unchecked | Computed on the frame's pixels (photo-booth-effects.ts), live, saved and in a clip: toned from luminance. Tuned by eye, as `reference/` has no screenshot of an effect on a known picture and the captures are not on disk here |
| Black and White | Colour effects | built-unchecked | Computed: luminance through an S-curve. As Sepia |
| Plastic Camera | Colour effects | built-unchecked | Computed: crossed curves, more saturation, dark corners. As Sepia |
| Comic Book | Colour effects | built-unchecked | Computed: black ink only, Sobel edges and halftone dots. Census row `effects.computed` read 273,280 of 273,280 pure black or white pixels on the live canvas in Chromium with the fake camera, and a saved picture colourless |
| Color Pencil | Colour effects | built-unchecked | Computed: the picture's colours on white, strokes on edges and hatching in shadows. As Sepia |
| Glow | Colour effects | built-unchecked | Computed: screened with a wide blur of itself. As Sepia |
| Thermal Camera | Colour effects | built-unchecked | Computed: luminance through a cold-to-hot palette. As Sepia |
| X-Ray | Colour effects | built-unchecked | Computed: inverted luminance, tinted blue. As Sepia |
| Bulge | Distortions centred on the face | built-unchecked | A real warp on the frame's pixels with bilinear sampling, live, saved and in a clip. Centred on the first face found, with its reach from the face's width, and on the frame while none is found: `rows-batch25-journey` (`photo-booth.warps`) read Bulge's centre move across the frame with the portrait (0.6, 0.5, 0.3 of the width). Limits: the first face only; a still taken and a clip use the same centre by the same code, but only Nose Twirl's still was driven. Census row `effects.previews` read a painted canvas on all eight previews of the page; `effects.computed` the same in the camera view |
| Dent | Distortions centred on the face | built-unchecked | A real warp, as Bulge |
| Twirl | Distortions centred on the face | built-unchecked | A real warp, as Bulge |
| Squeeze | Distortions centred on the face | built-unchecked | A real warp, as Bulge |
| Mirror | Distortions centred on the face | built-unchecked | The left half reflected onto the right, as Bulge |
| Light Tunnel | Distortions centred on the face | built-unchecked | The middle kept and the rest drawn from the wall of its circle, spiralling, as Bulge |
| Fish Eye | Distortions centred on the face | built-unchecked | A barrel warp of the whole frame, as Bulge |
| Stretch | Distortions centred on the face | built-unchecked | A real warp, as Bulge |
| Further pages: Dizzy, Love Birds, Balloons | Tracked effects | built-unchecked | Page 3's first three cells, replacing the invented Dusk, Frost and Ember. Original art drawn around each face found by MediaPipe's BlazeFace short-range model (Apache 2.0; 229,746 bytes in `demos/photo-booth/vendor/`), served from the site's own assets, read once and only when such an effect shows, run in a worker (about 70 ms a detection in Node here; the browser's time was not measured), about ten detections a second, shared by the previews (`demos/desktop/desktop-faces.ts`, with `detectFaces` for other apps). `@mediapipe/tasks-vision` itself does not fit: `pack-site.mjs` answers `refusing assets/vision_wasm_internal-abcdefgh.wasm: its literal is over the 14680064-byte part limit`, so the model runs on a small interpreter of its nine operators, adding 236 KB to the site. `faces-batch16-journey` in Chromium, its fake camera playing a Y4M of a NASA portrait in the public domain that jumps across the frame: the art read from canvas pixels follows the face in all three, a still and a clip keep the art in their pixels, no request leaves the site, and a model file that cannot be read is said in the window. [Unit tests](../../../demos/photo-booth/photo-booth-tracked.test.ts). Limits: no person segmentation, so the art passes over the head and never behind it; no face in frame shows no art; a false positive was seen in two census runs on Chromium's default fake camera, whose green disc drew Dizzy's art for some turns of it (score not read; the threshold stays MediaPipe's 0.5, as this portrait scores 0.5 to 0.9 and lower would lose real faces); short range, so a face far from the camera gets none (this portrait at under about a tenth of the frame's height was not found); art lags a fast move by about a tenth of a second; the journey runs in Chromium and Firefox only: in Firefox, whose fake camera (`media.navigator.streams.fake`) plays moving colours and takes no file, it proves the camera (Take Photo enabled and pressed), the model read once from the site and the refused model said in the window, not that a still was saved, and not tracking; its previews step passes without checking; not run in WebKit, which has no camera stand-in on Linux, on a real camera, or on a moving person; the screenshots live in the batch's output, not yet published as artifacts |
| Further pages: Hearts, Lovestruck, Nose Twirl, Chipmunk, Frog (names from memory, not checked) | Tracked effects | built-unchecked | The rest of page 3, replacing the invented Fade, Ink, Negative, Tilt and Haze. Original art (Hearts around the head; Lovestruck's hearts over the eyes) and warps on the face's landmarks (Nose Twirl on the nose; Chipmunk on the cheeks; Frog's eyes and wide mouth with a green cast), live, in a still and in a clip, from `desktop-faces.ts`. `rows-batch25-journey` in Chromium with the fake camera's portrait: all five changed the canvas's pixels only around the face found (Hearts 1244 pixels near the face and 0 elsewhere, Lovestruck 681 and 0, Nose Twirl 1944 and 0, Chipmunk 427 and 0, Frog 9967 and 0), the hearts ring the head in a screenshot, and a still of Nose Twirl was kept under its effect. That step's journey used to draw its plain frame half a pixel off the app's crop, which counted high-contrast edges as changed: 911 to 950 pixels elsewhere when measured, 0 once corrected. The earlier failing runs' 1914 elsewhere was not reproduced, and is put down to the same offset. Limits: as the row above; the clip was not driven; Chipmunk and Frog follow the six BlazeFace landmarks, so a head turned far away warps the wrong place; not run in Firefox or WebKit or on a real camera; a picture kept under a removed effect's name shows as Normal |
| Backdrops | Replaces the background | built-unchecked | Page 4: four drawn backdrops. The window asks the person out of the frame for 3 seconds and learns the empty background; what differs from it afterwards is kept (`photo-booth-backdrop.ts`, unit test), live, in a still, four-up and a clip. It needs a still camera and steady light, as the real one asks: not a person segmentation, so what the empty frame already held is replaced even in front of the person when colours match. Chromium with its fake camera: `small-apps-batch3-journey` read the live canvas and the picture taken. The clip and four-up modes were not driven with one |
| including your own | Replaces the background | built-unchecked | Four User Backdrop slots, each a picture in Documents/Photo Booth Backdrops; removed from there in Finder. Empty slots say Drag Backdrops Here. Picture dropped, replaced, kept across a reload: `small-apps-batch3-journey` |
| Choosing moves to the camera and remembers it | Moves | done | The effect and the view stay across a reload [shot](#project-artifact/art_a7e016210b9b9bc1/248) |
| Effect kept in the picture | Baked | built-unchecked | `bakeEffect` draws transforms and computes filters, for WebKit too |

## Strip and viewing pictures

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Strip of pictures | Scrolls through all | built-unchecked | Every picture, scrolling sideways; the journey has one picture, so scrolling itself was not run |
| Click a picture shows it large | Replaces the preview | done | From its original; "Back to Camera" or Escape returns. The button's wording is a call. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/39) |
| Share button on the selection | Mail, Messages, AirDrop, Notes, Add to Photos | built-unchecked | The library's Share button in the bar, left of Effects, once a picture is chosen; census row `strip.share` opened it and read its rows in Chromium. A drawn glyph, not Apple's; its place in the bar is provisional, as no capture shows it. Escape closes the menu and leaves the picture shown |
| Contextual menu: Export | Rows | built-unchecked | Export…, Print…, Flip Photo, Reveal in Finder, Share, Delete: read in order in photo-booth-rows.test.tsx, and Share's rows in `strip.share` |
| Delete | Rows | built-unchecked | With a selection it deletes the selection (unit test); census row `strip.delete` passed |
| Delete | Removes | built-unchecked | Moves to Photos' Recently Deleted |
| Backspace on a picture | Removes | built-unchecked | Moves to Photos' Recently Deleted |
| Multi-select on the strip | Shift, Command | done | Command-click adds, Shift-click takes a range (unit test), a plain click starts over [shot](#project-artifact/art_a7e016210b9b9bc1/249) |
| Delete several | Removes | done | Edit > Delete sends both to Photos' Recently Deleted, read back from the library [shot](#project-artifact/art_a7e016210b9b9bc1/249) |
| Playing a clip | Plays | done | With the movie's controls, where a picture is shown large [shot](#project-artifact/art_a7e016210b9b9bc1/246) |
| Slideshow | Full screen | done | Over the page; not the browser's full screen [shot](#project-artifact/art_a7e016210b9b9bc1/244) |

## Drag and drop

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Drag a picture to Finder | Copies | built-unchecked | The strip's picture carries its bytes as a desktop drag, which Finder's drop uploads (`finder.tsx`, read in code; the drag itself in the row below) |
| the desktop | Copies | built-unchecked | Census row `strip.drag-out`: a real pointer drag left the desktop's drive a copy with the same SHA-256, and the picture stayed in Photos and on the strip |
| Drag a picture to Mail | Attaches | built-unchecked | Mail's compose window takes any drag and reads its bytes (read in code; not dropped in a browser) |
| Messages | Attaches | built-unchecked | Messages takes any drag and reads its bytes (read in code; not dropped in a browser) |
| Notes | Attaches | built-unchecked | Notes takes a picture file (read in code; not dropped in a browser). A movie clip is refused in Notes' words |
| Drag a picture onto the Backdrop page | Custom backdrop | built-unchecked | From Finder with real mouse input: `small-apps-batch3-journey`. From Photo Booth's own strip: same drop, not driven. Past four the window says to remove one |

## Saved state

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Pictures in the Photos library and in Pictures/Photo Booth | Kept | built-unchecked | Library limit counts them |
| Effect saved with the picture | Kept | built-unchecked | |
| Current view and effect | Remembered | done | [shot](#project-artifact/art_a7e016210b9b9bc1/248) |
| page | Remembered | built-unchecked | Kept as the view and effect are; not read after a reload |
| A failed save | Not kept, says so | built-unchecked | |
| Camera choice | Remembered | done | By the camera's name: browsers change a device's id when site data goes [shot](#project-artifact/art_a7e016210b9b9bc1/248) |
| flash | Remembered | done | [shot](#project-artifact/art_a7e016210b9b9bc1/248) |
| flip settings | Remembered | built-unchecked | Auto Flip New Items is a desktop setting (`AUTO_FLIP`, `useDesktopSetting`), kept across a reload: see its Edit row |

## Cross-app

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Pictures appear in Photos | Add to Photos | built-unchecked | Automatic; Photos row and search term |
| Delete or edit in Photos changes the strip | Separate apps on a Mac | built-unchecked | Library change event |
| Originals in Finder | Package on a Mac | built-unchecked | Folder of Pictures |
| Share to Mail | Attaches | built-unchecked | The Share rows hand the drive files over (`FileShareItems`); rows read in `strip.share`, Mail not opened from them here |
| Messages | Attaches | built-unchecked | The same rows |
| Notes | Attaches | built-unchecked | The same rows |
| Use as desktop picture | Share rows | built-unchecked | Set Desktop Picture in every Share menu, through Photos' `setDesktopPicture`, with the edit drawn in; dimmed with its reason for a clip or several pictures. Unit-tested against a stand-in for the library; the desktop's picture not read in a browser |
| contact photo | Share rows | built-unchecked | Set Contact Picture… in every Share menu: an alert lists the cards, and the chosen one takes the picture, with its edit, kept beside the cards and named by the card through the desktop's one document of the cards, so an open Contacts window is given it. Dimmed with its reason for a clip or several pictures. Read back from the server: `e2e/books-pictures-batch6-journey.mjs` |
| Storage Management counts | Counts | built-unchecked | README |

## Calls made

- **Mirror.** The camera view mirrors by default and pictures are flipped by Auto Flip New Items, as on a Mac.
- **Face effects and backdrops.** No face-tracking library is in the project, and the size gate stands against one. The call: real warps for distortions, computed on the frame's pixels rather than on the WebGL canvas first planned, so that the same arithmetic serves the preview, the saved picture and a clip, in every browser, and unit tests read literal pixels. Canvases share 8 ms of each animation frame. Backdrops by a still-background difference method, labelled as approximate, are not built yet; face effects stay out and the third page stays invented, as the docs already say.
- **Window size.** The window opens at the reference's size and goes no smaller. It grows, and takes the desktop's own full screen, so the row needs no second code path, and the previews share the stage. This replaces the earlier call of a fixed window with full screen as a state of its own, since the desktop's Enter Full Screen row dims for any window that cannot resize.

## Build items, most used first

Each item lands as small reviewed commits on main, with its rows moved to done only with a screenshot from the running desktop (Playwright's fake camera stands in for hardware, and the report must say so).

1. **Check what is built.** Walk every built-unchecked row in Chromium with the fake camera, with screenshots, and fix or downgrade what fails. Correct the README's Photo Booth section.
2. **Viewing pictures.** Click shows a picture large, strip scrolls through all, multi-select, Delete All with a confirmation, Undo of a delete.
3. **Modes.** Four Quick Pictures (four-up sheet saved as four and one), Record a Movie Clip with `MediaRecorder` (needs Photos' video item for the library; saved to the drive until then), mode switch, Option-click and Shift-click, Command-T, flash, shutter sound.
4. **Menus.** File (Export, Print, Reveal in Finder), Edit (Delete, Select All, Flip, Auto Flip, Delete All), View, Camera list and flash, full screen, saved settings.
5. **Mirror and Flip.** Mirrored preview, Flip Photo, Auto Flip, kept with the picture.
6. **Real distortions.** Canvas warps for Bulge, Dent, Twirl, Squeeze, Fish Eye, Stretch and Light Tunnel, baked at the shutter.
7. **Backdrops.** Stock backdrops and your own, by background difference, labelled as approximate.
8. **Share and drag out.** Shared sheet, drag to Finder and desktop, desktop picture, Slideshow, Help pages.
