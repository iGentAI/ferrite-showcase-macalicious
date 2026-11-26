# Feature inventory: Automator

Main commit read: `e62c2ac9`, from GitHub only. Nothing was built or run.

Status: **missing**; **partial** (the note says what is absent); **built-unchecked** (in main's code, not yet seen running); **done** (ran in a real Chromium in `e2e/automator-depth-journey.mjs`, and the linked screenshot, a version of the library document Screenshots: TextEdit, shows it). Keys were pressed as Control in that browser, which reads Command as Control. Every other status rests on main's source; a menu row's status includes its key equivalent. Scope is the hosted Ferrite desktop (`ServedAutomator`), not the invented-actions docs demo. Real-app wording and keys come from knowledge of macOS 10.15 (no Mac, no capture of these menus) and are provisional. Services, Open Recent and the window list are generated lists, so each is one row.

Read: `demos/automator/` (`app.ts`, `automator.mdx`, `automator-desktop.tsx`, `automator-data.ts`, first part of `automator-server.ts`), `automator/actions.rs` whole, `reference/spec/apps/automator.md`, `demos/desktop/desktop-menus.tsx`, the desktop README. The desktop registers **Workflow** with one row, Run; "Shell" means the desktop's own row. `app.ts` says the served app "schedules" workflows, which is stale: `WorkflowKind` is workflow, quick-action, application, folder-action, calendar-alarm and dictation-command, and the server runs each only when a request starts it (`automator-background.ts` is what starts the others).

**Scope exception for step 1:** this inventory does not list every real action of the 10.15 library. It lists the 34 names the capture shows and keeps the others it names labelled provisional. Build item 11 completes the list once a verifiable source exists. No rows are invented to fill it.

## Menus

| Menu | Item | Key | Status | Notes |
| --- | --- | --- | --- | --- |
| Automator | About Automator | | built-unchecked | Shell |
| Automator | Preferences… | ⌘, | partial | Shell dims it, and rightly: Automator has nothing to set here that its View and Window menus do not already set, and a window of invented settings would be fake |
| Automator | Services | | built-unchecked | The shell's generated list (`desktop-menus.tsx`): every service of the desktop applies to text selected in Automator's fields. Corrected: this row said none was there. Not driven in Automator itself |
| Automator | Hide Automator | ⌘H | built-unchecked | Shell |
| Automator | Hide Others | ⌥⌘H | built-unchecked | Shell |
| Automator | Show All | | built-unchecked | Shell |
| Automator | Quit Automator | ⌘Q | built-unchecked | Shell |
| File | New | ⌘N | done: [file](#project-artifact/art_6a3da0a5b88d531a/83) | Key by unit test |
| File | Open… | ⌘O | done: [sheet](#project-artifact/art_6a3da0a5b88d531a/83) | A sheet of the saved workflows |
| File | Open Recent | | done: [step menu](#project-artifact/art_a7e016210b9b9bc1/372) | The last ten opened or saved, kept among the person's values; a deleted one leaves it, Clear Menu empties it (`automator-rows-journey`) |
| File | Close | ⌘W | built-unchecked | Shell; save sheet |
| File | Save… | ⌘S | done: [file](#project-artifact/art_6a3da0a5b88d531a/83) | Saves on the server under the name in the bar |
| File | Duplicate | ⇧⌘S | done: [file](#project-artifact/art_6a3da0a5b88d531a/83) | |
| File | Rename… | | done: [file](#project-artifact/art_6a3da0a5b88d531a/83) | Gives the name field the keyboard |
| File | Move To… | | built-unchecked | As macOS, the document moves, saved first if it has changes: the Save dialog, then `<name>.workflow` in that folder, and a second Move To… moves the same file (with Where's home folders; the dialog's browser was not driven in this journey). The server's copy stays, since that is what a folder action, calendar alarm and Services row start, and `/api/automator/locations` records the file by id beside it. Each save writes the file again and renames it with the workflow; Finder opens it as that workflow. `automator-sql-move-journey` reads all of it back and has a folder action fire after the move, in Chromium, Firefox and WebKit (26 steps each). Calendar alarms and Services were not started after a move: they read the same stored library. A file in the Trash is forgotten at the next save, and a change made inside the file elsewhere does not reach the server's copy |
| File | Export… | | built-unchecked | The Save dialog, then `<name>.workflow` on the drive, the steps and settings as JSON (`automator-textedit-batch5-journey` reads the file back) |
| File | Revert To ▸ Last Saved | | done: [file](#project-artifact/art_6a3da0a5b88d531a/83) | |
| File | Revert To ▸ Browse All Versions | | built-unchecked | A sheet of the last 20 saves, kept by the server (`GET /versions/<id>`); Restore puts one in the window for you to save or leave (`automator-batch3-journey`, `runs.rs` tests). Not Time Machine's star field |
| File | Convert To… | | built-unchecked | The type sheet, the workflow's type chosen; Choose changes it in the window (unit test) |
| File | Share ▸ Mail | | built-unchecked | A New Message holding `<name>.workflow`, the steps and settings as JSON text; dimmed while the workflow has no steps. `mail-notes-batch4-journey`. Nothing on this desktop opens that file back into Automator yet (the Finder row below) |
| File | Share ▸ AirDrop | | partial | Dimmed with the desktop's AirDrop reason: nearby devices |
| File | Print… | ⌘P | built-unchecked | The workflow's steps and settings in the print frame; a spy stood for the browser's own dialog, which a page cannot drive (`automator-rows-journey`). Corrected: this row said partial, with nothing absent |
| Edit | Undo | ⌘Z | done: [edit](#project-artifact/art_6a3da0a5b88d531a/85) | Steps; the field's own in a text field |
| Edit | Redo | ⇧⌘Z | done: [edit](#project-artifact/art_6a3da0a5b88d531a/85) | Same |
| Edit | Cut | ⌘X | done: [edit](#project-artifact/art_6a3da0a5b88d531a/85) | Steps; the text in a field |
| Edit | Copy | ⌘C | done: [edit](#project-artifact/art_6a3da0a5b88d531a/85) | Same |
| Edit | Paste | ⌘V | done: [edit](#project-artifact/art_6a3da0a5b88d531a/85) | Same |
| Edit | Delete | ⌫ | done: [edit](#project-artifact/art_6a3da0a5b88d531a/85) | Same |
| Edit | Select All | ⌘A | done: [edit](#project-artifact/art_6a3da0a5b88d531a/85) | Same |
| Edit | Find ▸ Search Library | ⌥⌘F | built-unchecked: [search](#project-artifact/art_6a3da0a5b88d531a/82) | The row ran in the browser. The key by unit test only, because off a Mac Control-Option-F is the window manager's full screen and reaches it first. Corrected: this row said partial, with nothing absent |
| Edit | Speech ▸ Start Speaking | | built-unchecked | The text field's selection, or the steps' names, through the browser's speech. A spy stood for the voice, as headless Chromium has none. Corrected: this row said partial, with nothing absent |
| Edit | Speech ▸ Stop Speaking | | built-unchecked | |
| Edit | Start Dictation | | built-unchecked | The desktop's Edit footer: types what the browser's recognizer hears at the insertion point, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs`, in other apps, with a stub recognizer |
| Edit | Emoji & Symbols | ⌃⌘Space | built-unchecked | The shell's Edit footer opens the character viewer (`EditFooter`) |
| View | Show/Hide Library | ⌥⌘L | done: [after reload](#project-artifact/art_6a3da0a5b88d531a/86) | Kept across a reload |
| View | Show/Hide Log | ⌥⌘G | done: [after reload](#project-artifact/art_6a3da0a5b88d531a/86) | Kept across a reload |
| View | Variables | ⌥⌘V | built-unchecked | Shows the Variables pane under the workflow, or hides the pane while it shows (unit test) |
| View | Media Browser | | built-unchecked | A panel in the window that stays open beside the workflow, drawn for this desktop and not the Mac's floating panel: Audio, Movies and Photos on the drive by path, wherever they are, which includes the files Music and Photos keep there; Add to Workflow makes a Get Specified Finder Items step (`automator-textedit-batch5-journey`) |
| View | Show Toolbar | | done: [after reload](#project-artifact/art_6a3da0a5b88d531a/86) | Kept across a reload |
| View | Customize Toolbar… | | built-unchecked | A sheet: a checkbox per item, the flexible space among them, each row dragged or moved with its two buttons, Use Default Set; hidden items and order kept among the person's values (`automator.toolbarHidden`, `automator.toolbarOrder`), read from the server across a reload by `e2e/calls-batch10-journey.mjs`. The toolbar's context menu holds Hide Toolbar and Customize Toolbar…. A drag in the sheet was not driven, only the buttons. Items are not dragged on the toolbar itself |
| View | Enter Full Screen | ⌃⌘F | built-unchecked | Shell |
| Workflow | Run | ⌘R | done: [workflow](#project-artifact/art_6a3da0a5b88d531a/87) | |
| Workflow | Step | ⌥⌘R | built-unchecked | Runs the next enabled action as one request and pauses; Run goes on from there. The reply now carries every item, up to 1 MB in a run, so a step hands on whole; past that it stops and says so, and a carried text over the 40 KB of a step's settings is refused and says so (`automator-page-apps.test.ts`; `automator-batch3-journey` proves the same hand-on with Run, not with the Step button) |
| Workflow | Stop | ⌘. | built-unchecked | Ends a stepped run between actions, and the log says before which (`automator.stepped-stop`). During Run it stays dimmed with its reason: the server runs that as a whole |
| Workflow | Record | ⇧⌘R | partial | Dimmed with its reason: a web page cannot see other applications |
| Workflow | Import Actions… | | partial | Dimmed with its reason: a web page cannot load an action bundle |
| Action | Ignore Input | | built-unchecked | A check mark; dimmed for a step whose action takes no input. The journey read its check but set the option with the step's checkbox; the server hands that step no items (`ignore_input`) |
| Action | Results | | done: [automator-step-parts.png](#project-artifact/art_a7e016210b9b9bc1/583) | Opens the part on the selected steps |
| Action | Options | | built-unchecked | Same; the row not chosen in the journey, the step's button was |
| Action | Disable / Enable | | done: [action](#project-artifact/art_6a3da0a5b88d531a/80) | |
| Action | Rename Action… | | built-unchecked | A sheet; the name is the step's head and its log's title, and goes with the saved step as a setting the actions do not read (`automator.rename-action`); empty goes back to the action's own |
| Action | Delete | | done: [action](#project-artifact/art_6a3da0a5b88d531a/80) | |
| Action | Collapse | | done: [action](#project-artifact/art_6a3da0a5b88d531a/80) | |
| Action | Expand | | done: [action](#project-artifact/art_6a3da0a5b88d531a/80) | |
| Action | Move Up | | done: [action](#project-artifact/art_6a3da0a5b88d531a/80) | |
| Action | Move Down | | done: [action](#project-artifact/art_6a3da0a5b88d531a/80) | |
| Window | Minimize | ⌘M | built-unchecked | Shell |
| Window | Zoom | | built-unchecked | Shell |
| Window | Bring All to Front | | built-unchecked | Shell |
| Window | Window list | | built-unchecked | Shell; one window |
| Help | Automator Help | | built-unchecked | Shell: opens Help Viewer on a search for the app |

## Toolbar and bar

| Item | Status | Notes |
| --- | --- | --- |
| Library | built-unchecked | |
| Media | built-unchecked | Opens the Media Browser (View > Media Browser; the journey drove the menu row, the census clicks this button) |
| Record | partial | Dimmed with its reason: a web page cannot see other applications |
| Step | built-unchecked | As Workflow > Step |
| Stop | built-unchecked | As Workflow > Stop |
| Run | built-unchecked | |
| Workflows pop-up | built-unchecked | Beside the real app's |
| New | built-unchecked | |
| Save | built-unchecked | |
| Delete | done: [step menu](#project-artifact/art_a7e016210b9b9bc1/372) | A question first, in `automator-rows-journey` |
| Status line | built-unchecked | |
| Name field | built-unchecked | |
| Type pop-up | partial | Workflow, Application, Quick Action, Folder Action, Calendar Alarm (`automator-types-batch6-journey`) and Dictation Command (`rows-batch17-journey`) save and run. Print Plugin and Image Capture Plugin stay dimmed, each with its reason as the option's title: a Print Plugin runs on the PDF of what is printed, and the browser's print dialog neither lists a plug-in nor gives a page that PDF; Image Capture runs the other, and this desktop has no Image Capture, and a page cannot reach a scanner or the pictures kept on a camera. Dictation Command is dimmed the same way where the browser has no recognizer |

## Library

| Item | Status | Notes |
| --- | --- | --- |
| Actions switch | built-unchecked | |
| Variables switch | built-unchecked | Date & Time, Locations, System, Text & Data, and User: Full name, Short name, Email address, read from Mail's `/me` when the window opens (`automator-batch3-journey`) |
| Search | built-unchecked | |
| Categories outline | built-unchecked | The real thirteen, in a scratch journey on the real server. The desktop's actions go where Automator keeps their kind: Notes and Stickies in Text, Reminders in Calendar, Messages in Internet, Appearance in Utilities (unit test) |
| Category Calendar | built-unchecked | |
| Category Contacts | built-unchecked | |
| Category Developer | built-unchecked | Convert CSV to SQL, and the rows it cannot run dimmed |
| Category Files & Folders | built-unchecked | |
| Category Fonts | built-unchecked | Activate Fonts and Add to Font Library run on Font Book's own files and library (`automator-textedit-batch5-journey`). Corrected: this row said a web page cannot install fonts, but Font Book installs them on this desktop |
| Category Internet | built-unchecked | Send Message, Display Webpages, and the rest dimmed with their reason |
| Category Mail | built-unchecked | New Mail Message, Add Attachments to Front Message, Send Outgoing Messages, Find Mail Items run; Get Selected Mail Items dimmed with its reason (`automator-batch3-journey`) |
| Category Movies | built-unchecked | Ask for Movies, Create Annotated Movie File (`rows-batch24-journey`), and the rest dimmed with their reason |
| Category Music | built-unchecked | Ask for Songs; Add Songs to Playlist dimmed |
| Category PDFs | built-unchecked | Every row runs: Combine PDF Pages, Extract PDF Text, Split PDF on pdf.js (`automator-batch3-journey`); Add Grid, Compress Images, Encrypt, Watermark (`automator-textedit-batch5-journey`); Apply Quartz Filter (`rows-batch24-journey`) |
| Category Photos | built-unchecked | Ask for Photos, Get Selected Photos Items (`open-items-batch6-journey`), and the rest dimmed with their reason |
| Category Text | built-unchecked | |
| Category Utilities | built-unchecked | |
| Most Used | built-unchecked | The actions the saved workflows and recent runs use, up to ten (unit test) |
| Recently Added | built-unchecked | Actions that came into the library in the last 30 days, from when the person's values first listed each (unit test). Empty until the library grows |
| Actions list | built-unchecked | |
| Description pane | built-unchecked | |
| Hide/show description | built-unchecked | |
| Double click adds a step | built-unchecked | |
| Return adds a step | built-unchecked | |
| Gear: Add to Workflow | built-unchecked | |
| Gear: Clear Workflow | built-unchecked | |

## Workflow and lower pane

| Item | Status | Notes |
| --- | --- | --- |
| Step: text setting | built-unchecked | |
| Step: pop-up setting | built-unchecked | |
| Step: checkbox setting | built-unchecked | |
| Step: code setting | built-unchecked | |
| Enabled checkbox | built-unchecked | |
| Remove step | built-unchecked | |
| Results disclosure | built-unchecked | Item count and every item of a run from this window, up to 1 MB in a run; the first five of a run opened from Runs or after a reload, as the kept log holds them. List and Table, kept among the person's values (`automator.resultsTable`): `e2e/calls-batch10-journey.mjs` drives the table with its items and reads the choice from the server across a reload; [earlier shot of the list](#project-artifact/art_a7e016210b9b9bc1/583) |
| Options disclosure | built-unchecked: [automator-step-parts.png](#project-artifact/art_a7e016210b9b9bc1/583) | Ignore this action's input and Show this action when the workflow runs, both kept with the workflow (unit test) |
| Input arrow | built-unchecked | An arrow in the gap above a step that takes the step before's output, named by both (unit test) |
| Output arrow | built-unchecked | Same arrow; none under a switched-off step or above a step that ignores its input |
| Show When Run | built-unchecked | A sheet of the step's settings before it runs, changed for that run only; Cancel stops the workflow (unit test) |
| Previous output as input | built-unchecked | `takes_input` |
| Up to 32 steps | built-unchecked | The server keeps 32 (`workflow.rs`, `a_workflow_may_be_as_long_as_a_full_library_can_store`; refused at 33 and read back at 32 in `e2e/books-text-batch8-journey.mjs`): 50 workflows of that length, with ordinary settings, still fit in one stored document of 200 KB. The window stops at the same 32 (`MAX_STEPS`, `automator-desktop.test.tsx`). No cap in the real app; this is the server's limit |
| Log | built-unchecked | |
| Run log per step | built-unchecked | |
| Runs list | built-unchecked | Read every 10 seconds |
| Open a run's log | built-unchecked | |
| Variables pane | built-unchecked | The third toggle under the workflow: each variable with its value now, kept per workflow among the person's values (unit test; seen in a scratch journey) |

## Document types and sheets

| Item | Status | Notes |
| --- | --- | --- |
| Workflow | built-unchecked | |
| Application | built-unchecked | A web page cannot make a real application, and the window says so. Saved with its type; File > Export… writes `<name>.app`, a file this desktop runs. `automator-types-batch6-journey` |
| Quick Action | built-unchecked | Saved with its type and what it receives: files or folders, text, or no input. `automator-types-batch6-journey`; the rows by input, unit test |
| Print Plugin | partial | Dimmed with its reason: it runs on the PDF of what is printed, and the browser's print dialog neither lists a plug-in nor gives a page that PDF |
| Folder Action | built-unchecked | Saved with its folder. It runs only while this desktop is open and signed in: the server has no event for a drive folder, and a page step needs a page. `automator-types-batch6-journey` |
| Calendar Alarm | built-unchecked | Saving adds an event with an alert to Calendar. It runs only while this desktop is open: the server has no event for it, and a page step needs a page. `automator-types-batch6-journey` |
| Image Capture Plugin | partial | Dimmed with its reason: Image Capture runs it, this desktop has no Image Capture, and a page cannot reach a scanner or the pictures kept on a camera. Corrected: this row said a page cannot reach a camera, but Photo Booth uses one |
| Dictation Command | built-unchecked | Saved and enabled, it runs when its name is said, in any case and with an end stop, through the recognizer Hey Siri uses, and only while this desktop is open; the note under the head says the browser may send what it hears to its maker. Other words run nothing, and with none enabled nothing listens. `e2e/rows-batch17-journey.mjs`, read back from the drive and the run log. Stand-in: a stub replaces the recognizer, so nothing was heard. The whole name only, as it is written: not a phrase inside a sentence |
| New document chooser | built-unchecked | File > New and ⌘N: a sheet of the eight types as radio buttons, Close and Choose (`automator.menu.new-chooser`). The window's own New button starts a workflow directly. Not the real app's icon grid |
| Save changes? sheet | built-unchecked | |

## Actions: what the desktop has

All 20 entries of `ACTIONS` in `actions.rs` (the table closes after `text.combine`), and Run JavaScript, the step the server adds beside them.

| Action | Status | Server name |
| --- | --- | --- |
| Get Notes | built-unchecked | `notes.list` |
| New Note | built-unchecked | `notes.make` |
| Find Reminders | built-unchecked | `reminders.list` |
| New Reminders Item | built-unchecked | `reminders.add` |
| Complete Reminders Item | built-unchecked | `reminders.complete` |
| Find Calendar Events | built-unchecked | `calendar.events` |
| New Calendar Event | built-unchecked | `calendar.add` |
| Find People in Contacts | built-unchecked | `contacts.find` |
| Get Stickies | built-unchecked | `stickies.list` |
| New Sticky Note | built-unchecked | `stickies.add` |
| Get Folder Contents | built-unchecked | `files.list` |
| Read Text Files | built-unchecked | `files.read` |
| New Text File | built-unchecked | `files.write` |
| Send Message | built-unchecked | `messages.send` |
| Change System Appearance | built-unchecked | `appearance.set` |
| Launch Application | built-unchecked | `app.open` |
| Get Specified Text | built-unchecked | `text.get` |
| Filter Items | built-unchecked | `text.filter` |
| Change Case of Text | built-unchecked | `text.case` |
| Combine Text | built-unchecked | `text.combine` |
| Run JavaScript | built-unchecked | `javascript.run` |

## Actions: the real library as captured

Every action the reference capture lists (`reference/spec/apps/automator.md`). The capture's list is alphabetical and stops at "Create Package".

| Action | Status | Notes |
| --- | --- | --- |
| Activate Fonts | built-unchecked | Takes the fonts of the input off Font Book's turned-off list, through its route; a file Font Book does not hold fails the step with why. `automator-textedit-batch5-journey` reads the list back from the server |
| Add Attachments to Front Message | built-unchecked | Attaches the input's files to the draft this run's last New Mail Message made (`automator-batch3-journey`) |
| Add Grid to PDF Documents | built-unchecked | A copy of each PDF with a grid over every page, its spacing and colour settings; the text stays text. `automator-textedit-batch5-journey` counts the lines through pdf.js; a locked PDF fails with why |
| Add Songs to Playlist | built-unchecked | Through Music's library document; makes the playlist if needed, adds a song not yet in the library, and a second run adds nothing twice (`automator-batch3-journey`) |
| Add to Album | built-unchecked | Through Photos' route; a file not in the library fails the step and says so (`automator-batch3-journey`) |
| Add to Font Library | built-unchecked | Copies each font of the input to Documents/Fonts, where Font Book reads it, after Font Book's checks; anything else fails the step. `automator-textedit-batch5-journey` reads the file from the drive |
| Apple Versioning Tool | partial | Listed, dimmed with its reason: a web page cannot start a program |
| Apply ColorSync Profile to Images | partial | Listed, dimmed with its reason: it needs the colour profiles macOS keeps and ColorSync's engine, and a web page has neither |
| Apply Quartz Composition Filter to Image Files | partial | Listed, dimmed with its reason: a Quartz Composer composition is a program only macOS can run |
| Apply Quartz Filter to PDF Documents | built-unchecked | A copy of each PDF through Black & White, Blue Tone, Gray Tone, Lightness Decrease, Lightness Increase, Sepia Tone or Reduce File Size. A tone is a blended cover over each page, so text stays text; Reduce File Size is Compress Images at Low. `rows-batch24-journey` reads each copy's colours and text through pdf.js, and the sepia page in Preview; poppler's `pdftoppm` drew the same colours from the copies. Absent: Create Generic PDF/X-3 Document, which needs an ICC output profile, and filters of the person's own. A link or form field's own appearance is not toned. A CMYK document is blended as its reader chooses, and was not tried |
| Apply SQL | built-unchecked | SQLite as WebAssembly (sql.js 1.15.2, MIT, in `demos/automator/vendor/`), 46 KB of script and 685 KB of wasm from the site's own assets, fetched when it first runs; the 22.3 MiB site still packs under the packer's limits. It runs on a SQLite file named by path: the input is the statements when SQL is empty, otherwise it fills each `?`, once per item (tabs part several values), and each row goes on as text, `\|`-separated or Comma Separated. `automator-sql-move-journey` reads a result from a file the next action wrote and the changed database through Python's own SQLite, in Chromium, Firefox and WebKit; a SELECT leaves the file's version alone. A call: all of a run's statements land together or none do, where the real action's `sqlite3` keeps those before a failure. Absent: the real action's Choose… for the database (a typed path) and its HTML and other result formats. A large database was not tried; it is read into memory whole |
| Ask for Confirmation | built-unchecked | A sheet; Cancel stops the workflow. Ran between server steps in a scratch journey on the real server |
| Ask for Finder Items | built-unchecked | The drive's Open dialog: several with Command or Shift, a folder, or the folder shown, added to the input. `e2e/desktop-batch3-journey.mjs` |
| Ask for Movies | built-unchecked | The Open dialog on the Movies folder, movies only, several at once, or with Show set to Media List every movie on the drive |
| Ask for Photos | built-unchecked | The Open dialog on the Pictures folder, pictures only, several at once (`e2e/desktop-batch3-journey.mjs`), or with Show set to Media List every picture on the drive, which holds the files Photos keeps (`automator-textedit-batch5-journey`). Not Photos' albums |
| Ask For Servers | partial | Listed, dimmed with its reason: a web page cannot see file servers |
| Ask for Songs | built-unchecked | The Open dialog on the Music folder, songs only, several at once, or with Show set to Media List every song on the drive, which holds the files Music keeps. Not Music's playlists |
| Ask for Text | built-unchecked | A sheet with the question, a default and Require an answer (unit test) |
| Burn a Disc | partial | Listed, dimmed with its reason: a web page cannot reach a disc drive |
| Change Type of Images | partial | PNG, JPEG, BMP and TIFF (the last two written byte by byte, since a canvas cannot; unit test of the bytes). As macOS, adding it asks about Copy Finder Items (Add puts that step before it, to the Desktop), and the new file takes the original's place. Unlike macOS, which overwrites it, the original goes to the Trash, recoverable, under a checkbox that starts on; a step saved before this keeps its setting. A file already of the type is handed on untouched. `automator-sql-move-journey` reads the BMP's size, the original whole in the Trash, and with Add the picture left in place; `mail-notes-batch4-journey` and `automator-batch3-journey` read the same (the latter passed its 19 steps in Firefox and WebKit too; WebKit's first run stopped once with the New sheet still open after Choose, not traced, and its second passed). Absent: JPEG 2000, which no browser's canvas writes and which Chromium and Firefox cannot show, so Preview here could not open the result |
| Choose from List | built-unchecked | A sheet of the input, of which the chosen go on (unit test); Allow several, not exercised |
| Combine PDF Pages | built-unchecked | pdf.js writes a new PDF of every page, read back with pdf.js: 3 pages (`automator-batch3-journey`) |
| Combine Text Files | built-unchecked | Reads each file of the input from the drive and joins them; a missing file fails with its name (unit test) |
| Compress Images in PDF Documents | built-unchecked | A copy of each PDF with its 8-bit RGB, gray and JPEG pictures as JPEGs, Low, Medium or High, where that is smaller; a mask or a CMYK picture stays as it is. `automator-textedit-batch5-journey`: 120760 bytes to 2399 |
| Connect to Servers | partial | Listed, dimmed with its reason: a web page cannot connect to file servers |
| Convert CSV to SQL | built-unchecked | INSERT statements for a named table; quoted fields, a header line (unit test) |
| Convert Quartz Compositions to QuickTime Movies | partial | Listed, dimmed with its reason: a Quartz Composer composition is a program only macOS can run |
| Copy Finder Items | built-unchecked | On the real drive in a scratch journey; hands on the copies; Replace, or a new name (unit test) |
| Copy to Clipboard | built-unchecked | Says so in the log when the browser refuses, as it can once a question has passed (unit test; a stub stood for the clipboard) |
| Create Annotated Movie File | built-unchecked | A copy of a QuickTime or MP4 movie with a title, author, description and copyright, written as `moov/udta/meta/ilst` items, with others it has kept and every sample at its offset (the new movie box goes at the end). `rows-batch24-journey` reads them with ffprobe and decodes every frame with ffmpeg; `automator-movie.test.ts` reads them with Music's tag reader. Corrected: this row said a browser cannot write them. A WebM fails the step and says why: only QuickTime's and MP4's boxes are written. Not opened in QuickTime Player itself. The real action's title slide and soundtrack are not written |
| Create Archive | built-unchecked | A zip on the drive through Finder's `zipBlob`, folders included. Not run: no unit test or journey made an archive |
| Create Banner Image from Text | built-unchecked | Draws text, its own or the input's, as a PNG on a canvas, with size, colour and background (`automator-batch3-journey`) |
| Create Package | partial | Listed, dimmed with its reason: a web page cannot start a program |

Change System Appearance, the capture's 34th, is in the table above.

## Actions: after the capture's list

Named from knowledge of 10.15 and **provisional**. This is not the full library: see the scope exception at the top. A search of GitHub and the web found no verifiable 10.15 catalogue, and no Mac is available.

| Action | Status |
| --- | --- |
| Watch Me Do | partial: listed, dimmed with its reason: a web page cannot see other applications |
| Loop | built-unchecked: Ask to Continue, or a number of times up to 100; with or without the results as input (unit test) |
| Get Value of Variable | built-unchecked: adds the value to the input; a name no variable has fails (unit test) |
| Set Value of Variable | built-unchecked: for the rest of the run, and in `{{name}}` of later settings (unit test) |
| New Mail Message | built-unchecked: saved in Mail's Drafts rather than opened in a window; the input's files are attached (`automator-batch3-journey`) |
| Send Outgoing Messages | built-unchecked: sends what this run's New Mail Message steps made, by account name; this desktop has no Outbox and no internet mail. A Guest User sends none, as in Mail (`automator-batch3-journey`) |
| Get Selected Mail Items | built-unchecked: each selected message's subject and sender from the Mail viewer that spoke last (`mail-selection.ts`); a run with nothing selected fails, saying so. `mail-notes-batch4-journey` |
| Find Mail Items | built-unchecked: text in the subject, sender or start of a message, in every mailbox or one, through every page of Mail's list (`automator-batch3-journey`) |
| Import Files into Photos | built-unchecked: a copy into the library through Photos' own import, with an optional album (`automator-batch3-journey`) |
| Get Selected Photos Items | built-unchecked: the drive files of the photos selected in the Photos window that spoke last (`photos-selection.ts`), which the album actions take as they are; a run with nothing selected fails, saying so. `open-items-batch6-journey` |
| New Photo Album | built-unchecked: through Photos' route, with the input's photos in it (`automator-batch3-journey`) |
| Get Current Webpage from Safari | built-unchecked: the active tab as Safari keeps it (`/api/safari/tabs`); the document does not say which window is in front (`automator-batch3-journey`) |
| Display Webpages | built-unchecked: tabs of a new Safari window through the desktop's effects; refuses what is not http or https (unit test) |
| Get Text from Webpage | built-unchecked: the sites Safari opens here, through its server route; another site fails the step with Safari's reason (`automator-batch3-journey`) |
| Download URLs | built-unchecked: the sites Safari opens here, up to 1 MB a file, into a folder of the drive; another site fails the step with Safari's reason (`automator-batch3-journey`) |
| Extract PDF Text | built-unchecked: saves each PDF's words as a text file, read back from the drive (`automator-batch3-journey`). Plain text only: not RTF |
| Split PDF | built-unchecked: one PDF for each page, read back with pdf.js (`automator-batch3-journey`) |
| Encrypt PDF Documents | built-unchecked: asks for the password twice, keeps it nowhere, and saves an AES-128 locked copy (revision 4 of the standard handler). `automator-textedit-batch5-journey`: pdf.js refuses another password and reads the page with this one. Not opened in a reader other than pdf.js |
| Watermark PDF Documents | built-unchecked: a picture from the drive on every page of a copy, with opacity, scale, angle, place and under-the-page settings. `automator-textedit-batch5-journey` counts the image through pdf.js |
| Rename Finder Items | built-unchecked: Add Text, Replace Text, Upper and Lower Case, Make Sequential; keeps the extension (unit test). Adding it asks about Copy Finder Items as Change Type of Images does: Add puts a copy to the Desktop before it and the copy takes the new name, Don't Add renames the file itself, read from the drive in `automator-sql-move-journey` (Chromium, Firefox, WebKit). Absent: Add Date or Time |
| Move Finder Items | built-unchecked: on the drive, Replace or a new name (unit test) |
| Get Specified Finder Items | built-unchecked: a path a line; its file items reached the server's Read Text Files on the real server in a scratch journey |
| Get Selected Finder Items | built-unchecked: what the Finder window that spoke last has selected on the drive, handed on as file items; says so when nothing is. `automator-types-batch6-journey` reads what the next step wrote from the drive |
| New Folder | built-unchecked: moves the input into it (unit test) |

## Context menus

| Where | Item | Status |
| --- | --- | --- |
| Library row | Add to Workflow | built-unchecked (`automator.library-menu`) |
| Library row | Find in Library | built-unchecked: clears the search and shows the action in its category (unit test) |
| Step | Disable | done: [step menu](#project-artifact/art_a7e016210b9b9bc1/372) |
| Step | Rename | built-unchecked: the Action menu's Rename Action… |
| Step | Delete | done: [step menu](#project-artifact/art_a7e016210b9b9bc1/372) |
| Step | Results | built-unchecked |
| Step | Options | built-unchecked |
| Step | Ignore Input | built-unchecked |
| Variable | Edit | built-unchecked: a sheet of name and value; also a double click (unit test) |
| Variable | Delete | built-unchecked (unit test) |
| Variable | New Variable… | built-unchecked (unit test) |

## Keys outside the menus

| Key | Status |
| --- | --- |
| Arrows in the outline | built-unchecked |
| Arrows in the list | built-unchecked |
| Type-select in the outline | built-unchecked |
| Arrows on a divider | built-unchecked |
| Return on the library divider | built-unchecked |
| Delete on a step | done: [edit](#project-artifact/art_6a3da0a5b88d531a/85) |

## Drag and drop, multi-selection

| Item | Status | Notes |
| --- | --- | --- |
| Drag an action to a place in the workflow | done: [drag](#project-artifact/art_6a3da0a5b88d531a/79) | Into the empty workflow, below, and before a step; several together |
| Reorder steps by drag | done: [several](#project-artifact/art_6a3da0a5b88d531a/81) | By the step's head; several together |
| Drop a file from Finder: Get Specified Finder Items | built-unchecked | The desktop's drag makes a step that names each file on the drive (unit test, through the drop target; not dragged in a browser) |
| Drag a variable into a setting | built-unchecked | Writes `{{name}}` into a text setting, which a run replaces with its value (unit test) |
| Select several actions in the library | done: [several](#project-artifact/art_6a3da0a5b88d531a/81) | Command-click; the description pane says how many |
| Select several steps | done: [several](#project-artifact/art_6a3da0a5b88d531a/81) | Command-click |

## Saved state

| Item | Status | Notes |
| --- | --- | --- |
| Saved workflows survive reload | built-unchecked | `/api/automator/workflows` |
| Conflict merge on save | built-unchecked | |
| Recent runs | built-unchecked | |
| Open workflow across a reload | done: [after reload](#project-artifact/art_a7e016210b9b9bc1/322) | `e2e/automator-draft-journey.mjs`; among the person's desktop values, so it follows them. Closing the window forgets it |
| Unsaved edits across a reload | partial: [after reload](#project-artifact/art_a7e016210b9b9bc1/322) | Steps, settings and the name, at each change, a reload straight after one included; a large workflow goes in pieces, up to about 60 KB. Absent: Undo's history. Past that size the last version that fit comes back and the window says so (unit test) |
| Window layout | built-unchecked: [after reload](#project-artifact/art_6a3da0a5b88d531a/86) | The library, the log and the toolbar's showing, and the sizes of the four panes: the log's came back after a reload in a scratch journey |

## Cross-app

| Item | Status | Notes |
| --- | --- | --- |
| Quick Action in Finder's context menu | built-unchecked | A Quick Actions row lists the saved ones that receive files, on Finder's context menu and Action pull-down, and runs on the selected items; a notification says how it went, and the run's log says Quick Action. `automator-types-batch6-journey` reads the result from the drive. Absent: a step that would ask the person fails the run and says so, since no Automator window is there to ask in |
| Quick Action in the Services menu | built-unchecked | The shell's Services list takes a Quick Action that receives files, with Finder in front and a selection (`automator-types-batch6-journey`, across a reload), one that receives text over selected text, and one that receives nothing always (unit test for these two) |
| Folder Action on a drive folder | built-unchecked | Runs when something arrives in the folder, and only while this desktop is open and signed in: the server has no event for a change in a drive folder, and a page step needs a page, so what arrives with no desktop open never starts it. The page hears the drive's changes, and the server's claim lets one tab or browser run each arrival. `automator-types-batch6-journey`: a file uploaded, the file it wrote read from the drive, a reload not running it again, and one run for the next file. Past 20 starts in a minute it stops and says so |
| Calendar Alarm from Calendar | built-unchecked | Saving adds an event at the next whole hour with an alert at its start through Calendar's route, and Calendar opens: move the event to say when. The workflow runs when the alert shows, once for each occurrence, and only while this desktop is open: the server has no event for it, and a page step needs a page. An alert that comes with no desktop open runs it when a desktop next opens, while the alert still shows. Deleting the workflow leaves the event. `automator-types-batch6-journey`, which moves the event through Calendar's route, not by dragging it |
| Saved application from the Dock | built-unchecked | The `.app` dragged from Finder to the Dock is a kept file tile, and a click runs it. A web page cannot make a real application: it runs on this desktop only, and takes no files dropped on it. `automator-types-batch6-journey`, across a reload |
| Saved application from Finder | built-unchecked | File > Export… writes `<name>.app`, and opening it from Finder runs it rather than opening it for editing, which Open With > Automator does. A web page cannot make a real application, and a Mac's `.app` is refused with that said. `automator-types-batch6-journey` |
| Finder opens a `.workflow` here | built-unchecked | `opens` in `app.ts`: the file File > Export… or File > Share > Mail writes opens as a new workflow, asking first over unsaved changes. A Mac's bundle is refused with why (unit test). `automator-textedit-batch5-journey` double-clicks it in Finder |
| Action opens an app | built-unchecked | Desktop effects |
| Action sets the appearance | built-unchecked | Desktop effects |

## Open work ledger

No open item for Automator.

## Calls made

- Run stays on the server. Step is one request per step, so Stop applies between steps. Record cannot watch real input and stays dimmed with a reason.
- Timed runs need a timers queue on the Ferrite app, so they stay a dependent item.
- Actions that need a real system (Burn a Disc, Create Package) stay dimmed with a reason. Apply ColorSync and the Quartz Composer actions join them: a page has no profiles or engine, and cannot run a composition.
- Apply Quartz Filter blends a cover over each page rather than re-rendering it through pdf.js into page pictures, so text stays selectable, links stay and files stay small, as the other PDF actions add to a page and never interpret it.
- Actions the page runs are saved as a Get Specified Text with a `page_step` setting, because the server refuses an action it does not have (`workflow.rs`), so nothing else can run them: a server run of one (Siri, say) fails on the missing text. A run with one goes in parts, one request between them, and only requests are rows in Runs.
- A library row lists what the server runs, then what the page runs, then what does not run, each by title, so the first screen of Library stays the rows that work.

## Build items, most used first

1. **Drag actions and steps.** Built, except a file dropped from Finder (item 9). Drag from the library to any position, reorder, several; Delete key.
2. **Menus with keys.** Built, for the rows above that say done. File, Edit (Undo, Cut, Copy, Paste steps), View, Workflow ⌘R, Action rows on the selected step.
3. **New document chooser.** Built: eight types, dimmed where not available; delete question.
4. **Step run: Step and Stop.** Built, with the arrows and Results from past runs. Left: the server's `input` for items that are not text.
5. **Options, Ignore Input, Show When Run, Rename Action, step context menu.** Built.
6. **Variables.** Library, lower pane, Set and Get, drag into settings; server support.
7. **Quick Actions.** Type, Services menu, Finder context menu. Needs Finder worker and the shell.
8. **Application workflows.** Saved app that runs when opened; Dock tile.
9. **Files.** `.workflow` on the drive, Open Recent, open from Finder, drop files; draft survives reload.
10. **Timed types.** Folder Action and Calendar Alarm once a timers queue exists.
11. **Library depth.** Complete the action list once a verifiable source exists; the thirteen categories, Most Used, Recently Added, Loop; the actions above that a browser can do.
12. **Help and docs.** Help opens Help Viewer; `app.ts` comment and `.mdx` agree.
