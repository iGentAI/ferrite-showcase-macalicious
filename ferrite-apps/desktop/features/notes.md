# Feature inventory: Notes

Main commit read: `e62c2ac9`, from GitHub only. Nothing was built or run.

Status: **missing**; **partial** (the note says what is absent); **built-unchecked** (in main's code, not yet seen running); **done** (seen working in a browser, its screenshot linked, from `e2e/notes-depth-journey.mjs`, all 17 steps with no console error). Every status rests on main's source; a menu row's status includes its key equivalent. Scope is the hosted Ferrite desktop. Real-app wording and keys come from knowledge of macOS 10.15 (no Mac, no capture of these menus) and are provisional. Services and the window list are generated lists, so each is one row.

Read: `demos/notes/` (`app.ts`, `notes.mdx`, `notes.tsx`, `notes-menus.tsx`, `notes-edit-menu.tsx`), `demos/desktop/desktop-menus.tsx`, `demos/spotlight/spotlight-desktop.tsx`, `e2e/notes-census-journey.mjs`, the desktop README. The desktop registers only **Edit** and **Format**; "Shell" means the desktop's own row. `notes.mdx`'s "Not built" list is out of date.

## Menus

| Menu | Item | Key | Status | Notes |
| --- | --- | --- | --- | --- |
| Notes | About Notes | | built-unchecked | Shell |
| Notes | Preferences… | ⌘, | done | [Preferences window](#project-artifact/art_778ce73f9cddf4bd/6): sort, new note start, text size; key not yet seen |
| Notes | Accounts… | | dimmed | The row's reason: Notes keeps its notes with the desktop account, and there is no other to add |
| Notes | Close All Locked Notes | | built-unchecked | Closes every open locked note and forgets the keys; dimmed with the reason while none is open. The toolbar's row driven in `e2e/notes-lock-batch13-journey.mjs`; this one by the same call, not driven |
| Notes | Services | | built-unchecked | Shell: No Services Apply, or for selected text Look Up, Open URL, Search the Web and New Note With Selection, which Notes now takes |
| Notes | Hide Notes | ⌘H | built-unchecked | Shell |
| Notes | Hide Others | ⌥⌘H | built-unchecked | Shell |
| Notes | Show All | | built-unchecked | Shell |
| Notes | Quit Notes | ⌘Q | built-unchecked | Shell |
| File | New Note | ⌘N | done | [New notes in the list](#project-artifact/art_778ce73f9cddf4bd/1) |
| File | New Folder | ⇧⌘N | built-unchecked | Sidebar button seen; menu row not |
| File | Share ▸ Mail | | built-unchecked | The note's text as a text file, with what is attached to it (`shareFiles`); Mail opens a new message with them |
| File | Share ▸ Messages | | built-unchecked | Same |
| File | Share ▸ AirDrop | | dimmed | The row's reason: AirDrop sends to nearby devices, which a web page can't reach |
| File | Share ▸ Reminders | | built-unchecked | A reminder titled with the note's first line, the rest in its notes, read from the server in `e2e/desktop-batch3-journey.mjs`; dimmed with the reason in an empty note. `notes-files.test.tsx` |
| File | Close | ⌘W | built-unchecked | Shell |
| File | Import to Notes… | | built-unchecked | Each picture or text file up to 50 KB becomes a note in the folder shown; an alert names any other file |
| File | Export as PDF… | | built-unchecked | Through the browser's print dialog |
| File | Pin Note | | built-unchecked | Context menu row seen |
| File | Lock Note | | built-unchecked | Remove Lock on a locked note. As the toolbar's row, which the journey drives. Dimmed with the reason for a note with attachments (their bytes aren't encrypted), a shared note, one in Recently Deleted, several selected, and where no server keeps it |
| File | Print… | ⌘P | built-unchecked | Browser's print dialog |
| Edit | Undo | ⌘Z | built-unchecked | |
| Edit | Redo | ⇧⌘Z | built-unchecked | |
| Edit | Cut | ⌘X | built-unchecked | |
| Edit | Copy | ⌘C | built-unchecked | |
| Edit | Paste | ⌘V | dimmed | Works where the browser lets a menu read the clipboard; where it refuses, dimmed with the reason on a row under it. The key always works |
| Edit | Paste and Match Style | ⌥⇧⌘V | built-unchecked | |
| Edit | Paste and Retain Style | | built-unchecked | Reads the clipboard's formatted text; dimmed where the browser refuses |
| Edit | Delete | | built-unchecked | |
| Edit | Select All | ⌘A | built-unchecked | |
| Edit | Attach File… | ⇧⌘A | built-unchecked | Any file up to 10 MB, kept on the server; a text file up to 50 KB becomes lines of the note; an alert names a larger file |
| Edit | Insert from iPhone or iPad ▸ Take Photo, Scan Documents, Add Sketch | | dimmed | Each row's reason: that needs an iPhone or iPad nearby, which a web page can't reach |
| Edit | Add Link… | ⌘K | built-unchecked | The sheet TextEdit has; on the selection, or as its own text at the insertion point |
| Edit | Find ▸ Find… | ⌘F | done | [Find bar, 1 of 1](#project-artifact/art_778ce73f9cddf4bd/4) |
| Edit | Find ▸ Find Next | ⌘G | built-unchecked | |
| Edit | Find ▸ Find Previous | ⇧⌘G | built-unchecked | |
| Edit | Find ▸ Use Selection for Find | ⌘E | built-unchecked | |
| Edit | Find ▸ Jump to Selection | ⌘J | built-unchecked | |
| Edit | Find ▸ Note List Search | ⌥⌘F | built-unchecked | Key only |
| Edit | Spelling ▸ Show Spelling and Grammar | ⇧⌘; | built-unchecked | The shared panel, with its word list |
| Edit | Spelling ▸ Check Document Now | ⌘; | built-unchecked | Selects the next word not in the list |
| Edit | Spelling ▸ Check While Typing | | built-unchecked | The browser's underlines; saved as `notes.spelling` |
| Edit | Spelling ▸ Check Grammar | | built-unchecked | The desktop's setting and rules, shared with TextEdit (`demos/desktop/text-grammar.ts`); proven in TextEdit's journey |
| Edit | Spelling ▸ Correct Automatically | | dimmed | The row's reason: nothing reads the sentence around a word |
| Edit | Substitutions ▸ Show Substitutions | | built-unchecked | The shared panel, with Replace All |
| Edit | Substitutions ▸ Smart Copy/Paste | | built-unchecked | Saved as `notes.substitutions`, as the four below. One Undo takes the paste and the space it adds, and one Redo brings them back (`editors-edit-journey`, `text-substitutions.test.ts`) |
| Edit | Substitutions ▸ Smart Quotes | | built-unchecked | |
| Edit | Substitutions ▸ Smart Dashes | | built-unchecked | |
| Edit | Substitutions ▸ Smart Links | | built-unchecked | |
| Edit | Substitutions ▸ Text Replacement | | built-unchecked | Keyboard's rules, through `data-text-replacement` |
| Edit | Transformations ▸ Make Upper Case | | built-unchecked | |
| Edit | Transformations ▸ Make Lower Case | | built-unchecked | |
| Edit | Transformations ▸ Capitalize | | built-unchecked | |
| Edit | Speech ▸ Start Speaking | | built-unchecked | `speechSynthesis`; dimmed without it |
| Edit | Speech ▸ Stop Speaking | | built-unchecked | |
| Edit | Start Dictation | | built-unchecked | The desktop's Edit footer: types what the browser's recognizer hears at the insertion point, dimmed with a reason with no field or no recognizer. `e2e/dictation-batch5-journey.mjs` writes into a note, with a stub recognizer, and reads it from the server |
| Edit | Emoji & Symbols | ⌃⌘Space | built-unchecked | Shell's character viewer |
| Format | Title | ⇧⌘T | built-unchecked | |
| Format | Heading | ⇧⌘H | built-unchecked | |
| Format | Subheading | ⇧⌘J | built-unchecked | |
| Format | Body | ⇧⌘B | built-unchecked | |
| Format | Monospaced | ⇧⌘M | built-unchecked | |
| Format | Bulleted List | ⇧⌘7 | built-unchecked | |
| Format | Dashed List | ⇧⌘8 | built-unchecked | Undo and Redo keep the list's kind too (`notes-list-history.ts`): `mail-notes-batch3-journey`, `notes-batch-three.test` |
| Format | Numbered List | ⇧⌘9 | built-unchecked | |
| Format | Checklist | ⇧⌘L | built-unchecked | [Checklist with a tick](#project-artifact/art_778ce73f9cddf4bd/2). Undo and Redo keep the list's kind, as Dashed List's: same test; Dashed List's driven in the journey, by the same code |
| Format | Mark as Checked | ⇧⌘U | built-unchecked | |
| Format | More ▸ Check All | | built-unchecked | |
| Format | More ▸ Uncheck All | | built-unchecked | |
| Format | More ▸ Move Checked to Bottom | | built-unchecked | |
| Format | More ▸ Delete Checked | | built-unchecked | |
| Format | Move List Item ▸ Up | ⌃⌘↑ | built-unchecked | |
| Format | Move List Item ▸ Down | ⌃⌘↓ | built-unchecked | |
| Format | Table | ⌥⌘T | built-unchecked | Add Table in the submenu |
| Format | Table ▸ Add Row Above | ⌥⌘↑ | built-unchecked | |
| Format | Table ▸ Add Row Below | ⌥⌘↓ | built-unchecked | |
| Format | Table ▸ Add Column Before | ⌥⌘← | built-unchecked | |
| Format | Table ▸ Add Column After | ⌥⌘→ | built-unchecked | |
| Format | Table ▸ Delete Row | | built-unchecked | |
| Format | Table ▸ Delete Column | | built-unchecked | |
| Format | Convert to Text | | built-unchecked | |
| Format | Font ▸ Show Fonts | ⌘T | built-unchecked | |
| Format | Font ▸ Bold | ⌘B | built-unchecked | |
| Format | Font ▸ Italic | ⌘I | built-unchecked | |
| Format | Font ▸ Underline | ⌘U | built-unchecked | |
| Format | Font ▸ Strikethrough | | built-unchecked | |
| Format | Font ▸ Bigger | ⌘+ | built-unchecked | |
| Format | Font ▸ Smaller | ⌘- | built-unchecked | |
| Format | Font ▸ Show Colors | ⇧⌘C | built-unchecked | |
| Format | Font ▸ Copy Style | ⌥⌘C | built-unchecked | |
| Format | Font ▸ Paste Style | ⌥⌘V | built-unchecked | |
| Format | Text ▸ Align Left | ⌘{ | built-unchecked | |
| Format | Text ▸ Center | ⌘\| | built-unchecked | |
| Format | Text ▸ Justify | | built-unchecked | |
| Format | Text ▸ Align Right | ⌘} | built-unchecked | |
| Format | Text ▸ Writing Direction ▸ Natural | | built-unchecked | `dir` on the lines selected, saved in `html`. Not an Undo step |
| Format | Text ▸ Writing Direction ▸ Left to Right | | built-unchecked | Same |
| Format | Text ▸ Writing Direction ▸ Right to Left | | built-unchecked | Same |
| Format | Indentation ▸ Increase | ⌘] | built-unchecked | |
| Format | Indentation ▸ Decrease | ⌘[ | built-unchecked | |
| View | as List | ⌘1 | built-unchecked | |
| View | as Gallery | ⌘2 | done | [Gallery after a reload](#project-artifact/art_778ce73f9cddf4bd/5) |
| View | Sort By ▸ Date Edited | | built-unchecked | |
| View | Sort By ▸ Date Created | | built-unchecked | |
| View | Sort By ▸ Title | | done | [Preferences shows Title](#project-artifact/art_778ce73f9cddf4bd/6) |
| View | Show/Hide Folders | ⌥⌘S | built-unchecked | |
| View | Show/Hide Note Count | | built-unchecked | |
| View | Attachment View ▸ Small | | built-unchecked | Half size, for every attachment: saved as `notes.attachmentView`, since a picture is not kept in `html` |
| View | Attachment View ▸ Large | | built-unchecked | Same |
| View | Attachments Browser | ⌘3 | built-unchecked | Takes the place of the list and the note: `notes-attachments-browser.tsx`. Replaces the filter this row was |
| View | Zoom In | ⇧⌘> | built-unchecked | |
| View | Zoom Out | ⇧⌘< | built-unchecked | |
| View | Actual Size | ⇧⌘0 | built-unchecked | |
| View | Enter Full Screen | ⌃⌘F | built-unchecked | Shell |
| Window | Minimize | ⌘M | built-unchecked | Shell |
| Window | Zoom | | built-unchecked | Shell |
| Window | Bring All to Front | | built-unchecked | Shell |
| Window | Window list | | built-unchecked | Shell; one window |
| Help | Notes Help | | built-unchecked | Shell: opens Help Viewer on Notes |

## Toolbar

| Item | Status | Notes |
| --- | --- | --- |
| List View | built-unchecked | |
| Gallery View | built-unchecked | |
| Hide/Show Folders | built-unchecked | |
| Attachments Browser | built-unchecked | Pressed while the browser is shown; `notes-files.test.tsx` |
| Delete | done | [Note in Recently Deleted](#project-artifact/art_778ce73f9cddf4bd/3) |
| New Note | built-unchecked | |
| Lock ▸ Lock Note | built-unchecked | The page derives a key from the notes password (PBKDF2, SHA-256, 600,000 iterations, WebCrypto) and seals the note with AES-GCM; the server keeps the envelope and no line, read from `/api/notes/data` in `e2e/notes-lock-batch13-journey.mjs` and the census. The sheet says forgetting the password loses the text. The first lock makes the password, with a hint and Reset Password… for later notes; the next ones use the key held or ask. The note stays open with an open padlock until closed, as on a Mac. Limits: a locked note's title is not kept either, so the list says Locked Note where a Mac shows the title, which the server would have to hold in the clear; a note with attachments can't be locked; edits within about 0.4 s of closing the tab are lost, since no journal may hold the text |
| Lock ▸ Close All Locked Notes | built-unchecked | Journey. Keys and text are also forgotten after 5 idle minutes (a Mac's "a few minutes", provisional; journey, on a fast-forwarded clock), when the last Notes window closes (unit test), and when the desktop's session changes (unit test, and the journey's switch to another account and back). Lock Screen alone doesn't close them: the desktop keeps windows open across it and doesn't tell an app; the idle wait still runs |
| Lock ▸ Change Password… | built-unchecked | Old, new, verify, hint: every note the old password opens is sealed under a new salt in one write naming every revision; a wrong old password changes nothing; another tab is asked for the new one. Journey. A Mac has this in Preferences; here it's in the toolbar's menu |
| Lock ▸ Remove Lock | built-unchecked | Names the note's revision; a closed note asks for the password first. The text is stored in the clear again. Journey and census |
| Add Table | done: [dimmed in Gallery View](#project-artifact/art_a7e016210b9b9bc1/265), [added](#project-artifact/art_a7e016210b9b9bc1/263) | One undo step: Undo and Redo through the Edit menu in `e2e/notes-insert-journey.mjs`. A table that ends the note gets an empty line after it, as Firefox's insertion point cannot stand after a table: the census's table and format rows pass in Firefox 157 with it (9 of 9) and failed without it. Dimmed in Gallery View and with several notes selected |
| Make a Checklist | built-unchecked | Format's Checklist seen |
| Format menu | built-unchecked | Same items as Format |
| Media ▸ Photos… | built-unchecked | A sheet of the person's Photos library, the newest pictures with their thumbnails; the one chosen is attached and kept on the server. From This Computer… takes a file instead. `mail-notes-batch3-journey`, `notes-batch-three.test` |
| Media ▸ Other… | built-unchecked | As Attach File… |
| Media ▸ Insert from iPhone or iPad | dimmed | As Edit's rows |
| Add People | built-unchecked | The toolbar's popover shares the note with another account of this desktop by account name. The note leaves the owner's document for a shared one with its own revision (`src/apps/notes/shared.rs`), and moves to a Shared row in both people's sidebars, marked in the list, with a line saying who shares it and who last edited it. Both edit it; a change reaches the other's open window through the live feed. A save that meets someone else's newer save merges by line and block (`notes-shared-merge.ts`, unit test); both changing one line keeps theirs and gives this page's version as a conflicted copy among its own notes (unit test only, not driven). The owner adds and removes people and Stop Sharing brings the note back; anyone else leaves. Delete on a shared note stops sharing (owner, to Recently Deleted; not driven) or leaves it. A file on it is read by everyone on it. Refused for a Guest User, a locked note and one in Recently Deleted. `mail-notes-batch4-journey`, read from the server across a reload. Absent: invitations by a link or by email, since accounts live on this desktop; Pin goes with the note for everyone; a shared note does not reach Spotlight or Automator's Get Notes, which read the person's own document. |
| Share | built-unchecked | A menu of the note's Share rows, and Copy for its text. AirDrop dimmed with the reason |
| Search | built-unchecked | |

## Sidebar

| Item | Status | Notes |
| --- | --- | --- |
| iCloud section | built-unchecked | |
| Folder counts | built-unchecked | |
| New Folder button | done | [Folder named in place](#project-artifact/art_778ce73f9cddf4bd/7) |
| Select folder | built-unchecked | |
| Delete folder | built-unchecked | First folder cannot go |
| On My Mac account | built-unchecked | Preferences > Enable the On My Mac account lists it in the sidebar with its own Notes folder, kept on the folder as `local`; new folders, notes and Move to keep to it, and turned off its folders stay and are not listed. As with every Notes account here, the notes themselves are kept on the desktop's server: there is no disk of the Mac for a web page to keep them on. `mail-notes-batch3-journey`, across a reload |
| Rename folder | done | [Renamed folder](#project-artifact/art_778ce73f9cddf4bd/7) |
| Nested folders | built-unchecked | Drop on a folder's middle; a parent saved |
| Recently Deleted folder | done | [With its note after a reload](#project-artifact/art_778ce73f9cddf4bd/3) |
| Recover from Recently Deleted | done | [Recover banner](#project-artifact/art_778ce73f9cddf4bd/3); the journey reads the note back in its folder |
| 30-day removal | built-unchecked | When the window opens |

## Note list and gallery

| Item | Status | Notes |
| --- | --- | --- |
| Select one note | built-unchecked | |
| Title follows typing | built-unchecked | |
| Snippet follows typing | built-unchecked | |
| Thumbnail for a picture | built-unchecked | |
| Pinned section | done | [Pinned and Notes headings](#project-artifact/art_778ce73f9cddf4bd/1) |
| Lock mark on a locked note | built-unchecked | Closed padlock, or open while the note is open. Journey |
| Snippet hidden on a locked note | built-unchecked | "Locked Note" and "Locked": no title, preview or thumbnail, and the gallery shows a padlock. Journey. The list's search finds nothing in it, even while open, as its text isn't in the document |
| Locked note: password in the note's place | built-unchecked | "This note is locked", a password field, the hint after a wrong one, and what forgetting costs. Journey |
| A late save is refused | built-unchecked | A save names the note's revision (`src/apps/notes/locked.rs`); one that meets another changes nothing, and the note says it changed in another window, read-only, with Show Latest and Keep as Copy. A lock starts at the document's next revision, so removing a lock and making it again never repeats one a late save may name (`tests/notes.rs`). Two tabs in the journey, the first tab's save held on the wire, stored ciphertext compared; `tests/notes.rs`. A change arriving by the live feed over unsaved typing is refused the same way, and over none just shows. A whole-document save can't change a lock at all |
| Gallery cards | built-unchecked | |
| Gallery double click opens | built-unchecked | |
| Gallery Return opens | built-unchecked | |
| Gallery pinned group | built-unchecked | A Pinned and a Notes heading, each over its own grid: a selection stays inside one group |
| Gallery Back button | built-unchecked | Back to Gallery, in the toolbar after the view switcher, once a card was opened |

## Note

| Item | Status | Notes |
| --- | --- | --- |
| First line is the title | built-unchecked | |
| Date line | built-unchecked | |
| Rich text | built-unchecked | `html` to 100,000 characters |
| Lists | built-unchecked | |
| Tables | built-unchecked | |
| Pictures | built-unchecked | Kept on the server through `/api/notes/attachments` up to 10 MB, and read back after a reload; a thumbnail saved for the list. They stand at the end of the note, not where they were added |
| Links | built-unchecked | Saved in `html`, http and https only; a click opens Safari, a drag selects |
| Data detectors | dimmed | The Substitutions row and panel, with the reason: a web page cannot offer those actions from typed text |
| Tickable checklist | done | [Ticked item, saved in the note](#project-artifact/art_778ce73f9cddf4bd/2) |
| File attachments | built-unchecked | Any file up to 10 MB: an icon, name and size; audio with a player, video in place. A double click opens Quick Look. The record is saved in `files` |
| Sketch | dimmed | Edit and Media, Insert from iPhone or iPad ▸ Add Sketch, with the reason |
| Scan from iPhone | dimmed | Same, Scan Documents |
| Note in its own window | built-unchecked | `notes-window.tsx`; a double click in the list or the row's menu. Menu bar's Edit and Format act on it; the Fonts and Colors rows are dimmed with the reason |

## Attachments browser

| Item | Status |
| --- | --- |
| Photos & Videos | built-unchecked |
| Scans | dimmed: an empty section that says a scan comes from an iPhone's camera, which a web page can't reach |
| Maps | built-unchecked: web addresses on a maps site |
| Websites | built-unchecked: the note's other web addresses and links |
| Audio | built-unchecked |
| Documents | built-unchecked |

## Context menus

| Where | Item | Status |
| --- | --- | --- |
| Note row | Pin | done |  [Two notes pinned](#project-artifact/art_778ce73f9cddf4bd/1) |
| Note row | Lock | built-unchecked | Lock Note or Remove Lock, as File's |
| Note row | Delete | built-unchecked | |
| Note row | Move to ▸ a folder | built-unchecked | |
| Note row | Share | built-unchecked | The Share submenu, as File's |
| Note row | Open in New Window | built-unchecked | Dimmed with the reason where no desktop hosts windows |
| Folder row | New Folder | built-unchecked | |
| Folder row | Rename | done | [Renamed folder](#project-artifact/art_778ce73f9cddf4bd/7) |
| Folder row | Delete | built-unchecked | |
| Folder row | Add People | dimmed: the row's reason says to share a folder's notes one by one with the toolbar's Add People; sharing a whole folder isn't built |
| Note text | Cut | built-unchecked |
| Note text | Copy | built-unchecked |
| Note text | Paste | built-unchecked |
| Note text | Look Up | built-unchecked |
| Note text | Font ▸ Show Fonts | built-unchecked |
| Note text | Font ▸ Bold | built-unchecked |
| Note text | Font ▸ Italic | built-unchecked |
| Note text | Font ▸ Underline | built-unchecked |
| Note text | Spelling ▸ Show Spelling | built-unchecked |
| Note text | Spelling ▸ Check Document | built-unchecked |
| Note text | Speech ▸ Start Speaking | built-unchecked |
| Note text | Speech ▸ Stop Speaking | built-unchecked |
| Note text | Services | built-unchecked: the text selected as the menu opened (`desktop-services.tsx`) |
| Attachment | View as Small | built-unchecked |
| Attachment | View as Large | built-unchecked |
| Attachment | Quick Look | built-unchecked |
| Attachment | Save Attachment | built-unchecked |
| Attachment | Share | built-unchecked: the file rows of a Share menu; a stand-in picture keeps the browser's share sheet, dimmed with the reason without one |
| Table | Add Row | built-unchecked |
| Table | Add Column | built-unchecked |
| Table | Delete Row | built-unchecked |
| Table | Delete Column | built-unchecked |
| Table | Convert to Text | built-unchecked | The context menu's Format rows hold it once |

## Keys outside the menus

| Key | Status |
| --- | --- |
| Backspace removes the note in the list | built-unchecked |
| Delete removes the note in the list | built-unchecked |
| Arrows move in the folder list | built-unchecked |
| Type-select in the folder list | built-unchecked |
| Arrows move in the note list | built-unchecked |
| Type-select in the note list | built-unchecked |
| Arrows move a divider | built-unchecked |

## Drag and drop, multi-selection

| Item | Status | Notes |
| --- | --- | --- |
| Drag a note to a folder | done | [Note moved into the folder](#project-artifact/art_778ce73f9cddf4bd/7) |
| Drag a folder to reorder | built-unchecked | |
| Drag a folder to nest | built-unchecked | |
| Drag several notes to a folder | built-unchecked | |
| Drop a file from Finder into a note | done | [Text file's lines and a picture in the note](#project-artifact/art_778ce73f9cddf4bd/9). Since then any file up to 10 MB, kept on the server; not yet seen running |
| Drop a picture from the desktop into a note | built-unchecked | Same target; the journey drags from Finder |
| Drop text from Safari into a note | built-unchecked | Browser's own, no app code |
| Drag a picture out to Finder | built-unchecked | Any file in a note: `beginDesktopDrag` with its bytes |
| Shift-click a range of notes | built-unchecked | |
| Command-click several notes | done | [Two notes selected](#project-artifact/art_778ce73f9cddf4bd/8) |
| Move several notes | built-unchecked | |
| Delete several notes | built-unchecked | |
| Pin several notes | done | [Two notes pinned](#project-artifact/art_778ce73f9cddf4bd/1) |

## Saved state

| Item | Status | Notes |
| --- | --- | --- |
| Folders survive reload | built-unchecked | `/api/notes/data` |
| Notes survive reload | built-unchecked | |
| Formats survive reload | built-unchecked | |
| Survive server restart | built-unchecked | Census row |
| Per-account isolation | built-unchecked | |
| Live update between windows | built-unchecked | |
| Conflict copy | built-unchecked | |
| Conflict banner | built-unchecked | |
| View across a reload | done | [Gallery after a reload](#project-artifact/art_778ce73f9cddf4bd/5) |
| Sort across a reload | built-unchecked | Saved beside the view |
| Pane widths across a reload | built-unchecked | |
| Selected note across a reload | built-unchecked | |

## Cross-app

| Item | Status | Notes |
| --- | --- | --- |
| Links shared from Safari become notes | built-unchecked | `takeSharedLinks("notes")` |
| Links shared from News become notes | built-unchecked | Same |
| Links shared from Stocks become notes | built-unchecked | Same |
| Share a note to Mail | built-unchecked | File ▸ Share: its text as a file, with its attachments |
| Share a note to Messages | built-unchecked | Same |
| Share a note to Reminders | built-unchecked | File ▸ Share: its text, as a reminder. `e2e/desktop-batch3-journey.mjs` |
| A recording from Voice Memos in a note | built-unchecked | Its Share and its drag reach `takeFiles`, which now takes audio; a player in the note |
| Spotlight finds notes | done: [spotlight-open-note.png](#project-artifact/art_6a3da0a5b88d531a/72) | Opens the note it found, in its folder, in an open window or one the request opens. A locked note isn't found: the document holds no word of it (journey) |
| Siri makes a note | built-unchecked | README |
| Scripts and workflows use `notes.list` | built-unchecked | `actions.rs` |
| Scripts and workflows use `notes.make` | built-unchecked | `actions.rs` |
| Finder opens a file in Notes | built-unchecked | Open With and the Dock tile (`opens`, `opensOnlyWhenAsked`): the file becomes a new note |
| Clipboard with other apps | built-unchecked | Browser clipboard through Edit and keys |
| Look Up from a note by key | built-unchecked | `startLookUp` |
| Look Up from a menu | built-unchecked | Edit menu and text context menu |

## Open work ledger

Nothing is open for Notes alone. Live runs of `notes-*` and `editors-*` journeys belong to the Release thread.

Links and Writing Direction need `ferrite-apps/desktop/src/apps/notes/mod.rs` to accept `<a href>` and `dir` in `html`; without that the server refuses a note holding either.

Files: a note's `files` name uploads under `/api/notes/attachments`, as Calendar's events do (`src/apps/attachments.rs`); bytes dropped from a note stay, so Undo can bring the file back. A file always comes back at the end of the note.

Still to build: sharing a whole folder (the folder row's Add People). Reminders takes a shared link but not a note's text.

## Calls made

- Sketching and iPhone scan cannot exist in a browser in the same form: dimmed with a reason.
- Add People can use the desktop's accounts, as Reminders does, so it is item 12, not a stub.
- Smart folders came after 10.15, so they are not listed.

## Build items, most used first

1. **File and View menus on the desktop.** Register New Note, New Folder, Share, Close, Lock, Print; as List, as Gallery, Show/Hide Folders with keys. Check: each item acts in the browser.
2. **Real checklists.** Checklist from Format and toolbar, tickable circles saved in `html`, Mark as Checked, More ▸ commands, Move List Item. Server allowlist must take it. Check: tick, reload.
3. **Recently Deleted.** Folder, Recover, Delete Immediately, Erase All, 30 days. Check: delete, reload, recover.
4. **Context menus** on note rows, folder rows and note text, with Rename Folder.
5. **Pin notes.** Pinned section in list and gallery, File > Pin, context menu; saved.
6. **Multi-selection and drag.** Shift and Command click; move several to a folder by drag and Move To; delete several; folder reorder and nesting.
7. **Find in a note and note-list search keys.** ⌘F bar, Next, Previous, Use Selection; Notes has no Replace.
8. **Sort and note count.** Sort By, show/hide count; Preferences with default account, sort, new notes start with, text size.
9. **Real lock.** Built: keys and text are in memory per session, and a save names the note's revision (Lock rows above). Unlocked notes can't take new attachments.
10. **Attachments.** Drive-backed files, drag from Finder, Attachment View, attachments browser, Attach File…, Add Link…. Depends on Finder worker's drag.
11. **Format completions.** Subheading, Monospaced, Dashed List, Convert to Text, Copy and Paste Style, Writing Direction, indentation, keys, Paste and Match Style. Update `notes.mdx`.
12. **Add People.** Share a note with an account as Reminders does; permission popover; live changes.
13. **Share, import, export, print.** Share menu (Finder worker's sheet), Export as PDF, Print, Import to Notes.
14. **Edit completions and Help.** Spelling, Substitutions, Transformations, Speech, Emoji; Notes Help opens Help Viewer; Spotlight opens the found note.
15. **Saved view state:** view, sort, widths, last note.
