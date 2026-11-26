# Feature inventory: Preview

Read from main at commit `e62c2ac9` (29 October 2026), on GitHub only. Nothing was run for this inventory, so no row can say done.

**Status words.** `missing`: not in main's code. `partial`: part is in main's code, and the note says what is absent. `built-unchecked`: main's code has it, but nobody has seen it running for this inventory. A row becomes done only with a screenshot from the running desktop in a browser.

**What was read:**

- `demos/preview/preview-app.tsx` (the window the Ferrite desktop opens), the first half of `preview.mdx`, `app.ts`
- `demos/desktop/desktop-menus.tsx`
- `demos/finder/finder-open.ts`

Not read: `preview-markup.ts`, `preview-export.ts`, `preview-pdf.ts`, the module's Rust. Claims about them come from `preview.mdx` and the ledger.

**How reliable the "real app" column is.** Menus and shortcuts come from knowledge of Preview 11 on Catalina. Apple's Catalina page was not loaded. Check each against the app's Help and `reference/` when building its row.

**Other journeys.** `e2e/preview-journey.mjs` exists on main; it was not read or run here. `e2e/preview-census-journey.mjs` ran whole in Chromium on main (build swp59): 223 rows ok, 0 failed, 0 unexercised, 0 page problems; its restart phases, Firefox and WebKit were not run. `e2e/preview-annotate-journey.mjs` walks the marks on a PDF's text, notes, the Highlights and Notes sidebar and what a search colours on the page.

## Open items from the ledger

| Item | Status | Note |
| --- | --- | --- |
| Text box on turned pages | done | Reproduced with a journey step that read the page's ink, then fixed. A text keeps the quarter turns of the view it was typed in (`turns`) and is drawn turned back by them, so it reads upright where it was typed, with its selection box around it. It turns with the page afterwards. Only one quarter turn was seen running; the other two have unit tests. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/29) |

## Application menu (Preview)

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| About Preview | Panel | built-unchecked | Shared row |
| Preferences… (Command-comma) | General, Images, PDF, Signatures | built-unchecked | `app.ts` names `PreviewPreferences`, with Images and PDF panes: window background and what 100% means, kept in the desktop's settings and read by every window. No General pane: its one choice, how files share a window, is dimmed in Images with its reason. Signatures says where to make and delete them; it does not list them |
| Services | System | built-unchecked | With no text selected "No Services Apply", as on a Mac; text selected in the window gets the desktop's services (`ServicesItems`) |
| Hide | Standard | built-unchecked | Shared rows |
| Hide Others | Standard | built-unchecked | Shared rows |
| Show All | Standard | built-unchecked | Shared rows |
| Quit | Standard | built-unchecked | Shared rows |

## File menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| New from Clipboard (Command-N) | New document from a copied picture | built-unchecked | Reads the browser's clipboard (the browser may ask), writes the picture to Pictures as Untitled and opens it; says so when it holds no picture. A Mac leaves it unsaved until asked: a window here shows a file of the drive |
| Open… (Command-O) | Open dialog | built-unchecked | Drive's Open dialog, starts in Pictures |
| Open Recent ▸ | Recent files | built-unchecked | From saved places, with Clear Menu |
| Clear Menu | Recent files | built-unchecked | From saved places, with Clear Menu |
| Close (Command-W) | Closes, asks about changes | built-unchecked | Shared row; the Save alert is Preview's |
| Save (Command-S) | Saves | built-unchecked | Picture only, written in its format; replaced file goes to Trash; PDF markup saves as it is drawn |
| Duplicate (Shift-Command-S) | Document commands | built-unchecked | A copy named "<name> copy" beside the file, shown in this window (asking first about unsaved changes): one document to a window. A changed picture is written as it is now; a PDF's markup goes with the copy |
| Rename… | Document commands | built-unchecked | A sheet; the drive refuses a name its folder has, and the alert says why. Not in the title bar: see Toolbar |
| Move To… | Document commands | built-unchecked | A sheet with every folder of the drive by path |
| Revert To ▸ Last Saved | Versions | built-unchecked | Back to the picture and markup as opened or last saved, as one change Undo brings back. The toolbar's pull-down keeps Revert Edits and Remove All Markup |
| Previous Save | Versions | built-unchecked | Dimmed with its reason: Preview's Save replaces a picture and puts the old one in the Trash, rather than saving in place, so the drive's versions hold nothing for it |
| Browse All Versions | Versions | built-unchecked | Dimmed with its reason, the same |
| Export… | Sheet with format, quality, resolution, encryption | built-unchecked | JPEG with a quality slider, PNG, TIFF (written from the pixels) and PDF, with a resolution for a PDF's pages; HEIC, JPEG-2000 and OpenEXR show dimmed, as a browser cannot write them. Encrypt shows dimmed for a PDF, with its reason: pdf.js opens a locked PDF and cannot write one. Unit test |
| Export as PDF… | Writes a PDF with text kept | built-unchecked | Its own row. A PDF with nothing changed is written as its own bytes, text kept, and with its form filled as pdf.js writes it; with only its pages moved it is written by pdf.js with text kept; with marks or a page turned, its pages become JPEGs at the resolution chosen, each turned as shown, with the page's text and what typed marks say laid invisibly over them, so it is still selected and searched: `preview-books-batch4-journey` reopened a marked PDF and pdf.js found its words. Links are not kept once a page is drawn as a picture |
| Share ▸ | Services | done | The saved file, as it is on the drive: Add to Photos ran and is read back from the library; unsaved edits are not in it [shot](#project-artifact/art_a7e016210b9b9bc1/305) |
| Enter Password… | Locked PDFs | built-unchecked | Opening a locked PDF asks for its password, says when it is wrong, and pdf.js opens it with the right one; the row asks again after Cancel, and is dimmed, saying why, otherwise. The password is not kept |
| Import from iPhone | Hardware | built-unchecked | Dimmed with its reason: a web page cannot reach it |
| Scanner | Hardware | built-unchecked | "Import from Scanner": dimmed with its reason |
| Camera | Hardware | built-unchecked | "Import from Camera": dimmed with its reason |
| Take Screenshot ▸ From Selection | Screenshot | built-unchecked | The browser's screen chooser, one frame written to Pictures and opened with the selection tool in hand: the selection is made in the window, as a web page cannot draw over the screen. Dimmed with its reason where the browser has no capture. Unit test with a stand-in stream; no real capture was run |
| Window | Screenshot | built-unchecked | The chooser, starting on windows; the same frame written and opened. Same test |
| Entire Screen | Screenshot | built-unchecked | The chooser, starting on the screen; the browser decides what may be picked. Same test |
| Print… (Command-P) | Print sheet | partial | The picture or every page, edits and markup drawn in, goes to the browser's print dialog, which stands in for the print sheet; a journey checks the pages laid out, and no sheet of paper was printed [shot](#project-artifact/art_a7e016210b9b9bc1/109) |

## Edit menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Undo (Command-Z) | Undoes | done | Row and key. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/30) |
| Redo (Shift-Command-Z) | Redoes | done | Row and key; a new change ends it. The row ran in the browser, the key in a unit test. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/30) |
| Cut | Marks, text, selection of a picture | built-unchecked | Every mark chosen, as one change to Undo, with the words of one mark on text copied. With a picture's selection, of any shape, it goes to the clipboard as PNG and is taken out, as one change to Undo: clear in PNG, white in JPEG. A clipboard that refuses leaves the picture whole. `preview-books-batch4-journey` read the clipboard's size and the saved file's pixels |
| Copy | Marks, text, selection of a picture | built-unchecked | The marks chosen (within the window), or the words of one mark on text, or the PDF text selected; with neither, on a picture, the picture or its selection goes to the system clipboard as PNG, edits and marks drawn in. Row and key. Unit test copies two marks |
| Paste | Marks, text, selection of a picture | built-unchecked | The marks copied, onto the page shown, a little off the originals, all chosen. Unit test pastes two |
| Delete | Deletes the selected mark | done | Row and key; dimmed with nothing selected. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/30) |
| Select All (Command-A) | Marks or text | built-unchecked | The shown page's text of a PDF, or with the markup bar on, the marks of the page shown, or with the keyboard in the thumbnails, every page; the whole picture, ready to copy or crop to, row and key. Unit test for the marks |
| Deselect All | Marks or text | built-unchecked | Row; lets go of a mark or a picture's selection |
| Insert ▸ Page from File | Adds pages to a PDF | built-unchecked | A PDF's pages, or a picture as a page, after the page chosen; also in the thumbnails' menu. pdf.js writes the new file with its text and links, which replaces the file, the old one going to the Trash; marks follow their pages. The journey ran it. No Undo: the Trash holds what it was |
| Page from Scanner | Adds pages to a PDF | built-unchecked | Dimmed with its reason, in Edit > Insert |
| Blank Page | Adds pages to a PDF | built-unchecked | Edit > Insert, after the page chosen, as large as the file's first; read back in the order kept and an exported PDF's page count; no screenshot |
| Find ▸ Find (Command-F) (Shift-Command-G) | Search | done | Rows and keys, for a PDF; dimmed for a picture, whose text is not read. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/31) |
| Next (Command-G) (Shift-Command-G) | Search | done | Row and key; goes to the next page found, not the next match on a page. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/31) |
| Previous (Shift-Command-G) | Search | done | Row and key; goes to the previous page found. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/31) |
| Spelling | Text rows | built-unchecked | Edit > Spelling and Grammar, the desktop's shared rows and panel, on the one text or note chosen; dimmed with none, as a press on the menu bar ends writing a text. Check Spelling While Typing turns the browser's own check on or off in a text and a note, kept in the settings. Unit test: dimmed and enabled, and the field's attribute; the panel on a mark was not run |
| Substitutions | Text rows | built-unchecked | Edit > Substitutions, the shared rows and panel: Replace All on the text or note chosen, and smart quotes and dashes while typing one; kept as `preview.substitutions`. Unit test of the rows only |
| Start Dictation | Text rows | built-unchecked | The desktop's Edit footer: types what the browser's recognizer hears at the insertion point, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer |
| Emoji & Symbols | Text rows | built-unchecked | The desktop's Edit footer (`desktop-menus.tsx`) |

## View menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Continuous Scroll | Page display | done | Every page, and scrolling chooses the current one [shot](#project-artifact/art_3e7ee16bed9df50f/56) |
| Single Page | Page display | done | The page alone, fitted whole; Next and Previous step; kept per file across a reload [shot](#project-artifact/art_3e7ee16bed9df50f/56) |
| Two Pages | Page display | done | Odd-even pairs side by side; Next and Previous go by pairs [shot](#project-artifact/art_3e7ee16bed9df50f/56) |
| Hide Sidebar | Sidebar | built-unchecked | Also in the toolbar's pull-down |
| Thumbnails | Sidebar | built-unchecked | Also in the toolbar's pull-down |
| Table of Contents | Sidebar from a PDF outline | built-unchecked | In View and the toolbar's pull-down: the file's outline as pdf.js reads it, stood in by level; a row goes to its page, following pages moved and leaving out those deleted; says so when the file has none |
| Highlights and Notes | Sidebar list | done | In View and the toolbar's View pull-down, for a PDF. Every highlight, underline, strikethrough and note by page, from the top down, with its words; a row goes to its page and chooses the mark, Delete takes it off and Undo brings it back. [shot](#project-artifact/art_a7e016210b9b9bc1/363) |
| Bookmarks | Sidebar list | built-unchecked | In View and the toolbar's pull-down: the bookmarked pages, a row going to its page, Delete taking it off; kept in the desktop's settings, at most 40, and following a page that is moved |
| Contact Sheet | Page grid | done | A grid of every page in the main view; choosing one shows it in the layout left [shot](#project-artifact/art_3e7ee16bed9df50f/57) |
| Actual Size (Command-0) (Command-9) | Zoom | built-unchecked | |
| Zoom to Fit (Command-9) | Zoom | built-unchecked | |
| Zoom In (Command-plus) | Zoom | built-unchecked | |
| Zoom Out (Command-minus) | Zoom | built-unchecked | |
| Zoom to Selection (Command-asterisk) | Fits a selection | built-unchecked | A picture's selection or the PDF text selected fills the view, centred; dimmed, saying why, with nothing selected |
| Show Markup Toolbar (Shift-Command-A) | Toggles | built-unchecked | Moved from Tools to View |
| Slideshow (Shift-Command-F) | Full-screen pages | built-unchecked | The pages on black, full screen where the browser allows it; a page every 5 seconds until Pause; Previous, Next and End Slideshow, the arrow keys, the space bar and Escape |
| Show Tab Bar | Tabs | built-unchecked | Dimmed with its reason: windows on this desktop have no tabs |
| Show All Tabs | Tabs | built-unchecked | Dimmed with its reason, the same |
| Hide Toolbar | Toolbar | built-unchecked | Hide Toolbar and Show Toolbar (Option-Command-T); not kept across a reload. Find brings it back |
| Customize Toolbar… | Toolbar | built-unchecked | A sheet of a check box per item, as Mail's: each comes out at once, kept in the settings, with Use Default Set. A Mac drags icons from a palette; here they are checked. Journey: Rotate came out and Use Default Set brought it back. Find brings back a search field taken out |
| Enter Full Screen (Control-Command-F) | Standard | built-unchecked | Shared row |

## Go menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Previous (Command-Up) | Pages or files in a window | done | Pages of a PDF, row and key; among pictures sharing a window, the files, row and key (unit test). [Screenshot](#project-artifact/art_3e7ee16bed9df50f/34) |
| Next (Command-Down) | Pages or files in a window | done | Pages of a PDF, row and key; the same among pictures sharing a window. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/34) |
| Page Up | Moves | done | A page at a time, row and key. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/34) |
| Page Down | Moves | done | A page at a time, row and key. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/34) |
| Home | Moves | done | Row and key. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/34) |
| End | Moves | done | Row and key. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/34) |
| Go to Page… (Option-Command-G) | Sheet | done | Refuses a page the PDF does not have; the row ran in a browser, the key in a unit test. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/33) |
| Back (Command-[) | History | done | The pages gone to in this document; scrolling is not counted. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/34) |
| Forward (Command-]) | History | done | The row ran in a browser, the key in a unit test. [Screenshot](#project-artifact/art_3e7ee16bed9df50f/34) |

## Tools menu

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Text Selection | Selects PDF text | built-unchecked | Puts the markup bar away, so the pointer selects the PDF's text; dimmed for a picture |
| Rectangular Selection | Selects an area | built-unchecked | Tools row and the Markup toolbar, for a picture's crop; dimmed for a PDF, saying why |
| Elliptical (pictures) | Selections | built-unchecked | Tools row and markup bar: Crop keeps the oval, the rest transparent (white in a JPEG), read back from the canvas in the journey |
| Lasso (pictures) | Selections | built-unchecked | Tools row and markup bar: a free outline, cropped the same way. Unit test only |
| Smart Lasso (pictures) | Selections | built-unchecked | Tools row and markup bar: a loop drawn round a thing is drawn in to its edge, the strongest change of light within 4% of the picture on either side of the line (`preview-lasso.ts`), and cropped as the lasso is. A Mac paints a thick band to show where it looks; here the loop is a thin dashed line. Unit test: a loop round a black square lands on its edges, one with no edge near it stays where it was drawn; the journey drew it, no pixel was read |
| Annotate ▸ Highlight Text (Control-Command-H) | Coloured highlight | done | Row and key: the text selected, on as many pages as it runs over, or with nothing selected what is dragged over next. Multiplied, so the words stay dark, in the colour last chosen in the toolbar's menu; kept with the markup and drawn into an exported PDF. [shot](#project-artifact/art_a7e016210b9b9bc1/361) |
| Annotate ▸ Underline | Text marks | done | Underline Text: a red line at the foot of the words, the same way. [shot](#project-artifact/art_a7e016210b9b9bc1/362) |
| Strikethrough | Text marks | done | Strikethrough Text: a red line through the words, the same way. [shot](#project-artifact/art_a7e016210b9b9bc1/362) |
| Annotate ▸ Note (Control-Command-N) | Yellow note | done | Row, key and a Note tool in the markup bar: a click places it and opens it to write; pressing its icon opens it again, also with the bar hidden. An exported PDF has the icon only, as its pages are pictures: what it says stays beside the file. A note attached to selected text is not done. [shot](#project-artifact/art_a7e016210b9b9bc1/364) |
| Annotate ▸ Rectangle | Shapes | built-unchecked | Tools > Annotate and the Markup toolbar's Shapes menu; the row shows the bar with the tool chosen |
| Oval | Shapes | built-unchecked | Tools > Annotate and the Shapes menu |
| Line | Shapes | built-unchecked | Tools > Annotate and the Shapes menu |
| Arrow | Shapes | built-unchecked | Tools > Annotate and the Shapes menu |
| Annotate ▸ Star | Shapes | built-unchecked | Tools > Annotate and the Shapes menu: moved and resized as a sketch, with Fill Color. The journey stored one filled through the server |
| Polygon | Shapes | built-unchecked | The same, six sided, with Fill Color. Chosen, it has a blue handle on each corner and a green one across its middle for 3 to 12 sides; the server keeps `sides`. `preview-books-batch4-journey` asked for twelve and moved one corner, across a reload |
| Speech Bubble | Shapes | built-unchecked | The same, with Fill Color, asking at once for what it says, which is kept in the bubble, wrapped to it, and moves and resizes with it; double-click to change it. `preview-books-batch4-journey` read it back from the server after a move |
| Mask | Shapes | built-unchecked | Tools > Annotate and the Shapes menu: the page dimmed outside its box; chosen on a picture, Crop keeps its box and uses it up, as one change. Unit test and journey (stored by the server) |
| Loupe | Shapes | built-unchecked | Tools > Annotate and the Shapes menu: the page magnified inside its oval, on the page, in a thumbnail, and in what Save and Export draw. A green handle across its middle sets 1 to 5 times, kept by the server (`preview-books-batch4-journey`). It does not magnify a highlight, which stands on a canvas of its own |
| Annotate ▸ Text (Control-Command-T) | Text box | built-unchecked | Tools > Annotate, its key and the Markup toolbar |
| Annotate ▸ Sign | Signature | built-unchecked | Tools > Annotate > Signature and the Markup toolbar |
| Show Inspector (Command-I) | Inspector | built-unchecked | See Inspector |
| Rotate Left (Command-L) | Rotates | built-unchecked | A picture; of a PDF, the pages chosen in the sidebar, or the page shown |
| Rotate Right (Command-R) | Rotates | built-unchecked | The same. The journey turned page 1 alone and read it back from the server and across a reload |
| Flip Horizontal | Flips a picture | done | Flips what the window shows, turned or not, with its marks; dimmed for a PDF (not run on a PDF); Undo takes it back and Save draws it in, read back from the file [shot](#project-artifact/art_a7e016210b9b9bc1/282) |
| Flip Vertical | Flips a picture | done | Same; a text typed on a flipped picture reads rightly, and keeps that it was typed mirrored [shot](#project-artifact/art_a7e016210b9b9bc1/283) |
| Crop (Command-K) | Crops | built-unchecked | Picture only; a PDF page crop is absent |
| Assign Profile… (Option-Command-C) | Colour tools | built-unchecked | Dimmed with its reason: a browser draws in the display's colours and cannot change a picture's profile |
| Adjust Color… (Option-Command-C) | Colour tools | built-unchecked | Row and key: a panel with the picture's levels and Exposure, Contrast, Highlights, Shadows, Saturation, Temperature, Tint, Sepia and Sharpness, drawn as they move and written by Save and Export; Auto Levels and Reset All; one change to Undo. Dimmed on a PDF, saying why. The journey read the canvas's pixels change |
| Adjust Size… | Sheet | built-unchecked | Fit into, width and height in six units, resolution, Scale proportionally, Resample image and the resulting size; a resolution is written into a saved PNG or JPEG. The journey saved a width and read it back |
| Show Magnifier (backtick) | Loupe | built-unchecked | Row and key: a round lens over the pointer, 2.5 times the page, its highlights and marks |
| Add Bookmark (Command-D) | Bookmark | built-unchecked | Row and key; the row reads Remove Bookmark on a page that has one. Dimmed on a picture, saying why |

## Window and Help menus

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Minimize | Standard | built-unchecked | Shared rows |
| Zoom | Standard | built-unchecked | Shared rows |
| Bring All to Front | Standard | built-unchecked | Shared rows |
| window list | Standard | built-unchecked | Shared rows |
| Merge All Windows | Tabs | built-unchecked | Dimmed with its reason: windows on this desktop have no tabs. Above the shared rows, where the menu bar puts an app's own |
| Move Tab to New Window | Tabs | built-unchecked | Dimmed with its reason, the same |
| Preview Help | Help Viewer | built-unchecked | The menu bar's own row opens Help Viewer (`requestHelp` in `desktop-menus.tsx`) where the desktop has it; the map's note that it was "not part of this demo" holds only where it does not. Nothing in this batch ran it |

## Toolbar

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| View pull-down | Sidebar and display choices | built-unchecked | Hide Sidebar, Thumbnails, Table of Contents, Highlights and Notes; Continuous Scroll, Single Page, Two Pages, Contact Sheet; Actual Size, Zoom to Fit |
| Zoom Out | Pair | built-unchecked | |
| Zoom In | Pair | built-unchecked | |
| Open… | Not in the real toolbar | built-unchecked | Deliberate extra |
| Share | Mail, Messages, AirDrop, Notes | built-unchecked | The share glyph's pull-down has the shared Share rows above Save, Export, Recents, Download as, Revert Edits and Remove All Markup |
| Highlight (split button with colour) | Highlights text | done | The button marks what is selected or turns on marking by dragging; its menu takes Yellow, Green, Blue, Pink, Purple, Underline and Strikethrough, and changes a chosen mark. Colours other than Pink and Yellow were not pressed in the journey. [shot](#project-artifact/art_a7e016210b9b9bc1/362) |
| Rotate Left | Rotates | built-unchecked | |
| Rotate Right | Rotates | built-unchecked | |
| Show Markup Toolbar | Toggles | built-unchecked | |
| Show Inspector | Toggles | built-unchecked | |
| Search field | Finds in a PDF | built-unchecked | Finds words on pages |
| Customize Toolbar | Sheet | built-unchecked | See View > Customize Toolbar… |
| Title bar: proxy icon | Title | built-unchecked | Pressed and moved, the icon drags the file to whatever takes it on the desktop. Unit test: the drag starts; dropping it elsewhere was not run |
| rename in title | Title | built-unchecked | A chevron beside the title opens a pop-over: Name (Return renames) and Where (moves). The window's accessible name also reads "Title Menu", as the chevron is in the title |
| page count | Title | built-unchecked | Icon, name, page and Edited show, with the pop-over above |
| "Edited" | Title | built-unchecked | Icon, name, page and Edited show, with the pop-over above |

## Markup toolbar

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Select | Chooses, moves | built-unchecked | |
| Resize a chosen mark by handles | Handles | built-unchecked | Round handles on a chosen mark: a line's two ends, the corners of a box, a sketch or a signature, scaling what it holds; a text scales in proportion. A mark on text and a note's icon have none. One change to Undo. Marks keep to one chosen at a time |
| Sketch | Freehand with cleanup | built-unchecked | Freehand; a line nearly straight, or drawn round a box or an oval, becomes that shape, and Undo gives back the line as drawn. A Mac offers a palette of what it thinks it is; here it is the nearest |
| Draw (trackpad) | Pressure | built-unchecked | Dimmed tool with its reason: a web page cannot read a Force Touch trackpad's pressure |
| Shapes | Menu | built-unchecked | Line, Arrow, Rectangle, Oval, Star, Polygon, Speech Bubble, Mask and Loupe, each as its own row says |
| Text | Edit with double click | built-unchecked | Ledger item on turned pages |
| Sign | Trackpad, camera, list | built-unchecked | Trackpad and Camera in Create Signature; both go to one list, up to ten kept per person. Camera asks with `getUserMedia`, shows the picture with a line to hold the writing on, and thresholds a frame against the paper around it, thins it and traces it to strokes, shown as it reads; Done keeps what it reads. A refused or missing camera says why, and Trackpad still works. `e2e/preview-photos-batch9-journey.mjs` reads the signature from the server across a reload; `preview-signature-camera.test.ts`. Stand-in: Chromium's fake camera playing a Y4M of ink on paper, not a lens and a real sheet. A Mac's iPhone tab is absent |
| Crop | Picture tools | built-unchecked | |
| Adjust Size | Picture tools | built-unchecked | |
| Adjust Color | Sliders | built-unchecked | The markup bar's button for the panel above, on a picture |
| Shape Style | Line width, arrow ends, dashes, shadow | built-unchecked | Line width, Solid, Dashed or Dotted, No Arrows, Arrow at End, at Start or at Both Ends, and Shadow, for the next mark and the ones chosen, kept across a reload. The journey stored dashes, a shadow and both arrow heads through the server. A menu's rows here; a Mac draws them as pictures in a pop-over |
| Border Color | Palette | built-unchecked | The fixed colours, and Show Colors… for the browser's colour chooser; kept across a reload |
| Fill Color | Palette | built-unchecked | The same |
| Text Style | Fonts, sizes, colours, alignment | built-unchecked | Size, colour, System Font and five named fonts, Bold, Italic, Underline and alignment, for the next text and the texts and bubbles chosen, kept across a reload; the box measured again in a new font. Shift-Return starts a line. `preview-books-batch4-journey` read bold, italic and underline from the server. Show Fonts opens the desktop's Fonts panel: any family this computer has, typeface and underline; `rows-batch25-journey` chose Arial and read `font: Arial` from the stored mark. Limits: the panel's size and colour do nothing here, as the menu's rows set those; a family the browser showing it later lacks falls back on the system's |
| Undo button | Not in the real bar | built-unchecked | Deliberate |
| Delete | Key handling | built-unchecked | |
| Escape | Key handling | built-unchecked | |

## Sidebar

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Thumbnails with markup | List | built-unchecked | |
| Choose a page | Scrolls | built-unchecked | |
| Scrolling moves the selection | Follows | built-unchecked | |
| Search results by page with snippets | List | built-unchecked | Counts and words around the first match |
| Search sort by page or matches | Scope bar | built-unchecked | Search Rank and Page Order in the served find bar; Next and Previous follow the order listed |
| Multi-select pages | Shift and Command | done | Command-click ran in a journey; Shift-click is the list's own and was not pressed [shot](#project-artifact/art_a7e016210b9b9bc1/297) |
| Reorder pages by dragging | Moves | done | A drag of real pointer moves, with a line where they will land; the marks of a page go with it. The order is kept beside the file with its markup, as on a Mac it would be written into the file, and Export writes it [shot](#project-artifact/art_a7e016210b9b9bc1/296) |
| Delete pages (Delete) | Removes | done | The key, Edit's row and the thumbnail's menu; Undo brings them back, and a PDF keeps at least one page [shot](#project-artifact/art_a7e016210b9b9bc1/297) |
| Drag pages between documents | Combines | built-unchecked | Each file has a window of its own, with the file's id kept under its window's id so both come back after a reload. A drag of thumbnails onto another Preview window's thumbnails marks where it will land, with a line, and inserts a new PDF of those pages (pdf.js, with their text, `extractionParts`) after that row; the source keeps its pages. Let go elsewhere, it goes to whatever takes a file there, Finder and others keep it. `e2e/preview-books-batch14-journey.mjs`, Chromium, real drive and pdf.js and the browser's drag: the line showed, the second PDF went from 2 pages to 3, its page 2 reads the first's words, and the windows came back across a reload. Limits: marks do not go with the pages, and the drag always copies, never moves |
| add a PDF by dropping | Combines | built-unchecked | A PDF on the thumbnails goes in after the row it is let go on, from the computer (unit test) or from Finder (not run), written as Insert > Page from File is |
| Rotate a single page | Selected only | built-unchecked | `turns` in the markup, one per page shown, following its page when it moves. Tools rows, keys, toolbar and the thumbnail's menu turn the pages chosen. The journey turned two pages and read them back from the server and across a reload. An exported PDF with a page turned is pictures |
| Several pictures in one window | Thumbnails of each file | built-unchecked | Pictures dropped together from the computer or Finder, or sent together by Finder, share the window: a thumbnail each in the sidebar (`preview-gallery.tsx`), a row or Go > Next and Previous shows another, asking about unsaved changes. Opening any other file ends it. Pictures chosen together in File > Open share it too: `e2e/desktop-batch3-journey.mjs`. Not kept across a reload |
| Contextual menu on thumbnails | Rows | built-unchecked | Rotate Left, Rotate Right, Insert Blank Page, Insert Page from File… and Delete; Delete and Rotate Left ran in a journey |

## Document area

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Draw pictures: PNG | Opens | built-unchecked | HEIC and TIFF stay in Quick Look |
| JPEG | Opens | built-unchecked | HEIC and TIFF stay in Quick Look |
| GIF | Opens | built-unchecked | HEIC and TIFF stay in Quick Look |
| WebP | Opens | built-unchecked | HEIC and TIFF stay in Quick Look |
| BMP | Opens | built-unchecked | HEIC and TIFF stay in Quick Look |
| SVG | Opens | built-unchecked | HEIC and TIFF stay in Quick Look |
| AVIF | Opens | built-unchecked | HEIC and TIFF stay in Quick Look |
| Draw PDF pages through pdf.js when near the view | Opens | built-unchecked | |
| Text selection on a PDF | Selects | done | Drag across the text with the markup bar hidden, or Select All for the page [shot](#project-artifact/art_3e7ee16bed9df50f/55) |
| Copy from a PDF | Selects | done | Edit > Copy and Command-C put the selected text on the clipboard [shot](#project-artifact/art_3e7ee16bed9df50f/55) |
| Search highlights on the page | Yellow marks | done | Every place found on a page, in `--mac-preview-highlight-green`, the colour measured in the Dark Search capture, not yellow. Next and Previous still go by page, so no one match is marked as current. [shot](#project-artifact/art_a7e016210b9b9bc1/365) |
| PDF form filling | Fields | built-unchecked | Text fields, check boxes, radio buttons and choices over their places on the page, with the markup bar put away; Save writes them into the file with pdf.js and shows the new file, the old one going to the Trash. The journey filled a text field and a check box of a real form and read both back from the new file. Radio buttons and choices ran in unit tests with a stand-in reader only. On a turned page a field stands where it should, its text upright |
| Links in a PDF | Follow | built-unchecked | Read from the file by pdf.js: a press goes to the page, or opens the address on the desktop; they give way while the markup bar is shown. The journey pressed a link to a page and saw one to an address |
| Contextual menu on the page | Rows such as Zoom, Copy, Annotate | built-unchecked | Zoom In, Zoom Out, Actual Size, Zoom to Fit, Copy; for a PDF, Highlight, Underline and Strikethrough Text and Add Note |
| Pinch zoom | Gesture | built-unchecked | A pinch as browsers send it, a wheel with Control held, and Safari's gesture events; those were not run on a real trackpad |
| Unsaved changes alert | Save, Don't Save, Cancel | built-unchecked | |
| Errors | Alert | built-unchecked | |

## Inspector

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| General Info | Name, kind, size, dates, dimensions or pages | built-unchecked | First of the Inspector's tabs |
| More Info: EXIF | Tabs per format | built-unchecked | A JPEG's camera, lens, date, ISO, aperture, exposure and focal length, read with Photos' `readExif`, on one tab; says so when a picture has none |
| GPS | Tabs per format | built-unchecked | A JPEG's latitude and longitude, in More Info |
| Keywords | Add and remove | built-unchecked | A tab of its own: a list, a field, Add and Remove, one change to Undo, kept with the markup beside the file (`keywords`), as a Mac writes them into the file; a picture saved or duplicated keeps them. The journey read one back from the server. Not written into an exported copy |
| Annotations list | List | built-unchecked | Every mark by page; a row goes to its page and chooses it |
| Encryption (PDF) | Password | built-unchecked | A tab for a PDF: whether it is locked, by what, and what its lock lets a reader do, as pdf.js reads them; Set Password… is dimmed with its reason, as pdf.js cannot write a locked PDF. The journey saw an unlocked file; a locked one's rows ran in a unit test with a stand-in reader |
| Crop values | Tab | built-unchecked | For a picture: the selection's or the picture's left, top, width and height, typed with Return, in six units |

## Drag and drop

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Drop a file on the window or Dock tile | Opens | built-unchecked | A picture or PDF dragged from Finder or the desktop onto the window; of several, the first opens and a note says so. A file from the computer is copied to the drive (Pictures, or Documents for a PDF) and opened: the journey dropped one. A PDF dropped on the Dock tile opens too [Screenshot](#project-artifact/art_3e7ee16bed9df50f/58). [Screenshot](#project-artifact/art_3e7ee16bed9df50f/35) |
| Drag a picture onto a PDF's thumbnails | Inserts | built-unchecked | As a page, after the row it is let go on, written as Insert > Page from File is; the picture path ran in no browser, and a drag from Finder in neither |
| Drag a selection out to Finder or another app | Copies | built-unchecked | A press inside a picture's selection, with its tool in hand, drags a PNG of it, with its marks, to whatever takes a file there. The journey dragged one onto the desktop and read the new file from the drive; a drop on a Finder window or another app was not run |
| Drag the proxy icon | File drag | built-unchecked | See Toolbar, Title bar: proxy icon |

## Multi-selection

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Several marks | Shift-click, rectangle | built-unchecked | Shift-click adds or takes out, a rectangle dragged from empty paper chooses what it touches; they move, recolour, restyle, delete, cut, copy and paste together, one change to Undo. One alone shows its handles. Unit tests |
| Several pages | Sidebar | done | See Sidebar [shot](#project-artifact/art_a7e016210b9b9bc1/297) |

## Saved state

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Reopens the last document where it was left | Resume | built-unchecked | Saved places through `useServerState` |
| Places: page and zoom per file | Remembers | built-unchecked | |
| Markup beside the file | Written into the file on a Mac | built-unchecked | `/api/preview/markup/<file id>`; export writes it in |
| per person | Written into the file on a Mac | built-unchecked | `/api/preview/markup/<file id>`; export writes it in |
| Signatures | Kept | built-unchecked | `/api/preview/signatures` |
| at most ten | Kept | built-unchecked | `/api/preview/signatures` |
| Sidebar settings across a reload | Remembers | built-unchecked | Which sidebar a PDF opens with and its width, in the desktop's settings; the journey reloaded and read it back |
| Tool settings across a reload | Remembers | built-unchecked | Line width, line style, shadow, arrow ends, border and fill colours, text size, font and alignment, in the desktop's settings. The Highlight menu's choice is not kept |
| Trash puts a replaced picture back with its markup | Version of Mac behaviour | built-unchecked | `preview.mdx` |

## Cross-app

| Item | Real app | Status | Main at e62c2ac9 |
| --- | --- | --- | --- |
| Open a picture or PDF from Finder | Opens in Preview | built-unchecked | `appForFile` and `onOpenFileRequest` |
| Recents in Finder | Lists | built-unchecked | Marks a file opened |
| Export to the drive appears in Finder | Shows | built-unchecked | |
| Download | Browser save, not on a Mac | built-unchecked | Deliberate |
| Share to Mail | Attaches | built-unchecked | File > Share and the toolbar's pull-down use the shared `FileShareItems`, and Mail's descriptor takes shared files. Add to Photos ran; this row was not pressed |
| Messages | Attaches | built-unchecked | The same; not pressed |
| Notes | Attaches | built-unchecked | The same; not pressed |
| Copy a picture | Clipboard | built-unchecked | See Edit > Copy |
| paste elsewhere | Clipboard | built-unchecked | A PNG on the system clipboard, read back by New from Clipboard; Edit > Copy of a picture or its selection pastes into a note, a New Message and a conversation in Messages: `e2e/preview-photos-batch9-journey.mjs`, Chromium |
| Open With another app | Finder's row | built-unchecked | Finder's Open With (File, contextual and Action menus) lists Preview for a picture or PDF, beside the other apps that take it (Books for a PDF), and opens it here; a Mac's Preview has no such row of its own, so nothing is added to it. `e2e/books-pictures-batch6-journey.mjs` |
| Spotlight finds PDFs by text | Results | built-unchecked | When Preview opens a PDF it gives the first 4,000 characters of its text, read with pdf.js, to Spotlight's index for that file (`POST /api/spotlight/pdf-text`), and Spotlight and Finder's Contents search find it by those words. The server cannot read a PDF itself, so one not yet opened here is found by its name alone, and a PDF opened with a password keeps its words to itself. `e2e/cross-batch7-journey.mjs`, `preview-spotlight.test.ts` |

## Calls made

- **Hardware rows.** Scanner, camera, iPhone import and camera signature stay dimmed with a reason, except signature by camera, which `getUserMedia` could supply; that goes last.
- **PDF writing.** Export keeps today's flattened JPEG pages until an item writes real PDF structure; a real PDF library is allowed through `pdfjs-dist`'s sibling or an equivalent, and needs the size gate kept.
- **Tabs.** Windows on the desktop do not have tabs anywhere, so Show Tab Bar stays dimmed with a reason.
- **Rows kept that the real app lacks:** Open… in the toolbar, Download as, and Undo in the markup bar.

## Build items, most used first

Each item lands as small reviewed commits on main, with its rows moved to done only with a screenshot from the running desktop.

1. **Check what is built.** Walk every built-unchecked row in Chromium, with screenshots, and fix or downgrade what fails. Reproduce the text on turned pages from the ledger and fix it.
2. **Menus and keys pass.** Edit menu with Undo, Redo and Delete working from the row; Find rows and keys; Go menu with Previous, Next and Go to Page; move Show Markup Toolbar to View; add Annotate to Tools.
3. **Drop to open and several files.** Drop on the window (from the computer now, from Finder once the shared drag lands), several pictures in one window with a thumbnail each.
4. **PDF pages.** Multi-select, reorder, delete, rotate one page, insert a file or blank page, combine by dropping, saved as a new PDF.
5. **Text in a PDF.** Text layer: selection, Copy, Highlight, Underline, Strikethrough, Notes, the toolbar's Highlight, Highlights and Notes sidebar, highlighted search results.
6. **Display modes.** Single Page, Two Pages, Contact Sheet, Table of Contents, Bookmarks, Slideshow.
7. **Markup depth.** Resize handles, Star, Polygon, Speech Bubble, Mask, Loupe, fonts and alignment, line styles, colour picker, several marks selected.
8. **Picture tools.** Flip, selection shapes, Adjust Color, a full Adjust Size sheet, Copy and Paste of a selection, New from Clipboard.
9. **Save and export depth.** Duplicate, Rename, Move To, Revert To with kept versions, Export options, PDF forms, Enter Password, encryption.
10. **Inspector tabs.** More Info, Keywords, Annotations, Encryption, Crop.
11. **Share and print.** Share through the shared sheet, Print, Take Screenshot.
12. **Preferences, Help, saved settings.** Preferences window, Help pages, sidebar and tool settings across a reload.
